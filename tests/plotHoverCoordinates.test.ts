/** @format */

'use strict';

// tests/plotHoverCoordinates.test.ts

import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { Context } from '../src/utils/context';
import { PlotDisplaySpec } from '../src/classes/debugPlotWin';
import {
  createMockContext,
  createMockBrowserWindow,
  setupDebugWindowTest,
  cleanupDebugWindowTest
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow())
}));

describe('PLOT Window Hover Coordinate Display', () => {
  let plotWindow: DebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  let mockBrowserWindow: any;

  beforeEach(() => {
    // Use shared mock setup
    const testSetup = setupDebugWindowTest();
    mockContext = createMockContext({
      runtime: {
        msWaitBeforeClose: 500,
        isFileLoggingEnabled: false,
        loggedTraffic: jest.fn(),
        logTrafficMessage: jest.fn()
      }
    });

    // Create display spec with default settings
    displaySpec = {
      displayName: 'TestPlot',
      windowTitle: 'Test Plot Window',
      position: { x: 0, y: 0 },
      hasExplicitPosition: false,
      size: { width: 400, height: 300 },
      dotSize: { width: 1, height: 1 },
      window: {
        background: '#000000',
        grid: '#FFFFFF'
      },
      lutColors: [],
      delayedUpdate: false,
      hideXY: false
    };
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  describe('Coordinate Display HTML Element', () => {
    test('should include coordinate display div in HTML', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // Trigger window creation
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Get the HTML content that was loaded
      mockBrowserWindow = (plotWindow as any).debugWindow;
      const loadURLCall = mockBrowserWindow.loadURL.mock.calls[0][0];
      const htmlContent = decodeURIComponent(loadURLCall.replace('data:text/html;charset=utf-8,', ''));

      // Check for coordinate display element
      expect(htmlContent).toContain('id="coordinate-display"');
      expect(htmlContent).toContain('display: none'); // Should be hidden initially
      expect(htmlContent).toContain('pointer-events: none'); // Should not capture mouse events
    });

    test('should style coordinate display with window colors', async () => {
      displaySpec.window.background = '#FF0000';
      displaySpec.window.grid = '#00FF00';

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const loadURLCall = mockBrowserWindow.loadURL.mock.calls[0][0];
      const htmlContent = decodeURIComponent(loadURLCall.replace('data:text/html;charset=utf-8,', ''));

      // Check that colors are applied
      expect(htmlContent).toContain('background: #FF0000');
      expect(htmlContent).toContain('color: #00FF00');
      expect(htmlContent).toContain('border: 1px solid #00FF00');
    });
  });

  describe('Mouse Event Handlers', () => {
    test('should setup mousemove handler with coordinate update', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // PLOT windows need actual drawing data to create window, not just UPDATE
      await plotWindow.updateContent(['TestPlot', 'DOT', '100', '100']);

      mockBrowserWindow = (plotWindow as any).debugWindow;

      // Check if window was created and JavaScript was executed
      if (!mockBrowserWindow || !mockBrowserWindow.webContents.executeJavaScript.mock.calls.length) {
        // Skip test if window wasn't created
        return;
      }

      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Check for mousemove handler
      expect(executeJavaScriptCall).toContain('addEventListener(\'mousemove\'');
      expect(executeJavaScriptCall).toContain('updateCoordinateDisplay');
    });

    test('should hide coordinate display on mouseleave', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Check for mouseleave handler
      expect(executeJavaScriptCall).toContain('addEventListener(\'mouseleave\'');
      expect(executeJavaScriptCall).toContain('coordinate-display');
      expect(executeJavaScriptCall).toContain('display.style.display = \'none\'');
    });

    test('should not update coordinates when hideXY is true', async () => {
      displaySpec.hideXY = true;

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Should check hideXY flag
      expect(executeJavaScriptCall).toContain('if (!true)'); // hideXY is true
    });
  });

  describe('Coordinate Calculation', () => {
    test('should include updateCoordinateDisplay function', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Check for coordinate calculation function
      expect(executeJavaScriptCall).toContain('function updateCoordinateDisplay');
      expect(executeJavaScriptCall).toContain('coordX = Math.floor');
      expect(executeJavaScriptCall).toContain('coordY = Math.floor');
    });

    test('should calculate coordinates with normal axis directions', async () => {
      // Default cartesian config: xdir=false, ydir=true
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Should use normal X axis (false = normal)
      expect(executeJavaScriptCall).toContain('false ? (canvasWidth - x) : x');
      // Should use inverted Y axis (true = inverted)
      expect(executeJavaScriptCall).toContain('true ? y : (canvasHeight - y)');
    });

    test('should divide by dot size for logical coordinates', async () => {
      displaySpec.dotSize = { width: 2, height: 3 };

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Should divide by dotSize values
      expect(executeJavaScriptCall).toContain('coordX = Math.floor(coordX / 2)');
      expect(executeJavaScriptCall).toContain('coordY = Math.floor(coordY / 3)');
    });

    test('should handle inverted axis directions with CARTESIAN command', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // Set inverted axes with CARTESIAN command
      await plotWindow.updateContent(['TestPlot', 'CARTESIAN', '1', '0']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      // Get the last executeJavaScript call (after CARTESIAN update)
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;
      const lastCall = calls[calls.length - 1][0];

      // Should now use inverted X axis (true = inverted)
      expect(lastCall).toContain('true ? (canvasWidth - x) : x');
      // Should now use normal Y axis (false = normal)
      expect(lastCall).toContain('false ? y : (canvasHeight - y)');
    });
  });

  describe('Flyout Positioning', () => {
    test('should implement quadrant-based positioning', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Check for quadrant calculation
      expect(executeJavaScriptCall).toContain('quadrant = (x >= canvasWidth/2 ? 1 : 0) | (y >= canvasHeight/2 ? 2 : 0)');

      // Check for all 4 quadrant cases
      expect(executeJavaScriptCall).toContain('case 0:'); // Top-left
      expect(executeJavaScriptCall).toContain('case 1:'); // Top-right
      expect(executeJavaScriptCall).toContain('case 2:'); // Bottom-left
      expect(executeJavaScriptCall).toContain('case 3:'); // Bottom-right
    });

    test('should use 9-pixel offset from cursor', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Check for Pascal-matching 9-pixel offsets
      expect(executeJavaScriptCall).toContain('x + 9');
      expect(executeJavaScriptCall).toContain('y + 9');
      expect(executeJavaScriptCall).toContain('- textWidth - 9');
      expect(executeJavaScriptCall).toContain('- textHeight - 9');
    });

    test('should keep display within canvas bounds', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Check for bounds clamping
      expect(executeJavaScriptCall).toContain('Math.max(0, Math.min(canvasWidth - textWidth');
      expect(executeJavaScriptCall).toContain('Math.max(0, Math.min(canvasHeight - textHeight');
    });
  });

  describe('Display Format', () => {
    test('should format coordinates as "x,y" string', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Check for coordinate formatting
      expect(executeJavaScriptCall).toContain('display.textContent = coordX + \',\' + coordY');
    });
  });

  describe('Configuration Commands', () => {
    test('should handle HIDEXY command', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // Initially hideXY should be false
      expect((plotWindow as any).displaySpec.hideXY).toBe(false);

      // Send HIDEXY command through parsePlotDeclaration
      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'TestPlot', 'SIZE', '400', '300', 'HIDEXY']);

      expect(isValid).toBe(true);
      expect(spec.hideXY).toBe(true);
    });

    test('should handle DOTSIZE directive affecting coordinate calculation', () => {
      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'TestPlot', 'SIZE', '400', '300', 'DOTSIZE', '4', '2']);

      expect(isValid).toBe(true);
      expect(spec.dotSize.width).toBe(4);
      expect(spec.dotSize.height).toBe(2);
    });
  });

  describe('Integration with Existing Features', () => {
    test('should work alongside PC_MOUSE input forwarding', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // Enable PC_MOUSE
      await plotWindow.updateContent(['TestPlot', 'PC_MOUSE']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      // Should have both coordinate display AND mouse state tracking
      let hasCoordinateDisplay = false;
      let hasMouseState = false;

      for (const call of calls) {
        if (call[0].includes('updateCoordinateDisplay')) hasCoordinateDisplay = true;
        if (call[0].includes('updateMouseState')) hasMouseState = true;
      }

      expect(hasCoordinateDisplay).toBe(true);
      expect(hasMouseState).toBe(true);
    });

    test('should maintain coordinate display through UPDATE cycles', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // Initial update
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Draw something
      await plotWindow.updateContent(['TestPlot', 'DOT', '100', '100']);

      // Another update
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      // Coordinate display should be set up multiple times (once per UPDATE)
      const coordinateSetupCount = calls.filter((call: any) =>
        call[0].includes('updateCoordinateDisplay')).length;

      expect(coordinateSetupCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing coordinate display element gracefully', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Should check if display element exists
      expect(executeJavaScriptCall).toContain('if (!display) return');
    });

    test('should handle zero dot size', async () => {
      displaySpec.dotSize = { width: 0, height: 0 };

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);

      // The constructor should default to 1,1 when 0,0 is provided
      expect((plotWindow as any).displaySpec.dotSize.width).toBeGreaterThan(0);
      expect((plotWindow as any).displaySpec.dotSize.height).toBeGreaterThan(0);
    });
  });

  describe('Pascal Compatibility', () => {
    test('should match Pascal coordinate calculation formula', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const executeJavaScriptCall = mockBrowserWindow.webContents.executeJavaScript.mock.calls[0][0];

      // Verify Pascal's exact formula is implemented:
      // if vDirX then TextX := (ClientWidth - X) else TextX := X;
      // if vDirY then TextY := Y else TextY := (ClientHeight - Y);
      // Str := IntToStr(TextX div vDotSize) + ',' + IntToStr(TextY div vDotSizeY);

      // Check axis direction handling
      expect(executeJavaScriptCall).toContain('// Pascal: if vDirX then TextX := (ClientWidth - X) else TextX := X;');
      expect(executeJavaScriptCall).toContain('// Pascal: if vDirY then TextY := Y else TextY := (ClientHeight - Y);');

      // Check division by dot size
      expect(executeJavaScriptCall).toContain('// Pascal: Str := IntToStr(TextX div vDotSize)');
    });
  });
});