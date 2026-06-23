/** @format */

import {
  COG_BLOCK_SIZE,
  HUB_BLOCK_RATIO,
  HUB_SUB_BLOCK_SIZE,
  PTR_BYTES,
  DIS_LINES,
  SMART_PINS
} from '../shared/constants';
import { DebuggerState } from './DebuggerState';

/**
 * Accumulates Phase 3 bytes from the P2 and applies them to DebuggerState.
 *
 * Layout (Theory of Operations §3.3 "Phase 3" + Spin2_debugger.spin2 lines
 * 1045-1090):
 *
 *   1. Changed COG/LUT register blocks:
 *        for each bit set in Phase 2 COG bitmap → 16 longs (64 bytes)
 *   2. Hub sub-block checksums:
 *        for each bit set in Phase 2 hub bitmap → 32 words (64 bytes)
 *   3. Hub reads (always in the fixed order specified by Phase 2's 5 longs):
 *        - Disassembly (16 longs = 64 bytes), only if hub-code was requested
 *        - FPTR window    (14 bytes)
 *        - PTRA window    (14 bytes)
 *        - PTRB window    (14 bytes)
 *        - Hub data viewer (128 bytes)
 *   4. Smart pin data (ALWAYS sent, 8 groups of 8 pins):
 *        - 1 mask byte (which pins in this group have non-zero RQPIN)
 *        - N longs (one per set bit in the mask), each = RQPIN value
 *
 * The stream is parsed byte-at-a-time because the smart-pin section's
 * length depends on the mask byte values. The parser signals completion
 * when it has consumed the last smart-pin long.
 */

/** Total length of the fixed hub-reads portion (bytes). */
function fixedHubReadsBytes(hubCode: boolean): number {
  return (hubCode ? DIS_LINES * 4 : 0) + PTR_BYTES * 3 + HUB_SUB_BLOCK_SIZE;
}

const enum Section {
  CogBlocks,
  HubBlocks,
  HubReads,
  SmartPinMask,
  SmartPinLongs,
  Done
}

export class DebuggerPhase3Parser {
  private state: DebuggerState;
  /** Accumulated bytes (streaming — we may not have a complete Phase 3 in one chunk). */
  private buffer: number[] = [];
  /** Read position into `buffer`. */
  private pos: number = 0;
  /** Current parser section. */
  private section: Section = Section.CogBlocks;

  /** Index into state.pendingCogBlocks of the block we're currently reading. */
  private cogBlockIdx: number = 0;
  private hubBlockIdx: number = 0;

  /** Current smart pin group (0..7) and bit (0..7) being processed. */
  private smartGroup: number = 0;
  private smartMask: number = 0;
  private smartBit: number = 0;

  constructor(state: DebuggerState) {
    this.state = state;
  }

  /** Reset parser for the next breakpoint exchange. */
  public reset(): void {
    this.buffer = [];
    this.pos = 0;
    this.section = Section.CogBlocks;
    this.cogBlockIdx = 0;
    this.hubBlockIdx = 0;
    this.smartGroup = 0;
    this.smartMask = 0;
    this.smartBit = 0;
  }

  /**
   * Append a chunk of Phase 3 bytes. Returns true when Phase 3 is complete
   * (all sections fully consumed); any bytes beyond the Phase 3 end are
   * left in the buffer for the caller to re-dispatch (shouldn't happen in
   * a well-behaved protocol, but we don't drop data either).
   */
  public addChunk(chunk: Uint8Array): boolean {
    for (let i = 0; i < chunk.length; i++) this.buffer.push(chunk[i]);
    this.tryParse();
    return this.section === Section.Done;
  }

  /** Returns true if Phase 3 has been fully parsed. */
  public isComplete(): boolean {
    return this.section === Section.Done;
  }

  /**
   * Exact number of Phase-3 bytes consumed so far (the read cursor). When the
   * parser is `Done`, this is the authoritative byte length of the completed
   * Phase-3 stream — used by the controller's exact-size cross-check. Mirrors
   * Pascal's atomic byte accounting in `Breakpoint` (DebuggerUnit.pas :1304-1383).
   */
  public consumed(): number {
    return this.pos;
  }

