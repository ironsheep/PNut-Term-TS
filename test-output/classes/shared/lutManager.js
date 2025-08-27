/** @format */
'use strict';
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LUTManager = void 0;
// src/classes/shared/lutManager.ts
/**
 * LUTManager manages color palettes for LUT1-8 color modes
 * Stores up to 256 RGB24 color values
 * No default palettes - all values must be user-provided
 */
var LUTManager = /** @class */ (function () {
    function LUTManager() {
        this.palette = [];
    }
    /**
     * Get the current palette
     */
    LUTManager.prototype.getPalette = function () {
        return __spreadArray([], this.palette, true); // Return a copy
    };
    /**
     * Set the palette from an array of RGB24 values
     * @param colors Array of RGB24 color values (0x00RRGGBB format)
     */
    LUTManager.prototype.setPalette = function (colors) {
        // Limit to 256 entries
        this.palette = colors.slice(0, 256).map(function (c) { return c & 0xFFFFFF; });
    };
    /**
     * Get a color from the palette by index
     * @param index Palette index (0-255)
     * @returns RGB24 color value or 0 if index is out of bounds or undefined
     */
    LUTManager.prototype.getColor = function (index) {
        if (index < 0 || index >= 256) {
            return 0;
        }
        return this.palette[index] || 0;
    };
    /**
     * Set a single color in the palette
     * @param index Palette index (0-255)
     * @param color RGB24 color value
     */
    LUTManager.prototype.setColor = function (index, color) {
        if (index >= 0 && index < 256) {
            // Ensure palette is large enough
            while (this.palette.length <= index) {
                this.palette.push(0);
            }
            this.palette[index] = color & 0xFFFFFF;
        }
    };
    /**
     * Clear the entire palette (set all to 0)
     */
    LUTManager.prototype.clearPalette = function () {
        this.palette = [];
    };
    /**
     * Get the number of defined colors in the palette
     */
    LUTManager.prototype.getPaletteSize = function () {
        return this.palette.length;
    };
    /**
     * Load palette from LUTCOLORS command format
     * Expects array of color values that can be numbers or strings
     * @param values Array of color values to load
     * @returns Number of colors successfully loaded
     */
    LUTManager.prototype.loadFromLutColors = function (values) {
        var colors = [];
        for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
            var value = values_1[_i];
            if (colors.length >= 256)
                break;
            var color = 0;
            if (typeof value === 'number') {
                color = value & 0xFFFFFF;
            }
            else if (typeof value === 'string') {
                // Try to parse hex string (with or without prefix)
                var cleaned = value.replace(/^[$#]/, '');
                var parsed = parseInt(cleaned, 16);
                if (!isNaN(parsed)) {
                    color = parsed & 0xFFFFFF;
                }
            }
            colors.push(color);
        }
        this.setPalette(colors);
        return colors.length;
    };
    /**
     * Check if palette has enough colors for a specific LUT mode
     * @param mode LUT mode (1, 2, 4, or 8)
     * @returns true if palette has enough colors
     */
    LUTManager.prototype.hasColorsForMode = function (mode) {
        var requiredColors = mode === 1 ? 2 : mode === 2 ? 4 : mode === 4 ? 16 : 256;
        return this.palette.length >= requiredColors;
    };
    return LUTManager;
}());
exports.LUTManager = LUTManager;
