/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow } from 'electron';
// src/classes/debugScopeWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './debugColor';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { ScopeTriggerProcessor } from './shared/triggerProcessor';
import { DisplaySpecParser } from './shared/displaySpecParser';

import {
  DebugWindowBase,
  ePackedDataMode,
  ePackedDataWidth,
  PackedDataMode,
  Position,
  Size,
  WindowColor
} from './debugWindowBase';

export interface ScopeDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  title: string; // for BaseDisplaySpec compatibility
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

export interface ScopeChannelSpec {
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

interface ScopeChannelSamples {
  samples: number[];
}

export interface ScopeTriggerSpec {
  // trigger
  trigEnabled: boolean;
  trigAuto: boolean;
  trigChannel: number; // if channel is -1 then trigger is disabled
  trigArmLevel: number;
  trigLevel: number;
  trigSlope: string; // 'Positive', 'Negative', or 'Either'
  trigRtOffset: number;
  trigHoldoff: number; // in samples required, from trigger to trigger
}

export class DebugScopeWindow extends DebugWindowBase {
  private displaySpec: ScopeDisplaySpec = {} as ScopeDisplaySpec;
  private channelSpecs: ScopeChannelSpec[] = []; // one for each channel
  private channelSamples: ScopeChannelSamples[] = []; // one for each channel
  private triggerSpec: ScopeTriggerSpec = {} as ScopeTriggerSpec;
  private isFirstNumericData: boolean = true;
  private channelInset: number = 10; // 10 pixels from top and bottom of window
  private contentInset: number = 10; // 10 pixels from left and right of window
  private canvasMargin: number = 0; // 3 pixels from left, right, top, and bottom of canvas (NOT NEEDED)
  private channelLineWidth: number = 2; // 2 pixels wide for channel data line
  private packedMode: PackedDataMode = {} as PackedDataMode;
  private canvasRenderer: CanvasRenderer = new CanvasRenderer();
  private triggerProcessor: ScopeTriggerProcessor;
  // Trigger state properties
  private triggerArmed: boolean = false;
  private triggerFired: boolean = false;
  private holdoffCounter: number = 0;
  private previousSample: number = 0; // For slope detection
  private triggerSampleIndex: number = -1; // Track which sample caused the trigger
  // diagnostics used to limit the number of samples displayed while testing
  private dbgUpdateCount: number = 260; // NOTE 120 (no scroll) ,140 (scroll plus more), 260 scroll twice;
  private dbgLogMessageCount: number = 256 + 1; // log first N samples then stop (2 channel: 128+1 is 64 samples)

  constructor(ctx: Context, displaySpec: ScopeDisplaySpec) {
    super(ctx);
    this.windowLogPrefix = 'scoW';
    // record our Debug Scope Window Spec
    this.displaySpec = displaySpec;
    // init default Trigger Spec
    this.triggerSpec = {
      trigEnabled: false,
      trigAuto: false,
      trigChannel: -1,
      trigArmLevel: 0,
      trigLevel: 0,
      trigSlope: 'Positive',
      trigRtOffset: 0,
      trigHoldoff: 0
    };
    // Initialize the trigger processor
    this.triggerProcessor = new ScopeTriggerProcessor();
    // initially we don't have a packed mode...
    this.packedMode = {
      mode: ePackedDataMode.PDM_UNKNOWN,
      bitsPerSample: 0,
      valueSize: ePackedDataWidth.PDW_UNKNOWN,
      isAlternate: false,
      isSigned: false
    };
  }

  get windowTitle(): string {
    let desiredValue: string = `${this.displaySpec.displayName} SCOPE`;
    if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
      desiredValue = this.displaySpec.windowTitle;
    }
    return desiredValue;
  }

