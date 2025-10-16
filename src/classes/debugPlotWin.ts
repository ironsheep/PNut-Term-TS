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
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';
import { PlotCommandParser } from './shared/plotCommandParser';
import { PlotWindowIntegrator, PlotCanvasOperation } from './shared/plotParserIntegration';
import { PlotPerformanceMonitor } from './shared/plotPerformanceMonitor';

// Compile-time flag for performance monitoring
const ENABLE_PERFORMANCE_MONITORING = false;

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

import {
  DebugWindowBase,
  eHorizJustification,
  eVertJustification,
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
}

export enum eCoordModes {
  CM_UNKNOWN = 0,
  CM_POLAR,
  CM_CARTESIAN
}

export interface PolarSpec {
  // In polar mode, (x, y) coordinates are interpreted as (length, angle).
  twopi: number; // For a twopi value of $100000000 or -$100000000, use 0 or -1.
  offset: number;
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
  // current terminal state
  // Removed deferredCommands - now using single queue architecture
  public cursorPosition: Position = { x: 0, y: 0 };
  private selectedLutColor: number = 0;
  public font: FontMetrics = {} as FontMetrics;
  public textStyle: TextStyle = {} as TextStyle;
  private origin: Position = { x: 0, y: 0 }; // users are: DOT, LINE, CIRCLE, OVAL, BOX, OBOX
  private canvasOffset: Position = { x: 0, y: 0 };

  private polarConfig: PolarSpec = { twopi: 0x100000000, offset: 0 };
  private cartesianConfig: CartesianSpec = { ydir: true, xdir: false };
  private coordinateMode: eCoordModes = eCoordModes.CM_CARTESIAN; // default to cartesian mode
  private lineSize: number = 1;
  private precise: number = 8; //  Toggle precise mode, where line size and (x,y) for DOT and LINE are expressed in 256ths of a pixel. [0, 8] used as shift value
  public currFgColor: string = '#00FFFF'; // #RRGGBB string - Pascal: DefaultPlotColor = clCyan
  public currTextColor: string = '#FFFFFF'; // #RRGGBB string - Pascal: DefaultTextColor = clWhite

  // Queue for pending canvas operations that need to be executed at display time
  private pendingOperations: PlotCanvasOperation[] = [];

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
  private plotCommandParser: PlotCommandParser;
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
    DebugColor.setDefaultBrightness(15); // set default brightness to max

    // Enable logging for PLOT window
    this.isLogging = false;

    // record our Debug Plot Window Spec
    this.displaySpec = displaySpec;
    this.updateMode = displaySpec.delayedUpdate || false; // Set update mode from display spec
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
    this.layerManager = new LayerManager();
    this.spriteManager = new SpriteManager();

    // Initialize new parser system
    this.plotCommandParser = new PlotCommandParser(this.context);
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

