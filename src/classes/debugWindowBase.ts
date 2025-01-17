/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';

import { Context } from '../utils/context';

// src/classes/debugWindow.ts

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

export abstract class DebugWindowBase {
  private context: Context;
  private isLogging: boolean = true; // WARNING (REMOVE BEFORE FLIGHT)- change to 'false' - disable before commit

  constructor(ctx: Context) {
    this.context = ctx;
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

  // ----------------------------------------------------------------------
  // CLASS (static) methods
  //   NOTE: static since used by derived class static methods

  static getValidRgb24(possColorValue: string): [boolean, string] {
    let rgbValue: string = '#a5a5a5'; // gray for unknown color
    let isValid: boolean = false;
    // if color is a number, then it is a rgb24 value
    // NOTE number could be decimal or $ prefixed hex  ($rrggbb) and either could have '_' digit separaters
    // return rgbValue as a #rrbbgg string
    const possColorStr = possColorValue.replace(/_/g, '');
    if (possColorStr.length > 0) {
      if (possColorStr[0] === '$' && /^[0-9A-Fa-f]+$/.test(possColorValue.substring(1))) {
        // hex value
        const hexValue: string = possColorStr.substring(1);
        if (hexValue.length === 6 || hexValue.length === 3) {
          rgbValue = `#${hexValue}`;
          isValid = true;
        }
      } else if (/^[0-9]+$/.test(possColorStr) && possColorStr.length > 3) {
        // decimal value
        const decValue: number = parseInt(possColorStr, 10);
        if (decValue >= 0 && decValue <= 0xffffff) {
          rgbValue = '#' + decValue.toString(16).padStart(6, '0');
          isValid = true;
        }
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
      console.log(`Win: ERROR: Invalid style string(8): [${styleStr}](${styleStr.length})`);
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

  // ----------------------------------------------------------------------

  protected logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage('Win: ' + message);
    }
  }
}
