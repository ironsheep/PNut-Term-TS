/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow } from 'electron';
// src/classes/debugPlotWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './shared/debugColor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { ColorTranslator, ColorMode } from './shared/colorTranslator';
import { LUTManager } from './shared/lutManager';
import { LayerManager, CropRect } from './shared/layerManager';
import { SpriteManager } from './shared/spriteManager';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { DisplaySpecParser, BaseDisplaySpec } from './shared/displaySpecParser';
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';
// Removed complex parser: import { PlotCommandParser } from './shared/plotCommandParser';
import { PlotWindowIntegrator, PlotCanvasOperation, CanvasOperationType } from './shared/plotParserIntegration';
import { PlotPerformanceMonitor } from './shared/plotPerformanceMonitor';

// Compile-time flag for performance monitoring
const ENABLE_PERFORMANCE_MONITORING = false;

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

import {
  DebugWindowBase,
  eHorizJustification,
  eVertJustification,
  eTextWeight,
  FontMetrics,
  Position,
  Size,
  TextStyle,
  WindowColor
} from './debugWindowBase';
import { TIMEOUT } from 'dns';

export interface LutColor {
  fgcolor: string;
  bgcolor: string;
}
export interface PlotDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  position: Position;
  hasExplicitPosition: boolean; // true if POS clause was in original message
  size: Size;
  dotSize: Size;
  window: WindowColor;
  lutColors: LutColor[];
  delayedUpdate: boolean;
  hideXY: boolean;
  colorMode?: ColorMode; // Optional color mode (LUT1, RGBI8, RGB24, etc.)
}

export enum eCoordModes {
  CM_UNKNOWN = 0,
  CM_POLAR,
  CM_CARTESIAN
}

export interface PolarSpec {
  // In polar mode, (x, y) coordinates are interpreted as (radius, angle).
  twopi: number; // Full circle value (defaults to 0x100000000, -1 = -0x100000000, 0 = 0x100000000)
  theta: number; // Angle offset (defaults to 0)
}

export interface CartesianSpec {
  ydir: boolean; // If ydir is 0, the Y axis points up. If ydir is non-0, the Y axis points down.
  xdir: boolean; // If xdir is 0, the X axis points right. If xdir is non-0, the X axis points left.
}

