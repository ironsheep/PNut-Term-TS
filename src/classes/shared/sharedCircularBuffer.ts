/** @format */

// src/classes/shared/sharedCircularBuffer.ts

import { EventEmitter } from 'events';

/**
 * SharedCircularBuffer - Thread-safe circular buffer using SharedArrayBuffer
 *
 * Designed for producer-consumer pattern:
 * - Main thread (producer): Writes USB data via appendAtTail()
 * - Worker thread (consumer): Reads data via next()
 *
 * Uses Atomics for thread-safe head/tail pointer updates.
 * Backed by SharedArrayBuffer for zero-copy between threads.
 */

const ENABLE_CONSOLE_LOG: boolean = false;

// Shared state indices in Int32Array
const HEAD_INDEX = 0;
const TAIL_INDEX = 1;
const IS_EMPTY_INDEX = 2;

export enum NextStatus {
  DATA = 'DATA',
  EMPTY = 'EMPTY'
}

export interface NextResult {
  status: NextStatus;
  value?: number;
}

export interface SharedBufferTransferables {
  dataBuffer: SharedArrayBuffer;
  stateBuffer: SharedArrayBuffer;
  size: number;
}

export class SharedCircularBuffer extends EventEmitter {
  private static logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private readonly bufferSize: number;
  private readonly buffer: Uint8Array; // Data storage (shared)
  private readonly sharedState: Int32Array; // [head, tail, isEmpty] (shared)

  // Statistics (not shared - each thread tracks its own)
  private overflowCount: number = 0;
  private highWaterMark: number = 0;
  private fullCapacityLogged: boolean = false;

  // Rate tracking for USB data
  private bytesInLastSecond: number = 0;
  private lastRateCheckTime: number = Date.now();
  private peakBytesPerSecond: number = 0;
  private peakRateStartTime: number = 0;
  private peakRateDuration: number = 0;

  /**
   * Create a new SharedCircularBuffer
   */
  constructor(bufferSize: number = 1048576) {
    super();

    this.bufferSize = bufferSize;

    // Create shared buffer for data
    const dataBuffer = new SharedArrayBuffer(bufferSize);
    this.buffer = new Uint8Array(dataBuffer);

    // Create shared state: [head, tail, isEmpty]
    const stateBuffer = new SharedArrayBuffer(12); // 3 x Int32 (4 bytes each)
    this.sharedState = new Int32Array(stateBuffer);

    // Initialize: empty buffer
    Atomics.store(this.sharedState, HEAD_INDEX, 0);
    Atomics.store(this.sharedState, TAIL_INDEX, 0);
    Atomics.store(this.sharedState, IS_EMPTY_INDEX, 1); // 1 = empty

    SharedCircularBuffer.logConsoleMessage(`[SharedCircularBuffer] Created ${bufferSize} byte shared buffer`);
  }

  /**
   * Create SharedCircularBuffer from transferred SharedArrayBuffers
   * Used in Worker thread to access the same buffers
   */
  public static fromTransferables(transferables: SharedBufferTransferables): SharedCircularBuffer {
    const instance = Object.create(SharedCircularBuffer.prototype);
    EventEmitter.call(instance);

    instance.bufferSize = transferables.size;
    instance.buffer = new Uint8Array(transferables.dataBuffer);
    instance.sharedState = new Int32Array(transferables.stateBuffer);
    instance.overflowCount = 0;
    instance.highWaterMark = 0;
    instance.savedPositions = []; // CRITICAL: Initialize saved positions array
    instance.fullCapacityLogged = false;
    instance.bytesInLastSecond = 0;
    instance.lastRateCheckTime = Date.now();
    instance.peakBytesPerSecond = 0;
    instance.peakRateStartTime = 0;
    instance.peakRateDuration = 0;

    SharedCircularBuffer.logConsoleMessage(
      `[SharedCircularBuffer] Attached to shared buffers (${transferables.size} bytes)`
    );

    return instance;
  }

  /**
   * Get transferable objects to send to Worker
   */
  public getTransferables(): SharedBufferTransferables {
    return {
      dataBuffer: this.buffer.buffer as SharedArrayBuffer,
      stateBuffer: this.sharedState.buffer as SharedArrayBuffer,
      size: this.bufferSize
    };
  }

