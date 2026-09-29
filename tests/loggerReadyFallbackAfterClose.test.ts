/** @format */

// tests/loggerReadyFallbackAfterClose.test.ts
//
// SYMPTOM (Linux, v1.0.10, 2026-09-29):
//   [DEBUG LOGGER] ⚠️ Timeout waiting for renderer ready events, forcing ready state
//   pnut-term-ts: ERROR- Uncaught exception: TypeError: Object has been destroyed
//
// CAUSE: createDebugWindow() arms a 2 s fallback that forces the "renderer ready" path
// when neither ready-to-show nor did-finish-load has fired. On a slow host the renderer
// had not loaded when a batch-mode shutdown closed the window (closeDebugWindow), so the
// fallback fired against a DESTROYED BrowserWindow and window.show() threw from a timer.
// Same teardown-race deref class as v1.0.5: a field used after the thing it names is gone.

import { LoggerWindow } from '../src/classes/loggerWin';
import { makeLoggerFixture, LoggerFixture } from './fixtures/loggerWindowFixture';

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  screen: {
    getAllDisplays: jest.fn(),
    getPrimaryDisplay: jest.fn(() => ({ workAreaSize: { width: 1920, height: 1080 } }))
  },
  ipcMain: { on: jest.fn(), removeListener: jest.fn() }
}));

jest.mock('fs');
jest.mock('../src/utils/files', () => ({
  ensureDirExists: jest.fn(),
  getFormattedDateTime: jest.fn().mockReturnValue('20260929_120000'),
  getFormattedDateTimeISO: jest.fn().mockReturnValue('2026-09-29T12:00:00.000Z')
}));

const READY_FALLBACK_MS = 2000; // LoggerWindow's renderer-ready fallback

describe('LoggerWindow — ready fallback after the window is gone', () => {
  let fixture: LoggerFixture;
  let destroyed: boolean;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    LoggerWindow['instance'] = null;
    fixture = makeLoggerFixture();
    // A renderer that has NOT loaded: neither ready event ever fires.
    fixture.browserWindow.once = jest.fn();
    fixture.browserWindow.webContents.once = jest.fn();
    // A real BrowserWindow throws on use once destroyed; model exactly that.
    destroyed = false;
    fixture.browserWindow.isDestroyed = jest.fn(() => destroyed);
    fixture.browserWindow.close = jest.fn(() => {
      destroyed = true;
    });
    const throwIfDestroyed = () => {
      if (destroyed) throw new TypeError('Object has been destroyed');
    };
    fixture.browserWindow.show = jest.fn(throwIfDestroyed);
    fixture.browserWindow.focus = jest.fn(throwIfDestroyed);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('a shutdown that closes the window before its renderer loads does not throw from the fallback', () => {
    const logger = LoggerWindow.getInstance(fixture.context);
    logger.closeDebugWindow(); // the batch-mode shutdown path
    expect(destroyed).toBe(true);

    expect(() => jest.advanceTimersByTime(READY_FALLBACK_MS + 100)).not.toThrow();
    expect(fixture.browserWindow.show).not.toHaveBeenCalled();
    // The window is gone: no slow-load notice either.
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Renderer still loading'));
  });

  // Survey finding (same session): the 2 s fallback used to FORCE ready on a live window whose
  // page had not loaded, sending the theme, replay and first lines to IPC listeners that did not
  // exist yet — and readyHandled then stopped the real load event from resending them.
  it('a live window whose renderer is merely slow is NOT forced ready — nothing is sent into the void', () => {
    const logger = LoggerWindow.getInstance(fixture.context);
    logger.logSystemMessage('early line');

    jest.advanceTimersByTime(READY_FALLBACK_MS + 100);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Renderer still loading'));
    expect(logger['rendererReady']).toBe(false);
    expect(fixture.browserWindow.webContents.send).not.toHaveBeenCalled();
  });

  it('when the page does load, readiness runs then — theme and queued lines are delivered', () => {
    const logger = LoggerWindow.getInstance(fixture.context);
    logger.logSystemMessage('early line');
    jest.advanceTimersByTime(READY_FALLBACK_MS + 100); // slow: the notice fires first

    // The real event arrives late.
    const didFinishLoad = (fixture.browserWindow.webContents.once as jest.Mock).mock.calls.find(
      (c: any[]) => c[0] === 'did-finish-load'
    )![1] as () => void;
    didFinishLoad();
    jest.advanceTimersByTime(100);

    expect(logger['rendererReady']).toBe(true);
    expect(fixture.browserWindow.show).toHaveBeenCalledTimes(1);
    const channels = (fixture.browserWindow.webContents.send as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(channels).toContain('set-theme');
    const lines = (fixture.browserWindow.webContents.send as jest.Mock).mock.calls
      .filter((c: any[]) => c[0] === 'append-messages-batch')
      .flatMap((c: any[]) => c[1])
      .map((m: any) => m.message);
    expect(lines.some((l: string) => l.includes('early line'))).toBe(true);
  });
});
