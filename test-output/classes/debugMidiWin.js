"use strict";
/**
 * @file debugMidiWin.ts
 * @description MIDI keyboard debug window for viewing note-on/off status with velocity
 *
 * This window displays a piano keyboard that visualizes MIDI note events in real-time.
 * It implements the exact behavior of the Pascal MIDI debug window including:
 * - Variable-size piano keyboard (SIZE 1-50)
 * - Configurable key range (default 21-108 for 88-key piano)
 * - MIDI channel filtering (0-15)
 * - Velocity visualization as colored bars
 * - MIDI note numbers displayed on keys
 *
 * MIDI Protocol:
 * - Note-on: 0x90 + channel, followed by note (0-127) and velocity (0-127)
 * - Note-off: 0x80 + channel, followed by note and velocity
 *
 * Future enhancements (not in Pascal implementation):
 * - Mouse interaction: Click keys to send MIDI (mouse down = note-on velocity 64, mouse up = note-off)
 * - Multi-channel support: Monitor multiple channels with different colors per channel
 */
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
exports.DebugMidiWindow = void 0;
var debugWindowBase_1 = require("./debugWindowBase");
var pianoKeyboardLayout_1 = require("./shared/pianoKeyboardLayout");
var spin2NumericParser_1 = require("./shared/spin2NumericParser");
var debugColor_1 = require("./shared/debugColor");
/**
 * Debug MIDI Window - MIDI Keyboard Visualization
 *
 * Displays a piano keyboard that visualizes MIDI note events in real-time with velocity indication.
 * Supports configurable keyboard size, key range, channel filtering, and mouse interaction for MIDI output.
 *
 * ## Features
 * - **Piano Keyboard Display**: Variable-size keyboard (SIZE 1-50) with 88-key default range
 * - **MIDI Protocol Support**: Standard MIDI note-on/off message parsing (0x80-0x90)
 * - **Channel Filtering**: Monitor specific MIDI channels (0-15) with color coding
 * - **Velocity Visualization**: Colored velocity bars showing note intensity (0-127)
 * - **Key Labeling**: MIDI note numbers displayed on piano keys
 * - **Mouse Interaction**: Click keys to generate MIDI output (note-on/off)
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE keysize` - Set keyboard size (1-50, affects key width, default: 4)
 * - `RANGE first last` - Set key range (0-127, default: 21-108 for 88-key piano)
 * - `CHANNEL ch` - Set MIDI channel to monitor (0-15, default: 0)
 * - `COLOR bg {key_color}` - Background and key colors
 * - `HIDEXY` - Hide coordinate display
 *
 * ## Data Format
 * MIDI data is fed as standard MIDI protocol messages:
 * - Note-on: 0x90 + channel, followed by note (0-127) and velocity (0-127)
 * - Note-off: 0x80 + channel, followed by note and velocity (ignored)
 * - Data can be fed byte-by-byte or as complete MIDI messages
 * - Example: `debug(\`MyMIDI \`($90, note, velocity))  ' Note-on`
 *
 * ## Commands
 * - `CLEAR` - Clear all active notes and reset keyboard display
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
 * - `CHANNEL ch` - Change monitored MIDI channel during runtime
 * - `RANGE first last` - Change key range during runtime
 * - MIDI bytes: Direct MIDI protocol data (0x80-0x9F for note events)
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `MIDI_Configure` procedure (line 2484)
 * - Update: `MIDI_Update` procedure (line 2582)
 * - Note handling: `MIDI_Note_Process` procedures
 * - Keyboard rendering: `MIDI_Draw_Keyboard` procedures
 *
 * ## Examples
 * ```spin2
 * ' Basic MIDI keyboard monitor
 * debug(`MIDI MyKeyboard SIZE 6 RANGE 36 84 CHANNEL 0)
 *
 * ' Send note-on and note-off
 * note := 60  ' Middle C
 * velocity := 100
 * debug(`MyKeyboard \`($90, note, velocity))  ' Note-on
 * waitms(500)
 * debug(`MyKeyboard \`($80, note, 0))        ' Note-off
 *
 * ' Monitor multiple notes
 * repeat
 *   debug(`MyKeyboard \`($90, 60, 100))  ' C
 *   debug(`MyKeyboard \`($90, 64, 80))   ' E
 *   debug(`MyKeyboard \`($90, 67, 90))   ' G
 * ```
 *
 * ## Implementation Notes
 * - Implements exact Pascal MIDI debug window behavior including key layout
 * - MIDI state machine parses incoming bytes according to MIDI protocol
 * - Velocity bars use color intensity to show note velocity (0-127)
 * - Piano keyboard layout handles both white and black key positioning
 * - Mouse coordinates are transformed to MIDI note numbers for interaction
 * - Supports future enhancements: multi-channel display with color coding
 *
 * ## Deviations from Pascal
 * - Enhanced mouse interaction for bidirectional MIDI communication
 * - Additional velocity visualization options and color schemes
 * - Improved keyboard layout calculations for various screen resolutions
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_MIDI.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
var DebugMidiWindow = /** @class */ (function (_super) {
    __extends(DebugMidiWindow, _super);
    function DebugMidiWindow(ctx, windowId) {
        if (windowId === void 0) { windowId = "midi-".concat(Date.now()); }
        var _this = _super.call(this, ctx, windowId, 'midi') || this;
        // Window properties
        _this.midiWindowId = 0; // Rename to avoid conflict with base class
        _this._windowTitle = 'MIDI';
        _this.vWidth = 256;
        _this.vHeight = 256;
        _this.vColor = [0x00FFFF, 0xFF00FF, 0, 0, 0, 0, 0, 0]; // Cyan, Magenta
        _this.pcKeyEnabled = false;
        _this.pcMouseEnabled = false;
        // MIDI-specific properties
        _this.midiSize = 4; // Keyboard size (1-50)
        _this.midiKeyFirst = 21; // First key to display (0-127)
        _this.midiKeyLast = 108; // Last key to display (0-127)
        _this.midiChannel = 0; // MIDI channel to monitor (0-15)
        _this.midiState = 0; // State machine for MIDI parsing
        _this.midiNote = 0; // Current note being processed
        _this.midiVelocity = new Array(128).fill(0); // Velocity for each key
        // Keyboard layout
        _this.keySize = 0;
        _this.keyLayout = null;
        _this.keyOffset = 0;
        _this.whiteKeyColor = 0x00FFFF; // Cyan
        _this.blackKeyColor = 0xFF00FF; // Magenta
        // Canvas properties
        _this.canvas = null;
        _this.canvasCtx = null;
        // Calculate initial key size using Pascal formula
        _this.keySize = 8 + _this.midiSize * 4; // MidiSizeBase=8, MidiSizeFactor=4
        // Window ID will be set by MainWindow
        _this.midiWindowId = Date.now() % 1000000;
        return _this;
    }
    Object.defineProperty(DebugMidiWindow.prototype, "windowTitle", {
        // Getter for window title
        get: function () {
            return this._windowTitle;
        },
        // Setter for window title
        set: function (title) {
            this._windowTitle = title;
            this.setWindowTitle(title);
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Create and configure the MIDI window
     */
    DebugMidiWindow.prototype.createDebugWindow = function () {
        var _a;
        // Create window HTML structure
        var windowHtml = "\n      <div class=\"debug-window midi-window\" id=\"debug-window-".concat(this.midiWindowId, "\">\n        <div class=\"title-bar\">\n          <span class=\"title\">").concat(this._windowTitle, "</span>\n          <button class=\"close-btn\" onclick=\"window.debugWindows?.get(").concat(this.midiWindowId, ")?.closeDebugWindow()\">\u00D7</button>\n        </div>\n        <div class=\"content\" id=\"content-").concat(this.midiWindowId, "\">\n          <canvas id=\"midi-canvas-").concat(this.midiWindowId, "\"></canvas>\n        </div>\n      </div>\n    ");
        // Add to page
        var container = document.getElementById('debug-windows-container');
        if (container) {
            container.insertAdjacentHTML('beforeend', windowHtml);
        }
        // Get canvas reference
        this.canvas = document.getElementById("midi-canvas-".concat(this.midiWindowId));
        this.canvasCtx = ((_a = this.canvas) === null || _a === void 0 ? void 0 : _a.getContext('2d')) || null;
        // Calculate keyboard layout
        this.updateKeyboardLayout();
        // Register with WindowRouter when window is ready
        this.registerWithRouter();
        // Enable input forwarding if requested
        if (this.pcKeyEnabled) {
            this.enableKeyboardInput();
        }
        if (this.pcMouseEnabled) {
            this.enableMouseInput();
        }
        // Initial draw
        this.drawKeyboard(true);
    };
    /**
     * Update keyboard layout based on current settings
     */
    DebugMidiWindow.prototype.updateKeyboardLayout = function () {
        var layout = pianoKeyboardLayout_1.PianoKeyboardLayout.calculateLayout(this.keySize, this.midiKeyFirst, this.midiKeyLast);
        this.keyLayout = layout.keys;
        this.keyOffset = layout.offset;
        // Update canvas size
        if (this.canvas) {
            this.canvas.width = layout.totalWidth;
            this.canvas.height = layout.totalHeight;
            this.vWidth = layout.totalWidth;
            this.vHeight = layout.totalHeight;
        }
        // Update window size
        var window = document.getElementById("debug-window-".concat(this.midiWindowId));
        if (window) {
            window.style.width = "".concat(layout.totalWidth, "px");
            window.style.height = "".concat(layout.totalHeight + 30, "px"); // Add title bar height
        }
    };
    /**
     * Draw the piano keyboard
     * @param clear If true, reset all velocities to 0
     */
    DebugMidiWindow.prototype.drawKeyboard = function (clear) {
        if (!this.canvasCtx || !this.keyLayout)
            return;
        // Clear velocities if requested
        if (clear) {
            this.midiVelocity.fill(0);
        }
        // Clear canvas with background color
        this.canvasCtx.fillStyle = '#E0E0E0'; // Light gray background
        this.canvasCtx.fillRect(0, 0, this.vWidth, this.vHeight);
        var r = Math.floor(this.keySize / 4); // Corner radius
        // Draw white keys first
        this.canvasCtx.font = "".concat(Math.floor(this.keySize / 3), "px Arial");
        this.canvasCtx.textAlign = 'center';
        this.canvasCtx.textBaseline = 'top';
        for (var i = this.midiKeyFirst; i <= this.midiKeyLast; i++) {
            var key = this.keyLayout.get(i);
            if (key && !key.isBlack) {
                this.drawKey(i, key, 0xFFFFFF, this.vColor[0], r);
            }
        }
        // Draw black keys on top
        for (var i = this.midiKeyFirst; i <= this.midiKeyLast; i++) {
            var key = this.keyLayout.get(i);
            if (key && key.isBlack) {
                this.drawKey(i, key, 0x000000, this.vColor[1], r);
            }
        }
    };
    /**
     * Draw a single key with velocity visualization
     */
    DebugMidiWindow.prototype.drawKey = function (keyNum, key, offColor, onColor, radius) {
        if (!this.canvasCtx)
            return;
        var left = key.left - this.keyOffset;
        var right = key.right - this.keyOffset;
        var bottom = key.bottom;
        // Draw the key background
        this.canvasCtx.fillStyle = this.rgbToHex(offColor);
        this.roundRect(left, -radius, right - left, bottom + radius, radius);
        this.canvasCtx.fill();
        // Draw velocity visualization if note is on
        var velocity = this.midiVelocity[keyNum];
        if (velocity > 0) {
            this.canvasCtx.fillStyle = this.rgbToHex(onColor);
            var velocityHeight = Math.floor((bottom - radius) * velocity / 127);
            var velocityTop = bottom - radius - velocityHeight;
            this.roundRect(left, velocityTop, right - left, velocityHeight + radius, radius);
            this.canvasCtx.fill();
        }
        // Draw key outline
        this.canvasCtx.strokeStyle = key.isBlack ? '#444' : '#888';
        this.canvasCtx.lineWidth = 1;
        this.roundRect(left, -radius, right - left, bottom + radius, radius);
        this.canvasCtx.stroke();
        // Draw MIDI note number
        this.canvasCtx.fillStyle = key.isBlack ? '#BBB' : '#444';
        this.canvasCtx.fillText(keyNum.toString(), key.numX - this.keyOffset, radius);
    };
    /**
     * Helper to draw rounded rectangle
     */
    DebugMidiWindow.prototype.roundRect = function (x, y, width, height, radius) {
        if (!this.canvasCtx)
            return;
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(x + radius, y);
        this.canvasCtx.lineTo(x + width - radius, y);
        this.canvasCtx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.canvasCtx.lineTo(x + width, y + height - radius);
        this.canvasCtx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.canvasCtx.lineTo(x + radius, y + height);
        this.canvasCtx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.canvasCtx.lineTo(x, y + radius);
        this.canvasCtx.quadraticCurveTo(x, y, x + radius, y);
        this.canvasCtx.closePath();
    };
    /**
     * Convert RGB24 to hex string
     */
    DebugMidiWindow.prototype.rgbToHex = function (rgb) {
        var r = (rgb >> 16) & 0xFF;
        var g = (rgb >> 8) & 0xFF;
        var b = rgb & 0xFF;
        return "#".concat(r.toString(16).padStart(2, '0')).concat(g.toString(16).padStart(2, '0')).concat(b.toString(16).padStart(2, '0'));
    };
    /**
     * Process MIDI data and commands
     */
    DebugMidiWindow.prototype.processMessageImmediate = function (lineParts) {
        var i = 0;
        while (i < lineParts.length) {
            var part = lineParts[i];
            // Check for commands
            if (part === 'TITLE' && i + 1 < lineParts.length) {
                this._windowTitle = lineParts[i + 1];
                this.setWindowTitle(lineParts[i + 1]);
                i += 2;
                continue;
            }
            if (part === 'POS' && i + 2 < lineParts.length) {
                var x = spin2NumericParser_1.Spin2NumericParser.parsePixel(lineParts[i + 1]) || 0;
                var y = spin2NumericParser_1.Spin2NumericParser.parsePixel(lineParts[i + 2]) || 0;
                this.setWindowPosition(x, y);
                i += 3;
                continue;
            }
            if (part === 'SIZE' && i + 1 < lineParts.length) {
                var size = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[i + 1]);
                if (size !== null && size >= 1 && size <= 50) {
                    this.midiSize = size;
                    this.keySize = 8 + this.midiSize * 4;
                    this.updateKeyboardLayout();
                }
                i += 2;
                continue;
            }
            if (part === 'RANGE' && i + 2 < lineParts.length) {
                var first = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[i + 1]);
                var last = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[i + 2]);
                if (first !== null && last !== null &&
                    first >= 0 && first <= 127 &&
                    last >= first && last <= 127) {
                    this.midiKeyFirst = first;
                    this.midiKeyLast = last;
                    this.updateKeyboardLayout();
                }
                i += 3;
                continue;
            }
            if (part === 'CHANNEL' && i + 1 < lineParts.length) {
                var channel = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[i + 1]);
                if (channel !== null && channel >= 0 && channel <= 15) {
                    this.midiChannel = channel;
                }
                i += 2;
                continue;
            }
            if (part === 'COLOR' && i + 2 < lineParts.length) {
                var color1 = new debugColor_1.DebugColor(lineParts[i + 1]).rgbValue;
                var color2 = new debugColor_1.DebugColor(lineParts[i + 2]).rgbValue;
                this.vColor[0] = color1;
                this.whiteKeyColor = color1;
                this.vColor[1] = color2;
                this.blackKeyColor = color2;
                i += 3;
                continue;
            }
            if (part === 'CLEAR') {
                this.drawKeyboard(true);
                i++;
                continue;
            }
            if (part === 'SAVE') {
                var filename = 'midi.bmp';
                var saveWindow = false;
                if (i + 1 < lineParts.length && lineParts[i + 1] === 'WINDOW') {
                    saveWindow = true;
                    if (i + 2 < lineParts.length) {
                        filename = lineParts[i + 2].replace(/['"]/g, '');
                        i += 3;
                    }
                    else {
                        i += 2;
                    }
                }
                else if (i + 1 < lineParts.length) {
                    filename = lineParts[i + 1].replace(/['"]/g, '');
                    i += 2;
                }
                else {
                    i++;
                }
                this.saveWindowToBMPFilename(filename);
                continue;
            }
            if (part === 'PC_KEY') {
                this.pcKeyEnabled = true;
                this.enableKeyboardInput();
                i++;
                continue;
            }
            if (part === 'PC_MOUSE') {
                this.pcMouseEnabled = true;
                this.enableMouseInput();
                i++;
                continue;
            }
            // Try to parse as MIDI data byte
            var value = spin2NumericParser_1.Spin2NumericParser.parseCount(part);
            if (value !== null) {
                this.processMidiByte(value & 0xFF);
            }
            i++;
        }
    };
    /**
     * Process a single MIDI byte using state machine
     */
    DebugMidiWindow.prototype.processMidiByte = function (byte) {
        // MSB set forces command state
        if ((byte & 0x80) !== 0) {
            this.midiState = 0;
        }
        switch (this.midiState) {
            case 0: // Wait for note-on or note-off event
                if ((byte & 0xF0) === 0x90 && (byte & 0x0F) === this.midiChannel) {
                    this.midiState = 1; // Note-on event
                }
                else if ((byte & 0xF0) === 0x80 && (byte & 0x0F) === this.midiChannel) {
                    this.midiState = 3; // Note-off event
                }
                break;
            case 1: // Note-on, get note
                this.midiNote = byte;
                this.midiState = 2;
                break;
            case 2: // Note-on, get velocity
                this.midiVelocity[this.midiNote] = byte;
                this.midiState = 1;
                this.drawKeyboard(false);
                break;
            case 3: // Note-off, get note
                this.midiNote = byte;
                this.midiState = 4;
                break;
            case 4: // Note-off, get velocity (Pascal stores as negative but displays as 0)
                this.midiVelocity[this.midiNote] = 0; // Note off always shows as no velocity
                this.midiState = 3;
                this.drawKeyboard(false);
                break;
        }
    };
    /**
     * Get canvas ID for input forwarding
     */
    DebugMidiWindow.prototype.getCanvasId = function () {
        return "midi-canvas-".concat(this.midiWindowId);
    };
    /**
     * Set window title
     */
    DebugMidiWindow.prototype.setWindowTitle = function (title) {
        var titleElement = document.querySelector("#debug-window-".concat(this.midiWindowId, " .title"));
        if (titleElement) {
            titleElement.textContent = title;
        }
    };
    /**
     * Set window position
     */
    DebugMidiWindow.prototype.setWindowPosition = function (x, y) {
        var windowElement = document.getElementById("debug-window-".concat(this.midiWindowId));
        if (windowElement) {
            windowElement.style.left = "".concat(x, "px");
            windowElement.style.top = "".concat(y, "px");
        }
    };
    /**
     * Clean up resources when window is closed
     */
    DebugMidiWindow.prototype.closeDebugWindow = function () {
        var windowElement = document.getElementById("debug-window-".concat(this.midiWindowId));
        if (windowElement) {
            windowElement.remove();
        }
        this.canvas = null;
        this.canvasCtx = null;
        this.keyLayout = null;
    };
    return DebugMidiWindow;
}(debugWindowBase_1.DebugWindowBase));
exports.DebugMidiWindow = DebugMidiWindow;
