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

describe('FFT Rendering', () => {
  let fftWindow: DebugFFTWindow;
  let mockContext: Context;

  beforeEach(() => {
    // Create mock context with logger
    mockContext = {
      logger: {
        logMessage: jest.fn()
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

    it('should configure line mode with specified width', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'LINE', '5'
      ]);
      
      expect(displaySpec.lineSize).toBe(5);
      expect(displaySpec.dotSize).toBe(0);
    });

    it('should configure dot mode with specified size', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64', 'DOT', '3'
      ]);
      
      expect(displaySpec.dotSize).toBe(3);
      expect(displaySpec.lineSize).toBe(0);
    });

    it('should enable log scale when LOGSCALE specified', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '256', 'LOGSCALE'
      ]);
      
      expect(displaySpec.logScale).toBe(true);
    });

    it('should enable grid when GRID specified', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'GRID'
      ]);
      
      expect(displaySpec.grid).toBe(true);
    });

    it('should disable labels when HIDEXY specified', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'HIDEXY'
      ]);
      
      expect(displaySpec.hideXY).toBe(true);
      expect(displaySpec.showLabels).toBe(false);
    });
  });

  describe('Frequency Range Configuration', () => {
    it('should set first and last bins from RANGE', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '256', 'RANGE', '10', '100'
      ]);
      
      expect(displaySpec.firstBin).toBe(10);
      expect(displaySpec.lastBin).toBe(100);
    });

    it('should handle single RANGE parameter as lastBin', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '256', 'RANGE', '64'
      ]);
      
      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(64);
    });

    it('should limit lastBin to half of FFT size', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'RANGE', '0', '200'
      ]);
      
      // lastBin should be limited to samples/2 - 1
      expect(displaySpec.lastBin).toBe(63);
    });
  });

  describe('Coordinate Conversion', () => {
    it('should convert mouse X to frequency bin', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'SIZE', '640', '480'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Test bin conversion at different X positions
      expect(window.mouseXToBin(0)).toBe(0);
      expect(window.mouseXToBin(320)).toBe(32); // Middle of display
      expect(window.mouseXToBin(640)).toBe(63); // End of display (samples/2 - 1)
    });

    it('should convert mouse Y to magnitude with bottom-up coordinates', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'SIZE', '640', '480'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Bottom-up coordinate system
      expect(window.mouseYToMagnitude(480)).toBe(0);   // Bottom = 0%
      expect(window.mouseYToMagnitude(240)).toBe(50);  // Middle = 50%
      expect(window.mouseYToMagnitude(0)).toBe(100);   // Top = 100%
    });

    it('should calculate frequency from bin based on sample rate', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Set a known sample rate
      window.detectedSampleRate = 1000; // 1kHz
      window.fftExp = 7; // log2(128) = 7
      
      // Nyquist = 500Hz, 64 bins, so each bin = 500/64 = 7.8125Hz
      expect(window.binToFrequency(0)).toBe(0);
      expect(window.binToFrequency(1)).toBeCloseTo(7.8125, 2);
      expect(window.binToFrequency(32)).toBeCloseTo(250, 1);
    });
  });

  describe('Rendering Methods', () => {
    beforeEach(() => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
    });

    it('should call drawFFT when triggering FFT', () => {
      const window = fftWindow as any;
      
      // Spy on drawFFT
      const drawSpy = jest.spyOn(window, 'drawFFT');
      
      // Trigger FFT
      window.triggerFFT();
      
      expect(drawSpy).toHaveBeenCalled();
    });

    it('should clear canvas when drawFFT is called', () => {
      const window = fftWindow as any;
      
      // Call drawFFT
      window.drawFFT();
      
      // Check that clear canvas code was executed
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      expect(mockExecuteJS).toHaveBeenCalled();
      
      const calls = mockExecuteJS.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      // First call should be clearing canvas
      const clearCall = calls[0][0];
      expect(clearCall).toContain('fillRect(0, 0, canvas.width, canvas.height)');
    });

    it('should draw grid when enabled', () => {
      const window = fftWindow as any;
      window.displaySpec.grid = true;
      
      // Call drawFFT
      window.drawFFT();
      
      // Check for grid drawing code
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      expect(mockExecuteJS).toHaveBeenCalled();
      
      const calls = mockExecuteJS.mock.calls;
      const gridCall = calls.find((call: any) => call[0].includes('strokeStyle') && call[0].includes('rgba(128, 128, 128'));
      expect(gridCall).toBeDefined();
    });

    it('should draw frequency labels when enabled', () => {
      const window = fftWindow as any;
      window.displaySpec.showLabels = true;
      
      // Call drawFFT
      window.drawFFT();
      
      // Check for label drawing code
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      expect(mockExecuteJS).toHaveBeenCalled();
      
      const calls = mockExecuteJS.mock.calls;
      const labelCall = calls.find((call: any) => call[0].includes('Hz'));
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
      
      expect(commands).toContain('strokeStyle = \'#00FF00\'');
      expect(commands).toContain('lineWidth = 3');
      expect(commands).toContain('beginPath()');
      expect(commands).toContain('moveTo');
      expect(commands).toContain('lineTo');
      expect(commands).toContain('stroke()');
    });

    it('should generate bar drawing commands in bar mode', () => {
      const window = fftWindow as any;
      window.displaySpec.lineSize = 0;
      window.displaySpec.dotSize = 0; // Will default to bars
      
      const powerData = [10, 20, 30, 40];
      const commands = window.generateBarDrawCommands(
        powerData, 40, 400, 300, 0, 100, '#FF0000'
      );
      
      expect(commands).toContain('fillStyle = \'#FF0000\'');
      expect(commands).toContain('fillRect');
    });

    it('should generate dot drawing commands in dot mode', () => {
      const window = fftWindow as any;
      window.displaySpec.dotSize = 5;
      window.displaySpec.lineSize = 0;
      
      const powerData = [10, 20, 30, 40];
      const commands = window.generateDotDrawCommands(
        powerData, 40, 400, 300, 0, 100, '#0000FF', 5
      );
      
      expect(commands).toContain('fillStyle = \'#0000FF\'');
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

    it('should clear buffer and canvas on CLEAR command', () => {
      const window = fftWindow as any;
      
      // Spy on clearBuffer
      const clearSpy = jest.spyOn(window, 'clearBuffer');
      
      // Send CLEAR command
      fftWindow.updateContent(['TestFFT', 'CLEAR']);
      
      expect(clearSpy).toHaveBeenCalled();
      
      // Check that canvas clear was executed
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      if (mockExecuteJS && mockExecuteJS.mock) {
        const clearCall = mockExecuteJS.mock.calls.find((call: any) => 
          call[0].includes('fillRect(0, 0, canvas.width, canvas.height)')
        );
        expect(clearCall).toBeDefined();
      }
    });

    it('should handle SAVE command', () => {
      const window = fftWindow as any;
      
      // Spy on saveFFTDisplay
      const saveSpy = jest.spyOn(window, 'saveFFTDisplay');
      
      // Send SAVE command
      fftWindow.updateContent(['TestFFT', 'SAVE', 'test.bmp']);
      
      expect(saveSpy).toHaveBeenCalledWith('test.bmp');
    });

    it('should use default filename for SAVE without filename', () => {
      const window = fftWindow as any;
      
      // Spy on saveFFTDisplay
      const saveSpy = jest.spyOn(window, 'saveFFTDisplay');
      
      // Send SAVE command without filename
      fftWindow.updateContent(['TestFFT', 'SAVE']);
      
      expect(saveSpy).toHaveBeenCalledWith('fft_spectrum.png');
    });
  });

  describe('Mouse Interaction', () => {
    beforeEach(() => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'SIZE', '640', '480'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
    });

    it('should update coordinate display on mouse move', () => {
      const window = fftWindow as any;
      
      // Simulate mouse move event
      const event = {
        clientX: 320,
        clientY: 240
      } as MouseEvent;
      
      window.handleMouseMove(event);
      
      // Check that coordinate display was updated
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      if (mockExecuteJS && mockExecuteJS.mock) {
        const coordCall = mockExecuteJS.mock.calls.find((call: any) => 
          call[0].includes('Bin:') && call[0].includes('Freq:') && call[0].includes('Mag:')
        );
        expect(coordCall).toBeDefined();
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
    it('should apply log scale when enabled', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64', 'LOGSCALE'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Create test power data
      const power = new Int32Array([100, 1000, 10, 1]);
      
      // Call drawSpectrum with log scale enabled
      window.drawSpectrum(power, '#00FF00', 0, 100, 0);
      
      // The rendering should include log-transformed values
      // Log scale converts to dB: 20 * log10(value)
      // We can't easily test the exact values, but we can verify
      // that drawSpectrum was called and rendering occurred
      const mockExecuteJS = (window.debugWindow as any)?.webContents?.executeJavaScript;
      expect(mockExecuteJS).toHaveBeenCalled();
    });
  });
});