/** @format */

import {
  PHASE1_SIZE,
  PHASE2_SIZE,
  DEBUGGER_MSG_LONGS,
  COG_BLOCKS,
  HUB_BLOCKS,
  HUB_SUB_BLOCK_SIZE,
  PTR_BYTES,
  PTR_CENTER,
  DIS_LINES,
  M,
  STALL_CMD,
  BREAKPOINT_TIMEOUT_MS,
  REPEAT_THROTTLE_MS,
  HIT_DECAY_RATE
} from '../shared/constants';
import { DebuggerState, DisMode } from './DebuggerState';
import { DebuggerPhase3Parser } from './DebuggerPhase3';

/**
 * Callbacks the controller uses to talk back to main (Phase 2 bytes) and
 * to the renderer (request a repaint).
 */
export interface ControllerCallbacks {
  sendPhase2: (bytes: Uint8Array) => void;
  requestRender: () => void;
  onBreakpointTimeout: () => void;
  onPhase3Complete: () => void;
}

/**
 * Per-cog controller: owns the Phase 1 → Phase 2 exchange and the
 * state-machine transitions for a single debugger window.
 *
 * Flow per breakpoint:
 *   1. main forwards 456 Phase 1 bytes ─▶ processPhase1()
 *      ├─ parse 20-long message into state.message
 *      ├─ seed breakValue from mCOND on first break
 *      ├─ copy 64 CRC words + 124 hub checksums into state
 *      └─ build + send 52-byte Phase 2 reply
 *   2. Phase 3 bytes arrive (handled in Phase 3 of the implementation plan)
 *   3. renderer repaints from state
 *
 * Pascal reference: DebuggerUnit.pas `Breakpoint` procedure (starts ~line 1161).
 */
export class DebuggerController {
  private state: DebuggerState;
  private callbacks: ControllerCallbacks;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private phase3Parser: DebuggerPhase3Parser;

  constructor(state: DebuggerState, callbacks: ControllerCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
    this.phase3Parser = new DebuggerPhase3Parser(state);
  }

  /**
   * Consume a chunk of Phase 3 bytes. When the parser reports completion,
   * post-processing (heat decay, watch-list update) runs and the renderer
   * is asked for a repaint.
   */
  public processPhase3(bytes: Uint8Array): void {
    const complete = this.phase3Parser.addChunk(bytes);
    if (complete) {
      // Decay heat for any address we did NOT receive (those that weren't
      // set to 254 in this pass). Pascal: CogImageHit[i] -= HitDecayRate.
      for (let i = 0; i < this.state.cogHit.length; i++) {
        if (this.state.cogHit[i] > HIT_DECAY_RATE) {
          this.state.cogHit[i] -= HIT_DECAY_RATE;
        } else {
          this.state.cogHit[i] = 0;
        }
      }
      // Update register watch list (§6.7) — deferred to the renderer update
      // pass that owns the list data.
      this.updateRegisterWatch();
      this.updateSmartPinWatch();
      // Reset the parser for the next breakpoint exchange.
      this.phase3Parser.reset();
      // Notify main so it can flip awaitingPhase3 off.
      this.callbacks.onPhase3Complete();
      // Trigger a repaint now that all data is in.
      this.callbacks.requestRender();
    }
  }

  // ============================================================================
  // Phase 1 — incoming breakpoint packet
  // ============================================================================

