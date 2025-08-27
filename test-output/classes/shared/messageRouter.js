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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.MessageRouter = void 0;
// src/classes/shared/messageRouter.ts
var events_1 = require("events");
var messageExtractor_1 = require("./messageExtractor");
/**
 * MessageRouter - Two-Tier Pattern Matching Message Routing
 *
 * Routes messages from input queue to appropriate destinations based on
 * Two-Tier Pattern Matching message types and confidence levels.
 * Implements "Terminal FIRST, Debugger SECOND" routing philosophy.
 *
 * ROUTING PHILOSOPHY:
 * - TERMINAL_OUTPUT → Main terminal (blue window) by default
 * - COG_MESSAGE → Individual COG logger windows
 * - DEBUGGER_80BYTE → COG debugger windows (creates on demand)
 * - DB_PACKET → Protocol handler for 0xDB packets
 * - P2_SYSTEM_INIT → Debug Logger + golden sync processing
 * - BACKTICK_WINDOW → Window command processor
 * - INVALID_COG → Debug Logger with warnings
 * - INCOMPLETE_DEBUG → Debug Logger with incomplete status
 *
 * CLEAN SEPARATION: This component has ZERO knowledge of:
 * - Serial port or buffer implementation details
 * - Two-Tier pattern matching algorithms
 * - Internal window creation or management
 * - Message extraction or validation logic
 *
 * It only handles:
 * - Message type-based routing decisions
 * - Destination handler invocation
 * - Queue management and async processing
 * - Routing statistics and performance monitoring
 */
