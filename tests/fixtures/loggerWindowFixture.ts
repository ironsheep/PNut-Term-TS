/** @format */

// tests/fixtures/loggerWindowFixture.ts
//
// Shared construction fixture for LoggerWindow tests.
//
// LoggerWindow reaches for fs, Electron's BrowserWindow, and a fairly wide Context
// before it will construct at all, so every suite that exercises it needs the same
// scaffolding. This is that scaffolding in one place — the alternative is each suite
// carrying its own copy, which is how two suites end up disagreeing about what a
// LoggerWindow is.
//
// The caller still owns the `jest.mock('fs')` / `jest.mock('electron')` calls: those
// are hoisted to module scope by ts-jest and cannot be applied from in here.

import { BrowserWindow } from 'electron';
import { Context } from '../../src/utils/context';

export interface LoggerFixture {
  context: Context;
  browserWindow: any;
  writeStream: any;
}

/**
 * Wire up fs + Electron mocks and build the Context a LoggerWindow needs.
 * Call from `beforeEach`, after clearing the singleton.
 */
export function makeLoggerFixture(): LoggerFixture {
  const writeStream = {
    write: jest.fn((_data: any, callback?: (err: any) => void) => {
      if (callback) callback(null);
    }),
    end: jest.fn((callback?: () => void) => {
      if (callback) callback();
    }),
    destroyed: false,
    writable: true,
    once: jest.fn((event: string, cb: (...args: any[]) => void) => {
      // Immediately trigger 'open' so the header write path is exercised
      if (event === 'open') cb(3); // fd = 3
    }),
    on: jest.fn()
  };

  const fsMock = require('fs');
  fsMock.createWriteStream = jest.fn().mockReturnValue(writeStream);
  fsMock.existsSync = jest.fn().mockReturnValue(true);
  fsMock.mkdirSync = jest.fn();
  fsMock.statSync = jest.fn().mockReturnValue({ size: 1024 });
  fsMock.fsyncSync = jest.fn();

  const context = {
    libraryFolder: '/lib',
    extensionFolder: '/ext',
    currentFolder: '/current',
    logger: { logMessage: jest.fn() } as any,
    actions: {
      writeRAM: false,
      writeFlash: false,
      binFilename: '',
      binDirspec: ''
    },
    runEnvironment: {
      serialPortDevices: [],
      selectedPropPlug: '',
      logFilename: 'test.log',
      developerModeEnabled: false,
      debugBaudrate: 2000000,
      ideMode: false,
      rtsOverride: false,
      loggingEnabled: true,
      loggingLevel: 'INFO',
      logToFile: true,
      logToConsole: false
    },
    // Required by LoggerWindow.initializeLogFile()
    getLogDirectory: jest.fn().mockReturnValue('/tmp/test-logs'),
    preferences: {
      terminal: { colorTheme: 'green' }
    }
  } as unknown as Context;

  const browserWindow: any = {
    loadHTML: jest.fn(),
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn((event: string, callback: () => void) => {
      if (event === 'ready-to-show') callback();
    }),
    webContents: {
      send: jest.fn(),
      // Resolves like the real thing so `await executeJavaScript(...)` settles.
      executeJavaScript: jest.fn().mockResolvedValue(0),
      once: jest.fn(),
      on: jest.fn(),
      setMaxListeners: jest.fn()
    },
    show: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    removeAllListeners: jest.fn(),
    setPosition: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 })
  };

  (BrowserWindow as unknown as jest.Mock).mockImplementation(() => browserWindow);

  return { context, browserWindow, writeStream };
}

/** Every `append-messages-batch` payload the window has sent, flattened in order. */
export function sentDisplayLines(browserWindow: any): Array<{ message: string; type: string }> {
  return browserWindow.webContents.send.mock.calls
    .filter((call: any[]) => call[0] === 'append-messages-batch')
    .flatMap((call: any[]) => call[1]);
}
