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

  static calcStyleFromBitfield(styleStr: string, textStyle: TextStyle): void {
    // styleStr is a bitfield string of 8 bits
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
          textStyle.weight = eTextWeight.TW_UNKNOWN;
          break;
      }
    } else {
      console.log(`Win: ERROR: Invalid style string(8): [${styleStr}](${styleStr.length})`);
    }
  }

  // ----------------------------------------------------------------------

  protected logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage('Win: ' + message);
    }
  }
}
