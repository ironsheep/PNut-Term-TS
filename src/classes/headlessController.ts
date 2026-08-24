/**
 * HeadlessController - Runs PNut-Term-TS without GUI windows
 *
 * This controller is used when --headless is specified on the command line.
 * It provides:
 * - Serial port communication (same as GUI mode)
 * - File-only logging (no windows)
 * - Three termination modes: signal, timeout, end-marker
 * - Support for file downloads (--ram, --flash)
 *
 * IMPORTANT: This file must NOT import any Electron modules (BrowserWindow, app, ipcMain, etc.)
 * as it runs in Node.js mode (ELECTRON_RUN_AS_NODE=1) without Chromium.
 */

import * as path from 'path';
import { Context } from '../utils/context';
import { UsbSerial } from '../utils/usb.serial';
import { getFormattedDateTime } from '../utils/files';
import { HeadlessFileLogger } from './shared/headlessFileLogger';
import { USBTrafficLogger } from './shared/usbTrafficLogger';
import { Downloader } from './downloader';
import { ExitCode, SHUTDOWN_DRAIN_TIMEOUT_MS } from '../utils/exitCodes';
import { readDebugHeaderFromFile, MAX_VALIDATED_BAUD } from '../utils/p2DebugHeader';

export class HeadlessController {
  private context: Context;
  private serialPort: UsbSerial | null = null;
  private logger: HeadlessFileLogger;
  private usbLogger: USBTrafficLogger | null = null;
  private downloader: Downloader | null = null;

  // Termination control
  private exitCode: number = ExitCode.OK;
  private isShuttingDown: boolean = false;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private resolveRun: ((code: number) => void) | null = null;

  // Serial state
  private deviceNode: string = '';
  private controlLineMode: 'DTR' | 'RTS' = 'DTR';

  // Download options
  private downloadPath: string | undefined;
  private downloadToFlash: boolean = false;

  constructor(context: Context, downloadPath?: string, downloadToFlash: boolean = false) {
    this.context = context;
    this.logger = new HeadlessFileLogger(context);

    // Get device node from context
    this.deviceNode = context.runEnvironment.selectedPropPlug || '';
    this.controlLineMode = context.runEnvironment.controlLine || 'DTR';

    // Store download options
    this.downloadPath = downloadPath;
    this.downloadToFlash = downloadToFlash;
  }

  /**
   * Main entry point - runs the headless controller
   * Returns exit code when termination occurs
   */
  public async run(): Promise<number> {
    console.log('[HEADLESS] Starting headless mode...');

    // Initialize logger
    this.logger.initialize();
    this.logger.logSystem('Headless mode started');

    // Initialize USB traffic logger if requested
    if (this.context.runEnvironment.usbTrafficLogging) {
      const logsDir = this.context.getLogDirectory();
      const timestamp = getFormattedDateTime();
      const usbLogPath = path.join(logsDir, `usb-traffic_${timestamp}.log`);
      this.usbLogger = new USBTrafficLogger();
      this.usbLogger.setCountsOnly(this.context.runEnvironment.usbTrafficCountsOnly === true);
      this.usbLogger.enable(usbLogPath);
      console.log(`[HEADLESS] USB traffic logging enabled: ${usbLogPath}`);
      this.logger.logSystem(`USB traffic logging enabled: ${usbLogPath}`);
    }

    // Set up end-marker callback
    this.logger.setEndMarkerCallback(() => {
      this.beginShutdown(ExitCode.OK, 'End marker detected');
    });

    // Set up signal handlers
    this.setupSignalHandlers();

    // Set up timeout if configured
    if (this.context.runEnvironment.headlessTimeout) {
      const timeoutSeconds = this.context.runEnvironment.headlessTimeout;
      console.log(`[HEADLESS] Timeout set: ${timeoutSeconds} seconds`);
      this.logger.logSystem(`Timeout configured: ${timeoutSeconds} seconds`);

      this.timeoutTimer = setTimeout(() => {
        console.log('[HEADLESS] Timeout expired');
        this.logger.logSystem('Timeout expired');
        this.beginShutdown(ExitCode.RunTimeout, 'Timeout');
      }, timeoutSeconds * 1000);
    }

    // Open serial port
    if (this.deviceNode) {
      const success = await this.openSerialPort();
      if (!success) {
        this.logger.logError(`Failed to open serial port: ${this.deviceNode}`);
        return 1;
      }
    } else {
      this.logger.logError('No device specified');
      console.error('[HEADLESS] No device specified. Use -p to specify a device.');
      return 1;
    }

    // Perform download if requested
    if (this.downloadPath) {
      const downloadSuccess = await this.downloadFile(this.downloadPath, this.downloadToFlash);
      if (!downloadSuccess) {
        // Download failed - abort immediately (exit code 3 = Download failed)
        this.logger.logError('Download failed - aborting');
        this.beginShutdown(ExitCode.DownloadFailed, 'Download failed');
        return this.exitCode;
      }
    }

    // Return a promise that resolves when shutdown is initiated
    return new Promise<number>((resolve) => {
      this.resolveRun = resolve;
    });
  }

