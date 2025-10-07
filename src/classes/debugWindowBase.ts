/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';

import { BrowserWindow, NativeImage } from 'electron';
import { Jimp } from 'jimp';
import * as fs from 'fs';
import * as path from 'path';
import EventEmitter from 'events';
import { Context } from '../utils/context';
import { localFSpecForFilename, screenshotFSpecForFilename } from '../utils/files';
import { waitMSec } from '../utils/timerUtils';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { InputForwarder } from './shared/inputForwarder';
import { WindowRouter, WindowHandler, SerialMessage } from './shared/windowRouter';
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
  protected isLogging: boolean = true; // WARNING (REMOVE BEFORE FLIGHT)- change to 'false' - disable before commit
  private _debugWindow: BrowserWindow | null = null;
  private _saveInProgress: boolean = false;
  private isClosing: boolean = false; // Prevent recursive close handling
  protected inputForwarder: InputForwarder;
  protected wheelTimer: NodeJS.Timeout | null = null;
  protected lastWheelDelta: number = 0;
  
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
  protected vKeyPress: number = 0;         // Stores last keypress value for PC_KEY
  protected vMouseX: number = -1;          // Mouse X coordinate (-1 = out of bounds)
  protected vMouseY: number = -1;          // Mouse Y coordinate (-1 = out of bounds)
  protected vMouseButtons: {               // Mouse button states
    left: boolean;
    middle: boolean;
    right: boolean;
  } = { left: false, middle: false, right: false };
  protected vMouseWheel: number = 0;       // Mouse wheel delta (cleared after transmission)

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
   * Process message content immediately. Must be implemented by derived classes.
   * This is called either immediately (if window is ready) or when queued messages are processed.
   */
  protected abstract processMessageImmediate(lineParts: string[] | any): void;

  /**
   * Clear the display. Override in derived classes that support clearing.
   * Called when CLEAR command is received.
   * Default implementation logs warning as this indicates a routing error for windows that don't support CLEAR.
   */
  protected clearDisplayContent(): void {
    // Default: This should never be called for windows that don't support CLEAR
    // If it is called, it's likely a routing error
    this.logMessageBase(`WARNING: CLEAR command received by ${this.constructor.name} which doesn't support it - possible routing error`);
  }

  /**
   * Force an update of the display. Override in derived classes that support updates.
   * Called when UPDATE command is received (when in deferred update mode).
   * Default implementation logs warning as this indicates a routing error for windows that don't support UPDATE.
   */
  protected forceDisplayUpdate(): void {
    // Default: This should never be called for windows that don't support UPDATE
    // If it is called, it's likely a routing error
    this.logMessageBase(`WARNING: UPDATE command received by ${this.constructor.name} which doesn't support it - possible routing error`);
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
  public setSerialTransmissionCallback(callback: (data: string) => void): void {
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
        let left = 0, top = 0, width = 0, height = 0;

        // Check for WINDOW modifier
        if (commandParts.length > saveIndex &&
            commandParts[saveIndex].toUpperCase() === 'WINDOW') {
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
            if ((filename.startsWith("'") && filename.endsWith("'")) ||
                (filename.startsWith('"') && filename.endsWith('"'))) {
              filename = filename.slice(1, -1);
            }
          } else {
            // Unquoted filename - just use the single token
            filename = commandParts[saveIndex];
          }

          if (coordinateMode) {
            this.logMessageBase(`Executing SAVE coordinates: ${left},${top},${width},${height} -> ${filename}`);
            await this.saveDesktopCoordinatesToBMPFilename(left, top, width, height, filename);
          } else if (saveWindow) {
            this.logMessageBase(`Executing SAVE WINDOW: ${filename}`);
            await this.saveDesktopWindowToBMPFilename(filename);
          } else {
            this.logMessageBase(`Executing SAVE canvas: ${filename}`);
            await this.saveWindowToBMPFilename(filename);
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
        this.enableMouseInput();
        // Return current mouse state and pixel color
        try {
          // Check if mouse is within valid bounds
          if (this.vMouseX >= 0 && this.vMouseY >= 0) {
            // Encode mouse position and button state
            const positionValue = this.tLongTransmitter.encodeMouseData(
              this.vMouseX,
              this.vMouseY,
              this.vMouseButtons.left,
              this.vMouseButtons.middle,
              this.vMouseButtons.right,
              this.vMouseWheel
            );

            // Get pixel color at mouse position (derived classes can override getPixelColorAt)
            const colorValue = this.getPixelColorAt(this.vMouseX, this.vMouseY);

            // Transmit position and color
            this.tLongTransmitter.transmitMouseData(positionValue, colorValue);
            this.logMessageBase(`PC_MOUSE transmitted: pos=(${this.vMouseX},${this.vMouseY}) buttons=${JSON.stringify(this.vMouseButtons)} wheel=${this.vMouseWheel} color=0x${colorValue.toString(16)}`);

            // Clear wheel delta after transmission (Pascal behavior)
            this.vMouseWheel = 0;
          } else {
            // Mouse out of bounds - send Pascal's out-of-bounds values
            const outOfBounds = this.tLongTransmitter.createOutOfBoundsMouseData();
            this.tLongTransmitter.transmitMouseData(outOfBounds.position, outOfBounds.color);
            this.logMessageBase('PC_MOUSE transmitted out-of-bounds data');
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
   */
  updateContent(lineParts: string[] | any): void {
    if (this.isWindowReady) {
      // Window is ready, process immediately
      this.processMessageImmediate(lineParts);
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

  // Setter for debugWindow property
  protected set debugWindow(window: BrowserWindow | null) {
    if (window != null) {
      this.logMessageBase(`- New ${this.windowType} window: ${this.windowId}`);
      this._debugWindow = window;

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
   */
  protected onWindowReady(): void {
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
      
      // Process all queued messages
      const queuedMessages = this.messageQueue.dequeueAll();
      
      for (const message of queuedMessages) {
        try {
          this.processMessageImmediate(message);
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
      1000,    // maxSize: 1000 messages  
      5000     // maxAgeMs: 5 second expiry
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
   * This method processes both SerialMessage objects and raw data
   */
  private handleRouterMessage(message: SerialMessage | Uint8Array | string): void {
    try {
      if (typeof message === 'string') {
        // Text message - parse and process
        const lineParts = message.split(' ');
        this.updateContent(lineParts);
      } else if (message instanceof Uint8Array) {
        // Binary data - pass through as-is for windows that handle binary
        // DebugLoggerWindow and DebugDebuggerWindow need raw binary
        this.updateContent(message);
      } else if (typeof message === 'object' && message.type && message.data) {
        // SerialMessage object
        if (message.type === 'text' && typeof message.data === 'string') {
          const lineParts = (message.data as string).split(' ');
          this.updateContent(lineParts);
        } else if (message.type === 'binary' && message.data instanceof Uint8Array) {
          // Handle binary data - pass through as-is
          this.updateContent(message.data as Uint8Array);
        }
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

  static getValidRgb24(possColorValue: string): [boolean, string] {
    let rgbValue: string = '#a5a5a5'; // gray for unknown color
    let isValid: boolean = false;
    
    // First try to parse as a color name using DebugColor
    const colorNameToHex: { [key: string]: string } = {
      BLACK: '#000000',
      WHITE: '#ffffff',
      ORANGE: '#ff6600',
      BLUE: '#0080ff',
      GREEN: '#00ff00',
      CYAN: '#00ffff',
      RED: '#ff0000',
      MAGENTA: '#ff00ff',
      YELLOW: '#ffff00',
      BROWN: '#906020',
      GRAY: '#808080',
      GREY: '#808080'  // Alternative spelling
    };
    
    const upperColorName = possColorValue.toUpperCase();
    if (colorNameToHex[upperColorName]) {
      rgbValue = colorNameToHex[upperColorName];
      isValid = true;
    } else {
      // Try to parse as numeric value using Spin2NumericParser
      // This supports hex ($RRGGBB), decimal, binary (%), and quaternary (%%) formats
      const colorValue = Spin2NumericParser.parseColor(possColorValue);
      
      if (colorValue !== null) {
        // Convert to hex string format #RRGGBB
        rgbValue = '#' + colorValue.toString(16).padStart(6, '0').toLowerCase();
        isValid = true;
      }
    }
    
    return [isValid, rgbValue];
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
      DebugWindowBase.logConsoleMessageStatic(`Win: ERROR:: Invalid style string(8): [${styleStr}](${styleStr.length})`);
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
    const TITLE_BAR_HEIGHT = 40;  // Height of the window title bar
    const WINDOW_BORDER_WIDTH = 20;  // Additional width for window borders

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
        weightName = '300';  // CSS light weight
        break;
      case eTextWeight.TW_NORMAL:
        weightName = 'normal';  // or '400'
        break;
      case eTextWeight.TW_BOLD:
        weightName = 'bold';  // or '700'
        break;
      case eTextWeight.TW_HEAVY:
        weightName = '900';  // CSS heavy/black weight
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
    if (this._debugWindow) {
      this.logMessage(`  -- writing canvas BMP to [${filename}]`);
      this.saveInProgress = true;
      const pngBuffer = await this.captureWindowAsPNG(this._debugWindow);
      const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);
      try {
        const outputFSpec = screenshotFSpecForFilename(this.context, filename, '.bmp');
        fs.writeFileSync(outputFSpec, bmpBuffer);
        this.logMessageBase(`- Canvas BMP image [${outputFSpec}] saved successfully`);
      } catch (error) {
        console.error('Win: ERROR: saving canvas BMP image:', error);
      }
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
        // For now, just use canvas capture to avoid screen recording permissions
        // TODO: Implement proper desktop capture when permission handling is sorted
        this.logMessageBase('Using canvas capture for SAVE WINDOW command');
        const pngBuffer = await this.captureWindowAsPNG(this._debugWindow);
        const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);
        const outputFSpec = screenshotFSpecForFilename(this.context, filename, '.bmp');
        fs.writeFileSync(outputFSpec, bmpBuffer);
        this.logMessageBase(`- Window BMP image [${outputFSpec}] saved successfully`);
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
            contextIsolation: false
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
    this.logMessage(`  -- writing desktop coordinates BMP to [${filename}] at (${left},${top}) size ${width}x${height}`);
    this.saveInProgress = true;

    try {
      // For now, just save the canvas as we can't capture desktop without permissions
      // TODO: Implement proper desktop region capture when permission handling is sorted
      this.logMessageBase('Using canvas capture for SAVE coordinates command (desktop capture requires permissions)');

      if (this._debugWindow) {
        const pngBuffer = await this.captureWindowAsPNG(this._debugWindow);
        const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);
        const outputFSpec = screenshotFSpecForFilename(this.context, filename, '.bmp');
        fs.writeFileSync(outputFSpec, bmpBuffer);
        this.logMessageBase(`- Canvas BMP image [${outputFSpec}] saved successfully`);
      } else {
        this.logMessageBase('ERROR: Window not available for capture');
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
          contextIsolation: false
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
    
    if (this.debugWindow) {
      this.debugWindow.webContents.executeJavaScript(`
        document.addEventListener('keydown', (event) => {
          if (window.electronAPI && window.electronAPI.sendKeyEvent) {
            window.electronAPI.sendKeyEvent(event.key, event.keyCode, event.shiftKey, event.ctrlKey, event.altKey);
          }
        });
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
      
      this.debugWindow.webContents.executeJavaScript(`
        const canvas = document.getElementById('${canvasId}');
        if (canvas) {
          let mouseButtons = { left: false, middle: false, right: false };
          
          // Mouse move handler
          canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            if (window.electronAPI && window.electronAPI.sendMouseEvent) {
              window.electronAPI.sendMouseEvent(x, y, mouseButtons, 0);
            }
          });
          
          // Mouse button handlers
          canvas.addEventListener('mousedown', (event) => {
            if (event.button === 0) mouseButtons.left = true;
            else if (event.button === 1) mouseButtons.middle = true;
            else if (event.button === 2) mouseButtons.right = true;
            
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            if (window.electronAPI && window.electronAPI.sendMouseEvent) {
              window.electronAPI.sendMouseEvent(x, y, mouseButtons, 0);
            }
          });
          
          canvas.addEventListener('mouseup', (event) => {
            if (event.button === 0) mouseButtons.left = false;
            else if (event.button === 1) mouseButtons.middle = false;
            else if (event.button === 2) mouseButtons.right = false;
            
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            if (window.electronAPI && window.electronAPI.sendMouseEvent) {
              window.electronAPI.sendMouseEvent(x, y, mouseButtons, 0);
            }
          });
          
          // Mouse wheel handler with 100ms debounce
          canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            const delta = Math.sign(event.deltaY) * -1; // Normalize to -1, 0, 1
            
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            if (window.electronAPI && window.electronAPI.sendMouseEvent) {
              window.electronAPI.sendMouseEvent(x, y, mouseButtons, delta);
            }
          });
          
          // Mouse leave handler
          canvas.addEventListener('mouseleave', (event) => {
            if (window.electronAPI && window.electronAPI.sendMouseEvent) {
              window.electronAPI.sendMouseEvent(-1, -1, mouseButtons, 0);
            }
          });
        }
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

        // Store mouse state for PC_MOUSE command (Pascal behavior: stores current mouse state)
        this.vMouseX = transformed.x;
        this.vMouseY = transformed.y;
        this.vMouseButtons = {
          left: buttons.left || false,
          middle: buttons.middle || false,
          right: buttons.right || false
        };
        // Note: vMouseWheel is updated by wheel event handler

        // Get pixel color at position
        const pixelGetter = this.getPixelColorGetter();

        // Queue the mouse event
        this.inputForwarder.queueMouseEvent(
          transformed.x,
          transformed.y,
          buttons,
          this.lastWheelDelta,
          pixelGetter
        );
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
    // Default implementation - no transformation
    return { x, y };
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
   * Get pixel color at specific coordinates.
   * Override in derived classes to provide actual pixel color sampling.
   * Default implementation returns 0 (black).
   */
  protected getPixelColorAt(x: number, y: number): number {
    // Default implementation - return black
    // Derived classes should override this to provide actual pixel color sampling
    return 0x000000;
  }

  // ----------------------------------------------------------------------
  // PRIVATE (utility) Methods

  private captureWindowAsPNG(window: BrowserWindow): Promise<Buffer> {
    return new Promise((resolve) => {
      try {
        window.webContents.capturePage().then((image) => {
          const desiredPngImage = image.toPNG();
          resolve(desiredPngImage);
        });
      } catch (error) {
        console.error('Win: ERROR: capturing window as PNG:', error);
        const desiredPngImage: Buffer = Buffer.alloc(0);
        resolve(desiredPngImage);
      }
    });
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
