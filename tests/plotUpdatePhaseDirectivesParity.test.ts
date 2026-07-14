/** @format */

// [9win §13c] PLOT update-phase (runtime) directive parity vs Pascal PLOT_Update
// (DebugDisplayUnit.pas). Drives the real parseSimpleCommands() switch with a prototype
// stub (same technique as plotCoordinateModelParity / plotShapesSpritesParity), so no
// BrowserWindow is needed. Covers the §13c deliverables that are observable through
// parser state / spied helpers:
//   OPACITY (:1944) sets persistent vOpacity; BACKCOLOR (:1932) sets background at runtime;
//   standalone TEXTANGLE (:2041) + MakeTextAngle (:3073-3077); TEXT defaults to the
//   persistent angle (Pascal a[2] := vTextAngle); TEXTSIZE clamps to 6..200 (:2834-2837);
//   ORIGIN no-arg = current pixel (:1950-1956); LUTCOLORS loads up to 256 (:2806-2815);
//   color-mode directives wired at runtime (KeyColorMode, :1928-1929).

import { DebugPlotWindow } from '../src/classes/debugPlotWin';
import { DebugColor } from '../src/classes/shared/debugColor';

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  app: { getPath: jest.fn().mockReturnValue('/mock/path') },
  ipcMain: { on: jest.fn(), removeAllListeners: jest.fn() },
  nativeImage: { createFromBuffer: jest.fn() }
}));
jest.mock('fs', () => ({ existsSync: jest.fn(), mkdirSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock('../src/utils/usb.serial', () => ({ UsbSerial: jest.fn() }));
jest.mock('jimp', () => ({ Jimp: {}, MIME_PNG: 'image/png' }));

const proto = DebugPlotWindow.prototype as any;

function makeStub(overrides: Record<string, any> = {}): any {
  const stub: any = {
    // --- state ---
    isPrecise: false,
    isCartesian: true,
    updateMode: false,
    vPixelX: 0,
    vPixelY: 0,
    opacity: 255,
    textAngle: 0,
    lineSize: 1,
    origin: { x: 0, y: 0 },
    cursorPosition: { x: 0, y: 0 },
    polarConfig: { twopi: 0x100000000, theta: 0 },
    cartesianConfig: { xdir: false, ydir: false },
    currFgColor: '#ffffff',
    currTextColor: '#ffffff',
    colorMode: 'RGB24',
    colorTranslator: { setColorMode: jest.fn(), translateColor: (v: number) => v & 0xffffff },
    font: { textSizePts: 10, charHeight: 13 },
    textStyle: {},
    pendingOperations: [] as any[],
    displaySpec: {
      size: { width: 256, height: 256 },
      dotSize: { width: 1, height: 1 },
      window: { background: '#000000' },
      delayedUpdate: true
    },
    logMessage: () => {},
    // --- spies / no-ops to keep the parser self-contained ---
    processLutCommand: jest.fn(),
    setFontMetrics: jest.fn(),
    // --- real methods borrowed from the prototype ---
    parseNumber: proto.parseNumber,
    skipComma: proto.skipComma,
    isColorCommand: proto.isColorCommand,
    isColorModeCommand: proto.isColorModeCommand,
    resolveKeyColor: proto.resolveKeyColor,
    applyColorDirective: proto.applyColorDirective,
    setCursorPosition: proto.setCursorPosition,
    getCursorXY: proto.getCursorXY,
    makeTextAngle: proto.makeTextAngle,
    processLutColorsCommand: proto.processLutColorsCommand
  };
  return { ...stub, ...overrides };
}

async function run(stub: any, line: string[]): Promise<void> {
  await proto.parseSimpleCommands.call(stub, line);
}

describe('[9win §13c] OPACITY directive (Pascal key_opacity :1944)', () => {
  it('OPACITY sets the persistent opacity used by subsequent draws', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'OPACITY', '128']);
    expect(stub.opacity).toBe(128);
  });

  it('OPACITY truncates to a byte — it does NOT clamp (Pascal :1944-1945)', async () => {
    // Pascal is a bare `vOpacity := val` into a `byte` field (:342) with range checks off
    // ({$Q-,R-} at :1), so an out-of-range value WRAPS rather than saturating.
    // The practical footgun: OPACITY 256 -> 0 = fully TRANSPARENT, not fully opaque.
    const hi = makeStub();
    await run(hi, ['Plot', 'OPACITY', '300']);
    expect(hi.opacity).toBe(44); // 300 & 0xFF
    const lo = makeStub();
    await run(lo, ['Plot', 'OPACITY', '-5']);
    expect(lo.opacity).toBe(251); // -5 & 0xFF
  });
});

