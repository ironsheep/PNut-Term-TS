/** @format */

// src/classes/shared/messageRouter.ts

const ENABLE_CONSOLE_LOG: boolean = false;

import { EventEmitter } from 'events';
import { ExtractedMessage, MessageType, SharedMessageType } from './sharedMessagePool';
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
 * Routing configuration by message type - Two-Tier Pattern Matching
 * Uses string keys for MessageType values
 */
export interface RoutingConfig {
  // TIER 1: VERY DISTINCTIVE
  'DB_PACKET': RouteDestination[];
  'P2_SYSTEM_INIT': RouteDestination[];

  // TIER 1: DISTINCTIVE
  'COG_MESSAGE': RouteDestination[];
  'BACKTICK_WINDOW': RouteDestination[];

  // TIER 2: NEEDS CONTEXT
  'DEBUGGER_416BYTE': RouteDestination[];

  // DEFAULT ROUTE
  'TERMINAL_OUTPUT': RouteDestination[];

  // SPECIAL CASES
  'INVALID_COG': RouteDestination[];
}

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

  // Statistics
  private messagesRouted: Record<string, number> = {
    'DB_PACKET': 0,
    'COG_MESSAGE': 0,
    'BACKTICK_WINDOW': 0,
    'DEBUGGER_416BYTE': 0,
    'P2_SYSTEM_INIT': 0,
    'TERMINAL_OUTPUT': 0,
    'INVALID_COG': 0
  };
  private destinationCounts: Record<string, number> = {};
  private routingErrors: number = 0;

  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;

  // Worker Thread SharedMessagePool integration
  private sharedMessagePool: SharedMessagePool | null = null;

  constructor() {
    super();
    
    // Initialize empty routing config for Two-Tier Pattern Matching
    this.routingConfig = {
      'DB_PACKET': [],
      'COG_MESSAGE': [],
      'BACKTICK_WINDOW': [],
      'DEBUGGER_416BYTE': [],
      'P2_SYSTEM_INIT': [],
      'TERMINAL_OUTPUT': [],
      'INVALID_COG': []
    };
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

      // Map to legacy type for routing decision
      const legacyType = this.mapSharedTypeToLegacy(sharedType);

      // Determine destinations
      const destinations = this.routingConfig[legacyType];

      if (!destinations || destinations.length === 0) {
        console.warn(`[MessageRouter] No destinations for type ${legacyType}, poolId ${poolId}`);
        this.sharedMessagePool.release(poolId);
        return;
      }

      this.logConsoleMessage(`[MessageRouter] Routing poolId ${poolId}, type ${legacyType} to ${destinations.length} destinations`);

      // Now read the full message data for processing
      const slot = this.sharedMessagePool.get(poolId);
      const data = slot.readData();

      // Create ExtractedMessage for window processing
      const message: ExtractedMessage = {
        type: legacyType,
        data: data,
        timestamp: Date.now(),
        confidence: 'VERY_DISTINCTIVE',
        metadata: {}
      };

      // Update statistics
      this.messagesRouted[legacyType]++;

      // CRITICAL: Emit P2 System Reboot event for golden sync marker
      // P2_SYSTEM_INIT is "Cog0 INIT $0000_0000 $0000_0000 load" - triggers complete system reset
      if (sharedType === SharedMessageType.P2_SYSTEM_INIT) {
        const messageText = new TextDecoder().decode(data);
        this.logConsoleMessage(`[MessageRouter] 🎯 P2_SYSTEM_INIT detected - emitting p2SystemReboot event`);
        this.emit('p2SystemReboot', { message: messageText, timestamp: Date.now() });
      }

      // Emit debugger packet event if needed
      if (legacyType === 'DEBUGGER_416BYTE' && data instanceof Uint8Array) {
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
   * Map SharedMessageType (from Worker) to legacy MessageType string (for routing)
   */
  private mapSharedTypeToLegacy(sharedType: SharedMessageType): MessageType {
    switch (sharedType) {
      case SharedMessageType.DB_PACKET:
        return MessageType.DB_PACKET;

      case SharedMessageType.COG0_MESSAGE:
      case SharedMessageType.COG1_MESSAGE:
      case SharedMessageType.COG2_MESSAGE:
      case SharedMessageType.COG3_MESSAGE:
      case SharedMessageType.COG4_MESSAGE:
      case SharedMessageType.COG5_MESSAGE:
      case SharedMessageType.COG6_MESSAGE:
      case SharedMessageType.COG7_MESSAGE:
        return MessageType.COG_MESSAGE;

      case SharedMessageType.DEBUGGER0_416BYTE:
      case SharedMessageType.DEBUGGER1_416BYTE:
      case SharedMessageType.DEBUGGER2_416BYTE:
      case SharedMessageType.DEBUGGER3_416BYTE:
      case SharedMessageType.DEBUGGER4_416BYTE:
      case SharedMessageType.DEBUGGER5_416BYTE:
      case SharedMessageType.DEBUGGER6_416BYTE:
      case SharedMessageType.DEBUGGER7_416BYTE:
        return MessageType.DEBUGGER_416BYTE;

      case SharedMessageType.P2_SYSTEM_INIT:
        // P2_SYSTEM_INIT is "Cog0 INIT $0000_0000 $0000_0000 load" - route like COG0
        return MessageType.COG_MESSAGE;

      case SharedMessageType.WINDOW_LOGIC:
      case SharedMessageType.WINDOW_SCOPE:
      case SharedMessageType.WINDOW_SCOPE_XY:
      case SharedMessageType.WINDOW_FFT:
      case SharedMessageType.WINDOW_SPECTRO:
      case SharedMessageType.WINDOW_PLOT:
      case SharedMessageType.WINDOW_TERM:
      case SharedMessageType.WINDOW_BITMAP:
      case SharedMessageType.WINDOW_MIDI:
        return MessageType.BACKTICK_WINDOW;

      case SharedMessageType.TERMINAL_OUTPUT:
        return MessageType.TERMINAL_OUTPUT;

      case SharedMessageType.INVALID_COG:
        return MessageType.INVALID_COG;

      default:
        console.warn(`[MessageRouter] Unknown SharedMessageType: ${sharedType}, defaulting to TERMINAL_OUTPUT`);
        return MessageType.TERMINAL_OUTPUT;
    }
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
   * Apply standard routing configuration
   * This sets up the typical P2 message routing
   */
  public applyStandardRouting(
    debugLogger: RouteDestination,
    windowCreator: RouteDestination,
    debuggerWindow?: RouteDestination,
    cogWindowRouter?: RouteDestination
  ): void {
    // Terminal FIRST principle - default route
    this.registerDestination(MessageType.TERMINAL_OUTPUT, debugLogger);

    // COG messages to debug logger (always logged)
    this.registerDestination(MessageType.COG_MESSAGE, debugLogger);

    // COG messages to individual COG windows (conditional - only if COG windows exist, silent drop)
    if (cogWindowRouter) {
      this.registerDestination(MessageType.COG_MESSAGE, cogWindowRouter);
    }

    // P2 System Init now routes as COG_MESSAGE (removed separate routing)

    // 0xDB packets to debug logger and debugger window
    this.registerDestination(MessageType.DB_PACKET, debugLogger);
    if (debuggerWindow) {
      this.registerDestination(MessageType.DB_PACKET, debuggerWindow);
    }

    // 416-byte debugger packets to both debugger windows and debug logger
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
      this.routingConfig[messageType as MessageType] = [];
    }
    this.logConsoleMessage('[MessageRouter] All destinations cleared');
  }
}