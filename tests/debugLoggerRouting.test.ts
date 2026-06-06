/**
 * Test Debug Logger window creation and routing.
 *
 * The original tests used MainWindow-internal APIs (rxQueue, processRxQueue,
 * processRxData) that no longer exist — those used an old architecture where
 * MainWindow drove routing directly. The current architecture routes via
 * WindowRouter using SharedMessageType. These tests verify the routing
 * semantics through the WindowRouter layer.
 */

import { WindowRouter } from '../src/classes/shared/windowRouter';
import { SharedMessageType, ExtractedMessage } from '../src/classes/shared/sharedMessagePool';

// Mock Electron — tests run in Node without a real display
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp'),
    getName: jest.fn(() => 'pnut-term-ts'),
    getVersion: jest.fn(() => '0.1.0'),
    quit: jest.fn(),
    on: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn(() => false),
    webContents: {
      send: jest.fn(),
      executeJavaScript: jest.fn(),
      on: jest.fn()
    },
    setPosition: jest.fn(),
    getPosition: jest.fn(() => [100, 100]),
    getSize: jest.fn(() => [800, 600]),
    getBounds: jest.fn(() => ({ x: 100, y: 100, width: 800, height: 600 })),
    setSize: jest.fn(),
    setTitle: jest.fn(),
    id: 1
  })),
  Menu: { buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn() },
  MenuItem: jest.fn(),
  screen: {
    getAllDisplays: jest.fn(() => [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 25, width: 1920, height: 1055 }
      }
    ]),
    getPrimaryDisplay: jest.fn(() => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 25, width: 1920, height: 1055 }
    }))
  },
  ipcMain: { on: jest.fn(), handle: jest.fn() },
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() }
}));

/** Build a test ExtractedMessage */
function makeMsg(type: SharedMessageType, text: string): ExtractedMessage {
  return { type, data: new TextEncoder().encode(text), timestamp: Date.now() };
}

describe('Debug Logger Routing', () => {
  let router: WindowRouter;

  beforeEach(() => {
    WindowRouter.resetInstance();
    router = WindowRouter.getInstance();
  });

  afterEach(() => {
    WindowRouter.resetInstance();
  });

  describe('Cog message routing', () => {
    it('should route COG0_MESSAGE to logger window when registered', () => {
      // In the current architecture, the logger registers under id "logger".
      // Verify that COG0 messages are forwarded to the logger handler.
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const msg = makeMsg(SharedMessageType.COG0_MESSAGE, 'Cog0  Test message\r\n');
      router.routeTextMessage(msg);

      expect(loggerHandler).toHaveBeenCalled();
    });

    it('should route P2_SYSTEM_INIT to logger window', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const msg = makeMsg(SharedMessageType.P2_SYSTEM_INIT, 'Cog0  INIT $0000_0000 $0000_0000 load\r\n');
      router.routeTextMessage(msg);

      expect(loggerHandler).toHaveBeenCalled();
    });

    it('should route all COG messages (0-7) to logger window', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const cogTypes = [
        SharedMessageType.COG0_MESSAGE,
        SharedMessageType.COG1_MESSAGE,
        SharedMessageType.COG2_MESSAGE,
        SharedMessageType.COG3_MESSAGE,
        SharedMessageType.COG4_MESSAGE,
        SharedMessageType.COG5_MESSAGE,
        SharedMessageType.COG6_MESSAGE,
        SharedMessageType.COG7_MESSAGE
      ];

      cogTypes.forEach((type, idx) => {
        loggerHandler.mockClear();
        const msg = makeMsg(type, `Cog${idx}  Debug message ${idx}\r\n`);
        router.routeTextMessage(msg);
        expect(loggerHandler).toHaveBeenCalled();
      });
    });

    it('should also route COG messages to individual COG window if registered', () => {
      const loggerHandler = jest.fn();
      const cog0Handler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);
      router.registerWindow('COG0', 'cog', cog0Handler);

      const msg = makeMsg(SharedMessageType.COG0_MESSAGE, 'Cog0  Debug message 4\r\n');
      router.routeTextMessage(msg);

      // Both logger and COG0 window receive the message
      expect(loggerHandler).toHaveBeenCalled();
      expect(cog0Handler).toHaveBeenCalled();
    });

    it('should route backtick commands to logger window', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const msg = makeMsg(SharedMessageType.BACKTICK_SCOPE, "`SCOPE 'Test Scope' POS 200 200 SIZE 400 300");
      router.routeTextMessage(msg);

      expect(loggerHandler).toHaveBeenCalled();
    });

    it('should not route TERMINAL_OUTPUT to a non-existent logger', () => {
      // Without a 'logger' window registered, TERMINAL_OUTPUT goes to mainWindow terminal
      // (which is also not set in tests). No exception should be thrown.
      const msg = makeMsg(SharedMessageType.TERMINAL_OUTPUT, 'Regular terminal output');
      expect(() => router.routeTextMessage(msg)).not.toThrow();
    });

    it('should handle rapid COG messages efficiently', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        const type = (SharedMessageType.COG0_MESSAGE + (i % 8)) as SharedMessageType;
        const msg = makeMsg(type, `Cog${i % 8}  High speed message ${i}\r\n`);
        router.routeTextMessage(msg);
      }
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(100);
      expect(loggerHandler).toHaveBeenCalledTimes(100);
    });
  });

  describe('Window lifecycle', () => {
    it('should allow unregistering a window without errors', () => {
      const handler = jest.fn();
      router.registerWindow('logger', 'logger', handler);
      expect(router.getActiveWindows().find(w => w.windowId === 'logger')).toBeDefined();

      router.unregisterWindow('logger');
      expect(router.getActiveWindows().find(w => w.windowId === 'logger')).toBeUndefined();
    });

    it('should allow re-registering a window after unregistration', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      router.registerWindow('logger', 'logger', handler1);
      router.unregisterWindow('logger');
      router.registerWindow('logger', 'logger', handler2);

      const msg = makeMsg(SharedMessageType.COG0_MESSAGE, 'Cog0  Second session message\r\n');
      router.routeTextMessage(msg);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });
});
