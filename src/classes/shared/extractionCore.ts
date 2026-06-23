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
  // Single-step debugger Phase 3 raw-passthrough
  //
  // The P2 debug protocol per cog is phase1(416B, framed) → phase2(host→P2) →
  // phase3(VARIABLE, RAW — no cog-id prefix, no length). The P2 holds hardware
  // lock[15] for the whole exchange (Spin2_debugger.spin2 :201/:235), so exactly
  // ONE cog's transaction is on the wire at a time. We mirror Pascal's run-to-
  // completion read: once a phase1 DEBUGGER{N} packet is emitted, a transaction is
  // "open" for cog N — every subsequent byte is that cog's raw phase3 and must be
  // delivered WITHOUT framing (find416 would mis-frame / stall on non-zero data).
  // We tag the raw chunks with the same DEBUGGER{N} type so routeMessage() routes
  // them by TYPE to cog N's window (the missing cog-id prefix is irrelevant).
  // The transaction closes when the host signals 'debuggerPhase3Done' (the
  // renderer's structural parser reports completion).
  private debuggerTransactionCog: number | null = null;
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
   * The renderer's structural parser reported Phase 3 complete: close the
   * transaction so the next phase1 (any cog) is framed normally by find416.
   */
  public onPhase3Done(): void {
    this.debuggerTransactionCog = null;
  }

  /**
   * Main cleared the ring (DTR-reset / resync) — drop any stashed pre-reset
   * message so it isn't emitted after the boundary, and abandon any in-flight
   * debug exchange. (The ring itself is reset on the caller's side.)
   */
  public onClear(): void {
    this.stashedMessage = null;
    this.debuggerTransactionCog = null;
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
      const isValidBoundary = isBacktickMessage ? looksLikeMessageStart : looksLikeTextLineStart;

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

        // ── Debugger Phase 3 raw-passthrough ───────────────────────────────
        // A debug transaction is open: drain available bytes RAW (bypass all
        // framing) and tag them with the open cog's DEBUGGER type so they route
        // to that window as Phase 3. Capped so one chunk fits one pool slot.
        if (this.debuggerTransactionCog !== null) {
          const avail = this.buffer.getUsedSpace();
          if (avail === 0) break; // nothing yet; resume next tick when data arrives
          const drainLen = Math.min(avail, ExtractionCore.PHASE3_DRAIN_CAP);
          const raw = new Uint8Array(drainLen);
          let got = 0;
          for (let k = 0; k < drainLen; k++) {
            const r = this.buffer.next();
            if (r.status === NextStatus.EMPTY) break;
            raw[got++] = r.value!;
          }
          if (got === 0) break;
          const rawData = got === drainLen ? raw : raw.subarray(0, got);
          // DISTINCT phase3 type (not the 416-byte phase1 type): carries the cog-id
          // via the type for routing, but does NOT trigger the byte-derived
          // window-creation event (which would spawn bogus windows from raw bytes).
          const rawType = (SharedMessageType.DEBUGGER0_PHASE3 + this.debuggerTransactionCog) as SharedMessageType;
          const rawSlot = this.messagePool.acquire(rawData.length);
          if (!rawSlot) {
            this.stashedMessage = { data: new Uint8Array(rawData), type: rawType };
            this.poolBackpressureEvents++;
            break;
          }
          this.writeMessageToSlot(rawSlot, rawData, rawType);
          extracted++;
          continue;
        }

        // Check if idle timeout has expired (for CR/LF at buffer end detection)
        const timeSinceLastActivity = this.now() - this.lastBufferActivity;
        const idleTimeoutExpired = timeSinceLastActivity >= ExtractionCore.IDLE_TIMEOUT_MS;

        // Try boundary detection in order of likelihood
        // 1. DB_PACKET (0xDB prefix)
        messageData = this.findDBPacketBoundary();

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

        // Open a debugger transaction when a Phase 1 packet is emitted: the cog-id
        // is the message type's offset, and from here the P2 streams raw Phase 3
        // for this cog until the host signals completion. (Only reachable while no
        // transaction is open — the raw-drain branch above handles the open case.)
        if (
          messageType >= SharedMessageType.DEBUGGER0_416BYTE &&
          messageType <= SharedMessageType.DEBUGGER7_416BYTE
        ) {
          this.debuggerTransactionCog = messageType - SharedMessageType.DEBUGGER0_416BYTE;
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
