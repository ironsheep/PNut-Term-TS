/** @format */

// [9win §13a] PLOT coordinate-model parity vs Pascal PLOT_Configure/PLOT_Update/PLOT_GetXY
// (DebugDisplayUnit.pas). Exercises the static parser DebugPlotWindow.parsePlotDeclaration()
// and the private instance methods parseSimpleCommands()/getCursorXY()/setCursorPosition()
// against a prototype-stub `this` (borrowing the real methods), so no BrowserWindow is
// needed — same technique as scopeConfigParity.test.ts.
//
// Covers the §13a deliverables:
//   1. PRECISE default is UNCHANGED (whole-pixel). Pascal vPrecise=8 == TS isPrecise=false;
//      TS DIVIDES by coordinateScale=isPrecise?256:1 where Pascal SHIFTS, so the defaults
//      already agree. (Regression guard against the superseded "flip the default" plan note,
//      which would have turned plain SET 100 into 0.39px and 256x-broken non-precise plots.)
//   2. Standalone PRECISE directive TOGGLES whole-pixel <-> sub-pixel (Pascal vPrecise xor 8).
//   3. ORIGIN is applied at DRAW time in getCursorXY(), not baked at SET — an ORIGIN change
//      issued AFTER SET (but before the draw) is honored.
//   4. Config DOTSIZE x{y} is honored (clamp 1..256), defaulting y to x; default stays 1x1.

import { DebugPlotWindow, PlotDisplaySpec } from '../src/classes/debugPlotWin';

// debugPlotWin.ts imports electron (and friends) at module load — mock them so the static
// method and prototype calls work without a real BrowserWindow.
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

// Build a stub `this` carrying the parser/coordinate state plus the REAL prototype methods,
// so the genuine parsing/coordinate logic runs (not a reimplementation).
function makeStub(overrides: Record<string, any> = {}): any {
  return {
    // --- state ---
    isPrecise: false,
    isCartesian: true,
    vPixelX: 0,
    vPixelY: 0,
    origin: { x: 0, y: 0 },
    cursorPosition: { x: 0, y: 0 },
    polarConfig: { twopi: 0x100000000, theta: 0 },
    // delayedUpdate:true so parseSimpleCommands skips the end-of-line performUpdate() draw
    // flush — we only exercise parser/cursor state here, not rendering.
    displaySpec: { size: { width: 256, height: 256 }, dotSize: { width: 1, height: 1 }, delayedUpdate: true },
    logMessage: () => {},
    // --- real methods borrowed from the prototype ---
    parseNumber: proto.parseNumber,
    skipComma: proto.skipComma,
    isColorCommand: proto.isColorCommand,
    setPlotColor: proto.setPlotColor,
    setCursorPosition: proto.setCursorPosition,
    getCursorXY: proto.getCursorXY,
    ...overrides
  };
}

async function runCommands(stub: any, line: string[]): Promise<void> {
  await proto.parseSimpleCommands.call(stub, line);
}

describe('[9win §13a] PLOT coordinate model parity', () => {
  describe('PRECISE default & toggle (Pascal vPrecise xor 8)', () => {
    it('defaults to whole-pixel: SET n places the cursor at raw n (NOT n/256)', async () => {
      const stub = makeStub();
      expect(stub.isPrecise).toBe(false); // default unchanged — do not flip
      await runCommands(stub, ['Plot', 'SET', '100', '50']);
      // whole-pixel: coordinateScale=1, so vPixel == the literal value
      expect(stub.vPixelX).toBe(100);
      expect(stub.vPixelY).toBe(50);
    });

    it('standalone PRECISE toggles to sub-pixel: SET n then divides by 256', async () => {
      const stub = makeStub();
      await runCommands(stub, ['Plot', 'PRECISE']);
      expect(stub.isPrecise).toBe(true);
      await runCommands(stub, ['Plot', 'SET', '256', '512']);
      // sub-pixel: coordinateScale=256 → 256/256=1, 512/256=2
      expect(stub.vPixelX).toBe(1);
      expect(stub.vPixelY).toBe(2);
    });

    it('PRECISE is a toggle — a second PRECISE returns to whole-pixel', async () => {
      const stub = makeStub();
      await runCommands(stub, ['Plot', 'PRECISE']);
      await runCommands(stub, ['Plot', 'PRECISE']);
      expect(stub.isPrecise).toBe(false);
      await runCommands(stub, ['Plot', 'SET', '100', '50']);
      expect(stub.vPixelX).toBe(100);
    });
  });

  describe('ORIGIN applied at draw time (Pascal PLOT_GetXY), not baked at SET', () => {
    it('getCursorXY() adds the CURRENT origin to the raw cursor (Cartesian)', () => {
      const stub = makeStub({ vPixelX: 50, vPixelY: 60, origin: { x: 10, y: 20 } });
      expect(stub.getCursorXY()).toEqual([60, 80]);
    });

    it('an ORIGIN change AFTER SET affects subsequent draws', async () => {
      const stub = makeStub({ origin: { x: 0, y: 0 } });
      await runCommands(stub, ['Plot', 'SET', '50', '60']); // raw cursor 50,60
      expect(stub.getCursorXY()).toEqual([50, 60]);
      // move the origin AFTER the SET — the cursor was stored raw, so the draw sees the new origin
      stub.origin = { x: 100, y: 5 };
      expect(stub.getCursorXY()).toEqual([150, 65]);
    });

    it('polar mode converts rho/theta against the current origin at draw time', () => {
      // theta=0 → angle 0 → newX=rho*cos0=rho, newY=rho*sin0=0
      const stub = makeStub({
        isCartesian: false,
        vPixelX: 100, // rho
        vPixelY: 0, // theta
        origin: { x: 10, y: 20 }
      });
      expect(stub.getCursorXY()).toEqual([110, 20]);
    });
  });

  describe('config DOTSIZE x {y} (Pascal PLOT_Configure key_dotsize, clamp 1..256)', () => {
    function dotSizeOf(parts: string[]): { width: number; height: number } {
      const [isValid, spec] = DebugPlotWindow.parsePlotDeclaration(['`PLOT', 'P', ...parts]);
      expect(isValid).toBe(true);
      return (spec as PlotDisplaySpec).dotSize;
    }

    it('defaults to 1x1 when DOTSIZE is absent', () => {
      expect(dotSizeOf([])).toEqual({ width: 1, height: 1 });
    });

    it('DOTSIZE n sets both width and height to n', () => {
      expect(dotSizeOf(['DOTSIZE', '4'])).toEqual({ width: 4, height: 4 });
    });

    it('DOTSIZE x y sets width and height independently', () => {
      expect(dotSizeOf(['DOTSIZE', '4', '7'])).toEqual({ width: 4, height: 7 });
    });

    it('clamps to the Pascal 1..256 range', () => {
      expect(dotSizeOf(['DOTSIZE', '999'])).toEqual({ width: 256, height: 256 });
      expect(dotSizeOf(['DOTSIZE', '0'])).toEqual({ width: 1, height: 1 });
    });
  });
});
