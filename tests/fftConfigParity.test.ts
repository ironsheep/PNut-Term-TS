/** @format */

// [9win §11] FFT create-time configuration + channel parity vs Pascal FFT_Configure
// (DebugDisplayUnit.pas:1552), FFT_Update (:1620) and SetDefaults (:2880). Drives the static
// createDisplaySpec() and the private parseChannelConfiguration() (no `this` state beyond
// logMessage/defaultChannelColor) directly, so no BrowserWindow is needed. Covers:
//   - default window size 256x256 (Pascal vWidth=vHeight=256), not 400x300
//   - SAMPLES n {first} {last} sets samples + display bins (the RANGE directive's old job)
//   - the invented RANGE and GRID directives are now ignored (no Pascal counterpart)
//   - channel default palette = DefaultScopeColors; channel color token is optional
//   - channel def reports parts consumed (label + 5 numerics + optional color)

import { DebugFFTWindow } from '../src/classes/debugFftWin';
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

const spec = (...directives: string[]) => DebugFFTWindow.createDisplaySpec('win', ['`FFT', 'win', ...directives]);

// parseChannelConfiguration only touches this.logMessage and this.defaultChannelColor (which itself
// uses no instance state), so we can invoke it against a tiny stub `this`.
const proto = DebugFFTWindow.prototype as any;
const parseChannel = (parts: string[], startIndex: number, channelIndex: number) =>
  proto.parseChannelConfiguration.call(
    { logMessage: () => {}, defaultChannelColor: proto.defaultChannelColor },
    parts,
    startIndex,
    channelIndex
  );

describe('[9win §11] FFT config parity', () => {
  describe('defaults (Pascal SetDefaults / FFT_Configure)', () => {
    it('default window size is 256x256, not 400x300', () => {
      const s = spec();
      expect(s.size.width).toBe(256);
      expect(s.size.height).toBe(256);
    });
  });

  describe('SAMPLES n {first} {last} (Pascal :1573-1582)', () => {
    it('SAMPLES 64 2 10 sets samples + first/last display bins', () => {
      const s = spec('SAMPLES', '64', '2', '10');
      expect(s.samples).toBe(64);
      expect(s.firstBin).toBe(2);
      expect(s.lastBin).toBe(10);
    });
    it('SAMPLES 128 alone defaults first=0, last=samples/2-1', () => {
      const s = spec('SAMPLES', '128');
      expect(s.samples).toBe(128);
      expect(s.firstBin).toBe(0);
      expect(s.lastBin).toBe(63);
    });
  });

  describe('invented directives now ignored (no Pascal key_range / key_grid)', () => {
    it('RANGE is a no-op — display bins stay at the SAMPLES defaults', () => {
      const s = spec('SAMPLES', '512', 'RANGE', '5', '20');
      expect(s.samples).toBe(512);
      expect(s.firstBin).toBe(0);
      expect(s.lastBin).toBe(255); // 512/2 - 1, unaffected by RANGE
    });
    it('GRID parses without effect (field removed)', () => {
      const s = spec('GRID') as any;
      expect(s.grid).toBeUndefined();
      expect(s.size.width).toBe(256); // still a valid spec
    });
  });

  describe('channel default palette = DefaultScopeColors (Pascal :241,2888); color optional', () => {
    const LIME = DebugColor.fromDefaultName('LIME', 8).rgbString; // DefaultScopeColors[0]
    const OLIVE = DebugColor.fromDefaultName('OLIVE', 8).rgbString; // DefaultScopeColors[7]

    it('omitted color -> slot default color, consumes 6 parts (label + 5 numerics)', () => {
      const r = parseChannel(["'A'", '5', '100', '64', '0', '0'], 0, 0);
      expect(r).not.toBeNull();
      expect(r.channel.label).toBe('A');
      expect(r.channel.color).toBe(LIME);
      expect(r.partsConsumed).toBe(6);
    });

    it('channel index selects the palette slot (index 7 -> clOlive)', () => {
      const r = parseChannel(["'H'", '5', '100', '64', '0', '0'], 0, 7);
      expect(r.channel.color).toBe(OLIVE);
    });

    it('explicit color token overrides the default and consumes 7 parts', () => {
      const r = parseChannel(["'A'", '5', '100', '64', '0', '0', 'RED'], 0, 0);
      expect(r.channel.color).not.toBe(LIME);
      expect(r.partsConsumed).toBe(7);
    });

    it('a following channel label is NOT consumed as this channel’s color', () => {
      const r = parseChannel(["'A'", '5', '100', '64', '0', '0', "'B'"], 0, 0);
      expect(r.channel.color).toBe(LIME); // default kept
      expect(r.partsConsumed).toBe(6); // 'B' left for the next channel
    });

    it('magnitude clamps to 0..11', () => {
      expect(parseChannel(["'A'", '99', '100', '64', '0', '0'], 0, 0).channel.magnitude).toBe(11);
      expect(parseChannel(["'A'", '-5', '100', '64', '0', '0'], 0, 0).channel.magnitude).toBe(0);
    });
  });
});
