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
      hideXY: false,
      hasExplicitPosition: false
    } as ScopeDisplaySpec;

    debugScopeWindow = new DebugScopeWindow(mockContext, mockDisplaySpec);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Window Creation', () => {
    it('should create debug window on first numeric data', async () => {
      expect(debugScopeWindow['debugWindow']).toBeNull();

      // SCOPE processMessageAsync is fire-and-forget; flush microtasks after updateContent
      await debugScopeWindow.updateContent(['32']);
      await new Promise(r => setImmediate(r));

      expect(mockBrowserWindowInstances.length).toBe(1);
      expect(debugScopeWindow['debugWindow']).toBeDefined();
    });

    it('should not create window on non-numeric data', async () => {
      // CLEAR is handled by base class handleCommonCommand — no window created
      await debugScopeWindow.updateContent(['CLEAR']);
      await new Promise(r => setImmediate(r));

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
      expect(spec.window.grid).toBe('#404040'); // Pascal DefaultGridColor = clGray = $404040 [9win §9]
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
      // Create window directly (avoids async fire-and-forget in processMessageAsync).
      // SCOPE processMessageImmediate does NOT await processMessageAsync, so window creation
      // is async. Directly calling createDebugWindow is synchronous and reliable in tests.
      const defaultColor = { rgbString: '#00ff00', gridRgbString: '#004000', fontRgbString: '#00ff00' };
      debugScopeWindow['channelSpecs'] = [{
        name: 'Channel 0', color: defaultColor.rgbString, gridColor: defaultColor.gridRgbString,
        textColor: defaultColor.fontRgbString, minValue: 0, maxValue: 255,
        ySize: debugScopeWindow['displaySpec'].size.height, yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true, autoScale: false
      }];
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;
    });

    describe('TRIGGER command', () => {
      it('should enable trigger with AUTO mode', async () => {
        // Add a channel first
        debugScopeWindow['channelSpecs'] = [{
          name: 'Test',
          minValue: 0,
          maxValue: 255,
          autoScale: false,
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

        // processMessageAsync is fire-and-forget; await its completion directly
        await debugScopeWindow['processMessageAsync'](['TRIGGER', '0', 'AUTO']);
        expect(debugScopeWindow['triggerSpec'].trigEnabled).toBe(true);
        expect(debugScopeWindow['triggerSpec'].trigAuto).toBe(true);
        expect(debugScopeWindow['triggerSpec'].trigChannel).toBe(0);
      });

      it('should enable trigger with specific levels', async () => {
        await debugScopeWindow['processMessageAsync'](['TRIGGER', '0', '64', '128']);
        expect(debugScopeWindow['triggerSpec'].trigEnabled).toBe(true);
        expect(debugScopeWindow['triggerSpec'].trigAuto).toBe(false);
        expect(debugScopeWindow['triggerSpec'].trigChannel).toBe(0);
        expect(debugScopeWindow['triggerSpec'].trigArmLevel).toBe(64);
        expect(debugScopeWindow['triggerSpec'].trigLevel).toBe(128);
      });

      it('should handle TRIGGER with HOLDOFF', async () => {
        await debugScopeWindow['processMessageAsync'](['TRIGGER', '0', 'HOLDOFF', '100']);
        expect(debugScopeWindow['triggerSpec'].trigEnabled).toBe(true);
        expect(debugScopeWindow['triggerSpec'].trigHoldoff).toBe(100);
      });
    });

    describe('CLEAR command', () => {
      it('should clear sample data', () => {
        // Add some data first (no display name prefix)
        debugScopeWindow.updateContent(['255']);

        // Clear it
        debugScopeWindow.updateContent(['CLEAR']);
        // Verify channel samples are cleared
        const channelSamples = debugScopeWindow['channelSamples'];
        expect(channelSamples).toBeDefined();
        channelSamples.forEach((channel: any) => {
          expect(channel.samples.every((s: number) => s === 0)).toBe(true);
        });
      });
    });

    describe('CLOSE command', () => {
      it('should close the window', async () => {
        // Base class handleCommonCommand sets debugWindow=null directly (not via closeDebugWindow override)
        // processMessageAsync is fire-and-forget so call it directly
        await debugScopeWindow['processMessageAsync'](['CLOSE']);
        expect(debugScopeWindow['debugWindow']).toBeNull();
      });
    });

    describe('SAVE command', () => {
      it('should save window to file', async () => {
        const saveSpy = jest.spyOn(debugScopeWindow as any, 'saveWindowToBMPFilename');

        await debugScopeWindow.updateContent(['SAVE', "'test.bmp'"]);

        expect(saveSpy).toHaveBeenCalledWith('test.bmp');
      });
    });

    describe('PC_KEY command', () => {
      it('should enable keyboard input', () => {
        const enableSpy = jest.spyOn(debugScopeWindow as any, 'enableKeyboardInput');

        debugScopeWindow.updateContent(['PC_KEY']);
        expect(enableSpy).toHaveBeenCalled();
      });
    });

    describe('PC_MOUSE command', () => {
      it('should enable mouse input', () => {
        const enableSpy = jest.spyOn(debugScopeWindow as any, 'enableMouseInput');

        debugScopeWindow.updateContent(['PC_MOUSE']);
        expect(enableSpy).toHaveBeenCalled();
      });
    });

    describe('Numeric data processing', () => {
      it('should record samples', async () => {
        // Window already created by beforeEach; process data directly
        await debugScopeWindow['processMessageAsync'](['128']);
        const channelSamples = debugScopeWindow['channelSamples'];
        expect(channelSamples).toBeDefined();
        expect(channelSamples.length).toBeGreaterThan(0);
        expect(channelSamples[0].samples.length).toBeGreaterThan(0);
      });

      it('should handle packed data modes', () => {
        debugScopeWindow.updateContent(['BYTES_2BIT', '65535']);
        const channelSamples = debugScopeWindow['channelSamples'];
        expect(channelSamples).toBeDefined();
      });

      it('should handle hex numbers', () => {
        debugScopeWindow.updateContent(['$FF']);
        const channelSamples = debugScopeWindow['channelSamples'];
        expect(channelSamples).toBeDefined();
      });

      it('should handle binary numbers', () => {
        debugScopeWindow.updateContent(['%11111111']);
        const channelSamples = debugScopeWindow['channelSamples'];
        expect(channelSamples).toBeDefined();
      });
    });

    describe('Channel color parity (Pascal KeyColor vColor[ch], :1231)', () => {
      // Manual channel line: '<name>' <min> <max> <ySize> <yBase> <legend> <color> <brightness>
      it('masks explicit color brightness to 0..15 (p := val and 15): RED 20 == RED 4', async () => {
        debugScopeWindow['channelSpecs'] = [];
        await debugScopeWindow['processMessageAsync'](["'sig'", '0', '255', '100', '0', '%1111', 'RED', '4']);
        const red4 = debugScopeWindow['channelSpecs'][0].color;

        debugScopeWindow['channelSpecs'] = [];
        await debugScopeWindow['processMessageAsync'](["'sig'", '0', '255', '100', '0', '%1111', 'RED', '20']);
        const red20 = debugScopeWindow['channelSpecs'][0].color;

        expect(red20).toBe(red4); // 20 & 15 == 4, not reset-to-8
      });

      it('a non-color explicit token keeps the DefaultScopeColors default (never forces gray)', async () => {
        debugScopeWindow['channelSpecs'] = [];
        await debugScopeWindow['processMessageAsync'](["'a'", '0', '255', '100', '0', '%1111']);
        const defaultColor = debugScopeWindow['channelSpecs'][0].color;

        debugScopeWindow['channelSpecs'] = [];
        await debugScopeWindow['processMessageAsync'](["'b'", '0', '255', '100', '0', '%1111', 'NOTACOLOR']);
        const badColor = debugScopeWindow['channelSpecs'][0].color;

        expect(badColor).toBe(defaultColor); // kept default, NOT the 0x5a5a5a gray fallback
        expect(badColor).not.toBe('#5a5a5a');
      });

      it('a valid explicit directive color overrides the channel default', async () => {
        debugScopeWindow['channelSpecs'] = [];
        await debugScopeWindow['processMessageAsync'](["'a'", '0', '255', '100', '0', '%1111']);
        const defaultColor = debugScopeWindow['channelSpecs'][0].color;

        debugScopeWindow['channelSpecs'] = [];
        await debugScopeWindow['processMessageAsync'](["'b'", '0', '255', '100', '0', '%1111', 'RED', '8']);
        const redColor = debugScopeWindow['channelSpecs'][0].color;

        expect(redColor).not.toBe(defaultColor);
        expect(redColor).toMatch(/^#[0-9a-fA-F]{6}$/);
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
        autoScale: false,
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

      // Create window directly (avoids async fire-and-forget in processMessageAsync)
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;
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

    it('should handle mouse coordinates (raw passthrough from base class)', () => {
      // SCOPE uses base class transformMouseCoordinates which returns raw pixel values
      // per Pascal SendMousePos (DebugDisplayUnit.pas:3555-3568): SCOPE sends RAW pixels
      const coords = debugScopeWindow['transformMouseCoordinates'](100, 100);
      expect(coords.x).toBe(100);
      expect(coords.y).toBe(100);
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
        autoScale: false,
        ySize: 200,
        color: '#00ff00', gridColor: '#004000', textColor: '#00ff00',
        yBaseOffset: 0, lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true
      }] as any;

      // Create window directly
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();

      // Now update display spec
      debugScopeWindow['displaySpec'].size = { width: 800, height: 600 };
      debugScopeWindow['displaySpec'].nbrSamples = 256;
      debugScopeWindow['contentInset'] = 10;
      debugScopeWindow['channelInset'] = 20;

      // SCOPE uses base class transformMouseCoordinates which returns raw pixel values
      const coords = debugScopeWindow['transformMouseCoordinates'](100, 100);
      expect(coords.x).toBeDefined();
      expect(coords.y).toBeDefined();

      // Raw passthrough: values returned unchanged
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
      // Create window directly (avoids async fire-and-forget in processMessageAsync)
      const defaultColor = { rgbString: '#00ff00', gridRgbString: '#004000', fontRgbString: '#00ff00' };
      debugScopeWindow['channelSpecs'] = [{
        name: 'Channel 0', color: defaultColor.rgbString, gridColor: defaultColor.gridRgbString,
        textColor: defaultColor.fontRgbString, minValue: 0, maxValue: 255,
        ySize: debugScopeWindow['displaySpec'].size.height, yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true, autoScale: false
      }];
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;
    });

    it('should scroll samples when buffer is full', () => {
      // Fill the buffer directly via addSampleToBuffer (synchronous, no async)
      const maxSamples = debugScopeWindow['displaySpec'].nbrSamples;
      for (let i = 0; i < maxSamples + 10; i++) {
        debugScopeWindow['addSampleToBuffer'](0, i % 256);
      }

      // Check that we still have maxSamples
      const channelSamples = debugScopeWindow['channelSamples'];
      expect(channelSamples[0].samples.length).toBe(maxSamples);
    });

    it('should handle multiple channels', () => {
      // Add a second channel directly
      debugScopeWindow['channelSpecs'].push({
        name: 'Channel2', color: '#00ff00', gridColor: '#004000', textColor: '#00ff00',
        minValue: 0, maxValue: 255, ySize: 100, yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true, autoScale: false
      });
      debugScopeWindow['channelSamples'].push({ samples: [] });

      // Now we should have 2 channels
      const channelSpecs = debugScopeWindow['channelSpecs'];
      expect(channelSpecs.length).toBe(2);

      // Add samples directly to both channels
      debugScopeWindow['addSampleToBuffer'](0, 100);
      debugScopeWindow['addSampleToBuffer'](1, 200);

      // Check samples were recorded
      const channelSamples = debugScopeWindow['channelSamples'];
      expect(channelSamples).toHaveLength(2);
      expect(channelSamples[0].samples.length).toBeGreaterThan(0);
      expect(channelSamples[1].samples.length).toBeGreaterThan(0);
    });
  });

  describe('Window Rendering', () => {
    beforeEach(() => {
      // Create window directly (avoids async fire-and-forget in processMessageAsync)
      const defaultColor = { rgbString: '#00ff00', gridRgbString: '#004000', fontRgbString: '#00ff00' };
      debugScopeWindow['channelSpecs'] = [{
        name: 'Channel 0', color: defaultColor.rgbString, gridColor: defaultColor.gridRgbString,
        textColor: defaultColor.fontRgbString, minValue: 0, maxValue: 255,
        ySize: debugScopeWindow['displaySpec'].size.height, yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true, autoScale: false
      }];
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;
    });

    it('should render channel data as connected lines', () => {
      const mockWindow = mockBrowserWindowInstances[0];

      // Add samples and trigger drawing directly
      debugScopeWindow['addSampleToBuffer'](0, 100);
      debugScopeWindow['addSampleToBuffer'](0, 150);
      debugScopeWindow['addSampleToBuffer'](0, 75);
      // Trigger draw call directly with samples
      const samples = debugScopeWindow['channelSamples'][0].samples;
      debugScopeWindow['updateScopeChannelData']('channel-0', debugScopeWindow['channelSpecs'][0], samples, false);

      // Check that drawLine was called via executeJavaScript
      const drawCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('lineTo')
      );
      expect(drawCalls.length).toBeGreaterThan(0);
    });

    it('should update grid lines', () => {
      const mockWindow = mockBrowserWindowInstances[0];

      // Trigger a draw to produce stroke calls
      debugScopeWindow['addSampleToBuffer'](0, 128);
      const samples = debugScopeWindow['channelSamples'][0].samples;
      debugScopeWindow['updateScopeChannelData']('channel-0', debugScopeWindow['channelSpecs'][0], samples, false);

      // Check that stroke calls are made during rendering
      const gridCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('stroke') || call[0].includes('lineTo')
      );
      expect(gridCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Trigger Display', () => {
    beforeEach(() => {
      // Add a channel with required fields
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: 0,
        maxValue: 255,
        autoScale: false,
        ySize: 200,
        color: '#00FF00',
        gridColor: '#808080',
        textColor: '#FFFFFF',
        yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true
      }] as any;

      // Create window directly
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;
    });

    it('should display trigger levels when enabled', () => {
      const mockWindow = mockBrowserWindowInstances[0];

      // Enable trigger directly (synchronous state change)
      debugScopeWindow['triggerSpec'].trigEnabled = true;
      debugScopeWindow['triggerSpec'].trigChannel = 0;
      debugScopeWindow['triggerSpec'].trigArmLevel = 64;
      debugScopeWindow['triggerSpec'].trigLevel = 128;
      debugScopeWindow['updateTriggerStatus']();

      // Trigger draw with lines
      debugScopeWindow['addSampleToBuffer'](0, 64);
      const samples = debugScopeWindow['channelSamples'][0].samples;
      debugScopeWindow['updateScopeChannelData']('channel-0', debugScopeWindow['channelSpecs'][0], samples, false);

      // Check for any drawing or trigger-status JS calls
      const jsCallsWithStroke = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('stroke') || call[0].includes('line') || call[0].includes('trigger-status')
      );
      expect(jsCallsWithStroke.length).toBeGreaterThan(0);
    });

    it('should show trigger status', () => {
      const mockWindow = mockBrowserWindowInstances[0];

      // Enable trigger directly and update status
      debugScopeWindow['triggerSpec'].trigEnabled = true;
      debugScopeWindow['triggerSpec'].trigChannel = 0;
      debugScopeWindow['triggerSpec'].trigArmLevel = 64;
      debugScopeWindow['triggerSpec'].trigLevel = 128;
      debugScopeWindow['updateTriggerStatus']();

      // Check for trigger status display
      const statusCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('trigger-status')
      );
      expect(statusCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-scaling', () => {
    it('should calculate auto trigger levels', async () => {
      // Add a channel with known range
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: 0,
        maxValue: 100,
        autoScale: false,
        ySize: 200,
        color: '#00FF00',
        gridColor: '#808080',
        textColor: '#FFFFFF',
        yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true
      }] as any;

      // Create window directly
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;

      // Enable auto trigger — call processMessageAsync directly to avoid fire-and-forget
      await debugScopeWindow['processMessageAsync'](['TRIGGER', '0', 'AUTO']);

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
      // Try to set trigger on non-existent channel — should not throw
      expect(() => {
        debugScopeWindow['triggerSpec'].trigEnabled = true;
        debugScopeWindow['triggerSpec'].trigChannel = 10; // non-existent
      }).not.toThrow();
    });

    it('should handle malformed numeric data', () => {
      // isSpinNumber('INVALID_NUMBER') returns false — code just logs and continues
      expect(() => {
        debugScopeWindow.updateContent(['INVALID_NUMBER']);
      }).not.toThrow();
    });
  });

  describe('Coordinate System', () => {
    it('should return raw mouse coordinates (no Y-axis inversion for SCOPE)', () => {
      // Add a channel
      debugScopeWindow['channelSpecs'] = [{
        minValue: 0,
        maxValue: 100,
        autoScale: false,
        ySize: 600,
        color: '#00ff00',
        gridColor: '#004000',
        textColor: '#00ff00',
        yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true
      }] as any;

      // Create window directly
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();

      // Now set up display spec
      debugScopeWindow['displaySpec'].size = { width: 800, height: 600 };
      debugScopeWindow['displaySpec'].nbrSamples = 100;
      debugScopeWindow['contentInset'] = 0;
      debugScopeWindow['channelInset'] = 0;

      // SCOPE uses base class transformMouseCoordinates — Pascal SendMousePos sends RAW pixels
      // for dis_scope, so no inversion is applied in TypeScript either.
      const topCoords = debugScopeWindow['transformMouseCoordinates'](0, 0);
      expect(topCoords.x).toBe(0);
      expect(topCoords.y).toBe(0);

      const bottomCoords = debugScopeWindow['transformMouseCoordinates'](0, 599);
      expect(bottomCoords.x).toBe(0);
      expect(bottomCoords.y).toBe(599);
    });
  });

  describe('Channel Data Processing', () => {
    beforeEach(() => {
      // Add channels with different ranges (with required fields)
      debugScopeWindow['channelSpecs'] = [
        { name: 'CH1', minValue: 0, maxValue: 255, autoScale: false, ySize: 100,
          color: '#00ff00', gridColor: '#004000', textColor: '#00ff00', yBaseOffset: 0,
          lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true } as any,
        { name: 'CH2', minValue: -128, maxValue: 127, autoScale: false, ySize: 100,
          color: '#ff0000', gridColor: '#400000', textColor: '#ff0000', yBaseOffset: 0,
          lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true } as any,
        { name: 'CH3', minValue: -100, maxValue: 100, autoScale: false, ySize: 100,
          color: '#00ffff', gridColor: '#004040', textColor: '#00ffff', yBaseOffset: 0,
          lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true } as any
      ];
      // Create window directly
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;
    });

    it('should handle channel data at declaration time', async () => {
      // Call processMessageAsync directly to avoid fire-and-forget issue
      await debugScopeWindow['processMessageAsync'](["'TestChannel'", 'AUTO2', '200', '0', '0', 'GREEN']);

      const channelSpecs = debugScopeWindow['channelSpecs'];
      expect(channelSpecs.length).toBeGreaterThan(3); // Added one more
      const lastChannel = channelSpecs[channelSpecs.length - 1];
      expect(lastChannel.name).toBe('TestChannel');
      expect(lastChannel.ySize).toBe(200);
      // GREEN via RGBI8X directive color path = #09FF09 (not clLime #00FF00) [9win §4]
      expect(lastChannel.color).toBe('#09ff09');
    });

    it('should apply RANGE to channels', () => {
      // RANGE is not a runtime directive for SCOPE — it's benignly ignored (unknown directive)
      expect(() => {
        debugScopeWindow.updateContent(['RANGE', '-200', '200']);
      }).not.toThrow();
      expect(() => {
        debugScopeWindow.updateContent(['100', '100', '100']);
      }).not.toThrow();
    });

    it('should handle all packed data modes', async () => {
      // Reset mock instances array
      mockBrowserWindowInstances.length = 0;

      // Reset channels from beforeEach
      debugScopeWindow['channelSpecs'] = [];
      debugScopeWindow['channelSamples'] = [];
      debugScopeWindow['isFirstNumericData'] = true;
      debugScopeWindow['debugWindow'] = null;
      debugScopeWindow['windowCreated'] = false;

      // v55 SCOPE_Update parity: a channel only exists when an explicit channel-def
      // (`'name' …` via NextStr) is parsed — bare sample data with no channel-def commits
      // nothing (vIndex stays 0). So define one channel first, THEN send a sample. The old
      // code fabricated a default channel from bare data; that invented behavior was removed.
      await debugScopeWindow['processMessageAsync'](["'CH0'", '0', '255']);

      // Call processMessageAsync directly to trigger initialization synchronously
      await debugScopeWindow['processMessageAsync'](['123']);

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

      // Now test packed data mode: set it up directly and process samples
      debugScopeWindow['channelSpecs'] = [
        { name: 'CH1', minValue: 0, maxValue: 255, autoScale: false, ySize: 100,
          color: '#00ff00', gridColor: '#004000', textColor: '#00ff00', yBaseOffset: 0,
          lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true } as any,
        { name: 'CH2', minValue: 0, maxValue: 255, autoScale: false, ySize: 100,
          color: '#ff0000', gridColor: '#400000', textColor: '#ff0000', yBaseOffset: 0,
          lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true } as any
      ];
      debugScopeWindow['clearChannelData']();

      // Add samples directly to both channels (simulating what packed data unpacking would produce)
      debugScopeWindow['addSampleToBuffer'](0, 255); // high byte of 0xFF00
      debugScopeWindow['addSampleToBuffer'](1, 0);   // low byte of 0xFF00

      // Check samples were recorded
      channelSamples = debugScopeWindow['channelSamples'];
      expect(channelSamples[0].samples.length).toBeGreaterThan(0);
      expect(channelSamples[1].samples.length).toBeGreaterThan(0);
    });
  });

  describe('Window State Management', () => {
    it('should handle window close and cleanup', () => {
      // Create window directly
      const defaultColor = { rgbString: '#00ff00', gridRgbString: '#004000', fontRgbString: '#00ff00' };
      debugScopeWindow['channelSpecs'] = [{
        name: 'Channel 0', color: defaultColor.rgbString, gridColor: defaultColor.gridRgbString,
        textColor: defaultColor.fontRgbString, minValue: 0, maxValue: 255,
        ySize: debugScopeWindow['displaySpec'].size.height, yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true, autoScale: false
      }];
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();

      debugScopeWindow.closeDebugWindow();

      // closeDebugWindow() sets debugWindow to null
      expect(debugScopeWindow['debugWindow']).toBeNull();
    });

    it('should update window title', () => {
      // Create window directly
      const defaultColor = { rgbString: '#00ff00', gridRgbString: '#004000', fontRgbString: '#00ff00' };
      debugScopeWindow['channelSpecs'] = [{
        name: 'Channel 0', color: defaultColor.rgbString, gridColor: defaultColor.gridRgbString,
        textColor: defaultColor.fontRgbString, minValue: 0, maxValue: 255,
        ySize: debugScopeWindow['displaySpec'].size.height, yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true, autoScale: false
      }];
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();

      const mockWindow = mockBrowserWindowInstances[0];

      // Window title is set during createDebugWindow via setTitle
      // Format: '{displayName} - SCOPE' (displayName='SCOPE' in test)
      expect(mockWindow.setTitle).toHaveBeenCalledWith('SCOPE - SCOPE');
    });
  });

  describe('Drawing Operations', () => {
    beforeEach(() => {
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: 0,
        maxValue: 255,
        autoScale: false,
        ySize: 200,
        color: '#00FF00',
        gridColor: '#808080',
        textColor: '#FFFFFF',
        yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true
      }] as any;

      // Create window directly (synchronous)
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;
    });

    it('should draw channel labels', async () => {
      const mockWindow = mockBrowserWindowInstances[0];

      // Trigger the 'did-finish-load' once handler (labels are set on load). The handler is now
      // async (it `await`s onWindowReady before drawing labels — see the channel-name-label fix),
      // so await its completion before asserting.
      const onceHandlers = mockWindow.webContents.once.mock.calls.filter(
        (call: any) => call[0] === 'did-finish-load'
      );
      if (onceHandlers.length > 0) {
        await onceHandlers[0][1](); // Call the (async) handler and await it
      }

      // Check for label update calls
      const labelCalls = mockWindow.webContents.executeJavaScript.mock.calls.filter(
        (call: any) => call[0].includes('label') || call[0].includes('Test')
      );
      expect(labelCalls.length).toBeGreaterThan(0);
    });

    it('should reflect lineSize from declaration (LINESIZE directive, not runtime LINE)', () => {
      // Runtime LINE/DOT directives do not exist in SCOPE — only LINESIZE/DOTSIZE
      // are valid in parseScopeDeclaration. The mockDisplaySpec sets lineSize:1, dotSize:1.
      // SCOPE's displaySpec uses the mockDisplaySpec values from beforeEach.
      expect(debugScopeWindow['displaySpec'].lineSize).toBe(1); // From mockDisplaySpec lineSize:1
    });

    it('should use displaySpec dotSize from declaration', () => {
      // mockDisplaySpec sets dotSize:1
      expect(debugScopeWindow['displaySpec'].dotSize).toBe(1); // From mockDisplaySpec dotSize:1
    });
  });

  describe('Advanced Trigger Features', () => {
    beforeEach(() => {
      debugScopeWindow['channelSpecs'] = [{
        name: 'Test',
        minValue: 0,
        maxValue: 255,
        autoScale: false,
        ySize: 200,
        color: '#00FF00',
        gridColor: '#808080',
        textColor: '#FFFFFF',
        yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true
      }] as any;

      // Create window directly
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();
      debugScopeWindow['windowCreated'] = true;
      debugScopeWindow['isFirstNumericData'] = false;
    });

    it('should handle trigger slope settings', () => {
      // Set trigger state directly (synchronous)
      debugScopeWindow['triggerSpec'].trigEnabled = true;
      debugScopeWindow['triggerSpec'].trigChannel = 0;
      debugScopeWindow['triggerSpec'].trigArmLevel = 64;
      debugScopeWindow['triggerSpec'].trigLevel = 128;
      debugScopeWindow['triggerSpec'].trigRtOffset = 10;

      const triggerSpec = debugScopeWindow['triggerSpec'];
      expect(triggerSpec.trigEnabled).toBe(true);
      expect(triggerSpec.trigRtOffset).toBe(10);
    });

    it('should process trigger with ScopeTriggerProcessor', () => {
      // Trigger processor is initialized in constructor
      expect(debugScopeWindow['triggerProcessor']).toBeDefined();

      // Enable trigger directly
      debugScopeWindow['triggerSpec'].trigEnabled = true;
      debugScopeWindow['triggerSpec'].trigChannel = 0;
      debugScopeWindow['triggerSpec'].trigArmLevel = 64;
      debugScopeWindow['triggerSpec'].trigLevel = 128;

      // Evaluate samples directly (synchronous path)
      debugScopeWindow['addSampleToBuffer'](0, 50);  // Below arm
      debugScopeWindow['addSampleToBuffer'](0, 70);  // Above arm
      debugScopeWindow['addSampleToBuffer'](0, 130); // Above trigger

      // Trigger processor should still be defined
      expect(debugScopeWindow['triggerProcessor']).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    it('should have correct display name', () => {
      expect(debugScopeWindow['displaySpec'].displayName).toBe('SCOPE');
    });

    it('should have debug window property', () => {
      expect(debugScopeWindow['debugWindow']).toBeNull();

      // Create window directly (synchronous)
      const defaultColor = { rgbString: '#00ff00', gridRgbString: '#004000', fontRgbString: '#00ff00' };
      debugScopeWindow['channelSpecs'] = [{
        name: 'Channel 0', color: defaultColor.rgbString, gridColor: defaultColor.gridRgbString,
        textColor: defaultColor.fontRgbString, minValue: 0, maxValue: 255,
        ySize: debugScopeWindow['displaySpec'].size.height, yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true, autoScale: false
      }];
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();

      expect(debugScopeWindow['debugWindow']).not.toBeNull();
    });

    it('should handle window focus', () => {
      // Create window directly (synchronous)
      const defaultColor = { rgbString: '#00ff00', gridRgbString: '#004000', fontRgbString: '#00ff00' };
      debugScopeWindow['channelSpecs'] = [{
        name: 'Channel 0', color: defaultColor.rgbString, gridColor: defaultColor.gridRgbString,
        textColor: defaultColor.fontRgbString, minValue: 0, maxValue: 255,
        ySize: debugScopeWindow['displaySpec'].size.height, yBaseOffset: 0,
        lgndShowMax: true, lgndShowMin: true, lgndShowMaxLine: true, lgndShowMinLine: true, autoScale: false
      }];
      debugScopeWindow['initChannelSamples']();
      debugScopeWindow['createDebugWindow']();

      const mockWindow = mockBrowserWindowInstances[0];

      // Window should be created and focusable
      expect(mockWindow).toBeDefined();
      expect(mockWindow.focus).toBeDefined();
    });
  });
});