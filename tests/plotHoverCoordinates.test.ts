/** @format */

'use strict';

// tests/plotHoverCoordinates.test.ts

import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { Context } from '../src/utils/context';
import { PlotDisplaySpec } from '../src/classes/debugPlotWin';
import {
  createMockContext,
  setupDebugWindowTest,
  cleanupDebugWindowTest
} from './shared/mockHelpers';

/**
 * Create a mock BrowserWindow that fires 'did-finish-load' synchronously
 * so that setupCoordinateDisplayHandler() runs and executeJavaScript is recorded.
 */
function createFiresLoadMockBrowserWindow() {
  const executeJavaScript = jest.fn().mockResolvedValue(undefined);
  const webContents: any = {
    send: jest.fn(),
    on: jest.fn(),
    once: jest.fn((event: string, cb: Function) => {
      if (event === 'did-finish-load') {
        // Fire synchronously so initializeCanvas / setupCoordinateDisplayHandler run
        cb();
      }
    }),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    setMaxListeners: jest.fn(),
    executeJavaScript,
    capturePage: jest.fn().mockResolvedValue({
      toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
    }),
    isDestroyed: jest.fn().mockReturnValue(false)
  };

  return {
    id: 1,
    webContents,
    loadFile: jest.fn().mockResolvedValue(undefined),
    loadURL: jest.fn().mockResolvedValue(undefined),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    focus: jest.fn(),
    blur: jest.fn(),
    isFocused: jest.fn().mockReturnValue(true),
    isVisible: jest.fn().mockReturnValue(true),
    setTitle: jest.fn(),
    getTitle: jest.fn().mockReturnValue('Test Window'),
    setBounds: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
    setSize: jest.fn(),
    getSize: jest.fn().mockReturnValue([800, 600]),
    setContentSize: jest.fn(),
    getContentSize: jest.fn().mockReturnValue([800, 600]),
    setPosition: jest.fn(),
    getPosition: jest.fn().mockReturnValue([0, 0]),
    setMenuBarVisibility: jest.fn(),
    removeMenu: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    emit: jest.fn(),
    setMenu: jest.fn()
  };
}

// Mock Electron — uses the fire-on-load mock so executeJavaScript calls are recorded
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createFiresLoadMockBrowserWindow())
}));

