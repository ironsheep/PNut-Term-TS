/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
// src/classes/debugColor.ts

import { Spin2NumericParser } from './spin2NumericParser';

// Name-to-RGB hex lookup
export class DebugColor {
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

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
  static defaultBrightness: number = 8;
  static defaultFontBrightness: number = 12;
  static defaultGridBrightness: number = 6;
  // Chip's 10 basic colors from Pascal reference
  private static colorNameToHex: { [key: string]: string } = {
    BLACK: '#000000',   // Color 0
    WHITE: '#ffffff',   // Color 1
    ORANGE: '#ff7f00',  // Color 2 (was #FFA500 in parser)
    BLUE: '#7F7FFF',    // Color 3 (Pascal: $7F7FFF - Light Blue)
    GREEN: '#00ff00',   // Color 4 (Pascal: $00FF00 - Lime)
    CYAN: '#00ffff',    // Color 5 (Pascal: $00FFFF - Cyan)
    RED: '#ff0000',     // Color 6 (Pascal: $FF0000 - Red)
    MAGENTA: '#ff00ff', // Color 7 (Pascal: $FF00FF - Magenta)
    YELLOW: '#ffff00',  // Color 8 (Pascal: $FFFF00 - Yellow)
    GRAY: '#404040',    // Color 9 (Pascal: $404040 - Dark Gray)
    // Alternative spellings and legacy colors
    GREY: '#404040',    // Alternative spelling (matches GRAY)
    OLIVE: '#7F7F00',   // Legacy (Pascal: $7F7F00)
    LIME: '#00FF00',    // Legacy (Pascal: $00FF00 - same as GREEN)
    BLUE2: '#7F7FFF',   // Legacy (matches corrected BLUE)
    GRAY2: '#808080',   // Legacy (Pascal: $808080 - Medium Gray)
    GRAY3: '#D0D0D0'    // Legacy (Pascal: $D0D0D0 - Light Gray)
  };

  constructor(colorName: string, brightness: number = DebugColor.defaultBrightness) {
    // Validate brightness is 0-15
    if (brightness < 0 || brightness > 15) {
      // console.log(` DC: WARNING: brightness ${brightness} out of range 0-15, using default ${DebugColor.defaultBrightness}`);
      brightness = DebugColor.defaultBrightness;
    }
    
    this.name = colorName;
    this._colorValue = DebugColor.colorNameToNumber(colorName);
    this._colorHexValue = DebugColor.colorNameToHexString(colorName);
    this._calcBrightness = this.brightnessForHex(this._colorHexValue);
    this._brightness = brightness;
    
    // Apply brightness to get the actual display color
    this._dimmedColorValue = this.adjustBrightness(this._colorValue, this._brightness);
    this.dimmedColor = this.hexColorString(this._dimmedColorValue);
    
    // Grid and font colors use their own brightness levels
    this.gridBrightness = DebugColor.defaultGridBrightness;
    this.fontBrightness = DebugColor.defaultFontBrightness;
    
    this.gridColor = this.hexColorString(this.adjustBrightness(this._colorValue, this.gridBrightness));
    this.fontColor = this.hexColorString(this.adjustBrightness(this._colorValue, this.fontBrightness));
  }

  public static setDefaultBrightness(
    brightness: number,
    fontBrightness: number = 12,
    gridBrightness: number = 6
  ): void {
    DebugColor.defaultBrightness = brightness;
    DebugColor.defaultFontBrightness = fontBrightness;
    DebugColor.defaultGridBrightness = gridBrightness;
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
    //console.log(` DC: * rgbString() -> ${this.dimmedColor}`);
    return this.dimmedColor;
  }

  public get gridRgbString(): string {
    return this.gridColor;
  }

  public get fontRgbString(): string {
    return this.fontColor;
  }

  /**
   * Check if a color name is valid (case-insensitive)
   */
  public static isValidColorName(colorName: string): boolean {
    const foundColor = DebugColor.colorNameToHex[colorName.toUpperCase()];
    // console.log(` DC: * isValidColorName: ${colorName} -> ${foundColor}`);
    return foundColor !== undefined;
  }

