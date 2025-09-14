import { ScopeXyRenderer } from '../src/classes/shared/scopeXyRenderer';

describe('ScopeXyRenderer', () => {
  let renderer: ScopeXyRenderer;

  beforeEach(() => {
    renderer = new ScopeXyRenderer();
  });

  describe('JavaScript Syntax Validation', () => {
    it('should generate syntactically valid JavaScript for drawCircularGrid', () => {
      const script = renderer.drawCircularGrid('test-canvas', 128, 128, 128, 8);

      // Check for common issues
      expect(script).not.toContain('undefined');
      expect(script).not.toContain('NaN');

      // Check that it's wrapped in an IIFE and returns a value
      expect(script).toContain("(() => {");
      expect(script).toContain("})()");
      expect(script).toContain("return 'Grid drawn successfully'");
      expect(script).toContain("return 'Canvas not found'");

      // Validate JavaScript syntax by creating a function
      let isValid = true;
      let syntaxError = '';
      try {
        // This will throw if there's a syntax error
        new Function(script);
      } catch (error: any) {
        isValid = false;
        syntaxError = error.message;
        console.error('Grid script syntax error:', syntaxError);
        console.error('Script preview:', script.substring(0, 500));
      }

      expect(isValid).toBe(true);
      if (!isValid) {
        fail(`JavaScript syntax error in drawCircularGrid: ${syntaxError}`);
      }
    });

    it('should generate syntactically valid JavaScript for clear', () => {
      const script = renderer.clear('test-canvas', 256, 256, 0x000000);

      let isValid = true;
      try {
        new Function(script);
      } catch (error: any) {
        isValid = false;
        console.error('Clear script error:', error.message);
      }

      expect(isValid).toBe(true);
    });

    it('should generate syntactically valid JavaScript for plotPoint', () => {
      const script = renderer.plotPoint('test-canvas', 100, 100, 0xFF0000, 255, 4);

      let isValid = true;
      try {
        new Function(script);
      } catch (error: any) {
        isValid = false;
        console.error('Plot script error:', error.message);
      }

      expect(isValid).toBe(true);
    });
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default grid color', () => {
      // Default grid color is 0x404040 (gray)
      const gridScript = renderer.drawCircularGrid('test-canvas', 100, 100, 50);
      expect(gridScript).toContain('#404040');
    });

    it('should allow setting grid color', () => {
      renderer.setGridColor(0xFF0000); // Red
      const gridScript = renderer.drawCircularGrid('test-canvas', 100, 100, 50);
      expect(gridScript).toContain('#ff0000');
    });
  });

  describe('transformCartesian', () => {
    it('should apply linear scaling correctly', () => {
      const scale = 2;
      const result = renderer.transformCartesian(10, 20, scale, false, 100);
      expect(result.x).toBe(20); // 10 * 2
      expect(result.y).toBe(40); // 20 * 2
    });

    it('should handle zero values', () => {
      const result = renderer.transformCartesian(0, 0, 2, false, 100);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should handle negative values', () => {
      const result = renderer.transformCartesian(-10, -20, 2, false, 100);
      expect(result.x).toBe(-20);
      expect(result.y).toBe(-40);
    });

    it('should apply log scaling correctly', () => {
      const scale = 1;
      const range = 100;
      const result = renderer.transformCartesian(10, 10, scale, true, range);
      
      // Log scaling formula: r = sqrt(x^2 + y^2), rf = log2(r+1) / log2(range+1)
      const r = Math.sqrt(10 * 10 + 10 * 10); // ~14.14
      const rf = Math.log2(r + 1) / Math.log2(range + 1);
      const theta = Math.atan2(10, 10);
      
      const expectedX = rf * Math.cos(theta) * scale;
      const expectedY = rf * Math.sin(theta) * scale;
      
      expect(result.x).toBeCloseTo(expectedX);
      expect(result.y).toBeCloseTo(expectedY);
    });

    it('should handle log scaling with zero values', () => {
      const result = renderer.transformCartesian(0, 0, 1, true, 100);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('transformPolar', () => {
    it('should convert polar to cartesian with linear scaling', () => {
      const radius = 10;
      const angle = 0;
      const twopi = 0x100000000;
      const theta = 0;
      const scale = 2;
      
      const result = renderer.transformPolar(radius, angle, twopi, theta, scale, false, 100);
      
      // Expected: radius scaled, angle converted to radians
      // tf = PI/2 - (angle + theta) / twopi * PI * 2 = PI/2
      // x = rf * cos(tf) = 20 * cos(PI/2) = 0
      // y = rf * sin(tf) = 20 * sin(PI/2) = 20
      
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(20);
    });

    it('should handle 90 degree rotation', () => {
      const radius = 10;
      const angle = 0x40000000; // 90 degrees in twopi units
      const twopi = 0x100000000;
      const theta = 0;
      const scale = 1;
      
      const result = renderer.transformPolar(radius, angle, twopi, theta, scale, false, 100);
      
      // tf = PI/2 - (0x40000000 / 0x100000000) * 2*PI = PI/2 - PI/2 = 0
      // x = 10 * cos(0) = 10
      // y = 10 * sin(0) = 0
      
      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(0);
    });

    it('should apply theta offset', () => {
      const radius = 10;
      const angle = 0;
      const twopi = 0x100000000;
      const theta = 0x40000000; // 90 degree offset
      const scale = 1;
      
      const result = renderer.transformPolar(radius, angle, twopi, theta, scale, false, 100);
      
      // With theta offset, should rotate the result
      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(0);
    });

    it('should handle log scaling for radius', () => {
      const radius = 10;
      const angle = 0;
      const twopi = 0x100000000;
      const theta = 0;
      const scale = 1;
      const range = 100;
      
      const result = renderer.transformPolar(radius, angle, twopi, theta, scale, true, range);
      
      // Log scaled radius
      const rf = Math.log2(Math.abs(radius)) / Math.log2(range);
      const tf = Math.PI / 2;
      
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(rf);
    });

    it('should handle zero radius with log scaling', () => {
      const result = renderer.transformPolar(0, 0, 0x100000000, 0, 1, true, 100);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('plotPoint', () => {
    it('should generate valid JavaScript code', () => {
      const script = renderer.plotPoint('test-canvas', 100, 200, 0xFF0000, 255, 6);
      
      expect(script).toContain('document.getElementById(\'test-canvas\')');
      expect(script).toContain('ctx.arc(100, 200, 3, 0, Math.PI * 2)');
      expect(script).toContain('ctx.fillStyle = \'#ff0000\'');
      expect(script).toContain('ctx.globalAlpha = 1');
    });

    it('should handle partial opacity', () => {
      const script = renderer.plotPoint('test-canvas', 0, 0, 0x00FF00, 128, 4);
      
      expect(script).toContain('ctx.globalAlpha = 0.5');
      expect(script).toContain('ctx.fillStyle = \'#00ff00\'');
      expect(script).toContain('ctx.arc(0, 0, 2, 0, Math.PI * 2)');
    });

    it('should convert half-pixels to pixels for radius', () => {
      const script = renderer.plotPoint('test-canvas', 50, 50, 0x0000FF, 255, 10);
      
      // dotSize 10 half-pixels = radius 5 pixels
      expect(script).toContain('ctx.arc(50, 50, 5, 0, Math.PI * 2)');
    });

    it('should save and restore context state', () => {
      const script = renderer.plotPoint('test-canvas', 0, 0, 0, 255, 2);
      
      expect(script).toContain('ctx.save()');
      expect(script).toContain('ctx.restore()');
    });
  });

  describe('drawCircularGrid', () => {
    it('should generate grid drawing code', () => {
      const script = renderer.drawCircularGrid('test-canvas', 100, 100, 50, 8);
      
      expect(script).toContain('document.getElementById(\'test-canvas\')');
      expect(script).toContain('ctx.strokeStyle = \'#404040\'');
      expect(script).toContain('ctx.lineWidth = 1');
      expect(script).toContain('ctx.globalAlpha = 0.3');
    });

    it('should draw 4 concentric circles', () => {
      const script = renderer.drawCircularGrid('test-canvas', 100, 100, 50, 8);
      
      expect(script).toContain('const circleCount = 4');
      expect(script).toContain('for (let i = 1; i <= circleCount; i++)');
      expect(script).toContain('ctx.arc(100, 100, r, 0, Math.PI * 2)');
    });

    it('should draw radial lines based on divisions', () => {
      const script = renderer.drawCircularGrid('test-canvas', 100, 100, 50, 8);
      
      expect(script).toContain('for (let i = 0; i < 8; i++)');
      expect(script).toContain('const angle = (i / 8) * Math.PI * 2');
      expect(script).toContain('ctx.moveTo(100, 100)');
    });

    it('should draw center crosshair', () => {
      const script = renderer.drawCircularGrid('test-canvas', 100, 100, 50);

      expect(script).toContain('ctx.globalAlpha = 0.5');
      expect(script).toContain('ctx.moveTo(100 - 50, 100)');
      expect(script).toContain('ctx.lineTo(100 + 50, 100)');
      expect(script).toContain('ctx.moveTo(100, 100 - 50)');
      expect(script).toContain('ctx.lineTo(100, 100 + 50)');
    });

    it('should use custom grid color', () => {
      renderer.setGridColor(0x00FF00);
      const script = renderer.drawCircularGrid('test-canvas', 100, 100, 50);
      
      expect(script).toContain('ctx.strokeStyle = \'#00ff00\'');
    });

    it('should default to 8 divisions', () => {
      const script = renderer.drawCircularGrid('test-canvas', 100, 100, 50);
      
      expect(script).toContain('for (let i = 0; i < 8; i++)');
    });
  });

  describe('clear', () => {
    it('should generate canvas clear code', () => {
      const script = renderer.clear('test-canvas', 200, 200, 0x000000);
      
      expect(script).toContain('document.getElementById(\'test-canvas\')');
      expect(script).toContain('ctx.fillStyle = \'#000000\'');
      expect(script).toContain('ctx.fillRect(0, 0, 200, 200)');
    });

    it('should handle different background colors', () => {
      const script = renderer.clear('test-canvas', 100, 100, 0xFF00FF);
      
      expect(script).toContain('ctx.fillStyle = \'#ff00ff\'');
    });

    it('should use provided dimensions', () => {
      const script = renderer.clear('test-canvas', 640, 480, 0x808080);
      
      expect(script).toContain('ctx.fillRect(0, 0, 640, 480)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small scale values', () => {
      const result = renderer.transformCartesian(100, 100, 0.001, false, 1000);
      expect(result.x).toBeCloseTo(0.1);
      expect(result.y).toBeCloseTo(0.1);
    });

    it('should handle very large scale values', () => {
      const result = renderer.transformCartesian(1, 1, 1000, false, 1);
      expect(result.x).toBe(1000);
      expect(result.y).toBe(1000);
    });

    it('should handle extreme polar angles', () => {
      const result = renderer.transformPolar(10, 0xFFFFFFFF, 0x100000000, 0, 1, false, 100);
      // Should wrap around correctly
      expect(Math.abs(result.x)).toBeLessThanOrEqual(10);
      expect(Math.abs(result.y)).toBeLessThanOrEqual(10);
    });

    it('should handle color values with leading zeros', () => {
      const script = renderer.plotPoint('test', 0, 0, 0x0000FF, 255, 2);
      expect(script).toContain('#0000ff');
      
      const script2 = renderer.plotPoint('test', 0, 0, 0x00000F, 255, 2);
      expect(script2).toContain('#00000f');
    });

    it('should handle zero opacity', () => {
      const script = renderer.plotPoint('test', 0, 0, 0xFFFFFF, 0, 2);
      expect(script).toContain('ctx.globalAlpha = 0');
    });

    it('should handle maximum dot size', () => {
      const script = renderer.plotPoint('test', 0, 0, 0, 255, 20);
      expect(script).toContain('ctx.arc(0, 0, 10, 0, Math.PI * 2)');
    });
  });
});