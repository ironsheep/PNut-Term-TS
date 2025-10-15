/** @format */

// src/classes/shared/sharedMessagePool.ts

/**
 * SharedMessagePool - Variable-size zero-copy message storage with size classes
 *
 * External Interface (UNCHANGED):
 * - Constructor: new SharedMessagePool(maxSlots, maxMessageSize)
 * - Transferables: {metadataBuffer, dataBuffer, maxSlots, maxMessageSize}
 * - Methods: acquire(size), release(poolId), get(poolId), getMessageType(poolId)
 *
 * Internal Implementation (NEW):
 * - Partitions single buffer into two size classes:
 *   - Slots 0-9999: Small pool (128 bytes each) for typical messages
 *   - Slots 10000-10499: Large pool (8192 bytes each) for debugger/DB packets
 * - Total: 10500 slots, ~5.2 MB (vs 64 MB with 1000×64KB slots)
 *
 * Thread Safety:
 * - Worker allocates slots, writes message data, sets refCount
 * - Main thread reads message data, decrements refCount on release
 * - Atomic operations prevent race conditions
 *
 * Memory Layout per Slot:
 * ┌──────────────┬──────────┬──────────────┬──────────────┬─────────────┐
 * │ refCount (4) │ type (1) │ length (2)   │ reserved (1) │ data (var)  │
 * └──────────────┴──────────┴──────────────┴──────────────┴─────────────┘
 */

const ENABLE_CONSOLE_LOG: boolean = false;

/**
 * Extracted Message Interface
 * Uses SharedMessageType directly (preserves COG ID in type)
 */
export interface ExtractedMessage {
  type: SharedMessageType;
  data: Uint8Array;
  timestamp: number;
  confidence?: string;
}

// SharedMessageType Enum
export enum SharedMessageType {
  DB_PACKET = 0,

  // COG messages (COG ID embedded: 0-7)
  COG0_MESSAGE = 1,
  COG1_MESSAGE = 2,
  COG2_MESSAGE = 3,
  COG3_MESSAGE = 4,
  COG4_MESSAGE = 5,
  COG5_MESSAGE = 6,
  COG6_MESSAGE = 7,
  COG7_MESSAGE = 8,

  // Debugger messages (COG ID embedded: 0-7)
  DEBUGGER0_416BYTE = 9,
  DEBUGGER1_416BYTE = 10,
  DEBUGGER2_416BYTE = 11,
  DEBUGGER3_416BYTE = 12,
  DEBUGGER4_416BYTE = 13,
  DEBUGGER5_416BYTE = 14,
  DEBUGGER6_416BYTE = 15,
  DEBUGGER7_416BYTE = 16,

  P2_SYSTEM_INIT = 17,

  // Backtick window commands
  BACKTICK_LOGIC = 18,
  BACKTICK_SCOPE = 19,
  BACKTICK_SCOPE_XY = 20,
  BACKTICK_FFT = 21,
  BACKTICK_SPECTRO = 22,
  BACKTICK_PLOT = 23,
  BACKTICK_TERM = 24,
  BACKTICK_BITMAP = 25,
  BACKTICK_MIDI = 26,
  BACKTICK_UPDATE = 27,

  TERMINAL_OUTPUT = 28,
  INVALID_COG = 29
}

// Slot header layout (metadata before data)
const METADATA_SIZE = 8;  // 4 bytes refCount + 1 byte type + 2 bytes length + 1 reserved
const TYPE_OFFSET = 4;
const LENGTH_OFFSET = 5;

/**
 * Size class configuration (INTERNAL)
 */
const SMALL_POOL_SLOTS = 10000;  // Increased to handle burst workloads
const SMALL_SLOT_SIZE = 128;
const LARGE_POOL_SLOTS = 500;    // Increased proportionally
const LARGE_SLOT_SIZE = 8192;
const TOTAL_SLOTS = SMALL_POOL_SLOTS + LARGE_POOL_SLOTS;  // 10500

// poolId ranges
const SMALL_POOL_START = 0;
const SMALL_POOL_END = SMALL_POOL_SLOTS - 1;  // 9999
const LARGE_POOL_START = SMALL_POOL_SLOTS;     // 10000
const LARGE_POOL_END = TOTAL_SLOTS - 1;        // 10499

/**
 * Pool slot handle - provides methods to read/write slot data
 */
export interface PoolSlot {
  poolId: number;

  writeType(type: SharedMessageType): void;
  writeLength(length: number): void;
  writeData(data: Uint8Array): void;
  setRefCount(count: number): void;

