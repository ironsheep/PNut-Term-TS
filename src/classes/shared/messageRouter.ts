/** @format */

// src/classes/shared/messageRouter.ts

import { EventEmitter } from 'events';
import { DynamicQueue } from './dynamicQueue';
import { ExtractedMessage, MessageType } from './messageExtractor';
import { PerformanceMonitor } from './performanceMonitor';

/**
 * Route destination interface
 */
export interface RouteDestination {
  name: string;
  handler: (message: ExtractedMessage) => void;
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
  [MessageType.DEBUGGER_80BYTE]: RouteDestination[];
  
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
 * - DEBUGGER_80BYTE → COG debugger windows (creates on demand)
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
  private inputQueue: DynamicQueue<ExtractedMessage>;
  private routingConfig: RoutingConfig;
  private processingPending: boolean = false;
  
  // Statistics
  private messagesRouted: Record<MessageType, number> = {
    [MessageType.DB_PACKET]: 0,
    [MessageType.COG_MESSAGE]: 0,
    [MessageType.BACKTICK_WINDOW]: 0,
    [MessageType.DEBUGGER_80BYTE]: 0,
    [MessageType.P2_SYSTEM_INIT]: 0,
    [MessageType.TERMINAL_OUTPUT]: 0,
    [MessageType.INCOMPLETE_DEBUG]: 0,
    [MessageType.INVALID_COG]: 0
  };
  private destinationCounts: Record<string, number> = {};
  private routingErrors: number = 0;
  
  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;

  constructor(inputQueue: DynamicQueue<ExtractedMessage>) {
    super();
    this.inputQueue = inputQueue;
    
    // Initialize empty routing config for Two-Tier Pattern Matching
    this.routingConfig = {
      [MessageType.DB_PACKET]: [],
      [MessageType.COG_MESSAGE]: [],
      [MessageType.BACKTICK_WINDOW]: [],
      [MessageType.DEBUGGER_80BYTE]: [],
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
      console.log(`[MessageRouter] Registered ${destination.name} for ${messageType} messages`);
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
      console.log(`[MessageRouter] Unregistered ${destinationName} from ${messageType} messages`);
    }
  }

  /**
   * Process messages from queue
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

    // Schedule async processing
    this.processingPending = true;
    setImmediate(() => {
      this.processMessageBatch();
    });

    return true;
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
   * Process a batch of messages
   */
  private processMessageBatch(): void {
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

    this.processingPending = false;

    if (messagesProcessed > 0) {
      this.emit('batchProcessed', messagesProcessed);
    }

    // If queue still has messages, schedule another batch
    if (!this.inputQueue.isEmpty()) {
      setImmediate(() => {
        this.processingPending = true;
        this.processMessageBatch();
      });
    }
  }

  /**
   * Route a single message to its destinations
   */
  private routeMessage(message: ExtractedMessage): void {
    const destinations = this.routingConfig[message.type];
    
    if (!destinations || destinations.length === 0) {
      console.warn(`[MessageRouter] No destinations for ${message.type} message`);
      this.emit('unroutableMessage', message);
      return;
    }

    // Update statistics
    this.messagesRouted[message.type]++;
    
    // Record performance metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordRouting();
      // Record latency from message timestamp to now
      this.performanceMonitor.recordMessageLatency(message.timestamp, Date.now());
    }

    // Route to each destination
    for (const destination of destinations) {
      try {
        // Copy message data if routing to multiple destinations
        const messageCopy = destinations.length > 1 
          ? this.copyMessage(message)
          : message;

        destination.handler(messageCopy);
        this.destinationCounts[destination.name]++;

        this.emit('messageRouted', {
          message: messageCopy,
          destination: destination.name
        });

      } catch (error) {
        console.error(`[MessageRouter] Error routing to ${destination.name}:`, error);
        this.routingErrors++;
        
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
   * Create a copy of message for multiple routing
   */
  private copyMessage(message: ExtractedMessage): ExtractedMessage {
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

    // 80-byte debugger packets to debugger windows if available
    if (debuggerWindow) {
      this.registerDestination(MessageType.DEBUGGER_80BYTE, debuggerWindow);
    }

    // Backtick window commands to window creator
    this.registerDestination(MessageType.BACKTICK_WINDOW, windowCreator);

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
   * Get router statistics
   */
  public getStats(): RouterStats {
    const queueStats = this.inputQueue.getStats();
    const totalRouted = Object.values(this.messagesRouted).reduce((a, b) => a + b, 0);

    return {
      messagesRouted: { ...this.messagesRouted },
      destinationCounts: { ...this.destinationCounts },
      routingErrors: this.routingErrors,
      queueHighWaterMark: queueStats.highWaterMark,
      processingPending: this.processingPending,
      totalMessagesRouted: totalRouted
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    for (const key in this.messagesRouted) {
      this.messagesRouted[key as MessageType] = 0;
    }
    for (const key in this.destinationCounts) {
      this.destinationCounts[key] = 0;
    }
    this.routingErrors = 0;
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
    console.log('[MessageRouter] All destinations cleared');
  }
}