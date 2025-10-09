/** @format */

// src/classes/shared/messageRouter.ts

const ENABLE_CONSOLE_LOG: boolean = false;

import { EventEmitter } from 'events';
import { ExtractedMessage, SharedMessageType } from './sharedMessagePool';
import { PerformanceMonitor } from './performanceMonitor';
import { SharedMessagePool } from './sharedMessagePool';

/**
 * Route destination interface
 * Handlers receive ExtractedMessage (router handles SharedMessagePool release)
 */
export interface RouteDestination {
  name: string;
  handler: (message: ExtractedMessage) => void;
}

/**
 * Routing configuration by SharedMessageType
 * Uses SharedMessageType enum values as keys (preserves COG ID specificity)
 */
export type RoutingConfig = {
  [key in SharedMessageType]?: RouteDestination[];
};

/**
 * Router statistics
 */
export interface RouterStats {
  messagesRouted: Record<string, number>;
  destinationCounts: Record<string, number>;
  routingErrors: number;
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

  private routingConfig: RoutingConfig;

  // Statistics - keyed by SharedMessageType enum values
  private messagesRouted: Record<number, number> = {};
  private destinationCounts: Record<string, number> = {};
  private routingErrors: number = 0;

  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;

  // Worker Thread SharedMessagePool integration
  private sharedMessagePool: SharedMessagePool | null = null;

  constructor() {
    super();

    // Initialize empty routing config for Two-Tier Pattern Matching
    // All SharedMessageType values have destinations initialized to empty arrays
    this.routingConfig = {};

    // Initialize statistics for all SharedMessageType values
    for (const typeKey in SharedMessageType) {
      const typeValue = SharedMessageType[typeKey as keyof typeof SharedMessageType];
      if (typeof typeValue === 'number') {
        this.messagesRouted[typeValue] = 0;
      }
    }
  }

  /**
   * Set performance monitor for instrumentation
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Set SharedMessagePool for Worker Thread zero-copy routing (NEW)
   */
  public setSharedMessagePool(pool: SharedMessagePool): void {
    this.sharedMessagePool = pool;
    this.logConsoleMessage('[MessageRouter] SharedMessagePool configured for zero-copy routing');
  }

  /**
   * Route message from SharedMessagePool using poolId (NEW - Direct SharedMessagePool Architecture)
   * Router is a consumer of SharedMessagePool:
   * 1. Query message type (don't read data yet)
   * 2. Determine destinations
   * 3. Increment refCount if there are other consumers (debug logger)
   * 4. Read message data, process/reformat for windows
   * 5. Send processed data to window destinations
   * 6. Release SharedMessagePool slot (our reference)
   */
  public routeFromPool(poolId: number): void {
    if (!this.sharedMessagePool) {
      console.error('[MessageRouter] Cannot route from pool - SharedMessagePool not configured');
      return;
    }

    try {
      // Query message type without reading full data
      const sharedType = this.sharedMessagePool.getMessageType(poolId);

      // Determine destinations using SharedMessageType directly
      const destinations = this.routingConfig[sharedType];

      if (!destinations || destinations.length === 0) {
        console.warn(`[MessageRouter] No destinations for SharedMessageType ${sharedType}, poolId ${poolId}`);
        this.sharedMessagePool.release(poolId);
        return;
      }

      this.logConsoleMessage(`[MessageRouter] Routing poolId ${poolId}, SharedMessageType ${sharedType} to ${destinations.length} destinations`);

      // Now read the full message data for processing
      const slot = this.sharedMessagePool.get(poolId);
      const data = slot.readData();

      // Create ExtractedMessage for window processing
      // Receiver can extract cogId from SharedMessageType on-demand if needed
      const message: ExtractedMessage = {
        type: sharedType,  // Use SharedMessageType directly - preserves COG ID specificity
        data: data,
        timestamp: Date.now(),
        confidence: 'VERY_DISTINCTIVE'
      };

      // Update statistics
      this.messagesRouted[sharedType]++;

      // CRITICAL: Emit P2 System Reboot event for golden sync marker
      // P2_SYSTEM_INIT is "Cog0 INIT $0000_0000 $0000_0000 load" - triggers complete system reset
      if (sharedType === SharedMessageType.P2_SYSTEM_INIT) {
        const messageText = new TextDecoder().decode(data);
        this.logConsoleMessage(`[MessageRouter] 🎯 P2_SYSTEM_INIT detected - emitting p2SystemReboot event`);
        this.emit('p2SystemReboot', { message: messageText, timestamp: Date.now() });
      }

      // Emit debugger packet event if needed
      if (sharedType >= SharedMessageType.DEBUGGER0_416BYTE && sharedType <= SharedMessageType.DEBUGGER7_416BYTE) {
        this.emit('debuggerPacketReceived', data);
      }

      // Record performance metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordRouting();
        this.performanceMonitor.recordMessageLatency(message.timestamp, Date.now());
      }

      // Route processed message to each destination
      // Windows receive the processed ExtractedMessage, not the poolId
      for (const destination of destinations) {
        try {
          destination.handler(message);
          this.destinationCounts[destination.name]++;
          this.emit('messageRouted', {
            message,
            destination: destination.name
          });
        } catch (error) {
          console.error(`[MessageRouter] Error routing to ${destination.name}:`, error);
          this.routingErrors++;
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

      // Release our SharedMessagePool reference
      this.sharedMessagePool.release(poolId);
      this.logConsoleMessage(`[MessageRouter] Released poolId ${poolId}`);

    } catch (error) {
      console.error(`[MessageRouter] Error routing from pool ${poolId}:`, error);
      this.routingErrors++;
      // Still try to release on error
      if (this.sharedMessagePool) {
        this.sharedMessagePool.release(poolId);
      }
    }
  }

  /**
   * Register a destination for a SharedMessageType
   */
  public registerDestination(messageType: SharedMessageType, destination: RouteDestination): void {
    // Initialize array if not exists
    if (!this.routingConfig[messageType]) {
      this.routingConfig[messageType] = [];
    }

    if (!this.routingConfig[messageType]!.find(d => d.name === destination.name)) {
      this.routingConfig[messageType]!.push(destination);
      this.destinationCounts[destination.name] = 0;

      // Reduce registration logging noise in production
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_ROUTING) {
        this.logConsoleMessage(`[MessageRouter] Registered ${destination.name} for SharedMessageType ${messageType} messages`);
      }
    }
  }

