/** @format */

/**
 * Debug Terminal Window Implementation
 *
 * Pascal source reference:
 * /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 *
 * This TypeScript implementation is derived from the Pascal TERM window
 * implementation and should maintain functional parity with the original.
 */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow } from 'electron';
// src/classes/debugTermWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './shared/debugColor';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { CanvasRenderer } from './shared/canvasRenderer';

import { DebugWindowBase, FontMetrics, Position, Size, WindowColor } from './debugWindowBase';
import { waitMSec } from '../utils/timerUtils';
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';

export interface TermSize {
  columns: number;
  rows: number;
}
export interface ColorCombo {
  fgcolor: string;
  bgcolor: string;
}
export interface TermDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  position: Position;
  hasExplicitPosition: boolean; // true if POS clause was in original message
  size: TermSize;
  font: FontMetrics;
  window: WindowColor;
  textColor: string;
  colorCombos: ColorCombo[];
  delayedUpdate: boolean;
  hideXY: boolean;
}

/**
 * Debug TERM Window - Text Terminal Display
 * 
 * A monospace text terminal for displaying debug output from Propeller 2 microcontrollers.
 * This implementation follows the Pascal PNut design, repurposing ASCII control characters
 * for debug-specific functions rather than standard terminal emulation.
 * 
 * ## Features
 * - **Monospace Text Display**: Fixed-width character grid with configurable size
 * - **Color Combinations**: Up to 4 foreground/background color pairs (combos 0-3)
 * - **Cursor Control**: Direct positioning, home, backspace, and tab support
 * - **Auto-scrolling**: Automatic scroll when text reaches bottom of display
 * - **Mouse/Keyboard Forwarding**: PC_KEY and PC_MOUSE input forwarding to P2
 * 
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE columns rows` - Set terminal size in characters (1-256, default: 40x20)
 * - `TEXTSIZE half-pix` - Set font size (6-200, default: editor font size)
 * - `COLOR fg bg {fg1 bg1 {fg2 bg2 {fg3 bg3}}}` - Define color combos (default: ORANGE on BLACK)
 * - `BACKCOLOR color {brightness}` - Set default text color (deprecated, use COLOR)
 * - `UPDATE` - Enable deferred update mode (requires UPDATE command)
 * - `HIDEXY` - Hide mouse coordinate display
 * 
 * ## Data Format
 * Data is fed as numeric control codes or quoted strings:
 * - Numeric values 0-31: Control codes for cursor and color management
 * - Numeric values 32-255: Direct character codes
 * - Quoted strings: Text to display at current cursor position
 * - Example: `debug(\`Term 0 'Hello' 13 10 'World')`
 * 
 * ## Commands
 * - `0` - Clear screen and home cursor
 * - `1` - Home cursor only
 * - `2 column` - Set cursor column (0-based)
 * - `3 row` - Set cursor row (0-based)
 * - `4-7` - Select color combo 0-3
 * - `8` - Backspace (with line wrap)
 * - `9` - Tab to next 8-column boundary
 * - `10` or `13` - Line feed/carriage return
 * - `32-255` - Display character at cursor
 * - `'string'` - Display string at cursor
 * - `CLEAR` - Clear terminal display
 * - `UPDATE` - Force display update (when UPDATE directive used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding
 * - `PC_MOUSE` - Enable mouse input forwarding
 * 
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `TERM_Configure` procedure (line 2181)
 * - Update: `TERM_Update` procedure (line 2223)
 * - Character handling: `TERM_Chr` procedure
 * 
 * ## Examples
 * ```spin2
 * ' Basic terminal output
 * debug(`TERM MyTerm SIZE 80 24 'Hello, World!')
 * 
 * ' Using color combos
 * debug(`TERM MyTerm COLOR WHITE BLACK RED YELLOW)
 * debug(`MyTerm 4 'Default' 5 ' Red on Yellow')
 * ```
 * 
 * ## Implementation Notes
 * - Tab width is fixed at 8 columns
 * - Line wrapping occurs at column boundary
 * - Scrolling preserves current color combo for cleared lines
 * 
 * ## Deviations from Pascal
 * - **No ANSI Support**: ANSI escape sequences removed to match Pascal implementation
 * - **ASCII 7 Repurposed**: BELL character (ASCII 7) selects color combo 3, not audio bell
 * - **Color Combo Limit**: Limited to 4 color combinations (Pascal design)
 * 
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_TERM.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugTermWindow extends DebugWindowBase {
  private displaySpec: TermDisplaySpec = {} as TermDisplaySpec;
  private isFirstDisplayData: boolean = true;
  private contentInset: number = 0; // No inset since canvas fills the window
  private borderMargin: number = 10; // 10 pixels all around
  // current terminal state
  private deferredCommands: string[] = [];
  private cursorPosition: Position = { x: 0, y: 0 };
  private selectedCombo: number = 0;
  private canvasRenderer: CanvasRenderer = new CanvasRenderer();
  private offscreenCanvasInitialized: boolean = false;

  constructor(ctx: Context, displaySpec: TermDisplaySpec, windowId?: string) {
    // Use the user-provided display name as the window ID for proper routing
    const actualWindowId = windowId || displaySpec.displayName;
    super(ctx, actualWindowId, 'terminal');
    this.windowLogPrefix = 'trmW';
    // record our Debug Term Window Spec
    this.displaySpec = displaySpec;
    // adjust our contentInset for font size
    // Keep contentInset at 0 for full canvas usage
    // this.contentInset = this.displaySpec.font.charWidth / 2;
    
    // CRITICAL FIX: Create window immediately, don't wait for data
    // This ensures windows appear when created, even if closed before data arrives
    this.logMessage('Creating TERM window immediately in constructor');
    this.createDebugWindow();
    
    // CRITICAL: Mark window as ready to process messages
    // Without this, all messages get queued instead of processed immediately
    this.onWindowReady();
  }

  get windowTitle(): string {
    let desiredValue: string = `${this.displaySpec.displayName} TERM`;
    if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
      desiredValue = this.displaySpec.windowTitle;
    }
    return desiredValue;
  }

  /**
   * Calculate font metrics specifically for terminal windows
   * Pascal sets Font.Size = TEXTSIZE and measures the actual rendered character
   */
  private static calcTerminalFontMetrics(fontSize: number, metrics: FontMetrics): void {
    // In Pascal: Font.Size := vTextSize (in points)
    // Then measures actual TextHeight('X') and TextWidth('X')
    // At 96 DPI, point to pixel conversion is: pixels = points * 96/72

    // TEXTSIZE is the font size in points (matching Pascal)
    metrics.textSizePts = fontSize;

    // Convert points to pixels at 96 DPI (standard screen DPI)
    // TextHeight('X') doesn't include descenders, but we need room for them
    // Add about 25% more height for descender space
    metrics.charHeight = Math.round(fontSize * 96 / 72 * 1.25);

    // Monospace width is typically 60% of the base height (not including descender extra)
    // This approximates Pascal's TextWidth('X')
    metrics.charWidth = Math.round((fontSize * 96 / 72) * 0.6);

    // Line height equals character height for terminal (includes descender space)
    metrics.lineHeight = metrics.charHeight;

    // Baseline is typically 80% down from top of character cell
    metrics.baseline = Math.round(metrics.charHeight * 0.8);
  }

  static parseTermDeclaration(lineParts: string[]): [boolean, TermDisplaySpec] {
    // here with lineParts = ['`TERM', {displayName}, ...]
    // Valid directives are:
    //   TITLE <title>
    //   POS <left> <top> [default: 0, 0]
    //   SIZE <columns> <rows> [default: 40, 20]
    //   TEXTSIZE <half-pix> [6-200, default: editor font size]
    //   COLOR <text-color> {{{{<bgnd-color> {<#0-color>}} {<#0-color>}} {<#0-color>}}
    //   BACKCOLOR <color> [default: black]
    //   UPDATE [default: automatic update]
    //   HIDEXY [default: not hidden]
    console.log(`CL: at parseTermDeclaration()`);
    let displaySpec: TermDisplaySpec = {} as TermDisplaySpec;
    displaySpec.colorCombos = [] as ColorCombo[]; // ensure this is structured too! (CRASHED without this!)
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    displaySpec.font = {} as FontMetrics; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY', 4);
    const textColor: DebugColor = new DebugColor('ORANGE', 15);
    console.log(`CL: at parseTermDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.hasExplicitPosition = false; // Default: use auto-placement
    displaySpec.size = { columns: 40, rows: 20 };
    DebugWindowBase.calcMetricsForFontPtSize(12, displaySpec.font);
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;
    displaySpec.textColor = textColor.rgbString;
    displaySpec.delayedUpdate = false;
    displaySpec.hideXY = false;

    // Initialize default color combos to match Pascal DefaultTermColors
    // Pascal: (clOrange, clBlack, clBlack, clOrange, clLime, clBlack, clBlack, clLime)
    // Use full brightness (15) for colors to match Pascal's full color values
    const orangeColor = new DebugColor('ORANGE', 15).rgbString;
    const blackColor = new DebugColor('BLACK', 15).rgbString;
    const limeColor = new DebugColor('LIME', 15).rgbString;

    displaySpec.colorCombos.push({ fgcolor: orangeColor, bgcolor: blackColor }); // Combo 0
    displaySpec.colorCombos.push({ fgcolor: blackColor, bgcolor: orangeColor }); // Combo 1
    displaySpec.colorCombos.push({ fgcolor: limeColor, bgcolor: blackColor });   // Combo 2
    displaySpec.colorCombos.push({ fgcolor: blackColor, bgcolor: limeColor });   // Combo 3

    // now parse overrides to defaults
    console.log(`CL: at overrides TermDisplaySpec: ${lineParts}`);
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
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'POS':
            // ensure we have two more values
            if (index < lineParts.length - 2) {
              const x = Spin2NumericParser.parsePixel(lineParts[++index]);
              const y = Spin2NumericParser.parsePixel(lineParts[++index]);
              if (x !== null && y !== null) {
                displaySpec.position.x = x;
                displaySpec.position.y = y;
                displaySpec.hasExplicitPosition = true; // POS clause found - use explicit position
              } else {
                console.log(`CL: TermDisplaySpec: Invalid position values`);
                isValid = false;
              }
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SIZE':
            // ensure we have two more values
            if (index < lineParts.length - 2) {
              const columns = Spin2NumericParser.parseCount(lineParts[++index]);
              const rows = Spin2NumericParser.parseCount(lineParts[++index]);
              if (columns !== null && rows !== null && columns >= 1 && rows >= 1) {
                displaySpec.size.columns = Math.min(columns, 256);
                displaySpec.size.rows = Math.min(rows, 256);
              } else {
                console.log(`CL: TermDisplaySpec: Invalid size values (must be 1-256)`);
                isValid = false;
              }
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'TEXTSIZE':
            // ensure we have one more value
            if (index < lineParts.length - 1) {
              const textSize = Spin2NumericParser.parseCount(lineParts[++index]);
              if (textSize !== null && textSize >= 6 && textSize <= 200) {
                // For TERM windows, TEXTSIZE represents the full row height
                // This is different from other windows which use standard font metrics
                DebugTermWindow.calcTerminalFontMetrics(textSize, displaySpec.font);
              } else {
                console.log(`CL: TermDisplaySpec: Invalid text size (must be 6-200)`);
                isValid = false;
              }
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'BACKCOLOR':
            // BACKCOLOR sets the window background color (matches Pascal's KeyColor(vBackColor))
            // Note: This is deprecated in favor of COLOR parameter
            if (index < lineParts.length - 1) {
              const colorName: string = lineParts[++index];
              let colorBrightness: number = 8;
              if (index < lineParts.length - 1) {
                colorBrightness = Number(lineParts[++index]);
              }
              const backColor = new DebugColor(colorName, colorBrightness);
              displaySpec.window.background = backColor.rgbString;
              // Also update the default color combo's background
              if (displaySpec.colorCombos.length > 0) {
                displaySpec.colorCombos[0].bgcolor = backColor.rgbString;
              }
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'COLOR':
            // here with
            //   COLOR fg-color0 bg-color0 [fg-color1 bg-color1 [fg-color2 bg-color2 [fg-color3 bg-color3]]]
            //   fg/bg-color is a color name, with optional brightness: {name [brightness]}
            // ensure we color names in pairs!
            let colorComboIdx: number = 0;
            let fgColor: string | undefined = undefined;
            let bgColor: string | undefined = undefined;
            let haveName: boolean = false;
            let fgColorName: string | undefined = undefined;
            let bgColorName: string | undefined = undefined;
            for (let colorIdx = index + 1; colorIdx < lineParts.length; colorIdx++) {
              const element = lineParts[colorIdx];
              if (fgColor !== undefined && bgColor !== undefined) {
                // have both fg and bg colors, make a color combo
                const channelColor: ColorCombo = { fgcolor: fgColor, bgcolor: bgColor };
                if (colorComboIdx == 0) {
                  // Clear all default color combos when first COLOR is specified
                  displaySpec.colorCombos = [];
                }
                displaySpec.colorCombos.push(channelColor);
                colorComboIdx++;
                // Reset for next pair
                fgColor = undefined;
                bgColor = undefined;
              } else if (!haveName) {
                // color name
                const newColorName = element.toUpperCase();
                if (fgColorName === undefined) {
                  fgColorName = newColorName;
                } else if (bgColorName === undefined) {
                  bgColorName = newColorName;
                }
                haveName = true;
              } else {
                // this could be color brightness or next name...
                let colorBrightness: number = 8;
                const possibleBrightness: string = lineParts[colorIdx + 1];
                // if possible is numeric then we have brightness
                const numericResult = possibleBrightness.match(/^-{0,1}\d+$/);
                if (numericResult != null) {
                  // have brightness for latest colorName
                  colorBrightness = Number(lineParts[++colorIdx]);
                  if (fgColorName !== undefined) {
                    // this is fg brightness
                    fgColor = new DebugColor(fgColorName, colorBrightness).rgbString;
                    fgColorName = undefined;
                  } else if (bgColorName !== undefined) {
                    // this is bg brightness
                    bgColor = new DebugColor(bgColorName, colorBrightness).rgbString;
                    bgColorName = undefined;
                  }
                  haveName = false; // next up we're looking for next color name
                } else {
                  // have next color name
                  // record current color as fg then save bgColorName
                  if (fgColorName !== undefined) {
                    fgColor = new DebugColor(fgColorName).rgbString;
                    fgColorName = undefined;
                  } else {
                    console.log(`CL: TermDisplaySpec: Missing fgColorName for ${element}`);
                  }
                  const newColorName = element.toUpperCase();
                  bgColorName = newColorName;
                  // we have the bg color name
                  haveName = true;
                }
              }
            }
            break;

          case 'UPDATE':
            displaySpec.delayedUpdate = true;
            break;
          case 'HIDEXY':
            displaySpec.hideXY = true;
            break;

          default:
            console.log(`CL: TermDisplaySpec: Unknown directive: ${element}`);
            break;
        }
        if (!isValid) {
          break;
        }
      }
    }
    console.log(`CL: at end of parseTermDeclaration(): isValid=(${isValid}), ${JSON.stringify(displaySpec, null, 2)}`);
    return [isValid, displaySpec];
  }

  private createDebugWindow(): void {
    this.logMessage(`at createDebugWindow() TERM`);
    // calculate overall canvas sizes then window size from them!

    // NOTES: Chip's size estimation:
    //  window width should be (#samples * 2) + (2 * 2); // 2 is for the 2 borders
    //  window height should be (max-min+1) + (2 * chanInset); // chanInset is for space above channel and below channel

    // TEXTSIZE represents the full row height including spacing
    // Use lineHeight which equals TEXTSIZE for proper window sizing
    const canvasHeight = this.displaySpec.size.rows * this.displaySpec.font.lineHeight;
    // for mono-spaced font width based on character width
    const canvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
    this.logMessage(
      `  -- TERM canvas size=(${canvasWidth}x${canvasHeight}) char=(${this.displaySpec.font.charWidth}x${this.displaySpec.font.charHeight}) ln=(${this.displaySpec.font.lineHeight})`
    );
    // Calculate the margin size (half character width) to match Pascal
    const marginSize = Math.floor(this.displaySpec.font.charWidth / 2);

    // Add margins to canvas dimensions for total content size
    const divHeight = canvasHeight + (marginSize * 2);
    const divWidth = canvasWidth + (marginSize * 2);

    // Calculate window dimensions with chrome adjustments using base class method
    const contentHeight = divHeight;
    const contentWidth = divWidth;
    const windowDimensions = this.calculateWindowDimensions(contentWidth, contentHeight);
    const windowHeight = windowDimensions.height;
    const windowWidth = windowDimensions.width;
    // Check if position was explicitly set with POS clause
    let windowX = this.displaySpec.position.x;
    let windowY = this.displaySpec.position.y;
    
    // If no POS clause was present, use WindowPlacer for intelligent positioning
    if (!this.displaySpec.hasExplicitPosition) {
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width: windowWidth, height: windowHeight },
        cascadeIfFull: true
      };
      const position = windowPlacer.getNextPosition(`term-${this.displaySpec.displayName}`, placementConfig);
      windowX = position.x;
      windowY = position.y;
      this.logMessage(`  -- TERM using auto-placement: ${windowX},${windowY}`);

      // Log to debug logger with reproducible command format
      try {
        const DebugLoggerWindow = require('./debugLoggerWin').DebugLoggerWindow;
        const debugLogger = DebugLoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(`WINDOW_PLACED (${windowX},${windowY} ${windowWidth}x${windowHeight} Mon:${monitorId}) TERM '${this.displaySpec.displayName}' POS ${windowX} ${windowY} SIZE ${windowWidth} ${windowHeight}`);
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }
    
    this.logMessage(
      `  -- TERM window size: ${windowWidth}x${windowHeight} @${windowX},${windowY}`
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
      windowPlacer.registerWindow(`term-${this.displaySpec.displayName}`, this.debugWindow);
    }
    
    // Measure actual font metrics after window is created
    this.debugWindow.webContents.once('dom-ready', () => {
      // Measure the actual 'X' height in the Parallax font
      const measureCode = `
        (function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.font = '${this.displaySpec.font.textSizePts}pt Parallax, monospace';

          // Measure 'X' which has no descenders
          const metrics = ctx.measureText('X');
          const width = metrics.width;

          // Get font metrics if available
          const actualHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
          const capHeight = metrics.fontBoundingBoxAscent;

          console.log('[FONT METRICS] Font size: ${this.displaySpec.font.textSizePts}pt');
          console.log('[FONT METRICS] Measured X width:', width);
          console.log('[FONT METRICS] Actual height:', actualHeight);
          console.log('[FONT METRICS] Cap height:', capHeight);
          console.log('[FONT METRICS] Our calculated charHeight: ${this.displaySpec.font.charHeight}');
          console.log('[FONT METRICS] Our calculated charWidth: ${this.displaySpec.font.charWidth}');
        })();
      `;
      this.debugWindow?.webContents.executeJavaScript(measureCode);
    });

    // hook window events before being shown
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('* Term window will show...');
      this.debugWindow?.show();
    });

    this.debugWindow.on('show', () => {
      this.logMessage('* Term window shown');
    });

    this.debugWindow.on('page-title-updated', () => {
      this.logMessage('* Term window title updated');
    });

    this.debugWindow.once('ready-to-show', () => {
      this.logMessage('at ready-to-show');
      // Register with WindowRouter when window is ready
      this.registerWithRouter();
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
            margin: 0;
            padding: 0;
            font-family: 'Parallax', sans-serif;
            font-size: ${this.displaySpec.font.textSizePts}pt;
            background-color: ${this.displaySpec.window.background};
            color: ${this.displaySpec.textColor};
            overflow: hidden;
            width: 100%;
            height: 100vh;
          }
          #terminal-data {
            display: block;
            margin: 0;
            padding: ${marginSize}px;
            background-color: ${this.displaySpec.window.background};
            width: 100%;
            height: 100%;
            position: relative;
            box-sizing: border-box;
          }
          canvas {
            // background-color:rgb(9, 201, 28);
            background-color: ${this.displaySpec.window.background};
            /* Canvas positioned at top-left of its container with padding */
            display: block;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div id="terminal-data">
          <canvas id="text-area" width="${canvasWidth}" height="${canvasHeight}"></canvas>
        </div>
      </body>
    </html>
  `;

    this.logMessage(`at createDebugWindow() TERM with htmlContent: ${htmlContent}`);

    try {
      this.debugWindow.setMenu(null);

      // Write HTML to temp file to allow file:// font URLs to work
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `pnut-term-${this.windowId}-${Date.now()}.html`);

      fs.writeFileSync(tempFile, htmlContent);
      this.logMessage(`Wrote HTML to temp file: ${tempFile}`);

      // Load the temp file instead of using data URL
      this.debugWindow.loadFile(tempFile);

      // Clean up temp file after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFile);
          this.logMessage(`Cleaned up temp file: ${tempFile}`);
        } catch (err) {
          // File might already be gone, that's ok
        }
      }, 5000);
    } catch (error) {
      this.logMessage(`Failed to load URL: ${error}`);
    }

    // now hook load complete event so we can label and paint the grid/min/max, etc.
    this.debugWindow.webContents.on('did-finish-load', () => {
      this.logMessage('at did-finish-load');
      // Initialize offscreen canvas for double buffering (matches Pascal's Bitmap[0])
      this.initializeOffscreenCanvas(canvasWidth, canvasHeight);
    });
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() TERM`);
    try {
      if (this.debugWindow && !this.debugWindow.isDestroyed()) {
        this.debugWindow.close();
        this.logMessage(`  -- Window closed`);
      }
    } catch (error) {
      this.logMessage(`  -- Error closing window: ${error}`);
    }
    this.debugWindow = null;
  }

  protected processMessageImmediate(lineParts: string[]): void {
    // Handle async internally
    this.processMessageAsync(lineParts);
  }

  private async processMessageAsync(lineParts: string[]): Promise<void> {
    // here with lineParts = ['`{displayName}, ...]
    // Valid directives are:
    // --- these manage the window
    //   CLEAR
    //   UPDATE
    //   SAVE {WINDOW} 'filename' - save window to .bmp file
    //   CLOSE
    // --- these paint content, select colors or move the cursor
    //   <numeric data> - controls or characters
    //    0 = Clear terminal display and home cursor.
    //    1 = Home cursor.
    //    2 = Set column to next character value. [2 n]
    //    3 = Set row to next character value. [3 n]
    //    4 = Select color combo #0
    //    5 = Select color combo #1
    //    6 = Select color combo #2
    //    7 = Select color combo #3
    //    8 = Backspace.
    //    9 = Tab to next 8th column.
    //    13+10 or 13 or 10 = New line.
    //    32..255 = Printable character.
    //   'string' - printable characters
    //
    // Preserve original command for error logging (required by base class)
    const unparsedCommand = lineParts.join(' ');
    //this.logMessage(`at updateContent(${unparsedCommand})`);
    // ON first numeric data, create the window! then do update
    for (let index = 1; index < lineParts.length; index++) {
      const currLinePart = lineParts[index];
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
          this.updateTermDisplay(`'${displayString}'`);
        }
      } else if (lineParts[index].charAt(0) >= '0' && lineParts[index].charAt(0) <= '9') {
        // numeric data (actions, mostly)
        const action: number = parseInt(lineParts[index], 10);
        if (action == 2 || action == 3) {
          // pass param value with goto line, goto column
          if (index + 1 < lineParts.length) {
            this.updateTermDisplay(`${action} ${lineParts[index + 1]}`);
          } else {
            this.logMessage(`* UPD-ERROR  missing value for action ${action}`);
          }
        }
        if (action >= 32 && action <= 255) {
          // printable character
          this.updateTermDisplay(`'${String.fromCharCode(action)}'`);
        } else {
          // all other actions
          this.updateTermDisplay(`${action}`);
        }
      } else if (lineParts[index].toUpperCase() == 'UPDATE') {
        // update window with latest content - copy offscreen to visible
        // This matches Pascal's UPDATE command which does BitmapToCanvas(0)
        this.updateVisibleCanvas();
      } else if (lineParts[index].toUpperCase() == 'CLEAR') {
        // clear window
        this.clearTerm();
      } else if (lineParts[index].toUpperCase() == 'CLOSE') {
        // close the window
        this.closeDebugWindow();
      } else if (lineParts[index].toUpperCase() == 'SAVE') {
        // save the window to a file
        let saveWindow = false;
        let fileNameIndex = index + 1;
        
        // Check for optional WINDOW parameter
        if (index + 1 < lineParts.length && lineParts[index + 1].toUpperCase() === 'WINDOW') {
          saveWindow = true;
          fileNameIndex = index + 2;
        }
        
        if (fileNameIndex < lineParts.length) {
          const saveFileName = this.removeStringQuotes(lineParts[fileNameIndex]);
          // save the window to a file (as BMP)
          await this.saveWindowToBMPFilename(saveFileName);
          index = fileNameIndex; // Update index to skip processed parameters
        } else {
          this.logMessage(`at updateContent() missing SAVE fileName in [${lineParts.join(' ')}]`);
        }
      } else if (lineParts[index].toUpperCase() == 'PC_KEY') {
        // Enable keyboard input forwarding
        this.enableKeyboardInput();
        break; // PC_KEY must be last command
      } else if (lineParts[index].toUpperCase() == 'PC_MOUSE') {
        // Enable mouse input forwarding
        this.enableMouseInput();
        break; // PC_MOUSE must be last command
      } else {
        this.logMessage(`* UPD-ERROR  unknown directive: ${lineParts[index]}\nCommand: ${unparsedCommand}`);
      }
    }
  }

  private updateTermDisplay(text: string): void {
    // Process display command immediately (drawing happens to offscreen buffer)
    // Visibility depends on update mode (matches Pascal's approach)
    //this.logMessage(`* updateTermDisplay(${text})`);

    // Window already created in constructor, just mark that we have data
    if (this.isFirstDisplayData) {
      this.isFirstDisplayData = false;
    }

    // Process the command immediately (it will draw to offscreen buffer)
    this.processDisplayCommand(text);
  }

  /**
   * Copy offscreen canvas to visible canvas
   * Matches Pascal's BitmapToCanvas(0)
   */
  private updateVisibleCanvas(): void {
    if (!this.debugWindow) return;

    const jsCode = `
      (function() {
        if (window.offscreenCanvas && window.visibleCtx) {
          // Copy entire offscreen canvas to visible canvas
          window.visibleCtx.drawImage(window.offscreenCanvas, 0, 0);
          console.log('[TERM] Updated visible canvas from offscreen buffer');
        }
      })()
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to update visible canvas: ${error}`);
    });
  }

  private processDisplayCommand(displayString: string): void {
    // Process a single display command
    this.logMessage(`* UPD-INFO displayString: [${displayString}]`);
    // these will be numbers (actions) or strings (display)
    // NOTE: 32-255 will arrive as single char strings 'char'
    if (displayString.charAt(0) == "'") {
      this.writeStringToTerm(displayString.substring(1, displayString.length - 1));
    } else {
      // this is a numeric action
      //cursor pos cases are 2, 3 and will arrive as '2 n' or '3 n'
      const numbers: string[] = displayString.split(' ');
      const action: number = parseInt(numbers[0], 10);
      switch (action) {
        case 0:
          // clear terminal display and home cursor
          this.clearTerm();
          break;
        case 1:
          // home cursor
          this.cursorPosition = { x: 0, y: 0 };
          break;
        case 2:
          // set column to next character value
          if (numbers.length > 1) {
            const column = Spin2NumericParser.parsePixel(numbers[1]);
            if (column !== null) {
              this.cursorPosition.x = Math.min(column, this.displaySpec.size.columns - 1);
            } else {
              this.logMessage(`* UPD-ERROR  invalid column value for action 2: ${numbers[1]}`);
            }
          } else {
            this.logMessage(`* UPD-ERROR  missing column value for action 2`);
          }
          break;
        case 3:
          // set row to next character value
          if (numbers.length > 1) {
            const row = Spin2NumericParser.parsePixel(numbers[1]);
            if (row !== null) {
              this.cursorPosition.y = Math.min(row, this.displaySpec.size.rows - 1);
            } else {
              this.logMessage(`* UPD-ERROR  invalid row value for action 3: ${numbers[1]}`);
            }
          } else {
            this.logMessage(`* UPD-ERROR  missing row value for action 3`);
          }
          break;
        case 4:
        case 5:
        case 6:
        case 7:
          // select color combo #0-3
          this.selectedCombo = action - 4;
          break;
        case 8:
          // backspace - matches Pascal implementation
          if (this.cursorPosition.x !== 0 || this.cursorPosition.y !== 0) {
            this.cursorPosition.x--;
            if (this.cursorPosition.x < 0) {
              // Wrap to end of previous line
              this.cursorPosition.x = this.displaySpec.size.columns - 1;
              this.cursorPosition.y--;
            }
          }
          break;
        case 9:
          // move to next tab column (tabwidth 8)
          // move cursor to next tabstop
          const spacesToTab = 8 - (this.cursorPosition.x % 8);
          for (let i = 0; i < spacesToTab; i++) {
            // Use writeCharToTerm to handle wrapping properly like Pascal's TERM_Chr
            this.writeCharToTerm(' ');
          }
          break;
        case 10:
        case 13:
          // Handle newline - matches Pascal TERM_Chr(Chr(13))
          this.handleNewline();
          break;
        default:
          this.logMessage(`* UPD-ERROR  unknown action: ${action}`);
          break;
      }
    }
  }

  /**
   * Initialize offscreen canvas for double buffering
   * Matches Pascal's Bitmap[0] (hidden buffer)
   */
  private initializeOffscreenCanvas(width: number, height: number): void {
    if (!this.debugWindow) return;

    const jsCode = `
      (function() {
        // Create offscreen canvas for double buffering
        window.offscreenCanvas = document.createElement('canvas');
        window.offscreenCanvas.width = ${width};
        window.offscreenCanvas.height = ${height};
        window.offscreenCtx = window.offscreenCanvas.getContext('2d');

        // Get reference to visible canvas
        window.visibleCanvas = document.getElementById('text-area');
        window.visibleCtx = window.visibleCanvas ? window.visibleCanvas.getContext('2d') : null;

        // Clear both canvases with background color
        const bgColor = '${this.displaySpec.colorCombos[0].bgcolor}';
        if (window.offscreenCtx) {
          window.offscreenCtx.fillStyle = bgColor;
          window.offscreenCtx.fillRect(0, 0, ${width}, ${height});
        }
        if (window.visibleCtx) {
          window.visibleCtx.fillStyle = bgColor;
          window.visibleCtx.fillRect(0, 0, ${width}, ${height});
        }

        console.log('[TERM] Offscreen canvas initialized for double buffering');
        return 'Offscreen canvas ready';
      })()
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode)
      .then(result => {
        this.logMessage(`Offscreen canvas initialization: ${result}`);
        this.offscreenCanvasInitialized = true;
      })
      .catch(error => {
        this.logMessage(`Failed to initialize offscreen canvas: ${error}`);
      });
  }

  private clearTerm(): void {
    // erase the text display area
    this.clearTextArea();
    // home the cursorPosition
    this.cursorPosition = { x: 0, y: 0 };
  }

  /**
   * Handle newline/carriage return - matches Pascal TERM_Chr(Chr(13))
   */
  private handleNewline(): void {
    this.cursorPosition.x = 0;
    if (this.cursorPosition.y < this.displaySpec.size.rows - 1) {
      // Not at bottom - just move to next row
      this.cursorPosition.y += 1;
    } else {
      // At bottom - scroll content up and stay on last row
      this.scrollUp();
      // cursorPosition.y stays at last row
    }
  }

  private clearTextArea(): void {
    if (this.debugWindow) {
      this.logMessage(`at clearTextArea()`);
      try {
        const bgcolor: string = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
        this.logMessage(`  -- bgcolor=[${bgcolor}]`);

        // Clear offscreen canvas (Bitmap[0] in Pascal)
        const jsCode = `
          (function() {
            // Clear offscreen canvas
            if (window.offscreenCtx) {
              window.offscreenCtx.fillStyle = '${bgcolor}';
              window.offscreenCtx.fillRect(0, 0, window.offscreenCanvas.width, window.offscreenCanvas.height);

              // In immediate mode (not delayed update), also update visible canvas
              if (!${this.displaySpec.delayedUpdate}) {
                window.visibleCtx.fillStyle = '${bgcolor}';
                window.visibleCtx.fillRect(0, 0, window.visibleCanvas.width, window.visibleCanvas.height);
              }
            }
          })()
        `;

        this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
          this.logMessage(`Failed to execute clear terminal JavaScript: ${error}`);
        });
      } catch (error) {
        console.error('Failed to clear text area:', error);
      }
    }
  }

  private writeStringToTerm(text: string): void {
    if (this.debugWindow) {
      this.logMessage(`at writeStringToTerm(${text})`);
      
      // Process string character by character
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        this.writeCharToTerm(char);
      }
    }
  }

  /**
   * Write a single character to the terminal at the current cursor position
   * Matches Pascal's TERM_Chr procedure behavior
   */
  private writeCharToTerm(char: string): void {
    if (!this.debugWindow) return;

    // Handle carriage return
    if (char === '\r' || char === '\n') {
      this.handleNewline();
      return;
    }

    // Check for line wrap BEFORE writing (matches Pascal: "if vCol = vCols then TERM_Chr(Chr(13));")
    if (this.cursorPosition.x >= this.displaySpec.size.columns) {
      this.handleNewline();
    }

    try {
      const textHeight: number = this.displaySpec.font.charHeight;
      const textSizePts: number = this.displaySpec.font.textSizePts;
      const charHeight: number = this.displaySpec.font.charHeight;
      const charWidth: number = this.displaySpec.font.charWidth;
      // Use lineHeight for row spacing to match Pascal
      const textYOffset: number = this.cursorPosition.y * this.displaySpec.font.lineHeight;
      const textXOffset: number = this.cursorPosition.x * charWidth;
      // Fonts have internal padding - adjust to get 2/3 space above, 1/3 below
      // The actual glyph is typically 70% of the font's height
      // Push down by about 20% of charHeight to center better
      const verticalAdjust: number = Math.round(this.displaySpec.font.charHeight * 0.2);
      const textYbaseline: number = textYOffset + verticalAdjust;
      const fgColor: string = this.displaySpec.colorCombos[this.selectedCombo].fgcolor;
      const bgcolor: string = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
      const fontSpec: string = `normal ${textSizePts}pt Consolas, monospace`;
      
      // Draw to offscreen canvas (Pascal's Bitmap[0])
      // Then conditionally copy to visible canvas based on update mode
      const jsCode = `
        (function() {
          if (!window.offscreenCtx) return;

          // Draw background rectangle on offscreen canvas
          window.offscreenCtx.fillStyle = '${bgcolor}';
          window.offscreenCtx.fillRect(${textXOffset}, ${textYOffset}, ${charWidth}, ${charHeight});

          // Draw character on offscreen canvas
          window.offscreenCtx.fillStyle = '${fgColor}';
          window.offscreenCtx.font = '${fontSpec}';
          window.offscreenCtx.textBaseline = 'top';
          window.offscreenCtx.fillText('${char}', ${textXOffset}, ${textYbaseline});

          // In immediate mode (not delayed update), copy rectangle to visible canvas
          // This matches Pascal's: if not vUpdate then copy Bitmap[0] rectangle to Canvas
          if (!${this.displaySpec.delayedUpdate} && window.visibleCtx) {
            // Copy just the character rectangle from offscreen to visible
            window.visibleCtx.drawImage(
              window.offscreenCanvas,
              ${textXOffset}, ${textYOffset}, ${charWidth}, ${charHeight},
              ${textXOffset}, ${textYOffset}, ${charWidth}, ${charHeight}
            );
          }
        })()
      `;

      this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
        this.logMessage(`Failed to execute terminal text JavaScript: ${error}`);
      });
      
      // Advance cursor
      this.cursorPosition.x++;

      // Note: Line wrap is handled at the START of next character write,
      // matching Pascal's "if vCol = vCols then TERM_Chr(Chr(13));"
      // This happens in writeCharToTerm when we check the column position
    } catch (error) {
      console.error('Failed to write character:', error);
    }
  }

  /**
   * Get the canvas element ID for this window
   */
  protected getCanvasId(): string {
    return 'terminal-canvas'; // Terminal window uses a different approach, but we need to provide an ID
  }

  /**
   * Clear from cursor to end of line
   */
  private clearLineFromCursor(): void {
    if (!this.debugWindow) return;
    
    const charWidth = this.displaySpec.font.charWidth;
    const charHeight = this.displaySpec.font.charHeight;
    const startX = this.cursorPosition.x * charWidth + this.contentInset;
    const y = this.cursorPosition.y * this.displaySpec.font.lineHeight + this.contentInset;
    const width = (this.displaySpec.size.columns - this.cursorPosition.x) * charWidth;
    const bgcolor = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
    
    const jsCode = this.canvasRenderer.clearCharacterCell(
      'text-area',
      startX,
      y,
      width,
      charHeight,
      bgcolor
    );
    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to execute terminal clear line JavaScript: ${error}`);
    });
  }

  /**
   * Scroll terminal content up by one line
   * Works with offscreen canvas for double buffering
   */
  private scrollUp(): void {
    if (!this.debugWindow) return;

    const charHeight = this.displaySpec.font.charHeight;
    const lineHeight = this.displaySpec.font.lineHeight;
    const canvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
    const canvasHeight = this.displaySpec.size.rows * lineHeight;
    const bgcolor = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;

    // Scroll the offscreen canvas up by one line
    const jsCode = `
      (function() {
        if (!window.offscreenCtx || !window.offscreenCanvas) return;

        const charHeight = ${charHeight};
        const canvasWidth = ${canvasWidth};
        const canvasHeight = ${canvasHeight};
        const bgcolor = '${bgcolor}';

        // Save the content that will remain visible (all but top line)
        const imageData = window.offscreenCtx.getImageData(
          0, charHeight, canvasWidth, canvasHeight - charHeight
        );

        // Put it back one line higher
        window.offscreenCtx.putImageData(imageData, 0, 0);

        // Clear the last line
        window.offscreenCtx.fillStyle = bgcolor;
        window.offscreenCtx.fillRect(
          0, canvasHeight - charHeight, canvasWidth, charHeight
        );

        // If not in delayed update mode, copy to visible immediately
        if (!${this.displaySpec.delayedUpdate}) {
          if (window.visibleCtx) {
            window.visibleCtx.drawImage(window.offscreenCanvas, 0, 0);
          }
        }
      })()
    `;

    this.debugWindow.webContents.executeJavaScript(jsCode).catch((error) => {
      this.logMessage(`Failed to execute terminal scroll JavaScript: ${error}`);
    });
  }

  /**
   * Transform mouse coordinates to terminal character positions
   * X: column number (0-based)
   * Y: row number (0-based)
   */
  protected transformMouseCoordinates(x: number, y: number): { x: number; y: number } {
    // Calculate margins
    const marginLeft = this.contentInset;
    const marginTop = this.contentInset;
    
    // Check if mouse is within the terminal area
    const terminalWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
    const terminalHeight = this.displaySpec.size.rows * this.displaySpec.font.charHeight;
    
    if (x >= marginLeft && x < marginLeft + terminalWidth && 
        y >= marginTop && y < marginTop + terminalHeight) {
      // Transform to character coordinates
      const relX = x - marginLeft;
      const relY = y - marginTop;
      
      // Convert to column and row
      const column = Math.floor(relX / this.displaySpec.font.charWidth);
      const row = Math.floor(relY / this.displaySpec.font.charHeight);
      
      return { 
        x: Math.max(0, Math.min(column, this.displaySpec.size.columns - 1)),
        y: Math.max(0, Math.min(row, this.displaySpec.size.rows - 1))
      };
    }
    
    // Outside terminal area
    return { x: -1, y: -1 };
  }
}
