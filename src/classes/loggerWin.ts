/** @format */

// src/classes/loggerWin.ts

import { BrowserWindow, ipcMain } from 'electron';
import { Context } from '../utils/context';
import { DebugWindowBase } from './debugWindowBase';
import * as fs from 'fs';
import * as path from 'path';
import { ensureDirExists, getFormattedDateTime, getFormattedDateTimeISO } from '../utils/files';
import { WindowPlacer, PlacementSlot } from '../utils/windowPlacer';
import { SharedMessageType, ExtractedMessage } from './shared/sharedMessagePool';
import { isEndSessionSentinel } from './shared/endSessionSentinel';
import { PerformanceMonitor } from './shared/performanceMonitor';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false; // Temporarily enabled for debugging renderer initialization

export interface DebugLoggerTheme {
  name: string;
  foregroundColor: string;
  backgroundColor: string;
}

/**
 * Performance warning entry
 */
interface PerformanceWarning {
  timestamp: number;
  level: 'WARN' | 'CRITICAL' | 'ERROR' | 'RECOVERY';
  message: string;
  details?: any;
}

/**
 * Debug Logger Window - Singleton window that captures ALL debug output
 * This is the "Tall Thin Man" - a heads-up console positioned at bottom-right
 *
 * RESPONSIBILITIES:
 * - Display formatted debugger messages (80-byte packets, DB packets)
 * - Log all messages to timestamped files for analysis
 * - Provide defensive display of misclassified binary data
 * - Handle high-throughput data with batched rendering (2Mbps capable)
 *
 * NOT RESPONSIBLE FOR:
 * - Message classification or routing (MessageExtractor handles this)
 * - Serial data parsing or protocol interpretation
 * - Window management beyond its own singleton instance
 * - Terminal output display (MainWindow handles this)
 */
export class LoggerWindow extends DebugWindowBase {
  /**
   * Get the canvas ID for this window (required by base class)
   */
  protected getCanvasId(): string {
    return 'debugLoggerCanvas';
  }

  private static instance: LoggerWindow | null = null;
  private logFile: fs.WriteStream | null = null;
  private logFilePath: string | null = null;
  private cogsAreShowing: boolean = false;
  private theme: DebugLoggerTheme;
  private maxLines: number = 10000;
  private lineBuffer: string[] = [];

  // Performance optimizations for 2Mbps handling
  private renderQueue: Array<{ message: string; className?: string; timestamp: number }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL_MS = 16; // 60fps update rate
  private readonly BATCH_SIZE_LIMIT = 100; // Max messages per batch
  // Presentation shedding — invariant I3: the DISPLAY rate must not be coupled to the
  // ARRIVAL rate. Only the on-screen queue is bounded; writeToLog() is a separate call at
  // every call site, so the FILE still gets every line (invariant I5). When the display
  // falls behind we show the MOST RECENT lines and account for what was skipped, rather
  // than trying to draw a backlog that only grows.
  private static readonly MAX_DISPLAY_BACKLOG = 300; // ~3 batches; beyond this the eye is behind anyway
  private displaySheddedLines = 0;

  // Viewer lifetime, which is NOT the log's lifetime — the window can be closed and
  // reopened (Window > Show Log) while the file keeps receiving every line.
  private viewerOpen = true;
  private replayOnReady = false;
  private static readonly REPLAY_LINES = 1000; // the viewer trims to the user's scrollback setting
  // How many lines the viewer keeps scrollable. Default matches the documented
  // preference default in context.ts; the real value arrives via
  // updateScrollbackPreference() and is re-sent whenever a renderer becomes ready.
  private scrollbackLines: number = 1000;
  private statusBarTimer: NodeJS.Timeout | null = null;
  private static readonly STATUS_BAR_INTERVAL_MS = 250; // 4 Hz is plenty for three numbers
  /** Set by MainWindow so the Window menu label can follow the viewer's state. */
  public onViewerVisibilityChanged: ((visible: boolean) => void) | null = null;
  private writeBuffer: string[] = [];
  private writeTimer: NodeJS.Timeout | null = null;
  private readonly WRITE_INTERVAL_MS = 100; // Flush to disk every 100ms

  // High-resolution timestamp tracking
  private sessionStartTime: number = performance.now();
  private lastMessageTime: number = 0;
  private lastFullTimestamp: string = '';

  // Message buffering for race condition protection
  private pendingLogMessages: string[] = [];
  private logFileReady: boolean = false;
  private rendererReady: boolean = false; // Track when renderer DOM is ready for IPC

  // Line reassembly: accumulate partial chunks until CR/LF confirms a complete line
  private logLineAccumulator: string = '';
  private logLineFlushTimer: NodeJS.Timeout | null = null;
  private readonly LOG_LINE_FLUSH_TIMEOUT_MS = 50; // Flush partial lines after 50ms idle
  // Safety bound on an unterminated line. The idle timer cannot rescue a stream that never
  // pauses, so this is the only backstop against unbounded accumulation (see writeToLog).
  private static readonly MAX_UNTERMINATED_LINE_BYTES = 64 * 1024;

  // Performance warning tracking
  private performanceMonitor: PerformanceMonitor | null = null;
  private warningHistory: PerformanceWarning[] = [];
  private readonly MAX_WARNING_HISTORY = 100;
  private warningRateLimiter: Map<string, number> = new Map(); // key -> lastWarningTime
  private readonly WARNING_COOLDOWN_MS = 5000; // 5 second cooldown per warning type

  // Predefined themes
  private static readonly THEMES = {
    green: {
      name: 'green',
      foregroundColor: '#00FF00',
      backgroundColor: '#000000'
    },
    amber: {
      name: 'amber',
      foregroundColor: '#FFBF00',
      backgroundColor: '#000000'
    }
  };

  private constructor(context: Context) {
    if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] 🏗️  Constructor called, creating singleton instance');

    // Call parent with a fixed name since this is a singleton
    super(context, 'DebugLogger', 'logger');

