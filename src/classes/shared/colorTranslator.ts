/** @format */

'use strict';

// src/classes/shared/colorTranslator.ts

import { DebugColor } from './debugColor';

/**
 * Color mode enumeration matching Pascal implementation
 */
export enum ColorMode {
  LUT1 = 'LUT1',
  LUT2 = 'LUT2',
  LUT4 = 'LUT4',
  LUT8 = 'LUT8',
  LUMA8 = 'LUMA8',
  LUMA8W = 'LUMA8W',
  LUMA8X = 'LUMA8X',
  HSV8 = 'HSV8',
  HSV8W = 'HSV8W',
  HSV8X = 'HSV8X',
  RGBI8 = 'RGBI8',
  RGBI8W = 'RGBI8W',
  RGBI8X = 'RGBI8X',
  RGB8 = 'RGB8',
  HSV16 = 'HSV16',
  HSV16W = 'HSV16W',
  HSV16X = 'HSV16X',
  RGB16 = 'RGB16',
  RGB24 = 'RGB24'
}

/**
 * Base colors for LUMA and RGBI modes (0-7)
 */
const BASE_COLORS = [
  'ORANGE',  // 0
  'BLUE',    // 1
  'GREEN',   // 2
  'CYAN',    // 3
  'RED',     // 4
  'MAGENTA', // 5
  'YELLOW',  // 6
  'GRAY'     // 7
];

/**
 * ColorTranslator implements all 19 color modes from Pascal TranslateColor
 * Handles pixel value to RGB24 conversion for all Spin2 color modes
 */
export class ColorTranslator {
  private colorMode: ColorMode = ColorMode.RGB24;
  private colorTune: number = 0;
  private lutPalette: number[] = [];
  private polarColors: number[] = [];

  constructor() {
    this.initializePolarColors();
  }

  /**
   * Set the current color mode
   */
  public setColorMode(mode: ColorMode, tune: number = 0): void {
    this.colorMode = mode;
    this.colorTune = tune & 0xFF;
  }

  /**
   * Get the current color mode
   */
  public getColorMode(): ColorMode {
    return this.colorMode;
  }
  
  /**
   * Set the color tuning value
   */
  public setTune(tune: number): void {
    this.colorTune = tune & 0xFF;
  }

  /**
   * Set LUT palette values (up to 256 RGB24 colors)
   */
  public setLutPalette(palette: number[]): void {
    this.lutPalette = palette.slice(0, 256);
  }

  /**
   * Translate a pixel value to RGB24 based on current color mode
   * Matches Pascal TranslateColor function exactly
   */
  public translateColor(pixelValue: number): number {
    let result = 0;
    let v = 0;
    let w = false;

    switch (this.colorMode) {
      case ColorMode.LUT1:
        result = this.lutPalette[pixelValue & 0x01] || 0;
        break;

      case ColorMode.LUT2:
        result = this.lutPalette[pixelValue & 0x03] || 0;
        break;

      case ColorMode.LUT4:
        result = this.lutPalette[pixelValue & 0x0F] || 0;
        break;

      case ColorMode.LUT8:
        result = this.lutPalette[pixelValue & 0xFF] || 0;
        break;

      case ColorMode.LUMA8:
      case ColorMode.LUMA8W:
      case ColorMode.LUMA8X:
      case ColorMode.RGBI8:
      case ColorMode.RGBI8W:
      case ColorMode.RGBI8X:
        result = this.processLumaRgbiMode(pixelValue);
        break;


      case ColorMode.HSV8:
      case ColorMode.HSV8W:
      case ColorMode.HSV8X:
        // Expand 8-bit HSV to 16-bit: HHHHSSSS -> HHHHHHHH SSSSSSSS
        pixelValue = ((pixelValue & 0xF0) * 0x110) | ((pixelValue & 0x0F) * 0x11);
        // Fall through to HSV16 processing - NO BREAK HERE
      case ColorMode.HSV16:
      case ColorMode.HSV16W:
      case ColorMode.HSV16X:
        v = this.polarColors[((pixelValue >> 8) + this.colorTune) & 0xFF];
        pixelValue = pixelValue & 0xFF;
        w = (this.colorMode === ColorMode.HSV8W || this.colorMode === ColorMode.HSV16W) || 
            ((this.colorMode === ColorMode.HSV8X || this.colorMode === ColorMode.HSV16X) && pixelValue >= 0x80);
        if (this.colorMode === ColorMode.HSV8X || this.colorMode === ColorMode.HSV16X) {
          pixelValue = pixelValue >= 0x80 ? ((pixelValue & 0x7F) << 1) ^ 0xFE : pixelValue << 1;
        }
        if (w) v = v ^ 0xFFFFFF;
        result = (((v >> 16) & 0xFF) * pixelValue + 0xFF) >> 8 << 16 |
                 (((v >> 8) & 0xFF) * pixelValue + 0xFF) >> 8 << 8 |
                 (((v >> 0) & 0xFF) * pixelValue + 0xFF) >> 8 << 0;
        if (w) result = result ^ 0xFFFFFF;
        break;

      case ColorMode.RGB8:
        // Pascal: p and $E0 * $1236E and $FF0000 or
        //          p and $1C *   $91C and $00FF00 or
        //          p and $03 *    $55 and $0000FF
        result = ((pixelValue & 0xE0) * 0x01236E) & 0xFF0000 |
                 ((pixelValue & 0x1C) * 0x00091C) & 0x00FF00 |
                 ((pixelValue & 0x03) * 0x000055) & 0x0000FF;
        break;

      case ColorMode.RGB16:
        // Pascal expansion of 565 format to 888
        // Red: expand 5 bits to 8 bits by replicating top 3 bits
        // Green: expand 6 bits to 8 bits by replicating top 2 bits  
        // Blue: expand 5 bits to 8 bits by replicating top 3 bits
        result = ((pixelValue & 0xF800) << 8) | ((pixelValue & 0xE000) << 3) |  // R
                 ((pixelValue & 0x07E0) << 5) | ((pixelValue & 0x0600) >> 1) |  // G
                 ((pixelValue & 0x001F) << 3) | ((pixelValue & 0x001C) >> 2);   // B
        break;

      case ColorMode.RGB24:
        result = pixelValue & 0x00FFFFFF;
        break;
    }

    return result;
  }

