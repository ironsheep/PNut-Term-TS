/** @format */

'use strict';

// tests/debugBitmapWin.encoding.test.ts
// Comprehensive tests for bitmap window encoding/decoding and ALT modifier behavior

import { DebugBitmapWindow } from '../src/classes/debugBitmapWin';
import { Context } from '../src/utils/context';
import { ColorMode } from '../src/classes/shared/colorTranslator';
import { PackedDataProcessor } from '../src/classes/shared/packedDataProcessor';
import { ePackedDataMode, ePackedDataWidth } from '../src/classes/debugWindowBase';
import { BrowserWindow } from 'electron';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    show: jest.fn(),
    on: jest.fn(),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }
  }))
}));

jest.mock('../src/utils/context');
jest.mock('../src/classes/shared/colorTranslator');
jest.mock('../src/classes/shared/lutManager');
jest.mock('../src/classes/shared/inputForwarder');
jest.mock('../src/classes/shared/tracePatternProcessor');
jest.mock('../src/classes/shared/canvasRenderer');

describe('DebugBitmapWindow Encoding/Decoding Tests', () => {

  describe('ALT Modifier Parsing in Bitmap Declarations', () => {

    test('should parse longs_1bit with ALT modifier', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'a', 'title', "'LUT1'", 'pos', '100', '100',
        'trace', '2', 'lut1', 'longs_1bit', 'alt'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode).toBeDefined();
      expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_1BIT);
      expect(spec.explicitPackedMode?.bitsPerSample).toBe(1);
      expect(spec.explicitPackedMode?.valueSize).toBe(ePackedDataWidth.PDW_LONGS);
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
      expect(spec.explicitPackedMode?.isSigned).toBe(false);
    });

    test('should parse longs_2bit with ALT modifier', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'b', 'title', "'LUT2'", 'pos', '370', '100',
        'trace', '2', 'lut2', 'longs_2bit', 'alt'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode).toBeDefined();
      expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_2BIT);
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
    });

    test('should parse longs_4bit with ALT modifier', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'c', 'title', "'LUT4'", 'pos', '100', '395',
        'trace', '2', 'lut4', 'longs_4bit', 'alt'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode).toBeDefined();
      expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_4BIT);
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
    });

    test('should parse longs_8bit without ALT modifier', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'd', 'title', "'LUT8'", 'pos', '370', '395',
        'trace', '2', 'lut8', 'longs_8bit'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode).toBeDefined();
      expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_8BIT);
      expect(spec.explicitPackedMode?.isAlternate).toBe(false);
    });

    test('should parse packed mode with both ALT and SIGNED modifiers', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'test', 'longs_4bit', 'alt', 'signed'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode).toBeDefined();
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
      expect(spec.explicitPackedMode?.isSigned).toBe(true);
    });

    test('should parse packed mode with SIGNED only (no ALT)', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'test', 'longs_2bit', 'signed'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode).toBeDefined();
      expect(spec.explicitPackedMode?.isAlternate).toBe(false);
      expect(spec.explicitPackedMode?.isSigned).toBe(true);
    });

    test('should not consume non-modifier tokens after packed mode', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'test', 'longs_1bit', 'alt', 'trace', '2'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
      expect(spec.tracePattern).toBe(2); // TRACE should still be parsed
    });
  });

  describe('PackedDataProcessor Integration - All 7 Formats', () => {

    describe('LUT1 - LONGS_1BIT with ALT', () => {

      test('should extract 32 bits correctly with ALT modifier', () => {
        // Test value: 0x6EE574FD
        // This is actual data from the bird_lut1.bmp file
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_1BIT,
          bitsPerSample: 1,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: true,
          isSigned: false
        };

        const result = PackedDataProcessor.unpackSamples(0x6EE574FD, mode);

        expect(result.length).toBe(32);
        // With ALT, bits are reversed within each byte
        // Byte 0 (0xFD): 11111101
        expect(result.slice(0, 8)).toEqual([1,1,1,1,1,1,0,1]);
        // Byte 1 (0x74): 01110100
        expect(result.slice(8, 16)).toEqual([0,1,1,1,0,1,0,0]);
        // Byte 2 (0xE5): 11100101
        expect(result.slice(16, 24)).toEqual([1,1,1,0,0,1,0,1]);
        // Byte 3 (0x6E): 01101110
        expect(result.slice(24, 32)).toEqual([0,1,1,0,1,1,1,0]);
      });

      test('should extract all 1s correctly', () => {
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_1BIT,
          bitsPerSample: 1,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: true,
          isSigned: false
        };

        const result = PackedDataProcessor.unpackSamples(0xFFFFFFFF, mode);

        expect(result.length).toBe(32);
        expect(result.every(bit => bit === 1)).toBe(true);
      });

      test('should extract all 0s correctly', () => {
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_1BIT,
          bitsPerSample: 1,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: true,
          isSigned: false
        };

        const result = PackedDataProcessor.unpackSamples(0x00000000, mode);

        expect(result.length).toBe(32);
        expect(result.every(bit => bit === 0)).toBe(true);
      });
    });

    describe('LUT2 - LONGS_2BIT with ALT', () => {

      test('should extract 16 2-bit values correctly with ALT', () => {
        // Test value with known 2-bit pattern
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_2BIT,
          bitsPerSample: 2,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: true,
          isSigned: false
        };

        // 0xE4E4E4E4 = 11100100 repeated
        // Without ALT: [00,01,10,11] per byte
        // With ALT: [11,10,01,00] per byte (reversed)
        const result = PackedDataProcessor.unpackSamples(0xE4E4E4E4, mode);

        expect(result.length).toBe(16);
        // Each byte should have pattern [3,2,1,0] with ALT
        expect(result.slice(0, 4)).toEqual([3,2,1,0]);
        expect(result.slice(4, 8)).toEqual([3,2,1,0]);
        expect(result.slice(8, 12)).toEqual([3,2,1,0]);
        expect(result.slice(12, 16)).toEqual([3,2,1,0]);
      });

      test('should handle all possible 2-bit values', () => {
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_2BIT,
          bitsPerSample: 2,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: true,
          isSigned: false
        };

        // 0x1B = 00011011
        // Without ALT (LSB first): [11,10,01,00] = [3,2,1,0]
        // With ALT (reversed): [0,1,2,3]
        const result = PackedDataProcessor.unpackSamples(0x1B, mode);

        expect(result.length).toBe(16);
        expect(result.slice(0, 4)).toEqual([0,1,2,3]); // First byte with ALT
      });
    });

    describe('LUT4 - LONGS_4BIT with ALT', () => {

      test('should extract 8 4-bit values correctly with ALT', () => {
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_4BIT,
          bitsPerSample: 4,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: true,
          isSigned: false
        };

        // 0x12345678
        // Byte 0 (0x78): low=8, high=7 → ALT: [7,8]
        // Byte 1 (0x56): low=6, high=5 → ALT: [5,6]
        // Byte 2 (0x34): low=4, high=3 → ALT: [3,4]
        // Byte 3 (0x12): low=2, high=1 → ALT: [1,2]
        const result = PackedDataProcessor.unpackSamples(0x12345678, mode);

        expect(result.length).toBe(8);
        expect(result).toEqual([7,8, 5,6, 3,4, 1,2]);
      });

      test('should handle nibble patterns correctly', () => {
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_4BIT,
          bitsPerSample: 4,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: true,
          isSigned: false
        };

        // 0xF0 = 11110000 → nibbles [0x0, 0xF] → ALT: [0xF, 0x0]
        const result = PackedDataProcessor.unpackSamples(0xF0, mode);

        expect(result.length).toBe(8);
        expect(result.slice(0, 2)).toEqual([0xF, 0x0]);
      });
    });

    describe('LUT8 - LONGS_8BIT (no ALT)', () => {

      test('should extract 4 8-bit values without ALT', () => {
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_8BIT,
          bitsPerSample: 8,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: false,
          isSigned: false
        };

        // 0x12345678 → [0x78, 0x56, 0x34, 0x12] (LSB first)
        const result = PackedDataProcessor.unpackSamples(0x12345678, mode);

        expect(result.length).toBe(4);
        expect(result).toEqual([0x78, 0x56, 0x34, 0x12]);
      });

      test('should extract palette indices correctly', () => {
        const mode = {
          mode: ePackedDataMode.PDM_LONGS_8BIT,
          bitsPerSample: 8,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: false,
          isSigned: false
        };

        const result = PackedDataProcessor.unpackSamples(0xFF0000AA, mode);

        expect(result.length).toBe(4);
        expect(result).toEqual([0xAA, 0x00, 0x00, 0xFF]);
      });
    });

    describe('RGB8 - 8-bit direct RGB (no packing)', () => {

      test('should use color mode for direct RGB8 values', () => {
        // RGB8 uses ColorMode.RGB8 - 3-3-2 format (RRRGGGBB)
        // Each value is a single byte: R(3 bits) + G(3 bits) + B(2 bits)

        const mode = {
          mode: ePackedDataMode.PDM_UNKNOWN, // No packing for direct values
          bitsPerSample: 8,
          valueSize: ePackedDataWidth.PDW_BYTES,
          isAlternate: false,
          isSigned: false
        };

        // RGB8: 0xE0 = 11100000 = Red(7) + Green(0) + Blue(0)
        const result = PackedDataProcessor.unpackSamples(0xE0, mode);

        expect(result.length).toBe(1);
        expect(result[0]).toBe(0xE0);
      });
    });

    describe('RGB16 - 16-bit direct RGB (no packing)', () => {

      test('should use color mode for direct RGB16 values', () => {
        // RGB16 uses ColorMode.RGB16 - 5-6-5 format
        // Each value is 16 bits: R(5 bits) + G(6 bits) + B(5 bits)

        const mode = {
          mode: ePackedDataMode.PDM_UNKNOWN,
          bitsPerSample: 16,
          valueSize: ePackedDataWidth.PDW_WORDS,
          isAlternate: false,
          isSigned: false
        };

        // RGB16: 0xF800 = Red(31) + Green(0) + Blue(0)
        const result = PackedDataProcessor.unpackSamples(0xF800, mode);

        expect(result.length).toBe(1);
        expect(result[0]).toBe(0xF800);
      });
    });

    describe('RGB24 - 24-bit direct RGB (no packing)', () => {

      test('should use color mode for direct RGB24 values', () => {
        // RGB24 uses ColorMode.RGB24 - full 8-8-8 format
        // Each value is 32 bits (24 bits used): R(8) + G(8) + B(8)

        const mode = {
          mode: ePackedDataMode.PDM_UNKNOWN,
          bitsPerSample: 32,
          valueSize: ePackedDataWidth.PDW_LONGS,
          isAlternate: false,
          isSigned: false
        };

        // RGB24: 0x00FF0000 = Blue(0) + Green(255) + Red(0)
        const result = PackedDataProcessor.unpackSamples(0x00FF0000, mode);

        expect(result.length).toBe(1);
        expect(result[0]).toBe(0x00FF0000);
      });
    });
  });

  describe('Real-World Data from DEBUG_BITMAP_RGB24_Demo.spin2', () => {

    test('LUT1: First data value from bird_lut1.bmp', () => {
      const mode = {
        mode: ePackedDataMode.PDM_LONGS_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: true,
        isSigned: false
      };

      // First long from actual demo: all 1s
      const result = PackedDataProcessor.unpackSamples(0xFFFFFFFF, mode);

      expect(result.length).toBe(32);
      expect(result.every(v => v === 1)).toBe(true);
    });

    test('LUT1: Second data value patterns', () => {
      const mode = {
        mode: ePackedDataMode.PDM_LONGS_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: true,
        isSigned: false
      };

      // Sample from log: 0x6EE574FD
      const result = PackedDataProcessor.unpackSamples(0x6EE574FD, mode);

      expect(result.length).toBe(32);
      // Verify specific pattern matches expected ALT-reversed bits
      expect(result[0]).toBe(1); // First bit of byte 0 after ALT
      expect(result[7]).toBe(1); // Last bit of byte 0 after ALT
    });

    test('LUT2: Verify 2-bit color indices extraction', () => {
      const mode = {
        mode: ePackedDataMode.PDM_LONGS_2BIT,
        bitsPerSample: 2,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: true,
        isSigned: false
      };

      // Each 2-bit value is a LUT index (0-3)
      const result = PackedDataProcessor.unpackSamples(0xE4E4E4E4, mode);

      expect(result.length).toBe(16);
      // All values should be valid LUT2 indices (0-3)
      expect(result.every(v => v >= 0 && v <= 3)).toBe(true);
    });

    test('LUT4: Verify 4-bit color indices extraction', () => {
      const mode = {
        mode: ePackedDataMode.PDM_LONGS_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: true,
        isSigned: false
      };

      // Each 4-bit value is a LUT index (0-15)
      const result = PackedDataProcessor.unpackSamples(0xFEDCBA98, mode);

      expect(result.length).toBe(8);
      // All values should be valid LUT4 indices (0-15)
      expect(result.every(v => v >= 0 && v <= 15)).toBe(true);
    });
  });

  describe('Edge Cases and Error Conditions', () => {

    test('should handle missing ALT gracefully', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'test', 'longs_1bit'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode?.isAlternate).toBe(false);
    });

    test('should handle invalid modifier after packed mode', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'test', 'longs_1bit', 'invalid_modifier'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode?.isAlternate).toBe(false);
    });

    test('should handle case-insensitive ALT', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'test', 'longs_1bit', 'Alt'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
    });

    test('should handle case-insensitive SIGNED', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`bitmap', 'test', 'longs_1bit', 'Signed'
      ]);

      expect(isValid).toBe(true);
      expect(spec.explicitPackedMode?.isSigned).toBe(true);
    });
  });

  describe('Complete Declaration Parsing - All 7 Formats', () => {

    test('should parse complete LUT1 declaration', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(
        ['`bitmap', 'a', 'title', "'LUT1'", 'pos', '100', '100',
         'trace', '2', 'lut1', 'longs_1bit', 'alt']
      );

      expect(isValid).toBe(true);
      expect(spec.displayName).toBe('a');
      expect(spec.title).toBe('LUT1');
      expect(spec.position).toEqual({ x: 100, y: 100 });
      expect(spec.tracePattern).toBe(2);
      expect(spec.colorMode).toBe(ColorMode.LUT1);
      expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_1BIT);
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
    });

    test('should parse complete LUT2 declaration', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(
        ['`bitmap', 'b', 'title', "'LUT2'", 'pos', '370', '100',
         'trace', '2', 'lut2', 'longs_2bit', 'alt']
      );

      expect(isValid).toBe(true);
      expect(spec.colorMode).toBe(ColorMode.LUT2);
      expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_2BIT);
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
    });

    test('should parse complete LUT4 declaration', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(
        ['`bitmap', 'c', 'title', "'LUT4'", 'pos', '100', '395',
         'trace', '2', 'lut4', 'longs_4bit', 'alt']
      );

      expect(isValid).toBe(true);
      expect(spec.colorMode).toBe(ColorMode.LUT4);
      expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_4BIT);
      expect(spec.explicitPackedMode?.isAlternate).toBe(true);
    });

    test('should parse complete LUT8 declaration (no ALT)', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(
        ['`bitmap', 'd', 'title', "'LUT8'", 'pos', '370', '395',
         'trace', '2', 'lut8', 'longs_8bit']
      );

      expect(isValid).toBe(true);
      expect(spec.colorMode).toBe(ColorMode.LUT8);
      expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_8BIT);
      expect(spec.explicitPackedMode?.isAlternate).toBe(false);
    });

    test('should parse complete RGB8 declaration', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(
        ['`bitmap', 'e', 'title', "'RGB8'", 'pos', '100', '690',
         'trace', '2', 'rgb8']
      );

      expect(isValid).toBe(true);
      expect(spec.colorMode).toBe(ColorMode.RGB8);
    });

    test('should parse complete RGB16 declaration', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(
        ['`bitmap', 'f', 'title', "'RGB16'", 'pos', '370', '690',
         'trace', '2', 'rgb16']
      );

      expect(isValid).toBe(true);
      expect(spec.colorMode).toBe(ColorMode.RGB16);
    });

    test('should parse complete RGB24 declaration', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(
        ['`bitmap', 'g', 'title', "'RGB24'", 'pos', '640', '690',
         'trace', '2', 'rgb24']
      );

      expect(isValid).toBe(true);
      expect(spec.colorMode).toBe(ColorMode.RGB24);
    });
  });
});
