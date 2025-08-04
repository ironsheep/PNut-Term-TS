/** @format */

'use strict';

// tests/debugPlotWin.commands.test.ts

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
  let mockWorkingCtx: any;
  let mockCanvasRenderer: CanvasRenderer;
  
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
      size: { width: 256, height: 256 },
      dotSize: { width: 1, height: 1 },
      window: { background: '#000000', grid: '#808080' },
      lutColors: [],
      delayedUpdate: false,
      hideXY: false
    };
    
    // Create Plot window
    plotWindow = new DebugPlotWindow(mockContext, displaySpec);
    
    // Override logMessage to avoid logging during tests
    jest.spyOn(plotWindow as any, 'logMessage').mockImplementation(() => {});
    
    // Mock working canvas and OffscreenCanvas
    const mockOffscreenCanvas = {
      width: 256,
      height: 256,
      getContext: jest.fn().mockReturnValue({
        canvas: { width: 256, height: 256 },
        globalAlpha: 1,
        lineWidth: 1,
        save: jest.fn(),
        restore: jest.fn(),
        drawImage: jest.fn(),
        fillRect: jest.fn(),
        clearRect: jest.fn()
      }),
      convertToBlob: jest.fn().mockResolvedValue(new Blob())
    };
    
    global.OffscreenCanvas = jest.fn().mockImplementation(() => mockOffscreenCanvas);
    
    // Mock working canvas context
    mockWorkingCtx = mockOffscreenCanvas.getContext('2d');
    
    // Trigger window creation and setup
    (plotWindow as any).isFirstDisplayData = true;
    (plotWindow as any).createDebugWindow = jest.fn();
    (plotWindow as any).setupDoubleBuffering = jest.fn().mockImplementation(() => {
      (plotWindow as any).workingCanvas = mockOffscreenCanvas;
      (plotWindow as any).workingCtx = mockWorkingCtx;
    });
    
    // Initialize double buffering
    (plotWindow as any).setupDoubleBuffering();
    
    // Set default origin at center (like Pascal)
    (plotWindow as any).origin = { x: 128, y: 128 };
    (plotWindow as any).canvasOffset = { x: 128, y: 128 };
    
    // Mock CanvasRenderer methods
    mockCanvasRenderer = (plotWindow as any).canvasRenderer;
    jest.spyOn(mockCanvasRenderer, 'plotPixelCtx').mockImplementation(() => {});
    jest.spyOn(mockCanvasRenderer, 'plotScaledPixelCtx').mockImplementation(() => {});
    jest.spyOn(mockCanvasRenderer, 'fillRect').mockImplementation(() => {});
    jest.spyOn(mockCanvasRenderer, 'drawRect').mockImplementation(() => {});
    jest.spyOn(mockCanvasRenderer, 'drawOval').mockImplementation(() => {});
    jest.spyOn(mockCanvasRenderer, 'drawCircleCtx').mockImplementation(() => {});
    jest.spyOn(mockCanvasRenderer, 'setOpacity').mockImplementation(() => {});
    jest.spyOn(mockCanvasRenderer, 'clearCanvas').mockImplementation(() => {});
  });
  
  afterEach(() => {
    cleanupDebugWindowTest();
  });
  
  describe('DOT command', () => {
    test('should draw dot at current position with default size', async () => {
      // Set cursor position
      (plotWindow as any).cursorPosition = { x: 50, y: 100 };
      (plotWindow as any).lineSize = 1;
      
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      
      // With inverted Y: x = 128 + 50 = 178, y = 256 - 1 - 128 - 100 = 27
      expect(mockCanvasRenderer.plotPixelCtx).toHaveBeenCalledWith(
        mockWorkingCtx,
        178, // x = origin.x + cursor.x
        27,  // y = height - 1 - origin.y - cursor.y
        expect.any(String) // Current color
      );
    });
    
    test('should draw dot with custom size', async () => {
      (plotWindow as any).cursorPosition = { x: 25, y: 75 };
      
      await plotWindow.updateContent(['TestPlot', 'DOT', '5']);
      
      expect(mockCanvasRenderer.drawCircleCtx).toHaveBeenCalledWith(
        mockWorkingCtx,
        expect.any(Number),
        expect.any(Number),
        2.5, // radius = size/2
        expect.any(String),
        true, // filled
        0
      );
    });
    
    test('should draw dot with custom size and opacity', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      
      await plotWindow.updateContent(['TestPlot', 'DOT', '3', '128']);
      
      expect(mockCanvasRenderer.setOpacity).toHaveBeenCalledWith(mockWorkingCtx, 128);
      expect(mockCanvasRenderer.drawCircleCtx).toHaveBeenCalled();
    });
    
    test('should handle invalid size parameter with default', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      (plotWindow as any).lineSize = 1;
      
      // Invalid size should default to lineSize
      await plotWindow.updateContent(['TestPlot', 'DOT', 'invalid']);
      
      expect(mockCanvasRenderer.drawCircleCtx).toHaveBeenCalledWith(
        mockWorkingCtx,
        expect.any(Number),
        expect.any(Number),
        0.5, // radius = lineSize/2 = 1/2
        expect.any(String),
        true,
        0
      );
    });
    
    test('should handle negative size as default', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      (plotWindow as any).lineSize = 2;
      
      // Negative size should default to lineSize
      await plotWindow.updateContent(['TestPlot', 'DOT', '-5']);
      
      expect(mockCanvasRenderer.drawCircleCtx).toHaveBeenCalledWith(
        mockWorkingCtx,
        expect.any(Number),
        expect.any(Number),
        1, // radius = lineSize/2 = 2/2
        expect.any(String),
        true,
        0
      );
    });
  });
  
  describe('BOX command', () => {
    test('should draw filled box at current position', async () => {
      (plotWindow as any).cursorPosition = { x: 50, y: 50 };
      
      await plotWindow.updateContent(['TestPlot', 'BOX', '40', '30']);
      
      // The Plot window transforms coordinates first, then centers the box
      // Transformed coords: x = 128 + 50 = 178, y = 256 - 1 - 128 - 50 = 77
      // Box bounds: x1 = 178 - 20 = 158, y1 = 77 - 15 = 62
      //            x2 = 178 + 20 = 198, y2 = 77 + 15 = 92
      expect(mockCanvasRenderer.drawRect).toHaveBeenCalledWith(
        mockWorkingCtx,
        158, // x1 = transformed_x - width/2
        62,  // y1 = transformed_y - height/2  
        198, // x2 = transformed_x + width/2
        92,  // y2 = transformed_y + height/2
        true, // filled
        expect.any(String),
        0 // line size 0 = filled
      );
    });
    
    test('should draw box with line size (outline)', async () => {
      (plotWindow as any).cursorPosition = { x: 100, y: 100 };
      
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50', '2']);
      
      // Transformed coords: x = 128 + 100 = 228, y = 256 - 1 - 128 - 100 = 27
      // Box bounds: x1 = 228 - 25 = 203, y1 = 27 - 25 = 2
      //            x2 = 228 + 25 = 253, y2 = 27 + 25 = 52
      expect(mockCanvasRenderer.drawRect).toHaveBeenCalledWith(
        mockWorkingCtx,
        203, // x1 = transformed_x - width/2
        2,   // y1 = transformed_y - height/2
        253, // x2 = transformed_x + width/2  
        52,  // y2 = transformed_y + height/2
        false, // not filled when lineSize > 0
        expect.any(String),
        2
      );
    });
    
    test('should draw box with opacity', async () => {
      await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20', '0', '200']);
      
      expect(mockCanvasRenderer.setOpacity).toHaveBeenCalledWith(mockWorkingCtx, 200);
      expect(mockCanvasRenderer.drawRect).toHaveBeenCalled();
    });
    
    test('should handle invalid width/height with defaults', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      
      // Invalid width defaults to 1, invalid height defaults to 1
      await plotWindow.updateContent(['TestPlot', 'BOX', 'invalid', 'bad']);
      
      expect(mockCanvasRenderer.drawRect).toHaveBeenCalledWith(
        mockWorkingCtx,
        127.5, // x1 = 128 - 0.5
        127.5, // y1 = 128 - 0.5
        128.5, // x2 = 128 + 0.5
        128.5, // y2 = 128 + 0.5
        true,
        expect.any(String),
        0
      );
    });
    
    test('should handle negative dimensions as positive', async () => {
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      
      // Negative dimensions should be treated as positive
      await plotWindow.updateContent(['TestPlot', 'BOX', '-20', '-30']);
      
      expect(mockCanvasRenderer.drawRect).toHaveBeenCalledWith(
        mockWorkingCtx,
        118, // x1 = 128 - 10
        113, // y1 = 128 - 15
        138, // x2 = 128 + 10
        143, // y2 = 128 + 15
        true,
        expect.any(String),
        0
      );
    });
  });
  
  describe('OBOX command', () => {
    test('should draw outlined box with default line size', async () => {
      (plotWindow as any).cursorPosition = { x: 50, y: 50 };
      (plotWindow as any).lineSize = 2; // Default line size
      
      await plotWindow.updateContent(['TestPlot', 'OBOX', '60', '40']);
      
      // With origin at 128,128 and cursor at 50,50:
      // x1 = 128 + 50 - 30 = 148
      // y1 = 256 - 1 - 128 - 50 - 20 = 57
      // x2 = 128 + 50 + 30 = 208
      // y2 = 256 - 1 - 128 - 50 + 20 = 97
      expect(mockCanvasRenderer.drawRect).toHaveBeenCalledWith(
        mockWorkingCtx,
        148, 57, 208, 97,
        false, // always outlined for OBOX
        expect.any(String),
        2 // Uses current lineSize
      );
    });
    
    test('should draw outlined box with custom line size', async () => {
      await plotWindow.updateContent(['TestPlot', 'OBOX', '100', '80', '3']);
      
      expect(mockCanvasRenderer.drawRect).toHaveBeenCalledWith(
        mockWorkingCtx,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        false,
        expect.any(String),
        3 // Custom line size
      );
    });
  });
  
  describe('OVAL command', () => {
    test('should draw filled oval at current position', async () => {
      (plotWindow as any).cursorPosition = { x: 128, y: 128 };
      
      await plotWindow.updateContent(['TestPlot', 'OVAL', '80', '60']);
      
      // With origin at 128,128 and cursor at 128,128:
      // x = 128 + 128 = 256
      // y = 256 - 1 - 128 - 128 = -1
      expect(mockCanvasRenderer.drawOval).toHaveBeenCalledWith(
        mockWorkingCtx,
        256, // center x = origin.x + cursor.x
        -1,  // center y = height - 1 - origin.y - cursor.y
        40,  // rx = width/2
        30,  // ry = height/2
        true, // filled (lineSize = 0)
        expect.any(String),
        0
      );
    });
    
    test('should draw outlined oval with line size', async () => {
      await plotWindow.updateContent(['TestPlot', 'OVAL', '100', '100', '3']);
      
      expect(mockCanvasRenderer.drawOval).toHaveBeenCalledWith(
        mockWorkingCtx,
        128, // x = origin.x + cursor.x = 128 + 0
        127, // y = 256 - 1 - origin.y - cursor.y = 256 - 1 - 128 - 0
        50, 50,
        false, // outlined when lineSize > 0
        expect.any(String),
        3
      );
    });
    
    test('should draw oval with opacity', async () => {
      await plotWindow.updateContent(['TestPlot', 'OVAL', '40', '40', '0', '100']);
      
      expect(mockCanvasRenderer.setOpacity).toHaveBeenCalledWith(mockWorkingCtx, 100);
      expect(mockCanvasRenderer.drawOval).toHaveBeenCalled();
    });
  });
  
  describe('UPDATE command', () => {
    let mockPerformUpdate: jest.SpyInstance;
    
    beforeEach(() => {
      mockPerformUpdate = jest.spyOn(plotWindow as any, 'performUpdate').mockImplementation(() => {});
    });
    
    test('should call performUpdate to copy working buffer to display', async () => {
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      expect(mockPerformUpdate).toHaveBeenCalled();
    });
    
    test('should perform multiple updates', async () => {
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      expect(mockPerformUpdate).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Double buffering behavior', () => {
    test('should draw to working context without UPDATE', async () => {
      const mockPerformUpdate = jest.spyOn(plotWindow as any, 'performUpdate').mockImplementation(() => {});
      
      // Draw multiple shapes without UPDATE
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);
      await plotWindow.updateContent(['TestPlot', 'OVAL', '30', '40']);
      
      // All drawing should go to working context - check that methods were called
      expect(mockCanvasRenderer.plotPixelCtx).toHaveBeenCalled();
      expect(mockCanvasRenderer.drawRect).toHaveBeenCalled();
      expect(mockCanvasRenderer.drawOval).toHaveBeenCalled();
      
      // No display updates should occur
      expect(mockPerformUpdate).not.toHaveBeenCalled();
    });
    
    test('should only update display on UPDATE command', async () => {
      const mockPerformUpdate = jest.spyOn(plotWindow as any, 'performUpdate').mockImplementation(() => {});
      
      // Draw shapes
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      await plotWindow.updateContent(['TestPlot', 'BOX', '50', '50']);
      
      expect(mockPerformUpdate).not.toHaveBeenCalled();
      
      // Now UPDATE
      await plotWindow.updateContent(['TestPlot', 'UPDATE']);
      
      expect(mockPerformUpdate).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Coordinate transformation', () => {
    test('should handle cartesian coordinates correctly', async () => {
      // Default cartesian mode with origin at center
      (plotWindow as any).origin = { x: 128, y: 128 };
      (plotWindow as any).cursorPosition = { x: 0, y: 0 };
      
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      
      // Should draw at center (origin offset applied)
      expect(mockCanvasRenderer.plotPixelCtx).toHaveBeenCalled();
    });
    
    test('should handle polar coordinates', async () => {
      // Switch to polar mode with default parameters
      await plotWindow.updateContent(['TestPlot', 'POLAR', '0', '0']);
      (plotWindow as any).cursorPosition = { x: 50, y: 0 }; // length=50, angle=0
      
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      
      expect(mockCanvasRenderer.plotPixelCtx).toHaveBeenCalled();
    });
  });
  
  describe('CLEAR command', () => {
    test('should clear the plot canvas', async () => {
      await plotWindow.updateContent(['TestPlot', 'CLEAR']);
      
      expect(mockCanvasRenderer.clearCanvas).toHaveBeenCalledWith(mockWorkingCtx);
      expect(mockCanvasRenderer.fillRect).toHaveBeenCalledWith(
        mockWorkingCtx,
        0, 0,
        displaySpec.size.width,
        displaySpec.size.height,
        displaySpec.window.background
      );
    });
  });
  
  describe('Color handling', () => {
    test('should use current foreground color for shapes', async () => {
      // Set a color
      (plotWindow as any).currFgColor = '#FF0000';
      
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      
      expect(mockCanvasRenderer.plotPixelCtx).toHaveBeenCalledWith(
        mockWorkingCtx,
        expect.any(Number),
        expect.any(Number),
        '#FF0000' // Should use the current color
      );
    });
    
    test('should handle color changes between shapes', async () => {
      (plotWindow as any).currFgColor = '#00FF00';
      await plotWindow.updateContent(['TestPlot', 'DOT']);
      
      (plotWindow as any).currFgColor = '#0000FF';
      await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20']);
      
      // Verify different colors were used
      const calls = (mockCanvasRenderer.plotPixelCtx as jest.Mock).mock.calls;
      expect(calls[0][3]).toBe('#00FF00');
      
      const rectCalls = (mockCanvasRenderer.drawRect as jest.Mock).mock.calls;
      expect(rectCalls[0][6]).toBe('#0000FF');
    });
  });
  
  describe('Style commands', () => {
    describe('LINESIZE command', () => {
      test('should set line width and persist across commands', async () => {
        // Set line size
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '5']);
        
        // Draw multiple shapes - they should all use line size 5
        await plotWindow.updateContent(['TestPlot', 'OBOX', '40', '40']);
        await plotWindow.updateContent(['TestPlot', 'OVAL', '30', '30', '5']); // Pass explicit lineSize
        
        // Both should use line width 5
        const drawRectCalls = (mockCanvasRenderer.drawRect as jest.Mock).mock.calls;
        const drawOvalCalls = (mockCanvasRenderer.drawOval as jest.Mock).mock.calls;
        
        expect(drawRectCalls[0][7]).toBe(5); // Line width param
        expect(drawOvalCalls[0][7]).toBe(5); // Line width param
        
        // Verify lineSize is stored in state
        expect((plotWindow as any).lineSize).toBe(5);
      });
      
      test('should handle invalid line size values with defensive defaults', async () => {
        // Set initial line size
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '2']);
        expect((plotWindow as any).lineSize).toBe(2);
        
        // Invalid string should default to 1
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', 'abc']);
        expect((plotWindow as any).lineSize).toBe(1);
        
        // Negative values should be clamped to 1
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '-5']);
        expect((plotWindow as any).lineSize).toBe(1);
        
        // Zero should be allowed (for special drawing modes)
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '0']);
        expect((plotWindow as any).lineSize).toBe(0);
        
        // Very large values should be clamped to 255
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '300']);
        expect((plotWindow as any).lineSize).toBe(255);
        
        // Valid value should work normally
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '10']);
        expect((plotWindow as any).lineSize).toBe(10);
      });
    });
    
    describe('OPACITY command', () => {
      test('should set opacity and affect subsequent draws', async () => {
        // Set opacity
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '128']);
        
        // Draw shapes - they should use the opacity
        await plotWindow.updateContent(['TestPlot', 'DOT']);
        await plotWindow.updateContent(['TestPlot', 'BOX', '20', '20']);
        
        // setOpacity should have been called
        expect(mockCanvasRenderer.setOpacity).toHaveBeenCalledWith(mockWorkingCtx, 128);
        
        // Verify opacity is stored in state
        expect((plotWindow as any).opacity).toBe(128);
      });
      
      test('should handle opacity boundary values', async () => {
        // Test 0 (fully transparent)
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '0']);
        expect((plotWindow as any).opacity).toBe(0);
        
        // Test 255 (fully opaque)
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '255']);
        expect((plotWindow as any).opacity).toBe(255);
        
        // Test out of bounds - should clamp
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '300']);
        expect((plotWindow as any).opacity).toBe(255);
        
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '-50']);
        expect((plotWindow as any).opacity).toBe(0);
      });
      
      test('should restore opacity after drawing with custom opacity', async () => {
        // Set default opacity
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '200']);
        
        // Draw with custom opacity
        await plotWindow.updateContent(['TestPlot', 'BOX', '10', '10', '0', '100']);
        
        // Should temporarily use 100
        expect(mockCanvasRenderer.setOpacity).toHaveBeenCalledWith(mockWorkingCtx, 100);
        
        // Next draw should use default opacity
        await plotWindow.updateContent(['TestPlot', 'DOT']);
        expect(mockCanvasRenderer.setOpacity).toHaveBeenLastCalledWith(mockWorkingCtx, 200);
      });
      
      test('should handle invalid opacity values with defensive defaults', async () => {
        // Invalid string should default to 255
        await plotWindow.updateContent(['TestPlot', 'OPACITY', 'invalid']);
        expect((plotWindow as any).opacity).toBe(255);
        
        // Empty string should default to 255
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '']);
        expect((plotWindow as any).opacity).toBe(255);
        
        // Floating point values should be truncated
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '128.7']);
        expect((plotWindow as any).opacity).toBe(128);
      });
    });
    
    describe('TEXTANGLE command', () => {
      test('should set text rotation angle in degrees', async () => {
        // Set text angle to 45 degrees
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '45']);
        expect((plotWindow as any).textAngle).toBe(45);
        
        // Set to 90.5 degrees (with hundredths)
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '90.5']);
        expect((plotWindow as any).textAngle).toBe(90.5);
        
        // Negative angle
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '-30']);
        expect((plotWindow as any).textAngle).toBe(-30);
      });
      
      test('should handle angle wrapping', async () => {
        // Angles should be stored as-is, wrapping handled by renderer
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '370']);
        expect((plotWindow as any).textAngle).toBe(370);
        
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '-370']);
        expect((plotWindow as any).textAngle).toBe(-370);
      });
      
      test('should handle invalid angle values with defensive defaults', async () => {
        // Invalid string should default to 0
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', 'invalid']);
        expect((plotWindow as any).textAngle).toBe(0);
        
        // Empty string should default to 0
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '']);
        expect((plotWindow as any).textAngle).toBe(0);
        
        // Very large angles are allowed (no clamping)
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '3600']);
        expect((plotWindow as any).textAngle).toBe(3600);
      });
    });
    
    describe('LUTCOLORS command', () => {
      let mockLutManager: any;
      
      beforeEach(() => {
        mockLutManager = (plotWindow as any).lutManager;
        jest.spyOn(mockLutManager, 'setColor').mockImplementation(() => {});
      });
      
      test('should load color palette into LUT', async () => {
        // Load 4 colors starting at index 0
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF0000', '$00FF00', '$0000FF', '$FFFFFF']);
        
        expect(mockLutManager.setColor).toHaveBeenCalledTimes(4);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(1, 0, 0xFF0000);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(2, 1, 0x00FF00);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(3, 2, 0x0000FF);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(4, 3, 0xFFFFFF);
      });
      
      test('should handle different color formats', async () => {
        // Hex without $ is not supported, only decimal or $hex
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF00FF', '123456']);
        
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(1, 0, 0xFF00FF);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(2, 1, 123456); // Decimal value
      });
      
      test('should handle partial palette loads', async () => {
        // Load colors starting at index 0 always
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$AABBCC', '$DDEEFF', '$112233']);
        
        expect(mockLutManager.setColor).toHaveBeenCalledTimes(3);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(1, 0, 0xAABBCC);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(2, 1, 0xDDEEFF);
        expect(mockLutManager.setColor).toHaveBeenNthCalledWith(3, 2, 0x112233);
      });
      
      test('should validate color count matches specified count', async () => {
        // LUTCOLORS doesn't take count, just loads all colors provided
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF0000', '$00FF00']);
        
        // Should process both colors
        expect(mockLutManager.setColor).toHaveBeenCalledTimes(2);
      });
    });
    
    describe('Style persistence and integration', () => {
      test('should maintain all style states across multiple commands', async () => {
        // Set multiple style properties
        await plotWindow.updateContent(['TestPlot', 'LINESIZE', '3']);
        await plotWindow.updateContent(['TestPlot', 'OPACITY', '180']);
        await plotWindow.updateContent(['TestPlot', 'TEXTANGLE', '30']);
        
        // Verify all are stored
        expect((plotWindow as any).lineSize).toBe(3);
        expect((plotWindow as any).opacity).toBe(180);
        expect((plotWindow as any).textAngle).toBe(30);
        
        // Draw shapes - should use current styles
        await plotWindow.updateContent(['TestPlot', 'OBOX', '50', '50']);
        
        expect(mockCanvasRenderer.setOpacity).toHaveBeenCalledWith(mockWorkingCtx, 180);
        expect(mockCanvasRenderer.drawRect).toHaveBeenCalledWith(
          mockWorkingCtx,
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          false,
          expect.any(String),
          3 // Line size
        );
      });
      
      test('should work with color mode changes', async () => {
        const mockColorTranslator = (plotWindow as any).colorTranslator;
        const mockLutManager = (plotWindow as any).lutManager;
        jest.spyOn(mockColorTranslator, 'translateColor').mockReturnValue('#FF0000');
        jest.spyOn(mockColorTranslator, 'setLutPalette').mockImplementation(() => {});
        jest.spyOn(mockLutManager, 'getPalette').mockReturnValue(new Uint32Array(256));
        jest.spyOn(mockLutManager, 'setColor').mockImplementation(() => {});
        
        // Load LUT colors
        await plotWindow.updateContent(['TestPlot', 'LUTCOLORS', '$FF0000', '$00FF00']);
        
        // Verify palette was updated
        expect(mockColorTranslator.setLutPalette).toHaveBeenCalled();
        expect(mockLutManager.setColor).toHaveBeenCalledTimes(2);
        
        // Switch to LUT1 mode (this sets the color mode)
        await plotWindow.updateContent(['TestPlot', 'LUT1']);
        expect((plotWindow as any).colorMode).toBe(ColorMode.LUT1);
        
        // Set a color value (this would use ColorTranslator in a real implementation)
        // For now, we just verify the mode was changed and palette was loaded
        // The actual color translation happens when parsing color values, not during drawing
      });
    });
  });
  
  describe('Layer commands', () => {
    let mockLayerManager: any;
    
    beforeEach(() => {
      mockLayerManager = (plotWindow as any).layerManager;
      jest.spyOn(mockLayerManager, 'loadLayer').mockResolvedValue(undefined);
      jest.spyOn(mockLayerManager, 'isLayerLoaded').mockReturnValue(false);
      jest.spyOn(mockLayerManager, 'drawLayerToCanvas').mockImplementation(() => {});
    });
    
    describe('LAYER command', () => {
      test('should load bitmap file into specified layer', async () => {
        await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/path/to/image.bmp']);
        
        expect(mockLayerManager.loadLayer).toHaveBeenCalledWith(0, '/path/to/image.bmp');
      });
      
      test('should convert layer index from 1-based to 0-based', async () => {
        await plotWindow.updateContent(['TestPlot', 'LAYER', '8', '/path/to/image.png']);
        
        expect(mockLayerManager.loadLayer).toHaveBeenCalledWith(7, '/path/to/image.png');
      });
      
      test('should validate layer index bounds', async () => {
        await plotWindow.updateContent(['TestPlot', 'LAYER', '0', '/path/to/image.bmp']);
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();
        
        await plotWindow.updateContent(['TestPlot', 'LAYER', '9', '/path/to/image.bmp']);
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();
      });
      
      test('should validate file extensions', async () => {
        // Valid extensions
        const validExtensions = ['.bmp', '.png', '.jpg', '.jpeg', '.gif'];
        for (const ext of validExtensions) {
          jest.clearAllMocks();
          await plotWindow.updateContent(['TestPlot', 'LAYER', '1', `/path/to/image${ext}`]);
          expect(mockLayerManager.loadLayer).toHaveBeenCalled();
        }
        
        // Invalid extension
        jest.clearAllMocks();
        await plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/path/to/image.txt']);
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();
      });
      
      test('should handle missing parameters', async () => {
        // Missing filename
        await plotWindow.updateContent(['TestPlot', 'LAYER', '1']);
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();
        
        // Missing both parameters
        jest.clearAllMocks();
        await plotWindow.updateContent(['TestPlot', 'LAYER']);
        expect(mockLayerManager.loadLayer).not.toHaveBeenCalled();
      });
      
      test('should handle load errors gracefully', async () => {
        mockLayerManager.loadLayer.mockRejectedValue(new Error('File not found'));
        
        // Should not throw
        await expect(plotWindow.updateContent(['TestPlot', 'LAYER', '1', '/missing.bmp'])).resolves.not.toThrow();
      });
    });
    
    describe('CROP command', () => {
      beforeEach(() => {
        // Make layer 1 (index 0) loaded by default
        mockLayerManager.isLayerLoaded.mockImplementation((index: number) => index === 0);
      });
      
      test('should draw layer in AUTO mode with default position', async () => {
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO']);
        
        expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          null, // No crop rect in AUTO mode
          0,    // Default X
          0     // Default Y
        );
      });
      
      test('should draw layer in AUTO mode with specified position', async () => {
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO', '100', '200']);
        
        expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          null,
          100,
          200
        );
      });
      
      test('should draw layer with manual crop rectangle', async () => {
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', '10', '20', '100', '80']);
        
        expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          {
            left: 10,
            top: 20,
            width: 100,
            height: 80
          },
          0, // Default destination X
          0  // Default destination Y
        );
      });
      
      test('should draw layer with manual crop and destination', async () => {
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', '10', '20', '100', '80', '50', '60']);
        
        expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          {
            left: 10,
            top: 20,
            width: 100,
            height: 80
          },
          50,
          60
        );
      });
      
      test('should validate layer is loaded', async () => {
        mockLayerManager.isLayerLoaded.mockReturnValue(false);
        
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO']);
        
        expect(mockLayerManager.drawLayerToCanvas).not.toHaveBeenCalled();
      });
      
      test('should validate layer index bounds', async () => {
        await plotWindow.updateContent(['TestPlot', 'CROP', '0', 'AUTO']);
        expect(mockLayerManager.drawLayerToCanvas).not.toHaveBeenCalled();
        
        await plotWindow.updateContent(['TestPlot', 'CROP', '9', 'AUTO']);
        expect(mockLayerManager.drawLayerToCanvas).not.toHaveBeenCalled();
      });
      
      test('should handle missing parameters', async () => {
        // Missing all crop parameters
        await plotWindow.updateContent(['TestPlot', 'CROP', '1']);
        expect(mockLayerManager.drawLayerToCanvas).not.toHaveBeenCalled();
        
        // Missing some manual crop parameters
        jest.clearAllMocks();
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', '10', '20', '100']); // Missing height
        expect(mockLayerManager.drawLayerToCanvas).not.toHaveBeenCalled();
      });
      
      test('should handle draw errors gracefully', async () => {
        mockLayerManager.drawLayerToCanvas.mockImplementation(() => {
          throw new Error('Canvas error');
        });
        
        // Should not throw
        await expect(plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO'])).resolves.not.toThrow();
      });
      
      test('should handle different layer indices', async () => {
        // Test multiple layers
        for (let i = 1; i <= 8; i++) {
          jest.clearAllMocks();
          mockLayerManager.isLayerLoaded.mockImplementation((index: number) => index === i - 1);
          
          await plotWindow.updateContent(['TestPlot', 'CROP', `${i}`, 'AUTO']);
          
          expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalledWith(
            mockWorkingCtx,
            i - 1, // 0-based index
            null,
            0,
            0
          );
        }
      });
    });
    
    describe('Layer command integration', () => {
      test('should load and then crop a layer', async () => {
        // Load layer
        await plotWindow.updateContent(['TestPlot', 'LAYER', '2', '/path/to/bg.bmp']);
        expect(mockLayerManager.loadLayer).toHaveBeenCalledWith(1, '/path/to/bg.bmp');
        
        // Mark layer as loaded
        mockLayerManager.isLayerLoaded.mockImplementation((index: number) => index === 1);
        
        // Crop the loaded layer
        await plotWindow.updateContent(['TestPlot', 'CROP', '2', 'AUTO', '50', '50']);
        expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalledWith(
          mockWorkingCtx,
          1,
          null,
          50,
          50
        );
      });
      
      test('should handle case sensitivity in commands', async () => {
        // Make layer 1 loaded
        mockLayerManager.isLayerLoaded.mockImplementation((index: number) => index === 0);
        
        // AUTO should be case-insensitive
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'auto']);
        expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalled();
        
        jest.clearAllMocks();
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'Auto']);
        expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalled();
        
        jest.clearAllMocks();
        await plotWindow.updateContent(['TestPlot', 'CROP', '1', 'AUTO']);
        expect(mockLayerManager.drawLayerToCanvas).toHaveBeenCalled();
      });
    });
  });
  
  describe('Sprite commands', () => {
    let mockSpriteManager: any;
    let mockOffscreenCanvas: any;
    
    beforeEach(() => {
      // Mock SpriteManager
      mockSpriteManager = {
        defineSprite: jest.fn(),
        drawSprite: jest.fn(),
        isSpriteDefine: jest.fn().mockReturnValue(false),
        clearSprite: jest.fn(),
        clearAllSprites: jest.fn()
      };
      
      // Replace the real sprite manager with the mock
      (plotWindow as any).spriteManager = mockSpriteManager;
      
      // Get the offscreen canvas reference from the parent scope
      mockOffscreenCanvas = (plotWindow as any).workingCanvas;
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
          0,
          2,
          2,
          [0, 1, 2, 3],
          expect.arrayContaining([0, 1, 2, 3]) // First few colors
        );
      });
      
      test('should handle various number formats for colors', async () => {
        const mixedPalette = [
          '$FF0000',  // Hex
          '%11111111000000001111111100000000', // Binary  
          '16776960', // Decimal (0xFFFF00)
          ...Array(253).fill('0')
        ];
        const pixels = ['0'];
        
        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '1', '1', '1',
          ...pixels,
          ...mixedPalette
        ]);
        
        expect(mockSpriteManager.defineSprite).toHaveBeenCalledWith(
          1,
          1,
          1,
          [0],
          expect.arrayContaining([0xFF0000, 0xFF00FF00, 0xFFFF00])
        );
      });
      
      test('should validate sprite ID range', async () => {
        const palette = Array(256).fill('0');
        const pixels = ['0'];
        
        // Valid ID (255)
        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '255', '1', '1',
          ...pixels,
          ...palette
        ]);
        
        expect(mockSpriteManager.defineSprite).toHaveBeenCalledWith(255, 1, 1, [0], expect.any(Array));
      });
      
      test('should reject invalid sprite parameters', async () => {
        // Missing parameters
        await plotWindow.updateContent(['TestPlot', 'SPRITEDEF', '0']);
        expect(mockSpriteManager.defineSprite).not.toHaveBeenCalled();
        
        // Invalid ID
        await plotWindow.updateContent(['TestPlot', 'SPRITEDEF', 'abc', '2', '2']);
        expect(mockSpriteManager.defineSprite).not.toHaveBeenCalled();
        
        // Invalid dimensions
        await plotWindow.updateContent(['TestPlot', 'SPRITEDEF', '0', 'x', 'y']);
        expect(mockSpriteManager.defineSprite).not.toHaveBeenCalled();
      });
      
      test('should handle incomplete pixel data', async () => {
        const palette = Array(256).fill('0');
        
        // Only 2 pixels provided for 2x2 sprite
        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '0', '2', '2',
          '0', '1',
          ...palette
        ]);
        
        // Should not call defineSprite with incomplete data
        expect(mockSpriteManager.defineSprite).not.toHaveBeenCalled();
      });
      
      test('should handle incomplete color palette', async () => {
        const pixels = ['0', '1', '2', '3'];
        const shortPalette = Array(100).fill('0'); // Only 100 colors instead of 256
        
        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '0', '2', '2',
          ...pixels,
          ...shortPalette
        ]);
        
        // Should not call defineSprite with incomplete palette
        expect(mockSpriteManager.defineSprite).not.toHaveBeenCalled();
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
          10,
          width,
          height,
          expect.arrayContaining([42]), // All pixels should be 42
          expect.any(Array)
        );
      });
    });
    
    describe('SPRITE command', () => {
      beforeEach(() => {
        // Mock that sprite 0 is defined
        mockSpriteManager.isSpriteDefine.mockImplementation((id: number) => id === 0);
      });
      
      test('should draw sprite with default parameters', async () => {
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0']);
        
        expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          0, // Default cursor position
          0, // Default cursor position
          0, // Default orientation
          1.0, // Default scale
          255 // Default opacity
        );
      });
      
      test('should draw sprite with orientation', async () => {
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', '3']);
        
        expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          0,
          0,
          3, // 270 degree rotation
          1.0,
          255
        );
      });
      
      test('should draw sprite with orientation and scale', async () => {
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', '4', '2.5']);
        
        expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          0,
          0,
          4, // Horizontal flip
          2.5, // 2.5x scale
          255
        );
      });
      
      test('should draw sprite with all parameters', async () => {
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', '7', '0.5', '128']);
        
        expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          0,
          0,
          7, // 270 degree rotation + flip
          0.5, // Half size
          128 // 50% opacity
        );
      });
      
      test('should draw sprite at current cursor position', async () => {
        // Move cursor
        await plotWindow.updateContent(['TestPlot', 'SET', '100', '50']);
        
        // Draw sprite
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0']);
        
        expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          100, // Cursor X
          50,  // Cursor Y
          0,
          1.0,
          255
        );
      });
      
      test('should reject undefined sprites', async () => {
        // Sprite 1 is not defined
        mockSpriteManager.isSpriteDefine.mockImplementation((id: number) => id === 0);
        
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '1']);
        
        expect(mockSpriteManager.drawSprite).not.toHaveBeenCalled();
      });
      
      test('should reject invalid sprite ID', async () => {
        await plotWindow.updateContent(['TestPlot', 'SPRITE', 'abc']);
        expect(mockSpriteManager.drawSprite).not.toHaveBeenCalled();
        
        await plotWindow.updateContent(['TestPlot', 'SPRITE']);
        expect(mockSpriteManager.drawSprite).not.toHaveBeenCalled();
      });
      
      test('should handle all 8 orientations', async () => {
        for (let orientation = 0; orientation < 8; orientation++) {
          jest.clearAllMocks();
          
          await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', `${orientation}`]);
          
          expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
            mockWorkingCtx,
            0,
            expect.any(Number),
            expect.any(Number),
            orientation,
            1.0,
            255
          );
        }
      });
      
      test('should handle various scale values', async () => {
        const scales = ['0.25', '0.5', '1', '1.5', '2', '10'];
        
        for (const scale of scales) {
          jest.clearAllMocks();
          
          await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', '0', scale]);
          
          expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
            mockWorkingCtx,
            0,
            expect.any(Number),
            expect.any(Number),
            0,
            parseFloat(scale),
            255
          );
        }
      });
      
      test('should skip non-numeric optional parameters', async () => {
        // Non-numeric orientation should be skipped
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0', 'abc', '2.0', '128']);
        
        expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
          mockWorkingCtx,
          0,
          0,
          0,
          0, // Default orientation
          1.0, // Default scale (abc was skipped, so 2.0 wasn't read as scale)
          255 // Default opacity
        );
      });
    });
    
    describe('Sprite integration', () => {
      test('should define and draw multiple sprites', async () => {
        const palette = Array(256).fill('0');
        
        // Define sprite 0
        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '0', '2', '2',
          '0', '1', '2', '3',
          ...palette
        ]);
        
        // Define sprite 1
        await plotWindow.updateContent([
          'TestPlot', 'SPRITEDEF', '1', '1', '1',
          '255',
          ...palette
        ]);
        
        expect(mockSpriteManager.defineSprite).toHaveBeenCalledTimes(2);
        
        // Mark sprites as defined
        mockSpriteManager.isSpriteDefine.mockImplementation((id: number) => id === 0 || id === 1);
        
        // Draw both sprites
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0']);
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '1', '4', '3']);
        
        expect(mockSpriteManager.drawSprite).toHaveBeenCalledTimes(2);
      });
      
      test('should work with UPDATE command for double buffering', async () => {
        mockSpriteManager.isSpriteDefine.mockImplementation((id: number) => id === 0);
        
        // Mock performUpdate method
        const mockPerformUpdate = jest.fn();
        (plotWindow as any).performUpdate = mockPerformUpdate;
        
        // Draw sprite (should go to working buffer)
        await plotWindow.updateContent(['TestPlot', 'SPRITE', '0']);
        
        // Verify sprite was drawn to working context
        expect(mockSpriteManager.drawSprite).toHaveBeenCalledWith(
          mockWorkingCtx,
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number)
        );
        
        // Update should trigger performUpdate
        await plotWindow.updateContent(['TestPlot', 'UPDATE']);
        
        expect(mockPerformUpdate).toHaveBeenCalled();
      });
    });
  });
});