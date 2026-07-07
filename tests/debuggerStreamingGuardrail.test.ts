/** @format */

/**
 * Multi-cog §8 — non-regression guardrail for the 2 Mbaud streaming classifier.
 *
 * The §2 worker change added per-cog debug framing (the `awaitingPhase3` drain
 * branch and the `inDebugSession` Phase-1-before-text reorder). Both are gated so
 * they are DORMANT outside a debug session — the streaming text/DB/backtick
 * classifier must behave byte-identically. This test pins that invariant: a
 * realistic NON-debug stream classifies normally and emits ZERO debugger frames,
 * and the debug path still opens correctly when a real Phase-1 arrives.
 *
 * (The broader classifier coverage lives in messageClassificationRouting /
 * cogMessageRouting / debugLoggerRouting; those stay green in the full suite.)
 */

import { SharedCircularBuffer } from '../src/classes/shared/sharedCircularBuffer';
import { SharedMessagePool, SharedMessageType } from '../src/classes/shared/sharedMessagePool';
import { ExtractionCore } from '../src/classes/shared/extractionCore';
import { buildWorkerPhase1 } from './shared/debuggerMultiCog';

const isDebugType = (t: SharedMessageType): boolean =>
  (t >= SharedMessageType.DEBUGGER0_416BYTE && t <= SharedMessageType.DEBUGGER7_416BYTE) ||
  (t >= SharedMessageType.DEBUGGER0_PHASE3 && t <= SharedMessageType.DEBUGGER7_PHASE3);

/** Minimal all-types worker harness (records every extracted message's type). */
function makeCore() {
  const ring = new SharedCircularBuffer(1 << 16);
  const pool = new SharedMessagePool();
  const ids: number[] = [];
  let clock = 1000;
  const core = new ExtractionCore(ring, pool, (id) => ids.push(id), { now: () => clock });
  const types: SharedMessageType[] = [];
  const drain = (): void => {
    while (ids.length) {
      const id = ids.shift()!;
      const slot = pool.get(id);
      types.push(slot.readType() as SharedMessageType);
      pool.release(id);
    }
  };
  const feed = (bytes: Uint8Array | string): void => {
    const b = typeof bytes === 'string'
      ? Uint8Array.from(Array.from(bytes, (c) => c.charCodeAt(0)))
      : bytes;
    ring.appendAtTail(b);
    clock += 50; // advance past the idle timeout so buffer-end text flushes
    // Pump until quiet: each pump extracts a bounded batch, so loop a few times.
    for (let i = 0; i < 8; i++) { core.pump(); drain(); }
  };
  return { core, feed, types };
}

describe('multi-cog §8 — streaming classifier untouched by debug framing', () => {
  it('classifies a non-debug stream normally and emits ZERO debugger frames', () => {
    const h = makeCore();
    // A realistic streaming mix: two Cog messages + a backtick window command.
    // None of this is a debug session.
    h.feed('Cog0  hello world\r\n');
    h.feed('Cog1  status ok\r\n');
    h.feed('`term greetings\r\n');

    // Not one debugger frame — the debug-framing branch never fired.
    expect(h.types.some(isDebugType)).toBe(false);
    // And the streaming types are exactly what the classifier should produce.
    expect(h.types).toEqual(
      expect.arrayContaining([
        SharedMessageType.COG0_MESSAGE,
        SharedMessageType.COG1_MESSAGE,
        SharedMessageType.BACKTICK_TERM
      ])
    );
  });

  it('still opens the debug path when a real Phase-1 arrives (the gate is not stuck closed)', () => {
    const h = makeCore();
    // Pure streaming first — no debug frames.
    h.feed('Cog0  running\r\n');
    expect(h.types.some(isDebugType)).toBe(false);

    // A genuine cog-2 Phase-1 → the debug branch engages and tags it correctly.
    h.feed(buildWorkerPhase1(2));
    expect(h.types).toContain(SharedMessageType.DEBUGGER2_416BYTE);
  });
});
