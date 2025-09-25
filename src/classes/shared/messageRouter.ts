/** @format */

// src/classes/shared/messageRouter.ts

const ENABLE_CONSOLE_LOG: boolean = false;

import { EventEmitter } from 'events';
import { DynamicQueue } from './dynamicQueue';
import { ExtractedMessage, MessageType } from './messageExtractor';
import { PerformanceMonitor } from './performanceMonitor';
import { MessagePool, PooledMessage } from './messagePool';

/**
 * Route destination interface
 * Updated to handle both PooledMessage references and legacy ExtractedMessage copies
 */
export interface RouteDestination {
  name: string;
  handler: (message: ExtractedMessage | PooledMessage) => void;
}

/**
 * Routing configuration by message type - Two-Tier Pattern Matching
 */
export interface RoutingConfig {
  // TIER 1: VERY DISTINCTIVE
  [MessageType.DB_PACKET]: RouteDestination[];
  [MessageType.P2_SYSTEM_INIT]: RouteDestination[];
  
  // TIER 1: DISTINCTIVE  
  [MessageType.COG_MESSAGE]: RouteDestination[];
  [MessageType.BACKTICK_WINDOW]: RouteDestination[];
  
  // TIER 2: NEEDS CONTEXT
  [MessageType.DEBUGGER_416BYTE]: RouteDestination[];
  
  // DEFAULT ROUTE
  [MessageType.TERMINAL_OUTPUT]: RouteDestination[];
  
  // SPECIAL CASES
  [MessageType.INCOMPLETE_DEBUG]: RouteDestination[];
  [MessageType.INVALID_COG]: RouteDestination[];
}

/**
 * Router statistics
 */
export interface RouterStats {
  messagesRouted: Record<MessageType, number>;
  destinationCounts: Record<string, number>;
  routingErrors: number;
  queueHighWaterMark: number;
  processingPending: boolean;
  totalMessagesRouted: number;
  
  // Message pool integration statistics
  pooledMessagesRouted: number;
  copyOperationsAvoided: number;
  averageConsumerCount: number;
}

/**
 * MessageRouter - Two-Tier Pattern Matching Message Routing
 * 
 * Routes messages from input queue to appropriate destinations based on
 * Two-Tier Pattern Matching message types and confidence levels.
 * Implements "Terminal FIRST, Debugger SECOND" routing philosophy.
 * 
 * ROUTING PHILOSOPHY:
 * - TERMINAL_OUTPUT → Main terminal (blue window) by default
 * - COG_MESSAGE → Individual COG logger windows  
 * - DEBUGGER_416BYTE → COG debugger windows (creates on demand)
 * - DB_PACKET → Protocol handler for 0xDB packets
 * - P2_SYSTEM_INIT → Debug Logger + golden sync processing
 * - BACKTICK_WINDOW → Window command processor
 * - INVALID_COG → Debug Logger with warnings
 * - INCOMPLETE_DEBUG → Debug Logger with incomplete status
 * 
 * CLEAN SEPARATION: This component has ZERO knowledge of:
 * - Serial port or buffer implementation details
 * - Two-Tier pattern matching algorithms  
 * - Internal window creation or management
 * - Message extraction or validation logic
 * 
 * It only handles:
 * - Message type-based routing decisions
 * - Destination handler invocation
 * - Queue management and async processing
 * - Routing statistics and performance monitoring
 */

export class MessageRouter extends EventEmitter {
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
  private inputQueue: DynamicQueue<ExtractedMessage>;
  private routingConfig: RoutingConfig;
  private processingPending: boolean = false;
  
  // Statistics
  private messagesRouted: Record<MessageType, number> = {
    [MessageType.DB_PACKET]: 0,
    [MessageType.COG_MESSAGE]: 0,
    [MessageType.BACKTICK_WINDOW]: 0,
    [MessageType.DEBUGGER_416BYTE]: 0,
    [MessageType.P2_SYSTEM_INIT]: 0,
    [MessageType.TERMINAL_OUTPUT]: 0,
    [MessageType.INCOMPLETE_DEBUG]: 0,
    [MessageType.INVALID_COG]: 0
  };
  private destinationCounts: Record<string, number> = {};
  private routingErrors: number = 0;
  
  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;
  
