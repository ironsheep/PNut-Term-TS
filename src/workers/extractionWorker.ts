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

if (!parentPort) {
  throw new Error('ExtractionWorker must be run as Worker Thread');
}

const ENABLE_CONSOLE_LOG: boolean = true;

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

/**
 * Boundary Detection: Text message (CR/LF terminated)
 * Returns message bytes if complete, null if incomplete
 *
 * Supports 4 EOL patterns:
 * - CR only (0x0D)
 * - CRLF (0x0D 0x0A)
 * - LF only (0x0A)
 * - LFCR (0x0A 0x0D)
 */
function findTextBoundary(): Uint8Array | null {
  if (!buffer || !buffer.hasData()) {
    return null;
  }

  buffer.savePosition();
  const messageBytes: number[] = [];
  const MAX_TEXT_LENGTH = 512; // 512-byte limit per original validation

  while (messageBytes.length < MAX_TEXT_LENGTH) {
    const result = buffer.next();

    if (result.status === NextStatus.EMPTY) {
      buffer.restorePosition();
      return null;
    }

    messageBytes.push(result.value!);

    // Check for CR (0x0D)
    if (result.value === 0x0D) {
      const lfResult = buffer.next();
      if (lfResult.status === NextStatus.EMPTY) {
        // CR at end of buffer - incomplete
        buffer.restorePosition();
        return null;
      }

      if (lfResult.value === 0x0A) {
        // CRLF pattern (0x0D 0x0A)
        messageBytes.push(0x0A);
        return new Uint8Array(messageBytes);
      } else {
        // CR only (0x0D) - put back the non-LF byte
        buffer.restorePosition();
        // Re-advance to include the CR we found
        for (let i = 0; i < messageBytes.length; i++) {
          buffer.next();
        }
        return new Uint8Array(messageBytes);
      }
    }

    // Check for LF (0x0A)
    if (result.value === 0x0A) {
      const crResult = buffer.next();
      if (crResult.status === NextStatus.EMPTY) {
        // LF at end of buffer - LF only pattern
        return new Uint8Array(messageBytes);
      }

      if (crResult.value === 0x0D) {
        // LFCR pattern (0x0A 0x0D)
        messageBytes.push(0x0D);
        return new Uint8Array(messageBytes);
      } else {
        // LF only (0x0A) - put back the non-CR byte
        buffer.restorePosition();
        // Re-advance to include the LF we found
        for (let i = 0; i < messageBytes.length; i++) {
          buffer.next();
        }
        return new Uint8Array(messageBytes);
      }
    }
  }

  // Too long (>512 bytes) - not a text message
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
 */
function find416ByteBoundary(): Uint8Array | null {
  if (!buffer || !buffer.hasData()) {
    return null;
  }

  buffer.savePosition();
  const messageBytes: number[] = [];
  const DEBUGGER_SIZE = 416;

  for (let i = 0; i < DEBUGGER_SIZE; i++) {
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

/**
 * Classification: Classify message based on content
 * Returns SharedMessageType or null if unrecognized
 */
function classifyMessage(data: Uint8Array): SharedMessageType | null {
  if (data.length === 0) {
    return null;
  }

  const firstByte = data[0];

  // DB_PACKET: 0xDB
  if (firstByte === 0xDB) {
    return SharedMessageType.DB_PACKET;
  }

  // 416-byte debugger packet: 0x00-0x07 (COG ID)
  if (firstByte >= 0x00 && firstByte <= 0x07) {
    // DEBUGGER0-7_416BYTE
    return (SharedMessageType.DEBUGGER0_416BYTE + firstByte) as SharedMessageType;
  }

  // Window commands: `<command> ...
  if (firstByte === 0x60) { // Backtick
    const command = extractWindowCommand(data);
    if (command) {
      switch (command) {
        case 'logic': return SharedMessageType.WINDOW_LOGIC;
        case 'scope': return SharedMessageType.WINDOW_SCOPE;
        case 'scope_xy': return SharedMessageType.WINDOW_SCOPE_XY;
        case 'fft': return SharedMessageType.WINDOW_FFT;
        case 'spectro': return SharedMessageType.WINDOW_SPECTRO;
        case 'plot': return SharedMessageType.WINDOW_PLOT;
        case 'term': return SharedMessageType.WINDOW_TERM;
        case 'bitmap': return SharedMessageType.WINDOW_BITMAP;
        case 'midi': return SharedMessageType.WINDOW_MIDI;
        default:
          // Unknown window command - treat as terminal output
          return SharedMessageType.TERMINAL_OUTPUT;
      }
    }
    return SharedMessageType.TERMINAL_OUTPUT;
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
        return (SharedMessageType.COG0_MESSAGE + cogId) as SharedMessageType;
      }
    }
  }

  // Terminal output fallback
  return SharedMessageType.TERMINAL_OUTPUT;
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

  try {
    while (extracted < maxBatch && buffer.hasData()) {
      let messageData: Uint8Array | null = null;

      // Try boundary detection in order of likelihood
      // 1. DB_PACKET (0xDB prefix)
      messageData = findDBPacketBoundary();

      // 2. Text message (CR/LF)
      if (!messageData) {
        messageData = findTextBoundary();
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

      // Acquire slot from SharedMessagePool
      const slot = messagePool.acquire();
      if (!slot) {
        console.error('[ExtractionWorker] SharedMessagePool exhausted!');
        break;
      }

      // Write message to pool
      slot.writeType(messageType);
      slot.writeLength(messageData.length);
      slot.writeData(messageData);
      slot.setRefCount(1); // Main thread will release

      // Send poolId to main thread
      parentPort!.postMessage({
        type: 'message',
        poolId: slot.poolId
      });

      extracted++;
      extractionCount++;
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
  // Check if buffer has data and we're not already extracting
  if (buffer && buffer.hasData() && !isExtracting) {
    extractMessages();
  }

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

    case 'shutdown':
      logConsoleMessage('Shutting down');
      process.exit(0);
      break;

    default:
      logConsoleMessage(`Unknown message type: ${msg.type}`);
  }
});

// Signal that worker is loaded
parentPort.postMessage({
  type: 'loaded'
});

logConsoleMessage('Worker loaded and ready');
