/** @format */

// src/classes/shared/windowRouter.ts

const ENABLE_CONSOLE_LOG: boolean = true;

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { RecordingCatalog, CatalogEntry } from './recordingCatalog';
import { RouterLogger, LogLevel, PerformanceMetrics } from './routerLogger';
import { safeDisplayString } from '../../utils/displayUtils';
import { BinaryRecorder } from './binaryRecorder';
import { Context } from '../../utils/context';
import { SharedMessageType, ExtractedMessage } from './sharedMessagePool';

/**
 * Window handler callback for routing messages to debug windows
 */
export type WindowHandler = (message: ExtractedMessage | Uint8Array | string) => void;

/**
 * Information about a registered window
 */
export interface WindowInfo {
  windowId: string;
  windowType: string;
  registeredAt: number;
  messagesReceived: number;
}

/**
 * Recording metadata for debug sessions
 */
export interface RecordingMetadata {
  sessionName: string;
  description?: string;
  startTime: number;
  p2Model?: string;
  serialPort?: string;
  baudRate?: number;
  windowTypes?: string[];
  testScenario?: string;
  expectedResults?: string;
  tags?: string[];
  samplingMode?: {
    enabled: boolean;
    rate: number; // Sample 1 out of N messages
  };
}

/**
 * Recorded message format for JSON Lines storage
 */
export interface RecordedMessage {
  timestamp: number;
  windowId: string;
  windowType: string;
  messageType: 'binary' | 'text';
  data: string; // Base64 for binary, raw for text
  size: number;
}

/**
 * Routing statistics for monitoring
 */
export interface RoutingStats {
  messagesRouted: number;
  bytesProcessed: number;
  averageRoutingTime: number;
  peakRoutingTime: number;
  errors: number;
  windowsActive: number;
  recordingActive: boolean;
}

/**
 * Centralized message router for all debug windows and debugger
 * Singleton pattern ensures single routing point
 */
export class WindowRouter extends EventEmitter {
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
  private static instance: WindowRouter | null = null;
  private context: Context | null = null;

  // Window management
  private windows: Map<string, { type: string; handler: WindowHandler; stats: WindowInfo }> = new Map();
  private displaysMap: { [key: string]: any } | null = null; // Reference to mainWindow.displays
  
  // Two-tiered registration: Track window instances even before they're ready
  private windowInstances: Map<string, { type: string; instance: any; isReady: boolean }> = new Map();
  
  // Recording state
  private isRecording: boolean = false;
  private recordingMetadata: RecordingMetadata | null = null;
  private recordingStream: fs.WriteStream | null = null;
  private recordingBuffer: RecordedMessage[] = [];
  private recordingTimer: NodeJS.Timeout | null = null;
  private recordingCatalog: RecordingCatalog = new RecordingCatalog();
  private recordingSessionId: string | null = null;
  private recordingMessageCount: number = 0;
  private recordingStartTime: number = 0;
  private samplingSeed: number = 0;
  private binaryRecorder: BinaryRecorder | null = null;
  private useBinaryFormat: boolean = true; // Default to binary format
  
  // Statistics
  private stats: RoutingStats = {
    messagesRouted: 0,
    bytesProcessed: 0,
    averageRoutingTime: 0,
    peakRoutingTime: 0,
    errors: 0,
    windowsActive: 0,
    recordingActive: false
  };
  
  // Performance tracking
  private routingTimes: number[] = [];
  private readonly MAX_ROUTING_SAMPLES = 1000;
  
  // Logging
  private logger: RouterLogger;

  // Shutdown flag
  private isShuttingDown: boolean = false;

  // Buffer settings
  private readonly BUFFER_SIZE = 1000;
  private readonly BUFFER_TIMEOUT = 100; // ms

  private constructor() {
    super();
    
    // Initialize logger
    this.logger = new RouterLogger({
      level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
      console: true,
      file: process.env.ROUTER_LOG_FILE === 'true'
    });
    
    this.logger.info('STARTUP', 'WindowRouter initialized');
  }
  
  /**
   * Get singleton instance of WindowRouter
   */
  public static getInstance(context?: Context): WindowRouter {
    if (!WindowRouter.instance) {
      WindowRouter.instance = new WindowRouter();
    }
    // Set context if provided and not already set
    if (context && !WindowRouter.instance.context) {
      WindowRouter.instance.setContext(context);
    }
    return WindowRouter.instance;
  }

  /**
   * Set the context for the router (should be called early in application startup)
   */
  public setContext(context: Context): void {
    this.context = context;
    this.logConsoleMessage('[ROUTER] Context set for directory-based recording paths');
  }