    // Set theme from preferences BEFORE creating window (so HTML gets correct colors)
    if (context.preferences?.terminal?.colorTheme) {
      const themeValue = context.preferences.terminal.colorTheme;
      if (themeValue.includes('amber')) {
        this.theme = LoggerWindow.THEMES.amber;
        if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Setting amber theme from preferences');
      } else {
        this.theme = LoggerWindow.THEMES.green;
        if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Setting green theme from preferences');
      }
    } else {
      // Default to green theme
      this.theme = LoggerWindow.THEMES.green;
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] No theme preference, defaulting to green');
    }

    if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Creating debug window...');
    // Create the window but DON'T show it yet
    this.debugWindow = this.createDebugWindow();
    // Window will be shown in the 'ready-to-show' event handler
    if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Debug window created');

    // CRITICAL: Register with router IMMEDIATELY so we don't lose messages
    // The Debug Logger is special - it needs to capture ALL messages from the start
    if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] 📡 Registering with WindowRouter immediately...');
    this.logConsoleMessage('[DEBUG LOGGER] Registering with WindowRouter immediately...');
    try {
      this.registerWithRouter();
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] ✅ Successfully registered with WindowRouter (immediate)');
      this.logConsoleMessage('[DEBUG LOGGER] Successfully registered with WindowRouter (immediate)');
    } catch (error) {
      console.error('[DEBUG LOGGER] ❌ Failed to register immediately:', error);
      // Try again after a short delay
      setTimeout(() => {
        if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Retry registration after 100ms...');
        this.logConsoleMessage('[DEBUG LOGGER] Retry registration after 100ms...');
        try {
          this.registerWithRouter();
          if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] ✅ Successfully registered with WindowRouter (retry)');
          this.logConsoleMessage('[DEBUG LOGGER] Successfully registered with WindowRouter (retry)');
        } catch (err) {
          console.error('[DEBUG LOGGER] ❌ Failed to register on retry:', err);
        }
      }, 100);
    }

    // Initialize log file after window is created
    // This ensures MainWindow has time to set up event listeners
    setTimeout(() => {
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Initializing log file...');
      this.initializeLogFile();
    }, 100);

    // Mark as ready so messages aren't queued by base class
    if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Marking window as ready (isWindowReady=true) to avoid base class queuing');
    (this as any).isWindowReady = true;

    // Process any messages that might have been queued by base class
    if ((this as any).messageQueue && (this as any).messageQueue.length > 0) {
      const queue = (this as any).messageQueue;
      if (ENABLE_CONSOLE_LOG) console.log(`[DEBUG LOGGER] Processing ${queue.length} messages from base class queue`);
      (this as any).messageQueue = [];
      queue.forEach((msg: any) => this.processMessageImmediate(msg));
    } else {
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] No messages in base class queue');
    }

    if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Constructor complete, rendererReady=', this.rendererReady);
  }

  /**
   * Get window title (public getter for base class abstract requirement)
   */
  get windowTitle(): string {
    return 'Debug Logger';
  }

  /**
   * Get or create the singleton instance
   */
  public static getInstance(context: Context): LoggerWindow {
    if (!LoggerWindow.instance) {
      LoggerWindow.instance = new LoggerWindow(context);
    }
    return LoggerWindow.instance;
  }

  /**
   * Initialize log file for capturing debug output
   */
  private initializeLogFile(): void {
    try {
      // Use context-based log directory with user preferences
      const logsDir = this.context.getLogDirectory();
      this.logConsoleMessage('[DEBUG LOGGER] Creating logs directory at:', logsDir);
      ensureDirExists(logsDir);

      // Generate timestamped filename
      const timestamp = getFormattedDateTime();
      const basename = 'debug';
      this.logFilePath = path.join(logsDir, `${basename}_${timestamp}.log`); // Remove duplicate "_debug"
      this.logConsoleMessage('[DEBUG LOGGER] Log file path:', this.logFilePath);

      // Create write stream
      this.logFile = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      this.logConsoleMessage('[DEBUG LOGGER] Write stream created successfully');

      // Wait for the stream to be ready before writing
      this.logFile.once('open', (fd) => {
        this.logConsoleMessage('[DEBUG LOGGER] Write stream opened with fd:', fd);

        // Write header and force flush to ensure file is created
        this.logFile!.write(`=== Debug Logger Session Started at ${getFormattedDateTimeISO()} ===\n`);
        this.logFile!.write(`PNut-Term-TS: v${APP_VERSION}\n`); // record the exact app version for the log's regression/release-notes use
        this.logFile!.write(`Program: ${basename}\n`);
        this.logFile!.write(`=====================================\n\n`, (err) => {
          if (err) {
            console.error('[DEBUG LOGGER] Failed to write header:', err);
          } else {
            this.logConsoleMessage('[DEBUG LOGGER] Log file header written and flushed');

            // Now we can safely sync since fd is available
            try {
              fs.fsyncSync(fd);
              this.logConsoleMessage('[DEBUG LOGGER] Log file synced to disk');
            } catch (syncErr) {
              console.error('[DEBUG LOGGER] Failed to sync log file:', syncErr);
            }

            // CRITICAL FIX: Mark log file as ready and flush any pending messages
            this.logFileReady = true;
            this.flushPendingMessages();
          }
        });
      });

      // Handle stream errors
      this.logFile.once('error', (err) => {
        console.error('[DEBUG LOGGER] Write stream error:', err);
      });

      // Notify MainWindow that logging started
      this.notifyLoggingStatus(true);
      this.logConsoleMessage('[DEBUG LOGGER] Log file initialized successfully at:', this.logFilePath);

      // ENHANCEMENT: Console logging for audit trail visibility
      this.logConsoleMessage(`[DEBUG LOGGER] Started new log: ${this.logFilePath}`);
    } catch (error) {
      // Use base class logMessage to send to console, not Debug Logger window
      console.error('[DEBUG LOGGER] Failed to initialize log file:', error);
      super.logMessage(`Failed to initialize log file: ${error}`, 'DebugLogger');
      // Fall back to console logging only
      this.notifyLoggingStatus(false);
    }
  }

  /**
   * Notify MainWindow of logging status changes
   */
  private notifyLoggingStatus(isLogging: boolean): void {
    try {
      // Emit event that MainWindow can listen for
      this.emit('loggingStatusChanged', {
        isLogging,
        filename: this.logFilePath ? path.basename(this.logFilePath) : null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to notify logging status:', error);
    }
  }

  /**
   * Create the actual Electron window
   */
  protected createDebugWindow(): BrowserWindow {
    // Window dimensions - 80x24 terminal size (80 cols x 24 rows)
    // Assuming 10px per character width, 18px per line height
    const charWidth = 10;
    const lineHeight = 18;
    // Use base class method for consistent chrome adjustments
    const contentWidth = 80 * charWidth + 20; // 80 chars + padding
    const contentHeight = 24 * lineHeight + 10; // 24 lines + small padding
    const windowDimensions = this.calculateWindowDimensions(contentWidth, contentHeight);
    const windowWidth = windowDimensions.width;
    const windowHeight = windowDimensions.height;

    // Use WindowPlacer for intelligent positioning
    // For now, let's use a simpler approach to ensure it appears
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Position at bottom-right with margin
    const margin = 20;
    const position = {
      x: width - windowWidth - margin,
      y: height - windowHeight - margin
    };

    this.logConsoleMessage(`[DEBUG LOGGER] Positioning at bottom-right: ${position.x}, ${position.y}`);

    const window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: position.x,
      y: position.y,
      title: 'Debug Logger',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false
      },
      backgroundColor: this.theme.backgroundColor,
      show: false, // Will show when ready
      alwaysOnTop: false,
      resizable: true,
      minimizable: true,
      closable: true
    });

    // Load simple HTML for debug output display
    const html = this.generateHTML();
    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Set up IPC handlers for menu buttons
    ipcMain.on('toggle-all-cogs', () => {
      if (this.cogsAreShowing) {
        this.logConsoleMessage('[DEBUG LOGGER] Hide All COGs button clicked');
        this.emit('hide-all-cogs-requested');
        // DON'T update state here - let handleHideAllCOGs() do it via updateCOGsState()
      } else {
        this.logConsoleMessage('[DEBUG LOGGER] Show All COGs button clicked');
        this.emit('show-all-cogs-requested');
        // DON'T update state here - let handleShowAllCOGs() do it via updateCOGsState()
      }
    });

    ipcMain.on('export-cog-logs', () => {
      this.logConsoleMessage('[DEBUG LOGGER] Export Active COG Logs button clicked');
      // TODO: Implement COG log export functionality
      // This will use COGLogExporter to save all active COG logs
      this.emit('export-cog-logs-requested');
    });

    // CRITICAL: Use BOTH ready-to-show AND did-finish-load for reliability
    // ready-to-show fires when window is ready to display (earlier)
    // did-finish-load fires when DOM is loaded (later, more reliable for IPC)
    if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Setting up window ready event handlers...');

    let readyHandled = false; // Prevent double-handling

    const handleRendererReady = () => {
      if (readyHandled) {
        if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Renderer ready handler already called, skipping');
        return;
      }
      readyHandled = true;

      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Renderer ready event fired!');
      window.show();
      window.focus();
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Window shown and focused');

      // CRITICAL: Mark renderer as ready for IPC messages
      this.rendererReady = true;
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] ✅ Renderer marked as ready for IPC');

      // Send current theme to renderer now that it's ready
      if (this.theme) {
        window.webContents.send('set-theme', this.theme);
        if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] ✅ Theme sent to renderer:', this.theme.name);
      }

      // Re-send the scrollback setting. A renderer starts at the built-in default, and
      // the preference may have been applied while no viewer existed (or to a previous
      // one), so pushing it here is what makes the setting survive a viewer reopen.
      window.webContents.send('set-scrollback-lines', this.scrollbackLines);

      // A reopened viewer starts empty — repaint the recent history before anything new,
      // so it does not look like the session began at the moment you reopened it.
      if (this.replayOnReady) {
        this.replayOnReady = false;
        this.replayBufferedLines();
      }

      // Process any pending batches that accumulated before renderer was ready
      if (this.renderQueue.length > 0) {
        if (ENABLE_CONSOLE_LOG) console.log(
          `[DEBUG LOGGER] 📦 Processing ${this.renderQueue.length} queued messages now that renderer is ready`
        );
        this.processBatch();
      } else {
        if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] No queued messages to process');
      }

      // Verify registration
      const router = this.windowRouter;
      const activeWindows = router.getActiveWindows();
      const loggerWindow = activeWindows.find((w) => w.windowType === 'logger');
      if (loggerWindow) {
        if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Verified still registered:', loggerWindow.windowId);
      } else {
        console.error('[DEBUG LOGGER] ❌ Registration was lost! Re-registering...');
        try {
          this.registerWithRouter();
          if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Re-registered successfully');
        } catch (error) {
          console.error('[DEBUG LOGGER] ❌ Re-registration failed:', error);
        }
      }

      // Send ready message to console for debugging
      this.logMessage('Debug Logger window ready');
    };

    // Try both events - whichever fires first wins
    // ready-to-show is on BrowserWindow, did-finish-load is on webContents
    window.once('ready-to-show', () => {
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] ready-to-show event fired');
      handleRendererReady();
    });

    window.webContents.once('did-finish-load', () => {
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] did-finish-load event fired');
      handleRendererReady();
    });

    // Fallback timeout in case neither event fires
    setTimeout(() => {
      if (!readyHandled) {
        console.warn('[DEBUG LOGGER] ⚠️ Timeout waiting for renderer ready events, forcing ready state');
        handleRendererReady();
      }
    }, 2000);

    // Handle window close event.
    //
    // The window is a VIEWER over the log; it is not the log. Closing it used to end the
    // log file, null the singleton and unregister from the router — so the app kept
    // receiving data with nowhere to put it (measured on hardware 2026-07-26: 47 s and
    // 26 s of stream received and never written). Now the viewer goes away and the log
    // keeps going; Window > Show Log attaches a new viewer to the SAME file.
    window.on('close', () => {
      this.logConsoleMessage('[DEBUG LOGGER] Viewer window closed by user — logging continues');

      // Stop painting: no viewer, so anything queued for the screen is discarded. The
      // file is written by writeToLog(), a separate path, and is unaffected.
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      this.renderQueue = [];
      this.displaySheddedLines = 0;
      this.rendererReady = false;
      this.viewerOpen = false;
      if (this.statusBarTimer) {
        clearTimeout(this.statusBarTimer);
        this.statusBarTimer = null;
      }

      // Flush what is already in the write path so the file is current at this instant,
      // then leave the stream OPEN. (closeDebugWindow() is the path that ends the log.)
      this.flushLogLineAccumulator();
      if (this.writeTimer) {
        clearTimeout(this.writeTimer);
        this.flushWriteBuffer();
      }
      if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
        this.logFile.write(`\n=== Log window closed at ${getFormattedDateTimeISO()} — logging continues ===\n`);
      }

      // NOTE: deliberately NOT `this.debugWindow = null` and NOT clearing the singleton.
      // The base-class setter's null branch unregisters from the WindowRouter, which is
      // exactly what stopped the log. Senders all guard on isDestroyed(), and
      // showViewer() replaces the reference when a new viewer is created.
      this.onViewerVisibilityChanged?.(false);
    });

    return window;
  }

  /**
   * Is a viewer window currently on screen?
   */
  public isViewerOpen(): boolean {
    return this.viewerOpen && this.debugWindow !== null && !this.debugWindow.isDestroyed();
  }

  /**
   * Show the log viewer — creating a new window if the user closed the previous one.
   * The log file is untouched either way: a reopened viewer attaches to the SAME file,
   * it does not start a new session.
   */
  public showViewer(): void {
    if (this.isViewerOpen()) {
      this.debugWindow!.show();
      this.debugWindow!.focus();
      return;
    }

    this.logConsoleMessage('[DEBUG LOGGER] Reopening log viewer on the existing log file');
    // Both flags MUST be set before the window exists: 'ready-to-show' can fire during
    // createDebugWindow(), and a replay that runs while viewerOpen is still false would
    // be swallowed by appendMessage's no-viewer short-circuit.
    this.replayOnReady = true;
    this.viewerOpen = true;
    this.debugWindow = this.createDebugWindow(); // setter's non-null branch: wires listeners only

    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      this.logFile.write(`\n=== Log window reopened at ${getFormattedDateTimeISO()} ===\n`);
    }
    this.onViewerVisibilityChanged?.(true);
  }

  /**
   * Hide (close) the log viewer. Logging continues — same path as the window's own
   * close button, so the two cannot drift apart.
   */
  public hideViewer(): void {
    if (!this.isViewerOpen()) return;
    this.debugWindow!.close(); // fires the 'close' handler above, which does the work
  }

  /**
   * Repaint the recent history into a freshly opened viewer. The in-memory lineBuffer is
   * what the session has seen; the file always has more, so the replay says so rather
   * than pretending the window is showing everything.
   */
  private replayBufferedLines(): void {
    if (this.lineBuffer.length === 0) return;
    if (!this.debugWindow || this.debugWindow.isDestroyed() || !this.rendererReady) return;

    const tail = this.lineBuffer.slice(-LoggerWindow.REPLAY_LINES);

    // Sent DIRECTLY, not through queueForDisplay. That queue sheds anything above
    // MAX_DISPLAY_BACKLOG, because a LIVE stream outrunning the display is a real
    // condition worth reporting. A replay is not that condition — it is a bounded set
    // that is already complete — so routing it through the live path shed roughly 70%
    // of it and printed a "display fell behind" banner that was simply false. Going
    // direct also puts the history ahead of any live lines that queued up while the
    // renderer was still starting, which is the order a reader expects.
    //
    // NOT appendMessage either: that would push the history back into lineBuffer and
    // duplicate it on every reopen.
    //
    // Empty timestamps throughout: lineBuffer keeps the line text, not its arrival
    // time, so there is no honest timestamp to show. The renderer omits the column
    // for an empty string rather than inventing a replay-time one.
    const messages = [
      {
        message: `⋯ replaying the last ${tail.length.toLocaleString()} line(s) of this session — the log file has every line ⋯`,
        type: 'system-message',
        timestamp: ''
      },
      ...tail.map((line) => ({ message: line, type: 'cog-message', timestamp: '' }))
    ];

    this.debugWindow.webContents.send('append-messages-batch', messages);
  }

  /**
   * Generate HTML for the debug logger window
   */
  private generateHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Debug Logger</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${this.theme.backgroundColor};
      color: ${this.theme.foregroundColor};
      font-family: 'Courier New', monospace;
      font-size: 12px;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #menu-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 32px;
      background-color: #f0f0f0;
      border-bottom: 1px solid #d0d0d0;
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 13px;
      z-index: 100;
    }
    #menu-bar button {
      margin-right: 10px;
      padding: 4px 12px;
      background-color: #fff;
      border: 1px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    #menu-bar button:hover {
      background-color: #e8e8e8;
    }
    #status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 28px;
      background-color: #e8e8e8;
      border-top: 1px solid #b8b8b8;
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 13px;
      color: #000000;
    }
    .status-field {
      margin-right: 20px;
    }
    .status-label {
      color: #333333;
      margin-right: 5px;
      font-weight: 500;
    }
    .status-value {
      color: #000000;
    }
    #output {
      flex: 1;
      overflow-y: auto;
      /* NOT scroll-behavior: smooth. A smooth scroll is ANIMATED, so
         "scrollTop = scrollHeight" becomes a request that lands over many frames,
         firing intermediate scroll events at not-yet-at-bottom positions. The
         scroll listener below reads those as "the user scrolled up" and drops out
         of live mode, so the tail stops following and the last lines of a run are
         left off-screen. A live tail jumps; it does not animate. */
      white-space: pre-wrap;
      word-wrap: break-word;
      padding: 10px;
      margin-top: 42px; /* Space for fixed menu bar */
      margin-bottom: 32px; /* Space for status bar */
    }
    #output > div {
      display: flex;
      align-items: baseline;
    }
    .cog-message {
      color: ${this.theme.foregroundColor};
    }
    .system-message {
      color: #808080;
      font-style: italic;
    }
    .error-message {
      color: #FF6B6B;
      font-weight: bold;
      background-color: #2D1B1B;
      padding: 2px 4px;
      border-left: 3px solid #FF6B6B;
    }
    .binary-message {
      color: #00FFFF;  /* Cyan for binary hex dumps */
      font-family: 'Courier New', monospace;
    }
    .debugger-formatted {
      color: #FFD700;  /* Gold for formatted debugger messages */
      font-family: 'Courier New', monospace;
      white-space: pre;  /* Preserve formatting */
      background-color: #1a1a1a;
      padding: 2px 4px;
      margin: 2px 0;
      border-left: 3px solid #FFD700;
    }
    .timestamp {
      color: #606060;
      font-size: 10px;
      font-family: 'Courier New', monospace;  /* Monospace for perfect alignment */
      display: inline-block;
      width: 16ch;  /* Fixed width for HH:MM:SS.mmmmmm format - ALWAYS */
      flex-shrink: 0;
      text-align: left;
      margin-right: 1ch;  /* Small gap before debug text */
    }
  </style>
