/** @format */

// src/classes/loggerWin.ts

import { BrowserWindow, ipcMain } from 'electron';
import { Context } from '../utils/context';
import { DebugWindowBase } from './debugWindowBase';
import * as fs from 'fs';
import * as path from 'path';
import { ensureDirExists, getFormattedDateTime } from '../utils/files';
import { WindowPlacer, PlacementSlot } from '../utils/windowPlacer';
import { SharedMessageType, ExtractedMessage } from './shared/sharedMessagePool';
import { PerformanceMonitor } from './shared/performanceMonitor';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

export interface DebugLoggerTheme {
  name: string;
  foregroundColor: string;
  backgroundColor: string;
}

/**
 * Performance warning entry
 */
interface PerformanceWarning {
  timestamp: number;
  level: 'WARN' | 'CRITICAL' | 'ERROR' | 'RECOVERY';
  message: string;
  details?: any;
}

/**
 * Debug Logger Window - Singleton window that captures ALL debug output
 * This is the "Tall Thin Man" - a heads-up console positioned at bottom-right
 * 
 * RESPONSIBILITIES:
 * - Display formatted debugger messages (80-byte packets, DB packets)
 * - Log all messages to timestamped files for analysis
 * - Provide defensive display of misclassified binary data
 * - Handle high-throughput data with batched rendering (2Mbps capable)
 * 
 * NOT RESPONSIBLE FOR:
 * - Message classification or routing (MessageExtractor handles this)
 * - Serial data parsing or protocol interpretation
 * - Window management beyond its own singleton instance
 * - Terminal output display (MainWindow handles this)
 */
export class LoggerWindow extends DebugWindowBase {
  /**
   * Get the canvas ID for this window (required by base class)
   */
  protected getCanvasId(): string {
    return 'debugLoggerCanvas';
  }


  private static instance: LoggerWindow | null = null;
  private logFile: fs.WriteStream | null = null;
  private logFilePath: string | null = null;
  private cogsAreShowing: boolean = false;
  private theme: DebugLoggerTheme;
  private maxLines: number = 10000;
  private lineBuffer: string[] = [];
  
  // Performance optimizations for 2Mbps handling
  private renderQueue: Array<{message: string, className?: string, timestamp: number}> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL_MS = 16; // 60fps update rate
  private readonly BATCH_SIZE_LIMIT = 100; // Max messages per batch
  private writeBuffer: string[] = [];
  private writeTimer: NodeJS.Timeout | null = null;
  private readonly WRITE_INTERVAL_MS = 100; // Flush to disk every 100ms
  
  // High-resolution timestamp tracking
  private sessionStartTime: number = performance.now();
  private lastMessageTime: number = 0;
  private lastFullTimestamp: string = '';

  // Message buffering for race condition protection
  private pendingLogMessages: string[] = [];
  private logFileReady: boolean = false;

  // Performance warning tracking
  private performanceMonitor: PerformanceMonitor | null = null;
  private warningHistory: PerformanceWarning[] = [];
  private readonly MAX_WARNING_HISTORY = 100;
  private warningRateLimiter: Map<string, number> = new Map(); // key -> lastWarningTime
  private readonly WARNING_COOLDOWN_MS = 5000; // 5 second cooldown per warning type

  // Predefined themes
  private static readonly THEMES = {
    green: {
      name: 'green',
      foregroundColor: '#00FF00',
      backgroundColor: '#000000'
    },
    amber: {
      name: 'amber',
      foregroundColor: '#FFBF00',
      backgroundColor: '#000000'
    }
  };

  private constructor(context: Context) {
    // Call parent with a fixed name since this is a singleton
    super(context, 'DebugLogger', 'logger');
    
    // Default to green theme
    this.theme = LoggerWindow.THEMES.green;
    
    // Create the window but DON'T show it yet
    this.debugWindow = this.createDebugWindow();
    // Window will be shown in the 'ready-to-show' event handler
    
    // CRITICAL: Register with router IMMEDIATELY so we don't lose messages
    // The Debug Logger is special - it needs to capture ALL messages from the start
    this.logConsoleMessage('[DEBUG LOGGER] Registering with WindowRouter immediately...');
    try {
      this.registerWithRouter();
      this.logConsoleMessage('[DEBUG LOGGER] Successfully registered with WindowRouter (immediate)');
    } catch (error) {
      console.error('[DEBUG LOGGER] Failed to register immediately:', error);
      // Try again after a short delay
      setTimeout(() => {
        this.logConsoleMessage('[DEBUG LOGGER] Retry registration after 100ms...');
        try {
          this.registerWithRouter();
          this.logConsoleMessage('[DEBUG LOGGER] Successfully registered with WindowRouter (retry)');
        } catch (err) {
          console.error('[DEBUG LOGGER] Failed to register on retry:', err);
        }
      }, 100);
    }
    
    // Initialize log file after window is created
    // This ensures MainWindow has time to set up event listeners
    setTimeout(() => {
      this.initializeLogFile();
    }, 100);
    
    // Mark as ready so messages aren't queued
    (this as any).isWindowReady = true;
    
    // Process any messages that might have been queued
    if ((this as any).messageQueue && (this as any).messageQueue.length > 0) {
      const queue = (this as any).messageQueue;
      (this as any).messageQueue = [];
      queue.forEach((msg: any) => this.processMessageImmediate(msg));
    }
  }

  /**
   * Get window title (public getter for base class abstract requirement)
   */
  get windowTitle(): string {
    return 'Debug Logger';
  }

  /**
   * Get or create the singleton instance
   */
  public static getInstance(context: Context): LoggerWindow {
    if (!LoggerWindow.instance) {
      LoggerWindow.instance = new LoggerWindow(context);
    }
    return LoggerWindow.instance;
  }

  /**
   * Initialize log file for capturing debug output
   */
  private initializeLogFile(): void {
    try {
      // Use context-based log directory with user preferences
      const logsDir = this.context.getLogDirectory();
      this.logConsoleMessage('[DEBUG LOGGER] Creating logs directory at:', logsDir);
      ensureDirExists(logsDir);
      
      // Generate timestamped filename
      const timestamp = getFormattedDateTime();
      const basename = 'debug';
      this.logFilePath = path.join(logsDir, `${basename}_${timestamp}.log`); // Remove duplicate "_debug"
      this.logConsoleMessage('[DEBUG LOGGER] Log file path:', this.logFilePath);
      
      // Create write stream
      this.logFile = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      this.logConsoleMessage('[DEBUG LOGGER] Write stream created successfully');
      
      // Wait for the stream to be ready before writing
      this.logFile.once('open', (fd) => {
        this.logConsoleMessage('[DEBUG LOGGER] Write stream opened with fd:', fd);

        // Write header and force flush to ensure file is created
        this.logFile!.write(`=== Debug Logger Session Started at ${new Date().toISOString()} ===\n`);
        this.logFile!.write(`Program: ${basename}\n`);
        this.logFile!.write(`=====================================\n\n`, (err) => {
          if (err) {
            console.error('[DEBUG LOGGER] Failed to write header:', err);
          } else {
            this.logConsoleMessage('[DEBUG LOGGER] Log file header written and flushed');

            // Now we can safely sync since fd is available
            try {
              fs.fsyncSync(fd);
              this.logConsoleMessage('[DEBUG LOGGER] Log file synced to disk');
            } catch (syncErr) {
              console.error('[DEBUG LOGGER] Failed to sync log file:', syncErr);
            }

            // CRITICAL FIX: Mark log file as ready and flush any pending messages
            this.logFileReady = true;
            this.flushPendingMessages();
          }
        });
      });
      
      // Handle stream errors
      this.logFile.once('error', (err) => {
        console.error('[DEBUG LOGGER] Write stream error:', err);
      })
      
      // Notify MainWindow that logging started
      this.notifyLoggingStatus(true);
      this.logConsoleMessage('[DEBUG LOGGER] Log file initialized successfully at:', this.logFilePath);
      
      // ENHANCEMENT: Console logging for audit trail visibility
      this.logConsoleMessage(`[DEBUG LOGGER] Started new log: ${this.logFilePath}`);
      
    } catch (error) {
      // Use base class logMessage to send to console, not Debug Logger window
      console.error('[DEBUG LOGGER] Failed to initialize log file:', error);
      super.logMessage(`Failed to initialize log file: ${error}`, 'DebugLogger');
      // Fall back to console logging only
      this.notifyLoggingStatus(false);
    }
  }

