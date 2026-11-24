/** @format */

/**
 * The debugger's disassembly rows, drawn as DebuggerUnit.pas:1484-1535 draws them.
 *
 * renderDisassembly() is run for real on a recording canvas. It uses only the
 * state, the disassembler, and the renderer's own drawing helpers, so the
 * renderer is built without its constructor (which needs OffscreenCanvas).
 */

import { makeDebuggerState, MSG } from './shared/debuggerFixture';
import { DebuggerRenderer } from '../src/classes/debugger/renderer/DebuggerRenderer';
import { DisMode } from '../src/classes/debugger/renderer/DebuggerState';
import { Pasm2Disassembler } from '../src/classes/debugger/renderer/pasm2Disassembler';
import {
  CHAR_WIDTH_PX, CHAR_HEIGHT_PX, HALF_ROW_PX, PANEL, COLOR, BREAK_ADDR, ROM_DEBUG_STRINGS
} from '../src/classes/debugger/shared/constants';

interface TextCall { text: string; x: number; y: number; color: string; bold: boolean }
interface ShapeCall { x: number; y: number; w: number; h: number; color: string; alpha: number }

function recordingCtx() {
  const texts: TextCall[] = [];
  const shapes: ShapeCall[] = [];
  const other: string[] = [];
  let pending: { x: number; y: number; w: number; h: number } | null = null;
  const ctx: any = {
    font: '', fillStyle: '', strokeStyle: '', globalAlpha: 1, textBaseline: '', lineWidth: 1,
    save() { this._saved = this.globalAlpha; },
    restore() { this.globalAlpha = this._saved ?? 1; },
    beginPath() { pending = null; },
    roundRect(x: number, y: number, w: number, h: number) { pending = { x, y, w, h }; },
    fill() { if (pending) shapes.push({ ...pending, color: this.fillStyle, alpha: this.globalAlpha }); },
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y, color: this.fillStyle, bold: /\bbold\b/.test(this.font) });
    },
    fillRect() { other.push('fillRect'); },
    arc() { other.push('arc'); },
    stroke() { other.push('stroke'); },
  };
  return { ctx, texts, shapes, other };
}

const hexColor = (c: number) => '#' + (c & 0xFFFFFF).toString(16).padStart(6, '0');
const P = PANEL.DIS;
const colX = (col: number) => col * CHAR_WIDTH_PX;
const rowY = (i: number) => (P.t + i * 2) * HALF_ROW_PX;

function render(setup: (s: ReturnType<typeof makeDebuggerState>) => void) {
  const state = makeDebuggerState();
  setup(state);
  const rec = recordingCtx();
  const r: any = Object.create(DebuggerRenderer.prototype);
  r.state = state;
  r.ctx = rec.ctx;
  r.disasm = new Pasm2Disassembler();
  r.fontPx = CHAR_HEIGHT_PX - 3;
  r.renderDisassembly();
  const row = (i: number) => rec.texts.filter((t) => t.y === rowY(i));
  return { ...rec, row, state };
}

/** The shared highlight footprint (:1485-1488). */
const BAR = {
  x: colX(P.l + 35) + (CHAR_WIDTH_PX >> 1) - (CHAR_WIDTH_PX * 42) / 2,
  w: CHAR_WIDTH_PX * 42,
  h: (CHAR_HEIGHT_PX * 7) >> 3,
};
const barTop = (i: number, h: number) => (P.t + 1 + i * 2) * HALF_ROW_PX - h / 2;