  /** Bytes remaining in the buffer past the Phase 3 end (should be 0). */
  public leftover(): Uint8Array {
    if (this.pos >= this.buffer.length) return new Uint8Array(0);
    return new Uint8Array(this.buffer.slice(this.pos));
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private available(): number {
    return this.buffer.length - this.pos;
  }

  private readU8(): number {
    return this.buffer[this.pos++];
  }
  private readU16LE(): number {
    const lo = this.buffer[this.pos++];
    const hi = this.buffer[this.pos++];
    return lo | (hi << 8);
  }
  private readU32LE(): number {
    const b0 = this.buffer[this.pos++];
    const b1 = this.buffer[this.pos++];
    const b2 = this.buffer[this.pos++];
    const b3 = this.buffer[this.pos++];
    return ((b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0);
  }

  /** Try to advance through as many sections as we have bytes for. */
  private tryParse(): void {
    // The loop processes one "element" per iteration (one COG block, one
    // hub-block's worth of checksums, one hub read, one smart-pin group).
    // We bail out whenever the buffer doesn't have enough bytes to finish
    // the current element.
    while (this.section !== Section.Done) {
      switch (this.section) {
        case Section.CogBlocks: {
          if (this.cogBlockIdx >= this.state.pendingCogBlocks.length) {
            this.section = Section.HubBlocks;
            break;
          }
          if (this.available() < COG_BLOCK_SIZE * 4) return;
          const blockIdx = this.state.pendingCogBlocks[this.cogBlockIdx++];
          const baseAddr = blockIdx * COG_BLOCK_SIZE; // 0..0x3F0 for combined cog+lut
          for (let j = 0; j < COG_BLOCK_SIZE; j++) {
            const value = this.readU32LE();
            if (baseAddr + j < this.state.cogImage.length) {
              this.state.cogImage[baseAddr + j] = value;
              // Bump the heat counter so the heatmap sparkles.
              this.state.cogHit[baseAddr + j] = 254;
            }
          }
          break;
        }
        case Section.HubBlocks: {
          if (this.hubBlockIdx >= this.state.pendingHubBlocks.length) {
            this.section = Section.HubReads;
            this.parseHubReadsInit();
            break;
          }
          if (this.available() < HUB_BLOCK_RATIO * 2) return;
          // Each changed 4 KB hub block carries 32 per-128-byte sub-block
          // checksums. Capture them into hubSubBlock[] (shifting old→current)
          // so the §6.18 heat map can flash + decay per sub-block. Mirrors
          // Pascal DebuggerUnit.pas L1357-1365.
          {
            const blockIdx = this.state.pendingHubBlocks[this.hubBlockIdx++];
            const base = blockIdx * HUB_BLOCK_RATIO;
            for (let j = 0; j < HUB_BLOCK_RATIO; j++) {
              const k = base + j;
              const word = this.readU16LE();
              if (k < this.state.hubSubBlock.length) {
                this.state.hubSubBlockOld[k] = this.state.hubSubBlock[k];
                this.state.hubSubBlock[k] = word;
                // First-ever receipt: no diff (old = current).
                if (this.state.hubSubBlockOld[k] === -1) this.state.hubSubBlockOld[k] = word;
              }
            }
          }
          break;
        }
        case Section.HubReads:
          // All four pointer windows + hub viewer (+ optional disassembly)
          // are one contiguous block; consume them in one step if enough
          // bytes are present.
          {
            const need = fixedHubReadsBytes(this.state.pendingHubCode);
            if (this.available() < need) return;
            if (this.state.pendingHubCode) {
              for (let j = 0; j < DIS_LINES; j++) {
                this.state.disCode[j] = this.readU32LE();
              }
            }
            for (let j = 0; j < PTR_BYTES; j++) this.state.fptrWindow[j] = this.readU8();
            for (let j = 0; j < PTR_BYTES; j++) this.state.ptraWindow[j] = this.readU8();
            for (let j = 0; j < PTR_BYTES; j++) this.state.ptrbWindow[j] = this.readU8();
            for (let j = 0; j < HUB_SUB_BLOCK_SIZE; j++) this.state.hubWindow[j] = this.readU8();
            this.section = Section.SmartPinMask;
          }
          break;
        case Section.SmartPinMask: {
          if (this.smartGroup >= 8) {
            this.section = Section.Done;
            break;
          }
          if (this.available() < 1) return;
          this.smartMask = this.readU8();
          this.smartBit = 0;
          this.section = Section.SmartPinLongs;
          break;
        }
        case Section.SmartPinLongs: {
          // Read one long per set bit in smartMask; zero out cleared bits.
          while (this.smartBit < 8) {
            const pinIdx = this.smartGroup * 8 + this.smartBit;
            if (this.smartMask & (1 << this.smartBit)) {
              if (this.available() < 4) return; // wait for more bytes
              if (pinIdx < SMART_PINS) {
                this.state.smartPinRqpin[pinIdx] = this.readU32LE();
              } else {
                this.readU32LE(); // discard
              }
            } else {
              if (pinIdx < SMART_PINS) this.state.smartPinRqpin[pinIdx] = 0;
            }
            this.smartBit++;
          }
          this.smartGroup++;
          this.section = Section.SmartPinMask;
          break;
        }
        default:
          return;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private parseHubReadsInit(): void {
    // Placeholder hook for future pre-checks; keeps the switch readable.
  }
}
