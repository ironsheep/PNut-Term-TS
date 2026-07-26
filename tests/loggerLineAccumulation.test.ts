/** @format */

// loggerLineAccumulation.test.ts
//
// Regression cover for the defect that froze the app under a sustained 2 Mbaud stream.
//
// THE CHAIN (v0.11.2, Windows hardware, 190k-line capture):
//   1. classifyData() flagged CR (0x0D) and LF (0x0A) as PST control codes — they sit inside
//      the 0x01-0x10 range — so EVERY ordinary text line classified as 'ascii-pst'.
//   2. 'ascii-pst' routes through formatPSTControlCodes(), which rewrote the line endings as
//      the literal text "<CR><LF>".
//   3. writeToLog() splits on a real '\n'. There was none, ever. Its accumulator grew without
//      bound, and each arriving chunk rescanned the WHOLE accumulator — quadratic work on the
//      main process. A 22-second capture locked the UI for ~4 minutes and wrote the entire
//      4.7 MB stream as ONE log line.
//
// These tests pin all three links: classification, line splitting, and the growth bound. The
// scaling test is the one that actually catches a regression to quadratic behavior — the
// formatting assertions alone would still pass if someone reintroduced the rescan.

import { LoggerWindow } from '../src/classes/loggerWin';

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
  getFormattedDateTime: jest.fn().mockReturnValue('20260726_120000'),
  getFormattedDateTimeISO: jest.fn().mockReturnValue('2026-07-26T12:00:00.000Z')
}));

/** Minimal harness: exercise the pure line/classification logic without a real window. */
function makeLogger(): any {
  LoggerWindow['instance'] = null;
  const logger = Object.create(LoggerWindow.prototype);
  logger.logLineAccumulator = '';
  logger.logLineFlushTimer = null;
  logger.LOG_LINE_FLUSH_TIMEOUT_MS = 50;
  logger.writtenEntries = [];
  logger.writeLogEntry = function (line: string): void {
    this.writtenEntries.push(line);
  };
  return logger;
}

const bytes = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'latin1'));

describe('logger line accumulation — the 2 Mbaud freeze', () => {
  describe('classifyData: CR/LF are line terminators, not PST content', () => {
    it('classifies ordinary CRLF-terminated text as plain ascii', () => {
      const logger = makeLogger();
      // This is the exact shape of a P2 debug line. Before the fix it came back 'ascii-pst',
      // which is what set the whole failure chain in motion.
      expect(logger.classifyData(bytes('Cog0  SEQ 190280\r\n'))).toBe('ascii');
    });

    it('classifies bare-LF and bare-CR text as plain ascii too', () => {
      const logger = makeLogger();
      expect(logger.classifyData(bytes('hello\n'))).toBe('ascii');
      expect(logger.classifyData(bytes('hello\r'))).toBe('ascii');
    });

    it('STILL flags genuine PST control codes as ascii-pst', () => {
      const logger = makeLogger();
      // Regression guard in the other direction: the fix must not blind us to real PST content.
      expect(logger.classifyData(bytes('text\x10more\r\n'))).toBe('ascii-pst'); // 0x10 = CLS
      expect(logger.classifyData(bytes('text\x01more'))).toBe('ascii-pst'); // 0x01 = HOME
      expect(logger.classifyData(bytes('\x02\x0A\x14text'))).toBe('ascii-pst'); // POS + params
    });

    it('still calls true binary binary', () => {
      const logger = makeLogger();
      expect(logger.classifyData(new Uint8Array([0x41, 0xff, 0x42]))).toBe('binary');
    });
  });

  describe('writeToLog: line splitting', () => {
    it('writes one entry per terminated line', () => {
      const logger = makeLogger();
      logger.writeToLog('alpha\r\nbeta\r\ngamma\r\n');
      expect(logger.writtenEntries.length).toBe(3);
      expect(logger.writtenEntries[0]).toContain('alpha');
      expect(logger.writtenEntries[2]).toContain('gamma');
      expect(logger.logLineAccumulator).toBe(''); // nothing left pending
    });

    it('reassembles a line split across chunk boundaries', () => {
      const logger = makeLogger();
      logger.writeToLog('Cog0  SEQ 1');
      expect(logger.writtenEntries.length).toBe(0); // incomplete — correctly held
      logger.writeToLog('23\r\n');
      expect(logger.writtenEntries.length).toBe(1);
      expect(logger.writtenEntries[0]).toContain('Cog0  SEQ 123');
    });
  });

  describe('the growth bound', () => {
    it('flushes an unterminated stream instead of accumulating forever', () => {
      const logger = makeLogger();
      // A stream that never presents a terminator. The 50ms idle timer cannot save this case:
      // while data keeps arriving the timer keeps being reset and never fires.
      for (let i = 0; i < 200; i++) logger.writeToLog('x'.repeat(1024));

      expect(logger.writtenEntries.length).toBeGreaterThan(0); // something got written
      expect(logger.logLineAccumulator.length).toBeLessThan(64 * 1024); // and it stayed bounded
    });

    it('does not silently discard the bytes it bounds', () => {
      const logger = makeLogger();
      for (let i = 0; i < 200; i++) logger.writeToLog('x'.repeat(1024));
      const written = logger.writtenEntries.join('').length + logger.logLineAccumulator.length;
      expect(written).toBe(200 * 1024); // every byte still accounted for
    });
  });

  describe('scaling — the actual freeze', () => {
    // The formatting fixes above would all still pass if someone reintroduced the full rescan.
    // This is the test that catches THAT: work must grow linearly with the number of chunks, not
    // quadratically. Timing in CI is noisy, so the bar is deliberately loose — quadratic blowup
    // is orders of magnitude, not percentages.
    const feed = (chunks: number): number => {
      const logger = makeLogger();
      const chunk = 'y'.repeat(512); // unterminated: the pathological shape
      const start = Date.now();
      for (let i = 0; i < chunks; i++) logger.writeToLog(chunk);
      return Date.now() - start;
    };

    it('stays roughly linear as the chunk count grows 8x', () => {
      feed(500); // warm up so JIT effects do not dominate the comparison
      const small = Math.max(1, feed(2000));
      const large = Math.max(1, feed(16000));
      // Linear would be ~8x. Quadratic would be ~64x and, at real capture sizes, minutes.
      expect(large / small).toBeLessThan(25);
    });
  });
});
