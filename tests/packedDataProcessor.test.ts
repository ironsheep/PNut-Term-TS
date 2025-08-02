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

  describe('complex scenarios', () => {
    test('should handle real debug string pattern: longs_1bit ALT SIGNED', () => {
      const keywords = ['longs_1bit', 'ALT', 'SIGNED'];
      const mode = PackedDataProcessor.parsePackedModeKeywords(keywords);

      expect(mode.mode).toBe(ePackedDataMode.PDM_LONGS_1BIT);
      expect(mode.isAlternate).toBe(true);
      expect(mode.isSigned).toBe(true);

      // Test unpacking - should get 32 samples from one long value
      const samples = PackedDataProcessor.unpackSamples(0xAAAAAAAA, mode);
      expect(samples.length).toBe(32);
      // All samples should be either 0 or -1 (since signed 1-bit is 0 or -1)
      for (const sample of samples) {
        expect([0, -1]).toContain(sample);
      }
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