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
  HUB_MAP_WIDTH, HUB_SUB_BLOCK_SIZE, HUB_SUB_BLOCKS
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
    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = this.toCanvasPx(e);
      if (x < 0 || y < 0) return;
      this.handleMouseDown(x, y, e.button);
    });
    // Context menu suppression so right-click reaches us.
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Wheel (Ctrl/Shift modifiers)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { x, y } = this.toCanvasPx(e);
      this.handleWheel(x, y, e.deltaY, e.ctrlKey, e.shiftKey);
    }, { passive: false });
    // Hover → hint bar.
    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this.toCanvasPx(e);
      this.updateHint(x, y);
    });
    this.canvas.addEventListener('mouseleave', () => {
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
      const col = Math.floor(px - map.x);
      const row = Math.floor(py - map.y);
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

  private onGoLeftClick(): void {
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
    const lineIdx = Math.floor((relY - 2 * HALF_ROW_PX) / (2 * HALF_ROW_PX));
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
    // Each SFR line is 2 half-rows = 16 px. Rows 0..7 (left) + 8..15 (right
    // column — we stack vertically so they're rows 16..31 in current impl).
    const row = Math.floor((relY - 2 * HALF_ROW_PX) / (2 * HALF_ROW_PX));
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
    const i = Math.floor(relX / (CHAR_WIDTH_PX * 9)); // 9 chars per stack slot
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
    const row = Math.floor((relY - 2 * HALF_ROW_PX) / (2 * HALF_ROW_PX));
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
    const row = Math.floor((relY - 2 * HALF_ROW_PX) / (2 * HALF_ROW_PX));
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
      // Check each panel
      const regions: Array<[keyof typeof PANEL, string]> = [
        ['REGMAP', 'COG register heat map — click to lock disassembly'],
        ['LUTMAP', 'LUT register heat map — click to lock disassembly'],
        ['CF', 'C flag (mIRET bit 31)'],
        ['ZF', 'Z flag (mIRET bit 30)'],
        ['PC',     'Program counter — click to follow PC'],
        ['SKIP',   'SKIP/SKIPF pattern (mBRKZ)'],
        ['XBYTE',  'XBYTE execution engine config'],
        ['CT',     `Elapsed: ${this.elapsedSeconds()} s @ ${(this.state.message[18] / 1e6).toFixed(1)} MHz`],
        ['DIS', this.state.disMode === DisMode.dmPC ? 'Disassembly (follow PC)' :
                 this.state.disMode === DisMode.dmCog ? 'Disassembly (cog locked)' :
                 'Disassembly (hub locked)'],
        ['WATCH',  'Register watch — click to reset'],
        ['SFR',    'Special function registers'],
        ['EVENT',  'Events — click to set BreakEvent'],
        ['EXEC',   'Current execution mode'],
        ['STACK',  'Hardware stack (STK0 = top)'],
        ['INT',    'Interrupt status'],
        ['PTR',    'Pointer data (FPTR/PTRA/PTRB)'],
        ['STATUS', 'Status indicators'],
        ['PIN',    'Pin registers (DIR/OUT/IN)'],
        ['SMART',  'Smart pin watch — L-click reset, R-click toggle DIR filter'],
        ['HUB',    `Hub address: $${this.state.hubAddr.toString(16).toUpperCase().padStart(5, '0')}`]
      ];
      for (const [name, text] of regions) {
        const b = this.renderer.panelBoundsPx(name);
        if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) {
          newHint = text;
          if (name === 'EVENT') {
            // Include specific event name
            const row = Math.floor((py - b.y - 2 * HALF_ROW_PX) / (2 * HALF_ROW_PX));
            if (row >= 0 && row < 16) newHint = `Event ${EVENT_NAMES[row]} (${row})`;
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

  private elapsedSeconds(): string {
    const ct = this.state.ctCounter;
    const freq = BigInt(this.state.message[18] || 1);
    if (freq === 0n) return '0.000000';
    // BigInt division with 6 decimals
    const micros = (ct * 1_000_000n) / freq;
    const whole = micros / 1_000_000n;
    const frac = micros % 1_000_000n;
    return `${whole.toString()}.${frac.toString().padStart(6, '0')}`;
  }

  private buttonHint(name: string): string {
    const hints: Record<string, string> = {
      GO:    'L-Click or SPACE to step | R-Click or ENTER for repeat',
      BREAK: 'Click or <B> to select async BREAK | another cog must be in DEBUG',
      ADDR:  'L-Click break on PC address | R-Click toggle | R-Click in disasm to set',
      MAIN:  'L-Click break on MAIN (single-step) | R-Click or <M> toggle',
      INT1:  'L-Click break on INT1 | R-Click toggle',
      INT2:  'L-Click break on INT2 | R-Click toggle',
      INT3:  'L-Click break on INT3 | R-Click toggle',
      DEBUG: 'L-Click break on DEBUG | R-Click or <D> toggle | exclusive to all but INIT',
      INT1E: 'L-Click break on INT1 entry | R-Click toggle',
      INT2E: 'L-Click break on INT2 entry | R-Click toggle',
      INT3E: 'L-Click break on INT3 entry | R-Click toggle',
      INIT:  'L-Click break on COGINIT | R-Click or <I> toggle | independent of others',
      EVENT: 'L-Click break on event | R-Click toggle | Select event by clicking CT1..QMT'
    };
    return hints[name] || '';
  }
}
