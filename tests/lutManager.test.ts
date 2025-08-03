/** @format */

'use strict';

import { LUTManager } from '../src/classes/shared/lutManager';

describe('LUTManager', () => {
  let manager: LUTManager;

  beforeEach(() => {
    manager = new LUTManager();
  });

  describe('Basic operations', () => {
    it('should start with empty palette', () => {
      expect(manager.getPaletteSize()).toBe(0);
      expect(manager.getPalette()).toEqual([]);
    });

    it('should set and get palette', () => {
      const testPalette = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFFFF];
      manager.setPalette(testPalette);
      
      expect(manager.getPaletteSize()).toBe(4);
      expect(manager.getPalette()).toEqual(testPalette);
    });

    it('should limit palette to 256 entries', () => {
      const largePalette = Array(300).fill(0).map((_, i) => i);
      manager.setPalette(largePalette);
      
      expect(manager.getPaletteSize()).toBe(256);
      expect(manager.getPalette().length).toBe(256);
    });

    it('should mask colors to 24-bit RGB', () => {
      manager.setPalette([0xFF123456]);
      expect(manager.getColor(0)).toBe(0x123456);
    });

    it('should return a copy of palette, not reference', () => {
      const testPalette = [0xFF0000, 0x00FF00];
      manager.setPalette(testPalette);
      
      const retrieved = manager.getPalette();
      retrieved[0] = 0x0000FF;
      
      expect(manager.getColor(0)).toBe(0xFF0000); // Original unchanged
    });
  });

  describe('Individual color operations', () => {
    it('should get colors by index', () => {
      manager.setPalette([0xFF0000, 0x00FF00, 0x0000FF]);
      
      expect(manager.getColor(0)).toBe(0xFF0000);
      expect(manager.getColor(1)).toBe(0x00FF00);
      expect(manager.getColor(2)).toBe(0x0000FF);
    });

    it('should return 0 for undefined indices', () => {
      manager.setPalette([0xFF0000, 0x00FF00]);
      
      expect(manager.getColor(5)).toBe(0);
      expect(manager.getColor(255)).toBe(0);
    });

    it('should return 0 for out of bounds indices', () => {
      manager.setPalette([0xFF0000]);
      
      expect(manager.getColor(-1)).toBe(0);
      expect(manager.getColor(256)).toBe(0);
      expect(manager.getColor(1000)).toBe(0);
    });

    it('should set individual colors', () => {
      manager.setColor(0, 0xFF0000);
      manager.setColor(5, 0x00FF00);
      manager.setColor(255, 0x0000FF);
      
      expect(manager.getColor(0)).toBe(0xFF0000);
      expect(manager.getColor(5)).toBe(0x00FF00);
      expect(manager.getColor(255)).toBe(0x0000FF);
      expect(manager.getPaletteSize()).toBe(256); // Auto-expanded
    });

    it('should expand palette when setting high indices', () => {
      manager.setColor(10, 0xFF0000);
      
      expect(manager.getPaletteSize()).toBe(11);
      expect(manager.getColor(10)).toBe(0xFF0000);
      // Check that intermediate values are 0
      for (let i = 0; i < 10; i++) {
        expect(manager.getColor(i)).toBe(0);
      }
    });

    it('should ignore invalid indices for setColor', () => {
      manager.setColor(-1, 0xFF0000);
      manager.setColor(256, 0xFF0000);
      
      expect(manager.getPaletteSize()).toBe(0);
    });

    it('should mask individual colors to 24-bit', () => {
      manager.setColor(0, 0xFF123456);
      expect(manager.getColor(0)).toBe(0x123456);
    });
  });

  describe('clearPalette', () => {
    it('should clear all colors', () => {
      manager.setPalette([0xFF0000, 0x00FF00, 0x0000FF]);
      manager.clearPalette();
      
      expect(manager.getPaletteSize()).toBe(0);
      expect(manager.getPalette()).toEqual([]);
      expect(manager.getColor(0)).toBe(0);
    });
  });

  describe('loadFromLutColors', () => {
    it('should load numeric values', () => {
      const loaded = manager.loadFromLutColors([0xFF0000, 0x00FF00, 0x0000FF]);
      
      expect(loaded).toBe(3);
      expect(manager.getColor(0)).toBe(0xFF0000);
      expect(manager.getColor(1)).toBe(0x00FF00);
      expect(manager.getColor(2)).toBe(0x0000FF);
    });

    it('should parse hex strings with $ prefix', () => {
      const loaded = manager.loadFromLutColors(['$FF0000', '$00FF00', '$0000FF']);
      
      expect(loaded).toBe(3);
      expect(manager.getColor(0)).toBe(0xFF0000);
      expect(manager.getColor(1)).toBe(0x00FF00);
      expect(manager.getColor(2)).toBe(0x0000FF);
    });

    it('should parse hex strings with # prefix', () => {
      const loaded = manager.loadFromLutColors(['#FF0000', '#00FF00', '#0000FF']);
      
      expect(loaded).toBe(3);
      expect(manager.getColor(0)).toBe(0xFF0000);
      expect(manager.getColor(1)).toBe(0x00FF00);
      expect(manager.getColor(2)).toBe(0x0000FF);
    });

    it('should parse hex strings without prefix', () => {
      const loaded = manager.loadFromLutColors(['FF0000', '00FF00', '0000FF']);
      
      expect(loaded).toBe(3);
      expect(manager.getColor(0)).toBe(0xFF0000);
      expect(manager.getColor(1)).toBe(0x00FF00);
      expect(manager.getColor(2)).toBe(0x0000FF);
    });

    it('should handle mixed formats', () => {
      const loaded = manager.loadFromLutColors([
        0xFF0000,      // Numeric
        '$00FF00',     // $ prefix
        '#0000FF',     // # prefix
        'FFFF00'       // No prefix
      ]);
      
      expect(loaded).toBe(4);
      expect(manager.getColor(0)).toBe(0xFF0000);
      expect(manager.getColor(1)).toBe(0x00FF00);
      expect(manager.getColor(2)).toBe(0x0000FF);
      expect(manager.getColor(3)).toBe(0xFFFF00);
    });

    it('should default invalid strings to 0', () => {
      const loaded = manager.loadFromLutColors(['invalid', 'xyz', '', '0xFF0000']);
      
      expect(loaded).toBe(4);
      expect(manager.getColor(0)).toBe(0);
      expect(manager.getColor(1)).toBe(0);
      expect(manager.getColor(2)).toBe(0);
      expect(manager.getColor(3)).toBe(0xFF0000);
    });

    it('should limit to 256 colors', () => {
      const values = Array(300).fill(0).map((_, i) => i);
      const loaded = manager.loadFromLutColors(values);
      
      expect(loaded).toBe(256);
      expect(manager.getPaletteSize()).toBe(256);
    });

    it('should replace existing palette', () => {
      manager.setPalette([0x111111, 0x222222]);
      const loaded = manager.loadFromLutColors([0xFF0000, 0x00FF00]);
      
      expect(loaded).toBe(2);
      expect(manager.getPaletteSize()).toBe(2);
      expect(manager.getColor(0)).toBe(0xFF0000);
      expect(manager.getColor(1)).toBe(0x00FF00);
    });
  });

  describe('hasColorsForMode', () => {
    it('should check LUT1 mode (2 colors)', () => {
      expect(manager.hasColorsForMode(1)).toBe(false);
      
      manager.setPalette([0x000000]);
      expect(manager.hasColorsForMode(1)).toBe(false);
      
      manager.setPalette([0x000000, 0xFFFFFF]);
      expect(manager.hasColorsForMode(1)).toBe(true);
    });

    it('should check LUT2 mode (4 colors)', () => {
      manager.setPalette([0, 1, 2]);
      expect(manager.hasColorsForMode(2)).toBe(false);
      
      manager.setPalette([0, 1, 2, 3]);
      expect(manager.hasColorsForMode(2)).toBe(true);
    });

    it('should check LUT4 mode (16 colors)', () => {
      manager.setPalette(Array(15).fill(0));
      expect(manager.hasColorsForMode(4)).toBe(false);
      
      manager.setPalette(Array(16).fill(0));
      expect(manager.hasColorsForMode(4)).toBe(true);
    });

    it('should check LUT8 mode (256 colors)', () => {
      manager.setPalette(Array(255).fill(0));
      expect(manager.hasColorsForMode(8)).toBe(false);
      
      manager.setPalette(Array(256).fill(0));
      expect(manager.hasColorsForMode(8)).toBe(true);
    });
  });

  describe('Integration with ColorTranslator', () => {
    it('should provide palette for ColorTranslator LUT modes', () => {
      const testPalette = [
        0x000000, // Black
        0xFFFFFF, // White
        0xFF0000, // Red
        0x00FF00, // Green
      ];
      
      manager.setPalette(testPalette);
      
      // ColorTranslator would use these values
      expect(manager.getColor(0)).toBe(0x000000);
      expect(manager.getColor(1)).toBe(0xFFFFFF);
      expect(manager.getColor(2)).toBe(0xFF0000);
      expect(manager.getColor(3)).toBe(0x00FF00);
    });
  });
});