  /**
   * Open the serial port and start receiving data
   */
  private async openSerialPort(): Promise<boolean> {
    console.log(`[HEADLESS] Opening serial port: ${this.deviceNode}`);
    this.logger.logSystem(`Opening serial port: ${this.deviceNode}`);

    try {
      // Set baud rate from context
      if (this.context.runEnvironment.debugBaudrate) {
        UsbSerial.setCommBaudRate(this.context.runEnvironment.debugBaudrate);
      }

      this.serialPort = new UsbSerial(this.context, this.deviceNode);
      await this.serialPort.waitForPortOpen();

      // Initialize DTR/RTS to de-asserted state
      await this.serialPort.setDTR(false);
      await this.serialPort.setRTS(false);

      // Set up data handler
      this.serialPort.on('data', (data: Buffer) => this.handleSerialData(data));

      const baudRate = this.serialPort.getCurrentBaudRate();
      console.log(`[HEADLESS] Serial port opened at ${baudRate} baud`);
      this.logger.logSystem(`Serial port opened: ${this.deviceNode} at ${baudRate} baud`);

      // Initialize downloader if we have a serial port
      this.downloader = new Downloader(this.context, this.serialPort);

      return true;
    } catch (error) {
      console.error(`[HEADLESS] Failed to open serial port: ${error}`);
      return false;
    }
  }

  /**
   * Handle incoming serial data
   */
  private handleSerialData(data: Buffer): void {
    if (this.isShuttingDown) {
      return; // Ignore data during shutdown
    }

    // Log raw USB traffic if enabled
    if (this.usbLogger) {
      this.usbLogger.log(data);
    }

    // Convert buffer to string for logging
    // Handle both text and binary data
    const text = data.toString('utf-8');

    // Log the data (HeadlessFileLogger will check for end-marker)
    this.logger.logMessage(text);
  }