  /**
   * Process LUMA and RGBI color modes
   * Matches Pascal implementation exactly
   */
  private processLumaRgbiMode(pixelValue: number): number {
    let p = pixelValue;
    let v: number;
    let w: boolean;
    
    // Determine color index and intensity
    if (this.colorMode === ColorMode.LUMA8 || 
        this.colorMode === ColorMode.LUMA8W || 
        this.colorMode === ColorMode.LUMA8X) {
      v = this.colorTune & 7;
      p = p & 0xFF;
    } else {
      // RGBI modes
      v = (p >> 5) & 7;
      p = ((p & 0x1F) << 3) | ((p & 0x1C) >> 2);
    }
    
    // Determine if we're in white mode
    w = (this.colorMode === ColorMode.LUMA8W || this.colorMode === ColorMode.RGBI8W) ||
        ((this.colorMode === ColorMode.LUMA8X || this.colorMode === ColorMode.RGBI8X) && 
         (v !== 7) && (p >= 0x80));
    
    // Handle X modes
    if ((this.colorMode === ColorMode.LUMA8X || this.colorMode === ColorMode.RGBI8X) && (v !== 7)) {
      if (p >= 0x80) {
        p = (~p & 0x7F) << 1;
      } else {
        p = p << 1;
      }
    }
    
    let result: number;
    
    if (w) {
      // From white to color
      if (v === 0) {
        // Orange special case
        result = (((p << 7) & 0x007F00) | p) ^ 0xFFFFFF;
      } else {
        if (v !== 7) v = v ^ 7;
        result = ((((v >> 2) & 1) * p) << 16) |
                 ((((v >> 1) & 1) * p) << 8) |
                 ((((v >> 0) & 1) * p) << 0);
        result = result ^ 0xFFFFFF;
      }
    } else {
      // From black to color
      if (v === 0) {
        // Orange special case
        result = (p << 16) | ((p << 7) & 0x007F00);
      } else {
        result = ((((v >> 2) & 1) * p) << 16) |
                 ((((v >> 1) & 1) * p) << 8) |
                 ((((v >> 0) & 1) * p) << 0);
      }
    }
    
    return result;
  }

  /**
   * Multiply color components by intensity value
   */
  private multiplyColorComponents(color: number, intensity: number): number {
    const r = ((((color >> 16) & 0xFF) * intensity + 0xFF) >> 8) & 0xFF;
    const g = ((((color >> 8) & 0xFF) * intensity + 0xFF) >> 8) & 0xFF;
    const b = (((color & 0xFF) * intensity + 0xFF) >> 8) & 0xFF;
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Initialize polar colors lookup table for HSV modes
   * Matches Pascal SetPolarColors implementation
   */
  private initializePolarColors(): void {
    const tuning = -7.2; // Pascal constant for exact red alignment
    
    for (let i = 0; i < 256; i++) {
      const v = [0, 0, 0];
      
      for (let j = 0; j < 3; j++) {
        let k = i + tuning + j * 256 / 3;
        if (k >= 256) k = k - 256;
        
        if (k < 256 * 2/6) {
          v[j] = 0;
        } else if (k < 256 * 3/6) {
          v[j] = Math.round((k - 256 * 2/6) / (256 * 3/6 - 256 * 2/6) * 255);
        } else if (k < 256 * 5/6) {
          v[j] = 255;
        } else {
          v[j] = Math.round((256 * 6/6 - k) / (256 * 6/6 - 256 * 5/6) * 255);
        }
      }
      
      this.polarColors[i] = (v[2] << 16) | (v[1] << 8) | v[0];
    }
  }

  /**
   * Parse color mode from string (for command processing)
   */
  public static parseColorMode(modeString: string): ColorMode | null {
    const upperMode = modeString.toUpperCase();
    return Object.values(ColorMode).find(mode => mode === upperMode) || null;
  }
}