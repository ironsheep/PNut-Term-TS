/** @format */
'use strict';
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
exports.InputForwarder = void 0;
// src/classes/shared/inputForwarder.ts
var events_1 = require("events");
var debugInputConstants_1 = require("./debugInputConstants");
/**
 * InputForwarder handles PC_KEY and PC_MOUSE commands for debug windows
 * Manages keyboard and mouse input, queues events, and forwards to P2 device
 */
var InputForwarder = /** @class */ (function (_super) {
    __extends(InputForwarder, _super);
    function InputForwarder() {
        var _this = _super.call(this) || this;
        _this.eventQueue = [];
        _this.usbSerial = null;
        _this.pollInterval = null;
        _this.isPolling = false;
        _this.dotSizeX = 1;
        _this.dotSizeY = 1;
        _this.windowWidth = 0;
        _this.windowHeight = 0;
        return _this;
    }
    /**
     * Set the USB serial connection for communication with P2
     */
    InputForwarder.prototype.setUsbSerial = function (serial) {
        this.usbSerial = serial;
    };
    /**
     * Set window dimensions for coordinate validation
     */
    InputForwarder.prototype.setWindowDimensions = function (width, height) {
        this.windowWidth = width;
        this.windowHeight = height;
    };
    /**
     * Set DOTSIZE for coordinate transformation
     */
    InputForwarder.prototype.setDotSize = function (x, y) {
        this.dotSizeX = Math.max(1, x);
        this.dotSizeY = Math.max(1, y);
    };
    /**
     * Start polling for input events
     */
    InputForwarder.prototype.startPolling = function () {
        var _this = this;
        if (this.isPolling)
            return;
        this.isPolling = true;
        this.pollInterval = setInterval(function () {
            // Wrap in promise catch to handle any errors
            _this.processEventQueue().catch(function (error) {
                // Error is already emitted in processEvent, just log for debugging
                console.error('InputForwarder: Error in processEventQueue:', error);
            });
        }, InputForwarder.POLL_INTERVAL_MS);
    };
    /**
     * Stop polling for input events
     */
    InputForwarder.prototype.stopPolling = function () {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isPolling = false;
        this.eventQueue = [];
    };
    /**
     * Queue a keyboard event
     */
    InputForwarder.prototype.queueKeyEvent = function (keyCode) {
        if (this.eventQueue.length >= InputForwarder.MAX_QUEUE_SIZE) {
            this.eventQueue.shift(); // Remove oldest event
        }
        var value = debugInputConstants_1.PC_KEY_VALUES.NO_KEYPRESS;
        if (typeof keyCode === 'string') {
            // Map special keys
            switch (keyCode.toLowerCase()) {
                case 'arrowleft':
                    value = debugInputConstants_1.PC_KEY_VALUES.LEFT_ARROW;
                    break;
                case 'arrowright':
                    value = debugInputConstants_1.PC_KEY_VALUES.RIGHT_ARROW;
                    break;
                case 'arrowup':
                    value = debugInputConstants_1.PC_KEY_VALUES.UP_ARROW;
                    break;
                case 'arrowdown':
                    value = debugInputConstants_1.PC_KEY_VALUES.DOWN_ARROW;
                    break;
                case 'home':
                    value = debugInputConstants_1.PC_KEY_VALUES.HOME;
                    break;
                case 'end':
                    value = debugInputConstants_1.PC_KEY_VALUES.END;
                    break;
                case 'delete':
                    value = debugInputConstants_1.PC_KEY_VALUES.DELETE;
                    break;
                case 'backspace':
                    value = debugInputConstants_1.PC_KEY_VALUES.BACKSPACE;
                    break;
                case 'tab':
                    value = debugInputConstants_1.PC_KEY_VALUES.TAB;
                    break;
                case 'insert':
                    value = debugInputConstants_1.PC_KEY_VALUES.INSERT;
                    break;
                case 'pageup':
                    value = debugInputConstants_1.PC_KEY_VALUES.PAGE_UP;
                    break;
                case 'pagedown':
                    value = debugInputConstants_1.PC_KEY_VALUES.PAGE_DOWN;
                    break;
                case 'enter':
                    value = debugInputConstants_1.PC_KEY_VALUES.ENTER;
                    break;
                case 'escape':
                    value = debugInputConstants_1.PC_KEY_VALUES.ESC;
                    break;
                default:
                    // Single character
                    if (keyCode.length === 1) {
                        var charCode = keyCode.charCodeAt(0);
                        if (charCode >= 32 && charCode <= 126) {
                            value = charCode;
                        }
                    }
            }
        }
        else if (typeof keyCode === 'number') {
            // Direct key code
            if (keyCode >= 0 && keyCode <= 255) {
                value = keyCode;
            }
        }
        this.eventQueue.push({
            type: 'key',
            value: value,
            timestamp: Date.now()
        });
    };
    /**
     * Queue a mouse event
     * @param x Mouse X position in window coordinates
     * @param y Mouse Y position in window coordinates
     * @param buttons Button states
     * @param wheelDelta Wheel scroll delta
     * @param pixelGetter Function to get pixel color at position
     */
    InputForwarder.prototype.queueMouseEvent = function (x, y, buttons, wheelDelta, pixelGetter) {
        if (wheelDelta === void 0) { wheelDelta = 0; }
        if (this.eventQueue.length >= InputForwarder.MAX_QUEUE_SIZE) {
            this.eventQueue.shift(); // Remove oldest event
        }
        // Transform coordinates by DOTSIZE
        var scaledX = Math.floor(x / this.dotSizeX);
        var scaledY = Math.floor(y / this.dotSizeY);
        // Check if mouse is within window bounds
        var isInBounds = scaledX >= 0 && scaledX < this.windowWidth &&
            scaledY >= 0 && scaledY < this.windowHeight;
        // Get pixel color if getter provided and in bounds
        var pixelColor = -1;
        if (isInBounds && pixelGetter) {
            pixelColor = pixelGetter(scaledX, scaledY) & 0xFFFFFF;
        }
        var status = {
            xpos: isInBounds ? scaledX : debugInputConstants_1.MOUSE_POSITION.OUTSIDE,
            ypos: isInBounds ? scaledY : debugInputConstants_1.MOUSE_POSITION.OUTSIDE,
            wheeldelta: Math.max(-1, Math.min(1, wheelDelta)), // Clamp to -1, 0, 1
            lbutton: buttons.left ? debugInputConstants_1.MOUSE_BUTTON_STATE.PRESSED : debugInputConstants_1.MOUSE_BUTTON_STATE.RELEASED,
            mbutton: buttons.middle ? debugInputConstants_1.MOUSE_BUTTON_STATE.PRESSED : debugInputConstants_1.MOUSE_BUTTON_STATE.RELEASED,
            rbutton: buttons.right ? debugInputConstants_1.MOUSE_BUTTON_STATE.PRESSED : debugInputConstants_1.MOUSE_BUTTON_STATE.RELEASED,
            pixel: pixelColor
        };
        this.eventQueue.push({
            type: 'mouse',
            status: status,
            timestamp: Date.now()
        });
    };
    /**
     * Process queued events and send to P2
     */
    InputForwarder.prototype.processEventQueue = function () {
        return __awaiter(this, void 0, void 0, function () {
            var event, error_1, errorMessage, contextualError;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.usbSerial || this.eventQueue.length === 0) {
                            return [2 /*return*/];
                        }
                        event = this.eventQueue.shift();
                        if (!event)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        if (!(event.type === 'key')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.sendKeyEvent(event.value)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        if (!(event.type === 'mouse')) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.sendMouseEvent(event.status)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                        contextualError = new Error("InputForwarder: Failed to process ".concat(event.type, " event: ").concat(errorMessage));
                        // Attach event details for debugging
                        contextualError.eventDetails = {
                            type: event.type,
                            timestamp: event.timestamp,
                            data: event.type === 'key' ? { value: event.value } : { status: event.status }
                        };
                        // Log error instead of emitting to prevent unhandled error crashes
                        console.error('InputForwarder: Event processing error:', contextualError);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send PC_KEY event to P2
     */
    InputForwarder.prototype.sendKeyEvent = function (keyValue) {
        return __awaiter(this, void 0, void 0, function () {
            var buffer, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.usbSerial) {
                            throw new Error('No USB serial connection available for PC_KEY');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        buffer = Buffer.allocUnsafe(4);
                        buffer.writeUInt32LE(keyValue, 0);
                        // Send to P2
                        return [4 /*yield*/, this.usbSerial.write(buffer.toString('base64'))];
                    case 2:
                        // Send to P2
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                        // Check if it's a disconnection error
                        if (errorMessage.includes('port is not open') || errorMessage.includes('disconnected')) {
                            this.handleDisconnection();
                        }
                        // Re-throw the error so it can be caught in processEvent
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send PC_MOUSE event to P2
     */
    InputForwarder.prototype.sendMouseEvent = function (status) {
        return __awaiter(this, void 0, void 0, function () {
            var buffer, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.usbSerial) {
                            throw new Error('No USB serial connection available for PC_MOUSE');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        buffer = Buffer.allocUnsafe(28);
                        buffer.writeInt32LE(status.xpos, 0);
                        buffer.writeInt32LE(status.ypos, 4);
                        buffer.writeInt32LE(status.wheeldelta, 8);
                        buffer.writeInt32LE(status.lbutton, 12);
                        buffer.writeInt32LE(status.mbutton, 16);
                        buffer.writeInt32LE(status.rbutton, 20);
                        buffer.writeInt32LE(status.pixel, 24);
                        // Send to P2
                        return [4 /*yield*/, this.usbSerial.write(buffer.toString('base64'))];
                    case 2:
                        // Send to P2
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : String(error_3);
                        // Check if it's a disconnection error
                        if (errorMessage.includes('port is not open') || errorMessage.includes('disconnected')) {
                            this.handleDisconnection();
                        }
                        // Re-throw the error so it can be caught in processEvent
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current queue size
     */
    InputForwarder.prototype.getQueueSize = function () {
        return this.eventQueue.length;
    };
    /**
     * Clear event queue
     */
    InputForwarder.prototype.clearQueue = function () {
        this.eventQueue = [];
    };
    Object.defineProperty(InputForwarder.prototype, "isActive", {
        /**
         * Check if currently polling
         */
        get: function () {
            return this.isPolling;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Handle disconnection by stopping polling and clearing state
     * TECH-DEBT: Enhanced error recovery for serial disconnection
     */
    InputForwarder.prototype.handleDisconnection = function () {
        // Stop polling to prevent further errors
        this.stopPolling();
        // Clear the USB serial reference to prevent further write attempts
        this.usbSerial = null;
        // Emit a disconnection event for the window to handle
        this.emit('disconnected', {
            message: 'USB serial connection lost',
            timestamp: Date.now()
        });
    };
    /**
     * Attempt to reconnect with a new USB serial instance
     * Call this after re-establishing connection in the parent window
     */
    InputForwarder.prototype.reconnect = function (serial) {
        this.usbSerial = serial;
        // Don't automatically restart polling - let the window decide
        this.emit('reconnected', {
            message: 'USB serial connection restored',
            timestamp: Date.now()
        });
    };
    InputForwarder.POLL_INTERVAL_MS = 16; // ~60Hz
    InputForwarder.MAX_QUEUE_SIZE = 100;
    return InputForwarder;
}(events_1.EventEmitter));
exports.InputForwarder = InputForwarder;
