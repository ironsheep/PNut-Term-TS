/** @format */

/**
 * Multi-cog §7 — in-container proof of the §2–§4 CORE change. Drives synthetic
 * two-cog debug traffic through the REAL worker framing engine (`ExtractionCore`)
 * and asserts the per-cog demux: each cog's breaks are tagged, delimited, and
 * delivered independently — the multi-cog gap that HW v0.9.88 exposed.
 *
 * This deliberately exercises the WORKER path (where the fix lives), not the
 * renderer `DebuggerController`. Shared scaffolding: `tests/shared/debuggerMultiCog.ts`.
 *
 * The single-cog capture fixture (`tests/debuggerReplay.test.ts`) proves no
 * single-cog regression — it stays green unchanged in the full suite.
 */

import {
  buildMultiCogStream,
  buildWorkerPhase1,
  buildWorkerPhase3,
  phase3TotalLen,
  runMultiCogReplay,
  makeWorkerHarness,
  groupBreaks,
  type Emission
} from './shared/debuggerMultiCog';
import { SharedMessageType } from '../src/classes/shared/sharedMessagePool';

// The worker's Phase-3 stall bound (ExtractionCore.PHASE3_STALL_MS) is 3000 ms, an
// internal constant; the watchdog test advances the injected clock past it.

/** Assert no Phase-3 chunk is tagged with a cog other than its opening Phase-1. */
function assertNoCrossTag(emissions: Emission[]): void {
  let curCog = -1;
  for (const e of emissions) {
    if (e.kind === 'p1') curCog = e.cog;
    else expect(e.cog).toBe(curCog); // every p3 belongs to the break that opened it
  }
}

