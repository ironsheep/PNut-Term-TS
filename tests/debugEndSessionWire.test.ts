/** @format */

// tests/debugEndSessionWire.test.ts
//
// DEBUG(DEBUG_END_SESSION), end to end, from the bytes the P2 actually sends.
//
// Wire form (p2com.asm:12886/:12997, Spin2_debugger.spin2:567-600):
//   "CogN  " [ "$XXXX_XXXX_XXXX_XXXX  " ] ESC CR LF
//
// Before v1.1.2:
//   - headed: the router never fired (it wanted CR LF BEFORE the ESC), so nothing happened
//     and the Debug Logger hex-dumped the line as "[ROUTING ERROR: Binary data ...]";
//   - headless: nothing looked for the ESC at all;
//   - with no CR LF after the ESC, the extractor never released the line.
// Ruling (Stephen, 2026-11-12): recognise it with or without the CR LF, no flag needed,
// and shut the whole application down.

import { SharedCircularBuffer } from '../src/classes/shared/sharedCircularBuffer';
import { SharedMessagePool, SharedMessageType } from '../src/classes/shared/sharedMessagePool';
import { ExtractionCore } from '../src/classes/shared/extractionCore';
import { WindowRouter } from '../src/classes/shared/windowRouter';
import { HeadlessFileLogger } from '../src/classes/shared/headlessFileLogger';

jest.mock('../src/utils/files', () => ({
  ensureDirExists: jest.fn(),
  getFormattedDateTime: jest.fn().mockReturnValue('20261112_120000'),
  getFormattedDateTimeISO: jest.fn().mockReturnValue('2026-11-12T12:00:00.000Z')
}));

const latin1 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'latin1'));
const asText = (u: Uint8Array): string => Buffer.from(u).toString('latin1');

interface Extracted {
  type: SharedMessageType;
  data: Uint8Array;
}

/** Run wire bytes through the real extractor, letting the idle timeout pass as the worker loop does. */
function extract(chunks: string[]): Extracted[] {
  const ring = new SharedCircularBuffer(1 << 16);
  const pool = new SharedMessagePool();
  const ids: number[] = [];
  let clock = 1000;
  const core = new ExtractionCore(ring, pool, (id) => ids.push(id), { now: () => clock });
  for (const chunk of chunks) {
    ring.appendAtTail(latin1(chunk));
    core.pump();
  }
  clock += 100; // idle
  core.pump();
  core.pump();
  return ids.map((id) => {
    const slot = pool.get(id);
    const out = { type: slot.readType() as SharedMessageType, data: new Uint8Array(slot.readData()) };
    pool.release(id);
    return out;
  });
}

/** Route through a router with NO end-session flags; count end-session events. */
function routeAndCount(messages: Extracted[], runEnvironment: object = {}): number {
  WindowRouter.resetInstance();
  const router: any = WindowRouter.getInstance();
  router.context = { runEnvironment };
  let fired = 0;
  router.on('debugEndSession', () => fired++);
  for (const m of messages) {
    router.routeTextMessage({ type: m.type, data: m.data, timestamp: 0 });
  }
  WindowRouter.resetInstance();
  return fired;
}

const COG0 = SharedMessageType.COG0_MESSAGE;

describe('extractor: the sentinel line is released as one COG message', () => {
  test('ESC then CR LF, after a normal line', () => {
    const out = extract(['Cog0  hello\r\nCog0  \x1b\r\n']);
    expect(out.map((m) => [m.type, asText(m.data)])).toEqual([
      [COG0, 'Cog0  hello\r\n'],
      [COG0, 'Cog0  \x1b\r\n']
    ]);
  });

  test('ESC with NO CR LF after it is still released (pre-v1.1.2: never released)', () => {
    const out = extract(['Cog0  hello\r\nCog0  \x1b']);
    expect(out.map((m) => asText(m.data))).toEqual(['Cog0  hello\r\n', 'Cog0  \x1b']);
  });

  test('CR LF arriving in a later USB chunk joins the sentinel line', () => {
    const out = extract(['Cog0  \x1b', '\r\n']);
    expect(out.map((m) => asText(m.data))).toEqual(['Cog0  \x1b\r\n']);
  });

  test('bytes after the sentinel are never merged into it', () => {
    const out = extract(['Cog0  \x1b\r\n\x00\x99\x1b\r\n']);
    expect(asText(out[0].data)).toBe('Cog0  \x1b\r\n');
  });

  test('with the debugger timestamp', () => {
    const out = extract(['Cog1  $0000_0000_1234_ABCD  \x1b\r\n']);
    expect(out.map((m) => [m.type, asText(m.data)])).toEqual([
      [SharedMessageType.COG1_MESSAGE, 'Cog1  $0000_0000_1234_ABCD  \x1b\r\n']
    ]);
  });
});