  /**
   * Set the displays map reference from mainWindow (for routing lookups)
   */
  public setDisplaysMap(displaysMap: { [key: string]: any }): void {
    this.displaysMap = displaysMap;
    this.logger.info('SETUP', 'Displays map reference set - routing by displayName enabled');
  }

  /**
   * Set shutdown flag to prevent window creation during shutdown
   */
  public setShuttingDown(shuttingDown: boolean): void {
    this.isShuttingDown = shuttingDown;
    if (shuttingDown) {
      this.logger.info('SHUTDOWN', 'Router set to shutdown mode - blocking window creation');
    }
  }
  
  /**
   * Phase 1: Register window instance (called during window construction)
   * This allows early message routing to window's internal queue
   */
  public registerWindowInstance(windowId: string, windowType: string, instance: any): void {
    this.logger.debug('REGISTER_INSTANCE', `Registering window instance: ${windowId} (${windowType})`);
    
    this.windowInstances.set(windowId, {
      type: windowType,
      instance: instance,
      isReady: false
    });
    
    this.logger.info('REGISTER_INSTANCE', `Window instance registered: ${windowId} (${windowType}). Can receive messages to queue.`);
  }
  
  /**
   * Phase 2: Register window handler (called when window is ready)
   * This enables direct message processing
   */
  public registerWindow(windowId: string, windowType: string, handler: WindowHandler): void {
    this.logger.debug('REGISTER', `Registering window handler: ${windowId} (${windowType})`);
    
    if (this.windows.has(windowId)) {
      const error = new Error(`Window ${windowId} is already registered`);
      this.logger.logError('REGISTER', error);
      throw error;
    }
    
    // Mark instance as ready if it exists
    const instance = this.windowInstances.get(windowId);
    if (instance) {
      instance.isReady = true;
      this.logger.debug('REGISTER', `Marked window instance ${windowId} as ready`);
    }
    
    const windowInfo: WindowInfo = {
      windowId,
      windowType,
      registeredAt: Date.now(),
      messagesReceived: 0
    };
    
    this.windows.set(windowId, {
      type: windowType,
      handler,
      stats: windowInfo
    });
    
    this.stats.windowsActive = this.windows.size;
    this.logger.info('REGISTER', `Window registered: ${windowId} (${windowType}). Active windows: ${this.stats.windowsActive}`);
    this.emit('windowRegistered', { windowId, windowType });
  }
  
  /**
   * Unregister a debug window
   */
  public unregisterWindow(windowId: string): void {
    this.logger.debug('UNREGISTER', `Unregistering window: ${windowId}`);

    if (this.windows.delete(windowId)) {
      this.stats.windowsActive = this.windows.size;
      this.logger.info('UNREGISTER', `Window unregistered: ${windowId}. Active windows: ${this.stats.windowsActive}`);
      this.emit('windowUnregistered', { windowId });
    } else {
      this.logger.warn('UNREGISTER', `Attempted to unregister non-existent window: ${windowId}`);
    }
  }

  /**
   * Get a registered window by ID
   */
  public getWindow(windowId: string): { type: string; handler: WindowHandler; stats: WindowInfo } | undefined {
    return this.windows.get(windowId);
  }

  /**
   * Route a message to appropriate window(s)
   * Accepts ExtractedMessage directly from worker thread (zero-copy)
   */
  public routeMessage(message: ExtractedMessage): void {
    const startTime = performance.now();

    try {
      const dataSize = message.data.length;
      this.logger.trace('ROUTE', `Routing message type ${message.type} (${dataSize} bytes)`);

      // Determine binary vs text from SharedMessageType enum ranges
      const isBinaryMessage =
        message.type >= SharedMessageType.DEBUGGER0_416BYTE &&
        message.type <= SharedMessageType.DEBUGGER7_416BYTE;

      if (isBinaryMessage) {
        // Binary debugger message - extract COG ID from SharedMessageType
        const cogId = message.type - SharedMessageType.DEBUGGER0_416BYTE;
        this.routeBinaryMessage(message.data, cogId);
      } else {
        // Text message (COG, backtick, terminal) - decode in routeTextMessage
        this.routeTextMessage(message);
      }

      // Update statistics
      const routingTime = performance.now() - startTime;
      this.updateRoutingStats(routingTime, message.data);

      // Log performance if slow
      if (routingTime > 1.0) {
        this.logger.warn('PERFORMANCE', `Slow routing detected: ${routingTime.toFixed(2)}ms (type=${message.type}, ${dataSize}B)`);
      }

    } catch (error) {
      this.stats.errors++;
      this.logger.logError('ROUTE', error as Error, { messageType: message.type });
      this.emit('routingError', { error, message });
    }
  }
  
