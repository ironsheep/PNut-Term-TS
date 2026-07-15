/** @format */

// src/classes/shared/extractionCore.ts

import { SharedCircularBuffer, NextStatus } from './sharedCircularBuffer';
import { SharedMessagePool, SharedMessageType, PoolSlot } from './sharedMessagePool';

/**
 * ExtractionCore — the pure, transport-agnostic message-extraction engine.
 *
 * This is the framing + classification logic that used to live directly in
 * `extractionWorker.ts`. It was lifted out VERBATIM (behavior-preserving
 * code-move) so it can be driven both:
 *   • by the worker thread (production): `extractionWorker.ts` is now a thin
 *     `worker_threads` shell that owns the SAB transport + parentPort wiring and
 *     delegates all framing to a single `ExtractionCore` instance; and
 *   • in-process by tests (the §1 debugger replay harness): the worker module
 *     throws at import when `parentPort` is undefined and the worker-thread+SAB
 *     round-trip does not deliver under Jest, so the harness instead constructs
 *     an `ExtractionCore` over an in-process `SharedCircularBuffer` /
 *     `SharedMessagePool` and feeds it the captured USB byte stream at the
 *     original chunk boundaries.
 *
 * The core does simple boundary detection (CR/LF, 0xDB length, 416-byte) and
 * trivial classification (first bytes → MessageType enum), exactly as before.
 * The single-step debugger Phase-3 raw-passthrough state machine
 * (`debuggerTransactionCog`) lives here too.
 *
 * Injected dependencies:
 *   - `buffer` : the SharedCircularBuffer to read from.
 *   - `pool`   : the SharedMessagePool to write extracted messages into.
 *   - `emit`   : called with a freshly-written slot's poolId (production wires
 *                this to `parentPort.postMessage({type:'message', poolId})`).
 *   - `now`    : monotonic clock for the CR/LF idle-timeout (default Date.now;
 *                injectable so tests can drive idle-timeout deterministically).
 */

const DEFAULT_ENABLE_CONSOLE_LOG = false;

/**
 * Helper: STRICT check if byte looks like start of valid P2 message
 * Used only for backtick messages (SPRITEDEF protection) where binary data
 * may contain embedded CR/LF that should NOT be treated as message boundaries.
 *
 * Returns true for:
 * - Backtick (0x60) - window command
 * - "C" (0x43) - potential COG message
 * - 0xDB - debugger packet
 * - 0x01-0x10 - PST control sequences
 * Note: 0x00 (NUL) excluded — common in PST text, not a valid message start.
 */
function looksLikeMessageStart(firstByte: number | undefined): boolean {
  if (firstByte === undefined) {
    return true; // End of buffer - treat as valid boundary
  }

  // Backtick - window command
  if (firstByte === 0x60) {
    return true;
  }

  // "C" - potential start of "Cog" message
  if (firstByte === 0x43) {
    return true;
  }

  // 0xDB - debugger protocol packet
  if (firstByte === 0xDB) {
    return true;
  }

  // PST control sequences (0x01-0x10)
  if (firstByte >= 0x01 && firstByte <= 0x10) {
    return true;
  }

  return false;
}

/**
 * Helper: RELAXED check if byte looks like start of a new text line
 * Used for non-backtick messages (terminal output, COG messages, etc.)
 * where CR/LF is always a real line terminator.
 *
 * Includes everything from looksLikeMessageStart() PLUS printable ASCII (0x20-0x7E),
 * since text lines commonly start with spaces, letters, digits, punctuation, etc.
 */
function looksLikeTextLineStart(firstByte: number | undefined): boolean {
  if (firstByte === undefined) {
    return true; // End of buffer - treat as valid boundary
  }

  // Printable ASCII (space through tilde) - covers most text line starts
  if (firstByte >= 0x20 && firstByte <= 0x7E) {
    return true;
  }

  // PST control sequences (0x01-0x10)
  if (firstByte >= 0x01 && firstByte <= 0x10) {
    return true;
  }

  // 0xDB - debugger protocol packet
  if (firstByte === 0xDB) {
    return true;
  }

  return false;
}

/**
 * Helper: Extract window command from backtick message
 * Returns lowercase command string (between backtick and first space)
 */
function extractWindowCommand(data: Uint8Array): string | null {
  if (data.length < 2 || data[0] !== 0x60) { // 0x60 = backtick
    return null;
  }

  // Find first space after backtick
  let endIndex = 1;
  while (endIndex < data.length && data[endIndex] !== 0x20) { // 0x20 = space
    endIndex++;
  }

  if (endIndex === 1 || endIndex >= data.length) {
    return null; // No command found
  }

  // Extract command bytes (between backtick and space)
  const commandBytes = data.slice(1, endIndex);
  const command = String.fromCharCode(...commandBytes).toLowerCase();
  return command;
}

/**
 * Helper: Check if text matches P2_SYSTEM_INIT pattern
 * Pattern: "Cog0 INIT $0000_0000 $0000_0000 load"
 */
