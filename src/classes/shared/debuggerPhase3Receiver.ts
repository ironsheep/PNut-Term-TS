/**
 * Phase 3 Protocol Receiver for P2 Debugger
 *
 * After PC sends Phase 2 request (52 bytes), the P2 responds with Phase 3 data.
 * The data size is VARIABLE based on what was requested:
 *
 * 1. COG/LUT blocks - For each changed block: 16 longs = 64 bytes
 * 2. Hub sub-blocks - For each changed Hub block: 32 words = 64 bytes
 * 3. Hub reads - FPTR/PTRA/PTRB windows (14 bytes each) + Hub window (128 bytes)
 *    Plus optional disassembly data if code is in Hub
 * 4. Smart pin data - 8 bytes flags + up to 64 longs of pin values
 *
 * Reference: Pascal DebuggerUnit.pas lines 1351-1383
 */

import { MEMORY_CONSTANTS } from './debuggerConstants';

// Constants matching Pascal DebuggerUnit.pas
const COG_BLOCK_SIZE = 16; // longs per block
const COG_BLOCKS = 64;
const HUB_BLOCKS = 124;
const HUB_BLOCK_RATIO = 32; // words per block
const PTR_BYTES = 14;
const HUB_SUB_BLOCK_SIZE = 0x80; // 128 bytes
const DIS_LINES = 16; // Default disassembly lines
const SMART_PINS = 64;

/**
 * Expected response structure based on Phase 2 request
 */
export interface Phase3Expectations {
  changedCogBlocks: number[]; // Indices of COG/LUT blocks that changed
  changedHubBlocks: number[]; // Indices of Hub blocks that changed
  getHubCode: boolean; // Whether disassembly from Hub was requested
  disLines: number; // Number of disassembly lines requested
}

/**
 * Parsed Phase 3 data
 */
export interface Phase3Data {
  cogMemory: Map<number, Uint32Array>; // Block index -> 16 longs
  hubSubBlocks: Map<number, Uint16Array>; // Hub block index -> 32 sub-block checksums
  disassemblyData: Uint32Array | null; // Disassembly longs if requested
  fptrWindow: Uint8Array; // 14 bytes FPTR window
  ptraWindow: Uint8Array; // 14 bytes PTRA window
  ptrbWindow: Uint8Array; // 14 bytes PTRB window
  hubWindow: Uint8Array; // 128 bytes Hub memory window
  smartPinFlags: number; // 64 bits packed into 8 bytes
  smartPinData: Uint32Array; // Pin values where flags set
}

export class DebuggerPhase3Receiver {
  private buffer: number[] = [];
  private expectations: Phase3Expectations | null = null;
  private expectedSize: number = 0;

  /**
   * Set expectations for Phase 3 based on Phase 2 request
   */
  public setExpectations(expectations: Phase3Expectations): void {
    this.expectations = expectations;
    this.expectedSize = this.calculateExpectedSize(expectations);
    this.buffer = [];
  }

  /**
   * Calculate expected Phase 3 response size
   */
  private calculateExpectedSize(exp: Phase3Expectations): number {
    let size = 0;

    // COG/LUT block data: 16 longs = 64 bytes per changed block
    size += exp.changedCogBlocks.length * (COG_BLOCK_SIZE * 4);

    // Hub sub-block checksums: 32 words = 64 bytes per changed block
    size += exp.changedHubBlocks.length * (HUB_BLOCK_RATIO * 2);

    // Hub reads
    if (exp.getHubCode) {
      size += exp.disLines * 4; // Disassembly longs
    }
    size += PTR_BYTES * 3; // FPTR + PTRA + PTRB windows
    size += HUB_SUB_BLOCK_SIZE; // Hub memory window

    // Smart pin data: 8 bytes flags + variable pin data
    // We don't know exactly how many pins until we receive the flags
    // Minimum: 8 bytes for flags, maximum: 8 + 64*4 = 264 bytes
    // For calculation, assume minimum (actual parsing handles variable size)
    size += 8;

    return size;
  }

