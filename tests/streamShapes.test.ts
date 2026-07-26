/** @format */

// streamShapes.test.ts
//
// COVER THE REGION, NOT THE POINT.
//
// Two freezes were found by tripping over them: CR/LF classified as PST control codes made the
// on-screen logger's accumulator unbounded and its scan quadratic, and the identical defect was
// then found sitting live in the headless logger. Both were the SAME shape of input — a stream
// whose delimiter density approached zero — meeting the SAME shape of code: a per-message cost
// that scaled with ACCUMULATED STATE rather than with the message.
//
// That pairing is the classification. The pathology is never "too much data"; it is an input
// property meeting an unstated assumption in a consumer. So rather than add one more test per
// crash, this drives a GENERATOR of stream shapes across the pure consumers and asserts the
// invariants that must hold for every shape:
//
//   I1 — per-message work is O(message), never O(accumulated state)
//   I3 — every accumulator has a hard cap
//
// (I2 per-tick budget, I4 escapability and I5 log-completeness live in their own suites; I4's
// UI half and sustained wire rate are hardware-only and stay in the bench playbook.)
//
// DESIGN CONSTRAINTS, each learned the hard way in this repo:
//   * PURE LAYERS ONLY. workerExtraction.test.ts is already excluded because Docker/Jest cannot
//     deliver the SAB worker round-trip; shape coverage belongs where the invariants live.
//   * RATIOS, NEVER ABSOLUTE TIMES. binaryRecording fails under sweep load and passes alone —
//     wall-clock thresholds become the next flaky test. Linear vs quadratic is orders of
//     magnitude, so a loose ratio survives a loaded container and still catches the regression.
//   * BOUNDED COST. The sweep is 170+ suites in a container that saturates; this suite is sized
//     to run in seconds, not minutes.

import { LoggerWindow } from '../src/classes/loggerWin';
import { HeadlessFileLogger } from '../src/classes/shared/headlessFileLogger';
import { DisplaySpecParser } from '../src/classes/shared/displaySpecParser';

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

// ---------------------------------------------------------------------------
//  The shape generator — the map of stream shapes, as code
// ---------------------------------------------------------------------------

interface StreamShape {
  name: string;
  /** What real-world input this stands in for, and which cell of the map it probes. */
  rationale: string;
  /** Produce chunk `i` of this shape. Deterministic — no RNG, so a failure reproduces. */
  chunk: (i: number) => string;
}

const SHAPES: StreamShape[] = [
  {
    name: 'no-delimiter',
    rationale:
      'Delimiter density 0. THE shape that froze the app twice — escaped CR/LF on the headed path, ' +
      'a long binary DEBUG payload on the headless one. Must never accumulate without bound.',
    chunk: () => 'x'.repeat(512)
  },
  {
    name: 'sparse-delimiter',
    rationale: 'A terminator every ~64KB — legal, rare, and enough to defeat a naive idle-timer flush.',
    chunk: (i) => (i % 128 === 127 ? 'x'.repeat(511) + '\n' : 'x'.repeat(512))
  },
  {
    name: 'all-tiny',
    rationale: 'One byte per chunk: maximum per-chunk overhead, minimum payload. Probes fixed costs.',
    chunk: () => 'x'
  },
  {
    name: 'dense-lines',
    rationale: 'The healthy case — many short terminated lines. Guards against a fix that breaks normal use.',
    chunk: (i) => `Cog0  SEQ ${i}\r\n`
  },
  {
    name: 'binary-in-text',
    rationale: 'Binary DEBUG payload interleaved with text — the type-mix cell, where misclassification lives.',
    chunk: (i) => (i % 4 === 0 ? '\x00\x01\x02\xff\xfe' : `Cog0  data ${i}\r\n`)
  },
  {
    name: 'burst-then-idle',
    rationale: 'Bursty arrival: long runs with no terminator punctuated by flushes. Probes timer-dependent paths.',
    chunk: (i) => (i % 100 < 90 ? 'y'.repeat(256) : 'y'.repeat(255) + '\n')
  },
  {
    name: 'crlf-split-across-chunks',
    rationale: 'CR ends one chunk, LF starts the next — the boundary case in every line reassembler.',
    chunk: (i) => (i % 2 === 0 ? `Cog0  line ${i}\r` : '\n')
  }
];

