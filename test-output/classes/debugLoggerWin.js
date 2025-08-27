"use strict";
/** @format */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugLoggerWindow = void 0;
// src/classes/debugLoggerWin.ts
var electron_1 = require("electron");
var debugWindowBase_1 = require("./debugWindowBase");
var fs = require("fs");
var path = require("path");
var files_1 = require("../utils/files");
var messageExtractor_1 = require("./shared/messageExtractor");
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
var DebugLoggerWindow = /** @class */ (function (_super) {
    __extends(DebugLoggerWindow, _super);
    function DebugLoggerWindow(context) {
        // Call parent with a fixed name since this is a singleton
        var _this = _super.call(this, context, 'DebugLogger', 'logger') || this;
        _this.logFile = null;
        _this.logFilePath = null;
        _this.maxLines = 10000;
        _this.lineBuffer = [];
        // Performance optimizations for 2Mbps handling
        _this.renderQueue = [];
        _this.batchTimer = null;
        _this.BATCH_INTERVAL_MS = 16; // 60fps update rate
        _this.BATCH_SIZE_LIMIT = 100; // Max messages per batch
        _this.writeBuffer = [];
        _this.writeTimer = null;
        _this.WRITE_INTERVAL_MS = 100; // Flush to disk every 100ms
        // High-resolution timestamp tracking
        _this.sessionStartTime = performance.now();
        _this.lastMessageTime = 0;
        _this.lastFullTimestamp = '';
        // Default to green theme
        _this.theme = DebugLoggerWindow.THEMES.green;
        // Create the window but DON'T show it yet
        _this.debugWindow = _this.createDebugWindow();
        // Window will be shown in the 'ready-to-show' event handler
        // CRITICAL: Register with router IMMEDIATELY so we don't lose messages
        // The Debug Logger is special - it needs to capture ALL messages from the start
        console.log('[DEBUG LOGGER] Registering with WindowRouter immediately...');
        try {
            _this.registerWithRouter();
            console.log('[DEBUG LOGGER] Successfully registered with WindowRouter (immediate)');
        }
        catch (error) {
            console.error('[DEBUG LOGGER] Failed to register immediately:', error);
            // Try again after a short delay
            setTimeout(function () {
                console.log('[DEBUG LOGGER] Retry registration after 100ms...');
                try {
                    _this.registerWithRouter();
                    console.log('[DEBUG LOGGER] Successfully registered with WindowRouter (retry)');
                }
                catch (err) {
                    console.error('[DEBUG LOGGER] Failed to register on retry:', err);
                }
            }, 100);
        }
        // Initialize log file after window is created
        // This ensures MainWindow has time to set up event listeners
        setTimeout(function () {
            _this.initializeLogFile();
        }, 100);
        // Mark as ready so messages aren't queued
        _this.isWindowReady = true;
        // Process any messages that might have been queued
        if (_this.messageQueue && _this.messageQueue.length > 0) {
            var queue = _this.messageQueue;
            _this.messageQueue = [];
            queue.forEach(function (msg) { return _this.processMessageImmediate(msg); });
        }
        return _this;
    }
    /**
     * Get the canvas ID for this window (required by base class)
     */
    DebugLoggerWindow.prototype.getCanvasId = function () {
        return 'debugLoggerCanvas';
    };
    /**
     * Get or create the singleton instance
     */
    DebugLoggerWindow.getInstance = function (context) {
        if (!DebugLoggerWindow.instance) {
            DebugLoggerWindow.instance = new DebugLoggerWindow(context);
        }
        return DebugLoggerWindow.instance;
    };
    /**
     * Initialize log file for capturing debug output
     */
    DebugLoggerWindow.prototype.initializeLogFile = function () {
        try {
            // Create logs directory
            var logsDir = path.join(process.cwd(), 'logs');
            (0, files_1.ensureDirExists)(logsDir);
            // Generate timestamped filename
            var timestamp = (0, files_1.getFormattedDateTime)();
            var basename = 'debug';
            this.logFilePath = path.join(logsDir, "".concat(basename, "_").concat(timestamp, "_debug.log"));
            // Create write stream
            this.logFile = fs.createWriteStream(this.logFilePath, { flags: 'a' });
            // Write header
            this.logFile.write("=== Debug Logger Session Started at ".concat(new Date().toISOString(), " ===\n"));
            this.logFile.write("Program: ".concat(basename, "\n"));
            this.logFile.write("=====================================\n\n");
            // Notify MainWindow that logging started
            this.notifyLoggingStatus(true);
        }
        catch (error) {
            this.logMessage("Failed to initialize log file: ".concat(error));
            // Fall back to console logging only
            this.notifyLoggingStatus(false);
        }
    };
    /**
     * Notify MainWindow of logging status changes
     */
    DebugLoggerWindow.prototype.notifyLoggingStatus = function (isLogging) {
        try {
            // Emit event that MainWindow can listen for
            this.emit('loggingStatusChanged', {
                isLogging: isLogging,
                filename: this.logFilePath ? path.basename(this.logFilePath) : null,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Failed to notify logging status:', error);
        }
    };
    /**
     * Create the actual Electron window
     */
    DebugLoggerWindow.prototype.createDebugWindow = function () {
        var _this = this;
        // Window dimensions - 80x24 terminal size (80 cols x 24 rows)
        // Assuming 10px per character width, 18px per line height
        var charWidth = 10;
        var lineHeight = 18;
        var windowWidth = (80 * charWidth) + 20; // 80 chars + padding
        var windowHeight = (24 * lineHeight) + 50; // 24 lines + status bar
        // Use WindowPlacer for intelligent positioning
        // For now, let's use a simpler approach to ensure it appears
        var screen = require('electron').screen;
        var primaryDisplay = screen.getPrimaryDisplay();
        var _a = primaryDisplay.workAreaSize, width = _a.width, height = _a.height;
        // Position at bottom-right with margin
        var margin = 20;
        var position = {
            x: width - windowWidth - margin,
            y: height - windowHeight - margin
        };
        console.log("[DEBUG LOGGER] Positioning at bottom-right: ".concat(position.x, ", ").concat(position.y));
        var window = new electron_1.BrowserWindow({
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
        var html = this.generateHTML();
        window.loadURL("data:text/html;charset=utf-8,".concat(encodeURIComponent(html)));
        // Set up IPC handlers for menu buttons
        electron_1.ipcMain.on('show-all-cogs', function () {
            console.log('[DEBUG LOGGER] Show All COGs button clicked');
            // Emit event that MainWindow can listen to
            _this.emit('show-all-cogs-requested');
        });
        electron_1.ipcMain.on('export-cog-logs', function () {
            console.log('[DEBUG LOGGER] Export Active COG Logs button clicked');
            // TODO: Implement COG log export functionality
            // This will use COGLogExporter to save all active COG logs
            _this.emit('export-cog-logs-requested');
        });
        // Use did-finish-load instead of ready-to-show (more reliable with data URLs)
        console.log('[DEBUG LOGGER] Setting up did-finish-load event handler...');
        window.webContents.once('did-finish-load', function () {
            console.log('[DEBUG LOGGER] Window did-finish-load event fired!');
            window.show();
            window.focus(); // Also focus the window
            console.log('[DEBUG LOGGER] Window shown and focused');
            // Window is now ready for content
            _this.logMessage('Debug Logger window ready');
            // Don't register again - we already did it in the constructor
            // Just verify we're still registered
            var router = _this.windowRouter;
            var activeWindows = router.getActiveWindows();
            var loggerWindow = activeWindows.find(function (w) { return w.windowType === 'logger'; });
            if (loggerWindow) {
                console.log('[DEBUG LOGGER] Verified still registered:', loggerWindow.windowId);
            }
            else {
                console.error('[DEBUG LOGGER] ❌ Registration was lost! Re-registering...');
                try {
                    _this.registerWithRouter();
                    console.log('[DEBUG LOGGER] Re-registered successfully');
                }
                catch (error) {
                    console.error('[DEBUG LOGGER] ❌ Re-registration failed:', error);
                }
            }
        });
        // Handle window close event
        window.on('close', function () {
            console.log('[DEBUG LOGGER] Window being closed by user');
            // Don't call closeDebugWindow here - it would cause infinite recursion
            // Just clean up resources directly
            // Flush any pending messages
            if (_this.batchTimer) {
                clearTimeout(_this.batchTimer);
                _this.processBatch();
            }
            // Flush any pending writes
            if (_this.writeTimer) {
                clearTimeout(_this.writeTimer);
                _this.flushWriteBuffer();
            }
            // Close log file
            if (_this.logFile && !_this.logFile.destroyed && _this.logFile.writable) {
                _this.logFile.write("\n=== Debug Logger Session Ended at ".concat(new Date().toISOString(), " ===\n"));
                _this.logFile.end();
                _this.logFile = null;
            }
            // Clear singleton instance
            DebugLoggerWindow.instance = null;
            // Mark window as null to prevent further operations
            _this.debugWindow = null;
        });
        return window;
    };
    /**
     * Generate HTML for the debug logger window
     */
    DebugLoggerWindow.prototype.generateHTML = function () {
        return "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <title>Debug Logger</title>\n  <style>\n    body {\n      margin: 0;\n      padding: 42px 10px 32px 10px; /* Top space for menu bar, bottom for status bar */\n      background-color: ".concat(this.theme.backgroundColor, ";\n      color: ").concat(this.theme.foregroundColor, ";\n      font-family: 'Courier New', monospace;\n      font-size: 12px;\n      overflow: hidden; /* CRITICAL: Prevent scrollbars */\n    }\n    #menu-bar {\n      position: fixed;\n      top: 0;\n      left: 0;\n      right: 0;\n      height: 32px;\n      background-color: #f0f0f0;\n      border-bottom: 1px solid #d0d0d0;\n      display: flex;\n      align-items: center;\n      padding: 0 10px;\n      font-size: 13px;\n      z-index: 100;\n    }\n    #menu-bar button {\n      margin-right: 10px;\n      padding: 4px 12px;\n      background-color: #fff;\n      border: 1px solid #ccc;\n      border-radius: 3px;\n      cursor: pointer;\n      font-size: 12px;\n    }\n    #menu-bar button:hover {\n      background-color: #e8e8e8;\n    }\n    #status-bar {\n      position: fixed;\n      bottom: 0;\n      left: 0;\n      right: 0;\n      height: 28px;\n      background-color: #e8e8e8;\n      border-top: 1px solid #b8b8b8;\n      display: flex;\n      align-items: center;\n      padding: 0 10px;\n      font-size: 13px;\n      color: #000000;\n    }\n    .status-field {\n      margin-right: 20px;\n    }\n    .status-label {\n      color: #333333;\n      margin-right: 5px;\n      font-weight: 500;\n    }\n    .status-value {\n      color: #000000;\n    }\n    #output {\n      white-space: pre-wrap;\n      word-wrap: break-word;\n    }\n    #output > div {\n      display: flex;\n      align-items: baseline;\n    }\n    .cog-message {\n      color: ").concat(this.theme.foregroundColor, ";\n    }\n    .system-message {\n      color: #808080;\n      font-style: italic;\n    }\n    .binary-message {\n      color: #00FFFF;  /* Cyan for binary hex dumps */\n      font-family: 'Courier New', monospace;\n    }\n    .debugger-formatted {\n      color: #FFD700;  /* Gold for formatted debugger messages */\n      font-family: 'Courier New', monospace;\n      white-space: pre;  /* Preserve formatting */\n      background-color: #1a1a1a;\n      padding: 2px 4px;\n      margin: 2px 0;\n      border-left: 3px solid #FFD700;\n    }\n    .timestamp {\n      color: #606060;\n      font-size: 10px;\n      font-family: 'Courier New', monospace;  /* Monospace for perfect alignment */\n      display: inline-block;\n      width: 16ch;  /* Fixed width for HH:MM:SS.mmmmmm format - ALWAYS */\n      flex-shrink: 0;\n      text-align: left;\n      margin-right: 1ch;  /* Small gap before debug text */\n    }\n  </style>\n</head>\n<body>\n  <div id=\"menu-bar\">\n    <button id=\"btn-show-all-cogs\">Show All 8 COGs</button>\n    <button id=\"btn-export-cog-logs\">Export Active COG Logs</button>\n  </div>\n  <div id=\"output\"></div>\n  <div id=\"status-bar\">\n    <div class=\"status-field\">\n      <span class=\"status-label\">Log:</span>\n      <span class=\"status-value\" id=\"log-filename\">No file</span>\n    </div>\n    <div class=\"status-field\">\n      <span class=\"status-label\">Lines:</span>\n      <span class=\"status-value\" id=\"line-count\">0</span>\n    </div>\n    <div class=\"status-field\">\n      <span class=\"status-label\">Size:</span>\n      <span class=\"status-value\" id=\"log-size\">0 KB</span>\n    </div>\n  </div>\n  <script>\n    const { ipcRenderer } = require('electron');\n    const output = document.getElementById('output');\n    \n    ipcRenderer.on('append-message', (event, data) => {\n      const line = document.createElement('div');\n      line.className = data.type || 'cog-message';\n      \n      if (data.timestamp) {\n        const timestamp = document.createElement('span');\n        // Add 'short' class for abbreviated timestamps\n        const isShort = data.timestamp.startsWith('.');\n        timestamp.className = isShort ? 'timestamp short' : 'timestamp';\n        timestamp.textContent = data.timestamp;\n        line.appendChild(timestamp);\n      }\n      \n      const content = document.createElement('span');\n      content.textContent = data.message;\n      line.appendChild(content);\n      \n      output.appendChild(line);\n      \n      // Auto-scroll to bottom\n      output.scrollTop = output.scrollHeight;\n      \n      // Limit number of lines\n      while (output.children.length > ").concat(this.maxLines, ") {\n        output.removeChild(output.firstChild);\n      }\n    });\n    \n    // Handle batch messages (performance optimization for 2Mbps)\n    ipcRenderer.on('append-messages-batch', (event, messages) => {\n      const fragment = document.createDocumentFragment();\n      \n      messages.forEach(data => {\n        const line = document.createElement('div');\n        line.className = data.type || 'cog-message';\n        \n        if (data.timestamp) {\n          const timestamp = document.createElement('span');\n          // Add 'short' class for abbreviated timestamps\n          const isShort = data.timestamp.startsWith('.');\n          timestamp.className = isShort ? 'timestamp short' : 'timestamp';\n          timestamp.textContent = data.timestamp;\n          line.appendChild(timestamp);\n        }\n        \n        const content = document.createElement('span');\n        content.textContent = data.message;\n        line.appendChild(content);\n        \n        fragment.appendChild(line);\n      });\n      \n      output.appendChild(fragment);\n      \n      // Auto-scroll to bottom\n      output.scrollTop = output.scrollHeight;\n      \n      // Limit displayed lines for performance\n      while (output.children.length > ").concat(this.maxLines, ") {\n        output.removeChild(output.firstChild);\n      }\n    });\n    \n    ipcRenderer.on('clear-output', () => {\n      output.innerHTML = '';\n    });\n    \n    ipcRenderer.on('set-theme', (event, theme) => {\n      document.body.style.backgroundColor = theme.backgroundColor;\n      document.body.style.color = theme.foregroundColor;\n    });\n    \n    // Add button handlers\n    document.getElementById('btn-show-all-cogs').addEventListener('click', () => {\n      ipcRenderer.send('show-all-cogs');\n    });\n    \n    document.getElementById('btn-export-cog-logs').addEventListener('click', () => {\n      ipcRenderer.send('export-cog-logs');\n    });\n  </script>\n</body>\n</html>");
    };
    /**
     * Process messages immediately (required by base class)
     */
    DebugLoggerWindow.prototype.processMessageImmediate = function (lineParts) {
        console.log('[DEBUG LOGGER] processMessageImmediate called with:', lineParts);
        // Handle binary data (debugger protocol)
        if (lineParts instanceof Uint8Array) {
            console.log('[DEBUG LOGGER] Processing binary debugger message:', lineParts.length, 'bytes');
            var hexFormatted = this.formatBinaryAsHex(lineParts);
            this.appendMessage(hexFormatted, 'binary-message');
            this.writeToLog(hexFormatted);
        }
        // Handle string array (standard Cog messages)
        else if (Array.isArray(lineParts)) {
            var message = lineParts.join(' ');
            console.log('[DEBUG LOGGER] Processing array message:', message);
            // Check if this is a formatted debugger message
            if (message.includes('=== Initial Debugger Message') ||
                message.includes('=== Debugger Protocol')) {
                // This is a formatted debugger message, display with special styling
                this.appendMessage(message, 'debugger-formatted');
                this.writeToLog(message);
            }
            else {
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
            }
            else {
                this.appendMessage(lineParts, 'cog-message');
            }
            this.writeToLog(lineParts);
        }
        // Update status bar
        this.updateStatusBar();
    };
    /**
     * Process message with type information (type-safe handoff)
     */
    DebugLoggerWindow.prototype.processTypedMessage = function (messageType, data) {
        console.log("[DEBUG LOGGER] Processing typed message: ".concat(messageType));
        switch (messageType) {
            case messageExtractor_1.MessageType.DEBUGGER_80BYTE:
                // Binary debugger data - display with proper 80-byte formatting
                if (data instanceof Uint8Array) {
                    var formatted = this.format80ByteDebuggerMessage(data);
                    this.appendMessage(formatted, 'debugger-formatted');
                    this.writeToLog(formatted);
                }
                break;
            case messageExtractor_1.MessageType.DB_PACKET:
                // DB prefix messages - use same hex format as 80-byte
                if (data instanceof Uint8Array) {
                    var formatted = this.format80ByteDebuggerMessage(data);
                    this.appendMessage(formatted, 'debugger-formatted');
                    this.writeToLog(formatted);
                }
                break;
            case messageExtractor_1.MessageType.COG_MESSAGE:
            case messageExtractor_1.MessageType.P2_SYSTEM_INIT:
                // Text data - display as readable text (should go to main console)
                if (Array.isArray(data)) {
                    var message = data.join(' ');
                    this.appendMessage(message, 'cog-message');
                    this.writeToLog(message);
                }
                else if (typeof data === 'string') {
                    this.appendMessage(data, 'cog-message');
                    this.writeToLog(data);
                }
                break;
            case messageExtractor_1.MessageType.TERMINAL_OUTPUT:
                // DEFENSIVE: Check if data is actually ASCII before displaying
                if (data instanceof Uint8Array) {
                    if (this.isASCIIData(data)) {
                        // Convert to string and display
                        var textMessage = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(data);
                        this.appendMessage(textMessage, 'cog-message');
                        this.writeToLog(textMessage);
                    }
                    else {
                        // Binary data misclassified as terminal - display as hex fallback
                        var hexFallback = this.formatBinaryAsHexFallback(data);
                        this.appendMessage(hexFallback, 'binary-message');
                        this.writeToLog(hexFallback);
                    }
                }
                else if (Array.isArray(data)) {
                    var message = data.join(' ');
                    this.appendMessage(message, 'cog-message');
                    this.writeToLog(message);
                }
                else if (typeof data === 'string') {
                    this.appendMessage(data, 'cog-message');
                    this.writeToLog(data);
                }
                break;
            case messageExtractor_1.MessageType.INVALID_COG:
            case messageExtractor_1.MessageType.INCOMPLETE_DEBUG:
                // Error/warning messages
                var errorMsg = Array.isArray(data) ? data.join(' ') :
                    (data instanceof Uint8Array ? new TextDecoder().decode(data) : String(data));
                this.appendMessage("[WARNING] ".concat(errorMsg), 'warning-message');
                this.writeToLog("[WARNING] ".concat(errorMsg));
                break;
            default:
                // Fallback - use safe display with defensive binary check
                if (data instanceof Uint8Array) {
                    if (this.isASCIIData(data)) {
                        var textData = new TextDecoder().decode(data);
                        this.appendMessage("[".concat(messageType, "] ").concat(textData), 'generic-message');
                        this.writeToLog("[".concat(messageType, "] ").concat(textData));
                    }
                    else {
                        var hexData = this.formatBinaryAsHexFallback(data);
                        this.appendMessage("[".concat(messageType, "] ").concat(hexData), 'binary-message');
                        this.writeToLog("[".concat(messageType, "] ").concat(hexData));
                    }
                }
                else {
                    var displayData = Array.isArray(data) ? data.join(' ') : String(data);
                    this.appendMessage("[".concat(messageType, "] ").concat(displayData), 'generic-message');
                    this.writeToLog("[".concat(messageType, "] ").concat(displayData));
                }
        }
        this.updateStatusBar();
    };
    /**
     * Update the status bar with current file info
     */
    DebugLoggerWindow.prototype.updateStatusBar = function () {
        if (!this.debugWindow || this.debugWindow.isDestroyed())
            return;
        // Get log file name
        var logFileName = this.logFilePath ? path.basename(this.logFilePath) : 'No file';
        // Get line count
        var lineCount = this.lineBuffer.length;
        // Get approximate size
        var sizeKB = this.logFilePath && fs.existsSync(this.logFilePath)
            ? (fs.statSync(this.logFilePath).size / 1024).toFixed(1)
            : '0';
        // Send update to renderer
        this.debugWindow.webContents.executeJavaScript("\n      document.getElementById('log-filename').textContent = '".concat(logFileName, "';\n      document.getElementById('line-count').textContent = '").concat(lineCount, "';\n      document.getElementById('log-size').textContent = '").concat(sizeKB, " KB';\n    "));
    };
    /**
     * Append a message to the debug logger window (batched for performance)
     */
    DebugLoggerWindow.prototype.appendMessage = function (message, type) {
        var _this = this;
        if (type === void 0) { type = 'cog-message'; }
        // Add to queue for batched processing with individual timestamps
        this.renderQueue.push({
            message: message,
            className: type,
            timestamp: Date.now() // Capture precise arrival time
        });
        // Also keep in internal buffer
        this.lineBuffer.push(message);
        if (this.lineBuffer.length > this.maxLines) {
            // Remove oldest 10% when buffer is full
            var removeCount = Math.floor(this.maxLines * 0.1);
            this.lineBuffer.splice(0, removeCount);
        }
        // Schedule batch processing if not already scheduled
        if (!this.batchTimer) {
            this.batchTimer = setTimeout(function () { return _this.processBatch(); }, this.BATCH_INTERVAL_MS);
        }
        // Force immediate flush if queue is getting too large
        if (this.renderQueue.length >= this.BATCH_SIZE_LIMIT) {
            this.processBatch();
        }
    };
    /**
     * Process queued messages in batch for performance
     */
    DebugLoggerWindow.prototype.processBatch = function () {
        var _this = this;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        if (this.renderQueue.length === 0)
            return;
        // Take current batch
        var batch = this.renderQueue.splice(0, this.BATCH_SIZE_LIMIT);
        // Send batch to renderer
        if (this.debugWindow && !this.debugWindow.isDestroyed()) {
            // High-resolution timestamps with fixed-width alignment
            // Format: HH:MM:SS.mmmmmm (always 15 chars)
            // Within same second: spaces replace HH:MM:SS for perfect column alignment
            // This creates a clean vertical column for debug text
            var messages = batch.map(function (item, index) {
                var msgTime = item.timestamp || Date.now();
                var d = new Date(msgTime);
                // Get all time components
                var hours = d.getHours().toString().padStart(2, '0');
                var minutes = d.getMinutes().toString().padStart(2, '0');
                var seconds = d.getSeconds().toString().padStart(2, '0');
                var millis = d.getMilliseconds();
                // Use performance counter for microsecond precision
                var perfMicros = Math.floor((performance.now() * 1000) % 1000);
                var microString = "".concat(millis.toString().padStart(3, '0')).concat(perfMicros.toString().padStart(3, '0'));
                var timestamp;
                // Check what parts changed from last timestamp
                var lastHours = _this.lastFullTimestamp ? _this.lastFullTimestamp.substring(0, 2) : '';
                var lastMinutes = _this.lastFullTimestamp ? _this.lastFullTimestamp.substring(3, 5) : '';
                var lastSeconds = _this.lastFullTimestamp ? _this.lastFullTimestamp.substring(6, 8) : '';
                if (index === 0 || hours !== lastHours || minutes !== lastMinutes || seconds !== lastSeconds) {
                    // Something changed - show the changed parts
                    if (hours !== lastHours || index === 0) {
                        // Hour changed or first message - show full timestamp
                        timestamp = "".concat(hours, ":").concat(minutes, ":").concat(seconds, ".").concat(microString);
                    }
                    else if (minutes !== lastMinutes) {
                        // Minute changed - blank out hour
                        timestamp = "   ".concat(minutes, ":").concat(seconds, ".").concat(microString);
                    }
                    else {
                        // Just seconds changed - blank out hour:minute
                        timestamp = "      ".concat(seconds, ".").concat(microString);
                    }
                    _this.lastFullTimestamp = "".concat(hours, ":").concat(minutes, ":").concat(seconds);
                }
                else {
                    // Same second - just show microseconds with spaces for alignment
                    timestamp = "        .".concat(microString);
                }
                return {
                    message: item.message,
                    type: item.className || 'cog-message',
                    timestamp: timestamp
                };
            });
            console.log("[DEBUG LOGGER] Sending batch of ".concat(messages.length, " messages to window"));
            this.debugWindow.webContents.send('append-messages-batch', messages);
        }
        else {
            console.log('[DEBUG LOGGER] Window not available for batch processing');
        }
        // If more messages pending, schedule next batch
        if (this.renderQueue.length > 0) {
            this.batchTimer = setTimeout(function () { return _this.processBatch(); }, this.BATCH_INTERVAL_MS);
        }
    };
    /**
     * Write message to log file (buffered for performance)
     */
    DebugLoggerWindow.prototype.writeToLog = function (message) {
        var _this = this;
        if (this.logFile) {
            var timestamp = new Date().toISOString();
            this.writeBuffer.push("[".concat(timestamp, "] ").concat(message, "\n"));
            // Schedule write if not already scheduled
            if (!this.writeTimer) {
                this.writeTimer = setTimeout(function () { return _this.flushWriteBuffer(); }, this.WRITE_INTERVAL_MS);
            }
            // Force flush if buffer is getting large (4KB)
            if (this.writeBuffer.join('').length > 4096) {
                this.flushWriteBuffer();
            }
        }
    };
    /**
     * Flush write buffer to disk
     */
    DebugLoggerWindow.prototype.flushWriteBuffer = function () {
        if (this.writeTimer) {
            clearTimeout(this.writeTimer);
            this.writeTimer = null;
        }
        if (this.writeBuffer.length > 0 && this.logFile && !this.logFile.destroyed && this.logFile.writable) {
            var data = this.writeBuffer.join('');
            this.writeBuffer = [];
            // Async write with error handling
            this.logFile.write(data, function (err) {
                if (err) {
                    console.error('Failed to write to log file:', err);
                    // Could implement disk full handling here
                }
            });
        }
    };
    /**
     * Log a regular message (public interface for mainWindow)
     */
    DebugLoggerWindow.prototype.logMessage = function (message) {
        // Determine message type based on content
        var messageType = 'cog-message';
        // Check if it's binary hex data
        if (message.startsWith('Cog') && message.includes('0x')) {
            messageType = 'binary-message';
        }
        else if (message.startsWith('[P2 Binary Data')) {
            messageType = 'binary-message';
        }
        this.appendMessage(message, messageType);
        this.writeToLog(message);
    };
    /**
     * Log a system message (different styling)
     */
    DebugLoggerWindow.prototype.logSystemMessage = function (message) {
        this.appendMessage(message, 'system-message');
        this.writeToLog("[SYSTEM] ".concat(message));
    };
    /**
     * Change the theme
     */
    DebugLoggerWindow.prototype.setTheme = function (themeName) {
        this.theme = DebugLoggerWindow.THEMES[themeName] || DebugLoggerWindow.THEMES.green;
        if (this.debugWindow) {
            this.debugWindow.webContents.send('set-theme', this.theme);
        }
    };
    /**
     * Clear the output
     */
    DebugLoggerWindow.prototype.clearOutput = function () {
        if (this.debugWindow) {
            this.debugWindow.webContents.send('clear-output');
        }
        this.lineBuffer = [];
        // Write separator in log file only if stream is still writable
        if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
            this.logFile.write("\n=== Output Cleared at ".concat(new Date().toISOString(), " ===\n\n"));
        }
    };
    /**
     * Handle DTR reset - close current log and start new one
     */
    DebugLoggerWindow.prototype.handleDTRReset = function () {
        // Close current log file
        if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
            this.logFile.write("\n=== DTR Reset at ".concat(new Date().toISOString(), " ===\n"));
            this.logFile.end();
            this.logFile = null; // Clear reference after ending
        }
        // Clear the display (must be after logFile.end() to avoid write-after-end)
        this.clearOutput();
        // Create new log file
        this.initializeLogFile();
        // Log system message
        this.logSystemMessage('DTR Reset - New session started');
    };
    /**
     * Close the window and cleanup
     */
    DebugLoggerWindow.prototype.closeDebugWindow = function () {
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
            this.logFile.write("\n=== Debug Logger Session Ended at ".concat(new Date().toISOString(), " ===\n"));
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
    };
    /**
     * Get current log file path
     */
    DebugLoggerWindow.prototype.getLogFilePath = function () {
        return this.logFilePath;
    };
    /**
     * Check if binary data is valid ASCII (defensive display)
     */
    DebugLoggerWindow.prototype.isASCIIData = function (data) {
        for (var i = 0; i < data.length; i++) {
            var byte = data[i];
            // Allow printable ASCII (32-126), tabs (9), line feeds (10), carriage returns (13)
            if (!(byte >= 32 && byte <= 126) && byte !== 9 && byte !== 10 && byte !== 13) {
                return false;
            }
        }
        return true;
    };
    /**
     * Format 80+ byte debugger messages with proper spacing
     * Format: 4 groups of 8 bytes, pairs of 16 bytes separated by extra space
     */
    DebugLoggerWindow.prototype.format80ByteDebuggerMessage = function (data) {
        if (data.length === 0)
            return 'Cog ? (empty debugger message)';
        var firstByte = data[0];
        var cogId = firstByte <= 0x07 ? firstByte : -1;
        var lines = [];
        var prefix = cogId >= 0
            ? "Cog ".concat(cogId, " ")
            : "INVALID(0x".concat(firstByte.toString(16).toUpperCase(), ") ");
        var indent = ' '.repeat(prefix.length);
        // Process in groups of 16 bytes per line
        for (var offset = 0; offset < data.length; offset += 16) {
            var lineBytes = [];
            var endOffset = Math.min(offset + 16, data.length);
            // First group of 8 bytes
            for (var i = offset; i < Math.min(offset + 8, endOffset); i++) {
                var hex = data[i].toString(16).padStart(2, '0').toUpperCase();
                lineBytes.push("$".concat(hex));
            }
            // Add extra space between pairs of 8 bytes
            if (endOffset > offset + 8) {
                lineBytes.push(' '); // Extra space separator
                // Second group of 8 bytes
                for (var i = offset + 8; i < endOffset; i++) {
                    var hex = data[i].toString(16).padStart(2, '0').toUpperCase();
                    lineBytes.push("$".concat(hex));
                }
            }
            // First line gets Cog prefix, subsequent lines get indent
            var linePrefix = offset === 0 ? prefix : indent;
            lines.push(linePrefix + lineBytes.join(' '));
        }
        return lines.join('\n');
    };
    /**
     * Format binary data as hex fallback (when misclassified as terminal)
     */
    DebugLoggerWindow.prototype.formatBinaryAsHexFallback = function (data) {
        if (data.length === 0)
            return '[BINARY: empty]';
        // Use standard hex display with ASCII interpretation
        var lines = [];
        var bytesPerLine = 16;
        lines.push("[BINARY DATA: ".concat(data.length, " bytes - displaying as hex]"));
        for (var offset = 0; offset < data.length; offset += bytesPerLine) {
            var lineBytes = [];
            var asciiBytes = [];
            var endOffset = Math.min(offset + bytesPerLine, data.length);
            // Hex representation
            for (var i = offset; i < endOffset; i++) {
                var hex = data[i].toString(16).padStart(2, '0').toUpperCase();
                lineBytes.push(hex);
                // ASCII interpretation
                var byte = data[i];
                if (byte >= 32 && byte <= 126) {
                    asciiBytes.push(String.fromCharCode(byte));
                }
                else {
                    asciiBytes.push('.');
                }
            }
            // Add padding for hex display alignment
            while (lineBytes.length < bytesPerLine) {
                lineBytes.push('  ');
                asciiBytes.push(' ');
            }
            var hexPart = lineBytes.join(' ');
            var asciiPart = asciiBytes.join('');
            var offsetStr = offset.toString(16).padStart(4, '0').toUpperCase();
            lines.push("  ".concat(offsetStr, ": ").concat(hexPart, "  |").concat(asciiPart, "|"));
        }
        return lines.join('\n');
    };
    /**
     * Format binary data as hex dump with Spin-2 notation (legacy method)
     * Format: "Cog N $xx $xx $xx $xx $xx $xx $xx $xx  $xx $xx $xx $xx $xx $xx $xx $xx"
     * Subsequent lines are indented to align with hex data
     */
    DebugLoggerWindow.prototype.formatBinaryAsHex = function (data) {
        if (data.length === 0)
            return 'Cog ? (empty message)';
        // First byte IS the COG ID (no masking needed for valid P2 debugger protocol)
        var firstByte = data[0];
        var cogId = firstByte <= 0x07 ? firstByte : -1; // -1 indicates invalid COG ID
        var lines = [];
        var bytesPerLine = 16;
        // Show warning for invalid COG IDs
        var prefix = cogId >= 0
            ? "Cog ".concat(cogId, " ")
            : "INVALID(0x".concat(firstByte.toString(16).toUpperCase(), ") ");
        var indent = ' '.repeat(prefix.length);
        for (var offset = 0; offset < data.length; offset += bytesPerLine) {
            var lineBytes = [];
            var endOffset = Math.min(offset + bytesPerLine, data.length);
            // Format each byte as $xx
            for (var i = offset; i < endOffset; i++) {
                var hex = data[i].toString(16).padStart(2, '0').toUpperCase();
                lineBytes.push("$".concat(hex));
                // Add double space after 8 bytes (except at end of line)
                if ((i - offset) === 7 && (i + 1) < endOffset) {
                    lineBytes.push(' '); // Extra space for group separator
                }
            }
            // First line gets the Cog prefix, others get indent
            var linePrefix = offset === 0 ? prefix : indent;
            lines.push(linePrefix + lineBytes.join(' '));
        }
        return lines.join('\n');
    };
    /**
     * Get buffered lines for testing
     */
    DebugLoggerWindow.prototype.getBufferedLines = function () {
        return __spreadArray([], this.lineBuffer, true);
    };
    DebugLoggerWindow.instance = null;
    // Predefined themes
    DebugLoggerWindow.THEMES = {
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
    return DebugLoggerWindow;
}(debugWindowBase_1.DebugWindowBase));
exports.DebugLoggerWindow = DebugLoggerWindow;
