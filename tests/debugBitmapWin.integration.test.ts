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
(PackedDataProcessor.unpackSamples as jest.Mock) = jest.fn();

describe('DebugBitmapWindow Integration Tests', () => {
  let window: DebugBitmapWindow;
  let mockContext: jest.Mocked<Context>;
  let mockBrowserWindow: any;

  // Helper to create test display spec — size 100x100 so the constructor initialises
  // isInitialized=true with those dimensions before any test runs.
  const createTestDisplaySpec = () => ({
    displayName: 'Test Bitmap',
    title: 'Test Bitmap',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 }
  });

  // Helper to clear mock state between setup calls inside a test.
  // The window is already fully initialized (100x100) from the constructor, so there is
  // nothing to do here beyond resetting call counts. [9win §15]
  const initializeWindow = (_width: number = 100, _height: number = 100) => {
    // Clear any mock calls recorded during construction so test assertions start clean.
    jest.clearAllMocks();
  };

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

    // Create window instance with correct signature
    window = new DebugBitmapWindow(mockContext, createTestDisplaySpec(), 'test-id');

    // Use defineProperty to properly set the debugWindow
    Object.defineProperty(window, 'debugWindow', {
      value: mockBrowserWindow,
      writable: true,
      configurable: true
    });

    // Mark the window ready so updateContent() dispatches immediately instead of queueing.
    // Real routing sets this once the window's renderer signals ready; tests drive it directly.
    (window as any).isWindowReady = true;
  });

  describe('ColorTranslator integration with bitmap plotting', () => {
    it('should translate colors and plot pixels correctly', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      // Setup mocks
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000); // Red
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 10, y: 20 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      (PackedDataProcessor.unpackSamples as jest.Mock).mockReturnValue([255]);

      // Set RGB24 mode and rate, then send one pixel datum (255).
      // The constructor already initialized the window (100x100), so we omit size tokens.
      // [9win §15] default color mode is RGB24, but we set it explicitly here for clarity.
      await window.updateContent(['RGB24', 'RATE', '1', '255']);

      // Verify color translation was called with the pixel value
      expect(mockColorTranslator.translateColor).toHaveBeenCalledWith(255);

      // Normal-mode rendering goes through plotPixelBatch → executeJavaScript.
      // CanvasRenderer.plotPixel is NOT used in the bitmap pixel-plot path. [9win §15]
      // Verify the batch JS was sent to the renderer.
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should handle LUT color modes with palette', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockLutManager = (LUTManager as jest.MockedClass<typeof LUTManager>).mock.instances[0];

      // LUTCOLORS now overwrites from index 0 on every call (Pascal KeyLutColors restarts
      // at vLut[0], :2806-2814). It does NOT use getPaletteSize() to find the next slot;
      // it uses an internal counter starting at 0. [9win §15]
      await window.updateContent(['LUTCOLORS', '$FF0000', '$00FF00', '$0000FF', '$FFFFFF']);

      // Verify palette was set starting at index 0 (not via getPaletteSize)
      expect(mockLutManager.setColor).toHaveBeenCalledWith(0, 0xFF0000);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(1, 0x00FF00);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(2, 0x0000FF);
      expect(mockLutManager.setColor).toHaveBeenCalledWith(3, 0xFFFFFF);

      // Set LUT2 mode — LUT modes consume NO tune token [9win §15]
      await window.updateContent(['LUT2']);

      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUT2);
    });

    it('should handle color tuning for LUMA and HSV modes', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      // LUMA8 consumes ONE following token as tune (numeric OR color-name ORANGE..GRAY). [9win §15]
      await window.updateContent(['LUMA8', '3']);

      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.LUMA8);
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(3);

      // HSV16 consumes ONE following NUMERIC token as tune. [9win §15]
      await window.updateContent(['HSV16', '7']);

      expect(mockColorTranslator.setColorMode).toHaveBeenCalledWith(ColorMode.HSV16);
      expect(mockColorTranslator.setTune).toHaveBeenCalledWith(7);
    });
  });

  describe('TracePatternProcessor with actual pixel updates', () => {
    it('should update pixel positions according to trace pattern', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      // Setup mocks — translateColor must return a number so toString(16) does not crash.
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFFFFFF);
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      (PackedDataProcessor.unpackSamples as jest.Mock).mockReturnValue([255]);

      // Mock position sequence — one position per pixel
      (mockTraceProcessor.getPosition as jest.Mock)
        .mockReturnValueOnce({ x: 0, y: 0 })
        .mockReturnValueOnce({ x: 1, y: 0 })
        .mockReturnValueOnce({ x: 2, y: 0 });

      // Set rate and trace pattern, then send 3 pixel values.
      // The unpackSamples mock returns [255] per call, so each token yields 1 pixel.
      await window.updateContent(['RATE', '1', 'TRACE', '0', '255', '128', '64']);

      // Verify trace pattern was set
      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(0);

      // Verify step was called for each pixel (once per unpacked value)
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(3);

      // Normal-mode pixel rendering uses plotPixelBatch → executeJavaScript.
      // The batch is sent in a single JS call after all pixels are collected.
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should handle scroll patterns with canvas scrolling', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];

      // Set pattern with scroll bit (no pixel data follows, so no translateColor needed)
      await window.updateContent(['TRACE', '10']); // Pattern 10 with scroll bit

      // Verify trace pattern was set
      expect(mockTraceProcessor.setPattern).toHaveBeenCalledWith(10);

      // Verify scroll callback was registered (done during construction)
      expect(mockTraceProcessor.setScrollCallback).toHaveBeenCalled();
    });
  });

  describe('InputForwarder with mocked serial communication', () => {
    it('should forward keyboard events to serial', async () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      // Enable keyboard input — PC_KEY is handled by the base-class common-command handler
      await window.updateContent(['PC_KEY']);

      expect(mockInputForwarder.startPolling).toHaveBeenCalled();

      // Verify keyboard event handler was set up
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('keydown')
      );
    });

    it('should forward mouse events with coordinate transformation', async () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      // Set DOTSIZE for scaling — no size prefix needed, window already 100x100
      await window.updateContent(['DOTSIZE', '2', '3']);

      expect(mockInputForwarder.setDotSize).toHaveBeenCalledWith(2, 3);

      // Enable mouse input
      await window.updateContent(['PC_MOUSE']);

      expect(mockInputForwarder.startPolling).toHaveBeenCalled();

      // Verify mouse event handlers were set up
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('mousemove')
      );
    });

    it('should set window dimensions for input coordinate validation', async () => {
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      // The size-init path in processMessageImmediate only fires when isInitialized=false.
      // Reset the flag so that sending ['320', '240'] is interpreted as a size command,
      // which calls setBitmapSize(320, 240) → inputForwarder.setWindowDimensions(320, 240).
      (window as any).state.isInitialized = false;
      await window.updateContent(['320', '240']);

      expect(mockInputForwarder.setWindowDimensions).toHaveBeenCalledWith(320, 240);
    });
  });

  describe('Rate cycling with display updates', () => {
    it('should handle rate cycling correctly', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      // Setup initial mocks
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);

      // Window is already initialized (100x100) — clear construction-phase mock calls
      initializeWindow(100, 100);

      // Set rate to 3 (display refresh every 3rd pixel, NOT skip-plot)
      await window.updateContent(['RATE', '3']);

      // Setup mocks for pixel plotting
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFFFFFF);
      // unpackSamples returns exactly 1 value per call
      (PackedDataProcessor.unpackSamples as jest.Mock).mockReturnValue([100]);

      // Send 6 individual pixels (all awaited so async processing completes)
      for (let i = 0; i < 6; i++) {
        await window.updateContent([String(100 + i)]);
      }

      // `rate` controls DISPLAY REFRESH cadence, NOT pixel-skip. Every pixel is plotted
      // (getPosition + step called once per pixel). [9win §15]
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(6);
    });

    it('should use width as rate when rate is 0', async () => {
      // After construction with a 100x100 displaySpec, setBitmapSize() expands rate=0
      // to width (for horizontal trace pattern 0): rate = 100. [9win §15]
      // getSuggestedRate() from TracePatternProcessor is NOT used in setBitmapSize.
      expect(window['state'].rate).toBe(100);
    });
  });

  describe('Sparse mode rendering', () => {
    it('should skip pixels matching background in sparse mode', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      // Setup initial mocks
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);

      // Window already initialized — clear construction-phase mock calls
      initializeWindow(100, 100);

      // Sparse rendering requires dotSizeX >= 4 AND dotSizeY >= 4 (Pascal SetSize, :2938).
      // With default dotSize=1, enforceSparseDotSizeConstraint() disables sparse immediately.
      // We must set dotsize>=4 BEFORE SPARSE so sparse stays enabled. [9win §15]
      await window.updateContent(['RATE', '1', 'DOTSIZE', '4', '4', 'SPARSE', '0']);

      // Setup mocks for pixel plotting
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);

      // Mock unpacker to return the exact values we're sending
      (PackedDataProcessor.unpackSamples as jest.Mock)
        .mockReturnValueOnce([255])  // Non-background
        .mockReturnValueOnce([0])    // Matches background (black = 0x000000, value 0)
        .mockReturnValueOnce([128])  // Non-background
        .mockReturnValueOnce([0]);   // Matches background

      // Send pixels individually (all awaited)
      await window.updateContent(['255']); // Non-background
      await window.updateContent(['0']);   // Matches background → skipped
      await window.updateContent(['128']); // Non-background
      await window.updateContent(['0']);   // Matches background → skipped

      // Sparse mode: background pixels are SKIPPED (no translateColor / no plot for them).
      // Only the 2 non-background pixels have their color translated and plotted.
      // (The sparse check is `value === this.state.backgroundColor` before translateColor.)
      expect(mockColorTranslator.translateColor).toHaveBeenCalledTimes(2); // Only 255 and 128

      // But trace should step for all 4 pixels (background and non-background alike)
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(4);
    });

    it('should plot all pixels in normal mode', async () => {
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      // Setup initial mocks
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);

      // Window already initialized — clear construction-phase mock calls
      initializeWindow(100, 100);

      // Set rate to 1 (display refresh every pixel)
      await window.updateContent(['RATE', '1']);

      // Setup mocks for pixel plotting
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFFFFFF);

      // Mock unpacker to return different values
      (PackedDataProcessor.unpackSamples as jest.Mock)
        .mockReturnValueOnce([255])
        .mockReturnValueOnce([0])
        .mockReturnValueOnce([128])
        .mockReturnValueOnce([0]);

      // Send pixels individually (all awaited)
      await window.updateContent(['255']);
      await window.updateContent(['0']);
      await window.updateContent(['128']);
      await window.updateContent(['0']);

      // In normal (non-sparse) mode all pixels are translated and plotted
      expect(mockColorTranslator.translateColor).toHaveBeenCalledTimes(4);
      // step is called once per pixel regardless of mode
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(4);
    });
  });

  describe('PackedDataProcessor integration', () => {
    it('should unpack data correctly for different color modes', async () => {
      const mockPackedDataProcessor = PackedDataProcessor as jest.Mocked<typeof PackedDataProcessor>;
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];

      // Setup initial mocks
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });

      // Window already initialized — clear construction-phase mock calls
      initializeWindow(100, 100);

      // Test LUT1 mode (1-bit packing) — LUT modes consume NO tune token [9win §15]
      await window.updateContent(['RATE', '1', 'LUT1']);

      // Setup mocks for pixel plotting
      mockPackedDataProcessor.unpackSamples.mockReturnValue([1, 0, 1, 1, 0, 1, 0, 1]); // 8 bits from 181
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFFFFFF);
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });

      await window.updateContent(['181']); // decimal 181 = 0b10110101

      expect(mockPackedDataProcessor.unpackSamples).toHaveBeenCalledWith(
        181,
        expect.objectContaining({
          mode: ePackedDataMode.PDM_LONGS_1BIT,
          bitsPerSample: 1
        })
      );

      // Clear and test RGB16 mode (16-bit packing).
      // RGB16 maps to PDM_UNKNOWN with bitsPerSample=16 (not PDM_LONGS_16BIT). [9win §15]
      // Use a hex literal ($F80007E0) so Spin2NumericParser.parseHex handles it and returns
      // 0xF80007E0 = 4177887232 without decimal-clamping to INT32_MAX. [9win §15]
      jest.clearAllMocks();
      // RGB16 consumes NO tune token [9win §15]
      await window.updateContent(['RGB16']);

      // Setup mocks for next test
      mockPackedDataProcessor.unpackSamples.mockReturnValue([0xF800, 0x07E0]); // 2 16-bit values
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });

      await window.updateContent(['$F80007E0']); // hex for 0xF80007E0 = 4177887232

      expect(mockPackedDataProcessor.unpackSamples).toHaveBeenLastCalledWith(
        0xF80007E0, // = 4177887232, correctly parsed from hex by Spin2NumericParser
        expect.objectContaining({
          mode: ePackedDataMode.PDM_UNKNOWN, // RGB16 uses PDM_UNKNOWN with 16-bit samples [9win §15]
          bitsPerSample: 16
        })
      );
    });
  });

  describe('Complete workflow integration', () => {
    it('should handle a complete bitmap drawing workflow', async () => {
      const mockColorTranslator = (ColorTranslator as jest.MockedClass<typeof ColorTranslator>).mock.instances[0];
      const mockTraceProcessor = (TracePatternProcessor as jest.MockedClass<typeof TracePatternProcessor>).mock.instances[0];
      const mockInputForwarder = (InputForwarder as jest.MockedClass<typeof InputForwarder>).mock.instances[0];

      // Setup mocks
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000); // Return valid color
      (mockTraceProcessor.getPosition as jest.Mock).mockReturnValue({ x: 0, y: 0 });
      (mockTraceProcessor.getSuggestedRate as jest.Mock).mockReturnValue(1);
      (PackedDataProcessor.unpackSamples as jest.Mock).mockReturnValue([255]);

      // 1. Clear bitmap (constructor already initialized the 100x100 window)
      await window.updateContent(['CLEAR']);

      // 2. Set color mode — RGB8 consumes NO tune token [9win §15]
      await window.updateContent(['RGB8']);

      // 3. Set trace pattern (Down pattern = 4)
      await window.updateContent(['TRACE', '4']);

      // 4. Set dot size
      await window.updateContent(['DOTSIZE', '10', '10']);

      // 5. Set rate to 1 to ensure display updates every pixel
      await window.updateContent(['RATE', '1']);

      // Clear mocks before plotting pixels
      jest.clearAllMocks();

      // Re-setup mocks for pixel plotting
      (mockColorTranslator.translateColor as jest.Mock).mockReturnValue(0xFF0000);
      (mockTraceProcessor.getPosition as jest.Mock)
        .mockReturnValueOnce({ x: 0, y: 0 })
        .mockReturnValueOnce({ x: 0, y: 1 })
        .mockReturnValueOnce({ x: 1, y: 0 })
        .mockReturnValueOnce({ x: 1, y: 1 });
      (PackedDataProcessor.unpackSamples as jest.Mock)
        .mockReturnValueOnce([255])
        .mockReturnValueOnce([128])
        .mockReturnValueOnce([64])
        .mockReturnValueOnce([32]);

      // 6. Plot 4 pixels individually (all awaited)
      await window.updateContent(['255']);
      await window.updateContent(['128']);
      await window.updateContent(['64']);
      await window.updateContent(['32']);

      // In normal (non-sparse) mode, rendering goes through plotPixelBatch →
      // executeJavaScript. CanvasRenderer.plotScaledPixel is NOT used. [9win §15]
      // Verify 4 pixels were processed (translateColor called for each).
      expect(mockColorTranslator.translateColor).toHaveBeenCalledTimes(4);
      // step called once per pixel
      expect(mockTraceProcessor.step).toHaveBeenCalledTimes(4);
      // executeJavaScript called for batch plotting
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();

      // 7. Save bitmap
      window['saveWindowToBMPFilename'] = jest.fn();
      await window.updateContent(['SAVE', 'output.bmp']);

      expect(window['saveWindowToBMPFilename']).toHaveBeenCalledWith('output.bmp');
    });
  });
});
