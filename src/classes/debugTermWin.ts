/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow, Menu } from 'electron';
// src/classes/debugTermWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './debugColor';

import { DebugWindowBase, Position, Size, WindowColor } from './debugWindowBase';
import { v8_0_0 } from 'pixi.js';

export interface TermSize {
  columns: number;
  rows: number;
}
export interface TermDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  position: Position;
  size: TermSize;
  textSizePts: number;
  textSizePix: number;
  window: WindowColor;
  textColor: string;
  textColor0: string;
  textColor1: string;
  textColor2: string;
  textColor3: string;
  update: boolean;
  hideXY: boolean;
}

export interface TermChannelSpec {
  minValue: number;
  maxValue: number;
  ySize: number;
}

export class DebugTermWindow extends DebugWindowBase {
  private displaySpec: TermDisplaySpec = {} as TermDisplaySpec;
  private debugWindow: BrowserWindow | null = null;
  private isFirstNumericData: boolean = true;
  private channelInset: number = 10; // 10 pixels from top and bottom of window
  private contentInset: number = 10; // 10 pixels from left and right of window
  private canvasMargin: number = 0; // 3 pixels from left, right, top, and bottom of canvas (NOT NEEDED)
  private channelLineWidth: number = 2; // 2 pixels wide for channel data line
  private dbgUpdateCount: number = 260; // NOTE 120 (no scroll) ,140 (scroll plus more), 260 scroll twice;
  private dbgLogMessageCount: number = 256 + 1; // log first N samples then stop (2 channel: 128+1 is 64 samples)

  constructor(ctx: Context, displaySpec: TermDisplaySpec) {
    super(ctx);
    // record our Debug Term Window Spec
    this.displaySpec = displaySpec;
  }