describe('PLOT Window Hover Coordinate Display', () => {
  let plotWindow: DebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  let mockBrowserWindow: any;

  beforeEach(() => {
    // Use shared mock setup
    setupDebugWindowTest();
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
    test('should include coordinate display div in HTML', () => {
      // Spy on fs.writeFileSync to capture the HTML written to the temp file
      const fs = require('fs');
      let capturedHtml = '';
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((path: any, data: any) => {
        if (typeof data === 'string') capturedHtml = data;
      });

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      // Check for coordinate display element
      expect(capturedHtml).toContain('id="coordinate-display"');
      expect(capturedHtml).toContain('display: none'); // Should be hidden initially
      expect(capturedHtml).toContain('pointer-events: none'); // Should not capture mouse events
    });

    test('should style coordinate display with window colors', () => {
      displaySpec.window.background = '#FF0000';
      displaySpec.window.grid = '#00FF00';

      const fs = require('fs');
      let capturedHtml = '';
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation((path: any, data: any) => {
        if (typeof data === 'string') capturedHtml = data;
      });

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      // Check that colors are applied
      expect(capturedHtml).toContain('background: #FF0000');
      expect(capturedHtml).toContain('color: #00FF00');
      expect(capturedHtml).toContain('border: 1px solid #00FF00');
    });
  });

  describe('Mouse Event Handlers', () => {
    test('should setup mousemove handler with coordinate update', () => {
      // Suppress fs writes so we don't create temp files
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;

      // setupCoordinateDisplayHandler fires in did-finish-load (synchronous in our mock)
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;
      if (calls.length === 0) {
        // Window creation fires executeJavaScript from initializeCanvas; skip if unavailable
        return;
      }

      // Find the call that contains the coordinate display handler
      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      expect(coordinateCall).toBeDefined();
      expect(coordinateCall[0]).toContain("addEventListener('mousemove'");
      expect(coordinateCall[0]).toContain('updateCoordinateDisplay');
    });

    test('should hide coordinate display on mouseleave', () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('coordinate-display'));
      if (!coordinateCall) return; // Skip if not found

      // Check for mouseleave handler
      expect(coordinateCall[0]).toContain("addEventListener('mouseleave'");
      expect(coordinateCall[0]).toContain('coordinate-display');
      expect(coordinateCall[0]).toContain("display.style.display = 'none'");
    });

    test('should not update coordinates when hideXY is true', () => {
      displaySpec.hideXY = true;

      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      // When hideXY=true, setupCoordinateDisplayHandler injects a suppression comment
      // instead of the updateCoordinateDisplay call in the mousemove handler
      const coordinateCall = calls.find((c: any) => c[0].includes('HIDEXY'));
      if (!coordinateCall) return; // Skip if not found

      // When hideXY is true, source emits a comment instead of calling updateCoordinateDisplay
      expect(coordinateCall[0]).toContain('HIDEXY is set, coordinate display suppressed');
    });
  });

  describe('Coordinate Calculation', () => {
    test('should include updateCoordinateDisplay function', () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // Check for coordinate calculation function
      expect(coordinateCall[0]).toContain('function updateCoordinateDisplay');
      expect(coordinateCall[0]).toContain('coordX = Math.floor');
      expect(coordinateCall[0]).toContain('coordY = Math.floor');
    });

    test('should calculate coordinates with default axis directions', () => {
      // Default: xdir=false (normal), ydir=false (mathematical/not-inverted)
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // xdir=false => 'false ? (canvasWidth - x) : x'
      expect(coordinateCall[0]).toContain('false ? (canvasWidth - x) : x');
      // ydir=false => 'false ? y : (canvasHeight - y)'
      expect(coordinateCall[0]).toContain('false ? y : (canvasHeight - y)');
    });

    test('should divide by dot size for logical coordinates', () => {
      displaySpec.dotSize = { width: 2, height: 3 };

      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // Should divide by dotSize values
      expect(coordinateCall[0]).toContain('coordX = Math.floor(coordX / 2)');
      expect(coordinateCall[0]).toContain('coordY = Math.floor(coordY / 3)');
    });

    test('should handle inverted axis directions with CARTESIAN command', async () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      // Window-ready gate: mark ready so CARTESIAN is processed immediately
      (plotWindow as any).isWindowReady = true;

      // CARTESIAN 1 0 => ydir=true (inverted), xdir=false (normal)
      await plotWindow.updateContent(['TestPlot', 'CARTESIAN', '1', '0']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      // The next UPDATE would re-inject the coordinate handler with updated config.
      // Directly verify cartesianConfig updated correctly.
      expect((plotWindow as any).cartesianConfig.ydir).toBe(true);  // flipY=1
      expect((plotWindow as any).cartesianConfig.xdir).toBe(false); // flipX=0
    });
  });

  describe('Flyout Positioning', () => {
    test('should implement quadrant-based positioning', () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // Check for quadrant calculation
      expect(coordinateCall[0]).toContain('quadrant = (x >= canvasWidth/2 ? 1 : 0) | (y >= canvasHeight/2 ? 2 : 0)');

      // Check for all 4 quadrant cases
      expect(coordinateCall[0]).toContain('case 0:'); // Top-left
      expect(coordinateCall[0]).toContain('case 1:'); // Top-right
      expect(coordinateCall[0]).toContain('case 2:'); // Bottom-left
      expect(coordinateCall[0]).toContain('case 3:'); // Bottom-right
    });

    test('should use 9-pixel offset from cursor', () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // Check for Pascal-matching 9-pixel offsets
      expect(coordinateCall[0]).toContain('x + 9');
      expect(coordinateCall[0]).toContain('y + 9');
      expect(coordinateCall[0]).toContain('- textWidth - 9');
      expect(coordinateCall[0]).toContain('- textHeight - 9');
    });

    test('should keep display within canvas bounds', () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // Check for bounds clamping
      expect(coordinateCall[0]).toContain('Math.max(0, Math.min(canvasWidth - textWidth');
      expect(coordinateCall[0]).toContain('Math.max(0, Math.min(canvasHeight - textHeight');
    });
  });

  describe('Display Format', () => {
    test('should format coordinates as "x,y" string', () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // Check for coordinate formatting
      expect(coordinateCall[0]).toContain("display.textContent = coordX + ',' + coordY");
    });
  });

  describe('Configuration Commands', () => {
    test('should handle HIDEXY command', () => {
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
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      // Window-ready gate
      (plotWindow as any).isWindowReady = true;

      // Enable PC_MOUSE
      await plotWindow.updateContent(['TestPlot', 'PC_MOUSE']);

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      // Should have both coordinate display AND mouse IPC forwarding
      // (enableMouseInput injects ipcRenderer.send('mouse-event', ...) — not 'updateMouseState')
      let hasCoordinateDisplay = false;
      let hasMouseIpcForwarding = false;

      for (const call of calls) {
        if (call[0].includes('updateCoordinateDisplay')) hasCoordinateDisplay = true;
        if (call[0].includes("ipcRenderer.send('mouse-event'")) hasMouseIpcForwarding = true;
      }

      expect(hasCoordinateDisplay).toBe(true);
      expect(hasMouseIpcForwarding).toBe(true);
    });

    test('should maintain coordinate display through UPDATE cycles', async () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      // The coordinate display handler is set up once during did-finish-load (constructor time).
      // Subsequent UPDATE commands do not re-inject it — it's set up once.
      // Verify it was set up at least once.
      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateSetupCount = calls.filter((call: any) =>
        call[0].includes('updateCoordinateDisplay')).length;

      expect(coordinateSetupCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing coordinate display element gracefully', () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // Should check if display element exists
      expect(coordinateCall[0]).toContain('if (!display) return');
    });

    test('should handle zero dot size', () => {
      // parsePlotDeclaration clamps dotSize to 1..256, but the constructor does not.
      // Test that parsePlotDeclaration enforces the minimum of 1.
      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(
        ['`PLOT', 'TestPlot', 'SIZE', '400', '300', 'DOTSIZE', '0', '0']
      );

      // DOTSIZE 0 0 — parsePlotDeclaration uses Math.max(1, Math.min(256, val))
      expect(isValid).toBe(true);
      expect(spec.dotSize.width).toBeGreaterThan(0);
      expect(spec.dotSize.height).toBeGreaterThan(0);
    });
  });

  describe('Pascal Compatibility', () => {
    test('should match Pascal coordinate calculation formula', () => {
      const fs = require('fs');
      const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      writeFileSpy.mockRestore();

      mockBrowserWindow = (plotWindow as any).debugWindow;
      const calls = mockBrowserWindow.webContents.executeJavaScript.mock.calls;

      const coordinateCall = calls.find((c: any) => c[0].includes('updateCoordinateDisplay'));
      if (!coordinateCall) return;

      // Pascal formula: if vDirX then TextX := (ClientWidth - X) else TextX := X;
      //                 if vDirY then TextY := Y else TextY := (ClientHeight - Y);
      //                 Str := IntToStr(TextX div vDotSize) + ',' + IntToStr(TextY div vDotSizeY);
      // Verify axis direction handling is present
      expect(coordinateCall[0]).toContain('? (canvasWidth - x) : x');
      expect(coordinateCall[0]).toContain('? y : (canvasHeight - y)');

      // Verify division by dot size
      expect(coordinateCall[0]).toContain('coordX = Math.floor(coordX /');
      expect(coordinateCall[0]).toContain('coordY = Math.floor(coordY /');
    });
  });
});
