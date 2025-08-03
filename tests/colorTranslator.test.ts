/** @format */

'use strict';

import { ColorTranslator, ColorMode } from '../src/classes/shared/colorTranslator';

describe('ColorTranslator', () => {
  let translator: ColorTranslator;

  beforeEach(() => {
    translator = new ColorTranslator();
  });

  describe('RGB24 mode', () => {
    it('should pass through RGB24 values unchanged', () => {
      translator.setColorMode(ColorMode.RGB24);
      expect(translator.translateColor(0xFF0000)).toBe(0xFF0000); // Red
      expect(translator.translateColor(0x00FF00)).toBe(0x00FF00); // Green
      expect(translator.translateColor(0x0000FF)).toBe(0x0000FF); // Blue
      expect(translator.translateColor(0xFFFFFF)).toBe(0xFFFFFF); // White
      expect(translator.translateColor(0x000000)).toBe(0x000000); // Black
    });

    it('should mask to 24 bits', () => {
      translator.setColorMode(ColorMode.RGB24);
      expect(translator.translateColor(0xFF123456)).toBe(0x123456);
    });
  });

  describe('RGB16 mode', () => {
    it('should convert RGB16 565 format correctly', () => {
      translator.setColorMode(ColorMode.RGB16);
      // Test red (5 bits): 11111 000000 00000
      expect(translator.translateColor(0xF800)).toBe(0xF80000);
      // Test green (6 bits): 00000 111111 00000
      expect(translator.translateColor(0x07E0)).toBe(0x00FC00);
      // Test blue (5 bits): 00000 000000 11111
      expect(translator.translateColor(0x001F)).toBe(0x0000F8);
      // Test white
      expect(translator.translateColor(0xFFFF)).toBe(0xFCFCFC);
    });
  });

  describe('RGB8 mode', () => {
    it('should convert RGB8 332 format correctly', () => {
      translator.setColorMode(ColorMode.RGB8);
      // Test red (3 bits): 111 00 000
      expect(translator.translateColor(0xE0)).toBe(0xFF0000);
      // Test green (3 bits): 000 111 00
      expect(translator.translateColor(0x1C)).toBe(0x00FF00);
      // Test blue (2 bits): 000 00 11
      expect(translator.translateColor(0x03)).toBe(0x0000FF);
      // Test white
      expect(translator.translateColor(0xFF)).toBe(0xFFFFFF);
    });
  });

  describe('LUT modes', () => {
    const testPalette = [
      0x000000, // 0 - Black
      0xFFFFFF, // 1 - White
      0xFF0000, // 2 - Red
      0x00FF00, // 3 - Green
      0x0000FF, // 4 - Blue
      0xFFFF00, // 5 - Yellow
      0xFF00FF, // 6 - Magenta
      0x00FFFF, // 7 - Cyan
      0x808080, // 8 - Gray
    ];

    beforeEach(() => {
      translator.setLutPalette(testPalette);
    });

    it('should handle LUT1 mode (1-bit)', () => {
      translator.setColorMode(ColorMode.LUT1);
      expect(translator.translateColor(0)).toBe(0x000000); // Black
      expect(translator.translateColor(1)).toBe(0xFFFFFF); // White
      expect(translator.translateColor(2)).toBe(0x000000); // Wraps to 0
      expect(translator.translateColor(3)).toBe(0xFFFFFF); // Wraps to 1
    });

    it('should handle LUT2 mode (2-bit)', () => {
      translator.setColorMode(ColorMode.LUT2);
      expect(translator.translateColor(0)).toBe(0x000000); // Black
      expect(translator.translateColor(1)).toBe(0xFFFFFF); // White
      expect(translator.translateColor(2)).toBe(0xFF0000); // Red
      expect(translator.translateColor(3)).toBe(0x00FF00); // Green
      expect(translator.translateColor(4)).toBe(0x000000); // Wraps to 0
    });

    it('should handle LUT4 mode (4-bit)', () => {
      translator.setColorMode(ColorMode.LUT4);
      for (let i = 0; i < 9; i++) {
        expect(translator.translateColor(i)).toBe(testPalette[i & 0x0F]);
      }
      expect(translator.translateColor(16)).toBe(0x000000); // Wraps to 0
    });

    it('should handle LUT8 mode (8-bit)', () => {
      translator.setColorMode(ColorMode.LUT8);
      for (let i = 0; i < 9; i++) {
        expect(translator.translateColor(i)).toBe(testPalette[i]);
      }
      expect(translator.translateColor(256)).toBe(0x000000); // Wraps to 0
    });

    it('should return 0 for undefined palette entries', () => {
      translator.setColorMode(ColorMode.LUT8);
      expect(translator.translateColor(100)).toBe(0); // No palette entry
    });
  });

  describe('LUMA8 modes', () => {
    it('should handle LUMA8 with different color tunes', () => {
      translator.setColorMode(ColorMode.LUMA8, 0); // Orange
      expect(translator.translateColor(0x00)).toBe(0x000000); // Black
      expect(translator.translateColor(0xFF)).toBe(0xFF7F00); // Full orange
      expect(translator.translateColor(0x80)).toBe(0x7F3F00); // Half orange

      translator.setColorMode(ColorMode.LUMA8, 4); // Red
      expect(translator.translateColor(0xFF)).toBe(0xFF0000); // Full red
      expect(translator.translateColor(0x80)).toBe(0x7F0000); // Half red
    });

    it('should handle LUMA8W (white to color)', () => {
      translator.setColorMode(ColorMode.LUMA8W, 2); // Green
      expect(translator.translateColor(0x00)).toBe(0xFFFFFF); // White
      expect(translator.translateColor(0xFF)).toBe(0x00FF00); // Full green
      expect(translator.translateColor(0x80)).toBe(0x7FFF7F); // Half way
    });

    it('should handle LUMA8X (black to color to white)', () => {
      translator.setColorMode(ColorMode.LUMA8X, 1); // Blue
      expect(translator.translateColor(0x00)).toBe(0x000000); // Black
      expect(translator.translateColor(0x7F)).toBe(0x0000FE); // Almost full blue
      expect(translator.translateColor(0x80)).toBe(0x000000); // Start white transition
      expect(translator.translateColor(0xFF)).toBe(0xFFFFFF); // White
    });
  });

  describe('RGBI8 modes', () => {
    it('should extract color index from upper 3 bits', () => {
      translator.setColorMode(ColorMode.RGBI8);
      // Color index 0 (orange), intensity 0x1F
      expect(translator.translateColor(0x1F)).toBe(0xFF7F00);
      // Color index 4 (red), intensity 0x1F
      expect(translator.translateColor(0x9F)).toBe(0xFF0000);
    });

    it('should handle RGBI8W and RGBI8X modes', () => {
      translator.setColorMode(ColorMode.RGBI8W);
      expect(translator.translateColor(0x00)).toBe(0xFFFFFF); // White

      translator.setColorMode(ColorMode.RGBI8X);
      expect(translator.translateColor(0x00)).toBe(0x000000); // Black
      expect(translator.translateColor(0xFF)).toBe(0xFFFFFF); // White
    });
  });

  describe('HSV modes', () => {
    it('should handle HSV8 basic colors', () => {
      translator.setColorMode(ColorMode.HSV8, 0);
      // Hue 0 (red), full saturation and value
      expect(translator.translateColor(0xFF)).toBe(0xFF0000);
      // Hue 85 (green), full saturation and value
      expect(translator.translateColor(0x5F)).toBe(0x00FF00);
      // Hue 170 (blue), full saturation and value
      expect(translator.translateColor(0xAF)).toBe(0x0000FF);
    });

    it('should handle HSV8W (inverted colors)', () => {
      translator.setColorMode(ColorMode.HSV8W, 0);
      // Should invert the color
      expect(translator.translateColor(0xFF)).toBe(0x00FFFF); // Cyan instead of red
    });

    it('should handle HSV8X (transition mode)', () => {
      translator.setColorMode(ColorMode.HSV8X, 0);
      // Lower half: normal colors
      expect(translator.translateColor(0x7F)).toBe(0xFE0000); // Almost full red
      // Upper half: inverted colors
      expect(translator.translateColor(0xFF)).toBe(0x00FFFF); // Cyan
    });

    it('should handle HSV16 modes', () => {
      translator.setColorMode(ColorMode.HSV16, 0);
      // 16-bit HSV with hue in upper byte
      expect(translator.translateColor(0x00FF)).toBe(0xFF0000); // Red
      expect(translator.translateColor(0x55FF)).toBe(0x00FF00); // Green
      expect(translator.translateColor(0xAAFF)).toBe(0x0000FF); // Blue
    });

    it('should apply color tune offset', () => {
      translator.setColorMode(ColorMode.HSV8, 85); // Offset to green
      expect(translator.translateColor(0x0F)).toBe(0x00FF00); // Green instead of red
    });
  });

  describe('Edge cases', () => {
    it('should handle maximum values', () => {
      translator.setColorMode(ColorMode.RGB24);
      expect(translator.translateColor(0xFFFFFFFF)).toBe(0xFFFFFF);

      translator.setColorMode(ColorMode.RGB16);
      expect(translator.translateColor(0xFFFF)).toBe(0xFCFCFC);

      translator.setColorMode(ColorMode.RGB8);
      expect(translator.translateColor(0xFF)).toBe(0xFFFFFF);
    });

    it('should handle zero values', () => {
      translator.setColorMode(ColorMode.RGB24);
      expect(translator.translateColor(0)).toBe(0);

      translator.setColorMode(ColorMode.RGB16);
      expect(translator.translateColor(0)).toBe(0);

      translator.setColorMode(ColorMode.RGB8);
      expect(translator.translateColor(0)).toBe(0);
    });
  });

  describe('parseColorMode', () => {
    it('should parse valid color mode strings', () => {
      expect(ColorTranslator.parseColorMode('RGB24')).toBe(ColorMode.RGB24);
      expect(ColorTranslator.parseColorMode('rgb24')).toBe(ColorMode.RGB24);
      expect(ColorTranslator.parseColorMode('LUT8')).toBe(ColorMode.LUT8);
      expect(ColorTranslator.parseColorMode('HSV16X')).toBe(ColorMode.HSV16X);
    });

    it('should return null for invalid mode strings', () => {
      expect(ColorTranslator.parseColorMode('INVALID')).toBeNull();
      expect(ColorTranslator.parseColorMode('')).toBeNull();
      expect(ColorTranslator.parseColorMode('RGB32')).toBeNull();
    });
  });

  describe('Color mode getter', () => {
    it('should return the current color mode', () => {
      expect(translator.getColorMode()).toBe(ColorMode.RGB24); // Default
      
      translator.setColorMode(ColorMode.LUT8);
      expect(translator.getColorMode()).toBe(ColorMode.LUT8);
      
      translator.setColorMode(ColorMode.HSV16X);
      expect(translator.getColorMode()).toBe(ColorMode.HSV16X);
    });
  });
});