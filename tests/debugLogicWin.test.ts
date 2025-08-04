import { DebugLogicWindow, LogicDisplaySpec } from '../src/classes/debugLogicWin';
import { Context } from '../src/utils/context';
import { BrowserWindow } from 'electron';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
      on: jest.fn()
    },
    on: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    setAlwaysOnTop: jest.fn(),
    setMenu: jest.fn()
  })),
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  },
  ipcMain: {
    on: jest.fn(),
    removeAllListeners: jest.fn()
  }
}));

// Mock other dependencies
jest.mock('../src/utils/context');
jest.mock('../src/classes/debugColor');
jest.mock('../src/classes/shared/packedDataProcessor');
jest.mock('../src/classes/shared/triggerProcessor');
jest.mock('../src/classes/shared/canvasRenderer');
jest.mock('../src/classes/shared/displaySpecParser');

describe('DebugLogicWindow', () => {
  let debugLogicWindow: DebugLogicWindow;
  let mockContext: jest.Mocked<Context>;
  let mockBrowserWindow: any;
  let mockDisplaySpec: LogicDisplaySpec;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      logMessage: jest.fn(),
      runtime: {
        isDebugMode: false
      },
      logger: {
        logMessage: jest.fn()
      }
    } as any;

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

    mockBrowserWindow = new BrowserWindow();
    (BrowserWindow as any).mockImplementation(() => mockBrowserWindow);

    debugLogicWindow = new DebugLogicWindow(mockContext, mockDisplaySpec);
    
    // Set up default inputForwarder mock
    debugLogicWindow['inputForwarder'] = {
      setMouseCoordinateTransform: jest.fn()
    } as any;
  });

  describe('Mouse Coordinate Display', () => {

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

    it('should call enableMouseInput and set up coordinate display', () => {
      const mockDebugWindow = {
        webContents: {
          executeJavaScript: jest.fn(),
          on: jest.fn()
        },
        setMenu: jest.fn(),
        loadURL: jest.fn()
      };
      debugLogicWindow['debugWindow'] = mockDebugWindow as any;
      debugLogicWindow['inputForwarder'] = {
        startPolling: jest.fn(),
        setMouseCoordinateTransform: jest.fn()
      } as any;

      // Enable mouse input
      debugLogicWindow['enableMouseInput']();

      // Should start polling and add coordinate display JavaScript
      expect(debugLogicWindow['inputForwarder'].startPolling).toHaveBeenCalled();
      expect(mockDebugWindow.webContents.executeJavaScript).toHaveBeenCalled();
      
      // Check that the JavaScript includes coordinate display setup
      const jsCall = mockDebugWindow.webContents.executeJavaScript.mock.calls.find(
        call => call[0].includes('coordinate-display')
      );
      expect(jsCall).toBeDefined();
      expect(jsCall[0]).toContain('coordDisplay.textContent = sampleX + \',\' + channelY');
      expect(jsCall[0]).toContain('crosshairH.style.display = \'block\'');
      expect(jsCall[0]).toContain('crosshairV.style.display = \'block\'');
    });

  });

  describe('Canvas ID', () => {
    it('should return correct canvas ID', () => {
      expect(debugLogicWindow['getCanvasId']()).toBe('canvas');
    });
  });
});