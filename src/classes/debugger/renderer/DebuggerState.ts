/** @format */

import {
  COG_BLOCKS,
  HUB_BLOCKS,
  REG_WATCH_SIZE,
  REG_WATCH_LIST_SIZE,
  SMART_PINS,
  SMART_WATCH_LIST_SIZE,
  COG_LUT_SIZE,
  HUB_SUB_BLOCK_SIZE,
  HUB_SUB_BLOCKS,
  BREAK_DEBUG,
  STALL_CMD
} from '../shared/constants';

/**
 * Per-cog debugger state — the single source of truth for everything the
 * renderer paints. Lives entirely on the renderer side.
 *
 * Fields map 1:1 to the Pascal `var` block in DebuggerUnit.pas (approximately
 * lines 178-297). Comments reference the Pascal variable name where useful.
 */
export interface RegisterWatchEntry {
  address: number;      // 0x000..0x1EF (496 watchable registers)
  value: number;        // last snapshot
  counter: number;      // Pascal 1000-decay counter
}

export interface SmartPinWatchEntry {
  pin: number;          // 0..61 (62/63 are TX/RX, excluded)
  value: number;        // last RQPIN readback
  counter: number;
}

export const enum DisMode {
  dmPC  = 0, // follow PC
  dmCog = 1, // cog-locked
  dmHub = 2  // hub-locked
}

export class DebuggerState {
  // ─── Identity ──────────────────────────────────────────────────────────
  readonly cogId: number;
  readonly debugBaud: number;

  // ─── Debugger 20-long message (latest) ─────────────────────────────────
  /** Raw longs from Phase 1 bytes 0..79. Indexed via M enum. */
  public message: Uint32Array = new Uint32Array(20);

  // ─── CRC snapshot — used to compute Phase 2 change bitmap ──────────────
  public cogCrc:    Uint16Array = new Uint16Array(COG_BLOCKS);
  public cogCrcOld: Uint16Array = new Uint16Array(COG_BLOCKS);
  public hubSum:    Uint16Array = new Uint16Array(HUB_BLOCKS);
  public hubSumOld: Uint16Array = new Uint16Array(HUB_BLOCKS);

  // ─── Hub sub-block heat (§6.18) ────────────────────────────────────────
  // Per-128-byte-sub-block checksums received in Phase 3, plus the previous
  // snapshot and a 0..254 heat value that flashes to 254 on change and decays
  // by HIT_DECAY_RATE each break — exactly like cogHit drives REG/LUT maps.
  // Pascal: HubSubBlock / HubSubBlockOld / HubSubBlockHit (init -1/-1/255).
  public hubSubBlock:    Int32Array = new Int32Array(HUB_SUB_BLOCKS).fill(-1);
  public hubSubBlockOld: Int32Array = new Int32Array(HUB_SUB_BLOCKS).fill(-1);
  public hubSubBlockHit: Uint8Array = new Uint8Array(HUB_SUB_BLOCKS).fill(255);

  // ─── Register + LUT memory (lazily filled from Phase 3) ────────────────
  /** COG[0..0x1FF] + LUT[0x200..0x3FF] = 1024 longs. */
  public cogImage: Uint32Array = new Uint32Array(COG_LUT_SIZE);
  /** Heat value per register, 0..254. Decays by HIT_DECAY_RATE per break. */
  public cogHit: Uint8Array = new Uint8Array(COG_LUT_SIZE);

  // ─── Hub memory (viewer + pointer windows + sub-block heat) ────────────
  public hubWindow: Uint8Array = new Uint8Array(HUB_SUB_BLOCK_SIZE);
  public fptrWindow: Uint8Array = new Uint8Array(14);
  public ptraWindow: Uint8Array = new Uint8Array(14);
  public ptrbWindow: Uint8Array = new Uint8Array(14);
  public disCode: Uint32Array = new Uint32Array(16); // 16 longs (when hub-exec)

  // ─── Register watch (§6.7) ─────────────────────────────────────────────
  public regWatchCounters: Uint16Array = new Uint16Array(REG_WATCH_SIZE);
  public regWatchPrevValues: Uint32Array = new Uint32Array(REG_WATCH_SIZE);
  public regWatchList: RegisterWatchEntry[] = [];
  public readonly regWatchListMax = REG_WATCH_LIST_SIZE;

  // ─── Smart pin watch (§6.16) ───────────────────────────────────────────
  public smartPinRqpin: Uint32Array = new Uint32Array(SMART_PINS);
  public smartWatchCounters: Uint16Array = new Uint16Array(SMART_PINS);
  public smartWatchPrevValues: Uint32Array = new Uint32Array(SMART_PINS);
  public smartWatchList: SmartPinWatchEntry[] = [];
  public smartWatchDirOnly: boolean = true;
  public readonly smartWatchListMax = SMART_WATCH_LIST_SIZE;

