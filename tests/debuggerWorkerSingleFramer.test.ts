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
 * INVARIANT (Path 1): for ONE break (one real Phase-1 + its Phase-3 payload) the
 * worker emits exactly ONE Phase-1-typed message — never a second one manufactured
 * from the payload — REGARDLESS of hint timing, because it no longer scans or
 * delimits Phase-3 at all (it streams it verbatim until the controller relays
 * break-complete).
 *   v0.9.92 (worker delimits Phase-3 by hint): RED — emits a spurious Phase-1.
 *   Path 1 (worker does not scan/delimit Phase-3): GREEN — emits exactly one.
 *
 * Injecting a DRIFTED hint here is fair: the drift's CAUSE is cross-process timing
 * (not reproducible in-container), but its CONSEQUENCE under the old design was
 * deterministic, and HW logs prove the drift occurs. Under Path 1 the hint is an
 * accepted no-op, so its timing can no longer matter — which is the whole point.
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
  // The hint that arrives is DRIFTED — a small stall-poll break's fixed size (170)
  // dequeued for this larger break (the proven per-cog FIFO drift). Under the old
  // design this under-drained and re-scanned the zero run as a Phase-1; Path 1
  // ignores the hint entirely and streams the payload verbatim.
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
