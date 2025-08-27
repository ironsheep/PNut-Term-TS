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
exports.DebugLogicWindow = void 0;
var electron_1 = require("electron");
var debugColor_1 = require("./shared/debugColor");
var packedDataProcessor_1 = require("./shared/packedDataProcessor");
var canvasRenderer_1 = require("./shared/canvasRenderer");
var triggerProcessor_1 = require("./shared/triggerProcessor");
var displaySpecParser_1 = require("./shared/displaySpecParser");
var windowPlacer_1 = require("../utils/windowPlacer");
var debugWindowBase_1 = require("./debugWindowBase");
/**
 * Debug LOGIC Window - Logic Analyzer Display
 *
 * A multi-channel logic analyzer for visualizing digital signals from Propeller 2 microcontrollers.
 * Displays up to 32 digital channels with configurable triggering, channel grouping, and packed data modes.
 *
 * ## Features
 * - **32-Channel Logic Analyzer**: Display up to 32 independent digital signals
 * - **Channel Grouping**: Combine multiple bits into named channels with custom widths
 * - **Trigger System**: Configurable mask/match triggering with holdoff
 * - **Packed Data Modes**: Support for 12 different packed data formats
 * - **Auto-scrolling**: Continuous data capture with automatic scrolling
 * - **Custom Colors**: Per-channel color configuration
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SAMPLES count` - Number of samples to display (4-2048, default: 32)
 * - `SPACING pixels` - Pixel width per sample (default: 8)
 * - `RATE divisor` - Sample rate divisor (1-2048, default: 1)
 * - `LINESIZE half-pix` - Line thickness (1-7, default: 1)
 * - `TEXTSIZE half-pix` - Text size (6-200, default: editor font size)
 * - `COLOR bg {grid}` - Background and grid colors (default: BLACK, GRAY 4)
 * - `'name' {bits {color}}` - Define channel (default: 1 bit, auto-color)
 * - `TRIGGER mask match {offset {holdoff}}` - Configure triggering
 * - `HIDEXY` - Hide mouse coordinate display
 * - Packed data modes - Enable packed data processing
 *
 * ## Data Format
 * Data is fed as 32-bit values representing logic states:
 * - Each bit represents one logic channel (0=low, 1=high)
 * - Channels can be grouped and named via configuration
 * - Packed data modes allow compressed multi-sample transfers
 * - Example: `debug(\`Logic \`(portA | (portB << 8)))`
 *
 * ## Commands
 * - `numeric_data` - 32-bit logic sample data
 * - `CLEAR` - Clear display and sample buffer
 * - `UPDATE` - Force display update (when UPDATE directive used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding
 * - `PC_MOUSE` - Enable mouse input forwarding
 *
 * ## Trigger System
 * - **Mask**: Specifies which bits to monitor (1=monitor, 0=ignore)
 * - **Match**: Pattern to match on monitored bits
 * - **Offset**: Sample position for trigger (default: SAMPLES/2)
 * - **Holdoff**: Minimum samples between triggers (default: SAMPLES)
 * - Trigger fires when: `(data & mask) == match`
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `LOGIC_Configure` procedure (line 926)
 * - Update: `LOGIC_Update` procedure (line 1034)
 * - Trigger handling: Part of LOGIC_Update procedure
 *
 * ## Examples
 * ```spin2
 * ' Basic 8-channel logic analyzer
 * debug(`LOGIC MyLogic SAMPLES 64 'Port[7..0]' 8)
 * repeat
 *   debug(`MyLogic `(ina[7..0]))
 *
 * ' Triggered capture with named channels
 * debug(`LOGIC MyLogic TRIGGER $FF $80 'Data' 8 'Clock' 'Enable')
 * ```
 *
 * ## Implementation Notes
 * - Channel colors cycle through: LIME, RED, CYAN, YELLOW, MAGENTA, BLUE, ORANGE, OLIVE
 * - Trigger processor handles edge detection and holdoff timing
 * - Packed data processor supports all 12 P2 packed modes with ALT/SIGNED variants
 *
 * ## Deviations from Pascal
 * - None - Full Pascal compatibility maintained
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_LOGIC.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
var DebugLogicWindow = /** @class */ (function (_super) {
    __extends(DebugLogicWindow, _super);
    function DebugLogicWindow(ctx, displaySpec, windowId) {
        var _this = this;
        // Use the user-provided display name as the window ID for proper routing
        var actualWindowId = windowId || displaySpec.displayName;
        _this = _super.call(this, ctx, actualWindowId, 'logic') || this;
        _this.displaySpec = {};
        _this.channelBitSpecs = []; // one for each channel bit within the 32 possible channels
        _this.channelSamples = []; // one for each channel
        _this.triggerSpec = {};
        _this.isFirstNumericData = true;
        _this.channelVInset = 3; // 3 pixels from top and bottom of window
        _this.contentInset = 0; // 10 pixels from left and right of window
        _this.canvasMargin = 10; // 10 pixels from to (no left,) right, top, and bottom of canvas (NOT NEEDED)
        _this.labelWidth = 0; // width of label canvas
        _this.labelHeight = 0; // height of label canvas
        _this.canvasRenderer = new canvasRenderer_1.CanvasRenderer();
        _this.packedMode = {};
        _this.singleBitChannelCount = 0; // number of single bit channels
        // Trigger state properties
        _this.triggerArmed = false;
        _this.triggerFired = false;
        _this.holdoffCounter = 0;
        _this.triggerSampleIndex = -1; // Track which sample caused the trigger
        // diagnostics used to limit the number of samples displayed while testing
        _this.dbgUpdateCount = 31 * 6; // NOTE 120 (no scroll) ,140 (scroll plus more), 260 scroll twice;
        _this.dbgLogMessageCount = 32 * 6; //256 + 1; // log first N samples then stop (2 channel: 128+1 is 64 samples)
        _this.windowLogPrefix = 'lcgW';
        // record our Debug Logic Window Spec
        _this.displaySpec = displaySpec;
        // init default Trigger Spec
        _this.triggerSpec = {
            trigEnabled: false,
            trigMask: 0,
            trigMatch: 1,
            trigSampOffset: displaySpec.nbrSamples / 2,
            trigHoldoff: 0
        };
        // Initialize the trigger processor
        _this.triggerProcessor = new triggerProcessor_1.LogicTriggerProcessor();
        // initially we don't have a packed mode...
        _this.packedMode = {
            mode: debugWindowBase_1.ePackedDataMode.PDM_UNKNOWN,
            bitsPerSample: 0,
            valueSize: debugWindowBase_1.ePackedDataWidth.PDW_UNKNOWN,
            isAlternate: false,
            isSigned: false
        };
        // CRITICAL FIX: Create window immediately, don't wait for numeric data
        // This ensures windows appear when created, even if closed before data arrives
        _this.logMessage('Creating LOGIC window immediately in constructor');
        _this.calculateAutoTriggerAndScale();
        _this.createDebugWindow();
        _this.initChannelSamples();
        return _this;
    }
    DebugLogicWindow.colorNameFmChanNumber = function (chanNumber) {
        var defaultColorNames = ['LIME', 'RED', 'CYAN', 'YELLOW', 'MAGENTA', 'BLUE', 'ORANGE', 'OLIVE'];
        var desiredName = defaultColorNames[chanNumber % defaultColorNames.length];
        return desiredName;
    };
    Object.defineProperty(DebugLogicWindow.prototype, "windowTitle", {
        get: function () {
            var desiredValue = "".concat(this.displaySpec.displayName, " LOGIC");
            if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
                desiredValue = this.displaySpec.windowTitle;
            }
            return desiredValue;
        },
        enumerable: false,
        configurable: true
    });
    DebugLogicWindow.parseLogicDeclaration = function (lineParts) {
        // here with lineParts = ['`LOGIC', {displayName}, ...]
        // Valid directives are:
        //   TITLE <title>
        //   POS <left> <top> [default: 0,0]
        //   SAMPLES <nbr> [4-2048, default: 32]
        //   SPACING <nbr> [default: 8] // width is SAMPLES * SPACING
        //   RATE <rate> [1-2048, default: 1]
        //   LINESIZE <half-pix> [1-7, default: 1]
        //   TEXTSIZE <half-pix> [6-200, default: editor font size]
        //   COLOR <bgnd-color> {<grid-color>} [BLACK, GRAY 4]
        //   'name' {1_32 {color}} [default: 1, default color]
        //   packed_data_mode
        //   HIDEXY
        // where color is: rgb24 value, else BLACK / WHITE or ORANGE / BLUE / GREEN / CYAN / RED / MAGENTA / YELLOW / GRAY followed by an optional 0..15 for brightness (default 8)
        console.log("CL: at parseLogicDeclaration()");
        var displaySpec = {};
        displaySpec.channelSpecs = []; // ensure this is structured too! (CRASHED without this!)
        displaySpec.window = {}; // ensure this is structured too! (CRASHED without this!)
        displaySpec.font = {}; // ensure this is structured too! (CRASHED without this!)
        displaySpec.textStyle = {}; // ensure this is structured too! (CRASHED without this!)
        var isValid = false;
        // set defaults
        var bkgndColor = new debugColor_1.DebugColor('BLACK');
        var gridColor = new debugColor_1.DebugColor('GRAY3', 4);
        console.log("CL: at parseLogicDeclaration() with colors...");
        displaySpec.position = { x: 0, y: 0 };
        displaySpec.nbrSamples = 32;
        displaySpec.spacing = 8;
        displaySpec.rate = 1;
        displaySpec.lineSize = 1;
        displaySpec.window.background = bkgndColor.rgbString;
        displaySpec.window.grid = gridColor.rgbString;
        displaySpec.isPackedData = false;
        displaySpec.hideXY = false;
        displaySpec.textSize = 12;
        this.calcMetricsForFontPtSize(displaySpec.textSize, displaySpec.font);
        var labelTextSyle = this.calcStyleFrom(debugWindowBase_1.eVertJustification.VJ_MIDDLE, debugWindowBase_1.eHorizJustification.HJ_RIGHT, debugWindowBase_1.eTextWeight.TW_NORMAL);
        this.calcStyleFromBitfield(labelTextSyle, displaySpec.textStyle);
        displaySpec.logicChannels = 32;
        displaySpec.topLogicChannel = displaySpec.logicChannels - 1;
        // now parse overrides to defaults
        console.log("CL: at overrides LogicDisplaySpec: ".concat(lineParts));
        if (lineParts.length > 1) {
            displaySpec.displayName = lineParts[1];
            isValid = true; // invert default value
        }
        if (lineParts.length > 2) {
            for (var index = 2; index < lineParts.length; index++) {
                var element = lineParts[index];
                //console.log(`CL: LogicDisplaySpec - element=[${element}] of lineParts[${index}]`);
                if (element.startsWith("'")) {
                    // have channel name...
                    var newChannelSpec = {};
                    var thisGroupNbr = displaySpec.channelSpecs.length;
                    var defaultChannelColor = new debugColor_1.DebugColor(DebugLogicWindow.colorNameFmChanNumber(thisGroupNbr), 15);
                    newChannelSpec.color = defaultChannelColor.rgbString; // might be overridden below
                    newChannelSpec.nbrBits = 1; // default to 1 bit (may be overridden below)
                    //console.log(`CL: LogicDisplaySpec - new default: ${JSON.stringify(newChannelSpec, null, 2)}`);
                    // display string at cursor position with current colors
                    var displayString = undefined;
                    var currLinePart = lineParts[index];
                    // isolate string and display it. Advance index to next part after close quote
                    if (currLinePart.substring(1).includes("'")) {
                        // string ends as this single linepart
                        displayString = currLinePart.substring(1, currLinePart.length - 1);
                        //console.log(`CL:  -- displayString=[${displayString}]`);
                    }
                    else {
                        // this will be a multi-part string
                        var stringParts = [currLinePart.substring(1)];
                        console.log("CL:  -- currLinePart=[".concat(currLinePart, "]"));
                        while (index < lineParts.length - 1) {
                            index++;
                            var nextLinePart = lineParts[index];
                            console.log("CL:  -- nextLinePart=[".concat(nextLinePart, "]"));
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
                    //console.log(`CL: LogicDisplaySpec - displayString=[${displayString}]`);
                    if (displayString !== undefined) {
                        // have name
                        newChannelSpec.name = displayString;
                        // have name, now process rest of channel spec
                        //  ensure we have one more value (nbr-bits) and lineParts[++index] is decimal number
                        if (index < lineParts.length - 1 && /^[0-9]+$/.test(lineParts[index + 1])) {
                            // if have nbrBits, grab it
                            newChannelSpec.nbrBits = Number(lineParts[++index]);
                            if (index < lineParts.length - 1 && lineParts[index + 1].includes("'") == false) {
                                // if have color, grab it
                                var colorOrColorName = lineParts[++index];
                                // if color is a number, then it is a rgb24 value
                                // NOTE number could be decimal or $ prefixed hex  ($rrggbb) and either could have '_' digit separaters
                                var _a = this.getValidRgb24(colorOrColorName), isValidRgb24 = _a[0], colorHexRgb24 = _a[1];
                                console.log("CL: LogicDisplaySpec - colorOrColorName: [".concat(colorOrColorName, "], isValidRgb24=(").concat(isValidRgb24, ")"));
                                if (isValidRgb24) {
                                    // color is a number and is converted to #rrbbgg string
                                    newChannelSpec.color = colorHexRgb24;
                                }
                                else {
                                    // color is a name, so grab possible brightness
                                    var brightness = 8; // default brightness
                                    if (index < lineParts.length - 1) {
                                        // let's ensure lineParts[++index] is a string of decimal digits or hex digits (hex prefix is $)
                                        var brightnessStr = lineParts[++index].replace(/_/g, '');
                                        if (brightnessStr.startsWith('$') && /^[0-9A-Fa-f]+$/.test(brightnessStr.substring(1))) {
                                            brightness = parseInt(brightnessStr.substring(1), 16);
                                        }
                                        else if (/^[0-9]+$/.test(brightnessStr)) {
                                            brightness = parseInt(brightnessStr, 10);
                                        }
                                        else {
                                            index--; // back up to allow reprocess of this... (not part of color spec!)
                                        }
                                    }
                                    var channelColor = new debugColor_1.DebugColor(colorOrColorName, brightness);
                                    newChannelSpec.color = channelColor.rgbString;
                                }
                            }
                        }
                        //console.log(`CL: LogicDisplaySpec - add channelSpec: ${JSON.stringify(newChannelSpec, null, 2)}`);
                        displaySpec.channelSpecs.push(newChannelSpec);
                    }
                    else {
                        console.log("CL: LogicDisplaySpec: missing closing quote for Channel name [".concat(lineParts.join(' '), "]"));
                    }
                    console.log("CL: LogicDisplaySpec - ending at [".concat(lineParts[index], "] of lineParts[").concat(index, "]"));
                }
                else {
                    // Try to parse common keywords first
                    var _b = displaySpecParser_1.DisplaySpecParser.parseCommonKeywords(lineParts, index, displaySpec), parsed = _b[0], consumed = _b[1];
                    if (parsed) {
                        index = index + consumed - 1; // Adjust for loop increment
                        // Special handling for TEXTSIZE
                        if (element.toUpperCase() === 'TEXTSIZE') {
                            DebugLogicWindow.calcMetricsForFontPtSize(displaySpec.textSize, displaySpec.font);
                        }
                        // Special handling for TITLE - copy title to windowTitle
                        if (element.toUpperCase() === 'TITLE' && displaySpec.title) {
                            displaySpec.windowTitle = displaySpec.title;
                        }
                        continue; // Skip to next iteration after successful parse
                    }
                    else {
                        switch (element.toUpperCase()) {
                            case 'COLOR':
                                // Parse COLOR directive: COLOR <background> {<grid-color>}
                                var _c = displaySpecParser_1.DisplaySpecParser.parseColorKeyword(lineParts, index), colorParsed = _c[0], colors = _c[1], colorIndex = _c[2];
                                if (colorParsed) {
                                    displaySpec.window.background = colors.background;
                                    if (colors.grid) {
                                        displaySpec.window.grid = colors.grid;
                                    }
                                    index = colorIndex - 1; // Adjust for loop increment
                                }
                                else {
                                    console.log("CL: LogicDisplaySpec: Invalid COLOR specification");
                                    isValid = false;
                                }
                                break;
                            // ORIGINAL PARSING COMMENTED OUT - Using DisplaySpecParser instead
                            /*
                            case 'TITLE':
                              // ensure we have one more value
                              if (index < lineParts.length - 1) {
                                displaySpec.windowTitle = lineParts[++index];
                              } else {
                                // console.log() as we are in class static method, not derived class...
                                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                                isValid = false;
                              }
                              break;
                            case 'POS':
                              // ensure we have two more values
                              if (index < lineParts.length - 2) {
                                displaySpec.position.x = Number(lineParts[++index]);
                                displaySpec.position.y = Number(lineParts[++index]);
                              } else {
                                console.log(`CL: LogicDisplaySpec: Missing parameter(s) for ${element}`);
                                isValid = false;
                              }
                              break;
                            case 'SAMPLES':
                              // ensure we have one more value
                              if (index < lineParts.length - 1) {
                                displaySpec.nbrSamples = Number(lineParts[++index]);
                              } else {
                                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                                isValid = false;
                              }
                              break;
                            */
                            case 'SPACING':
                                // ensure we have one more value
                                if (index < lineParts.length - 1) {
                                    displaySpec.spacing = Number(lineParts[++index]); // FIX: was incorrectly assigning to nbrSamples
                                    // Validate spacing range
                                    if (displaySpec.spacing < 1 || displaySpec.spacing > 32) {
                                        console.log("CL: LogicDisplaySpec: SPACING value ".concat(displaySpec.spacing, " out of range (1-32)"));
                                        displaySpec.spacing = Math.max(1, Math.min(32, displaySpec.spacing));
                                    }
                                }
                                else {
                                    console.log("CL: LogicDisplaySpec: Missing parameter for ".concat(element));
                                    isValid = false;
                                }
                                break;
                            // ORIGINAL PARSING COMMENTED OUT - Using DisplaySpecParser instead
                            /*
                            case 'LINESIZE':
                              // ensure we have one more value
                              if (index < lineParts.length - 1) {
                                displaySpec.lineSize = Number(lineParts[++index]);
                              } else {
                                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                                isValid = false;
                              }
                              break;
                            case 'TEXTSIZE':
                              // ensure we have one more value
                              if (index < lineParts.length - 1) {
                                displaySpec.textSize = Number(lineParts[++index]);
                                DebugLogicWindow.calcMetricsForFontPtSize(displaySpec.textSize, displaySpec.font);
                              } else {
                                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                                isValid = false;
                              }
                            */
                            // FIXME: UNDONE handle packedDataMode
                            case 'HIDEXY':
                                // just set it!
                                displaySpec.hideXY = true;
                                break;
                            default:
                                console.log("CL: LogicDisplaySpec: Unknown directive: ".concat(element));
                                isValid = false;
                                break;
                        }
                    }
                }
                if (!isValid) {
                    break;
                }
            }
        }
        console.log("CL: at end of parseLogicDeclaration(): isValid=(".concat(isValid, "), ").concat(JSON.stringify(displaySpec, null, 2)));
        return [isValid, displaySpec];
    };
    DebugLogicWindow.prototype.createDebugWindow = function () {
        var _this = this;
        this.logMessage("at createDebugWindow() LOGIC");
        // calculate overall canvas sizes then window size from them!
        if (this.displaySpec.channelSpecs.length == 0) {
            // error if NO channel
            this.logMessage("at createDebugWindow() LOGIC with NO channels!");
        }
        var canvasHeight = this.displaySpec.font.lineHeight;
        var labelMaxChars = 0;
        var activeBitChannels = 0;
        var channelBase = 0;
        for (var index = 0; index < this.displaySpec.channelSpecs.length; index++) {
            var channelSpec = this.displaySpec.channelSpecs[index];
            var bitsInGroup = channelSpec.nbrBits;
            var groupColor = channelSpec.color;
            labelMaxChars = Math.max(labelMaxChars, channelSpec.name.length + 2); // add 2 for ' N' suffix
            for (var activeIdx = 0; activeIdx < bitsInGroup; activeIdx++) {
                var bitIdx = activeBitChannels + activeIdx;
                var chanLabel = void 0;
                if (bitsInGroup == 1) {
                    chanLabel = "".concat(channelSpec.name);
                }
                else {
                    if (activeIdx == 0) {
                        chanLabel = "".concat(channelSpec.name, " ").concat(activeIdx); // name w/bit number suffix
                    }
                    else {
                        chanLabel = "".concat(activeIdx); // just bit number
                    }
                }
                // fill in our channel bit spec
                var newSpec = {};
                newSpec.name = chanLabel;
                newSpec.color = groupColor;
                newSpec.chanNbr = bitIdx;
                newSpec.height = canvasHeight;
                newSpec.base = channelBase;
                // and update to next base
                channelBase += canvasHeight;
                // record the new bit spec
                this.channelBitSpecs.push(newSpec);
            }
            activeBitChannels += bitsInGroup;
        }
        this.logMessage("at createDebugWindow() LOGIC with ".concat(activeBitChannels, " active bit channels: [").concat(JSON.stringify(this.channelBitSpecs, null, 2), "]"));
        this.singleBitChannelCount = activeBitChannels;
        var labelDivs = [];
        var dataCanvases = [];
        var labelCanvasWidth = this.contentInset + labelMaxChars * (this.displaySpec.font.charWidth - 2);
        var dataCanvasWidth = this.displaySpec.nbrSamples * this.displaySpec.spacing + this.contentInset; // contentInset' for the Xoffset into window for canvas
        var channelGroupHeight = canvasHeight * activeBitChannels;
        var channelGroupWidth = labelCanvasWidth + dataCanvasWidth;
        // pass to other users
        this.labelHeight = canvasHeight;
        this.labelWidth = labelCanvasWidth;
        for (var index = 0; index < activeBitChannels; index++) {
            var idNbr = activeBitChannels - index - 1;
            labelDivs.push("<div id=\"label-".concat(idNbr, "\" width=\"").concat(labelCanvasWidth, "\" height=\"").concat(canvasHeight, "\"></div>"));
            dataCanvases.push("<canvas id=\"data-".concat(idNbr, "\" width=\"").concat(dataCanvasWidth, "\" height=\"").concat(canvasHeight, "\"></canvas>"));
        }
        // set height so NO scroller by default
        var windowHeight = channelGroupHeight + 2 + this.canvasMargin * 2; // 2 is fudge to remove scroller;
        var windowWidth = channelGroupWidth + this.contentInset * 2 + this.canvasMargin * 1; // 1 = no left margin!
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
            var position = windowPlacer.getNextPosition("logic-".concat(this.displaySpec.displayName), placementConfig);
            windowX = position.x;
            windowY = position.y;
            this.logMessage("  -- LOGIC using auto-placement: ".concat(windowX, ",").concat(windowY));
        }
        this.logMessage("  -- LOGIC window size: ".concat(windowWidth, "x").concat(windowHeight, " @").concat(windowX, ",").concat(windowY));
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
            windowPlacer.registerWindow("logic-".concat(this.displaySpec.displayName), this.debugWindow);
        }
        // hook window events before being shown
        this.debugWindow.on('ready-to-show', function () {
            var _a;
            _this.logMessage('* Logic window will show...');
            (_a = _this.debugWindow) === null || _a === void 0 ? void 0 : _a.show();
        });
        this.debugWindow.on('show', function () {
            _this.logMessage('* Logic window shown');
        });
        this.debugWindow.on('page-title-updated', function () {
            _this.logMessage('* Logic window title updated');
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
        var htmlContent = "\n    <html>\n      <head>\n        <meta charset=\"UTF-8\"></meta>\n        <title>".concat(displayName, "</title>\n        <style>\n          @font-face {\n            font-family: 'Parallax';\n            src: url('").concat(this.getParallaxFontUrl(), "') format('truetype');\n          }\n          body {\n            display: flex;\n            flex-direction: column;\n            margin: 0;\n            padding: 0;\n            font-family: 'Parallax', sans-serif;\n            font-size: 12px;\n            //background-color:rgb(234, 121, 86);\n            background-color: ").concat(this.displaySpec.window.background, ";\n            color:rgb(191, 213, 93);\n            overflow: hidden; /* CRITICAL: Prevent scrollbars */\n          }\n          #labels {\n            display: flex;\n            flex-direction: column; /* Arrange children in a column */\n            flex-grow: 0;\n            //background-color:rgb(86, 234, 234);\n            background-color: ").concat(this.displaySpec.window.background, ";\n            font-family: 'Parallax', sans-serif;\n            font-style: italic;\n            font-size: 12px;\n            width: ").concat(labelCanvasWidth, "px;\n            border-style: solid;\n            border-width: 1px;\n            border-color: ").concat(this.displaySpec.window.background, ";\n            padding: 0px;\n            margin: 0px;\n          }\n          #labels > div {\n            flex-grow: 0;\n            display: flex;\n            justify-content: flex-end; /* Horizontally right-aligns the text */\n            align-items: center; /* Vertically center the text */\n            //background-color:rgba(188, 208, 208, 0.9);\n            height: ").concat(canvasHeight, "px;\n            // padding: top right bottom left;\n            padding: 0px 2px 0px 0px;\n            margin: 0px;\n          }\n          #labels > div > p {\n            // padding: top right bottom left;\n            padding: 0px;\n            margin: 0px;\n          }\n          #data {\n            display: flex;\n            flex-direction: column; /* Arrange children in a column */\n            flex-grow: 0;\n            width: ").concat(dataCanvasWidth, "px;\n            border-style: solid;\n            border-width: 1px;\n            border-color: ").concat(this.displaySpec.window.grid, ";\n            //background-color:rgb(96, 234, 86);\n            background-color: ").concat(this.displaySpec.window.background, ";\n          }\n          #container {\n            display: flex;\n            flex-direction: row; /* Arrange children in a row */\n            flex-grow: 0;\n            padding: top right bottom left;\n            padding: ").concat(this.canvasMargin, "px ").concat(this.canvasMargin, "px ").concat(this.canvasMargin, "px 0px;\n          }\n          #label-2 {\n            //background-color:rgb(231, 151, 240);\n          }\n          #data-2 {\n            //background-color:rgb(240, 194, 151);\n          }\n          canvas {\n            //background-color:rgb(240, 194, 151);\n            //background-color: ").concat(this.displaySpec.window.background, ";\n            margin: 0;\n          }\n          #trigger-status {\n            position: absolute;\n            top: 5px;\n            right: 5px;\n            padding: 3px 8px;\n            background-color: rgba(0, 0, 0, 0.7);\n            color: white;\n            font-size: 10px;\n            font-family: Arial, sans-serif;\n            border-radius: 3px;\n            display: none; /* Hidden by default, shown when trigger is enabled */\n          }\n          #trigger-status.armed {\n            background-color: rgba(255, 165, 0, 0.8); /* Orange for armed */\n          }\n          #trigger-status.triggered {\n            background-color: rgba(0, 255, 0, 0.8); /* Green for triggered */\n          }\n          #trigger-position {\n            position: absolute;\n            width: 2px;\n            background-color: rgba(255, 0, 0, 0.8); /* Red trigger line */\n            height: ").concat(channelGroupHeight, "px;\n            pointer-events: none;\n            display: none; /* Hidden by default */\n            top: ").concat(this.canvasMargin, "px;\n            box-shadow: 0 0 4px rgba(255, 0, 0, 0.6); /* Add glow effect */\n            z-index: 10; /* Ensure it's above canvas elements */\n          }\n          @keyframes pulse {\n            0% { opacity: 0.8; transform: scaleX(1); }\n            50% { opacity: 1; transform: scaleX(1.5); }\n            100% { opacity: 0.8; transform: scaleX(1); }\n          }\n          #coordinate-display {\n            position: absolute;\n            padding: 2px 4px;\n            background-color: ").concat(this.displaySpec.window.background, ";\n            color: ").concat(this.displaySpec.window.grid, ";\n            border: 1px solid ").concat(this.displaySpec.window.grid, ";\n            font-family: 'Parallax', monospace;\n            font-size: 11px;\n            font-style: normal;\n            pointer-events: none;\n            display: none;\n            z-index: 20;\n            white-space: nowrap;\n          }\n          #crosshair-horizontal, #crosshair-vertical {\n            position: absolute;\n            background-color: ").concat(this.displaySpec.window.grid, ";\n            opacity: 0.5;\n            pointer-events: none;\n            display: none;\n            z-index: 15;\n          }\n          #crosshair-horizontal {\n            height: 1px;\n            width: 100%;\n            left: 0;\n          }\n          #crosshair-vertical {\n            width: 1px;\n            height: 100%;\n            top: 0;\n          }\n        </style>\n      </head>\n      <body>\n        <div id=\"trigger-status\">READY</div>\n        <div id=\"coordinate-display\"></div>\n        <div id=\"crosshair-horizontal\"></div>\n        <div id=\"crosshair-vertical\"></div>\n        <div id=\"container\">\n          <div id=\"labels\" width=\"").concat(labelCanvasWidth, "\" height=\"").concat(channelGroupHeight, "\">\n            ").concat(labelDivs.join('\n'), "\n          </div>\n          <div id=\"data\" width=\"").concat(dataCanvasWidth, "\" height=\"").concat(channelGroupHeight, "\">\n            ").concat(dataCanvases.join('\n'), "\n            <div id=\"trigger-position\"></div>\n          </div>\n        </div>\n      </body>\n    </html>\n  ");
        this.logMessage("at createDebugWindow() LOGIC with htmlContent: ".concat(htmlContent));
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
            // let's populate labels
            _this.loadLables();
        });
    };
    DebugLogicWindow.prototype.loadLables = function () {
        // create labels for each channel and post it to the window
        for (var bitIdx = 0; bitIdx < this.channelBitSpecs.length; bitIdx++) {
            var channelBitSpec = this.channelBitSpecs[bitIdx];
            var canvasName = "label-".concat(bitIdx);
            //  set labels
            this.updateLogicChannelLabel(canvasName, channelBitSpec.name, channelBitSpec.color);
        }
    };
    DebugLogicWindow.prototype.updateTriggerStatus = function () {
        if (this.debugWindow && this.triggerSpec.trigEnabled) {
            var statusText = 'READY';
            var statusClass = '';
            if (this.holdoffCounter > 0) {
                statusText = "HOLDOFF (".concat(this.holdoffCounter, ")");
                statusClass = 'triggered';
            }
            else if (this.triggerFired) {
                statusText = 'TRIGGERED';
                statusClass = 'triggered';
            }
            else if (this.triggerArmed) {
                statusText = 'ARMED';
                statusClass = 'armed';
            }
            // Also show trigger mask/match values for debugging
            var triggerInfo = "M:".concat(this.triggerSpec.trigMask.toString(2).padStart(8, '0'), " T:").concat(this.triggerSpec.trigMatch.toString(2).padStart(8, '0'));
            this.debugWindow.webContents.executeJavaScript("\n        (function() {\n          const statusEl = document.getElementById('trigger-status');\n          if (statusEl) {\n            statusEl.innerHTML = '".concat(statusText, "<br><span style=\"font-size: 8px;\">").concat(triggerInfo, "</span>';\n            statusEl.className = 'trigger-status ").concat(statusClass, "'.trim();\n            statusEl.style.display = 'block';\n          }\n        })();\n      "));
        }
        else if (this.debugWindow) {
            // Hide trigger status when trigger is disabled
            this.debugWindow.webContents.executeJavaScript("\n        (function() {\n          const statusEl = document.getElementById('trigger-status');\n          const posEl = document.getElementById('trigger-position');\n          if (statusEl) statusEl.style.display = 'none';\n          if (posEl) posEl.style.display = 'none';\n        })();\n      ");
        }
    };
    DebugLogicWindow.prototype.updateTriggerPosition = function () {
        var _a;
        if (this.debugWindow && this.triggerSpec.trigEnabled && this.triggerFired) {
            // Calculate the actual trigger position based on current sample position
            // The trigger fired at the current sample minus the offset
            var currentSamplePos = ((_a = this.channelSamples[0]) === null || _a === void 0 ? void 0 : _a.samples.length) || 0;
            var triggerSamplePos = Math.max(0, currentSamplePos - this.triggerSpec.trigSampOffset);
            var triggerXPos = triggerSamplePos * this.displaySpec.spacing;
            this.debugWindow.webContents.executeJavaScript("\n        (function() {\n          const posEl = document.getElementById('trigger-position');\n          if (posEl) {\n            posEl.style.left = '".concat(triggerXPos, "px';\n            posEl.style.display = 'block';\n            // Add pulsing animation when first triggered\n            posEl.style.animation = 'pulse 0.5s ease-in-out 2';\n            // Clear animation after it completes\n            setTimeout(() => {\n              posEl.style.animation = '';\n            }, 1000);\n          }\n        })();\n      "));
        }
    };
    DebugLogicWindow.prototype.closeDebugWindow = function () {
        this.logMessage("at closeDebugWindow() LOGIC");
        // let our base class do the work
        this.debugWindow = null;
    };
    DebugLogicWindow.prototype.processMessageImmediate = function (lineParts) {
        // Handle async internally
        this.processMessageAsync(lineParts);
    };
    DebugLogicWindow.prototype.processMessageAsync = function (lineParts) {
        return __awaiter(this, void 0, void 0, function () {
            var index, _a, isValidMask, mask, _b, isValidMatch, match, _c, isValidOffset, offsetInSamples, _d, isValidNumber, holdoff, saveFileName, keywords, tempIndex, _e, isPackedData, _, keyword, _f, isValidNumber, numericValue, scopeSamples, index_1, sample;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        // here with lineParts = ['`{displayName}, ...]
                        // ----------------------------------------------------------------
                        // Valid directives are:
                        // --- these update the trigger spec
                        //   TRIGGER <channel|-1> {arm-level {trigger-level {offset}}} HOLDOFF <2-2048>
                        //   HOLDOFF <2-2048>
                        // --- these manage the window
                        //   CLEAR
                        //   CLOSE
                        //   SAVE {WINDOW} 'filename' // save window to .bmp file
                        // --- these paints new samples
                        //   <numeric data> // data applied to channels in ascending order
                        // ----------------------------------------------------------------
                        this.logMessage("at updateContent(".concat(lineParts.join(' '), ")"));
                        if (!(lineParts.length >= 2)) return [3 /*break*/, 11];
                        index = 1;
                        _g.label = 1;
                    case 1:
                        if (!(index < lineParts.length)) return [3 /*break*/, 11];
                        this.logMessage("  -- at [".concat(lineParts[index], "] in lineParts[").concat(index, "]"));
                        if (!(lineParts[index].toUpperCase() == 'TRIGGER')) return [3 /*break*/, 2];
                        // parse trigger spec update
                        //   TRIGGER1 mask2 match3 {sample_offset4}
                        this.triggerSpec.trigEnabled = true;
                        // Arm the trigger when enabled
                        this.triggerArmed = true;
                        this.triggerFired = false;
                        this.holdoffCounter = 0;
                        // Update trigger status when first enabled
                        if (this.debugWindow) {
                            this.updateTriggerStatus();
                        }
                        // ensure we have at least two more values
                        if (index + 1 < lineParts.length - 1) {
                            _a = this.isSpinNumber(lineParts[index + 1]), isValidMask = _a[0], mask = _a[1];
                            if (isValidMask) {
                                index++; // show we consumed the mask value
                            }
                            _b = this.isSpinNumber(lineParts[index + 1]), isValidMatch = _b[0], match = _b[1];
                            if (isValidMatch) {
                                index++; // show we consumed the match value
                            }
                            if (isValidMask && isValidMatch) {
                                this.triggerSpec.trigMask = mask ? mask : 0;
                                this.triggerSpec.trigMatch = match ? match : 1;
                                if (index + 1 < lineParts.length) {
                                    _c = this.isSpinNumber(lineParts[index + 1]), isValidOffset = _c[0], offsetInSamples = _c[1];
                                    if (isValidOffset) {
                                        if (offsetInSamples >= 0 && offsetInSamples < this.displaySpec.nbrSamples) {
                                            this.triggerSpec.trigSampOffset = offsetInSamples;
                                        }
                                        index++; // show we consumed the offset value
                                    }
                                }
                            }
                            else {
                                this.logMessage("at updateContent() with invalid mask or match in [".concat(lineParts.join(' '), "]"));
                            }
                        }
                        this.logMessage("at updateContent() with triggerSpec: ".concat(JSON.stringify(this.triggerSpec, null, 2)));
                        return [3 /*break*/, 10];
                    case 2:
                        if (!(lineParts[index].toUpperCase() == 'HOLDOFF')) return [3 /*break*/, 3];
                        // parse trigger spec update
                        //   HOLDOFF1 <2-2048>2
                        if (lineParts.length > 2) {
                            _d = this.isSpinNumber(lineParts[index + 1]), isValidNumber = _d[0], holdoff = _d[1];
                            if (isValidNumber) {
                                this.triggerSpec.trigHoldoff = holdoff;
                                index++; // show we consumed the holdoff value
                            }
                        }
                        else {
                            this.logMessage("at updateContent() with invalid HOLDOFF @[".concat(index + 1, "] in [").concat(lineParts.join(' '), "]"));
                        }
                        this.logMessage("at updateContent() with updated trigger-holdoffSpec: ".concat(JSON.stringify(this.triggerSpec, null, 2)));
                        return [3 /*break*/, 10];
                    case 3:
                        if (!(lineParts[index].toUpperCase() == 'CLEAR')) return [3 /*break*/, 4];
                        // clear all channels
                        this.clearChannelData();
                        return [3 /*break*/, 10];
                    case 4:
                        if (!(lineParts[index].toUpperCase() == 'CLOSE')) return [3 /*break*/, 5];
                        // close the window
                        this.closeDebugWindow();
                        return [3 /*break*/, 10];
                    case 5:
                        if (!(lineParts[index].toUpperCase() == 'SAVE')) return [3 /*break*/, 9];
                        if (!(index + 1 < lineParts.length)) return [3 /*break*/, 7];
                        saveFileName = this.removeStringQuotes(lineParts[++index]);
                        // save the window to a file (as BMP)
                        return [4 /*yield*/, this.saveWindowToBMPFilename(saveFileName)];
                    case 6:
                        // save the window to a file (as BMP)
                        _g.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        this.logMessage("at updateContent() missing SAVE fileName in [".concat(lineParts.join(' '), "]"));
                        _g.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        if (lineParts[index].toUpperCase() == 'PC_KEY') {
                            // Enable keyboard input forwarding
                            this.enableKeyboardInput();
                            // PC_KEY must be last command
                            return [3 /*break*/, 11];
                        }
                        else if (lineParts[index].toUpperCase() == 'PC_MOUSE') {
                            // Enable mouse input forwarding
                            this.enableMouseInput();
                            // PC_MOUSE must be last command
                            return [3 /*break*/, 11];
                        }
                        else {
                            keywords = [];
                            tempIndex = index;
                            _e = packedDataProcessor_1.PackedDataProcessor.validatePackedMode(lineParts[tempIndex]), isPackedData = _e[0], _ = _e[1];
                            if (isPackedData) {
                                // Collect the mode and any following ALT/SIGNED keywords
                                keywords.push(lineParts[tempIndex]);
                                tempIndex++;
                                // Look for ALT and SIGNED keywords
                                while (tempIndex < lineParts.length) {
                                    keyword = lineParts[tempIndex].toUpperCase();
                                    if (keyword === 'ALT' || keyword === 'SIGNED') {
                                        keywords.push(keyword);
                                        tempIndex++;
                                    }
                                    else {
                                        break;
                                    }
                                }
                                // Parse all keywords together
                                this.packedMode = packedDataProcessor_1.PackedDataProcessor.parsePackedModeKeywords(keywords);
                                // Update index to skip processed keywords
                                index = tempIndex - 1;
                            }
                            else {
                                _f = this.isSpinNumber(lineParts[index]), isValidNumber = _f[0], numericValue = _f[1];
                                if (isValidNumber) {
                                    if (this.isFirstNumericData) {
                                        this.isFirstNumericData = false;
                                        // Window already created in constructor, just log the packed data spec
                                        this.logMessage("* UPD-INFO working with packed-data-spec: ".concat(JSON.stringify(this.packedMode, null, 2)));
                                    }
                                    scopeSamples = packedDataProcessor_1.PackedDataProcessor.unpackSamples(numericValue, this.packedMode);
                                    for (index_1 = 0; index_1 < scopeSamples.length; index_1++) {
                                        sample = scopeSamples[index_1];
                                        this.recordSampleToChannels(sample);
                                    }
                                }
                                else {
                                    this.logMessage("* UPD-ERROR  unknown directive: ".concat(lineParts[1], " of [").concat(lineParts.join(' '), "]"));
                                }
                            }
                        }
                        _g.label = 10;
                    case 10:
                        index++;
                        return [3 /*break*/, 1];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    DebugLogicWindow.prototype.recordSampleToChannels = function (sample) {
        var _a;
        // we have a single sample value than has a bit for each channel
        //  isolate the bits for each channel and update each channel
        var nbrBitsInSample = this.channelBitSpecs.length;
        this.logMessage("at recordSampleToChannels(0b".concat(sample.toString(2).padStart(nbrBitsInSample, '0'), ") w/").concat(this.channelBitSpecs.length, " channels"));
        // Handle trigger evaluation if enabled
        if (this.triggerSpec.trigEnabled) {
            // Use trigger processor to evaluate the trigger condition
            var triggerMet = this.triggerProcessor.evaluateTriggerCondition(sample, this.triggerSpec);
            // Update trigger state
            if (this.triggerArmed && !this.triggerFired) {
                // Already armed, check if we should fire
                if (triggerMet) {
                    // Trigger fired!
                    this.triggerFired = true;
                    this.holdoffCounter = this.triggerSpec.trigHoldoff;
                    this.triggerProcessor.updateTriggerState(true, true);
                    // Remember which sample triggered (accounting for offset)
                    this.triggerSampleIndex = (((_a = this.channelSamples[0]) === null || _a === void 0 ? void 0 : _a.samples.length) || 0) - this.triggerSpec.trigSampOffset;
                    this.updateTriggerStatus();
                    this.updateTriggerPosition();
                }
            }
            // Handle holdoff countdown
            if (this.holdoffCounter > 0) {
                this.holdoffCounter--;
                this.updateTriggerStatus(); // Update to show holdoff countdown
                if (this.holdoffCounter === 0) {
                    // Holdoff expired, reset trigger
                    this.triggerArmed = false;
                    this.triggerFired = false;
                    this.triggerSampleIndex = -1;
                    this.triggerProcessor.resetTrigger();
                    this.updateTriggerStatus();
                }
            }
            // Only update display if no trigger enabled or trigger conditions met
            if (!this.triggerArmed || this.triggerFired) {
                // Proceed with normal sample recording
            }
            else {
                // Trigger enabled but not fired yet, skip this sample
                return;
            }
        }
        var numberOfChannels = this.singleBitChannelCount;
        for (var channelIdx = 0; channelIdx < numberOfChannels; channelIdx++) {
            // create canvas name for channel
            var canvasName = "data-".concat(channelIdx);
            // isolate bit from sample for this channel
            var bitValue = (sample >> channelIdx) & 1;
            // record the sample for this channel
            var didScroll = this.recordChannelSample(channelIdx, bitValue);
            // update the channel display
            //this.logMessage(`* UPD-INFO recorded (${bitValue}) for ${canvasName}`);
            var channelSpec = this.channelBitSpecs[channelIdx];
            this.updateLogicChannelData(canvasName, channelSpec, this.channelSamples[channelIdx].samples, didScroll);
        }
    };
    DebugLogicWindow.prototype.calculateAutoTriggerAndScale = function () {
        // FIXME: UNDONE check if auto is set, if is then calculate the trigger level and scale
        this.logMessage("at calculateAutoTriggerAndScale()");
        if (false) {
            // calculate:
            // 1. arm level at 33%
            // 2. trigger level 50%
            // 3. ...
            // 4. set the scale to the max - min
        }
    };
    DebugLogicWindow.prototype.initChannelSamples = function () {
        this.logMessage("at initChannelSamples()");
        // clear the channel data
        this.channelSamples = [];
        if (this.channelBitSpecs.length == 0) {
            this.channelSamples.push({ samples: [] });
        }
        else {
            for (var index = 0; index < this.channelBitSpecs.length; index++) {
                this.channelSamples.push({ samples: [] });
            }
        }
        this.logMessage("  -- [".concat(JSON.stringify(this.channelSamples, null, 2), "]"));
    };
    DebugLogicWindow.prototype.clearChannelData = function () {
        this.logMessage("at clearChannelData()");
        for (var index = 0; index < this.channelBitSpecs.length; index++) {
            var channelSamples = this.channelSamples[index];
            // clear the channel data
            channelSamples.samples = [];
        }
    };
    DebugLogicWindow.prototype.recordChannelSample = function (channelIndex, sample) {
        //this.logMessage(`at recordChannelSample(${channelIndex}, ${sample})`);
        var didScroll = false;
        if (channelIndex >= 0 && channelIndex < this.channelBitSpecs.length) {
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
    DebugLogicWindow.prototype.updateLogicChannelData = function (canvasName, channelSpec, samples, didScroll) {
        if (this.debugWindow) {
            if (this.dbgUpdateCount > 0) {
                // DISABLE RUN FOREVER this.dbgUpdateCount--;
            }
            if (this.dbgUpdateCount == 0) {
                return;
            }
            // if (--this.dbgLogMessageCount > 0) {
            if (this.dbgLogMessageCount > 0) {
                this.logMessage("at updateLogicChannelData(".concat(canvasName, ", w/#").concat(samples.length, ") sample(s), didScroll=(").concat(didScroll, ")"));
            }
            var canvasWidth = this.displaySpec.nbrSamples * this.displaySpec.spacing;
            var canvasHeight = this.displaySpec.font.lineHeight;
            var drawWidth = canvasWidth;
            var drawHeight = canvasHeight - this.channelVInset * 2;
            // get prior 0,1 and next 0,1
            var currSample = samples[samples.length - 1];
            var prevSample = samples.length > 1 ? samples[samples.length - 2] : 0; // channels start at ZERO value
            var currInvSample = 1 - currSample;
            var prevInvSample = 1 - prevSample;
            var havePrevSample = samples.length > 1;
            // let's leave 2px at top and bottom of canvas (this.channelVInset) draw only in between...
            this.logMessage("  -- currInvSample=".concat(currInvSample, ", prevInvSample=").concat(prevInvSample));
            // offset to sample value
            var currXOffset = (samples.length - 1) * this.displaySpec.spacing;
            var currYOffset = currInvSample * drawHeight + this.channelVInset;
            var prevXOffset = havePrevSample ? (samples.length - 2) * this.displaySpec.spacing : currXOffset;
            var prevYOffset = havePrevSample ? prevInvSample * drawHeight + this.channelVInset : currYOffset;
            //this.logMessage(`  -- prev=[${prevYOffset},${prevXOffset}], curr=[${currYOffset},${currXOffset}]`);
            // draw region for the channel
            var drawXOffset = this.channelVInset;
            var drawYOffset = 0;
            var channelColor = channelSpec.color;
            var spacing = this.displaySpec.spacing;
            if (this.dbgLogMessageCount > 0) {
                this.logMessage("  -- DRAW size=(".concat(drawWidth, ",").concat(drawHeight, "), offset=(").concat(drawYOffset, ",").concat(drawXOffset, ")"));
                this.logMessage("  -- #".concat(samples.length, " currSample=(").concat(currSample, ",#").concat(samples.length, ") @ rc=[").concat(currYOffset, ",").concat(currXOffset, "], prev=[").concat(prevYOffset, ",").concat(prevXOffset, "]"));
            }
            // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
            // try {
            //   this.debugWindow.webContents.executeJavaScript(`
            //     (function() {
            //       // Locate the canvas element by its ID
            //       const canvas = document.getElementById('${canvasName}');
            //
            //       if (canvas && canvas instanceof HTMLCanvasElement) {
            //         // Get the canvas context
            //         const ctx = canvas.getContext('2d');
            //
            //         if (ctx) {
            //           // Set the line color and width
            //           const lineColor = '${channelColor}';
            //           const lineWidth = ${this.displaySpec.lineSize};
            //           const spacing = ${this.displaySpec.spacing};
            //           const scrollSpeed = lineWidth + spacing;
            //           const canvWidth = ${canvasWidth};
            //           const canvHeight = ${canvasHeight};
            //           const canvXOffset = ${drawXOffset};
            //           const canvYOffset = ${drawYOffset};
            //
            //           if (${didScroll}) {
            //             // Create an off-screen canvas
            //             const offScreenCanvas = document.createElement('canvas');
            //             offScreenCanvas.width = canvWidth - scrollSpeed;
            //             offScreenCanvas.height = canvHeight;
            //             const offScreenCtx = offScreenCanvas.getContext('2d');
            //
            //             if (offScreenCtx) {
            //               // Copy the relevant part of the canvas to the off-screen canvas
            //               //  drawImage(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
            //               offScreenCtx.drawImage(canvas, scrollSpeed + canvXOffset, canvYOffset, canvWidth - scrollSpeed, canvHeight, 0, 0, canvWidth - scrollSpeed, canvHeight);
            //
            //               // Clear the original canvas
            //               //  clearRect(x, y, width, height)
            //               //ctx.clearRect(canvXOffset, canvYOffset, canvWidth, canvHeight);
            //               // fix? artifact!! (maybe line-width caused?!!!)
            //               ctx.clearRect(canvXOffset-2, canvYOffset, canvWidth+2, canvHeight);
            //
            //               // Copy the content back to the original canvas
            //               //  drawImage(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
            //               ctx.drawImage(offScreenCanvas, 0, 0, canvWidth - scrollSpeed, canvHeight, canvXOffset, canvYOffset, canvWidth - scrollSpeed, canvHeight);
            //             }
            //           }
            //
            //           // Set the solid line pattern
            //           ctx.setLineDash([]); // Empty array for solid line
            //
            //           // Draw the new line segment
            //           ctx.strokeStyle = lineColor;
            //           ctx.lineWidth = lineWidth;
            //           ctx.beginPath();
            //           ctx.moveTo(${prevXOffset}+${spacing}-1, ${prevYOffset});
            //           ctx.lineTo(${currXOffset}, ${currYOffset});
            //           ctx.lineTo(${currXOffset}+${spacing}-1, ${currYOffset});
            //           ctx.stroke();
            //         }
            //       }
            //     })();
            //   `);
            try {
                var jsCode = '';
                // Handle scrolling if needed
                if (didScroll) {
                    var scrollSpeed = this.displaySpec.lineSize + spacing;
                    jsCode += this.canvasRenderer.scrollCanvas(canvasName, scrollSpeed, canvasWidth, canvasHeight, drawXOffset, drawYOffset);
                }
                // Draw the logic signal lines
                // Check if this is the trigger sample for highlighting
                var isTriggerSample = this.triggerFired &&
                    this.triggerSampleIndex >= 0 &&
                    samples.length - 1 === this.triggerSampleIndex &&
                    channelSpec === this.channelBitSpecs[0]; // Only highlight first channel
                // Use a brighter/different color for the trigger sample
                var lineColor = isTriggerSample ? '#FF0000' : channelColor; // Red for trigger
                var lineWidth = isTriggerSample ? this.displaySpec.lineSize + 1 : this.displaySpec.lineSize;
                // Draw horizontal line from previous position
                jsCode += this.canvasRenderer.drawLine(canvasName, prevXOffset + spacing - 1, prevYOffset, currXOffset, currYOffset, lineColor, lineWidth);
                // Draw horizontal line at current position
                jsCode += this.canvasRenderer.drawLine(canvasName, currXOffset, currYOffset, currXOffset + spacing - 1, currYOffset, lineColor, lineWidth);
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
    DebugLogicWindow.prototype.updateLogicChannelLabel = function (divId, label, color) {
        if (this.debugWindow) {
            this.logMessage("at updateLogicChannelLabel('".concat(divId, "', '").concat(label, "', ").concat(color, ")"));
            try {
                var labelSpan = "<p style=\"color: ".concat(color, ";\">").concat(label, "</p>");
                var jsCode = this.canvasRenderer.updateElementHTML(divId, labelSpan);
                this.debugWindow.webContents.executeJavaScript(jsCode);
            }
            catch (error) {
                console.error("Failed to update ".concat(divId, ": ").concat(error));
            }
        }
    };
    /**
     * Get the canvas element ID for this window
     */
    DebugLogicWindow.prototype.getCanvasId = function () {
        return 'canvas'; // Logic window uses 'canvas' as the ID
    };
    /**
     * Transform mouse coordinates to logic-specific coordinates
     * X: negative sample index from current position
     * Y: channel number
     */
    DebugLogicWindow.prototype.transformMouseCoordinates = function (x, y) {
        // Calculate margins and dimensions
        var marginLeft = this.contentInset + this.labelWidth;
        var marginTop = this.channelVInset;
        var width = this.displaySpec.size.width - this.contentInset - this.labelWidth;
        var height = this.displaySpec.size.height - 2 * this.channelVInset;
        // Check if mouse is within the display area
        if (x >= marginLeft && x < marginLeft + width &&
            y >= marginTop && y < marginTop + height) {
            // Transform to logic coordinates
            // X: negative sample number (samples back from current)
            var sampleX = -Math.floor((marginLeft + width - 1 - x) / this.displaySpec.spacing);
            // Y: channel number (0-based from top)
            var channelY = Math.floor((y - marginTop) / this.displaySpec.font.charHeight);
            return { x: sampleX, y: channelY };
        }
        else {
            // Mouse is outside display area
            return { x: -1, y: -1 };
        }
    };
    /**
     * Get pixel color getter for mouse events
     */
    DebugLogicWindow.prototype.getPixelColorGetter = function () {
        var _this = this;
        return function (x, y) {
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
    DebugLogicWindow.prototype.enableMouseInput = function () {
        // Call base implementation first
        _super.prototype.enableMouseInput.call(this);
        // Add coordinate display functionality
        if (this.debugWindow) {
            var marginLeft = this.contentInset + this.labelWidth;
            var marginTop = this.channelVInset;
            var displayWidth = this.displaySpec.size.width - this.contentInset - this.labelWidth;
            var displayHeight = this.displaySpec.size.height - 2 * this.channelVInset;
            this.debugWindow.webContents.executeJavaScript("\n        (function() {\n          const container = document.getElementById('container');\n          const coordDisplay = document.getElementById('coordinate-display');\n          const crosshairH = document.getElementById('crosshair-horizontal');\n          const crosshairV = document.getElementById('crosshair-vertical');\n          \n          if (container && coordDisplay && crosshairH && crosshairV) {\n            // Track mouse position\n            let lastMouseX = -1;\n            let lastMouseY = -1;\n            \n            container.addEventListener('mousemove', (event) => {\n              const rect = container.getBoundingClientRect();\n              const x = event.clientX - rect.left;\n              const y = event.clientY - rect.top;\n              \n              // Calculate relative position within data area\n              const dataX = x - ".concat(marginLeft, ";\n              const dataY = y - ").concat(marginTop, ";\n              \n              // Check if within display area\n              if (dataX >= 0 && dataX < ").concat(displayWidth, " && \n                  dataY >= 0 && dataY < ").concat(displayHeight, ") {\n                \n                // Calculate logic coordinates\n                const sampleX = -Math.floor((").concat(displayWidth, " - 1 - dataX) / ").concat(this.displaySpec.spacing, ");\n                const channelY = Math.floor(dataY / ").concat(this.displaySpec.font.charHeight, ");\n                \n                // Update coordinate display\n                coordDisplay.textContent = sampleX + ',' + channelY;\n                coordDisplay.style.display = 'block';\n                \n                // Position the display near cursor, avoiding edges\n                const displayRect = coordDisplay.getBoundingClientRect();\n                let displayX = event.clientX + 10;\n                let displayY = event.clientY - displayRect.height - 10;\n                \n                // Adjust if too close to edges\n                if (displayX + displayRect.width > window.innerWidth - 10) {\n                  displayX = event.clientX - displayRect.width - 10;\n                }\n                if (displayY < 10) {\n                  displayY = event.clientY + 10;\n                }\n                \n                coordDisplay.style.left = displayX + 'px';\n                coordDisplay.style.top = displayY + 'px';\n                \n                // Update crosshair position\n                crosshairH.style.display = 'block';\n                crosshairV.style.display = 'block';\n                crosshairH.style.top = event.clientY + 'px';\n                crosshairV.style.left = event.clientX + 'px';\n                \n                lastMouseX = x;\n                lastMouseY = y;\n              } else {\n                // Hide displays when outside data area\n                coordDisplay.style.display = 'none';\n                crosshairH.style.display = 'none';\n                crosshairV.style.display = 'none';\n              }\n            });\n            \n            // Hide displays when mouse leaves container\n            container.addEventListener('mouseleave', () => {\n              coordDisplay.style.display = 'none';\n              crosshairH.style.display = 'none';\n              crosshairV.style.display = 'none';\n            });\n          }\n        })();\n      "));
        }
    };
    return DebugLogicWindow;
}(debugWindowBase_1.DebugWindowBase));
exports.DebugLogicWindow = DebugLogicWindow;
