/** @format */

/**
 * Keyboard + mouse handling, entirely renderer-local.
 *
 * Pascal reference: DebuggerUnit.pas `FormKeyPress` (~line 1033) and
 * `FormMouseDown` (~line 716). Every Pascal button has distinct left-click
 * (exclusive set) vs right-click (toggle) semantics — see Theory of
 * Operations §7.2.
 */

import {
  PANEL,
  BREAK_MAIN, BREAK_INT1, BREAK_INT2, BREAK_INT3,
  BREAK_DEBUG, BREAK_INT1E, BREAK_INT2E, BREAK_INT3E,
  BREAK_INIT, BREAK_EVENT, BREAK_ADDR,
  KEEP_INIT_MASK, CLEAR_DEBUG_MASK, KEEP_INIT_OR_DEBUG_MASK,
  STALL_CMD,
  CHAR_WIDTH_PX, HALF_ROW_PX, BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX,
  EVENT_NAMES, PTR_BYTES, PTR_CENTER,
  HUB_MAP_WIDTH, HUB_MAP_HEIGHT, HUB_SUB_BLOCK_SIZE, HUB_SUB_BLOCKS
} from '../shared/constants';
import { DebuggerState, DisMode } from './DebuggerState';
import { DebuggerController } from './DebuggerController';
import { DebuggerRenderer } from './DebuggerRenderer';

/**
 * Callbacks the interaction layer uses. Today only COGBRK broadcasting —
 * and even that is applied locally by the controller in the simple case;
 * the IPC round-trip is reserved for cross-window coordination (§3.9).
 */
export interface InteractionCallbacks {
  onCogBrkRequest: (mask: number) => void;
}

export class DebuggerInteraction {
  private canvas: HTMLCanvasElement;
  private state: DebuggerState;
  private renderer: DebuggerRenderer;
  private controller: DebuggerController;
  private cb: InteractionCallbacks;
  private goFlashTimer: ReturnType<typeof setInterval> | null = null;
  /** Latches for the duration of ONE physical right-press so the right-click
   *  action fires exactly once, then released on mouseup. macOS/Electron delivers
   *  TWO mousedown+contextmenu pairs per physical right-press (but only one
   *  mouseup) — a per-event suppress flag let the second mousedown fire the toggle
   *  a second time, cancelling the first (HW capture 2026-06-30, debug_260630-143127).
   *  Latching the whole gesture and releasing on the single mouseup fixes it. */
  private rightGestureLatched = false;

  constructor(
    canvas: HTMLCanvasElement,
    state: DebuggerState,
    renderer: DebuggerRenderer,
    controller: DebuggerController,
    cb: InteractionCallbacks
  ) {
    this.canvas = canvas;
    this.state = state;
    this.renderer = renderer;
    this.controller = controller;
    this.cb = cb;
    this.installListeners();
  }

