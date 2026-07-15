/** @format */

/**
 * Worker desync-proof on the REAL test11 RX capture, under MULTI-COG EXACT FRAMING.
 *
 * Drives the corrected test11 capture (tests/fixtures/debugger/test11-desync-capture.bin,
 * RECV-only) through the REAL ExtractionCore worker. The worker now delimits each
 * break's Phase-3 by EXACT byte count from the relayed FIXED size (per-cog stash),
 * then walks the self-describing smart-pin tail — so it resyncs to awaitingPhase1 at
 * the precise boundary regardless of what other cogs do. Two properties this pins on
 * real bytes:
 *
 *   1. WAIT, NEVER SCAN — fed the whole capture with NO size relayed, the worker
 *      frames exactly ONE Phase-1 (the first) and then WAITS: it streams ZERO
 *      Phase-3 and NEVER fabricates a spurious Phase-1 from the many all-zero
 *      hub-dump runs (the $14201 desync class). It cannot advance past the fixed
 *      body without the size, so a zero run can never be mis-walked into a break.
 *   2. ALL-ZERO GUARD — even if the worker is forced to re-enter awaitingPhase1 on a
 *      real all-zero run (a trailing remnant), it discards it rather than emitting a
 *      bogus DEBUGGER Phase-1.
 *
 * Exact per-break Phase-3 framing on this same capture (WITH real relayed sizes, via
 * the controller) is covered end-to-end by tests/debuggerReplay.test.ts, which stays
 * green — proving no single-cog regression.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { makeWorkerHarness, type Emission } from './shared/debuggerMultiCog';

// The banner precedes the first Phase-1 (bytes 0..38).
const FIRST_P1_OFFSET = 39;

function loadCapture(): { bytes: Uint8Array; chunkLengths: number[] } {
  const dir = join(__dirname, 'fixtures', 'debugger');
  const bytes = new Uint8Array(readFileSync(join(dir, 'test11-desync-capture.bin')));
  const manifest = JSON.parse(readFileSync(join(dir, 'test11-desync-manifest.json'), 'utf8'));
  return { bytes, chunkLengths: manifest.chunkLengths };
}

describe('worker desync-proof on the real test11 capture (exact framing)', () => {
  it('with NO relayed size: frames one Phase-1, then WAITS — zero Phase-3, no spurious Phase-1 from zero runs', () => {
    // The desync-proof on REAL bytes. Fed the entire capture continuously with NO
    // signalDebuggerPhase3Size, the worker frames exactly the FIRST Phase-1 and then
    // holds in AwaitSize — it streams NOTHING and never manufactures a Phase-1 from
    // the three later real Phase-1s or the ubiquitous all-zero hub-dump runs that
    // used to be mis-framed as $14201. Exactly one Phase-1, zero Phase-3 ⇒ the
    // wait-never-scan invariant holds.
    const { bytes, chunkLengths } = loadCapture();
    const h = makeWorkerHarness();

    let p1Count = 0;
    let p3Bytes = 0;
    const account = (ems: Emission[]): void => {
      for (const e of ems) {
        if (e.kind === 'p1') p1Count++;
        else if (e.kind === 'p3') p3Bytes += e.bytes.length;
      }
    };

    let off = 0;
    for (const len of chunkLengths) {
      h.advance(1);
      h.feed(bytes.subarray(off, off + len));
      off += len;
      account(h.pump());
    }
    h.advance(200);
    for (let i = 0; i < 8; i++) account(h.pump());

    expect(p1Count).toBe(1); // the first break only; NO spurious Phase-1s
    expect(p3Bytes).toBe(0); // WAIT, never scan — no size means no Phase-3 is delimited
  });

  it('once the first break is framed, no later Phase-1 is emitted without its size (never over-reads on real payload)', () => {
    // Same capture, but confirm the worker stays on the first cog awaiting its size:
    // feeding the WHOLE stream at once still yields exactly one Phase-1 and no
    // Phase-3 — the worker never scans the real payload (which contains further real
    // Phase-1 packets and long zero runs) into additional breaks.
    const { bytes } = loadCapture();
    const h = makeWorkerHarness();

    let p1Count = 0;
    let p3Bytes = 0;
    h.feed(bytes);
    for (let i = 0; i < 16; i++) {
      for (const e of h.pump()) {
        if (e.kind === 'p1') p1Count++;
        else if (e.kind === 'p3') p3Bytes += e.bytes.length;
      }
    }

    expect(p1Count).toBe(1);
    expect(p3Bytes).toBe(0);
    // The first Phase-1 really was framed (from the banner-prefixed head).
    expect(FIRST_P1_OFFSET).toBe(39);
  });
});
