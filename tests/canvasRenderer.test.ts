/** @format */

'use strict';

// tests/canvasRenderer.test.ts

import { CanvasRenderer } from '../src/classes/shared/canvasRenderer';

describe('CanvasRenderer', () => {
  let renderer: CanvasRenderer;

  beforeEach(() => {
    renderer = new CanvasRenderer();
  });

  describe('scrollCanvas', () => {
    test('should generate correct scroll canvas JavaScript', () => {
      const js = renderer.scrollCanvas('myCanvas', 2, 800, 600, 10, 20);
      
      expect(js).toContain("const canvas = document.getElementById('myCanvas')");
      expect(js).toContain('offscreenCanvas.width = 800');
      expect(js).toContain('offscreenCanvas.height = 600');
      expect(js).toContain('ctx.drawImage');
      expect(js).toContain('2, 0, 798, 600'); // scrollSpeed, 0, width-scrollSpeed, height
      expect(js).toContain('10, 20, 798, 600'); // xOffset, yOffset
    });

    test('should handle default offset values', () => {
      const js = renderer.scrollCanvas('testCanvas', 5, 640, 480);
      
      expect(js).toContain('0, 0, 635, 480'); // Default offsets are 0
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
      
      expect(js).toContain('ctx.clearRect(10, 20, 300, 400)');
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
      expect(js).toContain("ctx.fillStyle = '#FF0000'");
      expect(js).toContain('ctx.fill()');
      expect(js).not.toContain('ctx.stroke()');
    });

    test('should draw outline circle', () => {
      const js = renderer.drawCircle('myCanvas', 50, 50, 5, '#00FF00', false, 2);
      
      expect(js).toContain('ctx.arc(50, 50, 5, 0, 2 * Math.PI)');
      expect(js).toContain("ctx.strokeStyle = '#00FF00'");
      expect(js).toContain('ctx.lineWidth = 2');
      expect(js).toContain('ctx.stroke()');
      expect(js).not.toContain('ctx.fill()');
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
});