  // Message pool integration
  private messagePool: MessagePool;
  private pooledMessagesRouted: number = 0;
  private copyOperationsAvoided: number = 0;
  private totalConsumerCount: number = 0;
  
  // Adaptive timer configuration
  private timerIntervals = {
    fast: 2,     // High load: 2ms
    normal: 5,   // Normal: 5ms 
    idle: 20     // Idle: 20ms
  };
  private currentTimerInterval: number = 5; // Start with normal
  private lastProcessingTime: number = 0;
  private messageVelocity: number = 0; // Messages per second
  private lastVelocityCheck: number = Date.now();
  private processingTimer: NodeJS.Timeout | null = null;
  private messagesInLastSecond: number = 0;

  constructor(inputQueue: DynamicQueue<ExtractedMessage>) {
    super();
    this.inputQueue = inputQueue;
    this.messagePool = MessagePool.getInstance();
    
    // Initialize empty routing config for Two-Tier Pattern Matching
    this.routingConfig = {
      [MessageType.DB_PACKET]: [],
      [MessageType.COG_MESSAGE]: [],
      [MessageType.BACKTICK_WINDOW]: [],
      [MessageType.DEBUGGER_416BYTE]: [],
      [MessageType.P2_SYSTEM_INIT]: [],
      [MessageType.TERMINAL_OUTPUT]: [],
      [MessageType.INCOMPLETE_DEBUG]: [],
      [MessageType.INVALID_COG]: []
    };
  }

