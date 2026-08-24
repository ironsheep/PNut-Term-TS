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

export interface PlotDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  position: Position;
  hasExplicitPosition: boolean; // true if POS clause was in original message
  size: Size;
  dotSize: Size;
  window: WindowColor;
  lutColors?: number[]; // LUTCOLORS directive — rgb24 LUT palette entries (Pascal vLut[0..$FF])
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
 * - `DOTSIZE x y` - Set dot dimensions (1-256, default: 1x1)
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
  private vPixelX: number = 0; // Raw cursor X value (Pascal vPixelX — pre-origin)
  private vPixelY: number = 0; // Raw cursor Y value (Pascal vPixelY — pre-origin)
  // NOTE: the origin-inclusive draw coordinate is computed live in getCursorXY() at draw
  // time (Pascal PLOT_GetXY), not cached here — so an ORIGIN change after SET is honored. [9win §13a]
  private isCartesian: boolean = true; // True = Cartesian mode, False = Polar mode
  private isPrecise: boolean = false; // Precise coordinate mode

  private shouldWriteToCanvas: boolean = true;
  private canvasInitialized: boolean = false;

  // Renders (performUpdate) are SERIALIZED through the inherited renderChain (DebugWindowBase) via
  // scheduleRender() so a SAVE awaits the in-flight/queued render before capturing. executeBatch
  // issues per-operation draws across MULTIPLE awaited IPC turns, so a fire-and-forget performUpdate
  // would let SAVE's capturePage race a half-drawn plot. The base SAVE methods await renderChain via
  // flushBeforeCapture(), so PLOT no longer overrides them. [unified draw→save flow #49]

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
  public textAngle: number = 0; // degrees (persistent; the renderer reads this) [9win §13c]
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

  constructor(ctx: Context, displaySpec: PlotDisplaySpec, windowId?: string) {
    // Use the user-provided display name as the window ID (the unique routing key), matching
    // TERM/LOGIC. The old `plot-${Date.now()}` default collided when two same-type windows were
    // created in the same millisecond → "Window … is already registered". [windowid-datenow-collision]
    const actualWindowId = windowId || displaySpec.displayName;
    super(ctx, actualWindowId, 'plot');
    this.windowLogPrefix = 'pltW';
    DebugColor.setDefaultBrightness(8); // Default to full saturated color (brightness 8 in RGBI8X), not pale (15)

    // Enable logging for PLOT window
    this.isLogging = false;

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
    // Apply LUTCOLORS from the declaration (Pascal KeyLutColors fills vLut[0..$FF] at
    // PLOT_Configure time). parsePlotDeclaration stored them as rgb24 ints from index 0 up.
    if (displaySpec.lutColors && displaySpec.lutColors.length > 0) {
      for (let i = 0; i < displaySpec.lutColors.length && i < 256; i++) {
        this.lutManager.setColor(i, displaySpec.lutColors[i]);
      }
      this.colorTranslator.setLutPalette(this.lutManager.getPalette());
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
    let desiredValue: string = `${this.displaySpec.displayName} - PLOT`;
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
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults (use brightness 8 for full saturated colors in RGBI8X system)
    const bkgndColor: DebugColor = DebugColor.fromDefaultName('BLACK', 8); // Pascal: DefaultBackColor = clBlack (brightness doesn't affect black)
    const gridColor: DebugColor = DebugColor.fromDefaultName('GRAY', 4); // Dim gray for grid
    const textColor: DebugColor = DebugColor.fromDefaultName('WHITE', 8); // Pascal: DefaultTextColor = clWhite (full saturated white)
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
            case 'DOTSIZE': {
              // DOTSIZE x {y} — Pascal PLOT_Configure key_dotsize (DebugDisplayUnit.pas:1890-1895):
              // KeyValWithin(vDotSize,1,256); if present, vDotSizeY := vDotSize then
              // KeyValWithin(vDotSizeY,1,256). Was unhandled (fell to default → stayed 1×1),
              // so a config-time DOTSIZE never applied (e.g. PC_MOUSE ÷dotSize stayed ÷1). [9win §13a]
              // Parse via Spin2NumericParser ($hex/%bin/%%quat/underscores) clamped 1..256,
              // mirroring Pascal KeyValWithin(vDotSize,1,256) then optional y.
              const dsW = DisplaySpecParser.clampInt(lineParts, index + 1, 1, 256);
              if (dsW !== null) {
                index++;
                displaySpec.dotSize.width = dsW;
                displaySpec.dotSize.height = dsW; // Pascal: vDotSizeY := vDotSize (y defaults to x)
                const dsH = DisplaySpecParser.clampInt(lineParts, index + 1, 1, 256);
                if (dsH !== null) {
                  index++;
                  displaySpec.dotSize.height = dsH;
                }
              }
              break;
            }
            case 'BACKCOLOR': {
              // Pascal PLOT_Configure key_backcolor -> KeyColor(vBackColor) (:1900-1901).
              // One directive color via the shared parseKeyColor (NAME [brightness] | numeric
              // | $hex | #rrggbb). Missing/invalid color leaves the default and does NOT abort
              // the window (C4 / Pascal KeyColor returns False -> token left for outer loop).
              const bg = DisplaySpecParser.parseKeyColor(lineParts, index + 1);
              if (bg !== null) {
                displaySpec.window.background = bg.rgb;
                index = bg.nextIdx - 1; // -1 compensates for the loop's ++index
              }
              break;
            }
            case 'LUTCOLORS': {
              // Pascal PLOT_Configure key_lutcolors -> KeyLutColors (:1898-1899, :2806):
              // load up to 256 LUT entries, each one KeyColor (NAME [brightness] | numeric |
              // $hex | #rrggbb), stopping at the first non-color token (it belongs to the next
              // directive). Routed through the shared parseKeyColor; never aborts the window.
              displaySpec.lutColors = [];
              for (;;) {
                const entry = DisplaySpecParser.parseKeyColor(lineParts, index + 1);
                if (entry === null) {
                  break; // not a color -> next directive (also stops at end of tokens)
                }
                displaySpec.lutColors.push(parseInt(entry.rgb.slice(1), 16)); // '#rrggbb' -> rgb24 int
                index = entry.nextIdx - 1; // -1 compensates for the loop's ++index
                if (displaySpec.lutColors.length >= 256) {
                  break; // Pascal vLut[0..$FF]
                }
              }
              break;
            }
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
              DebugPlotWindow.logConsoleMessageStatic(
                `CL: PlotDisplaySpec: Color mode set to ${element.toUpperCase()}`
              );
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
    // Size by CLIENT area + useContentSize:true on the BrowserWindow (Electron
    // adds OS chrome). The old +20w/+40h outer-size estimate left the web
    // content wider than our drawing on macOS (no side borders), which plain
    // SAVE captured as a white right/bottom edge. Matches the FFT window.
    const windowDimensions = { width: contentWidth, height: contentHeight };
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

    // Register window with WindowPlacer for position tracking (only if using auto-placement)
    if (this.debugWindow && !this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      windowPlacer.registerWindow(`plot-${this.displaySpec.displayName}`, this.debugWindow);
    }

    // hook window events before being shown
    this.debugWindow.once('ready-to-show', () => {
      this.logMessage('at ready-to-show');

      // Register for message DELIVERY but do NOT mark ready here: PLOT's canvas init is async and
      // completes in initializeCanvas()'s .then(). Marking ready here (before canvasInitialized)
      // would drain the buffered draws against an uninitialized canvas — they would queue into
      // pendingOperations and lose the race to SAVE's capturePage, capturing a blank/stale plot.
      // markReady=false keeps messages enqueued until onWindowReady() fires from the init .then().
      // [ready AFTER canvas init — same fix as MIDI lit-chord-not-captured]
      this.registerWithRouter(false);

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
            /* Nearest-neighbor on the Retina (DPR>1) upscale — avoids bilinear blur of the
               logical-res canvas. Matches BITMAP/SPECTRO; Chromium resolves to crisp-edges. */
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
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

      // NOTE: readiness is marked inside initializeCanvas()'s completion, NOT here. initializeCanvas
      // sets up the canvas context ASYNCHRONOUSLY (an executeJavaScript round-trip that flips
      // canvasInitialized true in its .then). onWindowReady() drains buffered messages (draws + the
      // SAVE); marking ready here, before canvasInitialized, made every draw during the drain queue
      // into pendingOperations and lose the FIFO race to SAVE's capturePage — capturing a blank/
      // stale plot. [window-readiness uniform sequence — ready AFTER canvas init]
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
          void this.flushRender();
        }

        // Set up input event listeners after canvas is ready
        this.setupInputEventListeners();
        // Initialize performance overlay (if enabled)
        if (ENABLE_PERFORMANCE_MONITORING) {
          this.initializePerformanceOverlay();
        }
        // Mark READY only now that the canvas is initialized: the router then drains buffered
        // messages against a ready canvas, so draws are issued synchronously during the drain and
        // the SAVE capture flush catches them (matches MIDI/SPECTRO). [ready AFTER canvas init]
        this.onWindowReady();
      })
      .catch((error) => {
        this.logMessage(`Failed to initialize canvas: ${error}`);
        this.shouldWriteToCanvas = false;
        // Still mark ready so the buffered SAVE/messages drain instead of hanging on a failed init.
        this.onWindowReady();
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
              case 'Delete': keyCode = 7; break; // Pascal kDelete -> Chr(7) (:844); matches enableKeyboardInput()
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

  /**
   * Serialize a render through renderChain so SAVE can await the in-flight/queued render before
   * capturing. Call this instead of performUpdate() fire-and-forget. Returns the chain tail.
   */
  private flushRender(): Promise<void> {
    // Serialize through the inherited renderChain; the base SAVE awaits it via flushBeforeCapture().
    return this.scheduleRender(() => this.performUpdate());
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

    // Use await to ensure buffer flip completes before continuing.
    // Bind the window first: performUpdate() has already awaited by the time it gets
    // here, and closeDebugWindow() sets `this.debugWindow = null` — re-reading the field
    // after an await reports a window close as "Failed to flip buffer: TypeError...".
    // Every other async site in this file already uses this capture idiom; this one was
    // the exception. [teardown-race deref class]
    const debugWindow = this.debugWindow;
    if (!debugWindow || debugWindow.isDestroyed()) {
      // Window closed while this update was in flight — nothing to flip. Fall THROUGH
      // rather than returning: renderStart() has already been counted and the
      // renderEnd() below must balance it.
      this.logMessage(`Buffer flip skipped: window closed during update`);
    } else {
      try {
        const result = await debugWindow.webContents.executeJavaScript(jsCode);
        this.logMessage(`Buffer flip result: ${result}`);
      } catch (error) {
        this.logMessage(`Failed to flip buffer: ${error}`);
      }
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

    // Perform the update regardless of buffering mode, serialized through renderChain so a
    // following SAVE can await it (we still don't block the message loop here).
    void this.flushRender();
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
      const lineParts = commandString.split(' ').filter((part) => part.length > 0);

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
          for (let i = 0; i < 256 && index + 1 < lineParts.length; i++) {
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

      // A bare directive color name (ORANGE, CYAN, WHITE, ...) is Pascal's key_black..key_gray
      // arm of the COLOR case — resolve it through the same unified KeyColor path as the COLOR
      // keyword (name [brightness], and TEXT-follows -> set text color).
      if (this.isColorCommand(upperCommand)) {
        index = this.applyColorDirective(lineParts, index);
        continue;
      }

      // Parse commands
      switch (upperCommand) {
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
          // COLOR <color> — Pascal key_color (:1934-1943): KeyColor(vPlotColor) then, if TEXT
          // follows, vTextColor := vPlotColor. A NAME resolves via the shared parseKeyColor; a
          // numeric value is interpreted through the current color MODE (ColorTranslator). A
          // missing/non-color arg leaves the color unchanged and does not abort (C4).
          index = this.applyColorDirective(lineParts, index + 1);
          break;
        }

        case 'DOT': {
          // DOT [lineSize [opacity]]
          let lineSize = this.lineSize; // Use persistent line size as default
          let opacity = this.opacity; // Pascal :1967 defaults t2 to vOpacity, as every other shape does

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

          // Use the requested line size directly. (The old code force-bumped dots to a
          // minimum of 3px in precise mode — a cosmetic fudge faking sub-pixel rendering;
          // true Smooth* thickness scaling is §13b, not a coordinate concern.) [9win §13a]
          await this.drawDotToPlot(lineSize, opacity);
          break;
        }

        case 'LINE': {
          // LINE x y [lineSize [opacity]]
          // Values are in 8.8 fixed-point format (value * 256)
          // Capture current cursor position immediately for this line's starting point
          // (origin-inclusive, computed live so a mid-sequence ORIGIN change is honored). [9win §13a]
          const [fromX, fromY] = this.getCursorXY();

          if (index + 1 < lineParts.length) {
            const xFixed = this.parseNumber(lineParts[++index]);
            index = this.skipComma(lineParts, index); // Skip optional comma
            const yFixed = index < lineParts.length ? this.parseNumber(lineParts[++index]) : null;
            let lineSize = this.lineSize; // Use persistent line size as default
            let opacity = this.opacity;

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
              // Use the requested line size directly (no precise-mode thickness fudge). [9win §13a]
              this.logMessage(`LINE: from (${fromX}, ${fromY}) to (${x}, ${y}) with thickness ${lineSize}`);
              await this.drawLineToPlotFrom(fromX, fromY, x, y, lineSize, opacity);
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
            let opacity = this.opacity;

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
            let opacity = this.opacity;

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
            let opacity = this.opacity;

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

        case 'OBOX': {
          // OBOX width height xradius yradius [lineSize [opacity]]
          // Rounded rectangle centered on cursor. Pascal key_obox
          // (DebugDisplayUnit.pas:2015,2034):
          //   SmoothShape(cx, cy, width, height, xradius, yradius, linesize, color, opacity)
          if (index + 4 < lineParts.length) {
            const width = this.parseNumber(lineParts[++index]);
            const height = this.parseNumber(lineParts[++index]);
            const xRadius = this.parseNumber(lineParts[++index]);
            const yRadius = this.parseNumber(lineParts[++index]);
            let lineSize = 0; // 0 = filled
            let opacity = this.opacity;

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

            if (width !== null && height !== null && xRadius !== null && yRadius !== null) {
              await this.drawOBoxToPlot(width, height, xRadius, yRadius, lineSize, opacity);
            }
          }
          break;
        }

        case 'TEXT': {
          // TEXT [size [style [angle]]] 'string'
          let textSize = 10;
          let textStyleValue = 1;
          let textAngle = this.textAngle; // Pascal a[2] := vTextAngle (:2047) — default to persistent
          let text = '';

          // Capture current cursor position and color immediately for this text command
          // (origin-inclusive, computed live at draw time). [9win §13a]
          const [textX, textY] = this.getCursorXY();
          // Pascal: Color commands check if TEXT follows and update vTextColor accordingly
          // TEXT always uses vTextColor (set by color lookahead or remains white)
          const textColor = this.currTextColor;
          const savedFont: FontMetrics = { ...this.font };
          const savedTextStyle: TextStyle = { ...this.textStyle };
          const workingFont: FontMetrics = { ...this.font };
          const workingTextStyle: TextStyle = { ...this.textStyle };

          // Look for optional numeric parameters
          let paramIndex = index + 1;

          // Check for size — Pascal key_text (:2045-2048) reads the inline size with a raw
          // KeyVal (a[0]); it is NOT clamped (only the standalone TEXTSIZE clamps 6..200).
          // Consume any numeric token as the size; a non-numeric token is the style/angle/string.
          if (paramIndex < lineParts.length) {
            const val = this.parseNumber(lineParts[paramIndex]);
            if (val !== null) {
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

          // Check for angle — Pascal MakeTextAngle(a[2]) when an explicit angle is given
          // (:2048). An explicit TEXT angle is transient (does NOT update vTextAngle).
          if (paramIndex < lineParts.length) {
            const val = this.parseNumber(lineParts[paramIndex]);
            if (val !== null) {
              textAngle = this.makeTextAngle(val);
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
              // Immediate mode - render text now using per-command metrics. writeStringToPlotAt
              // reads this.textAngle, so apply the effective (possibly transient) angle around
              // the draw and restore the persistent value afterward. [9win §13c]
              const savedAngle = this.textAngle;
              this.font = workingFont;
              this.textStyle = workingTextStyle;
              this.textAngle = textAngle;
              await this.writeStringToPlotAt(text, textX, textY, textColor);
              this.font = savedFont;
              this.textStyle = savedTextStyle;
              this.textAngle = savedAngle;
            }
          }
          break;
        }

        case 'TEXTSIZE': {
          // TEXTSIZE size — Pascal KeyTextSize = KeyValWithin(vTextSize, 6, 200) (:2834-2837)
          if (index + 1 < lineParts.length) {
            const size = this.parseNumber(lineParts[++index]);
            if (size !== null && size >= 6 && size <= 200) {
              this.font.textSizePts = size;
              this.font.charHeight = Math.round(size * 1.33); // Convert points to pixels
            }
          }
          break;
        }

        case 'TEXTSTYLE': {
          // TEXTSTYLE style — Pascal key_textstyle (:2039) stores the raw byte in vTextStyle,
          // decoded by AngleTextOut as %YYXXUIWW (weight bits0-1, italic bit2, underline bit3,
          // H-justify bits4-5, V-justify bits6-7). Use the shared decoder so TEXTSTYLE and the
          // inline TEXT style field agree exactly.
          if (index + 1 < lineParts.length) {
            const style = this.parseNumber(lineParts[++index]);
            if (style !== null && style >= 0 && style <= 255) {
              DebugPlotWindow.calcStyleFromBitfield(style, this.textStyle);
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

        case 'OPACITY': {
          // OPACITY byte — Pascal key_opacity (:1944): set the persistent opacity used as the
          // default for subsequent DOT/LINE/CIRCLE/OVAL/BOX/OBOX/SPRITE draws.
          if (index + 1 < lineParts.length) {
            const val = this.parseNumber(lineParts[++index]);
            if (val !== null) {
              // Pascal :1944-1945 assigns straight into a byte with range checks off ({$Q-,R-}),
              // so the value truncates rather than clamping: OPACITY 256 -> 0, OPACITY -1 -> 255.
              this.opacity = val & 0xff;
              this.logMessage(`Set persistent opacity to ${this.opacity}`);
            }
          }
          break;
        }

        case 'BACKCOLOR': {
          // BACKCOLOR color — Pascal key_backcolor (:1932): KeyColor(vBackColor). A NAME resolves
          // via the shared parseKeyColor; a numeric value through the current color MODE
          // (ColorTranslator). A missing/non-color arg leaves the default and never aborts (C4).
          const resolved = this.resolveKeyColor(lineParts, index + 1);
          if (resolved !== null) {
            this.displaySpec.window.background = resolved.rgb;
            index = resolved.nextIdx - 1;
            this.logMessage(`Set background color to ${resolved.rgb}`);
          }
          break;
        }

        case 'TEXTANGLE': {
          // TEXTANGLE angle — Pascal key_textangle (:2041): if KeyVal then MakeTextAngle.
          // Sets the PERSISTENT text angle that TEXT defaults to.
          if (index + 1 < lineParts.length) {
            const val = this.parseNumber(lineParts[++index]);
            if (val !== null) {
              this.textAngle = this.makeTextAngle(val);
              this.logMessage(`Set persistent text angle to ${this.textAngle} deg`);
            }
          }
          break;
        }

        case 'ORIGIN': {
          // ORIGIN {x y} — Pascal key_origin (:1950-1956): with x y, set the offset; with
          // NO args, set the offset to the CURRENT pixel (vOffset := vPixel).
          const xVal = index + 1 < lineParts.length ? this.parseNumber(lineParts[index + 1]) : null;
          if (xVal !== null) {
            index++;
            const yVal = index + 1 < lineParts.length ? this.parseNumber(lineParts[index + 1]) : null;
            if (yVal !== null) {
              index++;
              this.origin.x = xVal;
              this.origin.y = yVal;
            }
          } else {
            // No (numeric) argument — origin becomes the current cursor pixel.
            this.origin.x = this.vPixelX;
            this.origin.y = this.vPixelY;
          }
          break;
        }

        case 'CARTESIAN': {
          // CARTESIAN {flipy {flipx}} - Pascal key_cartesian (DebugDisplayUnit.pas:2137-2142):
          // sets cartesian mode and reads optional flipY (vDirY) / flipX (vDirX). It does
          // NOT touch vPrecise — PRECISE is an independent directive (handled below), so a
          // trailing `PRECISE` is left in the stream for the standalone case to toggle.
          // Previously this reset isPrecise and consumed a trailing PRECISE itself, which
          // diverged from Pascal (a PRECISE issued before CARTESIAN got cleared). [9win §13a]
          this.isCartesian = true;

          // Optional flip parameters (0 = false, non-zero = true). A PRECISE token here is
          // not a flip value — leave it for the standalone PRECISE case.
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

          break;
        }

        case 'PRECISE': {
          // PRECISE — standalone update directive. Pascal key_precise
          // (DebugDisplayUnit.pas:1946-1947): vPrecise := vPrecise xor 8, i.e. a TOGGLE
          // between whole-pixel (default) and sub-pixel (÷256) coordinate input. This was
          // previously only recognized when appended to CARTESIAN, so a program that sent
          // `PRECISE` on its own line was silently ignored and its ×256 sub-pixel
          // coordinates were taken raw (256× off). [9win §13a]
          this.isPrecise = !this.isPrecise;
          this.logMessage(`PRECISE toggled -> ${this.isPrecise ? 'sub-pixel (÷256)' : 'whole-pixel'}`);
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
                this.logMessage(
                  `SPRITEDEF: Defined sprite ${spriteId} (${width}x${height}) with ${providedColors} colors`
                );
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

            // Pascal plot_layermax = 8 (:222); KeyValWithin(layer, 1, plot_layermax)
            if (layerIndex !== null && layerIndex >= 1 && layerIndex <= 8) {
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

            // Pascal plot_layermax = 8 (:222); KeyValWithin(layer, 1, plot_layermax)
            if (layerIndex !== null && layerIndex >= 1 && layerIndex <= 8) {
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
          for (let i = 0; i < 256 && index + 1 < lineParts.length; i++) {
            colors.push(lineParts[++index]);
          }
          if (colors.length > 0) {
            this.processLutColorsCommand(colors);
          }
          break;
        }

        // These commands are handled by base class but included for completeness
        case 'UPDATE':
          void this.flushRender();
          break;

        case 'CLEAR':
          // Base class handles this
          break;

        case 'CLOSE':
          // Base class handles this
          break;

        default:
          // Color-mode directive at runtime — Pascal key_lut1..key_rgb24 -> KeyColorMode
          // (:1928-1929). Sets the active color mode used by subsequent LUT/pixel data. [9win §13c]
          if (this.isColorModeCommand(command)) {
            const mode = command.toUpperCase() as ColorMode;
            this.colorMode = mode;
            this.colorTranslator.setColorMode(mode);
            this.logMessage(`PLOT: color mode set to ${mode}`);
            break;
          }
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
      void this.flushRender();
    }
  }

  /**
   * Check if a token is a color command
   */
  private isColorCommand(token: string): boolean {
    // Only the 10 COLOR-directive names are valid (Pascal key_black..key_gray);
    // aliases (GREY/OLIVE/LIME/BLUE2/GRAY2/GRAY3) are NOT directive colors.
    return DebugColor.isValidDirectiveColorName(token);
  }

  /**
   * Parse a number from a string token, handling Spin2 formats
   * Delegates to shared Spin2NumericParser for consistent parsing across all windows
   *
   * This method is used speculatively to check if optional parameters are numeric.
   * It must NOT log errors for non-numeric values - only attempt parsing if the value
   * looks numeric to avoid flooding the console with "unknown format" errors.
   */
  private parseNumber(token: string): number | null {
    if (!token) {
      return null;
    }

    // Pascal accepts optional commas immediately following numeric literals (e.g., 40_960,)
    // Trim trailing commas so Spin2NumericParser receives a clean token.
    const sanitizedToken = token.replace(/,+$/g, '');

    // Pre-check if value looks numeric before attempting to parse
    // This prevents error logging for non-numeric tokens (like 'text', color names, quoted strings)
    if (!Spin2NumericParser.isNumeric(sanitizedToken)) {
      return null;
    }

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
   * Resolve ONE PLOT runtime color argument at lineParts[idx] — the TS analog of Pascal
   * KeyColor (DebugDisplayUnit.pas:2752). A directive color NAME (BLACK..GRAY, with an
   * optional 0..15 brightness; BLACK/WHITE fixed) resolves via the shared parseKeyColor; a
   * numeric pixel value is translated through the ACTIVE color MODE (Pascal TranslateColor(
   * val, vColorMode)) via ColorTranslator. Returns the '#rrggbb' string plus the index of
   * the next unconsumed token, or null when the token is not a color (Pascal KeyColor=False,
   * token left for the outer loop). Never throws / never aborts the window (C4).
   *
   * The two paths are the sprint's documented color split: directive-NAME colors go to the
   * shared parseKeyColor, pixel-MODE numerics stay on ColorTranslator. The name gate runs
   * first so parseKeyColor's own numeric-literal fallback never shadows the mode path.
   */
  private resolveKeyColor(lineParts: string[], idx: number): { rgb: string; nextIdx: number } | null {
    const token = lineParts[idx];
    if (token === undefined) {
      return null;
    }
    if (DebugColor.isValidDirectiveColorName(token)) {
      return DisplaySpecParser.parseKeyColor(lineParts, idx); // NAME [brightness], BLACK/WHITE fixed
    }
    const num = this.parseNumber(token); // $hex/%bin/decimal/underscores via Spin2NumericParser
    if (num !== null) {
      const rgb24 = this.colorTranslator.translateColor(num) & 0xffffff;
      return { rgb: '#' + rgb24.toString(16).padStart(6, '0'), nextIdx: idx + 1 };
    }
    return null;
  }

  /**
   * Apply a COLOR directive (the explicit COLOR keyword OR a bare color name) starting at
   * lineParts[colorIdx]. Sets the plot color via resolveKeyColor, and — matching Pascal
   * key_color/key_black..key_gray (:1934-1943) — if the immediately following token is TEXT,
   * the text color tracks the plot color too (the TEXT token itself is left in place for the
   * TEXT command to consume). Returns the last consumed index for the caller's for-loop;
   * a non-color argument consumes nothing here (Pascal KeyColor=False -> Dec(ptr)).
   */
  private applyColorDirective(lineParts: string[], colorIdx: number): number {
    const resolved = this.resolveKeyColor(lineParts, colorIdx);
    if (resolved === null) {
      return colorIdx - 1; // not a color -> leave the token for the outer loop
    }
    this.currFgColor = resolved.rgb;
    const peek = lineParts[resolved.nextIdx];
    if (peek !== undefined && peek.toUpperCase() === 'TEXT') {
      this.currTextColor = resolved.rgb; // Pascal: vTextColor := vPlotColor when TEXT follows
    }
    this.logMessage(`COLOR resolved to ${resolved.rgb}`);
    return resolved.nextIdx - 1;
  }

  /**
   * Set cursor position
   */
  private setCursorPosition(x: number, y: number): void {
    // Store the RAW cursor value only (Pascal SET: vPixelX := t1; vPixelY := t2,
    // DebugDisplayUnit.pas:1962-1963). The ORIGIN offset and the polar→Cartesian
    // conversion are applied at DRAW time in getCursorXY() (Pascal PLOT_GetXY :2157-2167),
    // so an ORIGIN/POLAR change issued after SET — but before the draw — is honored.
    // Previously the origin was baked in here, freezing it at SET time. [9win §13a]
    this.vPixelX = x;
    this.vPixelY = y;

    // Update public cursor position for external access (used by sprite renderer)
    this.cursorPosition = { x, y };

    this.logMessage(`SET cursor to raw (${x}, ${y})`);
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
      if (index < 256) {
        // Pascal KeyLutColors loads up to 256 LUT entries (vLut[0..$FF], :2806-2815)
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
          window.plotCtx.lineWidth = ${lineSize};  // Shape outline: Pascal SmoothShape uses thick as FULL frame width (no radius halving), unlike LINE/DOT.
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
   * Draw a rounded rectangle (OBOX) on the plot, centered on the cursor.
   * Pascal key_obox (DebugDisplayUnit.pas:2034):
   *   SmoothShape(cx, cy, width, height, xradius, yradius, linesize, color, opacity)
   * The shape is centered on the cursor (same as BOX); xradius/yradius give the
   * elliptical corner radii. Canvas2D's roundRect + fill/stroke supplies the
   * anti-aliased edge that Pascal's SmoothShape renders by hand. [9win §13b]
   */
  private async drawOBoxToPlot(
    width: number,
    height: number,
    xRadius: number,
    yRadius: number,
    lineSize: number,
    opacity: number
  ): Promise<void> {
    const debugWindow = this.debugWindow;
    if (!debugWindow) return;

    let [xc, yc] = this.getCursorXY();

    // Apply ydir transformation for canvas coordinates (matches BOX)
    if (!this.cartesianConfig.ydir) {
      yc = this.displaySpec.size.height - yc;
    }

    // Centered on cursor, like BOX (Pascal centers via SmoothShape cx,cy).
    const xl = xc - Math.floor(width / 2);
    const yt = yc - Math.floor(height / 2);
    // Corner radii cannot exceed half the box extent (Canvas clamps internally, but
    // negatives would throw — guard them here).
    const rx = Math.max(0, Math.min(xRadius, width / 2));
    const ry = Math.max(0, Math.min(yRadius, height / 2));
    const filled = lineSize === 0;

    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        window.plotCtx.globalAlpha = ${opacity / 255};

        window.plotCtx.beginPath();
        window.plotCtx.roundRect(${xl}, ${yt}, ${width}, ${height}, [{x: ${rx}, y: ${ry}}]);

        if (${filled}) {
          window.plotCtx.fillStyle = '${this.currFgColor}';
          window.plotCtx.fill();
        } else {
          window.plotCtx.strokeStyle = '${this.currFgColor}';
          window.plotCtx.lineWidth = ${lineSize};  // Shape outline: Pascal SmoothShape uses thick as FULL frame width (no radius halving), unlike LINE/DOT.
          window.plotCtx.stroke();
        }

        window.plotCtx.globalAlpha = 1.0;
        return 'OBox drawn';
      })()
    `;

    try {
      await debugWindow.webContents.executeJavaScript(jsCode);
    } catch (error) {
      this.logMessage(`Failed to draw obox: ${error}`);
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
          window.plotCtx.lineWidth = ${lineSize};  // Shape outline: Pascal SmoothShape uses thick as FULL frame width (no radius halving), unlike LINE/DOT.
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
        await this.flushRender();
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
        window.plotCtx.lineWidth = ${lineSize / 2};  // LINE: Pascal SmoothLine radius = lineSize shl vPrecise SHR 1 (half width); Canvas lineWidth is full width. Matches SCOPE/FFT/LOGIC traces.
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
      // Update cursor to the raw endpoint (origin applied live by getCursorXY). [9win §13a]
      this.cursorPosition = { x, y };
      this.vPixelX = x;
      this.vPixelY = y;
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

    // Mirror immediate mode behavior: update cursor to the raw endpoint (origin applied
    // live by getCursorXY at draw time). [9win §13a]
    this.cursorPosition = { x, y };
    this.vPixelX = x;
    this.vPixelY = y;
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
          window.plotCtx.lineWidth = ${lineSize};  // Shape outline: Pascal SmoothShape uses thick as FULL frame width (no radius halving), unlike LINE/DOT.
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

  /**
   * Map a source sprite pixel to its destination cell offset under a given
   * orientation. Mirrors Pascal DebugDisplayUnit.pas:2123-2133 EXACTLY — the
   * eight orientations are flips/transposes, NOT 90-degree rotations:
   *   0: identity            1: flip-X            2: flip-Y          3: flip-X+Y (180)
   *   4: transpose           5: transpose+flip    6: transpose+flip  7: transpose+flip-X+Y
   * `col`/`row` are 0-indexed (Pascal's loop is 1-based; (x-1)->col, (t7-x)->sizeX-1-col).
   * Returns the canvas-pixel offset (dx,dy) to add to the sprite's base draw
   * position; each source pixel occupies a `scale`x`scale` cell. [9win §13b]
   */
  public static spritePixelOffset(
    orientation: number,
    col: number,
    row: number,
    sizeX: number,
    sizeY: number,
    scale: number
  ): { dx: number; dy: number } {
    const i = col; //            Pascal (x - 1)
    const ri = sizeX - 1 - col; // Pascal (t7 - x)
    const j = row; //            Pascal (y - 1)
    const rj = sizeY - 1 - row; // Pascal (t8 - y)
    let ox: number;
    let oy: number;
    switch (orientation & 7) {
      case 1:
        ox = ri;
        oy = j;
        break;
      case 2:
        ox = i;
        oy = rj;
        break;
      case 3:
        ox = ri;
        oy = rj;
        break;
      case 4:
        ox = j;
        oy = i;
        break;
      case 5:
        ox = j;
        oy = ri;
        break;
      case 6:
        ox = rj;
        oy = i;
        break;
      case 7:
        ox = rj;
        oy = ri;
        break;
      case 0:
      default:
        ox = i;
        oy = j;
        break;
    }
    return { dx: ox * scale, dy: oy * scale };
  }

  /**
   * Build the per-pixel draw list for a sprite, combining the sprite-color's own
   * alpha with the SPRITE opacity exactly as Pascal does
   * (DebugDisplayUnit.pas:2120-2122): opa := ((c shr 24 and $FF) * t6 + $FF) shr 8.
   * Pixels whose combined alpha is 0 are dropped (Pascal `if opa <> 0`). Each
   * entry's (dx,dy) is the offset from the sprite's base draw position; the pixel
   * is rendered as a `scale`x`scale` cell. Pure + deterministic for unit tests. [9win §13b]
   */
  public static buildSpritePixels(
    width: number,
    height: number,
    pixels: number[],
    colors: number[],
    orientation: number,
    scale: number,
    opacity: number
  ): Array<{ dx: number; dy: number; r: number; g: number; b: number; a: number }> {
    const out: Array<{ dx: number; dy: number; r: number; g: number; b: number; a: number }> = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const colorIndex = pixels[row * width + col] ?? 0;
        const c = (colors[colorIndex] ?? 0) >>> 0;
        const pixelAlpha = (c >>> 24) & 0xff;
        const a = ((pixelAlpha * opacity + 0xff) >> 8) & 0xff; // Pascal :2121
        if (a === 0) continue; // Pascal :2122 (if opa <> 0)
        const { dx, dy } = DebugPlotWindow.spritePixelOffset(orientation, col, row, width, height, scale);
        out.push({ dx, dy, r: (c >>> 16) & 0xff, g: (c >>> 8) & 0xff, b: c & 0xff, a });
      }
    }
    return out;
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

      // Base draw position is the current cursor (Pascal PLOT_GetXY -> t1,t2). Pascal's
      // Inc(t1, t5 shr 1) + center-based SmoothShape is equivalent to a top-left cell at
      // the cursor for even scale, so we draw each cell top-left at base + offset. [9win §13b]
      const [plotX, plotY] = this.getCursorXY();

      this.logMessage(
        `Drawing sprite ${spriteId} at (${plotX},${plotY}) orientation=${orientation} scale=${scale} opacity=${opacity}`
      );

      // Precompute the orientation-mapped, opacity-combined draw list in Node so the
      // flip/transpose math is the single tested source of truth (no trig, no rotation).
      const drawList = DebugPlotWindow.buildSpritePixels(
        sprite.width,
        sprite.height,
        sprite.pixels,
        sprite.colors,
        orientation,
        scale,
        opacity
      );

      const jsCode = `
        (function() {
          if (!window.plotCtx) {
            console.error('[PLOT] Context not ready for sprite rendering');
            return 'Context not ready';
          }

          const list = ${JSON.stringify(drawList)};
          const baseX = ${plotX};
          const baseY = ${plotY};
          const s = ${scale};

          window.plotCtx.save();
          for (let k = 0; k < list.length; k++) {
            const p = list[k];
            window.plotCtx.globalAlpha = p.a / 255;
            window.plotCtx.fillStyle = 'rgb(' + p.r + ',' + p.g + ',' + p.b + ')';
            window.plotCtx.fillRect(baseX + p.dx, baseY + p.dy, s, s);
          }
          window.plotCtx.globalAlpha = 1.0;
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
        this.logMessage(
          `CROP ERROR: Source rectangle out of bounds: (${srcLeft},${srcTop}) ${srcWidth}x${srcHeight} exceeds layer ${layer.width}x${layer.height}`
        );
        return;
      }

      this.logMessage(
        `CROP: Drawing layer ${
          layerIndex + 1
        } region (${srcLeft},${srcTop}) ${srcWidth}x${srcHeight} to (${destX},${destY})`
      );
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
            pixels.push((pixelColor >> 24) & 0xff); // R
            pixels.push((pixelColor >> 16) & 0xff); // G
            pixels.push((pixelColor >> 8) & 0xff); // B
            pixels.push(pixelColor & 0xff); // A
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
    // Vertical justify, per Pascal AngleTextOut (DebugDisplayUnit.pas:3507-3511, 3516):
    //   V=0/1: ty := h/2  -> TextOut(y - h/2) -> cell [y-h/2, y+h/2]  (centred on the anchor)
    //   V=2:   ty := h    -> TextOut(y - h)   -> cell [y-h, y]        (ink ABOVE the anchor)
    //   V=3:   ty := 0    -> TextOut(y)       -> cell [y, y+h]        (ink BELOW the anchor)
    // The enum names read from the ANCHOR edge (VJ_BOTTOM = the anchor is the text's bottom edge,
    // so the ink sits above it). Chip left these case arms unnamed; do not re-label from the ink side.
    let adjYBaseline: number = textYbaseline; // V=3 / VJ_TOP: no shift — ink below the anchor
    switch (this.textStyle.vertAlign) {
      case eVertJustification.VJ_TOP:
        // Pascal V=3: ty := 0 — baseline stays put, ink falls below the anchor
        break;
      case eVertJustification.VJ_BOTTOM:
        // Pascal V=2: ty := h — lift the whole cell above the anchor
        adjYBaseline -= lineHeight;
        break;
      case eVertJustification.VJ_MIDDLE:
        // Pascal V=0/1: ty := h/2 — half a cell up, straddling the anchor
        adjYBaseline -= lineHeight / 2;
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
        const anchorX = ${textXOffset};
        const anchorY = ${textYbaseline};                 // raw baseline (before vertical justify)
        const vy = ${adjYBaseline} - ${textYbaseline};    // vertical-justify offset, local frame
        const textColor = '${textColor}';
        const textAngle = ${this.textAngle};
        const alignHCenter = ${alignHCenter};
        const alignHRight = ${alignHRight};
        const drawUnderline = ${this.textStyle.underline};
        const fontSize = ${fontSize};

        if (${ENABLE_CONSOLE_LOG}) console.log('[PLOT] Drawing text with font:', fontSpec);
        window.plotCtx.save();
        window.plotCtx.font = fontSpec;
        window.plotCtx.textAlign = 'left';
        window.plotCtx.textBaseline = 'alphabetic';
        window.plotCtx.fillStyle = textColor;

        // Horizontal-justify offset in the text's LOCAL frame. Pascal AngleTextOut (3502-3516)
        // computes the alignment offset first, then ROTATES it with the glyphs, so the shift
        // must be applied after the rotation (as a local-frame draw offset), not to the anchor.
        const textWidth = window.plotCtx.measureText(text).width;
        let hx = 0;
        if (alignHCenter) hx = -textWidth / 2;
        else if (alignHRight) hx = -textWidth;

        // Anchor at the raw (unshifted) point, rotate, then draw at the local (hx, vy) offset.
        // For angle 0 this reduces to a plain draw at (anchorX + hx, anchorY + vy).
        window.plotCtx.translate(anchorX, anchorY);
        if (textAngle !== 0) window.plotCtx.rotate((textAngle * Math.PI) / 180);
        window.plotCtx.fillText(text, hx, vy);
        if (drawUnderline) {
          const uy = vy + Math.max(1, Math.round(fontSize * 0.12));
          window.plotCtx.strokeStyle = textColor;
          window.plotCtx.lineWidth = Math.max(1, Math.round(fontSize / 14));
          window.plotCtx.beginPath();
          window.plotCtx.moveTo(hx, uy);
          window.plotCtx.lineTo(hx + textWidth, uy);
          window.plotCtx.stroke();
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
    // Apply the current ORIGIN offset (and polar conversion) at DRAW time, not baked at
    // SET — Pascal PLOT_GetXY (DebugDisplayUnit.pas:2157-2167) recomputes from
    // vPixelX/vPixelY + vOffset on every draw, so an ORIGIN change after SET takes effect.
    // The X/Y direction flips (vDirX/vDirY) are applied per-draw by each draw helper, as
    // before — this returns the origin-inclusive, pre-flip plot coordinate. [9win §13a]
    if (this.isCartesian) {
      return [this.vPixelX + this.origin.x, this.vPixelY + this.origin.y];
    }
    // Polar: vPixelX = rho, vPixelY = theta — convert to a Cartesian offset from origin
    // (matches the prior SET-time conversion: newX = rho*cos, newY = rho*sin).
    const angleRad = ((this.vPixelY + this.polarConfig.theta) / this.polarConfig.twopi) * Math.PI * 2;
    const newX = Math.round(this.vPixelX * Math.cos(angleRad));
    const newY = Math.round(this.vPixelX * Math.sin(angleRad));
    return [this.origin.x + newX, this.origin.y + newY];
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

  /**
   * Normalize a text-angle argument the way Pascal MakeTextAngle does (:3073-3077):
   *   Cartesian: a := val mod 360 * 10   (tenths-of-degree for the Win32 lfEscapement)
   *   Polar:     a := round(val mod vTwoPi / vTwoPi * 3600)
   * Canvas rotates in radians (writeStringToPlotAt divides by 180/PI), so we keep WHOLE
   * DEGREES — behaviorally identical to Pascal's tenths-of-degree escapement encoding —
   * and normalize to 0..359. [9win §13c]
   */
  private makeTextAngle(val: number): number {
    let deg: number;
    if (this.isCartesian) {
      deg = val % 360;
    } else {
      const twopi = this.polarConfig.twopi || 0x100000000;
      deg = Math.round((((val % twopi) + twopi) % twopi / twopi) * 360);
    }
    return ((deg % 360) + 360) % 360;
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
    const angleRad = (angle * Math.PI) / 180;
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
    // Pascal SendMousePos dis_plot branch (DebugDisplayUnit.pas:3556-3561):
    // vDirX/vDirY flip, THEN divide by dotSize. The dir-flip was present but the
    // /dotSize step was missing. Route through the shared base helper. [9win §1]
    return this.transformPixelDotsize(x, y, {
      dirX: this.cartesianConfig.xdir,
      dirY: this.cartesianConfig.ydir,
      dotSizeX: this.displaySpec.dotSize.width,
      dotSizeY: this.displaySpec.dotSize.height,
      clientWidth: this.displaySpec.size.width,
      clientHeight: this.displaySpec.size.height
    });
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
            ${
              !this.displaySpec.hideXY
                ? 'updateCoordinateDisplay(x, y);'
                : '// HIDEXY is set, coordinate display suppressed'
            }
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
        const wasOutOfBounds = prevX === -1 && prevY === -1;
        const nowOutOfBounds = x === -1 && y === -1;

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
        this.inputForwarder.queueMouseEvent(x, y, buttons, this.lastWheelDelta, pixelGetter);
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

  /**
   * Capture SAVE pixels from the plot canvas BACKING STORE (toDataURL) instead of capturePage.
   * PLOT draws 1px traces; capturePage returns a bilinearly-SMOOTHED composite (the canvas displayed
   * scaled), which turned the thin grey ctl trace into a heavy ~28×-too-dense band with a grey halo
   * (fig-05). Reading the native-resolution backing store keeps the traces crisp and 1px, matching
   * the PNut reference. [#49 capture readback — applies to PLOT's thin-line traces]
   */
  protected getCaptureCanvasId(): string | null {
    return 'plot-area';
  }
}
