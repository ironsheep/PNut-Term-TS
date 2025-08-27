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
exports.PackedDataProcessor = void 0;
// src/classes/shared/packedDataProcessor.ts
var debugWindowBase_1 = require("../debugWindowBase");
/**
 * PackedDataProcessor - Handles unpacking of sub-byte data types from packed formats
 *
 * This class implements the packed data format specification documented in:
 * /pascal-source/P2_PNut_Public/packedData.pdf
 *
 * ## Overview
 *
 * Packed data formats enable efficient transmission of sub-byte data types by packing
 * multiple values into bytes, words, or longs. The host side (this processor) unpacks
 * them according to the specified mode, with optional ALT reordering and SIGNED extension.
 *
 * ## Syntax
 * ```
 * packed_data_mode {ALT} {SIGNED}
 * ```
 *
 * ## Optional Modifiers
 *
 * **ALT Keyword**:
 * - Reorders bits, double-bits, or nibbles within each byte end-to-end on the host side
 * - Useful for bitmap data where bitfields are out-of-order with respect to the DEBUG display
 * - Simplifies handling of data composed in standard formats
 *
 * **SIGNED Keyword**:
 * - Causes all unpacked data values to be sign-extended on the host side
 * - Converts unsigned ranges to signed ranges as specified in the table below
 *
 * ## Complete Packed Data Modes
 *
 * | Mode | Description | Values per Unit | Unsigned Range | Signed Range |
 * |------|-------------|-----------------|----------------|--------------|
 * | **LONGS_1BIT** | Each long → 32 separate 1-bit values | 32 | 0..1 | -1..0 |
 * | **LONGS_2BIT** | Each long → 16 separate 2-bit values | 16 | 0..3 | -2..1 |
 * | **LONGS_4BIT** | Each long → 8 separate 4-bit values | 8 | 0..15 | -8..7 |
 * | **LONGS_8BIT** | Each long → 4 separate 8-bit values | 4 | 0..255 | -128..127 |
 * | **LONGS_16BIT** | Each long → 2 separate 16-bit values | 2 | 0..65,535 | -32,768..32,767 |
 * | **WORDS_1BIT** | Each word → 16 separate 1-bit values | 16 | 0..1 | -1..0 |
 * | **WORDS_2BIT** | Each word → 8 separate 2-bit values | 8 | 0..3 | -2..1 |
 * | **WORDS_4BIT** | Each word → 4 separate 4-bit values | 4 | 0..15 | -8..7 |
 * | **WORDS_8BIT** | Each word → 2 separate 8-bit values | 2 | 0..255 | -128..127 |
 * | **BYTES_1BIT** | Each byte → 8 separate 1-bit values | 8 | 0..1 | -1..0 |
 * | **BYTES_2BIT** | Each byte → 4 separate 2-bit values | 4 | 0..3 | -2..1 |
 * | **BYTES_4BIT** | Each byte → 2 separate 4-bit values | 2 | 0..15 | -8..7 |
 *
 * ## Processing Details
 *
 * 1. **Extraction Order**: Values are extracted starting from the LSB (Least Significant Bit) of the received value
 * 2. **Sign Extension**: When SIGNED is specified, values are sign-extended to their full range
 * 3. **ALT Reordering**: When ALT is specified, bit groups within each byte are reversed in order
 * 4. **Data Flow**: Raw packed data → Unpacking → Optional ALT reordering → Optional sign extension → Final values
 *
 * ## ALT Reordering Implementation
 *
 * The ALT modifier reverses the order of bit groups within each byte:
 * - **1-bit mode**: All 8 bits in a byte are reversed (bit 7→0, 6→1, etc.)
 * - **2-bit mode**: The 4 groups of 2 bits are reversed in order
 * - **4-bit mode**: The 2 nibbles in a byte are swapped
 * - **8-bit mode**: Bytes within words/longs are processed individually
 * - **16-bit mode**: Each 16-bit value is treated as 2 bytes, ALT applied per byte
 *
 * For WORDS and LONGS modes, ALT is applied to each constituent byte independently,
 * ensuring consistent behavior across all data widths.
 *
 * ## Implementation Notes
 *
 * - The 13th packed data mode `NO_PACKING = 0` represents normal unpacked data (no processing)
 * - This processor handles all 12 packed modes plus the no-packing mode
 * - Numeric values in packed data streams are NOT parsed by `Spin2NumericParser` - they arrive as raw binary data
 * - **ALT modifier is fully implemented** - reverses bit groups within each byte as per specification
 * - **SIGNED modifier is fully implemented** - sign-extends values based on their bit width
 *
 * **Important**: This processor operates on raw binary data values received from the
 * serial stream, not text representations. The Spin2NumericParser is not used here
 * because values arrive as already-parsed integers.
 */
