/* eslint-disable @typescript-eslint/no-unused-vars */

const ENABLE_CONSOLE_LOG: boolean = true;

'use strict';

import { SerialPort } from 'serialport';
// ReadlineParser REMOVED - was corrupting binary data and killing performance!
import { waitMSec, waitSec } from './timerUtils';
import { Context } from './context';
import { EventEmitter } from 'events';

const DEFAULT_DOWNLOAD_BAUD = 2000000;

export class UsbSerial extends EventEmitter {
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  // This should be set by MainWindow before creating the port
  // No hardcoded default - MainWindow owns the baud rate decision cascade
  static desiredCommsBaudRate: number = 115200;  // Will be overridden by setCommBaudRate()

  private context: Context;
  private endOfLineStr: string = '\r\n';
  private _deviceNode: string = '';
  private _serialPort: SerialPort;
  // Parser removed - was corrupting binary data! Now using manual P2 detection
  private _p2DetectionBuffer: string = '';
  private _downloadBaud: number = DEFAULT_DOWNLOAD_BAUD;
  private _p2DeviceId: string = '';
  private _p2loadLimit: number = 0;
  private _latestError: string = '';
  private _dtrValue: boolean = false;
  private _rtsValue: boolean = false;
  private _downloadChecksumGood = false;
  private _downloadResponse: string = '';
  private _checksumVerified: boolean = false;
  private checkedForP2: boolean = false;
  private _isDownloading: boolean = false;  // Track download state
  private _expectingP2Response: boolean = false; // Flag to track when we're expecting P2 ID responses that should be consumed
  private _expectingChecksumResponse: boolean = false; // Flag to track when we're expecting checksum responses that should be consumed
  private _isShuttingDown: boolean = false;  // Flag to stop processing data during shutdown
  private _ignoreFrontTraffic: boolean = false;  // Flag to drop incoming data (quiesce/startup control)

  constructor(ctx: Context, deviceNode: string) {
    super();
    this.context = ctx;
    this._deviceNode = deviceNode;
    if (this.context.runEnvironment.loggingEnabled) {
      this.logMessage('Spin/Spin2 USB.Serial log started.');
    }
    this.logMessage(`* Connecting to ${this._deviceNode}`);

    // WORKAROUND for macOS FTDI bug with high baud rates:
    // Initialize at a standard rate, then immediately update to the desired rate
    const initialBaudRate = (UsbSerial.desiredCommsBaudRate > 230400 && process.platform === 'darwin')
      ? 115200  // Use standard rate first on macOS for high speeds
      : UsbSerial.desiredCommsBaudRate;

    if (initialBaudRate !== UsbSerial.desiredCommsBaudRate) {
      this.logConsoleMessage(`[USB] macOS workaround: Opening at ${initialBaudRate}, will update to ${UsbSerial.desiredCommsBaudRate}`);
    }

    this._serialPort = new SerialPort({
      path: this._deviceNode,
      baudRate: initialBaudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false,
      hupcl: false,  // Prevent automatic DTR/RTS assertion on port open
      highWaterMark: 1024 * 1024  // 1MB buffer (up from 16KB default) to prevent USB data loss
    });
    // Open errors will be emitted as an error event
    this._serialPort.on('error', (err) => this.handleSerialError(err.message));
    this._serialPort.on('open', () => this.handleSerialOpen());

    // Handle ALL data through raw handler - no parser interference!
    // Parser was corrupting binary data and destroying performance
    this._serialPort.on('data', (data: Buffer) => {
      // GUARD: During shutdown, drop all incoming data immediately
      if (this._isShuttingDown) {
        return; // Silently ignore - prevents race conditions during app exit
      }

      // GUARD: During quiesce/startup control, drop incoming data
      if (this._ignoreFrontTraffic) {
        return; // Silently drop - system in quiesced state or awaiting reset
      }

      // FIRST: Check for P2 detection (sets _p2DeviceId)
      // This MUST happen before emit so detection state is ready before any routing decisions
      this.checkForP2Response(data);

      // THEN: Emit raw data to MainWindow (preserves binary integrity)
      this.emit('data', data);
    });

    // now open the port
    this._serialPort.open((err) => {
      if (err) {
        this.handleSerialError(err.message);
      }
    });
  }

  // Dispose method
  /*
  private dispose(): void {
    if (this._serialPort) {
      // Remove all listeners to prevent memory leaks
      this._serialPort.removeAllListeners();

      // Set the port to null
      this._serialPort = null;
    }
  }
  */

  // ----------------------------------------------------------------------------
  //   CLASS Methods (static)
  // ----------------------------------------------------------------------------
  //
  static setCommBaudRate(baudRate: number): void {
    UsbSerial.desiredCommsBaudRate = baudRate;
  }

