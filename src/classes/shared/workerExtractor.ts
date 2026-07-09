/** @format */

// src/classes/shared/workerExtractor.ts

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { SharedCircularBuffer } from './sharedCircularBuffer';
import { SharedMessagePool } from './sharedMessagePool';
import { USBTrafficLogger } from './usbTrafficLogger';
import path from 'path';

/**
 * WorkerExtractor - Manages extraction worker with SharedMessagePool
 *
 * Main thread interface for Worker-based message extraction:
 * 1. Creates SharedCircularBuffer and SharedMessagePool
 * 2. Spawns extraction worker
 * 3. Handles USB data reception (writes to shared buffer)
 * 4. Receives poolId from worker (not message data - zero-copy!)
 * 5. Emits poolId for routing
 *
 * Events:
 * - 'messageExtracted': (poolId: number) => void - Message in pool, ready for routing
 * - 'bufferOverflow': () => void - Buffer full, data dropped
 * - 'workerError': (error) => void - Worker encountered error
 */

const ENABLE_CONSOLE_LOG: boolean = false;

export class WorkerExtractor extends EventEmitter {
  private static logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log('[WorkerExtractor]', ...args);
    }
  }

  private buffer: SharedCircularBuffer;
  private messagePool: SharedMessagePool;
  private worker: Worker;
  private workerReady: boolean = false;
  private usbLogger: USBTrafficLogger;

  // Statistics
  private totalBytesReceived: number = 0;
  private totalMessagesExtracted: number = 0;
  private bufferOverflows: number = 0;

  // Message extraction rate tracking
  private messagesInLastSecond: number = 0;
  private lastMessageRateCheckTime: number = Date.now();
  private peakMessagesPerSecond: number = 0;
  private peakMessageRateStartTime: number = 0;
  private peakMessageRateDuration: number = 0;

  // [#30] Ring backpressure (NO DROP). When the SAB ring is momentarily full (the worker has
  // stopped extracting because the pool is full), new USB chunks are held here IN ORDER and
  // written as the ring drains. Main never blocks → producer/consumer never deadlock. Bounded by
  // burst size for a finite stream. clearBuffer() discards these (pre-reset data).
  private pendingRingChunks: Uint8Array[] = [];
  private pendingRingBytes: number = 0;
  private ringQueueHighWater: number = 0;
  private ringDrainScheduled: boolean = false;
  // [#30] Keep the SAB ring at most HALF full and hold the rest of the backlog in pendingRingChunks
  // (main's race-free JS heap). A near-FULL SPSC ring couples producer (main tail) and consumer
  // (worker head) tightly enough that the buffer's non-atomic space read can let a write clobber
  // not-yet-consumed bytes → silent corruption/loss. A 50% cap guarantees a large margin between
  // tail and head, so that race can't fire. Set from bufferSize in the constructor.
  private readonly ringWriteLimit: number;

  // [#30] Gate periodic RX backpressure stats (PNUT_RX_STATS=1). Forwarded to the worker; main
  // logs ring-queue depth on the existing once-per-second message-rate cadence.
  private rxStats: boolean = process.env.PNUT_RX_STATS === '1';

  constructor(bufferSize: number = 1048576, maxSlots: number = 1000, maxMessageSize: number = 65536) {
    super();

    WorkerExtractor.logConsoleMessage('Initializing worker-based extraction with SharedMessagePool');

    // Create shared circular buffer
    this.buffer = new SharedCircularBuffer(bufferSize);
    this.ringWriteLimit = Math.floor(bufferSize / 2); // [#30] keep ring ≤ 50% full (see field)

    // Create shared message pool
    this.messagePool = new SharedMessagePool(maxSlots, maxMessageSize);

    // Create USB traffic logger (disabled by default)
    this.usbLogger = new USBTrafficLogger();

    // Listen for buffer overflow
    this.buffer.on('bufferOverflow', () => {
      this.bufferOverflows++;
      this.emit('bufferOverflow');
    });

    // Create extraction worker
    // Handle multiple environments: packaged app, development, and tests
    const fs = require('fs');
    let workerPath: string;

    // Try paths in order of likelihood
    const candidatePaths = [
      // Bundled worker (preferred - all dependencies included)
      path.join(__dirname, 'workers/extractionWorker.bundled.js'),
      path.join(__dirname, '../../workers/extractionWorker.bundled.js'),
      path.join(process.cwd(), 'dist/workers/extractionWorker.bundled.js'),
      // Fallback to TypeScript-compiled worker (development/test)
      path.join(__dirname, 'workers/extractionWorker.js'),
      path.join(__dirname, '../../workers/extractionWorker.js'),
      path.join(process.cwd(), 'dist/workers/extractionWorker.js')
    ];

    workerPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];

    WorkerExtractor.logConsoleMessage(`[WorkerExtractor] Attempting to create worker from: ${workerPath}`);
    WorkerExtractor.logConsoleMessage(`[WorkerExtractor] __dirname is: ${__dirname}`);
    WorkerExtractor.logConsoleMessage(`[WorkerExtractor] Tried paths: ${candidatePaths.join(', ')}`);

    this.worker = new Worker(workerPath);

    WorkerExtractor.logConsoleMessage(`[WorkerExtractor] Worker created successfully`);
    WorkerExtractor.logConsoleMessage(`Worker created from: ${workerPath}`);

    // Handle worker messages
    this.worker.on('message', (msg: any) => {
      this.handleWorkerMessage(msg);
    });

    this.worker.on('error', (error: Error) => {
      WorkerExtractor.logConsoleMessage('[WorkerExtractor] Worker error:', error);
      this.emit('workerError', error);
    });

    this.worker.on('exit', (code: number) => {
      if (code !== 0) {
        WorkerExtractor.logConsoleMessage(`[WorkerExtractor] Worker exited with code ${code}`);
      }
    });

    // Send SharedCircularBuffer and SharedMessagePool to worker
    const bufferTransferables = this.buffer.getTransferables();
    const poolTransferables = this.messagePool.getTransferables();

    this.worker.postMessage({
      type: 'init',
      // SharedCircularBuffer
      dataBuffer: bufferTransferables.dataBuffer,
      stateBuffer: bufferTransferables.stateBuffer,
      size: bufferTransferables.size,
      // SharedMessagePool
      metadataBuffer: poolTransferables.metadataBuffer,
      poolDataBuffer: poolTransferables.dataBuffer,
      maxSlots: poolTransferables.maxSlots,
      maxMessageSize: poolTransferables.maxMessageSize,
      // [#30] forward the RX-stats gate so the worker emits backpressure telemetry too
      rxStats: this.rxStats
    });

    WorkerExtractor.logConsoleMessage('SharedCircularBuffer and SharedMessagePool sent to worker');
  }

  /**
   * Handle messages from worker thread
   */
  private handleWorkerMessage(msg: any): void {
    switch (msg.type) {
      case 'loaded':
        WorkerExtractor.logConsoleMessage('Worker loaded');
        break;

      case 'ready':
        WorkerExtractor.logConsoleMessage('Worker ready');
        this.workerReady = true;
        this.emit('workerReady');
        break;

      case 'message':
        // Worker extracted message - emit poolId (zero-copy!)
        this.totalMessagesExtracted++;
        this.messagesInLastSecond++;

        // Track message extraction rate
        const now = Date.now();
        const elapsed = now - this.lastMessageRateCheckTime;

        // Update rate every second
        if (elapsed >= 1000) {
          const currentRate = Math.round(this.messagesInLastSecond / (elapsed / 1000));

          // Track peak rate and duration
          if (currentRate > this.peakMessagesPerSecond) {
            // New peak
            this.peakMessagesPerSecond = currentRate;
            this.peakMessageRateStartTime = now;
            this.peakMessageRateDuration = 0;
          } else if (currentRate === this.peakMessagesPerSecond && this.peakMessagesPerSecond > 0) {
            // Sustaining peak
            this.peakMessageRateDuration = now - this.peakMessageRateStartTime;
          }

          // [#30] RX backpressure telemetry (PNUT_RX_STATS=1): ring-queue depth confirms the
          // main-side hold-queue stays bounded (no unbounded growth = healthy backpressure).
          if (this.rxStats) {
            console.error(
              `[RX-STATS main] msgs/s=${currentRate} ringQueueDepth=${this.pendingRingChunks.length} ` +
                `pendingRingBytes=${this.pendingRingBytes} ringQueueHighWater=${this.ringQueueHighWater}`
            );
          }

          // Reset for next second
          this.messagesInLastSecond = 0;
          this.lastMessageRateCheckTime = now;
        }

        WorkerExtractor.logConsoleMessage(
          `Received poolId ${msg.poolId} from worker (total: ${this.totalMessagesExtracted})`
        );

        // Emit poolId - router will read from SharedMessagePool and release
        this.emit('messageExtracted', msg.poolId);
        break;

      case 'error':
        WorkerExtractor.logConsoleMessage('[WorkerExtractor] Worker reported error:', msg.error);
        this.emit('workerError', new Error(msg.error));
        break;

      default:
        WorkerExtractor.logConsoleMessage(`Unknown message from worker: ${msg.type}`);
    }
  }

  /**
   * Receive USB data (called by USB driver)
   * Fast path - just writes to shared buffer and signals worker
   */
  public receiveData(data: Buffer): void {
    WorkerExtractor.logConsoleMessage(`receiveData(): ${data.length} bytes received`);

    // Independent immutable copy (prevents serialport buffer-reuse corruption). The USB logger
    // reads exactly these bytes; the ring copies out of it via .set(), never mutating it.
    const dataCopy = new Uint8Array(Buffer.from(data));

    // Log USB traffic if enabled (async, non-blocking) — log what ARRIVED, before any queuing.
    this.usbLogger.log(dataCopy, Date.now());

    this.totalBytesReceived += data.length;

    // [#30] Ring backpressure: never drop, and never call appendAtTail without space (that emits
    // the destructive bufferOverflow→clearBuffer). Hold chunks in order when the ring is full and
    // drain as it frees. Returns immediately — the event loop stays free for the next USB packet.
    this.enqueueOrWriteRing(dataCopy);
  }

  /**
   * [#30] Write a chunk to the ring if it fits, else hold it in FIFO order. Always flushes held
   * chunks first so ordering is preserved. Never blocks; never triggers the destructive overflow.
   * Safe single-writer: only main calls appendAtTail; the worker only advances head (the consumer),
   * which can only INCREASE available space — so a chunk that passes the space check always fits.
   */
  private enqueueOrWriteRing(chunk: Uint8Array): void {
    this.flushPendingRing();
    // Write to the ring only while it stays ≤ 50% full (ringWriteLimit) AND the silent append
    // succeeds; otherwise hold the chunk in order. The fill cap avoids the near-full SPSC race; the
    // honored silent return is belt-and-suspenders so a write is NEVER assumed and NEVER drops. [#30]
    if (
      this.pendingRingChunks.length === 0 &&
      this.buffer.getUsedSpace() + chunk.length <= this.ringWriteLimit &&
      this.buffer.appendAtTail(chunk, true)
    ) {
      return;
    }
    this.pendingRingChunks.push(chunk);
    this.pendingRingBytes += chunk.length;
    if (this.pendingRingBytes > this.ringQueueHighWater) {
      this.ringQueueHighWater = this.pendingRingBytes;
    }
    this.scheduleRingDrain();
  }

  /**
   * [#30] Drain held chunks into the ring while it stays ≤ 50% full, preserving FIFO order. Stops
   * (keeps the chunk) the moment the fill cap is reached or a silent write doesn't fit, so the
   * near-full race can't fire and the head chunk is never dropped. The drain pump retries.
   */
  private flushPendingRing(): void {
    while (this.pendingRingChunks.length > 0) {
      const head = this.pendingRingChunks[0];
      if (this.buffer.getUsedSpace() + head.length > this.ringWriteLimit) break;
      if (!this.buffer.appendAtTail(head, true)) break;
      this.pendingRingBytes -= this.pendingRingChunks.shift()!.length;
    }
  }

  /**
   * [#30] Self-terminating drain pump. Runs only while chunks are held; the worker keeps
   * extracting (freeing ring space) as main releases pool slots, so the queue drains. setImmediate
   * keeps the main loop responsive between attempts (no busy-wait, no blocking).
   */
  private scheduleRingDrain(): void {
    if (this.ringDrainScheduled) return;
    this.ringDrainScheduled = true;
    setImmediate(() => {
      this.ringDrainScheduled = false;
      this.flushPendingRing();
      if (this.pendingRingChunks.length > 0) this.scheduleRingDrain();
    });
  }

  /**
   * Get SharedMessagePool (for reading messages)
   */
  public getMessagePool(): SharedMessagePool {
    return this.messagePool;
  }

  /**
   * Get statistics
   */
  public getStats() {
    return {
      totalBytesReceived: this.totalBytesReceived,
      totalMessagesExtracted: this.totalMessagesExtracted,
      bufferOverflows: this.bufferOverflows,
      peakMessagesPerSecond: this.peakMessagesPerSecond,
      peakMessageRateDuration: this.peakMessageRateDuration,
      bufferStats: this.buffer.getStats(),
      poolStats: this.messagePool.getStats(),
      workerReady: this.workerReady,
      usbLogger: this.usbLogger.getStats()
    };
  }

  /**
   * Log final statistics (called on shutdown)
   */
  public logFinalStats(): void {
    WorkerExtractor.logConsoleMessage(`[WorkerExtractor] 📊 FINAL STATISTICS:`);
    WorkerExtractor.logConsoleMessage(`  Total Bytes Received: ${this.totalBytesReceived.toLocaleString()} bytes`);
    WorkerExtractor.logConsoleMessage(`  Total Messages Extracted: ${this.totalMessagesExtracted.toLocaleString()}`);
    WorkerExtractor.logConsoleMessage(`  Buffer Overflows: ${this.bufferOverflows}`);
    WorkerExtractor.logConsoleMessage(
      `  Peak Message Rate: ${this.peakMessagesPerSecond.toLocaleString()} messages/sec`
    );
    if (this.peakMessageRateDuration > 0) {
      WorkerExtractor.logConsoleMessage(
        `  Peak Rate Duration: ${Math.round(this.peakMessageRateDuration / 1000)} seconds`
      );
    }

    // Log component stats
    this.buffer.logFinalStats();
    this.messagePool.logFinalStats();
  }

  /**
   * Enable USB traffic logging to file
   * @param logFilePath - Path to log file (will append if exists)
   */
  public enableUSBLogging(logFilePath: string): void {
    this.usbLogger.enable(logFilePath);
  }

  /**
   * Disable USB traffic logging
   */
  public disableUSBLogging(): void {
    this.usbLogger.disable();
  }

  /**
   * Check if USB logging is enabled
   */
  public isUSBLoggingEnabled(): boolean {
    return this.usbLogger.isEnabled();
  }

  /**
   * Log transmitted data to USB traffic log
   * @param data - Data being transmitted to P2
   */
  public logTxData(data: string | Uint8Array | Buffer): void {
    this.usbLogger.logTx(data);
  }

  /**
   * Get USB logger statistics
   */
  public getUSBLoggerStats() {
    return this.usbLogger.getStats();
  }

  /**
   * Shutdown worker
   */
  public async shutdown(): Promise<void> {
    WorkerExtractor.logConsoleMessage('Shutting down worker');

    // Log final statistics before shutdown
    this.logFinalStats();

    // Disable USB logging and flush
    if (this.usbLogger.isEnabled()) {
      this.usbLogger.disable();
    }

    this.worker.postMessage({ type: 'shutdown' });

    // Give worker time to exit gracefully
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Clear buffer
   */
  /**
   * [#30] Backpressure diagnostic snapshot (tests / HW debugging).
   */
  public getBackpressureDebug() {
    return {
      pendingRingChunks: this.pendingRingChunks.length,
      pendingRingBytes: this.pendingRingBytes,
      ringQueueHighWater: this.ringQueueHighWater,
      ringDrainScheduled: this.ringDrainScheduled,
      ringUsed: this.buffer.getUsedSpace(),
      ringAvailable: this.buffer.getAvailableSpace(),
      ringHasData: this.buffer.hasData()
    };
  }

  public clearBuffer(): void {
    this.buffer.clear();
    // [#30] Discard held pre-reset chunks and tell the worker to drop any stashed message so no
    // pre-reset data is emitted across the resync boundary (DTR/RTS reset path).
    this.pendingRingChunks = [];
    this.pendingRingBytes = 0;
    this.worker.postMessage({ type: 'clear' });
  }

  /**
   * Cog `cogId`'s renderer reported its break framed (Phase 3 complete). Path 1:
   * relay it to the worker so its per-cog stream for that cog returns to
   * awaitingPhase1 and the next Phase-1 (any cog) is detected. A tiny forward —
   * no framing on the main thread.
   */
  public signalDebuggerPhase3Done(cogId: number): void {
    this.worker.postMessage({ type: 'debuggerPhase3Done', cogId });
  }

  /**
   * Relay a debugger window's per-break Phase-3 fixed-size hint (§3) to the
   * worker's per-cog demux, so it can delimit cog `cogId`'s Phase-3 exactly. A
   * tiny forward — no framing on the main thread. Mirrors signalDebuggerPhase3Done.
   */
  public signalDebuggerPhase3Size(cogId: number, size: number): void {
    this.worker.postMessage({ type: 'debuggerPhase3Size', cogId, size });
  }

  /**
   * DTR/RTS reset (§4): tell the worker's per-cog demux to abandon every
   * in-flight debug exchange and return to awaitingPhase1, so the post-reboot
   * first Phase-1 of any cog frames cleanly. A tiny forward — no framing on the
   * main thread. Scoped to debug state; does NOT clear the streaming ring.
   */
  public signalDebuggerReset(): void {
    this.worker.postMessage({ type: 'debuggerReset' });
  }
}
