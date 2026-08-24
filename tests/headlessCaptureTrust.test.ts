/** @format */

/**
 * THE CONTRACT: exit 0 means the captured data is complete and trustworthy.
 *
 * Not "the app didn't crash" — trustworthy. A CI script or an agent reads the log and
 * branches on `$?`; a 0 over a log with holes in it is the one outcome it cannot defend
 * against, because nothing downstream can tell a short log from a short run.
 *
 * The corollary matters just as much and is the easier one to get wrong: a stumble that
 * costs NO data must not change the code. A port that errors while closing, a baud
 * restore that fails after the run has ended — those print, and that is all they do.
 * Reporting failure for a run whose log is perfect is exactly as much a lie as reporting
 * success for one whose log is not.
 *
 * Before this, five paths lost bytes and still exited 0, each with nothing but a
 * console.error to show for it:
 *   1. a failed log write            4. a log file that never became writable
 *   2. a stream error (and `once`,   5. a device that died mid-run — which, with
 *      so only the FIRST was seen)      --end-marker and no --timeout, hung forever
 *   3. a failed header write (empty log, every message stuck in the pending buffer)
 *
 * ...and one that was correctly non-zero but said so nowhere: a drain timeout produced
 * exit 125 with no line in the console or the log explaining it.
 */

jest.mock('../src/utils/usb.serial', () => {
  const UsbSerial: any = jest.fn().mockImplementation(() => ({}));
  UsbSerial.setCommBaudRate = jest.fn();
  UsbSerial.desiredCommsBaudRate = 2_000_000;
  return { UsbSerial, __esModule: true };
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HeadlessController } from '../src/classes/headlessController';
import { HeadlessFileLogger } from '../src/classes/shared/headlessFileLogger';
import { ExitCode } from '../src/utils/exitCodes';

let scratchDir: string;

function makeContext(overrides: Record<string, unknown> = {}): any {
  return {
    runEnvironment: {
      selectedPropPlug: '/dev/ttyTEST',
      controlLine: 'DTR',
      debugBaudrate: 2_000_000,
      debugBaudRateFromCLI: false,
      downloadBaudRateFromCLI: false,
      usbTrafficLogging: false,
      ...overrides
    },
    getLogDirectory: () => scratchDir,
    logger: { logMessage: jest.fn(), errorMsg: jest.fn(), verboseMsg: jest.fn(), debugMsg: jest.fn() }
  };
}

/** A logger stand-in for controller-level tests, with the capture-fault channel. */
function makeLogger(overrides: Record<string, unknown> = {}): any {
  return {
    initialize: jest.fn(),
    setEndMarkerCallback: jest.fn(),
    logSystem: jest.fn(),
    logError: jest.fn(),
    logMessage: jest.fn(),
    getLogFilePath: () => '/tmp/test.log',
    getCaptureFault: jest.fn().mockReturnValue(null),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

/** Wait until the real logger's write stream has opened and the header has landed. */
async function untilReady(logger: HeadlessFileLogger): Promise<void> {
  for (let i = 0; i < 100 && (logger as any).logFileReady !== true; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

beforeEach(() => {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pnut-capture-'));
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

describe('HeadlessFileLogger records when the capture stops being trustworthy', () => {
  it('a clean session reports NO fault', async () => {
    const logger = new HeadlessFileLogger(makeContext());
    logger.initialize();
    await untilReady(logger);
    logger.logSystem('hello');
    await logger.close();

    expect(logger.getCaptureFault()).toBeNull();
  });

  it('a FAILED write is recorded as a fault, not just printed', async () => {
    const logger = new HeadlessFileLogger(makeContext());
    logger.initialize();
    await untilReady(logger);

    // A write that reports ENOSPC through its callback — the disk-full shape.
    const stream = (logger as any).logFile as fs.WriteStream;
    jest.spyOn(stream, 'write').mockImplementation(((_data: any, cb: any) => {
      if (typeof cb === 'function') cb(new Error('ENOSPC: no space left on device'));
      return true;
    }) as any);

    logger.logSystem('this line is lost');
    (logger as any).flushWriteBuffer();

    expect(logger.getCaptureFault()).toMatch(/log write failed.*ENOSPC/);
  });

  it('a STREAM error is recorded — and `on`, not `once`, so a second one is still seen', async () => {
    const logger = new HeadlessFileLogger(makeContext());
    logger.initialize();
    await untilReady(logger);

    const stream = (logger as any).logFile as fs.WriteStream;
    expect(stream.listenerCount('error')).toBeGreaterThan(0);
    stream.emit('error', new Error('EIO first'));
    // Still listening after the first: a `once` handler would have detached here, and a
    // stream that keeps failing would go quiet — which reads exactly like a healthy log.
    expect(stream.listenerCount('error')).toBeGreaterThan(0);
    stream.emit('error', new Error('EIO second'));

    // Sticky: the FIRST reason wins, because it is the one that explains the rest.
    expect(logger.getCaptureFault()).toMatch(/EIO first/);
    expect(logger.getCaptureFault()).not.toMatch(/EIO second/);
  });

  it('an unflushable buffer is a fault — buffered lines with nowhere to go are lost data', async () => {
    const logger = new HeadlessFileLogger(makeContext());
    logger.initialize();
    await untilReady(logger);

    logger.logSystem('queued');
    (logger as any).logFile = null; // the stream went away with data still buffered
    (logger as any).flushWriteBuffer();

    expect(logger.getCaptureFault()).toMatch(/could not be written/);
  });

  it('the log FILE ITSELF is stamped INCOMPLETE — the artifact must describe itself', async () => {
    const logger = new HeadlessFileLogger(makeContext());
    logger.initialize();
    await untilReady(logger);

    const logPath = logger.getLogFilePath();
    ((logger as any).logFile as fs.WriteStream).emit('error', new Error('EIO'));
    await logger.close();

    // The exit code is gone the moment the shell moves on and the console line dies with
    // the terminal. The file is the only copy that persists.
    expect(fs.readFileSync(logPath, 'utf-8')).toMatch(/THIS LOG IS INCOMPLETE/);
  });
});

describe('the exit code tells the truth about the capture', () => {
  it('a capture fault makes an otherwise-clean run NON-zero, and says so', async () => {
    const controller = new HeadlessController(makeContext());
    (controller as any).logger = makeLogger({
      getCaptureFault: jest.fn().mockReturnValue('log write failed (ENOSPC) — this log is missing data')
    });
    (controller as any).serialPort = null;

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');

    // The run itself ended cleanly — but its log has holes, so 0 would be a lie.
    await expect(run).resolves.toBe(ExitCode.FlushTimeout);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('THIS LOG IS INCOMPLETE'));
  });

  it('a DRAIN TIMEOUT is announced by name, not just encoded in the exit status', async () => {
    const controller = new HeadlessController(makeContext());
    (controller as any).logger = makeLogger({
      // Never settles: the 10 s drain wins the race.
      close: jest.fn().mockReturnValue(new Promise(() => undefined))
    });
    (controller as any).serialPort = null;

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');
    jest.advanceTimersByTime?.(0);
    await expect(run).resolves.toBe(ExitCode.FlushTimeout);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('LOG FLUSH TIMED OUT'));
  }, 20_000);

  it('a truncated log still speaks up when the code is ALREADY non-zero (124 keeps its meaning)', async () => {
    const controller = new HeadlessController(makeContext());
    (controller as any).logger = makeLogger({
      getCaptureFault: jest.fn().mockReturnValue('log write stream error (EIO) — this log is missing data')
    });
    (controller as any).serialPort = null;

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    (controller as any).beginShutdown(ExitCode.RunTimeout, 'Timeout');

    // 124 is the more specific verdict and keeps it — "the run did not finish". On its own
    // it would silently absorb "...and the log is broken too", so that is stated separately.
    await expect(run).resolves.toBe(ExitCode.RunTimeout);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('THIS LOG IS INCOMPLETE'));
  });

  it('a stumble that costs NO data prints but never changes the code', async () => {
    const controller = new HeadlessController(makeContext());
    (controller as any).logger = makeLogger(); // no capture fault, drain succeeds
    (controller as any).serialPort = {
      setShuttingDown: jest.fn(),
      close: jest.fn().mockRejectedValue(new Error('port close failed on the way out'))
    };

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');

    // The log is complete. Reporting failure here would be exactly as much a lie as
    // reporting success over a broken log.
    await expect(run).resolves.toBe(ExitCode.OK);
  });
});

describe('a device that dies MID-RUN ends the run loudly and non-zero', () => {
  it('a mid-run serial fault stops the run with PortError and marks the log incomplete', async () => {
    const controller = new HeadlessController(makeContext());
    const logger = makeLogger();
    (controller as any).logger = logger;
    (controller as any).serialPort = { setShuttingDown: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    (controller as any).handleSerialFault('Error: Port is not open');

    // Before this the fault had no listener at all: the bytes just stopped. With
    // --end-marker and no --timeout the run then waited forever for a marker that could
    // never arrive. Ending the run is the point.
    await expect(run).resolves.toBe(ExitCode.PortError);
    expect(logger.logError).toHaveBeenCalledWith(expect.stringContaining('SERIAL PORT FAILED MID-RUN'));
    expect(logger.logError).toHaveBeenCalledWith(expect.stringContaining('INCOMPLETE'));
  });

  it('a serial fault DURING shutdown is teardown noise — it cannot rewrite a finished run', async () => {
    const controller = new HeadlessController(makeContext());
    const logger = makeLogger();
    (controller as any).logger = logger;
    (controller as any).serialPort = { setShuttingDown: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };

    const run = new Promise<number>((resolve) => ((controller as any).resolveRun = resolve));
    (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');
    (controller as any).handleSerialFault('Error: Port is not open'); // arrives as the port closes

    await expect(run).resolves.toBe(ExitCode.OK);
    expect(logger.logError).not.toHaveBeenCalledWith(expect.stringContaining('SERIAL PORT FAILED MID-RUN'));
  });
});
