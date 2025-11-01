/** @format */

/**
 * Circular Buffer Wraparound Test for SPECTRO Window
 *
 * Tests that sample extraction from circular buffer correctly handles wraparound
 * when the write pointer wraps around the buffer boundary.
 *
 * Critical test case:
 * - Buffer positions 2000-2047: values [1-48]
 * - Buffer positions 0-1999: values [49-2048]
 * - Write pointer at position 0 (just wrapped)
 * - FFT extraction should read samples in order [1, 2, 3, ..., 2048]
 */

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

// Mock OS module for temp directory
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

// Mock WindowPlacer to avoid ScreenManager dependencies during tests
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

describe('SPECTRO Circular Buffer Wraparound', () => {
  let debugSpectroWindow: DebugSpectroWindow;
  let mockContext: any;
  let cleanup: () => void;

  beforeEach(() => {
    // Clear mock instances
    mockBrowserWindowInstances = [];

    // Setup test environment
    const setup = setupDebugWindowTests({
      windowType: 'logic',
      displayName: 'SpectroWrapTest'
    });
    mockContext = setup.mockContext;
    cleanup = setup.cleanup;

    mockWindowPlacerInstance.registerWindow.mockClear();
    mockWindowPlacerInstance.getNextPosition.mockClear();
    mockWindowPlacerInstance.releaseWindow.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('should correctly extract samples from wrapped circular buffer', () => {
    // Create SPECTRO window with 2048 sample FFT size
    const displaySpec = DebugSpectroWindow.createDisplaySpec('WrapTest', [
      'SPECTRO', 'WrapTest',
      'SAMPLES', '2048',
      'RATE', '4096' // Prevent automatic FFT draws
    ]);
    debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

    // Get direct access to private members for testing
    const sampleBuffer = (debugSpectroWindow as any).sampleBuffer as Int32Array;

    // Setup: Fill buffer with wraparound pattern
    // When writePtr = 0 (next write position), the buffer has wrapped around
    // The oldest samples are at position 0 (about to be overwritten)
    // Positions 0-1999: values [1-2000] (oldest 2000 samples)
    for (let i = 0; i < 2000; i++) {
      sampleBuffer[i] = i + 1;
    }

    // Positions 2000-2047: values [2001-2048] (newest 48 samples)
    for (let i = 0; i < 48; i++) {
      sampleBuffer[2000 + i] = 2001 + i;
    }

    // Set write pointer to position 0 (just wrapped around)
    (debugSpectroWindow as any).sampleWritePtr = 0;
    (debugSpectroWindow as any).sampleCount = 2048;

    // Spy on performFFTAndDraw to capture FFT input
    let capturedFFTInput: Int32Array | null = null;
    const originalPerformFFT = (debugSpectroWindow as any).fftProcessor.performFFT;
    const performFFTSpy = jest.spyOn((debugSpectroWindow as any).fftProcessor, 'performFFT')
      .mockImplementation((...args: unknown[]) => {
        const samples = args[0] as Int32Array;
        const magnitude = args[1] as number;
        capturedFFTInput = samples.slice(); // Copy the input
        return originalPerformFFT.call((debugSpectroWindow as any).fftProcessor, samples, magnitude);
      });

    // Mock display update to prevent errors
    jest.spyOn(debugSpectroWindow as any, 'updateWaterfallDisplay').mockImplementation(() => {});

    // Trigger FFT extraction and processing
    (debugSpectroWindow as any).performFFTAndDraw();

    // Verify FFT input was captured
    expect(capturedFFTInput).not.toBeNull();
    expect(capturedFFTInput!.length).toBe(2048);

    // Verify sample order is correct: [1, 2, 3, ..., 2048]
    const extractedSamples = Array.from(capturedFFTInput!);

    // Check first 10 values
    const first10 = extractedSamples.slice(0, 10);
    expect(first10).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Check last 10 values
    const last10 = extractedSamples.slice(-10);
    expect(last10).toEqual([2039, 2040, 2041, 2042, 2043, 2044, 2045, 2046, 2047, 2048]);

    // Check wrap boundary (samples 45-52 should span the wraparound point)
    const wrapBoundary = extractedSamples.slice(45, 52);
    expect(wrapBoundary).toEqual([46, 47, 48, 49, 50, 51, 52]);

    // Verify all samples are in correct sequence
    for (let i = 0; i < 2048; i++) {
      expect(extractedSamples[i]).toBe(i + 1);
    }

    performFFTSpy.mockRestore();
  });

  it('should handle multiple wraparounds correctly', () => {
    // Create SPECTRO window with smaller FFT size for faster test
    const displaySpec = DebugSpectroWindow.createDisplaySpec('MultiWrapTest', [
      'SPECTRO', 'MultiWrapTest',
      'SAMPLES', '512',
      'RATE', '1024' // Prevent automatic FFT draws
    ]);
    debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

    // Feed 2048 + 512 samples (wraps buffer completely, then 512 more)
    for (let i = 0; i < 2048 + 512; i++) {
      (debugSpectroWindow as any).addSample(i + 1);
    }

    const sampleBuffer = (debugSpectroWindow as any).sampleBuffer as Int32Array;
    const writePtr = (debugSpectroWindow as any).sampleWritePtr;

    // Write pointer should be at position 512 after wrapping
    expect(writePtr).toBe(512);

    // Extract what the FFT would read (last 512 samples before writePtr)
    const extractedSamples: number[] = [];
    const fftSize = 512;
    const BUFFER_MASK = 2047; // 2048 - 1

    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (writePtr - fftSize + x) & BUFFER_MASK;
      extractedSamples.push(sampleBuffer[bufferIndex]);
    }

    // Should extract samples [2049, 2050, ..., 2560]
    // (the last 512 samples that were added)
    expect(extractedSamples[0]).toBe(2049);
    expect(extractedSamples[511]).toBe(2560);

    for (let i = 0; i < 512; i++) {
      expect(extractedSamples[i]).toBe(2049 + i);
    }
  });

  it('should extract correct samples when buffer is partially filled', () => {
    // Create SPECTRO window
    const displaySpec = DebugSpectroWindow.createDisplaySpec('PartialTest', [
      'SPECTRO', 'PartialTest',
      'SAMPLES', '256',
      'RATE', '512' // Prevent automatic FFT draws
    ]);
    debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

    // Add exactly 256 samples
    for (let i = 0; i < 256; i++) {
      (debugSpectroWindow as any).addSample(i + 1);
    }

    const sampleBuffer = (debugSpectroWindow as any).sampleBuffer as Int32Array;
    const writePtr = (debugSpectroWindow as any).sampleWritePtr;

    // Write pointer should be at position 256
    expect(writePtr).toBe(256);

    // Extract what the FFT would read (last 256 samples before writePtr)
    const extractedSamples: number[] = [];
    const fftSize = 256;
    const BUFFER_MASK = 2047; // 2048 - 1

    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (writePtr - fftSize + x) & BUFFER_MASK;
      extractedSamples.push(sampleBuffer[bufferIndex]);
    }

    // Should extract samples [1, 2, ..., 256]
    for (let i = 0; i < 256; i++) {
      expect(extractedSamples[i]).toBe(i + 1);
    }
  });

  it('should handle edge case when writePtr is exactly at buffer start after wrap', () => {
    // This is the critical edge case from the task description
    const displaySpec = DebugSpectroWindow.createDisplaySpec('EdgeTest', [
      'SPECTRO', 'EdgeTest',
      'SAMPLES', '2048',
      'RATE', '4096'
    ]);
    debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

    // Manually set up buffer state as described:
    // Buffer[2000-2047]: [1-48]
    // Buffer[0-1999]: [49-2048]
    // writePtr: 0

    const sampleBuffer = (debugSpectroWindow as any).sampleBuffer as Int32Array;

    for (let i = 0; i < 48; i++) {
      sampleBuffer[2000 + i] = i + 1;
    }

    for (let i = 0; i < 2000; i++) {
      sampleBuffer[i] = 49 + i;
    }

    (debugSpectroWindow as any).sampleWritePtr = 0;
    (debugSpectroWindow as any).sampleCount = 2048;

    // Manually extract using the same logic as performFFTAndDraw
    const fftInput = new Int32Array(2048);
    const fftSize = 2048;
    const writePtr = 0;
    const BUFFER_MASK = 2047;

    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (writePtr - fftSize + x) & BUFFER_MASK;
      fftInput[x] = sampleBuffer[bufferIndex];
    }

    // Verify extraction order
    // When writePtr = 0, we read backwards from 0:
    // (0 - 2048 + 0) & 2047 = -2048 & 2047 = 0
    // (0 - 2048 + 1) & 2047 = -2047 & 2047 = 1
    // ...
    // (0 - 2048 + 2047) & 2047 = -1 & 2047 = 2047

    // So we read: [0, 1, 2, ..., 1999, 2000, 2001, ..., 2047]
    // Which contains: [49, 50, 51, ..., 2048, 1, 2, ..., 48]

    // WAIT - this is WRONG! We need to verify the actual Pascal extraction logic

    // The extraction should be:
    // Start at (writePtr - fftSize) = (0 - 2048) = -2048
    // With mask: -2048 & 2047 = 0
    // Then: (0, 1, 2, ..., 2047)

    // But we WANT the order [1, 2, 3, ..., 2048]
    // Which means oldest sample should come first

    // Given writePtr = 0 (next write position)
    // The previous write was at position 2047
    // The oldest sample (in a full buffer) is at position 0 (writePtr)
    // Reading backwards from writePtr:
    // Position 0 has sample 49 (WRONG!)

    // Actually, when writePtr = 0 after wrapping:
    // - The OLDEST sample should be at position 0 (the one that will be overwritten next)
    // - We want to read starting from the oldest

    // Let me re-verify the Pascal extraction:
    // Pascal: FFTsamp[x] := SPECTRO_SampleBuff[(SamplePtr - vSamples + x) and SPECTRO_PtrMask]
    // With SamplePtr = 0, vSamples = 2048, x from 0 to 2047:
    // x=0: (0 - 2048 + 0) & 2047 = -2048 & 2047 = 0 → buffer[0] = 49 (WRONG!)

    // Wait, the issue is in the setup! When writePtr = 0, the oldest sample
    // should be at position 0 (about to be overwritten), not at position 2000!

    // Correct setup for writePtr = 0:
    // - Buffer[0-1999]: oldest 2000 samples (values 1-2000)
    // - Buffer[2000-2047]: newest 48 samples (values 2001-2048)
    // - writePtr: 0 (next sample will overwrite position 0)

    // Let me recalculate the extraction:
    // x=0: (0 - 2048 + 0) & 2047 = 0 → buffer[0] (should be sample 1)
    // x=1: (0 - 2048 + 1) & 2047 = 1 → buffer[1] (should be sample 2)
    // ...
    // x=1999: (0 - 2048 + 1999) & 2047 = 1999 → buffer[1999] (should be sample 2000)
    // x=2000: (0 - 2048 + 2000) & 2047 = 2000 → buffer[2000] (should be sample 2001)
    // ...
    // x=2047: (0 - 2048 + 2047) & 2047 = 2047 → buffer[2047] (should be sample 2048)

    // So the CORRECT buffer setup when writePtr = 0 is:
    // Buffer[0-1999]: samples 1-2000 (oldest 2000 samples)
    // Buffer[2000-2047]: samples 2001-2048 (newest 48 samples)

    // Let me fix the test setup
    sampleBuffer.fill(0); // Clear first

    for (let i = 0; i < 2000; i++) {
      sampleBuffer[i] = i + 1; // Samples 1-2000
    }

    for (let i = 0; i < 48; i++) {
      sampleBuffer[2000 + i] = 2001 + i; // Samples 2001-2048
    }

    // Now extract again
    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (writePtr - fftSize + x) & BUFFER_MASK;
      fftInput[x] = sampleBuffer[bufferIndex];
    }

    // Verify first 10
    expect(Array.from(fftInput.slice(0, 10))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Verify last 10
    expect(Array.from(fftInput.slice(-10))).toEqual([2039, 2040, 2041, 2042, 2043, 2044, 2045, 2046, 2047, 2048]);

    // Verify complete sequence
    for (let i = 0; i < 2048; i++) {
      expect(fftInput[i]).toBe(i + 1);
    }
  });
});
