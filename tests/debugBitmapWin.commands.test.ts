/** @format */

'use strict';

// tests/debugBitmapWin.commands.test.ts

import { DebugBitmapWindow } from '../src/classes/debugBitmapWin';
import { Context } from '../src/utils/context';
import { ColorTranslator, ColorMode } from '../src/classes/shared/colorTranslator';
import { LUTManager } from '../src/classes/shared/lutManager';
import { InputForwarder } from '../src/classes/shared/inputForwarder';
import { TracePatternProcessor } from '../src/classes/shared/tracePatternProcessor';
import { CanvasRenderer } from '../src/classes/shared/canvasRenderer';
import { BrowserWindow } from 'electron';
import { PackedDataProcessor } from '../src/classes/shared/packedDataProcessor';

// Mock all dependencies
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
(PackedDataProcessor.unpackSamples as jest.Mock) = jest.fn().mockReturnValue([0]);

describe('DebugBitmapWindow Command Tests', () => {
  let window: DebugBitmapWindow;
  let mockContext: jest.Mocked<Context>;
  let mockBrowserWindow: any;

  // Helper to create test display spec
  const createTestDisplaySpec = () => ({
    displayName: 'Test Bitmap',
    title: 'Test Bitmap',
    position: { x: 0, y: 0 },
    size: { width: 256, height: 256 }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock context
    mockContext = new Context() as jest.Mocked<Context>;
    mockContext.logger = {
      logMessage: jest.fn(),
      forceLogMessage: jest.fn()
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

    // Create window instance with correct signature
    window = new DebugBitmapWindow(mockContext, createTestDisplaySpec(), 'test-id');
    window['debugWindow'] = mockBrowserWindow;
    
    // Initialize bitmap with default size
    window.updateContent(['256', '256']);
  });

  describe('CLEAR command with different color modes', () => {
    it('should clear with RGB24 mode (default)', () => {
      window['state'].backgroundColor = 0xFF0000; // Red
      window.updateContent(['CLEAR']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('rgb(255, 0, 0)')
      );
    });

    it('should clear with black background', () => {
      window['state'].backgroundColor = 0x000000; // Black
      window.updateContent(['CLEAR']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('rgb(0, 0, 0)')
      );
    });

    it('should clear with white background', () => {
      window['state'].backgroundColor = 0xFFFFFF; // White
      window.updateContent(['CLEAR']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('rgb(255, 255, 255)')
      );
    });

    it('should clear after changing color mode', () => {
      window.updateContent(['RGB8', 'CLEAR']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });
  });

  describe('SET command with boundary conditions', () => {
    it('should set position at origin', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      
      window.updateContent(['SET', '0', '0']);
      
      expect(mockTraceProcessor.setPosition).toHaveBeenCalledWith(0, 0);
    });

    it('should set position at max bounds', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      
      window.updateContent(['SET', '255', '255']);
      
      expect(mockTraceProcessor.setPosition).toHaveBeenCalledWith(255, 255);
    });

    it('should reject negative coordinates', () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');
      
      window.updateContent(['SET', '-1', '0']);
      
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Invalid pixel coordinates'));
    });

    it('should reject out of bounds coordinates', () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');
      
      window.updateContent(['SET', '256', '256']);
      
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Invalid pixel coordinates'));
    });

    it('should handle decimal coordinates by truncating', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      
      window.updateContent(['SET', '10.5', '20.7']);
      
      expect(mockTraceProcessor.setPosition).toHaveBeenCalledWith(10, 20);
    });
  });

  describe('TRACE patterns with and without scrolling', () => {
    it.each([
      [0, 'right/no-scroll'],
      [1, 'left/no-scroll'],
      [2, 'right/scroll-left'],
      [3, 'left/scroll-right'],
      [4, 'down/no-scroll'],
      [5, 'up/no-scroll'],
      [6, 'down/scroll-up'],
      [7, 'up/scroll-down']
    ])('should set trace pattern %i (%s)', (pattern, description) => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      
      window.updateContent(['TRACE', pattern.toString()]);
      
      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(pattern);
    });

    it.each([8, 9, 10, 11, 12, 13, 14, 15])('should handle scroll bit for pattern %i', (pattern) => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      
      window.updateContent(['TRACE', pattern.toString()]);
      
      // Pattern is passed with scroll bit intact
      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(pattern);
    });

    it('should update rate when trace pattern changes', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(100);
      
      window['state'].rate = 0; // Auto rate
      window.updateContent(['TRACE', '4']);
      
      expect(window['state'].rate).toBe(100);
    });
  });

  describe('SCROLL command with positive/negative offsets', () => {
    it('should scroll with positive X and Y', () => {
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      (mockCanvasRenderer.scrollBitmap as jest.Mock).mockReturnValue('scrollBitmap()');
      
      window.updateContent(['SCROLL', '10', '20']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith('scrollBitmap()');
    });

    it('should scroll with negative X and Y', () => {
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      (mockCanvasRenderer.scrollBitmap as jest.Mock).mockReturnValue('scrollBitmap()');
      
      window.updateContent(['SCROLL', '-15', '-25']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith('scrollBitmap()');
    });

    it('should scroll with mixed positive/negative', () => {
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      (mockCanvasRenderer.scrollBitmap as jest.Mock).mockReturnValue('scrollBitmap()');
      
      window.updateContent(['SCROLL', '50', '-30']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith('scrollBitmap()');
    });

    it('should clamp scroll values to bitmap size', () => {
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      (mockCanvasRenderer.scrollBitmap as jest.Mock).mockReturnValue('scrollBitmap()');
      
      // Try to scroll beyond bitmap size
      window.updateContent(['SCROLL', '1000', '-1000']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });
  });

  describe('Color mode switching and LUTCOLORS loading', () => {
    it('should switch between color modes', () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      
      window.updateContent(['RGB24']);
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.RGB24);
      
      window.updateContent(['LUT8']);
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUT8);
      
      window.updateContent(['HSV16']);
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.HSV16);
    });

    it('should handle color mode with tune parameter', () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      
      window.updateContent(['LUMA8', '3']);
      
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUMA8);
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(3);
    });

    it('should load LUT colors in sequence', () => {
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];
      (mockLutManager.getPaletteSize as jest.Mock)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(3);
      
      window.updateContent(['LUTCOLORS', '$FF0000', '$00FF00', '$0000FF', '$FFFFFF']);
      
      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 0xFF0000);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, 0x00FF00);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(2, 0x0000FF);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(3, 0xFFFFFF);
    });

    it('should skip non-numeric values in LUTCOLORS', () => {
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];
      (mockLutManager.getPaletteSize as jest.Mock)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1);
      
      window.updateContent(['LUTCOLORS', '255', 'INVALID', '128']);
      
      expect(mockLutManager.setColor).toHaveBeenCalledTimes(2);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 255);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, 128);
    });
  });

  describe('PC_KEY/PC_MOUSE formatting', () => {
    it('should enable keyboard input with PC_KEY', () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      window.updateContent(['PC_KEY']);
      
      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('keydown')
      );
    });

    it('should enable mouse input with PC_MOUSE', () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      window.updateContent(['PC_MOUSE']);
      
      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('mousemove')
      );
    });

    it('should not process data after PC_KEY', () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      
      window.updateContent(['PC_KEY', '123', '456']);
      
      // PC_KEY should stop data processing
      expect(mockPackedDataProcessor.unpackSamples).not.toHaveBeenCalled();
    });

    it('should not process data after PC_MOUSE', () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      
      window.updateContent(['PC_MOUSE', '789', '012']);
      
      // PC_MOUSE should stop data processing
      expect(mockPackedDataProcessor.unpackSamples).not.toHaveBeenCalled();
    });
  });

  describe('SAVE command with various filenames', () => {
    beforeEach(() => {
      // Mock saveWindowToBMPFilename method
      window['saveWindowToBMPFilename'] = jest.fn();
    });

    it('should save with simple filename', () => {
      window.updateContent(['SAVE', 'output.bmp']);
      
      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('output.bmp');
    });

    it('should save with path in filename', () => {
      window.updateContent(['SAVE', '/path/to/output.bmp']);
      
      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('/path/to/output.bmp');
    });

    it('should save with WINDOW parameter', () => {
      window.updateContent(['SAVE', 'WINDOW', 'fullwindow.bmp']);
      
      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('fullwindow.bmp');
    });

    it('should use default filename when WINDOW is last parameter', () => {
      window.updateContent(['SAVE', 'WINDOW']);
      
      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('bitmap.bmp');
    });

    it('should handle filenames with spaces', () => {
      window.updateContent(['SAVE', 'my bitmap.bmp']);
      
      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('my bitmap.bmp');
    });

    it('should handle filenames without extension', () => {
      window.updateContent(['SAVE', 'mybitmap']);
      
      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('mybitmap');
    });
  });

  describe('RATE command behavior', () => {
    it('should set explicit rate', () => {
      window.updateContent(['RATE', '30']);
      
      expect(window['state'].rate).toBe(30);
    });

    it('should use suggested rate when 0', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(256);
      
      window.updateContent(['RATE', '0']);
      
      expect(window['state'].rate).toBe(256);
    });

    it('should reset rate counter when rate changes', () => {
      window['state'].rateCounter = 10;
      
      window.updateContent(['RATE', '60']);
      
      expect(window['state'].rateCounter).toBe(0);
    });
  });

  describe('DOTSIZE command behavior', () => {
    it('should set symmetric dot size', () => {
      window.updateContent(['DOTSIZE', '2', '2']);
      
      expect(window['state'].dotSizeX).toBe(2);
      expect(window['state'].dotSizeY).toBe(2);
    });

    it('should set asymmetric dot size', () => {
      window.updateContent(['DOTSIZE', '3', '5']);
      
      expect(window['state'].dotSizeX).toBe(3);
      expect(window['state'].dotSizeY).toBe(5);
    });

    it('should update input forwarder dot size', () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      window.updateContent(['DOTSIZE', '4', '4']);
      
      expect(mockInputForwarder.setDotSize).toHaveBeenCalledWith(4, 4);
    });

    it('should clamp dot size to minimum 1', () => {
      window.updateContent(['DOTSIZE', '0', '-5']);
      
      expect(window['state'].dotSizeX).toBe(1);
      expect(window['state'].dotSizeY).toBe(1);
    });
  });

  describe('SPARSE mode behavior', () => {
    it('should enable sparse mode with color', () => {
      window.updateContent(['SPARSE', '$FF0000']);
      
      expect(window['state'].sparseMode).toBe(true);
      expect(window['state'].backgroundColor).toBe(0xFF0000);
    });

    it('should parse decimal color values', () => {
      window.updateContent(['SPARSE', '16777215']); // White
      
      expect(window['state'].backgroundColor).toBe(16777215);
    });

    it('should parse binary color values', () => {
      window.updateContent(['SPARSE', '%11111111']); // 255
      
      expect(window['state'].backgroundColor).toBe(255);
    });
  });
});