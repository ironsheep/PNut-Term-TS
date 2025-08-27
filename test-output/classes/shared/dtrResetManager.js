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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DTRResetManager = void 0;
// src/classes/shared/dtrResetManager.ts
var events_1 = require("events");
/**
 * DTRResetManager - Manages DTR/RTS reset synchronization
 *
 * Handles DTR/RTS reset events WITHOUT touching the buffer.
 * Only manages synchronization flags and queue draining.
 *
 * Key responsibilities:
 * - Mark boundaries in message stream
 * - Wait for queues to drain before log rotation
 * - Signal DebugLogger for new log file
 * - Maintain complete separation from buffer
 */
var DTRResetManager = /** @class */ (function (_super) {
    __extends(DTRResetManager, _super);
    function DTRResetManager(router) {
        var _this = _super.call(this) || this;
        _this.resetPending = false;
        _this.currentResetEvent = null;
        _this.resetSequence = 0;
        _this.boundaryMarkers = new Map();
        // Synchronization flags
        _this.isSynchronized = false;
        _this.syncSource = '';
        // Statistics
        _this.totalResets = 0;
        _this.dtrResets = 0;
        _this.rtsResets = 0;
        _this.messagesBeforeReset = 0;
        _this.messagesAfterReset = 0;
        // Performance monitoring
        _this.performanceMonitor = null;
        _this.router = router;
        return _this;
    }
    /**
     * Set performance monitor for instrumentation
     */
    DTRResetManager.prototype.setPerformanceMonitor = function (monitor) {
        this.performanceMonitor = monitor;
    };
    /**
     * Handle DTR reset event
     * ONLY sets flags, does NOT touch buffer
     */
    DTRResetManager.prototype.onDTRReset = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.handleReset('DTR')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle RTS reset event
     * ONLY sets flags, does NOT touch buffer
     */
    DTRResetManager.prototype.onRTSReset = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.handleReset('RTS')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Common reset handler
     */
    DTRResetManager.prototype.handleReset = function (type) {
        return __awaiter(this, void 0, void 0, function () {
            var resetEvent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resetEvent = {
                            type: type,
                            timestamp: Date.now(),
                            sequenceNumber: ++this.resetSequence
                        };
                        // Update statistics
                        this.totalResets++;
                        if (type === 'DTR') {
                            this.dtrResets++;
                            // Record DTR reset in performance monitor
                            if (this.performanceMonitor) {
                                this.performanceMonitor.recordDTRReset();
                            }
                        }
                        else {
                            this.rtsResets++;
                            // Record RTS reset in performance monitor
                            if (this.performanceMonitor) {
                                this.performanceMonitor.recordRTSReset();
                            }
                        }
                        // Store current reset
                        this.currentResetEvent = resetEvent;
                        this.resetPending = true;
                        // Mark boundary in stream
                        this.boundaryMarkers.set(resetEvent.sequenceNumber, resetEvent);
                        // Set synchronization flags
                        this.isSynchronized = true;
                        this.syncSource = type;
                        console.log("[DTRResetManager] ".concat(type, " reset detected, sequence ").concat(resetEvent.sequenceNumber));
                        // Emit reset event for other components
                        this.emit('resetDetected', resetEvent);
                        // Wait for queues to drain
                        return [4 /*yield*/, this.drainQueues()];
                    case 1:
                        // Wait for queues to drain
                        _a.sent();
                        // Signal log rotation
                        this.emit('rotateLog', resetEvent);
                        // Clear reset pending
                        this.resetPending = false;
                        console.log("[DTRResetManager] ".concat(type, " reset complete, log rotated"));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Wait for all queues to drain
     */
    DTRResetManager.prototype.drainQueues = function () {
        return __awaiter(this, void 0, void 0, function () {
            var routerDrained;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[DTRResetManager] Waiting for queues to drain...');
                        return [4 /*yield*/, this.router.waitForQueueDrain(5000)];
                    case 1:
                        routerDrained = _a.sent();
                        if (!routerDrained) {
                            console.warn('[DTRResetManager] Router queue drain timeout');
                            this.emit('drainTimeout', { queue: 'router' });
                        }
                        // Additional drain time for any pending async operations
                        return [4 /*yield*/, this.delay(50)];
                    case 2:
                        // Additional drain time for any pending async operations
                        _a.sent();
                        console.log('[DTRResetManager] All queues drained');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if message is before or after reset boundary
     */
    DTRResetManager.prototype.isMessageBeforeReset = function (timestamp) {
        if (!this.currentResetEvent) {
            return true; // No reset yet
        }
        return timestamp < this.currentResetEvent.timestamp;
    };
    /**
     * Get current synchronization status
     */
    DTRResetManager.prototype.getSyncStatus = function () {
        return {
            synchronized: this.isSynchronized,
            source: this.syncSource
        };
    };
    /**
     * Mark synchronization from another source
     */
    DTRResetManager.prototype.markSynchronized = function (source) {
        this.isSynchronized = true;
        this.syncSource = source;
        this.emit('syncStatusChanged', this.getSyncStatus());
    };
    /**
     * Clear synchronization
     */
    DTRResetManager.prototype.clearSynchronization = function () {
        this.isSynchronized = false;
        this.syncSource = '';
        this.emit('syncStatusChanged', this.getSyncStatus());
    };
    /**
     * Check if reset is pending
     */
    DTRResetManager.prototype.isResetPending = function () {
        return this.resetPending;
    };
    /**
     * Get current reset event
     */
    DTRResetManager.prototype.getCurrentReset = function () {
        return this.currentResetEvent;
    };
    /**
     * Get boundary marker by sequence
     */
    DTRResetManager.prototype.getBoundaryMarker = function (sequence) {
        return this.boundaryMarkers.get(sequence);
    };
    /**
     * Get all boundary markers
     */
    DTRResetManager.prototype.getAllBoundaries = function () {
        return Array.from(this.boundaryMarkers.values());
    };
    /**
     * Update message counts
     */
    DTRResetManager.prototype.updateMessageCounts = function (beforeReset) {
        if (beforeReset) {
            this.messagesBeforeReset++;
        }
        else {
            this.messagesAfterReset++;
        }
    };
    /**
     * Get statistics
     */
    DTRResetManager.prototype.getStats = function () {
        return {
            totalResets: this.totalResets,
            dtrResets: this.dtrResets,
            rtsResets: this.rtsResets,
            messagesBeforeReset: this.messagesBeforeReset,
            messagesAfterReset: this.messagesAfterReset,
            currentSequence: this.resetSequence,
            boundaryCount: this.boundaryMarkers.size,
            resetPending: this.resetPending,
            synchronized: this.isSynchronized,
            syncSource: this.syncSource
        };
    };
    /**
     * Reset statistics
     */
    DTRResetManager.prototype.resetStats = function () {
        this.totalResets = 0;
        this.dtrResets = 0;
        this.rtsResets = 0;
        this.messagesBeforeReset = 0;
        this.messagesAfterReset = 0;
    };
    /**
     * Clear old boundary markers (keep last N)
     */
    DTRResetManager.prototype.pruneOldBoundaries = function (keepCount) {
        if (keepCount === void 0) { keepCount = 10; }
        if (this.boundaryMarkers.size <= keepCount) {
            return;
        }
        var sortedKeys = Array.from(this.boundaryMarkers.keys()).sort(function (a, b) { return a - b; });
        var toDelete = sortedKeys.slice(0, sortedKeys.length - keepCount);
        for (var _i = 0, toDelete_1 = toDelete; _i < toDelete_1.length; _i++) {
            var key = toDelete_1[_i];
            this.boundaryMarkers.delete(key);
        }
        console.log("[DTRResetManager] Pruned ".concat(toDelete.length, " old boundary markers"));
    };
    /**
     * Utility delay function
     */
    DTRResetManager.prototype.delay = function (ms) {
        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
    };
    /**
     * Force immediate log rotation (for testing)
     */
    DTRResetManager.prototype.forceLogRotation = function () {
        var resetEvent = {
            type: 'DTR',
            timestamp: Date.now(),
            sequenceNumber: ++this.resetSequence
        };
        this.emit('rotateLog', resetEvent);
    };
    return DTRResetManager;
}(events_1.EventEmitter));
exports.DTRResetManager = DTRResetManager;
