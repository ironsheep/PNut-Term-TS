/** @format */

'use strict';

// src/classes/shared/lutManager.ts

/**
 * LUTManager manages color palettes for LUT1-8 color modes
 * Stores up to 256 RGB24 color values
 * No default palettes - all values must be user-provided
 */
export class LUTManager {
  private palette: number[] = [];

  /**
   * Get the current palette
   */
  public getPalette(): number[] {
    return [...this.palette]; // Return a copy
  }

  /**
   * Set the palette from an array of RGB24 values
   * @param colors Array of RGB24 color values (0x00RRGGBB format)
   */
  public setPalette(colors: number[]): void {
    // Limit to 256 entries
    this.palette = colors.slice(0, 256).map(c => c & 0xFFFFFF);
  }

  /**
   * Get a color from the palette by index
   * @param index Palette index (0-255)
   * @returns RGB24 color value or 0 if index is out of bounds or undefined
   */
  public getColor(index: number): number {
    if (index < 0 || index >= 256) {
      return 0;
    }
    return this.palette[index] || 0;
  }

  /**
   * Set a single color in the palette
   * @param index Palette index (0-255)
   * @param color RGB24 color value
   */
  public setColor(index: number, color: number): void {
    if (index >= 0 && index < 256) {
      // Ensure palette is large enough
      while (this.palette.length <= index) {
        this.palette.push(0);
      }
      this.palette[index] = color & 0xFFFFFF;
    }
  }

  /**
   * Clear the entire palette (set all to 0)
   */
  public clearPalette(): void {
    this.palette = [];
  }

  /**
   * Get the number of defined colors in the palette
   */
  public getPaletteSize(): number {
    return this.palette.length;
  }

  /**
   * Load palette from LUTCOLORS command format
   * Expects array of color values that can be numbers or strings
   * @param values Array of color values to load
   * @returns Number of colors successfully loaded
   */
  public loadFromLutColors(values: (number | string)[]): number {
    const colors: number[] = [];
    
    for (const value of values) {
      if (colors.length >= 256) break;
      
      let color = 0;
      if (typeof value === 'number') {
        color = value & 0xFFFFFF;
      } else if (typeof value === 'string') {
        // Try to parse hex string (with or without prefix)
        const cleaned = value.replace(/^[$#]/, '');
        const parsed = parseInt(cleaned, 16);
        if (!isNaN(parsed)) {
          color = parsed & 0xFFFFFF;
        }
      }
      
      colors.push(color);
    }
    
    this.setPalette(colors);
    return colors.length;
  }

  /**
   * Check if palette has enough colors for a specific LUT mode
   * @param mode LUT mode (1, 2, 4, or 8)
   * @returns true if palette has enough colors
   */
  public hasColorsForMode(mode: 1 | 2 | 4 | 8): boolean {
    const requiredColors = mode === 1 ? 2 : mode === 2 ? 4 : mode === 4 ? 16 : 256;
    return this.palette.length >= requiredColors;
  }
}