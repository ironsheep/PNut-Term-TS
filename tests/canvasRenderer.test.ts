/** @format */

'use strict';

// tests/canvasRenderer.test.ts

import { CanvasRenderer } from '../src/classes/shared/canvasRenderer';

describe('CanvasRenderer', () => {
  let renderer: CanvasRenderer;
  let mockContext: any;
  let mockImageData: ImageData;
  let mockOffscreenCanvas: any;
  let mockOffscreenContext: any;

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
      canvas: {
        width: 100,
        height: 100
      },
      getImageData: jest.fn().mockReturnValue(mockImageData),
      putImageData: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
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
      ellipse: jest.fn(),
      fill: jest.fn(),
      drawImage: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      measureText: jest.fn().mockReturnValue({ width: 50 })
    };

    // Mock OffscreenCanvas context
    mockOffscreenContext = {
      drawImage: jest.fn()
    };
    
    // Mock OffscreenCanvas - needed for scrollBitmapCtx
    global.OffscreenCanvas = jest.fn().mockImplementation((width, height) => ({
      width,
      height,
      getContext: jest.fn().mockReturnValue(mockOffscreenContext)
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('plotPixelCtx', () => {
    test('should plot a pixel using context directly', () => {
      renderer.plotPixelCtx(mockContext, 10, 20, '#FF0000');
      
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
        renderer.plotPixelCtx(mockContext, x, y, '#FFFFFF');
        
        // Should not call getImageData for out-of-bounds
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
        renderer.plotPixelCtx(mockContext, 0, 0, hex);
        
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

  describe('plotScaledPixelCtx', () => {
    test('should plot scaled pixel using fillRect', () => {
      renderer.plotScaledPixelCtx(mockContext, 5, 10, '#00FF00', 4, 4);
      
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
        renderer.plotScaledPixelCtx(mockContext, x, y, '#FFFFFF', dotX, dotY);
        
        expect(mockContext.fillRect).toHaveBeenCalledWith(expectedX, expectedY, dotX, dotY);
        mockContext.fillRect.mockClear();
      });
    });

    test('should clip to canvas bounds', () => {
      // Canvas is 100x100
      renderer.plotScaledPixelCtx(mockContext, 20, 20, '#FF0000', 5, 5);
      
      // 20 * 5 = 100, which is at the edge
      expect(mockContext.fillRect).not.toHaveBeenCalled();
    });
  });

  describe('scrollBitmapCtx', () => {
    test('should handle horizontal scrolling', () => {
      renderer.scrollBitmapCtx(mockContext, 10, 0);
      
      expect(OffscreenCanvas).toHaveBeenCalledWith(100, 100);
      expect(mockOffscreenContext.drawImage).toHaveBeenCalledWith(mockContext.canvas, 0, 0);
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        expect.any(Object), 0, 0, 90, 100, 10, 0, 90, 100
      );
    });

    test('should handle vertical scrolling', () => {
      renderer.scrollBitmapCtx(mockContext, 0, 10);
      
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        expect.any(Object), 0, 0, 100, 90, 0, 10, 100, 90
      );
    });

    test('should handle diagonal scrolling', () => {
      renderer.scrollBitmapCtx(mockContext, 5, -5);
      
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        expect.any(Object), 0, 5, 95, 95, 5, 0, 95, 95
      );
    });
  });

  describe('drawLineCtx', () => {
    test('should draw line with context directly', () => {
      renderer.drawLineCtx(mockContext, 10, 20, 100, 200, '#FF0000', 2);
      
      expect(mockContext.strokeStyle).toBe('#FF0000');
      expect(mockContext.lineWidth).toBe(2);
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalledWith(10, 20);
      expect(mockContext.lineTo).toHaveBeenCalledWith(100, 200);
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    test('should handle default line width', () => {
      renderer.drawLineCtx(mockContext, 0, 0, 50, 50, 'blue');
      
      expect(mockContext.lineWidth).toBe(1);
    });
  });

  describe('drawDashedLineCtx', () => {
    test('should draw dashed line with context', () => {
      renderer.drawDashedLineCtx(mockContext, 0, 0, 100, 0, '#00FF00', 1, [10, 5]);
      
      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.strokeStyle).toBe('#00FF00');
      expect(mockContext.lineWidth).toBe(1);
      expect(mockContext.setLineDash).toHaveBeenCalledWith([10, 5]);
      expect(mockContext.restore).toHaveBeenCalled();
    });

    test('should use default dash pattern', () => {
      renderer.drawDashedLineCtx(mockContext, 0, 0, 100, 0, 'black');
      
      expect(mockContext.setLineDash).toHaveBeenCalledWith([5, 5]);
    });
  });

  describe('drawTextCtx', () => {
    test('should draw text with context directly', () => {
      renderer.drawTextCtx(mockContext, 'Hello World', 50, 100, '#FFFFFF', '16px', 'Arial', 'center', 'middle');
      
      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.fillStyle).toBe('#FFFFFF');
      expect(mockContext.font).toBe('16px Arial');
      expect(mockContext.textAlign).toBe('center');
      expect(mockContext.textBaseline).toBe('middle');
      expect(mockContext.fillText).toHaveBeenCalledWith('Hello World', 50, 100);
      expect(mockContext.restore).toHaveBeenCalled();
    });

    test('should use default font settings', () => {
      renderer.drawTextCtx(mockContext, 'Test', 0, 0, 'black');
      
      expect(mockContext.font).toBe('12px monospace');
      expect(mockContext.textAlign).toBe('left');
      expect(mockContext.textBaseline).toBe('top');
    });
  });

  describe('clearCanvas', () => {
    test('should clear specific area', () => {
      renderer.clearCanvas(mockContext, 10, 20, 300, 400);
      
      expect(mockContext.clearRect).toHaveBeenCalledWith(10, 20, 300, 400);
    });

    test('should clear entire canvas when dimensions not provided', () => {
      renderer.clearCanvas(mockContext);
      
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
    });
  });

  describe('fillRect', () => {
    test('should fill rectangle with context', () => {
      renderer.fillRect(mockContext, 10, 20, 100, 50, '#0000FF');
      
      expect(mockContext.fillStyle).toBe('#0000FF');
      expect(mockContext.fillRect).toHaveBeenCalledWith(10, 20, 100, 50);
    });
  });

  describe('drawVerticalLine', () => {
    test('should draw solid vertical line', () => {
      renderer.drawVerticalLine(mockContext, 50, 0, 100, '#FF0000', 2, false);
      
      expect(mockContext.strokeStyle).toBe('#FF0000');
      expect(mockContext.lineWidth).toBe(2);
      expect(mockContext.moveTo).toHaveBeenCalledWith(50, 0);
      expect(mockContext.lineTo).toHaveBeenCalledWith(50, 100);
      expect(mockContext.setLineDash).not.toHaveBeenCalled();
    });

    test('should draw dashed vertical line', () => {
      renderer.drawVerticalLine(mockContext, 50, 0, 100, '#FF0000', 2, true);
      
      expect(mockContext.setLineDash).toHaveBeenCalled();
    });
  });

  describe('drawHorizontalLine', () => {
    test('should draw solid horizontal line', () => {
      renderer.drawHorizontalLine(mockContext, 50, 0, 100, '#00FF00', 2, false);
      
      expect(mockContext.strokeStyle).toBe('#00FF00');
      expect(mockContext.lineWidth).toBe(2);
      expect(mockContext.moveTo).toHaveBeenCalledWith(0, 50);
      expect(mockContext.lineTo).toHaveBeenCalledWith(100, 50);
      expect(mockContext.setLineDash).not.toHaveBeenCalled();
    });

    test('should draw dashed horizontal line', () => {
      renderer.drawHorizontalLine(mockContext, 50, 0, 100, '#00FF00', 2, true);
      
      expect(mockContext.setLineDash).toHaveBeenCalled();
    });
  });

  describe('setupCanvas', () => {
    test('should set up canvas defaults', () => {
      renderer.setupCanvas(mockContext);
      
      expect(mockContext.lineCap).toBe('round');
      expect(mockContext.lineJoin).toBe('round');
    });
  });

  describe('drawCircleCtx', () => {
    test('should draw filled circle', () => {
      renderer.drawCircleCtx(mockContext, 100, 100, 10, '#FF0000', true, 1);
      
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.arc).toHaveBeenCalledWith(100, 100, 10, 0, 2 * Math.PI);
      expect(mockContext.fillStyle).toBe('#FF0000');
      expect(mockContext.fill).toHaveBeenCalled();
    });

    test('should draw outline circle', () => {
      renderer.drawCircleCtx(mockContext, 50, 50, 5, '#00FF00', false, 2);
      
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.arc).toHaveBeenCalledWith(50, 50, 5, 0, 2 * Math.PI);
      expect(mockContext.strokeStyle).toBe('#00FF00');
      expect(mockContext.lineWidth).toBe(2);
      expect(mockContext.stroke).toHaveBeenCalled();
    });
  });

  describe('New context-based methods', () => {
    describe('drawOval', () => {
      test('should draw filled oval', () => {
        renderer.drawOval(mockContext, 50, 60, 20, 15, true, '#FF0000', 1);
        
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.ellipse).toHaveBeenCalledWith(50, 60, 20, 15, 0, 0, 2 * Math.PI);
        expect(mockContext.fillStyle).toBe('#FF0000');
        expect(mockContext.fill).toHaveBeenCalled();
      });

      test('should draw outline oval', () => {
        renderer.drawOval(mockContext, 30, 40, 10, 8, false, '#00FF00', 2);
        
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.ellipse).toHaveBeenCalledWith(30, 40, 10, 8, 0, 0, 2 * Math.PI);
        expect(mockContext.strokeStyle).toBe('#00FF00');
        expect(mockContext.lineWidth).toBe(2);
        expect(mockContext.stroke).toHaveBeenCalled();
      });
    });

    describe('drawRect', () => {
      test('should draw filled rectangle', () => {
        renderer.drawRect(mockContext, 10, 20, 50, 60, true, '#0000FF', 1);
        
        expect(mockContext.fillStyle).toBe('#0000FF');
        expect(mockContext.fillRect).toHaveBeenCalledWith(10, 20, 40, 40);
      });

      test('should draw outline rectangle', () => {
        renderer.drawRect(mockContext, 5, 10, 25, 30, false, '#FF00FF', 3);
        
        expect(mockContext.strokeStyle).toBe('#FF00FF');
        expect(mockContext.lineWidth).toBe(3);
        expect(mockContext.strokeRect).toHaveBeenCalledWith(5, 10, 20, 20);
      });
    });

    describe('setOpacity', () => {
      test('should convert 0-255 range to 0-1 globalAlpha', () => {
        const testCases = [
          { input: 0, expected: 0 },
          { input: 127, expected: 127/255 },
          { input: 255, expected: 1 },
          { input: 64, expected: 64/255 }
        ];

        testCases.forEach(({ input, expected }) => {
          renderer.setOpacity(mockContext, input);
          expect(mockContext.globalAlpha).toBeCloseTo(expected, 5);
        });
      });
    });

    describe('drawRotatedText', () => {
      test('should draw rotated text with transforms', () => {
        renderer.drawRotatedText(mockContext, 'Hello', 100, 50, 45, '#FFFFFF', '14px', 'Arial');
        
        expect(mockContext.save).toHaveBeenCalled();
        expect(mockContext.translate).toHaveBeenCalledWith(100, 50);
        expect(mockContext.rotate).toHaveBeenCalledWith((45 * Math.PI) / 180);
        expect(mockContext.fillStyle).toBe('#FFFFFF');
        expect(mockContext.font).toBe('14px Arial');
        expect(mockContext.textAlign).toBe('left');
        expect(mockContext.textBaseline).toBe('top');
        expect(mockContext.fillText).toHaveBeenCalledWith('Hello', 0, 0);
        expect(mockContext.restore).toHaveBeenCalled();
      });

      test('should use default font settings for rotated text', () => {
        renderer.drawRotatedText(mockContext, 'Test', 0, 0, 90, 'black');
        
        expect(mockContext.font).toBe('12px monospace');
      });

      test('should handle various angles', () => {
        const angles = [0, 45, 90, 180, 270, -45, 360];
        
        angles.forEach(angle => {
          mockContext.rotate.mockClear();
          renderer.drawRotatedText(mockContext, 'Test', 0, 0, angle, 'black');
          expect(mockContext.rotate).toHaveBeenCalledWith((angle * Math.PI) / 180);
        });
      });
    });
  });

  describe('Legacy method compatibility', () => {
    test('plotPixel should delegate to plotPixelLegacy', () => {
      const js = renderer.plotPixel('testCanvas', 10, 20, '#FF0000');
      
      expect(js).toContain("const canvas = document.getElementById('testCanvas')");
      expect(js).toContain('const ctx = canvas.getContext(\'2d\')');
      expect(js).toContain('ctx.getImageData(10, 20, 1, 1)');
      expect(js).toContain('ctx.putImageData(imageData, 10, 20)');
    });

    test('plotScaledPixel should delegate to plotScaledPixelLegacy', () => {
      const js = renderer.plotScaledPixel('testCanvas', 5, 10, '#00FF00', 4, 4);
      
      expect(js).toContain("ctx.fillStyle = '#00FF00'");
      expect(js).toContain('ctx.fillRect(scaledX, scaledY, 4, 4)');
    });

    test('scrollBitmap should delegate to scrollBitmapLegacy', () => {
      const js = renderer.scrollBitmap('testCanvas', 10, 0, 100, 100);
      
      expect(js).toContain('const canvas = document.getElementById(\'testCanvas\')');
      expect(js).toContain('offscreenCanvas.width = 100');
      expect(js).toContain('offscreenCanvas.height = 100');
    });
  });

  describe('Performance and memory management', () => {
    test('should use ImageData for single pixel operations', () => {
      renderer.plotPixelCtx(mockContext, 50, 50, '#FFFFFF');
      
      expect(mockContext.getImageData).toHaveBeenCalled();
      expect(mockContext.putImageData).toHaveBeenCalled();
      expect(mockContext.fillRect).not.toHaveBeenCalled();
    });

    test('should use fillRect for scaled pixels', () => {
      renderer.plotScaledPixelCtx(mockContext, 10, 10, '#FFFFFF', 4, 4);
      
      expect(mockContext.fillRect).toHaveBeenCalled();
      expect(mockContext.getImageData).not.toHaveBeenCalled();
    });

    test('should handle large canvas dimensions efficiently', () => {
      mockContext.canvas.width = 2048;
      mockContext.canvas.height = 2048;
      
      renderer.scrollBitmapCtx(mockContext, 1, 1);
      
      expect(OffscreenCanvas).toHaveBeenCalledWith(2048, 2048);
      expect(mockContext.drawImage).toHaveBeenCalledWith(
        expect.any(Object), 0, 0, 2047, 2047, 1, 1, 2047, 2047
      );
    });
  });
});