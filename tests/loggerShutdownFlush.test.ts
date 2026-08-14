/** @format */

// tests/loggerShutdownFlush.test.ts
//
// Two main-process defects found while fixing the end-of-run tail, both about lines
// that were produced but never reached the screen:
//
//   1. SHUTDOWN TRUNCATION — closeDebugWindow()'s "final flush" called processBatch()
//      once. processBatch() moves at most BATCH_SIZE_LIMIT (100) lines and re-arms a
//      timer for the rest; at shutdown that timer never fires, so everything past the
//      first hundred was stranded. It then closed the window without waiting for a
//      paint. Affects app quit and --exit-on-end-session.
//
//   2. FALSE REPLAY BANNER — replayBufferedLines() pushed REPLAY_LINES (1000) through
//      queueForDisplay(), which sheds above MAX_DISPLAY_BACKLOG (300). Reopening the
//      viewer therefore dropped ~70% of the replay and printed "display fell behind",
//      which was untrue: the display had not fallen behind, the replay had over-fed
//      its own queue.

import { LoggerWindow } from '../src/classes/loggerWin';
import { makeLoggerFixture, sentDisplayLines, LoggerFixture } from './fixtures/loggerWindowFixture';

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
  getFormattedDateTime: jest.fn().mockReturnValue('20260814_120000'),
  getFormattedDateTimeISO: jest.fn().mockReturnValue('2026-08-14T12:00:00.000Z')
}));

const BATCH_SIZE_LIMIT = 100; // LoggerWindow.BATCH_SIZE_LIMIT
const MAX_DISPLAY_BACKLOG = 300; // LoggerWindow.MAX_DISPLAY_BACKLOG

