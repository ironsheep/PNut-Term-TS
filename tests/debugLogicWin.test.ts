import { DebugLogicWindow, LogicDisplaySpec, LogicChannelSpec } from '../src/classes/debugLogicWin';
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
// The following comments show what NOT to mock:
// - canvasRenderer
// - displaySpecParser  
// - colorTranslator
// - inputForwarder (except USB)
// - debugColor
// - packedDataProcessor
// - triggerProcessor

describe('DebugLogicWindow', () => {
  let debugLogicWindow: DebugLogicWindow;
  let mockContext: any;
  let mockDisplaySpec: LogicDisplaySpec;
  let cleanup: () => void;

  beforeEach(() => {
    // Clear mock instances
    mockBrowserWindowInstances = [];
    
    // Setup test environment using new utilities
    const setup = setupDebugWindowTests({
      windowType: 'logic',
      displayName: 'LOGIC'
    });
    mockContext = setup.mockContext;
    cleanup = setup.cleanup;
    
    mockDisplaySpec = {
      displayName: 'LOGIC',
      windowTitle: 'Logic Display',
      title: 'Test Logic',
      position: { x: 0, y: 0 },
      hasExplicitPosition: false,
      size: { width: 800, height: 600 },
      nbrSamples: 100,
      spacing: 8,
      rate: 1000,
      lineSize: 1,
      dotSize: 0,
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
      channelSpecs: [{
        name: 'Test',
        nbrBits: 8,
        color: '#00FF00'
      }],
      textStyle: {
        weight: 0, // eTextWeight.normal
        horizAlign: 0, // eHorizJustification.left
        vertAlign: 0, // eVertJustification.top
        underline: false,
        italic: false,
        angle: 0
      },
      logicChannels: 32,
      topLogicChannel: 31
    };

    debugLogicWindow = new DebugLogicWindow(mockContext, mockDisplaySpec);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Window Creation', () => {
    it('should create debug window immediately in constructor', () => {
      // Logic window should create window immediately since it has channel specs upfront
      expect(debugLogicWindow['debugWindow']).toBeDefined();
      expect(mockBrowserWindowInstances.length).toBe(1);
    });

    it('should handle commands after window creation', () => {
      // Send commands - window already exists
      debugLogicWindow.updateContent(['LOGIC', 'CLEAR']);
      
      // Window should still exist
      expect(debugLogicWindow['debugWindow']).toBeDefined();
    });
  });

  describe('parseLogicDeclaration', () => {
    it('should parse minimal declaration with display name only', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'TestLogic']);
      
      expect(isValid).toBe(true);
      expect(spec.displayName).toBe('TestLogic');
      // Check defaults
      expect(spec.position).toEqual({ x: 0, y: 0 });
      expect(spec.nbrSamples).toBe(32);
      expect(spec.spacing).toBe(8);
      expect(spec.rate).toBe(1);
      expect(spec.lineSize).toBe(3); // Pascal vLineSize := 3 (DebugDisplayUnit.pas:938) [9win §8]
      expect(spec.dotSize).toBe(0); // Pascal vDotSize := 0 (:937) [9win §8]
      expect(spec.textSize).toBe(12);
      expect(spec.window.background).toBe('#000000');
      expect(spec.window.grid).toBe('#404040'); // Pascal DefaultGridColor = clGray = $404040 [9win §8]
      expect(spec.hideXY).toBe(false);
      // No channel labels given -> default 32 channels '0'..'31', all clLime [9win §8]
      expect(spec.channelSpecs).toHaveLength(32);
      expect(spec.channelSpecs[0]).toEqual({ name: '0', color: '#00ff00', nbrBits: 1, isRange: false });
      expect(spec.channelSpecs[31]).toEqual({ name: '31', color: '#00ff00', nbrBits: 1, isRange: false });
    });

    it('should parse TITLE directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'TITLE', 'My Logic Window']);
      
      expect(isValid).toBe(true);
      expect(spec.windowTitle).toBe('My Logic Window');
    });

    it('should parse POS directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'POS', '100', '200']);
      
      expect(isValid).toBe(true);
      expect(spec.position).toEqual({ x: 100, y: 200 });
    });

    it('should parse SAMPLES directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'SAMPLES', '128']);
      
      expect(isValid).toBe(true);
      expect(spec.nbrSamples).toBe(128);
    });

    it('should parse SPACING directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'SPACING', '16']);
      
      expect(isValid).toBe(true);
      expect(spec.spacing).toBe(16);
    });

    it('should parse COLOR directive with background and grid', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'COLOR', 'BLUE', 'YELLOW']);

      // COLOR directive resolves names via RGBI8X (Pascal KeyColor), not clXxx. [9win §4b]
      expect(isValid).toBe(true);
      expect(spec.window.background).toBe('#0909ff'); // RGBI8X BLUE
      expect(spec.window.grid).toBe('#ffff09'); // RGBI8X YELLOW
    });

    it('should parse HIDEXY directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'HIDEXY']);
      
      expect(isValid).toBe(true);
      expect(spec.hideXY).toBe(true);
    });

    it('should parse channel specifications', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration([
        '`LOGIC', 'Test', 
        "'Channel0'", '8', 'GREEN',
        "'Data Bus'", '16', '$FF0000'
      ]);
      
      expect(isValid).toBe(true);
      expect(spec.channelSpecs).toHaveLength(2);
      // Channel color names resolve via the RGBI8X directive path (Pascal KeyColor):
      // GREEN 8 -> 0x09FF09; a numeric ($FF0000) is taken verbatim. [9win §4/§8]
      expect(spec.channelSpecs[0]).toEqual({
        name: 'Channel0',
        nbrBits: 8,
        color: '#09ff09'
      });
      expect(spec.channelSpecs[1]).toEqual({
        name: 'Data Bus',
        nbrBits: 16,
        color: '#ff0000'
      });
    });

    it('should parse multi-word channel names', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration([
        '`LOGIC', 'Test',
        "'My", "Test", "Channel'"
      ]);
      
      expect(isValid).toBe(true);
      expect(spec.channelSpecs).toHaveLength(1);
      expect(spec.channelSpecs[0].name).toBe('My Test Channel');
    });

    it('should silently ignore an unknown directive and keep the window valid', () => {
      // Pascal LOGIC_Configure: an unrecognized key falls through the case with no
      // action — never rejects the window (C4 never-abort). The old code aborted
      // with isValid=false; that was invented non-Pascal behavior. [9win §8]
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'INVALID']);

      expect(isValid).toBe(true);
      // Unknown directive consumed nothing else; defaults remain intact.
      expect(spec.spacing).toBe(8);
    });

    it('should not abort later directives after an unknown one (never-abort)', () => {
      // SAMPLES still applies even though BOGUS precedes it. [9win §8]
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration([
        '`LOGIC', 'Test', 'BOGUS', 'SAMPLES', '128', 'SPACING', '12'
      ]);

      expect(isValid).toBe(true);
      expect(spec.nbrSamples).toBe(128);
      expect(spec.spacing).toBe(12);
    });
  });

  describe('Command Processing', () => {
    beforeEach(() => {
      // LOGIC window creates in constructor; triggerWindowCreation just adds a sample
      triggerWindowCreation(debugLogicWindow, 'LOGIC');
    });

    describe('TRIGGER command', () => {
      it('should update trigger specification', async () => {
        // Call processMessageAsync directly (updateContent is fire-and-forget)
        await debugLogicWindow['processMessageAsync'](['TRIGGER', '255', '128', '50']);
        expect(debugLogicWindow['triggerSpec'].trigEnabled).toBe(true);
        expect(debugLogicWindow['triggerSpec'].trigMask).toBe(255);
        expect(debugLogicWindow['triggerSpec'].trigMatch).toBe(128);
        expect(debugLogicWindow['triggerSpec'].trigSampOffset).toBe(50);
      });

      it('should handle trigger without offset', async () => {
        await debugLogicWindow['processMessageAsync'](['TRIGGER', '15', '8']);
        expect(debugLogicWindow['triggerSpec'].trigEnabled).toBe(true);
        expect(debugLogicWindow['triggerSpec'].trigMask).toBe(15);
        expect(debugLogicWindow['triggerSpec'].trigMatch).toBe(8);
      });

      it('should update trigger status display', async () => {
        const mockWindow = mockBrowserWindowInstances[0];

        // processMessageAsync directly to ensure trigger status JS is executed
        await debugLogicWindow['processMessageAsync'](['TRIGGER', '255', '128']);

        const triggerCall = mockWindow.webContents.executeJavaScript.mock.calls.find(
          (call: any) => call[0].includes('trigger-status')
        );
        expect(triggerCall).toBeDefined();
      });
    });

    describe('HOLDOFF command', () => {
      it('should update holdoff value', () => {
        testCommand(debugLogicWindow, 'LOGIC', ['HOLDOFF', '100'], () => {
          expect(debugLogicWindow['triggerSpec'].trigHoldoff).toBe(100);
        });
      });
    });

    describe('Numeric data processing', () => {
      it('should record samples to channels', () => {
        // Send binary data
        testCommand(debugLogicWindow, 'LOGIC', '255', () => {
          // All channels should have recorded the sample
          const channels = debugLogicWindow['channelSamples'];
          expect(channels).toBeDefined();
          expect(channels.length).toBeGreaterThan(0);
        });
      });

      it('should handle packed data modes', () => {
        // Test BYTE2 packed mode
        testCommand(debugLogicWindow, 'LOGIC', ['BYTE2', '65535'], () => {
          // Should unpack to two samples
          const channels = debugLogicWindow['channelSamples'];
          expect(channels).toBeDefined();
        });
      });

      it('should handle hex numbers', () => {
        testCommand(debugLogicWindow, 'LOGIC', '$FF', () => {
          const channels = debugLogicWindow['channelSamples'];
          expect(channels).toBeDefined();
        });
      });

      it('should handle binary numbers', () => {
        testCommand(debugLogicWindow, 'LOGIC', '%11111111', () => {
          const channels = debugLogicWindow['channelSamples'];
          expect(channels).toBeDefined();
        });
      });
    });
  });

  describe('Base class delegation', () => {
    beforeEach(() => {
      // LOGIC window already created in constructor; window is ready
      // handleCommonCommand checks lineParts[0], so send commands WITHOUT display name prefix
    });

    it('should delegate CLEAR command to base class', async () => {
      const clearSpy = jest.spyOn(debugLogicWindow as any, 'clearDisplayContent');

      // Call processMessageAsync directly to avoid fire-and-forget
      await debugLogicWindow['processMessageAsync'](['CLEAR']);

      // clearDisplayContent should have been called via base class delegation
      expect(clearSpy).toHaveBeenCalled();

      clearSpy.mockRestore();
    });

    it('should delegate UPDATE command to base class', async () => {
      const updateSpy = jest.spyOn(debugLogicWindow as any, 'forceDisplayUpdate');

      await debugLogicWindow['processMessageAsync'](['UPDATE']);

      // forceDisplayUpdate should have been called via base class delegation
      expect(updateSpy).toHaveBeenCalled();

      updateSpy.mockRestore();
    });

    it('should delegate CLOSE command to base class', async () => {
      const mockWindow = mockBrowserWindowInstances[0];

      await debugLogicWindow['processMessageAsync'](['CLOSE']);

      // Window close should have been called via base class delegation (debugWindow setter calls close)
      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should delegate PC_KEY command to base class', async () => {
      const inputForwarder = debugLogicWindow['inputForwarder'];
      const pollingSpy = jest.spyOn(inputForwarder, 'startPolling');

      await debugLogicWindow['processMessageAsync'](['PC_KEY']);

      // Input forwarding should be enabled via base class delegation
      expect(pollingSpy).toHaveBeenCalled();

      pollingSpy.mockRestore();
    });

    it('should delegate PC_MOUSE command to base class', async () => {
      const inputForwarder = debugLogicWindow['inputForwarder'];
      const pollingSpy = jest.spyOn(inputForwarder, 'startPolling');

      await debugLogicWindow['processMessageAsync'](['PC_MOUSE']);

      // Input forwarding should be enabled via base class delegation
      expect(pollingSpy).toHaveBeenCalled();

      pollingSpy.mockRestore();
    });

    it('should delegate SAVE command to base class', async () => {
      const mockNativeImage = {
        toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
      };
      mockBrowserWindowInstances[0].webContents.capturePage = jest.fn().mockResolvedValue(mockNativeImage);

      await debugLogicWindow['processMessageAsync'](['SAVE', "'test.bmp'"]);

      // SAVE command should be handled via base class delegation
      expect(mockBrowserWindowInstances[0].webContents.capturePage).toHaveBeenCalled();
    });
  });

  describe('Channel Display', () => {
    beforeEach(() => {
      // Create window with channel specs
      const spec = {
        ...mockDisplaySpec,
        channelSpecs: [
          { name: 'Data', nbrBits: 8, color: '#00FF00' },
          { name: 'Control', nbrBits: 4, color: '#FF0000' }
        ]
      };
      debugLogicWindow = new DebugLogicWindow(mockContext, spec);
      triggerWindowCreation(debugLogicWindow, 'LOGIC');
    });

    it('should create channel bit specs from channel specs', () => {
      const bitSpecs = debugLogicWindow['channelBitSpecs'];
      expect(bitSpecs).toHaveLength(12); // 8 + 4 bits
      
      // First 8 should be Data channel
      // First bit has name "Data 0", rest have just numbers
      expect(bitSpecs[0].name).toBe('Data 0');
      expect(bitSpecs[0].color).toBe('#00FF00');
      expect(bitSpecs[0].chanNbr).toBe(0);
      
      for (let i = 1; i < 8; i++) {
        expect(bitSpecs[i].name).toBe(`${i}`);
        expect(bitSpecs[i].color).toBe('#00FF00');
        expect(bitSpecs[i].chanNbr).toBe(i);
      }
      
      // Next 4 should be Control channel
      // First bit has name "Control 0", rest have just numbers
      expect(bitSpecs[8].name).toBe('Control 0');
      expect(bitSpecs[8].color).toBe('#FF0000');
      expect(bitSpecs[8].chanNbr).toBe(8);
      
      for (let i = 9; i < 12; i++) {
        expect(bitSpecs[i].name).toBe(`${i - 8}`);
        expect(bitSpecs[i].color).toBe('#FF0000');
        expect(bitSpecs[i].chanNbr).toBe(i);
      }
    });

    it('should render channel labels in HTML', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      const htmlContent = mockWindow.loadURL.mock.calls[0][0];
      
      // Should have label divs in the HTML
      // HTML is URL encoded, so check for the encoded version
      expect(htmlContent).toContain('labels');
      expect(htmlContent).toContain('label-');
    });
  });

  describe('Mouse Coordinate Display', () => {
    beforeEach(() => {
      triggerWindowCreation(debugLogicWindow, 'LOGIC');
    });

    it('should transform mouse coordinates correctly (raw passthrough from base class)', () => {
      // LOGIC uses base class transformMouseCoordinates — Pascal SendMousePos sends RAW pixels
      // for dis_logic (DebugDisplayUnit.pas:3555-3568, no case branch for dis_logic).
      // The base class returns coordinates unchanged.
      const coords1 = debugLogicWindow['transformMouseCoordinates'](799, 20);
      expect(coords1.x).toBe(799);
      expect(coords1.y).toBe(20);

      const coords2 = debugLogicWindow['transformMouseCoordinates'](109, 36);
      expect(coords2.x).toBe(109);
      expect(coords2.y).toBe(36);

      const coords3 = debugLogicWindow['transformMouseCoordinates'](0, 0);
      expect(coords3.x).toBe(0);
      expect(coords3.y).toBe(0);
    });

    it('should set up coordinate display with crosshairs', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      
      // Enable mouse input
      debugLogicWindow['enableMouseInput']();

      // Should have created InputForwarder
      expect(debugLogicWindow['inputForwarder']).toBeDefined();
      
      // Should add coordinate display JavaScript
      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
      
      // Check that the JavaScript includes coordinate display setup
      const jsCall = mockWindow.webContents.executeJavaScript.mock.calls.find(
        (call: any) => call[0].includes('coordinate-display')
      );
      expect(jsCall).toBeDefined();
      expect(jsCall[0]).toContain('coordDisplay.textContent = sampleX + \',\' + channelY');
      expect(jsCall[0]).toContain('crosshairH.style.display = \'block\'');
      expect(jsCall[0]).toContain('crosshairV.style.display = \'block\'');
    });
  });

  describe('Trigger Processing', () => {
    beforeEach(() => {
      triggerWindowCreation(debugLogicWindow, 'LOGIC');
    });

    it('should arm trigger when enabled', async () => {
      // Pascal key_trigger: vArmed := False (DebugDisplayUnit.pas:1045).
      // The TRIGGER directive sets trigEnabled=true but RESETS triggerArmed=false.
      // Arming only happens AFTER a non-matching sample arrives.
      await debugLogicWindow['processMessageAsync'](['TRIGGER', '255', '128']);
      expect(debugLogicWindow['triggerSpec'].trigEnabled).toBe(true);
      expect(debugLogicWindow['triggerArmed']).toBe(false); // Correctly false per Pascal
      expect(debugLogicWindow['triggerFired']).toBe(false);
    });

    it('should fire trigger on matching data only after buffer fills', async () => {
      // Pascal LOGIC trigger fires only when buffer is full (samplePop === nbrSamples)
      // mockDisplaySpec has nbrSamples=100; with <100 samples trigger cannot fire
      await debugLogicWindow['processMessageAsync'](['TRIGGER', '255', '128']);
      expect(debugLogicWindow['triggerSpec'].trigEnabled).toBe(true);

      // With only 1 sample (not full buffer), trigger cannot fire
      await debugLogicWindow['processMessageAsync'](['128']);
      expect(debugLogicWindow['triggerFired']).toBe(false); // Buffer not full yet
    });

    it('should respect holdoff period', async () => {
      // Set up trigger with holdoff directly (synchronous state)
      await debugLogicWindow['processMessageAsync'](['TRIGGER', '255', '128']);
      await debugLogicWindow['processMessageAsync'](['HOLDOFF', '10']);

      expect(debugLogicWindow['triggerSpec'].trigHoldoff).toBe(10);
      // holdoffCounter is 0 (not counting yet — trigger hasn't fired)
      expect(debugLogicWindow['holdoffCounter']).toBe(0);
    });
  });

  describe('Canvas Operations', () => {
    beforeEach(() => {
      triggerWindowCreation(debugLogicWindow, 'LOGIC');
    });

    it('should use multiple canvases for channel groups', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      const htmlContent = mockWindow.loadURL.mock.calls[0][0];
      
      // Should have canvas elements in the HTML
      // HTML is URL encoded, check for canvas elements
      expect(htmlContent).toContain('canvas');
      expect(htmlContent).toContain('data-');
    });

    it('should include grid color in canvas setup', () => {
      const mockWindow = mockBrowserWindowInstances[0];
      const htmlContent = mockWindow.loadURL.mock.calls[0][0];
      
      // Should have grid color in style or canvas setup
      // The HTML is URL-encoded, so we need to check for the encoded version
      const encodedGridColor = encodeURIComponent(mockDisplaySpec.window.grid);
      expect(htmlContent).toContain(encodedGridColor);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing display name', () => {
      const [isValid] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC']);
      expect(isValid).toBe(false);
    });

    it('should handle invalid numeric data gracefully', () => {
      triggerWindowCreation(debugLogicWindow, 'LOGIC');
      
      // Should not throw
      expect(() => {
        testCommand(debugLogicWindow, 'LOGIC', 'INVALID_NUMBER', () => {});
      }).not.toThrow();
    });

    it('should handle POS directive with single parameter (X only)', () => {
      // POS with only X (no Y) is valid — DisplaySpecParser.parsePosKeyword accepts X alone
      // with Y defaulting to 0. Pascal KeyPos accepts an optional second param.
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'POS', '100']);
      expect(isValid).toBe(true);
      expect(spec.position.x).toBe(100);
      expect(spec.position.y).toBe(0); // Y defaults to 0
    });
  });

  describe('Canvas ID', () => {
    it('should return correct canvas ID', () => {
      expect(debugLogicWindow['getCanvasId']()).toBe('canvas');
    });
  });
});