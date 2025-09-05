/** @format */

// src/classes/shared/windowRouter.ts

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { RecordingCatalog, CatalogEntry } from './recordingCatalog';
import { RouterLogger, LogLevel, PerformanceMetrics } from './routerLogger';
import { safeDisplayString } from '../../utils/displayUtils';
import { BinaryRecorder } from './binaryRecorder';

/**
 * Window handler callback for routing messages to debug windows
 */
export type WindowHandler = (message: SerialMessage | Uint8Array | string) => void;

/**
 * Serial message interface for routing
 */
export interface SerialMessage {
  type: 'binary' | 'text';
  data: Uint8Array | string;
  timestamp: number;
  source?: string;
  cogId?: number;  // Optional COG ID for debugger messages
}

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
  private static instance: WindowRouter | null = null;
  
  // Window management
  private windows: Map<string, { type: string; handler: WindowHandler; stats: WindowInfo }> = new Map();
  
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
  public static getInstance(): WindowRouter {
    if (!WindowRouter.instance) {
      WindowRouter.instance = new WindowRouter();
    }
    return WindowRouter.instance;
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
   * Route a message to appropriate window(s)
   */
  public routeMessage(message: SerialMessage): void {
    const startTime = performance.now();
    
    try {
      const dataSize = typeof message.data === 'string' ? message.data.length : message.data.length;
      this.logger.trace('ROUTE', `Routing ${message.type} message (${dataSize} bytes)`);
      
      if (message.type === 'binary') {
        // Use tagged COG ID if available
        this.routeBinaryMessage(message.data as Uint8Array, message.cogId);
      } else {
        this.routeTextMessage(message.data as string);
      }
      
      // Update statistics
      const routingTime = performance.now() - startTime;
      this.updateRoutingStats(routingTime, message.data);
      
      // Log performance if slow
      if (routingTime > 1.0) {
        this.logger.warn('PERFORMANCE', `Slow routing detected: ${routingTime.toFixed(2)}ms (${message.type}, ${dataSize}B)`);
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
   * Route text message (DEBUG commands, Cog messages, etc.)
   */
  public routeTextMessage(text: string): void {
    const startTime = performance.now();
    
    let handled = false;
    
    // 1. Check for Cog messages, INIT messages, OR backtick commands (all P2 debug output)
    if (text.startsWith('Cog') || text.includes('INIT') || text.includes('`')) {
      this.logger.debug('ROUTE', `Routing Cog/INIT message: ${text.substring(0, 50)}...`);
      
      // Always route to DebugLogger window for logging
      let loggerWindowFound = false;
      for (const [windowId, window] of this.windows) {
        if (window.type === 'logger') {  // DebugLoggerWindow registers as 'logger' type
          console.log(`[ROUTER->LOGGER] Sending ${text.length} bytes to DebugLogger window`);
          window.handler(text);
          window.stats.messagesReceived++;
          handled = true;
          loggerWindowFound = true;
          
          if (this.isRecording) {
            this.recordMessage(windowId, window.type, 'text', text);
          }
        }
      }
      
      // Defensive error logging: warn if no logger window found
      if (!loggerWindowFound) {
        this.logger.warn('ROUTE_ERROR', `No DebugLoggerWindow registered to receive Cog message: "${text.substring(0, 50)}..."`);
        console.warn('[ROUTING] ⚠️ Cog message received but no DebugLoggerWindow registered! Message will be lost.');
        console.warn('[ROUTING] 💡 This usually means DebugLoggerWindow failed to call registerWithRouter()');
      }
      
      // Check for embedded backtick commands in Cog messages
      if (text.includes('`')) {
        const tickIndex = text.indexOf('`');
        const embeddedCommand = text.substring(tickIndex);
        this.logger.debug('ROUTE', `Found embedded command in Cog message: ${embeddedCommand}`);
        
        // Parse and route the embedded command
        this.routeBacktickCommand(embeddedCommand);
      }
      
      // DISABLED: False reboot detection - only actual DTR/RTS events should trigger resets
      // Normal P2 debug messages should NOT trigger system reboot events
      /*
      // Detect P2 processor reset/reboot events  
      if (text.startsWith('Cog0') && text.includes('INIT')) {
        // Check for the golden synchronization marker
        if (text.includes('$0000_0000 $0000_0000 load')) {
          this.logger.info('ROUTE', '🎯 P2 SYSTEM REBOOT detected - golden sync marker found');
          console.log(`[P2 SYNC] 🎯 SYSTEM REBOOT: ${text}`);
          // Emit special event for complete synchronization reset
          this.emit('p2SystemReboot', { message: text, timestamp: Date.now() });
        } else {
          this.logger.info('ROUTE', 'Processor reset detected (Cog0 INIT)');
          // Regular processor reset event
          this.emit('processorReset', { message: text });
        }
      */
    }
    // 2. Check for standalone backtick commands
    else if (text.includes('`')) {
      const tickIndex = text.indexOf('`');
      const command = text.substring(tickIndex);
      this.routeBacktickCommand(command);
      handled = true;
    }
    // 3. Check for DEBUG command format
    else if (text.startsWith('DEBUG ')) {
      const parts = text.split(' ', 3);
      if (parts.length >= 2) {
        const windowType = parts[1].toLowerCase();
        
        // Route to all windows of this type
        for (const [windowId, window] of this.windows) {
          if (window.type === windowType) {
            window.handler(text);
            window.stats.messagesReceived++;
            handled = true;
            
            // Record if enabled
            if (this.isRecording) {
              this.recordMessage(windowId, window.type, 'text', text);
            }
          }
        }
      }
    }
    
    // Default to terminal window if not handled
    if (!handled) {
      const terminalWindow = this.windows.get('terminal');
      if (terminalWindow) {
        terminalWindow.handler(text);
        terminalWindow.stats.messagesReceived++;
        
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
   */
  private routeBacktickCommand(command: string): void {
    // Backtick commands have format: `WINDOWTYPE command data...
    // Example: `TERM MyTerm SIZE 80 25
    
    console.log(`[ROUTER DEBUG] routeBacktickCommand called with: "${command}"`);
    
    if (!command.startsWith('`')) {
      console.log(`[ROUTER DEBUG] ❌ Invalid backtick command (no backtick): "${command}"`);
      this.logger.warn('ROUTE', `Invalid backtick command: ${command}`);
      return;
    }
    
    // CRITICAL: Never create COG-0 windows from backtick commands
    // COG0 is the system COG and should never have a debug window
    if (command.includes('COG-0') || command.includes('COG0')) {
      console.log(`[ROUTER DEBUG] ⚠️ Ignoring COG-0 backtick command (system COG): "${command}"`);
      this.logger.info('ROUTE', 'Ignoring COG-0 backtick command (system COG)');
      return;
    }
    
    // Remove the backtick and parse
    const cleanCommand = command.substring(1).trim();
    const parts = cleanCommand.split(' ');
    
    console.log(`[ROUTER DEBUG] Parsed command: "${safeDisplayString(cleanCommand)}", parts: [${parts.map(p => safeDisplayString(p)).join(', ')}]`);
    
    if (parts.length < 1) {
      console.log(`[ROUTER DEBUG] ❌ Empty backtick command`);
      this.logger.warn('ROUTE', `Empty backtick command`);
      return;
    }
    
    // First check if this is a CLOSE command (e.g., `MyLogic close)
    const windowName = parts[0]; // Keep original case for window name
    const isCloseCommand = parts.length >= 2 && parts[1].toLowerCase() === 'close';
    
    // CRITICAL: Never create COG-0 windows
    if (windowName === 'COG-0' || windowName === 'COG0') {
      console.log(`[ROUTER DEBUG] ⚠️ Blocking COG-0 window creation (system COG)`);
      this.logger.info('ROUTE', 'Blocked COG-0 window creation attempt');
      return;
    }
    
    console.log(`[ROUTER DEBUG] Looking for window: "${windowName}"${isCloseCommand ? ' (CLOSE command)' : ''}`);
    console.log(`[ROUTER DEBUG] Registered windows: [${Array.from(this.windows.keys()).join(', ')}]`);
    
    if (isCloseCommand) {
      // Handle CLOSE command - find and close the window
      console.log(`[ROUTER DEBUG] Processing CLOSE command for window: "${windowName}"`);
      const window = this.windows.get(windowName);
      if (window) {
        console.log(`[ROUTER DEBUG] ✅ Found window "${windowName}" - sending close command`);
        window.handler(command); // Let the window handle its own close
        // Window will unregister itself when it closes
        return;
      } else {
        console.log(`[ROUTER DEBUG] ❌ Window "${windowName}" not found for CLOSE command`);
        return; // Don't emit windowNeeded for CLOSE commands
      }
    }
    
    // Try to route to window by exact name first (e.g., MyLogic, MyTerm)
    let routed = false;
    const window = this.windows.get(windowName);
    if (window) {
      console.log(`[ROUTER DEBUG] ✅ Found window by name: "${windowName}"`);
      // Send the full command including backtick for window to parse
      window.handler(command);
      window.stats.messagesReceived++;
      routed = true;
      
      if (this.isRecording) {
        this.recordMessage(windowName, window.type, 'text', command);
      }
    }
    
    if (!routed) {
      // Log error to terminal for user visibility - safely display binary data
      const safeWindowName = safeDisplayString(windowName);
      const safeCommand = safeDisplayString(command);
      const errorMsg = `ERROR: Unknown window '${safeWindowName}' - cannot route command: ${safeCommand}`;
      console.log(`[ROUTER DEBUG] 🚨 No window found for "${safeWindowName}" - emitting windowNeeded event`);
      this.logger.error('ROUTE', errorMsg);
      
      // Send error to terminal window for user visibility
      const terminalWindow = this.windows.get('terminal');
      if (terminalWindow) {
        terminalWindow.handler(`\n${errorMsg}\n`);
      }
      
      // Emit event in case someone wants to handle missing windows
      console.log(`[ROUTER DEBUG] 📡 Emitting windowNeeded event: type="${windowName}", command="${command}"`);
      this.emit('windowNeeded', { type: windowName, command: command, error: errorMsg });
    } else {
      console.log(`[ROUTER DEBUG] ✅ Successfully routed command to existing window`);
    }
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
    
    // Define recordings directory for both formats
    const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
    
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