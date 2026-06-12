/** @format */

// [9win §9] SCOPE window create-time configuration + legend parity vs Pascal
// SCOPE_Configure (DebugDisplayUnit.pas:1151) and the vGrid legend bit layout
// (:3291-3335). Drives the static parser DebugScopeWindow.parseScopeDeclaration()
// and the private parseLegend() (which only touches this.logMessage) directly, so
// it needs no BrowserWindow instance. Covers the §9 deliverables:
//   - DOTSIZE/LINESIZE/TEXTSIZE no longer silently dropped (were default-case no-ops)
//   - per-directive Pascal clamps (KeyValWithin), never abort
//   - default grid $404040, dotSize/lineSize defaults, dot=line=0 -> dot=1 fallback
//   - legend %abcd vs numeric: Pascal bit order bit0=minLine,1=maxLine,2=minLegend,3=maxLegend

import { DebugScopeWindow, ScopeChannelSpec } from '../src/classes/debugScopeWin';

// Electron is imported by debugScopeWin.ts at module load; mock it so the static
// methods can be exercised without a real BrowserWindow.
jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  app: { getPath: jest.fn().mockReturnValue('/mock/path') },
  ipcMain: { on: jest.fn(), removeAllListeners: jest.fn() },
  nativeImage: { createFromBuffer: jest.fn() }
}));
jest.mock('fs', () => ({ existsSync: jest.fn(), mkdirSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock('../src/utils/usb.serial', () => ({ UsbSerial: jest.fn() }));
jest.mock('jimp', () => ({ Jimp: {}, MIME_PNG: 'image/png' }));

// parseLegend is a private instance method but only uses this.logMessage, so we can
// invoke it against a tiny stub `this` to unit-test the bit decoding in isolation.
function decodeLegend(legend: string): Partial<ScopeChannelSpec> {
  const cs = {} as ScopeChannelSpec;
  (DebugScopeWindow.prototype as any).parseLegend.call({ logMessage: () => {} }, legend, cs);
  return cs;
}

describe('[9win §9] SCOPE config parity (static parseScopeDeclaration)', () => {
  describe('normal: full multi-directive spec parses completely', () => {
    it('does not abort on RATE/DOTSIZE/LINESIZE/TEXTSIZE', () => {
      const [isValid, spec] = DebugScopeWindow.parseScopeDeclaration([
        '`SCOPE', 'Wave',
        'SAMPLES', '64',
        'RATE', '4',
        'DOTSIZE', '2',
        'LINESIZE', '5',
        'TEXTSIZE', '14',
        'HIDEXY'
      ]);
      expect(isValid).toBe(true);
      expect(spec.nbrSamples).toBe(64);
      expect(spec.rate).toBe(4);
      expect(spec.dotSize).toBe(2);
      expect(spec.lineSize).toBe(5);
      expect(spec.textSize).toBe(14);
      // HIDEXY comes AFTER the size directives — previously these dropped to the
      // default case and were silently ignored, but the parser never aborted, so
      // this mostly guards that the new explicit cases consume their value arg.
      expect(spec.hideXY).toBe(true);
    });
  });

  describe('error: out-of-range values clamp (Pascal KeyValWithin), never abort', () => {
    it('RATE clamps to 1..2048 (Pascal :1172)', () => {
      expect(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'RATE', '5000'])[1].rate).toBe(2048);
      expect(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'RATE', '0'])[1].rate).toBe(1);
    });
    it('DOTSIZE clamps to 0..32 (Pascal :1174)', () => {
      expect(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'DOTSIZE', '100'])[1].dotSize).toBe(32);
      expect(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'DOTSIZE', '-5'])[1].dotSize).toBe(0);
    });
    it('LINESIZE clamps to 0..32 — 0 IS allowed for SCOPE, unlike LOGIC (Pascal :1176)', () => {
      // lineSize 0 with a non-zero dotSize stays 0 (no dot=line=0 fallback)
      expect(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'DOTSIZE', '2', 'LINESIZE', '0'])[1].lineSize).toBe(0);
      expect(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'LINESIZE', '99'])[1].lineSize).toBe(32);
    });
    it('TEXTSIZE clamps to 6..200 (Pascal :1177)', () => {
      expect(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'TEXTSIZE', '5'])[1].textSize).toBe(6);
      expect(DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'TEXTSIZE', '999'])[1].textSize).toBe(200);
    });
  });

  describe('normal: defaults match Pascal SCOPE_Configure', () => {
    it('grid $404040, rate 1, dotSize 0, lineSize 3', () => {
      const [, spec] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S']);
      expect(spec.window.grid).toBe('#404040');
      expect(spec.rate).toBe(1);
      expect(spec.dotSize).toBe(0);
      expect(spec.lineSize).toBe(3);
    });

    it('dot=line=0 forces dotSize=1 so something is drawn (Pascal :1188)', () => {
      const [, spec] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'LINESIZE', '0', 'DOTSIZE', '0']);
      expect(spec.lineSize).toBe(0);
      expect(spec.dotSize).toBe(1);
    });
  });

  describe('numeric literals + COLOR directive (Pascal KeyValWithin / KeyColor)', () => {
    it('SAMPLES accepts a $hex literal via Spin2NumericParser ($100 -> 256)', () => {
      const [isValid, spec] = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'SAMPLES', '$100']);
      expect(isValid).toBe(true);
      expect(spec.nbrSamples).toBe(256);
    });

    it('COLOR <name> <brightness> honors the brightness on the background (KeyColor p := val and 15)', () => {
      const dim = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'COLOR', 'RED', '2'])[1];
      const bright = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'COLOR', 'RED', '15'])[1];
      // canonical lowercase #rrggbb, no longer the default black, brightness-sensitive
      expect(dim.window.background).toMatch(/^#[0-9a-f]{6}$/);
      expect(dim.window.background).not.toBe('#000000');
      expect(dim.window.background).not.toBe(bright.window.background);
    });

    it('COLOR <bg> <grid> sets both; a trailing non-color token ends the color loop and is still parsed', () => {
      const [isValid, spec] = DebugScopeWindow.parseScopeDeclaration([
        '`SCOPE', 'S', 'COLOR', 'RED', 'HIDEXY'
      ]);
      expect(isValid).toBe(true);
      // RED consumed as background; HIDEXY is NOT a color, so grid keeps its default
      // (Pascal KeyColor returns False -> Dec(ptr)) and HIDEXY is processed as a directive.
      expect(spec.window.background).not.toBe('#000000');
      expect(spec.window.grid).toBe('#404040');
      expect(spec.hideXY).toBe(true);
    });

    it('a bad/empty COLOR token never aborts the window (Pascal never invalidates) [C4]', () => {
      // non-color token after COLOR: window stays valid, later directives still parse
      const bad = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'COLOR', 'NOTACOLOR', 'SAMPLES', '64']);
      expect(bad[0]).toBe(true);
      expect(bad[1].nbrSamples).toBe(64);
      // COLOR with no following token at end of line: still valid, defaults kept
      const dangling = DebugScopeWindow.parseScopeDeclaration(['`SCOPE', 'S', 'COLOR']);
      expect(dangling[0]).toBe(true);
      expect(dangling[1].window.background).toBe('#000000');
    });
  });

  describe('legend %abcd / numeric bit order (Pascal vGrid :3298-3322)', () => {
    // Pascal: bit0(1)=min/base LINE, bit1(2)=max/top LINE, bit2(4)=min VALUE, bit3(8)=max VALUE.
    it('%abcd string is MSB-first: a=maxLegend b=minLegend c=maxLine d=minLine', () => {
      const all = decodeLegend('%1111');
      expect(all.lgndShowMax).toBe(true);
      expect(all.lgndShowMin).toBe(true);
      expect(all.lgndShowMaxLine).toBe(true);
      expect(all.lgndShowMinLine).toBe(true);

      const maxLegendOnly = decodeLegend('%1000'); // a only
      expect(maxLegendOnly.lgndShowMax).toBe(true);
      expect(maxLegendOnly.lgndShowMin).toBe(false);
      expect(maxLegendOnly.lgndShowMaxLine).toBe(false);
      expect(maxLegendOnly.lgndShowMinLine).toBe(false);

      const minLineOnly = decodeLegend('%0001'); // d only
      expect(minLineOnly.lgndShowMinLine).toBe(true);
      expect(minLineOnly.lgndShowMax).toBe(false);
    });

    it('numeric form uses Pascal vGrid bits: 1=minLine 2=maxLine 4=minLegend 8=maxLegend', () => {
      // value 1 -> min LINE only
      const v1 = decodeLegend('1');
      expect(v1.lgndShowMinLine).toBe(true);
      expect(v1.lgndShowMaxLine).toBe(false);
      expect(v1.lgndShowMin).toBe(false);
      expect(v1.lgndShowMax).toBe(false);

      // value 8 -> max VALUE legend only
      const v8 = decodeLegend('8');
      expect(v8.lgndShowMax).toBe(true);
      expect(v8.lgndShowMin).toBe(false);
      expect(v8.lgndShowMaxLine).toBe(false);
      expect(v8.lgndShowMinLine).toBe(false);

      // value 12 (8+4) -> both VALUE legends, no lines
      const v12 = decodeLegend('12');
      expect(v12.lgndShowMax).toBe(true);
      expect(v12.lgndShowMin).toBe(true);
      expect(v12.lgndShowMaxLine).toBe(false);
      expect(v12.lgndShowMinLine).toBe(false);
    });

    it('%abcd and the equivalent numeric value decode identically', () => {
      // %1010 == 10 -> maxLegend + maxLine
      const bin = decodeLegend('%1010');
      const num = decodeLegend('10');
      expect(num.lgndShowMax).toBe(bin.lgndShowMax);
      expect(num.lgndShowMin).toBe(bin.lgndShowMin);
      expect(num.lgndShowMaxLine).toBe(bin.lgndShowMaxLine);
      expect(num.lgndShowMinLine).toBe(bin.lgndShowMinLine);
      expect(num.lgndShowMax).toBe(true);
      expect(num.lgndShowMaxLine).toBe(true);
      expect(num.lgndShowMin).toBe(false);
      expect(num.lgndShowMinLine).toBe(false);
    });
  });
});
