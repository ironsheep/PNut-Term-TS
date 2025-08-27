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
exports.DebugPlotWindow = exports.eCoordModes = void 0;
var electron_1 = require("electron");
var debugColor_1 = require("./shared/debugColor");
var canvasRenderer_1 = require("./shared/canvasRenderer");
var colorTranslator_1 = require("./shared/colorTranslator");
var lutManager_1 = require("./shared/lutManager");
var layerManager_1 = require("./shared/layerManager");
var spriteManager_1 = require("./shared/spriteManager");
var spin2NumericParser_1 = require("./shared/spin2NumericParser");
var windowPlacer_1 = require("../utils/windowPlacer");
var debugWindowBase_1 = require("./debugWindowBase");
var eCoordModes;
(function (eCoordModes) {
    eCoordModes[eCoordModes["CM_UNKNOWN"] = 0] = "CM_UNKNOWN";
    eCoordModes[eCoordModes["CM_POLAR"] = 1] = "CM_POLAR";
    eCoordModes[eCoordModes["CM_CARTESIAN"] = 2] = "CM_CARTESIAN";
})(eCoordModes || (exports.eCoordModes = eCoordModes = {}));
/**
 * Debug PLOT Window - Sprite-based Graphics Display
 *
 * Provides 2D graphics plotting with sprites, layers, and coordinate transformations.
 * Supports both Cartesian and Polar coordinate systems with programmable LUT colors and double buffering.
 *
 * ## Features
 * - **Sprite Management**: Dynamic sprite creation, transformation, and layer management
 * - **Coordinate Systems**: Cartesian (with configurable axis directions) and Polar modes
 * - **Layer Support**: Multiple drawing layers with opacity and blending modes
 * - **Double Buffering**: Smooth animation with automatic buffer swapping
 * - **LUT Colors**: Lookup table colors for efficient palette-based rendering
 * - **Drawing Primitives**: DOT, LINE, ARC, BOX, OVAL, and text rendering
 * - **Transformations**: Scale, rotate, and position sprites with real-time updates
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE width height` - Set window size (32-2048, default: 256x256)
 * - `DOTSIZE x y` - Set dot dimensions (1-32, default: 1x1)
 * - `CARTESIAN xdir ydir` - Set Cartesian axis directions (0=normal, 1=inverted)
 * - `POLAR twopi offset` - Set polar coordinate system parameters
 * - `COLOR bg {grid}` - Window and grid colors (default: BLACK)
 * - Packing modes: `LONGS`, `WORDS`, `BYTES` with optional `SIGNED`/`ALT` modifiers
 * - `HIDEXY` - Hide coordinate display
 *
 * ## Data Format
 * Drawing commands: `DOT x y`, `LINE x1 y1 x2 y2`, `BOX x y width height`
 * Sprite operations: `SPRITE name x y scale rotation`
 * Color commands: `LUT index color`, `LUTFILL start count color`
 * Coordinate data can be fed as individual values or packed data streams
 * - Example: `debug(\`MyPlot DOT 100 150 LINESIZE 2 RED 15\`)`
 *
 * ## Commands
 * - `CLEAR` - Clear display and reset all layers
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
 * - `DOT x y` - Draw dot at coordinates, `LINE x1 y1 x2 y2` - Draw line
 * - `BOX x y w h` - Draw rectangle, `OVAL x y w h` - Draw ellipse
 * - `ARC x y r start end` - Draw arc, `TEXT x y 'string'` - Draw text
 * - `LINESIZE size` - Set line width, `OPACITY level` - Set transparency
 * - `SPRITE name x y` - Position sprite, `LUT index color` - Set palette color
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `PLOT_Configure` procedure (line 1864)
 * - Update: `PLOT_Update` procedure (line 1918)
 * - Sprite management: `Plot_Sprite_Create`, `Plot_Sprite_Update` procedures
 * - Layer operations: `Plot_Layer_Manage` procedures
 * - Drawing primitives: `Plot_Draw_*` procedure families
 *
 * ## Examples
 * ```spin2
 * ' Basic plotting with sprites
 * debug(`PLOT MyPlot SIZE 320 240 CARTESIAN 0 1)
 * debug(`MyPlot LUT 1 RED 15)
 * debug(`MyPlot LUT 2 BLUE 15)
 *
 * ' Draw animated sprite
 * repeat angle from 0 to 359
 *   x := qsin(angle, 100, 30)
 *   y := qcos(angle, 100, 30)
 *   debug(`MyPlot CLEAR DOT \`(x+160, y+120))
 *   waitms(10)
 * ```
 *
 * ## Implementation Notes
 * - Follows Pascal PNut behavior for parameter handling (no range validation)
 * - Sprite system supports dynamic creation and transformation
 * - Layer management enables complex overlay graphics
 * - Double buffering prevents flicker during rapid updates
 * - Invalid parameters retain previous values rather than using defaults
 * - Negative dimensions in BOX/OVAL are drawn as-is for directional drawing
 *
 * ## Deviations from Pascal
 * - Enhanced sprite transformation matrix calculations
 * - Additional error logging for debugging purposes
 * - Improved memory management for large sprite collections
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_PLOT.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
var DebugPlotWindow = /** @class */ (function (_super) {
    __extends(DebugPlotWindow, _super);
    function DebugPlotWindow(ctx, displaySpec, windowId) {
        if (windowId === void 0) { windowId = "plot-".concat(Date.now()); }
        var _this = _super.call(this, ctx, windowId, 'plot') || this;
        _this.displaySpec = {};
        _this.isFirstDisplayData = true;
        _this.contentInset = 0; // 0 pixels from left and right of window
        // current terminal state
        _this.deferredCommands = [];
        _this.cursorPosition = { x: 0, y: 0 };
        _this.selectedLutColor = 0;
        _this.font = {};
        _this.textStyle = {};
        _this.origin = { x: 0, y: 0 }; // users are: DOT, LINE, CIRCLE, OVAL, BOX, OBOX
        _this.canvasOffset = { x: 0, y: 0 };
        _this.polarConfig = { twopi: 0x100000000, offset: 0 };
        _this.cartesianConfig = { ydir: false, xdir: false };
        _this.coordinateMode = eCoordModes.CM_CARTESIAN; // default to cartesian mode
        _this.lineSize = 1;
        _this.precise = 8; //  Toggle precise mode, where line size and (x,y) for DOT and LINE are expressed in 256ths of a pixel. [0, 8] used as shift value
        _this.currFgColor = '#00FFFF'; // #RRGGBB string
        _this.currTextColor = '#00FFFF'; // #RRGGBB string
        _this.shouldWriteToCanvas = true;
        // State for new features
        _this.opacity = 255; // 0-255
        _this.textAngle = 0; // degrees
        _this.colorMode = colorTranslator_1.ColorMode.RGB24;
        _this.clearCount = 2;
        _this.windowLogPrefix = 'pltW';
        debugColor_1.DebugColor.setDefaultBrightness(15); // set default brightness to max
        // record our Debug Plot Window Spec
        _this.displaySpec = displaySpec;
        // calculate canvasOffet for origin
        _this.canvasOffset = { x: displaySpec.size.width / 2, y: displaySpec.size.height / 2 };
        // start with default font size
        DebugPlotWindow.calcMetricsForFontPtSize(10, _this.font);
        var normalText = 1;
        DebugPlotWindow.calcStyleFromBitfield(normalText, _this.textStyle);
        // Initialize shared classes
        _this.canvasRenderer = new canvasRenderer_1.CanvasRenderer();
        _this.lutManager = new lutManager_1.LUTManager();
        _this.colorTranslator = new colorTranslator_1.ColorTranslator();
        _this.colorTranslator.setLutPalette(_this.lutManager.getPalette());
        _this.layerManager = new layerManager_1.LayerManager();
        _this.spriteManager = new spriteManager_1.SpriteManager();
        return _this;
    }
    /**
     * Log a warning about an invalid parameter with defensive default
     * TECH-DEBT: Enhanced error logging with full command context
     */
    DebugPlotWindow.prototype.logParsingWarning = function (unparsedCommand, paramName, invalidValue, defaultValue) {
        var valueDisplay = invalidValue === null ? 'missing' : "'".concat(invalidValue, "'");
        this.logMessage("WARNING: Debug command parsing error:\n".concat(unparsedCommand, "\nInvalid ").concat(valueDisplay, " value for parameter ").concat(paramName, ", using default: ").concat(defaultValue));
    };
    DebugPlotWindow.nextPartIsNumeric = function (lineParts, index) {
        var numericStatus = false;
        // Check bounds first
        if (index + 1 < lineParts.length) {
            var firstChar = lineParts[index + 1].charAt(0);
            // 0-9 or negative sign prefix
            if ((firstChar >= '0' && firstChar <= '9') || firstChar == '-') {
                numericStatus = true;
            }
        }
        return numericStatus;
    };
    Object.defineProperty(DebugPlotWindow.prototype, "windowTitle", {
        get: function () {
            var desiredValue = "".concat(this.displaySpec.displayName, " PLOT");
            if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
                desiredValue = this.displaySpec.windowTitle;
            }
            return desiredValue;
        },
        enumerable: false,
        configurable: true
    });
    DebugPlotWindow.parsePlotDeclaration = function (lineParts) {
        // here with lineParts = ['`PLOT', {displayName}, ...]
        // Valid directives are:
        //   TITLE <title>
        //   POS <left> <top> [default: 0,0]
        //   SIZE <width> <height> [ea. 32-2048, default: 256,256]
        //   DOTSIZE <width-or-both> [<height>] [default: 1,1]
        //   lut1_to_rgb24
        //   LUTCOLORS rgb24 rgb24 ... [default: colors 0..7]
        //   BACKCOLOR <bgnd-color> [default: BLACK]
        //   UPDATE
        //   HIDEXY
        console.log("CL: at parsePlotDeclaration()");
        var displaySpec = {};
        displaySpec.lutColors = []; // ensure this is structured too! (CRASHED without this!)
        displaySpec.window = {}; // ensure this is structured too! (CRASHED without this!)
        var isValid = false;
        // set defaults
        var bkgndColor = new debugColor_1.DebugColor('BLACK');
        var gridColor = new debugColor_1.DebugColor('GRAY', 4);
        var textColor = new debugColor_1.DebugColor('CYAN');
        console.log("CL: at parsePlotDeclaration() with colors...");
        displaySpec.position = { x: 0, y: 0 };
        displaySpec.size = { width: 256, height: 256 };
        displaySpec.dotSize = { width: 1, height: 1 };
        displaySpec.window.background = bkgndColor.rgbString;
        displaySpec.window.grid = gridColor.rgbString;
        displaySpec.delayedUpdate = false;
        displaySpec.hideXY = false;
        // by default we have combo #0 defined
        //displaySpec.lutColors.push({ fgcolor: displaySpec.textColor, bgcolor: displaySpec.window.background });
        // now parse overrides to defaults
        console.log("CL: at overrides PlotDisplaySpec: ".concat(lineParts));
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
                            console.log("CL: PlotDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'POS':
                        // ensure we have two more values
                        if (index < lineParts.length - 2) {
                            displaySpec.position.x = Number(lineParts[++index]);
                            displaySpec.position.y = Number(lineParts[++index]);
                        }
                        else {
                            console.log("CL: PlotDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'SIZE':
                        // ensure we have two more values
                        if (index < lineParts.length - 2) {
                            displaySpec.size.width = Number(lineParts[++index]);
                            displaySpec.size.height = Number(lineParts[++index]);
                        }
                        else {
                            console.log("CL: PlotDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'BACKCOLOR':
                        // ensure we have one more value
                        if (index < lineParts.length - 1) {
                            var colorName = lineParts[++index];
                            var colorBrightness = 15; // let's default to max brightness
                            if (index < lineParts.length - 1) {
                                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                    colorBrightness = Number(lineParts[++index]);
                                }
                            }
                            var textColor_1 = new debugColor_1.DebugColor(colorName, colorBrightness);
                            displaySpec.window.background = textColor_1.rgbString;
                        }
                        else {
                            console.log("CL: PlotDisplaySpec: Missing parameter for ".concat(element));
                            isValid = false;
                        }
                        break;
                    case 'UPDATE':
                        displaySpec.delayedUpdate = true;
                        break;
                    case 'HIDEXY':
                        displaySpec.delayedUpdate = true;
                        break;
                    default:
                        console.log("CL: PlotDisplaySpec: Unknown directive: ".concat(element));
                        break;
                }
                if (!isValid) {
                    break;
                }
            }
        }
        console.log("CL: at end of parsePlotDeclaration(): isValid=(".concat(isValid, "), ").concat(JSON.stringify(displaySpec, null, 2)));
        return [isValid, displaySpec];
    };
    DebugPlotWindow.prototype.createDebugWindow = function () {
        var _this = this;
        this.logMessage("at createDebugWindow() PLOT");
        // calculate overall canvas sizes then window size from them!
        // NOTES: Chip's size estimation:
        //  window width should be (#samples * 2) + (2 * 2); // 2 is for the 2 borders
        //  window height should be (max-min+1) + (2 * chanInset); // chanInset is for space above channel and below channel
        // set height so no scroller by default
        var canvasHeight = this.displaySpec.size.height;
        // for mono-spaced font width 1/2 ht in pts
        var canvasWidth = this.displaySpec.size.width; // contentInset' for the Xoffset into window for canvas
        var divHeight = canvasHeight + 4; // +20 for title bar (30 leaves black at bottom), 20 leaves black at bottom
        var divWidth = canvasWidth + 4; // contentInset' for the Xoffset into window for canvas, 20 is extra pad
        var windowHeight = canvasHeight + 4 + 4; // +4 add enough to not create vert. scroller
        var windowWidth = canvasWidth + this.contentInset * 2 + 4 + 4; // contentInset' for the Xoffset into window for canvas, +4 add enough to not create horiz. scroller
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
            var position = windowPlacer.getNextPosition("plot-".concat(this.displaySpec.displayName), placementConfig);
            windowX = position.x;
            windowY = position.y;
            this.logMessage("  -- PLOT using auto-placement: ".concat(windowX, ",").concat(windowY));
        }
        this.logMessage("  -- PLOT window size: ".concat(windowWidth, "x").concat(windowHeight, " @").concat(windowX, ",").concat(windowY));
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
            windowPlacer.registerWindow("plot-".concat(this.displaySpec.displayName), this.debugWindow);
        }
        // hook window events before being shown
        this.debugWindow.on('ready-to-show', function () {
            var _a;
            _this.logMessage('* Plot window will show...');
            (_a = _this.debugWindow) === null || _a === void 0 ? void 0 : _a.show();
        });
        this.debugWindow.on('show', function () {
            _this.logMessage('* Plot window shown');
        });
        this.debugWindow.on('page-title-updated', function () {
            _this.logMessage('* Plot window title updated');
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
        var htmlContent = "\n    <html>\n      <head>\n        <meta charset=\"UTF-8\"></meta>\n        <title>".concat(displayName, "</title>\n        <style>\n          @font-face {\n            font-family: 'Parallax';\n            src: url('").concat(this.getParallaxFontUrl(), "') format('truetype');\n          }\n          body {\n            display: flex;\n            flex-direction: column;\n            margin: 0;\n            padding: 0;\n            font-family: 'Parallax', sans-serif; // was Consolas\n            //background-color: ").concat(this.displaySpec.window.background, ";\n            background-color: rgb(140, 52, 130);\n          }\n          #plot-data {\n            display: flex;\n            flex-direction: column;\n            justify-content: flex-end;\n            flex-grow: 0;\n            flex-shrink: 0;\n            padding: 2px;\n            /* background-color: rgb(55, 63, 170); // ").concat(this.displaySpec.window.background, "; */\n            background-color: ").concat(this.displaySpec.window.background, ";\n            width: ").concat(divWidth, "px; /* Set a fixed width */\n            height: ").concat(divHeight, "px; /* Set a fixed height */\n          }\n          canvas {\n            // background-color:rgb(9, 201, 28);\n            background-color: ").concat(this.displaySpec.window.background, ";\n            margin: 0;\n          }\n        </style>\n      </head>\n      <body>\n        <div id=\"plot-data\">\n          <canvas id=\"plot-area\" width=\"").concat(canvasWidth, "\" height=\"").concat(canvasHeight, "\"></canvas>\n        </div>\n      </body>\n    </html>\n  ");
        this.logMessage("at createDebugWindow() PLOT with htmlContent: ".concat(htmlContent));
        try {
            this.debugWindow.setMenu(null);
            this.debugWindow.loadURL("data:text/html,".concat(encodeURIComponent(htmlContent)));
        }
        catch (error) {
            this.logMessage("Failed to load URL: ".concat(error));
        }
        // Menu.setApplicationMenu(null); // DOESNT WORK!
        // now hook load complete event so we can label and paint the grid/min/max, etc.
        this.debugWindow.webContents.on('did-finish-load', function () {
            _this.logMessage('at did-finish-load');
            _this.setupDoubleBuffering();
        });
    };
    DebugPlotWindow.prototype.setupDoubleBuffering = function () {
        if (!this.debugWindow)
            return;
        // Create working canvas for double buffering
        this.workingCanvas = new OffscreenCanvas(this.displaySpec.size.width, this.displaySpec.size.height);
        this.workingCtx = this.workingCanvas.getContext('2d') || undefined;
        if (this.workingCtx) {
            // Initialize working canvas
            this.canvasRenderer.setupCanvas(this.workingCtx);
            // Clear to background color
            var bgColor = this.displaySpec.window.background;
            this.canvasRenderer.clearCanvas(this.workingCtx);
            this.canvasRenderer.fillRect(this.workingCtx, 0, 0, this.displaySpec.size.width, this.displaySpec.size.height, bgColor);
        }
    };
    DebugPlotWindow.prototype.performUpdate = function () {
        var _this = this;
        if (!this.workingCanvas || !this.debugWindow)
            return;
        this.logMessage('at performUpdate() - copying working canvas to display');
        // Convert OffscreenCanvas to blob and then to data URL
        this.workingCanvas.convertToBlob().then(function (blob) {
            var reader = new FileReader();
            reader.onload = function () {
                var _a;
                var dataUrl = reader.result;
                // Update the display canvas with the working canvas content
                (_a = _this.debugWindow) === null || _a === void 0 ? void 0 : _a.webContents.executeJavaScript("\n          (function() {\n            const canvas = document.getElementById('plot-area');\n            if (canvas && canvas instanceof HTMLCanvasElement) {\n              const ctx = canvas.getContext('2d');\n              if (ctx) {\n                const img = new Image();\n                img.onload = function() {\n                  ctx.clearRect(0, 0, canvas.width, canvas.height);\n                  ctx.drawImage(img, 0, 0);\n                };\n                img.src = '".concat(dataUrl, "';\n              }\n            }\n          })();\n        "));
            };
            reader.readAsDataURL(blob);
        });
    };
    DebugPlotWindow.prototype.closeDebugWindow = function () {
        this.logMessage("at closeDebugWindow() PLOT");
        // Stop input forwarding
        this.inputForwarder.stopPolling();
        // let our base class do the work
        this.debugWindow = null;
    };
    DebugPlotWindow.prototype.processMessageImmediate = function (lineParts) {
        // Handle async internally
        this.processMessageAsync(lineParts);
    };
    DebugPlotWindow.prototype.processMessageAsync = function (lineParts) {
        return __awaiter(this, void 0, void 0, function () {
            var unparsedCommand, _loop_1, this_1, out_index_1, index;
            var _this = this;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            return __generator(this, function (_u) {
                switch (_u.label) {
                    case 0:
                        unparsedCommand = lineParts.join(' ');
                        this.logMessage("---- at updateContent(".concat(lineParts.join(' '), ")"));
                        _loop_1 = function (index) {
                            var xStr, yStr, xParsed, yParsed, x, y, size, style, angle, sizeStr, sizeParsed, angleStr, angleParsed, currLinePart, displayString, stringParts, nextLinePart, xStr, yStr, xParsed, yParsed, x, y, lineSize, opacity, lineSizeStr, lineSizeParsed, opacityStr, opacityParsed, lineSize, opacity, diameterStr, diameterParsed, diameter, xStr, yStr, xParsed, yParsed, twopiStr, offsetStr, twopiParsed, offsetParsed, yDirStr, xDirStr, yDirParsed, xDirParsed, yDir, xDir, dotSize, dotOpacity, sizeParsed, opacityParsed, parsedWidth, parsedHeight, boxLineSize, boxOpacity, lineSizeParsed, opacityParsed, width, height, boxLineSize, boxOpacity, width, height, ovalLineSize, ovalOpacity, layerIndexStr, layerIndexParsed, layerIndexValue, layerIndex_1, filename_1, ext, supportedFormats, layerIndexStr, layerIndexParsed, layerIndexValue, layerIndex, destX, destY, destXStr, destXParsed, destYStr, destYParsed, leftStr, topStr, widthStr, heightStr, leftParsed, topParsed, widthParsed, heightParsed, cropRect, destX, destY, destXStr, destXParsed, destYStr, destYParsed, saveFileName, sizeStr, sizeParsed, opacityStr, opacityParsed, angleStr, angleParsed, colorIndex, colorStr, colorValue, spriteId, width, height, pixelCount, pixels, colors, i, pixelValue, i, colorValue, colorStr, spriteIdParam, spriteId, orientation_1, scale, opacity, scaleValue, colorModeStr, colorModeMap, tune, colorValue, colorName, colorBrightness, namedColor, isTextColor;
                            return __generator(this, function (_v) {
                                switch (_v.label) {
                                    case 0:
                                        if (!(lineParts[index].toUpperCase() == 'SET')) return [3 /*break*/, 1];
                                        // set cursor position
                                        if (index < lineParts.length - 2) {
                                            xStr = lineParts[++index];
                                            yStr = lineParts[++index];
                                            xParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(xStr);
                                            yParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(yStr);
                                            x = xParsed !== null && xParsed !== void 0 ? xParsed : 0;
                                            y = yParsed !== null && yParsed !== void 0 ? yParsed : 0;
                                            if (xParsed === null) {
                                                this_1.logParsingWarning(unparsedCommand, 'SET x', xStr, 0);
                                            }
                                            if (yParsed === null) {
                                                this_1.logParsingWarning(unparsedCommand, 'SET y', yStr, 0);
                                            }
                                            this_1.updatePlotDisplay("SET ".concat(x, " ").concat(y));
                                        }
                                        else {
                                            this_1.logMessage("ERROR: Debug command parsing error:\n".concat(unparsedCommand, "\nMissing parameters for SET command"));
                                        }
                                        return [3 /*break*/, 22];
                                    case 1:
                                        if (!(lineParts[index].toUpperCase() == 'TEXT')) return [3 /*break*/, 2];
                                        size = 10;
                                        style = '00000001';
                                        angle = 0;
                                        if (index < lineParts.length - 1) {
                                            sizeStr = lineParts[++index];
                                            sizeParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(sizeStr);
                                            size = sizeParsed !== null && sizeParsed !== void 0 ? sizeParsed : 10;
                                            if (sizeParsed === null) {
                                                this_1.logParsingWarning(unparsedCommand, 'TEXT size', sizeStr, 10);
                                            }
                                            if (index < lineParts.length - 1) {
                                                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                    style = this_1.formatAs8BitBinary(lineParts[++index]);
                                                    if (index < lineParts.length - 1) {
                                                        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                            angleStr = lineParts[++index];
                                                            angleParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(angleStr);
                                                            angle = angleParsed !== null && angleParsed !== void 0 ? angleParsed : 0;
                                                            if (angleParsed === null) {
                                                                this_1.logParsingWarning(unparsedCommand, 'TEXT angle', angleStr, 0);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        this_1.updatePlotDisplay("FONT ".concat(size, " ").concat(style, " ").concat(angle));
                                        currLinePart = lineParts[++index];
                                        if (currLinePart.charAt(0) == "'") {
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
                                                this_1.updatePlotDisplay("TEXT '".concat(displayString, "'"));
                                            }
                                            else {
                                                this_1.logMessage("ERROR: Debug command parsing error:\n".concat(unparsedCommand, "\nMissing closing quote for TEXT command"));
                                            }
                                        }
                                        return [3 /*break*/, 22];
                                    case 2:
                                        if (!(lineParts[index].toUpperCase() == 'LINE')) return [3 /*break*/, 3];
                                        // draw a line: LINE <x> <y> {linesize {opacity}}
                                        if (index < lineParts.length - 2) {
                                            xStr = lineParts[++index];
                                            yStr = lineParts[++index];
                                            xParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(xStr);
                                            yParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(yStr);
                                            x = xParsed !== null && xParsed !== void 0 ? xParsed : 0;
                                            y = yParsed !== null && yParsed !== void 0 ? yParsed : 0;
                                            if (xParsed === null) {
                                                this_1.logParsingWarning(unparsedCommand, 'LINE x', xStr, 0);
                                            }
                                            if (yParsed === null) {
                                                this_1.logParsingWarning(unparsedCommand, 'LINE y', yStr, 0);
                                            }
                                            lineSize = 1;
                                            opacity = 255;
                                            if (index < lineParts.length - 1) {
                                                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                    lineSizeStr = lineParts[++index];
                                                    lineSizeParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineSizeStr);
                                                    lineSize = lineSizeParsed !== null && lineSizeParsed !== void 0 ? lineSizeParsed : 1;
                                                    if (lineSizeParsed === null) {
                                                        this_1.logParsingWarning(unparsedCommand, 'LINE linesize', lineSizeStr, 1);
                                                    }
                                                    if (index < lineParts.length - 1) {
                                                        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                            opacityStr = lineParts[++index];
                                                            opacityParsed = spin2NumericParser_1.Spin2NumericParser.parseCount(opacityStr);
                                                            opacity = opacityParsed !== null && opacityParsed !== void 0 ? opacityParsed : 255;
                                                            if (opacityParsed === null) {
                                                                this_1.logParsingWarning(unparsedCommand, 'LINE opacity', opacityStr, 255);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            this_1.updatePlotDisplay("LINE ".concat(x, " ").concat(y, " ").concat(lineSize, " ").concat(opacity));
                                        }
                                        else {
                                            this_1.logMessage("ERROR: Debug command parsing error:\n".concat(unparsedCommand, "\nMissing parameters for LINE command"));
                                        }
                                        return [3 /*break*/, 22];
                                    case 3:
                                        if (!(lineParts[index].toUpperCase() == 'CIRCLE')) return [3 /*break*/, 4];
                                        // draw a circle: CIRCLE <diameter> {linesize {opacity}}
                                        if (index < lineParts.length - 1) {
                                            lineSize = 0;
                                            opacity = 255;
                                            diameterStr = lineParts[++index];
                                            diameterParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(diameterStr);
                                            diameter = diameterParsed !== null && diameterParsed !== void 0 ? diameterParsed : 0;
                                            if (diameterParsed === null) {
                                                this_1.logParsingWarning(unparsedCommand, 'CIRCLE diameter', diameterStr, 0);
                                            }
                                            if (index < lineParts.length - 1) {
                                                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                    lineSize = (_a = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineParts[++index])) !== null && _a !== void 0 ? _a : 1;
                                                    if (index < lineParts.length - 1) {
                                                        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                            opacity = (_b = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _b !== void 0 ? _b : 255;
                                                        }
                                                    }
                                                }
                                            }
                                            this_1.updatePlotDisplay("CIRCLE ".concat(diameter, " ").concat(lineSize, " ").concat(opacity));
                                        }
                                        else {
                                            this_1.logMessage("ERROR: Debug command parsing error:\n".concat(unparsedCommand, "\nMissing parameters for CIRCLE command"));
                                        }
                                        return [3 /*break*/, 22];
                                    case 4:
                                        if (!(lineParts[index].toUpperCase() == 'ORIGIN')) return [3 /*break*/, 5];
                                        // set origin position
                                        //   iff values are present, set origin to those values
                                        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                            // have values
                                            if (index < lineParts.length - 2) {
                                                xStr = lineParts[++index];
                                                yStr = lineParts[++index];
                                                xParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(xStr);
                                                yParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(yStr);
                                                this_1.origin.x = xParsed !== null && xParsed !== void 0 ? xParsed : 0;
                                                this_1.origin.y = yParsed !== null && yParsed !== void 0 ? yParsed : 0;
                                                if (xParsed === null) {
                                                    this_1.logParsingWarning(unparsedCommand, 'ORIGIN x', xStr, 0);
                                                }
                                                if (yParsed === null) {
                                                    this_1.logParsingWarning(unparsedCommand, 'ORIGIN y', yStr, 0);
                                                }
                                                // calculate canvasOffet for origin
                                                this_1.canvasOffset = {
                                                    //x: this.displaySpec.size.width - this.origin.x,
                                                    //y: this.displaySpec.size.height - this.origin.y
                                                    x: this_1.origin.x,
                                                    y: this_1.origin.y
                                                };
                                            }
                                            else {
                                                this_1.logMessage("ERROR: Debug command parsing error:\n".concat(unparsedCommand, "\nMissing parameters for ORIGIN command"));
                                            }
                                        }
                                        else {
                                            // no ORIGIN params, so set to cursor position
                                            this_1.origin = { x: this_1.cursorPosition.x, y: this_1.cursorPosition.y };
                                            this_1.canvasOffset = { x: this_1.origin.x, y: this_1.origin.y };
                                        }
                                        return [3 /*break*/, 22];
                                    case 5:
                                        if (!(lineParts[index].toUpperCase() == 'PRECISE')) return [3 /*break*/, 6];
                                        // toggle precise mode
                                        this_1.precise = this_1.precise ^ 8;
                                        return [3 /*break*/, 22];
                                    case 6:
                                        if (!(lineParts[index].toUpperCase() == 'POLAR')) return [3 /*break*/, 7];
                                        // set polar mode
                                        this_1.coordinateMode = eCoordModes.CM_POLAR;
                                        this_1.polarConfig.twopi = 0x100000000; // default 1
                                        this_1.polarConfig.offset = 0; // default 0
                                        //   iff values are present, set mode to those values
                                        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                            if (index < lineParts.length - 2) {
                                                twopiStr = lineParts[++index];
                                                offsetStr = lineParts[++index];
                                                twopiParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(twopiStr);
                                                offsetParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(offsetStr);
                                                this_1.polarConfig.twopi = twopiParsed !== null && twopiParsed !== void 0 ? twopiParsed : 0x100000000;
                                                this_1.polarConfig.offset = offsetParsed !== null && offsetParsed !== void 0 ? offsetParsed : 0;
                                                if (twopiParsed === null) {
                                                    this_1.logParsingWarning(unparsedCommand, 'POLAR twopi', twopiStr, '0x100000000');
                                                }
                                                if (offsetParsed === null) {
                                                    this_1.logParsingWarning(unparsedCommand, 'POLAR offset', offsetStr, 0);
                                                }
                                            }
                                        }
                                        return [3 /*break*/, 22];
                                    case 7:
                                        if (!(lineParts[index].toUpperCase() == 'CARTESIAN')) return [3 /*break*/, 8];
                                        // Set cartesian mode and optionally set Y and X axis polarity.
                                        //   Cartesian mode is the default.
                                        this_1.coordinateMode = eCoordModes.CM_CARTESIAN;
                                        this_1.cartesianConfig.xdir = false; // default 0
                                        this_1.cartesianConfig.ydir = false; // default 0
                                        //   iff values are present, set mode to those values
                                        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                            if (index < lineParts.length - 2) {
                                                yDirStr = lineParts[++index];
                                                xDirStr = lineParts[++index];
                                                yDirParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(yDirStr);
                                                xDirParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(xDirStr);
                                                yDir = yDirParsed !== null && yDirParsed !== void 0 ? yDirParsed : 0;
                                                xDir = xDirParsed !== null && xDirParsed !== void 0 ? xDirParsed : 0;
                                                if (yDirParsed === null) {
                                                    this_1.logParsingWarning(unparsedCommand, 'CARTESIAN ydir', yDirStr, 0);
                                                }
                                                if (xDirParsed === null) {
                                                    this_1.logParsingWarning(unparsedCommand, 'CARTESIAN xdir', xDirStr, 0);
                                                }
                                                this_1.cartesianConfig.xdir = xDir == 0 ? false : true;
                                                this_1.cartesianConfig.ydir = yDir == 0 ? false : true;
                                            }
                                        }
                                        return [3 /*break*/, 22];
                                    case 8:
                                        if (!(lineParts[index].toUpperCase() == 'DOT')) return [3 /*break*/, 9];
                                        dotSize = this_1.lineSize;
                                        dotOpacity = this_1.opacity;
                                        // Parse optional parameters - match Pascal behavior
                                        if (index + 1 < lineParts.length) {
                                            sizeParsed = spin2NumericParser_1.Spin2NumericParser.parseInteger(lineParts[++index], true);
                                            if (sizeParsed !== null) {
                                                dotSize = sizeParsed; // Pascal doesn't convert negatives or clamp
                                            }
                                            if (index + 1 < lineParts.length) {
                                                opacityParsed = spin2NumericParser_1.Spin2NumericParser.parseInteger(lineParts[++index], true);
                                                if (opacityParsed !== null) {
                                                    dotOpacity = opacityParsed; // Pascal doesn't clamp opacity
                                                }
                                            }
                                        }
                                        this_1.drawDotToPlot(dotSize, dotOpacity);
                                        return [3 /*break*/, 22];
                                    case 9:
                                        if (!(lineParts[index].toUpperCase() == 'BOX')) return [3 /*break*/, 10];
                                        // BOX command - draw filled rectangle (requires width and height)
                                        if (index + 2 < lineParts.length) {
                                            parsedWidth = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineParts[++index]);
                                            parsedHeight = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineParts[++index]);
                                            if (parsedWidth !== null && parsedHeight !== null) {
                                                boxLineSize = 0;
                                                boxOpacity = this_1.opacity;
                                                // Parse optional parameters
                                                if (index + 1 < lineParts.length) {
                                                    lineSizeParsed = spin2NumericParser_1.Spin2NumericParser.parseInteger(lineParts[++index], true);
                                                    if (lineSizeParsed !== null) {
                                                        boxLineSize = lineSizeParsed; // Pascal doesn't convert negatives
                                                        if (index + 1 < lineParts.length) {
                                                            opacityParsed = spin2NumericParser_1.Spin2NumericParser.parseInteger(lineParts[++index], true);
                                                            if (opacityParsed !== null) {
                                                                boxOpacity = opacityParsed; // Pascal doesn't clamp
                                                            }
                                                        }
                                                    }
                                                }
                                                this_1.drawBoxToPlot(parsedWidth, parsedHeight, boxLineSize, boxOpacity);
                                            }
                                        }
                                        return [3 /*break*/, 22];
                                    case 10:
                                        if (!(lineParts[index].toUpperCase() == 'OBOX')) return [3 /*break*/, 11];
                                        // OBOX command - draw outlined rectangle
                                        if (index + 2 < lineParts.length) {
                                            width = (_c = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineParts[++index])) !== null && _c !== void 0 ? _c : 0;
                                            height = (_d = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineParts[++index])) !== null && _d !== void 0 ? _d : 0;
                                            boxLineSize = this_1.lineSize;
                                            boxOpacity = this_1.opacity;
                                            // Parse optional parameters
                                            if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                boxLineSize = (_e = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _e !== void 0 ? _e : 0;
                                                if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                    boxOpacity = (_f = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _f !== void 0 ? _f : 255;
                                                }
                                            }
                                            this_1.drawBoxToPlot(width, height, boxLineSize, boxOpacity);
                                        }
                                        return [3 /*break*/, 22];
                                    case 11:
                                        if (!(lineParts[index].toUpperCase() == 'OVAL')) return [3 /*break*/, 12];
                                        // OVAL command - draw ellipse
                                        if (index + 2 < lineParts.length) {
                                            width = (_g = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineParts[++index])) !== null && _g !== void 0 ? _g : 0;
                                            height = (_h = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineParts[++index])) !== null && _h !== void 0 ? _h : 0;
                                            ovalLineSize = 0;
                                            ovalOpacity = this_1.opacity;
                                            // Parse optional parameters
                                            if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                ovalLineSize = (_j = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _j !== void 0 ? _j : 0;
                                                if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                    ovalOpacity = (_k = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _k !== void 0 ? _k : 255;
                                                }
                                            }
                                            this_1.drawOvalToPlot(width, height, ovalLineSize, ovalOpacity);
                                        }
                                        return [3 /*break*/, 22];
                                    case 12:
                                        if (!(lineParts[index].toUpperCase() == 'UPDATE')) return [3 /*break*/, 13];
                                        // UPDATE command - process deferred commands then copy working canvas to display
                                        this_1.pushDisplayListToPlot();
                                        this_1.performUpdate();
                                        return [3 /*break*/, 22];
                                    case 13:
                                        if (!(lineParts[index].toUpperCase() == 'LAYER')) return [3 /*break*/, 14];
                                        // LAYER command - load bitmap into layer
                                        if (index + 2 < lineParts.length) {
                                            layerIndexStr = lineParts[++index];
                                            layerIndexParsed = spin2NumericParser_1.Spin2NumericParser.parseCount(layerIndexStr);
                                            layerIndexValue = layerIndexParsed !== null && layerIndexParsed !== void 0 ? layerIndexParsed : 1;
                                            if (layerIndexParsed === null) {
                                                this_1.logParsingWarning(unparsedCommand, 'LAYER index', layerIndexStr, 1);
                                            }
                                            layerIndex_1 = layerIndexValue - 1;
                                            filename_1 = lineParts[++index];
                                            if (layerIndex_1 >= 0 && layerIndex_1 < 8) {
                                                ext = filename_1.substring(filename_1.lastIndexOf('.')).toLowerCase();
                                                supportedFormats = ['.bmp', '.png', '.jpg', '.jpeg', '.gif'];
                                                if (supportedFormats.includes(ext)) {
                                                    this_1.layerManager.loadLayer(layerIndex_1, filename_1)
                                                        .then(function () {
                                                        _this.logMessage("  -- Loaded layer ".concat(layerIndex_1 + 1, " from ").concat(filename_1));
                                                    })
                                                        .catch(function (error) {
                                                        _this.logMessage("  -- Error loading layer: ".concat(error.message));
                                                    });
                                                }
                                                else {
                                                    this_1.logMessage("  -- Unsupported file format: ".concat(ext));
                                                }
                                            }
                                            else {
                                                this_1.logMessage("  -- Invalid layer index: ".concat(layerIndex_1 + 1, " (must be 1-8)"));
                                            }
                                        }
                                        else {
                                            this_1.logMessage("  -- LAYER command requires layer index and filename");
                                        }
                                        return [3 /*break*/, 22];
                                    case 14:
                                        if (!(lineParts[index].toUpperCase() == 'CROP')) return [3 /*break*/, 15];
                                        // CROP command - draw layer with optional cropping
                                        if (index + 1 < lineParts.length) {
                                            layerIndexStr = lineParts[++index];
                                            layerIndexParsed = spin2NumericParser_1.Spin2NumericParser.parseCount(layerIndexStr);
                                            layerIndexValue = layerIndexParsed !== null && layerIndexParsed !== void 0 ? layerIndexParsed : 1;
                                            if (layerIndexParsed === null) {
                                                this_1.logParsingWarning(unparsedCommand, 'LAYER index', layerIndexStr, 1);
                                            }
                                            layerIndex = layerIndexValue - 1;
                                            if (layerIndex >= 0 && layerIndex < 8 && this_1.layerManager.isLayerLoaded(layerIndex)) {
                                                if (index + 1 < lineParts.length && lineParts[index + 1].toUpperCase() === 'AUTO') {
                                                    // AUTO mode - draw full layer at specified position
                                                    index++; // Skip 'AUTO'
                                                    destX = 0;
                                                    destY = 0;
                                                    if (index + 1 < lineParts.length) {
                                                        destXStr = lineParts[++index];
                                                        destXParsed = spin2NumericParser_1.Spin2NumericParser.parsePixel(destXStr);
                                                        destX = destXParsed !== null && destXParsed !== void 0 ? destXParsed : 0;
                                                        if (destXParsed === null) {
                                                            this_1.logParsingWarning(unparsedCommand, 'CROP AUTO destX', destXStr, 0);
                                                        }
                                                    }
                                                    if (index + 1 < lineParts.length) {
                                                        destYStr = lineParts[++index];
                                                        destYParsed = spin2NumericParser_1.Spin2NumericParser.parsePixel(destYStr);
                                                        destY = destYParsed !== null && destYParsed !== void 0 ? destYParsed : 0;
                                                        if (destYParsed === null) {
                                                            this_1.logParsingWarning(unparsedCommand, 'CROP AUTO destY', destYStr, 0);
                                                        }
                                                    }
                                                    if (this_1.workingCtx) {
                                                        try {
                                                            this_1.layerManager.drawLayerToCanvas(this_1.workingCtx, layerIndex, null, destX, destY);
                                                            this_1.logMessage("  -- Drew layer ".concat(layerIndex + 1, " in AUTO mode at (").concat(destX, ", ").concat(destY, ")"));
                                                        }
                                                        catch (error) {
                                                            this_1.logMessage("  -- Error drawing layer: ".concat(error.message));
                                                        }
                                                    }
                                                }
                                                else if (index + 4 < lineParts.length) {
                                                    leftStr = lineParts[++index];
                                                    topStr = lineParts[++index];
                                                    widthStr = lineParts[++index];
                                                    heightStr = lineParts[++index];
                                                    leftParsed = spin2NumericParser_1.Spin2NumericParser.parsePixel(leftStr);
                                                    topParsed = spin2NumericParser_1.Spin2NumericParser.parsePixel(topStr);
                                                    widthParsed = spin2NumericParser_1.Spin2NumericParser.parsePixel(widthStr);
                                                    heightParsed = spin2NumericParser_1.Spin2NumericParser.parsePixel(heightStr);
                                                    cropRect = {
                                                        left: leftParsed !== null && leftParsed !== void 0 ? leftParsed : 0,
                                                        top: topParsed !== null && topParsed !== void 0 ? topParsed : 0,
                                                        width: widthParsed !== null && widthParsed !== void 0 ? widthParsed : 0,
                                                        height: heightParsed !== null && heightParsed !== void 0 ? heightParsed : 0
                                                    };
                                                    if (leftParsed === null) {
                                                        this_1.logParsingWarning(unparsedCommand, 'CROP left', leftStr, 0);
                                                    }
                                                    if (topParsed === null) {
                                                        this_1.logParsingWarning(unparsedCommand, 'CROP top', topStr, 0);
                                                    }
                                                    if (widthParsed === null) {
                                                        this_1.logParsingWarning(unparsedCommand, 'CROP width', widthStr, 0);
                                                    }
                                                    if (heightParsed === null) {
                                                        this_1.logParsingWarning(unparsedCommand, 'CROP height', heightStr, 0);
                                                    }
                                                    destX = 0;
                                                    destY = 0;
                                                    // Optional destination coordinates
                                                    if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                        destXStr = lineParts[++index];
                                                        destXParsed = spin2NumericParser_1.Spin2NumericParser.parsePixel(destXStr);
                                                        destX = destXParsed !== null && destXParsed !== void 0 ? destXParsed : 0;
                                                        if (destXParsed === null) {
                                                            this_1.logParsingWarning(unparsedCommand, 'CROP destX', destXStr, 0);
                                                        }
                                                    }
                                                    if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                        destYStr = lineParts[++index];
                                                        destYParsed = spin2NumericParser_1.Spin2NumericParser.parsePixel(destYStr);
                                                        destY = destYParsed !== null && destYParsed !== void 0 ? destYParsed : 0;
                                                        if (destYParsed === null) {
                                                            this_1.logParsingWarning(unparsedCommand, 'CROP destY', destYStr, 0);
                                                        }
                                                    }
                                                    if (this_1.workingCtx) {
                                                        try {
                                                            this_1.layerManager.drawLayerToCanvas(this_1.workingCtx, layerIndex, cropRect, destX, destY);
                                                            this_1.logMessage("  -- Drew layer ".concat(layerIndex + 1, " cropped (").concat(cropRect.left, ",").concat(cropRect.top, ",").concat(cropRect.width, ",").concat(cropRect.height, ") at (").concat(destX, ", ").concat(destY, ")"));
                                                        }
                                                        catch (error) {
                                                            this_1.logMessage("  -- Error drawing layer: ".concat(error.message));
                                                        }
                                                    }
                                                }
                                                else {
                                                    this_1.logMessage("  -- CROP command requires layer index and either AUTO or crop parameters");
                                                }
                                            }
                                            else {
                                                this_1.logMessage("  -- Layer ".concat(layerIndex + 1, " is not loaded or invalid"));
                                            }
                                        }
                                        else {
                                            this_1.logMessage("  -- CROP command requires layer index");
                                        }
                                        return [3 /*break*/, 22];
                                    case 15:
                                        if (!(lineParts[index].toUpperCase() == 'CLEAR')) return [3 /*break*/, 16];
                                        // clear window
                                        this_1.updatePlotDisplay("CLEAR");
                                        return [3 /*break*/, 22];
                                    case 16:
                                        if (!(lineParts[index].toUpperCase() == 'CLOSE')) return [3 /*break*/, 17];
                                        // request window close
                                        // NOPE this is immediate! this.updatePlotDisplay(`CLOSE`);
                                        this_1.logMessage("  -- Closing window!");
                                        this_1.closeDebugWindow();
                                        return [3 /*break*/, 22];
                                    case 17:
                                        if (!(lineParts[index].toUpperCase() == 'SAVE')) return [3 /*break*/, 21];
                                        if (!(index + 1 < lineParts.length)) return [3 /*break*/, 19];
                                        saveFileName = this_1.removeStringQuotes(lineParts[++index]);
                                        // save the window to a file (as BMP)
                                        return [4 /*yield*/, this_1.saveWindowToBMPFilename(saveFileName)];
                                    case 18:
                                        // save the window to a file (as BMP)
                                        _v.sent();
                                        return [3 /*break*/, 20];
                                    case 19:
                                        this_1.logMessage("at updateContent() missing SAVE fileName in [".concat(lineParts.join(' '), "]"));
                                        _v.label = 20;
                                    case 20: return [3 /*break*/, 22];
                                    case 21:
                                        if (lineParts[index].toUpperCase() == 'LINESIZE') {
                                            // Set line size
                                            if (index + 1 < lineParts.length) {
                                                sizeStr = lineParts[++index];
                                                sizeParsed = spin2NumericParser_1.Spin2NumericParser.parseInteger(sizeStr, true);
                                                if (sizeParsed !== null) {
                                                    this_1.lineSize = sizeParsed; // Pascal doesn't validate/clamp linesize
                                                }
                                                else {
                                                    // Pascal doesn't change lineSize if parsing fails
                                                    this_1.logParsingWarning(unparsedCommand, 'LINESIZE', sizeStr, this_1.lineSize);
                                                }
                                                this_1.logMessage("  -- LINESIZE set to ".concat(this_1.lineSize));
                                            }
                                        }
                                        else if (lineParts[index].toUpperCase() == 'OPACITY') {
                                            // Set opacity
                                            if (index + 1 < lineParts.length) {
                                                opacityStr = lineParts[++index];
                                                opacityParsed = spin2NumericParser_1.Spin2NumericParser.parseInteger(opacityStr, true);
                                                if (opacityParsed !== null) {
                                                    this_1.opacity = opacityParsed; // Pascal doesn't clamp opacity
                                                }
                                                else {
                                                    // Pascal doesn't change opacity if parsing fails
                                                    this_1.logParsingWarning(unparsedCommand, 'OPACITY', opacityStr, this_1.opacity);
                                                }
                                                this_1.logMessage("  -- OPACITY set to ".concat(this_1.opacity));
                                            }
                                        }
                                        else if (lineParts[index].toUpperCase() == 'TEXTANGLE') {
                                            // Set text angle in degrees
                                            if (index + 1 < lineParts.length) {
                                                angleStr = lineParts[++index];
                                                angleParsed = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(angleStr);
                                                this_1.textAngle = angleParsed !== null && angleParsed !== void 0 ? angleParsed : 0;
                                                if (angleParsed === null) {
                                                    this_1.logParsingWarning(unparsedCommand, 'TEXTANGLE', angleStr, 0);
                                                }
                                                this_1.logMessage("  -- TEXTANGLE set to ".concat(this_1.textAngle, " degrees"));
                                            }
                                        }
                                        else if (lineParts[index].toUpperCase() == 'LUTCOLORS') {
                                            // Load LUT colors
                                            this_1.logMessage("  -- LUTCOLORS loading palette");
                                            colorIndex = 0;
                                            index++; // Move past LUTCOLORS
                                            while (index < lineParts.length) {
                                                colorStr = lineParts[index];
                                                colorValue = null;
                                                // Parse color value using Spin2NumericParser (handles $hex, %binary, %%quaternary, and decimal)
                                                colorValue = spin2NumericParser_1.Spin2NumericParser.parseColor(colorStr);
                                                if (colorValue !== null && !isNaN(colorValue)) {
                                                    this_1.lutManager.setColor(colorIndex++, colorValue);
                                                    if (colorIndex >= 256)
                                                        break; // Max LUT size
                                                }
                                                index++;
                                            }
                                            // Update color translator with new palette
                                            this_1.colorTranslator.setLutPalette(this_1.lutManager.getPalette());
                                            this_1.logMessage("  -- Loaded ".concat(colorIndex, " colors into LUT"));
                                            index--; // Back up one since the loop will increment
                                        }
                                        else if (lineParts[index].toUpperCase() == 'SPRITEDEF') {
                                            // SPRITEDEF command - define a sprite
                                            if (index + 3 < lineParts.length) {
                                                spriteId = (_l = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _l !== void 0 ? _l : 0;
                                                width = (_m = spin2NumericParser_1.Spin2NumericParser.parsePixel(lineParts[++index])) !== null && _m !== void 0 ? _m : 0;
                                                height = (_o = spin2NumericParser_1.Spin2NumericParser.parsePixel(lineParts[++index])) !== null && _o !== void 0 ? _o : 0;
                                                if (!isNaN(spriteId) && !isNaN(width) && !isNaN(height)) {
                                                    pixelCount = width * height;
                                                    pixels = [];
                                                    colors = [];
                                                    // Parse pixel data
                                                    for (i = 0; i < pixelCount && index + 1 < lineParts.length; i++) {
                                                        pixelValue = (_p = spin2NumericParser_1.Spin2NumericParser.parseColor(lineParts[++index])) !== null && _p !== void 0 ? _p : 0;
                                                        if (!isNaN(pixelValue)) {
                                                            pixels.push(pixelValue);
                                                        }
                                                        else {
                                                            this_1.logMessage("  -- Invalid pixel value at position ".concat(i));
                                                            break;
                                                        }
                                                    }
                                                    // Parse color palette (256 colors)
                                                    for (i = 0; i < 256 && index + 1 < lineParts.length; i++) {
                                                        colorValue = null;
                                                        colorStr = lineParts[++index];
                                                        // Parse color value (handles $hex, %binary, and decimal)
                                                        if (colorStr.startsWith('$')) {
                                                            colorValue = parseInt(colorStr.substring(1), 16);
                                                        }
                                                        else if (colorStr.startsWith('%')) {
                                                            colorValue = parseInt(colorStr.substring(1), 2);
                                                        }
                                                        else if (/^-?\d+$/.test(colorStr)) {
                                                            colorValue = parseInt(colorStr);
                                                        }
                                                        if (colorValue !== null && !isNaN(colorValue)) {
                                                            colors.push(colorValue);
                                                        }
                                                        else {
                                                            this_1.logMessage("  -- Invalid color value at position ".concat(i));
                                                            break;
                                                        }
                                                    }
                                                    // Validate we got all required data
                                                    if (pixels.length === pixelCount && colors.length === 256) {
                                                        try {
                                                            this_1.spriteManager.defineSprite(spriteId, width, height, pixels, colors);
                                                            this_1.logMessage("  -- Defined sprite ".concat(spriteId, " (").concat(width, "x").concat(height, ")"));
                                                        }
                                                        catch (error) {
                                                            this_1.logMessage("  -- Error defining sprite: ".concat(error.message));
                                                        }
                                                    }
                                                    else {
                                                        this_1.logMessage("  -- Incomplete sprite data: got ".concat(pixels.length, "/").concat(pixelCount, " pixels and ").concat(colors.length, "/256 colors"));
                                                    }
                                                }
                                                else {
                                                    this_1.logMessage("  -- Invalid sprite parameters");
                                                }
                                            }
                                            else {
                                                this_1.logMessage("  -- SPRITEDEF requires id, width, and height");
                                            }
                                        }
                                        else if (lineParts[index].toUpperCase() == 'SPRITE') {
                                            // SPRITE command - draw a sprite
                                            if (index + 1 < lineParts.length) {
                                                spriteIdParam = lineParts[++index];
                                                spriteId = spin2NumericParser_1.Spin2NumericParser.parseCount(spriteIdParam);
                                                if (spriteId !== null && !isNaN(spriteId)) {
                                                    orientation_1 = 0;
                                                    scale = 1.0;
                                                    opacity = 255;
                                                    if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                        orientation_1 = (_q = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _q !== void 0 ? _q : 0;
                                                    }
                                                    if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                        scaleValue = (_r = spin2NumericParser_1.Spin2NumericParser.parseCoordinate(lineParts[++index])) !== null && _r !== void 0 ? _r : 1;
                                                        if (!isNaN(scaleValue)) {
                                                            scale = scaleValue;
                                                        }
                                                    }
                                                    if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                        opacity = (_s = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _s !== void 0 ? _s : 255;
                                                    }
                                                    // Draw sprite at current cursor position
                                                    if (this_1.workingCtx && this_1.spriteManager.isSpriteDefine(spriteId)) {
                                                        try {
                                                            this_1.spriteManager.drawSprite(this_1.workingCtx, spriteId, this_1.cursorPosition.x, this_1.cursorPosition.y, orientation_1, scale, opacity);
                                                            this_1.logMessage("  -- Drew sprite ".concat(spriteId, " at (").concat(this_1.cursorPosition.x, ", ").concat(this_1.cursorPosition.y, ") with orientation=").concat(orientation_1, ", scale=").concat(scale, ", opacity=").concat(opacity));
                                                        }
                                                        catch (error) {
                                                            this_1.logMessage("  -- Error drawing sprite: ".concat(error.message));
                                                        }
                                                    }
                                                    else {
                                                        this_1.logMessage("  -- Sprite ".concat(spriteId, " is not defined"));
                                                    }
                                                }
                                                else {
                                                    this_1.logMessage("  -- Invalid sprite ID");
                                                }
                                            }
                                            else {
                                                this_1.logMessage("  -- SPRITE requires sprite ID");
                                            }
                                        }
                                        else if (this_1.isColorModeCommand(lineParts[index])) {
                                            colorModeStr = lineParts[index].toUpperCase();
                                            colorModeMap = {
                                                'LUT1': colorTranslator_1.ColorMode.LUT1,
                                                'LUT2': colorTranslator_1.ColorMode.LUT2,
                                                'LUT4': colorTranslator_1.ColorMode.LUT4,
                                                'LUT8': colorTranslator_1.ColorMode.LUT8,
                                                'LUMA8': colorTranslator_1.ColorMode.LUMA8,
                                                'LUMA8W': colorTranslator_1.ColorMode.LUMA8W,
                                                'LUMA8X': colorTranslator_1.ColorMode.LUMA8X,
                                                'HSV8': colorTranslator_1.ColorMode.HSV8,
                                                'HSV8W': colorTranslator_1.ColorMode.HSV8W,
                                                'HSV8X': colorTranslator_1.ColorMode.HSV8X,
                                                'RGBI8': colorTranslator_1.ColorMode.RGBI8,
                                                'RGBI8W': colorTranslator_1.ColorMode.RGBI8W,
                                                'RGBI8X': colorTranslator_1.ColorMode.RGBI8X,
                                                'RGB8': colorTranslator_1.ColorMode.RGB8,
                                                'HSV16': colorTranslator_1.ColorMode.HSV16,
                                                'HSV16W': colorTranslator_1.ColorMode.HSV16W,
                                                'HSV16X': colorTranslator_1.ColorMode.HSV16X,
                                                'RGB16': colorTranslator_1.ColorMode.RGB16,
                                                'RGB24': colorTranslator_1.ColorMode.RGB24
                                            };
                                            if (colorModeStr in colorModeMap) {
                                                this_1.colorMode = colorModeMap[colorModeStr];
                                                this_1.colorTranslator.setColorMode(this_1.colorMode);
                                                this_1.logMessage("  -- Color mode set to ".concat(colorModeStr));
                                                // Check for tune parameter
                                                if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                    tune = ((_t = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[++index])) !== null && _t !== void 0 ? _t : 0) & 0x7;
                                                    this_1.colorTranslator.setTune(tune);
                                                    this_1.logMessage("  -- Color tune set to ".concat(tune));
                                                }
                                            }
                                        }
                                        else if (lineParts[index].toUpperCase() == 'PC_KEY') {
                                            // Enable keyboard input forwarding
                                            this_1.enableKeyboardInput();
                                        }
                                        else if (lineParts[index].toUpperCase() == 'PC_MOUSE') {
                                            // Enable mouse input forwarding
                                            this_1.enableMouseInput();
                                        }
                                        else if (lineParts[index].toUpperCase() == 'COLOR') {
                                            // Handle COLOR command with color value
                                            if (index + 1 < lineParts.length) {
                                                colorValue = lineParts[++index];
                                                this_1.updatePlotDisplay("COLOR ".concat(colorValue));
                                            }
                                            else {
                                                this_1.logMessage("* UPD-ERROR  COLOR command missing color value");
                                            }
                                        }
                                        else if (debugColor_1.DebugColor.isValidColorName(lineParts[index])) {
                                            colorName = lineParts[index];
                                            colorBrightness = 15;
                                            if (index < lineParts.length - 1) {
                                                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                                                    colorBrightness = Number(lineParts[++index]);
                                                }
                                            }
                                            this_1.logMessage("* UPD-INFO index(".concat(index, ") is [").concat(lineParts[index], "]"));
                                            namedColor = new debugColor_1.DebugColor(colorName, colorBrightness);
                                            isTextColor = false;
                                            if (index + 1 < lineParts.length && lineParts[index + 1].toUpperCase() == 'TEXT') {
                                                isTextColor = true;
                                            }
                                            // emit the directive we need
                                            if (isTextColor) {
                                                this_1.updatePlotDisplay("TEXTCOLOR ".concat(namedColor.rgbString));
                                            }
                                            else {
                                                this_1.updatePlotDisplay("COLOR ".concat(namedColor.rgbString));
                                            }
                                        }
                                        else {
                                            this_1.logMessage("* UPD-ERROR  unknown directive: [".concat(lineParts[1], "] of [").concat(lineParts.join(' '), "]"));
                                        }
                                        _v.label = 22;
                                    case 22:
                                        out_index_1 = index;
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        index = 1;
                        _u.label = 1;
                    case 1:
                        if (!(index < lineParts.length)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(index)];
                    case 2:
                        _u.sent();
                        index = out_index_1;
                        _u.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    DebugPlotWindow.prototype.formatAs8BitBinary = function (value) {
        // Parse the integer from the string
        var intValue = parseInt(value, 10);
        // Ensure the value is between 0 and 255
        if (intValue < 0 || intValue > 255) {
            throw new Error('Value must be between 0 and 255');
        }
        // Convert the integer to a binary string
        var binaryString = intValue.toString(2);
        // Pad the binary string with leading zeros to ensure it is 8 characters long
        var paddedBinaryString = binaryString.padStart(8, '0');
        return paddedBinaryString;
    };
    DebugPlotWindow.prototype.updatePlotDisplay = function (text) {
        // add action to our display list
        this.logMessage("* updatePlotDisplay(".concat(text, ")"));
        this.deferredCommands.push(text);
        // create window if not already
        if (this.isFirstDisplayData) {
            this.isFirstDisplayData = false;
            this.createDebugWindow();
        }
        // if not deferred update the act on display list now
        if (this.displaySpec.delayedUpdate == false) {
            // act on display list now
            this.pushDisplayListToPlot();
        }
    };
    DebugPlotWindow.prototype.pushDisplayListToPlot = function () {
        var _this = this;
        if (this.shouldWriteToCanvas) {
            if (this.deferredCommands.length > 0) {
                // act on display list now
                // possible values are:
                //  CLEAR
                //  SET x y
                //  COLOR #rrggbb
                //  TEXTCOLOR #rrggbb
                //  FONT size style[8chars] angle
                //  TEXT 'string'
                //  LINE x y linesize opacity
                //  CIRCLE diameter linesize opacity - Where linesize 0 = filled circle
                this.deferredCommands.forEach(function (displayString) {
                    var _a;
                    _this.logMessage("* PUSH-INFO displayString: [".concat(displayString, "]"));
                    var lineParts = displayString.split(' ');
                    if (displayString.startsWith('TEXT ')) {
                        var message = displayString.substring(6, displayString.length - 1);
                        _this.writeStringToPlot(message);
                    }
                    else if (lineParts[0] == 'CLEAR') {
                        // clear the output window so we can draw anew
                        _this.clearPlot();
                        if (_this.clearCount > 0) {
                            _this.clearCount--;
                            if (_this.clearCount == 0) {
                                //this.shouldWriteToCanvas = false; // XYZZY
                            }
                        }
                    }
                    else if (lineParts[0] == 'SET') {
                        // set new drawing cursor position relative to origin
                        if (lineParts.length == 3) {
                            var setX = parseFloat(lineParts[1]);
                            var setY = parseFloat(lineParts[2]);
                            // if polar mode, convert to cartesian
                            if (_this.coordinateMode == eCoordModes.CM_POLAR) {
                                _a = _this.polarToCartesian(setX, setY), _this.cursorPosition.x = _a[0], _this.cursorPosition.y = _a[1];
                            }
                            else {
                                _this.cursorPosition.x = setX;
                                _this.cursorPosition.y = setY;
                            }
                            _this.logMessage("* PUSH-INFO  SET cursorPosition (".concat(setX, ",").concat(setY, ") -> (").concat(_this.cursorPosition.x, ", ").concat(_this.cursorPosition.y, ")"));
                        }
                        else {
                            _this.logMessage("* PUSH-ERROR  BAD parameters for SET [".concat(displayString, "]"));
                        }
                    }
                    else if (lineParts[0] == 'COLOR') {
                        if (lineParts.length == 2) {
                            _this.currFgColor = lineParts[1];
                        }
                        else {
                            _this.logMessage("* PUSH-ERROR  BAD parameters for COLOR [".concat(displayString, "]"));
                        }
                    }
                    else if (lineParts[0] == 'TEXTCOLOR') {
                        if (lineParts.length == 2) {
                            _this.currTextColor = lineParts[1];
                        }
                        else {
                            _this.logMessage("* PUSH-ERROR  BAD parameters for TEXTCOLOR [".concat(displayString, "]"));
                        }
                    }
                    else if (lineParts[0] == 'CIRCLE') {
                        if (lineParts.length == 4) {
                            var diameter = parseFloat(lineParts[1]);
                            var lineSize = parseFloat(lineParts[2]);
                            var opacity = parseFloat(lineParts[3]);
                            _this.drawCircleToPlot(diameter, lineSize, opacity);
                        }
                        else {
                            _this.logMessage("* PUSH-ERROR  BAD parameters for CIRCLE [".concat(displayString, "]"));
                        }
                    }
                    else if (lineParts[0] == 'LINE') {
                        if (lineParts.length == 5) {
                            var x = parseFloat(lineParts[1]);
                            var y = parseFloat(lineParts[2]);
                            var lineSize = parseFloat(lineParts[3]);
                            var opacity = parseFloat(lineParts[4]);
                            _this.drawLineToPlot(x, y, lineSize, opacity);
                        }
                        else {
                            _this.logMessage("* PUSH-ERROR  BAD parameters for LINE [".concat(displayString, "]"));
                        }
                    }
                    else if (lineParts[0] == 'FONT') {
                        if (lineParts.length == 4) {
                            var size = parseFloat(lineParts[1]);
                            var styleStr = lineParts[2];
                            var style = 0;
                            if (styleStr.startsWith('%')) {
                                // has binary prefix!
                                style = parseInt(styleStr.substring(1), 2); // binary
                            }
                            else {
                                style = parseInt(styleStr, 10); // decimal
                            }
                            var angle = parseFloat(lineParts[3]);
                            _this.setFontMetrics(size, style, angle, _this.font, _this.textStyle);
                        }
                        else {
                            _this.logMessage("* PUSH-ERROR  BAD parameters for FONT [".concat(displayString, "]"));
                        }
                    }
                    else {
                        _this.logMessage("* PUSH-ERROR unknown directive: ".concat(displayString));
                    }
                });
            }
            this.deferredCommands = []; // all done, empty the list
        }
    };
    DebugPlotWindow.prototype.setFontMetrics = function (size, style, angle, font, textStyle) {
        DebugPlotWindow.calcMetricsForFontPtSize(size, font);
        // now configure style and angle
        DebugPlotWindow.calcStyleFromBitfield(style, textStyle);
        textStyle.angle = angle;
    };
    DebugPlotWindow.prototype.clearPlot = function () {
        // erase the  display area
        this.clearPlotCanvas();
        // home the cursorPosition
        this.cursorPosition = { x: 0, y: 0 };
    };
    // -----------------------------------------------------------
    // ----------------- Canvas Drawing Routines -----------------
    //
    DebugPlotWindow.prototype.clearPlotCanvas = function () {
        if (this.workingCtx) {
            this.logMessage("at clearPlot()");
            var bgcolor = this.displaySpec.window.background;
            this.logMessage("  -- bgcolor=[".concat(bgcolor, "]"));
            // Clear the working canvas
            this.canvasRenderer.clearCanvas(this.workingCtx);
            this.canvasRenderer.fillRect(this.workingCtx, 0, 0, this.displaySpec.size.width, this.displaySpec.size.height, bgcolor);
        }
    };
    DebugPlotWindow.prototype.drawLineToPlot = function (x, y, lineSize, opacity) {
        var _a;
        if (this.workingCtx) {
            this.logMessage("at drawLineToPlot(".concat(x, ", ").concat(y, ", ").concat(lineSize, ", ").concat(opacity, ")"));
            var fgColor = this.currFgColor;
            if (this.coordinateMode == eCoordModes.CM_POLAR) {
                _a = this.polarToCartesian(x, y), x = _a[0], y = _a[1];
            }
            var _b = this.getCursorXY(), plotFmCoordX = _b[0], plotFmCoordY = _b[1];
            var _c = this.getXY(x, y), plotToCoordX = _c[0], plotToCoordY = _c[1];
            this.logMessage("  -- fm(".concat(plotFmCoordX, ",").concat(plotFmCoordY, ") - to(").concat(plotToCoordX, ",").concat(plotToCoordY, ") color=[").concat(fgColor, "]"));
            // Save current state
            var savedAlpha = this.workingCtx.globalAlpha;
            // Set opacity
            this.canvasRenderer.setOpacity(this.workingCtx, opacity);
            // Draw the line
            this.canvasRenderer.drawLineCtx(this.workingCtx, plotFmCoordX, plotFmCoordY, plotToCoordX, plotToCoordY, fgColor, lineSize);
            // Restore alpha
            this.workingCtx.globalAlpha = savedAlpha;
        }
    };
    DebugPlotWindow.prototype.drawCircleToPlot = function (diameter, lineSize, opacity) {
        if (this.workingCtx) {
            var fgColor = this.currFgColor;
            var _a = this.getCursorXY(), plotCoordX = _a[0], plotCoordY = _a[1];
            var opacityString = opacity == 255 ? 'opaque' : opacity == 0 ? 'clear' : opacity.toString();
            var lineSizeString = lineSize == 0 ? 'filled' : lineSize.toString();
            this.logMessage("at drawCircleToPlot(".concat(diameter, ", ").concat(lineSizeString, ", ").concat(opacityString, ") color=[").concat(fgColor, "] center @(").concat(plotCoordX, ",").concat(plotCoordY, ")"));
            this.logMessage("  -- diameter=(".concat(diameter, ") color=[").concat(fgColor, "]"));
            // Save current state
            var savedAlpha = this.workingCtx.globalAlpha;
            // Set opacity
            this.canvasRenderer.setOpacity(this.workingCtx, opacity);
            // Draw the circle
            this.canvasRenderer.drawCircleCtx(this.workingCtx, plotCoordX, plotCoordY, diameter / 2, fgColor, lineSize === 0, // filled if lineSize is 0
            lineSize);
            // Restore alpha
            this.workingCtx.globalAlpha = savedAlpha;
        }
    };
    DebugPlotWindow.prototype.writeStringToPlot = function (text) {
        if (this.workingCtx) {
            this.logMessage("at writeStringToPlot('".concat(text, "')"));
            var textHeight = this.font.charHeight;
            var lineHeight = this.font.lineHeight;
            var fontSize = this.font.textSizePts;
            var _a = this.getCursorXY(), textXOffset = _a[0], textYOffset = _a[1];
            var vertLineInset = (lineHeight - textHeight) / 2; // 1/2 gap above and below text
            var textYbaseline = textYOffset + vertLineInset + this.font.baseline;
            // now let's apply alignment effects
            // let's start with horizontal alignment
            var alignHCenter = this.textStyle.horizAlign == debugWindowBase_1.eHorizJustification.HJ_CENTER;
            var alignHRight = this.textStyle.horizAlign == debugWindowBase_1.eHorizJustification.HJ_RIGHT;
            var adjYBaseline = textYbaseline;
            switch (this.textStyle.vertAlign) {
                case debugWindowBase_1.eVertJustification.VJ_TOP:
                    //adjYBaseline = textYOffset + this.font.baseline;
                    adjYBaseline -= vertLineInset + this.font.baseline;
                    break;
                case debugWindowBase_1.eVertJustification.VJ_BOTTOM:
                    //adjYBaseline = textYOffset + lineHeight - vertLineInset;
                    //adjYBaseline = textYbaseline;
                    break;
                case debugWindowBase_1.eVertJustification.VJ_MIDDLE:
                    //adjYBaseline = textYOffset + vertLineInset + this.font.baseline - 5; // off by 5 pix?
                    adjYBaseline -= (vertLineInset + this.font.baseline) / 2 + 2; // off by 2?
                    break;
            }
            var alignHString = alignHCenter ? 'Hctr' : alignHRight ? 'Hrt' : 'Hlt';
            var alignVString = this.textStyle.vertAlign == debugWindowBase_1.eVertJustification.VJ_TOP
                ? 'Vtop'
                : this.textStyle.vertAlign == debugWindowBase_1.eVertJustification.VJ_MIDDLE
                    ? 'Vmid'
                    : 'Vbot';
            var textColor = this.currTextColor;
            var fontWeight = this.fontWeightName(this.textStyle);
            var fontStyle = this.textStyle.italic ? 'italic ' : '';
            // FIXME: UNDONE add underline support
            this.logMessage("  -- wt=(".concat(fontWeight, "), [").concat(alignHString, ", ").concat(alignVString, "], sz=(").concat(fontSize, "pt)[").concat(textHeight, "px], (").concat(textColor, ") @(").concat(textXOffset, ",").concat(textYOffset, ") text=[").concat(text, "]"));
            // Calculate text position with alignment
            var xPos = textXOffset;
            var fontFullSpec = "".concat(fontStyle).concat(fontWeight, " ").concat(this.font.textSizePts, "pt Consolas, sans-serif");
            if (alignHCenter || alignHRight) {
                // We need to measure text width for alignment
                this.workingCtx.save();
                this.workingCtx.font = fontFullSpec;
                var textWidth = this.workingCtx.measureText(text).width;
                if (alignHCenter) {
                    xPos -= textWidth / 2;
                }
                else if (alignHRight) {
                    xPos -= textWidth;
                }
                this.workingCtx.restore();
            }
            // Check if we need rotated text
            if (this.textAngle !== 0) {
                this.canvasRenderer.drawRotatedText(this.workingCtx, text, xPos, adjYBaseline, this.textAngle, textColor, fontSize + 'pt', 'Consolas, sans-serif');
            }
            else {
                // Regular text drawing
                this.canvasRenderer.drawTextCtx(this.workingCtx, text, xPos, adjYBaseline, textColor, fontSize + 'pt', 'Consolas, sans-serif', 'left', 'alphabetic');
            }
        }
    };
    // -----------------------------------------------------------
    //  ----------------- Utility Routines -----------------------
    //
    DebugPlotWindow.prototype.getCursorXY = function () {
        // calculate x,y based on Curor Position, CartesianSpec scale inversions, screen size, and ORIGIN
        // used by OBOX, BOX, OVAL, CIRCLE, TEXT, and SPRITE
        return this.getXY(this.cursorPosition.x, this.cursorPosition.y);
    };
    DebugPlotWindow.prototype.getXY = function (x, y) {
        // calculate x,y based on Curor Position, CartesianSpec scale inversions, screen size, and ORIGIN
        // used by OBOX, BOX, OVAL, CIRCLE, TEXT, and SPRITE
        var newX;
        var newY;
        if (this.cartesianConfig.xdir) {
            newX = this.displaySpec.size.width - 1 - this.origin.x - x;
        }
        else {
            newX = this.origin.x + x;
        }
        if (this.cartesianConfig.ydir) {
            newY = this.origin.y + y;
        }
        else {
            newY = this.displaySpec.size.height - 1 - this.origin.y - y;
        }
        newX = Math.round(newX);
        newY = Math.round(newY);
        this.logMessage("* getXY(".concat(x, ",").concat(y, ") -> (").concat(newX, ",").concat(newY, ")"));
        return [newX, newY];
    };
    DebugPlotWindow.prototype.isColorModeCommand = function (command) {
        var colorModes = [
            'LUT1', 'LUT2', 'LUT4', 'LUT8',
            'LUMA8', 'LUMA8W', 'LUMA8X',
            'HSV8', 'HSV8W', 'HSV8X',
            'RGBI8', 'RGBI8W', 'RGBI8X', 'RGB8',
            'HSV16', 'HSV16W', 'HSV16X', 'RGB16',
            'RGB24'
        ];
        return colorModes.includes(command.toUpperCase());
    };
    DebugPlotWindow.prototype.drawDotToPlot = function (dotSize, opacity) {
        if (this.workingCtx) {
            var _a = this.getCursorXY(), plotCoordX = _a[0], plotCoordY = _a[1];
            var fgColor = this.currFgColor;
            this.logMessage("at drawDotToPlot(".concat(dotSize, ", ").concat(opacity, ") @(").concat(plotCoordX, ",").concat(plotCoordY, ")"));
            // Save current state
            var savedAlpha = this.workingCtx.globalAlpha;
            // Set opacity
            this.canvasRenderer.setOpacity(this.workingCtx, opacity);
            // Draw dot as a scaled pixel or small circle
            if (dotSize <= 1) {
                this.canvasRenderer.plotPixelCtx(this.workingCtx, plotCoordX, plotCoordY, fgColor);
            }
            else {
                this.canvasRenderer.drawCircleCtx(this.workingCtx, plotCoordX, plotCoordY, dotSize / 2, fgColor, true, // filled
                0);
            }
            // Restore alpha
            this.workingCtx.globalAlpha = savedAlpha;
        }
    };
    DebugPlotWindow.prototype.drawBoxToPlot = function (width, height, lineSize, opacity) {
        if (this.workingCtx) {
            var _a = this.getCursorXY(), plotCoordX = _a[0], plotCoordY = _a[1];
            var fgColor = this.currFgColor;
            this.logMessage("at drawBoxToPlot(".concat(width, "x").concat(height, ", line:").concat(lineSize, ", op:").concat(opacity, ") @(").concat(plotCoordX, ",").concat(plotCoordY, ")"));
            // Save current state
            var savedAlpha = this.workingCtx.globalAlpha;
            // Set opacity
            this.canvasRenderer.setOpacity(this.workingCtx, opacity);
            // Calculate rectangle bounds (centered on cursor)
            var x1 = plotCoordX - width / 2;
            var y1 = plotCoordY - height / 2;
            var x2 = plotCoordX + width / 2;
            var y2 = plotCoordY + height / 2;
            // Draw rectangle (filled if lineSize is 0)
            this.canvasRenderer.drawRect(this.workingCtx, x1, y1, x2, y2, lineSize === 0, // filled if lineSize is 0
            fgColor, lineSize);
            // Restore alpha
            this.workingCtx.globalAlpha = savedAlpha;
        }
    };
    DebugPlotWindow.prototype.drawOvalToPlot = function (width, height, lineSize, opacity) {
        if (this.workingCtx) {
            var _a = this.getCursorXY(), plotCoordX = _a[0], plotCoordY = _a[1];
            var fgColor = this.currFgColor;
            this.logMessage("at drawOvalToPlot(".concat(width, "x").concat(height, ", line:").concat(lineSize, ", op:").concat(opacity, ") @(").concat(plotCoordX, ",").concat(plotCoordY, ")"));
            // Save current state
            var savedAlpha = this.workingCtx.globalAlpha;
            // Set opacity
            this.canvasRenderer.setOpacity(this.workingCtx, opacity);
            // Draw oval (filled if lineSize is 0)
            this.canvasRenderer.drawOval(this.workingCtx, plotCoordX, plotCoordY, width / 2, // rx
            height / 2, // ry
            lineSize === 0, // filled if lineSize is 0
            fgColor, lineSize);
            // Restore alpha
            this.workingCtx.globalAlpha = savedAlpha;
        }
    };
    DebugPlotWindow.prototype.polarToCartesianNew = function (length, angle) {
        var _a = this.sinCos(angle), sin = _a.sin, cos = _a.cos;
        var x = Math.round(length * cos);
        var y = Math.round(length * sin);
        return [x, y];
    };
    DebugPlotWindow.prototype.sinCos = function (angle) {
        return {
            sin: Math.sin(angle),
            cos: Math.cos(angle)
        };
    };
    DebugPlotWindow.prototype.polarToCartesian = function (length, angle) {
        // convert polar to cartesian
        // Chips:
        //   Tf := (Int64(theta_y) + Int64(vTheta)) / vTwoPi * Pi * 2;
        //   SinCos(Tf, Yf, Xf);
        //   theta_y := Round(Yf * rho_x);
        //   rho_x := Round(Xf * rho_x);
        // Smarty Pants:
        //  const rho_x: number = Math.round(length * Math.cos(angle));
        //  const theta_y: number = Math.round(length * Math.sin(angle));
        // Chip's way:
        var Tf = ((angle + this.polarConfig.offset) / this.polarConfig.twopi) * Math.PI * 2;
        var _a = this.sinCos(Tf), sin = _a.sin, cos = _a.cos;
        var theta_y = Math.round(sin * length);
        var rho_x = Math.round(cos * length);
        this.logMessage("* polarToCartesian(L:".concat(length, ", A:").concat(angle, ") -> (X:").concat(rho_x, ", Y:").concat(theta_y, ")"));
        return [rho_x, theta_y];
    };
    // Convert #rrggbb to rgba
    DebugPlotWindow.prototype.hexToRgba = function (hex, opacity) {
        // Remove the leading '#' if present
        hex = hex.replace(/^#/, '');
        // Parse the red, green, and blue components
        var bigint = parseInt(hex, 16);
        var r = (bigint >> 16) & 255;
        var g = (bigint >> 8) & 255;
        var b = bigint & 255;
        // Return the rgba string
        var rgbaStr = "rgba(".concat(r, ", ").concat(g, ", ").concat(b, ", ").concat(opacity, ")");
        this.logMessage("* hexToRgba(".concat(hex, ", ").concat(opacity, ") -> ").concat(rgbaStr));
        return rgbaStr;
    };
    DebugPlotWindow.prototype.plotOffsetByOrigin = function (newX, newY) {
        // remove the origin offset to get to canvas coordinates
        var plotX = newX - this.origin.x;
        var plotY = newY - this.origin.y;
        //this.logMessage(`* plotOffsetByOrigin(${newX},${newY}) -> (${plotX},${plotY})`);
        return [plotX, plotY];
    };
    DebugPlotWindow.prototype.plotToCanvasCoord = function (cursor) {
        // remove the origin offset subtraction then add it to get to canvas coordinates
        var plotX = cursor.x + this.canvasOffset.x * 2;
        var plotY = cursor.y + this.canvasOffset.y * 2;
        this.logMessage("* plotToCanvasCoord(".concat(cursor.x, ",").concat(cursor.y, ") -> (").concat(plotX, ",").concat(plotY, ")"));
        return [plotX, plotY];
    };
    /**
     * Get the canvas element ID for this window
     */
    DebugPlotWindow.prototype.getCanvasId = function () {
        return 'plot-area'; // Plot window uses 'plot-area' as the canvas ID
    };
    return DebugPlotWindow;
}(debugWindowBase_1.DebugWindowBase));
exports.DebugPlotWindow = DebugPlotWindow;
