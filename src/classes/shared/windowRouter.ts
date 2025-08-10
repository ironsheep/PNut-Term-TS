/** @format */

// src/classes/shared/windowRouter.ts

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { RecordingCatalog, CatalogEntry } from './recordingCatalog';
import { RouterLogger, LogLevel, PerformanceMetrics } from './routerLogger';

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
   * Register a debug window for message routing
   */
  public registerWindow(windowId: string, windowType: string, handler: WindowHandler): void {
    this.logger.debug('REGISTER', `Registering window: ${windowId} (${windowType})`);
    
    if (this.windows.has(windowId)) {
      const error = new Error(`Window ${windowId} is already registered`);
      this.logger.logError('REGISTER', error);
      throw error;
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
        this.routeBinaryMessage(message.data as Uint8Array);
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
   */
  public routeBinaryMessage(data: Uint8Array): void {
    const startTime = performance.now();
    
    // Extract COG ID from binary message (assuming it's in first byte's lower 3 bits)
    const cogId = data.length > 0 ? (data[0] & 0x07) : 0;
    const windowId = `debugger-${cogId}`;
    
    this.logger.debug('ROUTE_BINARY', `Routing binary message to COG ${cogId} (${data.length}B)`);
    
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
   * Route text message (DEBUG commands)
   */
  public routeTextMessage(text: string): void {
    const startTime = performance.now();
    
    // Parse window type from DEBUG command
    // Format: "DEBUG windowType data..." or just terminal output
    
    let handled = false;
    
    // Check for DEBUG command
    if (text.startsWith('DEBUG ')) {
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
    
    // Default to terminal window if not a DEBUG command
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
   * Start recording debug session
   */
  public startRecording(metadata: RecordingMetadata): void {
    if (this.isRecording) {
      const error = new Error('Recording already in progress');
      this.logger.logError('RECORDING', error);
      throw error;
    }
    
    this.logger.info('RECORDING', `Starting recording session: ${metadata.sessionName}`);
    
    // Create recordings directory if needed
    const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
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
    this.recordingStream.write(JSON.stringify({ metadata }) + '\n');
    
    // Setup buffered write timer
    this.recordingTimer = setInterval(() => this.flushRecordingBuffer(), this.BUFFER_TIMEOUT);
    
    this.emit('recordingStarted', { metadata, filepath, sessionId: this.recordingSessionId });
  }
  
  /**
   * Stop recording debug session
   */
  public stopRecording(): void {
    if (!this.isRecording) {
      return;
    }
    
    // Flush remaining buffer
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
            window.handler(new Uint8Array(data));
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