  get windowTitle(): string {
    let desiredValue: string = `${this.displaySpec.displayName} TERM`;
    if (this.displaySpec.windowTitle !== undefined && this.displaySpec.windowTitle.length > 0) {
      desiredValue = this.displaySpec.windowTitle;
    }
    return desiredValue;
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
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY', 4);
    const textColor: DebugColor = new DebugColor('WHITE', 15);
    console.log(`CL: at parseTermDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.size = { columns: 40, rows: 20 };
    displaySpec.textSizePts = 12;
    displaySpec.textSizePix = Math.round(displaySpec.textSizePts * 1.333);
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;

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
            // esure we have one more value
            if (index < lineParts.length - 1) {
              displaySpec.windowTitle = lineParts[++index];
            } else {
              // console.log() as we are in class static method, not derived class...
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'POS':
            // esure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.position.x = Number(lineParts[++index]);
              displaySpec.position.y = Number(lineParts[++index]);
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SIZE':
            // esure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.size.columns = Number(lineParts[++index]);
              displaySpec.size.rows = Number(lineParts[++index]);
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'TEXTSIZE':
            // esure we have two more values
            if (index < lineParts.length - 1) {
              displaySpec.textSizePts = Number(lineParts[++index]);
              displaySpec.textSizePix = Math.round(displaySpec.textSizePts * 1.333);
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'BACKCOLOR':
            // esure we have one more value
            if (index < lineParts.length - 1) {
              const colorName: string = lineParts[++index];
              let colorBrightness: number = 8;
              if (index < lineParts.length - 1) {
                colorBrightness = Number(lineParts[++index]);
              }
              const textColor = new DebugColor(colorName, colorBrightness);
              displaySpec.textColor = textColor.rgbString;
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
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

    // set height so no scroller by default
    const windowHeight = this.displaySpec.size.rows * this.displaySpec.textSizePix;
    // for mono-spaced font width 1/2 ht in pts
    const windowWidth = this.displaySpec.size.columns * (this.displaySpec.textSizePts / 2) + this.contentInset * 2; // contentInset' for the Xoffset into window for canvas
    this.logMessage(
      `  -- TERM window size: ${windowWidth}x${windowHeight} @${this.displaySpec.position.x},${this.displaySpec.position.y}`
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
      this.logMessage('* Term window closed');
      this.debugWindow = null;
    });

    this.debugWindow.on('close', () => {
      this.logMessage('* Term window closing...');
    });

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
            font-size: ${this.displaySpec.textSizePts}pt;
            background-color: ${this.displaySpec.window.background};
            color: ${this.displaySpec.textColor};
          }
          #terminal-data {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            margin: 0;
            //background-color:rgb(55, 63, 170); // ${this.displaySpec.window.background};
          }
          canvas {
            //background-color:rgb(240, 194, 151);
            //background-color: ${this.displaySpec.window.background};
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div id="terminal-data">
          <canvas id="text" width="${windowWidth}" height="${windowHeight}"></canvas>
        </div>
      </body>
    </html>
  `;

    this.logMessage(`at createDebugWindow() TERM with htmlContent: ${htmlContent}`);

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
        let colorName = 'GREEN';
        let colorBrightness = 15;
        if (lineParts[2].toUpperCase() == 'AUTO') {
          // parse AUTO spec
          //   '{NAME1}' AUTO2 {y-size3 {y-base4 {legend5} {color6 {bright7}}}} // legend is %abcd
          if (lineParts.length > 3) {
            //channelSpec.ySize = Number(lineParts[3]);
          }
          if (lineParts.length > 4) {
            //channelSpec.yBaseOffset = Number(lineParts[4]);
          }
          if (lineParts.length > 5) {
            // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
            const legend: string = lineParts[5];
            //this.parseLegend(legend, channelSpec);
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
            //channelSpec.minValue = parseFloat(lineParts[2]);
          }
          if (lineParts.length > 3) {
            //channelSpec.maxValue = parseFloat(lineParts[3]);
          }
          if (lineParts.length > 4) {
            //channelSpec.ySize = Number(lineParts[4]);
          }
          if (lineParts.length > 5) {
            //channelSpec.yBaseOffset = Number(lineParts[5]);
          }
          if (lineParts.length > 6) {
            // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
            const legend: string = lineParts[6];
            //this.parseLegend(legend, channelSpec);
          }
          if (lineParts.length > 7) {
            colorName = lineParts[7];
          }
          if (lineParts.length > 8) {
            colorBrightness = Number(lineParts[8]);
          }
        }
        const channelColor = new DebugColor(colorName, colorBrightness);
        //channelSpec.color = channelColor.rgbString;
        //channelSpec.gridColor = channelColor.gridRgbString;
        //channelSpec.textColor = channelColor.fontRgbString;
        // and record spec for this channel
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        //this.logMessage(`at updateContent() with channelSpec: ${JSON.stringify(channelSpec, null, 2)}`);
        //this.channelSpecs.push(channelSpec);
      } else if (lineParts[1].toUpperCase() == 'TRIGGER') {
        // parse trigger spec update
        //   TRIGGER1 <channel|-1>2 {arm-level3 {trigger-level4 {offset5}}}
        //   TRIGGER1 <channel|-1>2 {HOLDOFF3 <2-2048>4}
        if (lineParts.length > 2) {
          const desiredChannel: number = Number(lineParts[2]);
          //if (desiredChannel >= -1 && desiredChannel < this.channelSpecs.length) {
          //this.triggerSpec.trigChannel = desiredChannel;
          //} else {
          //  this.logMessage(`at updateContent() with invalid channel: ${desiredChannel} in [${lineParts.join(' ')}]`);
          //}
          if (lineParts.length > 3) {
            if (lineParts[3].toUpperCase() == 'HOLDOFF') {
              if (lineParts.length >= 4) {
                //this.triggerSpec.trigHoldoff = parseFloat(lineParts[4]);
              }
            } else if (lineParts[3].toUpperCase() == 'AUTO') {
              //this.triggerSpec.trigAuto = true;
            } else {
              //this.triggerSpec.trigArmLevel = parseFloat(lineParts[3]);
              //this.triggerSpec.trigAuto = false;
              if (lineParts.length > 4) {
                //this.triggerSpec.trigLevel = parseFloat(lineParts[4]);
              }
              if (lineParts.length > 5) {
                //this.triggerSpec.trigRtOffset = parseFloat(lineParts[5]);
              }
            }
          }
        }
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        //this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
      } else if (lineParts[1].toUpperCase() == 'HOLDOFF') {
        // parse trigger spec update
        //   HOLDOFF1 <2-2048>2
        if (lineParts.length > 2) {
          //this.triggerSpec.trigHoldoff = parseFloat(lineParts[2]);
        }
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        //this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
      } else if (lineParts[1].toUpperCase() == 'UPDATE') {
        // update window with latest content
        //this.clearTerminal();
      } else if (lineParts[1].toUpperCase() == 'CLEAR') {
        // clear window
        //this.clearTerminal();
      } else if (lineParts[1].toUpperCase() == 'CLOSE') {
        // close the window
        this.closeDebugWindow();
      } else if (lineParts[1].toUpperCase() == 'SAVE') {
        // save the window to a file
        // FIXME: UNDONE: add code save the window to a file here
      } else if ((lineParts[1].charAt(0) >= '0' && lineParts[1].charAt(0) <= '9') || lineParts[1].charAt(0) == '-') {
        if (this.isFirstNumericData) {
          this.isFirstNumericData = false;
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
        const numberChannels: number = 0; //this.channelSpecs.length;
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
            //const channelSpec = this.channelSpecs[chanIdx];
            //if (nextSample < channelSpec.minValue) {
            //nextSample = channelSpec.minValue;
            this.logMessage(`* UPD-WARNING sample below min: ${nextSample} of [${lineParts.join(',')}]`);
            //} else if (nextSample > channelSpec.maxValue) {
            //nextSample = channelSpec.maxValue;
            this.logMessage(`* UPD-WARNING sample above max: ${nextSample} of [${lineParts.join(',')}]`);
            //}
            // record our sample (shifting left if necessary)
            didScroll = this.recordChannelSample(chanIdx, nextSample);
            // update scope chanel canvas with new sample
            const canvasName = `channel-${chanIdx}`;
            //this.logMessage(`* UPD-INFO recorded (${nextSample}) for ${canvasName}`);
            //this.updateTermChannelData(canvasName, channelSpec, this.channelSamples[chanIdx].samples, didScroll);
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

  private recordChannelSample(channelIndex: number, sample: number): boolean {
    //this.logMessage(`at recordChannelSample(${channelIndex}, ${sample})`);
    let didScroll: boolean = false;
    return didScroll;
  }

  private updateTermChannelData(
    canvasName: string,
    channelSpec: TermChannelSpec,
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
          `at updateTermChannelData(${canvasName}, w/#${samples.length}) sample(s), didScroll=(${didScroll})`
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
        const drawWidth: number = 0; //this.displaySpec.nbrSamples * this.channelLineWidth;
        const drawHeight: number = 0; //channelSpec.ySize + this.channelLineWidth / 2;
        const drawXOffset: number = this.canvasMargin;
        const drawYOffset: number = this.channelInset + this.canvasMargin;
        const channelColor: string = ''; //channelSpec.color;
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

  private updateTermChannelLabel(name: string, colorString: string): void {
    if (this.debugWindow) {
      this.logMessage(`at updateTermChannelLabel(${name}, ${colorString})`);
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

  private drawHorizontalLine(canvasName: string, channelSpec: TermChannelSpec, YOffset: number, gridColor: string) {
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

  private drawHorizontalValue(canvasName: string, channelSpec: TermChannelSpec, YOffset: number, textColor: string) {
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
    channelSpec: TermChannelSpec,
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

  private scaleAndInvertValue(value: number, channelSpec: TermChannelSpec): number {
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
