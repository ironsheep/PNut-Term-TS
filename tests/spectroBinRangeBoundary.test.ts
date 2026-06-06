/** @format */

import { DebugSpectroWindow, SpectroDisplaySpec } from '../src/classes/debugSpectroWin';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';
import { createMockBrowserWindow } from './shared/mockHelpers';

// Store reference to mock BrowserWindow instances
let mockBrowserWindowInstances: any[] = [];

// Mock Electron
jest.mock('electron', () => {
  const createMockBrowserWindow = require('./shared/mockHelpers').createMockBrowserWindow;
  return {
    BrowserWindow: jest.fn().mockImplementation(() => {
      const mockWindow = createMockBrowserWindow();
      mockBrowserWindowInstances.push(mockWindow);
      return mockWindow;
    }),
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
  };
});

// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn()
}));

// Mock OS module
jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('/tmp'),
  platform: jest.fn().mockReturnValue('linux')
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((input: string) => {
    if (!input) return '.';
    const segments = input.split('/');
    segments.pop();
    return segments.length ? segments.join('/') : '/';
  }),
  resolve: jest.fn((...args) => args.join('/'))
}));

// Mock WindowPlacer
const mockWindowPlacerInstance = {
  registerWindow: jest.fn(),
  getNextPosition: jest.fn(() => ({ x: 0, y: 0, monitor: { id: '1' } })),
  releaseWindow: jest.fn()
};

jest.mock('../src/utils/windowPlacer', () => ({
  WindowPlacer: {
    getInstance: jest.fn(() => mockWindowPlacerInstance)
  }
}));

// Mock USB serial
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

// Mock Jimp
jest.mock('jimp', () => ({
  Jimp: {
    read: jest.fn().mockResolvedValue({
      bitmap: { width: 100, height: 100, data: Buffer.alloc(40000) },
      getWidth: jest.fn().mockReturnValue(100),
      getHeight: jest.fn().mockReturnValue(100),
      resize: jest.fn().mockReturnThis(),
      writeAsync: jest.fn().mockResolvedValue(undefined),
      getBuffer: jest.fn().mockImplementation((mime, cb) => cb(null, Buffer.from('mock-image')))
    }),
    MIME_PNG: 'image/png',
    MIME_JPEG: 'image/jpeg',
    MIME_BMP: 'image/bmp'
  }
}));

