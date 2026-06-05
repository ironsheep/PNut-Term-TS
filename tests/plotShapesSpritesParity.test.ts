/** @format */

// [9win §13b] PLOT shapes & sprites parity vs Pascal DebugDisplayUnit.pas.
// Covers the §13b deliverables:
//   1. SPRITE orientations 0-7 are flip/transpose matrix variants (Pascal :2123-2133),
//      NOT 90-degree rotations. Verified against a literal transcription of the Pascal
//      case table via DebugPlotWindow.spritePixelOffset().
//   2. buildSpritePixels() combines per-pixel sprite alpha with SPRITE opacity exactly
//      as Pascal :2120-2122 (opa := ((c shr 24 and $FF) * t6 + $FF) shr 8) and drops
//      fully-transparent pixels (Pascal `if opa <> 0`).
//   3. OBOX width height xradius yradius {linesize {opacity}} (Pascal key_obox :2015,2034)
//      renders a rounded rectangle centered on the cursor.

import { DebugPlotWindow } from '../src/classes/debugPlotWin';

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

// ---------------------------------------------------------------------------
// Literal transcription of Pascal DebugDisplayUnit.pas:2124-2131 (1-based x,y).
// Returns the destination CELL offset (before *scale) the Pascal case table adds.
// ---------------------------------------------------------------------------
function pascalCellOffset(orient: number, x: number, y: number, t7: number, t8: number): [number, number] {
  switch (orient) {
    case 0:
      return [x - 1, y - 1];
    case 1:
      return [t7 - x, y - 1];
    case 2:
      return [x - 1, t8 - y];
    case 3:
      return [t7 - x, t8 - y];
    case 4:
      return [y - 1, x - 1];
    case 5:
      return [y - 1, t7 - x];
    case 6:
      return [t8 - y, x - 1];
    case 7:
      return [t8 - y, t7 - x];
    default:
      throw new Error(`bad orient ${orient}`);
  }
}

describe('[9win §13b] PLOT sprite orientation flip/transpose matrix', () => {
  // A deliberately non-square sprite so transpose orientations (4-7) are distinguishable.
  const sizeX = 3;
  const sizeY = 2;

  for (let orient = 0; orient <= 7; orient++) {
    it(`orientation ${orient}: spritePixelOffset matches Pascal :2124-2131 for every pixel`, () => {
      const scale = 4;
      for (let row = 0; row < sizeY; row++) {
        for (let col = 0; col < sizeX; col++) {
          const [ox, oy] = pascalCellOffset(orient, col + 1, row + 1, sizeX, sizeY);
          const got = DebugPlotWindow.spritePixelOffset(orient, col, row, sizeX, sizeY, scale);
          expect(got).toEqual({ dx: ox * scale, dy: oy * scale });
        }
      }
    });
  }

  it('orientation 0 is identity (col,row)->(col,row)*scale', () => {
    expect(DebugPlotWindow.spritePixelOffset(0, 2, 1, 3, 2, 1)).toEqual({ dx: 2, dy: 1 });
  });

  it('orientation 1 mirrors X: leftmost source pixel lands at the right edge', () => {
    // col 0 of a width-3 sprite -> cell (2,row)
    expect(DebugPlotWindow.spritePixelOffset(1, 0, 0, 3, 2, 1)).toEqual({ dx: 2, dy: 0 });
  });

  it('orientation 2 mirrors Y: topmost source pixel lands at the bottom edge', () => {
    // row 0 of a height-2 sprite -> cell (col,1)
    expect(DebugPlotWindow.spritePixelOffset(2, 0, 0, 3, 2, 1)).toEqual({ dx: 0, dy: 1 });
  });

  it('orientation 4 transposes: dest is (row,col) — swaps the sprite axes', () => {
    expect(DebugPlotWindow.spritePixelOffset(4, 2, 0, 3, 2, 1)).toEqual({ dx: 0, dy: 2 });
  });

  it('is a pure flip/transpose, never a rotation (no trig rounding)', () => {
    // A 90-degree rotation of a 3x2 sprite would land pixels at fractional/!cell
    // positions; the flip table always returns exact integer cell multiples.
    for (let orient = 0; orient <= 7; orient++) {
      const { dx, dy } = DebugPlotWindow.spritePixelOffset(orient, 1, 1, 3, 2, 3);
      expect(dx % 3).toBe(0);
      expect(dy % 3).toBe(0);
    }
  });
});

