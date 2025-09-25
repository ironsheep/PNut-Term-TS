/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

// src/classes/shared/serialMessageProcessor.ts

import { EventEmitter } from 'events';
import { CircularBuffer } from './circularBuffer';
import { DynamicQueue } from './dynamicQueue';
import { SerialReceiver } from './serialReceiver';
import { MessageExtractor, ExtractedMessage, MessageType } from './messageExtractor';
import { MessageRouter, RouteDestination } from './messageRouter';
import { DTRResetManager } from './dtrResetManager';
import { PerformanceMonitor } from './performanceMonitor';

/**
 * SerialMessageProcessor - Two-Tier Pattern Matching Pipeline Integration
 * 
 * Integrates all components for P2 serial message processing pipeline:
 * SerialReceiver → CircularBuffer → MessageExtractor → MessageRouter → Windows
 * 
 * ARCHITECTURE INTEGRATION:
 * - SerialReceiver: Buffer → CircularBuffer with 1MB capacity  
 * - MessageExtractor: Two-Tier Pattern Matching with Pascal study decisions
 * - MessageRouter: Terminal FIRST, Debugger SECOND routing philosophy
 * - DTRResetManager: P2 hardware reset synchronization
 * 
 * COMPONENT INDEPENDENCE (Clean separation of concerns):
 * - SerialReceiver: Only handles Buffer → CircularBuffer conversion
 * - MessageExtractor: Only handles Two-Tier pattern matching and extraction
 * - MessageRouter: Only handles confidence-based message routing
 * - DTRResetManager: Only handles reset synchronization and log boundaries
 * 
 * This is the ONLY place where components are wired together.
 * All P2-specific logic is contained within individual components.
 */

export interface ProcessorStats {
  receiver: any;
  buffer: any;
  extractor: any;
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

  // Core components
  private buffer: CircularBuffer;
  private receiver: SerialReceiver;
  private extractorQueue: DynamicQueue<ExtractedMessage>;
  private extractor: MessageExtractor;
  private router: MessageRouter;
  private dtrResetManager: DTRResetManager;
  
  // Performance monitoring
  private performanceMonitor: PerformanceMonitor;

  // State
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor(enablePerformanceLogging: boolean = false, performanceLogPath?: string) {
    super();

    // Create components in dependency order
    this.buffer = new CircularBuffer();
    this.receiver = new SerialReceiver(this.buffer);
    this.extractorQueue = new DynamicQueue<ExtractedMessage>(100, 5000, 'ExtractorQueue');
    this.extractor = new MessageExtractor(this.buffer, this.extractorQueue);
    this.router = new MessageRouter(this.extractorQueue);
    this.dtrResetManager = new DTRResetManager(this.router);
    
    // Create performance monitor
    const logPath = performanceLogPath || (enablePerformanceLogging ? 'performance.log' : undefined);
    this.performanceMonitor = new PerformanceMonitor(logPath);
    
    // Wire performance monitoring to all components
    this.buffer.setPerformanceMonitor(this.performanceMonitor);
    this.receiver.setPerformanceMonitor(this.performanceMonitor);
    this.extractorQueue.setPerformanceMonitor(this.performanceMonitor, 'ExtractorQueue');
    this.extractor.setPerformanceMonitor(this.performanceMonitor);
    this.router.setPerformanceMonitor(this.performanceMonitor);
    this.dtrResetManager.setPerformanceMonitor(this.performanceMonitor);

    // Wire up the pipeline
    this.setupPipeline();
  }

  /**
   * Set up component connections
   */
  private setupPipeline(): void {
    // SerialReceiver triggers MessageExtractor
    this.receiver.setExtractionCallback(() => {
      const hasMore = this.extractor.extractMessages();
      
      // If messages were extracted, trigger router
      if (this.extractorQueue.getSize() > 0) {
        this.router.processMessages();
      }

      // If more data might be extractable, schedule another extraction
      if (hasMore) {
        setImmediate(() => {
          this.extractor.extractMessages();
          if (this.extractorQueue.getSize() > 0) {
            this.router.processMessages();
          }
        });
      }
    });

    // Handle buffer overflow
    this.receiver.on('bufferOverflow', (event) => {
      console.error('[Processor] Buffer overflow, waiting for resync');
      this.emit('bufferOverflow', event);
      
      // Clear buffer and wait for clean message boundary
      this.buffer.clear();
      this.dtrResetManager.clearSynchronization();
    });

    // Handle extraction events
    this.extractor.on('messagesExtracted', (count) => {
      this.emit('messagesExtracted', count);
    });

    // Handle routing events
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
    this.logConsoleMessage(`[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): ${data.length} bytes, running: ${this.isRunning}`);
    
    if (!this.isRunning) {
      this.logConsoleMessage('[Processor] Received data while not running, ignoring');
      return;
    }

    this.receiver.receiveData(data);
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
      receiver: this.receiver.getStats(),
      buffer: this.buffer.getStats(),
      extractor: this.extractor.getStats(),
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
    this.receiver.resetStats();
    this.extractor.resetStats();
    this.router.resetStats();
    this.dtrResetManager.resetStats();
    this.performanceMonitor.reset();
  }

  /**
   * Clear all buffers and queues
   */
  public clearAll(): void {
    this.buffer.clear();
    this.extractorQueue.clear();
    this.router.getInputQueue().clear();
  }

  /**
   * Get synchronization status
   */
  public getSyncStatus(): { synchronized: boolean; source: string } {
    return this.dtrResetManager.getSyncStatus();
  }

  /**
   * Check if system is idle
   */
  public isIdle(): boolean {
    return this.router.isIdle() && 
           !this.receiver.isExtractionPending() &&
           !this.dtrResetManager.isResetPending();
  }

  /**
   * Get component references (for testing/debugging)
   */
  public getComponents() {
    return {
      buffer: this.buffer,
      receiver: this.receiver,
      extractor: this.extractor,
      router: this.router,
      dtrResetManager: this.dtrResetManager,
      performanceMonitor: this.performanceMonitor
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