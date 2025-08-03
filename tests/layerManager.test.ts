/** @format */

'use strict';

// tests/layerManager.test.ts

import { LayerManager, CropRect } from '../src/classes/shared/layerManager';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises');

// Mock OffscreenCanvas
global.OffscreenCanvas = jest.fn().mockImplementation((width, height) => ({
  width,
  height,
  getContext: jest.fn().mockReturnValue({
    drawImage: jest.fn()
  })
})) as any;

// Mock Blob
global.Blob = jest.fn().mockImplementation((parts) => ({
  size: parts[0]?.length || 0,
  type: 'image/bmp'
})) as any;

// Mock createImageBitmap
global.createImageBitmap = jest.fn().mockImplementation((blob) => 
  Promise.resolve({
    width: 100,
    height: 100,
    close: jest.fn()
  })
) as any;

describe('LayerManager', () => {
  let layerManager: LayerManager;
  let mockCanvas: any;
  let mockContext: any;

  beforeEach(() => {
    layerManager = new LayerManager();
    
    // Setup mock canvas and context
    mockContext = {
      drawImage: jest.fn()
    };
    
    mockCanvas = {
      width: 256,
      height: 256,
      getContext: jest.fn().mockReturnValue(mockContext)
    };
    
    // Reset all mocks
    jest.clearAllMocks();
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
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);

      await layerManager.loadLayer(0, '/path/to/image.bmp');

      expect(fs.access).toHaveBeenCalledWith('/path/to/image.bmp');
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/image.bmp');
      expect(createImageBitmap).toHaveBeenCalled();
      expect(layerManager.isLayerLoaded(0)).toBe(true);
    });

    test('should support multiple image formats', async () => {
      const formats = ['.bmp', '.png', '.jpg', '.jpeg', '.gif'];
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);

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
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      (createImageBitmap as jest.Mock).mockRejectedValue(new Error('Invalid image data'));

      await expect(layerManager.loadLayer(0, '/path/to/corrupt.bmp')).rejects.toThrow(
        'Failed to load image: Invalid image data'
      );
    });

    test('should clear existing layer before loading new one', async () => {
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      (createImageBitmap as jest.Mock)
        .mockResolvedValueOnce({ width: 100, height: 100, close: jest.fn() })
        .mockResolvedValueOnce({ width: 200, height: 200, close: jest.fn() });

      await layerManager.loadLayer(0, '/path/to/image1.bmp');
      expect(layerManager.isLayerLoaded(0)).toBe(true);
      
      await layerManager.loadLayer(0, '/path/to/image2.bmp');
      expect(layerManager.isLayerLoaded(0)).toBe(true);
    });
  });

  describe('drawLayerToCanvas', () => {
    beforeEach(async () => {
      // Pre-load a test layer
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      (createImageBitmap as jest.Mock).mockResolvedValue({ width: 256, height: 256, close: jest.fn() });
      await layerManager.loadLayer(0, '/path/to/test.bmp');
    });

    test('should draw full layer in AUTO mode', () => {
      layerManager.drawLayerToCanvas(mockContext, 0);

      expect(mockContext.drawImage).toHaveBeenCalledWith(
        expect.any(Object), // The OffscreenCanvas
        0, // destX
        0  // destY
      );
    });

    test('should draw full layer at specified position in AUTO mode', () => {
      layerManager.drawLayerToCanvas(mockContext, 0, null, 50, 100);

      expect(mockContext.drawImage).toHaveBeenCalledWith(
        expect.any(Object),
        50,  // destX
        100  // destY
      );
    });

    test('should draw cropped region with manual crop rectangle', () => {
      const cropRect: CropRect = {
        left: 10,
        top: 20,
        width: 100,
        height: 80
      };

      layerManager.drawLayerToCanvas(mockContext, 0, cropRect, 30, 40);

      expect(mockContext.drawImage).toHaveBeenCalledWith(
        expect.any(Object),
        10,   // sourceX
        20,   // sourceY
        100,  // sourceWidth
        80,   // sourceHeight
        30,   // destX
        40,   // destY
        100,  // destWidth
        80    // destHeight
      );
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
      mockContext.drawImage.mockImplementation(() => {
        throw new Error('Canvas drawing failed');
      });

      expect(() => layerManager.drawLayerToCanvas(mockContext, 0)).toThrow(
        'Failed to draw layer: Canvas drawing failed'
      );
    });
  });

  describe('getLayerDimensions', () => {
    test('should return dimensions of loaded layer', async () => {
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      (createImageBitmap as jest.Mock).mockResolvedValue({ width: 320, height: 240, close: jest.fn() });
      
      // Reset OffscreenCanvas mock to use the new dimensions
      (global.OffscreenCanvas as jest.Mock).mockImplementationOnce((width, height) => ({
        width,
        height,
        getContext: jest.fn().mockReturnValue({
          drawImage: jest.fn()
        })
      }));
      
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
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      
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
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      
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
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      
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
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      (createImageBitmap as jest.Mock).mockResolvedValue({ width: 100, height: 100, close: jest.fn() });
      
      // Reset OffscreenCanvas mock to use the smaller dimensions
      (global.OffscreenCanvas as jest.Mock).mockImplementationOnce((width, height) => ({
        width,
        height,
        getContext: jest.fn().mockReturnValue({
          drawImage: jest.fn()
        })
      }));
      
      await layerManager.loadLayer(0, '/path/to/image.bmp');
      
      const cropRect: CropRect = {
        left: 50,
        top: 50,
        width: 100, // Extends beyond image bounds
        height: 100
      };
      
      // Should not throw, Canvas API handles this
      layerManager.drawLayerToCanvas(mockContext, 0, cropRect);
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    test('should handle drawing to different context types', async () => {
      const mockBuffer = Buffer.from('fake image data');
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      
      await layerManager.loadLayer(0, '/path/to/image.bmp');
      
      // Test with OffscreenCanvasRenderingContext2D type
      const offscreenContext = {
        drawImage: jest.fn()
      } as any;
      
      layerManager.drawLayerToCanvas(offscreenContext, 0);
      expect(offscreenContext.drawImage).toHaveBeenCalled();
    });
  });
});