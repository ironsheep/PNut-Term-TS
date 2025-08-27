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
exports.DebugTermWindow = void 0;
var electron_1 = require("electron");
var debugColor_1 = require("./shared/debugColor");
var spin2NumericParser_1 = require("./shared/spin2NumericParser");
var canvasRenderer_1 = require("./shared/canvasRenderer");
var debugWindowBase_1 = require("./debugWindowBase");
var windowPlacer_1 = require("../utils/windowPlacer");
/**
 * Debug TERM Window - Text Terminal Display
 *
 * A monospace text terminal for displaying debug output from Propeller 2 microcontrollers.
 * This implementation follows the Pascal PNut design, repurposing ASCII control characters
 * for debug-specific functions rather than standard terminal emulation.
 *
 * ## Features
 * - **Monospace Text Display**: Fixed-width character grid with configurable size
 * - **Color Combinations**: Up to 4 foreground/background color pairs (combos 0-3)
 * - **Cursor Control**: Direct positioning, home, backspace, and tab support
 * - **Auto-scrolling**: Automatic scroll when text reaches bottom of display
 * - **Mouse/Keyboard Forwarding**: PC_KEY and PC_MOUSE input forwarding to P2
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE columns rows` - Set terminal size in characters (1-256, default: 40x20)
 * - `TEXTSIZE half-pix` - Set font size (6-200, default: editor font size)
 * - `COLOR fg bg {fg1 bg1 {fg2 bg2 {fg3 bg3}}}` - Define color combos (default: ORANGE on BLACK)
 * - `BACKCOLOR color {brightness}` - Set default text color (deprecated, use COLOR)
 * - `UPDATE` - Enable deferred update mode (requires UPDATE command)
 * - `HIDEXY` - Hide mouse coordinate display
 *
 * ## Data Format
 * Data is fed as numeric control codes or quoted strings:
 * - Numeric values 0-31: Control codes for cursor and color management
 * - Numeric values 32-255: Direct character codes
 * - Quoted strings: Text to display at current cursor position
 * - Example: `debug(\`Term 0 'Hello' 13 10 'World')`
 *
 * ## Commands
 * - `0` - Clear screen and home cursor
 * - `1` - Home cursor only
 * - `2 column` - Set cursor column (0-based)
 * - `3 row` - Set cursor row (0-based)
 * - `4-7` - Select color combo 0-3
 * - `8` - Backspace (with line wrap)
 * - `9` - Tab to next 8-column boundary
 * - `10` or `13` - Line feed/carriage return
 * - `32-255` - Display character at cursor
 * - `'string'` - Display string at cursor
 * - `CLEAR` - Clear terminal display
 * - `UPDATE` - Force display update (when UPDATE directive used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding
 * - `PC_MOUSE` - Enable mouse input forwarding
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `TERM_Configure` procedure (line 2181)
 * - Update: `TERM_Update` procedure (line 2223)
 * - Character handling: `TERM_Chr` procedure
 *
 * ## Examples
 * ```spin2
 * ' Basic terminal output
 * debug(`TERM MyTerm SIZE 80 24 'Hello, World!')
 *
 * ' Using color combos
 * debug(`TERM MyTerm COLOR WHITE BLACK RED YELLOW)
 * debug(`MyTerm 4 'Default' 5 ' Red on Yellow')
 * ```
 *
 * ## Implementation Notes
 * - Tab width is fixed at 8 columns
 * - Line wrapping occurs at column boundary
 * - Scrolling preserves current color combo for cleared lines
 *
 * ## Deviations from Pascal
 * - **No ANSI Support**: ANSI escape sequences removed to match Pascal implementation
 * - **ASCII 7 Repurposed**: BELL character (ASCII 7) selects color combo 3, not audio bell
 * - **Color Combo Limit**: Limited to 4 color combinations (Pascal design)
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_TERM.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
var DebugTermWindow = /** @class */ (function (_super) {
    __extends(DebugTermWindow, _super);
    function DebugTermWindow(ctx, displaySpec, windowId) {
        var _this = this;
        // Use the user-provided display name as the window ID for proper routing
        var actualWindowId = windowId || displaySpec.displayName;
        _this = _super.call(this, ctx, actualWindowId, 'terminal') || this;
        _this.displaySpec = {};
        _this.isFirstDisplayData = true;
        _this.contentInset = 6; // 6 pixels from left and right of window
        _this.borderMargin = 10; // 10 pixels all around
        // current terminal state
        _this.deferredCommands = [];
        _this.cursorPosition = { x: 0, y: 0 };
        _this.selectedCombo = 0;
        _this.canvasRenderer = new canvasRenderer_1.CanvasRenderer();
        _this.windowLogPrefix = 'trmW';
        // record our Debug Term Window Spec
        _this.displaySpec = displaySpec;
        // adjust our contentInset for font size
        _this.contentInset = _this.displaySpec.font.charWidth / 2;
        // CRITICAL FIX: Create window immediately, don't wait for data
        // This ensures windows appear when created, even if closed before data arrives
        _this.logMessage('Creating TERM window immediately in constructor');
        _this.createDebugWindow();
        return _this;
    }
    Object.defineProperty(DebugTermWindow.prototype, "windowTitle", {
        get: function () {
            var desiredValue = "".concat(this.displaySpec.displayName, " TERM");
            if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
                desiredValue = this.displaySpec.windowTitle;
            }
            return desiredValue;
        },
        enumerable: false,
        configurable: true
    });
    DebugTermWindow.parseTermDeclaration = function (lineParts) {
        // here with lineParts = ['`TERM', {displayName}, ...]
        // Valid directives are:
        //   TITLE <title>
        //   POS <left> <top> [default: 0, 0]
        //   SIZE <columns> <rows> [default: 40, 20]
        //   TEXTSIZE <half-pix> [6-200, default: editor font size]
        //   COLOR <text-color> {{{{<bgnd-color> {<#0-color>}} {<#0-color>}} {<#0-color>}}
        //   BACKCOLOR <color> [default: black]
        //   UPDATE [default: automatic update]
        //   HIDEXY [default: not hidden]
        console.log("CL: at parseTermDeclaration()");
        var displaySpec = {};
        displaySpec.colorCombos = []; // ensure this is structured too! (CRASHED without this!)
        displaySpec.window = {}; // ensure this is structured too! (CRASHED without this!)
        displaySpec.font = {}; // ensure this is structured too! (CRASHED without this!)
        var isValid = false;
        // set defaults
        var bkgndColor = new debugColor_1.DebugColor('BLACK');
        var gridColor = new debugColor_1.DebugColor('GRAY', 4);
        var textColor = new debugColor_1.DebugColor('ORANGE', 15);
        console.log("CL: at parseTermDeclaration() with colors...");
        displaySpec.position = { x: 0, y: 0 };
        displaySpec.size = { columns: 40, rows: 20 };
        debugWindowBase_1.DebugWindowBase.calcMetricsForFontPtSize(12, displaySpec.font);
        displaySpec.window.background = bkgndColor.rgbString;
        displaySpec.window.grid = gridColor.rgbString;
        displaySpec.textColor = textColor.rgbString;
        displaySpec.delayedUpdate = false;
        displaySpec.hideXY = false;
        // by default we have combo #0 defined
        displaySpec.colorCombos.push({ fgcolor: displaySpec.textColor, bgcolor: displaySpec.window.background });
        // now parse overrides to defaults
        console.log("CL: at overrides TermDisplaySpec: ".concat(lineParts));
        if (lineParts.length > 1) {
            displaySpec.displayName = lineParts[1];
            isValid = true; // invert default value
        }
        if (lineParts.length > 2) {
            for (var index = 2; index < lineParts.length; index++) {
                var element = lineParts[index];
                switch (element.toUpperCase()) {
                    case 'TITLE':
                        // ensure we have one more value
                        if (index < lineParts.length - 1) {
                            displaySpec.windowTitle = lineParts[++index];
                        }
                        else {
                            // console.log() as we are in class static method, not derived class...
                            console.log("CL: TermDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'POS':
                        // ensure we have two more values
                        if (index < lineParts.length - 2) {
                            var x = spin2NumericParser_1.Spin2NumericParser.parsePixel(lineParts[++index]);
                            var y = spin2NumericParser_1.Spin2NumericParser.parsePixel(lineParts[++index]);
                            if (x !== null && y !== null) {
                                displaySpec.position.x = x;
                                displaySpec.position.y = y;
                            }
                            else {
                                console.log("CL: TermDisplaySpec: Invalid position values");
                                isValid = false;
                            }
                        }
                        else {
                            console.log("CL: TermDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'SIZE':
                        // ensure we have two more values
                        if (index < lineParts.length - 2) {
                            var columns = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index]);
                            var rows = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index]);
                            if (columns !== null && rows !== null && columns >= 1 && rows >= 1) {
                                displaySpec.size.columns = Math.min(columns, 256);
                                displaySpec.size.rows = Math.min(rows, 256);
                            }
                            else {
                                console.log("CL: TermDisplaySpec: Invalid size values (must be 1-256)");
                                isValid = false;
                            }
                        }
                        else {
                            console.log("CL: TermDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'TEXTSIZE':
                        // ensure we have one more value
                        if (index < lineParts.length - 1) {
                            var sizeInPts = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index]);
                            if (sizeInPts !== null && sizeInPts >= 6 && sizeInPts <= 200) {
                                debugWindowBase_1.DebugWindowBase.calcMetricsForFontPtSize(sizeInPts, displaySpec.font);
                            }
                            else {
                                console.log("CL: TermDisplaySpec: Invalid text size (must be 6-200)");
                                isValid = false;
                            }
                        }
                        else {
                            console.log("CL: TermDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'BACKCOLOR':
                        // ensure we have one more value
                        if (index < lineParts.length - 1) {
                            var colorName = lineParts[++index];
                            var colorBrightness = 8;
                            if (index < lineParts.length - 1) {
                                colorBrightness = Number(lineParts[++index]);
                            }
                            var textColor_1 = new debugColor_1.DebugColor(colorName, colorBrightness);
                            displaySpec.textColor = textColor_1.rgbString;
                        }
                        else {
                            console.log("CL: TermDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'COLOR':
                        // here with
                        //   COLOR fg-color0 bg-color0 [fg-color1 bg-color1 [fg-color2 bg-color2 [fg-color3 bg-color3]]]
                        //   fg/bg-color is a color name, with optional brightness: {name [brightness]}
                        // ensure we color names in pairs!
                        var colorComboIdx = 0;
                        var fgColor = undefined;
                        var bgColor = undefined;
                        var haveName = false;
                        var fgColorName = undefined;
                        var bgColorName = undefined;
                        for (var colorIdx = index + 1; colorIdx < lineParts.length; colorIdx++) {
                            var element_1 = lineParts[colorIdx];
                            if (fgColor !== undefined && bgColor !== undefined) {
                                // have both fg and bg colors, make a color combo
                                var channelColor = { fgcolor: fgColor, bgcolor: bgColor };
                                if (colorComboIdx == 0) {
                                    // remove our default color combo
                                    displaySpec.colorCombos = [];
                                }
                                displaySpec.colorCombos.push(channelColor);
                                colorComboIdx++;
                            }
                            else if (!haveName) {
                                // color name
                                var newColorName = element_1.toUpperCase();
                                if (fgColorName === undefined) {
                                    fgColorName = newColorName;
                                }
                                else if (bgColorName === undefined) {
                                    bgColorName = newColorName;
                                }
                                haveName = true;
                            }
                            else {
                                // this could be color brightness or next name...
                                var colorBrightness = 8;
                                var possibleBrightness = lineParts[colorIdx + 1];
                                // if possible is numeric then we have brightness
                                var numericResult = possibleBrightness.match(/^-{0,1}\d+$/);
                                if (numericResult != null) {
                                    // have brightness for latest colorName
                                    colorBrightness = Number(lineParts[++colorIdx]);
                                    if (fgColorName !== undefined) {
                                        // this is fg brightness
                                        fgColor = new debugColor_1.DebugColor(fgColorName, colorBrightness).rgbString;
                                        fgColorName = undefined;
                                    }
                                    else if (bgColorName !== undefined) {
                                        // this is bg brightness
                                        bgColor = new debugColor_1.DebugColor(bgColorName, colorBrightness).rgbString;
                                        bgColorName = undefined;
                                    }
                                    haveName = false; // next up we're looking for next color name
                                }
                                else {
                                    // have next color name
                                    // record current color as fg then save bgColorName
                                    if (fgColorName !== undefined) {
                                        fgColor = new debugColor_1.DebugColor(fgColorName).rgbString;
                                        fgColorName = undefined;
                                    }
                                    else {
                                        console.log("CL: TermDisplaySpec: Missing fgColorName for ".concat(element_1));
                                    }
                                    var newColorName = element_1.toUpperCase();
                                    bgColorName = newColorName;
                                    // we have the bg color name
                                    haveName = true;
                                }
                            }
                        }
                        break;
                    case 'UPDATE':
                        displaySpec.delayedUpdate = true;
                        break;
                    case 'HIDEXY':
                        displaySpec.hideXY = true;
                        break;
                    default:
                        console.log("CL: TermDisplaySpec: Unknown directive: ".concat(element));
                        break;
                }
                if (!isValid) {
                    break;
                }
            }
        }
        console.log("CL: at end of parseTermDeclaration(): isValid=(".concat(isValid, "), ").concat(JSON.stringify(displaySpec, null, 2)));
        return [isValid, displaySpec];
    };
    DebugTermWindow.prototype.createDebugWindow = function () {
        var _this = this;
        this.logMessage("at createDebugWindow() TERM");
        // calculate overall canvas sizes then window size from them!
        // NOTES: Chip's size estimation:
        //  window width should be (#samples * 2) + (2 * 2); // 2 is for the 2 borders
        //  window height should be (max-min+1) + (2 * chanInset); // chanInset is for space above channel and below channel
        // set height so no scroller by default
        var canvasHeight = this.displaySpec.size.rows * this.displaySpec.font.lineHeight;
        // for mono-spaced font width 1/2 ht in pts
        var canvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
        this.logMessage("  -- TERM canvas size=(".concat(canvasWidth, "x").concat(canvasHeight, ") char=(").concat(this.displaySpec.font.charWidth, "x").concat(this.displaySpec.font.charHeight, ") ln=(").concat(this.displaySpec.font.lineHeight, ")"));
        var divHeight = canvasHeight + 4; // 4 is fudge number
        var divWidth = canvasWidth + 4; // 4 is fudge number
        var windowHeight = divHeight + this.borderMargin * 2;
        var windowWidth = divWidth + this.borderMargin * 2;
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
            var position = windowPlacer.getNextPosition("term-".concat(this.displaySpec.displayName), placementConfig);
            windowX = position.x;
            windowY = position.y;
            this.logMessage("  -- TERM using auto-placement: ".concat(windowX, ",").concat(windowY));
        }
        this.logMessage("  -- TERM window size: ".concat(windowWidth, "x").concat(windowHeight, " @").concat(windowX, ",").concat(windowY));
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
            windowPlacer.registerWindow("term-".concat(this.displaySpec.displayName), this.debugWindow);
        }
        // hook window events before being shown
        this.debugWindow.on('ready-to-show', function () {
            var _a;
            _this.logMessage('* Term window will show...');
            (_a = _this.debugWindow) === null || _a === void 0 ? void 0 : _a.show();
        });
        this.debugWindow.on('show', function () {
            _this.logMessage('* Term window shown');
        });
        this.debugWindow.on('page-title-updated', function () {
            _this.logMessage('* Term window title updated');
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
        var htmlContent = "\n    <html>\n      <head>\n        <meta charset=\"UTF-8\"></meta>\n        <title>".concat(displayName, "</title>\n        <style>\n          @font-face {\n            font-family: 'Parallax';\n            src: url('").concat(this.getParallaxFontUrl(), "') format('truetype');\n          }\n          body {\n            display: flex;\n            flex-direction: column;\n            margin: 0;\n            padding: 0;\n            font-family: 'Parallax', sans-serif;\n            font-size: ").concat(this.displaySpec.font.textSizePts, "pt;\n            //background-color: ").concat(this.displaySpec.window.background, ";\n            background-color: rgb(140, 52, 130);\n            color: ").concat(this.displaySpec.textColor, ";\n            overflow: hidden; /* CRITICAL: Prevent scrollbars */\n          }\n          #terminal-data {\n            display: flex;\n            flex-direction: column;\n            justify-content: flex-end;\n            flex-grow: 0;\n            flex-shrink: 0;\n            padding: 10px;\n            //background-color:rgb(55, 170, 136);\n            background-color: ").concat(this.displaySpec.window.background, ";\n            width: ").concat(divWidth, "px; /* Set a fixed width */\n            height: ").concat(divHeight, "px; /* Set a fixed height */\n          }\n          canvas {\n            // background-color:rgb(9, 201, 28);\n            background-color: ").concat(this.displaySpec.window.background, ";\n            margin: 0;\n          }\n        </style>\n      </head>\n      <body>\n        <div id=\"terminal-data\">\n          <canvas id=\"text-area\" width=\"").concat(canvasWidth, "\" height=\"").concat(canvasHeight, "\"></canvas>\n        </div>\n      </body>\n    </html>\n  ");
        this.logMessage("at createDebugWindow() TERM with htmlContent: ".concat(htmlContent));
        try {
            this.debugWindow.setMenu(null);
            this.debugWindow.loadURL("data:text/html,".concat(encodeURIComponent(htmlContent)));
        }
        catch (error) {
            this.logMessage("Failed to load URL: ".concat(error));
        }
        // now hook load complete event so we can label and paint the grid/min/max, etc.
        this.debugWindow.webContents.on('did-finish-load', function () {
            _this.logMessage('at did-finish-load');
        });
    };
    DebugTermWindow.prototype.closeDebugWindow = function () {
        this.logMessage("at closeDebugWindow() TERM");
        // let our base class do the work
        this.debugWindow = null;
    };
    DebugTermWindow.prototype.processMessageImmediate = function (lineParts) {
        // Handle async internally
        this.processMessageAsync(lineParts);
    };
    DebugTermWindow.prototype.processMessageAsync = function (lineParts) {
        return __awaiter(this, void 0, void 0, function () {
            var unparsedCommand, index, currLinePart, displayString, stringParts, nextLinePart, action, saveWindow, fileNameIndex, saveFileName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        unparsedCommand = lineParts.join(' ');
                        index = 1;
                        _a.label = 1;
                    case 1:
                        if (!(index < lineParts.length)) return [3 /*break*/, 12];
                        currLinePart = lineParts[index];
                        if (!(currLinePart.charAt(0) == "'")) return [3 /*break*/, 2];
                        displayString = undefined;
                        // isolate string and display it. Advance index to next part after close quote
                        if (currLinePart.substring(1).includes("'")) {
                            // string ends in this single linepart
                            displayString = currLinePart.substring(1, currLinePart.length - 1);
                        }
                        else {
                            stringParts = [currLinePart.substring(1)];
                            while (index < lineParts.length - 1) {
                                index++;
                                nextLinePart = lineParts[index];
                                if (nextLinePart.includes("'")) {
                                    // last part of string
                                    stringParts.push(nextLinePart.substring(0, nextLinePart.length - 1));
                                    break; // exit loop
                                }
                                else {
                                    stringParts.push(nextLinePart);
                                }
                            }
                            displayString = stringParts.join(' ');
                        }
                        if (displayString !== undefined) {
                            this.updateTermDisplay("'".concat(displayString, "'"));
                        }
                        return [3 /*break*/, 11];
                    case 2:
                        if (!(lineParts[index].charAt(0) >= '0' && lineParts[index].charAt(0) <= '9')) return [3 /*break*/, 3];
                        action = parseInt(lineParts[index], 10);
                        if (action == 2 || action == 3) {
                            // pass param value with goto line, goto column
                            if (index + 1 < lineParts.length) {
                                this.updateTermDisplay("".concat(action, " ").concat(lineParts[index + 1]));
                            }
                            else {
                                this.logMessage("* UPD-ERROR  missing value for action ".concat(action));
                            }
                        }
                        if (action >= 32 && action <= 255) {
                            // printable character
                            this.updateTermDisplay("'".concat(String.fromCharCode(action), "'"));
                        }
                        else {
                            // all other actions
                            this.updateTermDisplay("".concat(action));
                        }
                        return [3 /*break*/, 11];
                    case 3:
                        if (!(lineParts[index].toUpperCase() == 'UPDATE')) return [3 /*break*/, 4];
                        // update window with latest content
                        this.pushDisplayListToTerm();
                        return [3 /*break*/, 11];
                    case 4:
                        if (!(lineParts[index].toUpperCase() == 'CLEAR')) return [3 /*break*/, 5];
                        // clear window
                        this.clearTerm();
                        return [3 /*break*/, 11];
                    case 5:
                        if (!(lineParts[index].toUpperCase() == 'CLOSE')) return [3 /*break*/, 6];
                        // close the window
                        this.closeDebugWindow();
                        return [3 /*break*/, 11];
                    case 6:
                        if (!(lineParts[index].toUpperCase() == 'SAVE')) return [3 /*break*/, 10];
                        saveWindow = false;
                        fileNameIndex = index + 1;
                        // Check for optional WINDOW parameter
                        if (index + 1 < lineParts.length && lineParts[index + 1].toUpperCase() === 'WINDOW') {
                            saveWindow = true;
                            fileNameIndex = index + 2;
                        }
                        if (!(fileNameIndex < lineParts.length)) return [3 /*break*/, 8];
                        saveFileName = this.removeStringQuotes(lineParts[fileNameIndex]);
                        // save the window to a file (as BMP)
                        return [4 /*yield*/, this.saveWindowToBMPFilename(saveFileName)];
                    case 7:
                        // save the window to a file (as BMP)
                        _a.sent();
                        index = fileNameIndex; // Update index to skip processed parameters
                        return [3 /*break*/, 9];
                    case 8:
                        this.logMessage("at updateContent() missing SAVE fileName in [".concat(lineParts.join(' '), "]"));
                        _a.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        if (lineParts[index].toUpperCase() == 'PC_KEY') {
                            // Enable keyboard input forwarding
                            this.enableKeyboardInput();
                            return [3 /*break*/, 12]; // PC_KEY must be last command
                        }
                        else if (lineParts[index].toUpperCase() == 'PC_MOUSE') {
                            // Enable mouse input forwarding
                            this.enableMouseInput();
                            return [3 /*break*/, 12]; // PC_MOUSE must be last command
                        }
                        else {
                            this.logMessage("* UPD-ERROR  unknown directive: ".concat(lineParts[index], "\nCommand: ").concat(unparsedCommand));
                        }
                        _a.label = 11;
                    case 11:
                        index++;
                        return [3 /*break*/, 1];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    DebugTermWindow.prototype.updateTermDisplay = function (text) {
        // add action to our display list
        //this.logMessage(`* updateTermDisplay(${text})`);
        this.deferredCommands.push(text);
        // Window already created in constructor, just mark that we have data
        if (this.isFirstDisplayData) {
            this.isFirstDisplayData = false;
        }
        // if not deferred update the act on display list now
        if (this.displaySpec.delayedUpdate == false) {
            // act on display list now
            this.pushDisplayListToTerm();
        }
    };
    DebugTermWindow.prototype.pushDisplayListToTerm = function () {
        var _this = this;
        if (this.deferredCommands.length > 0) {
            // act on display list now
            this.deferredCommands.forEach(function (displayString) {
                _this.logMessage("* UPD-INFO displayString: [".concat(displayString, "]"));
                // these will be numbers (actions) or strings (display)
                // NOTE: 32-255 will arrive as single char strings 'char'
                if (displayString.charAt(0) == "'") {
                    _this.writeStringToTerm(displayString.substring(1, displayString.length - 1));
                }
                else {
                    // this is a numeric action
                    //cursor pos cases are 2, 3 and will arrive as '2 n' or '3 n'
                    var numbers = displayString.split(' ');
                    var action = parseInt(numbers[0], 10);
                    switch (action) {
                        case 0:
                            // clear terminal display and home cursor
                            _this.clearTerm();
                            break;
                        case 1:
                            // home cursor
                            _this.cursorPosition = { x: 0, y: 0 };
                            break;
                        case 2:
                            // set column to next character value
                            if (numbers.length > 1) {
                                var column = spin2NumericParser_1.Spin2NumericParser.parsePixel(numbers[1]);
                                if (column !== null) {
                                    _this.cursorPosition.x = Math.min(column, _this.displaySpec.size.columns - 1);
                                }
                                else {
                                    _this.logMessage("* UPD-ERROR  invalid column value for action 2: ".concat(numbers[1]));
                                }
                            }
                            else {
                                _this.logMessage("* UPD-ERROR  missing column value for action 2");
                            }
                            break;
                        case 3:
                            // set row to next character value
                            if (numbers.length > 1) {
                                var row = spin2NumericParser_1.Spin2NumericParser.parsePixel(numbers[1]);
                                if (row !== null) {
                                    _this.cursorPosition.y = Math.min(row, _this.displaySpec.size.rows - 1);
                                }
                                else {
                                    _this.logMessage("* UPD-ERROR  invalid row value for action 3: ".concat(numbers[1]));
                                }
                            }
                            else {
                                _this.logMessage("* UPD-ERROR  missing row value for action 3");
                            }
                            break;
                        case 4:
                        case 5:
                        case 6:
                        case 7:
                            // select color combo #0-3
                            _this.selectedCombo = action - 4;
                            break;
                        case 8:
                            // backspace
                            if (_this.cursorPosition.x > 0) {
                                _this.cursorPosition.x--;
                            }
                            break;
                        case 9:
                            // move to next tab column (tabwidth 8)
                            // move cursor to next tabstop
                            var spacesToTab = 8 - (_this.cursorPosition.x % 8);
                            for (var i = 0; i < spacesToTab; i++) {
                                // Use writeCharToTerm to handle wrapping properly like Pascal's TERM_Chr
                                _this.writeCharToTerm(' ');
                            }
                            break;
                        case 10:
                        case 13:
                            // reset cursor to start of next line
                            _this.cursorPosition.x = 0;
                            if (_this.cursorPosition.y < _this.displaySpec.size.rows - 1) {
                                _this.cursorPosition.y += 1;
                            }
                            break;
                        default:
                            _this.logMessage("* UPD-ERROR  unknown action: ".concat(action));
                            break;
                    }
                }
            });
            this.deferredCommands = []; // all done, empty the list
        }
    };
    DebugTermWindow.prototype.clearTerm = function () {
        // erase the text display area
        this.clearTextArea();
        // home the cursorPosition
        this.cursorPosition = { x: 0, y: 0 };
    };
    DebugTermWindow.prototype.clearTextArea = function () {
        if (this.debugWindow) {
            this.logMessage("at clearTextArea()");
            try {
                var bgcolor = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
                this.logMessage("  -- bgcolor=[".concat(bgcolor, "]"));
                var jsCode = this.canvasRenderer.clearCanvasWithBackground('text-area', bgcolor);
                this.debugWindow.webContents.executeJavaScript(jsCode);
            }
            catch (error) {
                console.error('Failed to update text:', error);
            }
        }
    };
    DebugTermWindow.prototype.writeStringToTerm = function (text) {
        if (this.debugWindow) {
            this.logMessage("at writeStringToTerm(".concat(text, ")"));
            // Process string character by character
            for (var i = 0; i < text.length; i++) {
                var char = text.charAt(i);
                this.writeCharToTerm(char);
            }
        }
    };
    /**
     * Write a single character to the terminal at the current cursor position
     */
    DebugTermWindow.prototype.writeCharToTerm = function (char) {
        if (!this.debugWindow)
            return;
        try {
            var textHeight = this.displaySpec.font.charHeight;
            var textSizePts = this.displaySpec.font.textSizePts;
            var lineHeight = this.displaySpec.font.lineHeight;
            var charWidth = this.displaySpec.font.charWidth;
            var textYOffset = this.cursorPosition.y * lineHeight + this.contentInset;
            var textXOffset = this.cursorPosition.x * charWidth + this.contentInset;
            var vertLineInset = (lineHeight - textHeight) / 2;
            var textYbaseline = textYOffset + vertLineInset + this.displaySpec.font.baseline;
            var fgColor = this.displaySpec.colorCombos[this.selectedCombo].fgcolor;
            var bgcolor = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
            var fontSpec = "normal ".concat(textSizePts, "pt Consolas, monospace");
            // Use the canvas renderer for character drawing
            var jsCode = this.canvasRenderer.drawCharacter('text-area', char, textXOffset, textYOffset, charWidth, lineHeight, this.displaySpec.font.baseline + vertLineInset, fontSpec, fgColor, bgcolor);
            this.debugWindow.webContents.executeJavaScript(jsCode);
            // Advance cursor
            this.cursorPosition.x++;
            // Handle line wrap
            if (this.cursorPosition.x >= this.displaySpec.size.columns) {
                this.cursorPosition.x = 0;
                this.cursorPosition.y++;
                // Handle scroll if at bottom
                if (this.cursorPosition.y >= this.displaySpec.size.rows) {
                    this.scrollUp();
                    this.cursorPosition.y = this.displaySpec.size.rows - 1;
                }
            }
        }
        catch (error) {
            console.error('Failed to write character:', error);
        }
    };
    /**
     * Get the canvas element ID for this window
     */
    DebugTermWindow.prototype.getCanvasId = function () {
        return 'terminal-canvas'; // Terminal window uses a different approach, but we need to provide an ID
    };
    /**
     * Clear from cursor to end of line
     */
    DebugTermWindow.prototype.clearLineFromCursor = function () {
        if (!this.debugWindow)
            return;
        var charWidth = this.displaySpec.font.charWidth;
        var lineHeight = this.displaySpec.font.lineHeight;
        var startX = this.cursorPosition.x * charWidth + this.contentInset;
        var y = this.cursorPosition.y * lineHeight + this.contentInset;
        var width = (this.displaySpec.size.columns - this.cursorPosition.x) * charWidth;
        var bgcolor = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
        var jsCode = this.canvasRenderer.clearCharacterCell('text-area', startX, y, width, lineHeight, bgcolor);
        this.debugWindow.webContents.executeJavaScript(jsCode);
    };
    /**
     * Scroll terminal content up by one line
     */
    DebugTermWindow.prototype.scrollUp = function () {
        if (!this.debugWindow)
            return;
        var lineHeight = this.displaySpec.font.lineHeight;
        var canvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
        var canvasHeight = this.displaySpec.size.rows * lineHeight;
        var bgcolor = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
        // Use canvas renderer to scroll
        this.debugWindow.webContents.executeJavaScript(this.canvasRenderer.scrollBitmap('text-area', 0, -lineHeight, canvasWidth + 2 * this.contentInset, canvasHeight + 2 * this.contentInset));
        // Clear the bottom line after scrolling
        var clearJsCode = this.canvasRenderer.clearCharacterCell('text-area', this.contentInset, (this.displaySpec.size.rows - 1) * lineHeight + this.contentInset, canvasWidth, lineHeight, bgcolor);
        this.debugWindow.webContents.executeJavaScript(clearJsCode);
    };
    /**
     * Transform mouse coordinates to terminal character positions
     * X: column number (0-based)
     * Y: row number (0-based)
     */
    DebugTermWindow.prototype.transformMouseCoordinates = function (x, y) {
        // Calculate margins
        var marginLeft = this.contentInset;
        var marginTop = this.contentInset;
        // Check if mouse is within the terminal area
        var terminalWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
        var terminalHeight = this.displaySpec.size.rows * this.displaySpec.font.lineHeight;
        if (x >= marginLeft && x < marginLeft + terminalWidth &&
            y >= marginTop && y < marginTop + terminalHeight) {
            // Transform to character coordinates
            var relX = x - marginLeft;
            var relY = y - marginTop;
            // Convert to column and row
            var column = Math.floor(relX / this.displaySpec.font.charWidth);
            var row = Math.floor(relY / this.displaySpec.font.lineHeight);
            return {
                x: Math.max(0, Math.min(column, this.displaySpec.size.columns - 1)),
                y: Math.max(0, Math.min(row, this.displaySpec.size.rows - 1))
            };
        }
        // Outside terminal area
        return { x: -1, y: -1 };
    };
    return DebugTermWindow;
}(debugWindowBase_1.DebugWindowBase));
exports.DebugTermWindow = DebugTermWindow;
