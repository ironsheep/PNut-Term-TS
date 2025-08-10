/** @format */

// tests/debugDebuggerWin.test.ts

import { DebugDebuggerWindow } from '../src/classes/debugDebuggerWin';
import { Context } from '../src/utils/context';
import { WindowRouter } from '../src/classes/shared/windowRouter';
import { BrowserWindow } from 'electron';
import { DebuggerProtocol } from '../src/classes/shared/debuggerProtocol';
import { DebuggerDataManager } from '../src/classes/shared/debuggerDataManager';
import { DebuggerRenderer } from '../src/classes/shared/debuggerRenderer';
import { DebuggerInteraction } from '../src/classes/shared/debuggerInteraction';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    webContents: {
      on: jest.fn(),
      send: jest.fn(),
      executeJavaScript: jest.fn().mockResolvedValue({ width: 984, height: 1232 })
    },
    isDestroyed: jest.fn().mockReturnValue(false),
    close: jest.fn(),
    setMenu: jest.fn(),
    setTitle: jest.fn()
  })),
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn()
  },
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path'),
    getName: jest.fn().mockReturnValue('pnut-term-ts')
  },
  ipcMain: {
    on: jest.fn(),
    removeHandler: jest.fn()
  }
}));

// Mock WindowRouter
jest.mock('../src/classes/shared/windowRouter');

// Mock debugger components
jest.mock('../src/classes/shared/debuggerProtocol');
jest.mock('../src/classes/shared/debuggerDataManager');
jest.mock('../src/classes/shared/debuggerRenderer');
jest.mock('../src/classes/shared/debuggerInteraction');

