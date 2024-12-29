/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';

import { Context } from '../utils/context';
import { DebugColor } from './debugColor';

// src/classes/debugWindow.ts

export interface Size {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface WindowColor {
  background: DebugColor;
  grid: DebugColor;
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

  // ----------------------------------------------------------------------

  protected logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage(message);
    }
  }
}
