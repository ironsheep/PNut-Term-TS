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
exports.SerialMessageProcessor = void 0;
// src/classes/shared/serialMessageProcessor.ts
var events_1 = require("events");
var circularBuffer_1 = require("./circularBuffer");
var dynamicQueue_1 = require("./dynamicQueue");
var serialReceiver_1 = require("./serialReceiver");
var messageExtractor_1 = require("./messageExtractor");
var messageRouter_1 = require("./messageRouter");
var dtrResetManager_1 = require("./dtrResetManager");
var performanceMonitor_1 = require("./performanceMonitor");
var SerialMessageProcessor = /** @class */ (function (_super) {
    __extends(SerialMessageProcessor, _super);
    function SerialMessageProcessor(enablePerformanceLogging, performanceLogPath) {
        if (enablePerformanceLogging === void 0) { enablePerformanceLogging = false; }
        var _this = _super.call(this) || this;
        // State
        _this.isRunning = false;
        _this.startTime = 0;
        // Create components in dependency order
        _this.buffer = new circularBuffer_1.CircularBuffer();
        _this.receiver = new serialReceiver_1.SerialReceiver(_this.buffer);
        _this.extractorQueue = new dynamicQueue_1.DynamicQueue(100, 5000, 'ExtractorQueue');
        _this.extractor = new messageExtractor_1.MessageExtractor(_this.buffer, _this.extractorQueue);
        _this.router = new messageRouter_1.MessageRouter(_this.extractorQueue);
        _this.dtrResetManager = new dtrResetManager_1.DTRResetManager(_this.router);
        // Create performance monitor
        var logPath = performanceLogPath || (enablePerformanceLogging ? 'performance.log' : undefined);
        _this.performanceMonitor = new performanceMonitor_1.PerformanceMonitor(logPath);
        // Wire performance monitoring to all components
        _this.buffer.setPerformanceMonitor(_this.performanceMonitor);
        _this.receiver.setPerformanceMonitor(_this.performanceMonitor);
        _this.extractorQueue.setPerformanceMonitor(_this.performanceMonitor, 'ExtractorQueue');
        _this.extractor.setPerformanceMonitor(_this.performanceMonitor);
        _this.router.setPerformanceMonitor(_this.performanceMonitor);
        _this.dtrResetManager.setPerformanceMonitor(_this.performanceMonitor);
        // Wire up the pipeline
        _this.setupPipeline();
        return _this;
    }
    /**
     * Set up component connections
     */
    SerialMessageProcessor.prototype.setupPipeline = function () {
        var _this = this;
        // SerialReceiver triggers MessageExtractor
        this.receiver.setExtractionCallback(function () {
            var hasMore = _this.extractor.extractMessages();
            // If messages were extracted, trigger router
            if (_this.extractorQueue.getSize() > 0) {
                _this.router.processMessages();
            }
            // If more data might be extractable, schedule another extraction
            if (hasMore) {
                setImmediate(function () {
                    _this.extractor.extractMessages();
                    if (_this.extractorQueue.getSize() > 0) {
                        _this.router.processMessages();
                    }
                });
            }
        });
        // Handle buffer overflow
        this.receiver.on('bufferOverflow', function (event) {
            console.error('[Processor] Buffer overflow, waiting for resync');
            _this.emit('bufferOverflow', event);
            // Clear buffer and wait for clean message boundary
            _this.buffer.clear();
            _this.dtrResetManager.clearSynchronization();
        });
        // Handle extraction events
        this.extractor.on('messagesExtracted', function (count) {
            _this.emit('messagesExtracted', count);
        });
        // Handle routing events
        this.router.on('messageRouted', function (event) {
            // Update DTR reset manager message counts
            var isBeforeReset = _this.dtrResetManager.isMessageBeforeReset(event.message.timestamp);
            _this.dtrResetManager.updateMessageCounts(isBeforeReset);
        });
        this.router.on('routingError', function (error) {
            console.error('[Processor] Routing error:', error);
            _this.emit('routingError', error);
        });
        // Handle DTR/RTS reset events
        this.dtrResetManager.on('resetDetected', function (event) {
            console.log("[Processor] ".concat(event.type, " reset detected"));
            _this.emit('resetDetected', event);
        });
        this.dtrResetManager.on('rotateLog', function (event) {
            console.log("[Processor] Log rotation requested for ".concat(event.type, " reset"));
            _this.emit('rotateLog', event);
        });
        // Propagate sync status changes
        this.dtrResetManager.on('syncStatusChanged', function (status) {
            _this.emit('syncStatusChanged', status);
        });
        // Handle performance threshold alerts
        this.performanceMonitor.on('threshold', function (alert) {
            console.warn('[Processor] Performance threshold exceeded:', alert);
            _this.emit('performanceAlert', alert);
        });
    };
    /**
     * Start processing
     */
    SerialMessageProcessor.prototype.start = function () {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.startTime = Date.now();
        // Start performance snapshots
        this.performanceMonitor.startSnapshots(5000);
        console.log('[Processor] Started serial message processing');
        this.emit('started');
    };
    /**
     * Stop processing
     */
    SerialMessageProcessor.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isRunning) {
                            return [2 /*return*/];
                        }
                        this.isRunning = false;
                        // Wait for queues to drain
                        return [4 /*yield*/, this.router.waitForQueueDrain(5000)];
                    case 1:
                        // Wait for queues to drain
                        _a.sent();
                        // Stop performance snapshots
                        this.performanceMonitor.stopSnapshots();
                        console.log('[Processor] Stopped serial message processing');
                        this.emit('stopped');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Receive serial data
     * This is the entry point for all serial data
     */
    SerialMessageProcessor.prototype.receiveData = function (data) {
        console.log("[TWO-TIER] \uD83D\uDD04 SerialMessageProcessor.receiveData(): ".concat(data.length, " bytes, running: ").concat(this.isRunning));
        if (!this.isRunning) {
            console.warn('[Processor] Received data while not running, ignoring');
            return;
        }
        this.receiver.receiveData(data);
    };
    /**
     * Handle DTR reset
     */
    SerialMessageProcessor.prototype.onDTRReset = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dtrResetManager.onDTRReset()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle RTS reset
     */
    SerialMessageProcessor.prototype.onRTSReset = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.dtrResetManager.onRTSReset()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Register a message destination
     */
    SerialMessageProcessor.prototype.registerDestination = function (messageType, destination) {
        this.router.registerDestination(messageType, destination);
    };
    /**
     * Apply standard P2 routing configuration
     */
    SerialMessageProcessor.prototype.applyStandardRouting = function (debugLogger, windowCreator, debuggerWindow) {
        this.router.applyStandardRouting(debugLogger, windowCreator, debuggerWindow);
    };
    /**
     * Get comprehensive statistics
     */
    SerialMessageProcessor.prototype.getStats = function () {
        var uptime = this.isRunning ? Date.now() - this.startTime : 0;
        return {
            receiver: this.receiver.getStats(),
            buffer: this.buffer.getStats(),
            extractor: this.extractor.getStats(),
            router: this.router.getStats(),
            dtrReset: this.dtrResetManager.getStats(),
            isRunning: this.isRunning,
            startTime: this.startTime,
            uptime: uptime,
            performance: this.performanceMonitor.getSnapshot()
        };
    };
    /**
     * Reset all statistics
     */
    SerialMessageProcessor.prototype.resetStats = function () {
        this.receiver.resetStats();
        this.extractor.resetStats();
        this.router.resetStats();
        this.dtrResetManager.resetStats();
        this.performanceMonitor.reset();
    };
    /**
     * Clear all buffers and queues
     */
    SerialMessageProcessor.prototype.clearAll = function () {
        this.buffer.clear();
        this.extractorQueue.clear();
        this.router.getInputQueue().clear();
    };
    /**
     * Get synchronization status
     */
    SerialMessageProcessor.prototype.getSyncStatus = function () {
        return this.dtrResetManager.getSyncStatus();
    };
    /**
     * Check if system is idle
     */
    SerialMessageProcessor.prototype.isIdle = function () {
        return this.router.isIdle() &&
            !this.receiver.isExtractionPending() &&
            !this.dtrResetManager.isResetPending();
    };
    /**
     * Get component references (for testing/debugging)
     */
    SerialMessageProcessor.prototype.getComponents = function () {
        return {
            buffer: this.buffer,
            receiver: this.receiver,
            extractor: this.extractor,
            router: this.router,
            dtrResetManager: this.dtrResetManager,
            performanceMonitor: this.performanceMonitor
        };
    };
    /**
     * Simulate data reception (for testing)
     */
    SerialMessageProcessor.prototype.simulateData = function (data) {
        if (!this.isRunning) {
            this.start();
        }
        this.receiveData(Buffer.from(data));
    };
    /**
     * Wait for processing to complete
     */
    SerialMessageProcessor.prototype.waitForIdle = function () {
        return __awaiter(this, arguments, void 0, function (timeoutMs) {
            var startTime;
            var _this = this;
            if (timeoutMs === void 0) { timeoutMs = 5000; }
            return __generator(this, function (_a) {
                startTime = Date.now();
                return [2 /*return*/, new Promise(function (resolve) {
                        var checkIdle = function () {
                            if (_this.isIdle()) {
                                resolve(true);
                                return;
                            }
                            if (Date.now() - startTime > timeoutMs) {
                                resolve(false);
                                return;
                            }
                            setTimeout(checkIdle, 10);
                        };
                        checkIdle();
                    })];
            });
        });
    };
    return SerialMessageProcessor;
}(events_1.EventEmitter));
exports.SerialMessageProcessor = SerialMessageProcessor;
