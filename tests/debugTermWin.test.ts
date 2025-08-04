import { DebugTermWindow } from '../src/classes/debugTermWin';
import { Context } from '../src/utils/context';
import { BrowserWindow } from 'electron';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
      on: jest.fn(),
      capturePage: jest.fn().mockResolvedValue({
        toPNG: jest.fn().mockResolvedValue(Buffer.from('mock-png-data'))
      })
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
  nativeImage: {
    createFromBuffer: jest.fn().mockReturnValue({
      toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
    })
  }
}));

// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Mock InputForwarder
jest.mock('../src/classes/shared/inputForwarder', () => ({
  InputForwarder: jest.fn().mockImplementation(() => ({
    stopPolling: jest.fn(),
    startPolling: jest.fn(),
    enableKeyboard: jest.fn(),
    enableMouse: jest.fn()
  }))
}));

// Mock other dependencies
jest.mock('../src/utils/context');
jest.mock('../src/classes/shared/canvasRenderer');
jest.mock('../src/classes/shared/displaySpecParser');

describe('DebugTermWindow', () => {
  let debugTermWindow: DebugTermWindow;
  let mockContext: Context;
  let mockBrowserWindow: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      logMessage: jest.fn(),
      logger: {
        logMessage: jest.fn()
      },
      runtime: {
        verbose: false
      }
    } as any;

    debugTermWindow = new DebugTermWindow(mockContext);
    mockBrowserWindow = new BrowserWindow();
  });

  describe('Constructor', () => {
    it('should initialize with correct window prefix', () => {
      expect(debugTermWindow['windowLogPrefix']).toBe('TermWin');
    });

    it('should initialize terminal parameters', () => {
      expect(debugTermWindow['cursorX']).toBe(0);
      expect(debugTermWindow['cursorY']).toBe(0);
      expect(debugTermWindow['cursorVisible']).toBe(true);
      expect(debugTermWindow['cursorBlinkTimer']).toBeNull();
    });
  });

  describe('Window Creation', () => {
    it('should create debug window with display spec', () => {
      const displaySpec = {
        title: 'Test Terminal',
        x: 100,
        y: 100,
        width: 640,
        height: 480,
        textSize: 14,
        textStyle: 0,
        textColor: '#00FF00',
        backColor: '#000000'
      };

      debugTermWindow.createDebugWindow(displaySpec);

      expect(BrowserWindow).toHaveBeenCalledWith({
        x: 100,
        y: 100,
        width: 640,
        height: 480,
        title: 'Test Terminal',
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
    });

    it('should handle window ready event', async () => {
      const displaySpec = {
        title: 'Test Terminal',
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        textSize: 14,
        textStyle: 0,
        textColor: '#FFFFFF',
        backColor: '#000000'
      };

      debugTermWindow.createDebugWindow(displaySpec);
      
      // Get the ready-to-show callback
      const readyCallback = mockBrowserWindow.once.mock.calls.find(
        call => call[0] === 'ready-to-show'
      )?.[1];

      // Call the ready callback
      if (readyCallback) {
        await readyCallback();
      }

      expect(mockContext.logger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('Terminal window ready')
      );
    });
  });

  describe('Content Updates', () => {
    beforeEach(() => {
      debugTermWindow.createDebugWindow({
        title: 'Test',
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        textSize: 14,
        textStyle: 0,
        textColor: '#FFFFFF',
        backColor: '#000000'
      });
    });

    it('should handle CLEAR command', () => {
      debugTermWindow.updateContent(['CLEAR']);
      
      expect(debugTermWindow['cursorX']).toBe(0);
      expect(debugTermWindow['cursorY']).toBe(0);
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('clearScreen()')
      );
    });

    it('should handle HOME command', () => {
      debugTermWindow['cursorX'] = 10;
      debugTermWindow['cursorY'] = 5;
      
      debugTermWindow.updateContent(['HOME']);
      
      expect(debugTermWindow['cursorX']).toBe(0);
      expect(debugTermWindow['cursorY']).toBe(0);
    });

    it('should handle BELL command', () => {
      debugTermWindow.updateContent(['BELL']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('beep()')
      );
    });

    it('should handle GOTOXY command', () => {
      debugTermWindow.updateContent(['GOTOXY', '10', '5']);
      
      expect(debugTermWindow['cursorX']).toBe(10);
      expect(debugTermWindow['cursorY']).toBe(5);
    });

    it('should handle TEXTCOLOR command', () => {
      debugTermWindow.updateContent(['TEXTCOLOR', '$FF0000']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('setTextColor')
      );
    });

    it('should handle BACKCOLOR command', () => {
      debugTermWindow.updateContent(['BACKCOLOR', '$0000FF']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('setBackColor')
      );
    });

    it('should handle SCROLLPOS command', () => {
      debugTermWindow.updateContent(['SCROLLPOS', '5']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('setScrollPos(5)')
      );
    });

    it('should handle text output', () => {
      debugTermWindow.updateContent(['Hello, World!']);
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('writeText')
      );
    });

    it('should handle ANSI escape sequences', () => {
      // Test cursor movement
      debugTermWindow.updateContent(['\\x1B[2J']); // Clear screen
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('clearScreen')
      );

      // Test color codes
      debugTermWindow.updateContent(['\\x1B[31mRed Text']); // Red foreground
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should handle special characters', () => {
      // Tab
      debugTermWindow.updateContent(['Hello\\tWorld']);
      expect(debugTermWindow['cursorX']).toBeGreaterThan(5);

      // Newline
      debugTermWindow['cursorY'] = 0;
      debugTermWindow.updateContent(['Line1\\nLine2']);
      expect(debugTermWindow['cursorY']).toBe(1);

      // Carriage return
      debugTermWindow['cursorX'] = 10;
      debugTermWindow.updateContent(['Test\\r']);
      expect(debugTermWindow['cursorX']).toBe(0);
    });

    it('should handle PC_KEY command', () => {
      debugTermWindow.updateContent(['PC_KEY']);
      
      expect(debugTermWindow['inputForwarder'].enableKeyboard).toHaveBeenCalled();
    });

    it('should handle PC_MOUSE command', () => {
      debugTermWindow.updateContent(['PC_MOUSE']);
      
      expect(debugTermWindow['inputForwarder'].enableMouse).toHaveBeenCalled();
    });
  });

  describe('Cursor Management', () => {
    beforeEach(() => {
      debugTermWindow.createDebugWindow({
        title: 'Test',
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        textSize: 14,
        textStyle: 0,
        textColor: '#FFFFFF',
        backColor: '#000000'
      });
    });

    it('should show/hide cursor', () => {
      debugTermWindow['showCursor'](false);
      expect(debugTermWindow['cursorVisible']).toBe(false);
      
      debugTermWindow['showCursor'](true);
      expect(debugTermWindow['cursorVisible']).toBe(true);
    });

    it('should handle cursor blink timer', () => {
      jest.useFakeTimers();
      
      debugTermWindow['startCursorBlink']();
      expect(debugTermWindow['cursorBlinkTimer']).not.toBeNull();
      
      // Advance timer
      jest.advanceTimersByTime(500);
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
      
      debugTermWindow['stopCursorBlink']();
      expect(debugTermWindow['cursorBlinkTimer']).toBeNull();
      
      jest.useRealTimers();
    });
  });

  describe('Window Cleanup', () => {
    it('should clean up resources on close', () => {
      debugTermWindow.createDebugWindow({
        title: 'Test',
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        textSize: 14,
        textStyle: 0,
        textColor: '#FFFFFF',
        backColor: '#000000'
      });

      jest.useFakeTimers();
      debugTermWindow['startCursorBlink']();
      
      debugTermWindow.closeDebugWindow();
      
      expect(debugTermWindow['cursorBlinkTimer']).toBeNull();
      expect(debugTermWindow['_debugWindow']).toBeNull();
      
      jest.useRealTimers();
    });

    it('should handle window already destroyed', () => {
      debugTermWindow['_debugWindow'] = mockBrowserWindow;
      mockBrowserWindow.isDestroyed.mockReturnValue(true);
      
      expect(() => debugTermWindow.closeDebugWindow()).not.toThrow();
    });
  });

  describe('Helper Methods', () => {
    it('should get correct canvas ID', () => {
      expect(debugTermWindow['getCanvasId']()).toBe('terminal-canvas');
    });

    it('should handle scroll positioning', () => {
      debugTermWindow.createDebugWindow({
        title: 'Test',
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        textSize: 14,
        textStyle: 0,
        textColor: '#FFFFFF',
        backColor: '#000000'
      });

      // Test scroll beyond bounds
      debugTermWindow['cursorY'] = 30; // Assuming 25 lines visible
      debugTermWindow['checkScroll']();
      
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('scrollToBottom')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid GOTOXY coordinates', () => {
      debugTermWindow.createDebugWindow({
        title: 'Test',
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        textSize: 14,
        textStyle: 0,
        textColor: '#FFFFFF',
        backColor: '#000000'
      });

      debugTermWindow.updateContent(['GOTOXY', 'invalid', '5']);
      expect(debugTermWindow['cursorX']).toBe(0); // Should not change

      debugTermWindow.updateContent(['GOTOXY', '10', 'invalid']);
      expect(debugTermWindow['cursorY']).toBe(0); // Should not change
    });

    it('should handle invalid color values', () => {
      debugTermWindow.createDebugWindow({
        title: 'Test',
        x: 0,
        y: 0,
        width: 640,
        height: 480,
        textSize: 14,
        textStyle: 0,
        textColor: '#FFFFFF',
        backColor: '#000000'
      });

      debugTermWindow.updateContent(['TEXTCOLOR', 'INVALID']);
      // Should log error but not crash
      expect(mockContext.logger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('Invalid color')
      );
    });
  });
});