  static parseScopeDeclaration(lineParts: string[]): [boolean, ScopeDisplaySpec] {
    // here with lineParts = ['`SCOPE', {displayName}, ...]
    // Valid directives are:
    //   TITLE <title>
    //   POS <left> <top> [default: 0,0]
    //   SIZE <width> <height> [ea. 32-2048, default: 256]
    //   SAMPLES <nbr> [16-2048, default: 256]
    //   RATE <rate> [1-2048, default: 1]
    //   DOTSIZE <pix> [0-32, default: 0]
    //   LINESIZE <half-pix> [0-32, default: 3]
    //   TEXTSIZE <half-pix> [6-200, default: editor font size]
    //   COLOR <bgnd-color> {<grid-color>} [BLACK, GRAY 4]
    //   packed_data_mode
    //   HIDEXY
    console.log(`CL: at parseScopeDeclaration()`);
    let displaySpec: ScopeDisplaySpec = {} as ScopeDisplaySpec;
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY3', 4);
    console.log(`CL: at parseScopeDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.size = { width: 256, height: 256 };
    displaySpec.nbrSamples = 256;
    displaySpec.rate = 1;
    displaySpec.dotSize = 0; // Default from comment
    displaySpec.lineSize = 3; // Default from comment
    displaySpec.textSize = 12; // Default editor font size - will be adjusted if needed
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;

    // now parse overrides to defaults
    console.log(`CL: at overrides ScopeDisplaySpec: ${lineParts}`);
    if (lineParts.length > 1) {
      displaySpec.displayName = lineParts[1];
      isValid = true; // invert default value
    }
    if (lineParts.length > 2) {
      for (let index = 2; index < lineParts.length; index++) {
        const element = lineParts[index];
        
        // Try to parse common keywords first
        const [parsed, newIndex] = DisplaySpecParser.parseCommonKeywords(lineParts, index, displaySpec);
        if (parsed) {
          index = newIndex - 1; // Adjust for loop increment
        } else {
          switch (element.toUpperCase()) {
            case 'COLOR':
              // Parse COLOR directive: COLOR <background> {<grid-color>}
              const [colorParsed, colors, colorIndex] = DisplaySpecParser.parseColorKeyword(lineParts, index);
              if (colorParsed) {
                displaySpec.window.background = colors.background;
                if (colors.grid) {
                  displaySpec.window.grid = colors.grid;
                }
                index = colorIndex - 1; // Adjust for loop increment
              } else {
                console.log(`CL: ScopeDisplaySpec: Invalid COLOR specification`);
                isValid = false;
              }
              break;
              
            case 'POS':
              // POS is not in the original scope parser but should be supported
              const [posParsed, pos] = DisplaySpecParser.parsePosKeyword(lineParts, index);
              if (posParsed) {
                displaySpec.position = pos;
                index += 2; // Skip x and y values
              } else {
                console.log(`CL: ScopeDisplaySpec: Invalid POS specification`);
                isValid = false;
              }
              break;
              
            case 'RATE':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.rate = Number(lineParts[++index]);
              } else {
                console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
              
            case 'HIDEXY':
              displaySpec.hideXY = true;
              break;
              
            // ORIGINAL PARSING COMMENTED OUT - Using DisplaySpecParser instead
            /*
            case 'TITLE':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.windowTitle = lineParts[++index];
              } else {
                // console.log() as we are in class static method, not derived class...
                console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            case 'SIZE':
              // ensure we have two more values
              if (index < lineParts.length - 2) {
                displaySpec.size.width = Number(lineParts[++index]);
                displaySpec.size.height = Number(lineParts[++index]);
              } else {
                console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            case 'SAMPLES':
              // ensure we have two more values
              if (index < lineParts.length - 1) {
                displaySpec.nbrSamples = Number(lineParts[++index]);
              } else {
                console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            */

            default:
              console.log(`CL: ScopeDisplaySpec: Unknown directive: ${element}`);
              break;
          }
        }
        if (!isValid) {
          break;
        }
      }
    }
    console.log(`CL: at end of parseScopeDeclaration(): isValid=(${isValid}), ${JSON.stringify(displaySpec, null, 2)}`);
    return [isValid, displaySpec];
  }

  private createDebugWindow(): void {
    this.logMessage(`at createDebugWindow() SCOPE`);
    // calculate overall canvas sizes then window size from them!
    if (this.channelSpecs.length == 0) {
      // create a DEFAULT channelSpec for only channel
      const defaultColor: DebugColor = new DebugColor('GREEN', 15);
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
    let channelWidth: number = 0;
    if (this.channelSpecs.length > 0) {
      for (let index = 0; index < this.channelSpecs.length; index++) {
        const channelSpec = this.channelSpecs[index];
        const adjHeight = this.channelLineWidth / 2 + this.canvasMargin * 2 + channelSpec.ySize + 2 * this.channelInset; // inset is above and below
        channelWidth = this.canvasMargin * 2 + this.displaySpec.nbrSamples * 2;
        // create a canvas for each channel
        channelCanvases.push(`<canvas id="channel-${index}" width="${channelWidth}" height="${adjHeight}"></canvas>`);
        // account for channel height
        windowCanvasHeight += channelSpec.ySize + 2 * this.channelInset + this.channelLineWidth / 2;
      }
    } else {
      // error if NO channel
      this.logMessage(`at createDebugWindow() SCOPE with NO channels!`);
    }

    this.logMessage(`at createDebugWindow() SCOPE set up done... w/${channelCanvases.length} canvase(s)`);

    // set height so no scroller by default
    const channelLabelHeight = 13; // 13 pixels for channel labels 10pt + gap below
    const canvasePlusWindowHeight = windowCanvasHeight + channelLabelHeight + this.contentInset * 2;
    const windowHeight = Math.max(this.displaySpec.size.height, canvasePlusWindowHeight);
    const windowWidth = Math.max(this.displaySpec.size.width, this.displaySpec.nbrSamples * 2 + this.contentInset * 2); // contentInset' for the Xoffset into window for canvas
    this.logMessage(
      `  -- SCOPE window size: ${windowWidth}x${windowHeight} @${this.displaySpec.position.x},${this.displaySpec.position.y}`
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
      this.logMessage('* Scope window will show...');
      this.debugWindow?.show();
    });

    this.debugWindow.on('show', () => {
      this.logMessage('* Scope window shown');
    });

    this.debugWindow.on('page-title-updated', () => {
      this.logMessage('* Scope window title updated');
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
            font-family: 'Parallax', sans-serif;
            font-size: 12px;
            /* background-color: rgb(237, 142, 238); */
            background-color: ${this.displaySpec.window.background};
            color:rgb(191, 213, 93);
            position: relative;
          }
          #container {
            display: flex;
            flex-direction: column; /* Arrange children in a column */
            justify-content: flex-start;
            margin: ${this.contentInset}px ${this.contentInset}px;  /* vert horiz -OR- top right bottom left */
            padding: 0;
            background-color: ${this.displaySpec.window.background};
          }
          #labels {
            font-family: 'Parallax', sans-serif;
            font-style: italic;
            font-size: 10px;
            /* display: flex; */
            /* flex-direction: row;   Arrange children in a row */
            /* justify-content: flex-start;  left edge grounded */
            /* align-items: top; vertically at top */
            /*  align-items: center;  vertically centered */
            flex-grow: 0;
            gap: 10px; /* Create a 10px gap between items */
            height: ${channelLabelHeight}px;
            padding: 0px 0px 4px 0px;
            /* background-color: rgb(225, 232, 191); */
          }
          #labels > p {
            /* padding: top right bottom left; */
            padding: 0px;
            margin: 0px;
          }
          #channel-data {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            margin: 0;
            /* background-color: rgb(55, 63, 170); */
          }
          #channels {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            margin: 0;   /* top, right, bottom, left */
            padding: 0px;
            border-style: solid;
            border-width: 1px;
            border-color: ${this.displaySpec.window.grid}; */
            /* border-color: rgb(29, 230, 106); */
            background-color: rgb(164, 22, 22);
          }
          canvas {
            /* background-color: rgb(240, 194, 151); */
            background-color: ${this.displaySpec.window.background};
            margin: 0;
          }
          #trigger-status {
            position: absolute;
            top: 5px;
            right: 5px;
            padding: 5px 10px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            font-size: 12px;
            font-family: Arial, sans-serif;
            border-radius: 3px;
            display: none; /* Hidden by default */
            z-index: 100;
          }
          #trigger-status.armed {
            background-color: rgba(255, 165, 0, 0.8); /* Orange for armed */
          }
          #trigger-status.triggered {
            background-color: rgba(0, 255, 0, 0.8); /* Green for triggered */
          }
          .trigger-legend {
            position: absolute;
            right: 5px;
            font-size: 10px;
            font-family: Arial, sans-serif;
            color: white;
            background-color: rgba(0, 0, 0, 0.5);
            padding: 2px 5px;
            border-radius: 2px;
            pointer-events: none;
          }
          @keyframes flash {
            0% { opacity: 0.8; }
            50% { opacity: 1; }
            100% { opacity: 0.8; }
          }
        </style>
      </head>
      <body>
        <div id="trigger-status">READY</div>
        <div id="container">
          <div id="labels" width="${channelWidth}" height="${channelLabelHeight}">
          </div>
          <div id="channel-data">
            <div id="channels">${channelCanvases.join(' ')}</div>
          </div>
      </div>
      </body>
    </html>
  `;

    this.logMessage(`at createDebugWindow() SCOPE with htmlContent: ${htmlContent}`);

    try {
      this.debugWindow.setMenu(null);
      this.debugWindow.loadURL(`data:text/html,${encodeURIComponent(htmlContent)}`);
    } catch (error) {
      this.logMessage(`Failed to load URL: ${error}`);
    }

    // now hook load complete event so we can label and paint the grid/min/max, etc.
    this.debugWindow.webContents.on('did-finish-load', () => {
      this.logMessage('at did-finish-load');
      for (let index = 0; index < this.channelSpecs.length; index++) {
        const channelSpec = this.channelSpecs[index];
        this.updateScopeChannelLabel(channelSpec.name, channelSpec.color);
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
      // Draw trigger levels if enabled
      this.drawTriggerLevels();
    });
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() SCOPE`);
    // let our base class do the work
    this.debugWindow = null;
  }

  public async updateContent(lineParts: string[]): Promise<void> {
    // here with lineParts = ['`{displayName}, ...]
    // Valid directives are:
    // --- these create a new channel spec
    //   '{NAME}' {min {max {y-size {y-base {legend} {color}}}}}
    //   '{NAME}' AUTO {y-size {y-base {legend} {color}}}
    // --- these update the trigger spec
    //   TRIGGER <channel|-1> {arm-level {trigger-level {offset}}}
    //   HOLDOFF <2-2048>
    // --- these manage the window
    //   CLEAR
    //   CLOSE
    //   SAVE {WINDOW} 'filename' // save window to .bmp file
    // --- these paints new samples
    //   <numeric data> // data applied to channels in ascending order
    //this.logMessage(`at updateContent(${lineParts.join(' ')})`);
    // ON first numeric data, create the window! then do update
    if (lineParts.length >= 2) {
      // have data, parse it
      if (lineParts[1].charAt(0) == "'") {
        // parse channel spec
        let channelSpec: ScopeChannelSpec = {} as ScopeChannelSpec;
        channelSpec.name = lineParts[1].slice(1, -1);
        let colorName = 'LIME'; // vs. green
        let colorBrightness = 15;
        if (lineParts[2].toUpperCase() == 'AUTO') {
          // parse AUTO spec - set trigger auto mode for this channel
          //   '{NAME1}' AUTO2 {y-size3 {y-base4 {legend5} {color6 {bright7}}}} // legend is %abcd
          // Auto means we should use auto trigger for this channel
          this.triggerSpec.trigAuto = true;
          this.triggerSpec.trigChannel = this.channelSpecs.length; // Current channel being added
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
          let isNumber: boolean = false;
          let parsedValue: number = 0;
          if (lineParts.length > 2) {
            [isNumber, parsedValue] = this.isSpinNumber(lineParts[2]);
            if (isNumber) {
              channelSpec.minValue = parsedValue;
            }
          }
          if (lineParts.length > 3) {
            [isNumber, parsedValue] = this.isSpinNumber(lineParts[3]);
            if (isNumber) {
              channelSpec.maxValue = parsedValue;
            }
          }
          if (lineParts.length > 4) {
            [isNumber, parsedValue] = this.isSpinNumber(lineParts[4]);
            if (isNumber) {
              channelSpec.ySize = parsedValue;
            }
          }
          if (lineParts.length > 5) {
            [isNumber, parsedValue] = this.isSpinNumber(lineParts[5]);
            if (isNumber) {
              channelSpec.yBaseOffset = parsedValue;
            }
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
        //  arm-level (?-1)
        //  trigger-level (trigFire? 0)
        //  trigger offset (0) samples / 2
        // Holdoff (2-2048) samples
        this.triggerSpec.trigEnabled = true;
        // Update trigger status when first enabled
        if (this.debugWindow) {
          this.updateTriggerStatus();
        }
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
                const [isNumber, trigHoldoff] = this.isSpinNumber(lineParts[4]);
                if (isNumber) {
                  this.triggerSpec.trigHoldoff = trigHoldoff;
                }
              }
            } else if (lineParts[3].toUpperCase() == 'AUTO') {
              this.triggerSpec.trigAuto = true;
              const channelSpec = this.channelSpecs[this.triggerSpec.trigChannel];
              // arm range is 33% of max-min: (high - low) / 3 + low
              const newArmLevel = (channelSpec.maxValue - channelSpec.minValue) / 3 + channelSpec.minValue;
              this.triggerSpec.trigArmLevel = newArmLevel;
              // trigger level is 50% of max-min: (high - low) / 2 + low
              const newTrigLevel = (channelSpec.maxValue - channelSpec.minValue) / 2 + channelSpec.minValue;
              this.triggerSpec.trigLevel = newTrigLevel;
            } else {
              let [isNumber, parsedValue] = this.isSpinNumber(lineParts[3]);
              if (isNumber) {
                this.triggerSpec.trigArmLevel = parsedValue;
              }
              this.triggerSpec.trigAuto = false;
              if (lineParts.length > 4) {
                [isNumber, parsedValue] = this.isSpinNumber(lineParts[4]);
                if (isNumber) {
                  this.triggerSpec.trigLevel = parsedValue;
                }
              }
              if (lineParts.length > 5) {
                [isNumber, parsedValue] = this.isSpinNumber(lineParts[5]);
                if (isNumber) {
                  this.triggerSpec.trigRtOffset = parsedValue;
                }
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
          const [isNumber, parsedValue] = this.isSpinNumber(lineParts[2]);
          if (isNumber) {
            this.triggerSpec.trigHoldoff = parsedValue;
          }
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
        if (lineParts.length >= 2) {
          const saveFileName = this.removeStringQuotes(lineParts[2]);
          // save the window to a file (as BMP)
          await this.saveWindowToBMPFilename(saveFileName);
        } else {
          this.logMessage(`at updateContent() missing SAVE fileName in [${lineParts.join(' ')}]`);
        }
      } else {
        // do we have packed data spec?
        // ORIGINAL CODE COMMENTED OUT - Using PackedDataProcessor instead
        // const [isPackedData, newMode] = this.isPackedDataMode(lineParts[1]);
        // if (isPackedData) {
        //   // remember the new mode so we can unpack the data correctly
        //   this.packedMode = newMode;
        //   // now look for ALT and SIGNED keywords which may follow
        //   if (lineParts.length > 2) {
        //     const nextKeyword = lineParts[2].toUpperCase();
        //     if (nextKeyword == 'ALT') {
        //       this.packedMode.isAlternate = true;
        //       if (lineParts.length > 3) {
        //         const nextKeyword = lineParts[3].toUpperCase();
        //         if (nextKeyword == 'SIGNED') {
        //           this.packedMode.isSigned = true;
        //         }
        //       }
        //     } else if (nextKeyword == 'SIGNED') {
        //       this.packedMode.isSigned = true;
        //     }
        //   }
        
        // Check if current word is a packed data mode
        const [isPackedData, _] = PackedDataProcessor.validatePackedMode(lineParts[1]);
        if (isPackedData) {
          // Collect packed mode and any following keywords
          const keywords: string[] = [];
          let index = 1;
          
          // Add the mode
          keywords.push(lineParts[index]);
          index++;
          
          // Look for ALT and SIGNED keywords
          while (index < lineParts.length) {
            const keyword = lineParts[index].toUpperCase();
            if (keyword === 'ALT' || keyword === 'SIGNED') {
              keywords.push(keyword);
              index++;
            } else {
              break;
            }
          }
          
          // Parse all keywords together
          this.packedMode = PackedDataProcessor.parsePackedModeKeywords(keywords);
        } else {
          // do we have number?
          this.logMessage(`at updateContent() with numeric data: [${lineParts}](${lineParts.length})`);
          const [isValidNumber, numericValue] = this.isSpinNumber(lineParts[1]);
          if (isValidNumber) {
            if (this.isFirstNumericData) {
              this.isFirstNumericData = false;
              this.calculateAutoTriggerAndScale();
              this.initChannelSamples();
              this.createDebugWindow();
            }
            let scopeSamples: number[] = [];
            for (let index = 1; index < lineParts.length; index++) {
              // spin2 output has underscores for commas in numbers, so remove them
              const [isValidNumber, sampleValue] = this.isSpinNumber(lineParts[index]);
              if (isValidNumber) {
                scopeSamples.push(sampleValue);
              } else {
                this.logMessage(
                  `* UPD-ERROR invalid numeric data: lineParts[${index}]=${lineParts[index]} of [${lineParts.join(
                    ' '
                  )}]`
                );
              }
            }

            // FIXME: add packed data mode unpacking here
            // Handle packed data unpacking if packed mode is configured
            if (this.packedMode.mode !== ePackedDataMode.PDM_UNKNOWN) {
              // We have packed data mode - unpack all samples
              const unpackedSamples: number[] = [];
              for (const packedValue of scopeSamples) {
                const samples = PackedDataProcessor.unpackSamples(packedValue, this.packedMode);
                unpackedSamples.push(...samples);
              }
              scopeSamples = unpackedSamples;
              this.logMessage(`* UPD-INFO unpacked ${scopeSamples.length} samples from packed data mode: ${JSON.stringify(this.packedMode)}`);
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
                this.updateScopeChannelData(canvasName, channelSpec, this.channelSamples[chanIdx].samples, didScroll);
              }
            } else {
              this.logMessage(
                `* UPD-ERROR wrong nbr of samples: #${numberChannels} channels, #${nbrSamples} samples of [${lineParts.join(
                  ','
                )}]`
              );
            }
          } else {
            this.logMessage(`* UPD-ERROR  unknown directive: ${lineParts[1]} of [${lineParts.join(' ')}]`);
          }
        }
      }
    }
  }

  private calculateAutoTriggerAndScale() {
    this.logMessage(`at calculateAutoTriggerAndScale()`);
    if (this.triggerSpec.trigAuto && this.triggerSpec.trigChannel >= 0 && 
        this.triggerSpec.trigChannel < this.channelSpecs.length) {
      // Get the channel spec for the trigger channel
      const channelSpec = this.channelSpecs[this.triggerSpec.trigChannel];
      
      // Calculate arm level at 33% from bottom
      const range = channelSpec.maxValue - channelSpec.minValue;
      this.triggerSpec.trigArmLevel = (range / 3) + channelSpec.minValue;
      
      // Calculate trigger level at 50% (center)
      this.triggerSpec.trigLevel = (range / 2) + channelSpec.minValue;
      
      this.logMessage(`Auto-trigger calculated for channel ${this.triggerSpec.trigChannel}:`);
      this.logMessage(`  Range: ${channelSpec.minValue} to ${channelSpec.maxValue}`);
      this.logMessage(`  Arm level (33%): ${this.triggerSpec.trigArmLevel}`);
      this.logMessage(`  Trigger level (50%): ${this.triggerSpec.trigLevel}`);
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
    
    // Handle trigger evaluation if enabled and this is the trigger channel
    if (this.triggerSpec.trigEnabled && channelIndex === this.triggerSpec.trigChannel) {
      // Set trigger levels in the processor
      this.triggerProcessor.setTriggerLevels(
        this.triggerSpec.trigArmLevel,
        this.triggerSpec.trigLevel,
        this.triggerSpec.trigSlope.toLowerCase() as 'positive' | 'negative'
      );
      
      // Process the sample with the trigger processor
      const shouldUpdateDisplay = this.triggerProcessor.processSample(sample, {
        trigHoldoff: this.triggerSpec.trigHoldoff
      });
      
      // Sync our local state with the trigger processor
      const triggerState = this.triggerProcessor.getTriggerState();
      const wasArmed = this.triggerArmed;
      const wasFired = this.triggerFired;
      
      this.triggerArmed = triggerState.armed;
      this.triggerFired = triggerState.fired;
      this.holdoffCounter = triggerState.holdoff;
      
      // Update UI when state changes
      if (wasArmed !== this.triggerArmed || wasFired !== this.triggerFired) {
        this.updateTriggerStatus();
        
        // If we just fired, remember the sample position
        if (!wasFired && this.triggerFired) {
          this.triggerSampleIndex = this.channelSamples[channelIndex]?.samples.length || 0;
          this.updateTriggerPosition();
        }
      }
      
      // Handle holdoff countdown
      if (this.holdoffCounter > 0) {
        this.holdoffCounter--;
        this.updateTriggerStatus();
        if (this.holdoffCounter === 0) {
          // Holdoff expired, reset trigger
          this.triggerArmed = false;
          this.triggerFired = false;
          this.triggerSampleIndex = -1;
          this.triggerProcessor.resetTrigger();
          this.updateTriggerStatus();
        }
      }
      
      // Store current sample as previous for next iteration
      this.previousSample = sample;
      
      // Only update display if no trigger enabled or trigger conditions met
      if (!this.triggerSpec.trigEnabled || !this.triggerArmed || this.triggerFired) {
        // Proceed with normal sample recording
      } else {
        // Trigger enabled but not fired yet, skip this sample
        return false;
      }
    }
    
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

  private parseLegend(legend: string, channelSpec: ScopeChannelSpec): void {
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

  private updateScopeChannelData(
    canvasName: string,
    channelSpec: ScopeChannelSpec,
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
          `at updateScopeChannelData(${canvasName}, w/#${samples.length}) sample(s), didScroll=(${didScroll})`
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
        // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
        // this.debugWindow.webContents.executeJavaScript(`
        //   (function() {
        //     // Locate the canvas element by its ID
        //     const canvas = document.getElementById('${canvasName}');
        //
        //     if (canvas && canvas instanceof HTMLCanvasElement) {
        //       // Get the canvas context
        //       const ctx = canvas.getContext('2d');
        //
        //       if (ctx) {
        //         // Set the line color and width
        //         const lineColor = '${channelColor}';
        //         const lineWidth = ${this.channelLineWidth};
        //         const scrollSpeed = lineWidth;
        //         const canvWidth = ${drawWidth};
        //         const canvHeight = ${drawHeight};
        //         const canvXOffset = ${drawXOffset};
        //         const canvYOffset = ${drawYOffset};
        //
        //         if (${didScroll}) {
        //           // Create an off-screen canvas
        //           const offScreenCanvas = document.createElement('canvas');
        //           offScreenCanvas.width = canvWidth - scrollSpeed;
        //           offScreenCanvas.height = canvHeight;
        //           const offScreenCtx = offScreenCanvas.getContext('2d');
        //
        //           if (offScreenCtx) {
        //             // Copy the relevant part of the canvas to the off-screen canvas
        //             //  drawImage(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
        //             offScreenCtx.drawImage(canvas, scrollSpeed + canvXOffset, canvYOffset, canvWidth - scrollSpeed, canvHeight, 0, 0, canvWidth - scrollSpeed, canvHeight);
        //
        //             // Clear the original canvas
        //             //  clearRect(x, y, width, height)
        //             //ctx.clearRect(canvXOffset, canvYOffset, canvWidth, canvHeight);
        //             // fix? artifact!! (maybe line-width caused?!!!)
        //             ctx.clearRect(canvXOffset-2, canvYOffset, canvWidth+2, canvHeight);
        //
        //             // Copy the content back to the original canvas
        //             //  drawImage(canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
        //             ctx.drawImage(offScreenCanvas, 0, 0, canvWidth - scrollSpeed, canvHeight, canvXOffset, canvYOffset, canvWidth - scrollSpeed, canvHeight);
        //           }
        //         }
        //
        //         // Set the solid line pattern
        //         ctx.setLineDash([]); // Empty array for solid line
        //
        //         // Draw the new line segment
        //         ctx.strokeStyle = lineColor;
        //         ctx.lineWidth = lineWidth;
        //         ctx.beginPath();
        //         ctx.moveTo(${prevXOffset}, ${prevYOffset});
        //         ctx.lineTo(${currXOffset}, ${currYOffset});
        //         ctx.stroke();
        //       }
        //     }
        //   })();
        // `);
        
        let jsCode = '';
        
        // Handle scrolling if needed
        if (didScroll) {
          const scrollSpeed = this.channelLineWidth;
          jsCode += this.canvasRenderer.scrollCanvas(canvasName, scrollSpeed, drawWidth, drawHeight, drawXOffset, drawYOffset);
        }
        
        // Draw the scope signal line
        jsCode += this.canvasRenderer.drawLine(
          canvasName,
          prevXOffset,
          prevYOffset,
          currXOffset,
          currYOffset,
          channelColor,
          this.channelLineWidth
        );
        
        // Execute all the JavaScript at once
        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCode} })();`);
      } catch (error) {
        console.error('Failed to update channel data:', error);
      }
      //if (didScroll) {
      //  this.dbgUpdateCount = 0; // stop after first scroll
      //}
    }
  }

  private updateScopeChannelLabel(name: string, colorString: string): void {
    if (this.debugWindow) {
      this.logMessage(`at updateScopeChannelLabel(${name}, ${colorString})`);
      try {
        const channelLabel: string = `<p style="color: ${colorString};">${name}</p>`;
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            const labelsDivision = document.getElementById('labels');
            if (labelsDivision) {
              let labelContent = labelsDivision.innerHTML;
              labelContent += \'${channelLabel}\';
              labelsDivision.innerHTML = labelContent;
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update channel label:', error);
      }
    }
  }

  private drawHorizontalLine(canvasName: string, channelSpec: ScopeChannelSpec, YOffset: number, gridColor: string, lineWidth: number = 1) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalLine(${canvasName}, ${YOffset}, ${gridColor}, width=${lineWidth})`);
      try {
        const atTop: boolean = YOffset == channelSpec.maxValue;
        const horizLineWidth: number = 2;
        const lineYOffset: number =
          (atTop ? 0 - 1 : channelSpec.ySize + horizLineWidth / 2 + this.channelLineWidth / 2) +
          this.channelInset +
          this.canvasMargin;
        const lineXOffset: number = this.canvasMargin;
        this.logMessage(`  -- atTop=(${atTop}), lineY=(${lineYOffset})`);
        // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
        // this.debugWindow.webContents.executeJavaScript(`
        //   (function() {
        //     // Locate the canvas element by its ID
        //     const canvas = document.getElementById('${canvasName}');
        //
        //     if (canvas && canvas instanceof HTMLCanvasElement) {
        //       // Get the canvas context
        //       const ctx = canvas.getContext('2d');
        //
        //       if (ctx) {
        //         // Set the line color and width
        //         const lineColor = \'${gridColor}\';
        //         const lineWidth = ${horizLineWidth};
        //         const canWidth = canvas.width - (2 * ${this.canvasMargin});
        //
        //         // Set the dash pattern
        //         ctx.setLineDash([3, 3]); // 3px dash, 3px gap
        //
        //         // Draw the line
        //         ctx.strokeStyle = lineColor;
        //         ctx.lineWidth = lineWidth;
        //         ctx.beginPath();
        //         ctx.moveTo(${lineXOffset}, ${lineYOffset});
        //         ctx.lineTo(canWidth, ${lineYOffset});
        //         ctx.stroke();
        //       }
        //     }
        //   })();
        // `);
        
        // Generate the JavaScript code using CanvasRenderer
        const jsCode = this.canvasRenderer.drawDashedLine(
          canvasName,
          lineXOffset,
          lineYOffset,
          0, // Will be replaced with dynamic width
          lineYOffset,
          gridColor,
          horizLineWidth,
          [3, 3]
        ).replace('ctx.lineTo(0,', 'ctx.lineTo(canvas.width - (2 * ' + this.canvasMargin + '),');
        
        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCode} })();`);
      } catch (error) {
        console.error('Failed to update line:', error);
      }
    }
  }

  private drawHorizontalValue(canvasName: string, channelSpec: ScopeChannelSpec, YOffset: number, textColor: string) {
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
        // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
        // this.debugWindow.webContents.executeJavaScript(`
        //   (function() {
        //     // Locate the canvas element by its ID
        //     const canvas = document.getElementById('${canvasName}');
        //
        //     if (canvas && canvas instanceof HTMLCanvasElement) {
        //       // Get the canvas context
        //       const ctx = canvas.getContext('2d');
        //
        //       if (ctx) {
        //         // Set the line color and width
        //         const lineColor = \'${textColor}\';
        //         //const lineWidth = 2;
        //
        //         // Set the dash pattern
        //         //ctx.setLineDash([]); // Empty array for solid line
        //
        //         // Add text
        //         ctx.font = '9px Arial';
        //         ctx.fillStyle = lineColor;
        //         ctx.fillText('${valueText}', ${textXOffset}, ${textYOffset});
        //       }
        //     }
        //   })();
        // `);
        
