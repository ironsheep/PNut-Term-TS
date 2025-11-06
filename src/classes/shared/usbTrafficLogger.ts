/** @format */

// src/classes/shared/usbTrafficLogger.ts

import * as fs from 'fs';
import * as path from 'path';

/**
 * USBTrafficLogger - Asynchronous USB packet hex dump logger
 *
 * Logs raw USB traffic to file for debugging/troubleshooting.
 * Uses async writes to avoid blocking reception.
 *
 * Output format matches original messageExtractor.ts logUSBTraffic():
 * [USB RECV 2025-10-06T22:30:45.123Z] Received 64 bytes
 * [USB RECV HEX/ASCII]:
 *   0000: $43 $6F $67 $30 $20 $20 ...  Cog0  ...
 */

// Console logging control
const ENABLE_CONSOLE_LOG: boolean = false;

export class USBTrafficLogger {
  private logStream: fs.WriteStream | null = null;
  private enabled: boolean = false;
  private bytesLogged: number = 0;
  private packetsLogged: number = 0;

  /**
   * Enable logging to specified file
   * @param logFilePath - Path to log file (will append if exists)
   */
  public enable(logFilePath: string): void {
    if (ENABLE_CONSOLE_LOG) console.log(`[USB LOGGER] Attempting to create log file: ${logFilePath}`);
    try {
      // Ensure directory exists
      const logDir = path.dirname(logFilePath);
      if (ENABLE_CONSOLE_LOG) console.log(`[USB LOGGER] Log directory: ${logDir}`);

      if (!fs.existsSync(logDir)) {
        if (ENABLE_CONSOLE_LOG) console.log(`[USB LOGGER] Directory doesn't exist, creating: ${logDir}`);
        fs.mkdirSync(logDir, { recursive: true });
      } else {
        if (ENABLE_CONSOLE_LOG) console.log(`[USB LOGGER] Directory exists: ${logDir}`);
      }

      // Create write stream (append mode)
      if (ENABLE_CONSOLE_LOG) console.log(`[USB LOGGER] Creating write stream...`);
      this.logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
      if (ENABLE_CONSOLE_LOG) console.log(`[USB LOGGER] Write stream created successfully`);

      // Write session header
      const header = `\n${'='.repeat(80)}\n` +
                    `USB Traffic Log Session Started: ${new Date().toISOString()}\n` +
                    `${'='.repeat(80)}\n`;
      this.logStream.write(header);

      this.enabled = true;
      if (ENABLE_CONSOLE_LOG) console.log(`[USB LOGGER] Logging enabled to: ${logFilePath}`);
    } catch (error) {
      console.error(`[USB LOGGER] Failed to enable logging:`, error);
      this.enabled = false;
    }
  }

  /**
   * Disable logging and close file
   */
  public disable(): void {
    if (this.logStream) {
      const footer = `\n${'='.repeat(80)}\n` +
                    `USB Traffic Log Session Ended: ${new Date().toISOString()}\n` +
                    `Packets Logged: ${this.packetsLogged}, Bytes Logged: ${this.bytesLogged}\n` +
                    `${'='.repeat(80)}\n\n`;
      this.logStream.write(footer);
      this.logStream.end();
      this.logStream = null;
    }
    this.enabled = false;
    if (ENABLE_CONSOLE_LOG) console.log(`[USB LOGGER] Logging disabled (${this.packetsLogged} packets, ${this.bytesLogged} bytes)`);
  }

  /**
   * Log USB packet (async, non-blocking)
   * @param data - Raw USB packet bytes
   * @param timestamp - When packet arrived (Date.now())
   */
  public log(data: Uint8Array | Buffer, timestamp: number = Date.now()): void {
    if (!this.enabled || !this.logStream) {
      if (ENABLE_CONSOLE_LOG && !this.enabled) {
        console.log(`[USB LOGGER] log() called but logging not enabled (${data.length} bytes dropped)`);
      } else if (ENABLE_CONSOLE_LOG && !this.logStream) {
        console.log(`[USB LOGGER] log() called but no file handle (${data.length} bytes dropped)`);
      }
      return;
    }

    // Convert to Uint8Array if Buffer
    const bytes = data instanceof Buffer ? new Uint8Array(data) : data;

    // Format hex dump asynchronously (non-blocking)
    setImmediate(() => {
      const hexDump = this.formatHexDump(bytes, timestamp, 'RECV');

      // Write to file (async I/O)
      if (this.logStream) {
        this.logStream.write(hexDump + '\n');
        this.bytesLogged += bytes.length;
        this.packetsLogged++;
      }
    });
  }

  /**
   * Log transmitted USB data (async, non-blocking)
   * @param data - Raw data being transmitted to P2
   * @param timestamp - When data was sent (Date.now())
   */
  public logTx(data: string | Uint8Array | Buffer, timestamp: number = Date.now()): void {
    if (!this.enabled || !this.logStream) {
      return;
    }

    // Convert to Uint8Array
    let bytes: Uint8Array;
    if (typeof data === 'string') {
      // CRITICAL: Use latin1 encoding to preserve binary bytes (1:1 byte mapping)
      // UTF-8 encoding corrupts binary data (e.g., 0xFF becomes 0xC3 0xBF)
      bytes = new Uint8Array(Buffer.from(data, 'latin1'));
    } else if (data instanceof Buffer) {
      bytes = new Uint8Array(data);
    } else {
      bytes = data;
    }

    // Format hex dump asynchronously (non-blocking)
    setImmediate(() => {
      const hexDump = this.formatHexDump(bytes, timestamp, 'SEND');

      // Write to file (async I/O)
      if (this.logStream) {
        this.logStream.write(hexDump + '\n');
        this.bytesLogged += bytes.length;
        this.packetsLogged++;
      }
    });
  }

  /**
   * Format packet as hex dump
   * Matches original messageExtractor.ts format
   * @param direction - 'RECV' for received data, 'SEND' for transmitted data
   */
  private formatHexDump(data: Uint8Array, timestamp: number, direction: 'RECV' | 'SEND'): string {
    const lines: string[] = [];

    // Header with timestamp
    const timestampStr = new Date(timestamp).toISOString();
    const verb = direction === 'RECV' ? 'Received' : 'Sent';
    lines.push(`[USB ${direction} ${timestampStr}] ${verb} ${data.length} bytes`);
    lines.push(`[USB ${direction} HEX/ASCII]:`);

    // Hex dump (16 bytes per line)
    const bytesPerLine = 16;
    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes = data.slice(offset, Math.min(offset + bytesPerLine, data.length));

      // Build hex part
      let hexPart = '';
      for (let i = 0; i < bytesPerLine; i++) {
        if (i < lineBytes.length) {
          hexPart += `$${lineBytes[i].toString(16).toUpperCase().padStart(2, '0')} `;
        } else {
          hexPart += '    ';
        }
        if (i === 7) hexPart += ' '; // Extra space in middle
      }

      // Build ASCII part
      let asciiPart = '';
      for (let i = 0; i < lineBytes.length; i++) {
        const byte = lineBytes[i] & 0x7f; // Mask with 0x7F to clean up binary data display
        asciiPart += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
      }

      const offsetHex = offset.toString(16).padStart(4, '0');
      lines.push(`  ${offsetHex}: ${hexPart} ${asciiPart}`);
    }

    return lines.join('\n');
  }

  /**
   * Get logging statistics
   */
  public getStats() {
    return {
      enabled: this.enabled,
      packetsLogged: this.packetsLogged,
      bytesLogged: this.bytesLogged
    };
  }

  /**
   * Check if logging is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
}