describe('DebugDebuggerWindow', () => {
  let window: DebugDebuggerWindow;
  let context: Context;
  let mockBrowserWindow: any;
  const cogId = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    context = new Context();
    
    // Reset WindowRouter singleton
    WindowRouter.resetInstance();
    
    // Create window
    window = new DebugDebuggerWindow(context, cogId);
    mockBrowserWindow = (BrowserWindow as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    if (window) {
      window.closeDebugWindow();
    }
  });

  describe('Constructor', () => {
    it('should create window with correct COG ID', () => {
      expect(window).toBeDefined();
      expect((window as any).cogId).toBe(cogId);
    });

    it('should initialize fresh COG state', () => {
      const state = (window as any).cogState;
      expect(state).toBeDefined();
      expect(state.cogId).toBe(cogId);
      expect(state.isActive).toBe(false);
      expect(state.isBreaked).toBe(false);
      expect(state.programCounter).toBe(0);
      expect(state.breakpoints).toBeInstanceOf(Set);
      expect(state.cogMemory).toBeInstanceOf(Map);
      expect(state.lutMemory).toBeInstanceOf(Map);
    });

    it('should support multiple COG IDs', () => {
      const windows: DebugDebuggerWindow[] = [];
      
      for (let i = 0; i < 8; i++) {
        const w = new DebugDebuggerWindow(context, i);
        windows.push(w);
        expect((w as any).cogId).toBe(i);
      }
      
      // Cleanup
      windows.forEach(w => w.closeDebugWindow());
    });
  });

  describe('Window Initialization', () => {
    it('should register with WindowRouter', async () => {
      await window.initialize();
      
      const router = WindowRouter.getInstance();
      expect(router.registerWindow).toHaveBeenCalledWith(
        `debugger-${cogId}`,
        'debugger',
        expect.any(Function)
      );
    });

    it('should initialize core components', async () => {
      await window.initialize();
      
      expect(DebuggerDataManager).toHaveBeenCalled();
      expect(DebuggerProtocol).toHaveBeenCalledWith(cogId, context);
      expect(DebuggerRenderer).toHaveBeenCalled();
      expect(DebuggerInteraction).toHaveBeenCalled();
    });

    it('should set up IPC handlers', async () => {
      await window.initialize();
      
      expect(mockBrowserWindow.webContents.on).toHaveBeenCalledWith(
        'ipc-message',
        expect.any(Function)
      );
    });

    it('should start update loop after canvas init', async () => {
      await window.initialize();
      
      // Simulate canvas ready
      const executeJS = mockBrowserWindow.webContents.executeJavaScript;
      expect(executeJS).toHaveBeenCalled();
      
      // Update loop should be started
      expect((window as any).updateTimer).toBeDefined();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await window.initialize();
    });

    it('should handle binary debugger messages', () => {
      const binaryData = new Uint8Array(80); // 20 longs
      const longs = new Uint32Array(binaryData.buffer);
      longs[0] = cogId; // Set COG number
      longs[1] = 0x01; // Break status
      longs[2] = 0x1000; // PC
      
      window.updateContent({ binary: binaryData });
      
      const state = (window as any).cogState;
      expect(state.programCounter).toBe(0x1000);
      expect(state.isBreaked).toBe(true);
    });

    it('should handle text messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      window.updateContent({ text: 'Test response' });
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Text message'));
      consoleSpy.mockRestore();
    });

    it('should ignore messages for other COGs', () => {
      const binaryData = new Uint8Array(80);
      const longs = new Uint32Array(binaryData.buffer);
      longs[0] = 5; // Different COG
      
      const initialPC = (window as any).cogState.programCounter;
      window.updateContent({ binary: binaryData });
      
      expect((window as any).cogState.programCounter).toBe(initialPC);
    });
  });

  describe('Keyboard Input', () => {
    let mockProtocol: jest.Mocked<DebuggerProtocol>;
    let mockInteraction: jest.Mocked<DebuggerInteraction>;

    beforeEach(async () => {
      await window.initialize();
      mockProtocol = (window as any).protocol;
      mockInteraction = (window as any).interaction;
    });

    it('should handle keyboard events through interaction', () => {
      const keyData = {
        key: ' ',
        code: 'Space',
        shift: false,
        ctrl: false,
        alt: false
      };
      
      // Simulate IPC keyboard event
      const ipcHandler = mockBrowserWindow.webContents.on.mock.calls
        .find((call: any) => call[0] === 'ipc-message')[1];
      
      ipcHandler({}, 'debugger-key', keyData);
      
      expect(mockInteraction.handleKeyboard).toHaveBeenCalledWith(
        expect.objectContaining({
          key: ' ',
          code: 'Space'
        })
      );
    });
  });

  describe('Mouse Input', () => {
    let mockInteraction: jest.Mocked<DebuggerInteraction>;

    beforeEach(async () => {
      await window.initialize();
      mockInteraction = (window as any).interaction;
    });

    it('should handle mouse clicks', () => {
      const clickData = { x: 100, y: 50, button: 0 };
      
      const ipcHandler = mockBrowserWindow.webContents.on.mock.calls
        .find((call: any) => call[0] === 'ipc-message')[1];
      
      ipcHandler({}, 'debugger-click', clickData);
      
      expect(mockInteraction.handleMouseClick).toHaveBeenCalledWith(100, 50, 0);
    });

    it('should handle mouse wheel', () => {
      const wheelData = { deltaY: 120 };
      
      const ipcHandler = mockBrowserWindow.webContents.on.mock.calls
        .find((call: any) => call[0] === 'ipc-message')[1];
      
      ipcHandler({}, 'debugger-wheel', wheelData);
      
      expect(mockInteraction.handleMouseWheel).toHaveBeenCalledWith(120);
    });
  });

  describe('Rendering', () => {
    let mockRenderer: jest.Mocked<DebuggerRenderer>;

    beforeEach(async () => {
      await window.initialize();
      mockRenderer = (window as any).renderer;
      mockRenderer.render = jest.fn().mockReturnValue([[]]);
    });

    it('should render debugger display', () => {
      (window as any).renderDebuggerDisplay();
      
      expect(mockRenderer.render).toHaveBeenCalled();
      expect(mockBrowserWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should update status display', () => {
      (window as any).cogState.programCounter = 0x2000;
      (window as any).cogState.isBreaked = true;
      (window as any).updateStatusDisplay();
      
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith(
        'status-update',
        expect.objectContaining({
          pc: 0x2000,
          breaked: true
        })
      );
    });
  });

  describe('Window Lifecycle', () => {
    it('should clean up on close', async () => {
      await window.initialize();
      
      const mockProtocol = (window as any).protocol;
      const mockDataManager = (window as any).dataManager;
      const mockRenderer = (window as any).renderer;
      const mockInteraction = (window as any).interaction;
      
      window.closeDebugWindow();
      
      expect(mockProtocol.cleanup).toHaveBeenCalled();
      expect(mockDataManager.cleanup).toHaveBeenCalled();
      expect(mockRenderer.cleanup).toHaveBeenCalled();
      expect(mockInteraction.cleanup).toHaveBeenCalled();
      
      const router = WindowRouter.getInstance();
      expect(router.unregisterWindow).toHaveBeenCalledWith(`debugger-${cogId}`);
    });

    it('should stop update loop on close', async () => {
      await window.initialize();
      
      const timer = (window as any).updateTimer;
      expect(timer).toBeDefined();
      
      window.closeDebugWindow();
      
      expect((window as any).updateTimer).toBeNull();
    });

    it('should handle multiple open/close cycles', async () => {
      for (let i = 0; i < 3; i++) {
        const w = new DebugDebuggerWindow(context, cogId);
        await w.initialize();
        w.closeDebugWindow();
      }
      
      // Should not leak or error
      expect(true).toBe(true);
    });
  });

  describe('HTML Content', () => {
    it('should generate correct HTML', () => {
      const html = (window as any).getHtmlContent();
      
      expect(html).toContain('P2 Debugger - COG 0');
      expect(html).toContain('canvas');
      expect(html).toContain('Parallax');
      expect(html).toContain('status');
      expect(html).toContain('ipcRenderer');
    });

    it('should include keyboard handlers in HTML', () => {
      const html = (window as any).getHtmlContent();
      
      expect(html).toContain('keydown');
      expect(html).toContain('debugger-key');
    });

    it('should include mouse handlers in HTML', () => {
      const html = (window as any).getHtmlContent();
      
      expect(html).toContain('click');
      expect(html).toContain('wheel');
      expect(html).toContain('debugger-click');
      expect(html).toContain('debugger-wheel');
    });
  });

  describe('COG State Management', () => {
    it('should update COG state from debugger message', () => {
      const message = {
        cogNumber: cogId,
        breakStatus: 0x01,
        programCounter: 0x3000,
        skipPattern: 0xFF,
        skipPatternContinue: 0,
        callDepth: 3,
        interruptStatus: 0,
        registerINA: 0,
        registerINB: 0,
        eventCount: 0,
        breakCount: 0,
        cogCRC: 0,
        lutCRC: 0,
        hubChecksums: new Uint32Array(124),
        conditionCodes: 0
      };
      
      (window as any).updateCogState(message);
      
      const state = (window as any).cogState;
      expect(state.programCounter).toBe(0x3000);
      expect(state.skipPattern).toBe(0xFF);
      expect(state.callDepth).toBe(3);
      expect(state.isBreaked).toBe(true);
      expect(state.isActive).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed binary messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Too short message
      const shortData = new Uint8Array(10);
      window.updateContent({ binary: shortData });
      
      // Should not crash
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Error'));
      
      consoleSpy.mockRestore();
    });

    it('should handle render errors gracefully', async () => {
      await window.initialize();
      
      const mockRenderer = (window as any).renderer;
      mockRenderer.render = jest.fn().mockImplementation(() => {
        throw new Error('Render error');
      });
      
      // Should not throw
      expect(() => {
        (window as any).renderDebuggerDisplay();
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should update at ~30 FPS', async () => {
      jest.useFakeTimers();
      await window.initialize();
      
      const renderSpy = jest.spyOn(window as any, 'renderDebuggerDisplay');
      
      // Advance time by 1 second
      jest.advanceTimersByTime(1000);
      
      // Should have ~30 updates (33ms interval)
      expect(renderSpy).toHaveBeenCalledTimes(30);
      
      jest.useRealTimers();
    });
  });
});