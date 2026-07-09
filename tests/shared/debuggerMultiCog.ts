/** @format */

/**
 * Multi-cog §7 shared scaffolding — synthetic two-cog debug wire fixtures and a
 * WORKER-path replay driver. This drives the REAL framing engine
 * (`ExtractionCore`, where the per-cog demux lives) over an in-process ring +
 * pool, NOT the renderer `DebuggerController` — so the tests prove the worker
 * tags each cog's break correctly, which is the whole multi-cog fix.
 *
 * Path 1 (task #78): the worker is a pure DISPATCHER — it frames each break's
 * Phase-1, then STREAMS that cog's Phase-3 bytes verbatim (no size hint, no
 * delimiting, no scanning) until the cog's controller reports the break framed.
 * The replay driver models the controller + the P2's lockstep gap: it feeds each
 * break ATOMICALLY (a next break's bytes never share the wire with the current
 * break's Phase-3 — the P2 is halted until the host's next step reply) and calls
 * `done(cog)` after each break, exactly the renderer→main→worker break-complete
 * relay in production.
 *
 * Wire shapes (must match the worker's detectors byte-for-byte):
 *   • Phase-1: a 456-byte packet whose header is [cog,0,0,0] (little-endian COG
 *     LONG) — exactly what `find416ByteBoundary` validates.
 *   • Phase-3: `fixed` bytes of cog/hub data, then the self-describing smart-pin
 *     tail — 8 INTERLEAVED groups, each `[mask byte][4·popcount(mask) long bytes]`.
 *     The worker streams these verbatim; the CONTROLLER (not the worker) sizes the
 *     tail. `phase3TotalLen`/`buildWorkerPhase3` model that exact payload so the
 *     tests can assert byte-exact reassembly of what the worker streamed.
 */

import { SharedCircularBuffer } from '../../src/classes/shared/sharedCircularBuffer';
import { SharedMessagePool, SharedMessageType } from '../../src/classes/shared/sharedMessagePool';
import { ExtractionCore } from '../../src/classes/shared/extractionCore';
import { buildPhase1Packet } from './debuggerFixture';

/** 8-bit population count (mirrors ExtractionCore.popcount8). */
export function popcount8(b: number): number {
  let c = 0;
  b &= 0xff;
  while (b) { c += b & 1; b >>= 1; }
  return c;
}

/** A synthetic Phase-1 packet for `cog` (456 B, [cog,0,0,0] header). */
export function buildWorkerPhase1(cog: number): Uint8Array {
  return buildPhase1Packet({ longs: { 0: cog } });
}

export interface Phase3Opts {
  /** 8 smart-pin group masks (default all-zero → an 8-byte tail, no smart pins). */
  masks?: number[];
  /** Fill byte for the `fixed` data region (default 0x5A) — lets tests spot-check. */
  fill?: number;
}

/**
 * A synthetic Phase-3 payload: `fixed` data bytes + the interleaved smart-pin
 * tail. Total length === phase3TotalLen(fixed, masks). The long bytes after each
 * set mask are recognizable (0xC0 + group*16 + i) so reassembly can be checked.
 */
export function buildWorkerPhase3(fixed: number, opts: Phase3Opts = {}): Uint8Array {
  const masks = opts.masks ?? new Array(8).fill(0);
  if (masks.length !== 8) throw new Error('smart-pin tail requires exactly 8 group masks');
  const fill = opts.fill ?? 0x5a;
  const tail: number[] = [];
  masks.forEach((m, gi) => {
    tail.push(m & 0xff);
    const n = 4 * popcount8(m);
    for (let i = 0; i < n; i++) tail.push((0xc0 + gi * 16 + i) & 0xff);
  });
  const out = new Uint8Array(fixed + tail.length);
  out.fill(fill, 0, fixed);
  out.set(tail, fixed);
  return out;
}

