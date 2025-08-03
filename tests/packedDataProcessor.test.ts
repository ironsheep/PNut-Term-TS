/** @format */

'use strict';

// tests/packedDataProcessor.test.ts

import { PackedDataProcessor } from '../src/classes/shared/packedDataProcessor';
import { ePackedDataMode, ePackedDataWidth, PackedDataMode } from '../src/classes/debugWindowBase';

describe('PackedDataProcessor', () => {
  describe('validatePackedMode', () => {
    test('should validate valid packed data modes', () => {
      const testCases = [
        { mode: 'longs_1bit', expected: ePackedDataMode.PDM_LONGS_1BIT },
        { mode: 'LONGS_2BIT', expected: ePackedDataMode.PDM_LONGS_2BIT },
        { mode: 'Words_4Bit', expected: ePackedDataMode.PDM_WORDS_4BIT },
        { mode: 'bytes_8bit', expected: ePackedDataMode.PDM_UNKNOWN }, // should be invalid
        { mode: 'words_16bit', expected: ePackedDataMode.PDM_UNKNOWN }, // should be invalid
        { mode: 'longs_16bit', expected: ePackedDataMode.PDM_LONGS_16BIT },
        { mode: 'bytes_4bit', expected: ePackedDataMode.PDM_BYTES_4BIT }
      ];

      for (const testCase of testCases) {
        const [isValid, mode] = PackedDataProcessor.validatePackedMode(testCase.mode);
        if (testCase.expected === ePackedDataMode.PDM_UNKNOWN) {
          expect(isValid).toBe(false);
          expect(mode.mode).toBe(ePackedDataMode.PDM_UNKNOWN);
        } else {
          expect(isValid).toBe(true);
          expect(mode.mode).toBe(testCase.expected);
        }
      }
    });

    test('should set correct bits per sample', () => {
      const testCases = [
        { mode: 'longs_1bit', expectedBits: 1 },
        { mode: 'words_2bit', expectedBits: 2 },
        { mode: 'bytes_4bit', expectedBits: 4 },
        { mode: 'longs_8bit', expectedBits: 8 },
        { mode: 'longs_16bit', expectedBits: 16 }
      ];

      for (const testCase of testCases) {
        const [isValid, mode] = PackedDataProcessor.validatePackedMode(testCase.mode);
        expect(isValid).toBe(true);
        expect(mode.bitsPerSample).toBe(testCase.expectedBits);
      }
    });

    test('should set correct value size', () => {
      const testCases = [
        { mode: 'longs_1bit', expectedSize: ePackedDataWidth.PDW_LONGS },
        { mode: 'words_2bit', expectedSize: ePackedDataWidth.PDW_WORDS },
        { mode: 'bytes_4bit', expectedSize: ePackedDataWidth.PDW_BYTES }
      ];

      for (const testCase of testCases) {
        const [isValid, mode] = PackedDataProcessor.validatePackedMode(testCase.mode);
        expect(isValid).toBe(true);
        expect(mode.valueSize).toBe(testCase.expectedSize);
      }
    });

    test('should reject invalid modes', () => {
      const invalidModes = [
        'invalid_mode',
        'longs_3bit',
        'bytes_16bit',
        'words_32bit',
        '',
        'just_some_text'
      ];

      for (const invalidMode of invalidModes) {
        const [isValid, mode] = PackedDataProcessor.validatePackedMode(invalidMode);
        expect(isValid).toBe(false);
        expect(mode.mode).toBe(ePackedDataMode.PDM_UNKNOWN);
      }
    });
  });

  describe('parsePackedModeKeywords', () => {
    test('should parse mode with ALT and SIGNED keywords', () => {
      const keywords = ['longs_4bit', 'ALT', 'SIGNED'];
      const mode = PackedDataProcessor.parsePackedModeKeywords(keywords);

      expect(mode.mode).toBe(ePackedDataMode.PDM_LONGS_4BIT);
      expect(mode.bitsPerSample).toBe(4);
      expect(mode.valueSize).toBe(ePackedDataWidth.PDW_LONGS);
      expect(mode.isAlternate).toBe(true);
      expect(mode.isSigned).toBe(true);
    });

    test('should parse mode with only ALT keyword', () => {
      const keywords = ['words_2bit', 'alt'];
      const mode = PackedDataProcessor.parsePackedModeKeywords(keywords);

      expect(mode.mode).toBe(ePackedDataMode.PDM_WORDS_2BIT);
      expect(mode.isAlternate).toBe(true);
      expect(mode.isSigned).toBe(false);
    });

    test('should parse mode with only SIGNED keyword', () => {
      const keywords = ['bytes_1bit', 'signed'];
      const mode = PackedDataProcessor.parsePackedModeKeywords(keywords);

      expect(mode.mode).toBe(ePackedDataMode.PDM_BYTES_1BIT);
      expect(mode.isAlternate).toBe(false);
      expect(mode.isSigned).toBe(true);
    });

    test('should handle no keywords', () => {
      const keywords: string[] = [];
      const mode = PackedDataProcessor.parsePackedModeKeywords(keywords);

      expect(mode.mode).toBe(ePackedDataMode.PDM_UNKNOWN);
      expect(mode.isAlternate).toBe(false);
      expect(mode.isSigned).toBe(false);
    });
  });

  describe('unpackSamples', () => {
    test('should return single value for unknown mode', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_UNKNOWN,
        bitsPerSample: 0,
        valueSize: ePackedDataWidth.PDW_UNKNOWN,
        isAlternate: false,
        isSigned: false
      };

      const samples = PackedDataProcessor.unpackSamples(42, mode);
      expect(samples).toEqual([42]);
    });

    test('should unpack bytes_1bit correctly', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: false,
        isSigned: false
      };

      // Binary: 10101010 = 170 decimal
      const samples = PackedDataProcessor.unpackSamples(170, mode);
      expect(samples).toEqual([0, 1, 0, 1, 0, 1, 0, 1]); // LSB to MSB
    });

    test('should unpack bytes_2bit correctly', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_2BIT,
        bitsPerSample: 2,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: false,
        isSigned: false
      };

      // Binary: 11100100 = 228 decimal
      const samples = PackedDataProcessor.unpackSamples(228, mode);
      expect(samples).toEqual([0, 1, 2, 3]); // 00, 01, 10, 11 in LSB to MSB order
    });

    test('should unpack words_1bit correctly', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_WORDS_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_WORDS,
        isAlternate: false,
        isSigned: false
      };

      // Binary: 1010101010101010 = 43690 decimal
      const samples = PackedDataProcessor.unpackSamples(43690, mode);
      const expected = new Array(16).fill(0).map((_, i) => (i % 2)); // alternating 0,1,0,1...
      expect(samples).toEqual(expected);
    });

    test('should unpack longs_4bit correctly', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_LONGS_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: false,
        isSigned: false
      };

      // Test value that gives us 8 different 4-bit values
      // 0x76543210 = 1985229328 decimal
      const samples = PackedDataProcessor.unpackSamples(1985229328, mode);
      expect(samples).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); // 0x0 through 0x7 in LSB order
    });

    test('should handle signed mode correctly', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: false,
        isSigned: true
      };

      // Binary: 11110000 = 240 decimal (two 4-bit values: 0000, 1111)
      const samples = PackedDataProcessor.unpackSamples(240, mode);
      expect(samples).toEqual([0, -1]); // 0x0 = 0, 0xF = -1 when sign-extended from 4-bit
    });

    test('should handle edge cases', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: false,
        isSigned: false
      };

      // Test with 0
      let samples = PackedDataProcessor.unpackSamples(0, mode);
      expect(samples).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);

      // Test with 255 (all bits set)
      samples = PackedDataProcessor.unpackSamples(255, mode);
      expect(samples).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    });

    test('should handle longs_16bit correctly', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_LONGS_16BIT,
        bitsPerSample: 16,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: false,
        isSigned: false
      };

      // 0x12340000 = 305397760 decimal (should give us 0x0000, 0x1234)
      const samples = PackedDataProcessor.unpackSamples(305397760, mode);
      expect(samples).toEqual([0, 4660]); // 0x0000 = 0, 0x1234 = 4660
    });
  });

  describe('ALT modifier functionality', () => {
    test('should reverse bits in BYTES_1BIT with ALT', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: true,
        isSigned: false
      };

      // Test various bit patterns
      // 0b10110001 = 177 → LSB first: [1,0,0,0,1,1,0,1] → ALT reverses to [1,0,1,1,0,0,0,1]
      expect(PackedDataProcessor.unpackSamples(0b10110001, mode)).toEqual([1, 0, 1, 1, 0, 0, 0, 1]);
      
      // 0x00 → all zeros stay all zeros
      expect(PackedDataProcessor.unpackSamples(0x00, mode)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      
      // 0xFF → all ones stay all ones
      expect(PackedDataProcessor.unpackSamples(0xFF, mode)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
      
      // 0xAA = 0b10101010 → LSB first: [0,1,0,1,0,1,0,1] → ALT: [1,0,1,0,1,0,1,0]
      expect(PackedDataProcessor.unpackSamples(0xAA, mode)).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    });

    test('should reverse 2-bit groups in BYTES_2BIT with ALT', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_2BIT,
        bitsPerSample: 2,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: true,
        isSigned: false
      };

      // 0b11100100 = 228 → [00,01,10,11] → ALT reverses to [11,10,01,00]
      expect(PackedDataProcessor.unpackSamples(0b11100100, mode)).toEqual([3, 2, 1, 0]);
      
      // 0x55 = 0b01010101 → [01,01,01,01] → stays [01,01,01,01]
      expect(PackedDataProcessor.unpackSamples(0x55, mode)).toEqual([1, 1, 1, 1]);
      
      // 0xFF → [11,11,11,11] → stays [11,11,11,11]
      expect(PackedDataProcessor.unpackSamples(0xFF, mode)).toEqual([3, 3, 3, 3]);
    });

    test('should reverse 4-bit groups in BYTES_4BIT with ALT', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: true,
        isSigned: false
      };

      // 0xF0 → [0x0, 0xF] → ALT reverses to [0xF, 0x0]
      expect(PackedDataProcessor.unpackSamples(0xF0, mode)).toEqual([15, 0]);
      
      // 0x12 → [0x2, 0x1] → ALT reverses to [0x1, 0x2]
      expect(PackedDataProcessor.unpackSamples(0x12, mode)).toEqual([1, 2]);
      
      // 0xAB → [0xB, 0xA] → ALT reverses to [0xA, 0xB]
      expect(PackedDataProcessor.unpackSamples(0xAB, mode)).toEqual([10, 11]);
    });

    test('should apply ALT per-byte in WORDS modes', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_WORDS_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_WORDS,
        isAlternate: true,
        isSigned: false
      };

      // 0x1234 → byte0: 0x34 [4,3], byte1: 0x12 [2,1]
      // With ALT: byte0: [3,4], byte1: [1,2] → final: [3,4,1,2]
      expect(PackedDataProcessor.unpackSamples(0x1234, mode)).toEqual([3, 4, 1, 2]);
      
      // 0xABCD → byte0: 0xCD [D,C], byte1: 0xAB [B,A]
      // With ALT: byte0: [C,D], byte1: [A,B] → final: [12,13,10,11]
      expect(PackedDataProcessor.unpackSamples(0xABCD, mode)).toEqual([12, 13, 10, 11]);
    });

    test('should apply ALT per-byte in LONGS modes', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_LONGS_2BIT,
        bitsPerSample: 2,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: true,
        isSigned: false
      };

      // Test with a specific pattern where we can verify ALT is applied per byte
      // 0x11223344 → 
      // byte0: 0x44 = 0b01000100 → [00,01,00,01] → ALT: [01,00,01,00]
      // byte1: 0x33 = 0b00110011 → [11,00,11,00] → ALT: [00,11,00,11]
      // byte2: 0x22 = 0b00100010 → [10,00,10,00] → ALT: [00,10,00,10]
      // byte3: 0x11 = 0b00010001 → [01,00,01,00] → ALT: [00,01,00,01]
      const result = PackedDataProcessor.unpackSamples(0x11223344, mode);
      expect(result).toEqual([
        1, 0, 1, 0,  // byte0 reversed
        0, 3, 0, 3,  // byte1 reversed
        0, 2, 0, 2,  // byte2 reversed
        0, 1, 0, 1   // byte3 reversed
      ]);
    });

    test('should handle ALT with SIGNED modifier', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_2BIT,
        bitsPerSample: 2,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: true,
        isSigned: true
      };

      // 0b11100100 = 228 → [00,01,10,11] → ALT: [11,10,01,00]
      // With SIGNED 2-bit: 11=-1, 10=-2, 01=1, 00=0
      expect(PackedDataProcessor.unpackSamples(0b11100100, mode)).toEqual([-1, -2, 1, 0]);
    });

    test('should not apply ALT when isAlternate is false', () => {
      const modeWithoutAlt: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: false,
        isSigned: false
      };

      const modeWithAlt: PackedDataMode = {
        ...modeWithoutAlt,
        isAlternate: true
      };

      // Without ALT: LSB first extraction
      expect(PackedDataProcessor.unpackSamples(0xF0, modeWithoutAlt)).toEqual([0, 15]);
      
      // With ALT: reversed
      expect(PackedDataProcessor.unpackSamples(0xF0, modeWithAlt)).toEqual([15, 0]);
    });

    test('should handle ALT with edge case values', () => {
      const mode: PackedDataMode = {
        mode: ePackedDataMode.PDM_BYTES_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: true,
        isSigned: false
      };

      // Edge cases
      expect(PackedDataProcessor.unpackSamples(0x00, mode)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(PackedDataProcessor.unpackSamples(0xFF, mode)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
      // 0x55 = 0b01010101 → LSB first: [1,0,1,0,1,0,1,0] → ALT: [0,1,0,1,0,1,0,1]
      expect(PackedDataProcessor.unpackSamples(0x55, mode)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
      // 0xAA = 0b10101010 → LSB first: [0,1,0,1,0,1,0,1] → ALT: [1,0,1,0,1,0,1,0]
      expect(PackedDataProcessor.unpackSamples(0xAA, mode)).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    });
  });

  describe('complex scenarios', () => {
    test('should handle real debug string pattern: longs_1bit ALT SIGNED', () => {
      const keywords = ['longs_1bit', 'ALT', 'SIGNED'];
      const mode = PackedDataProcessor.parsePackedModeKeywords(keywords);

      expect(mode.mode).toBe(ePackedDataMode.PDM_LONGS_1BIT);
      expect(mode.isAlternate).toBe(true);
      expect(mode.isSigned).toBe(true);

      // Test unpacking - should get 32 samples from one long value
      // 0xF0F0F0F0 has alternating nibbles
      const samples = PackedDataProcessor.unpackSamples(0xF0F0F0F0, mode);
      expect(samples.length).toBe(32);
      
      // With ALT, bits are reversed within each byte
      // First byte: 0xF0 = 11110000 → LSB first: [0,0,0,0,1,1,1,1] → ALT: [1,1,1,1,0,0,0,0]
      // With SIGNED 1-bit: 0→0, 1→-1
      expect(samples.slice(0, 8)).toEqual([-1, -1, -1, -1, 0, 0, 0, 0]);
    });

    test('should handle real debug string pattern: words_4bit', () => {
      const [isValid, mode] = PackedDataProcessor.validatePackedMode('words_4bit');
      expect(isValid).toBe(true);

      // Test unpacking 0x1234 should give us 4 samples: 4, 3, 2, 1
      const samples = PackedDataProcessor.unpackSamples(0x1234, mode);
      expect(samples).toEqual([4, 3, 2, 1]); // LSB to MSB order
    });
  });
});