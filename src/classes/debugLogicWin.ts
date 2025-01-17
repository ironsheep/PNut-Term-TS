/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow, Menu } from 'electron';
// src/classes/debugLogicWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './debugColor';

import {
  DebugWindowBase,
  eHorizJustification,
  eTextWeight,
  eVertJustification,
  FontMetrics,
  Position,
  Size,
  TextStyle,
  WindowColor
} from './debugWindowBase';
import { v8_0_0 } from 'pixi.js';

export interface LogicDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  position: Position;
  size: Size;
  nbrSamples: number;
  spacing: number;
  rate: number;
  lineSize: number;
  textSize: number;
  font: FontMetrics;
  window: WindowColor;
  isPackedData: boolean;
  hideXY: boolean;
  channelSpecs: LogicChannelSpec[]; // one for each named channel bit-set
  textStyle: TextStyle;
  logicChannels: number; // number of logic channel bits (32)
  topLogicChannel: number; // top-most logic channel bit (32 - 1)
}

export interface LogicChannelSpec {
  name: string;
  color: string;
  nbrBits: number;
}

export interface LogicChannelBitSpec {
  name: string;
  color: string;
  bitNumber: number;
}

interface LogicChannelSamples {
  samples: number[];
}

export interface LogicTriggerSpec {
  // trigger
  trigEnabled: boolean; // if mask == 0 trigger is disabled
  trigMask: number; // trigger on data & trigMask == trigMatch [default: 0]
  trigMatch: number; // [default: 1]
  trigSampOffset: number; // [default: nbrSamples / 2]
  trigHoldoff: number; // in samples required, from trigger to trigger (default nbrSamples)
}

export class DebugLogicWindow extends DebugWindowBase {
  private displaySpec: LogicDisplaySpec = {} as LogicDisplaySpec;
  private channelSpecs: LogicChannelSpec[] = []; // one for each channel
  private channelBitSpecs: LogicChannelBitSpec[] = []; // one for each channel bit within the 32 possible channels
  private channelSamples: LogicChannelSamples[] = []; // one for each channel
  private triggerSpec: LogicTriggerSpec = {} as LogicTriggerSpec;
  private debugWindow: BrowserWindow | null = null;
  private isFirstNumericData: boolean = true;
  private channelInset: number = 0; // 10 pixels from top and bottom of window
  private contentInset: number = 0; // 10 pixels from left and right of window
  private canvasMargin: number = 0; // 3 pixels from left, right, top, and bottom of canvas (NOT NEEDED)
  private channelLineWidth: number = 2; // 2 pixels wide for channel data line
  private dbgUpdateCount: number = 260; // NOTE 120 (no scroll) ,140 (scroll plus more), 260 scroll twice;
  private dbgLogMessageCount: number = 0; //256 + 1; // log first N samples then stop (2 channel: 128+1 is 64 samples)
  private labelWdith: number = 0; // width of label canvas
  private labelHeight: number = 0; // height of label canvas

  constructor(ctx: Context, displaySpec: LogicDisplaySpec) {
    super(ctx);
    // record our Debug Logic Window Spec
    this.displaySpec = displaySpec;
    // init default Trigger Spec
    this.triggerSpec = {
      trigEnabled: false,
      trigMask: 0,
      trigMatch: 1,
      trigSampOffset: displaySpec.nbrSamples / 2,
      trigHoldoff: 0
    };
  }

  public static colorNameFmChanNumber(chanNumber: number): string {
    const defaultColorNames: string[] = ['LIME', 'RED', 'CYAN', 'YELLOW', 'MAGENTA', 'BLUE', 'ORANGE', 'OLIVE'];
    const desiredName = defaultColorNames[chanNumber % defaultColorNames.length];
    return desiredName;
  }