describe('[9win §13b] buildSpritePixels opacity & transparency (Pascal :2120-2122)', () => {
  // 2x2 sprite, palette indices -> ARGB colors.
  const width = 2;
  const height = 2;
  const pixels = [0, 1, 2, 3];
  // index0: opaque red, index1: opaque green, index2: half-alpha blue, index3: fully transparent
  const colors = new Array(256).fill(0);
  colors[0] = 0xffff0000; // a=255 r=255
  colors[1] = 0xff00ff00; // a=255 g=255
  colors[2] = 0x800000ff; // a=128 b=255
  colors[3] = 0x00abcdef; // a=0 -> dropped

  it('drops fully transparent pixels (opa==0)', () => {
    const list = DebugPlotWindow.buildSpritePixels(width, height, pixels, colors, 0, 1, 255);
    expect(list.length).toBe(3); // index3 dropped
  });

  it('combines pixel alpha with full opacity per ((a*opacity+255)>>8)', () => {
    const list = DebugPlotWindow.buildSpritePixels(width, height, pixels, colors, 0, 1, 255);
    const red = list.find((p) => p.r === 255 && p.g === 0 && p.b === 0)!;
    expect(red.a).toBe(255); // (255*255+255)>>8
    const blue = list.find((p) => p.b === 255 && p.r === 0)!;
    expect(blue.a).toBe(128); // (128*255+255)>>8
  });

  it('scales opacity: SPRITE opacity 128 halves an opaque pixel', () => {
    const list = DebugPlotWindow.buildSpritePixels(width, height, pixels, colors, 0, 1, 128);
    const red = list.find((p) => p.r === 255)!;
    expect(red.a).toBe(128); // (255*128+255)>>8 == 128
  });

  it('applies orientation to each surviving pixel offset', () => {
    // orientation 1 (flip-X): source col0,row0 (red) -> cell (1,0) for width 2
    const list = DebugPlotWindow.buildSpritePixels(width, height, pixels, colors, 1, 5, 255);
    const red = list.find((p) => p.r === 255)!;
    expect(red).toMatchObject({ dx: 5, dy: 0 }); // (width-1-0)*scale = 1*5
  });
});

// ---------------------------------------------------------------------------
// OBOX dispatch: drive the real parseSimpleCommands switch with a prototype stub,
// capturing the injected renderer JS.
// ---------------------------------------------------------------------------
function makeStub(overrides: Record<string, any> = {}): any {
  const jsCaptured: string[] = [];
  const stub: any = {
    isPrecise: false,
    isCartesian: true,
    vPixelX: 0,
    vPixelY: 0,
    origin: { x: 0, y: 0 },
    cursorPosition: { x: 0, y: 0 },
    polarConfig: { twopi: 0x100000000, theta: 0 },
    cartesianConfig: { xdir: false, ydir: false },
    currFgColor: '#ffffff',
    opacity: 255,
    colorMode: 'RGB24',
    colorTranslator: { setColorMode: () => {} },
    displaySpec: { size: { width: 256, height: 256 }, dotSize: { width: 1, height: 1 }, delayedUpdate: true },
    debugWindow: {
      webContents: {
        executeJavaScript: jest.fn((code: string) => {
          jsCaptured.push(code);
          return Promise.resolve('ok');
        })
      }
    },
    logMessage: () => {},
    jsCaptured,
    // real methods borrowed from the prototype
    parseNumber: proto.parseNumber,
    skipComma: proto.skipComma,
    isColorCommand: proto.isColorCommand,
    isColorModeCommand: proto.isColorModeCommand,
    setPlotColor: proto.setPlotColor,
    setCursorPosition: proto.setCursorPosition,
    getCursorXY: proto.getCursorXY,
    drawOBoxToPlot: proto.drawOBoxToPlot,
    ...overrides
  };
  return stub;
}

describe('[9win §13b] OBOX rounded-rectangle directive (Pascal key_obox :2015,2034)', () => {
  it('OBOX routes to a centered roundRect with the given x/y corner radii', async () => {
    const stub = makeStub();
    await proto.parseSimpleCommands.call(stub, ['Plot', 'SET', '100', '80']);
    await proto.parseSimpleCommands.call(stub, ['Plot', 'OBOX', '40', '20', '5', '5']);
    const oboxJs = stub.jsCaptured.find((c: string) => c.includes('roundRect'));
    expect(oboxJs).toBeDefined();
    // cursor (100,80), ydir false -> yc = 256-80 = 176; centered: xl=100-20=80, yt=176-10=166
    expect(oboxJs).toContain('roundRect(80, 166, 40, 20, [{x: 5, y: 5}])');
    // default lineSize 0 -> filled
    expect(oboxJs).toContain('.fill()');
  });

  it('OBOX with a linesize draws a stroked outline, not a fill', async () => {
    const stub = makeStub();
    await proto.parseSimpleCommands.call(stub, ['Plot', 'OBOX', '40', '20', '8', '4', '2']);
    const oboxJs = stub.jsCaptured.find((c: string) => c.includes('roundRect'));
    expect(oboxJs).toContain('.stroke()');
    expect(oboxJs).toContain('lineWidth = 2');
  });

  it('OBOX clamps corner radii to half the box extent (no Canvas throw)', async () => {
    const stub = makeStub();
    // xradius 999 on a width-40 box clamps to 20; yradius 999 on height-20 clamps to 10
    await proto.parseSimpleCommands.call(stub, ['Plot', 'OBOX', '40', '20', '999', '999']);
    const oboxJs = stub.jsCaptured.find((c: string) => c.includes('roundRect'));
    expect(oboxJs).toContain('[{x: 20, y: 10}]');
  });
});
