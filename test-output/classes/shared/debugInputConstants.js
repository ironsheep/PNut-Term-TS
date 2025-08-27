"use strict";
/**
 * Debug Input Constants
 *
 * This file contains constants and interfaces for PC_KEY and PC_MOUSE debug commands
 * as documented in the Parallax Spin2 MouseCommands.PDF
 *
 * These are special debug commands used in graphical DEBUG() displays to capture
 * keyboard and mouse input from the host PC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOUSE_POSITION = exports.MOUSE_BUTTON_STATE = exports.PC_KEY_VALUES = void 0;
exports.isPrintableAscii = isPrintableAscii;
exports.isMouseInsideDisplay = isMouseInsideDisplay;
exports.extractPixelRGB = extractPixelRGB;
exports.keyValueToString = keyValueToString;
/*
 * Spin2 numeric formats
 *  INTEGER: (all resolved to 32-bit integers)
 *    Hexadecimal: $[0-9A-Fa-f][0-9A-Fa-f_]*
 *    Decimal: [-0-9][0-9_]*
 *    Octal: 0..377
 *    Binary: $[0-1][0-1_]*
 *    Double-binary: %%[0-3][0-3_]*
 *  FLOATING POINT: (all resolved to 32-bit (IEEE 754 floating point, single precision)
 *    Examples:  -1.0, 1_250_000.0,  1e9, 5e-6, -1.23456e-7
 */
/**
 * PC_KEY Command Details
 *
 * Command: PC_KEY(pointer_to_long)
 *
 * Returns any new host-PC keypress that occurred within the last 100ms into a long inside the chip.
 *
 * Requirements:
 * - Must be the last command in a DEBUG() statement
 * - The DEBUG() Display must have focus for keypresses to be noticed
 * - For Spin2 code: the long must be in the hub (use @key as the pointer)
 * - For PASM code: the long must be a cog register (use #key as the pointer)
 */
exports.PC_KEY_VALUES = {
    NO_KEYPRESS: 0,
    LEFT_ARROW: 1,
    RIGHT_ARROW: 2,
    UP_ARROW: 3,
    DOWN_ARROW: 4,
    HOME: 5,
    END: 6,
    DELETE: 7,
    BACKSPACE: 8,
    TAB: 9,
    INSERT: 10,
    PAGE_UP: 11,
    PAGE_DOWN: 12,
    ENTER: 13,
    ESC: 27,
    // ASCII printable characters: 32..126 = Space to "~"
    SPACE: 32,
    TILDE: 126
};
/**
 * Helper function to check if a value is a printable ASCII character
 */
function isPrintableAscii(keyValue) {
    return keyValue >= 32 && keyValue <= 126;
}
/**
 * Mouse button states
 */
exports.MOUSE_BUTTON_STATE = {
    RELEASED: 0,
    PRESSED: -1
};
/**
 * Mouse position states
 */
exports.MOUSE_POSITION = {
    OUTSIDE: -1 // Both xpos and ypos will be -1 when mouse is outside display
};
/**
 * Helper function to check if mouse is inside the debug display
 */
function isMouseInsideDisplay(status) {
    return status.xpos >= 0 && status.ypos >= 0;
}
/**
 * Helper function to extract RGB components from pixel value
 * @param pixel The pixel value in format $00_RR_GG_BB
 * @returns Object with r, g, b components or null if pixel is -1 (outside display)
 */
function extractPixelRGB(pixel) {
    if (pixel === -1)
        return null;
    return {
        r: (pixel >> 16) & 0xff,
        g: (pixel >> 8) & 0xff,
        b: pixel & 0xff
    };
}
/**
 * Helper function to convert key value to string representation
 */
function keyValueToString(keyValue) {
    switch (keyValue) {
        case exports.PC_KEY_VALUES.NO_KEYPRESS:
            return '<no keypress>';
        case exports.PC_KEY_VALUES.LEFT_ARROW:
            return 'Left Arrow';
        case exports.PC_KEY_VALUES.RIGHT_ARROW:
            return 'Right Arrow';
        case exports.PC_KEY_VALUES.UP_ARROW:
            return 'Up Arrow';
        case exports.PC_KEY_VALUES.DOWN_ARROW:
            return 'Down Arrow';
        case exports.PC_KEY_VALUES.HOME:
            return 'Home';
        case exports.PC_KEY_VALUES.END:
            return 'End';
        case exports.PC_KEY_VALUES.DELETE:
            return 'Delete';
        case exports.PC_KEY_VALUES.BACKSPACE:
            return 'Backspace';
        case exports.PC_KEY_VALUES.TAB:
            return 'Tab';
        case exports.PC_KEY_VALUES.INSERT:
            return 'Insert';
        case exports.PC_KEY_VALUES.PAGE_UP:
            return 'Page Up';
        case exports.PC_KEY_VALUES.PAGE_DOWN:
            return 'Page Down';
        case exports.PC_KEY_VALUES.ENTER:
            return 'Enter';
        case exports.PC_KEY_VALUES.ESC:
            return 'Esc';
        default:
            if (isPrintableAscii(keyValue)) {
                return String.fromCharCode(keyValue);
            }
            return "Unknown (".concat(keyValue, ")");
    }
}