</head>
<body>
  <div id="menu-bar">
    <button id="btn-show-all-cogs">Show All 8 COGs</button>
    <button id="btn-export-cog-logs">Export Active COG Logs</button>
  </div>
  <div id="output"></div>
  <div id="status-bar">
    <div class="status-field">
      <span class="status-label">Log:</span>
      <span class="status-value" id="log-filename">No file</span>
    </div>
    <div class="status-field">
      <span class="status-label">Lines:</span>
      <span class="status-value" id="line-count">0</span>
    </div>
    <div class="status-field">
      <span class="status-label">Size:</span>
      <span class="status-value" id="log-size">0 KB</span>
    </div>
    <div class="status-field">
      <span id="mode-indicator">🔴 Live</span>
      <button id="return-to-live" style="display: none; margin-left: 5px; padding: 2px 8px; font-size: 11px;">↓ Follow Live Data</button>
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const output = document.getElementById('output');
    const modeIndicator = document.getElementById('mode-indicator');
    const returnToLiveButton = document.getElementById('return-to-live');

    // Hybrid scrolling state
    let autoScroll = true;          // Start in live mode
    let scrollThreshold = 50;       // Pixels from bottom = "live mode"
    // How many lines stay in the DOM, and therefore how far back you can scroll.
    // This is the user's "Scrollback lines" preference (clamped 100..10000 by the
    // handler below); the main process pushes the real value as soon as this renderer
    // reports ready, so the literal here only covers the gap before that arrives.
    // It is ONE cap deliberately: a second, lower, hardcoded ceiling is what made the
    // preference inert — it was read by nothing while a fixed 1500 did the trimming.
    let maxScrollbackLines = 1000;

    // Helper functions
    function updateModeIndicator(mode) {
      if (mode === 'live') {
        modeIndicator.textContent = '🔴 Live';
        returnToLiveButton.style.display = 'none';
      } else {
        modeIndicator.textContent = '📜 History';
        returnToLiveButton.style.display = 'inline-block';
      }
    }

    // Latch: a scroll event caused by OUR OWN scrollTop write must never be read as
    // user intent. The scroll listener cannot tell the two apart on its own — it only
    // sees a position — so the writer marks its own scrolls and the listener ignores
    // exactly those. Without this, trimToCap() shrinking the content (and any layout
    // change under a fast stream) emits scroll events that silently drop live mode.
    let programmaticScroll = false;

    function scrollToBottom() {
      programmaticScroll = true;
      output.scrollTop = output.scrollHeight;
      // Release on the NEXT frame, not synchronously: scroll events are dispatched
      // asynchronously, during the rendering steps that precede animation-frame
      // callbacks. So our own event is guaranteed to arrive while the latch is still
      // set, and this callback clears it immediately afterward. Releasing here also
      // covers the case where the write changed nothing and no event ever fires.
      requestAnimationFrame(function() { programmaticScroll = false; });
    }

    function isNearBottom() {
      return (output.scrollTop + output.clientHeight) >= (output.scrollHeight - scrollThreshold);
    }

    // Simple scroll behavior - if user scrolls up, pause auto-scroll
    // If they scroll back to bottom, resume
    output.addEventListener('scroll', function() {
      if (programmaticScroll) return; // our own scroll, not the user's — carries no intent
      const nearBottom = isNearBottom();

      if (nearBottom && !autoScroll) {
        // User scrolled back to bottom - resume auto-scroll
        autoScroll = true;
        updateModeIndicator('live');
      } else if (!nearBottom && autoScroll) {
        // User scrolled up - pause auto-scroll
        autoScroll = false;
        updateModeIndicator('history');
      }
    });

    // Return to Live button handler
    returnToLiveButton.addEventListener('click', function() {
      autoScroll = true;
      updateModeIndicator('live');
      scrollToBottom();
    });

    // ---- Painting is frame-driven, never IPC-driven (invariant I3) ------------------
    // Under a sustained stream this window is the heaviest thing in the process, and on
    // Windows the DWM composites EVERY window — so a renderer that saturates the GPU
    // freezes other applications, not just this one. Three rules keep it bounded:
    //   1. incoming batches are buffered and drawn at most once per animation frame;
    //   2. if more than the DOM cap is pending, only the newest are drawn (the rest are
    //      accounted for on screen — the log file always has every line);
    //   3. the old lines are removed in ONE range deletion, not one removeChild per line.
    // Each line is also one element + one text node instead of three elements.
    let pendingLines = [];       // batched data objects awaiting a frame
    let pendingFrame = null;     // requestAnimationFrame handle, null when idle
    let droppedByRenderer = 0;   // lines the renderer itself could not draw

    function buildLine(data) {
      const line = document.createElement('div');
      line.className = data.type || 'cog-message';

      if (data.timestamp) {
        const timestamp = document.createElement('span');
        // Add 'short' class for abbreviated timestamps
        const isShort = data.timestamp.startsWith('.');
        timestamp.className = isShort ? 'timestamp short' : 'timestamp';
        timestamp.textContent = data.timestamp;
        line.appendChild(timestamp);
      }

      // A text node, not a <span>: same rendering, one less element per line.
      line.appendChild(document.createTextNode(data.message));
      return line;
    }

    function trimToCap() {
      const excess = output.children.length - maxScrollbackLines;
      if (excess <= 0) return;
      // One range deletion instead of one removeChild per excess line — the old loop
      // invalidated layout once per line, thousands of times a second.
      const range = document.createRange();
      range.setStartBefore(output.firstChild);
      range.setEndBefore(output.children[excess]);
      range.deleteContents();
    }

    function paintFrame() {
      pendingFrame = null;
      if (pendingLines.length === 0) return;

      // Drawing more than the DOM cap in one frame is pure waste — everything above the
      // last maxScrollbackLines would be trimmed off the top before it was ever seen.
      if (pendingLines.length > maxScrollbackLines) {
        droppedByRenderer += pendingLines.length - maxScrollbackLines;
        pendingLines = pendingLines.slice(-maxScrollbackLines);
      }

      const fragment = document.createDocumentFragment();
      if (droppedByRenderer > 0) {
        fragment.appendChild(buildLine({
          type: 'system-message',
          timestamp: '',
          message: '⋯ ' + droppedByRenderer.toLocaleString() +
                   ' line(s) not shown — display fell behind; the log file has every line ⋯'
        }));
        droppedByRenderer = 0;
      }
      for (let i = 0; i < pendingLines.length; i++) {
        fragment.appendChild(buildLine(pendingLines[i]));
      }
      pendingLines = [];

      output.appendChild(fragment);
      trimToCap();

      // Only follow the tail in live mode. Forcing it unconditionally fought the user's
      // own scrolling AND cost a forced layout on every batch.
      if (autoScroll) scrollToBottom();
    }

    function schedulePaint() {
      if (pendingFrame === null) pendingFrame = requestAnimationFrame(paintFrame);
    }

    // Shutdown hook, called from the main process via executeJavaScript. Paints
    // everything buffered RIGHT NOW instead of waiting for an animation frame — at
    // shutdown the window is often already hidden or occluded, and rAF is throttled or
    // suspended outright in that state, so a frame we are waiting on may simply never
    // arrive. Returns the on-screen line count so the caller can log what landed.
    window.__flushPaint = function() {
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
      paintFrame();
      return output.children.length;
    };

    ipcRenderer.on('append-message', (event, data) => {
      pendingLines.push(data);
      schedulePaint();
    });

    // Handle batch messages (performance optimization for 2Mbps)
    ipcRenderer.on('append-messages-batch', (event, messages) => {
      for (let i = 0; i < messages.length; i++) pendingLines.push(messages[i]);
      schedulePaint();
    });

    ipcRenderer.on('clear-output', () => {
      // Drop anything queued for a frame too, or a reset would immediately repaint the
      // lines it was asked to clear.
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
      pendingLines = [];
      droppedByRenderer = 0;
      output.innerHTML = '';
      // Reset to live mode on session reset
      autoScroll = true;
      updateModeIndicator('live');
    });


    // Handle scrollback preference updates. Applied immediately rather than only to
    // lines that arrive afterwards: lowering the setting should shorten what is
    // already on screen, not wait for new traffic to enforce it.
    ipcRenderer.on('set-scrollback-lines', (event, lines) => {
      maxScrollbackLines = Math.min(Math.max(lines, 100), 10000); // Clamp to 100-10000 range
      const wasFollowing = autoScroll;
      trimToCap();
      if (wasFollowing) scrollToBottom(); // trimming moved the content under the viewport
    });

    ipcRenderer.on('set-theme', (event, theme) => {
      document.body.style.backgroundColor = theme.backgroundColor;
      document.body.style.color = theme.foregroundColor;
    });

    // Add button handlers
    const cogButton = document.getElementById('btn-show-all-cogs');
    let cogsShowing = false;

    cogButton.addEventListener('click', () => {
      cogsShowing = !cogsShowing;
      cogButton.textContent = cogsShowing ? 'Hide All 8 COGs' : 'Show All 8 COGs';
      ipcRenderer.send('toggle-all-cogs');
    });

    // Listen for COG state updates from main process
    ipcRenderer.on('cogs-state-changed', (event, showing) => {
      cogsShowing = showing;
      cogButton.textContent = cogsShowing ? 'Hide All 8 COGs' : 'Show All 8 COGs';
    });

    document.getElementById('btn-export-cog-logs').addEventListener('click', () => {
      ipcRenderer.send('export-cog-logs');
    });
  </script>