        const jsCode = this.canvasRenderer.drawText(
          canvasName,
          valueText,
          textXOffset,
          textYOffset,
          textColor,
          '9px',
          'Arial',
          'left',
          'top'
        );
        
        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCode} })();`);
      } catch (error) {
        console.error('Failed to update text:', error);
      }
    }
  }

  private drawHorizontalLineAndValue(
    canvasName: string,
    channelSpec: ScopeChannelSpec,
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
        // ORIGINAL CODE COMMENTED OUT - Using CanvasRenderer instead
        // this.debugWindow.webContents.executeJavaScript(`
        //   (function() {
        //     // Locate the canvas element by its ID
        //     const canvas = document.getElementById('${canvasName}');
        //
        //     if (canvas && canvas instanceof HTMLCanvasElement) {
        //       // Get the canvas context
        //       const ctx = canvas.getContext('2d');
        //
        //       if (ctx) {
        //         // Set the line color and width
        //         const lineColor = \'${gridColor}\';
        //         const textColor = \'${textColor}\';
        //         const lineWidth = ${horizLineWidth};
        //         const canWidth = canvas.width - (2 * ${this.canvasMargin});
        //
        //         // Set the dash pattern
        //         ctx.setLineDash([3, 3]); // 5px dash, 3px gap
        //
        //         // Measure the text width
        //         ctx.font = '9px Arial';
        //         const textMetrics = ctx.measureText(\'${valueText}\');
        //         const textWidth = textMetrics.width;
        //
        //         // Draw the line
        //         ctx.strokeStyle = lineColor;
        //         ctx.lineWidth = lineWidth;
        //         ctx.beginPath();
        //         ctx.moveTo(textWidth + 8 + ${lineXOffset}, ${lineYOffset}); // start of line
        //         ctx.lineTo(canWidth, ${lineYOffset}); // draw to end of line
        //         ctx.stroke();
        //
        //         // Add text
        //         ctx.fillStyle = textColor;
        //         ctx.fillText(\'${valueText}\', ${textXOffset}, ${textYOffset});
        //       }
        //     }
        //   })();
        // `);
        
        // Need to measure text width and get canvas width dynamically
        const jsCode = `
          const canvas = document.getElementById('${canvasName}');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Measure text width
              ctx.font = '9px Arial';
              const textMetrics = ctx.measureText('${valueText}');
              const textWidth = textMetrics.width;
              const canWidth = canvas.width - (2 * ${this.canvasMargin});
              
              // Draw the dashed line after the text
              ${this.canvasRenderer.drawDashedLine(
                canvasName,
                0, // Will be replaced
                lineYOffset,
                0, // Will be replaced
                lineYOffset,
                gridColor,
                horizLineWidth,
                [3, 3]
              ).replace('ctx.moveTo(0,', 'ctx.moveTo(textWidth + 8 + ' + lineXOffset + ',').replace('ctx.lineTo(0,', 'ctx.lineTo(canWidth,')}
              
              // Draw the text
              ${this.canvasRenderer.drawText(
                canvasName,
                '${valueText}',
                textXOffset,
                textYOffset,
                textColor,
                '9px Arial'
              )}
            }
          }
        `;
        
        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCode} })();`);
      } catch (error) {
        console.error('Failed to update line & text:', error);
      }
    }
  }

  private scaleAndInvertValue(value: number, channelSpec: ScopeChannelSpec): number {
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
  
  private updateTriggerStatus(): void {
    if (this.debugWindow && this.triggerSpec.trigEnabled) {
      let statusText = 'READY';
      let statusClass = 'trigger-status'; // Base class
      
      if (this.holdoffCounter > 0) {
        statusText = `HOLDOFF (${this.holdoffCounter})`;
        statusClass += ' triggered';
      } else if (this.triggerFired) {
        statusText = 'TRIGGERED';
        statusClass += ' triggered';
      } else if (this.triggerArmed) {
        statusText = 'ARMED';
        statusClass += ' armed';
      }
      
      // Update window title to show trigger status
      const baseTitle = this.displaySpec.windowTitle;
      this.debugWindow.setTitle(`${baseTitle} - ${statusText}`);
      
      // Update HTML status element
      const channelInfo = this.triggerSpec.trigChannel >= 0 ? 
        `CH${this.triggerSpec.trigChannel + 1}` : '';
      const levelInfo = `T:${this.triggerSpec.trigLevel.toFixed(1)} A:${this.triggerSpec.trigArmLevel.toFixed(1)}`;
      
      this.debugWindow.webContents.executeJavaScript(`
        (function() {
          const statusEl = document.getElementById('trigger-status');
          if (statusEl) {
            statusEl.innerHTML = '${statusText}<br><span style="font-size: 10px;">${channelInfo} ${levelInfo}</span>';
            statusEl.className = '${statusClass}';
            statusEl.style.display = 'block';
          }
        })();
      `);
    } else if (this.debugWindow) {
      // Hide trigger status when disabled
      this.debugWindow.webContents.executeJavaScript(`
        (function() {
          const statusEl = document.getElementById('trigger-status');
          if (statusEl) statusEl.style.display = 'none';
        })();
      `);
      
      // Reset window title
      this.debugWindow.setTitle(this.displaySpec.windowTitle);
    }
  }
  
  private updateTriggerPosition(): void {
    if (this.debugWindow && this.triggerSpec.trigEnabled && this.triggerFired) {
      // For scope, the trigger position is at the current sample offset
      const triggerXPos = this.canvasMargin + this.triggerSpec.trigRtOffset * this.channelLineWidth;
      
      // Draw a vertical line at the trigger position for all channels
      let allJsCode = '';
      for (let chanIdx = 0; chanIdx < this.channelSpecs.length; chanIdx++) {
        const canvasName = `channel-${chanIdx}`;
        const channelSpec = this.channelSpecs[chanIdx];
        
        // Draw vertical trigger position line with glow effect
        const jsCode = this.canvasRenderer.drawLine(
          canvasName,
          triggerXPos,
          this.channelInset + this.canvasMargin,
          triggerXPos,
          this.channelInset + this.canvasMargin + channelSpec.ySize,
          'rgba(255, 0, 0, 0.8)', // Red trigger line
          2
        );
        
        // Add a second line for glow effect
        const glowCode = this.canvasRenderer.drawLine(
          canvasName,
          triggerXPos,
          this.channelInset + this.canvasMargin,
          triggerXPos,
          this.channelInset + this.canvasMargin + channelSpec.ySize,
          'rgba(255, 0, 0, 0.3)', // Semi-transparent for glow
          4
        );
        
        allJsCode += jsCode + glowCode;
      }
      
      // Add trigger position marker at top
      if (this.channelSpecs.length > 0) {
        const markerCode = this.canvasRenderer.drawText(
          'channel-0',
          '▼',
          triggerXPos - 5,
          this.canvasMargin - 2,
          'rgba(255, 0, 0, 0.9)',
          '12px Arial'
        );
        allJsCode += markerCode;
      }
      
      this.debugWindow.webContents.executeJavaScript(`(function() { ${allJsCode} })();`);
    }
  }
  
  private drawTriggerLevels(): void {
    if (this.debugWindow && this.triggerSpec.trigEnabled && 
        this.triggerSpec.trigChannel >= 0 && this.triggerSpec.trigChannel < this.channelSpecs.length) {
      const chanIdx = this.triggerSpec.trigChannel;
      const canvasName = `channel-${chanIdx}`;
      const channelSpec = this.channelSpecs[chanIdx];
      const canvasWidth = this.displaySpec.nbrSamples * this.channelLineWidth + this.canvasMargin;
      
      // Draw arm level (orange solid line with label)
      if (this.triggerSpec.trigArmLevel >= channelSpec.minValue && 
          this.triggerSpec.trigArmLevel <= channelSpec.maxValue) {
        const armYInverted = this.scaleAndInvertValue(this.triggerSpec.trigArmLevel, channelSpec);
        const armYOffset = this.channelInset + this.canvasMargin + armYInverted;
        
        // Draw solid orange line
        const jsCodeArm = this.canvasRenderer.drawLine(
          canvasName,
          this.canvasMargin,
          armYOffset,
          canvasWidth,
          armYOffset,
          'rgba(255, 165, 0, 0.8)', // Orange for arm level
          1
        );
        
        // Add "ARM" label
        const armLabelCode = this.canvasRenderer.drawText(
          canvasName,
          'ARM',
          canvasWidth - 35,
          armYOffset - 2,
          'rgba(255, 165, 0, 0.9)',
          '9px Arial'
        );
        
        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCodeArm} ${armLabelCode} })();`);
      }
      
      // Draw trigger level (green solid line with label)
      if (this.triggerSpec.trigLevel >= channelSpec.minValue && 
          this.triggerSpec.trigLevel <= channelSpec.maxValue) {
        const trigYInverted = this.scaleAndInvertValue(this.triggerSpec.trigLevel, channelSpec);
        const trigYOffset = this.channelInset + this.canvasMargin + trigYInverted;
        
        // Draw solid green line (thicker)
        const jsCodeTrig = this.canvasRenderer.drawLine(
          canvasName,
          this.canvasMargin,
          trigYOffset,
          canvasWidth,
          trigYOffset,
          'rgba(0, 255, 0, 0.8)', // Green for trigger level
          2
        );
        
        // Add "TRIG" label
        const trigLabelCode = this.canvasRenderer.drawText(
          canvasName,
          'TRIG',
          canvasWidth - 35,
          trigYOffset - 2,
          'rgba(0, 255, 0, 0.9)',
          '9px Arial'
        );
        
        this.debugWindow.webContents.executeJavaScript(`(function() { ${jsCodeTrig} ${trigLabelCode} })();`);
      }
    }
  }
}
