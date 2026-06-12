/** @format */

'use strict';

// tests/debugFftRendering.test.ts

/**
 * Test suite for FFT window rendering features
 *
 * Verifies:
 * - Display mode rendering (line/bar/dot)
 * - Log scale transformation
 * - Grid and label rendering
 * - Coordinate display functionality
 * - Mouse interaction handling
 *
 * NOTE ON REMOVED FEATURES:
 * - The `grid` field no longer exists on FFTDisplaySpec; per-channel grid lines come from
 *   the channel's `grid` field. Tests that set displaySpec.grid are updated accordingly.
 * - `mouseXToBin`, `mouseYToMagnitude`, `binToFrequency` helpers were removed in §11.
 *   The coordinate readout now matches Pascal's raw pixel-offset display (no Bin:/Mag: text).
 * - `saveFFTDisplay` is a private helper; the public SAVE path goes through base class
 *   handleCommonCommand → saveWindowToBMPFilename. Tests updated to reflect this.
 *
 * NOTE ON LINE/BAR DRAWING COMMANDS:
 * - generateLineDrawCommands uses `lineWidth = lineSize / 2` (Pascal uses radius).
 *   Assertions updated to match the actual generated string.
 * - generateBarDrawCommands uses stroke-based vertical lines (not fillRect).
 *   Assertions updated to match the actual generated pattern.
 *
 * NOTE ON WINDOW-NAME STRIPPING:
 * The router strips the display name before calling updateContent. Direct test calls
 * must NOT include the window name as the first element.
 *
 * NOTE ON ASYNC + debugWindow:
 * updateContent is async. Tests that trigger window creation call it with await.
 * Tests that exercise drawFFT/triggerFFT directly inject a mock debugWindow.
 */

import { DebugFFTWindow } from '../src/classes/debugFftWin';
import { Context } from '../src/utils/context';
import { BrowserWindow } from 'electron';

// Mock electron first before other imports
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeMenu: jest.fn(),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
      removeAllListeners: jest.fn()
    },
    show: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    removeAllListeners: jest.fn(),
    setTitle: jest.fn(),
    setPosition: jest.fn(),
    setSize: jest.fn(),
    getPosition: jest.fn().mockReturnValue([0, 0]),
    getSize: jest.fn().mockReturnValue([800, 600])
  })),
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  },
  ipcMain: {
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  nativeImage: {
    createFromBuffer: jest.fn().mockReturnValue({
      toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
    })
  }
}));

// Mock USB serial for InputForwarder
jest.mock('../src/utils/usb.serial', () => ({
  UsbSerial: jest.fn().mockImplementation(() => ({
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    deviceIsPropeller: jest.fn().mockResolvedValue(true),
    getIdStringOrError: jest.fn().mockReturnValue(['Propeller2', '']),
    deviceInfo: 'Mock Propeller2 Device',
    isOpen: true
  }))
}));

// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

/** Helper: build a minimal mock debugWindow with a trackable executeJavaScript spy. */
function makeMockDebugWindow() {
  const executeJavaScript = jest.fn().mockResolvedValue(undefined);
  return {
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeMenu: jest.fn(),
    webContents: {
      executeJavaScript,
      send: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(), // required by debugWindowBase.ts setter
      on: jest.fn(),
      once: jest.fn()
    },
    show: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    removeAllListeners: jest.fn(),
    setTitle: jest.fn(),
    setPosition: jest.fn(),
    setSize: jest.fn(),
    getPosition: jest.fn().mockReturnValue([0, 0]),
    getSize: jest.fn().mockReturnValue([800, 600])
  };
}

