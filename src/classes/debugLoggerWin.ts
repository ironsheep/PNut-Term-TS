/** @format */

// src/classes/debugLoggerWin.ts

import { BrowserWindow, ipcMain } from 'electron';
import { Context } from '../utils/context';
import { DebugWindowBase } from './debugWindowBase';
import * as fs from 'fs';
import * as path from 'path';
import { ensureDirExists, getFormattedDateTime } from '../utils/files';
import { WindowPlacer, PlacementSlot } from '../utils/windowPlacer';

export interface DebugLoggerTheme {
  name: string;
  foregroundColor: string;
  backgroundColor: string;
}

/**
 * Debug Logger Window - Singleton window that captures ALL debug output
 * This is the "Tall Thin Man" - a heads-up console positioned at bottom-right
 */
export class DebugLoggerWindow extends DebugWindowBase {
  /**
   * Get the canvas ID for this window (required by base class)
   */
  protected getCanvasId(): string {
    return 'debugLoggerCanvas';
  }


  private static instance: DebugLoggerWindow | null = null;
  private logFile: fs.WriteStream | null = null;
  private logFilePath: string | null = null;
  private theme: DebugLoggerTheme;
  private maxLines: number = 10000;
  private lineBuffer: string[] = [];
  
  // Performance optimizations for 2Mbps handling
  private renderQueue: Array<{message: string, className?: string, timestamp?: number}> = [];
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
    this.theme = DebugLoggerWindow.THEMES.green;
    
    // Create the window but DON'T show it yet
    this.debugWindow = this.createDebugWindow();
    // Window will be shown in the 'ready-to-show' event handler
    
