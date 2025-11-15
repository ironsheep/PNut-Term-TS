/** @format */

// src/classes/loggerCOGWin.ts

import { BrowserWindow, ipcMain, dialog } from 'electron';
import { EventEmitter } from 'events';
import { DebugWindowBase } from './debugWindowBase';
import { Context } from '../utils/context';
import { WindowPlacer, PlacementConfig, PlacementStrategy } from '../utils/windowPlacer';
import * as fs from 'fs';
import * as path from 'path';
import { ensureDirExists, getFormattedDateTime } from '../utils/files';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

export interface COGTheme {
  name: string;
  foregroundColor: string;
  backgroundColor: string;
}

/**
 * Debug COG Window - Filtered view of debug logger for a specific COG
 *
 * This is a mini version of the debug logger window that:
 * - Displays messages only from its assigned COG ID (0-7)
 * - Has the same text-based terminal display as debug logger
 * - Shows status bar with log indicator, message counts, connection status
 * - Can export its log on demand and then continue writing to that file
 * - Synchronizes with DTR reset and download events
 * - Switches theme from dormant to active on first message
 *
 * NOT responsible for:
 * - Message classification (WindowRouter handles this)
 * - Serial data parsing
 * - Managing other COG windows
 */
export class LoggerCOGWindow extends DebugWindowBase {
  private cogId: number;
  private theme: COGTheme;

  // Message handling
  private messageCount: number = 0;
  private hasReceivedTraffic: boolean = false;
  private historyBuffer: string[] = [];
  private maxLines: number = 10000; // Will be set from preferences

  // Logging (only after export)
  private logFile: fs.WriteStream | null = null;
  private logFilePath: string | null = null;
  // isLogging is inherited from DebugWindowBase

  // Performance optimizations
  private renderQueue: Array<{ message: string; timestamp: string; className?: string }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private lastFullTimestamp: string | null = null; // Track last full timestamp for abbreviation
  private readonly BATCH_INTERVAL_MS = 16; // 60fps update rate
  private readonly BATCH_SIZE_LIMIT = 100;
  private writeBuffer: string[] = [];
  private writeTimer: NodeJS.Timeout | null = null;
  private readonly WRITE_INTERVAL_MS = 100;

  // Connection status
  private isConnected: boolean = false;
  private lastMessageTime: number = 0;

  // Predefined themes
  private static readonly THEMES = {
    dormant: {
      name: 'dormant',
      foregroundColor: '#888888',
      backgroundColor: '#2d2d30'
    },
    activeGreen: {
      name: 'activeGreen',
      foregroundColor: '#00FF00',
      backgroundColor: '#000000'
    },
    activeAmber: {
      name: 'activeAmber',
      foregroundColor: '#FFBF00',
      backgroundColor: '#000000'
    }
  };

  // Current color theme (green or amber)
  private colorTheme: 'green' | 'amber' = 'green';

  // Track when renderer is ready for IPC messages
  private rendererReady: boolean = false;

  constructor(
    cogId: number,
    params: {
      context: Context;
      windowId?: string;
    }
  ) {
    const windowId = params.windowId || `COG-${cogId}`;
    super(params.context, windowId, 'COG');

    // Validate COG ID
    if (cogId < 0 || cogId > 7) {
      throw new Error(`Invalid COG ID: ${cogId}. Must be 0-7`);
    }

    this.cogId = cogId;

    // Log COG window creation
    if (ENABLE_CONSOLE_LOG) console.log(`[COG${cogId}] COG window created and initializing`);

    // Set theme from preferences BEFORE creating window (so HTML gets correct colors)
    if (params.context.preferences?.terminal?.colorTheme) {
      const themeValue = params.context.preferences.terminal.colorTheme;
      if (themeValue.includes('amber')) {
        this.theme = LoggerCOGWindow.THEMES.activeAmber;
        this.colorTheme = 'amber';
        if (ENABLE_CONSOLE_LOG) console.log(`[COG${cogId}] Setting amber theme from preferences`);
      } else {
        this.theme = LoggerCOGWindow.THEMES.activeGreen;
        this.colorTheme = 'green';
        if (ENABLE_CONSOLE_LOG) console.log(`[COG${cogId}] Setting green theme from preferences`);
      }
    } else {
      // Default to dormant theme if no preference
      this.theme = LoggerCOGWindow.THEMES.dormant;
      if (ENABLE_CONSOLE_LOG) console.log(`[COG${cogId}] No theme preference, using dormant`);
    }

    // Load preferences
    this.loadPreferences();

    // Create the window
    this.createDebugWindow();

    // Set up IPC handlers for this specific COG window
    this.setupIPCHandlers();
  }