  /**
   * Download a file to the Propeller
   */
  public async downloadFile(filePath: string, toFlash: boolean): Promise<boolean> {
    if (!this.downloader || !this.serialPort) {
      this.logger.logError('Cannot download: serial port not open');
      return false;
    }

    const target = toFlash ? 'FLASH' : 'RAM';
    console.log(`[HEADLESS] Downloading ${filePath} to ${target}...`);
    this.logger.logSystem(`Starting download: ${filePath} to ${target}`);

    // The binary carries the rate the P2 will actually transmit debug at. Adopt it
    // (unless -b was given explicitly) so an in-source DEBUG_BAUD works here too.
    // See utils/p2DebugHeader.ts for why guessing was never safe.
    this.adoptBaudFromBinary(filePath);

    // Headless has always downloaded at whatever rate the port is already on — the P2
    // boot loader auto-bauds, so that works. We therefore switch ONLY when the user
    // explicitly asked for a different download rate; without --downloadbaud this path
    // is byte-identical to its previous behavior, which is the validated one.
    const explicitDownloadBaud: number | undefined = this.context.runEnvironment.downloadBaudRateFromCLI
      ? this.context.runEnvironment.downloadBaudrate
      : undefined;
    const rateBeforeDownload: number = this.serialPort.getCurrentBaudRate();
    const mustSwitch: boolean = explicitDownloadBaud !== undefined && explicitDownloadBaud !== rateBeforeDownload;
    if (mustSwitch) {
      console.log(`[HEADLESS] Switching to download baud ${explicitDownloadBaud} (was ${rateBeforeDownload})`);
      this.logger.logSystem(`Switching to download baud ${explicitDownloadBaud}`);
      await this.serialPort.changeBaudRate(explicitDownloadBaud as number);
    }

    try {
      const result = await this.downloader.download(filePath, toFlash);

      if (result.success) {
        console.log(`[HEADLESS] Download successful`);
        this.logger.logSystem(`Download completed successfully: ${filePath}`);
      } else {
        console.error(`[HEADLESS] Download failed: ${result.errorMessage || 'Unknown error'}`);
        this.logger.logError(`Download failed: ${result.errorMessage || 'Unknown error'}`);
      }

      return result.success;
    } catch (error) {
      console.error(`[HEADLESS] Download error: ${error}`);
      this.logger.logError(`Download error: ${error}`);
      return false;
    } finally {
      // Put the port on the EFFECTIVE serial rate, whether or not we switched for the
      // download and whether it succeeded or threw — the P2 is (or is about to be)
      // transmitting DEBUG, and a port on the wrong rate yields a log full of garbage
      // that reads like a hardware fault.
      //
      // This also repairs a defect that predates --downloadbaud: adoptBaudFromBinary()
      // above sets UsbSerial.desiredCommsBaudRate (and runEnvironment.debugBaudrate)
      // from the image's _baud_, but NOTHING retuned the live port afterwards. The only
      // catch-up is in handleSerialOpen(), which runs at OPEN time only — long before
      // we ever read the binary. So headless honored an in-source DEBUG_BAUD in its
      // bookkeeping and ignored it on the wire. The GUI path has always retuned here;
      // headless simply never did.
      const effectiveSerialBaud: number = this.context.runEnvironment.debugBaudrate || UsbSerial.desiredCommsBaudRate;
      if (this.serialPort.getCurrentBaudRate() !== effectiveSerialBaud) {
        console.log(`[HEADLESS] Setting serial baud ${effectiveSerialBaud} after download`);
        this.logger.logSystem(`Serial baud ${effectiveSerialBaud} after download`);
        await this.serialPort.changeBaudRate(effectiveSerialBaud);
      }
    }
  }

  /**
   * Adopt the debug baud carried inside the binary being downloaded.
   *
   * Headless is where this matters most: an unattended agent run that listens at
   * the wrong rate produces a log full of garbage that reads like a hardware
   * fault, and nothing is watching to notice. An explicit -b still wins, but we
   * warn when it contradicts the image. A binary with no debug ROM changes
   * nothing. See utils/p2DebugHeader.ts.
   */
  private adoptBaudFromBinary(filePath: string): void {
    const header = readDebugHeaderFromFile(filePath);
    if (header === null) {
      return; // no debug ROM — no DEBUG output to mis-tune for
    }

    const currentBaud: number = this.context.runEnvironment.debugBaudrate || UsbSerial.desiredCommsBaudRate;

    if (this.context.runEnvironment.debugBaudRateFromCLI) {
      if (header.baud !== currentBaud) {
        const warning =
          `WARNING: --baud ${currentBaud} disagrees with this binary's compiled DEBUG_BAUD (${header.baud}). ` +
          `The P2 will transmit at ${header.baud} — expect unreadable output. Drop --baud to use the binary's rate.`;
        console.warn(`[HEADLESS] ${warning}`);
        this.logger.logSystem(warning);
      }
      return; // explicit flag wins
    }

    if (header.baud !== currentBaud) {
      console.log(`[HEADLESS] Using serial baud ${header.baud} from the binary's DEBUG_BAUD (was ${currentBaud})`);
      this.logger.logSystem(`Using serial baud ${header.baud} — the DEBUG_BAUD carried in ${filePath}`);
    }
    this.context.runEnvironment.debugBaudrate = header.baud;
    UsbSerial.setCommBaudRate(header.baud);
    // Same evidence boundary as the CLI and the GUI adopt path — an unattended run is
    // exactly where an unexplained gap in the log is hardest to diagnose after the fact.
    if (header.baud > MAX_VALIDATED_BAUD) {
      const note =
        `WARNING: this binary's DEBUG_BAUD (${header.baud}) is above the highest rate this app has been ` +
        `verified to carry (${MAX_VALIDATED_BAUD}). Behavior above that rate is UNMEASURED — it may carry ` +
        `the stream fine, or it may drop data. Please report what you observe.`;
      console.warn(`[HEADLESS] ${note}`);
      this.logger.logSystem(note);
    }
  }

