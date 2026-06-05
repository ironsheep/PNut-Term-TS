/** @format */

// [9win §12] SPECTRO create-time configuration parity vs Pascal SPECTRO_Configure
// (DebugDisplayUnit.pas:1719) + KeyColorMode (:2785) + KeyValWithin (:2706). Drives the
// static createDisplaySpec() directly (no BrowserWindow needed). Covers the four
// parse-level §12 residuals:
//   - SAMPLES {first} {last} bin range CLAMPS inclusively (was reject + off-by-one)
//   - SIZE is NOT a SPECTRO directive (Pascal has no key_size) and must be ignored
//   - HSV16 colour-tune is numeric-only; LUMA8 tune may be a named colour OR numeric
//   - the 6 colour modes + DEPTH/MAG/RANGE/RATE/TRACE/DOTSIZE still parse (regression)
//
// The noise-floor removal and the on-screen coordinate readout are exercised by the
// instance-level suites (debugSpectroWin / spectroBinRangeBoundary), not here.

import { DebugSpectroWindow } from '../src/classes/debugSpectroWin';
import { ColorMode } from '../src/classes/shared/colorTranslator';

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  app: { getPath: jest.fn().mockReturnValue('/mock/path') },
  ipcMain: { on: jest.fn(), removeAllListeners: jest.fn() },
  nativeImage: { createFromBuffer: jest.fn() }
}));
jest.mock('fs', () => ({ existsSync: jest.fn(), mkdirSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock('../src/utils/usb.serial', () => ({ UsbSerial: jest.fn() }));
jest.mock('jimp', () => ({ Jimp: {}, MIME_PNG: 'image/png' }));

const spec = (...directives: string[]) => DebugSpectroWindow.createDisplaySpec('win', ['SPECTRO', 'win', ...directives]);

describe('[9win §12] SPECTRO config parity', () => {
  describe('defaults (Pascal SPECTRO_Configure :1723-1733)', () => {
    it('defaults to LUMA8X, 512 samples, full range, tune 0', () => {
      const s = spec();
      expect(s.colorMode).toBe(ColorMode.LUMA8X);
      expect(s.samples).toBe(512);
      expect(s.firstBin).toBe(0);
      expect(s.lastBin).toBe(255); // samples/2 - 1
      expect(s.range).toBe(0x7fffffff);
      expect(s.colorTune).toBe(0);
    });
  });

  describe('SAMPLES {first} {last} inclusive clamp (Pascal :1744-1749)', () => {
    it('SAMPLES 2048 0 236 keeps an in-range bin window', () => {
      const s = spec('SAMPLES', '2048', '0', '236');
      expect(s.samples).toBe(2048);
      expect(s.firstBin).toBe(0);
      expect(s.lastBin).toBe(236);
    });

    it('SAMPLES alone defaults first=0, last=samples/2-1', () => {
      const s = spec('SAMPLES', '128');
      expect(s.samples).toBe(128);
      expect(s.firstBin).toBe(0);
      expect(s.lastBin).toBe(63);
    });

    it('first == last clamps last up to first+1 (single-bin range is impossible)', () => {
      // Pascal KeyValWithin(FFTlast, FFTfirst+1, samples/2-1): a last <= first is raised.
      const s = spec('SAMPLES', '512', '100', '100');
      expect(s.firstBin).toBe(100);
      expect(s.lastBin).toBe(101);
    });

    it('over-range first clamps to samples/2 - 2 (inclusive upper bound)', () => {
      // 512 -> samples/2-2 = 254. The old code used a strict `<` (excluded 254) and
      // discarded out-of-range firsts; Pascal clamps into [0, 254].
      const s = spec('SAMPLES', '512', '500');
      expect(s.firstBin).toBe(254);
      // last defaulted to samples/2-1 = 255 before the first clamp, and 255 >= first+1.
      expect(s.lastBin).toBe(255);
    });

    it('first exactly at samples/2 - 2 is accepted (off-by-one fix)', () => {
      const s = spec('SAMPLES', '512', '254', '255');
      expect(s.firstBin).toBe(254);
      expect(s.lastBin).toBe(255);
    });

    it('over-range last clamps to samples/2 - 1', () => {
      const s = spec('SAMPLES', '512', '5', '9999');
      expect(s.firstBin).toBe(5);
      expect(s.lastBin).toBe(255);
    });
  });

  describe('SIZE is not a SPECTRO directive (Pascal has no key_size)', () => {
    it('SIZE does not set the window size and does not derail later directives', () => {
      const s = spec('SIZE', '800', '600', 'DEPTH', '128');
      expect(s.size.width).toBe(400); // default, unchanged by SIZE
      expect(s.size.height).toBe(300);
      expect(s.depth).toBe(128); // DEPTH after SIZE still parses
    });
  });

  describe('colour-mode tune: HSV numeric-only, LUMA named-or-numeric (Pascal KeyColorMode :2785)', () => {
    it('LUMA8 accepts a named colour tune', () => {
      const s = spec('LUMA8', 'GREEN');
      expect(s.colorMode).toBe(ColorMode.LUMA8);
      expect(s.colorTune).toBe(2); // GREEN -> 2
    });

    it('LUMA8 accepts a numeric tune', () => {
      const s = spec('LUMA8', '5');
      expect(s.colorMode).toBe(ColorMode.LUMA8);
      expect(s.colorTune).toBe(5);
    });

    it('HSV16 accepts a numeric tune', () => {
      const s = spec('HSV16', '7');
      expect(s.colorMode).toBe(ColorMode.HSV16);
      expect(s.colorTune).toBe(7);
    });

    it('HSV16 does NOT consume a named colour as tune (numeric-only)', () => {
      const s = spec('HSV16', 'GREEN');
      expect(s.colorMode).toBe(ColorMode.HSV16);
      expect(s.colorTune).toBe(0); // GREEN left unconsumed; tune stays default
    });

    it('HSV16X likewise rejects a named tune', () => {
      const s = spec('HSV16X', 'RED');
      expect(s.colorMode).toBe(ColorMode.HSV16X);
      expect(s.colorTune).toBe(0);
    });
  });

  describe('regression: surviving directives still parse', () => {
    it('DEPTH / MAG / RANGE / RATE / TRACE / DOTSIZE all apply', () => {
      const s = spec('DEPTH', '300', 'MAG', '4', 'RANGE', '1000', 'RATE', '32', 'TRACE', '8', 'DOTSIZE', '2', '3');
      expect(s.depth).toBe(300);
      expect(s.magnitude).toBe(4);
      expect(s.range).toBe(1000);
      expect(s.rate).toBe(32);
      expect(s.tracePattern).toBe(8);
      expect(s.dotSize).toBe(2);
      expect(s.dotSizeY).toBe(3);
    });

    it('LOGSCALE and HIDEXY flags set', () => {
      const s = spec('LOGSCALE', 'HIDEXY');
      expect(s.logScale).toBe(true);
      expect(s.hideXY).toBe(true);
    });
  });
});