describe('[9win §13c] BACKCOLOR directive at runtime (Pascal key_backcolor :1932)', () => {
  it('BACKCOLOR sets the background to the named directive color', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'BACKCOLOR', 'RED']);
    expect(stub.displaySpec.window.background).toBe(new DebugColor('RED', 8).rgbString);
    expect(stub.displaySpec.window.background).not.toBe('#000000');
  });

  it('BACKCOLOR with a numeric arg goes through the active color MODE (ColorTranslator)', async () => {
    // The stub translator is identity-masked; in RGB24 mode $112233 stays #112233. Proves the
    // numeric path is taken (Pascal KeyColor: TranslateColor(val, vColorMode)), not a name.
    const stub = makeStub();
    await run(stub, ['Plot', 'BACKCOLOR', '$112233']);
    expect(stub.displaySpec.window.background).toBe('#112233');
  });

  it('a non-color BACKCOLOR arg leaves the default and does not abort (C4)', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'BACKCOLOR', 'TEXT']); // TEXT is not a color
    expect(stub.displaySpec.window.background).toBe('#000000');
  });
});

describe('[9win §13c] COLOR directive at runtime (Pascal key_color :1934-1943, unified KeyColor)', () => {
  it('COLOR <name> sets the plot color via the shared parseKeyColor', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'COLOR', 'RED']);
    expect(stub.currFgColor).toBe(new DebugColor('RED', 8).rgbString);
  });

  it('COLOR <name> <brightness> honors the brightness byte', async () => {
    const dim = makeStub();
    await run(dim, ['Plot', 'COLOR', 'RED', '2']);
    const full = makeStub();
    await run(full, ['Plot', 'COLOR', 'RED', '15']);
    expect(dim.currFgColor).not.toBe(full.currFgColor);
  });

  it('COLOR followed by TEXT also sets the text color (Pascal vTextColor := vPlotColor)', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'COLOR', 'RED', 'TEXT']);
    expect(stub.currTextColor).toBe(stub.currFgColor);
    expect(stub.currTextColor).toBe(new DebugColor('RED', 8).rgbString);
  });

  it('a bare color name behaves identically to COLOR <name> (same KeyColor arm)', async () => {
    const bare = makeStub();
    await run(bare, ['Plot', 'GREEN']);
    const kw = makeStub();
    await run(kw, ['Plot', 'COLOR', 'GREEN']);
    expect(bare.currFgColor).toBe(kw.currFgColor);
  });

  it('COLOR <numeric> uses the active color MODE (ColorTranslator), not a literal name', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'COLOR', '$00FF00']);
    expect(stub.currFgColor).toBe('#00ff00');
  });
});

