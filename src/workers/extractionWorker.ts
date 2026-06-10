/** @format */

// src/workers/extractionWorker.ts

import { parentPort } from 'worker_threads';
import { SharedCircularBuffer, NextStatus } from '../classes/shared/sharedCircularBuffer';
import { SharedMessagePool, SharedMessageType, PoolSlot } from '../classes/shared/sharedMessagePool';

/**
 * Extraction Worker - Runs message extraction in parallel with SharedMessagePool
 *
 * This worker:
 * 1. Receives SharedCircularBuffer and SharedMessagePool from main thread
 * 2. Reads from SharedCircularBuffer at its own pace
 * 3. Performs boundary detection and trivial classification
 * 4. Writes messages to SharedMessagePool (zero-copy)
 * 5. Sends poolId to main thread for routing
 *
 * Design Philosophy:
 * - Worker does simple boundary detection (CR/LF, 0xDB length, 416-byte)
 * - Worker does trivial classification (first bytes → MessageType enum)
 * - Main thread does routing and release
 * - Zero-copy: Worker writes to SharedMessagePool, main reads same memory
 */

// More defensive check - in some environments parentPort might exist but be undefined
if (typeof parentPort === 'undefined' || !parentPort) {
  console.error('[ExtractionWorker] ERROR: parentPort is not available - not running as Worker Thread');
  throw new Error('ExtractionWorker must be run as Worker Thread');
}

const ENABLE_CONSOLE_LOG: boolean = false;

function logConsoleMessage(...args: any[]): void {
  if (ENABLE_CONSOLE_LOG) {
    console.log('[ExtractionWorker]', ...args);
  }
}

// Worker state
let buffer: SharedCircularBuffer | null = null;
let messagePool: SharedMessagePool | null = null;
let isExtracting: boolean = false;
let extractionCount: number = 0;

// [#30] Pool backpressure (no drop). When the SharedMessagePool is momentarily full we stash
// the ONE already-extracted message and STOP extracting, leaving un-extracted data in the ring
// (upstream backpressure) instead of dropping. The autonomous loop retries placing the stash
// until main routes+releases a slot. No data lost; no thread blocks (main keeps draining its
// port queue → releases slots → we resume). Cleared on buffer clear/DTR-reset.
let stashedMessage: { data: Uint8Array; type: SharedMessageType } | null = null;
let poolBackpressureEvents: number = 0;

// [#30] Periodic RX stats (gated by main via the 'init' msg from PNUT_RX_STATS=1). When on, the
// worker logs extraction count, backpressure activations, and a true pool-occupancy SAB scan
// once per second so an HW run can confirm backpressure engaged with zero loss.
let rxStatsEnabled: boolean = false;
let lastRxStatsTime: number = 0;
let extractedSinceStats: number = 0;

// Idle timeout detection for CR/LF at buffer end
// When CR/LF appears at buffer end, wait for this timeout before extracting
// to distinguish "waiting for next USB packet" from "transmission complete"
const IDLE_TIMEOUT_MS = 50; // 50ms idle time means transmission is complete
let lastBufferActivity: number = 0; // Timestamp of last new data written to buffer
let lastKnownTailPosition: number = -1; // Track buffer write position to detect new data

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
 * Boundary Detection: Text message (CR/LF terminated)
 * Returns message bytes if complete, null if incomplete
 * @param idleTimeoutExpired - If true, treat CR/LF at buffer end as valid EOL (transmission complete)
 *
 * Supports 4 EOL patterns:
 * - CR only (0x0D)
 * - CRLF (0x0D 0x0A)
 * - LF only (0x0A)
 * - LFCR (0x0A 0x0D)
 *
 * CRITICAL FIX for SPRITEDEF bug:
 * 1. Increased MAX_TEXT_LENGTH from 512 to 65536 bytes (SPRITEDEF ~2000 bytes)
 * 2. EOL validation: CR/LF only treated as message boundary if followed by valid message start
 *    This prevents false EOL detection when CR/LF bytes appear within message data
 *
 * IDLE TIMEOUT FIX for CR/LF split across USB packets:
 * When CR/LF appears at buffer end, wait for idle timeout before treating as EOL
 * This distinguishes "waiting for next USB packet" from "transmission complete"
 */
