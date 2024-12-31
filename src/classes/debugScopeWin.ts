/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow, Menu } from 'electron';
// src/classes/debugScopeWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './debugColor';

import { DebugWindowBase, Position, Size, WindowColor } from './debugWindowBase';

export interface ScopeDisplaySpec {
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

export interface ScopeChannelSpec {
  name: string;
  color: string;
  gridColor: string;
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
  trigChannel: number; // if channel is -1 then trigger is disabled
  trigArmLevel: number;
  trigLevel: number;
  trigRtOffset: number;
  trigHoldoff: number; // in samples required, from trigger to trigger
}

export class DebugScopeWindow extends DebugWindowBase {
  private displaySpec: ScopeDisplaySpec = {} as ScopeDisplaySpec;
  private channelSpecs: ScopeChannelSpec[] = [];
  private channelSamples: ScopeChannelSamples[] = [];
  private triggerSpec: ScopeTriggerSpec = {} as ScopeTriggerSpec;
  private debugWindow: BrowserWindow | null = null;
  private isFirstNumericData: boolean = true;

  constructor(ctx: Context, displaySpec: ScopeDisplaySpec) {
    super(ctx);
    // record our Debug Scope Window Spec
    this.displaySpec = displaySpec;
    // init default Trigger Spec
    this.triggerSpec = {
      trigEnabled: false,
      trigChannel: -1,
      trigArmLevel: 0,
      trigLevel: 0,
      trigRtOffset: 0,
      trigHoldoff: 0
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
    //   COLOR <bgnd-color> {<grid-color>} [BLACK, GREY 4]
    //   packed_data_mode
    //   HIDEXY
    console.log(`CL: at parseScopeDeclaration()`);
    let displaySpec: ScopeDisplaySpec = {} as ScopeDisplaySpec;
    displaySpec.window = {} as WindowColor; // ensure this is structured too! (CRASHED without this!)
    let isValid: boolean = false;

    // set defaults
    const bkgndColor: DebugColor = new DebugColor('BLACK');
    const gridColor: DebugColor = new DebugColor('GRAY', 4);
    console.log(`CL: at parseScopeDeclaration() with colors...`);
    displaySpec.position = { x: 0, y: 0 };
    displaySpec.size = { width: 256, height: 256 };
    displaySpec.nbrSamples = 256;
    displaySpec.rate = 1;
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;

    // now parse overrides to defaults
    console.log(`CL: at overrides ScopeDisplaySpec: ${lineParts}`);
    displaySpec.displayName = lineParts[1];
    if (lineParts.length > 2) {
      isValid = true; // invert default value
      for (let index = 2; index < lineParts.length; index++) {
        const element = lineParts[index];
        switch (element.toUpperCase()) {
          case 'TITLE':
            // esure we have one more value
            if (index < lineParts.length - 1) {
              displaySpec.windowTitle = lineParts[++index];
            } else {
              // console.log() as we are in class static method, not derived class...
              console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SIZE':
            // esure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.size.width = Number(lineParts[++index]);
              displaySpec.size.height = Number(lineParts[++index]);
            } else {
              console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SAMPLES':
            // esure we have two more values
            if (index < lineParts.length - 1) {
              displaySpec.nbrSamples = Number(lineParts[++index]);
            } else {
              console.log(`CL: ScopeDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;

          default:
            console.log(`CL: ScopeDisplaySpec: Unknown directive: ${element}`);
            break;
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
      // create a default channelSpec for only channel
      const defaultColor: DebugColor = new DebugColor('GREEN');
      this.channelSpecs.push({
        name: 'Channel 0',
        color: defaultColor.rgbString,
        gridColor: defaultColor.gridRgbString,
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
    //  window height should be (max-min+1) + (2 * 10); // 10 is for space above channel and below channel

    const channelCanvases: string[] = [];
    let windowCanvasHeight: number = 0;
    if (this.channelSpecs.length > 0) {
      for (let index = 0; index < this.channelSpecs.length; index++) {
        const channelSpec = this.channelSpecs[index];
        // create a canvas for each channel
        channelCanvases.push(
          `<canvas id="channel-${index}" width="${this.displaySpec.size.width}" height="${channelSpec.ySize}"></canvas>`
        );
        // account for channel height
        windowCanvasHeight += channelSpec.ySize;
      }
    } else {
      // error if NO channel
      this.logMessage(`at createDebugWindow() SCOPE with NO channels!`);
    }

    this.logMessage(`at createDebugWindow() SCOPE set up done... w/${channelCanvases.length} canvase(s)`);

    //const canvasePlusWindowHeight = windowCanvasHeight + 20 + 20 + 2; // 20 is for the channel titles + 20 for titlebar + 2 for bottom border
    const canvasePlusWindowHeight = windowCanvasHeight + 20 + 20 + 20 + 2; // 20 is for the channel titles + 2 for bottom border
    const windowHeight = Math.max(this.displaySpec.size.height, canvasePlusWindowHeight);
    const windowWidth = this.displaySpec.size.width + 2 * 2; // 2 is for the border

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
      this.logMessage('* Scope window closed');
      this.debugWindow = null;
    });

    this.debugWindow.on('close', () => {
      this.logMessage('* Scope window closing...');
    });

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
          body {
            display: flex;
            flex-direction: column;
            margin: 0;
            font-family: Arial, sans-serif;
            font-size: 12px;
            background-color: ${this.displaySpec.window.background};
            color:rgb(191, 213, 93);
          }
          #channel-titles {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: flex-start;
            flex-grow: 0;
            margin: 0px 2px 0px 2px;   // top, right, bottom, left
          }
          #channels {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 1;
            margin: 0;
          }
          canvas {
            padding: 10px 0px 10px 0px;   // top, right, bottom, left
            background-color:${this.displaySpec.window.background};
          }
          p {
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div id="channel-titles"><span style="margin-right: 10px">{labels here}</span></div>
        <div id="channels">${channelCanvases.join(' ')}</div>
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
    // Menu.setApplicationMenu(null); // DOESNT WORK!

    // now hook load complete event so we can label and paint the grid/min/max, etc.
    this.debugWindow.webContents.on('did-finish-load', () => {
      this.logMessage('at did-finish-load');
      for (let index = 0; index < this.channelSpecs.length; index++) {
        const channelSpec = this.channelSpecs[index];
        this.updateScopeChannelLabel(channelSpec.name, channelSpec.color);
        const channelGridColor: string = channelSpec.gridColor;
        const windowGridColor: string = this.displaySpec.window.grid;
        const canvasName = `channel-${index}`;
        // paint the grid/min/max, etc.
        if (channelSpec.lgndShowMax && !channelSpec.lgndShowMaxLine) {
          this.drawHorizontalValue(canvasName, channelSpec, channelSpec.maxValue, channelGridColor);
        }
        if (channelSpec.lgndShowMin && !channelSpec.lgndShowMinLine) {
          this.drawHorizontalValue(canvasName, channelSpec, channelSpec.minValue, channelGridColor);
        }
        if (channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
          this.drawHorizontalLineAndValue(canvasName, channelSpec, channelSpec.maxValue, channelGridColor);
        }
        if (channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
          this.drawHorizontalLineAndValue(canvasName, channelSpec, channelSpec.minValue, channelGridColor);
        }
        if (!channelSpec.lgndShowMax && channelSpec.lgndShowMaxLine) {
          this.drawHorizontalLine(canvasName, channelSpec, channelSpec.maxValue, channelGridColor);
        }
        if (!channelSpec.lgndShowMin && channelSpec.lgndShowMinLine) {
          this.drawHorizontalLine(canvasName, channelSpec, channelSpec.minValue, channelGridColor);
        }
        // and border should be gray,4
        this.drawCanvasBorder(canvasName, windowGridColor);
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
        let channelSpec: ScopeChannelSpec = {} as ScopeChannelSpec;
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
            channelSpec.minValue = Number(lineParts[2]);
          }
          if (lineParts.length > 3) {
            channelSpec.maxValue = Number(lineParts[3]);
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
        // and record spec for this channel
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with channelSpec: ${JSON.stringify(channelSpec, null, 2)}`);
        this.channelSpecs.push(channelSpec);
      } else if (lineParts[1].toUpperCase() == 'TRIGGER') {
        // parse trigger spec update
        //   TRIGGER1 <channel|-1>2 {arm-level3 {trigger-level4 {offset5}}}
        if (lineParts.length > 2) {
          const desiredChannel: number = Number(lineParts[2]);
          if (desiredChannel >= -1 && desiredChannel < this.channelSpecs.length) {
            this.triggerSpec.trigChannel = desiredChannel;
          } else {
            this.logMessage(`at updateContent() with invalid channel: ${desiredChannel} in [${lineParts.join(' ')}]`);
          }
          if (lineParts.length > 3) {
            this.triggerSpec.trigArmLevel = Number(lineParts[3]);
          }
          if (lineParts.length > 4) {
            this.triggerSpec.trigLevel = Number(lineParts[4]);
          }
          if (lineParts.length > 5) {
            this.triggerSpec.trigRtOffset = Number(lineParts[5]);
          }
        }
        this.logMessage(`at updateContent() w/[${lineParts.join(' ')}]`);
        this.logMessage(`at updateContent() with triggerSpec: ${JSON.stringify(this.triggerSpec, null, 2)}`);
      } else if (lineParts[1].toUpperCase() == 'HOLDOFF') {
        // parse trigger spec update
        //   HOLDOFF1 <2-2048>2
        if (lineParts.length > 2) {
          this.triggerSpec.trigHoldoff = Number(lineParts[2]);
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
      } else if (lineParts[1].charAt(0) >= '0' && lineParts[1].charAt(0) <= '9') {
        if (this.isFirstNumericData) {
          this.isFirstNumericData = false;
          this.initChannelSamples();
          this.createDebugWindow();
        }
        // parse numeric data
        let didScroll: boolean = false; // in case we need this for performance of window update
        const nbrSamples = lineParts.length - 1;
        for (let index = 1; index < lineParts.length; index++) {
          const chanIdx = index - 1;
          if (chanIdx < this.channelSpecs.length) {
            let nextSample: number = Number(lineParts[index]);
            // limit the sample to the channel's min/max?!
            const channelSpec = this.channelSpecs[chanIdx];
            if (nextSample < channelSpec.minValue) {
              nextSample = channelSpec.minValue;
              this.logMessage(`at updateContent() with sample below min: ${nextSample} of [${lineParts.join(' ')}]`);
            } else if (nextSample > channelSpec.maxValue) {
              nextSample = channelSpec.maxValue;
              this.logMessage(`at updateContent() with sample above max: ${nextSample} of [${lineParts.join(' ')}]`);
            }
            // record our sample (shifting left if necessary)
            didScroll = this.recordChannelSample(chanIdx, nextSample);
          } else {
            this.logMessage(`at updateContent() with too many samples: ${nbrSamples} of [${lineParts.join(' ')}]`);
          }
        }
        // FIXME: UNDONE: add code to update the window here
      } else {
        this.logMessage(`at updateContent() with unknown directive: ${lineParts[1]} of [${lineParts.join(' ')}]`);
      }
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
      // record the sample
      channelSamples.samples.push(sample);
    } else {
      this.logMessage(`at recordChannelSample() with invalid channelIndex: ${channelIndex}`);
    }
    return didScroll;
  }

  private parseLegend(legend: string, channelSpec: ScopeChannelSpec): void {
    // %abcd where a=enable max legend, b=min legend, c=max line, d=min line
    if (legend.length > 4 && legend.charAt(0) == '%') {
      channelSpec.lgndShowMax = legend.charAt(1) == '1' ? true : false;
      channelSpec.lgndShowMin = legend.charAt(2) == '1' ? true : false;
      channelSpec.lgndShowMaxLine = legend.charAt(3) == '1' ? true : false;
      channelSpec.lgndShowMinLine = legend.charAt(4) == '1' ? true : false;
    } else {
      this.logMessage(`at parseLegend() with invalid legend: ${legend}`);
      channelSpec.lgndShowMax = false;
      channelSpec.lgndShowMin = false;
      channelSpec.lgndShowMaxLine = false;
      channelSpec.lgndShowMinLine = false;
    }
  }

  private updateScopeChannelLabel(name: string, colorString: string): void {
    if (this.debugWindow) {
      this.logMessage(`at updateScopeChannelLabel(${name}, ${colorString})`);
      try {
        const channelLabel: string = `<span style="color: ${colorString}; margin-right: 10px">${name}</span>`;
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            const labelsDivision = document.getElementById('channel-titles');
            if (labelsDivision) {
              let labelContent = labelsDivision.innerText;
              if (labelContent.includes('{labels here}')) {
                labelContent = '';
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

  private drawHorizontalLine(canvasName: string, channelSpec: ScopeChannelSpec, YOffset: number, gridColor: string) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalLine(${canvasName}, ${YOffset}, ${gridColor})`);
      try {
        const adjYOffset = Math.min(channelSpec.maxValue, YOffset);
        const lineOffset = channelSpec.ySize - (adjYOffset - channelSpec.minValue);
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
                const lineWidth = 1;

                // Set the dash pattern
                ctx.setLineDash([5, 3]); // 5px dash, 3px gap

                // Draw the line
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(0, canvas.height - ${lineOffset});
                ctx.lineTo(canvas.width, canvas.height - ${lineOffset});
                ctx.stroke();
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update canvas border:', error);
      }
    }
  }

  private drawHorizontalValue(canvasName: string, channelSpec: ScopeChannelSpec, YOffset: number, gridColor: string) {}

  private drawHorizontalLineAndValue(
    canvasName: string,
    channelSpec: ScopeChannelSpec,
    YOffset: number,
    gridColor: string
  ) {
    if (this.debugWindow) {
      this.logMessage(`at drawHorizontalLine(${canvasName}, ${YOffset}, ${gridColor})`);
      try {
        const adjYOffset = Math.min(channelSpec.maxValue, YOffset);
        const lineOffset = channelSpec.ySize - (adjYOffset - channelSpec.minValue);
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
                const lineWidth = 1;

                // Set the dash pattern
                ctx.setLineDash([5, 3]); // 5px dash, 3px gap

                // Draw the line
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(0, canvas.height - ${lineOffset});
                ctx.lineTo(canvas.width, canvas.height - ${lineOffset});
                ctx.stroke();
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update canvas border:', error);
      }
    }
  }

  private drawCanvasBorder(canvasName: string, gridColor: string) {
    if (this.debugWindow) {
      this.logMessage(`at drawCanvasBorder(${canvasName}, ${gridColor})`);
      try {
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            // Locate the canvas element by its ID
            const canvas = document.getElementById('${canvasName}');

            if (canvas && canvas instanceof HTMLCanvasElement) {
              // Get the canvas context
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Set the border color and width
                const borderColor = '${gridColor}'; // was Red #ff0000 for testing
                const borderWidth = 3; // should be 1?

                // Set the solid line pattern
                ctx.setLineDash([]); // Empty array for solid line

                // Draw the border
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = borderWidth;
                ctx.strokeRect(0, 0, canvas.width, canvas.height);
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update canvas border:', error);
      }
    }
  }
}