function isP2SystemInit(data: Uint8Array): boolean {
  const pattern = 'Cog0 INIT $0000_0000 $0000_0000 load';

  if (data.length < pattern.length) {
    return false;
  }

  // Compare bytes (ASCII)
  for (let i = 0; i < pattern.length; i++) {
    if (data[i] !== pattern.charCodeAt(i)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if message contains only whitespace characters
 * Whitespace: CR (0x0D), LF (0x0A), Space (0x20), Tab (0x09)
 */
function isWhitespaceOnly(data: Uint8Array): boolean {
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    if (byte !== 0x0D && byte !== 0x0A && byte !== 0x20 && byte !== 0x09) {
      return false; // Found non-whitespace
    }
  }
  return true; // All whitespace
}

export interface ExtractionCoreOptions {
  /** Monotonic clock for the CR/LF idle-timeout (default Date.now). */
  now?: () => number;
  /** Mirror of the worker's ENABLE_CONSOLE_LOG diagnostic gate (default false). */
  enableConsoleLog?: boolean;
}

/** Exact-framing stages for the active break's Phase-3 (see debugPhase3Cog). */
const enum Phase3Stage {
  AwaitSize, // waiting for pendingFixed[cog] (relayed) — WAIT, never scan
  Fixed,     // draining the FIXED body (relayed size)
  SmartPin   // walking the 8 smart-pin groups: each = 1 mask byte + 4·popcount longs
}

export class ExtractionCore {
  private buffer: SharedCircularBuffer;
  private messagePool: SharedMessagePool;
  private emit: (poolId: number) => void;
  private now: () => number;
  private enableConsoleLog: boolean;

  // Idle timeout detection for CR/LF at buffer end
  // When CR/LF appears at buffer end, wait for this timeout before extracting
  // to distinguish "waiting for next USB packet" from "transmission complete"
  private static readonly IDLE_TIMEOUT_MS = 50; // 50ms idle time means transmission is complete
  private lastBufferActivity: number = 0; // Timestamp of last new data written to buffer
  private lastKnownTailPosition: number = -1; // Track buffer write position to detect new data

  private isExtracting: boolean = false;
  private extractionCount: number = 0;
  private extractedSinceStats: number = 0;

  // Sticky context for whitespace-only messages (blank lines)
  // Tracks last COG or TERMINAL message type to properly classify blank lines
  private stickyContext: SharedMessageType = SharedMessageType.TERMINAL_OUTPUT;

  // [#30] Pool backpressure (no drop). When the SharedMessagePool is momentarily full we stash
  // the ONE already-extracted message and STOP extracting, leaving un-extracted data in the ring
  // (upstream backpressure) instead of dropping. The autonomous loop retries placing the stash
  // until main routes+releases a slot. No data lost; no thread blocks (main keeps draining its
  // port queue → releases slots → we resume). Cleared on buffer clear/DTR-reset.
  private stashedMessage: { data: Uint8Array; type: SharedMessageType } | null = null;
  private poolBackpressureEvents: number = 0;

  // ────────────────────────────────────────────────────────────────────────
  // Single-step debugger per-cog demux / dispatcher (multi-cog, Path 1 — task #78)
  //
  // The P2 debug protocol per cog is phase1(456B, framed) → phase2(host→P2) →
  // phase3(VARIABLE, RAW — no cog-id prefix, no length). The P2 holds hardware
  // lock[15] for the whole exchange (Spin2_debugger.spin2 :201/:235), so exactly
  // ONE cog's exchange is on the wire at a time — never byte-interleaved. This is
  // the worker-side ChrIn analog (Pascal DebugUnit.pas :177-194): one place reads
  // the cog-ID at each break boundary and routes.
  //
  // MULTI-COG EXACT FRAMING — the worker is the SOLE Phase-3 framer and delimits
  // each break by EXACT BYTE COUNT, so it returns to awaitingPhase1 at the precise
  // boundary regardless of what other cogs are doing on the wire. This replaces the
  // v0.9.93 "stream verbatim until onPhase3Done" model, whose correctness rested on
  // "the P2 is halted until the host steps it" — true for one cog, FALSE when a
  // second cog runs (test12: Cog 0 in repeat mode injects its next break onto the
  // wire before Cog 1's onPhase3Done resyncs the worker, so Cog 0's bytes are
  // mis-tagged as Cog 1's Phase-3 and framing desyncs).
  //
  // A break's Phase-3 length = FIXED body (changed cog/hub blocks + optional
  // disasm + fixed pointer/hub reads) + a self-describing SMART-PIN TAIL
  // (SMART_PIN_MASK_BYTES mask bytes + 4·Σsetbits). The FIXED body is a popcount of
  // the SAME request bitmap the P2 obeys, computed by the renderer and relayed per
  // break via signalDebuggerPhase3Size → pendingFixed[cog]. The TAIL is read from
  // the stream. So the boundary is a function of the WIRE + one causally-prior
  // input (the size arrives via fast IPC before the Phase-3 bytes arrive via the
  // slow serial round-trip). Three rules make this race-free where the v0.9.89-91
  // size-hint was not: (1) ONE framer (the renderer only PARSES pre-bounded frames),
  // (2) per-cog last-wins stash — NOT a sequence-matched queue, and (3) WAIT, never
  // scan — if a cog's size has not arrived we leave its bytes in the ring rather
  // than guess a boundary (guessing + scanning is exactly what produced the $14201
  // mis-frame). Framing state machine, per active cog:
  //   AwaitSize → Fixed (drain pendingFixed[cog] bytes) → Mask (read 8, popcount →
  //   tail len) → Tail (drain 4·Σsetbits) → resync to awaitingPhase1.
  // DTR/RTS reset (resetDebuggerFraming) still abandons any in-flight exchange.
  private debugPhase3Cog: number | null = null;       // cog whose phase3 we're framing (null = awaitingPhase1)
  // Per-cog exact-framing progress for the ACTIVE break (only debugPhase3Cog's are live).
  private p3Stage: Phase3Stage = Phase3Stage.AwaitSize;
  private p3FixedRemaining = 0;                        // FIXED-body bytes still to drain this break
  private p3SmartGroup = 0;                            // current smart-pin group 0..8 (8 = tail done)
  private p3GroupLongs = -1;                           // long-bytes left in this group; -1 = need its mask byte
  // Per-cog relayed FIXED size (signalDebuggerPhase3Size), consumed once per break.
  // Index = cogId 0..7; undefined = not yet arrived (→ WAIT, never scan).
  private pendingFixed: Array<number | undefined> = new Array(8).fill(undefined);
  // The smart-pin tail is 8 groups (SMART_PINS/8), each: 1 mask byte + one long per set bit.
  private static readonly SMART_PIN_GROUPS = 8;
  /** popcount of a byte (set-bit count) — sizes the smart-pin tail. */
  private static popcount8(b: number): number {
    b = b - ((b >> 1) & 0x55);
    b = (b & 0x33) + ((b >> 2) & 0x33);
    return (b + (b >> 4)) & 0x0f;
  }
  /** True if every byte is zero — a real Phase-1 never is (see the framing guard). */
  private static isAllZero(bytes: Uint8Array): boolean {
    for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) return false;
    return true;
  }
  // True once any debugger Phase-1 has been seen (until a DTR/clear). While set,
  // awaitingPhase1 detection tries find416ByteBoundary BEFORE findTextBoundary so a
  // binary Phase-1 packet is never chopped at an embedded CR/LF (which findText
  // would do once the idle timeout expires — e.g. a trailing break at capture end).
  // The strict [cog,0,0,0] Phase-1 header is unambiguous inside a debug session and
  // never collides with terminal text (ASCII) or the ROM CogN INIT lines ('C'=0x43).
  // Scoped to debug sessions → zero effect on the 2 Mbaud streaming classifier.
  private inDebugSession: boolean = false;
  private static readonly PHASE3_DRAIN_CAP = 4096; // ≤ large-slot capacity (8184B) — keeps one chunk in one slot

  constructor(
    buffer: SharedCircularBuffer,
    messagePool: SharedMessagePool,
    emit: (poolId: number) => void,
    options: ExtractionCoreOptions = {}
  ) {
    this.buffer = buffer;
    this.messagePool = messagePool;
    this.emit = emit;
    this.now = options.now ?? Date.now;
    this.enableConsoleLog = options.enableConsoleLog ?? DEFAULT_ENABLE_CONSOLE_LOG;
  }

  // ── Diagnostics / stats accessors (production rx-stats reads these) ────────

  public getExtractionCount(): number {
    return this.extractionCount;
  }

  public getPoolBackpressureEvents(): number {
    return this.poolBackpressureEvents;
  }

  public hasStash(): boolean {
    return this.stashedMessage !== null;
  }

  /** Return the count extracted since the last call and reset it (rx-stats). */
  public takeExtractedSinceStats(): number {
    const n = this.extractedSinceStats;
    this.extractedSinceStats = 0;
    return n;
  }

  // ── Control signals (production wires these to parentPort messages) ────────

  /**
   * Cog `cogId`'s controller reported its break fully framed (Phase-3 complete) —
   * relayed renderer→main→worker. Path 1: this is the ONLY signal that ends the
   * worker's raw Phase-3 stream for that cog and returns it to awaitingPhase1, so
   * the NEXT break's Phase-1 (of any cog) is detected. Match the cog we are
   * streaming before clearing so a stale/foreign Done can never close the wrong
   * cog's exchange. Race-free: the break-complete relay is causally before the
   * next Phase-1 (the P2 stays halted until the host's next step reply).
   */
  public onPhase3Done(_cogId: number): void {
    // NO-OP under multi-cog exact framing: the worker now delimits each break's
    // Phase-3 by exact byte count and self-resyncs (see the Phase3Stage machine), so
    // it no longer depends on the renderer's break-complete relay. Acting on this
    // signal here would be HARMFUL — a break-complete for cog N arriving mid-stream
    // could reset the active framing early. Kept as an accepted no-op so the
    // renderer→main→worker relay needs no change; the whole relay is slated for
    // removal in the §10 post-certification cleanup.
  }

  /**
   * Per-break FIXED Phase-3 size, relayed renderer→main→worker. This is the popcount
   * of the SAME request bitmap the P2 obeys (DebuggerController.buildPhase2 →
   * expectedPhase3Fixed), so the worker and the P2 agree by construction. The worker
   * uses it to delimit the FIXED body (the smart-pin tail is self-describing). Stored
   * per-cog, last-wins, consumed once per break (see the AwaitSize stage). Bound to
   * the cog — NOT a sequence-matched queue — so it cannot misalign; causally it
   * arrives (fast IPC) before that break's Phase-3 bytes (slow serial round-trip).
   */
  public signalDebuggerPhase3Size(cogId: number, size: number): void {
    if (cogId >= 0 && cogId < this.pendingFixed.length) {
      this.pendingFixed[cogId] = size;
    }
  }

  /**
   * Main cleared the ring (DTR-reset / resync) — drop any stashed pre-reset
   * message so it isn't emitted after the boundary, and abandon any in-flight
   * per-cog debug exchange. (The ring itself is reset on the caller's side.)
   */
  public onClear(): void {
    this.stashedMessage = null;
    this.resetDebugPhase3();
    this.pendingFixed.fill(undefined); // drop any relayed sizes from before the boundary
    this.inDebugSession = false;
  }

  /**
   * DTR/RTS reset (multi-cog §4): the P2 rebooted, so abandon EVERY in-flight
   * per-cog debug exchange and leave the debug session, returning the worker to
   * awaitingPhase1 for the post-reboot first Phase-1 of any cog. Scoped to
   * debug-framing state ONLY — it does NOT touch the streaming ring/stash, so it
   * can never perturb the 2 Mbaud classifier. Without this, a reset taken mid-
   * Phase-3 would leave the worker stuck streaming the old cog's (now defunct)
   * exchange and wedge every post-reboot break.
   */
  public resetDebuggerFraming(): void {
    this.resetDebugPhase3();
    this.pendingFixed.fill(undefined); // post-reboot: abandon every cog's relayed size
    this.inDebugSession = false;
  }

  /** Return to awaitingPhase1, dropping any in-flight per-cog Phase-3 framing. */
  private resetDebugPhase3(): void {
    this.debugPhase3Cog = null;
    this.p3Stage = Phase3Stage.AwaitSize;
    this.p3FixedRemaining = 0;
    this.p3SmartGroup = 0;
    this.p3GroupLongs = -1;
  }

  /**
   * Emit `len` bytes from the ring head as this cog's DEBUGGER{cog}_PHASE3 frame.
   * ALWAYS consumes the bytes (they are committed to leaving the ring); on pool
   * backpressure it stashes the chunk (no data lost) and returns false so the
   * caller stops this tick — the stash is placed first next tick. Returns true on
   * a clean emit. The DISTINCT phase3 type carries the cog-id for routing but does
   * NOT trigger the byte-derived window-creation event.
   */
  private emitPhase3Chunk(cog: number, len: number): boolean {
    const raw = this.buffer.peekAtOffset(0, len);
    if (!raw) return false; // defensive — callers guarantee len ≤ getUsedSpace()
    this.buffer.consume(len);
    const type = (SharedMessageType.DEBUGGER0_PHASE3 + cog) as SharedMessageType;
    const slot = this.messagePool.acquire(raw.length);
    if (!slot) {
      this.stashedMessage = { data: new Uint8Array(raw), type };
      this.poolBackpressureEvents++;
      return false;
    }
    this.writeMessageToSlot(slot, raw, type);
    return true;
  }

  /**
   * Does the ring head look like a debugger Phase-1 header — cog-id byte 0x00-0x07
   * followed by three 0x00 bytes (the COGN long, little-endian)? Peeks (no
   * consume). Used only inside a debug session to force full-456 Phase-1 framing
   * over findTextBoundary. Returns false if fewer than 4 bytes are buffered.
   */
  private headLooksLikePhase1Header(): boolean {
    if (this.buffer.getUsedSpace() < 4) return false;
    const h = this.buffer.peekAtOffset(0, 4);
    return !!h && h[0] <= 0x07 && h[1] === 0 && h[2] === 0 && h[3] === 0;
  }

  /**
   * Does the ring head begin with the P2 debug ROM's cog-init banner,
   * "CogN  INIT " (N = 0-7, TWO spaces — the exact ROM format)? Peeks (no
   * consume). This line is emitted at the very START of a debug session, BEFORE
   * the first Phase-1, so recognizing it arms `inDebugSession` in time for step-1b
   * to frame that first Phase-1 — even when the banner and the Phase-1 arrive in
   * the SAME USB burst (a PASM program that breaks on its first instruction, e.g.
   * test12_multicog). Without this, first-contact framing is a chicken-and-egg:
   * `inDebugSession` armed only AFTER the first Phase-1 emits, so the first Phase-1
   * was never framed. Scoped: ONLY this exact ROM banner arms debug framing, so the
   * 2 Mbaud streaming classifier is untouched (arbitrary text never matches).
   */
  private headLooksLikeCogInitLine(): boolean {
    if (this.buffer.getUsedSpace() < 10) return false;
    const h = this.buffer.peekAtOffset(0, 10);
    return (
      !!h &&
      h[0] === 0x43 && h[1] === 0x6f && h[2] === 0x67 &&               // "Cog"
      h[3] >= 0x30 && h[3] <= 0x37 &&                                  // 0-7
      h[4] === 0x20 && h[5] === 0x20 &&                                // two spaces
      h[6] === 0x49 && h[7] === 0x4e && h[8] === 0x49 && h[9] === 0x54 // "INIT"
    );
  }

  private logConsoleMessage(...args: any[]): void {
    if (this.enableConsoleLog) {
      console.log('[ExtractionCore]', ...args);
    }
  }

  /**
   * Track buffer activity (watch the write/tail position) and extract if there
   * is data (or a stashed message) and we are not already extracting. This is
   * the body of the worker's old `autonomousLoop` minus the `setImmediate`
   * scheduling, so production calls it on each tick and tests call it after
   * feeding each chunk.
   */
  public pump(): void {
    // Track buffer activity by watching the write (tail) position.
    // When new USB data is written, the tail advances. This correctly detects
    // new data even when old data sits in the buffer (e.g., unterminated prompt
    // text with no CR/LF).
    const currentTail = this.buffer.getTailPosition();
    if (currentTail !== this.lastKnownTailPosition) {
      this.lastBufferActivity = this.now();
      this.lastKnownTailPosition = currentTail;
    }

    const hasData = this.buffer.hasData();

    // [#30] The stash must keep being retried even if the ring is momentarily
    // empty, so it is placed as soon as main frees a slot.
    if ((hasData || this.stashedMessage) && !this.isExtracting) {
      this.extractMessages();
    }
  }

  // ── Boundary detection ────────────────────────────────────────────────────

  /**
   * Boundary Detection: Text message (CR/LF terminated)
   * Returns message bytes if complete, null if incomplete
   * @param idleTimeoutExpired - If true, treat CR/LF at buffer end as valid EOL (transmission complete)
   *
   * Supports 4 EOL patterns: CR only, CRLF, LF only, LFCR.
   * EOL validation: CR/LF only treated as a message boundary if followed by a
   * valid message start (protects SPRITEDEF binary data with embedded CR/LF).
   * Idle-timeout fix: CR/LF at buffer end waits for idle before treating as EOL
   * (distinguishes "waiting for next USB packet" from "transmission complete").
   */
  private findTextBoundary(idleTimeoutExpired: boolean): Uint8Array | null {
    const buffer = this.buffer;
    if (!buffer.hasData()) {
      return null;
    }

    buffer.savePosition();
    const messageBytes: number[] = [];
    const MAX_TEXT_LENGTH = 65536; // 64KB - matches max message size, supports large SPRITEDEF commands
    let isBacktickMessage = false; // Track for SPRITEDEF binary data protection

    while (messageBytes.length < MAX_TEXT_LENGTH) {
      const result = buffer.next();

      if (result.status === NextStatus.EMPTY) {
        buffer.restorePosition();
        return null;
      }

      messageBytes.push(result.value!);

      // After first byte, determine boundary validation mode:
      // - Backtick messages use STRICT check (protects SPRITEDEF binary data with embedded CR/LF)
      // - All other messages use RELAXED check (printable ASCII is a valid line start)
      if (messageBytes.length === 1) {
        isBacktickMessage = result.value === 0x60;
      }

      // Select boundary validator based on message type
      const baseBoundary = isBacktickMessage ? looksLikeMessageStart : looksLikeTextLineStart;
      // In a debug session, a byte 0x00-0x07 immediately after a line terminator is
      // a debugger Phase-1 header (the cog-id LONG), NOT embedded text data — so
      // treat it as a valid boundary. This lets the ROM "CogN  INIT" banner split
      // cleanly from the binary Phase-1 that follows it in the same burst (only cog 0
      // needs this — 0x01-0x07 already pass as PST controls; 0x00 is the gap).
      // Scoped to debug sessions → the 2 Mbaud streaming classifier is untouched.
      const isValidBoundary: (b: number | undefined) => boolean = this.inDebugSession
        ? (b) => baseBoundary(b) || (b !== undefined && b <= 0x07)
        : baseBoundary;

      // Check for CR (0x0D)
      if (result.value === 0x0D) {
        const lfResult = buffer.next();
        if (lfResult.status === NextStatus.EMPTY) {
          // CR at end of buffer
          if (idleTimeoutExpired) {
            return new Uint8Array(messageBytes);
          } else {
            buffer.restorePosition();
            return null; // Wait for more data
          }
        }

        if (lfResult.value === 0x0A) {
          // CRLF pattern (0x0D 0x0A) - check if followed by valid message/line start
          buffer.savePosition();
          const nextByteResult = buffer.next();
          const nextByte = nextByteResult.status === NextStatus.EMPTY ? undefined : nextByteResult.value;

          if (isValidBoundary(nextByte)) {
            // Valid EOL - restore position to put back the peeked byte, then return message
            buffer.restorePosition();
            messageBytes.push(0x0A);
            return new Uint8Array(messageBytes);
          } else {
            // Not a valid EOL - embedded CR/LF in data, continue accumulating
            messageBytes.push(0x0A);
            if (nextByte !== undefined) {
              messageBytes.push(nextByte);
            }
          }
        } else {
          // CR not followed by LF - check if CR alone is valid EOL
          if (isValidBoundary(lfResult.value)) {
            // CR only is valid EOL - restore to put back the peeked byte
            buffer.restorePosition();
            // Re-advance to include CR we found
            for (let i = 0; i < messageBytes.length; i++) {
              buffer.next();
            }
            return new Uint8Array(messageBytes);
          } else {
            // Not a valid EOL - embedded CR in data, continue accumulating
            messageBytes.push(lfResult.value!);
          }
        }
      }
      // Check for LF (0x0A)
      else if (result.value === 0x0A) {
        const crResult = buffer.next();
        if (crResult.status === NextStatus.EMPTY) {
          // LF at end of buffer
          if (idleTimeoutExpired) {
            return new Uint8Array(messageBytes);
          } else {
            buffer.restorePosition();
            return null; // Wait for more data
          }
        }

        if (crResult.value === 0x0D) {
          // LFCR pattern (0x0A 0x0D) - check if followed by valid message/line start
          buffer.savePosition();
          const nextByteResult = buffer.next();
          const nextByte = nextByteResult.status === NextStatus.EMPTY ? undefined : nextByteResult.value;

          if (isValidBoundary(nextByte)) {
            // Valid EOL - restore position to put back the peeked byte, then return message
            buffer.restorePosition();
            messageBytes.push(0x0D);
            return new Uint8Array(messageBytes);
          } else {
            // Not a valid EOL - embedded LF/CR in data, continue accumulating
            messageBytes.push(0x0D);
            if (nextByte !== undefined) {
              messageBytes.push(nextByte);
            }
          }
        } else {
          // LF not followed by CR - check if LF alone is valid EOL
          if (isValidBoundary(crResult.value)) {
            // LF only is valid EOL - restore to put back the peeked byte
            buffer.restorePosition();
            // Re-advance to include LF we found
            for (let i = 0; i < messageBytes.length; i++) {
              buffer.next();
            }
            return new Uint8Array(messageBytes);
          } else {
            // Not a valid EOL - embedded LF in data, continue accumulating
            messageBytes.push(crResult.value!);
          }
        }
      }
    }

    // Too long (>65536 bytes) - not a text message
    buffer.restorePosition();
    return null;
  }

  /**
   * Boundary Detection: DB_PACKET (0xDB + 2-byte length)
   * Returns message bytes if complete, null if incomplete
   *
   * Validation:
   * - Rejects payloads > 8KB (prevents buffer overflow from corrupted length)
   * - Verifies all payload bytes available before reading
   */
  private findDBPacketBoundary(): Uint8Array | null {
    const buffer = this.buffer;
    if (!buffer.hasData()) {
      return null;
    }

    buffer.savePosition();

    // Check for 0xDB
    const dbResult = buffer.next();
    if (dbResult.status === NextStatus.EMPTY || dbResult.value !== 0xDB) {
      buffer.restorePosition();
      return null;
    }

    // Read 2-byte length (little-endian)
    const len1 = buffer.next();
    const len2 = buffer.next();

    if (len1.status === NextStatus.EMPTY || len2.status === NextStatus.EMPTY) {
      buffer.restorePosition();
      return null;
    }

    const length = len1.value! | (len2.value! << 8);

    // VALIDATION: Reject unreasonably large payloads (over 8KB is suspicious for P2)
    if (length > 8192) {
      buffer.restorePosition();
      return null; // Likely corrupted length field
    }

    // VALIDATION: Verify all payload bytes are available before reading
    buffer.savePosition();

    // Count available payload bytes
    for (let i = 0; i < length; i++) {
      const result = buffer.next();
      if (result.status === NextStatus.EMPTY) {
        // Not enough data - restore and return incomplete
        buffer.restorePosition();
        return null;
      }
    }

    // All bytes available - restore to header end and read them
    buffer.restorePosition();

    const messageBytes: number[] = [0xDB, len1.value!, len2.value!];

    // Read 'length' bytes of payload
    for (let i = 0; i < length; i++) {
      const result = buffer.next();
      messageBytes.push(result.value!);
    }

    return new Uint8Array(messageBytes);
  }

  /**
   * Boundary Detection: debugger Phase-1 packet (456 bytes).
   * Returns message bytes if complete, null if incomplete.
   *
   * Size is authoritative: the Spin2 debugger kernel sends 20 longs + 64 CRC
   * words + 124 hub checksum words = 456 bytes (DebuggerUnit.pas `Breakpoint`
   * reads the same). This frames only the FIRST Phase-1 of a break session —
   * the single-owner controller re-frames everything after (see
   * DebuggerController §3); the worker then raw-passes the rest.
   *
   * CRITICAL: validates first byte is 0x00-0x07 (COG ID) and bytes 1-3 are 0x00
   * (COG number is a little-endian LONG). Without this, ANY 456 bytes would be
   * extracted as a debugger packet, splitting large text messages like SPRITEDEF.
   */
  private find416ByteBoundary(): Uint8Array | null {
    const buffer = this.buffer;
    if (!buffer.hasData()) {
      return null;
    }

    buffer.savePosition();

    // VALIDATION: Check first byte is 0x00-0x07 (COG ID for debugger packet)
    const firstByteResult = buffer.next();
    if (firstByteResult.status === NextStatus.EMPTY) {
      buffer.restorePosition();
      return null;
    }

    const firstByte = firstByteResult.value!;
    if (firstByte < 0x00 || firstByte > 0x07) {
      // Not a valid 416-byte debugger packet - restore position
      buffer.restorePosition();
      return null;
    }

    // ENHANCED VALIDATION: Bytes 1-3 must be 0x00 (COG number is little-endian LONG)
    const byte1Result = buffer.next();
    const byte2Result = buffer.next();
    const byte3Result = buffer.next();

    if (byte1Result.status === NextStatus.EMPTY ||
        byte2Result.status === NextStatus.EMPTY ||
        byte3Result.status === NextStatus.EMPTY) {
      buffer.restorePosition();
      return null;
    }

    if (byte1Result.value !== 0x00 || byte2Result.value !== 0x00 || byte3Result.value !== 0x00) {
      // Not a valid debugger packet - bytes 1-3 should be 0x00 for little-endian LONG
      buffer.restorePosition();
      return null;
    }

    // Valid COG ID with proper LONG format - extract the full Phase-1 packet.
    const messageBytes: number[] = [firstByte, 0x00, 0x00, 0x00];
    const DEBUGGER_SIZE = 456; // 20 longs + 64 CRC words + 124 hub words (authoritative)

    for (let i = 4; i < DEBUGGER_SIZE; i++) {  // Start at 4 since we already read 4 bytes
      const result = buffer.next();
      if (result.status === NextStatus.EMPTY) {
        buffer.restorePosition();
        return null;
      }
      messageBytes.push(result.value!);
    }

    return new Uint8Array(messageBytes);
  }

  // ── Classification ────────────────────────────────────────────────────────

  /**
   * Classify message based on content. Returns SharedMessageType or null if
   * unrecognized. Updates the sticky context for whitespace-only blank lines.
   */
  private classifyMessage(data: Uint8Array): SharedMessageType | null {
    if (data.length === 0) {
      return null;
    }

    // Rule 0: Whitespace-only messages (blank lines)
    // Context-aware classification - inherit type from previous COG/TERMINAL message
    if (isWhitespaceOnly(data)) {
      return this.stickyContext; // Return last COG/TERMINAL context
    }

    const firstByte = data[0];

    // DB_PACKET: 0xDB
    if (firstByte === 0xDB) {
      return SharedMessageType.DB_PACKET;
    }

    // 416-byte debugger packet: 0x00-0x07 (COG ID) with 32-bit LE validation
    if (firstByte >= 0x00 && firstByte <= 0x07 &&
        data.length >= 4 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x00) {
      // DEBUGGER0-7_416BYTE
      return (SharedMessageType.DEBUGGER0_416BYTE + firstByte) as SharedMessageType;
    }

    // Window commands: `<command> ...
    if (firstByte === 0x60) { // Backtick
      const command = extractWindowCommand(data);
      if (command) {
        switch (command) {
          case 'logic': return SharedMessageType.BACKTICK_LOGIC;
          case 'scope': return SharedMessageType.BACKTICK_SCOPE;
          case 'scope_xy': return SharedMessageType.BACKTICK_SCOPE_XY;
          case 'fft': return SharedMessageType.BACKTICK_FFT;
          case 'spectro': return SharedMessageType.BACKTICK_SPECTRO;
          case 'plot': return SharedMessageType.BACKTICK_PLOT;
          case 'term': return SharedMessageType.BACKTICK_TERM;
          case 'bitmap': return SharedMessageType.BACKTICK_BITMAP;
          case 'midi': return SharedMessageType.BACKTICK_MIDI;
          default:
            // Unknown window command - window update with user-defined name
            return SharedMessageType.BACKTICK_UPDATE;
        }
      }
      // Backtick with no valid command - still treat as window update
      return SharedMessageType.BACKTICK_UPDATE;
    }

    // P2_SYSTEM_INIT: "Cog0 INIT $0000_0000 $0000_0000 load"
    // Must check BEFORE generic COG message check
    if (isP2SystemInit(data)) {
      return SharedMessageType.P2_SYSTEM_INIT;
    }

    // COG message: "Cog[0-7]  " (note: TWO spaces required!)
    if (data.length >= 6 &&
        data[0] === 0x43 && // 'C'
        data[1] === 0x6F && // 'o'
        data[2] === 0x67) { // 'g'

      const cogChar = data[3];
      if (cogChar >= 0x30 && cogChar <= 0x37) { // '0'-'7'
        // VALIDATION: Check for two spaces after COG ID
        if (data[4] === 0x20 && data[5] === 0x20) { // Two spaces
          const cogId = cogChar - 0x30;
          const messageType = (SharedMessageType.COG0_MESSAGE + cogId) as SharedMessageType;
          this.stickyContext = messageType; // Update sticky context
          return messageType;
        }
      }
    }

    // Terminal output fallback
    this.stickyContext = SharedMessageType.TERMINAL_OUTPUT; // Update sticky context
    return SharedMessageType.TERMINAL_OUTPUT;
  }

  /**
   * [#30] Write an extracted message into a pool slot and hand its poolId out.
   * Factored out so the same write happens for a freshly-extracted message and
   * for a previously-stashed one (placed once a slot frees during backpressure).
   */
  private writeMessageToSlot(slot: PoolSlot, data: Uint8Array, type: SharedMessageType): void {
    if (this.enableConsoleLog && data.length > 1000) {
      console.log(
        `[ExtractionCore] DIAGNOSTIC: Writing large message poolId=${slot.poolId}, type=${type}, length=${data.length} bytes`
      );
    }
    slot.writeType(type);
    slot.writeLength(data.length);
    slot.writeData(data);
    slot.setRefCount(1); // Main thread will release
    this.emit(slot.poolId);
    this.extractionCount++;
    this.extractedSinceStats++;
  }

  /**
   * Extract messages from buffer using boundary detection.
   * Writes to SharedMessagePool and emits poolId for each message.
   */
  private extractMessages(): void {
    if (this.isExtracting) {
      return;
    }

    this.isExtracting = true;
    const maxBatch = 100; // Extract up to 100 messages per call
    let extracted = 0;

    // [#30] Pool backpressure: if a message is stashed (pool was full last time), it MUST be
    // placed before extracting anything new — order is preserved by draining the stash first.
    // If the pool is still full, stop now and retry next tick; the ring stays un-drained.
    if (this.stashedMessage) {
      const slot = this.messagePool.acquire(this.stashedMessage.data.length);
      if (!slot) {
        this.isExtracting = false;
        return;
      }
      this.writeMessageToSlot(slot, this.stashedMessage.data, this.stashedMessage.type);
      this.stashedMessage = null;
    }

    try {
      while (extracted < maxBatch && this.buffer.hasData()) {
        let messageData: Uint8Array | null = null;

        // ── Debugger Phase-3 EXACT framing (multi-cog) ─────────────────────────
        // We hold debugPhase3Cog = N until we have delivered EXACTLY cog N's break
        // (Fixed body + smart-pin tail) and returned to awaitingPhase1 — so a second
        // cog's bytes can never bleed into cog N's stream. Bytes are still tagged
        // DEBUGGER{N}_PHASE3 and chunked to a pool slot; we simply STOP at the exact
        // boundary instead of streaming verbatim until an async signal.
        if (this.debugPhase3Cog !== null) {
          const cog = this.debugPhase3Cog;

          // AwaitSize: the FIXED body length is the relayed popcount of this break's
          // request bitmap (signalDebuggerPhase3Size). WAIT — never scan — until it
          // arrives (fast IPC, causally before the Phase-3 bytes' serial round-trip).
          if (this.p3Stage === Phase3Stage.AwaitSize) {
            const fixed = this.pendingFixed[cog];
            if (fixed === undefined) break; // size not here yet — leave bytes in ring
            this.pendingFixed[cog] = undefined; // consume once per break
            this.p3FixedRemaining = fixed;
            this.p3Stage = Phase3Stage.Fixed;
            continue;
          }

          // Fixed body → drain it, then hand off to the self-describing smart-pin tail.
          if (this.p3Stage === Phase3Stage.Fixed) {
            if (this.p3FixedRemaining === 0) {
              this.p3Stage = Phase3Stage.SmartPin;
              this.p3SmartGroup = 0;
              this.p3GroupLongs = -1; // first thing to read is group 0's mask byte
              continue;
            }
            const avail = this.buffer.getUsedSpace();
            if (avail === 0) break; // wait for more of this cog's Phase-3
            const len = Math.min(avail, this.p3FixedRemaining, ExtractionCore.PHASE3_DRAIN_CAP);
            const ok = this.emitPhase3Chunk(cog, len);
            this.p3FixedRemaining -= len; // bytes left the ring (emitted OR stashed)
            if (!ok) break; // backpressure — bytes stashed; resume next tick
            extracted++;
            continue;
          }

          // SmartPin: walk the 8 groups. Each group is 1 mask byte followed by one
          // long (4 bytes) per set bit — read exactly as the renderer's parser does
          // (DebuggerPhase3.SmartPinMask/SmartPinLongs). The interleaving is why the
          // tail cannot be summed up-front from a block of masks.
          if (this.p3SmartGroup >= ExtractionCore.SMART_PIN_GROUPS) {
            // All groups consumed → this break is EXACTLY delimited. Resync to
            // awaitingPhase1 for the next Phase-1 of ANY cog — no over-read possible.
            this.resetDebugPhase3();
            continue;
          }
          if (this.p3GroupLongs < 0) {
            // Read this group's mask byte, derive its long-bytes, emit the mask byte.
            if (this.buffer.getUsedSpace() < 1) break; // WAIT for the mask byte
            const m = this.buffer.peekAtOffset(0, 1);
            if (!m) break;
            const longs = 4 * ExtractionCore.popcount8(m[0]);
            this.p3GroupLongs = longs; // set BEFORE emit so a backpressure stash resumes correctly
            const ok = this.emitPhase3Chunk(cog, 1);
            if (longs === 0) { this.p3SmartGroup++; this.p3GroupLongs = -1; } // empty group → next
            if (!ok) break;
            extracted++;
            continue;
          }
          if (this.p3GroupLongs === 0) {
            this.p3SmartGroup++; // this group's longs are done → advance
            this.p3GroupLongs = -1;
            continue;
          }
          // Drain this group's long bytes.
          const availL = this.buffer.getUsedSpace();
          if (availL === 0) break; // wait for more of this cog's Phase-3
          const lenL = Math.min(availL, this.p3GroupLongs, ExtractionCore.PHASE3_DRAIN_CAP);
          const okL = this.emitPhase3Chunk(cog, lenL);
          this.p3GroupLongs -= lenL; // bytes left the ring (emitted OR stashed)
          if (!okL) break; // backpressure — bytes stashed; resume next tick
          extracted++;
          continue;
        }

        // Arm the debug session on the ROM's "CogN  INIT " banner, which precedes
        // the first Phase-1. This lets step-1b (below) frame that first Phase-1 even
        // when the banner and the Phase-1 arrive contiguously in one burst (PASM
        // first-instruction breaks) — the multi-cog first-contact fix. inDebugSession
        // is also (re)armed on the first Phase-1 emission below; this arms it one
        // step earlier, from the banner, so the first Phase-1 is never mis-framed.
        if (!this.inDebugSession && this.headLooksLikeCogInitLine()) {
          this.inDebugSession = true;
        }

        // Check if idle timeout has expired (for CR/LF at buffer end detection)
        const timeSinceLastActivity = this.now() - this.lastBufferActivity;
        const idleTimeoutExpired = timeSinceLastActivity >= ExtractionCore.IDLE_TIMEOUT_MS;

        // Try boundary detection in order of likelihood
        // 1. DB_PACKET (0xDB prefix)
        messageData = this.findDBPacketBoundary();

        // 1b. In a debug session, a debugger Phase-1 header at the ring head must
        // be framed as a full 456-byte packet — or WAITED for. Never let
        // findTextBoundary chop the binary Phase-1 at an embedded CR/LF (which it
        // would once the idle timeout expires — e.g. the trailing break at the end
        // of a capture arrives across chunks). Mirrors the controller's "wait for
        // PHASE1_SIZE" framing. The strict [cog,0,0,0] header is unambiguous inside
        // a debug session (terminal text is ASCII; ROM CogN INIT lines start 'C');
        // an all-zero 456 block frames here but the renderer's looksLikePhase1
        // discards it as a trailing remnant. Scoped to debug sessions → the 2 Mbaud
        // streaming classifier is untouched.
        if (!messageData && this.inDebugSession && this.headLooksLikePhase1Header()) {
          messageData = this.find416ByteBoundary();
          if (!messageData) break; // partial Phase-1 — wait for the rest, don't chop as text
          if (ExtractionCore.isAllZero(messageData)) {
            // A real Phase-1 ALWAYS carries non-zero CRC/checksum words (bytes
            // 80..455). An all-zero 456-block is a trailing remnant, or a hub-dump
            // zero run that mis-passed the 4-byte [cog,0,0,0] header test. DISCARD it
            // (bytes already consumed) rather than emit a spurious DEBUGGER Phase-1 —
            // the $14201 class. Mirrors the renderer's looksLikePhase1 guard, now
            // ALSO enforced worker-side because exact Phase-3 framing resyncs the
            // worker to awaitingPhase1 itself (so a mis-sized break can never turn a
            // zero run into a fabricated Phase-1). Normal breaks never hit this — the
            // exact boundary lands on a real, non-zero Phase-1.
            messageData = null;
            continue;
          }
        }

        // 2. Text message (CR/LF) - pass idle timeout flag
        if (!messageData) {
          messageData = this.findTextBoundary(idleTimeoutExpired);
        }

        // 3. 416-byte debugger packet
        if (!messageData) {
          messageData = this.find416ByteBoundary();
        }

        if (!messageData) {
          // No complete message available
          break;
        }

        // Classify message
        const messageType = this.classifyMessage(messageData);
        if (!messageType) {
          this.logConsoleMessage('Failed to classify message, skipping');
          continue;
        }

        // [#30] Pool backpressure (NO DROP): acquire a slot; if the pool is momentarily full,
        // stash this ONE message and STOP extracting. The un-extracted remainder stays in the ring
        // (upstream backpressure) and we retry placing the stash next tick once main frees a slot.
        const slot = this.messagePool.acquire(messageData.length);
        if (!slot) {
          this.stashedMessage = { data: messageData, type: messageType };
          this.poolBackpressureEvents++;
          break; // leave remaining ring data un-extracted; resume when a slot frees
        }

        // Write message to pool + emit poolId (increments extraction counters)
        this.writeMessageToSlot(slot, messageData, messageType);

        // A Phase-1 for cog N opens N's break: enter exact Phase-3 framing for N,
        // starting in AwaitSize (we need N's relayed FIXED size before delimiting).
        // The Phase3Stage machine (branch above) drains N's exact Phase-3 then
        // resyncs to awaitingPhase1 — so a second cog's bytes can never bleed in.
        if (
          messageType >= SharedMessageType.DEBUGGER0_416BYTE &&
          messageType <= SharedMessageType.DEBUGGER7_416BYTE
        ) {
          this.debugPhase3Cog = messageType - SharedMessageType.DEBUGGER0_416BYTE;
          this.inDebugSession = true;
          this.p3Stage = Phase3Stage.AwaitSize;
          this.p3FixedRemaining = 0;
          this.p3SmartGroup = 0;
          this.p3GroupLongs = -1;
        }

        extracted++;
      }

      if (extracted > 0) {
        this.logConsoleMessage(`Extracted ${extracted} messages (total: ${this.extractionCount})`);
      }
    } finally {
      this.isExtracting = false;
    }
  }
}
