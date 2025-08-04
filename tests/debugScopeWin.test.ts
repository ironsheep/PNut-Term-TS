import { DebugScopeWindow, ScopeDisplaySpec } from '../src/classes/debugScopeWin';
import { 
  createMockContext, 
  createMockBrowserWindow, 
  setupDebugWindowTest,
  cleanupDebugWindowTest 
} from './shared/mockHelpers';
import { BrowserWindow } from 'electron';

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
    }
  };
});

// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Mock InputForwarder with complete interface
jest.mock('../src/classes/shared/inputForwarder', () => ({
  InputForwarder: jest.fn().mockImplementation(() => ({
    stopPolling: jest.fn(),
    startPolling: jest.fn(),
    enableKeyboard: jest.fn(),
    enableMouse: jest.fn(),
    setMouseCoordinateTransform: jest.fn()
  }))
}));

// Mock other dependencies
jest.mock('../src/classes/shared/debugColor');
jest.mock('../src/classes/shared/packedDataProcessor');
jest.mock('../src/classes/shared/triggerProcessor');
jest.mock('../src/classes/shared/canvasRenderer');
jest.mock('../src/classes/shared/displaySpecParser');

// Mock Jimp
jest.mock('jimp', () => ({
  Jimp: {
    read: jest.fn().mockResolvedValue({
      getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-bmp-data'))
    })
  }
}));

describe('DebugScopeWindow', () => {
  let debugScopeWindow: DebugScopeWindow;
  let mockContext: any;
  let mockBrowserWindow: any;
  let mockDisplaySpec: ScopeDisplaySpec;
  let mockLogger: any;

  beforeEach(() => {
    // Clear mock instances
    mockBrowserWindowInstances = [];
    
    // Setup test environment
    const testSetup = setupDebugWindowTest();
    mockContext = testSetup.mockContext;
    mockLogger = mockContext.logger;
    
    mockDisplaySpec = {
      displayName: 'SCOPE',
      windowTitle: 'Scope Display',
      title: 'Test Scope',
      position: { x: 0, y: 0 },
      size: { width: 800, height: 600 },
      nbrSamples: 256,
      rate: 1000,
      dotSize: 1,
      lineSize: 1,
      textSize: 12,
      window: {
        background: '#000000',
        grid: '#808080'
      },
      isPackedData: false,
      hideXY: false
    };

    debugScopeWindow = new DebugScopeWindow(mockContext, mockDisplaySpec);
  });

  afterEach(() => {
    cleanupDebugWindowTest();
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
      // Set up display spec
      debugScopeWindow['displaySpec'] = {
        size: { width: 800, height: 600 },
        nbrSamples: 256
      } as any;
      debugScopeWindow['contentInset'] = 10;
      debugScopeWindow['channelInset'] = 20;
      
      // Add a channel
      debugScopeWindow['channelSpecs'] = [{
        minValue: -100,
        maxValue: 100,
        ySize: 200
      }] as any;

      // Test coordinate transformation
      const marginLeft = 10; // contentInset
      const marginTop = 20; // channelInset (not contentInset)
      const displayWidth = 780; // 800 - 2*10
      const displayHeight = 560; // 600 - 2*20
      
      // Test mouse at center
      const coords1 = debugScopeWindow['transformMouseCoordinates'](
        marginLeft + displayWidth / 2, 
        marginTop + displayHeight / 2
      );
      expect(coords1.x).toBe(390); // Half of display width
      expect(coords1.y).toBe(279); // Y is inverted: marginTop + height - 1 - y

      // Test mouse at bottom (Y=0 in scope coordinates due to inversion)
      const coords2 = debugScopeWindow['transformMouseCoordinates'](
        marginLeft, 
        marginTop + displayHeight - 1
      );
      expect(coords2.x).toBe(0); // Left edge
      expect(coords2.y).toBe(0); // Bottom in scope coords

      // Test mouse at top (Y=height-1 in scope coordinates)
      const coords3 = debugScopeWindow['transformMouseCoordinates'](
        marginLeft + displayWidth - 1, 
        marginTop
      );
      expect(coords3.x).toBe(779); // Right edge
      expect(coords3.y).toBe(559); // Top in scope coords
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

      // Should start polling
      expect(debugScopeWindow['inputForwarder'].startPolling).toHaveBeenCalled();
      
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

  describe('Coordinate System', () => {
    it('should display coordinates with Y-axis inverted', () => {
      // Set up display spec with known channel range
      debugScopeWindow['displaySpec'] = {
        size: { width: 800, height: 600 },
        nbrSamples: 100
      } as any;
      debugScopeWindow['contentInset'] = 0;
      debugScopeWindow['channelInset'] = 0;
      
      // Add a channel
      debugScopeWindow['channelSpecs'] = [{
        minValue: 0,
        maxValue: 100,
        ySize: 600
      }] as any;

      // Mouse at top of display should give max Y in scope coords (inverted)
      const topCoords = debugScopeWindow['transformMouseCoordinates'](0, 0);
      expect(topCoords.y).toBe(599); // Y = marginTop + height - 1 - mouseY = 0 + 600 - 1 - 0 = 599

      // Mouse at bottom of display should give min Y in scope coords
      const bottomCoords = debugScopeWindow['transformMouseCoordinates'](0, 599);
      expect(bottomCoords.y).toBe(0); // Y = 0 + 600 - 1 - 599 = 0
    });
  });
});