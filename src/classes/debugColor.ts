/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
// src/classes/debugColor.ts

// Name-to-RGB hex lookup
export class DebugColor {
  private _colorValue: number;
  private _colorHexValue: string;
  private _dimmedColorValue: number;
  private _calcBrightness: number;
  private name: string;
  private _brightness: number;
  private dimmedColor: string;
  private gridColor: string;
  private fontColor: string;
  private gridBrightness: number = 6; // chip says 4 but 6 looks better on Linux
  private fontBrightness: number = 12; // linux, grid color too dark

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

  constructor(colorName: string, brightness: number = 8) {
    // default birghtness is 8 when not specified
    this.name = colorName;
    this._colorValue = DebugColor.colorNameToNumber(colorName);
    this._colorHexValue = DebugColor.colorNameToHexString(colorName);
    this._calcBrightness = this.brightnessForHex(this._colorHexValue);
    this.fontBrightness = this._calcBrightness < 100 ? 12 : 6; // adjust font brightness based on starting brightness
    this._brightness = brightness;
    this._dimmedColorValue = this.adjustBrightness(this._colorValue, this._brightness);
    // cache the dimmed color
    this.dimmedColor = this.hexColorString(this._dimmedColorValue);
    // note grid color is always brightness 4
    this.gridColor =
      this._brightness === this.gridBrightness
        ? this.dimmedColor
        : this.hexColorString(this.adjustBrightness(this._colorValue, this.gridBrightness));
    this.fontColor =
      this._brightness === this.fontBrightness
        ? this.dimmedColor
        : this.hexColorString(this.adjustBrightness(this._colorValue, this.fontBrightness));
  }

  private brightnessForHex(hex: string): number {
    // return 0-255 brightness value for a hex color
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return Math.round((r * 299 + g * 587 + b * 114) / 1000);
  }

  public get colorName(): string {
    return this.name;
  }

  public get rgbValue(): number {
    return this._dimmedColorValue;
  }

  public get rgbString(): string {
    //console.log(`rgbString() -> ${this.dimmedColor}`);
    return this.dimmedColor;
  }

  public get gridRgbString(): string {
    return this.gridColor;
  }

  public get fontRgbString(): string {
    return this.fontColor;
  }

  public static isValidColorName(colorName: string): boolean {
    const foundColor = DebugColor.colorNameToHex[colorName.toUpperCase()];
    console.log(`isValidColorName: ${colorName} -> ${foundColor}`);
    return foundColor !== undefined ? true : false;
  }

  private static colorNameToHexString(colorName: string): string {
    let hexString = DebugColor.colorNameToHex[colorName.toUpperCase()];
    if (!hexString) {
      console.log(`colorNameToHexString: Unknown color name: ${colorName}`);
      hexString = '#5a5a5a'; // default to gray
    }
    //console.log(`colorNameToHexString: ${colorName} -> ${hexString}`);
    return hexString;
  }

  private static rgbHexStringToNumber(hexString: string): number {
    const hexValue = hexString.startsWith('#') ? hexString.slice(1) : hexString;
    return parseInt(hexValue, 16);
  }

  private static colorNameToNumber(colorName: string): number {
    const rgbHexString: string = DebugColor.colorNameToHexString(colorName);
    const value: number = DebugColor.rgbHexStringToNumber(rgbHexString);
    //console.log(`colorNameToNumber: ${colorName} -> ${rgbHexString} (${value})`);
    return value;
  }

  private adjustBrightness(color: number, brightness: number): number {
    let adjustedColor: number = 0x000000;

    if (brightness === 0 || color === 0) {
      adjustedColor = 0x000000; // Special handling for brightness 0: return black
    } else if (brightness === 15) {
      adjustedColor = color; // Special handling for brightness 15: return original color
    } else {
      try {
        const r = ((color >> 16) & 0xff) * (brightness / 15);
        const g = ((color >> 8) & 0xff) * (brightness / 15);
        const b = (color & 0xff) * (brightness / 15);
        adjustedColor = ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);
      } catch (error) {
        console.log(`Error adjusting brightness: ${error}`);
      }
    }

    console.log(`adjustBrightness(0x${color.toString(16)},${brightness}) -> 0x${adjustedColor.toString(16)}`);

    return adjustedColor;
  }

  private hexColorString(colorValue: number): string {
    return `#${colorValue.toString(16).padStart(6, '0')}`;
  }

  // ----------------------------------------------------------------------
  // fun code to remember...
  private getRandomColor(): string {
    const colors: string[] = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

// Example usage
// const debugColor = new DebugColor('blue', 8);
// console.log(`Adjusted color value: ${debugColor.rgbValue.toString(16)}`);
