/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';

import { BrowserWindow, NativeImage, desktopCapturer, screen, systemPreferences } from 'electron';
import { Jimp } from 'jimp';
import * as fs from 'fs';
import * as path from 'path';
import EventEmitter from 'events';
import { Context } from '../utils/context';
import { localFSpecForFilename, screenshotFSpecForFilename } from '../utils/files';
import { waitMSec } from '../utils/timerUtils';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { InputForwarder } from './shared/inputForwarder';
import { WindowRouter, WindowHandler } from './shared/windowRouter';
import { ExtractedMessage } from './shared/sharedMessagePool';
import { MessageQueue, BatchedMessageQueue } from './shared/messageQueue';
import { TLongTransmission } from './shared/tLongTransmission';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

// src/classes/debugWindowBase.ts

/**
 * TECH-DEBT: Critical Implementation Requirement - Preserve Unparsed Debug Strings
 *
 * All debug window implementations that extend DebugWindowBase MUST preserve the original
 * unparsed debug command strings for enhanced error logging and debugging support.
 *
 * Requirements:
 * 1. Store the raw, unparsed debug command string before any processing
 * 2. Include this string in all error log messages when parsing fails or invalid values are detected
 * 3. Pass the unparsed string to Logger when reporting warnings about defensive defaults
 *
 * Example implementation pattern:
 * ```typescript
 * protected processMessageImmediate(lineParts: string[]): void {
 *   const unparsedCommand = lineParts.join(' '); // Preserve original command
 *
 *   // ... parsing logic ...
 *
 *   if (isNaN(parsedValue)) {
 *     this.logger.warn(`Debug command parsing error:\n${unparsedCommand}\nInvalid value '${valueStr}' for parameter X, using default: 0`);
 *     parsedValue = 0; // Defensive default
 *   }
 * }
 * ```
 *
 * This requirement is critical for:
 * - Helping users debug their Spin2 DEBUG() statements
 * - Supporting product issues by seeing exact user input
 * - Maintaining consistency across all debug window types
 * - Providing clear error messages that show context
 *
 * TODO: Audit all debug window implementations to ensure compliance
 * TODO: Add unparsedCommand parameter to common error logging methods
 */

export interface Size {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export enum eVertJustification {
  VJ_UNKNOWN = 1,
  VJ_TOP = 3,
  VJ_MIDDLE = 0,
  VJ_BOTTOM = 2
}

export enum eHorizJustification {
  HJ_UNKNOWN = 1,
  HJ_LEFT = 3,
  HJ_CENTER = 0,
  HJ_RIGHT = 2
}

export enum eTextWeight {
  TW_UNKNOWN,
  TW_LIGHT, // 300
  TW_NORMAL, // 400
  TW_BOLD, // 700
  TW_HEAVY // 900
}

export enum ePackedDataMode {
  PDM_UNKNOWN,
  PDM_LONGS_1BIT,
  PDM_LONGS_2BIT,
  PDM_LONGS_4BIT,
  PDM_LONGS_8BIT,
  PDM_LONGS_16BIT,
  PDM_WORDS_1BIT,
  PDM_WORDS_2BIT,
  PDM_WORDS_4BIT,
  PDM_WORDS_8BIT,
  PDM_BYTES_1BIT,
  PDM_BYTES_2BIT,
  PDM_BYTES_4BIT
}

export enum ePackedDataWidth {
  PDW_UNKNOWN,
  PDW_BYTES,
  PDW_WORDS,
  PDW_LONGS
}

export interface PackedDataMode {
  mode: ePackedDataMode;
  bitsPerSample: number;
  valueSize: ePackedDataWidth;
  isAlternate: boolean;
  isSigned: boolean;
}

export interface FontMetrics {
  textSizePts: number;
  charHeight: number;
  charWidth: number;
  lineHeight: number;
  baseline: number;
}

export interface TextStyle {
  vertAlign: eVertJustification;
  horizAlign: eHorizJustification;
  underline: boolean;
  italic: boolean;
  weight: eTextWeight;
  angle: number;
}

export interface WindowColor {
  background: string; // hex string '#RRGGBB'
  grid: string;
}

export abstract class DebugWindowBase extends EventEmitter {
  protected context: Context;
  protected windowLogPrefix: string = '?Base?'; // default if not overridden
  protected isLogging: boolean = false; // WARNING (REMOVE BEFORE FLIGHT)- change to 'false' - disable before commit
  private _debugWindow: BrowserWindow | null = null;
  private _saveInProgress: boolean = false;
  /**
   * In-flight async operations (chiefly SAVE) that must complete before this
   * window is torn down or the app shuts down. Awaiting these prevents
   * truncated bitmap/log output. See flushPending().
   */
  private pendingOps: Set<Promise<unknown>> = new Set();
  private isClosing: boolean = false; // Prevent recursive close handling
  protected inputForwarder: InputForwarder;
  protected wheelTimer: NodeJS.Timeout | null = null;
  protected lastWheelDelta: number = 0;
  protected hideXY: boolean = false; // Suppress coordinate text in cursor (HIDEXY keyword)

  // Window drag tracking (matches Pascal CaptionStr and CaptionPos)
  private captionStr: string = ''; // Original caption without position
  private captionPos: boolean = false; // True when showing position in title
  private moveEndTimer: NodeJS.Timeout | null = null; // Timer to detect end of drag

  // WindowRouter integration
  protected windowRouter: WindowRouter;
  protected windowId: string;
  protected windowType: string;
  private isRegisteredWithRouter: boolean = false;

  // Per-window message queuing to handle window creation delays
  private messageQueue: MessageQueue<any>;
  private isWindowReady: boolean = false;

  // Per-window input state variables for PC_KEY and PC_MOUSE commands
  // These match Pascal's per-window state management
  protected vKeyPress: number = 0; // Stores last keypress value for PC_KEY
  protected vMouseX: number = -1; // Mouse X coordinate (-1 = out of bounds)
  protected vMouseY: number = -1; // Mouse Y coordinate (-1 = out of bounds)
  protected vMouseButtons: {
    // Mouse button states
    left: boolean;
    middle: boolean;
    right: boolean;
  } = { left: false, middle: false, right: false };
  protected vMouseWheel: number = 0; // Mouse wheel delta (cleared after transmission)
  private mouseInputEnabled: boolean = false; // Flag to prevent duplicate mouse input initialization
  private mouseEventHandlersSetup: boolean = false; // Flag to prevent duplicate IPC handler registration

  // TLong transmission utility for P2 communication
  protected tLongTransmitter: TLongTransmission;

  constructor(ctx: Context, windowId: string, windowType: string) {
    super();
    this.context = ctx;
    this.inputForwarder = new InputForwarder();
    this.windowRouter = WindowRouter.getInstance();
    // CASE-INSENSITIVE: Normalize window ID to lowercase for routing
    // while preserving original case in displayName (set by derived classes)
    this.windowId = windowId.toLowerCase();
    this.windowType = windowType;

    // Initialize TLong transmission utility
    this.tLongTransmitter = new TLongTransmission(ctx);

    // Initialize startup message queue
    // Will transition to BatchedMessageQueue when window is ready
    this.messageQueue = new MessageQueue<any>(1000, 5000);

    // Phase 1: Register window instance immediately for early message routing
    this.windowRouter.registerWindowInstance(this.windowId, this.windowType, this);
  }
  // Abstract methods that must be overridden by derived classes
  //abstract createDebugWindow(): void;
  abstract closeDebugWindow(): void;

  /**
   * Get the window title. Must be implemented by derived classes.
   * Used for drag position tracking and window identification.
   */
  abstract get windowTitle(): string;

  /**
   * Process message content immediately. Must be implemented by derived classes.
   * This is called either immediately (if window is ready) or when queued messages are processed.
   * IMPORTANT: This is async to allow LAYER commands to complete before subsequent commands execute.
   */
  protected abstract processMessageImmediate(lineParts: string[] | any): Promise<void>;

  /**
   * Clear the display. Override in derived classes that support clearing.
   * Called when CLEAR command is received.
   * Default implementation logs warning as this indicates a routing error for windows that don't support CLEAR.
   */
  protected clearDisplayContent(): void {
    // Default: This should never be called for windows that don't support CLEAR
    // If it is called, it's likely a routing error
    this.logMessageBase(
      `WARNING: CLEAR command received by ${this.constructor.name} which doesn't support it - possible routing error`
    );
  }

  /**
   * Force an update of the display. Override in derived classes that support updates.
   * Called when UPDATE command is received (when in deferred update mode).
   * Default implementation logs warning as this indicates a routing error for windows that don't support UPDATE.
   */
  protected forceDisplayUpdate(): void {
    // Default: This should never be called for windows that don't support UPDATE
    // If it is called, it's likely a routing error
    this.logMessageBase(
      `WARNING: UPDATE command received by ${this.constructor.name} which doesn't support it - possible routing error`
    );
  }

  /**
   * Reset per-window input state variables.
   * Called on DTR/RTS reset to clear any pending input state matching Pascal behavior.
   * Pascal clears vKeyPress and mouse state when communication is reset.
   */
  protected resetInputState(): void {
    this.vKeyPress = 0;
    this.vMouseX = -1;
    this.vMouseY = -1;
    this.vMouseButtons = { left: false, middle: false, right: false };
    this.vMouseWheel = 0;
    this.logMessageBase('Input state reset (keypress and mouse state cleared)');
  }

  /**
   * Set the serial data transmission callback for TLong communication.
   * This should be called by derived classes or the main window to enable P2 communication.
   */
  public setSerialTransmissionCallback(callback: (data: string | Buffer) => void): void {
    this.tLongTransmitter.setSendCallback(callback);
    this.logMessageBase('TLong serial transmission callback configured');
  }

