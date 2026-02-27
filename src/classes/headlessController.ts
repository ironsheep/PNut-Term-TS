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

import { Context } from '../utils/context';
import { UsbSerial } from '../utils/usb.serial';
import { HeadlessFileLogger } from './shared/headlessFileLogger';
import { Downloader } from './downloader';

export class HeadlessController {
  private context: Context;
  private serialPort: UsbSerial | null = null;
  private logger: HeadlessFileLogger;
  private downloader: Downloader | null = null;

  // Termination control
  private exitCode: number = 0;
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

    // Set up end-marker callback
    this.logger.setEndMarkerCallback(() => {
      this.initiateShutdown(0, 'End marker detected');
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
        this.initiateShutdown(124, 'Timeout'); // Exit code 124 = timeout (Unix convention)
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
        this.initiateShutdown(3, 'Download failed');
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
      this.initiateShutdown(0, 'SIGTERM');
    });

    // SIGINT - Ctrl+C
    process.on('SIGINT', () => {
      console.log('[HEADLESS] Received SIGINT (Ctrl+C)');
      this.logger.logSystem('Received SIGINT signal (Ctrl+C)');
      this.initiateShutdown(0, 'SIGINT');
    });

    // SIGUSR1 - Reset hardware (Linux/macOS only)
    if (process.platform !== 'win32') {
      process.on('SIGUSR1', () => {
        console.log('[HEADLESS] Received SIGUSR1 - resetting hardware');
        this.logger.logSystem('Received SIGUSR1 signal - resetting hardware');
        this.resetHardware();
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
   * Initiate graceful shutdown
   */
  private initiateShutdown(code: number, reason: string): void {
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

    // Close serial port
    if (this.serialPort) {
      try {
        this.serialPort.setShuttingDown(true);
        this.serialPort.close();
      } catch (error) {
        console.error(`[HEADLESS] Error closing serial port: ${error}`);
      }
      this.serialPort = null;
    }

    // Close logger
    this.logger.close();

    console.log(`[HEADLESS] Log file: ${this.logger.getLogFilePath()}`);

    // Resolve the run promise
    if (this.resolveRun) {
      this.resolveRun(this.exitCode);
    }
  }

  /**
   * Get the current exit code
   */
  public getExitCode(): number {
    return this.exitCode;
  }
}
