/** @format */

// tests/shutdownDrainDeadline.test.ts
//
// Slow-host survey (2026-09-29). drainPendingData() gave EACH stage of a window's drain the full
// SHUTDOWN_DRAIN_TIMEOUT_MS: the message chain (10 s), then paint, then pending SAVEs (10 s) —
// up to ~21 s, past the 15 s / 16 s backstops that app.exit() the process. On a slow host a
// legitimate SAVE could be killed by the guard meant to outlast the drain. And a chain that timed
// out returned void, so a queued SAVE that never ran was lost with exit 0.
//
// Pinned: one deadline covers the whole drain; a chain timeout escalates to FlushTimeout.

import { jest } from '@jest/globals';
import { MainWindow } from '../src/classes/mainWindow';
import { LoggerWindow } from '../src/classes/loggerWin';
import { ExitCode, SHUTDOWN_DRAIN_TIMEOUT_MS } from '../src/utils/exitCodes';
import { createMockBrowserWindow } from './shared/mockHelpers';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';

jest.mock('electron', () => ({
  app: {
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn(),
    getPath: jest.fn().mockReturnValue('/tmp')
  },
  BrowserWindow: jest.fn(() => createMockBrowserWindow()),
  Menu: { buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn() },
  MenuItem: jest.fn(),
  dialog: { showSaveDialog: jest.fn(), showMessageBox: jest.fn() },
  screen: {
    getPrimaryDisplay: jest.fn().mockReturnValue({ workAreaSize: { width: 1920, height: 1080 } })
  },
  ipcMain: { on: jest.fn(), removeAllListeners: jest.fn() }
}));

jest.mock('fs');
jest.mock('../src/utils/usb.serial');
jest.mock('../src/utils/usbSerialProxy');
jest.mock('../src/classes/loggerWin', () => ({
  LoggerWindow: { getInstance: jest.fn() }
}));

/** A display whose chain drain takes `chainMs` and reports `chainOk`; records flushPending's budget. */
function fakeDisplay(chainMs: number, chainOk: boolean) {
  const pendingBudgets: number[] = [];
  return {
    pendingBudgets,
    flushMessageChain: jest.fn(
      (_t: number) => new Promise<boolean>((resolve) => setTimeout(() => resolve(chainOk), chainMs))
    ),
    flushRenders: jest.fn(() => Promise.resolve()),
    flushPending: jest.fn((t: number) => {
      pendingBudgets.push(t);
      return Promise.resolve(true);
    })
  };
}

describe('shutdown drain runs on ONE deadline', () => {
  let mainWindow: any;
  let cleanup: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    const testSetup = setupDebugWindowTests({ windowType: 'term', displayName: 'TestLogger' });
    const mockContext: any = testSetup.mockContext;
    cleanup = testSetup.cleanup;
    mockContext.runEnvironment = { selectedPropPlug: '/dev/ttyUSB0', ideMode: false, loggingEnabled: false };
    mockContext.currentFolder = '/test/workspace';
    (LoggerWindow.getInstance as jest.Mock).mockReturnValue({
      updateContent: jest.fn(),
      on: jest.fn(),
      handleDTRReset: jest.fn(),
      logSystemMessage: jest.fn()
    });
    mainWindow = new MainWindow(mockContext);
    mainWindow.displays = {};
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('time spent draining the chain comes out of the budget left for pending SAVEs', async () => {
    const d = fakeDisplay(8000, true);
    mainWindow.displays['slow'] = d;

    const drain = mainWindow.drainPendingData();
    await jest.advanceTimersByTimeAsync(8000);
    await drain;

    expect(d.pendingBudgets).toHaveLength(1);
    expect(d.pendingBudgets[0]).toBeLessThanOrEqual(SHUTDOWN_DRAIN_TIMEOUT_MS - 8000);
    expect(mainWindow.shutdownExitCode).toBe(ExitCode.OK);
  });

  it('a chain that times out is reported: exit escalates to FlushTimeout', async () => {
    mainWindow.displays['stuck'] = fakeDisplay(SHUTDOWN_DRAIN_TIMEOUT_MS, false);

    const drain = mainWindow.drainPendingData();
    await jest.advanceTimersByTimeAsync(SHUTDOWN_DRAIN_TIMEOUT_MS);
    await drain;

    expect(mainWindow.shutdownExitCode).toBe(ExitCode.FlushTimeout);
  });

  // Decision 2026-09-29 (exit code 70): an uncaught exception used to exit with whatever was set —
  // usually OK, so a crash read as success.
  describe('reportInternalError (uncaught exception in the GUI process)', () => {
    it('DURING the run a crash exits InternalError (70), not OK', () => {
      expect(mainWindow.reportInternalError()).toBe(ExitCode.InternalError);
      expect(mainWindow.shutdownExitCode).toBe(ExitCode.InternalError);
    });

    it('never overwrites a more specific failure (the Pi run: DownloadFailed then a crash)', () => {
      mainWindow.shutdownExitCode = ExitCode.DownloadFailed;
      expect(mainWindow.reportInternalError()).toBe(ExitCode.DownloadFailed);
    });

    it('once shutdown has begun, a teardown stumble keeps the decided verdict', () => {
      mainWindow.isShuttingDown = true;
      expect(mainWindow.reportInternalError()).toBe(ExitCode.OK);
    });
  });

  it('a chain timeout does not overwrite a more specific failure already being reported', async () => {
    mainWindow.shutdownExitCode = ExitCode.DownloadFailed;
    mainWindow.displays['stuck'] = fakeDisplay(SHUTDOWN_DRAIN_TIMEOUT_MS, false);

    const drain = mainWindow.drainPendingData();
    await jest.advanceTimersByTimeAsync(SHUTDOWN_DRAIN_TIMEOUT_MS);
    await drain;

    expect(mainWindow.shutdownExitCode).toBe(ExitCode.DownloadFailed);
  });
});
