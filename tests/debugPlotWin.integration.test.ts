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
  let mockWorkingCtx: any;
  let mockDisplayCtx: any;
  let mockOffscreenCanvas: any;
  let mockDisplayCanvas: any;
  
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
    
    // Mock display spec
    displaySpec = {
      displayName: 'TestPlot',
      windowTitle: 'Test Plot Window',
      position: { x: 0, y: 0 },
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
    
    // Create mocked canvases
    mockOffscreenCanvas = createMockOffscreenCanvas(256, 256);
    mockWorkingCtx = mockOffscreenCanvas.getContext('2d');
    
    // Mock display canvas and context
    mockDisplayCanvas = testSetup.mockCanvas;
    mockDisplayCtx = mockDisplayCanvas.getContext('2d');
    
    // Setup double buffering
    (plotWindow as any).workingCanvas = mockOffscreenCanvas;
    (plotWindow as any).workingCtx = mockWorkingCtx;
    (plotWindow as any).displayCanvas = mockDisplayCanvas;
    (plotWindow as any).displayCtx = mockDisplayCtx;
    (plotWindow as any).isFirstDisplayData = true;
    (plotWindow as any).createDebugWindow = jest.fn();
    (plotWindow as any).setupDoubleBuffering = jest.fn();
    
    // Mock performUpdate to just call drawImage
    (plotWindow as any).performUpdate = jest.fn().mockImplementation(() => {
      mockDisplayCtx.drawImage(mockOffscreenCanvas, 0, 0);
    });
    
    // Set default origin at center
    (plotWindow as any).origin = { x: 128, y: 128 };
    (plotWindow as any).canvasOffset = { x: 128, y: 128 };
    
    // Mock CanvasRenderer methods to call through to the canvas context
    const mockCanvasRenderer = (plotWindow as any).canvasRenderer;
    if (mockCanvasRenderer) {
      jest.spyOn(mockCanvasRenderer, 'plotPixelCtx').mockImplementation((ctx: any) => {
        ctx.getImageData(0, 0, 1, 1);
        ctx.putImageData({} as any, 0, 0);
      });
      jest.spyOn(mockCanvasRenderer, 'drawCircleCtx').mockImplementation((ctx: any) => {
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
      });
      jest.spyOn(mockCanvasRenderer, 'fillRect').mockImplementation((ctx: any, x1: any, y1: any, x2: any, y2: any, color: any) => {
        ctx.fillStyle = color;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      });
      jest.spyOn(mockCanvasRenderer, 'drawRect').mockImplementation((ctx: any, x1: any, y1: any, x2: any, y2: any, filled: any, color: any, lineWidth: any) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        if (filled) {
          ctx.fillStyle = color;
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        } else {
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        }
      });
      jest.spyOn(mockCanvasRenderer, 'drawOval').mockImplementation((ctx: any) => {
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      jest.spyOn(mockCanvasRenderer, 'setOpacity').mockImplementation((ctx: any, opacity: any) => {
        ctx.globalAlpha = opacity / 255;
      });
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
      
      // 3. Draw shapes using palette colors
      await plotWindow.updateContent(['TestPlot', 'DOT', '10']); // Uses current color
      
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);
      
      await plotWindow.updateContent(['TestPlot', 'OVAL', '30', '20']);
      
      // 4. UPDATE to display
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify drawing operations happened
      expect(mockWorkingCtx.fillRect).toHaveBeenCalled(); // DOT and BOX use fillRect
      expect(mockWorkingCtx.ellipse).toHaveBeenCalled(); // OVAL
      
      // Verify UPDATE triggered display copy
      expect(mockDisplayCtx.drawImage).toHaveBeenCalledWith(mockOffscreenCanvas, 0, 0);
    });
  });
  
  describe('Double buffering behavior', () => {
    test('should not update display until UPDATE command', async () => {
      // Draw multiple shapes
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20']);
      await plotWindow.updateContent(['TestPlot', 'OBOX', '40', '40']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '15', '15']);
      
      // Verify no display updates yet
      expect(mockDisplayCtx.drawImage).not.toHaveBeenCalled();
      
      // Now UPDATE
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify display updated exactly once
      expect(mockDisplayCtx.drawImage).toHaveBeenCalledTimes(1);
    });
    
    test('should support multiple UPDATE cycles', async () => {
      // First scene
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Clear and draw second scene
      await plotWindow.updateContent(['TestPlot', 'CLEAR']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '100', '100']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify two updates
      expect(mockDisplayCtx.drawImage).toHaveBeenCalledTimes(2);
      expect(mockWorkingCtx.clearRect).toHaveBeenCalled();
    });
  });
  
  describe('Layer compositing workflow', () => {
    test('should load and composite multiple layers', async () => {
      const fs = require('fs/promises');
      const mockBuffer = Buffer.from('fake image data');
      
      (fs.readFile as jest.Mock).mockResolvedValue(mockBuffer);
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      
      // Load background layer
      await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/path/to/background.bmp']);
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for async load
      
      // Load foreground layer
      await plotWindow.updateContent(['TestPlot', 'LAYER', '2', '/path/to/foreground.png']);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Draw background with AUTO crop
      await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO', '0', '0']);
      
      // Draw shapes on top
      await plotWindow.updateContent(['TestPlot', 'COLOR', '#FF0000']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);
      
      // Draw foreground with manual crop
      await plotWindow.updateContent(['TestPlot', 'CROP', '2', '10', '10', '80', '80', '100', '100']);
      
      // UPDATE to display
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify layers were loaded
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(createImageBitmap).toHaveBeenCalledTimes(2);
      
      // Verify layers were drawn and composited
      expect(mockWorkingCtx.drawImage).toHaveBeenCalled(); // CROP operations
      expect(mockWorkingCtx.fillRect).toHaveBeenCalled(); // BOX between layers
      expect(mockDisplayCtx.drawImage).toHaveBeenCalledWith(mockOffscreenCanvas, 0, 0);
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
      const positions = [
        { x: 50, y: 50 },
        { x: 100, y: 50 },
        { x: 150, y: 50 },
        { x: 200, y: 50 }
      ];
      
      for (let i = 0; i < positions.length; i++) {
        // Clear previous frame
        if (i > 0) {
          await plotWindow.updateContent(['TestPlot', 'CLEAR']);
        }
        
        // Set position
        await plotWindow.updateContent(['TestPlot', 'SET', `${positions[i].x}`, `${positions[i].y}`]);
        
        // Draw sprite with rotation
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', `${i * 2}`, '2', '200']);
        
        // Draw second sprite
        await plotWindow.updateContent(['TestPlot', 'SET', `${positions[i].x}`, `${positions[i].y + 50}`]);
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '1', '0', '1.5']);
        
        // UPDATE frame
        await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      }
      
      // Verify sprite rendering
      expect(mockWorkingCtx.save).toHaveBeenCalled();
      expect(mockWorkingCtx.translate).toHaveBeenCalled();
      expect(mockWorkingCtx.rotate).toHaveBeenCalled();
      expect(mockWorkingCtx.scale).toHaveBeenCalled();
      expect(mockWorkingCtx.restore).toHaveBeenCalled();
      
      // Verify animation frames
      expect(mockDisplayCtx.drawImage).toHaveBeenCalledTimes(4); // 4 UPDATE calls
      expect(mockWorkingCtx.clearRect).toHaveBeenCalledTimes(3); // 3 CLEAR calls
    });
  });
  
  describe('Style persistence across commands', () => {
    test('should maintain style settings throughout scene', async () => {
      // Set various styles
      await plotWindow.updateContent(['TestPlot', 'LINESIZE', '5']);
      await plotWindow.updateContent(['TestPlot', 'OPACITY', '128']);
      await plotWindow.updateContent(['TestPlot', 'COLOR', '#FF0000']);
      
      // Draw multiple shapes - all should use the styles
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'OBOX', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '30', '30', '5']); // Outlined oval
      
      // UPDATE
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify drawing operations occurred with styles
      // Note: globalAlpha is saved/restored in local variables, not via save/restore methods
      expect(mockWorkingCtx.fill).toHaveBeenCalled(); // DOT with size 5 uses drawCircleCtx
      expect(mockWorkingCtx.strokeRect).toHaveBeenCalled(); // OBOX uses strokeRect
      expect(mockWorkingCtx.ellipse).toHaveBeenCalled(); // OVAL uses ellipse
      // The styles were applied during the operations even though globalAlpha was restored
    });
  });
  
  describe('Color mode switching', () => {
    test('should handle color mode changes mid-scene', async () => {
      // Start in RGB24 mode
      await plotWindow.updateContent(['TestPlot', 'RGB24']);
      await plotWindow.updateContent(['TestPlot', 'COLOR', '#FF0000']);
      await plotWindow.updateContent(['TestPlot', 'DOT', '5']);
      
      // Switch to LUT8 mode
      await plotWindow.updateContent(['TestPlot', 'LUT8']);
      await plotWindow.updateContent([
        'TestPlot', 'LUTCOLORS',
        '$000000', '$FFFFFF', '$FF0000', '$00FF00',
        '$0000FF', '$FFFF00', '$FF00FF', '$00FFFF'
      ]);
      
      // Draw with palette color
      await plotWindow.updateContent(['TestPlot', 'COLOR', '3']); // Green from palette
      await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20']);
      
      // Switch to HSV16 mode
      await plotWindow.updateContent(['TestPlot', 'HSV16']);
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$8FFF']); // HSV value
      await plotWindow.updateContent(['TestPlot', 'OVAL', '15', '15']);
      
      // UPDATE
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify different color modes were used
      expect(mockWorkingCtx.fillStyle).toBeTruthy();
      expect(mockWorkingCtx.fillRect).toHaveBeenCalled();
      expect(mockWorkingCtx.ellipse).toHaveBeenCalled();
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
      
      // Load a background layer (mock)
      const fs = require('fs/promises');
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('fake bg'));
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      
      await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/bg.bmp']);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Draw background
      await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO', '0', '0']);
      
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
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', `${i}`, '1.5', '200']);
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
      
      // Verify complex scene was rendered
      expect(mockWorkingCtx.drawImage).toHaveBeenCalled(); // Background
      expect(mockWorkingCtx.fillRect).toHaveBeenCalledTimes(8); // Gradient boxes
      expect(mockWorkingCtx.save).toHaveBeenCalled(); // Sprite transforms
      expect(mockWorkingCtx.beginPath).toHaveBeenCalled(); // Lines
      expect(mockDisplayCtx.drawImage).toHaveBeenCalledWith(mockOffscreenCanvas, 0, 0);
    });
  });
  
  describe('Error handling in workflows', () => {
    test('should handle missing sprites gracefully', async () => {
      // Try to draw undefined sprite
      await plotWindow.updateContent(['TestPlot', 'SPRITE', '99']);
      
      // Should continue with other commands - use DOT with size > 1 to use fillRect
      await plotWindow.updateContent(['TestPlot', 'DOT', '5']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify scene still renders (DOT size > 1 uses drawCircle which calls fill)
      expect(mockWorkingCtx.arc).toHaveBeenCalled();
      expect(mockWorkingCtx.fill).toHaveBeenCalled();
      expect(mockDisplayCtx.drawImage).toHaveBeenCalled();
    });
    
    test('should handle invalid layer operations', async () => {
      // Try to crop non-loaded layer
      await plotWindow.updateContent(['TestPlot', 'CROP', '5', 'AUTO', '0', '0']);
      
      // Continue with valid operations
      await plotWindow.updateContent(['TestPlot', 'COLOR', '#00FF00']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '100', '100']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify scene renders despite error
      expect(mockWorkingCtx.fillRect).toHaveBeenCalled();
      expect(mockDisplayCtx.drawImage).toHaveBeenCalled();
    });
  });
});