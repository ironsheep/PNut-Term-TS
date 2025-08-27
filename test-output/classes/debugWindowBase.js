/** @format */
// this is our common logging mechanism
//  TODO: make it context/runtime option aware
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
exports.DebugWindowBase = exports.ePackedDataWidth = exports.ePackedDataMode = exports.eTextWeight = exports.eHorizJustification = exports.eVertJustification = void 0;
var jimp_1 = require("jimp");
var fs = require("fs");
var path = require("path");
var events_1 = require("events");
var files_1 = require("../utils/files");
var spin2NumericParser_1 = require("./shared/spin2NumericParser");
var inputForwarder_1 = require("./shared/inputForwarder");
var windowRouter_1 = require("./shared/windowRouter");
var messageQueue_1 = require("./shared/messageQueue");
var eVertJustification;
(function (eVertJustification) {
    eVertJustification[eVertJustification["VJ_UNKNOWN"] = 1] = "VJ_UNKNOWN";
    eVertJustification[eVertJustification["VJ_TOP"] = 3] = "VJ_TOP";
    eVertJustification[eVertJustification["VJ_MIDDLE"] = 0] = "VJ_MIDDLE";
    eVertJustification[eVertJustification["VJ_BOTTOM"] = 2] = "VJ_BOTTOM";
})(eVertJustification || (exports.eVertJustification = eVertJustification = {}));
var eHorizJustification;
(function (eHorizJustification) {
    eHorizJustification[eHorizJustification["HJ_UNKNOWN"] = 1] = "HJ_UNKNOWN";
    eHorizJustification[eHorizJustification["HJ_LEFT"] = 3] = "HJ_LEFT";
    eHorizJustification[eHorizJustification["HJ_CENTER"] = 0] = "HJ_CENTER";
    eHorizJustification[eHorizJustification["HJ_RIGHT"] = 2] = "HJ_RIGHT";
})(eHorizJustification || (exports.eHorizJustification = eHorizJustification = {}));
var eTextWeight;
(function (eTextWeight) {
    eTextWeight[eTextWeight["TW_UNKNOWN"] = 0] = "TW_UNKNOWN";
    eTextWeight[eTextWeight["TW_LIGHT"] = 1] = "TW_LIGHT";
    eTextWeight[eTextWeight["TW_NORMAL"] = 2] = "TW_NORMAL";
    eTextWeight[eTextWeight["TW_BOLD"] = 3] = "TW_BOLD";
    eTextWeight[eTextWeight["TW_HEAVY"] = 4] = "TW_HEAVY"; // 900
})(eTextWeight || (exports.eTextWeight = eTextWeight = {}));
var ePackedDataMode;
(function (ePackedDataMode) {
    ePackedDataMode[ePackedDataMode["PDM_UNKNOWN"] = 0] = "PDM_UNKNOWN";
    ePackedDataMode[ePackedDataMode["PDM_LONGS_1BIT"] = 1] = "PDM_LONGS_1BIT";
    ePackedDataMode[ePackedDataMode["PDM_LONGS_2BIT"] = 2] = "PDM_LONGS_2BIT";
    ePackedDataMode[ePackedDataMode["PDM_LONGS_4BIT"] = 3] = "PDM_LONGS_4BIT";
    ePackedDataMode[ePackedDataMode["PDM_LONGS_8BIT"] = 4] = "PDM_LONGS_8BIT";
    ePackedDataMode[ePackedDataMode["PDM_LONGS_16BIT"] = 5] = "PDM_LONGS_16BIT";
    ePackedDataMode[ePackedDataMode["PDM_WORDS_1BIT"] = 6] = "PDM_WORDS_1BIT";
    ePackedDataMode[ePackedDataMode["PDM_WORDS_2BIT"] = 7] = "PDM_WORDS_2BIT";
    ePackedDataMode[ePackedDataMode["PDM_WORDS_4BIT"] = 8] = "PDM_WORDS_4BIT";
    ePackedDataMode[ePackedDataMode["PDM_WORDS_8BIT"] = 9] = "PDM_WORDS_8BIT";
    ePackedDataMode[ePackedDataMode["PDM_BYTES_1BIT"] = 10] = "PDM_BYTES_1BIT";
    ePackedDataMode[ePackedDataMode["PDM_BYTES_2BIT"] = 11] = "PDM_BYTES_2BIT";
    ePackedDataMode[ePackedDataMode["PDM_BYTES_4BIT"] = 12] = "PDM_BYTES_4BIT";
})(ePackedDataMode || (exports.ePackedDataMode = ePackedDataMode = {}));
var ePackedDataWidth;
(function (ePackedDataWidth) {
    ePackedDataWidth[ePackedDataWidth["PDW_UNKNOWN"] = 0] = "PDW_UNKNOWN";
    ePackedDataWidth[ePackedDataWidth["PDW_BYTES"] = 1] = "PDW_BYTES";
    ePackedDataWidth[ePackedDataWidth["PDW_WORDS"] = 2] = "PDW_WORDS";
    ePackedDataWidth[ePackedDataWidth["PDW_LONGS"] = 3] = "PDW_LONGS";
})(ePackedDataWidth || (exports.ePackedDataWidth = ePackedDataWidth = {}));
var DebugWindowBase = /** @class */ (function (_super) {
    __extends(DebugWindowBase, _super);
    function DebugWindowBase(ctx, windowId, windowType) {
        var _this = _super.call(this) || this;
        _this.windowLogPrefix = '?Base?'; // default if not overridden
        _this.isLogging = true; // WARNING (REMOVE BEFORE FLIGHT)- change to 'false' - disable before commit
        _this._debugWindow = null;
        _this._saveInProgress = false;
        _this.isClosing = false; // Prevent recursive close handling
        _this.wheelTimer = null;
        _this.lastWheelDelta = 0;
        _this.isRegisteredWithRouter = false;
        _this.isWindowReady = false;
        _this.context = ctx;
        _this.inputForwarder = new inputForwarder_1.InputForwarder();
        _this.windowRouter = windowRouter_1.WindowRouter.getInstance();
        _this.windowId = windowId;
        _this.windowType = windowType;
        // Initialize startup message queue 
        // Will transition to BatchedMessageQueue when window is ready
        _this.messageQueue = new messageQueue_1.MessageQueue(1000, 5000);
        // Phase 1: Register window instance immediately for early message routing
        _this.windowRouter.registerWindowInstance(_this.windowId, _this.windowType, _this);
        return _this;
    }
    /**
     * Public method for updating content. Handles queuing if window not ready.
     * Derived classes should NOT override this - override processMessageImmediate instead.
     */
    DebugWindowBase.prototype.updateContent = function (lineParts) {
        if (this.isWindowReady) {
            // Window is ready, process immediately
            this.processMessageImmediate(lineParts);
        }
        else {
            // Window not ready yet, queue the message
            var queued = this.messageQueue.enqueue(lineParts);
            if (queued) {
                this.logMessageBase("- Queued message for ".concat(this.windowType, " (").concat(this.messageQueue.size, " in queue)"));
            }
            else {
                this.logMessageBase("- WARNING: Message queue full for ".concat(this.windowType, ", message dropped"));
            }
        }
    };
    DebugWindowBase.calcMetricsForFontPtSize = function (fontSize, metrics) {
        metrics.textSizePts = fontSize;
        metrics.charHeight = Math.round(metrics.textSizePts * 1.333);
        metrics.charWidth = Math.round(metrics.charHeight * 0.6);
        metrics.lineHeight = Math.round(metrics.charHeight * 1.3); // 120%-140% using 130% of text height
        metrics.baseline = Math.round(metrics.charHeight * 0.7 + 0.5); // 20%-30% from bottom (force round up)
    };
    Object.defineProperty(DebugWindowBase.prototype, "saveInProgress", {
        get: function () {
            return this._saveInProgress;
        },
        set: function (value) {
            this._saveInProgress = value;
            this.logMessageBase("-> saveInProgress=(".concat(value, ")"));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DebugWindowBase.prototype, "debugWindow", {
        // Getter for debugWindow property
        get: function () {
            return this._debugWindow;
        },
        // Setter for debugWindow property
        set: function (window) {
            if (window != null) {
                this.logMessageBase("- New ".concat(this.constructor.name, " window"));
                this._debugWindow = window;
                // Add OTHER event listeners as needed
            }
            else {
                // Prevent recursive close handling
                if (this.isClosing) {
                    this.logMessageBase("- Already closing ".concat(this.constructor.name, " window, preventing recursion"));
                    return;
                }
                this.isClosing = true;
                this.logMessageBase("- Closing ".concat(this.constructor.name, " window"));
                // Reset window ready state and clear any pending messages
                this.isWindowReady = false;
                // Stop batch processing if it's a BatchedMessageQueue
                if (this.messageQueue instanceof messageQueue_1.BatchedMessageQueue) {
                    this.messageQueue.stopBatchProcessing();
                }
                this.messageQueue.clear();
                // Unregister from WindowRouter
                this.unregisterFromRouter();
                // Stop input forwarding
                this.inputForwarder.stopPolling();
                // Clear wheel timer
                if (this.wheelTimer) {
                    clearTimeout(this.wheelTimer);
                    this.wheelTimer = null;
                }
                // Remove event listeners and close the window
                if (this._debugWindow != null && !this._debugWindow.isDestroyed()) {
                    this.logMessageBase("- ".concat(this.constructor.name, " window closing..."));
                    this.emit('close'); // forward the event
                    this._debugWindow.removeAllListeners();
                    this._debugWindow.close();
                    this.logMessageBase("- ".concat(this.constructor.name, " window closed"));
                    this.emit('closed'); // forward the event
                }
                this._debugWindow = null;
                this.isClosing = false;
            }
        },
        enumerable: false,
        configurable: true
    });
    // ----------------------------------------------------------------------
    // WindowRouter integration methods
    // ----------------------------------------------------------------------
    /**
     * Mark window as ready and process any queued messages.
     * Should be called by derived classes when their window is fully initialized.
     */
    DebugWindowBase.prototype.onWindowReady = function () {
        if (this.isWindowReady) {
            this.logMessageBase("- Window already marked as ready");
            return;
        }
        this.isWindowReady = true;
        this.logMessageBase("- Window marked as ready for ".concat(this.windowType));
        // Process any queued messages
        if (!this.messageQueue.isEmpty) {
            var stats = this.messageQueue.getStats();
            this.logMessageBase("- Processing ".concat(stats.currentSize, " queued messages"));
            // Process all queued messages
            var queuedMessages = this.messageQueue.dequeueAll();
            for (var _i = 0, queuedMessages_1 = queuedMessages; _i < queuedMessages_1.length; _i++) {
                var message = queuedMessages_1[_i];
                try {
                    this.processMessageImmediate(message);
                }
                catch (error) {
                    this.logMessageBase("- Error processing queued message: ".concat(error));
                }
            }
            // Log stats if there were dropped messages
            if (stats.droppedCount > 0) {
                this.logMessageBase("- WARNING: ".concat(stats.droppedCount, " messages were dropped from queue"));
            }
        }
        // CRITICAL: Use immediate processing to prevent message reordering
        // P2 Architecture Rule: "There should never, never, never be any message reordering"
        this.logMessageBase("- Transitioning to IMMEDIATE processing (no batching delays)");
        var oldQueue = this.messageQueue;
        // Use simple MessageQueue for immediate processing (no batching)
        this.messageQueue = new messageQueue_1.MessageQueue(1000, // maxSize: 1000 messages  
        5000 // maxAgeMs: 5 second expiry
        );
        // Clean up old startup queue
        oldQueue.clear();
        this.logMessageBase("- Immediate processing active (zero delay)");
    };
    /**
     * Register this window with WindowRouter for message routing
     * Should be called when the window is ready to receive messages
     */
    DebugWindowBase.prototype.registerWithRouter = function () {
        if (!this.isRegisteredWithRouter) {
            try {
                this.windowRouter.registerWindow(this.windowId, this.windowType, this.handleRouterMessage.bind(this));
                this.isRegisteredWithRouter = true;
                this.logMessageBase("- Registered with WindowRouter: ".concat(this.windowId, " (").concat(this.windowType, ")"));
                // Mark window as ready when registered with router
                this.onWindowReady();
            }
            catch (error) {
                this.logMessageBase("- Failed to register with WindowRouter: ".concat(error));
            }
        }
    };
    /**
     * Unregister this window from WindowRouter
     * Should be called when window is closing
     */
    DebugWindowBase.prototype.unregisterFromRouter = function () {
        if (this.isRegisteredWithRouter) {
            this.windowRouter.unregisterWindow(this.windowId);
            this.isRegisteredWithRouter = false;
            this.logMessageBase("- Unregistered from WindowRouter: ".concat(this.windowId));
        }
    };
    /**
     * Handle messages from WindowRouter
     * This method processes both SerialMessage objects and raw data
     */
    DebugWindowBase.prototype.handleRouterMessage = function (message) {
        try {
            if (typeof message === 'string') {
                // Text message - parse and process
                var lineParts = message.split(' ');
                this.updateContent(lineParts);
            }
            else if (message instanceof Uint8Array) {
                // Binary data - pass through as-is for windows that handle binary
                // DebugLoggerWindow and DebugDebuggerWindow need raw binary
                this.updateContent(message);
            }
            else if (typeof message === 'object' && message.type && message.data) {
                // SerialMessage object
                if (message.type === 'text' && typeof message.data === 'string') {
                    var lineParts = message.data.split(' ');
                    this.updateContent(lineParts);
                }
                else if (message.type === 'binary' && message.data instanceof Uint8Array) {
                    // Handle binary data - pass through as-is
                    this.updateContent(message.data);
                }
            }
        }
        catch (error) {
            this.logMessageBase("- Error handling router message: ".concat(error));
        }
    };
    /**
     * Get window information for WindowRouter
     */
    DebugWindowBase.prototype.getWindowInfo = function () {
        return {
            windowId: this.windowId,
            windowType: this.windowType,
            isRegistered: this.isRegisteredWithRouter
        };
    };
    // ----------------------------------------------------------------------
    // CLASS (static) methods
    //   NOTE: static since used by derived class static methods
    DebugWindowBase.getValidRgb24 = function (possColorValue) {
        var rgbValue = '#a5a5a5'; // gray for unknown color
        var isValid = false;
        // First try to parse as a color name using DebugColor
        var colorNameToHex = {
            BLACK: '#000000',
            WHITE: '#ffffff',
            ORANGE: '#ff6600',
            BLUE: '#0080ff',
            GREEN: '#00ff00',
            CYAN: '#00ffff',
            RED: '#ff0000',
            MAGENTA: '#ff00ff',
            YELLOW: '#ffff00',
            BROWN: '#906020',
            GRAY: '#808080',
            GREY: '#808080' // Alternative spelling
        };
        var upperColorName = possColorValue.toUpperCase();
        if (colorNameToHex[upperColorName]) {
            rgbValue = colorNameToHex[upperColorName];
            isValid = true;
        }
        else {
            // Try to parse as numeric value using Spin2NumericParser
            // This supports hex ($RRGGBB), decimal, binary (%), and quaternary (%%) formats
            var colorValue = spin2NumericParser_1.Spin2NumericParser.parseColor(possColorValue);
            if (colorValue !== null) {
                // Convert to hex string format #RRGGBB
                rgbValue = '#' + colorValue.toString(16).padStart(6, '0').toLowerCase();
                isValid = true;
            }
        }
        return [isValid, rgbValue];
    };
    DebugWindowBase.calcStyleFrom = function (vJust, hJust, weight, underline, italic) {
        if (underline === void 0) { underline = false; }
        if (italic === void 0) { italic = false; }
        // build styleStr is now a bitfield string of 8 bits
        // style is %YYXXUIWW:
        //   %YY is vertical justification: %00 = middle, %10 = bottom, %11 = top.
        //   %XX is horizontal justification: %00 = middle, %10 = right, %11 = left.
        //   %U is underline: %1 = underline.
        //   %I is italic: %1 = italic.
        //   %WW is weight: %00 = light, %01 = normal, %10 = bold, and %11 = heavy.
        var styleStr = '0b';
        switch (vJust) {
            case eVertJustification.VJ_MIDDLE:
                styleStr += '00';
                break;
            case eVertJustification.VJ_BOTTOM:
                styleStr += '10';
                break;
            case eVertJustification.VJ_TOP:
                styleStr += '11';
                break;
            default:
                styleStr += '00';
                break;
        }
        switch (hJust) {
            case eHorizJustification.HJ_CENTER:
                styleStr += '00';
                break;
            case eHorizJustification.HJ_RIGHT:
                styleStr += '10';
                break;
            case eHorizJustification.HJ_LEFT:
                styleStr += '11';
                break;
            default:
                styleStr += '00';
                break;
        }
        styleStr += underline ? '1' : '0';
        styleStr += italic ? '1' : '0';
        switch (weight) {
            case eTextWeight.TW_LIGHT:
                styleStr += '00';
                break;
            case eTextWeight.TW_NORMAL:
                styleStr += '01';
                break;
            case eTextWeight.TW_BOLD:
                styleStr += '10';
                break;
            case eTextWeight.TW_HEAVY:
                styleStr += '11';
                break;
            default:
                styleStr += '01';
                break;
        }
        // return numeric value of string
        var value = Number(styleStr);
        console.log("Win: str=[".concat(styleStr, "] -> value=(").concat(value, ")"));
        return value;
    };
    DebugWindowBase.calcStyleFromBitfield = function (style, textStyle) {
        // convert number into a bitfield string
        var styleStr = style.toString(2).padStart(8, '0');
        // styleStr is now a bitfield string of 8 bits
        // style is %YYXXUIWW:
        //   %YY is vertical justification: %00 = middle, %10 = bottom, %11 = top.
        //   %XX is horizontal justification: %00 = middle, %10 = right, %11 = left.
        //   %U is underline: %1 = underline.
        //   %I is italic: %1 = italic.
        //   %WW is weight: %00 = light, %01 = normal, %10 = bold, and %11 = heavy.
        if (styleStr.length == 8) {
            textStyle.vertAlign = parseInt(styleStr.substring(0, 2), 2);
            textStyle.horizAlign = parseInt(styleStr.substring(2, 4), 2);
            textStyle.underline = styleStr[4] === '1';
            textStyle.italic = styleStr[5] === '1';
            var weight = parseInt(styleStr.substring(6, 8), 2);
            switch (weight) {
                case 0:
                    textStyle.weight = eTextWeight.TW_LIGHT;
                    break;
                case 1:
                    textStyle.weight = eTextWeight.TW_NORMAL;
                    break;
                case 2:
                    textStyle.weight = eTextWeight.TW_BOLD;
                    break;
                case 3:
                    textStyle.weight = eTextWeight.TW_HEAVY;
                    break;
                default:
                    textStyle.weight = eTextWeight.TW_NORMAL;
                    break;
            }
        }
        else {
            console.log("Win: ERROR:: Invalid style string(8): [".concat(styleStr, "](").concat(styleStr.length, ")"));
        }
        console.log("Win: str=[".concat(styleStr, "] -> textStyle: ").concat(JSON.stringify(textStyle)));
    };
    // ----------------------------------------------------------------------
    // inherited by derived classes
    DebugWindowBase.prototype.fontWeightName = function (style) {
        var weightName = 'normal';
        switch (style.weight) {
            case eTextWeight.TW_LIGHT:
                weightName = 'light';
                break;
            case eTextWeight.TW_NORMAL:
                weightName = 'normal';
                break;
            case eTextWeight.TW_BOLD:
                weightName = 'bold';
                break;
            case eTextWeight.TW_HEAVY:
                weightName = 'heavy';
                break;
        }
        return weightName;
    };
    // MOVED TO PackedDataProcessor class - commented out but not deleted
    /*
    protected isPackedDataMode(possibleMode: string): [boolean, PackedDataMode] {
      let havePackedDataStatus: boolean = false;
      let desiredMode: PackedDataMode = {
        mode: ePackedDataMode.PDM_UNKNOWN,
        bitsPerSample: 0,
        valueSize: ePackedDataWidth.PDW_UNKNOWN,
        isAlternate: false,
        isSigned: false
      };
      // define hash where key is mode string and value is ePackedDataMode
      const modeMap = new Map<string, ePackedDataMode>([
        ['longs_1bit', ePackedDataMode.PDM_LONGS_1BIT],
        ['longs_2bit', ePackedDataMode.PDM_LONGS_2BIT],
        ['longs_4bit', ePackedDataMode.PDM_LONGS_4BIT],
        ['longs_8bit', ePackedDataMode.PDM_LONGS_8BIT],
        ['longs_16bit', ePackedDataMode.PDM_LONGS_16BIT],
        ['words_1bit', ePackedDataMode.PDM_WORDS_1BIT],
        ['words_2bit', ePackedDataMode.PDM_WORDS_2BIT],
        ['words_4bit', ePackedDataMode.PDM_WORDS_4BIT],
        ['words_8bit', ePackedDataMode.PDM_WORDS_8BIT],
        ['bytes_1bit', ePackedDataMode.PDM_BYTES_1BIT],
        ['bytes_2bit', ePackedDataMode.PDM_BYTES_2BIT],
        ['bytes_4bit', ePackedDataMode.PDM_BYTES_4BIT]
      ]);
      // if possible mode matches key in modeMap, then set mode and return true
      if (modeMap.has(possibleMode.toLocaleLowerCase())) {
        desiredMode.mode = modeMap.get(possibleMode.toLocaleLowerCase()) as ePackedDataMode;
        havePackedDataStatus = true;
        // now set our bitsPerSample based on new mode
        switch (desiredMode.mode) {
          case ePackedDataMode.PDM_LONGS_1BIT:
          case ePackedDataMode.PDM_WORDS_1BIT:
          case ePackedDataMode.PDM_BYTES_1BIT:
            desiredMode.bitsPerSample = 1;
            break;
          case ePackedDataMode.PDM_LONGS_2BIT:
          case ePackedDataMode.PDM_WORDS_2BIT:
          case ePackedDataMode.PDM_BYTES_2BIT:
            desiredMode.bitsPerSample = 2;
            break;
          case ePackedDataMode.PDM_LONGS_4BIT:
          case ePackedDataMode.PDM_WORDS_4BIT:
          case ePackedDataMode.PDM_BYTES_4BIT:
            desiredMode.bitsPerSample = 4;
            break;
          case ePackedDataMode.PDM_LONGS_8BIT:
          case ePackedDataMode.PDM_WORDS_8BIT:
            desiredMode.bitsPerSample = 8;
            break;
          case ePackedDataMode.PDM_LONGS_16BIT:
            desiredMode.bitsPerSample = 16;
            break;
          default:
            desiredMode.bitsPerSample = 0;
            break;
        }
        // now set our desiredMode.valueSize based on new mode
        switch (desiredMode.mode) {
          case ePackedDataMode.PDM_LONGS_1BIT:
          case ePackedDataMode.PDM_LONGS_2BIT:
          case ePackedDataMode.PDM_LONGS_4BIT:
          case ePackedDataMode.PDM_LONGS_8BIT:
          case ePackedDataMode.PDM_LONGS_16BIT:
            desiredMode.valueSize = ePackedDataWidth.PDW_LONGS;
            break;
          case ePackedDataMode.PDM_WORDS_1BIT:
          case ePackedDataMode.PDM_WORDS_2BIT:
          case ePackedDataMode.PDM_WORDS_4BIT:
          case ePackedDataMode.PDM_WORDS_8BIT:
            desiredMode.valueSize = ePackedDataWidth.PDW_WORDS;
            break;
          case ePackedDataMode.PDM_BYTES_1BIT:
          case ePackedDataMode.PDM_BYTES_2BIT:
          case ePackedDataMode.PDM_BYTES_4BIT:
            desiredMode.valueSize = ePackedDataWidth.PDW_BYTES;
            break;
          default:
            desiredMode.valueSize = ePackedDataWidth.PDW_UNKNOWN;
            break;
        }
      }
      if (havePackedDataStatus == true) {
        // only log attempt if is valid
        this.logMessageBase(
          `packedDataMode(${possibleMode}): isValid=(${havePackedDataStatus})  -> ${
            (JSON.stringify(desiredMode), null, 2)
          }`
        );
      }
      return [havePackedDataStatus, desiredMode];
    }
    */
    DebugWindowBase.prototype.signExtend = function (value, signBitNbr) {
        // Create a mask to zero out all bits above the sign bit
        var mask = (1 << (signBitNbr + 1)) - 1;
        value &= mask;
        // Check if the sign bit is set
        var isNegative = (value & (1 << signBitNbr)) !== 0;
        if (isNegative) {
            // If the sign bit is set, convert the value to a negative number
            value = value - (1 << (signBitNbr + 1));
        }
        return value;
    };
    // MOVED TO PackedDataProcessor class - commented out but not deleted
    /*
    protected possiblyUnpackData(numericValue: number, mode: PackedDataMode): number[] {
      const sampleSet: number[] = [];
      // FIXME: add ALT and SIGNED support
      if (mode.mode == ePackedDataMode.PDM_UNKNOWN) {
        sampleSet.push(numericValue);
      } else {
        // unpack the data based on configured mode generating a list of samples
        // we have a single value which according to packed mode we need to unpack
        switch (mode.valueSize) {
          case ePackedDataWidth.PDW_BYTES:
            // we have data as a byte [0-255] 8-bits
            switch (mode.bitsPerSample) {
              case 1:
                // we have data as 8 single bit samples
                // push each bit as a sample from LSB to MSB
                for (let index = 0; index < 8; index++) {
                  sampleSet.push((numericValue >> index) & 0x01);
                }
                break;
  
              case 2:
                // we have data as 4 2-bit samples
                // push each 2bits as a sample from LSB to MSB
                for (let index = 0; index < 4; index++) {
                  sampleSet.push((numericValue >> (index * 2)) & 0x03);
                }
                break;
  
              case 4:
                // we have data as 2 4-bit samples
                // push each 4bits as a sample from LSB to MSB
                for (let index = 0; index < 2; index++) {
                  sampleSet.push((numericValue >> (index * 4)) & 0x0f);
                }
                break;
  
              default:
                break;
            }
            break;
  
          case ePackedDataWidth.PDW_WORDS:
            // we have data as a word [0-65535] 16-bits
            switch (mode.bitsPerSample) {
              case 1:
                // we have data as 16 single bit samples
                // push each bit as a sample from LSB to MSB
                for (let index = 0; index < 16; index++) {
                  sampleSet.push((numericValue >> index) & 0x01);
                }
                break;
              case 2:
                // we have data as 8 2-bit samples
                // push each 2bits as a sample from LSB to MSB
                for (let index = 0; index < 8; index++) {
                  sampleSet.push((numericValue >> (index * 2)) & 0x03);
                }
                break;
              case 4:
                // we have data as 4 4-bit samples
                // push each 4bits as a sample from LSB to MSB
                for (let index = 0; index < 4; index++) {
                  sampleSet.push((numericValue >> (index * 4)) & 0x0f);
                }
                break;
              case 8:
                // we have data as 2 8-bit samples
                // push each 8bits as a sample from LSB to MSB
                for (let index = 0; index < 2; index++) {
                  sampleSet.push((numericValue >> (index * 8)) & 0xff);
                }
                break;
  
              default:
                break;
            }
            break;
  
          case ePackedDataWidth.PDW_LONGS:
            // we have data as a long 32-bits
            switch (mode.bitsPerSample) {
              case 1:
                // we have data as 32 single bit samples
                // push each bit as a sample from LSB to MSB
                for (let index = 0; index < 32; index++) {
                  sampleSet.push((numericValue >> index) & 0x01);
                }
                break;
              case 2:
                // we have data as 16 2-bit samples
                // push each 2bits as a sample from LSB to MSB
                for (let index = 0; index < 16; index++) {
                  sampleSet.push((numericValue >> (index * 2)) & 0x03);
                }
                break;
              case 4:
                // we have data as 8 4-bit samples
                // push each 4bits as a sample from LSB to MSB
                for (let index = 0; index < 8; index++) {
                  sampleSet.push((numericValue >> (index * 4)) & 0x0f);
                }
                break;
              case 8:
                // we have data as 4 8-bit samples
                // push each 8bits as a sample from LSB to MSB
                for (let index = 0; index < 4; index++) {
                  sampleSet.push((numericValue >> (index * 8)) & 0xff);
                }
                break;
              case 16:
                // we have data as 2 16-bit samples
                // push each 16bits as a sample from LSB to MSB
                for (let index = 0; index < 2; index++) {
                  sampleSet.push((numericValue >> (index * 16)) & 0xffff);
                }
                break;
              default:
                break;
            }
            break;
  
          default:
            break;
        }
        // if SIGNED then sign extend each sample
        if (mode.isSigned) {
          for (let index = 0; index < sampleSet.length; index++) {
            sampleSet[index] = this.signExtend(sampleSet[index], mode.bitsPerSample - 1);
          }
        }
        // if ALT the alternate the samples
        // FIXME: UNDONE add code here to recorder the samples
      }
  
      // Return the list of samples
      //this.logMessageBase(`unpackData(${numericValue}), -> sampleSet=[${JSON.stringify(sampleSet, null, 2)}]`);
      return sampleSet;
    }
    */
    DebugWindowBase.prototype.isSpinNumber = function (value) {
        var isValieSpin2Number = false;
        var spin2Value = 0;
        // all numbers can contain '_' as digit separator
        // NOTE: technically '_' can only be after first digit but this is compiler output we are parsing so
        //   we assume it's correct and ignore this rule
        var spin2ValueStr = value.replace(/_/g, '');
        // check if starts with base-prefix '%' and rest is binary number [0-1]
        if (spin2ValueStr[0] === '%' && /^[01]+$/.test(spin2ValueStr.substring(1))) {
            spin2Value = parseInt(spin2ValueStr.substring(1), 2);
            isValieSpin2Number = true;
        }
        // check if starts with base-prefix '%%' and rest is double-binary number [0-3]
        if (spin2ValueStr.substring(0, 2) === '%%' && /^[0-3]+$/.test(spin2ValueStr.substring(2))) {
            spin2Value = parseInt(spin2ValueStr.substring(2), 4);
            isValieSpin2Number = true;
        }
        // check if starts with base-prefix '$' and rest is hex number [0-9A-Fa-f]
        if (spin2ValueStr[0] === '$' && /^[0-9A-Fa-f]+$/.test(spin2ValueStr.substring(1))) {
            spin2Value = parseInt(spin2ValueStr.substring(1), 16);
            isValieSpin2Number = true;
        }
        // check if NO base-prefix or '.', (may have option leading '-' or '+') and rest is decimal number [0-9]
        if (/^[-+]?[0-9]+$/.test(spin2ValueStr)) {
            spin2Value = parseInt(spin2ValueStr, 10);
            isValieSpin2Number = true;
        }
        // check if value contains '.' or 'e' or 'E' then it is a float number (may have option leading '-' or '+') rest is non[eE.] are decimal digits [0-9]
        if (/^[-+]?[0-9]+[eE.]?[0-9]+$/.test(spin2ValueStr)) {
            spin2Value = parseFloat(spin2ValueStr);
            isValieSpin2Number = true;
        }
        this.logMessageBase("isSpinNumber(".concat(value, "): isValid=(").concat(isValieSpin2Number, ")  -> (").concat(spin2Value, ")"));
        return [isValieSpin2Number, spin2Value];
    };
    DebugWindowBase.prototype.saveWindowToBMPFilename = function (filename) {
        return __awaiter(this, void 0, void 0, function () {
            var pngBuffer, bmpBuffer, outputFSpec;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this._debugWindow) return [3 /*break*/, 3];
                        this.logMessage("  -- writing BMP to [".concat(filename, "]"));
                        this.saveInProgress = true;
                        return [4 /*yield*/, this.captureWindowAsPNG(this._debugWindow)];
                    case 1:
                        pngBuffer = _a.sent();
                        return [4 /*yield*/, this.convertPNGtoBMP(pngBuffer)];
                    case 2:
                        bmpBuffer = _a.sent();
                        try {
                            outputFSpec = (0, files_1.localFSpecForFilename)(this.context, filename, '.bmp');
                            fs.writeFileSync(outputFSpec, bmpBuffer);
                            this.logMessageBase("- BMP image [".concat(outputFSpec, "] saved successfully"));
                        }
                        catch (error) {
                            console.error('Win: ERROR: saving BMP image:', error);
                        }
                        this.saveInProgress = false;
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    DebugWindowBase.prototype.removeStringQuotes = function (quotedString) {
        // remove leading and trailing quotes (' or ") if present
        var value = quotedString;
        if (value.length > 1) {
            if ((value[0] === '"' && value[value.length - 1] === '"') ||
                (value[0] === "'" && value[value.length - 1] === "'")) {
                value = value.substring(1, value.length - 1);
            }
        }
        return value;
    };
    DebugWindowBase.prototype.getParallaxFontUrl = function () {
        // In packaged app, use process.resourcesPath, in dev use relative path
        var resourcesPath = process.resourcesPath || path.join(__dirname, '../../../');
        var fontPath = path.join(resourcesPath, 'fonts', 'Parallax.ttf');
        // Convert to file URL with forward slashes for cross-platform compatibility
        return "file://".concat(fontPath.replace(/\\/g, '/'));
    };
    // ----------------------------------------------------------------------
    // Mouse and Keyboard Input Support Methods
    /**
     * Enable keyboard input forwarding for PC_KEY command
     */
    DebugWindowBase.prototype.enableKeyboardInput = function () {
        this.logMessageBase('Enabling keyboard input forwarding');
        this.inputForwarder.startPolling();
        if (this.debugWindow) {
            this.debugWindow.webContents.executeJavaScript("\n        document.addEventListener('keydown', (event) => {\n          if (window.electronAPI && window.electronAPI.sendKeyEvent) {\n            window.electronAPI.sendKeyEvent(event.key, event.keyCode, event.shiftKey, event.ctrlKey, event.altKey);\n          }\n        });\n      ");
        }
    };
    /**
     * Enable mouse input forwarding for PC_MOUSE command
     * Derived classes should override getMouseCoordinateTransform() to provide window-specific transformations
     */
    DebugWindowBase.prototype.enableMouseInput = function () {
        this.logMessageBase('Enabling mouse input forwarding');
        this.inputForwarder.startPolling();
        if (this.debugWindow) {
            // Get canvas ID from derived class
            var canvasId = this.getCanvasId();
            this.debugWindow.webContents.executeJavaScript("\n        const canvas = document.getElementById('".concat(canvasId, "');\n        if (canvas) {\n          let mouseButtons = { left: false, middle: false, right: false };\n          \n          // Mouse move handler\n          canvas.addEventListener('mousemove', (event) => {\n            const rect = canvas.getBoundingClientRect();\n            const x = event.clientX - rect.left;\n            const y = event.clientY - rect.top;\n            \n            if (window.electronAPI && window.electronAPI.sendMouseEvent) {\n              window.electronAPI.sendMouseEvent(x, y, mouseButtons, 0);\n            }\n          });\n          \n          // Mouse button handlers\n          canvas.addEventListener('mousedown', (event) => {\n            if (event.button === 0) mouseButtons.left = true;\n            else if (event.button === 1) mouseButtons.middle = true;\n            else if (event.button === 2) mouseButtons.right = true;\n            \n            const rect = canvas.getBoundingClientRect();\n            const x = event.clientX - rect.left;\n            const y = event.clientY - rect.top;\n            \n            if (window.electronAPI && window.electronAPI.sendMouseEvent) {\n              window.electronAPI.sendMouseEvent(x, y, mouseButtons, 0);\n            }\n          });\n          \n          canvas.addEventListener('mouseup', (event) => {\n            if (event.button === 0) mouseButtons.left = false;\n            else if (event.button === 1) mouseButtons.middle = false;\n            else if (event.button === 2) mouseButtons.right = false;\n            \n            const rect = canvas.getBoundingClientRect();\n            const x = event.clientX - rect.left;\n            const y = event.clientY - rect.top;\n            \n            if (window.electronAPI && window.electronAPI.sendMouseEvent) {\n              window.electronAPI.sendMouseEvent(x, y, mouseButtons, 0);\n            }\n          });\n          \n          // Mouse wheel handler with 100ms debounce\n          canvas.addEventListener('wheel', (event) => {\n            event.preventDefault();\n            const delta = Math.sign(event.deltaY) * -1; // Normalize to -1, 0, 1\n            \n            const rect = canvas.getBoundingClientRect();\n            const x = event.clientX - rect.left;\n            const y = event.clientY - rect.top;\n            \n            if (window.electronAPI && window.electronAPI.sendMouseEvent) {\n              window.electronAPI.sendMouseEvent(x, y, mouseButtons, delta);\n            }\n          });\n          \n          // Mouse leave handler\n          canvas.addEventListener('mouseleave', (event) => {\n            if (window.electronAPI && window.electronAPI.sendMouseEvent) {\n              window.electronAPI.sendMouseEvent(-1, -1, mouseButtons, 0);\n            }\n          });\n        }\n      "));
            // Set up mouse event handlers
            this.setupMouseEventHandlers();
        }
    };
    /**
     * Set up IPC handlers for mouse events
     */
    DebugWindowBase.prototype.setupMouseEventHandlers = function () {
        var _this = this;
        if (!this.debugWindow)
            return;
        // Handle mouse events from renderer
        this.debugWindow.webContents.on('ipc-message', function (event, channel) {
            var args = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                args[_i - 2] = arguments[_i];
            }
            if (channel === 'mouse-event') {
                var x = args[0], y = args[1], buttons = args[2], wheelDelta = args[3];
                // Handle wheel events with 100ms timer
                if (wheelDelta !== 0) {
                    _this.lastWheelDelta = wheelDelta;
                    if (_this.wheelTimer) {
                        clearTimeout(_this.wheelTimer);
                    }
                    _this.wheelTimer = setTimeout(function () {
                        _this.lastWheelDelta = 0;
                    }, 100);
                }
                // Transform coordinates based on window type
                var transformed = _this.transformMouseCoordinates(x, y);
                // Get pixel color at position
                var pixelGetter = _this.getPixelColorGetter();
                // Queue the mouse event
                _this.inputForwarder.queueMouseEvent(transformed.x, transformed.y, buttons, _this.lastWheelDelta, pixelGetter);
            }
            else if (channel === 'key-event') {
                var key = args[0];
                _this.inputForwarder.queueKeyEvent(key);
            }
        });
    };
    /**
     * Transform mouse coordinates for the specific window type
     * Override this in derived classes for window-specific transformations
     */
    DebugWindowBase.prototype.transformMouseCoordinates = function (x, y) {
        // Default implementation - no transformation
        return { x: x, y: y };
    };
    /**
     * Get a function that returns pixel color at given coordinates
     * Override in derived classes if pixel color sampling is needed
     */
    DebugWindowBase.prototype.getPixelColorGetter = function () {
        // Default implementation - no pixel color sampling
        return undefined;
    };
    // ----------------------------------------------------------------------
    // PRIVATE (utility) Methods
    DebugWindowBase.prototype.captureWindowAsPNG = function (window) {
        return new Promise(function (resolve) {
            try {
                window.webContents.capturePage().then(function (image) {
                    var desiredPngImage = image.toPNG();
                    resolve(desiredPngImage);
                });
            }
            catch (error) {
                console.error('Win: ERROR: capturing window as PNG:', error);
                var desiredPngImage = Buffer.alloc(0);
                resolve(desiredPngImage);
            }
        });
    };
    DebugWindowBase.prototype.convertPNGtoBMP = function (pngBuffer) {
        return __awaiter(this, void 0, void 0, function () {
            var desiredBmpImage, image, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, jimp_1.Jimp.read(pngBuffer)];
                    case 1:
                        image = _a.sent();
                        return [4 /*yield*/, image.getBuffer('image/bmp')];
                    case 2:
                        desiredBmpImage = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Win: ERROR: converting PNG to BMP:', error_1);
                        desiredBmpImage = Buffer.alloc(0);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, desiredBmpImage];
                }
            });
        });
    };
    // ----------------------------------------------------------------------
    DebugWindowBase.prototype.logMessageBase = function (message) {
        this.logMessage(message, 'Base');
    };
    DebugWindowBase.prototype.logMessage = function (message, prefix) {
        if (prefix === void 0) { prefix = ''; }
        if (this.isLogging) {
            //Write to output window.
            var prefixStr = prefix.length > 0 ? prefix : this.windowLogPrefix;
            this.context.logger.logMessage("".concat(prefixStr, ": ").concat(message));
        }
    };
    return DebugWindowBase;
}(events_1.default));
exports.DebugWindowBase = DebugWindowBase;