  public processPhase1(bytes: Uint8Array): void {
    if (bytes.length !== PHASE1_SIZE) {
      throw new Error(`Phase 1 packet wrong size: got ${bytes.length}, expected ${PHASE1_SIZE}`);
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);

    // ─── Parse 20-long debugger message (bytes 0..79, little-endian) ────
    for (let i = 0; i < DEBUGGER_MSG_LONGS; i++) {
      this.state.message[i] = view.getUint32(i * 4, /* littleEndian */ true);
    }

    // ─── On the very first break, seed BreakValue from mCOND (§4 / Pascal) ─
    if (this.state.firstBreak) {
      this.state.breakValue = this.state.message[M.COND];
      this.state.firstBreak = false;
    }

    // ─── Parse 64 CRC words (bytes 80..207) ─────────────────────────────
    // Pascal shifts old→current here (DebuggerUnit.pas line 1188):
    //   CogBlockOld[i] := CogBlock[i]; CogBlock[i] := RWord;
    for (let i = 0; i < COG_BLOCKS; i++) {
      this.state.cogCrcOld[i] = this.state.cogCrc[i];
      this.state.cogCrc[i] = view.getUint16(80 + i * 2, true);
    }

    // ─── Parse 124 hub checksum words (bytes 208..455) ──────────────────
    for (let i = 0; i < HUB_BLOCKS; i++) {
      this.state.hubSumOld[i] = this.state.hubSum[i];
      this.state.hubSum[i] = view.getUint16(208 + i * 2, true);
    }

    // ─── Mark we got a breakpoint: restart the dim-on-timeout timer ─────
    this.state.lastBreakTime = Date.now();
    this.state.isDimmed = false;
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.timeoutHandle = setTimeout(() => {
      this.state.isDimmed = true;
      this.callbacks.onBreakpointTimeout();
    }, BREAKPOINT_TIMEOUT_MS);

    // ─── Build + send Phase 2 reply ─────────────────────────────────────
    const phase2 = this.buildPhase2();
    this.callbacks.sendPhase2(phase2);

    // ─── Ask renderer to repaint with new state ─────────────────────────
    this.callbacks.requestRender();
  }

  // ============================================================================
  // Phase 2 — outgoing request + stall/brk command
  // ============================================================================

  private buildPhase2(): Uint8Array {
    const buf = new Uint8Array(PHASE2_SIZE);
    const view = new DataView(buf.buffer);
    let offset = 0;

    // Remember what we request so Phase 3 parser knows the layout.
    const pendingCog: number[] = [];
    const pendingHub: number[] = [];

    // ─── 8 bytes: COG/LUT block request bitmap (64 bits, LSB-first) ─────
    //
    // Pascal DebuggerUnit.pas line 1305-1310:
    //   for i := 0 to CogBlocks - 1 do begin
    //     h := h shr 1;
    //     if CogBlock[i] <> CogBlockOld[i] then h := h or $80;
    //     if i and 7 = 7 then TByte(h);
    //   end;
    //
    // Pascal's shift-right-then-set-MSB is equivalent to our LSB-first pack:
    // after 8 iterations, bit k of the emitted byte corresponds to block k.
    for (let byteIdx = 0; byteIdx < 8; byteIdx++) {
      let h = 0;
      for (let bit = 0; bit < 8; bit++) {
        const idx = byteIdx * 8 + bit;
        if (this.state.cogCrc[idx] !== this.state.cogCrcOld[idx]) {
          h |= 1 << bit;
          pendingCog.push(idx);
        }
      }
      buf[offset++] = h;
    }

    // ─── 16 bytes: Hub block request bitmap (128 bits, LSB-first) ───────
    // Only 124 blocks; bits 124..127 stay zero.
    for (let byteIdx = 0; byteIdx < 16; byteIdx++) {
      let h = 0;
      for (let bit = 0; bit < 8; bit++) {
        const idx = byteIdx * 8 + bit;
        if (idx < HUB_BLOCKS && this.state.hubSum[idx] !== this.state.hubSumOld[idx]) {
          h |= 1 << bit;
          pendingHub.push(idx);
        }
      }
      buf[offset++] = h;
    }

    // Save the request so Phase 3 parser can use the same indices.
    this.state.pendingCogBlocks = pendingCog;
    this.state.pendingHubBlocks = pendingHub;
    this.state.pendingHubCode = (this.computeHubCodeRequest() >>> 20) !== 0;

    // ─── 5 longs: hub read requests (size<<20 | address) ────────────────
    // Disassembly — only if we're displaying hub-execute code.
    const hubCodeRequest = this.computeHubCodeRequest();
    view.setUint32(offset, hubCodeRequest, true); offset += 4;

    // FPTR pointer window (14 bytes centered on FPTR).
    const fptrAddr = (this.state.message[M.FPTR] - PTR_CENTER) & 0xFFFFF;
    view.setUint32(offset, (PTR_BYTES << 20) | fptrAddr, true); offset += 4;

    // PTRA pointer window.
    const ptraAddr = (this.state.message[M.PTRA] - PTR_CENTER) & 0xFFFFF;
    view.setUint32(offset, (PTR_BYTES << 20) | ptraAddr, true); offset += 4;

    // PTRB pointer window.
    const ptrbAddr = (this.state.message[M.PTRB] - PTR_CENTER) & 0xFFFFF;
    view.setUint32(offset, (PTR_BYTES << 20) | ptrbAddr, true); offset += 4;

    // Hub data viewer (128 bytes starting at hubAddr).
    view.setUint32(offset, (HUB_SUB_BLOCK_SIZE << 20) | (this.state.hubAddr & 0xFFFFF), true);
    offset += 4;

    // ─── 1 long: COGBRK mask ────────────────────────────────────────────
    view.setUint32(offset, this.state.requestCogBrk, true); offset += 4;
    // Cleared after inclusion (Pascal DebuggerUnit.pas line 1326: RequestCOGBRK := 0).
    this.state.requestCogBrk = 0;

    // ─── 1 long: STALL/BRK command ──────────────────────────────────────
    // In repeat mode: throttle to ≤ 20 Hz; otherwise send whatever stallBrk
    // is set to and auto-revert to STALL_CMD for the next exchange.
    let outgoing = this.state.stallBrk;
    if (this.state.repeatMode) {
      const now = Date.now();
      if (now - this.state.oldTickCount < REPEAT_THROTTLE_MS) {
        outgoing = STALL_CMD;
      } else {
        outgoing = this.state.breakValue;
        this.state.oldTickCount = now;
      }
    } else {
      // Single-go: one resume, then back to stall.
      this.state.stallBrk = STALL_CMD;
    }
    view.setUint32(offset, outgoing, true); offset += 4;

    if (offset !== PHASE2_SIZE) {
      throw new Error(`Phase 2 build produced ${offset} bytes, expected ${PHASE2_SIZE}`);
    }
    return buf;
  }

