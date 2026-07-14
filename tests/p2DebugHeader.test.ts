/** @format */

/**
 * The P2 debug-ROM header reader (src/utils/p2DebugHeader.ts).
 *
 * These assertions run against REAL compiled P2 binaries checked into the repo —
 * the actual bytes we download to the chip — not synthesized fixtures. That is the
 * point: the whole reason this module exists is that the binary is the only thing
 * in our possession that knows what baud the P2 will really transmit at.
 */

import * as fs from 'fs';
import * as path from 'path';

import { parseDebugHeader, readDebugHeaderFromFile } from '../src/utils/p2DebugHeader';

const BIN_DIR: string = path.join(__dirname, '..', 'DOCs', 'pascal-REF', 'SingleStep-Debugger-Test-Programs');
const A_REAL_BIN: string = path.join(BIN_DIR, 'test06_flags_skip.bin');

describe('P2 debug-ROM header', () => {
  describe('real compiled binaries', () => {
    it('reads baud / pins out of an actual debug-enabled binary', () => {
      const header = readDebugHeaderFromFile(A_REAL_BIN);
      expect(header).not.toBeNull();
      // 2,000,000 is the compiled-in default: with no DEBUG_BAUD in the source the
      // compiler installs download_baud, and that is 2,000,000 (p2com.asm:7141-7146).
      expect(header!.baud).toBe(2000000);
      expect(header!.txPin).toBe(62); // the standard P2 debug pins
      expect(header!.rxPin).toBe(63);
      expect(header!.timestamp).toBe(false);
    });

    it('agrees across EVERY debug binary in the test-program set', () => {
      const bins: string[] = fs
        .readdirSync(BIN_DIR)
        .filter((name) => name.endsWith('.bin'))
        .map((name) => path.join(BIN_DIR, name));
      expect(bins.length).toBeGreaterThan(0);

      for (const bin of bins) {
        const header = readDebugHeaderFromFile(bin);
        expect(header).not.toBeNull();
        expect(header!.baud).toBe(2000000);
        expect(header!.txPin).toBe(62);
        expect(header!.rxPin).toBe(63);
      }
    });
  });

  describe('absence of a debug ROM is meaningful, not an error', () => {
    it('returns null for an image with no debug ROM (caller keeps the user’s baud)', () => {
      const notAP2Image: Buffer = Buffer.alloc(4096, 0xa5);
      expect(parseDebugHeader(notAP2Image)).toBeNull();
    });

    it('returns null for an image too short to carry the header', () => {
      expect(parseDebugHeader(Buffer.alloc(8))).toBeNull();
    });

    it('returns null (does not throw) for a missing file', () => {
      expect(readDebugHeaderFromFile('/nonexistent/nope.bin')).toBeNull();
    });
  });

  describe('it reads the value, it does not assume it', () => {
    it('reports a NON-default DEBUG_BAUD — the whole reason this module exists', () => {
      // Take a real binary and rewrite _baud_ the way a `DEBUG_BAUD = 921600` CON
      // would. If we ever regress to assuming 2,000,000, this fails.
      const image: Buffer = Buffer.from(fs.readFileSync(A_REAL_BIN));
      image.writeUInt32LE(921600, 0x148);

      const header = parseDebugHeader(image);
      expect(header).not.toBeNull();
      expect(header!.baud).toBe(921600);
    });

    it('surfaces the DEBUG_TIMESTAMP flag (bit 31 of the _rxpin_ dword)', () => {
      const image: Buffer = Buffer.from(fs.readFileSync(A_REAL_BIN));
      // `>>> 0`: JS bitwise ops are signed 32-bit, so `x | 0x80000000` is NEGATIVE
      // and writeUInt32LE rejects it. The same trap lives in the parser.
      image.writeUInt32LE((image.readUInt32LE(0x144) | 0x8000_0000) >>> 0, 0x144);

      const header = parseDebugHeader(image);
      expect(header!.timestamp).toBe(true);
      expect(header!.rxPin).toBe(63); // the flag must not corrupt the pin number
    });

    it('refuses an insane baud rather than tuning the port to garbage', () => {
      // A signature match with an absurd baud means the offsets no longer describe
      // this image (a future PNut could move them). Refuse; keep the user's baud.
      const image: Buffer = Buffer.from(fs.readFileSync(A_REAL_BIN));
      image.writeUInt32LE(0xffffffff, 0x148);
      expect(parseDebugHeader(image)).toBeNull();

      image.writeUInt32LE(0, 0x148);
      expect(parseDebugHeader(image)).toBeNull();
    });
  });
});
