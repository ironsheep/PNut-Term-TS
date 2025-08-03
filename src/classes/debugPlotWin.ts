/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow } from 'electron';
// src/classes/debugPlotWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './debugColor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { ColorTranslator, ColorMode } from './shared/colorTranslator';
import { LUTManager } from './shared/lutManager';
import { InputForwarder } from './shared/inputForwarder';
import { LayerManager, CropRect } from './shared/layerManager';
import { SpriteManager } from './shared/spriteManager';
import { Spin2NumericParser } from './shared/spin2NumericParser';

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

export class DebugPlotWindow extends DebugWindowBase {
  private displaySpec: PlotDisplaySpec = {} as PlotDisplaySpec;
  private isFirstDisplayData: boolean = true;
  private contentInset: number = 0; // 0 pixels from left and right of window
  // current terminal state
  private deferredCommands: string[] = [];
  private cursorPosition: Position = { x: 0, y: 0 };
  private selectedLutColor: number = 0;
  private font: FontMetrics = {} as FontMetrics;
  private textStyle: TextStyle = {} as TextStyle;
  private origin: Position = { x: 0, y: 0 }; // users are: DOT, LINE, CIRCLE, OVAL, BOX, OBOX
  private canvasOffset: Position = { x: 0, y: 0 };

  private polarConfig: PolarSpec = { twopi: 0x100000000, offset: 0 };
  private cartesianConfig: CartesianSpec = { ydir: false, xdir: false };
  private coordinateMode: eCoordModes = eCoordModes.CM_CARTESIAN; // default to cartesian mode
  private lineSize: number = 1;
  private precise: number = 8; //  Toggle precise mode, where line size and (x,y) for DOT and LINE are expressed in 256ths of a pixel. [0, 8] used as shift value
  private currFgColor: string = '#00FFFF'; // #RRGGBB string
  private currTextColor: string = '#00FFFF'; // #RRGGBB string

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
  private inputForwarder: InputForwarder;
  private layerManager: LayerManager;
  private spriteManager: SpriteManager;
  
  // State for new features
  private opacity: number = 255; // 0-255
  private textAngle: number = 0; // degrees
  private colorMode: ColorMode = ColorMode.RGB24;

  constructor(ctx: Context, displaySpec: PlotDisplaySpec) {
    super(ctx);
    this.windowLogPrefix = 'pltW';
    DebugColor.setDefaultBrightness(15); // set default brightness to max
    // record our Debug Plot Window Spec
    this.displaySpec = displaySpec;
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
    this.inputForwarder = new InputForwarder();
    this.layerManager = new LayerManager();
    this.spriteManager = new SpriteManager();
  }

