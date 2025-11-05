/** @format */

'use strict';

// src/classes/shared/displaySpecParser.ts

import { Position, Size, WindowColor } from '../debugWindowBase';
import { DebugColor } from './debugColor';
import { Spin2NumericParser } from './spin2NumericParser';

export interface BaseDisplaySpec {
  title: string;
  position: Position;
  hasExplicitPosition?: boolean; // Optional - true if POS clause was present
  size: Size;
  nbrSamples: number;
  window: WindowColor;
  hideXY?: boolean; // Optional - true if HIDEXY clause was present
}

export class DisplaySpecParser {
  /**
   * Parse common keywords that are shared between Logic and Scope windows
   * Returns true if a keyword was parsed, false otherwise
   */
  static parseCommonKeywords(lineParts: string[], index: number, spec: BaseDisplaySpec): [boolean, number] {
    const keyword = lineParts[index].toUpperCase();
    let consumed = 1; // number of parts consumed

    switch (keyword) {
      case 'TITLE':
        if (this.validateParameterCount(lineParts, index, 1)) {
          spec.title = this.removeQuotes(lineParts[index + 1]);
          consumed = 2;
          return [true, consumed];
        }
        break;

      case 'POS':
        // POS requires at least 1 parameter (X), Y is optional
        if (this.validateParameterCount(lineParts, index, 1)) {
          const [isValid, position, partsConsumed] = this.parsePosKeyword(lineParts, index);
          if (isValid) {
            spec.position = position;
            // Mark that an explicit position was provided
            if ('hasExplicitPosition' in spec) {
              (spec as any).hasExplicitPosition = true;
            }
            consumed = partsConsumed;
            return [true, consumed];
          }
        }
        break;

      case 'SIZE':
        if (this.validateParameterCount(lineParts, index, 2)) {
          const width = Spin2NumericParser.parsePixel(lineParts[index + 1]);
          const height = Spin2NumericParser.parsePixel(lineParts[index + 2]);
          if (width !== null && height !== null && width > 0 && height > 0) {
            spec.size = { width, height };
            consumed = 3;
            return [true, consumed];
          }
        }
        break;

      case 'SAMPLES':
        if (this.validateParameterCount(lineParts, index, 1)) {
          const samples = Spin2NumericParser.parseCount(lineParts[index + 1]);
          if (samples !== null && samples >= 0) { // Changed > to >= to allow 0 (infinite persistence)
            spec.nbrSamples = samples;
            consumed = 2;
            return [true, consumed];
          }
        }
        break;

      // NOTE: COLOR is NOT handled in shared parser because each window type
      // has different COLOR semantics (SCOPE/LOGIC use it for background+grid,
      // TERM uses it for text colors, etc.). Each window handles COLOR in its
      // own custom parsing code.
    }

    return [false, 0];
  }

  /**
   * Parse COLOR keyword with background and optional grid color
   * Format: COLOR <background> [<grid-color>]
   */
  static parseColorKeyword(lineParts: string[], index: number): [boolean, WindowColor, number] {
    const windowColor: WindowColor = {
      background: '#000000', // default black
      grid: '#808080' // default gray
    };

    if (index + 1 >= lineParts.length) {
      return [false, windowColor, 0];
    }
    
    let consumed = 1; // Start with COLOR keyword
    
    // Parse background color with potential brightness
    let bgColorSpec = lineParts[index + 1];
    consumed++;
    
    // Check if next part is a brightness value (0-15)
    if (index + 2 < lineParts.length && /^\d+$/.test(lineParts[index + 2])) {
      const brightness = Spin2NumericParser.parseCount(lineParts[index + 2]) ?? 0;
      if (brightness >= 0 && brightness <= 15) {
        bgColorSpec += ' ' + lineParts[index + 2];
        consumed++;
      }
    }
    
    const bgColor = this.parseColorValue(bgColorSpec);
    if (!bgColor) {
      return [false, windowColor, 0];
    }
    windowColor.background = bgColor;
    
    // Parse optional grid color with potential brightness
    if (index + consumed < lineParts.length) {
      let gridColorSpec = lineParts[index + consumed];
      const gridStartIndex = consumed;
      consumed++;
      
      // Check if this might be a color (not a command keyword)
      if (!this.isCommandKeyword(gridColorSpec)) {
        // Check for brightness value
        if (index + consumed < lineParts.length && /^\d+$/.test(lineParts[index + consumed])) {
          const brightness = Spin2NumericParser.parseCount(lineParts[index + consumed]) ?? 0;
          if (brightness >= 0 && brightness <= 15) {
            gridColorSpec += ' ' + lineParts[index + consumed];
            consumed++;
          }
        }
        
        const gridColor = this.parseColorValue(gridColorSpec);
        if (gridColor) {
          windowColor.grid = gridColor;
        } else {
          // Reset consumed if grid color parsing failed
          consumed = gridStartIndex;
        }
      } else {
        // Reset consumed since this is a command keyword, not a grid color
        consumed = gridStartIndex;
      }
    }
    
    return [true, windowColor, consumed];
  }
  
