/** @format */

'use strict';

// tests/debugBitmapWin.integration.test.ts

import { DebugBitmapWindow } from '../src/classes/debugBitmapWin';
import { Context } from '../src/utils/context';
import { ColorTranslator, ColorMode } from '../src/classes/shared/colorTranslator';
import { LUTManager } from '../src/classes/shared/lutManager';
import { InputForwarder } from '../src/classes/shared/inputForwarder';
import { TracePatternProcessor } from '../src/classes/shared/tracePatternProcessor';
import { CanvasRenderer } from '../src/classes/shared/canvasRenderer';
import { BrowserWindow } from 'electron';
import { PackedDataProcessor } from '../src/classes/shared/packedDataProcessor';
import { ePackedDataMode } from '../src/classes/debugWindowBase';

// Mock dependencies
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    show: jest.fn(),
    on: jest.fn(),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }
  }))
}));

jest.mock('../src/utils/context');
jest.mock('../src/classes/shared/colorTranslator');
jest.mock('../src/classes/shared/lutManager');
jest.mock('../src/classes/shared/inputForwarder');
jest.mock('../src/classes/shared/tracePatternProcessor');
jest.mock('../src/classes/shared/canvasRenderer');
jest.mock('../src/classes/shared/packedDataProcessor');

// Mock static methods
(PackedDataProcessor.unpackSamples as jest.Mock) = jest.fn();