  private installListeners(): void {
    // Keyboard (document-level so focus doesn't matter)
    document.addEventListener('keydown', (e) => this.handleKey(e));
    // Mouse
    // macOS/Electron delivers TWO mousedown+contextmenu pairs per single physical
    // right-press, but only ONE mouseup (HW capture 2026-06-30). Since every right
    // action is a TOGGLE, firing on each pair toggled twice → no net change ("right-
    // click does nothing" — the v0.9.83/.84 symptom). Fix: latch the right gesture
    // on the first right event and ignore further right mousedown/contextmenu until
    // the single mouseup releases the latch — so one physical press = one action.
    // Accept a right-click from mousedown (button 2, or Mac Ctrl+left) OR contextmenu
    // (some setups carry the button only there).
    const isMac = typeof navigator !== 'undefined' &&
      /mac/i.test(navigator.platform || navigator.userAgent || '');
    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = this.toCanvasPx(e);
      if (x < 0 || y < 0) return;
      const isRight = e.button === 2 || (isMac && e.button === 0 && e.ctrlKey);
      if (isRight) {
        if (!this.rightGestureLatched) {     // first event of this physical right-press
          this.rightGestureLatched = true;
          this.handleMouseDown(x, y, 2);
        }
        return;                              // ignore the duplicate pairs in the same gesture
      }
      this.rightGestureLatched = false;      // genuine left interaction; clear any stale latch
      if (e.button === 0) this.handleMouseDown(x, y, 0);
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();                    // always suppress the OS menu
      if (this.rightGestureLatched) return;  // same gesture already actioned via mousedown
      const { x, y } = this.toCanvasPx(e);
      if (x < 0 || y < 0) return;
      this.rightGestureLatched = true;       // contextmenu-only delivery: action here, latch the rest
      this.handleMouseDown(x, y, 2);
    });
    // Release the gesture latch on the single mouseup (also on mouseleave below, in
    // case the press is dragged off-canvas with no mouseup on the element).
    this.canvas.addEventListener('mouseup', () => { this.rightGestureLatched = false; });
    // Wheel (Ctrl/Shift modifiers). On macOS, Shift+wheel is delivered as a
    // HORIZONTAL scroll (deltaX) with deltaY≈0, so fold whichever axis carries
    // the motion into a single delta before applying the scroll matrix.
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { x, y } = this.toCanvasPx(e);
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      this.handleWheel(x, y, delta, e.ctrlKey, e.shiftKey);
    }, { passive: false });
    // Hover → hint bar.
    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this.toCanvasPx(e);
      this.updateHint(x, y);
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.rightGestureLatched = false;      // press dragged off-canvas; don't strand the latch
      this.renderer.hintText = '';
      this.renderer.render();
    });
  }

  /**
   * The canvas has CSS `width: 100%` so the displayed size may differ from
   * its internal resolution. Convert mouse coords to canvas pixel space.
   */
  private toCanvasPx(e: MouseEvent | WheelEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: -1, y: -1 };
    const scaleX = BITMAP_WIDTH_PX / rect.width;
    const scaleY = BITMAP_HEIGHT_PX / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    };
  }

  // ============================================================================
  // Keyboard — Pascal FormKeyPress semantics (DebuggerUnit.pas lines 1033-1089)
  // ============================================================================

  private handleKey(e: KeyboardEvent): void {
    const code = e.code;
    const shift = e.shiftKey;
    const ctrl = e.ctrlKey;

    // Tab capture (Pascal WMGetDlgCode + DLGC_WANTTAB, DebuggerUnit.pas ~L533):
    // swallow Tab so it cannot move keyboard focus off the debugger window.
    if (code === 'Tab') { e.preventDefault(); return; }

    // Letter / execution keys (Pascal uppercases all letter keys)
    let letter: string | null = null;
    if (code === 'Space')       letter = ' ';
    else if (code === 'Enter' || code === 'NumpadEnter') letter = '\n';
    else if (code.length === 4 && code.startsWith('Key')) letter = code.charAt(3);

    if (letter !== null) {
      e.preventDefault();
      switch (letter) {
        case ' ':  return this.onGoLeftClick();       // SPACE
        case '\n': return this.onGoRightClick();      // ENTER
        case 'B':  return this.onBreakLeftClick();    // B
        case 'I':  return this.onButtonRightClick('INIT');
        case 'D':  return this.onButtonRightClick('DEBUG');
        case 'M':  return this.onButtonRightClick('MAIN');
        case 'R':  return this.onResetWatch();
        default:   return;
      }
    }

    // Hub navigation
    if (code === 'ArrowUp')   { e.preventDefault(); this.navHub(-0x10);   return; }
    if (code === 'ArrowDown') { e.preventDefault(); this.navHub(+0x10);   return; }
    if (code === 'PageUp') {
      e.preventDefault();
      const d = shift ? 0x10000 : ctrl ? 0x1000 : 0x80;
      this.navHub(-d);
      return;
    }
    if (code === 'PageDown') {
      e.preventDefault();
      const d = shift ? 0x10000 : ctrl ? 0x1000 : 0x80;
      this.navHub(+d);
      return;
    }
  }

  // ============================================================================
  // Mouse — Pascal FormMouseDown dispatch (DebuggerUnit.pas lines 716-889)
  // ============================================================================

  private handleMouseDown(px: number, py: number, button: number): void {
    const rightClick = button === 2;

    // 1. Buttons
    const btnName = this.renderer.hitTestButton(px, py);
    if (btnName) {
      this.onButtonClick(btnName, !rightClick);
      return;
    }

    // 1b. Hub heat-map → jump the hub viewer to the clicked sub-block's address
    // (Pascal FormMouseDown InHubMap, DebuggerUnit.pas L968: HubAddr := MapHubAddr).
    // The map sits in the HUB panel's top-right; checked before the panel loop so a
    // map click isn't consumed by the HUB hex-column handler. Each pixel is one
    // 128-byte sub-block, row-major; cells past the firmware's sub-block count are
    // dim/unmapped and ignored.
    const map = this.renderer.hubMapBoundsPx();
    if (px >= map.x && px < map.x + map.w && py >= map.y && py < map.y + map.h) {
      // The 64×62 bitmap is StretchDraw'n across the (larger) map rect, so scale
      // the click back to bitmap cells (Pascal MapHubAddr, DebuggerUnit.pas:695-696).
      const col = Math.floor((px - map.x) * HUB_MAP_WIDTH / map.w);
      const row = Math.floor((py - map.y) * HUB_MAP_HEIGHT / map.h);
      const subBlock = row * HUB_MAP_WIDTH + col;
      if (subBlock < HUB_SUB_BLOCKS) {
        this.state.hubAddr = (subBlock * HUB_SUB_BLOCK_SIZE) & 0xFFFFF;
        this.renderer.render();
      }
      return;
    }

    // 2. Panel-specific click behaviors
    const panels: Array<[keyof typeof PANEL, (rx: number, ry: number, rc: boolean) => void]> = [
      ['REGMAP', (rx, ry, _rc) => this.onRegMapClick(rx, ry)],
      ['LUTMAP', (rx, ry, _rc) => this.onLutMapClick(rx, ry)],
      ['PC',     (_rx, _ry, _rc) => this.onPCClick()],
      ['DIS',    (_rx, ry, rc) => this.onDisassemblyClick(ry, rc)],
      ['WATCH',  (_rx, _ry, _rc) => this.onResetWatch()],
      ['SFR',    (_rx, ry, _rc) => this.onSFRClick(ry)],
      ['STACK',  (rx, _ry, _rc) => this.onStackClick(rx)],
      ['EVENT',  (_rx, ry, _rc) => this.onEventClick(ry)],
      ['PTR',    (rx, ry, _rc) => this.onPointerClick(rx, ry)],
      ['SMART',  (_rx, _ry, rc) => rc ? this.controller.toggleSmartPinDirFilter() : this.onResetSmartWatch()],
      ['HUB',    (rx, ry, _rc) => this.onHubClick(rx, ry)]
    ];

    for (const [name, handler] of panels) {
      const b = this.renderer.panelBoundsPx(name);
      if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) {
        handler(px - b.x, py - b.y, rightClick);
        this.renderer.render();
        return;
      }
    }
  }

  // ============================================================================
  // Wheel — Pascal scroll matrix (§8.3)
  // ============================================================================

  private handleWheel(px: number, py: number, deltaY: number, ctrl: boolean, shift: boolean): void {
    const direction = Math.sign(deltaY);
    // Magnitudes for cog/hub:   none=1/16   ctrl=4/1   shift=16/4   ctrl+shift=32/128
    let cogMag: number, hubMag: number;
    if (ctrl && shift) { cogMag = 32; hubMag = 128; }
    else if (shift)    { cogMag = 16; hubMag = 4; }
    else if (ctrl)     { cogMag = 4;  hubMag = 1; }
    else               { cogMag = 1;  hubMag = 16; }

    // In DIS panel → scroll disassembly, switching out of dmPC if needed
    const disBounds = this.renderer.panelBoundsPx('DIS');
    if (px >= disBounds.x && px < disBounds.x + disBounds.w &&
        py >= disBounds.y && py < disBounds.y + disBounds.h) {
      if (this.state.disMode === DisMode.dmPC) {
        // Switch to dmCog (cog-mode) or dmHub depending on current address
        this.state.disMode = this.state.pc >= 0x400 ? DisMode.dmHub : DisMode.dmCog;
      }
      const isHub = this.state.disMode === DisMode.dmHub;
      const step = isHub ? hubMag : cogMag;
      const mask = isHub ? 0xFFFFF : 0x3FF;
      this.state.disTopAddr = (this.state.disTopAddr + direction * step) & mask;
      this.renderer.render();
      return;
    }

    // In HUB panel
    const hubBounds = this.renderer.panelBoundsPx('HUB');
    if (px >= hubBounds.x && px < hubBounds.x + hubBounds.w &&
        py >= hubBounds.y && py < hubBounds.y + hubBounds.h) {
      // Over the 5-digit hub-address column (cols 0..4) → nibble wheel
      // (Pascal L1005: HubAddr += dir << (4*(4-digit))). Digit 0 = MS nibble.
      const col = Math.floor((px - hubBounds.x) / CHAR_WIDTH_PX);
      if (col >= 0 && col <= 4) {
        const shift = 4 * (4 - col);
        this.state.hubAddr = (this.state.hubAddr + (direction << shift)) & 0xFFFFF;
        this.renderer.render();
        return;
      }
      // Otherwise scroll the hub view.
      this.navHub(direction * hubMag * 16);
      return;
    }
  }

  // ============================================================================
  // Button click — maps to Pascal FormMouseDown bit-bashing
  // ============================================================================

  private onButtonClick(name: string, leftClick: boolean): void {
    if (name === 'GO') {
      if (leftClick) this.onGoLeftClick();
      else this.onGoRightClick();
      this.renderer.render();
      return;
    }
    if (leftClick) this.onButtonLeftClick(name);
    else this.onButtonRightClick(name);
    this.renderer.render();
  }

  /** L-click a condition button: clear-all-but-INIT then set this bit. */
  private onButtonLeftClick(name: string): void {
    const bv = this.state.breakValue;
    switch (name) {
      case 'MAIN':  this.controller.setBreakValue((bv & KEEP_INIT_MASK) | BREAK_MAIN); break;
      case 'INT1':  this.controller.setBreakValue((bv & KEEP_INIT_MASK) | BREAK_INT1); break;
      case 'INT2':  this.controller.setBreakValue((bv & KEEP_INIT_MASK) | BREAK_INT2); break;
      case 'INT3':  this.controller.setBreakValue((bv & KEEP_INIT_MASK) | BREAK_INT3); break;
      case 'DEBUG': this.controller.setBreakValue((bv & KEEP_INIT_MASK) | BREAK_DEBUG); break;
      case 'INT1E': this.controller.setBreakValue((bv & KEEP_INIT_MASK) | BREAK_INT1E); break;
      case 'INT2E': this.controller.setBreakValue((bv & KEEP_INIT_MASK) | BREAK_INT2E); break;
      case 'INT3E': this.controller.setBreakValue((bv & KEEP_INIT_MASK) | BREAK_INT3E); break;
      case 'INIT':  this.controller.setBreakValue(bv | BREAK_INIT); break;
      case 'EVENT': this.controller.setBreakValue(
        (bv & KEEP_INIT_MASK) | BREAK_EVENT | ((this.state.breakEvent & 0xF) << 12)); break;
      case 'ADDR':  this.controller.setBreakValue(
        (bv & KEEP_INIT_MASK) | BREAK_ADDR | ((this.state.breakAddr & 0xFFFFF) << 12)); break;
      case 'BREAK': this.onBreakLeftClick(); break;
    }
  }

  /** R-click a condition button: toggle with mutual-exclusion mask. */
  private onButtonRightClick(name: string): void {
    const bv = this.state.breakValue;
    switch (name) {
      case 'MAIN':  this.controller.setBreakValue((bv & CLEAR_DEBUG_MASK) ^ BREAK_MAIN); break;
      case 'INT1':  this.controller.setBreakValue((bv & CLEAR_DEBUG_MASK) ^ BREAK_INT1); break;
      case 'INT2':  this.controller.setBreakValue((bv & CLEAR_DEBUG_MASK) ^ BREAK_INT2); break;
      case 'INT3':  this.controller.setBreakValue((bv & CLEAR_DEBUG_MASK) ^ BREAK_INT3); break;
      case 'DEBUG': this.controller.setBreakValue((bv & KEEP_INIT_OR_DEBUG_MASK) ^ BREAK_DEBUG); break;
      case 'INT1E': this.controller.setBreakValue((bv & CLEAR_DEBUG_MASK) ^ BREAK_INT1E); break;
      case 'INT2E': this.controller.setBreakValue((bv & CLEAR_DEBUG_MASK) ^ BREAK_INT2E); break;
      case 'INT3E': this.controller.setBreakValue((bv & CLEAR_DEBUG_MASK) ^ BREAK_INT3E); break;
      case 'INIT':  this.controller.setBreakValue(bv ^ BREAK_INIT); break;
      case 'EVENT': {
        if ((bv & BREAK_EVENT) !== 0) this.controller.setBreakValue(bv & 0x00000DEF);
        else this.controller.setBreakValue((bv & 0x00000BEF) | BREAK_EVENT | ((this.state.breakEvent & 0xF) << 12));
        break;
      }
      case 'ADDR': {
        if ((bv & BREAK_ADDR) !== 0) this.controller.setBreakValue(bv & 0x00000BEF);
        else this.controller.setBreakValue((bv & 0x00000DEF) | BREAK_ADDR | ((this.state.breakAddr & 0xFFFFF) << 12));
        break;
      }
    }
    this.renderer.render();
  }

  // ============================================================================
  // Go button semantics (§7.3)
  // ============================================================================

  /**
   * Go when the cog is NOT halted at a breakpoint (Pascal DebuggerUnit.pas
   * L732-737: BreakpointTimer disabled ⇒ dimmed/free-running). Request an async
   * COGBRK for this cog instead of stepping. Returns true if it handled the click.
   */
  private goWhileRunning(): boolean {
    if (!this.state.isDimmed) return false;
    this.cb.onCogBrkRequest(1 << (this.state.cogId & 7));
    this.controller.setStallBrk(STALL_CMD);
    this.controller.setRepeatMode(false);
    this.renderer.render();
    return true;
  }

  /**
   * Pascal sets GoState := 2 on any Go-button mousedown (:729) and the redraw
   * inverts the button colors while GoState > 0, decrementing it on a ~100 ms
   * timer (:1784-1788 / FormButtonTimeout). Reproduce the press-flash here.
   */
  private triggerGoFlash(): void {
    this.state.goFlash = 2;
    this.renderer.render();
    if (this.goFlashTimer) clearInterval(this.goFlashTimer);
    this.goFlashTimer = setInterval(() => {
      if (this.state.goFlash > 0) this.state.goFlash--;
      this.renderer.render();
      if (this.state.goFlash <= 0 && this.goFlashTimer) {
        clearInterval(this.goFlashTimer);
        this.goFlashTimer = null;
      }
    }, 100);
  }

  private onGoLeftClick(): void {
    this.triggerGoFlash();
    if (this.goWhileRunning()) return;
    if (this.state.repeatMode) {
      // Stop repeat → halted
      this.controller.setRepeatMode(false);
    } else {
      // Single step: send breakValue once, then revert to STALL_CMD
      this.controller.setStallBrk(this.state.breakValue);
    }
    this.renderer.render();
  }

  private onGoRightClick(): void {
    this.triggerGoFlash();
    if (this.goWhileRunning()) return;
    if (this.state.repeatMode) {
      this.controller.setRepeatMode(false);
    } else {
      this.controller.setRepeatMode(true);
      this.controller.setStallBrk(this.state.breakValue);
    }
    this.renderer.render();
  }

  private onBreakLeftClick(): void {
    // Pascal: BreakValue := BreakValue and $00000100 — clear all but INIT.
    this.controller.setBreakValue(this.state.breakValue & KEEP_INIT_MASK);
    this.controller.setStallBrk(STALL_CMD);
    this.controller.setRepeatMode(false);
    this.renderer.render();
  }

  // ============================================================================
  // Panel clicks
  // ============================================================================

  private onPCClick(): void {
    this.state.disMode = DisMode.dmPC;
  }

  private onRegMapClick(_relX: number, relY: number): void {
    // Click locks dmCog to the register under cursor.
    const row = Math.floor(relY / (PANEL.REGMAP.h * HALF_ROW_PX / 512)); // 0..511
    this.state.disMode = DisMode.dmCog;
    this.state.disTopAddr = row & 0x1FF;
  }

  private onLutMapClick(_relX: number, relY: number): void {
    const row = Math.floor(relY / (PANEL.LUTMAP.h * HALF_ROW_PX / 512)); // 0..511
    this.state.disMode = DisMode.dmCog;
    this.state.disTopAddr = 0x200 + (row & 0x1FF);
  }

  private onDisassemblyClick(relY: number, rightClick: boolean): void {
    // Lines render at p.t + i*2 (no title offset — matches renderDisassembly).
    const lineIdx = Math.floor(relY / (2 * HALF_ROW_PX));
    if (lineIdx < 0 || lineIdx >= 16) return;
    const addr = this.renderer.disassemblyLineAddress(lineIdx);
    if (rightClick) {
      // Toggle address breakpoint at this line (Pascal lines 872-888).
      const bv = this.state.breakValue;
      if ((bv & BREAK_ADDR) !== 0 && this.state.breakAddr === addr) {
        this.controller.setBreakValue(bv & 0x00000BFF);
      } else {
        this.state.breakAddr = addr;
        this.controller.setBreakValue(
          (bv & 0x00000DFF) | BREAK_ADDR | ((addr & 0xFFFFF) << 12)
        );
      }
    } else {
      // L-click: lock to PC.
      this.state.disMode = DisMode.dmPC;
    }
  }

  private onSFRClick(relY: number): void {
    // Each SFR line is 2 half-rows = 16 px, starting at the panel top (p.t + i*2,
    // matches renderSFR). Rows 0..7 (left) + 8..15 (right) stack vertically.
    const row = Math.floor(relY / (2 * HALF_ROW_PX));
    if (row < 0 || row >= 16) return;
    const addr = 0x1F0 + row;
    const value = this.state.cogImage[addr];
    if (addr <= 0x1F5) {
      // IJMP/IRET → code pointer, lock disassembly there
      this.state.disMode = DisMode.dmCog;
      this.state.disTopAddr = value & 0xFFFFF;
    } else {
      // PA/PB/PTRA/PTRB/DIR/OUT/IN → hub pointer
      this.state.hubAddr = value & 0xFFFFF;
    }
  }

  private onStackClick(relX: number): void {
    const i = Math.floor((relX - 6 * CHAR_WIDTH_PX) / (CHAR_WIDTH_PX * 9)); // data at StackDataLeft (STACKl+6); 9 chars per slot
    if (i < 0 || i >= 8) return;
    const value = this.state.message[6 + i]; // mSTK0 + i
    if (value < 0x400) {
      this.state.disMode = DisMode.dmCog;
      this.state.disTopAddr = value;
    } else {
      this.state.hubAddr = value & 0xFFFFF;
    }
  }

  private onEventClick(relY: number): void {
    // Event rows render at p.t + i*2 (no title offset — matches renderEvents).
    const row = Math.floor(relY / (2 * HALF_ROW_PX));
    if (row < 1 || row > 15) return;
    this.state.breakEvent = row;
  }

  private onPointerClick(relX: number, relY: number): void {
    const row = Math.floor(relY / (2 * HALF_ROW_PX));
    if (row < 0 || row > 2) return;
    const ptrAddr = [this.state.message[15], this.state.message[16], this.state.message[17]][row] & 0xFFFFF;
    this.state.disMode = DisMode.dmHub;
    // Panel columns (mirror renderPointers): label@0, addr@5, 14 data bytes
    // ("XX ") @11, ascii @ 11 + 14*3 + 1. Clicking a data byte or its char
    // navigates to that byte's hub address, centered on PTR_CENTER
    // (Pascal L931-946: HubAddr := (ptr - PtrCenter) + byteIndex).
    const col = Math.floor(relX / CHAR_WIDTH_PX);
    const DATA_COL = 11;
    const CHR_COL = 11 + PTR_BYTES * 3 + 1;
    if (col >= DATA_COL && col < DATA_COL + PTR_BYTES * 3) {
      const byteIdx = Math.floor((col - DATA_COL) / 3);
      this.state.hubAddr = (ptrAddr - PTR_CENTER + byteIdx) & 0xFFFFF;
    } else if (col >= CHR_COL && col < CHR_COL + PTR_BYTES) {
      const charIdx = col - CHR_COL;
      this.state.hubAddr = (ptrAddr - PTR_CENTER + charIdx) & 0xFFFFF;
    } else {
      // Address column → navigate to the pointer address itself.
      this.state.hubAddr = ptrAddr;
    }
  }

  private onHubClick(relX: number, relY: number): void {
    // Hub rows start at the panel top (matches renderHub: p.t + r*2), so no
    // 2-half-row title offset is subtracted.
    const row = Math.floor(relY / (2 * HALF_ROW_PX));
    if (row < 0 || row > 7) return;
    // If click falls in the hex-byte area, compute which byte.
    const hexStartCol = 6; // after the 5-hex address
    const relCol = Math.floor(relX / CHAR_WIDTH_PX) - hexStartCol;
    if (relCol >= 0 && relCol < 48) {
      const byteIdx = Math.min(15, Math.floor(relCol / 3));
      this.state.hubAddr = ((this.state.hubAddr + row * 16 + byteIdx) & 0xFFFFF);
    }
  }

  // ============================================================================
  // Hub navigation
  // ============================================================================

  private navHub(delta: number): void {
    this.state.hubAddr = (this.state.hubAddr + delta) & 0xFFFFF;
    this.renderer.render();
  }

  private onResetWatch(): void {
    this.controller.resetRegisterWatch();
    this.renderer.render();
  }
  private onResetSmartWatch(): void {
    this.controller.resetSmartPinWatch();
    this.renderer.render();
  }

  // ============================================================================
  // Hint bar (hover)
  // ============================================================================

  private updateHint(px: number, py: number): void {
    let newHint = '';

    // Buttons
    const btn = this.renderer.hitTestButton(px, py);
    if (btn) {
      newHint = this.buttonHint(btn);
    } else {
      // Verbatim Pascal hint strings (DebuggerUnit.pas FormMouseMove MouseWithin
      // :638-690, plus the live CT/EVENT dynamic forms :1833/:654).
      const freqHz = this.state.message[18] || 1;
      const secs = Number(this.state.ctCounter) / freqHz;
      const ctHint = `Clock Ticks Since Reset | ${secs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} seconds at ${freqHz.toLocaleString()} Hz`;
      const regions: Array<[keyof typeof PANEL, string]> = [
        ['REGMAP', 'Cog Register Bitmap/Heatmap | Click to lock disassembly to REG subrange'],
        ['LUTMAP', 'LUT Register Bitmap/Heatmap | Click to lock disassembly to LUT subrange'],
        ['CF', 'Carry Flag'],
        ['ZF', 'Zero Flag'],
        ['PC', 'Program Counter | Click to lock disassembly to PC'],
        ['SKIP', 'Skip-Instruction Pattern'],
        ['XBYTE', this.xbyteModeHint()],
        ['CT', ctHint],
        ['DIS', 'L-Click to lock to PC | R-Click to toggle break address | Mousewheel {+Ctrl/Shift} scrolls'],
        ['WATCH', 'Register-Delta Watch List | Click or <R> to reset list'],
        ['SFR', 'Special-Function Registers'],
        ['EVENT', 'Event Flags'],
        ['EXEC', 'Instruction Disassembly'],
        ['STACK', 'Stack Registers (top..bottom)'],
        ['INT', 'Interrupt Status'],
        ['PTR', 'Pointers and Data'],
        ['STATUS', 'Indicators for COGINIT, STALLI, Streamer, Color Modulator, LUT sharing'],
        ['PIN', 'Pin Registers'],
        ['SMART', 'RQPIN-Delta Watch List | L-Click to reset list | R-Click to watch all/only pins with DIR set'],
        ['HUB', 'Hub Data | Mousewheel {+Ctrl/Shift} scrolls']
      ];
      for (const [name, text] of regions) {
        const b = this.renderer.panelBoundsPx(name);
        if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) {
          newHint = text;
          if (name === 'EVENT') {
            const row = Math.floor((py - b.y - 2 * HALF_ROW_PX) / (2 * HALF_ROW_PX));
            if (row >= 0 && row < 16) {
              newHint = `Event Flags | L-Click to break on ${EVENT_NAMES[row]} event | R-Click to toggle`;
            }
          }
          break;
        }
      }
    }

    if (newHint !== this.renderer.hintText) {
      this.renderer.hintText = newHint;
      this.renderer.render();
    }
  }

  /** XBYTE-box dynamic hint — decodes the XBYTE mode word (mBRKC bits 24..16).
   *  Verbatim port of Pascal DebuggerUnit.pas :1799-1825. */
  private xbyteModeHint(): string {
    const i = (this.state.message[2] >>> 16) & 0x1FF;
    const h = (v: number, n: number): string => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');
    let s = '';
    if ((i & 0x0FC) === 0x000)
      s = `8-bit mode | LUT ${h(i & 0x100, 3)}..${h((i & 0x100) | 0x0FF, 3)} uses full bytecode as offset`;
    else if ((i & 0x00C) === 0x000)
      s = `8-bit mode | LUT ${h(i & 0x100, 3)}..${h((i & 0x1F0) - 1, 3)} does 00..${h((i & 0x0F0) - 1, 2)} | LUT ${h(i & 0x1F0, 3)}..${h((i & 0x1F0) + 15 - ((i >> 4) & 0xF), 3)} compresses ${h((i >> 4) & 0xF, 1)}x..Fx`;
    else if ((i & 0x01E) === 0x004)
      s = `7-bit mode | LUT ${h(i & 0x180, 3)}..${h((i & 0x180) | 0x07F, 3)} uses bytecode.[6..0] as offset`;
    else if ((i & 0x01E) === 0x006)
      s = `7-bit mode | LUT ${h(i & 0x180, 3)}..${h((i & 0x180) | 0x07F, 3)} uses bytecode.[7..1] as offset`;
    else if ((i & 0x01E) === 0x014)
      s = `6-bit mode | LUT ${h(i & 0x1C0, 3)}..${h((i & 0x1C0) | 0x03F, 3)} uses bytecode.[5..0] as offset`;
    else if ((i & 0x01E) === 0x016)
      s = `6-bit mode | LUT ${h(i & 0x1C0, 3)}..${h((i & 0x1C0) | 0x03F, 3)} uses bytecode.[7..2] as offset`;
    else if ((i & 0x00E) === 0x008)
      s = `5-bit mode | LUT ${h(i & 0x1E0, 3)}..${h((i & 0x1E0) | 0x01F, 3)} uses bytecode.[4..0] as offset`;
    else if ((i & 0x00E) === 0x00A)
      s = `5-bit mode | LUT ${h(i & 0x1E0, 3)}..${h((i & 0x1E0) | 0x01F, 3)} uses bytecode.[7..3] as offset`;
    else if ((i & 0x00E) === 0x00C)
      s = `4-bit mode | LUT ${h(i & 0x1F0, 3)}..${h((i & 0x1F0) | 0x00F, 3)} uses bytecode.[3..0] as offset`;
    else if ((i & 0x00E) === 0x00E)
      s = `4-bit mode | LUT ${h(i & 0x1F0, 3)}..${h((i & 0x1F0) | 0x00F, 3)} uses bytecode.[7..4] as offset`;
    if ((i & 0x001) === 0x001) s += ' | C,Z affected';
    return 'XBYTE ' + s;
  }

  private buttonHint(name: string): string {
    // Verbatim Pascal (DebuggerUnit.pas :674-685; GO is dynamic :1908-1911).
    if (name === 'GO') {
      return this.state.repeatMode
        ? 'Click or <ENTER> to stop executing through breaks'
        : 'L-Click or <SPACE> to execute to next break | R-Click or <ENTER> to execute through breaks';
    }
    const hints: Record<string, string> = {
      BREAK: 'Click or <B> to select asynchronous BREAK | Another cog must be in DEBUG for BREAK to work',
      ADDR:  'L-Click to break on PC address | R-Click to toggle | R-Click in disassembly to set address',
      MAIN:  'L-Click to break on MAIN instructions (single-step) | R-Click or <M> to toggle',
      INT1:  'L-Click to break on INT1 instructions (single-step) | R-Click to toggle',
      INT2:  'L-Click to break on INT2 instructions (single-step) | R-Click to toggle',
      INT3:  'L-Click to break on INT3 instructions (single-step) | R-Click to toggle',
      DEBUG: 'L-Click to break on DEBUG | R-Click or <D> to toggle | DEBUG is exclusive to all but INIT',
      INT1E: 'L-Click to break on INT1 entry | R-Click to toggle',
      INT2E: 'L-Click to break on INT2 entry | R-Click to toggle',
      INT3E: 'L-Click to break on INT3 entry | R-Click to toggle',
      INIT:  'L-Click to break on COGINIT | R-Click or <I> to toggle | INIT is independent of all others',
      EVENT: 'L-Click to break on event | R-Click to toggle | Select event by clicking on CT1..QMT'
    };
    return hints[name] || '';
  }
}
