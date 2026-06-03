/** @format */

/**
 * DebuggerRenderer — paints all 22 Pascal panels to the canvas.
 *
 * Architecture:
 *   - Constructor caches an OffscreenCanvas "base template" with static
 *     elements (panel outlines, region labels) — matches Pascal Bitmap[2].
 *   - render() is called on every state change. It:
 *       1. Restores the base template (instant).
 *       2. Paints every dynamic panel in Pascal's §5.8 order.
 *       3. Overlays a translucent dim if state.isDimmed.
 *
 * Coordinate system (from DOCs/pascal-REF/SingleStep-Debugger-Theory-of-Operations.md
 * §5.3): grid is 123 columns × 77 half-rows. Each column = 8 px; each half-row
 * = 8 px. Text rows occupy 2 half-rows (16 px tall) — so a text line at grid
 * Y `t` has pixel Y = `t * 8`, and the next text line is at `t + 2`.
 *
 * Every panel renderer in this file references Pascal line numbers where
 * non-trivial so divergences from Pascal can be caught by spot-reading the
 * reference.
 */

import {
  PANEL,
  BITMAP_WIDTH_PX,
  BITMAP_HEIGHT_PX,
  CHAR_WIDTH_PX,
  HALF_ROW_PX,
  CHAR_HEIGHT_PX,
  COLOR,
  SFR_NAMES,
  EVENT_NAMES,
  EXEC_MODE_NAMES,
  ROM_DEBUG_STRINGS,
  BREAK_MAIN,
  BREAK_INT1,
  BREAK_INT2,
  BREAK_INT3,
  BREAK_DEBUG,
  BREAK_INT1E,
  BREAK_INT2E,
  BREAK_INT3E,
  BREAK_INIT,
  BREAK_EVENT,
  BREAK_ADDR,
  PTR_BYTES,
  PTR_CENTER,
  DIS_LINES,
  DIS_LINE_IDEAL,
  DIS_SCROLL_THRESHOLD,
  HUB_MAP_WIDTH,
  HUB_MAP_HEIGHT,
  BUTTONS
} from '../shared/constants';
import { DebuggerState, DisMode } from './DebuggerState';
import { Pasm2Disassembler } from './pasm2Disassembler';

/** Bitwise helper — pad hex with leading zeros, optional uppercase. */
function hex(value: number, digits: number): string {
  return (value >>> 0).toString(16).padStart(digits, '0').toUpperCase();
}

/** 0xRRGGBB → "#RRGGBB" for ctx.fillStyle. */
function rgb(color: number): string {
  return '#' + (color & 0xFFFFFF).toString(16).padStart(6, '0');
}

/** Gamma-2.0 blend: sqrt((dst² * (255-a) + src² * a) / 256). Matches Pascal SmoothPixel (§5.7). */
function blendGamma2(dst: number, src: number, alpha: number): number {
  const notA = 255 - alpha;
  const b = (dstC: number, srcC: number) =>
    Math.round(Math.sqrt((dstC * dstC * notA + srcC * srcC * alpha) / 256));
  const r = b((dst >> 16) & 0xFF, (src >> 16) & 0xFF);
  const g = b((dst >> 8) & 0xFF, (src >> 8) & 0xFF);
  const bl = b(dst & 0xFF, src & 0xFF);
  return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (bl & 0xFF);
}

/** ASCII-or-dot for pointer / hub bytes. */
function ascii(byte: number): string {
  return byte >= 0x20 && byte <= 0x7E ? String.fromCharCode(byte) : '.';
}

/**
 * Decide whether a disassembly line should be drawn with a SKIP strikethrough
 * (§6.6). True when SKIP is active and this instruction's offset from the PC
 * (0..31, where each cog long is 1 step and each hub long is 4 bytes) has its
 * bit set in the SKIP pattern (mBRKZ). Lines drawn for cog addresses while the
 * window is in hub mode (`hiddenPC`) are never struck.
 * Mirrors Pascal DebuggerUnit.pas L1530-1532. Pure + exported for §3 tests.
 *
 * @param skipOn  ExecMode == 0 && CallDepth == 0 (SKIP genuinely in effect).
 */
export function shouldStrikeSkipped(
  addr: number,
  pc: number,
  skipOn: boolean,
  skipPattern: number,
  hiddenPC: boolean
): boolean {
  if (!skipOn || hiddenPC) return false;
  const j = addr < 0x400 ? addr - pc : Math.trunc((addr - pc) / 4);
  if (j < 0 || j > 31) return false;
  return ((skipPattern >>> j) & 1) !== 0;
}