    // set defaults (use brightness 15 for full color to match Pascal defaults)
    const bkgndColor: DebugColor = new DebugColor('BLACK', 15); // Pascal: DefaultBackColor = clBlack (brightness doesn't affect black)
    const gridColor: DebugColor = new DebugColor('GRAY', 4); // Dim gray for grid
    const textColor: DebugColor = new DebugColor('WHITE', 15); // Pascal: DefaultTextColor = clWhite (full brightness)
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
        switch (element.toUpperCase()) {
          case 'TITLE':
            // ensure we have one more value
            if (index < lineParts.length - 1) {
              displaySpec.windowTitle = lineParts[++index];
            } else {
              // console.log() as we are in class static method, not derived class...
              DebugPlotWindow.logConsoleMessageStatic(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'POS':
            // ensure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.position.x = Number(lineParts[++index]);
              displaySpec.position.y = Number(lineParts[++index]);
            } else {
              DebugPlotWindow.logConsoleMessageStatic(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SIZE':
            // ensure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.size.width = Number(lineParts[++index]);
              displaySpec.size.height = Number(lineParts[++index]);
            } else {
              DebugPlotWindow.logConsoleMessageStatic(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'BACKCOLOR':
            // ensure we have one more value
            if (index < lineParts.length - 1) {
              const colorName: string = lineParts[++index];
              let colorBrightness: number = 15; // let's default to max brightness
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

          default:
            DebugPlotWindow.logConsoleMessageStatic(`CL: PlotDisplaySpec: Unknown directive: ${element}`);
            break;
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

    // Register window with WindowPlacer for position tracking
    if (this.debugWindow) {
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
          }
          #plot-data {
            display: block;
            margin: 0;
            padding: 0;
            background-color: ${this.displaySpec.window.background};
            width: 100%;
            height: 100%;
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
      </body>
    </html>
  `;

    this.logMessage(`at createDebugWindow() PLOT with htmlContent: ${htmlContent}`);

    try {
      this.debugWindow.loadURL(`data:text/html,${encodeURIComponent(htmlContent)}`);
    } catch (error) {
      this.logMessage(`Failed to load URL: ${error}`);
    }
    // Menu.setApplicationMenu(null); // DOESNT WORK!

    // now hook load complete event so we can label and paint the grid/min/max, etc.
    this.debugWindow.webContents.once('did-finish-load', () => {
      this.logMessage('at did-finish-load');

      // Initialize the canvas for drawing
      this.initializeCanvas();
    });
  }

  private initializeCanvas(): void {
    if (!this.debugWindow) return;

    const width = this.displaySpec.size.width;
    const height = this.displaySpec.size.height;
    const bgColor = this.displaySpec.window.background;
    const useBuffering = this.updateMode; // Use buffering if in update mode

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
          console.log('[PLOT] UPDATE mode: Drawing to offscreen buffer');
        } else {
          // plotCtx points directly to visible canvas
          window.plotCtx = window.displayCtx;
          console.log('[PLOT] LIVE mode: Drawing directly to visible canvas');
        }

        // Function to flip buffer (copy offscreen to display)
        window.flipBuffer = function() {
          if (useBuffering && window.displayCtx && window.offscreenCanvas) {
            // Copy offscreen to display
            window.displayCtx.drawImage(window.offscreenCanvas, 0, 0);

            // DO NOT clear the buffer here!
            // The buffer should only be cleared by explicit CLEAR commands
            // Clearing here causes flashing because the next frame starts empty

            console.log('[PLOT] Buffer flipped');
          } else if (!useBuffering) {
            // In live mode, no flip needed
            console.log('[PLOT] Live mode - no buffer flip needed');
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

        console.log('[PLOT] Canvas initialized with double buffering and default colors');
        return 'Canvas ready with double buffering';
      })()
    `;

    this.debugWindow.webContents
      .executeJavaScript(jsCode)
      .then((result) => {
        this.logMessage(`Canvas initialization: ${result}`);
        this.shouldWriteToCanvas = true;
        this.canvasInitialized = true;
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

    const inputHandlerCode = `
      (function() {
        // Initialize input state
        window.lastPressedKey = 0;
        window.currentMouseState = 0;

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
            console.log('[PLOT INPUT] Key pressed:', event.key, 'Code:', keyCode);
          }
        });

        // Add mouse event listeners to track mouse state
        const canvas = document.getElementById('plot-area');
        if (canvas) {
          let mouseButtons = 0;
          let mouseX = 0;
          let mouseY = 0;
          let mouseOverCanvas = false;

          // Mouse move handler with coordinate display
          canvas.addEventListener('mousemove', function(event) {
            const rect = canvas.getBoundingClientRect();
            mouseX = Math.floor(event.clientX - rect.left);
            mouseY = Math.floor(event.clientY - rect.top);

            // Update coordinate display if not hidden
            if (!${this.displaySpec.hideXY}) {
              updateCoordinateDisplay(mouseX, mouseY);
            }

            updateMouseState();
          });

          // Mouse enter/leave handlers
          canvas.addEventListener('mouseenter', function() {
            mouseOverCanvas = true;
            updateMouseState();
          });

          canvas.addEventListener('mouseleave', function() {
            mouseOverCanvas = false;

            // Hide coordinate display when mouse leaves canvas
            const display = document.getElementById('coordinate-display');
            if (display) {
              display.style.display = 'none';
            }

            updateMouseState();
          });

          // Mouse button handlers
          canvas.addEventListener('mousedown', function(event) {
            // Set button bits: bit 24=left, bit 25=middle, bit 26=right
            if (event.button === 0) mouseButtons |= (1 << 24); // Left
            if (event.button === 1) mouseButtons |= (1 << 25); // Middle
            if (event.button === 2) mouseButtons |= (1 << 26); // Right
            updateMouseState();
          });

          canvas.addEventListener('mouseup', function(event) {
            // Clear button bits
            if (event.button === 0) mouseButtons &= ~(1 << 24); // Left
            if (event.button === 1) mouseButtons &= ~(1 << 25); // Middle
            if (event.button === 2) mouseButtons &= ~(1 << 26); // Right
            updateMouseState();
          });

          // Prevent context menu on right click
          canvas.addEventListener('contextmenu', function(event) {
            event.preventDefault();
          });

          // Function to update coordinate display
          function updateCoordinateDisplay(x, y) {
            const display = document.getElementById('coordinate-display');
            if (!display) return;

            const canvasWidth = ${this.displaySpec.size.width};
            const canvasHeight = ${this.displaySpec.size.height};

            // Calculate logical coordinates based on axis direction
            // Pascal: if vDirX then TextX := (ClientWidth - X) else TextX := X;
            //         if vDirY then TextY := Y else TextY := (ClientHeight - Y);
            let coordX = ${this.cartesianConfig.xdir} ? (canvasWidth - x) : x;
            let coordY = ${this.cartesianConfig.ydir} ? y : (canvasHeight - y);

            // Divide by dot size to get logical coordinates
            // Pascal: Str := IntToStr(TextX div vDotSize) + ',' + IntToStr(TextY div vDotSizeY);
            coordX = Math.floor(coordX / ${this.displaySpec.dotSize.width});
            coordY = Math.floor(coordY / ${this.displaySpec.dotSize.height});

            // Update display text
            display.textContent = coordX + ',' + coordY;

            // Calculate display size for proper positioning
            const displayRect = display.getBoundingClientRect();
            const textWidth = displayRect.width;
            const textHeight = displayRect.height;

            // Position flyout based on quadrant (matching Pascal's exact offsets)
            const quadrant = (x >= canvasWidth/2 ? 1 : 0) | (y >= canvasHeight/2 ? 2 : 0);

            // Pascal uses specific offsets: cursor at (9,9) or (w-9,h-9)
            let displayX, displayY;

            switch(quadrant) {
              case 0: // Mouse in top-left → show at cursor + offset
                displayX = x + 9;
                displayY = y + 9;
                break;
              case 1: // Mouse in top-right → show to left of cursor
                displayX = x - textWidth - 9;
                displayY = y + 9;
                break;
              case 2: // Mouse in bottom-left → show above cursor
                displayX = x + 9;
                displayY = y - textHeight - 9;
                break;
              case 3: // Mouse in bottom-right → show above-left of cursor
                displayX = x - textWidth - 9;
                displayY = y - textHeight - 9;
                break;
            }

            // Ensure display stays within canvas bounds
            displayX = Math.max(0, Math.min(canvasWidth - textWidth, displayX));
            displayY = Math.max(0, Math.min(canvasHeight - textHeight, displayY));

            display.style.left = displayX + 'px';
            display.style.top = displayY + 'px';
            display.style.right = 'auto';
            display.style.bottom = 'auto';
            display.style.display = 'block';
          }

          function updateMouseState() {
            // Encode 32-bit mouse state:
            // Bits 0-11: X position (0-4095)
            // Bits 12-23: Y position (0-4095)
            // Bits 24-26: Button states (left/middle/right)
            // Bit 31: Mouse over canvas flag
            let state = 0;

            // X position (bits 0-11)
            state |= (mouseX & 0xFFF);

            // Y position (bits 12-23)
            state |= ((mouseY & 0xFFF) << 12);

            // Button states (bits 24-26) - already set by mouse handlers
            state |= mouseButtons;

            // Mouse over canvas flag (bit 31)
            if (mouseOverCanvas) {
              state |= (1 << 31);
            }

            window.currentMouseState = state;
          }
        }

        console.log('[PLOT INPUT] Event listeners setup complete');
        return 'Input handlers ready';
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
    if (!this.debugWindow) return;

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

  protected processMessageImmediate(lineParts: string[]): void {
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
      // Handle other commands asynchronously
      this.processMessageAsync(lineParts);
    }
  }

  private processLutCommandSync(commandString: string): void {
    try {
      // Parse the LUT command
      const parsedCommands = this.plotCommandParser.parse(commandString);
      if (parsedCommands.length === 0) {
        return;
      }

      // Execute parsed LUT commands synchronously
      const results = this.plotCommandParser.executeCommands(parsedCommands);

      // Process results and execute operations synchronously
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const command = parsedCommands[i];

        if (result.success && result.canvasOperations.length > 0) {
          // Execute LUT operations immediately and synchronously
          const plotOperations = result.canvasOperations.map(
            (op) =>
              ({
                ...op,
                type: op.type as any,
                affectsState: true,
                requiresUpdate: false,
                deferrable: false
              } as PlotCanvasOperation)
          );

          // Execute synchronously
          for (const operation of plotOperations) {
            this.plotWindowIntegrator.executeOperationSync(operation);
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

    // Build command string for PLOT-specific parsing
    const commandString = lineParts.join(' ');
    this.logMessage(`---- PLOT parsing: ${commandString}`);

    try {
      // Start performance monitoring (if enabled)
      if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor) {
        this.performanceMonitor.commandStart();
      }

      // Parse commands using new deterministic parser
      const parsedCommands = this.plotCommandParser.parse(commandString);

      if (parsedCommands.length === 0) {
        this.logMessage(`No commands found in: ${commandString}`);
        if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor) {
          this.performanceMonitor.commandEnd();
        }
        return;
      }

      // Execute parsed commands
      this.logConsoleMessage(`[PLOT DEBUG] Calling plotCommandParser.executeCommands()`);
      const results = this.plotCommandParser.executeCommands(parsedCommands);
      this.logConsoleMessage(`[PLOT DEBUG] executeCommands returned ${results.length} results`);

      // Process results and execute canvas operations
      this.logConsoleMessage(`[PLOT DEBUG] Processing ${results.length} results from executeCommands`);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const command = parsedCommands[i];
        this.logConsoleMessage(
          `[PLOT DEBUG] Processing result ${i + 1}: command='${command.command}', success=${
            result.success
          }, canvasOps=${result.canvasOperations?.length || 0}`
        );

        // DEBUG: Log execution flow
        this.logMessage(
          `EXEC DEBUG: Command ${i + 1}: ${command.command} -> success=${result.success}, canvasOps=${
            result.canvasOperations?.length || 0
          }`
        );

        // Log any errors or warnings
        if (result.errors.length > 0) {
          for (const error of result.errors) {
            this.logMessage(`ERROR: ${error}`);
          }
        }

        if (result.warnings.length > 0) {
          for (const warning of result.warnings) {
            this.logMessage(`WARNING: ${warning}`);
          }
        }

        // Track canvas operations for performance monitoring (if enabled)
        if (ENABLE_PERFORMANCE_MONITORING && this.performanceMonitor && result.canvasOperations.length > 0) {
          const monitor = this.performanceMonitor;
          result.canvasOperations.forEach((op) => {
            monitor.recordCanvasOperation(op.type);
          });
        }

        // Debug command results
        this.logMessage(
          `RESULT DEBUG: Command '${command.command}' - success: ${result.success}, ops: ${
            result.canvasOperations?.length || 0
          }`
        );

        // Handle canvas operations based on command type
        if (result.success && result.canvasOperations.length > 0) {
          this.logMessage(
            `CMD DEBUG: Processing command '${command.command}' with ${result.canvasOperations.length} operations`
          );
          // Check if this is an immediate command (UPDATE, CLOSE, LUT, LUTCOLORS)
          // LUT commands are immediate like in Pascal - they modify state immediately
          const isImmediateCommand =
            command.command === 'UPDATE' ||
            command.command === 'CLOSE' ||
            command.command === 'LUT' ||
            command.command === 'LUTCOLORS';

          if (isImmediateCommand) {
            this.logMessage(`IMMEDIATE DEBUG: Executing immediate command ${command.command}`);

            // For UPDATE, execute all pending operations first, then the UPDATE
            if (command.command === 'UPDATE') {
              this.performUpdate(); // This executes pending ops and flips buffer
            }
            // For CLOSE, execute it immediately through the integrator
            else if (command.command === 'CLOSE') {
              // Execute pending operations first
              if (this.pendingOperations.length > 0) {
                this.performUpdate();
              }
              // Then close the window
              this.closeDebugWindow();
            }
            // For LUT commands, execute immediately like Pascal
            else if (command.command === 'LUT' || command.command === 'LUTCOLORS') {
              this.logMessage(
                `LUT DEBUG: Executing LUT command immediately with ${result.canvasOperations.length} operations`
              );
              // Execute LUT operations immediately through the integrator
              const plotOperations = result.canvasOperations.map(
                (op) =>
                  ({
                    ...op,
                    type: op.type as any,
                    affectsState: true, // LUT affects state
                    requiresUpdate: false, // LUT doesn't need display update
                    deferrable: false // LUT is immediate
                  } as PlotCanvasOperation)
              );

              // Execute synchronously for immediate effect - LUT must be immediate like Pascal
              // Use sync execution to ensure palette is updated before next command
              for (const operation of plotOperations) {
                this.plotWindowIntegrator.executeOperationSync(operation);
              }
              this.logMessage(`LUT DEBUG: LUT command execution completed synchronously`);
            }
          } else {
            // Regular commands get queued
            this.logMessage(
              `QUEUE DEBUG: Queueing ${result.canvasOperations.length} canvas operations for ${command.command}`
            );
            // Convert CanvasOperation to PlotCanvasOperation by adding required fields
            const plotOperations = result.canvasOperations.map(
              (op) =>
                ({
                  ...op,
                  type: op.type as any, // Type will be mapped by integrator
                  affectsState: false,
                  requiresUpdate: false,
                  deferrable: true
                } as PlotCanvasOperation)
            );
            this.pendingOperations.push(...plotOperations);

            // In immediate mode (not buffered), execute after each command line
            if (!this.displaySpec.delayedUpdate) {
              this.logMessage(`QUEUE DEBUG: Immediate mode - executing queued operations`);
              this.performUpdate();
            }
          }
        } else {
          this.logMessage(
            `QUEUE DEBUG: No operations to queue - success=${result.success}, ops=${
              result.canvasOperations?.length || 0
            }`
          );
        }
      }

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
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

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
      const result = await this.debugWindow.webContents.executeJavaScript(jsCode);
      this.logMessage(`Clear result: ${result}`);
      // In live mode (not updateMode), flip buffer immediately after clear
      if (!this.updateMode) {
        await this.performUpdate();
      }
    } catch (error) {
      this.logMessage(`Failed to clear canvas: ${error}`);
    }
  }

  public async drawLineToPlot(x: number, y: number, lineSize: number, opacity: number): Promise<void> {
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

    this.logMessage(`at drawLineToPlot(${x}, ${y}, ${lineSize}, ${opacity})`);
    const fgColor: string = this.currFgColor;
    if (this.coordinateMode == eCoordModes.CM_POLAR) {
      [x, y] = this.polarToCartesian(x, y);
    }
    const [plotFmCoordX, plotFmCoordY] = this.getCursorXY();
    const [plotToCoordX, plotToCoordY] = this.getXY(x, y);
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
      await this.debugWindow.webContents.executeJavaScript(jsCode);
      // Update cursor position after successful draw
      this.cursorPosition = { x, y };
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw line: ${error}`);
    }
  }

  public async drawCircleToPlot(diameter: number, lineSize: number, opacity: number): Promise<void> {
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

    const fgColor: string = this.currFgColor;
    const [plotCoordX, plotCoordY] = this.getCursorXY();
    const opacityString: string = opacity == 255 ? 'opaque' : opacity == 0 ? 'clear' : opacity.toString();
    const lineSizeString: string = lineSize == 0 ? 'filled' : lineSize.toString();
    this.logMessage(
      `at drawCircleToPlot(${diameter}, ${lineSizeString}, ${opacityString}) color=[${fgColor}] center @(${plotCoordX},${plotCoordY})`
    );
    this.logMessage(`  -- diameter=(${diameter}) color=[${fgColor}]`);

    // Execute drawing in the renderer
    const filled = lineSize === 0;
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
        window.plotCtx.arc(${plotCoordX}, ${plotCoordY}, ${diameter / 2}, 0, 2 * Math.PI);

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
      await this.debugWindow.webContents.executeJavaScript(jsCode);
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw circle: ${error}`);
    }
  }

  public async writeStringToPlot(text: string): Promise<void> {
    if (!this.debugWindow) return;

    this.logMessage(`at writeStringToPlot('${text}')`);
    const textHeight: number = this.font.charHeight;
    const lineHeight: number = this.font.lineHeight;
    const fontSize: number = this.font.textSizePts;
    const [textXOffset, textYOffset] = this.getCursorXY();
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
    const textColor: string = this.currTextColor;
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

        console.log('[PLOT] Drawing text with font:', fontSpec);
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
      await this.debugWindow.webContents.executeJavaScript(jsCode);
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw text: ${error}`);
    }
  }

  // -----------------------------------------------------------
  //  ----------------- Utility Routines -----------------------
  //
  private getCursorXY(): [number, number] {
    // Convert cursor logical coordinates to screen coordinates
    // The cursor stores logical coordinates from SET command
    // We need to apply origin and axis transformations for screen positioning
    return this.getXY(this.cursorPosition.x, this.cursorPosition.y);
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

    // Y-axis: Canvas already has Y increasing downward
    // ydir false = normal (Y increases downward from origin)
    // ydir true = inverted (Y increases upward from origin)
    if (this.cartesianConfig.ydir) {
      // Inverted: Y increases upward, so flip relative to canvas height
      newY = this.displaySpec.size.height - 1 - this.origin.y - y;
    } else {
      // Normal: Y increases downward, matches canvas coordinates
      newY = this.origin.y + y;
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

  private async drawDotToPlot(dotSize: number, opacity: number): Promise<void> {
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

    const [plotCoordX, plotCoordY] = this.getCursorXY();
    const fgColor = this.currFgColor;

    this.logMessage(`at drawDotToPlot(${dotSize}, ${opacity}) @(${plotCoordX},${plotCoordY})`);

    // Execute drawing in the renderer
    const jsCode = `
      (function() {
        if (!window.plotCtx) {
          console.error('[PLOT] Context not ready for dot drawing');
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

        // Draw dot as a filled circle or single pixel
        window.plotCtx.fillStyle = '${fgColor}';

        if (${dotSize} <= 1) {
          // Single pixel
          window.plotCtx.fillRect(${plotCoordX}, ${plotCoordY}, 1, 1);
        } else {
          // Draw as filled circle
          window.plotCtx.beginPath();
          window.plotCtx.arc(${plotCoordX}, ${plotCoordY}, ${dotSize / 2}, 0, 2 * Math.PI);
          window.plotCtx.fill();
        }

        // Restore alpha
        window.plotCtx.globalAlpha = savedAlpha;

        return 'Dot drawn';
      })()
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(jsCode);
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw dot: ${error}`);
    }
  }

  private async drawBoxToPlot(width: number, height: number, lineSize: number, opacity: number): Promise<void> {
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

    const [plotCoordX, plotCoordY] = this.getCursorXY();
    const fgColor = this.currFgColor;

    this.logMessage(
      `at drawBoxToPlot(${width}x${height}, line:${lineSize}, op:${opacity}) @(${plotCoordX},${plotCoordY})`
    );

    // Calculate rectangle bounds (centered on cursor)
    const x1 = plotCoordX - width / 2;
    const y1 = plotCoordY - height / 2;
    const x2 = plotCoordX + width / 2;
    const y2 = plotCoordY + height / 2;

    // Execute box drawing in renderer
    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        // Apply gamma correction to opacity
        const linearOpacity = ${opacity} / 255;
        const gammaCorrectedOpacity = Math.pow(linearOpacity, 1.0 / 2.2);
        window.plotCtx.globalAlpha = gammaCorrectedOpacity;

        if (${lineSize} === 0) {
          // Filled rectangle
          window.plotCtx.fillStyle = '${fgColor}';
          window.plotCtx.fillRect(${x1}, ${y1}, ${width}, ${height});
        } else {
          // Outlined rectangle
          window.plotCtx.strokeStyle = '${fgColor}';
          window.plotCtx.lineWidth = ${lineSize};
          window.plotCtx.strokeRect(${x1}, ${y1}, ${width}, ${height});
        }

        window.plotCtx.globalAlpha = 1.0;
        return 'Box drawn';
      })()
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(jsCode);
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw box: ${error}`);
    }
  }

  private async drawOvalToPlot(width: number, height: number, lineSize: number, opacity: number): Promise<void> {
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

    const [plotCoordX, plotCoordY] = this.getCursorXY();
    const fgColor = this.currFgColor;

    this.logMessage(
      `at drawOvalToPlot(${width}x${height}, line:${lineSize}, op:${opacity}) @(${plotCoordX},${plotCoordY})`
    );

    const rx = width / 2;
    const ry = height / 2;

    // Execute oval drawing in renderer
    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        window.plotCtx.save();
        // Apply gamma correction to opacity
        const linearOpacity = ${opacity} / 255;
        const gammaCorrectedOpacity = Math.pow(linearOpacity, 1.0 / 2.2);
        window.plotCtx.globalAlpha = gammaCorrectedOpacity;

        window.plotCtx.beginPath();
        window.plotCtx.ellipse(${plotCoordX}, ${plotCoordY}, ${rx}, ${ry}, 0, 0, 2 * Math.PI);

        if (${lineSize} === 0) {
          // Filled oval
          window.plotCtx.fillStyle = '${fgColor}';
          window.plotCtx.fill();
        } else {
          // Outlined oval
          window.plotCtx.strokeStyle = '${fgColor}';
          window.plotCtx.lineWidth = ${lineSize};
          window.plotCtx.stroke();
        }

        window.plotCtx.restore();
        return 'Oval drawn';
      })()
    `;

    try {
      await this.debugWindow.webContents.executeJavaScript(jsCode);
      // Buffer updates are handled in performUpdate() now
    } catch (error) {
      this.logMessage(`Failed to draw oval: ${error}`);
    }
  }

  private polarToCartesianNew(length: number, angle: number): [number, number] {
    const { sin, cos } = this.sinCos(angle);
    const x: number = Math.round(length * cos);
    const y: number = Math.round(length * sin);
    return [x, y];
  }

  private sinCos(angle: number): { sin: number; cos: number } {
    return {
      sin: Math.sin(angle),
      cos: Math.cos(angle)
    };
  }

  public polarToCartesian(length: number, angle: number): [number, number] {
    // convert polar to cartesian
    // Chips:
    //   Tf := (Int64(theta_y) + Int64(vTheta)) / vTwoPi * Pi * 2;
    //   SinCos(Tf, Yf, Xf);
    //   theta_y := Round(Yf * rho_x);
    //   rho_x := Round(Xf * rho_x);

    // Smarty Pants:
    //  const rho_x: number = Math.round(length * Math.cos(angle));
    //  const theta_y: number = Math.round(length * Math.sin(angle));

    // Chip's way:
    const Tf = ((angle + this.polarConfig.offset) / this.polarConfig.twopi) * Math.PI * 2;
    const { sin, cos } = this.sinCos(Tf);
    const theta_y = Math.round(sin * length);
    const rho_x = Math.round(cos * length);

    this.logMessage(`* polarToCartesian(L:${length}, A:${angle}) -> (X:${rho_x}, Y:${theta_y})`);
    return [rho_x, theta_y];
  }

  // Convert #rrggbb to rgba
  private hexToRgba(hex: string, opacity: number): string {
    // Remove the leading '#' if present
    hex = hex.replace(/^#/, '');

    // Parse the red, green, and blue components
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    // Return the rgba string
    const rgbaStr: string = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    this.logMessage(`* hexToRgba(${hex}, ${opacity}) -> ${rgbaStr}`);
    return rgbaStr;
  }

  private plotOffsetByOrigin(newX: number, newY: number): [number, number] {
    // remove the origin offset to get to canvas coordinates
    const plotX: number = newX - this.origin.x;
    const plotY: number = newY - this.origin.y;
    //this.logMessage(`* plotOffsetByOrigin(${newX},${newY}) -> (${plotX},${plotY})`);
    return [plotX, plotY];
  }

  private plotToCanvasCoord(cursor: Position): [number, number] {
    // remove the origin offset subtraction then add it to get to canvas coordinates
    const plotX: number = cursor.x + this.canvasOffset.x * 2;
    const plotY: number = cursor.y + this.canvasOffset.y * 2;
    this.logMessage(`* plotToCanvasCoord(${cursor.x},${cursor.y}) -> (${plotX},${plotY})`);
    return [plotX, plotY];
  }

  /**
   * Get the canvas element ID for this window
   */
  protected getCanvasId(): string {
    return 'plot-area'; // Plot window uses 'plot-area' as the canvas ID
  }
}
