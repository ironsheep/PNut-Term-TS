import { DebugFFTWindow, FFTDisplaySpec } from '../src/classes/debugFftWin';
import { setupDebugWindowTests, triggerWindowCreation, testCommand } from './shared/debugWindowTestUtils';
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
  writeFileSync: jest.fn()
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

// DO NOT mock internal modules - let them run!
// - canvasRenderer
// - displaySpecParser  
// - colorTranslator
// - inputForwarder (except USB)
// - debugColor
// - packedDataProcessor

describe('DebugFFTWindow', () => {
  let debugFftWindow: DebugFFTWindow;
  let mockContext: any;
  let cleanup: () => void;

  beforeEach(() => {
    // Clear mock instances
    mockBrowserWindowInstances = [];
    
    // Setup test environment using new utilities
    const setup = setupDebugWindowTests({
      windowType: 'logic', // Use 'logic' since 'fft' is not in the type union yet
      displayName: 'FFTTest'
    });
    mockContext = setup.mockContext;
    cleanup = setup.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('createDisplaySpec static method', () => {
    it('should create FFT display spec with default configuration', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', ['FFT', 'TestFFT']);
      
      expect(displaySpec.displayName).toBe('TestFFT');
      expect(displaySpec.samples).toBe(512); // Default from Pascal
      expect(displaySpec.lineSize).toBe(3); // Default from Pascal
      expect(displaySpec.rate).toBe(512); // Should default to samples value
      expect(displaySpec.logScale).toBe(false);
      expect(displaySpec.hideXY).toBe(false);
    });

    it('should parse SAMPLES configuration correctly', () => {
      const lineParts = ['FFT', 'TestFFT', 'SAMPLES', '1024'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.samples).toBe(1024);
      expect(displaySpec.firstBin).toBe(0);
      expect(displaySpec.lastBin).toBe(511); // 1024/2 - 1
    });

    it('should parse SAMPLES with first and last bins', () => {
      const lineParts = ['FFT', 'TestFFT', 'SAMPLES', '512', '10', '100'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.samples).toBe(512);
      expect(displaySpec.firstBin).toBe(10);
      expect(displaySpec.lastBin).toBe(100);
    });

    it('should validate power-of-2 samples and correct invalid values', () => {
      // Test that invalid power-of-2 values are corrected to nearest valid value
      // Note: Logging is commented out in static methods as per project convention
      
      const lineParts = ['FFT', 'TestFFT', 'SAMPLES', '500']; // Not power of 2
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.samples).toBe(512); // Should round to nearest power of 2
      expect(displaySpec.nbrSamples).toBe(512); // Should match samples
      expect(displaySpec.lastBin).toBe(255); // Should be samples/2 - 1
    });

    it('should handle samples outside valid range (4-2048)', () => {
      // Test that values outside valid range are corrected
      // Note: Logging is commented out in static methods as per project convention
      
      // Test too small
      let lineParts = ['FFT', 'TestFFT', 'SAMPLES', '2'];
      let displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      expect(displaySpec.samples).toBe(4); // Should clamp to minimum
      expect(displaySpec.nbrSamples).toBe(4);
      
      // Test too large
      lineParts = ['FFT', 'TestFFT', 'SAMPLES', '4096'];
      displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      expect(displaySpec.samples).toBe(2048); // Should clamp to maximum
      expect(displaySpec.nbrSamples).toBe(2048);
    });

    it('should parse RATE configuration', () => {
      const lineParts = ['FFT', 'TestFFT', 'RATE', '256'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.rate).toBe(256);
    });

    it('should parse DOTSIZE configuration', () => {
      const lineParts = ['FFT', 'TestFFT', 'DOTSIZE', '5'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.dotSize).toBe(5);
    });

    it('should parse LINESIZE configuration', () => {
      const lineParts = ['FFT', 'TestFFT', 'LINESIZE', '-10'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.lineSize).toBe(-10);
    });

    it('should parse LOGSCALE flag', () => {
      const lineParts = ['FFT', 'TestFFT', 'LOGSCALE'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.logScale).toBe(true);
    });

    it('should parse HIDEXY flag', () => {
      const lineParts = ['FFT', 'TestFFT', 'HIDEXY'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.hideXY).toBe(true);
    });

    it('should handle unknown directives gracefully', () => {
      // Test that unknown directives don't crash the parser
      // Note: Logging is commented out in static methods as per project convention
      
      const lineParts = ['FFT', 'TestFFT', 'UNKNOWN_DIRECTIVE', '123'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      // Should still create a valid spec with defaults
      expect(displaySpec.displayName).toBe('TestFFT');
      expect(displaySpec.samples).toBe(512); // Default
    });

    it('should apply Pascal default when both dotSize and lineSize are 0', () => {
      const lineParts = ['FFT', 'TestFFT', 'DOTSIZE', '0', 'LINESIZE', '0'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.dotSize).toBe(1); // Should be set to 1 per Pascal behavior
      expect(displaySpec.lineSize).toBe(0);
    });

    it('should parse SIZE directive for window dimensions', () => {
      const lineParts = ['FFT', 'TestFFT', 'SIZE', '800', '600'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      expect(displaySpec.size.width).toBe(800);
      expect(displaySpec.size.height).toBe(600);
    });

    it('should handle missing parameters gracefully', () => {
      // Test that missing parameters don't crash the parser
      // Note: Logging is commented out in static methods as per project convention
      
      const lineParts = ['FFT', 'TestFFT', 'SAMPLES']; // Missing parameter
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      // Should still create a valid spec using defaults
      expect(displaySpec.displayName).toBe('TestFFT');
      expect(displaySpec.samples).toBe(512); // Should use default
    });

    it('should handle invalid parameter ranges', () => {
      // Test that invalid parameter values use defaults
      // Note: Logging is commented out in static methods as per project convention
      
      const lineParts = ['FFT', 'TestFFT', 'DOTSIZE', '100']; // Out of range (0-32)
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      
      // Should use default value when parameter is out of range
      expect(displaySpec.dotSize).toBe(0); // Default value
      expect(displaySpec.displayName).toBe('TestFFT');
    });
  });

  describe('constructor', () => {
    it('should create FFT window with given display spec', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', ['FFT', 'TestFFT']);
      debugFftWindow = new DebugFFTWindow(mockContext, displaySpec);
      
      expect(debugFftWindow).toBeInstanceOf(DebugFFTWindow);
      
      // Check that the display spec is stored correctly
      const spec = debugFftWindow.getDisplaySpec();
      expect(spec.displayName).toBe('TestFFT');
    });
  });

  describe('Window Creation', () => {
    it('should create debug window on first numeric data', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', ['FFT', 'TestFFT']);
      debugFftWindow = new DebugFFTWindow(mockContext, displaySpec);
      
      expect(debugFftWindow['debugWindow']).toBeNull();
      
      // Send numeric data to trigger window creation
      debugFftWindow.updateContent(['FFT', '`(123)']);
      
      expect(mockBrowserWindowInstances.length).toBe(1);
      expect(debugFftWindow['debugWindow']).toBeDefined();
    });

    it('should not create window on non-numeric data', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', ['FFT', 'TestFFT']);
      debugFftWindow = new DebugFFTWindow(mockContext, displaySpec);
      
      debugFftWindow.updateContent(['FFT', 'CLEAR']);
      
      expect(mockBrowserWindowInstances.length).toBe(0);
      expect(debugFftWindow['debugWindow']).toBeNull();
    });

    it('should create window after channel configurations', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', ['FFT', 'TestFFT']);
      debugFftWindow = new DebugFFTWindow(mockContext, displaySpec);
      
      // Add channel configurations first
      debugFftWindow.updateContent(['FFT', "'Ch1'", '5', '1024', '100', '20', '0', 'RED']);
      debugFftWindow.updateContent(['FFT', "'Ch2'", '3', '512', '80', '100', '0', 'BLUE']);
      
      // Still no window created
      expect(mockBrowserWindowInstances.length).toBe(0);
      
      // First data should create window
      debugFftWindow.updateContent(['FFT', '`(456)']);
      
      expect(mockBrowserWindowInstances.length).toBe(1);
      expect(debugFftWindow['debugWindow']).toBeDefined();
    });
  });

  describe('updateContent', () => {
    beforeEach(() => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', ['FFT', 'TestFFT']);
      debugFftWindow = new DebugFFTWindow(mockContext, displaySpec);
    });

    it('should accept updateContent calls without error', () => {
      // For Phase 1, updateContent is just a stub
      expect(() => {
        debugFftWindow.updateContent(['TestFFT', 'CLEAR']);
      }).not.toThrow();
    });

    it('should handle various command formats', () => {
      expect(() => {
        debugFftWindow.updateContent(['TestFFT', '123', '456']);
      }).not.toThrow();
      
      expect(() => {
        debugFftWindow.updateContent(['TestFFT', 'SAVE']);
      }).not.toThrow();
    });
  });

  describe('canvas initialization', () => {
    it('should calculate canvas dimensions correctly', () => {
      const lineParts = ['FFT', 'TestFFT', 'SIZE', '400', '300'];
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      debugFftWindow = new DebugFFTWindow(mockContext, displaySpec);
      
      const spec = debugFftWindow.getDisplaySpec();
      expect(spec.size.width).toBe(400);
      expect(spec.size.height).toBe(300);
    });

    it('should adjust margins based on HIDEXY setting', () => {
      // Test with coordinate display enabled (default)
      let lineParts = ['FFT', 'TestFFT'];
      let displaySpec1 = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      let fftWindow1 = new DebugFFTWindow(mockContext, displaySpec1);
      expect(fftWindow1.getDisplaySpec().hideXY).toBe(false);
      
      // Test with coordinate display disabled
      lineParts = ['FFT', 'TestFFT', 'HIDEXY'];
      let displaySpec2 = DebugFFTWindow.createDisplaySpec('TestFFT', lineParts);
      let fftWindow2 = new DebugFFTWindow(mockContext, displaySpec2);
      expect(fftWindow2.getDisplaySpec().hideXY).toBe(true);
    });
  });

  describe('window lifecycle', () => {
    beforeEach(() => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', ['FFT', 'TestFFT']);
      debugFftWindow = new DebugFFTWindow(mockContext, displaySpec);
    });

    it('should clean up resources on close', () => {
      expect(() => {
        debugFftWindow.close();
      }).not.toThrow();
    });

    it('should have closeDebugWindow method', () => {
      expect(() => {
        debugFftWindow.closeDebugWindow();
      }).not.toThrow();
    });
  });
});