describe('DebugBitmapWindow Integration Tests', () => {
  let window: DebugBitmapWindow;
  let mockContext: jest.Mocked<Context>;
  let mockBrowserWindow: any;

  // Helper to ensure window is initialized with size
  const initializeWindow = (width: number = 100, height: number = 100) => {
    window.updateContent([String(width), String(height)]);
    // Clear any mocks set during initialization
    jest.clearAllMocks();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock context
    mockContext = new Context() as jest.Mocked<Context>;
    mockContext.logger = {
      logMessage: jest.fn()
    } as any;

    // Setup mock BrowserWindow
    mockBrowserWindow = {
      loadURL: jest.fn(),
      show: jest.fn(),
      on: jest.fn(),
      webContents: {
        executeJavaScript: jest.fn().mockResolvedValue(undefined),
        on: jest.fn()
      }
    };
    (BrowserWindow as jest.MockedClass<typeof BrowserWindow>).mockImplementation(() => mockBrowserWindow);

    // Create window instance
    window = new DebugBitmapWindow('Test Bitmap', 'test-id', mockContext);
    
    // Use defineProperty to properly set the debugWindow
    Object.defineProperty(window, 'debugWindow', {
      value: mockBrowserWindow,
      writable: true,
      configurable: true
    });
  });

  describe('ColorTranslator integration with bitmap plotting', () => {
    it('should translate colors and plot pixels correctly', () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      
      // Setup mocks
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000); // Red
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 10, y: 20 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      (mockCanvasRenderer.plotPixel as jest.Mock).mockReturnValue('plotPixel()');
      (PackedDataProcessor.unpackSamples as jest.Mock).mockReturnValue([255]);
      
      // Initialize and plot
      window.updateContent(['100', '100', 'RGB24', 'RATE', '1', '255']);
      
      // Verify color translation was called
      expect(mockColorTranslator.translateColor).toHaveBeenCalledWith(255);
      
      // Verify pixel was plotted with translated color
      expect(mockCanvasRenderer.plotPixel).toHaveBeenCalledWith(
        expect.any(String), 10, 20, '#ff0000'
      );
    });

    it('should handle LUT color modes with palette', () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];
      
      // Setup LUT palette
      (mockLutManager.getPaletteSize as jest.Mock)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(3);
      
      // Load palette colors
      window.updateContent(['100', '100', 'LUTCOLORS', '$FF0000', '$00FF00', '$0000FF', '$FFFFFF']);
      
      // Verify palette was set
      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 0xFF0000);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, 0x00FF00);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(2, 0x0000FF);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(3, 0xFFFFFF);
      
      // Set LUT2 mode
      window.updateContent(['LUT2']);
      
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUT2);
    });

    it('should handle color tuning for LUMA and HSV modes', () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      
      // Test LUMA8 with tune
      window.updateContent(['100', '100', 'LUMA8', '3']);
      
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUMA8);
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(3);
      
      // Test HSV16 with tune
      window.updateContent(['HSV16', '7']);
      
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.HSV16);
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(7);
    });
  });

  describe('TracePatternProcessor with actual pixel updates', () => {
    it('should update pixel positions according to trace pattern', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      
      // Setup mocks
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFFFFFF);
      (mockCanvasRenderer.plotPixel as jest.Mock).mockReturnValue('plotPixel()');
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      (PackedDataProcessor.unpackSamples as jest.Mock).mockReturnValue([255]);
      
      // Mock position sequence
      (mockTraceProcessor.getPosition as jest.Mock)
        .mockReturnValueOnce({ x: 0, y: 0 })
        .mockReturnValueOnce({ x: 1, y: 0 })
        .mockReturnValueOnce({ x: 2, y: 0 });
      
      // Initialize with right trace pattern
      window.updateContent(['100', '100', 'RATE', '1', 'TRACE', '0', '255', '128', '64']);
      
      // Verify trace pattern was set
      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(0);
      
      // Verify step was called for each pixel
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(3);
      
      // Verify pixels were plotted at correct positions
      expect(mockCanvasRenderer.plotPixel).toHaveBeenNthCalledWith(1,
        expect.any(String), 0, 0, expect.any(String)
      );
      expect(mockCanvasRenderer.plotPixel).toHaveBeenNthCalledWith(2,
        expect.any(String), 1, 0, expect.any(String)
      );
      expect(mockCanvasRenderer.plotPixel).toHaveBeenNthCalledWith(3,
        expect.any(String), 2, 0, expect.any(String)
      );
    });

    it('should handle scroll patterns with canvas scrolling', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      
      // Set pattern with scroll bit
      window.updateContent(['100', '100', 'TRACE', '10']); // Pattern 2 with scroll bit
      
      // Verify trace pattern was set
      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(10);
      
      // Verify scroll callback was registered
      expect(mockTraceProcessor.setScrollCallback).toHaveBeenCalled();
    });
  });

  describe('InputForwarder with mocked serial communication', () => {
    it('should forward keyboard events to serial', async () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      // Enable keyboard input
      window.updateContent(['100', '100', 'PC_KEY']);
      
      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
      
      // Verify keyboard event handler was set up
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('keydown')
      );
    });

    it('should forward mouse events with coordinate transformation', () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      // Set DOTSIZE for scaling
      window.updateContent(['100', '100', 'DOTSIZE', '2', '3']);
      
      expect(mockInputForwarder.setDotSize).toHaveBeenCalledWith(2, 3);
      
      // Enable mouse input
      window.updateContent(['PC_MOUSE']);
      
      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
      
      // Verify mouse event handlers were set up
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('mousemove')
      );
    });

    it('should set window dimensions for input coordinate validation', () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      window.updateContent(['320', '240']);
      
      expect(mockInputForwarder.setWindowDimensions).toHaveBeenCalledWith(320, 240);
    });
  });

  describe('Rate cycling with display updates', () => {
    it('should handle rate cycling correctly', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      
      // Setup initial mocks
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      
      // Initialize window
      initializeWindow(100, 100);
      
      // Set rate to 3 (plot every 3rd pixel)
      window.updateContent(['RATE', '3']);
      
      // Setup mocks for pixel plotting
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFFFFFF);
      (mockCanvasRenderer.plotPixel as jest.Mock).mockReturnValue('plotPixel()');
      (PackedDataProcessor.unpackSamples as jest.Mock).mockReturnValue([100]);
      
      // Send 6 individual pixels
      for (let i = 0; i < 6; i++) {
        window.updateContent([String(100 + i)]); // Different values to ensure they're processed
      }
      
      // With rate=3, only 2 pixels should be plotted (at counts 3 and 6)
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(2);
    });

    it('should use suggested rate when rate is 0', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      
      // Mock suggested rate
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(256);
      
      // Initialize with size (which sets rate to 0 initially)
      window.updateContent(['256', '256']);
      
      // Rate should be set to suggested value
      expect(window['state'].rate).toBe(256);
    });
  });

  describe('Sparse mode rendering', () => {
    it('should skip pixels matching background in sparse mode', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      
      // Setup initial mocks
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      
      // Initialize window
      initializeWindow(100, 100);
      
      // Enable sparse mode with black background
      window.updateContent(['RATE', '1', 'SPARSE', '0']);
      
      // Setup mocks for pixel plotting
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);
      (mockCanvasRenderer.plotPixel as jest.Mock).mockReturnValue('plotPixel()');
      
      // Mock unpacker to return the exact values we're sending
      (PackedDataProcessor.unpackSamples as jest.Mock)
        .mockReturnValueOnce([255])  // Non-background
        .mockReturnValueOnce([0])    // Matches background
        .mockReturnValueOnce([128])  // Non-background
        .mockReturnValueOnce([0]);   // Matches background
      
      // Send pixels individually with some matching background
      window.updateContent(['255']); // Non-background
      window.updateContent(['0']);    // Matches background
      window.updateContent(['128']); // Non-background
      window.updateContent(['0']);    // Matches background
      
      // Only non-background pixels should be plotted
      expect(mockCanvasRenderer.plotPixel).toHaveBeenCalledTimes(2); // Only 255 and 128
      
      // But trace should step for all pixels
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(4);
    });

    it('should plot all pixels in normal mode', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      
      // Setup initial mocks
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      
      // Initialize window
      initializeWindow(100, 100);
      
      // Set rate to 1 (plot every pixel)
      window.updateContent(['RATE', '1']);
      
      // Setup mocks for pixel plotting
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFFFFFF);
      (mockCanvasRenderer.plotPixel as jest.Mock).mockReturnValue('plotPixel()');
      
      // Mock unpacker to return different values
      (PackedDataProcessor.unpackSamples as jest.Mock)
        .mockReturnValueOnce([255])
        .mockReturnValueOnce([0])
        .mockReturnValueOnce([128])
        .mockReturnValueOnce([0]);
      
      // Send pixels individually
      window.updateContent(['255']);
      window.updateContent(['0']);
      window.updateContent(['128']);
      window.updateContent(['0']);
      
      // All pixels should be plotted
      expect(mockCanvasRenderer.plotPixel).toHaveBeenCalledTimes(4);
    });
  });

  describe('PackedDataProcessor integration', () => {
    it('should unpack data correctly for different color modes', () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      
      // Setup initial mocks
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      
      // Initialize window
      initializeWindow(100, 100);
      
      // Test LUT1 mode (1-bit packing)
      window.updateContent(['RATE', '1', 'LUT1']);
      
      // Setup mocks for pixel plotting
      mockPackedDataProcessor.unpackSamples.mockReturnValue([1, 0, 1, 1, 0, 1, 0, 1]); // 8 bits from 181
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFFFFFF);
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockCanvasRenderer.plotPixel as jest.Mock).mockReturnValue('plotPixel()');
      
      window.updateContent(['181']); // decimal 181 = 0b10110101
      
      expect(mockPackedDataProcessor.unpackSamples).toHaveBeenCalledWith(
        181,
        expect.objectContaining({
          mode: ePackedDataMode.PDM_LONGS_1BIT,
          bitsPerSample: 1
        })
      );
      
      // Clear and test RGB16 mode (16-bit packing)
      jest.clearAllMocks();
      window.updateContent(['RGB16']);
      
      // Setup mocks for next test
      mockPackedDataProcessor.unpackSamples.mockReturnValue([0xF800, 0x07E0]); // 2 16-bit values
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockCanvasRenderer.plotPixel as jest.Mock).mockReturnValue('plotPixel()');
      
      window.updateContent(['4177887232']); // decimal for 0xF80007E0
      
      expect(mockPackedDataProcessor.unpackSamples).toHaveBeenLastCalledWith(
        4177887232,
        expect.objectContaining({
          mode: ePackedDataMode.PDM_LONGS_16BIT,
          bitsPerSample: 16
        })
      );
    });
  });

  describe('Complete workflow integration', () => {
    it('should handle a complete bitmap drawing workflow', () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      // Setup mocks
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000); // Return valid color
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      (mockCanvasRenderer.plotScaledPixel as jest.Mock).mockReturnValue('plotScaledPixel()');
      (PackedDataProcessor.unpackSamples as jest.Mock).mockReturnValue([255]);
      
      // Complete workflow
      // 1. Initialize bitmap
      window.updateContent(['2', '2']); // Small 2x2 bitmap
      
      // 2. Clear bitmap
      window.updateContent(['CLEAR']);
      
      // 3. Set color mode
      window.updateContent(['RGB8']);
      
      // 4. Set trace pattern
      window.updateContent(['TRACE', '4']); // Down pattern
      
      // 5. Set dot size
      window.updateContent(['DOTSIZE', '10', '10']);
      
      // 6. Set rate to 1 to ensure all pixels are plotted
      window.updateContent(['RATE', '1']);
      
      // Clear mocks before plotting pixels
      jest.clearAllMocks();
      
      // Re-setup mocks for pixel plotting
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);
      (mockTraceProcessor.getPosition as jest.Mock)
        .mockReturnValueOnce({ x: 0, y: 0 })
        .mockReturnValueOnce({ x: 0, y: 1 })
        .mockReturnValueOnce({ x: 1, y: 0 })
        .mockReturnValueOnce({ x: 1, y: 1 });
      (mockCanvasRenderer.plotScaledPixel as jest.Mock).mockReturnValue('plotScaledPixel()');
      (PackedDataProcessor.unpackSamples as jest.Mock)
        .mockReturnValueOnce([255])
        .mockReturnValueOnce([128])
        .mockReturnValueOnce([64])
        .mockReturnValueOnce([32]);
      
      // 7. Plot pixels individually
      window.updateContent(['255']);
      window.updateContent(['128']);
      window.updateContent(['64']);
      window.updateContent(['32']);
      
      // Verify workflow
      expect(mockCanvasRenderer.plotScaledPixel).toHaveBeenCalledTimes(4);
      
      // 8. Save bitmap
      window['saveWindowToBMPFilename'] = jest.fn();
      window.updateContent(['SAVE', 'output.bmp']);
      
      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('output.bmp');
    });
  });
});