/** @format */

// [9win §15] BITMAP window residual parity vs Pascal BITMAP_Configure / BITMAP_Update and the
// shared color/pack helpers (DebugDisplayUnit.pas). Exercises the static config parser
// parseBitmapDeclaration() and the private instance methods (parseColorModeCommand /
// getPackedDataMode / getBackground / enforceSparseDotSizeConstraint) plus the static
// named-color helper, against lightweight prototype-stub `this` objects with REAL
// ColorTranslator / LUTManager — no BrowserWindow needed.
//
// Covers the §15 deliverables:
//   1. Default color mode is RGB24, decoded one sample per long (Pascal SetDefaults :2889/:2915)
//   2. LUTCOLORS overwrites the palette from index 0 every call (Pascal KeyLutColors :2806-2814)
//   3. RGBI8/W/X, LUT*, RGB* consume NO tune token; LUMA8 (name|num) and HSV (num) do
//      (Pascal KeyColorMode :2786-2803)
//   4. W-mode (LUMA8W/HSV8W/RGBI8W/HSV16W) clears to white via GetBackground (:3180-3204)
//   5. SPARSE is disabled unless both dot dimensions are >= 4 (Pascal SetSize :2938)
//   6. SPARSE / LUTCOLORS accept color names with optional brightness (Pascal KeyColor :2752)

