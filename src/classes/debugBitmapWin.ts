/** @format */

'use strict';

// src/classes/debugBitmapWin.ts

import { DebugWindowBase } from './debugWindowBase';
import { Context } from '../utils/context';
import { ColorTranslator, ColorMode } from './shared/colorTranslator';
import { LUTManager } from './shared/lutManager';
import { TracePatternProcessor } from './shared/tracePatternProcessor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';
import { BrowserWindow } from 'electron';
import { PackedDataMode, ePackedDataMode, ePackedDataWidth } from './debugWindowBase';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { DisplaySpecParser, BaseDisplaySpec } from './shared/displaySpecParser';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

/**
 * Bitmap window state
 */
interface BitmapState {
  width: number;
  height: number;
  dotSizeX: number;
  dotSizeY: number;
  rate: number;
  rateCounter: number;
  backgroundColor: number;
  sparseMode: boolean;
  sparseColor: number; // Pascal vSparse — the SPARSE frame/border color (NOT the bitmap background)
  manualUpdate: boolean;
  tracePattern: number;
  colorMode: ColorMode;
  colorTune: number;
  isInitialized: boolean;
}

/**
 * Bitmap display specification
 */
export interface BitmapDisplaySpec {
  displayName: string;
  title: string;
  position?: { x: number; y: number };
  hasExplicitPosition?: boolean; // true if POS clause was in original message
  size?: { width: number; height: number };
  dotSize?: { x: number; y: number };
  backgroundColor?: number;
  hideXY?: boolean;
  explicitPackedMode?: PackedDataMode; // Explicit packed data mode from declaration (e.g., LONGS_2BIT)
  sparseColor?: number; // SPARSE directive - background color for sparse mode
  lutColors?: number[]; // LUTCOLORS directive - LUT palette colors
  tracePattern?: number; // TRACE directive - trace pattern (0-15)
  rate?: number; // RATE directive - update rate (0=manual, -1=fullscreen, >0=pixel count)
  manualUpdate?: boolean; // UPDATE directive - manual update mode flag
  colorMode?: ColorMode; // Color mode from declaration (LUT1, LUT2, RGB8, etc.)
  colorTune?: number; // Color tuning parameter (0-7)
}