  /**
   * Get window title (public getter for base class abstract requirement)
   */
  get windowTitle(): string {
    return `COG ${this.cogId} Debug`;
  }

  /**
   * Load user preferences
   */
  private loadPreferences(): void {
    // Get max lines from preferences (same as debug logger uses)
    // TODO: Add maxLogLines to UserPreferences interface when needed
    // const preferences = this.context.preferences;
    // if (preferences && preferences.maxLogLines) {
    //   this.maxLines = preferences.maxLogLines;
    // }
  }

  /**
   * Create the actual Electron window
   */
  private createWindow(): BrowserWindow {
    // Default window dimensions for COG windows
    const defaultWidth = 600;
    const defaultHeight = 400;

    // Use WindowPlacer with COG_GRID strategy for proper 4x2 layout
    const windowPlacer = WindowPlacer.getInstance();
    const placementConfig: PlacementConfig = {
      dimensions: { width: defaultWidth, height: defaultHeight },
      strategy: PlacementStrategy.COG_GRID,
      margin: 20
    };

    // Get position for this COG window (windowPlacer handles the 4x2 grid layout)
    const windowId = `COG-${this.cogId}`;
    const position = windowPlacer.getNextPosition(windowId, placementConfig);

    // Extract actual window dimensions from windowPlacer calculation
    const windowWidth = defaultWidth;
    const windowHeight = defaultHeight;

    const window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: position.x,
      y: position.y,
      title: `COG ${this.cogId} Debug`,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false
      },
      backgroundColor: this.theme.backgroundColor,
      show: false, // Will show when ready
      alwaysOnTop: false,
      resizable: true,
      minimizable: true,
      closable: true
    });

    // Load HTML content
    const html = this.generateHTML();
    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Show when ready and mark renderer ready for IPC
    window.once('ready-to-show', () => {
      if (!window.isDestroyed()) {
        window.show();
        this.rendererReady = true;
        this.logCOGMessage(`COG ${this.cogId} window opened and renderer ready`);

        // Send current theme to renderer now that it's ready
        if (this.theme) {
          window.webContents.send(`cog-${this.cogId}-set-theme`, this.theme);
          this.logCOGMessage(`COG ${this.cogId} theme sent to renderer: ${this.theme.name}`);
        }
      }
    });

    // Handle window close
    window.on('closed', () => {
      this.onWindowClosed();
    });

    // Register window with WindowPlacer for position tracking
    windowPlacer.registerWindow(windowId, window);

    // Set the window in the base class
    this.debugWindow = window;

    return window;
  }

  /**
   * Set up IPC handlers for this COG window
   */
  private setupIPCHandlers(): void {
    // Remove any existing handler first (in case of re-creation)
    this.cleanupIPCHandlers();

    // Export handler for this specific COG
    ipcMain.handle(`export-cog-${this.cogId}`, async () => {
      return await this.exportLog();
    });
  }

  /**
   * Clean up IPC handlers
   */
  private cleanupIPCHandlers(): void {
    // Remove the export handler for this COG
    ipcMain.removeHandler(`export-cog-${this.cogId}`);
  }

  /**
   * Generate HTML content for COG window
   */
  private generateHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>COG ${this.cogId} Debug</title>
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
      justify-content: center;
      padding: 0 10px;
      font-size: 13px;
      z-index: 100;
    }
    #menu-bar button {
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
      font-size: 11px;
      color: #000000;
    }
    .status-field {
      margin-right: 15px;
      display: flex;
      align-items: center;
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
      margin-top: 42px; /* Space for menu bar */
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
    }
    .binary-message {
      color: #00FFFF;  /* Cyan for binary hex dumps */
      font-family: 'Courier New', monospace;
    }
    .debugger-formatted {
      color: #FFD700;  /* Gold for formatted debugger messages */
      font-family: 'Courier New', monospace;
      white-space: pre;
      background-color: #1a1a1a;
      padding: 2px 4px;
      margin: 2px 0;
      border-left: 3px solid #FFD700;
    }
    .timestamp {
      color: #606060;
      font-size: 10px;
      font-family: 'Courier New', monospace;
      display: inline-block;
      width: 16ch;
      flex-shrink: 0;
      text-align: left;
      margin-right: 1ch;
    }
    /* Theme classes */
    body.dormant {
      background-color: #2d2d30;
    }
    body.dormant #output {
      background-color: #2d2d30;
    }
    body.dormant .cog-message {
      color: #888888;
    }
    body.active {
      background-color: #000000;
    }
    body.active #output {
      background-color: #000000;
    }
    body.active .cog-message {
      color: ${this.colorTheme === 'amber' ? '#FFBF00' : '#00FF00'};
    }
    .cog-identifier {
      color: #FFD700;
      font-weight: bold;
      margin-right: 8px;
    }
  </style>