  /**
   * Notify MainWindow of logging status changes
   */
  private notifyLoggingStatus(isLogging: boolean): void {
    try {
      // Emit event that MainWindow can listen for
      this.emit('loggingStatusChanged', {
        isLogging,
        filename: this.logFilePath ? path.basename(this.logFilePath) : null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to notify logging status:', error);
    }
  }

  /**
   * Create the actual Electron window
   */
  protected createDebugWindow(): BrowserWindow {
    // Window dimensions - 80x24 terminal size (80 cols x 24 rows)
    // Assuming 10px per character width, 18px per line height
    const charWidth = 10;
    const lineHeight = 18;
    // Use base class method for consistent chrome adjustments
    const contentWidth = (80 * charWidth) + 20;  // 80 chars + padding
    const contentHeight = (24 * lineHeight) + 10; // 24 lines + small padding
    const windowDimensions = this.calculateWindowDimensions(contentWidth, contentHeight);
    const windowWidth = windowDimensions.width;
    const windowHeight = windowDimensions.height;
    
    // Use WindowPlacer for intelligent positioning
    // For now, let's use a simpler approach to ensure it appears
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    // Position at bottom-right with margin
    const margin = 20;
    const position = {
      x: width - windowWidth - margin,
      y: height - windowHeight - margin
    };
    
    this.logConsoleMessage(`[DEBUG LOGGER] Positioning at bottom-right: ${position.x}, ${position.y}`);
    
    const window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: position.x,
      y: position.y,
      title: 'Debug Logger',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      backgroundColor: this.theme.backgroundColor,
      show: false, // Will show when ready
      alwaysOnTop: false,
      resizable: true,
      minimizable: true,
      closable: true
    });
    
    // Load simple HTML for debug output display
    const html = this.generateHTML();
    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    // Set up IPC handlers for menu buttons
    ipcMain.on('toggle-all-cogs', () => {
      if (this.cogsAreShowing) {
        this.logConsoleMessage('[DEBUG LOGGER] Hide All COGs button clicked');
        this.emit('hide-all-cogs-requested');
        // DON'T update state here - let handleHideAllCOGs() do it via updateCOGsState()
      } else {
        this.logConsoleMessage('[DEBUG LOGGER] Show All COGs button clicked');
        this.emit('show-all-cogs-requested');
        // DON'T update state here - let handleShowAllCOGs() do it via updateCOGsState()
      }
    });
    
    ipcMain.on('export-cog-logs', () => {
      this.logConsoleMessage('[DEBUG LOGGER] Export Active COG Logs button clicked');
      // TODO: Implement COG log export functionality
      // This will use COGLogExporter to save all active COG logs
      this.emit('export-cog-logs-requested');
    });
    
    // Use did-finish-load instead of ready-to-show (more reliable with data URLs)
    this.logConsoleMessage('[DEBUG LOGGER] Setting up did-finish-load event handler...');
    window.webContents.once('did-finish-load', () => {
      this.logConsoleMessage('[DEBUG LOGGER] Window did-finish-load event fired!');
      window.show();
      window.focus(); // Also focus the window
      this.logConsoleMessage('[DEBUG LOGGER] Window shown and focused');
      // Window is now ready for content
      this.logMessage('Debug Logger window ready');
      
      // Don't register again - we already did it in the constructor
      // Just verify we're still registered
      const router = this.windowRouter;
      const activeWindows = router.getActiveWindows();
      const loggerWindow = activeWindows.find(w => w.windowType === 'logger');
      if (loggerWindow) {
        this.logConsoleMessage('[DEBUG LOGGER] Verified still registered:', loggerWindow.windowId);
      } else {
        console.error('[DEBUG LOGGER] ❌ Registration was lost! Re-registering...');
        try {
          this.registerWithRouter();
          this.logConsoleMessage('[DEBUG LOGGER] Re-registered successfully');
        } catch (error) {
          console.error('[DEBUG LOGGER] ❌ Re-registration failed:', error);
        }
      }
    });
    
    // Handle window close event
    window.on('close', () => {
      this.logConsoleMessage('[DEBUG LOGGER] Window being closed by user');
      // Don't call closeDebugWindow here - it would cause infinite recursion
      // Just clean up resources directly
      
      // Flush any pending messages
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.processBatch();
      }
      
      // Flush any pending writes
      if (this.writeTimer) {
        clearTimeout(this.writeTimer);
        this.flushWriteBuffer();
      }
      
      // Close log file
      if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
        this.logFile.write(`\n=== Debug Logger Session Ended at ${new Date().toISOString()} ===\n`);
        this.logFile.end();
        this.logFile = null;
      }
      
      // Clear singleton instance
      LoggerWindow.instance = null;
      
      // Mark window as null to prevent further operations
      this.debugWindow = null;
    });
    
    return window;
  }

  /**
   * Generate HTML for the debug logger window
   */
  private generateHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Debug Logger</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${this.theme.backgroundColor};
      color: ${this.theme.foregroundColor};
      font-family: 'Courier New', monospace;
      font-size: 12px;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #menu-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 32px;
      background-color: #f0f0f0;
      border-bottom: 1px solid #d0d0d0;
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 13px;
      z-index: 100;
    }
    #menu-bar button {
      margin-right: 10px;
      padding: 4px 12px;
      background-color: #fff;
      border: 1px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    #menu-bar button:hover {
      background-color: #e8e8e8;
    }
    #status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 28px;
      background-color: #e8e8e8;
      border-top: 1px solid #b8b8b8;
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 13px;
      color: #000000;
    }
    .status-field {
      margin-right: 20px;
    }
    .status-label {
      color: #333333;
      margin-right: 5px;
      font-weight: 500;
    }
    .status-value {
      color: #000000;
    }
    #output {
      flex: 1;
      overflow-y: auto;
      scroll-behavior: smooth;
      white-space: pre-wrap;
      word-wrap: break-word;
      padding: 10px;
      margin-top: 42px; /* Space for fixed menu bar */
      margin-bottom: 32px; /* Space for status bar */
    }
    #output > div {
      display: flex;
      align-items: baseline;
    }
    .cog-message {
      color: ${this.theme.foregroundColor};
    }
    .system-message {
      color: #808080;
      font-style: italic;
    }
    .error-message {
      color: #FF6B6B;
      font-weight: bold;
      background-color: #2D1B1B;
      padding: 2px 4px;
      border-left: 3px solid #FF6B6B;
    }
    .binary-message {
      color: #00FFFF;  /* Cyan for binary hex dumps */
      font-family: 'Courier New', monospace;
    }
    .debugger-formatted {
      color: #FFD700;  /* Gold for formatted debugger messages */
      font-family: 'Courier New', monospace;
      white-space: pre;  /* Preserve formatting */
      background-color: #1a1a1a;
      padding: 2px 4px;
      margin: 2px 0;
      border-left: 3px solid #FFD700;
    }
    .timestamp {
      color: #606060;
      font-size: 10px;
      font-family: 'Courier New', monospace;  /* Monospace for perfect alignment */
      display: inline-block;
      width: 16ch;  /* Fixed width for HH:MM:SS.mmmmmm format - ALWAYS */
      flex-shrink: 0;
      text-align: left;
      margin-right: 1ch;  /* Small gap before debug text */
    }
  </style>
