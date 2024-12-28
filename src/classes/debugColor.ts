/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
// src/classes/scopeWindow.ts

// Name-to-RGB hex lookup
export class DebugColor {
  private color: number;
  private brightness: number;

  private static colorNameToHex: { [key: string]: string } = {
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

  constructor(colorName: string, brightness: number) {
    this.color = DebugColor.colorNameToNumber(colorName);
    this.brightness = brightness;
  }

  private static colorNameToHexString(colorName: string): string {
    let hexString = DebugColor.colorNameToHex[colorName.toUpperCase()];
    if (!hexString) {
      console.log(`colorNameToHexString: Unknown color name: ${colorName}`);
      hexString = '#5a5a5a'; // default to gray
    }
    return hexString;
  }

  private static rgbHexStringToNumber(hexString: string): number {
    const hexValue = hexString.startsWith('#') ? hexString.slice(1) : hexString;
    return parseInt(hexValue, 16);
  }

  private static colorNameToNumber(colorName: string): number {
    const rgbHexString: string = DebugColor.colorNameToHexString(colorName);
    return DebugColor.rgbHexStringToNumber(rgbHexString);
  }

  private adjustBrightness(color: number, brightness: number): number {
    let adjustedColor: number;

    if (brightness === 0) {
      adjustedColor = 0x000000; // Special handling for brightness 0: return black
    } else if (brightness === 15) {
      adjustedColor = color; // Special handling for brightness 15: return original color
    } else {
      const r = ((color >> 16) & 0xff) * (brightness / 15);
      const g = ((color >> 8) & 0xff) * (brightness / 15);
      const b = (color & 0xff) * (brightness / 15);
      adjustedColor = ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);
    }

    return adjustedColor;
  }

  public get rgbValue(): number {
    return this.adjustBrightness(this.color, this.brightness);
  }
}

// Example usage
// const debugColor = new DebugColor('blue', 8);
// console.log(`Adjusted color value: ${debugColor.rgbValue.toString(16)}`);