// ---------------------------------------------------------------------------
//  Consumers under test — the pure layers a shape can reach
// ---------------------------------------------------------------------------

interface Consumer {
  name: string;
  make: () => { feed: (s: string) => void; heldBytes: () => number };
}

const CONSUMERS: Consumer[] = [
  {
    name: 'loggerWin.writeToLog',
    make: () => {
      const logger: any = Object.create(LoggerWindow.prototype);
      logger.logLineAccumulator = '';
      logger.logLineFlushTimer = null;
      logger.LOG_LINE_FLUSH_TIMEOUT_MS = 50;
      logger.writeLogEntry = (): void => {};
      return {
        feed: (s: string) => logger.writeToLog(s),
        heldBytes: () => logger.logLineAccumulator.length
      };
    }
  },
  {
    name: 'headlessFileLogger.logMessage',
    make: () => {
      const logger: any = Object.create(HeadlessFileLogger.prototype);
      logger.lineAccumulator = '';
      logger.lineFlushTimer = null;
      logger.LINE_FLUSH_TIMEOUT_MS = 50;
      logger.endMarkers = [];
      logger.onEndMarkerDetected = null;
      logger.markerSearchBuffer = '';
      logger.maxMarkerLength = 32;
      logger.writeToLog = (): void => {};
      return {
        feed: (s: string) => logger.logMessage(s),
        heldBytes: () => logger.lineAccumulator.length
      };
    }
  }
];

/** Feed `chunks` of a shape into a fresh consumer; return elapsed ms and bytes still held. */
function drive(shape: StreamShape, consumer: Consumer, chunks: number): { ms: number; held: number } {
  const c = consumer.make();
  const start = Date.now();
  for (let i = 0; i < chunks; i++) c.feed(shape.chunk(i));
  return { ms: Date.now() - start, held: c.heldBytes() };
}

// Generous: quadratic is ~64x for an 8x input growth (and minutes at real capture sizes), so this
// gap is enormous while staying immune to container load.
const MAX_SCALING_RATIO = 25;
const HELD_BYTES_CAP = 256 * 1024; // any accumulator must stay far under a runaway

describe('stream shapes — invariants across the map', () => {
  describe('I1 — per-message work is O(message), not O(accumulated state)', () => {
    for (const consumer of CONSUMERS) {
      for (const shape of SHAPES) {
        it(`${consumer.name} stays linear under '${shape.name}'`, () => {
          drive(shape, consumer, 500); // warm up so JIT effects do not skew the comparison
          const small = Math.max(1, drive(shape, consumer, 2000).ms);
          const large = Math.max(1, drive(shape, consumer, 16000).ms);
          expect(large / small).toBeLessThan(MAX_SCALING_RATIO);
        });
      }
    }
  });

  describe('I3 — no shape leaves an accumulator unbounded', () => {
    for (const consumer of CONSUMERS) {
      for (const shape of SHAPES) {
        it(`${consumer.name} holds bounded bytes under '${shape.name}'`, () => {
          const { held } = drive(shape, consumer, 16000);
          expect(held).toBeLessThan(HELD_BYTES_CAP);
        });
      }
    }
  });

  describe('no shape throws', () => {
    // Cheap crash-safety sweep: a consumer that dies on odd input is its own defect class.
    for (const consumer of CONSUMERS) {
      for (const shape of SHAPES) {
        it(`${consumer.name} survives '${shape.name}'`, () => {
          expect(() => drive(shape, consumer, 2000)).not.toThrow();
        });
      }
    }
  });
});