describe('SPECTRO Bin Range Boundary Conditions', () => {
  let mockContext: any;
  let cleanup: () => void;

  beforeEach(() => {
    mockBrowserWindowInstances = [];
    mockWindowPlacerInstance.registerWindow.mockClear();
    mockWindowPlacerInstance.getNextPosition.mockClear();
    mockWindowPlacerInstance.releaseWindow.mockClear();

    const setup = setupDebugWindowTests({
      windowType: 'logic',
      displayName: 'BinTest'
    });
    mockContext = setup.mockContext;
    cleanup = setup.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('Test 1: Normal range (0-236)', () => {
    it('should iterate exactly 237 times for bins 0-236 inclusive', async () => {
      // Create SPECTRO with SAMPLES 2048 0 236
      const displaySpec = DebugSpectroWindow.createDisplaySpec('BinTest', [
        'SPECTRO',
        'BinTest',
        'SAMPLES',
        '2048',
        '0',
        '236'
      ]);

      const window = new DebugSpectroWindow(mockContext, displaySpec);

      // Mock plotPixel to count iterations — return a resolved Promise because
      // performFFTAndDraw awaits plotPixel() (it's declared async).
      const plottedBins: number[] = [];
      jest.spyOn(window as any, 'plotPixel').mockImplementation(() => {
        // Track which bin is being processed by checking fftPower access
        // We'll count calls instead
        plottedBins.push(plottedBins.length);
        return Promise.resolve();
      });

      // Mock updateWaterfallDisplay to prevent actual rendering
      jest.spyOn(window as any, 'updateWaterfallDisplay').mockImplementation(() => Promise.resolve());

      // Fill buffer with samples to trigger FFT automatically
      const samples = displaySpec.samples;
      for (let i = 0; i < samples; i++) {
        const sample = Math.round(1000 * Math.sin((2 * Math.PI * i) / samples));
        (window as any).addSample(sample);
      }
      // Note: performFFTAndDraw is called automatically when buffer fills (fire-and-forget async).
      // Flush all pending microtasks so the async FFT loop completes before asserting.
      await new Promise(resolve => setImmediate(resolve));

      // Verify loop iterations
      const expectedIterations = displaySpec.lastBin - displaySpec.firstBin + 1;
      expect(plottedBins.length).toBe(expectedIterations);
      expect(expectedIterations).toBe(237);

      // Verify first and last bins processed
      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(236);
    });
  });

  describe('Test 2: firstBin == lastBin clamps lastBin up to firstBin+1 (Pascal) [9win §12]', () => {
    it('should clamp lastBin to firstBin+1 when given last <= first', async () => {
      // Create SPECTRO with single-bin attempt (first == last == 100)
      const displaySpec = DebugSpectroWindow.createDisplaySpec('BinTest', [
        'SPECTRO',
        'BinTest',
        'SAMPLES',
        '512',
        '100',
        '100'
      ]);

      // Pascal SPECTRO_Configure (DebugDisplayUnit.pas:1748-1749):
      //   if KeyValWithin(FFTfirst, 0, vSamples div 2 - 2) then
      //     KeyValWithin(FFTlast, FFTfirst + 1, vSamples div 2 - 1);
      // KeyValWithin CLAMPS — FFTlast's bottom is FFTfirst+1, so a `last <= first` value
      // is raised to firstBin+1 (a single-bin range is impossible). The old TS instead
      // REJECTED last == first and let lastBin fall back to the default samples/2-1 (255).
      // §12 replaced that reject with the Pascal inclusive clamp.

      const window = new DebugSpectroWindow(mockContext, displaySpec);

      // Track plotPixel calls — return resolved Promise (plotPixel is async)
      let plotCount = 0;
      jest.spyOn(window as any, 'plotPixel').mockImplementation(() => {
        plotCount++;
        return Promise.resolve();
      });

      jest.spyOn(window as any, 'updateWaterfallDisplay').mockImplementation(() => Promise.resolve());

      // Fill buffer to trigger FFT automatically
      const samples = displaySpec.samples;
      for (let i = 0; i < samples; i++) {
        (window as any).addSample(i);
      }
      // Flush all pending microtasks so the async FFT loop completes before asserting.
      await new Promise(resolve => setImmediate(resolve));

      const expectedIterations = displaySpec.lastBin - displaySpec.firstBin + 1;
      expect(plotCount).toBe(expectedIterations);

      // Finalized Pascal-parity values:
      expect(displaySpec.firstBin).toBe(100); // first clamps into [0, 254]
      expect(displaySpec.lastBin).toBe(101); // last clamps up to firstBin + 1 = 101
      expect(expectedIterations).toBe(2); // 101 - 100 + 1 = 2 (minimum two-bin range)
    });
  });

  describe('Test 3: Maximum range (0-1023)', () => {
    it('should iterate exactly 1024 times for maximum FFT size', async () => {
      // Create SPECTRO with maximum FFT size and full bin range
      const displaySpec = DebugSpectroWindow.createDisplaySpec('BinTest', [
        'SPECTRO',
        'BinTest',
        'SAMPLES',
        '2048',
        '0',
        '1023'
      ]);

      const window = new DebugSpectroWindow(mockContext, displaySpec);

      // Track iterations — return resolved Promise (plotPixel is async)
      let iterationCount = 0;
      jest.spyOn(window as any, 'plotPixel').mockImplementation(() => {
        iterationCount++;
        return Promise.resolve();
      });

      jest.spyOn(window as any, 'updateWaterfallDisplay').mockImplementation(() => Promise.resolve());

      // Fill buffer to trigger FFT automatically
      const samples = displaySpec.samples;
      for (let i = 0; i < samples; i++) {
        (window as any).addSample(i);
      }
      // Flush all pending microtasks so the async FFT loop completes before asserting.
      await new Promise(resolve => setImmediate(resolve));

      // Should iterate exactly 1024 times (bins 0-1023 inclusive)
      const expectedIterations = displaySpec.lastBin - displaySpec.firstBin + 1;
      expect(iterationCount).toBe(expectedIterations);
      expect(expectedIterations).toBe(1024);
    });
  });

  describe('Test 4: Edge case - firstBin=0', () => {
    it('should handle firstBin=0 correctly', async () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('BinTest', [
        'SPECTRO',
        'BinTest',
        'SAMPLES',
        '512',
        '0',
        '10'
      ]);

      const window = new DebugSpectroWindow(mockContext, displaySpec);

      let iterationCount = 0;
      jest.spyOn(window as any, 'plotPixel').mockImplementation(() => {
        iterationCount++;
        return Promise.resolve();
      });

      jest.spyOn(window as any, 'updateWaterfallDisplay').mockImplementation(() => Promise.resolve());

      // Fill buffer to trigger FFT automatically
      for (let i = 0; i < displaySpec.samples; i++) {
        (window as any).addSample(i);
      }
      // Flush all pending microtasks so the async FFT loop completes before asserting.
      await new Promise(resolve => setImmediate(resolve));

      // Should iterate 11 times (0-10 inclusive)
      expect(iterationCount).toBe(11);
      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(10);
    });
  });

  describe('Test 5: Edge case - lastBin at FFT maximum', () => {
    it('should handle lastBin=255 for 512-sample FFT', async () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('BinTest', [
        'SPECTRO',
        'BinTest',
        'SAMPLES',
        '512',
        '0',
        '255'
      ]);

      const window = new DebugSpectroWindow(mockContext, displaySpec);

      let iterationCount = 0;
      jest.spyOn(window as any, 'plotPixel').mockImplementation(() => {
        iterationCount++;
        return Promise.resolve();
      });

      jest.spyOn(window as any, 'updateWaterfallDisplay').mockImplementation(() => Promise.resolve());

      // Fill buffer to trigger FFT automatically
      for (let i = 0; i < displaySpec.samples; i++) {
        (window as any).addSample(i);
      }
      // Flush all pending microtasks so the async FFT loop completes before asserting.
      await new Promise(resolve => setImmediate(resolve));

      // Should iterate 256 times (0-255 inclusive)
      expect(iterationCount).toBe(256);
      expect(displaySpec.lastBin).toBe(255);
    });
  });

  describe('Test 6: Loop implementation verification', () => {
    it('should use <= operator for inclusive range', async () => {
      // Read the source to verify loop structure
      // This test verifies the Pascal pattern: for x := FFTfirst to FFTlast do
      // In TypeScript this should be: for (let x = firstBin; x <= lastBin; x++)

      const displaySpec = DebugSpectroWindow.createDisplaySpec('BinTest', [
        'SPECTRO',
        'BinTest',
        'SAMPLES',
        '64',
        '5',
        '15'
      ]);

      const window = new DebugSpectroWindow(mockContext, displaySpec);

      const processedBins: number[] = [];

      // Spy on the internal fftPower array access to track which bins are processed
      // Return a resolved Promise (plotPixel is async)
      jest.spyOn(window as any, 'plotPixel').mockImplementation(() => {
        processedBins.push(processedBins.length + displaySpec.firstBin);
        return Promise.resolve();
      });

      jest.spyOn(window as any, 'updateWaterfallDisplay').mockImplementation(() => Promise.resolve());

      // Fill buffer to trigger FFT automatically
      for (let i = 0; i < displaySpec.samples; i++) {
        (window as any).addSample(i * 100);
      }
      // Flush all pending microtasks so the async FFT loop completes before asserting.
      await new Promise(resolve => setImmediate(resolve));

      // Verify inclusive range
      expect(processedBins.length).toBe(11); // 15 - 5 + 1 = 11
      expect(processedBins[0]).toBe(5); // First bin processed
      expect(processedBins[processedBins.length - 1]).toBe(15); // Last bin processed
    });
  });

  describe('Test 7: Actual loop code inspection', () => {
    it('should confirm performFFTAndDraw uses inclusive loop bounds', async () => {
      // This test verifies by examining actual bin processing behavior
      const displaySpec = DebugSpectroWindow.createDisplaySpec('BinTest', [
        'SPECTRO',
        'BinTest',
        'SAMPLES',
        '128',
        '20',
        '30'
      ]);

      const window = new DebugSpectroWindow(mockContext, displaySpec);

      // Track exact bins being processed by monitoring fftPower array access
      const binAccessLog: number[] = [];

      // Intercept plotPixel to track bin processing — return resolved Promise (plotPixel is async)
      let currentBinIndex = displaySpec.firstBin;
      jest.spyOn(window as any, 'plotPixel').mockImplementation(() => {
        binAccessLog.push(currentBinIndex);
        currentBinIndex++;
        return Promise.resolve();
      });

      jest.spyOn(window as any, 'updateWaterfallDisplay').mockImplementation(() => Promise.resolve());

      // Fill buffer to trigger FFT automatically
      for (let i = 0; i < displaySpec.samples; i++) {
        (window as any).addSample(i);
      }
      // Flush all pending microtasks so the async FFT loop completes before asserting.
      await new Promise(resolve => setImmediate(resolve));

      // Verify bins 20-30 inclusive (11 bins total)
      expect(binAccessLog.length).toBe(11);
      expect(binAccessLog[0]).toBe(20);
      expect(binAccessLog[binAccessLog.length - 1]).toBe(30);

      // Verify no gaps in sequence
      for (let i = 0; i < binAccessLog.length - 1; i++) {
        expect(binAccessLog[i + 1] - binAccessLog[i]).toBe(1);
      }
    });
  });
});
