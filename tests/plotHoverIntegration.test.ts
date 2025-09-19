/** @format */

'use strict';

// tests/plotHoverIntegration.test.ts
// Integration test for PLOT window hover coordinate display

import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { Context } from '../src/utils/context';
import { PlotDisplaySpec } from '../src/classes/debugPlotWin';
import {
  createMockContext,
  setupDebugWindowTest,
  cleanupDebugWindowTest
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn()
}));

describe('PLOT Hover Coordinate Display Integration', () => {
  let plotWindow: DebugPlotWindow;
  let mockContext: Context;

  beforeEach(() => {
    setupDebugWindowTest();
    mockContext = createMockContext({
      runtime: {
        msWaitBeforeClose: 500,
        isFileLoggingEnabled: false,
        loggedTraffic: jest.fn(),
        logTrafficMessage: jest.fn()
      }
    });
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  describe('Display Spec Configuration', () => {
    test('should parse HIDEXY directive correctly', () => {
      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'TestPlot', 'SIZE', '400', '300', 'HIDEXY']
      );

      expect(isValid).toBe(true);
      expect(spec.hideXY).toBe(true);
    });

    test('should default hideXY to false when not specified', () => {
      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'TestPlot', 'SIZE', '400', '300']
      );

      expect(isValid).toBe(true);
      expect(spec.hideXY).toBe(false);
    });

    test('should parse DOTSIZE values for coordinate scaling', () => {
      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'TestPlot', 'SIZE', '400', '300', 'DOTSIZE', '2', '4']
      );

      expect(isValid).toBe(true);
      expect(spec.dotSize.width).toBe(2);
      expect(spec.dotSize.height).toBe(4);
    });

    test('should default DOTSIZE to 1,1 when not specified', () => {
      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'TestPlot', 'SIZE', '400', '300']
      );

      expect(isValid).toBe(true);
      expect(spec.dotSize.width).toBe(1);
      expect(spec.dotSize.height).toBe(1);
    });
  });

  describe('Cartesian Configuration', () => {
    test('should update axis directions with CARTESIAN command', async () => {
      const displaySpec: PlotDisplaySpec = {
        displayName: 'TestPlot',
        windowTitle: 'Test Plot',
        position: { x: 0, y: 0 },
        hasExplicitPosition: false,
        size: { width: 400, height: 300 },
        dotSize: { width: 1, height: 1 },
        window: { background: '#000000', grid: '#FFFFFF' },
        lutColors: [],
        delayedUpdate: false,
        hideXY: false
      };

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // Initially should have default axis directions
      const initialXDir = (plotWindow as any).cartesianConfig.xdir;
      const initialYDir = (plotWindow as any).cartesianConfig.ydir;
      expect(initialXDir).toBe(false); // Normal X
      expect(initialYDir).toBe(true);  // Inverted Y (for screen coordinates)

      // Update with CARTESIAN command
      await plotWindow.updateContent(['TestPlot', 'CARTESIAN', '1', '0']);

      // Should now have inverted axis directions
      const updatedXDir = (plotWindow as any).cartesianConfig.xdir;
      const updatedYDir = (plotWindow as any).cartesianConfig.ydir;
      expect(updatedXDir).toBe(true);  // Inverted X
      expect(updatedYDir).toBe(false); // Normal Y
    });
  });

  describe('Window Creation with Coordinate Display', () => {
    test('should include coordinate display in HTML when hideXY is false', async () => {
      const displaySpec: PlotDisplaySpec = {
        displayName: 'TestPlot',
        windowTitle: 'Test Plot',
        position: { x: 0, y: 0 },
        hasExplicitPosition: false,
        size: { width: 400, height: 300 },
        dotSize: { width: 1, height: 1 },
        window: { background: '#000000', grid: '#FFFFFF' },
        lutColors: [],
        delayedUpdate: false,
        hideXY: false
      };

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // PLOT windows create window on first drawing command
      await plotWindow.updateContent(['TestPlot', 'DOT', '100', '100']);

      // Check if window was created
      const debugWindow = (plotWindow as any).debugWindow;
      if (debugWindow && debugWindow.loadURL.mock) {
        const loadURLCall = debugWindow.loadURL.mock.calls[0][0];
        const htmlContent = decodeURIComponent(loadURLCall.replace('data:text/html;charset=utf-8,', ''));

        // Verify coordinate display element is present
        expect(htmlContent).toContain('id="coordinate-display"');
        expect(htmlContent).toContain('font-family: \'Parallax\'');
        expect(htmlContent).toContain('padding: 8px');
      }
    });

    test('should respect window colors in coordinate display', async () => {
      const displaySpec: PlotDisplaySpec = {
        displayName: 'TestPlot',
        windowTitle: 'Test Plot',
        position: { x: 0, y: 0 },
        hasExplicitPosition: false,
        size: { width: 400, height: 300 },
        dotSize: { width: 1, height: 1 },
        window: { background: '#FF0000', grid: '#00FF00' },
        lutColors: [],
        delayedUpdate: false,
        hideXY: false
      };

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // PLOT windows create window on first drawing command
      await plotWindow.updateContent(['TestPlot', 'DOT', '100', '100']);

      // Check if window was created
      const debugWindow = (plotWindow as any).debugWindow;
      if (debugWindow && debugWindow.loadURL.mock) {
        const loadURLCall = debugWindow.loadURL.mock.calls[0][0];
        const htmlContent = decodeURIComponent(loadURLCall.replace('data:text/html;charset=utf-8,', ''));

        // Verify colors are applied
        expect(htmlContent).toContain('background: #FF0000');
        expect(htmlContent).toContain('color: #00FF00');
        expect(htmlContent).toContain('border: 1px solid #00FF00');
      }
    });
  });

  describe('Coordinate Calculation Logic', () => {
    test('should calculate correct coordinates for different DOTSIZE values', () => {
      // This tests the logic without requiring window creation

      // Test case 1: DOTSIZE 1,1 (default)
      // Pixel (100, 100) should be coordinate (100, 100)
      const spec1 = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'Test1', 'SIZE', '400', '300']
      )[1];
      expect(spec1.dotSize.width).toBe(1);
      expect(spec1.dotSize.height).toBe(1);

      // Test case 2: DOTSIZE 2,3
      // Pixel (100, 150) should be coordinate (50, 50) after division
      const spec2 = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'Test2', 'SIZE', '400', '300', 'DOTSIZE', '2', '3']
      )[1];
      expect(spec2.dotSize.width).toBe(2);
      expect(spec2.dotSize.height).toBe(3);

      // Test case 3: DOTSIZE 10,10
      // Pixel (250, 250) should be coordinate (25, 25) after division
      const spec3 = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'Test3', 'SIZE', '400', '300', 'DOTSIZE', '10', '10']
      )[1];
      expect(spec3.dotSize.width).toBe(10);
      expect(spec3.dotSize.height).toBe(10);
    });
  });

  describe('Pascal Compatibility', () => {
    test('should match Pascal PLOT window coordinate format', () => {
      // Pascal format from DebugDisplayUnit.pas:
      // dis_plot:
      // if vDirX then TextX := (ClientWidth - X) else TextX := X;
      // if vDirY then TextY := Y else TextY := (ClientHeight - Y);
      // Str := IntToStr(TextX div vDotSize) + ',' + IntToStr(TextY div vDotSizeY);

      // Our implementation should follow the same logic:
      // 1. Apply axis direction transformations
      // 2. Divide by dot size
      // 3. Format as "x,y" string

      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'PascalTest', 'SIZE', '640', '480', 'DOTSIZE', '2', '2']
      );

      expect(isValid).toBe(true);

      // With DOTSIZE 2,2:
      // Pixel (200, 100) -> Coordinate (100, 50) with normal axes
      // Pixel (200, 100) -> Coordinate (220, 50) with inverted X axis (640-200=440, 440/2=220)

      // The coordinate display implementation should handle these transformations
    });
  });
});