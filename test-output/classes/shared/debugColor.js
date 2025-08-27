/** @format */
// this is our common logging mechanism
//  TODO: make it context/runtime option aware
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugColor = void 0;
// src/classes/debugColor.ts
var spin2NumericParser_1 = require("./spin2NumericParser");
// Name-to-RGB hex lookup
var DebugColor = /** @class */ (function () {
    function DebugColor(colorName, brightness) {
        if (brightness === void 0) { brightness = DebugColor.defaultBrightness; }
        this.gridBrightness = 6; // chip says 4 but 6 looks better on Linux
        this.fontBrightness = 12; // linux, grid color too dark
        // Validate brightness is 0-15
        if (brightness < 0 || brightness > 15) {
            // console.log(` DC: WARNING: brightness ${brightness} out of range 0-15, using default ${DebugColor.defaultBrightness}`);
            brightness = DebugColor.defaultBrightness;
        }
        this.name = colorName;
        this._colorValue = DebugColor.colorNameToNumber(colorName);
        this._colorHexValue = DebugColor.colorNameToHexString(colorName);
        this._calcBrightness = this.brightnessForHex(this._colorHexValue);
        this._brightness = brightness;
        // Apply brightness to get the actual display color
        this._dimmedColorValue = this.adjustBrightness(this._colorValue, this._brightness);
        this.dimmedColor = this.hexColorString(this._dimmedColorValue);
        // Grid and font colors use their own brightness levels
        this.gridBrightness = DebugColor.defaultGridBrightness;
        this.fontBrightness = DebugColor.defaultFontBrightness;
        this.gridColor = this.hexColorString(this.adjustBrightness(this._colorValue, this.gridBrightness));
        this.fontColor = this.hexColorString(this.adjustBrightness(this._colorValue, this.fontBrightness));
    }
    DebugColor.setDefaultBrightness = function (brightness, fontBrightness, gridBrightness) {
        if (fontBrightness === void 0) { fontBrightness = 12; }
        if (gridBrightness === void 0) { gridBrightness = 6; }
        DebugColor.defaultBrightness = brightness;
        DebugColor.defaultFontBrightness = fontBrightness;
        DebugColor.defaultGridBrightness = gridBrightness;
    };
    DebugColor.prototype.brightnessForHex = function (hex) {
        // return 0-255 brightness value for a hex color
        var r = parseInt(hex.substring(1, 3), 16);
        var g = parseInt(hex.substring(3, 5), 16);
        var b = parseInt(hex.substring(5, 7), 16);
        return Math.round((r * 299 + g * 587 + b * 114) / 1000);
    };
    Object.defineProperty(DebugColor.prototype, "colorName", {
        get: function () {
            return this.name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DebugColor.prototype, "rgbValue", {
        get: function () {
            return this._dimmedColorValue;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DebugColor.prototype, "rgbString", {
        get: function () {
            //console.log(` DC: * rgbString() -> ${this.dimmedColor}`);
            return this.dimmedColor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DebugColor.prototype, "gridRgbString", {
        get: function () {
            return this.gridColor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DebugColor.prototype, "fontRgbString", {
        get: function () {
            return this.fontColor;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Check if a color name is valid (case-insensitive)
     */
    DebugColor.isValidColorName = function (colorName) {
        var foundColor = DebugColor.colorNameToHex[colorName.toUpperCase()];
        // console.log(` DC: * isValidColorName: ${colorName} -> ${foundColor}`);
        return foundColor !== undefined;
    };
    /**
     * Parse a color specification which can be:
     * - Color name: "RED"
     * - Color name with brightness: "RED 12"
     * - Hex color: "#FF0000" or "$FF0000"
     * - Decimal value: "16711680"
     * Returns [isValid, hexColor, brightness]
     */
    DebugColor.parseColorSpec = function (colorSpec) {
        var hexColor = '#000000';
        var brightness = DebugColor.defaultBrightness;
        var isValid = false;
        // First check if it's a color name with optional brightness
        var parts = colorSpec.trim().split(/\s+/);
        if (parts.length >= 1) {
            var colorName = parts[0].toUpperCase();
            // Check if it's a valid color name
            if (DebugColor.colorNameToHex[colorName]) {
                hexColor = DebugColor.colorNameToHex[colorName];
                isValid = true;
                // Check for brightness value
                if (parts.length >= 2) {
                    var brightnessValue = parseInt(parts[1], 10);
                    if (!isNaN(brightnessValue) && brightnessValue >= 0 && brightnessValue <= 15) {
                        brightness = brightnessValue;
                    }
                }
            }
            else {
                // Not a color name, try parsing as numeric value
                // Use Spin2NumericParser which supports $hex, %binary, %%quaternary, and decimal formats
                var colorValue = spin2NumericParser_1.Spin2NumericParser.parseColor(colorSpec);
                if (colorValue !== null) {
                    hexColor = '#' + colorValue.toString(16).padStart(6, '0');
                    isValid = true;
                }
                // Also support # prefix for hex (web-style)
                else if (colorSpec.startsWith('#')) {
                    var hex = colorSpec.substring(1);
                    if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                        hexColor = colorSpec;
                        isValid = true;
                    }
                }
            }
        }
        // console.log(` DC: * parseColorSpec(${colorSpec}) -> valid=${isValid}, hex=${hexColor}, brightness=${brightness}`);
        return [isValid, hexColor, brightness];
    };
    /**
     * Create a DebugColor instance from a color specification string
     */
    DebugColor.fromColorSpec = function (colorSpec) {
        var _a = DebugColor.parseColorSpec(colorSpec), isValid = _a[0], hexColor = _a[1], brightness = _a[2];
        if (!isValid) {
            return null;
        }
        // Find the color name that matches this hex value
        var colorName = 'CUSTOM';
        for (var _i = 0, _b = Object.entries(DebugColor.colorNameToHex); _i < _b.length; _i++) {
            var _c = _b[_i], name_1 = _c[0], hex = _c[1];
            if (hex.toUpperCase() === hexColor.toUpperCase()) {
                colorName = name_1;
                break;
            }
        }
        return new DebugColor(colorName, brightness);
    };
    DebugColor.colorNameToHexString = function (colorName) {
        var hexString = DebugColor.colorNameToHex[colorName.toUpperCase()];
        if (hexString === undefined) {
            // console.log(` DC: * colorNameToHexString: Unknown color name: ${colorName}`);
            hexString = '#5a5a5a'; // default to gray
        }
        //console.log(`colorNameToHexString: ${colorName} -> ${hexString}`);
        return hexString;
    };
    DebugColor.rgbHexStringToNumber = function (hexString) {
        var hexValue = hexString.startsWith('#') ? hexString.slice(1) : hexString;
        return parseInt(hexValue, 16);
    };
    DebugColor.colorNameToNumber = function (colorName) {
        var rgbHexString = DebugColor.colorNameToHexString(colorName);
        var value = DebugColor.rgbHexStringToNumber(rgbHexString);
        //console.log(` DC: * colorNameToNumber: ${colorName} -> ${rgbHexString} (${value})`);
        return value;
    };
    /**
     * Adjust color brightness according to Chip's brightness system (0-15)
     * 0 = black, 15 = full color, 1-14 = proportional brightness
     */
    DebugColor.prototype.adjustBrightness = function (color, brightness) {
        var adjustedColor = 0x000000;
        // Ensure brightness is in valid range 0-15
        brightness = Math.max(0, Math.min(15, brightness));
        if (brightness === 0 || color === 0) {
            adjustedColor = 0x000000; // Brightness 0: always black
        }
        else if (brightness === 15) {
            adjustedColor = color; // Brightness 15: full color
        }
        else {
            // Brightness 1-14: scale each RGB component proportionally
            try {
                var r = ((color >> 16) & 0xff) * (brightness / 15);
                var g = ((color >> 8) & 0xff) * (brightness / 15);
                var b = (color & 0xff) * (brightness / 15);
                adjustedColor = ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);
            }
            catch (error) {
                // console.log(` DC: ERROR adjusting brightness: ${error}`);
            }
        }
        // console.log(
        //   ` DC: * adjustBrightness(0x${color.toString(16).padStart(6, '0')}, ${brightness}) -> 0x${adjustedColor
        //     .toString(16)
        //     .padStart(6, '0')}`
        // );
        return adjustedColor;
    };
    /**
     * Get the RGB hex string with brightness applied
     */
    DebugColor.prototype.rgbStringWithBrightness = function (brightness) {
        var adjustedColor = this.adjustBrightness(this._colorValue, brightness);
        return this.hexColorString(adjustedColor);
    };
    DebugColor.prototype.hexColorString = function (colorValue) {
        return "#".concat(colorValue.toString(16).padStart(6, '0'));
    };
    // ----------------------------------------------------------------------
    // fun code to remember...
    DebugColor.prototype.getRandomColor = function () {
        var colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
        return colors[Math.floor(Math.random() * colors.length)];
    };
    DebugColor.defaultBrightness = 8;
    DebugColor.defaultFontBrightness = 12;
    DebugColor.defaultGridBrightness = 6;
    // Chip's 10 basic colors from Pascal reference
    DebugColor.colorNameToHex = {
        BLACK: '#000000', // Color 0
        WHITE: '#ffffff', // Color 1
        ORANGE: '#ff7f00', // Color 2 (was #FFA500 in parser)
        BLUE: '#0000ff', // Color 3
        GREEN: '#00ff00', // Color 4 (was #008000)
        CYAN: '#00ffff', // Color 5
        RED: '#ff0000', // Color 6
        MAGENTA: '#ff00ff', // Color 7
        YELLOW: '#ffff00', // Color 8
        GRAY: '#808080', // Color 9
        // Alternative spellings and legacy colors
        GREY: '#808080', // Alternative spelling
        OLIVE: '#7F7F00', // Legacy
        LIME: '#00FF00', // Legacy (same as GREEN)
        BLUE2: '#0000FF', // Legacy (same as BLUE)
        GRAY2: '#808080', // Legacy (same as GRAY)
        GRAY3: '#D0D0D0' // Legacy
    };
    return DebugColor;
}());
exports.DebugColor = DebugColor;
