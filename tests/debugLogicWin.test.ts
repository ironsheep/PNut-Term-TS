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
      size: { width: 800, height: 600 },
      nbrSamples: 100,
      spacing: 8,
      rate: 1000,
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
    it('should create debug window on first numeric data', () => {
      // Should not have window initially
      expect(debugLogicWindow['debugWindow']).toBeNull();
      
      // Send numeric data to trigger window creation
      triggerWindowCreation(debugLogicWindow, 'LOGIC');
      
      // Should have created window
      expect(mockBrowserWindowInstances.length).toBe(1);
      expect(debugLogicWindow['debugWindow']).toBeDefined();
    });

    it('should not create window on non-numeric data', () => {
      // Send non-numeric command
      debugLogicWindow.updateContent(['LOGIC', 'CLEAR']);
      
      // Should not have created window
      expect(mockBrowserWindowInstances.length).toBe(0);
      expect(debugLogicWindow['debugWindow']).toBeNull();
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
      expect(spec.lineSize).toBe(1);
      expect(spec.textSize).toBe(12);
      expect(spec.window.background).toBe('#000000');
      expect(spec.window.grid).toBe('#373737'); // GRAY 4
      expect(spec.hideXY).toBe(false);
    });

    it.skip('should parse TITLE directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'TITLE', 'My Logic Window']);
      
      expect(isValid).toBe(true);
      expect(spec.windowTitle).toBe('My Logic Window');
    });

    it.skip('should parse POS directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'POS', '100', '200']);
      
      expect(isValid).toBe(true);
      expect(spec.position).toEqual({ x: 100, y: 200 });
    });

    it.skip('should parse SAMPLES directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'SAMPLES', '128']);
      
      expect(isValid).toBe(true);
      expect(spec.nbrSamples).toBe(128);
    });

    it('should parse SPACING directive', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'SPACING', '16']);
      
      expect(isValid).toBe(true);
      expect(spec.spacing).toBe(16);
    });

    it.skip('should parse COLOR directive with background and grid', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'COLOR', 'BLUE', 'YELLOW']);
      
      expect(isValid).toBe(true);
      expect(spec.window.background).toBe('#0000ff');
      expect(spec.window.grid).toBe('#ffff00');
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
      expect(spec.channelSpecs[0]).toEqual({
        name: 'Channel0',
        nbrBits: 8,
        color: '#00ff00'
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

    it('should handle invalid directives', () => {
      const [isValid] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'INVALID']);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Command Processing', () => {
    beforeEach(() => {
      // Create window first
      triggerWindowCreation(debugLogicWindow, 'LOGIC');
    });

    describe('TRIGGER command', () => {
      it('should update trigger specification', () => {
        testCommand(debugLogicWindow, 'LOGIC', ['TRIGGER', '255', '128', '50'], () => {
          expect(debugLogicWindow['triggerSpec'].trigEnabled).toBe(true);
          expect(debugLogicWindow['triggerSpec'].trigMask).toBe(255);
          expect(debugLogicWindow['triggerSpec'].trigMatch).toBe(128);
          expect(debugLogicWindow['triggerSpec'].trigSampOffset).toBe(50);
        });
      });

      it('should handle trigger without offset', () => {
        testCommand(debugLogicWindow, 'LOGIC', ['TRIGGER', '15', '8'], () => {
          expect(debugLogicWindow['triggerSpec'].trigEnabled).toBe(true);
          expect(debugLogicWindow['triggerSpec'].trigMask).toBe(15);
          expect(debugLogicWindow['triggerSpec'].trigMatch).toBe(8);
        });
      });

      it('should update trigger status display', () => {
        const mockWindow = mockBrowserWindowInstances[0];
        const executeJsSpy = jest.spyOn(mockWindow.webContents, 'executeJavaScript');
        
        testCommand(debugLogicWindow, 'LOGIC', ['TRIGGER', '255', '128'], () => {
          const triggerCall = executeJsSpy.mock.calls.find(
            (call: any) => call[0].includes('trigger-status')
          );
          expect(triggerCall).toBeDefined();
        });
      });
    });

    describe('HOLDOFF command', () => {
      it('should update holdoff value', () => {
        testCommand(debugLogicWindow, 'LOGIC', ['HOLDOFF', '100'], () => {
          expect(debugLogicWindow['triggerSpec'].trigHoldoff).toBe(100);
        });
      });
    });

    describe('CLEAR command', () => {
      it('should clear channel data', () => {
        // Add some data first
        testCommand(debugLogicWindow, 'LOGIC', '255', () => {});
        
        // Clear it
        testCommand(debugLogicWindow, 'LOGIC', 'CLEAR', () => {
          // Verify channels are cleared
          const channels = debugLogicWindow['channelSamples'];
          channels.forEach((channel: any) => {
            expect(channel.samples.every((s: number) => s === 0)).toBe(true);
          });
        });
      });
    });

    describe('CLOSE command', () => {
      it('should close the window', () => {
        const closeSpy = jest.spyOn(debugLogicWindow, 'closeDebugWindow');
        
        testCommand(debugLogicWindow, 'LOGIC', 'CLOSE', () => {
          expect(closeSpy).toHaveBeenCalled();
        });
      });
    });

    describe('SAVE command', () => {
      it('should save window to file', async () => {
        const saveSpy = jest.spyOn(debugLogicWindow as any, 'saveWindowToBMPFilename');
        
        await debugLogicWindow.updateContent(['LOGIC', 'SAVE', "'test.bmp'"]);
        
        expect(saveSpy).toHaveBeenCalledWith('test.bmp');
      });
    });

    describe('PC_KEY command', () => {
      it('should enable keyboard input', () => {
        const enableSpy = jest.spyOn(debugLogicWindow as any, 'enableKeyboardInput');
        
        testCommand(debugLogicWindow, 'LOGIC', 'PC_KEY', () => {
          expect(enableSpy).toHaveBeenCalled();
        });
      });
    });

    describe('PC_MOUSE command', () => {
      it('should enable mouse input', () => {
        const enableSpy = jest.spyOn(debugLogicWindow as any, 'enableMouseInput');
        
        testCommand(debugLogicWindow, 'LOGIC', 'PC_MOUSE', () => {
          expect(enableSpy).toHaveBeenCalled();
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

    it('should transform mouse coordinates correctly', () => {
      // Set up display spec
      debugLogicWindow['displaySpec'] = {
        size: { width: 800, height: 600 },
        spacing: 8,
        font: { charHeight: 16 }
      } as any;
      debugLogicWindow['contentInset'] = 10;
      debugLogicWindow['labelWidth'] = 100;
      debugLogicWindow['channelVInset'] = 20;

      // Test coordinate transformation
      const marginLeft = 110; // contentInset + labelWidth
      const marginTop = 20; // channelVInset
      const displayWidth = 690; // 800 - 10 - 100
      
      // Test mouse at far right (most recent sample)
      const coords1 = debugLogicWindow['transformMouseCoordinates'](
        marginLeft + displayWidth - 1, 
        marginTop
      );
      expect(coords1.x).toBe(-0); // Most recent sample
      expect(coords1.y).toBe(0); // First channel

      // Test mouse one spacing to the left
      const coords2 = debugLogicWindow['transformMouseCoordinates'](
        marginLeft + displayWidth - 1 - 8, 
        marginTop + 16
      );
      expect(coords2.x).toBe(-1); // One sample back
      expect(coords2.y).toBe(1); // Second channel

      // Test mouse outside display area
      const coords3 = debugLogicWindow['transformMouseCoordinates'](
        marginLeft - 1, 
        marginTop
      );
      expect(coords3.x).toBe(-1); // Outside indicator
      expect(coords3.y).toBe(-1); // Outside indicator
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

    it.skip('should arm trigger when enabled', () => {
      testCommand(debugLogicWindow, 'LOGIC', ['TRIGGER', '255', '128'], () => {
        expect(debugLogicWindow['triggerArmed']).toBe(true);
        expect(debugLogicWindow['triggerFired']).toBe(false);
      });
    });

    it.skip('should fire trigger on matching data', () => {
      // Set up trigger
      testCommand(debugLogicWindow, 'LOGIC', ['TRIGGER', '255', '128'], () => {});
      
      // Send matching data
      testCommand(debugLogicWindow, 'LOGIC', '128', () => {
        expect(debugLogicWindow['triggerFired']).toBe(true);
      });
    });

    it.skip('should respect holdoff period', () => {
      // Set up trigger with holdoff
      testCommand(debugLogicWindow, 'LOGIC', ['TRIGGER', '255', '128'], () => {});
      testCommand(debugLogicWindow, 'LOGIC', ['HOLDOFF', '10'], () => {});
      
      // Fire trigger
      testCommand(debugLogicWindow, 'LOGIC', '128', () => {
        expect(debugLogicWindow['triggerFired']).toBe(true);
      });
      
      // Should not re-trigger immediately
      debugLogicWindow['triggerArmed'] = true;
      testCommand(debugLogicWindow, 'LOGIC', '128', () => {
        expect(debugLogicWindow['holdoffCounter']).toBeGreaterThan(0);
      });
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

    it.skip('should handle missing parameters for directives', () => {
      const [isValid] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'Test', 'POS', '100']);
      expect(isValid).toBe(false);
    });
  });

  describe('Canvas ID', () => {
    it('should return correct canvas ID', () => {
      expect(debugLogicWindow['getCanvasId']()).toBe('canvas');
    });
  });
});