/**
 * Debug BITMAP Window - Raster Graphics Display
 *
 * Displays bitmap/raster graphics with configurable trace patterns, color modes, and update rates.
 * Supports 12 different trace patterns for pixel plotting order and image orientation transformations.
 *
 * ## Features
 * - **Trace Patterns**: 12 different pixel plotting patterns (0-11) with rotation, flipping, and scrolling
 * - **Sparse Mode**: Memory-efficient mode for sparse pixel data
 * - **Color Modes**: Multiple color interpretation modes with tuning parameters
 * - **Manual/Auto Update**: Configurable update rates from real-time to full-screen buffering
 * - **LUT Support**: Lookup table colors for palette-based graphics
 * - **Input Forwarding**: PC_KEY and PC_MOUSE support with coordinate transformation
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE width height` - Set bitmap dimensions (4-2048, default: 256x256)
 * - `DOTSIZE x y` - Set pixel size multiplier (1-32, default: 1x1)
 * - `RATE rate` - Update frequency (0=manual, -1=full screen, >0=pixel count, default: 1)
 * - `SPARSE` - Enable sparse mode for memory efficiency
 * - `TRACE pattern` - Set trace pattern (0-11, default: 0 for normal raster scan)
 * - `CTUNE tune` - Color tuning parameter for color mode adjustment
 * - `COLOR bg` - Background color (default: BLACK)
 * - `HIDEXY` - Hide coordinate display
 *
 * ## Data Format
 * Pixel data is fed as color values, coordinates are determined by trace pattern:
 * - Direct pixel values: color data interpreted based on color mode
 * - Coordinate pairs: explicit x,y positioning when supported by trace pattern
 * - Packed data: efficient bulk pixel transfer using standard packed modes
 * - Example: `debug(\`MyBitmap TRACE 0 RATE 1\`(pixel_color))`
 *
 * ## Commands
 * - `CLEAR` - Clear display and reset pixel position
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
 * - `TRACE pattern` - Change trace pattern during runtime
 * - `RATE count` - Change update rate during runtime
 * - `LUT index color` - Set lookup table color
 * - `CTUNE value` - Adjust color tuning parameter
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `BITMAP_Configure` procedure (line 2364)
 * - Update: `BITMAP_Update` procedure (line 2408)
 * - Trace pattern handling: `Bitmap_Trace_Process` procedures
 * - Color management: `Bitmap_Color_Set` procedures
 *
 * ## Examples
 * ```spin2
 * ' Basic bitmap with normal raster scan
 * debug(`BITMAP MyBitmap SIZE 320 240 TRACE 0 RATE 320)
 * repeat y from 0 to 239
 *   repeat x from 0 to 319
 *     color := (x << 16) | (y << 8) | ((x+y) & $FF)
 *     debug(`MyBitmap \`(color))
 *
 * ' Rotated display with sparse mode
 * debug(`BITMAP MyBitmap SIZE 128 128 TRACE 5 SPARSE RATE -1)
 * ```
 *
 * ## Implementation Notes
 * - Supports 12 trace patterns combining rotation, flipping, and scrolling behavior
 * - Rate parameter controls update frequency: 0=manual, -1=full screen, >0=pixel count
 * - Sparse mode optimizes memory usage for images with large empty areas
 * - Color tuning parameter adjusts color interpretation and gamma correction
 * - Coordinate transformation for mouse input matches selected trace pattern
 * - LUT manager provides efficient palette-based color mapping
 *
 * ## Deviations from Pascal
 * - Enhanced color validation and error handling
 * - Additional sparse mode optimizations for memory efficiency
 * - Improved trace pattern coordinate calculations for accuracy
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_BITMAP.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugBitmapWindow extends DebugWindowBase {
  private displaySpec: BitmapDisplaySpec;

  private state: BitmapState;
  private colorTranslator: ColorTranslator;
  private lutManager: LUTManager;
  private traceProcessor: TracePatternProcessor;
  private canvasRenderer: CanvasRenderer;
  // Offscreen canvas not needed since we're drawing directly via CanvasRenderer
  private bitmapCanvasId: string;
  private initialPosition?: { x: number; y: number };
  private idString: string;
  private _windowTitle: string = '';
  private windowContent: string = '';

  // [#30] Render-IPC coalescing. At 2 Mbaud the old per-message awaited executeJavaScript
  // round-trip (one plotPixelBatch per pixel-message, ×N windows) saturated the main process
  // and starved the serial drain → dropped raw bytes. We now accumulate plotted pixels and
  // flush them to the renderer in coalesced batches on a timer, so serial processing never
  // awaits IPC. Display refresh stays rate-gated (displayDirty is only set on a rate cycle),
  // so visual cadence matches the pre-coalescing behavior.
  // [#30 perf] Pixels carry numeric rgb (0xRRGGBB), not a '#rrggbb' string — they're written into
  // a persistent ImageData and blitted with a single putImageData (one renderer op), instead of one
  // ctx.fillRect per pixel (which was the dominant renderer cost).
  private pendingPixels: Array<{ x: number; y: number; rgb: number }> = [];
  private displayDirty: boolean = false;
  // Batched renders flow through the inherited renderChain (DebugWindowBase) via scheduleRender();
  // the base SAVE awaits it through our flushBeforeCapture() override. [unified draw→save flow #49]
  private static readonly RENDER_FLUSH_MS = 16; // ~60 fps coalescing cadence

  // [#30 perf] GLOBAL render scheduler. Per-pixel cost is NOT the wall-clock gate (putImageData
  // barely moved it); the gate is N independent per-window 16ms flush
  // chains all piling AWAITED executeJavaScript onto the single renderer, out of order → a multi-
  // second renderer backlog (a 1,627px flush measured exe=1048ms = pure queue-wait) + the visible
  // reorder/jerk. ONE coordinated pass over ALL dirty windows in a STABLE order (creation order =
  // a,b,c,…), processed sequentially (each window awaited before the next) every ~RENDER_FLUSH_MS,
  // bounds the backlog to one pass and paints in order. Each window still flushes through its own
  // renderChain (shared with SAVE/UPDATE) so a window's batches never overlap.
  private static dirtyWindows: Set<DebugBitmapWindow> = new Set();
  private static renderTickTimer: ReturnType<typeof setTimeout> | null = null;
  private static renderPassRunning: boolean = false;
  private static nextRenderSeq: number = 0;
  private readonly renderSeq: number = DebugBitmapWindow.nextRenderSeq++;

  // Named-color table (Pascal key_black..key_gray order, DebugDisplayUnit.pas:32-41).
  // Used by SPARSE / LUTCOLORS / COLOR which accept color names via KeyColor (:2752). [9win §15]
  private static readonly NAMED_COLORS: { [name: string]: number } = {
    BLACK: 0,
    WHITE: 1,
    ORANGE: 2,
    BLUE: 3,
    GREEN: 4,
    CYAN: 5,
    RED: 6,
    MAGENTA: 7,
    YELLOW: 8,
    GRAY: 9,
    GREY: 9 // alternate spelling
  };

  // LUMA8/RGBI8 color-name tune values (orange..gray => 0..7). Pascal KeyColorMode
  // computes vColorTune := val - key_orange (:2797), valid only for LUMA modes. [9win §15]
  private static readonly COLOR_TUNE: { [name: string]: number } = {
    ORANGE: 0,
    BLUE: 1,
    GREEN: 2,
    CYAN: 3,
    RED: 4,
    MAGENTA: 5,
    YELLOW: 6,
    GRAY: 7,
    GREY: 7
  };

  // Lazily-built throwaway translator fixed to RGBI8X — mirrors Pascal KeyColor's
  // `TranslateColor(h shl 5 or p shl 1, key_rgbi8x)` for named colors (:2773). [9win §15]
  private static rgbi8xTranslator: ColorTranslator | null = null;

  /**
   * Translate a named-color RGBI8X index value to RGB24, exactly as Pascal KeyColor does.
   */
  private static translateRgbi8x(value: number): number {
    if (!DebugBitmapWindow.rgbi8xTranslator) {
      DebugBitmapWindow.rgbi8xTranslator = new ColorTranslator();
      DebugBitmapWindow.rgbi8xTranslator.setColorMode(ColorMode.RGBI8X);
    }
    return DebugBitmapWindow.rgbi8xTranslator.translateColor(value & 0xff);
  }

  /**
   * Parse a color name (with optional trailing brightness 0-15 for orange..gray) at
   * parts[index]. Mirrors the named-color branch of Pascal KeyColor (:2757-2773):
   *   BLACK -> $000000, WHITE -> $FFFFFF, else TranslateColor((h<<5)|(p<<1), key_rgbi8x)
   * where h = name-orange (0..7) and p = brightness (default 8). Returns null when the
   * token is not a recognized color name (caller then tries a raw numeric). [9win §15]
   */
  private static parseNamedColor(parts: string[], index: number): { color: number; consumed: number } | null {
    const tok = parts[index];
    if (tok === undefined) return null;
    const nameIdx = DebugBitmapWindow.NAMED_COLORS[tok.toUpperCase()];
    if (nameIdx === undefined) return null;
    if (nameIdx === 0) return { color: 0x000000, consumed: 1 }; // black
    if (nameIdx === 1) return { color: 0xffffff, consumed: 1 }; // white
    const h = nameIdx - 2; // orange..gray => 0..7
    let p = 8; // default brightness (Pascal: p := 8)
    let consumed = 1;
    const nxt = parts[index + 1];
    if (nxt !== undefined && /^-?\d+$/.test(nxt)) {
      p = parseInt(nxt, 10) & 15; // Pascal: p := val and 15
      consumed = 2;
    }
    const value = ((h << 5) | (p << 1)) & 0xff;
    return { color: DebugBitmapWindow.translateRgbi8x(value), consumed };
  }

  /**
   * Resolve ONE directive color token to its rgb24 integer via the shared
   * parseKeyColor — the canonical Pascal KeyColor analog (DebugDisplayUnit.pas:2752)
   * used by every window's directive-color site. Accepts a directive NAME with an
   * optional 0..15 brightness (RGBI8X) or a numeric / $hex / #rrggbb literal, and
   * returns null when the token is not a color (so the caller leaves it for the next
   * directive). BITMAP stores colors as 24-bit integers (vSparse / vLut[]), so the
   * helper's '#rrggbb' result is converted here. [9win §15]
   */
  private static parseKeyColorValue(parts: string[], index: number): { color: number; nextIdx: number } | null {
    const resolved = DisplaySpecParser.parseKeyColor(parts, index);
    if (resolved === null) {
      return null;
    }
    return { color: parseInt(resolved.rgb.slice(1), 16), nextIdx: resolved.nextIdx };
  }

  /** Pascal mode group: key_luma8..key_luma8x (tune may be a color name OR numeric). */
  private static isLumaMode(mode: ColorMode): boolean {
    return mode === ColorMode.LUMA8 || mode === ColorMode.LUMA8W || mode === ColorMode.LUMA8X;
  }

  /** Pascal mode group: key_hsv8..key_hsv8x, key_hsv16..key_hsv16x (numeric tune only). */
  private static isHsvMode(mode: ColorMode): boolean {
    return (
      mode === ColorMode.HSV8 ||
      mode === ColorMode.HSV8W ||
      mode === ColorMode.HSV8X ||
      mode === ColorMode.HSV16 ||
      mode === ColorMode.HSV16W ||
      mode === ColorMode.HSV16X
    );
  }

  /** Pascal mode group: key_luma8w/hsv8w/rgbi8w/hsv16w clear to white (GetBackground, :3200-3204). */
  private static isWhiteBackgroundMode(mode: ColorMode): boolean {
    return (
      mode === ColorMode.LUMA8W || mode === ColorMode.HSV8W || mode === ColorMode.RGBI8W || mode === ColorMode.HSV16W
    );
  }

  get windowTitle(): string {
    return this._windowTitle;
  }

  /**
   * Static console logging - override base class to use bitmap's ENABLE_CONSOLE_LOG
   */
  protected static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  /**
   * Parse bitmap display declaration
   */
  static parseBitmapDeclaration(lineParts: string[]): [boolean, BitmapDisplaySpec] {
    // here with lineParts = ['`BITMAP', {displayName}, ...]
    // Valid directives are:
    //   TITLE <title>
    //   POS <left> <top> [default: 0,0]
    //   SIZE <width> <height> [1-2048, default: 256x256]
    //   DOTSIZE <x> <y> [default: 1,1]
    //   COLOR <bgnd-color> [default: black]
    //   HIDEXY [default: not hidden]

    DebugBitmapWindow.logConsoleMessageStatic(`[BITMAP_WINDOW] CL: at parseBitmapDeclaration()`);
    let displaySpec: BitmapDisplaySpec = {} as BitmapDisplaySpec;
    displaySpec.displayName = '';
    displaySpec.title = 'Bitmap';

    let errorMessage = '';
    let isValid = true;

    if (lineParts.length < 2) {
      errorMessage = 'Bitmap display name missing';
      isValid = false;
    } else {
      displaySpec.displayName = lineParts[1];

      // Process remaining directives
      let i = 2;
      while (i < lineParts.length && isValid) {
        const directive = lineParts[i].toUpperCase();
        DebugBitmapWindow.logConsoleMessageStatic(
          `[BITMAP_PARSE] i=${i}, directive="${directive}" (from "${lineParts[i]}")`
        );

        // Try shared parser first for common keywords (TITLE, POS, SIZE, SAMPLES, COLOR)
        // Create a compatible spec object for the shared parser
        const compatibleSpec: Partial<BaseDisplaySpec> = {
          title: displaySpec.title,
          position: displaySpec.position || { x: 0, y: 0 },
          hasExplicitPosition: displaySpec.hasExplicitPosition,
          size: displaySpec.size || { width: 256, height: 256 },
          nbrSamples: 0, // Not used by BITMAP
          window: { background: '#000000', grid: '#808080' } // Not used by BITMAP
        };
        const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(
          lineParts,
          i,
          compatibleSpec as BaseDisplaySpec,
          // BITMAP: bitmap_wmin/hmin = 1 (not 32), max = SmoothFillMax 2048. [9win §3]
          { sizeWMin: 1, sizeWMax: 2048, sizeHMin: 1, sizeHMax: 2048, samplesMin: 0, samplesMax: 2048 }
        );
        if (parsed) {
          // Copy parsed values back to displaySpec
          displaySpec.title = compatibleSpec.title!;
          if (compatibleSpec.position) displaySpec.position = compatibleSpec.position;
          if (compatibleSpec.hasExplicitPosition) displaySpec.hasExplicitPosition = compatibleSpec.hasExplicitPosition;
          if (compatibleSpec.size) displaySpec.size = compatibleSpec.size;
          i += consumed - 1; // Adjust for loop increment below
          DebugBitmapWindow.logConsoleMessageStatic(
            `[BITMAP_PARSE] ✅ Parsed shared keyword "${directive}", consumed ${consumed} parts`
          );
        } else {
          // Handle BITMAP-specific keywords
          switch (directive) {
            case 'DOTSIZE': {
              // Pascal key_dotsize (DebugDisplayUnit.pas:2389): if KeyValWithin(vDotSize,
              // 1, 256) then vDotSizeY := vDotSize; KeyValWithin(vDotSizeY, 1, 256). So X
              // 1..256, optional Y 1..256 defaulting to X. Route through Spin2NumericParser
              // (signed, like Pascal NextNum) so %bin/$hex/underscored values parse; clamp
              // 1..256; ignore-and-continue, never abort. [9win §15]
              const x = DisplaySpecParser.clampInt(lineParts, i + 1, 1, 256, true);
              if (x !== null) {
                i++;
                let y = x; // Pascal: vDotSizeY := vDotSize before the optional second read
                const y2 = DisplaySpecParser.clampInt(lineParts, i + 1, 1, 256, true);
                if (y2 !== null) {
                  y = y2;
                  i++;
                }
                displaySpec.dotSize = { x, y };
              }
              break;
            }

            case 'HIDEXY':
              displaySpec.hideXY = true;
              break;

            case 'SPARSE': {
              // Pascal key_sparse: KeyColor(vSparse) (DebugDisplayUnit.pas:2390) — one
              // directive color via the shared parseKeyColor (a NAME [0..15 brightness] or
              // a numeric / $hex / #rrggbb literal), stored as a 24-bit int. Absent or
              // non-color leaves the default (no sparse); never abort. [9win §15]
              const sparse = DebugBitmapWindow.parseKeyColorValue(lineParts, i + 1);
              if (sparse !== null) {
                displaySpec.sparseColor = sparse.color;
                i = sparse.nextIdx - 1; // outer loop adds the trailing ++
              }
              break;
            }

            case 'TRACE': {
              // Pascal key_trace: KeyVal(vTrace) (DebugDisplayUnit.pas:2401) — an UNCLAMPED
              // integer (masked to a pattern via `and 7` at use), default 0. Route through
              // Spin2NumericParser for %bin/$hex; never clamp, never abort. [9win §15]
              if (i + 1 < lineParts.length) {
                const v = Spin2NumericParser.parseInteger(lineParts[i + 1], true);
                if (v !== null) {
                  displaySpec.tracePattern = v;
                  i++;
                }
              }
              break;
            }

            case 'RATE': {
              // Pascal key_rate: KeyVal(vRate) (DebugDisplayUnit.pas:2403) — an UNCLAMPED
              // integer, default 0; the -1 sentinel expands to width*height downstream
              // (preserved). Route through Spin2NumericParser for %bin/$hex; never abort. [9win §15]
              if (i + 1 < lineParts.length) {
                const v = Spin2NumericParser.parseInteger(lineParts[i + 1], true);
                if (v !== null) {
                  displaySpec.rate = v;
                  i++;
                }
              }
              break;
            }

            case 'LUTCOLORS':
              // Pascal key_lutcolors: KeyLutColors -> repeated KeyColor (DebugDisplayUnit.pas:2806).
              // Collect consecutive directive colors (NAME [brightness] or numeric/$hex) via the
              // shared parseKeyColor into the palette (index 0 upward); stop at the first
              // non-color token — it belongs to the next directive. Guarded; never abort. [9win §15]
              displaySpec.lutColors = [];
              for (;;) {
                const entry = DebugBitmapWindow.parseKeyColorValue(lineParts, i + 1);
                if (entry === null) {
                  break; // not a color -> next directive (also stops at end of tokens)
                }
                displaySpec.lutColors.push(entry.color);
                i = entry.nextIdx - 1; // outer loop adds the trailing ++
              }
              break;

            case 'UPDATE':
              displaySpec.manualUpdate = true;
              break;

            // Color mode commands (can be in declaration per Pascal)
            case 'LUT1':
            case 'LUT2':
            case 'LUT4':
            case 'LUT8':
            case 'LUMA8':
            case 'LUMA8W':
            case 'LUMA8X':
            case 'HSV8':
            case 'HSV8W':
            case 'HSV8X':
            case 'RGBI8':
            case 'RGBI8W':
            case 'RGBI8X':
            case 'RGB8':
            case 'HSV16':
            case 'HSV16W':
            case 'HSV16X':
            case 'RGB16':
            case 'RGB24':
              // Map color mode directive to ColorMode enum
              const colorModeMap: { [key: string]: ColorMode } = {
                LUT1: ColorMode.LUT1,
                LUT2: ColorMode.LUT2,
                LUT4: ColorMode.LUT4,
                LUT8: ColorMode.LUT8,
                LUMA8: ColorMode.LUMA8,
                LUMA8W: ColorMode.LUMA8W,
                LUMA8X: ColorMode.LUMA8X,
                HSV8: ColorMode.HSV8,
                HSV8W: ColorMode.HSV8W,
                HSV8X: ColorMode.HSV8X,
                RGBI8: ColorMode.RGBI8,
                RGBI8W: ColorMode.RGBI8W,
                RGBI8X: ColorMode.RGBI8X,
                RGB8: ColorMode.RGB8,
                HSV16: ColorMode.HSV16,
                HSV16W: ColorMode.HSV16W,
                HSV16X: ColorMode.HSV16X,
                RGB16: ColorMode.RGB16,
                RGB24: ColorMode.RGB24
              };
              displaySpec.colorMode = colorModeMap[directive];
              DebugBitmapWindow.logConsoleMessageStatic(
                `[BITMAP_PARSE] ✅ Set colorMode to ${displaySpec.colorMode} from directive "${directive}"`
              );

              // Check if next token is a tune parameter. Pascal KeyColorMode (:2786-2803):
              // ONLY LUMA8/HSV8/HSV16 groups consume a tune. LUMA accepts a color name
              // (ORANGE..GRAY => 0..7) OR a number; HSV accepts a number only. RGBI/LUT/RGB
              // consume NOTHING — a following value there is pixel data, not a tune. [9win §15]
              if (i + 1 < lineParts.length) {
                const mode = displaySpec.colorMode;
                const nextRaw = lineParts[i + 1];
                const nextToken = nextRaw.toUpperCase();
                if (DebugBitmapWindow.isLumaMode(mode)) {
                  if (/^-?\d+$/.test(nextRaw)) {
                    displaySpec.colorTune = parseInt(nextRaw, 10) & 0xff;
                    i++;
                  } else if (DebugBitmapWindow.COLOR_TUNE.hasOwnProperty(nextToken)) {
                    displaySpec.colorTune = DebugBitmapWindow.COLOR_TUNE[nextToken];
                    i++;
                  }
                  // else: not a color-name/number => leave for next directive (Pascal Dec(ptr))
                } else if (DebugBitmapWindow.isHsvMode(mode)) {
                  if (/^-?\d+$/.test(nextRaw)) {
                    displaySpec.colorTune = parseInt(nextRaw, 10) & 0xff;
                    i++;
                  }
                }
              }
              break;

            default:
              // Check if this is a packed data mode directive (e.g., LONGS_2BIT, BYTES_4BIT)
              const [isPackedMode, packedMode] = PackedDataProcessor.validatePackedMode(lineParts[i]);
              if (isPackedMode) {
                // Look ahead for ALT and SIGNED modifiers
                const keywords: string[] = [lineParts[i]];
                let lookahead = i + 1;

                // Check next two tokens for ALT and/or SIGNED modifiers
                while (lookahead < lineParts.length && lookahead <= i + 2) {
                  const nextToken = lineParts[lookahead].toUpperCase();
                  if (nextToken === 'ALT' || nextToken === 'SIGNED') {
                    keywords.push(lineParts[lookahead]);
                    lookahead++;
                  } else {
                    break;
                  }
                }

                // Parse mode with modifiers
                displaySpec.explicitPackedMode = PackedDataProcessor.parsePackedModeKeywords(keywords);
                DebugBitmapWindow.logConsoleMessageStatic(
                  `[BITMAP] Parsed packed data mode: ${keywords.join(' ')} (isAlternate=${
                    displaySpec.explicitPackedMode.isAlternate
                  })`
                );

                // Skip the modifier tokens we just consumed
                i = lookahead - 1; // -1 because loop will increment
              }
              // Unknown directives are gracefully skipped
              break;
          }
        }

        i++;
      }
    }

    if (!isValid) {
      DebugBitmapWindow.logConsoleMessageStatic(`[BITMAP_WINDOW] ERROR: parseBitmapDeclaration() - ${errorMessage}`);
    }

    return [isValid, displaySpec];
  }

  constructor(ctx: Context, displaySpec: BitmapDisplaySpec, windowId: string = `bitmap-${Date.now()}`) {
    super(ctx, windowId, 'bitmap');

    this.displaySpec = displaySpec;

    // Enable logging for BITMAP window
    this.isLogging = false;

    // Initialize from displaySpec
    this._windowTitle = displaySpec.title;
    this.idString = displaySpec.displayName;
    this.windowLogPrefix = 'bitW';
    this.initialPosition = displaySpec.position;

    // Initialize state with defaults, applying declaration directives
    this.state = {
      width: displaySpec.size?.width ?? 256,
      height: displaySpec.size?.height ?? 256,
      dotSizeX: displaySpec.dotSize?.x ?? 1,
      dotSizeY: displaySpec.dotSize?.y ?? 1,
      rate: displaySpec.rate ?? 0, // Default: auto-set based on trace pattern (Pascal default)
      rateCounter: 0,
      backgroundColor: displaySpec.backgroundColor ?? 0x000000,
      sparseMode: displaySpec.sparseColor !== undefined,
      sparseColor: displaySpec.sparseColor ?? 0x000000,
      manualUpdate: displaySpec.manualUpdate ?? false,
      tracePattern: displaySpec.tracePattern ?? 0,
      // Pascal SetDefaults: vColorMode := key_rgb24 (DebugDisplayUnit.pas:2889). The
      // BITMAP default is RGB24 (one 24-bit color per long), NOT RGB8 — defaulting to
      // RGB8 mis-decodes default RGB24 data. [9win §15]
      colorMode: displaySpec.colorMode ?? ColorMode.RGB24,
      colorTune: displaySpec.colorTune ?? 0,
      isInitialized: false
    };

    // Initialize shared components
    this.lutManager = new LUTManager();
    this.colorTranslator = new ColorTranslator();

    // Apply LUTCOLORS from declaration if provided. Pascal KeyLutColors fills vLut[0..$FF]
    // (DebugDisplayUnit.pas:2806-2814), so the palette holds up to 256 entries. [9win §15]
    if (displaySpec.lutColors && displaySpec.lutColors.length > 0) {
      for (let i = 0; i < displaySpec.lutColors.length && i < 256; i++) {
        this.lutManager.setColor(i, displaySpec.lutColors[i]);
      }
    }

    this.colorTranslator.setLutPalette(this.lutManager.getPalette());

    // Apply color mode and tune from declaration if provided
    if (displaySpec.colorMode !== undefined) {
      this.colorTranslator.setColorMode(displaySpec.colorMode);
      if (displaySpec.colorTune !== undefined) {
        this.colorTranslator.setTune(displaySpec.colorTune);
      }
    }

    this.traceProcessor = new TracePatternProcessor();
    this.canvasRenderer = new CanvasRenderer();

    // Apply TRACE pattern from declaration if provided
    if (displaySpec.tracePattern !== undefined) {
      this.traceProcessor.setPattern(displaySpec.tracePattern);
    }

    // Pascal vSparse is the sparse-dot FRAME color, not the bitmap background. The bitmap is
    // cleared to GetBackground() (black, or white for W modes); the sparse color only tints the
    // outer square of each sparse dot. Stored in state.sparseColor (see BITMAP_Update sparse
    // branch, DebugDisplayUnit.pas:2466-2478). Do NOT overwrite state.backgroundColor. [9win §15]

    // Set up canvas ID for bitmap
    this.bitmapCanvasId = `bitmap-canvas-${this.idString}`;

    // Initialize bitmap canvas with either explicit SIZE or defaults (256x256)
    // Must always initialize to set isInitialized=true so window can process messages
    this.setBitmapSize(this.state.width, this.state.height);

    // Set USB serial connection for input forwarding
    // Note: USB serial will be set later when available

    // Set scroll callback for trace processor
    this.traceProcessor.setScrollCallback((x: number, y: number) => {
      this.scrollBitmap(x, y);
    });
  }

  /**
   * Close the bitmap window
   */
  closeDebugWindow(): void {
    // Stop input polling
    this.inputForwarder.stopPolling();

    // [#30] Deregister from the global render scheduler and drop any still-queued pixels — the
    // window is gone, so they can't be drawn. runRenderPass also skips a window once debugWindow
    // is null, so a window closed mid-pass is safe.
    DebugBitmapWindow.dirtyWindows.delete(this);
    this.pendingPixels = [];
    this.displayDirty = false;

    // Clean up window reference
    this.debugWindow = null;
  }

  /**
   * Process debug commands and data
   */
  protected async processMessageImmediate(lineParts: string[]): Promise<void> {
    // First, let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    // Window name was already stripped by mainWindow routing
    if (await this.handleCommonCommand(lineParts)) {
      return; // Base class handled it
    }

    // Track where pixel data starts (after processing commands)
    let dataStartIndex = 0;

    // Process commands
    for (let i = 0; i < lineParts.length; i++) {
      const part = lineParts[i].toUpperCase();

      // Check for bitmap size (first two values) - only if not initialized
      if (i === 0 && !this.state.isInitialized && this.isNumeric(part)) {
        const width = parseInt(part);
        if (i + 1 < lineParts.length && this.isNumeric(lineParts[i + 1])) {
          const height = parseInt(lineParts[i + 1]);
          if (width >= 1 && width <= 2048 && height >= 1 && height <= 2048) {
            this.setBitmapSize(width, height);
            dataStartIndex = 2;
            i++; // Skip height
            continue;
          } else {
            this.logMessage(`ERROR: Bitmap size out of range (${width}x${height}). Must be 1-2048 x 1-2048`);
            return; // Invalid size, stop processing
          }
        } else {
          this.logMessage(`ERROR: Bitmap size missing height value`);
          return;
        }
      }

      // Parse commands
      switch (part) {
        case 'SET':
          if (i + 2 < lineParts.length) {
            // Pascal key_set: KeyValWithin(vPixelX, 0, vWidth-1) then
            // KeyValWithin(vPixelY, 0, vHeight-1) (DebugDisplayUnit.pas:2418) — numeric via
            // Spin2NumericParser and CLAMP into the bitmap (setPixelPosition would otherwise
            // reject out-of-range; Pascal clamps). [9win §15]
            const x = Spin2NumericParser.parseInteger(lineParts[i + 1], true);
            const y = Spin2NumericParser.parseInteger(lineParts[i + 2], true);
            if (x !== null && y !== null) {
              this.setPixelPosition(
                DisplaySpecParser.clamp(x, 0, this.state.width - 1),
                DisplaySpecParser.clamp(y, 0, this.state.height - 1)
              );
              dataStartIndex = i + 3;
              i += 2;
            } else {
              this.logMessage(`ERROR: SET command requires two numeric coordinates`);
            }
          } else {
            this.logMessage(`ERROR: SET command missing X and/or Y coordinates`);
          }
          break;

        case 'SCROLL':
          if (i + 2 < lineParts.length) {
            // Pascal key_scroll: KeyValWithin(x, -vWidth, vWidth) / (y, -vHeight, vHeight)
            // (DebugDisplayUnit.pas:2422); scrollBitmap already clamps, so just route the
            // numerics through Spin2NumericParser (%bin/$hex). [9win §15]
            const scrollX = Spin2NumericParser.parseInteger(lineParts[i + 1], true);
            const scrollY = Spin2NumericParser.parseInteger(lineParts[i + 2], true);
            if (scrollX !== null && scrollY !== null) {
              this.scrollBitmap(scrollX, scrollY);
              dataStartIndex = i + 3;
              i += 2;
            } else {
              this.logMessage(`ERROR: SCROLL command requires two numeric coordinates`);
            }
          } else {
            this.logMessage(`ERROR: SCROLL command missing X and/or Y coordinates`);
          }
          break;

        case 'TRACE':
          if (i + 1 < lineParts.length) {
            // Pascal key_trace: if NextNum then SetTrace(val, True) (DebugDisplayUnit.pas:2415) —
            // act only on a real number; route through Spin2NumericParser. [9win §15]
            const pattern = Spin2NumericParser.parseInteger(lineParts[i + 1], true);
            if (pattern !== null) {
              this.setTracePattern(pattern);
              dataStartIndex = i + 2;
              i++;
            }
          }
          break;

        case 'RATE':
          if (i + 1 < lineParts.length) {
            // Pascal key_rate: KeyVal(vRate) (DebugDisplayUnit.pas:2416) — route through
            // Spin2NumericParser (%bin/$hex); the -1 sentinel is honored downstream. [9win §15]
            const rate = Spin2NumericParser.parseInteger(lineParts[i + 1], true);
            if (rate !== null) {
              this.setRate(rate);
              dataStartIndex = i + 2;
              i++;
            }
          }
          break;

        // NOTE: BITMAP_Update (DebugDisplayUnit.pas:2416) has NO runtime DOTSIZE or SPARSE
        // command — those are configure-only (BITMAP_Configure, :2389/:2390). A DOTSIZE/SPARSE
        // key arriving at runtime falls through to default (no color-mode match), is ignored,
        // and any following numbers are processed as pixel data — matching Pascal, where an
        // unhandled key is consumed by the case and the numbers feed the pixel loop. [9win §15]

        default: {
          // Check for color-mode / LUTCOLORS commands. The handler reports exactly how many
          // following tokens it consumed (tune values or LUT colors) so the cursor advances
          // precisely — pixel data after a no-tune mode (RGBI8/LUT*/RGB*) is preserved. [9win §15]
          const consumed = this.parseColorModeCommand(part, lineParts.slice(i + 1));
          if (consumed >= 0) {
            i += consumed; // skip the consumed tune / LUT-color tokens
            dataStartIndex = i + 1; // data (if any) starts after them
          }
          break;
        }
      }
    }

    // Process numeric data values
    if (dataStartIndex < lineParts.length) {
      await this.processDataValues(lineParts.slice(dataStartIndex));
    }
  }

  /**
   * Override base class method for CLEAR command
   * Called by base class handleCommonCommand() when CLEAR is received
   */
  protected clearDisplayContent(): void {
    // [#30] Discard queued pixels — they arrived before this CLEAR and would be wiped by
    // it, so flushing them is pointless and would leave zombie pixels drawn after the clear.
    this.pendingPixels = [];
    this.displayDirty = false;
    this.clearBitmap();
    // Pascal key_clear: SetTrace(vTrace, True) (DebugDisplayUnit.pas:2447, :2973-2980).
    // Restart the trace pixel position at the pattern's origin AND (ModifyRate=True)
    // reset vRate to a full scan — width for horizontal patterns (0-3), height for
    // vertical patterns (4-7). Without this, new data after CLEAR resumes from the
    // stale mid-bitmap trace position. [9win §6]
    this.traceProcessor.setPattern(this.state.tracePattern, true);
    this.state.rate = (this.state.tracePattern & 0x7) <= 3 ? this.state.width : this.state.height;
  }

  /**
   * Override base class method for UPDATE command
   * Called by base class handleCommonCommand() when UPDATE is received
   */
  protected async forceDisplayUpdate(): Promise<void> {
    // [#30] Drain any queued pixels into the offscreen first, then refresh. flushRenderQueue
    // also performs the updateCanvas when displayDirty, but call it explicitly here so an
    // UPDATE with no preceding rate cycle still repaints.
    this.displayDirty = true;
    await this.flushRenderQueue();
  }

  /**
   * [#30/#49] SAVE captures the on-screen canvas/window, so any pixels still queued by the
   * coalescing render timer must be flushed (and the display repainted) BEFORE the capture, or the
   * saved image would be missing the most-recent pixels. Normal mode: force a final batch flush +
   * repaint onto the chain. Sparse mode: the per-dot draws are already on the chain (scheduleRender),
   * so just await it. Then defer to the base, which awaits renderChain (with its timeout guard).
   * The base SAVE methods call this; BITMAP no longer overrides them. [unified draw→save flow #49]
   */
  protected async flushBeforeCapture(): Promise<void> {
    if (!this.state.sparseMode) {
      this.displayDirty = true;
      await this.flushRenderQueue();
    }
    await super.flushBeforeCapture();
  }

  /**
   * Read SAVE pixels from the bitmap canvas BACKING STORE (toDataURL) instead of capturePage. The
   * pixels/sparse-dots ARE drawn to this canvas and visible on screen, but capturePage returns a
   * stale composited frame for the quiescent window — which dropped all but ~1 SPARSE dot from the
   * saved BMP. Reading the canvas directly captures exactly what's drawn. [#49 capture readback]
   */
  protected getCaptureCanvasId(): string | null {
    return this.bitmapCanvasId;
  }

  /**
   * Set bitmap size and initialize canvas
   */
  private setBitmapSize(width: number, height: number): void {
    // Clamp to valid range
    this.state.width = Math.max(1, Math.min(2048, width));
    this.state.height = Math.max(1, Math.min(2048, height));

    // Pascal SetSize (DebugDisplayUnit.pas:2938): sparse rendering only applies when BOTH dot
    // dimensions are >= 4 (it needs room to draw a bordered dot); otherwise vSparse := -1
    // (sparse disabled). [9win §15]
    this.enforceSparseDotSizeConstraint();

    // Update trace processor
    this.traceProcessor.setBitmapSize(this.state.width, this.state.height);

    // Update input forwarder window dimensions + dot size. Pascal computes the PC_MOUSE
    // wire coordinates from vDotSize/vDotSizeY, which are fixed at Configure — so the
    // forwarder must learn the create-time dot size here (it is no longer set by a
    // runtime DOTSIZE command, which BITMAP_Update does not have). [9win §15]
    this.inputForwarder.setWindowDimensions(this.state.width, this.state.height);
    this.inputForwarder.setDotSize(this.state.dotSizeX, this.state.dotSizeY);

    // Initialize canvas if not already done
    if (!this.state.isInitialized) {
      this.initializeCanvas();
    }

    // Handle special rate values (Pascal logic)
    if (this.state.rate === -1) {
      // Rate -1 means full screen update: set to width * height
      this.state.rate = this.state.width * this.state.height;
      this.logMessage(
        `[RATE INIT] rate=-1 expanded to width*height=${this.state.rate} for ${this.state.width}x${this.state.height} window`
      );
    } else if (this.state.rate === 0) {
      // Rate 0 means auto-set based on trace pattern (Pascal: SetTrace with ModifyRate=true)
      // For horizontal scan patterns (0-3): use width
      // For vertical scan patterns (4-7): use height
      const basePattern = this.state.tracePattern & 0x7; // Get base pattern (0-7)
      if (basePattern <= 3) {
        this.state.rate = this.state.width;
        this.logMessage(
          `[RATE INIT] rate=0 with horizontal trace ${this.state.tracePattern} → rate=width=${this.state.rate}`
        );
      } else {
        this.state.rate = this.state.height;
        this.logMessage(
          `[RATE INIT] rate=0 with vertical trace ${this.state.tracePattern} → rate=height=${this.state.rate}`
        );
      }
    } else {
      this.logMessage(`[RATE INIT] Using explicit rate=${this.state.rate} for tracePattern=${this.state.tracePattern}`);
    }

    this.state.isInitialized = true;
  }

  /**
   * Initialize the bitmap canvas
   */
  private initializeCanvas(): void {
    // Set up the visible canvas
    const canvasHTML = `
      <canvas id="${this.bitmapCanvasId}"
              width="${this.state.width * this.state.dotSizeX}"
              height="${this.state.height * this.state.dotSizeY}"
              style="image-rendering: pixelated; width: 100%; height: 100%;">
      </canvas>
      <div id="coordinate-display"></div>
    `;

    // Create window if not exists
    if (!this.debugWindow) {
      this.createDebugWindow(canvasHTML);
    } else {
      // Update existing window content
      this.debugWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '${canvasHTML}';
      `);
    }

    // Clear to background color
    this.clearBitmap();
  }

  /**
   * Clear bitmap to background color
   */
  private clearBitmap(): void {
    if (!this.debugWindow) return;

    // Clear color is the mode-dependent background (Pascal ClearBitmap -> GetBackground,
    // :3240) — white for W modes, palette[0] for LUT modes, else black. It is NOT the SPARSE
    // color. [9win §15]
    const bgColor = this.getBackground();
    const r = (bgColor >> 16) & 0xff;
    const g = (bgColor >> 8) & 0xff;
    const b = bgColor & 0xff;

    // Initialize offscreen canvas if needed and clear both canvases
    const clearJS = `
      (function() {
        const canvas = document.getElementById('${this.bitmapCanvasId}');
        if (!canvas) return;

        // Create offscreen canvas if it doesn't exist (use bracket notation for hyphenated IDs)
        const offscreenKey = 'bitmapOffscreen_${this.bitmapCanvasId}';
        if (!window[offscreenKey]) {
          window[offscreenKey] = document.createElement('canvas');
          window[offscreenKey].width = ${this.state.width};
          window[offscreenKey].height = ${this.state.height};
        }

        const offscreen = window[offscreenKey];
        const offCtx = offscreen.getContext('2d');
        if (offCtx) {
          offCtx.fillStyle = 'rgb(${r}, ${g}, ${b})';
          offCtx.fillRect(0, 0, ${this.state.width}, ${this.state.height});
        }
        // [#30 perf] invalidate the persistent pixel store so the next plot re-syncs from this clear
        delete window['bitmapImageData_${this.bitmapCanvasId}'];

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(${r}, ${g}, ${b})';
          ctx.fillRect(0, 0, ${this.state.width * this.state.dotSizeX}, ${this.state.height * this.state.dotSizeY});
        }
      })();
    `;

    this.debugWindow.webContents.executeJavaScript(clearJS).catch((error) => {
      this.logMessage(`Failed to execute bitmap clear JavaScript: ${error}`);
    });
  }

  /**
   * Set pixel position
   */
  private setPixelPosition(x: number, y: number): void {
    if (!this.state.isInitialized) {
      this.logMessage('ERROR: Cannot set pixel position before bitmap size is defined');
      return;
    }

    // Validate coordinates
    if (x < 0 || x >= this.state.width || y < 0 || y >= this.state.height) {
      this.logMessage(
        `ERROR: Invalid pixel coordinates (${x},${y}). Must be within 0-${this.state.width - 1} x 0-${
          this.state.height - 1
        }`
      );
      return;
    }

    this.traceProcessor.setPosition(x, y);
  }

  /**
   * Update the visible canvas from offscreen canvas
   * Pascal equivalent: Canvas.StretchDraw(Rect(0, 0, vClientWidth, vClientHeight), Bitmap[1])
   */
  private async updateCanvas(): Promise<void> {
    if (!this.debugWindow) {
      this.logMessage(`[UPDATE CANVAS] ERROR: debugWindow is null`);
      return;
    }

    // HOT PATH: guard — runs on every rate cycle. [#30]
    if (this.isLogging)
      this.logMessage(
        `[UPDATE CANVAS] Executing StretchDraw: ${this.state.width}x${this.state.height} → ${
          this.state.width * this.state.dotSizeX
        }x${this.state.height * this.state.dotSizeY}`
      );

    const stretchJS = `
      (function() {
        const canvas = document.getElementById('${this.bitmapCanvasId}');
        if (!canvas) return;

        const offscreenKey = 'bitmapOffscreen_${this.bitmapCanvasId}';
        const offscreen = window[offscreenKey];
        if (!offscreen) return;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Disable image smoothing for pixel-perfect scaling
          ctx.imageSmoothingEnabled = false;
          ctx.webkitImageSmoothingEnabled = false;
          ctx.msImageSmoothingEnabled = false;

          // StretchDraw: Draw offscreen (logical bitmap) to display canvas with scaling
          ctx.drawImage(offscreen,
            0, 0, ${this.state.width}, ${this.state.height},
            0, 0, ${this.state.width * this.state.dotSizeX}, ${this.state.height * this.state.dotSizeY}
          );
        }
      })();
    `;

    // Now properly await the JavaScript execution
    try {
      await this.debugWindow.webContents.executeJavaScript(stretchJS);
    } catch (error) {
      this.logMessage(`Failed to execute StretchDraw: ${error}`);
    }
  }

  /**
   * Plot multiple pixels in a single batched operation (NORMAL mode only)
   * This dramatically improves performance by reducing IPC calls from O(n) to O(1)
   */
  private async plotPixelBatch(pixels: Array<{ x: number; y: number; rgb: number }>): Promise<void> {
    if (!this.debugWindow || pixels.length === 0) {
      return;
    }

    if (this.isLogging)
      this.logMessage(`[BATCH PLOT] Plotting ${pixels.length} pixels to canvas '${this.bitmapCanvasId}'`);

    // [#30 perf] The renderer writes each pixel into a persistent ImageData (a typed-array store)
    // and blits it with ONE putImageData — replacing the per-pixel ctx.fillRect loop that dominated
    // render time. The ImageData is a cache of the offscreen: clearBitmap/scrollBitmap delete it so
    // the next batch re-syncs from the (freshly cleared/scrolled) offscreen via a single getImageData.
    const batchJS = `
      (function() {
        const offscreenKey = 'bitmapOffscreen_${this.bitmapCanvasId}';
        const offscreen = window[offscreenKey];
        if (!offscreen) {
          console.error('[BATCH ERROR] Offscreen canvas not found: ' + offscreenKey);
          return 'ERROR: Canvas not found';
        }

        const offCtx = offscreen.getContext('2d');
        if (!offCtx) {
          console.error('[BATCH ERROR] Offscreen context not available');
          return 'ERROR: Context not available';
        }

        const W = ${this.state.width}, H = ${this.state.height};
        const idKey = 'bitmapImageData_${this.bitmapCanvasId}';
        let id = window[idKey];
        if (!id || id.width !== W || id.height !== H) {
          // (re)sync the pixel store from the current offscreen (post clear/scroll/init)
          id = offCtx.getImageData(0, 0, W, H);
          window[idKey] = id;
        }
        const d = id.data;
        const px = ${JSON.stringify(pixels)};
        for (let i = 0; i < px.length; i++) {
          const p = px[i];
          const o = (p.y * W + p.x) * 4;
          d[o] = (p.rgb >> 16) & 255;
          d[o + 1] = (p.rgb >> 8) & 255;
          d[o + 2] = p.rgb & 255;
          d[o + 3] = 255;
        }
        offCtx.putImageData(id, 0, 0);
        return 'SUCCESS: ' + px.length + ' pixels plotted';
      })();
    `;

    try {
      const result = await this.debugWindow.webContents.executeJavaScript(batchJS);
      if (this.isLogging) this.logMessage(`[BATCH RESULT] ${result}`);
    } catch (error) {
      this.logMessage(`[BATCH ERROR] Failed to execute batch pixel plot: ${error}`);
    }
  }

  /**
   * Scroll bitmap content
   */
  private scrollBitmap(scrollX: number, scrollY: number): void {
    if (!this.state.isInitialized) return;

    // Clamp scroll values
    scrollX = Math.max(-this.state.width, Math.min(this.state.width, scrollX));
    scrollY = Math.max(-this.state.height, Math.min(this.state.height, scrollY));

    if (!this.debugWindow) return;

    // [#30] Flush any queued pixels to the offscreen FIRST so the scroll moves them along
    // with the rest of the image. drainPendingPixelsNow queues the pixel draw on the
    // webContents synchronously, ahead of the scroll's executeJavaScript below.
    this.drainPendingPixelsNow();

    // Scroll the OFFSCREEN BITMAP where pixel data lives, not the display canvas
    // The display canvas gets updated from the offscreen bitmap via updateCanvas()
    // NOTE: We don't clear the exposed edge - new pixels will overwrite it immediately
    // This avoids async timing issues where clear might execute after updateCanvas()
    const scrollCode = `(function() {
const offscreenKey = 'bitmapOffscreen_${this.bitmapCanvasId}';
const offscreen = window[offscreenKey];
if (!offscreen) { console.error('Offscreen bitmap not found: ' + offscreenKey); return; }
const ctx = offscreen.getContext('2d');
if (!ctx) { console.error('Offscreen context not available'); return; }
// Create temp canvas to hold current bitmap
const tempCanvas = document.createElement('canvas');
tempCanvas.width = ${this.state.width};
tempCanvas.height = ${this.state.height};
const tempCtx = tempCanvas.getContext('2d');
if (!tempCtx) { console.error('Temp context not available'); return; }
// Copy current bitmap to temp
tempCtx.drawImage(offscreen, 0, 0);
// Copy back with scroll offset (scrollX/Y are in logical pixels, not scaled)
// The exposed edge will contain "garbage" (wrapped data) until new pixels overwrite it
ctx.drawImage(tempCanvas, 0, 0, ${this.state.width}, ${this.state.height}, (${scrollX}), (${scrollY}), ${this.state.width}, ${this.state.height});
// [#30 perf] invalidate the persistent pixel store so the next plot re-syncs from the scrolled offscreen
delete window['bitmapImageData_${this.bitmapCanvasId}'];
})();`;

    this.logMessage(`[SCROLL] Scrolling offscreen bitmap: scrollX=${scrollX}, scrollY=${scrollY}`);
    this.debugWindow.webContents.executeJavaScript(scrollCode).catch((err) => {
      this.logMessage(`ERROR scrolling bitmap: ${err}`);
      this.logMessage(`Failed scroll code: ${scrollCode.substring(0, 200)}...`);
    });
  }

  /**
   * Set trace pattern
   */
  private setTracePattern(pattern: number): void {
    this.state.tracePattern = pattern & 0xf; // 0-15
    this.traceProcessor.setPattern(pattern);

    // Update rate if 0 (use real-time default)
    if (this.state.rate === 0) {
      this.state.rate = 1; // Real-time: plot every pixel
    }
  }

  /**
   * Set pixel update rate
   */
  private setRate(rate: number): void {
    this.state.rate = rate; // Accept negative values for special handling
    this.state.rateCounter = 0;

    // Handle special rate values (Pascal logic)
    if (this.state.rate === -1) {
      // Rate -1 means full screen update: set to width * height
      this.state.rate = this.state.width * this.state.height;
      this.logMessage(`[RATE SET] rate=-1 expanded to width*height=${this.state.rate}`);
    } else if (this.state.rate === 0) {
      // Rate 0 means manual update mode but we use 1 for pixel processing
      this.state.rate = 1;
      this.logMessage(`[RATE SET] rate=0 (manual mode) using 1 for processing`);
    } else {
      this.logMessage(`[RATE SET] rate=${this.state.rate}, rateCounter reset to 0`);
    }
  }

  /**
   * Disable sparse mode unless both dot dimensions are >= 4. Mirrors Pascal SetSize, which
   * forces vSparse := -1 when the dots are too small to draw a bordered sparse pixel
   * (DebugDisplayUnit.pas:2938). [9win §15]
   */
  private enforceSparseDotSizeConstraint(): void {
    if (this.state.sparseMode && (this.state.dotSizeX < 4 || this.state.dotSizeY < 4)) {
      this.state.sparseMode = false;
      this.logMessage(
        `[SPARSE] disabled — dot size ${this.state.dotSizeX}x${this.state.dotSizeY} < 4 (Pascal SetSize)`
      );
    }
  }

  /**
   * Return the bitmap clear/background color for the current color mode, mirroring Pascal
   * GetBackground (DebugDisplayUnit.pas:3180-3204): LUT modes use palette entry 0; the W
   * variants (LUMA8W/HSV8W/RGBI8W/HSV16W) clear to white; every other mode clears to black.
   * Note this is independent of the SPARSE color (which only tints sparse-dot borders). [9win §15]
   */
  private getBackground(): number {
    const mode = this.state.colorMode;
    if (mode === ColorMode.LUT1 || mode === ColorMode.LUT2 || mode === ColorMode.LUT4 || mode === ColorMode.LUT8) {
      return (this.lutManager.getPalette()[0] ?? 0) & 0xffffff;
    }
    if (DebugBitmapWindow.isWhiteBackgroundMode(mode)) {
      return 0xffffff; // clWhite
    }
    return 0x000000; // clBlack
  }

  /**
   * Save bitmap to file
   */
  private saveBitmap(filename: string, saveWindow: boolean): void {
    if (!this.state.isInitialized) {
      this.logMessage('ERROR: Cannot save bitmap before it is initialized');
      return;
    }

    if (saveWindow) {
      // Save entire window
      this.saveWindowToBMPFilename(filename);
    } else {
      // Save just the bitmap area
      // TODO: Implement saving just the canvas area
      this.saveWindowToBMPFilename(filename);
    }
  }

  /**
   * Parse a color-mode / LUTCOLORS directive that begins at `command`, with `remainingParts`
   * being the tokens that follow it on the line. Returns the number of tokens consumed FROM
   * `remainingParts` (0 = bare mode, 1 = mode+tune, N = N LUT colors), or -1 if `command` is
   * not a color directive. Mirrors Pascal KeyColorMode / KeyLutColors so the caller can advance
   * the line cursor precisely and not mistake pixel data for a tune. [9win §15]
   */
  private parseColorModeCommand(command: string, remainingParts: string[]): number {
    // LUTCOLORS: overwrite the palette from index 0 (Pascal KeyLutColors always restarts at
    // vLut[0], :2806-2814 — it does NOT append). Each entry is a color name (with optional
    // brightness) or a raw rgb24 numeric; stop at the first non-color token. [9win §15]
    if (command === 'LUTCOLORS') {
      let index = 0;
      let consumed = 0;
      while (consumed < remainingParts.length && index < 256) {
        const named = DebugBitmapWindow.parseNamedColor(remainingParts, consumed);
        if (named) {
          this.lutManager.setColor(index, named.color);
          index++;
          consumed += named.consumed;
          continue;
        }
        const colorValue = Spin2NumericParser.parseColor(remainingParts[consumed]);
        if (colorValue === null) break;
        this.lutManager.setColor(index, colorValue);
        index++;
        consumed++;
      }
      this.colorTranslator.setLutPalette(this.lutManager.getPalette());
      this.logMessage(`[LUTCOLORS] Loaded ${index} colors into LUT from index 0`);
      return consumed;
    }

    // Color mode commands
    const colorModeMap: { [key: string]: ColorMode } = {
      LUT1: ColorMode.LUT1,
      LUT2: ColorMode.LUT2,
      LUT4: ColorMode.LUT4,
      LUT8: ColorMode.LUT8,
      LUMA8: ColorMode.LUMA8,
      LUMA8W: ColorMode.LUMA8W,
      LUMA8X: ColorMode.LUMA8X,
      HSV8: ColorMode.HSV8,
      HSV8W: ColorMode.HSV8W,
      HSV8X: ColorMode.HSV8X,
      RGBI8: ColorMode.RGBI8,
      RGBI8W: ColorMode.RGBI8W,
      RGBI8X: ColorMode.RGBI8X,
      RGB8: ColorMode.RGB8,
      HSV16: ColorMode.HSV16,
      HSV16W: ColorMode.HSV16W,
      HSV16X: ColorMode.HSV16X,
      RGB16: ColorMode.RGB16,
      RGB24: ColorMode.RGB24
    };

    if (command in colorModeMap) {
      const mode = colorModeMap[command];
      this.state.colorMode = mode;
      this.colorTranslator.setColorMode(mode); // NOTE: this zeroes the translator's tune

      // Pascal KeyColorMode (:2786-2803): only LUMA8 (color name OR number) and HSV8/HSV16
      // (number only) consume a tune token. RGBI8/W/X, LUT*, RGB8/16/24 consume NOTHING — a
      // following value there is pixel DATA, so it must NOT be eaten as a tune. [9win §15]
      let consumed = 0;
      if (remainingParts.length > 0) {
        const next = remainingParts[0];
        if (DebugBitmapWindow.isLumaMode(mode)) {
          if (this.isNumeric(next)) {
            this.state.colorTune = parseInt(next, 10) & 0xff;
            consumed = 1;
          } else if (DebugBitmapWindow.COLOR_TUNE.hasOwnProperty(next.toUpperCase())) {
            this.state.colorTune = DebugBitmapWindow.COLOR_TUNE[next.toUpperCase()];
            consumed = 1;
          }
        } else if (DebugBitmapWindow.isHsvMode(mode)) {
          if (this.isNumeric(next)) {
            this.state.colorTune = parseInt(next, 10) & 0xff;
            consumed = 1;
          }
        }
      }
      // Re-apply the current tune (setColorMode zeroed it; non-tune modes retain the prior
      // tune, matching Pascal which leaves vColorTune untouched for those modes).
      this.colorTranslator.setTune(this.state.colorTune);
      return consumed;
    }

    return -1;
  }

  /**
   * Process numeric data values
   */
  private async processDataValues(dataParts: string[]): Promise<void> {
    if (!this.state.isInitialized) {
      this.logMessage('ERROR: Cannot plot pixels before bitmap size is defined');
      return;
    }

    // HOT PATH: guard with isLogging so the message string (and any .join()/.map())
    // is NOT built per pixel when diagnostics are off — building these eagerly, even
    // though logMessage discards them, starved the serial drain at 2 Mbaud. [#30]
    if (this.isLogging)
      this.logMessage(`[BITMAP DATA] Processing ${dataParts.length} data parts: [${dataParts.join(', ')}]`);

    // NORMAL-mode pixels are appended to this.pendingPixels (a persistent, cross-message
    // queue) and flushed by the coalescing render timer — NOT plotted via an awaited IPC
    // here. [#30]
    for (const part of dataParts) {
      // Parse value using Spin2NumericParser to handle all formats (hex, decimal, binary, etc.)
      // Pre-check if value looks numeric to avoid error logging for non-numeric tokens
      if (!Spin2NumericParser.isNumeric(part)) {
        if (this.isLogging) this.logMessage(`[BITMAP DATA] Skipping non-numeric token: ${part}`);
        continue;
      }
      const rawValue = Spin2NumericParser.parseValue(part);
      if (rawValue === null) {
        if (this.isLogging) this.logMessage(`[BITMAP DATA] Failed to parse value: ${part}`);
        continue;
      }
      if (this.isLogging) this.logMessage(`[BITMAP DATA] Parsed ${part} → 0x${rawValue.toString(16)}`);

      // Unpack data based on explicit packed mode (if specified) or derived from color mode
      const packedMode = this.displaySpec?.explicitPackedMode || this.getPackedDataMode();
      const unpackedValues = PackedDataProcessor.unpackSamples(rawValue, packedMode);
      // HOT PATH: guard all per-pixel diagnostics — these strings (and .map().join())
      // must not be built when isLogging is off. [#30]
      if (this.isLogging) {
        this.logMessage(
          `[UNPACK] Mode=${packedMode.mode}, bitsPerSample=${packedMode.bitsPerSample}, ` +
            `isAlternate=${packedMode.isAlternate}, isSigned=${packedMode.isSigned}, rawValue=0x${rawValue.toString(16)}`
        );
        this.logMessage(
          `[UNPACK] Got ${unpackedValues.length} values: [${unpackedValues.map((v) => '0x' + v.toString(16)).join(', ')}]`
        );
        this.logMessage(`[LOOP] Starting loop: ${unpackedValues.length} values, rate=${this.state.rate}`);
      }
      for (let idx = 0; idx < unpackedValues.length; idx++) {
        const value = unpackedValues[idx];

        // Increment rate counter (Pascal: Inc(vRateCount))
        this.state.rateCounter++;

        // Get current pixel position
        const pos = this.traceProcessor.getPosition();

        // NOTE: Pascal BITMAP_Update plots EVERY sparse pixel (DebugDisplayUnit.pas:2466-2478) —
        // there is no "skip if value == background/sparse". A pixel whose value matches the field
        // still shows its vSparse frame against the GetBackground field, which is the intended
        // sparse visual. Do NOT skip here. [9win §15]

        // Translate color
        const rgb24 = this.colorTranslator.translateColor(value);
        const color = `#${rgb24.toString(16).padStart(6, '0')}`;
        const totalValues = unpackedValues.length;

        // Reduced logging: only log first/last few pixels to avoid 500K+ log messages
        const enableDetailedLog = idx < 3 || idx >= totalValues - 3;

        if (this.state.tracePattern === 4 && (idx < 5 || idx >= totalValues - 5)) {
          this.logMessage(
            `[TRACE4] value[${idx}/${totalValues}]: pos(${pos.x},${pos.y}) = 0x${value.toString(16)} → ${color}`
          );
        }
        if (enableDetailedLog) {
          this.logMessage(
            `[COLOR] Translate 0x${value.toString(16)} (mode=${this.state.colorMode}) → rgb24=0x${rgb24.toString(
              16
            )} → ${color}`
          );
        }

        // Plot pixel with SPARSE mode two-layer rendering if enabled
        if (this.debugWindow) {
          if (this.state.sparseMode) {
            // SPARSE MODE: Two-layer dot, mirroring Pascal BITMAP_Update (DebugDisplayUnit.pas:2466-2478):
            //   Layer 1 (outer): SmoothShape(x,y, dotSize,dotSizeY, 0,0, 0, vSparse, 255)
            //                    → full-DOTSIZE SQUARE in the SPARSE frame color (vSparse).
            //   Layer 2 (inner): SmoothShape(x,y, dotSize-dotSize>>2, dotSizeY-dotSizeY>>2,
            //                                dotSize,dotSizeY, 0, TranslateColor(value), 255)
            //                    → 3/4-DOTSIZE ROUNDED dot (xro/yro = full size ⇒ ellipse) in the
            //                      pixel's translated color. [9win §15]
            // Pascal: x := vPixelX * vDotSize + vDotSize shr 1 (center).
            const centerX = pos.x * this.state.dotSizeX + (this.state.dotSizeX >> 1);
            const centerY = pos.y * this.state.dotSizeY + (this.state.dotSizeY >> 1);

            // Frame color = vSparse (the SPARSE directive color), NOT the bitmap background.
            const frameRgb24 = this.state.sparseColor & 0xffffff;
            const frameColor = `#${frameRgb24.toString(16).padStart(6, '0')}`;

            // LAYER 1: outer SQUARE (border) at 100% DOTSIZE in the SPARSE frame color.
            const outerX = centerX - (this.state.dotSizeX >> 1);
            const outerY = centerY - (this.state.dotSizeY >> 1);

            // LAYER 2: inner ROUNDED dot at 75% DOTSIZE in the pixel color.
            // Pascal: vDotSize - vDotSize shr 2 (subtract 25% = 75% remaining); xro/yro = full
            // DOTSIZE so SmoothShape renders a filled ellipse, not a rounded rectangle.
            const innerW = this.state.dotSizeX - (this.state.dotSizeX >> 2);
            const innerH = this.state.dotSizeY - (this.state.dotSizeY >> 2);
            const sparseCode = `
              const canvas = document.getElementById('${this.bitmapCanvasId}');
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '${frameColor}';
                  ctx.fillRect(${outerX}, ${outerY}, ${this.state.dotSizeX}, ${this.state.dotSizeY});
                  ctx.fillStyle = '${color}';
                  ctx.beginPath();
                  ctx.ellipse(${centerX}, ${centerY}, ${innerW / 2}, ${innerH / 2}, 0, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            `;
            // Serialize the sparse-dot draw through the inherited renderChain (NOT fire-and-forget)
            // so a SAVE awaits it before capturing. Sparse mode draws straight to the display canvas
            // and bypasses the pendingPixels batch, so without this the per-dot executeJavaScript was
            // un-awaited and a SAVE's capturePage/desktopCapturer grabbed a BLACK canvas before any
            // dot landed. [BITMAP SPARSE save-before-draw — same class as MIDI lit-chord, #49]
            this.scheduleRender(() => this.debugWindow?.webContents.executeJavaScript(sparseCode));
          } else {
            // NORMAL MODE: Collect pixels for batched rendering to offscreen bitmap
            // Pascal: PlotPixel writes to BitmapLine[vPixelY][vPixelX]
            if (enableDetailedLog) {
              this.logMessage(
                `[PLOT] Offscreen: pos=(${pos.x},${pos.y}) color=${color} on ${this.state.width}x${this.state.height} bitmap`
              );
            }

            // Queue pixel for coalesced flush instead of an immediate/awaited IPC call. [#30]
            this.pendingPixels.push({ x: pos.x, y: pos.y, rgb: rgb24 });
          }
        }

        // Step to next position
        this.traceProcessor.step();
      }
    }

    // NORMAL MODE: pixels are now queued in this.pendingPixels; the render timer flushes
    // them in one coalesced plotPixelBatch IPC (instead of one awaited IPC per message). [#30]

    // Check if we should update the display (Pascal: RateCycle)
    // Rate controls how often the display is updated
    if (this.state.rateCounter >= this.state.rate) {
      // HOT PATH: guard rate-cycle diagnostics — these strings were built every rate
      // cycle even with logging off, adding to the main-thread cost that starves the
      // serial drain at 2 Mbaud. (fix A missed this block.) [#30]
      if (this.isLogging)
        this.logMessage(
          `[RATE CYCLE] Triggered update: rateCounter=${this.state.rateCounter}, rate=${this.state.rate}, sparseMode=${this.state.sparseMode}`
        );

      // Handle multiple rate cycles if counter significantly exceeds rate
      // This can happen if we batch many pixels together
      const cycleCount = Math.floor(this.state.rateCounter / this.state.rate);
      const remainder = this.state.rateCounter % this.state.rate;

      if (this.isLogging)
        this.logMessage(
          `[RATE CYCLE] cycleCount=${cycleCount}, remainder=${remainder}, RESET: ${this.state.rateCounter} → ${remainder}`
        );
      this.state.rateCounter = remainder;

      // Mark the display dirty (Pascal: BitmapToCanvas) instead of awaiting updateCanvas()
      // here. The render timer drains pendingPixels → plotPixelBatch → updateCanvas in order,
      // so the display still refreshes once per rate cycle but the serial drain is never
      // blocked on an IPC round-trip. SPARSE mode draws directly to the display canvas. [#30]
      if (!this.state.sparseMode) {
        this.displayDirty = true;
        this.ensureRenderFlushTimer();
      }
    }

    // Even if no rate cycle fired this call, make sure the timer is running so queued
    // pixels are eventually flushed to the offscreen bitmap. [#30]
    if (!this.state.sparseMode && this.pendingPixels.length > 0) {
      this.ensureRenderFlushTimer();
    }
  }

  /**
   * [#30] Coalesced render flush. Drains the accumulated pixel queue into a single
   * plotPixelBatch IPC, then refreshes the display if a rate cycle marked it dirty.
   * All flushes are serialized through the inherited renderChain so batches never overlap and
   * always reach the renderer in order. Returns a promise that resolves when THIS
   * flush (and any already queued ahead of it) has completed — callers that must see a
   * consistent offscreen (SAVE) can await it. [#49]
   */
  private flushRenderQueue(): Promise<void> {
    return this.scheduleRender(() => this.doRenderFlush());
  }

  private async doRenderFlush(): Promise<void> {
    if (!this.debugWindow) {
      // Window gone — discard anything queued so it can't leak.
      this.pendingPixels = [];
      this.displayDirty = false;
      return;
    }
    if (this.pendingPixels.length > 0) {
      const batch = this.pendingPixels;
      this.pendingPixels = [];
      await this.plotPixelBatch(batch);
    }
    if (this.displayDirty) {
      this.displayDirty = false;
      await this.updateCanvas();
    }
  }

  /**
   * [#30] Synchronously hand off any queued pixels to the renderer BEFORE an operation
   * that mutates the offscreen bitmap in renderer-queue order (e.g. SCROLL). plotPixelBatch
   * invokes executeJavaScript synchronously up to its internal await, so the pixels' draw is
   * queued on the webContents ahead of the caller's own executeJavaScript — preserving order
   * without awaiting (we can't await from inside the synchronous trace step() callback).
   */
  private drainPendingPixelsNow(): void {
    if (this.pendingPixels.length === 0 || !this.debugWindow) return;
    const batch = this.pendingPixels;
    this.pendingPixels = [];
    void this.plotPixelBatch(batch);
  }

  /**
   * [#30] Register this window as needing render and arm the GLOBAL scheduler. Replaces the old
   * per-window timer: instead of N windows each running their own 16ms flush loop (which serialize
   * chaotically through the single renderer), all dirty windows are drained together in one ordered
   * pass — see runRenderPass.
   */
  private ensureRenderFlushTimer(): void {
    if (!this.debugWindow) return;
    DebugBitmapWindow.dirtyWindows.add(this);
    DebugBitmapWindow.scheduleRenderTick();
  }

  /** [#30] Arm the single global render tick if work is pending and none is already scheduled/running. */
  private static scheduleRenderTick(): void {
    if (DebugBitmapWindow.renderTickTimer !== null || DebugBitmapWindow.renderPassRunning) return;
    if (DebugBitmapWindow.dirtyWindows.size === 0) return;
    DebugBitmapWindow.renderTickTimer = setTimeout(() => {
      DebugBitmapWindow.renderTickTimer = null;
      void DebugBitmapWindow.runRenderPass();
    }, DebugBitmapWindow.RENDER_FLUSH_MS);
  }

  /**
   * [#30] One coordinated flush+blit pass over every dirty window in STABLE creation order,
   * processed sequentially (each awaited before the next) so the renderer does one window's work
   * at a time, in order — no cross-window contention, no reordered painting. Windows re-add
   * themselves as new data arrives during the pass; the finally schedules the next tick.
   */
  private static async runRenderPass(): Promise<void> {
    if (DebugBitmapWindow.renderPassRunning) return;
    DebugBitmapWindow.renderPassRunning = true;
    try {
      const batch = Array.from(DebugBitmapWindow.dirtyWindows).sort((a, b) => a.renderSeq - b.renderSeq);
      DebugBitmapWindow.dirtyWindows.clear();
      for (const win of batch) {
        if (!win.debugWindow) continue; // window closed mid-pass
        await win.flushRenderQueue(); // serialized through the window's own chain (shared with SAVE)
      }
    } finally {
      DebugBitmapWindow.renderPassRunning = false;
      // Work accumulated during the pass (or a window re-queued) → run another tick.
      DebugBitmapWindow.scheduleRenderTick();
    }
  }

  /**
   * Check if string is numeric
   */
  private isNumeric(str: string): boolean {
    return /^-?\d+$/.test(str);
  }

  /**
   * Get current packed data mode based on color mode
   */
  private getPackedDataMode(): PackedDataMode {
    // Map color modes to appropriate packed data modes
    let mode: ePackedDataMode;
    let bitsPerSample: number;
    let valueSize: ePackedDataWidth;

    switch (this.state.colorMode) {
      case ColorMode.LUT1:
        mode = ePackedDataMode.PDM_LONGS_1BIT;
        bitsPerSample = 1;
        valueSize = ePackedDataWidth.PDW_LONGS;
        break;
      case ColorMode.LUT2:
        mode = ePackedDataMode.PDM_LONGS_2BIT;
        bitsPerSample = 2;
        valueSize = ePackedDataWidth.PDW_LONGS;
        break;
      case ColorMode.LUT4:
        mode = ePackedDataMode.PDM_LONGS_4BIT;
        bitsPerSample = 4;
        valueSize = ePackedDataWidth.PDW_LONGS;
        break;
      case ColorMode.LUT8:
      case ColorMode.LUMA8:
      case ColorMode.LUMA8W:
      case ColorMode.LUMA8X:
      case ColorMode.HSV8:
      case ColorMode.HSV8W:
      case ColorMode.HSV8X:
      case ColorMode.RGBI8:
      case ColorMode.RGBI8W:
      case ColorMode.RGBI8X:
      case ColorMode.RGB8:
        // Default for 8-bit modes: no packing (each value is one 8-bit sample)
        // This matches Pascal's SetPack(0) default behavior
        mode = ePackedDataMode.PDM_UNKNOWN;
        bitsPerSample = 8;
        valueSize = ePackedDataWidth.PDW_BYTES;
        break;
      case ColorMode.HSV16:
      case ColorMode.HSV16W:
      case ColorMode.HSV16X:
      case ColorMode.RGB16:
        // Default for 16-bit modes: no packing (each value is one 16-bit sample)
        mode = ePackedDataMode.PDM_UNKNOWN;
        bitsPerSample = 16;
        valueSize = ePackedDataWidth.PDW_WORDS;
        break;
      case ColorMode.RGB24:
        mode = ePackedDataMode.PDM_UNKNOWN; // RGB24 as 32-bit (no packing)
        bitsPerSample = 32;
        valueSize = ePackedDataWidth.PDW_LONGS;
        break;
      default:
        // Pascal SetDefaults calls SetPack(0) (DebugDisplayUnit.pas:2915) = no packing =
        // one sample per long. The fallback must NOT shred a long into 8-bit packed
        // samples; an unrecognized mode keeps each long as a single sample. [9win §15]
        mode = ePackedDataMode.PDM_UNKNOWN;
        bitsPerSample = 32;
        valueSize = ePackedDataWidth.PDW_LONGS;
        break;
    }

    return {
      mode,
      bitsPerSample,
      valueSize,
      isAlternate: false,
      isSigned: false
    };
  }

  /**
   * Create the debug window
   */
  private createDebugWindow(htmlContent: string): void {
    this.logMessage(`at createDebugWindow() BITMAP`);

    // Calculate window size based on bitmap and dotsize
    const canvasWidth = this.state.width * this.state.dotSizeX;
    const canvasHeight = this.state.height * this.state.dotSizeY;
    // Size by CLIENT area + useContentSize:true on the BrowserWindow (Electron
    // adds OS chrome). The old +20w/+40h outer-size estimate left the web
    // content wider than our drawing on macOS (no side borders), which plain
    // SAVE captured as a white right/bottom edge. Matches the FFT window.
    const windowDimensions = { width: canvasWidth, height: canvasHeight };
    const windowWidth = windowDimensions.width;
    const windowHeight = windowDimensions.height;

    // Check if position was explicitly set or use WindowPlacer
    let windowX = this.initialPosition?.x || 0;
    let windowY = this.initialPosition?.y || 0;

    // If no POS clause was present, use WindowPlacer for intelligent positioning
    if (!this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width: windowWidth, height: windowHeight },
        cascadeIfFull: true
      };
      const position = windowPlacer.getNextPosition(`bitmap-${this.idString}`, placementConfig);
      windowX = position.x;
      windowY = position.y;

      // Log to debug logger with reproducible command format
      try {
        const LoggerWindow = require('./loggerWin').LoggerWindow;
        const debugLogger = LoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        const titlePart = this.windowTitle ? ` TITLE '${this.windowTitle}'` : '';
        debugLogger.logSystemMessage(
          `WINDOW_PLACED (${windowX},${windowY} ${windowWidth}x${windowHeight} Mon:${monitorId}) BITMAP '${this.idString}'${titlePart} POS ${windowX} ${windowY} SIZE ${windowWidth} ${windowHeight}`
        );
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }

    // Create the browser window
    this.debugWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
      title: this.windowTitle,
      useContentSize: true, // width/height are the client area; Electron adds OS chrome (no white SAVE overhang)
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        // Keep the renderer painting + rAF firing while this window is occluded/unfocused so a
        // scripted multi-window SAVE captures a fresh frame and the capture flush never stalls.
        backgroundThrottling: false
      }
    });

    // Register window with WindowPlacer for position tracking ONLY if no explicit position
    // This prevents windowPlacer from overriding explicit POS directives
    if (this.debugWindow && !this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      windowPlacer.registerWindow(`bitmap-${this.idString}`, this.debugWindow);
    }

    // Set up the HTML content
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.windowTitle}</title>
          <style>
            body {
              margin: 0;
              padding: 10px;
              overflow: hidden;
              background-color: #000;
            }
            canvas {
              display: block;
              image-rendering: pixelated;
              image-rendering: -moz-crisp-edges;
              image-rendering: crisp-edges;
            }
            #coordinate-display {
              position: absolute;
              padding: 8px;
              background: #000;
              color: #ccc;
              border: 1px solid #ccc;
              font-family: 'Parallax', 'Consolas', 'Courier New', monospace;
              font-size: 12px;
              pointer-events: none;
              display: none;
              z-index: 999;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    // Load the HTML
    this.debugWindow.loadURL(`data:text/html,${encodeURIComponent(fullHtml)}`);

    // Hook window events
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('* Bitmap window will show...');
      this.debugWindow?.show();
      // Register for message DELIVERY but do NOT mark ready yet: ready-to-show fires BEFORE
      // did-finish-load, so the bitmap canvas element does not exist yet. Marking ready here let the
      // router drain streamed pixels/SPARSE dots against a missing canvas (getElementById → null →
      // the draw is a no-op) — which dropped all but the last SPARSE dot from fig-12. Mark ready from
      // did-finish-load instead, once the canvas exists. [#49 BITMAP premature-ready dot loss]
      this.registerWithRouter(false);
    });

    this.debugWindow.webContents.once('did-finish-load', () => {
      // Inject JavaScript for mouse coordinate tracking
      const mouseTrackingCode = `
        (function() {
          const canvas = document.getElementById('${this.bitmapCanvasId}');
          const display = document.getElementById('coordinate-display');

          if (!canvas || !display) {
            console.error('[BITMAP_WINDOW] Missing canvas or display element');
            return;
          }

          // Mouse move handler - update coordinates
          canvas.addEventListener('mousemove', function(event) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = Math.floor(event.clientX - rect.left);
            const mouseY = Math.floor(event.clientY - rect.top);

            if (!${this.displaySpec.hideXY || false}) {
              updateCoordinateDisplay(mouseX, mouseY);
            }
          });

          // Mouse enter handler
          canvas.addEventListener('mouseenter', function() {
            // Coordinate display will be shown by mousemove
          });

          // Mouse leave handler - hide display
          canvas.addEventListener('mouseleave', function() {
            display.style.display = 'none';
          });

          // Function to update coordinate display
          function updateCoordinateDisplay(x, y) {
            const dotSizeX = ${this.state.dotSizeX};
            const dotSizeY = ${this.state.dotSizeY};
            const canvasWidth = ${this.state.width * this.state.dotSizeX};
            const canvasHeight = ${this.state.height * this.state.dotSizeY};

            // Check if mouse is within canvas bounds
            if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
              // Calculate bitmap coordinates
              const col = Math.floor(x / dotSizeX);
              const row = Math.floor(y / dotSizeY);

              // Update display text
              display.textContent = col + ',' + row;
              display.style.display = 'block';

              // Position based on quadrant to avoid obscuring pixels
              const quadrant = (x >= canvasWidth/2 ? 1 : 0) | (y >= canvasHeight/2 ? 2 : 0);

              // Get display dimensions for positioning
              const displayRect = display.getBoundingClientRect();
              const textWidth = displayRect.width;
              const textHeight = displayRect.height;

              // Calculate flyout position with 12px offset from mouse
              let displayX, displayY;
              const offset = 12;

              switch(quadrant) {
                case 0: // Top-left - show bottom-right of mouse
                  displayX = x + offset;
                  displayY = y + offset;
                  break;
                case 1: // Top-right - show bottom-left of mouse
                  displayX = x - textWidth - offset;
                  displayY = y + offset;
                  break;
                case 2: // Bottom-left - show top-right of mouse
                  displayX = x + offset;
                  displayY = y - textHeight - offset;
                  break;
                case 3: // Bottom-right - show top-left of mouse
                  displayX = x - textWidth - offset;
                  displayY = y - textHeight - offset;
                  break;
              }

              display.style.left = (displayX + 10) + 'px';  // +10 for body padding
              display.style.top = (displayY + 10) + 'px';   // +10 for body padding
            } else {
              // Mouse outside canvas area - hide display
              display.style.display = 'none';
            }
          }

          if (ENABLE_CONSOLE_LOG) console.log('[BITMAP_WINDOW] Mouse coordinate tracking initialized');
        })();
      `;

      this.debugWindow?.webContents
        .executeJavaScript(mouseTrackingCode)
        .then(() => {
          this.logMessage('Mouse coordinate tracking enabled');
        })
        .catch((error) => {
          this.logMessage(`Failed to enable mouse coordinate tracking: ${error}`);
        });

      // Mark the window READY only now that the page (and the bitmap canvas element) has loaded, so
      // the router drains buffered pixels/SPARSE dots onto an existing canvas. [#49 BITMAP premature-ready]
      this.onWindowReady();
    });

    this.debugWindow.on('closed', () => {
      this.logMessage('* Bitmap window closed');
      this.closeDebugWindow();
    });
  }

  /**
   * Override base class logMessage to handle missing context.logger
   */
  logMessage(message: string): void {
    // Use base class logging
    super.logMessage(message, this.windowLogPrefix);
  }

  /**
   * Get the canvas element ID for this window
   */
  protected getCanvasId(): string {
    return this.bitmapCanvasId; // Bitmap window uses bitmapCanvasId
  }

  /**
   * PC_MOUSE wire value: Pascal SendMousePos dis_bitmap branch
   * (DebugDisplayUnit.pas:3556-3561). vDirY is always False for BITMAP, so Y is
   * inverted (bottom-origin on the wire), then x/y divided by dotSize. Previously
   * BITMAP had no override and sent raw top-origin pixels — wrong. [9win §1]
   */
  protected transformMouseCoordinates(x: number, y: number): { x: number; y: number } {
    return this.transformPixelDotsize(x, y, {
      dirX: false,
      dirY: false,
      dotSizeX: this.state.dotSizeX,
      dotSizeY: this.state.dotSizeY,
      clientWidth: this.state.width * this.state.dotSizeX,
      clientHeight: this.state.height * this.state.dotSizeY
    });
  }

  protected getCanvasDimensions(): { width: number; height: number } | null {
    return {
      width: this.state.width * this.state.dotSizeX,
      height: this.state.height * this.state.dotSizeY
    };
  }
}
