/** @format */

/**
 * Replay harness for the single-step debugger wire protocol (sprint
 * `dbg-comms-reframe` §1). Drives a real hardware capture through the REAL
 * pipeline — `ExtractionCore` framing → `WindowRouter` → `DebuggerController`
 * → `DebuggerPhase3Parser` — at the original USB chunk boundaries, so every
 * later section (§3 single-owner transaction, §4 recovery) has a deterministic,
 * in-container pass/fail oracle on real bytes.
 *
 * Why this exists / how it is faithful:
 *   - The worker module (`extractionWorker.ts`) throws at import without a
 *     `parentPort`, and the worker-thread + SAB round-trip does not deliver
 *     under Jest. So we construct an `ExtractionCore` (the framing engine lifted
 *     out of the worker, §1) over an in-process `SharedCircularBuffer` /
 *     `SharedMessagePool` and feed it the capture ourselves.
 *   - The desync is a RACE: the worker opens its raw-drain transaction and emits
 *     Phase-3 immediately on Phase-1 emit, but the main-side `awaitingPhase3`
 *     gate (`debugDebuggerWin.handleBinaryMessage`) only flips true after the
 *     Phase-2 reply round-trips bundle→main. Phase-3 bytes landing in that gap
 *     hit the `else` branch and are DROPPED, so that break never completes
 *     (the S1/S2 symptoms: 10/19 complete on current code). We reproduce that by
 *     modeling the controller→main→worker control round-trips as DEFERRED
 *     (applied at end-of-USB-chunk), while the core opens/drains synchronously
 *     during `pump()`.
 *   - The leading terminal text and per-chunk Phase-3 granularity match the
 *     hardware log byte-for-byte (verified during §1 bring-up).
 *
 * This module is shared test scaffolding (NOT inlined into one test) so §3/§4
 * can reuse `runReplay()` and assert against the same oracle.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { SharedCircularBuffer } from '../../src/classes/shared/sharedCircularBuffer';
import { SharedMessagePool, SharedMessageType, ExtractedMessage } from '../../src/classes/shared/sharedMessagePool';
import { ExtractionCore } from '../../src/classes/shared/extractionCore';
import { WindowRouter } from '../../src/classes/shared/windowRouter';
import { makeController, makeDebuggerState } from './debuggerFixture';

/** A loaded capture fixture: raw RX stream + the ordered USB chunk lengths. */
export interface CaptureFixture {
  bytes: Uint8Array;
  chunkLengths: number[];
  /** The real host→P2 Phase-2 replies captured from the session, as byte arrays. */
  phase2Sends: Uint8Array[];
  manifest: {
    source: string;
    totalBytes: number;
    chunkCount: number;
    chunkLengths: number[];
    phase2Sends: string[];
  };
}

const hexToBytes = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
};

/** Per-break outcome the replay observed. */
export interface ReplayBreakResult {
  /** 0-based break index in arrival order. */
  index: number;
  cogId: number;
  /** Length of the Phase-1 packet that opened this break (416 or 456). */
  phase1Length: number;
  /** Length of the Phase-2 reply the controller built (52), or null if none. */
  phase2Length: number | null;
  /** Total Phase-3 bytes actually delivered to the controller for this break. */
  phase3DeliveredBytes: number;
  /** Phase-3 raw chunks the main-side gate DROPPED before this break completed. */
  phase3DroppedChunks: number;
  phase3DroppedBytes: number;
  /** True once the parser reached `Section.Done` for this break. */
  phase3Complete: boolean;
}

export interface ReplayResult {
  totalBreaks: number;
  completedBreaks: number;
  breaks: ReplayBreakResult[];
  /** S3 — debugger binary bytes the router leaked to logger-type windows. */
  loggerBinaryMessages: number;
  loggerBinaryBytes: number;
  /** F7 — out-of-window binary the main-side gate hard-dropped (not phase1/awaited). */
  droppedBinaryMessages: number;
  droppedBinaryBytes: number;
  /** Phase-2 replies captured, in order, for cross-checking against the capture's SEND blocks. */
  phase2Replies: Uint8Array[];
}

