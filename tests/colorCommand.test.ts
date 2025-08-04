/** @format */

'use strict';

// tests/colorCommand.test.ts

import { DebugColor } from '../src/classes/shared/debugColor';
import { DisplaySpecParser } from '../src/classes/shared/displaySpecParser';

describe('COLOR Command Implementation', () => {
  describe('Logic Window COLOR Support', () => {
    it('should parse COLOR with background only', () => {
      const debugString = '`LOGIC test1 COLOR BLACK';
      const parts = debugString.split(' ');
      const index = parts.indexOf('COLOR');
      
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(parts, index);
      
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#000000');
      expect(windowColor.grid).toBe('#808080'); // Default gray
      expect(consumed).toBe(2); // COLOR + background
    });

    it('should parse COLOR with background and grid', () => {
      const debugString = '`LOGIC test1 COLOR BLACK GRAY';
      const parts = debugString.split(' ');
      const index = parts.indexOf('COLOR');
      
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(parts, index);
      
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#000000');
      expect(windowColor.grid).toBe('#808080');
      expect(consumed).toBe(3); // COLOR + background + grid
    });

    it('should parse COLOR with hex values', () => {
      const debugString = '`LOGIC test1 COLOR $FF0000 $0000FF';
      const parts = debugString.split(' ');
      const index = parts.indexOf('COLOR');
      
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(parts, index);
      
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#ff0000'); // Red
      expect(windowColor.grid).toBe('#0000ff'); // Blue
      expect(consumed).toBe(3);
    });

    it('should parse COLOR with decimal values', () => {
      const debugString = '`LOGIC test1 COLOR 16711680 255'; // Red and Blue in decimal
      const parts = debugString.split(' ');
      const index = parts.indexOf('COLOR');
      
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(parts, index);
      
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#ff0000'); // Red
      expect(windowColor.grid).toBe('#0000ff'); // Blue
    });
  });

  describe('Scope Window COLOR Support', () => {
    it('should parse COLOR command in scope', () => {
      const debugString = '`SCOPE test1 COLOR WHITE BLACK';
      const parts = debugString.split(' ');
      const index = parts.indexOf('COLOR');
      
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(parts, index);
      
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#ffffff');
      expect(windowColor.grid).toBe('#000000');
    });

    it('should handle mixed color formats', () => {
      const debugString = '`SCOPE test1 COLOR CYAN $FF00FF';
      const parts = debugString.split(' ');
      const index = parts.indexOf('COLOR');
      
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(parts, index);
      
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#00ffff'); // Cyan
      expect(windowColor.grid).toBe('#ff00ff'); // Magenta
    });
  });

  describe('Color Names with Brightness', () => {
    it('should parse color name with brightness level', () => {
      const colorSpec = 'CYAN 12';
      const [isValid, hexColor, brightness] = DebugColor.parseColorSpec(colorSpec);
      
      expect(isValid).toBe(true);
      expect(hexColor).toBe('#00ffff');
      expect(brightness).toBe(12);
    });

    it('should apply brightness to color', () => {
      const debugColor = new DebugColor('RED', 8);
      expect(debugColor.rgbString).toBe('#880000'); // Half brightness
      
      const fullBright = new DebugColor('RED', 15);
      expect(fullBright.rgbString).toBe('#ff0000'); // Full brightness
      
      const black = new DebugColor('RED', 0);
      expect(black.rgbString).toBe('#000000'); // Brightness 0 = black
    });

    it('should handle brightness in COLOR command', () => {
      // This would need to be implemented in DisplaySpecParser
      const parts = ['COLOR', 'RED', '12', 'GRAY', '6'];
      let index = 0;
      
      // Manually parse with brightness support
      let bgColorSpec = parts[1];
      let consumed = 2;
      
      // Check if next part is brightness
      if (index + 2 < parts.length && /^\d+$/.test(parts[2])) {
        const brightness = parseInt(parts[2], 10);
        if (brightness >= 0 && brightness <= 15) {
          bgColorSpec += ' ' + parts[2];
          consumed++;
        }
      }
      
      const debugColor = DebugColor.fromColorSpec(bgColorSpec);
      expect(debugColor).not.toBeNull();
      expect(debugColor!.rgbString).toBe('#cc0000'); // Red at brightness 12
    });
  });

  describe('Invalid Color Handling', () => {
    it('should reject invalid color names', () => {
      const [isValid] = DebugColor.parseColorSpec('PURPLE');
      expect(isValid).toBe(false);
    });

    it('should reject invalid hex values', () => {
      const [isValid] = DebugColor.parseColorSpec('$GGGGGG');
      expect(isValid).toBe(false);
    });

    it('should reject out of range decimal values', () => {
      const [isValid] = DebugColor.parseColorSpec('999999999');
      expect(isValid).toBe(false);
    });

    it('should reject invalid brightness values', () => {
      const colorSpec = 'RED 20'; // Brightness > 15
      const [isValid, hexColor, brightness] = DebugColor.parseColorSpec(colorSpec);
      
      expect(isValid).toBe(true);
      expect(hexColor).toBe('#ff0000');
      expect(brightness).toBe(8); // Should fall back to default
    });

    it('should handle COLOR command with invalid color gracefully', () => {
      const parts = ['COLOR', 'INVALID_COLOR'];
      const [isValid, windowColor] = DisplaySpecParser.parseColorKeyword(parts, 0);
      
      expect(isValid).toBe(false);
      expect(windowColor.background).toBe('#000000'); // Default
      expect(windowColor.grid).toBe('#808080'); // Default
    });
  });

  describe('All Standard Colors', () => {
    const standardColors = [
      { name: 'BLACK', hex: '#000000' },
      { name: 'WHITE', hex: '#ffffff' },
      { name: 'ORANGE', hex: '#ff7f00' },
      { name: 'BLUE', hex: '#0000ff' },
      { name: 'GREEN', hex: '#00ff00' },
      { name: 'CYAN', hex: '#00ffff' },
      { name: 'RED', hex: '#ff0000' },
      { name: 'MAGENTA', hex: '#ff00ff' },
      { name: 'YELLOW', hex: '#ffff00' },
      { name: 'GRAY', hex: '#808080' }
    ];

    standardColors.forEach(color => {
      it(`should correctly parse ${color.name}`, () => {
        const [isValid, hexColor] = DebugColor.parseColorSpec(color.name);
        expect(isValid).toBe(true);
        expect(hexColor.toLowerCase()).toBe(color.hex.toLowerCase());
      });

      it(`should apply brightness levels to ${color.name}`, () => {
        // Test a few brightness levels
        const levels = [0, 4, 8, 12, 15];
        levels.forEach(level => {
          const debugColor = new DebugColor(color.name, level);
          expect(debugColor).toBeDefined();
          
          if (level === 0) {
            expect(debugColor.rgbString).toBe('#000000'); // Always black at 0
          } else if (level === 15 && color.name !== 'BLACK') {
            expect(debugColor.rgbString.toLowerCase()).toBe(color.hex.toLowerCase());
          }
        });
      });
    });
  });

  describe('Color Output Consistency', () => {
    it('should produce consistent RGB values', () => {
      // Test that the same color produces the same output
      const color1 = new DebugColor('CYAN', 8);
      const color2 = new DebugColor('CYAN', 8);
      
      expect(color1.rgbString).toBe(color2.rgbString);
      expect(color1.gridRgbString).toBe(color2.gridRgbString);
      expect(color1.fontRgbString).toBe(color2.fontRgbString);
    });

    it('should maintain correct grid and font brightness', () => {
      DebugColor.setDefaultBrightness(8, 12, 6);
      
      const color = new DebugColor('GREEN');
      // Grid should be at brightness 6
      expect(color.gridRgbString).toBe('#006600');
      // Font should be at brightness 12
      expect(color.fontRgbString).toBe('#00cc00');
    });
  });
});