    // CRITICAL: Register with router IMMEDIATELY so we don't lose messages
    // The Debug Logger is special - it needs to capture ALL messages from the start
    console.log('[DEBUG LOGGER] Registering with WindowRouter immediately...');
    try {
      this.registerWithRouter();
      console.log('[DEBUG LOGGER] Successfully registered with WindowRouter (immediate)');
    } catch (error) {
      console.error('[DEBUG LOGGER] Failed to register immediately:', error);
      // Try again after a short delay
      setTimeout(() => {
        console.log('[DEBUG LOGGER] Retry registration after 100ms...');
        try {
          this.registerWithRouter();
          console.log('[DEBUG LOGGER] Successfully registered with WindowRouter (retry)');
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
   * Get or create the singleton instance
   */
  public static getInstance(context: Context): DebugLoggerWindow {
    if (!DebugLoggerWindow.instance) {
      DebugLoggerWindow.instance = new DebugLoggerWindow(context);
    }
    return DebugLoggerWindow.instance;
  }

  /**
   * Initialize log file for capturing debug output
   */
  private initializeLogFile(): void {
    try {
      // Create logs directory
      const logsDir = path.join(process.cwd(), 'logs');
      ensureDirExists(logsDir);
      
      // Generate timestamped filename
      const timestamp = getFormattedDateTime();
      const basename = 'debug';
      this.logFilePath = path.join(logsDir, `${basename}_${timestamp}_debug.log`);
      
      // Create write stream
      this.logFile = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      
      // Write header
      this.logFile.write(`=== Debug Logger Session Started at ${new Date().toISOString()} ===\n`);
      this.logFile.write(`Program: ${basename}\n`);
      this.logFile.write(`=====================================\n\n`);
      
      // Notify MainWindow that logging started
      this.notifyLoggingStatus(true);
      
    } catch (error) {
      this.logMessage(`Failed to initialize log file: ${error}`);
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
    const windowWidth = (80 * charWidth) + 20;  // 80 chars + padding
    const windowHeight = (24 * lineHeight) + 50; // 24 lines + status bar
    
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
    
    console.log(`[DEBUG LOGGER] Positioning at bottom-right: ${position.x}, ${position.y}`);
    
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
    ipcMain.on('show-all-cogs', () => {
      console.log('[DEBUG LOGGER] Show All COGs button clicked');
      // Emit event that MainWindow can listen to
      this.emit('show-all-cogs-requested');
    });
    
    ipcMain.on('export-cog-logs', () => {
      console.log('[DEBUG LOGGER] Export Active COG Logs button clicked');
      // TODO: Implement COG log export functionality
      // This will use COGLogExporter to save all active COG logs
      this.emit('export-cog-logs-requested');
    });
    
    // Use did-finish-load instead of ready-to-show (more reliable with data URLs)
    console.log('[DEBUG LOGGER] Setting up did-finish-load event handler...');
    window.webContents.once('did-finish-load', () => {
      console.log('[DEBUG LOGGER] Window did-finish-load event fired!');
      window.show();
      window.focus(); // Also focus the window
      console.log('[DEBUG LOGGER] Window shown and focused');
      // Window is now ready for content
      this.logMessage('Debug Logger window ready');
      
      // Don't register again - we already did it in the constructor
      // Just verify we're still registered
      const router = this.windowRouter;
      const activeWindows = router.getActiveWindows();
      const loggerWindow = activeWindows.find(w => w.windowType === 'logger');
      if (loggerWindow) {
        console.log('[DEBUG LOGGER] Verified still registered:', loggerWindow.windowId);
      } else {
        console.error('[DEBUG LOGGER] ❌ Registration was lost! Re-registering...');
        try {
          this.registerWithRouter();
          console.log('[DEBUG LOGGER] Re-registered successfully');
        } catch (error) {
          console.error('[DEBUG LOGGER] ❌ Re-registration failed:', error);
        }
      }
    });
    
    // Handle window close event
    window.on('close', () => {
      console.log('[DEBUG LOGGER] Window being closed by user');
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
      DebugLoggerWindow.instance = null;
      
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
      padding: 42px 10px 32px 10px; /* Top space for menu bar, bottom for status bar */
      background-color: ${this.theme.backgroundColor};
      color: ${this.theme.foregroundColor};
      font-family: 'Courier New', monospace;
      font-size: 12px;
      overflow: hidden; /* CRITICAL: Prevent scrollbars */
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
      white-space: pre-wrap;
      word-wrap: break-word;
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
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const output = document.getElementById('output');
    
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
      
      // Auto-scroll to bottom
      output.scrollTop = output.scrollHeight;
      
      // Limit number of lines
      while (output.children.length > ${this.maxLines}) {
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
      
      // Auto-scroll to bottom
      output.scrollTop = output.scrollHeight;
      
      // Limit displayed lines for performance
      while (output.children.length > ${this.maxLines}) {
        output.removeChild(output.firstChild);
      }
    });
    
    ipcRenderer.on('clear-output', () => {
      output.innerHTML = '';
    });
    
    ipcRenderer.on('set-theme', (event, theme) => {
      document.body.style.backgroundColor = theme.backgroundColor;
      document.body.style.color = theme.foregroundColor;
    });
    
    // Add button handlers
    document.getElementById('btn-show-all-cogs').addEventListener('click', () => {
      ipcRenderer.send('show-all-cogs');
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
   */
  protected processMessageImmediate(lineParts: string[] | any): void {
    console.log('[DEBUG LOGGER] processMessageImmediate called with:', lineParts);
    
    // Handle binary data (debugger protocol)
    if (lineParts instanceof Uint8Array) {
      console.log('[DEBUG LOGGER] Processing binary debugger message:', lineParts.length, 'bytes');
      const hexFormatted = this.formatBinaryAsHex(lineParts);
      this.appendMessage(hexFormatted, 'binary-message');
      this.writeToLog(hexFormatted);
    }
    // Handle string array (standard Cog messages)
    else if (Array.isArray(lineParts)) {
      const message = lineParts.join(' ');
      console.log('[DEBUG LOGGER] Processing array message:', message);
      
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
    else if (typeof lineParts === 'string') {
      console.log('[DEBUG LOGGER] Processing string message:', lineParts);
      
      // Check if this is a formatted debugger message
      if (lineParts.includes('=== Initial Debugger Message') || 
          lineParts.includes('=== Debugger Protocol')) {
        this.appendMessage(lineParts, 'debugger-formatted');
      } else {
        this.appendMessage(lineParts, 'cog-message');
      }
      this.writeToLog(lineParts);
    }
    
    // Update status bar
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
        const msgTime = item.timestamp || Date.now();
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
      
      console.log(`[DEBUG LOGGER] Sending batch of ${messages.length} messages to window`);
      this.debugWindow.webContents.send('append-messages-batch', messages);
    } else {
      console.log('[DEBUG LOGGER] Window not available for batch processing');
    }
    
    // If more messages pending, schedule next batch
    if (this.renderQueue.length > 0) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_INTERVAL_MS);
    }
  }

  /**
   * Write message to log file (buffered for performance)
   */
  private writeToLog(message: string): void {
    if (this.logFile) {
      const timestamp = new Date().toISOString();
      this.writeBuffer.push(`[${timestamp}] ${message}\n`);
      
      // Schedule write if not already scheduled
      if (!this.writeTimer) {
        this.writeTimer = setTimeout(() => this.flushWriteBuffer(), this.WRITE_INTERVAL_MS);
      }
      
      // Force flush if buffer is getting large (4KB)
      if (this.writeBuffer.join('').length > 4096) {
        this.flushWriteBuffer();
      }
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
          console.error('Failed to write to log file:', err);
          // Could implement disk full handling here
        }
      });
    }
  }

  /**
   * Log a regular message (public interface for mainWindow)
   */
  public logMessage(message: string): void {
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
    this.theme = DebugLoggerWindow.THEMES[themeName] || DebugLoggerWindow.THEMES.green;
    if (this.debugWindow) {
      this.debugWindow.webContents.send('set-theme', this.theme);
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
    
    // Write separator in log file only if stream is still writable
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      this.logFile.write(`\n=== Output Cleared at ${new Date().toISOString()} ===\n\n`);
    }
  }

  /**
   * Handle DTR reset - close current log and start new one
   */
  public handleDTRReset(): void {
    // Close current log file
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      this.logFile.write(`\n=== DTR Reset at ${new Date().toISOString()} ===\n`);
      this.logFile.end();
      this.logFile = null; // Clear reference after ending
    }
    
    // Clear the display (must be after logFile.end() to avoid write-after-end)
    this.clearOutput();
    
    // Create new log file
    this.initializeLogFile();
    
    // Log system message
    this.logSystemMessage('DTR Reset - New session started');
  }

  /**
   * Close the window and cleanup
   */
  public closeDebugWindow(): void {
    console.log('[DEBUG LOGGER] Closing window and terminating log...');
    
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
      console.log('[DEBUG LOGGER] Log file closed');
    }
    
    // Clear singleton instance
    DebugLoggerWindow.instance = null;
    
    // Clean up the window - check if it's destroyed first
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
      this.debugWindow = null;
    }
    
    console.log('[DEBUG LOGGER] Window closed and log terminated');
  }

  /**
   * Get current log file path
   */
  public getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /**
   * Format binary data as hex dump with Spin-2 notation
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
}