  /**
   * Set performance monitor for instrumentation
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Register a destination for a message type
   */
  public registerDestination(messageType: MessageType, destination: RouteDestination): void {
    if (!this.routingConfig[messageType].find(d => d.name === destination.name)) {
      this.routingConfig[messageType].push(destination);
      this.destinationCounts[destination.name] = 0;
      
      // Reduce registration logging noise in production
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_ROUTING) {
      this.logConsoleMessage(`[MessageRouter] Registered ${destination.name} for ${messageType} messages`);
    }
    }
  }

  /**
   * Unregister a destination
   */
  public unregisterDestination(messageType: MessageType, destinationName: string): void {
    const index = this.routingConfig[messageType].findIndex(d => d.name === destinationName);
    if (index >= 0) {
      this.routingConfig[messageType].splice(index, 1);
      this.logConsoleMessage(`[MessageRouter] Unregistered ${destinationName} from ${messageType} messages`);
    }
  }

  /**
   * Process messages from queue using adaptive timer instead of setImmediate
   * Called when new messages are available
   * Returns true if more processing might be needed
   */
  public processMessages(): boolean {
    if (this.processingPending) {
      return false; // Already processing
    }

    if (this.inputQueue.isEmpty()) {
      return false; // Nothing to process
    }

    // Schedule async processing with adaptive timer
    this.processingPending = true;
    this.scheduleProcessingWithTimer();

    return true;
  }
  
  /**
   * Schedule message processing using adaptive timer intervals
   */
  private scheduleProcessingWithTimer(): void {
    // Clear any existing timer
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }
    
    // Update timer interval based on load
    this.updateAdaptiveTimer();
    
    this.processingTimer = setTimeout(() => {
      this.processMessageBatch();
    }, this.currentTimerInterval);
  }
  
  /**
   * Update timer interval based on message velocity and processing time
   */
  private updateAdaptiveTimer(): void {
    const now = Date.now();
    
    // Calculate message velocity (messages per second)
    if (now - this.lastVelocityCheck >= 1000) {
      this.messageVelocity = this.messagesInLastSecond;
      this.messagesInLastSecond = 0;
      this.lastVelocityCheck = now;
    }
    
    // Determine appropriate timer interval with hysteresis
    let targetInterval: number;
    
    if (this.messageVelocity > 100 || this.lastProcessingTime > 10) {
      // High load: >100 msgs/sec or processing taking >10ms
      targetInterval = this.timerIntervals.fast;
    } else if (this.messageVelocity > 20 || this.lastProcessingTime > 3) {
      // Normal load: >20 msgs/sec or processing taking >3ms
      targetInterval = this.timerIntervals.normal;
    } else {
      // Idle: low message rate and fast processing
      targetInterval = this.timerIntervals.idle;
    }
    
    // Implement hysteresis to prevent timer thrashing
    const currentCategory = this.getTimerCategory(this.currentTimerInterval);
    const targetCategory = this.getTimerCategory(targetInterval);
    
    // Only change if moving to different category or significant difference
    if (currentCategory !== targetCategory || 
        Math.abs(this.currentTimerInterval - targetInterval) > 2) {
      this.currentTimerInterval = targetInterval;
      this.logConsoleMessage(`[MessageRouter] Adaptive timer: ${targetInterval}ms (velocity: ${this.messageVelocity} msg/s, processing: ${this.lastProcessingTime}ms)`);
    }
  }
  
  /**
   * Get timer category for hysteresis logic
   */
  private getTimerCategory(interval: number): 'fast' | 'normal' | 'idle' {
    if (interval <= this.timerIntervals.fast) return 'fast';
    if (interval <= this.timerIntervals.normal) return 'normal';
    return 'idle';
  }

  /**
   * Process messages synchronously for testing
   * Returns the count of messages processed
   */
  public processMessagesSync(): number {
    let messagesProcessed = 0;
    const maxBatchSize = 1000; // Higher limit for testing
    
    while (!this.inputQueue.isEmpty() && messagesProcessed < maxBatchSize) {
      const message = this.inputQueue.dequeue();
      if (!message) break;

      try {
        this.routeMessage(message);
        messagesProcessed++;
      } catch (error) {
        console.error('[MessageRouter] Error routing message:', error);
        this.routingErrors++;
        this.emit('routingError', { message, error });
      }
    }

    if (messagesProcessed > 0) {
      this.emit('batchProcessed', messagesProcessed);
    }

    return messagesProcessed;
  }

  /**
   * Process a batch of messages (process ALL available messages, not just one)
   */
  private processMessageBatch(): void {
    const batchStartTime = Date.now();
    let messagesProcessed = 0;
    const maxBatchSize = 100; // Process up to 100 messages per batch

    while (!this.inputQueue.isEmpty() && messagesProcessed < maxBatchSize) {
      const message = this.inputQueue.dequeue();
      if (!message) break;

      try {
        this.routeMessage(message);
        messagesProcessed++;
      } catch (error) {
        console.error('[MessageRouter] Error routing message:', error);
        this.routingErrors++;
        this.emit('routingError', { message, error });
      }
    }

    // Record processing time for adaptive timer
    this.lastProcessingTime = Date.now() - batchStartTime;
    this.messagesInLastSecond += messagesProcessed;
    
    this.processingPending = false;

    if (messagesProcessed > 0) {
      this.emit('batchProcessed', messagesProcessed);
    }

    // If queue still has messages, schedule another batch with adaptive timer
    if (!this.inputQueue.isEmpty()) {
      this.processingPending = true;
      this.scheduleProcessingWithTimer();
    }
  }

  /**
   * Route a single message to its destinations using reference counting
   */
  private routeMessage(message: ExtractedMessage): void {
    this.logConsoleMessage(`[TWO-TIER] 🎯 Routing message: ${message.type}, ${message.data.length} bytes`);
    
    const destinations = this.routingConfig[message.type];
    
    this.logConsoleMessage(`[TWO-TIER] 🎯 Found ${destinations?.length || 0} destinations for ${message.type}`);
    
    if (!destinations || destinations.length === 0) {
      console.warn(`[MessageRouter] No destinations for ${message.type} message`);
      this.emit('unroutableMessage', message);
      return;
    }

    // Update statistics
    this.messagesRouted[message.type]++;
    
    // CRITICAL: Emit event for debugger packets that require response
    if (message.type === 'DEBUGGER_416BYTE' && message.data instanceof Uint8Array) {
      this.logConsoleMessage('[MessageRouter] Emitting debuggerPacketReceived event for P2 response');
      this.emit('debuggerPacketReceived', message.data);
    }
    
    // Record performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordRouting();
      // Record latency from message timestamp to now
      this.performanceMonitor.recordMessageLatency(message.timestamp, Date.now());
    }

    // CRITICAL CHANGE: Use MessagePool for reference counting instead of copying
    // Always add debug logger as additional consumer (everything goes to logger)
    const totalConsumers = destinations.length;
    this.totalConsumerCount += totalConsumers;
    
    this.logConsoleMessage(`[MessageRouter] Creating pooled message for ${totalConsumers} consumers`);
    
    // Acquire pooled message with correct consumer count
    const pooledMessage = this.messagePool.acquire(message.data, message.type, totalConsumers);
    
    if (!pooledMessage) {
      console.error(`[MessageRouter] Failed to acquire pooled message for ${message.type}`);
      this.routingErrors++;
      return;
    }
    
    // Copy metadata to pooled message
    pooledMessage.metadata = {
      originalTimestamp: message.timestamp,
      confidence: message.confidence,
      extractorMetadata: message.metadata
    };
    
    this.pooledMessagesRouted++;
    this.copyOperationsAvoided += (totalConsumers - 1); // We avoided N-1 copy operations
    
    this.logConsoleMessage(`[MessageRouter] Pooled message #${pooledMessage.poolId} created with ${pooledMessage.consumerCount} consumers`);

    // Route reference to each destination - NO COPYING
    for (const destination of destinations) {
      try {
        // Pass the SAME pooled message reference to each destination
        // Each destination is responsible for calling release() when done
        destination.handler(pooledMessage);
        this.destinationCounts[destination.name]++;

        this.emit('messageRouted', {
          message: pooledMessage,
          destination: destination.name
        });

      } catch (error) {
        console.error(`[MessageRouter] Error routing to ${destination.name}:`, error);
        this.routingErrors++;
        
        // If routing failed, we need to release this consumer's reference
        try {
          this.messagePool.release(pooledMessage);
          this.logConsoleMessage(`[MessageRouter] Released failed consumer reference for ${destination.name}`);
        } catch (releaseError) {
          console.error(`[MessageRouter] Error releasing failed consumer reference:`, releaseError);
        }
        
        // Record routing error
        if (this.performanceMonitor) {
          this.performanceMonitor.recordRoutingError();
        }
        
        this.emit('destinationError', {
          message,
          destination: destination.name,
          error
        });
      }
    }
  }

  /**
   * DEPRECATED: Message copying eliminated by reference counting
   * This method is kept for backward compatibility but should not be used
   */
  private copyMessage(message: ExtractedMessage): ExtractedMessage {
    console.warn('[MessageRouter] DEPRECATED: copyMessage() called - should use reference counting instead');
    this.copyOperationsAvoided--; // Decrement since we're still copying
    return {
      type: message.type,
      data: new Uint8Array(message.data), // Copy the data array
      timestamp: message.timestamp,
      confidence: message.confidence,
      metadata: message.metadata ? { ...message.metadata } : undefined
    };
  }

  /**
   * Apply standard routing configuration
   * This sets up the typical P2 message routing
   */
  public applyStandardRouting(
    debugLogger: RouteDestination,
    windowCreator: RouteDestination,
    debuggerWindow?: RouteDestination
  ): void {
    // Terminal FIRST principle - default route
    this.registerDestination(MessageType.TERMINAL_OUTPUT, debugLogger);

    // COG messages to debug logger
    this.registerDestination(MessageType.COG_MESSAGE, debugLogger);

    // P2 System Init to debug logger with golden sync
    this.registerDestination(MessageType.P2_SYSTEM_INIT, debugLogger);

    // 0xDB packets to debug logger
    this.registerDestination(MessageType.DB_PACKET, debugLogger);

    // 80-byte debugger packets to both debugger windows and debug logger
    if (debuggerWindow) {
      this.registerDestination(MessageType.DEBUGGER_416BYTE, debuggerWindow);
    }
    // Also send to debug logger so user can see the binary debug data
    this.registerDestination(MessageType.DEBUGGER_416BYTE, debugLogger);

    // Backtick window commands to window creator
    this.registerDestination(MessageType.BACKTICK_WINDOW, windowCreator);
    // Also send to debug logger so user can see all backtick window messages
    this.registerDestination(MessageType.BACKTICK_WINDOW, debugLogger);

    // Special cases to debug logger with warnings
    this.registerDestination(MessageType.INVALID_COG, debugLogger);
    this.registerDestination(MessageType.INCOMPLETE_DEBUG, debugLogger);
  }

  /**
   * Wait for queue to drain (for DTR reset scenarios)
   */
  public async waitForQueueDrain(timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkQueue = () => {
        if (this.inputQueue.isEmpty() && !this.processingPending) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          console.warn('[MessageRouter] Queue drain timeout');
          resolve(false);
          return;
        }

        setTimeout(checkQueue, 10);
      };

      checkQueue();
    });
  }

  /**
   * Get router statistics including message pool metrics
   */
  public getStats(): RouterStats {
    const queueStats = this.inputQueue.getStats();
    const totalRouted = Object.values(this.messagesRouted).reduce((a, b) => a + b, 0);
    const avgConsumerCount = this.pooledMessagesRouted > 0 
      ? (this.totalConsumerCount / this.pooledMessagesRouted) 
      : 0;

    return {
      messagesRouted: { ...this.messagesRouted },
      destinationCounts: { ...this.destinationCounts },
      routingErrors: this.routingErrors,
      queueHighWaterMark: queueStats.highWaterMark,
      processingPending: this.processingPending,
      totalMessagesRouted: totalRouted,
      
      // Message pool integration statistics
      pooledMessagesRouted: this.pooledMessagesRouted,
      copyOperationsAvoided: this.copyOperationsAvoided,
      averageConsumerCount: Math.round(avgConsumerCount * 10) / 10 // Round to 1 decimal
    };
  }

  /**
   * Configure adaptive timer intervals
   * @param fast Interval for high load (default: 2ms)
   * @param normal Interval for normal load (default: 5ms)
   * @param idle Interval for idle (default: 20ms)
   */
  public configureAdaptiveTimer(fast: number = 2, normal: number = 5, idle: number = 20): void {
    this.timerIntervals = { fast, normal, idle };
    this.logConsoleMessage(`[MessageRouter] Adaptive timer configured: fast=${fast}ms, normal=${normal}ms, idle=${idle}ms`);
  }
  
  /**
   * Get current timer configuration and status
   */
  public getTimerStatus(): {
    currentInterval: number;
    messageVelocity: number;
    lastProcessingTime: number;
    configuration: { fast: number; normal: number; idle: number };
  } {
    return {
      currentInterval: this.currentTimerInterval,
      messageVelocity: this.messageVelocity,
      lastProcessingTime: this.lastProcessingTime,
      configuration: { ...this.timerIntervals }
    };
  }
  
  /**
   * Stop adaptive timer processing (cleanup)
   */
  public stopAdaptiveTimer(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    this.processingPending = false;
    this.logConsoleMessage('[MessageRouter] Adaptive timer stopped');
  }

  /**
   * Reset statistics including message pool metrics
   */
  public resetStats(): void {
    for (const key in this.messagesRouted) {
      this.messagesRouted[key as MessageType] = 0;
    }
    for (const key in this.destinationCounts) {
      this.destinationCounts[key] = 0;
    }
    this.routingErrors = 0;
    
    // Reset message pool statistics
    this.pooledMessagesRouted = 0;
    this.copyOperationsAvoided = 0;
    this.totalConsumerCount = 0;
    
    // Reset adaptive timer statistics
    this.messageVelocity = 0;
    this.messagesInLastSecond = 0;
    this.lastProcessingTime = 0;
    this.currentTimerInterval = this.timerIntervals.normal;
  }

  /**
   * Get input queue reference
   */
  public getInputQueue(): DynamicQueue<ExtractedMessage> {
    return this.inputQueue;
  }

  /**
   * Check if router is idle
   */
  public isIdle(): boolean {
    return this.inputQueue.isEmpty() && !this.processingPending;
  }

  /**
   * Get routing configuration (for testing/debugging)
   */
  public getRoutingConfig(): RoutingConfig {
    return { ...this.routingConfig };
  }

  /**
   * Clear all destinations
   */
  public clearAllDestinations(): void {
    for (const messageType in this.routingConfig) {
      this.routingConfig[messageType as MessageType] = [];
    }
    this.logConsoleMessage('[MessageRouter] All destinations cleared');
  }
}