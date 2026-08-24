/** @format */

/**
 * The teardown-race DEREF class.
 *
 * SYMPTOM (reported against v1.0.4):
 *   PNut-Term-TS: unexpected failure: Cannot read properties of null (reading 'getCurrentBaudRate')
 * ...and the shell got exit 1, whatever the run had actually decided.
 *
 * CAUSE: HeadlessController.downloadFile() re-read `this.serialPort` AFTER awaiting
 * the download. A shutdown — a --timeout expiry, SIGINT/SIGTERM, or an end marker seen
 * in the stream — runs initiateShutdown(), which sets `this.serialPort = null`. When
 * that landed mid-download, the post-download baud restore in the `finally` block
 * dereferenced null. A throw out of a `finally` DISCARDS the return value, so it
 * escaped run() entirely and surfaced from pnut-term-ts.ts as "unexpected failure",
 * setting PortError(1) over the top of the RunTimeout(124)/OK(0) the shutdown had
 * already decided and printed.
 *
 * This is the same defect the GUI path fixed in v0.9.51 (MainWindow.executeDownload
 * captures `const port` once); the headless path never got it.
 *
 * These tests pin the invariants:
 *   1. a shutdown landing mid-download cannot make downloadFile() throw;
 *   2. the post-download baud restore is SKIPPED during shutdown, and can never
 *      escape even when it fails on its own;
 *   3. run() reports the SHUTDOWN's exit code, not PortError, when a shutdown wins
 *      the race against the port open or the download;
 *   4. run() never hangs when the shutdown finishes before its resolver exists;
 *   5. a reset pulse interrupted by teardown does not throw.
 */

const mockDownload = jest.fn();

jest.mock('../src/utils/usb.serial', () => {
  const UsbSerial: any = jest.fn().mockImplementation(() => ({}));
  UsbSerial.setCommBaudRate = jest.fn();
  UsbSerial.desiredCommsBaudRate = 2_000_000;
  return { UsbSerial, __esModule: true };
});

jest.mock('../src/classes/downloader', () => ({
  __esModule: true,
  Downloader: jest.fn().mockImplementation(() => ({ download: mockDownload }))
}));

jest.mock('../src/utils/p2DebugHeader', () => ({
  __esModule: true,
  MAX_VALIDATED_BAUD: 2_000_000,
  readDebugHeaderFromFile: jest.fn().mockReturnValue(null) // no debug ROM — adopt nothing
}));

import { HeadlessController } from '../src/classes/headlessController';
import { ExitCode } from '../src/utils/exitCodes';
import { UsbSerial } from '../src/utils/usb.serial';

const SERIAL_BAUD = 2_000_000;

function makeContext(overrides: Record<string, unknown> = {}): any {
  return {
    runEnvironment: {
      selectedPropPlug: '/dev/ttyTEST',
      controlLine: 'DTR',
      debugBaudrate: SERIAL_BAUD,
      debugBaudRateFromCLI: false,
      downloadBaudRateFromCLI: false,
      usbTrafficLogging: false,
      ...overrides
    },
    getLogDirectory: () => '/tmp',
    logger: { logMessage: jest.fn(), errorMsg: jest.fn(), verboseMsg: jest.fn(), debugMsg: jest.fn() }
  };
}

