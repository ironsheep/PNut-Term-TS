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
  ePackedDataMode,
  ePackedDataWidth,
  eTextWeight,
  eVertJustification,
  FontMetrics,
  PackedDataMode,
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
  chanNbr: number;
  height: number;
  base: number;
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
  private channelBitSpecs: LogicChannelBitSpec[] = []; // one for each channel bit within the 32 possible channels
  private channelSamples: LogicChannelSamples[] = []; // one for each channel
  private triggerSpec: LogicTriggerSpec = {} as LogicTriggerSpec;
  private isFirstNumericData: boolean = true;
  private channelVInset: number = 3; // 3 pixels from top and bottom of window
  private contentInset: number = 0; // 10 pixels from left and right of window
  private canvasMargin: number = 10; // 10 pixels from to (no left,) right, top, and bottom of canvas (NOT NEEDED)
  private labelWidth: number = 0; // width of label canvas
  private labelHeight: number = 0; // height of label canvas
  private packedMode: PackedDataMode = {} as PackedDataMode;
  private singleBitChannelCount: number = 0; // number of single bit channels
  // diagnostics used to limit the number of samples displayed while testing
  private dbgUpdateCount: number = 31 * 6; // NOTE 120 (no scroll) ,140 (scroll plus more), 260 scroll twice;
  private dbgLogMessageCount: number = 32 * 6; //256 + 1; // log first N samples then stop (2 channel: 128+1 is 64 samples)

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
    // initially we don't have a packed mode...
    this.packedMode = {
      mode: ePackedDataMode.PDM_UNKNOWN,
      bitsPerSample: 0,
      valueSize: ePackedDataWidth.PDW_UNKNOWN,
      isAlternate: false,
      isSigned: false
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
    //   COLOR <bgnd-color> {<grid-color>} [BLACK, GRAY 4]
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
    const gridColor: DebugColor = new DebugColor('GRAY3', 4);
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
          //console.log(`CL: LogicDisplaySpec - new default: ${JSON.stringify(newChannelSpec, null, 2)}`);

          // display string at cursor position with current colors
          let displayString: string | undefined = undefined;
          const currLinePart = lineParts[index];
          // isolate string and display it. Advance index to next part after close quote
          if (currLinePart.substring(1).includes("'")) {
            // string ends as this single linepart
            displayString = currLinePart.substring(1, currLinePart.length - 1);
            //console.log(`CL:  -- displayString=[${displayString}]`);
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
          //console.log(`CL: LogicDisplaySpec - displayString=[${displayString}]`);
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
            //console.log(`CL: LogicDisplaySpec - add channelSpec: ${JSON.stringify(newChannelSpec, null, 2)}`);
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

    const canvasHeight: number = this.displaySpec.font.lineHeight;

    let labelMaxChars: number = 0;
    let activeBitChannels: number = 0;
    let channelBase: number = 0;
    for (let index = 0; index < this.displaySpec.channelSpecs.length; index++) {
      const channelSpec = this.displaySpec.channelSpecs[index];
      const bitsInGroup: number = channelSpec.nbrBits;
      const groupColor: string = channelSpec.color;
      labelMaxChars = Math.max(labelMaxChars, channelSpec.name.length + 2); // add 2 for ' N' suffix
      for (let activeIdx = 0; activeIdx < bitsInGroup; activeIdx++) {
        const bitIdx: number = activeBitChannels + activeIdx;
        let chanLabel: string;
        if (bitsInGroup == 1) {
          chanLabel = `${channelSpec.name}`;
        } else {
          if (activeIdx == 0) {
            chanLabel = `${channelSpec.name} ${activeIdx}`; // name w/bit number suffix
          } else {
            chanLabel = `${activeIdx}`; // just bit number
          }
        }
        // fill in our channel bit spec
        let newSpec: LogicChannelBitSpec = {} as LogicChannelBitSpec;
        newSpec.name = chanLabel;
        newSpec.color = groupColor;
        newSpec.chanNbr = bitIdx;
        newSpec.height = canvasHeight;
        newSpec.base = channelBase;
        // and update to next base
        channelBase += canvasHeight;
        // record the new bit spec
        this.channelBitSpecs.push(newSpec);
      }
      activeBitChannels += bitsInGroup;
    }

    this.logMessage(
      `at createDebugWindow() LOGIC with ${activeBitChannels} active bit channels: [${JSON.stringify(
        this.channelBitSpecs,
        null,
        2
      )}]`
    );

    this.singleBitChannelCount = activeBitChannels;

    const labelDivs: string[] = [];
    const dataCanvases: string[] = [];

    const labelCanvasWidth: number = this.contentInset + labelMaxChars * (this.displaySpec.font.charWidth - 2);
    const dataCanvasWidth: number = this.displaySpec.nbrSamples * this.displaySpec.spacing + this.contentInset; // contentInset' for the Xoffset into window for canvas

    const channelGroupHeight: number = canvasHeight * activeBitChannels;
    const channelGroupWidth: number = labelCanvasWidth + dataCanvasWidth;

    // pass to other users
    this.labelHeight = canvasHeight;
    this.labelWidth = labelCanvasWidth;

    for (let index = 0; index < activeBitChannels; index++) {
      const idNbr: number = activeBitChannels - index - 1;
      labelDivs.push(`<div id="label-${idNbr}" width="${labelCanvasWidth}" height="${canvasHeight}"></div>`);
      dataCanvases.push(`<canvas id="data-${idNbr}" width="${dataCanvasWidth}" height="${canvasHeight}"></canvas>`);
    }

    // set height so NO scroller by default
    const windowHeight = channelGroupHeight + 2 + this.canvasMargin * 2; // 2 is fudge to remove scroller;
    const windowWidth = channelGroupWidth + this.contentInset * 2 + this.canvasMargin * 1; // 1 = no left margin!
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
            //background-color:rgb(234, 121, 86);
            background-color: ${this.displaySpec.window.background};
            color:rgb(191, 213, 93);
          }
          #labels {
            display: flex;
            flex-direction: column; /* Arrange children in a column */
            flex-grow: 0;
            //background-color:rgb(86, 234, 234);
            background-color: ${this.displaySpec.window.background};
            font-family: 'Parallax', sans-serif;
            font-style: italic;
            font-size: 12px;
            width: ${labelCanvasWidth}px;
            border-style: solid;
            border-width: 1px;
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
            border-style: solid;
            border-width: 1px;
            border-color: ${this.displaySpec.window.grid};
            //background-color:rgb(96, 234, 86);
            background-color: ${this.displaySpec.window.background};
          }
          #container {
            display: flex;
            flex-direction: row; /* Arrange children in a row */
            flex-grow: 0;
            padding: top right bottom left;
            padding: ${this.canvasMargin}px ${this.canvasMargin}px ${this.canvasMargin}px 0px;
          }
          #label-2 {
            //background-color:rgb(231, 151, 240);
          }
          #data-2 {
            //background-color:rgb(240, 194, 151);
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
    for (let bitIdx = 0; bitIdx < this.channelBitSpecs.length; bitIdx++) {
      const channelBitSpec = this.channelBitSpecs[bitIdx];
      const canvasName = `label-${bitIdx}`;
      //  set labels
      this.updateLogicChannelLabel(canvasName, channelBitSpec.name, channelBitSpec.color);
    }
  }

  public closeDebugWindow(): void {
    this.logMessage(`at closeDebugWindow() LOGIC`);
    // let our base class do the work
    this.debugWindow = null;
  }

  public updateContent(lineParts: string[]): void {
    // here with lineParts = ['`{displayName}, ...]
    // ----------------------------------------------------------------
    // Valid directives are:
    // --- these update the trigger spec
    //   TRIGGER <channel|-1> {arm-level {trigger-level {offset}}} HOLDOFF <2-2048>
    //   HOLDOFF <2-2048>
    // --- these manage the window
    //   CLEAR
    //   CLOSE
    //   SAVE {WINDOW} 'filename' // save window to .bmp file
    // --- these paints new samples
    //   <numeric data> // data applied to channels in ascending order
    // ----------------------------------------------------------------
    this.logMessage(`at updateContent(${lineParts.join(' ')})`);
    // ON first numeric data, create the window! then do update
    if (lineParts.length >= 2) {
      // have data, parse it
      for (let index = 1; index < lineParts.length; index++) {
        this.logMessage(`  -- at [${lineParts[index]}] in lineParts[${index}]`);
        if (lineParts[index].toUpperCase() == 'TRIGGER') {
          // parse trigger spec update
          //   TRIGGER1 mask2 match3 {sample_offset4}
          this.triggerSpec.trigEnabled = true;
          // ensure we have at least two more values
          if (index + 1 < lineParts.length - 2) {
            const [isValidMask, mask] = this.isSpinNumber(lineParts[index + 1]);
            if (isValidMask) {
              index++; // show we consumed the mask value
            }
            const [isValidMatch, match] = this.isSpinNumber(lineParts[index + 1]);
            if (isValidMatch) {
              index++; // show we consumed the match value
            }
            if (isValidMask && isValidMatch) {
              this.triggerSpec.trigMask = mask ? mask : 0;
              this.triggerSpec.trigMatch = match ? match : 1;
              if (index + 1 < lineParts.length - 1) {
                const [isValidOffset, offsetInSamples] = this.isSpinNumber(lineParts[index + 1]);
                if (isValidOffset) {
                  if (offsetInSamples >= 0 && offsetInSamples < this.displaySpec.nbrSamples) {
                    this.triggerSpec.trigSampOffset = offsetInSamples;
                  }
                  index++; // show we consumed the offset value
                }
              }
            } else {
              this.logMessage(`at updateContent() with invalid mask or match in [${lineParts.join(' ')}]`);
            }
          }
          this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
        } else if (lineParts[index].toUpperCase() == 'HOLDOFF') {
          // parse trigger spec update
          //   HOLDOFF1 <2-2048>2
          if (lineParts.length > 2) {
            const [isValidNumber, holdoff] = this.isSpinNumber(lineParts[index + 1]);
            if (isValidNumber) {
              this.triggerSpec.trigHoldoff = holdoff;
              index++; // show we consumed the holdoff value
            }
          } else {
            this.logMessage(`at updateContent() with invalid HOLDOFF @[${index + 1}] in [${lineParts.join(' ')}]`);
          }
          this.logMessage(
            `at updateContent() with updated trigger-holdoffSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`
          );
        } else if (lineParts[index].toUpperCase() == 'CLEAR') {
          // clear all channels
          this.clearChannelData();
        } else if (lineParts[index].toUpperCase() == 'CLOSE') {
          // close the window
          this.closeDebugWindow();
        } else if (lineParts[index].toUpperCase() == 'SAVE') {
          // get filename for save
          if (index + 1 < lineParts.length - 1) {
            const saveFileName = this.removeStringQuotes(lineParts[++index]);
            // save the window to a file (as BMP)
            this.saveWindowToBMPFilename(saveFileName.substring(1, saveFileName.length - 1));
          } else {
            this.logMessage(`at updateContent() missing SAVE fileName in [${lineParts.join(' ')}]`);
          }
        } else {
          // do we have packed data spec?
          const [isPackedData, newMode] = this.isPackedDataMode(lineParts[index]);
          if (isPackedData) {
            // remember the new mode so we can unpack the data correctly
            this.packedMode = newMode;
            // now look for ALT and SIGNED keywords which may follow
            if (index + 1 < lineParts.length - 1) {
              const nextKeyword = lineParts[index + 1].toUpperCase();
              if (nextKeyword == 'ALT') {
                this.packedMode.isAlternate = true;
                index++;
                if (index + 1 < lineParts.length - 1) {
                  const nextKeyword = lineParts[index + 1].toUpperCase();
                  if (nextKeyword == 'SIGNED') {
                    this.packedMode.isSigned = true;
                    index++;
                  }
                }
              } else if (nextKeyword == 'SIGNED') {
                this.packedMode.isSigned = true;
                index++;
              }
            }
          } else {
            // do we have number?
            const [isValidNumber, numericValue] = this.isSpinNumber(lineParts[index]);
            if (isValidNumber) {
              if (this.isFirstNumericData) {
                this.isFirstNumericData = false;
                this.calculateAutoTriggerAndScale();
                this.createDebugWindow();
                this.initChannelSamples(); // after window is created so data it uses is available
                this.logMessage(
                  `* UPD-INFO working with packed-data-spec: ${JSON.stringify(this.packedMode, null, 2)}`
                );
              }
              // FIXME: UNDONE: add code to update the window here with our single sample value
              let scopeSamples: number[] = this.possiblyUnpackData(numericValue, this.packedMode);
              for (let index = 0; index < scopeSamples.length; index++) {
                const sample = scopeSamples[index];
                this.recordSampleToChannels(sample);
              }
            } else {
              this.logMessage(`* UPD-ERROR  unknown directive: ${lineParts[1]} of [${lineParts.join(' ')}]`);
            }
          }
        }
      }
    }
  }

  private recordSampleToChannels(sample: number) {
    // we have a single sample value than has a bit for each channel
    //  isolate the bits for each channel and update each channel
    const nbrBitsInSample: number = this.channelBitSpecs.length;
    this.logMessage(
      `at recordSampleToChannels(0b${sample.toString(2).padStart(nbrBitsInSample, '0')}) w/${
        this.channelBitSpecs.length
      } channels`
    );
    const numberOfChannels = this.singleBitChannelCount;
    for (let channelIdx = 0; channelIdx < numberOfChannels; channelIdx++) {
      // create canvas name for channel
      const canvasName = `data-${channelIdx}`;
      // isolate bit from sample for this channel
      const bitValue = (sample >> channelIdx) & 1;
      // record the sample for this channel
      const didScroll: boolean = this.recordChannelSample(channelIdx, bitValue);
      // update the channel display
      //this.logMessage(`* UPD-INFO recorded (${bitValue}) for ${canvasName}`);
      const channelSpec: LogicChannelBitSpec = this.channelBitSpecs[channelIdx];
      this.updateLogicChannelData(canvasName, channelSpec, this.channelSamples[channelIdx].samples, didScroll);
    }
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
    if (this.channelBitSpecs.length == 0) {
      this.channelSamples.push({ samples: [] });
    } else {
      for (let index = 0; index < this.channelBitSpecs.length; index++) {
        this.channelSamples.push({ samples: [] });
      }
    }
    this.logMessage(`  -- [${JSON.stringify(this.channelSamples, null, 2)}]`);
  }

  private clearChannelData() {
    this.logMessage(`at clearChannelData()`);
    for (let index = 0; index < this.channelBitSpecs.length; index++) {
      const channelSamples = this.channelSamples[index];
      // clear the channel data
      channelSamples.samples = [];
    }
  }

  private recordChannelSample(channelIndex: number, sample: number): boolean {
    //this.logMessage(`at recordChannelSample(${channelIndex}, ${sample})`);
    let didScroll: boolean = false;
    if (channelIndex >= 0 && channelIndex < this.channelBitSpecs.length) {
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

  private updateLogicChannelData(
    canvasName: string,
    channelSpec: LogicChannelBitSpec,
    samples: number[],
    didScroll: boolean
  ): void {
    if (this.debugWindow) {
      if (this.dbgUpdateCount > 0) {
        // DISABLE RUN FOREVER this.dbgUpdateCount--;
      }
      if (this.dbgUpdateCount == 0) {
        return;
      }
      // if (--this.dbgLogMessageCount > 0) {
      if (this.dbgLogMessageCount > 0) {
        this.logMessage(
          `at updateLogicChannelData(${canvasName}, w/#${samples.length}) sample(s), didScroll=(${didScroll})`
        );
      }
      const canvasWidth: number = this.displaySpec.nbrSamples * this.displaySpec.spacing;
      const canvasHeight: number = this.displaySpec.font.lineHeight;
      const drawWidth: number = canvasWidth;
      const drawHeight: number = canvasHeight - this.channelVInset * 2;

      // get prior 0,1 and next 0,1
      const currSample: number = samples[samples.length - 1];
      const prevSample: number = samples.length > 1 ? samples[samples.length - 2] : 0; // channels start at ZERO value
      const currInvSample: number = 1 - currSample;
      const prevInvSample: number = 1 - prevSample;
      const havePrevSample: boolean = samples.length > 1;
      // let's leave 2px at top and bottom of canvas (this.channelVInset) draw only in between...
      this.logMessage(`  -- currInvSample=${currInvSample}, prevInvSample=${prevInvSample}`);

      // offset to sample value
      const currXOffset: number = (samples.length - 1) * this.displaySpec.spacing;
      const currYOffset: number = currInvSample * drawHeight + this.channelVInset;

      const prevXOffset: number = havePrevSample ? (samples.length - 2) * this.displaySpec.spacing : currXOffset;
      const prevYOffset: number = havePrevSample ? prevInvSample * drawHeight + this.channelVInset : currYOffset;
      //this.logMessage(`  -- prev=[${prevYOffset},${prevXOffset}], curr=[${currYOffset},${currXOffset}]`);
      // draw region for the channel
      const drawXOffset: number = this.channelVInset;
      const drawYOffset: number = 0;
      const channelColor: string = channelSpec.color;
      const spacing: number = this.displaySpec.spacing;
      if (this.dbgLogMessageCount > 0) {
        this.logMessage(`  -- DRAW size=(${drawWidth},${drawHeight}), offset=(${drawYOffset},${drawXOffset})`);
        this.logMessage(
          `  -- #${samples.length} currSample=(${currSample},#${samples.length}) @ rc=[${currYOffset},${currXOffset}], prev=[${prevYOffset},${prevXOffset}]`
        );
      }
      try {
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
                const lineWidth = ${this.displaySpec.lineSize};
                const spacing = ${this.displaySpec.spacing};
                const scrollSpeed = lineWidth + spacing;
                const canvWidth = ${canvasWidth};
                const canvHeight = ${canvasHeight};
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
                ctx.moveTo(${prevXOffset}+${spacing}-1, ${prevYOffset});
                ctx.lineTo(${currXOffset}, ${currYOffset});
                ctx.lineTo(${currXOffset}+${spacing}-1, ${currYOffset});
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
}
