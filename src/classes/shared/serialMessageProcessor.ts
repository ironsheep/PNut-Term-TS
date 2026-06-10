/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

// src/classes/shared/serialMessageProcessor.ts

import { EventEmitter } from 'events';
import { SharedMessageType, ExtractedMessage } from './sharedMessagePool';
import { MessageRouter, RouteDestination } from './messageRouter';
import { DTRResetManager } from './dtrResetManager';
import { PerformanceMonitor } from './performanceMonitor';
import { WorkerExtractor } from './workerExtractor';

/**
 * SerialMessageProcessor - Autonomous Worker Thread Architecture
 *
 * Integrates components for P2 serial message processing:
 * Main Thread → SharedCircularBuffer → Autonomous Worker → SharedMessagePool → MessageRouter → Windows
 *
 * ARCHITECTURE:
 * - WorkerExtractor: Main thread writes USB data to SharedCircularBuffer
 * - Worker Thread: Autonomous loop monitors buffer, extracts messages to SharedMessagePool
 * - MessageRouter: Routes messages from SharedMessagePool to windows
 * - DTRResetManager: P2 hardware reset synchronization
 *
 * KEY DESIGN:
 * - Worker thread is autonomous (no coordination messages)
 * - Zero-copy via SharedArrayBuffer
 * - Single SharedMessagePool (no duplicate pools)
 * - Router reads from pool, processes, routes to windows, releases
 */

export interface ProcessorStats {
  workerExtractor: any;
  router: any;
  dtrReset: any;
  isRunning: boolean;
  startTime: number;
  uptime: number;
  performance?: any;
}

export class SerialMessageProcessor extends EventEmitter {
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  // Worker Thread architecture components
  private workerExtractor: WorkerExtractor;
  private router: MessageRouter;
  private dtrResetManager: DTRResetManager;

  // Performance monitoring
  private performanceMonitor: PerformanceMonitor;

  // State
  private isRunning: boolean = false;
  private startTime: number = 0;

  // [#30 perf] Time-budgeted cooperative consume. The single main thread is shared between CONSUMING
  // the serial message stream (route→parse→unpack→color→queue) and RENDERING. Routing every message
  // the instant the worker hands it over monopolizes the thread in long synchronous bursts, freezing
  // the display for seconds. Instead we ENQUEUE poolIds and drain them under a time budget, yielding
  // (setImmediate) between slices so the render loop + IPC replies get a turn — the display then
  // repaints at a steady cadence instead of in bursts. A TIME budget (not a message COUNT) is
  // hardware-INDEPENDENT: any machine yields after CONSUME_BUDGET_MS of work, so it paints just as
  // often everywhere — a slow box simply processes fewer messages per slice (fills slower) while
  // still always showing activity. 8ms = half a 60fps frame (16.7ms), keeping any single burst well
  // under the ~100ms human "instantaneous" threshold. Composes with backpressure: un-drained data
  // waits losslessly in the ring/pool. Time is checked every 64 messages so the clock isn't read
  // per-message (64 msgs is sub-ms even on a Pi → negligible overshoot).
  private static readonly CONSUME_BUDGET_MS = 8;
  private pendingPoolIds: number[] = [];
  private drainScheduled: boolean = false;

  constructor(
    enablePerformanceLogging: boolean = false,
    performanceLogPath?: string
  ) {
    super();

    this.logConsoleMessage('[Processor] Initializing Worker Thread architecture');

    // Create WorkerExtractor (contains SharedCircularBuffer + SharedMessagePool)
    this.workerExtractor = new WorkerExtractor(1048576, 1000, 65536);

    // Create router (Worker Thread architecture only)
    this.router = new MessageRouter();

    // Wire SharedMessagePool to router
    this.router.setSharedMessagePool(this.workerExtractor.getMessagePool());

    // Create DTR reset manager
    this.dtrResetManager = new DTRResetManager(this.router);

    // Create performance monitor
    const logPath = performanceLogPath || (enablePerformanceLogging ? 'performance.log' : undefined);
    this.performanceMonitor = new PerformanceMonitor(logPath);

    // Wire performance monitoring
    this.router.setPerformanceMonitor(this.performanceMonitor);
    this.dtrResetManager.setPerformanceMonitor(this.performanceMonitor);

    // Wire up Worker Thread pipeline
    this.setupPipeline();
  }

