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
import { localFSpecForFilename } from '../utils/files';
import { waitMSec } from '../utils/timerUtils';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { InputForwarder } from './shared/inputForwarder';
import { WindowRouter, WindowHandler, SerialMessage } from './shared/windowRouter';

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
 * updateContent(lineParts: string[]): void {
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
  protected inputForwarder: InputForwarder;
  protected wheelTimer: NodeJS.Timeout | null = null;
  protected lastWheelDelta: number = 0;
  
  // WindowRouter integration
  protected windowRouter: WindowRouter;
  protected windowId: string;
  protected windowType: string;
  private isRegisteredWithRouter: boolean = false;

  constructor(ctx: Context, windowId: string, windowType: string) {
    super();
    this.context = ctx;
    this.inputForwarder = new InputForwarder();
    this.windowRouter = WindowRouter.getInstance();
    this.windowId = windowId;
    this.windowType = windowType;
  }
  // Abstract methods that must be overridden by derived classes
  //abstract createDebugWindow(): void;
  abstract closeDebugWindow(): void;
  abstract updateContent(lineParts: string[]): void;

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
      this.logMessageBase(`- New ${this.constructor.name} window`);
      this._debugWindow = window;

      // Add OTHER event listeners as needed
    } else {
      this.logMessageBase(`- Closing ${this.constructor.name} window`);
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
        this.logMessageBase(`- ${this.constructor.name} window closing...`);
        this.emit('close'); // forward the event
        this._debugWindow.removeAllListeners();
        this._debugWindow.close();
        this.logMessageBase(`- ${this.constructor.name} window closed`);
        this.emit('closed'); // forward the event
      }
      this._debugWindow = null;
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
   * Register this window with WindowRouter for message routing
   * Should be called when the window is ready to receive messages
   */
  protected registerWithRouter(): void {
    if (!this.isRegisteredWithRouter) {
      try {
        this.windowRouter.registerWindow(this.windowId, this.windowType, this.handleRouterMessage.bind(this));
        this.isRegisteredWithRouter = true;
        this.logMessageBase(`- Registered with WindowRouter: ${this.windowId} (${this.windowType})`);
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
        // Binary data - convert to text for debug processing
        // Most debug windows expect text commands, debugger window handles binary
        const textMessage = new TextDecoder().decode(message);
        const lineParts = textMessage.split(' ');
        this.updateContent(lineParts);
      } else if (typeof message === 'object' && message.type && message.data) {
        // SerialMessage object
        if (message.type === 'text' && typeof message.data === 'string') {
          const lineParts = (message.data as string).split(' ');
          this.updateContent(lineParts);
        } else if (message.type === 'binary' && message.data instanceof Uint8Array) {
          // Handle binary data (mainly for debugger window)
          const textMessage = new TextDecoder().decode(message.data as Uint8Array);
          const lineParts = textMessage.split(' ');
          this.updateContent(lineParts);
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
    console.log(`Win: str=[${styleStr}] -> value=(${value})`);
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
      console.log(`Win: ERROR:: Invalid style string(8): [${styleStr}](${styleStr.length})`);
    }
    console.log(`Win: str=[${styleStr}] -> textStyle: ${JSON.stringify(textStyle)}`);
  }

  // ----------------------------------------------------------------------
  // inherited by derived classes

  protected fontWeightName(style: TextStyle): string {
    let weightName: string = 'normal';
    switch (style.weight) {
      case eTextWeight.TW_LIGHT:
        weightName = 'light';
        break;
      case eTextWeight.TW_NORMAL:
        weightName = 'normal';
        break;
      case eTextWeight.TW_BOLD:
        weightName = 'bold';
        break;
      case eTextWeight.TW_HEAVY:
        weightName = 'heavy';
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
      this.logMessage(`  -- writing BMP to [${filename}]`);
      this.saveInProgress = true;
      const pngBuffer = await this.captureWindowAsPNG(this._debugWindow);
      const bmpBuffer = await this.convertPNGtoBMP(pngBuffer);
      try {
        const outputFSpec = localFSpecForFilename(this.context, filename, '.bmp');
        fs.writeFileSync(outputFSpec, bmpBuffer);
        this.logMessageBase(`- BMP image [${outputFSpec}] saved successfully`);
      } catch (error) {
        console.error('Win: ERROR: saving BMP image:', error);
      }
      this.saveInProgress = false;
    }
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
    // In packaged app, use process.resourcesPath, in dev use relative path
    const resourcesPath = process.resourcesPath || path.join(__dirname, '../../../');
    const fontPath = path.join(resourcesPath, 'fonts', 'Parallax.ttf');
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
        const [key] = args;
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
      //Write to output window.
      const prefixStr = prefix.length > 0 ? prefix : this.windowLogPrefix;
      this.context.logger.logMessage(`${prefixStr}: ${message}`);
    }
  }
}
