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
  tracePattern?: number; // TRACE directive - trace pattern (0-11)
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
  private windowTitle: string;
  private windowContent: string = '';

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
        
        switch (directive) {
          case 'TITLE':
            if (i + 1 < lineParts.length) {
              displaySpec.title = lineParts[++i];
            } else {
              errorMessage = 'TITLE directive missing value';
              isValid = false;
            }
            break;
            
          case 'POS':
            if (i + 2 < lineParts.length) {
              const x = parseInt(lineParts[++i]);
              const y = parseInt(lineParts[++i]);
              if (!isNaN(x) && !isNaN(y)) {
                displaySpec.position = { x, y };
              } else {
                errorMessage = 'POS directive requires two numeric values';
                isValid = false;
              }
            } else {
              errorMessage = 'POS directive missing values';
              isValid = false;
            }
            break;
            
          case 'SIZE':
            if (i + 2 < lineParts.length) {
              const width = parseInt(lineParts[++i]);
              const height = parseInt(lineParts[++i]);
              if (!isNaN(width) && !isNaN(height) && 
                  width >= 1 && width <= 2048 && 
                  height >= 1 && height <= 2048) {
                displaySpec.size = { width, height };
              } else {
                errorMessage = 'SIZE directive requires two numeric values between 1 and 2048';
                isValid = false;
              }
            } else {
              errorMessage = 'SIZE directive missing values';
              isValid = false;
            }
            break;
            
          case 'DOTSIZE':
            if (i + 1 < lineParts.length) {
              const x = parseInt(lineParts[++i]);
              if (!isNaN(x) && x >= 1) {
                // Check if there's a second value
                if (i + 1 < lineParts.length) {
                  const nextVal = parseInt(lineParts[i + 1]);
                  if (!isNaN(nextVal) && nextVal >= 1) {
                    // Two values provided
                    const y = nextVal;
                    i++;
                    displaySpec.dotSize = { x, y };
                  } else {
                    // Only one value, use for both X and Y
                    displaySpec.dotSize = { x, y: x };
                  }
                } else {
                  // Only one value, use for both X and Y
                  displaySpec.dotSize = { x, y: x };
                }
              } else {
                errorMessage = 'DOTSIZE directive requires at least one positive numeric value';
                isValid = false;
              }
            } else {
              errorMessage = 'DOTSIZE directive missing value';
              isValid = false;
            }
            break;
            
          case 'COLOR':
            if (i + 1 < lineParts.length) {
              // Parse color value - could be named color or hex value
              const colorStr = lineParts[++i];
              // TODO: Parse color properly using DebugColor class
              displaySpec.backgroundColor = 0x000000; // Default to black for now
            } else {
              errorMessage = 'COLOR directive missing value';
              isValid = false;
            }
            break;
            
          case 'HIDEXY':
            displaySpec.hideXY = true;
            break;

          case 'SPARSE':
            if (i + 1 < lineParts.length) {
              const colorStr = lineParts[++i];
              // Parse sparse background color
              displaySpec.sparseColor = parseInt(colorStr);
            } else {
              errorMessage = 'SPARSE directive missing color value';
              isValid = false;
            }
            break;

          case 'TRACE':
            if (i + 1 < lineParts.length) {
              const pattern = parseInt(lineParts[++i]);
              if (!isNaN(pattern) && pattern >= 0 && pattern <= 11) {
                displaySpec.tracePattern = pattern;
              } else {
                errorMessage = 'TRACE pattern must be 0-11';
                isValid = false;
              }
            } else {
              errorMessage = 'TRACE directive missing pattern value';
              isValid = false;
            }
            break;

          case 'RATE':
            if (i + 1 < lineParts.length) {
              const rate = parseInt(lineParts[++i]);
              if (!isNaN(rate)) {
                displaySpec.rate = rate;
              } else {
                errorMessage = 'RATE directive requires numeric value';
                isValid = false;
              }
            } else {
              errorMessage = 'RATE directive missing value';
              isValid = false;
            }
            break;

          case 'LUTCOLORS':
            // Collect all remaining color values
            displaySpec.lutColors = [];
            while (i + 1 < lineParts.length) {
              const nextPart = lineParts[i + 1];
              // Stop if we hit another directive (all caps word)
              if (nextPart === nextPart.toUpperCase() && isNaN(parseInt(nextPart))) {
                break;
              }
              i++;
              const colorValue = parseInt(nextPart);
              if (!isNaN(colorValue)) {
                displaySpec.lutColors.push(colorValue);
              }
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
              'LUT1': ColorMode.LUT1,
              'LUT2': ColorMode.LUT2,
              'LUT4': ColorMode.LUT4,
              'LUT8': ColorMode.LUT8,
              'LUMA8': ColorMode.LUMA8,
              'LUMA8W': ColorMode.LUMA8W,
              'LUMA8X': ColorMode.LUMA8X,
              'HSV8': ColorMode.HSV8,
              'HSV8W': ColorMode.HSV8W,
              'HSV8X': ColorMode.HSV8X,
              'RGBI8': ColorMode.RGBI8,
              'RGBI8W': ColorMode.RGBI8W,
              'RGBI8X': ColorMode.RGBI8X,
              'RGB8': ColorMode.RGB8,
              'HSV16': ColorMode.HSV16,
              'HSV16W': ColorMode.HSV16W,
              'HSV16X': ColorMode.HSV16X,
              'RGB16': ColorMode.RGB16,
              'RGB24': ColorMode.RGB24
            };
            displaySpec.colorMode = colorModeMap[directive];

            // Check if next token is a tune parameter (0-7)
            if (i + 1 < lineParts.length && !isNaN(parseInt(lineParts[i + 1]))) {
              const possibleTune = parseInt(lineParts[i + 1]);
              if (possibleTune >= 0 && possibleTune <= 7) {
                displaySpec.colorTune = possibleTune;
                i++; // Consume tune parameter
              }
            }
            break;

          default:
            // Check if this is a packed data mode directive (e.g., LONGS_2BIT, BYTES_4BIT)
            const [isPackedMode, packedMode] = PackedDataProcessor.validatePackedMode(lineParts[i]);
            if (isPackedMode) {
              displaySpec.explicitPackedMode = packedMode;
              DebugBitmapWindow.logConsoleMessageStatic(`[BITMAP] Parsed packed data mode: ${lineParts[i]}`);
            }
            // Unknown directives are gracefully skipped
            break;
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
    
    // Initialize from displaySpec
    this.windowTitle = displaySpec.title;
    this.idString = displaySpec.displayName;
    this.windowLogPrefix = 'bitW';
    this.initialPosition = displaySpec.position;
    
    // Initialize state with defaults, applying declaration directives
    this.state = {
      width: displaySpec.size?.width ?? 256,
      height: displaySpec.size?.height ?? 256,
      dotSizeX: displaySpec.dotSize?.x ?? 1,
      dotSizeY: displaySpec.dotSize?.y ?? 1,
      rate: displaySpec.rate ?? 1, // Default: update after every pixel (real-time)
      rateCounter: 0,
      backgroundColor: displaySpec.backgroundColor ?? 0x000000,
      sparseMode: displaySpec.sparseColor !== undefined,
      manualUpdate: displaySpec.manualUpdate ?? false,
      tracePattern: displaySpec.tracePattern ?? 0,
      colorMode: displaySpec.colorMode ?? ColorMode.RGB8,
      colorTune: displaySpec.colorTune ?? 0,
      isInitialized: false
    };

    // Initialize shared components
    this.lutManager = new LUTManager();
    this.colorTranslator = new ColorTranslator();

    // Apply LUTCOLORS from declaration if provided
    if (displaySpec.lutColors && displaySpec.lutColors.length > 0) {
      for (let i = 0; i < displaySpec.lutColors.length && i < 16; i++) {
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

    // Apply SPARSE background color from declaration if provided
    if (displaySpec.sparseColor !== undefined) {
      this.state.backgroundColor = displaySpec.sparseColor;
    }

    // Set up canvas ID for bitmap
    this.bitmapCanvasId = `bitmap-canvas-${this.idString}`;

    // If SIZE was provided in declaration, initialize the window immediately
    if (displaySpec.size) {
      this.setBitmapSize(this.state.width, this.state.height);
    }

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
    
    // Clean up window reference
    this.debugWindow = null;
  }

  /**
   * Process debug commands and data
   */
  protected async processMessageImmediate(lineParts: string[]): Promise<void> {
    // First, let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    const commandParts = lineParts.slice(1); // Remove display name prefix
    if (await this.handleCommonCommand(commandParts)) {
      return; // Base class handled it
    }

    // Start at index 1 to skip window name (lineParts[0] is always `windowName for runtime commands)
    let dataStartIndex = 1;

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
            const x = parseInt(lineParts[i + 1]);
            const y = parseInt(lineParts[i + 2]);
            if (!isNaN(x) && !isNaN(y)) {
              this.setPixelPosition(x, y);
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
            const scrollX = parseInt(lineParts[i + 1]);
            const scrollY = parseInt(lineParts[i + 2]);
            if (!isNaN(scrollX) && !isNaN(scrollY)) {
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
            const pattern = parseInt(lineParts[i + 1]);
            this.setTracePattern(pattern);
            dataStartIndex = i + 2;
            i++;
          }
          break;

        case 'RATE':
          if (i + 1 < lineParts.length) {
            const rate = parseInt(lineParts[i + 1]);
            this.setRate(rate);
            dataStartIndex = i + 2;
            i++;
          }
          break;

        case 'DOTSIZE':
          if (i + 2 < lineParts.length) {
            const dotX = parseInt(lineParts[i + 1]);
            const dotY = parseInt(lineParts[i + 2]);
            this.setDotSize(dotX, dotY);
            dataStartIndex = i + 3;
            i += 2;
          }
          break;

        case 'SPARSE':
          if (i + 1 < lineParts.length) {
            const bgColor = this.parseColorValue(lineParts[i + 1]);
            this.setSparseMode(bgColor);
            dataStartIndex = i + 2;
            i++;
          }
          break;

        default:
          // Check for color mode commands
          if (this.parseColorModeCommand(part, lineParts.slice(i + 1))) {
            // Color mode parsed, advance index
            if (part.includes('LUTCOLORS')) {
              // LUTCOLORS consumes all remaining parts
              dataStartIndex = lineParts.length;
              i = lineParts.length;
            } else {
              // Regular color mode may have tune parameter
              if (i + 1 < lineParts.length && this.isNumeric(lineParts[i + 1])) {
                dataStartIndex = i + 2;
                i++;
              } else {
                dataStartIndex = i + 1;
              }
            }
          }
          break;
      }
    }

    // Process numeric data values
    if (dataStartIndex < lineParts.length) {
      this.processDataValues(lineParts.slice(dataStartIndex));
    }
  }

  /**
   * Override base class method for CLEAR command
   * Called by base class handleCommonCommand() when CLEAR is received
   */
  protected clearDisplayContent(): void {
    this.clearBitmap();
  }

  /**
   * Override base class method for UPDATE command
   * Called by base class handleCommonCommand() when UPDATE is received
   */
  protected forceDisplayUpdate(): void {
    this.updateCanvas();
  }

  /**
   * Set bitmap size and initialize canvas
   */
  private setBitmapSize(width: number, height: number): void {
    // Clamp to valid range
    this.state.width = Math.max(1, Math.min(2048, width));
    this.state.height = Math.max(1, Math.min(2048, height));

    // Update trace processor
    this.traceProcessor.setBitmapSize(this.state.width, this.state.height);

    // Update input forwarder window dimensions
    this.inputForwarder.setWindowDimensions(this.state.width, this.state.height);

    // Initialize canvas if not already done
    if (!this.state.isInitialized) {
      this.initializeCanvas();
    }

    // Update RATE if it's 0 (use default of 1 for real-time updates)
    if (this.state.rate === 0) {
      this.state.rate = 1; // Real-time: plot every pixel
      this.logMessage(`[RATE INIT] Using default rate=1 (real-time) for tracePattern=${this.state.tracePattern}`);
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

    // Convert background color to hex string
    const bgColor = this.state.backgroundColor & 0xFFFFFF;
    const r = (bgColor >> 16) & 0xFF;
    const g = (bgColor >> 8) & 0xFF;
    const b = bgColor & 0xFF;

    // Clear canvas using JavaScript
    const clearJS = `
      const canvas = document.getElementById('${this.bitmapCanvasId}');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(${r}, ${g}, ${b})';
          ctx.fillRect(0, 0, ${this.state.width * this.state.dotSizeX}, ${this.state.height * this.state.dotSizeY});
        }
      }
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
      this.logMessage(`ERROR: Invalid pixel coordinates (${x},${y}). Must be within 0-${this.state.width - 1} x 0-${this.state.height - 1}`);
      return;
    }

    this.traceProcessor.setPosition(x, y);
  }

  /**
   * Update the visible canvas from offscreen canvas
   */
  private updateCanvas(): void {
    // In the current implementation, we're drawing directly to the canvas
    // using CanvasRenderer methods, so this is primarily used to force
    // a refresh when in manual update mode.
    
    // For now, this is a no-op since we're updating the canvas
    // directly through plotPixel/plotScaledPixel calls.
    // If we need double-buffering in the future, we can implement it here.
  }

  /**
   * Scroll bitmap content
   */
  private scrollBitmap(scrollX: number, scrollY: number): void {
    if (!this.state.isInitialized) return;

    // Clamp scroll values
    scrollX = Math.max(-this.state.width, Math.min(this.state.width, scrollX));
    scrollY = Math.max(-this.state.height, Math.min(this.state.height, scrollY));

    // Use canvas renderer to scroll
    if (!this.debugWindow) return;

    const scrollCode = this.canvasRenderer.scrollBitmap(
      this.bitmapCanvasId,
      scrollX * this.state.dotSizeX,
      scrollY * this.state.dotSizeY,
      this.state.width * this.state.dotSizeX,
      this.state.height * this.state.dotSizeY
    );

    this.logMessage(`[SCROLL] Executing scroll: scrollX=${scrollX}, scrollY=${scrollY}`);
    this.debugWindow.webContents.executeJavaScript(scrollCode)
      .catch(err => {
        this.logMessage(`ERROR scrolling bitmap: ${err}`);
        this.logMessage(`Failed scroll code: ${scrollCode.substring(0, 200)}...`);
      });
  }

  /**
   * Set trace pattern
   */
  private setTracePattern(pattern: number): void {
    this.state.tracePattern = pattern & 0xF; // 0-15
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
    this.state.rate = Math.max(0, rate);
    this.state.rateCounter = 0;

    // If rate is 0, use real-time default
    if (this.state.rate === 0) {
      this.state.rate = 1; // Real-time: plot every pixel
    }

    this.logMessage(`[RATE SET] rate=${this.state.rate}, rateCounter reset to 0`);
  }

  /**
   * Set dot size for pixel scaling
   */
  private setDotSize(dotX: number, dotY: number): void {
    this.state.dotSizeX = Math.max(1, dotX);
    this.state.dotSizeY = Math.max(1, dotY);
    
    // Update input forwarder
    this.inputForwarder.setDotSize(this.state.dotSizeX, this.state.dotSizeY);

    // Reinitialize canvas with new size
    if (this.state.isInitialized) {
      this.initializeCanvas();
    }
  }

  /**
   * Set sparse mode with background color
   */
  private setSparseMode(bgColor: number): void {
    this.state.sparseMode = true;
    this.state.backgroundColor = bgColor;
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
   * Parse color mode commands
   */
  private parseColorModeCommand(command: string, remainingParts: string[]): boolean {
    // Check for LUTCOLORS command
    if (command === 'LUTCOLORS') {
      this.logMessage(`[LUTCOLORS] Processing ${remainingParts.length} colors: [${remainingParts.join(', ')}]`);
      // Parse LUT colors using shared parser for consistency
      let colorCount = 0;
      for (const colorStr of remainingParts) {
        const colorValue = this.parseColorValue(colorStr);
        if (colorValue !== null) {
          const index = this.lutManager.getPaletteSize();
          if (index < 256) {
            this.lutManager.setColor(index, colorValue);
            this.logMessage(`[LUTCOLORS] Set LUT[${index}] = 0x${colorValue.toString(16)} (${colorStr})`);
            colorCount++;
          }
        }
      }
      this.logMessage(`[LUTCOLORS] Loaded ${colorCount} colors into LUT`);
      // Sync palette to ColorTranslator
      this.colorTranslator.setLutPalette(this.lutManager.getPalette());
      this.logMessage(`[LUTCOLORS] Synced palette to ColorTranslator`);
      return true;
    }

    // Check for color mode commands
    const colorModeMap: { [key: string]: ColorMode } = {
      'LUT1': ColorMode.LUT1,
      'LUT2': ColorMode.LUT2,
      'LUT4': ColorMode.LUT4,
      'LUT8': ColorMode.LUT8,
      'LUMA8': ColorMode.LUMA8,
      'LUMA8W': ColorMode.LUMA8W,
      'LUMA8X': ColorMode.LUMA8X,
      'HSV8': ColorMode.HSV8,
      'HSV8W': ColorMode.HSV8W,
      'HSV8X': ColorMode.HSV8X,
      'RGBI8': ColorMode.RGBI8,
      'RGBI8W': ColorMode.RGBI8W,
      'RGBI8X': ColorMode.RGBI8X,
      'RGB8': ColorMode.RGB8,
      'HSV16': ColorMode.HSV16,
      'HSV16W': ColorMode.HSV16W,
      'HSV16X': ColorMode.HSV16X,
      'RGB16': ColorMode.RGB16,
      'RGB24': ColorMode.RGB24
    };

    if (command in colorModeMap) {
      this.state.colorMode = colorModeMap[command];
      this.colorTranslator.setColorMode(this.state.colorMode);

      // Check for tune parameter
      if (remainingParts.length > 0 && this.isNumeric(remainingParts[0])) {
        const tune = parseInt(remainingParts[0]) & 0x7;
        this.state.colorTune = tune;
        this.colorTranslator.setTune(tune);
      }

      return true;
    }

    return false;
  }

  /**
   * Process numeric data values
   */
  private processDataValues(dataParts: string[]): void {
    if (!this.state.isInitialized) {
      this.logMessage('ERROR: Cannot plot pixels before bitmap size is defined');
      return;
    }

    this.logMessage(`[BITMAP DATA] Processing ${dataParts.length} data parts: [${dataParts.join(', ')}]`);

    for (const part of dataParts) {
      // Parse value using Spin2NumericParser to handle all formats (hex, decimal, binary, etc.)
      const rawValue = Spin2NumericParser.parseValue(part);
      if (rawValue === null) {
        this.logMessage(`[BITMAP DATA] Failed to parse value: ${part}`);
        continue;
      }
      this.logMessage(`[BITMAP DATA] Parsed ${part} → 0x${rawValue.toString(16)}`);


      // Unpack data based on explicit packed mode (if specified) or derived from color mode
      const packedMode = this.displaySpec?.explicitPackedMode || this.getPackedDataMode();
      this.logMessage(`[UNPACK] Mode=${packedMode}, rawValue=0x${rawValue.toString(16)}`);
      const unpackedValues = PackedDataProcessor.unpackSamples(
        rawValue,
        packedMode
      );
      this.logMessage(`[UNPACK] Got ${unpackedValues.length} values: [${unpackedValues.map(v => '0x'+v.toString(16)).join(', ')}]`);

      // Process each unpacked value
      this.logMessage(`[LOOP] Starting loop: ${unpackedValues.length} values, rate=${this.state.rate}, rateCounter=${this.state.rateCounter}`);
      for (let idx = 0; idx < unpackedValues.length; idx++) {
        const value = unpackedValues[idx];
        // Handle rate cycling
        this.state.rateCounter++;
        this.logMessage(`[LOOP] Iteration ${idx+1}/${unpackedValues.length}: value=0x${value.toString(16)}, rateCounter=${this.state.rateCounter}, rate=${this.state.rate}, condition=${this.state.rateCounter >= this.state.rate}`);
        if (this.state.rateCounter >= this.state.rate) {
          this.state.rateCounter = 0;

          // Get current pixel position
          const pos = this.traceProcessor.getPosition();

          // Skip if sparse mode and value matches background
          if (this.state.sparseMode && value === this.state.backgroundColor) {
            this.traceProcessor.step();
            continue;
          }

          // Translate color
          const rgb24 = this.colorTranslator.translateColor(value);
          const color = `#${rgb24.toString(16).padStart(6, '0')}`;
          this.logMessage(`[COLOR] Translate 0x${value.toString(16)} (mode=${this.state.colorMode}) → rgb24=0x${rgb24.toString(16)} → ${color}`);

          // Plot pixel with SPARSE mode two-layer rendering if enabled
          if (this.debugWindow) {
            if (this.state.sparseMode) {
              // SPARSE MODE: Two-layer rendering with border effect
              // Calculate center position with offset (Pascal: x := vPixelX * vDotSize + vDotSize shr 1)
              const centerX = pos.x * this.state.dotSizeX + (this.state.dotSizeX >> 1);
              const centerY = pos.y * this.state.dotSizeY + (this.state.dotSizeY >> 1);

              // Convert border color to hex string
              const borderRgb24 = this.state.backgroundColor & 0xFFFFFF;
              const borderColor = `#${borderRgb24.toString(16).padStart(6, '0')}`;

              // LAYER 1: Draw outer rectangle (border) at 100% DOTSIZE
              const outerX = centerX - (this.state.dotSizeX >> 1);
              const outerY = centerY - (this.state.dotSizeY >> 1);
              const outerCode = `
                const canvas = document.getElementById('${this.bitmapCanvasId}');
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.fillStyle = '${borderColor}';
                    ctx.fillRect(${outerX}, ${outerY}, ${this.state.dotSizeX}, ${this.state.dotSizeY});
                  }
                }
              `;
              this.debugWindow.webContents.executeJavaScript(outerCode)
                .catch(err => this.logMessage(`ERROR plotting outer rect: ${err}`));

              // LAYER 2: Draw inner rectangle (pixel) at 75% DOTSIZE
              // Pascal: vDotSize - vDotSize shr 2 (subtract 25% = 75% remaining)
              const innerW = this.state.dotSizeX - (this.state.dotSizeX >> 2);
              const innerH = this.state.dotSizeY - (this.state.dotSizeY >> 2);
              const innerX = centerX - (innerW >> 1);
              const innerY = centerY - (innerH >> 1);
              const innerCode = `
                const canvas = document.getElementById('${this.bitmapCanvasId}');
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.fillStyle = '${color}';
                    ctx.fillRect(${innerX}, ${innerY}, ${innerW}, ${innerH});
                  }
                }
              `;
              this.debugWindow.webContents.executeJavaScript(innerCode)
                .catch(err => this.logMessage(`ERROR plotting inner rect: ${err}`));
            } else {
              // NORMAL MODE: Standard pixel plotting
              if (this.state.dotSizeX === 1 && this.state.dotSizeY === 1) {
                this.debugWindow.webContents.executeJavaScript(
                  this.canvasRenderer.plotPixel(this.bitmapCanvasId, pos.x, pos.y, color)
                ).catch(err => this.logMessage(`ERROR plotting pixel: ${err}`));
              } else {
                const plotCode = this.canvasRenderer.plotScaledPixel(
                  this.bitmapCanvasId,
                  pos.x,
                  pos.y,
                  color,
                  this.state.dotSizeX,
                  this.state.dotSizeY
                );
                this.logMessage(`[PLOT] Executing: canvas='${this.bitmapCanvasId}' pos=(${pos.x},${pos.y}) color=${color} dot=(${this.state.dotSizeX},${this.state.dotSizeY})`);
                this.debugWindow.webContents.executeJavaScript(plotCode)
                  .catch(err => {
                    this.logMessage(`ERROR plotting scaled pixel: ${err}`);
                    this.logMessage(`Failed code: ${plotCode.substring(0, 200)}...`);
                  });
              }
            }
          }

          // Step to next position
          this.traceProcessor.step();
        }
      }
    }
  }

  /**
   * Check if string is numeric
   */
  private isNumeric(str: string): boolean {
    return /^-?\d+$/.test(str);
  }

  /**
   * Parse color value (handles $hex, %binary, %%quaternary, and decimal)
   * Note: PackedDataProcessor handles packed data streams separately
   */
  private parseColorValue(str: string): number {
    const value = Spin2NumericParser.parseColor(str);
    return value !== null ? value : 0;
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
        mode = ePackedDataMode.PDM_LONGS_8BIT;
        bitsPerSample = 8;
        valueSize = ePackedDataWidth.PDW_LONGS;
        break;
      case ColorMode.HSV16:
      case ColorMode.HSV16W:
      case ColorMode.HSV16X:
      case ColorMode.RGB16:
        mode = ePackedDataMode.PDM_LONGS_16BIT;
        bitsPerSample = 16;
        valueSize = ePackedDataWidth.PDW_LONGS;
        break;
      case ColorMode.RGB24:
        mode = ePackedDataMode.PDM_UNKNOWN; // RGB24 as 32-bit (no packing)
        bitsPerSample = 32;
        valueSize = ePackedDataWidth.PDW_LONGS;
        break;
      default:
        mode = ePackedDataMode.PDM_LONGS_8BIT;
        bitsPerSample = 8;
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
    // Use base class method for consistent chrome adjustments
    const windowDimensions = this.calculateWindowDimensions(canvasWidth, canvasHeight);
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
        const DebugLoggerWindow = require('./debugLoggerWin').DebugLoggerWindow;
        const debugLogger = DebugLoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(`WINDOW_PLACED (${windowX},${windowY} ${windowWidth}x${windowHeight} Mon:${monitorId}) BITMAP '${this.idString}' POS ${windowX} ${windowY} SIZE ${windowWidth} ${windowHeight}`);
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    // Register window with WindowPlacer for position tracking
    if (this.debugWindow) {
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
      // Register with WindowRouter when window is ready
      this.registerWithRouter();
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

          console.log('[BITMAP_WINDOW] Mouse coordinate tracking initialized');
        })();
      `;

      this.debugWindow?.webContents.executeJavaScript(mouseTrackingCode)
        .then(() => {
          this.logMessage('Mouse coordinate tracking enabled');
        })
        .catch(error => {
          this.logMessage(`Failed to enable mouse coordinate tracking: ${error}`);
        });
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
}