</body>
</html>`;
  }

  /**
   * Process messages immediately (required by base class)
   * Receives ExtractedMessage from router (router handles SharedMessagePool release)
   */
  protected async processMessageImmediate(lineParts: string[] | any): Promise<void> {
    this.logConsoleMessage('[DEBUG LOGGER] processMessageImmediate called with:', lineParts);

    try {
      // Extract data immediately before any async operations
      this.processMessageImmediateSync(lineParts);
    } catch (error) {
      console.error(`[DEBUG LOGGER] Error processing message: ${error}`);
    }
  }

  /**
   * Internal synchronous message processing (extracted for proper release timing)
   */
  private processMessageImmediateSync(actualData: string[] | any): void {
    this.logConsoleMessage('[DEBUG LOGGER] processMessageImmediateSync called with:', actualData);

    // Handle binary data (debugger protocol)
    if (actualData instanceof Uint8Array) {
      this.logConsoleMessage('[DEBUG LOGGER] Processing binary debugger message:', actualData.length, 'bytes');
      const hexFormatted = this.formatBinaryAsHex(actualData);
      this.appendMessage(hexFormatted, 'binary-message');
      this.writeToLog(hexFormatted);
    }
    // Handle string array (standard Cog messages)
    else if (Array.isArray(actualData)) {
      const message = actualData.join(' ');
      this.logConsoleMessage('[DEBUG LOGGER] Processing array message:', message);

      // Check if this is a formatted debugger message
      if (message.includes('=== Initial Debugger Message') || message.includes('=== Debugger Protocol')) {
        // This is a formatted debugger message, display with special styling
        this.appendMessage(message, 'debugger-formatted');
        this.writeToLog(message);
      } else {
        // Regular COG message
        this.appendMessage(message, 'cog-message');
        this.writeToLog(message);
      }
    }
    // Handle raw string
    else if (typeof actualData === 'string') {
      this.logConsoleMessage('[DEBUG LOGGER] Processing string message:', actualData);

      // Check if this is a formatted debugger message
      if (actualData.includes('=== Initial Debugger Message') || actualData.includes('=== Debugger Protocol')) {
        this.appendMessage(actualData, 'debugger-formatted');
      } else {
        this.appendMessage(actualData, 'cog-message');
      }
      this.writeToLog(actualData);
    }

    // Update status bar
    this.updateStatusBar();
  }

  /**
   * Override base class handleRouterMessage to properly route to processTypedMessage
   * WindowRouter calls this with ExtractedMessage containing SharedMessageType
   */
  public handleRouterMessage(message: ExtractedMessage | Uint8Array | string): void {
    // NO WINDOW CHECK HERE — deliberately.
    //
    // This used to early-exit when the window was destroyed or the renderer was not
    // ready ("don't waste CPU processing messages for closed windows"). The saving was
    // real, but this one entry point feeds BOTH responsibilities: every branch below
    // calls appendMessage (display) AND writeToLog (file). Gating it therefore stopped
    // the LOG, not just the drawing. Measured on hardware with v0.11.6, which had
    // already fixed the file/singleton/router ownership: across two close-reopen cycles,
    // 50,236 and 43,248 lines were received and never written — while the window was
    // closed, only logSystemMessage (which bypasses this path) reached the file.
    //
    // The CPU saving is preserved where it belongs: appendMessage returns immediately
    // when there is no viewer, so no render work happens for a window that isn't there.
    // Durability is not conditional on someone watching.
    try {
      // Check if it's an ExtractedMessage object with type
      if (typeof message === 'object' && !Array.isArray(message) && !(message instanceof Uint8Array)) {
        const extractedMsg = message as ExtractedMessage;
        if (extractedMsg.type !== undefined) {
          // ExtractedMessage with SharedMessageType - route to processTypedMessage
          this.processTypedMessage(extractedMsg.type, extractedMsg.data);
          return;
        }
      }

      // Fallback for legacy paths
      if (typeof message === 'string') {
        this.processTypedMessage(SharedMessageType.TERMINAL_OUTPUT, [message]);
      } else if (message instanceof Uint8Array) {
        this.processTypedMessage(SharedMessageType.DEBUGGER0_416BYTE, message);
      }
    } catch (error) {
      console.error('[DEBUG LOGGER] Error in handleRouterMessage:', error);
    }
  }

  /**
   * Process message with type information (type-safe handoff)
   * Receives ExtractedMessage from router (router handles SharedMessagePool release)
   */
  public processTypedMessage(messageType: SharedMessageType, data: string[] | Uint8Array): void {
    if (ENABLE_CONSOLE_LOG) console.log(
      `[DEBUG LOGGER] 📨 processTypedMessage called: type=${messageType}, dataLength=${data.length}, rendererReady=${this.rendererReady}, queueLength=${this.renderQueue.length}`
    );
    this.logConsoleMessage(`[DEBUG LOGGER] Processing typed message: SharedMessageType ${messageType}`);

    try {
      // Extract data immediately before any async operations
      this.processTypedMessageSync(messageType, data);
    } catch (error) {
      console.error(`[DEBUG LOGGER] Error processing message: ${error}`);
    }
  }

  /**
   * Internal synchronous message processing (extracted for proper release timing)
   */
  private processTypedMessageSync(messageType: SharedMessageType, actualData: string[] | Uint8Array): void {
    // Handle DEBUGGER_416BYTE range (DEBUGGER0-DEBUGGER7)
    if (messageType >= SharedMessageType.DEBUGGER0_416BYTE && messageType <= SharedMessageType.DEBUGGER7_416BYTE) {
      // Binary debugger data - display with proper 416-byte formatting
      if (actualData instanceof Uint8Array) {
        const formatted = this.formatDebuggerMessage(actualData);
        this.appendMessage(formatted, 'debugger-formatted');
        this.writeToLog(formatted);
      }
    }
    // Handle DB_PACKET
    else if (messageType === SharedMessageType.DB_PACKET) {
      // DB prefix messages - use same hex format as debugger packets
      if (actualData instanceof Uint8Array) {
        const formatted = this.formatDebuggerMessage(actualData);
        this.appendMessage(formatted, 'debugger-formatted');
        this.writeToLog(formatted);
      }
    }
    // Handle COG messages (COG0-COG7) and P2_SYSTEM_INIT
    else if (
      (messageType >= SharedMessageType.COG0_MESSAGE && messageType <= SharedMessageType.COG7_MESSAGE) ||
      messageType === SharedMessageType.P2_SYSTEM_INIT
    ) {
      // Text data - display as readable text
      if (Array.isArray(actualData)) {
        const message = actualData.join(' ');
        this.appendMessage(message, 'cog-message');
        this.writeToLog(message);
      } else if (typeof actualData === 'string') {
        this.appendMessage(actualData, 'cog-message');
        this.writeToLog(actualData);
      } else if (actualData instanceof Uint8Array) {
        // DEFENSIVE: COG messages should be text - verify before decoding
        const cogClassification = this.classifyData(actualData);
        if (cogClassification === 'ascii') {
          const message = new TextDecoder().decode(actualData);
          this.appendMessage(message, 'cog-message');
          this.writeToLog(message);
        } else if (cogClassification === 'ascii-pst') {
          // ASCII with embedded PST control codes — render them as visible tags
          const formatted = this.formatPSTControlCodes(actualData);
          this.appendMessage(formatted, 'cog-message');
          this.writeToLog(formatted);
        } else {
          // Check for a DEBUG_END_SESSION sentinel before treating as routing
          // error. The only trusted signal is a 0x1B immediately preceded by a
          // CR LF pair (0x0D 0x0A 0x1B). A bare "contains 0x1B" scan false-
          // matches binary payloads carrying a 0x1B byte (e.g. sample value
          // $031B), wrongly replacing the carrying message (see #32).
          if (isEndSessionSentinel(actualData)) {
            const endMsg = '[DEBUG_END_SESSION]';
            this.appendMessage(endMsg, 'cog-message');
            this.writeToLog(endMsg);
          } else {
            // Binary data misclassified as COG - display defensively with hex fallback
            const hexFallback = this.formatBinaryAsHexFallback(actualData);
            this.appendMessage(`[ROUTING ERROR: Binary data in COG message]\n${hexFallback}`, 'binary-message');
            this.writeToLog(`[ROUTING ERROR: Binary data in COG message]\n${hexFallback}`);
          }
        }
      }
    }
    // Handle TERMINAL_OUTPUT
    else if (messageType === SharedMessageType.TERMINAL_OUTPUT) {
      // Classify data to determine display format
      if (actualData instanceof Uint8Array) {
        const termClassification = this.classifyData(actualData);
        if (termClassification === 'ascii') {
          // Pure ASCII — display as plain text
          const message = new TextDecoder().decode(actualData);
          this.appendMessage(message, 'cog-message');
          this.writeToLog(message);
        } else if (termClassification === 'ascii-pst') {
          // ASCII with PST control codes — render them as visible tags
          const formatted = this.formatPSTControlCodes(actualData);
          this.appendMessage(formatted, 'cog-message');
          this.writeToLog(formatted);
        } else {
          // True binary — display as hex fallback
          const hexFallback = this.formatBinaryAsHexFallback(actualData);
          this.appendMessage(hexFallback, 'binary-message');
          this.writeToLog(hexFallback);
        }
      } else if (Array.isArray(actualData)) {
        const message = actualData.join(' ');
        this.appendMessage(message, 'cog-message');
        this.writeToLog(message);
      } else if (typeof actualData === 'string') {
        this.appendMessage(actualData, 'cog-message');
        this.writeToLog(actualData);
      }
    }
    // Handle INVALID_COG
    else if (messageType === SharedMessageType.INVALID_COG) {
      // Error/warning messages
      const errorMsg = Array.isArray(actualData)
        ? actualData.join(' ')
        : actualData instanceof Uint8Array
        ? new TextDecoder().decode(actualData)
        : String(actualData);
      this.appendMessage(`[WARNING] ${errorMsg}`, 'warning-message');
      this.writeToLog(`[WARNING] ${errorMsg}`);
    }
    // Fallback for unknown types
    else {
      // Fallback - use safe display with three-tier classification
      if (actualData instanceof Uint8Array) {
        const fallbackClassification = this.classifyData(actualData);
        if (fallbackClassification === 'binary') {
          const hexData = this.formatBinaryAsHexFallback(actualData);
          this.appendMessage(hexData, 'binary-message');
          this.writeToLog(hexData);
        } else {
          // 'ascii' or 'ascii-pst' — format with PST tags (harmless for pure ASCII)
          const formatted = this.formatPSTControlCodes(actualData);
          this.appendMessage(formatted, 'generic-message');
          this.writeToLog(formatted);
        }
      } else {
        const displayData = Array.isArray(actualData) ? actualData.join(' ') : String(actualData);
        this.appendMessage(displayData, 'generic-message');
        this.writeToLog(displayData);
      }
    }

    this.updateStatusBar();
  }

  /**
   * Request a status-bar refresh. Coalesced, because this is called once per ROUTED
   * MESSAGE: at ~6,000 messages/s the old direct call meant ~6,000 existsSync + statSync
   * pairs (synchronous filesystem syscalls, on the main process) and ~6,000
   * executeJavaScript round-trips per second, purely to redraw three small numbers that
   * no one can read changing that fast. Same defect class as the renderer coupling —
   * work scaling with arrival rate instead of with display rate (invariant I3).
   */
  private updateStatusBar(): void {
    if (this.statusBarTimer !== null) return; // a refresh is already due
    if (!this.isViewerOpen()) return; // no viewer, nothing to draw
    this.statusBarTimer = setTimeout(() => {
      this.statusBarTimer = null;
      this.refreshStatusBar();
    }, LoggerWindow.STATUS_BAR_INTERVAL_MS);
    // Never let a cosmetic timer hold the process open at shutdown.
    this.statusBarTimer.unref?.();
  }

  /**
   * Actually redraw the status bar with current file info.
   */
  private refreshStatusBar(): void {
    if (!this.debugWindow || this.debugWindow.isDestroyed()) return;

    // Get log file name
    const logFileName = this.logFilePath ? path.basename(this.logFilePath) : 'No file';

    // Get line count
    const lineCount = this.lineBuffer.length;

    // Get approximate size
    const sizeKB =
      this.logFilePath && fs.existsSync(this.logFilePath)
        ? (fs.statSync(this.logFilePath).size / 1024).toFixed(1)
        : '0';

    // Send update to renderer
    this.debugWindow.webContents.executeJavaScript(`
      document.getElementById('log-filename').textContent = '${logFileName}';
      document.getElementById('line-count').textContent = '${lineCount}';
      document.getElementById('log-size').textContent = '${sizeKB} KB';
    `);
  }

  /**
   * Append a message to the debug logger window (batched for performance)
   */
  private appendMessage(message: string, type: string = 'cog-message'): void {
    // Scrollback bookkeeping happens whether or not a viewer is on screen — it is what a
    // reopened window replays.
    this.lineBuffer.push(message);
    if (this.lineBuffer.length > this.maxLines) {
      // Remove oldest 10% when buffer is full
      const removeCount = Math.floor(this.maxLines * 0.1);
      this.lineBuffer.splice(0, removeCount);
    }

    // No viewer: do no rendering work at all for a window that isn't there.
    if (!this.viewerOpen) return;

    if (ENABLE_CONSOLE_LOG) console.log(
      `[DEBUG LOGGER] ➕ appendMessage: queueLength=${
        this.renderQueue.length
      }, type=${type}, msgPreview="${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`
    );

    this.queueForDisplay(message, type);
  }

  /**
   * Put a line in front of the eyes, without touching the scrollback or the file.
   * Replay uses this directly; appendMessage uses it after its bookkeeping.
   */
  private queueForDisplay(message: string, type: string): void {
    this.renderQueue.push({
      message,
      className: type,
      timestamp: Date.now() // Capture precise arrival time
    });

    // Schedule batch processing if not already scheduled
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_INTERVAL_MS);
    }

    // Bound the DISPLAY backlog by shedding the oldest un-drawn lines — never by flushing
    // faster. The previous "force immediate flush at BATCH_SIZE_LIMIT" did the opposite: a
    // drain tick delivering 1,000 lines fired processBatch (and therefore an IPC send and a
    // synchronous renderer DOM append) TEN times inside that one tick, so the paint rate
    // tracked the wire rate exactly — the I3 violation. The timer is now the only trigger,
    // which caps painting at 60 fps no matter how fast data arrives.
    const overflow = this.renderQueue.length - LoggerWindow.MAX_DISPLAY_BACKLOG;
    if (overflow > 0) {
      this.renderQueue.splice(0, overflow); // oldest go; the file already has them
      this.displaySheddedLines += overflow;
    }
  }

  /**
   * Process queued messages in batch for performance
   */
  private processBatch(): void {
    if (ENABLE_CONSOLE_LOG) console.log(
      `[DEBUG LOGGER] 📤 processBatch called: queueLength=${this.renderQueue.length}, rendererReady=${
        this.rendererReady
      }, windowExists=${!!this.debugWindow}, windowDestroyed=${this.debugWindow?.isDestroyed()}`
    );

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.renderQueue.length === 0) {
      if (ENABLE_CONSOLE_LOG) console.log('[DEBUG LOGGER] Queue empty, nothing to process');
      return;
    }

    // CRITICAL: Don't send to renderer until it's ready for IPC
    if (!this.rendererReady) {
      if (ENABLE_CONSOLE_LOG) console.log(`[DEBUG LOGGER] ⏸️  Renderer not ready, keeping ${this.renderQueue.length} messages queued`);
      this.logConsoleMessage(`[DEBUG LOGGER] Renderer not ready, keeping ${this.renderQueue.length} messages queued`);
      return; // Keep messages in queue until renderer is ready
    }

    // Take current batch
    const batch = this.renderQueue.splice(0, this.BATCH_SIZE_LIMIT);
    if (ENABLE_CONSOLE_LOG) console.log(
      `[DEBUG LOGGER] Processing batch of ${batch.length} messages, ${this.renderQueue.length} remaining in queue`
    );

    // Send batch to renderer
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      // High-resolution timestamps with fixed-width alignment
      // Format: HH:MM:SS.mmmmmm (always 15 chars)
      // Within same second: spaces replace HH:MM:SS for perfect column alignment
      // This creates a clean vertical column for debug text

      const messages = batch.map((item, index) => {
        const msgTime = item.timestamp;
        const d = new Date(msgTime);

        // Get all time components
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const seconds = d.getSeconds().toString().padStart(2, '0');
        const millis = d.getMilliseconds();

        // Use performance counter for microsecond precision
        const perfMicros = Math.floor((performance.now() * 1000) % 1000);
        const microString = `${millis.toString().padStart(3, '0')}${perfMicros.toString().padStart(3, '0')}`;

        let timestamp: string;

        // Check what parts changed from last timestamp
        const lastHours = this.lastFullTimestamp ? this.lastFullTimestamp.substring(0, 2) : '';
        const lastMinutes = this.lastFullTimestamp ? this.lastFullTimestamp.substring(3, 5) : '';
        const lastSeconds = this.lastFullTimestamp ? this.lastFullTimestamp.substring(6, 8) : '';

        if (index === 0 || hours !== lastHours || minutes !== lastMinutes || seconds !== lastSeconds) {
          // Something changed - show the changed parts
          if (hours !== lastHours || index === 0) {
            // Hour changed or first message - show full timestamp
            timestamp = `${hours}:${minutes}:${seconds}.${microString}`;
          } else if (minutes !== lastMinutes) {
            // Minute changed - blank out hour
            timestamp = `   ${minutes}:${seconds}.${microString}`;
          } else {
            // Just seconds changed - blank out hour:minute
            timestamp = `      ${seconds}.${microString}`;
          }
          this.lastFullTimestamp = `${hours}:${minutes}:${seconds}`;
        } else {
          // Same second - just show microseconds with spaces for alignment
          timestamp = `        .${microString}`;
        }

        return {
          message: item.message,
          type: item.className || 'cog-message',
          timestamp: timestamp
        };
      });

      // Account for anything the display skipped, in the display's own stream, so what is
      // on screen is never silently wrong. An empty timestamp renders without the
      // timestamp column (the renderer only builds one for a non-empty string).
      if (this.displaySheddedLines > 0) {
        messages.unshift({
          message: `⋯ ${this.displaySheddedLines.toLocaleString()} line(s) not shown — display fell behind; the log file has every line ⋯`,
          type: 'system-message',
          timestamp: ''
        });
        this.displaySheddedLines = 0;
      }

      this.logConsoleMessage(`[DEBUG LOGGER] Sending batch of ${messages.length} messages to window`);
      this.debugWindow.webContents.send('append-messages-batch', messages);
    } else {
      this.logConsoleMessage('[DEBUG LOGGER] Window not available for batch processing');
    }

    // If more messages pending, schedule next batch
    if (this.renderQueue.length > 0) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_INTERVAL_MS);
    }
  }

  /**
   * Write message to log file with line reassembly.
   * Accumulates partial chunks until CR/LF confirms a complete line,
   * so each log entry corresponds to a logical line — no mid-word splits.
   * RACE CONDITION FIX: Buffer messages if log file isn't ready yet
   */
  private writeToLog(message: string): void {
    // Accumulate text and extract complete lines (terminated by \n or \r\n).
    //
    // Everything before `scanFrom` has ALREADY been searched and holds no '\n', so only the
    // newly-appended text can contain one. Rescanning from index 0 every chunk made this
    // quadratic the moment a stream arrived without line terminators — which is exactly what
    // happened when CR/LF were being escaped upstream (see classifyData): 190k chunks each
    // rescanning a string growing toward 4.7 MB, on the main process, with the UI locked out.
    // The classification fix removes the cause; this removes the amplifier, so no future
    // escaping change can reintroduce a freeze here.
    const scanFrom = this.logLineAccumulator.length;
    this.logLineAccumulator += message;

    // Reset idle timer on every chunk
    if (this.logLineFlushTimer) {
      clearTimeout(this.logLineFlushTimer);
    }

    // Extract and write all complete lines
    let newlineIdx: number = this.logLineAccumulator.indexOf('\n', scanFrom);
    while (newlineIdx !== -1) {
      const line = this.logLineAccumulator.substring(0, newlineIdx + 1);
      this.logLineAccumulator = this.logLineAccumulator.substring(newlineIdx + 1);
      this.writeLogEntry(line);
      newlineIdx = this.logLineAccumulator.indexOf('\n');
    }

    // HARD BOUND: a stream that never presents a line terminator must not accumulate forever.
    // Without this the only escape was the 50ms idle timer, which never fires while data keeps
    // arriving — so a fast unterminated stream grew a single unbounded entry. Flush what we have
    // as its own entry instead; a very long line in the log is a far better failure than a
    // frozen application.
    if (this.logLineAccumulator.length >= LoggerWindow.MAX_UNTERMINATED_LINE_BYTES) {
      this.writeLogEntry(this.logLineAccumulator);
      this.logLineAccumulator = '';
    }

    // If there's remaining text without a newline, start idle timer to flush it
    if (this.logLineAccumulator.length > 0) {
      this.logLineFlushTimer = setTimeout(() => this.flushLogLineAccumulator(), this.LOG_LINE_FLUSH_TIMEOUT_MS);
    }
  }

  /**
   * Flush any partial line remaining in the accumulator (on idle timeout or shutdown)
   */
  private flushLogLineAccumulator(): void {
    if (this.logLineFlushTimer) {
      clearTimeout(this.logLineFlushTimer);
      this.logLineFlushTimer = null;
    }
    if (this.logLineAccumulator.length > 0) {
      this.writeLogEntry(this.logLineAccumulator);
      this.logLineAccumulator = '';
    }
  }

  /**
   * Write a single reassembled line to the log file with timestamp.
   */
  private writeLogEntry(message: string): void {
    const timestamp = getFormattedDateTimeISO();
    // Strip trailing CR/LF from the reassembled line
    const cleanMessage = message.replace(/[\r\n]+$/, '');
    const logEntry = `[${timestamp}] ${cleanMessage}\n`;

    if (this.logFileReady && this.logFile) {
      // Log file is ready - write normally
      this.writeBuffer.push(logEntry);

      // Log first few writes to confirm it's working
      if (this.writeBuffer.length <= 3) {
        const truncated = cleanMessage.length > 80 ? cleanMessage.substring(0, 80) + '...' : cleanMessage;
        this.logConsoleMessage('[DEBUG LOGGER] Added to write buffer:', truncated);
      }

      // Schedule write if not already scheduled
      if (!this.writeTimer) {
        this.writeTimer = setTimeout(() => this.flushWriteBuffer(), this.WRITE_INTERVAL_MS);
      }

      // Force flush only if buffer is getting large (4KB)
      if (this.writeBuffer.join('').length > 4096) {
        this.flushWriteBuffer();
      }
    } else {
      // Log file not ready yet - buffer the message for later
      this.pendingLogMessages.push(logEntry);
      this.logConsoleMessage(
        `[DEBUG LOGGER] Buffered message (log file not ready): ${cleanMessage.substring(0, 50)}${
          cleanMessage.length > 50 ? '...' : ''
        }`
      );

      // Limit buffer size to prevent memory issues
      if (this.pendingLogMessages.length > 1000) {
        console.warn('[DEBUG LOGGER] Pending message buffer full, dropping oldest messages');
        this.pendingLogMessages.splice(0, 100); // Remove oldest 100 messages
      }
    }
  }

  /**
   * Flush pending messages that were buffered during log file initialization
   * RACE CONDITION FIX: Called once log file is ready
   */
  private flushPendingMessages(): void {
    if (this.pendingLogMessages.length > 0) {
      this.logConsoleMessage(
        `[DEBUG LOGGER] 🚀 Flushing ${this.pendingLogMessages.length} pending messages to log file`
      );

      // Add all pending messages to the write buffer
      this.writeBuffer.push(...this.pendingLogMessages);

      // Clear the pending buffer
      this.pendingLogMessages = [];

      // Force immediate flush of the write buffer
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
          console.error('[DEBUG LOGGER] Failed to write to log file:', err);
          // Could implement disk full handling here
        } else {
          this.logConsoleMessage(`[DEBUG LOGGER] Flushed ${data.length} bytes to log file`);
        }
      });
    } else if (this.writeBuffer.length > 0) {
      console.warn('[DEBUG LOGGER] flushWriteBuffer called but logFile is null or not writable');
    }
  }

  /**
   * Log a serial message from P2 hardware (public interface for mainWindow)
   * This is for SERIAL DATA ONLY - not for application diagnostic messages
   */
  public logSerialMessage(message: string): void {
    // Determine message type based on content
    let messageType = 'cog-message';

    // Check if it's binary hex data
    if (message.startsWith('Cog') && message.includes('0x')) {
      messageType = 'binary-message';
    } else if (message.startsWith('[P2 Binary Data')) {
      messageType = 'binary-message';
    }

    this.appendMessage(message, messageType);
    this.writeToLog(message);
  }

  /**
   * Log a system message (different styling)
   */
  public logSystemMessage(message: string): void {
    this.appendMessage(message, 'system-message');
    // A system/diagnostic message is a DISCRETE, complete event — write it as its own
    // timestamped line via writeLogEntry. Do NOT route it through writeToLog: that is the
    // serial-stream line-accumulator (it reassembles the streamed P2 serial data across
    // chunks and only flushes on a '\n'). System messages carry no trailing newline, so
    // routing them there made every [SYSTEM]/[DEBUGGER]/[CTRL] event pile onto ONE physical
    // line until a serial newline finally flushed the whole blob (fixed 2026-07-17).
    this.writeLogEntry(`[SYSTEM] ${message}`);
  }

  /**
   * Change the theme
   */
  public setTheme(themeName: 'green' | 'amber'): void {
    this.theme = LoggerWindow.THEMES[themeName] || LoggerWindow.THEMES.green;

    // Only send theme if renderer is ready, otherwise it will be sent when renderer becomes ready
    if (this.debugWindow && !this.debugWindow.isDestroyed() && this.rendererReady) {
      this.debugWindow.webContents.send('set-theme', this.theme);
    }
    // If renderer not ready, theme is stored in this.theme and will be applied via CSS when HTML loads
  }

  /**
   * Update COGs showing state (for button sync)
   */
  public updateCOGsState(showing: boolean): void {
    this.cogsAreShowing = showing;

    // Update the button in the renderer
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send('cogs-state-changed', showing);
    }
  }

  /**
   * Clear the output
   */
  public clearOutput(): void {
    // The viewer can be closed while logging continues, and the reference outlives the
    // window (see the 'close' handler) — so isDestroyed() must be checked, not just null.
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send('clear-output');
    }
    this.lineBuffer = [];
    this.renderQueue = []; // Clear pending messages to prevent them showing after reset

    // Write separator in log file only if stream is still writable
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      this.logFile.write(`\n=== Output Cleared at ${getFormattedDateTimeISO()} ===\n\n`);
    }
  }

  /**
   * Handle DTR reset - close current log and start new one
   */
  public handleDTRReset(): void {
    // CRITICAL: Process any pending messages in render queue BEFORE clearing
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.renderQueue.length > 0) {
      this.processBatch(); // Send pending messages to display NOW
    }

    // Step 1: Flush write buffer to old log file
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flushWriteBuffer();

    // Step 2: Close current log file with proper cleanup
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      // Write session end message to old log
      this.logFile.write(`\n=== Session ended due to DTR Reset at ${getFormattedDateTimeISO()} ===\n`);

      // End the old log file and wait for it to close
      const oldLogFile = this.logFile;
      this.logFile = null; // Clear reference immediately to prevent new writes
      this.logFileReady = false; // Block new writes

      oldLogFile.end(() => {
        // Callback when old file is fully closed
        this.logConsoleMessage('[DEBUG LOGGER] Old log file closed after DTR reset');

        // Step 3: Clear both buffers AFTER old file is closed
        this.writeBuffer = [];
        this.pendingLogMessages = [];

        // Step 4: Clear the display
        this.clearOutput();

        // Step 5: Create new log file
        this.initializeLogFile();

        // Step 6: Update status bar with new filename
        this.updateStatusBar();

        // Step 7: Log system message to NEW log file
        this.logSystemMessage('New session started due to DTR Reset');
      });
    } else {
      // No log file to close, just reset state
      this.writeBuffer = [];
      this.pendingLogMessages = [];
      this.logFileReady = false;
      this.clearOutput();
      this.initializeLogFile();
      this.updateStatusBar();
      this.logSystemMessage('New session started due to DTR Reset');
    }
  }

  /**
   * Handle RTS reset - close current log and start new one
   */
  public handleRTSReset(): void {
    // CRITICAL: Process any pending messages in render queue BEFORE clearing
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.renderQueue.length > 0) {
      this.processBatch(); // Send pending messages to display NOW
    }

    // Step 1: Flush write buffer to old log file
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flushWriteBuffer();

    // Step 2: Close current log file with proper cleanup
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      // Write session end message to old log
      this.logFile.write(`\n=== Session ended due to RTS Reset at ${getFormattedDateTimeISO()} ===\n`);

      // End the old log file and wait for it to close
      const oldLogFile = this.logFile;
      this.logFile = null; // Clear reference immediately to prevent new writes
      this.logFileReady = false; // Block new writes

      oldLogFile.end(() => {
        // Callback when old file is fully closed
        this.logConsoleMessage('[DEBUG LOGGER] Old log file closed after RTS reset');

        // Step 3: Clear both buffers AFTER old file is closed
        this.writeBuffer = [];
        this.pendingLogMessages = [];

        // Step 4: Clear the display
        this.clearOutput();

        // Step 5: Create new log file
        this.initializeLogFile();

        // Step 6: Update status bar with new filename
        this.updateStatusBar();

        // Step 7: Log system message to NEW log file
        this.logSystemMessage('New session started due to RTS Reset');
      });
    } else {
      // No log file to close, just reset state
      this.writeBuffer = [];
      this.pendingLogMessages = [];
      this.logFileReady = false;
      this.clearOutput();
      this.initializeLogFile();
      this.updateStatusBar();
      this.logSystemMessage('New session started due to RTS Reset');
    }
  }

  /**
   * Handle download start - close current log and start new one for download session
   */
  public handleDownloadStart(): void {
    // CRITICAL: Process any pending messages in render queue BEFORE clearing
    // This ensures pre-download messages (like "Cog0 INIT") get displayed
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.renderQueue.length > 0) {
      this.logConsoleMessage(`[DEBUG LOGGER] Processing ${this.renderQueue.length} pending messages before download`);
      this.processBatch(); // Send pending messages to display NOW
    }

    // Step 1: Flush write buffer to old log file
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flushWriteBuffer();

    // Step 2: Close current log file with proper cleanup
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      // Write session end message to old log
      this.logFile.write(`\n=== Session ended - Download Started at ${getFormattedDateTimeISO()} ===\n`);

      // End the old log file and wait for it to close
      const oldLogFile = this.logFile;
      this.logFile = null; // Clear reference immediately to prevent new writes
      this.logFileReady = false; // Block new writes

      oldLogFile.end(() => {
        // Callback when old file is fully closed
        this.logConsoleMessage('[DEBUG LOGGER] Old log file closed after download start');

        // Step 3: Clear both buffers AFTER old file is closed
        this.writeBuffer = [];
        this.pendingLogMessages = [];

        // Step 4: Clear the display
        this.clearOutput();

        // Step 5: Create new log file
        this.initializeLogFile();

        // Step 6: Update status bar with new filename
        this.updateStatusBar();

        // Step 7: Log system message to NEW log file
        this.logSystemMessage('Download Session Started');
      });
    } else {
      // No log file to close, just reset state
      this.writeBuffer = [];
      this.pendingLogMessages = [];
      this.logFileReady = false;
      this.clearOutput();
      this.initializeLogFile();
      this.updateStatusBar();
      this.logSystemMessage('Download Session Started');
    }
  }

  /**
   * Close the window and cleanup
   */
  public closeDebugWindow(): void {
    this.logConsoleMessage('[DEBUG LOGGER] Closing window and terminating log...');

    // This is the TERMINATION path (app shutdown / session reset) — unlike the viewer's
    // own close button, it really does end the log.
    this.viewerOpen = false;
    if (this.statusBarTimer) {
      clearTimeout(this.statusBarTimer);
      this.statusBarTimer = null;
    }

    // Flush any pending messages — ALL of them, not one batch's worth.
    this.drainDisplayQueue();

    // Flush any partial line waiting for more data
    this.flushLogLineAccumulator();

    // Flush any pending writes
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.flushWriteBuffer();
    }

    // Close log file
    if (this.logFile && !this.logFile.destroyed && this.logFile.writable) {
      this.logFile.write(`\n=== Debug Logger Session Ended at ${getFormattedDateTimeISO()} ===\n`);
      this.logFile.end();
      this.logFile = null;
      this.logConsoleMessage('[DEBUG LOGGER] Log file closed');
    }

    // Clear singleton instance
    LoggerWindow.instance = null;

    // Clean up the window - check if it's destroyed first
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
      this.debugWindow = null;
    }

    this.logConsoleMessage('[DEBUG LOGGER] Window closed and log terminated');
  }

  /**
   * Get current log file path
   */
  public getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /**
   * Three-tier data classification for display decisions.
   *
   * Returns:
   *   'ascii'     - Pure printable ASCII (0x20-0x7E) plus CR/LF only
   *   'ascii-pst' - Printable ASCII mixed with valid PST control codes (0x01-0x10).
   *                 Parameter bytes following multi-byte PST commands (0x02: 2 params,
   *                 0x0E/0x0F: 1 param each) are skipped — they can be any value 0x00-0xFF.
   *   'binary'    - Contains bytes that are neither printable ASCII nor valid PST sequences
   *                 (0x00, 0x11-0x1F, 0x7F, 0x80-0xFF outside of PST parameter positions)
   */
  private classifyData(data: Uint8Array): 'ascii' | 'ascii-pst' | 'binary' {
    let hasPST = false;

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      // Printable ASCII — always OK
      if (byte >= 0x20 && byte <= 0x7E) {
        continue;
      }

      // NUL (0x00) — ignored by real terminals, not binary data
      if (byte === 0x00) {
        hasPST = true; // flag as non-pure-ASCII
        continue;
      }

      // CR / LF are LINE TERMINATORS, not PST content worth visualizing.
      //
      // They sit inside the 0x01-0x10 PST range, so flagging them here marked EVERY ordinary
      // text line as 'ascii-pst'. That sent plain output through formatPSTControlCodes(), which
      // rewrote its line endings as the literal text "<CR><LF>" — after which writeToLog() could
      // never find a real '\n' to split on, its accumulator grew without bound, and each arriving
      // chunk rescanned the whole thing (quadratic work on the main process). A 22-second 2 Mbaud
      // capture froze the UI for ~4 minutes and landed in the log as ONE 4.7 MB line. Treating
      // them as ordinary text keeps real line breaks intact all the way to the file.
      // A message carrying a GENUINE PST code (POS/CLS/SETX/...) still classifies as 'ascii-pst'
      // and still renders visibly — only the line terminators stop being "content".
      if (byte === 0x0a || byte === 0x0d) {
        continue;
      }

      // PST control codes 0x01-0x10 — OK, but flag as PST content
      if (byte >= 0x01 && byte <= 0x10) {
        hasPST = true;

        // Skip parameter bytes for multi-byte PST commands
        if (byte === 0x02) {
          // POS: 2 parameter bytes (x, y) — can be any value
          i += 2;
        } else if (byte === 0x0E || byte === 0x0F) {
          // SETX / SETY: 1 parameter byte — can be any value
          i += 1;
        }
        continue;
      }

      // Anything else is true binary
      return 'binary';
    }

    return hasPST ? 'ascii-pst' : 'ascii';
  }

  /**
   * Format PST control codes as readable symbols for logging
   * Converts binary control codes to human-readable notation
   *
   * Single-byte codes: 0x01=<HOME>, 0x03-0x06=cursor, 0x08=<BS>, 0x09=<TAB>,
   *                    0x0A=<LF>, 0x0B=<CLEOL>, 0x0C=<CLBELOW>, 0x0D=<CR>, 0x10=<CLS>
   * Multi-byte codes:  0x02,x,y=<POS:x,y>, 0x0E,x=<SETX:x>, 0x0F,y=<SETY:y>
   */
  private formatPSTControlCodes(data: Uint8Array): string {
    const chars: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      switch (byte) {
        case 0x00:
          // NUL — silently discard (ignored by real terminals)
          break;
        case 0x01:
          chars.push('<HOME>');
          break;
        case 0x02: // Position: read x,y parameters
          if (i + 2 < data.length) {
            chars.push(`<POS:${data[i+1]},${data[i+2]}>`);
            i += 2; // Skip parameter bytes
          } else {
            chars.push('<POS:incomplete>');
          }
          break;
        case 0x03:
          chars.push('<LEFT>');
          break;
        case 0x04:
          chars.push('<RIGHT>');
          break;
        case 0x05:
          chars.push('<UP>');
          break;
        case 0x06:
          chars.push('<DOWN>');
          break;
        case 0x07:
          chars.push('<BELL>');
          break;
        case 0x08:
          chars.push('<BS>');
          break;
        case 0x09:
          chars.push('<TAB>');
          break;
        case 0x0A:
          chars.push('<LF>');
          break;
        case 0x0B:
          chars.push('<CLEOL>');
          break;
        case 0x0C:
          chars.push('<CLBELOW>');
          break;
        case 0x0D:
          chars.push('<CR>');
          break;
        case 0x0E: // Set X: read x parameter
          if (i + 1 < data.length) {
            chars.push(`<SETX:${data[i+1]}>`);
            i += 1;
          } else {
            chars.push('<SETX:incomplete>');
          }
          break;
        case 0x0F: // Set Y: read y parameter
          if (i + 1 < data.length) {
            chars.push(`<SETY:${data[i+1]}>`);
            i += 1;
          } else {
            chars.push('<SETY:incomplete>');
          }
          break;
        case 0x10:
          chars.push('<CLS>');
          break;
        default:
          // Printable ASCII or other
          if (byte >= 32 && byte <= 126) {
            chars.push(String.fromCharCode(byte));
          } else {
            // Unknown control code - show as hex
            chars.push(`<0x${byte.toString(16).padStart(2, '0').toUpperCase()}>`);
          }
      }
    }

    return chars.join('');
  }

  /**
   * Format debugger messages (416-byte packets showing only 40-byte status block)
   * Format: 'Cog N' header followed by 32 bytes per line, no ASCII interpretation
   * Groups of 8 bytes separated by single space, groups of 16 by double space
   * 3-digit hex offsets at line start
   * For 416-byte packets: Shows first 40 bytes (status block) then "... [376 more bytes]"
   */
  private formatDebuggerMessage(data: Uint8Array): string {
    if (data.length === 0) return 'Cog ? (empty debugger message)';

    const firstByte = data[0];
    const cogId = firstByte <= 0x07 ? firstByte : -1;
    const lines: string[] = [];

    const prefix = cogId >= 0 ? `Cog ${cogId}:` : `INVALID(0x${firstByte.toString(16).toUpperCase()}):`;

    // Add header line
    lines.push(prefix);

    const bytesPerLine = 32;

    // For 416-byte packets, only show first 40 bytes (status block)
    const bytesToShow = data.length === 416 ? 40 : data.length;

    // Process in groups of 32 bytes per line
    for (let offset = 0; offset < bytesToShow; offset += bytesPerLine) {
      const lineLongs: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, bytesToShow);

      // Build hex representation as 32-bit longs with proper spacing
      for (let i = offset; i < endOffset; i += 4) {
        // Combine four bytes into a 32-bit long (byte order 0,1,2,3 as they appear)
        if (i + 3 < bytesToShow) {
          // Full 4 bytes available
          const byte0 = data[i].toString(16).padStart(2, '0').toUpperCase();
          const byte1 = data[i + 1].toString(16).padStart(2, '0').toUpperCase();
          const byte2 = data[i + 2].toString(16).padStart(2, '0').toUpperCase();
          const byte3 = data[i + 3].toString(16).padStart(2, '0').toUpperCase();
          lineLongs.push(`$${byte0}${byte1}${byte2}${byte3}`);
        } else {
          // Handle partial bytes at end
          let hex = '';
          for (let j = i; j < Math.min(i + 4, bytesToShow); j++) {
            hex += data[j].toString(16).padStart(2, '0').toUpperCase();
          }
          lineLongs.push(`$${hex}`);
        }

        // Add spacing after groups (counting longs, not bytes)
        const longPos = (i - offset) / 4;
        if (longPos === 1 && i + 4 < endOffset) {
          lineLongs.push(' '); // Single space after 8 bytes (2 longs)
        } else if (longPos === 3 && i + 4 < endOffset) {
          lineLongs.push('  '); // Double space after 16 bytes (4 longs)
        } else if (longPos === 5 && i + 4 < endOffset) {
          lineLongs.push(' '); // Single space after 24 bytes (6 longs)
        }
        // Note: 32-byte boundary would need triple space but we're at line end
      }

      // Format with 3-digit hex offset: "000: $XXXXXXXX $XXXXXXXX ..."
      const offsetStr = offset.toString(16).padStart(3, '0').toUpperCase();
      const hexPart = lineLongs.join(' ');
      const formattedLine = `  ${offsetStr}: ${hexPart}`;

      lines.push(formattedLine);
    }

    // Add indicator for 416-byte packets that we're only showing the status block
    if (data.length === 416) {
      lines.push(`  ... [${data.length - bytesToShow} more bytes]`);
    }

    return lines.join('\n');
  }

  /**
   * Format other binary data with hex dump and ASCII interpretation
   * Format: 16 bytes per line with ASCII sidebar
   * Used for non-debugger binary messages
   */
  private formatBinaryWithAscii(data: Uint8Array): string {
    if (data.length === 0) return '(empty binary data)';

    const lines: string[] = [];
    const bytesPerLine = 16;

    // Process in groups of 16 bytes per line with hex + ASCII display
    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes: string[] = [];
      const asciiBytes: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, data.length);

      // Build hex representation with proper spacing
      for (let i = offset; i < endOffset; i++) {
        const hex = data[i].toString(16).padStart(2, '0').toUpperCase();
        lineBytes.push(`$${hex}`);

        // Build ASCII representation
        const byte = data[i];
        if (byte >= 32 && byte <= 126) {
          asciiBytes.push(String.fromCharCode(byte));
        } else {
          asciiBytes.push('.');
        }

        // Add extra space after 8 bytes for readability
        if (i - offset === 7 && i + 1 < endOffset) {
          lineBytes.push(' '); // Extra space between groups of 8
        }
      }

      // Pad hex display to consistent width (for alignment)
      const hexWidth = 51; // Width for 16 bytes: "$XX $XX ... $XX  $XX $XX ... $XX"
      const hexPart = lineBytes.join(' ');
      const paddedHexPart = hexPart.padEnd(hexWidth);

      // Pad ASCII to 16 characters
      while (asciiBytes.length < bytesPerLine) {
        asciiBytes.push(' ');
      }

      // Format: "  XXXX: $XX $XX ... $XX  |ASCII_CHARS|"
      const offsetStr = offset.toString(16).padStart(4, '0').toUpperCase();
      const asciiPart = asciiBytes.join('');
      const formattedLine = `  ${offsetStr}: ${paddedHexPart} |${asciiPart}|`;

      lines.push(formattedLine);
    }

    return lines.join('\n');
  }

  /**
   * Format binary data as hex fallback (when misclassified as terminal)
   */
  private formatBinaryAsHexFallback(data: Uint8Array): string {
    if (data.length === 0) return '[BINARY: empty]';

    // Use standard hex display with ASCII interpretation
    const lines: string[] = [];
    const bytesPerLine = 16;

    lines.push(`[BINARY DATA: ${data.length} bytes - displaying as hex]`);

    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes: string[] = [];
      const asciiBytes: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, data.length);

      // Hex representation
      for (let i = offset; i < endOffset; i++) {
        const hex = data[i].toString(16).padStart(2, '0').toUpperCase();
        lineBytes.push(hex);

        // ASCII interpretation
        const byte = data[i];
        if (byte >= 32 && byte <= 126) {
          asciiBytes.push(String.fromCharCode(byte));
        } else {
          asciiBytes.push('.');
        }
      }

      // Add padding for hex display alignment
      while (lineBytes.length < bytesPerLine) {
        lineBytes.push('  ');
        asciiBytes.push(' ');
      }

      const hexPart = lineBytes.join(' ');
      const asciiPart = asciiBytes.join('');
      const offsetStr = offset.toString(16).padStart(4, '0').toUpperCase();

      lines.push(`  ${offsetStr}: ${hexPart}  |${asciiPart}|`);
    }

    return lines.join('\n');
  }

  /**
   * Format binary data as hex dump with Spin-2 notation (legacy method)
   * Format: "Cog N $xx $xx $xx $xx $xx $xx $xx $xx  $xx $xx $xx $xx $xx $xx $xx $xx"
   * Subsequent lines are indented to align with hex data
   */
  private formatBinaryAsHex(data: Uint8Array): string {
    if (data.length === 0) return 'Cog ? (empty message)';

    // First byte IS the COG ID (no masking needed for valid P2 debugger protocol)
    const firstByte = data[0];
    const cogId = firstByte <= 0x07 ? firstByte : -1; // -1 indicates invalid COG ID
    const lines: string[] = [];
    const bytesPerLine = 16;

    // Show warning for invalid COG IDs
    const prefix = cogId >= 0 ? `Cog ${cogId} ` : `INVALID(0x${firstByte.toString(16).toUpperCase()}) `;
    const indent = ' '.repeat(prefix.length);

    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes: string[] = [];
      const endOffset = Math.min(offset + bytesPerLine, data.length);

      // Format each byte as $xx
      for (let i = offset; i < endOffset; i++) {
        const hex = data[i].toString(16).padStart(2, '0').toUpperCase();
        lineBytes.push(`$${hex}`);

        // Add double space after 8 bytes (except at end of line)
        if (i - offset === 7 && i + 1 < endOffset) {
          lineBytes.push(' '); // Extra space for group separator
        }
      }

      // First line gets the Cog prefix, others get indent
      const linePrefix = offset === 0 ? prefix : indent;
      lines.push(linePrefix + lineBytes.join(' '));
    }

    return lines.join('\n');
  }

  /**
   * Get buffered lines for testing
   */
  public getBufferedLines(): string[] {
    return [...this.lineBuffer];
  }

  /**
   * Set performance monitor for warnings
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;

    // Listen for performance threshold events
    monitor.on('threshold', (alert) => {
      this.handlePerformanceThreshold(alert);
    });
  }

  /**
   * Handle performance threshold alerts
   */
  private handlePerformanceThreshold(alert: any): void {
    const now = Date.now();
    const alertKey = `${alert.type}_${alert.component || 'general'}`;

    // Check rate limiting
    const lastWarningTime = this.warningRateLimiter.get(alertKey) || 0;
    if (now - lastWarningTime < this.WARNING_COOLDOWN_MS) {
      return; // Skip this warning due to rate limiting
    }

    this.warningRateLimiter.set(alertKey, now);

    let level: 'WARN' | 'CRITICAL' | 'ERROR' = 'WARN';
    let message = '';

    switch (alert.type) {
      case 'buffer':
        const usage = alert.usagePercent || alert.details?.usagePercent;
        if (usage >= 95) {
          level = 'CRITICAL';
          message = `[PERF_CRITICAL] Buffer ${usage.toFixed(1)}% full, data loss imminent`;
        } else if (usage >= 80) {
          level = 'WARN';
          message = `[PERF_WARN] Buffer usage ${usage.toFixed(1)}% exceeds threshold`;
        }
        break;

      case 'queue':
        const depth = alert.depth || alert.details?.depth;
        const name = alert.name || alert.component || 'unknown';
        if (depth >= 1000) {
          level = 'CRITICAL';
          message = `[PERF_CRITICAL] Queue '${name}' depth ${depth} indicates processing lag`;
        } else {
          level = 'WARN';
          message = `[PERF_WARN] Queue '${name}' depth ${depth} exceeds threshold`;
        }
        break;

      case 'latency':
        const latency = alert.latencyMs || alert.details?.latencyMs;
        if (latency >= 500) {
          level = 'CRITICAL';
          message = `[PERF_CRITICAL] Processing latency ${latency}ms causes real-time loss`;
        } else {
          level = 'WARN';
          message = `[PERF_WARN] Processing latency ${latency}ms exceeds threshold`;
        }
        break;

      default:
        message = `[PERF_WARN] Performance threshold exceeded: ${JSON.stringify(alert)}`;
    }

    // Add context and recommendations
    message += this.getPerformanceRecommendations(alert.type, alert);

    // Log the warning
    this.logPerformanceWarning(level, message, alert);
  }

  /**
   * Log a performance warning with proper formatting
   */
  public logPerformanceWarning(
    level: 'WARN' | 'CRITICAL' | 'ERROR' | 'RECOVERY',
    message: string,
    details?: any
  ): void {
    const warning: PerformanceWarning = {
      timestamp: Date.now(),
      level,
      message,
      details
    };

    // Add to history (circular buffer)
    this.warningHistory.push(warning);
    if (this.warningHistory.length > this.MAX_WARNING_HISTORY) {
      this.warningHistory.shift();
    }

    // Format for display
    const formattedMessage = `${message}`;

    // Use appropriate styling based on level
    let messageType = 'system-message';
    if (level === 'CRITICAL' || level === 'ERROR') {
      messageType = 'error-message';
    }

    this.appendMessage(formattedMessage, messageType);
    this.writeToLog(`[${level}] ${message}`);
  }

  /**
   * Log data rate warning
   */
  public logDataRateWarning(currentRate: number, sustainableRate: number): void {
    const message = `[PERF_WARN] Data rate ${(currentRate / 1024 / 1024).toFixed(1)}Mbps exceeds sustainable rate ${(
      sustainableRate /
      1024 /
      1024
    ).toFixed(1)}Mbps`;
    this.logPerformanceWarning('WARN', message, { currentRate, sustainableRate });
  }

  /**
   * Log dropped bytes warning
   */
  public logDroppedBytesWarning(droppedCount: number, timeWindowMs: number = 1000): void {
    const level = droppedCount > 1000 ? 'ERROR' : 'CRITICAL';
    const message = `[PERF_${level}] Dropped ${droppedCount.toLocaleString()} bytes in last ${timeWindowMs}ms`;
    this.logPerformanceWarning(level, message, { droppedCount, timeWindowMs });
  }

  /**
   * Log recovery message when conditions improve
   */
  public logPerformanceRecovery(metric: string, currentValue: number, threshold: number): void {
    const message = `[PERF_RECOVERY] ${metric} recovered: ${currentValue} below threshold ${threshold}`;
    this.logPerformanceWarning('RECOVERY', message, { metric, currentValue, threshold });
  }

  /**
   * Get performance recommendations based on alert type
   */
  private getPerformanceRecommendations(alertType: string, alert: any): string {
    const recommendations = [];

    switch (alertType) {
      case 'buffer':
        recommendations.push('Consider: reduce baud rate');
        recommendations.push('close unused windows');
        recommendations.push('enable emergency mode');
        break;

      case 'queue':
        recommendations.push('Consider: reduce message volume');
        recommendations.push('check for blocking operations');
        break;

      case 'latency':
        recommendations.push('Consider: reduce UI update frequency');
        recommendations.push('disable non-essential features');
        break;
    }

    return recommendations.length > 0 ? ` (${recommendations.join(', ')})` : '';
  }

  /**
   * Get recent performance warnings for diagnostics
   */
  public getWarningHistory(limit: number = 50): PerformanceWarning[] {
    return this.warningHistory.slice(-limit);
  }

  /**
   * Clear warning history
   */
  public clearWarningHistory(): void {
    this.warningHistory = [];
    this.warningRateLimiter.clear();
  }

  /**
   * Send EVERY queued display line to the renderer now, instead of the single
   * BATCH_SIZE_LIMIT-sized batch processBatch() moves per call.
   *
   * WHY: processBatch() sends at most BATCH_SIZE_LIMIT lines and then re-arms
   * batchTimer for the remainder. That is exactly right while the app is running —
   * it is what caps painting at 60fps and keeps the display rate decoupled from the
   * arrival rate (invariant I3). It is exactly wrong on the way out: at shutdown the
   * timer it re-arms never gets to fire, so a single call silently stranded
   * everything past the first hundred lines.
   *
   * Bounded by construction: each pass removes at least one batch from renderQueue
   * and nothing refills it here, so this terminates. The iteration cap is a
   * backstop against a future refill path, not the mechanism.
   */
  private drainDisplayQueue(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    let passes = 0;
    const maxPasses = Math.ceil(LoggerWindow.MAX_DISPLAY_BACKLOG / this.BATCH_SIZE_LIMIT) + 10;
    while (this.renderQueue.length > 0 && passes < maxPasses) {
      const before = this.renderQueue.length;
      this.processBatch();
      passes++;
      if (this.renderQueue.length >= before) break; // made no progress (e.g. renderer gone)
    }
    // processBatch() re-arms the timer whenever it leaves anything behind; on the
    // shutdown path that timer will never fire, so do not leave it pending.
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Shutdown-facing: make the final lines actually APPEAR before the window closes.
   *
   * The base implementation awaits `renderChain`, which this window never uses — its
   * output lives in renderQueue (main) and pendingLines (renderer), neither of which
   * the base class can see. So without this override the shutdown drain walked right
   * past the log: gracefulShutdown() awaited drainPendingData(), got an immediate
   * resolve, and then closed a window whose last lines had never been sent, let alone
   * painted.
   *
   * Two steps, because there are two queues: push everything over IPC, then have the
   * renderer paint it synchronously rather than waiting for an animation frame. The
   * frame matters — rAF is throttled or suspended outright on an occluded window, so
   * waiting for one at shutdown is exactly the hang this project already hit once with
   * SPECTRO's SAVE. `__flushPaint` paints inline instead, and the whole round-trip is
   * raced against a timeout so a torn-down renderer cannot stall the exit.
   */
  public async flushRenders(): Promise<void> {
    this.drainDisplayQueue();

    if (this.debugWindow && !this.debugWindow.isDestroyed() && this.rendererReady) {
      const painted = this.debugWindow.webContents
        .executeJavaScript('window.__flushPaint ? window.__flushPaint() : -1')
        .catch(() => -1);
      const timeout = new Promise<number>((resolve) => setTimeout(() => resolve(-1), 1000));
      const result = await Promise.race([painted, timeout]);
      this.logConsoleMessage(`[DEBUG LOGGER] flushRenders: renderer reports ${result} line(s) on screen`);
    }

    await super.flushRenders();
  }

  /**
   * Update scrollback preference — how many lines the viewer keeps available to
   * scroll back through. Stored as well as sent: the viewer can be closed or not yet
   * created when this arrives, and the value has to survive to the next window.
   */
  public updateScrollbackPreference(lines: number): void {
    // Same clamp the renderer applies, kept here too so the stored value is always
    // the one that will actually take effect.
    this.scrollbackLines = Math.min(Math.max(lines, 100), 10000);
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send('set-scrollback-lines', this.scrollbackLines);
    }
  }
}