/** Total delimited Phase-3 length = fixed + Σ(1 + 4·popcount(mask_g)). */
export function phase3TotalLen(fixed: number, masks: number[] = new Array(8).fill(0)): number {
  return fixed + masks.reduce((n, m) => n + 1 + 4 * popcount8(m), 0);
}

// ── Worker-path harness ──────────────────────────────────────────────────────

const P1_LO = SharedMessageType.DEBUGGER0_416BYTE;
const P1_HI = SharedMessageType.DEBUGGER7_416BYTE;
const P3_LO = SharedMessageType.DEBUGGER0_PHASE3;
const P3_HI = SharedMessageType.DEBUGGER7_PHASE3;

export interface Emission {
  cog: number;
  kind: 'p1' | 'p3';
  bytes: Uint8Array;
}

export interface WorkerHarness {
  core: ExtractionCore;
  /** Append a raw USB chunk to the ring. */
  feed(bytes: Uint8Array): void;
  /** Pump the core once; return (and record) any new debug emissions. */
  pump(): Emission[];
  /** Relay a per-break Phase-3 fixed-size hint into the worker (Path 1: no-op). */
  hint(cog: number, fixed: number): void;
  /** Relay break-complete for `cog` (renderer→main→worker): returns the worker's
   *  raw per-cog stream to awaitingPhase1 so the next Phase-1 is detected. */
  done(cog: number): void;
  /** Advance the injectable clock (ms) — for stall / timeout tests. */
  advance(ms: number): void;
  /** Resync the pipe: clear the ring and the worker's debug state — mirrors
   *  WorkerExtractor.clearBuffer (ring.clear + onClear), the DTR-reset / overflow
   *  path that recovers from a desynced (e.g. truncated) exchange. */
  reset(): void;
  /** All debug emissions so far, in arrival order. */
  emissions: Emission[];
}

/** Build a standalone worker harness over an in-process ring + pool. */
export function makeWorkerHarness(startClock = 1000): WorkerHarness {
  const ring = new SharedCircularBuffer(1 << 18);
  const pool = new SharedMessagePool();
  const ids: number[] = [];
  let clock = startClock;
  const core = new ExtractionCore(ring, pool, (id) => ids.push(id), { now: () => clock });
  const emissions: Emission[] = [];

  const drain = (): Emission[] => {
    const out: Emission[] = [];
    while (ids.length) {
      const id = ids.shift()!;
      const slot = pool.get(id);
      const type = slot.readType() as SharedMessageType;
      const bytes = new Uint8Array(slot.readData());
      pool.release(id);
      if (type >= P1_LO && type <= P1_HI) out.push({ cog: type - P1_LO, kind: 'p1', bytes });
      else if (type >= P3_LO && type <= P3_HI) out.push({ cog: type - P3_LO, kind: 'p3', bytes });
      // text / other types are irrelevant to these debug-only fixtures
    }
    emissions.push(...out);
    return out;
  };

  return {
    core,
    feed: (bytes) => { ring.appendAtTail(bytes); },
    pump: () => { core.pump(); return drain(); },
    hint: (cog, fixed) => core.signalDebuggerPhase3Size(cog, fixed),
    done: (cog) => core.onPhase3Done(cog),
    advance: (ms) => { clock += ms; },
    reset: () => { ring.clear(); core.onClear(); },
    emissions
  };
}

export interface MultiCogExchange {
  cog: number;
  fixed: number;
  /** 8 smart-pin group masks (default all-zero). */
  masks?: number[];
}

export interface BuiltStream {
  bytes: Uint8Array;
  /** Per-frame lengths in stream order: [p1,p3, p1,p3, …]. */
  frameLengths: number[];
  exchanges: Array<{ cog: number; fixed: number; masks: number[]; p3Total: number }>;
}

