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

/**
 * Linear heat blend matching Pascal BlendPixel (DebuggerUnit.pas:2293-2298) — the
 * blend the REG/LUT/HUB heat maps use (NOT the gamma-correct SmoothPixel used for
 * line AA): each channel = min( (a*(255-alpha) + b*alpha + 255) >> 8 + shade, 255 ).
 * `alpha` is the hit value 0..254 ramping a→b; `shade` is an additive brightness
 * boost ($40 for the visible-disassembly highlight band, 0 otherwise).
 */
function blendPixel(a: number, b: number, alpha: number, shade: number = 0): number {
  const ch = (ac: number, bc: number) =>
    Math.min(((ac * (255 - alpha) + bc * alpha + 0xFF) >> 8) + shade, 0xFF);
  const r = ch((a >> 16) & 0xFF, (b >> 16) & 0xFF);
  const g = ch((a >> 8) & 0xFF, (b >> 8) & 0xFF);
  const bl = ch(a & 0xFF, b & 0xFF);
  return (r << 16) | (g << 8) | bl;
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

  // §2 font: the cell grid is fixed at CHAR_WIDTH_PX(8)×CHAR_HEIGHT_PX(16).
  // Pascal derives the grid FROM the font (ChrWidth := TextWidth('X')); we invert
  // it — size the bundled Parallax font so its 'X' advance fills exactly one cell,
  // which also keeps multi-char hex strings aligned to the column grid. Measured
  // once the font is available and recomputed when document.fonts settles.
  private static readonly FONT_FAMILY = "'Parallax', monospace";
  private fontPx = CHAR_HEIGHT_PX - 3;   // sane default until measured

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

    // §2 — size the Parallax font to the cell. The font may not be loaded when
    // the renderer constructs; measure now (best-effort) and recompute + repaint
    // once document.fonts settles so the first real paint uses the right metrics.
    this.fontPx = this.measureFontPx();
    const docFonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (docFonts?.ready) {
      docFonts.ready
        .then(() => {
          const px = this.measureFontPx();
          if (px !== this.fontPx) {
            this.fontPx = px;
            this.render();
          }
        })
        .catch(() => { /* font load failed — keep best-effort size */ });
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Coordinate & drawing primitives
  // ──────────────────────────────────────────────────────────────────────

  /** Convert grid column to pixel X. */
  private px(col: number): number { return col * CHAR_WIDTH_PX; }
  /** Convert grid half-row to pixel Y. */
  private py(halfRow: number): number { return halfRow * HALF_ROW_PX; }

  /**
   * §2 — find the Parallax px size whose 'X' advance equals one cell
   * (CHAR_WIDTH_PX). measureText scales linearly with font size, so we measure
   * at a reference size and scale. Falls back to the current value when the
   * canvas can't measure (e.g. the jsdom test canvas returns width 0).
   */
  private measureFontPx(): number {
    const ref = 32;
    this.ctx.font = `${ref}px ${DebuggerRenderer.FONT_FAMILY}`;
    const w = this.ctx.measureText('X').width;
    if (!w || !isFinite(w)) return this.fontPx;
    const px = (ref * CHAR_WIDTH_PX) / w;
    return Math.max(6, Math.min(px, CHAR_HEIGHT_PX));
  }

  /**
   * Draw text at grid (col, halfRow). Text is CHAR_HEIGHT (16) tall so it
   * occupies 2 half-rows. Callers usually increment halfRow by 2 for the
   * next text line.
   */
  private drawText(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    text: string, col: number, halfRow: number,
    color: number, bold: boolean = false, italic: boolean = false
  ): void {
    // Canvas font shorthand order: style weight size family.
    ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${this.fontPx}px ${DebuggerRenderer.FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = rgb(color);
    ctx.fillText(text, this.px(col), this.py(halfRow));
  }

  /**
   * Draw a panel box at grid (col, halfRow), size (w, h) in chars/half-rows.
   *
   * Pascal DrawBox (DebuggerUnit.pas:2123-2148) is NOT a flat stroke — it draws a
   * FILLED rounded rectangle in `color` plus a rounded rim brightened ×1.5
   * (per-channel `color*3>>1`, clamped). Rim thickness `t = ChrWidth*rim>>4`
   * (rim=3 for panels, 6 for the GO button); corner radius `ChrHeight/3+1`
   * (tighter for `small` button tabs). Canvas2D `roundRect` supplies the
   * anti-aliased edge Pascal's SmoothShape renders by hand — same pattern as
   * debugPlotWin.ts:2547. This is what gives the CT box (cBox3) its orange and
   * every panel its rounded corners.
   */
  private drawBox(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    col: number, halfRow: number, wCols: number, hHalfRows: number,
    color: number, rim: number = 3, small: boolean = false
  ): void {
    const cw = CHAR_WIDTH_PX;    // Pascal ChrWidth
    const chh = CHAR_HEIGHT_PX;  // Pascal ChrHeight
    // Pascal DrawBox (DebuggerUnit.pas:2123-2148): the box extends BEYOND the bare
    // grid cells by ChrWidth*wm/8 horizontally and ChrHeight/hd vertically, and is
    // drawn CENTERED on the grid rect. This margin is the padding that keeps text
    // off the box edges (e.g. the CT counter's orange surround, the button pills).
    // wm/hd differ for `small` (mode-button tabs) vs full panels.
    const wm = small ? 10 : 11;
    const hd = small ? -6 : 5;
    const idiv = (a: number, b: number) => Math.trunc(a / b);
    // Pascal: t = ChrWidth*rim shr 4; h = t shr 1 (rim shape is 2h larger than fill).
    const t = (cw * rim) >> 4;
    const h = t >> 1;
    const wPx = wCols * cw;
    const hPx = hHalfRows * HALF_ROW_PX;
    // Box center — Pascal SmoothShape xc/yc (left+width/2, top+height/2).
    const cx = this.px(col) + wPx / 2;
    const cy = this.py(halfRow) + hPx / 2;
    // Full extents of the filled shape (thick=0) and the slightly larger rim shape.
    // SmoothShape's xs/ys are full width/height (the box spans xc±xs/2).
    const fillW = wPx + idiv(cw * wm, 8) - h;
    const fillH = hPx + idiv(chh, hd) - h;
    const rimW  = wPx + idiv(cw * wm, 8) + h;
    const rimH  = hPx + idiv(chh, hd) + h;
    // Pascal corner radius = ChrHeight div 3 + 1 (same for small tabs).
    const radius = idiv(chh, 3) + 1;
    // Rim color: box color brightened ×1.5 per channel, clamped to 0xFF.
    const rimColor =
      (Math.min(((color >> 16) & 0xFF) * 3 >> 1, 0xFF) << 16) |
      (Math.min(((color >> 8) & 0xFF) * 3 >> 1, 0xFF) << 8) |
      Math.min((color & 0xFF) * 3 >> 1, 0xFF);
    // Filled interior in the box color.
    ctx.beginPath();
    ctx.roundRect(cx - fillW / 2, cy - fillH / 2, fillW, fillH,
      Math.min(radius, fillW / 2, fillH / 2));
    ctx.fillStyle = rgb(color);
    ctx.fill();
    // Brightened rounded rim (only when rim thickness rounds to ≥1 px).
    if (t > 0) {
      ctx.beginPath();
      ctx.roundRect(cx - rimW / 2, cy - rimH / 2, rimW, rimH,
        Math.min(radius, rimW / 2, rimH / 2));
      ctx.strokeStyle = rgb(rimColor);
      ctx.lineWidth = t;
      ctx.stroke();
    }
  }

  /**
   * Pixel rect for a Pascal BoxBoundary(L, T, W, H, B) call (DebuggerUnit.pas:2327)
   * — the inset rectangle that heat-map bitmaps are StretchDraw'd into and that
   * mouse hit-tests use. B=1 grows the rect by ±ChrWidth*7/8 horizontally and
   * ±ChrHeight/7 vertically (a box surround); B=0 is the bare grid rect.
   */
  private boxBoundaryPx(
    L: number, T: number, W: number, H: number, B: number
  ): { x: number; y: number; w: number; h: number } {
    const mx = Math.trunc(B * CHAR_WIDTH_PX * 7 / 8);
    const my = Math.trunc(B * CHAR_HEIGHT_PX / 7);
    const x1 = this.px(L) - mx;
    const y1 = this.py(T) - my;
    const x2 = this.px(L + W) + mx;
    const y2 = this.py(T + H) + my;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /**
   * Filled rounded rectangle centered at pixel (cx, cy) — the rim-less
   * SmoothShape (thick=0) Pascal uses for the pointer center-byte highlight
   * (DebuggerUnit.pas:2254-2261). No brightened rim, fully opaque.
   */
  private fillRoundedPx(
    cx: number, cy: number, w: number, h: number, r: number, color: number
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(r, w / 2, h / 2));
    ctx.fillStyle = rgb(color);
    ctx.fill();
  }

  /**
   * Draw a checkmark glyph at grid (col, halfRow) — mirrors Pascal DrawCheck
   * (DebuggerUnit.pas:2158-2171): a two-segment stroke (down to +½ cell, then
   * up to +1½ cells) centered vertically in the row, ±3px tall, starting at the
   * left edge of `col`. Drawn with canvas lines so it is font-independent.
   */
  private drawCheck(col: number, halfRow: number, color: number): void {
    const ctx = this.ctx;
    const x0 = this.px(col);
    const ym = this.py(halfRow) + CHAR_HEIGHT_PX / 2;
    const dy = (CHAR_HEIGHT_PX * 3) >> 4; // Pascal ChrHeight*3 shr 4 = 3px
    ctx.beginPath();
    ctx.moveTo(x0, ym);
    ctx.lineTo(x0 + (CHAR_WIDTH_PX >> 1), ym + dy);                  // mid, lower
    ctx.lineTo(x0 + CHAR_WIDTH_PX + (CHAR_WIDTH_PX >> 1), ym - dy);  // right, upper
    ctx.strokeStyle = rgb(color);
    ctx.lineWidth = Math.max(2, CHAR_WIDTH_PX >> 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Right-pointing arrow within one cell at grid (col, halfRow) — mirrors Pascal
   * DrawArrowRight (DebuggerUnit.pas:2205-2219): tip at the cell's right edge,
   * shaft to the left, head to the upper/lower mid. Marks the INT*-Entry buttons.
   */
  private drawArrowRight(col: number, halfRow: number, color: number): void {
    const ctx = this.ctx;
    const xl = this.px(col);
    const xr = xl + CHAR_WIDTH_PX;
    const xm = (xl + xr) / 2;
    const ym = this.py(halfRow) + CHAR_HEIGHT_PX / 2;
    const dy = (CHAR_HEIGHT_PX * 3) >> 4; // Pascal ChrHeight*3 shr 4 = 3px
    ctx.strokeStyle = rgb(color);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(xr, ym); ctx.lineTo(xl, ym);
    ctx.moveTo(xr, ym); ctx.lineTo(xm, ym - dy);
    ctx.moveTo(xr, ym); ctx.lineTo(xm, ym + dy);
    ctx.stroke();
  }

  /**
   * Up-pointing arrow centered on grid (col, halfRow) — mirrors Pascal
   * DrawArrowUp (DebuggerUnit.pas:2189-2203): tip at the top, shaft down, head to
   * the left/right mid. Marks the EVENT button.
   */
  private drawArrowUp(col: number, halfRow: number, color: number): void {
    const ctx = this.ctx;
    const xm = this.px(col) + CHAR_WIDTH_PX / 2;
    const dx = (CHAR_WIDTH_PX * 7) >> 4;  // Pascal ChrWidth*7 shr 4 = 3px
    const xl = xm - dx;
    const xr = xm + dx;
    const ym = this.py(halfRow) + CHAR_HEIGHT_PX / 2;
    const dy = (CHAR_HEIGHT_PX * 7) >> 5; // Pascal ChrHeight*7 shr 5 = 3px
    const yt = ym - dy;
    ctx.strokeStyle = rgb(color);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(xm, yt); ctx.lineTo(xm, ym + dy);
    ctx.moveTo(xm, yt); ctx.lineTo(xl, ym);
    ctx.moveTo(xm, yt); ctx.lineTo(xr, ym);
    ctx.stroke();
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

    // 2. §7 graded dim — 250 ms without a new break. Pascal FormBreakpointTimeout
    // (:1112-1131) halves every RGB channel of the rendered frame (a 50%
    // multiplicative dim, NOT a translucent black overlay) then redraws the GO
    // button at full brightness so it stays orange with the 'Break' caption.
    if (this.state.isDimmed) {
      const img = this.ctx.getImageData(0, 0, BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] >>= 1; d[i + 1] >>= 1; d[i + 2] >>= 1; // R,G,B; leave A
      }
      this.ctx.putImageData(img, 0, 0);
      this.renderGoButton();
      // Pascal FormBreakpointTimeout (:1110,1127-1129): over the dimmed frame,
      // draw at FULL brightness either the live fly-over hint (when hovering) or
      // the idle explanation when this cog is free-running. Both are cIndicator
      // italic at the HINT panel. Pascal gates the idle line on
      // GetTickCount-LastDebugTick>100; when dimmed that is always true for this
      // cog (250 ms since the last break), so we always show it.
      const hp = PANEL.HINT;
      const dimHint = this.hintText
        ? this.hintText
        : 'To force an asynchronous break in this cog, another cog must be idling in its own debugger';
      this.drawText(this.ctx, dimHint, hp.l + 1, hp.t, COLOR.cIndicator, false, true);
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
    // §6 highlight band — rows whose address falls in the disassembly's currently
    // visible window get an additive $40 brightness (Pascal :1667-1672). The
    // disassembly addresses the REG/LUT cog space only when NOT in hub-exec mode;
    // in hub mode the visible window is hub addresses, so no band lands here.
    const top = this.state.disAddr;
    const bandActive = this.state.disMode !== DisMode.dmHub && top < 0x400;
    for (let row = 0; row < 512; row++) {
      const addr = addrBase + row;
      if (addr >= cogImage.length) break;
      const value = cogImage[addr];
      const hit = cogHit[addr]; // 0..254
      const shade = (bandActive && addr >= top && addr < top + DIS_LINES) ? 0x40 : 0x00;
      for (let col = 0; col < 32; col++) {
        // MSB at col 0, LSB at col 31.
        const bit = (value >>> (31 - col)) & 1;
        const same = bit ? COLOR.cHighSame : COLOR.cLowSame;
        const diff = bit ? COLOR.cHighDiff : COLOR.cLowDiff;
        const c = blendPixel(same, diff, hit, shade);
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
    // StretchDraw the 32×512 bitmap into the INSET map rect (Pascal BoxBoundary
    // RegMapLeft/Top/Right/Bottom, DebuggerUnit.pas:2061): grid (l+1, t+3) ×
    // (7, h-4) with a B=1 surround. The +3 half-row top inset leaves a header band
    // for the 'REG' title (so it sits on the dark box, NOT over the heat map) and
    // the inset on every side lets the box border + window background show through.
    const m = this.boxBoundaryPx(p.l + 1, p.t + 3, 7, p.h - 4, 1);
    this.ctx.drawImage(this.regMapCanvas, m.x, m.y, m.w, m.h);
    // §3.1 — REG column title (Pascal DebuggerUnit.pas:1954, bold + italic).
    this.drawText(this.ctx, 'REG', p.l + 3, p.t, COLOR.cName, true, true);
  }

  private renderLutMap(): void {
    this.paintHeatBitmap(this.lutMapBmp, 0x200);
    this.lutMapCtx.putImageData(this.lutMapBmp, 0, 0);
    const p = PANEL.LUTMAP;
    // Inset map rect — see renderRegMap (Pascal LutMap, DebuggerUnit.pas:2063).
    const m = this.boxBoundaryPx(p.l + 1, p.t + 3, 7, p.h - 4, 1);
    this.ctx.drawImage(this.lutMapCanvas, m.x, m.y, m.w, m.h);
    // §3.1 — LUT column title (Pascal DebuggerUnit.pas:1957, bold + italic).
    this.drawText(this.ctx, 'LUT', p.l + 3, p.t, COLOR.cName, true, true);
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.2 — C Flag, Z Flag, PC
  // ──────────────────────────────────────────────────────────────────────

  private renderCFlag(): void {
    const p = PANEL.CF;
    this.drawText(this.ctx, 'C', p.l, p.t, COLOR.cName, true, true);
    this.drawText(this.ctx, String(this.state.cFlag), p.l + 2, p.t, COLOR.cData, true);
  }
  private renderZFlag(): void {
    const p = PANEL.ZF;
    this.drawText(this.ctx, 'Z', p.l, p.t, COLOR.cName, true, true);
    this.drawText(this.ctx, String(this.state.zFlag), p.l + 2, p.t, COLOR.cData, true);
  }
  private renderPC(): void {
    const p = PANEL.PC;
    this.drawText(this.ctx, 'PC', p.l, p.t, COLOR.cName, true, true);
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

    // Label is ALWAYS bright cName — Pascal never dims it (DebuggerUnit.pas:1969);
    // only the bit pattern dims when suspended.
    this.drawText(this.ctx, label, p.l, p.t, COLOR.cName, true, true);

    // 32-bit pattern, MSB on left, byte-grouped with a space every 8 bits
    // (Pascal DrawRegBin :2227-2231). Drawn ALWAYS — cData when SKIP is in
    // effect, dimmed cDataDim when suspended.
    const pattern = this.state.skipPattern;
    let bits = '';
    for (let i = 31; i >= 0; i--) {
      bits += ((pattern >>> i) & 1).toString();
      if ((i & 7) === 0 && i !== 0) bits += ' ';
    }
    this.drawText(this.ctx, bits, p.l + 6, p.t, active ? COLOR.cData : COLOR.cDataDim);

    // When suspended, overlay "Suspended during <mode/CALL(n)>" centered, bold,
    // bright (Pascal :1421-1424). Centering uses the short mode-name length.
    if (!active) {
      const s = execMode !== 0 ? EXEC_MODE_NAMES[execMode] : `CALL(${callDepth})`;
      const x = p.l + 15 - ((s.length + 1) >> 1);
      this.drawText(this.ctx, `Suspended during ${s}`, x, p.t, COLOR.cData, true);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.4 — XBYTE
  // ──────────────────────────────────────────────────────────────────────

  private renderXByte(): void {
    const p = PANEL.XBYTE;
    this.drawText(this.ctx, 'XBYTE', p.l, p.t, COLOR.cName, true, true);
    this.drawText(this.ctx, hex(this.state.xbyte, 3), p.l + 6, p.t, COLOR.cData, true);
    // §4.3 — dim check ALWAYS (Pascal base DebuggerUnit.pas:1973), brightened to
    // orange when the XBYTE C,Z-affected bit (mBRKC bit 25) is set (dynamic :1428).
    this.drawCheck(p.l + 10, p.t, COLOR.cDataDim);
    if (((this.state.message[2] >>> 25) & 1) !== 0) {
      this.drawCheck(p.l + 10, p.t, COLOR.cIndicator);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.5 — CT (64-bit counter, 16 hex digits in two groups of 8)
  // ──────────────────────────────────────────────────────────────────────

  private renderCT(): void {
    const p = PANEL.CT;
    const hi = this.state.message[4]; // mCTH2
    const lo = this.state.message[5]; // mCTL2
    this.drawText(this.ctx, 'CT', p.l, p.t, COLOR.cName, true, true);
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
      const row = p.t + i * 2; // Pascal SFRt + i shl 1 (DebuggerUnit.pas:1986)
      // Left column (0x1F0..0x1F7)
      this.drawText(this.ctx, hex(0x1F0 + i, 3), p.l, row, COLOR.cData2);
      this.drawText(this.ctx, SFR_NAMES[i], p.l + 4, row, COLOR.cName, true, true);
      this.drawText(this.ctx, hex(this.state.cogImage[0x1F0 + i], 8), p.l + 10, row, COLOR.cData);
      // Right column (0x1F8..0x1FF) — starts col +18 isn't quite right for
      // Pascal's layout; Pascal draws both columns in the same SFR panel.
      // For now: second set of 8 below, scrolling.
    }
    // Actually Pascal's SFR panel is 18 cols × 32 half-rows — it fits ALL
    // 16 rows stacked vertically (2 half-rows each = 16*2=32 half-rows).
    // Row 0..7 = 0x1F0..0x1F7 (above); row 8..15 = 0x1F8..0x1FF (below).
    for (let i = 0; i < 8; i++) {
      const row = p.t + (i + 8) * 2; // Pascal SFRt + i shl 1 (DebuggerUnit.pas:1986)
      this.drawText(this.ctx, hex(0x1F8 + i, 3), p.l, row, COLOR.cData2);
      this.drawText(this.ctx, SFR_NAMES[8 + i], p.l + 4, row, COLOR.cName, true, true);
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
      const row = p.t + i * 2; // Pascal EVENTt + i shl 1 (DebuggerUnit.pas:1992)
      this.drawText(this.ctx, EVENT_NAMES[i], p.l, row, COLOR.cName, true, true);
      // Pascal :1434 draws every flag digit in cData (white) regardless of value.
      this.drawText(this.ctx, String(bit), p.l + 4, row, COLOR.cData);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.10 — Execution mode (tab)
  // ──────────────────────────────────────────────────────────────────────

  private renderExec(): void {
    const p = PANEL.EXEC;
    // §3.3 — exec-mode label on the STACK row (EXECl, EXECt+2), green plain.
    // Pascal :1436 ALWAYS shows ModeName[ExecMode] (MAIN/INT1/INT2/INT3) here;
    // CALL(n) appears only inside the SKIP "Suspended" overlay, never in EXEC.
    const label = EXEC_MODE_NAMES[this.state.execMode];
    this.drawText(this.ctx, label, p.l, p.t + 2, COLOR.cData2);
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.11 — Stack (8 levels, horizontal)
  // ──────────────────────────────────────────────────────────────────────

  private renderStack(): void {
    const p = PANEL.STACK;
    // §3.3 — 'STACK' at STACKl; data at StackDataLeft (STACKl+6). Pascal :1995/1438.
    this.drawText(this.ctx, 'STACK', p.l, p.t, COLOR.cName, true, true);
    for (let i = 0; i < 8; i++) {
      this.drawText(this.ctx, hex(this.state.message[6 + i], 8), p.l + 6 + i * 9, p.t, COLOR.cData);
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
    // Pascal DrawInt (:2281): status = mBRKCZ shr (int shl 1) and 3 → shifts
    // 2 / 4 / 6 (NOT 0/2/4). Event name = mBRKCZ shr (int shl 2 + 4) → 8/12/16.
    const ints = [
      { label: 'INT1', evBits: 8,  stBits: 2 },
      { label: 'INT2', evBits: 12, stBits: 4 },
      { label: 'INT3', evBits: 16, stBits: 6 }
    ];
    for (let i = 0; i < ints.length; i++) {
      const def = ints[i];
      const evIdx = (brkcz >>> def.evBits) & 0xF;
      const stBits = (brkcz >>> def.stBits) & 0x3;
      const row = p.t + i * 2;
      this.drawText(this.ctx, def.label, p.l, row, COLOR.cName, true, true);
      // §3.4 — Pascal DrawInt (:2270): off ⇒ just 'off' at +5; active ⇒ event
      // name at +5 + idle/wait/busy status at +9. No event word when off.
      if (evIdx === 0) {
        this.drawText(this.ctx, 'off', p.l + 5, row, COLOR.cData2, true);
      } else {
        this.drawText(this.ctx, EVENT_NAMES[evIdx] || '???', p.l + 5, row, COLOR.cData, true);
        const status = stBits === 3 ? 'busy' : stBits === 2 ? 'wait' : 'idle';
        this.drawText(this.ctx, status, p.l + 9, row, COLOR.cData2, true);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.13 — Pointer data (FPTR/PTRA/PTRB with 14 hex bytes + ASCII)
  // ──────────────────────────────────────────────────────────────────────

  private renderPointers(): void {
    const p = PANEL.PTR;
    const rfwf = (this.state.message[1] >>> 20) & 1; // mBRKCZ bit 20
    const rows: Array<{ label: string; addr: number; data: Uint8Array }> = [
      { label: rfwf ? 'WFxx' : 'RFxx', addr: this.state.message[15] & 0xFFFFF, data: this.state.fptrWindow },
      { label: 'PTRA',                addr: this.state.message[16] & 0xFFFFF, data: this.state.ptraWindow },
      { label: 'PTRB',                addr: this.state.message[17] & 0xFFFFF, data: this.state.ptrbWindow }
    ];
    // ASCII column starts after the 14 hex pairs (Pascal: left+11+PtrBytes*3+1).
    const asciiStart = p.l + 11 + PTR_BYTES * 3 + 1;
    for (let r = 0; r < rows.length; r++) {
      const row = p.t + r * 2;
      this.drawText(this.ctx, rows[r].label, p.l, row, COLOR.cName, true, true);
      // §4.1 — address is WHITE (Pascal DrawPtrBytes:2243, cData).
      this.drawText(this.ctx, hex(rows[r].addr, 5), p.l + 5, row, COLOR.cData);
      // §4.1 — data bytes + ascii are cData2 GREEN; the center byte gets a green
      // filled rounded highlight (hex pair AND ascii char) with dark (cBox) bold
      // text inverted on top (Pascal DrawPtrBytes:2245-2266).
      const cy = this.py(row) + CHAR_HEIGHT_PX / 2;
      for (let i = 0; i < PTR_BYTES; i++) {
        const b = rows[r].data[i];
        const hexCol = p.l + 11 + i * 3;
        const ascCol = asciiStart + i;
        let color: number = COLOR.cData2;
        let bold = false;
        if (i === PTR_CENTER) {
          // Highlight behind the hex pair: 3 cells wide, ¾ row tall (Pascal:2254-2257).
          this.fillRoundedPx(
            (hexCol + 1) * CHAR_WIDTH_PX, cy,
            CHAR_WIDTH_PX * 3, (CHAR_HEIGHT_PX * 3) >> 2, CHAR_HEIGHT_PX >> 2, COLOR.cData2
          );
          // Highlight behind the ascii char: 1½ cells wide (Pascal:2258-2261).
          this.fillRoundedPx(
            ascCol * CHAR_WIDTH_PX + ((CHAR_WIDTH_PX - 1) >> 1), cy,
            (CHAR_WIDTH_PX * 3) >> 1, (CHAR_HEIGHT_PX * 3) >> 2, CHAR_HEIGHT_PX >> 2, COLOR.cData2
          );
          color = COLOR.cBox;
          bold = true;
        }
        this.drawText(this.ctx, hex(b, 2), hexCol, row, color, bold);
        const c = (b >= 0x20 && b <= 0x7E) ? String.fromCharCode(b) : '.';
        this.drawText(this.ctx, c, ascCol, row, color, bold);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.14 — Status indicators (INIT/STALLI/STR/MOD/LUTS)
  // ──────────────────────────────────────────────────────────────────────

  private renderStatus(): void {
    const p = PANEL.STATUS;
    // Pascal staggered 2D layout (DebuggerUnit.pas:1451-1459 / base :2008-2012),
    // q1/q2/q3 = +¼/+½/+¾ char on both axes. STR & MOD share a row.
    // Inactive = cDataDim (from base bitmap), active overdraws cIndicator. All
    // bold+italic.
    const items = [
      { label: 'INIT',   active: this.state.initFlag,   dc: 1,         dr: -1 + 0.75 },
      { label: 'STALLI', active: this.state.stalliFlag, dc: 0,         dr:  1 + 0.25 },
      { label: 'STR',    active: this.state.strFlag,    dc: -1 + 0.75, dr:  2 + 0.75 },
      { label: 'MOD',    active: this.state.modFlag,    dc:  3 + 0.25, dr:  2 + 0.75 },
      { label: 'LUTS',   active: this.state.luts,       dc: 1,         dr:  4 + 0.25 }
    ];
    for (const it of items) {
      const color = it.active ? COLOR.cIndicator : COLOR.cDataDim;
      this.drawText(this.ctx, it.label, p.l + it.dc, p.t + it.dr, color, true, true);
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
      this.drawText(this.ctx, rows[r].label, p.l, row, COLOR.cName, true, true);
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
    // §3.7 — 'HUB' label BELOW the memory box (Pascal :2023, HUBt+HUBh+1, bold+italic).
    this.drawText(this.ctx, 'HUB', p.l, p.t + p.h + 1, COLOR.cName, true, true);
    // 8 rows × 16 bytes. Data comes from state.hubWindow (128 bytes).
    // Rows start at the panel top (Pascal HUBt + j shl 1, DebuggerUnit.pas:1471) —
    // NOT p.t+2: the §3.7 move of the 'HUB' label to below the box left no title
    // row at the top, so the old +2 pushed the 8th row down onto the HINT bar.
    const base = this.state.hubAddr;
    for (let r = 0; r < 8; r++) {
      const row = p.t + r * 2;
      const addr = (base + r * 16) & 0xFFFFF;
      // §4.2 — hub address WHITE (Pascal :1471), hex bytes + ascii GREEN (:1475/:1477).
      this.drawText(this.ctx, hex(addr, 5), p.l, row, COLOR.cData);
      let hexStr = '';
      let ascStr = '';
      for (let c = 0; c < 16; c++) {
        const b = this.state.hubWindow[r * 16 + c];
        // Pascal :1474 uses a uniform 3-col stride for all 16 bytes (no extra
        // gap mid-row); ASCII starts at HUBl+55 (:1476).
        hexStr += hex(b, 2) + ' ';
        ascStr += ascii(b);
      }
      this.drawText(this.ctx, hexStr, p.l + 6, row, COLOR.cData2);
      this.drawText(this.ctx, ascStr, p.l + 6 + 16 * 3 + 1, row, COLOR.cData2);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.18 — Hub heat map (64 × 62 pixels, one per 128-byte sub-block)
  // ──────────────────────────────────────────────────────────────────────

  private renderHubMap(): void {
    // One pixel per 128-byte sub-block. Each cell's heat (0..254) flashes to
    // 254 when that sub-block's checksum changes and decays each break — the
    // linear cDataDim→cYellow blend the REG/LUT maps use (cYellow == cName ==
    // 0xFFFF00). Heat is computed in DebuggerController; here we only paint it.
    // Pascal DebuggerUnit.pas:1677-1688. Cells past the firmware's sub-block
    // count stay dim (heat 0).
    const pixels = this.hubMapBmp.data;
    const hit = this.state.hubSubBlockHit;
    for (let i = 0; i < HUB_MAP_WIDTH * HUB_MAP_HEIGHT; i++) {
      const h = i < hit.length ? hit[i] : 0;
      const c = blendPixel(COLOR.cDataDim, COLOR.cName, h);
      const idx = i * 4;
      pixels[idx]     = (c >> 16) & 0xFF;
      pixels[idx + 1] = (c >> 8) & 0xFF;
      pixels[idx + 2] = c & 0xFF;
      pixels[idx + 3] = 0xFF;
    }
    this.hubMapCtx.putImageData(this.hubMapBmp, 0, 0);
    // StretchDraw the 64×62 bitmap to FILL the map rect (rect is the single source
    // of truth for both the draw and the click hit-test — see hubMapBoundsPx).
    // Pascal StretchDraws HubMap into HubMapLeft..Right/Top..Bottom (:1694), a
    // 22×14-cell region — the full dark field to the right of the ASCII dump, NOT
    // a 1:1 64×62 block in the corner.
    const b = this.hubMapBoundsPx();
    this.ctx.drawImage(this.hubMapCanvas, b.x, b.y, b.w, b.h);
  }

  /**
   * Pixel rect of the hub heat-map — the full dark field filling the HUB panel to
   * the right of the ASCII dump. Pascal BoxBoundary(HUBl+74, HUBt+1, 22, HUBh-2, 1)
   * (DebuggerUnit.pas:2105). The 64×62 bitmap is StretchDraw'd into it; the
   * interaction layer hit-tests clicks against this rect, scaling by the bitmap
   * dimensions (Pascal InHubMap / MapHubAddr, :695-696).
   */
  public hubMapBoundsPx(): { x: number; y: number; w: number; h: number } {
    const p = PANEL.HUB;
    return this.boxBoundaryPx(p.l + 74, p.t + 1, 22, p.h - 2, 1);
  }

  /**
   * Pixel rect of the REG heat strip — the INSET map inside the REG box, matching
   * the rect renderRegMap draws into (Pascal RegMap, DebuggerUnit.pas:2061). The
   * enclosing PANEL.REGMAP rect is Pascal's REG *box*: it carries its own hover
   * hint, and MapCogAddr scales against the strip, not the box.
   */
  public regMapBoundsPx(): { x: number; y: number; w: number; h: number } {
    const p = PANEL.REGMAP;
    return this.boxBoundaryPx(p.l + 1, p.t + 3, 7, p.h - 4, 1);
  }

  /** Pixel rect of the LUT heat strip (Pascal LutMap, DebuggerUnit.pas:2063). */
  public lutMapBoundsPx(): { x: number; y: number; w: number; h: number } {
    const p = PANEL.LUTMAP;
    return this.boxBoundaryPx(p.l + 1, p.t + 3, 7, p.h - 4, 1);
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.6 — Disassembly
  // ──────────────────────────────────────────────────────────────────────

  private renderDisassembly(): void {
    const p = PANEL.DIS;
    // §3.2 — Pascal draws NO 'DIS' title (box only, DebuggerUnit.pas:1979).
    const pc = this.state.pc;
    // Auto-scroll decision (§6.6): if PC jumped far, snap to ideal line;
    // else if visible, gradually scroll toward ideal after threshold breaks.
    this.updateDisTopAddr();
    const top = this.state.disAddr;

    // SKIP is only in effect at the top execution level (no active CALL, not
    // mid-XBYTE/streamer). §6.6 / Pascal SkipOn.
    const skipOn = this.state.execMode === 0 && this.state.callDepth === 0;
    const skipPattern = this.state.skipPattern;

    for (let i = 0; i < DIS_LINES; i++) {
      const row = p.t + i * 2; // Pascal DISt + i shl 1 (DebuggerUnit.pas:1504)
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

      // SKIP indicator: a translucent band over instructions whose SKIP bit is
      // set (will be skipped on resume). §6.6 / Pascal L1530-1532
      //   SmoothShape(x, y, xs, ys shr 1, r, r, 0, cData2, 160)
      // = a filled translucent rect, full instruction width, HALF the row
      // height, vertically centered on the row (NOT a thin strikethrough line —
      // that reads as "crossed out"; Pascal draws a faint highlight band).
      const hiddenPC = addr < 0x400 && this.state.disMode === DisMode.dmHub;
      if (shouldStrikeSkipped(addr, pc, skipOn, skipPattern, hiddenPC)) {
        this.ctx.save();
        this.ctx.globalAlpha = 160 / 255;
        this.ctx.fillStyle = rgb(COLOR.cData2);
        // Full row = 2 * HALF_ROW_PX tall; band = HALF_ROW_PX tall, centered →
        // top inset = HALF_ROW_PX / 2.
        this.ctx.fillRect(
          this.px(p.l + 1),
          this.py(row) + (HALF_ROW_PX >> 1),
          (p.w - 2) * CHAR_WIDTH_PX,
          HALF_ROW_PX
        );
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

  /**
   * Update the displayed disassembly top per the auto-scroll algorithm (§6.6).
   * Only ever runs in dmPC, so every write below lands in the dmPC-only scroll
   * position — never in CogAddr/HubAddr (see the address model in DebuggerState).
   */
  private updateDisTopAddr(): void {
    if (this.state.disMode !== DisMode.dmPC) return;
    const pc = this.state.pc;
    const top = this.state.disAddr;
    const isHub = pc >= 0x400;
    const step = isHub ? 4 : 1;
    const firstVisible = top;
    const lastVisible = top + (DIS_LINES - 1) * step;

    // PC jumped far: snap.
    const jumped = Math.abs(pc - top - DIS_LINE_IDEAL * step) > 8 * step;
    if (jumped) {
      this.state.disAddr = (pc - DIS_LINE_IDEAL * step) & (isHub ? 0xFFFFF : 0x3FF);
      this.state.disScrollTimer = 0;
      return;
    }
    // Off-screen: snap.
    if (pc < firstVisible) {
      this.state.disAddr = pc & (isHub ? 0xFFFFF : 0x3FF);
      this.state.disScrollTimer = 0;
      return;
    }
    if (pc > lastVisible) {
      this.state.disAddr = (pc - (DIS_LINES - 1) * step) & (isHub ? 0xFFFFF : 0x3FF);
      this.state.disScrollTimer = 0;
      return;
    }
    // Gradual scroll toward ideal after threshold breaks.
    this.state.disScrollTimer++;
    if (this.state.disScrollTimer >= DIS_SCROLL_THRESHOLD) {
      const idealTop = pc - DIS_LINE_IDEAL * step;
      if (top < idealTop) this.state.disAddr = (top + step) & (isHub ? 0xFFFFF : 0x3FF);
      else if (top > idealTop) this.state.disAddr = (top - step) & (isHub ? 0xFFFFF : 0x3FF);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.7 — Register watch
  // ──────────────────────────────────────────────────────────────────────

  private renderRegisterWatch(): void {
    const p = PANEL.WATCH;
    const list = this.state.regWatchList;
    // Pascal :1570-1584: two mutually-exclusive states.
    //  Empty  → draw 'REG' + a delta marker ONCE (at WATCHl+3+q2 / +7+q2); nothing else.
    //  Filled → NO header; each used slot i draws addr+value at row WATCHt+i*2.
    if (!list[0]) {
      this.drawText(this.ctx, 'REG', p.l + 3.5, p.t, COLOR.cName, true, true);
      this.drawText(this.ctx, '▲', p.l + 7.5, p.t, COLOR.cName);
      return;
    }
    for (let i = 0; i < this.state.regWatchListMax; i++) {
      const e = list[i];
      if (!e) continue; // Pascal skips empty slots — draws no per-row marker.
      const row = p.t + i * 2; // slot-indexed row, starting at WATCHt (no +2)
      this.drawText(this.ctx, hex(e.address, 3), p.l, row, COLOR.cData2, true); // bold addr
      this.drawText(this.ctx, hex(e.value, 8), p.l + 4, row, COLOR.cData);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.16 — Smart-pin watch
  // ──────────────────────────────────────────────────────────────────────

  private renderSmartPinWatch(): void {
    const p = PANEL.SMART;
    const list = this.state.smartWatchList;
    // Pascal :1619-1635, mirrors the WATCH panel: empty → 'RQPIN' + delta once;
    // filled → no title, each used slot i at SMARTl+q2+i*14 with P## in cData2
    // bold and the value in cData.
    if (!list[0]) {
      this.drawText(this.ctx, 'RQPIN', p.l, p.t, COLOR.cName, true, true);
      this.drawText(this.ctx, '▲', p.l + 6, p.t, COLOR.cName);
      return;
    }
    for (let i = 0; i < this.state.smartWatchListMax; i++) {
      const e = list[i];
      if (!e) continue;
      const x = p.l + 0.5 + i * 14; // SMARTl + q2 + i*14
      this.drawText(this.ctx, 'P' + String(e.pin).padStart(2, '0'), x, p.t, COLOR.cData2, true);
      this.drawText(this.ctx, hex(e.value, 8), x + 4, p.t, COLOR.cData);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // §6.19 — Hint bar
  // ──────────────────────────────────────────────────────────────────────

  public hintText: string = '';
  private renderHint(): void {
    const p = PANEL.HINT;
    if (this.hintText) {
      // §8 — fly-over hints are orange italic (Pascal DebuggerUnit.pas:1917,
      // cIndicator + fsItalic), not white.
      this.drawText(this.ctx, this.hintText, p.l + 1, p.t, COLOR.cIndicator, false, true);
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
    return ' Go'; // Pascal GoCaption := ' Go' (leading space, :1783)
  }

  private renderButtons(): void {
    const panelLeftPx = this.px(PANEL.B.l);
    const panelTopPx = this.py(PANEL.B.t);

    for (const btn of BUTTONS) {
      // GO is special: always orange, redrawn at full brightness even when the
      // window is dimmed (Pascal :2056 / :1126) — handled by renderGoButton.
      if (btn.name === 'GO') { this.renderGoButton(); continue; }

      // Convert the button's pixel offset back to (fractional) grid coords so
      // the §1 drawBox + drawText/arrow helpers all share one coordinate space.
      const col = (panelLeftPx + btn.xOffsetPx) / CHAR_WIDTH_PX;
      const halfRow = (panelTopPx + btn.yOffsetPx) / HALF_ROW_PX;
      const active = this.isButtonActive(btn.name);

      // Mode buttons bright when active, dim otherwise (Pascal base :2029 dim →
      // dynamic :1700 bright). Tabs are small with rim=3.
      const boxColor = active ? COLOR.cModeButton : COLOR.cModeButtonDim;
      const textColor = active ? COLOR.cModeText : COLOR.cModeTextDim;
      this.drawBox(this.ctx, col, halfRow, btn.wCells, btn.hHalfRows, boxColor, 3, true);

      switch (btn.name) {
        // INT*-Entry: right-arrow + the plain INT label (Pascal :2032-2040 / :1730-1750).
        case 'INT3E': case 'INT2E': case 'INT1E':
          this.drawArrowRight(col - 0.25, halfRow, textColor);
          this.drawText(this.ctx, btn.name.slice(0, 4), col + 1, halfRow, textColor, true);
          break;
        // EVENT: event-name + up-arrow (Pascal :2045-2046 / :1757-1765).
        case 'EVENT':
          this.drawText(this.ctx, EVENT_NAMES[this.state.breakEvent & 0xF] || 'EVT', col - 0.25, halfRow, textColor, true);
          this.drawArrowUp(col + 3, halfRow, textColor);
          break;
        // ADDR: the break address hex, not the word 'ADDR' (Pascal :1766-1773).
        case 'ADDR':
          this.drawText(this.ctx, hex(this.state.breakAddr & 0xFFFFF, 5), col, halfRow, textColor, true);
          break;
        default:
          this.drawText(this.ctx, btn.name, col, halfRow, textColor, true);
      }
    }
  }

  /**
   * Draw the GO button (box + Go/Stop/Break caption) at full brightness. Split
   * out from renderButtons because the §7 idle dim redraws ONLY this button over
   * the dimmed frame so it stays orange (Pascal FormBreakpointTimeout:1123-1126).
   */
  private renderGoButton(): void {
    const btn = BUTTONS.find(b => b.name === 'GO');
    if (!btn) return;
    const col = (this.px(PANEL.B.l) + btn.xOffsetPx) / CHAR_WIDTH_PX;
    const halfRow = (this.py(PANEL.B.t) + btn.yOffsetPx) / HALF_ROW_PX;
    // Full rim=6, not small (Pascal :2056). Press-flash: while GoState>0 the
    // button colors invert for a couple of frames (Pascal :1784-1788).
    const flash = this.state.goFlash > 0;
    const boxColor = flash ? COLOR.cCmdText : COLOR.cCmdButton;
    const textColor = flash ? COLOR.cCmdButton : COLOR.cCmdText;
    this.drawBox(this.ctx, col, halfRow, btn.wCells, btn.hHalfRows, boxColor, 6, false);
    const cap = this.goCaption();
    const goCol = cap === 'Break' ? col + 2.5 : col + 3;
    this.drawText(this.ctx, cap, goCol, halfRow, textColor, true);
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
    const topPx = this.py(p.t);
    const lineH = 2 * HALF_ROW_PX; // 16 px per line
    const idx = Math.floor((py - topPx) / lineH);
    return idx >= 0 && idx < DIS_LINES ? idx : -1;
  }

  /** Translate a disassembly line index to its cog/hub address. */
  public disassemblyLineAddress(lineIdx: number): number {
    const top = this.state.disAddr;
    const isHub = this.state.disMode === DisMode.dmHub || top >= 0x400;
    return isHub
      ? (top + lineIdx * 4) & 0xFFFFF
      : (top + lineIdx) & 0x3FF;
  }
}
