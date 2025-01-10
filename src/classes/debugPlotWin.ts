/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow, Menu } from 'electron';
// src/classes/debugPlotWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './debugColor';

import { DebugWindowBase, Position, Size, WindowColor } from './debugWindowBase';

export interface PlotDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  position: Position;
  size: Size;
  nbrSamples: number;
  rate: number;
  dotSize: number;
  lineSize: number;
  textSize: number;
  window: WindowColor;
  isPackedData: boolean;
  hideXY: boolean;
}

export interface PlotChannelSpec {
  name: string;
  color: string;
  gridColor: string;
  textColor: string;
  minValue: number;
  maxValue: number;
  ySize: number;
  yBaseOffset: number;
  lgndShowMax: boolean;
  lgndShowMin: boolean;
  lgndShowMaxLine: boolean;
  lgndShowMinLine: boolean;
}

interface PlotChannelSamples {
  samples: number[];
}

export interface PlotTriggerSpec {
  // trigger
  trigEnabled: boolean;
  trigAuto: boolean;
  trigChannel: number; // if channel is -1 then trigger is disabled
  trigArmLevel: number;
  trigLevel: number;
  trigRtOffset: number;
  trigHoldoff: number; // in samples required, from trigger to trigger
}

export class DebugPlotWindow extends DebugWindowBase {
  private displaySpec: PlotDisplaySpec = {} as PlotDisplaySpec;
  private channelSpecs: PlotChannelSpec[] = []; // one for each channel
  private channelSamples: PlotChannelSamples[] = []; // one for each channel
  private triggerSpec: PlotTriggerSpec = {} as PlotTriggerSpec;
  private debugWindow: BrowserWindow | null = null;
  private isFirstNumericData: boolean = true;
  private channelInset: number = 10; // 10 pixels from top and bottom of window
  private contentInset: number = 10; // 10 pixels from left and right of window
  private canvasMargin: number = 0; // 3 pixels from left, right, top, and bottom of canvas (NOT NEEDED)
  private channelLineWidth: number = 2; // 2 pixels wide for channel data line
  private dbgUpdateCount: number = 260; // NOTE 120 (no scroll) ,140 (scroll plus more), 260 scroll twice;
  private dbgLogMessageCount: number = 256 + 1; // log first N samples then stop (2 channel: 128+1 is 64 samples)

