/** @format */

/**
 * The v1.0.3 exit-code defect and its whole class.
 *
 * SYMPTOM (intermittent, 3 of 6 identical headless runs): the app printed
 *   "[HEADLESS] Initiating shutdown: End marker detected (exit code: 0)"
 * and then handed the shell a 1.
 *
 * CAUSE: initiateShutdown() called `this.serialPort.close()` WITHOUT awaiting it,
 * inside a try/catch. UsbSerial.close() is `async`, so that catch could only ever
 * see a SYNCHRONOUS throw — a rejected close escaped as an unhandled rejection.
 * Under Node >= 15's default (`--unhandled-rejections=throw`) an unhandled rejection
 * becomes an uncaught exception, and Node then FORCES exit status 1, overwriting the
 * code the app had already decided and printed. Intermittent because the native close
 * only errors sometimes — racing the RX poller while the P2 is still transmitting.
 *
 * These tests pin the three things that make it stay fixed:
 *   1. a rejecting close() no longer escapes, and the intended code still arrives;
 *   2. a shutdown that fails outright still RESOLVES the run (a code always reaches
 *      the shell) rather than hanging or dying;
 *   3. (the mechanical gate that finds this construct lives in
 *      scripts/check-floating-promises.js — see the note at the bottom of this file).
 */

jest.mock('../src/utils/usb.serial', () => ({
  UsbSerial: jest.fn().mockImplementation(() => ({})),
  __esModule: true
}));

import { HeadlessController } from '../src/classes/headlessController';
import { ExitCode } from '../src/utils/exitCodes';

/** Minimal Context stand-in — HeadlessController only reads runEnvironment here. */
function makeContext(): any {
  return {
    runEnvironment: {
      selectedPropPlug: '/dev/ttyTEST',
      controlLine: 'DTR',
      debugBaudrate: 2_000_000,
      debugBaudRateFromCLI: false,
      downloadBaudRateFromCLI: false
    },
    getLogDirectory: () => '/tmp',
    logger: { logMessage: jest.fn(), errorMsg: jest.fn(), verboseMsg: jest.fn(), debugMsg: jest.fn() }
  };
}

/** A logger stand-in that records what shutdown reported. */
function makeLogger(overrides: Record<string, unknown> = {}): any {
  return {
    logSystem: jest.fn(),
    logError: jest.fn(),
    logMessage: jest.fn(),
    getLogFilePath: () => '/tmp/test.log',
    // The capture-trust channel: null means "the log is complete". A stub without it
    // makes initiateShutdown() throw, which the shutdown net then reports as 125 —
    // an honest verdict for a logger it cannot question, but not what these tests mean.
    getCaptureFault: jest.fn().mockReturnValue(null),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

/**
 * Run `fn` while watching for an unhandled rejection — the exact event that kills the
 * process and rewrites its exit status. Jest keeps its own listeners attached, so we
 * add ours alongside rather than replacing them.
 */
async function withRejectionWatch(fn: () => Promise<void>): Promise<unknown[]> {
  const seen: unknown[] = [];
  const onRejection = (reason: unknown) => seen.push(reason);
  process.on('unhandledRejection', onRejection);
  try {
    await fn();
    // Unhandled-rejection detection is deferred to the end of the microtask queue,
    // so give the loop a real turn before deciding nothing escaped.
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    process.off('unhandledRejection', onRejection);
  }
  return seen;
}

describe('headless shutdown cannot rewrite the exit code (v1.0.3 defect)', () => {
  it('a REJECTING serial close is caught, and the intended exit code still arrives', async () => {
    const controller = new HeadlessController(makeContext());
    const logger = makeLogger();
    const close = jest.fn().mockRejectedValue(new Error('simulated native close error'));

    (controller as any).logger = logger;
    (controller as any).serialPort = { setShuttingDown: jest.fn(), close };

    let resolved: number | undefined;
    const run = new Promise<number>((resolve) => {
      (controller as any).resolveRun = (code: number) => {
        resolved = code;
        resolve(code);
      };
    });

    const escaped = await withRejectionWatch(async () => {
      (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');
      await run;
    });

    // The whole defect in one assertion: nothing escaped to the unhandled-rejection
    // floor, so Node never forces a 1 over the top of our decision.
    expect(escaped).toEqual([]);
    expect(resolved).toBe(ExitCode.OK);

    // And it was AWAITED, not merely called: only an awaited close puts the rejection
    // inside the catch, which is what writes this line.
    expect(close).toHaveBeenCalledTimes(1);
    expect(logger.logSystem).toHaveBeenCalledWith(expect.stringContaining('Error closing serial port (non-fatal)'));
  });

  it('a clean close reports the intended exit code untouched', async () => {
    const controller = new HeadlessController(makeContext());
    (controller as any).logger = makeLogger();
    (controller as any).serialPort = { setShuttingDown: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    const escaped = await withRejectionWatch(async () => {
      (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');
      await expect(run).resolves.toBe(ExitCode.OK);
    });
    expect(escaped).toEqual([]);
  });

  it('a non-OK code (timeout) survives shutdown intact — the net never flattens it to 0', async () => {
    const controller = new HeadlessController(makeContext());
    (controller as any).logger = makeLogger();
    (controller as any).serialPort = { setShuttingDown: jest.fn(), close: jest.fn().mockRejectedValue(new Error('x')) };

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    (controller as any).beginShutdown(ExitCode.RunTimeout, 'Timeout');
    await expect(run).resolves.toBe(ExitCode.RunTimeout);
  });

  it('a shutdown that fails OUTRIGHT still resolves the run — a code always reaches the shell', async () => {
    const controller = new HeadlessController(makeContext());
    // The log drain is the one thing initiateShutdown awaits that can take the whole
    // method down. Make it explode and prove the run still reports something.
    (controller as any).logger = makeLogger({
      close: jest.fn().mockRejectedValue(new Error('log stream exploded')),
      logError: jest.fn()
    });
    (controller as any).serialPort = null;

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    const escaped = await withRejectionWatch(async () => {
      (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');
      // Escalated to FlushTimeout: the run finished but its log may be truncated,
      // which is exactly what 125 means. It must NOT hang, and must NOT report 0.
      await expect(run).resolves.toBe(ExitCode.FlushTimeout);
    });
    expect(escaped).toEqual([]);
  });

  it('shutdown is idempotent — a second trigger cannot re-decide the code', async () => {
    const controller = new HeadlessController(makeContext());
    (controller as any).logger = makeLogger();
    (controller as any).serialPort = { setShuttingDown: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');
    (controller as any).beginShutdown(ExitCode.RunTimeout, 'Timeout'); // must be ignored
    await expect(run).resolves.toBe(ExitCode.OK);
  });
});

// NOTE: the gate itself (scripts/check-floating-promises.js) is NOT run from here.
// It builds a full TypeScript Program — 1.7 s standalone, but ~190 s under jest in this
// container, which is a bad trade for a suite that must stay runnable. It runs where it
// belongs instead: `npm run check:promises`, and as a hard step in the release workflow
// beside check-release-consistency.sh. See DOCs/PUNCH_LIST.md.