describe('LoggerWindow — getting the last lines onto the screen', () => {
  let fixture: LoggerFixture;
  let logger: LoggerWindow;

  beforeEach(() => {
    LoggerWindow['instance'] = null;
    fixture = makeLoggerFixture();
    logger = LoggerWindow.getInstance(fixture.context);
    // Stand in for a live viewer: a window exists and its renderer accepts IPC.
    logger['debugWindow'] = fixture.browserWindow;
    logger['rendererReady'] = true;
    logger['viewerOpen'] = true;
    fixture.browserWindow.webContents.send.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /** Put `count` lines in the display queue without going through the file path. */
  function queueLines(count: number): void {
    for (let i = 0; i < count; i++) {
      logger['queueForDisplay'](`line ${i}`, 'cog-message');
    }
  }

  describe('shutdown flush', () => {
    // NORMAL — the defect: more than one batch's worth must survive shutdown.
    it('sends every queued line, not just the first batch', async () => {
      const queued = 250; // > 2 batches, < MAX_DISPLAY_BACKLOG so nothing is shed
      queueLines(queued);
      expect(logger['renderQueue'].length).toBe(queued);

      await logger.flushRenders();

      expect(logger['renderQueue'].length).toBe(0);
      const sent = sentDisplayLines(fixture.browserWindow);
      expect(sent.length).toBe(queued);
      expect(sent[0].message).toBe('line 0');
      expect(sent[sent.length - 1].message).toBe(`line ${queued - 1}`);
    });

    // ERROR — the specific regression: exactly the truncation the old code produced.
    it('does not stop at BATCH_SIZE_LIMIT', async () => {
      queueLines(250);
      await logger.flushRenders();
      expect(sentDisplayLines(fixture.browserWindow).length).toBeGreaterThan(BATCH_SIZE_LIMIT);
    });

    // NORMAL — sending is not showing; the renderer must be told to paint inline
    // rather than left waiting for an animation frame that a hidden window may
    // never be granted.
    it('makes the renderer paint before returning', async () => {
      queueLines(120);
      await logger.flushRenders();

      const scripts = fixture.browserWindow.webContents.executeJavaScript.mock.calls.map((c: any[]) => c[0]);
      expect(scripts.some((s: string) => s.includes('__flushPaint'))).toBe(true);
    });

    // EDGE — a renderer that never answers must not hold the exit open.
    it('gives up on a renderer that never answers', async () => {
      queueLines(10);
      fixture.browserWindow.webContents.executeJavaScript.mockReturnValue(new Promise(() => undefined));

      await expect(logger.flushRenders()).resolves.toBeUndefined();
    }, 10000);

    // EDGE — nothing queued is not an error, and must not leave a timer armed.
    it('is a no-op with an empty queue', async () => {
      await logger.flushRenders();

      expect(sentDisplayLines(fixture.browserWindow).length).toBe(0);
      expect(logger['batchTimer']).toBeNull();
    });

    // ERROR — a torn-down renderer stops progress; the drain must not spin on it.
    it('terminates when the window is already gone', async () => {
      queueLines(250);
      fixture.browserWindow.isDestroyed.mockReturnValue(true);

      await expect(logger.flushRenders()).resolves.toBeUndefined();
      expect(logger['batchTimer']).toBeNull();
    });

    // NORMAL — closeDebugWindow uses the same full drain.
    it('closeDebugWindow drains past the first batch too', () => {
      queueLines(250);
      logger.closeDebugWindow();

      expect(sentDisplayLines(fixture.browserWindow).length).toBeGreaterThan(BATCH_SIZE_LIMIT);
    });
  });

  describe('viewer replay', () => {
    /** Fill the in-memory scrollback the way a session does. */
    function fillScrollback(count: number): void {
      const buffer = logger['lineBuffer'] as string[];
      for (let i = 0; i < count; i++) buffer.push(`history ${i}`);
    }

    // NORMAL — the whole replay arrives, not the tail that survives a live-path shed.
    it('replays every line it says it is replaying', () => {
      fillScrollback(1000);
      logger['replayBufferedLines']();

      const sent = sentDisplayLines(fixture.browserWindow);
      const banner = sent[0];
      const replayed = sent.slice(1);

      expect(banner.message).toContain('replaying the last');
      expect(banner.message).toContain(replayed.length.toLocaleString());
      expect(replayed.length).toBeGreaterThan(MAX_DISPLAY_BACKLOG);
      expect(replayed[replayed.length - 1].message).toBe('history 999');
    });

    // ERROR — the false banner. The display did not fall behind; saying so was a lie.
    it('does not claim the display fell behind', () => {
      fillScrollback(1000);
      logger['replayBufferedLines']();

      const sent = sentDisplayLines(fixture.browserWindow);
      expect(sent.some((m) => m.message.includes('fell behind'))).toBe(false);
    });

    // EDGE — the replay must not disturb the live queue or the shed accounting.
    it('leaves the live display queue untouched', () => {
      fillScrollback(1000);
      logger['replayBufferedLines']();

      expect(logger['renderQueue'].length).toBe(0);
      expect(logger['displaySheddedLines']).toBe(0);
    });

    // EDGE — replaying must not grow the scrollback it is replaying from.
    it('does not feed the replay back into the scrollback', () => {
      fillScrollback(500);
      const before = (logger['lineBuffer'] as string[]).length;

      logger['replayBufferedLines']();

      expect((logger['lineBuffer'] as string[]).length).toBe(before);
    });

    // EDGE — nothing to replay, nothing sent (no bare banner).
    it('says nothing when there is no history', () => {
      logger['replayBufferedLines']();
      expect(sentDisplayLines(fixture.browserWindow).length).toBe(0);
    });
  });

  describe('scrollback preference', () => {
    // NORMAL — the preference reaches the renderer.
    it('sends the setting to the viewer', () => {
      logger.updateScrollbackPreference(2500);

      const calls = fixture.browserWindow.webContents.send.mock.calls.filter(
        (c: any[]) => c[0] === 'set-scrollback-lines'
      );
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toBe(2500);
    });

    // EDGE — clamped on the way in, so the stored value is the effective one.
    it.each([
      [50, 100],
      [999999, 10000]
    ])('clamps %i to %i', (given, expected) => {
      logger.updateScrollbackPreference(given);
      expect(logger['scrollbackLines']).toBe(expected);
    });

    // ERROR — the setting must survive arriving while no viewer exists, which is
    // what made it look like it worked and then silently revert.
    it('remembers a setting applied with no viewer open', () => {
      logger['debugWindow'] = null;
      logger.updateScrollbackPreference(4000);

      expect(logger['scrollbackLines']).toBe(4000);
    });
  });
});
