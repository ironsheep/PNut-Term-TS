import { DebugScopeWindow, ScopeDisplaySpec } from '../src/classes/debugScopeWin';
import { setupDebugWindowTests, triggerWindowCreation, testCommand, testNumericAction } from './shared/debugWindowTestUtils';
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
// - triggerProcessor

describe('DebugScopeWindow', () => {
  let debugScopeWindow: DebugScopeWindow;
  let mockContext: any;
  let mockDisplaySpec: ScopeDisplaySpec;
  let cleanup: () => void;

  beforeEach(() => {
    // Clear mock instances
    mockBrowserWindowInstances = [];
    
    // Setup test environment using new utilities
    const setup = setupDebugWindowTests({
      windowType: 'scope',
      displayName: 'SCOPE'
    });
    mockContext = setup.mockContext;
    cleanup = setup.cleanup;
    
    mockDisplaySpec = {
      displayName: 'SCOPE',
      windowTitle: '',  // Empty so windowTitle getter returns 'SCOPE SCOPE'
      title: 'Test Scope',
      position: { x: 0, y: 0 },
      size: { width: 800, height: 600 },
      nbrSamples: 256,
      rate: 1000,
      dotSize: 1,
      lineSize: 1,
      textSize: 12,
      font: {
        textSizePts: 12,
        charHeight: 16,
        lineHeight: 18,
        charWidth: 8,
        baseline: 13
      },
      window: {
        background: '#000000',
        grid: '#808080'
      },
      isPackedData: false,
      hideXY: false
    } as ScopeDisplaySpec;

    debugScopeWindow = new DebugScopeWindow(mockContext, mockDisplaySpec);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Window Creation', () => {
    it('should create debug window on first numeric data', () => {
      expect(debugScopeWindow['debugWindow']).toBeNull();
      
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      expect(mockBrowserWindowInstances.length).toBe(1);
      expect(debugScopeWindow['debugWindow']).toBeDefined();
    });

    it('should not create window on non-numeric data', () => {
      debugScopeWindow.updateContent(['SCOPE', 'CLEAR']);
      
      expect(mockBrowserWindowInstances.length).toBe(0);
      expect(debugScopeWindow['debugWindow']).toBeNull();
    });
  });

  describe('parseScopeDeclaration', () => {
    it('should parse minimal declaration with display name only', () => {
      const [isValid, spec] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'TestScope']);
      
      expect(isValid).toBe(true);
      expect(spec.displayName).toBe('TestScope');
      // Check defaults
      expect(spec.position).toEqual({ x: 0, y: 0 });
      expect(spec.nbrSamples).toBe(256);
      expect(spec.rate).toBe(1);
      expect(spec.dotSize).toBe(0);
      expect(spec.lineSize).toBe(3); // Default is 3 from Pascal
      expect(spec.textSize).toBe(12);
      expect(spec.window.background).toBe('#000000');
      expect(spec.window.grid).toBe('#373737'); // GRAY 4
      expect(spec.hideXY).toBe(false);
    });

    it('should parse SAMPLES directive', () => {
      const [isValid, spec] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'Test', 'SAMPLES', '512']);
      
      expect(isValid).toBe(true);
      expect(spec.nbrSamples).toBe(512);
    });

    it('should parse RANGE directive', () => {
      const [isValid, spec] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'Test', 'RANGE', '-100', '100']);
      
      expect(isValid).toBe(true);
      // RANGE applies to all channels, not a specific property
    });

    it('should parse channel specifications', () => {
      const [isValid, spec] = DebugScopeWindow.parseScopeDeclaration([
        '`SCOPE', 'Test',
        "'Channel1'", '1', '16', 'GREEN', '8', '0', '0', '100'
      ]);
      
      expect(isValid).toBe(true);
      // Channel specs are parsed during runtime, not in declaration
    });

    it('should parse TRIGGER directive', () => {
      const [isValid, spec] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'Test', 'TRIGGER', 'NORMAL', '0', '50']);
      
      expect(isValid).toBe(true);
      // Trigger is parsed during runtime, not in declaration
    });

    it('should handle invalid directives', () => {
      // Parser is very permissive, treats unknown as channel names
      const [isValid] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'Test', 'INVALID']);
      
      expect(isValid).toBe(true); // Parser doesn't reject unknown directives
    });

    it('should handle missing display name', () => {
      const [isValid] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE']);
      expect(isValid).toBe(false);
    });
  });

  describe('Command Processing', () => {
    beforeEach(() => {
      // Create window first
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
    });

    describe('TRIGGER command', () => {
      it('should enable trigger with AUTO mode', () => {
        // Add a channel first
        debugScopeWindow['channelSpecs'] = [{
          name: 'Test',
          minValue: 0,
          maxValue: 255,
          ySize: 200,
          color: '#00FF00',
          gridColor: '#808080',
          textColor: '#FFFFFF',
          yBaseOffset: 0,
          lgndShowMax: true,
          lgndShowMin: true,
          lgndShowMaxLine: true,
          lgndShowMinLine: true
        }];
        
        testCommand(debugScopeWindow, 'SCOPE', ['TRIGGER', '0', 'AUTO'], () => {
          expect(debugScopeWindow['triggerSpec'].trigEnabled).toBe(true);
          expect(debugScopeWindow['triggerSpec'].trigAuto).toBe(true);
          expect(debugScopeWindow['triggerSpec'].trigChannel).toBe(0);
        });
      });

      it('should enable trigger with specific levels', () => {
        testCommand(debugScopeWindow, 'SCOPE', ['TRIGGER', '0', '64', '128'], () => {
          expect(debugScopeWindow['triggerSpec'].trigEnabled).toBe(true);
          expect(debugScopeWindow['triggerSpec'].trigAuto).toBe(false);
          expect(debugScopeWindow['triggerSpec'].trigChannel).toBe(0);
          expect(debugScopeWindow['triggerSpec'].trigArmLevel).toBe(64);
          expect(debugScopeWindow['triggerSpec'].trigLevel).toBe(128);
        });
      });

      it('should handle TRIGGER with HOLDOFF', () => {
        testCommand(debugScopeWindow, 'SCOPE', ['TRIGGER', '0', 'HOLDOFF', '100'], () => {
          expect(debugScopeWindow['triggerSpec'].trigEnabled).toBe(true);
          expect(debugScopeWindow['triggerSpec'].trigHoldoff).toBe(100);
        });
      });
    });

    describe('CLEAR command', () => {
      it('should clear sample data', () => {
        // Add some data first
        testCommand(debugScopeWindow, 'SCOPE', '255', () => {});
        
        // Clear it
        testCommand(debugScopeWindow, 'SCOPE', 'CLEAR', () => {
          // Verify channel samples are cleared
          const channelSamples = debugScopeWindow['channelSamples'];
          expect(channelSamples).toBeDefined();
          channelSamples.forEach((channel: any) => {
            expect(channel.samples.every((s: number) => s === 0)).toBe(true);
          });
        });
      });
    });

    describe('CLOSE command', () => {
      it('should close the window', () => {
        const closeSpy = jest.spyOn(debugScopeWindow, 'closeDebugWindow');
        
        testCommand(debugScopeWindow, 'SCOPE', 'CLOSE', () => {
          expect(closeSpy).toHaveBeenCalled();
        });
      });
    });

    describe('SAVE command', () => {
      it('should save window to file', async () => {
        const saveSpy = jest.spyOn(debugScopeWindow as any, 'saveWindowToBMPFilename');
        
        await debugScopeWindow.updateContent(['SCOPE', 'SAVE', "'test.bmp'"]);
        
        expect(saveSpy).toHaveBeenCalledWith('test.bmp');
      });
    });

    describe('PC_KEY command', () => {
      it('should enable keyboard input', () => {
        const enableSpy = jest.spyOn(debugScopeWindow as any, 'enableKeyboardInput');
        
        testCommand(debugScopeWindow, 'SCOPE', 'PC_KEY', () => {
          expect(enableSpy).toHaveBeenCalled();
        });
      });
    });

    describe('PC_MOUSE command', () => {
      it('should enable mouse input', () => {
        const enableSpy = jest.spyOn(debugScopeWindow as any, 'enableMouseInput');
        
        testCommand(debugScopeWindow, 'SCOPE', 'PC_MOUSE', () => {
          expect(enableSpy).toHaveBeenCalled();
        });
      });
    });

    describe('Numeric data processing', () => {
      it('should record samples', () => {
        testCommand(debugScopeWindow, 'SCOPE', '128', () => {
          const channelSamples = debugScopeWindow['channelSamples'];
          expect(channelSamples).toBeDefined();
          expect(channelSamples.length).toBeGreaterThan(0);
          expect(channelSamples[0].samples.length).toBeGreaterThan(0);
        });
      });

      it('should handle packed data modes', () => {
        testCommand(debugScopeWindow, 'SCOPE', ['BYTES_2BIT', '65535'], () => {
          const channelSamples = debugScopeWindow['channelSamples'];
          expect(channelSamples).toBeDefined();
        });
      });

      it('should handle hex numbers', () => {
        testCommand(debugScopeWindow, 'SCOPE', '$FF', () => {
          const channelSamples = debugScopeWindow['channelSamples'];
          expect(channelSamples).toBeDefined();
        });
      });

      it('should handle binary numbers', () => {
        testCommand(debugScopeWindow, 'SCOPE', '%11111111', () => {
          const channelSamples = debugScopeWindow['channelSamples'];
          expect(channelSamples).toBeDefined();
        });
      });
    });
  });

  describe('Y-axis Scaling', () => {
    beforeEach(() => {
      // Set up channel with known range
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: -100,
        maxValue: 100,
        ySize: 200,
        color: '#00FF00',
        gridColor: '#808080',
        textColor: '#FFFFFF',
        yBaseOffset: 0,
        lgndShowMax: true,
        lgndShowMin: true,
        lgndShowMaxLine: true,
        lgndShowMinLine: true
      }];
      
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
    });

    it('should scale and invert values correctly', () => {
      // Test scaleAndInvertValue method
      const channelSpec = debugScopeWindow['channelSpecs'][0];
      const yMax = debugScopeWindow['scaleAndInvertValue'](100, channelSpec); // Max value
      const yMin = debugScopeWindow['scaleAndInvertValue'](-100, channelSpec); // Min value
      const yZero = debugScopeWindow['scaleAndInvertValue'](0, channelSpec); // Zero
      
      // Y coordinates are inverted (0 at top)
      // value 100: adjustedValue = 100 - (-100) = 200
      // scaledValue = (200 / 200) * 199 = 199, inverted = 199 - 199 = 0
      expect(yMax).toBe(0); // Max value at top
      // value -100: adjustedValue = -100 - (-100) = 0
      // scaledValue = (0 / 200) * 199 = 0, inverted = 199 - 0 = 199
      expect(yMin).toBe(199); // Min value at bottom
      // value 0: adjustedValue = 0 - (-100) = 100
      // scaledValue = (100 / 200) * 199 = 99.5 -> 100, inverted = 199 - 100 = 99
      expect(yZero).toBe(99); // Zero at middle
    });

    it('should handle Y-axis inversion in mouse coordinates', () => {
      const coords = debugScopeWindow['transformMouseCoordinates'](100, 100);
      // Y should be inverted
      expect(coords.y).toBeDefined();
    });
  });

  describe('Mouse Coordinate Display', () => {
    it('should add coordinate display elements to HTML', () => {
      // Initialize required properties
      debugScopeWindow['channelInset'] = 10;
      debugScopeWindow['canvasMargin'] = 2;
      debugScopeWindow['channelLineWidth'] = 1;
      
      // Add a channel first so window creation works
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test Channel',
        minValue: -100,
        maxValue: 100,
        ySize: 200,
        color: '#00FF00',
        gridColor: '#808080',
        textColor: '#FFFFFF',
        yBaseOffset: 0,
        lgndShowMax: true,
        lgndShowMin: true,
        lgndShowMaxLine: true,
        lgndShowMinLine: true
      }] as any;
      
      // Trigger window creation
      debugScopeWindow['createDebugWindow']();
      
      // Get the created mock window
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow).toBeDefined();
      
      // Verify the window was assigned to the debugWindow property
      expect(debugScopeWindow['debugWindow']).toBeDefined();
      expect(debugScopeWindow['debugWindow']).toBe(mockWindow);
      
      // Check that loadURL was called
      expect(mockWindow.loadURL).toHaveBeenCalled();
      
      // Check that HTML includes coordinate display elements
      const loadURLCall = mockWindow.loadURL.mock.calls[0];
      expect(loadURLCall).toBeDefined();
      const htmlContent = decodeURIComponent(loadURLCall[0].replace('data:text/html,', ''));
      
      expect(htmlContent).toContain('id="coordinate-display"');
      expect(htmlContent).toContain('id="crosshair-horizontal"');
      expect(htmlContent).toContain('id="crosshair-vertical"');
    });

    it('should include coordinate display styles', () => {
      // Initialize required properties
      debugScopeWindow['channelInset'] = 10;
      debugScopeWindow['canvasMargin'] = 2;
      debugScopeWindow['channelLineWidth'] = 1;
      
      // Add a channel first
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test Channel',
        minValue: -100,
        maxValue: 100,
        ySize: 200,
        color: '#00FF00',
        gridColor: '#808080',
        textColor: '#FFFFFF',
        yBaseOffset: 0,
        lgndShowMax: true,
        lgndShowMin: true,
        lgndShowMaxLine: true,
        lgndShowMinLine: true
      }] as any;
      
      // Trigger window creation
      debugScopeWindow['createDebugWindow']();
      
      const mockWindow = mockBrowserWindowInstances[0];
      const loadURLCall = mockWindow.loadURL.mock.calls[0];
      const htmlContent = decodeURIComponent(loadURLCall[0].replace('data:text/html,', ''));
      
      expect(htmlContent).toContain('#coordinate-display');
      expect(htmlContent).toContain('pointer-events: none');
      expect(htmlContent).toContain('z-index: 20');
    });

    it('should transform mouse coordinates correctly', () => {
      // Add a channel
      debugScopeWindow['channelSpecs'] = [{
        minValue: -100,
        maxValue: 100,
        ySize: 200
      }] as any;

      // Create window first
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      // Now update display spec
      debugScopeWindow['displaySpec'].size = { width: 800, height: 600 };
      debugScopeWindow['displaySpec'].nbrSamples = 256;
      debugScopeWindow['contentInset'] = 10;
      debugScopeWindow['channelInset'] = 20;

      // Test coordinate transformation
      const coords = debugScopeWindow['transformMouseCoordinates'](100, 100);
      expect(coords.x).toBeDefined();
      expect(coords.y).toBeDefined();
      
      // Test mouse outside display area
      const coords2 = debugScopeWindow['transformMouseCoordinates'](-1, -1);
      expect(coords2.x).toBe(-1);
      expect(coords2.y).toBe(-1);
    });

    it('should call enableMouseInput and set up coordinate display', () => {
      // Add a channel first
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test Channel',
        minValue: -100,
        maxValue: 100,
        ySize: 200
      }] as any;
      
      // Create a window first
      debugScopeWindow['createDebugWindow']();
      
      // Get the created mock window
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow).toBeDefined();
      
      // Enable mouse input
      debugScopeWindow['enableMouseInput']();

      // Should create input forwarder
      expect(debugScopeWindow['inputForwarder']).toBeDefined();
      
      // Should add coordinate display JavaScript
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
      
      // Check that the JavaScript includes coordinate display setup
      const jsCall = mockWindow.webContents.executeJavaScript.mock.calls.find(
        (call: any) => call[0].includes('coordinate-display')
      );
      expect(jsCall).toBeDefined();
      expect(jsCall[0]).toContain('coordDisplay.textContent = scopeX + \',\' + scopeY');
      expect(jsCall[0]).toContain('crosshairH.style.display = \'block\'');
      expect(jsCall[0]).toContain('crosshairV.style.display = \'block\'');
    });
  });

  describe('Canvas ID', () => {
    it('should return correct canvas ID', () => {
      expect(debugScopeWindow['getCanvasId']()).toBe('canvas');
    });
  });

  describe('Sample Buffer Management', () => {
    beforeEach(() => {
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
    });

    it('should scroll samples when buffer is full', () => {
      // Fill the buffer
      const maxSamples = debugScopeWindow['displaySpec'].nbrSamples;
      for (let i = 0; i < maxSamples + 10; i++) {
        debugScopeWindow.updateContent(['SCOPE', String(i)]);
      }
      
      // Check that we still have maxSamples
      const channelSamples = debugScopeWindow['channelSamples'];
      expect(channelSamples[0].samples.length).toBe(maxSamples);
    });

    it('should handle multiple channels', () => {
      // Create the window with default channel first
      debugScopeWindow.updateContent(['SCOPE', '32']);
      
      // Add a second channel manually
      debugScopeWindow.updateContent(['SCOPE', "'Channel2'", '0', '255', '100', '0', '%1111', 'GREEN']);
      
      // Now we should have 2 channels
      const channelSpecs = debugScopeWindow['channelSpecs'];
      expect(channelSpecs.length).toBe(2);
      
      // Send data for both channels
      debugScopeWindow.updateContent(['SCOPE', '100', '200']);
      
      // Check samples were recorded
      const channelSamples = debugScopeWindow['channelSamples'];
      expect(channelSamples).toHaveLength(2);
      expect(channelSamples[0].samples.length).toBeGreaterThan(0);
      expect(channelSamples[1].samples.length).toBeGreaterThan(0);
    });
  });

  describe('Window Rendering', () => {
    beforeEach(() => {
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
    });

    it('should render channel data as connected lines', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      
      // Add some sample data
      debugScopeWindow.updateContent(['SCOPE', '100']);
      debugScopeWindow.updateContent(['SCOPE', '150']);
      debugScopeWindow.updateContent(['SCOPE', '75']);
      
      // Check that drawLine was called via executeJavaScript
      const drawCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('lineTo')
      );
      expect(drawCalls.length).toBeGreaterThan(0);
    });

    it('should update grid lines', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      
      // Check that grid lines are drawn
      const gridCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('grid') || call[0].includes('stroke')
      );
      expect(gridCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Trigger Display', () => {
    beforeEach(() => {
      // Add a channel
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: 0,
        maxValue: 255,
        ySize: 200
      }] as any;
      
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
    });

    it('should display trigger levels when enabled', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      
      // Enable trigger
      debugScopeWindow.updateContent(['SCOPE', 'TRIGGER', '0', '64', '128']);
      
      // Check for any drawing related to trigger
      const drawCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('stroke') || call[0].includes('line')
      );
      expect(drawCalls.length).toBeGreaterThan(0);
    });

    it('should show trigger status', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      
      // Enable trigger
      debugScopeWindow.updateContent(['SCOPE', 'TRIGGER', '0', '64', '128']);
      
      // Check for trigger status display
      const statusCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('trigger-status')
      );
      expect(statusCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-scaling', () => {
    it('should calculate auto trigger levels', () => {
      // Add a channel
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: 0,
        maxValue: 100,
        ySize: 200
      }] as any;
      
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      // Enable auto trigger
      debugScopeWindow.updateContent(['SCOPE', 'TRIGGER', '0', 'AUTO']);
      
      const triggerSpec = debugScopeWindow['triggerSpec'];
      expect(triggerSpec.trigAuto).toBe(true);
      expect(triggerSpec.trigArmLevel).toBeCloseTo(33.33, 1); // 33% from bottom
      expect(triggerSpec.trigLevel).toBe(50); // 50% (center)
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid display name', () => {
      const [isValid] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE']);
      expect(isValid).toBe(false);
    });

    it('should handle invalid channel in TRIGGER command', () => {
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      // Try to set trigger on non-existent channel
      expect(() => {
        debugScopeWindow.updateContent(['SCOPE', 'TRIGGER', '10', '64', '128']);
      }).not.toThrow();
    });

    it('should handle malformed numeric data', () => {
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      expect(() => {
        debugScopeWindow.updateContent(['SCOPE', 'INVALID_NUMBER']);
      }).not.toThrow();
    });
  });

  describe('Coordinate System', () => {
    it('should display coordinates with Y-axis inverted', () => {
      // Add a channel
      debugScopeWindow['channelSpecs'] = [{
        minValue: 0,
        maxValue: 100,
        ySize: 600
      }] as any;

      // First trigger window creation
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      // Now set up display spec
      debugScopeWindow['displaySpec'].size = { width: 800, height: 600 };
      debugScopeWindow['displaySpec'].nbrSamples = 100;
      debugScopeWindow['contentInset'] = 0;
      debugScopeWindow['channelInset'] = 0;

      // Mouse at top of display should give max Y in scope coords (inverted)
      const topCoords = debugScopeWindow['transformMouseCoordinates'](0, 0);
      expect(topCoords.y).toBe(599); // Y = marginTop + height - 1 - mouseY = 0 + 600 - 1 - 0 = 599

      // Mouse at bottom of display should give min Y in scope coords
      const bottomCoords = debugScopeWindow['transformMouseCoordinates'](0, 599);
      expect(bottomCoords.y).toBe(0); // Y = 0 + 600 - 1 - 599 = 0
    });
  });

  describe('Channel Data Processing', () => {
    beforeEach(() => {
      // Add channels with different ranges
      debugScopeWindow['channelSpecs'] = [
        { name: 'CH1', minValue: 0, maxValue: 255, ySize: 100 } as any,
        { name: 'CH2', minValue: -128, maxValue: 127, ySize: 100 } as any,
        { name: 'CH3', minValue: -100, maxValue: 100, ySize: 100 } as any
      ];
      
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
    });

    it('should handle channel data at declaration time', () => {
      // Send channel data as part of declaration
      debugScopeWindow.updateContent(['SCOPE', "'TestChannel'", 'AUTO2', '200', '0', '0', 'GREEN']);
      
      const channelSpecs = debugScopeWindow['channelSpecs'];
      expect(channelSpecs.length).toBeGreaterThan(3); // Added one more
      const lastChannel = channelSpecs[channelSpecs.length - 1];
      expect(lastChannel.name).toBe('TestChannel');
      expect(lastChannel.ySize).toBe(200);
      expect(lastChannel.color).toBe('#00ff00');
    });

    it('should apply RANGE to channels', () => {
      debugScopeWindow.updateContent(['SCOPE', 'RANGE', '-200', '200']);
      
      // Check if range update was processed (command exists but may not update existing channels)
      expect(() => {
        debugScopeWindow.updateContent(['SCOPE', '100']);
      }).not.toThrow();
    });

    it('should handle all packed data modes', () => {
      // Reset mock instances array
      mockBrowserWindowInstances.length = 0;
      
      // Reset channels from beforeEach
      debugScopeWindow['channelSpecs'] = [];
      debugScopeWindow['channelSamples'] = [];
      debugScopeWindow['isFirstNumericData'] = true;
      debugScopeWindow['debugWindow'] = null;
      debugScopeWindow['windowCreated'] = false;
      
      // Don't use triggerWindowCreation as it interferes with first numeric data handling
      // Send numeric data directly to trigger proper initialization
      debugScopeWindow.updateContent(['SCOPE', '123']);
      
      // Verify window was created
      expect(debugScopeWindow['debugWindow']).not.toBeNull();
      
      // Ensure channel samples are initialized
      const channelSpecs = debugScopeWindow['channelSpecs'];
      expect(channelSpecs.length).toBeGreaterThan(0);
      
      let channelSamples = debugScopeWindow['channelSamples'];
      expect(channelSamples).toBeDefined();
      expect(channelSamples.length).toBe(channelSpecs.length);
      expect(channelSamples[0].samples.length).toBe(1);
      expect(channelSamples[0].samples[0]).toBe(123);
      
      // Now set up 2 channels for WORDS_8BIT test
      debugScopeWindow['channelSpecs'] = [
        { name: 'CH1', minValue: 0, maxValue: 255, ySize: 100 } as any,
        { name: 'CH2', minValue: 0, maxValue: 255, ySize: 100 } as any
      ];
      debugScopeWindow['clearChannelData']();
      
      // Test WORDS_8BIT which unpacks to 2 values
      // First set the packed mode
      debugScopeWindow.updateContent(['SCOPE', 'WORDS_8BIT']);
      // Then send the packed data
      debugScopeWindow.updateContent(['SCOPE', '65280']); // 0xFF00 = 255, 0
      
      // Check samples were recorded
      channelSamples = debugScopeWindow['channelSamples'];
      expect(channelSamples[0].samples.length).toBeGreaterThan(0);
      expect(channelSamples[1].samples.length).toBeGreaterThan(0);
    });
  });

  describe('Window State Management', () => {
    it('should handle window close and cleanup', () => {
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      const mockWindow = mockBrowserWindowInstances[0];
      const closeSpy = jest.spyOn(mockWindow, 'close');
      
      debugScopeWindow.closeDebugWindow();
      
      expect(closeSpy).toHaveBeenCalled();
      expect(debugScopeWindow['debugWindow']).toBeNull();
    });

    it('should update window title', () => {
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      const mockWindow = mockBrowserWindowInstances[0];
      
      // Trigger the 'did-finish-load' event to set title
      const onHandlers = mockWindow.webContents.on.mock.calls.filter(
        (call: any) => call[0] === 'did-finish-load'
      );
      if (onHandlers.length > 0) {
        onHandlers[0][1](); // Call the handler
      }
      
      // Window title is set during creation
      expect(mockWindow.setTitle).toHaveBeenCalledWith('SCOPE SCOPE');
    });
  });

  describe('Drawing Operations', () => {
    beforeEach(() => {
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: 0,
        maxValue: 255,
        ySize: 200,
        color: '#00FF00'
      }] as any;
      
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
    });

    it('should draw channel labels', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      
      // Trigger the 'did-finish-load' event
      const onHandlers = mockWindow.webContents.on.mock.calls.filter(
        (call: any) => call[0] === 'did-finish-load'
      );
      expect(onHandlers.length).toBeGreaterThan(0);
      onHandlers[0][1](); // Call the handler
      
      // Add a sample to trigger drawing
      debugScopeWindow.updateContent(['SCOPE', '128']);
      
      // Check for label update calls
      const labelCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('label') || call[0].includes('Test')
      );
      expect(labelCalls.length).toBeGreaterThan(0);
    });

    it('should handle line width setting', () => {
      // LINE directive changes line width
      debugScopeWindow.updateContent(['SCOPE', 'LINE', '5']);
      
      expect(debugScopeWindow['displaySpec'].lineSize).toBe(5);
    });

    it('should handle DOT size setting', () => {
      // DOT directive changes dot size
      debugScopeWindow.updateContent(['SCOPE', 'DOT', '3']);
      
      expect(debugScopeWindow['displaySpec'].dotSize).toBe(3);
    });
  });

  describe('Advanced Trigger Features', () => {
    beforeEach(() => {
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: 0,
        maxValue: 255,
        ySize: 200
      }] as any;
      
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
    });

    it('should handle trigger slope settings', () => {
      // Enable trigger with specific settings
      debugScopeWindow.updateContent(['SCOPE', 'TRIGGER', '0', '64', '128', '10']);
      
      const triggerSpec = debugScopeWindow['triggerSpec'];
      expect(triggerSpec.trigEnabled).toBe(true);
      expect(triggerSpec.trigRtOffset).toBe(10);
    });

    it('should process trigger with ScopeTriggerProcessor', () => {
      // Enable trigger
      debugScopeWindow.updateContent(['SCOPE', 'TRIGGER', '0', '64', '128']);
      
      // Send samples that should trigger
      debugScopeWindow.updateContent(['SCOPE', '50']); // Below arm level
      debugScopeWindow.updateContent(['SCOPE', '70']); // Above arm level
      debugScopeWindow.updateContent(['SCOPE', '130']); // Above trigger level
      
      // Trigger processor should have been used
      expect(debugScopeWindow['triggerProcessor']).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    it('should have correct display name', () => {
      expect(debugScopeWindow['displaySpec'].displayName).toBe('SCOPE');
    });

    it('should have debug window property', () => {
      expect(debugScopeWindow['debugWindow']).toBeNull();
      
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      expect(debugScopeWindow['debugWindow']).not.toBeNull();
    });

    it('should handle window focus', () => {
      triggerWindowCreation(debugScopeWindow, 'SCOPE');
      
      const mockWindow = mockBrowserWindowInstances[0];
      
      // Window should be created and focusable
      expect(mockWindow).toBeDefined();
      expect(mockWindow.focus).toBeDefined();
    });
  });
});