  /**
   * Append data to tail (PRODUCER - Main Thread)
   * Thread-safe using Atomics
   */
  public appendAtTail(data: Uint8Array): boolean {
    const dataLength = data.length;

    // Check available space
    const available = this.getAvailableSpace();
    if (dataLength > available) {
      this.overflowCount++;
      // Log if buffer hits full capacity
      if (available === 0 && !this.fullCapacityLogged) {
        console.error(`[CircularBuffer] 🔴 FULL CAPACITY REACHED: Buffer exhausted (${this.bufferSize} bytes)`);
        this.fullCapacityLogged = true;
      }
      this.emit('bufferOverflow', {
        attempted: dataLength,
        available: available
      });
      SharedCircularBuffer.logConsoleMessage(
        `[SharedCircularBuffer] OVERFLOW: Attempted ${dataLength} bytes, only ${available} available`
      );
      return false;
    }
    // Reset full capacity flag once space becomes available again
    if (available > 0 && this.fullCapacityLogged) {
      this.fullCapacityLogged = false;
    }

    // Track bytes/second for rate calculation
    this.bytesInLastSecond += dataLength;
    const now = Date.now();
    const elapsed = now - this.lastRateCheckTime;

    // Update rate every second
    if (elapsed >= 1000) {
      const currentRate = Math.round(this.bytesInLastSecond / (elapsed / 1000));

      // Track peak rate and duration
      if (currentRate > this.peakBytesPerSecond) {
        // New peak
        this.peakBytesPerSecond = currentRate;
        this.peakRateStartTime = now;
        this.peakRateDuration = 0;
      } else if (currentRate === this.peakBytesPerSecond && this.peakBytesPerSecond > 0) {
        // Sustaining peak
        this.peakRateDuration = now - this.peakRateStartTime;
      }

      // Reset for next second
      this.bytesInLastSecond = 0;
      this.lastRateCheckTime = now;
    }

    // Get current tail position atomically
    const tail = Atomics.load(this.sharedState, TAIL_INDEX);
    const spaceAtEnd = this.bufferSize - tail;

    // Copy data using bulk operations (fast!)
    if (dataLength <= spaceAtEnd) {
      // No wraparound: single copy
      this.buffer.set(data, tail);
      Atomics.store(this.sharedState, TAIL_INDEX, (tail + dataLength) % this.bufferSize);
    } else {
      // Wraparound: two copies
      this.buffer.set(data.subarray(0, spaceAtEnd), tail);
      this.buffer.set(data.subarray(spaceAtEnd), 0);
      Atomics.store(this.sharedState, TAIL_INDEX, dataLength - spaceAtEnd);
    }

    // Mark buffer as not empty
    Atomics.store(this.sharedState, IS_EMPTY_INDEX, 0);

    // Update high water mark
    const used = this.getUsedSpace();
    if (used > this.highWaterMark) {
      const oldHighWater = this.highWaterMark;
      this.highWaterMark = used;
      const usagePercent = Math.round((used / this.bufferSize) * 1000) / 10;
      if (ENABLE_CONSOLE_LOG)
        console.log(
          `[CircularBuffer] 📈 NEW HIGH WATER MARK: ${used}/${this.bufferSize} bytes (${usagePercent}%) [was: ${oldHighWater}]`
        );
    }

    return true;
  }

  /**
   * Read next byte from head (CONSUMER - Worker Thread)
   * Thread-safe using Atomics
   */
  public next(): NextResult {
    // Check if empty atomically
    const isEmpty = Atomics.load(this.sharedState, IS_EMPTY_INDEX);
    if (isEmpty === 1) {
      return { status: NextStatus.EMPTY };
    }

    // Get head and tail atomically
    const head = Atomics.load(this.sharedState, HEAD_INDEX);
    const tail = Atomics.load(this.sharedState, TAIL_INDEX);

    // Read byte at head
    const value = this.buffer[head];

    // Advance head atomically
    const newHead = (head + 1) % this.bufferSize;
    Atomics.store(this.sharedState, HEAD_INDEX, newHead);

    // Check if buffer is now empty
    if (newHead === tail) {
      Atomics.store(this.sharedState, IS_EMPTY_INDEX, 1);
      // console.log(`[CircularBuffer] 🔄 Buffer went EMPTY (all data consumed)`);
    }

    return { status: NextStatus.DATA, value };
  }

  /**
   * Peek at bytes without consuming (for USB logging, etc.)
   * Thread-safe read-only operation
   */
  public peekAtOffset(offset: number, length: number): Uint8Array | null {
    const available = this.getUsedSpace();
    if (length > available) {
      return null; // Not enough data
    }

    const head = Atomics.load(this.sharedState, HEAD_INDEX);
    const readPos = (head + offset) % this.bufferSize;
    const result = new Uint8Array(length);

    if (readPos + length <= this.bufferSize) {
      // No wraparound
      result.set(this.buffer.subarray(readPos, readPos + length));
    } else {
      // Wraparound
      const firstPart = this.bufferSize - readPos;
      result.set(this.buffer.subarray(readPos, this.bufferSize));
      result.set(this.buffer.subarray(0, length - firstPart), firstPart);
    }

    return result;
  }