  /**
   * Set up Worker Thread pipeline connections
   */
  private setupPipeline(): void {
    if (!this.workerExtractor) {
      throw new Error('WorkerExtractor not initialized');
    }

    // Worker sends poolId when message extracted. [#30] Enqueue cheaply; the paced drain does the
    // heavy routeFromPool work within a time budget so rendering shares the main thread.
    this.workerExtractor.on('messageExtracted', (poolId: number) => {
      this.pendingPoolIds.push(poolId);
      this.ensureDrainScheduled();
    });

    // Handle worker ready
    this.workerExtractor.on('workerReady', () => {
      this.logConsoleMessage('[Processor] Worker thread ready');
      this.emit('workerReady');
    });

    // Handle buffer overflow
    this.workerExtractor.on('bufferOverflow', () => {
      console.error('[Processor] Worker buffer overflow, waiting for resync');
      this.emit('bufferOverflow', {});

      // Clear buffer and wait for clean message boundary
      this.workerExtractor!.clearBuffer();
      this.dtrResetManager.clearSynchronization();
    });

    // Handle worker errors
    this.workerExtractor.on('workerError', (error) => {
      console.error('[Processor] Worker error:', error);
      this.emit('workerError', error);
    });

    // Handle routing events (same as old architecture)
    this.router.on('messageRouted', (event) => {
      // Update DTR reset manager message counts
      const isBeforeReset = this.dtrResetManager.isMessageBeforeReset(event.message.timestamp);
      this.dtrResetManager.updateMessageCounts(isBeforeReset);
    });

    // CRITICAL: Forward debugger packet event for P2 response
    this.router.on('debuggerPacketReceived', (packet: Uint8Array) => {
      this.logConsoleMessage('[Processor] Forwarding debuggerPacketReceived event');
      this.emit('debuggerPacketReceived', packet);
    });

    // CRITICAL: Forward P2 system reboot event for golden sync handling
    this.router.on('p2SystemReboot', (eventData: { message: string; timestamp: number }) => {
      this.logConsoleMessage('[Processor] 🎯 Forwarding p2SystemReboot event - golden sync marker');
      this.emit('p2SystemReboot', eventData);
    });

    this.router.on('routingError', (error) => {
      console.error('[Processor] Routing error:', error);
      this.emit('routingError', error);
    });

    // Handle DTR/RTS reset events
    this.dtrResetManager.on('resetDetected', (event) => {
      this.logConsoleMessage(`[Processor] ${event.type} reset detected`);
      this.emit('resetDetected', event);
      // Also emit specific event for reset type
      if (event.type === 'DTR') {
        this.emit('dtrReset', event);
      } else if (event.type === 'RTS') {
        this.emit('rtsReset', event);
      }
    });

    this.dtrResetManager.on('rotateLog', (event) => {
      this.logConsoleMessage(`[Processor] Log rotation requested for ${event.type} reset`);
      this.emit('rotateLog', event);
    });

    // Propagate sync status changes
    this.dtrResetManager.on('syncStatusChanged', (status) => {
      this.emit('syncStatusChanged', status);
    });

    // Handle performance threshold alerts
    this.performanceMonitor.on('threshold', (alert) => {
      this.logConsoleMessage('[Processor] Performance threshold exceeded:', alert);
      this.emit('performanceAlert', alert);
    });
  }

  /** [#30] Schedule the paced consume drain if one isn't already pending. */
  private ensureDrainScheduled(): void {
    if (this.drainScheduled) return;
    this.drainScheduled = true;
    setImmediate(() => this.drainPoolQueue());
  }

  /**
   * [#30] Drain queued poolIds through the router for up to CONSUME_BUDGET_MS, then YIELD so the
   * render loop + IPC replies run, and reschedule while work remains. This time-shares the single
   * main thread between serial consumption and rendering so the display never freezes in long
   * bursts. See CONSUME_BUDGET_MS.
   */
  private drainPoolQueue(): void {
    this.drainScheduled = false;
    if (!this.isRunning) {
      // Stopped/torn down — the pool SAB is being discarded with the worker, so just drop the queue.
      this.pendingPoolIds = [];
      return;
    }
    const budget = SerialMessageProcessor.CONSUME_BUDGET_MS;
    const start = performance.now();
    let n = 0;
    while (this.pendingPoolIds.length > 0) {
      this.router.routeFromPool(this.pendingPoolIds.shift()!);
      // Check the clock every 64 messages; yield once the time budget is spent.
      if ((++n & 0x3f) === 0 && performance.now() - start >= budget) break;
    }
    if (this.pendingPoolIds.length > 0) this.ensureDrainScheduled();
  }


