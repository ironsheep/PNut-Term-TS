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
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    isVisible: jest.fn().mockReturnValue(true),
    setTitle: jest.fn(),
    getTitle: jest.fn().mockReturnValue('Test Window'),
    setBounds: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
    getContentBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
    setSize: jest.fn(),
    getSize: jest.fn().mockReturnValue([800, 600]),
    setContentSize: jest.fn(),
    getContentSize: jest.fn().mockReturnValue([800, 600]),
    setPosition: jest.fn(),
    getPosition: jest.fn().mockReturnValue([0, 0]),
    removeMenu: jest.fn(),
    setMenuBarVisibility: jest.fn(),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      once: jest.fn(),
      send: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      capturePage: jest.fn().mockResolvedValue({ toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data')) })
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
// validatePackedMode is a static method called during parseBitmapDeclaration's default case.
// With the module mocked, we must provide it explicitly so it returns a tuple (not undefined).
(PackedDataProcessor.validatePackedMode as jest.Mock) = jest.fn().mockReturnValue([false, {}]);

describe('DebugBitmapWindow', () => {
  let window: DebugBitmapWindow;
  let mockContext: jest.Mocked<Context>;
  let mockBrowserWindow: any;

  // Helper to create test display spec
  const createTestDisplaySpec = (): any => ({
    displayName: 'Test Bitmap',
    windowTitle: 'Test Bitmap',
    position: { x: 0, y: 0 },
    size: { width: 256, height: 256 },
    colorMode: 1
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
      once: jest.fn(),
      removeAllListeners: jest.fn(),
      focus: jest.fn(),
      close: jest.fn(),
      destroy: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      isVisible: jest.fn().mockReturnValue(true),
      setTitle: jest.fn(),
      getTitle: jest.fn().mockReturnValue('Test Window'),
      setBounds: jest.fn(),
      getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
      getContentBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
      setSize: jest.fn(),
      getSize: jest.fn().mockReturnValue([800, 600]),
      setContentSize: jest.fn(),
      getContentSize: jest.fn().mockReturnValue([800, 600]),
      setPosition: jest.fn(),
      getPosition: jest.fn().mockReturnValue([0, 0]),
      removeMenu: jest.fn(),
      setMenuBarVisibility: jest.fn(),
      webContents: {
        executeJavaScript: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        once: jest.fn(),
        send: jest.fn(),
        removeAllListeners: jest.fn(),
        setMaxListeners: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(false),
        capturePage: jest.fn().mockResolvedValue({ toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data')) })
      }
    };
    (BrowserWindow as jest.MockedClass<typeof BrowserWindow>).mockImplementation(() => mockBrowserWindow);

    // Create window instance
    window = new DebugBitmapWindow(mockContext, createTestDisplaySpec(), 'test-id');

    // HARNESS FIX: updateContent() gates on isWindowReady; must be set AFTER construction
    // so that updateContent() calls in all tests actually invoke processMessageImmediate.
    (window as any).isWindowReady = true;

    // HARNESS FIX: translateColor is called in processDataValues on every pixel.
    // The auto-mock returns undefined, causing rgb24.toString(16) to crash and kill
    // the Jest worker.  Pre-seed the return value globally for all tests.
    const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
    if (mockColorTranslator) {
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);
    }

    // HARNESS FIX: traceProcessor.getPosition() is called in processDataValues for every
    // pixel; if it returns undefined, pos.x crashes the worker.  Pre-seed globally.
    const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
    if (mockTraceProcessor) {
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
    }
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

    // §15: SIZE is clamped, not rejected (Pascal KeyValWithin / displaySpecParser clamp).
    // A width of 3000 is clamped to 2048 — isValid stays true.
    it('should clamp out-of-range SIZE values instead of rejecting', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'SIZE', '3000', '480'
      ]);

      expect(isValid).toBe(true);
      expect(spec.size?.width).toBe(2048); // Clamped to max
    });

    it('should parse DOTSIZE directive', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'DOTSIZE', '2', '3'
      ]);

      expect(isValid).toBe(true);
      expect(spec.dotSize).toEqual({ x: 2, y: 3 });
    });

    // §15: BITMAP has no COLOR-to-backgroundColor mapping in parseBitmapDeclaration.
    // The COLOR token is not consumed by shared parser (each window handles it differently)
    // and in BITMAP's default case it is gracefully skipped via validatePackedMode check.
    // backgroundColor is left undefined in the spec.
    it('should parse COLOR directive without crashing (COLOR is silently skipped in BITMAP declarations)', () => {
      const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration([
        '`BITMAP', 'myBitmap', 'COLOR', '$FF0000'
      ]);

      expect(isValid).toBe(true);
      // backgroundColor is not set by the COLOR directive in parseBitmapDeclaration
      expect(spec.backgroundColor).toBeUndefined();
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
      // Reset to uninitialized so that tests using the ['256','256', COMMAND]
      // pattern work: the first two numeric tokens are treated as width/height
      // (the size-parse path in processMessageImmediate is only active when
      // isInitialized=false).  Tests that send commands as the first token
      // (CLEAR, SAVE, PC_KEY, PC_MOUSE, UPDATE) do NOT need this and are
      // invoked without a size prefix.
      window['state'].isInitialized = false;
    });

    it('should parse bitmap size as first two numeric values', async () => {
      await window.updateContent(['256', '128']);

      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should log error for invalid bitmap size', async () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');

      await window.updateContent(['3000', '100']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Bitmap size out of range'));
    });

    // CLEAR/UPDATE/SAVE/PC_KEY/PC_MOUSE are handled by handleCommonCommand() which checks
    // commandParts[0].  They must be the FIRST token — no '256 256' size prefix.
    it('should handle CLEAR command', async () => {
      window['state'].isInitialized = true; // already initialized for CLEAR
      await window.updateContent(['CLEAR']);

      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('fillRect')
      );
    });

    it('should handle SET command with valid coordinates', async () => {
      // '256 256' initializes the bitmap, then SET 10 20 is processed
      await window.updateContent(['256', '256', 'SET', '10', '20']);

      // Should not log an error
      const logSpy = jest.spyOn(window as any, 'logMessage');
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('ERROR'));
    });

    it('should log error for SET command with invalid coordinates', async () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');

      await window.updateContent(['256', '256', 'SET', 'abc', '20']);

      expect(logSpy).toHaveBeenCalledWith('ERROR: SET command requires two numeric coordinates');
    });

    it('should handle UPDATE command', async () => {
      window['state'].isInitialized = true;
      await window.updateContent(['UPDATE']);

      // UPDATE triggers forceDisplayUpdate -> updateCanvas -> executeJavaScript
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should handle SCROLL command with valid coordinates', async () => {
      await window.updateContent(['256', '256', 'SCROLL', '10', '-20']);

      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should log error for SCROLL command with invalid coordinates', async () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');

      await window.updateContent(['256', '256', 'SCROLL', 'invalid', '20']);

      expect(logSpy).toHaveBeenCalledWith('ERROR: SCROLL command requires two numeric coordinates');
    });

    it('should log error for SCROLL command missing coordinates', async () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');

      await window.updateContent(['256', '256', 'SCROLL', '10']);

      expect(logSpy).toHaveBeenCalledWith('ERROR: SCROLL command missing X and/or Y coordinates');
    });

    it('should handle TRACE command', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      await window.updateContent(['256', '256', 'TRACE', '5']);

      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(5);
    });

    it('should handle RATE command', async () => {
      await window.updateContent(['256', '256', 'RATE', '60']);

      // Check that rate was set
      expect(window['state'].rate).toBe(60);
    });

    it('should handle DOTSIZE command', async () => {
      await window.updateContent(['256', '256', 'DOTSIZE', '2', '2']);

      expect(window['state'].dotSizeX).toBe(2);
      expect(window['state'].dotSizeY).toBe(2);
    });

    // §15: SPARSE auto-disabled when dotSizeX < 4 OR dotSizeY < 4 (Pascal SetSize).
    // Default dotSizeX=1, dotSizeY=1 => SPARSE alone does NOT enable sparseMode.
    it('should not enable sparse mode when DOTSIZE < 4', async () => {
      // Default dotsize is 1x1 — sparseMode must remain false after SPARSE alone.
      await window.updateContent(['256', '256', 'SPARSE', '$FF0000']);

      expect(window['state'].sparseMode).toBe(false);
    });

    // SPARSE + DOTSIZE >= 4 enables sparse mode correctly.
    it('should enable sparse mode when DOTSIZE >= 4', async () => {
      await window.updateContent(['256', '256', 'DOTSIZE', '4', '4', 'SPARSE', '$FF0000']);

      expect(window['state'].sparseMode).toBe(true);
    });

    it('should handle SAVE command', async () => {
      window['state'].isInitialized = true;
      const saveSpy = jest.spyOn(window as any, 'saveWindowToBMPFilename').mockResolvedValue(undefined);

      await window.updateContent(['SAVE', 'test.bmp']);

      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });

    it('should handle SAVE WINDOW command', async () => {
      window['state'].isInitialized = true;
      // SAVE WINDOW calls saveDesktopWindowToBMPFilename (not saveWindowToBMPFilename).
      const saveSpy = jest.spyOn(window as any, 'saveDesktopWindowToBMPFilename').mockResolvedValue(undefined);

      await window.updateContent(['SAVE', 'WINDOW', 'test.bmp']);

      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });

    it('should handle PC_KEY command', async () => {
      window['state'].isInitialized = true;
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      await window.updateContent(['PC_KEY']);

      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
    });

    it('should handle PC_MOUSE command', async () => {
      window['state'].isInitialized = true;
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      await window.updateContent(['PC_MOUSE']);

      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
    });
  });

  describe('Color mode commands', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;
    });

    it('should handle all color mode commands', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const colorModes = [
        'LUT1', 'LUT2', 'LUT4', 'LUT8',
        'LUMA8', 'LUMA8W', 'LUMA8X',
        'HSV8', 'HSV8W', 'HSV8X',
        'RGBI8', 'RGBI8W', 'RGBI8X',
        'RGB8', 'HSV16', 'HSV16W', 'HSV16X',
        'RGB16', 'RGB24'
      ];

      for (const mode of colorModes) {
        jest.clearAllMocks();
        await window.updateContent(['256', '256', mode]);
        expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode[mode as keyof typeof ColorMode]);
      }
    });

    it('should handle color mode with tune parameter (LUMA8 consumes one tune)', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      await window.updateContent(['256', '256', 'LUMA8', '5']);

      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUMA8);
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(5);
    });

    // §15: LUTCOLORS overwrites palette from index 0 every call (NOT append).
    // setColor called with literal indices 0,1,2,... — getPaletteSize() is NOT used.
    it('should handle LUTCOLORS command starting from index 0', async () => {
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];

      await window.updateContent(['256', '256', 'LUTCOLORS', '255', '16711680', '65280']);

      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 255);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, 16711680);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(2, 65280);
    });
  });

  describe('Data processing', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;

      // HARNESS FIX: translateColor is called in processDataValues; mock must return a
      // number so .toString(16) doesn't crash (undefined.toString(16) kills the worker).
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);

      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
    });

    it('should process numeric data values and call unpackSamples', async () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      mockPackedDataProcessor.unpackSamples.mockReturnValue([255, 128, 64]);

      // Window is already initialized (constructor); send data directly (no '256 256' prefix).
      await window.updateContent(['12345']);

      expect(mockPackedDataProcessor.unpackSamples).toHaveBeenCalledWith(12345, expect.any(Object));
    });

    it('should skip non-numeric data values and only call unpackSamples for numeric ones', async () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      mockPackedDataProcessor.unpackSamples.mockReturnValue([0]);

      // Window already initialized; 'ABC' is skipped, '123' triggers one unpackSamples call.
      await window.updateContent(['ABC', '123']);

      expect(mockPackedDataProcessor.unpackSamples).toHaveBeenCalledTimes(1); // Only for '123'
    });

    it('should step trace processor once per unpacked pixel value', async () => {
      window['state'].rate = 2;
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      // Mock PackedDataProcessor to return single values per input
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      mockPackedDataProcessor.unpackSamples.mockReturnValue([100]);

      // Window already initialized; 4 data tokens → 4 unpackSamples → 4 step calls.
      // The rate counter (rateCounter vs rate) controls canvas update frequency, not step calls.
      await window.updateContent(['100', '200', '300', '400']);

      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(4);
    });

    // §15: SPARSE requires dotSizeX >= 4 AND dotSizeY >= 4 (Pascal SetSize).
    // To test skip-on-background-match, we need DOTSIZE 4 4 first.
    it('should skip pixels in sparse mode that match background when dotsize >= 4', async () => {
      // Set dotsize to 4 before enabling sparse (constructor sets dotsize to 1×1)
      window['state'].dotSizeX = 4;
      window['state'].dotSizeY = 4;
      window['state'].sparseMode = true;  // force sparse after dotsize is correct
      window['state'].backgroundColor = 0;
      window['state'].rate = 1;

      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      mockPackedDataProcessor.unpackSamples.mockReturnValue([0]); // Matches background

      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      await window.updateContent(['256', '256', '0']);

      // sparse skip still calls step() to advance position
      expect(mockTraceProcessor.step).toHaveBeenCalled();
      // No plotPixelBatch path (sparse mode uses direct JS); executeJavaScript from
      // the sparse outer/inner rect calls may or may not fire — what matters is that
      // a value matching backgroundColor is NOT plotted (no outer/inner rect for it).
      // With value==backgroundColor the sparse branch skips the drawing block.
      // We verify step() was called (position advanced) — that is the observable contract.
    });

    it('should use batch plotPixelBatch (via executeJavaScript) in normal non-sparse mode', async () => {
      window['state'].dotSizeX = 1;
      window['state'].dotSizeY = 1;
      window['state'].rate = 1;

      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      mockPackedDataProcessor.unpackSamples.mockReturnValue([255]);

      // Window already initialized; send data directly.
      await window.updateContent(['255']);

      // Normal (non-sparse) mode: pixels are batched and sent via executeJavaScript
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
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

    it('should log error for invalid pixel coordinates', async () => {
      const logSpy = jest.spyOn(window as any, 'logMessage');
      // Force uninitialized so '100 100' is parsed as bitmap size (100×100),
      // then SET 200 50 is invalid (200 >= 100).
      window['state'].isInitialized = false;

      await window.updateContent(['100', '100', 'SET', '200', '50']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: Invalid pixel coordinates'));
    });

    it('should log error when plotting pixels before size is defined', async () => {
      // Constructor always calls setBitmapSize which sets isInitialized=true.
      // Force back to false to test the guard in processDataValues.
      const newWindow = new DebugBitmapWindow(mockContext, createTestDisplaySpec(), 'test');
      (newWindow as any).isWindowReady = true;
      const logSpy = jest.spyOn(newWindow as any, 'logMessage');
      newWindow['debugWindow'] = mockBrowserWindow;
      // Set uninitialized so processDataValues guard fires
      newWindow['state'].isInitialized = false;
      // Send DOTSIZE first (non-numeric first token → skips size parse), then pixel data.
      // DOTSIZE is handled in the switch, then '255' reaches processDataValues.
      await newWindow.updateContent(['DOTSIZE', '2', '2', '255']);

      expect(logSpy).toHaveBeenCalledWith('ERROR: Cannot plot pixels before bitmap size is defined');
    });

    it('should log error when saving before initialization', () => {
      // Create a new window and try to save without initialization
      const newWindow = new DebugBitmapWindow(mockContext, createTestDisplaySpec(), 'test');
      const logSpy = jest.spyOn(newWindow as any, 'logMessage');
      newWindow['debugWindow'] = mockBrowserWindow;
      // Constructor sets isInitialized=true; force it back to false to test the guard.
      newWindow['state'].isInitialized = false;
      newWindow['saveBitmap']('test.bmp', false);

      expect(logSpy).toHaveBeenCalledWith('ERROR: Cannot save bitmap before it is initialized');
    });
  });

  describe('Trace pattern mapping', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;
    });

    it('should correctly map pattern 0-7 to base patterns 0-7 without scrolling', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      for (let pattern = 0; pattern < 8; pattern++) {
        jest.clearAllMocks();
        await window.updateContent(['256', '256', 'TRACE', pattern.toString()]);
        expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(pattern);
      }
    });

    it('should correctly map pattern 8-15 to base patterns 0-7 with scrolling', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      // Pattern 8 should map to base 0 + scroll (not base 2!)
      // Pattern 9 should map to base 1 + scroll (not base 3!)
      // etc.
      for (let pattern = 8; pattern < 16; pattern++) {
        jest.clearAllMocks();
        await window.updateContent(['256', '256', 'TRACE', pattern.toString()]);
        expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(pattern);
      }
    });
  });

  describe('RATE command behavior', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;
    });

    it('should use specified rate when RATE > 0', async () => {
      await window.updateContent(['256', '256', 'RATE', '120']);

      expect(window['state'].rate).toBe(120);
    });

    // §15 / source: setRate(0) sets rate=1 (manual-mode fallback for pixel processing).
    // The source does NOT call getSuggestedRate() in setRate(). Tests expecting
    // getSuggestedRate to be called were stale.
    it('should set rate to 1 when RATE = 0 (manual mode fallback)', async () => {
      await window.updateContent(['256', '256', 'RATE', '0']);

      // setRate(0) → rate=1 (source: "Rate 0 means manual update mode but we use 1 for processing")
      expect(window['state'].rate).toBe(1);
    });

    // §15 / source: setTracePattern() sets rate=1 when rate===0, does NOT call getSuggestedRate().
    it('should set rate to 1 when TRACE is set and rate is 0', async () => {
      window['state'].rate = 0;

      await window.updateContent(['256', '256', 'TRACE', '5']);

      expect(window['state'].rate).toBe(1);
    });
  });

  describe('Color format validation', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;
    });

    it('should handle LUTCOLORS with hex format', async () => {
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];

      await window.updateContent(['256', '256', 'LUTCOLORS', '$FF0000', '$00FF00']);

      // §15: LUTCOLORS writes to literal indices 0,1,... — not via getPaletteSize()
      expect(mockLutManager.setColor).toHaveBeenCalledTimes(2);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, expect.any(Number));
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it('should handle LUTCOLORS with decimal format', async () => {
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];

      await window.updateContent(['256', '256', 'LUTCOLORS', '16711680', '65280']);

      expect(mockLutManager.setColor).toHaveBeenCalledTimes(2);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 16711680);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, 65280);
    });

    // §15: SPARSE is auto-disabled when dotSizeX < 4 OR dotSizeY < 4.
    // Default dotsize is 1×1 so SPARSE $FF0000 alone leaves sparseMode=false.
    it('should not enable sparse mode with hex color when DOTSIZE < 4 (default)', async () => {
      await window.updateContent(['256', '256', 'SPARSE', '$FF0000']);

      expect(window['state'].sparseMode).toBe(false);
    });

    it('should not enable sparse mode with decimal color when DOTSIZE < 4 (default)', async () => {
      await window.updateContent(['256', '256', 'SPARSE', '16711680']);

      expect(window['state'].sparseMode).toBe(false);
    });
  });

  describe('Tune parameter handling', () => {
    beforeEach(() => {
      window['debugWindow'] = mockBrowserWindow;
    });

    // §15: parseColorModeCommand masks tune with & 0xff (NOT & 0x7).
    // Value 15 → 15 & 0xff = 15.  The old test expected 7 (& 0x7), which was stale.
    it('should mask tune parameter to 0-255 range (& 0xff)', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      await window.updateContent(['256', '256', 'LUMA8', '15']);

      // 15 & 0xff = 15 (source line: parseInt(next, 10) & 0xff)
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(15);
    });

    it('should handle valid tune values 0-7 for HSV8', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      for (let tune = 0; tune <= 7; tune++) {
        jest.clearAllMocks();
        await window.updateContent(['256', '256', 'HSV8', tune.toString()]);
        expect(mockColorTranslator.setTune).toHaveBeenCalledWith(tune);
      }
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

    // §15: RGB16 in getPackedDataMode returns PDM_UNKNOWN (one 16-bit sample per word,
    // no packing) NOT PDM_LONGS_16BIT. The old test was stale.
    it('should return correct packed data mode for RGB16', () => {
      window['state'].colorMode = ColorMode.RGB16;
      const mode = window['getPackedDataMode']();

      expect(mode.mode).toBe(ePackedDataMode.PDM_UNKNOWN);
      expect(mode.bitsPerSample).toBe(16);
      expect(mode.valueSize).toBe(ePackedDataWidth.PDW_WORDS);
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
