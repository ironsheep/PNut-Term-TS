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
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
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

  constructor(ctx: Context, displaySpec: PlotDisplaySpec, windowId: string = `plot-${Date.now()}`) {
    super(ctx, windowId, 'plot');
    this.windowLogPrefix = 'pltW';
    DebugColor.setDefaultBrightness(15); // set default brightness to max
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

    // CRITICAL FIX: Create window immediately in constructor
    // This ensures windows appear when created, matching Scope XY pattern
    this.logMessage('Creating PLOT window immediately in constructor');
    this.createDebugWindow();
  }
  
  /**
   * Log a warning about an invalid parameter with defensive default
   * TECH-DEBT: Enhanced error logging with full command context
   */
  private logParsingWarning(unparsedCommand: string, paramName: string, invalidValue: string | null, defaultValue: any): void {
    const valueDisplay = invalidValue === null ? 'missing' : `'${invalidValue}'`;
    this.logMessage(`WARNING: Debug command parsing error:\n${unparsedCommand}\nInvalid ${valueDisplay} value for parameter ${paramName}, using default: ${defaultValue}`);
  }


  get windowTitle(): string {
    let desiredValue: string = `${this.displaySpec.displayName} PLOT`;
    if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
      desiredValue = this.displaySpec.windowTitle;
    }
    return desiredValue;
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
    console.log(`CL: at parsePlotDeclaration()`);
    let displaySpec: PlotDisplaySpec = {} as PlotDisplaySpec;
    displaySpec.lutColors = [] as LutColor[]; // ensure this is structured too! (CRASHED without this!)
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults (use brightness 15 for full color to match Pascal defaults)
    const bkgndColor: DebugColor = new DebugColor('BLACK', 15); // Pascal: DefaultBackColor = clBlack (brightness doesn't affect black)
    const gridColor: DebugColor = new DebugColor('GRAY', 4); // Dim gray for grid
    const textColor: DebugColor = new DebugColor('WHITE', 15); // Pascal: DefaultTextColor = clWhite (full brightness)
    console.log(`CL: at parsePlotDeclaration() with colors...`);
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
    console.log(`CL: at overrides PlotDisplaySpec: ${lineParts}`);
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
              console.log(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'POS':
            // ensure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.position.x = Number(lineParts[++index]);
              displaySpec.position.y = Number(lineParts[++index]);
            } else {
              console.log(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SIZE':
            // ensure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.size.width = Number(lineParts[++index]);
              displaySpec.size.height = Number(lineParts[++index]);
            } else {
              console.log(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
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
              console.log(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'UPDATE':
            displaySpec.delayedUpdate = true;
            break;
          case 'HIDEXY':
            displaySpec.delayedUpdate = true;
            break;

          default:
            console.log(`CL: PlotDisplaySpec: Unknown directive: ${element}`);
            break;
        }
        if (!isValid) {
          break;
        }
      }
    }
    console.log(`CL: at end of parsePlotDeclaration(): isValid=(${isValid}), ${JSON.stringify(displaySpec, null, 2)}`);
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
        const DebugLoggerWindow = require('./debugLoggerWin').DebugLoggerWindow;
        const debugLogger = DebugLoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(`WINDOW_PLACED (${windowX},${windowY} ${windowWidth}x${windowHeight} Mon:${monitorId}) PLOT '${this.displaySpec.displayName}' POS ${windowX} ${windowY} SIZE ${windowWidth} ${windowHeight}`);
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }
    
    this.logMessage(
      `  -- PLOT window size: ${windowWidth}x${windowHeight} @${windowX},${windowY}`
    );

    // now generate the window with the calculated sizes
    const displayName: string = this.windowTitle;
    this.debugWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
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
        </style>
      </head>
      <body>
        <div id="plot-data">
          <canvas id="plot-area" width="${canvasWidth}" height="${canvasHeight}"></canvas>
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

    const jsCode = `
      (function() {
        // Get the canvas element
        window.plotCanvas = document.getElementById('plot-area');
        if (!window.plotCanvas) {
          console.error('[PLOT] Canvas element not found');
          return 'Canvas not found';
        }

        window.plotCtx = window.plotCanvas.getContext('2d');
        if (!window.plotCtx) {
          console.error('[PLOT] Could not get 2D context');
          return 'Context not available';
        }

        // Clear canvas with background color
        window.plotCtx.fillStyle = '${bgColor}';
        window.plotCtx.fillRect(0, 0, ${width}, ${height});

        // Create offscreen canvas for double buffering
        window.offscreenCanvas = document.createElement('canvas');
        window.offscreenCanvas.width = ${width};
        window.offscreenCanvas.height = ${height};

        // plotCtx is the working context (offscreen)
        window.plotCtx = window.offscreenCanvas.getContext('2d');
        window.displayCtx = window.plotCanvas.getContext('2d');

        // Function to flip buffer (copy offscreen to display)
        window.flipBuffer = function() {
          if (window.displayCtx && window.offscreenCanvas) {
            window.displayCtx.clearRect(0, 0, ${width}, ${height});
            window.displayCtx.drawImage(window.offscreenCanvas, 0, 0);
          }
        };

        // Clear offscreen canvas with background color
        window.plotCtx.fillStyle = '${bgColor}';
        window.plotCtx.fillRect(0, 0, ${width}, ${height});

        // Set initial drawing colors to avoid white-on-white
        // Pascal: DefaultPlotColor = clCyan, DefaultTextColor = clWhite
        window.plotCtx.strokeStyle = '${this.currFgColor}'; // Cyan for drawing
        window.plotCtx.fillStyle = '${this.currTextColor}'; // White for text
        window.currentFgColor = '${this.currFgColor}';
        window.currentTextColor = '${this.currTextColor}';

        console.log('[PLOT] Canvas initialized with double buffering and default colors');
        return 'Canvas ready with double buffering';
      })()
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(result => {
        this.logMessage(`Canvas initialization: ${result}`);
        this.shouldWriteToCanvas = true;
      })
      .catch(error => {
        this.logMessage(`Failed to initialize canvas: ${error}`);
        this.shouldWriteToCanvas = false;
      });
  }

  private setupDoubleBuffering(): void {
    // Double buffering is now handled in initializeCanvas
    // This method is kept for compatibility but doesn't do anything
  }
  
  private performUpdate(): void {
    if (!this.debugWindow) return;

    this.logMessage('at performUpdate() - executing queued operations and flipping buffer');

    // Execute all pending operations sequentially BEFORE buffer flip
    if (this.pendingOperations.length > 0) {
      this.logMessage(`EXEC DEBUG: Executing ${this.pendingOperations.length} queued operations sequentially`);
      const operationResults = this.plotWindowIntegrator.executeBatch(this.pendingOperations);
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

    // Execute buffer flip in renderer
    const jsCode = `
      (function() {
        if (window.flipBuffer) {
          window.flipBuffer();
          return 'Buffer flipped';
        }
        return 'Flip function not ready';
      })()
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .catch(error => {
        this.logMessage(`Failed to flip buffer: ${error}`);
      });
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() PLOT`);

    // Clean up Plot-specific resources that base class doesn't know about
    // Clear any pending operations
    this.pendingOperations = [];

    // Disable canvas writing to prevent any pending operations
    this.shouldWriteToCanvas = false;

    // Don't try to clear canvas - just close the window
    // The canvas clearing was causing the window to appear cleared but not close

    // Now let the base class do its cleanup by setting debugWindow to null
    // The base class setter will handle closing the actual window
    this.debugWindow = null;
  }

  protected processMessageImmediate(lineParts: string[]): void {
    // Handle async internally
    this.processMessageAsync(lineParts);
  }

  private async processMessageAsync(lineParts: string[]): Promise<void> {
    // Build command string from line parts, excluding the display name prefix
    const commandString = lineParts.slice(1).join(' ');

    this.logMessage(`---- PLOT parsing: ${commandString}`);

    try {
      // Parse commands using new deterministic parser
      const parsedCommands = this.plotCommandParser.parse(commandString);

      if (parsedCommands.length === 0) {
        this.logMessage(`No commands found in: ${commandString}`);
        return;
      }

      // Execute parsed commands
      const results = this.plotCommandParser.executeCommands(parsedCommands);

      // Process results and execute canvas operations
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const command = parsedCommands[i];

        // DEBUG: Log execution flow
        this.logMessage(`EXEC DEBUG: Command ${i + 1}: ${command.command} -> success=${result.success}, canvasOps=${result.canvasOperations?.length || 0}`);

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

        // Handle canvas operations based on command type
        if (result.success && result.canvasOperations.length > 0) {
          // Check if this is an immediate command (UPDATE or CLOSE)
          const isImmediateCommand = command.command === 'UPDATE' || command.command === 'CLOSE';

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
          } else {
            // Regular commands get queued
            this.logMessage(`QUEUE DEBUG: Queueing ${result.canvasOperations.length} canvas operations for ${command.command}`);
            // Convert CanvasOperation to PlotCanvasOperation by adding required fields
            const plotOperations = result.canvasOperations.map(op => ({
              ...op,
              type: op.type as any, // Type will be mapped by integrator
              affectsState: false,
              requiresUpdate: false,
              deferrable: true
            } as PlotCanvasOperation));
            this.pendingOperations.push(...plotOperations);

            // In immediate mode (not buffered), execute after each command line
            if (!this.displaySpec.delayedUpdate) {
              this.logMessage(`QUEUE DEBUG: Immediate mode - executing queued operations`);
              this.performUpdate();
            }
          }
        } else {
          this.logMessage(`QUEUE DEBUG: No operations to queue - success=${result.success}, ops=${result.canvasOperations?.length || 0}`);
        }
      }

    } catch (error) {
      this.logMessage(`PARSER ERROR: Failed to process command '${commandString}': ${error}`);
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

  public clearPlot(): void {
    // erase the  display area
    this.clearPlotCanvas();
    // home the cursorPosition
    this.cursorPosition = { x: 0, y: 0 };
  }

  // -----------------------------------------------------------
  // ----------------- Canvas Drawing Routines -----------------
  //
  private clearPlotCanvas(): void {
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

        // Clear the canvas
        window.plotCtx.clearRect(0, 0, ${this.displaySpec.size.width}, ${this.displaySpec.size.height});

        // Fill with background color
        window.plotCtx.fillStyle = '${bgcolor}';
        window.plotCtx.fillRect(0, 0, ${this.displaySpec.size.width}, ${this.displaySpec.size.height});

        return 'Canvas cleared';
      })()
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(() => {
        // In live mode (not updateMode), flip buffer immediately after clear
        if (!this.updateMode) {
          this.performUpdate();
        }
      })
      .catch(error => {
        this.logMessage(`Failed to clear canvas: ${error}`);
      });
  }

  public drawLineToPlot(x: number, y: number, lineSize: number, opacity: number): void {
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

        // Set opacity
        window.plotCtx.globalAlpha = ${opacity / 255};

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

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(() => {
        // Update cursor position after successful draw
        this.cursorPosition = { x, y };
        // Buffer updates are handled in performUpdate() now
      })
      .catch(error => {
        this.logMessage(`Failed to draw line: ${error}`);
      });
  }

  public drawCircleToPlot(diameter: number, lineSize: number, opacity: number): void {
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

        // Set opacity
        window.plotCtx.globalAlpha = ${opacity / 255};

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

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(() => {
        // Buffer updates are handled in performUpdate() now
      })
      .catch(error => {
        this.logMessage(`Failed to draw circle: ${error}`);
      });
  }

  public writeStringToPlot(text: string): void {
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

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(() => {
        // Buffer updates are handled in performUpdate() now
      })
      .catch(error => {
        this.logMessage(`Failed to draw text: ${error}`);
      });
  }

  // -----------------------------------------------------------
  //  ----------------- Utility Routines -----------------------
  //
  private getCursorXY(): [number, number] {
    // calculate x,y based on Curor Position, CartesianSpec scale inversions, screen size, and ORIGIN
    // used by OBOX, BOX, OVAL, CIRCLE, TEXT, and SPRITE
    return this.getXY(this.cursorPosition.x, this.cursorPosition.y);
  }

  private getXY(x: number, y: number): [number, number] {
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
      'LUT1', 'LUT2', 'LUT4', 'LUT8',
      'LUMA8', 'LUMA8W', 'LUMA8X',
      'HSV8', 'HSV8W', 'HSV8X',
      'RGBI8', 'RGBI8W', 'RGBI8X', 'RGB8',
      'HSV16', 'HSV16W', 'HSV16X', 'RGB16',
      'RGB24'
    ];
    return colorModes.includes(command.toUpperCase());
  }
  
  private drawDotToPlot(dotSize: number, opacity: number): void {
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

        // Set opacity
        window.plotCtx.globalAlpha = ${opacity / 255};

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

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(() => {
        // Buffer updates are handled in performUpdate() now
      })
      .catch(error => {
        this.logMessage(`Failed to draw dot: ${error}`);
      });
  }
  
  private drawBoxToPlot(width: number, height: number, lineSize: number, opacity: number): void {
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

    const [plotCoordX, plotCoordY] = this.getCursorXY();
    const fgColor = this.currFgColor;

    this.logMessage(`at drawBoxToPlot(${width}x${height}, line:${lineSize}, op:${opacity}) @(${plotCoordX},${plotCoordY})`);

    // Calculate rectangle bounds (centered on cursor)
    const x1 = plotCoordX - width / 2;
    const y1 = plotCoordY - height / 2;
    const x2 = plotCoordX + width / 2;
    const y2 = plotCoordY + height / 2;

    // Execute box drawing in renderer
    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        window.plotCtx.globalAlpha = ${opacity / 255};

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

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(() => {
        // Buffer updates are handled in performUpdate() now
      })
      .catch(error => {
        this.logMessage(`Failed to draw box: ${error}`);
      });
  }
  
  private drawOvalToPlot(width: number, height: number, lineSize: number, opacity: number): void {
    if (!this.debugWindow || !this.shouldWriteToCanvas) return;

    const [plotCoordX, plotCoordY] = this.getCursorXY();
    const fgColor = this.currFgColor;

    this.logMessage(`at drawOvalToPlot(${width}x${height}, line:${lineSize}, op:${opacity}) @(${plotCoordX},${plotCoordY})`);

    const rx = width / 2;
    const ry = height / 2;

    // Execute oval drawing in renderer
    const jsCode = `
      (function() {
        if (!window.plotCtx) return 'Context not ready';

        window.plotCtx.save();
        window.plotCtx.globalAlpha = ${opacity / 255};

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

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(() => {
        // Buffer updates are handled in performUpdate() now
      })
      .catch(error => {
        this.logMessage(`Failed to draw oval: ${error}`);
      });
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

  private polarToCartesian(length: number, angle: number): [number, number] {
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