  /**
   * Return (byteCount<<20)|address for the disassembly read request, or 0 if
   * we're in cog-execute mode (PC < 0x400) or dmCog/dmHub follows a cog addr.
   *
   * Pascal DebuggerUnit.pas line 1319:
   *   if GetHubCode then TLong(DisLines shl 2 shl 20 + CurDisAddr) else TLong(0)
   * where GetHubCode := (DisMode = dmPC) and not PCInCog, plus dmHub case.
   */
  private computeHubCodeRequest(): number {
    const { disMode, disTopAddr, pc } = this.state;
    const wantHub =
      (disMode === DisMode.dmPC && pc >= 0x400) ||
      (disMode === DisMode.dmHub);
    if (!wantHub) return 0;
    const bytes = DIS_LINES * 4; // 16 longs
    return (bytes << 20) | (disTopAddr & 0xFFFFF);
  }

  // ============================================================================
  // User-driven state-machine commands (triggered from DebuggerInteraction)
  // ============================================================================

  /** Set the stall/brk long for the NEXT Phase 2 exchange. */
  public setStallBrk(value: number): void {
    this.state.stallBrk = value >>> 0;
  }

  /** Set breakValue (the "resume with these break conditions" word). */
  public setBreakValue(value: number): void {
    this.state.breakValue = value >>> 0;
  }

  /** Enter/leave repeat mode. */
  public setRepeatMode(on: boolean): void {
    this.state.repeatMode = on;
    if (on) {
      this.state.oldTickCount = Date.now();
    } else {
      this.state.stallBrk = STALL_CMD;
    }
  }

  /** OR a mask into the COGBRK request (included in next Phase 2). */
  public orCogBrk(mask: number): void {
    this.state.requestCogBrk = (this.state.requestCogBrk | mask) >>> 0;
  }

  /** Invalidate state on DTR/RTS reset. */
  public reset(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.phase3Parser.reset();
    this.state.reset();
  }

  /** L-click on WATCH box, or <R> key. */
  public resetRegisterWatch(): void {
    this.state.regWatchList = [];
    this.state.regWatchCounters.fill(0);
    this.state.regWatchFirstFill = true;
  }

  /** L-click on SMART box. */
  public resetSmartPinWatch(): void {
    this.state.smartWatchList = [];
    this.state.smartWatchCounters.fill(0);
    this.state.smartWatchFirstFill = true;
  }

  /** R-click on SMART box — toggle DIR-only filter. */
  public toggleSmartPinDirFilter(): void {
    this.state.smartWatchDirOnly = !this.state.smartWatchDirOnly;
  }