</head>
<body class="dormant">
  <div id="menu-bar">
    <button id="btn-export-log">Export COG ${this.cogId} Log</button>
  </div>
  <div id="output"></div>
  <div id="status-bar">
    <div class="status-field">
      <span class="status-label">Log:</span>
      <span class="status-value" id="log-filename">None</span>
    </div>
    <div class="status-field">
      <span class="status-label">Messages:</span>
      <span class="status-value" id="message-count">0</span>
    </div>
    <div class="status-field">
      <span class="status-label">Status:</span>
      <span class="status-value" id="connection-status">Disconnected</span>
    </div>
    <div class="status-field">
      <span class="status-label">Theme:</span>
      <span class="status-value" id="theme-status">Dormant</span>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const output = document.getElementById('output');
    const cogId = ${this.cogId};

    // Status bar elements
    const logFilenameEl = document.getElementById('log-filename');
    const messageCountEl = document.getElementById('message-count');
    const connectionStatusEl = document.getElementById('connection-status');
    const themeStatusEl = document.getElementById('theme-status');

    let messageCount = 0;
    let autoScroll = true;
    let maxDOMLines = 1500; // DOM performance limit

    // Export button handler
    document.getElementById('btn-export-log').addEventListener('click', async () => {
      const result = await ipcRenderer.invoke('export-cog-' + cogId);
      if (result && result.success) {
        logFilenameEl.textContent = result.filename;
      }
    });

    // Message handler
    ipcRenderer.on('cog-' + cogId + '-message', (event, data) => {
      const line = document.createElement('div');
      line.className = data.className || 'cog-message';

      // Add timestamp if provided
      if (data.timestamp) {
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = data.timestamp;
        line.appendChild(timestamp);
      }

      // Add message content
      const content = document.createElement('span');
      content.textContent = data.message;
      line.appendChild(content);

      output.appendChild(line);

      // Update message count
      messageCount++;
      messageCountEl.textContent = messageCount;

      // Switch to active theme on first message
      if (messageCount === 1) {
        document.body.classList.remove('dormant');
        document.body.classList.add('active');
        themeStatusEl.textContent = 'Active';
      }

      // Auto-scroll to bottom
      if (autoScroll) {
        output.scrollTop = output.scrollHeight;
      }

      // Manage DOM size for performance
      while (output.children.length > maxDOMLines) {
        output.removeChild(output.firstChild);
      }
    });

    // Batch message handler for performance
    ipcRenderer.on('cog-' + cogId + '-messages-batch', (event, messages) => {
      const fragment = document.createDocumentFragment();

      messages.forEach(data => {
        const line = document.createElement('div');
        line.className = data.className || 'cog-message';

        if (data.timestamp) {
          const timestamp = document.createElement('span');
          timestamp.className = 'timestamp';
          timestamp.textContent = data.timestamp;
          line.appendChild(timestamp);
        }

        const content = document.createElement('span');
        content.textContent = data.message;
        line.appendChild(content);

        fragment.appendChild(line);
        messageCount++;
      });

      output.appendChild(fragment);
      messageCountEl.textContent = messageCount;

      // Switch theme on first message
      if (messageCount > 0 && document.body.classList.contains('dormant')) {
        document.body.classList.remove('dormant');
        document.body.classList.add('active');
        themeStatusEl.textContent = 'Active';
      }

      if (autoScroll) {
        output.scrollTop = output.scrollHeight;
      }

      // Manage DOM size
      while (output.children.length > maxDOMLines) {
        output.removeChild(output.firstChild);
      }
    });

    // Clear handler (DTR reset or download)
    ipcRenderer.on('cog-' + cogId + '-clear', (event, reason) => {
      // Clear display but keep theme if had messages
      const wasActive = messageCount > 0;

      output.innerHTML = '';
      messageCount = 0;
      messageCountEl.textContent = '0';

      // Add system message about the clear
      const line = document.createElement('div');
      line.className = 'system-message';
      line.textContent = reason || 'Display cleared';
      output.appendChild(line);

      // Keep active theme if we had messages before
      if (!wasActive) {
        document.body.classList.add('dormant');
        document.body.classList.remove('active');
        themeStatusEl.textContent = 'Dormant';
      }
    });

    // Connection status updates
    ipcRenderer.on('cog-' + cogId + '-connection-status', (event, status) => {
      connectionStatusEl.textContent = status.connected ? 'Connected' : 'Disconnected';
    });

    // Log file status updates
    ipcRenderer.on('cog-' + cogId + '-log-status', (event, status) => {
      logFilenameEl.textContent = status.filename || 'None';
    });

    // Theme updates
    ipcRenderer.on('cog-' + cogId + '-set-theme', (event, theme) => {
      // Update CSS custom properties or body classes based on theme
      // Theme has foregroundColor and backgroundColor
      const style = document.documentElement.style;
      style.setProperty('--active-fg-color', theme.foregroundColor);
      style.setProperty('--active-bg-color', theme.backgroundColor);

      // Update active theme colors in CSS
      document.body.style.setProperty('--cog-message-color', theme.foregroundColor);
    });

    // Scroll handling
    output.addEventListener('scroll', function() {
      const scrollThreshold = 50;
      const nearBottom = (output.scrollTop + output.clientHeight) >= (output.scrollHeight - scrollThreshold);
      autoScroll = nearBottom;
    });
  </script>
