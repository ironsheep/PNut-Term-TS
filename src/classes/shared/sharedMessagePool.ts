/** @format */

// src/classes/shared/sharedMessagePool.ts

/**
 * SharedMessagePool - Zero-copy message storage for Worker Thread extraction
 *
 * Uses SharedArrayBuffer for thread-safe message passing between Worker and Main threads.
 * Messages are allocated in variable-size slots with atomic reference counting.
 *
 * Memory Layout per Slot:
 * ┌──────────────┬──────────┬──────────────┬──────────────┬─────────────┐
 * │ refCount (4) │ type (1) │ length (2)   │ reserved (1) │ data (var)  │
 * │              │          │              │              │             │
 * │ Atomic ref   │ Message  │ Byte count   │ Alignment    │ Message     │
 * │ counter      │ type enum│ (0-65535)    │              │ bytes       │
 * └──────────────┴──────────┴──────────────┴──────────────┴─────────────┘
 *
 * Thread Safety:
 * - Worker allocates slots, writes message data, sets refCount
 * - Main thread reads message data, decrements refCount on release
 * - When refCount reaches 0, slot is automatically free for reuse
 */

const ENABLE_CONSOLE_LOG: boolean = false;

/**
 * Legacy MessageType enum for routing
 * Used by messageRouter and windows for simplified message classification
 */
export enum MessageType {
  DB_PACKET = 'DB_PACKET',
  COG_MESSAGE = 'COG_MESSAGE',
  BACKTICK_WINDOW = 'BACKTICK_WINDOW',
  DEBUGGER_416BYTE = 'DEBUGGER_416BYTE',
  P2_SYSTEM_INIT = 'P2_SYSTEM_INIT',
  TERMINAL_OUTPUT = 'TERMINAL_OUTPUT',
  INCOMPLETE_DEBUG = 'INCOMPLETE_DEBUG',
  INVALID_COG = 'INVALID_COG'
}

/**
 * Extracted Message Interface
 * Used for message passing between router and windows
 */
export interface ExtractedMessage {
  type: MessageType;
  data: Uint8Array;
  timestamp: number;
  confidence?: string;
  metadata?: Record<string, any>;
}

// SharedMessageType Enum - Single byte identifies specific type AND COG ID
// Used internally by Worker Thread for precise classification
export enum SharedMessageType {
  DB_PACKET = 0,

  // COG messages (COG ID embedded in enum: 0-7)
  COG0_MESSAGE = 1,
  COG1_MESSAGE = 2,
  COG2_MESSAGE = 3,
  COG3_MESSAGE = 4,
  COG4_MESSAGE = 5,
  COG5_MESSAGE = 6,
  COG6_MESSAGE = 7,
  COG7_MESSAGE = 8,

  // Debugger messages (COG ID embedded in enum: 0-7)
  DEBUGGER0_416BYTE = 9,
  DEBUGGER1_416BYTE = 10,
  DEBUGGER2_416BYTE = 11,
  DEBUGGER3_416BYTE = 12,
  DEBUGGER4_416BYTE = 13,
  DEBUGGER5_416BYTE = 14,
  DEBUGGER6_416BYTE = 15,
  DEBUGGER7_416BYTE = 16,

  // P2 System Init (golden sync point)
  P2_SYSTEM_INIT = 17,

  // Window types (backtick commands)
  WINDOW_LOGIC = 18,
  WINDOW_SCOPE = 19,
  WINDOW_SCOPE_XY = 20,
  WINDOW_FFT = 21,
  WINDOW_SPECTRO = 22,
  WINDOW_PLOT = 23,
  WINDOW_TERM = 24,
  WINDOW_BITMAP = 25,
  WINDOW_MIDI = 26,

  TERMINAL_OUTPUT = 27,
  INVALID_COG = 28
}

// Slot header offsets (in Int32Array indices)
const REFCOUNT_OFFSET = 0;  // 4 bytes (Int32)

// Slot header offsets (in Uint8Array indices)
const TYPE_OFFSET = 4;      // 1 byte
const LENGTH_OFFSET = 5;    // 2 bytes (Uint16)
const RESERVED_OFFSET = 7;  // 1 byte
const DATA_OFFSET = 8;      // Variable length data starts here

const HEADER_SIZE = 8; // Total header size in bytes

export interface SharedMessagePoolTransferables {
  metadataBuffer: SharedArrayBuffer;
  dataBuffer: SharedArrayBuffer;
  maxSlots: number;
  maxMessageSize: number;
}

export interface PoolSlot {
  poolId: number;
  readType(): SharedMessageType;
  readLength(): number;
  readData(): Uint8Array;
  writeType(type: SharedMessageType): void;
  writeLength(length: number): void;
  writeData(data: Uint8Array): void;
  setRefCount(count: number): void;
  getRefCount(): number;
}