  /**
   * Set up signal handlers for external control
   */
  private setupSignalHandlers(): void {
    // SIGTERM - Graceful shutdown (from kill command)
    process.on('SIGTERM', () => {
      console.log('[HEADLESS] Received SIGTERM');
      this.logger.logSystem('Received SIGTERM signal');
      this.beginShutdown(ExitCode.OK, 'SIGTERM');
    });

    // SIGINT - Ctrl+C
    process.on('SIGINT', () => {
      console.log('[HEADLESS] Received SIGINT (Ctrl+C)');
      this.logger.logSystem('Received SIGINT signal (Ctrl+C)');
      this.beginShutdown(ExitCode.OK, 'SIGINT');
    });

    // SIGUSR1 - Reset hardware (Linux/macOS only)
    if (process.platform !== 'win32') {
      process.on('SIGUSR1', () => {
        console.log('[HEADLESS] Received SIGUSR1 - resetting hardware');
        this.logger.logSystem('Received SIGUSR1 signal - resetting hardware');
        this.resetHardware().catch((error: unknown) => {
          // Same class as beginShutdown(): a bare async call in a signal handler has
          // nowhere to reject to. Report it and keep running — a failed reset is not
          // a reason to kill the run, and it must NEVER rewrite the exit status.
          console.error(`[HEADLESS] Hardware reset failed (non-fatal): ${error}`);
        });
      });
    }
  }

  /**
   * Reset hardware via DTR or RTS pulse
   */
  public async resetHardware(): Promise<void> {
    if (!this.serialPort) {
      console.warn('[HEADLESS] Cannot reset: serial port not open');
      return;
    }

    console.log(`[HEADLESS] Resetting hardware via ${this.controlLineMode}`);
    this.logger.logSystem(`Hardware reset via ${this.controlLineMode}`);

    try {
      if (this.controlLineMode === 'DTR') {
        await this.serialPort.setDTR(true); // Assert (LOW)
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms pulse
        await this.serialPort.setDTR(false); // De-assert (HIGH)
      } else {
        await this.serialPort.setRTS(true); // Assert (LOW)
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms pulse
        await this.serialPort.setRTS(false); // De-assert (HIGH)
      }
      console.log('[HEADLESS] Hardware reset complete');
    } catch (error) {
      console.error(`[HEADLESS] Hardware reset failed: ${error}`);
      this.logger.logError(`Hardware reset failed: ${error}`);
    }
  }

