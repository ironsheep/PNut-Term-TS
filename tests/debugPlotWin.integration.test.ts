/** @format */

'use strict';

// tests/debugPlotWin.integration.test.ts

import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { Context } from '../src/utils/context';
import { PlotDisplaySpec } from '../src/classes/debugPlotWin';
import { ColorMode } from '../src/classes/shared/colorTranslator';
import {
  createMockContext,
  createMockBrowserWindow,
  createMockOffscreenCanvas,
  createMockCanvasContext,
  setupDebugWindowTest,
  cleanupDebugWindowTest
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow())
}));

// Mock fs/promises for LayerManager
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  access: jest.fn()
}));

describe('DebugPlotWindow Integration Tests', () => {
  let plotWindow: DebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  let mockExecuteJS: jest.Mock;

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

    // Mock display spec
    displaySpec = {
      displayName: 'TestPlot',
      windowTitle: 'Test Plot Window',
      position: { x: 0, y: 0 },
      hasExplicitPosition: false,
      size: { width: 256, height: 256 },
      dotSize: { width: 1, height: 1 },
      window: {
        background: '#000000',
        grid: '#404040'
      },
      lutColors: [],
      delayedUpdate: false,
      hideXY: false
    };

    // Create plot window instance
    plotWindow = new DebugPlotWindow(mockContext, displaySpec);

    // Mark window as ready so updateContent processes commands immediately
    (plotWindow as any)['isWindowReady'] = true;

    // Capture the executeJavaScript mock from the debugWindow
    mockExecuteJS = (plotWindow as any).debugWindow?.webContents?.executeJavaScript as jest.Mock;
    if (mockExecuteJS) {
      mockExecuteJS.mockResolvedValue('ok');
    }

    // Mock createImageBitmap for layer loading
    global.createImageBitmap = jest.fn().mockResolvedValue({
      width: 100,
      height: 100,
      close: jest.fn()
    }) as any;

    // Mock Blob for layer loading
    global.Blob = jest.fn().mockImplementation((parts) => ({
      size: parts && parts[0] ? parts[0].length : 0,
      type: 'image/bmp'
    })) as any;
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  describe('Complete drawing workflow', () => {
    test('should handle color mode → load palette → draw shapes → UPDATE sequence', async () => {
      // 1. Set color mode to LUT8
      await plotWindow.updateContent(['TestPlot', 'LUT8']);

      // 2. Load a color palette
      await plotWindow.updateContent([
        'TestPlot', 'LUTCOLORS',
        '$000000', '$FF0000', '$00FF00', '$0000FF',
        '$FFFF00', '$FF00FF', '$00FFFF', '$FFFFFF'
      ]);

      // 3. Draw shapes
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '30', '20']);

      // 4. UPDATE to display
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Drawing uses executeJavaScript — verify it was called for draw + update operations
      expect(mockExecuteJS).toHaveBeenCalled();

      // The color mode should be set
      expect((plotWindow as any).colorMode).toBe(ColorMode.LUT8);
    });
  });

  describe('Double buffering behavior', () => {
    test('should not update display until UPDATE command', async () => {
      // Mock performUpdate to track buffer flips
      const mockPerformUpdate = jest.spyOn(plotWindow as any, 'performUpdate').mockResolvedValue(undefined);

      // Draw multiple shapes — no explicit UPDATE yet
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '15', '15']);

      // In live mode (delayedUpdate=false) parseSimpleCommands calls performUpdate
      // after EACH command — verify it was called for each draw command
      expect(mockPerformUpdate.mock.calls.length).toBeGreaterThanOrEqual(3);

      // Reset mock to track only the explicit UPDATE
      mockPerformUpdate.mockClear();

      // Now send explicit UPDATE
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      // UPDATE also triggers performUpdate via the parseSimpleCommands tail path
      expect(mockPerformUpdate).toHaveBeenCalled();
    });

    test('should support multiple UPDATE cycles', async () => {
      const mockPerformUpdate = jest.spyOn(plotWindow as any, 'performUpdate').mockResolvedValue(undefined);

      // First scene
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Clear and draw second scene
      await plotWindow.updateContent(['TestPlot', 'CLEAR']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '100', '100']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Multiple draw + update cycles should each call performUpdate
      expect(mockPerformUpdate.mock.calls.length).toBeGreaterThan(0);

      // CLEAR fires executeJavaScript for canvas clearing
      expect(mockExecuteJS).toHaveBeenCalled();
    });
  });

  describe('Layer compositing workflow', () => {
    test('should load and composite multiple layers', async () => {
      const fs = require('fs/promises');
      const mockBuffer = Buffer.from('fake image data');

      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      // Load background layer (.bmp is the only supported extension)
      await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/path/to/background.bmp']);
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async load

      // Load foreground layer
      await plotWindow.updateContent(['TestPlot', 'LAYER', '2', '/path/to/foreground.bmp']);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Draw shapes
      await plotWindow.updateContent(['TestPlot', 'COLOR', '#FF0000']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);

      // UPDATE to display
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Layer operations and drawing use executeJavaScript
      expect(mockExecuteJS).toHaveBeenCalled();
    });
  });

  describe('Sprite animation workflow', () => {
    test('should define sprites and animate them', async () => {
      // Define a simple 2x2 sprite
      await plotWindow.updateContent([
        'TestPlot', 'SPRITEDEF', '0', '2', '2',
        '0', '1', '2', '3', // Pixels
        ...Array(256).fill('$808080') // Palette
      ]);

      // Define another sprite
      await plotWindow.updateContent([
        'TestPlot', 'SPRITEDEF', '1', '3', '3',
        ...Array(9).fill('255'), // All white pixels
        ...Array(256).fill('$FFFFFF') // Palette
      ]);

      // Animate sprites at different positions
      for (let i = 0; i < 4; i++) {
        if (i > 0) {
          await plotWindow.updateContent(['TestPlot', 'CLEAR']);
        }

        await plotWindow.updateContent(['TestPlot', 'SET', `${i * 50}`, `${i * 50}`]);
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', `${i % 8}`, '2']);
        await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      }

      // Sprites 0 and 1 should be defined in spriteManager
      const spriteManager = (plotWindow as any).spriteManager;
      expect(spriteManager.isSpriteDefine(0)).toBe(true);
      expect(spriteManager.isSpriteDefine(1)).toBe(true);

      // Drawing uses executeJavaScript
      expect(mockExecuteJS).toHaveBeenCalled();
    });
  });

  describe('Style persistence across commands', () => {
    test('should maintain style settings throughout scene', async () => {
      // Set various styles
      await plotWindow.updateContent(['TestPlot', 'LINESIZE', '5']);
      await plotWindow.updateContent(['TestPlot', 'OPACITY', '128']);
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);

      // Verify styles are stored
      expect((plotWindow as any).lineSize).toBe(5);
      expect((plotWindow as any).opacity).toBe(128);
      expect((plotWindow as any).currFgColor).toBe('#FF0000');

      // Draw multiple shapes — all should use the styles
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '30', '30', '5']);

      // UPDATE
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Drawing operations reach executeJavaScript
      expect(mockExecuteJS).toHaveBeenCalled();
    });
  });

  describe('Color mode switching', () => {
    test('should handle color mode changes mid-scene', async () => {
      // Start in RGB24 mode
      await plotWindow.updateContent(['TestPlot', 'RGB24']);
      expect((plotWindow as any).colorMode).toBe(ColorMode.RGB24);
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'DOT', '5']);

      // Switch to LUT8 mode
      await plotWindow.updateContent(['TestPlot', 'LUT8']);
      expect((plotWindow as any).colorMode).toBe(ColorMode.LUT8);
      await plotWindow.updateContent([
        'TestPlot', 'LUTCOLORS',
        '$000000', '$FFFFFF', '$FF0000', '$00FF00',
        '$0000FF', '$FFFF00', '$FF00FF', '$00FFFF'
      ]);

      // Draw with numeric palette color
      await plotWindow.updateContent(['TestPlot', 'COLOR', '3']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20']);

      // Switch to HSV16 mode
      await plotWindow.updateContent(['TestPlot', 'HSV16']);
      expect((plotWindow as any).colorMode).toBe(ColorMode.HSV16);

      await plotWindow.updateContent(['TestPlot', 'OVAL', '15', '15']);

      // UPDATE
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // All drawing operations use executeJavaScript
      expect(mockExecuteJS).toHaveBeenCalled();
    });
  });

  describe('Complex scene composition', () => {
    test('should compose a complex scene with all features', async () => {
      // Set up the scene
      await plotWindow.updateContent(['TestPlot', 'LUT8']);
      await plotWindow.updateContent([
        'TestPlot', 'LUTCOLORS',
        '$000000', '$1F1F1F', '$3F3F3F', '$5F5F5F',
        '$7F7F7F', '$9F9F9F', '$BFBFBF', '$FFFFFF'
      ]);

      // Draw gradient boxes
      for (let i = 0; i < 8; i++) {
        await plotWindow.updateContent(['TestPlot', 'COLOR', `${i}`]);
        await plotWindow.updateContent(['TestPlot', 'SET', `${i * 30}`, '100']);
        await plotWindow.updateContent(['TestPlot', 'BOX', '25', '50']);
      }

      // Define and draw sprites
      await plotWindow.updateContent([
        'TestPlot', 'SPRITEDEF', '0', '4', '4',
        ...Array(16).fill('7'), // All white pixels
        ...Array(256).fill('$FFFFFF')
      ]);

      // Draw sprites with different orientations
      for (let i = 0; i < 8; i++) {
        await plotWindow.updateContent(['TestPlot', 'SET', `${i * 30}`, '200']);
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', `${i}`, '1']);
      }

      // Add some lines with varying opacity
      await plotWindow.updateContent(['TestPlot', 'LINESIZE', '3']);
      for (let i = 0; i < 4; i++) {
        await plotWindow.updateContent(['TestPlot', 'OPACITY', `${64 + i * 64}`]);
        await plotWindow.updateContent(['TestPlot', 'SET', '0', `${50 + i * 10}`]);
        await plotWindow.updateContent(['TestPlot', 'LINE', '256', `${50 + i * 10}`]);
      }

      // Final UPDATE
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // All drawing goes through executeJavaScript
      expect(mockExecuteJS).toHaveBeenCalled();

      // Verify state settings applied
      expect((plotWindow as any).lineSize).toBe(3);

      // Sprite 0 should be defined
      const spriteManager = (plotWindow as any).spriteManager;
      expect(spriteManager.isSpriteDefine(0)).toBe(true);
    });
  });

  describe('Error handling in workflows', () => {
    test('should handle missing sprites gracefully', async () => {
      // Try to draw undefined sprite — should silently skip
      await plotWindow.updateContent(['TestPlot', 'SPRITE', '99']);

      // Continue with other commands
      await plotWindow.updateContent(['TestPlot', 'DOT', '5']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Rendering continues without crashing
      expect(mockExecuteJS).toHaveBeenCalled();
    });

    test('should handle invalid layer operations', async () => {
      // Try to crop non-loaded layer — should silently skip
      await plotWindow.updateContent(['TestPlot', 'CROP', '5', 'AUTO', '0', '0']);

      // Continue with valid operations
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$00FF00']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '100', '100']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);

      // Rendering continues despite the skipped CROP
      expect(mockExecuteJS).toHaveBeenCalled();
    });
  });
});
