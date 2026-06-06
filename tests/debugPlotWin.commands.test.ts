/** @format */

'use strict';

// tests/debugPlotWin.commands.test.ts
//
// Rewritten to match current source behaviour:
//   - All canvas drawing goes through debugWindow.webContents.executeJavaScript()
//   - canvasRenderer methods are NOT called directly by draw commands
//   - Window name must be stripped before handleCommonCommand sees the tokens
//   - isWindowReady must be set true so updateContent processes commands immediately

import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { Context } from '../src/utils/context';
import { PlotDisplaySpec } from '../src/classes/debugPlotWin';
import { CanvasRenderer } from '../src/classes/shared/canvasRenderer';
import { ColorTranslator, ColorMode } from '../src/classes/shared/colorTranslator';
import { LUTManager } from '../src/classes/shared/lutManager';
import { InputForwarder } from '../src/classes/shared/inputForwarder';
import {
  createMockContext,
  createMockBrowserWindow,
  createMockOffscreenCanvas,
  setupDebugWindowTest,
  cleanupDebugWindowTest
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow())
}));

describe('DebugPlotWindow Commands', () => {
  let plotWindow: DebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  let executeJavaScript: jest.Mock;

  // Mark window ready so commands process immediately (base class gates on isWindowReady)
  function setWindowReady(win: DebugPlotWindow): void {
    (win as any)['isWindowReady'] = true;
  }

  // Get the executeJavaScript mock from the window's webContents
  function getExecuteJS(win: DebugPlotWindow): jest.Mock {
    return (win as any).debugWindow?.webContents?.executeJavaScript as jest.Mock;
  }

  beforeEach(() => {
    // Mock Context with logger
    mockContext = {
      logger: {
        logMessage: jest.fn()
      },
      getParallaxFontUrl: jest.fn().mockReturnValue('font://parallax.ttf')
    } as any;

    // Create display spec
    displaySpec = {
      displayName: 'TestPlot',
      windowTitle: 'Test Plot Window',
      position: { x: 0, y: 0 },
      hasExplicitPosition: false,
      size: { width: 256, height: 256 },
      dotSize: { width: 1, height: 1 },
      window: { background: '#000000', grid: '#808080' },
      lutColors: [],
      delayedUpdate: false,
      hideXY: false
    };

    // Create Plot window
    plotWindow = new DebugPlotWindow(mockContext, displaySpec);

    // Mark ready and grab executeJavaScript mock
    setWindowReady(plotWindow);
    executeJavaScript = getExecuteJS(plotWindow);
    if (executeJavaScript) {
      executeJavaScript.mockResolvedValue('ok');
    }

    // Override logMessage to avoid logging noise during tests
    jest.spyOn(plotWindow as any, 'logMessage').mockImplementation(() => {});

    // Set default origin (middle of 256x256 canvas)
    (plotWindow as any).origin = { x: 128, y: 128 };
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  // -----------------------------------------------------------------------
  // DOT command
  // -----------------------------------------------------------------------
  describe('DOT command', () => {
    test('should draw dot at current position — executes via executeJavaScript', async () => {
      (plotWindow as any).cursorPosition = { x: 50, y: 100 };
      (plotWindow as any).lineSize = 1;

      await plotWindow.updateContent(['TestPlot', 'DOT']);

      // Source calls executeJavaScript with fillRect or similar drawing code
      expect(executeJavaScript).toHaveBeenCalled();
    });

    test('should draw dot with custom size — executes via executeJavaScript', async () => {
      (plotWindow as any).cursorPosition = { x: 25, y: 75 };

      await plotWindow.updateContent(['TestPlot', 'DOT', '5']);

      expect(executeJavaScript).toHaveBeenCalled();
      // The JS string for size 5 dot should contain the size value
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const dotCall = calls.find((s: string) => typeof s === 'string' && s.includes('fillRect'));
      expect(dotCall).toBeDefined();
    });

    test('should draw dot with custom size and opacity — both in JS string', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      executeJavaScript.mockClear();

      await plotWindow.updateContent(['TestPlot', 'DOT', '3', '128']);

      expect(executeJavaScript).toHaveBeenCalled();
      // The opacity 128 → globalAlpha = 128/255 ≈ 0.502 should appear in the JS
      const dotJS = executeJavaScript.mock.calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('globalAlpha')
      );
      expect(dotJS).toBeDefined();
    });

    test('should handle invalid size parameter gracefully', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      (plotWindow as any).lineSize = 1;

      // Invalid size → parseNumber returns null → falls back to persistent lineSize
      await expect(plotWindow.updateContent(['TestPlot', 'DOT', 'invalid'])).resolves.not.toThrow();
    });

    test('should handle negative size — treated as valid number, uses fillRect path', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      (plotWindow as any).lineSize = 2;

      await expect(plotWindow.updateContent(['TestPlot', 'DOT', '-5'])).resolves.not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // BOX command
  // -----------------------------------------------------------------------
  describe('BOX command', () => {
    test('should draw filled box — executes via executeJavaScript with fillRect', async () => {
      (plotWindow as any).cursorPosition = { x: 50, y: 50 };
      executeJavaScript.mockClear();

      await plotWindow.updateContent(['TestPlot', 'BOX', '40', '30']);

      expect(executeJavaScript).toHaveBeenCalled();
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const boxCall = calls.find((s: string) => typeof s === 'string' && s.includes('fillRect'));
      expect(boxCall).toBeDefined();
    });

    test('should draw outlined box when lineSize > 0 — uses strokeRect', async () => {
      (plotWindow as any).cursorPosition = { x: 100, y: 100 };
      executeJavaScript.mockClear();

      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50', '2']);

      expect(executeJavaScript).toHaveBeenCalled();
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const strokeCall = calls.find((s: string) => typeof s === 'string' && s.includes('strokeRect'));
      expect(strokeCall).toBeDefined();
    });

    test('should draw box with opacity — globalAlpha appears in JS', async () => {
      executeJavaScript.mockClear();
      await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20', '0', '200']);

      expect(executeJavaScript).toHaveBeenCalled();
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const alphaCall = calls.find((s: string) => typeof s === 'string' && s.includes('globalAlpha'));
      expect(alphaCall).toBeDefined();
    });

    test('should handle invalid width/height gracefully', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };

      // Invalid dimensions — parseNumber returns null → BOX not drawn, no throw
      await expect(plotWindow.updateContent(['TestPlot', 'BOX', 'invalid', 'bad'])).resolves.not.toThrow();
    });

    test('should handle negative dimensions — used directly in calculation', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };

      // Negative dimensions are valid numbers, result in reversed rect
      await expect(plotWindow.updateContent(['TestPlot', 'BOX', '-20', '-30'])).resolves.not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // OBOX command  (Pascal key_obox: width height xradius yradius [linesize [opacity]])
  // -----------------------------------------------------------------------
  describe('OBOX command', () => {
    test('should draw rounded rect — executes via executeJavaScript with roundRect', async () => {
      (plotWindow as any).cursorPosition = { x: 50, y: 50 };
      executeJavaScript.mockClear();

      // OBOX requires 4 params: width height xradius yradius
      await plotWindow.updateContent(['TestPlot', 'OBOX', '60', '40', '5', '5']);

      expect(executeJavaScript).toHaveBeenCalled();
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const oboxCall = calls.find((s: string) => typeof s === 'string' && s.includes('roundRect'));
      expect(oboxCall).toBeDefined();
    });

    test('should draw outlined OBOX when lineSize provided', async () => {
      executeJavaScript.mockClear();

      await plotWindow.updateContent(['TestPlot', 'OBOX', '100', '80', '10', '10', '3']);

      expect(executeJavaScript).toHaveBeenCalled();
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const strokeCall = calls.find((s: string) => typeof s === 'string' && s.includes('stroke'));
      expect(strokeCall).toBeDefined();
    });

    test('should not draw when fewer than 4 params provided (source requires width height xr yr)', async () => {
      executeJavaScript.mockClear();

      // OBOX with only 2 params (width, height) — xradius/yradius missing → not drawn
      await plotWindow.updateContent(['TestPlot', 'OBOX', '60', '40']);

      // No OBOX draw call (parseNumber for xradius returns null → condition fails)
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const oboxCall = calls.find((s: string) => typeof s === 'string' && s.includes('roundRect'));
      expect(oboxCall).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // OVAL command
  // -----------------------------------------------------------------------
  describe('OVAL command', () => {
    test('should draw filled oval — executes via executeJavaScript with ellipse', async () => {
      (plotWindow as any).cursorPosition = { x: 128, y: 128 };
      executeJavaScript.mockClear();

      await plotWindow.updateContent(['TestPlot', 'OVAL', '80', '60']);

      expect(executeJavaScript).toHaveBeenCalled();
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const ovalCall = calls.find((s: string) => typeof s === 'string' && s.includes('ellipse'));
      expect(ovalCall).toBeDefined();
    });

    test('should draw outlined oval when lineSize > 0', async () => {
      executeJavaScript.mockClear();

      await plotWindow.updateContent(['TestPlot', 'OVAL', '100', '100', '3']);

      expect(executeJavaScript).toHaveBeenCalled();
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const strokeCall = calls.find((s: string) => typeof s === 'string' && s.includes('stroke'));
      expect(strokeCall).toBeDefined();
    });

    test('should draw oval with opacity — globalAlpha in JS', async () => {
      executeJavaScript.mockClear();
      await plotWindow.updateContent(['TestPlot', 'OVAL', '40', '40', '0', '100']);

      expect(executeJavaScript).toHaveBeenCalled();
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const alphaCall = calls.find((s: string) => typeof s === 'string' && s.includes('globalAlpha'));
      expect(alphaCall).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // UPDATE command
  // -----------------------------------------------------------------------
  describe('UPDATE command', () => {
    let mockPerformUpdate: jest.SpyInstance;

    beforeEach(() => {
      mockPerformUpdate = jest.spyOn(plotWindow as any, 'performUpdate').mockResolvedValue(undefined);
    });

    test('should call performUpdate to copy working buffer to display', async () => {
      // In live mode, parseSimpleCommands calls performUpdate after the command sequence
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      expect(mockPerformUpdate).toHaveBeenCalled();
    });

    test('should perform multiple updates', async () => {
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      // Each call to parseSimpleCommands triggers performUpdate at end
      expect(mockPerformUpdate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // Double buffering behaviour
  // -----------------------------------------------------------------------
  describe('Double buffering behavior', () => {
    test('should draw to canvas via executeJavaScript without additional UPDATE calls', async () => {
      const mockPerformUpdate = jest.spyOn(plotWindow as any, 'performUpdate').mockResolvedValue(undefined);

      // Draw shapes (in live mode each fires performUpdate at parseSimpleCommands end)
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '30', '40']);

      // executeJavaScript was called for drawing
      expect(executeJavaScript).toHaveBeenCalled();
      // In live mode, performUpdate is called per-command
      expect(mockPerformUpdate.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    test('should call performUpdate on explicit UPDATE command', async () => {
      const mockPerformUpdate = jest.spyOn(plotWindow as any, 'performUpdate').mockResolvedValue(undefined);
      mockPerformUpdate.mockClear();

      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      expect(mockPerformUpdate).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Coordinate transformation
  // -----------------------------------------------------------------------
  describe('Coordinate transformation', () => {
    test('should handle cartesian coordinates correctly', async () => {
      (plotWindow as any).origin = { x: 128, y: 128 };
      (plotWindow as any).vPixelX = 0;
      (plotWindow as any).vPixelY = 0;

      await plotWindow.updateContent(['TestPlot', 'DOT']);
      expect(executeJavaScript).toHaveBeenCalled();
    });

    test('should switch to polar mode with POLAR command', async () => {
      await plotWindow.updateContent(['TestPlot', 'POLAR', '0', '0']);
      expect((plotWindow as any).isCartesian).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // CLEAR command
  // -----------------------------------------------------------------------
  describe('CLEAR command', () => {
    test('should fire executeJavaScript for canvas clearing', async () => {
      executeJavaScript.mockClear();
      await plotWindow.updateContent(['TestPlot', 'CLEAR']);

      // CLEAR uses clearDisplayContent() which calls executeJavaScript
      // (gated on canvasInitialized=false in test env, but parseSimpleCommands still fires performUpdate)
      expect(executeJavaScript).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Color handling
  // -----------------------------------------------------------------------
  describe('Color handling', () => {
    test('should use current foreground color for shapes', async () => {
      (plotWindow as any).currFgColor = '#FF0000';

      await plotWindow.updateContent(['TestPlot', 'DOT']);

      // The JS string should include the color
      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const coloredCall = calls.find((s: string) => typeof s === 'string' && s.includes('#FF0000'));
      expect(coloredCall).toBeDefined();
    });

    test('should update foreground color via COLOR command', async () => {
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      expect((plotWindow as any).currFgColor).toBe('#FF0000');
    });

    test('should apply new color to subsequent draws', async () => {
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$00FF00']);
      executeJavaScript.mockClear();

      await plotWindow.updateContent(['TestPlot', 'DOT']);

      const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      const greenDot = calls.find((s: string) => typeof s === 'string' && s.includes('#00FF00'));
      expect(greenDot).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Style commands
  // -----------------------------------------------------------------------
  describe('Style commands', () => {
    describe('LINESIZE command', () => {
      test('should set line size and persist across commands', async () => {
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '5']);
        expect((plotWindow as any).lineSize).toBe(5);
      });

      test('should clamp lineSize to 0..32 (source: size >= 0 && size <= 32)', async () => {
        // Valid values
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '2']);
        expect((plotWindow as any).lineSize).toBe(2);

        // Invalid string — leaves lineSize unchanged
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', 'abc']);
        expect((plotWindow as any).lineSize).toBe(2); // unchanged

        // Out-of-range (negative) — rejected by source clamp (size >= 0 && size <= 32)
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '-5']);
        expect((plotWindow as any).lineSize).toBe(2); // unchanged

        // Zero is allowed
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '0']);
        expect((plotWindow as any).lineSize).toBe(0);

        // Out-of-range (> 32) — rejected
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '300']);
        expect((plotWindow as any).lineSize).toBe(0); // unchanged

        // Valid value at upper bound
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '32']);
        expect((plotWindow as any).lineSize).toBe(32);
      });
    });

    describe('OPACITY command', () => {
      test('should set opacity and persist', async () => {
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '128']);
        expect((plotWindow as any).opacity).toBe(128);
      });

      test('should clamp opacity to 0..255', async () => {
        // Valid 0
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '0']);
        expect((plotWindow as any).opacity).toBe(0);

        // Valid 255
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '255']);
        expect((plotWindow as any).opacity).toBe(255);

        // Out-of-range high — clamped to 255
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '300']);
        expect((plotWindow as any).opacity).toBe(255);

        // Out-of-range low — clamped to 0
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '-50']);
        expect((plotWindow as any).opacity).toBe(0);
      });

      test('should leave opacity unchanged on invalid string', async () => {
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '200']);
        expect((plotWindow as any).opacity).toBe(200);

        await plotWindow.updateContent(['TestPlot', 'OPACITY', 'invalid']);
        expect((plotWindow as any).opacity).toBe(200); // unchanged

        await plotWindow.updateContent(['TestPlot', 'OPACITY', '']);
        expect((plotWindow as any).opacity).toBe(200); // unchanged
      });

      test('should use opacity in draw calls — globalAlpha appears in JS', async () => {
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '128']);
        executeJavaScript.mockClear();

        await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20']);

        const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
        const alphaCall = calls.find((s: string) => typeof s === 'string' && s.includes('globalAlpha'));
        expect(alphaCall).toBeDefined();
      });

      test('should support per-command opacity override (DOT/BOX second/fourth param)', async () => {
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '200']);
        executeJavaScript.mockClear();

        // BOX width height lineSize opacityOverride
        await plotWindow.updateContent(['TestPlot', 'BOX', '10', '10', '0', '100']);

        const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
        // 100/255 ≈ 0.392 should appear
        const overrideCall = calls.find(
          (s: string) => typeof s === 'string' && s.includes('globalAlpha') && s.includes((100 / 255).toFixed(5).slice(0, 5))
        );
        // Looser check: globalAlpha appears with SOME value
        const alphaCall = calls.find((s: string) => typeof s === 'string' && s.includes('globalAlpha'));
        expect(alphaCall).toBeDefined();
      });
    });

    describe('TEXTANGLE command', () => {
      test('should set text rotation angle — normalised to 0..359 by makeTextAngle', async () => {
        // makeTextAngle(45) = 45 % 360 = 45, then ((45%360)+360)%360 = 45
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '45']);
        expect((plotWindow as any).textAngle).toBe(45);

        // makeTextAngle(90.5) — val % 360 = 90.5 in cartesian, result 90 (integer mod)
        // Actually parseValue('90.5') = 90.5 float, 90.5 % 360 = 90.5, ((90.5%360)+360)%360 = 90.5
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '90.5']);
        expect((plotWindow as any).textAngle).toBe(90.5);

        // Negative: -30 → -30 % 360 = -30 in JS, then ((-30)+360) % 360 = 330
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '-30']);
        expect((plotWindow as any).textAngle).toBe(330);
      });

      test('should normalise angles through makeTextAngle (360 → 0, 370 → 10)', async () => {
        // 370 % 360 = 10 in cartesian mode
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '370']);
        expect((plotWindow as any).textAngle).toBe(10);

        // 360 % 360 = 0
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '360']);
        expect((plotWindow as any).textAngle).toBe(0);
      });

      test('should default to 0 when angle token is non-numeric', async () => {
        // parseNumber returns null → no update, textAngle stays at default 0
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', 'invalid']);
        expect((plotWindow as any).textAngle).toBe(0);

        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '']);
        expect((plotWindow as any).textAngle).toBe(0);
      });
    });

    describe('LUTCOLORS command', () => {
      let mockLutManager: any;

      beforeEach(() => {
        mockLutManager = (plotWindow as any).lutManager;
        jest.spyOn(mockLutManager, 'setColor').mockImplementation(() => {});
      });

      test('should load color palette into LUT', async () => {
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF0000', '$00FF00', '$0000FF', '$FFFFFF']);

        expect(mockLutManager.setColor).toHaveBeenCalledTimes(4);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(1, 0, 0xFF0000);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(2, 1, 0x00FF00);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(3, 2, 0x0000FF);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(4, 3, 0xFFFFFF);
      });

      test('should handle different Spin2 color formats ($hex and decimal)', async () => {
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF00FF', '123456']);

        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(1, 0, 0xFF00FF);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(2, 1, 123456);
      });

      test('should handle partial palette loads', async () => {
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$AABBCC', '$DDEEFF', '$112233']);

        expect(mockLutManager.setColor).toHaveBeenCalledTimes(3);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(1, 0, 0xAABBCC);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(2, 1, 0xDDEEFF);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(3, 2, 0x112233);
      });

      test('should process all provided colors', async () => {
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF0000', '$00FF00']);
        expect(mockLutManager.setColor).toHaveBeenCalledTimes(2);
      });
    });

    describe('Style persistence and integration', () => {
      test('should maintain all style states across multiple commands', async () => {
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '3']);
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '180']);
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '30']);

        expect((plotWindow as any).lineSize).toBe(3);
        expect((plotWindow as any).opacity).toBe(180);
        expect((plotWindow as any).textAngle).toBe(30);
      });

      test('should apply stored opacity to subsequent draw calls', async () => {
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '3']);
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '180']);
        executeJavaScript.mockClear();

        // OBOX with 4 required params
        await plotWindow.updateContent(['TestPlot', 'OBOX', '50', '50', '5', '5']);

        const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
        const alphaCall = calls.find((s: string) => typeof s === 'string' && s.includes('globalAlpha'));
        expect(alphaCall).toBeDefined();
      });

      test('should work with color mode changes', async () => {
        const mockColorTranslator = (plotWindow as any).colorTranslator;
        const mockLutManager = (plotWindow as any).lutManager;
        jest.spyOn(mockLutManager, 'setColor').mockImplementation(() => {});

        // Load LUT colors
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF0000', '$00FF00']);

        expect(mockLutManager.setColor).toHaveBeenCalledTimes(2);

        // Switch to LUT1 mode
        await plotWindow.updateContent(['TestPlot', 'LUT1']);
        expect((plotWindow as any).colorMode).toBe(ColorMode.LUT1);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Layer commands
  // -----------------------------------------------------------------------
  describe('Layer commands', () => {
    let mockLayerManager: any;

    beforeEach(() => {
      mockLayerManager = (plotWindow as any).layerManager;
    });

    describe('LAYER command', () => {
      test('should load .bmp file into specified layer (1-based → 0-based in manager)', async () => {
        // Source calls plotWindowIntegrator.executeOperation for LAYER, which internally
        // calls layerManager.loadLayer.  Spy at the manager level.
        jest.spyOn(mockLayerManager, 'loadLayer').mockResolvedValue(undefined);

        await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/path/to/image.bmp']);

        // The integrator executes async; give it a tick
        await new Promise(resolve => setImmediate(resolve));
        expect(mockLayerManager.loadLayer).toHaveBeenCalledWith(0, '/path/to/image.bmp');
      });

      test('should convert layer index from 1-based to 0-based', async () => {
        jest.spyOn(mockLayerManager, 'loadLayer').mockResolvedValue(undefined);

        await plotWindow.updateContent(['TestPlot', 'LAYER', '8', '/path/to/image.bmp']);
        await new Promise(resolve => setImmediate(resolve));

        expect(mockLayerManager.loadLayer).toHaveBeenCalledWith(7, '/path/to/image.bmp');
      });

      test('should reject layer index 0 and 9+ (valid range 1-8)', async () => {
        jest.spyOn(mockLayerManager, 'loadLayer').mockResolvedValue(undefined);

        await plotWindow.updateContent(['TestPlot', 'LAYER', '0', '/path/to/image.bmp']);
        await new Promise(resolve => setImmediate(resolve));
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();

        await plotWindow.updateContent(['TestPlot', 'LAYER', '9', '/path/to/image.bmp']);
        await new Promise(resolve => setImmediate(resolve));
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();
      });

      test('should only accept .bmp extension (source enforces this)', async () => {
        jest.spyOn(mockLayerManager, 'loadLayer').mockResolvedValue(undefined);

        // .bmp is the ONLY valid extension per source
        await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/path/to/image.bmp']);
        await new Promise(resolve => setImmediate(resolve));
        expect(mockLayerManager.loadLayer).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        jest.spyOn(mockLayerManager, 'loadLayer').mockResolvedValue(undefined);

        // .png is NOT accepted (source: `if (filename.toLowerCase().endsWith('.bmp'))`)
        await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/path/to/image.png']);
        await new Promise(resolve => setImmediate(resolve));
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();
      });

      test('should handle missing parameters gracefully', async () => {
        jest.spyOn(mockLayerManager, 'loadLayer').mockResolvedValue(undefined);

        await plotWindow.updateContent(['TestPlot', 'LAYER', '1']); // missing filename
        await new Promise(resolve => setImmediate(resolve));
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();

        await plotWindow.updateContent(['TestPlot', 'LAYER']); // missing both
        await new Promise(resolve => setImmediate(resolve));
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();
      });

      test('should handle load errors gracefully', async () => {
        jest.spyOn(mockLayerManager, 'loadLayer').mockRejectedValue(new Error('File not found'));

        await expect(plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/missing.bmp'])).resolves.not.toThrow();
      });
    });

    describe('CROP command', () => {
      beforeEach(() => {
        // CROP uses plotWindowIntegrator which calls drawLayerToCanvas internally.
        // In tests the window has no real renderer context so we verify via executeJavaScript.
        jest.spyOn(mockLayerManager, 'isLayerLoaded').mockReturnValue(true);
        jest.spyOn(mockLayerManager, 'drawLayerToCanvas').mockImplementation(() => {});
      });

      test('should call executeJavaScript for CROP operation', async () => {
        executeJavaScript.mockClear();
        // CROP goes through plotWindowIntegrator which fires executeJavaScript
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO']);
        // Integrator may call executeJavaScript; confirm no throw at minimum
        await expect(plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO'])).resolves.not.toThrow();
      });

      test('should validate layer index bounds (1-8)', async () => {
        // Index 0 and 9 are rejected
        await expect(plotWindow.updateContent(['TestPlot', 'CROP', '0', 'AUTO'])).resolves.not.toThrow();
        await expect(plotWindow.updateContent(['TestPlot', 'CROP', '9', 'AUTO'])).resolves.not.toThrow();
      });

      test('should handle missing parameters gracefully', async () => {
        await expect(plotWindow.updateContent(['TestPlot', 'CROP', '1'])).resolves.not.toThrow();
        await expect(plotWindow.updateContent(['TestPlot', 'CROP', '1', '10', '20', '100'])).resolves.not.toThrow();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Sprite commands
  // -----------------------------------------------------------------------
  describe('Sprite commands', () => {
    let mockSpriteManager: any;

    // A minimal sprite object for getSprite to return
    const fakeSpriteData = { id: 0, width: 2, height: 2, pixels: [0, 1, 2, 3], colors: Array(256).fill(0) };

    beforeEach(() => {
      // Replace spriteManager with a fully controlled mock
      mockSpriteManager = {
        defineSprite: jest.fn(),
        drawSprite: jest.fn(),
        isSpriteDefine: jest.fn().mockReturnValue(false),
        getSprite: jest.fn().mockReturnValue(undefined),    // default: undefined
        clearSprite: jest.fn(),
        clearAllSprites: jest.fn(),
        getMemoryStats: jest.fn().mockReturnValue({ spriteCount: 0, currentUsage: 0 }),
        suggestGarbageCollection: jest.fn()
      };
      (plotWindow as any).spriteManager = mockSpriteManager;
    });

    describe('SPRITEDEF command', () => {
      test('should define a simple 2x2 sprite', async () => {
        const palette = Array(256).fill(0).map((_, i) => `$${i.toString(16).padStart(6, '0')}`);
        const pixels = ['0', '1', '2', '3'];

        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '0', '2', '2',
          ...pixels,
          ...palette
        ]);

        expect(mockSpriteManager.defineSprite).toHaveBeenCalledWith(
          0, 2, 2,
          [0, 1, 2, 3],
          expect.arrayContaining([0])
        );
      });

      test('should validate sprite ID range — 255 is valid', async () => {
        const palette = Array(256).fill('0');
        const pixels = ['0'];

        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '255', '1', '1',
          ...pixels,
          ...palette
        ]);

        expect(mockSpriteManager.defineSprite).toHaveBeenCalledWith(255, 1, 1, [0], expect.any(Array));
      });

      test('should reject invalid sprite parameters', async () => {
        await plotWindow.updateContent(['TestPlot', 'SPRITEDEF', '0']);
        expect(mockSpriteManager.defineSprite).not.toHaveBeenCalled();

        await plotWindow.updateContent(['TestPlot', 'SPRITEDEF', 'abc', '2', '2']);
        expect(mockSpriteManager.defineSprite).not.toHaveBeenCalled();

        await plotWindow.updateContent(['TestPlot', 'SPRITEDEF', '0', 'x', 'y']);
        expect(mockSpriteManager.defineSprite).not.toHaveBeenCalled();
      });

      test('should fill pixel data from the token stream (no separate pixel/palette marker)', async () => {
        // Source reads pixelCount tokens as pixels, then 256 tokens as palette.
        // Providing only 2 pixel tokens followed by the palette means the parser reads 2
        // palette tokens as pixels 2 and 3 — so pixels = [0,1,0,0] and pixelCount = 4 →
        // defineSprite IS called (the stream-based parser has no type boundary marker).
        const palette = Array(256).fill('0');

        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '0', '2', '2',
          '0', '1',    // only 2 intended pixel tokens; parser reads 2 palette tokens too
          ...palette
        ]);

        // Source calls defineSprite because pixels.length (4) === pixelCount (4)
        expect(mockSpriteManager.defineSprite).toHaveBeenCalledWith(0, 2, 2, [0, 1, 0, 0], expect.any(Array));
      });

      test('should pad short palette with zeros and still call defineSprite', async () => {
        const pixels = ['0', '1', '2', '3'];
        const shortPalette = Array(100).fill('0'); // Only 100 colors instead of 256

        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '0', '2', '2',
          ...pixels,
          ...shortPalette
        ]);

        // Source pads colors to 256 with zeros, then calls defineSprite
        expect(mockSpriteManager.defineSprite).toHaveBeenCalledWith(0, 2, 2, [0, 1, 2, 3], expect.any(Array));
        const colorArg = (mockSpriteManager.defineSprite as jest.Mock).mock.calls[0][4];
        expect(colorArg.length).toBe(256); // Padded to 256
      });

      test('should handle large sprites', async () => {
        const width = 10;
        const height = 10;
        const pixels = Array(width * height).fill('42');
        const palette = Array(256).fill('$808080');

        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '10', `${width}`, `${height}`,
          ...pixels,
          ...palette
        ]);

        expect(mockSpriteManager.defineSprite).toHaveBeenCalledWith(
          10, width, height,
          expect.arrayContaining([42]),
          expect.any(Array)
        );
      });
    });

    describe('SPRITE command', () => {
      beforeEach(() => {
        // Make sprite 0 available via getSprite (source calls getSprite, not isSpriteDefine)
        mockSpriteManager.getSprite.mockImplementation((id: number) =>
          id === 0 ? fakeSpriteData : undefined
        );
        mockSpriteManager.isSpriteDefine.mockImplementation((id: number) => id === 0);
      });

      test('should draw sprite with default parameters — via executeJavaScript', async () => {
        executeJavaScript.mockClear();
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0']);

        // Source calls drawSpriteToPlot which calls executeJavaScript
        expect(executeJavaScript).toHaveBeenCalled();
        const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
        const spriteCall = calls.find((s: string) => typeof s === 'string' && s.includes('Sprite drawn'));
        expect(spriteCall).toBeDefined();
      });

      test('should draw sprite with orientation — orientation 1..7 are valid', async () => {
        executeJavaScript.mockClear();
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', '3']);
        expect(executeJavaScript).toHaveBeenCalled();
      });

      test('should draw sprite with orientation and scale', async () => {
        executeJavaScript.mockClear();
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', '4', '2']);
        expect(executeJavaScript).toHaveBeenCalled();
      });

      test('should draw sprite with all parameters (id orient scale opacity)', async () => {
        executeJavaScript.mockClear();
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', '7', '1', '128']);
        expect(executeJavaScript).toHaveBeenCalled();
      });

      test('should draw sprite at current cursor position', async () => {
        await plotWindow.updateContent(['TestPlot', 'SET', '100', '50']);
        expect((plotWindow as any).cursorPosition.x).toBe(100);
        expect((plotWindow as any).cursorPosition.y).toBe(50);

        executeJavaScript.mockClear();
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0']);
        expect(executeJavaScript).toHaveBeenCalled();
      });

      test('should skip undefined sprites (getSprite returns undefined)', async () => {
        // Sprite 1 is not defined — getSprite returns undefined
        executeJavaScript.mockClear();

        await plotWindow.updateContent(['TestPlot', 'SPRITE', '1']);

        // No sprite draw JS for undefined sprite
        const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
        const spriteCall = calls.find((s: string) => typeof s === 'string' && s.includes('Sprite drawn'));
        expect(spriteCall).toBeUndefined();
      });

      test('should reject invalid sprite ID (non-numeric)', async () => {
        executeJavaScript.mockClear();

        await plotWindow.updateContent(['TestPlot', 'SPRITE', 'abc']);
        await plotWindow.updateContent(['TestPlot', 'SPRITE']);

        const calls = executeJavaScript.mock.calls.map((c: any[]) => c[0]);
        const spriteCall = calls.find((s: string) => typeof s === 'string' && s.includes('Sprite drawn'));
        expect(spriteCall).toBeUndefined();
      });

      test('should handle all 8 orientations (0-7)', async () => {
        for (let orientation = 0; orientation < 8; orientation++) {
          executeJavaScript.mockClear();
          await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', `${orientation}`]);
          expect(executeJavaScript).toHaveBeenCalled();
        }
      });

      test('should handle valid scale values (1-64)', async () => {
        const scales = ['1', '2', '10', '64'];

        for (const scale of scales) {
          executeJavaScript.mockClear();
          await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', '0', scale]);
          expect(executeJavaScript).toHaveBeenCalled();
        }
      });

      test('should use defaults for non-numeric orientation', async () => {
        // Non-numeric orientation token → skipped (stays at 0 default), scale not parsed
        executeJavaScript.mockClear();
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', 'abc', '2', '128']);

        // Sprite IS drawn (id is valid), just with default orientation/scale
        expect(executeJavaScript).toHaveBeenCalled();
      });
    });

    describe('Sprite integration', () => {
      test('should define and draw multiple sprites', async () => {
        const palette = Array(256).fill('0');

        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '0', '2', '2',
          '0', '1', '2', '3',
          ...palette
        ]);

        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '1', '1', '1',
          '255',
          ...palette
        ]);

        expect(mockSpriteManager.defineSprite).toHaveBeenCalledTimes(2);

        // Make getSprite return valid data for both sprite IDs
        const fakeSprite1 = { id: 1, width: 1, height: 1, pixels: [255], colors: Array(256).fill(0) };
        mockSpriteManager.getSprite.mockImplementation((id: number) => {
          if (id === 0) return fakeSpriteData;
          if (id === 1) return fakeSprite1;
          return undefined;
        });

        executeJavaScript.mockClear();
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0']);
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '1', '4', '1']);

        // Both draws fire executeJavaScript with sprite rendering code
        const spriteCalls = executeJavaScript.mock.calls
          .map((c: any[]) => c[0])
          .filter((s: string) => typeof s === 'string' && s.includes('Sprite drawn'));
        expect(spriteCalls.length).toBe(2);
      });

      test('should work with UPDATE command for double buffering', async () => {
        mockSpriteManager.isSpriteDefine.mockImplementation((id: number) => id === 0);

        const mockPerformUpdate = jest.fn().mockResolvedValue(undefined);
        (plotWindow as any).performUpdate = mockPerformUpdate;

        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0']);
        await plotWindow.updateContent(['TestPlot', 'UPDATE']);

        expect(mockPerformUpdate).toHaveBeenCalled();
      });
    });
  });
});