function makeLogger(overrides: Record<string, unknown> = {}): any {
  return {
    initialize: jest.fn(),
    setEndMarkerCallback: jest.fn(),
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

/** A serial-port stand-in with every method downloadFile()/openSerialPort() touch. */
function makePort(overrides: Record<string, unknown> = {}): any {
  return {
    waitForPortOpen: jest.fn().mockResolvedValue(undefined),
    setDTR: jest.fn().mockResolvedValue(undefined),
    setRTS: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    getCurrentBaudRate: jest.fn().mockReturnValue(SERIAL_BAUD),
    changeBaudRate: jest.fn().mockResolvedValue(undefined),
    setShuttingDown: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

/** Watch for the exact event that rewrites the process exit status. */
async function withRejectionWatch(fn: () => Promise<void>): Promise<unknown[]> {
  const seen: unknown[] = [];
  const onRejection = (reason: unknown) => seen.push(reason);
  process.on('unhandledRejection', onRejection);
  try {
    await fn();
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    process.off('unhandledRejection', onRejection);
  }
  return seen;
}

/** A promise plus its resolver, so a test can hold a download open. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('shutdown racing a headless download (the getCurrentBaudRate null deref)', () => {
  let signalsBefore: Record<string, number>;

  beforeEach(() => {
    jest.clearAllMocks();
    (UsbSerial as any).desiredCommsBaudRate = SERIAL_BAUD;
    signalsBefore = {
      SIGTERM: process.listenerCount('SIGTERM'),
      SIGINT: process.listenerCount('SIGINT'),
      SIGUSR1: process.listenerCount('SIGUSR1')
    };
  });

  afterEach(() => {
    // run() installs process-level signal handlers; drop the ones this test added so
    // they cannot fire into a torn-down controller during a later test.
    for (const sig of ['SIGTERM', 'SIGINT', 'SIGUSR1'] as const) {
      const extra = process.listeners(sig).slice(signalsBefore[sig]);
      for (const l of extra) process.off(sig, l as any);
    }
  });

  it('a shutdown landing MID-DOWNLOAD cannot make downloadFile() throw', async () => {
    const controller = new HeadlessController(makeContext(), '/tmp/prog.bin', false);
    const port = makePort();
    (controller as any).logger = makeLogger();
    (controller as any).serialPort = port;
    (controller as any).downloader = { download: mockDownload };

    const download = deferred<{ success: boolean }>();
    mockDownload.mockReturnValue(download.promise);

    const escaped = await withRejectionWatch(async () => {
      const inFlight = controller.downloadFile('/tmp/prog.bin', false);

      // The teardown: exactly what the --timeout timer / SIGINT / end marker do.
      (controller as any).beginShutdown(ExitCode.RunTimeout, 'Timeout');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect((controller as any).serialPort).toBeNull(); // the field really is nulled

      download.resolve({ success: true });

      // BEFORE the fix this rejected with
      //   TypeError: Cannot read properties of null (reading 'getCurrentBaudRate')
      await expect(inFlight).resolves.toBe(true);
    });
    expect(escaped).toEqual([]);
  });

  it('the post-download baud restore is SKIPPED once a shutdown has begun', async () => {
    const controller = new HeadlessController(makeContext(), '/tmp/prog.bin', false);
    // Report a WRONG current rate so the restore would definitely fire if not skipped.
    const port = makePort({ getCurrentBaudRate: jest.fn().mockReturnValue(115_200) });
    (controller as any).logger = makeLogger();
    (controller as any).serialPort = port;
    (controller as any).downloader = { download: mockDownload };

    const download = deferred<{ success: boolean }>();
    mockDownload.mockReturnValue(download.promise);

    const inFlight = controller.downloadFile('/tmp/prog.bin', false);
    (controller as any).beginShutdown(ExitCode.OK, 'End marker detected');
    await new Promise((resolve) => setTimeout(resolve, 10));
    download.resolve({ success: true });
    await inFlight;

    // Retuning a port that is being closed is pointless and races the close.
    expect(port.changeBaudRate).not.toHaveBeenCalled();
  });

  it('a FAILING baud restore is contained — it never replaces the download result', async () => {
    const controller = new HeadlessController(makeContext(), '/tmp/prog.bin', false);
    const port = makePort({
      getCurrentBaudRate: jest.fn().mockReturnValue(115_200), // != effective -> restore fires
      changeBaudRate: jest.fn().mockRejectedValue(new Error('port went away'))
    });
    const logger = makeLogger();
    (controller as any).logger = logger;
    (controller as any).serialPort = port;
    (controller as any).downloader = { download: mockDownload };
    mockDownload.mockResolvedValue({ success: true });

    const escaped = await withRejectionWatch(async () => {
      // A throw from a `finally` discards the return value and escapes run().
      await expect(controller.downloadFile('/tmp/prog.bin', false)).resolves.toBe(true);
    });
    expect(escaped).toEqual([]);
    expect(port.changeBaudRate).toHaveBeenCalledTimes(1);
    expect(logger.logSystem).toHaveBeenCalledWith(
      expect.stringContaining('Could not set serial baud after download (non-fatal)')
    );
  });

  it('run() reports the SHUTDOWN code (124), not PortError, when a timeout wins the download race', async () => {
    const controller = new HeadlessController(makeContext(), '/tmp/prog.bin', false);
    const port = makePort();
    (UsbSerial as unknown as jest.Mock).mockImplementation(() => port);
    (controller as any).logger = makeLogger();

    const download = deferred<{ success: boolean }>();
    mockDownload.mockReturnValue(download.promise);

    let code: number | undefined;
    const escaped = await withRejectionWatch(async () => {
      const run = controller.run().then((c) => (code = c));
      // Let run() reach the download.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(mockDownload).toHaveBeenCalled();

      // Timeout fires while the download is still in flight. The whole shutdown —
      // including resolving the run — completes BEFORE run() installs its resolver.
      (controller as any).beginShutdown(ExitCode.RunTimeout, 'Timeout');
      await new Promise((resolve) => setTimeout(resolve, 20));
      download.resolve({ success: false }); // the close killed it, as it would on hardware

      await run;
    });

    expect(escaped).toEqual([]);
    // Before the fix this was PortError(1) via "unexpected failure", or the run hung.
    expect(code).toBe(ExitCode.RunTimeout);
  });

  it('run() reports the SHUTDOWN code when a signal wins the race against the port OPEN', async () => {
    const controller = new HeadlessController(makeContext());
    const open = deferred<void>();
    const port = makePort({ waitForPortOpen: jest.fn().mockReturnValue(open.promise) });
    (UsbSerial as unknown as jest.Mock).mockImplementation(() => port);
    (controller as any).logger = makeLogger();

    let code: number | undefined;
    const escaped = await withRejectionWatch(async () => {
      const run = controller.run().then((c) => (code = c));
      await new Promise((resolve) => setTimeout(resolve, 20));

      (controller as any).beginShutdown(ExitCode.OK, 'SIGINT');
      await new Promise((resolve) => setTimeout(resolve, 20));
      open.resolve(); // the open finally lands, on a port that is already closed

      await run;
    });

    expect(escaped).toEqual([]);
    // A shutdown is not a port error: report what the shutdown decided.
    expect(code).toBe(ExitCode.OK);
    // ...and nothing after the open ran against the nulled field.
    expect(port.setDTR).not.toHaveBeenCalled();
  });

  it('a FAILED port open still tears down — the --timeout timer does not outlive the run', async () => {
    const controller = new HeadlessController(makeContext({ headlessTimeout: 600 }));
    const port = makePort({ waitForPortOpen: jest.fn().mockRejectedValue(new Error('ENOENT')) });
    (UsbSerial as unknown as jest.Mock).mockImplementation(() => port);
    (controller as any).logger = makeLogger();

    const code = await controller.run();

    expect(code).toBe(ExitCode.PortError);
    // The hang this pins: the open failed and run() used to `return` straight out,
    // leaving a 600-second timer armed and the log stream open. Node keeps the event
    // loop alive for a pending timer, so the process sat for ten minutes after it had
    // already decided PortError. Every exit now routes through the shutdown, which
    // clears the timer and closes the log.
    expect((controller as any).timeoutTimer).toBeNull();
    expect((controller as any).logger.close).toHaveBeenCalled();
  });

  it('no device specified still tears down, and still reports PortError', async () => {
    const controller = new HeadlessController(makeContext({ selectedPropPlug: '', headlessTimeout: 600 }));
    (controller as any).logger = makeLogger();

    const code = await controller.run();

    expect(code).toBe(ExitCode.PortError);
    expect((controller as any).timeoutTimer).toBeNull();
    expect((controller as any).logger.close).toHaveBeenCalled();
  });

  it('a reset pulse interrupted by teardown still COMPLETES the pulse, and reports no fault', async () => {
    const controller = new HeadlessController(makeContext());
    const logger = makeLogger();
    const port = makePort();
    (controller as any).logger = logger;
    (controller as any).serialPort = port;

    const escaped = await withRejectionWatch(async () => {
      const pulse = controller.resetHardware();
      // The pulse straddles a 100 ms await; drop the field inside that window.
      (controller as any).serialPort = null;
      await expect(pulse).resolves.toBeUndefined();
    });
    expect(escaped).toEqual([]);
    // The de-assert is the half that lands AFTER the await. Before the fix it threw a
    // TypeError that resetHardware()'s own catch reported as a hardware-reset failure —
    // the pulse was left ASSERTED and the log blamed the hardware for a teardown.
    expect(port.setDTR).toHaveBeenNthCalledWith(1, true);
    expect(port.setDTR).toHaveBeenNthCalledWith(2, false);
    expect(logger.logError).not.toHaveBeenCalledWith(expect.stringContaining('Hardware reset failed'));
  });
});

// NOTE: the mechanical gate for this class lives in scripts/check-teardown-derefs.js
// (`npm run check:teardown`), beside its sibling check-floating-promises.js, and runs as
// a hard step in the release workflow. It is NOT invoked from here: it builds a full
// TypeScript Program, which is ~2 s standalone but minutes under jest in this container.