</head>
<body>
  <div id="menu-bar">
    <button id="btn-show-all-cogs">Show All 8 COGs</button>
    <button id="btn-export-cog-logs">Export Active COG Logs</button>
  </div>
  <div id="output"></div>
  <div id="status-bar">
    <div class="status-field">
      <span class="status-label">Log:</span>
      <span class="status-value" id="log-filename">No file</span>
    </div>
    <div class="status-field">
      <span class="status-label">Lines:</span>
      <span class="status-value" id="line-count">0</span>
    </div>
    <div class="status-field">
      <span class="status-label">Size:</span>
      <span class="status-value" id="log-size">0 KB</span>
    </div>
    <div class="status-field">
      <span id="mode-indicator">🔴 Live</span>
      <button id="return-to-live" style="display: none; margin-left: 5px; padding: 2px 8px; font-size: 11px;">↓ Follow Live Data</button>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const output = document.getElementById('output');
    const modeIndicator = document.getElementById('mode-indicator');
    const returnToLiveButton = document.getElementById('return-to-live');
    
    // Hybrid scrolling state
    let autoScroll = true;          // Start in live mode
    let scrollThreshold = 50;       // Pixels from bottom = "live mode"
    let maxScrollbackLines = 1000;  // User configurable from preferences
    let maxDOMLines = 1500;         // DOM performance limit
    let isInitialLoad = true;       // Track initial load to prevent race condition
    
    // Helper functions
    function updateModeIndicator(mode) {
      if (mode === 'live') {
        modeIndicator.textContent = '🔴 Live';
        returnToLiveButton.style.display = 'none';
      } else {
        modeIndicator.textContent = '📜 History';
        returnToLiveButton.style.display = 'inline-block';
      }
    }
    
    function scrollToBottom() {
      output.scrollTop = output.scrollHeight;
    }
    
    function isNearBottom() {
      return (output.scrollTop + output.clientHeight) >= (output.scrollHeight - scrollThreshold);
    }
    
    // Simple scroll behavior - if user scrolls up, pause auto-scroll
    // If they scroll back to bottom, resume
    output.addEventListener('scroll', function() {
      const nearBottom = isNearBottom();
      
      if (nearBottom && !autoScroll) {
        // User scrolled back to bottom - resume auto-scroll
        autoScroll = true;
        updateModeIndicator('live');
      } else if (!nearBottom && autoScroll) {
        // User scrolled up - pause auto-scroll
        autoScroll = false;
        updateModeIndicator('history');
      }
    });
    
    // Return to Live button handler
    returnToLiveButton.addEventListener('click', function() {
      autoScroll = true;
      updateModeIndicator('live');
      scrollToBottom();
    });
    
    ipcRenderer.on('append-message', (event, data) => {
      const line = document.createElement('div');
      line.className = data.type || 'cog-message';
      
      if (data.timestamp) {
        const timestamp = document.createElement('span');
        // Add 'short' class for abbreviated timestamps
        const isShort = data.timestamp.startsWith('.');
        timestamp.className = isShort ? 'timestamp short' : 'timestamp';
        timestamp.textContent = data.timestamp;
        line.appendChild(timestamp);
      }
      
      const content = document.createElement('span');
      content.textContent = data.message;
      line.appendChild(content);
      
      output.appendChild(line);
      
      // Always scroll to bottom after adding content
      // Simple approach - just stay at bottom
      scrollToBottom();
      
      // Manage DOM size for performance
      while (output.children.length > maxDOMLines) {
        output.removeChild(output.firstChild);
      }
    });
    
    // Handle batch messages (performance optimization for 2Mbps)
    ipcRenderer.on('append-messages-batch', (event, messages) => {
      const fragment = document.createDocumentFragment();
      
      messages.forEach(data => {
        const line = document.createElement('div');
        line.className = data.type || 'cog-message';
        
        if (data.timestamp) {
          const timestamp = document.createElement('span');
          // Add 'short' class for abbreviated timestamps
          const isShort = data.timestamp.startsWith('.');
          timestamp.className = isShort ? 'timestamp short' : 'timestamp';
          timestamp.textContent = data.timestamp;
          line.appendChild(timestamp);
        }
        
        const content = document.createElement('span');
        content.textContent = data.message;
        line.appendChild(content);
        
        fragment.appendChild(line);
      });
      
      output.appendChild(fragment);
      
      // Always scroll to bottom after adding content
      // Simple approach - just stay at bottom
      scrollToBottom();
      
      // Manage DOM size for performance
      while (output.children.length > maxDOMLines) {
        output.removeChild(output.firstChild);
      }
    });
    
    ipcRenderer.on('clear-output', () => {
      output.innerHTML = '';
      // Reset to live mode on session reset
      autoScroll = true;
      isInitialLoad = true;  // Reset initial load flag
      updateModeIndicator('live');
    });
    
    
    // Handle scrollback preference updates
    ipcRenderer.on('set-scrollback-lines', (event, lines) => {
      maxScrollbackLines = Math.min(Math.max(lines, 100), 10000); // Clamp to 100-10000 range
      // console.log('[DEBUG LOGGER] Scrollback lines updated to: ' + maxScrollbackLines);
    });
    
    ipcRenderer.on('set-theme', (event, theme) => {
      document.body.style.backgroundColor = theme.backgroundColor;
      document.body.style.color = theme.foregroundColor;
    });
    
    // Add button handlers
    const cogButton = document.getElementById('btn-show-all-cogs');
    let cogsShowing = false;

    cogButton.addEventListener('click', () => {
      cogsShowing = !cogsShowing;
      cogButton.textContent = cogsShowing ? 'Hide All 8 COGs' : 'Show All 8 COGs';
      ipcRenderer.send('toggle-all-cogs');
    });

    // Listen for COG state updates from main process
    ipcRenderer.on('cogs-state-changed', (event, showing) => {
      cogsShowing = showing;
      cogButton.textContent = cogsShowing ? 'Hide All 8 COGs' : 'Show All 8 COGs';
    });
    
    document.getElementById('btn-export-cog-logs').addEventListener('click', () => {
      ipcRenderer.send('export-cog-logs');
    });
  </script>
