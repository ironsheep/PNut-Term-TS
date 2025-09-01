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
  size?: { width: number; height: number };
  dotSize?: { x: number; y: number };
  backgroundColor?: number;
  hideXY?: boolean;
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
    
    console.log(`CL: at parseBitmapDeclaration()`);
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
            if (i + 2 < lineParts.length) {
              const x = parseInt(lineParts[++i]);
              const y = parseInt(lineParts[++i]);
              if (!isNaN(x) && !isNaN(y) && x >= 1 && y >= 1) {
                displaySpec.dotSize = { x, y };
              } else {
                errorMessage = 'DOTSIZE directive requires two positive numeric values';
                isValid = false;
              }
            } else {
              errorMessage = 'DOTSIZE directive missing values';
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
            
          default:
            // Unknown directive - could be packed data mode
            // For now, just skip it
            break;
        }
        
        i++;
      }
    }
    
    if (!isValid) {
      console.log(`ERROR: parseBitmapDeclaration() - ${errorMessage}`);
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
    
    // Initialize state with defaults
    this.state = {
      width: 256,
      height: 256,
      dotSizeX: 1,
      dotSizeY: 1,
      rate: 0, // 0 means use suggested rate
      rateCounter: 0,
      backgroundColor: 0x000000,
      sparseMode: false,
      manualUpdate: false,
      tracePattern: 0,
      colorMode: ColorMode.RGB8,
      colorTune: 0,
      isInitialized: false
    };

    // Initialize shared components
    this.lutManager = new LUTManager();
    this.colorTranslator = new ColorTranslator();
    this.colorTranslator.setLutPalette(this.lutManager.getPalette());
    this.traceProcessor = new TracePatternProcessor();
    this.canvasRenderer = new CanvasRenderer();

    // Set up canvas ID for bitmap
    this.bitmapCanvasId = `bitmap-canvas-${this.idString}`;

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
  protected processMessageImmediate(lineParts: string[]): void {
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
        case 'CLEAR':
          this.clearBitmap();
          dataStartIndex = i + 1;
          break;

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

        case 'UPDATE':
          this.updateCanvas();
          dataStartIndex = i + 1;
          break;

        case 'SCROLL':
          if (i + 2 < lineParts.length) {
            const scrollX = parseInt(lineParts[i + 1]);
            const scrollY = parseInt(lineParts[i + 2]);
            this.scrollBitmap(scrollX, scrollY);
            dataStartIndex = i + 3;
            i += 2;
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

        case 'SAVE':
          // Handle SAVE command with optional WINDOW parameter
          let saveWindow = false;
          let filename = '';
          if (i + 1 < lineParts.length) {
            if (lineParts[i + 1].toUpperCase() === 'WINDOW') {
              saveWindow = true;
              filename = lineParts[i + 2] || 'bitmap.bmp';
              i++;
            } else {
              filename = lineParts[i + 1];
            }
            this.saveBitmap(filename, saveWindow);
            dataStartIndex = i + 2;
            i++;
          }
          break;

        case 'PC_KEY':
        case 'PC_MOUSE':
          // These commands should appear last in DEBUG statement
          // They enable input forwarding
          if (part === 'PC_KEY') {
            this.enableKeyboardInput();
          } else {
            this.enableMouseInput();
          }
          dataStartIndex = lineParts.length; // No data after these
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

    // Update RATE if it's 0 (use suggested rate)
    if (this.state.rate === 0) {
      this.state.rate = this.traceProcessor.getSuggestedRate();
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

    this.debugWindow.webContents.executeJavaScript(clearJS);
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
    this.debugWindow.webContents.executeJavaScript(
      this.canvasRenderer.scrollBitmap(
        this.bitmapCanvasId,
        scrollX * this.state.dotSizeX,
        scrollY * this.state.dotSizeY,
        this.state.width * this.state.dotSizeX,
        this.state.height * this.state.dotSizeY
      )
    );
  }

  /**
   * Set trace pattern
   */
  private setTracePattern(pattern: number): void {
    this.state.tracePattern = pattern & 0xF; // 0-15
    this.traceProcessor.setPattern(pattern);

    // Update rate if 0
    if (this.state.rate === 0) {
      this.state.rate = this.traceProcessor.getSuggestedRate();
    }
  }

  /**
   * Set pixel update rate
   */
  private setRate(rate: number): void {
    this.state.rate = Math.max(0, rate);
    this.state.rateCounter = 0;

    // If rate is 0, use suggested rate
    if (this.state.rate === 0) {
      this.state.rate = this.traceProcessor.getSuggestedRate();
    }
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
      // Parse LUT colors
      for (const colorStr of remainingParts) {
        // Try to parse color value (handles $, %, and plain numbers)
        let colorValue: number | null = null;
        
        if (colorStr.startsWith('$')) {
          const parsed = parseInt(colorStr.substring(1), 16);
          if (!isNaN(parsed)) colorValue = parsed;
        } else if (colorStr.startsWith('%')) {
          const parsed = parseInt(colorStr.substring(1), 2);
          if (!isNaN(parsed)) colorValue = parsed;
        } else if (this.isNumeric(colorStr)) {
          colorValue = parseInt(colorStr);
        }
        
        if (colorValue !== null) {
          const index = this.lutManager.getPaletteSize();
          if (index < 256) {
            this.lutManager.setColor(index, colorValue);
          }
        }
      }
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

    for (const part of dataParts) {
      if (!this.isNumeric(part)) continue;

      const rawValue = parseInt(part);
      
      // Unpack data based on current packed mode
      const unpackedValues = PackedDataProcessor.unpackSamples(
        rawValue,
        this.getPackedDataMode()
      );

      // Process each unpacked value
      for (const value of unpackedValues) {
        // Handle rate cycling
        this.state.rateCounter++;
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

          // Plot pixel
          if (this.state.dotSizeX === 1 && this.state.dotSizeY === 1) {
            if (this.debugWindow) {
              this.debugWindow.webContents.executeJavaScript(
              this.canvasRenderer.plotPixel(this.bitmapCanvasId, pos.x, pos.y, color)
            );
            }
          } else {
            if (this.debugWindow) {
              this.debugWindow.webContents.executeJavaScript(
              this.canvasRenderer.plotScaledPixel(
                this.bitmapCanvasId, 
                pos.x, 
                pos.y, 
                color,
                this.state.dotSizeX,
                this.state.dotSizeY
              )
            );
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
    const windowWidth = canvasWidth + 20; // Add some padding
    const windowHeight = canvasHeight + 40; // Add title bar height
    
    // Check if position was explicitly set or use WindowPlacer
    let windowX = this.initialPosition?.x || 0;
    let windowY = this.initialPosition?.y || 0;
    
    // If position is at default (0,0), use WindowPlacer for intelligent positioning
    if (windowX === 0 && windowY === 0) {
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width: windowWidth, height: windowHeight },
        cascadeIfFull: true
      };
      const position = windowPlacer.getNextPosition(`bitmap-${this.idString}`, placementConfig);
      windowX = position.x;
      windowY = position.y;
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