  constructor(ctx: Context, displaySpec: PlotDisplaySpec) {
    super(ctx);
    // record our Debug Plot Window Spec
    this.displaySpec = displaySpec;
    // init default Trigger Spec
    this.triggerSpec = {
      trigEnabled: false,
      trigAuto: false,
      trigChannel: -1,
      trigArmLevel: 0,
      trigLevel: 0,
      trigRtOffset: 0,
      trigHoldoff: 0
    };
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
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY', 4);
    console.log(`CL: at parsePlotDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.size = { width: 256, height: 256 };
    displaySpec.nbrSamples = 256;
    displaySpec.rate = 1;
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;

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
            // esure we have one more value
            if (index < lineParts.length - 1) {
              displaySpec.windowTitle = lineParts[++index];
            } else {
              // console.log() as we are in class static method, not derived class...
              console.log(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SIZE':
            // esure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.size.width = Number(lineParts[++index]);
              displaySpec.size.height = Number(lineParts[++index]);
            } else {
              console.log(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SAMPLES':
            // esure we have two more values
            if (index < lineParts.length - 1) {
              displaySpec.nbrSamples = Number(lineParts[++index]);
            } else {
              console.log(`CL: PlotDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
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
    if (this.channelSpecs.length == 0) {
      // create a DEFAULT channelSpec for only channel
      const defaultColor: DebugColor = new DebugColor('GREEN');
      this.channelSpecs.push({
        name: 'Channel 0',
        color: defaultColor.rgbString,
        gridColor: defaultColor.gridRgbString,
        textColor: defaultColor.fontRgbString,
        minValue: 0,
        maxValue: 255,
        ySize: this.displaySpec.size.height,
        yBaseOffset: 0,
        lgndShowMax: true,
        lgndShowMin: true,
        lgndShowMaxLine: true,
        lgndShowMinLine: true
      });
    }

    // NOTES: Chip's size estimation:
    //  window width should be (#samples * 2) + (2 * 2); // 2 is for the 2 borders
    //  window height should be (max-min+1) + (2 * chanInset); // chanInset is for space above channel and below channel

    const channelCanvases: string[] = [];
    let windowCanvasHeight: number = 0;
    if (this.channelSpecs.length > 0) {
      for (let index = 0; index < this.channelSpecs.length; index++) {
        const channelSpec = this.channelSpecs[index];
        const adjHeight = this.channelLineWidth / 2 + this.canvasMargin * 2 + channelSpec.ySize + 2 * this.channelInset; // inset is above and below
        const adjWidth = this.canvasMargin * 2 + this.displaySpec.nbrSamples * 2;
        // create a canvas for each channel
        channelCanvases.push(`<canvas id="channel-${index}" width="${adjWidth}" height="${adjHeight}"></canvas>`);
        // account for channel height
        windowCanvasHeight += channelSpec.ySize + 2 * this.channelInset + this.channelLineWidth / 2;
      }
    } else {
      // error if NO channel
      this.logMessage(`at createDebugWindow() PLOT with NO channels!`);
    }

    this.logMessage(`at createDebugWindow() PLOT set up done... w/${channelCanvases.length} canvase(s)`);

    // set height so no scroller by default
    const canvasePlusWindowHeight = windowCanvasHeight + 20 + 30; // 20 is for the channel labels, 30 for window menu bar (30 is guess on linux)
    const windowHeight = Math.max(this.displaySpec.size.height, canvasePlusWindowHeight);
    const windowWidth = Math.max(this.displaySpec.size.width, this.displaySpec.nbrSamples * 2 + this.contentInset * 2); // contentInset' for the Xoffset into window for canvas
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
    this.debugWindow.on('closed', () => {
      this.logMessage('* Plot window closed');
      this.debugWindow = null;
    });

    this.debugWindow.on('close', () => {
      this.logMessage('* Plot window closing...');
    });

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
          body {
            display: flex;
            flex-direction: column;
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            font-size: 12px;
            //background-color:rgb(234, 121, 86);
            background-color: ${this.displaySpec.window.background};
            color:rgb(191, 213, 93);
          }
          #channel-titles {
            display: flex;
            justify-content: flex-start; // left edge grounded
            align-items: center; // vertically centered
            flex-grow: 0;
            gap: 10px;  // between labels
            //margin: 10px;   // top, right, bottom, left
            padding: 10px;
            background-color:rgb(83, 221, 108);
          }
          #channel-data {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            margin: 0;
            //background-color:rgb(55, 63, 170); // ${this.displaySpec.window.background};
          }
          #channels {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            margin: 0px 10px 10px 10px;   // top, right, bottom, left
            padding: 0px;   // top, right, bottom, left
            border-width: 1px;
            border-style: solid;
            border-color: ${this.displaySpec.window.grid};
            background-color:rgb(164, 22, 22); // ${this.displaySpec.window.background};
          }
          canvas {
            //background-color:rgb(240, 194, 151);
            background-color: ${this.displaySpec.window.background};
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div id="channel-titles"><span>{labels here}</span></div>
        <div id="channel-data">
          <div id="channels">${channelCanvases.join(' ')}</div>
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
      for (let index = 0; index < this.channelSpecs.length; index++) {
        const channelSpec = this.channelSpecs[index];
        this.updatePlotChannelLabel(channelSpec.name, channelSpec.color);
        const channelGridColor: string = channelSpec.gridColor;
        const channelTextColor: string = channelSpec.textColor;
        const windowGridColor: string = this.displaySpec.window.grid;
        const canvasName = `channel-${index}`;
        // paint the grid/min/max, etc.
        //  %abcd where a=enable max legend, b=min legend, c=max line, d=min line
        if (channelSpec.lgndShowMax && !channelSpec.lgndShowMaxLine) {
          //  %1x0x => max legend, NOT max line, so value ONLY
          this.drawHorizontalValue(canvasName, channelSpec, channelSpec.maxValue, channelTextColor);
        }
        if (channelSpec.lgndShowMin && !channelSpec.lgndShowMinLine) {
          //  %x1x0 => min legend, NOT min line, so value ONLY
          this.drawHorizontalValue(canvasName, channelSpec, channelSpec.minValue, channelTextColor);
        }
        if (channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
          //  %1x1x => max legend, max line, so show value and line!
          this.drawHorizontalLineAndValue(
            canvasName,
            channelSpec,
            channelSpec.maxValue,
            channelGridColor,
            channelTextColor
          );
        }
        if (channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
          //  %x1x1 => min legend, min line, so show value and line!
          this.drawHorizontalLineAndValue(
            canvasName,
            channelSpec,
            channelSpec.minValue,
            channelGridColor,
            channelTextColor
          );
        }
        if (!channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
          //  %0x1x => NOT max legend, max line, show line ONLY
          this.drawHorizontalLine(canvasName, channelSpec, channelSpec.maxValue, channelGridColor);
        }
        if (!channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
          //  %x0x1 => NOT min legend, min line, show line ONLY
          this.drawHorizontalLine(canvasName, channelSpec, channelSpec.minValue, channelGridColor);
        }
      }
    });
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow()`);
    // is destroyed should prevent crash on double close
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
      this.debugWindow = null;
    }
  }

  /*
  //   OUR INITIAL TEST CODE
  //
    debug(`plot myplot size 400 480 backcolor white update)
    debug(`myplot origin 200 200 polar -64 -16)
    k~
    repeat
        debug(`myplot clear)
        debug(`myplot set 240 0 cyan 3 text 24 3 'Hub RAM Interface')
        debug(`myplot set 210 0 text 11 3 'Cogs can r/w 32 bits per clock')

        if k & 8
            j++
        else
            'move RAMs or draw spokes?
            repeat i from 0 to 7
                debug(`myplot gray 12 set 83 `(i*8) line 150 `(i*8) 15)

        debug(`myplot set 0 0 cyan 4 circle 121 yellow 7 circle 117 3)
        debug(`myplot set 20 0 white text 9 'Address LSBs')
        debug(`myplot set 0 0 text 11 1 '8 Hub RAMs')
        debug(`myplot set 20 32 text 9 '16K x 32' )

        repeat i from 0 to 7 'draw RAMs and cogs
            debug(`myplot cyan 6 set 83 `(i*8-j) circle 43 text 14 '`(i)')
            debug(`myplot cyan 4 set 83 `(i*8-j) circle 45 3)
            debug(`myplot orange 6 set 150 `(i*8) circle 61 text 13 'Cog`(i)')
            debug(`myplot orange 4 set 150 `(i*8) circle 63 3)

        debug(`myplot update `dly(30))
  */

  public updateContent(lineParts: string[]): void {
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
    //this.logMessage(`at updateContent(${lineParts.join(' ')})`);
    // ON first numeric data, create the window! then do update
    if (lineParts.length >= 2) {
      // have data, parse it
      if (lineParts[1].charAt(0) == "'") {
        // parse channel spec
        let channelSpec: PlotChannelSpec = {} as PlotChannelSpec;
        channelSpec.name = lineParts[1].slice(1, -1);
        let colorName = 'GREEN';
        let colorBrightness = 15;
        if (lineParts[2].toUpperCase() == 'AUTO') {
          // parse AUTO spec
          //   '{NAME1}' AUTO2 {y-size3 {y-base4 {legend5} {color6 {bright7}}}} // legend is %abcd
          if (lineParts.length > 3) {
            channelSpec.ySize = Number(lineParts[3]);
          }
          if (lineParts.length > 4) {
            channelSpec.yBaseOffset = Number(lineParts[4]);
          }
          if (lineParts.length > 5) {
            // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
            const legend: string = lineParts[5];
            this.parseLegend(legend, channelSpec);
          }
          if (lineParts.length > 6) {
            colorName = lineParts[6];
          }
          if (lineParts.length > 7) {
            colorBrightness = Number(lineParts[7]);
          }
        } else {
          // parse manual spec
          //   '{NAME1}' {min2 {max3 {y-size4 {y-base5 {legend6} {color7 {bright8}}}}}}  // legend is %abcd
          if (lineParts.length > 2) {
            channelSpec.minValue = parseFloat(lineParts[2]);
          }
          if (lineParts.length > 3) {
            channelSpec.maxValue = parseFloat(lineParts[3]);
          }
          if (lineParts.length > 4) {
            channelSpec.ySize = Number(lineParts[4]);
          }
          if (lineParts.length > 5) {
            channelSpec.yBaseOffset = Number(lineParts[5]);
          }
          if (lineParts.length > 6) {
            // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
            const legend: string = lineParts[6];
            this.parseLegend(legend, channelSpec);
          }
          if (lineParts.length > 7) {
            colorName = lineParts[7];
          }
          if (lineParts.length > 8) {
            colorBrightness = Number(lineParts[8]);
          }
        }
        const channelColor = new DebugColor(colorName, colorBrightness);
        channelSpec.color = channelColor.rgbString;
        channelSpec.gridColor = channelColor.gridRgbString;
        channelSpec.textColor = channelColor.fontRgbString;
        // and record spec for this channel
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with channelSpec: ${JSON.stringify(channelSpec, null, 2)}`);
        this.channelSpecs.push(channelSpec);
      } else if (lineParts[1].toUpperCase() == 'TRIGGER') {
        // parse trigger spec update
        //   TRIGGER1 <channel|-1>2 {arm-level3 {trigger-level4 {offset5}}}
        //   TRIGGER1 <channel|-1>2 {HOLDOFF3 <2-2048>4}
        this.triggerSpec.trigEnabled = true;
        if (lineParts.length > 2) {
          const desiredChannel: number = Number(lineParts[2]);
          if (desiredChannel >= -1 && desiredChannel < this.channelSpecs.length) {
            this.triggerSpec.trigChannel = desiredChannel;
          } else {
            this.logMessage(`at updateContent() with invalid channel: ${desiredChannel} in [${lineParts.join(' ')}]`);
          }
          if (lineParts.length > 3) {
            if (lineParts[3].toUpperCase() == 'HOLDOFF') {
              if (lineParts.length >= 4) {
                this.triggerSpec.trigHoldoff = parseFloat(lineParts[4]);
              }
            } else if (lineParts[3].toUpperCase() == 'AUTO') {
              this.triggerSpec.trigAuto = true;
            } else {
              this.triggerSpec.trigArmLevel = parseFloat(lineParts[3]);
              this.triggerSpec.trigAuto = false;
              if (lineParts.length > 4) {
                this.triggerSpec.trigLevel = parseFloat(lineParts[4]);
              }
              if (lineParts.length > 5) {
                this.triggerSpec.trigRtOffset = parseFloat(lineParts[5]);
              }
            }
          }
        }
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
      } else if (lineParts[1].toUpperCase() == 'HOLDOFF') {
        // parse trigger spec update
        //   HOLDOFF1 <2-2048>2
        if (lineParts.length > 2) {
          this.triggerSpec.trigHoldoff = parseFloat(lineParts[2]);
        }
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
      } else if (lineParts[1].toUpperCase() == 'CLEAR') {
        // clear all channels
        this.clearChannelData();
      } else if (lineParts[1].toUpperCase() == 'CLOSE') {
        // close the window
        this.closeDebugWindow();
      } else if (lineParts[1].toUpperCase() == 'SAVE') {
        // save the window to a file
        // FIXME: UNDONE: add code save the window to a file here
      } else if ((lineParts[1].charAt(0) >= '0' && lineParts[1].charAt(0) <= '9') || lineParts[1].charAt(0) == '-') {
        if (this.isFirstNumericData) {
          this.isFirstNumericData = false;
          this.calculateAutoTriggerAndScale();
          this.initChannelSamples();
          this.createDebugWindow();
        }
        let scopeSamples: number[] = [];
        for (let index = 1; index < lineParts.length; index++) {
          // spin2 output has underscores for commas in numbers, so remove them
          const value: string = lineParts[index].replace(/_/g, '');
          if (value !== '') {
            const nextSample: number = parseFloat(value);
            scopeSamples.push(nextSample);
          }
        }

        // parse numeric data
        let didScroll: boolean = false; // in case we need this for performance of window update
        const numberChannels: number = this.channelSpecs.length;
        const nbrSamples = scopeSamples.length;
        if (nbrSamples == numberChannels) {
          /*
          if (this.dbgLogMessageCount > 0) {
            this.logMessage(
              `at updateContent() #${numberChannels} channels, #${nbrSamples} samples of [${scopeSamples.join(
                ','
              )}], lineparts=[${lineParts.join(',')}]`
            );
          }
          */
          for (let chanIdx = 0; chanIdx < nbrSamples; chanIdx++) {
            let nextSample: number = Number(scopeSamples[chanIdx]);
            //this.logMessage(`* UPD-INFO nextSample: ${nextSample} for channel[${chanIdx}]`);
            // limit the sample to the channel's min/max?!
            const channelSpec = this.channelSpecs[chanIdx];
            if (nextSample < channelSpec.minValue) {
              nextSample = channelSpec.minValue;
              this.logMessage(`* UPD-WARNING sample below min: ${nextSample} of [${lineParts.join(',')}]`);
            } else if (nextSample > channelSpec.maxValue) {
              nextSample = channelSpec.maxValue;
              this.logMessage(`* UPD-WARNING sample above max: ${nextSample} of [${lineParts.join(',')}]`);
            }
            // record our sample (shifting left if necessary)
            didScroll = this.recordChannelSample(chanIdx, nextSample);
            // update scope chanel canvas with new sample
            const canvasName = `channel-${chanIdx}`;
            //this.logMessage(`* UPD-INFO recorded (${nextSample}) for ${canvasName}`);
            this.updatePlotChannelData(canvasName, channelSpec, this.channelSamples[chanIdx].samples, didScroll);
          }
        } else {
          this.logMessage(
            `* UPD-ERROR wrong nbr of samples: #${numberChannels} channels, #${nbrSamples} samples of [${lineParts.join(
              ','
            )}]`
          );
        }
        // FIXME: UNDONE: add code to update the window here
      } else {
        this.logMessage(`* UPD-ERROR  unknown directive: ${lineParts[1]} of [${lineParts.join(' ')}]`);
      }
    }
  }

  private calculateAutoTriggerAndScale() {
    // FIXME: UNDONE check if auto is set, if is then calculate the trigger level and scale
    this.logMessage(`at calculateAutoTriggerAndScale()`);
    if (this.triggerSpec.trigAuto) {
      // calculate:
      // 1. arm level at 33%
      // 2. trigger level 50%
      // 3. ...
      // 4. set the scale to the max - min
    }
  }

  private initChannelSamples() {
    this.logMessage(`at initChannelSamples()`);
    // clear the channel data
    this.channelSamples = [];
    if (this.channelSpecs.length == 0) {
      this.channelSamples.push({ samples: [] });
    } else {
      for (let index = 0; index < this.channelSpecs.length; index++) {
        this.channelSamples.push({ samples: [] });
      }
    }
    this.logMessage(`  -- [${JSON.stringify(this.channelSamples, null, 2)}]`);
  }

  private clearChannelData() {
    this.logMessage(`at clearChannelData()`);
    for (let index = 0; index < this.channelSamples.length; index++) {
      const channelSamples = this.channelSamples[index];
      // clear the channel data
      channelSamples.samples = [];
    }
  }

  private recordChannelSample(channelIndex: number, sample: number): boolean {
    //this.logMessage(`at recordChannelSample(${channelIndex}, ${sample})`);
    let didScroll: boolean = false;
    if (channelIndex >= 0 && channelIndex < this.channelSamples.length) {
      const channelSamples = this.channelSamples[channelIndex];
      if (channelSamples.samples.length >= this.displaySpec.nbrSamples) {
        // remove oldest sample
        channelSamples.samples.shift();
        didScroll = true;
      }
      // record the new sample
      channelSamples.samples.push(sample);
    } else {
      this.logMessage(`at recordChannelSample() with invalid channelIndex: ${channelIndex}`);
    }
    return didScroll;
  }

  private parseLegend(legend: string, channelSpec: PlotChannelSpec): void {
    // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
    let validLegend: boolean = false;
    if (legend.length > 4 && legend.charAt(0) == '%') {
      channelSpec.lgndShowMax = legend.charAt(1) == '1' ? true : false;
      channelSpec.lgndShowMin = legend.charAt(2) == '1' ? true : false;
      channelSpec.lgndShowMaxLine = legend.charAt(3) == '1' ? true : false;
      channelSpec.lgndShowMinLine = legend.charAt(4) == '1' ? true : false;
      validLegend = true;
    } else if (legend.charAt(0) >= '0' && legend.charAt(0) <= '9') {
      // get integer value of legend and ensure it is within range 0-15
      const legendValue = Number(legend);
      if (legendValue >= 0 && legendValue <= 15) {
        channelSpec.lgndShowMax = (legendValue & 0x1) == 0x1 ? true : false;
        channelSpec.lgndShowMin = (legendValue & 0x2) == 0x2 ? true : false;
        channelSpec.lgndShowMaxLine = (legendValue & 0x4) == 0x4 ? true : false;
        channelSpec.lgndShowMinLine = (legendValue & 0x8) == 0x8 ? true : false;
        validLegend = true;
      }
    }
    if (!validLegend) {
      this.logMessage(`at parseLegend() with invalid legend: ${legend}`);
      channelSpec.lgndShowMax = false;
      channelSpec.lgndShowMin = false;
      channelSpec.lgndShowMaxLine = false;
      channelSpec.lgndShowMinLine = false;
    }
  }

  private updatePlotChannelData(
    canvasName: string,
    channelSpec: PlotChannelSpec,
    samples: number[],
    didScroll: boolean
  ): void {
    if (this.debugWindow) {
      //if (this.dbgUpdateCount > 0) {
      // DISABLE STOP this.dbgUpdateCount--;
      //}
      //if (this.dbgUpdateCount == 0) {
      //  return;
      //}
      if (--this.dbgLogMessageCount > 0) {
        this.logMessage(
          `at updatePlotChannelData(${canvasName}, w/#${samples.length}) sample(s), didScroll=(${didScroll})`
        );
      }
      try {
        // placement need to be scale sample range to vertical canvas size
        const currSample: number = samples[samples.length - 1];
        const prevSample: number = samples.length > 1 ? samples[samples.length - 2] : currSample;
        // Invert and scale the sample to to our display range
        const currSampleInverted: number = this.scaleAndInvertValue(currSample, channelSpec);
        const prevSampleInverted: number = this.scaleAndInvertValue(prevSample, channelSpec);
        // coord for current and previous samples
        // NOTE:  this.channelSpecs[x].yBaseOffset is NOT used in our implementation
        const currXOffset: number = this.canvasMargin + (samples.length - 1) * this.channelLineWidth;
        const currYOffset: number =
          this.channelLineWidth / 2 + currSampleInverted + this.canvasMargin + this.channelInset;
        const prevXOffset: number = this.canvasMargin + (samples.length - 2) * this.channelLineWidth;
        const prevYOffset: number =
          this.channelLineWidth / 2 + prevSampleInverted + this.canvasMargin + this.channelInset;
        //this.logMessage(`  -- prev=[${prevYOffset},${prevXOffset}], curr=[${currYOffset},${currXOffset}]`);
        // draw region for the channel
        const drawWidth: number = this.displaySpec.nbrSamples * this.channelLineWidth;
        const drawHeight: number = channelSpec.ySize + this.channelLineWidth / 2;
        const drawXOffset: number = this.canvasMargin;
        const drawYOffset: number = this.channelInset + this.canvasMargin;
        const channelColor: string = channelSpec.color;
        if (this.dbgLogMessageCount > 0) {
          this.logMessage(`  -- DRAW size=(${drawWidth},${drawHeight}), offset=(${drawYOffset},${drawXOffset})`);
          this.logMessage(
            `  -- #${samples.length} currSample=(${currSample}->${currSampleInverted}) @ rc=[${currYOffset},${currXOffset}], prev=[${prevYOffset},${prevXOffset}]`
          );
        }
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            // Locate the canvas element by its ID
            const canvas = document.getElementById('${canvasName}');

            if (canvas && canvas instanceof HTMLCanvasElement) {
              // Get the canvas context
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Set the line color and width
                const lineColor = '${channelColor}';
                const lineWidth = ${this.channelLineWidth};
                const scrollSpeed = lineWidth;
                const canvWidth = ${drawWidth};
                const canvHeight = ${drawHeight};
                const canvXOffset = ${drawXOffset};
                const canvYOffset = ${drawYOffset};

                if (${didScroll}) {
                  // Create an off-screen canvas
                  const offScreenCanvas = document.createElement('canvas');
                  offScreenCanvas.width = canvWidth - scrollSpeed;
                  offScreenCanvas.height = canvHeight;
                  const offScreenCtx = offScreenCanvas.getContext('2d');

                  if (offScreenCtx) {
                    // Copy the relevant part of the canvas to the off-screen canvas
                    //  drawImage(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
                    offScreenCtx.drawImage(canvas, scrollSpeed + canvXOffset, canvYOffset, canvWidth - scrollSpeed, canvHeight, 0, 0, canvWidth - scrollSpeed, canvHeight);

                    // Clear the original canvas
                    //  clearRect(x, y, width, height)
                    //ctx.clearRect(canvXOffset, canvYOffset, canvWidth, canvHeight);
                    // fix? artifact!! (maybe line-width caused?!!!)
                    ctx.clearRect(canvXOffset-2, canvYOffset, canvWidth+2, canvHeight);

                    // Copy the content back to the original canvas
                    //  drawImage(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
                    ctx.drawImage(offScreenCanvas, 0, 0, canvWidth - scrollSpeed, canvHeight, canvXOffset, canvYOffset, canvWidth - scrollSpeed, canvHeight);
                  }
                }

                // Set the solid line pattern
                ctx.setLineDash([]); // Empty array for solid line

                // Draw the new line segment
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(${prevXOffset}, ${prevYOffset});
                ctx.lineTo(${currXOffset}, ${currYOffset});
                ctx.stroke();
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update channel data:', error);
      }
      //if (didScroll) {
      //  this.dbgUpdateCount = 0; // stop after first scroll
      //}
    }
  }

  private updatePlotChannelLabel(name: string, colorString: string): void {
    if (this.debugWindow) {
      this.logMessage(`at updatePlotChannelLabel(${name}, ${colorString})`);
      try {
        const channelLabel: string = `<span style="color: ${colorString};">${name}</span>`;
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            const labelsDivision = document.getElementById('channel-titles');
            if (labelsDivision) {
              let labelContent = labelsDivision.innerHTML;
              if (labelContent.includes('{labels here}')) {
                labelContent = ''; // remove placeholder span
              }
              labelContent += '${channelLabel}';
              labelsDivision.innerHTML = labelContent;
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update channel label:', error);
      }
    }
  }

  private drawHorizontalLine(canvasName: string, channelSpec: PlotChannelSpec, YOffset: number, gridColor: string) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalLine(${canvasName}, ${YOffset}, ${gridColor})`);
      try {
        const atTop: boolean = YOffset == channelSpec.maxValue;
        const horizLineWidth: number = 2;
        const lineYOffset: number =
          (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
          this.channelInset +
          this.canvasMargin;
        const lineXOffset: number = this.canvasMargin;
        this.logMessage(`  -- atTop=(${atTop}), lineY=(${lineYOffset})`);
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            // Locate the canvas element by its ID
            const canvas = document.getElementById('${canvasName}');

            if (canvas && canvas instanceof HTMLCanvasElement) {
              // Get the canvas context
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Set the line color and width
                const lineColor = '${gridColor}';
                const lineWidth = ${horizLineWidth};
                const canWidth = canvas.width - (2 * ${this.canvasMargin});

                // Set the dash pattern
                ctx.setLineDash([3, 3]); // 3px dash, 3px gap

                // Draw the line
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(${lineXOffset}, ${lineYOffset});
                ctx.lineTo(canWidth, ${lineYOffset});
                ctx.stroke();
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update line:', error);
      }
    }
  }

  private drawHorizontalValue(canvasName: string, channelSpec: PlotChannelSpec, YOffset: number, textColor: string) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalValue(${canvasName}, ${YOffset}, ${textColor})`);
      try {
        const atTop: boolean = YOffset == channelSpec.maxValue;
        const lineYOffset: number = atTop ? this.channelInset : channelSpec.ySize + this.channelInset;
        const textYOffset: number = lineYOffset + (atTop ? 0 : 5); // 9pt font: offset text to top? rise from baseline, bottom? descend from line
        const textXOffset: number = 5 + this.canvasMargin;
        const value: number = atTop ? channelSpec.maxValue : channelSpec.minValue;
        const valueText: string = this.stringForRangeValue(value);
        this.logMessage(`  -- atTop=(${atTop}), lineY=(${lineYOffset}), text=[${valueText}]`);
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            // Locate the canvas element by its ID
            const canvas = document.getElementById('${canvasName}');

            if (canvas && canvas instanceof HTMLCanvasElement) {
              // Get the canvas context
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Set the line color and width
                const lineColor = '${textColor}';
                //const lineWidth = 2;

                // Set the dash pattern
                //ctx.setLineDash([]); // Empty array for solid line

                // Add text
                ctx.font = '9px Arial';
                ctx.fillStyle = lineColor;
                ctx.fillText('${valueText}', ${textXOffset}, ${textYOffset});
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update text:', error);
      }
    }
  }

  private drawHorizontalLineAndValue(
    canvasName: string,
    channelSpec: PlotChannelSpec,
    YOffset: number,
    gridColor: string,
    textColor: string
  ) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalLineAndValue(${canvasName}, ${YOffset}, ${gridColor}, ${textColor})`);
      try {
        const atTop: boolean = YOffset == channelSpec.maxValue;
        const horizLineWidth: number = 2;
        const lineYOffset: number =
          (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
          this.channelInset +
          this.canvasMargin;
        const lineXOffset: number = this.canvasMargin;
        const textYOffset: number = lineYOffset + (atTop ? 0 : 5); // 9pt font: offset text to top? rise from baseline, bottom? descend from line
        const textXOffset: number = 5 + this.canvasMargin;
        const value: number = atTop ? channelSpec.maxValue : channelSpec.minValue;
        const valueText: string = this.stringForRangeValue(value);
        this.logMessage(`  -- atTop=(${atTop}), lineY=(${lineYOffset}), valueText=[${valueText}]`);
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            // Locate the canvas element by its ID
            const canvas = document.getElementById('${canvasName}');

            if (canvas && canvas instanceof HTMLCanvasElement) {
              // Get the canvas context
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Set the line color and width
                const lineColor = '${gridColor}';
                const textColor = '${textColor}';
                const lineWidth = ${horizLineWidth};
                const canWidth = canvas.width - (2 * ${this.canvasMargin});

                // Set the dash pattern
                ctx.setLineDash([3, 3]); // 5px dash, 3px gap

                // Measure the text width
                ctx.font = '9px Arial';
                const textMetrics = ctx.measureText('${valueText}');
                const textWidth = textMetrics.width;

                // Draw the line
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(textWidth + 8 + ${lineXOffset}, ${lineYOffset}); // start of line
                ctx.lineTo(canWidth, ${lineYOffset}); // draw to end of line
                ctx.stroke();

                // Add text
                ctx.fillStyle = textColor;
                ctx.fillText('${valueText}', ${textXOffset}, ${textYOffset});
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update line & text:', error);
      }
    }
  }

  private scaleAndInvertValue(value: number, channelSpec: PlotChannelSpec): number {
    // scale the value to the vertical channel size then invert the value
    let possiblyScaledValue: number = value;
    const range: number = channelSpec.maxValue - channelSpec.minValue;
    // if value range is different from display range then scale it
    if (channelSpec.ySize != range && range != 0) {
      const adjustedValue = value - channelSpec.minValue;
      possiblyScaledValue = Math.round((adjustedValue / range) * (channelSpec.ySize - 1));
    }
    const invertedValue: number = channelSpec.ySize - 1 - possiblyScaledValue;
    if (this.dbgLogMessageCount > 0) {
      this.logMessage(
        `  -- scaleAndInvertValue(${value}) => (${possiblyScaledValue}->${invertedValue}) range=[${channelSpec.minValue}:${channelSpec.maxValue}] ySize=(${channelSpec.ySize})`
      );
    }
    return invertedValue;
  }

  private stringForRangeValue(value: number): string {
    // add +/- prefix to range value
    const prefix: string = value < 0 ? '' : '+';
    const valueString: string = `${prefix}${value} `;
    return valueString;
  }
}
