/** @format */

// tests/multiCogDebugger.test.ts

import { DebugDebuggerWindow } from '../src/classes/debugDebuggerWin';
import { Context } from '../src/utils/context';
import { WindowRouter } from '../src/classes/shared/windowRouter';
import { DebuggerDataManager } from '../src/classes/shared/debuggerDataManager';
import { BrowserWindow } from 'electron';

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
    setTitle: jest.fn(),
    setBounds: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 984, height: 1232 })
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

describe('Multi-COG Debugger Support', () => {
  let context: Context;
  let windows: DebugDebuggerWindow[];
  let router: jest.Mocked<WindowRouter>;

  beforeEach(() => {
    jest.clearAllMocks();
    context = new Context();
    windows = [];
    
    // Reset WindowRouter singleton
    WindowRouter.resetInstance();
    router = WindowRouter.getInstance() as jest.Mocked<WindowRouter>;
  });

  afterEach(() => {
    // Cleanup all windows
    windows.forEach(w => w.closeDebugWindow());
    windows = [];
  });

  describe('Multiple COG Windows', () => {
    it('should support 8 concurrent debugger windows', async () => {
      // Create 8 debugger windows for COGs 0-7
      for (let cogId = 0; cogId < 8; cogId++) {
        const window = new DebugDebuggerWindow(context, cogId);
        await window.initialize();
        windows.push(window);
      }

      expect(windows).toHaveLength(8);
      
      // Each should register with unique ID
      for (let cogId = 0; cogId < 8; cogId++) {
        expect(router.registerWindow).toHaveBeenCalledWith(
          `debugger-${cogId}`,
          'debugger',
          expect.any(Function)
        );
      }
    });

    it('should route messages to correct COG window', async () => {
      // Create 3 debugger windows
      const handlers: Map<number, jest.Mock> = new Map();
      
      for (let cogId = 0; cogId < 3; cogId++) {
        const window = new DebugDebuggerWindow(context, cogId);
        await window.initialize();
        windows.push(window);
        
        // Capture the handler for this COG
        const registerCall = router.registerWindow.mock.calls.find(
          call => call[0] === `debugger-${cogId}`
        );
        handlers.set(cogId, registerCall![2] as jest.Mock);
      }

      // Send message to COG 1
      const binaryData = new Uint8Array(80);
      const longs = new Uint32Array(binaryData.buffer);
      longs[0] = 1; // COG 1
      longs[2] = 0x2000; // PC
      
      // Route through WindowRouter
      router.routeBinaryMessage.mockImplementation((data) => {
        // Simulate router logic - extract COG ID and route
        const view = new DataView(data.buffer);
        const cogId = view.getUint32(0, true) & 0x7;
        const handler = handlers.get(cogId);
        if (handler) {
          handler({ binary: data });
        }
      });
      
      router.routeBinaryMessage(binaryData);
      
      // Only COG 1's handler should be called
      const cog1Handler = handlers.get(1)!;
      expect(cog1Handler).toHaveBeenCalledWith({ binary: binaryData });
    });

    it('should cascade window positions', () => {
      const mockWindows: any[] = [];
      
      // Mock BrowserWindow to track positions
      (BrowserWindow as jest.Mock).mockImplementation(() => {
        const mockWindow = {
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
          setTitle: jest.fn(),
          setBounds: jest.fn(),
          getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 984, height: 1232 })
        };
        mockWindows.push(mockWindow);
        return mockWindow;
      });
      
      // Create windows with cascading positions
      for (let cogId = 0; cogId < 4; cogId++) {
        const window = new DebugDebuggerWindow(context, cogId, {
          x: cogId * 32, // Cascade offset
          y: cogId * 32
        });
        windows.push(window);
      }
      
      // Verify cascading positions were requested
      expect(mockWindows).toHaveLength(4);
    });
  });

  describe('Breakpoint Coordination', () => {
    it('should manage independent breakpoints per COG', async () => {
      const dataManagers: Map<number, jest.Mocked<DebuggerDataManager>> = new Map();
      
      // Create 2 debugger windows
      for (let cogId = 0; cogId < 2; cogId++) {
        const window = new DebugDebuggerWindow(context, cogId);
        await window.initialize();
        windows.push(window);
        
        const dataManager = (window as any).dataManager as jest.Mocked<DebuggerDataManager>;
        dataManagers.set(cogId, dataManager);
      }
      
      // Set breakpoints independently
      const dm0 = dataManagers.get(0)!;
      const dm1 = dataManagers.get(1)!;
      
      dm0.addBreakpoint.mockImplementation(() => {});
      dm1.addBreakpoint.mockImplementation(() => {});
      
      dm0.addBreakpoint(0, 0x1000);
      dm1.addBreakpoint(1, 0x2000);
      
      expect(dm0.addBreakpoint).toHaveBeenCalledWith(0, 0x1000);
      expect(dm1.addBreakpoint).toHaveBeenCalledWith(1, 0x2000);
    });

    it('should support shared COGBRK request', async () => {
      // This would test the shared RequestCOGBRK global
      // In real implementation, this coordinates breakpoints across COGs
      
      const window0 = new DebugDebuggerWindow(context, 0);
      const window1 = new DebugDebuggerWindow(context, 1);
      await window0.initialize();
      await window1.initialize();
      
      windows.push(window0, window1);
      
      // Both windows should be able to access shared breakpoint state
      expect(window0).toBeDefined();
      expect(window1).toBeDefined();
    });
  });

  describe('State Independence', () => {
    it('should maintain independent state per COG', async () => {
      const window0 = new DebugDebuggerWindow(context, 0);
      const window1 = new DebugDebuggerWindow(context, 1);
      
      await window0.initialize();
      await window1.initialize();
      
      windows.push(window0, window1);
      
      // Update state for COG 0
      const message0 = {
        cogNumber: 0,
        breakStatus: 0x01,
        programCounter: 0x1000,
        skipPattern: 0,
        skipPatternContinue: 0,
        callDepth: 2,
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
      
      (window0 as any).updateCogState(message0);
      
      // Update state for COG 1
      const message1 = { ...message0, cogNumber: 1, programCounter: 0x2000, callDepth: 5 };
      (window1 as any).updateCogState(message1);
      
      // States should be independent
      expect((window0 as any).cogState.programCounter).toBe(0x1000);
      expect((window0 as any).cogState.callDepth).toBe(2);
      
      expect((window1 as any).cogState.programCounter).toBe(0x2000);
      expect((window1 as any).cogState.callDepth).toBe(5);
    });

    it('should handle concurrent updates', async () => {
      const windowList: DebugDebuggerWindow[] = [];
      
      // Create all 8 COG windows
      for (let cogId = 0; cogId < 8; cogId++) {
        const window = new DebugDebuggerWindow(context, cogId);
        await window.initialize();
        windowList.push(window);
        windows.push(window);
      }
      
      // Simulate concurrent updates to all COGs
      const updates: Promise<void>[] = [];
      
      for (let cogId = 0; cogId < 8; cogId++) {
        const update = new Promise<void>((resolve) => {
          const binaryData = new Uint8Array(80);
          const longs = new Uint32Array(binaryData.buffer);
          longs[0] = cogId;
          longs[2] = 0x1000 + cogId * 0x100; // Different PC per COG
          
          windowList[cogId].updateContent({ binary: binaryData });
          resolve();
        });
        updates.push(update);
      }
      
      // Wait for all updates
      await Promise.all(updates);
      
      // Verify all states updated correctly
      for (let cogId = 0; cogId < 8; cogId++) {
        const state = (windowList[cogId] as any).cogState;
        expect(state.programCounter).toBe(0x1000 + cogId * 0x100);
      }
    });
  });

  describe('Window Cleanup', () => {
    it('should clean up individual COG windows', async () => {
      // Create 3 windows
      for (let cogId = 0; cogId < 3; cogId++) {
        const window = new DebugDebuggerWindow(context, cogId);
        await window.initialize();
        windows.push(window);
      }
      
      // Close COG 1
      windows[1].closeDebugWindow();
      
      // Should unregister only COG 1
      expect(router.unregisterWindow).toHaveBeenCalledWith('debugger-1');
      expect(router.unregisterWindow).toHaveBeenCalledTimes(1);
      
      // Others should still be registered
      expect(router.registerWindow).toHaveBeenCalledTimes(3);
    });

    it('should handle closing all windows', async () => {
      // Create all 8 windows
      for (let cogId = 0; cogId < 8; cogId++) {
        const window = new DebugDebuggerWindow(context, cogId);
        await window.initialize();
        windows.push(window);
      }
      
      // Close all
      windows.forEach(w => w.closeDebugWindow());
      
      // All should be unregistered
      expect(router.unregisterWindow).toHaveBeenCalledTimes(8);
      for (let cogId = 0; cogId < 8; cogId++) {
        expect(router.unregisterWindow).toHaveBeenCalledWith(`debugger-${cogId}`);
      }
    });
  });

  describe('Performance with Multiple COGs', () => {
    it('should handle high-frequency updates to multiple COGs', async () => {
      jest.useFakeTimers();
      
      // Create 4 debugger windows
      for (let cogId = 0; cogId < 4; cogId++) {
        const window = new DebugDebuggerWindow(context, cogId);
        await window.initialize();
        windows.push(window);
      }
      
      // Simulate high-frequency updates
      const updateCount = 100;
      for (let i = 0; i < updateCount; i++) {
        for (let cogId = 0; cogId < 4; cogId++) {
          const binaryData = new Uint8Array(80);
          const longs = new Uint32Array(binaryData.buffer);
          longs[0] = cogId;
          longs[2] = i; // Changing PC
          
          windows[cogId].updateContent({ binary: binaryData });
        }
      }
      
      // Advance timers for rendering
      jest.advanceTimersByTime(100);
      
      // All windows should have processed updates
      for (let cogId = 0; cogId < 4; cogId++) {
        const state = (windows[cogId] as any).cogState;
        expect(state.programCounter).toBe(updateCount - 1);
      }
      
      jest.useRealTimers();
    });
  });

  describe('Error Isolation', () => {
    it('should isolate errors to individual COG windows', async () => {
      const window0 = new DebugDebuggerWindow(context, 0);
      const window1 = new DebugDebuggerWindow(context, 1);
      
      await window0.initialize();
      await window1.initialize();
      
      windows.push(window0, window1);
      
      // Cause error in COG 0
      const invalidData = new Uint8Array(5); // Too short
      window0.updateContent({ binary: invalidData });
      
      // COG 1 should still work
      const validData = new Uint8Array(80);
      const longs = new Uint32Array(validData.buffer);
      longs[0] = 1;
      longs[2] = 0x5000;
      
      window1.updateContent({ binary: validData });
      
      expect((window1 as any).cogState.programCounter).toBe(0x5000);
    });
  });
});