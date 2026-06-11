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

/**
 * Per-window clamp bounds for the shared SIZE / SAMPLES directives, mirroring the
 * Pascal constants (DebugDisplayUnit.pas:210-232) and KeyValWithin ranges. All
 * Pascal windows cap at SmoothFillMax = 2048; SIZE min is 32 except BITMAP (1);
 * SAMPLES lower bound is per-window (LOGIC 4, SCOPE 16). Pascal CLAMPS
 * (Within / KeyValWithin), never aborts, on out-of-range.
 */
export interface CommonKeywordBounds {
  sizeWMin: number;
  sizeWMax: number;
  sizeHMin: number;
  sizeHMax: number;
  samplesMin: number;
  samplesMax: number;
}

// Default = the common SmoothFillMax window bounds (scope_wmin..scope_wmax etc).
export const DEFAULT_COMMON_BOUNDS: CommonKeywordBounds = {
  sizeWMin: 32,
  sizeWMax: 2048,
  sizeHMin: 32,
  sizeHMax: 2048,
  samplesMin: 0,
  samplesMax: 2048
};

export class DisplaySpecParser {
  /**
   * Pascal FFT/SPECTRO sample-count selection (DebugDisplayUnit.pas:1576,1744):
   *   FFTexp := Trunc(Log2(Within(val, min, max)));  vSamples := 1 shl FFTexp;
   * i.e. clamp to [min,max], then take the LARGEST power of two <= the clamped
   * value (FLOOR of log2 — NOT round-to-nearest). e.g. 768 -> 512, 2048 -> 2048.
   * Uses integer doubling rather than Math.log2 to stay exact at the octave
   * boundaries (no floating-point undershoot).
   */
  /** Pascal Within(value, min, max): clamp to [min,max] (GlobalUnit.pas:222). */
  static clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  static floorPowerOfTwoWithin(value: number, min: number, max: number): number {
    const clamped = Math.max(min, Math.min(max, Math.floor(value)));
    let p = 1;
    while (p * 2 <= clamped) p *= 2;
    return p;
  }

  /**
   * Parse ONE color from the token stream — the canonical TS analog of Pascal
   * KeyColor (DebugDisplayUnit.pas:2752). Accepts a directive color NAME with an
   * optional trailing brightness (0-15, masked &15, RGBI8X) — except BLACK/WHITE
   * which are fixed and consume NO brightness, matching Pascal — or a bare
   * numeric / $hex / #rrggbb literal. Returns the resolved '#rrggbb' string plus
   * the index of the next unconsumed token, or null when the token at idx is not
   * a color (Pascal KeyColor returns False, leaving the token for the outer
   * directive loop — Dec(ptr)).
   *
   * This is the shared helper every window's directive-color site delegates to:
   * TERM COLOR/BACKCOLOR, SCOPE/LOGIC/SCOPE_XY/FFT background+grid (via
   * parseColorKeyword), and MIDI/PLOT/BITMAP COLOR/BACKCOLOR/SPARSE/LUTCOLORS
   * entries. The pixel color-MODE path (KeyColorMode/ColorTranslator) is a
   * DIFFERENT mechanism and is NOT a parseKeyColor site.
   */
  static parseKeyColor(lineParts: string[], idx: number): { rgb: string; nextIdx: number } | null {
    const token = lineParts[idx];
    if (token === undefined) {
      return null;
    }
    let colorSpec = token;
    let consumed = 1;
    const upper = token.toUpperCase();
    // RGBI8X named colors (but NOT BLACK/WHITE) may take an optional brightness byte.
    if (DebugColor.isValidDirectiveColorName(token) && upper !== 'BLACK' && upper !== 'WHITE') {
      const next = lineParts[idx + 1];
      if (next !== undefined && /^\d+$/.test(next)) {
        colorSpec = `${token} ${Number(next) & 15}`; // Pascal KeyColor: p := val and 15
        consumed = 2;
      }
    }
    const rgb = DebugColor.parseDirectiveColor(colorSpec);
    if (rgb === null) {
      return null;
    }
    return { rgb, nextIdx: idx + consumed };
  }