// ---------------------------------------------------------------------------
//  I3, presentation half — the DISPLAY rate must not be coupled to the ARRIVAL rate
// ---------------------------------------------------------------------------
//
// Found on hardware 2026-07-26: with the Debug Logger window OPEN a sustained 2 Mbaud
// stream made window drags lag badly; with it CLOSED the same stream was fully
// responsive, at an identical 170 KB/s on the wire. The transport was never the problem.
//
// The coupling was appendMessage()'s "force immediate flush at BATCH_SIZE_LIMIT": one
// drain tick delivering N lines fired processBatch (an IPC send, and a synchronous DOM
// append in the renderer) N/100 times inside that tick, so painting tracked the wire.
// The 16 ms batch timer is now the only trigger and the on-screen backlog is SHED.
//
// The file must not be affected: writeToLog() is a separate call at every call site, so
// shedding the render queue cannot lose a logged byte (invariant I5).
describe('I3 (presentation) — display backlog is bounded, and the file is untouched', () => {
  const FLOOD = 50_000;

  function makeLogger(): any {
    const logger: any = Object.create(LoggerWindow.prototype);
    logger.renderQueue = [];
    logger.batchTimer = null;
    logger.lineBuffer = [];
    logger.maxLines = 10_000;
    logger.displaySheddedLines = 0;
    logger.rendererReady = true;
    // debugWindow is a base-class setter with teardown side effects — leave it alone;
    // appendMessage never touches it.
    return logger;
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('holds a bounded render queue no matter how many lines arrive', () => {
    const logger = makeLogger();
    for (let i = 0; i < FLOOD; i++) logger.appendMessage(`Cog0  SEQ ${i}`, 'cog-message');

    const cap = (LoggerWindow as any).MAX_DISPLAY_BACKLOG;
    expect(cap).toBeGreaterThan(0);
    expect(logger.renderQueue.length).toBeLessThanOrEqual(cap);
  });

  it('accounts for every shed line rather than dropping it silently', () => {
    const logger = makeLogger();
    for (let i = 0; i < FLOOD; i++) logger.appendMessage(`Cog0  SEQ ${i}`, 'cog-message');

    // Nothing vanishes unreported: what is queued plus what was shed is everything fed in.
    expect(logger.displaySheddedLines + logger.renderQueue.length).toBe(FLOOD);
  });

  it('keeps the NEWEST lines on screen — a stale display is worse than a skipping one', () => {
    const logger = makeLogger();
    for (let i = 0; i < FLOOD; i++) logger.appendMessage(`Cog0  SEQ ${i}`, 'cog-message');

    const last = logger.renderQueue[logger.renderQueue.length - 1];
    expect(last.message).toBe(`Cog0  SEQ ${FLOOD - 1}`);
  });

  it('never paints synchronously from the arrival path — only the frame timer paints', () => {
    const logger = makeLogger();
    const paint = jest.spyOn(logger, 'processBatch' as never);
    for (let i = 0; i < FLOOD; i++) logger.appendMessage(`Cog0  SEQ ${i}`, 'cog-message');

    // The pre-fix code called processBatch once per 100 arrivals (500 times for this flood).
    expect(paint).not.toHaveBeenCalled();
    // ...and exactly one timer is outstanding, however long the flood ran.
    expect(jest.getTimerCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
//  Value-range cell — extreme numbers in directives must clamp, not allocate
// ---------------------------------------------------------------------------

describe('stream shapes — value ranges (the allocation cell)', () => {
  const parse = (parts: string[]): any => {
    const spec: any = {};
    DisplaySpecParser.parseCommonKeywords(parts, 0, spec);
    return spec;
  };

  it('clamps an absurd SIZE instead of honoring it', () => {
    // A display directive is user-authored data: `SIZE 999999 999999` must not become an
    // allocation request. This cell is ALREADY defended — the test pins it so it stays that way.
    const spec = parse(['SIZE', '999999', '999999']);
    expect(spec.size.width).toBeLessThanOrEqual(2048);
    expect(spec.size.height).toBeLessThanOrEqual(2048);
  });

  it('clamps negative and zero SIZE to the low bound', () => {
    const spec = parse(['SIZE', '-5', '0']);
    expect(spec.size.width).toBeGreaterThan(0);
    expect(spec.size.height).toBeGreaterThan(0);
  });

  it('clamps an absurd SAMPLES count', () => {
    const spec = parse(['SAMPLES', '99999999']);
    expect(spec.nbrSamples).toBeLessThanOrEqual(4096);
  });

  it('does not throw on non-numeric parameters', () => {
    expect(() => parse(['SIZE', 'abc', 'def'])).not.toThrow();
    expect(() => parse(['SAMPLES', 'NaN'])).not.toThrow();
  });
});
