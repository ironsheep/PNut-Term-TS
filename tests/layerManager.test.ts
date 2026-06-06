/** @format */

'use strict';

// tests/layerManager.test.ts

import { LayerManager, CropRect } from '../src/classes/shared/layerManager';
import * as fs from 'fs/promises';

// Mock fs/promises
jest.mock('fs/promises');

// Helper to create a mock Jimp image
function makeMockJimpImage(width: number = 100, height: number = 100) {
  return {
    width,
    height,
    getPixelColor: jest.fn().mockReturnValue(0xff0000ff) // red, opaque
  };
}

// Mock jimp so Jimp.read() returns a controllable fake image
const mockJimpRead = jest.fn();
jest.mock('jimp', () => ({
  Jimp: {
    read: (...args: any[]) => mockJimpRead(...args)
  }
}));

describe('LayerManager', () => {
  let layerManager: LayerManager;
  let mockContext: any;

  beforeEach(() => {
    layerManager = new LayerManager();

    // Setup mock canvas context with all required methods
    mockContext = {
      drawImage: jest.fn(),
      createImageData: jest.fn().mockImplementation((width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4)
      })),
      putImageData: jest.fn(),
      getImageData: jest.fn().mockImplementation((x: number, y: number, w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      })),
      clearRect: jest.fn(),
      fillRect: jest.fn()
    };

    // Default: fs.access resolves, Jimp.read returns a 100x100 mock image
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    mockJimpRead.mockResolvedValue(makeMockJimpImage(100, 100));

    jest.clearAllMocks();

    // Re-apply defaults after clearAllMocks
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    mockJimpRead.mockResolvedValue(makeMockJimpImage(100, 100));
  });

  describe('constructor', () => {
    test('should initialize with 8 null layers', () => {
      for (let i = 0; i < 8; i++) {
        expect(layerManager.isLayerLoaded(i)).toBe(false);
      }
    });
  });

  describe('loadLayer', () => {
    test('should load a valid bitmap file', async () => {
      await layerManager.loadLayer(0, '/path/to/image.bmp');

      expect(fs.access).toHaveBeenCalledWith('/path/to/image.bmp');
      expect(mockJimpRead).toHaveBeenCalledWith('/path/to/image.bmp');
      expect(layerManager.isLayerLoaded(0)).toBe(true);
    });

    test('should support multiple image formats', async () => {
      const formats = ['.bmp', '.png', '.jpg', '.jpeg', '.gif'];

      for (let i = 0; i < formats.length; i++) {
        await layerManager.loadLayer(i, `/path/to/image${formats[i]}`);
        expect(layerManager.isLayerLoaded(i)).toBe(true);
      }
    });

    test('should throw error for invalid layer index', async () => {
      await expect(layerManager.loadLayer(-1, '/path/to/image.bmp')).rejects.toThrow(
        'Layer index must be between 0 and 7'
      );

      await expect(layerManager.loadLayer(8, '/path/to/image.bmp')).rejects.toThrow(
        'Layer index must be between 0 and 7'
      );
    });

    test('should throw error for unsupported file format', async () => {
      await expect(layerManager.loadLayer(0, '/path/to/image.txt')).rejects.toThrow(
        'Unsupported file format: .txt'
      );
    });

    test('should throw error if file not found', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(layerManager.loadLayer(0, '/path/to/missing.bmp')).rejects.toThrow(
        'File not found: /path/to/missing.bmp'
      );
    });

    test('should throw error if image loading fails', async () => {
      mockJimpRead.mockRejectedValue(new Error('Invalid image data'));

      await expect(layerManager.loadLayer(0, '/path/to/corrupt.bmp')).rejects.toThrow(
        'Failed to load image: Invalid image data'
      );
    });

    test('should clear existing layer before loading new one', async () => {
      mockJimpRead
        .mockResolvedValueOnce(makeMockJimpImage(100, 100))
        .mockResolvedValueOnce(makeMockJimpImage(200, 200));

      await layerManager.loadLayer(0, '/path/to/image1.bmp');
      expect(layerManager.isLayerLoaded(0)).toBe(true);

      await layerManager.loadLayer(0, '/path/to/image2.bmp');
      expect(layerManager.isLayerLoaded(0)).toBe(true);
    });
  });

  describe('drawLayerToCanvas', () => {
    beforeEach(async () => {
      // Pre-load a test layer (256x256)
      mockJimpRead.mockResolvedValue(makeMockJimpImage(256, 256));
      await layerManager.loadLayer(0, '/path/to/test.bmp');
    });

    test('should draw full layer in AUTO mode', () => {
      layerManager.drawLayerToCanvas(mockContext, 0);

      // Implementation uses putImageData for rendering
      expect(mockContext.putImageData).toHaveBeenCalled();
    });

    test('should draw full layer at specified position in AUTO mode', () => {
      layerManager.drawLayerToCanvas(mockContext, 0, null, 50, 100);

      // Implementation uses putImageData for rendering
      expect(mockContext.putImageData).toHaveBeenCalled();
    });

    test('should draw cropped region with manual crop rectangle', () => {
      const cropRect: CropRect = {
        left: 10,
        top: 20,
        width: 100,
        height: 80
      };

      layerManager.drawLayerToCanvas(mockContext, 0, cropRect, 30, 40);

      // Implementation uses putImageData for rendering
      expect(mockContext.putImageData).toHaveBeenCalled();
    });

    test('should throw error for invalid layer index', () => {
      expect(() => layerManager.drawLayerToCanvas(mockContext, -1)).toThrow(
        'Layer index must be between 0 and 7'
      );

      expect(() => layerManager.drawLayerToCanvas(mockContext, 8)).toThrow(
        'Layer index must be between 0 and 7'
      );
    });

    test('should throw error if layer not loaded', () => {
      expect(() => layerManager.drawLayerToCanvas(mockContext, 1)).toThrow(
        'Layer 1 is not loaded'
      );
    });

    test('should handle draw errors gracefully', () => {
      // The source iterates pixels via getPixelColor then calls putImageData.
      // Make putImageData throw to trigger the error path.
      mockContext.putImageData.mockImplementation(() => {
        throw new Error('Canvas drawing failed');
      });

      expect(() => layerManager.drawLayerToCanvas(mockContext, 0)).toThrow(
        'Failed to draw layer: Canvas drawing failed'
      );
    });
  });

  describe('getLayerDimensions', () => {
    test('should return dimensions of loaded layer', async () => {
      mockJimpRead.mockResolvedValue(makeMockJimpImage(320, 240));
      await layerManager.loadLayer(0, '/path/to/image.bmp');

      const dimensions = layerManager.getLayerDimensions(0);
      expect(dimensions).toEqual({ width: 320, height: 240 });
    });

    test('should return null for unloaded layer', () => {
      const dimensions = layerManager.getLayerDimensions(0);
      expect(dimensions).toBeNull();
    });

    test('should return null for invalid layer index', () => {
      expect(layerManager.getLayerDimensions(-1)).toBeNull();
      expect(layerManager.getLayerDimensions(8)).toBeNull();
    });
  });

  describe('clearLayer', () => {
    test('should clear a specific layer', async () => {
      await layerManager.loadLayer(0, '/path/to/image.bmp');
      expect(layerManager.isLayerLoaded(0)).toBe(true);

      layerManager.clearLayer(0);
      expect(layerManager.isLayerLoaded(0)).toBe(false);
    });

    test('should handle invalid layer index gracefully', () => {
      // Should not throw
      layerManager.clearLayer(-1);
      layerManager.clearLayer(8);
    });
  });

  describe('clearAllLayers', () => {
    test('should clear all layers', async () => {
      // Load multiple layers
      await layerManager.loadLayer(0, '/path/to/image1.bmp');
      await layerManager.loadLayer(2, '/path/to/image2.bmp');
      await layerManager.loadLayer(5, '/path/to/image3.bmp');

      expect(layerManager.isLayerLoaded(0)).toBe(true);
      expect(layerManager.isLayerLoaded(2)).toBe(true);
      expect(layerManager.isLayerLoaded(5)).toBe(true);

      layerManager.clearAllLayers();

      for (let i = 0; i < 8; i++) {
        expect(layerManager.isLayerLoaded(i)).toBe(false);
      }
    });
  });

  describe('isLayerLoaded', () => {
    test('should return true for loaded layer', async () => {
      await layerManager.loadLayer(3, '/path/to/image.bmp');
      expect(layerManager.isLayerLoaded(3)).toBe(true);
    });

    test('should return false for unloaded layer', () => {
      expect(layerManager.isLayerLoaded(3)).toBe(false);
    });

    test('should return false for invalid layer index', () => {
      expect(layerManager.isLayerLoaded(-1)).toBe(false);
      expect(layerManager.isLayerLoaded(8)).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle cropping beyond canvas bounds', async () => {
      mockJimpRead.mockResolvedValue(makeMockJimpImage(100, 100));
      await layerManager.loadLayer(0, '/path/to/image.bmp');

      const cropRect: CropRect = {
        left: 50,
        top: 50,
        width: 100, // Extends beyond image bounds (50+100=150 > 100)
        height: 100
      };

      // Source validates bounds and throws when crop rect is out of range
      expect(() => layerManager.drawLayerToCanvas(mockContext, 0, cropRect)).toThrow();
    });

    test('should handle drawing to different context types', async () => {
      await layerManager.loadLayer(0, '/path/to/image.bmp');

      // Test with OffscreenCanvasRenderingContext2D type
      const offscreenContext = {
        drawImage: jest.fn(),
        createImageData: jest.fn().mockImplementation((w: number, h: number) => ({
          width: w, height: h, data: new Uint8ClampedArray(w * h * 4)
        })),
        putImageData: jest.fn()
      } as any;

      layerManager.drawLayerToCanvas(offscreenContext, 0);
      // Implementation uses putImageData, not drawImage
      expect(offscreenContext.putImageData).toHaveBeenCalled();
    });
  });
});