export class DebuggerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: DebuggerState;
  private base: OffscreenCanvas | null = null;
  private baseCtx: OffscreenCanvasRenderingContext2D | null = null;
  private disasm = new Pasm2Disassembler();   // full PASM2 decoder (§4/§5)

  // Pre-rendered 32×512 RGBA bitmaps for REG and LUT heat maps. We mutate
  // these per frame in-place and StretchDraw them into the panel region.
  private regMapBmp: ImageData;
  private lutMapBmp: ImageData;
  private regMapCanvas: OffscreenCanvas;
  private lutMapCanvas: OffscreenCanvas;
  private regMapCtx: OffscreenCanvasRenderingContext2D;
  private lutMapCtx: OffscreenCanvasRenderingContext2D;

  // Hub heat map — 64 × 62 pixels, one per 128-byte sub-block.
  private hubMapBmp: ImageData;
  private hubMapCanvas: OffscreenCanvas;
  private hubMapCtx: OffscreenCanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, state: DebuggerState) {
    this.canvas = canvas;
    this.state = state;
    this.canvas.width = BITMAP_WIDTH_PX;
    this.canvas.height = BITMAP_HEIGHT_PX;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to get 2D context on canvas');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    // Heat-map bitmaps
    this.regMapCanvas = new OffscreenCanvas(32, 512);
    this.lutMapCanvas = new OffscreenCanvas(32, 512);
    this.regMapCtx = this.regMapCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    this.lutMapCtx = this.lutMapCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    this.regMapBmp = this.regMapCtx.createImageData(32, 512);
    this.lutMapBmp = this.lutMapCtx.createImageData(32, 512);

    this.hubMapCanvas = new OffscreenCanvas(64, 62);
    this.hubMapCtx = this.hubMapCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    this.hubMapBmp = this.hubMapCtx.createImageData(64, 62);

    this.buildBaseTemplate();
  }

  // ──────────────────────────────────────────────────────────────────────
  // Coordinate & drawing primitives
  // ──────────────────────────────────────────────────────────────────────

  /** Convert grid column to pixel X. */
  private px(col: number): number { return col * CHAR_WIDTH_PX; }
  /** Convert grid half-row to pixel Y. */
  private py(halfRow: number): number { return halfRow * HALF_ROW_PX; }

  /**
   * Draw text at grid (col, halfRow). Text is CHAR_HEIGHT (16) tall so it
   * occupies 2 half-rows. Callers usually increment halfRow by 2 for the
   * next text line.
   */
  private drawText(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    text: string, col: number, halfRow: number,
    color: number, bold: boolean = false
  ): void {
    ctx.font = `${bold ? 'bold ' : ''}14px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = rgb(color);
    ctx.fillText(text, this.px(col), this.py(halfRow));
  }

  /** Stroke a rectangular box at grid (col, halfRow) with (w, h) in chars/half-rows. */
  private drawBox(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    col: number, halfRow: number, wCols: number, hHalfRows: number, color: number
  ): void {
    ctx.strokeStyle = rgb(color);
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.px(col) + 0.5, this.py(halfRow) + 0.5,
      wCols * CHAR_WIDTH_PX - 1, hHalfRows * HALF_ROW_PX - 1
    );
  }

  /** Fill a rectangular region. */
  private fillRect(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    col: number, halfRow: number, wCols: number, hHalfRows: number, color: number
  ): void {
    ctx.fillStyle = rgb(color);
    ctx.fillRect(this.px(col), this.py(halfRow), wCols * CHAR_WIDTH_PX, hHalfRows * HALF_ROW_PX);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Base template (Pascal: DrawBaseBitmap / Bitmap[2])
  // ──────────────────────────────────────────────────────────────────────

  private buildBaseTemplate(): void {
    this.base = new OffscreenCanvas(BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX);
    const bc = this.base.getContext('2d') as OffscreenCanvasRenderingContext2D;
    this.baseCtx = bc;

    // Fill background
    bc.fillStyle = rgb(COLOR.cBackground);
    bc.fillRect(0, 0, BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX);

    // Draw panel borders — Pascal uses cBox / cBox2 / cBox3 selectively.
    // Primary (cBox) for most; cBox2 for DIS / HINT; cBox3 for CT.
    const primary   = COLOR.cBox;
    const secondary = COLOR.cBox2;
    const tertiary  = COLOR.cBox3;
    const boxPanels: Array<[keyof typeof PANEL, number]> = [
      ['REGMAP', primary],
      ['LUTMAP', primary],
      ['CF', primary],
      ['ZF', primary],
      ['PC', primary],
      ['SKIP', primary],
      ['XBYTE', primary],
      ['CT', tertiary],
      ['DIS', secondary],
      ['WATCH', primary],
      ['SFR', primary],
      ['EVENT', primary],
      ['EXEC', primary],
      ['INT', primary],
      ['PTR', primary],
      ['STATUS', primary],
      ['PIN', primary],
      ['SMART', primary],
      ['HUB', primary],
      ['HINT', secondary],
      ['B', primary]
    ];
    for (const [panel, color] of boxPanels) {
      const p = PANEL[panel];
      this.drawBox(bc, p.l, p.t, p.w, p.h, color);
    }
    // STACK has no explicit border per Pascal (it's a horizontal row).
  }

  // ──────────────────────────────────────────────────────────────────────
  // Main render — called once per state change
  // ──────────────────────────────────────────────────────────────────────

  public render(): void {
    // 1. Restore base template (Pascal: Bitmap[0].Canvas.Draw(0, 0, Bitmap[2])).
    if (this.base) {
      this.ctx.drawImage(this.base, 0, 0);
    } else {
      this.ctx.fillStyle = rgb(COLOR.cBackground);
      this.ctx.fillRect(0, 0, BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX);
    }

    if (this.state.firstBreak) {
      this.drawText(this.ctx, 'Debugger — Cog ' + this.state.cogId + '  (awaiting first breakpoint)',
        PANEL.DIS.l + 1, PANEL.DIS.t + 1, COLOR.cName, true);
      return;
    }

    // Pascal Section 5.8 drawing order.
    this.renderCFlag();
    this.renderZFlag();
    this.renderPC();
    this.renderSkip();
    this.renderXByte();
    this.renderCT();
    this.renderSFR();
    this.renderEvents();
    this.renderExec();
    this.renderStack();
    this.renderInterrupts();
    this.renderPointers();
    this.renderStatus();
    this.renderPins();
    this.renderHub();
    this.renderDisassembly();
    this.renderRegisterWatch();
    this.renderSmartPinWatch();
    this.renderRegMap();
    this.renderLutMap();
    this.renderHubMap();
    this.renderButtons();
    this.renderHint();

    // 2. Dim overlay if 250 ms without a new break.
    if (this.state.isDimmed) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.ctx.fillRect(0, 0, BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.1 — REG / LUT heat-map bitmaps
  // ──────────────────────────────────────────────────────────────────────
  //
  // Each 32-wide pixel row represents one register: columns 0..31 = bits
  // 31..0 (MSB left). Color blends between same/diff based on cogHit[].

  private paintHeatBitmap(bmp: ImageData, addrBase: number): void {
    const pixels = bmp.data;
    const cogImage = this.state.cogImage;
    const cogHit = this.state.cogHit;
    for (let row = 0; row < 512; row++) {
      const addr = addrBase + row;
      if (addr >= cogImage.length) break;
      const value = cogImage[addr];
      const hit = cogHit[addr]; // 0..254
      for (let col = 0; col < 32; col++) {
        // MSB at col 0, LSB at col 31.
        const bit = (value >>> (31 - col)) & 1;
        const same = bit ? COLOR.cHighSame : COLOR.cLowSame;
        const diff = bit ? COLOR.cHighDiff : COLOR.cLowDiff;
        const c = blendGamma2(same, diff, hit);
        const idx = (row * 32 + col) * 4;
        pixels[idx]     = (c >> 16) & 0xFF;
        pixels[idx + 1] = (c >> 8) & 0xFF;
        pixels[idx + 2] = c & 0xFF;
        pixels[idx + 3] = 0xFF;
      }
    }
  }

  private renderRegMap(): void {
    this.paintHeatBitmap(this.regMapBmp, 0x000);
    this.regMapCtx.putImageData(this.regMapBmp, 0, 0);
    const p = PANEL.REGMAP;
    // StretchDraw from 32×512 into the panel interior (inside the border).
    this.ctx.drawImage(
      this.regMapCanvas,
      this.px(p.l) + 1, this.py(p.t) + 1,
      p.w * CHAR_WIDTH_PX - 2, p.h * HALF_ROW_PX - 2
    );
  }

  private renderLutMap(): void {
    this.paintHeatBitmap(this.lutMapBmp, 0x200);
    this.lutMapCtx.putImageData(this.lutMapBmp, 0, 0);
    const p = PANEL.LUTMAP;
    this.ctx.drawImage(
      this.lutMapCanvas,
      this.px(p.l) + 1, this.py(p.t) + 1,
      p.w * CHAR_WIDTH_PX - 2, p.h * HALF_ROW_PX - 2
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.2 — C Flag, Z Flag, PC
  // ──────────────────────────────────────────────────────────────────────

  private renderCFlag(): void {
    const p = PANEL.CF;
    this.drawText(this.ctx, 'C', p.l, p.t, COLOR.cName, true);
    this.drawText(this.ctx, String(this.state.cFlag), p.l + 2, p.t, COLOR.cData, true);
  }
  private renderZFlag(): void {
    const p = PANEL.ZF;
    this.drawText(this.ctx, 'Z', p.l, p.t, COLOR.cName, true);
    this.drawText(this.ctx, String(this.state.zFlag), p.l + 2, p.t, COLOR.cData, true);
  }
  private renderPC(): void {
    const p = PANEL.PC;
    this.drawText(this.ctx, 'PC', p.l, p.t, COLOR.cName, true);
    this.drawText(this.ctx, hex(this.state.pc, 5), p.l + 3, p.t, COLOR.cData, true);
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.3 — SKIP / SKIPF pattern, with "Suspended" overrides
  // ──────────────────────────────────────────────────────────────────────

  private renderSkip(): void {
    const p = PANEL.SKIP;
    const label = this.state.isSkipf ? 'SKIPF' : 'SKIP';
    const callDepth = this.state.callDepth;
    const execMode = this.state.execMode;
    const active = execMode === 0 && callDepth === 0;

    this.drawText(this.ctx, label, p.l, p.t, active ? COLOR.cName : COLOR.cDataDim, true);

    if (!active) {
      const why = execMode !== 0
        ? `Suspended during ${EXEC_MODE_NAMES[execMode]}`
        : `Suspended during CALL(${callDepth})`;
      this.drawText(this.ctx, why, p.l + 6, p.t, COLOR.cDataDim);
      return;
    }

    // 32-bit pattern, MSB on left.
    const pattern = this.state.skipPattern;
    let bits = '';
    for (let i = 31; i >= 0; i--) bits += ((pattern >>> i) & 1).toString();
    this.drawText(this.ctx, bits, p.l + 6, p.t, COLOR.cData);
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.4 — XBYTE
  // ──────────────────────────────────────────────────────────────────────

  private renderXByte(): void {
    const p = PANEL.XBYTE;
    this.drawText(this.ctx, 'XBYTE', p.l, p.t, COLOR.cName, true);
    this.drawText(this.ctx, hex(this.state.xbyte, 3), p.l + 6, p.t, COLOR.cData, true);
    // Checkmark if bit 25 of mBRKC (C,Z affected by XBYTE).
    if (((this.state.message[2] >>> 25) & 1) !== 0) {
      this.drawText(this.ctx, '✓', p.l + 10, p.t, COLOR.cIndicator, true);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.5 — CT (64-bit counter, 16 hex digits in two groups of 8)
  // ──────────────────────────────────────────────────────────────────────

  private renderCT(): void {
    const p = PANEL.CT;
    const hi = this.state.message[4]; // mCTH2
    const lo = this.state.message[5]; // mCTL2
    this.drawText(this.ctx, 'CT', p.l, p.t, COLOR.cName, true);
    this.drawText(this.ctx, hex(hi, 8), p.l + 3, p.t, COLOR.cData, true);
    this.drawText(this.ctx, hex(lo, 8), p.l + 12, p.t, COLOR.cData, true);
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.8 — SFR (16 registers at 0x1F0..0x1FF in two columns)
  // ──────────────────────────────────────────────────────────────────────

  private renderSFR(): void {
    const p = PANEL.SFR;
    // Two columns: left = 0x1F0..0x1F7, right = 0x1F8..0x1FF.
    // Each entry: addr(3) + name(5) + value(8) = ~16 chars.
    for (let i = 0; i < 8; i++) {
      const row = p.t + 2 + i * 2;
      // Left column (0x1F0..0x1F7)
      this.drawText(this.ctx, hex(0x1F0 + i, 3), p.l, row, COLOR.cData2);
      this.drawText(this.ctx, SFR_NAMES[i], p.l + 4, row, COLOR.cName);
      this.drawText(this.ctx, hex(this.state.cogImage[0x1F0 + i], 8), p.l + 10, row, COLOR.cData);
      // Right column (0x1F8..0x1FF) — starts col +18 isn't quite right for
      // Pascal's layout; Pascal draws both columns in the same SFR panel.
      // For now: second set of 8 below, scrolling.
    }
    // Actually Pascal's SFR panel is 18 cols × 32 half-rows — it fits ALL
    // 16 rows stacked vertically (2 half-rows each = 16*2=32 half-rows).
    // Row 0..7 = 0x1F0..0x1F7 (above); row 8..15 = 0x1F8..0x1FF (below).
    for (let i = 0; i < 8; i++) {
      const row = p.t + 2 + (i + 8) * 2;
      this.drawText(this.ctx, hex(0x1F8 + i, 3), p.l, row, COLOR.cData2);
      this.drawText(this.ctx, SFR_NAMES[8 + i], p.l + 4, row, COLOR.cName);
      this.drawText(this.ctx, hex(this.state.cogImage[0x1F8 + i], 8), p.l + 10, row, COLOR.cData);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.9 — Events (16 single-char flags)
  // ──────────────────────────────────────────────────────────────────────

  private renderEvents(): void {
    const p = PANEL.EVENT;
    const flags = this.state.eventFlags;
    for (let i = 0; i < 16; i++) {
      const bit = (flags >>> i) & 1;
      const row = p.t + 2 + i * 2;
      this.drawText(this.ctx, EVENT_NAMES[i], p.l, row, COLOR.cName);
      this.drawText(this.ctx, String(bit), p.l + 4, row, bit ? COLOR.cData : COLOR.cDataDim);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.10 — Execution mode (tab)
  // ──────────────────────────────────────────────────────────────────────

  private renderExec(): void {
    const p = PANEL.EXEC;
    const label = EXEC_MODE_NAMES[this.state.execMode];
    // Highlighted tab
    this.fillRect(this.ctx, p.l, p.t, p.w, p.h, COLOR.cModeButton);
    this.drawText(this.ctx, label, p.l, p.t + 1, COLOR.cModeText, true);
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.11 — Stack (8 levels, horizontal)
  // ──────────────────────────────────────────────────────────────────────

  private renderStack(): void {
    const p = PANEL.STACK;
    this.drawText(this.ctx, 'STACK', p.l - 6, p.t, COLOR.cName, true);
    // 8 values of 8 hex digits each, space separated. Pascal: 9 char width each.
    for (let i = 0; i < 8; i++) {
      this.drawText(this.ctx, hex(this.state.message[6 + i], 8), p.l + i * 9, p.t, COLOR.cData);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.12 — Interrupt status
  // ──────────────────────────────────────────────────────────────────────

  private renderInterrupts(): void {
    const p = PANEL.INT;
    const brkcz = this.state.message[1];
    // INT1: event bits [11..8], state bits [1..0]
    // INT2: event bits [15..12], state bits [3..2]
    // INT3: event bits [19..16], state bits [5..4]
    const ints = [
      { label: 'INT1', evBits: 8,  stBits: 0 },
      { label: 'INT2', evBits: 12, stBits: 2 },
      { label: 'INT3', evBits: 16, stBits: 4 }
    ];
    for (let i = 0; i < ints.length; i++) {
      const def = ints[i];
      const evIdx = (brkcz >>> def.evBits) & 0xF;
      const stBits = (brkcz >>> def.stBits) & 0x3;
      const stLabels = ['idle', 'idle', 'wait', 'busy'];
      let stateLabel = stLabels[stBits];
      if ((stBits === 0 || stBits === 1) && evIdx === 0) stateLabel = 'off';
      const eventName = EVENT_NAMES[evIdx] || '???';
      const row = p.t + i * 2;
      this.drawText(this.ctx, def.label, p.l, row, COLOR.cName, true);
      this.drawText(this.ctx, eventName, p.l + 5, row, COLOR.cData);
      this.drawText(this.ctx, stateLabel, p.l + 9, row, stBits === 3 ? COLOR.cIndicator : COLOR.cData2);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.13 — Pointer data (FPTR/PTRA/PTRB with 14 hex bytes + ASCII)
  // ──────────────────────────────────────────────────────────────────────

  private renderPointers(): void {
    const p = PANEL.PTR;
    const rfwf = (this.state.message[1] >>> 20) & 1; // mBRKCZ bit 20
    const rows: Array<{ label: string; addr: number; data: Uint8Array }> = [
      { label: rfwf ? 'Wxx' : 'Rxx', addr: this.state.message[15] & 0xFFFFF, data: this.state.fptrWindow },
      { label: 'PTRA',                addr: this.state.message[16] & 0xFFFFF, data: this.state.ptraWindow },
      { label: 'PTRB',                addr: this.state.message[17] & 0xFFFFF, data: this.state.ptrbWindow }
    ];
    for (let r = 0; r < rows.length; r++) {
      const row = p.t + r * 2;
      this.drawText(this.ctx, rows[r].label, p.l, row, COLOR.cName, true);
      this.drawText(this.ctx, hex(rows[r].addr, 5), p.l + 5, row, COLOR.cData);
      // 14 hex bytes
      let x = p.l + 11;
      let ascii = '';
      for (let i = 0; i < PTR_BYTES; i++) {
        const b = rows[r].data[i];
        const isCenter = i === PTR_CENTER;
        this.drawText(this.ctx, hex(b, 2), x, row, COLOR.cData);
        if (isCenter) {
          // Box around center byte
          this.drawBox(this.ctx, x, row, 2, 2, COLOR.cIndicator);
        }
        x += 3;
        ascii += (b >= 0x20 && b <= 0x7E) ? String.fromCharCode(b) : '.';
      }
      this.drawText(this.ctx, ascii, x + 1, row, COLOR.cData2);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.14 — Status indicators (INIT/STALLI/STR/MOD/LUTS)
  // ──────────────────────────────────────────────────────────────────────

  private renderStatus(): void {
    const p = PANEL.STATUS;
    const items = [
      { label: 'INIT',   active: this.state.initFlag },
      { label: 'STALLI', active: this.state.stalliFlag },
      { label: 'STR',    active: this.state.strFlag },
      { label: 'MOD',    active: this.state.modFlag },
      { label: 'LUTS',   active: this.state.luts }
    ];
    for (let i = 0; i < items.length; i++) {
      const row = p.t + i;
      this.drawText(this.ctx, items[i].label, p.l, row, items[i].active ? COLOR.cIndicator : COLOR.cDataDim, true);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.15 — Pin registers (DIR/OUT/IN, 64 bits binary, split 32+32)
  // ──────────────────────────────────────────────────────────────────────

  private renderPins(): void {
    const p = PANEL.PIN;
    // DIRA/DIRB at $1FA/$1FB, OUTA/OUTB at $1FC/$1FD, INA/INB at $1FE/$1FF.
    const rows: Array<{ label: string; a: number; b: number }> = [
      { label: 'DIR', a: this.state.cogImage[0x1FA], b: this.state.cogImage[0x1FB] },
      { label: 'OUT', a: this.state.cogImage[0x1FC], b: this.state.cogImage[0x1FD] },
      { label: 'IN',  a: this.state.cogImage[0x1FE], b: this.state.cogImage[0x1FF] }
    ];
    for (let r = 0; r < rows.length; r++) {
      const row = p.t + r * 2;
      this.drawText(this.ctx, rows[r].label, p.l, row, COLOR.cName, true);
      // Format: [31..0 of a] [31..0 of b], splitting each 32 into 4 bytes
      // with spaces between bytes.
      const makeGroups = (v: number): string => {
        let s = '';
        for (let byte = 3; byte >= 0; byte--) {
          const b = (v >>> (byte * 8)) & 0xFF;
          let bs = '';
          for (let i = 7; i >= 0; i--) bs += ((b >>> i) & 1).toString();
          s += bs + ' ';
        }
        return s.trimEnd();
      };
      const bits = makeGroups(rows[r].b) + ' ' + makeGroups(rows[r].a);
      this.drawText(this.ctx, bits, p.l + 4, row, COLOR.cData);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.17 — Hub Data Viewer
  // ──────────────────────────────────────────────────────────────────────

  private renderHub(): void {
    const p = PANEL.HUB;
    this.drawText(this.ctx, 'HUB', p.l, p.t, COLOR.cName, true);
    // 8 rows × 16 bytes. Data comes from state.hubWindow (128 bytes).
    const base = this.state.hubAddr;
    for (let r = 0; r < 8; r++) {
      const row = p.t + 2 + r * 2;
      const addr = (base + r * 16) & 0xFFFFF;
      this.drawText(this.ctx, hex(addr, 5), p.l, row, COLOR.cData2);
      let hexStr = '';
      let ascStr = '';
      for (let c = 0; c < 16; c++) {
        const b = this.state.hubWindow[r * 16 + c];
        hexStr += hex(b, 2) + (c === 7 ? '  ' : ' ');
        ascStr += ascii(b);
      }
      this.drawText(this.ctx, hexStr, p.l + 6, row, COLOR.cData);
      this.drawText(this.ctx, ascStr, p.l + 6 + 16 * 3 + 2, row, COLOR.cData2);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.18 — Hub heat map (64 × 62 pixels, one per 128-byte sub-block)
  // ──────────────────────────────────────────────────────────────────────

  private renderHubMap(): void {
    // One pixel per 128-byte sub-block. Each cell's heat (0..254) flashes to
    // 254 when that sub-block's checksum changes and decays each break — same
    // graded gamma-2 blend (cDataDim→cName/cYellow) the REG/LUT maps use.
    // Heat is computed in DebuggerController; here we only paint it. Pascal
    // DebuggerUnit.pas L1679-1688. Cells past the firmware's sub-block count
    // stay dim (heat 0).
    const pixels = this.hubMapBmp.data;
    const hit = this.state.hubSubBlockHit;
    for (let i = 0; i < HUB_MAP_WIDTH * HUB_MAP_HEIGHT; i++) {
      const h = i < hit.length ? hit[i] : 0;
      const c = blendGamma2(COLOR.cDataDim, COLOR.cName, h);
      const idx = i * 4;
      pixels[idx]     = (c >> 16) & 0xFF;
      pixels[idx + 1] = (c >> 8) & 0xFF;
      pixels[idx + 2] = c & 0xFF;
      pixels[idx + 3] = 0xFF;
    }
    this.hubMapCtx.putImageData(this.hubMapBmp, 0, 0);
    // Draw in the top-right of the HUB panel (rect is the single source of truth
    // for both the draw and the click hit-test — see hubMapBoundsPx).
    const b = this.hubMapBoundsPx();
    this.ctx.drawImage(this.hubMapCanvas, b.x, b.y);
  }

  /**
   * Pixel rect of the hub heat-map (top-right of the HUB panel), 1:1 with the
   * HUB_MAP_WIDTH×HUB_MAP_HEIGHT bitmap. Each pixel is one 128-byte sub-block;
   * the interaction layer hit-tests clicks against this rect (Pascal InHubMap).
   */
  public hubMapBoundsPx(): { x: number; y: number; w: number; h: number } {
    const p = PANEL.HUB;
    return {
      x: this.px(p.l + p.w) - HUB_MAP_WIDTH - 4,
      y: this.py(p.t) + 4,
      w: HUB_MAP_WIDTH,
      h: HUB_MAP_HEIGHT
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.6 — Disassembly
  // ──────────────────────────────────────────────────────────────────────

  private renderDisassembly(): void {
    const p = PANEL.DIS;
    this.drawText(this.ctx, 'DIS', p.l, p.t, COLOR.cName, true);
    const pc = this.state.pc;
    // Auto-scroll decision (§6.6): if PC jumped far, snap to ideal line;
    // else if visible, gradually scroll toward ideal after threshold breaks.
    this.updateDisTopAddr();
    const top = this.state.disTopAddr;

    // SKIP is only in effect at the top execution level (no active CALL, not
    // mid-XBYTE/streamer). §6.6 / Pascal SkipOn.
    const skipOn = this.state.execMode === 0 && this.state.callDepth === 0;
    const skipPattern = this.state.skipPattern;

    for (let i = 0; i < DIS_LINES; i++) {
      const row = p.t + 2 + i * 2;
      // Address representation depends on disMode and value.
      let addr: number;
      let addrStr: string;
      if (this.state.disMode === DisMode.dmHub || top >= 0x400) {
        addr = (top + i * 4) & 0xFFFFF;
        addrStr = hex(addr, 5);
      } else {
        addr = (top + i) & 0x3FF;
        addrStr = (addr < 0x200 ? 'R-' : 'L-') + hex(addr & 0x1FF, 3);
      }
      this.drawText(this.ctx, addrStr, p.l + 1, row, COLOR.cData2);

      // Raw instruction word
      let rawValue: number;
      if (addr < 0x400) {
        rawValue = this.state.cogImage[addr];
      } else {
        // Hub-exec code: use disCode if populated, else zero.
        rawValue = this.state.disCode[i] || 0;
      }
      this.drawText(this.ctx, hex(rawValue, 8), p.l + 8, row, COLOR.cData);

      // Disassembled text. ROM debug entry/exit ($1F8..$1FF) uses hardcoded
      // strings (§11.5).
      let disText: string;
      if (addr >= 0x1F8 && addr <= 0x1FF) {
        disText = '[ROM] ' + ROM_DEBUG_STRINGS[addr - 0x1F8];
      } else {
        disText = this.disasm.decode(rawValue, addr).text;
      }
      // PC line: inverse highlight
      if (addr === pc) {
        this.fillRect(this.ctx, p.l + 1, row, p.w - 2, 2, COLOR.cData);
        this.drawText(this.ctx, addrStr, p.l + 1, row, COLOR.cBox2, true);
        this.drawText(this.ctx, hex(rawValue, 8), p.l + 8, row, COLOR.cBox2);
        this.drawText(this.ctx, disText, p.l + 18, row, COLOR.cBox2);
      } else {
        this.drawText(this.ctx, disText, p.l + 18, row, COLOR.cData);
      }

      // SKIP strikethrough: a translucent bar over instructions whose SKIP
      // bit is set (will be skipped on resume). §6.6 / Pascal L1530-1532
      // (SmoothShape over the line, half height, cData2, alpha 160).
      const hiddenPC = addr < 0x400 && this.state.disMode === DisMode.dmHub;
      if (shouldStrikeSkipped(addr, pc, skipOn, skipPattern, hiddenPC)) {
        this.ctx.save();
        this.ctx.globalAlpha = 160 / 255;
        this.ctx.fillStyle = rgb(COLOR.cData2);
        this.ctx.fillRect(this.px(p.l + 1), this.py(row) + HALF_ROW_PX - 1, (p.w - 2) * CHAR_WIDTH_PX, 2);
        this.ctx.restore();
      }

      // Address breakpoint marker
      const hasBrkAddr = (this.state.breakValue & BREAK_ADDR) !== 0 &&
                        ((this.state.breakValue >>> 12) & 0xFFFFF) === addr;
      if (hasBrkAddr) {
        // Red dot marker at left
        this.ctx.fillStyle = '#FF4040';
        this.ctx.beginPath();
        this.ctx.arc(this.px(p.l) + 4, this.py(row) + 8, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  /** Update disTopAddr per the auto-scroll algorithm (§6.6). */
  private updateDisTopAddr(): void {
    if (this.state.disMode !== DisMode.dmPC) return;
    const pc = this.state.pc;
    const top = this.state.disTopAddr;
    const isHub = pc >= 0x400;
    const step = isHub ? 4 : 1;
    const firstVisible = top;
    const lastVisible = top + (DIS_LINES - 1) * step;

    // PC jumped far: snap.
    const jumped = Math.abs(pc - top - DIS_LINE_IDEAL * step) > 8 * step;
    if (jumped) {
      this.state.disTopAddr = (pc - DIS_LINE_IDEAL * step) & (isHub ? 0xFFFFF : 0x3FF);
      this.state.disScrollTimer = 0;
      return;
    }
    // Off-screen: snap.
    if (pc < firstVisible) {
      this.state.disTopAddr = pc & (isHub ? 0xFFFFF : 0x3FF);
      this.state.disScrollTimer = 0;
      return;
    }
    if (pc > lastVisible) {
      this.state.disTopAddr = (pc - (DIS_LINES - 1) * step) & (isHub ? 0xFFFFF : 0x3FF);
      this.state.disScrollTimer = 0;
      return;
    }
    // Gradual scroll toward ideal after threshold breaks.
    this.state.disScrollTimer++;
    if (this.state.disScrollTimer >= DIS_SCROLL_THRESHOLD) {
      const idealTop = pc - DIS_LINE_IDEAL * step;
      if (top < idealTop) this.state.disTopAddr = (top + step) & (isHub ? 0xFFFFF : 0x3FF);
      else if (top > idealTop) this.state.disTopAddr = (top - step) & (isHub ? 0xFFFFF : 0x3FF);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.7 — Register watch
  // ──────────────────────────────────────────────────────────────────────

  private renderRegisterWatch(): void {
    const p = PANEL.WATCH;
    this.drawText(this.ctx, 'WATCH', p.l, p.t, COLOR.cName, true);
    for (let i = 0; i < this.state.regWatchListMax; i++) {
      const row = p.t + 2 + i * 2;
      const e = this.state.regWatchList[i];
      if (e) {
        this.drawText(this.ctx, hex(e.address, 3), p.l, row, COLOR.cData2);
        this.drawText(this.ctx, hex(e.value, 8), p.l + 4, row, COLOR.cData);
      } else {
        this.drawText(this.ctx, '△', p.l, row, COLOR.cDataDim);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.16 — Smart-pin watch
  // ──────────────────────────────────────────────────────────────────────

  private renderSmartPinWatch(): void {
    const p = PANEL.SMART;
    const label = this.state.smartWatchDirOnly ? 'RQPIN△ (DIR)' : 'RQPIN△ (all)';
    this.drawText(this.ctx, label, p.l, p.t, COLOR.cName, true);
    let x = p.l + 14;
    for (let i = 0; i < this.state.smartWatchListMax; i++) {
      const e = this.state.smartWatchList[i];
      if (e) {
        this.drawText(this.ctx, 'P' + String(e.pin).padStart(2, '0'), x, p.t, COLOR.cName);
        this.drawText(this.ctx, hex(e.value, 8), x + 4, p.t, COLOR.cData);
        x += 14;
      } else {
        this.drawText(this.ctx, '△', x, p.t, COLOR.cDataDim);
        x += 14;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.19 — Hint bar
  // ──────────────────────────────────────────────────────────────────────

  public hintText: string = '';
  private renderHint(): void {
    const p = PANEL.HINT;
    if (this.hintText) {
      this.drawText(this.ctx, this.hintText, p.l + 1, p.t, COLOR.cData);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §7 — Buttons
  // ──────────────────────────────────────────────────────────────────────

  private isButtonActive(name: string): boolean {
    const bv = this.state.breakValue;
    switch (name) {
      case 'MAIN':  return (bv & BREAK_MAIN) !== 0;
      case 'INT1':  return (bv & BREAK_INT1) !== 0;
      case 'INT2':  return (bv & BREAK_INT2) !== 0;
      case 'INT3':  return (bv & BREAK_INT3) !== 0;
      case 'DEBUG': return (bv & BREAK_DEBUG) !== 0;
      case 'INT1E': return (bv & BREAK_INT1E) !== 0;
      case 'INT2E': return (bv & BREAK_INT2E) !== 0;
      case 'INT3E': return (bv & BREAK_INT3E) !== 0;
      case 'INIT':  return (bv & BREAK_INIT) !== 0;
      case 'EVENT': return (bv & BREAK_EVENT) !== 0;
      case 'ADDR':  return (bv & BREAK_ADDR) !== 0;
      case 'BREAK': return (bv & 0x6FF) === 0; // no condition set except maybe INIT
      case 'GO':    return true; // always highlighted
      default:      return false;
    }
  }

  private goCaption(): string {
    if (this.state.isDimmed) return 'Break';
    if (this.state.repeatMode) return 'Stop';
    return 'Go';
  }

  private renderButtons(): void {
    const panelLeftPx = this.px(PANEL.B.l);
    const panelTopPx = this.py(PANEL.B.t);

    for (const btn of BUTTONS) {
      const x = panelLeftPx + btn.xOffsetPx;
      const y = panelTopPx + btn.yOffsetPx;
      const w = btn.wCells * CHAR_WIDTH_PX;
      const h = btn.hHalfRows * HALF_ROW_PX;

      const isGo = btn.name === 'GO';
      const active = this.isButtonActive(btn.name);
      const bg = isGo
        ? (this.state.isDimmed ? COLOR.cCmdButtonDim : COLOR.cCmdButton)
        : (active ? COLOR.cModeButton : COLOR.cModeButtonDim);
      const fg = isGo
        ? (this.state.isDimmed ? COLOR.cCmdTextDim : COLOR.cCmdText)
        : (active ? COLOR.cModeText : COLOR.cModeTextDim);

      this.ctx.fillStyle = rgb(bg);
      this.ctx.fillRect(x, y, w, h);
      // Label centered
      const label = isGo ? this.goCaption() : btn.name;
      this.ctx.fillStyle = rgb(fg);
      this.ctx.font = 'bold 12px monospace';
      this.ctx.textBaseline = 'middle';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    }
    this.ctx.textAlign = 'start';
    this.ctx.textBaseline = 'top';
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public API — button + region hit-testing used by DebuggerInteraction
  // ──────────────────────────────────────────────────────────────────────

  /** Return the button name at the given pixel coordinates, or null. */
  public hitTestButton(px: number, py: number): string | null {
    const panelLeftPx = this.px(PANEL.B.l);
    const panelTopPx = this.py(PANEL.B.t);
    for (const btn of BUTTONS) {
      const x = panelLeftPx + btn.xOffsetPx;
      const y = panelTopPx + btn.yOffsetPx;
      const w = btn.wCells * CHAR_WIDTH_PX;
      const h = btn.hHalfRows * HALF_ROW_PX;
      if (px >= x && px < x + w && py >= y && py < y + h) {
        return btn.name;
      }
    }
    return null;
  }

  /** Pixel bounds of a named panel for region tests (click navigation). */
  public panelBoundsPx(name: keyof typeof PANEL): { x: number; y: number; w: number; h: number } {
    const p = PANEL[name];
    return {
      x: this.px(p.l),
      y: this.py(p.t),
      w: p.w * CHAR_WIDTH_PX,
      h: p.h * HALF_ROW_PX
    };
  }

  /** Return the disassembly line index (0..15) at the given canvas Y, or -1. */
  public hitTestDisassemblyLine(py: number): number {
    const p = PANEL.DIS;
    const topPx = this.py(p.t + 2);
    const lineH = 2 * HALF_ROW_PX; // 16 px per line
    const idx = Math.floor((py - topPx) / lineH);
    return idx >= 0 && idx < DIS_LINES ? idx : -1;
  }

  /** Translate a disassembly line index to its cog/hub address. */
  public disassemblyLineAddress(lineIdx: number): number {
    const top = this.state.disTopAddr;
    const isHub = this.state.disMode === DisMode.dmHub || top >= 0x400;
    return isHub
      ? (top + lineIdx * 4) & 0xFFFFF
      : (top + lineIdx) & 0x3FF;
  }
}