describe('[9win §13c] TEXTANGLE + MakeTextAngle (Pascal :2041,3073-3077)', () => {
  it('TEXTANGLE sets the persistent text angle (normalized to 0..359)', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'TEXTANGLE', '90']);
    expect(stub.textAngle).toBe(90);
  });

  it('MakeTextAngle wraps via mod 360 (Pascal val mod 360)', async () => {
    const a = makeStub();
    await run(a, ['Plot', 'TEXTANGLE', '450']);
    expect(a.textAngle).toBe(90); // 450 mod 360
    const b = makeStub();
    await run(b, ['Plot', 'TEXTANGLE', '-90']);
    expect(b.textAngle).toBe(270); // normalized negative
  });

  it('polar mode maps a full twopi to 360 degrees', () => {
    const stub = makeStub({ isCartesian: false, polarConfig: { twopi: 0x100000000, theta: 0 } });
    // quarter turn -> 90 degrees
    expect(proto.makeTextAngle.call(stub, 0x100000000 / 4)).toBe(90);
    expect(proto.makeTextAngle.call(stub, 0x100000000 / 2)).toBe(180);
  });
});

describe('[9win §13c] TEXT defaults to the persistent angle (Pascal a[2] := vTextAngle :2047)', () => {
  it('a TEXT with no explicit angle inherits the TEXTANGLE value', async () => {
    const stub = makeStub({ updateMode: true });
    await run(stub, ['Plot', 'TEXTANGLE', '45']);
    await run(stub, ['Plot', 'TEXT', "'hi'"]);
    const op = stub.pendingOperations[stub.pendingOperations.length - 1];
    expect(op.parameters.angle).toBe(45);
  });

  it('an explicit TEXT angle overrides for that draw but does NOT persist', async () => {
    const stub = makeStub({ updateMode: true });
    await run(stub, ['Plot', 'TEXTANGLE', '45']);
    await run(stub, ['Plot', 'TEXT', '10', '1', '90', "'hi'"]);
    const op = stub.pendingOperations[stub.pendingOperations.length - 1];
    expect(op.parameters.angle).toBe(90); // transient override
    expect(stub.textAngle).toBe(45); // persistent value unchanged
  });
});

describe('[9win §13c] TEXTSIZE range 6..200 (Pascal KeyTextSize :2834-2837)', () => {
  it('accepts a value within 6..200', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'TEXTSIZE', '200']);
    expect(stub.font.textSizePts).toBe(200);
  });

  it('rejects a value below 6 (was previously 1..100)', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'TEXTSIZE', '5']);
    expect(stub.font.textSizePts).toBe(10); // unchanged
  });

  it('rejects a value above 200', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'TEXTSIZE', '201']);
    expect(stub.font.textSizePts).toBe(10); // unchanged
  });
});

describe('[9win §13c] ORIGIN no-arg = current pixel (Pascal :1950-1956)', () => {
  it('ORIGIN with no args sets the offset to the current cursor pixel', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'SET', '30', '40']);
    await run(stub, ['Plot', 'ORIGIN']);
    expect(stub.origin).toEqual({ x: 30, y: 40 });
  });

  it('ORIGIN x y still sets the explicit offset', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'ORIGIN', '5', '6']);
    expect(stub.origin).toEqual({ x: 5, y: 6 });
  });
});

describe('[9win §13c] LUTCOLORS up to 256 entries (Pascal KeyLutColors :2806-2815)', () => {
  it('loads more than the old 8-color cap', async () => {
    const stub = makeStub();
    const colors = Array.from({ length: 12 }, (_, i) => `$${(i * 0x111111).toString(16)}`);
    await run(stub, ['Plot', 'LUTCOLORS', ...colors]);
    expect(stub.processLutCommand).toHaveBeenCalledTimes(12); // was capped at 8
  });
});

describe('[9win §13c] color-mode directive wired at runtime (Pascal KeyColorMode :1928-1929)', () => {
  it('a color-mode token sets the active mode and the translator', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'RGBI8']);
    expect(stub.colorMode).toBe('RGBI8');
    expect(stub.colorTranslator.setColorMode).toHaveBeenCalledWith('RGBI8');
  });

  it('LUT8 likewise switches the runtime color mode', async () => {
    const stub = makeStub();
    await run(stub, ['Plot', 'LUT8']);
    expect(stub.colorMode).toBe('LUT8');
    expect(stub.colorTranslator.setColorMode).toHaveBeenCalledWith('LUT8');
  });
});