describe('multi-cog §7 — worker per-cog demux (synthetic 2-cog replay)', () => {
  // Three atomic sequential exchanges across two cogs, cog-0 breaking twice.
  const EXCHANGES = [
    { cog: 0, fixed: 128 },
    { cog: 1, fixed: 256 },
    { cog: 0, fixed: 64 }
  ];

  it('delivers 3 exchanges across 2 cogs, byte-exact, zero cross-tag', () => {
    const built = buildMultiCogStream(EXCHANGES);
    const emissions = runMultiCogReplay(built, [built.bytes.length]); // whole stream, one chunk
    assertNoCrossTag(emissions);

    const breaks = groupBreaks(emissions);
    expect(breaks.map((b) => b.cog)).toEqual([0, 1, 0]); // exact per-cog order
    // Each break's reassembled Phase-3 equals the exact synthetic payload.
    breaks.forEach((b, i) => {
      const expected = buildWorkerPhase3(built.exchanges[i].fixed, { masks: built.exchanges[i].masks });
      expect(Array.from(b.phase3)).toEqual(Array.from(expected));
    });
  });

  it('reassembles every break when the stream is cut into tiny 37-byte chunks', () => {
    const built = buildMultiCogStream(EXCHANGES);
    // Uniform tiny chunks split every frame — including [p3 tail][next p1] seams
    // and mid-Phase-3 — mid-element. The demux must reassemble regardless.
    const chunks: number[] = [];
    for (let off = 0; off < built.bytes.length; off += 37) {
      chunks.push(Math.min(37, built.bytes.length - off));
    }
    const breaks = groupBreaks(runMultiCogReplay(built, chunks));
    expect(breaks.map((b) => b.cog)).toEqual([0, 1, 0]);
    breaks.forEach((b, i) => {
      const expected = buildWorkerPhase3(built.exchanges[i].fixed, { masks: built.exchanges[i].masks });
      expect(Array.from(b.phase3)).toEqual(Array.from(expected)); // byte-exact despite the splits
    });
  });

  it('frames cleanly across an explicit [p3 tail | next p1] chunk seam', () => {
    const built = buildMultiCogStream(EXCHANGES);
    const [p1a, p3a, p1b, p3b, p1c, p3c] = built.frameLengths;
    // Chunk A ends EXACTLY at the end of exchange-0's Phase-3 (its tail), so the
    // boundary falls precisely between a Phase-3 tail and the next Phase-1.
    const seam = p1a + p3a;
    const chunks = [seam, built.bytes.length - seam];
    const breaks = groupBreaks(runMultiCogReplay(built, chunks));
    expect(breaks.map((b) => b.cog)).toEqual([0, 1, 0]);
    // Sanity: the manifest lengths cover exchanges 1 and 2 in the second chunk.
    expect(p1b + p3b + p1c + p3c).toBe(built.bytes.length - seam);
  });

  it('sizes a break with a multi-bit smart-pin tail correctly, then frames the next', () => {
    // Group masks with 11 set bits total → tail = 8 + 4·11 = 52 bytes.
    const masks = [0x05, 0x00, 0x80, 0x00, 0x00, 0xff, 0x00, 0x00]; // popcounts 2,0,1,0,0,8,0,0
    const built = buildMultiCogStream([
      { cog: 1, fixed: 96, masks },
      { cog: 0, fixed: 48 } // a following clean exchange must still frame
    ]);
    const breaks = groupBreaks(runMultiCogReplay(built, [built.bytes.length]));

    expect(breaks.map((b) => b.cog)).toEqual([1, 0]);
    // The delimited length equals fixed + the interleaved smart-pin tail.
    expect(breaks[0].phase3.length).toBe(phase3TotalLen(96, masks));
    expect(breaks[0].phase3.length).toBe(96 + 8 + 4 * 11);
    expect(Array.from(breaks[0].phase3)).toEqual(Array.from(buildWorkerPhase3(96, { masks })));
    // The next exchange framed cleanly (no over/under-run bled into it).
    expect(Array.from(breaks[1].phase3)).toEqual(Array.from(buildWorkerPhase3(48)));
  });

  it('watchdog aborts a truncated Phase-3 (no bogus delivery, no hang); a reset then frames the next', () => {
    // A truncated exchange breaks the atomic-per-cog guarantee (P2 lock[15]), so
    // it is a genuine desync that only a pipe resync recovers — but the watchdog
    // must first ensure the stalled break neither hangs nor is mis-delivered as a
    // (short) Phase-3.
    const h = makeWorkerHarness();

    // Cog 1 breaks; its size hint arrives; then only a SLIVER of Phase-3 arrives
    // (fewer bytes than even the smart-pin tail needs) and the cog stalls.
    h.feed(buildWorkerPhase1(1));
    const em1 = h.pump();
    expect(em1.map((e) => `${e.cog}:${e.kind}`)).toEqual(['1:p1']); // just the Phase-1
    h.hint(1, 200);
    h.feed(buildWorkerPhase3(200).subarray(0, 10)); // 10 bytes — can't size the tail
    expect(h.pump()).toEqual([]); // held, waiting for the rest (not yet timed out)

    // Bytes stop. Past the stall bound the watchdog aborts — crucially it does NOT
    // emit a bogus/short cog-1 Phase-3, and it does not hang.
    h.advance(4000); // > PHASE3_STALL_MS (3000 ms)
    h.pump();
    const afterStall = groupBreaks(h.emissions);
    expect(afterStall.map((b) => b.cog)).toEqual([1]);   // only the Phase-1 break
    expect(afterStall[0].phase3.length).toBe(0);          // NO Phase-3 was delivered

    // Resync (the DTR-reset / overflow path) clears the desynced pipe…
    h.reset();

    // …and a fresh, complete cog-0 exchange frames normally — no wedge.
    h.feed(buildWorkerPhase1(0));
    expect(h.pump().map((e) => `${e.cog}:${e.kind}`)).toEqual(['0:p1']);
    h.hint(0, 80);
    h.feed(buildWorkerPhase3(80));
    for (let i = 0; i < 8 && h.pump().length; i++) { /* drain the recovered Phase-3 */ }

    const breaks = groupBreaks(h.emissions);
    expect(breaks.map((b) => b.cog)).toEqual([1, 0]);                                 // stalled cog-1, recovered cog-0
    expect(breaks[0].phase3.length).toBe(0);
    expect(Array.from(breaks[1].phase3)).toEqual(Array.from(buildWorkerPhase3(80))); // recovered, byte-exact
  });
});

describe('multi-cog §7 — smart-pin tail helper matches the worker delimiter', () => {
  it('phase3TotalLen equals the built payload length for varied masks', () => {
    for (const masks of [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0xff, 0, 0, 0, 0, 0, 0, 0],
      [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80],
      [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
    ]) {
      expect(buildWorkerPhase3(100, { masks }).length).toBe(phase3TotalLen(100, masks));
    }
  });

  it('exposes the debugger Phase-3 message types the worker emits per cog', () => {
    // Guards the type-range assumptions the harness decodes emissions with.
    expect(SharedMessageType.DEBUGGER0_416BYTE).toBe(9);
    expect(SharedMessageType.DEBUGGER0_PHASE3).toBe(30);
  });
});
