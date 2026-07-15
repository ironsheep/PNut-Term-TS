/** @format */

/**
 * Regression guard for the test11 debugger wedge (v0.9.93).
 *
 * ROOT CAUSE that this pins: a DebugDebuggerWindow is created lazily inside
 * MainWindow's `debuggerPacketReceived` handler, which fires from
 * MessageRouter.route() BEFORE that same route dispatches the creating Phase-1
 * to the window's router destination. If the window registers with the
 * WindowRouter only on 'ready-to-show' (async, after the BrowserWindow loads),
 * the creating Phase-1's destination dispatch finds NO registered window — so
 * the old code compensated with a SECOND, direct main-side feed
 * (`debuggerWindow.updateContent(packet)`). Once the window later registered,
 * EVERY Phase-1 was then delivered twice (direct bare feed + typed router
 * feed). The duplicate drove the controller to emit TWO Phase-2 replies per
 * break, byte-desyncing the P2's fixed-size Phase-2 read and wedging the debug
 * session (wire-confirmed: usb-traffic_260715-124708.log — break 2 sent 2×
 * Phase-2, both $800 STALL, then the P2 went silent).
 *
 * THE FIX: register with the WindowRouter SYNCHRONOUSLY in the constructor, so
 * the creating Phase-1 is delivered through the SINGLE typed router path and the
 * direct feed is removed entirely.
 *
 * This test locks in the synchronous-registration half of the fix: it fails on
 * the pre-fix code (registration deferred to a 'ready-to-show' that never fires
 * here) and passes on the fixed code. The direct-feed removal is covered by the
 * mainWindow source (creation-only handler) + the single-delivery behavior the
 * debuggerReplay / debuggerWorkerSingleFramer suites already exercise.
 */

import { createMockContext } from './shared/mockHelpers';

const mockShared: {
  nextWcId: number;
  ipc: Array<{ channel: string; listener: (...args: unknown[]) => void }>;
} = { nextWcId: 700, ipc: [] };

jest.mock('electron', () => {
  const helpers = require('./shared/mockHelpers');
  return {
    BrowserWindow: jest.fn().mockImplementation(() => {
      const win = helpers.createMockBrowserWindow();
      win.webContents.id = ++mockShared.nextWcId;
      return win;
    }),
    ipcMain: {
      on: (channel: string, listener: (...args: unknown[]) => void) => {
        mockShared.ipc.push({ channel, listener });
      },
      removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
        const i = mockShared.ipc.findIndex((e) => e.channel === channel && e.listener === listener);
        if (i >= 0) mockShared.ipc.splice(i, 1);
      }
    },
    app: { getPath: jest.fn().mockReturnValue('/mock/path') },
    nativeImage: { createFromBuffer: jest.fn().mockReturnValue({ toPNG: jest.fn() }) }
  };
});

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

import { DebugDebuggerWindow } from '../src/classes/debugDebuggerWin';
import { WindowRouter } from '../src/classes/shared/windowRouter';

describe('debugger window — synchronous WindowRouter registration (test11 wedge regression)', () => {
  let registerSpy: jest.SpyInstance;

  beforeEach(() => {
    mockShared.ipc = [];
    const router = WindowRouter.getInstance();
    // Clean any prior debugger registrations so the id assertion is unambiguous.
    router.unregisterWindow('debugger-0');
    router.unregisterWindow('debugger-3');
    registerSpy = jest.spyOn(router, 'registerWindow');
  });

  afterEach(() => {
    registerSpy.mockRestore();
    const router = WindowRouter.getInstance();
    router.unregisterWindow('debugger-0');
    router.unregisterWindow('debugger-3');
  });

  it('registers with the router during construction — before any ready-to-show', () => {
    // Explicit x/y bypasses WindowPlacer. No ready-to-show is dispatched here, so
    // registration MUST come from the constructor itself.
    new DebugDebuggerWindow(createMockContext() as never, 0, { x: 0, y: 0, width: 100, height: 100 });

    const debuggerRegistrations = registerSpy.mock.calls.filter((c) => c[0] === 'debugger-0');
    expect(debuggerRegistrations).toHaveLength(1);
    expect(debuggerRegistrations[0][1]).toBe('debugger'); // windowType
    expect(typeof debuggerRegistrations[0][2]).toBe('function'); // handler bound
  });

  it('registers under the per-cog window id so each cog routes independently', () => {
    new DebugDebuggerWindow(createMockContext() as never, 3, { x: 0, y: 0, width: 100, height: 100 });

    const router = WindowRouter.getInstance();
    // The router now has this cog's window keyed by its own id — the first typed
    // Phase-1 for cog 3 will land here, no direct main-side feed needed.
    expect(registerSpy.mock.calls.some((c) => c[0] === 'debugger-3')).toBe(true);
  });
});