export interface ReplayOptions {
  /**
   * Model the controller→main→worker control round-trips (awaitingPhase3 flip,
   * worker transaction close) as deferred to end-of-USB-chunk. Default true —
   * this reproduces the current code's drop race. Set false to apply control
   * signals synchronously (useful once §3/§4 make the channel race-free).
   */
  deferControlRoundTrips?: boolean;
  /** Ring size for the in-process SharedCircularBuffer (default 1 MiB). */
  ringSize?: number;
}

/** Load the committed capture fixture under tests/fixtures/debugger/. */
export function loadCaptureFixture(): CaptureFixture {
  const dir = join(__dirname, '..', 'fixtures', 'debugger');
  const bytes = new Uint8Array(readFileSync(join(dir, 'capture.bin')));
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const phase2Sends = (manifest.phase2Sends ?? []).map(hexToBytes);
  return { bytes, chunkLengths: manifest.chunkLengths, phase2Sends, manifest };
}

const isPhase1Type = (t: SharedMessageType): boolean =>
  t >= SharedMessageType.DEBUGGER0_416BYTE && t <= SharedMessageType.DEBUGGER7_416BYTE;
const isPhase3Type = (t: SharedMessageType): boolean =>
  t >= SharedMessageType.DEBUGGER0_PHASE3 && t <= SharedMessageType.DEBUGGER7_PHASE3;
const cogOfType = (t: SharedMessageType): number =>
  isPhase1Type(t) ? t - SharedMessageType.DEBUGGER0_416BYTE : t - SharedMessageType.DEBUGGER0_PHASE3;

/**
 * Replay a capture through the real pipeline and report per-break outcomes,
 * the logger leak, and hard drops.
 */