  /**
   * Parse a color specification which can be:
   * - Color name: "RED"
   * - Color name with brightness: "RED 12"
   * - Hex color: "#FF0000" or "$FF0000"
   * - Decimal value: "16711680"
   * Returns [isValid, hexColor, brightness]
   */
  public static parseColorSpec(colorSpec: string): [boolean, string, number] {
    let hexColor = '#000000';
    let brightness = DebugColor.defaultBrightness;
    let isValid = false;

    // First check if it's a color name with optional brightness
    const parts = colorSpec.trim().split(/\s+/);
    if (parts.length >= 1) {
      const colorName = parts[0].toUpperCase();
      
      // Check if it's a valid color name
      if (DebugColor.colorNameToHex[colorName]) {
        hexColor = DebugColor.colorNameToHex[colorName];
        isValid = true;
        
        // Check for brightness value
        if (parts.length >= 2) {
          const brightnessValue = parseInt(parts[1], 10);
          if (!isNaN(brightnessValue) && brightnessValue >= 0 && brightnessValue <= 15) {
            brightness = brightnessValue;
          }
        }
      } else {
        // Not a color name, try parsing as numeric value
        // Use Spin2NumericParser which supports $hex, %binary, %%quaternary, and decimal formats
        const colorValue = Spin2NumericParser.parseColor(colorSpec);
        if (colorValue !== null) {
          hexColor = '#' + colorValue.toString(16).padStart(6, '0');
          isValid = true;
        }
        // Also support # prefix for hex (web-style)
        else if (colorSpec.startsWith('#')) {
          const hex = colorSpec.substring(1);
          if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
            hexColor = colorSpec;
            isValid = true;
          }
        }
      }
    }

    // console.log(` DC: * parseColorSpec(${colorSpec}) -> valid=${isValid}, hex=${hexColor}, brightness=${brightness}`);
    return [isValid, hexColor, brightness];
  }

  /**
   * Create a DebugColor instance from a color specification string
   */
  public static fromColorSpec(colorSpec: string): DebugColor | null {
    const [isValid, hexColor, brightness] = DebugColor.parseColorSpec(colorSpec);
    if (!isValid) {
      return null;
    }
    
    // Find the color name that matches this hex value
    let colorName = 'CUSTOM';
    for (const [name, hex] of Object.entries(DebugColor.colorNameToHex)) {
      if (hex.toUpperCase() === hexColor.toUpperCase()) {
        colorName = name;
        break;
      }
    }
    
    return new DebugColor(colorName, brightness);
  }

  private static colorNameToHexString(colorName: string): string {
    let hexString = DebugColor.colorNameToHex[colorName.toUpperCase()];
    if (hexString === undefined) {
      // console.log(` DC: * colorNameToHexString: Unknown color name: ${colorName}`);
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
    //console.log(` DC: * colorNameToNumber: ${colorName} -> ${rgbHexString} (${value})`);
    return value;
  }

  /**
   * Adjust color brightness according to Chip's brightness system (0-15)
   * 0 = black, 15 = full color, 1-14 = proportional brightness
   */
  private adjustBrightness(color: number, brightness: number): number {
    let adjustedColor: number = 0x000000;

    // Ensure brightness is in valid range 0-15
    brightness = Math.max(0, Math.min(15, brightness));

    if (brightness === 0 || color === 0) {
      adjustedColor = 0x000000; // Brightness 0: always black
    } else if (brightness === 15) {
      adjustedColor = color; // Brightness 15: full color
    } else {
      // Brightness 1-14: scale each RGB component proportionally
      try {
        const r = ((color >> 16) & 0xff) * (brightness / 15);
        const g = ((color >> 8) & 0xff) * (brightness / 15);
        const b = (color & 0xff) * (brightness / 15);
        adjustedColor = ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);
      } catch (error) {
        // console.log(` DC: ERROR adjusting brightness: ${error}`);
      }
    }

    // console.log(
    //   ` DC: * adjustBrightness(0x${color.toString(16).padStart(6, '0')}, ${brightness}) -> 0x${adjustedColor
    //     .toString(16)
    //     .padStart(6, '0')}`
    // );

    return adjustedColor;
  }

  /**
   * Get the RGB hex string with brightness applied
   */
  public rgbStringWithBrightness(brightness: number): string {
    const adjustedColor = this.adjustBrightness(this._colorValue, brightness);
    return this.hexColorString(adjustedColor);
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
// console.log(` DC: * Adjusted color value: ${debugColor.rgbValue.toString(16)}`);
