/** @format */

'use strict';

// tests/debugColor.test.ts

import { DebugColor } from '../src/classes/shared/debugColor';

describe('DebugColor', () => {
  describe('Color Names', () => {
    it('should validate all 10 basic color names', () => {
      const basicColors = ['BLACK', 'WHITE', 'ORANGE', 'BLUE', 'GREEN', 'CYAN', 'RED', 'MAGENTA', 'YELLOW', 'GRAY'];
      
      basicColors.forEach(color => {
        expect(DebugColor.isValidColorName(color)).toBe(true);
        expect(DebugColor.isValidColorName(color.toLowerCase())).toBe(true); // Test case insensitivity
      });
    });

    it('should validate alternative spellings', () => {
      expect(DebugColor.isValidColorName('GREY')).toBe(true); // Alternative spelling for GRAY
    });

    it('should reject invalid color names', () => {
      expect(DebugColor.isValidColorName('PURPLE')).toBe(false);
      expect(DebugColor.isValidColorName('PINK')).toBe(false);
      expect(DebugColor.isValidColorName('')).toBe(false);
    });
  });

  describe('Brightness Levels', () => {
    it('should handle brightness level 0 (black)', () => {
      const redZero = new DebugColor('RED', 0);
      expect(redZero.rgbString).toBe('#000000'); // Brightness 0 is always black
      
      const whiteZero = new DebugColor('WHITE', 0);
      expect(whiteZero.rgbString).toBe('#000000'); // Even white becomes black at brightness 0
    });

    it('should handle brightness level 15 (full color)', () => {
      const redFull = new DebugColor('RED', 15);
      expect(redFull.rgbString).toBe('#ff0000'); // Full red
      
      const blueFull = new DebugColor('BLUE', 15);
      expect(blueFull.rgbString).toBe('#0000ff'); // Full blue
    });

    it('should handle intermediate brightness levels', () => {
      const redHalf = new DebugColor('RED', 8);
      expect(redHalf.rgbString).toBe('#880000'); // Approximately half brightness
      
      const greenQuarter = new DebugColor('GREEN', 4);
      expect(greenQuarter.rgbString).toBe('#004400'); // Approximately quarter brightness
    });

    it('should clamp invalid brightness values', () => {
      const redNegative = new DebugColor('RED', -5);
      expect(redNegative.rgbString).toBe('#880000'); // Should use default brightness (8)
      
      const redTooHigh = new DebugColor('RED', 20);
      expect(redTooHigh.rgbString).toBe('#880000'); // Should use default brightness (8)
    });
  });

  describe('parseColorSpec', () => {
    it('should parse color names', () => {
      const [isValid, hex, brightness] = DebugColor.parseColorSpec('RED');
      expect(isValid).toBe(true);
      expect(hex.toLowerCase()).toBe('#ff0000');
      expect(brightness).toBe(8); // Default brightness
    });

    it('should parse color names with brightness', () => {
      const [isValid, hex, brightness] = DebugColor.parseColorSpec('RED 12');
      expect(isValid).toBe(true);
      expect(hex.toLowerCase()).toBe('#ff0000');
      expect(brightness).toBe(12);
    });

    it('should parse hex colors with $ prefix', () => {
      const [isValid, hex, brightness] = DebugColor.parseColorSpec('$FF00FF');
      expect(isValid).toBe(true);
      expect(hex.toLowerCase()).toBe('#ff00ff');
      expect(brightness).toBe(8); // Default brightness
    });

    it('should parse hex colors with # prefix', () => {
      const [isValid, hex, brightness] = DebugColor.parseColorSpec('#00FF00');
      expect(isValid).toBe(true);
      expect(hex.toLowerCase()).toBe('#00ff00');
      expect(brightness).toBe(8); // Default brightness
    });

    it('should parse decimal color values', () => {
      const [isValid, hex, brightness] = DebugColor.parseColorSpec('16711680'); // Red in decimal
      expect(isValid).toBe(true);
      expect(hex.toLowerCase()).toBe('#ff0000');
      expect(brightness).toBe(8); // Default brightness
    });

    it('should handle invalid color specs', () => {
      const [isValid1] = DebugColor.parseColorSpec('INVALID');
      expect(isValid1).toBe(false);
      
      const [isValid2] = DebugColor.parseColorSpec('$GGGGGG'); // Invalid hex
      expect(isValid2).toBe(false);
      
      const [isValid3, hex3] = DebugColor.parseColorSpec('999999999'); // Too large decimal - should cap at 0xFFFFFF
      expect(isValid3).toBe(true);
      expect(hex3).toBe('#ffffff'); // Capped at max RGB value
    });

    it('should ignore invalid brightness values', () => {
      const [isValid, hex, brightness] = DebugColor.parseColorSpec('RED 20');
      expect(isValid).toBe(true);
      expect(hex.toLowerCase()).toBe('#ff0000');
      expect(brightness).toBe(8); // Should fall back to default, not 20
    });
  });

  describe('fromColorSpec', () => {
    it('should create DebugColor from color name', () => {
      const color = DebugColor.fromColorSpec('CYAN');
      expect(color).not.toBeNull();
      expect(color!.colorName).toBe('CYAN');
      expect(color!.rgbString).toBe('#008888'); // Cyan at default brightness 8
    });

    it('should create DebugColor from color name with brightness', () => {
      const color = DebugColor.fromColorSpec('YELLOW 12');
      expect(color).not.toBeNull();
      expect(color!.colorName).toBe('YELLOW');
      expect(color!.rgbString).toBe('#cccc00'); // Yellow at brightness 12
    });

    it('should create DebugColor from hex value', () => {
      const color = DebugColor.fromColorSpec('$FF7F00');
      expect(color).not.toBeNull();
      expect(color!.colorName).toBe('ORANGE'); // Should match to ORANGE
      expect(color!.rgbString).toBe('#884400'); // Orange at default brightness 8
    });

    it('should return null for invalid color specs', () => {
      expect(DebugColor.fromColorSpec('INVALID')).toBeNull();
      expect(DebugColor.fromColorSpec('')).toBeNull();
    });
  });

  describe('Grid and Font Colors', () => {
    it('should generate correct grid color', () => {
      const red = new DebugColor('RED', 10);
      expect(red.gridRgbString).toBe('#660000'); // Red at grid brightness 6
    });

    it('should generate correct font color', () => {
      const blue = new DebugColor('BLUE', 10);
      expect(blue.fontRgbString).toBe('#0000cc'); // Blue at font brightness 12
    });
  });

  describe('rgbStringWithBrightness', () => {
    it('should return color at specified brightness', () => {
      const green = new DebugColor('GREEN', 8);
      expect(green.rgbStringWithBrightness(0)).toBe('#000000'); // Black
      expect(green.rgbStringWithBrightness(4)).toBe('#004400'); // Quarter brightness
      expect(green.rgbStringWithBrightness(8)).toBe('#008800'); // Half brightness
      expect(green.rgbStringWithBrightness(15)).toBe('#00ff00'); // Full brightness
    });
  });

  describe('Default Brightness Settings', () => {
    it('should allow changing default brightness values', () => {
      // Save original defaults
      const originalBrightness = 8;
      const originalFontBrightness = 12;
      const originalGridBrightness = 6;
      
      // Change defaults
      DebugColor.setDefaultBrightness(10, 14, 4);
      
      // Create new color with new defaults
      const color = new DebugColor('MAGENTA');
      expect(color.rgbString).toBe('#aa00aa'); // Magenta at brightness 10
      expect(color.gridRgbString).toBe('#440044'); // Magenta at grid brightness 4
      expect(color.fontRgbString).toBe('#ee00ee'); // Magenta at font brightness 14
      
      // Restore original defaults
      DebugColor.setDefaultBrightness(originalBrightness, originalFontBrightness, originalGridBrightness);
    });
  });
});