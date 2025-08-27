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
exports.COGWindowManager = exports.COGDisplayMode = void 0;
// src/classes/shared/cogWindowManager.ts
var events_1 = require("events");
/**
 * COG window display modes
 */
var COGDisplayMode;
(function (COGDisplayMode) {
    COGDisplayMode["SHOW_ALL"] = "show_all";
    COGDisplayMode["ON_DEMAND"] = "on_demand"; // Only show windows with traffic
})(COGDisplayMode || (exports.COGDisplayMode = COGDisplayMode = {}));
/**
 * COGWindowManager - Manages display modes and lifecycle of COG windows
 *
 * Two modes of operation:
 * 1. Show All: Display all 8 COG windows, visually indicate inactive ones
 * 2. On-Demand: Only create/show windows that have received traffic
 *
 * Mixed mode behavior:
 * - User can close any window, it stays closed until new traffic
 * - Mode preference is persisted in settings
 * - "Show all 8 COGs" button respects the current mode
 */
var COGWindowManager = /** @class */ (function (_super) {
    __extends(COGWindowManager, _super);
    function COGWindowManager() {
        var _this = _super.call(this) || this;
        _this.mode = COGDisplayMode.ON_DEMAND;
        _this.cogStates = new Map();
        _this.windowCreator = null;
        // Initialize states for all 8 COGs
        for (var i = 0; i < 8; i++) {
            _this.cogStates.set(i, {
                cogId: i,
                window: null,
                hasTraffic: false,
                userClosed: false,
                lastActivity: null,
                messageCount: 0
            });
        }
        return _this;
    }
    /**
     * Set the display mode
     */
    COGWindowManager.prototype.setMode = function (mode) {
        var oldMode = this.mode;
        this.mode = mode;
        if (oldMode !== mode) {
            this.emit('modeChanged', { oldMode: oldMode, newMode: mode });
            // If switching to ON_DEMAND, close inactive windows
            if (mode === COGDisplayMode.ON_DEMAND) {
                this.closeInactiveWindows();
            }
        }
    };
    /**
     * Get current display mode
     */
    COGWindowManager.prototype.getMode = function () {
        return this.mode;
    };
    /**
     * Set window creator function
     */
    COGWindowManager.prototype.setWindowCreator = function (creator) {
        this.windowCreator = creator;
    };
    /**
     * Handle "Show all 8 COGs" button click
     */
    COGWindowManager.prototype.showAllCOGs = function () {
        if (this.mode === COGDisplayMode.SHOW_ALL) {
            // Show All mode: Create all 8 windows
            for (var cogId = 0; cogId < 8; cogId++) {
                var state = this.cogStates.get(cogId);
                // Skip if user closed this window (respect user choice)
                if (state.userClosed) {
                    continue;
                }
                // Create window if it doesn't exist
                if (!state.window) {
                    this.createCOGWindow(cogId);
                }
                // Mark inactive windows visually
                if (!state.hasTraffic && state.window) {
                    this.markWindowInactive(state.window, cogId);
                }
            }
        }
        else {
            // On-Demand mode: Only show windows with traffic
            for (var _i = 0, _a = this.cogStates; _i < _a.length; _i++) {
                var _b = _a[_i], cogId = _b[0], state = _b[1];
                // Skip if no traffic or user closed
                if (!state.hasTraffic || state.userClosed) {
                    continue;
                }
                // Create window if needed
                if (!state.window) {
                    this.createCOGWindow(cogId);
                }
            }
        }
        this.emit('showAllRequested', { mode: this.mode });
    };
    /**
     * Handle incoming traffic for a COG
     */
    COGWindowManager.prototype.onCOGTraffic = function (cogId, message) {
        if (cogId < 0 || cogId > 7)
            return;
        var state = this.cogStates.get(cogId);
        var wasInactive = !state.hasTraffic;
        // Update state
        state.hasTraffic = true;
        state.lastActivity = new Date();
        state.messageCount++;
        // If window was closed by user but new traffic arrived, create it
        if (state.userClosed && !state.window) {
            state.userClosed = false; // Reset user closed flag
            this.createCOGWindow(cogId);
        }
        // In ON_DEMAND mode, create window on first traffic
        if (this.mode === COGDisplayMode.ON_DEMAND && !state.window && !state.userClosed) {
            this.createCOGWindow(cogId);
        }
        // If window exists and was inactive, update visual state
        if (state.window && wasInactive) {
            this.markWindowActive(state.window, cogId);
        }
        // Route message to window if it exists
        if (state.window) {
            this.sendMessageToWindow(state.window, message);
        }
        this.emit('cogTraffic', { cogId: cogId, messageCount: state.messageCount });
    };
    /**
     * Handle user closing a COG window
     */
    COGWindowManager.prototype.onWindowClosed = function (cogId) {
        var state = this.cogStates.get(cogId);
        if (!state)
            return;
        // Mark as user closed - won't reopen until new traffic
        state.userClosed = true;
        state.window = null;
        this.emit('windowClosed', { cogId: cogId, userInitiated: true });
    };
    /**
     * Create a COG window
     */
    COGWindowManager.prototype.createCOGWindow = function (cogId) {
        var _this = this;
        if (!this.windowCreator) {
            console.error('Window creator not set');
            return;
        }
        var state = this.cogStates.get(cogId);
        try {
            var window_1 = this.windowCreator(cogId);
            state.window = window_1;
            // Set up close handler
            window_1.on('closed', function () {
                _this.onWindowClosed(cogId);
            });
            // Wait for window to be ready before applying theme
            window_1.webContents.once('dom-ready', function () {
                // Apply initial theme based on traffic state
                // This ensures we don't cycle through dormant if there's already traffic
                _this.applyWindowTheme(window_1, cogId, state.hasTraffic);
            });
            this.emit('windowCreated', { cogId: cogId, hasTraffic: state.hasTraffic });
        }
        catch (error) {
            console.error("Failed to create COG ".concat(cogId, " window:"), error);
            this.emit('windowCreationFailed', { cogId: cogId, error: error });
        }
    };
    /**
     * Apply theme to COG window based on traffic state
     * Uses CSS themes for instant visual switching
     */
    COGWindowManager.prototype.applyWindowTheme = function (window, cogId, hasTraffic) {
        var script = hasTraffic ? this.getActiveThemeScript(cogId) : this.getDormantThemeScript(cogId);
        window.webContents.executeJavaScript(script);
    };
    /**
     * Get dormant theme application script
     */
    COGWindowManager.prototype.getDormantThemeScript = function (cogId) {
        return "\n      // Apply dormant theme instantly via CSS class\n      document.body.classList.remove('cog-active');\n      document.body.classList.add('cog-dormant');\n      \n      // Add dormant indicator if not present\n      if (!document.getElementById('cog-dormant-indicator')) {\n        const indicator = document.createElement('div');\n        indicator.id = 'cog-dormant-indicator';\n        indicator.className = 'cog-dormant-indicator';\n        indicator.innerHTML = `\n          <div class=\"cog-title\">COG ".concat(cogId, "</div>\n          <div class=\"status-text\">This window has not received any content</div>\n          <div class=\"waiting-text\">Waiting for debug messages...</div>\n        `;\n        document.body.appendChild(indicator);\n      }\n      \n      // Load theme CSS if not already loaded\n      if (!document.getElementById('cog-themes-css')) {\n        const link = document.createElement('link');\n        link.id = 'cog-themes-css';\n        link.rel = 'stylesheet';\n        link.href = '../assets/cog-window-themes.css';\n        document.head.appendChild(link);\n      }\n    ");
    };
    /**
     * Get active theme application script
     */
    COGWindowManager.prototype.getActiveThemeScript = function (cogId) {
        return "\n      // Switch to active theme instantly\n      document.body.classList.remove('cog-dormant');\n      document.body.classList.add('cog-active');\n      \n      // Add first message flash if this is the transition\n      const wasDormant = document.getElementById('cog-dormant-indicator');\n      if (wasDormant) {\n        document.body.classList.add('cog-first-message');\n        setTimeout(() => document.body.classList.remove('cog-first-message'), 500);\n      }\n      \n      // Remove dormant indicator\n      const indicator = document.getElementById('cog-dormant-indicator');\n      if (indicator) {\n        indicator.remove();\n      }\n      \n      // Ensure theme CSS is loaded\n      if (!document.getElementById('cog-themes-css')) {\n        const link = document.createElement('link');\n        link.id = 'cog-themes-css';\n        link.rel = 'stylesheet';\n        link.href = '../assets/cog-window-themes.css';\n        document.head.appendChild(link);\n      }\n    ";
    };
    /**
     * Mark window as inactive (no traffic) - Updated to use themes
     */
    COGWindowManager.prototype.markWindowInactive = function (window, cogId) {
        this.applyWindowTheme(window, cogId, false);
    };
    /**
     * Mark window as active (has traffic) - Updated to use themes
     */
    COGWindowManager.prototype.markWindowActive = function (window, cogId) {
        this.applyWindowTheme(window, cogId, true);
    };
    /**
     * Send message to COG window
     */
    COGWindowManager.prototype.sendMessageToWindow = function (window, message) {
        if (window && !window.isDestroyed()) {
            window.webContents.send('cog-message', message);
        }
    };
    /**
     * Close all inactive windows (for ON_DEMAND mode)
     */
    COGWindowManager.prototype.closeInactiveWindows = function () {
        for (var _i = 0, _a = this.cogStates; _i < _a.length; _i++) {
            var _b = _a[_i], cogId = _b[0], state = _b[1];
            if (!state.hasTraffic && state.window && !state.window.isDestroyed()) {
                state.window.close();
                state.window = null;
            }
        }
    };
    /**
     * Get statistics about COG windows
     */
    COGWindowManager.prototype.getStatistics = function () {
        var stats = {
            mode: this.mode,
            totalCOGs: 8,
            activeCOGs: 0,
            openWindows: 0,
            userClosedWindows: 0,
            cogDetails: []
        };
        for (var _i = 0, _a = this.cogStates; _i < _a.length; _i++) {
            var _b = _a[_i], cogId = _b[0], state = _b[1];
            if (state.hasTraffic)
                stats.activeCOGs++;
            if (state.window)
                stats.openWindows++;
            if (state.userClosed)
                stats.userClosedWindows++;
            stats.cogDetails.push({
                cogId: cogId,
                hasTraffic: state.hasTraffic,
                isOpen: !!state.window,
                userClosed: state.userClosed,
                messageCount: state.messageCount,
                lastActivity: state.lastActivity
            });
        }
        return stats;
    };
    /**
     * Reset all states
     */
    COGWindowManager.prototype.reset = function () {
        // Close all windows
        for (var _i = 0, _a = this.cogStates.values(); _i < _a.length; _i++) {
            var state = _a[_i];
            if (state.window && !state.window.isDestroyed()) {
                state.window.close();
            }
        }
        // Reset states
        for (var i = 0; i < 8; i++) {
            this.cogStates.set(i, {
                cogId: i,
                window: null,
                hasTraffic: false,
                userClosed: false,
                lastActivity: null,
                messageCount: 0
            });
        }
        this.emit('reset');
    };
    return COGWindowManager;
}(events_1.EventEmitter));
exports.COGWindowManager = COGWindowManager;
