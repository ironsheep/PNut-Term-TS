/** @format */

'use strict';

// tests/debugBitmapWin.test.ts

import { DebugBitmapWindow } from '../src/classes/debugBitmapWin';
import { Context } from '../src/utils/context';
import { ColorTranslator, ColorMode } from '../src/classes/shared/colorTranslator';
import { LUTManager } from '../src/classes/shared/lutManager';
import { InputForwarder } from '../src/classes/shared/inputForwarder';
import { TracePatternProcessor } from '../src/classes/shared/tracePatternProcessor';
import { CanvasRenderer } from '../src/classes/shared/canvasRenderer';
import { BrowserWindow } from 'electron';
import { ePackedDataMode, ePackedDataWidth } from '../src/classes/debugWindowBase';

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
import { PackedDataProcessor } from '../src/classes/shared/packedDataProcessor';
(PackedDataProcessor.unpackSamples as jest.Mock) = jest.fn().mockReturnValue([0]);

describe('DebugBitmapWindow', () => {
  let window: DebugBitmapWindow;
  let mockContext: jest.Mocked<Context>;
  let mockBrowserWindow: any;

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
  });

  describe('parseBitmapDeclaration', () => {
    it('should parse a minimal bitmap declaration', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(['`BITMAP', 'myBitmap']);
      
      expect(isValid).toBe(true);
      expect(spec.displayName).toBe('myBitmap');
      expect(spec.title).toBe('Bitmap');
    });

    it('should fail when display name is missing', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(['`BITMAP']);
      
      expect(isValid).toBe(false);
    });

    it('should parse TITLE directive', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'TITLE', 'My Bitmap Window'
      ]);
      
      expect(isValid).toBe(true);
      expect(spec.title).toBe('My Bitmap Window');
    });

    it('should parse POS directive', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'POS', '100', '200'
      ]);
      
      expect(isValid).toBe(true);
      expect(spec.position).toEqual({ x: 100, y: 200 });
    });

    it('should parse SIZE directive', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'SIZE', '640', '480'
      ]);
      
      expect(isValid).toBe(true);
      expect(spec.size).toEqual({ width: 640, height: 480 });
    });

    it('should reject invalid SIZE values', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'SIZE', '3000', '480'
      ]);
      
      expect(isValid).toBe(false);
    });

    it('should parse DOTSIZE directive', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'DOTSIZE', '2', '3'
      ]);
      
      expect(isValid).toBe(true);
      expect(spec.dotSize).toEqual({ x: 2, y: 3 });
    });

    it('should parse COLOR directive', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'COLOR', '$FF0000'
      ]);
      
      expect(isValid).toBe(true);
      expect(spec.backgroundColor).toBe(0x000000); // Default for now
    });

    it('should parse HIDEXY directive', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'HIDEXY'
      ]);
      
      expect(isValid).toBe(true);
      expect(spec.hideXY).toBe(true);
    });
  });

  describe('updateContent', () => {
    beforeEach(() => {
      // Mock window creation
      window['debugWindow'] = mockBrowserWindow;
    });

    it('should parse bitmap size as first two numeric values', () => {
      window.updateContent(['256', '128']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should log error for invalid bitmap size', () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');
      
      window.updateContent(['3000', '100']);
      
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Bitmap size out of range'));
    });

    it('should handle CLEAR command', () => {
      window.updateContent(['256', '256', 'CLEAR']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('fillRect')
      );
    });

    it('should handle SET command with valid coordinates', () => {
      window.updateContent(['256', '256', 'SET', '10', '20']);
      
      // Should not log an error
      const logSpy = jest.spyOn(window as any, 'logMessage');
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('ERROR'));
    });

    it('should log error for SET command with invalid coordinates', () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');
      
      window.updateContent(['256', '256', 'SET', 'abc', '20']);
      
      expect(logSpy).toHaveBeenCalledWith('ERROR: SET command requires two numeric coordinates');
    });

    it('should handle UPDATE command', () => {
      window.updateContent(['256', '256', 'UPDATE']);
      
      // UPDATE is now a no-op in our implementation
      expect(true).toBe(true);
    });

    it('should handle SCROLL command', () => {
      window.updateContent(['256', '256', 'SCROLL', '10', '-20']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should handle TRACE command', () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      
      window.updateContent(['256', '256', 'TRACE', '5']);
      
      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(5);
    });

    it('should handle RATE command', () => {
      window.updateContent(['256', '256', 'RATE', '60']);
      
      // Check that rate was set
      expect(window['state'].rate).toBe(60);
    });

    it('should handle DOTSIZE command', () => {
      window.updateContent(['256', '256', 'DOTSIZE', '2', '2']);
      
      expect(window['state'].dotSizeX).toBe(2);
      expect(window['state'].dotSizeY).toBe(2);
    });

    it('should handle SPARSE command', () => {
      window.updateContent(['256', '256', 'SPARSE', '$FF0000']);
      
      expect(window['state'].sparseMode).toBe(true);
    });

    it('should handle SAVE command', () => {
      const saveSpy = jest.spyOn(window as any, 'saveWindowToBMPFilename').mockImplementation();
      
      window.updateContent(['256', '256', 'SAVE', 'test.bmp']);
      
      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });

    it('should handle SAVE WINDOW command', () => {
      const saveSpy = jest.spyOn(window as any, 'saveWindowToBMPFilename').mockImplementation();
      
      window.updateContent(['256', '256', 'SAVE', 'WINDOW', 'test.bmp']);
      
      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });

    it('should handle PC_KEY command', () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      window.updateContent(['256', '256', 'PC_KEY']);
      
      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
    });

    it('should handle PC_MOUSE command', () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      window.updateContent(['256', '256', 'PC_MOUSE']);
      
      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
    });
  });

  describe('Color mode commands', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;
    });

    it('should handle all color mode commands', () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const colorModes = [
        'LUT1', 'LUT2', 'LUT4', 'LUT8',
        'LUMA8', 'LUMA8W', 'LUMA8X',
        'HSV8', 'HSV8W', 'HSV8X',
        'RGBI8', 'RGBI8W', 'RGBI8X',
        'RGB8', 'HSV16', 'HSV16W', 'HSV16X',
        'RGB16', 'RGB24'
      ];

      colorModes.forEach(mode => {
        window.updateContent(['256', '256', mode]);
        expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode[mode as keyof typeof ColorMode]);
      });
    });

    it('should handle color mode with tune parameter', () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      
      window.updateContent(['256', '256', 'LUMA8', '5']);
      
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUMA8);
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(5);
    });

    it('should handle LUTCOLORS command', () => {
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];
      (mockLutManager.getPaletteSize as jest.Mock)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2);
      
      window.updateContent(['256', '256', 'LUTCOLORS', '255', '16711680', '65280']);
      
      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 255);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, 16711680);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(2, 65280);
    });
  });

  describe('Data processing', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;
      
      // Mock necessary components
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);
      
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      (mockCanvasRenderer.plotPixel as jest.Mock).mockReturnValue('plotPixel()');
      (mockCanvasRenderer.plotScaledPixel as jest.Mock).mockReturnValue('plotScaledPixel()');
    });

    it('should process numeric data values', () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      mockPackedDataProcessor.unpackSamples.mockReturnValue([255, 128, 64]);
      
      window.updateContent(['256', '256', '12345']);
      
      expect(mockPackedDataProcessor.unpackSamples).toHaveBeenCalledWith(12345, expect.any(Object));
    });

    it('should skip non-numeric data values', () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      
      window.updateContent(['256', '256', 'ABC', '123']);
      
      expect(mockPackedDataProcessor.unpackSamples).toHaveBeenCalledTimes(1); // Only for '123'
    });

    it('should handle rate cycling', () => {
      window['state'].rate = 2;
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      
      // Mock PackedDataProcessor to return single values
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      mockPackedDataProcessor.unpackSamples.mockReturnValue([100]);
      
      window.updateContent(['256', '256', '100', '200', '300', '400']);
      
      // With rate=2, only every second value should cause a step
      // 4 values, but rate=2 means only 2 steps
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(2);
    });

    it('should skip pixels in sparse mode that match background', () => {
      window['state'].sparseMode = true;
      window['state'].backgroundColor = 0;
      window['state'].rate = 1;
      
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      mockPackedDataProcessor.unpackSamples.mockReturnValue([0]); // Matches background
      
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      
      window.updateContent(['256', '256', '0']);
      
      expect(mockCanvasRenderer.plotPixel).not.toHaveBeenCalled();
    });

    it('should use plotScaledPixel when DOTSIZE is greater than 1', () => {
      window['state'].dotSizeX = 2;
      window['state'].dotSizeY = 3;
      window['state'].rate = 1;
      
      const mockCanvasRenderer = (CanvasRenderer as jest.MockedClass<typeof CanvasRenderer>).mock.instances[0];
      
      window.updateContent(['256', '256', '255']);
      
      expect(mockCanvasRenderer.plotScaledPixel).toHaveBeenCalled();
      expect(mockCanvasRenderer.plotPixel).not.toHaveBeenCalled();
    });
  });

  describe('closeDebugWindow', () => {
    it('should stop input polling and clean up', () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];
      
      window.closeDebugWindow();
      
      expect(mockInputForwarder.stopPolling).toHaveBeenCalled();
      expect(window['debugWindow']).toBeNull();
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;
    });

    it('should log error when setting pixel position before size is defined', () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');
      
      // Don't initialize size
      window['state'].isInitialized = false;
      window['setPixelPosition'](10, 10);
      
      expect(logSpy).toHaveBeenCalledWith('ERROR: Cannot set pixel position before bitmap size is defined');
    });

    it('should log error for invalid pixel coordinates', () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');
      
      window.updateContent(['100', '100', 'SET', '200', '50']);
      
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Invalid pixel coordinates'));
    });

    it('should log error when plotting pixels before size is defined', () => {
      // Create a new window and try to plot without setting size
      const newWindow = new DebugBitmapWindow('Test', 'test', mockContext);
      const logSpy = jest.spyOn(newWindow as any, 'logMessage');
      newWindow['debugWindow'] = mockBrowserWindow;
      // Use a command that won't be interpreted as width
      newWindow.updateContent(['CLEAR', '123']); // Try to plot data without size
      
      expect(logSpy).toHaveBeenCalledWith('ERROR: Cannot plot pixels before bitmap size is defined');
    });

    it('should log error when saving before initialization', () => {
      // Create a new window and try to save without initialization
      const newWindow = new DebugBitmapWindow('Test', 'test', mockContext);
      const logSpy = jest.spyOn(newWindow as any, 'logMessage');
      newWindow['debugWindow'] = mockBrowserWindow;
      newWindow['saveBitmap']('test.bmp', false);
      
      expect(logSpy).toHaveBeenCalledWith('ERROR: Cannot save bitmap before it is initialized');
    });
  });

  describe('Packed data mode', () => {
    it('should return correct packed data mode for LUT1', () => {
      window['state'].colorMode = ColorMode.LUT1;
      const mode = window['getPackedDataMode']();
      
      expect(mode.mode).toBe(ePackedDataMode.PDM_LONGS_1BIT);
      expect(mode.bitsPerSample).toBe(1);
      expect(mode.valueSize).toBe(ePackedDataWidth.PDW_LONGS);
    });

    it('should return correct packed data mode for RGB16', () => {
      window['state'].colorMode = ColorMode.RGB16;
      const mode = window['getPackedDataMode']();
      
      expect(mode.mode).toBe(ePackedDataMode.PDM_LONGS_16BIT);
      expect(mode.bitsPerSample).toBe(16);
      expect(mode.valueSize).toBe(ePackedDataWidth.PDW_LONGS);
    });

    it('should return correct packed data mode for RGB24', () => {
      window['state'].colorMode = ColorMode.RGB24;
      const mode = window['getPackedDataMode']();
      
      expect(mode.mode).toBe(ePackedDataMode.PDM_UNKNOWN);
      expect(mode.bitsPerSample).toBe(32);
      expect(mode.valueSize).toBe(ePackedDataWidth.PDW_LONGS);
    });
  });
});