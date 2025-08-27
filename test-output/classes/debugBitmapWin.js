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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugBitmapWindow = void 0;
// src/classes/debugBitmapWin.ts
var debugWindowBase_1 = require("./debugWindowBase");
var colorTranslator_1 = require("./shared/colorTranslator");
var lutManager_1 = require("./shared/lutManager");
var tracePatternProcessor_1 = require("./shared/tracePatternProcessor");
var canvasRenderer_1 = require("./shared/canvasRenderer");
var windowPlacer_1 = require("../utils/windowPlacer");
var electron_1 = require("electron");
var debugWindowBase_2 = require("./debugWindowBase");
var packedDataProcessor_1 = require("./shared/packedDataProcessor");
var spin2NumericParser_1 = require("./shared/spin2NumericParser");
/**
 * Debug BITMAP Window - Raster Graphics Display
 *
 * Displays bitmap/raster graphics with configurable trace patterns, color modes, and update rates.
 * Supports 12 different trace patterns for pixel plotting order and image orientation transformations.
 *
 * ## Features
 * - **Trace Patterns**: 12 different pixel plotting patterns (0-11) with rotation, flipping, and scrolling
 * - **Sparse Mode**: Memory-efficient mode for sparse pixel data
 * - **Color Modes**: Multiple color interpretation modes with tuning parameters
 * - **Manual/Auto Update**: Configurable update rates from real-time to full-screen buffering
 * - **LUT Support**: Lookup table colors for palette-based graphics
 * - **Input Forwarding**: PC_KEY and PC_MOUSE support with coordinate transformation
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE width height` - Set bitmap dimensions (4-2048, default: 256x256)
 * - `DOTSIZE x y` - Set pixel size multiplier (1-32, default: 1x1)
 * - `RATE rate` - Update frequency (0=manual, -1=full screen, >0=pixel count, default: 1)
 * - `SPARSE` - Enable sparse mode for memory efficiency
 * - `TRACE pattern` - Set trace pattern (0-11, default: 0 for normal raster scan)
 * - `CTUNE tune` - Color tuning parameter for color mode adjustment
 * - `COLOR bg` - Background color (default: BLACK)
 * - `HIDEXY` - Hide coordinate display
 *
 * ## Data Format
 * Pixel data is fed as color values, coordinates are determined by trace pattern:
 * - Direct pixel values: color data interpreted based on color mode
 * - Coordinate pairs: explicit x,y positioning when supported by trace pattern
 * - Packed data: efficient bulk pixel transfer using standard packed modes
 * - Example: `debug(\`MyBitmap TRACE 0 RATE 1\`(pixel_color))`
 *
 * ## Commands
 * - `CLEAR` - Clear display and reset pixel position
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
 * - `TRACE pattern` - Change trace pattern during runtime
 * - `RATE count` - Change update rate during runtime
 * - `LUT index color` - Set lookup table color
 * - `CTUNE value` - Adjust color tuning parameter
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `BITMAP_Configure` procedure (line 2364)
 * - Update: `BITMAP_Update` procedure (line 2408)
 * - Trace pattern handling: `Bitmap_Trace_Process` procedures
 * - Color management: `Bitmap_Color_Set` procedures
 *
 * ## Examples
 * ```spin2
 * ' Basic bitmap with normal raster scan
 * debug(`BITMAP MyBitmap SIZE 320 240 TRACE 0 RATE 320)
 * repeat y from 0 to 239
 *   repeat x from 0 to 319
 *     color := (x << 16) | (y << 8) | ((x+y) & $FF)
 *     debug(`MyBitmap \`(color))
 *
 * ' Rotated display with sparse mode
 * debug(`BITMAP MyBitmap SIZE 128 128 TRACE 5 SPARSE RATE -1)
 * ```
 *
 * ## Implementation Notes
 * - Supports 12 trace patterns combining rotation, flipping, and scrolling behavior
 * - Rate parameter controls update frequency: 0=manual, -1=full screen, >0=pixel count
 * - Sparse mode optimizes memory usage for images with large empty areas
 * - Color tuning parameter adjusts color interpretation and gamma correction
 * - Coordinate transformation for mouse input matches selected trace pattern
 * - LUT manager provides efficient palette-based color mapping
 *
 * ## Deviations from Pascal
 * - Enhanced color validation and error handling
 * - Additional sparse mode optimizations for memory efficiency
 * - Improved trace pattern coordinate calculations for accuracy
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_BITMAP.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
var DebugBitmapWindow = /** @class */ (function (_super) {
    __extends(DebugBitmapWindow, _super);
    function DebugBitmapWindow(windowTitle, idString, context, position, windowId) {
        if (windowId === void 0) { windowId = "bitmap-".concat(Date.now()); }
        var _this = _super.call(this, context, windowId, 'bitmap') || this;
        _this.windowContent = '';
        // Save window properties
        _this.windowTitle = windowTitle;
        _this.idString = idString;
        _this.windowLogPrefix = 'bitW';
        _this.initialPosition = position;
        // Initialize state with defaults
        _this.state = {
            width: 256,
            height: 256,
            dotSizeX: 1,
            dotSizeY: 1,
            rate: 0, // 0 means use suggested rate
            rateCounter: 0,
            backgroundColor: 0x000000,
            sparseMode: false,
            manualUpdate: false,
            tracePattern: 0,
            colorMode: colorTranslator_1.ColorMode.RGB8,
            colorTune: 0,
            isInitialized: false
        };
        // Initialize shared components
        _this.lutManager = new lutManager_1.LUTManager();
        _this.colorTranslator = new colorTranslator_1.ColorTranslator();
        _this.colorTranslator.setLutPalette(_this.lutManager.getPalette());
        _this.traceProcessor = new tracePatternProcessor_1.TracePatternProcessor();
        _this.canvasRenderer = new canvasRenderer_1.CanvasRenderer();
        // Set up canvas ID for bitmap
        _this.bitmapCanvasId = "bitmap-canvas-".concat(_this.idString);
        // Set USB serial connection for input forwarding
        // Note: USB serial will be set later when available
        // Set scroll callback for trace processor
        _this.traceProcessor.setScrollCallback(function (x, y) {
            _this.scrollBitmap(x, y);
        });
        return _this;
    }
    /**
     * Parse bitmap display declaration
     */
    DebugBitmapWindow.parseBitmapDeclaration = function (lineParts) {
        // here with lineParts = ['`BITMAP', {displayName}, ...]
        // Valid directives are:
        //   TITLE <title>
        //   POS <left> <top> [default: 0,0]
        //   SIZE <width> <height> [1-2048, default: 256x256]
        //   DOTSIZE <x> <y> [default: 1,1]
        //   COLOR <bgnd-color> [default: black]
        //   HIDEXY [default: not hidden]
        console.log("CL: at parseBitmapDeclaration()");
        var displaySpec = {};
        displaySpec.displayName = '';
        displaySpec.title = 'Bitmap';
        var errorMessage = '';
        var isValid = true;
        if (lineParts.length < 2) {
            errorMessage = 'Bitmap display name missing';
            isValid = false;
        }
        else {
            displaySpec.displayName = lineParts[1];
            // Process remaining directives
            var i = 2;
            while (i < lineParts.length && isValid) {
                var directive = lineParts[i].toUpperCase();
                switch (directive) {
                    case 'TITLE':
                        if (i + 1 < lineParts.length) {
                            displaySpec.title = lineParts[++i];
                        }
                        else {
                            errorMessage = 'TITLE directive missing value';
                            isValid = false;
                        }
                        break;
                    case 'POS':
                        if (i + 2 < lineParts.length) {
                            var x = parseInt(lineParts[++i]);
                            var y = parseInt(lineParts[++i]);
                            if (!isNaN(x) && !isNaN(y)) {
                                displaySpec.position = { x: x, y: y };
                            }
                            else {
                                errorMessage = 'POS directive requires two numeric values';
                                isValid = false;
                            }
                        }
                        else {
                            errorMessage = 'POS directive missing values';
                            isValid = false;
                        }
                        break;
                    case 'SIZE':
                        if (i + 2 < lineParts.length) {
                            var width = parseInt(lineParts[++i]);
                            var height = parseInt(lineParts[++i]);
                            if (!isNaN(width) && !isNaN(height) &&
                                width >= 1 && width <= 2048 &&
                                height >= 1 && height <= 2048) {
                                displaySpec.size = { width: width, height: height };
                            }
                            else {
                                errorMessage = 'SIZE directive requires two numeric values between 1 and 2048';
                                isValid = false;
                            }
                        }
                        else {
                            errorMessage = 'SIZE directive missing values';
                            isValid = false;
                        }
                        break;
                    case 'DOTSIZE':
                        if (i + 2 < lineParts.length) {
                            var x = parseInt(lineParts[++i]);
                            var y = parseInt(lineParts[++i]);
                            if (!isNaN(x) && !isNaN(y) && x >= 1 && y >= 1) {
                                displaySpec.dotSize = { x: x, y: y };
                            }
                            else {
                                errorMessage = 'DOTSIZE directive requires two positive numeric values';
                                isValid = false;
                            }
                        }
                        else {
                            errorMessage = 'DOTSIZE directive missing values';
                            isValid = false;
                        }
                        break;
                    case 'COLOR':
                        if (i + 1 < lineParts.length) {
                            // Parse color value - could be named color or hex value
                            var colorStr = lineParts[++i];
                            // TODO: Parse color properly using DebugColor class
                            displaySpec.backgroundColor = 0x000000; // Default to black for now
                        }
                        else {
                            errorMessage = 'COLOR directive missing value';
                            isValid = false;
                        }
                        break;
                    case 'HIDEXY':
                        displaySpec.hideXY = true;
                        break;
                    default:
                        // Unknown directive - could be packed data mode
                        // For now, just skip it
                        break;
                }
                i++;
            }
        }
        if (!isValid) {
            console.log("ERROR: parseBitmapDeclaration() - ".concat(errorMessage));
        }
        return [isValid, displaySpec];
    };
    /**
     * Close the bitmap window
     */
    DebugBitmapWindow.prototype.closeDebugWindow = function () {
        // Stop input polling
        this.inputForwarder.stopPolling();
        // Clean up window reference
        this.debugWindow = null;
    };
    /**
     * Process debug commands and data
     */
    DebugBitmapWindow.prototype.processMessageImmediate = function (lineParts) {
        var dataStartIndex = 0;
        // Process commands
        for (var i = 0; i < lineParts.length; i++) {
            var part = lineParts[i].toUpperCase();
            // Check for bitmap size (first two values) - only if not initialized
            if (i === 0 && !this.state.isInitialized && this.isNumeric(part)) {
                var width = parseInt(part);
                if (i + 1 < lineParts.length && this.isNumeric(lineParts[i + 1])) {
                    var height = parseInt(lineParts[i + 1]);
                    if (width >= 1 && width <= 2048 && height >= 1 && height <= 2048) {
                        this.setBitmapSize(width, height);
                        dataStartIndex = 2;
                        i++; // Skip height
                        continue;
                    }
                    else {
                        this.logMessage("ERROR: Bitmap size out of range (".concat(width, "x").concat(height, "). Must be 1-2048 x 1-2048"));
                        return; // Invalid size, stop processing
                    }
                }
                else {
                    this.logMessage("ERROR: Bitmap size missing height value");
                    return;
                }
            }
            // Parse commands
            switch (part) {
                case 'CLEAR':
                    this.clearBitmap();
                    dataStartIndex = i + 1;
                    break;
                case 'SET':
                    if (i + 2 < lineParts.length) {
                        var x = parseInt(lineParts[i + 1]);
                        var y = parseInt(lineParts[i + 2]);
                        if (!isNaN(x) && !isNaN(y)) {
                            this.setPixelPosition(x, y);
                            dataStartIndex = i + 3;
                            i += 2;
                        }
                        else {
                            this.logMessage("ERROR: SET command requires two numeric coordinates");
                        }
                    }
                    else {
                        this.logMessage("ERROR: SET command missing X and/or Y coordinates");
                    }
                    break;
                case 'UPDATE':
                    this.updateCanvas();
                    dataStartIndex = i + 1;
                    break;
                case 'SCROLL':
                    if (i + 2 < lineParts.length) {
                        var scrollX_1 = parseInt(lineParts[i + 1]);
                        var scrollY_1 = parseInt(lineParts[i + 2]);
                        this.scrollBitmap(scrollX_1, scrollY_1);
                        dataStartIndex = i + 3;
                        i += 2;
                    }
                    break;
                case 'TRACE':
                    if (i + 1 < lineParts.length) {
                        var pattern = parseInt(lineParts[i + 1]);
                        this.setTracePattern(pattern);
                        dataStartIndex = i + 2;
                        i++;
                    }
                    break;
                case 'RATE':
                    if (i + 1 < lineParts.length) {
                        var rate = parseInt(lineParts[i + 1]);
                        this.setRate(rate);
                        dataStartIndex = i + 2;
                        i++;
                    }
                    break;
                case 'DOTSIZE':
                    if (i + 2 < lineParts.length) {
                        var dotX = parseInt(lineParts[i + 1]);
                        var dotY = parseInt(lineParts[i + 2]);
                        this.setDotSize(dotX, dotY);
                        dataStartIndex = i + 3;
                        i += 2;
                    }
                    break;
                case 'SPARSE':
                    if (i + 1 < lineParts.length) {
                        var bgColor = this.parseColorValue(lineParts[i + 1]);
                        this.setSparseMode(bgColor);
                        dataStartIndex = i + 2;
                        i++;
                    }
                    break;
                case 'SAVE':
                    // Handle SAVE command with optional WINDOW parameter
                    var saveWindow = false;
                    var filename = '';
                    if (i + 1 < lineParts.length) {
                        if (lineParts[i + 1].toUpperCase() === 'WINDOW') {
                            saveWindow = true;
                            filename = lineParts[i + 2] || 'bitmap.bmp';
                            i++;
                        }
                        else {
                            filename = lineParts[i + 1];
                        }
                        this.saveBitmap(filename, saveWindow);
                        dataStartIndex = i + 2;
                        i++;
                    }
                    break;
                case 'PC_KEY':
                case 'PC_MOUSE':
                    // These commands should appear last in DEBUG statement
                    // They enable input forwarding
                    if (part === 'PC_KEY') {
                        this.enableKeyboardInput();
                    }
                    else {
                        this.enableMouseInput();
                    }
                    dataStartIndex = lineParts.length; // No data after these
                    break;
                default:
                    // Check for color mode commands
                    if (this.parseColorModeCommand(part, lineParts.slice(i + 1))) {
                        // Color mode parsed, advance index
                        if (part.includes('LUTCOLORS')) {
                            // LUTCOLORS consumes all remaining parts
                            dataStartIndex = lineParts.length;
                            i = lineParts.length;
                        }
                        else {
                            // Regular color mode may have tune parameter
                            if (i + 1 < lineParts.length && this.isNumeric(lineParts[i + 1])) {
                                dataStartIndex = i + 2;
                                i++;
                            }
                            else {
                                dataStartIndex = i + 1;
                            }
                        }
                    }
                    break;
            }
        }
        // Process numeric data values
        if (dataStartIndex < lineParts.length) {
            this.processDataValues(lineParts.slice(dataStartIndex));
        }
    };
    /**
     * Set bitmap size and initialize canvas
     */
    DebugBitmapWindow.prototype.setBitmapSize = function (width, height) {
        // Clamp to valid range
        this.state.width = Math.max(1, Math.min(2048, width));
        this.state.height = Math.max(1, Math.min(2048, height));
        // Update trace processor
        this.traceProcessor.setBitmapSize(this.state.width, this.state.height);
        // Update input forwarder window dimensions
        this.inputForwarder.setWindowDimensions(this.state.width, this.state.height);
        // Initialize canvas if not already done
        if (!this.state.isInitialized) {
            this.initializeCanvas();
        }
        // Update RATE if it's 0 (use suggested rate)
        if (this.state.rate === 0) {
            this.state.rate = this.traceProcessor.getSuggestedRate();
        }
        this.state.isInitialized = true;
    };
    /**
     * Initialize the bitmap canvas
     */
    DebugBitmapWindow.prototype.initializeCanvas = function () {
        // Set up the visible canvas
        var canvasHTML = "\n      <canvas id=\"".concat(this.bitmapCanvasId, "\" \n              width=\"").concat(this.state.width * this.state.dotSizeX, "\" \n              height=\"").concat(this.state.height * this.state.dotSizeY, "\"\n              style=\"image-rendering: pixelated; width: 100%; height: 100%;\">\n      </canvas>\n    ");
        // Create window if not exists
        if (!this.debugWindow) {
            this.createDebugWindow(canvasHTML);
        }
        else {
            // Update existing window content
            this.debugWindow.webContents.executeJavaScript("\n        document.body.innerHTML = '".concat(canvasHTML, "';\n      "));
        }
        // Clear to background color
        this.clearBitmap();
    };
    /**
     * Clear bitmap to background color
     */
    DebugBitmapWindow.prototype.clearBitmap = function () {
        if (!this.debugWindow)
            return;
        // Convert background color to hex string
        var bgColor = this.state.backgroundColor & 0xFFFFFF;
        var r = (bgColor >> 16) & 0xFF;
        var g = (bgColor >> 8) & 0xFF;
        var b = bgColor & 0xFF;
        // Clear canvas using JavaScript
        var clearJS = "\n      const canvas = document.getElementById('".concat(this.bitmapCanvasId, "');\n      if (canvas) {\n        const ctx = canvas.getContext('2d');\n        if (ctx) {\n          ctx.fillStyle = 'rgb(").concat(r, ", ").concat(g, ", ").concat(b, ")';\n          ctx.fillRect(0, 0, ").concat(this.state.width * this.state.dotSizeX, ", ").concat(this.state.height * this.state.dotSizeY, ");\n        }\n      }\n    ");
        this.debugWindow.webContents.executeJavaScript(clearJS);
    };
    /**
     * Set pixel position
     */
    DebugBitmapWindow.prototype.setPixelPosition = function (x, y) {
        if (!this.state.isInitialized) {
            this.logMessage('ERROR: Cannot set pixel position before bitmap size is defined');
            return;
        }
        // Validate coordinates
        if (x < 0 || x >= this.state.width || y < 0 || y >= this.state.height) {
            this.logMessage("ERROR: Invalid pixel coordinates (".concat(x, ",").concat(y, "). Must be within 0-").concat(this.state.width - 1, " x 0-").concat(this.state.height - 1));
            return;
        }
        this.traceProcessor.setPosition(x, y);
    };
    /**
     * Update the visible canvas from offscreen canvas
     */
    DebugBitmapWindow.prototype.updateCanvas = function () {
        // In the current implementation, we're drawing directly to the canvas
        // using CanvasRenderer methods, so this is primarily used to force
        // a refresh when in manual update mode.
        // For now, this is a no-op since we're updating the canvas
        // directly through plotPixel/plotScaledPixel calls.
        // If we need double-buffering in the future, we can implement it here.
    };
    /**
     * Scroll bitmap content
     */
    DebugBitmapWindow.prototype.scrollBitmap = function (scrollX, scrollY) {
        if (!this.state.isInitialized)
            return;
        // Clamp scroll values
        scrollX = Math.max(-this.state.width, Math.min(this.state.width, scrollX));
        scrollY = Math.max(-this.state.height, Math.min(this.state.height, scrollY));
        // Use canvas renderer to scroll
        if (!this.debugWindow)
            return;
        this.debugWindow.webContents.executeJavaScript(this.canvasRenderer.scrollBitmap(this.bitmapCanvasId, scrollX * this.state.dotSizeX, scrollY * this.state.dotSizeY, this.state.width * this.state.dotSizeX, this.state.height * this.state.dotSizeY));
    };
    /**
     * Set trace pattern
     */
    DebugBitmapWindow.prototype.setTracePattern = function (pattern) {
        this.state.tracePattern = pattern & 0xF; // 0-15
        this.traceProcessor.setPattern(pattern);
        // Update rate if 0
        if (this.state.rate === 0) {
            this.state.rate = this.traceProcessor.getSuggestedRate();
        }
    };
    /**
     * Set pixel update rate
     */
    DebugBitmapWindow.prototype.setRate = function (rate) {
        this.state.rate = Math.max(0, rate);
        this.state.rateCounter = 0;
        // If rate is 0, use suggested rate
        if (this.state.rate === 0) {
            this.state.rate = this.traceProcessor.getSuggestedRate();
        }
    };
    /**
     * Set dot size for pixel scaling
     */
    DebugBitmapWindow.prototype.setDotSize = function (dotX, dotY) {
        this.state.dotSizeX = Math.max(1, dotX);
        this.state.dotSizeY = Math.max(1, dotY);
        // Update input forwarder
        this.inputForwarder.setDotSize(this.state.dotSizeX, this.state.dotSizeY);
        // Reinitialize canvas with new size
        if (this.state.isInitialized) {
            this.initializeCanvas();
        }
    };
    /**
     * Set sparse mode with background color
     */
    DebugBitmapWindow.prototype.setSparseMode = function (bgColor) {
        this.state.sparseMode = true;
        this.state.backgroundColor = bgColor;
    };
    /**
     * Save bitmap to file
     */
    DebugBitmapWindow.prototype.saveBitmap = function (filename, saveWindow) {
        if (!this.state.isInitialized) {
            this.logMessage('ERROR: Cannot save bitmap before it is initialized');
            return;
        }
        if (saveWindow) {
            // Save entire window
            this.saveWindowToBMPFilename(filename);
        }
        else {
            // Save just the bitmap area
            // TODO: Implement saving just the canvas area
            this.saveWindowToBMPFilename(filename);
        }
    };
    /**
     * Parse color mode commands
     */
    DebugBitmapWindow.prototype.parseColorModeCommand = function (command, remainingParts) {
        // Check for LUTCOLORS command
        if (command === 'LUTCOLORS') {
            // Parse LUT colors
            for (var _i = 0, remainingParts_1 = remainingParts; _i < remainingParts_1.length; _i++) {
                var colorStr = remainingParts_1[_i];
                // Try to parse color value (handles $, %, and plain numbers)
                var colorValue = null;
                if (colorStr.startsWith('$')) {
                    var parsed = parseInt(colorStr.substring(1), 16);
                    if (!isNaN(parsed))
                        colorValue = parsed;
                }
                else if (colorStr.startsWith('%')) {
                    var parsed = parseInt(colorStr.substring(1), 2);
                    if (!isNaN(parsed))
                        colorValue = parsed;
                }
                else if (this.isNumeric(colorStr)) {
                    colorValue = parseInt(colorStr);
                }
                if (colorValue !== null) {
                    var index = this.lutManager.getPaletteSize();
                    if (index < 256) {
                        this.lutManager.setColor(index, colorValue);
                    }
                }
            }
            return true;
        }
        // Check for color mode commands
        var colorModeMap = {
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
        if (command in colorModeMap) {
            this.state.colorMode = colorModeMap[command];
            this.colorTranslator.setColorMode(this.state.colorMode);
            // Check for tune parameter
            if (remainingParts.length > 0 && this.isNumeric(remainingParts[0])) {
                var tune = parseInt(remainingParts[0]) & 0x7;
                this.state.colorTune = tune;
                this.colorTranslator.setTune(tune);
            }
            return true;
        }
        return false;
    };
    /**
     * Process numeric data values
     */
    DebugBitmapWindow.prototype.processDataValues = function (dataParts) {
        if (!this.state.isInitialized) {
            this.logMessage('ERROR: Cannot plot pixels before bitmap size is defined');
            return;
        }
        for (var _i = 0, dataParts_1 = dataParts; _i < dataParts_1.length; _i++) {
            var part = dataParts_1[_i];
            if (!this.isNumeric(part))
                continue;
            var rawValue = parseInt(part);
            // Unpack data based on current packed mode
            var unpackedValues = packedDataProcessor_1.PackedDataProcessor.unpackSamples(rawValue, this.getPackedDataMode());
            // Process each unpacked value
            for (var _a = 0, unpackedValues_1 = unpackedValues; _a < unpackedValues_1.length; _a++) {
                var value = unpackedValues_1[_a];
                // Handle rate cycling
                this.state.rateCounter++;
                if (this.state.rateCounter >= this.state.rate) {
                    this.state.rateCounter = 0;
                    // Get current pixel position
                    var pos = this.traceProcessor.getPosition();
                    // Skip if sparse mode and value matches background
                    if (this.state.sparseMode && value === this.state.backgroundColor) {
                        this.traceProcessor.step();
                        continue;
                    }
                    // Translate color
                    var rgb24 = this.colorTranslator.translateColor(value);
                    var color = "#".concat(rgb24.toString(16).padStart(6, '0'));
                    // Plot pixel
                    if (this.state.dotSizeX === 1 && this.state.dotSizeY === 1) {
                        if (this.debugWindow) {
                            this.debugWindow.webContents.executeJavaScript(this.canvasRenderer.plotPixel(this.bitmapCanvasId, pos.x, pos.y, color));
                        }
                    }
                    else {
                        if (this.debugWindow) {
                            this.debugWindow.webContents.executeJavaScript(this.canvasRenderer.plotScaledPixel(this.bitmapCanvasId, pos.x, pos.y, color, this.state.dotSizeX, this.state.dotSizeY));
                        }
                    }
                    // Step to next position
                    this.traceProcessor.step();
                }
            }
        }
    };
    /**
     * Check if string is numeric
     */
    DebugBitmapWindow.prototype.isNumeric = function (str) {
        return /^-?\d+$/.test(str);
    };
    /**
     * Parse color value (handles $hex, %binary, %%quaternary, and decimal)
     * Note: PackedDataProcessor handles packed data streams separately
     */
    DebugBitmapWindow.prototype.parseColorValue = function (str) {
        var value = spin2NumericParser_1.Spin2NumericParser.parseColor(str);
        return value !== null ? value : 0;
    };
    /**
     * Get current packed data mode based on color mode
     */
    DebugBitmapWindow.prototype.getPackedDataMode = function () {
        // Map color modes to appropriate packed data modes
        var mode;
        var bitsPerSample;
        var valueSize;
        switch (this.state.colorMode) {
            case colorTranslator_1.ColorMode.LUT1:
                mode = debugWindowBase_2.ePackedDataMode.PDM_LONGS_1BIT;
                bitsPerSample = 1;
                valueSize = debugWindowBase_2.ePackedDataWidth.PDW_LONGS;
                break;
            case colorTranslator_1.ColorMode.LUT2:
                mode = debugWindowBase_2.ePackedDataMode.PDM_LONGS_2BIT;
                bitsPerSample = 2;
                valueSize = debugWindowBase_2.ePackedDataWidth.PDW_LONGS;
                break;
            case colorTranslator_1.ColorMode.LUT4:
                mode = debugWindowBase_2.ePackedDataMode.PDM_LONGS_4BIT;
                bitsPerSample = 4;
                valueSize = debugWindowBase_2.ePackedDataWidth.PDW_LONGS;
                break;
            case colorTranslator_1.ColorMode.LUT8:
            case colorTranslator_1.ColorMode.LUMA8:
            case colorTranslator_1.ColorMode.LUMA8W:
            case colorTranslator_1.ColorMode.LUMA8X:
            case colorTranslator_1.ColorMode.HSV8:
            case colorTranslator_1.ColorMode.HSV8W:
            case colorTranslator_1.ColorMode.HSV8X:
            case colorTranslator_1.ColorMode.RGBI8:
            case colorTranslator_1.ColorMode.RGBI8W:
            case colorTranslator_1.ColorMode.RGBI8X:
            case colorTranslator_1.ColorMode.RGB8:
                mode = debugWindowBase_2.ePackedDataMode.PDM_LONGS_8BIT;
                bitsPerSample = 8;
                valueSize = debugWindowBase_2.ePackedDataWidth.PDW_LONGS;
                break;
            case colorTranslator_1.ColorMode.HSV16:
            case colorTranslator_1.ColorMode.HSV16W:
            case colorTranslator_1.ColorMode.HSV16X:
            case colorTranslator_1.ColorMode.RGB16:
                mode = debugWindowBase_2.ePackedDataMode.PDM_LONGS_16BIT;
                bitsPerSample = 16;
                valueSize = debugWindowBase_2.ePackedDataWidth.PDW_LONGS;
                break;
            case colorTranslator_1.ColorMode.RGB24:
                mode = debugWindowBase_2.ePackedDataMode.PDM_UNKNOWN; // RGB24 as 32-bit (no packing)
                bitsPerSample = 32;
                valueSize = debugWindowBase_2.ePackedDataWidth.PDW_LONGS;
                break;
            default:
                mode = debugWindowBase_2.ePackedDataMode.PDM_LONGS_8BIT;
                bitsPerSample = 8;
                valueSize = debugWindowBase_2.ePackedDataWidth.PDW_LONGS;
                break;
        }
        return {
            mode: mode,
            bitsPerSample: bitsPerSample,
            valueSize: valueSize,
            isAlternate: false,
            isSigned: false
        };
    };
    /**
     * Create the debug window
     */
    DebugBitmapWindow.prototype.createDebugWindow = function (htmlContent) {
        var _this = this;
        var _a, _b;
        this.logMessage("at createDebugWindow() BITMAP");
        // Calculate window size based on bitmap and dotsize
        var canvasWidth = this.state.width * this.state.dotSizeX;
        var canvasHeight = this.state.height * this.state.dotSizeY;
        var windowWidth = canvasWidth + 20; // Add some padding
        var windowHeight = canvasHeight + 40; // Add title bar height
        // Check if position was explicitly set or use WindowPlacer
        var windowX = ((_a = this.initialPosition) === null || _a === void 0 ? void 0 : _a.x) || 0;
        var windowY = ((_b = this.initialPosition) === null || _b === void 0 ? void 0 : _b.y) || 0;
        // If position is at default (0,0), use WindowPlacer for intelligent positioning
        if (windowX === 0 && windowY === 0) {
            var windowPlacer = windowPlacer_1.WindowPlacer.getInstance();
            var placementConfig = {
                dimensions: { width: windowWidth, height: windowHeight },
                cascadeIfFull: true
            };
            var position = windowPlacer.getNextPosition("bitmap-".concat(this.idString), placementConfig);
            windowX = position.x;
            windowY = position.y;
        }
        // Create the browser window
        this.debugWindow = new electron_1.BrowserWindow({
            width: windowWidth,
            height: windowHeight,
            x: windowX,
            y: windowY,
            title: this.windowTitle,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        // Register window with WindowPlacer for position tracking
        if (this.debugWindow) {
            var windowPlacer = windowPlacer_1.WindowPlacer.getInstance();
            windowPlacer.registerWindow("bitmap-".concat(this.idString), this.debugWindow);
        }
        // Set up the HTML content
        var fullHtml = "\n      <!DOCTYPE html>\n      <html>\n        <head>\n          <title>".concat(this.windowTitle, "</title>\n          <style>\n            body {\n              margin: 0;\n              padding: 10px;\n              overflow: hidden;\n              background-color: #000;\n            }\n            canvas {\n              display: block;\n              image-rendering: pixelated;\n              image-rendering: -moz-crisp-edges;\n              image-rendering: crisp-edges;\n            }\n          </style>\n        </head>\n        <body>\n          ").concat(htmlContent, "\n        </body>\n      </html>\n    ");
        // Load the HTML
        this.debugWindow.loadURL("data:text/html,".concat(encodeURIComponent(fullHtml)));
        // Hook window events
        this.debugWindow.on('ready-to-show', function () {
            var _a;
            _this.logMessage('* Bitmap window will show...');
            (_a = _this.debugWindow) === null || _a === void 0 ? void 0 : _a.show();
            // Register with WindowRouter when window is ready
            _this.registerWithRouter();
        });
        this.debugWindow.on('closed', function () {
            _this.logMessage('* Bitmap window closed');
            _this.closeDebugWindow();
        });
    };
    /**
     * Override base class logMessage to handle missing context.logger
     */
    DebugBitmapWindow.prototype.logMessage = function (message) {
        // Use base class logging
        _super.prototype.logMessage.call(this, message, this.windowLogPrefix);
    };
    /**
     * Get the canvas element ID for this window
     */
    DebugBitmapWindow.prototype.getCanvasId = function () {
        return this.bitmapCanvasId; // Bitmap window uses bitmapCanvasId
    };
    return DebugBitmapWindow;
}(debugWindowBase_1.DebugWindowBase));
exports.DebugBitmapWindow = DebugBitmapWindow;
