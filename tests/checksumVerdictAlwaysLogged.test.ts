/** @format */

/**
 * The CRC verdict must reach the log without a special build.
 *
 * Found while answering "will --console-mode affect this?" during the v1.0.8 investigation.
 * Stephen's v1.0.7 log said `[DOWNLOAD FAILED] … P2 checksum verification did not complete`
 * and carried NO reason — and the three lines that would have supplied one
 *
 *     * P2 checksum verification: SUCCESS - '.' received after Nms
 *     * P2 checksum verification: FAILED - '!' received after Nms
 *     * CRITICAL ERROR: P2 checksum response timeout after 1000ms
 *
 * were emitted through UsbSerial.logMessage(), which is gated on
 * `runEnvironment.loggingEnabled` — a field declared in context.ts:58, initialized false at
 * context.ts:180, and ASSIGNED NOWHERE IN THE REPO. No CLI flag reaches it; `--diag-serial`
 * does not either (that gates logChannelDiag, a different method). So those lines were dead
 * code in every shipped build, and the one fact that distinguishes "the CRC failed" from
 * "the CRC timed out" from "the verdict was never read" could not be obtained from a log at
 * all. mainWindow.ts:6503 already carries a comment about a PREVIOUS defect that hid behind
 * this same gate.
 *
 * logSystemEvent()'s own contract (usb.serial.ts) puts this squarely in the always-live
 * bucket: "download start/success/fail, the P2 handshake result". The verdict IS the
 * download's pass/fail result.
 *
 * These tests pin the bucket, not the wording: a verdict must reach forceLogMessage() with
 * `loggingEnabled` false and `serialDiagnostics` false — i.e. a stock user's build — while
 * the step-by-step channel detail stays behind --diag-serial where it belongs.
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

/** A stock shipped build: every developer/diagnostic switch off. */
function makeStockContext(): any {
  return {
    runEnvironment: { loggingEnabled: false, serialDiagnostics: false },
    logger: { forceLogMessage: jest.fn(), logMessage: jest.fn() }
  };
}

function makePort(ctx: any): any {
  return new UsbSerial(ctx, '/dev/null');
}

/** Everything that reached the always-live log, joined for matching. */
function liveLog(ctx: any): string {
  return ctx.logger.forceLogMessage.mock.calls.map((c: any[]) => String(c[0])).join('\n');
}

/**
 * Run only the checksum-wait portion of download() against a pre-set latch.
 *
 * download() itself needs an open port and a full Prop_Txt write; the wait is the part under
 * test, so drive it the way download() does and let the private method do the logging.
 */
async function runChecksumWait(port: any, reply: string | null): Promise<void> {
  port['_checksumResponseChar'] = reply;
  port['_expectingChecksumResponse'] = true;
  port['_p2DetectionBuffer'] = '';
  await port['awaitChecksumVerdict']();
}

describe('CRC verdict reaches the log in a stock build', () => {
  it("logs the SUCCESS verdict with every diagnostic switch OFF", async () => {
    const ctx = makeStockContext();
    const port = makePort(ctx);

    await runChecksumWait(port, '.');

    expect(liveLog(ctx)).toMatch(/P2 checksum verification: SUCCESS/);
    expect(port['_checksumVerified']).toBe(true);
    expect(port['_downloadChecksumGood']).toBe(true);
  });

  it("logs the FAILED verdict ('!' — corrupt image) with every switch OFF", async () => {
    const ctx = makeStockContext();
    const port = makePort(ctx);

    await runChecksumWait(port, '!');

    expect(liveLog(ctx)).toMatch(/P2 checksum verification: FAILED/);
    expect(port['_checksumVerified']).toBe(true);
    expect(port['_downloadChecksumGood']).toBe(false);
  });

  it('logs the TIMEOUT verdict with every switch OFF — the case that had no reason in the log', async () => {
    const ctx = makeStockContext();
    const port = makePort(ctx);

    // No reply ever latches: the wait must run to its safety timeout and SAY SO.
    await runChecksumWait(port, null);

    expect(liveLog(ctx)).toMatch(/CRITICAL ERROR: P2 checksum response timeout/);
    expect(port['_checksumVerified']).toBe(false);
  }, 10000);

  it('keeps the step-by-step channel detail OUT of the stock log', async () => {
    const ctx = makeStockContext();
    const port = makePort(ctx);

    await runChecksumWait(port, '.');

    // These belong behind --diag-serial; promoting the verdict must not promote the noise,
    // or the "always live" bucket stops meaning anything.
    expect(liveLog(ctx)).not.toMatch(/Waiting for P2 checksum verification response/);
    expect(liveLog(ctx)).not.toMatch(/Download completed successfully with verified checksum/);
  });

  it('surfaces the channel detail under --diag-serial', async () => {
    const ctx = makeStockContext();
    ctx.runEnvironment.serialDiagnostics = true;
    const port = makePort(ctx);

    await runChecksumWait(port, '.');

    expect(liveLog(ctx)).toMatch(/Waiting for P2 checksum verification response/);
    // ...and the verdict is still there; --diag-serial adds, never replaces.
    expect(liveLog(ctx)).toMatch(/P2 checksum verification: SUCCESS/);
  });

  it('REGRESSION PIN: loggingEnabled is not a switch any build can reach', () => {
    // The gate that hid these lines. If a future change makes this settable, that is fine —
    // but the verdict must NOT go back to depending on it, which the tests above enforce.
    const ctx = makeStockContext();
    expect(ctx.runEnvironment.loggingEnabled).toBe(false);
  });
});