  /**
   * Change baud rate of active serial port
   * Uses the update() method which is the proper way to change baud rate on an open port
   */
  public async changeBaudRate(newBaudRate: number): Promise<void> {
    if (this._serialPort && this._serialPort.isOpen) {
      const oldBaudRate = this._serialPort.baudRate;
      this.logMessage(`* Changing baud rate from ${oldBaudRate} to ${newBaudRate}`);
      this.logConsoleMessage(`[USB BAUD] Attempting to change baud rate from ${oldBaudRate} to ${newBaudRate} using update()`);

      try {
        // Use the update() method - this is the proper way to change baud rate
        // Note: Only baudRate can be changed on an open port
        await new Promise<void>((resolve, reject) => {
          this._serialPort.update({ baudRate: newBaudRate }, (err) => {
            if (err) {
              this.logConsoleMessage(`[USB BAUD] update() failed: ${err.message}`);
              reject(err);
            } else {
              resolve();
            }
          });
        });

        // Verify the baud rate actually changed
        const actualBaud = this._serialPort.baudRate;
        if (actualBaud !== newBaudRate) {
          this.logConsoleMessage(`[USB BAUD] WARNING: Baud rate is ${actualBaud}, expected ${newBaudRate}`);
        } else {
          this.logConsoleMessage(`[USB BAUD] Successfully updated to ${newBaudRate} using update()`);
        }

        // WORKAROUND for SerialPort v8.x.x bug: RTS gets cleared on update()
        // Restore RTS if it was previously set
        if (this._rtsValue) {
          this.logConsoleMessage(`[USB BAUD] Restoring RTS after update() bug workaround`);
          await this.setRts(true);
        }

        // Update the static desired baud rate
        UsbSerial.desiredCommsBaudRate = newBaudRate;

        this.logMessage(`* Baud rate changed successfully to ${newBaudRate}`);
        this.logConsoleMessage(`[USB BAUD] Baud rate change complete`);
        return;
      } catch (updateError: any) {
        this.logConsoleMessage(`[USB BAUD] update() method failed, falling back to close/reopen: ${updateError.message}`);
      }

      // FALLBACK: If update() fails, try the close/reopen method
      // This shouldn't normally be needed, but kept as a backup
      this.logConsoleMessage(`[USB BAUD] Falling back to close/reopen method`);
      const portPath = this._serialPort.path;

      // Remove listeners from old port before closing
      this._serialPort.removeAllListeners();

      // Close current port
      await new Promise<void>((resolve, reject) => {
        this._serialPort.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Reopen with new baud rate - MUST include all original settings!
      this._serialPort = new SerialPort({
        path: portPath,
        baudRate: newBaudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        autoOpen: false,
        hupcl: false,  // CRITICAL: Prevent automatic DTR/RTS assertion on port open
        highWaterMark: 1024 * 1024  // CRITICAL: 1MB buffer to prevent USB data loss
      });

      // Re-attach all event listeners
      this._serialPort.on('error', (err) => this.handleSerialError(err.message));
      this._serialPort.on('open', () => {
        // Don't call handleSerialOpen() here as it would trigger reset
        this.logMessage(`* Port reopened at ${newBaudRate} baud`);
      });

      // CRITICAL: Re-attach data handler - this is what receives all serial data!
      this._serialPort.on('data', (data: Buffer) => {
        // GUARD: During shutdown, drop all incoming data immediately
        if (this._isShuttingDown) {
          return; // Silently ignore - prevents race conditions during app exit
        }

        // GUARD: During quiesce/startup control, drop incoming data
        if (this._ignoreFrontTraffic) {
          return; // Silently drop - system in quiesced state or awaiting reset
        }

        // FIRST: Check for P2 detection (sets _p2DeviceId)
        // This MUST happen before emit so detection state is ready before any routing decisions
        this.checkForP2Response(data);

        // THEN: Emit raw data to MainWindow (preserves binary integrity)
        this.emit('data', data);
      });

      // Open the port with new settings
      await new Promise<void>((resolve, reject) => {
        this._serialPort.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // CRITICAL: Only flush if switching TO download speed (clearing old debug data)
      // When switching BACK to debug speed after download, we want to catch the first bytes immediately
      if (newBaudRate === 2000000) {
        // Switching TO download speed - flush old debug data
        try {
          await new Promise<void>((resolve, reject) => {
            this._serialPort.flush((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          this.logMessage(`* Buffers flushed before download`);
        } catch (flushErr: any) {
          this.logMessage(`* Flush warning: ${flushErr.message}`);
        }
      }
      // NO delay when switching back to debug baud - we need to catch the first bytes from the P2!

      // Update the static desired baud rate
      UsbSerial.desiredCommsBaudRate = newBaudRate;

      this.logMessage(`* Baud rate changed successfully to ${newBaudRate}`);
      this.logConsoleMessage(`[USB BAUD] Baud rate changed successfully to ${newBaudRate}`);
    } else {
      throw new Error('Cannot change baud rate: serial port not open');
    }
  }

  public getCurrentBaudRate(): number {
    if (this._serialPort && this._serialPort.isOpen) {
      return this._serialPort.baudRate;
    }
    return 0;
  }

  /**
   * Flush the receive buffer to clear any corrupted/stale data
   * Useful after baud rate changes to prevent garbage bytes
   *
   * Note: The flush() method is unreliable on macOS/FTDI for clearing receive buffers.
   * Consider using waitForCleanDataStream() instead for more reliable operation.
   */
  public async flushReceiveBuffer(): Promise<void> {
    if (!this._serialPort || !this._serialPort.isOpen) {
      throw new Error('Serial port is not open');
    }

    // Also clear our internal P2 detection buffer
    this._p2DetectionBuffer = '';

    return new Promise<void>((resolve, reject) => {
      // Flush discards data in both receive and transmit buffers
      // We only care about receive, but this is the only method available
      this._serialPort.flush((err) => {
        if (err) {
          this.logMessage(`FlushRx: ERROR: ${err.message}`);
          reject(err);
        } else {
          this.logMessage(`FlushRx: Receive buffer cleared`);
          resolve();
        }
      });
    });
  }

  /**
   * Clear garbage bytes from the receive stream using a simple time-based approach
   * This is more reliable than flush() which doesn't work properly on macOS/FTDI.
   *
   * Strategy: Discard ALL data for a fixed time period after baud rate switch.
   * Everything within this time window is considered garbage.
   *
   * @param discardMs Time to discard ALL incoming data (default 25ms)
   * @returns Number of garbage bytes discarded
   */
  public async clearGarbageBytes(discardMs: number = 25): Promise<number> {
    if (!this._serialPort || !this._serialPort.isOpen) {
      throw new Error('Serial port is not open');
    }

    let garbageBytes = 0;

    this.logMessage(`[GARBAGE_CLEAR] Discarding ALL data for ${discardMs}ms`);

    // Temporarily store the original data handler
    const originalHandlers = this._serialPort.listeners('data');

    // Simple handler: discard everything within the time window
    const garbageHandler = (data: Buffer) => {
      garbageBytes += data.length;
      this.logMessage(`[GARBAGE_CLEAR] Discarded ${data.length} bytes: ${Array.from(data.slice(0, Math.min(data.length, 20))).map(b => `$${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')}`);
    };

    // Replace data handlers temporarily
    this._serialPort.removeAllListeners('data');
    this._serialPort.on('data', garbageHandler);

    try {
      // Wait for the discard period - everything within this window is garbage
      await new Promise(resolve => setTimeout(resolve, discardMs));

      this.logMessage(`[GARBAGE_CLEAR] Time window complete. Discarded ${garbageBytes} total bytes`);
    } finally {
      // Always restore original handlers
      this._serialPort.removeAllListeners('data');
      for (const handler of originalHandlers) {
        this._serialPort.on('data', handler as any);
      }
    }

    return garbageBytes;
  }

  static async serialDeviceList(ctx?: Context): Promise<string[]> {
    const devicesFound: string[] = [];
    try {
      const ports = await SerialPort.list();

      // Always log to context if provided
      if (ctx) {
        ctx.logger.debugMsg(`* SerialPort.list() returned ${ports.length} total serial port(s)`);
      }
      UsbSerial.logConsoleMessageStatic(`[USB] Found ${ports.length} total serial ports`);

      ports.forEach((port) => {
        const tmpSerialNumber: string | undefined = port.serialNumber;
        const serialNumber: string = tmpSerialNumber !== undefined ? tmpSerialNumber : '{unknownSN}';
        const deviceNode: string = port.path;

        // Log all ports for debugging
        UsbSerial.logConsoleMessageStatic(`[USB] Port: ${deviceNode}, VID:${port.vendorId}, PID:${port.productId}, SN:${serialNumber}`);

        if (ctx) {
          ctx.logger.debugMsg(`*   Port: ${deviceNode}, VID:${port.vendorId || 'none'}, PID:${port.productId || 'none'}, SN:${serialNumber}`);
        }

        if (port.vendorId == '0403' && port.productId == '6015') {
          devicesFound.push(`${deviceNode},${serialNumber}`);
          if (ctx) {
            ctx.logger.verboseMsg(`*   ✓ PropPlug device found: ${deviceNode} (SN: ${serialNumber})`);
          }
        }
      });

      if (devicesFound.length === 0 && ports.length > 0) {
        if (ctx) {
          ctx.logger.debugMsg(`* No Parallax PropPlug devices (0403:6015) found among ${ports.length} serial port(s)`);
          ctx.logger.verboseMsg(`* Hint: Looking specifically for VID:0403 PID:6015 (Parallax PropPlug)`);
        }
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (ctx) {
        ctx.logger.errorMsg(`* Failed to list USB devices: ${errorMsg}`);
        if (errorMsg.includes('permission') || errorMsg.includes('access') || errorMsg.includes('EACCES')) {
          ctx.logger.errorMsg(`* Try running with sudo or check USB device permissions`);
        } else if (errorMsg.includes('ENOENT')) {
          ctx.logger.errorMsg(`* System tools for USB enumeration may be missing`);
        }
      }
      // Re-throw to let caller handle
      throw error;
    }
    return devicesFound;
  }

  // ----------------------------------------------------------------------------
  //   PUBLIC Instance Methods
  // ----------------------------------------------------------------------------
  //
  get deviceError(): string | undefined {
    let desiredText: string | undefined = undefined;
    if (this._latestError.length > 0) {
      desiredText = this._latestError;
    }
    return desiredText;
  }

  get deviceInfo(): string {
    return this._p2DeviceId;
  }

  get foundP2(): boolean {
    return this._p2DeviceId === '' ? false : true;
  }

  get usbConnected(): boolean {
    return this._serialPort.isOpen;
  }

  public getChecksumStatus(): { verified: boolean; valid: boolean; response: string } {
    return {
      verified: this._checksumVerified,
      valid: this._downloadChecksumGood,
      response: this._downloadResponse
    };
  }

  public getIdStringOrError(): [string, string] {
    return [this._p2DeviceId, this._latestError];
  }

  public isDownloading(): boolean {
    return this._isDownloading;
  }

  /**
   * Set shutdown flag to stop processing incoming data
   * Called during app shutdown to prevent race conditions
   */
  public setShuttingDown(shuttingDown: boolean): void {
    this._isShuttingDown = shuttingDown;
  }

  /**
   * Control whether incoming USB traffic is processed or dropped
   * Used for startup control and manual quiesce/reset operations
   */
  public setIgnoreFrontTraffic(ignore: boolean): void {
    this._ignoreFrontTraffic = ignore;
    this.logMessage(`[USB] Traffic control: ${ignore ? 'BLOCKING' : 'FLOWING'}`);
  }

  public async close(): Promise<void> {
    // (alternate suggested by perplexity search)
    // release the usb port
    this.logMessage(`* USBSer closing...`);
    if (this._serialPort && this._serialPort.isOpen) {
      await waitMSec(10); // 500 allowed prop to restart? use 10 mSec instead

      // CRITICAL: Preserve DTR/RTS state before close to prevent P2 reset
      // Even with hupcl:false, some platforms may toggle control lines on close
      // Explicitly ensure DTR/RTS stay de-asserted (HIGH) to keep P2 running
      try {
        await this.setDtr(false);  // false = HIGH = de-asserted (no reset)
        await this.setRts(false);  // false = HIGH = de-asserted (no reset)
        this.logMessage(`  -- close() DTR/RTS preserved in de-asserted state`);
      } catch (controlLineErr: any) {
        this.logMessage(`  -- close() Control line warning (non-fatal): ${controlLineErr.message}`);
      }

      // CRITICAL: Drain outgoing data and flush incoming buffers before closing
      // This prevents stale data from being picked up on next app start
      try {
        // First: Drain TX buffer (ensure outgoing data is sent)
        await this.drain();
        this.logMessage(`  -- close() TX buffer drained`);
      } catch (drainErr: any) {
        this.logMessage(`  -- close() Drain warning (non-fatal): ${drainErr.message}`);
      }

      try {
        // Then: Flush RX/TX buffers (discard any stale incoming data)
        await new Promise<void>((resolve, reject) => {
          this._serialPort.flush((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        this.logMessage(`  -- close() RX/TX buffers flushed`);
      } catch (flushErr: any) {
        this.logMessage(`  -- close() Flush warning (non-fatal): ${flushErr.message}`);
      }
    }
    // Remove all listeners to prevent memory leaks and allow port to be reused
    this._serialPort.removeAllListeners();

    return new Promise((resolve, reject) => {
      if (this._serialPort && this._serialPort.isOpen) {
        this._serialPort.close((err) => {
          if (err) {
            this.logMessage(`  -- close() Error: ${err.message}`);
            reject(err);
          } else {
            this.logMessage(`  -- close() - port close: isOpen=(${this._serialPort.isOpen})`);
            resolve();
          }
        });
      } else if (!this._serialPort.isOpen) {
        this.logMessage(`  -- close() ?? port already closed ??`);
        resolve();
      } else {
        this.logMessage(`  -- close() ?? no port to close ??`);
        resolve();
      }
      this.logMessage(`* USBSer closed`);
    });
  }

  public async deviceIsPropellerV2(): Promise<boolean> {
    this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() ENTER - current _p2DeviceId: '${this._p2DeviceId}'`);
    this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() - _expectingP2Response will be set to TRUE`);

    // For downloads: ALWAYS reset and check P2
    const didCheck = await this.requestPropellerVersionForDownload(); // Always reset for download
    let foundPropellerStatus: boolean = false;

    this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() - Waiting 200ms for P2 response...`);
    // Wait for response after reset
    await waitMSec(200); // wait 0.2 sec for response (usually takes 0.09 sec)

    // Check _p2DeviceId BEFORE trying to re-process buffer
    // The data handler should have already set this during the async wait above
    this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() - After 200ms wait, _p2DeviceId: '${this._p2DeviceId}'`);
    this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() - detection buffer after wait: '${this._p2DetectionBuffer}'`);

    // Process any P2 response in the existing buffer
    // The buffer already has data from the serial port handler
    if (this._p2DetectionBuffer.length > 0) {
      this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() - Buffer has ${this._p2DetectionBuffer.length} chars, re-processing...`);
      // Convert buffer string back to Buffer for processing
      const bufferData = Buffer.from(this._p2DetectionBuffer, 'utf8');
      this.checkForP2Response(bufferData);
    } else {
      this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() - Buffer is empty (likely already processed by data handler)`);
    }

    const [deviceString, deviceErrorString] = this.getIdStringOrError();
    this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() - deviceString: '${deviceString}', errorString: '${deviceErrorString}'`);

    if (deviceErrorString.length > 0) {
      this.logConsoleMessage(`[USB-P2] * deviceIsPropeller() ERROR: ${deviceErrorString}`);
    } else if (deviceString.length > 0 && deviceErrorString.length == 0) {
      foundPropellerStatus = true;
    }

    this.logConsoleMessage(`[USB-P2] * deviceIsPropeller() -> (${foundPropellerStatus}) with _p2DeviceId: '${this._p2DeviceId}'`);

    // Clear flag after processing P2 response - resume normal data forwarding
    this._expectingP2Response = false;
    this.logConsoleMessage(`[USB-P2] * deviceIsPropellerV2() - _expectingP2Response cleared to FALSE`);

    return foundPropellerStatus;
  }

  /**
   * Request P2 version for download - ALWAYS performs reset sequence
   * This is separate from initial connection check and always executes
   */
  private async requestPropellerVersionForDownload(): Promise<boolean> {
    const requestPropType: string = 'Prop_Chk';

    this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() - ALWAYS resetting for download`);
    this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() - port open (${this._serialPort.isOpen})`);

    // Set flag to consume P2 ID responses (don't forward to mainWindow during download)
    this._expectingP2Response = true;

    try {
      await this.waitForPortOpen();
      // continue with ID effort...
      await waitMSec(250);

      // Use RTS instead of DTR if RTS override is enabled
      if (this.context.runEnvironment.rtsOverride) {
        this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() - Using RTS reset`);
        // FTDI workaround: Toggle twice for proper pulse
        await this.setRts(false);  // Ensure we start HIGH
        await waitMSec(5);          // Let it settle
        await this.setRts(true);    // Pull LOW (assert)
        await waitMSec(10);         // Hold for 10ms
        await this.setRts(false);   // Return HIGH (de-assert)
      } else {
        this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() - Using DTR reset`);
        // The Prop Plug hardware generates a 17µs reset pulse automatically when DTR toggles
        // We just need to trigger it and time our Prop_Chk correctly

        // Toggle DTR to trigger the Prop Plug's built-in 17µs reset pulse
        await this.setDtr(true);    // This triggers the hardware's 17µs reset pulse
        await this.setDtr(false);   // Return DTR to idle state

        this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() - DTR toggle complete, hardware reset pulse fired`);
      }

      // Fm Silicon Doc:
      //   Unless preempted by a program in a SPI memory chip with a pull-up resistor on P60 (SPI_CK), the
      //     serial loader becomes active within 15ms of reset being released.
      //
      //   If nothing sent, and Edge Module default switch settings, the prop will boot in 142 mSec
      //
      // The 17µs pulse is enough to reset the P2, now wait for bootloader to be ready
      // PNut v51 sends Prop_Chk at 17ms after reset (not within 15ms window as documented)
      await waitMSec(17); // Match PNut v51 timing: 17ms after reset

      // CRITICAL: Clear stale data from detection buffer before sending Prop_Chk
      // Any data received BEFORE the reset (from old program) must be discarded
      this._p2DetectionBuffer = '';
      this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() - Detection buffer cleared`);

      this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() - Sending > ${requestPropType} 0 0 0 0[space] for autobaud`);
      // Use space terminator as observed in PNut v51, not CR
      await this.write(`> ${requestPropType} 0 0 0 0 `);
      this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() - Command sent, waiting for response`);
      // drain() now called inside write() for guaranteed delivery
      return true;
    } catch (error) {
      this.logConsoleMessage(`[USB-P2] * requestPropellerVersionForDownload() ERROR: ${JSON.stringify(error, null, 2)}`);
      return false;
    }
  }

  public async downloadNoCheck(uint8Bytes: Uint8Array) {
    // Set download flag to prevent data routing
    this._isDownloading = true;

    // PNut v51 format: 'Prop_Txt 0 0 0 0' with space terminator
    const requestStartDownload: string = 'Prop_Txt 0 0 0 0';
    const byteCount: number = uint8Bytes.length < this._p2loadLimit ? uint8Bytes.length : this._p2loadLimit;
    if (this.usbConnected && uint8Bytes.length > 0) {
      const dataBase64: string = Buffer.from(uint8Bytes).toString('base64');
      // Use space terminator as observed in PNut v51, not CR
      await this.write(`> ${requestStartDownload} `);  // > triggers P2 autobaud
      //await this.write(dataBase64);
      // Break this up into lines with > sync chars starting each
      const LINE_LENGTH: number = 1024;
      // silicon doc says: It's a good idea to start each Base64 data line with a ">" character, to keep the baud rate tightly calibrated.
      const lineCount: number = Math.ceil(dataBase64.length / LINE_LENGTH);
      const lastLineLength: number = dataBase64.length % LINE_LENGTH || LINE_LENGTH;
      for (let index = 0; index < lineCount; index++) {
        const lineLength = index == lineCount - 1 ? lastLineLength : LINE_LENGTH;
        const singleLine = dataBase64.substring(index * LINE_LENGTH, index * LINE_LENGTH + lineLength);
        await this.write('>' + singleLine);
      }
      // Send terminator - just ~ character as seen in PNut v51
      await this.write('~');  // Terminator only, no > or CR needed
    }

    // Clear download flag when done
    this._isDownloading = false;
    this.logMessage(`* downloadNoCheck() - Download complete, isolation mode disabled`);
  }

  public async download(uint8Bytes: Uint8Array, needsP2ChecksumVerify: boolean): Promise<void> {
    // Set download flag to prevent data routing
    this._isDownloading = true;

    // reset our status indicators
    this._downloadChecksumGood = false;
    this._downloadResponse = '';
    this._checksumVerified = false;
    //
    // PNut v51 format: 'Prop_Txt 0 0 0 0' with space terminator
    const requestStartDownload: string = 'Prop_Txt 0 0 0 0';
    const byteCount: number = uint8Bytes.length < this._p2loadLimit ? uint8Bytes.length : this._p2loadLimit;
    this.logMessage(`* download() - port open (${this._serialPort.isOpen})`);
    // wait for port to be open...
    try {
      const didOpen = await this.waitForPortOpen();
      this.logMessage(`* download() port opened = (${didOpen}) `);

      // PNut v51 waits 12-16ms between Prop_Chk response and Prop_Txt command
      this.logMessage(`* download() - waiting 15ms before sending Prop_Txt (matching PNut v51 timing)`);
      await waitMSec(15); // Use 15ms (middle of 12-16ms range observed)

      // Continue with download...
      if (this.usbConnected && uint8Bytes.length > 0) {
        // * Setup for download
        // NOTE: Base64 encoding in typescript works by taking 3 bytes of data and encoding it as 4 printable
        //  characters.If the total number of bytes is not a multiple of 3, the output is padded with one or
        //  two = characters to make the length a multiple of 4.
        const dataBase64: string = Buffer.from(uint8Bytes).toString('base64');
        // Break this up into lines with > sync chars starting each
        const LINE_LENGTH: number = 512;
        // silicon doc says: It's a good idea to start each Base64 data line with a ">" character, to keep the baud rate tightly calibrated.
        const lineCount: number = Math.ceil(dataBase64.length / LINE_LENGTH); // Corrected lineCount calculation
        const lastLineLength: number = dataBase64.length % LINE_LENGTH || LINE_LENGTH;
        // log what we are sending (or first part of it)
        this.dumpBytes(uint8Bytes, 0, 99, 'download-source');
        const dumpBytes = dataBase64.length < 100 ? dataBase64 : `${dataBase64.substring(0, 99)}...`;
        this.logMessage(`* download() SENDING [${dumpBytes}](${dataBase64.length})`);

        // * Now do the download
        // Log which command format we're using
        this.logMessage(`* download() - Using command: > ${requestStartDownload} (${needsP2ChecksumVerify ? 'with response expected' : 'silent mode'})`);
        // Use space terminator as observed in PNut v51, not CR
        await this.write(`> ${requestStartDownload} `);  // > triggers P2 autobaud
        for (let index = 0; index < lineCount; index++) {
          const lineLength = index == lineCount - 1 ? lastLineLength : LINE_LENGTH;
          const singleLine = dataBase64.substring(index * LINE_LENGTH, index * LINE_LENGTH + lineLength);
          await this.write('>' + singleLine);
        }
        // Send terminator:
        // '~' = Execute immediately (silent, no response)
        // '?' = Validate checksum and respond ('.' = valid, '!' = invalid)
        const terminator = needsP2ChecksumVerify ? '?' : '~';
        this.logMessage(`* download() - Sending terminator: '${terminator}' (${needsP2ChecksumVerify ? 'checksum validation mode' : 'immediate execution'})`);
        await this.write(terminator);  // Terminator only, no > or CR needed

        if (needsP2ChecksumVerify) {
          // After sending '?' terminator, P2 WILL respond with:
          // '.' = checksum valid, program started
          // '!' = checksum invalid
          this.logMessage(`* Waiting for P2 checksum verification response (. or !)...`);

          // Wait for the actual response character
          // P2 will ALWAYS respond, so we wait for the character with a safety timeout
          const startTime = Date.now();
          const timeout = 1000; // 1 second safety timeout - should NEVER be hit unless protocol is out of sync

          // Clear buffer before waiting for response
          this._p2DetectionBuffer = '';

          // Set flag to consume checksum responses (don't forward to mainWindow)
          this._expectingChecksumResponse = true;

          // Wait for response character
          while (true) {
            // Check for response characters
            if (this._p2DetectionBuffer.includes('.') || this._p2DetectionBuffer.includes('!')) {
              const responseTime = Date.now() - startTime;

              if (this._p2DetectionBuffer.includes('.')) {
                this._downloadChecksumGood = true;
                this._checksumVerified = true;
                this.logMessage(`* P2 checksum verification: SUCCESS - '.' received after ${responseTime}ms`);
                this.logMessage(`* Download completed successfully with verified checksum`);
              } else if (this._p2DetectionBuffer.includes('!')) {
                this._downloadChecksumGood = false;
                this._checksumVerified = true;
                this.logMessage(`* P2 checksum verification: FAILED - '!' received after ${responseTime}ms`);
                this.logMessage(`* Download failed - checksum invalid, binary may be corrupted`);
              }

              // Clear flag after processing checksum response
              this._expectingChecksumResponse = false;
              break;
            }

            // Safety timeout check - this should NEVER happen
            if (Date.now() - startTime > timeout) {
              this._checksumVerified = false;
              this.logMessage(`* CRITICAL ERROR: P2 checksum response timeout after ${timeout}ms`);
              this.logMessage(`* Buffer contents: '${this._p2DetectionBuffer}'`);
              this.logMessage(`* Protocol out of sync - P2 ALWAYS responds to '?' with '.' or '!'`);
              this.logMessage(`* Something is seriously wrong with the serial communication`);

              // Clear flag on timeout too
              this._expectingChecksumResponse = false;
              break;
            }

            // Small yield to let data arrive
            await waitMSec(1);
          }

          this._downloadResponse = this._downloadChecksumGood ? '.' : '!';
        }
      }
    } catch (error) {
      this.logMessage(`* download() ERROR: ${JSON.stringify(error, null, 2)}`);
    } finally {
      // ALWAYS clear download flag when done
      this._isDownloading = false;
      this.logMessage(`* download() - Download complete, isolation mode disabled`);
    }
  }

  public async write(value: string | Buffer): Promise<void> {
    //this.logMessage(`--> Tx ...`);
    return new Promise((resolve, reject) => {
      if (this.usbConnected) {
        this._serialPort.write(value, async (err) => {
          if (err) {
            reject(err);
          } else {
            const logValue = Buffer.isBuffer(value) ? `<Buffer ${value.length} bytes>` : value.split(/\r?\n/).filter(Boolean)[0];
            this.logMessage(`--> Tx [${logValue}]`);
            // Ensure data is fully transmitted before returning
            try {
              await this.drain();
              resolve();
            } catch (drainErr) {
              reject(drainErr);
            }
          }
        });
      } else {
        reject(new Error('Serial port not connected'));
      }
    });
  }

  // ----------------------------------------------------------------------------
  //   PRIVATE Instance Methods
  // ----------------------------------------------------------------------------
  //
  private handleSerialError(errMessage: string) {
    this.logMessage(`* handleSerialError() Error: ${errMessage}`);
    this._latestError = errMessage;
  }

  private async handleSerialOpen() {
    this.logConsoleMessage(`[USB] handleSerialOpen() - port opened`);

    // WORKAROUND for macOS high baud rates: If we opened at a standard rate,
    // now update to the desired rate
    const currentBaud = this._serialPort.baudRate;
    if (currentBaud !== UsbSerial.desiredCommsBaudRate) {
      this.logConsoleMessage(`[USB] macOS workaround: Updating from ${currentBaud} to ${UsbSerial.desiredCommsBaudRate}`);
      try {
        await this.changeBaudRate(UsbSerial.desiredCommsBaudRate);
      } catch (updateErr: any) {
        this.logConsoleMessage(`[USB] Failed to update to desired baud rate: ${updateErr.message}`);
        // Continue anyway - we're at least connected
      }
    }

    // DEFENSIVE: Flush any stale data from buffers before reset
    // This prevents old data from previous session being picked up
    try {
      await new Promise<void>((resolve, reject) => {
        this._serialPort.flush((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.logConsoleMessage(`[USB] handleSerialOpen() - RX/TX buffers flushed before reset`);
    } catch (flushErr: any) {
      this.logConsoleMessage(`[USB] handleSerialOpen() - Flush warning (non-fatal): ${flushErr.message}`);
    }

    // Conditional reset based on user preference
    // Only reset if preference is enabled (default: true for traditional mode)
    if (this.context.runEnvironment.resetOnConnection) {
      this.logConsoleMessage(`[USB] Reset on connection enabled - performing DTR/RTS reset`);
      // Use RTS instead of DTR if RTS override is enabled
      if (this.context.runEnvironment.rtsOverride) {
        await this.toggleRTS();
      } else {
        await this.toggleDTR();
      }
      this.logConsoleMessage(`[USB] Reset pulse completed`);
    } else {
      this.logConsoleMessage(`[USB] Reset on connection disabled - passive monitoring mode`);
    }
  }

  // Check raw data for P2 version response (no parser needed!)
  // Sets _p2DeviceId when Prop_Ver response detected
  // Data is always emitted regardless - suppression happens downstream if needed
  private checkForP2Response(data: Buffer): void {
    // Convert to string for P2 detection only
    const text = data.toString('utf8', 0, data.length);
    this.logConsoleMessage(`[P2-CHECK] Received ${data.length} bytes, _expectingP2Response=${this._expectingP2Response}`);
    this.logConsoleMessage(`[P2-CHECK] Text: '${text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`);

    this._p2DetectionBuffer += text;
    this.logConsoleMessage(`[P2-CHECK] Buffer now: '${this._p2DetectionBuffer.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`);

    // Look for complete lines
    const lines = this._p2DetectionBuffer.split(/\r?\n/);
    this.logConsoleMessage(`[P2-CHECK] Split into ${lines.length} lines`);

    // Keep incomplete line in buffer
    this._p2DetectionBuffer = lines.pop() || '';
    this.logConsoleMessage(`[P2-CHECK] Incomplete line kept in buffer: '${this._p2DetectionBuffer}'`);

    // Check for checksum verification responses (. or !) first
    // These should be single-character responses, not just any text containing these characters
    if (this._expectingChecksumResponse) {
      const trimmedText = text.trim();
      if (trimmedText === '.' || trimmedText === '!') {
        this.logMessage(`  -- Checksum response detected: '${trimmedText}'`);
      }
    }

    // Process complete lines for Prop_Ver responses
    for (const line of lines) {
      this.logConsoleMessage(`[P2-CHECK] Processing line: '${line}'`);
      if (line.startsWith('Prop_Ver ')) {
        this.logConsoleMessage(`  -- P2 DETECTED [${line}]`);
        // Extract version code after "Prop_Ver " - could be 1 or 2 chars (e.g., "A" or "Au")
        const versionCode = line.substring(9).trim();
        // Use first character for version identification
        const idLetter = versionCode.charAt(0);
        this._p2DeviceId = this.descriptionForVerLetter(idLetter);
        this._p2loadLimit = this.limitForVerLetter(idLetter);
        this.logConsoleMessage(`* FOUND Prop: [${this._p2DeviceId}] limit=${this._p2loadLimit} (version: ${versionCode})`);
        this.logConsoleMessage(`[P2-CHECK] Set _p2DeviceId to: '${this._p2DeviceId}'`);

        // Clear buffer after successful detection
        this._p2DetectionBuffer = '';
        this.logConsoleMessage(`[P2-CHECK] Buffer cleared after detection`);
        break;
      }
    }

    // Prevent buffer from growing too large
    if (this._p2DetectionBuffer.length > 1000) {
      this._p2DetectionBuffer = this._p2DetectionBuffer.slice(-100);
    }
  }

  public async setDTR(value: boolean): Promise<void> {
    // Set the DTR line state
    this.logConsoleMessage(`[USB] PUBLIC setDTR(${value})`);
    if (!this._serialPort || !this._serialPort.isOpen) {
      throw new Error('Serial port is not open');
    }
    await this.setDtr(value);
  }

  public async setRTS(value: boolean): Promise<void> {
    // Set the RTS line state
    this.logConsoleMessage(`[USB] PUBLIC setRTS(${value})`);
    if (!this._serialPort || !this._serialPort.isOpen) {
      throw new Error('Serial port is not open');
    }
    await this.setRts(value);
  }

  public async toggleDTR(): Promise<void> {
    // toggle the propPlug DTR line
    this.logConsoleMessage(`[USB] PUBLIC toggleDTR() ENTER - pulse sequence`);
    this.logMessage(`* toggleDTR() - port open (${this._serialPort.isOpen})`);
    await this.setDtr(true);
    await waitMSec(10);  // 10ms pulse is sufficient per spec
    await this.setDtr(false);
    this.logConsoleMessage(`[USB] PUBLIC toggleDTR() EXIT`);
  }

  public async toggleRTS(): Promise<void> {
    // toggle the propPlug RTS line
    this.logConsoleMessage(`[USB] PUBLIC toggleRTS() ENTER - pulse sequence`);
    this.logMessage(`* toggleRTS() - port open (${this._serialPort.isOpen})`);
    await this.setRts(true);
    await waitMSec(10);  // 10ms pulse is sufficient per spec
    await this.setRts(false);
    this.logConsoleMessage(`[USB] PUBLIC toggleRTS() EXIT`);
  }

  private startReadListener() {
    // P2 detection now handled in checkForP2Response
    // No separate listener needed - performance improvement!
  }

  private stopReadListener() {
    // P2 detection now handled in checkForP2Response  
    // No separate listener needed - performance improvement!
  }

  private async requestP2IDString(): Promise<void> {
    // request P2 ID-String
    const requestPropType: string = 'Prop_Chk';
    this.logMessage(`* requestP2IDString() - port open (${this._serialPort.isOpen})`);
    await waitMSec(100);  // Brief delay for stabilization
    
    // Use RTS instead of DTR if RTS override is enabled
    if (this.context.runEnvironment.rtsOverride) {
      await this.setRts(true);
      await waitMSec(10);  // 10ms pulse per spec
      await this.setRts(false);
    } else {
      await this.setDtr(true);
      await waitMSec(10);  // 10ms pulse per spec
      await this.setDtr(false);
    }
    //this.logMessage(`  -- plug reset!`);
    // NO wait yields a 1.5 mSec delay on my mac Studio
    // NOTE: if nothing sent, and Edge Module default switch settings, the prop will boot in 142 mSec
    await waitMSec(15);
    await this.write(`> ${requestPropType} 0 0 0 0\r`);  // > triggers P2 autobaud with zeros
    // drain() now called inside write() for guaranteed delivery
    /*return new Promise((resolve, reject) => {
      //this.logMessage(`* requestP2IDString() - EXIT`);
      resolve();
    });*/
  }

  private async requestPropellerVersion(): Promise<boolean> {
    const requestPropType: string = 'Prop_Chk';
    const didCheck = this.checkedForP2 == false;
    if (this.checkedForP2 == false) {
      this.logMessage(`* requestPropellerVersion() - port open (${this._serialPort.isOpen})`);
      this.checkedForP2 = true;
      try {
        await this.waitForPortOpen();
        // continue with ID effort...
        await waitMSec(250);
        
        // Use RTS instead of DTR if RTS override is enabled
        if (this.context.runEnvironment.rtsOverride) {
          await this.setRts(true);
          await waitMSec(10);
          await this.setRts(false);
        } else {
          await this.setDtr(true);
          await waitMSec(10);
          await this.setDtr(false);
        }
        // Fm Silicon Doc:
        //   Unless preempted by a program in a SPI memory chip with a pull-up resistor on P60 (SPI_CK), the
        //     serial loader becomes active within 15ms of reset being released.
        //
        //   If nothing sent, and Edge Module default switch settings, the prop will boot in 142 mSec
        //
        // NO wait yields a 102 mSec delay on my mac Studio
        await waitMSec(15); // at least a  15 mSec delay, yields a 230mSec delay when 2nd wait above is 100 mSec
        await this.write(`> ${requestPropType}\r`);  // > triggers P2 autobaud
        // drain() now called inside write() for guaranteed delivery
      } catch (error) {
        this.logMessage(`* requestPropellerVersion() ERROR: ${JSON.stringify(error, null, 2)}`);
      }
    }
    return didCheck;
  }

  public async waitForPortOpen(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 2000 / 30; // 2 seconds / 30 ms

      const intervalId = setInterval(async () => {
        if (this._serialPort.isOpen) {
          clearInterval(intervalId);
          resolve(true);
        } else if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          reject(new Error('Port did not open within 2 seconds'));
        } else {
          attempts++;
        }
      }, 30); // Check every 30ms
    });
  }

  /*
  private async downloadNew(uint8Bytes: Uint8Array) {
    const byteCount: number = uint8Bytes.length;
    const base64String: string = Buffer.from(uint8Bytes).toString('base64');
    this.dumpStringHex(base64String, 'builtin64');
  }

  private dumpBufferHex(uint6Buffer: Uint8Array, callerId: string) {
    //
    const byteCount: number = uint6Buffer.length;
    /// dump hex and ascii data
    let displayOffset: number = 0;
    let currOffset = 0;
    this.logMessage(`-- -------- ${callerId} ------------------ --`);
    while (displayOffset < byteCount) {
      let hexPart = '';
      let asciiPart = '';
      const remainingBytes = byteCount - displayOffset;
      const lineLength = remainingBytes > 16 ? 16 : remainingBytes;
      for (let i = 0; i < lineLength; i++) {
        const byteValue = uint6Buffer[currOffset + i];
        hexPart += byteValue.toString(16).padStart(2, '0').toUpperCase() + ' ';
        asciiPart += byteValue >= 0x20 && byteValue <= 0x7e ? String.fromCharCode(byteValue) : '.';
      }
      const offsetPart = displayOffset.toString(16).padStart(5, '0').toUpperCase();

      this.logMessage(`${offsetPart}- ${hexPart.padEnd(48, ' ')}  '${asciiPart}'`);
      currOffset += lineLength;
      displayOffset += lineLength;
    }
    this.logMessage(`-- -------- -------- ------------------ --`);
  }

  private dumpStringHex(uint6Buffer: string, callerId: string) {
    //
    const byteCount: number = uint6Buffer.length;
    let displayOffset: number = 0;
    let currOffset = 0;
    this.logMessage(`-- -------- ${callerId} ------------------ --`);
    while (displayOffset < byteCount) {
      let hexPart = '';
      let asciiPart = '';
      const remainingBytes = byteCount - displayOffset;
      const lineLength = remainingBytes > 16 ? 16 : remainingBytes;
      for (let i = 0; i < lineLength; i++) {
        const byteValue = uint6Buffer.charCodeAt(currOffset + i);
        hexPart += byteValue.toString(16).padStart(2, '0').toUpperCase() + ' ';
        asciiPart += byteValue >= 0x20 && byteValue <= 0x7e ? String.fromCharCode(byteValue) : '.';
      }
      const offsetPart = displayOffset.toString(16).padStart(5, '0').toUpperCase();

      this.logMessage(`${offsetPart}- ${hexPart.padEnd(48, ' ')}  '${asciiPart}'`);
      currOffset += lineLength;
      displayOffset += lineLength;
    }
    this.logMessage(`-- -------- -------- ------------------ --`);
  }
  */

  public async drain(): Promise<void> {
    this.logMessage(`--> Tx drain`);
    return new Promise((resolve, reject) => {
      this._serialPort.drain((err) => {
        if (err) reject(err);
        else {
          this.logMessage(`--> Tx {empty}`);
          resolve();
        }
      });
    });
  }

  private async setDtr(value: boolean): Promise<void> {
    this.logConsoleMessage(`[USB] INTERNAL setDtr(${value})`);
    return new Promise((resolve, reject) => {
      this._serialPort.set({ dtr: value }, (err) => {
        if (err) {
          this.logMessage(`DTR: ERROR:${err.name} - ${err.message}`);
          reject(err);
        } else {
          this._dtrValue = value;
          this.logMessage(`DTR: ${value}`);
          // Force a drain to ensure the command is sent
          this._serialPort.drain((drainErr) => {
            if (drainErr) {
              this.logConsoleMessage(`[USB] DTR drain error: ${drainErr}`);
            }
            resolve();
          });
        }
      });
    });
  }

  private async setRts(value: boolean): Promise<void> {
    this.logConsoleMessage(`[USB] INTERNAL setRts(${value})`);
    return new Promise((resolve, reject) => {
      this._serialPort.set({ rts: value }, (err) => {
        if (err) {
          this.logMessage(`RTS: ERROR:${err.name} - ${err.message}`);
          reject(err);
        } else {
          this._rtsValue = value;
          this.logMessage(`RTS: ${value}`);
          resolve();
        }
      });
    });
  }

  private limitForVerLetter(idLetter: string): number {
    let desiredvalue: number = 0;
    if (idLetter === 'A') {
      desiredvalue = 0x100000;
    } else if (idLetter === 'B') {
      desiredvalue = 0x040000;
    } else if (idLetter === 'C') {
      desiredvalue = 0x008000;
    } else if (idLetter === 'D') {
      desiredvalue = 0x020000;
    } else if (idLetter === 'E') {
      desiredvalue = 0x080000;
    } else if (idLetter === 'F') {
      desiredvalue = 0x100000;
    } else if (idLetter === 'G') {
      desiredvalue = 0x100000;
    }
    return desiredvalue;
  }

  private descriptionForVerLetter(idLetter: string): string {
    let desiredInterp: string = '?unknown-propversion?';
    // Note: Spec indicates "Au" for revision A silicon (production)
    // We use the first letter for version identification
    if (idLetter === 'A') {
      desiredInterp = 'P2X8C4M64P Rev A - 8 cogs, 512KB hub, 64 smart pins (production silicon)';
    } else if (idLetter === 'B') {
      desiredInterp = 'FPGA - 4 cogs, 256KB hub, 12 smart pins 63..60/7..0, 80MHz';
    } else if (idLetter === 'C') {
      desiredInterp = 'unsupported';
    } else if (idLetter === 'D') {
      desiredInterp = 'unsupported';
    } else if (idLetter === 'E') {
      desiredInterp = 'FPGA - 4 cogs, 512KB hub, 18 smart pins 63..62/15..0, 80MHz';
    } else if (idLetter === 'F') {
      desiredInterp = 'unsupported';
    } else if (idLetter === 'G') {
      desiredInterp = 'P2X8C4M64P Rev B/C - 8 cogs, 512KB hub, 64 smart pins';
    }
    return desiredInterp;
  }

  private dumpBytes(bytes: Uint8Array, startOffset: number, maxBytes: number, dumpId: string) {
    /// dump hex and ascii data
    let displayOffset: number = 0;
    let currOffset = startOffset;
    const byteCount = bytes.length > maxBytes ? maxBytes : bytes.length;
    this.logMessage(`-- -------- ${dumpId} ------------------ --`);
    while (displayOffset < byteCount) {
      let hexPart = '';
      let asciiPart = '';
      const remainingBytes = byteCount - displayOffset;
      const lineLength = remainingBytes > 16 ? 16 : remainingBytes;
      for (let i = 0; i < lineLength; i++) {
        const byteValue = bytes[currOffset + i];
        hexPart += byteValue.toString(16).padStart(2, '0').toUpperCase() + ' ';
        asciiPart += byteValue >= 0x20 && byteValue <= 0x7e ? String.fromCharCode(byteValue) : '.';
      }
      const offsetPart = displayOffset.toString(16).padStart(5, '0').toUpperCase();

      this.logMessage(`${offsetPart}- ${hexPart.padEnd(48, ' ')}  '${asciiPart}'`);
      currOffset += lineLength;
      displayOffset += lineLength;
    }
    this.logMessage(`-- -------- ${'-'.repeat(dumpId.length)} ------------------ --`);
    this.logMessage(`-- ${bytes.length} Bytes --`);
  }

  public logMessage(message: string): void {
    if (this.context.runEnvironment.loggingEnabled) {
      // USB serial status messages are system diagnostics, should go to console
      this.context.logger.forceLogMessage(message);
    }
  }
}
