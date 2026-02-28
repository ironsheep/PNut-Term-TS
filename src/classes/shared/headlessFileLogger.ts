/**
 * HeadlessFileLogger - File-only logging for headless mode
 *
 * This is a simplified logger that writes directly to a file without
 * any GUI components. Used by HeadlessController when running without
 * Electron windows (for CI/AI agent automation).
 *
 * Pattern adapted from LoggerWindow's file I/O, but without:
 * - BrowserWindow creation
 * - IPC communication
 * - Render queue / DOM updates
 * - UI batching
 */

import * as fs from 'fs';
import * as path from 'path';
import { Context } from '../../utils/context';
import { ensureDirExists, getFormattedDateTime, getFormattedDateTimeISO } from '../../utils/files';

export class HeadlessFileLogger {
  private context: Context;
  private logFilePath: string = '';
  private logFile: fs.WriteStream | null = null;
  private writeBuffer: string[] = [];
  private writeTimer: NodeJS.Timeout | null = null;
  private logFileReady: boolean = false;
  private pendingLogMessages: string[] = [];

  // Buffering configuration
  private readonly WRITE_INTERVAL_MS = 100; // Flush every 100ms
  private readonly MAX_BUFFER_SIZE = 4096; // Force flush at 4KB

  // Callback for end-marker detection
  private onEndMarkerDetected: (() => void) | null = null;
  private endMarkers: string[] = [];
  private markerSearchBuffer: string = ''; // Rolling buffer for cross-chunk marker detection
  private maxMarkerLength: number = 0;

  constructor(context: Context) {
    this.context = context;

    // Set up end-markers if configured
    if (context.runEnvironment.headlessEndMarker) {
      this.endMarkers = context.runEnvironment.headlessEndMarker;
      this.maxMarkerLength = Math.max(...this.endMarkers.map((m) => m.length));
    }
  }

  /**
   * Initialize the log file
   */
  public initialize(): void {
    this.initializeLogFile();
  }

  /**
   * Set callback for when end-marker is detected in output
   */
  public setEndMarkerCallback(callback: () => void): void {
    this.onEndMarkerDetected = callback;
  }

  /**
   * Initialize log file for capturing debug output
   */
  private initializeLogFile(): void {
    try {
      // Use context-based log directory with user preferences
      const logsDir = this.context.getLogDirectory();
      console.log('[HEADLESS] Creating logs directory at:', logsDir);
      ensureDirExists(logsDir);

      // Generate timestamped filename
      const timestamp = getFormattedDateTime();
      const basename = 'headless';
      this.logFilePath = path.join(logsDir, `${basename}_${timestamp}.log`);
      console.log('[HEADLESS] Log file path:', this.logFilePath);

      // Create write stream
      this.logFile = fs.createWriteStream(this.logFilePath, { flags: 'a' });

      // Wait for the stream to be ready before writing
      this.logFile.once('open', (fd) => {
        // Write header
        this.logFile!.write(`=== Headless Mode Session Started at ${getFormattedDateTimeISO()} ===\n`);
        this.logFile!.write(`Mode: Headless (no GUI)\n`);
        if (this.endMarkers.length > 0) {
          this.logFile!.write(`End Markers: ${this.endMarkers.map((m) => `"${m}"`).join(', ')}\n`);
        }
        if (this.context.runEnvironment.headlessTimeout) {
          this.logFile!.write(`Timeout: ${this.context.runEnvironment.headlessTimeout} seconds\n`);
        }
        this.logFile!.write(`=====================================\n\n`, (err) => {
          if (err) {
            console.error('[HEADLESS] Failed to write header:', err);
          } else {
            // Sync to disk
            try {
              fs.fsyncSync(fd);
            } catch (syncErr) {
              console.error('[HEADLESS] Failed to sync log file:', syncErr);
            }

            // Mark log file as ready and flush any pending messages
            this.logFileReady = true;
            this.flushPendingMessages();
          }
        });
      });

      // Handle stream errors
      this.logFile.once('error', (err) => {
        console.error('[HEADLESS] Write stream error:', err);
      });

      console.log('[HEADLESS] Log file initialized:', this.logFilePath);
    } catch (error) {
      console.error('[HEADLESS] Failed to initialize log file:', error);
    }
  }

