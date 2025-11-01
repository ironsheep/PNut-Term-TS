/** @format */

'use strict';

import { DebugSpectroWindow, SpectroDisplaySpec } from '../src/classes/debugSpectroWin';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';
import { ColorMode } from '../src/classes/shared/colorTranslator';

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

/**
 * Generate sine wave samples for testing
 * @param frequency Frequency bin (0 to fftSize/2 - 1)
 * @param amplitude Amplitude of sine wave
 * @param numSamples Number of samples to generate
 * @returns Array of samples
 */
function generateSineWave(frequency: number, amplitude: number, numSamples: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(amplitude * Math.sin((2 * Math.PI * frequency * i) / numSamples));
    samples.push(sample);
  }
  return samples;
}

describe('SPECTRO End-to-End Rendering Test', () => {
  let debugSpectroWindow: DebugSpectroWindow;
  let mockContext: any;
  let cleanup: () => void;

  beforeEach(() => {
    // Clear mock instances
    mockBrowserWindowInstances = [];

    // Setup test environment
    const setup = setupDebugWindowTests({
      windowType: 'logic',
      displayName: 'SpectroTest'
    });
    mockContext = setup.mockContext;
    cleanup = setup.cleanup;

    // Reset window placer mocks
    mockWindowPlacerInstance.registerWindow.mockClear();
    mockWindowPlacerInstance.getNextPosition.mockClear();
    mockWindowPlacerInstance.releaseWindow.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Simple Sine Wave Test - Single Frequency', () => {
    it('should correctly identify peak at bin 10 for 10Hz sine wave', () => {
      // Create SPECTRO window with configuration matching task requirements
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '2048',
        '0', '236',
        'RANGE', '1000'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Mock rendering methods
      const updateSpy = jest.spyOn(debugSpectroWindow as any, 'updateWaterfallDisplay').mockImplementation(() => {});
      const scrollSpy = jest.spyOn(debugSpectroWindow as any, 'scrollWaterfall').mockImplementation(() => {});

      // Capture plotted pixels
      const plottedPixels: Array<{bin: number, colorValue: number}> = [];
      const plotSpy = jest.spyOn(debugSpectroWindow as any, 'plotPixel').mockImplementation((...args: unknown[]) => {
        const colorValue = args[0] as number;
        const currentPos = (debugSpectroWindow as any).traceProcessor.getPosition();
        plottedPixels.push({
          bin: currentPos.y,  // For vertical trace patterns, Y is the bin
          colorValue
        });
      });

      // Generate test data: 10Hz sine wave
      const targetBin = 10;
      const amplitude = 1000;
      const numSamples = 4096; // Enough for 2 FFTs
      const samples = generateSineWave(targetBin, amplitude, numSamples);

      // Feed samples to window
      samples.forEach(sample => {
        (debugSpectroWindow as any).addSample(sample);
      });

      // Analyze FFT results
      const fftPowerArray = Array.from(debugSpectroWindow['fftPower'] as Int32Array);
      const binRange = displaySpec.lastBin - displaySpec.firstBin + 1;
      const binValues = fftPowerArray.slice(displaySpec.firstBin, displaySpec.lastBin + 1);

      // Find peak bin
      let maxPower = 0;
      let peakBin = -1;
      for (let i = 0; i < binValues.length; i++) {
        if (binValues[i] > maxPower) {
          maxPower = binValues[i];
          peakBin = displaySpec.firstBin + i;
        }
      }

      // Calculate intensity distributions
      const bins0_5 = binValues.slice(0, 6);
      const bins6_9 = binValues.slice(6, 10);
      const bin10 = binValues[10];
      const bins11_15 = binValues.slice(11, 16);
      const bins16_236 = binValues.slice(16, binRange);

      const avg0_5 = bins0_5.reduce((sum, v) => sum + v, 0) / bins0_5.length;
      const avg6_9 = bins6_9.reduce((sum, v) => sum + v, 0) / bins6_9.length;
      const avg11_15 = bins11_15.reduce((sum, v) => sum + v, 0) / bins11_15.length;
      const avg16_236 = bins16_236.reduce((sum, v) => sum + v, 0) / bins16_236.length;

      // Generate report
      console.log('\n========================================');
      console.log('## End-to-End SPECTRO Test');
      console.log('========================================\n');

      console.log('**Input**:');
      console.log(`- Sine wave at bin ${targetBin}`);
      console.log(`- ${numSamples} samples`);
      console.log(`- Expected result: Column with peak at row corresponding to bin ${targetBin}\n`);

      console.log('**Actual result**:');
      console.log(`- Peak found at bin: ${peakBin}`);
      console.log(`- Expected peak at bin: ${targetBin}`);
      console.log(`- Match: ${peakBin === targetBin ? 'YES' : 'NO'}\n`);

      console.log('**Intensity distribution**:');
      console.log(`- Bins 0-5: ${avg0_5.toFixed(2)} (avg intensity)`);
      console.log(`- Bins 6-9: ${avg6_9.toFixed(2)} (avg intensity)`);
      console.log(`- Bin 10: ${bin10} (peak intensity)`);
      console.log(`- Bins 11-15: ${avg11_15.toFixed(2)} (avg intensity)`);
      console.log(`- Bins 16-236: ${avg16_236.toFixed(2)} (avg intensity)\n`);

      // Analyze visual pattern
      let pattern = 'unknown';
      if (peakBin === targetBin) {
        const peakRatio = maxPower / Math.max(avg16_236, 1);
        if (peakRatio > 10) {
          pattern = 'smooth peak (clean signal)';
        } else if (peakRatio > 3) {
          pattern = 'moderate peak (some noise)';
        } else {
          pattern = 'weak peak (noisy)';
        }

        // Check for mirroring (symmetry around Nyquist)
        const nyquist = 1024; // fftSize / 2
        const mirrorBin = nyquist - targetBin;
        if (mirrorBin >= 0 && mirrorBin < binValues.length) {
          const mirrorPower = binValues[mirrorBin];
          if (mirrorPower > maxPower * 0.5) {
            pattern += ' (with mirroring)';
          }
        }
      } else {
        pattern = 'scrambled or shifted';
      }

      console.log('**Visual pattern**:');
      console.log(`- Description: ${pattern}\n`);

      // Determine test result
      const testPassed = peakBin === targetBin && maxPower > avg16_236 * 5;
      console.log('**Test result**: ' + (testPassed ? 'PASS' : 'FAIL'));
      console.log('========================================\n');

      // Assertions
      expect(peakBin).toBe(targetBin);
      expect(maxPower).toBeGreaterThan(avg16_236 * 5); // Peak should be at least 5x background
      expect(bin10).toBeGreaterThan(avg0_5 * 10); // Bin 10 should be much higher than low bins
      expect(bin10).toBeGreaterThan(avg11_15 * 5); // Bin 10 should be higher than neighbors

      // Clean up spies
      updateSpy.mockRestore();
      scrollSpy.mockRestore();
      plotSpy.mockRestore();
    });

    it('should show minimal intensity in non-target bins', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '2048',
        '0', '236',
        'RANGE', '1000'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Mock rendering
      jest.spyOn(debugSpectroWindow as any, 'updateWaterfallDisplay').mockImplementation(() => {});
      jest.spyOn(debugSpectroWindow as any, 'scrollWaterfall').mockImplementation(() => {});
      jest.spyOn(debugSpectroWindow as any, 'plotPixel').mockImplementation(() => {});

      // Generate sine wave at bin 10
      const targetBin = 10;
      const amplitude = 1000;
      const samples = generateSineWave(targetBin, amplitude, 2048);

      // Feed samples
      samples.forEach(sample => {
        (debugSpectroWindow as any).addSample(sample);
      });

      // Analyze distribution
      const fftPowerArray = Array.from(debugSpectroWindow['fftPower'] as Int32Array);
      const binValues = fftPowerArray.slice(displaySpec.firstBin, displaySpec.lastBin + 1);

      const peakPower = binValues[targetBin];

      // Count bins with significant energy (> 10% of peak)
      const significantThreshold = peakPower * 0.1;
      const significantBins = binValues.filter(v => v > significantThreshold).length;

      // Most bins should be near zero
      expect(significantBins).toBeLessThan(10); // Should have < 10 significant bins out of 237

      // Bins far from target should be very low
      const farBins = binValues.filter((_, i) => Math.abs(i - targetBin) > 20);
      const avgFarBins = farBins.reduce((sum, v) => sum + v, 0) / farBins.length;
      expect(avgFarBins).toBeLessThan(peakPower * 0.05); // < 5% of peak
    });

    it('should handle multiple FFTs consistently', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '2048',
        '0', '236',
        'RANGE', '1000',
        'RATE', '2048' // One FFT per full buffer
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Mock rendering
      jest.spyOn(debugSpectroWindow as any, 'updateWaterfallDisplay').mockImplementation(() => {});
      jest.spyOn(debugSpectroWindow as any, 'scrollWaterfall').mockImplementation(() => {});
      jest.spyOn(debugSpectroWindow as any, 'plotPixel').mockImplementation(() => {});

      const targetBin = 10;
      const amplitude = 1000;

      // Run 3 FFT cycles
      const peakBins: number[] = [];
      for (let cycle = 0; cycle < 3; cycle++) {
        const samples = generateSineWave(targetBin, amplitude, 2048);
        samples.forEach(sample => {
          (debugSpectroWindow as any).addSample(sample);
        });

        const fftPowerArray = Array.from(debugSpectroWindow['fftPower'] as Int32Array);
        const binValues = fftPowerArray.slice(displaySpec.firstBin, displaySpec.lastBin + 1);

        let maxPower = 0;
        let peakBin = -1;
        for (let i = 0; i < binValues.length; i++) {
          if (binValues[i] > maxPower) {
            maxPower = binValues[i];
            peakBin = i;
          }
        }
        peakBins.push(peakBin);
      }

      // All cycles should produce same peak bin
      expect(peakBins).toEqual([targetBin, targetBin, targetBin]);
    });
  });

  describe('Multiple Frequency Test', () => {
    it('should identify two distinct peaks for dual-frequency input', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '2048',
        '0', '236',
        'RANGE', '1000'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Mock rendering
      jest.spyOn(debugSpectroWindow as any, 'updateWaterfallDisplay').mockImplementation(() => {});
      jest.spyOn(debugSpectroWindow as any, 'scrollWaterfall').mockImplementation(() => {});
      jest.spyOn(debugSpectroWindow as any, 'plotPixel').mockImplementation(() => {});

      // Generate dual-frequency signal
      const freq1 = 10;
      const freq2 = 50;
      const amplitude = 500; // Half amplitude each
      const numSamples = 2048;

      const samples: number[] = [];
      for (let i = 0; i < numSamples; i++) {
        const sample1 = amplitude * Math.sin((2 * Math.PI * freq1 * i) / numSamples);
        const sample2 = amplitude * Math.sin((2 * Math.PI * freq2 * i) / numSamples);
        samples.push(Math.round(sample1 + sample2));
      }

      // Feed samples
      samples.forEach(sample => {
        (debugSpectroWindow as any).addSample(sample);
      });

      // Analyze FFT
      const fftPowerArray = Array.from(debugSpectroWindow['fftPower'] as Int32Array);
      const binValues = fftPowerArray.slice(displaySpec.firstBin, displaySpec.lastBin + 1);

      // Find top 2 peaks
      const peaks = binValues
        .map((value, index) => ({ bin: index, power: value }))
        .sort((a, b) => b.power - a.power)
        .slice(0, 2);

      const peakBins = peaks.map(p => p.bin).sort((a, b) => a - b);

      console.log(`\nDual-frequency test: Found peaks at bins ${peakBins[0]} and ${peakBins[1]}`);
      console.log(`Expected peaks near bins ${freq1} and ${freq2}`);

      // Should find peaks near both frequencies
      expect(peakBins[0]).toBeGreaterThanOrEqual(freq1 - 2);
      expect(peakBins[0]).toBeLessThanOrEqual(freq1 + 2);
      expect(peakBins[1]).toBeGreaterThanOrEqual(freq2 - 2);
      expect(peakBins[1]).toBeLessThanOrEqual(freq2 + 2);
    });
  });

  describe('DC and Nyquist Edge Cases', () => {
    it('should handle DC component (bin 0)', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '2048',
        '0', '236',
        'RANGE', '1000'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Mock rendering
      jest.spyOn(debugSpectroWindow as any, 'updateWaterfallDisplay').mockImplementation(() => {});
      jest.spyOn(debugSpectroWindow as any, 'scrollWaterfall').mockImplementation(() => {});
      jest.spyOn(debugSpectroWindow as any, 'plotPixel').mockImplementation(() => {});

      // Generate constant DC signal
      const dcValue = 500;
      const samples = new Array(2048).fill(dcValue);

      // Feed samples
      samples.forEach(sample => {
        (debugSpectroWindow as any).addSample(sample);
      });

      // Analyze FFT
      const fftPowerArray = Array.from(debugSpectroWindow['fftPower'] as Int32Array);
      const bin0Power = fftPowerArray[0];
      const otherBinsAvg = fftPowerArray.slice(1, 100).reduce((sum, v) => sum + v, 0) / 99;

      console.log(`\nDC test: Bin 0 power = ${bin0Power}, Other bins avg = ${otherBinsAvg.toFixed(2)}`);

      // Bin 0 should dominate
      expect(bin0Power).toBeGreaterThan(otherBinsAvg * 10);
    });
  });
});
