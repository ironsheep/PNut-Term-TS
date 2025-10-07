/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

// src/classes/shared/serialMessageProcessor.ts

import { EventEmitter } from 'events';
import { MessageType, ExtractedMessage } from './sharedMessagePool';
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

    // Worker sends poolId when message extracted
    this.workerExtractor.on('messageExtracted', (poolId: number) => {
      this.logConsoleMessage(`[Processor] Worker extracted message, poolId: ${poolId}`);

      // Route from SharedMessagePool (zero-copy!)
      this.router.routeFromPool(poolId);
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
  public registerDestination(messageType: MessageType, destination: RouteDestination): void {
    this.router.registerDestination(messageType, destination);
  }

  /**
   * Apply standard P2 routing configuration
   */
  public applyStandardRouting(
    debugLogger: RouteDestination,
    windowCreator: RouteDestination,
    debuggerWindow?: RouteDestination,
    cogWindowRouter?: RouteDestination
  ): void {
    this.router.applyStandardRouting(debugLogger, windowCreator, debuggerWindow, cogWindowRouter);
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