function findTextBoundary(idleTimeoutExpired: boolean): Uint8Array | null {
  if (!buffer || !buffer.hasData()) {
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
        // If idle timeout expired, treat as valid EOL (transmission complete)
        // Otherwise wait for more data (LF might be in next USB packet)
        if (idleTimeoutExpired) {
          return new Uint8Array(messageBytes);
        } else {
          buffer.restorePosition();
          return null; // Wait for more data
        }
      }

      if (lfResult.value === 0x0A) {
        // CRLF pattern (0x0D 0x0A) - check if followed by valid message/line start
        // Save position before peeking at next byte
        const positionBeforePeek = buffer.savePosition();
        const nextByteResult = buffer.next();
        const nextByte = nextByteResult.status === NextStatus.EMPTY ? undefined : nextByteResult.value;

        if (isValidBoundary(nextByte)) {
          // Valid EOL - restore position to put back the peeked byte, then return message
          buffer.restorePosition();
          messageBytes.push(0x0A);
          return new Uint8Array(messageBytes);
        } else {
          // Not a valid EOL - embedded CR/LF in data, continue accumulating
          // Position already advanced past nextByte by buffer.next() call
          messageBytes.push(0x0A);
          if (nextByte !== undefined) {
            messageBytes.push(nextByte);
          }
          // Continue to next iteration
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
          // Continue to next iteration
        }
      }
    }
    // Check for LF (0x0A)
    else if (result.value === 0x0A) {
      const crResult = buffer.next();
      if (crResult.status === NextStatus.EMPTY) {
        // LF at end of buffer
        // If idle timeout expired, treat as valid EOL (transmission complete)
        // Otherwise wait for more data (CR or backtick might be in next USB packet)
        if (idleTimeoutExpired) {
          return new Uint8Array(messageBytes);
        } else {
          buffer.restorePosition();
          return null; // Wait for more data
        }
      }

      if (crResult.value === 0x0D) {
        // LFCR pattern (0x0A 0x0D) - check if followed by valid message/line start
        // Save position before peeking at next byte
        const positionBeforePeek = buffer.savePosition();
        const nextByteResult = buffer.next();
        const nextByte = nextByteResult.status === NextStatus.EMPTY ? undefined : nextByteResult.value;

        if (isValidBoundary(nextByte)) {
          // Valid EOL - restore position to put back the peeked byte, then return message
          buffer.restorePosition();
          messageBytes.push(0x0D);
          return new Uint8Array(messageBytes);
        } else {
          // Not a valid EOL - embedded LF/CR in data, continue accumulating
          // Position already advanced past nextByte by buffer.next() call
          messageBytes.push(0x0D);
          if (nextByte !== undefined) {
            messageBytes.push(nextByte);
          }
          // Continue to next iteration
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
          // Continue to next iteration
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
function findDBPacketBoundary(): Uint8Array | null {
  if (!buffer || !buffer.hasData()) {
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
  // Save current position (after reading header)
  const headerEndPos = buffer.savePosition();

  // Count available payload bytes
  let availableBytes = 0;
  for (let i = 0; i < length; i++) {
    const result = buffer.next();
    if (result.status === NextStatus.EMPTY) {
      // Not enough data - restore and return incomplete
      buffer.restorePosition();
      return null;
    }
    availableBytes++;
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
 * Boundary Detection: 416-byte debugger packet
 * Returns message bytes if complete, null if incomplete
 *
 * CRITICAL: Must validate first byte is 0x00-0x07 (COG ID)
 * Without this check, ANY 416 bytes would be extracted as a debugger packet,
 * incorrectly splitting large text messages like SPRITEDEF commands!
 *
 * ENHANCED VALIDATION: Bytes 1-3 must be 0x00 (COG number is little-endian LONG)
 * This distinguishes debugger packets from terminal messages with PST control codes:
 * - Debugger packet: 0x01 0x00 0x00 0x00 ... (COG 1)
 * - Terminal with PST: 0x10 0x50 0x32 0x20 ... (Clear Screen + "P2 ")
 */
function find416ByteBoundary(): Uint8Array | null {
  if (!buffer || !buffer.hasData()) {
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
  // This prevents confusion with PST control codes (0x01-0x10) in terminal messages
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

  // Valid COG ID with proper LONG format - extract remaining 412 bytes
  const messageBytes: number[] = [firstByte, 0x00, 0x00, 0x00];
  const DEBUGGER_SIZE = 416;

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

// Sticky context for whitespace-only messages (blank lines)
// Tracks last COG or TERMINAL message type to properly classify blank lines
let stickyContext: SharedMessageType = SharedMessageType.TERMINAL_OUTPUT;

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

/**
 * Classification: Classify message based on content
 * Returns SharedMessageType or null if unrecognized
 */
function classifyMessage(data: Uint8Array): SharedMessageType | null {
  if (data.length === 0) {
    return null;
  }

  // Rule 0: Whitespace-only messages (blank lines)
  // Context-aware classification - inherit type from previous COG/TERMINAL message
  if (isWhitespaceOnly(data)) {
    return stickyContext; // Return last COG/TERMINAL context
  }

  const firstByte = data[0];

  // DB_PACKET: 0xDB
  if (firstByte === 0xDB) {
    return SharedMessageType.DB_PACKET;
  }

  // 416-byte debugger packet: 0x00-0x07 (COG ID) with 32-bit LE validation
  // Real debugger packets use a 32-bit little-endian COG ID, so bytes 1-3 must be 0x00.
  // Without this check, NUL bytes (0x00) and PST control codes (0x01-0x07) in terminal
  // text get misclassified as debugger packets. This matches find416ByteBoundary() validation.
  if (firstByte >= 0x00 && firstByte <= 0x07 &&
      data.length >= 4 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x00) {
    // DEBUGGER0-7_416BYTE
    return (SharedMessageType.DEBUGGER0_416BYTE + firstByte) as SharedMessageType;
  }

  // Window commands: `<command> ...
  // ANY backtick message is a window message (creation OR update)
  // Main thread routing will distinguish between creation and update commands
  if (firstByte === 0x60) { // Backtick
    const command = extractWindowCommand(data);
    if (command) {
      // Check for specific window type keywords for precise classification
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
          // Unknown window command - this is a window update with user-defined name (e.g., `j k l $FFB7)
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
        stickyContext = messageType; // Update sticky context
        return messageType;
      }
    }
  }

  // Terminal output fallback
  stickyContext = SharedMessageType.TERMINAL_OUTPUT; // Update sticky context
  return SharedMessageType.TERMINAL_OUTPUT;
}

/**
 * [#30] Write an extracted message into a pool slot and hand its poolId to main.
 * Factored out so the same write happens for a freshly-extracted message and for a
 * previously-stashed one (placed once a slot frees during pool backpressure).
 */
function writeMessageToSlot(slot: PoolSlot, data: Uint8Array, type: SharedMessageType): void {
  if (ENABLE_CONSOLE_LOG && data.length > 1000) {
    console.log(
      `[ExtractionWorker] DIAGNOSTIC: Writing large message poolId=${slot.poolId}, type=${type}, length=${data.length} bytes`
    );
  }
  slot.writeType(type);
  slot.writeLength(data.length);
  slot.writeData(data);
  slot.setRefCount(1); // Main thread will release
  parentPort!.postMessage({ type: 'message', poolId: slot.poolId });
  extractionCount++;
  extractedSinceStats++;
}

/**
 * [#30] Emit periodic RX stats (≤ once/second) so an HW run can confirm backpressure engaged
 * with zero loss. poolUsed is a true SHARED-metadata scan (local free counters are unreliable
 * across threads). Gated by rxStatsEnabled (PNUT_RX_STATS=1 on main).
 */
function maybeLogRxStats(): void {
  if (!rxStatsEnabled || !messagePool) return;
  const now = Date.now();
  if (now - lastRxStatsTime < 1000) return;
  const poolUsed = messagePool.countUsedSlots();
  console.error(
    `[RX-STATS] extracted/s=${extractedSinceStats} total=${extractionCount} ` +
      `poolBackpressureEvents=${poolBackpressureEvents} poolUsed=${poolUsed} ` +
      `stashed=${stashedMessage ? 1 : 0}`
  );
  lastRxStatsTime = now;
  extractedSinceStats = 0;
}

/**
 * Extract messages from buffer using boundary detection
 * Writes to SharedMessagePool and sends poolId to main thread
 */
function extractMessages(): void {
  if (!buffer || !messagePool || isExtracting) {
    return;
  }

  isExtracting = true;
  const maxBatch = 100; // Extract up to 100 messages per call
  let extracted = 0;

  // [#30] Pool backpressure: if a message is stashed (pool was full last time), it MUST be
  // placed before extracting anything new — order is preserved by draining the stash first.
  // If the pool is still full, stop now and retry next tick; the ring stays un-drained.
  if (stashedMessage) {
    const slot = messagePool.acquire(stashedMessage.data.length);
    if (!slot) {
      isExtracting = false;
      maybeLogRxStats();
      return;
    }
    writeMessageToSlot(slot, stashedMessage.data, stashedMessage.type);
    stashedMessage = null;
  }

  try {
    while (extracted < maxBatch && buffer.hasData()) {
      let messageData: Uint8Array | null = null;

      // Check if idle timeout has expired (for CR/LF at buffer end detection)
      const now = Date.now();
      const timeSinceLastActivity = now - lastBufferActivity;
      const idleTimeoutExpired = timeSinceLastActivity >= IDLE_TIMEOUT_MS;

      // Try boundary detection in order of likelihood
      // 1. DB_PACKET (0xDB prefix)
      messageData = findDBPacketBoundary();

      // 2. Text message (CR/LF) - pass idle timeout flag
      if (!messageData) {
        messageData = findTextBoundary(idleTimeoutExpired);
      }

      // 3. 416-byte debugger packet
      if (!messageData) {
        messageData = find416ByteBoundary();
      }

      if (!messageData) {
        // No complete message available
        break;
      }

      // Classify message
      const messageType = classifyMessage(messageData);
      if (!messageType) {
        logConsoleMessage('Failed to classify message, skipping');
        continue;
      }

      // [#30] Pool backpressure (NO DROP): acquire a slot; if the pool is momentarily full,
      // stash this ONE message and STOP extracting. The un-extracted remainder stays in the ring
      // (upstream backpressure) and we retry placing the stash next tick once main frees a slot.
      const slot = messagePool.acquire(messageData.length);
      if (!slot) {
        stashedMessage = { data: messageData, type: messageType };
        poolBackpressureEvents++;
        break; // leave remaining ring data un-extracted; resume when a slot frees
      }

      // Write message to pool + hand poolId to main (increments extraction counters)
      writeMessageToSlot(slot, messageData, messageType);

      extracted++;
    }

    if (extracted > 0) {
      logConsoleMessage(`Extracted ${extracted} messages (total: ${extractionCount})`);
    }

    // Autonomous loop will continue monitoring - no coordination messages needed
  } catch (error) {
    parentPort!.postMessage({
      type: 'error',
      error: String(error)
    });
  } finally {
    isExtracting = false;
  }
}

/**
 * Autonomous extraction loop
 * Continuously monitors buffer and extracts messages
 * Self-managing with isExtracting flag to prevent re-entry
 */
function autonomousLoop(): void {
  // Track buffer activity by watching the write (tail) position.
  // When the main thread writes new USB data, the tail advances.
  // This correctly detects new data even when old data sits in the buffer
  // (e.g., unterminated prompt text with no CR/LF).
  if (buffer) {
    const currentTail = buffer.getTailPosition();
    if (currentTail !== lastKnownTailPosition) {
      lastBufferActivity = Date.now();
      lastKnownTailPosition = currentTail;
    }
  }

  const hasData = buffer && buffer.hasData();

  // Check if buffer has data (or a stashed message is waiting for a free slot) and we're not
  // already extracting. [#30] The stash must keep being retried even if the ring is momentarily
  // empty, so it is placed as soon as main frees a slot.
  if (buffer && (hasData || stashedMessage) && !isExtracting) {
    extractMessages();
  }

  // [#30] Periodic RX stats (self-throttled to ≤1/sec; no-op unless PNUT_RX_STATS=1).
  maybeLogRxStats();

  // Yield to event loop and continue monitoring
  setImmediate(autonomousLoop);
}

/**
 * Handle messages from main thread
 */
parentPort.on('message', (msg: any) => {
  switch (msg.type) {
    case 'init':
      // Receive SharedCircularBuffer and SharedMessagePool from main thread
      try {
        buffer = SharedCircularBuffer.fromTransferables({
          dataBuffer: msg.dataBuffer,
          stateBuffer: msg.stateBuffer,
          size: msg.size
        });

        messagePool = SharedMessagePool.fromTransferables({
          metadataBuffer: msg.metadataBuffer,
          dataBuffer: msg.poolDataBuffer,
          maxSlots: msg.maxSlots,
          maxMessageSize: msg.maxMessageSize
        });

        // [#30] Gate periodic RX backpressure stats (main passes this from PNUT_RX_STATS=1).
        rxStatsEnabled = msg.rxStats === true;

        logConsoleMessage('Initialized with SharedCircularBuffer and SharedMessagePool');

        // Start autonomous extraction loop
        logConsoleMessage('Starting autonomous extraction loop');
        autonomousLoop();

        parentPort!.postMessage({
          type: 'ready'
        });
      } catch (error) {
        parentPort!.postMessage({
          type: 'error',
          error: `Init failed: ${error}`
        });
      }
      break;

    case 'clear':
      // [#30] Main cleared the ring (DTR-reset / resync) — drop any stashed pre-reset message so
      // it isn't emitted after the boundary. The ring itself was already reset on the main side.
      stashedMessage = null;
      logConsoleMessage('Cleared stashed message on buffer clear');
      break;

    case 'shutdown':
      logConsoleMessage('Shutting down');
      process.exit(0);
      break;

    default:
      logConsoleMessage(`Unknown message type: ${msg.type}`);
  }
});

// Signal that worker is loaded
try {
  parentPort.postMessage({
    type: 'loaded'
  });

  logConsoleMessage('Worker loaded and ready');
} catch (error) {
  console.error('[ExtractionWorker] Failed to send loaded message:', error);
}
