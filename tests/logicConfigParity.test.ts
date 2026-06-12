/** @format */

// [9win §8] LOGIC window create-time configuration parity vs Pascal LOGIC_Configure
// (DebugDisplayUnit.pas:925-1031). Drives the static parser DebugLogicWindow
// .parseLogicDeclaration() and the static dimColor() helper directly, so it needs
// no BrowserWindow instance. Covers the §8 deliverables:
//   - full multi-directive spec parses completely (parser must NOT abort on
//     RATE/DOTSIZE/LINESIZE/TEXTSIZE)
//   - per-directive Pascal clamps (KeyValWithin), never abort
//   - default 32-channel set ('0'..'31', clLime) when no labels are given
//   - RANGE bus-waveform channel variant detection + dimmed bit-count color

import { DebugLogicWindow } from '../src/classes/debugLogicWin';

// Electron is imported by debugLogicWin.ts at module load; mock it so the static
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

const LIME = '#00ff00'; // DefaultScopeColors[0] = clLime, full brightness (8)

describe('[9win §8] LOGIC config parity (static parseLogicDeclaration)', () => {
  describe('normal: full multi-directive spec parses completely', () => {
    it('does not abort on RATE/DOTSIZE/LINESIZE/TEXTSIZE — later directives still apply', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration([
        '`LOGIC', 'Bus',
        'SAMPLES', '64',
        'RATE', '4',
        'DOTSIZE', '2',
        'LINESIZE', '5',
        'TEXTSIZE', '14',
        'SPACING', '12',
        "'D0'", '1', 'RED',
        "'D1'", '1', 'CYAN'
      ]);

      expect(isValid).toBe(true);
      expect(spec.nbrSamples).toBe(64);
      expect(spec.rate).toBe(4);
      expect(spec.dotSize).toBe(2);
      expect(spec.lineSize).toBe(5);
      expect(spec.textSize).toBe(14);
      expect(spec.spacing).toBe(12);
      // The two channel defs AFTER the RATE/DOTSIZE/LINESIZE/TEXTSIZE block must
      // survive — previously the parser aborted there and dropped them.
      expect(spec.channelSpecs).toHaveLength(2);
      expect(spec.channelSpecs[0].name).toBe('D0');
      expect(spec.channelSpecs[1].name).toBe('D1');
    });
  });

  describe('error: out-of-range values clamp (Pascal KeyValWithin), never abort', () => {
    it('RATE clamps to 1..2048', () => {
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'RATE', '5000'])[1].rate).toBe(2048);
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'RATE', '0'])[1].rate).toBe(1);
    });
    it('DOTSIZE clamps to 0..32', () => {
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'DOTSIZE', '100'])[1].dotSize).toBe(32);
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'DOTSIZE', '-5'])[1].dotSize).toBe(0);
    });
    it('LINESIZE clamps to 1..32', () => {
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'LINESIZE', '0'])[1].lineSize).toBe(1);
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'LINESIZE', '99'])[1].lineSize).toBe(32);
    });
    it('TEXTSIZE clamps to 6..200', () => {
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'TEXTSIZE', '5'])[1].textSize).toBe(6);
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'TEXTSIZE', '999'])[1].textSize).toBe(200);
    });
    it('SAMPLES lower bound is 4 (Pascal LogicSets-1 upper, 4 lower)', () => {
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'SAMPLES', '2'])[1].nbrSamples).toBe(4);
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'SAMPLES', '99999'])[1].nbrSamples).toBe(2047);
    });
    it('SPACING clamps to 1..32 (Pascal KeyValWithin(vSpacing, 1, 32))', () => {
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'SPACING', '99'])[1].spacing).toBe(32);
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'SPACING', '0'])[1].spacing).toBe(1);
    });
    it('SPACING accepts Spin2 numeric forms (%binary / $hex) via Spin2NumericParser', () => {
      // %1000 = 8, the Pascal default; previously raw Number() turned this to NaN.
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'SPACING', '%1000'])[1].spacing).toBe(8);
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'SPACING', '$10'])[1].spacing).toBe(16);
    });
    it('SPACING with a missing/invalid value keeps the default 8, never aborts', () => {
      expect(DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', 'SPACING'])[1].spacing).toBe(8);
      // an invalid value is ignored and a following directive still applies
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration([
        '`LOGIC', 'L', 'SPACING', 'oops', 'RATE', '4'
      ]);
      expect(isValid).toBe(true);
      expect(spec.spacing).toBe(8);
      expect(spec.rate).toBe(4);
    });
  });

  describe('normal: defaults match Pascal LOGIC_Configure', () => {
    it('grid $404040, lineSize 3, dotSize 0', () => {
      const [, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L']);
      expect(spec.window.grid).toBe('#404040'); // DefaultGridColor = clGray = $404040
      expect(spec.lineSize).toBe(3); // vLineSize := 3
      expect(spec.dotSize).toBe(0); // vDotSize := 0
    });

    it('no channel labels -> default 32 channels labeled 0..31, all clLime', () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L']);
      expect(isValid).toBe(true);
      expect(spec.channelSpecs).toHaveLength(32);
      spec.channelSpecs.forEach((cs, i) => {
        expect(cs.name).toBe(`${i}`);
        expect(cs.color).toBe(LIME);
        expect(cs.nbrBits).toBe(1);
      });
    });

    it('with explicit labels, the 32-channel default is NOT applied', () => {
      const [, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', "'A'", "'B'"]);
      expect(spec.channelSpecs).toHaveLength(2);
    });
  });

  describe('edge: RANGE bus-waveform channel variant', () => {
    it("'Bus' 4 RANGE marks the group as a 4-bit bus", () => {
      const [isValid, spec] = DebugLogicWindow.parseLogicDeclaration([
        '`LOGIC', 'L', "'Bus'", '4', 'RANGE', 'BLUE'
      ]);
      expect(isValid).toBe(true);
      expect(spec.channelSpecs).toHaveLength(1);
      expect(spec.channelSpecs[0].name).toBe('Bus');
      expect(spec.channelSpecs[0].nbrBits).toBe(4);
      expect(spec.channelSpecs[0].isRange).toBe(true);
      expect(spec.channelSpecs[0].color).toBe('#0909ff'); // RGBI8X BLUE 8
    });

    it('a plain multi-bit group (no RANGE) is not a bus', () => {
      const [, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', "'Nibble'", '4']);
      expect(spec.channelSpecs[0].nbrBits).toBe(4);
      expect(spec.channelSpecs[0].isRange).toBeFalsy();
    });

    it('bit-count clamps to 1..32', () => {
      const [, spec] = DebugLogicWindow.parseLogicDeclaration(['`LOGIC', 'L', "'Big'", '99']);
      expect(spec.channelSpecs[0].nbrBits).toBe(32);
    });
  });

  describe('dimColor — Pascal "color shr 2 and $3F3F3F" bus bit-count tint (:991)', () => {
    it('divides each 8-bit channel by 4 and masks to 6 bits', () => {
      expect(DebugLogicWindow.dimColor('#404040')).toBe('#101010');
      expect(DebugLogicWindow.dimColor('#ffffff')).toBe('#3f3f3f');
      expect(DebugLogicWindow.dimColor('#000000')).toBe('#000000');
    });

    it('leaves a non-hex string untouched', () => {
      expect(DebugLogicWindow.dimColor('not-a-color')).toBe('not-a-color');
    });
  });
});
