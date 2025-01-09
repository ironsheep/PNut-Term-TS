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

export interface FontMetrics {
  textSizePts: number;
  charHeight: number;
  charWidth: number;
  lineHeight: number;
  baseline: number;
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

  protected logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage('Win: ' + message);
    }
  }
}
