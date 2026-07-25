/** @format */

// usbTrafficLoggerCounts.test.ts
//
// Covers the two changes that make a sustained-throughput capture usable as EVIDENCE:
//   1. counts-only mode — timestamps + byte counts, no hex dump (a full dump inflates a
//      capture ~6x, which makes a multi-MB run unwieldy to produce and to hand back).
//   2. timestamps reflect WHEN THE BYTES CROSSED THE WIRE, not when the entry was formatted.
//      Both log paths format inside setImmediate(), so the previous code — which called
//      getFormattedDateTimeISO() and ignored its `timestamp` argument — stamped entries with
//      formatter-run time. Under a saturated stream that lags arrival by an unbounded amount
//      and silently corrupts every throughput and latency figure derived from the log.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { USBTrafficLogger } from '../src/classes/shared/usbTrafficLogger';

(global as any).APP_VERSION = (global as any).APP_VERSION || 'test';

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(() => setImmediate(resolve)));

function tmpLogPath(name: string): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'usblog-')), name);
}

async function capture(countsOnly: boolean, write: (l: USBTrafficLogger) => void): Promise<string> {
  const p = tmpLogPath('usb.log');
  const logger = new USBTrafficLogger();
  logger.setCountsOnly(countsOnly);
  logger.enable(p);
  write(logger);
  await flush();
  logger.disable();
  await flush();
  return fs.readFileSync(p, 'utf8');
}

describe('USBTrafficLogger — throughput-capture modes', () => {
  const payload = Buffer.from('Cog0  SEQ 12345\r\n', 'latin1');

  describe('counts-only mode', () => {
    it('logs the byte count and omits the hex dump entirely', async () => {
      const text = await capture(true, (l) => l.log(payload, Date.now()));
      expect(text).toContain(`Received ${payload.length} bytes`);
      expect(text).not.toContain('HEX/ASCII');
      expect(text).not.toMatch(/\$[0-9A-F]{2}/); // no hex column at all
    });

    it('carries a running byte total so a capture can be reconciled without the payload', async () => {
      const text = await capture(true, (l) => {
        l.log(Buffer.alloc(100), Date.now());
        l.log(Buffer.alloc(50), Date.now());
      });
      expect(text).toContain('Received 100 bytes (total 100)');
      expect(text).toContain('Received 50 bytes (total 150)');
    });

    it('still logs TX in FULL — keystroke content is the evidence for round-trip pairing', async () => {
      const text = await capture(true, (l) => l.logTx('a', Date.now()));
      expect(text).toContain('Sent 1 bytes');
      expect(text).toContain('HEX/ASCII'); // TX keeps its dump even in counts-only
    });

    it('produces a dramatically smaller capture than the hex dump for the same bytes', async () => {
      const big = Buffer.alloc(4096, 0x41);
      const counts = await capture(true, (l) => l.log(big, Date.now()));
      const full = await capture(false, (l) => l.log(big, Date.now()));
      // The whole point: a throughput capture must stay small enough to hand back.
      expect(counts.length).toBeLessThan(full.length / 10);
    });
  });

  describe('timestamp fidelity', () => {
    // Both modes must stamp the instant the CALLER captured. A drifting timestamp is not a
    // cosmetic issue here — it is the measurement.
    it.each([
      ['counts-only', true],
      ['hex dump', false]
    ])('uses the supplied arrival instant, not format time (%s)', async (_label, countsOnly) => {
      const arrival = new Date('2026-07-25T12:44:49.593').getTime();
      const text = await capture(countsOnly as boolean, (l) => l.log(payload, arrival));
      expect(text).toContain('2026-07-25T12:44:49.593');
    });

    it('preserves distinct instants across chunks instead of collapsing them to "now"', async () => {
      const t0 = new Date('2026-07-25T12:44:49.100').getTime();
      const text = await capture(true, (l) => {
        l.log(payload, t0);
        l.log(payload, t0 + 250);
        l.log(payload, t0 + 900);
      });
      // Inter-chunk spacing is exactly what the throughput analysis reads — it must survive.
      expect(text).toContain('12:44:49.100');
      expect(text).toContain('12:44:49.350');
      expect(text).toContain('12:44:50.000');
    });
  });
});