  get windowTitle(): string {
    let desiredValue: string = `${this.displaySpec.displayName} LOGIC`;
    if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
      desiredValue = this.displaySpec.windowTitle;
    }
    return desiredValue;
  }

  static parseLogicDeclaration(lineParts: string[]): [boolean, LogicDisplaySpec] {
    // here with lineParts = ['`LOGIC', {displayName}, ...]
    // Valid directives are:
    //   TITLE <title>
    //   POS <left> <top> [default: 0,0]
    //   SAMPLES <nbr> [4-2048, default: 32]
    //   SPACING <nbr> [default: 8] // width is SAMPLES * SPACING
    //   RATE <rate> [1-2048, default: 1]
    //   LINESIZE <half-pix> [1-7, default: 1]
    //   TEXTSIZE <half-pix> [6-200, default: editor font size]
    //   COLOR <bgnd-color> {<grid-color>} [BLACK, GREY 4]
    //   'name' {1_32 {color}} [default: 1, default color]
    //   packed_data_mode
    //   HIDEXY
    // where color is: rgb24 value, else BLACK / WHITE or ORANGE / BLUE / GREEN / CYAN / RED / MAGENTA / YELLOW / GRAY followed by an optional 0..15 for brightness (default 8)

    console.log(`CL: at parseLogicDeclaration()`);
    let displaySpec: LogicDisplaySpec = {} as LogicDisplaySpec;
    displaySpec.channelSpecs = []; // ensure this is structured too! (CRASHED without this!)
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    displaySpec.font = {} as FontMetrics; // ensure this is structured too! (CRASHED without this!)
    displaySpec.textStyle = {} as TextStyle; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY', 4);
    console.log(`CL: at parseLogicDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.nbrSamples = 32;
    displaySpec.spacing = 8;
    displaySpec.rate = 1;
    displaySpec.lineSize = 1;
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;
    displaySpec.isPackedData = false;
    displaySpec.hideXY = false;
    displaySpec.textSize = 12;
    this.calcMetricsForFontPtSize(displaySpec.textSize, displaySpec.font);
    const labelTextSyle: number = this.calcStyleFrom(
      eVertJustification.VJ_MIDDLE,
      eHorizJustification.HJ_RIGHT,
      eTextWeight.TW_NORMAL
    );
    this.calcStyleFromBitfield(labelTextSyle, displaySpec.textStyle);
    displaySpec.logicChannels = 32;
    displaySpec.topLogicChannel = displaySpec.logicChannels - 1;

    // now parse overrides to defaults
    console.log(`CL: at overrides LogicDisplaySpec: ${lineParts}`);
    if (lineParts.length > 1) {
      displaySpec.displayName = lineParts[1];
      isValid = true; // invert default value
    }
    if (lineParts.length > 2) {
      for (let index = 2; index < lineParts.length; index++) {
        const element = lineParts[index];
        console.log(`CL: LogicDisplaySpec - element=[${element}] of lineParts[${index}]`);
        if (element.startsWith("'")) {
          // have channel name...
          const newChannelSpec: LogicChannelSpec = {} as LogicChannelSpec;

          const thisGroupNbr: number = displaySpec.channelSpecs.length;
          const defaultChannelColor = new DebugColor(DebugLogicWindow.colorNameFmChanNumber(thisGroupNbr), 15);
          newChannelSpec.color = defaultChannelColor.rgbString; // might be overridden below
          newChannelSpec.nbrBits = 1; // default to 1 bit (may be overridden below)
          console.log(`CL: LogicDisplaySpec - new default: ${JSON.stringify(newChannelSpec, null, 2)}`);

          // display string at cursor position with current colors
          let displayString: string | undefined = undefined;
          const currLinePart = lineParts[index];
          // isolate string and display it. Advance index to next part after close quote
          if (currLinePart.substring(1).includes("'")) {
            // string ends as this single linepart
            displayString = currLinePart.substring(1, currLinePart.length - 1);
            console.log(`CL:  -- displayString=[${displayString}]`);
          } else {
            // this will be a multi-part string
            const stringParts: string[] = [currLinePart.substring(1)];
            console.log(`CL:  -- currLinePart=[${currLinePart}]`);
            while (index < lineParts.length - 1) {
              index++;
              const nextLinePart = lineParts[index];
              console.log(`CL:  -- nextLinePart=[${nextLinePart}]`);
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
          console.log(`CL: LogicDisplaySpec - displayString=[${displayString}]`);
          if (displayString !== undefined) {
            // have name
            newChannelSpec.name = displayString;
            // have name, now process rest of channel spec
            //  ensure we have one more value (nbr-bits) and lineParts[++index] is decimal number
            if (index < lineParts.length - 1 && /^[0-9]+$/.test(lineParts[index + 1])) {
              // if have nbrBits, grab it
              newChannelSpec.nbrBits = Number(lineParts[++index]);
              if (index < lineParts.length - 1 && lineParts[index + 1].includes("'") == false) {
                // if have color, grab it
                const colorOrColorName = lineParts[++index];
                // if color is a number, then it is a rgb24 value
                // NOTE number could be decimal or $ prefixed hex  ($rrggbb) and either could have '_' digit separaters
                const [isValidRgb24, colorHexRgb24] = this.getValidRgb24(colorOrColorName);
                console.log(
                  `CL: LogicDisplaySpec - colorOrColorName: [${colorOrColorName}], isValidRgb24=(${isValidRgb24})`
                );
                if (isValidRgb24) {
                  // color is a number and is converted to #rrbbgg string
                  newChannelSpec.color = colorHexRgb24;
                } else {
                  // color is a name, so grab possible brightness
                  let brightness: number = 8; // default brightness
                  if (index < lineParts.length - 1) {
                    // let's ensure lineParts[++index] is a string of decimal digits or hex digits (hex prefix is $)
                    const brightnessStr = lineParts[++index].replace(/_/g, '');
                    if (brightnessStr.startsWith('$') && /^[0-9A-Fa-f]+$/.test(brightnessStr.substring(1))) {
                      brightness = parseInt(brightnessStr.substring(1), 16);
                    } else if (/^[0-9]+$/.test(brightnessStr)) {
                      brightness = parseInt(brightnessStr, 10);
                    } else {
                      index--; // back up to allow reprocess of this... (not part of color spec!)
                    }
                  }
                  const channelColor = new DebugColor(colorOrColorName, brightness);
                  newChannelSpec.color = channelColor.rgbString;
                }
              }
            }
            console.log(`CL: LogicDisplaySpec - add channelSpec: ${JSON.stringify(newChannelSpec, null, 2)}`);
            displaySpec.channelSpecs.push(newChannelSpec);
          } else {
            console.log(`CL: LogicDisplaySpec: missing closing quote for Channel name [${lineParts.join(' ')}]`);
          }
          console.log(`CL: LogicDisplaySpec - ending at [${lineParts[index]}] of lineParts[${index}]`);
        } else {
          switch (element.toUpperCase()) {
            case 'TITLE':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.windowTitle = lineParts[++index];
              } else {
                // console.log() as we are in class static method, not derived class...
                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            case 'POS':
              // ensure we have two more values
              if (index < lineParts.length - 2) {
                displaySpec.position.x = Number(lineParts[++index]);
                displaySpec.position.y = Number(lineParts[++index]);
              } else {
                console.log(`CL: LogicDisplaySpec: Missing parameter(s) for ${element}`);
                isValid = false;
              }
              break;
            case 'SAMPLES':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.nbrSamples = Number(lineParts[++index]);
              } else {
                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            case 'SPACING':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.nbrSamples = Number(lineParts[++index]);
              } else {
                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            case 'LINESIZE':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.lineSize = Number(lineParts[++index]);
              } else {
                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            case 'TEXTSIZE':
              // ensure we have one more value
              if (index < lineParts.length - 1) {
                displaySpec.textSize = Number(lineParts[++index]);
                DebugLogicWindow.calcMetricsForFontPtSize(displaySpec.textSize, displaySpec.font);
              } else {
                console.log(`CL: LogicDisplaySpec: Missing parameter for ${element}`);
                isValid = false;
              }
              break;
            // FIXME: UNDONE handle COLOR
            // FIXME: UNDONE handle packedDataMode
            case 'HIDEXY':
              // just set it!
              displaySpec.hideXY = true;
              break;

            default:
              console.log(`CL: LogicDisplaySpec: Unknown directive: ${element}`);
              isValid = false;
              break;
          }
        }
        if (!isValid) {
          break;
        }
      }
    }
    console.log(`CL: at end of parseLogicDeclaration(): isValid=(${isValid}), ${JSON.stringify(displaySpec, null, 2)}`);
    return [isValid, displaySpec];
  }

  private createDebugWindow(): void {
    this.logMessage(`at createDebugWindow() LOGIC`);
    // calculate overall canvas sizes then window size from them!

    if (this.displaySpec.channelSpecs.length == 0) {
      // error if NO channel
      this.logMessage(`at createDebugWindow() LOGIC with NO channels!`);
    }

    let labelMaxChars: number = 0;
    let activeBitChannels: number = 0;
    for (let index = 0; index < this.displaySpec.channelSpecs.length; index++) {
      const element = this.displaySpec.channelSpecs[index];
      labelMaxChars = Math.max(labelMaxChars, element.name.length + 2); // add 2 for ' N' suffix
      activeBitChannels += element.nbrBits;
    }

    const labelDivs: string[] = [];
    const dataCanvases: string[] = [];

    const canvasHeight: number = this.displaySpec.font.lineHeight + 4;
    const labelCanvasWidth: number = this.contentInset + labelMaxChars * (this.displaySpec.font.charWidth - 2);
    const dataCanvasWidth: number = this.displaySpec.nbrSamples * this.displaySpec.spacing + this.contentInset; // contentInset' for the Xoffset into window for canvas

    const channelGroupHeight: number = canvasHeight * activeBitChannels;
    const channelGroupWidth: number = labelCanvasWidth + dataCanvasWidth;

    // pass to other users
    this.labelHeight = canvasHeight;
    this.labelWdith = labelCanvasWidth;

    for (let index = 0; index < activeBitChannels; index++) {
      const idNbr: number = activeBitChannels - index - 1;
      labelDivs.push(`<div id="label-${idNbr}" width="${labelCanvasWidth}" height="${canvasHeight}"></div>`);
      dataCanvases.push(`<canvas id="data-${idNbr}" width="${dataCanvasWidth}" height="${canvasHeight}"></canvas>`);
    }

    // set height so NO scroller by default
    const windowHeight = channelGroupHeight + 2; // 2 is fudge to remove scroller; // + 10; // 30 for window menu bar (30 is guess on linux)
    const windowWidth = channelGroupWidth + this.contentInset * 2; // contentInset' for the Xoffset into window for canvas
    this.logMessage(
      `  -- LOGIC window size: ${windowWidth}x${windowHeight} @${this.displaySpec.position.x},${this.displaySpec.position.y}`
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
      this.logMessage('* Logic window closed');
      this.debugWindow = null;
    });

    this.debugWindow.on('close', () => {
      this.logMessage('* Logic window closing...');
    });

    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('* Logic window will show...');
      this.debugWindow?.show();
    });

    this.debugWindow.on('show', () => {
      this.logMessage('* Logic window shown');
    });

    this.debugWindow.on('page-title-updated', () => {
      this.logMessage('* Logic window title updated');
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
            src: url('./fonts/Parallax.ttf') format('truetype');
          }
          body {
            display: flex;
            flex-direction: column;
            margin: 0;
            padding: 0;
            font-family: 'Parallax', sans-serif;
            font-size: 12px;
            background-color:rgb(234, 121, 86);
            //background-color: ${this.displaySpec.window.background};
            color:rgb(191, 213, 93);
          }
          #labels {
            display: flex;
            flex-direction: column; /* Arrange children in a column */
            flex-grow: 0;
            //background-color:rgb(86, 234, 234);
            background-color: ${this.displaySpec.window.background};
            font-family: 'Parallax', sans-serif;
            font-size: 12px;
            width: ${labelCanvasWidth}px;
            border-width: 1px;
            border-style: solid;
            border-color: ${this.displaySpec.window.background};
            padding: 0px;
            margin: 0px;
          }
          #labels > div {
            flex-grow: 0;
            display: flex;
            justify-content: flex-end; /* Horizontally right-aligns the text */
            align-items: center; /* Vertically center the text */
            //background-color:rgba(188, 208, 208, 0.9);
            height: ${canvasHeight}px;
            // padding: top right bottom left;
            padding: 0px 2px 0px 0px;
            margin: 0px;
          }
          #labels > div > p {
            // padding: top right bottom left;
            padding: 0px;
            margin: 0px;
          }
          #data {
            display: flex;
            flex-direction: column; /* Arrange children in a column */
            flex-grow: 0;
            width: ${dataCanvasWidth}px;
            border-width: 1px;
            border-style: solid;
            border-color: ${this.displaySpec.window.grid};
            background-color:rgb(96, 234, 86);
          }
          #container {
            display: flex;
            flex-direction: row; /* Arrange children in a row */
            flex-grow: 0;
          }
          #label-2 {
            background-color:rgb(231, 151, 240);
          }
          #data-2 {
            background-color:rgb(240, 194, 151);
          }
          canvas {
            //background-color:rgb(240, 194, 151);
            //background-color: ${this.displaySpec.window.background};
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div id="container">
          <div id="labels" width="${labelCanvasWidth}" height="${channelGroupHeight}">
            ${labelDivs.join('\n')}
          </div>
          <div id="data" width="${dataCanvasWidth}" height="${channelGroupHeight}">
            ${dataCanvases.join('\n')}
          </div>
        </div>
      </body>
    </html>
  `;

    this.logMessage(`at createDebugWindow() LOGIC with htmlContent: ${htmlContent}`);

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
      // let's populate labels
      this.loadLables();
    });
  }

  private loadLables(): void {
    // create labels for each channel and post it to the window
    let bitNumber: number = 0;
    for (let index = 0; index < this.displaySpec.channelSpecs.length; index++) {
      const channelSpec = this.displaySpec.channelSpecs[index];
      const nbrBits: number = channelSpec.nbrBits;
      const color: string = channelSpec.color;
      let bitIdx: number = 0;
      // generate and set labels
      let chanLabel: string;
      let chanBitNumber: number = bitNumber + bitIdx;
      if (nbrBits == 1) {
        const canvasName = `label-${bitNumber}`; // name only
        chanLabel = `${channelSpec.name}`;
        this.updateLogicChannelLabel(canvasName, chanLabel, color);
      } else {
        for (bitIdx = 0; bitIdx < nbrBits; bitIdx++) {
          chanBitNumber = bitNumber + bitIdx;
          const canvasName = `label-${chanBitNumber}`;
          if (bitIdx == 0) {
            chanLabel = `${channelSpec.name} ${chanBitNumber}`; // name w/bit number suffix
          } else {
            chanLabel = `${chanBitNumber}`; // just bit number
          }
          this.updateLogicChannelLabel(canvasName, chanLabel, color);
        }
      }
      bitNumber += nbrBits;
    }
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() LOGIC`);
    // is destroyed should prevent crash on double close
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.removeAllListeners();
      this.debugWindow.close();
      this.debugWindow = null;
    }
  }

  public updateContent(lineParts: string[]): void {
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
        let channelSpec: LogicChannelSpec = {} as LogicChannelSpec;
        channelSpec.name = lineParts[1].slice(1, -1);
        let colorName = 'GREEN';
        let colorBrightness = 15;
        if (lineParts[2].toUpperCase() == 'AUTO') {
          // parse AUTO spec
          //   '{NAME1}' AUTO2 {y-size3 {y-base4 {legend5} {color6 {bright7}}}} // legend is %abcd
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
        // and record spec for this channel
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with channelSpec: ${JSON.stringify(channelSpec, null, 2)}`);
        this.channelSpecs.push(channelSpec);
      } else if (lineParts[1].toUpperCase() == 'TRIGGER') {
        // parse trigger spec update
        //   TRIGGER1 mask2 match3 {sample_offset4}
        this.triggerSpec.trigEnabled = true;
        let nextIndex: number = 2;
        if (lineParts.length > 2) {
          const maskStr: string = lineParts[2];
          const matchStr: string = lineParts[3];
          nextIndex = 4;
          const mask = this.parseNumericValue(maskStr);
          const match = this.parseNumericValue(matchStr);
          if (mask !== undefined && match !== undefined) {
            this.triggerSpec.trigMask = mask ? mask : 0;
            this.triggerSpec.trigMatch = match ? match : 1;
            if (lineParts.length > 3) {
              const offsetStr: string = lineParts[4];
              nextIndex = 5;
              const offsetInSampels = this.parseNumericValue(maskStr);
              if (
                offsetInSampels !== undefined &&
                offsetInSampels >= 0 &&
                offsetInSampels < this.displaySpec.nbrSamples
              ) {
                this.triggerSpec.trigSampOffset = offsetInSampels;
              } else {
                this.logMessage(
                  `at updateContent() with invalid sample_offset (max samples: ${
                    this.displaySpec.nbrSamples
                  }) in [${lineParts.join(' ')}]`
                );
              }
            }
            if (lineParts[nextIndex].toUpperCase() == 'HOLDOFF') {
              // parse trigger spec update - inline HOLDOFF on TRIGGER line
              //   HOLDOFF1 <2-2048>2
              if (lineParts.length > nextIndex) {
                this.triggerSpec.trigHoldoff = parseFloat(lineParts[nextIndex + 1]);
              } else {
                this.logMessage(
                  `at updateContent() with invalid HOLDOFF @[${nextIndex + 1}] in [${lineParts.join(' ')}]`
                );
              }
            }
          } else {
            this.logMessage(`at updateContent() with invalid mask or match in [${lineParts.join(' ')}]`);
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
        if (nbrSamples == 1) {
          if (this.dbgLogMessageCount > 0) {
            this.logMessage(
              `at updateContent() #${numberChannels} channels, #${nbrSamples} samples of [${scopeSamples.join(
                ','
              )}], lineparts=[${lineParts.join(',')}]`
            );
          }
          /*
          for (let chanIdx = 0; chanIdx < nbrSamples; chanIdx++) {
            let nextSample: number = Number(scopeSamples[chanIdx]);
            //this.logMessage(`* UPD-INFO nextSample: ${nextSample} for channel[${chanIdx}]`);
            // limit the sample to the channel's min/max?!
            const channelSpec = this.channelSpecs[chanIdx];
            // record our sample (shifting left if necessary)
            didScroll = this.recordChannelSample(chanIdx, nextSample);
            // update scope chanel canvas with new sample
            const canvasName = `channel-${chanIdx}`;
            //this.logMessage(`* UPD-INFO recorded (${nextSample}) for ${canvasName}`);
            this.updateLogicChannelData(canvasName, channelSpec, this.channelSamples[chanIdx].samples, didScroll);
          }
          */
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
  private parseNumericValue(value: string): number | undefined {
    // if string is [-][0-9]+ chars then is decimal number
    // if string is '$'[0-9A-Fa-f]+ chars then is hex number
    let desiredValue: number | undefined = undefined;
    if (/^[-]?[0-9]+$/.test(value)) {
      desiredValue = parseInt(value, 10);
    } else if (/^\$[0-9A-Fa-f]+$/.test(value)) {
      desiredValue = parseInt(value.substring(1), 16);
    }
    return desiredValue;
  }

  private calculateAutoTriggerAndScale() {
    // FIXME: UNDONE check if auto is set, if is then calculate the trigger level and scale
    this.logMessage(`at calculateAutoTriggerAndScale()`);
    if (false) {
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

  private parseLegend(legend: string, channelSpec: LogicChannelSpec): void {
    // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
    let validLegend: boolean = false;
  }

  private updateLogicChannelData(
    canvasName: string,
    channelSpec: LogicChannelSpec,
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
          `at updateLogicChannelData(${canvasName}, w/#${samples.length}) sample(s), didScroll=(${didScroll})`
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
        const drawHeight: number = this.channelLineWidth / 2;
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

  private updateLogicChannelLabel(divId: string, label: string, color: string): void {
    if (this.debugWindow) {
      this.logMessage(`at updateLogicChannelLabel('${divId}', '${label}', ${color})`);
      try {
        const labelSpan: string = `<p style="color: ${color};">${label}</p>`;
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            const labelDiv = document.getElementById('${divId}');
            if (labelDiv) {
              labelDiv.innerHTML = \'${labelSpan}'\;
            }
          })();
        `);
      } catch (error) {
        console.error(`Failed to update ${divId}: ${error}`);
      }
    }
  }

  /*
  private writeStringToCanvas(
    canvasId: string,
    text: string,
    labelColor: string,
    width: number,
    height: number,
    font: FontMetrics,
    textStyle: TextStyle
  ): void {
    if (this.debugWindow) {
      this.logMessage(`at writeStringToCanvas('${canvasId}', '${text}' wh=(${width}x${height}))`);
      const textHeight: number = font.charHeight;
      const lineHeight: number = font.lineHeight;
      const charWidth: number = font.charWidth;
      const fontSize: number = font.textSizePts;
      let [textXOffset, textYOffset] = [0, 0];
      // now let's apply alignment effects
      // let's start with horizontal alignment
      let alignHString: string = '';
      let alignVString: string = '';
      switch (textStyle.horizAlign) {
        // NOTE: start, end, left, right, center
        case eHorizJustification.HJ_LEFT:
          alignHString = 'left'; // also start
          textXOffset = 0;
          break;
        case eHorizJustification.HJ_CENTER:
          alignHString = 'center';
          textXOffset = Math.round(width / 2);
          break;
        case eHorizJustification.HJ_RIGHT:
          alignHString = 'right'; // also end
          textXOffset = width;
          break;
      }
      switch (textStyle.vertAlign) {
        // NOTE: top, hanging, middle, alphabetic, ideographic, bottom
        case eVertJustification.VJ_TOP:
          alignVString = 'top';
          textYOffset = 0;
          break;
        case eVertJustification.VJ_MIDDLE:
          alignVString = 'middle';
          textYOffset = Math.round(height / 2);
          break;
        case eVertJustification.VJ_BOTTOM:
          alignVString = 'bottom';
          textYOffset = height;
          break;
      }

      // @xy=30,0 text is showing bottom pixels, centered L/R
      // @xy=30,-12 text is showing bottom pixels, align left?
      // @xy=0,0 [lt,top] - left edge aligned, top edge aligned

      // HORIZ
      //alignHString = 'left';
      alignHString = 'right';
      const maxChars: number = Math.round(width / font.charWidth);
      const extraChars = Math.max(maxChars - text.length, 0);
      this.logMessage(`  -- maxChars=[${maxChars}], extraChars=[${extraChars}]`);
      const leftEdgeOffset = (extraChars - 1) * font.charWidth; // 6 is a fudge factor (if too wide text moves to next line!)
      const textWidth: number = text.length * font.charWidth;
      this.logMessage(`  -- textWidth=[${textWidth}], leftEdgeOffset=[${leftEdgeOffset}]`);
      //textXOffset = Math.min(leftEdgeOffset, width - font.charWidth - 2);
      // attempt manually align "Mid 3" label
      textXOffset = 10; // 5 ok, 8 ok
      if (text.length < 4) {
        textXOffset = 12; // our number only labels // 30 bad, 15 offset in Y? 13 also?
      } else if (text.length < 5) {
        textXOffset += 1; // our text only label // 4 offset in Y?, 2 also?
      }

      textXOffset = width - 10;

      // VERT
      //alignVString = 'top';
      //textYOffset = Math.round((height - font.charHeight) / 2); // attempt vertical centering
      alignVString = 'bottom';
      textYOffset = height - 10; // attempt vertical centering

      const textColor: string = labelColor;
      const fontWeight: string = this.fontWeightName(textStyle);
      const fontStyle: string = textStyle.italic ? 'italic ' : '';
      //const fontSpec: string = `${fontStyle}${fontWeight} ${fontSize}pt Parallax sans-serif`; // was Consolas
      const fontSpec: string = `${fontStyle}${fontWeight} ${fontSize}pt Consolas sans-serif`;
      this.logMessage(`  --  fontSpec=[${fontSpec}], sz=(${fontSize}pt)[${textHeight}px] wd=(${charWidth}px)`);
      // FIXME: UNDONE add underline support
      this.logMessage(
        `  -- alignHV=[${alignHString}, ${alignVString}], c=(${textColor}) @(${textXOffset},${textYOffset}) text=[${text}]`
      );
      try {
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            // Locate the canvas element by its ID
            const canvas = document.getElementById('${canvasId}');

            if (canvas && canvas instanceof HTMLCanvasElement) {
              // Get the canvas context
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Set the line color and width
                const lineColor = '${textColor}';
                let Xoffset = ${textXOffset};
                let Yoffset = ${textYOffset};
                let textAlign = '${alignHString}';
                let textBaseline = '${alignVString}';

                ctx.font = '${fontSpec}'; // was Consolas

                // Set text alignment
                ctx.textAlign = textAlign; // Horizontally align the text
                ctx.textBaseline = textBaseline; // Vertically align the text

                // Set clipping region to the canvas size
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width, canvas.height);
                ctx.clip();

                // Add text of color
                ctx.fillStyle = lineColor;
                // fillText(text, x, y [, maxWidth]); // where y is baseline
                ctx.fillText('${text}', Xoffset, Xoffset);
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update text:', error);
      }
    }
  }
  */

  private scaleAndInvertValue(value: number, channelSpec: LogicChannelSpec): number {
    // scale the value to the vertical channel size then invert the value
    let possiblyScaledValue: number = value;
    const range: number = 0; // channelSpec.maxValue - channelSpec.minValue;
    // if value range is different from display range then scale it
    //if (channelSpec.ySize != range && range != 0) {
    //  const adjustedValue = value - channelSpec.minValue;
    //  possiblyScaledValue = Math.round((adjustedValue / range) * (channelSpec.ySize - 1));
    //}
    const invertedValue: number = 0; // channelSpec.ySize - 1 - possiblyScaledValue;
    if (this.dbgLogMessageCount > 0) {
      this.logMessage(
        `  -- scaleAndInvertValue(${value}) => (${possiblyScaledValue}->${invertedValue}) range=[${invertedValue}:${invertedValue}] ySize=(${invertedValue})`
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
