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
exports.COGHistoryManager = void 0;
// src/classes/shared/cogHistoryManager.ts
var events_1 = require("events");
/**
 * Message types to filter out when replaying history
 */
var INJECTED_MESSAGE_PATTERNS = [
    /^\[WINDOW\]/, // Window position messages
    /^\[ERROR\]/, // Validation errors
    /^\[WARNING\]/, // Warnings
    /^\[SYSTEM\]/, // System messages
    /^\[DTR\]/, // DTR state changes (handle specially)
    /^\[CONNECTION\]/, // Connection status
];
/**
 * COGHistoryManager - Manages history replay for COG splitter windows
 *
 * When user opens 8 COG windows, this manager:
 * 1. Snapshots the entire debug logger history
 * 2. Filters out injected system messages
 * 3. Routes COG-prefixed messages to appropriate windows
 * 4. Forwards DTR reset messages to windows that receive content
 *
 * This ensures COG windows start with appropriate context
 */
var COGHistoryManager = /** @class */ (function (_super) {
    __extends(COGHistoryManager, _super);
    function COGHistoryManager() {
        var _this = _super.call(this) || this;
        _this.cogWindows = new Map();
        _this.debugLogHistory = [];
        _this.dtrResetMessage = null;
        return _this;
    }
    /**
     * Register a COG window for history replay
     */
    COGHistoryManager.prototype.registerCOGWindow = function (cogId, window) {
        this.cogWindows.set(cogId, window);
    };
    /**
     * Unregister a COG window
     */
    COGHistoryManager.prototype.unregisterCOGWindow = function (cogId) {
        this.cogWindows.delete(cogId);
    };
    /**
     * Snapshot debug logger history and distribute to COG windows
     * Called when user activates COG splitter feature
     */
    COGHistoryManager.prototype.replayHistoryToCOGs = function (history) {
        this.debugLogHistory = __spreadArray([], history, true);
        // First pass: Find DTR reset message if any
        this.dtrResetMessage = this.findDTRResetMessage(history);
        // Second pass: Filter and route messages
        var cogMessages = new Map();
        for (var _i = 0, history_1 = history; _i < history_1.length; _i++) {
            var message = history_1[_i];
            // Skip injected system messages
            if (this.isInjectedMessage(message)) {
                continue;
            }
            // Extract COG ID from message if present
            var cogId = this.extractCOGId(message);
            if (cogId !== null) {
                if (!cogMessages.has(cogId)) {
                    cogMessages.set(cogId, []);
                }
                cogMessages.get(cogId).push(message);
            }
        }
        // Third pass: Send filtered history to each COG window
        for (var _a = 0, cogMessages_1 = cogMessages; _a < cogMessages_1.length; _a++) {
            var _b = cogMessages_1[_a], cogId = _b[0], messages = _b[1];
            var window_1 = this.cogWindows.get(cogId);
            if (window_1) {
                // If we have a DTR reset message, prepend it
                var replayMessages = this.dtrResetMessage
                    ? __spreadArray([this.formatDTRMessageForCOG(cogId)], messages, true) : messages;
                this.sendHistoryToWindow(window_1, replayMessages);
            }
        }
        // Notify completion
        this.emit('historyReplayed', {
            totalMessages: history.length,
            cogDistribution: Array.from(cogMessages.entries()).map(function (_a) {
                var cog = _a[0], msgs = _a[1];
                return ({
                    cogId: cog,
                    messageCount: msgs.length
                });
            })
        });
    };
    /**
     * Check if message is an injected system message
     */
    COGHistoryManager.prototype.isInjectedMessage = function (message) {
        return INJECTED_MESSAGE_PATTERNS.some(function (pattern) { return pattern.test(message); });
    };
    /**
     * Extract COG ID from message
     * Looks for patterns like "Cog 0:", "COG1:", "[COG 2]", etc.
     */
    COGHistoryManager.prototype.extractCOGId = function (message) {
        // Common COG prefix patterns
        var patterns = [
            /^Cog\s*(\d+)[:\s]/i, // "Cog 0:", "COG 1 "
            /^\[COG\s*(\d+)\]/i, // "[COG 0]"
            /^COG(\d+)[:\s]/i, // "COG0:", "COG1 "
            /^<(\d+)>/, // "<0>" shorthand
        ];
        for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
            var pattern = patterns_1[_i];
            var match = message.match(pattern);
            if (match) {
                var cogId = parseInt(match[1], 10);
                if (cogId >= 0 && cogId <= 7) {
                    return cogId;
                }
            }
        }
        return null;
    };
    /**
     * Find DTR reset message in history
     */
    COGHistoryManager.prototype.findDTRResetMessage = function (history) {
        // Look for most recent DTR reset
        for (var i = history.length - 1; i >= 0; i--) {
            if (history[i].includes('DTR reset') ||
                history[i].includes('Log started') ||
                history[i].includes('Connection established')) {
                return history[i];
            }
        }
        return null;
    };
    /**
     * Format DTR message for specific COG
     */
    COGHistoryManager.prototype.formatDTRMessageForCOG = function (cogId) {
        var timestamp = new Date().toISOString();
        return "[".concat(timestamp, "] COG ").concat(cogId, " - Session started (replayed from debug logger)");
    };
    /**
     * Send history messages to a COG window
     */
    COGHistoryManager.prototype.sendHistoryToWindow = function (window, messages) {
        // Send in batches to avoid overwhelming the window
        var BATCH_SIZE = 100;
        var _loop_1 = function (i) {
            var batch = messages.slice(i, i + BATCH_SIZE);
            // Use setTimeout to allow UI to update between batches
            setTimeout(function () {
                window.receiveHistoryBatch(batch);
            }, i / BATCH_SIZE * 10); // Small delay between batches
        };
        for (var i = 0; i < messages.length; i += BATCH_SIZE) {
            _loop_1(i);
        }
    };
    /**
     * Clear all history and reset
     */
    COGHistoryManager.prototype.clear = function () {
        this.debugLogHistory = [];
        this.dtrResetMessage = null;
        this.cogWindows.clear();
    };
    /**
     * Get statistics about current state
     */
    COGHistoryManager.prototype.getStatistics = function () {
        return {
            registeredCOGs: Array.from(this.cogWindows.keys()),
            historySize: this.debugLogHistory.length,
            hasDTRReset: this.dtrResetMessage !== null
        };
    };
    return COGHistoryManager;
}(events_1.EventEmitter));
exports.COGHistoryManager = COGHistoryManager;
