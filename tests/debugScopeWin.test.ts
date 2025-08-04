import { DebugScopeWindow, ScopeDisplaySpec } from '../src/classes/debugScopeWin';
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

describe('DebugScopeWindow', () => {
  let debugScopeWindow: DebugScopeWindow;
  let mockContext: jest.Mocked<Context>;
  let mockBrowserWindow: any;
  let mockDisplaySpec: ScopeDisplaySpec;

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

    mockBrowserWindow = new BrowserWindow();
    (BrowserWindow as any).mockImplementation(() => mockBrowserWindow);

    debugScopeWindow = new DebugScopeWindow(mockContext, mockDisplaySpec);
    
    // Set up default inputForwarder mock
    debugScopeWindow['inputForwarder'] = {
      setMouseCoordinateTransform: jest.fn()
    } as any;
  });

  describe('Mouse Coordinate Display', () => {
    it('should add coordinate display elements to HTML', () => {
      // Mock the private createDebugWindow method
      const createWindowSpy = jest.spyOn(debugScopeWindow as any, 'createDebugWindow');
      
      // Trigger window creation by sending numeric data
      debugScopeWindow['isFirstNumericData'] = false;
      debugScopeWindow['createDebugWindow']();
      
      // Check that HTML includes coordinate display elements
      const loadURLCall = mockBrowserWindow.loadURL.mock.calls[0];
      expect(loadURLCall).toBeDefined();
      const htmlContent = decodeURIComponent(loadURLCall[0].replace('data:text/html,', ''));
      
      expect(htmlContent).toContain('id="coordinate-display"');
      expect(htmlContent).toContain('id="crosshair-horizontal"');
      expect(htmlContent).toContain('id="crosshair-vertical"');
    });

    it('should include coordinate display styles', () => {
      debugScopeWindow['isFirstNumericData'] = false;
      debugScopeWindow['createDebugWindow']();
      
      const loadURLCall = mockBrowserWindow.loadURL.mock.calls[0];
      const htmlContent = decodeURIComponent(loadURLCall[0].replace('data:text/html,', ''));
      
      expect(htmlContent).toContain('#coordinate-display');
      expect(htmlContent).toContain('pointer-events: none');
      expect(htmlContent).toContain('z-index: 20');
      expect(htmlContent).toContain('#crosshair-horizontal');
      expect(htmlContent).toContain('#crosshair-vertical');
    });

    it('should transform mouse coordinates correctly', () => {
      // Set up display spec
      debugScopeWindow['displaySpec'] = mockDisplaySpec;
      debugScopeWindow['contentInset'] = 10;
      debugScopeWindow['channelInset'] = 20;

      // Test coordinate transformation
      const marginLeft = 10; // contentInset
      const marginTop = 20; // channelInset
      const displayWidth = 780; // 800 - 2 * 10
      const displayHeight = 560; // 600 - 2 * 20
      
      // Test mouse at top-left of display area
      const coords1 = debugScopeWindow['transformMouseCoordinates'](
        marginLeft, 
        marginTop
      );
      expect(coords1.x).toBe(0); // Left edge
      expect(coords1.y).toBe(559); // Bottom inverted (height - 1)

      // Test mouse at bottom-right of display area
      const coords2 = debugScopeWindow['transformMouseCoordinates'](
        marginLeft + displayWidth - 1, 
        marginTop + displayHeight - 1
      );
      expect(coords2.x).toBe(779); // Right edge
      expect(coords2.y).toBe(0); // Top inverted to bottom

      // Test mouse at center
      const coords3 = debugScopeWindow['transformMouseCoordinates'](
        marginLeft + displayWidth / 2, 
        marginTop + displayHeight / 2
      );
      expect(coords3.x).toBe(390); // Center X
      expect(coords3.y).toBe(279); // Center Y inverted

      // Test mouse outside display area
      const coords4 = debugScopeWindow['transformMouseCoordinates'](
        marginLeft - 1, 
        marginTop
      );
      expect(coords4.x).toBe(-1); // Outside indicator
      expect(coords4.y).toBe(-1); // Outside indicator
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
      debugScopeWindow['debugWindow'] = mockDebugWindow as any;
      debugScopeWindow['inputForwarder'] = {
        startPolling: jest.fn(),
        setMouseCoordinateTransform: jest.fn()
      } as any;

      // Enable mouse input
      debugScopeWindow['enableMouseInput']();

      // Should start polling and add coordinate display JavaScript
      expect(debugScopeWindow['inputForwarder'].startPolling).toHaveBeenCalled();
      expect(mockDebugWindow.webContents.executeJavaScript).toHaveBeenCalled();
      
      // Check that the JavaScript includes coordinate display setup
      const jsCall = mockDebugWindow.webContents.executeJavaScript.mock.calls.find(
        call => call[0].includes('coordinate-display')
      );
      expect(jsCall).toBeDefined();
      expect(jsCall[0]).toContain('coordDisplay.textContent = scopeX + \',\' + scopeY');
      expect(jsCall[0]).toContain('crosshairH.style.display = \'block\'');
      expect(jsCall[0]).toContain('crosshairV.style.display = \'block\'');
      // Check for Y-axis inversion (the value 580 is interpolated from displayHeight)
      expect(jsCall[0]).toContain('const scopeY = 580 - 1 - dataY');
    });

  });

  describe('Canvas ID', () => {
    it('should return correct canvas ID', () => {
      expect(debugScopeWindow['getCanvasId']()).toBe('canvas');
    });
  });

  describe('Coordinate System', () => {
    it('should display coordinates with Y-axis inverted', () => {
      debugScopeWindow['displaySpec'] = mockDisplaySpec;
      debugScopeWindow['contentInset'] = 10;
      debugScopeWindow['channelInset'] = 20;

      // At the visual top of the display (y = marginTop), 
      // the coordinate should show maximum Y value
      const topCoords = debugScopeWindow['transformMouseCoordinates'](50, 20);
      expect(topCoords.y).toBe(559); // height - 1

      // At the visual bottom of the display (y = marginTop + height - 1),
      // the coordinate should show 0
      const bottomCoords = debugScopeWindow['transformMouseCoordinates'](50, 579);
      expect(bottomCoords.y).toBe(0);
    });
  });
});