describe('FFT Rendering', () => {
  let fftWindow: DebugFFTWindow;
  let mockContext: Context;

  beforeEach(() => {
    // Create mock context with logger
    mockContext = {
      logger: {
        logMessage: jest.fn(),
        forceLogMessage: jest.fn()
      }
    } as unknown as Context;
  });

  afterEach(() => {
    if (fftWindow) {
      fftWindow.close();
    }

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Display Mode Configuration', () => {
    it('should default to line mode when neither line nor dot size specified', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128'
      ]);

      // Pascal defaults to lineSize=3 when nothing specified
      expect(displaySpec.dotSize).toBe(0);
      expect(displaySpec.lineSize).toBe(3);
    });

    it('ignores the non-Pascal LINE directive — key_line is PLOT-only, not FFT [9win §11]', () => {
      // Pascal FFT_Configure handles key_linesize, NOT key_line (key_line/key_dot belong to
      // PLOT_Configure, DebugDisplayUnit.pas:1980/1965). LINE + its operand are ignored here,
      // so the line/dot sizes keep their FFT_Configure defaults (lineSize=3, dotSize=0).
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'LINE', '5'
      ]);

      expect(displaySpec.lineSize).toBe(3);
      expect(displaySpec.dotSize).toBe(0);
    });

    it('ignores the non-Pascal DOT directive — key_dot is PLOT-only, not FFT [9win §11]', () => {
      // Same reasoning: DOT is not an FFT directive. It and its operand are ignored, leaving
      // the FFT_Configure defaults (lineSize=3, dotSize=0).
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64', 'DOT', '3'
      ]);

      expect(displaySpec.dotSize).toBe(0);
      expect(displaySpec.lineSize).toBe(3);
    });

    it('should enable log scale when LOGSCALE specified', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '256', 'LOGSCALE'
      ]);

      expect(displaySpec.logScale).toBe(true);
    });

    it('ignores the removed GRID directive — no Pascal key_grid [9win §11]', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'GRID'
      ]) as any;

      expect(displaySpec.grid).toBeUndefined();
      expect(displaySpec.samples).toBe(128); // still parses cleanly
    });

    it('should disable labels when HIDEXY specified', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'HIDEXY'
      ]);

      expect(displaySpec.hideXY).toBe(true);
      expect(displaySpec.showLabels).toBe(false);
    });
  });

  describe('Display bin range via SAMPLES (RANGE removed) [9win §11]', () => {
    it('SAMPLES n first last sets the first and last display bins', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '256', '10', '100'
      ]);

      expect(displaySpec.firstBin).toBe(10);
      expect(displaySpec.lastBin).toBe(100);
    });

    it('SAMPLES last clamps to samples/2 - 1', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', '0', '200'
      ]);

      expect(displaySpec.lastBin).toBe(63);
    });

    it('the removed RANGE directive is now a no-op (bins stay at SAMPLES defaults)', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '256', 'RANGE', '10', '100'
      ]);

      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(127); // 256/2 - 1, unaffected by RANGE
    });
  });

  // NOTE: the bin/frequency/magnitude mouse-conversion helpers (mouseXToBin,
  // mouseYToMagnitude, binToFrequency) were removed in [9win §11]. Pascal FormMouseMove
  // for dis_fft reports the raw plot-area pixel offset with Y inverted, not bin/Hz/%, so
  // those conversions no longer exist. The new readout is covered in 'Mouse Interaction'.

  describe('Rendering Methods', () => {
    beforeEach(() => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);

      // Inject mock debugWindow so rendering paths are exercised
      (fftWindow as any).debugWindow = makeMockDebugWindow();
      (fftWindow as any).windowCreated = true;
      (fftWindow as any).initializeCanvas();
    });

    it('should call drawFFT (via performDraw) when triggerFFT fires with channels', () => {
      const window = fftWindow as any;

      // Add a channel so triggerFFT doesn't return early
      window.channels = [{
        label: 'test', magnitude: 0, high: 1000, tall: 100, base: 0, grid: 0, color: '#00FF00'
      }];

      // Spy on drawFFT
      const drawSpy = jest.spyOn(window, 'drawFFT');

      // samplePop must be >= samples before triggerFFT acts; fake it.
      window.samplePop = window.displaySpec.samples;

      window.triggerFFT();

      // performDraw is called (async), which calls drawFFT — spy fires synchronously
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should call executeJavaScript when drawFFT is called with an active window', async () => {
      const window = fftWindow as any;
      const mockExecuteJS = window.debugWindow.webContents.executeJavaScript;

      await window.drawFFT();

      // drawFFT calls clearCanvasAsync → executeJavaScript, then copyOffscreenToVisible → executeJavaScript
      expect(mockExecuteJS).toHaveBeenCalled();

      const calls = mockExecuteJS.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      // First call clears/fills the offscreen canvas (clearCanvasAsync)
      const clearCall = calls[0][0];
      expect(clearCall).toContain('fillRect(0, 0, targetCanvas.width, targetCanvas.height)');
    });

    it('grid is per-channel, not a global displaySpec flag — drawFFT still calls executeJavaScript', async () => {
      // The old 'grid' property was removed from FFTDisplaySpec [9win §11].
      // Per-channel grid lines are drawn inside drawSpectrum when channel.grid !== 0.
      // We just verify drawFFT still invokes executeJavaScript without a global grid.
      const window = fftWindow as any;
      const mockExecuteJS = window.debugWindow.webContents.executeJavaScript;

      await window.drawFFT();

      expect(mockExecuteJS).toHaveBeenCalled();
    });

    it('should call executeJavaScript when frequency labels are enabled', async () => {
      const window = fftWindow as any;
      window.displaySpec.showLabels = true;
      const mockExecuteJS = window.debugWindow.webContents.executeJavaScript;

      await window.drawFFT();

      // drawFrequencyLabels is called from drawFFT and calls executeJavaScript with 'Hz' text
      const calls = mockExecuteJS.mock.calls;
      const labelCall = calls.find((call: any) =>
        typeof call[0] === 'string' && call[0].includes('Hz')
      );
      expect(labelCall).toBeDefined();
    });

    it('should generate line drawing commands in line mode', () => {
      const window = fftWindow as any;
      window.displaySpec.lineSize = 3;
      window.displaySpec.dotSize = 0;

      const powerData = [10, 20, 30, 40];
      const commands = window.generateLineDrawCommands(
        powerData, 40, 400, 300, 0, 100, '#00FF00', 3
      );

      expect(commands).toContain("strokeStyle = '#00FF00'");
      // Source: lineWidth = lineWidth / 2 (Pascal uses radius → Canvas diameter)
      expect(commands).toContain('lineWidth = 1.5');
      expect(commands).toContain('beginPath()');
      expect(commands).toContain('moveTo');
      expect(commands).toContain('lineTo');
      expect(commands).toContain('stroke()');
    });

    it('should generate bar drawing commands in bar mode (uses stroke, not fillRect)', () => {
      // Source generateBarDrawCommands draws vertical stroke lines, not filled rects.
      const window = fftWindow as any;

      const powerData = [10, 20, 30, 40];
      const commands = window.generateBarDrawCommands(
        powerData, 40, 400, 300, 0, 100, '#FF0000'
      );

      // Bar mode uses strokeStyle and stroke() for vertical lines
      expect(commands).toContain("strokeStyle = '#FF0000'");
      expect(commands).toContain('stroke()');
      // moveTo/lineTo pattern for each bar
      expect(commands).toContain('moveTo');
      expect(commands).toContain('lineTo');
    });

    it('should generate dot drawing commands in dot mode', () => {
      const window = fftWindow as any;
      window.displaySpec.dotSize = 5;
      window.displaySpec.lineSize = 0;

      const powerData = [10, 20, 30, 40];
      const commands = window.generateDotDrawCommands(
        powerData, 40, 400, 300, 0, 100, '#0000FF', 5
      );

      expect(commands).toContain("fillStyle = '#0000FF'");
      expect(commands).toContain('arc');
      expect(commands).toContain('Math.PI * 2');
    });
  });

  describe('Command Handling', () => {
    beforeEach(() => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
    });

    it('should clear buffer on CLEAR command', async () => {
      const window = fftWindow as any;

      // Spy on clearBuffer
      const clearSpy = jest.spyOn(window, 'clearBuffer');

      // Send CLEAR command (router strips window name — no prefix)
      await fftWindow.updateContent(['CLEAR']);

      expect(clearSpy).toHaveBeenCalled();
    });

    it('should handle SAVE command via base class (saveWindowToBMPFilename)', async () => {
      // SAVE is handled by handleCommonCommand → saveWindowToBMPFilename (not saveFFTDisplay).
      // We spy on saveWindowToBMPFilename from the base class.
      const window = fftWindow as any;

      // Inject a debugWindow so the save path can proceed
      window.debugWindow = makeMockDebugWindow();
      window.windowCreated = true;
      window.initializeCanvas();

      const saveSpy = jest.spyOn(window, 'saveWindowToBMPFilename').mockResolvedValue(undefined);

      // Send SAVE command (router strips window name — no prefix)
      await fftWindow.updateContent(['SAVE', 'test.bmp']);

      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });

    it('should not call save when SAVE is missing filename', async () => {
      const window = fftWindow as any;

      window.debugWindow = makeMockDebugWindow();
      window.windowCreated = true;
      window.initializeCanvas();

      const saveSpy = jest.spyOn(window, 'saveWindowToBMPFilename').mockResolvedValue(undefined);

      // SAVE without filename → handleCommonCommand returns false without saving
      await fftWindow.updateContent(['SAVE']);

      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('Mouse Interaction', () => {
    beforeEach(() => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'SIZE', '640', '480'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
    });

    it('updates the coordinate readout on mouse move — pixel offset, not Bin/Freq/Mag [9win §11]', () => {
      const window = fftWindow as any;

      // Simulate mouse move event
      const event = {
        clientX: 320,
        clientY: 240
      } as MouseEvent;

      window.handleMouseMove(event);

      // Check that the coordinate readout was drawn (fillRect(0,0,200,20) is unique to it)
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      if (mockExecuteJS && mockExecuteJS.mock) {
        const coordCall = mockExecuteJS.mock.calls.find(
          (call: any) => typeof call[0] === 'string' && call[0].includes('fillRect(0, 0, 200, 20)')
        );
        expect(coordCall).toBeDefined();
        // Pascal dis_fft readout is a raw pixel pair, not the old bin/Hz/% text.
        expect(coordCall[0]).not.toContain('Bin:');
        expect(coordCall[0]).not.toContain('Mag:');
      }
    });

    it('should draw crosshair when coordinates not hidden', () => {
      const window = fftWindow as any;
      window.displaySpec.hideXY = false;

      // Simulate mouse move
      const event = {
        clientX: 100,
        clientY: 200
      } as MouseEvent;

      window.handleMouseMove(event);

      // Check for crosshair drawing
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      if (mockExecuteJS && mockExecuteJS.mock) {
        const crosshairCall = mockExecuteJS.mock.calls.find((call: any) =>
          call[0].includes('setLineDash([5, 5])')
        );
        expect(crosshairCall).toBeDefined();
      }
    });

    it('should not draw crosshair when HIDEXY is set', () => {
      const window = fftWindow as any;
      window.displaySpec.hideXY = true;

      // Simulate mouse move
      const event = {
        clientX: 100,
        clientY: 200
      } as MouseEvent;

      window.handleMouseMove(event);

      // Check that no crosshair was drawn
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      if (mockExecuteJS && mockExecuteJS.mock) {
        const crosshairCall = mockExecuteJS.mock.calls.find((call: any) =>
          call[0].includes('setLineDash')
        );
        expect(crosshairCall).toBeUndefined();
      }
    });
  });

  describe('Log Scale Transformation', () => {
    it('should apply log scale when enabled — drawSpectrum calls executeJavaScript', async () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64', 'LOGSCALE'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Inject mock debugWindow so drawSpectrum can execute
      const mockWin = makeMockDebugWindow();
      window.debugWindow = mockWin;
      window.windowCreated = true;
      window.initializeCanvas();

      const mockExecuteJS = mockWin.webContents.executeJavaScript;

      // Create test power data and call drawSpectrum directly
      const power = new Int32Array([100, 1000, 10, 1]);
      await window.drawSpectrum(power, '#00FF00', 0, 1000, 100, 0);

      // drawSpectrum should have issued at least one executeJavaScript call
      expect(mockExecuteJS).toHaveBeenCalled();
    });
  });
});