  /**
   * Route binary message (debugger protocol)
   * @param data Binary data to route
   * @param taggedCogId Optional pre-extracted COG ID from message tag
   */
  public routeBinaryMessage(data: Uint8Array, taggedCogId?: number): void {
    const startTime = performance.now();
    
    // Use tagged COG ID if provided, otherwise extract from 32-bit little-endian word
    // P2 debugger protocol: COG ID is first 32-bit little-endian word (not just first byte!)
    let extractedCogId = 0;
    if (data.length >= 4) {
      // Extract 32-bit little-endian COG ID
      extractedCogId = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
    } else if (data.length > 0) {
      // Fallback for shorter messages
      extractedCogId = data[0];
    }
    const cogId = taggedCogId !== undefined ? taggedCogId : extractedCogId;
    
    // Validate COG ID  
    if (cogId > 0x07 && taggedCogId === undefined) {
      this.logger.warn('ROUTE_BINARY', `Invalid COG ID extracted: 0x${extractedCogId.toString(16).toUpperCase()} (expected 0x00-0x07)`);
    }
    const windowId = `debugger-${cogId}`;
    
    this.logger.debug('ROUTE_BINARY', `Routing binary message to COG ${cogId} (${data.length}B)`);
    
    // ALWAYS route binary messages to DebugLogger window for logging/analysis
    let loggerWindowFound = false;
    for (const [winId, window] of this.windows) {
      if (window.type === 'logger') {  // DebugLoggerWindow registers as 'logger' type
        window.handler(data);  // Send raw Uint8Array for hex formatting
        window.stats.messagesReceived++;
        loggerWindowFound = true;
        
        if (this.isRecording) {
          this.recordMessage(winId, window.type, 'binary', data);
        }
      }
    }
    
    // Defensive error logging: warn if no logger window found for binary data
    if (!loggerWindowFound) {
      this.logger.warn('ROUTE_ERROR', `No DebugLoggerWindow registered to receive binary message from COG ${cogId} (${data.length}B)`);
      console.warn(`[ROUTING] ⚠️ Binary debugger message from COG ${cogId} received but no DebugLoggerWindow registered! Message will be lost.`);
      console.warn('[ROUTING] 💡 This usually means DebugLoggerWindow failed to call registerWithRouter()');
    }
    
    // Also route to specific debugger window if it exists
    const window = this.windows.get(windowId);
    if (window) {
      window.handler(data);
      window.stats.messagesReceived++;
      
      const routingTime = performance.now() - startTime;
      this.logger.logRouting(windowId, 'binary', data.length, routingTime);
      
      // Record if enabled
      if (this.isRecording) {
        this.recordMessage(windowId, window.type, 'binary', data);
      }
    } else {
      // No debugger window for this COG - could be normal
      this.logger.debug('ROUTE_BINARY', `No window registered for COG ${cogId}, message unhandled`);
      this.emit('unhandledMessage', { type: 'binary', cogId, size: data.length });
    }
    
    // Update statistics
    const routingTime = performance.now() - startTime;
    this.updateRoutingStats(routingTime, data);
  }
  
