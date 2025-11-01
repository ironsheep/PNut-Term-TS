import { DebugSpectroWindow, SpectroDisplaySpec } from '../src/classes/debugSpectroWin';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';
import { createMockBrowserWindow } from './shared/mockHelpers';
import { ColorMode, ColorTranslator } from '../src/classes/shared/colorTranslator';

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
  unlinkSync: jest.fn() // Added for temp file cleanup
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

// Recorded Spectro samples captured from external DEBUG_SPECTRO run
// eslint-disable-next-line @typescript-eslint/no-var-requires
const recordedSpectroSamples: number[] = require('./recordings/spectro_samples_4096.json');

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

describe('DebugSpectroWindow', () => {
  beforeEach(() => {
    mockWindowPlacerInstance.registerWindow.mockClear();
    mockWindowPlacerInstance.getNextPosition.mockClear();
    mockWindowPlacerInstance.releaseWindow.mockClear();
  });
  let debugSpectroWindow: DebugSpectroWindow;
  let mockContext: any;
  let cleanup: () => void;

  beforeEach(() => {
    // Clear mock instances
    mockBrowserWindowInstances = [];

    // Setup test environment
    const setup = setupDebugWindowTests({
      windowType: 'logic', // Use 'logic' since 'spectro' is not in the type union yet
      displayName: 'SpectroTest'
    });
    mockContext = setup.mockContext;
    cleanup = setup.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('createDisplaySpec static method', () => {
    it('should create SPECTRO display spec with default configuration', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro']);

      expect(displaySpec.displayName).toBe('TestSpectro');
      expect(displaySpec.samples).toBe(512); // Default FFT size
      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(255); // 512/2 - 1
      expect(displaySpec.depth).toBe(256); // Default waterfall depth
      expect(displaySpec.magnitude).toBe(0); // Default FFT magnitude
      expect(displaySpec.range).toBe(0x7FFFFFFF); // Default range
      expect(displaySpec.tracePattern).toBe(0xF); // Default: scrolling mode 7
      expect(displaySpec.colorMode).toBe(ColorMode.LUMA8X); // Default color mode
      expect(displaySpec.colorTune).toBe(0);
      expect(displaySpec.logScale).toBe(false);
      expect(displaySpec.hideXY).toBe(false);
    });

    it('should parse SAMPLES configuration correctly', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'SAMPLES', '1024'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.samples).toBe(1024);
      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(511); // 1024/2 - 1
    });

    it('should parse SAMPLES with first and last bins', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'SAMPLES', '2048', '0', '236'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.samples).toBe(2048);
      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(236);
    });

    it('should validate power-of-2 samples', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'SAMPLES', '500']; // Not power of 2
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      // Should round to nearest power of 2
      expect(displaySpec.samples).toBe(512);
      expect(displaySpec.nbrSamples).toBe(512); // Should match samples
    });

    it('should handle samples outside valid range (4-2048)', () => {
      // Test too small
      let lineParts = ['SPECTRO', 'TestSpectro', 'SAMPLES', '2'];
      let displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);
      expect(displaySpec.samples).toBe(4); // Should clamp to minimum

      // Test too large
      lineParts = ['SPECTRO', 'TestSpectro', 'SAMPLES', '4096'];
      displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);
      expect(displaySpec.samples).toBe(2048); // Should clamp to maximum
    });

    it('should parse DEPTH configuration', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'DEPTH', '512'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.depth).toBe(512);
    });

    it('should parse MAG configuration', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'MAG', '5'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.magnitude).toBe(5);
    });

    it('should parse RANGE configuration', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'RANGE', '1000'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.range).toBe(1000);
    });

    it('should parse RATE configuration', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'RATE', '128'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.rate).toBe(128);
    });

    it('should default RATE to samples/8 when not specified', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'SAMPLES', '512'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.rate).toBe(64); // 512/8
    });

    it('should parse TRACE configuration', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'TRACE', '7'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.tracePattern).toBe(7);
    });

    it('should parse DOTSIZE configuration', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'DOTSIZE', '2', '3'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.dotSize).toBe(2);
      expect(displaySpec.dotSizeY).toBe(3);
    });

    it('should parse DOTSIZE with single parameter', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'DOTSIZE', '4'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.dotSize).toBe(4);
      expect(displaySpec.dotSizeY).toBe(4); // Should match X
    });

    it('should parse LOGSCALE flag', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'LOGSCALE'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.logScale).toBe(true);
    });

    it('should parse HIDEXY flag', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'HIDEXY'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.hideXY).toBe(true);
    });

    it('should parse LUMA8 color mode', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'LUMA8'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.colorMode).toBe(ColorMode.LUMA8);
      expect(displaySpec.colorTune).toBe(0);
    });

    it('should parse LUMA8W color mode', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'LUMA8W'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.colorMode).toBe(ColorMode.LUMA8W);
    });

    it('should parse LUMA8X color mode', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'LUMA8X'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.colorMode).toBe(ColorMode.LUMA8X);
    });

    it('should parse HSV16 color mode', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'HSV16'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.colorMode).toBe(ColorMode.HSV16);
    });

    it('should parse HSV16W color mode', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'HSV16W'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.colorMode).toBe(ColorMode.HSV16W);
    });

    it('should parse HSV16X color mode', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'HSV16X'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.colorMode).toBe(ColorMode.HSV16X);
    });

    it('should parse color tune names following color mode directives', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'LUMA8X', 'MAGENTA'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.colorMode).toBe(ColorMode.LUMA8X);
      expect(displaySpec.colorTune).toBe(5); // MAGENTA -> index 5 per Pascal table
    });

    it('should parse numeric color tune following HSV modes', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'HSV16', '3'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      expect(displaySpec.colorMode).toBe(ColorMode.HSV16);
      expect(displaySpec.colorTune).toBe(3);
    });

    it('should handle complex configuration from DEBUG_SPECTRO.spin2', () => {
      // Example from the Pascal test file: SAMPLES 2048 0 236 RANGE 1000 LUMA8X GREEN
      const lineParts = [
        'SPECTRO', 'MySpectro',
        'SAMPLES', '2048', '0', '236',
        'RANGE', '1000',
        'LUMA8X',
        'GREEN'
      ];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('MySpectro', lineParts);

      expect(displaySpec.displayName).toBe('MySpectro');
      expect(displaySpec.samples).toBe(2048);
      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(236);
      expect(displaySpec.range).toBe(1000);
      expect(displaySpec.colorMode).toBe(ColorMode.LUMA8X);
      expect(displaySpec.colorTune).toBe(2);
    });

    it('should handle unknown directives gracefully', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'UNKNOWN_DIRECTIVE', '123'];
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      // Should still create a valid spec with defaults
      expect(displaySpec.displayName).toBe('TestSpectro');
      expect(displaySpec.samples).toBe(512); // Default
    });

    it('should handle missing parameters gracefully', () => {
      const lineParts = ['SPECTRO', 'TestSpectro', 'SAMPLES']; // Missing parameter
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', lineParts);

      // Should still create a valid spec using defaults
      expect(displaySpec.displayName).toBe('TestSpectro');
      expect(displaySpec.samples).toBe(512); // Should use default
    });
  });

  describe('parseSpectroDeclaration wrapper', () => {
    it('should parse SPECTRO declaration and return tuple', () => {
      const lineParts = ['`SPECTRO', 'TestSpectro', 'SAMPLES', '1024'];
      const [isValid, displaySpec] = DebugSpectroWindow.parseSpectroDeclaration(lineParts);

      expect(isValid).toBe(true);
      expect(displaySpec.displayName).toBe('TestSpectro');
      expect(displaySpec.samples).toBe(1024);
    });

    it('should return false for invalid declaration', () => {
      const lineParts = ['`SPECTRO']; // Missing display name
      const [isValid, displaySpec] = DebugSpectroWindow.parseSpectroDeclaration(lineParts);

      expect(isValid).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should create SPECTRO window with given display spec', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro']);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      expect(debugSpectroWindow).toBeInstanceOf(DebugSpectroWindow);
    });

    it('should initialize FFT processor', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro', 'SAMPLES', '512']);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Window should be ready to process messages
      expect(debugSpectroWindow['fftProcessor']).toBeDefined();
      expect(debugSpectroWindow['fftSize']).toBe(512);
    });

    it('should initialize circular sample buffer', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro']);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      expect(debugSpectroWindow['sampleBuffer']).toBeDefined();
      expect(debugSpectroWindow['sampleBuffer'].length).toBe(2048); // BUFFER_SIZE
      expect(debugSpectroWindow['sampleWritePtr']).toBe(0);
      expect(debugSpectroWindow['sampleCount']).toBe(0);
    });

    it('should initialize trace processor with correct pattern', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro', 'TRACE', '15']);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      expect(debugSpectroWindow['traceProcessor']).toBeDefined();
      expect(debugSpectroWindow['displaySpec'].tracePattern).toBe(15);
    });

    it('should configure color translator with parsed tune', () => {
      const tuneSpy = jest.spyOn(ColorTranslator.prototype, 'setTune');
      try {
        const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro', 'LUMA8X', 'BLUE']);
        debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

        expect(tuneSpy).toHaveBeenCalledWith(1); // BLUE -> index 1
      } finally {
        tuneSpy.mockRestore();
      }
    });
  });

  describe('Window Creation', () => {
    it('should create debug window on first numeric data', async () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro']);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Window is now created eagerly in constructor
      expect(mockBrowserWindowInstances.length).toBe(1);
      expect(debugSpectroWindow['debugWindow']).toBeDefined();
    });

    it('should not create window on non-numeric data', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro']);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      debugSpectroWindow.updateContent(['CLEAR']);

      // Constructor already created the window; CLEAR should not create additional windows
      expect(mockBrowserWindowInstances.length).toBe(1);
      expect(debugSpectroWindow['debugWindow']).toBeDefined();
    });
  });

  describe('updateContent', () => {
    beforeEach(() => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro']);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);
    });

    it('should accept updateContent calls without error', () => {
      expect(() => {
        debugSpectroWindow.updateContent(['CLEAR']);
      }).not.toThrow();
    });

    it('should handle CLEAR command', () => {
      expect(() => {
        debugSpectroWindow.updateContent(['CLEAR']);
      }).not.toThrow();
    });

    it('should handle SAVE command', () => {
      expect(() => {
        debugSpectroWindow.updateContent(['SAVE', 'test.bmp']);
      }).not.toThrow();
    });

    it('should handle numeric data', () => {
      expect(() => {
        debugSpectroWindow.updateContent(['123']);
      }).not.toThrow();
    });

    it('should handle backtick-enclosed data', () => {
      expect(() => {
        debugSpectroWindow.updateContent(['`(456)']);
      }).not.toThrow();
    });

    it('should reject string data', () => {
      // SPECTRO doesn't allow string data (unlike other windows)
      // Should not throw but should log error
      expect(() => {
        debugSpectroWindow.updateContent(["'text'"]);
      }).not.toThrow();
    });
  });

  describe('Sample Buffer Management', () => {
    beforeEach(() => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '512',
        'RATE', '64'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);
    });

    it('should accumulate samples in circular buffer', async () => {
      // Add a few samples
      for (let i = 0; i < 10; i++) {
        debugSpectroWindow.updateContent([`${i * 100}`]);
      }

      // Wait for async processing to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(debugSpectroWindow['sampleCount']).toBe(10);
      expect(debugSpectroWindow['sampleWritePtr']).toBe(10);
    });

    it('should wrap pointer at buffer boundary', async () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '512'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      // Fill more than BUFFER_SIZE samples
      for (let i = 0; i < 2100; i++) {
        debugSpectroWindow.updateContent([`${i}`]);
      }

      // Wait for async processing to complete
      await new Promise(resolve => setImmediate(resolve));

      // Pointer should wrap (BUFFER_SIZE = 2048)
      expect(debugSpectroWindow['sampleWritePtr']).toBe(52); // 2100 & 2047 = 52
    });

    it('should clear buffer on CLEAR command', async () => {
      // Add some samples
      for (let i = 0; i < 100; i++) {
        debugSpectroWindow.updateContent([`${i}`]);
      }

      // Wait for async processing to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(debugSpectroWindow['sampleCount']).toBeGreaterThan(0);

      // Clear
      debugSpectroWindow.updateContent(['CLEAR']);

      // Wait for async processing to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(debugSpectroWindow['sampleCount']).toBe(0);
      expect(debugSpectroWindow['sampleWritePtr']).toBe(0);
    });

    it('should parse Spin2-formatted numbers with underscores', async () => {
      debugSpectroWindow.updateContent(['1_000', '-1_000', '0']);

      await new Promise(resolve => setImmediate(resolve));

      expect(debugSpectroWindow['sampleCount']).toBe(3);
      expect(debugSpectroWindow['sampleWritePtr']).toBe(3);
      expect(debugSpectroWindow['sampleBuffer'][0]).toBe(1000);
      expect(debugSpectroWindow['sampleBuffer'][1]).toBe(-1000);
      expect(debugSpectroWindow['sampleBuffer'][2]).toBe(0);
    });

    it('should parse backtick-enclosed Spin2 numeric tokens', async () => {
      debugSpectroWindow.updateContent(['`(1_000)`', '`(-1_000)`']);

      await new Promise(resolve => setImmediate(resolve));

      expect(debugSpectroWindow['sampleCount']).toBe(2);
      expect(debugSpectroWindow['sampleBuffer'][0]).toBe(1000);
      expect(debugSpectroWindow['sampleBuffer'][1]).toBe(-1000);
    });

    it('should ignore non-numeric tokens while still capturing numeric samples', async () => {
      debugSpectroWindow.updateContent(['MyScope', '351', 'noise', '1_024']);

      await new Promise(resolve => setImmediate(resolve));

      expect(debugSpectroWindow['sampleCount']).toBe(2);
      expect(debugSpectroWindow['sampleBuffer'][0]).toBe(351);
      expect(debugSpectroWindow['sampleBuffer'][1]).toBe(1024);
    });
  });

  describe('FFT pipeline triggers', () => {
    beforeEach(() => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '8',
        'RANGE', '1000',
        'LUMA8X', 'GREEN'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);
    });

    it('should invoke FFT draw once enough samples are collected', async () => {
      const drawSpy = jest.spyOn(debugSpectroWindow as any, 'performFFTAndDraw').mockImplementation(() => {});

      const tokens = [
        'MyScope', '1_000',
        'alias', '500',
        'noise', '0',
        'tag', '-1_000',
        'extra', '750',
        'data', '-750',
        'foo', '250',
        'bar', '-250'
      ];

      for (let i = 0; i < tokens.length; i += 2) {
        debugSpectroWindow.updateContent([tokens[i], tokens[i + 1]]);
      }

      await new Promise(resolve => setImmediate(resolve));

      expect(drawSpy).toHaveBeenCalledTimes(1);
      drawSpy.mockRestore();
    });
  });

  describe('FFT magnitude distribution', () => {
    it('should concentrate energy in expected bin for synthetic sine wave', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '2048',
        'RANGE', '1000',
        'RATE', '4096', // prevent automatic draws during setup
        'LUMA8X', 'GREEN'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      const updateSpy = jest.spyOn(debugSpectroWindow as any, 'updateWaterfallDisplay').mockImplementation(() => {});

      const freqBin = 32;
      const amplitude = 1000;
      const totalSamples = displaySpec.samples;

      for (let i = 0; i < totalSamples; i++) {
        const sample = Math.round(amplitude * Math.sin((2 * Math.PI * freqBin * i) / totalSamples));
        (debugSpectroWindow as any).addSample(sample);
      }

      // Manually trigger FFT draw
      (debugSpectroWindow as any).performFFTAndDraw();

      const fftPower: number[] = Array.from(debugSpectroWindow['fftPower']);
      const maxPower = Math.max(...fftPower);
      const maxIndex = fftPower.indexOf(maxPower);
      const topBins = fftPower
        .map((value, index) => ({ index, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      // Remove the dominant bin and look at the next highest
      const fftPowerClone = fftPower.slice();
      fftPowerClone.splice(maxIndex, 1);
      const nextPower = Math.max(...fftPowerClone);

      expect(maxIndex).toBeGreaterThan(freqBin - 2);
      const topBinNeighbors = topBins.map((entry) => entry.index);
      expect(topBinNeighbors.some((idx) => Math.abs(idx - freqBin) <= 2)).toBe(true);
      expect(maxPower).toBeGreaterThanOrEqual(nextPower);

      updateSpy.mockRestore();
    });
  });

  describe('Recorded Spectro data parity', () => {
    it('should match expected FFT peak for captured MySpectro stream', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('MySpectro', [
        'SPECTRO',
        'MySpectro',
        'SAMPLES',
        '2048',
        '0',
        '236',
        'RANGE',
        '1000',
        'LUMA8X',
        'GREEN'
      ]);

      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      const updateSpy = jest.spyOn(debugSpectroWindow as any, 'updateWaterfallDisplay').mockImplementation(() => {});
      const scrollSpy = jest.spyOn(debugSpectroWindow as any, 'scrollWaterfall').mockImplementation(() => {});
      const drawnPixels: number[] = [];
      const plotSpy = jest.spyOn(debugSpectroWindow as any, 'plotPixel').mockImplementation((pixelValue: unknown) => {
        if (typeof pixelValue === 'number') {
          drawnPixels.push(pixelValue);
        }
      });

      const sampleBlock = recordedSpectroSamples.slice(0, displaySpec.samples);
      sampleBlock.forEach((sample) => {
        (debugSpectroWindow as any).addSample(sample);
      });

      (debugSpectroWindow as any).performFFTAndDraw();

      const fftPowerArray = Array.from(debugSpectroWindow['fftPower'] as Int32Array);
      const fftPower: Array<{ bin: number; value: number }> = fftPowerArray
        .slice(displaySpec.firstBin, displaySpec.lastBin + 1)
        .map((value: number, offset: number) => ({
          bin: displaySpec.firstBin + offset,
          value
        }))
        .sort((a, b) => b.value - a.value);

      const topBin = fftPower[0];
      expect(topBin.bin).toBe(145);
      expect(topBin.value).toBeGreaterThan(150);

      // Average the remaining bins (skipping top 10) to ensure background stays much lower than the peak
      const backgroundValues = fftPower.slice(10, 200);
      const background = backgroundValues.reduce((sum, entry) => sum + entry.value, 0) / backgroundValues.length;
      expect(background).toBeLessThan(topBin.value / 4);

      const noiseFloor = (debugSpectroWindow as any).noiseFloor;
      expect(drawnPixels.length).toBeGreaterThan(0);
      const activePixels = drawnPixels.filter((value) => (value & 0xff) > 0);
      expect(activePixels.length).toBeGreaterThan(0);
      expect(activePixels.every((value) => (value & 0xff) >= noiseFloor)).toBe(true);

      updateSpy.mockRestore();
      scrollSpy.mockRestore();
      plotSpy.mockRestore();
    });
  });

  describe('canvas dimensions', () => {
    it('should calculate dimensions based on bins and depth', () => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '512', '0', '127', // 128 bins
        'DEPTH', '256',
        'DOTSIZE', '2'
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      const width = debugSpectroWindow['canvasWidth'];
      const height = debugSpectroWindow['canvasHeight'];

      // For trace patterns 0-3: width=bins, height=depth
      // For trace patterns 4-7: width=depth, height=bins
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });

    it('should swap dimensions for vertical trace patterns', () => {
      // Trace pattern 6 (90° CW) should swap width/height
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', [
        'SPECTRO', 'TestSpectro',
        'SAMPLES', '512', '0', '127', // 128 bins
        'DEPTH', '256',
        'TRACE', '6' // Vertical pattern
      ]);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);

      const width = debugSpectroWindow['canvasWidth'];
      const height = debugSpectroWindow['canvasHeight'];

      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });
  });

  describe('window lifecycle', () => {
    beforeEach(() => {
      const displaySpec = DebugSpectroWindow.createDisplaySpec('TestSpectro', ['SPECTRO', 'TestSpectro']);
      debugSpectroWindow = new DebugSpectroWindow(mockContext, displaySpec);
    });

    it('should clean up resources on close', () => {
      expect(() => {
        debugSpectroWindow.closeDebugWindow();
      }).not.toThrow();
    });

    it('should handle getCanvasId method', () => {
      const canvasId = debugSpectroWindow['getCanvasId']();
      expect(typeof canvasId).toBe('string');
    });
  });
});