  /**
   * Handle common commands that all windows should support.
   * Returns true if command was handled, false otherwise.
   *
   * IMPORTANT: Only windows with Pascal equivalents should call this method!
   * Windows without Pascal equivalents (LOGGER, COG, DEBUGGER) handle their
   * own specialized processing and should NOT use common commands.
   *
   * Common commands (from Pascal):
   * - CLEAR: Clear the display
   * - CLOSE: Close the window
   * - UPDATE: Force display update (when in deferred update mode)
   * - SAVE {WINDOW} 'filename': Save bitmap to file
   * - PC_KEY: Enable keyboard input forwarding
   * - PC_MOUSE: Enable mouse input forwarding
   */
  protected async handleCommonCommand(commandParts: string[]): Promise<boolean> {
    if (!commandParts || commandParts.length === 0) {
      return false;
    }

    const command = commandParts[0].toUpperCase();

    switch (command) {
      case 'CLEAR':
        this.logMessageBase('Executing CLEAR command');
        this.clearDisplayContent();
        return true;

      case 'CLOSE':
        this.logMessageBase('Executing CLOSE command');
        // A SAVE may still be in flight (the router dispatches messages
        // fire-and-forget, so SAVE and a following CLOSE can overlap). Wait for
        // it before tearing the window down, or the bitmap is truncated.
        await this.flushPending();
        // Setting debugWindow to null triggers the full close sequence
        this.debugWindow = null;
        return true;

      case 'UPDATE':
        this.logMessageBase('Executing UPDATE command');
        this.forceDisplayUpdate();
        return true;

      case 'SAVE':
        // Handle three Pascal SAVE formats:
        // 1. SAVE 'filename' - save canvas content
        // 2. SAVE WINDOW 'filename' - save desktop window area
        // 3. SAVE l t w h 'filename' - save desktop coordinates

        let saveIndex = 1;
        let saveWindow = false;
        let coordinateMode = false;
        let left = 0,
          top = 0,
          width = 0,
          height = 0;

        // Check for WINDOW modifier
        if (commandParts.length > saveIndex && commandParts[saveIndex].toUpperCase() === 'WINDOW') {
          saveWindow = true;
          saveIndex++;
        }
        // Check for coordinate mode (4 numeric parameters before filename)
        else if (commandParts.length >= 6) {
          // Try to parse 4 coordinate values
          const coords = [];
          let coordIndex = saveIndex;
          for (let i = 0; i < 4; i++) {
            if (coordIndex < commandParts.length) {
              const num = parseInt(commandParts[coordIndex], 10);
              if (!isNaN(num)) {
                coords.push(num);
                coordIndex++;
              } else {
                break;
              }
            }
          }

          if (coords.length === 4) {
            coordinateMode = true;
            [left, top, width, height] = coords;
            saveIndex = coordIndex;
          }
        }

        // Get filename (remove quotes if present, handle multi-word filenames)
        if (commandParts.length > saveIndex) {
          let filename = '';

          // Check if filename starts with a quote
          const firstPart = commandParts[saveIndex];
          if (firstPart.startsWith("'") || firstPart.startsWith('"')) {
            // Handle quoted filename (may span multiple tokens)
            const quoteChar = firstPart[0];
            let parts = [firstPart];
            let endIndex = saveIndex;

            // If first part doesn't end with matching quote, collect more parts
            if (!firstPart.endsWith(quoteChar) || firstPart.length === 1) {
              for (let i = saveIndex + 1; i < commandParts.length; i++) {
                parts.push(commandParts[i]);
                if (commandParts[i].endsWith(quoteChar)) {
                  endIndex = i;
                  break;
                }
              }
            }

            // Join parts and remove quotes
            filename = parts.join(' ');
            if (
              (filename.startsWith("'") && filename.endsWith("'")) ||
              (filename.startsWith('"') && filename.endsWith('"'))
            ) {
              filename = filename.slice(1, -1);
            }
          } else {
            // Unquoted filename - just use the single token
            filename = commandParts[saveIndex];
          }

          // Track each SAVE so a following CLOSE — or an app shutdown — awaits
          // its completion before tearing the window down (no truncated files).
          if (coordinateMode) {
            this.logMessageBase(`Executing SAVE coordinates: ${left},${top},${width},${height} -> ${filename}`);
            await this.trackPending(this.saveDesktopCoordinatesToBMPFilename(left, top, width, height, filename));
          } else if (saveWindow) {
            this.logMessageBase(`Executing SAVE WINDOW: ${filename}`);
            await this.trackPending(this.saveDesktopWindowToBMPFilename(filename));
          } else {
            this.logMessageBase(`Executing SAVE canvas: ${filename}`);
            await this.trackPending(this.saveWindowToBMPFilename(filename));
          }
          return true;
        }
        this.logMessageBase('SAVE command missing filename');
        return false;

      case 'PC_KEY':
        this.logMessageBase('Executing PC_KEY command');
        // Enable keyboard input forwarding (for capturing future keypresses)
        this.enableKeyboardInput();
        // Return current keypress value and clear it (one-shot consumption)
        try {
          this.tLongTransmitter.transmitKeyPress(this.vKeyPress);
          this.logMessageBase(`PC_KEY transmitted keypress: ${this.vKeyPress}`);
          this.vKeyPress = 0; // Clear after transmission (Pascal behavior)
        } catch (error) {
          this.logMessageBase(`PC_KEY transmission error: ${error}`);
        }
        return true;

      case 'PC_MOUSE':
        this.logMessageBase('Executing PC_MOUSE command');
        // Enable mouse input forwarding (for capturing future mouse events)
        // Only initialize once to prevent duplicate handlers and JavaScript redeclaration errors
        if (!this.mouseInputEnabled) {
          this.enableMouseInput();
          this.mouseInputEnabled = true;
        }
        // Return current mouse state and pixel color
        try {
          // Pascal: SendMousePos bounds check (DebugDisplayUnit.pas:3535)
          // if (p.x < 0) or (p.x >= ClientWidth) or (p.y < 0) or (p.y >= ClientHeight)
          const dimensions = this.getCanvasDimensions();

          // DIAGNOSTIC: Log current state before bounds check
          this.logMessageBase(
            `[MOUSE DIAG] PC_MOUSE state: vMouseX=${this.vMouseX}, vMouseY=${this.vMouseY}, dims=${JSON.stringify(
              dimensions
            )}`
          );

          const inBounds = dimensions
            ? this.vMouseX >= 0 &&
              this.vMouseX < dimensions.width &&
              this.vMouseY >= 0 &&
              this.vMouseY < dimensions.height
            : this.vMouseX >= 0 && this.vMouseY >= 0; // Fallback for windows without canvases

          // DIAGNOSTIC: Log bounds check result
          this.logMessageBase(
            `[MOUSE DIAG] Bounds check: inBounds=${inBounds} (lower: x>=${0} y>=${0}, upper: x<${dimensions?.width} y<${
              dimensions?.height
            })`
          );

          if (inBounds) {
            // Pascal: Transform coordinates for transmission (SendMousePos:3550-3554)
            // This happens here, not when capturing, so stored coordinates remain in canvas space
            const transformed = this.transformMouseCoordinates(this.vMouseX, this.vMouseY);

            // Encode mouse position and button state with transformed coordinates
            const positionValue = this.tLongTransmitter.encodeMouseData(
              transformed.x,
              transformed.y,
              this.vMouseButtons.left,
              this.vMouseButtons.middle,
              this.vMouseButtons.right,
              this.vMouseWheel
            );

            // Get pixel color at mouse position (raw client coordinates, matching
            // Pascal Canvas.Pixels[p.x,p.y] sampled BEFORE the wire transform, :3553)
            const colorValue = await this.getPixelColorAt(this.vMouseX, this.vMouseY);

            // Transmit position and color
            this.tLongTransmitter.transmitMouseData(positionValue, colorValue);
            this.logMessageBase(
              `PC_MOUSE transmitted: pos=(${transformed.x},${transformed.y}) buttons=${JSON.stringify(
                this.vMouseButtons
              )} wheel=${this.vMouseWheel} color=0x${colorValue.toString(16)}`
            );

            // Clear wheel delta after transmission (Pascal: DebugDisplayUnit.pas:3568)
            // Pascal clears IMMEDIATELY after every transmission
            this.vMouseWheel = 0;
          } else {
            // Mouse out of bounds - send Pascal's out-of-bounds values
            const outOfBounds = this.tLongTransmitter.createOutOfBoundsMouseData();
            this.tLongTransmitter.transmitMouseData(outOfBounds.position, outOfBounds.color);
            this.logMessageBase(
              `PC_MOUSE transmitted out-of-bounds data (x=${this.vMouseX}, y=${this.vMouseY}, dims=${JSON.stringify(
                dimensions
              )})`
            );
          }
        } catch (error) {
          this.logMessageBase(`PC_MOUSE transmission error: ${error}`);
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * Public method for updating content. Handles queuing if window not ready.
   * Derived classes should NOT override this - override processMessageImmediate instead.
   * IMPORTANT: Now async to maintain message ordering for LAYER commands.
   */
  async updateContent(lineParts: string[] | any): Promise<void> {
    if (this.isWindowReady) {
      // Window is ready, process immediately and await for proper ordering.
      // The router dispatches updateContent fire-and-forget (windowRouter routes
      // to each target window without awaiting/catching the returned promise), so
      // any rejection from message processing surfaces as a process-level
      // *unhandled rejection*. A window can be destroyed mid-message during a
      // download/reboot teardown, making an in-flight window access throw
      // "Object has been destroyed". That race is expected — catch it here at the
      // shared dispatch chokepoint so it can never crash the app.
      try {
        await this.processMessageImmediate(lineParts);
      } catch (error) {
        const windowGone = !this._debugWindow || this._debugWindow.isDestroyed();
        if (windowGone) {
          // Benign teardown race: the window was torn down (e.g. P2 reboot on a
          // download) while a message was in flight. Drop the orphaned message.
          this.logMessageBase(`- Dropped message for ${this.windowType}: window destroyed mid-processing`);
        } else {
          // Genuine processing error — keep it visible (previously hidden behind
          // the router's dropped promise).
          this.logMessageBase(`- ERROR processing message for ${this.windowType}: ${error}`);
        }
      }
    } else {
      // Window not ready yet, queue the message
      const queued = this.messageQueue.enqueue(lineParts);
      if (queued) {
        this.logMessageBase(`- Queued message for ${this.windowType} (${this.messageQueue.size} in queue)`);
      } else {
        this.logMessageBase(`- WARNING: Message queue full for ${this.windowType}, message dropped`);
      }
    }
  }

  static calcMetricsForFontPtSize(fontSize: number, metrics: FontMetrics): void {
    metrics.textSizePts = fontSize;
    metrics.charHeight = Math.round(metrics.textSizePts * 1.333);
    metrics.charWidth = Math.round(metrics.charHeight * 0.6);
    metrics.lineHeight = Math.round(metrics.charHeight * 1.3); // 120%-140% using 130% of text height
    metrics.baseline = Math.round(metrics.charHeight * 0.7 + 0.5); // 20%-30% from bottom (force round up)
  }

  protected set saveInProgress(value: boolean) {
    this._saveInProgress = value;
    this.logMessageBase(`-> saveInProgress=(${value})`);
  }

  protected get saveInProgress(): boolean {
    return this._saveInProgress;
  }

  /**
   * Register an in-flight async op (e.g. a SAVE) so window-close and app
   * shutdown can await its completion before tearing anything down. Returns
   * the original promise so callers still observe its result/rejection.
   */
  protected trackPending<T>(op: Promise<T>): Promise<T> {
    this.pendingOps.add(op);
    // Separate cleanup chain so an op rejection can't become an unhandled
    // rejection here; the caller still awaits the original `op`.
    void Promise.resolve(op)
      .catch(() => undefined)
      .finally(() => this.pendingOps.delete(op));
    return op;
  }

  /** True while any tracked async op (SAVE) is still in flight. */
  public hasPendingOps(): boolean {
    return this.pendingOps.size > 0;
  }

  /**
   * Await all in-flight async ops (SAVEs) for this window, up to `timeoutMs`.
   * Returns true if everything drained, false if the timeout elapsed first
   * (in which case output may be incomplete). Best-effort: precious data is
   * given every chance to finish — we never abort a write early.
   */
  public async flushPending(timeoutMs: number = 10000): Promise<boolean> {
    if (this.pendingOps.size === 0) return true;
    this.logMessageBase(`flushPending: awaiting ${this.pendingOps.size} in-flight op(s) (<= ${timeoutMs}ms)`);
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    const drained = Promise.allSettled([...this.pendingOps]).then(() => true);
    const ok = await Promise.race([drained, timedOut]);
    if (timer) clearTimeout(timer);
    if (!ok) {
      this.logMessageBase(`flushPending: TIMEOUT — ${this.pendingOps.size} op(s) still pending (output may be incomplete)`);
    }
    return ok;
  }

  // Setter for debugWindow property
  protected set debugWindow(window: BrowserWindow | null) {
    if (window != null) {
      this.logMessageBase(`- New ${this.windowType} window: ${this.windowId}`);
      this._debugWindow = window;

      // Increase EventEmitter listener limit for WebContents to prevent memory leak warnings
      // Debug windows register many listeners (did-stop-loading, ipc-message, etc.)
      window.webContents.setMaxListeners(20);

      // Add window drag position tracking (matches Pascal FormMove behavior)
      // Skip for windows that don't support drag: COG, LOGGER, DEBUGGER
      if (this.windowType !== 'cog' && this.windowType !== 'logger' && this.windowType !== 'debugger') {
        // Initialize caption tracking (matches Pascal CaptionStr)
        this.captionStr = this.windowTitle;

        // Handle window move events - update title with position during drag
        // Matches Pascal FormMove procedure (DebugDisplayUnit.pas:864-869)
        window.on('move', () => {
          if (this._debugWindow && !this._debugWindow.isDestroyed()) {
            const bounds = this._debugWindow.getBounds();
            // Update title to show position (matches Pascal: Caption := CaptionStr + ' (' + IntToStr(Left) + ', ' + IntToStr(Top) + ')')
            this._debugWindow.setTitle(`${this.captionStr} (${bounds.x}, ${bounds.y})`);
            this.captionPos = true;

            // Clear any existing timer
            if (this.moveEndTimer) {
              clearTimeout(this.moveEndTimer);
            }

            // Set timer to restore title after drag ends (900ms - gives user time to see position)
            // Timer resets on each move event, so it only fires when dragging stops
            // Matches Pascal's FormPaint restoration behavior
            this.moveEndTimer = setTimeout(() => {
              if (this._debugWindow && !this._debugWindow.isDestroyed() && this.captionPos) {
                // Restore original caption (matches Pascal: Caption := CaptionStr)
                this._debugWindow.setTitle(this.captionStr);
                this.captionPos = false;
              }
              this.moveEndTimer = null;
            }, 900);
          }
        });
      }

      // Add OTHER event listeners as needed
    } else {
      // Prevent recursive close handling
      if (this.isClosing) {
        this.logMessageBase(`- Already closing ${this.windowType} window: ${this.windowId}, preventing recursion`);
        return;
      }
      this.isClosing = true;

      this.logMessageBase(`- Closing ${this.windowType} window: ${this.windowId}`);
      // Reset window ready state and clear any pending messages
      this.isWindowReady = false;

      // Stop batch processing if it's a BatchedMessageQueue
      if (this.messageQueue instanceof BatchedMessageQueue) {
        (this.messageQueue as BatchedMessageQueue<any>).stopBatchProcessing();
      }
      this.messageQueue.clear();
      // Unregister from WindowRouter
      this.unregisterFromRouter();
      // Stop input forwarding
      this.inputForwarder.stopPolling();
      // Clear wheel timer
      if (this.wheelTimer) {
        clearTimeout(this.wheelTimer);
        this.wheelTimer = null;
      }
      // Clear move end timer (window drag tracking)
      if (this.moveEndTimer) {
        clearTimeout(this.moveEndTimer);
        this.moveEndTimer = null;
      }
      // Remove event listeners and close the window
      if (this._debugWindow != null && !this._debugWindow.isDestroyed()) {
        this.logMessageBase(`- ${this.windowType} window closing: ${this.windowId}...`);
        this.emit('close'); // forward the event
        this._debugWindow.removeAllListeners();
        this._debugWindow.close();
        this.logMessageBase(`- ${this.windowType} window closed: ${this.windowId}`);
        this.emit('closed'); // forward the event
      }
      this._debugWindow = null;
      this.isClosing = false;
    }
  }

  // Getter for debugWindow property
  protected get debugWindow(): BrowserWindow | null {
    return this._debugWindow;
  }

  // ----------------------------------------------------------------------
  // WindowRouter integration methods
  // ----------------------------------------------------------------------

  /**
   * Mark window as ready and process any queued messages.
   * Should be called by derived classes when their window is fully initialized.
   * IMPORTANT: Now async to await message processing.
   */
  protected async onWindowReady(): Promise<void> {
    if (this.isWindowReady) {
      this.logMessageBase(`- Window already marked as ready`);
      return;
    }

    this.isWindowReady = true;
    this.logMessageBase(`- Window marked as ready for ${this.windowType}`);

    // Process any queued messages
    if (!this.messageQueue.isEmpty) {
      const stats = this.messageQueue.getStats();
      this.logMessageBase(`- Processing ${stats.currentSize} queued messages`);

      // Process all queued messages SEQUENTIALLY
      // CRITICAL: Await each message to ensure LAYER commands complete before CROP/UPDATE
      const queuedMessages = this.messageQueue.dequeueAll();

      for (const message of queuedMessages) {
        try {
          await this.processMessageImmediate(message);
        } catch (error) {
          this.logMessageBase(`- Error processing queued message: ${error}`);
        }
      }

      // Log stats if there were dropped messages
      if (stats.droppedCount > 0) {
        this.logMessageBase(`- WARNING: ${stats.droppedCount} messages were dropped from queue`);
      }
    }

    // CRITICAL: Use immediate processing to prevent message reordering
    // P2 Architecture Rule: "There should never, never, never be any message reordering"
    this.logMessageBase(`- Transitioning to IMMEDIATE processing (no batching delays)`);
    const oldQueue = this.messageQueue;

    // Use simple MessageQueue for immediate processing (no batching)
    this.messageQueue = new MessageQueue<any>(
      1000, // maxSize: 1000 messages
      5000 // maxAgeMs: 5 second expiry
    );

    // Clean up old startup queue
    oldQueue.clear();
    this.logMessageBase(`- Immediate processing active (zero delay)`);
  }

  /**
   * Register this window with WindowRouter for message routing
   * Should be called when the window is ready to receive messages
   */
  protected registerWithRouter(): void {
    if (!this.isRegisteredWithRouter) {
      try {
        this.windowRouter.registerWindow(this.windowId, this.windowType, this.handleRouterMessage.bind(this));
        this.isRegisteredWithRouter = true;
        this.logMessageBase(`- Registered with WindowRouter: ${this.windowId} (${this.windowType})`);

        // Mark window as ready when registered with router
        this.onWindowReady();
      } catch (error) {
        this.logMessageBase(`- Failed to register with WindowRouter: ${error}`);
      }
    }
  }

  /**
   * Unregister this window from WindowRouter
   * Should be called when window is closing
   */
  protected unregisterFromRouter(): void {
    if (this.isRegisteredWithRouter) {
      this.windowRouter.unregisterWindow(this.windowId);
      this.isRegisteredWithRouter = false;
      this.logMessageBase(`- Unregistered from WindowRouter: ${this.windowId}`);
    }
  }

  /**
   * Handle messages from WindowRouter
   * This method processes both ExtractedMessage objects and raw data
   * Protected to allow subclasses to override (e.g., LoggerWindow)
   */
  protected handleRouterMessage(message: ExtractedMessage | Uint8Array | string): void {
    try {
      if (typeof message === 'string') {
        // Text message - parse and process
        // NOTE: WindowRouter already trims/filters - don't do it again here
        const lineParts = message.split(' ');
        this.updateContent(lineParts);
      } else if (message instanceof Uint8Array) {
        // Binary data - pass through as-is for windows that handle binary
        // DebugLoggerWindow and DebugDebuggerWindow need raw binary
        this.updateContent(message);
      } else if (typeof message === 'object' && message.type && message.data) {
        // ExtractedMessage object - decode Uint8Array to string for text windows
        const text = new TextDecoder().decode(message.data);
        const lineParts = text.split(' ');
        this.updateContent(lineParts);
      }
    } catch (error) {
      this.logMessageBase(`- Error handling router message: ${error}`);
    }
  }

  /**
   * Get window information for WindowRouter
   */
  public getWindowInfo(): { windowId: string; windowType: string; isRegistered: boolean } {
    return {
      windowId: this.windowId,
      windowType: this.windowType,
      isRegistered: this.isRegisteredWithRouter
    };
  }

  // ----------------------------------------------------------------------
  // CLASS (static) methods
  //   NOTE: static since used by derived class static methods

  /**
   * Validate/normalize a NUMERIC rgb24 color value (the "is this a number?" test
   * at directive call sites). Color NAMES are intentionally NOT handled here so
   * callers route them through the RGBI8X directive path (DebugColor) instead of
   * a divergent local name map. Supports hex ($RRGGBB), decimal, binary (%),
   * and quaternary (%%) formats.
   */
  static getValidRgb24(possColorValue: string): [boolean, string] {
    // NUMERIC only. Guard with isNumeric() so color NAMES are NOT matched here
    // (Spin2NumericParser.parseColor has its own divergent named-color table);
    // callers must route names through the RGBI8X directive path (DebugColor).
    if (Spin2NumericParser.isNumeric(possColorValue)) {
      const colorValue = Spin2NumericParser.parseColor(possColorValue);
      if (colorValue !== null) {
        return [true, '#' + ((colorValue >>> 0) & 0xffffff).toString(16).padStart(6, '0').toLowerCase()];
      }
    }
    return [false, '#a5a5a5']; // gray for unknown / non-numeric color
  }

  static calcStyleFrom(
    vJust: eVertJustification,
    hJust: eHorizJustification,
    weight: eTextWeight,
    underline: boolean = false,
    italic: boolean = false
  ): number {
    // build styleStr is now a bitfield string of 8 bits
    // style is %YYXXUIWW:
    //   %YY is vertical justification: %00 = middle, %10 = bottom, %11 = top.
    //   %XX is horizontal justification: %00 = middle, %10 = right, %11 = left.
    //   %U is underline: %1 = underline.
    //   %I is italic: %1 = italic.
    //   %WW is weight: %00 = light, %01 = normal, %10 = bold, and %11 = heavy.
    let styleStr: string = '0b';
    switch (vJust) {
      case eVertJustification.VJ_MIDDLE:
        styleStr += '00';
        break;
      case eVertJustification.VJ_BOTTOM:
        styleStr += '10';
        break;
      case eVertJustification.VJ_TOP:
        styleStr += '11';
        break;
      default:
        styleStr += '00';
        break;
    }
    switch (hJust) {
      case eHorizJustification.HJ_CENTER:
        styleStr += '00';
        break;
      case eHorizJustification.HJ_RIGHT:
        styleStr += '10';
        break;
      case eHorizJustification.HJ_LEFT:
        styleStr += '11';
        break;
      default:
        styleStr += '00';
        break;
    }
    styleStr += underline ? '1' : '0';
    styleStr += italic ? '1' : '0';
    switch (weight) {
      case eTextWeight.TW_LIGHT:
        styleStr += '00';
        break;
      case eTextWeight.TW_NORMAL:
        styleStr += '01';
        break;
      case eTextWeight.TW_BOLD:
        styleStr += '10';
        break;
      case eTextWeight.TW_HEAVY:
        styleStr += '11';
        break;
      default:
        styleStr += '01';
        break;
    }
    // return numeric value of string
    const value: number = Number(styleStr);
    DebugWindowBase.logConsoleMessageStatic(`Win: str=[${styleStr}] -> value=(${value})`);
    return value;
  }

  static calcStyleFromBitfield(style: number, textStyle: TextStyle): void {
    // convert number into a bitfield string
    const styleStr: string = style.toString(2).padStart(8, '0');
    // styleStr is now a bitfield string of 8 bits
    // style is %YYXXUIWW:
    //   %YY is vertical justification: %00 = middle, %10 = bottom, %11 = top.
    //   %XX is horizontal justification: %00 = middle, %10 = right, %11 = left.
    //   %U is underline: %1 = underline.
    //   %I is italic: %1 = italic.
    //   %WW is weight: %00 = light, %01 = normal, %10 = bold, and %11 = heavy.
    if (styleStr.length == 8) {
      textStyle.vertAlign = parseInt(styleStr.substring(0, 2), 2);
      textStyle.horizAlign = parseInt(styleStr.substring(2, 4), 2);
      textStyle.underline = styleStr[4] === '1';
      textStyle.italic = styleStr[5] === '1';
      const weight: number = parseInt(styleStr.substring(6, 8), 2);
      switch (weight) {
        case 0:
          textStyle.weight = eTextWeight.TW_LIGHT;
          break;
        case 1:
          textStyle.weight = eTextWeight.TW_NORMAL;
          break;
        case 2:
          textStyle.weight = eTextWeight.TW_BOLD;
          break;
        case 3:
          textStyle.weight = eTextWeight.TW_HEAVY;
          break;
        default:
          textStyle.weight = eTextWeight.TW_NORMAL;
          break;
      }
    } else {
      DebugWindowBase.logConsoleMessageStatic(
        `Win: ERROR:: Invalid style string(8): [${styleStr}](${styleStr.length})`
      );
    }
    DebugWindowBase.logConsoleMessageStatic(`Win: str=[${styleStr}] -> textStyle: ${JSON.stringify(textStyle)}`);
  }

  // ----------------------------------------------------------------------
  // Window dimension helpers for Chrome adjustments

  /**
   * Calculate window dimensions with adjustments for window chrome (title bar, borders)
   * All debug windows should use this to ensure consistent sizing across the application
   *
   * @param contentWidth - The width of the actual content area
   * @param contentHeight - The height of the actual content area
   * @returns Object with adjusted width and height including chrome
   */
  protected calculateWindowDimensions(contentWidth: number, contentHeight: number): { width: number; height: number } {
    // Standard chrome adjustments based on platform
    // These values match what the Logic window uses and ensures consistency
    const TITLE_BAR_HEIGHT = 40; // Height of the window title bar
    const WINDOW_BORDER_WIDTH = 20; // Additional width for window borders

    return {
      width: contentWidth + WINDOW_BORDER_WIDTH,
      height: contentHeight + TITLE_BAR_HEIGHT
    };
  }

  // ----------------------------------------------------------------------
  // inherited by derived classes

  protected fontWeightName(style: TextStyle): string {
    let weightName: string = 'normal';
    switch (style.weight) {
      case eTextWeight.TW_LIGHT:
        weightName = '300'; // CSS light weight
        break;
      case eTextWeight.TW_NORMAL:
        weightName = 'normal'; // or '400'
        break;
      case eTextWeight.TW_BOLD:
        weightName = 'bold'; // or '700'
        break;
      case eTextWeight.TW_HEAVY:
        weightName = '900'; // CSS heavy/black weight
        break;
    }
    return weightName;
  }

  // MOVED TO PackedDataProcessor class - commented out but not deleted
  /*
  protected isPackedDataMode(possibleMode: string): [boolean, PackedDataMode] {
    let havePackedDataStatus: boolean = false;
    let desiredMode: PackedDataMode = {
      mode: ePackedDataMode.PDM_UNKNOWN,
      bitsPerSample: 0,
      valueSize: ePackedDataWidth.PDW_UNKNOWN,
      isAlternate: false,
      isSigned: false
    };
    // define hash where key is mode string and value is ePackedDataMode
    const modeMap = new Map<string, ePackedDataMode>([
      ['longs_1bit', ePackedDataMode.PDM_LONGS_1BIT],
      ['longs_2bit', ePackedDataMode.PDM_LONGS_2BIT],
      ['longs_4bit', ePackedDataMode.PDM_LONGS_4BIT],
      ['longs_8bit', ePackedDataMode.PDM_LONGS_8BIT],
      ['longs_16bit', ePackedDataMode.PDM_LONGS_16BIT],
      ['words_1bit', ePackedDataMode.PDM_WORDS_1BIT],
      ['words_2bit', ePackedDataMode.PDM_WORDS_2BIT],
      ['words_4bit', ePackedDataMode.PDM_WORDS_4BIT],
      ['words_8bit', ePackedDataMode.PDM_WORDS_8BIT],
      ['bytes_1bit', ePackedDataMode.PDM_BYTES_1BIT],
      ['bytes_2bit', ePackedDataMode.PDM_BYTES_2BIT],
      ['bytes_4bit', ePackedDataMode.PDM_BYTES_4BIT]
    ]);
    // if possible mode matches key in modeMap, then set mode and return true
    if (modeMap.has(possibleMode.toLocaleLowerCase())) {
      desiredMode.mode = modeMap.get(possibleMode.toLocaleLowerCase()) as ePackedDataMode;
      havePackedDataStatus = true;
      // now set our bitsPerSample based on new mode
      switch (desiredMode.mode) {
        case ePackedDataMode.PDM_LONGS_1BIT:
        case ePackedDataMode.PDM_WORDS_1BIT:
        case ePackedDataMode.PDM_BYTES_1BIT:
          desiredMode.bitsPerSample = 1;
          break;
        case ePackedDataMode.PDM_LONGS_2BIT:
        case ePackedDataMode.PDM_WORDS_2BIT:
        case ePackedDataMode.PDM_BYTES_2BIT:
          desiredMode.bitsPerSample = 2;
          break;
        case ePackedDataMode.PDM_LONGS_4BIT:
        case ePackedDataMode.PDM_WORDS_4BIT:
        case ePackedDataMode.PDM_BYTES_4BIT:
          desiredMode.bitsPerSample = 4;
          break;
        case ePackedDataMode.PDM_LONGS_8BIT:
        case ePackedDataMode.PDM_WORDS_8BIT:
          desiredMode.bitsPerSample = 8;
          break;
        case ePackedDataMode.PDM_LONGS_16BIT:
          desiredMode.bitsPerSample = 16;
          break;
        default:
          desiredMode.bitsPerSample = 0;
          break;
      }
      // now set our desiredMode.valueSize based on new mode
      switch (desiredMode.mode) {
        case ePackedDataMode.PDM_LONGS_1BIT:
        case ePackedDataMode.PDM_LONGS_2BIT:
        case ePackedDataMode.PDM_LONGS_4BIT:
        case ePackedDataMode.PDM_LONGS_8BIT:
        case ePackedDataMode.PDM_LONGS_16BIT:
          desiredMode.valueSize = ePackedDataWidth.PDW_LONGS;
          break;
        case ePackedDataMode.PDM_WORDS_1BIT:
        case ePackedDataMode.PDM_WORDS_2BIT:
        case ePackedDataMode.PDM_WORDS_4BIT:
        case ePackedDataMode.PDM_WORDS_8BIT:
          desiredMode.valueSize = ePackedDataWidth.PDW_WORDS;
          break;
        case ePackedDataMode.PDM_BYTES_1BIT:
        case ePackedDataMode.PDM_BYTES_2BIT:
        case ePackedDataMode.PDM_BYTES_4BIT:
          desiredMode.valueSize = ePackedDataWidth.PDW_BYTES;
          break;
        default:
          desiredMode.valueSize = ePackedDataWidth.PDW_UNKNOWN;
          break;
      }
    }
    if (havePackedDataStatus == true) {
      // only log attempt if is valid
      this.logMessageBase(
        `packedDataMode(${possibleMode}): isValid=(${havePackedDataStatus})  -> ${
          (JSON.stringify(desiredMode), null, 2)
        }`
      );
    }
    return [havePackedDataStatus, desiredMode];
  }
  */

  protected signExtend(value: number, signBitNbr: number): number {
    // Create a mask to zero out all bits above the sign bit
    const mask = (1 << (signBitNbr + 1)) - 1;
    value &= mask;

    // Check if the sign bit is set
    const isNegative = (value & (1 << signBitNbr)) !== 0;

    if (isNegative) {
      // If the sign bit is set, convert the value to a negative number
      value = value - (1 << (signBitNbr + 1));
    }

    return value;
  }

  // MOVED TO PackedDataProcessor class - commented out but not deleted
  /*
  protected possiblyUnpackData(numericValue: number, mode: PackedDataMode): number[] {
    const sampleSet: number[] = [];
    // FIXME: add ALT and SIGNED support
    if (mode.mode == ePackedDataMode.PDM_UNKNOWN) {
      sampleSet.push(numericValue);
    } else {
      // unpack the data based on configured mode generating a list of samples
      // we have a single value which according to packed mode we need to unpack
      switch (mode.valueSize) {
        case ePackedDataWidth.PDW_BYTES:
          // we have data as a byte [0-255] 8-bits
          switch (mode.bitsPerSample) {
            case 1:
              // we have data as 8 single bit samples
              // push each bit as a sample from LSB to MSB
              for (let index = 0; index < 8; index++) {
                sampleSet.push((numericValue >> index) & 0x01);
              }
              break;

            case 2:
              // we have data as 4 2-bit samples
              // push each 2bits as a sample from LSB to MSB
              for (let index = 0; index < 4; index++) {
                sampleSet.push((numericValue >> (index * 2)) & 0x03);
              }
              break;

            case 4:
              // we have data as 2 4-bit samples
              // push each 4bits as a sample from LSB to MSB
              for (let index = 0; index < 2; index++) {
                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
              }
              break;

            default:
              break;
          }
          break;

        case ePackedDataWidth.PDW_WORDS:
          // we have data as a word [0-65535] 16-bits
          switch (mode.bitsPerSample) {
            case 1:
              // we have data as 16 single bit samples
              // push each bit as a sample from LSB to MSB
              for (let index = 0; index < 16; index++) {
                sampleSet.push((numericValue >> index) & 0x01);
              }
              break;
            case 2:
              // we have data as 8 2-bit samples
              // push each 2bits as a sample from LSB to MSB
              for (let index = 0; index < 8; index++) {
                sampleSet.push((numericValue >> (index * 2)) & 0x03);
              }
              break;
            case 4:
              // we have data as 4 4-bit samples
              // push each 4bits as a sample from LSB to MSB
              for (let index = 0; index < 4; index++) {
                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
              }
              break;
            case 8:
              // we have data as 2 8-bit samples
              // push each 8bits as a sample from LSB to MSB
              for (let index = 0; index < 2; index++) {
                sampleSet.push((numericValue >> (index * 8)) & 0xff);
              }
              break;

            default:
              break;
          }
          break;

        case ePackedDataWidth.PDW_LONGS:
          // we have data as a long 32-bits
          switch (mode.bitsPerSample) {
            case 1:
              // we have data as 32 single bit samples
              // push each bit as a sample from LSB to MSB
              for (let index = 0; index < 32; index++) {
                sampleSet.push((numericValue >> index) & 0x01);
              }
              break;
            case 2:
              // we have data as 16 2-bit samples
              // push each 2bits as a sample from LSB to MSB
              for (let index = 0; index < 16; index++) {
                sampleSet.push((numericValue >> (index * 2)) & 0x03);
              }
              break;
            case 4:
              // we have data as 8 4-bit samples
              // push each 4bits as a sample from LSB to MSB
              for (let index = 0; index < 8; index++) {
                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
              }
              break;
            case 8:
              // we have data as 4 8-bit samples
              // push each 8bits as a sample from LSB to MSB
              for (let index = 0; index < 4; index++) {
                sampleSet.push((numericValue >> (index * 8)) & 0xff);
              }
              break;
            case 16:
              // we have data as 2 16-bit samples
              // push each 16bits as a sample from LSB to MSB
              for (let index = 0; index < 2; index++) {
                sampleSet.push((numericValue >> (index * 16)) & 0xffff);
              }
              break;
            default:
              break;
          }
          break;

        default:
          break;
      }
      // if SIGNED then sign extend each sample
      if (mode.isSigned) {
        for (let index = 0; index < sampleSet.length; index++) {
          sampleSet[index] = this.signExtend(sampleSet[index], mode.bitsPerSample - 1);
        }
      }
      // if ALT the alternate the samples
      // FIXME: UNDONE add code here to recorder the samples
    }

    // Return the list of samples
    //this.logMessageBase(`unpackData(${numericValue}), -> sampleSet=[${JSON.stringify(sampleSet, null, 2)}]`);
    return sampleSet;
  }
  */

  protected isSpinNumber(value: string): [boolean, number] {
    let isValieSpin2Number: boolean = false;
    let spin2Value: number = 0;
    // all numbers can contain '_' as digit separator
    // NOTE: technically '_' can only be after first digit but this is compiler output we are parsing so
    //   we assume it's correct and ignore this rule
    const spin2ValueStr = value.replace(/_/g, '');
    // check if starts with base-prefix '%' and rest is binary number [0-1]
    if (spin2ValueStr[0] === '%' && /^[01]+$/.test(spin2ValueStr.substring(1))) {
      spin2Value = parseInt(spin2ValueStr.substring(1), 2);
      isValieSpin2Number = true;
    }
    // check if starts with base-prefix '%%' and rest is double-binary number [0-3]
    if (spin2ValueStr.substring(0, 2) === '%%' && /^[0-3]+$/.test(spin2ValueStr.substring(2))) {
      spin2Value = parseInt(spin2ValueStr.substring(2), 4);
      isValieSpin2Number = true;
    }
    // check if starts with base-prefix '$' and rest is hex number [0-9A-Fa-f]
    if (spin2ValueStr[0] === '$' && /^[0-9A-Fa-f]+$/.test(spin2ValueStr.substring(1))) {
      spin2Value = parseInt(spin2ValueStr.substring(1), 16);
      isValieSpin2Number = true;
    }
    // check if NO base-prefix or '.', (may have option leading '-' or '+') and rest is decimal number [0-9]
    if (/^[-+]?[0-9]+$/.test(spin2ValueStr)) {
      spin2Value = parseInt(spin2ValueStr, 10);
      isValieSpin2Number = true;
    }
    // check if value contains '.' or 'e' or 'E' then it is a float number (may have option leading '-' or '+') rest is non[eE.] are decimal digits [0-9]
    if (/^[-+]?[0-9]+[eE.]?[0-9]+$/.test(spin2ValueStr)) {
      spin2Value = parseFloat(spin2ValueStr);
      isValieSpin2Number = true;
    }
    this.logMessageBase(`isSpinNumber(${value}): isValid=(${isValieSpin2Number})  -> (${spin2Value})`);
    return [isValieSpin2Number, spin2Value];
  }

  protected async saveWindowToBMPFilename(filename: string): Promise<void> {
    if (!this._debugWindow) {
      return;
    }
    this.logMessage(`  -- writing canvas BMP to [${filename}]`);
    this.saveInProgress = true;
    try {
      // capturePage() can hand back an EMPTY frame even for a visible, painted
      // window (observed on the small SCOPE_XY window when SAVE fires right
      // after a burst of data). Previously the convert step ran OUTSIDE this
      // try and there was no empty check, so an empty/failed capture threw and
      // the plain SAVE silently produced NO file at all (unlike SAVE WINDOW,
      // which always falls back). Detect the empty frame, give the compositor a
      // beat, and retry once before giving up — and never fail silently.
      let pngBuffer = await this.captureWindowAsPNG(this._debugWindow);
      if ((!pngBuffer || pngBuffer.length === 0) && this._debugWindow && !this._debugWindow.isDestroyed()) {
        this.logMessageBase(`SAVE: empty capturePage frame for [${filename}] — retrying after paint settle`);
        await new Promise((resolve) => setTimeout(resolve, 50));
        pngBuffer = await this.captureWindowAsPNG(this._debugWindow);
      }
      if (!pngBuffer || pngBuffer.length === 0) {
        this.logMessageBase(`SAVE: capturePage returned an empty image — no canvas BMP written for [${filename}]`);
        return;
      }
      const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);
      const outputFSpec = screenshotFSpecForFilename(this.context, filename, '.bmp');
      fs.writeFileSync(outputFSpec, bmpBuffer);
      this.logMessageBase(`- Canvas BMP image [${outputFSpec}] saved successfully`);
      this.context.logger.progressMsg(`File written [${outputFSpec}]`);
    } catch (error) {
      // Keep the failure visible instead of silently producing no file.
      console.error('Win: ERROR: saving canvas BMP image:', error);
      this.logMessageBase(`SAVE: ERROR writing canvas BMP [${filename}]: ${error}`);
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * Save desktop window capture to BMP file matching Pascal's SAVE WINDOW behavior.
   * Captures the entire window including chrome from the desktop at the window's screen position.
   */
  protected async saveDesktopWindowToBMPFilename(filename: string): Promise<void> {
    if (this._debugWindow) {
      this.logMessage(`  -- writing desktop window BMP to [${filename}]`);
      this.saveInProgress = true;

      try {
        // Flush pending renderer draws first — desktopCapturer grabs the on-screen pixels and does
        // NOT wait for fire-and-forget canvas draws, so a heavy window (LOGIC/SPECTRO) would be
        // captured half-drawn. This is why plain SAVE (flushed capturePage) was complete while
        // SAVE WINDOW was missing most of the LOGIC content. [SAVE-vs-async-draw race]
        await this.flushRendererDraws(this._debugWindow);
        // Pascal SAVE WINDOW captures the on-screen window region INCLUDING the
        // native title-bar/chrome. getBounds() returns screen coords with chrome.
        const bounds = this._debugWindow.getBounds();
        let pngBuffer = await this.captureDesktopRegionAsPNG(bounds.x, bounds.y, bounds.width, bounds.height);
        if (!pngBuffer || pngBuffer.length === 0) {
          // Desktop capture unavailable (e.g. macOS Screen Recording permission
          // not yet granted). Fall back to content-only so SAVE WINDOW still
          // produces a file rather than nothing.
          this.logMessageBase('SAVE WINDOW: desktop capture unavailable — falling back to canvas content');
          pngBuffer = await this.captureWindowAsPNG(this._debugWindow);
        }
        const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);
        const outputFSpec = screenshotFSpecForFilename(this.context, filename, '.bmp');
        fs.writeFileSync(outputFSpec, bmpBuffer);
        this.logMessageBase(`- Window BMP image [${outputFSpec}] saved successfully`);
        this.context.logger.progressMsg(`File written [${outputFSpec}]`);
        this.saveInProgress = false;
        return;

        // Original desktop capture code (disabled for now)
        /*
        // Get window bounds on desktop
        const bounds = this._debugWindow.getBounds();

        // Use Electron's desktopCapturer to capture the actual desktop content
        // This matches Pascal's behavior which captures the window area from the desktop
        const { desktopCapturer } = require('electron');

        // Get all available desktop sources (screens)
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: bounds.width, height: bounds.height }
        });

        if (sources.length === 0) {
          throw new Error('No desktop sources available for capture');
        }

        // Use the primary screen source
        const primarySource = sources[0];

        // Create a minimal capture window to use desktopCapturer
        const captureWindow = new BrowserWindow({
          width: bounds.width,
          height: bounds.height,
          show: false,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false
          }
        });

        // Load a minimal HTML page that will capture the desktop
        const captureHtml = `
          <html>
            <body>
              <script>
                const { desktopCapturer } = require('electron');

                async function captureDesktop() {
                  try {
                    const sources = await desktopCapturer.getSources({
                      types: ['screen'],
                      thumbnailSize: { width: ${bounds.width * 2}, height: ${bounds.height * 2} }
                    });

                    if (sources.length > 0) {
                      // Get the thumbnail image which contains the desktop screenshot
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');

                      // Create image from thumbnail
                      const img = new Image();
                      img.onload = function() {
                        canvas.width = ${bounds.width};
                        canvas.height = ${bounds.height};

                        // Calculate the region to extract based on window position
                        const scaleX = img.width / sources[0].display.bounds.width;
                        const scaleY = img.height / sources[0].display.bounds.height;

                        const sourceX = ${bounds.x} * scaleX;
                        const sourceY = ${bounds.y} * scaleY;
                        const sourceWidth = ${bounds.width} * scaleX;
                        const sourceHeight = ${bounds.height} * scaleY;

                        // Draw the window region from the desktop capture
                        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, ${bounds.width}, ${bounds.height});

                        // Convert to data URL and send back to main process
                        const dataUrl = canvas.toDataURL('image/png');
                        window.captureResult = dataUrl;
                      };
                      img.src = sources[0].thumbnail.toDataURL();
                    }
                  } catch (error) {
                    window.captureError = error.message;
                  }
                }

                captureDesktop();
              </script>
            </body>
          </html>
        `;

        await captureWindow.loadURL(`data:text/html,${encodeURIComponent(captureHtml)}`);

        // Wait for capture to complete
        let result = null;
        let retries = 20; // 2 seconds max wait
        while (retries > 0 && !result) {
          try {
            result = await captureWindow.webContents.executeJavaScript('window.captureResult');
            if (!result) {
              const error = await captureWindow.webContents.executeJavaScript('window.captureError');
              if (error) {
                throw new Error(error);
              }
            }
          } catch (error) {
            // Continue waiting
          }

          if (!result) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries--;
          }
        }

        captureWindow.destroy();

        if (result) {
          // Convert data URL to buffer
          const base64Data = result.replace(/^data:image\/png;base64,/, '');
          const pngBuffer = Buffer.from(base64Data, 'base64');
          const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);

          const outputFSpec = screenshotFSpecForFilename(this.context, filename, '.bmp');
          fs.writeFileSync(outputFSpec, bmpBuffer);
          this.logMessageBase(`- Desktop window BMP image [${outputFSpec}] saved successfully`);
        } else {
          throw new Error('Desktop capture timed out or failed');
        }
        */
      } catch (error) {
        this.logMessageBase(`ERROR: Save window failed: ${error}`);
      }

      this.saveInProgress = false;
    }
  }

  /**
   * Save specific desktop coordinates to BMP file matching Pascal's SAVE l t w h 'filename' behavior.
   * Captures a rectangular region from the desktop at the specified screen coordinates.
   */
  protected async saveDesktopCoordinatesToBMPFilename(
    left: number,
    top: number,
    width: number,
    height: number,
    filename: string
  ): Promise<void> {
    this.logMessage(
      `  -- writing desktop coordinates BMP to [${filename}] at (${left},${top}) size ${width}x${height}`
    );
    this.saveInProgress = true;

    try {
      // Pascal SAVE l t w h captures an arbitrary desktop rectangle (screen
      // coordinates). Capture that region directly; fall back to canvas content
      // only if the desktop capture is unavailable (e.g. macOS permission).
      let pngBuffer = await this.captureDesktopRegionAsPNG(left, top, width, height);
      if ((!pngBuffer || pngBuffer.length === 0) && this._debugWindow) {
        this.logMessageBase('SAVE coordinates: desktop capture unavailable — falling back to canvas content');
        pngBuffer = await this.captureWindowAsPNG(this._debugWindow);
      }
      if (pngBuffer && pngBuffer.length > 0) {
        const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);
        const outputFSpec = screenshotFSpecForFilename(this.context, filename, '.bmp');
        fs.writeFileSync(outputFSpec, bmpBuffer);
        this.logMessageBase(`- Coordinates BMP image [${outputFSpec}] saved successfully`);
        this.context.logger.progressMsg(`File written [${outputFSpec}]`);
      } else {
        this.logMessageBase('ERROR: No image available for capture');
      }

      /* Original implementation - disabled to avoid permissions
      // Validate coordinates
      if (width <= 0 || height <= 0) {
        throw new Error(`Invalid dimensions: ${width}x${height}`);
      }

      // Create a temporary window for desktop capture at the specified coordinates
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();

      // Clamp coordinates to screen bounds
      const screenWidth = primaryDisplay.size.width;
      const screenHeight = primaryDisplay.size.height;
      const clampedLeft = Math.max(0, Math.min(left, screenWidth - 1));
      const clampedTop = Math.max(0, Math.min(top, screenHeight - 1));
      const clampedWidth = Math.min(width, screenWidth - clampedLeft);
      const clampedHeight = Math.min(height, screenHeight - clampedTop);

      this.logMessageBase(`Clamped coordinates: (${clampedLeft},${clampedTop}) size ${clampedWidth}x${clampedHeight}`);

      // Use Electron's desktopCapturer to capture the actual desktop content
      const { desktopCapturer } = require('electron');

      // Get all available desktop sources (screens)
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: clampedWidth * 2, height: clampedHeight * 2 }
      });

      if (sources.length === 0) {
        throw new Error('No desktop sources available for capture');
      }

      // Create a minimal capture window to use desktopCapturer
      const captureWindow = new BrowserWindow({
        width: clampedWidth,
        height: clampedHeight,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          sandbox: false
        }
      });

      // Load a minimal HTML page that will capture the desktop region
      const captureHtml = `
        <html>
          <body>
            <script>
              const { desktopCapturer } = require('electron');

              async function captureDesktopRegion() {
                try {
                  const sources = await desktopCapturer.getSources({
                    types: ['screen'],
                    thumbnailSize: { width: ${clampedWidth * 2}, height: ${clampedHeight * 2} }
                  });

                  if (sources.length > 0) {
                    // Get the thumbnail image which contains the desktop screenshot
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Create image from thumbnail
                    const img = new Image();
                    img.onload = function() {
                      canvas.width = ${clampedWidth};
                      canvas.height = ${clampedHeight};

                      // Calculate the region to extract based on coordinates
                      const scaleX = img.width / sources[0].display.bounds.width;
                      const scaleY = img.height / sources[0].display.bounds.height;

                      const sourceX = ${clampedLeft} * scaleX;
                      const sourceY = ${clampedTop} * scaleY;
                      const sourceWidth = ${clampedWidth} * scaleX;
                      const sourceHeight = ${clampedHeight} * scaleY;

                      // Draw the specified region from the desktop capture
                      ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, ${clampedWidth}, ${clampedHeight});

                      // Convert to data URL and send back to main process
                      const dataUrl = canvas.toDataURL('image/png');
                      window.captureResult = dataUrl;
                    };
                    img.src = sources[0].thumbnail.toDataURL();
                  }
                } catch (error) {
                  window.captureError = error.message;
                }
              }

              captureDesktopRegion();
            </script>
          </body>
        </html>
      `;

      await captureWindow.loadURL(`data:text/html,${encodeURIComponent(captureHtml)}`);

      // Wait for capture to complete
      let result = null;
      let retries = 20; // 2 seconds max wait
      while (retries > 0 && !result) {
        try {
          result = await captureWindow.webContents.executeJavaScript('window.captureResult');
          if (!result) {
            const error = await captureWindow.webContents.executeJavaScript('window.captureError');
            if (error) {
              throw new Error(error);
            }
          }
        } catch (error) {
          // Continue waiting
        }

        if (!result) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries--;
        }
      }

      captureWindow.destroy();

      if (!result) {
        throw new Error('Desktop coordinate capture timed out or failed');
      }

      // Convert data URL to buffer
      const base64Data = result.replace(/^data:image\/png;base64,/, '');
      const pngBuffer = Buffer.from(base64Data, 'base64');
      const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);

      const outputFSpec = screenshotFSpecForFilename(this.context, filename, '.bmp');
      fs.writeFileSync(outputFSpec, bmpBuffer);
      this.logMessageBase(`- Desktop coordinates BMP image [${outputFSpec}] saved successfully`);
      */
    } catch (error) {
      this.logMessageBase(`ERROR: Save coordinates failed: ${error}`);
    }

    this.saveInProgress = false;
  }

  protected removeStringQuotes(quotedString: string): string {
    // remove leading and trailing quotes (' or ") if present
    let value = quotedString;
    if (value.length > 1) {
      if (
        (value[0] === '"' && value[value.length - 1] === '"') ||
        (value[0] === "'" && value[value.length - 1] === "'")
      ) {
        value = value.substring(1, value.length - 1);
      }
    }
    return value;
  }

  protected getParallaxFontUrl(): string {
    // In packaged app, fonts are directly in Resources/fonts, not Resources/app/fonts
    let fontPath: string;

    if (process.resourcesPath) {
      // In packaged app - fonts are in Resources/fonts
      fontPath = path.join(process.resourcesPath, 'fonts', 'Parallax.ttf');
    } else {
      // In development - relative to the dist directory
      fontPath = path.join(__dirname, '../../fonts', 'Parallax.ttf');
    }

    // Log for debugging
    this.logMessageBase(`[FONT] Parallax font path: ${fontPath}`);

    // Convert to file URL with forward slashes for cross-platform compatibility
    return `file://${fontPath.replace(/\\/g, '/')}`;
  }

  protected getIBM3270FontUrl(): string {
    // In packaged app, fonts are directly in Resources/fonts, not Resources/app/fonts
    let fontPath: string;

    if (process.resourcesPath) {
      // In packaged app - fonts are in Resources/fonts
      fontPath = path.join(process.resourcesPath, 'fonts', '3270-Regular.ttf');
    } else {
      // In development - relative to the dist directory
      fontPath = path.join(__dirname, '../../fonts', '3270-Regular.ttf');
    }

    // Log for debugging
    this.logMessageBase(`[FONT] IBM 3270 font path: ${fontPath}`);

    // Convert to file URL with forward slashes for cross-platform compatibility
    return `file://${fontPath.replace(/\\/g, '/')}`;
  }

  // ----------------------------------------------------------------------
  // Mouse and Keyboard Input Support Methods

  /**
   * Enable keyboard input forwarding for PC_KEY command
   */
  protected enableKeyboardInput(): void {
    this.logMessageBase('Enabling keyboard input forwarding');
    this.inputForwarder.startPolling();

    // Register the IPC receiver here too: PC_KEY can be used without PC_MOUSE, and
    // the receiver (setupMouseEventHandlers, deduped) handles both channels.
    this.setupMouseEventHandlers();

    if (this.debugWindow) {
      // Forward via ipcRenderer.send('key-event', …) — window.electronAPI is
      // undefined in these windows (no preload, nodeIntegration:true), so the old
      // guarded electronAPI path never fired and PC_KEY captured nothing. The base
      // 'key-event' receiver reads [key, keyCode]. KeyCode map + guard mirror PLOT.
      // [9win LD-2]
      this.debugWindow.webContents.executeJavaScript(`
        (function() {
          if (window.__keyboardInputInitialized) return;
          window.__keyboardInputInitialized = true;

          const { ipcRenderer } = require('electron');

          document.addEventListener('keydown', (event) => {
            // Map key to keyCode for PC_KEY transmission (matching Pascal behavior)
            let keyCode = event.keyCode || 0;
            if (event.key === 'ArrowLeft') keyCode = 1;
            else if (event.key === 'ArrowRight') keyCode = 2;
            else if (event.key === 'ArrowUp') keyCode = 3;
            else if (event.key === 'ArrowDown') keyCode = 4;
            else if (event.key === 'Home') keyCode = 5;
            else if (event.key === 'End') keyCode = 6;
            else if (event.key === 'Delete') keyCode = 7;
            else if (event.key === 'Backspace') keyCode = 8;
            else if (event.key === 'Tab') keyCode = 9;
            else if (event.key === 'Insert') keyCode = 10;
            else if (event.key === 'PageUp') keyCode = 11;
            else if (event.key === 'PageDown') keyCode = 12;
            else if (event.key === 'Enter') keyCode = 13;
            else if (event.key === 'Escape') keyCode = 27;
            else if (event.key.length === 1 && event.key.charCodeAt(0) >= 32 && event.key.charCodeAt(0) <= 126) {
              keyCode = event.key.charCodeAt(0); // ASCII 32-126 (Space to ~)
            }

            if (keyCode > 0) {
              ipcRenderer.send('key-event', event.key, keyCode);
            }
          });
        })();
      `);
    }
  }

  /**
   * Enable mouse input forwarding for PC_MOUSE command
   * Derived classes should override getMouseCoordinateTransform() to provide window-specific transformations
   */
  protected enableMouseInput(): void {
    this.logMessageBase('Enabling mouse input forwarding');
    this.inputForwarder.startPolling();

    if (this.debugWindow) {
      // Get canvas ID from derived class
      const canvasId = this.getCanvasId();

      // Forward via ipcRenderer.send('mouse-event', …), NOT window.electronAPI:
      // there is no preload and every debug window runs nodeIntegration:true /
      // contextIsolation:false, so window.electronAPI is undefined and the old
      // guarded electronAPI path silently no-op'd — PC_MOUSE capture never fired
      // for any base-path window. The base IPC receiver (setupMouseEventHandlers)
      // already listens on the 'mouse-event' channel. Mirrors PLOT's handler. [9win LD-2]
      this.debugWindow.webContents.executeJavaScript(`
        (function() {
          // Guard against multiple initialization
          if (window.__mouseInputInitialized) {
            if (${ENABLE_CONSOLE_LOG}) console.log('[MOUSE INPUT] Already initialized, skipping');
            return;
          }
          window.__mouseInputInitialized = true;

          const { ipcRenderer } = require('electron');

          const canvas = document.getElementById('${canvasId}');
          if (canvas) {
            let mouseButtons = { left: false, middle: false, right: false };

          // Mouse move handler
          canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);
            ipcRenderer.send('mouse-event', x, y, mouseButtons, 0);
          });

          // Mouse button handlers
          canvas.addEventListener('mousedown', (event) => {
            if (event.button === 0) mouseButtons.left = true;
            else if (event.button === 1) mouseButtons.middle = true;
            else if (event.button === 2) mouseButtons.right = true;

            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);
            ipcRenderer.send('mouse-event', x, y, mouseButtons, 0);
          });

          canvas.addEventListener('mouseup', (event) => {
            if (event.button === 0) mouseButtons.left = false;
            else if (event.button === 1) mouseButtons.middle = false;
            else if (event.button === 2) mouseButtons.right = false;

            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);
            ipcRenderer.send('mouse-event', x, y, mouseButtons, 0);
          });

          // Mouse wheel handler with 100ms debounce
          canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            const delta = Math.sign(event.deltaY) * -1; // Normalize to -1, 0, 1

            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);
            ipcRenderer.send('mouse-event', x, y, mouseButtons, delta);
          });

          // Mouse leave handler
          canvas.addEventListener('mouseleave', (event) => {
            ipcRenderer.send('mouse-event', -1, -1, mouseButtons, 0);
          });

          // Prevent the OS context menu so right-button state is reportable
          canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
          });
        }
        })(); // End IIFE
      `);

      // Set up mouse event handlers
      this.setupMouseEventHandlers();
    }
  }

  /**
   * Set up IPC handlers for mouse events
   */
  private setupMouseEventHandlers(): void {
    if (!this.debugWindow) return;

    // Guard against duplicate handler registration to prevent MaxListeners warning
    if (this.mouseEventHandlersSetup) {
      this.logMessageBase('Mouse event handlers already set up, skipping');
      return;
    }
    this.mouseEventHandlersSetup = true;

    // Handle mouse events from renderer
    this.debugWindow.webContents.on('ipc-message', (event, channel, ...args) => {
      if (channel === 'mouse-event') {
        const [x, y, buttons, wheelDelta] = args;

        // Handle wheel events with 100ms timer
        if (wheelDelta !== 0) {
          this.lastWheelDelta = wheelDelta;
          if (this.wheelTimer) {
            clearTimeout(this.wheelTimer);
          }
          this.wheelTimer = setTimeout(() => {
            this.lastWheelDelta = 0;
          }, 100);
        }

        // Transform coordinates based on window type
        const transformed = this.transformMouseCoordinates(x, y);

        // Store the RAW client pixel position. Pascal SendMousePos uses the raw
        // p.x/p.y both for the bounds check (:3543) and for sampling the pixel
        // colour (Canvas.Pixels[p.x,p.y], :3553); the per-display-type wire
        // transform is applied ONCE, at PC_MOUSE send time (see the PC_MOUSE case
        // in handleCommonCommand, which calls transformMouseCoordinates there).
        // Storing the transformed value here double-applied the SPECTRO/BITMAP
        // overrides added in §1 and fed getPixelColorAt the wrong coordinate.
        // Storing raw matches PLOT's own handler. [9win §1/§2]
        this.vMouseX = x;
        this.vMouseY = y;
        this.vMouseButtons = {
          left: buttons.left || false,
          middle: buttons.middle || false,
          right: buttons.right || false
        };
        // Note: vMouseWheel is updated by wheel event handler

        // Get pixel color at position
        const pixelGetter = this.getPixelColorGetter();

        // Queue the mouse event
        this.inputForwarder.queueMouseEvent(transformed.x, transformed.y, buttons, this.lastWheelDelta, pixelGetter);
      } else if (channel === 'key-event') {
        const [key, keyCode] = args;
        // Store keypress for PC_KEY command (Pascal behavior: stores last keypress)
        this.vKeyPress = keyCode || 0;
        this.logMessageBase(`Key captured: '${key}' (code: ${keyCode}) stored in vKeyPress`);
        // Also forward to input forwarder for other uses
        this.inputForwarder.queueKeyEvent(key);
      }
    });
  }

  /**
   * Transform mouse coordinates for the specific window type
   * Override this in derived classes for window-specific transformations
   */
  protected transformMouseCoordinates(x: number, y: number): { x: number; y: number } {
    // Default implementation - no transformation.
    // Pascal SendMousePos (DebugDisplayUnit.pas:3555-3568) sends RAW client pixels
    // for dis_logic/dis_scope/dis_scope_xy/dis_fft/dis_midi (no case branch). Those
    // windows must NOT override this; only dis_spectro/dis_plot/dis_bitmap (pixel/
    // dotsize, via transformPixelDotsize) and dis_term (char cells) transform.
    return { x, y };
  }

  /**
   * Pascal SendMousePos pixel-mode transform (DebugDisplayUnit.pas:3556-3561),
   * shared by the dis_spectro / dis_plot / dis_bitmap windows:
   *   if vDirX then p.x := ClientWidth - p.x;
   *   if not vDirY then p.y := ClientHeight - p.y;
   *   p.x := p.x div vDotSize; p.y := p.y div vDotSizeY;
   * clientWidth/clientHeight are the PIXEL canvas dimensions (logical * dotSize).
   */
  protected transformPixelDotsize(
    x: number,
    y: number,
    opts: { dirX: boolean; dirY: boolean; dotSizeX: number; dotSizeY: number; clientWidth: number; clientHeight: number }
  ): { x: number; y: number } {
    if (opts.dirX) x = opts.clientWidth - x;
    if (!opts.dirY) y = opts.clientHeight - y;
    return {
      x: Math.floor(x / Math.max(1, opts.dotSizeX)),
      y: Math.floor(y / Math.max(1, opts.dotSizeY))
    };
  }

  /**
   * Get canvas dimensions for bounds checking
   * Override this in derived classes that have canvases
   * Default returns null (no bounds checking - accept all coordinates)
   */
  protected getCanvasDimensions(): { width: number; height: number } | null {
    // Default implementation - no bounds (for windows without canvases)
    return null;
  }

  /**
   * Get the canvas element ID for this window
   * Must be overridden by derived classes
   */
  protected abstract getCanvasId(): string;

  /**
   * Get a function that returns pixel color at given coordinates
   * Override in derived classes if pixel color sampling is needed
   */
  protected getPixelColorGetter(): ((x: number, y: number) => number) | undefined {
    // Default implementation - no pixel color sampling
    return undefined;
  }

  /**
   * Sample the pixel colour under the cursor for the PC_MOUSE LONG2 value.
   *
   * Pascal SendMousePos reads the on-screen canvas pixel at the raw client
   * position for EVERY on-window case (DebugDisplayUnit.pas:3553-3554):
   *   c := Canvas.Pixels[p.x, p.y];
   *   c := c and $0000FF shl 16 or c and $00FF00 or c and $FF0000 shr 16;
   * The swap is needed in Pascal only because Win32 Canvas.Pixels yields a
   * COLORREF in $00BBGGRR order; the renderer's getImageData already returns
   * channels in R,G,B order, so we assemble $00RRGGBB directly.
   *
   * The read is performed on the committed (displayed) canvas via getCanvasId()
   * — the hook every window already exposes — at PC_MOUSE poll time so it
   * reflects the current frame, matching Pascal's on-demand Canvas.Pixels read.
   *
   * @param x raw client X (relative to the window's canvas element)
   * @param y raw client Y
   * @returns 0x00RRGGBB, or 0 (black) if the canvas/context is unavailable
   */
  protected async getPixelColorAt(x: number, y: number): Promise<number> {
    if (!this.debugWindow) {
      return 0x000000;
    }
    const canvasId = this.getCanvasId();
    try {
      const result = await this.debugWindow.webContents.executeJavaScript(`
        (function() {
          const c = document.getElementById(${JSON.stringify(canvasId)});
          if (!c || typeof c.getContext !== 'function') return 0;
          const ctx = c.getContext('2d');
          if (!ctx) return 0;
          const rect = c.getBoundingClientRect();
          // The cursor x,y are CSS pixels inside the canvas element. Map them to
          // the backing-store resolution (canvas.width/height) so we sample the
          // right source pixel even when the canvas is CSS-scaled (dotSize stretch).
          const bx = rect.width  ? Math.floor(${x} * c.width  / rect.width)  : ${x};
          const by = rect.height ? Math.floor(${y} * c.height / rect.height) : ${y};
          if (bx < 0 || by < 0 || bx >= c.width || by >= c.height) return 0;
          try {
            const d = ctx.getImageData(bx, by, 1, 1).data;
            // $00RRGGBB (getImageData is already R,G,B; see Pascal :3554)
            return ((d[0] & 0xFF) << 16) | ((d[1] & 0xFF) << 8) | (d[2] & 0xFF);
          } catch (e) { return 0; }
        })();
      `);
      return (typeof result === 'number' ? result : 0) & 0xFFFFFF;
    } catch (error) {
      this.logMessageBase(`getPixelColorAt sample error: ${error}`);
      return 0x000000;
    }
  }

  // ----------------------------------------------------------------------
  // PRIVATE (utility) Methods

  /**
   * Flush the renderer's pending canvas draws before a capture. Every window issues its canvas
   * draws FIRE-AND-FORGET via executeJavaScript, and NEITHER capturePage() NOR desktopCapturer
   * waits for them. Light windows (TERM/SCOPE/SCOPE_XY) finish their few draws before capture;
   * heavy windows do not — LOGIC fires 32 clears + 32 channel draws PER redraw (× every rate-cycle)
   * and SPECTRO fires a per-FFT-bin waterfall, so when SAVE lands on that backlog the capture is
   * partial/empty (only some channels, no chirp streak). This used to be hidden by the device's
   * `waitms` before SAVE, but the window-readiness drain replays buffered messages back-to-back,
   * collapsing that gap. executeJavaScript runs FIFO, so awaiting a TRAILING double-rAF (issued
   * after all the draws) guarantees every queued draw has executed AND been painted/composited
   * before we capture. [SAVE-vs-async-draw race — fixes LOGIC traces + SPECTRO streak]
   *
   * The double-rAF only resolves while the renderer is actually servicing animation frames. A
   * window that is OCCLUDED/unfocused during a scripted multi-window SAVE has its rAF paused by
   * Chromium's backgroundThrottling, so awaiting it unbounded would HANG SAVE forever (no file at
   * all). We disable backgroundThrottling on the debug windows so rAF keeps firing while occluded,
   * but this race also caps the flush so capture ALWAYS proceeds, even if a frame is never serviced
   * (e.g. a minimized window). Used by BOTH the content-capture (capturePage) and SAVE WINDOW
   * (desktopCapturer) paths — the latter previously skipped the flush, so SAVE WINDOW captured a
   * half-drawn LOGIC while plain SAVE (flushed) was complete.
   */
  private async flushRendererDraws(window: BrowserWindow): Promise<void> {
    try {
      if (!window.isDestroyed()) {
        const flush = window.webContents.executeJavaScript(
          'new Promise(requestAnimationFrame).then(() => new Promise(requestAnimationFrame))'
        );
        const timeout = new Promise((resolve) => setTimeout(resolve, 1000));
        await Promise.race([flush, timeout]);
      }
    } catch {
      /* best-effort flush; proceed to capture regardless */
    }
  }

  private async captureWindowAsPNG(window: BrowserWindow): Promise<Buffer> {
    await this.flushRendererDraws(window);
    return new Promise((resolve) => {
      const failSafe = (error: unknown) => {
        console.error('Win: ERROR: capturing window as PNG:', error);
        resolve(Buffer.alloc(0));
      };
      try {
        window.webContents
          .capturePage()
          .then((image) => resolve(image.toPNG()))
          // capturePage() returns a Promise — a rejection is NOT caught by the synchronous
          // try/catch below. Without this .catch the outer Promise never resolves and SAVE
          // hangs forever (plus an unhandled rejection). Resolve with an empty buffer instead,
          // matching the catch branch's intent. [9win #24 real-bug fix]
          .catch(failSafe);
      } catch (error) {
        failSafe(error);
      }
    });
  }

  /**
   * macOS Screen Recording permission status for desktop capture.
   * Returns 'granted' | 'denied' | 'restricted' | 'not-determined'. On non-macOS
   * platforms desktop capture needs no permission, so we report 'granted'.
   */
  protected screenCapturePermission(): 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown' {
    if (process.platform !== 'darwin') return 'granted';
    try {
      return systemPreferences.getMediaAccessStatus('screen') as
        | 'granted'
        | 'denied'
        | 'restricted'
        | 'not-determined';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Capture a rectangular region of the DESKTOP — including any native window
   * chrome that falls within it — as a PNG buffer. Matches Pascal's SAVE WINDOW
   * / SAVE l t w h behavior (webContents.capturePage() only yields web content,
   * never the OS-drawn frame). Uses Electron's desktopCapturer.
   *
   * On macOS this requires Screen Recording permission; without it getSources
   * yields an empty/black image. Returns an empty Buffer on any failure so
   * callers can fall back to canvas content.
   *
   * @param left,top    region top-left in screen DIP coordinates
   * @param width,height region size in DIP
   */
  protected async captureDesktopRegionAsPNG(
    left: number,
    top: number,
    width: number,
    height: number
  ): Promise<Buffer> {
    try {
      // Pick the display the region lives on; capture it at native pixel res.
      const display = screen.getDisplayMatching({ x: left, y: top, width, height });
      const scale = display.scaleFactor || 1;
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(display.size.width * scale),
          height: Math.round(display.size.height * scale)
        }
      });
      if (!sources || sources.length === 0) {
        this.logMessageBase('captureDesktopRegionAsPNG: no screen sources (Screen Recording permission?)');
        return Buffer.alloc(0);
      }
      // Match the source to our display when the platform reports display_id.
      const matched = sources.find((s) => s.display_id && s.display_id === `${display.id}`);
      const source = matched ?? sources[0];
      const full: NativeImage = source.thumbnail;
      if (!full || full.isEmpty()) {
        this.logMessageBase('captureDesktopRegionAsPNG: empty thumbnail (Screen Recording permission?)');
        return Buffer.alloc(0);
      }
      // Convert DIP→pixels relative to the display origin, clamped to the image.
      const imgSize = full.getSize();
      let cx = Math.round((left - display.bounds.x) * scale);
      let cy = Math.round((top - display.bounds.y) * scale);
      cx = Math.max(0, Math.min(cx, imgSize.width - 1));
      cy = Math.max(0, Math.min(cy, imgSize.height - 1));
      const cw = Math.max(1, Math.min(Math.round(width * scale), imgSize.width - cx));
      const ch = Math.max(1, Math.min(Math.round(height * scale), imgSize.height - cy));
      const cropped = full.crop({ x: cx, y: cy, width: cw, height: ch });
      return cropped.toPNG();
    } catch (error) {
      this.logMessageBase(`captureDesktopRegionAsPNG ERROR: ${error}`);
      return Buffer.alloc(0);
    }
  }

  private async convertPNGtoBMP(pngBuffer: Buffer): Promise<Buffer> {
    let desiredBmpImage: Buffer;
    try {
      const image = await Jimp.read(pngBuffer);
      desiredBmpImage = await image.getBuffer('image/bmp');
    } catch (error) {
      console.error('Win: ERROR: converting PNG to BMP:', error);
      desiredBmpImage = Buffer.alloc(0);
    }
    return desiredBmpImage;
  }

  // ----------------------------------------------------------------------

  protected logMessageBase(message: string): void {
    this.logMessage(message, 'Base');
  }

  protected logMessage(message: string, prefix: string = ''): void {
    if (this.isLogging) {
      // Debug window lifecycle messages are system diagnostics, should go to console
      const prefixStr = prefix.length > 0 ? prefix : this.windowLogPrefix;
      this.context.logger.forceLogMessage(`${prefixStr}: ${message}`);
    }
  }

  /**
   * Controlled console logging for static methods - only outputs when ENABLE_CONSOLE_LOG is true
   */
  protected static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  /**
   * Controlled console logging for instance methods - only outputs when ENABLE_CONSOLE_LOG is true
   */
  protected logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }
}
