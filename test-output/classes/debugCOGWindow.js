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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugCOGWindow = void 0;
// src/classes/debugCOGWindow.ts
var debugWindowBase_1 = require("./debugWindowBase");
/**
 * @class DebugCOGWindow
 * @extends DebugWindowBase
 *
 * @description COG-specific debug window for displaying messages from a single Propeller 2 COG.
 * One of 8 possible COG windows (COG 0-7) that display filtered debug output.
 *
 * Features:
 * - Displays messages only from its assigned COG ID
 * - Visual states: dormant (no traffic) vs active (has messages)
 * - Supports history replay when opened after messages received
 * - Part of the 8-COG splitter window system
 *
 * Window behavior:
 * - Auto-created when COG messages detected (ON_DEMAND mode)
 * - All 8 created with "Show All COGs" button (SHOW_ALL mode)
 * - Uses special 2x4 grid placement for organized layout
 * - Theme switches instantly between dormant/active states
 *
 * @since Sprint 2
 */
var DebugCOGWindow = /** @class */ (function (_super) {
    __extends(DebugCOGWindow, _super);
    /**
     * Creates a new COG debug window for a specific COG ID
     *
     * @param {number} cogId - The COG ID (0-7) this window represents
     * @param {any} params - Window initialization parameters
     */
    function DebugCOGWindow(cogId, params) {
        var _this = this;
        // Validate COG ID
        if (cogId < 0 || cogId > 7) {
            throw new Error("Invalid COG ID: ".concat(cogId, ". Must be 0-7"));
        }
        // Call parent constructor with required parameters
        _this = _super.call(this, params.context, params.windowId || "COG-".concat(cogId), "COG".concat(cogId)) || this;
        _this.messageCount = 0;
        _this.hasReceivedTraffic = false;
        _this.historyBuffer = [];
        _this.MAX_HISTORY_SIZE = 10000;
        _this.cogId = cogId;
        // Set up window-specific properties
        _this.setWindowProperties();
        return _this;
    }
    /**
     * Get the COG ID this window represents
     */
    DebugCOGWindow.prototype.getCOGId = function () {
        return this.cogId;
    };
    /**
     * Set window-specific properties for COG windows
     */
    DebugCOGWindow.prototype.setWindowProperties = function () {
        // Add COG-specific CSS classes and properties
        if (this.debugWindow && !this.debugWindow.isDestroyed()) {
            // Inject COG ID into window for client-side scripts
            this.debugWindow.webContents.executeJavaScript("\n        window.cogId = ".concat(this.cogId, ";\n        window.isCOGWindow = true;\n        document.body.classList.add('debug-cog-window');\n        document.body.classList.add('cog-").concat(this.cogId, "');\n        \n        // Start in dormant state (will switch to active on first message)\n        document.body.classList.add('cog-dormant');\n      "));
        }
    };
    /**
     * Generate HTML content for COG window
     */
    DebugCOGWindow.prototype.generateHTML = function () {
        var canvasId = this.getCanvasId();
        return "<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <title>COG ".concat(this.cogId, " Debug Window</title>\n  <style>\n    body {\n      margin: 0;\n      padding: 0;\n      background: #1e1e1e;\n      color: #ffffff;\n      font-family: 'Parallax', 'Courier New', monospace;\n      overflow: hidden;\n    }\n    \n    .cog-dormant {\n      background: #2d2d30 !important;\n      color: #888888 !important;\n    }\n    \n    .cog-active {\n      background: #1e1e1e !important;\n      color: #ffffff !important;\n    }\n    \n    #").concat(canvasId, " {\n      position: absolute;\n      top: 0;\n      left: 0;\n      width: 100%;\n      height: 100%;\n      background: inherit;\n    }\n    \n    #message-overlay {\n      position: absolute;\n      top: 10px;\n      left: 10px;\n      right: 10px;\n      bottom: 10px;\n      pointer-events: none;\n      font-size: 12px;\n      line-height: 1.4;\n      white-space: pre-wrap;\n      overflow-y: auto;\n      z-index: 10;\n    }\n  </style>\n</head>\n<body class=\"cog-dormant\">\n  <canvas id=\"").concat(canvasId, "\" width=\"400\" height=\"300\"></canvas>\n  <div id=\"message-overlay\"></div>\n  \n  <script>\n    const { ipcRenderer } = require('electron');\n    const canvas = document.getElementById('").concat(canvasId, "');\n    const ctx = canvas.getContext('2d');\n    const messageOverlay = document.getElementById('message-overlay');\n    \n    // Resize canvas to fill window\n    function resizeCanvas() {\n      canvas.width = window.innerWidth;\n      canvas.height = window.innerHeight;\n      redrawCanvas();\n    }\n    \n    // Initial canvas setup\n    resizeCanvas();\n    window.addEventListener('resize', resizeCanvas);\n    \n    // Message display\n    let messageCount = 0;\n    \n    ipcRenderer.on('cog-message', (event, data) => {\n      messageCount++;\n      \n      // Switch to active theme on first message\n      if (messageCount === 1) {\n        document.body.classList.remove('cog-dormant');\n        document.body.classList.add('cog-active');\n      }\n      \n      // Display message in overlay\n      const messageElement = document.createElement('div');\n      messageElement.textContent = `[${data.timestamp}] ${data.message}`;\n      messageOverlay.appendChild(messageElement);\n      \n      // Auto-scroll to bottom\n      messageOverlay.scrollTop = messageOverlay.scrollHeight;\n      \n      // Keep only last 100 messages\n      while (messageOverlay.children.length > 100) {\n        messageOverlay.removeChild(messageOverlay.firstChild);\n      }\n      \n      redrawCanvas();\n    });\n    \n    function redrawCanvas() {\n      // Clear canvas\n      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;\n      ctx.fillRect(0, 0, canvas.width, canvas.height);\n      \n      // Draw COG ID in center\n      ctx.fillStyle = getComputedStyle(document.body).color;\n      ctx.font = '24px Parallax, monospace';\n      ctx.textAlign = 'center';\n      ctx.textBaseline = 'middle';\n      ctx.fillText('COG ").concat(this.cogId, "', canvas.width / 2, canvas.height / 2);\n      \n      // Draw message count\n      ctx.font = '12px Parallax, monospace';\n      ctx.fillText(`Messages: ${messageCount}`, canvas.width / 2, canvas.height / 2 + 40);\n    }\n    \n    // Initial draw\n    redrawCanvas();\n  </script>\n</body>\n</html>");
    };
    /**
     * Process incoming COG message
     * Handles theme switching on first message
     *
     * @param {string} message - The debug message from this COG
     */
    DebugCOGWindow.prototype.processCOGMessage = function (message) {
        // Track first message for theme switching
        var wasFirstMessage = !this.hasReceivedTraffic;
        if (wasFirstMessage) {
            this.hasReceivedTraffic = true;
            this.switchToActiveTheme();
        }
        // Add to history buffer
        this.historyBuffer.push(message);
        if (this.historyBuffer.length > this.MAX_HISTORY_SIZE) {
            // Remove oldest 10% when buffer is full
            var removeCount = Math.floor(this.MAX_HISTORY_SIZE * 0.1);
            this.historyBuffer.splice(0, removeCount);
        }
        // Increment message counter
        this.messageCount++;
        // Send to window display
        this.sendToWindow(message);
    };
    /**
     * Send message to window for display
     *
     * @param {string} message - Message to display
     */
    DebugCOGWindow.prototype.sendToWindow = function (message) {
        if (this.debugWindow && !this.debugWindow.isDestroyed()) {
            this.debugWindow.webContents.send('cog-message', {
                cogId: this.cogId,
                message: message,
                timestamp: new Date().toISOString(),
                messageNumber: this.messageCount
            });
        }
    };
    /**
     * Switch window to active theme (has received messages)
     */
    DebugCOGWindow.prototype.switchToActiveTheme = function () {
        if (this.debugWindow && !this.debugWindow.isDestroyed()) {
            this.debugWindow.webContents.executeJavaScript("\n        // Remove dormant indicator and switch to active theme\n        document.body.classList.remove('cog-dormant');\n        document.body.classList.add('cog-active');\n        \n        // Flash effect for first message\n        document.body.classList.add('cog-first-message');\n        setTimeout(() => document.body.classList.remove('cog-first-message'), 500);\n        \n        // Remove any dormant indicator element\n        const indicator = document.getElementById('cog-dormant-indicator');\n        if (indicator) {\n          indicator.remove();\n        }\n        \n        // Update window title to show activity\n        document.title = 'COG ".concat(this.cogId, " Debug (Active)';\n      "));
        }
    };
    /**
     * Receive batch of history messages for replay
     * Used when window is opened after messages already received
     *
     * @param {string[]} messages - Array of historical messages
     */
    DebugCOGWindow.prototype.receiveHistoryBatch = function (messages) {
        // Process all messages but don't trigger theme switch multiple times
        var wasInactive = !this.hasReceivedTraffic;
        for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
            var message = messages_1[_i];
            this.historyBuffer.push(message);
            this.messageCount++;
        }
        // Trim buffer if needed
        if (this.historyBuffer.length > this.MAX_HISTORY_SIZE) {
            var excess = this.historyBuffer.length - this.MAX_HISTORY_SIZE;
            this.historyBuffer.splice(0, excess);
        }
        // Switch theme once if this is first batch
        if (wasInactive && messages.length > 0) {
            this.hasReceivedTraffic = true;
            this.switchToActiveTheme();
        }
        // Send all messages to window
        if (this.debugWindow && !this.debugWindow.isDestroyed()) {
            this.debugWindow.webContents.send('cog-history-batch', {
                cogId: this.cogId,
                messages: messages,
                totalCount: this.messageCount
            });
        }
    };
    /**
     * Handle window close event
     */
    DebugCOGWindow.prototype.onWindowClosed = function () {
        var _this = this;
        // Notify COGWindowManager that user closed this window
        // Send notification through IPC or event system
        process.nextTick(function () {
            // Use nextTick to avoid any timing issues
            _this.emit('cog-window-closed', _this.cogId);
        });
        // Clean up
        this.closeDebugWindow();
    };
    /**
     * Get window statistics for monitoring
     */
    DebugCOGWindow.prototype.getStatistics = function () {
        return {
            cogId: this.cogId,
            messageCount: this.messageCount,
            hasTraffic: this.hasReceivedTraffic,
            bufferSize: this.historyBuffer.length,
            isOpen: this.debugWindow && !this.debugWindow.isDestroyed()
        };
    };
    /**
     * Clear all messages and reset state
     */
    DebugCOGWindow.prototype.clear = function () {
        this.messageCount = 0;
        this.historyBuffer = [];
        if (this.debugWindow && !this.debugWindow.isDestroyed()) {
            this.debugWindow.webContents.send('clear-display');
        }
    };
    /**
     * Export COG messages to string for saving
     */
    DebugCOGWindow.prototype.exportMessages = function () {
        var header = [
            '='.repeat(80),
            "COG ".concat(this.cogId, " Debug Log Export"),
            "Exported: ".concat(new Date().toISOString()),
            "Total Messages: ".concat(this.messageCount),
            '='.repeat(80),
            ''
        ].join('\n');
        var content = this.historyBuffer.join('\n');
        var footer = [
            '',
            '='.repeat(80),
            "End of COG ".concat(this.cogId, " Export"),
            '='.repeat(80)
        ].join('\n');
        return header + content + footer;
    };
    /**
     * Handle commands routed to this window
     * COG windows have limited command support
     *
     * @param {string} commandName - Command name
     * @param {any[]} args - Command arguments
     */
    DebugCOGWindow.prototype.handleCommand = function (commandName) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        switch (commandName.toUpperCase()) {
            case 'CLEAR':
            case 'CLS':
                this.clear();
                break;
            case 'SAVE':
            case 'EXPORT':
                // Trigger export through main window
                this.emit('request-export', this.cogId);
                break;
            case 'THEME':
                // COG windows use automatic theme switching, not manual
                console.log("COG ".concat(this.cogId, ": Theme is automatically managed based on traffic"));
                break;
            default:
                // Most commands not applicable to COG windows
                console.log("COG ".concat(this.cogId, ": Command '").concat(commandName, "' not supported for COG windows"));
        }
    };
    /**
     * Get window type identifier
     */
    DebugCOGWindow.prototype.getWindowType = function () {
        return "COG".concat(this.cogId);
    };
    /**
     * Check if window has received any traffic
     */
    DebugCOGWindow.prototype.hasTraffic = function () {
        return this.hasReceivedTraffic;
    };
    /**
     * Get window reference for COGWindowManager
     */
    DebugCOGWindow.prototype.getWindow = function () {
        return this.debugWindow;
    };
    /**
     * Required abstract method implementation
     */
    DebugCOGWindow.prototype.closeDebugWindow = function () {
        if (this.debugWindow && !this.debugWindow.isDestroyed()) {
            this.debugWindow.close();
        }
    };
    /**
     * Required abstract method implementation
     */
    DebugCOGWindow.prototype.processMessageImmediate = function (lineParts) {
        // COG windows process messages through processCOGMessage
        // This is here to satisfy the abstract requirement
        if (typeof lineParts === 'string') {
            this.processCOGMessage(lineParts);
        }
        else if (Array.isArray(lineParts)) {
            this.processCOGMessage(lineParts.join(' '));
        }
    };
    /**
     * Required abstract method implementation
     */
    DebugCOGWindow.prototype.getCanvasId = function () {
        return "cog-canvas-".concat(this.cogId);
    };
    return DebugCOGWindow;
}(debugWindowBase_1.DebugWindowBase));
exports.DebugCOGWindow = DebugCOGWindow;
