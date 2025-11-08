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

  constructor(bufferSize: number = 1048576, maxSlots: number = 1000, maxMessageSize: number = 65536) {
    super();

    WorkerExtractor.logConsoleMessage('Initializing worker-based extraction with SharedMessagePool');

    // Create shared circular buffer
    this.buffer = new SharedCircularBuffer(bufferSize);

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
      maxMessageSize: poolTransferables.maxMessageSize
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

    // Create independent copy for safety (prevents buffer reuse corruption)
    const dataCopy = new Uint8Array(Buffer.from(data));

    // Log USB traffic if enabled (async, non-blocking)
    this.usbLogger.log(dataCopy, Date.now());

    // Write to shared buffer (fast: bulk .set() operation)
    const written = this.buffer.appendAtTail(dataCopy);

    if (!written) {
      // Buffer overflow - data dropped
      WorkerExtractor.logConsoleMessage(`Buffer overflow! Dropped ${data.length} bytes`);
      return;
    }

    this.totalBytesReceived += data.length;

    // Worker autonomously monitors buffer - no signaling needed
    // CRITICAL: Return immediately - event loop free for next USB packet!
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
  public clearBuffer(): void {
    this.buffer.clear();
  }
}
