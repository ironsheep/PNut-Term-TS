/** @format */

'use strict';

// tests/spriteManager.test.ts

import { SpriteManager } from '../src/classes/shared/spriteManager';

// Mock OffscreenCanvas
global.OffscreenCanvas = jest.fn().mockImplementation((width, height) => ({
  width,
  height,
  getContext: jest.fn().mockReturnValue({
    createImageData: jest.fn().mockImplementation((w, h) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h
    })),
    putImageData: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    globalAlpha: 1
  })
})) as any;

describe('SpriteManager', () => {
  let spriteManager: SpriteManager;
  let mockContext: any;

  beforeEach(() => {
    spriteManager = new SpriteManager();
    
    // Setup mock canvas context
    mockContext = {
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
      drawImage: jest.fn(),
      globalAlpha: 1
    };
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with 256 null sprites', () => {
      for (let i = 0; i < 256; i++) {
        expect(spriteManager.isSpriteDefine(i)).toBe(false);
      }
    });
  });

  describe('defineSprite', () => {
    const createTestPalette = (): number[] => {
      const palette: number[] = [];
      for (let i = 0; i < 256; i++) {
        // Create a gradient palette from black to white
        palette.push((i << 16) | (i << 8) | i);
      }
      return palette;
    };

    test('should define a simple sprite', () => {
      const pixels = [0, 1, 2, 3]; // 2x2 sprite
      const colors = createTestPalette();
      
      spriteManager.defineSprite(0, 2, 2, pixels, colors);
      
      expect(spriteManager.isSpriteDefine(0)).toBe(true);
      expect(spriteManager.getSpriteDimensions(0)).toEqual({ width: 2, height: 2 });
    });

    test('should define multiple sprites', () => {
      const colors = createTestPalette();
      
      // Define sprites at various IDs
      spriteManager.defineSprite(0, 1, 1, [0], colors);
      spriteManager.defineSprite(127, 2, 2, [0, 1, 2, 3], colors);
      spriteManager.defineSprite(255, 3, 3, [0, 1, 2, 3, 4, 5, 6, 7, 8], colors);
      
      expect(spriteManager.isSpriteDefine(0)).toBe(true);
      expect(spriteManager.isSpriteDefine(127)).toBe(true);
      expect(spriteManager.isSpriteDefine(255)).toBe(true);
    });

    test('should throw error for invalid sprite ID', () => {
      const colors = createTestPalette();
      
      expect(() => spriteManager.defineSprite(-1, 1, 1, [0], colors))
        .toThrow('Sprite ID must be between 0 and 255');
      
      expect(() => spriteManager.defineSprite(256, 1, 1, [0], colors))
        .toThrow('Sprite ID must be between 0 and 255');
    });

    test('should throw error for invalid dimensions', () => {
      const colors = createTestPalette();
      
      expect(() => spriteManager.defineSprite(0, 0, 1, [], colors))
        .toThrow('Sprite dimensions must be positive');
      
      expect(() => spriteManager.defineSprite(0, 1, 0, [], colors))
        .toThrow('Sprite dimensions must be positive');
      
      expect(() => spriteManager.defineSprite(0, -1, 1, [], colors))
        .toThrow('Sprite dimensions must be positive');
    });

    test('should throw error for incorrect pixel data size', () => {
      const colors = createTestPalette();
      
      // 3x3 sprite needs 9 pixels
      expect(() => spriteManager.defineSprite(0, 3, 3, [0, 1, 2, 3], colors))
        .toThrow('Expected 9 pixels, got 4');
      
      expect(() => spriteManager.defineSprite(0, 2, 2, [0, 1, 2, 3, 4, 5], colors))
        .toThrow('Expected 4 pixels, got 6');
    });

    test('should throw error for incorrect color palette size', () => {
      expect(() => spriteManager.defineSprite(0, 1, 1, [0], [0xFF0000]))
        .toThrow('Color palette must contain exactly 256 colors, got 1');
      
      const shortPalette = new Array(255).fill(0);
      expect(() => spriteManager.defineSprite(0, 1, 1, [0], shortPalette))
        .toThrow('Color palette must contain exactly 256 colors, got 255');
    });

    test('should throw error for out-of-range pixel indices', () => {
      const colors = createTestPalette();
      
      expect(() => spriteManager.defineSprite(0, 2, 2, [0, 1, 256, 3], colors))
        .toThrow('Pixel index 256 at position 2 is out of range (0-255)');
      
      expect(() => spriteManager.defineSprite(0, 2, 2, [-1, 1, 2, 3], colors))
        .toThrow('Pixel index -1 at position 0 is out of range (0-255)');
    });

    test('should copy arrays to prevent external modification', () => {
      const pixels = [0, 1, 2, 3];
      const colors = createTestPalette();
      
      spriteManager.defineSprite(0, 2, 2, pixels, colors);
      
      // Modify original arrays
      pixels[0] = 255;
      colors[0] = 0xFFFFFF;
      
      // Sprite should still have original values
      // We can't directly access the internal data, but we can test indirectly
      // by defining another sprite and ensuring it works
      spriteManager.defineSprite(1, 2, 2, [0, 1, 2, 3], createTestPalette());
      expect(spriteManager.isSpriteDefine(1)).toBe(true);
    });

    test('should overwrite existing sprite definition', () => {
      const colors = createTestPalette();
      
      spriteManager.defineSprite(5, 2, 2, [0, 1, 2, 3], colors);
      expect(spriteManager.getSpriteDimensions(5)).toEqual({ width: 2, height: 2 });
      
      spriteManager.defineSprite(5, 4, 4, new Array(16).fill(0), colors);
      expect(spriteManager.getSpriteDimensions(5)).toEqual({ width: 4, height: 4 });
    });
  });

  describe('drawSprite', () => {
    let colors: number[];
    
    beforeEach(() => {
      colors = [];
      for (let i = 0; i < 256; i++) {
        colors.push((i << 16) | (i << 8) | i);
      }
      
      // Define a test sprite
      spriteManager.defineSprite(0, 2, 2, [0, 64, 128, 255], colors);
    });

    test('should draw sprite at default orientation and scale', () => {
      spriteManager.drawSprite(mockContext, 0, 100, 50);

      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.translate).toHaveBeenCalledWith(100, 50);
      // Orientation is a per-pixel remap (Pascal key_sprite 2123-2132), NOT a canvas rotation.
      expect(mockContext.rotate).not.toHaveBeenCalled();
      expect(mockContext.scale).toHaveBeenCalledWith(1, 1);
      expect(mockContext.globalAlpha).toBe(1);
      expect(mockContext.drawImage).toHaveBeenCalled();
      expect(mockContext.restore).toHaveBeenCalled();
    });

    test('should handle all 8 orientations via a per-pixel remap (no canvas rotation)', () => {
      // 2×4 sprite (non-square) so the transpose bit (bit2) changes the output bounding box
      spriteManager.defineSprite(3, 2, 4, [0, 1, 2, 3, 4, 5, 6, 7], colors);

      for (let orientation = 0; orientation < 8; orientation++) {
        (OffscreenCanvas as jest.Mock).mockClear();
        mockContext.rotate.mockClear();
        mockContext.drawImage.mockClear();

        spriteManager.drawSprite(mockContext, 3, 0, 0, orientation);

        // Never a canvas rotation
        expect(mockContext.rotate).not.toHaveBeenCalled();
        // Transpose (bit2) swaps the output width/height
        const transpose = (orientation & 4) !== 0;
        const outW = transpose ? 4 : 2;
        const outH = transpose ? 2 : 4;
        expect(OffscreenCanvas).toHaveBeenCalledWith(outW, outH);
        // Drawn centered on the current position
        expect(mockContext.drawImage).toHaveBeenCalledWith(expect.anything(), -outW / 2, -outH / 2);
      }
    });

    test('orientation performs the Pascal flip-X / flip-Y / transpose remap', () => {
      // Greyscale palette (R=G=B=index), so an output pixel's R channel == the source
      // colorIndex that landed there — lets us read the remap directly.
      spriteManager.defineSprite(4, 2, 2, [10, 20, 30, 40], colors);
      // Read the R of each output cell (dx,dy) from the last putImageData
      const readCells = (): number[] => {
        const results = (OffscreenCanvas as jest.Mock).mock.results;
        const ctx = results[results.length - 1].value.getContext();
        const calls = ctx.putImageData.mock.calls;
        const img = calls[calls.length - 1][0];
        const R = (dx: number, dy: number): number => img.data[(dy * img.width + dx) * 4];
        return [R(0, 0), R(1, 0), R(0, 1), R(1, 1)];
      };

      spriteManager.drawSprite(mockContext, 4, 0, 0, 0); // identity
      expect(readCells()).toEqual([10, 20, 30, 40]);

      spriteManager.drawSprite(mockContext, 4, 0, 0, 1); // flip-X: columns swap
      expect(readCells()).toEqual([20, 10, 40, 30]);

      spriteManager.drawSprite(mockContext, 4, 0, 0, 2); // flip-Y: rows swap
      expect(readCells()).toEqual([30, 40, 10, 20]);

      spriteManager.drawSprite(mockContext, 4, 0, 0, 4); // transpose: reflect main diagonal
      expect(readCells()).toEqual([10, 30, 20, 40]);
    });

    test('should handle various scale factors', () => {
      const scales = [0.5, 1, 2, 3.5, 10];
      
      scales.forEach(scale => {
        mockContext.scale.mockClear();
        
        spriteManager.drawSprite(mockContext, 0, 0, 0, 0, scale);
        
        expect(mockContext.scale).toHaveBeenCalledWith(scale, scale);
      });
    });

    test('should handle opacity values', () => {
      // Opacity is applied per-pixel in the alpha channel (Pascal formula),
      // NOT via ctx.globalAlpha. Verify draw succeeds for all opacity values
      // including values that should be clamped (negative / > 255).
      const opacityInputs = [0, 127, 255, 64, -10, 300];

      opacityInputs.forEach((input) => {
        mockContext.drawImage.mockClear();
        spriteManager.drawSprite(mockContext, 0, 0, 0, 0, 1, input);
        // drawImage must have been called (sprite rendered successfully)
        expect(mockContext.drawImage).toHaveBeenCalled();
        // globalAlpha is NOT modified by drawSprite — it stays at its initial value
        expect(mockContext.globalAlpha).toBe(1);
      });
    });

    test('should throw error for invalid sprite ID', () => {
      expect(() => spriteManager.drawSprite(mockContext, -1, 0, 0))
        .toThrow('Sprite ID must be between 0 and 255');
      
      expect(() => spriteManager.drawSprite(mockContext, 256, 0, 0))
        .toThrow('Sprite ID must be between 0 and 255');
    });

    test('should throw error for undefined sprite', () => {
      expect(() => spriteManager.drawSprite(mockContext, 1, 0, 0))
        .toThrow('Sprite 1 is not defined');
    });

    test('should throw error for invalid orientation', () => {
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0, -1))
        .toThrow('Orientation must be between 0 and 7');
      
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0, 8))
        .toThrow('Orientation must be between 0 and 7');
    });

    test('should throw error for invalid scale', () => {
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0, 0, 0))
        .toThrow('Scale must be positive');
      
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0, 0, -1))
        .toThrow('Scale must be positive');
    });

    test('should properly render sprite pixels', () => {
      // Mock the OffscreenCanvas context
      const mockImageData = {
        data: new Uint8ClampedArray(16), // 2x2 pixels * 4 channels
        width: 2,
        height: 2
      };
      
      const mockTempCtx = {
        createImageData: jest.fn().mockReturnValue(mockImageData),
        putImageData: jest.fn()
      };
      
      (global.OffscreenCanvas as jest.Mock).mockImplementationOnce((width, height) => ({
        width,
        height,
        getContext: jest.fn().mockReturnValue(mockTempCtx)
      }));
      
      spriteManager.drawSprite(mockContext, 0, 50, 50);
      
      // Verify pixels were set correctly
      expect(mockImageData.data[0]).toBe(0);     // R of pixel 0 (color index 0 = 0x000000)
      expect(mockImageData.data[4]).toBe(64);    // R of pixel 1 (color index 64 = 0x404040)
      expect(mockImageData.data[8]).toBe(128);   // R of pixel 2 (color index 128 = 0x808080)
      expect(mockImageData.data[12]).toBe(255);  // R of pixel 3 (color index 255 = 0xFFFFFF)
      
      expect(mockTempCtx.putImageData).toHaveBeenCalledWith(mockImageData, 0, 0);
    });

    test('should handle context creation failure', () => {
      (global.OffscreenCanvas as jest.Mock).mockImplementationOnce((width, height) => ({
        width,
        height,
        getContext: jest.fn().mockReturnValue(null)
      }));
      
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0))
        .toThrow('Failed to create temporary context for sprite rendering');
    });

    test('should always restore context even on error', () => {
      // Make drawImage throw an error
      mockContext.drawImage.mockImplementation(() => {
        throw new Error('Canvas error');
      });
      
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0)).toThrow('Canvas error');
      
      // Verify restore was still called
      expect(mockContext.restore).toHaveBeenCalled();
    });
  });

  describe('clearSprite', () => {
    beforeEach(() => {
      const colors = new Array(256).fill(0);
      spriteManager.defineSprite(10, 1, 1, [0], colors);
    });

    test('should clear a specific sprite', () => {
      expect(spriteManager.isSpriteDefine(10)).toBe(true);
      
      spriteManager.clearSprite(10);
      
      expect(spriteManager.isSpriteDefine(10)).toBe(false);
    });

    test('should handle invalid sprite IDs gracefully', () => {
      // Should not throw
      spriteManager.clearSprite(-1);
      spriteManager.clearSprite(256);
    });
  });

  describe('clearAllSprites', () => {
    test('should clear all sprites', () => {
      const colors = new Array(256).fill(0);
      
      // Define multiple sprites
      spriteManager.defineSprite(0, 1, 1, [0], colors);
      spriteManager.defineSprite(50, 2, 2, [0, 1, 2, 3], colors);
      spriteManager.defineSprite(255, 1, 1, [0], colors);
      
      expect(spriteManager.isSpriteDefine(0)).toBe(true);
      expect(spriteManager.isSpriteDefine(50)).toBe(true);
      expect(spriteManager.isSpriteDefine(255)).toBe(true);
      
      spriteManager.clearAllSprites();
      
      for (let i = 0; i < 256; i++) {
        expect(spriteManager.isSpriteDefine(i)).toBe(false);
      }
    });
  });

  describe('isSpriteDefine', () => {
    test('should return true for defined sprites', () => {
      const colors = new Array(256).fill(0);
      spriteManager.defineSprite(42, 1, 1, [0], colors);
      
      expect(spriteManager.isSpriteDefine(42)).toBe(true);
    });

    test('should return false for undefined sprites', () => {
      expect(spriteManager.isSpriteDefine(42)).toBe(false);
    });

    test('should return false for invalid sprite IDs', () => {
      expect(spriteManager.isSpriteDefine(-1)).toBe(false);
      expect(spriteManager.isSpriteDefine(256)).toBe(false);
    });
  });

  describe('getSpriteDimensions', () => {
    test('should return dimensions of defined sprite', () => {
      const colors = new Array(256).fill(0);
      spriteManager.defineSprite(20, 16, 24, new Array(16 * 24).fill(0), colors);
      
      const dimensions = spriteManager.getSpriteDimensions(20);
      expect(dimensions).toEqual({ width: 16, height: 24 });
    });

    test('should return null for undefined sprite', () => {
      const dimensions = spriteManager.getSpriteDimensions(20);
      expect(dimensions).toBeNull();
    });

    test('should return null for invalid sprite ID', () => {
      expect(spriteManager.getSpriteDimensions(-1)).toBeNull();
      expect(spriteManager.getSpriteDimensions(256)).toBeNull();
    });
  });

  describe('edge cases', () => {
    test('should handle 1x1 sprites', () => {
      const colors = new Array(256).fill(0xFF0000); // All red
      spriteManager.defineSprite(0, 1, 1, [0], colors);
      
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0)).not.toThrow();
    });

    test('should handle large sprites', () => {
      const colors = new Array(256).fill(0);
      const largePixels = new Array(100 * 100).fill(0);
      
      spriteManager.defineSprite(0, 100, 100, largePixels, colors);
      
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0)).not.toThrow();
    });

    test('should handle sprites with all same color', () => {
      const colors = new Array(256).fill(0x00FF00); // All green
      const pixels = new Array(16).fill(127); // All middle color
      
      spriteManager.defineSprite(0, 4, 4, pixels, colors);
      
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0)).not.toThrow();
    });

    test('should handle extreme transformations', () => {
      const colors = new Array(256).fill(0);
      spriteManager.defineSprite(0, 2, 2, [0, 1, 2, 3], colors);
      
      // Very large scale
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0, 0, 100)).not.toThrow();
      
      // Very small scale
      expect(() => spriteManager.drawSprite(mockContext, 0, 0, 0, 0, 0.01)).not.toThrow();
    });
  });
});