  /**
   * Route text message (Cog messages, backtick commands, terminal output)
   *
   * CLEAN ARCHITECTURE: Messages are already classified by worker thread.
   * Routes based on SharedMessageType, not content parsing.
   *
   * @param message ExtractedMessage with Uint8Array data, timestamp, and SharedMessageType
   */
  public routeTextMessage(message: ExtractedMessage): void {
    const startTime = performance.now();

    let handled = false;

    // Decode Uint8Array to string on-demand
    const text = new TextDecoder().decode(message.data);
    const messageType = message.type;

    // Extract cogId from SharedMessageType for COG messages
    let cogId: number | undefined;
    if (messageType !== undefined) {
      if (messageType >= SharedMessageType.COG0_MESSAGE && messageType <= SharedMessageType.COG7_MESSAGE) {
        cogId = messageType - SharedMessageType.COG0_MESSAGE;
      } else if (
        messageType >= SharedMessageType.DEBUGGER0_416BYTE &&
        messageType <= SharedMessageType.DEBUGGER7_416BYTE
      ) {
        cogId = messageType - SharedMessageType.DEBUGGER0_416BYTE;
      }
    }

    // Check if message is backtick command (BACKTICK_* range)
    // Creation commands are forwarded here by MainWindow after window creation for logging
    // Update commands are routed here for logging AND window update
    const isBacktickCommand =
      messageType !== undefined &&
      messageType >= SharedMessageType.BACKTICK_LOGIC &&
      messageType <= SharedMessageType.BACKTICK_UPDATE;

    const isCreationCommand =
      messageType !== undefined &&
      messageType >= SharedMessageType.BACKTICK_LOGIC &&
      messageType <= SharedMessageType.BACKTICK_MIDI;

    const isUpdateCommand = messageType === SharedMessageType.BACKTICK_UPDATE;

    // 1. BACKTICK COMMANDS - Window creation and update commands
    if (isBacktickCommand) {
      // ALWAYS route to Debug Logger for logging (creation AND update)
      const loggerWindow = this.windows.get('logger');
      if (loggerWindow) {
        const commandType = isCreationCommand ? 'creation' : 'update';
        this.logConsoleMessage(`[ROUTER->LOGGER] Sending ${text.length} bytes (backtick ${commandType}) to DebugLogger window`);
        loggerWindow.handler(message);  // Pass full SerialMessage with timestamp and messageType
        loggerWindow.stats.messagesReceived++;

        if (this.isRecording) {
          this.recordMessage('logger', loggerWindow.type, 'text', text);
        }
      }

      // For UPDATE commands ONLY: Also route to target window(s)
      // Creation commands are logged above but NOT routed to windows (they don't exist yet)
      if (isUpdateCommand) {
        this.routeBacktickCommand(text);
      }

      handled = true;
    }
    // 2. COG MESSAGES - Route to DebugLogger AND individual COG window
    // Use SharedMessageType to identify COG messages (COG0-COG7 and P2_SYSTEM_INIT)
    else if (
      messageType !== undefined &&
      ((messageType >= SharedMessageType.COG0_MESSAGE && messageType <= SharedMessageType.COG7_MESSAGE) ||
        messageType === SharedMessageType.P2_SYSTEM_INIT)
    ) {
      this.logger.debug('ROUTE', `Routing Cog/INIT message: ${text.substring(0, 50)}...`);

      // Always route to DebugLogger window for logging (ONE place - no duplicates)
      const loggerWindow = this.windows.get('logger');
      if (loggerWindow) {
        this.logConsoleMessage(`[ROUTER->LOGGER] Sending ${text.length} bytes to DebugLogger window`);
        loggerWindow.handler(message);  // Pass full SerialMessage with timestamp and messageType
        loggerWindow.stats.messagesReceived++;
        handled = true;

        if (this.isRecording) {
          this.recordMessage('logger', loggerWindow.type, 'text', text);
        }
      }

      // Also route to individual COG window if registered (optional - silent drop if not registered)
      // Extract COG ID from SharedMessageType (lazy evaluation - only when needed for routing)
      if (cogId !== undefined && cogId >= 0 && cogId <= 7) {
        const cogWindowId = `COG${cogId}`;
        const cogWindow = this.windows.get(cogWindowId);

        if (cogWindow) {
          this.logConsoleMessage(`[ROUTER->COG${cogId}] Sending ${text.length} bytes to COG${cogId} window`);
          cogWindow.handler(message);  // Pass full SerialMessage
          cogWindow.stats.messagesReceived++;
          handled = true;

          if (this.isRecording) {
            this.recordMessage(cogWindowId, cogWindow.type, 'text', text);
          }
        }
        // Silent drop if COG window not registered (optional window)
      }
    }
    // 3. TERMINAL OUTPUT and INVALID_COG - Route to DebugLogger AND blue terminal
    else if (
      messageType === SharedMessageType.TERMINAL_OUTPUT ||
      messageType === SharedMessageType.INVALID_COG
    ) {
      this.logger.debug('ROUTE', `Routing terminal/invalid output: ${text.substring(0, 50)}...`);

      // Route to DebugLogger for record
      const loggerWindow = this.windows.get('logger');
      if (loggerWindow) {
        this.logConsoleMessage(`[ROUTER->LOGGER] Sending ${text.length} bytes to DebugLogger window`);
        loggerWindow.handler(message);  // Pass full SerialMessage
        loggerWindow.stats.messagesReceived++;
        handled = true;

        if (this.isRecording) {
          this.recordMessage('logger', loggerWindow.type, 'text', text);
        }
      }

      // Route to main window blue terminal for user visibility
      const terminalWindow = this.windows.get('terminal');
      if (terminalWindow) {
        this.logConsoleMessage(`[ROUTER->TERMINAL] Sending ${text.length} bytes to blue terminal`);
        terminalWindow.handler(text);  // Terminal still gets text for now (MainWindow.appendLog)
        terminalWindow.stats.messagesReceived++;
        handled = true;

        if (this.isRecording) {
          this.recordMessage('terminal', 'terminal', 'text', text);
        }
      }
    }
    // 4. Fallback for unhandled text
    else {
      const terminalWindow = this.windows.get('terminal');
      if (terminalWindow) {
        terminalWindow.handler(text);
        terminalWindow.stats.messagesReceived++;
        handled = true;

        if (this.isRecording) {
          this.recordMessage('terminal', 'terminal', 'text', text);
        }
      }
    }
    
    // Update statistics
    const routingTime = performance.now() - startTime;
    this.updateRoutingStats(routingTime, text);
  }
  
