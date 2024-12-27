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

export interface DebugColor {
  color: number; // #rrggbb
  brightness: number; // 0-15 (default:8)
}

export interface WindowColor {
  background: DebugColor;
  foreground: DebugColor;
}

export class DebugWindowBase {
  private context: Context;
  private isLogging: boolean = true; // WARNING (REMOVE BEFORE FLIGHT)- change to 'false' - disable before commit

  constructor(ctx: Context) {
    this.context = ctx;
  }

  // Name-to-RGB hex lookup
  static colorNameToHex: { [key: string]: string } = {
    BLACK: '#000000',
    WHITE: '#FFFFFF',
    ORANGE: '#FFA500',
    BLUE: '#0000FF',
    GREEN: '#008000',
    CYAN: '#00FFFF',
    RED: '#FF0000',
    MAGENTA: '#FF00FF',
    YELLOW: '#FFFF00',
    GRAY: '#808080'
  };

  static colorNameToHexString(colorName: string): string {
    let hexString = this.colorNameToHex[colorName.toUpperCase()];
    if (!hexString) {
      console.log(`colorNameToHexString: Unknown color name: ${colorName}`);
      hexString = '#5a5a5a'; // default to gray
    }
    return hexString;
  }

  static rgbHexStringToNumber(hexString: string): number {
    const hexValue = hexString.startsWith('#') ? hexString.slice(1) : hexString;
    return parseInt(hexValue, 16);
  }

  static colorNameToNumber(colorName: string): number {
    const rgbHexString: string = this.colorNameToHexString(colorName);
    return this.rgbHexStringToNumber(rgbHexString);
  }

  // ----------------------------------------------------------------------

  protected logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage(message);
    }
  }
}