  /**
   * Check if buffer has data
   */
  public hasData(): boolean {
    return Atomics.load(this.sharedState, IS_EMPTY_INDEX) === 0;
  }

  /**
   * Get current used space (approximate - may change during read)
   */
  public getUsedSpace(): number {
    const isEmpty = Atomics.load(this.sharedState, IS_EMPTY_INDEX);
    if (isEmpty === 1) {
      return 0;
    }

    const head = Atomics.load(this.sharedState, HEAD_INDEX);
    const tail = Atomics.load(this.sharedState, TAIL_INDEX);

    if (tail >= head) {
      return tail - head;
    } else {
      return this.bufferSize - head + tail;
    }
  }

  /**
   * Get available space for writing
   */
  public getAvailableSpace(): number {
    return this.bufferSize - this.getUsedSpace() - 1; // -1 to prevent head==tail ambiguity
  }

  /**
   * Save current read position (for backtracking)
   */
  private savedPositions: number[] = [];

  public savePosition(): void {
    const head = Atomics.load(this.sharedState, HEAD_INDEX);
    this.savedPositions.push(head);
  }

  /**
   * Restore last saved position
   */
  public restorePosition(): boolean {
    if (this.savedPositions.length === 0) {
      return false;
    }

    const savedHead = this.savedPositions.pop()!;
    Atomics.store(this.sharedState, HEAD_INDEX, savedHead);

    // Update isEmpty flag
    const tail = Atomics.load(this.sharedState, TAIL_INDEX);
    if (savedHead === tail) {
      Atomics.store(this.sharedState, IS_EMPTY_INDEX, 1);
    } else {
      Atomics.store(this.sharedState, IS_EMPTY_INDEX, 0);
    }

    return true;
  }

  /**
   * Get head position (for metadata logging)
   */
  public getHeadPosition(): number {
    return Atomics.load(this.sharedState, HEAD_INDEX);
  }

  /**
   * Get tail position (for metadata logging)
   */
  public getTailPosition(): number {
    return Atomics.load(this.sharedState, TAIL_INDEX);
  }

  /**
   * Consume bytes (advance head pointer)
   */
  public consume(count: number): boolean {
    if (count <= 0) return true;

    const available = this.getUsedSpace();
    if (count > available) return false;

    const head = Atomics.load(this.sharedState, HEAD_INDEX);
    const newHead = (head + count) % this.bufferSize;
    Atomics.store(this.sharedState, HEAD_INDEX, newHead);

    // Update isEmpty flag
    const tail = Atomics.load(this.sharedState, TAIL_INDEX);
    if (newHead === tail) {
      Atomics.store(this.sharedState, IS_EMPTY_INDEX, 1);
    }

    return true;
  }

  /**
   * Clear buffer (reset to empty)
   */
  public clear(): void {
    Atomics.store(this.sharedState, HEAD_INDEX, 0);
    Atomics.store(this.sharedState, TAIL_INDEX, 0);
    Atomics.store(this.sharedState, IS_EMPTY_INDEX, 1);
    this.savedPositions = [];

    SharedCircularBuffer.logConsoleMessage('[SharedCircularBuffer] Buffer cleared');
  }

  /**
   * Get buffer statistics
   */
  public getStats() {
    const used = this.getUsedSpace();
    const available = this.getAvailableSpace();
    const usagePercent = (used / this.bufferSize) * 100;

    return {
      size: this.bufferSize,
      used: used,
      available: available,
      usagePercent: Math.round(usagePercent * 10) / 10,
      highWaterMark: this.highWaterMark,
      overflowCount: this.overflowCount,
      warningThreshold: 80,
      isNearFull: usagePercent >= 80,
      peakBytesPerSecond: this.peakBytesPerSecond,
      peakRateDuration: this.peakRateDuration
    };
  }

  /**
   * Log final statistics (called on shutdown)
   */
  public logFinalStats(): void {
    if (ENABLE_CONSOLE_LOG) {
      const stats = this.getStats();
      console.log(`[CircularBuffer] 📊 FINAL STATISTICS:`);
      console.log(`  Size: ${stats.size.toLocaleString()} bytes`);
      console.log(
        `  High Water Mark: ${stats.highWaterMark.toLocaleString()} bytes (${
          Math.round((stats.highWaterMark / stats.size) * 1000) / 10
        }%)`
      );
      console.log(`  Overflow Count: ${stats.overflowCount}`);
      console.log(`  Peak USB Rate: ${stats.peakBytesPerSecond.toLocaleString()} bytes/sec`);
      if (stats.peakRateDuration > 0) {
        console.log(`  Peak Rate Duration: ${Math.round(stats.peakRateDuration / 1000)} seconds`);
      }
    }
  }

  /**
   * Get read position for compatibility
   */
  public getReadPosition(): number {
    return this.getHeadPosition();
  }
}