  /**
   * Get expected response size
   */
  public getExpectedSize(): number {
    return this.expectedSize;
  }

  /**
   * Add received bytes to buffer
   * Returns true if all expected data has been received
   */
  public addData(data: Uint8Array): boolean {
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data[i]);
    }
    // Note: Smart pin data makes exact size calculation difficult
    // Return true when we have at least the calculated minimum
    return this.buffer.length >= this.expectedSize;
  }

  /**
   * Parse the received Phase 3 data
   */
  public parse(): Phase3Data | null {
    if (!this.expectations || this.buffer.length < this.expectedSize) {
      return null;
    }

    const data = new Uint8Array(this.buffer);
    const view = new DataView(data.buffer);
    let offset = 0;

    // Initialize result
    const result: Phase3Data = {
      cogMemory: new Map(),
      hubSubBlocks: new Map(),
      disassemblyData: null,
      fptrWindow: new Uint8Array(PTR_BYTES),
      ptraWindow: new Uint8Array(PTR_BYTES),
      ptrbWindow: new Uint8Array(PTR_BYTES),
      hubWindow: new Uint8Array(HUB_SUB_BLOCK_SIZE),
      smartPinFlags: 0,
      smartPinData: new Uint32Array(SMART_PINS)
    };

    // 1. Parse COG/LUT block data
    for (const blockIndex of this.expectations.changedCogBlocks) {
      const blockData = new Uint32Array(COG_BLOCK_SIZE);
      for (let j = 0; j < COG_BLOCK_SIZE; j++) {
        blockData[j] = view.getUint32(offset, true);
        offset += 4;
      }
      result.cogMemory.set(blockIndex, blockData);
    }

    // 2. Parse Hub sub-block checksums
    for (const blockIndex of this.expectations.changedHubBlocks) {
      const subBlockData = new Uint16Array(HUB_BLOCK_RATIO);
      for (let j = 0; j < HUB_BLOCK_RATIO; j++) {
        subBlockData[j] = view.getUint16(offset, true);
        offset += 2;
      }
      result.hubSubBlocks.set(blockIndex, subBlockData);
    }

    // 3. Parse Hub reads
    if (this.expectations.getHubCode) {
      result.disassemblyData = new Uint32Array(this.expectations.disLines);
      for (let i = 0; i < this.expectations.disLines; i++) {
        result.disassemblyData[i] = view.getUint32(offset, true);
        offset += 4;
      }
    }

    // FPTR window
    for (let i = 0; i < PTR_BYTES; i++) {
      result.fptrWindow[i] = data[offset++];
    }

    // PTRA window
    for (let i = 0; i < PTR_BYTES; i++) {
      result.ptraWindow[i] = data[offset++];
    }

    // PTRB window
    for (let i = 0; i < PTR_BYTES; i++) {
      result.ptrbWindow[i] = data[offset++];
    }

    // Hub memory window
    for (let i = 0; i < HUB_SUB_BLOCK_SIZE; i++) {
      result.hubWindow[i] = data[offset++];
    }

    // 4. Parse smart pin data
    // First 8 bytes contain presence flags
    result.smartPinFlags = 0;
    for (let i = 0; i < 8; i++) {
      result.smartPinFlags |= (data[offset++] << (i * 8));
    }

    // Read pin values where flags are set
    for (let i = 0; i < SMART_PINS; i++) {
      if ((result.smartPinFlags >> i) & 1) {
        if (offset + 4 <= data.length) {
          result.smartPinData[i] = view.getUint32(offset, true);
          offset += 4;
        }
      } else {
        result.smartPinData[i] = 0;
      }
    }

    return result;
  }

  /**
   * Reset receiver state
   */
  public reset(): void {
    this.buffer = [];
    this.expectations = null;
    this.expectedSize = 0;
  }

  /**
   * Get current buffer size
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }
}