/** Concatenate [p1][p3] for each exchange into one atomic sequential stream. */
export function buildMultiCogStream(exchanges: MultiCogExchange[]): BuiltStream {
  const frames: Uint8Array[] = [];
  const frameLengths: number[] = [];
  const meta: BuiltStream['exchanges'] = [];
  for (const ex of exchanges) {
    const masks = ex.masks ?? new Array(8).fill(0);
    const p1 = buildWorkerPhase1(ex.cog);
    const p3 = buildWorkerPhase3(ex.fixed, { masks });
    frames.push(p1, p3);
    frameLengths.push(p1.length, p3.length);
    meta.push({ cog: ex.cog, fixed: ex.fixed, masks, p3Total: p3.length });
  }
  const total = frames.reduce((n, f) => n + f.length, 0);
  const bytes = new Uint8Array(total);
  let o = 0;
  for (const f of frames) { bytes.set(f, o); o += f.length; }
  return { bytes, frameLengths, exchanges: meta };
}

/**
 * Drive a built stream through the worker, ATOMICALLY per break (Path 1). For
 * each exchange in order: feed its Phase-1 then its Phase-3 — each split into
 * pieces of at most `maxChunk` bytes to exercise reassembly across USB-chunk
 * boundaries WITHIN the break — pumping between pieces; then call `done(cog)`,
 * the break-complete relay that returns the worker to awaitingPhase1 for the next
 * break. This models the P2's lockstep: a next break's bytes never share the wire
 * with the current break's Phase-3 (the P2 is halted until the host's next step
 * reply), so the worker never over-streams one cog's bytes onto another. Returns
 * the ordered emissions.
 */
export function runMultiCogReplay(built: BuiltStream, maxChunk = Infinity, gapMs = 1): Emission[] {
  const h = makeWorkerHarness();

  const feedFrame = (frame: Uint8Array): void => {
    const step = Number.isFinite(maxChunk) ? Math.max(1, maxChunk) : frame.length || 1;
    for (let off = 0; off < frame.length; off += step) {
      h.advance(gapMs);
      h.feed(frame.subarray(off, Math.min(off + step, frame.length)));
      h.pump();
    }
    // Drain any tail the last feed left buffered.
    for (let guard = 0; guard < 8 && h.pump().length; guard++) { /* flush */ }
  };

  let off = 0;
  for (let i = 0; i < built.exchanges.length; i++) {
    const p1Len = built.frameLengths[i * 2];
    const p3Len = built.frameLengths[i * 2 + 1];
    feedFrame(built.bytes.subarray(off, off + p1Len));          // Phase-1
    off += p1Len;
    feedFrame(built.bytes.subarray(off, off + p3Len));          // Phase-3 (streamed raw)
    off += p3Len;
    h.done(built.exchanges[i].cog); // controller break-complete → worker back to awaitingPhase1
  }
  h.advance(gapMs);
  for (let guard = 0; guard < 8 && h.pump().length; guard++) { /* final flush */ }
  return h.emissions;
}

/** Group ordered emissions into per-break records: each Phase-1 plus its
 *  reassembled (concatenated) Phase-3 chunks, in order. */
export interface Break {
  cog: number;
  phase3: Uint8Array;
  phase3ChunkCount: number;
}
export function groupBreaks(emissions: Emission[]): Break[] {
  const breaks: Break[] = [];
  let cur: { cog: number; chunks: Uint8Array[] } | null = null;
  const flush = (): void => {
    if (!cur) return;
    const len = cur.chunks.reduce((n, c) => n + c.length, 0);
    const p3 = new Uint8Array(len);
    let o = 0;
    for (const c of cur.chunks) { p3.set(c, o); o += c.length; }
    breaks.push({ cog: cur.cog, phase3: p3, phase3ChunkCount: cur.chunks.length });
    cur = null;
  };
  for (const e of emissions) {
    if (e.kind === 'p1') { flush(); cur = { cog: e.cog, chunks: [] }; }
    else if (cur) cur.chunks.push(e.bytes);
  }
  flush();
  return breaks;
}
