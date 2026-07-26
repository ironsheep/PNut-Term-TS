/** @format */

// headlessLoggerLineAccumulation.test.ts
//
// The F2 audit found the headed logger's freeze pattern living, unfixed, in the HEADLESS path:
// accumulate a line, then rescan the whole accumulator for '\n' on every chunk, with no bound.
//
// It is arguably worse here. Headless is the CI / AI-agent path — there is no UI to go
// unresponsive, so the same defect presents only as a run that appears to hang, with no window
// to drag and nobody watching. The trigger differs from the headed case (this path receives raw
// text, so real newlines usually arrive) but a long run of binary DEBUG payload carries no
// newlines at all, which is exactly the shape that makes it quadratic.
//
// The scaling test is the one that matters: the correctness assertions would still pass if
// someone reintroduced the rescan.

import { HeadlessFileLogger } from '../src/classes/shared/headlessFileLogger';

jest.mock('fs');
jest.mock('../src/utils/files', () => ({
  ensureDirExists: jest.fn(),
  getFormattedDateTime: jest.fn().mockReturnValue('20260726_120000'),
  getFormattedDateTimeISO: jest.fn().mockReturnValue('2026-07-26T12:00:00.000Z')
}));

/** Exercise the line-assembly logic without touching a real file. */
function makeLogger(): any {
  const logger = Object.create(HeadlessFileLogger.prototype);
  logger.lineAccumulator = '';
  logger.lineFlushTimer = null;
  logger.LINE_FLUSH_TIMEOUT_MS = 50;
  logger.endMarkers = [];
  logger.onEndMarkerDetected = null;
  logger.markerSearchBuffer = '';
  logger.maxMarkerLength = 32;
  logger.written = [];
  logger.writeToLog = function (line: string): void {
    this.written.push(line);
  };
  return logger;
}

describe('HeadlessFileLogger — line accumulation', () => {
  describe('correctness', () => {
    it('writes one entry per terminated line', () => {
      const logger = makeLogger();
      logger.logMessage('alpha\r\nbeta\r\ngamma\r\n');
      expect(logger.written.length).toBe(3);
      expect(logger.written[0]).toContain('alpha');
      expect(logger.written[2]).toContain('gamma');
      expect(logger.lineAccumulator).toBe('');
    });

    it('reassembles a line split across chunks', () => {
      const logger = makeLogger();
      logger.logMessage('Cog0  SEQ 1');
      expect(logger.written.length).toBe(0);
      logger.logMessage('23\r\n');
      expect(logger.written.length).toBe(1);
      expect(logger.written[0]).toContain('Cog0  SEQ 123');
    });
  });

  describe('the growth bound', () => {
    it('flushes an unterminated stream instead of accumulating forever', () => {
      const logger = makeLogger();
      // Binary payload shape: no newline ever arrives, and the 50ms idle timer never fires
      // because data keeps coming.
      for (let i = 0; i < 200; i++) logger.logMessage('\x01\x02\x03\x04'.repeat(256));
      expect(logger.written.length).toBeGreaterThan(0);
      expect(logger.lineAccumulator.length).toBeLessThan(64 * 1024);
    });

    it('accounts for every byte it bounds', () => {
      const logger = makeLogger();
      for (let i = 0; i < 200; i++) logger.logMessage('x'.repeat(1024));
      const total = logger.written.join('').length + logger.lineAccumulator.length;
      expect(total).toBe(200 * 1024);
    });
  });

  describe('scaling — the freeze this path would have had', () => {
    const feed = (chunks: number): number => {
      const logger = makeLogger();
      const chunk = 'y'.repeat(512); // unterminated: the pathological shape
      const start = Date.now();
      for (let i = 0; i < chunks; i++) logger.logMessage(chunk);
      return Date.now() - start;
    };

    it('stays roughly linear as the chunk count grows 8x', () => {
      feed(500); // warm up
      const small = Math.max(1, feed(2000));
      const large = Math.max(1, feed(16000));
      // Linear ~8x; quadratic ~64x and, at real capture sizes, minutes of a hung run.
      expect(large / small).toBeLessThan(25);
    });
  });
});
