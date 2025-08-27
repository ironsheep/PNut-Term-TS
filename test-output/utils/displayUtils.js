"use strict";
/** @format */
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeDisplayString = safeDisplayString;
/**
 * Display utilities for safely showing binary data
 */
/**
 * Check if buffer contains any bytes outside normal ASCII range (0x20-0x7F)
 * If so, return hex/ASCII dump format. Otherwise return as plain text.
 */
function safeDisplayString(buffer) {
    var bytes;
    // Convert input to Uint8Array
    if (typeof buffer === 'string') {
        bytes = new TextEncoder().encode(buffer);
    }
    else if (Buffer.isBuffer(buffer)) {
        bytes = new Uint8Array(buffer);
    }
    else {
        bytes = buffer;
    }
    // Check if all bytes are in normal ASCII range (0x20-0x7F)
    var hasNonAscii = false;
    for (var i = 0; i < bytes.length; i++) {
        if (bytes[i] < 0x20 || bytes[i] > 0x7F) {
            hasNonAscii = true;
            break;
        }
    }
    if (!hasNonAscii) {
        // All bytes are normal ASCII - display as text
        return typeof buffer === 'string' ? buffer : new TextDecoder().decode(bytes);
    }
    // Contains non-ASCII bytes - display as hex/ASCII dump
    return formatHexAsciiDump(bytes);
}
/**
 * Format buffer as hex/ASCII dump using application standard:
 * 8 bytes $ format + double space + 8 bytes $ format + double space + ASCII dump
 */
function formatHexAsciiDump(bytes) {
    var lines = [];
    for (var i = 0; i < bytes.length; i += 16) {
        var line = bytes.slice(i, i + 16);
        // First 8 bytes with $ format
        var hex1 = Array.from(line.slice(0, 8))
            .map(function (b) { return "$".concat(b.toString(16).toUpperCase().padStart(2, '0')); })
            .join(' ');
        // Second 8 bytes with $ format  
        var hex2 = Array.from(line.slice(8, 16))
            .map(function (b) { return "$".concat(b.toString(16).toUpperCase().padStart(2, '0')); })
            .join(' ');
        // ASCII representation
        var ascii = Array.from(line)
            .map(function (b) { return (b >= 0x20 && b <= 0x7F) ? String.fromCharCode(b) : '.'; })
            .join('');
        // Pad hex sections to consistent width
        var paddedHex1 = hex1.padEnd(23, ' '); // 8 * 3 - 1 = 23
        var paddedHex2 = hex2.padEnd(23, ' ');
        lines.push("".concat(paddedHex1, "  ").concat(paddedHex2, "   ").concat(ascii));
    }
    return lines.join('\n');
}