  /**
   * Numeric-policy convenience: parse the token at idx via Spin2NumericParser
   * (which handles $hex, %bin, %%quaternary, and 1_000 underscore literals that
   * raw Number()/parseInt() silently drop to NaN), then clamp to [min,max]
   * (Pascal Within). Returns null when the token is absent or not a valid
   * integer, so the caller leaves its default unchanged (Pascal KeyValWithin:
   * ignore-and-continue, never abort the window). `signed` allows negatives
   * through (Pascal NextNum is signed); pass false for count-only params.
   */
  static clampInt(
    lineParts: string[],
    idx: number,
    min: number,
    max: number,
    signed: boolean = true
  ): number | null {
    const token = lineParts[idx];
    if (token === undefined) {
      return null;
    }
    const value = Spin2NumericParser.parseInteger(token, signed);
    if (value === null) {
      return null;
    }
    return this.clamp(value, min, max);
  }

  /**
   * Parse common keywords that are shared between Logic and Scope windows
   * Returns true if a keyword was parsed, false otherwise
   */
  static parseCommonKeywords(
    lineParts: string[],
    index: number,
    spec: BaseDisplaySpec,
    bounds: CommonKeywordBounds = DEFAULT_COMMON_BOUNDS
  ): [boolean, number] {
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
        // Two-arg pixel SIZE (width height). Windows whose SIZE is single-arg
        // (SCOPE_XY radius, TERM cols, MIDI) supply <2 numbers here and fall
        // through to their own handler. Pascal KeySize CLAMPS to the per-window
        // bounds (Within), it does NOT abort on out-of-range. [9win §3]
        if (this.validateParameterCount(lineParts, index, 2)) {
          // Parse SIGNED (Pascal NextNum is signed) then clamp, so 0 / negative /
          // oversized all clamp into range rather than aborting the directive.
          const width = Spin2NumericParser.parseInteger(lineParts[index + 1], true);
          const height = Spin2NumericParser.parseInteger(lineParts[index + 2], true);
          if (width !== null && height !== null) {
            spec.size = {
              width: this.clamp(width, bounds.sizeWMin, bounds.sizeWMax),
              height: this.clamp(height, bounds.sizeHMin, bounds.sizeHMax)
            };
            consumed = 3;
            return [true, consumed];
          }
        }
        break;

      case 'SAMPLES':
        if (this.validateParameterCount(lineParts, index, 1)) {
          const samples = Spin2NumericParser.parseInteger(lineParts[index + 1], true);
          if (samples !== null) {
            // Pascal KeyValWithin CLAMPS to [min,max] (e.g. LOGIC 4..2047,
            // SCOPE 16..2048); never aborts on out-of-range. [9win §3]
            spec.nbrSamples = this.clamp(samples, bounds.samplesMin, bounds.samplesMax);
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
   * Parse the COLOR directive's background + optional grid colors (SCOPE / LOGIC
   * / SCOPE_XY / FFT). Each color is one KeyColor (parseKeyColor): a directive
   * NAME [brightness] or a numeric / $hex / #rrggbb literal. The grid color is
   * optional — a non-color token (e.g. the next directive keyword, or a numeric
   * brightness that is no longer attached to a name) ends the parse with the
   * grid default kept, matching Pascal (KeyColor returns False -> Dec(ptr) leaves
   * the token for the outer loop). `index` points at the COLOR keyword;
   * `consumed` counts COLOR plus its consumed color tokens.
   */
  static parseColorKeyword(lineParts: string[], index: number): [boolean, WindowColor, number] {
    const windowColor: WindowColor = {
      background: '#000000', // default black
      grid: '#808080' // default gray
    };

    const bg = this.parseKeyColor(lineParts, index + 1);
    if (bg === null) {
      return [false, windowColor, 0];
    }
    windowColor.background = bg.rgb;

    const grid = this.parseKeyColor(lineParts, bg.nextIdx);
    if (grid !== null) {
      windowColor.grid = grid.rgb;
      return [true, windowColor, grid.nextIdx - index];
    }

    return [true, windowColor, bg.nextIdx - index];
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