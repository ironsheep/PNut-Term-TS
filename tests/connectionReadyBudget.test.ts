/** @format */

// tests/connectionReadyBudget.test.ts
//
// SYMPTOM (Linux, v1.0.10, 2026-09-29):
//   pnut-term-ts -u -r bins/t0-stopreason.bin --exit-on-end-session
//   [DOWNLOAD FAILED] t0-stopreason.bin — serial connection not ready (timed out after 10s);
//   the port never opened, so nothing was downloaded
//
// CAUSE: downloadFileFromPath() gave the connection 10 s counted from LAUNCH, but the port is
// not opened at launch — openSerialPort() runs from the main window's did-finish-load. The
// logger's 2 s ready-fallback (armed at that same did-finish-load) printed AFTER the failure,
// so the window load alone took more than 8 s on that host: the budget was spent before the
// port was ever tried. And the message could not say why, because the wait could not tell
// "still connecting" from "will never connect".
//
// These tests pin: the open attempt is timed from when it STARTS; a definite failure ends
// the wait at once with its reason; a stuck attempt and a never-started attempt each end
// with their own reason.

import { jest } from '@jest/globals';
import { MainWindow } from '../src/classes/mainWindow';
import { LoggerWindow } from '../src/classes/loggerWin';
import { UsbSerialProxy } from '../src/utils/usbSerialProxy';
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

const PRE_OPEN_TIMEOUT_MS = 60000; // MainWindow.CONNECT_PRE_OPEN_TIMEOUT_MS
const OPEN_TIMEOUT_MS = 45000; // MainWindow.CONNECT_OPEN_TIMEOUT_MS

describe('CLI download waits for the serial connection by its own clock', () => {
  let mainWindow: any;
  let cleanup: () => void;

  /** Start the wait and record when (fake time) and how it settles. */
  function startWait(): { settled: () => boolean; result: () => string | undefined } {
    let done = false;
    let value: string | undefined;
    void mainWindow.waitForConnectionReady().then((v: string | undefined) => {
      done = true;
      value = v;
    });
    return { settled: () => done, result: () => value };
  }

  async function advance(ms: number): Promise<void> {
    await jest.advanceTimersByTimeAsync(ms);
  }

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
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('a slow window load does not spend the port budget (the Linux report)', async () => {
    const wait = startWait();

    await advance(9000); // window still loading — the old code had 1 s left here
    mainWindow.serialOpenStartedAt = Date.now(); // did-finish-load → openSerialPort()
    await advance(3000); // t = 12 s: past the old 10 s-from-launch deadline
    expect(wait.settled()).toBe(false);

    mainWindow._serialPort = {};
    mainWindow.downloader = {};
    await advance(100);
    expect(wait.settled()).toBe(true);
    expect(wait.result()).toBeUndefined(); // READY
  });

  it('a FAILED open ends the wait at once, carrying the reason', async () => {
    // Real openSerialPort(), with the proxy's open rejecting as UsbSerial does.
    (UsbSerialProxy as unknown as jest.Mock).mockImplementation(() => ({
      on: jest.fn(),
      waitForPortOpen: jest.fn(() => Promise.reject(new Error('Port did not open within 2 seconds'))),
      close: jest.fn(() => Promise.resolve())
    }));
    const wait = startWait();

    await mainWindow.openSerialPort('/dev/ttyUSB0');
    await advance(100);

    expect(wait.settled()).toBe(true);
    expect(wait.result()).toBe('/dev/ttyUSB0 failed to open (Error: Port did not open within 2 seconds)');
  });

  it('no PropPlug found ends the wait at once, saying so', async () => {
    const wait = startWait();
    mainWindow.serialConnectFailure = 'no PropPlug device found'; // the auto-detect branch
    await advance(100);

    expect(wait.settled()).toBe(true);
    expect(wait.result()).toBe('no PropPlug device found');
  });

  it('an open attempt that never finishes is bounded from when it STARTED', async () => {
    const wait = startWait();
    await advance(5000);
    mainWindow._deviceNode = '/dev/ttyUSB0';
    mainWindow.serialOpenStartedAt = Date.now();

    await advance(OPEN_TIMEOUT_MS - 200);
    expect(wait.settled()).toBe(false);
    await advance(300);

    expect(wait.settled()).toBe(true);
    expect(wait.result()).toBe(`/dev/ttyUSB0 did not finish opening within ${OPEN_TIMEOUT_MS / 1000}s`);
  });

  it('a port that is never tried still ends the wait, and says the window never loaded', async () => {
    const wait = startWait();

    await advance(PRE_OPEN_TIMEOUT_MS + 100);

    expect(wait.settled()).toBe(true);
    expect(wait.result()).toBe(
      `the port was never tried: the main window had not finished loading after ${PRE_OPEN_TIMEOUT_MS / 1000}s`
    );
  });
});