/**
 * Debug PLOT Window - Sprite-based Graphics Display
 *
 * Provides 2D graphics plotting with sprites, layers, and coordinate transformations.
 * Supports both Cartesian and Polar coordinate systems with programmable LUT colors and double buffering.
 *
 * ## Features
 * - **Sprite Management**: Dynamic sprite creation, transformation, and layer management
 * - **Coordinate Systems**: Cartesian (with configurable axis directions) and Polar modes
 * - **Layer Support**: Multiple drawing layers with opacity and blending modes
 * - **Double Buffering**: Smooth animation with automatic buffer swapping
 * - **LUT Colors**: Lookup table colors for efficient palette-based rendering
 * - **Drawing Primitives**: DOT, LINE, ARC, BOX, OVAL, and text rendering
 * - **Transformations**: Scale, rotate, and position sprites with real-time updates
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE width height` - Set window size (32-2048, default: 256x256)
 * - `DOTSIZE x y` - Set dot dimensions (1-32, default: 1x1)
 * - `CARTESIAN xdir ydir` - Set Cartesian axis directions (0=normal, 1=inverted)
 * - `POLAR twopi offset` - Set polar coordinate system parameters
 * - `COLOR bg {grid}` - Window and grid colors (default: BLACK)
 * - Packing modes: `LONGS`, `WORDS`, `BYTES` with optional `SIGNED`/`ALT` modifiers
 * - `HIDEXY` - Hide coordinate display
 *
 * ## Data Format
 * Drawing commands: `DOT x y`, `LINE x1 y1 x2 y2`, `BOX x y width height`
 * Sprite operations: `SPRITE name x y scale rotation`
 * Color commands: `LUT index color`, `LUTFILL start count color`
 * Coordinate data can be fed as individual values or packed data streams
 * - Example: `debug(\`MyPlot DOT 100 150 LINESIZE 2 RED 15\`)`
 *
 * ## Commands
 * - `CLEAR` - Clear display and reset all layers
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Capture keyboard input and transmit to P2 (handled by base class)
 * - `PC_MOUSE` - Capture mouse input and transmit to P2 (handled by base class)
 * - `DOT x y` - Draw dot at coordinates, `LINE x1 y1 x2 y2` - Draw line
 * - `BOX x y w h` - Draw rectangle, `OVAL x y w h` - Draw ellipse
 * - `ARC x y r start end` - Draw arc, `TEXT x y 'string'` - Draw text
 * - `LINESIZE size` - Set line width, `OPACITY level` - Set transparency
 * - `SPRITE name x y` - Position sprite, `LUT index color` - Set palette color
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `PLOT_Configure` procedure (line 1864)
 * - Update: `PLOT_Update` procedure (line 1918)
 * - Sprite management: `Plot_Sprite_Create`, `Plot_Sprite_Update` procedures
 * - Layer operations: `Plot_Layer_Manage` procedures
 * - Drawing primitives: `Plot_Draw_*` procedure families
 *
 * ## Examples
 * ```spin2
 * ' Basic plotting with sprites
 * debug(`PLOT MyPlot SIZE 320 240 CARTESIAN 0 1)
 * debug(`MyPlot LUT 1 RED 15)
 * debug(`MyPlot LUT 2 BLUE 15)
 *
 * ' Draw animated sprite
 * repeat angle from 0 to 359
 *   x := qsin(angle, 100, 30)
 *   y := qcos(angle, 100, 30)
 *   debug(`MyPlot CLEAR DOT \`(x+160, y+120))
 *   waitms(10)
 * ```
 *
 * ## Implementation Notes
 * - Follows Pascal PNut behavior for parameter handling (no range validation)
 * - Sprite system supports dynamic creation and transformation
 * - Layer management enables complex overlay graphics
 * - Double buffering prevents flicker during rapid updates
 * - Invalid parameters retain previous values rather than using defaults
 * - Negative dimensions in BOX/OVAL are drawn as-is for directional drawing
 *
 * ## Deviations from Pascal
 * - Enhanced sprite transformation matrix calculations
 * - Additional error logging for debugging purposes
 * - Improved memory management for large sprite collections
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_PLOT.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugPlotWindow extends DebugWindowBase {
  private displaySpec: PlotDisplaySpec = {} as PlotDisplaySpec;
  private isFirstDisplayData: boolean = true;
  private contentInset: number = 0; // 0 pixels from left and right of window
  private plotMouseEventHandlersSetup: boolean = false; // Guard for Plot-specific IPC handlers
  // current terminal state
  // Removed deferredCommands - now using single queue architecture
  public cursorPosition: Position = { x: 0, y: 0 };
  private selectedLutColor: number = 0;
  public font: FontMetrics = {} as FontMetrics;
  public textStyle: TextStyle = {} as TextStyle;
  private origin: Position = { x: 0, y: 0 }; // users are: DOT, LINE, CIRCLE, OVAL, BOX, OBOX
  private canvasOffset: Position = { x: 0, y: 0 };

  private polarConfig: PolarSpec = { twopi: 0x100000000, theta: 0 };
  private cartesianConfig: CartesianSpec = { ydir: false, xdir: false }; // Pascal default: vDirY := False (mathematical coords)
  private coordinateMode: eCoordModes = eCoordModes.CM_CARTESIAN; // default to cartesian mode
  private lineSize: number = 1;
  public currFgColor: string = '#00FFFF'; // #RRGGBB string - Pascal: DefaultPlotColor = clCyan
  public currTextColor: string = '#FFFFFF'; // #RRGGBB string - Pascal: DefaultTextColor = clWhite

  // Queue for pending canvas operations that need to be executed at display time
  private pendingOperations: PlotCanvasOperation[] = [];

  // Simple parser state variables
  private vPixelX: number = 0;  // Raw cursor X value
  private vPixelY: number = 0;  // Raw cursor Y value
  private plotCoordX: number = 0;  // Converted plot X coordinate
  private plotCoordY: number = 0;  // Converted plot Y coordinate
  private isCartesian: boolean = true;  // True = Cartesian mode, False = Polar mode
  private isPrecise: boolean = false;  // Precise coordinate mode

  private shouldWriteToCanvas: boolean = true;
  private canvasInitialized: boolean = false;

  // Double buffering support
  private workingCanvas?: OffscreenCanvas;
  private workingCtx?: OffscreenCanvasRenderingContext2D;
  private displayCanvas?: HTMLCanvasElement;
  private displayCtx?: CanvasRenderingContext2D;

  // Shared classes for enhanced functionality
  private canvasRenderer: CanvasRenderer;
  private colorTranslator: ColorTranslator;
  private lutManager: LUTManager;
  private layerManager: LayerManager;
  private spriteManager: SpriteManager;

  // State for new features
  private opacity: number = 255; // 0-255
  private textAngle: number = 0; // degrees
  private colorMode: ColorMode = ColorMode.RGB24;
  private updateMode: boolean = false; // True = buffered mode (wait for UPDATE), False = live mode (immediate display)

  // New parser system
  // Removed complex parser: private plotCommandParser: PlotCommandParser;
  private plotWindowIntegrator: PlotWindowIntegrator;

  // Performance monitoring
  private performanceMonitor?: PlotPerformanceMonitor;

  // PLOT-specific input state (legacy - now handled by base class)
  // These are kept for compatibility but base class vKeyPress and mouse state variables are used
  private lastPressedKey: number = 0; // Legacy - use base class vKeyPress instead
  private keyBuffer: number[] = []; // Legacy - not used with base class implementation
  private currentMouseState: number = 0; // Legacy - use base class mouse state variables instead

  constructor(ctx: Context, displaySpec: PlotDisplaySpec, windowId: string = `plot-${Date.now()}`) {
    super(ctx, windowId, 'plot');
    this.windowLogPrefix = 'pltW';
    DebugColor.setDefaultBrightness(8); // Default to full saturated color (brightness 8 in RGBI8X), not pale (15)

    // Enable logging for PLOT window
    this.isLogging = true;

    // record our Debug Plot Window Spec
    this.displaySpec = displaySpec;
    this.updateMode = displaySpec.delayedUpdate || false; // Set update mode from display spec
    this.hideXY = displaySpec.hideXY || false; // Apply hideXY from display spec to base class property
    if (displaySpec.colorMode) {
      this.colorMode = displaySpec.colorMode; // Apply color mode from display spec
      this.logMessage(`DebugPlotWin: colorMode set to ${displaySpec.colorMode}`);
    }
    this.logMessage(`DebugPlotWin: updateMode = ${this.updateMode} (${this.updateMode ? 'buffered' : 'live'} drawing)`);
    // calculate canvasOffet for origin
    this.canvasOffset = { x: displaySpec.size.width / 2, y: displaySpec.size.height / 2 };
    // start with default font size
    DebugPlotWindow.calcMetricsForFontPtSize(10, this.font);
    const normalText: number = 0b00000001;
    DebugPlotWindow.calcStyleFromBitfield(normalText, this.textStyle);

    // Initialize shared classes
    this.canvasRenderer = new CanvasRenderer();
    this.lutManager = new LUTManager();
    this.colorTranslator = new ColorTranslator();
    this.colorTranslator.setLutPalette(this.lutManager.getPalette());
    // Apply color mode to translator
    if (displaySpec.colorMode) {
      this.colorTranslator.setColorMode(displaySpec.colorMode);
    }
    this.layerManager = new LayerManager();
    this.spriteManager = new SpriteManager();

    // Initialize new parser system
    // Removed complex parser: this.plotCommandParser = new PlotCommandParser(this.context);
    this.plotWindowIntegrator = new PlotWindowIntegrator(this);

    // Initialize performance monitoring (if enabled)
    if (ENABLE_PERFORMANCE_MONITORING) {
      this.performanceMonitor = new PlotPerformanceMonitor({
        targetFPS: 60,
        maxCommandTime: 10,
        maxRenderTime: 16,
        memoryWarningThreshold: 100 * 1024 * 1024
      });
    }

    // CRITICAL FIX: Create window immediately in constructor
    // This ensures windows appear when created, matching Scope XY pattern
    this.logMessage('Creating PLOT window immediately in constructor');
    this.createDebugWindow();
  }

  /**
   * Log a warning about an invalid parameter with defensive default
   * TECH-DEBT: Enhanced error logging with full command context
   */
  private logParsingWarning(
    unparsedCommand: string,
    paramName: string,
    invalidValue: string | null,
    defaultValue: any
  ): void {
    const valueDisplay = invalidValue === null ? 'missing' : `'${invalidValue}'`;
    this.logMessage(
      `WARNING: Debug command parsing error:\n${unparsedCommand}\nInvalid ${valueDisplay} value for parameter ${paramName}, using default: ${defaultValue}`
    );
  }

  get windowTitle(): string {
    let desiredValue: string = `${this.displaySpec.displayName} PLOT`;
    if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
      desiredValue = this.displaySpec.windowTitle;
    }
    return desiredValue;
  }

  /**
   * Get the LUT manager for palette operations
   * Used by integrator and tests to access color palette management
   */
  getLutManager(): LUTManager {
    return this.lutManager;
  }

  /**
   * Get the color translator for color format conversions
   * Used by integrator and tests to access color translation functionality
   */
  getColorTranslator(): ColorTranslator {
    return this.colorTranslator;
  }

  /**
   * Get the Y-axis direction configuration
   * @returns true if Y increases downward (screen coordinates), false if Y increases upward (mathematical coordinates)
   */
  public get ydir(): boolean {
    return this.cartesianConfig.ydir;
  }

  /**
   * Remove surrounding quotes from a string if present
   * @param str The string to process
   * @returns String with quotes removed, or original if no quotes
   */
  private static removeQuotes(str: string): string {
    if (str.length >= 2) {
      if ((str[0] === '"' && str[str.length - 1] === '"') || (str[0] === "'" && str[str.length - 1] === "'")) {
        return str.substring(1, str.length - 1);
      }
    }
    return str;
  }

  static parsePlotDeclaration(lineParts: string[]): [boolean, PlotDisplaySpec] {
    // here with lineParts = ['`PLOT', {displayName}, ...]
    // Valid directives are:
    //   TITLE <title>
    //   POS <left> <top> [default: 0,0]
    //   SIZE <width> <height> [ea. 32-2048, default: 256,256]
    //   DOTSIZE <width-or-both> [<height>] [default: 1,1]
    //   lut1_to_rgb24
    //   LUTCOLORS rgb24 rgb24 ... [default: colors 0..7]
    //   BACKCOLOR <bgnd-color> [default: BLACK]
    //   UPDATE
    //   HIDEXY
    DebugPlotWindow.logConsoleMessageStatic(`CL: at parsePlotDeclaration()`);
    let displaySpec: PlotDisplaySpec = {} as PlotDisplaySpec;
    displaySpec.lutColors = [] as LutColor[]; // ensure this is structured too! (CRASHED without this!)
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults (use brightness 8 for full saturated colors in RGBI8X system)
    const bkgndColor: DebugColor = new DebugColor('BLACK', 8); // Pascal: DefaultBackColor = clBlack (brightness doesn't affect black)
    const gridColor: DebugColor = new DebugColor('GRAY', 4); // Dim gray for grid
    const textColor: DebugColor = new DebugColor('WHITE', 8); // Pascal: DefaultTextColor = clWhite (full saturated white)
    DebugPlotWindow.logConsoleMessageStatic(`CL: at parsePlotDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.hasExplicitPosition = false; // Default: use auto-placement
    displaySpec.size = { width: 256, height: 256 };
    displaySpec.dotSize = { width: 1, height: 1 };
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;
    displaySpec.delayedUpdate = false;
    displaySpec.hideXY = false;
    // by default we have combo #0 defined
    //displaySpec.lutColors.push({ fgcolor: displaySpec.textColor, bgcolor: displaySpec.window.background });

    // now parse overrides to defaults
    DebugPlotWindow.logConsoleMessageStatic(`CL: at overrides PlotDisplaySpec: ${lineParts}`);
    if (lineParts.length > 1) {
      displaySpec.displayName = lineParts[1];
      isValid = true; // invert default value
    }
    if (lineParts.length > 2) {
      for (let index = 2; index < lineParts.length; index++) {
        const element = lineParts[index];

        // Try shared parser first for common keywords (TITLE, POS, SIZE)
        const compatibleSpec: Partial<BaseDisplaySpec> = {
          title: displaySpec.windowTitle,
          position: displaySpec.position,
          hasExplicitPosition: displaySpec.hasExplicitPosition,
          size: displaySpec.size,
          nbrSamples: 0, // Not used by PLOT
          window: displaySpec.window
        };
        const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(
          lineParts,
          index,
          compatibleSpec as BaseDisplaySpec
        );
        if (parsed) {
          // Copy parsed values back to displaySpec
          displaySpec.windowTitle = compatibleSpec.title!;
          if (compatibleSpec.position) displaySpec.position = compatibleSpec.position;
          if (compatibleSpec.hasExplicitPosition) displaySpec.hasExplicitPosition = compatibleSpec.hasExplicitPosition;
          if (compatibleSpec.size) displaySpec.size = compatibleSpec.size;
          if (compatibleSpec.hideXY !== undefined) displaySpec.hideXY = compatibleSpec.hideXY;
          index += consumed - 1; // Adjust for loop increment
        } else {
          // Handle PLOT-specific keywords
          switch (element.toUpperCase()) {
            case 'BACKCOLOR':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                const colorName: string = lineParts[++index];
                let colorBrightness: number = 8; // Default to full saturated color (brightness 8 in RGBI8X), not pale (15)
                if (index < lineParts.length - 1) {
                  // Check if next part is numeric (simple check for 0-9 or -)
                  const nextPart = lineParts[index + 1];
                  if (nextPart && /^-?\d/.test(nextPart)) {
                    colorBrightness = Number(lineParts[++index]);
                  }
                }
                const textColor = new DebugColor(colorName, colorBrightness);
                displaySpec.window.background = textColor.rgbString;
              } else {
                DebugPlotWindow.logConsoleMessageStatic(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            case 'UPDATE':
              displaySpec.delayedUpdate = true;
              DebugPlotWindow.logConsoleMessageStatic('CL: PlotDisplaySpec: UPDATE mode enabled (buffered drawing)');
              break;
            case 'HIDEXY':
              displaySpec.hideXY = true;
              DebugPlotWindow.logConsoleMessageStatic('CL: PlotDisplaySpec: HIDEXY enabled');
              break;

            // Color mode keywords
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
              displaySpec.colorMode = element.toUpperCase() as ColorMode;
              DebugPlotWindow.logConsoleMessageStatic(`CL: PlotDisplaySpec: Color mode set to ${element.toUpperCase()}`);
              break;

            default:
              DebugPlotWindow.logConsoleMessageStatic(`CL: PlotDisplaySpec: Unknown directive: ${element}`);
              break;
          }
        }
        if (!isValid) {
          break;
        }
      }
    }
    DebugPlotWindow.logConsoleMessageStatic(
      `CL: at end of parsePlotDeclaration(): isValid=(${isValid}), ${JSON.stringify(displaySpec, null, 2)}`
    );
    return [isValid, displaySpec];
  }

  private createDebugWindow(): void {
    this.logMessage(`at createDebugWindow() PLOT`);
    // calculate overall canvas sizes then window size from them!

    // NOTES: Chip's size estimation:
    //  window width should be (#samples * 2) + (2 * 2); // 2 is for the 2 borders
    //  window height should be (max-min+1) + (2 * chanInset); // chanInset is for space above channel and below channel

    // set height so no scroller by default
    const canvasHeight = this.displaySpec.size.height;
    // for mono-spaced font width 1/2 ht in pts
    const canvasWidth = this.displaySpec.size.width; // contentInset' for the Xoffset into window for canvas

    const divHeight = canvasHeight + 4; // +20 for title bar (30 leaves black at bottom), 20 leaves black at bottom
    const divWidth = canvasWidth + 4; // contentInset' for the Xoffset into window for canvas, 20 is extra pad

    // Use base class method for consistent chrome adjustments
    const contentHeight = canvasHeight + 8; // +8 to prevent scrollbars
    const contentWidth = canvasWidth + this.contentInset * 2 + 8; // +8 to prevent scrollbars
    const windowDimensions = this.calculateWindowDimensions(contentWidth, contentHeight);
    const windowHeight = windowDimensions.height;
    const windowWidth = windowDimensions.width;
    // Check if position was explicitly set or is still at default (0,0)
    let windowX = this.displaySpec.position.x;
    let windowY = this.displaySpec.position.y;

    // If no POS clause was present, use WindowPlacer for intelligent positioning
    if (!this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width: windowWidth, height: windowHeight },
        cascadeIfFull: true
      };
      const position = windowPlacer.getNextPosition(`plot-${this.displaySpec.displayName}`, placementConfig);
      windowX = position.x;
      windowY = position.y;
      this.logMessage(`  -- PLOT using auto-placement: ${windowX},${windowY}`);

      // Log to debug logger with reproducible command format
      try {
        const LoggerWindow = require('./loggerWin').LoggerWindow;
        const debugLogger = LoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(
          `WINDOW_PLACED (${windowX},${windowY} ${windowWidth}x${windowHeight} Mon:${monitorId}) PLOT '${this.displaySpec.displayName}' POS ${windowX} ${windowY} SIZE ${windowWidth} ${windowHeight}`
        );
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }

    this.logMessage(`  -- PLOT window size: ${windowWidth}x${windowHeight} @${windowX},${windowY}`);

    // now generate the window with the calculated sizes
    const displayName: string = this.windowTitle;
    this.debugWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
      show: false, // Start hidden to prevent flashing
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Register window with WindowPlacer for position tracking (only if using auto-placement)
    if (this.debugWindow && !this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      windowPlacer.registerWindow(`plot-${this.displaySpec.displayName}`, this.debugWindow);
    }

    // hook window events before being shown
    this.debugWindow.once('ready-to-show', () => {
      this.logMessage('at ready-to-show');

      // Register with WindowRouter when window is ready
      this.registerWithRouter();

      // Remove menu for linux/windows
      if (this.debugWindow) {
        if (process.platform !== 'darwin') {
          try {
            this.debugWindow.removeMenu();
          } catch (error) {
            this.logMessage(`Failed to remove menu: ${error}`);
          }
        }

        // Show the window
        this.debugWindow.show();
        this.logMessage('* Plot window shown');
      }
    });

    this.debugWindow.on('show', () => {
      this.logMessage('* Plot window show event');
    });

    this.debugWindow.on('page-title-updated', () => {
      this.logMessage('* Plot window title updated');
    });

    // and load this window .html content
    const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8"></meta>
        <title>${displayName}</title>
        <style>
          @font-face {
            font-family: 'Parallax';
            src: url('${this.getParallaxFontUrl()}') format('truetype');
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Parallax', sans-serif;
            background-color: ${this.displaySpec.window.background};
            overflow: hidden;
            width: 100%;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          #plot-data {
            display: block;
            margin: 0;
            padding: 0;
            background-color: ${this.displaySpec.window.background};
            width: ${canvasWidth}px;
            height: ${canvasHeight}px;
            position: relative;
            box-sizing: border-box;
          }
          canvas {
            background-color: ${this.displaySpec.window.background};
            display: block;
            margin: 0;
          }
          ${
            ENABLE_PERFORMANCE_MONITORING
              ? `
          #performance-overlay {
            position: absolute;
            top: 5px;
            right: 5px;
            background-color: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 8px;
            border-radius: 4px;
            z-index: 1000;
            pointer-events: none;
            white-space: pre-line;
            min-width: 120px;
            display: none;
          }
          #performance-toggle {
            position: absolute;
            top: 5px;
            left: 5px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 10px;
            cursor: pointer;
            z-index: 1001;
          }
          `
              : ''
          }
          #coordinate-display {
            position: absolute;
            padding: 8px;
            background: ${this.displaySpec.window.background};
            color: ${this.displaySpec.window.grid};
            border: 1px solid ${this.displaySpec.window.grid};
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
        <div id="plot-data">
          <canvas id="plot-area" width="${canvasWidth}" height="${canvasHeight}"></canvas>
          <div id="coordinate-display"></div>
          ${
            ENABLE_PERFORMANCE_MONITORING
              ? '<button id="performance-toggle" onclick="togglePerformanceOverlay()">PERF</button>'
              : ''
          }
          ${ENABLE_PERFORMANCE_MONITORING ? '<div id="performance-overlay"></div>' : ''}
        </div>
        <script>
          // Input event handlers injected by base class enableMouseInput()/enableKeyboardInput()
          // This ensures consistent behavior across all window types
          if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT INPUT] Initial script loaded - input handlers will be injected by base class');
        </script>
      </body>
    </html>
  `;

    this.logMessage(`at createDebugWindow() PLOT - loading HTML (length: ${htmlContent.length} chars)`);

    try {
      // Write HTML to temp file and load it - this gives file:// context which allows
      // access to local resources like fonts (data: URLs block local file access)
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `pnut-plot-${this.windowId}-${Date.now()}.html`);

      fs.writeFileSync(tempFile, htmlContent);
      this.logMessage(`Wrote HTML to temp file: ${tempFile}`);

      // Load the temp file instead of using data URL
      this.debugWindow.loadFile(tempFile);

      // Clean up temp file immediately after load finishes
      // Once loaded, the content is in memory so the file is no longer needed
      this.debugWindow.webContents.once('did-finish-load', () => {
        try {
          fs.unlinkSync(tempFile);
          this.logMessage(`Cleaned up temp file after load: ${tempFile}`);
        } catch (err) {
          // File might already be gone, that's ok
          this.logMessage(`Temp file cleanup error (non-fatal): ${err}`);
        }
      });
    } catch (error) {
      this.logMessage(`Failed to load HTML file: ${error}`);
    }

    // Add console message listener to see renderer console output
    this.debugWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      this.logMessage(`[RENDERER CONSOLE] ${message}`);
    });

    // Menu.setApplicationMenu(null); // DOESNT WORK!

    // now hook load complete event so we can label and paint the grid/min/max, etc.
    this.debugWindow.webContents.once('did-finish-load', () => {
      this.logMessage('at did-finish-load');

      // Initialize the canvas for drawing
      this.initializeCanvas();

      // Enable mouse and keyboard input using base class implementation
      // This ensures consistent input handling across all window types
      this.enableMouseInput();
      this.enableKeyboardInput();

      // Set up Plot-specific coordinate display handler
      this.setupCoordinateDisplayHandler();
    });
  }

  private initializeCanvas(): void {
    if (!this.debugWindow) return;

    const width = this.displaySpec.size.width;
    const height = this.displaySpec.size.height;
    const bgColor = this.displaySpec.window.background;
    const useBuffering = this.updateMode; // Use buffering if in update mode

    const debugWindow = this.debugWindow;
    if (!debugWindow) {
      return;
    }

    const jsCode = `
      (function() {
        // Get the canvas element
        window.plotCanvas = document.getElementById('plot-area');
        if (!window.plotCanvas) {
          console.error('[PLOT] Canvas element not found');
          return 'Canvas not found';
        }

        window.displayCtx = window.plotCanvas.getContext('2d');
        if (!window.displayCtx) {
          console.error('[PLOT] Could not get 2D context');
          return 'Context not available';
        }

        // Fill the display canvas with background color immediately
        window.displayCtx.fillStyle = '${bgColor}';
        window.displayCtx.fillRect(0, 0, ${width}, ${height});

        // Setup based on update mode
        const useBuffering = ${useBuffering};

        if (useBuffering) {
          // Create offscreen canvas for double buffering
          window.offscreenCanvas = document.createElement('canvas');
          window.offscreenCanvas.width = ${width};
          window.offscreenCanvas.height = ${height};

          // plotCtx points to offscreen buffer
          window.plotCtx = window.offscreenCanvas.getContext('2d');
          if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] UPDATE mode: Drawing to offscreen buffer');
        } else {
          // plotCtx points directly to visible canvas
          window.plotCtx = window.displayCtx;
          if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] LIVE mode: Drawing directly to visible canvas');
        }

        // Function to flip buffer (copy offscreen to display)
        window.flipBuffer = function() {
          if (useBuffering && window.displayCtx && window.offscreenCanvas) {
            // Copy offscreen to display
            window.displayCtx.drawImage(window.offscreenCanvas, 0, 0);

            // DO NOT clear the buffer here!
            // The buffer should only be cleared by explicit CLEAR commands
            // Clearing here causes flashing because the next frame starts empty

            if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] Buffer flipped');
          } else if (!useBuffering) {
            // In live mode, no flip needed
            if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] Live mode - no buffer flip needed');
          }
        };

        // Clear the working canvas with background color
        window.plotCtx.fillStyle = '${bgColor}';
        window.plotCtx.fillRect(0, 0, ${width}, ${height});

        // Set initial drawing colors to avoid white-on-white
        // Pascal: DefaultPlotColor = clCyan, DefaultTextColor = clWhite
        window.plotCtx.strokeStyle = '${this.currFgColor}'; // Cyan for drawing
        window.plotCtx.fillStyle = '${this.currTextColor}'; // White for text
        window.currentFgColor = '${this.currFgColor}';
        window.currentTextColor = '${this.currTextColor}';

        // Don't flip immediately - display canvas already has background color
        // This prevents a potential flash during initialization

        if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] Canvas initialized with double buffering and default colors');
        return 'Canvas ready with double buffering';
      })()
    `;

    this.debugWindow.webContents
      .executeJavaScript(jsCode)
      .then((result) => {
        this.logMessage(`Canvas initialization: ${result}`);
        this.shouldWriteToCanvas = true;
        this.canvasInitialized = true;

        // If there are pending operations that were queued before canvas was ready,
        // execute them now. This handles the race condition where UPDATE command
        // arrives before canvas initialization completes.
        if (this.pendingOperations.length > 0) {
          this.logMessage(
            `Canvas ready - executing ${this.pendingOperations.length} pending operations that were queued during initialization`
          );
          this.performUpdate().catch((error) => {
            this.logMessage(`Failed to execute pending operations after canvas init: ${error}`);
          });
        }

        // Set up input event listeners after canvas is ready
        this.setupInputEventListeners();
        // Initialize performance overlay (if enabled)
        if (ENABLE_PERFORMANCE_MONITORING) {
          this.initializePerformanceOverlay();
        }
      })
      .catch((error) => {
        this.logMessage(`Failed to initialize canvas: ${error}`);
        this.shouldWriteToCanvas = false;
      });
  }

  private initializePerformanceOverlay(): void {
    if (!ENABLE_PERFORMANCE_MONITORING || !this.debugWindow) return;

    const overlayCode = `
      (function() {
        // Performance overlay toggle functionality
        window.performanceOverlayVisible = false;

        window.togglePerformanceOverlay = function() {
          const overlay = document.getElementById('performance-overlay');
          const toggle = document.getElementById('performance-toggle');

          window.performanceOverlayVisible = !window.performanceOverlayVisible;

          if (window.performanceOverlayVisible) {
            overlay.style.display = 'block';
            toggle.textContent = 'HIDE';
            toggle.style.backgroundColor = 'rgba(0, 128, 0, 0.6)';
          } else {
            overlay.style.display = 'none';
            toggle.textContent = 'PERF';
            toggle.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
          }
        };

        window.updatePerformanceOverlay = function(metricsData) {
          if (!window.performanceOverlayVisible) return;

          const overlay = document.getElementById('performance-overlay');
          if (overlay && metricsData) {
            overlay.innerHTML = metricsData;
          }
        };

        return 'Performance overlay initialized';
      })()
    `;

    this.debugWindow.webContents
      .executeJavaScript(overlayCode)
      .then((result) => {
        this.logMessage(`Performance overlay: ${result}`);
        // Start periodic performance updates
        this.startPerformanceUpdates();
      })
      .catch((error) => {
        this.logMessage(`Failed to initialize performance overlay: ${error}`);
      });
  }

  private performanceUpdateInterval?: NodeJS.Timeout;

  private startPerformanceUpdates(): void {
    // Update performance metrics every 500ms
    this.performanceUpdateInterval = setInterval(() => {
      this.updatePerformanceDisplay();
    }, 500);
  }

  private updatePerformanceDisplay(): void {
    if (!ENABLE_PERFORMANCE_MONITORING || !this.debugWindow || !this.performanceMonitor) return;

    const metrics = this.performanceMonitor.getMetrics();
    const warnings = this.performanceMonitor.getWarnings();

    const displayText = `FPS: ${metrics.currentFPS.toFixed(1)} (avg: ${metrics.averageFPS.toFixed(1)})
Cmd: ${metrics.commandProcessingTime.toFixed(1)}ms (avg: ${metrics.averageCommandTime.toFixed(1)}ms)
Render: ${metrics.renderTime.toFixed(1)}ms (avg: ${metrics.averageRenderTime.toFixed(1)}ms)
Mem: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB
Ops: ${metrics.canvasOperations}
Sprites: ${metrics.spriteOperations}
${warnings.length > 0 ? `⚠️ ${warnings.length} warnings` : '✓ OK'}`;

    const jsCode = `
      (function() {
        if (window.updatePerformanceOverlay) {
          window.updatePerformanceOverlay(\`${displayText.replace(/`/g, '\\`')}\`);
          return 'Updated';
        }
        return 'Not ready';
      })()
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      // Silently ignore errors during performance updates to avoid spam
    });
  }

  private setupInputEventListeners(): void {
    if (!this.debugWindow) return;

    // Note: Mouse event handlers are now in initial HTML with proper require('electron') access
    // This method only handles keyboard events which don't need IPC
    const inputHandlerCode = `
      (function() {
        // Initialize input state for keyboard
        window.lastPressedKey = 0;

        // Add keydown event listener to capture key presses
        document.addEventListener('keydown', function(event) {
          // Convert key to ASCII/scan code
          let keyCode = 0;

          if (event.key.length === 1) {
            // Regular character - use ASCII code
            keyCode = event.key.charCodeAt(0);
          } else {
            // Special keys - map to scan codes (simplified mapping)
            switch (event.key) {
              case 'Enter': keyCode = 13; break;
              case 'Escape': keyCode = 27; break;
              case 'Backspace': keyCode = 8; break;
              case 'Tab': keyCode = 9; break;
              case 'ArrowUp': keyCode = 38; break;
              case 'ArrowDown': keyCode = 40; break;
              case 'ArrowLeft': keyCode = 37; break;
              case 'ArrowRight': keyCode = 39; break;
              case 'Delete': keyCode = 46; break;
              case 'Home': keyCode = 36; break;
              case 'End': keyCode = 35; break;
              case 'PageUp': keyCode = 33; break;
              case 'PageDown': keyCode = 34; break;
              default: keyCode = 0; // Unknown key
            }
          }

          if (keyCode > 0) {
            window.lastPressedKey = keyCode;
            if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT INPUT] Key pressed:', event.key, 'Code:', keyCode);
          }
        });

        if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT INPUT] Keyboard event listeners setup complete');
        return 'Keyboard handlers ready';
      })()
    `;

    this.debugWindow.webContents
      .executeJavaScript(inputHandlerCode)
      .then((result) => {
        this.logMessage(`Input event listeners setup: ${result}`);
      })
      .catch((error) => {
        this.logMessage(`Failed to setup input event listeners: ${error}`);
      });
  }

  private setupDoubleBuffering(): void {
    // Double buffering is now handled in initializeCanvas
    // This method is kept for compatibility but doesn't do anything
  }

  private async performUpdate(): Promise<void> {
    if (!this.debugWindow || this.debugWindow.isDestroyed()) return;

    // Start frame monitoring for rendering operations (if enabled)
    if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor) {
      this.performanceMonitor.frameStart();
    }

    this.logMessage('at performUpdate() - executing queued operations and flipping buffer');

    // Start render timing (if enabled)
    if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor) {
      this.performanceMonitor.renderStart();
    }

    // Execute all pending operations sequentially BEFORE buffer flip
    if (this.pendingOperations.length > 0) {
      this.logMessage(`EXEC DEBUG: Executing ${this.pendingOperations.length} queued operations sequentially`);
      const operationResults = await this.plotWindowIntegrator.executeBatch(this.pendingOperations);
      this.logMessage(`EXEC DEBUG: executeBatch returned ${operationResults.length} results`);

      // Log any operation failures
      for (const opResult of operationResults) {
        if (!opResult.success) {
          for (const error of opResult.errors) {
            this.logMessage(`CANVAS ERROR: ${error}`);
          }
        }
      }

      // Clear the queue after execution
      this.pendingOperations = [];
    }

    // No more deferredCommands processing - integrator now calls drawing methods directly

    // Execute buffer flip in renderer and WAIT for it to complete
    const jsCode = `
      (function() {
        if (window.flipBuffer) {
          window.flipBuffer();
          return 'Buffer flipped';
        }
        return 'Flip function not ready';
      })()
    `;

    // Use await to ensure buffer flip completes before continuing
    try {
      const result = await this.debugWindow.webContents.executeJavaScript(jsCode);
      this.logMessage(`Buffer flip result: ${result}`);
    } catch (error) {
      this.logMessage(`Failed to flip buffer: ${error}`);
    }

    // End render timing (if enabled)
    if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor) {
      this.performanceMonitor.renderEnd();
    }
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() PLOT`);

    // Clean up Plot-specific resources that base class doesn't know about
    // Clear any pending operations
    this.pendingOperations = [];

    // Disable canvas writing to prevent any pending operations
    this.shouldWriteToCanvas = false;

    // Stop performance monitoring updates (if enabled)
    if (ENABLE_PERFORMANCE_MONITORING && this.performanceUpdateInterval) {
      clearInterval(this.performanceUpdateInterval);
      this.performanceUpdateInterval = undefined;
    }

    // **MEMORY LEAK PREVENTION**: Clean up sprite and layer resources
    try {
      if (this.spriteManager) {
        const spriteStats = this.spriteManager.getMemoryStats();
        this.logMessage(
          `Cleaning up ${spriteStats.spriteCount} sprites (${Math.round(spriteStats.currentUsage / 1024)}KB)`
        );
        this.spriteManager.clearAllSprites();
      }

      if (this.layerManager) {
        const layerStats = this.layerManager.getMemoryStats();
        this.logMessage(
          `Cleaning up ${layerStats.layerCount} layers (${Math.round(layerStats.currentUsage / 1024)}KB)`
        );
        this.layerManager.clearAllLayers();
        // Also release renderer layer caches
        this.plotWindowIntegrator
          .releaseAllLayersInRenderer()
          .catch((err) => this.logMessage(`Failed to release renderer layer caches: ${err}`));
      }

      // Clear any deferred operations to prevent memory leaks
      if (this.plotWindowIntegrator) {
        this.plotWindowIntegrator.clearDeferredOperations();
      }

      // Suggest garbage collection after cleanup
      if (this.spriteManager) {
        this.spriteManager.suggestGarbageCollection();
      }
      if (this.layerManager) {
        this.layerManager.suggestGarbageCollection();
      }

      this.logMessage('PLOT window memory cleanup completed');
    } catch (cleanupError) {
      console.error('Error during PLOT window cleanup:', cleanupError);
      this.logMessage(`Warning: Cleanup error - ${cleanupError}`);
    }

    // Don't try to clear canvas - just close the window
    // The canvas clearing was causing the window to appear cleared but not close

    // Now let the base class do its cleanup by setting debugWindow to null
    // The base class setter will handle closing the actual window
    this.debugWindow = null;
  }

  /**
   * Override to handle CLEAR command - clears the plot display
   */
  protected clearDisplayContent(): void {
    // Safety check: ensure window exists and is not destroyed
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      this.logMessage('WARNING: Cannot clear - window not available');
      return;
    }

    // Safety check: ensure webContents exists and is not destroyed
    if (!this.debugWindow.webContents || this.debugWindow.webContents.isDestroyed()) {
      this.logMessage('WARNING: Cannot clear - webContents not available');
      return;
    }

    // Safety check: ensure canvas is initialized
    if (!this.canvasInitialized) {
      this.logMessage('WARNING: Cannot clear - canvas not yet initialized');
      return;
    }

    this.logMessage(`Clearing PLOT display (updateMode: ${this.updateMode})`);

    // Clear the layers first (synchronous operation)
    if (this.layerManager) {
      this.layerManager.clearAllLayers();
      // Also release renderer layer caches
      this.plotWindowIntegrator
        .releaseAllLayersInRenderer()
        .catch((err) => this.logMessage(`Failed to release renderer layer caches: ${err}`));
    }

    // CRITICAL: Clear the correct buffer based on update mode
    // In buffered mode (updateMode=true), clear the offscreen buffer only
    // The display will update on next flip
    // In live mode (updateMode=false), clear the visible canvas
    const jsCode = `
      (() => {
        try {
          const isBuffered = ${this.updateMode};

          if (isBuffered) {
            // In buffered mode, only clear the offscreen buffer
            // The display will show the cleared buffer after next UPDATE
            if (window.plotCtx) {
              window.plotCtx.fillStyle = window.backgroundColor || '${this.displaySpec.window.background}';
              window.plotCtx.fillRect(0, 0, window.plotCtx.canvas.width, window.plotCtx.canvas.height);
            }

            return 'cleared offscreen buffer';
          } else {
            // In live mode, clear the visible canvas
            const ctx = window.plotCtx; // Points to visible canvas in live mode
            if (!ctx) {
              return 'no context';
            }

            ctx.fillStyle = window.backgroundColor || '${this.displaySpec.window.background}';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            return 'cleared';
          }
        } catch (e) {
          return 'error: ' + e.message;
        }
      })()
    `;

    // Execute asynchronously but don't wait (fire and forget)
    // This prevents blocking the message processing loop
    this.debugWindow.webContents
      .executeJavaScript(jsCode)
      .then((result) => {
        if (result !== 'cleared') {
          this.logMessage(`Clear result: ${result}`);
        }
      })
      .catch((error) => {
        this.logMessage(`Failed to clear plot: ${error}`);
      });

    // Reset cursor position after clear
    this.cursorPosition = { x: 0, y: 0 };
  }

  /**
   * Override to handle UPDATE command - forces display update in buffered mode
   */
  protected forceDisplayUpdate(): void {
    // Safety check: ensure window exists and is not destroyed
    if (!this.debugWindow || this.debugWindow.isDestroyed()) {
      this.logMessage('WARNING: Cannot update - window not available');
      return;
    }

    // Safety check: ensure webContents exists and is not destroyed
    if (!this.debugWindow.webContents || this.debugWindow.webContents.isDestroyed()) {
      this.logMessage('WARNING: Cannot update - webContents not available');
      return;
    }

    // Safety check: ensure canvas is initialized
    if (!this.canvasInitialized) {
      this.logMessage('WARNING: Cannot update - canvas not yet initialized');
      return;
    }

    this.logMessage('Forcing PLOT display update');

    // Perform the update regardless of buffering mode
    // performUpdate is async, but we don't wait for it to complete
    // to avoid blocking the message processing loop
    this.performUpdate().catch((error) => {
      this.logMessage(`Failed to force update: ${error}`);
    });
  }

  protected async processMessageImmediate(lineParts: string[]): Promise<void> {
    // For LUT commands, we need synchronous execution to match Pascal behavior
    // Window name was already stripped by mainWindow routing
    const commandString = lineParts.join(' ');

    // Check if this is a LUT command that needs synchronous processing
    const firstToken = lineParts[0]?.toUpperCase();
    // Also check if any part contains LUTCOLORS (could be in compound)
    const hasLutColors = commandString.toUpperCase().includes('LUTCOLORS');
    if (firstToken === 'LUT' || firstToken === 'LUTCOLORS' || hasLutColors) {
      // Process LUT commands synchronously
      this.processLutCommandSync(commandString);
    } else {
      // Handle other commands asynchronously - AWAIT to maintain message ordering
      // CRITICAL: LAYER commands must complete before subsequent CROP/UPDATE commands
      await this.processMessageAsync(lineParts);
    }
  }

  private processLutCommandSync(commandString: string): void {
    try {
      // Use simple parser for LUT commands
      const lineParts = commandString.split(' ').filter(part => part.length > 0);

      // Process the LUT command directly
      for (let index = 0; index < lineParts.length; index++) {
        const command = lineParts[index].toUpperCase();

        if (command === 'LUT') {
          // LUT index color
          if (index + 2 < lineParts.length) {
            const lutIndex = this.parseNumber(lineParts[++index]);
            const color = lineParts[++index];

            if (lutIndex !== null && lutIndex >= 0 && lutIndex <= 255) {
              this.processLutCommand(lutIndex, lutIndex, color);
            }
          }
        } else if (command === 'LUTCOLORS') {
          // LUTCOLORS color0 color1 ... color7
          const colors = [];
          for (let i = 0; i < 8 && index + 1 < lineParts.length; i++) {
            colors.push(lineParts[++index]);
          }
          if (colors.length > 0) {
            this.processLutColorsCommand(colors);
          }
        }
      }
    } catch (error) {
      this.logMessage(`Error processing LUT command: ${error}`);
    }
  }

  private async processMessageAsync(lineParts: string[]): Promise<void> {
    // First, let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    // Window name was already stripped by mainWindow routing
    if (await this.handleCommonCommand(lineParts)) {
      this.logMessage(`Base class handled common command: ${lineParts[0]}`);
      return; // Base class handled it
    }

    // Build command string for logging
    const commandString = lineParts.join(' ');
    this.logMessage(`---- PLOT parsing: ${commandString}`);

    try {
      // Start performance monitoring (if enabled)
      if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor) {
        this.performanceMonitor.commandStart();
      }

      // Simple token-by-token parser (like Term/Scope windows)
      await this.parseSimpleCommands(lineParts);

      // End performance monitoring (if enabled)
      if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor) {
        this.performanceMonitor.commandEnd();
      }
    } catch (error) {
      this.logMessage(`PARSER ERROR: Failed to process command '${commandString}': ${error}`);
      // End performance monitoring even in error case (if enabled)
      if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor) {
        this.performanceMonitor.commandEnd();
      }
    }
  }

  /**
   * Simple token-by-token parser for PLOT commands
   * Replaces the complex parser with a straightforward approach like Term/Scope windows
   */
  private async parseSimpleCommands(lineParts: string[]): Promise<void> {
    for (let index = 0; index < lineParts.length; index++) {
      let command = lineParts[index];

      // Skip empty parts
      if (!command) continue;

      // Handle quoted strings
      if (command.startsWith("'")) {
        // This is a string literal, not a command
        continue;
      }

      // Convert to uppercase for command matching
      const upperCommand = command.toUpperCase();

      // Check if this is a color command
      const isColorCommand = this.isColorCommand(upperCommand);
      if (isColorCommand) {
        // Handle color command (ORANGE, CYAN, WHITE, etc.)
        let brightness = 8; // Default to full saturated color (not pale)

        // Check if next token is a brightness value
        let nextIndex = index + 1;
        if (nextIndex < lineParts.length) {
          const nextToken = lineParts[nextIndex];
          const brightnessValue = this.parseNumber(nextToken);
          if (brightnessValue !== null && brightnessValue >= 0 && brightnessValue <= 15) {
            brightness = brightnessValue;
            index++; // Consume the brightness token
            nextIndex++; // Update next token position
          }
        }

        // Pascal: if TEXT is next, set text color; otherwise leave it unchanged
        // Check if TEXT command follows this color command
        const nextCommand = nextIndex < lineParts.length ? lineParts[nextIndex].toUpperCase() : '';
        const textFollows = nextCommand === 'TEXT';

        // Apply the color
        this.setPlotColor(upperCommand, brightness, textFollows);
        continue;
      }

      // Parse commands
      switch(upperCommand) {
        case 'SET': {
          // SET x , y - Set cursor position (commas optional)
          // Values are in 8.8 fixed-point format (value * 256)
          if (index + 1 < lineParts.length) {
            const xFixed = this.parseNumber(lineParts[++index]);
            index = this.skipComma(lineParts, index); // Skip optional comma
            if (index + 1 < lineParts.length) {
              const yFixed = this.parseNumber(lineParts[++index]);
              if (xFixed !== null && yFixed !== null) {
                const coordinateScale = this.isPrecise ? 256 : 1;
                const x = xFixed / coordinateScale;
                const y = yFixed / coordinateScale;
                this.setCursorPosition(x, y);
              }
            }
          }
          break;
        }

        case 'COLOR': {
          // COLOR value - Set drawing color using numeric pixel value
          // Value is interpreted according to current color mode (RGBI8, RGB24, etc.)
          if (index + 1 < lineParts.length) {
            const colorValue = this.parseNumber(lineParts[++index]);
            if (colorValue !== null) {
              // Use ColorTranslator to convert pixel value to RGB24
              const rgb24 = this.colorTranslator.translateColor(colorValue);

              // Convert RGB24 (0xRRGGBB) to CSS color string '#RRGGBB'
              this.currFgColor = '#' + rgb24.toString(16).padStart(6, '0').toUpperCase();

              this.logMessage(`COLOR: Set color to value ${colorValue} -> ${this.currFgColor}`);
            }
          }
          break;
        }

        case 'DOT': {
          // DOT [lineSize [opacity]]
          let lineSize = this.lineSize;  // Use persistent line size as default
          let opacity = 255;

          if (index + 1 < lineParts.length) {
            const val = this.parseNumber(lineParts[index + 1]);
            if (val !== null) {
              lineSize = val;
              index++;
            }
          }

          if (index + 1 < lineParts.length) {
            const val = this.parseNumber(lineParts[index + 1]);
            if (val !== null) {
              opacity = val;
              index++;
            }
          }

          // Pascal applies thickness differently in precise mode - use 3 as visual match
          const adjustedDotSize = this.isPrecise ? Math.max(3, lineSize) : lineSize;
          await this.drawDotToPlot(adjustedDotSize, opacity);
          break;
        }

        case 'LINE': {
          // LINE x y [lineSize [opacity]]
          // Values are in 8.8 fixed-point format (value * 256)
          // Capture current cursor position immediately for this line's starting point
          const fromX = this.plotCoordX;
          const fromY = this.plotCoordY;

          if (index + 1 < lineParts.length) {
            const xFixed = this.parseNumber(lineParts[++index]);
            index = this.skipComma(lineParts, index); // Skip optional comma
            const yFixed = (index < lineParts.length) ? this.parseNumber(lineParts[++index]) : null;
            let lineSize = this.lineSize;  // Use persistent line size as default
            let opacity = 255;

            if (index + 1 < lineParts.length) {
              const val = this.parseNumber(lineParts[index + 1]);
              if (val !== null) {
                lineSize = val;
                index++;
              }
            }

            if (index + 1 < lineParts.length) {
              const val = this.parseNumber(lineParts[index + 1]);
              if (val !== null) {
                opacity = val;
                index++;
              }
            }

            if (xFixed !== null && yFixed !== null) {
              const coordinateScale = this.isPrecise ? 256 : 1;
              const x = xFixed / coordinateScale;
              const y = yFixed / coordinateScale;
              // Pascal applies thickness differently in precise mode - use 3 as visual match
              const adjustedLineSize = this.isPrecise ? Math.max(3, lineSize) : lineSize;
              this.logMessage(`LINE: from (${fromX}, ${fromY}) to (${x}, ${y}) with thickness ${adjustedLineSize}`);
              await this.drawLineToPlotFrom(fromX, fromY, x, y, adjustedLineSize, opacity);
            } else {
              this.logMessage(`LINE: Failed to parse coordinates - xFixed=${xFixed}, yFixed=${yFixed}`);
            }
          }
          break;
        }

        case 'CIRCLE': {
          // CIRCLE diameter [lineSize [opacity]]
          if (index + 1 < lineParts.length) {
            const diameter = this.parseNumber(lineParts[++index]);
            let lineSize = 0; // 0 = filled
            let opacity = 255;

            if (index + 1 < lineParts.length) {
              const val = this.parseNumber(lineParts[index + 1]);
              if (val !== null) {
                lineSize = val;
                index++;
              }
            }

            if (index + 1 < lineParts.length) {
              const val = this.parseNumber(lineParts[index + 1]);
              if (val !== null) {
                opacity = val;
                index++;
              }
            }

            if (diameter !== null) {
              await this.drawCircleToPlot(diameter, lineSize, opacity);
            }
          }
          break;
        }

        case 'BOX': {
          // BOX width height [lineSize [opacity]]
          if (index + 2 < lineParts.length) {
            const width = this.parseNumber(lineParts[++index]);
            const height = this.parseNumber(lineParts[++index]);
            let lineSize = 0; // 0 = filled
            let opacity = 255;

            if (index + 1 < lineParts.length) {
              const val = this.parseNumber(lineParts[index + 1]);
              if (val !== null) {
                lineSize = val;
                index++;
              }
            }

            if (index + 1 < lineParts.length) {
              const val = this.parseNumber(lineParts[index + 1]);
              if (val !== null) {
                opacity = val;
                index++;
              }
            }

            if (width !== null && height !== null) {
              await this.drawBoxToPlot(width, height, lineSize, opacity);
            }
          }
          break;
        }

        case 'OVAL': {
          // OVAL width height [lineSize [opacity]]
          if (index + 2 < lineParts.length) {
            const width = this.parseNumber(lineParts[++index]);
            const height = this.parseNumber(lineParts[++index]);
            let lineSize = 0; // 0 = filled
            let opacity = 255;

            if (index + 1 < lineParts.length) {
              const val = this.parseNumber(lineParts[index + 1]);
              if (val !== null) {
                lineSize = val;
                index++;
              }
            }

            if (index + 1 < lineParts.length) {
              const val = this.parseNumber(lineParts[index + 1]);
              if (val !== null) {
                opacity = val;
                index++;
              }
            }

            if (width !== null && height !== null) {
              await this.drawOvalToPlot(width, height, lineSize, opacity);
            }
          }
          break;
        }

        case 'TEXT': {
          // TEXT [size [style [angle]]] 'string'
          let textSize = 10;
          let textStyleValue = 1;
          let textAngle = 0;
          let text = '';

          // Capture current cursor position and color immediately for this text command
          const textX = this.plotCoordX;
          const textY = this.plotCoordY;
          // Pascal: Color commands check if TEXT follows and update vTextColor accordingly
          // TEXT always uses vTextColor (set by color lookahead or remains white)
          const textColor = this.currTextColor;
          const savedFont: FontMetrics = { ...this.font };
          const savedTextStyle: TextStyle = { ...this.textStyle };
          const workingFont: FontMetrics = { ...this.font };
          const workingTextStyle: TextStyle = { ...this.textStyle };

          // Look for optional numeric parameters
          let paramIndex = index + 1;

          // Check for size
          if (paramIndex < lineParts.length) {
            const val = this.parseNumber(lineParts[paramIndex]);
            if (val !== null && val >= 1 && val <= 100) {
              textSize = val;
              paramIndex++;
            }
          }

          // Check for style
          if (paramIndex < lineParts.length) {
            const val = this.parseNumber(lineParts[paramIndex]);
            if (val !== null && val >= 0 && val <= 255) {
              textStyleValue = val;
              paramIndex++;
            }
          }

          // Check for angle
          if (paramIndex < lineParts.length) {
            const val = this.parseNumber(lineParts[paramIndex]);
            if (val !== null) {
              textAngle = val % 360;
              if (textAngle < 0) textAngle += 360;
              paramIndex++;
            }
          }

          // Look for the text string
          if (paramIndex < lineParts.length) {
            const textPart = lineParts[paramIndex];
            if (textPart.startsWith("'")) {
              // Extract the text, handling multi-part strings
              if (textPart.endsWith("'") && textPart.length > 1) {
                // Single-part string
                text = textPart.substring(1, textPart.length - 1);
                index = paramIndex;
              } else {
                // Multi-part string
                const stringParts = [textPart.substring(1)];
                let searchIndex = paramIndex + 1;
                while (searchIndex < lineParts.length) {
                  const part = lineParts[searchIndex];
                  if (part.endsWith("'")) {
                    stringParts.push(part.substring(0, part.length - 1));
                    break;
                  } else {
                    stringParts.push(part);
                  }
                  searchIndex++;
                }
                text = stringParts.join(' ');
                index = searchIndex;
              }
            }
          }

          if (text) {
            this.setFontMetrics(textSize, textStyleValue, textAngle, workingFont, workingTextStyle);

            if (this.updateMode) {
              const operation: PlotCanvasOperation = {
                type: CanvasOperationType.DRAW_TEXT,
                parameters: {
                  text,
                  size: textSize,
                  style: textStyleValue,
                  angle: textAngle,
                  color: textColor,
                  x: textX,
                  y: textY,
                  fontMetrics: { ...workingFont },
                  textStyle: { ...workingTextStyle }
                },
                affectsState: false,
                requiresUpdate: true,
                deferrable: true
              };
              this.pendingOperations.push(operation);
              this.logMessage(
                `TEXT buffered (update mode): "${text}" at (${textX}, ${textY}) size=${textSize} angle=${textAngle}`
              );
            } else {
              // Immediate mode - render text now using per-command metrics
              this.font = workingFont;
              this.textStyle = workingTextStyle;
              await this.writeStringToPlotAt(text, textX, textY, textColor);
              this.font = savedFont;
              this.textStyle = savedTextStyle;
            }
          }
          break;
        }

        case 'TEXTSIZE': {
          // TEXTSIZE size
          if (index + 1 < lineParts.length) {
            const size = this.parseNumber(lineParts[++index]);
            if (size !== null && size >= 1 && size <= 100) {
              this.font.textSizePts = size;
              this.font.charHeight = Math.round(size * 1.33); // Convert points to pixels
            }
          }
          break;
        }

        case 'TEXTSTYLE': {
          // TEXTSTYLE style
          if (index + 1 < lineParts.length) {
            const style = this.parseNumber(lineParts[++index]);
            if (style !== null && style >= 0 && style <= 255) {
              // bit 0 = bold, bit 1 = italic, bit 2 = underline
              this.textStyle.weight = (style & 1) !== 0 ? eTextWeight.TW_BOLD : eTextWeight.TW_NORMAL;
              this.textStyle.italic = (style & 2) !== 0;
              this.textStyle.underline = (style & 4) !== 0;
            }
          }
          break;
        }

        case 'LINESIZE': {
          // LINESIZE size - Set persistent line size for LINE commands
          if (index + 1 < lineParts.length) {
            const size = this.parseNumber(lineParts[++index]);
            if (size !== null && size >= 0 && size <= 32) {
              this.lineSize = size;
              this.logMessage(`Set persistent line size to ${size}`);
            }
          }
          break;
        }

        case 'ORIGIN': {
          // ORIGIN x y
          if (index + 2 < lineParts.length) {
            const x = this.parseNumber(lineParts[++index]);
            const y = this.parseNumber(lineParts[++index]);
            if (x !== null && y !== null) {
              this.origin.x = x;
              this.origin.y = y;
            }
          }
          break;
        }

        case 'CARTESIAN': {
          // CARTESIAN {flipy {flipx}} [PRECISE] - Match Pascal behavior
          this.isCartesian = true;
          this.isPrecise = false;

          // Optional flip parameters (0 = false, non-zero = true)
          let nextIndex = index + 1;
          if (nextIndex < lineParts.length) {
            const nextToken = lineParts[nextIndex].toUpperCase();

            if (nextToken !== 'PRECISE') {
              const flipYValue = this.parseNumber(lineParts[nextIndex]);
              if (flipYValue !== null) {
                this.cartesianConfig.ydir = flipYValue !== 0;
                index = nextIndex;
                nextIndex = this.skipComma(lineParts, index) + 1;
              }

              if (nextIndex < lineParts.length) {
                const flipXToken = lineParts[nextIndex].toUpperCase();
                if (flipXToken !== 'PRECISE') {
                  const flipXValue = this.parseNumber(lineParts[nextIndex]);
                  if (flipXValue !== null) {
                    this.cartesianConfig.xdir = flipXValue !== 0;
                    index = nextIndex;
                    nextIndex = this.skipComma(lineParts, index) + 1;
                  }
                }
              }
            }
          }

          if (index + 1 < lineParts.length && lineParts[index + 1].toUpperCase() === 'PRECISE') {
            this.isPrecise = true;
            index++;
          }

          break;
        }

        case 'POLAR': {
          // POLAR [twopi [theta]] - Set polar coordinate mode (matching Pascal)
          this.isCartesian = false;

          // Optional first parameter: twopi
          if (index + 1 < lineParts.length) {
            const twopi = this.parseNumber(lineParts[index + 1]);
            if (twopi !== null) {
              // Match Pascal's special handling
              if (twopi === -1) {
                this.polarConfig.twopi = -0x100000000;
              } else if (twopi === 0) {
                this.polarConfig.twopi = 0x100000000;
              } else {
                this.polarConfig.twopi = twopi;
              }
              index++;

              // Optional second parameter: theta (angle offset)
              if (index + 1 < lineParts.length) {
                const theta = this.parseNumber(lineParts[index + 1]);
                if (theta !== null) {
                  this.polarConfig.theta = theta;
                  index++;
                }
              }
            }
          }

          this.logMessage(`POLAR mode set: twopi=${this.polarConfig.twopi}, theta=${this.polarConfig.theta}`);
          break;
        }

        case 'SPRITEDEF': {
          // SPRITEDEF id width height pixels... colors...
          if (index + 3 < lineParts.length) {
            const spriteId = this.parseNumber(lineParts[++index]);
            const width = this.parseNumber(lineParts[++index]);
            const height = this.parseNumber(lineParts[++index]);

            if (spriteId !== null && width !== null && height !== null) {
              const pixelCount = width * height;
              const pixels: number[] = [];
              const colors: number[] = [];

              // Read pixel indices
              for (let i = 0; i < pixelCount && index + 1 < lineParts.length; i++) {
                const pixel = this.parseNumber(lineParts[++index]);
                if (pixel !== null) {
                  pixels.push(pixel);
                }
              }

              // Read up to 256 color palette entries (Pascal: reads until no more tokens)
              for (let i = 0; i < 256 && index + 1 < lineParts.length; i++) {
                const color = this.parseNumber(lineParts[++index]);
                if (color !== null) {
                  colors.push(color);
                }
              }

              // Track how many colors were provided
              const providedColors = colors.length;

              // Pad colors array to 256 entries (Pascal behavior: uninitialized entries remain)
              while (colors.length < 256) {
                colors.push(0); // Fill remaining with transparent black
              }

              // Validate we have the right amount of pixel data
              if (pixels.length === pixelCount) {
                this.spriteManager.defineSprite(spriteId, width, height, pixels, colors);
                this.logMessage(`SPRITEDEF: Defined sprite ${spriteId} (${width}x${height}) with ${providedColors} colors`);
              } else {
                this.logMessage(`SPRITEDEF ERROR: Expected ${pixelCount} pixels, got ${pixels.length} pixels`);
              }
            }
          }
          break;
        }

        case 'SPRITE': {
          // SPRITE id , orientation , scale , opacity (commas optional)
          // Current cursor position is where the sprite will be drawn
          if (index + 1 < lineParts.length) {
            const spriteId = this.parseNumber(lineParts[++index]);
            index = this.skipComma(lineParts, index);
            let orientation = 0;
            let scale = 1;
            let opacity = this.opacity; // Use current opacity as default

            // Optional orientation (0-7)
            index = this.skipComma(lineParts, index);
            if (index + 1 < lineParts.length) {
              const orientVal = this.parseNumber(lineParts[index + 1]);
              if (orientVal !== null && orientVal >= 0 && orientVal <= 7) {
                orientation = orientVal;
                index++;
                index = this.skipComma(lineParts, index);

                // Optional scale (1-64)
                if (index + 1 < lineParts.length) {
                  const scaleVal = this.parseNumber(lineParts[index + 1]);
                  if (scaleVal !== null && scaleVal >= 1 && scaleVal <= 64) {
                    scale = scaleVal;
                    index++;
                    index = this.skipComma(lineParts, index);

                    // Optional opacity (0-255)
                    if (index + 1 < lineParts.length) {
                      const opacityVal = this.parseNumber(lineParts[index + 1]);
                      if (opacityVal !== null && opacityVal >= 0 && opacityVal <= 255) {
                        opacity = opacityVal;
                        index++;
                      }
                    }
                  }
                }
              }
            }

            if (spriteId !== null) {
              // Draw sprite at current cursor position
              await this.drawSpriteToPlot(spriteId, orientation, scale, opacity);
            }
          }
          break;
        }

        case 'LAYER': {
          // LAYER layer 'filename.bmp'
          // Load a bitmap file into the specified layer (1-based index)
          if (index + 2 < lineParts.length) {
            const layerIndex = this.parseNumber(lineParts[++index]);
            const filename = DebugPlotWindow.removeQuotes(lineParts[++index]);

            if (layerIndex !== null && layerIndex >= 1 && layerIndex <= 16) {
              // Validate .bmp extension
              if (filename.toLowerCase().endsWith('.bmp')) {
                try {
                  // Use integrator to load layer AND cache in renderer
                  // LAYER must execute immediately (not deferred) so it's ready for subsequent CROP
                  const operation: PlotCanvasOperation = {
                    type: CanvasOperationType.LOAD_LAYER,
                    parameters: {
                      layerIndex: layerIndex, // Use 1-based index
                      filename: filename
                    },
                    affectsState: false,
                    requiresUpdate: false,
                    deferrable: false // CRITICAL: Execute immediately, needed before CROP
                  };

                  // Execute LAYER immediately via integrator (loads + caches in renderer)
                  const result = await this.plotWindowIntegrator.executeOperation(operation);
                  if (result.success) {
                    this.logMessage(`LAYER: Loaded layer ${layerIndex} from "${filename}" and cached in renderer`);
                  } else {
                    this.logMessage(`LAYER ERROR: ${result.errors.join(', ')}`);
                  }
                } catch (error) {
                  this.logMessage(`LAYER ERROR: Failed to load "${filename}": ${error}`);
                }
              } else {
                this.logMessage(`LAYER ERROR: File must have .bmp extension: "${filename}"`);
              }
            } else {
              this.logMessage(`LAYER ERROR: Layer index must be 1-16, got ${layerIndex}`);
            }
          }
          break;
        }

        case 'CROP': {
          // CROP layer                                  - Copy entire layer to (0,0)
          // CROP layer AUTO x y                         - Copy entire layer to (x,y)
          // CROP layer left top width height [x y]      - Copy specific region
          if (index + 1 < lineParts.length) {
            const layerIndex = this.parseNumber(lineParts[++index]);

            if (layerIndex !== null && layerIndex >= 1 && layerIndex <= 16) {
              // Do NOT check if layer is loaded at parse time
              // Layer loading is async, check happens at execution time in integrator

              // Default values - integrator will fill in actual dimensions at execution time
              let srcLeft = 0;
              let srcTop = 0;
              let srcWidth = 0; // Will be filled by integrator for DEFAULT/AUTO modes
              let srcHeight = 0; // Will be filled by integrator for DEFAULT/AUTO modes
              let destX = 0;
              let destY = 0;

              // Check for AUTO mode
              index = this.skipComma(lineParts, index);
              if (index + 1 < lineParts.length && lineParts[index + 1].toUpperCase() === 'AUTO') {
                // CROP layer AUTO x y
                index++; // skip AUTO
                index = this.skipComma(lineParts, index);
                if (index + 1 < lineParts.length) {
                  const x = this.parseNumber(lineParts[++index]);
                  index = this.skipComma(lineParts, index);
                  if (index + 1 < lineParts.length) {
                    const y = this.parseNumber(lineParts[++index]);
                    if (x !== null && y !== null) {
                      destX = x;
                      destY = y;
                    }
                  }
                }
              }
              // Check for explicit coordinates
              else if (index + 1 < lineParts.length) {
                const left = this.parseNumber(lineParts[index + 1]);
                if (left !== null) {
                  // We have explicit coordinates
                  index++;
                  index = this.skipComma(lineParts, index);

                  if (index + 1 < lineParts.length) {
                    const top = this.parseNumber(lineParts[++index]);
                    index = this.skipComma(lineParts, index);

                    if (index + 1 < lineParts.length) {
                      const width = this.parseNumber(lineParts[++index]);
                      index = this.skipComma(lineParts, index);

                      if (index + 1 < lineParts.length) {
                        const height = this.parseNumber(lineParts[++index]);

                        if (top !== null && width !== null && height !== null) {
                          srcLeft = left;
                          srcTop = top;
                          srcWidth = width;
                          srcHeight = height;
                          // Default destination is same as source
                          destX = left;
                          destY = top;

                          // Optional destination coordinates
                          index = this.skipComma(lineParts, index);
                          if (index + 1 < lineParts.length) {
                            const x = this.parseNumber(lineParts[index + 1]);
                            if (x !== null) {
                              index++;
                              index = this.skipComma(lineParts, index);
                              if (index + 1 < lineParts.length) {
                                const y = this.parseNumber(lineParts[++index]);
                                if (y !== null) {
                                  destX = x;
                                  destY = y;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }

              // Queue CROP operation for deferred execution (matches old working behavior)
              // Determine mode based on what parameters were parsed
              let mode: 'DEFAULT' | 'AUTO' | 'EXPLICIT' = 'DEFAULT';
              if (lineParts.some((part, i) => i > 0 && part.toUpperCase() === 'AUTO')) {
                mode = 'AUTO';
              } else if (srcWidth > 0 && srcHeight > 0) {
                // If we parsed explicit dimensions, it's EXPLICIT mode
                mode = 'EXPLICIT';
              }

              const operation: PlotCanvasOperation = {
                type: CanvasOperationType.CROP_LAYER,
                parameters: {
                  layerIndex: layerIndex, // Use 1-based index (integrator converts to 0-based)
                  mode: mode,
                  left: srcLeft,
                  top: srcTop,
                  width: srcWidth,
                  height: srcHeight,
                  destX: destX,
                  destY: destY
                },
                affectsState: false, // CROP doesn't change parser state
                requiresUpdate: false, // Will be handled by UPDATE command
                deferrable: true // CRITICAL: Must defer for batch execution
              };

              this.pendingOperations.push(operation);
              this.logMessage(`CROP: Queued ${mode} operation for layer ${layerIndex} - will execute on UPDATE`);
            } else {
              this.logMessage(`CROP ERROR: Layer index must be 1-16, got ${layerIndex}`);
            }
          }
          break;
        }

        case 'LUT': {
          // LUT index color
          if (index + 2 < lineParts.length) {
            const lutIndex = this.parseNumber(lineParts[++index]);
            const color = lineParts[++index];

            if (lutIndex !== null && lutIndex >= 0 && lutIndex <= 255) {
              this.processLutCommand(lutIndex, lutIndex, color);
            }
          }
          break;
        }

        case 'LUTCOLORS': {
          // LUTCOLORS color0 color1 ... color7
          const colors = [];
          for (let i = 0; i < 8 && index + 1 < lineParts.length; i++) {
            colors.push(lineParts[++index]);
          }
          if (colors.length > 0) {
            this.processLutColorsCommand(colors);
          }
          break;
        }

        // These commands are handled by base class but included for completeness
        case 'UPDATE':
          this.performUpdate();
          break;

        case 'CLEAR':
          // Base class handles this
          break;

        case 'CLOSE':
          // Base class handles this
          break;

        default:
          // Check if it's a number (could be direct pixel data or other numeric command)
          const numValue = this.parseNumber(command);
          if (numValue !== null) {
            // Handle numeric commands if needed
            // For now, just ignore numeric values
          } else {
            // Log unrecognized commands for debugging
            this.logMessage(`PLOT: Unrecognized command '${command}'`);
          }
          break;
      }
    }

    // If not in delayed update mode, perform update after processing all commands
    if (!this.displaySpec.delayedUpdate) {
      this.performUpdate();
    }
  }

  /**
   * Check if a token is a color command
   */
  private isColorCommand(token: string): boolean {
    const colorCommands = [
      'BLACK', 'WHITE', 'ORANGE', 'BLUE', 'GREEN', 'CYAN',
      'RED', 'MAGENTA', 'YELLOW', 'GRAY', 'GREY',
      'OLIVE', 'LIME', 'BLUE2', 'GRAY2', 'GRAY3'
    ];
    return colorCommands.includes(token);
  }

  /**
   * Parse a number from a string token, handling Spin2 formats
   * Delegates to shared Spin2NumericParser for consistent parsing across all windows
  */
  private parseNumber(token: string): number | null {
    if (!token) {
      return null;
    }

    // Pascal accepts optional commas immediately following numeric literals (e.g., 40_960,)
    // Trim trailing commas so Spin2NumericParser receives a clean token.
    const sanitizedToken = token.replace(/,+$/g, '');

    return Spin2NumericParser.parseValue(sanitizedToken);
  }

  /**
   * Skip comma tokens and return next index
   * Spin2 allows optional commas between parameters
   */
  private skipComma(lineParts: string[], index: number): number {
    if (index + 1 < lineParts.length && lineParts[index + 1] === ',') {
      return index + 1; // Skip the comma
    }
    return index;
  }

  /**
   * Set the current drawing color
   * Pascal: Sets vPlotColor always; vTextColor only if TEXT immediately follows
   */
  private setPlotColor(colorName: string, brightness: number = 8, textFollows: boolean = false): void {
    const color = new DebugColor(colorName, brightness);
    this.currFgColor = color.rgbString;

    // Pascal: if TEXT is next command, set text color to this color
    // Otherwise, text color remains unchanged (stays white/default)
    if (textFollows) {
      this.currTextColor = color.rgbString;
      this.logMessage(`Set color to ${colorName} brightness ${brightness}: ${color.rgbString} (TEXT follows - updating text color)`);
    } else {
      this.logMessage(`Set color to ${colorName} brightness ${brightness}: ${color.rgbString}`);
    }
  }

  /**
   * Set cursor position
   */
  private setCursorPosition(x: number, y: number): void {
    // Store raw values like Pascal does
    this.vPixelX = x;
    this.vPixelY = y;

    // Update public cursor position for external access (used by sprite renderer)
    this.cursorPosition = { x, y };

    // Convert based on coordinate mode
    if (this.isCartesian) {
      // Apply origin offset for Cartesian mode
      this.plotCoordX = x + this.origin.x;
      this.plotCoordY = y + this.origin.y;
    } else {
      // Polar mode: x=radius (rho), y=angle (theta)
      // Match Pascal's PolarToCartesian exactly:
      // Tf := (Int64(theta_y) + Int64(vTheta)) / vTwoPi * Pi * 2;
      const angleRad = ((y + this.polarConfig.theta) / this.polarConfig.twopi) * Math.PI * 2;

      // Pascal: SinCos(Tf, Yf, Xf); theta_y := Round(Yf * rho_x); rho_x := Round(Xf * rho_x);
      const newX = Math.round(x * Math.cos(angleRad));
      const newY = Math.round(x * Math.sin(angleRad));

      this.plotCoordX = this.origin.x + newX;
      this.plotCoordY = this.origin.y + newY;
    }

    this.logMessage(`SET cursor to (${x}, ${y}) -> plot coords (${this.plotCoordX}, ${this.plotCoordY})`);
  }

  /**
   * Process LUT command
   */
  private processLutCommand(startIndex: number, endIndex: number, colorSpec: string): void {
    // Parse color specification
    let rgbValue = 0;
    if (colorSpec.startsWith('$')) {
      rgbValue = parseInt(colorSpec.substring(1), 16);
    } else if (colorSpec.startsWith('#')) {
      rgbValue = parseInt(colorSpec.substring(1), 16);
    } else if (DebugColor.isValidColorName(colorSpec)) {
      const color = new DebugColor(colorSpec, 8);
      rgbValue = color.rgbValue;
    } else {
      rgbValue = parseInt(colorSpec, 10);
    }

    // Update LUT palette
    for (let i = startIndex; i <= endIndex && i < 256; i++) {
      this.lutManager.setColor(i, rgbValue);
    }

    // Update color translator palette
    this.colorTranslator.setLutPalette(this.lutManager.getPalette());

    this.logMessage(`LUT set indices ${startIndex}-${endIndex} to color 0x${rgbValue.toString(16)}`);
  }

  /**
   * Process LUTCOLORS command
   */
  private processLutColorsCommand(colors: string[]): void {
    colors.forEach((colorSpec, index) => {
      if (index < 8) { // Only first 8 colors
        this.processLutCommand(index, index, colorSpec);
      }
    });
  }

  /**
   * Draw a box on the plot
   */
  private async drawBoxToPlot(width: number, height: number, lineSize: number, opacity: number): Promise<void> {
    const debugWindow = this.debugWindow;
    if (!debugWindow) return;

    let [xc, yc] = this.getCursorXY();

    // Apply ydir transformation for canvas coordinates
    if (!this.cartesianConfig.ydir) {
      yc = this.displaySpec.size.height - yc;
    }

    // Pascal centers the box on cursor position (DebugDisplayUnit.pas:3613-3616)
    // xl := xc - xs shr 1;        // left = centerX - width/2
    // xr := xc + (xs - xs shr 1); // right = centerX + (width - width/2)
    // yt := yc - ys shr 1;        // top = centerY - height/2
    // yb := yc + (ys - ys shr 1); // bottom = centerY + height/2
    const xl = xc - Math.floor(width / 2);
    const yt = yc - Math.floor(height / 2);

    const filled = lineSize === 0;

    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        window.plotCtx.globalAlpha = ${opacity / 255};

        if (${filled}) {
          window.plotCtx.fillStyle = '${this.currFgColor}';
          window.plotCtx.fillRect(${xl}, ${yt}, ${width}, ${height});
        } else {
          window.plotCtx.strokeStyle = '${this.currFgColor}';
          window.plotCtx.lineWidth = ${lineSize};
          window.plotCtx.strokeRect(${xl}, ${yt}, ${width}, ${height});
        }

        window.plotCtx.globalAlpha = 1.0;
        return 'Box drawn';
      })()
    `;

    try {
      await debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to draw box: ${error}`);
    }
  }

  /**
   * Draw an oval on the plot
   */
  private async drawOvalToPlot(width: number, height: number, lineSize: number, opacity: number): Promise<void> {
    const debugWindow = this.debugWindow;
    if (!debugWindow) return;

    let [xc, yc] = this.getCursorXY();

    // Apply ydir transformation for canvas coordinates
    if (!this.cartesianConfig.ydir) {
      yc = this.displaySpec.size.height - yc;
    }

    // Pascal centers the oval on cursor position (DebugDisplayUnit.pas:2032)
    // key_oval: SmoothShape(t1, t2, t3, t4, t3 shr 1, t4 shr 1, ...)
    // where t1,t2 are center coordinates, t3 shr 1 and t4 shr 1 are x and y radii
    // Cursor position IS the center, radii are width/2 and height/2
    const radiusX = width / 2;
    const radiusY = height / 2;
    const filled = lineSize === 0;

    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        window.plotCtx.globalAlpha = ${opacity / 255};

        window.plotCtx.beginPath();
        window.plotCtx.ellipse(${xc}, ${yc}, ${radiusX}, ${radiusY}, 0, 0, 2 * Math.PI);

        if (${filled}) {
          window.plotCtx.fillStyle = '${this.currFgColor}';
          window.plotCtx.fill();
        } else {
          window.plotCtx.strokeStyle = '${this.currFgColor}';
          window.plotCtx.lineWidth = ${lineSize};
          window.plotCtx.stroke();
        }

        window.plotCtx.globalAlpha = 1.0;
        return 'Oval drawn';
      })()
    `;

    try {
      await debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to draw oval: ${error}`);
    }
  }

  /**
   * Draw a dot at the current cursor position
   */
  private async drawDotToPlot(lineSize: number, opacity: number): Promise<void> {
    if (!this.debugWindow) return;

    let [x, y] = this.getCursorXY();

    // Apply ydir transformation for canvas coordinates
    if (!this.cartesianConfig.ydir) {
      y = this.displaySpec.size.height - y;
    }

    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        window.plotCtx.globalAlpha = ${opacity / 255};
        window.plotCtx.fillStyle = '${this.currFgColor}';

        // Draw dot as a small filled rectangle
        const size = ${lineSize};
        const halfSize = Math.floor(size / 2);
        window.plotCtx.fillRect(${x} - halfSize, ${y} - halfSize, size, size);

        window.plotCtx.globalAlpha = 1.0;
        return 'Dot drawn';
      })()
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to draw dot: ${error}`);
    }
  }

  // REMOVED: updatePlotDisplay and pushDisplayListToPlot - no longer needed with single-queue architecture
  // The integrator now directly calls drawing methods

  private clearCount: number = 2;

  public setFontMetrics(size: number, style: number, angle: number, font: FontMetrics, textStyle: TextStyle): void {
    DebugPlotWindow.calcMetricsForFontPtSize(size, font);
    // now configure style and angle
    DebugPlotWindow.calcStyleFromBitfield(style, textStyle);
    textStyle.angle = angle;
  }

  public async clearPlot(): Promise<void> {
    // erase the  display area
    await this.clearPlotCanvas();
    // home the cursorPosition
    this.cursorPosition = { x: 0, y: 0 };
  }

  // -----------------------------------------------------------
  // ----------------- Canvas Drawing Routines -----------------
  //
  private async clearPlotCanvas(): Promise<void> {
    const debugWindow = this.debugWindow;
    if (!debugWindow || !this.shouldWriteToCanvas) return;

    this.logMessage(`at clearPlot()`);
    const bgcolor: string = this.displaySpec.window.background;
    this.logMessage(`  -- bgcolor=[${bgcolor}]`);

    // Execute clearing in the renderer
    const jsCode = `
      (function() {
        if (!window.plotCtx) {
          console.error('[PLOT] Context not ready for clear');
          return 'Context not ready';
        }

        // Fill with background color (no need to clear first - fillRect overwrites)
        window.plotCtx.fillStyle = '${bgcolor}';
        window.plotCtx.fillRect(0, 0, ${this.displaySpec.size.width}, ${this.displaySpec.size.height});

        return 'Canvas cleared';
      })()
    `;

    try {
      const result = await debugWindow.webContents.executeJavaScript(jsCode);
      this.logMessage(`Clear result: ${result}`);
      // In live mode (not updateMode), flip buffer immediately after clear
      if (!this.updateMode) {
        await this.performUpdate();
      }
    } catch (error) {
      this.logMessage(`Failed to clear canvas: ${error}`);
    }
  }

  public async drawLineToPlotFrom(
    fromX: number,
    fromY: number,
    x: number,
    y: number,
    lineSize: number,
    opacity: number,
    forceExecution: boolean = false,
    colorOverride?: string
  ): Promise<void> {
    if (!forceExecution && this.updateMode) {
      this.queueDeferredLine(fromX, fromY, x, y, lineSize, opacity, this.currFgColor);
      return;
    }

    const debugWindow = this.debugWindow;
    if (!debugWindow || !this.shouldWriteToCanvas) return;

    this.logMessage(`at drawLineToPlotFrom(${fromX}, ${fromY} to ${x}, ${y}, ${lineSize}, ${opacity})`);
    const fgColor: string = colorOverride ?? this.currFgColor;

    // Transform the target coordinates if in polar mode
    let targetX = x;
    let targetY = y;
    if (!this.isCartesian) {
      // In polar mode, x=radius (rho), y=angle (theta)
      // Transform to Cartesian coordinates
      const angleRad = ((y + this.polarConfig.theta) / this.polarConfig.twopi) * Math.PI * 2;
      targetX = this.origin.x + Math.round(x * Math.cos(angleRad));
      targetY = this.origin.y + Math.round(x * Math.sin(angleRad));
    } else {
      // In Cartesian mode, apply origin offset
      targetX = x + this.origin.x;
      targetY = y + this.origin.y;
    }

    // Apply ydir transformation for canvas coordinates
    // Pascal: if not vDirY then p.y := ClientHeight - p.y;
    let plotFmCoordX = fromX;
    let plotFmCoordY = fromY;
    let plotToCoordX = targetX;
    let plotToCoordY = targetY;
    if (!this.cartesianConfig.ydir) {
      plotFmCoordY = this.displaySpec.size.height - fromY;
      plotToCoordY = this.displaySpec.size.height - targetY;
    }

    this.logMessage(
      `  -- fm(${plotFmCoordX},${plotFmCoordY}) - to(${plotToCoordX},${plotToCoordY}) color=[${fgColor}]`
    );

    // Execute drawing in the renderer
    const jsCode = `
      (function() {
        if (!window.plotCtx) {
          console.error('[PLOT] Context not ready for line drawing');
          return 'Context not ready';
        }

        // Save current state
        const savedAlpha = window.plotCtx.globalAlpha;

        // Set opacity with gamma correction to match Pascal implementation
        // Pascal uses gamma-corrected blending with power 2.0
        // This makes low opacity values more visible
        const linearOpacity = ${opacity} / 255;
        const gammaCorrectedOpacity = Math.pow(linearOpacity, 1.0 / 2.2); // Apply gamma correction
        window.plotCtx.globalAlpha = gammaCorrectedOpacity;

        // Set line style
        window.plotCtx.strokeStyle = '${fgColor}';
        window.plotCtx.lineWidth = ${lineSize};
        window.plotCtx.lineCap = 'round';
        window.plotCtx.lineJoin = 'round';

        // Draw the line
        window.plotCtx.beginPath();
        window.plotCtx.moveTo(${plotFmCoordX}, ${plotFmCoordY});
        window.plotCtx.lineTo(${plotToCoordX}, ${plotToCoordY});
        window.plotCtx.stroke();

        // Restore alpha
        window.plotCtx.globalAlpha = savedAlpha;

        return 'Line drawn';
      })()
    `;

    try {
      await debugWindow.webContents.executeJavaScript(jsCode);
      // Update cursor position after successful draw
      this.cursorPosition = { x, y };
      this.vPixelX = x;
      this.vPixelY = y;
      this.plotCoordX = targetX;
      this.plotCoordY = targetY;
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw line: ${error}`);
    }
  }

  public async drawLineToPlot(
    x: number,
    y: number,
    lineSize: number,
    opacity: number,
    forceExecution: boolean = false
  ): Promise<void> {
    // Backward compatibility method - uses current cursor position as starting point
    const [fromX, fromY] = this.getCursorXY();
    await this.drawLineToPlotFrom(fromX, fromY, x, y, lineSize, opacity, forceExecution);
  }

  private queueDeferredLine(
    fromX: number,
    fromY: number,
    x: number,
    y: number,
    lineSize: number,
    opacity: number,
    color: string
  ): void {
    const operation: PlotCanvasOperation = {
      type: CanvasOperationType.DRAW_LINE,
      parameters: {
        fromX,
        fromY,
        x,
        y,
        lineSize,
        opacity,
        forceExecution: true,
        color
      },
      affectsState: false,
      requiresUpdate: true,
      deferrable: true
    };

    this.pendingOperations.push(operation);
    this.logMessage(
      `LINE buffered (update mode): from (${fromX}, ${fromY}) to (${x}, ${y}) thickness ${lineSize}, opacity ${opacity}`
    );

    // Mirror immediate mode behavior: update cursor position and cached plot coordinates
    this.cursorPosition = { x, y };
    this.vPixelX = x;
    this.vPixelY = y;

    let targetPlotX = x + this.origin.x;
    let targetPlotY = y + this.origin.y;

    if (!this.isCartesian) {
      const angleRad = ((y + this.polarConfig.theta) / this.polarConfig.twopi) * Math.PI * 2;
      targetPlotX = this.origin.x + Math.round(x * Math.cos(angleRad));
      targetPlotY = this.origin.y + Math.round(x * Math.sin(angleRad));
    }

    this.plotCoordX = targetPlotX;
    this.plotCoordY = targetPlotY;
  }

  private queueDeferredCircle(
    centerX: number,
    centerY: number,
    diameter: number,
    lineSize: number,
    opacity: number,
    color: string,
    filled: boolean
  ): void {
    const operation: PlotCanvasOperation = {
      type: CanvasOperationType.DRAW_CIRCLE,
      parameters: {
        centerX,
        centerY,
        diameter,
        lineSize,
        opacity,
        color,
        filled,
        forceExecution: true
      },
      affectsState: false,
      requiresUpdate: true,
      deferrable: true
    };

    this.pendingOperations.push(operation);
    this.logMessage(
      `CIRCLE buffered (update mode): center (${centerX}, ${centerY}) diameter=${diameter} lineSize=${lineSize} opacity=${opacity}`
    );
  }

  public async drawCircleToPlot(
    diameter: number,
    lineSize: number,
    opacity: number,
    forceExecution: boolean = false,
    override?: { centerX?: number; centerY?: number; color?: string; filled?: boolean }
  ): Promise<void> {
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

    let [plotCoordX, plotCoordY] = this.getCursorXY();
    if (override?.centerX !== undefined && override?.centerY !== undefined) {
      plotCoordX = override.centerX;
      plotCoordY = override.centerY;
    }

    let canvasY = plotCoordY;
    if (!this.cartesianConfig.ydir) {
      canvasY = this.displaySpec.size.height - plotCoordY;
    }

    const fgColor: string = override?.color ?? this.currFgColor;
    const filled = override?.filled ?? lineSize === 0;

    if (!forceExecution && this.updateMode) {
      this.queueDeferredCircle(plotCoordX, plotCoordY, diameter, lineSize, opacity, fgColor, filled);
      return;
    }

    await this.renderCircleAtCanvas(plotCoordX, plotCoordY, diameter, lineSize, opacity, fgColor, filled);
  }

  private async renderCircleAtCanvas(
    plotX: number,
    plotY: number,
    diameter: number,
    lineSize: number,
    opacity: number,
    fgColor: string,
    filled: boolean
  ): Promise<void> {
    const debugWindow = this.debugWindow;
    if (!debugWindow) return;

    let canvasX = plotX;
    let canvasY = plotY;

    if (!this.cartesianConfig.ydir) {
      canvasY = this.displaySpec.size.height - plotY;
    }

    const opacityString: string = opacity == 255 ? 'opaque' : opacity == 0 ? 'clear' : opacity.toString();
    const lineSizeString: string = lineSize == 0 ? 'filled' : lineSize.toString();
    this.logMessage(
      `at drawCircleToPlot(${diameter}, ${lineSizeString}, ${opacityString}) color=[${fgColor}] center @(${canvasX},${canvasY})`
    );
    this.logMessage(`  -- diameter=(${diameter}) color=[${fgColor}]`);

    const jsCode = `
      (function() {
        if (!window.plotCtx) {
          console.error('[PLOT] Context not ready for circle drawing');
          return 'Context not ready';
        }

        // Save current state
        const savedAlpha = window.plotCtx.globalAlpha;

        // Set opacity with gamma correction to match Pascal implementation
        // Pascal uses gamma-corrected blending with power 2.0
        // This makes low opacity values more visible
        const linearOpacity = ${opacity} / 255;
        const gammaCorrectedOpacity = Math.pow(linearOpacity, 1.0 / 2.2); // Apply gamma correction
        window.plotCtx.globalAlpha = gammaCorrectedOpacity;

        // Draw circle
        window.plotCtx.beginPath();
        window.plotCtx.arc(${canvasX}, ${canvasY}, ${diameter / 2}, 0, 2 * Math.PI);

        if (${filled}) {
          window.plotCtx.fillStyle = '${fgColor}';
          window.plotCtx.fill();
        } else {
          window.plotCtx.strokeStyle = '${fgColor}';
          window.plotCtx.lineWidth = ${lineSize};
          window.plotCtx.stroke();
        }

        // Restore alpha
        window.plotCtx.globalAlpha = savedAlpha;

        return 'Circle drawn';
      })()
    `;

    try {
      await debugWindow.webContents.executeJavaScript(jsCode);
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw circle: ${error}`);
    }
  }

  public async drawSpriteToPlot(spriteId: number, orientation: number, scale: number, opacity: number): Promise<void> {
    const debugWindow = this.debugWindow;
    if (!debugWindow || !this.shouldWriteToCanvas) return;

    try {
      // Get sprite definition
      const sprite = this.spriteManager.getSprite(spriteId);
      if (!sprite) {
        this.logMessage(`Sprite ${spriteId} not defined, skipping draw`);
        return;
      }

      // Get current cursor position (set by SET command)
      let [plotX, plotY] = this.getCursorXY();

      // Pascal: Inc(t1, t5 shr 1); Inc(t2, t5 shr 1); - offset by half scale for centering
      plotX += Math.floor(scale / 2);
      plotY += Math.floor(scale / 2);

      this.logMessage(`Drawing sprite ${spriteId} at (${plotX},${plotY}) orientation=${orientation} scale=${scale} opacity=${opacity}`);

      // Convert orientation (0-7) to degrees: 0=0°, 1=90°, 2=180°, 3=270°, 4=90°+flip, etc.
      // Pascal orientations: 0-3 are rotations, 4-7 add horizontal flip
      const orientationDegrees = (orientation & 0x03) * 90; // 0,90,180,270
      const flipHorizontal = (orientation & 0x04) !== 0; // Bit 2 indicates flip

      // Convert sprite data to JSON-safe format for passing to renderer
      const spriteData = {
        width: sprite.width,
        height: sprite.height,
        pixels: sprite.pixels,
        colors: sprite.colors
      };

      // Use tested implementation with Canvas2D transformations (more efficient than per-pixel calculations)
      const jsCode = `
        (function() {
          if (!window.plotCtx) {
            console.error('[PLOT] Context not ready for sprite rendering');
            return 'Context not ready';
          }

          const sprite = ${JSON.stringify(spriteData)};
          const centerX = ${plotX};
          const centerY = ${plotY};
          const orientationDeg = ${orientationDegrees};
          const flipH = ${flipHorizontal};
          const scale = ${scale};
          const opacity = ${opacity};

          // Save current context state
          window.plotCtx.save();

          // Set global alpha for opacity
          window.plotCtx.globalAlpha = opacity / 255;

          // Calculate transformation matrix
          const angleRad = (orientationDeg * Math.PI) / 180;
          const cos = Math.cos(angleRad) * scale;
          const sin = Math.sin(angleRad) * scale;

          // Apply horizontal flip if needed
          const flipScale = flipH ? -1 : 1;

          // Apply transformation matrix for rotation and scaling
          window.plotCtx.setTransform(
            cos * flipScale,  // m11: horizontal scaling / rotation
            sin,              // m12: horizontal skewing
            -sin * flipScale, // m21: vertical skewing
            cos,              // m22: vertical scaling / rotation
            centerX,          // dx: horizontal translation
            centerY           // dy: vertical translation
          );

          // Calculate sprite center offset for proper rotation around center
          const centerOffsetX = -sprite.width / 2;
          const centerOffsetY = -sprite.height / 2;

          // Render each pixel
          for (let y = 0; y < sprite.height; y++) {
            for (let x = 0; x < sprite.width; x++) {
              const pixelIndex = y * sprite.width + x;
              const colorIndex = sprite.pixels[pixelIndex];

              // Get color from palette (ARGB format)
              const color32 = sprite.colors[colorIndex] || 0x00000000;
              const alpha = (color32 >>> 24) & 0xFF;
              const r = (color32 >>> 16) & 0xFF;
              const g = (color32 >>> 8) & 0xFF;
              const b = color32 & 0xFF;

              // Skip fully transparent pixels
              if (alpha === 0) continue;

              // Set pixel color (alpha handled by globalAlpha)
              window.plotCtx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';

              // Draw pixel at transformed position (relative to sprite center)
              window.plotCtx.fillRect(
                centerOffsetX + x,
                centerOffsetY + y,
                1, 1
              );
            }
          }

          // Restore context state
          window.plotCtx.restore();

          return 'Sprite drawn';
        })()
      `;

      await debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to draw sprite: ${error}`);
    }
  }

  /**
   * Draw a layer (or portion of it) to the plot canvas
   * Matches Pascal: Bitmap[0].Canvas.CopyRect(...)
   */
  public async drawLayerToPlot(
    layerIndex: number,
    srcLeft: number,
    srcTop: number,
    srcWidth: number,
    srcHeight: number,
    destX: number,
    destY: number
  ): Promise<void> {
    const debugWindow = this.debugWindow;
    if (!debugWindow || !this.shouldWriteToCanvas) return;

    try {
      // Verify layer is loaded
      if (!this.layerManager.isLayerLoaded(layerIndex)) {
        this.logMessage(`Cannot draw layer ${layerIndex + 1}: not loaded`);
        return;
      }

      // Get the layer from LayerManager
      const layer = this.layerManager.layers[layerIndex];
      if (!layer) {
        this.logMessage(`Cannot draw layer ${layerIndex + 1}: layer object is null`);
        return;
      }

      // Validate bounds
      if (srcLeft < 0 || srcTop < 0 || srcLeft + srcWidth > layer.width || srcTop + srcHeight > layer.height) {
        this.logMessage(`CROP ERROR: Source rectangle out of bounds: (${srcLeft},${srcTop}) ${srcWidth}x${srcHeight} exceeds layer ${layer.width}x${layer.height}`);
        return;
      }

      this.logMessage(`CROP: Drawing layer ${layerIndex + 1} region (${srcLeft},${srcTop}) ${srcWidth}x${srcHeight} to (${destX},${destY})`);
      this.logMessage(`DEBUG: shouldWriteToCanvas=${this.shouldWriteToCanvas}, debugWindow=${!!debugWindow}`);

      // Extract RGBA pixel data from source rectangle
      // EXACT copy of original working implementation from plotParserIntegration.ts
      const pixels: number[] = [];
      this.logMessage(`DEBUG: Starting pixel extraction, layer dimensions: ${layer.width}x${layer.height}`);
      for (let y = srcTop; y < srcTop + srcHeight; y++) {
        for (let x = srcLeft; x < srcLeft + srcWidth; x++) {
          if (x >= 0 && x < layer.width && y >= 0 && y < layer.height) {
            const pixelColor = layer.getPixelColor(x, y);
            // Jimp stores colors as 32-bit integers: RRGGBBAA
            pixels.push((pixelColor >> 24) & 0xFF);  // R
            pixels.push((pixelColor >> 16) & 0xFF);  // G
            pixels.push((pixelColor >> 8) & 0xFF);   // B
            pixels.push(pixelColor & 0xFF);          // A
          } else {
            // Out of bounds - push transparent black
            pixels.push(0, 0, 0, 0);
          }
        }
      }

      this.logMessage(`DEBUG: Extracted ${pixels.length} pixel bytes (expected ${srcWidth * srcHeight * 4})`);

      // Send pixel data to renderer using JSON.stringify
      // This is EXACTLY how the original working code did it
      this.logMessage(`DEBUG: About to call executeJavaScript with ${pixels.length} bytes`);
      const jsCode = `
        (function() {
          if (!window.plotCtx) {
            console.error('[PLOT] Context not ready for layer rendering');
            return 'Context not ready';
          }

          const width = ${srcWidth};
          const height = ${srcHeight};
          const pixels = ${JSON.stringify(pixels)};
          const destX = ${destX};
          const destY = ${destY};

          // Create ImageData from pixel array
          const imageData = window.plotCtx.createImageData(width, height);
          for (let i = 0; i < pixels.length; i++) {
            imageData.data[i] = pixels[i];
          }

          // Use putImageData since we already calculated exact pixel coordinates
          window.plotCtx.putImageData(imageData, destX, destY);

          return 'Layer copied';
        })()
      `;

      this.logMessage(`DEBUG: JavaScript string size: ${jsCode.length} characters`);
      this.logMessage(`DEBUG: Calling executeJavaScript now...`);
      const result = await debugWindow.webContents.executeJavaScript(jsCode);
      this.logMessage(`DEBUG: executeJavaScript returned: ${result}`);
      this.logMessage(`CROP result: ${result}`);
    } catch (error) {
      this.logMessage(`Failed to draw layer: ${error}`);
    }
  }

  public async writeStringToPlotAt(text: string, x: number, y: number, color?: string): Promise<void> {
    const debugWindow = this.debugWindow;
    if (!debugWindow) return;

    // Use the provided color or fall back to current text color (NOT foreground/plot color)
    // Pascal: Text uses vTextColor (DefaultTextColor = clWhite), not vPlotColor
    const textColor = color || this.currTextColor;

    // Apply ydir transformation like Pascal's AngleTextOut (line 722):
    // if vDirY then TextY := Y else TextY := (ClientHeight - Y);
    let textYOffset = y;
    if (!this.cartesianConfig.ydir) {
      // Default behavior: flip Y coordinate (mathematical coords, Y increases upward)
      textYOffset = this.displaySpec.size.height - y;
    }

    this.logMessage(`at writeStringToPlotAt('${text}', ${x}, ${y}) -> canvas Y=${textYOffset}, color=${textColor})`);
    const textHeight: number = this.font.charHeight;
    const lineHeight: number = this.font.lineHeight;
    const fontSize: number = this.font.textSizePts;
    const textXOffset = x;
    const vertLineInset: number = (lineHeight - textHeight) / 2; // 1/2 gap above and below text
    const textYbaseline: number = textYOffset + vertLineInset + this.font.baseline;
    // now let's apply alignment effects
    // let's start with horizontal alignment
    const alignHCenter = this.textStyle.horizAlign == eHorizJustification.HJ_CENTER;
    const alignHRight = this.textStyle.horizAlign == eHorizJustification.HJ_RIGHT;
    let adjYBaseline: number = textYbaseline;
    switch (this.textStyle.vertAlign) {
      case eVertJustification.VJ_TOP:
        //adjYBaseline = textYOffset + this.font.baseline;
        adjYBaseline -= vertLineInset + this.font.baseline;
        break;
      case eVertJustification.VJ_BOTTOM:
        //adjYBaseline = textYOffset + lineHeight - vertLineInset;
        //adjYBaseline = textYbaseline;
        break;
      case eVertJustification.VJ_MIDDLE:
        //adjYBaseline = textYOffset + vertLineInset + this.font.baseline - 5; // off by 5 pix?
        adjYBaseline -= (vertLineInset + this.font.baseline) / 2 + 2; // off by 2?
        break;
    }
    const alignHString: string = alignHCenter ? 'Hctr' : alignHRight ? 'Hrt' : 'Hlt';
    const alignVString: string =
      this.textStyle.vertAlign == eVertJustification.VJ_TOP
        ? 'Vtop'
        : this.textStyle.vertAlign == eVertJustification.VJ_MIDDLE
        ? 'Vmid'
        : 'Vbot';
    const fontWeight: string = this.fontWeightName(this.textStyle);
    const fontStyle: string = this.textStyle.italic ? 'italic ' : '';
    // FIXME: UNDONE add underline support
    this.logMessage(
      `  -- wt=(${fontWeight}), [${alignHString}, ${alignVString}], sz=(${fontSize}pt)[${textHeight}px], (${textColor}) @(${textXOffset},${textYOffset}) text=[${text}]`
    );

    // Calculate text position with alignment
    // Use the actual requested font size, not the default
    const fontFullSpec = `${fontStyle}${fontWeight} ${fontSize}pt Parallax, monospace`;
    this.logMessage(`  -- Font spec being applied: [${fontFullSpec}] for text size ${fontSize}pt`);

    // Execute text drawing in renderer
    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        const text = ${JSON.stringify(text)};
        const fontSpec = '${fontFullSpec}';
        let xPos = ${textXOffset};
        const yPos = ${adjYBaseline};
        const textColor = '${textColor}';
        const textAngle = ${this.textAngle};
        const alignHCenter = ${alignHCenter};
        const alignHRight = ${alignHRight};

        if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] Drawing text with font:', fontSpec);
        window.plotCtx.save();
        window.plotCtx.font = fontSpec;

        // Calculate alignment if needed
        if (alignHCenter || alignHRight) {
          const textWidth = window.plotCtx.measureText(text).width;
          if (alignHCenter) {
            xPos -= textWidth / 2;
          } else if (alignHRight) {
            xPos -= textWidth;
          }
        }

        // Handle rotation if needed
        if (textAngle !== 0) {
          window.plotCtx.translate(xPos, yPos);
          window.plotCtx.rotate((textAngle * Math.PI) / 180);
          window.plotCtx.fillStyle = textColor;
          window.plotCtx.fillText(text, 0, 0);
        } else {
          // Regular text drawing
          window.plotCtx.fillStyle = textColor;
          window.plotCtx.textAlign = 'left';
          window.plotCtx.textBaseline = 'alphabetic';
          window.plotCtx.fillText(text, xPos, yPos);
        }

        window.plotCtx.restore();
        return 'Text drawn';
      })()
    `;

    try {
      await debugWindow.webContents.executeJavaScript(jsCode);
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw text: ${error}`);
    }
  }

  public async writeStringToPlot(text: string): Promise<void> {
    // Backward compatibility method - uses current cursor position
    const [x, y] = this.getCursorXY();
    await this.writeStringToPlotAt(text, x, y);
  }

  // -----------------------------------------------------------
  //  ----------------- Utility Routines -----------------------
  //
  private getCursorXY(): [number, number] {
    // Return the current plot coordinates
    // These are already calculated and stored by setCursorPosition
    this.logMessage(`getCursorXY() returning (${this.plotCoordX}, ${this.plotCoordY})`);
    return [this.plotCoordX, this.plotCoordY];
  }

  public getXY(x: number, y: number): [number, number] {
    // calculate x,y based on Cursor Position, Cartesian scale inversions, screen size, and ORIGIN
    // Canvas coordinates: (0,0) is top-left, Y increases downward
    let newX: number;
    let newY: number;

    // X-axis: normal = left-to-right, inverted = right-to-left
    if (this.cartesianConfig.xdir) {
      newX = this.displaySpec.size.width - 1 - this.origin.x - x;
    } else {
      newX = this.origin.x + x;
    }

    // Y-axis: Pascal behavior from PLOT_GetXY (line 722):
    // Pascal: if vDirY then TextY := Y else TextY := (ClientHeight - Y);
    // vDirY false (default) = flip Y coordinate (mathematical coordinates, Y increases upward from bottom)
    // vDirY true = direct Y (screen coordinates, Y increases downward from top)
    if (this.cartesianConfig.ydir) {
      // True: Direct Y mapping (screen coordinates, Y down)
      newY = this.origin.y + y;
    } else {
      // False (default): Flip Y coordinate (mathematical coordinates, Y up)
      newY = this.displaySpec.size.height - 1 - this.origin.y - y;
    }

    newX = Math.round(newX);
    newY = Math.round(newY);
    this.logMessage(`* getXY(${x},${y}) -> (${newX},${newY})`);
    return [newX, newY];
  }

  private isColorModeCommand(command: string): boolean {
    const colorModes = [
      'LUT1',
      'LUT2',
      'LUT4',
      'LUT8',
      'LUMA8',
      'LUMA8W',
      'LUMA8X',
      'HSV8',
      'HSV8W',
      'HSV8X',
      'RGBI8',
      'RGBI8W',
      'RGBI8X',
      'RGB8',
      'HSV16',
      'HSV16W',
      'HSV16X',
      'RGB16',
      'RGB24'
    ];
    return colorModes.includes(command.toUpperCase());
  }

  /**
   * Convert polar coordinates to Cartesian
   */
  private polarToCartesian(radius: number, angle: number): [number, number] {
    const angleRad = angle * Math.PI / 180;
    const x = Math.round(radius * Math.cos(angleRad));
    const y = Math.round(radius * Math.sin(angleRad));
    return [x, y];
  }

  /**
   * Transform mouse coordinates for PC_MOUSE transmission
   * Pascal: DebugDisplayUnit.pas:3550-3554
   * Applies coordinate system transformation based on ydir
   */
  protected transformMouseCoordinates(x: number, y: number): { x: number; y: number } {
    // Pascal: if not vDirY then p.y := ClientHeight - p.y;
    // In Cartesian mode (ydir=false), invert Y coordinate
    if (!this.cartesianConfig.ydir) {
      y = this.displaySpec.size.height - y;
    }

    // Pascal: if vDirX then p.x := ClientWidth - p.x;
    if (this.cartesianConfig.xdir) {
      x = this.displaySpec.size.width - x;
    }

    return { x, y };
  }

  /**
   * Get canvas dimensions for PC_MOUSE bounds checking
   * Pascal: DebugDisplayUnit.pas:3535 - (p.x < 0) or (p.x >= ClientWidth) or (p.y < 0) or (p.y >= ClientHeight)
   */
  protected getCanvasDimensions(): { width: number; height: number } | null {
    return {
      width: this.displaySpec.size.width,
      height: this.displaySpec.size.height
    };
  }

  /**
   * Set up Plot-specific coordinate display handler
   * Hooks into base class mouse events to show coordinate flyout
   * Respects HIDEXY keyword to suppress display
   */
  private setupCoordinateDisplayHandler(): void {
    if (!this.debugWindow) return;

    // Inject coordinate display update function and event handlers into renderer
    this.debugWindow.webContents.executeJavaScript(`
      (function() {
        // Function to update coordinate display (Plot-specific functionality)
        function updateCoordinateDisplay(x, y) {
          const display = document.getElementById('coordinate-display');
          if (!display) return;

          const canvasWidth = ${this.displaySpec.size.width};
          const canvasHeight = ${this.displaySpec.size.height};

          // Calculate logical coordinates based on axis direction
          let coordX = ${this.cartesianConfig.xdir} ? (canvasWidth - x) : x;
          let coordY = ${this.cartesianConfig.ydir} ? y : (canvasHeight - y);

          // Divide by dot size to get logical coordinates
          coordX = Math.floor(coordX / ${this.displaySpec.dotSize.width});
          coordY = Math.floor(coordY / ${this.displaySpec.dotSize.height});

          // Update display text
          display.textContent = coordX + ',' + coordY;

          // Calculate display size for proper positioning
          const displayRect = display.getBoundingClientRect();
          const textWidth = displayRect.width;
          const textHeight = displayRect.height;

          // Position flyout based on quadrant
          const quadrant = (x >= canvasWidth/2 ? 1 : 0) | (y >= canvasHeight/2 ? 2 : 0);

          let displayX, displayY;
          switch(quadrant) {
            case 0: // Top-left
              displayX = x + 9;
              displayY = y + 9;
              break;
            case 1: // Top-right
              displayX = x - textWidth - 9;
              displayY = y + 9;
              break;
            case 2: // Bottom-left
              displayX = x + 9;
              displayY = y - textHeight - 9;
              break;
            case 3: // Bottom-right
              displayX = x - textWidth - 9;
              displayY = y - textHeight - 9;
              break;
          }

          // Ensure display stays within canvas bounds
          displayX = Math.max(0, Math.min(canvasWidth - textWidth, displayX));
          displayY = Math.max(0, Math.min(canvasHeight - textHeight, displayY));

          display.style.left = displayX + 'px';
          display.style.top = displayY + 'px';
          display.style.display = 'block';
        }

        // Hook into base class mouse event system
        const canvas = document.getElementById('plot-area');
        if (canvas) {
          canvas.addEventListener('mousemove', function(event) {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(event.clientX - rect.left);
            const y = Math.floor(event.clientY - rect.top);

            // Update coordinate display if not hidden
            ${!this.displaySpec.hideXY ? 'updateCoordinateDisplay(x, y);' : '// HIDEXY is set, coordinate display suppressed'}
          });

          canvas.addEventListener('mouseleave', function() {
            const display = document.getElementById('coordinate-display');
            if (display) {
              display.style.display = 'none';
            }
          });

          if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] Coordinate display handler initialized');
        }
      })();
    `);

    this.logMessage('Plot-specific coordinate display handler configured');
  }

  /**
   * Override base class to use working IPC pattern for Plot window
   * Base class uses window.electronAPI which doesn't exist in this codebase
   * Plot window uses direct ipcRenderer.send() pattern
   */
  protected enableMouseInput(): void {
    this.logMessage('Enabling mouse input forwarding (Plot override)');
    this.inputForwarder.startPolling();

    if (this.debugWindow) {
      const canvasId = this.getCanvasId();

      this.debugWindow.webContents.executeJavaScript(`
        (function() {
          // Guard against multiple initialization
          if (window.__mouseInputInitialized) {
            if (${ENABLE_CONSOLE_LOG}) console.log('[MOUSE INPUT] Already initialized, skipping');
            return;
          }
          window.__mouseInputInitialized = true;

          // Use direct IPC communication (working pattern from old Plot inline handlers)
          const { ipcRenderer } = require('electron');

          const canvas = document.getElementById('${canvasId}');
          if (canvas) {
            let mouseButtons = { left: false, middle: false, right: false };

            // Mouse enter handler - DIAGNOSTIC
            canvas.addEventListener('mouseenter', (event) => {
              const rect = canvas.getBoundingClientRect();
              const x = Math.floor(event.clientX - rect.left);
              const y = Math.floor(event.clientY - rect.top);
              if (${ENABLE_CONSOLE_LOG}) console.log('[MOUSE DIAG] ENTER canvas at renderer coords (' + x + ',' + y + ')');
              ipcRenderer.send('mouse-event', x, y, mouseButtons, 0);
            });

            // Mouse move handler
            canvas.addEventListener('mousemove', (event) => {
              const rect = canvas.getBoundingClientRect();
              const x = Math.floor(event.clientX - rect.left);
              const y = Math.floor(event.clientY - rect.top);
              ipcRenderer.send('mouse-event', x, y, mouseButtons, 0);
            });

            // Mouse button handlers
            canvas.addEventListener('mousedown', (event) => {
              if (event.button === 0) mouseButtons.left = true;
              else if (event.button === 1) mouseButtons.middle = true;
              else if (event.button === 2) mouseButtons.right = true;

              const rect = canvas.getBoundingClientRect();
              const x = Math.floor(event.clientX - rect.left);
              const y = Math.floor(event.clientY - rect.top);
              if (${ENABLE_CONSOLE_LOG}) console.log('[MOUSE DIAG] BUTTON DOWN (button=' + event.button + ') at (' + x + ',' + y + ')');
              ipcRenderer.send('mouse-event', x, y, mouseButtons, 0);
            });

            canvas.addEventListener('mouseup', (event) => {
              if (event.button === 0) mouseButtons.left = false;
              else if (event.button === 1) mouseButtons.middle = false;
              else if (event.button === 2) mouseButtons.right = false;

              const rect = canvas.getBoundingClientRect();
              const x = Math.floor(event.clientX - rect.left);
              const y = Math.floor(event.clientY - rect.top);
              if (${ENABLE_CONSOLE_LOG}) console.log('[MOUSE DIAG] BUTTON UP (button=' + event.button + ') at (' + x + ',' + y + ')');
              ipcRenderer.send('mouse-event', x, y, mouseButtons, 0);
            });

            // Mouse wheel handler
            canvas.addEventListener('wheel', (event) => {
              event.preventDefault();
              const wheelDelta = -Math.sign(event.deltaY);

              const rect = canvas.getBoundingClientRect();
              const x = Math.floor(event.clientX - rect.left);
              const y = Math.floor(event.clientY - rect.top);
              if (${ENABLE_CONSOLE_LOG}) console.log('[MOUSE DIAG] WHEEL delta=' + wheelDelta + ' at (' + x + ',' + y + ')');
              ipcRenderer.send('mouse-event', x, y, mouseButtons, wheelDelta);
            });

            // Mouse leave handler - DIAGNOSTIC
            canvas.addEventListener('mouseleave', (event) => {
              if (${ENABLE_CONSOLE_LOG}) console.log('[MOUSE DIAG] LEAVE canvas - sending (-1,-1)');
              ipcRenderer.send('mouse-event', -1, -1, mouseButtons, 0);
            });

            // Prevent context menu
            canvas.addEventListener('contextmenu', (event) => {
              event.preventDefault();
            });

            if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] Mouse input handlers initialized');
          }
        })();
      `);

      // Set up IPC handlers to receive events from renderer
      this.setupPlotMouseEventHandlers();
    }
  }

  /**
   * Set up IPC handlers for mouse events (Plot-specific version)
   * Cannot call base class private method, so Plot has its own
   */
  private setupPlotMouseEventHandlers(): void {
    if (!this.debugWindow) return;

    // Guard against duplicate handler registration (Plot-specific guard)
    if (this.plotMouseEventHandlersSetup) {
      this.logMessage('Mouse event handlers already set up, skipping');
      return;
    }
    this.plotMouseEventHandlersSetup = true;

    // Handle mouse and keyboard events from renderer
    this.debugWindow.webContents.on('ipc-message', (event, channel, ...args) => {
      if (channel === 'mouse-event') {
        const [x, y, buttons, wheelDelta] = args;

        // DIAGNOSTIC: Log state transitions
        const prevX = this.vMouseX;
        const prevY = this.vMouseY;
        const wasOutOfBounds = (prevX === -1 && prevY === -1);
        const nowOutOfBounds = (x === -1 && y === -1);

        if (!wasOutOfBounds && nowOutOfBounds) {
          this.logMessage(`[MOUSE DIAG] TRANSITION: In-bounds (${prevX},${prevY}) -> OUT-OF-BOUNDS`);
        } else if (wasOutOfBounds && !nowOutOfBounds) {
          this.logMessage(`[MOUSE DIAG] TRANSITION: OUT-OF-BOUNDS -> In-bounds (${x},${y})`);
        }

        // Handle wheel events with 100ms timer (Pascal: DebugDisplayUnit.pas:811-822)
        if (wheelDelta !== 0) {
          this.lastWheelDelta = wheelDelta;
          if (this.wheelTimer) {
            clearTimeout(this.wheelTimer);
          }
          this.wheelTimer = setTimeout(() => {
            this.lastWheelDelta = 0;
          }, 100);
        }

        // Store mouse state for PC_MOUSE command (Pascal behavior: stores current mouse state)
        // Store in canvas coordinates, transform at transmission time
        this.vMouseX = x;
        this.vMouseY = y;
        this.vMouseButtons = {
          left: buttons.left || false,
          middle: buttons.middle || false,
          right: buttons.right || false
        };
        // Store wheel delta for PC_MOUSE transmission (Pascal: DebugDisplayUnit.pas:813)
        this.vMouseWheel = this.lastWheelDelta;

        // Get pixel color at position
        const pixelGetter = this.getPixelColorGetter();

        // Queue the mouse event
        this.inputForwarder.queueMouseEvent(
          x,
          y,
          buttons,
          this.lastWheelDelta,
          pixelGetter
        );
      } else if (channel === 'key-event') {
        const [key, keyCode] = args;
        // Store keypress for PC_KEY command (Pascal behavior: stores last keypress)
        this.vKeyPress = keyCode || 0;
        this.logMessage(`Key captured: '${key}' (code: ${keyCode}) stored in vKeyPress`);
        // Also forward to input forwarder for other uses
        this.inputForwarder.queueKeyEvent(key);
      }
    });
  }

  /**
   * Override base class to use working IPC pattern for Plot window
   * Base class uses window.electronAPI which doesn't exist in this codebase
   * Plot window uses direct ipcRenderer.send() pattern
   */
  protected enableKeyboardInput(): void {
    this.logMessage('Enabling keyboard input forwarding (Plot override)');
    this.inputForwarder.startPolling();

    if (this.debugWindow) {
      this.debugWindow.webContents.executeJavaScript(`
        (function() {
          // Use direct IPC communication (working pattern from old Plot inline handlers)
          const { ipcRenderer } = require('electron');

          document.addEventListener('keydown', (event) => {
            // Map key to keyCode for PC_KEY transmission (matching Pascal behavior)
            let keyCode = event.keyCode || 0;
            if (event.key === 'ArrowLeft') keyCode = 1;
            else if (event.key === 'ArrowRight') keyCode = 2;
            else if (event.key === 'ArrowUp') keyCode = 3;
            else if (event.key === 'ArrowDown') keyCode = 4;
            else if (event.key === 'Home') keyCode = 5;
            else if (event.key === 'End') keyCode = 6;
            else if (event.key === 'Delete') keyCode = 7;
            else if (event.key === 'Backspace') keyCode = 8;
            else if (event.key === 'Tab') keyCode = 9;
            else if (event.key === 'Insert') keyCode = 10;
            else if (event.key === 'PageUp') keyCode = 11;
            else if (event.key === 'PageDown') keyCode = 12;
            else if (event.key === 'Enter') keyCode = 13;
            else if (event.key === 'Escape') keyCode = 27;
            else if (event.key.length === 1 && event.key.charCodeAt(0) >= 32 && event.key.charCodeAt(0) <= 126) {
              keyCode = event.key.charCodeAt(0); // ASCII 32-126 (Space to ~)
            }

            if (keyCode > 0) {
              ipcRenderer.send('key-event', event.key, keyCode);
            }
          });

          if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] Keyboard input handler initialized');
        })();
      `);
    }
  }

  /**
   * Get the canvas element ID for this window
   */
  protected getCanvasId(): string {
    return 'plot-area'; // Plot window uses 'plot-area' as the canvas ID
  }

}
