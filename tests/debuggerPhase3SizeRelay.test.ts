/**
 * @jest-environment node
 * @format
 */

/**
 * Multi-cog §4 — per-break Phase-3 size hint RELAY (main is a pure router).
 *
 * The renderer computes each break's fixed Phase-3 size (§3); the main process
 * does NOT frame or parse — it forwards the hint straight to the extraction
 * worker so the worker's per-cog demux (§2) can delimit that cog's Phase-3
 * exactly. Keeping all framing in the worker preserves the 2 Mbaud
 * responsiveness win from the serial offload.
 *
 * These tests pin the two main-side forwards that carry the hint toward the
 * worker boundary, asserting each is a byte-exact pure forward:
 *
 *   SerialMessageProcessor.signalDebuggerPhase3Size
 *     → WorkerExtractor.signalDebuggerPhase3Size
 *       → worker.postMessage({ type: 'debuggerPhase3Size', cogId, size })
 *
 * `worker_threads` is mocked so no real thread spawns — the assertion is that
 * the relay forwards the exact payload untouched (no main-side state).
 */

// Mock worker_threads BEFORE importing anything that constructs a Worker, so
// WorkerExtractor never spawns a real thread. The mock records postMessage
// payloads for assertion.
const postedMessages: Array<Record<string, unknown>> = [];
jest.mock('worker_threads', () => {
  class MockWorker {
    public on(): this { return this; }
    public once(): this { return this; }
    public removeAllListeners(): this { return this; }
    public postMessage(msg: Record<string, unknown>): void { postedMessages.push(msg); }
    public terminate(): Promise<number> { return Promise.resolve(0); }
  }
  return { Worker: MockWorker };
});

import { WorkerExtractor } from '../src/classes/shared/workerExtractor';
import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { ExtractionCore } from '../src/classes/shared/extractionCore';
import { SharedCircularBuffer } from '../src/classes/shared/sharedCircularBuffer';
import { SharedMessagePool, SharedMessageType } from '../src/classes/shared/sharedMessagePool';
import { buildPhase1Packet } from './shared/debuggerFixture';

describe('multi-cog §4 — Phase-3 size hint relay', () => {
  beforeEach(() => {
    postedMessages.length = 0;
  });

  it('WorkerExtractor posts the hint to the worker as a debuggerPhase3Size message', () => {
    const extractor = new WorkerExtractor();
    postedMessages.length = 0; // drop the ctor's init/transferables postMessage
    extractor.signalDebuggerPhase3Size(3, 4410);
    // Exactly one message, forwarded verbatim — no transform, no extra state.
    expect(postedMessages).toEqual([{ type: 'debuggerPhase3Size', cogId: 3, size: 4410 }]);
  });

  it('carries each cog’s own (cogId, size) without cross-mixing', () => {
    const extractor = new WorkerExtractor();
    postedMessages.length = 0;
    extractor.signalDebuggerPhase3Size(0, 4410); // cog 0's break
    extractor.signalDebuggerPhase3Size(1, 234);  // cog 1's break (smaller Phase-3)
    expect(postedMessages).toEqual([
      { type: 'debuggerPhase3Size', cogId: 0, size: 4410 },
      { type: 'debuggerPhase3Size', cogId: 1, size: 234 }
    ]);
  });

  it('SerialMessageProcessor delegates to the WorkerExtractor (pure forward, no main-side state)', () => {
    const spy = jest.spyOn(WorkerExtractor.prototype, 'signalDebuggerPhase3Size');
    const processor = new SerialMessageProcessor();
    processor.signalDebuggerPhase3Size(1, 234);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1, 234);
    // And it reached the worker boundary as the exact message.
    expect(postedMessages).toContainEqual({ type: 'debuggerPhase3Size', cogId: 1, size: 234 });
    spy.mockRestore();
  });
});

/**
 * Multi-cog §4 — DTR/RTS reset returns the worker's per-cog demux to
 * awaitingPhase1. On a physical reset the P2 reboots mid-exchange; the worker
 * must abandon EVERY in-flight per-cog Phase-3 so the post-reboot first Phase-1
 * of any cog frames as a fresh break rather than being swallowed as the old
 * cog's Phase-3. resetAllDebuggers → serialProcessor.signalDebuggerReset →
 * worker → ExtractionCore.resetDebuggerFraming (proven directly here on the
 * framing engine — the worker/SAB round-trip does not deliver under Jest).
 */
describe('multi-cog §4 — DTR/RTS reset returns the demux to awaitingPhase1', () => {
  // A standalone framing core over an in-process ring + pool, with a drain that
  // records the SharedMessageType of every message the core emits.
  const makeCore = () => {
    const ring = new SharedCircularBuffer(1 << 16);
    const pool = new SharedMessagePool();
    const ids: number[] = [];
    const core = new ExtractionCore(ring, pool, (id) => ids.push(id), { now: () => 1000 });
    const feed = (bytes: Uint8Array): SharedMessageType[] => {
      ring.appendAtTail(bytes);
      core.pump();
      const out: SharedMessageType[] = [];
      while (ids.length) {
        const id = ids.shift()!;
        const slot = pool.get(id);
        out.push(slot.readType() as SharedMessageType);
        pool.release(id);
      }
      return out;
    };
    return { core, feed };
  };

  // Synthetic Phase-1: byte0 = cogId, bytes1-3 = 0 (little-endian COG LONG), rest
  // zero — the exact [cog,0,0,0] header find416ByteBoundary validates.
  const phase1 = (cog: number): Uint8Array => buildPhase1Packet({ longs: { 0: cog } });

  it('re-frames a different cog’s Phase-1 after a reset taken mid-Phase-3', () => {
    const { core, feed } = makeCore();
    // Cog 0 breaks → its Phase-1 frames; the demux enters awaitingPhase3 for cog 0.
    expect(feed(phase1(0))).toContain(SharedMessageType.DEBUGGER0_416BYTE);
    // DTR/RTS reset: abandon cog 0's in-flight exchange, back to awaitingPhase1.
    core.resetDebuggerFraming();
    // The post-reboot first Phase-1 (cog 1 here) frames as a NEW break.
    expect(feed(phase1(1))).toContain(SharedMessageType.DEBUGGER1_416BYTE);
  });

  it('WITHOUT the reset, the next cog’s Phase-1 is swallowed by the open exchange (the v0.9.88 wedge)', () => {
    const { feed } = makeCore();
    expect(feed(phase1(0))).toContain(SharedMessageType.DEBUGGER0_416BYTE);
    // No reset: still awaitingPhase3 for cog 0 with no size hint, so cog 1's
    // Phase-1 bytes sit undelimited in the ring — cog 1 never frames. This is
    // exactly the multi-cog wedge (HW v0.9.88) the sprint fixes.
    expect(feed(phase1(1))).not.toContain(SharedMessageType.DEBUGGER1_416BYTE);
  });
});