export class SharedMessagePool {
  private static logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log('[SharedMessagePool]', ...args);
    }
  }

  private readonly maxSlots: number;
  private readonly maxMessageSize: number;
  private readonly metadataView: Int32Array;  // [refCount per slot]
  private readonly dataView: Uint8Array;      // [type, length, reserved, data...] per slot
  private readonly slotSize: number;          // Total bytes per slot (header + max message)

  // Statistics
  private slotsAllocated: number = 0;
  private slotsFree: number = 0;
  private acquisitions: number = 0;
  private releases: number = 0;
  private overflows: number = 0;

  /**
   * Create a new SharedMessagePool
   * @param maxSlots Maximum number of pool slots (default: 1000)
   * @param maxMessageSize Maximum message size in bytes (default: 65536)
   */
  constructor(maxSlots: number = 1000, maxMessageSize: number = 65536) {
    this.maxSlots = maxSlots;
    this.maxMessageSize = maxMessageSize;
    this.slotSize = HEADER_SIZE + maxMessageSize;

    // Create shared buffer for metadata (reference counts)
    const metadataBuffer = new SharedArrayBuffer(maxSlots * 4); // 4 bytes per refCount
    this.metadataView = new Int32Array(metadataBuffer);

    // Create shared buffer for data (headers + message data)
    const dataBuffer = new SharedArrayBuffer(maxSlots * this.slotSize);
    this.dataView = new Uint8Array(dataBuffer);

    // Initialize all slots as free (refCount = 0)
    for (let i = 0; i < maxSlots; i++) {
      Atomics.store(this.metadataView, i, 0);
    }

    this.slotsFree = maxSlots;

    SharedMessagePool.logConsoleMessage(
      `Created pool: ${maxSlots} slots × ${this.slotSize} bytes = ${(maxSlots * this.slotSize / 1024 / 1024).toFixed(2)}MB`
    );
  }

  /**
   * Create SharedMessagePool from transferred SharedArrayBuffers
   * Used in Worker thread to access the same pool as main thread
   */
  public static fromTransferables(transferables: SharedMessagePoolTransferables): SharedMessagePool {
    const instance = Object.create(SharedMessagePool.prototype);

    instance.maxSlots = transferables.maxSlots;
    instance.maxMessageSize = transferables.maxMessageSize;
    instance.slotSize = HEADER_SIZE + transferables.maxMessageSize;
    instance.metadataView = new Int32Array(transferables.metadataBuffer);
    instance.dataView = new Uint8Array(transferables.dataBuffer);
    instance.slotsAllocated = 0;
    instance.slotsFree = 0;
    instance.acquisitions = 0;
    instance.releases = 0;
    instance.overflows = 0;

    SharedMessagePool.logConsoleMessage(
      `Attached to shared pool: ${instance.maxSlots} slots × ${instance.slotSize} bytes`
    );

    return instance;
  }

  /**
   * Get transferable objects to send to Worker
   */
  public getTransferables(): SharedMessagePoolTransferables {
    return {
      metadataBuffer: this.metadataView.buffer as SharedArrayBuffer,
      dataBuffer: this.dataView.buffer as SharedArrayBuffer,
      maxSlots: this.maxSlots,
      maxMessageSize: this.maxMessageSize
    };
  }

  /**
   * Acquire a free slot from the pool
   * Thread-safe using Atomics.compareExchange
   * @returns PoolSlot object or null if pool exhausted
   */
  public acquire(): PoolSlot | null {
    // Atomically find and claim a free slot (refCount === 0)
    for (let slotId = 0; slotId < this.maxSlots; slotId++) {
      // Try to claim: if refCount is 0, set it to 1
      const previous = Atomics.compareExchange(this.metadataView, slotId, 0, 1);

      if (previous === 0) {
        // Successfully claimed this slot!
        this.acquisitions++;
        this.slotsAllocated++;
        this.slotsFree--;

        SharedMessagePool.logConsoleMessage(`Acquired slot ${slotId} (free: ${this.slotsFree}/${this.maxSlots})`);

        return this.createSlotHandle(slotId);
      }
    }

    // Pool exhausted - all slots in use
    this.overflows++;
    console.error('[SharedMessagePool] Pool exhausted! All slots in use.');
    return null;
  }

  /**
   * Get a slot by ID (for reading in main thread after Worker sends poolId)
   * @param poolId Slot ID from Worker
   * @returns PoolSlot object
   */
  public get(poolId: number): PoolSlot {
    if (poolId < 0 || poolId >= this.maxSlots) {
      throw new Error(`Invalid poolId: ${poolId}`);
    }

    return this.createSlotHandle(poolId);
  }

  /**
   * Release a reference to a pool slot
   * Thread-safe using Atomics.sub
   * When refCount reaches 0, slot is automatically free for reuse
   * @param poolId Slot ID to release
   */
  public release(poolId: number): void {
    if (poolId < 0 || poolId >= this.maxSlots) {
      throw new Error(`Invalid poolId: ${poolId}`);
    }

    // Atomically decrement reference count
    const newCount = Atomics.sub(this.metadataView, poolId, 1) - 1;

    this.releases++;

    if (newCount === 0) {
      // Slot is now free for reuse
      this.slotsFree++;
      this.slotsAllocated--;
      SharedMessagePool.logConsoleMessage(`Released slot ${poolId} (free: ${this.slotsFree}/${this.maxSlots})`);
    } else if (newCount < 0) {
      console.error(`[SharedMessagePool] Double-release detected! Slot ${poolId} refCount went negative.`);
    }
  }

  /**
   * Get message type without reading full message data
   * Used by router to determine destinations before reading message
   * @param poolId Slot ID
   * @returns SharedMessageType enum value
   */
  public getMessageType(poolId: number): SharedMessageType {
    if (poolId < 0 || poolId >= this.maxSlots) {
      throw new Error(`Invalid poolId: ${poolId}`);
    }

    const slotOffset = poolId * this.slotSize;
    return this.dataView[slotOffset + TYPE_OFFSET];
  }

  /**
   * Increment reference count for multiple consumers
   * Thread-safe using Atomics.add
   * @param poolId Slot ID
   * @param count Number to add to refCount
   */
  public incrementRefCount(poolId: number, count: number): void {
    if (poolId < 0 || poolId >= this.maxSlots) {
      throw new Error(`Invalid poolId: ${poolId}`);
    }

    if (count <= 0) {
      throw new Error(`Invalid increment count: ${count}`);
    }

    // Atomically increment reference count
    Atomics.add(this.metadataView, poolId, count);

    SharedMessagePool.logConsoleMessage(`Incremented slot ${poolId} refCount by ${count}`);
  }

  /**
   * Create a PoolSlot handle for a given slot ID
   */
  private createSlotHandle(poolId: number): PoolSlot {
    const metadataView = this.metadataView;
    const dataView = this.dataView;
    const slotSize = this.slotSize;
    const slotOffset = poolId * slotSize;

    return {
      poolId,

      readType(): SharedMessageType {
        return dataView[slotOffset + TYPE_OFFSET];
      },

      readLength(): number {
        // Read 2-byte length (little-endian)
        const lengthOffset = slotOffset + LENGTH_OFFSET;
        return dataView[lengthOffset] | (dataView[lengthOffset + 1] << 8);
      },

      readData(): Uint8Array {
        const length = this.readLength();
        const dataOffset = slotOffset + DATA_OFFSET;
        return new Uint8Array(dataView.buffer, dataView.byteOffset + dataOffset, length);
      },

      writeType(type: SharedMessageType): void {
        dataView[slotOffset + TYPE_OFFSET] = type;
      },

      writeLength(length: number): void {
        // Write 2-byte length (little-endian)
        const lengthOffset = slotOffset + LENGTH_OFFSET;
        dataView[lengthOffset] = length & 0xFF;
        dataView[lengthOffset + 1] = (length >> 8) & 0xFF;
      },

      writeData(data: Uint8Array): void {
        const dataOffset = slotOffset + DATA_OFFSET;
        dataView.set(data, dataOffset);
      },

      setRefCount(count: number): void {
        Atomics.store(metadataView, poolId, count);
      },

      getRefCount(): number {
        return Atomics.load(metadataView, poolId);
      }
    };
  }

  /**
   * Get pool statistics
   */
  public getStats() {
    return {
      maxSlots: this.maxSlots,
      maxMessageSize: this.maxMessageSize,
      slotSize: this.slotSize,
      slotsAllocated: this.slotsAllocated,
      slotsFree: this.slotsFree,
      acquisitions: this.acquisitions,
      releases: this.releases,
      overflows: this.overflows,
      utilizationPercent: Math.round((this.slotsAllocated / this.maxSlots) * 100)
    };
  }

  /**
   * Clear all slots (for testing/reset)
   */
  public clear(): void {
    for (let i = 0; i < this.maxSlots; i++) {
      Atomics.store(this.metadataView, i, 0);
    }
    this.slotsFree = this.maxSlots;
    this.slotsAllocated = 0;
    SharedMessagePool.logConsoleMessage('Pool cleared');
  }
}