</body>
</html>`;
  }

  /**
   * Process incoming message for this COG
   */
  public processMessage(message: string | Uint8Array, timestamp?: string): void {
    // CRITICAL PERFORMANCE FIX: Early exit if window is destroyed
    // This prevents wasting CPU on closed/invisible windows
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      return; // Don't waste CPU processing messages for closed windows
    }

    let displayMessage: string;
    let className = 'cog-message';

    // DEFENSIVE: Check if we received binary data that should be text
    if (message instanceof Uint8Array) {
      if (ENABLE_CONSOLE_LOG) console.warn(`[COG${this.cogId}] WARNING: Received binary data instead of text`);

      if (this.isASCIIData(message)) {
        // Valid ASCII - decode as text
        displayMessage = new TextDecoder().decode(message);
      } else {
        // Binary data misclassified - display defensively
        displayMessage = this.formatBinaryAsHexFallback(message);
        className = 'binary-message';
      }
    } else {
      displayMessage = message;
    }

    // Log message arrival for debugging
    if (ENABLE_CONSOLE_LOG) console.log(`[COG${this.cogId}] Received message: "${displayMessage}"`);

    // Add to history buffer
    this.historyBuffer.push(displayMessage);
    if (this.historyBuffer.length > this.maxLines) {
      // Remove oldest 10% when buffer is full
      const removeCount = Math.floor(this.maxLines * 0.1);
      this.historyBuffer.splice(0, removeCount);
    }

    // Track first message for theme switching
    const wasFirstMessage = !this.hasReceivedTraffic;
    if (wasFirstMessage) {
      this.hasReceivedTraffic = true;
      this.switchToActiveTheme();
    }

    this.messageCount++;
    this.lastMessageTime = Date.now();

    // Generate timestamp in Debug Logger format
    const displayTimestamp = this.formatTimestamp(timestamp ? new Date(timestamp) : new Date());

    // Add to render queue
    this.renderQueue.push({
      message: displayMessage,
      timestamp: displayTimestamp,
      className: className
    });

    // Schedule batch render
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushRenderQueue(), this.BATCH_INTERVAL_MS);
    }

    // Write to log file
    if (this.logFile) {
      this.writeToLog(`${timestamp || new Date().toISOString()} ${displayMessage}\n`);
    }
  }

  /**
   * Flush render queue to window
   */
  private flushRenderQueue(): void {
    if (this.renderQueue.length === 0) {
      this.batchTimer = null;
      return;
    }

    // Send batch to window
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      if (this.renderQueue.length === 1) {
        // Single message - send and remove from queue
        this.debugWindow.webContents.send(`cog-${this.cogId}-message`, this.renderQueue[0]);
        this.renderQueue.shift(); // Remove the sent message
      } else {
        // Batch of messages - splice removes them from queue as it returns them
        const batch = this.renderQueue.splice(0, this.BATCH_SIZE_LIMIT);
        this.debugWindow.webContents.send(`cog-${this.cogId}-messages-batch`, batch);
      }
    } else {
      // Window not available, clear queue to avoid memory buildup
      this.renderQueue = [];
    }

    // Clear timer
    this.batchTimer = null;

    // Schedule next batch if there are remaining messages in queue
    if (this.renderQueue.length > 0) {
      this.batchTimer = setTimeout(() => this.flushRenderQueue(), this.BATCH_INTERVAL_MS);
    }
  }

  /**
   * Switch window to active theme (uses current color theme: green or amber)
   */
  private switchToActiveTheme(): void {
    this.theme = this.colorTheme === 'amber' ? LoggerCOGWindow.THEMES.activeAmber : LoggerCOGWindow.THEMES.activeGreen;

    // Send theme update to renderer only if renderer is ready
    if (this.debugWindow && !this.debugWindow.isDestroyed() && this.rendererReady) {
      this.debugWindow.webContents.send(`cog-${this.cogId}-set-theme`, this.theme);
    }
  }

  /**
   * Handle DTR reset event
   */
  public handleDTRReset(): void {
    this.clearDisplay('DTR Reset - Log restarted');

    // Write to log file if logging
    if (this.logFile) {
      this.writeToLog(`\n=== DTR Reset at ${new Date().toISOString()} ===\n\n`);
    }
  }

  /**
   * Handle download event
   */
  public handleDownload(): void {
    this.clearDisplay('Code downloaded - Log restarted');

    // Write to log file if logging
    if (this.logFile) {
      this.writeToLog(`\n=== Code Downloaded at ${new Date().toISOString()} ===\n\n`);
    }
  }

  /**
   * Clear display with optional reason
   */
  private clearDisplay(reason?: string): void {
    // Clear history buffer
    this.historyBuffer = [];
    this.messageCount = 0;

    // Send clear command to window
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send(`cog-${this.cogId}-clear`, reason);
    }
  }

  /**
   * Export log to file
   */
  private async exportLog(): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      // Show save dialog
      const result = await dialog.showSaveDialog(this.debugWindow!, {
        title: `Export COG ${this.cogId} Log`,
        defaultPath: path.join(this.context.getLogDirectory(), `debug_cog${this.cogId}_${getFormattedDateTime()}.log`),
        filters: [
          { name: 'Log Files', extensions: ['log'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false };
      }

      // Ensure directory exists
      ensureDirExists(path.dirname(result.filePath));

      // Create write stream
      this.logFilePath = result.filePath;
      this.logFile = fs.createWriteStream(this.logFilePath, { flags: 'a' });

      // Write header
      const header = [
        `=== COG ${this.cogId} Debug Log ===`,
        `Exported: ${new Date().toISOString()}`,
        `Total Messages: ${this.messageCount}`,
        '='.repeat(40),
        ''
      ].join('\n');

      this.logFile.write(header);

      // Write all buffered messages
      for (const message of this.historyBuffer) {
        this.logFile.write(message + '\n');
      }

      // Update status bar
      if (this.debugWindow && !this.debugWindow.isDestroyed()) {
        this.debugWindow.webContents.send(`cog-${this.cogId}-log-status`, {
          filename: path.basename(this.logFilePath)
        });
      }

      this.logCOGMessage(`COG ${this.cogId} log exported to ${path.basename(this.logFilePath)}`);

      return {
        success: true,
        filename: path.basename(this.logFilePath)
      };
    } catch (error) {
      console.error(`Failed to export COG ${this.cogId} log:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Write to log file with buffering
   */
  private writeToLog(data: string): void {
    if (!this.logFile) return;

    this.writeBuffer.push(data);

    if (!this.writeTimer) {
      this.writeTimer = setTimeout(() => this.flushWriteBuffer(), this.WRITE_INTERVAL_MS);
    }
  }

  /**
   * Flush write buffer to disk
   */
  private flushWriteBuffer(): void {
    if (this.writeBuffer.length === 0 || !this.logFile) {
      this.writeTimer = null;
      return;
    }

    const data = this.writeBuffer.join('');
    this.writeBuffer = [];

    this.logFile.write(data, (err) => {
      if (err) {
        console.error(`COG ${this.cogId} log write error:`, err);
      }
    });

    this.writeTimer = null;
  }

  /**
   * Update connection status
   */
  public updateConnectionStatus(connected: boolean): void {
    this.isConnected = connected;

    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send(`cog-${this.cogId}-connection-status`, {
        connected: connected
      });
    }
  }

  /**
   * Handle window close
   */
  private onWindowClosed(): void {
    // Flush any pending renders
    if (this.renderQueue.length > 0) {
      this.flushRenderQueue();
    }

    // Flush write buffer and close log file
    if (this.logFile) {
      this.flushWriteBuffer();
      this.logFile.close();
      this.logFile = null;
    }

    // Clear timers
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    // Clean up IPC handlers
    this.cleanupIPCHandlers();

    // Unregister from router BEFORE emitting close event
    this.unregisterFromRouter();

    // Emit close event
    this.emit('closed', this.cogId);

    // Clean up
    this.debugWindow = null;
  }

  /**
   * Close the window
   */
  public close(): void {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
    }
  }

  /**
   * Check if window is open
   */
  public isOpen(): boolean {
    return this.debugWindow !== null && !this.debugWindow.isDestroyed();
  }

  /**
   * Get window reference
   */
  public getWindow(): BrowserWindow | null {
    return this.debugWindow;
  }

  /**
   * Get COG ID
   */
  public getCogId(): number {
    return this.cogId;
  }

  /**
   * Format timestamp using Debug Logger's abbreviated format
   */
  private formatTimestamp(date: Date): string {
    // Get all time components
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const millis = date.getMilliseconds();

    // Use performance counter for microsecond precision
    const perfMicros = Math.floor((performance.now() * 1000) % 1000);
    const microString = `${millis.toString().padStart(3, '0')}${perfMicros.toString().padStart(3, '0')}`;

    let timestamp: string;

    // Check what parts changed from last timestamp
    const lastHours = this.lastFullTimestamp ? this.lastFullTimestamp.substring(0, 2) : '';
    const lastMinutes = this.lastFullTimestamp ? this.lastFullTimestamp.substring(3, 5) : '';
    const lastSeconds = this.lastFullTimestamp ? this.lastFullTimestamp.substring(6, 8) : '';

    const currentFull = `${hours}:${minutes}:${seconds}`;

    if (hours !== lastHours || !this.lastFullTimestamp) {
      // Hour changed or first message - show full timestamp
      timestamp = `${hours}:${minutes}:${seconds}.${microString}`;
    } else if (minutes !== lastMinutes) {
      // Minute changed - blank out hour
      timestamp = `   ${minutes}:${seconds}.${microString}`;
    } else if (seconds !== lastSeconds) {
      // Just seconds changed - blank out hour:minute
      timestamp = `      ${seconds}.${microString}`;
    } else {
      // Same second - just show microseconds with spaces for alignment
      timestamp = `        .${microString}`;
    }

    this.lastFullTimestamp = currentFull;
    return timestamp;
  }

  /**
   * Check if binary data is valid ASCII (defensive display)
   */
  private isASCIIData(data: Uint8Array): boolean {
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      // Allow printable ASCII (32-126) and common whitespace (9, 10, 13)
      if (!(byte >= 32 && byte <= 126) && byte !== 9 && byte !== 10 && byte !== 13) {
        return false;
      }
    }
    return true;
  }

  /**
   * Format binary data as hex fallback (when misclassified as COG message)
   */
  private formatBinaryAsHexFallback(data: Uint8Array): string {
    if (data.length === 0) return '[BINARY: empty]';

    const lines: string[] = [];
    const bytesPerLine = 16;

    lines.push(`[ROUTING ERROR: Binary data in COG ${this.cogId} message - ${data.length} bytes]`);

    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes: string[] = [];
      const asciiBytes: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, data.length);

      for (let i = offset; i < endOffset; i++) {
        const hex = data[i].toString(16).padStart(2, '0').toUpperCase();
        lineBytes.push(hex);

        const byte = data[i];
        if (byte >= 32 && byte <= 126) {
          asciiBytes.push(String.fromCharCode(byte));
        } else {
          asciiBytes.push('.');
        }
      }

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
   * Get statistics
   */
  public getStatistics(): any {
    return {
      cogId: this.cogId,
      messageCount: this.messageCount,
      hasTraffic: this.hasReceivedTraffic,
      bufferSize: this.historyBuffer.length,
      isLogging: true,
      logFile: this.logFilePath ? path.basename(this.logFilePath) : null,
      isOpen: this.isOpen()
    };
  }

  /**
   * Get history buffer (for export)
   */
  public getHistoryBuffer(): string[] {
    return this.historyBuffer;
  }

  /**
   * Set color theme (green or amber)
   * Updates the active theme colors and sends to renderer if window is active
   */
  public setTheme(themeName: 'green' | 'amber'): void {
    this.colorTheme = themeName;

    // Apply the requested color theme immediately, regardless of traffic state
    // User explicitly set a color preference, so honor it from window creation
    this.theme = themeName === 'amber' ? LoggerCOGWindow.THEMES.activeAmber : LoggerCOGWindow.THEMES.activeGreen;

    // Send theme update to renderer only if renderer is ready
    if (this.debugWindow && !this.debugWindow.isDestroyed() && this.rendererReady) {
      this.debugWindow.webContents.send(`cog-${this.cogId}-set-theme`, this.theme);
    }
    // If renderer not ready, theme will be sent when ready-to-show fires
  }

  /**
   * Log message to console (COG-specific)
   */
  private logCOGMessage(message: string): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(`[COG ${this.cogId}] ${message}`);
    }
  }

  /**
   * Implement abstract method from DebugWindowBase
   */
  protected createDebugWindow(): BrowserWindow {
    // This is already implemented above as createWindow()
    // We'll call the existing implementation
    return this.createWindow();
  }

  /**
   * Implement abstract method from DebugWindowBase
   */
  public closeDebugWindow(): void {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
    }
  }

  /**
   * Implement abstract method from DebugWindowBase
   */
  public async processMessageImmediate(message: any): Promise<void> {
    this.processMessage(message);
  }

  /**
   * Implement abstract method from DebugWindowBase
   */
  public getCanvasId(): string {
    return `cog-${this.cogId}-canvas`;
  }
}
