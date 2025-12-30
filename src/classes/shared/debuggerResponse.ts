/**
 * P2 Debugger Response Generator
 *
 * CRITICAL: The P2 uses lock #15 to serialize COG communications.
 * Each COG blocks waiting for host response before releasing the lock!
 * Without sending this response, only COG1 will ever send data.
 *
 * Phase 2 Response Structure (52 bytes total):
 * - 8 bytes: COG/LUT block change request bits (64 blocks / 8 bits per byte)
 * - 16 bytes: Hub block change request bits (128 blocks, rounded up from 124)
 * - 20 bytes: Hub read requests (5 longs)
 * - 4 bytes: COGBRK request (1 long)
 * - 4 bytes: Stall/Break command (1 long)
 *
 * Reference: Pascal DebuggerUnit.pas lines 1304-1345
 */

import { MEMORY_CONSTANTS, DEBUG_COMMANDS } from './debuggerConstants';

// Constants matching Pascal DebuggerUnit.pas
const COG_BLOCKS = 64; // CogBlocks = CogSize / CogBlockSize = $400 / $10 = 64
const HUB_BLOCKS = 124; // HubBlocks = HubSize / HubBlockSize = $7C000 / $1000 = 124
const HUB_BLOCKS_ROUNDED = 128; // (HubBlocks + $1F) AND NOT $1F = 128 (rounded up to 32)
const PTR_BYTES = 14; // Number of bytes in pointer windows
const PTR_CENTER = 6; // Center offset for pointer windows
const HUB_SUB_BLOCK_SIZE = 0x80; // 128 bytes

export class DebuggerResponse {
  // Previous CRC values for change detection (64 16-bit words)
  private cogCrcOld: Uint16Array = new Uint16Array(COG_BLOCKS);

  // Previous Hub checksums for change detection (124 16-bit words)
  private hubChecksumOld: Uint16Array = new Uint16Array(HUB_BLOCKS);

  // Current values from received packet
  private cogCrc: Uint16Array = new Uint16Array(COG_BLOCKS);
  private hubChecksum: Uint16Array = new Uint16Array(HUB_BLOCKS);

  // Debugger state for hub read requests
  private disAddr: number = 0; // Disassembly address
  private disLines: number = 16; // Number of disassembly lines to request
  private fptr: number = 0; // FPTR value from debugger message
  private ptra: number = 0; // PTRA value from debugger message
  private ptrb: number = 0; // PTRB value from debugger message
  private hubAddr: number = 0; // Hub memory view address
  private getHubCode: boolean = false; // Whether to request disassembly from Hub

  // COGBRK request mask
  private requestCogBrk: number = 0;

  // Stall/Break command state
  private stallBrk: number = DEBUG_COMMANDS.STALL_CMD;

  /**
   * Generate Phase 2 response packet for P2 debugger
   * Total: 52 bytes
   */
  public generateResponse(debugPacket: Uint8Array): Uint8Array {
    // Update current CRCs from packet
    this.updateFromPacket(debugPacket);

    const response = new Uint8Array(52);
    let offset = 0;

    // 1. COG/LUT block change request bits (8 bytes)
    // Pack 64 bits into 8 bytes, LSB first within each byte
    for (let byteIndex = 0; byteIndex < 8; byteIndex++) {
      let h = 0;
      for (let bit = 0; bit < 8; bit++) {
        const blockIndex = byteIndex * 8 + bit;
        if (this.cogCrc[blockIndex] !== this.cogCrcOld[blockIndex]) {
          h |= 1 << bit;
        }
      }
      response[offset++] = h;
    }

    // 2. Hub block change request bits (16 bytes)
    // Pack 128 bits into 16 bytes (Pascal rounds 124 up to 128)
    for (let byteIndex = 0; byteIndex < 16; byteIndex++) {
      let h = 0;
      for (let bit = 0; bit < 8; bit++) {
        const blockIndex = byteIndex * 8 + bit;
        if (blockIndex < HUB_BLOCKS) {
          if (this.hubChecksum[blockIndex] !== this.hubChecksumOld[blockIndex]) {
            h |= 1 << bit;
          }
        }
        // Bits beyond HUB_BLOCKS (124-127) remain 0
      }
      response[offset++] = h;
    }

    // 3. Hub read requests (5 longs = 20 bytes)
    // Format: (size << 20) | (address & 0xFFFFF)

    // Disassembly request
    if (this.getHubCode) {
      offset = this.writeLong(response, offset, (this.disLines << 2 << 20) | this.disAddr);
    } else {
      offset = this.writeLong(response, offset, 0);
    }

    // FPTR window
    offset = this.writeLong(response, offset, (PTR_BYTES << 20) | ((this.fptr - PTR_CENTER) & 0xfffff));

    // PTRA window
    offset = this.writeLong(response, offset, (PTR_BYTES << 20) | ((this.ptra - PTR_CENTER) & 0xfffff));

    // PTRB window
    offset = this.writeLong(response, offset, (PTR_BYTES << 20) | ((this.ptrb - PTR_CENTER) & 0xfffff));

    // Hub memory window
    offset = this.writeLong(response, offset, (HUB_SUB_BLOCK_SIZE << 20) | this.hubAddr);

    // 4. COGBRK request (4 bytes)
    offset = this.writeLong(response, offset, this.requestCogBrk);
    this.requestCogBrk = 0; // Clear after sending

    // 5. Stall/Break command (4 bytes)
    offset = this.writeLong(response, offset, this.stallBrk);
    this.stallBrk = DEBUG_COMMANDS.STALL_CMD; // Reset to stall after sending

    // Save current state as old for next comparison
    this.cogCrcOld.set(this.cogCrc);
    this.hubChecksumOld.set(this.hubChecksum);

    return response;
  }