import { DebugBitmapWindow } from '../src/classes/debugBitmapWin';
import { ColorTranslator, ColorMode } from '../src/classes/shared/colorTranslator';
import { LUTManager } from '../src/classes/shared/lutManager';
import { ePackedDataMode, ePackedDataWidth } from '../src/classes/debugWindowBase';

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  app: { getPath: jest.fn().mockReturnValue('/mock/path') },
  ipcMain: { on: jest.fn(), removeAllListeners: jest.fn() },
  nativeImage: { createFromBuffer: jest.fn() }
}));
jest.mock('fs', () => ({ existsSync: jest.fn(), mkdirSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock('../src/utils/usb.serial', () => ({ UsbSerial: jest.fn() }));
jest.mock('jimp', () => ({ Jimp: {}, MIME_PNG: 'image/png' }));

const proto = DebugBitmapWindow.prototype as any;

// Build a minimal `this` for the private instance methods under test, with real shared helpers.
function makeStub(overrides: any = {}) {
  const lutManager = new LUTManager();
  const colorTranslator = new ColorTranslator();
  const stub: any = {
    state: {
      width: 256,
      height: 256,
      dotSizeX: 1,
      dotSizeY: 1,
      colorMode: ColorMode.RGB24,
      colorTune: 0,
      sparseMode: false,
      backgroundColor: 0x000000,
      ...overrides.state
    },
    lutManager,
    colorTranslator,
    isNumeric: proto.isNumeric,
    logMessage: () => {},
    ...overrides
  };
  return stub;
}

describe('[9win §15] BITMAP default color mode is RGB24, one sample per long', () => {
  it('a BITMAP declaration with no color mode leaves colorMode unset so the RGB24 default applies', () => {
    const [ok, spec] = DebugBitmapWindow.parseBitmapDeclaration(['BITMAP', 'MyBmp', 'SIZE', '64', '64']);
    expect(ok).toBe(true);
    expect(spec.colorMode).toBeUndefined(); // constructor applies `?? ColorMode.RGB24`
  });

  it('RGB24 decodes as one whole long per sample (PDM_UNKNOWN / LONGS, not packed bytes)', () => {
    const stub = makeStub({ state: { colorMode: ColorMode.RGB24 } });
    const mode = proto.getPackedDataMode.call(stub);
    expect(mode.mode).toBe(ePackedDataMode.PDM_UNKNOWN);
    expect(mode.bitsPerSample).toBe(32);
    expect(mode.valueSize).toBe(ePackedDataWidth.PDW_LONGS);
  });

  it('the fallback (unmapped) color mode also yields one sample per long, not LONGS_8BIT', () => {
    const stub = makeStub({ state: { colorMode: 9999 as unknown as ColorMode } });
    const mode = proto.getPackedDataMode.call(stub);
    expect(mode.mode).toBe(ePackedDataMode.PDM_UNKNOWN);
    expect(mode.valueSize).toBe(ePackedDataWidth.PDW_LONGS);
  });
});

describe('[9win §15] color-mode tune is consumed only for LUMA8 / HSV groups', () => {
  it('RGBI8 consumes NO tune — a following value is pixel data', () => {
    const stub = makeStub();
    const consumed = proto.parseColorModeCommand.call(stub, 'RGBI8', ['100', '200']);
    expect(consumed).toBe(0);
    expect(stub.state.colorMode).toBe(ColorMode.RGBI8);
  });

  it('LUT2 and RGB24 consume NO tune', () => {
    const a = makeStub();
    expect(proto.parseColorModeCommand.call(a, 'LUT2', ['5'])).toBe(0);
    const b = makeStub();
    expect(proto.parseColorModeCommand.call(b, 'RGB24', ['255'])).toBe(0);
  });

  it('LUMA8 consumes a numeric tune (stored & 0xFF)', () => {
    const stub = makeStub();
    const consumed = proto.parseColorModeCommand.call(stub, 'LUMA8', ['3', '255']);
    expect(consumed).toBe(1);
    expect(stub.state.colorTune).toBe(3);
  });

  it('LUMA8 consumes a color-name tune (ORANGE..GRAY => 0..7)', () => {
    const stub = makeStub();
    const consumed = proto.parseColorModeCommand.call(stub, 'LUMA8', ['CYAN']);
    expect(consumed).toBe(1);
    expect(stub.state.colorTune).toBe(3); // ORANGE=0,BLUE=1,GREEN=2,CYAN=3
  });

  it('LUMA8 followed by a non-tune token consumes nothing (Pascal Dec(ptr))', () => {
    const stub = makeStub();
    const consumed = proto.parseColorModeCommand.call(stub, 'LUMA8', ['$FF0000']);
    expect(consumed).toBe(0);
  });

  it('HSV8 consumes a numeric tune in full 0-255 range (not masked to 0-7)', () => {
    const stub = makeStub();
    const consumed = proto.parseColorModeCommand.call(stub, 'HSV8', ['200']);
    expect(consumed).toBe(1);
    expect(stub.state.colorTune).toBe(200);
  });

  it('HSV8 does NOT consume a color-name token (HSV tune is numeric only)', () => {
    const stub = makeStub();
    const consumed = proto.parseColorModeCommand.call(stub, 'HSV8', ['RED']);
    expect(consumed).toBe(0);
  });

  it('returns -1 when the command is not a color directive', () => {
    const stub = makeStub();
    expect(proto.parseColorModeCommand.call(stub, 'NOTACOLOR', ['1'])).toBe(-1);
  });
});

describe('[9win §15] LUTCOLORS overwrites the palette from index 0', () => {
  it('a second LUTCOLORS overwrites entry 0 rather than appending', () => {
    const stub = makeStub();
    const c1 = proto.parseColorModeCommand.call(stub, 'LUTCOLORS', ['$FF0000', '$00FF00']);
    expect(c1).toBe(2);
    expect(stub.lutManager.getPalette()[0]).toBe(0xff0000);
    expect(stub.lutManager.getPalette()[1]).toBe(0x00ff00);

    const c2 = proto.parseColorModeCommand.call(stub, 'LUTCOLORS', ['$0000FF']);
    expect(c2).toBe(1);
    // Index 0 is overwritten (was 0xFF0000), not appended at index 2.
    expect(stub.lutManager.getPalette()[0]).toBe(0x0000ff);
  });

  it('LUTCOLORS stops consuming at the first non-color token', () => {
    const stub = makeStub();
    const consumed = proto.parseColorModeCommand.call(stub, 'LUTCOLORS', ['$112233', 'TRACE', '5']);
    expect(consumed).toBe(1); // only the one color; TRACE is the next directive
    expect(stub.lutManager.getPalette()[0]).toBe(0x112233);
  });

  it('LUTCOLORS accepts color names with optional brightness', () => {
    const stub = makeStub();
    // BLACK and WHITE are fixed; RED 15 consumes its brightness token.
    const consumed = proto.parseColorModeCommand.call(stub, 'LUTCOLORS', ['BLACK', 'WHITE', 'RED', '15']);
    expect(consumed).toBe(4); // BLACK(1) + WHITE(1) + RED+brightness(2)
    expect(stub.lutManager.getPalette()[0]).toBe(0x000000);
    expect(stub.lutManager.getPalette()[1]).toBe(0xffffff);
    expect(stub.lutManager.getPalette()[2] & 0xffffff).toBeGreaterThan(0); // RED translated via RGBI8X
  });
});

describe('[9win §15] getBackground() is mode-dependent (Pascal GetBackground)', () => {
  it('W modes clear to white', () => {
    for (const mode of [ColorMode.LUMA8W, ColorMode.HSV8W, ColorMode.RGBI8W, ColorMode.HSV16W]) {
      const stub = makeStub({ state: { colorMode: mode } });
      expect(proto.getBackground.call(stub)).toBe(0xffffff);
    }
  });

  it('non-W, non-LUT modes clear to black', () => {
    for (const mode of [ColorMode.RGB24, ColorMode.RGBI8, ColorMode.HSV8, ColorMode.LUMA8]) {
      const stub = makeStub({ state: { colorMode: mode } });
      expect(proto.getBackground.call(stub)).toBe(0x000000);
    }
  });

  it('LUT modes clear to palette entry 0', () => {
    const stub = makeStub({ state: { colorMode: ColorMode.LUT4 } });
    stub.lutManager.setColor(0, 0x123456);
    expect(proto.getBackground.call(stub)).toBe(0x123456);
  });
});

describe('[9win §15] sparse mode requires dot size >= 4 in both dimensions', () => {
  it('sparse is disabled when a dot dimension is < 4', () => {
    const stub = makeStub({ state: { sparseMode: true, dotSizeX: 1, dotSizeY: 8 } });
    proto.enforceSparseDotSizeConstraint.call(stub);
    expect(stub.state.sparseMode).toBe(false);
  });

  it('sparse remains enabled when both dot dimensions are >= 4', () => {
    const stub = makeStub({ state: { sparseMode: true, dotSizeX: 4, dotSizeY: 4 } });
    proto.enforceSparseDotSizeConstraint.call(stub);
    expect(stub.state.sparseMode).toBe(true);
  });
});

describe('[9win §15] named-color parsing (Pascal KeyColor)', () => {
  it('BLACK and WHITE are fixed RGB24 values', () => {
    expect(DebugBitmapWindow['parseNamedColor'](['BLACK'], 0)).toEqual({ color: 0x000000, consumed: 1 });
    expect(DebugBitmapWindow['parseNamedColor'](['WHITE'], 0)).toEqual({ color: 0xffffff, consumed: 1 });
  });

  it('a named color with a trailing brightness consumes two tokens', () => {
    const r = DebugBitmapWindow['parseNamedColor'](['GREEN', '12'], 0);
    expect(r?.consumed).toBe(2);
    expect((r?.color ?? 0) & 0xffffff).toBeGreaterThanOrEqual(0);
  });

  it('a non-color token returns null', () => {
    expect(DebugBitmapWindow['parseNamedColor'](['12345'], 0)).toBeNull();
    expect(DebugBitmapWindow['parseNamedColor'](['TRACE'], 0)).toBeNull();
  });
});
