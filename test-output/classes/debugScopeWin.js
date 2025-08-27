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
exports.DebugScopeWindow = void 0;
var electron_1 = require("electron");
var debugColor_1 = require("./shared/debugColor");
var packedDataProcessor_1 = require("./shared/packedDataProcessor");
var canvasRenderer_1 = require("./shared/canvasRenderer");
var triggerProcessor_1 = require("./shared/triggerProcessor");
var displaySpecParser_1 = require("./shared/displaySpecParser");
var windowPlacer_1 = require("../utils/windowPlacer");
var debugWindowBase_1 = require("./debugWindowBase");
/**
 * Debug SCOPE Window - Oscilloscope Waveform Display
 *
 * Displays real-time oscilloscope-style waveforms with multiple channels.
 * Supports trigger modes, auto-scaling, and packed data formats for high-performance data visualization.
 *
 * ## Features
 * - **Multi-Channel Display**: Up to 8 channels with independent configurations
 * - **Trigger Modes**: Manual trigger levels with arm/trigger thresholds, AUTO mode, and holdoff control
 * - **Data Visualization**: Real-time waveform rendering with configurable dot and line sizes
 * - **Packed Data Support**: Efficient data transfer using BYTE2/4, WORD2, LONG formats with SIGNED/ALT modifiers
 * - **Auto-scaling**: Automatic min/max detection for channel ranges
 * - **Coordinate Display**: Mouse position feedback with optional Y-axis inversion
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE width height` - Set window size (32-2048, default: 256x256)
 * - `SAMPLES nbr` - Sample buffer size (16-2048, default: 256)
 * - `RATE rate` - Sample rate divisor (1-2048, default: 1)
 * - `DOTSIZE pix` - Dot size for sample points (0-32, default: 0)
 * - `LINESIZE half-pix` - Line width (0-32, default: 3)
 * - `TEXTSIZE half-pix` - Text size for labels (6-200, default: 12)
 * - `COLOR bg {grid}` - Window and grid colors (default: BLACK, GRAY 4)
 * - `HIDEXY` - Hide coordinate display
 *
 * ## Data Format
 * Channel configuration: `'{name}' {min} {max} {y-size} {y-base} {legend} {color} {bright}`
 * Auto-scaling mode: `'{name}' AUTO {y-size} {y-base} {legend} {color} {bright}`
 * - name: Channel display name
 * - min/max: Value range (AUTO uses 0-255)
 * - y-size: Vertical display size in pixels
 * - y-base: Y baseline offset
 * - legend: %abcd format (a=max legend, b=min legend, c=max line, d=min line)
 * - color: Channel color name, bright: Color brightness (0-15)
 * - Example: `debug(\`MyScope 'Ch1' 0 1024 100 50 %1111 RED 15\`(sample_value))`
 *
 * ## Commands
 * - `CLEAR` - Clear all channel data and reset display
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
 * - `TRIGGER ch {arm} {trig} {offset}` - Configure trigger levels for channel
 * - `TRIGGER ch AUTO` - Enable auto trigger on channel
 * - `TRIGGER ch HOLDOFF samples` - Set trigger holdoff period
 * - `LINE size` - Update line width, `DOT size` - Update dot size
 * - Packed data modes: `BYTE2/4`, `WORD2`, `LONG` with optional `SIGNED`/`ALT` modifiers
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `SCOPE_Configure` procedure (line 1151)
 * - Update: `SCOPE_Update` procedure (line 1209)
 * - Trigger handling: `Scope_Trigger` procedures
 * - Channel management: `Scope_Channel_Config` procedures
 *
 * ## Examples
 * ```spin2
 * ' Basic scope with two channels
 * debug(`SCOPE MyScope SIZE 400 300 SAMPLES 512 RATE 2)
 * debug(`MyScope 'Voltage' 0 3300 120 10 %1111 YELLOW 15)
 * debug(`MyScope 'Current' 0 1000 120 140 %1111 CYAN 15)
 *
 * repeat
 *   voltage := adc_read(0)
 *   current := adc_read(1)
 *   debug(`MyScope \`(voltage, current))
 * ```
 *
 * ## Implementation Notes
 * - Channels are created dynamically when channel configuration is encountered
 * - First numeric data triggers window creation and display initialization
 * - Y-axis is inverted (0 at top) to match Pascal implementation
 * - Supports both manual trigger levels and automatic triggering
 * - Mouse coordinates display with optional Y-axis inversion for debugging
 * - Efficient packed data processing for high-speed data acquisition scenarios
 *
 * ## Deviations from Pascal
 * - Enhanced mouse coordinate display with pixel-level precision
 * - Additional color validation and error handling
 * - Improved trigger state management and visual feedback
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_SCOPE.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
var DebugScopeWindow = /** @class */ (function (_super) {
    __extends(DebugScopeWindow, _super);
    function DebugScopeWindow(ctx, displaySpec, windowId) {
        if (windowId === void 0) { windowId = "scope-".concat(Date.now()); }
        var _this = _super.call(this, ctx, windowId, 'scope') || this;
        _this.displaySpec = {};
        _this.channelSpecs = []; // one for each channel
        _this.channelSamples = []; // one for each channel
        _this.triggerSpec = {};
        _this.isFirstNumericData = true;
        _this.channelInset = 10; // 10 pixels from top and bottom of window
        _this.contentInset = 10; // 10 pixels from left and right of window
        _this.canvasMargin = 0; // 3 pixels from left, right, top, and bottom of canvas (NOT NEEDED)
        _this.channelLineWidth = 2; // 2 pixels wide for channel data line
        _this.packedMode = {};
        _this.canvasRenderer = new canvasRenderer_1.CanvasRenderer();
        // Trigger state properties
        _this.triggerArmed = false;
        _this.triggerFired = false;
        _this.holdoffCounter = 0;
        _this.previousSample = 0; // For slope detection
        _this.triggerSampleIndex = -1; // Track which sample caused the trigger
        // diagnostics used to limit the number of samples displayed while testing
        _this.dbgUpdateCount = 260; // NOTE 120 (no scroll) ,140 (scroll plus more), 260 scroll twice;
        _this.dbgLogMessageCount = 256 + 1; // log first N samples then stop (2 channel: 128+1 is 64 samples)
        _this.windowLogPrefix = 'scoW';
        // record our Debug Scope Window Spec
        _this.displaySpec = displaySpec;
        // init default Trigger Spec
        _this.triggerSpec = {
            trigEnabled: false,
            trigAuto: false,
            trigChannel: -1,
            trigArmLevel: 0,
            trigLevel: 0,
            trigSlope: 'Positive',
            trigRtOffset: 0,
            trigHoldoff: 0
        };
        // Initialize the trigger processor
        _this.triggerProcessor = new triggerProcessor_1.ScopeTriggerProcessor();
        // initially we don't have a packed mode...
        _this.packedMode = {
            mode: debugWindowBase_1.ePackedDataMode.PDM_UNKNOWN,
            bitsPerSample: 0,
            valueSize: debugWindowBase_1.ePackedDataWidth.PDW_UNKNOWN,
            isAlternate: false,
            isSigned: false
        };
        return _this;
    }
    DebugScopeWindow.prototype.logMessage = function (message) {
        // if (this.dbgLogMessageCount > 0) {
        _super.prototype.logMessage.call(this, message);
        //   this.dbgLogMessageCount--;
        // }
    };
    Object.defineProperty(DebugScopeWindow.prototype, "windowTitle", {
        get: function () {
            var desiredValue = "".concat(this.displaySpec.displayName, " SCOPE");
            if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
                desiredValue = this.displaySpec.windowTitle;
            }
            return desiredValue;
        },
        enumerable: false,
        configurable: true
    });
    DebugScopeWindow.parseScopeDeclaration = function (lineParts) {
        // here with lineParts = ['`SCOPE', {displayName}, ...]
        // Valid directives are:
        //   TITLE <title>
        //   POS <left> <top> [default: 0,0]
        //   SIZE <width> <height> [ea. 32-2048, default: 256]
        //   SAMPLES <nbr> [16-2048, default: 256]
        //   RATE <rate> [1-2048, default: 1]
        //   DOTSIZE <pix> [0-32, default: 0]
        //   LINESIZE <half-pix> [0-32, default: 3]
        //   TEXTSIZE <half-pix> [6-200, default: editor font size]
        //   COLOR <bgnd-color> {<grid-color>} [BLACK, GRAY 4]
        //   packed_data_mode
        //   HIDEXY
        // console.log(`CL: at parseScopeDeclaration()`);
        var displaySpec = {};
        displaySpec.window = {}; // ensure this is structured too! (CRASHED without this!)
        var isValid = false;
        // set defaults
        var bkgndColor = new debugColor_1.DebugColor('BLACK');
        var gridColor = new debugColor_1.DebugColor('GRAY3', 4);
        // console.log(`CL: at parseScopeDeclaration() with colors...`);
        displaySpec.position = { x: 0, y: 0 };
        displaySpec.size = { width: 256, height: 256 };
        displaySpec.nbrSamples = 256;
        displaySpec.rate = 1;
        displaySpec.dotSize = 0; // Default from comment
        displaySpec.lineSize = 3; // Default from comment
        displaySpec.textSize = 12; // Default editor font size - will be adjusted if needed
        displaySpec.window.background = bkgndColor.rgbString;
        displaySpec.window.grid = gridColor.rgbString;
        displaySpec.hideXY = false; // Default to showing coordinates
        // now parse overrides to defaults
        // console.log(`CL: at overrides ScopeDisplaySpec: ${lineParts}`);
        if (lineParts.length > 1) {
            displaySpec.displayName = lineParts[1];
            isValid = true; // invert default value
        }
        if (lineParts.length > 2) {
            for (var index = 2; index < lineParts.length; index++) {
                var element = lineParts[index];
                // Try to parse common keywords first
                var _a = displaySpecParser_1.DisplaySpecParser.parseCommonKeywords(lineParts, index, displaySpec), parsed = _a[0], consumed = _a[1];
                if (parsed) {
                    index = index + consumed - 1; // Adjust for loop increment
                }
                else {
                    switch (element.toUpperCase()) {
                        case 'COLOR':
                            // Parse COLOR directive: COLOR <background> {<grid-color>}
                            var _b = displaySpecParser_1.DisplaySpecParser.parseColorKeyword(lineParts, index), colorParsed = _b[0], colors = _b[1], colorIndex = _b[2];
                            if (colorParsed) {
                                displaySpec.window.background = colors.background;
                                if (colors.grid) {
                                    displaySpec.window.grid = colors.grid;
                                }
                                index = colorIndex - 1; // Adjust for loop increment
                            }
                            else {
                                // console.log(`CL: ScopeDisplaySpec: Invalid COLOR specification`);
                                isValid = false;
                            }
                            break;
                        case 'POS':
                            // POS is not in the original scope parser but should be supported
                            var _c = displaySpecParser_1.DisplaySpecParser.parsePosKeyword(lineParts, index), posParsed = _c[0], pos = _c[1];
                            if (posParsed) {
                                displaySpec.position = pos;
                                index += 2; // Skip x and y values
                            }
                            else {
                                // console.log(`CL: ScopeDisplaySpec: Invalid POS specification`);
                                isValid = false;
                            }
                            break;
                        case 'RATE':
                            // ensure we have one more value
                            if (index < lineParts.length - 1) {
                                displaySpec.rate = Number(lineParts[++index]);
                            }
                            else {
                                // console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                                isValid = false;
                            }
                            break;
                        case 'HIDEXY':
                            displaySpec.hideXY = true;
                            break;
                        // ORIGINAL PARSING COMMENTED OUT - Using DisplaySpecParser instead
                        /*
                        case 'TITLE':
                          // ensure we have one more value
                          if (index < lineParts.length - 1) {
                            displaySpec.windowTitle = lineParts[++index];
                          } else {
                            // console.log() as we are in class static method, not derived class...
                            // console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                            isValid = false;
                          }
                          break;
                        case 'SIZE':
                          // ensure we have two more values
                          if (index < lineParts.length - 2) {
                            displaySpec.size.width = Number(lineParts[++index]);
                            displaySpec.size.height = Number(lineParts[++index]);
                          } else {
                            // console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                            isValid = false;
                          }
                          break;
                        */
                        case 'SAMPLES':
                            // ensure we have one more value
                            if (index < lineParts.length - 1) {
                                displaySpec.nbrSamples = Number(lineParts[++index]);
                            }
                            else {
                                // console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                                isValid = false;
                            }
                            break;
                        default:
                            // console.log(`CL: ScopeDisplaySpec: Unknown directive: ${element}`);
                            break;
                    }
                }
                if (!isValid) {
                    break;
                }
            }
        }
        // console.log(`CL: at end of parseScopeDeclaration(): isValid=(${isValid}), ${JSON.stringify(displaySpec, null, 2)}`);
        return [isValid, displaySpec];
    };
    DebugScopeWindow.prototype.createDebugWindow = function () {
        var _this = this;
        this.logMessage("at createDebugWindow() SCOPE");
        // Default channel creation has been moved to updateContent when first numeric data arrives
        // NOTES: Chip's size estimation:
        //  window width should be (#samples * 2) + (2 * 2); // 2 is for the 2 borders
        //  window height should be (max-min+1) + (2 * chanInset); // chanInset is for space above channel and below channel
        var channelCanvases = [];
        var windowCanvasHeight = 0;
        var channelWidth = 0;
        if (this.channelSpecs.length > 0) {
            for (var index = 0; index < this.channelSpecs.length; index++) {
                var channelSpec = this.channelSpecs[index];
                var adjHeight = this.channelLineWidth / 2 + this.canvasMargin * 2 + channelSpec.ySize + 2 * this.channelInset; // inset is above and below
                channelWidth = this.canvasMargin * 2 + this.displaySpec.nbrSamples * 2;
                // create a canvas for each channel
                channelCanvases.push("<canvas id=\"channel-".concat(index, "\" width=\"").concat(channelWidth, "\" height=\"").concat(adjHeight, "\"></canvas>"));
                // account for channel height
                windowCanvasHeight += channelSpec.ySize + 2 * this.channelInset + this.channelLineWidth / 2;
            }
        }
        else {
            // error if NO channel
            this.logMessage("at createDebugWindow() SCOPE with NO channels!");
        }
        this.logMessage("at createDebugWindow() SCOPE set up done... w/".concat(channelCanvases.length, " canvase(s)"));
        // set height so no scroller by default
        var channelLabelHeight = 13; // 13 pixels for channel labels 10pt + gap below
        var canvasePlusWindowHeight = windowCanvasHeight + channelLabelHeight + this.contentInset * 2;
        var windowHeight = Math.max(this.displaySpec.size.height, canvasePlusWindowHeight);
        var windowWidth = Math.max(this.displaySpec.size.width, this.displaySpec.nbrSamples * 2 + this.contentInset * 2); // contentInset' for the Xoffset into window for canvas
        // Check if position was explicitly set or is still at default (0,0)
        var windowX = this.displaySpec.position.x;
        var windowY = this.displaySpec.position.y;
        // If position is at default (0,0), use WindowPlacer for intelligent positioning
        if (windowX === 0 && windowY === 0) {
            var windowPlacer = windowPlacer_1.WindowPlacer.getInstance();
            var placementConfig = {
                dimensions: { width: windowWidth, height: windowHeight },
                cascadeIfFull: true
            };
            var position = windowPlacer.getNextPosition("scope-".concat(this.displaySpec.displayName), placementConfig);
            windowX = position.x;
            windowY = position.y;
            this.logMessage("  -- SCOPE using auto-placement: ".concat(windowX, ",").concat(windowY));
        }
        this.logMessage("  -- SCOPE window size: ".concat(windowWidth, "x").concat(windowHeight, " @").concat(windowX, ",").concat(windowY));
        // now generate the window with the calculated sizes
        var displayName = this.windowTitle;
        this.debugWindow = new electron_1.BrowserWindow({
            width: windowWidth,
            height: windowHeight,
            x: windowX,
            y: windowY,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        // Register window with WindowPlacer for position tracking
        if (this.debugWindow) {
            var windowPlacer = windowPlacer_1.WindowPlacer.getInstance();
            windowPlacer.registerWindow("scope-".concat(this.displaySpec.displayName), this.debugWindow);
        }
        // hook window events before being shown
        this.debugWindow.on('ready-to-show', function () {
            var _a;
            _this.logMessage('* Scope window will show...');
            (_a = _this.debugWindow) === null || _a === void 0 ? void 0 : _a.show();
        });
        this.debugWindow.on('show', function () {
            _this.logMessage('* Scope window shown');
        });
        this.debugWindow.on('page-title-updated', function () {
            _this.logMessage('* Scope window title updated');
        });
        this.debugWindow.once('ready-to-show', function () {
            _this.logMessage('at ready-to-show');
            // Register with WindowRouter when window is ready
            _this.registerWithRouter();
            if (_this.debugWindow) {
                // The following only works for linux/windows
                if (process.platform !== 'darwin') {
                    try {
                        //this.debugWindow.setMenu(null); // NO menu for this window  || NO WORKEE!
                        _this.debugWindow.removeMenu(); // Alternative to setMenu(null) with less side effects
                        //this.debugWindow.setMenuBarVisibility(false); // Alternative to setMenu(null) with less side effects || NO WORKEE!
                    }
                    catch (error) {
                        _this.logMessage("Failed to remove menu: ".concat(error));
                    }
                }
                _this.debugWindow.show();
            }
        });
        // and load this window .html content
        var htmlContent = "\n    <html>\n      <head>\n        <meta charset=\"UTF-8\"></meta>\n        <title>".concat(displayName, "</title>\n        <style>\n          @font-face {\n            font-family: 'Parallax';\n            src: url('").concat(this.getParallaxFontUrl(), "') format('truetype');\n          }\n          body {\n            display: flex;\n            flex-direction: column;\n            margin: 0;\n            padding: 0;\n            font-family: 'Parallax', sans-serif;\n            font-size: 12px;\n            /* background-color: rgb(237, 142, 238); */\n            background-color: ").concat(this.displaySpec.window.background, ";\n            color:rgb(191, 213, 93);\n            position: relative;\n          }\n          #container {\n            display: flex;\n            flex-direction: column; /* Arrange children in a column */\n            justify-content: flex-start;\n            margin: ").concat(this.contentInset, "px ").concat(this.contentInset, "px;  /* vert horiz -OR- top right bottom left */\n            padding: 0;\n            background-color: ").concat(this.displaySpec.window.background, ";\n          }\n          #labels {\n            font-family: 'Parallax', sans-serif;\n            font-style: italic;\n            font-size: 10px;\n            /* display: flex; */\n            /* flex-direction: row;   Arrange children in a row */\n            /* justify-content: flex-start;  left edge grounded */\n            /* align-items: top; vertically at top */\n            /*  align-items: center;  vertically centered */\n            flex-grow: 0;\n            gap: 10px; /* Create a 10px gap between items */\n            height: ").concat(channelLabelHeight, "px;\n            padding: 0px 0px 4px 0px;\n            /* background-color: rgb(225, 232, 191); */\n          }\n          #labels > p {\n            /* padding: top right bottom left; */\n            padding: 0px;\n            margin: 0px;\n          }\n          #channel-data {\n            display: flex;\n            flex-direction: column;\n            justify-content: flex-end;\n            flex-grow: 0;\n            margin: 0;\n            /* background-color: rgb(55, 63, 170); */\n          }\n          #channels {\n            display: flex;\n            flex-direction: column;\n            justify-content: flex-end;\n            flex-grow: 0;\n            margin: 0;   /* top, right, bottom, left */\n            padding: 0px;\n            border-style: solid;\n            border-width: 1px;\n            border-color: ").concat(this.displaySpec.window.grid, "; */\n            /* border-color: rgb(29, 230, 106); */\n            background-color: rgb(164, 22, 22);\n          }\n          canvas {\n            /* background-color: rgb(240, 194, 151); */\n            background-color: ").concat(this.displaySpec.window.background, ";\n            margin: 0;\n          }\n          #trigger-status {\n            position: absolute;\n            top: 5px;\n            right: 5px;\n            padding: 5px 10px;\n            background-color: rgba(0, 0, 0, 0.7);\n            color: white;\n            font-size: 12px;\n            font-family: Arial, sans-serif;\n            border-radius: 3px;\n            display: none; /* Hidden by default */\n            z-index: 100;\n          }\n          #trigger-status.armed {\n            background-color: rgba(255, 165, 0, 0.8); /* Orange for armed */\n          }\n          #trigger-status.triggered {\n            background-color: rgba(0, 255, 0, 0.8); /* Green for triggered */\n          }\n          .trigger-legend {\n            position: absolute;\n            right: 5px;\n            font-size: 10px;\n            font-family: Arial, sans-serif;\n            color: white;\n            background-color: rgba(0, 0, 0, 0.5);\n            padding: 2px 5px;\n            border-radius: 2px;\n            pointer-events: none;\n          }\n          @keyframes flash {\n            0% { opacity: 0.8; }\n            50% { opacity: 1; }\n            100% { opacity: 0.8; }\n          }\n          #coordinate-display {\n            position: absolute;\n            padding: 2px 4px;\n            background-color: ").concat(this.displaySpec.window.background, ";\n            color: ").concat(this.displaySpec.window.grid, ";\n            border: 1px solid ").concat(this.displaySpec.window.grid, ";\n            font-family: 'Parallax', monospace;\n            font-size: 11px;\n            font-style: normal;\n            pointer-events: none;\n            display: none;\n            z-index: 20;\n            white-space: nowrap;\n          }\n          #crosshair-horizontal, #crosshair-vertical {\n            position: absolute;\n            background-color: ").concat(this.displaySpec.window.grid, ";\n            opacity: 0.5;\n            pointer-events: none;\n            display: none;\n            z-index: 15;\n          }\n          #crosshair-horizontal {\n            height: 1px;\n            width: 100%;\n            left: 0;\n          }\n          #crosshair-vertical {\n            width: 1px;\n            height: 100%;\n            top: 0;\n          }\n        </style>\n      </head>\n      <body>\n        <div id=\"trigger-status\">READY</div>\n        <div id=\"coordinate-display\"></div>\n        <div id=\"crosshair-horizontal\"></div>\n        <div id=\"crosshair-vertical\"></div>\n        <div id=\"container\">\n          <div id=\"labels\" width=\"").concat(channelWidth, "\" height=\"").concat(channelLabelHeight, "\">\n          </div>\n          <div id=\"channel-data\">\n            <div id=\"channels\">").concat(channelCanvases.join(' '), "</div>\n          </div>\n      </div>\n      </body>\n    </html>\n  ");
        this.logMessage("at createDebugWindow() SCOPE with htmlContent: ".concat(htmlContent));
        try {
            this.debugWindow.setMenu(null);
            this.debugWindow.setTitle(this.windowTitle);
            this.debugWindow.loadURL("data:text/html,".concat(encodeURIComponent(htmlContent)));
        }
        catch (error) {
            this.logMessage("Failed to load URL: ".concat(error));
        }
        // now hook load complete event so we can label and paint the grid/min/max, etc.
        this.debugWindow.webContents.on('did-finish-load', function () {
            _this.logMessage('at did-finish-load');
            for (var index = 0; index < _this.channelSpecs.length; index++) {
                var channelSpec = _this.channelSpecs[index];
                _this.updateScopeChannelLabel(channelSpec.name, channelSpec.color);
                var channelGridColor = channelSpec.gridColor;
                var channelTextColor = channelSpec.textColor;
                var windowGridColor = _this.displaySpec.window.grid;
                var canvasName = "channel-".concat(index);
                // paint the grid/min/max, etc.
                //  %abcd where a=enable max legend, b=min legend, c=max line, d=min line
                if (channelSpec.lgndShowMax && !channelSpec.lgndShowMaxLine) {
                    //  %1x0x => max legend, NOT max line, so value ONLY
                    _this.drawHorizontalValue(canvasName, channelSpec, channelSpec.maxValue, channelTextColor);
                }
                if (channelSpec.lgndShowMin && !channelSpec.lgndShowMinLine) {
                    //  %x1x0 => min legend, NOT min line, so value ONLY
                    _this.drawHorizontalValue(canvasName, channelSpec, channelSpec.minValue, channelTextColor);
                }
                if (channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
                    //  %1x1x => max legend, max line, so show value and line!
                    _this.drawHorizontalLineAndValue(canvasName, channelSpec, channelSpec.maxValue, channelGridColor, channelTextColor);
                }
                if (channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
                    //  %x1x1 => min legend, min line, so show value and line!
                    _this.drawHorizontalLineAndValue(canvasName, channelSpec, channelSpec.minValue, channelGridColor, channelTextColor);
                }
                if (!channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
                    //  %0x1x => NOT max legend, max line, show line ONLY
                    _this.drawHorizontalLine(canvasName, channelSpec, channelSpec.maxValue, channelGridColor);
                }
                if (!channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
                    //  %x0x1 => NOT min legend, min line, show line ONLY
                    _this.drawHorizontalLine(canvasName, channelSpec, channelSpec.minValue, channelGridColor);
                }
            }
            // Draw trigger levels if enabled
            _this.drawTriggerLevels();
        });
    };
    DebugScopeWindow.prototype.closeDebugWindow = function () {
        this.logMessage("at closeDebugWindow() SCOPE");
        // let our base class do the work
        this.debugWindow = null;
    };
    DebugScopeWindow.prototype.processMessageImmediate = function (lineParts) {
        // Handle async internally
        this.processMessageAsync(lineParts);
    };
    DebugScopeWindow.prototype.processMessageAsync = function (lineParts) {
        return __awaiter(this, void 0, void 0, function () {
            var channelSpec, colorName, colorBrightness, legend, isNumber, parsedValue, legend, channelColor, desiredChannel, _a, isNumber, trigHoldoff, channelSpec, newArmLevel, newTrigLevel, _b, isNumber, parsedValue, _c, isNumber, parsedValue, saveFileName, lineSize, dotSize, _d, isPackedData, _, keywords, index, keyword, isValidNumber, defaultColor, scopeSamples, index, _e, isValidNumber_1, sampleValue, unpackedSamples, _i, scopeSamples_1, packedValue, samples, didScroll, numberChannels, nbrSamples, chanIdx, nextSample, channelSpec, canvasName;
            var _f, _g, _h, _j, _k, _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        // here with lineParts = ['`{displayName}, ...]
                        // Valid directives are:
                        this.logMessage("at updateContent() with lineParts=[".concat(lineParts.join(', '), "]"));
                        if (!(lineParts.length >= 2)) return [3 /*break*/, 10];
                        if (!(lineParts[1].charAt(0) == "'")) return [3 /*break*/, 1];
                        channelSpec = {};
                        channelSpec.name = lineParts[1].slice(1, -1);
                        // Set defaults for all channel properties
                        channelSpec.minValue = 0;
                        channelSpec.maxValue = 255;
                        channelSpec.ySize = this.displaySpec.size.height;
                        channelSpec.yBaseOffset = 0;
                        channelSpec.lgndShowMax = true;
                        channelSpec.lgndShowMin = true;
                        channelSpec.lgndShowMaxLine = true;
                        channelSpec.lgndShowMinLine = true;
                        colorName = 'LIME';
                        colorBrightness = 15;
                        if (lineParts[2].toUpperCase().startsWith('AUTO')) {
                            // parse AUTO spec - set trigger auto mode for this channel
                            //   '{NAME1}' AUTO2 {y-size3 {y-base4 {legend5} {color6 {bright7}}}} // legend is %abcd
                            // Auto means we should use auto trigger for this channel
                            this.triggerSpec.trigAuto = true;
                            this.triggerSpec.trigChannel = this.channelSpecs.length; // Current channel being added
                            // AUTO channels default to 0-255 range
                            channelSpec.minValue = 0;
                            channelSpec.maxValue = 255;
                            if (lineParts.length > 3) {
                                channelSpec.ySize = Number(lineParts[3]);
                            }
                            if (lineParts.length > 4) {
                                channelSpec.yBaseOffset = Number(lineParts[4]);
                            }
                            if (lineParts.length > 5) {
                                legend = lineParts[5];
                                this.parseLegend(legend, channelSpec);
                            }
                            if (lineParts.length > 6) {
                                colorName = lineParts[6];
                            }
                            if (lineParts.length > 7) {
                                colorBrightness = Number(lineParts[7]);
                            }
                        }
                        else {
                            isNumber = false;
                            parsedValue = 0;
                            if (lineParts.length > 2) {
                                _f = this.isSpinNumber(lineParts[2]), isNumber = _f[0], parsedValue = _f[1];
                                if (isNumber) {
                                    channelSpec.minValue = parsedValue;
                                }
                            }
                            if (lineParts.length > 3) {
                                _g = this.isSpinNumber(lineParts[3]), isNumber = _g[0], parsedValue = _g[1];
                                if (isNumber) {
                                    channelSpec.maxValue = parsedValue;
                                }
                            }
                            if (lineParts.length > 4) {
                                _h = this.isSpinNumber(lineParts[4]), isNumber = _h[0], parsedValue = _h[1];
                                if (isNumber) {
                                    channelSpec.ySize = parsedValue;
                                }
                            }
                            if (lineParts.length > 5) {
                                _j = this.isSpinNumber(lineParts[5]), isNumber = _j[0], parsedValue = _j[1];
                                if (isNumber) {
                                    channelSpec.yBaseOffset = parsedValue;
                                }
                            }
                            if (lineParts.length > 6) {
                                legend = lineParts[6];
                                this.parseLegend(legend, channelSpec);
                            }
                            if (lineParts.length > 7) {
                                colorName = lineParts[7];
                            }
                            if (lineParts.length > 8) {
                                colorBrightness = Number(lineParts[8]);
                            }
                        }
                        channelColor = new debugColor_1.DebugColor(colorName, colorBrightness);
                        channelSpec.color = channelColor.rgbString;
                        channelSpec.gridColor = channelColor.gridRgbString;
                        channelSpec.textColor = channelColor.fontRgbString;
                        // and record spec for this channel
                        this.logMessage("at updateContent() w/[".concat(lineParts.join(' '), "]"));
                        this.logMessage("at updateContent() with channelSpec: ".concat(JSON.stringify(channelSpec, null, 2)));
                        this.channelSpecs.push(channelSpec);
                        // If window is already created, we need to add a corresponding channelSample
                        if (!this.isFirstNumericData && this.channelSamples.length < this.channelSpecs.length) {
                            this.channelSamples.push({ samples: [] });
                            this.logMessage("at updateContent() added channelSample for new channel, now have ".concat(this.channelSamples.length, " samples"));
                        }
                        return [3 /*break*/, 10];
                    case 1:
                        if (!(lineParts[1].toUpperCase() == 'TRIGGER')) return [3 /*break*/, 2];
                        // parse trigger spec update
                        //   TRIGGER1 <channel|-1>2 {arm-level3 {trigger-level4 {offset5}}}
                        //   TRIGGER1 <channel|-1>2 {HOLDOFF3 <2-2048>4}
                        //  arm-level (?-1)
                        //  trigger-level (trigFire? 0)
                        //  trigger offset (0) samples / 2
                        // Holdoff (2-2048) samples
                        this.triggerSpec.trigEnabled = true;
                        // Update trigger status when first enabled
                        if (this.debugWindow) {
                            this.updateTriggerStatus();
                        }
                        if (lineParts.length > 2) {
                            desiredChannel = Number(lineParts[2]);
                            if (desiredChannel >= -1 && desiredChannel < this.channelSpecs.length) {
                                this.triggerSpec.trigChannel = desiredChannel;
                            }
                            else {
                                this.logMessage("at updateContent() with invalid channel: ".concat(desiredChannel, " in [").concat(lineParts.join(' '), "]"));
                            }
                            if (lineParts.length > 3) {
                                if (lineParts[3].toUpperCase() == 'HOLDOFF') {
                                    if (lineParts.length >= 4) {
                                        _a = this.isSpinNumber(lineParts[4]), isNumber = _a[0], trigHoldoff = _a[1];
                                        if (isNumber) {
                                            this.triggerSpec.trigHoldoff = trigHoldoff;
                                        }
                                    }
                                }
                                else if (lineParts[3].toUpperCase() == 'AUTO') {
                                    this.triggerSpec.trigAuto = true;
                                    channelSpec = this.channelSpecs[this.triggerSpec.trigChannel];
                                    newArmLevel = (channelSpec.maxValue - channelSpec.minValue) / 3 + channelSpec.minValue;
                                    this.triggerSpec.trigArmLevel = newArmLevel;
                                    newTrigLevel = (channelSpec.maxValue - channelSpec.minValue) / 2 + channelSpec.minValue;
                                    this.triggerSpec.trigLevel = newTrigLevel;
                                }
                                else {
                                    _b = this.isSpinNumber(lineParts[3]), isNumber = _b[0], parsedValue = _b[1];
                                    if (isNumber) {
                                        this.triggerSpec.trigArmLevel = parsedValue;
                                    }
                                    this.triggerSpec.trigAuto = false;
                                    if (lineParts.length > 4) {
                                        _k = this.isSpinNumber(lineParts[4]), isNumber = _k[0], parsedValue = _k[1];
                                        if (isNumber) {
                                            this.triggerSpec.trigLevel = parsedValue;
                                        }
                                    }
                                    if (lineParts.length > 5) {
                                        _l = this.isSpinNumber(lineParts[5]), isNumber = _l[0], parsedValue = _l[1];
                                        if (isNumber) {
                                            this.triggerSpec.trigRtOffset = parsedValue;
                                        }
                                    }
                                }
                            }
                        }
                        this.logMessage("at updateContent() w/[".concat(lineParts.join(' '), "]"));
                        this.logMessage("at updateContent() with triggerSpec: ".concat(JSON.stringify(this.triggerSpec, null, 2)));
                        return [3 /*break*/, 10];
                    case 2:
                        if (!(lineParts[1].toUpperCase() == 'HOLDOFF')) return [3 /*break*/, 3];
                        // parse trigger spec update
                        //   HOLDOFF1 <2-2048>2
                        if (lineParts.length > 2) {
                            _c = this.isSpinNumber(lineParts[2]), isNumber = _c[0], parsedValue = _c[1];
                            if (isNumber) {
                                this.triggerSpec.trigHoldoff = parsedValue;
                            }
                        }
                        this.logMessage("at updateContent() w/[".concat(lineParts.join(' '), "]"));
                        this.logMessage("at updateContent() with triggerSpec: ".concat(JSON.stringify(this.triggerSpec, null, 2)));
                        return [3 /*break*/, 10];
                    case 3:
                        if (!(lineParts[1].toUpperCase() == 'CLEAR')) return [3 /*break*/, 4];
                        // clear all channels
                        this.clearChannelData();
                        return [3 /*break*/, 10];
                    case 4:
                        if (!(lineParts[1].toUpperCase() == 'CLOSE')) return [3 /*break*/, 5];
                        // close the window
                        this.closeDebugWindow();
                        return [3 /*break*/, 10];
                    case 5:
                        if (!(lineParts[1].toUpperCase() == 'SAVE')) return [3 /*break*/, 9];
                        if (!(lineParts.length >= 2)) return [3 /*break*/, 7];
                        saveFileName = this.removeStringQuotes(lineParts[2]);
                        // save the window to a file (as BMP)
                        return [4 /*yield*/, this.saveWindowToBMPFilename(saveFileName)];
                    case 6:
                        // save the window to a file (as BMP)
                        _m.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        this.logMessage("at updateContent() missing SAVE fileName in [".concat(lineParts.join(' '), "]"));
                        _m.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        if (lineParts[1].toUpperCase() == 'PC_KEY') {
                            // Enable keyboard input forwarding
                            this.enableKeyboardInput();
                            // PC_KEY must be last command
                            return [2 /*return*/];
                        }
                        else if (lineParts[1].toUpperCase() == 'PC_MOUSE') {
                            // Enable mouse input forwarding
                            this.enableMouseInput();
                            // PC_MOUSE must be last command
                            return [2 /*return*/];
                        }
                        else if (lineParts[1].toUpperCase() == 'LINE') {
                            // Update line width
                            if (lineParts.length > 2) {
                                lineSize = Number(lineParts[2]);
                                if (!isNaN(lineSize) && lineSize >= 0 && lineSize <= 32) {
                                    this.displaySpec.lineSize = lineSize;
                                }
                            }
                        }
                        else if (lineParts[1].toUpperCase() == 'DOT') {
                            // Update dot size
                            if (lineParts.length > 2) {
                                dotSize = Number(lineParts[2]);
                                if (!isNaN(dotSize) && dotSize >= 0 && dotSize <= 32) {
                                    this.displaySpec.dotSize = dotSize;
                                }
                            }
                        }
                        else {
                            _d = packedDataProcessor_1.PackedDataProcessor.validatePackedMode(lineParts[1]), isPackedData = _d[0], _ = _d[1];
                            if (isPackedData) {
                                keywords = [];
                                index = 1;
                                // Add the mode
                                keywords.push(lineParts[index]);
                                index++;
                                // Look for ALT and SIGNED keywords
                                while (index < lineParts.length) {
                                    keyword = lineParts[index].toUpperCase();
                                    if (keyword === 'ALT' || keyword === 'SIGNED') {
                                        keywords.push(keyword);
                                        index++;
                                    }
                                    else {
                                        break;
                                    }
                                }
                                // Parse all keywords together
                                this.packedMode = packedDataProcessor_1.PackedDataProcessor.parsePackedModeKeywords(keywords);
                            }
                            else {
                                // do we have number?
                                this.logMessage("at updateContent() with numeric data: [".concat(lineParts, "](").concat(lineParts.length, ")"));
                                isValidNumber = this.isSpinNumber(lineParts[1])[0];
                                if (isValidNumber) {
                                    if (this.isFirstNumericData) {
                                        this.isFirstNumericData = false;
                                        // Create default channel if none exist
                                        if (this.channelSpecs.length == 0) {
                                            defaultColor = new debugColor_1.DebugColor('GREEN', 15);
                                            this.channelSpecs.push({
                                                name: 'Channel 0',
                                                color: defaultColor.rgbString,
                                                gridColor: defaultColor.gridRgbString,
                                                textColor: defaultColor.fontRgbString,
                                                minValue: 0,
                                                maxValue: 255,
                                                ySize: this.displaySpec.size.height,
                                                yBaseOffset: 0,
                                                lgndShowMax: true,
                                                lgndShowMin: true,
                                                lgndShowMaxLine: true,
                                                lgndShowMinLine: true
                                            });
                                        }
                                        this.calculateAutoTriggerAndScale();
                                        this.initChannelSamples();
                                        this.createDebugWindow();
                                    }
                                    scopeSamples = [];
                                    for (index = 1; index < lineParts.length; index++) {
                                        _e = this.isSpinNumber(lineParts[index]), isValidNumber_1 = _e[0], sampleValue = _e[1];
                                        if (isValidNumber_1) {
                                            scopeSamples.push(sampleValue);
                                        }
                                        else {
                                            this.logMessage("* UPD-ERROR invalid numeric data: lineParts[".concat(index, "]=").concat(lineParts[index], " of [").concat(lineParts.join(' '), "]"));
                                        }
                                    }
                                    // FIXME: add packed data mode unpacking here
                                    // Handle packed data unpacking if packed mode is configured
                                    if (this.packedMode.mode !== debugWindowBase_1.ePackedDataMode.PDM_UNKNOWN) {
                                        unpackedSamples = [];
                                        for (_i = 0, scopeSamples_1 = scopeSamples; _i < scopeSamples_1.length; _i++) {
                                            packedValue = scopeSamples_1[_i];
                                            samples = packedDataProcessor_1.PackedDataProcessor.unpackSamples(packedValue, this.packedMode);
                                            unpackedSamples.push.apply(unpackedSamples, samples);
                                        }
                                        scopeSamples = unpackedSamples;
                                        this.logMessage("* UPD-INFO unpacked ".concat(scopeSamples.length, " samples from packed data mode: ").concat(JSON.stringify(this.packedMode)));
                                    }
                                    didScroll = false;
                                    numberChannels = this.channelSpecs.length;
                                    nbrSamples = scopeSamples.length;
                                    this.logMessage("* UPD-INFO channels=".concat(numberChannels, ", samples=").concat(nbrSamples, ", samples=[").concat(scopeSamples.join(','), "]"));
                                    if (nbrSamples == numberChannels) {
                                        /*
                                        if (this.dbgLogMessageCount > 0) {
                                          this.logMessage(
                                            `at updateContent() #${numberChannels} channels, #${nbrSamples} samples of [${scopeSamples.join(
                                              ','
                                            )}], lineparts=[${lineParts.join(',')}]`
                                          );
                                        }
                                        */
                                        for (chanIdx = 0; chanIdx < nbrSamples; chanIdx++) {
                                            nextSample = Number(scopeSamples[chanIdx]);
                                            channelSpec = this.channelSpecs[chanIdx];
                                            if (nextSample < channelSpec.minValue) {
                                                nextSample = channelSpec.minValue;
                                                this.logMessage("* UPD-WARNING sample below min: ".concat(nextSample, " of [").concat(lineParts.join(','), "]"));
                                            }
                                            else if (nextSample > channelSpec.maxValue) {
                                                nextSample = channelSpec.maxValue;
                                                this.logMessage("* UPD-WARNING sample above max: ".concat(nextSample, " of [").concat(lineParts.join(','), "]"));
                                            }
                                            // record our sample (shifting left if necessary)
                                            didScroll = this.recordChannelSample(chanIdx, nextSample);
                                            this.logMessage("* UPD-INFO recorded sample ".concat(nextSample, " for channel ").concat(chanIdx, ", channelSamples[").concat(chanIdx, "].samples.length=").concat(this.channelSamples[chanIdx].samples.length));
                                            canvasName = "channel-".concat(chanIdx);
                                            //this.logMessage(`* UPD-INFO recorded (${nextSample}) for ${canvasName}`);
                                            // Check if channel samples exist before accessing
                                            if (this.channelSamples[chanIdx]) {
                                                this.updateScopeChannelData(canvasName, channelSpec, this.channelSamples[chanIdx].samples, didScroll);
                                            }
                                            else {
                                                this.logMessage("* UPD-ERROR channel samples not initialized for channel ".concat(chanIdx));
                                            }
                                        }
                                    }
                                    else {
                                        this.logMessage("* UPD-ERROR wrong nbr of samples: #".concat(numberChannels, " channels, #").concat(nbrSamples, " samples of [").concat(lineParts.join(','), "]"));
                                    }
                                }
                                else {
                                    this.logMessage("* UPD-ERROR  unknown directive: ".concat(lineParts[1], " of [").concat(lineParts.join(' '), "]"));
                                }
                            }
                        }
                        _m.label = 10;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    DebugScopeWindow.prototype.calculateAutoTriggerAndScale = function () {
        this.logMessage("at calculateAutoTriggerAndScale()");
        if (this.triggerSpec.trigAuto && this.triggerSpec.trigChannel >= 0 &&
            this.triggerSpec.trigChannel < this.channelSpecs.length) {
            // Get the channel spec for the trigger channel
            var channelSpec = this.channelSpecs[this.triggerSpec.trigChannel];
            // Calculate arm level at 33% from bottom
            var range = channelSpec.maxValue - channelSpec.minValue;
            this.triggerSpec.trigArmLevel = (range / 3) + channelSpec.minValue;
            // Calculate trigger level at 50% (center)
            this.triggerSpec.trigLevel = (range / 2) + channelSpec.minValue;
            this.logMessage("Auto-trigger calculated for channel ".concat(this.triggerSpec.trigChannel, ":"));
            this.logMessage("  Range: ".concat(channelSpec.minValue, " to ").concat(channelSpec.maxValue));
            this.logMessage("  Arm level (33%): ".concat(this.triggerSpec.trigArmLevel));
            this.logMessage("  Trigger level (50%): ".concat(this.triggerSpec.trigLevel));
        }
    };
    DebugScopeWindow.prototype.initChannelSamples = function () {
        this.logMessage("at initChannelSamples()");
        // clear the channel data
        this.channelSamples = [];
        if (this.channelSpecs.length == 0) {
            this.channelSamples.push({ samples: [] });
        }
        else {
            for (var index = 0; index < this.channelSpecs.length; index++) {
                this.channelSamples.push({ samples: [] });
            }
        }
        this.logMessage("  -- [".concat(JSON.stringify(this.channelSamples, null, 2), "]"));
    };
    DebugScopeWindow.prototype.clearChannelData = function () {
        this.logMessage("at clearChannelData()");
        // Ensure channelSamples array matches channelSpecs
        if (this.channelSamples.length !== this.channelSpecs.length) {
            this.channelSamples = [];
            for (var i = 0; i < this.channelSpecs.length; i++) {
                this.channelSamples.push({ samples: [] });
            }
        }
        else {
            // Clear existing samples
            for (var index = 0; index < this.channelSamples.length; index++) {
                var channelSamples = this.channelSamples[index];
                // clear the channel data
                channelSamples.samples = [];
            }
        }
    };
    DebugScopeWindow.prototype.recordChannelSample = function (channelIndex, sample) {
        var _a;
        //this.logMessage(`at recordChannelSample(${channelIndex}, ${sample})`);
        var didScroll = false;
        // Handle trigger evaluation if enabled and this is the trigger channel
        if (this.triggerSpec.trigEnabled && channelIndex === this.triggerSpec.trigChannel) {
            // Set trigger levels in the processor
            this.triggerProcessor.setTriggerLevels(this.triggerSpec.trigArmLevel, this.triggerSpec.trigLevel, this.triggerSpec.trigSlope.toLowerCase());
            // Process the sample with the trigger processor
            this.triggerProcessor.processSample(sample, {
                trigHoldoff: this.triggerSpec.trigHoldoff
            });
            // Sync our local state with the trigger processor
            var triggerState = this.triggerProcessor.getTriggerState();
            var wasArmed = this.triggerArmed;
            var wasFired = this.triggerFired;
            this.triggerArmed = triggerState.armed;
            this.triggerFired = triggerState.fired;
            this.holdoffCounter = triggerState.holdoff;
            // Update UI when state changes
            if (wasArmed !== this.triggerArmed || wasFired !== this.triggerFired) {
                this.updateTriggerStatus();
                // If we just fired, remember the sample position
                if (!wasFired && this.triggerFired) {
                    this.triggerSampleIndex = ((_a = this.channelSamples[channelIndex]) === null || _a === void 0 ? void 0 : _a.samples.length) || 0;
                    this.updateTriggerPosition();
                }
            }
            // Handle holdoff countdown
            if (this.holdoffCounter > 0) {
                this.holdoffCounter--;
                this.updateTriggerStatus();
                if (this.holdoffCounter === 0) {
                    // Holdoff expired, reset trigger
                    this.triggerArmed = false;
                    this.triggerFired = false;
                    this.triggerSampleIndex = -1;
                    this.triggerProcessor.resetTrigger();
                    this.updateTriggerStatus();
                }
            }
            // Store current sample as previous for next iteration
            this.previousSample = sample;
            // Only update display if no trigger enabled or trigger conditions met
            if (!this.triggerSpec.trigEnabled || !this.triggerArmed || this.triggerFired) {
                // Proceed with normal sample recording
            }
            else {
                // Trigger enabled but not fired yet, skip this sample
                return false;
            }
        }
        if (channelIndex >= 0 && channelIndex < this.channelSamples.length) {
            var channelSamples = this.channelSamples[channelIndex];
            if (channelSamples.samples.length >= this.displaySpec.nbrSamples) {
                // remove oldest sample
                channelSamples.samples.shift();
                didScroll = true;
            }
            // record the new sample
            channelSamples.samples.push(sample);
        }
        else {
            this.logMessage("at recordChannelSample() with invalid channelIndex: ".concat(channelIndex));
        }
        return didScroll;
    };
    DebugScopeWindow.prototype.parseLegend = function (legend, channelSpec) {
        // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
        var validLegend = false;
        if (legend.length > 4 && legend.charAt(0) == '%') {
            channelSpec.lgndShowMax = legend.charAt(1) == '1' ? true : false;
            channelSpec.lgndShowMin = legend.charAt(2) == '1' ? true : false;
            channelSpec.lgndShowMaxLine = legend.charAt(3) == '1' ? true : false;
            channelSpec.lgndShowMinLine = legend.charAt(4) == '1' ? true : false;
            validLegend = true;
        }
        else if (legend.charAt(0) >= '0' && legend.charAt(0) <= '9') {
            // get integer value of legend and ensure it is within range 0-15
            var legendValue = Number(legend);
            if (legendValue >= 0 && legendValue <= 15) {
                channelSpec.lgndShowMax = (legendValue & 0x1) == 0x1 ? true : false;
                channelSpec.lgndShowMin = (legendValue & 0x2) == 0x2 ? true : false;
                channelSpec.lgndShowMaxLine = (legendValue & 0x4) == 0x4 ? true : false;
                channelSpec.lgndShowMinLine = (legendValue & 0x8) == 0x8 ? true : false;
                validLegend = true;
            }
        }
        if (!validLegend) {
            this.logMessage("at parseLegend() with invalid legend: ".concat(legend));
            channelSpec.lgndShowMax = false;
            channelSpec.lgndShowMin = false;
            channelSpec.lgndShowMaxLine = false;
            channelSpec.lgndShowMinLine = false;
        }
    };
    DebugScopeWindow.prototype.updateScopeChannelData = function (canvasName, channelSpec, samples, didScroll) {
        if (this.debugWindow) {
            //if (this.dbgUpdateCount > 0) {
            // DISABLE STOP this.dbgUpdateCount--;
            //}
            //if (this.dbgUpdateCount == 0) {
            //  return;
            //}
            if (--this.dbgLogMessageCount > 0) {
                this.logMessage("at updateScopeChannelData(".concat(canvasName, ", w/#").concat(samples.length, ") sample(s), didScroll=(").concat(didScroll, ")"));
            }
            try {
                // placement need to be scale sample range to vertical canvas size
                var currSample = samples[samples.length - 1];
                var prevSample = samples.length > 1 ? samples[samples.length - 2] : currSample;
                // Invert and scale the sample to to our display range
                var currSampleInverted = this.scaleAndInvertValue(currSample, channelSpec);
                var prevSampleInverted = this.scaleAndInvertValue(prevSample, channelSpec);
                // coord for current and previous samples
                // NOTE:  this.channelSpecs[x].yBaseOffset is NOT used in our implementation
                var currXOffset = this.canvasMargin + (samples.length - 1) * this.channelLineWidth;
                var currYOffset = this.channelLineWidth / 2 + currSampleInverted + this.canvasMargin + this.channelInset;
                var prevXOffset = this.canvasMargin + (samples.length - 2) * this.channelLineWidth;
                var prevYOffset = this.channelLineWidth / 2 + prevSampleInverted + this.canvasMargin + this.channelInset;
                //this.logMessage(`  -- prev=[${prevYOffset},${prevXOffset}], curr=[${currYOffset},${currXOffset}]`);
                // draw region for the channel
                var drawWidth = this.displaySpec.nbrSamples * this.channelLineWidth;
                var drawHeight = channelSpec.ySize + this.channelLineWidth / 2;
                var drawXOffset = this.canvasMargin;
                var drawYOffset = this.channelInset + this.canvasMargin;
                var channelColor = channelSpec.color;
                if (this.dbgLogMessageCount > 0) {
                    this.logMessage("  -- DRAW size=(".concat(drawWidth, ",").concat(drawHeight, "), offset=(").concat(drawYOffset, ",").concat(drawXOffset, ")"));
                    this.logMessage("  -- #".concat(samples.length, " currSample=(").concat(currSample, "->").concat(currSampleInverted, ") @ rc=[").concat(currYOffset, ",").concat(currXOffset, "], prev=[").concat(prevYOffset, ",").concat(prevXOffset, "]"));
                }
                // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
                // this.debugWindow.webContents.executeJavaScript(`
                //   (function() {
                //     // Locate the canvas element by its ID
                //     const canvas = document.getElementById('${canvasName}');
                //
                //     if (canvas && canvas instanceof HTMLCanvasElement) {
                //       // Get the canvas context
                //       const ctx = canvas.getContext('2d');
                //
                //       if (ctx) {
                //         // Set the line color and width
                //         const lineColor = '${channelColor}';
                //         const lineWidth = ${this.channelLineWidth};
                //         const scrollSpeed = lineWidth;
                //         const canvWidth = ${drawWidth};
                //         const canvHeight = ${drawHeight};
                //         const canvXOffset = ${drawXOffset};
                //         const canvYOffset = ${drawYOffset};
                //
                //         if (${didScroll}) {
                //           // Create an off-screen canvas
                //           const offScreenCanvas = document.createElement('canvas');
                //           offScreenCanvas.width = canvWidth - scrollSpeed;
                //           offScreenCanvas.height = canvHeight;
                //           const offScreenCtx = offScreenCanvas.getContext('2d');
                //
                //           if (offScreenCtx) {
                //             // Copy the relevant part of the canvas to the off-screen canvas
                //             //  drawImage(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
                //             offScreenCtx.drawImage(canvas, scrollSpeed + canvXOffset, canvYOffset, canvWidth - scrollSpeed, canvHeight, 0, 0, canvWidth - scrollSpeed, canvHeight);
                //
                //             // Clear the original canvas
                //             //  clearRect(x, y, width, height)
                //             //ctx.clearRect(canvXOffset, canvYOffset, canvWidth, canvHeight);
                //             // fix? artifact!! (maybe line-width caused?!!!)
                //             ctx.clearRect(canvXOffset-2, canvYOffset, canvWidth+2, canvHeight);
                //
                //             // Copy the content back to the original canvas
                //             //  drawImage(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
                //             ctx.drawImage(offScreenCanvas, 0, 0, canvWidth - scrollSpeed, canvHeight, canvXOffset, canvYOffset, canvWidth - scrollSpeed, canvHeight);
                //           }
                //         }
                //
                //         // Set the solid line pattern
                //         ctx.setLineDash([]); // Empty array for solid line
                //
                //         // Draw the new line segment
                //         ctx.strokeStyle = lineColor;
                //         ctx.lineWidth = lineWidth;
                //         ctx.beginPath();
                //         ctx.moveTo(${prevXOffset}, ${prevYOffset});
                //         ctx.lineTo(${currXOffset}, ${currYOffset});
                //         ctx.stroke();
                //       }
                //     }
                //   })();
                // `);
                var jsCode = '';
                // Handle scrolling if needed
                if (didScroll) {
                    var scrollSpeed = this.channelLineWidth;
                    jsCode += this.canvasRenderer.scrollCanvas(canvasName, scrollSpeed, drawWidth, drawHeight, drawXOffset, drawYOffset);
                }
                // Draw the scope signal line
                jsCode += this.canvasRenderer.drawLine(canvasName, prevXOffset, prevYOffset, currXOffset, currYOffset, channelColor, this.channelLineWidth);
                // Execute all the JavaScript at once
                this.debugWindow.webContents.executeJavaScript("(function() { ".concat(jsCode, " })();"));
            }
            catch (error) {
                console.error('Failed to update channel data:', error);
            }
            //if (didScroll) {
            //  this.dbgUpdateCount = 0; // stop after first scroll
            //}
        }
    };
    DebugScopeWindow.prototype.updateScopeChannelLabel = function (name, colorString) {
        if (this.debugWindow) {
            this.logMessage("at updateScopeChannelLabel(".concat(name, ", ").concat(colorString, ")"));
            try {
                var channelLabel = "<p style=\"color: ".concat(colorString, ";\">").concat(name, "</p>");
                this.debugWindow.webContents.executeJavaScript("\n          (function() {\n            const labelsDivision = document.getElementById('labels');\n            if (labelsDivision) {\n              let labelContent = labelsDivision.innerHTML;\n              labelContent += '".concat(channelLabel, "';\n              labelsDivision.innerHTML = labelContent;\n            }\n          })();\n        "));
            }
            catch (error) {
                console.error('Failed to update channel label:', error);
            }
        }
    };
    DebugScopeWindow.prototype.drawHorizontalLine = function (canvasName, channelSpec, YOffset, gridColor, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        if (this.debugWindow) {
            this.logMessage("at drawHorizontalLine(".concat(canvasName, ", ").concat(YOffset, ", ").concat(gridColor, ", width=").concat(lineWidth, ")"));
            try {
                var atTop = YOffset == channelSpec.maxValue;
                var horizLineWidth = 2;
                var lineYOffset = (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
                    this.channelInset +
                    this.canvasMargin;
                var lineXOffset = this.canvasMargin;
                this.logMessage("  -- atTop=(".concat(atTop, "), lineY=(").concat(lineYOffset, ")"));
                // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
                // this.debugWindow.webContents.executeJavaScript(`
                //   (function() {
                //     // Locate the canvas element by its ID
                //     const canvas = document.getElementById('${canvasName}');
                //
                //     if (canvas && canvas instanceof HTMLCanvasElement) {
                //       // Get the canvas context
                //       const ctx = canvas.getContext('2d');
                //
                //       if (ctx) {
                //         // Set the line color and width
                //         const lineColor = \'${gridColor}\';
                //         const lineWidth = ${horizLineWidth};
                //         const canWidth = canvas.width - (2 * ${this.canvasMargin});
                //
                //         // Set the dash pattern
                //         ctx.setLineDash([3, 3]); // 3px dash, 3px gap
                //
                //         // Draw the line
                //         ctx.strokeStyle = lineColor;
                //         ctx.lineWidth = lineWidth;
                //         ctx.beginPath();
                //         ctx.moveTo(${lineXOffset}, ${lineYOffset});
                //         ctx.lineTo(canWidth, ${lineYOffset});
                //         ctx.stroke();
                //       }
                //     }
                //   })();
                // `);
                // Generate the JavaScript code using CanvasRenderer
                var jsCode = this.canvasRenderer.drawDashedLine(canvasName, lineXOffset, lineYOffset, 0, // Will be replaced with dynamic width
                lineYOffset, gridColor, horizLineWidth, [3, 3]).replace('ctx.lineTo(0,', 'ctx.lineTo(canvas.width - (2 * ' + this.canvasMargin + '),');
                this.debugWindow.webContents.executeJavaScript("(function() { ".concat(jsCode, " })();"));
            }
            catch (error) {
                console.error('Failed to update line:', error);
            }
        }
    };
    DebugScopeWindow.prototype.drawHorizontalValue = function (canvasName, channelSpec, YOffset, textColor) {
        if (this.debugWindow) {
            this.logMessage("at drawHorizontalValue(".concat(canvasName, ", ").concat(YOffset, ", ").concat(textColor, ")"));
            try {
                var atTop = YOffset == channelSpec.maxValue;
                var lineYOffset = atTop ? this.channelInset : channelSpec.ySize + this.channelInset;
                var textYOffset = lineYOffset + (atTop ? 0 : 5); // 9pt font: offset text to top? rise from baseline, bottom? descend from line
                var textXOffset = 5 + this.canvasMargin;
                var value = atTop ? channelSpec.maxValue : channelSpec.minValue;
                var valueText = this.stringForRangeValue(value);
                this.logMessage("  -- atTop=(".concat(atTop, "), lineY=(").concat(lineYOffset, "), text=[").concat(valueText, "]"));
                // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
                // this.debugWindow.webContents.executeJavaScript(`
                //   (function() {
                //     // Locate the canvas element by its ID
                //     const canvas = document.getElementById('${canvasName}');
                //
                //     if (canvas && canvas instanceof HTMLCanvasElement) {
                //       // Get the canvas context
                //       const ctx = canvas.getContext('2d');
                //
                //       if (ctx) {
                //         // Set the line color and width
                //         const lineColor = \'${textColor}\';
                //         //const lineWidth = 2;
                //
                //         // Set the dash pattern
                //         //ctx.setLineDash([]); // Empty array for solid line
                //
                //         // Add text
                //         ctx.font = '9px Arial';
                //         ctx.fillStyle = lineColor;
                //         ctx.fillText('${valueText}', ${textXOffset}, ${textYOffset});
                //       }
                //     }
                //   })();
                // `);
                var jsCode = this.canvasRenderer.drawText(canvasName, valueText, textXOffset, textYOffset, textColor, '9px', 'Arial', 'left', 'top');
                this.debugWindow.webContents.executeJavaScript("(function() { ".concat(jsCode, " })();"));
            }
            catch (error) {
                console.error('Failed to update text:', error);
            }
        }
    };
    DebugScopeWindow.prototype.drawHorizontalLineAndValue = function (canvasName, channelSpec, YOffset, gridColor, textColor) {
        if (this.debugWindow) {
            this.logMessage("at drawHorizontalLineAndValue(".concat(canvasName, ", ").concat(YOffset, ", ").concat(gridColor, ", ").concat(textColor, ")"));
            try {
                var atTop = YOffset == channelSpec.maxValue;
                var horizLineWidth = 2;
                var lineYOffset = (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
                    this.channelInset +
                    this.canvasMargin;
                var lineXOffset = this.canvasMargin;
                var textYOffset = lineYOffset + (atTop ? 0 : 5); // 9pt font: offset text to top? rise from baseline, bottom? descend from line
                var textXOffset = 5 + this.canvasMargin;
                var value = atTop ? channelSpec.maxValue : channelSpec.minValue;
                var valueText = this.stringForRangeValue(value);
                this.logMessage("  -- atTop=(".concat(atTop, "), lineY=(").concat(lineYOffset, "), valueText=[").concat(valueText, "]"));
                // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
                // this.debugWindow.webContents.executeJavaScript(`
                //   (function() {
                //     // Locate the canvas element by its ID
                //     const canvas = document.getElementById('${canvasName}');
                //
                //     if (canvas && canvas instanceof HTMLCanvasElement) {
                //       // Get the canvas context
                //       const ctx = canvas.getContext('2d');
                //
                //       if (ctx) {
                //         // Set the line color and width
                //         const lineColor = \'${gridColor}\';
                //         const textColor = \'${textColor}\';
                //         const lineWidth = ${horizLineWidth};
                //         const canWidth = canvas.width - (2 * ${this.canvasMargin});
                //
                //         // Set the dash pattern
                //         ctx.setLineDash([3, 3]); // 5px dash, 3px gap
                //
                //         // Measure the text width
                //         ctx.font = '9px Arial';
                //         const textMetrics = ctx.measureText(\'${valueText}\');
                //         const textWidth = textMetrics.width;
                //
                //         // Draw the line
                //         ctx.strokeStyle = lineColor;
                //         ctx.lineWidth = lineWidth;
                //         ctx.beginPath();
                //         ctx.moveTo(textWidth + 8 + ${lineXOffset}, ${lineYOffset}); // start of line
                //         ctx.lineTo(canWidth, ${lineYOffset}); // draw to end of line
                //         ctx.stroke();
                //
                //         // Add text
                //         ctx.fillStyle = textColor;
                //         ctx.fillText(\'${valueText}\', ${textXOffset}, ${textYOffset});
                //       }
                //     }
                //   })();
                // `);
                // Need to measure text width and get canvas width dynamically
                var jsCode = "\n          const canvas = document.getElementById('".concat(canvasName, "');\n          if (canvas) {\n            const ctx = canvas.getContext('2d');\n            if (ctx) {\n              // Measure text width\n              ctx.font = '9px Arial';\n              const textMetrics = ctx.measureText('").concat(valueText, "');\n              const textWidth = textMetrics.width;\n              const canWidth = canvas.width - (2 * ").concat(this.canvasMargin, ");\n              \n              // Draw the dashed line after the text\n              ").concat(this.canvasRenderer.drawDashedLine(canvasName, 0, // Will be replaced
                lineYOffset, 0, // Will be replaced
                lineYOffset, gridColor, horizLineWidth, [3, 3]).replace('ctx.moveTo(0,', 'ctx.moveTo(textWidth + 8 + ' + lineXOffset + ',').replace('ctx.lineTo(0,', 'ctx.lineTo(canWidth,'), "\n              \n              // Draw the text\n              ").concat(this.canvasRenderer.drawText(canvasName, '${valueText}', textXOffset, textYOffset, textColor, '9px Arial'), "\n            }\n          }\n        ");
                this.debugWindow.webContents.executeJavaScript("(function() { ".concat(jsCode, " })();"));
            }
            catch (error) {
                console.error('Failed to update line & text:', error);
            }
        }
    };
    DebugScopeWindow.prototype.scaleAndInvertValue = function (value, channelSpec) {
        // scale the value to the vertical channel size then invert the value
        var range = channelSpec.maxValue - channelSpec.minValue;
        var adjustedValue = value - channelSpec.minValue;
        var possiblyScaledValue;
        // Scale the value to fit in the display range
        if (range != 0) {
            possiblyScaledValue = Math.round((adjustedValue / range) * (channelSpec.ySize - 1));
        }
        else {
            possiblyScaledValue = 0;
        }
        // Clamp to valid range
        possiblyScaledValue = Math.max(0, Math.min(channelSpec.ySize - 1, possiblyScaledValue));
        var invertedValue = channelSpec.ySize - 1 - possiblyScaledValue;
        if (this.dbgLogMessageCount > 0) {
            this.logMessage("  -- scaleAndInvertValue(".concat(value, ") => (").concat(possiblyScaledValue, "->").concat(invertedValue, ") range=[").concat(channelSpec.minValue, ":").concat(channelSpec.maxValue, "] ySize=(").concat(channelSpec.ySize, ")"));
        }
        return invertedValue;
    };
    DebugScopeWindow.prototype.stringForRangeValue = function (value) {
        // add +/- prefix to range value
        var prefix = value < 0 ? '' : '+';
        var valueString = "".concat(prefix).concat(value, " ");
        return valueString;
    };
    DebugScopeWindow.prototype.updateTriggerStatus = function () {
        if (this.debugWindow && this.triggerSpec.trigEnabled) {
            var statusText = 'READY';
            var statusClass = 'trigger-status'; // Base class
            if (this.holdoffCounter > 0) {
                statusText = "HOLDOFF (".concat(this.holdoffCounter, ")");
                statusClass += ' triggered';
            }
            else if (this.triggerFired) {
                statusText = 'TRIGGERED';
                statusClass += ' triggered';
            }
            else if (this.triggerArmed) {
                statusText = 'ARMED';
                statusClass += ' armed';
            }
            // Update window title to show trigger status
            var baseTitle = this.displaySpec.windowTitle;
            this.debugWindow.setTitle("".concat(baseTitle, " - ").concat(statusText));
            // Update HTML status element
            var channelInfo = this.triggerSpec.trigChannel >= 0 ?
                "CH".concat(this.triggerSpec.trigChannel + 1) : '';
            var levelInfo = "T:".concat(this.triggerSpec.trigLevel.toFixed(1), " A:").concat(this.triggerSpec.trigArmLevel.toFixed(1));
            this.debugWindow.webContents.executeJavaScript("\n        (function() {\n          const statusEl = document.getElementById('trigger-status');\n          if (statusEl) {\n            statusEl.innerHTML = '".concat(statusText, "<br><span style=\"font-size: 10px;\">").concat(channelInfo, " ").concat(levelInfo, "</span>';\n            statusEl.className = '").concat(statusClass, "';\n            statusEl.style.display = 'block';\n          }\n        })();\n      "));
        }
        else if (this.debugWindow) {
            // Hide trigger status when disabled
            this.debugWindow.webContents.executeJavaScript("\n        (function() {\n          const statusEl = document.getElementById('trigger-status');\n          if (statusEl) statusEl.style.display = 'none';\n        })();\n      ");
            // Reset window title
            this.debugWindow.setTitle(this.windowTitle);
        }
    };
    DebugScopeWindow.prototype.updateTriggerPosition = function () {
        if (this.debugWindow && this.triggerSpec.trigEnabled && this.triggerFired) {
            // For scope, the trigger position is at the current sample offset
            var triggerXPos = this.canvasMargin + this.triggerSpec.trigRtOffset * this.channelLineWidth;
            // Draw a vertical line at the trigger position for all channels
            var allJsCode = '';
            for (var chanIdx = 0; chanIdx < this.channelSpecs.length; chanIdx++) {
                var canvasName = "channel-".concat(chanIdx);
                var channelSpec = this.channelSpecs[chanIdx];
                // Draw vertical trigger position line with glow effect
                var jsCode = this.canvasRenderer.drawLine(canvasName, triggerXPos, this.channelInset + this.canvasMargin, triggerXPos, this.channelInset + this.canvasMargin + channelSpec.ySize, 'rgba(255, 0, 0, 0.8)', // Red trigger line
                2);
                // Add a second line for glow effect
                var glowCode = this.canvasRenderer.drawLine(canvasName, triggerXPos, this.channelInset + this.canvasMargin, triggerXPos, this.channelInset + this.canvasMargin + channelSpec.ySize, 'rgba(255, 0, 0, 0.3)', // Semi-transparent for glow
                4);
                allJsCode += jsCode + glowCode;
            }
            // Add trigger position marker at top
            if (this.channelSpecs.length > 0) {
                var markerCode = this.canvasRenderer.drawText('channel-0', '▼', triggerXPos - 5, this.canvasMargin - 2, 'rgba(255, 0, 0, 0.9)', '12px Arial');
                allJsCode += markerCode;
            }
            this.debugWindow.webContents.executeJavaScript("(function() { ".concat(allJsCode, " })();"));
        }
    };
    DebugScopeWindow.prototype.drawTriggerLevels = function () {
        if (this.debugWindow && this.triggerSpec.trigEnabled &&
            this.triggerSpec.trigChannel >= 0 && this.triggerSpec.trigChannel < this.channelSpecs.length) {
            var chanIdx = this.triggerSpec.trigChannel;
            var canvasName = "channel-".concat(chanIdx);
            var channelSpec = this.channelSpecs[chanIdx];
            var canvasWidth = this.displaySpec.nbrSamples * this.channelLineWidth + this.canvasMargin;
            // Draw arm level (orange solid line with label)
            if (this.triggerSpec.trigArmLevel >= channelSpec.minValue &&
                this.triggerSpec.trigArmLevel <= channelSpec.maxValue) {
                var armYInverted = this.scaleAndInvertValue(this.triggerSpec.trigArmLevel, channelSpec);
                var armYOffset = this.channelInset + this.canvasMargin + armYInverted;
                // Draw solid orange line
                var jsCodeArm = this.canvasRenderer.drawLine(canvasName, this.canvasMargin, armYOffset, canvasWidth, armYOffset, 'rgba(255, 165, 0, 0.8)', // Orange for arm level
                1);
                // Add "ARM" label
                var armLabelCode = this.canvasRenderer.drawText(canvasName, 'ARM', canvasWidth - 35, armYOffset - 2, 'rgba(255, 165, 0, 0.9)', '9px Arial');
                this.debugWindow.webContents.executeJavaScript("(function() { ".concat(jsCodeArm, " ").concat(armLabelCode, " })();"));
            }
            // Draw trigger level (green solid line with label)
            if (this.triggerSpec.trigLevel >= channelSpec.minValue &&
                this.triggerSpec.trigLevel <= channelSpec.maxValue) {
                var trigYInverted = this.scaleAndInvertValue(this.triggerSpec.trigLevel, channelSpec);
                var trigYOffset = this.channelInset + this.canvasMargin + trigYInverted;
                // Draw solid green line (thicker)
                var jsCodeTrig = this.canvasRenderer.drawLine(canvasName, this.canvasMargin, trigYOffset, canvasWidth, trigYOffset, 'rgba(0, 255, 0, 0.8)', // Green for trigger level
                2);
                // Add "TRIG" label
                var trigLabelCode = this.canvasRenderer.drawText(canvasName, 'TRIG', canvasWidth - 35, trigYOffset - 2, 'rgba(0, 255, 0, 0.9)', '9px Arial');
                this.debugWindow.webContents.executeJavaScript("(function() { ".concat(jsCodeTrig, " ").concat(trigLabelCode, " })();"));
            }
        }
    };
    /**
     * Get the canvas element ID for this window
     */
    DebugScopeWindow.prototype.getCanvasId = function () {
        return 'canvas'; // Scope window uses 'canvas' as the ID
    };
    /**
     * Transform mouse coordinates to scope-specific coordinates
     * X: pixel position within display area (0 to width-1)
     * Y: inverted pixel position (bottom = 0)
     */
    DebugScopeWindow.prototype.transformMouseCoordinates = function (x, y) {
        // Calculate margins and dimensions
        var marginLeft = this.contentInset;
        var marginTop = this.channelInset;
        var width = this.displaySpec.size.width - 2 * this.contentInset;
        var height = this.displaySpec.size.height - 2 * this.channelInset;
        // Check if mouse is within the display area
        if (x >= marginLeft && x < marginLeft + width &&
            y >= marginTop && y < marginTop + height) {
            // Transform to scope coordinates
            // X: relative to left margin
            var scopeX = x - marginLeft;
            // Y: inverted with bottom = 0
            var scopeY = marginTop + height - 1 - y;
            return { x: scopeX, y: scopeY };
        }
        else {
            // Mouse is outside display area
            return { x: -1, y: -1 };
        }
    };
    /**
     * Get pixel color getter for mouse events
     */
    DebugScopeWindow.prototype.getPixelColorGetter = function () {
        var _this = this;
        return function (_x, _y) {
            if (_this.debugWindow) {
                // This would need to be implemented to sample pixel color from canvas
                // For now, return a default value
                return 0x000000;
            }
            return -1;
        };
    };
    /**
     * Override enableMouseInput to add coordinate display functionality
     */
    DebugScopeWindow.prototype.enableMouseInput = function () {
        // Call base implementation first
        _super.prototype.enableMouseInput.call(this);
        // Add coordinate display functionality
        if (this.debugWindow) {
            var marginLeft = this.contentInset;
            var marginTop = this.channelInset;
            var displayWidth = this.displaySpec.size.width - 2 * this.contentInset;
            var displayHeight = this.displaySpec.size.height - 2 * this.channelInset;
            this.debugWindow.webContents.executeJavaScript("\n        (function() {\n          const container = document.getElementById('container');\n          const coordDisplay = document.getElementById('coordinate-display');\n          const crosshairH = document.getElementById('crosshair-horizontal');\n          const crosshairV = document.getElementById('crosshair-vertical');\n          \n          if (container && coordDisplay && crosshairH && crosshairV) {\n            // Track mouse position\n            let lastMouseX = -1;\n            let lastMouseY = -1;\n            \n            container.addEventListener('mousemove', (event) => {\n              const rect = container.getBoundingClientRect();\n              const x = event.clientX - rect.left;\n              const y = event.clientY - rect.top;\n              \n              // Calculate relative position within data area\n              const dataX = x - ".concat(marginLeft, ";\n              const dataY = y - ").concat(marginTop, ";\n              \n              // Check if within display area\n              if (dataX >= 0 && dataX < ").concat(displayWidth, " && \n                  dataY >= 0 && dataY < ").concat(displayHeight, ") {\n                \n                // Calculate scope coordinates\n                const scopeX = dataX;\n                const scopeY = ").concat(displayHeight, " - 1 - dataY;\n                \n                // Update coordinate display\n                coordDisplay.textContent = scopeX + ',' + scopeY;\n                coordDisplay.style.display = 'block';\n                \n                // Position the display near cursor, avoiding edges\n                const displayRect = coordDisplay.getBoundingClientRect();\n                let displayX = event.clientX + 10;\n                let displayY = event.clientY - displayRect.height - 10;\n                \n                // Adjust if too close to edges\n                if (displayX + displayRect.width > window.innerWidth - 10) {\n                  displayX = event.clientX - displayRect.width - 10;\n                }\n                if (displayY < 10) {\n                  displayY = event.clientY + 10;\n                }\n                \n                coordDisplay.style.left = displayX + 'px';\n                coordDisplay.style.top = displayY + 'px';\n                \n                // Update crosshair position\n                crosshairH.style.display = 'block';\n                crosshairV.style.display = 'block';\n                crosshairH.style.top = event.clientY + 'px';\n                crosshairV.style.left = event.clientX + 'px';\n                \n                lastMouseX = x;\n                lastMouseY = y;\n              } else {\n                // Hide displays when outside data area\n                coordDisplay.style.display = 'none';\n                crosshairH.style.display = 'none';\n                crosshairV.style.display = 'none';\n              }\n            });\n            \n            // Hide displays when mouse leaves container\n            container.addEventListener('mouseleave', () => {\n              coordDisplay.style.display = 'none';\n              crosshairH.style.display = 'none';\n              crosshairV.style.display = 'none';\n            });\n          }\n        })();\n      "));
        }
    };
    return DebugScopeWindow;
}(debugWindowBase_1.DebugWindowBase));
exports.DebugScopeWindow = DebugScopeWindow;