  /**
   * Update internal state from received 456-byte debugger packet
   * Packet structure:
   * - Bytes 0-79: 20 longs (DebuggerMsg array)
   * - Bytes 80-207: 64 CRC words (COG/LUT blocks)
   * - Bytes 208-455: 124 checksum words (Hub blocks)
   */
  private updateFromPacket(packet: Uint8Array): void {
    if (packet.length < 456) {
      console.warn(`[DebuggerResponse] Packet too small: ${packet.length} bytes, expected 456`);
      return;
    }

    const view = new DataView(packet.buffer, packet.byteOffset, packet.length);

    // Extract debugger message values we need for hub read requests
    // mFPTR = 15, mPTRA = 16, mPTRB = 17 (indices into 20-long array)
    this.fptr = view.getUint32(15 * 4, true);
    this.ptra = view.getUint32(16 * 4, true);
    this.ptrb = view.getUint32(17 * 4, true);

    // Extract 64 COG/LUT CRC words (bytes 80-207)
    for (let i = 0; i < COG_BLOCKS; i++) {
      this.cogCrc[i] = view.getUint16(80 + i * 2, true);
    }

    // Extract 124 Hub checksum words (bytes 208-455)
    for (let i = 0; i < HUB_BLOCKS; i++) {
      this.hubChecksum[i] = view.getUint16(208 + i * 2, true);
    }
  }

  /**
   * Write a 32-bit long in little-endian format
   */
  private writeLong(buffer: Uint8Array, offset: number, value: number): number {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >> 8) & 0xff;
    buffer[offset + 2] = (value >> 16) & 0xff;
    buffer[offset + 3] = (value >> 24) & 0xff;
    return offset + 4;
  }

  /**
   * Set the stall/break command to send in next response
   * @param command DEBUG_COMMANDS.STALL_CMD to hold, or breakValue to continue
   */
  public setStallBreak(command: number): void {
    this.stallBrk = command;
  }

  /**
   * Set COGBRK request mask (bit N = request break from COG N)
   */
  public setRequestCogBrk(mask: number): void {
    this.requestCogBrk = mask;
  }

  /**
   * Set disassembly address for hub code reading
   */
  public setDisassemblyAddress(address: number, lines: number = 16): void {
    this.disAddr = address;
    this.disLines = lines;
  }

  /**
   * Set whether to request hub code for disassembly
   */
  public setGetHubCode(enabled: boolean): void {
    this.getHubCode = enabled;
  }

  /**
   * Set hub memory view address
   */
  public setHubAddress(address: number): void {
    this.hubAddr = address;
  }

  /**
   * Reset state (e.g., after DTR reset)
   */
  public reset(): void {
    this.cogCrcOld.fill(0);
    this.hubChecksumOld.fill(0);
    this.cogCrc.fill(0);
    this.hubChecksum.fill(0);
    this.requestCogBrk = 0;
    this.stallBrk = DEBUG_COMMANDS.STALL_CMD;
    this.fptr = 0;
    this.ptra = 0;
    this.ptrb = 0;
    this.hubAddr = 0;
    this.disAddr = 0;
    this.getHubCode = false;
  }

  /**
   * Get changed COG/LUT block indices
   * Used for Phase 3 reception planning
   */
  public getChangedCogBlocks(): number[] {
    const changed: number[] = [];
    for (let i = 0; i < COG_BLOCKS; i++) {
      if (this.cogCrc[i] !== this.cogCrcOld[i]) {
        changed.push(i);
      }
    }
    return changed;
  }

  /**
   * Get changed Hub block indices
   * Used for Phase 3 reception planning
   */
  public getChangedHubBlocks(): number[] {
    const changed: number[] = [];
    for (let i = 0; i < HUB_BLOCKS; i++) {
      if (this.hubChecksum[i] !== this.hubChecksumOld[i]) {
        changed.push(i);
      }
    }
    return changed;
  }
}