  /**
   * Check if a string is a known command keyword
   */
  private static isCommandKeyword(str: string): boolean {
    const keywords = ['TITLE', 'POS', 'SIZE', 'SAMPLES', 'COLOR', 'TRIGGER', 
                      'SPACING', 'DOTSIZE', 'LINESIZE', 'TEXTSIZE', 'CHANNEL'];
    return keywords.includes(str.toUpperCase());
  }

  /**
   * Parse POS keyword with x,y coordinates
   */
  static parsePosKeyword(lineParts: string[], index: number): [boolean, Position, number] {
    // Require at least 1 parameter (X position)
    if (index + 1 >= lineParts.length) {
      return [false, { x: 0, y: 0 }, 0];
    }

    const x = Spin2NumericParser.parseInteger(lineParts[index + 1], true); // Allow negatives for position
    if (x === null) {
      return [false, { x: 0, y: 0 }, 0];
    }

    // Y parameter is OPTIONAL - matches Pascal behavior (KeyPos procedure)
    // Pascal: if NextNum then Top := val (no else - silently uses default if not numeric)
    let y = 0; // Default Y position
    let consumed = 2; // POS keyword + X parameter

    if (index + 2 < lineParts.length) {
      // Check if next token is a keyword before trying to parse as Y coordinate
      if (!this.isCommandKeyword(lineParts[index + 2])) {
        const yValue = Spin2NumericParser.parseInteger(lineParts[index + 2], true);
        if (yValue !== null) {
          y = yValue;
          consumed = 3; // POS keyword + X + Y parameters
        }
      }
    }

    return [true, { x, y }, consumed];
  }

  /**
   * Validate that enough parameters exist after the current index
   */
  static validateParameterCount(lineParts: string[], index: number, requiredCount: number): boolean {
    return index + requiredCount < lineParts.length;
  }

  /**
   * Parse a color value from a string
   * Supports:
   * - Hex format: $RRGGBB or #RRGGBB
   * - Decimal format: numeric value
   * - Color names: BLACK, WHITE, ORANGE, BLUE, GREEN, CYAN, RED, MAGENTA, YELLOW, GRAY
   * - Color names with brightness: RED 12
   */
  private static parseColorValue(colorStr: string): string | null {
    // Use DebugColor's comprehensive color parsing
    const [isValid, hexColor, brightness] = DebugColor.parseColorSpec(colorStr);
    
    if (isValid) {
      // If brightness is not default, apply it to the color
      if (brightness !== DebugColor.defaultBrightness) {
        const debugColor = DebugColor.fromColorSpec(colorStr);
        if (debugColor) {
          return debugColor.rgbString; // This already has brightness applied
        }
      }
      return hexColor;
    }
    
    return null;
  }

  /**
   * Remove quotes from a string if present
   */
  private static removeQuotes(str: string): string {
    if (str.length >= 2) {
      if ((str[0] === '"' && str[str.length - 1] === '"') ||
          (str[0] === "'" && str[str.length - 1] === "'")) {
        return str.substring(1, str.length - 1);
      }
    }
    return str;
  }
}