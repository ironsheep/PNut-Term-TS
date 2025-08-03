/** @format */

'use strict';

// src/classes/shared/colorTranslator.ts

import { DebugColor } from '../debugColor';

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
        v = this.colorTune & 7;
        pixelValue = pixelValue & 0xFF;
        result = this.processLumaMode(pixelValue, v, this.colorMode);
        break;

      case ColorMode.RGBI8:
      case ColorMode.RGBI8W:
      case ColorMode.RGBI8X:
        v = (pixelValue >> 5) & 7;
        pixelValue = ((pixelValue & 0x1F) << 3) | ((pixelValue & 0x1C) >> 2);
        result = this.processLumaMode(pixelValue, v, this.colorMode);
        break;

      case ColorMode.HSV8:
      case ColorMode.HSV8W:
      case ColorMode.HSV8X:
        pixelValue = ((pixelValue & 0xF0) * 0x110) | ((pixelValue & 0x0F) * 0x11);
        v = this.polarColors[((pixelValue >> 8) + this.colorTune) & 0xFF];
        pixelValue = pixelValue & 0xFF;
        w = (this.colorMode === ColorMode.HSV8W) || 
            (this.colorMode === ColorMode.HSV8X && pixelValue >= 0x80);
        if (this.colorMode === ColorMode.HSV8X) {
          pixelValue = pixelValue >= 0x80 ? ((pixelValue & 0x7F) << 1) ^ 0xFE : pixelValue << 1;
        }
        if (w) v = v ^ 0xFFFFFF;
        result = this.multiplyColorComponents(v, pixelValue);
        break;

      case ColorMode.RGB8:
        result = ((pixelValue & 0xE0) * 0x0001249) & 0xFF0000 |
                 ((pixelValue & 0x1C) * 0x00091C) & 0x00FF00 |
                 ((pixelValue & 0x03) * 0x000055) & 0x0000FF;
        break;

      case ColorMode.HSV16:
      case ColorMode.HSV16W:
      case ColorMode.HSV16X:
        v = this.polarColors[((pixelValue >> 8) + this.colorTune) & 0xFF];
        pixelValue = pixelValue & 0xFF;
        w = (this.colorMode === ColorMode.HSV16W) || 
            (this.colorMode === ColorMode.HSV16X && pixelValue >= 0x80);
        if (this.colorMode === ColorMode.HSV16X) {
          pixelValue = pixelValue >= 0x80 ? ((pixelValue & 0x7F) << 1) ^ 0xFE : pixelValue << 1;
        }
        if (w) v = v ^ 0xFFFFFF;
        result = this.multiplyColorComponents(v, pixelValue);
        break;

      case ColorMode.RGB16:
        result = ((pixelValue & 0xF800) << 8) | ((pixelValue & 0xE000) << 3) |
                 ((pixelValue & 0x07E0) << 5) | ((pixelValue & 0x0600) >> 1) |
                 ((pixelValue & 0x001F) << 3) | ((pixelValue & 0x001C) >> 2);
        break;

      case ColorMode.RGB24:
        result = pixelValue & 0x00FFFFFF;
        break;
    }

    return result;
  }

  /**
   * Process LUMA and RGBI color modes
   */
  private processLumaMode(pixelValue: number, colorIndex: number, mode: ColorMode): number {
    const baseColorName = BASE_COLORS[colorIndex];
    const baseColor = new DebugColor(baseColorName);
    const baseRgb = baseColor.rgbValue;

    let r = (baseRgb >> 16) & 0xFF;
    let g = (baseRgb >> 8) & 0xFF;
    let b = baseRgb & 0xFF;

    const isWhiteMode = mode === ColorMode.LUMA8W || mode === ColorMode.RGBI8W;
    const isXMode = mode === ColorMode.LUMA8X || mode === ColorMode.RGBI8X;

    if (isXMode && pixelValue >= 0x80) {
      // X modes: scale from color to white for values >= 0x80
      pixelValue = ((pixelValue & 0x7F) << 1) ^ 0xFE;
      r = r ^ 0xFF;
      g = g ^ 0xFF;
      b = b ^ 0xFF;
    } else if (isWhiteMode) {
      // W modes: scale from white to color
      r = r ^ 0xFF;
      g = g ^ 0xFF;
      b = b ^ 0xFF;
    }

    // Apply pixel value scaling
    r = ((r * pixelValue + 0xFF) >> 8) & 0xFF;
    g = ((g * pixelValue + 0xFF) >> 8) & 0xFF;
    b = ((b * pixelValue + 0xFF) >> 8) & 0xFF;

    return (r << 16) | (g << 8) | b;
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
      const k = (i / 255.0) * 6.0 + tuning / 60.0;
      const j = Math.floor(k);
      const f = k - j;
      
      let v = [0, 0, 0];
      
      switch (j % 6) {
        case 0: v = [255, Math.round(f * 255), 0]; break;
        case 1: v = [Math.round((1 - f) * 255), 255, 0]; break;
        case 2: v = [0, 255, Math.round(f * 255)]; break;
        case 3: v = [0, Math.round((1 - f) * 255), 255]; break;
        case 4: v = [Math.round(f * 255), 0, 255]; break;
        case 5: v = [255, 0, Math.round((1 - f) * 255)]; break;
      }
      
      this.polarColors[i] = (v[0] << 16) | (v[1] << 8) | v[2];
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