  /**
   * Fire-and-forget entry to initiateShutdown() from a callback that cannot await —
   * the end-marker callback, the timeout timer, and the SIGTERM/SIGINT handlers.
   *
   * Every one of those sites used `void this.initiateShutdown(...)`. `void` is NOT a
   * rejection handler; it satisfies a linter and leaves the rejection every bit as
   * unhandled, which under Node >= 15 kills the process with status 1. That is
   * catastrophic HERE specifically: these are the five places that DECIDE the exit
   * code, so a stumble while shutting down would discard the very code it was
   * shutting down to report.
   *
   * So: catch, report, and still hand the run the code we intended. A shutdown that
   * goes wrong must still be a shutdown that reports its verdict.
   */
  private beginShutdown(code: number, reason: string): void {
    this.initiateShutdown(code, reason).catch((error: unknown) => {
      console.error(`[HEADLESS] Shutdown (${reason}) failed: ${error}`);
      try {
        this.logger.logError(`Shutdown (${reason}) failed: ${error}`);
      } catch {
        /* the logger is the thing that just failed — don't compound it */
      }
      // The run promise is the ONLY way a code reaches the shell. Resolve it even on
      // a failed teardown, escalating a would-be-clean exit to FlushTimeout because
      // that is exactly what "your output may be incomplete" means.
      if (this.resolveRun) {
        const resolve = this.resolveRun;
        this.resolveRun = null;
        resolve(this.exitCode === ExitCode.OK ? ExitCode.FlushTimeout : this.exitCode);
      }
    });
  }

  /**
   * Initiate graceful shutdown
   */
  private async initiateShutdown(code: number, reason: string): Promise<void> {
    if (this.isShuttingDown) {
      return; // Already shutting down
    }

    this.isShuttingDown = true;
    this.exitCode = code;

    console.log(`[HEADLESS] Initiating shutdown: ${reason} (exit code: ${code})`);
    this.logger.logSystem(`Shutdown initiated: ${reason}`);

    // Clear timeout timer if set
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    // Stop ingest first so no new log data can arrive mid-flush.
    //
    // AWAIT the close. It used to be called bare, and UsbSerial.close() is `async` —
    // so the try/catch around it could only ever catch a SYNCHRONOUS throw, and a
    // rejected close escaped as an unhandled rejection. Under Node >= 15's default
    // (`--unhandled-rejections=throw`) that becomes an uncaught exception, and Node
    // then FORCES exit status 1 — silently overwriting the exit code we just decided
    // and printed on the line above. That is the v1.0.3 defect: a clean end-marker
    // run announced "(exit code: 0)" and handed the shell a 1, intermittently,
    // depending on whether the native close happened to error while the P2 was still
    // transmitting. Awaiting puts the rejection back inside the catch, where the
    // comment always implied it was.
    //
    // Awaiting is also correct for its own sake: it means the port is genuinely
    // released before the run resolves, rather than closing behind us.
    if (this.serialPort) {
      try {
        this.serialPort.setShuttingDown(true);
        await this.serialPort.close();
      } catch (error) {
        // Non-fatal: we are exiting anyway, and the OS reclaims the handle. Report it,
        // but never let a teardown hiccup rewrite the run's outcome.
        console.error(`[HEADLESS] Error closing serial port (non-fatal): ${error}`);
        this.logger.logSystem(`Error closing serial port (non-fatal): ${error}`);
      }
      this.serialPort = null;
    }

    // Close USB traffic logger
    if (this.usbLogger) {
      this.usbLogger.disable();
      this.usbLogger = null;
    }

    // Flush + close the log stream — the log is the product, so AWAIT it (the
    // stream end() is async; resolving the run before it finishes truncates the
    // tail). Best-effort with the shared drain timeout; on overrun, escalate to
    // FlushTimeout so the launcher knows the log may be incomplete.
    const flushed = await this.drainLog(SHUTDOWN_DRAIN_TIMEOUT_MS);
    if (!flushed && this.exitCode === ExitCode.OK) {
      this.exitCode = ExitCode.FlushTimeout;
    }

    console.log(`[HEADLESS] Log file: ${this.logger.getLogFilePath()}`);

    // Resolve the run promise
    if (this.resolveRun) {
      this.resolveRun(this.exitCode);
    }
  }

  /**
   * Await the log flush/close up to timeoutMs. Returns true if it finished,
   * false on timeout (log tail may be incomplete).
   */
  private async drainLog(timeoutMs: number): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    const done = this.logger.close().then(() => true);
    const ok = await Promise.race([done, timedOut]);
    if (timer) clearTimeout(timer);
    return ok;
  }

  /**
   * Get the current exit code
   */
  public getExitCode(): number {
    return this.exitCode;
  }
}
