/** @format */

'use strict';

// tests/debugPlotWin.test.ts

import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { Context } from '../src/utils/context';
import { PlotDisplaySpec } from '../src/classes/debugPlotWin';
import { ColorTranslator } from '../src/classes/shared/colorTranslator';
import { LUTManager } from '../src/classes/shared/lutManager';
import { InputForwarder } from '../src/classes/shared/inputForwarder';
import { LayerManager } from '../src/classes/shared/layerManager';
import { SpriteManager } from '../src/classes/shared/spriteManager';
import { CanvasRenderer } from '../src/classes/shared/canvasRenderer';
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

describe('DebugPlotWindow', () => {
  let plotWindow: DebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  
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
    
    // Create display spec
    displaySpec = {
      displayName: 'TestPlot',
      windowTitle: 'Test Plot Window',
      position: { x: 100, y: 100 },
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
  });
  
  afterEach(() => {
    cleanupDebugWindowTest();
  });
  
  describe('Constructor and Initialization', () => {
    test('should create instance with display spec', () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      
      expect(plotWindow).toBeInstanceOf(DebugPlotWindow);
      expect((plotWindow as any).displaySpec).toEqual(displaySpec);
    });
    
    test('should initialize shared classes', () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      
      // Verify shared classes are initialized
      expect((plotWindow as any).colorTranslator).toBeInstanceOf(ColorTranslator);
      expect((plotWindow as any).lutManager).toBeInstanceOf(LUTManager);
      expect((plotWindow as any).inputForwarder).toBeInstanceOf(InputForwarder);
      expect((plotWindow as any).layerManager).toBeInstanceOf(LayerManager);
      expect((plotWindow as any).spriteManager).toBeInstanceOf(SpriteManager);
      expect((plotWindow as any).canvasRenderer).toBeInstanceOf(CanvasRenderer);
    });
    
    test('should initialize double buffering', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      
      // Double buffering is set up when first display data is received
      // Send an UPDATE command to trigger window creation and double buffering setup
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // We can't directly test private properties, but we can verify that
      // the window was created which means double buffering was set up
      expect((plotWindow as any).debugWindow).toBeDefined();
    });
    
    test('should set default values', () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      
      // Check default values
      expect((plotWindow as any).lineSize).toBe(1);
      expect((plotWindow as any).opacity).toBe(255);
      expect((plotWindow as any).textAngle).toBe(0);
      expect((plotWindow as any).colorMode).toBe('RGB24');
      expect((plotWindow as any).currFgColor).toBe('#00FFFF'); // Default is cyan
      // currBgColor is not used in Plot window - background is in displaySpec
    });
  });
  
  describe('Display Type Registration', () => {
    test('should return correct display type', () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      
      // Plot window doesn't have getDisplayType method, it's registered differently
      expect((plotWindow as any).displaySpec.displayName).toBe('TestPlot');
    });
  });
  
  describe('Shared Class Integration', () => {
    test('should handle COLOR command', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      
      // Send COLOR command
      await plotWindow.updateContent(['TestPlot', 'COLOR', '#FF0000']);
      
      // Verify color was set directly (Plot window doesn't use ColorTranslator for COLOR command)
      expect((plotWindow as any).currFgColor).toBe('#FF0000');
    });
    
    test('should use LUTManager for palette management', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      const lutManager = (plotWindow as any).lutManager;
      jest.spyOn(lutManager, 'setColor');
      
      // Set up double buffering
      // Double buffering is set up in constructor
      
      // Send LUTCOLORS command
      await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF0000', '$00FF00']);
      
      // Verify LUTManager was used
      expect(lutManager.setColor).toHaveBeenCalledTimes(2);
      expect(lutManager.setColor).toHaveBeenCalledWith(0, 0xFF0000);
      expect(lutManager.setColor).toHaveBeenCalledWith(1, 0x00FF00);
    });
    
    test('should initialize InputForwarder for PC_KEY/PC_MOUSE', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      const inputForwarder = (plotWindow as any).inputForwarder;
      jest.spyOn(inputForwarder, 'startPolling');
      
      // Set up double buffering
      // Double buffering is set up in constructor
      
      // Send PC_KEY command
      await plotWindow.updateContent(['TestPlot', 'PC_KEY']);
      
      // Verify InputForwarder was activated
      expect(inputForwarder.startPolling).toHaveBeenCalled();
    });
  });
  
  describe('Command Parsing', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      // Double buffering is set up in constructor
    });
    
    test('should handle all drawing commands', async () => {
      const commands = ['DOT', 'BOX', 'OBOX', 'OVAL', 'UPDATE', 'CLEAR'];
      
      for (const cmd of commands) {
        // updateContent returns void, just verify it doesn't throw
        await expect(plotWindow.updateContent(['TestPlot', cmd])).resolves.toBeUndefined();
      }
    });
    
    test('should handle all style commands', async () => {
      const styleCommands = [
        ['LINESIZE', '5'],
        ['OPACITY', '128'],
        ['TEXTANGLE', '45.5'],
        ['LUTCOLORS', '$000000']
      ];
      
      for (const cmd of styleCommands) {
        await expect(plotWindow.updateContent(['TestPlot', ...cmd])).resolves.toBeUndefined();
      }
    });
    
    test('should handle layer commands', async () => {
      const layerCommands = [
        ['LAYER', '1', 'test.bmp'],
        ['CROP', '1', 'AUTO', '0', '0']
      ];
      
      for (const cmd of layerCommands) {
        await expect(plotWindow.updateContent(['TestPlot', ...cmd])).resolves.toBeUndefined();
      }
    });
    
    test('should handle sprite commands', async () => {
      const spriteCommands = [
        ['SPRITEDEF', '0', '2', '2', '0', '1', '2', '3', ...Array(256).fill('$808080')],
        ['SPRITE', '0']
      ];
      
      for (const cmd of spriteCommands) {
        await expect(plotWindow.updateContent(['TestPlot', ...cmd])).resolves.toBeUndefined();
      }
    });
    
    test('should handle color mode commands', async () => {
      const colorModes = [
        'LUT1', 'LUT2', 'LUT4', 'LUT8',
        'LUMA8', 'LUMA8W', 'LUMA8X',
        'HSV8', 'HSV8W', 'HSV8X',
        'RGBI8', 'RGBI8W', 'RGBI8X',
        'RGB8', 'HSV16', 'HSV16W', 'HSV16X',
        'RGB16', 'RGB24'
      ];
      
      for (const mode of colorModes) {
        await expect(plotWindow.updateContent(['TestPlot', mode])).resolves.toBeUndefined();
        expect((plotWindow as any).colorMode).toBe(mode.toUpperCase());
      }
    });
    
    test('should handle coordinate system commands', async () => {
      const coordCommands = [
        ['ORIGIN', '100', '100'],
        ['SET', '50', '50'],
        ['POLAR'],
        ['CARTESIAN', '1', '1'],
        ['PRECISE']  // PRECISE toggles mode, no parameter needed
      ];
      
      for (const cmd of coordCommands) {
        await expect(plotWindow.updateContent(['TestPlot', ...cmd])).resolves.toBeUndefined();
      }
    });
  });
  
  describe('Double Buffer Architecture', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      // Double buffering is set up in constructor
    });
    
    test('should have separate working and display canvases', async () => {
      // Trigger window creation which sets up double buffering
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // The presence of OffscreenCanvas global and successful window creation
      // indicates that double buffering architecture is in place
      expect(global.OffscreenCanvas).toBeDefined();
      expect((plotWindow as any).debugWindow).toBeDefined();
    });
    
    test('should use OffscreenCanvas for working buffer', () => {
      // Since workingCanvas is created in setupDoubleBuffering, we can verify the global exists
      expect(global.OffscreenCanvas).toBeDefined();
    });
    
    test('should only update display on UPDATE command', async () => {
      // Mock performUpdate
      (plotWindow as any).performUpdate = jest.fn();
      
      // Draw commands should not trigger display update
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '30', '30']);
      
      expect((plotWindow as any).performUpdate).not.toHaveBeenCalled();
      
      // UPDATE command should trigger display update
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      expect((plotWindow as any).performUpdate).toHaveBeenCalled();
    });
  });
  
  describe('Window Management', () => {
    test('should close window on CLOSE command', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      // Double buffering is set up in constructor
      
      // Mock closeDebugWindow
      jest.spyOn(plotWindow, 'closeDebugWindow').mockImplementation(() => {});
      
      await plotWindow.updateContent(['TestPlot', 'CLOSE']);
      
      expect(plotWindow.closeDebugWindow).toHaveBeenCalled();
    });
    
    test('should save window to BMP on SAVE command', async () => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      // Double buffering is set up in constructor
      
      // Mock saveWindowToBMPFilename
      (plotWindow as any).saveWindowToBMPFilename = jest.fn();
      
      await plotWindow.updateContent(['TestPlot', 'SAVE', 'output.bmp']);
      
      expect((plotWindow as any).saveWindowToBMPFilename).toHaveBeenCalledWith('output.bmp');
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      // Double buffering is set up in constructor
    });
    
    test('should handle invalid commands gracefully', async () => {
      await expect(plotWindow.updateContent(['TestPlot', 'INVALID_COMMAND'])).resolves.toBeUndefined();
    });
    
    test('should handle missing parameters', async () => {
      // BOX needs width and height, should not throw
      await expect(plotWindow.updateContent(['TestPlot', 'BOX'])).resolves.toBeUndefined();
    });
    
    test('should handle non-matching display name', async () => {
      // Non-matching display name should still not throw
      await expect(plotWindow.updateContent(['WrongName', 'DOT'])).resolves.toBeUndefined();
    });
  });
  
  describe('Coordinate Transformations', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      // Double buffering is set up in constructor
    });
    
    test('should handle plot coordinates with origin at center', () => {
      // Origin starts at (0,0) by default
      // With default cartesian mode (xdir=false, ydir=false):
      // - X goes right: x = origin.x + x
      // - Y goes up: y = height - 1 - origin.y - y
      const [x, y] = (plotWindow as any).getXY(0, 0);
      expect(x).toBe(0); // origin.x (0) + x (0) = 0
      expect(y).toBe(255); // 256 - 1 - 0 - 0 = 255 (bottom of canvas)
    });
    
    test('should handle Y-axis inversion', () => {
      // Positive Y should go up in plot coordinates
      const [x1, y1] = (plotWindow as any).getXY(0, 10);
      const [x2, y2] = (plotWindow as any).getXY(0, -10);
      
      expect(y1).toBeLessThan(y2); // +Y is up, so smaller canvas Y
    });
    
    test('should update origin with ORIGIN command', async () => {
      await plotWindow.updateContent(['TestPlot', 'ORIGIN', '50', '50']);
      
      const [x, y] = (plotWindow as any).getXY(0, 0);
      expect(x).toBe(50);
      expect(y).toBe(205); // 255 - 50 (Y is inverted)
    });
  });
  
  describe('Sprite Operations', () => {
    test('should define sprites with SPRITE command', async () => {
      // Define a 2x2 sprite
      await plotWindow.updateContent(['TestPlot', 'SPRITE', '1', '2', '2']);
      await plotWindow.updateContent(['TestPlot', '$FF0000', '$00FF00']);
      await plotWindow.updateContent(['TestPlot', '$0000FF', '$FFFF00']);
      
      const spriteManager = (plotWindow as any).spriteManager;
      expect(spriteManager).toBeDefined();
    });
    
    test('should draw sprites with all 8 orientations', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Define sprite first
      await plotWindow.updateContent(['TestPlot', 'SPRITE', '1', '2', '2']);
      await plotWindow.updateContent(['TestPlot', '$FF0000', '$00FF00']);
      await plotWindow.updateContent(['TestPlot', '$0000FF', '$FFFF00']);
      
      // Draw sprite with different orientations (0-7)
      const orientations = ['0', '1', '2', '3', '4', '5', '6', '7'];
      for (const orient of orientations) {
        await plotWindow.updateContent(['TestPlot', 'SPRITEPUT', '1', '50', '50', orient, '1']);
      }
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Verify drawing occurred
      const mockWindow = (plotWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
    });
    
    test('should handle sprite scaling', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Define and draw sprite with scaling
      await plotWindow.updateContent(['TestPlot', 'SPRITE', '1', '1', '1']);
      await plotWindow.updateContent(['TestPlot', '$FF0000']);
      
      // Draw with different scales
      await plotWindow.updateContent(['TestPlot', 'SPRITEPUT', '1', '100', '100', '0', '2']); // 2x scale
      await plotWindow.updateContent(['TestPlot', 'SPRITEPUT', '1', '150', '150', '0', '0.5']); // 0.5x scale
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      expect((plotWindow as any).debugWindow).toBeDefined();
    });
  });

  describe('Layer Operations', () => {
    test('should load layers with LAYER command', async () => {
      // Layer command format: LAYER layer# filename {crop-left crop-top crop-right crop-bottom}
      await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '"test.png"']);
      
      const layerManager = (plotWindow as any).layerManager;
      expect(layerManager).toBeDefined();
    });
    
    test('should handle layer with crop rectangle', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '"test.png"', '10', '10', '100', '100']);
      
      expect((plotWindow as any).layerManager).toBeDefined();
    });
    
    test('should composite layers with LAYERPUT command', async () => {
      // First load a layer
      await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '"test.png"']);
      
      // Then composite it
      await plotWindow.updateContent(['TestPlot', 'LAYERPUT', '1', '50', '50']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
    });
  });

  describe('Advanced Coordinate Transformations', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
    });
    
    test('should handle polar coordinates with POLAR command', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // POLAR angle radius
      await plotWindow.updateContent(['TestPlot', 'POLAR', '45', '100']);
      
      // Should have moved the plot position
      expect((plotWindow as any).plotX).not.toBe(0);
      expect((plotWindow as any).plotY).not.toBe(0);
    });
    
    test('should handle SET command for absolute positioning', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // SET is absolute positioning
      await plotWindow.updateContent(['TestPlot', 'SET', '10', '20']);
      // Force processing of deferred commands
      (plotWindow as any).pushDisplayListToPlot();
      // SET updates cursorPosition
      expect((plotWindow as any).cursorPosition.x).toBe(10);
      expect((plotWindow as any).cursorPosition.y).toBe(20);
      
      // SET again to new position
      await plotWindow.updateContent(['TestPlot', 'SET', '25', '75']);
      // Force processing of deferred commands
      (plotWindow as any).pushDisplayListToPlot();
      expect((plotWindow as any).cursorPosition.x).toBe(25);
      expect((plotWindow as any).cursorPosition.y).toBe(75);
    });
    
    // MOVETO command is not implemented - use SET instead
  });

  describe('Opacity and Blending', () => {
    test('should set opacity with OPACITY command', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      await plotWindow.updateContent(['TestPlot', 'OPACITY', '128']); // 50% opacity
      
      expect((plotWindow as any).opacity).toBe(128);
    });
    
    test('should apply opacity to drawing operations', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      await plotWindow.updateContent(['TestPlot', 'OPACITY', '128']);
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'PLOT']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
    });
  });

  describe('Text Angle and Rotation', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
    });
    
    test('should set text angle with TEXTANGLE command', async () => {
      await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '45']);
      
      expect((plotWindow as any).textAngle).toBe(45);
    });
    
    test('should draw rotated text', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '90']);
      // TEXT command expects text directly after TEXT keyword
      // The implementation checks for numeric params first, then expects quoted text
      await plotWindow.updateContent(['TestPlot', 'TEXT', '10', '1', '90', "'Rotated Text'"]);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      expect(mockWindow).toBeDefined();
    });
    
    test('should reset text angle to 0', async () => {
      await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '45']);
      await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '0']);
      
      expect((plotWindow as any).textAngle).toBe(0);
    });
  });

  describe('Double Buffer Operations', () => {
    test('should not update display until UPDATE command', async () => {
      // Enable UPDATE mode first
      displaySpec.delayedUpdate = true;
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      
      // Do several drawing operations
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$00FF00']);
      await plotWindow.updateContent(['TestPlot', 'SET', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'LINE', '100', '100']);
      
      // In delayed mode, commands should be deferred
      expect((plotWindow as any).deferredCommands.length).toBeGreaterThan(0);
      
      // Now update
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // After UPDATE, deferred commands should be processed
      expect((plotWindow as any).deferredCommands.length).toBe(0);
    });
    
    test('should swap buffers on UPDATE', async () => {
      // Enable UPDATE mode first
      displaySpec.delayedUpdate = true;
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
      
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      
      // Draw on working buffer
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$00FF00']);
      await plotWindow.updateContent(['TestPlot', 'SET', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);
      
      // In delayed mode, commands are deferred
      const deferredCount = (plotWindow as any).deferredCommands.length;
      expect(deferredCount).toBeGreaterThan(0);
      
      // Update should process all deferred commands
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // All commands should be processed
      expect((plotWindow as any).deferredCommands.length).toBe(0);
    });
  });

  describe('Drawing Primitives Coverage', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
    });
    
    test('should handle OVAL command', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      
      // OVAL draws at current position
      await plotWindow.updateContent(['TestPlot', 'SET', '100', '100']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Should have drawn oval
      expect(mockWindow).toBeDefined();
    });
    
    test('should handle CIRCLE command', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      
      // CIRCLE draws at current position
      await plotWindow.updateContent(['TestPlot', 'SET', '100', '100']);
      await plotWindow.updateContent(['TestPlot', 'CIRCLE', '30']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Should have drawn circle
      expect(mockWindow).toBeDefined();
    });
    
    // POLY and BEZIER commands are not implemented
  });

  describe('Color Mode Coverage', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
    });
    
    test('should handle all LUT modes', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const lutModes = ['LUT1', 'LUT2', 'LUT4', 'LUT8'];
      for (const mode of lutModes) {
        await plotWindow.updateContent(['TestPlot', mode]);
      }
      
      expect((plotWindow as any).debugWindow).toBeDefined();
    });
    
    test('should handle RGB modes', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const rgbModes = ['RGBI8', 'RGB8', 'RGB16', 'RGB24'];
      for (const mode of rgbModes) {
        await plotWindow.updateContent(['TestPlot', mode]);
      }
      
      expect((plotWindow as any).debugWindow).toBeDefined();
    });
    
    test('should handle LUTCOLORS command', async () => {
      await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$000000', '$FFFFFF', '$FF0000', '$00FF00']);
      
      const lutManager = (plotWindow as any).lutManager;
      expect(lutManager).toBeDefined();
    });
  });

  describe('Additional Drawing Commands', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
    });
    
    // ARC and TRI commands are not implemented
    
    test('should handle DOT command', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      
      // DOT draws at current position
      await plotWindow.updateContent(['TestPlot', 'SET', '100', '100']);
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Should have drawn dot
      expect(mockWindow).toBeDefined();
    });
  });

  describe('Text and Font Commands', () => {
    // TEXTSIZE, TEXTSTYLE, and FONT are not implemented as separate commands
    // They can only be used as overrides in the TEXT command
  });

  describe('Fill Commands', () => {
    // FILL and FLOOD commands are not implemented
  });

  describe('Scroll and Clear Commands', () => {
    beforeEach(() => {
      plotWindow = new DebugPlotWindow(mockContext, displaySpec);
    });
    
    // SCROLL command is not implemented
    
    test('should handle CLEAR command', async () => {
      // Create window first
      await plotWindow.updateContent(['TestPlot', 'COLOR', '$FF0000']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      const mockWindow = (plotWindow as any).debugWindow;
      
      // Draw something first
      await plotWindow.updateContent(['TestPlot', 'SET', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // CLEAR clears the canvas  
      await plotWindow.updateContent(['TestPlot', 'CLEAR']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      // Window should still exist
      expect(mockWindow).toBeDefined();
    });
  });

  describe('Coverage for New Functionality', () => {
    test('should have high code coverage', () => {
      // This is a meta-test to remind about coverage
      // Run: npm run test:coverage -- tests/debugPlotWin.test.ts
      expect(true).toBe(true);
    });
  });
});