describe('router: the constant ends the session with no flag', () => {
  test.each([
    ['with CR LF', 'Cog0  \x1b\r\n'],
    ['without CR LF', 'Cog0  \x1b'],
    ['with timestamp', 'Cog0  $0000_0000_1234_ABCD  \x1b\r\n']
  ])('%s', (_name, wire) => {
    expect(routeAndCount(extract(['Cog0  hello\r\n', wire]))).toBe(1);
  });

  test('NEGATIVE: the DOG-VOICE binary sample $031B inside a COG line does not end it', () => {
    const wire = "Cog0  heard '" + '\x10\x03\x1b\x03\x35\x03' + "(none)'\r\n";
    expect(routeAndCount(extract([wire]))).toBe(0);
  });

  test('NEGATIVE: the string form needs --exit-on-end-session (PNut has no string form)', () => {
    expect(routeAndCount(extract(['Cog0  DEBUG_END_SESSION\r\n']))).toBe(0);
  });

  test('the string form, followed by CR LF, ends it under --exit-on-end-session', () => {
    const env = { exitOnEndSession: true, headlessEndMarker: ['END_SESSION', 'DEBUG_END_SESSION'] };
    expect(routeAndCount(extract(['Cog0  DEBUG_END_SESSION\r\n']), env)).toBe(1);
  });
});

describe('headless logger: the constant ends the run with no --end-marker', () => {
  function makeLogger(endMarkers: string[] = []): any {
    const logger: any = new HeadlessFileLogger({ runEnvironment: { headlessEndMarker: endMarkers.length ? endMarkers : undefined } } as any);
    logger.written = [];
    logger.writeToLog = function (line: string): void {
      this.written.push(line);
    };
    logger.ended = 0;
    logger.setEndMarkerCallback(() => logger.ended++);
    return logger;
  }

  test.each([
    ['with CR LF', ['Cog0  hello\r\nCog0  \x1b\r\n']],
    ['without CR LF', ['Cog0  hello\r\nCog0  \x1b']],
    ['split across chunks', ['Cog0  hello\r\nCog0  ', '\x1b', '\r\n']],
    ['with timestamp', ['Cog0  $0000_0000_1234_ABCD  \x1b\r\n']],
    ['next line glued on', ['Cog0  \x1bCog1  more\r\n']]
  ])('%s', (_name, chunks) => {
    const logger = makeLogger();
    for (const c of chunks) logger.logMessage(c);
    expect(logger.ended).toBe(1);
    expect(logger.written.some((l: string) => /^Cog0  (\$[0-9A-F_]+  )?<END_SESSION>/.test(l))).toBe(true);
    expect(logger.written.some((l: string) => l.includes('\x1b'))).toBe(false);
    if (logger.lineFlushTimer) clearTimeout(logger.lineFlushTimer);
  });

  test('NEGATIVE: the DOG-VOICE binary sample $031B does not end the run', () => {
    const logger = makeLogger();
    logger.logMessage("Cog0  heard '\x10\x03\x1b\x03\x35\x03(none)'\r\n");
    expect(logger.ended).toBe(0);
    if (logger.lineFlushTimer) clearTimeout(logger.lineFlushTimer);
  });

  test('the string form followed by CR LF still ends it under --end-marker', () => {
    const logger = makeLogger(['END_SESSION', 'DEBUG_END_SESSION']);
    logger.logMessage('Cog0  DEBUG_END_SESSION\r\n');
    expect(logger.ended).toBe(1);
    if (logger.lineFlushTimer) clearTimeout(logger.lineFlushTimer);
  });
});