  /**
   * Parse and route backtick commands to appropriate debug windows
   *
   * Supports two formats:
   * 1. Single window: `windowName data...
   * 2. Multi-window: `win1 win2 win3 data... (splits into individual commands)
   */
  private routeBacktickCommand(command: string): void {
    this.logConsoleMessage(`[ROUTER DEBUG] routeBacktickCommand called with: "${command.trimEnd()}"`);

    if (!command.startsWith('`')) {
      this.logConsoleMessage(`[ROUTER DEBUG] ❌ Invalid backtick command (no backtick): "${command.trimEnd()}"`);
      this.logger.warn('ROUTE', `Invalid backtick command: ${command}`);
      return;
    }

    // CRITICAL: Never create COG-0 windows from backtick commands
    if (command.includes('COG-0') || command.includes('COG0')) {
      this.logConsoleMessage(`[ROUTER DEBUG] ⚠️ Ignoring COG-0 backtick command (system COG): "${command}"`);
      this.logger.info('ROUTE', 'Ignoring COG-0 backtick command (system COG)');
      return;
    }

    // Remove the backtick and parse (preserves exact original working logic)
    const cleanCommand = command.substring(1).trim();
    const parts = cleanCommand.split(' ').map(part => part.trim()).filter(part => part !== '');

    this.logConsoleMessage(`[ROUTER DEBUG] Parsed command: "${safeDisplayString(cleanCommand)}", parts: [${parts.map(p => safeDisplayString(p)).join(', ')}]`);

    if (parts.length < 1) {
      this.logConsoleMessage(`[ROUTER DEBUG] ❌ Empty backtick command`);
      this.logger.warn('ROUTE', `Empty backtick command`);
      return;
    }

    // EXACT MIGRATION OF WORKING MULTI-WINDOW LOGIC from mainWindow.ts
    // Get first token (case-insensitive comparison)
    const firstToken = parts[0].toUpperCase();

    // Get all registered window names from displays map (case-insensitive)
    if (!this.displaysMap) {
      this.logger.error('ROUTE', 'Displays map not set - cannot route backtick commands');
      return;
    }
    const registeredWindowNames = Object.keys(this.displaysMap).map(name => name.toUpperCase());

    // STEP 1: First token MUST be a valid registered window
    if (!registeredWindowNames.includes(firstToken)) {
      // Not a registered window - this is an error for UPDATE commands
      if (!this.isShuttingDown) {
        const errorMsg = `ERROR: Window update failed - window '${parts[0]}' not found (no preceding creation command)`;
        this.logConsoleMessage(`[ROUTER DEBUG] ${errorMsg}`);
        this.logger.error('ROUTE', errorMsg);

        const terminalWindow = this.windows.get('terminal');
        if (terminalWindow) {
          terminalWindow.handler(`\n${errorMsg}\n`);
        }
      }
      return;
    }

    // STEP 2: Collect all consecutive window names
    const targetWindows: string[] = [];
    let dataStartIndex = 1;

    // First window found
    targetWindows.push(firstToken);

    // STEP 3: Check remaining tokens for additional window names (multi-window routing)
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].toUpperCase();
      if (registeredWindowNames.includes(part)) {
        targetWindows.push(part);
        dataStartIndex = i + 1;
      } else {
        // Not a window name, must be data - stop checking
        break;
      }
    }

    // STEP 4: Extract data portion ONCE (window names were only for routing, windows don't need them)
    const dataParts = parts.slice(dataStartIndex);
    const dataString = dataParts.join(' ');

    this.logConsoleMessage(
      `[ROUTER DEBUG] Multi-window dispatch to ${targetWindows.length} window(s): [${targetWindows.join(', ')}], data: "${dataString}"`
    );

    // STEP 5: Route SAME data to all target windows
    targetWindows.forEach(windowNameUpper => {
      // Find window in displays map (case-insensitive match)
      const displayEntry = Object.entries(this.displaysMap!).find(
        ([name]) => name.toUpperCase() === windowNameUpper
      );

      if (displayEntry) {
        const [displayName, window] = displayEntry;
        const debugWindow = window as any; // DebugWindowBase type

        this.logConsoleMessage(`[ROUTER DEBUG]   ✅ Routing to window "${displayName}": "${dataString}"`);

        // Call updateContent with dataParts array
        // NOTE: Re-splitting here seems to fix first 9 windows but breaks HSV16 - investigating why
        const windowDataParts = dataString.split(' ');
        this.logConsoleMessage(`[ROUTER DEBUG]   📤 Sending dataParts array: [${windowDataParts.join(', ')}] (${windowDataParts.length} parts)`);
        debugWindow.updateContent(windowDataParts);

        if (this.isRecording) {
          this.recordMessage(displayName, debugWindow.windowType || 'unknown', 'text', dataString);
        }
      } else {
        this.logConsoleMessage(`[ROUTER DEBUG]   ❌ Window "${windowNameUpper}" not found in displays map`);
      }
    });
  }
  
  /**
   * Check if recording is active
   */
  public isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get count of messages recorded
   */
  public getRecordingMessageCount(): number {
    return this.recordingMessageCount;
  }

  /**
   * Start recording debug session
   */
  public startRecording(metadata: RecordingMetadata): void {
    if (this.isRecording) {
      const error = new Error('Recording already in progress');
      this.logger.logError('RECORDING', error);
      throw error;
    }
    
    this.logger.info('RECORDING', `Starting recording session: ${metadata.sessionName}`);
    
    // Use context-based recordings directory for both formats
    const recordingsDir = this.context
      ? path.join(this.context.getRecordingsDirectory(), 'sessions')
      : path.join(process.cwd(), 'recordings', 'sessions'); // Fallback if context not set
    
    if (this.useBinaryFormat) {
      // Use binary recorder for .p2rec format
      this.binaryRecorder = new BinaryRecorder();
      const filepath = this.binaryRecorder.startRecording(metadata);
      
      // Extract session ID from filepath
      const filename = path.basename(filepath);
      this.recordingSessionId = filename.replace('.p2rec', '');
      
      this.recordingMetadata = metadata;
      this.isRecording = true;
      this.stats.recordingActive = true;
      this.recordingMessageCount = 0;
      this.recordingStartTime = Date.now();
    } else {
      // Create recordings directory if needed
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
      
      // Generate session ID and filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.recordingSessionId = `${timestamp}-${metadata.sessionName}`;
      const filename = `${this.recordingSessionId}.jsonl`;
      const filepath = path.join(recordingsDir, filename);
      
      // Start recording
      this.recordingMetadata = metadata;
      this.recordingStream = fs.createWriteStream(filepath, { flags: 'w' });
      this.isRecording = true;
      this.stats.recordingActive = true;
      this.recordingMessageCount = 0;
      this.recordingStartTime = Date.now();
      this.samplingSeed = 0;
    }
    
    if (!this.useBinaryFormat) {
      const filename = `${this.recordingSessionId}.jsonl`;
      const filepath = path.join(recordingsDir, filename);
      
      // Add to catalog
      const catalogEntry: CatalogEntry = {
        sessionId: this.recordingSessionId,
        filename,
        metadata: {
          sessionName: metadata.sessionName,
          description: metadata.description,
          timestamp: metadata.startTime,
          p2Model: metadata.p2Model,
          serialPort: metadata.serialPort,
          baudRate: metadata.baudRate,
          windowTypes: metadata.windowTypes,
          testScenario: metadata.testScenario,
          expectedResults: metadata.expectedResults,
          tags: metadata.tags
        }
      };
      this.recordingCatalog.addRecording(catalogEntry);
      
      // Write metadata as first line
      if (this.recordingStream) {
        this.recordingStream.write(JSON.stringify({ metadata }) + '\n');
      }
      
      // Setup buffered write timer
      this.recordingTimer = setInterval(() => this.flushRecordingBuffer(), this.BUFFER_TIMEOUT);
      
      this.emit('recordingStarted', { metadata, filepath, sessionId: this.recordingSessionId });
    }
  }
  
  /**
   * Set recording format (binary or JSON)
   */
  public setRecordingFormat(useBinary: boolean): void {
    if (this.isRecording) {
      throw new Error('Cannot change format while recording is in progress');
    }
    this.useBinaryFormat = useBinary;
    this.logger.info('CONFIG', `Recording format set to ${useBinary ? 'binary (.p2rec)' : 'JSON (.jsonl)'}`);
  }
  
  /**
   * Stop recording debug session
   */
  public stopRecording(): void {
    if (!this.isRecording) {
      return;
    }
    
    if (this.useBinaryFormat && this.binaryRecorder) {
      // Stop binary recording
      const finalMetadata = this.binaryRecorder.stopRecording();
      
      // Update catalog with final stats
      if (this.recordingSessionId && finalMetadata) {
        const filepath = path.join(process.cwd(), 'tests', 'recordings', 'sessions', `${this.recordingSessionId}.p2rec`);
        let fileSize = 0;
        if (fs.existsSync(filepath)) {
          fileSize = fs.statSync(filepath).size;
        }
        
        this.recordingCatalog.updateRecording(this.recordingSessionId, {
          duration: finalMetadata.endTime! - finalMetadata.startTime,
          messageCount: finalMetadata.messageCount || 0,
          fileSize
        });
      }
      
      this.binaryRecorder = null;
    } else {
      // Flush remaining buffer for JSON format
      this.flushRecordingBuffer();
      
      // Update catalog with final stats
      if (this.recordingSessionId) {
        const duration = Date.now() - this.recordingStartTime;
        const filepath = path.join(process.cwd(), 'tests', 'recordings', 'sessions', `${this.recordingSessionId}.jsonl`);
        let fileSize = 0;
        if (fs.existsSync(filepath)) {
          fileSize = fs.statSync(filepath).size;
        }
        
        this.recordingCatalog.updateRecording(this.recordingSessionId, {
          duration,
          messageCount: this.recordingMessageCount,
          fileSize
        });
      }
      
      // Clean up
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = null;
      }
      
      if (this.recordingStream) {
        this.recordingStream.end();
        this.recordingStream = null;
      }
    }
    
    this.isRecording = false;
    this.stats.recordingActive = false;
    this.recordingMetadata = null;
    this.recordingSessionId = null;
    
    this.emit('recordingStopped');
  }
  
  /**
   * Get recording catalog
   */
  public getRecordingCatalog(): RecordingCatalog {
    return this.recordingCatalog;
  }
  
  /**
   * Play back a recorded session
   */
  public async playRecording(filePath: string, speed: number = 1.0, headless: boolean = false): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Recording file not found: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Recording file is empty');
    }
    
    // Parse metadata from first line
    const metadataLine = JSON.parse(lines[0]);
    if (!metadataLine.metadata) {
      throw new Error('Recording file missing metadata');
    }
    
    this.emit('playbackStarted', { metadata: metadataLine.metadata, speed, headless });
    
    // Play back messages
    let lastTimestamp = 0;
    let messagesPlayed = 0;
    let errors = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const message: RecordedMessage = JSON.parse(lines[i]);
      
      // Calculate delay (skip delays in headless mode)
      if (!headless && lastTimestamp > 0) {
        const delay = (message.timestamp - lastTimestamp) / speed;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      lastTimestamp = message.timestamp;
      
      // Route message (or validate in headless mode)
      if (headless) {
        // In headless mode, just validate the message format
        try {
          if (message.messageType === 'binary') {
            const data = Buffer.from(message.data, 'base64');
            if (data.length === 0) throw new Error('Empty binary data');
          } else if (typeof message.data !== 'string') {
            throw new Error('Invalid text message');
          }
          messagesPlayed++;
        } catch (error) {
          errors++;
          this.emit('playbackError', { message, error });
        }
      } else {
        // Normal playback - route to windows
        const window = this.windows.get(message.windowId);
        if (window) {
          if (message.messageType === 'binary') {
            const data = Buffer.from(message.data, 'base64');
            // CRITICAL FIX: Properly convert Buffer to Uint8Array to avoid data corruption
            window.handler(new Uint8Array(data.buffer, data.byteOffset, data.length));
          } else {
            window.handler(message.data);
          }
          messagesPlayed++;
        }
      }
    }
    
    this.emit('playbackCompleted', { messagesPlayed, errors, headless });
  }
  
  /**
   * Get list of active windows
   */
  public getActiveWindows(): WindowInfo[] {
    return Array.from(this.windows.values()).map(w => ({ ...w.stats }));
  }
  
  /**
   * Get routing statistics
   */
  public getRoutingStats(): RoutingStats {
    return { ...this.stats };
  }
  
  /**
   * Record a message to the buffer
   */
  private recordMessage(windowId: string, windowType: string, messageType: 'binary' | 'text', data: Uint8Array | string): void {
    // Check sampling mode
    if (this.recordingMetadata?.samplingMode?.enabled) {
      this.samplingSeed++;
      if (this.samplingSeed % this.recordingMetadata.samplingMode.rate !== 0) {
        return; // Skip this message
      }
    }
    
    if (this.useBinaryFormat && this.binaryRecorder) {
      // Record to binary format
      const buffer = messageType === 'binary' 
        ? Buffer.from(data as Uint8Array)
        : Buffer.from(data as string, 'utf-8');
      this.binaryRecorder.recordMessage(buffer);
      this.recordingMessageCount++;
    } else {
      // Record to JSON format
      const recordedMessage: RecordedMessage = {
        timestamp: Date.now(),
        windowId,
        windowType,
        messageType,
        data: messageType === 'binary' 
          ? Buffer.from(data as Uint8Array).toString('base64')
          : data as string,
        size: messageType === 'binary' 
          ? (data as Uint8Array).length 
          : (data as string).length
      };
      
      this.recordingBuffer.push(recordedMessage);
      this.recordingMessageCount++;
      
      // Flush if buffer is full
      if (this.recordingBuffer.length >= this.BUFFER_SIZE) {
        this.flushRecordingBuffer();
      }
    }
  }
  
  /**
   * Flush recording buffer to disk
   */
  private flushRecordingBuffer(): void {
    if (this.recordingBuffer.length === 0 || !this.recordingStream) {
      return;
    }

    // Write all buffered messages
    for (const message of this.recordingBuffer) {
      this.recordingStream.write(JSON.stringify(message) + '\n');
    }

    // Clear buffer
    this.recordingBuffer = [];
  }

  // REMOVED: extractCOGId() - Legacy text parsing method
  // COG IDs are now carried in message metadata from worker classification
  // No need to re-parse text that was already classified
  
  /**
   * Update routing statistics
   */
  private updateRoutingStats(routingTime: number, data: Uint8Array | string): void {
    this.stats.messagesRouted++;
    
    // Update bytes processed
    if (typeof data === 'string') {
      this.stats.bytesProcessed += data.length;
    } else {
      this.stats.bytesProcessed += data.length;
    }
    
    // Track routing time
    this.routingTimes.push(routingTime);
    if (this.routingTimes.length > this.MAX_ROUTING_SAMPLES) {
      this.routingTimes.shift();
    }
    
    // Update average
    const sum = this.routingTimes.reduce((a, b) => a + b, 0);
    this.stats.averageRoutingTime = sum / this.routingTimes.length;
    
    // Update peak
    if (routingTime > this.stats.peakRoutingTime) {
      this.stats.peakRoutingTime = routingTime;
    }
    
    // Emit warning if routing took too long
    if (routingTime > 1.0) {
      this.emit('slowRouting', { routingTime, threshold: 1.0 });
    }
  }
  
  /**
   * Get logger statistics and diagnostic information
   */
  public getLoggerStats(): any {
    return this.logger.getStatistics();
  }

  /**
   * Generate diagnostic dump for support
   */
  public generateDiagnosticDump(): string {
    this.logger.info('DIAGNOSTIC', 'Generating diagnostic dump');
    return this.logger.generateDiagnosticDump();
  }

  /**
   * Save diagnostic dump to file
   */
  public saveDiagnosticDump(filePath?: string): string {
    this.logger.info('DIAGNOSTIC', 'Saving diagnostic dump to file');
    return this.logger.saveDiagnosticDump(filePath);
  }

  /**
   * Update logger configuration
   */
  public updateLoggerConfig(config: any): void {
    this.logger.info('CONFIG', 'Updating logger configuration', config);
    this.logger.updateConfig(config);
  }

  /**
   * Get recent log entries for debugging
   */
  public getRecentLogEntries(count?: number): any[] {
    return this.logger.getRecentEntries(count);
  }

  /**
   * Log performance metrics
   */
  public logPerformanceMetrics(): void {
    const metrics: PerformanceMetrics = {
      routingTime: this.stats.averageRoutingTime,
      queueDepth: this.recordingBuffer.length,
      throughput: this.stats.messagesRouted,
      bytesPerSecond: this.stats.bytesProcessed,
      errorRate: this.stats.errors
    };
    
    this.logger.logPerformance(metrics);
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (WindowRouter.instance) {
      WindowRouter.instance.logger.info('SHUTDOWN', 'Resetting WindowRouter instance');
      WindowRouter.instance.logger.destroy();
      WindowRouter.instance.stopRecording();
      WindowRouter.instance.windows.clear();
      WindowRouter.instance = null;
    }
  }
}