  readType(): SharedMessageType;
  readLength(): number;
  readData(): Uint8Array;
  getRefCount(): number;
}

/**
 * Transferable objects for worker thread initialization (UNCHANGED)
 */
export interface SharedMessagePoolTransferables {
  metadataBuffer: SharedArrayBuffer;
  dataBuffer: SharedArrayBuffer;
  maxSlots: number;
  maxMessageSize: number;
}

/**
 * SharedMessagePool - Variable-size message pool with internal size classes
 */
export class SharedMessagePool {
  private static logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log('[SharedMessagePool]', ...args);
    }
  }

  // Single metadata array for ALL slots
  private metadata: Int32Array;

  // Single data buffer partitioned into variable-size slots
  private data: Uint8Array;

  // Track which slots are in which pool (for statistics)
  private smallSlotsFree: number = SMALL_POOL_SLOTS;
  private smallSlotsAllocated: number = 0;
  private largeSlotsFree: number = LARGE_POOL_SLOTS;
  private largeSlotsAllocated: number = 0;

  // Statistics
  private smallAcquisitions: number = 0;
  private largeAcquisitions: number = 0;
  private smallReleases: number = 0;
  private largeReleases: number = 0;
  private smallOverflows: number = 0;
  private largeOverflows: number = 0;
  private smallHighWaterMark: number = 0;
  private largeHighWaterMark: number = 0;

  /**
   * Constructor - UNCHANGED external signature
   * Parameters are accepted for compatibility but internal config used
   */
  constructor(maxSlots: number = 1000, maxMessageSize: number = 65536) {
    // Calculate total memory needed for partitioned layout
    const smallPoolBytes = SMALL_POOL_SLOTS * SMALL_SLOT_SIZE;
    const largePoolBytes = LARGE_POOL_SLOTS * LARGE_SLOT_SIZE;
    const totalDataBytes = smallPoolBytes + largePoolBytes;

    // Create metadata array (one Int32 per slot for refCount)
    this.metadata = new Int32Array(new SharedArrayBuffer(TOTAL_SLOTS * 4));

    // Create data buffer (partitioned: small slots first, then large slots)
    this.data = new Uint8Array(new SharedArrayBuffer(totalDataBytes));

    SharedMessagePool.logConsoleMessage(
      `Initialized with ${SMALL_POOL_SLOTS} small slots (${SMALL_SLOT_SIZE}B) + ${LARGE_POOL_SLOTS} large slots (${LARGE_SLOT_SIZE}B)`
    );
    SharedMessagePool.logConsoleMessage(
      `Total: ${TOTAL_SLOTS} slots, ${(totalDataBytes / 1024).toFixed(0)} KB`
    );
  }

  /**
   * Create SharedMessagePool from transferred SharedArrayBuffers (Worker Thread)
   * UNCHANGED external signature
   */
  public static fromTransferables(transferables: {
    metadataBuffer: SharedArrayBuffer;
    dataBuffer: SharedArrayBuffer;
    maxSlots: number;
    maxMessageSize: number;
  }): SharedMessagePool {
    const instance = Object.create(SharedMessagePool.prototype);

    // Attach to transferred buffers
    instance.metadata = new Int32Array(transferables.metadataBuffer);
    instance.data = new Uint8Array(transferables.dataBuffer);

    // Initialize counters
    instance.smallSlotsFree = SMALL_POOL_SLOTS;
    instance.smallSlotsAllocated = 0;
    instance.largeSlotsFree = LARGE_POOL_SLOTS;
    instance.largeSlotsAllocated = 0;
    instance.smallAcquisitions = 0;
    instance.largeAcquisitions = 0;
    instance.smallReleases = 0;
    instance.largeReleases = 0;
    instance.smallOverflows = 0;
    instance.largeOverflows = 0;
    instance.smallHighWaterMark = 0;
    instance.largeHighWaterMark = 0;

    return instance;
  }

  /**
   * Get transferable objects for worker thread - UNCHANGED external signature
   */
  public getTransferables(): SharedMessagePoolTransferables {
    return {
      metadataBuffer: this.metadata.buffer as SharedArrayBuffer,
      dataBuffer: this.data.buffer as SharedArrayBuffer,
      maxSlots: TOTAL_SLOTS,
      maxMessageSize: LARGE_SLOT_SIZE - METADATA_SIZE
    };
  }

  /**
   * Calculate byte offset in data buffer for given poolId
   * Small pool: slots 0-1999, 128 bytes each, sequential
   * Large pool: slots 2000-2099, 8192 bytes each, sequential after small pool
   */
  private getSlotDataOffset(poolId: number): number {
    if (poolId <= SMALL_POOL_END) {
      // Small pool: poolId 0-1999
      return poolId * SMALL_SLOT_SIZE;
    } else {
      // Large pool: poolId 2000-2099
      const largePoolIndex = poolId - LARGE_POOL_START;
      return (SMALL_POOL_SLOTS * SMALL_SLOT_SIZE) + (largePoolIndex * LARGE_SLOT_SIZE);
    }
  }

  /**
   * Get slot size for given poolId
   */
  private getSlotSize(poolId: number): number {
    return poolId <= SMALL_POOL_END ? SMALL_SLOT_SIZE : LARGE_SLOT_SIZE;
  }

  /**
   * Determine if poolId is in small or large pool
   */
  private isSmallPool(poolId: number): boolean {
    return poolId <= SMALL_POOL_END;
  }

  /**
   * Select appropriate pool based on message size
   * Returns starting poolId for the selected pool
   */
  private selectPool(messageSize: number): { start: number; end: number; slotSize: number } {
    const maxDataSize = messageSize;

    if (maxDataSize <= (SMALL_SLOT_SIZE - METADATA_SIZE)) {
      return {
        start: SMALL_POOL_START,
        end: SMALL_POOL_END,
        slotSize: SMALL_SLOT_SIZE
      };
    } else {
      return {
        start: LARGE_POOL_START,
        end: LARGE_POOL_END,
        slotSize: LARGE_SLOT_SIZE
      };
    }
  }

  /**
   * Acquire a slot from the appropriate size class
   * Thread-safe using Atomics.compareExchange
   * UNCHANGED external signature
   */
  public acquire(messageSize?: number): PoolSlot | null {
    const pool = this.selectPool(messageSize || 0);
    const isSmall = (pool.start === SMALL_POOL_START);

    // Try to find free slot in selected pool
    for (let poolId = pool.start; poolId <= pool.end; poolId++) {
      if (Atomics.compareExchange(this.metadata, poolId, 0, 1) === 0) {
        // Successfully acquired slot
        if (isSmall) {
          this.smallAcquisitions++;
          this.smallSlotsFree--;
          this.smallSlotsAllocated++;
          if (this.smallSlotsAllocated > this.smallHighWaterMark) {
            this.smallHighWaterMark = this.smallSlotsAllocated;
          }
        } else {
          this.largeAcquisitions++;
          this.largeSlotsFree--;
          this.largeSlotsAllocated++;
          if (this.largeSlotsAllocated > this.largeHighWaterMark) {
            this.largeHighWaterMark = this.largeSlotsAllocated;
          }
        }

        SharedMessagePool.logConsoleMessage(
          `Acquired ${isSmall ? 'small' : 'large'} slot ${poolId} (size ${messageSize})`
        );

        return this.createSlotHandle(poolId);
      }
    }

    // Pool exhausted
    if (isSmall) {
      this.smallOverflows++;
    } else {
      this.largeOverflows++;
    }

    SharedMessagePool.logConsoleMessage(
      `${isSmall ? 'Small' : 'Large'} pool exhausted (size ${messageSize})`
    );

    return null;
  }

  /**
   * Release a slot back to pool
   * Thread-safe using Atomics.sub
   * UNCHANGED external signature
   */
  public release(poolId: number): void {
    const newCount = Atomics.sub(this.metadata, poolId, 1) - 1;

    if (newCount === 0) {
      // Slot is now free
      const isSmall = this.isSmallPool(poolId);

      if (isSmall) {
        this.smallSlotsFree++;
        this.smallSlotsAllocated--;
        this.smallReleases++;
      } else {
        this.largeSlotsFree++;
        this.largeSlotsAllocated--;
        this.largeReleases++;
      }

      SharedMessagePool.logConsoleMessage(
        `Released ${isSmall ? 'small' : 'large'} slot ${poolId}`
      );
    }
  }

  /**
   * Get slot handle for reading
   * UNCHANGED external signature
   */
  public get(poolId: number): PoolSlot {
    return this.createSlotHandle(poolId);
  }

  /**
   * Get message type without reading full data
   * UNCHANGED external signature
   */
  public getMessageType(poolId: number): SharedMessageType {
    const offset = this.getSlotDataOffset(poolId);
    return this.data[offset + TYPE_OFFSET] as SharedMessageType;
  }

  /**
   * Create slot handle with read/write methods
   */
  private createSlotHandle(poolId: number): PoolSlot {
    const offset = this.getSlotDataOffset(poolId);
    const slotSize = this.getSlotSize(poolId);

    return {
      poolId,

      writeType: (type: SharedMessageType) => {
        this.data[offset + TYPE_OFFSET] = type;
      },

      writeLength: (length: number) => {
        this.data[offset + LENGTH_OFFSET] = length & 0xFF;
        this.data[offset + LENGTH_OFFSET + 1] = (length >> 8) & 0xFF;
      },

      writeData: (data: Uint8Array) => {
        const maxData = slotSize - METADATA_SIZE;
        if (data.length > maxData) {
          throw new Error(`Data too large for slot: ${data.length} > ${maxData}`);
        }
        this.data.set(data, offset + METADATA_SIZE);
      },

      setRefCount: (count: number) => {
        Atomics.store(this.metadata, poolId, count);
      },

      readType: (): SharedMessageType => {
        return this.data[offset + TYPE_OFFSET] as SharedMessageType;
      },

      readLength: (): number => {
        return this.data[offset + LENGTH_OFFSET] | (this.data[offset + LENGTH_OFFSET + 1] << 8);
      },

      readData: (): Uint8Array => {
        const length = this.data[offset + LENGTH_OFFSET] | (this.data[offset + LENGTH_OFFSET + 1] << 8);

        // DIAGNOSTIC: Log length for debugging SPRITEDEF truncation
        if (ENABLE_CONSOLE_LOG || length > 1000) {
          SharedMessagePool.logConsoleMessage(
            `[DIAGNOSTIC] readData poolId=${poolId}, length=${length}, slotSize=${slotSize}, offset=${offset}`
          );
        }

        return this.data.slice(offset + METADATA_SIZE, offset + METADATA_SIZE + length);
      },

      getRefCount: (): number => {
        return Atomics.load(this.metadata, poolId);
      }
    };
  }

  /**
   * Get pool statistics
   */
  public getStats() {
    return {
      smallPool: {
        totalSlots: SMALL_POOL_SLOTS,
        slotSize: SMALL_SLOT_SIZE,
        slotsFree: this.smallSlotsFree,
        slotsAllocated: this.smallSlotsAllocated,
        acquisitions: this.smallAcquisitions,
        releases: this.smallReleases,
        overflows: this.smallOverflows,
        highWaterMark: this.smallHighWaterMark
      },
      largePool: {
        totalSlots: LARGE_POOL_SLOTS,
        slotSize: LARGE_SLOT_SIZE,
        slotsFree: this.largeSlotsFree,
        slotsAllocated: this.largeSlotsAllocated,
        acquisitions: this.largeAcquisitions,
        releases: this.largeReleases,
        overflows: this.largeOverflows,
        highWaterMark: this.largeHighWaterMark
      },
      total: {
        totalSlots: TOTAL_SLOTS,
        totalMemoryKB: ((SMALL_POOL_SLOTS * SMALL_SLOT_SIZE + LARGE_POOL_SLOTS * LARGE_SLOT_SIZE) / 1024).toFixed(0)
      }
    };
  }

  /**
   * Log final statistics
   */
  public logFinalStats(): void {
    const stats = this.getStats();

    console.log('[SharedMessagePool] 📊 FINAL STATISTICS:');
    console.log('  Small Pool:');
    console.log(`    Slots: ${stats.smallPool.totalSlots} × ${stats.smallPool.slotSize}B`);
    console.log(`    Acquisitions: ${stats.smallPool.acquisitions.toLocaleString()}`);
    console.log(`    Releases: ${stats.smallPool.releases.toLocaleString()}`);
    console.log(`    Overflows: ${stats.smallPool.overflows}`);
    console.log(`    High Water Mark: ${stats.smallPool.highWaterMark} / ${stats.smallPool.totalSlots}`);

    console.log('  Large Pool:');
    console.log(`    Slots: ${stats.largePool.totalSlots} × ${stats.largePool.slotSize}B`);
    console.log(`    Acquisitions: ${stats.largePool.acquisitions.toLocaleString()}`);
    console.log(`    Releases: ${stats.largePool.releases.toLocaleString()}`);
    console.log(`    Overflows: ${stats.largePool.overflows}`);
    console.log(`    High Water Mark: ${stats.largePool.highWaterMark} / ${stats.largePool.totalSlots}`);

    console.log(`  Total Memory: ${stats.total.totalMemoryKB} KB`);
  }
}
