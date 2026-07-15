/** @format */

/**
 * Path 1 regression (task #78) — the worker is a pure Phase-3 DISPATCHER, never a
 * second framer. This is the deterministic, in-container guard for the $14201
 * single-step-debugger desync that only reproduced on hardware under the v0.9.92
 * design (worker delimits Phase-3 by an ASYNC cross-process size hint).
 *
 * ROOT CAUSE the design removed: whenever the hint was late/absent (the proven HW
 * timing race), the worker resynced mid-stream and SCANNED the Phase-3 payload for
 * a Phase-1 header — mis-framing an all-zero run (ubiquitous in hub dumps) as a
 * spurious Phase-1 → "RX PHASE1 while awaitingP3" → bogus PC=$14201 → 12 KB
 * request → 250 ms stall → wedge.
 *
 * INVARIANT (exact framing): for ONE break the worker emits exactly ONE Phase-1-typed
 * message — never a second one manufactured from the payload — even when the relayed
 * size is WRONG. The worker delimits Phase-3 by exact byte count now, but its
 * awaitingPhase1 path REJECTS an all-zero 456-block (a real Phase-1 always carries
 * non-zero CRC words). So even if a bad size forced an early resync into a hub-dump
 * zero run, that run is discarded, not framed as a bogus DEBUGGER Phase-1.
 *   v0.9.92 (worker delimits by hint, no all-zero guard): RED — spurious Phase-1.
 *   Exact framing + all-zero guard: GREEN — exactly one.
 *
 * In correct operation the size cannot be wrong (per-cog last-wins stash, one size per
 * break — no sequence-matched queue to slip). This test injects a wrong size anyway as
 * defense-in-depth: the all-zero guard keeps the $14201 class dead regardless.
 */

import { SharedCircularBuffer } from '../src/classes/shared/sharedCircularBuffer';
import { SharedMessagePool, SharedMessageType } from '../src/classes/shared/sharedMessagePool';
import { ExtractionCore } from '../src/classes/shared/extractionCore';
import { buildPhase1Packet, MSG } from './shared/debuggerFixture';

const isP1 = (t: SharedMessageType) => t >= SharedMessageType.DEBUGGER0_416BYTE && t <= SharedMessageType.DEBUGGER7_416BYTE;

test('worker must not mis-frame Phase-3 payload as a spurious Phase-1 when the hint is delayed', () => {
  // A real cog-0 Phase-1 (valid [0,0,0,0] header; PC=0).
  const p1 = buildPhase1Packet({ longs: { [MSG.COGN]: 0, [MSG.IRET]: 0 } });

  // A Phase-3 payload with an embedded all-zero run >= a Phase-1 packet — the
  // universal hub-dump pattern ([x,0,0,0] passes find416ByteBoundary's header
  // test). Prefix with non-zero cog-register-like bytes so it is unmistakably
  // mid-Phase-3, not a boundary.
  const payload = new Uint8Array(2048);
  for (let i = 0; i < 64; i++) payload[i] = 0xf0 | (i & 7); // non-zero head
  // bytes 64..2047 stay zero → contains many 456-byte [0,0,0,0] runs

  const ring = new SharedCircularBuffer(1 << 20);
  const pool = new SharedMessagePool();
  const emitted: number[] = [];
  let clock = 1000;
  const core = new ExtractionCore(ring, pool, (id) => emitted.push(id), { now: () => clock });

  ring.appendAtTail(p1);
  core.pump();                 // frames the real Phase-1 → awaitingPhase3
  ring.appendAtTail(payload);  // the break's Phase-3 streams in...
  // A DELIBERATELY WRONG size (170) for this larger break. The worker delimits the
  // body by it and resyncs early, mid-payload — but the awaitingPhase1 all-zero guard
  // discards the ensuing hub-dump zero run instead of framing it as a spurious
  // Phase-1. (In production the per-cog stash makes a wrong size impossible; this is
  // defense-in-depth.)
  core.signalDebuggerPhase3Size(0, 170);
  for (let k = 0; k < 20; k++) core.pump();

  // Count Phase-1-typed emissions. Exactly one is correct (the real break's).
  let phase1Count = 0;
  for (const id of emitted) {
    const slot = pool.get(id);
    if (isP1(slot.readType() as SharedMessageType)) phase1Count++;
    pool.release(id);
  }

  expect(phase1Count).toBe(1); // v0.9.92: FAILS (>1, spurious). Path 1: PASSES.
});