  /**
   * Start processing
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    
    // Start performance snapshots
    this.performanceMonitor.startSnapshots(5000);
    
    this.logConsoleMessage('[Processor] Started serial message processing');
    this.emit('started');
  }

  /**
   * Stop processing
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Wait for queues to drain
    await this.router.waitForQueueDrain(5000);

    // Shutdown worker thread
    await this.workerExtractor.shutdown();

    // Stop performance snapshots
    this.performanceMonitor.stopSnapshots();

    this.logConsoleMessage('[Processor] Stopped serial message processing');
    this.emit('stopped');
  }

  /**
   * Receive serial data
   * This is the entry point for all serial data
   */
  public receiveData(data: Buffer): void {
    this.logConsoleMessage(`[SerialMessageProcessor] receiveData(): ${data.length} bytes, running: ${this.isRunning}`);

    if (!this.isRunning) {
      this.logConsoleMessage('[Processor] Received data while not running, ignoring');
      return;
    }

    // Pass to WorkerExtractor (writes to SharedCircularBuffer)
    this.workerExtractor.receiveData(data);
  }

  /**
   * Handle DTR reset
   */
  public async onDTRReset(): Promise<void> {
    await this.dtrResetManager.onDTRReset();
  }

  /**
   * Handle RTS reset
   */
  public async onRTSReset(): Promise<void> {
    await this.dtrResetManager.onRTSReset();
  }

  /**
   * Register a message destination
   */
  public registerDestination(messageType: SharedMessageType, destination: RouteDestination): void {
    this.router.registerDestination(messageType, destination);
  }

  /**
   * Apply standard P2 routing configuration
   */
  public applyStandardRouting(
    debugLogger: RouteDestination,
    windowCreator: RouteDestination,
    debuggerWindow?: RouteDestination
  ): void {
    this.router.applyStandardRouting(debugLogger, windowCreator, debuggerWindow);
  }

  /**
   * Get comprehensive statistics
   */
  public getStats(): ProcessorStats {
    const uptime = this.isRunning ? Date.now() - this.startTime : 0;

    return {
      workerExtractor: this.workerExtractor.getStats(),
      router: this.router.getStats(),
      dtrReset: this.dtrResetManager.getStats(),
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime,
      performance: this.performanceMonitor.getSnapshot()
    };
  }

  /**
   * Reset all statistics
   */
  public resetStats(): void {
    // Note: WorkerExtractor doesn't have resetStats yet
    this.router.resetStats();
    this.dtrResetManager.resetStats();
    this.performanceMonitor.reset();
  }

  /**
   * Clear all buffers and queues
   */
  public clearAll(): void {
    this.workerExtractor.clearBuffer();
  }

  /**
   * Get synchronization status
   */
  public getSyncStatus(): { synchronized: boolean; source: string } {
    return this.dtrResetManager.getSyncStatus();
  }

  /**
   * Check if system is idle (LEGACY - simplified for Worker Thread architecture)
   * Worker Thread architecture has no queue, so always considered idle
   */
  public isIdle(): boolean {
    return !this.dtrResetManager.isResetPending();
  }

  /**
   * Get component references (for testing/debugging)
   */
  public getComponents() {
    return {
      workerExtractor: this.workerExtractor,
      router: this.router,
      dtrResetManager: this.dtrResetManager,
      performanceMonitor: this.performanceMonitor,
      architecture: 'Worker Thread'
    };
  }

  /**
   * Simulate data reception (for testing)
   */
  public simulateData(data: Uint8Array): void {
    if (!this.isRunning) {
      this.start();
    }
    this.receiveData(Buffer.from(data));
  }

  /**
   * Wait for processing to complete
   */
  public async waitForIdle(timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkIdle = () => {
        if (this.isIdle()) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }

        setTimeout(checkIdle, 10);
      };

      checkIdle();
    });
  }
}