  // ─── State machine (§4) ────────────────────────────────────────────────
  /** BreakValue: what's sent via the Phase 2 stall/brk long to RESUME execution. */
  public breakValue: number = BREAK_DEBUG;
  /** StallBrk: the actual long we send next — STALL_CMD to hold, or breakValue to step. */
  public stallBrk: number = STALL_CMD;
  public repeatMode: boolean = false;
  /** Timestamp (Date.now ms) of the last Go command — used for 50 ms throttling. */
  public oldTickCount: number = 0;
  /** True until the first Phase 1 arrives; then we seed breakValue from mCOND. */
  public firstBreak: boolean = true;
  /** Timestamp of last Phase 1 — used for 250 ms dim-on-timeout. */
  public lastBreakTime: number = 0;
  /** True when display is dimmed due to breakpoint timeout. */
  public isDimmed: boolean = false;
  /** Go-button press-flash counter (Pascal GoState): >0 inverts the Go button
   *  colors for a couple of frames after a click. */
  public goFlash: number = 0;

  // ─── Breakpoint targets ────────────────────────────────────────────────
  /** Event index 1..15 for the EVENT break button. */
  public breakEvent: number = 1;
  /** 20-bit hub/cog address for the ADDR break button. */
  public breakAddr: number = 0;

  // ─── Disassembly view (§6.6) ───────────────────────────────────────────
  public disMode: DisMode = DisMode.dmPC;
  /** Scroll timer — counts consecutive breaks before auto-scroll activates. */
  public disScrollTimer: number = 0;

  // ─── Address model (Pascal CogAddr / HubAddr / DisAddr) ────────────────
  //
  // PNut has no separate "disassembly scroll position". It has two LOCKS and one
  // DERIVED value (audit Part A §A.0):
  //   CogAddr — the cog/LUT lock, used by dmCog.
  //   HubAddr — the hub lock, SHARED by the HUB data pane and dmHub disassembly,
  //             so scrolling either one moves the other. Load-bearing behavior.
  //   DisAddr — the address of the top displayed disassembly line. In dmPC it is
  //             DERIVED from the PC by the auto-scroll and is NEVER written back
  //             into either lock — otherwise the HUB pane would chase the program
  //             counter, which PNut never does.
  // The accessor below is what enforces all three rules; every reader and writer
  // goes through `disAddr` and lands in the right variable for the current mode.

  /** Cog/LUT lock address ($000..$3FF) — the dmCog disassembly top. */
  public cogAddr: number = 0;
  /** Top address of the hub data viewer, shared with dmHub disassembly (wraps at 0xFFFFF). */
  public hubAddr: number = 0;
  /** dmPC-only scroll position; dmCog/dmHub read through to the locks. */
  private disPcAddr: number = 0;

  /** Address of the top displayed disassembly line, per the current DisMode. */
  public get disAddr(): number {
    if (this.disMode === DisMode.dmCog) return this.cogAddr;
    if (this.disMode === DisMode.dmHub) return this.hubAddr;
    return this.disPcAddr;
  }
  public set disAddr(value: number) {
    if (this.disMode === DisMode.dmCog) this.cogAddr = value;
    else if (this.disMode === DisMode.dmHub) this.hubAddr = value;
    else this.disPcAddr = value;
  }

  // ─── COGBRK async break mask ───────────────────────────────────────────
  /** Bit N = ask for async break in cog N. Cleared after inclusion in Phase 2. */
  public requestCogBrk: number = 0;

  // ─── First-break flags for seeding the watch lists without false hits ──
  public regWatchFirstFill: boolean = true;
  public smartWatchFirstFill: boolean = true;

  // ─── Phase 2 request — remembered so Phase 3 knows what to parse ───────
  /** Indices of cog blocks we asked the P2 to send in Phase 3 (in order). */
  public pendingCogBlocks: number[] = [];
  /** Indices of hub blocks we asked for (for their sub-block checksums). */
  public pendingHubBlocks: number[] = [];
  /** Whether we asked for hub-code disassembly (16 longs). */
  public pendingHubCode: boolean = false;

  constructor(cogId: number, debugBaud: number) {
    this.cogId = cogId;
    this.debugBaud = debugBaud;
    // Initialize CRC-old to 0xFFFF so every block triggers on first break
    // (Pascal DebuggerUnit.pas line 546-547: CogBlock[i] := -1; HubBlock[i] := -1).
    this.cogCrcOld.fill(0xFFFF);
    this.hubSumOld.fill(0xFFFF);
  }