/**
 * Helper function to extract COG ID from SharedMessageType enum
 */
export function getCogIdFromType(type: SharedMessageType): number | null {
  if (type >= SharedMessageType.COG0_MESSAGE && type <= SharedMessageType.COG7_MESSAGE) {
    return type - SharedMessageType.COG0_MESSAGE;
  }
  if (type >= SharedMessageType.DEBUGGER0_416BYTE && type <= SharedMessageType.DEBUGGER7_416BYTE) {
    return type - SharedMessageType.DEBUGGER0_416BYTE;
  }
  return null;
}

/**
 * Helper function to get message category from SharedMessageType enum
 */
export function getMessageCategory(type: SharedMessageType): string {
  if (type >= SharedMessageType.COG0_MESSAGE && type <= SharedMessageType.COG7_MESSAGE) {
    return 'COG';
  }
  if (type >= SharedMessageType.DEBUGGER0_416BYTE && type <= SharedMessageType.DEBUGGER7_416BYTE) {
    return 'DEBUGGER';
  }
  if (type === SharedMessageType.P2_SYSTEM_INIT) {
    return 'P2_INIT';
  }
  if (type >= SharedMessageType.WINDOW_LOGIC && type <= SharedMessageType.WINDOW_MIDI) {
    return 'WINDOW';
  }
  if (type === SharedMessageType.DB_PACKET) {
    return 'DB_PACKET';
  }
  return 'OTHER';
}
