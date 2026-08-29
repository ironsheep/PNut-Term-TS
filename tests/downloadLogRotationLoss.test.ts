/** @format */

// tests/downloadLogRotationLoss.test.ts
//
// The deterministic log-rotation wipe (found while chasing the v1.0.5 late
// "Download completed" report, and fixed in the same pass).
//
// SYMPTOM: a fresh post-download log never contained the download metadata line
//   "[DOWNLOAD TO RAM] File: … | Size: … | Modified: …"
// — the one message that should have HEADED the new log. Not sometimes. Never.
//
// CAUSE: MainWindow.executeDownload() calls handleDownloadStart() and then, six
// lines later and still in the SAME synchronous turn, logs the metadata line.
// handleDownloadStart() sets `logFileReady = false` and calls `oldLogFile.end(cb)`.
// A real fs stream close cannot call back before the next event-loop turn, so the
// metadata line is always queued into `pendingLogMessages` first — and the callback
// then did `this.pendingLogMessages = []`, deleting it. The synchronous emit can
// never win that race, which makes this a certainty rather than a race.
//
// FIX: clear `pendingLogMessages` synchronously at rotation time (dropping anything
// stale from the OLD log) and stop clearing it in the close callback, so entries
// queued during the gap survive into the new file via flushPendingMessages().
//
// THE ASYNC `end()` IS LOAD-BEARING IN THIS TEST. The shared fixture's write-stream
// fires its `end` callback synchronously, which does NOT reproduce the defect —
// with a synchronous close the wipe happens BEFORE the metadata line is queued.
// These tests install a deferred `end`, which is what fs actually does.

import { LoggerWindow } from '../src/classes/loggerWin';
import { makeLoggerFixture } from './fixtures/loggerWindowFixture';

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
  getFormattedDateTime: jest.fn().mockReturnValue('20260829_120000'),
  getFormattedDateTimeISO: jest.fn().mockReturnValue('2026-08-29T12:00:00.000Z')
}));

const DOWNLOAD_META = '[DOWNLOAD TO RAM] File: blinky.bin | Size: 1024 bytes | Modified: 2026-08-29T12:00:00.000Z';

describe('log rotation on download — messages logged during the rotation gap', () => {
  let logger: any;
  let fixture: any;
  let closeCallbacks: Array<() => void>;

  beforeEach(() => {
    LoggerWindow['instance'] = null;
    closeCallbacks = [];
    fixture = makeLoggerFixture();

    // Model fs: end() defers its callback instead of running it inline.
    fixture.writeStream.end = jest.fn((cb?: () => void) => {
      if (cb) closeCallbacks.push(cb);
    });

    logger = LoggerWindow.getInstance(fixture.context);
    logger['debugWindow'] = fixture.browserWindow;
    logger['rendererReady'] = true;
    logger['viewerOpen'] = true;
    logger['logFile'] = fixture.writeStream;
    logger['logFileReady'] = true;
    logger['pendingLogMessages'] = [];
    logger['writeBuffer'] = [];
  });

  /** Run the deferred stream-close callbacks, i.e. advance past the rotation gap. */
  function completeClose(): void {
    const pending = closeCallbacks.splice(0);
    for (const cb of pending) cb();
  }

  /**
   * Everything that actually reached the log stream, plus anything still queued.
   * The write path drains pendingLogMessages -> writeBuffer -> stream, so checking
   * only the in-memory queues misses entries that already landed — which is the
   * whole point: we care what ends up in the FILE.
   */
  function everythingLogged(): string {
    const written = fixture.writeStream.write.mock.calls.map((c: any[]) => String(c[0])).join('');
    return [written, ...logger['pendingLogMessages'], ...logger['writeBuffer']].join('\n');
  }

  it('preserves the download metadata line emitted synchronously after rotation starts', () => {
    // Exactly MainWindow.executeDownload()'s ordering.
    logger.handleDownloadStart();
    logger.logSystemMessage(DOWNLOAD_META);

    // The line must be held, not dropped on the floor, while the old file closes.
    const queuedDuringGap = logger['pendingLogMessages'].join('\n');
    expect(queuedDuringGap).toContain('[DOWNLOAD TO RAM]');

    // Now let the old stream finish closing — this is where it used to be deleted.
    completeClose();

    const everythingWritten = everythingLogged();
    expect(everythingWritten).toContain('[DOWNLOAD TO RAM]');
    expect(everythingWritten).toContain('blinky.bin');
  });

  it('keeps every message queued during the gap, in order', () => {
    logger.handleDownloadStart();
    logger.logSystemMessage('first');
    logger.logSystemMessage('second');
    logger.logSystemMessage('third');

    completeClose();

    const written = everythingLogged();
    const positions = ['first', 'second', 'third'].map((m) => written.indexOf(m));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('drops messages left over from BEFORE the rotation — those belong to the old log', () => {
    // A message stranded in the pending queue from an earlier, unready period.
    logger['logFileReady'] = false;
    logger.logSystemMessage('stale-from-previous-session');
    expect(logger['pendingLogMessages'].join()).toContain('stale-from-previous-session');

    logger['logFileReady'] = true;
    logger['logFile'] = fixture.writeStream;
    logger.handleDownloadStart();

    // Cleared synchronously at rotation, before the gap opens.
    expect(logger['pendingLogMessages'].join()).not.toContain('stale-from-previous-session');
  });

  it('does not wipe the queue when the close callback finally runs', () => {
    logger.handleDownloadStart();
    logger.logSystemMessage(DOWNLOAD_META);

    const beforeClose = logger['pendingLogMessages'].length;
    expect(beforeClose).toBeGreaterThan(0);

    completeClose();

    // The regression pin: the callback must not empty a queue it did not fill.
    const survived = everythingLogged();
    expect(survived).toContain('[DOWNLOAD TO RAM]');
  });
});
