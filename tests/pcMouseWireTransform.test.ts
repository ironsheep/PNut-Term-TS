/**
 * PC_MOUSE wire-coordinate transform — [9win §1] (task #3)
 *
 * Validates the shared base transform that mirrors Pascal SendMousePos
 * (DebugDisplayUnit.pas:3555-3568):
 *   - dis_logic/dis_scope/dis_scope_xy/dis_fft/dis_midi -> RAW client pixels.
 *   - dis_spectro/dis_plot/dis_bitmap -> if vDirX x=W-x; if not vDirY y=H-y; /dotSize.
 *   - off-window -> LONG1 0x03FFFFFF, LONG2 0xFFFFFFFF.
 * Plus the LONG1 bit-packing (x bits0-12, y 13-25, wheel 26-27, buttons 28-30).
 */
import { DebugWindowBase } from '../src/classes/debugWindowBase';
import { TLongTransmission } from '../src/classes/shared/tLongTransmission';

// transformPixelDotsize and the default transformMouseCoordinates use only their
// arguments (no instance state), so we can exercise them off the prototype.
const proto = DebugWindowBase.prototype as any;
const pixelDot = (
  x: number,
  y: number,
  opts: { dirX: boolean; dirY: boolean; dotSizeX: number; dotSizeY: number; clientWidth: number; clientHeight: number }
): { x: number; y: number } => proto.transformPixelDotsize.call({}, x, y, opts);
const rawDefault = (x: number, y: number): { x: number; y: number } => proto.transformMouseCoordinates.call({}, x, y);

describe('PC_MOUSE wire transform [9win §1]', () => {
  describe('raw windows (LOGIC/SCOPE/SCOPE_XY/FFT/MIDI) — base default', () => {
    it('returns client pixels unchanged', () => {
      expect(rawDefault(10, 20)).toEqual({ x: 10, y: 20 });
      expect(rawDefault(0, 0)).toEqual({ x: 0, y: 0 });
      expect(rawDefault(255, 1)).toEqual({ x: 255, y: 1 });
    });
  });

  describe('pixel/dotsize windows (SPECTRO/BITMAP) — vDirX=false, vDirY=false', () => {
    const base = { dirX: false, dirY: false, clientWidth: 256, clientHeight: 256 };

    it('inverts Y (bottom-origin), no X flip, dotSize 1', () => {
      expect(pixelDot(10, 20, { ...base, dotSizeX: 1, dotSizeY: 1 })).toEqual({ x: 10, y: 236 });
    });

    it('divides by dotSize after the Y inversion (floored)', () => {
      // y inverts to 256-20=236, /4 -> 59 ; x 10/4 -> 2
      expect(pixelDot(10, 20, { ...base, dotSizeX: 4, dotSizeY: 4 })).toEqual({ x: 2, y: 59 });
    });

    it('treats dotSize 0 as 1 (no divide-by-zero)', () => {
      expect(pixelDot(8, 0, { ...base, dotSizeX: 0, dotSizeY: 0 })).toEqual({ x: 8, y: 256 });
    });
  });

  describe('PLOT — vDirX/vDirY driven by CARTESIAN', () => {
    it('CARTESIAN ydir=true suppresses the Y inversion', () => {
      const r = pixelDot(10, 20, { dirX: false, dirY: true, dotSizeX: 1, dotSizeY: 1, clientWidth: 256, clientHeight: 256 });
      expect(r).toEqual({ x: 10, y: 20 });
    });

    it('xdir=true flips X against clientWidth', () => {
      const r = pixelDot(10, 20, { dirX: true, dirY: true, dotSizeX: 1, dotSizeY: 1, clientWidth: 256, clientHeight: 256 });
      expect(r).toEqual({ x: 246, y: 20 });
    });
  });

  describe('LONG1 bit-packing + off-window sentinel', () => {
    // encodeMouseData / createOutOfBoundsMouseData use only their args (pure),
    // so exercise them off the prototype — avoids the Context-bound constructor.
    const txProto = TLongTransmission.prototype as any;
    const encode = (
      x: number,
      y: number,
      l: boolean,
      m: boolean,
      r: boolean,
      w: number
    ): number => txProto.encodeMouseData.call({}, x, y, l, m, r, w);
    const outOfBounds = (): { position: number; color: number } => txProto.createOutOfBoundsMouseData.call({});

    it('packs x (bits 0-12) and y (bits 13-25)', () => {
      expect(encode(5, 7, false, false, false, 0)).toBe(5 | (7 << 13));
    });

    it('packs wheel (bits 26-27) and buttons (28/29/30)', () => {
      const v = encode(0, 0, true, false, true, 1);
      expect(v & (0x3 << 26)).toBe(1 << 26); // wheel
      expect(v & 0x10000000).toBe(0x10000000); // left
      expect(v & 0x20000000).toBe(0); // middle off
      expect(v & 0x40000000).toBe(0x40000000); // right
    });

    it('masks coordinates to 13 bits', () => {
      expect(encode(0x2000 + 3, 0, false, false, false, 0) & 0x1fff).toBe(3);
    });

    it('emits the Pascal off-window sentinel', () => {
      expect(outOfBounds()).toEqual({ position: 0x03ffffff, color: 0xffffffff });
    });
  });
});