  /** Reset all state (called on DTR/RTS reset or new debug session). */
  public reset(): void {
    this.message.fill(0);
    this.cogCrc.fill(0);
    this.cogCrcOld.fill(0xFFFF);
    this.hubSum.fill(0);
    this.hubSumOld.fill(0xFFFF);
    this.hubSubBlock.fill(-1);
    this.hubSubBlockOld.fill(-1);
    this.hubSubBlockHit.fill(255);
    this.cogImage.fill(0);
    this.cogHit.fill(0);
    this.hubWindow.fill(0);
    this.fptrWindow.fill(0);
    this.ptraWindow.fill(0);
    this.ptrbWindow.fill(0);
    this.disCode.fill(0);
    this.regWatchCounters.fill(0);
    this.regWatchPrevValues.fill(0);
    this.regWatchList = [];
    this.smartPinRqpin.fill(0);
    this.smartWatchCounters.fill(0);
    this.smartWatchPrevValues.fill(0);
    this.smartWatchList = [];
    this.breakValue = BREAK_DEBUG;
    this.stallBrk = STALL_CMD;
    this.repeatMode = false;
    this.oldTickCount = 0;
    this.firstBreak = true;
    this.lastBreakTime = 0;
    this.isDimmed = false;
    this.goFlash = 0;
    this.breakEvent = 1;
    this.breakAddr = 0;
    this.disMode = DisMode.dmPC;
    this.disScrollTimer = 0;
    this.cogAddr = 0;
    this.hubAddr = 0;
    this.disPcAddr = 0;
    this.requestCogBrk = 0;
    this.regWatchFirstFill = true;
    this.smartWatchFirstFill = true;
  }

  // ─── Extracted getters for the common message bit-fields ──────────────

  /** Program counter (lowest 20 bits of mIRET). */
  public get pc(): number {
    return this.message[14 /* M.IRET */] & 0xFFFFF;
  }
  /** C flag (bit 31 of mIRET). */
  public get cFlag(): number {
    return (this.message[14] >>> 31) & 1;
  }
  /** Z flag (bit 30 of mIRET). */
  public get zFlag(): number {
    return (this.message[14] >>> 30) & 1;
  }
  /** Call depth (bits 31..28 of mBRKC). */
  public get callDepth(): number {
    return (this.message[2 /* M.BRKC */] >>> 28) & 0xF;
  }
  /** SKIP pattern (mBRKZ). */
  public get skipPattern(): number {
    return this.message[3 /* M.BRKZ */];
  }
  /** Event flags (low 16 bits of mBRKC). */
  public get eventFlags(): number {
    return this.message[2] & 0xFFFF;
  }
  /** XBYTE config (bits 24..16 of mBRKC). */
  public get xbyte(): number {
    return (this.message[2] >>> 16) & 0x1FF;
  }
  /** SKIPF mode flag. Pascal draws the 'F' (→ SKIPF) when mBRKC bit27 == 0
   *  (DebuggerUnit.pas:1416) — i.e. SKIPF is indicated by the bit being CLEAR. */
  public get isSkipf(): boolean {
    return ((this.message[2] >>> 27) & 1) === 0;
  }
  /** LUTS (LUT sharing) flag (bit 26 of mBRKC). */
  public get luts(): boolean {
    return ((this.message[2] >>> 26) & 1) !== 0;
  }
  /** INIT flag (bit 23 of mBRKCZ — COGINIT occurred). */
  public get initFlag(): boolean {
    return ((this.message[1] >>> 23) & 1) !== 0;
  }
  /** Streamer flag (bit 21 of mBRKCZ). */
  public get strFlag(): boolean {
    return ((this.message[1] >>> 21) & 1) !== 0;
  }
  /** Modulator flag (bit 22 of mBRKCZ). */
  public get modFlag(): boolean {
    return ((this.message[1] >>> 22) & 1) !== 0;
  }
  /** Stall interrupt flag (bit 1 of mBRKCZ). */
  public get stalliFlag(): boolean {
    return ((this.message[1] >>> 1) & 1) !== 0;
  }
  /** Execution mode 0-3 derived from interrupt-busy bits (§6.10). */
  public get execMode(): number {
    const brkcz = this.message[1];
    if (((brkcz >>> 2) & 3) === 3) return 1; // INT1 busy
    if (((brkcz >>> 4) & 3) === 3) return 2; // INT2 busy
    if (((brkcz >>> 6) & 3) === 3) return 3; // INT3 busy
    return 0; // MAIN
  }
  /** 64-bit CT counter as BigInt — safe for elapsed-time math. */
  public get ctCounter(): bigint {
    return (BigInt(this.message[4 /* M.CTH2 */]) << 32n) | BigInt(this.message[5 /* M.CTL2 */]);
  }
}
