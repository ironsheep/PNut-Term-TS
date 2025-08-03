/** @format */

'use strict';

// tests/canvasRenderer.test.ts

import { CanvasRenderer } from '../src/classes/shared/canvasRenderer';

describe('CanvasRenderer', () => {
  let renderer: CanvasRenderer;
  let mockCanvas: any;
  let mockContext: any;
  let mockImageData: ImageData;
  let mockOffscreenCanvas: any;
  let mockOffscreenContext: any;

  // Helper to execute generated JavaScript
  const executeJS = (js: string) => {
    new Function(js)();
  };

  beforeEach(() => {
    renderer = new CanvasRenderer();
    
    // Mock ImageData
    mockImageData = {
      data: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1
    } as ImageData;

    // Mock canvas context
    mockContext = {
      getImageData: jest.fn().mockReturnValue(mockImageData),
      putImageData: jest.fn(),
      fillRect: jest.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      setLineDash: jest.fn(),
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
      fillText: jest.fn(),
      clearRect: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      lineCap: 'butt',
      lineJoin: 'miter',
      drawImage: jest.fn()
    };

    // Mock canvas element
    mockCanvas = {
      width: 100,
      height: 100,
      getContext: jest.fn().mockReturnValue(mockContext)
    };

    // Mock off-screen canvas
    mockOffscreenContext = {
      drawImage: jest.fn()
    };
    mockOffscreenCanvas = {
      width: 100,
      height: 100,
      getContext: jest.fn().mockReturnValue(mockOffscreenContext)
    };

    // Mock document methods
    global.document = {
      getElementById: jest.fn().mockReturnValue(mockCanvas),
      createElement: jest.fn().mockReturnValue(mockOffscreenCanvas)
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('plotPixel', () => {
    test('should generate correct JavaScript for plotting a pixel', () => {
      const js = renderer.plotPixel('testCanvas', 10, 20, '#FF0000');
      
      // Execute the generated JavaScript
      executeJS(js);
      
      expect(document.getElementById).toHaveBeenCalledWith('testCanvas');
      expect(mockContext.getImageData).toHaveBeenCalledWith(10, 20, 1, 1);
      expect(mockContext.putImageData).toHaveBeenCalledWith(mockImageData, 10, 20);
      
      // Check pixel color was set
      expect(mockImageData.data[0]).toBe(255); // Red
      expect(mockImageData.data[1]).toBe(0);   // Green
      expect(mockImageData.data[2]).toBe(0);   // Blue
      expect(mockImageData.data[3]).toBe(255); // Alpha
    });

    test('should handle boundary conditions', () => {
      const testCases = [
        { x: -1, y: 0 },    // Left boundary
        { x: 100, y: 0 },   // Right boundary
        { x: 0, y: -1 },    // Top boundary
        { x: 0, y: 100 },   // Bottom boundary
        { x: -1, y: -1 },   // Top-left corner
        { x: 100, y: 100 }  // Bottom-right corner
      ];

      testCases.forEach(({ x, y }) => {
        const js = renderer.plotPixel('testCanvas', x, y, '#FFFFFF');
        executeJS(js);
        
        // Should check bounds but not call getImageData for out-of-bounds
        expect(mockContext.getImageData).not.toHaveBeenCalled();
        mockContext.getImageData.mockClear();
      });
    });

    test('should parse hex colors correctly', () => {
      const colors = [
        { hex: '#000000', r: 0, g: 0, b: 0 },
        { hex: '#FFFFFF', r: 255, g: 255, b: 255 },
        { hex: '#FF0000', r: 255, g: 0, b: 0 },
        { hex: '#00FF00', r: 0, g: 255, b: 0 },
        { hex: '#0000FF', r: 0, g: 0, b: 255 },
        { hex: '#123456', r: 18, g: 52, b: 86 }
      ];

      colors.forEach(({ hex, r, g, b }) => {
        const js = renderer.plotPixel('testCanvas', 0, 0, hex);
        executeJS(js);
        
        expect(mockImageData.data[0]).toBe(r);
        expect(mockImageData.data[1]).toBe(g);
        expect(mockImageData.data[2]).toBe(b);
        
        // Reset for next test
        mockImageData.data[0] = 0;
        mockImageData.data[1] = 0;
        mockImageData.data[2] = 0;
      });
    });
  });

  describe('plotScaledPixel', () => {
    test('should generate correct JavaScript for scaled pixel', () => {
      const js = renderer.plotScaledPixel('testCanvas', 5, 10, '#00FF00', 4, 4);
      executeJS(js);
      
      expect(mockContext.fillStyle).toBe('#00FF00');
      expect(mockContext.fillRect).toHaveBeenCalledWith(20, 40, 4, 4);
    });

    test('should handle various dot sizes', () => {
      const testCases = [
        { dotX: 1, dotY: 1, x: 10, y: 10, expectedX: 10, expectedY: 10 },
        { dotX: 2, dotY: 2, x: 10, y: 10, expectedX: 20, expectedY: 20 },
        { dotX: 8, dotY: 4, x: 5, y: 5, expectedX: 40, expectedY: 20 },
        { dotX: 10, dotY: 10, x: 0, y: 0, expectedX: 0, expectedY: 0 }
      ];

      testCases.forEach(({ dotX, dotY, x, y, expectedX, expectedY }) => {
        const js = renderer.plotScaledPixel('testCanvas', x, y, '#FFFFFF', dotX, dotY);
        executeJS(js);
        
        expect(mockContext.fillRect).toHaveBeenCalledWith(expectedX, expectedY, dotX, dotY);
        mockContext.fillRect.mockClear();
      });
    });

    test('should clip to canvas bounds', () => {
      // Canvas is 100x100
      const js = renderer.plotScaledPixel('testCanvas', 20, 20, '#FF0000', 5, 5);
      executeJS(js);
      
      // 20 * 5 = 100, which is at the edge
      expect(mockContext.fillRect).not.toHaveBeenCalled();
    });
  });

  describe('scrollBitmap', () => {
    test('should handle horizontal scrolling', () => {
      const js = renderer.scrollBitmap('testCanvas', 10, 0, 100, 100);
      executeJS(js);
      
      expect(document.createElement).toHaveBeenCalledWith('canvas');
      expect(mockOffscreenCanvas.width).toBe(100);
      expect(mockOffscreenCanvas.height).toBe(100);
      expect(mockOffscreenContext.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0);
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockOffscreenCanvas, 0, 0, 90, 100, 10, 0, 90, 100
      );
    });

    test('should handle vertical scrolling', () => {
      const js = renderer.scrollBitmap('testCanvas', 0, 10, 100, 100);
      executeJS(js);
      
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockOffscreenCanvas, 0, 0, 100, 90, 0, 10, 100, 90
      );
    });

    test('should handle diagonal scrolling', () => {
      const js = renderer.scrollBitmap('testCanvas', 5, -5, 100, 100);
      executeJS(js);
      
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockOffscreenCanvas, 0, 5, 95, 95, 5, 0, 95, 95
      );
    });

    test('should handle all 8 scroll directions', () => {
      const testCases = [
        { x: 10, y: 0, sx: 0, sy: 0, sw: 90, sh: 100, dx: 10, dy: 0 },   // Right
        { x: -10, y: 0, sx: 10, sy: 0, sw: 90, sh: 100, dx: 0, dy: 0 },  // Left
        { x: 0, y: 10, sx: 0, sy: 0, sw: 100, sh: 90, dx: 0, dy: 10 },   // Down
        { x: 0, y: -10, sx: 0, sy: 10, sw: 100, sh: 90, dx: 0, dy: 0 },  // Up
        { x: 10, y: 10, sx: 0, sy: 0, sw: 90, sh: 90, dx: 10, dy: 10 },  // Right-Down
        { x: -10, y: -10, sx: 10, sy: 10, sw: 90, sh: 90, dx: 0, dy: 0 }, // Left-Up
        { x: 10, y: -10, sx: 0, sy: 10, sw: 90, sh: 90, dx: 10, dy: 0 },  // Right-Up
        { x: -10, y: 10, sx: 10, sy: 0, sw: 90, sh: 90, dx: 0, dy: 10 }   // Left-Down
      ];

      testCases.forEach(({ x, y, sx, sy, sw, sh, dx, dy }) => {
        const js = renderer.scrollBitmap('testCanvas', x, y, 100, 100);
        executeJS(js);
        
        expect(mockContext.drawImage).toHaveBeenCalledWith(
          mockOffscreenCanvas, sx, sy, sw, sh, dx, dy, sw, sh
        );
        mockContext.drawImage.mockClear();
        mockContext.clearRect.mockClear();
      });
    });

    test('should handle extreme scroll values', () => {
      // Scroll more than canvas size
      const js = renderer.scrollBitmap('testCanvas', 200, 200, 100, 100);
      executeJS(js);
      
      // Should clear but not draw anything
      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('scrollCanvas', () => {
    test('should generate correct scroll canvas JavaScript', () => {
      const js = renderer.scrollCanvas('myCanvas', 2, 800, 600, 10, 20);
      
      expect(js).toContain("const canvas = document.getElementById('myCanvas')");
      expect(js).toContain('offscreenCanvas.width = 800');
      expect(js).toContain('offscreenCanvas.height = 600');
      expect(js).toContain('ctx.drawImage');
      expect(js).toContain('const scrollX = -2'); // Negative because it scrolls left
      expect(js).toContain('const scrollY = 0');
    });

    test('should handle default offset values', () => {
      const js = renderer.scrollCanvas('testCanvas', 5, 640, 480);
      
      expect(js).toContain('const scrollX = -5');
      expect(js).toContain('const scrollY = 0');
    });
  });

  describe('drawLine', () => {
    test('should generate correct draw line JavaScript', () => {
      const js = renderer.drawLine('myCanvas', 10, 20, 100, 200, '#FF0000', 2);
      
      expect(js).toContain("ctx.strokeStyle = '#FF0000'");
      expect(js).toContain('ctx.lineWidth = 2');
      expect(js).toContain('ctx.moveTo(10, 20)');
      expect(js).toContain('ctx.lineTo(100, 200)');
      expect(js).toContain('ctx.stroke()');
    });

    test('should handle default line width', () => {
      const js = renderer.drawLine('myCanvas', 0, 0, 50, 50, 'blue');
      
      expect(js).toContain('ctx.lineWidth = 1');
    });
  });

  describe('drawDashedLine', () => {
    test('should generate correct dashed line JavaScript', () => {
      const js = renderer.drawDashedLine('myCanvas', 0, 0, 100, 0, '#00FF00', 1, [10, 5]);
      
      expect(js).toContain('ctx.save()');
      expect(js).toContain("ctx.strokeStyle = '#00FF00'");
      expect(js).toContain('ctx.setLineDash([10, 5])');
      expect(js).toContain('ctx.restore()');
    });

    test('should use default dash pattern', () => {
      const js = renderer.drawDashedLine('myCanvas', 0, 0, 100, 0, 'black');
      
      expect(js).toContain('ctx.setLineDash([5, 5])');
    });
  });

  describe('drawText', () => {
    test('should generate correct draw text JavaScript', () => {
      const js = renderer.drawText('myCanvas', 'Hello World', 50, 100, '#FFFFFF', '16px', 'Arial', 'center', 'middle');
      
      expect(js).toContain("ctx.fillStyle = '#FFFFFF'");
      expect(js).toContain("ctx.font = '16px Arial'");
      expect(js).toContain("ctx.textAlign = 'center'");
      expect(js).toContain("ctx.textBaseline = 'middle'");
      expect(js).toContain("ctx.fillText('Hello World', 50, 100)");
    });

    test('should escape special characters in text', () => {
      const js = renderer.drawText('myCanvas', "Test's \"quoted\" text", 0, 0, 'black');
      
      expect(js).toContain("ctx.fillText('Test\\'s \\\"quoted\\\" text', 0, 0)");
    });

    test('should use default font settings', () => {
      const js = renderer.drawText('myCanvas', 'Test', 0, 0, 'black');
      
      expect(js).toContain("ctx.font = '12px monospace'");
      expect(js).toContain("ctx.textAlign = 'left'");
      expect(js).toContain("ctx.textBaseline = 'top'");
    });
  });

  describe('clearCanvas', () => {
    test('should generate correct clear canvas JavaScript', () => {
      const js = renderer.clearCanvas('myCanvas', 10, 20, 300, 400);
      
      expect(js).toContain('const clearWidth = 300');
      expect(js).toContain('const clearHeight = 400');
      expect(js).toContain('ctx.clearRect(10, 20, clearWidth, clearHeight)');
    });

    test('should clear entire canvas when dimensions not provided', () => {
      const js = renderer.clearCanvas('myCanvas');
      
      expect(js).toContain('const clearWidth = canvas.width');
      expect(js).toContain('const clearHeight = canvas.height');
      expect(js).toContain('ctx.clearRect(0, 0, clearWidth, clearHeight)');
    });
  });

  describe('fillRect', () => {
    test('should generate correct fill rect JavaScript', () => {
      const js = renderer.fillRect('myCanvas', 10, 20, 100, 50, '#0000FF');
      
      expect(js).toContain("ctx.fillStyle = '#0000FF'");
      expect(js).toContain('ctx.fillRect(10, 20, 100, 50)');
    });
  });

  describe('drawVerticalLine', () => {
    test('should draw solid vertical line', () => {
      const js = renderer.drawVerticalLine('myCanvas', 50, 0, 100, '#FF0000', 2, false);
      
      expect(js).toContain('ctx.moveTo(50, 0)');
      expect(js).toContain('ctx.lineTo(50, 100)');
      expect(js).not.toContain('setLineDash');
    });

    test('should draw dashed vertical line', () => {
      const js = renderer.drawVerticalLine('myCanvas', 50, 0, 100, '#FF0000', 2, true);
      
      expect(js).toContain('ctx.setLineDash([5, 5])');
    });
  });

  describe('drawHorizontalLine', () => {
    test('should draw solid horizontal line', () => {
      const js = renderer.drawHorizontalLine('myCanvas', 50, 0, 100, '#00FF00', 2, false);
      
      expect(js).toContain('ctx.moveTo(0, 50)');
      expect(js).toContain('ctx.lineTo(100, 50)');
      expect(js).not.toContain('setLineDash');
    });

    test('should draw dashed horizontal line', () => {
      const js = renderer.drawHorizontalLine('myCanvas', 50, 0, 100, '#00FF00', 2, true);
      
      expect(js).toContain('ctx.setLineDash([5, 5])');
    });
  });

  describe('setupCanvas', () => {
    test('should generate correct canvas setup JavaScript', () => {
      const js = renderer.setupCanvas('myCanvas', 1024, 768);
      
      expect(js).toContain('canvas.width = 1024');
      expect(js).toContain('canvas.height = 768');
      expect(js).toContain("ctx.lineCap = 'round'");
      expect(js).toContain("ctx.lineJoin = 'round'");
    });
  });

  describe('drawCircle', () => {
    test('should draw filled circle', () => {
      const js = renderer.drawCircle('myCanvas', 100, 100, 10, '#FF0000', true, 1);
      
      expect(js).toContain('ctx.arc(100, 100, 10, 0, 2 * Math.PI)');
      expect(js).toContain('if (true)');
      expect(js).toContain("ctx.fillStyle = '#FF0000'");
      expect(js).toContain('ctx.fill()');
    });

    test('should draw outline circle', () => {
      const js = renderer.drawCircle('myCanvas', 50, 50, 5, '#00FF00', false, 2);
      
      expect(js).toContain('ctx.arc(50, 50, 5, 0, 2 * Math.PI)');
      expect(js).toContain('if (false)');
      expect(js).toContain("ctx.strokeStyle = '#00FF00'");
      expect(js).toContain('ctx.lineWidth = 2');
      expect(js).toContain('ctx.stroke()');
    });
  });

  describe('error handling', () => {
    test('all methods should check for canvas existence', () => {
      const methods = [
        renderer.scrollCanvas('test', 1, 100, 100),
        renderer.drawLine('test', 0, 0, 10, 10, 'black'),
        renderer.drawDashedLine('test', 0, 0, 10, 10, 'black'),
        renderer.drawText('test', 'text', 0, 0, 'black'),
        renderer.clearCanvas('test'),
        renderer.fillRect('test', 0, 0, 10, 10, 'black'),
        renderer.setupCanvas('test', 100, 100),
        renderer.drawCircle('test', 50, 50, 5, 'black')
      ];

      for (const js of methods) {
        expect(js).toContain('if (!canvas) return');
      }
    });

    test('all drawing methods should check for context', () => {
      const methods = [
        renderer.scrollCanvas('test', 1, 100, 100),
        renderer.drawLine('test', 0, 0, 10, 10, 'black'),
        renderer.drawDashedLine('test', 0, 0, 10, 10, 'black'),
        renderer.drawText('test', 'text', 0, 0, 'black'),
        renderer.clearCanvas('test'),
        renderer.fillRect('test', 0, 0, 10, 10, 'black'),
        renderer.drawCircle('test', 50, 50, 5, 'black')
      ];

      for (const js of methods) {
        expect(js).toContain('if (!ctx) return');
      }
    });
  });

  describe('Performance considerations', () => {
    test('should use ImageData for single pixel operations', () => {
      const js = renderer.plotPixel('testCanvas', 50, 50, '#FFFFFF');
      executeJS(js);
      
      // Should use getImageData/putImageData for single pixel
      expect(mockContext.getImageData).toHaveBeenCalled();
      expect(mockContext.putImageData).toHaveBeenCalled();
      expect(mockContext.fillRect).not.toHaveBeenCalled();
    });

    test('should use fillRect for scaled pixels', () => {
      const js = renderer.plotScaledPixel('testCanvas', 10, 10, '#FFFFFF', 4, 4);
      executeJS(js);
      
      // Should use fillRect for performance
      expect(mockContext.fillRect).toHaveBeenCalled();
      expect(mockContext.getImageData).not.toHaveBeenCalled();
    });

    test('should handle large bitmaps efficiently', () => {
      mockCanvas.width = 2048;
      mockCanvas.height = 2048;
      mockOffscreenCanvas.width = 2048;
      mockOffscreenCanvas.height = 2048;
      
      const js = renderer.scrollBitmap('testCanvas', 1, 1, 2048, 2048);
      executeJS(js);
      
      // Should still use off-screen canvas technique
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockOffscreenCanvas, 0, 0, 2047, 2047, 1, 1, 2047, 2047
      );
    });
  });

  describe('New method error handling', () => {
    test('plotPixel should handle missing canvas gracefully', () => {
      document.getElementById = jest.fn().mockReturnValue(null);
      
      const js = renderer.plotPixel('missingCanvas', 0, 0, '#FFFFFF');
      // Should not throw when executed
      expect(() => executeJS(js)).not.toThrow();
    });

    test('plotPixel should handle missing context gracefully', () => {
      mockCanvas.getContext = jest.fn().mockReturnValue(null);
      
      const js = renderer.plotPixel('testCanvas', 0, 0, '#FFFFFF');
      expect(() => executeJS(js)).not.toThrow();
    });

    test('plotScaledPixel should handle missing canvas gracefully', () => {
      document.getElementById = jest.fn().mockReturnValue(null);
      
      const js = renderer.plotScaledPixel('missingCanvas', 0, 0, '#FFFFFF', 1, 1);
      expect(() => executeJS(js)).not.toThrow();
    });

    test('plotScaledPixel should handle missing context gracefully', () => {
      mockCanvas.getContext = jest.fn().mockReturnValue(null);
      
      const js = renderer.plotScaledPixel('testCanvas', 0, 0, '#FFFFFF', 1, 1);
      expect(() => executeJS(js)).not.toThrow();
    });

    test('scrollBitmap should handle missing canvas gracefully', () => {
      document.getElementById = jest.fn().mockReturnValue(null);
      
      const js = renderer.scrollBitmap('missingCanvas', 0, 0, 100, 100);
      expect(() => executeJS(js)).not.toThrow();
    });

    test('scrollBitmap should handle missing context gracefully', () => {
      mockCanvas.getContext = jest.fn().mockReturnValue(null);
      
      const js = renderer.scrollBitmap('testCanvas', 0, 0, 100, 100);
      expect(() => executeJS(js)).not.toThrow();
    });
  });

  describe('Legacy scrollCanvas method compatibility', () => {
    test('should delegate to scrollBitmap with correct parameters', () => {
      const scrollBitmapSpy = jest.spyOn(renderer, 'scrollBitmap');
      
      renderer.scrollCanvas('testCanvas', 5, 100, 100, 10, 20);
      
      // Legacy method used negative scrollSpeed for left scrolling
      expect(scrollBitmapSpy).toHaveBeenCalledWith('testCanvas', -5, 0, 100, 100);
    });

    test('should ignore offset parameters', () => {
      const scrollBitmapSpy = jest.spyOn(renderer, 'scrollBitmap');
      
      // xOffset and yOffset are ignored in new implementation
      renderer.scrollCanvas('testCanvas', 3, 200, 150, 50, 75);
      
      expect(scrollBitmapSpy).toHaveBeenCalledWith('testCanvas', -3, 0, 200, 150);
    });
  });
});