  // ─── Register watch-list delta tracking (§6.7) ────────────────────────
  //
  // Pascal algorithm (DebuggerUnit.pas ~line 1558):
  //   For each of 496 watchable cog registers (0x000..0x1EF):
  //     if value changed → counter := 1000
  //     else if counter > 1 → counter := counter - 1
  //   For each register with counter > 0:
  //     find in visible list by address, or replace oldest entry
  //
  // On first pass we avoid triggering watches for ALL non-zero registers
  // by populating prev-values without setting any counters.

  private updateRegisterWatch(): void {
    const { regWatchPrevValues, regWatchCounters, cogImage } = this.state;
    const WATCH_MAX_ADDR = regWatchPrevValues.length;

    if (this.state.regWatchFirstFill) {
      // Seed prev-values only — no watches triggered on first break.
      for (let a = 0; a < WATCH_MAX_ADDR; a++) {
        regWatchPrevValues[a] = cogImage[a];
      }
      this.state.regWatchFirstFill = false;
      return;
    }

    // Step 1: update counters
    for (let a = 0; a < WATCH_MAX_ADDR; a++) {
      if (cogImage[a] !== regWatchPrevValues[a]) {
        regWatchCounters[a] = 1000;
        regWatchPrevValues[a] = cogImage[a];
      } else if (regWatchCounters[a] > 1) {
        regWatchCounters[a]--;
      }
    }

    // Step 2: insert / refresh visible list — keep the 16 highest-counter
    // entries. We scan once, maintain a sorted-by-counter array.
    const active: Array<{ address: number; value: number; counter: number }> = [];
    for (let a = 0; a < WATCH_MAX_ADDR; a++) {
      if (regWatchCounters[a] > 0) {
        active.push({ address: a, value: cogImage[a], counter: regWatchCounters[a] });
      }
    }
    active.sort((x, y) => y.counter - x.counter);
    this.state.regWatchList = active.slice(0, this.state.regWatchListMax);
  }

  // ─── Smart-pin watch-list delta tracking (§6.16) ──────────────────────

  private updateSmartPinWatch(): void {
    const { smartWatchPrevValues, smartWatchCounters, smartPinRqpin, cogImage } = this.state;
    // DIR-only filter uses DIRA/DIRB at cog addresses 0x1FA/0x1FB.
    const dira = cogImage[0x1FA];
    const dirb = cogImage[0x1FB];
    const dirMask = (pin: number): boolean => {
      if (pin < 32) return ((dira >>> pin) & 1) !== 0;
      return ((dirb >>> (pin - 32)) & 1) !== 0;
    };
    // Excluded pins are TX/RX (typically 62/63 — we skip them always).
    const EXCLUDE_HIGH = 62;

    if (this.state.smartWatchFirstFill) {
      for (let p = 0; p < smartWatchPrevValues.length; p++) {
        smartWatchPrevValues[p] = smartPinRqpin[p];
      }
      this.state.smartWatchFirstFill = false;
      return;
    }

    for (let p = 0; p < smartWatchPrevValues.length; p++) {
      if (p >= EXCLUDE_HIGH) { smartWatchCounters[p] = 0; continue; }
      if (this.state.smartWatchDirOnly && !dirMask(p)) {
        // Still update prev-values so DIR flip doesn't trigger a false hit later.
        smartWatchPrevValues[p] = smartPinRqpin[p];
        smartWatchCounters[p] = 0;
        continue;
      }
      if (smartPinRqpin[p] !== smartWatchPrevValues[p]) {
        smartWatchCounters[p] = 1000;
        smartWatchPrevValues[p] = smartPinRqpin[p];
      } else if (smartWatchCounters[p] > 1) {
        smartWatchCounters[p]--;
      }
    }

    const active: Array<{ pin: number; value: number; counter: number }> = [];
    for (let p = 0; p < smartWatchPrevValues.length; p++) {
      if (smartWatchCounters[p] > 0) {
        active.push({ pin: p, value: smartPinRqpin[p], counter: smartWatchCounters[p] });
      }
    }
    active.sort((x, y) => y.counter - x.counter);
    this.state.smartWatchList = active.slice(0, this.state.smartWatchListMax);
  }
}