describe('Debugger disassembly rows — DebuggerUnit.pas:1484-1535', () => {
  it('address, hex and text sit at DISl, DISl+6 and DISl+15', () => {
    const { row } = render((s) => { s.disMode = DisMode.dmCog; s.cogAddr = 0x010; s.message[MSG.IRET] = 0x000; });
    const [addr, hexWord, text] = row(0);
    expect(addr.x).toBe(colX(P.l));
    expect(hexWord.x).toBe(colX(P.l + 6));
    expect(text.x).toBe(colX(P.l + 15));
  });

  it('the address is bold cData2, the hex is cData, the text is cData2 (not bold)', () => {
    const { row } = render((s) => { s.disMode = DisMode.dmCog; s.cogAddr = 0x010; s.message[MSG.IRET] = 0x000; });
    const [addr, hexWord, text] = row(0);
    expect(addr).toMatchObject({ text: 'R-010', color: hexColor(COLOR.cData2), bold: true });
    expect(hexWord).toMatchObject({ color: hexColor(COLOR.cData), bold: false });
    expect(text).toMatchObject({ color: hexColor(COLOR.cData2), bold: false });
    expect(text.text).toHaveLength(41);
  });

  it('LUT rows read L-200..L-3FF (the address is not masked to 9 bits)', () => {
    const { row } = render((s) => { s.disMode = DisMode.dmCog; s.cogAddr = 0x1FC; s.message[MSG.IRET] = 0x000; });
    expect(row(3)[0].text).toBe('R-1FF');
    expect(row(4)[0].text).toBe('L-200');
    expect(row(15)[0].text).toBe('L-20B');
  });

  it('in cog view $1F8..$1FF are the debug ROM: "[ROM]" + 8 spaces + its string', () => {
    const { row } = render((s) => { s.disMode = DisMode.dmCog; s.cogAddr = 0x1F8; s.message[MSG.IRET] = 0x000; });
    for (let i = 0; i < 8; i++) {
      expect(row(i)[2].text).toBe('[ROM]        ' + ROM_DEBUG_STRINGS[i]);
    }
    expect(row(8)[2].text).not.toMatch(/^\[ROM\]/);
  });

  it('the PC row: rounded cData bar over the text only, text bold cBox2, address and hex unchanged', () => {
    const { row, shapes, other } = render((s) => { s.disMode = DisMode.dmCog; s.cogAddr = 0x010; s.message[MSG.IRET] = 0x013; });
    const [addr, hexWord, text] = row(3);
    expect(addr).toMatchObject({ color: hexColor(COLOR.cData2), bold: true });
    expect(hexWord).toMatchObject({ color: hexColor(COLOR.cData), bold: false });
    expect(text).toMatchObject({ color: hexColor(COLOR.cBox2), bold: true });
    expect(shapes).toEqual([{ x: BAR.x, y: barTop(3, BAR.h), w: BAR.w, h: BAR.h, color: hexColor(COLOR.cData), alpha: 1 }]);
    expect(other).not.toContain('fillRect');   // no full-width rectangle
  });

  it('no PC bar for a cog-range PC while the view is hub (HiddenPC)', () => {
    const { shapes, other, row } = render((s) => { s.disMode = DisMode.dmHub; s.hubAddr = 0x000; s.message[MSG.IRET] = 0x008; });
    expect(row(2)[0].text).toBe('00008');                // the PC's row is on screen
    expect(row(2)[2]).toMatchObject({ color: hexColor(COLOR.cData2), bold: false });
    expect(shapes).toEqual([]);
    expect(other).not.toContain('fillRect');
  });

  it('a SKIP row gets a half-height cData2 band at 160/255 on the same footprint', () => {
    const { shapes } = render((s) => {
      s.disMode = DisMode.dmCog; s.cogAddr = 0x010; s.message[MSG.IRET] = 0x010;
      s.message[MSG.BRKZ] = 1 << 2;            // the instruction two after the PC is skipped
    });
    const band = shapes.find((sh) => sh.color === hexColor(COLOR.cData2));
    expect(band).toEqual({ x: BAR.x, y: barTop(2, BAR.h >> 1), w: BAR.w, h: BAR.h >> 1, color: hexColor(COLOR.cData2), alpha: 160 / 255 });
  });

  it('an address breakpoint is a cName highlight at 64/255 over the text — not a red dot', () => {
    const { shapes, other } = render((s) => {
      s.disMode = DisMode.dmCog; s.cogAddr = 0x010; s.message[MSG.IRET] = 0x000;
      s.breakValue = BREAK_ADDR | (0x015 << 12);
    });
    expect(shapes).toEqual([{ x: BAR.x, y: barTop(5, BAR.h), w: BAR.w, h: BAR.h, color: hexColor(COLOR.cName), alpha: 64 / 255 }]);
    expect(other).not.toContain('arc');
  });

  it('SFR addresses $1F0..$1FF are bold cData2 (DebuggerUnit.pas:1986)', () => {
    const state = makeDebuggerState();
    const rec = recordingCtx();
    const r: any = Object.create(DebuggerRenderer.prototype);
    Object.assign(r, { state, ctx: rec.ctx, fontPx: CHAR_HEIGHT_PX - 3 });
    r.renderSFR();
    const addrs = rec.texts.filter((t) => /^1F[0-9A-F]$/.test(t.text));
    expect(addrs).toHaveLength(16);
    for (const a of addrs) expect(a).toMatchObject({ color: hexColor(COLOR.cData2), bold: true });
  });

  it('hub rows show five-digit addresses four bytes apart', () => {
    const { row } = render((s) => { s.disMode = DisMode.dmHub; s.hubAddr = 0x01000; s.message[MSG.IRET] = 0x000; });
    expect(row(0)[0].text).toBe('01000');
    expect(row(1)[0].text).toBe('01004');
  });
});
