/** @format */

/**
 * The checksum latch was armed AFTER the '?' it listens for (reported against v1.0.9).
 *
 * SYMPTOM (bench, macOS host, 5 of 36 downloads ≈ 14%, every program size, both cards):
 * the P2 answers the '?' terminator with '.', the program starts and runs — and ~1 s
 * later the tool logs `* CRITICAL ERROR: P2 checksum response timeout after 1000ms` and
 * aborts the session. The '.' is plainly in the log, glued to `.Cog0  INIT … load`. Good
 * downloads report "'.' received after 1–16 ms".
 *
 * CAUSE: UsbSerial.download() did
 *
 *     await this.write('?');                 // resolves only after drain() completes
 *     this._checksumResponseChar = null;
 *     this._expectingChecksumResponse = true; // ← latch armed HERE
 *     await this.awaitChecksumVerdict();
 *
 * checkForP2Response() only latches while `_expectingChecksumResponse` is true. On
 * node-serialport (macOS/Linux) the drain completion (tcdrain on a libuv worker) and the
 * RX 'data' event (the read poller) complete INDEPENDENTLY — nothing orders "the '?' is
 * confirmed sent" before "the P2's reply was read". The P2 answers essentially at once,
 * so its reply races the drain callback. "Received after 1–16 ms" is that race won by a
 * margin as small as 1 ms; the failures are the same race lost. The '.' is read while the
 * latch is still disarmed, passes straight through to the log, and the wait then spins
 * its full 1000 ms for a byte already gone.
 *
 * (The log's timestamps cannot show this ordering: a file line is stamped when its
 * NEWLINE is reassembled in the main process — loggerWin.writeLogEntry() — so the
 * `.Cog0 … load` stamp is always later than the '.' byte's arrival.)
 *
 * FIX: arm the latch BEFORE writing the '?'. The P2 loader transmits nothing while it
 * receives Base64, so nothing can be mistaken for the reply in the gap, and a reply that
 * beats the drain callback is caught regardless of ordering.
 *
 * These tests drive the REAL download() against a port whose drain() delivers the P2's
 * reply before it completes — the losing ordering — and the winning ordering as a control.
 */

jest.mock('serialport', () => ({
  __esModule: true,
  SerialPort: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    once: jest.fn(),
    open: jest.fn(),
    write: jest.fn(),
    isOpen: false,
    destroyed: false
  }))
}));

import { UsbSerial } from '../src/utils/usb.serial';

function makeContext(): any {
  return {
    runEnvironment: { loggingEnabled: false, serialDiagnostics: false },
    logger: { forceLogMessage: jest.fn(), logMessage: jest.fn() }
  };
}

function alwaysLive(ctx: any): string {
  return ctx.logger.forceLogMessage.mock.calls.map((c: any[]) => String(c[0])).join('\n');
}

/** What the bench log shows the P2 sending: the reply glued to the program's first line. */
const REPLY_CHUNK = Buffer.from('.Cog0  INIT $0000_0000 $0000_0000 load\r\n', 'latin1');

type Ordering = 'reply-before-drain' | 'reply-after-drain';

/**
 * A fake transport. Every write drains immediately EXCEPT the '?' terminator, whose drain
 * delivers the P2's reply either before or after it completes — the two orderings
 * node-serialport can produce on real hardware.
 */
function installFakePort(port: any, ordering: Ordering, reply: Buffer | null = REPLY_CHUNK): { writes: string[] } {
  const writes: string[] = [];
  let lastWrite = '';
  // Exactly what the 'data' handler does first with every chunk. null = the P2 never answers.
  const deliver = () => {
    if (reply) port['checkForP2Response'](reply);
  };
  port['_serialPort'] = {
    isOpen: true,
    destroyed: false,
    on: jest.fn(),
    once: jest.fn(),
    write: (value: string | Buffer, cb: (err?: Error | null) => void) => {
      lastWrite = typeof value === 'string' ? value : value.toString('latin1');
      writes.push(lastWrite);
      cb(null);
    },
    drain: (cb: (err?: Error | null) => void) => {
      if (lastWrite !== '?') {
        cb(null);
        return;
      }
      if (ordering === 'reply-before-drain') {
        deliver(); // the RX event is serviced before the drain callback
        cb(null);
      } else {
        cb(null);
        setTimeout(deliver, 5); // the reply lands a few ms after the drain callback
      }
    }
  };
  return { writes };
}

async function runDownload(ordering: Ordering, reply: Buffer | null = REPLY_CHUNK) {
  const ctx = makeContext();
  const port: any = new UsbSerial(ctx, '/dev/null');
  const fake = installFakePort(port, ordering, reply);
  port['_p2loadLimit'] = 0x100000;
  await port.download(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), true);
  return { port, ctx, fake };
}

describe('checksum latch is armed before the ? terminator is sent', () => {
  it('THE DEFECT: a reply read before drain() completes is still latched as the verdict', async () => {
    const { port, ctx, fake } = await runDownload('reply-before-drain');

    expect(fake.writes[fake.writes.length - 1]).toBe('?');
    expect(port.getChecksumStatus()).toEqual({ verified: true, valid: true, response: '.' });
    const log = alwaysLive(ctx);
    expect(log).toMatch(/P2 checksum verification: SUCCESS - '\.' received/);
    expect(log).not.toMatch(/CRITICAL ERROR: P2 checksum response timeout/);
  }, 5000);

  it('control: a reply read after drain() completes is latched too', async () => {
    const { port, ctx } = await runDownload('reply-after-drain');

    expect(port.getChecksumStatus()).toEqual({ verified: true, valid: true, response: '.' });
    expect(alwaysLive(ctx)).not.toMatch(/CRITICAL ERROR/);
  }, 5000);

  it("a '!' that beats the drain callback is still reported as CORRUPT, not as a timeout", async () => {
    const { port, ctx } = await runDownload('reply-before-drain', Buffer.from('!', 'latin1'));

    expect(port.getChecksumStatus()).toEqual({ verified: true, valid: false, response: '!' });
    expect(alwaysLive(ctx)).toMatch(/P2 checksum verification: FAILED - '!' received/);
  }, 5000);

  it('a genuine no-reply still times out — and the log says no bytes arrived at all', async () => {
    const { port, ctx } = await runDownload('reply-after-drain', null);

    expect(port.getChecksumStatus().verified).toBe(false);
    expect(alwaysLive(ctx)).toMatch(/CRITICAL ERROR: P2 checksum response timeout after 1000ms — 0 bytes received/);
  }, 5000);

  it('a timeout with bytes that were NOT a reply names the first bytes, so the log can say why', async () => {
    const { port, ctx } = await runDownload('reply-after-drain', Buffer.from([0x00, 0x2e, 0x43]));

    expect(port.getChecksumStatus().verified).toBe(false);
    expect(alwaysLive(ctx)).toMatch(/timeout after 1000ms — 3 bytes received since the '\?' was sent; first chunk began 00 2E 43/);
  }, 5000);
});