</body>
</html>`;
  }

  /**
   * Process messages immediately (required by base class)
   * Receives ExtractedMessage from router (router handles SharedMessagePool release)
   */
  protected processMessageImmediate(lineParts: string[] | any): void {
    this.logConsoleMessage('[DEBUG LOGGER] processMessageImmediate called with:', lineParts);

    try {
      // Extract data immediately before any async operations
      this.processMessageImmediateSync(lineParts);
    } catch (error) {
      console.error(`[DEBUG LOGGER] Error processing message: ${error}`);
    }
  }
  
  /**
   * Internal synchronous message processing (extracted for proper release timing)
   */
  private processMessageImmediateSync(actualData: string[] | any): void {
    this.logConsoleMessage('[DEBUG LOGGER] processMessageImmediateSync called with:', actualData);
    
    // Handle binary data (debugger protocol)
    if (actualData instanceof Uint8Array) {
      this.logConsoleMessage('[DEBUG LOGGER] Processing binary debugger message:', actualData.length, 'bytes');
      const hexFormatted = this.formatBinaryAsHex(actualData);
      this.appendMessage(hexFormatted, 'binary-message');
      this.writeToLog(hexFormatted);
    }
    // Handle string array (standard Cog messages)
    else if (Array.isArray(actualData)) {
      const message = actualData.join(' ');
      this.logConsoleMessage('[DEBUG LOGGER] Processing array message:', message);
      
      // Check if this is a formatted debugger message
      if (message.includes('=== Initial Debugger Message') || 
          message.includes('=== Debugger Protocol')) {
        // This is a formatted debugger message, display with special styling
        this.appendMessage(message, 'debugger-formatted');
        this.writeToLog(message);
      } else {
        // Regular COG message
        this.appendMessage(message, 'cog-message');
        this.writeToLog(message);
      }
    } 
    // Handle raw string
    else if (typeof actualData === 'string') {
      this.logConsoleMessage('[DEBUG LOGGER] Processing string message:', actualData);
      
      // Check if this is a formatted debugger message
      if (actualData.includes('=== Initial Debugger Message') || 
          actualData.includes('=== Debugger Protocol')) {
        this.appendMessage(actualData, 'debugger-formatted');
      } else {
        this.appendMessage(actualData, 'cog-message');
      }
      this.writeToLog(actualData);
    }
    
    // Update status bar
    this.updateStatusBar();
  }

  /**
   * Override base class handleRouterMessage to properly route to processTypedMessage
   * WindowRouter calls this with ExtractedMessage containing SharedMessageType
   */
  public handleRouterMessage(message: ExtractedMessage | Uint8Array | string): void {
    try {
      // Check if it's an ExtractedMessage object with type
      if (typeof message === 'object' && !Array.isArray(message) && !(message instanceof Uint8Array)) {
        const extractedMsg = message as ExtractedMessage;
        if (extractedMsg.type !== undefined) {
          // ExtractedMessage with SharedMessageType - route to processTypedMessage
          this.processTypedMessage(extractedMsg.type, extractedMsg.data);
          return;
        }
      }

      // Fallback for legacy paths
      if (typeof message === 'string') {
        this.processTypedMessage(SharedMessageType.TERMINAL_OUTPUT, [message]);
      } else if (message instanceof Uint8Array) {
        this.processTypedMessage(SharedMessageType.DEBUGGER0_416BYTE, message);
      }
    } catch (error) {
      console.error('[DEBUG LOGGER] Error in handleRouterMessage:', error);
    }
  }

  /**
   * Process message with type information (type-safe handoff)
   * Receives ExtractedMessage from router (router handles SharedMessagePool release)
   */
  public processTypedMessage(messageType: SharedMessageType, data: string[] | Uint8Array): void {
    this.logConsoleMessage(`[DEBUG LOGGER] Processing typed message: SharedMessageType ${messageType}`);

    try {
      // Extract data immediately before any async operations
      this.processTypedMessageSync(messageType, data);
    } catch (error) {
      console.error(`[DEBUG LOGGER] Error processing message: ${error}`);
    }
  }

  /**
   * Internal synchronous message processing (extracted for proper release timing)
   */
  private processTypedMessageSync(messageType: SharedMessageType, actualData: string[] | Uint8Array): void {
    // Handle DEBUGGER_416BYTE range (DEBUGGER0-DEBUGGER7)
    if (
      messageType >= SharedMessageType.DEBUGGER0_416BYTE &&
      messageType <= SharedMessageType.DEBUGGER7_416BYTE
    ) {
      // Binary debugger data - display with proper 416-byte formatting
      if (actualData instanceof Uint8Array) {
        const formatted = this.formatDebuggerMessage(actualData);
        this.appendMessage(formatted, 'debugger-formatted');
        this.writeToLog(formatted);
      }
    }
    // Handle DB_PACKET
    else if (messageType === SharedMessageType.DB_PACKET) {
      // DB prefix messages - use same hex format as debugger packets
      if (actualData instanceof Uint8Array) {
        const formatted = this.formatDebuggerMessage(actualData);
        this.appendMessage(formatted, 'debugger-formatted');
        this.writeToLog(formatted);
      }
    }
    // Handle COG messages (COG0-COG7) and P2_SYSTEM_INIT
    else if (
      (messageType >= SharedMessageType.COG0_MESSAGE && messageType <= SharedMessageType.COG7_MESSAGE) ||
      messageType === SharedMessageType.P2_SYSTEM_INIT
    ) {
      // Text data - display as readable text
      if (Array.isArray(actualData)) {
        const message = actualData.join(' ');
        this.appendMessage(message, 'cog-message');
        this.writeToLog(message);
      } else if (typeof actualData === 'string') {
        this.appendMessage(actualData, 'cog-message');
        this.writeToLog(actualData);
      }
    }
    // Handle TERMINAL_OUTPUT
    else if (messageType === SharedMessageType.TERMINAL_OUTPUT) {
      // DEFENSIVE: Check if data is actually ASCII before displaying
      if (actualData instanceof Uint8Array) {
        if (this.isASCIIData(actualData)) {
          // Convert to string and display
          const textMessage = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(actualData);
          this.appendMessage(textMessage, 'cog-message');
          this.writeToLog(textMessage);
        } else {
          // Binary data misclassified as terminal - display as hex fallback
          const hexFallback = this.formatBinaryAsHexFallback(actualData);
          this.appendMessage(hexFallback, 'binary-message');
          this.writeToLog(hexFallback);
        }
      } else if (Array.isArray(actualData)) {
        const message = actualData.join(' ');
        this.appendMessage(message, 'cog-message');
        this.writeToLog(message);
      } else if (typeof actualData === 'string') {
        this.appendMessage(actualData, 'cog-message');
        this.writeToLog(actualData);
      }
    }
    // Handle INVALID_COG
    else if (messageType === SharedMessageType.INVALID_COG) {
      // Error/warning messages
      const errorMsg = Array.isArray(actualData)
        ? actualData.join(' ')
        : actualData instanceof Uint8Array
          ? new TextDecoder().decode(actualData)
          : String(actualData);
      this.appendMessage(`[WARNING] ${errorMsg}`, 'warning-message');
      this.writeToLog(`[WARNING] ${errorMsg}`);
    }
    // Fallback for unknown types
    else {
      // Fallback - use safe display with defensive binary check
      if (actualData instanceof Uint8Array) {
        if (this.isASCIIData(actualData)) {
          const textData = new TextDecoder().decode(actualData);
          this.appendMessage(textData, 'generic-message');
          this.writeToLog(textData);
        } else {
          const hexData = this.formatBinaryAsHexFallback(actualData);
          this.appendMessage(hexData, 'binary-message');
          this.writeToLog(hexData);
        }
      } else {
        const displayData = Array.isArray(actualData) ? actualData.join(' ') : String(actualData);
        this.appendMessage(displayData, 'generic-message');
        this.writeToLog(displayData);
      }
    }

    this.updateStatusBar();
  }
  
  /**
   * Update the status bar with current file info
   */
  private updateStatusBar(): void {
    if (!this.debugWindow || this.debugWindow.isDestroyed()) return;
    
    // Get log file name
    const logFileName = this.logFilePath ? path.basename(this.logFilePath) : 'No file';
    
    // Get line count
    const lineCount = this.lineBuffer.length;
    
    // Get approximate size
    const sizeKB = this.logFilePath && fs.existsSync(this.logFilePath) 
      ? (fs.statSync(this.logFilePath).size / 1024).toFixed(1)
      : '0';
    
    // Send update to renderer
    this.debugWindow.webContents.executeJavaScript(`
      document.getElementById('log-filename').textContent = '${logFileName}';
      document.getElementById('line-count').textContent = '${lineCount}';
      document.getElementById('log-size').textContent = '${sizeKB} KB';
    `);
  }

  /**
   * Append a message to the debug logger window (batched for performance)
   */
  private appendMessage(message: string, type: string = 'cog-message'): void {
    // Add to queue for batched processing with individual timestamps
    this.renderQueue.push({ 
      message, 
      className: type,
      timestamp: Date.now()  // Capture precise arrival time
    });
    
    // Also keep in internal buffer
    this.lineBuffer.push(message);
    if (this.lineBuffer.length > this.maxLines) {
      // Remove oldest 10% when buffer is full
      const removeCount = Math.floor(this.maxLines * 0.1);
      this.lineBuffer.splice(0, removeCount);
    }
    
    // Schedule batch processing if not already scheduled
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_INTERVAL_MS);
    }
    
    // Force immediate flush if queue is getting too large
    if (this.renderQueue.length >= this.BATCH_SIZE_LIMIT) {
      this.processBatch();
    }
  }
  
  /**
   * Process queued messages in batch for performance
   */
  private processBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.renderQueue.length === 0) return;
    
    // Take current batch
    const batch = this.renderQueue.splice(0, this.BATCH_SIZE_LIMIT);
    
    // Send batch to renderer
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      // High-resolution timestamps with fixed-width alignment
      // Format: HH:MM:SS.mmmmmm (always 15 chars)
      // Within same second: spaces replace HH:MM:SS for perfect column alignment
      // This creates a clean vertical column for debug text
      
      const messages = batch.map((item, index) => {
        const msgTime = item.timestamp;
        const d = new Date(msgTime);
        
        // Get all time components
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const seconds = d.getSeconds().toString().padStart(2, '0');
        const millis = d.getMilliseconds();
        
        // Use performance counter for microsecond precision
        const perfMicros = Math.floor((performance.now() * 1000) % 1000);
        const microString = `${millis.toString().padStart(3, '0')}${perfMicros.toString().padStart(3, '0')}`;
        
        let timestamp: string;
        
        // Check what parts changed from last timestamp
        const lastHours = this.lastFullTimestamp ? this.lastFullTimestamp.substring(0, 2) : '';
        const lastMinutes = this.lastFullTimestamp ? this.lastFullTimestamp.substring(3, 5) : '';
        const lastSeconds = this.lastFullTimestamp ? this.lastFullTimestamp.substring(6, 8) : '';
        
        if (index === 0 || hours !== lastHours || minutes !== lastMinutes || seconds !== lastSeconds) {
          // Something changed - show the changed parts
          if (hours !== lastHours || index === 0) {
            // Hour changed or first message - show full timestamp
            timestamp = `${hours}:${minutes}:${seconds}.${microString}`;
          } else if (minutes !== lastMinutes) {
            // Minute changed - blank out hour
            timestamp = `   ${minutes}:${seconds}.${microString}`;
          } else {
            // Just seconds changed - blank out hour:minute
            timestamp = `      ${seconds}.${microString}`;
          }
          this.lastFullTimestamp = `${hours}:${minutes}:${seconds}`;
        } else {
          // Same second - just show microseconds with spaces for alignment
          timestamp = `        .${microString}`;
        }
        
        return {
          message: item.message,
          type: item.className || 'cog-message',
          timestamp: timestamp
        };
      });
      
      this.logConsoleMessage(`[DEBUG LOGGER] Sending batch of ${messages.length} messages to window`);
      this.debugWindow.webContents.send('append-messages-batch', messages);
    } else {
      this.logConsoleMessage('[DEBUG LOGGER] Window not available for batch processing');
    }
    
    // If more messages pending, schedule next batch
    if (this.renderQueue.length > 0) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_INTERVAL_MS);
    }
  }

  /**
   * Write message to log file (buffered for performance)
   * RACE CONDITION FIX: Buffer messages if log file isn't ready yet
   */
  private writeToLog(message: string): void {
    const timestamp = new Date().toISOString();
    // Strip trailing CR/LF from message before logging (messages arrive with line endings from P2)
    const cleanMessage = message.replace(/[\r\n]+$/, '');
    const logEntry = `[${timestamp}] ${cleanMessage}\n`;

    if (this.logFileReady && this.logFile) {
      // Log file is ready - write normally
      this.writeBuffer.push(logEntry);

      // Log first few writes to confirm it's working
      if (this.writeBuffer.length <= 3) {
        const truncated = message.length > 80 ? message.substring(0, 80) + '...' : message;
        this.logConsoleMessage('[DEBUG LOGGER] Added to write buffer:', truncated);
      }

      // Schedule write if not already scheduled
      if (!this.writeTimer) {
        this.writeTimer = setTimeout(() => this.flushWriteBuffer(), this.WRITE_INTERVAL_MS);
      }

      // Force flush only if buffer is getting large (4KB)
      // Removed the "|| this.writeBuffer.length === 1" condition that was causing every message to flush immediately
      if (this.writeBuffer.join('').length > 4096) {
        this.flushWriteBuffer();
      }
    } else {
      // Log file not ready yet - buffer the message for later
      this.pendingLogMessages.push(logEntry);
      this.logConsoleMessage(`[DEBUG LOGGER] 📦 Buffered message (log file not ready): ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

      // Limit buffer size to prevent memory issues
      if (this.pendingLogMessages.length > 1000) {
        console.warn('[DEBUG LOGGER] ⚠️ Pending message buffer full, dropping oldest messages');
        this.pendingLogMessages.splice(0, 100); // Remove oldest 100 messages
      }
    }
  }
  
  /**
   * Flush pending messages that were buffered during log file initialization
   * RACE CONDITION FIX: Called once log file is ready
   */
  private flushPendingMessages(): void {
    if (this.pendingLogMessages.length > 0) {
      this.logConsoleMessage(`[DEBUG LOGGER] 🚀 Flushing ${this.pendingLogMessages.length} pending messages to log file`);

      // Add all pending messages to the write buffer
      this.writeBuffer.push(...this.pendingLogMessages);

      // Clear the pending buffer
      this.pendingLogMessages = [];

      // Force immediate flush of the write buffer
      this.flushWriteBuffer();
    }
  }

  /**
   * Flush write buffer to disk
   */
  private flushWriteBuffer(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    if (this.writeBuffer.length > 0 && this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      const data = this.writeBuffer.join('');
      this.writeBuffer = [];

      // Async write with error handling
      this.logFile.write(data, (err) => {
        if (err) {
          console.error('[DEBUG LOGGER] Failed to write to log file:', err);
          // Could implement disk full handling here
        } else {
          this.logConsoleMessage(`[DEBUG LOGGER] Flushed ${data.length} bytes to log file`);
        }
      });
    } else if (this.writeBuffer.length > 0) {
      console.warn('[DEBUG LOGGER] flushWriteBuffer called but logFile is null or not writable');
    }
  }

  /**
   * Log a serial message from P2 hardware (public interface for mainWindow)
   * This is for SERIAL DATA ONLY - not for application diagnostic messages
   */
  public logSerialMessage(message: string): void {
    // Determine message type based on content
    let messageType = 'cog-message';
    
    // Check if it's binary hex data
    if (message.startsWith('Cog') && message.includes('0x')) {
      messageType = 'binary-message';
    } else if (message.startsWith('[P2 Binary Data')) {
      messageType = 'binary-message';
    }
    
    this.appendMessage(message, messageType);
    this.writeToLog(message);
  }
  
  /**
   * Log a system message (different styling)
   */
  public logSystemMessage(message: string): void {
    this.appendMessage(message, 'system-message');
    this.writeToLog(`[SYSTEM] ${message}`);
  }

  /**
   * Change the theme
   */
  public setTheme(themeName: 'green' | 'amber'): void {
    this.theme = LoggerWindow.THEMES[themeName] || LoggerWindow.THEMES.green;
    if (this.debugWindow) {
      this.debugWindow.webContents.send('set-theme', this.theme);
    }
  }

  /**
   * Update COGs showing state (for button sync)
   */
  public updateCOGsState(showing: boolean): void {
    this.cogsAreShowing = showing;

    // Update the button in the renderer
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send('cogs-state-changed', showing);
    }
  }

  /**
   * Clear the output
   */
  public clearOutput(): void {
    if (this.debugWindow) {
      this.debugWindow.webContents.send('clear-output');
    }
    this.lineBuffer = [];
    this.renderQueue = [];  // Clear pending messages to prevent them showing after reset
    
    // Write separator in log file only if stream is still writable
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      this.logFile.write(`\n=== Output Cleared at ${new Date().toISOString()} ===\n\n`);
    }
  }

  /**
   * Handle DTR reset - close current log and start new one
   */
  public handleDTRReset(): void {
    // Step 1: Flush write buffer to old log file
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flushWriteBuffer();

    // Step 2: Close current log file with proper cleanup
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      // Write session end message to old log
      this.logFile.write(`\n=== Session ended due to DTR Reset at ${new Date().toISOString()} ===\n`);

      // End the old log file and wait for it to close
      const oldLogFile = this.logFile;
      this.logFile = null; // Clear reference immediately to prevent new writes
      this.logFileReady = false; // Block new writes

      oldLogFile.end(() => {
        // Callback when old file is fully closed
        this.logConsoleMessage('[DEBUG LOGGER] Old log file closed after DTR reset');

        // Step 3: Clear both buffers AFTER old file is closed
        this.writeBuffer = [];
        this.pendingLogMessages = [];

        // Step 4: Clear the display
        this.clearOutput();

        // Step 5: Create new log file
        this.initializeLogFile();

        // Step 6: Update status bar with new filename
        this.updateStatusBar();

        // Step 7: Log system message to NEW log file
        this.logSystemMessage('New session started due to DTR Reset');
      });
    } else {
      // No log file to close, just reset state
      this.writeBuffer = [];
      this.pendingLogMessages = [];
      this.logFileReady = false;
      this.clearOutput();
      this.initializeLogFile();
      this.updateStatusBar();
      this.logSystemMessage('New session started due to DTR Reset');
    }
  }

  /**
   * Handle RTS reset - close current log and start new one
   */
  public handleRTSReset(): void {
    // Step 1: Flush write buffer to old log file
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flushWriteBuffer();

    // Step 2: Close current log file with proper cleanup
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      // Write session end message to old log
      this.logFile.write(`\n=== Session ended due to RTS Reset at ${new Date().toISOString()} ===\n`);

      // End the old log file and wait for it to close
      const oldLogFile = this.logFile;
      this.logFile = null; // Clear reference immediately to prevent new writes
      this.logFileReady = false; // Block new writes

      oldLogFile.end(() => {
        // Callback when old file is fully closed
        this.logConsoleMessage('[DEBUG LOGGER] Old log file closed after RTS reset');

        // Step 3: Clear both buffers AFTER old file is closed
        this.writeBuffer = [];
        this.pendingLogMessages = [];

        // Step 4: Clear the display
        this.clearOutput();

        // Step 5: Create new log file
        this.initializeLogFile();

        // Step 6: Update status bar with new filename
        this.updateStatusBar();

        // Step 7: Log system message to NEW log file
        this.logSystemMessage('New session started due to RTS Reset');
      });
    } else {
      // No log file to close, just reset state
      this.writeBuffer = [];
      this.pendingLogMessages = [];
      this.logFileReady = false;
      this.clearOutput();
      this.initializeLogFile();
      this.updateStatusBar();
      this.logSystemMessage('New session started due to RTS Reset');
    }
  }

  /**
   * Handle download start - close current log and start new one for download session
   */
  public handleDownloadStart(): void {
    // Step 1: Flush write buffer to old log file
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flushWriteBuffer();

    // Step 2: Close current log file with proper cleanup
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      // Write session end message to old log
      this.logFile.write(`\n=== Session ended - Download Started at ${new Date().toISOString()} ===\n`);

      // End the old log file and wait for it to close
      const oldLogFile = this.logFile;
      this.logFile = null; // Clear reference immediately to prevent new writes
      this.logFileReady = false; // Block new writes

      oldLogFile.end(() => {
        // Callback when old file is fully closed
        this.logConsoleMessage('[DEBUG LOGGER] Old log file closed after download start');

        // Step 3: Clear both buffers AFTER old file is closed
        this.writeBuffer = [];
        this.pendingLogMessages = [];

        // Step 4: Clear the display
        this.clearOutput();

        // Step 5: Create new log file
        this.initializeLogFile();

        // Step 6: Update status bar with new filename
        this.updateStatusBar();

        // Step 7: Log system message to NEW log file
        this.logSystemMessage('Download Session Started');
      });
    } else {
      // No log file to close, just reset state
      this.writeBuffer = [];
      this.pendingLogMessages = [];
      this.logFileReady = false;
      this.clearOutput();
      this.initializeLogFile();
      this.updateStatusBar();
      this.logSystemMessage('Download Session Started');
    }
  }

  /**
   * Close the window and cleanup
   */
  public closeDebugWindow(): void {
    this.logConsoleMessage('[DEBUG LOGGER] Closing window and terminating log...');
    
    // Flush any pending messages
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.processBatch();
    }
    
    // Flush any pending writes
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.flushWriteBuffer();
    }
    
    // Close log file
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      this.logFile.write(`\n=== Debug Logger Session Ended at ${new Date().toISOString()} ===\n`);
      this.logFile.end();
      this.logFile = null;
      this.logConsoleMessage('[DEBUG LOGGER] Log file closed');
    }
    
    // Clear singleton instance
    LoggerWindow.instance = null;
    
    // Clean up the window - check if it's destroyed first
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
      this.debugWindow = null;
    }
    
    this.logConsoleMessage('[DEBUG LOGGER] Window closed and log terminated');
  }

  /**
   * Get current log file path
   */
  public getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /**
   * Check if binary data is valid ASCII (defensive display)
   */
  private isASCIIData(data: Uint8Array): boolean {
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      // Allow printable ASCII (32-126), tabs (9), line feeds (10), carriage returns (13)
      if (!(byte >= 32 && byte <= 126) && byte !== 9 && byte !== 10 && byte !== 13) {
        return false;
      }
    }
    return true;
  }

  /**
   * Format debugger messages (416-byte packets showing only 40-byte status block)
   * Format: 'Cog N' header followed by 32 bytes per line, no ASCII interpretation
   * Groups of 8 bytes separated by single space, groups of 16 by double space
   * 3-digit hex offsets at line start
   * For 416-byte packets: Shows first 40 bytes (status block) then "... [376 more bytes]"
   */
  private formatDebuggerMessage(data: Uint8Array): string {
    if (data.length === 0) return 'Cog ? (empty debugger message)';
    
    const firstByte = data[0];
    const cogId = firstByte <= 0x07 ? firstByte : -1;
    const lines: string[] = [];
    
    const prefix = cogId >= 0 
      ? `Cog ${cogId}:` 
      : `INVALID(0x${firstByte.toString(16).toUpperCase()}):`;
    
    // Add header line
    lines.push(prefix);
    
    const bytesPerLine = 32;
    
    // For 416-byte packets, only show first 40 bytes (status block)
    const bytesToShow = data.length === 416 ? 40 : data.length;
    
    // Process in groups of 32 bytes per line
    for (let offset = 0; offset < bytesToShow; offset += bytesPerLine) {
      const lineLongs: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, bytesToShow);
      
      // Build hex representation as 32-bit longs with proper spacing
      for (let i = offset; i < endOffset; i += 4) {
        // Combine four bytes into a 32-bit long (byte order 0,1,2,3 as they appear)
        if (i + 3 < bytesToShow) {
          // Full 4 bytes available
          const byte0 = data[i].toString(16).padStart(2, '0').toUpperCase();
          const byte1 = data[i+1].toString(16).padStart(2, '0').toUpperCase();
          const byte2 = data[i+2].toString(16).padStart(2, '0').toUpperCase();
          const byte3 = data[i+3].toString(16).padStart(2, '0').toUpperCase();
          lineLongs.push(`$${byte0}${byte1}${byte2}${byte3}`);
        } else {
          // Handle partial bytes at end
          let hex = '';
          for (let j = i; j < Math.min(i + 4, bytesToShow); j++) {
            hex += data[j].toString(16).padStart(2, '0').toUpperCase();
          }
          lineLongs.push(`$${hex}`);
        }
        
        // Add spacing after groups (counting longs, not bytes)
        const longPos = (i - offset) / 4;
        if (longPos === 1 && i + 4 < endOffset) {
          lineLongs.push(' '); // Single space after 8 bytes (2 longs)
        } else if (longPos === 3 && i + 4 < endOffset) {
          lineLongs.push('  '); // Double space after 16 bytes (4 longs)
        } else if (longPos === 5 && i + 4 < endOffset) {
          lineLongs.push(' '); // Single space after 24 bytes (6 longs)
        }
        // Note: 32-byte boundary would need triple space but we're at line end
      }
      
      // Format with 3-digit hex offset: "000: $XXXXXXXX $XXXXXXXX ..."
      const offsetStr = offset.toString(16).padStart(3, '0').toUpperCase();
      const hexPart = lineLongs.join(' ');
      const formattedLine = `  ${offsetStr}: ${hexPart}`;
      
      lines.push(formattedLine);
    }
    
    // Add indicator for 416-byte packets that we're only showing the status block
    if (data.length === 416) {
      lines.push(`  ... [${data.length - bytesToShow} more bytes]`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format other binary data with hex dump and ASCII interpretation
   * Format: 16 bytes per line with ASCII sidebar
   * Used for non-debugger binary messages
   */
  private formatBinaryWithAscii(data: Uint8Array): string {
    if (data.length === 0) return '(empty binary data)';
    
    const lines: string[] = [];
    const bytesPerLine = 16;
    
    // Process in groups of 16 bytes per line with hex + ASCII display
    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes: string[] = [];
      const asciiBytes: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, data.length);
      
      // Build hex representation with proper spacing
      for (let i = offset; i < endOffset; i++) {
        const hex = data[i].toString(16).padStart(2, '0').toUpperCase();
        lineBytes.push(`$${hex}`);
        
        // Build ASCII representation
        const byte = data[i];
        if (byte >= 32 && byte <= 126) {
          asciiBytes.push(String.fromCharCode(byte));
        } else {
          asciiBytes.push('.');
        }
        
        // Add extra space after 8 bytes for readability
        if ((i - offset) === 7 && i + 1 < endOffset) {
          lineBytes.push(' '); // Extra space between groups of 8
        }
      }
      
      // Pad hex display to consistent width (for alignment)
      const hexWidth = 51; // Width for 16 bytes: "$XX $XX ... $XX  $XX $XX ... $XX"
      const hexPart = lineBytes.join(' ');
      const paddedHexPart = hexPart.padEnd(hexWidth);
      
      // Pad ASCII to 16 characters
      while (asciiBytes.length < bytesPerLine) {
        asciiBytes.push(' ');
      }
      
      // Format: "  XXXX: $XX $XX ... $XX  |ASCII_CHARS|"
      const offsetStr = offset.toString(16).padStart(4, '0').toUpperCase();
      const asciiPart = asciiBytes.join('');
      const formattedLine = `  ${offsetStr}: ${paddedHexPart} |${asciiPart}|`;
      
      lines.push(formattedLine);
    }
    
    return lines.join('\n');
  }

  /**
   * Format binary data as hex fallback (when misclassified as terminal)
   */
  private formatBinaryAsHexFallback(data: Uint8Array): string {
    if (data.length === 0) return '[BINARY: empty]';
    
    // Use standard hex display with ASCII interpretation
    const lines: string[] = [];
    const bytesPerLine = 16;
    
    lines.push(`[BINARY DATA: ${data.length} bytes - displaying as hex]`);
    
    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes: string[] = [];
      const asciiBytes: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, data.length);
      
      // Hex representation
      for (let i = offset; i < endOffset; i++) {
        const hex = data[i].toString(16).padStart(2, '0').toUpperCase();
        lineBytes.push(hex);
        
        // ASCII interpretation
        const byte = data[i];
        if (byte >= 32 && byte <= 126) {
          asciiBytes.push(String.fromCharCode(byte));
        } else {
          asciiBytes.push('.');
        }
      }
      
      // Add padding for hex display alignment
      while (lineBytes.length < bytesPerLine) {
        lineBytes.push('  ');
        asciiBytes.push(' ');
      }
      
      const hexPart = lineBytes.join(' ');
      const asciiPart = asciiBytes.join('');
      const offsetStr = offset.toString(16).padStart(4, '0').toUpperCase();
      
      lines.push(`  ${offsetStr}: ${hexPart}  |${asciiPart}|`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format binary data as hex dump with Spin-2 notation (legacy method)
   * Format: "Cog N $xx $xx $xx $xx $xx $xx $xx $xx  $xx $xx $xx $xx $xx $xx $xx $xx"
   * Subsequent lines are indented to align with hex data
   */
  private formatBinaryAsHex(data: Uint8Array): string {
    if (data.length === 0) return 'Cog ? (empty message)';
    
    // First byte IS the COG ID (no masking needed for valid P2 debugger protocol)
    const firstByte = data[0];
    const cogId = firstByte <= 0x07 ? firstByte : -1; // -1 indicates invalid COG ID
    const lines: string[] = [];
    const bytesPerLine = 16;
    
    // Show warning for invalid COG IDs
    const prefix = cogId >= 0 
      ? `Cog ${cogId} ` 
      : `INVALID(0x${firstByte.toString(16).toUpperCase()}) `;
    const indent = ' '.repeat(prefix.length);
    
    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, data.length);
      
      // Format each byte as $xx
      for (let i = offset; i < endOffset; i++) {
        const hex = data[i].toString(16).padStart(2, '0').toUpperCase();
        lineBytes.push(`$${hex}`);
        
        // Add double space after 8 bytes (except at end of line)
        if ((i - offset) === 7 && (i + 1) < endOffset) {
          lineBytes.push(' '); // Extra space for group separator
        }
      }
      
      // First line gets the Cog prefix, others get indent
      const linePrefix = offset === 0 ? prefix : indent;
      lines.push(linePrefix + lineBytes.join(' '));
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get buffered lines for testing
   */
  public getBufferedLines(): string[] {
    return [...this.lineBuffer];
  }

  /**
   * Set performance monitor for warnings
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
    
    // Listen for performance threshold events
    monitor.on('threshold', (alert) => {
      this.handlePerformanceThreshold(alert);
    });
  }

  /**
   * Handle performance threshold alerts
   */
  private handlePerformanceThreshold(alert: any): void {
    const now = Date.now();
    const alertKey = `${alert.type}_${alert.component || 'general'}`;
    
    // Check rate limiting
    const lastWarningTime = this.warningRateLimiter.get(alertKey) || 0;
    if (now - lastWarningTime < this.WARNING_COOLDOWN_MS) {
      return; // Skip this warning due to rate limiting
    }
    
    this.warningRateLimiter.set(alertKey, now);
    
    let level: 'WARN' | 'CRITICAL' | 'ERROR' = 'WARN';
    let message = '';
    
    switch (alert.type) {
      case 'buffer':
        const usage = alert.usagePercent || alert.details?.usagePercent;
        if (usage >= 95) {
          level = 'CRITICAL';
          message = `[PERF_CRITICAL] Buffer ${usage.toFixed(1)}% full, data loss imminent`;
        } else if (usage >= 80) {
          level = 'WARN';
          message = `[PERF_WARN] Buffer usage ${usage.toFixed(1)}% exceeds threshold`;
        }
        break;
        
      case 'queue':
        const depth = alert.depth || alert.details?.depth;
        const name = alert.name || alert.component || 'unknown';
        if (depth >= 1000) {
          level = 'CRITICAL';
          message = `[PERF_CRITICAL] Queue '${name}' depth ${depth} indicates processing lag`;
        } else {
          level = 'WARN';
          message = `[PERF_WARN] Queue '${name}' depth ${depth} exceeds threshold`;
        }
        break;
        
      case 'latency':
        const latency = alert.latencyMs || alert.details?.latencyMs;
        if (latency >= 500) {
          level = 'CRITICAL';
          message = `[PERF_CRITICAL] Processing latency ${latency}ms causes real-time loss`;
        } else {
          level = 'WARN';
          message = `[PERF_WARN] Processing latency ${latency}ms exceeds threshold`;
        }
        break;
        
      default:
        message = `[PERF_WARN] Performance threshold exceeded: ${JSON.stringify(alert)}`;
    }
    
    // Add context and recommendations
    message += this.getPerformanceRecommendations(alert.type, alert);
    
    // Log the warning
    this.logPerformanceWarning(level, message, alert);
  }

  /**
   * Log a performance warning with proper formatting
   */
  public logPerformanceWarning(level: 'WARN' | 'CRITICAL' | 'ERROR' | 'RECOVERY', message: string, details?: any): void {
    const warning: PerformanceWarning = {
      timestamp: Date.now(),
      level,
      message,
      details
    };
    
    // Add to history (circular buffer)
    this.warningHistory.push(warning);
    if (this.warningHistory.length > this.MAX_WARNING_HISTORY) {
      this.warningHistory.shift();
    }
    
    // Format for display
    const formattedMessage = `${message}`;
    
    // Use appropriate styling based on level
    let messageType = 'system-message';
    if (level === 'CRITICAL' || level === 'ERROR') {
      messageType = 'error-message';
    }
    
    this.appendMessage(formattedMessage, messageType);
    this.writeToLog(`[${level}] ${message}`);
  }

  /**
   * Log data rate warning
   */
  public logDataRateWarning(currentRate: number, sustainableRate: number): void {
    const message = `[PERF_WARN] Data rate ${(currentRate/1024/1024).toFixed(1)}Mbps exceeds sustainable rate ${(sustainableRate/1024/1024).toFixed(1)}Mbps`;
    this.logPerformanceWarning('WARN', message, { currentRate, sustainableRate });
  }

  /**
   * Log dropped bytes warning
   */
  public logDroppedBytesWarning(droppedCount: number, timeWindowMs: number = 1000): void {
    const level = droppedCount > 1000 ? 'ERROR' : 'CRITICAL';
    const message = `[PERF_${level}] Dropped ${droppedCount.toLocaleString()} bytes in last ${timeWindowMs}ms`;
    this.logPerformanceWarning(level, message, { droppedCount, timeWindowMs });
  }

  /**
   * Log recovery message when conditions improve
   */
  public logPerformanceRecovery(metric: string, currentValue: number, threshold: number): void {
    const message = `[PERF_RECOVERY] ${metric} recovered: ${currentValue} below threshold ${threshold}`;
    this.logPerformanceWarning('RECOVERY', message, { metric, currentValue, threshold });
  }

  /**
   * Get performance recommendations based on alert type
   */
  private getPerformanceRecommendations(alertType: string, alert: any): string {
    const recommendations = [];
    
    switch (alertType) {
      case 'buffer':
        recommendations.push('Consider: reduce baud rate');
        recommendations.push('close unused windows');
        recommendations.push('enable emergency mode');
        break;
        
      case 'queue':
        recommendations.push('Consider: reduce message volume');
        recommendations.push('check for blocking operations');
        break;
        
      case 'latency':
        recommendations.push('Consider: reduce UI update frequency');
        recommendations.push('disable non-essential features');
        break;
    }
    
    return recommendations.length > 0 ? ` (${recommendations.join(', ')})` : '';
  }

  /**
   * Get recent performance warnings for diagnostics
   */
  public getWarningHistory(limit: number = 50): PerformanceWarning[] {
    return this.warningHistory.slice(-limit);
  }

  /**
   * Clear warning history
   */
  public clearWarningHistory(): void {
    this.warningHistory = [];
    this.warningRateLimiter.clear();
  }

  /**
   * Update scrollback preference
   */
  public updateScrollbackPreference(lines: number): void {
    if (this.debugWindow) {
      this.debugWindow.webContents.send('set-scrollback-lines', lines);
    }
  }
}