  /**
   * Unregister a destination
   */
  public unregisterDestination(messageType: SharedMessageType, destinationName: string): void {
    if (!this.routingConfig[messageType]) {
      return;
    }

    const index = this.routingConfig[messageType]!.findIndex(d => d.name === destinationName);
    if (index >= 0) {
      this.routingConfig[messageType]!.splice(index, 1);
      this.logConsoleMessage(`[MessageRouter] Unregistered ${destinationName} from SharedMessageType ${messageType} messages`);
    }
  }

  /**
   * Apply standard routing configuration using SharedMessageType
   * This sets up the typical P2 message routing per MESSAGE-ROUTING-TABLE.md
   */
  public applyStandardRouting(
    debugLogger: RouteDestination,
    windowCreator: RouteDestination,
    debuggerWindow?: RouteDestination
  ): void {
    // Terminal FIRST principle - default route
    this.registerDestination(SharedMessageType.TERMINAL_OUTPUT, debugLogger);

    // COG messages (COG0-COG7) to debug logger - Individual COG windows handled by WindowRouter
    for (let cogId = 0; cogId <= 7; cogId++) {
      const cogMessageType = SharedMessageType.COG0_MESSAGE + cogId;
      this.registerDestination(cogMessageType, debugLogger);
    }

    // P2_SYSTEM_INIT to debug logger (special COG0 message for golden sync)
    this.registerDestination(SharedMessageType.P2_SYSTEM_INIT, debugLogger);

    // 0xDB packets to debug logger and debugger window
    this.registerDestination(SharedMessageType.DB_PACKET, debugLogger);
    if (debuggerWindow) {
      this.registerDestination(SharedMessageType.DB_PACKET, debuggerWindow);
    }

    // 416-byte debugger packets (DEBUGGER0-DEBUGGER7) to debugger window and debug logger
    for (let cogId = 0; cogId <= 7; cogId++) {
      const debuggerType = SharedMessageType.DEBUGGER0_416BYTE + cogId;
      if (debuggerWindow) {
        this.registerDestination(debuggerType, debuggerWindow);
      }
      // Also send to debug logger so user can see the binary debug data
      this.registerDestination(debuggerType, debugLogger);
    }

    // Backtick window commands to window creator
    // WindowCreator will forward to WindowRouter, which handles logging
    const backtickTypes = [
      SharedMessageType.BACKTICK_LOGIC,
      SharedMessageType.BACKTICK_SCOPE,
      SharedMessageType.BACKTICK_SCOPE_XY,
      SharedMessageType.BACKTICK_FFT,
      SharedMessageType.BACKTICK_SPECTRO,
      SharedMessageType.BACKTICK_PLOT,
      SharedMessageType.BACKTICK_TERM,
      SharedMessageType.BACKTICK_BITMAP,
      SharedMessageType.BACKTICK_MIDI,
      SharedMessageType.BACKTICK_UPDATE
    ];
    for (const backtickType of backtickTypes) {
      this.registerDestination(backtickType, windowCreator);
    }

    // Special cases to debug logger with warnings
    this.registerDestination(SharedMessageType.INVALID_COG, debugLogger);
  }

  /**
   * Wait for queue to drain (LEGACY - no-op in Worker Thread architecture)
   * Worker Thread architecture processes messages immediately from SharedMessagePool
   */
  public async waitForQueueDrain(timeoutMs: number = 5000): Promise<boolean> {
    // No-op: Worker Thread architecture has no queue to drain
    return Promise.resolve(true);
  }

  /**
   * Get router statistics
   */
  public getStats(): RouterStats {
    const totalRouted = Object.values(this.messagesRouted).reduce((a, b) => a + b, 0);

    return {
      messagesRouted: { ...this.messagesRouted },
      destinationCounts: { ...this.destinationCounts },
      routingErrors: this.routingErrors,
      totalMessagesRouted: totalRouted
    };
  }
  
  /**
   * Reset statistics
   */
  public resetStats(): void {
    for (const key in this.messagesRouted) {
      this.messagesRouted[key] = 0;
    }
    for (const key in this.destinationCounts) {
      this.destinationCounts[key] = 0;
    }
    this.routingErrors = 0;
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
      const msgType = parseInt(messageType) as SharedMessageType;
      this.routingConfig[msgType] = [];
    }
    this.logConsoleMessage('[MessageRouter] All destinations cleared');
  }
}