  /**
   * Get the path to the current log file
   */
  public getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Log a message from serial data
   */
  public logMessage(message: string): void {
    this.writeToLog(message);

    // Check for end-markers using rolling buffer to handle markers split across chunks
    // (serial data arrives in arbitrary-sized chunks that can split marker strings)
    if (this.endMarkers.length > 0 && this.onEndMarkerDetected) {
      this.markerSearchBuffer += message;

      for (const marker of this.endMarkers) {
        if (this.markerSearchBuffer.includes(marker)) {
          console.log(`[HEADLESS] End marker "${marker}" detected!`);
          this.logSystem(`End marker "${marker}" detected - initiating shutdown`);
          this.onEndMarkerDetected();
          return;
        }
      }

      // Keep only enough tail to detect markers split across the next chunk boundary
      if (this.markerSearchBuffer.length > this.maxMarkerLength * 2) {
        this.markerSearchBuffer = this.markerSearchBuffer.slice(-(this.maxMarkerLength - 1));
      }
    }
  }

  /**
   * Log a system message (not from serial data)
   */
  public logSystem(message: string): void {
    this.writeToLog(`[SYSTEM] ${message}`);
  }

  /**
   * Log a warning message
   */
  public logWarning(message: string): void {
    this.writeToLog(`[WARNING] ${message}`);
    // Also output to console for visibility
    console.warn(`[HEADLESS WARNING] ${message}`);
  }

  /**
   * Log an error message
   */
  public logError(message: string): void {
    this.writeToLog(`[ERROR] ${message}`);
    console.error(`[HEADLESS ERROR] ${message}`);
  }

  /**
   * Log a rejected window command (debug window creation attempt in headless mode)
   */
  public logRejectedWindow(windowType: string, windowName: string): void {
    const message = `Window creation rejected (headless mode): ${windowType} "${windowName}"`;
    this.logWarning(message);
  }

  /**
   * Log a rejected debugger packet (416-byte debugger packet in headless mode)
   */
  public logRejectedDebugger(cogId: number): void {
    const message = `Debugger packet rejected (headless mode): COG ${cogId}`;
    this.logWarning(message);
  }

  /**
   * Write message to log file (buffered for performance)
   */
  private writeToLog(message: string): void {
    const timestamp = getFormattedDateTimeISO();
    // Strip trailing CR/LF from message before logging
    const cleanMessage = message.replace(/[\r\n]+$/, '');
    const logEntry = `[${timestamp}] ${cleanMessage}\n`;

    if (this.logFileReady && this.logFile) {
      // Log file is ready - write normally
      this.writeBuffer.push(logEntry);

      // Schedule write if not already scheduled
      if (!this.writeTimer) {
        this.writeTimer = setTimeout(() => this.flushWriteBuffer(), this.WRITE_INTERVAL_MS);
      }

      // Force flush if buffer is getting large
      if (this.writeBuffer.join('').length > this.MAX_BUFFER_SIZE) {
        this.flushWriteBuffer();
      }
    } else {
      // Log file not ready yet - buffer the message for later
      this.pendingLogMessages.push(logEntry);

      // Limit buffer size to prevent memory issues
      if (this.pendingLogMessages.length > 1000) {
        console.warn('[HEADLESS] Pending message buffer full, dropping oldest messages');
        this.pendingLogMessages.splice(0, 100);
      }
    }
  }

  /**
   * Flush pending messages that were buffered during log file initialization
   */
  private flushPendingMessages(): void {
    if (this.pendingLogMessages.length > 0) {
      console.log(`[HEADLESS] Flushing ${this.pendingLogMessages.length} pending messages to log file`);

      // Add all pending messages to the write buffer
      this.writeBuffer.push(...this.pendingLogMessages);

      // Clear the pending buffer
      this.pendingLogMessages = [];

      // Force immediate flush
      this.flushWriteBuffer();
    }
  }

  /**
   * Flush write buffer to disk
   */
  private flushWriteBuffer(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    if (this.writeBuffer.length > 0 && this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      const data = this.writeBuffer.join('');
      this.writeBuffer = [];

      // Async write with error handling
      this.logFile.write(data, (err) => {
        if (err) {
          console.error('[HEADLESS] Failed to write to log file:', err);
        }
      });
    }
  }

  /**
   * Close the log file gracefully
   */
  public close(): void {
    // Flush any remaining data
    this.flushWriteBuffer();

    if (this.logFile) {
      // Write session footer
      this.logFile.write(`\n=== Headless Mode Session Ended at ${getFormattedDateTimeISO()} ===\n`);

      // Close the stream
      this.logFile.end(() => {
        console.log('[HEADLESS] Log file closed:', this.logFilePath);
      });

      this.logFile = null;
      this.logFileReady = false;
    }
  }
}