var MessageRouter = /** @class */ (function (_super) {
    __extends(MessageRouter, _super);
    function MessageRouter(inputQueue) {
        var _a, _b;
        var _this = _super.call(this) || this;
        _this.processingPending = false;
        // Statistics
        _this.messagesRouted = (_a = {},
            _a[messageExtractor_1.MessageType.DB_PACKET] = 0,
            _a[messageExtractor_1.MessageType.COG_MESSAGE] = 0,
            _a[messageExtractor_1.MessageType.BACKTICK_WINDOW] = 0,
            _a[messageExtractor_1.MessageType.DEBUGGER_80BYTE] = 0,
            _a[messageExtractor_1.MessageType.P2_SYSTEM_INIT] = 0,
            _a[messageExtractor_1.MessageType.TERMINAL_OUTPUT] = 0,
            _a[messageExtractor_1.MessageType.INCOMPLETE_DEBUG] = 0,
            _a[messageExtractor_1.MessageType.INVALID_COG] = 0,
            _a);
        _this.destinationCounts = {};
        _this.routingErrors = 0;
        // Performance monitoring
        _this.performanceMonitor = null;
        _this.inputQueue = inputQueue;
        // Initialize empty routing config for Two-Tier Pattern Matching
        _this.routingConfig = (_b = {},
            _b[messageExtractor_1.MessageType.DB_PACKET] = [],
            _b[messageExtractor_1.MessageType.COG_MESSAGE] = [],
            _b[messageExtractor_1.MessageType.BACKTICK_WINDOW] = [],
            _b[messageExtractor_1.MessageType.DEBUGGER_80BYTE] = [],
            _b[messageExtractor_1.MessageType.P2_SYSTEM_INIT] = [],
            _b[messageExtractor_1.MessageType.TERMINAL_OUTPUT] = [],
            _b[messageExtractor_1.MessageType.INCOMPLETE_DEBUG] = [],
            _b[messageExtractor_1.MessageType.INVALID_COG] = [],
            _b);
        return _this;
    }
    /**
     * Set performance monitor for instrumentation
     */
    MessageRouter.prototype.setPerformanceMonitor = function (monitor) {
        this.performanceMonitor = monitor;
    };
    /**
     * Register a destination for a message type
     */
    MessageRouter.prototype.registerDestination = function (messageType, destination) {
        if (!this.routingConfig[messageType].find(function (d) { return d.name === destination.name; })) {
            this.routingConfig[messageType].push(destination);
            this.destinationCounts[destination.name] = 0;
            // Reduce registration logging noise in production
            if (process.env.NODE_ENV === 'development' || process.env.DEBUG_ROUTING) {
                console.log("[MessageRouter] Registered ".concat(destination.name, " for ").concat(messageType, " messages"));
            }
        }
    };
    /**
     * Unregister a destination
     */
    MessageRouter.prototype.unregisterDestination = function (messageType, destinationName) {
        var index = this.routingConfig[messageType].findIndex(function (d) { return d.name === destinationName; });
        if (index >= 0) {
            this.routingConfig[messageType].splice(index, 1);
            console.log("[MessageRouter] Unregistered ".concat(destinationName, " from ").concat(messageType, " messages"));
        }
    };
    /**
     * Process messages from queue
     * Called when new messages are available
     * Returns true if more processing might be needed
     */
    MessageRouter.prototype.processMessages = function () {
        var _this = this;
        if (this.processingPending) {
            return false; // Already processing
        }
        if (this.inputQueue.isEmpty()) {
            return false; // Nothing to process
        }
        // Schedule async processing
        this.processingPending = true;
        setImmediate(function () {
            _this.processMessageBatch();
        });
        return true;
    };
    /**
     * Process messages synchronously for testing
     * Returns the count of messages processed
     */
    MessageRouter.prototype.processMessagesSync = function () {
        var messagesProcessed = 0;
        var maxBatchSize = 1000; // Higher limit for testing
        while (!this.inputQueue.isEmpty() && messagesProcessed < maxBatchSize) {
            var message = this.inputQueue.dequeue();
            if (!message)
                break;
            try {
                this.routeMessage(message);
                messagesProcessed++;
            }
            catch (error) {
                console.error('[MessageRouter] Error routing message:', error);
                this.routingErrors++;
                this.emit('routingError', { message: message, error: error });
            }
        }
        if (messagesProcessed > 0) {
            this.emit('batchProcessed', messagesProcessed);
        }
        return messagesProcessed;
    };
    /**
     * Process a batch of messages
     */
    MessageRouter.prototype.processMessageBatch = function () {
        var _this = this;
        var messagesProcessed = 0;
        var maxBatchSize = 100; // Process up to 100 messages per batch
        while (!this.inputQueue.isEmpty() && messagesProcessed < maxBatchSize) {
            var message = this.inputQueue.dequeue();
            if (!message)
                break;
            try {
                this.routeMessage(message);
                messagesProcessed++;
            }
            catch (error) {
                console.error('[MessageRouter] Error routing message:', error);
                this.routingErrors++;
                this.emit('routingError', { message: message, error: error });
            }
        }
        this.processingPending = false;
        if (messagesProcessed > 0) {
            this.emit('batchProcessed', messagesProcessed);
        }
        // If queue still has messages, schedule another batch
        if (!this.inputQueue.isEmpty()) {
            setImmediate(function () {
                _this.processingPending = true;
                _this.processMessageBatch();
            });
        }
    };
    /**
     * Route a single message to its destinations
     */
    MessageRouter.prototype.routeMessage = function (message) {
        console.log("[TWO-TIER] \uD83C\uDFAF Routing message: ".concat(message.type, ", ").concat(message.data.length, " bytes"));
        var destinations = this.routingConfig[message.type];
        console.log("[TWO-TIER] \uD83C\uDFAF Found ".concat((destinations === null || destinations === void 0 ? void 0 : destinations.length) || 0, " destinations for ").concat(message.type));
        if (!destinations || destinations.length === 0) {
            console.warn("[MessageRouter] No destinations for ".concat(message.type, " message"));
            this.emit('unroutableMessage', message);
            return;
        }
        // Update statistics
        this.messagesRouted[message.type]++;
        // Record performance metrics
        if (this.performanceMonitor) {
            this.performanceMonitor.recordRouting();
            // Record latency from message timestamp to now
            this.performanceMonitor.recordMessageLatency(message.timestamp, Date.now());
        }
        // Route to each destination
        for (var _i = 0, destinations_1 = destinations; _i < destinations_1.length; _i++) {
            var destination = destinations_1[_i];
            try {
                // Copy message data if routing to multiple destinations
                var messageCopy = destinations.length > 1
                    ? this.copyMessage(message)
                    : message;
                destination.handler(messageCopy);
                this.destinationCounts[destination.name]++;
                this.emit('messageRouted', {
                    message: messageCopy,
                    destination: destination.name
                });
            }
            catch (error) {
                console.error("[MessageRouter] Error routing to ".concat(destination.name, ":"), error);
                this.routingErrors++;
                // Record routing error
                if (this.performanceMonitor) {
                    this.performanceMonitor.recordRoutingError();
                }
                this.emit('destinationError', {
                    message: message,
                    destination: destination.name,
                    error: error
                });
            }
        }
    };
    /**
     * Create a copy of message for multiple routing
     */
    MessageRouter.prototype.copyMessage = function (message) {
        return {
            type: message.type,
            data: new Uint8Array(message.data), // Copy the data array
            timestamp: message.timestamp,
            confidence: message.confidence,
            metadata: message.metadata ? __assign({}, message.metadata) : undefined
        };
    };
    /**
     * Apply standard routing configuration
     * This sets up the typical P2 message routing
     */
    MessageRouter.prototype.applyStandardRouting = function (debugLogger, windowCreator, debuggerWindow) {
        // Terminal FIRST principle - default route
        this.registerDestination(messageExtractor_1.MessageType.TERMINAL_OUTPUT, debugLogger);
        // COG messages to debug logger
        this.registerDestination(messageExtractor_1.MessageType.COG_MESSAGE, debugLogger);
        // P2 System Init to debug logger with golden sync
        this.registerDestination(messageExtractor_1.MessageType.P2_SYSTEM_INIT, debugLogger);
        // 0xDB packets to debug logger
        this.registerDestination(messageExtractor_1.MessageType.DB_PACKET, debugLogger);
        // 80-byte debugger packets to debugger windows if available
        if (debuggerWindow) {
            this.registerDestination(messageExtractor_1.MessageType.DEBUGGER_80BYTE, debuggerWindow);
        }
        // Backtick window commands to window creator
        this.registerDestination(messageExtractor_1.MessageType.BACKTICK_WINDOW, windowCreator);
        // Special cases to debug logger with warnings
        this.registerDestination(messageExtractor_1.MessageType.INVALID_COG, debugLogger);
        this.registerDestination(messageExtractor_1.MessageType.INCOMPLETE_DEBUG, debugLogger);
    };
    /**
     * Wait for queue to drain (for DTR reset scenarios)
     */
    MessageRouter.prototype.waitForQueueDrain = function () {
        return __awaiter(this, arguments, void 0, function (timeoutMs) {
            var startTime;
            var _this = this;
            if (timeoutMs === void 0) { timeoutMs = 5000; }
            return __generator(this, function (_a) {
                startTime = Date.now();
                return [2 /*return*/, new Promise(function (resolve) {
                        var checkQueue = function () {
                            if (_this.inputQueue.isEmpty() && !_this.processingPending) {
                                resolve(true);
                                return;
                            }
                            if (Date.now() - startTime > timeoutMs) {
                                console.warn('[MessageRouter] Queue drain timeout');
                                resolve(false);
                                return;
                            }
                            setTimeout(checkQueue, 10);
                        };
                        checkQueue();
                    })];
            });
        });
    };
    /**
     * Get router statistics
     */
    MessageRouter.prototype.getStats = function () {
        var queueStats = this.inputQueue.getStats();
        var totalRouted = Object.values(this.messagesRouted).reduce(function (a, b) { return a + b; }, 0);
        return {
            messagesRouted: __assign({}, this.messagesRouted),
            destinationCounts: __assign({}, this.destinationCounts),
            routingErrors: this.routingErrors,
            queueHighWaterMark: queueStats.highWaterMark,
            processingPending: this.processingPending,
            totalMessagesRouted: totalRouted
        };
    };
    /**
     * Reset statistics
     */
    MessageRouter.prototype.resetStats = function () {
        for (var key in this.messagesRouted) {
            this.messagesRouted[key] = 0;
        }
        for (var key in this.destinationCounts) {
            this.destinationCounts[key] = 0;
        }
        this.routingErrors = 0;
    };
    /**
     * Get input queue reference
     */
    MessageRouter.prototype.getInputQueue = function () {
        return this.inputQueue;
    };
    /**
     * Check if router is idle
     */
    MessageRouter.prototype.isIdle = function () {
        return this.inputQueue.isEmpty() && !this.processingPending;
    };
    /**
     * Get routing configuration (for testing/debugging)
     */
    MessageRouter.prototype.getRoutingConfig = function () {
        return __assign({}, this.routingConfig);
    };
    /**
     * Clear all destinations
     */
    MessageRouter.prototype.clearAllDestinations = function () {
        for (var messageType in this.routingConfig) {
            this.routingConfig[messageType] = [];
        }
        console.log('[MessageRouter] All destinations cleared');
    };
    return MessageRouter;
}(events_1.EventEmitter));
exports.MessageRouter = MessageRouter;