var PackedDataProcessor = /** @class */ (function () {
    function PackedDataProcessor() {
    }
    /**
     * Validates a packed data mode string and returns mode configuration
     * @param possibleMode - Mode string to validate (e.g., 'LONGS_8BIT', 'bytes_2bit')
     * @returns Tuple of [isValid, modeConfiguration]
     */
    PackedDataProcessor.validatePackedMode = function (possibleMode) {
        var havePackedDataStatus = false;
        var desiredMode = {
            mode: debugWindowBase_1.ePackedDataMode.PDM_UNKNOWN,
            bitsPerSample: 0,
            valueSize: debugWindowBase_1.ePackedDataWidth.PDW_UNKNOWN,
            isAlternate: false,
            isSigned: false
        };
        // define hash where key is mode string and value is ePackedDataMode
        var modeMap = new Map([
            ['longs_1bit', debugWindowBase_1.ePackedDataMode.PDM_LONGS_1BIT],
            ['longs_2bit', debugWindowBase_1.ePackedDataMode.PDM_LONGS_2BIT],
            ['longs_4bit', debugWindowBase_1.ePackedDataMode.PDM_LONGS_4BIT],
            ['longs_8bit', debugWindowBase_1.ePackedDataMode.PDM_LONGS_8BIT],
            ['longs_16bit', debugWindowBase_1.ePackedDataMode.PDM_LONGS_16BIT],
            ['words_1bit', debugWindowBase_1.ePackedDataMode.PDM_WORDS_1BIT],
            ['words_2bit', debugWindowBase_1.ePackedDataMode.PDM_WORDS_2BIT],
            ['words_4bit', debugWindowBase_1.ePackedDataMode.PDM_WORDS_4BIT],
            ['words_8bit', debugWindowBase_1.ePackedDataMode.PDM_WORDS_8BIT],
            ['bytes_1bit', debugWindowBase_1.ePackedDataMode.PDM_BYTES_1BIT],
            ['bytes_2bit', debugWindowBase_1.ePackedDataMode.PDM_BYTES_2BIT],
            ['bytes_4bit', debugWindowBase_1.ePackedDataMode.PDM_BYTES_4BIT]
        ]);
        // if possible mode matches key in modeMap, then set mode and return true
        if (modeMap.has(possibleMode.toLocaleLowerCase())) {
            desiredMode.mode = modeMap.get(possibleMode.toLocaleLowerCase());
            havePackedDataStatus = true;
            // now set our bitsPerSample based on new mode
            switch (desiredMode.mode) {
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_1BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_WORDS_1BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_BYTES_1BIT:
                    desiredMode.bitsPerSample = 1;
                    break;
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_2BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_WORDS_2BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_BYTES_2BIT:
                    desiredMode.bitsPerSample = 2;
                    break;
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_4BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_WORDS_4BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_BYTES_4BIT:
                    desiredMode.bitsPerSample = 4;
                    break;
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_8BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_WORDS_8BIT:
                    desiredMode.bitsPerSample = 8;
                    break;
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_16BIT:
                    desiredMode.bitsPerSample = 16;
                    break;
                default:
                    desiredMode.bitsPerSample = 0;
                    break;
            }
            // now set our desiredMode.valueSize based on new mode
            switch (desiredMode.mode) {
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_1BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_2BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_4BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_8BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_LONGS_16BIT:
                    desiredMode.valueSize = debugWindowBase_1.ePackedDataWidth.PDW_LONGS;
                    break;
                case debugWindowBase_1.ePackedDataMode.PDM_WORDS_1BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_WORDS_2BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_WORDS_4BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_WORDS_8BIT:
                    desiredMode.valueSize = debugWindowBase_1.ePackedDataWidth.PDW_WORDS;
                    break;
                case debugWindowBase_1.ePackedDataMode.PDM_BYTES_1BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_BYTES_2BIT:
                case debugWindowBase_1.ePackedDataMode.PDM_BYTES_4BIT:
                    desiredMode.valueSize = debugWindowBase_1.ePackedDataWidth.PDW_BYTES;
                    break;
                default:
                    desiredMode.valueSize = debugWindowBase_1.ePackedDataWidth.PDW_UNKNOWN;
                    break;
            }
        }
        return [havePackedDataStatus, desiredMode];
    };
    /**
     * Parses an array of keywords to extract packed mode and modifiers
     * @param keywords - Array of keywords that may include mode name, 'ALT', and 'SIGNED'
     * @returns PackedDataMode configuration with mode, ALT, and SIGNED flags set
     * @example
     * // Parse mode with modifiers
     * parsePackedModeKeywords(['BYTES_4BIT', 'ALT', 'SIGNED'])
     * // Returns: { mode: PDM_BYTES_4BIT, isAlternate: true, isSigned: true, ... }
     */
    PackedDataProcessor.parsePackedModeKeywords = function (keywords) {
        var mode = {
            mode: debugWindowBase_1.ePackedDataMode.PDM_UNKNOWN,
            bitsPerSample: 0,
            valueSize: debugWindowBase_1.ePackedDataWidth.PDW_UNKNOWN,
            isAlternate: false,
            isSigned: false
        };
        for (var _i = 0, keywords_1 = keywords; _i < keywords_1.length; _i++) {
            var keyword = keywords_1[_i];
            var upperKeyword = keyword.toUpperCase();
            if (upperKeyword === 'ALT') {
                mode.isAlternate = true;
            }
            else if (upperKeyword === 'SIGNED') {
                mode.isSigned = true;
            }
            else {
                // try to parse as packed data mode
                var _a = this.validatePackedMode(keyword), isValid = _a[0], parsedMode = _a[1];
                if (isValid) {
                    mode.mode = parsedMode.mode;
                    mode.bitsPerSample = parsedMode.bitsPerSample;
                    mode.valueSize = parsedMode.valueSize;
                }
            }
        }
        return mode;
    };
    /**
     * Unpacks a numeric value into multiple samples based on packed mode
     * @param numericValue - Raw binary value to unpack (byte, word, or long)
     * @param mode - Packed mode configuration specifying how to unpack
     * @returns Array of unpacked sample values
     * @example
     * // Unpack byte 0xF0 as 4-bit samples
     * unpackSamples(0xF0, { mode: PDM_BYTES_4BIT, ... })
     * // Returns: [0x0, 0xF] (LSB first extraction)
     *
     * // With ALT modifier, bit groups are reversed within each byte:
     * unpackSamples(0xF0, { mode: PDM_BYTES_4BIT, isAlternate: true, ... })
     * // Returns: [0xF, 0x0] (nibbles reversed)
     */
    PackedDataProcessor.unpackSamples = function (numericValue, mode) {
        var sampleSet = [];
        if (mode.mode === debugWindowBase_1.ePackedDataMode.PDM_UNKNOWN) {
            sampleSet.push(numericValue);
        }
        else {
            // unpack the data based on configured mode generating a list of samples
            // we have a single value which according to packed mode we need to unpack
            switch (mode.valueSize) {
                case debugWindowBase_1.ePackedDataWidth.PDW_BYTES:
                    // we have data as a byte [0-255] 8-bits
                    switch (mode.bitsPerSample) {
                        case 1:
                            // we have data as 8 single bit samples
                            // push each bit as a sample from LSB to MSB
                            for (var index = 0; index < 8; index++) {
                                sampleSet.push((numericValue >> index) & 0x01);
                            }
                            break;
                        case 2:
                            // we have data as 4 2-bit samples
                            // push each 2bits as a sample from LSB to MSB
                            for (var index = 0; index < 4; index++) {
                                sampleSet.push((numericValue >> (index * 2)) & 0x03);
                            }
                            break;
                        case 4:
                            // we have data as 2 4-bit samples
                            // push each 4bits as a sample from LSB to MSB
                            for (var index = 0; index < 2; index++) {
                                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
                            }
                            break;
                        default:
                            break;
                    }
                    break;
                case debugWindowBase_1.ePackedDataWidth.PDW_WORDS:
                    // we have data as a word [0-65535] 16-bits
                    switch (mode.bitsPerSample) {
                        case 1:
                            // we have data as 16 single bit samples
                            // push each bit as a sample from LSB to MSB
                            for (var index = 0; index < 16; index++) {
                                sampleSet.push((numericValue >> index) & 0x01);
                            }
                            break;
                        case 2:
                            // we have data as 8 2-bit samples
                            // push each 2bits as a sample from LSB to MSB
                            for (var index = 0; index < 8; index++) {
                                sampleSet.push((numericValue >> (index * 2)) & 0x03);
                            }
                            break;
                        case 4:
                            // we have data as 4 4-bit samples
                            // push each 4bits as a sample from LSB to MSB
                            for (var index = 0; index < 4; index++) {
                                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
                            }
                            break;
                        case 8:
                            // we have data as 2 8-bit samples
                            // push each 8bits as a sample from LSB to MSB
                            for (var index = 0; index < 2; index++) {
                                sampleSet.push((numericValue >> (index * 8)) & 0xff);
                            }
                            break;
                        default:
                            break;
                    }
                    break;
                case debugWindowBase_1.ePackedDataWidth.PDW_LONGS:
                    // we have data as a long 32-bits
                    switch (mode.bitsPerSample) {
                        case 1:
                            // we have data as 32 single bit samples
                            // push each bit as a sample from LSB to MSB
                            for (var index = 0; index < 32; index++) {
                                sampleSet.push((numericValue >> index) & 0x01);
                            }
                            break;
                        case 2:
                            // we have data as 16 2-bit samples
                            // push each 2bits as a sample from LSB to MSB
                            for (var index = 0; index < 16; index++) {
                                sampleSet.push((numericValue >> (index * 2)) & 0x03);
                            }
                            break;
                        case 4:
                            // we have data as 8 4-bit samples
                            // push each 4bits as a sample from LSB to MSB
                            for (var index = 0; index < 8; index++) {
                                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
                            }
                            break;
                        case 8:
                            // we have data as 4 8-bit samples
                            // push each 8bits as a sample from LSB to MSB
                            for (var index = 0; index < 4; index++) {
                                sampleSet.push((numericValue >> (index * 8)) & 0xff);
                            }
                            break;
                        case 16:
                            // we have data as 2 16-bit samples
                            // push each 16bits as a sample from LSB to MSB
                            for (var index = 0; index < 2; index++) {
                                sampleSet.push((numericValue >> (index * 16)) & 0xffff);
                            }
                            break;
                        default:
                            break;
                    }
                    break;
                default:
                    break;
            }
            // if SIGNED then sign extend each sample
            if (mode.isSigned) {
                for (var index = 0; index < sampleSet.length; index++) {
                    sampleSet[index] = this.signExtend(sampleSet[index], mode.bitsPerSample - 1);
                }
            }
            // if ALT then reverse the order of bit groups within each byte
            if (mode.isAlternate) {
                // ALT reverses bit groups within each byte end-to-end
                // Examples of ALT reordering:
                // - BYTES_1BIT with 0b10110001: [1,0,0,0,1,1,0,1] → [1,0,1,1,0,0,0,1]
                // - BYTES_2BIT with 0b11100100: [00,01,10,11] → [11,10,01,00]
                // - BYTES_4BIT with 0xF0: [0x0, 0xF] → [0xF, 0x0]
                var samplesPerByte = void 0;
                switch (mode.valueSize) {
                    case debugWindowBase_1.ePackedDataWidth.PDW_BYTES:
                        samplesPerByte = 8 / mode.bitsPerSample; // 8, 4, or 2 samples per byte
                        break;
                    case debugWindowBase_1.ePackedDataWidth.PDW_WORDS:
                        samplesPerByte = 8 / mode.bitsPerSample; // Process each byte within the word
                        break;
                    case debugWindowBase_1.ePackedDataWidth.PDW_LONGS:
                        samplesPerByte = 8 / mode.bitsPerSample; // Process each byte within the long
                        break;
                    default:
                        samplesPerByte = 0;
                        break;
                }
                if (samplesPerByte > 0) {
                    var reorderedSamples = [];
                    // Process samples in groups based on how many bytes were in the original value
                    var totalBytes = 1;
                    if (mode.valueSize === debugWindowBase_1.ePackedDataWidth.PDW_WORDS)
                        totalBytes = 2;
                    if (mode.valueSize === debugWindowBase_1.ePackedDataWidth.PDW_LONGS)
                        totalBytes = 4;
                    for (var byteIndex = 0; byteIndex < totalBytes; byteIndex++) {
                        var startIndex = byteIndex * samplesPerByte;
                        var endIndex = startIndex + samplesPerByte;
                        // Extract samples for this byte and reverse them
                        var byteSamples = sampleSet.slice(startIndex, endIndex);
                        byteSamples.reverse();
                        // Add reversed samples to result
                        reorderedSamples.push.apply(reorderedSamples, byteSamples);
                    }
                    // Replace original samples with reordered ones
                    sampleSet.splice.apply(sampleSet, __spreadArray([0, sampleSet.length], reorderedSamples, false));
                }
            }
        }
        return sampleSet;
    };
    /**
     * Sign-extends a value based on the position of the sign bit
     * @param value - Value to sign-extend
     * @param signBitNbr - Bit position of the sign bit (0-based)
     * @returns Sign-extended value
     * @example
     * // Sign-extend 2-bit value 0b11 (3) with sign at bit 1
     * signExtend(3, 1) // Returns: -1
     */
    PackedDataProcessor.signExtend = function (value, signBitNbr) {
        // Create a mask to zero out all bits above the sign bit
        var mask = (1 << (signBitNbr + 1)) - 1;
        value &= mask;
        // Check if the sign bit is set
        var isNegative = (value & (1 << signBitNbr)) !== 0;
        if (isNegative) {
            // If the sign bit is set, convert the value to a negative number
            value = value - (1 << (signBitNbr + 1));
        }
        return value;
    };
    return PackedDataProcessor;
}());
exports.PackedDataProcessor = PackedDataProcessor;
