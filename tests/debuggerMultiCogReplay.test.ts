/** @format */

/**
 * Multi-cog §7 — in-container proof of the CORE change. Drives synthetic two-cog
 * debug traffic through the REAL worker framing engine (`ExtractionCore`) and
 * asserts the per-cog demux: each cog's breaks are tagged and delivered
 * independently — the multi-cog gap that HW v0.9.88 exposed.
 *
 * Path 1 (task #78): the worker is a pure DISPATCHER — it frames each Phase-1 and
 * STREAMS that cog's Phase-3 verbatim until the controller relays break-complete
 * (`done(cog)`). The replay driver models the P2's lockstep gap by feeding each
 * break ATOMICALLY and calling `done` between breaks (see debuggerMultiCog.ts).
 * This deliberately exercises the WORKER path (where the demux lives), not the
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
    const emissions = runMultiCogReplay(built); // whole break fed atomically
    assertNoCrossTag(emissions);

    const breaks = groupBreaks(emissions);
    expect(breaks.map((b) => b.cog)).toEqual([0, 1, 0]); // exact per-cog order
    // Each break's reassembled Phase-3 equals the exact synthetic payload.
    breaks.forEach((b, i) => {
      const expected = buildWorkerPhase3(built.exchanges[i].fixed, { masks: built.exchanges[i].masks });
      expect(Array.from(b.phase3)).toEqual(Array.from(expected));
    });
  });

  it('reassembles every break when each break is cut into tiny 37-byte chunks', () => {
    const built = buildMultiCogStream(EXCHANGES);
    // Split every frame into 37-byte pieces — stressing intra-break Phase-1 and
    // Phase-3 (fixed|tail) seams. The worker streams each cog's Phase-3 verbatim;
    // the driver holds break boundaries with done(cog), so reassembly is exact.
    const breaks = groupBreaks(runMultiCogReplay(built, 37));
    expect(breaks.map((b) => b.cog)).toEqual([0, 1, 0]);
    breaks.forEach((b, i) => {
      const expected = buildWorkerPhase3(built.exchanges[i].fixed, { masks: built.exchanges[i].masks });
      expect(Array.from(b.phase3)).toEqual(Array.from(expected)); // byte-exact despite the splits
    });
  });

  it('reassembles a Phase-3 split exactly at its fixed|smart-pin-tail seam', () => {
    // The one intra-break seam worth pinning explicitly: a USB chunk boundary
    // landing precisely between the fixed cog/hub region and the smart-pin tail.
    // The worker streams both parts as raw Phase-3; reassembly must be byte-exact.
    const h = makeWorkerHarness();
    const fixed = 128;
    const masks = [0x03, 0, 0, 0, 0, 0, 0, 0];
    const p3 = buildWorkerPhase3(fixed, { masks });

    h.feed(buildWorkerPhase1(0));
    expect(h.pump().map((e) => `${e.cog}:${e.kind}`)).toEqual(['0:p1']);
    h.feed(p3.subarray(0, fixed)); // fixed cog/hub region
    h.pump();
    h.feed(p3.subarray(fixed));    // smart-pin tail, on the far side of the seam
    for (let i = 0; i < 8 && h.pump().length; i++) { /* drain */ }
    h.done(0);

    const breaks = groupBreaks(h.emissions);
    expect(breaks.map((b) => b.cog)).toEqual([0]);
    expect(Array.from(breaks[0].phase3)).toEqual(Array.from(p3)); // byte-exact across the seam
  });

  it('streams a break with a multi-bit smart-pin tail verbatim, then frames the next', () => {
    // Group masks with 11 set bits total → tail = 8 + 4·11 = 52 bytes.
    const masks = [0x05, 0x00, 0x80, 0x00, 0x00, 0xff, 0x00, 0x00]; // popcounts 2,0,1,0,0,8,0,0
    const built = buildMultiCogStream([
      { cog: 1, fixed: 96, masks },
      { cog: 0, fixed: 48 } // a following clean exchange must still frame
    ]);
    const breaks = groupBreaks(runMultiCogReplay(built));

    expect(breaks.map((b) => b.cog)).toEqual([1, 0]);
    // The streamed Phase-3 equals fixed + the interleaved smart-pin tail.
    expect(breaks[0].phase3.length).toBe(phase3TotalLen(96, masks));
    expect(breaks[0].phase3.length).toBe(96 + 8 + 4 * 11);
    expect(Array.from(breaks[0].phase3)).toEqual(Array.from(buildWorkerPhase3(96, { masks })));
    // The next exchange framed cleanly (no over/under-run bled into it).
    expect(Array.from(breaks[1].phase3)).toEqual(Array.from(buildWorkerPhase3(48)));
  });

  it('a truncated Phase-3 is recovered by a pipe reset; the next break frames cleanly', () => {
    // A truncated exchange breaks the atomic-per-cog guarantee (P2 lock[15]), a
    // genuine desync. Path 1: the worker streams whatever Phase-3 bytes arrive
    // verbatim (the controller buffers a partial break) and, absent a break-
    // complete relay, stays on cog 1 — there is no worker-side watchdog. Recovery
    // is the DTR-reset / overflow path, which must leave the pipe clean.
    const h = makeWorkerHarness();

    // Cog 1 breaks; only a SLIVER of its Phase-3 arrives, then bytes stop.
    h.feed(buildWorkerPhase1(1));
    expect(h.pump().map((e) => `${e.cog}:${e.kind}`)).toEqual(['1:p1']); // just the Phase-1
    h.feed(buildWorkerPhase3(200).subarray(0, 10)); // 10-byte sliver — an incomplete break
    h.pump();

    // Resync (the DTR-reset / overflow path) clears the desynced pipe…
    h.reset();

    // …and a fresh, complete cog-0 exchange frames normally — no wedge, no cross-tag.
    h.feed(buildWorkerPhase1(0));
    expect(h.pump().map((e) => `${e.cog}:${e.kind}`)).toEqual(['0:p1']);
    h.feed(buildWorkerPhase3(80));
    for (let i = 0; i < 8 && h.pump().length; i++) { /* drain the recovered Phase-3 */ }
    h.done(0);

    const breaks = groupBreaks(h.emissions);
    expect(breaks.map((b) => b.cog)).toEqual([1, 0]);                                 // stalled cog-1, recovered cog-0
    expect(Array.from(breaks[1].phase3)).toEqual(Array.from(buildWorkerPhase3(80))); // recovered, byte-exact
    // The recovered break never cross-tagged onto the stalled cog.
    assertNoCrossTag(h.emissions);
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