  private static nextPartIsNumeric(lineParts: string[], index: number): boolean {
    let numericStatus: boolean = false;
    let firstChar: string = lineParts[index + 1].charAt(0);
    // 0-9 or negative sign prefix
    if ((firstChar >= '0' && firstChar <= '9') || firstChar == '-') {
      numericStatus = true;
    }
    return numericStatus;
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

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY', 4);
    const textColor: DebugColor = new DebugColor('CYAN');
    console.log(`CL: at parsePlotDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
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
                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
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

    const windowHeight = canvasHeight + 4 + 4; // +4 add enough to not create vert. scroller
    const windowWidth = canvasWidth + this.contentInset * 2 + 4 + 4; // contentInset' for the Xoffset into window for canvas, +4 add enough to not create horiz. scroller
    this.logMessage(
      `  -- PLOT window size: ${windowWidth}x${windowHeight} @${this.displaySpec.position.x},${this.displaySpec.position.y}`
    );

    // now generate the window with the calculated sizes
    const displayName: string = this.windowTitle;
    this.debugWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: this.displaySpec.position.x,
      y: this.displaySpec.position.y,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // hook window events before being shown
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('* Plot window will show...');
      this.debugWindow?.show();
    });

    this.debugWindow.on('show', () => {
      this.logMessage('* Plot window shown');
    });

    this.debugWindow.on('page-title-updated', () => {
      this.logMessage('* Plot window title updated');
    });

    this.debugWindow.once('ready-to-show', () => {
      this.logMessage('at ready-to-show');
      if (this.debugWindow) {
        // The following only works for linux/windows
        if (process.platform !== 'darwin') {
          try {
            //this.debugWindow.setMenu(null); // NO menu for this window  || NO WORKEE!
            this.debugWindow.removeMenu(); // Alternative to setMenu(null) with less side effects
            //this.debugWindow.setMenuBarVisibility(false); // Alternative to setMenu(null) with less side effects || NO WORKEE!
          } catch (error) {
            this.logMessage(`Failed to remove menu: ${error}`);
          }
        }
        this.debugWindow.show();
      }
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
            display: flex;
            flex-direction: column;
            margin: 0;
            padding: 0;
            font-family: 'Parallax', sans-serif; // was Consolas
            //background-color: ${this.displaySpec.window.background};
            background-color: rgb(140, 52, 130);
          }
          #plot-data {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            flex-shrink: 0;
            padding: 2px;
            /* background-color: rgb(55, 63, 170); // ${this.displaySpec.window.background}; */
            background-color: ${this.displaySpec.window.background};
            width: ${divWidth}px; /* Set a fixed width */
            height: ${divHeight}px; /* Set a fixed height */
          }
          canvas {
            // background-color:rgb(9, 201, 28);
            background-color: ${this.displaySpec.window.background};
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
      this.debugWindow.setMenu(null);
      this.debugWindow.loadURL(`data:text/html,${encodeURIComponent(htmlContent)}`);
    } catch (error) {
      this.logMessage(`Failed to load URL: ${error}`);
    }
    // Menu.setApplicationMenu(null); // DOESNT WORK!

    // now hook load complete event so we can label and paint the grid/min/max, etc.
    this.debugWindow.webContents.on('did-finish-load', () => {
      this.logMessage('at did-finish-load');
      this.setupDoubleBuffering();
    });
  }
  
  private setupDoubleBuffering(): void {
    if (!this.debugWindow) return;
    
    // Create working canvas for double buffering
    this.workingCanvas = new OffscreenCanvas(
      this.displaySpec.size.width,
      this.displaySpec.size.height
    );
    this.workingCtx = this.workingCanvas.getContext('2d') || undefined;
    
    if (this.workingCtx) {
      // Initialize working canvas
      this.canvasRenderer.setupCanvas(this.workingCtx);
      
      // Clear to background color
      const bgColor = this.displaySpec.window.background;
      this.canvasRenderer.clearCanvas(this.workingCtx);
      this.canvasRenderer.fillRect(
        this.workingCtx,
        0, 0,
        this.displaySpec.size.width,
        this.displaySpec.size.height,
        bgColor
      );
    }
  }
  
  private performUpdate(): void {
    if (!this.workingCanvas || !this.debugWindow) return;
    
    this.logMessage('at performUpdate() - copying working canvas to display');
    
    // Convert OffscreenCanvas to blob and then to data URL
    this.workingCanvas.convertToBlob().then(blob => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        
        // Update the display canvas with the working canvas content
        this.debugWindow?.webContents.executeJavaScript(`
          (function() {
            const canvas = document.getElementById('plot-area');
            if (canvas && canvas instanceof HTMLCanvasElement) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const img = new Image();
                img.onload = function() {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0);
                };
                img.src = '${dataUrl}';
              }
            }
          })();
        `);
      };
      reader.readAsDataURL(blob);
    });
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() PLOT`);
    // Stop input forwarding
    this.inputForwarder.stopPolling();
    // let our base class do the work
    this.debugWindow = null;
  }

  public async updateContent(lineParts: string[]): Promise<void> {
    // here with lineParts = ['`{displayName}, ...]
    // Valid directives are:
    //   lut1_to_rgb24 - Set color mode. rgb24
    //
    //   LUTCOLORS <rgb24 rgb24> <...> - For LUT1..LUT8 color modes, load the LUT with rgb24 colors. Use HEX_LONG_ARRAY_ to load values. [default colors 0..7]
    //
    //   BACKCOLOR <color> - Set the background color according to the current color mode. [Default BLACK]
    //
    //   COLOR <color> - Set the drawing color according to the current color mode. Use just before TEXT to change text color. [Default: CYAN]
    //
    //   BLACK/WHITE or ORANGE/BLUE/GREEN/CYAN/RED/MAGENTA/YELLOW/GRAY {brightness}  - Set the drawing color and optional 0..15 brightness for ORANGE..GRAY colors (default is 8).  [Default: CYAN]
    //
    //   OPACITY <level> - Set the opacity level for DOT, LINE, CIRCLE, OVAL, BOX, and OBOX drawing. [0..255 = clear..opaque] [Default: 255]
    //
    //   PRECISE Toggle precise mode, where line size and (x,y) for DOT and LINE are expressed in 256ths of a pixel. disabled
    //
    //   LINESIZE <size> -  Set the line size in pixels for DOT and LINE drawing. [Default: 1]
    //
    //   ORIGIN {x_pos y_pos} Set the origin point to cartesian (x_pos, y_pos) or to the current (x, y) if no values are specified. 0, 0
    //
    //   SET <x> <y> - Set the drawing position to (x, y). After LINE, the endpoint becomes the new drawing position.
    //
    //   DOT {linesize {opacity}} - Draw a dot at the current position with optional LINESIZE and OPACITY overrides.
    //
    //   LINE <x> <y> {linesize {opacity}} - Draw a line from the current position to (x,y) with optional LINESIZE and OPACITY overrides.
    //
    //   CIRCLE <diameter> {linesize {opacity}} - Draw a circle around the current position with optional line size (none/0 = solid) and OPACITY override.
    //
    //   OVAL <width> <height> {linesize {opacity}} - Draw an oval around the current position with optional line size (none/0 = solid) and OPACITY override.
    //
    //   BOX <width> <height> {linesize {opacity}} - Draw a box around the current position with optional line size (none/0 = solid) and OPACITY override..
    //
    //   OBOX <width> <height> <x_radius> <y_radius> {linesize {opacity}} - Draw a rounded box around the current position with width, height, x and y radii,
    //     and optional line size none/0 = solid) and OPACITY override.
    //
    //   TEXTSIZE <size> - Set the text size (6..200). 10
    //
    //   TEXTSTYLE style_YYXXUIWW - Set the text style to %YYXXUIWW:
    //     %YY is vertical justification: %00 = middle, %10 = bottom, %11 = top.
    //     %XX is horizontal justification: %00 = middle, %10 = right, %11 = left.
    //     %U is underline: %1 = underline.
    //     %I is italic: %1 = italic.
    //     %WW is weight: %00 = light, %01 = normal, %10 = bold, and %11 = heavy.
    //     %00000001
    //
    //   TEXTANGLE <angle> - Set the text angle. In cartesian mode, the angle is in degrees. [Default: 0]
    //
    //   TEXT {size {style {angle}}} 'text' - Draw text with overrides for size, style, and angle. To change text color, declare a color just before TEXT.
    //
    //   SPRITEDEF <id> <x_dim> <y_dim> pixels… colors… - Define a sprite. Unique ID must be 0..255. Dimensions must each be 1..32. Pixels are bytes which select
    //     palette colors, ordered left-to-right, then top-to-bottom. Colors are longs which define the palette
    //     referenced by the pixel bytes; $AARRGGBB values specify alpha-blend, red, green, and blue.
    //
    //   SPRITE <id> {orient {scale {opacity}}} - Render a sprite at the current position with orientation, scale, and OPACITY override. Orientation is 0..7,
    //     per the first eight TRACE modes. Scale is 1..64. See the DEBUG_PLOT_Sprites.spin2 file.
    //     <id>, 0, 1, 255
    //
    //   POLAR {twopi {offset}} - Set polar mode, twopi value, and offset. For example, POLAR -12 -3 would be like a clock face.
    //     For a twopi value of $100000000 or -$100000000, use 0 or -1.
    //     In polar mode, (x, y) coordinates are interpreted as (length, angle).
    //     [Default: $100000000, 0]
    //
    //   CARTESIAN {ydir {xdir}} - Set cartesian mode and optionally set Y and X axis polarity. Cartesian mode is the default.
    //     If ydir is 0, the Y axis points up. If ydir is non-0, the Y axis points down.
    //     If xdir is 0, the X axis points right. If xdir is non-0, the X axis points left.
    //     [Default: 0, 0]
    //
    //   CLEAR - Clear the plot to the background color.
    //
    //   UPDATE - Update the window with the current plot. Used in UPDATE mode.
    //
    //   SAVE {WINDOW} 'filename' - Save a bitmap file (.bmp) of either the entire window or just the display area.
    //
    //   CLOSE - Close the window.
    //
    //   *  Color is a modal value, else BLACK / WHITE or ORANGE / BLUE / GREEN / CYAN / RED / MAGENTA / YELLOW / GRAY followed by an optional 0..15 for brightness (default is 8).
    //
    this.logMessage(`---- at updateContent(${lineParts.join(' ')})`);
    // ON first numeric data, create the window! then do update
    for (let index = 1; index < lineParts.length; index++) {
      if (lineParts[index].toUpperCase() == 'SET') {
        // set cursor position
        if (index < lineParts.length - 2) {
          const x: number = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          const y: number = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          this.updatePlotDisplay(`SET ${x} ${y}`);
        } else {
          this.logMessage(`* UPD-ERROR  missing parameters for SET [${lineParts.join(' ')}]`);
        }
      } else if (lineParts[index].toUpperCase() == 'TEXT') {
        // have TEXT {size {style {angle}}} 'text'
        //this.logMessage(`* UPD-INFO  TEXT directive idx=(${index})`);
        let size: number = 10;
        let style: string = '00000001';
        let angle: number = 0;
        if (index < lineParts.length - 1) {
          size = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          if (index < lineParts.length - 1) {
            if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              style = this.formatAs8BitBinary(lineParts[++index]);
              if (index < lineParts.length - 1) {
                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                  angle = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
                }
              }
            }
          }
        }
        this.updatePlotDisplay(`FONT ${size} ${style} ${angle}`);
        // now the text
        const currLinePart = lineParts[++index];
        if (currLinePart.charAt(0) == "'") {
          // display string at cursor position with current colors
          let displayString: string | undefined = undefined;
          // isolate string and display it. Advance index to next part after close quote
          if (currLinePart.substring(1).includes("'")) {
            // string ends in this single linepart
            displayString = currLinePart.substring(1, currLinePart.length - 1);
          } else {
            // this will be a multi-part string
            const stringParts: string[] = [currLinePart.substring(1)];
            while (index < lineParts.length - 1) {
              index++;
              const nextLinePart = lineParts[index];
              if (nextLinePart.includes("'")) {
                // last part of string
                stringParts.push(nextLinePart.substring(0, nextLinePart.length - 1));
                break; // exit loop
              } else {
                stringParts.push(nextLinePart);
              }
            }
            displayString = stringParts.join(' ');
          }
          if (displayString !== undefined) {
            this.updatePlotDisplay(`TEXT '${displayString}'`);
          } else {
            this.logMessage(`* UPD-ERROR  missing closing quote for TEXT [${lineParts.join(' ')}]`);
          }
        }
      } else if (lineParts[index].toUpperCase() == 'LINE') {
        // draw a line: LINE <x> <y> {linesize {opacity}}
        if (index < lineParts.length - 2) {
          const x: number = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          const y: number = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          let lineSize: number = 1;
          let opacity: number = 255;
          if (index < lineParts.length - 1) {
            if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              lineSize = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 1;
              if (index < lineParts.length - 1) {
                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                  opacity = Spin2NumericParser.parseCount(lineParts[++index]) ?? 255;
                }
              }
            }
          }
          this.updatePlotDisplay(`LINE ${x} ${y} ${lineSize} ${opacity}`);
        } else {
          this.logMessage(`* UPD-ERROR  missing parameters for LINE [${lineParts.join(' ')}]`);
        }
      } else if (lineParts[index].toUpperCase() == 'CIRCLE') {
        // draw a circle: CIRCLE <diameter> {linesize {opacity}}
        if (index < lineParts.length - 1) {
          let lineSize: number = 0; // 0 = filled circle
          let opacity: number = 255;
          const diameter: number = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          if (index < lineParts.length - 1) {
            if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              lineSize = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 1;
              if (index < lineParts.length - 1) {
                if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                  opacity = Spin2NumericParser.parseCount(lineParts[++index]) ?? 255;
                }
              }
            }
          }
          this.updatePlotDisplay(`CIRCLE ${diameter} ${lineSize} ${opacity}`);
        } else {
          this.logMessage(`* UPD-ERROR  missing parameters for CIRCLE [${lineParts.join(' ')}]`);
        }
      } else if (lineParts[index].toUpperCase() == 'ORIGIN') {
        // set origin position
        //   iff values are present, set origin to those values
        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
          // have values
          if (index < lineParts.length - 2) {
            this.origin.x = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
            this.origin.y = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
            // calculate canvasOffet for origin
            this.canvasOffset = {
              //x: this.displaySpec.size.width - this.origin.x,
              //y: this.displaySpec.size.height - this.origin.y
              x: this.origin.x,
              y: this.origin.y
            };
          } else {
            this.logMessage(`* UPD-ERROR  missing parameters for ORIGIN [${lineParts.join(' ')}]`);
          }
        } else {
          // no ORIGIN params, so set to cursor position
          this.origin = { x: this.cursorPosition.x, y: this.cursorPosition.y };
          this.canvasOffset = { x: this.origin.x, y: this.origin.y };
        }
      } else if (lineParts[index].toUpperCase() == 'PRECISE') {
        // toggle precise mode
        this.precise = this.precise ^ 8;
      } else if (lineParts[index].toUpperCase() == 'POLAR') {
        // set polar mode
        this.coordinateMode = eCoordModes.CM_POLAR;
        this.polarConfig.twopi = 0x100000000; // default 1
        this.polarConfig.offset = 0; // default 0
        //   iff values are present, set mode to those values
        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
          if (index < lineParts.length - 2) {
            this.polarConfig.twopi = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
            this.polarConfig.offset = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          }
        }
      } else if (lineParts[index].toUpperCase() == 'CARTESIAN') {
        // Set cartesian mode and optionally set Y and X axis polarity.
        //   Cartesian mode is the default.
        this.coordinateMode = eCoordModes.CM_CARTESIAN;
        this.cartesianConfig.xdir = false; // default 0
        this.cartesianConfig.ydir = false; // default 0
        //   iff values are present, set mode to those values
        if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
          if (index < lineParts.length - 2) {
            const yDir: number = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
            const xDir: number = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
            this.cartesianConfig.xdir = xDir == 0 ? false : true;
            this.cartesianConfig.ydir = yDir == 0 ? false : true;
          }
        }
      } else if (lineParts[index].toUpperCase() == 'DOT') {
        // DOT command - draw a dot at current position
        let dotSize = this.lineSize;
        let dotOpacity = this.opacity;
        
        // Parse optional parameters
        if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
          dotSize = Spin2NumericParser.parseCount(lineParts[++index]) ?? 1;
          if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
            dotOpacity = Spin2NumericParser.parseCount(lineParts[++index]) ?? 255;
          }
        }
        
        this.drawDotToPlot(dotSize, dotOpacity);
      } else if (lineParts[index].toUpperCase() == 'BOX') {
        // BOX command - draw filled rectangle
        if (index + 2 < lineParts.length) {
          const width = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          const height = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          let boxLineSize = 0; // 0 = filled
          let boxOpacity = this.opacity;
          
          // Parse optional parameters
          if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
            boxLineSize = Spin2NumericParser.parseCount(lineParts[++index]) ?? 0;
            if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              boxOpacity = Spin2NumericParser.parseCount(lineParts[++index]) ?? 255;
            }
          }
          
          this.drawBoxToPlot(width, height, boxLineSize, boxOpacity);
        }
      } else if (lineParts[index].toUpperCase() == 'OBOX') {
        // OBOX command - draw outlined rectangle
        if (index + 2 < lineParts.length) {
          const width = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          const height = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          let boxLineSize = this.lineSize;
          let boxOpacity = this.opacity;
          
          // Parse optional parameters
          if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
            boxLineSize = Spin2NumericParser.parseCount(lineParts[++index]) ?? 0;
            if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              boxOpacity = Spin2NumericParser.parseCount(lineParts[++index]) ?? 255;
            }
          }
          
          this.drawBoxToPlot(width, height, boxLineSize, boxOpacity);
        }
      } else if (lineParts[index].toUpperCase() == 'OVAL') {
        // OVAL command - draw ellipse
        if (index + 2 < lineParts.length) {
          const width = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          const height = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          let ovalLineSize = 0; // 0 = filled
          let ovalOpacity = this.opacity;
          
          // Parse optional parameters
          if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
            ovalLineSize = Spin2NumericParser.parseCount(lineParts[++index]) ?? 0;
            if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              ovalOpacity = Spin2NumericParser.parseCount(lineParts[++index]) ?? 255;
            }
          }
          
          this.drawOvalToPlot(width, height, ovalLineSize, ovalOpacity);
        }
      } else if (lineParts[index].toUpperCase() == 'UPDATE') {
        // UPDATE command - copy working canvas to display
        this.performUpdate();
      } else if (lineParts[index].toUpperCase() == 'LAYER') {
        // LAYER command - load bitmap into layer
        if (index + 2 < lineParts.length) {
          const layerIndex = (Spin2NumericParser.parseCount(lineParts[++index]) ?? 1) - 1; // Convert 1-8 to 0-7
          const filename = lineParts[++index];
          
          if (layerIndex >= 0 && layerIndex < 8) {
            // Validate file extension
            const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
            const supportedFormats = ['.bmp', '.png', '.jpg', '.jpeg', '.gif'];
            
            if (supportedFormats.includes(ext)) {
              this.layerManager.loadLayer(layerIndex, filename)
                .then(() => {
                  this.logMessage(`  -- Loaded layer ${layerIndex + 1} from ${filename}`);
                })
                .catch(error => {
                  this.logMessage(`  -- Error loading layer: ${error.message}`);
                });
            } else {
              this.logMessage(`  -- Unsupported file format: ${ext}`);
            }
          } else {
            this.logMessage(`  -- Invalid layer index: ${layerIndex + 1} (must be 1-8)`);
          }
        } else {
          this.logMessage(`  -- LAYER command requires layer index and filename`);
        }
      } else if (lineParts[index].toUpperCase() == 'CROP') {
        // CROP command - draw layer with optional cropping
        if (index + 1 < lineParts.length) {
          const layerIndex = (Spin2NumericParser.parseCount(lineParts[++index]) ?? 1) - 1; // Convert 1-8 to 0-7
          
          if (layerIndex >= 0 && layerIndex < 8 && this.layerManager.isLayerLoaded(layerIndex)) {
            if (index + 1 < lineParts.length && lineParts[index + 1].toUpperCase() === 'AUTO') {
              // AUTO mode - draw full layer at specified position
              index++; // Skip 'AUTO'
              let destX = 0;
              let destY = 0;
              
              if (index + 1 < lineParts.length) {
                destX = Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0;
              }
              if (index + 1 < lineParts.length) {
                destY = Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0;
              }
              
              if (this.workingCtx) {
                try {
                  this.layerManager.drawLayerToCanvas(this.workingCtx, layerIndex, null, destX, destY);
                  this.logMessage(`  -- Drew layer ${layerIndex + 1} in AUTO mode at (${destX}, ${destY})`);
                } catch (error: any) {
                  this.logMessage(`  -- Error drawing layer: ${error.message}`);
                }
              }
            } else if (index + 4 < lineParts.length) {
              // Manual crop mode - requires left, top, width, height
              const cropRect: CropRect = {
                left: Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0,
                top: Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0,
                width: Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0,
                height: Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0
              };
              
              let destX = 0;
              let destY = 0;
              
              // Optional destination coordinates
              if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                destX = Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0;
              }
              if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
                destY = Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0;
              }
              
              if (this.workingCtx) {
                try {
                  this.layerManager.drawLayerToCanvas(this.workingCtx, layerIndex, cropRect, destX, destY);
                  this.logMessage(`  -- Drew layer ${layerIndex + 1} cropped (${cropRect.left},${cropRect.top},${cropRect.width},${cropRect.height}) at (${destX}, ${destY})`);
                } catch (error: any) {
                  this.logMessage(`  -- Error drawing layer: ${error.message}`);
                }
              }
            } else {
              this.logMessage(`  -- CROP command requires layer index and either AUTO or crop parameters`);
            }
          } else {
            this.logMessage(`  -- Layer ${layerIndex + 1} is not loaded or invalid`);
          }
        } else {
          this.logMessage(`  -- CROP command requires layer index`);
        }
      } else if (lineParts[index].toUpperCase() == 'CLEAR') {
        // clear window
        this.updatePlotDisplay(`CLEAR`);
      } else if (lineParts[index].toUpperCase() == 'CLOSE') {
        // request window close
        // NOPE this is immediate! this.updatePlotDisplay(`CLOSE`);
        this.logMessage(`  -- Closing window!`);
        this.closeDebugWindow();
      } else if (lineParts[index].toUpperCase() == 'SAVE') {
        // FIXME: UNDONE we need to wait for prior UPDATE to complete!
        if (index + 1 < lineParts.length) {
          // FIXME: this does not handle spaces in the filename
          const saveFileName = this.removeStringQuotes(lineParts[++index]);
          // save the window to a file (as BMP)
          await this.saveWindowToBMPFilename(saveFileName);
        } else {
          this.logMessage(`at updateContent() missing SAVE fileName in [${lineParts.join(' ')}]`);
        }
      } else if (lineParts[index].toUpperCase() == 'LINESIZE') {
        // Set line size
        if (index + 1 < lineParts.length) {
          this.lineSize = Spin2NumericParser.parseCount(lineParts[++index]) ?? 1;
          this.logMessage(`  -- LINESIZE set to ${this.lineSize}`);
        }
      } else if (lineParts[index].toUpperCase() == 'OPACITY') {
        // Set opacity (0-255)
        if (index + 1 < lineParts.length) {
          this.opacity = Math.max(0, Math.min(255, Spin2NumericParser.parseCount(lineParts[++index]) ?? 255));
          this.logMessage(`  -- OPACITY set to ${this.opacity}`);
        }
      } else if (lineParts[index].toUpperCase() == 'TEXTANGLE') {
        // Set text angle in degrees
        if (index + 1 < lineParts.length) {
          this.textAngle = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 0;
          this.logMessage(`  -- TEXTANGLE set to ${this.textAngle} degrees`);
        }
      } else if (lineParts[index].toUpperCase() == 'LUTCOLORS') {
        // Load LUT colors
        this.logMessage(`  -- LUTCOLORS loading palette`);
        let colorIndex = 0;
        index++; // Move past LUTCOLORS
        while (index < lineParts.length) {
          const colorStr = lineParts[index];
          let colorValue: number | null = null;
          
          // Parse color value using Spin2NumericParser (handles $hex, %binary, %%quaternary, and decimal)
          colorValue = Spin2NumericParser.parseColor(colorStr);
          
          if (colorValue !== null && !isNaN(colorValue)) {
            this.lutManager.setColor(colorIndex++, colorValue);
            if (colorIndex >= 256) break; // Max LUT size
          }
          index++;
        }
        // Update color translator with new palette
        this.colorTranslator.setLutPalette(this.lutManager.getPalette());
        this.logMessage(`  -- Loaded ${colorIndex} colors into LUT`);
        index--; // Back up one since the loop will increment
      } else if (lineParts[index].toUpperCase() == 'SPRITEDEF') {
        // SPRITEDEF command - define a sprite
        if (index + 3 < lineParts.length) {
          const spriteId = Spin2NumericParser.parseCount(lineParts[++index]) ?? 0;
          const width = Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0;
          const height = Spin2NumericParser.parsePixel(lineParts[++index]) ?? 0;
          
          if (!isNaN(spriteId) && !isNaN(width) && !isNaN(height)) {
            const pixelCount = width * height;
            const pixels: number[] = [];
            const colors: number[] = [];
            
            // Parse pixel data
            for (let i = 0; i < pixelCount && index + 1 < lineParts.length; i++) {
              const pixelValue = Spin2NumericParser.parseColor(lineParts[++index]) ?? 0;
              if (!isNaN(pixelValue)) {
                pixels.push(pixelValue);
              } else {
                this.logMessage(`  -- Invalid pixel value at position ${i}`);
                break;
              }
            }
            
            // Parse color palette (256 colors)
            for (let i = 0; i < 256 && index + 1 < lineParts.length; i++) {
              let colorValue: number | null = null;
              const colorStr = lineParts[++index];
              
              // Parse color value (handles $hex, %binary, and decimal)
              if (colorStr.startsWith('$')) {
                colorValue = parseInt(colorStr.substring(1), 16);
              } else if (colorStr.startsWith('%')) {
                colorValue = parseInt(colorStr.substring(1), 2);
              } else if (/^-?\d+$/.test(colorStr)) {
                colorValue = parseInt(colorStr);
              }
              
              if (colorValue !== null && !isNaN(colorValue)) {
                colors.push(colorValue);
              } else {
                this.logMessage(`  -- Invalid color value at position ${i}`);
                break;
              }
            }
            
            // Validate we got all required data
            if (pixels.length === pixelCount && colors.length === 256) {
              try {
                this.spriteManager.defineSprite(spriteId, width, height, pixels, colors);
                this.logMessage(`  -- Defined sprite ${spriteId} (${width}x${height})`);
              } catch (error: any) {
                this.logMessage(`  -- Error defining sprite: ${error.message}`);
              }
            } else {
              this.logMessage(`  -- Incomplete sprite data: got ${pixels.length}/${pixelCount} pixels and ${colors.length}/256 colors`);
            }
          } else {
            this.logMessage(`  -- Invalid sprite parameters`);
          }
        } else {
          this.logMessage(`  -- SPRITEDEF requires id, width, and height`);
        }
      } else if (lineParts[index].toUpperCase() == 'SPRITE') {
        // SPRITE command - draw a sprite
        if (index + 1 < lineParts.length) {
          const spriteId = Spin2NumericParser.parseCount(lineParts[++index]) ?? 0;
          
          if (!isNaN(spriteId)) {
            // Parse optional parameters
            let orientation = 0;
            let scale = 1.0;
            let opacity = 255;
            
            if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              orientation = Spin2NumericParser.parseCount(lineParts[++index]) ?? 0;
            }
            
            if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              const scaleValue = Spin2NumericParser.parseCoordinate(lineParts[++index]) ?? 1;
              if (!isNaN(scaleValue)) {
                scale = scaleValue;
              }
            }
            
            if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
              opacity = Spin2NumericParser.parseCount(lineParts[++index]) ?? 255;
            }
            
            // Draw sprite at current cursor position
            if (this.workingCtx && this.spriteManager.isSpriteDefine(spriteId)) {
              try {
                this.spriteManager.drawSprite(
                  this.workingCtx,
                  spriteId,
                  this.cursorPosition.x,
                  this.cursorPosition.y,
                  orientation,
                  scale,
                  opacity
                );
                this.logMessage(`  -- Drew sprite ${spriteId} at (${this.cursorPosition.x}, ${this.cursorPosition.y}) with orientation=${orientation}, scale=${scale}, opacity=${opacity}`);
              } catch (error: any) {
                this.logMessage(`  -- Error drawing sprite: ${error.message}`);
              }
            } else {
              this.logMessage(`  -- Sprite ${spriteId} is not defined`);
            }
          } else {
            this.logMessage(`  -- Invalid sprite ID`);
          }
        } else {
          this.logMessage(`  -- SPRITE requires sprite ID`);
        }
      } else if (this.isColorModeCommand(lineParts[index])) {
        // Color mode commands (LUT1, RGB24, etc.)
        const colorModeStr = lineParts[index].toUpperCase();
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
        
        if (colorModeStr in colorModeMap) {
          this.colorMode = colorModeMap[colorModeStr];
          this.colorTranslator.setColorMode(this.colorMode);
          this.logMessage(`  -- Color mode set to ${colorModeStr}`);
          
          // Check for tune parameter
          if (index + 1 < lineParts.length && DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
            const tune = (Spin2NumericParser.parseCount(lineParts[++index]) ?? 0) & 0x7;
            this.colorTranslator.setTune(tune);
            this.logMessage(`  -- Color tune set to ${tune}`);
          }
        }
      } else if (lineParts[index].toUpperCase() == 'PC_KEY') {
        // Enable keyboard input forwarding
        this.enableKeyboardInput();
      } else if (lineParts[index].toUpperCase() == 'PC_MOUSE') {
        // Enable mouse input forwarding
        this.enableMouseInput();
      } else if (DebugColor.isValidColorName(lineParts[index])) {
        // set color
        const colorName: string = lineParts[index];
        let colorBrightness: number = 15; // default 15 for plot?
        if (index < lineParts.length - 1) {
          if (DebugPlotWindow.nextPartIsNumeric(lineParts, index)) {
            colorBrightness = Number(lineParts[++index]);
          }
        }
        this.logMessage(`* UPD-INFO index(${index}) is [${lineParts[index]}]`);
        const namedColor = new DebugColor(colorName, colorBrightness);
        // look ahead to see if next directive is TEXT
        let isTextColor: boolean = false;
        if (index + 1 < lineParts.length && lineParts[index + 1].toUpperCase() == 'TEXT') {
          isTextColor = true;
        }
        // emit the directive we need
        if (isTextColor) {
          this.updatePlotDisplay(`TEXTCOLOR ${namedColor.rgbString}`);
        } else {
          this.updatePlotDisplay(`COLOR ${namedColor.rgbString}`);
        }
      } else {
        this.logMessage(`* UPD-ERROR  unknown directive: [${lineParts[1]}] of [${lineParts.join(' ')}]`);
      }
    }
  }

  private formatAs8BitBinary(value: string): string {
    // Parse the integer from the string
    const intValue = parseInt(value, 10);

    // Ensure the value is between 0 and 255
    if (intValue < 0 || intValue > 255) {
      throw new Error('Value must be between 0 and 255');
    }

    // Convert the integer to a binary string
    const binaryString = intValue.toString(2);

    // Pad the binary string with leading zeros to ensure it is 8 characters long
    const paddedBinaryString = binaryString.padStart(8, '0');

    return paddedBinaryString;
  }

  private updatePlotDisplay(text: string): void {
    // add action to our display list
    this.logMessage(`* updatePlotDisplay(${text})`);
    this.deferredCommands.push(text);
    // create window if not already
    if (this.isFirstDisplayData) {
      this.isFirstDisplayData = false;
      this.createDebugWindow();
    }
    // if not deferred update the act on display list now
    if (this.displaySpec.delayedUpdate == false) {
      // act on display list now
      this.pushDisplayListToPlot();
    }
  }

  private clearCount: number = 2;

  private pushDisplayListToPlot() {
    if (this.shouldWriteToCanvas) {
      if (this.deferredCommands.length > 0) {
        // act on display list now
        // possible values are:
        //  CLEAR
        //  SET x y
        //  COLOR #rrggbb
        //  TEXTCOLOR #rrggbb
        //  FONT size style[8chars] angle
        //  TEXT 'string'
        //  LINE x y linesize opacity
        //  CIRCLE diameter linesize opacity - Where linesize 0 = filled circle
        this.deferredCommands.forEach((displayString) => {
          this.logMessage(`* PUSH-INFO displayString: [${displayString}]`);
          const lineParts: string[] = displayString.split(' ');
          if (displayString.startsWith('TEXT ')) {
            const message: string = displayString.substring(6, displayString.length - 1);
            this.writeStringToPlot(message);
          } else if (lineParts[0] == 'CLEAR') {
            // clear the output window so we can draw anew
            this.clearPlot();
            if (this.clearCount > 0) {
              this.clearCount--;
              if (this.clearCount == 0) {
                //this.shouldWriteToCanvas = false; // XYZZY
              }
            }
          } else if (lineParts[0] == 'SET') {
            // set new drawing cursor position relative to origin
            if (lineParts.length == 3) {
              let setX: number = parseFloat(lineParts[1]);
              let setY: number = parseFloat(lineParts[2]);
              // if polar mode, convert to cartesian
              if (this.coordinateMode == eCoordModes.CM_POLAR) {
                [this.cursorPosition.x, this.cursorPosition.y] = this.polarToCartesian(setX, setY);
              } else {
                this.cursorPosition.x = setX;
                this.cursorPosition.y = setY;
              }
              this.logMessage(
                `* PUSH-INFO  SET cursorPosition (${setX},${setY}) -> (${this.cursorPosition.x}, ${this.cursorPosition.y})`
              );
            } else {
              this.logMessage(`* PUSH-ERROR  BAD parameters for SET [${displayString}]`);
            }
          } else if (lineParts[0] == 'COLOR') {
            if (lineParts.length == 2) {
              this.currFgColor = lineParts[1];
            } else {
              this.logMessage(`* PUSH-ERROR  BAD parameters for COLOR [${displayString}]`);
            }
          } else if (lineParts[0] == 'TEXTCOLOR') {
            if (lineParts.length == 2) {
              this.currTextColor = lineParts[1];
            } else {
              this.logMessage(`* PUSH-ERROR  BAD parameters for TEXTCOLOR [${displayString}]`);
            }
          } else if (lineParts[0] == 'CIRCLE') {
            if (lineParts.length == 4) {
              const diameter: number = parseFloat(lineParts[1]);
              const lineSize: number = parseFloat(lineParts[2]);
              const opacity: number = parseFloat(lineParts[3]);
              this.drawCircleToPlot(diameter, lineSize, opacity);
            } else {
              this.logMessage(`* PUSH-ERROR  BAD parameters for CIRCLE [${displayString}]`);
            }
          } else if (lineParts[0] == 'LINE') {
            if (lineParts.length == 5) {
              const x: number = parseFloat(lineParts[1]);
              const y: number = parseFloat(lineParts[2]);
              const lineSize: number = parseFloat(lineParts[3]);
              const opacity: number = parseFloat(lineParts[4]);
              this.drawLineToPlot(x, y, lineSize, opacity);
            } else {
              this.logMessage(`* PUSH-ERROR  BAD parameters for LINE [${displayString}]`);
            }
          } else if (lineParts[0] == 'FONT') {
            if (lineParts.length == 4) {
              const size: number = parseFloat(lineParts[1]);
              const styleStr: string = lineParts[2];
              let style: number = 0;
              if (styleStr.startsWith('%')) {
                // has binary prefix!
                style = parseInt(styleStr.substring(1), 2); // binary
              } else {
                style = parseInt(styleStr, 10); // decimal
              }
              const angle: number = parseFloat(lineParts[3]);
              this.setFontMetrics(size, style, angle, this.font, this.textStyle);
            } else {
              this.logMessage(`* PUSH-ERROR  BAD parameters for FONT [${displayString}]`);
            }
          } else {
            this.logMessage(`* PUSH-ERROR unknown directive: ${displayString}`);
          }
        });
      }
      this.deferredCommands = []; // all done, empty the list
    }
  }

  private setFontMetrics(size: number, style: number, angle: number, font: FontMetrics, textStyle: TextStyle): void {
    DebugPlotWindow.calcMetricsForFontPtSize(size, font);
    // now configure style and angle
    DebugPlotWindow.calcStyleFromBitfield(style, textStyle);
    textStyle.angle = angle;
  }

  private clearPlot(): void {
    // erase the  display area
    this.clearPlotCanvas();
    // home the cursorPosition
    this.cursorPosition = { x: 0, y: 0 };
  }

  // -----------------------------------------------------------
  // ----------------- Canvas Drawing Routines -----------------
  //
  private clearPlotCanvas(): void {
    if (this.workingCtx) {
      this.logMessage(`at clearPlot()`);
      const bgcolor: string = this.displaySpec.window.background;
      this.logMessage(`  -- bgcolor=[${bgcolor}]`);
      
      // Clear the working canvas
      this.canvasRenderer.clearCanvas(this.workingCtx);
      this.canvasRenderer.fillRect(
        this.workingCtx,
        0, 0,
        this.displaySpec.size.width,
        this.displaySpec.size.height,
        bgcolor
      );
    }
  }

  private drawLineToPlot(x: number, y: number, lineSize: number, opacity: number): void {
    if (this.workingCtx) {
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

      // Save current state
      const savedAlpha = this.workingCtx.globalAlpha;
      
      // Set opacity
      this.canvasRenderer.setOpacity(this.workingCtx, opacity);
      
      // Draw the line
      this.canvasRenderer.drawLineCtx(
        this.workingCtx,
        plotFmCoordX,
        plotFmCoordY,
        plotToCoordX,
        plotToCoordY,
        fgColor,
        lineSize
      );
      
      // Restore alpha
      this.workingCtx.globalAlpha = savedAlpha;
    }
  }

  private drawCircleToPlot(diameter: number, lineSize: number, opacity: number): void {
    if (this.workingCtx) {
      const fgColor: string = this.currFgColor;
      const [plotCoordX, plotCoordY] = this.getCursorXY();
      const opacityString: string = opacity == 255 ? 'opaque' : opacity == 0 ? 'clear' : opacity.toString();
      const lineSizeString: string = lineSize == 0 ? 'filled' : lineSize.toString();
      this.logMessage(
        `at drawCircleToPlot(${diameter}, ${lineSizeString}, ${opacityString}) color=[${fgColor}] center @(${plotCoordX},${plotCoordY})`
      );
      this.logMessage(`  -- diameter=(${diameter}) color=[${fgColor}]`);

      // Save current state
      const savedAlpha = this.workingCtx.globalAlpha;
      
      // Set opacity
      this.canvasRenderer.setOpacity(this.workingCtx, opacity);
      
      // Draw the circle
      this.canvasRenderer.drawCircleCtx(
        this.workingCtx,
        plotCoordX,
        plotCoordY,
        diameter / 2,
        fgColor,
        lineSize === 0, // filled if lineSize is 0
        lineSize
      );
      
      // Restore alpha
      this.workingCtx.globalAlpha = savedAlpha;
    }
  }

  private writeStringToPlot(text: string): void {
    if (this.workingCtx) {
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
      let xPos = textXOffset;
      const fontFullSpec = `${fontStyle}${fontWeight} ${this.font.textSizePts}pt Consolas, sans-serif`;
      
      if (alignHCenter || alignHRight) {
        // We need to measure text width for alignment
        this.workingCtx.save();
        this.workingCtx.font = fontFullSpec;
        const textWidth = this.workingCtx.measureText(text).width;
        if (alignHCenter) {
          xPos -= textWidth / 2;
        } else if (alignHRight) {
          xPos -= textWidth;
        }
        this.workingCtx.restore();
      }

      // Check if we need rotated text
      if (this.textAngle !== 0) {
        this.canvasRenderer.drawRotatedText(
          this.workingCtx,
          text,
          xPos,
          adjYBaseline,
          this.textAngle,
          textColor,
          fontSize + 'pt',
          'Consolas, sans-serif'
        );
      } else {
        // Regular text drawing
        this.canvasRenderer.drawTextCtx(
          this.workingCtx,
          text,
          xPos,
          adjYBaseline,
          textColor,
          fontSize + 'pt',
          'Consolas, sans-serif',
          'left',
          'alphabetic'
        );
      }
    }
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
    // calculate x,y based on Curor Position, CartesianSpec scale inversions, screen size, and ORIGIN
    // used by OBOX, BOX, OVAL, CIRCLE, TEXT, and SPRITE
    let newX: number;
    let newY: number;
    if (this.cartesianConfig.xdir) {
      newX = this.displaySpec.size.width - 1 - this.origin.x - x;
    } else {
      newX = this.origin.x + x;
    }
    if (this.cartesianConfig.ydir) {
      newY = this.origin.y + y;
    } else {
      newY = this.displaySpec.size.height - 1 - this.origin.y - y;
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
    if (this.workingCtx) {
      const [plotCoordX, plotCoordY] = this.getCursorXY();
      const fgColor = this.currFgColor;
      
      this.logMessage(`at drawDotToPlot(${dotSize}, ${opacity}) @(${plotCoordX},${plotCoordY})`);
      
      // Save current state
      const savedAlpha = this.workingCtx.globalAlpha;
      
      // Set opacity
      this.canvasRenderer.setOpacity(this.workingCtx, opacity);
      
      // Draw dot as a scaled pixel or small circle
      if (dotSize <= 1) {
        this.canvasRenderer.plotPixelCtx(this.workingCtx, plotCoordX, plotCoordY, fgColor);
      } else {
        this.canvasRenderer.drawCircleCtx(
          this.workingCtx,
          plotCoordX,
          plotCoordY,
          dotSize / 2,
          fgColor,
          true, // filled
          0
        );
      }
      
      // Restore alpha
      this.workingCtx.globalAlpha = savedAlpha;
    }
  }
  
  private drawBoxToPlot(width: number, height: number, lineSize: number, opacity: number): void {
    if (this.workingCtx) {
      const [plotCoordX, plotCoordY] = this.getCursorXY();
      const fgColor = this.currFgColor;
      
      this.logMessage(`at drawBoxToPlot(${width}x${height}, line:${lineSize}, op:${opacity}) @(${plotCoordX},${plotCoordY})`);
      
      // Save current state
      const savedAlpha = this.workingCtx.globalAlpha;
      
      // Set opacity
      this.canvasRenderer.setOpacity(this.workingCtx, opacity);
      
      // Calculate rectangle bounds (centered on cursor)
      const x1 = plotCoordX - width / 2;
      const y1 = plotCoordY - height / 2;
      const x2 = plotCoordX + width / 2;
      const y2 = plotCoordY + height / 2;
      
      // Draw rectangle (filled if lineSize is 0)
      this.canvasRenderer.drawRect(
        this.workingCtx,
        x1, y1, x2, y2,
        lineSize === 0, // filled if lineSize is 0
        fgColor,
        lineSize
      );
      
      // Restore alpha
      this.workingCtx.globalAlpha = savedAlpha;
    }
  }
  
  private drawOvalToPlot(width: number, height: number, lineSize: number, opacity: number): void {
    if (this.workingCtx) {
      const [plotCoordX, plotCoordY] = this.getCursorXY();
      const fgColor = this.currFgColor;
      
      this.logMessage(`at drawOvalToPlot(${width}x${height}, line:${lineSize}, op:${opacity}) @(${plotCoordX},${plotCoordY})`);
      
      // Save current state
      const savedAlpha = this.workingCtx.globalAlpha;
      
      // Set opacity
      this.canvasRenderer.setOpacity(this.workingCtx, opacity);
      
      // Draw oval (filled if lineSize is 0)
      this.canvasRenderer.drawOval(
        this.workingCtx,
        plotCoordX,
        plotCoordY,
        width / 2,  // rx
        height / 2, // ry
        lineSize === 0, // filled if lineSize is 0
        fgColor,
        lineSize
      );
      
      // Restore alpha
      this.workingCtx.globalAlpha = savedAlpha;
    }
  }
  
  private enableKeyboardInput(): void {
    this.logMessage('Enabling keyboard input forwarding');
    this.inputForwarder.startPolling();
    
    // Set up keyboard event handlers in the window
    if (this.debugWindow) {
      this.debugWindow.webContents.executeJavaScript(`
        document.addEventListener('keydown', (event) => {
          // Send key event to main process
          if (window.electronAPI && window.electronAPI.sendKeyEvent) {
            window.electronAPI.sendKeyEvent(event.key, event.keyCode, event.shiftKey, event.ctrlKey, event.altKey);
          }
          event.preventDefault();
        });
      `);
    }
  }
  
  private enableMouseInput(): void {
    this.logMessage('Enabling mouse input forwarding');
    this.inputForwarder.startPolling();
    
    // Set window dimensions for coordinate calculation
    this.inputForwarder.setWindowDimensions(
      this.displaySpec.size.width,
      this.displaySpec.size.height
    );
    
    // Set up mouse event handlers in the window
    if (this.debugWindow) {
      this.debugWindow.webContents.executeJavaScript(`
        const canvas = document.getElementById('plot-area');
        if (canvas) {
          canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            if (window.electronAPI && window.electronAPI.sendMouseEvent) {
              window.electronAPI.sendMouseEvent(x, y, event.buttons, 0);
            }
          });
          
          canvas.addEventListener('wheel', (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const delta = Math.sign(event.deltaY);
            if (window.electronAPI && window.electronAPI.sendMouseEvent) {
              window.electronAPI.sendMouseEvent(x, y, event.buttons, delta);
            }
            event.preventDefault();
          });
        }
      `);
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
}