export function runReplay(fixture: CaptureFixture, options: ReplayOptions = {}): ReplayResult {
  const defer = options.deferControlRoundTrips ?? true;

  // Fresh router (singleton) with a logger window to detect the S3 leak.
  WindowRouter.resetInstance();
  const router = WindowRouter.getInstance();

  const result: ReplayResult = {
    totalBreaks: 0,
    completedBreaks: 0,
    breaks: [],
    loggerBinaryMessages: 0,
    loggerBinaryBytes: 0,
    droppedBinaryMessages: 0,
    droppedBinaryBytes: 0,
    phase2Replies: []
  };

  router.registerWindow('logger-0', 'logger', (msg) => {
    if (msg instanceof Uint8Array) {
      result.loggerBinaryMessages++;
      result.loggerBinaryBytes += msg.length;
    }
  });

  // In-process ring + pool + the real framing engine.
  const ring = new SharedCircularBuffer(options.ringSize ?? 1 << 20);
  const pool = new SharedMessagePool();
  let clock = 1000;
  const emitted: number[] = [];
  const core = new ExtractionCore(ring, pool, (id) => emitted.push(id), { now: () => clock });

  // Control round-trips queued here are applied at the end of each USB chunk
  // (deferControlRoundTrips) to reproduce the async awaitingPhase3 / close race.
  const pendingControl: Array<() => void> = [];
  const runControl = (fn: () => void) => (defer ? pendingControl.push(fn) : fn());
  const flushControl = () => {
    while (pendingControl.length) pendingControl.shift()!();
  };

  // Cogs we have already stood up a controller + window handler for.
  const cogsSeen = new Set<number>();

  const ensureCog = (cogId: number): void => {
    if (cogsSeen.has(cogId)) return;
    const gate = { awaitingP3: false };
    let current: ReplayBreakResult | null = null;

    const harness = makeController(makeDebuggerState(cogId), {
      sendPhase2: (bytes) => {
        result.phase2Replies.push(new Uint8Array(bytes));
        if (current) current.phase2Length = bytes.length;
        // Round-trip: bundle posts phase2 → main flips awaitingPhase3 true.
        runControl(() => { gate.awaitingP3 = true; });
      },
      onPhase3Complete: () => {
        if (current) current.phase3Complete = true;
        // Round-trip: bundle 'phase3Complete' → main clears awaitingPhase3 and
        // signals the worker to close its raw-drain transaction.
        runControl(() => {
          gate.awaitingP3 = false;
          core.onPhase3Done();
        });
      },
      requestRender: () => {},
      onBreakpointTimeout: () => {}
    });

    // The main-side binary handler (debugDebuggerWin.handleBinaryMessage): the
    // router hands it ONLY the bytes, so it re-derives phase1-vs-phase3 from the
    // awaitingPhase3 gate + length, exactly as production does.
    const handle = (data: Uint8Array): void => {
      if (gate.awaitingP3) {
        if (current) current.phase3DeliveredBytes += data.length;
        harness.controller.processPhase3(data);
      } else if (data.length === 416 || data.length === 456) {
        current = {
          index: result.breaks.length,
          cogId,
          phase1Length: data.length,
          phase2Length: null,
          phase3DeliveredBytes: 0,
          phase3DroppedChunks: 0,
          phase3DroppedBytes: 0,
          phase3Complete: false
        };
        result.breaks.push(current);
        result.totalBreaks++;
        harness.controller.processPhase1(data);
      } else {
        // F7: out-of-window binary, not awaited and not a phase1 frame → dropped.
        result.droppedBinaryMessages++;
        result.droppedBinaryBytes += data.length;
        if (current) {
          current.phase3DroppedChunks++;
          current.phase3DroppedBytes += data.length;
        }
      }
    };

    cogsSeen.add(cogId);
    router.registerWindow(`debugger-${cogId}`, 'debugger', (msg) => {
      if (msg instanceof Uint8Array) handle(msg);
    });
  };

  // Drain every poolId the core emitted: read the slot, route it through the
  // real WindowRouter, release the slot.
  const consume = (): void => {
    while (emitted.length) {
      const id = emitted.shift()!;
      const slot = pool.get(id);
      const type = slot.readType() as SharedMessageType;
      const data = new Uint8Array(slot.readData()); // copy out before release
      pool.release(id);

      if (isPhase1Type(type) || isPhase3Type(type)) {
        ensureCog(cogOfType(type)); // register the window before routing to it
      }
      const message: ExtractedMessage = { type, data, timestamp: clock };
      router.routeMessage(message);
    }
  };

  // The worker thread pumps continuously; one pump() drains a bounded batch, so
  // model a quiescent stretch by pumping a few times (draining the idle-flushed
  // text, then the freshly-delivered chunk).
  const pumpConsume = (times: number) => {
    for (let k = 0; k < times; k++) { core.pump(); consume(); }
  };

  // Feed the capture at the original chunk boundaries. Each chunk: model the
  // worker pumping during the inter-chunk gap (clock advances past the idle
  // timeout so any buffer-end text flushes), then deliver the chunk and pump.
  let off = 0;
  for (let i = 0; i < fixture.chunkLengths.length; i++) {
    clock += 60; // gap > IDLE_TIMEOUT_MS
    pumpConsume(2); // idle-flush any buffer-end text from the previous chunk
    ring.appendAtTail(fixture.bytes.subarray(off, off + fixture.chunkLengths[i]));
    off += fixture.chunkLengths[i];
    pumpConsume(1); // frame what the just-delivered chunk completed
    if (defer) flushControl(); // round-trips complete by the next chunk
  }
  // Trailing idle flush + drain.
  clock += 200;
  pumpConsume(4);
  flushControl();

  result.completedBreaks = result.breaks.filter((b) => b.phase3Complete).length;
  return result;
}
