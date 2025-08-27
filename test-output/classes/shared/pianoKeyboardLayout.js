"use strict";
/**
 * @file pianoKeyboardLayout.ts
 * @description Shared piano keyboard layout calculator for MIDI and music-related displays
 * Calculates key positions, dimensions, and properties based on Pascal implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PianoKeyboardLayout = void 0;
var PianoKeyboardLayout = /** @class */ (function () {
    function PianoKeyboardLayout() {
    }
    /**
     * Calculate layout for all keys in the specified range
     * @param keySize Size of keys based on MidiKeySize = 8 + size * 4
     * @param firstKey First MIDI key number (0-127)
     * @param lastKey Last MIDI key number (0-127)
     * @returns Array of KeyInfo for each key, map of key offsets, and white key count
     */
    PianoKeyboardLayout.calculateLayout = function (keySize, firstKey, lastKey) {
        var keys = new Map();
        var border = Math.floor(keySize / 6); // From Pascal: border := MidiKeySize div ((8 + 4) div 2)
        var x = border;
        var whiteKeyCount = 0;
        // Calculate positions for all keys
        for (var i = 0; i <= 127; i++) {
            var note = i % this.NOTES_PER_OCTAVE;
            var isBlack = this.BLACK_KEY_PATTERN[note];
            var tweak = this.TWEAK_VALUES[note];
            var left = void 0;
            var right = void 0;
            var bottom = void 0;
            var numX = void 0;
            if (isBlack) {
                // Black key positioning
                left = x - Math.floor((keySize * (10 - tweak) + 16) / 32);
                right = left + Math.floor((keySize * 20) / 32);
                bottom = keySize * 4;
                numX = Math.floor((left + right + 1) / 2);
            }
            else {
                // White key positioning
                left = x;
                right = left + keySize;
                bottom = keySize * 6;
                numX = x + Math.floor((keySize * tweak + 16) / 32);
                x += keySize;
                // Count white keys in range
                if (i >= firstKey && i <= lastKey) {
                    whiteKeyCount++;
                }
            }
            keys.set(i, {
                isBlack: isBlack,
                left: left,
                right: right,
                bottom: bottom,
                numX: numX
            });
        }
        // Calculate offset based on first key
        var offset = 0;
        var firstKeyInfo = keys.get(firstKey);
        if (firstKeyInfo) {
            if (this.BLACK_KEY_PATTERN[firstKey % this.NOTES_PER_OCTAVE]) {
                // If first key is black, make white-key space to its left
                var prevKeyInfo = keys.get(firstKey - 1);
                if (prevKeyInfo) {
                    offset = prevKeyInfo.left - border;
                    whiteKeyCount++;
                }
            }
            else {
                offset = firstKeyInfo.left - border;
            }
        }
        // If last key is black, add white-key space to its right
        if (this.BLACK_KEY_PATTERN[lastKey % this.NOTES_PER_OCTAVE]) {
            whiteKeyCount++;
        }
        // Calculate total dimensions
        var totalWidth = keySize * whiteKeyCount + border * 2;
        var totalHeight = keySize * 6 + border;
        return {
            keys: keys,
            offset: offset,
            whiteKeyCount: whiteKeyCount,
            totalWidth: totalWidth,
            totalHeight: totalHeight
        };
    };
    /**
     * Check if a MIDI key number represents a black key
     * @param keyNumber MIDI key number (0-127)
     * @returns true if black key, false if white key
     */
    PianoKeyboardLayout.isBlackKey = function (keyNumber) {
        return this.BLACK_KEY_PATTERN[keyNumber % this.NOTES_PER_OCTAVE];
    };
    /**
     * Get the note name for a MIDI key number
     * @param keyNumber MIDI key number (0-127)
     * @returns Note name (e.g., "C4", "F#5")
     */
    PianoKeyboardLayout.getNoteName = function (keyNumber) {
        var noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        var note = keyNumber % this.NOTES_PER_OCTAVE;
        var octave = Math.floor(keyNumber / this.NOTES_PER_OCTAVE) - 1; // MIDI octave numbering
        return "".concat(noteNames[note]).concat(octave);
    };
    PianoKeyboardLayout.NOTES_PER_OCTAVE = 12;
    PianoKeyboardLayout.WHITE_KEYS_PER_OCTAVE = 7;
    // Pattern of black keys in an octave (true = black, false = white)
    // C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
    PianoKeyboardLayout.BLACK_KEY_PATTERN = [
        false, true, false, true, false, false, true, false, true, false, true, false
    ];
    // Tweak values from Pascal for positioning keys
    PianoKeyboardLayout.TWEAK_VALUES = [
        10, // C  white
        -2, // C# black  
        16, // D  white
        2, // D# black
        22, // E  white
        9, // F  white
        -3, // F# black
        15, // G  white
        1, // G# black
        19, // A  white
        7, // A# black
        25 // B  white
    ];
    return PianoKeyboardLayout;
}());
exports.PianoKeyboardLayout = PianoKeyboardLayout;
