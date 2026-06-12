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

  beforeEach(async () => {
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

    // Create window instance with correct signature
    window = new DebugBitmapWindow(mockContext, createTestDisplaySpec(), 'test-id');
    window['debugWindow'] = mockBrowserWindow;

    // [§15 HARNESS FIX] isWindowReady must be true or updateContent() queues messages
    // instead of processing them — mocks get 0 calls and all assertions fail.
    // The window is already initialized (isInitialized=true) by the constructor's
    // setBitmapSize() call, so no explicit size message is needed here.
    (window as any).isWindowReady = true;
  });

  describe('CLEAR command with different color modes', () => {
    // §15 CLEAR FIX: clearBitmap() uses getBackground(), NOT state.backgroundColor.
    // For RGB24 mode (the new default), getBackground() always returns 0x000000 (black).
    // Setting state.backgroundColor has no effect on what color CLEAR fills.
    it('should clear with RGB24 mode (default) — clears to black via getBackground()', async () => {
      // §15: Default color mode is RGB24. getBackground() for RGB24 → black (0x000000).
      // state.backgroundColor is irrelevant to the clear fill color.
      window['state'].backgroundColor = 0xFF0000; // Set to red (has no effect on clear)
      jest.clearAllMocks(); // Clear the init executeJavaScript calls
      await window.updateContent(['CLEAR']);

      // CLEAR uses getBackground() which returns black for RGB24 — not backgroundColor
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('rgb(0, 0, 0)')
      );
    });

    it('should clear with black background', async () => {
      window['state'].backgroundColor = 0x000000; // Black
      jest.clearAllMocks();
      await window.updateContent(['CLEAR']);

      // getBackground() for RGB24 → black — matches backgroundColor coincidentally
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('rgb(0, 0, 0)')
      );
    });

    it('should clear to white when W-mode is active', async () => {
      // §15: W-modes (LUMA8W/HSV8W/RGBI8W/HSV16W) clear to white via getBackground().
      await window.updateContent(['LUMA8W']);
      jest.clearAllMocks();
      await window.updateContent(['CLEAR']);

      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('rgb(255, 255, 255)')
      );
    });

    it('should clear after changing color mode', async () => {
      await window.updateContent(['RGB8', 'CLEAR']);

      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });
  });

  describe('SET command with boundary conditions', () => {
    it('should set position at origin', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      await window.updateContent(['SET', '0', '0']);

      expect(mockTraceProcessor.setPosition).toHaveBeenCalledWith(0, 0);
    });

    it('should set position at max bounds', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      await window.updateContent(['SET', '255', '255']);

      expect(mockTraceProcessor.setPosition).toHaveBeenCalledWith(255, 255);
    });

    it('should clamp negative coordinates to 0 (Pascal KeyValWithin, never reject)', async () => {
      // Pascal key_set CLAMPS via KeyValWithin(vPixelX, 0, vWidth-1); the old code
      // rejected out-of-range coords (invented non-Pascal behavior). [9win §15]
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      await window.updateContent(['SET', '-1', '0']);

      expect(mockTraceProcessor.setPosition).toHaveBeenCalledWith(0, 0);
    });

    it('should clamp out-of-bounds coordinates to the bitmap edge (Pascal KeyValWithin)', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      await window.updateContent(['SET', '256', '256']); // 256x256 bitmap -> max 255,255

      expect(mockTraceProcessor.setPosition).toHaveBeenCalledWith(255, 255);
    });

    it('should ignore non-integer coordinates (Spin2NumericParser is integer-strict)', async () => {
      // Debug coordinate values are always integers on the wire; a non-integer token
      // is not a valid coordinate and is left unapplied (no truncation). [9win §15]
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const logSpy = jest.spyOn(window as any, 'logMessage');

      await window.updateContent(['SET', '10.5', '20.7']);

      expect(mockTraceProcessor.setPosition).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR: SET command requires two numeric coordinates'));
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
    ])('should set trace pattern %i (%s)', async (pattern, description) => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      await window.updateContent(['TRACE', pattern.toString()]);

      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(pattern);
    });

    it.each([8, 9, 10, 11, 12, 13, 14, 15])('should handle scroll bit for pattern %i', async (pattern) => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      await window.updateContent(['TRACE', pattern.toString()]);

      // Pattern is passed with scroll bit intact
      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(pattern);
    });

    it('should set rate to 1 (real-time default) when trace pattern changes and rate is 0', async () => {
      // §15: setTracePattern() sets rate=1 (real-time default) when state.rate===0.
      // It does NOT call getSuggestedRate(). The old expectation of 100 was stale.
      window['state'].rate = 0; // Force rate to 0
      await window.updateContent(['TRACE', '4']);

      expect(window['state'].rate).toBe(1);
    });
  });

  describe('SCROLL command with positive/negative offsets', () => {
    // NOTE: scrollBitmap() in DebugBitmapWindow builds its own inline JavaScript (does NOT
    // call CanvasRenderer.scrollBitmap). The CanvasRenderer mock is not involved here.
    // We verify that executeJavaScript is called with code containing the expected offset.
    it('should scroll with positive X and Y', async () => {
      await window.updateContent(['SCROLL', '10', '20']);

      // Source builds inline JS with the scroll offsets embedded in the code string
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('(10)')
      );
    });

    it('should scroll with negative X and Y', async () => {
      await window.updateContent(['SCROLL', '-15', '-25']);

      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('(-15)')
      );
    });

    it('should scroll with mixed positive/negative', async () => {
      await window.updateContent(['SCROLL', '50', '-30']);

      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('(50)')
      );
    });

    it('should clamp scroll values to bitmap size', async () => {
      // Try to scroll beyond bitmap size (1000 clamps to 256, -1000 clamps to -256)
      await window.updateContent(['SCROLL', '1000', '-1000']);

      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });
  });

  describe('Color mode switching and LUTCOLORS loading', () => {
    it('should switch between color modes', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      await window.updateContent(['RGB24']);
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.RGB24);

      await window.updateContent(['LUT8']);
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUT8);

      await window.updateContent(['HSV16']);
      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.HSV16);
    });

    it('should handle color mode with tune parameter — LUMA8 consumes one following token', async () => {
      // §15: Only LUMA8/LUMA8W/LUMA8X and HSV groups consume a tune token.
      // LUMA8 '3' → setColorMode(LUMA8) + setTune(3). Confirmed unchanged behavior.
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      await window.updateContent(['LUMA8', '3']);

      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUMA8);
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(3);
    });

    it('should load LUT colors from index 0 (not via getPaletteSize)', async () => {
      // §15 LUTCOLORS FIX: LUTCOLORS always overwrites from index 0 using literal indices
      // 0,1,2,... — it does NOT call getPaletteSize() to determine the next index.
      // Old test mocked getPaletteSize() to feed indices — that was stale.
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];

      await window.updateContent(['LUTCOLORS', '$FF0000', '$00FF00', '$0000FF', '$FFFFFF']);

      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 0xFF0000);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, 0x00FF00);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(2, 0x0000FF);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(3, 0xFFFFFF);
    });

    it('should stop LUTCOLORS at first non-color token', async () => {
      // §15 LUTCOLORS: stops at the first token that is neither a color name nor a
      // valid numeric. 'INVALID' is not a recognized color name or number, so only
      // the first entry (255) is loaded; INVALID causes the loop to break.
      // The remaining '128' token falls through to processDataValues (treated as pixel
      // data). Mock translateColor and traceProcessor.getPosition to prevent crashes.
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });

      await window.updateContent(['LUTCOLORS', '255', 'INVALID', '128']);

      // Only the first entry (255) is loaded; INVALID stops LUT processing
      expect(mockLutManager.setColor).toHaveBeenCalledTimes(1);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 255);
    });
  });

  describe('PC_KEY/PC_MOUSE formatting', () => {
    it('should enable keyboard input with PC_KEY', async () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      await window.updateContent(['PC_KEY']);

      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('keydown')
      );
    });

    it('should enable mouse input with PC_MOUSE', async () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      await window.updateContent(['PC_MOUSE']);

      expect(mockInputForwarder.startPolling).toHaveBeenCalled();
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('mousemove')
      );
    });

    it('should not process data after PC_KEY', async () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;

      await window.updateContent(['PC_KEY', '123', '456']);

      // PC_KEY should stop data processing
      expect(mockPackedDataProcessor.unpackSamples).not.toHaveBeenCalled();
    });

    it('should not process data after PC_MOUSE', async () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;

      await window.updateContent(['PC_MOUSE', '789', '012']);

      // PC_MOUSE should stop data processing
      expect(mockPackedDataProcessor.unpackSamples).not.toHaveBeenCalled();
    });
  });

  describe('SAVE command with various filenames', () => {
    beforeEach(() => {
      // Mock both save methods used by the base class SAVE handler
      window['saveWindowToBMPFilename'] = jest.fn().mockResolvedValue(undefined);
      window['saveDesktopWindowToBMPFilename'] = jest.fn().mockResolvedValue(undefined);
    });

    it('should save with simple filename', async () => {
      await window.updateContent(['SAVE', 'output.bmp']);

      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('output.bmp');
    });

    it('should save with path in filename', async () => {
      await window.updateContent(['SAVE', '/path/to/output.bmp']);

      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('/path/to/output.bmp');
    });

    it('should save WINDOW parameter calls saveDesktopWindowToBMPFilename', async () => {
      // SAVE WINDOW 'filename' routes to saveDesktopWindowToBMPFilename (not saveWindowToBMPFilename)
      await window.updateContent(['SAVE', 'WINDOW', 'fullwindow.bmp']);

      expect(window['saveDesktopWindowToBMPFilename']).toHaveBeenCalledWith('fullwindow.bmp');
    });

    it('should log missing filename when WINDOW is last parameter (no default)', async () => {
      // SAVE WINDOW with no following filename → base class logs "SAVE command missing filename"
      // and returns false. No save method is called.
      const logSpy = jest.spyOn(window as any, 'logMessageBase');

      await window.updateContent(['SAVE', 'WINDOW']);

      expect(window['saveWindowToBMPFilename']).not.toHaveBeenCalled();
      expect(window['saveDesktopWindowToBMPFilename']).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SAVE command missing filename'));
    });

    it('should handle filenames with spaces', async () => {
      await window.updateContent(['SAVE', 'my bitmap.bmp']);

      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('my bitmap.bmp');
    });

    it('should handle filenames without extension', async () => {
      await window.updateContent(['SAVE', 'mybitmap']);

      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('mybitmap');
    });
  });

  describe('RATE command behavior', () => {
    it('should set explicit rate', async () => {
      await window.updateContent(['RATE', '30']);

      expect(window['state'].rate).toBe(30);
    });

    it('should use rate=1 when RATE 0 is sent (manual/real-time mode)', async () => {
      // §15 RATE FIX: setRate(0) sets state.rate=1 (manual/real-time mode), NOT
      // getSuggestedRate(). The old test mocked getSuggestedRate to return 256 and
      // expected 256 — that was coincidental (constructor sets rate=width=256 for
      // trace 0) and the test was asserting stale behavior.
      await window.updateContent(['RATE', '0']);

      expect(window['state'].rate).toBe(1);
    });

    it('should reset rate counter when rate changes', async () => {
      window['state'].rateCounter = 10;

      await window.updateContent(['RATE', '60']);

      expect(window['state'].rateCounter).toBe(0);
    });
  });

  describe('DOTSIZE command behavior', () => {
    it('should set symmetric dot size', async () => {
      await window.updateContent(['DOTSIZE', '2', '2']);

      expect(window['state'].dotSizeX).toBe(2);
      expect(window['state'].dotSizeY).toBe(2);
    });

    it('should set asymmetric dot size', async () => {
      await window.updateContent(['DOTSIZE', '3', '5']);

      expect(window['state'].dotSizeX).toBe(3);
      expect(window['state'].dotSizeY).toBe(5);
    });

    it('should update input forwarder dot size', async () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      await window.updateContent(['DOTSIZE', '4', '4']);

      expect(mockInputForwarder.setDotSize).toHaveBeenCalledWith(4, 4);
    });

    it('should clamp dot size to minimum 1', async () => {
      await window.updateContent(['DOTSIZE', '0', '-5']);

      expect(window['state'].dotSizeX).toBe(1);
      expect(window['state'].dotSizeY).toBe(1);
    });
  });

  describe('SPARSE mode behavior', () => {
    // §15 SPARSE FIX: sparseMode is auto-disabled when dotSizeX<4 OR dotSizeY<4 (Pascal
    // SetSize). Default dotSize is 1x1, so setSparseMode() sets sparseMode=true but
    // enforceSparseDotSizeConstraint() immediately sets it back to false.
    // Tests that check sparseMode=true must first set dotSize >= 4.
    it('should enable sparse mode with color when dotSize >= 4', async () => {
      // Set dotSize to 4 first so enforceSparseDotSizeConstraint() won't disable sparse
      await window.updateContent(['DOTSIZE', '4', '4']);
      await window.updateContent(['SPARSE', '$FF0000']);

      expect(window['state'].sparseMode).toBe(true);
      expect(window['state'].backgroundColor).toBe(0xFF0000);
    });

    it('should NOT enable sparse mode when dotSize < 4 (default dotSize=1)', async () => {
      // §15: default dotSize is 1x1 → sparse is auto-disabled
      await window.updateContent(['SPARSE', '$FF0000']);

      expect(window['state'].sparseMode).toBe(false);
    });

    it('should parse decimal color values for SPARSE background', async () => {
      // §15: SPARSE sets backgroundColor regardless of whether sparseMode stays active.
      // With dotSize=4, sparse stays enabled.
      await window.updateContent(['DOTSIZE', '4', '4']);
      await window.updateContent(['SPARSE', '16777215']); // White

      expect(window['state'].backgroundColor).toBe(16777215);
    });

    it('should parse binary color values for SPARSE background', async () => {
      await window.updateContent(['DOTSIZE', '4', '4']);
      await window.updateContent(['SPARSE', '%11111111']); // 255

      expect(window['state'].backgroundColor).toBe(255);
    });
  });
});
