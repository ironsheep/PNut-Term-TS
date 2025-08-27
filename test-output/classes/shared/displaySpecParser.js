/** @format */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisplaySpecParser = void 0;
var debugColor_1 = require("./debugColor");
var spin2NumericParser_1 = require("./spin2NumericParser");
var DisplaySpecParser = /** @class */ (function () {
    function DisplaySpecParser() {
    }
    /**
     * Parse common keywords that are shared between Logic and Scope windows
     * Returns true if a keyword was parsed, false otherwise
     */
    DisplaySpecParser.parseCommonKeywords = function (lineParts, index, spec) {
        var keyword = lineParts[index].toUpperCase();
        var consumed = 1; // number of parts consumed
        switch (keyword) {
            case 'TITLE':
                if (this.validateParameterCount(lineParts, index, 1)) {
                    spec.title = this.removeQuotes(lineParts[index + 1]);
                    consumed = 2;
                    return [true, consumed];
                }
                break;
            case 'POS':
                if (this.validateParameterCount(lineParts, index, 2)) {
                    var _a = this.parsePosKeyword(lineParts, index), isValid = _a[0], position = _a[1];
                    if (isValid) {
                        spec.position = position;
                        consumed = 3;
                        return [true, consumed];
                    }
                }
                break;
            case 'SIZE':
                if (this.validateParameterCount(lineParts, index, 2)) {
                    var width = spin2NumericParser_1.Spin2NumericParser.parsePixel(lineParts[index + 1]);
                    var height = spin2NumericParser_1.Spin2NumericParser.parsePixel(lineParts[index + 2]);
                    if (width !== null && height !== null && width > 0 && height > 0) {
                        spec.size = { width: width, height: height };
                        consumed = 3;
                        return [true, consumed];
                    }
                }
                break;
            case 'SAMPLES':
                if (this.validateParameterCount(lineParts, index, 1)) {
                    var samples = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[index + 1]);
                    if (samples !== null && samples > 0) {
                        spec.nbrSamples = samples;
                        consumed = 2;
                        return [true, consumed];
                    }
                }
                break;
            case 'COLOR':
                if (this.validateParameterCount(lineParts, index, 1)) {
                    var _b = this.parseColorKeyword(lineParts, index), isValid = _b[0], windowColor = _b[1], partsConsumed = _b[2];
                    if (isValid) {
                        spec.window = windowColor;
                        consumed = partsConsumed;
                        return [true, consumed];
                    }
                }
                break;
        }
        return [false, 0];
    };
    /**
     * Parse COLOR keyword with background and optional grid color
     * Format: COLOR <background> [<grid-color>]
     */
    DisplaySpecParser.parseColorKeyword = function (lineParts, index) {
        var _a, _b;
        var windowColor = {
            background: '#000000', // default black
            grid: '#808080' // default gray
        };
        if (index + 1 >= lineParts.length) {
            return [false, windowColor, 0];
        }
        var consumed = 1; // Start with COLOR keyword
        // Parse background color with potential brightness
        var bgColorSpec = lineParts[index + 1];
        consumed++;
        // Check if next part is a brightness value (0-15)
        if (index + 2 < lineParts.length && /^\d+$/.test(lineParts[index + 2])) {
            var brightness = (_a = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[index + 2])) !== null && _a !== void 0 ? _a : 0;
            if (brightness >= 0 && brightness <= 15) {
                bgColorSpec += ' ' + lineParts[index + 2];
                consumed++;
            }
        }
        var bgColor = this.parseColorValue(bgColorSpec);
        if (!bgColor) {
            return [false, windowColor, 0];
        }
        windowColor.background = bgColor;
        // Parse optional grid color with potential brightness
        if (index + consumed < lineParts.length) {
            var gridColorSpec = lineParts[index + consumed];
            var gridStartIndex = consumed;
            consumed++;
            // Check if this might be a color (not a command keyword)
            if (!this.isCommandKeyword(gridColorSpec)) {
                // Check for brightness value
                if (index + consumed < lineParts.length && /^\d+$/.test(lineParts[index + consumed])) {
                    var brightness = (_b = spin2NumericParser_1.Spin2NumericParser.parseCount(lineParts[index + consumed])) !== null && _b !== void 0 ? _b : 0;
                    if (brightness >= 0 && brightness <= 15) {
                        gridColorSpec += ' ' + lineParts[index + consumed];
                        consumed++;
                    }
                }
                var gridColor = this.parseColorValue(gridColorSpec);
                if (gridColor) {
                    windowColor.grid = gridColor;
                }
                else {
                    // Reset consumed if grid color parsing failed
                    consumed = gridStartIndex;
                }
            }
            else {
                // Reset consumed since this is a command keyword, not a grid color
                consumed = gridStartIndex;
            }
        }
        return [true, windowColor, consumed];
    };
    /**
     * Check if a string is a known command keyword
     */
    DisplaySpecParser.isCommandKeyword = function (str) {
        var keywords = ['TITLE', 'POS', 'SIZE', 'SAMPLES', 'COLOR', 'TRIGGER',
            'SPACING', 'DOTSIZE', 'LINESIZE', 'TEXTSIZE', 'CHANNEL'];
        return keywords.includes(str.toUpperCase());
    };
    /**
     * Parse POS keyword with x,y coordinates
     */
    DisplaySpecParser.parsePosKeyword = function (lineParts, index) {
        if (index + 2 >= lineParts.length) {
            return [false, { x: 0, y: 0 }];
        }
        var x = spin2NumericParser_1.Spin2NumericParser.parseInteger(lineParts[index + 1], true); // Allow negatives for position
        var y = spin2NumericParser_1.Spin2NumericParser.parseInteger(lineParts[index + 2], true); // Allow negatives for position
        if (x === null || y === null) {
            return [false, { x: 0, y: 0 }];
        }
        return [true, { x: x, y: y }];
    };
    /**
     * Validate that enough parameters exist after the current index
     */
    DisplaySpecParser.validateParameterCount = function (lineParts, index, requiredCount) {
        return index + requiredCount < lineParts.length;
    };
    /**
     * Parse a color value from a string
     * Supports:
     * - Hex format: $RRGGBB or #RRGGBB
     * - Decimal format: numeric value
     * - Color names: BLACK, WHITE, ORANGE, BLUE, GREEN, CYAN, RED, MAGENTA, YELLOW, GRAY
     * - Color names with brightness: RED 12
     */
    DisplaySpecParser.parseColorValue = function (colorStr) {
        // Use DebugColor's comprehensive color parsing
        var _a = debugColor_1.DebugColor.parseColorSpec(colorStr), isValid = _a[0], hexColor = _a[1], brightness = _a[2];
        if (isValid) {
            // If brightness is not default, apply it to the color
            if (brightness !== debugColor_1.DebugColor.defaultBrightness) {
                var debugColor = debugColor_1.DebugColor.fromColorSpec(colorStr);
                if (debugColor) {
                    return debugColor.rgbString; // This already has brightness applied
                }
            }
            return hexColor;
        }
        return null;
    };
    /**
     * Remove quotes from a string if present
     */
    DisplaySpecParser.removeQuotes = function (str) {
        if (str.length >= 2) {
            if ((str[0] === '"' && str[str.length - 1] === '"') ||
                (str[0] === "'" && str[str.length - 1] === "'")) {
                return str.substring(1, str.length - 1);
            }
        }
        return str;
    };
    return DisplaySpecParser;
}());
exports.DisplaySpecParser = DisplaySpecParser;
