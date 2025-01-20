/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { BrowserWindow, Menu } from 'electron';
// src/classes/debugTermWin.ts

import { Context } from '../utils/context';
import { DebugColor } from './debugColor';

import { DebugWindowBase, FontMetrics, Position, Size, WindowColor } from './debugWindowBase';

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
  size: TermSize;
  font: FontMetrics;
  window: WindowColor;
  textColor: string;
  colorCombos: ColorCombo[];
  delayedUpdate: boolean;
  hideXY: boolean;
}

export class DebugTermWindow extends DebugWindowBase {
  private displaySpec: TermDisplaySpec = {} as TermDisplaySpec;
  private isFirstDisplayData: boolean = true;
  private contentInset: number = 6; // 6 pixels from left and right of window
  private borderMargin: number = 10; // 10 pixels all around
  // current terminal state
  private deferredCommands: string[] = [];
  private cursorPosition: Position = { x: 0, y: 0 };
  private selectedCombo: number = 0;

  constructor(ctx: Context, displaySpec: TermDisplaySpec) {
    super(ctx);
    this.windowLogPrefix = 'trmW';
    // record our Debug Term Window Spec
    this.displaySpec = displaySpec;
    // adjust our contentInset for font size
    this.contentInset = this.displaySpec.font.charWidth / 2;
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
    displaySpec.size = { columns: 40, rows: 20 };
    DebugWindowBase.calcMetricsForFontPtSize(12, displaySpec.font);
    displaySpec.window.background = bkgndColor.rgbString;
    displaySpec.window.grid = gridColor.rgbString;
    displaySpec.textColor = textColor.rgbString;
    displaySpec.delayedUpdate = false;
    displaySpec.hideXY = false;
    // by default we have combo #0 defined
    displaySpec.colorCombos.push({ fgcolor: displaySpec.textColor, bgcolor: displaySpec.window.background });

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
              displaySpec.position.x = Number(lineParts[++index]);
              displaySpec.position.y = Number(lineParts[++index]);
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'SIZE':
            // ensure we have two more values
            if (index < lineParts.length - 2) {
              displaySpec.size.columns = Number(lineParts[++index]);
              displaySpec.size.rows = Number(lineParts[++index]);
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'TEXTSIZE':
            // ensure we have two more values
            if (index < lineParts.length - 1) {
              const sizeInPts: number = Number(lineParts[++index]);
              DebugWindowBase.calcMetricsForFontPtSize(sizeInPts, displaySpec.font);
            } else {
              console.log(`CL: TermDisplaySpec: Missing parameter for ${element}`);
              isValid = false;
            }
            break;
          case 'BACKCOLOR':
            // ensure we have one more value
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
                  // remove our default color combo
                  displaySpec.colorCombos = [];
                }
                displaySpec.colorCombos.push(channelColor);
                colorComboIdx++;
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

    // set height so no scroller by default
    const canvasHeight = this.displaySpec.size.rows * this.displaySpec.font.lineHeight;
    // for mono-spaced font width 1/2 ht in pts
    const canvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
    this.logMessage(
      `  -- TERM canvas size=(${canvasWidth}x${canvasHeight}) char=(${this.displaySpec.font.charWidth}x${this.displaySpec.font.charHeight}) ln=(${this.displaySpec.font.lineHeight})`
    );
    const divHeight = canvasHeight + 4; // 4 is fudge number
    const divWidth = canvasWidth + 4; // 4 is fudge number

    const windowHeight = divHeight + this.borderMargin * 2;
    const windowWidth = divWidth + this.borderMargin * 2;
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
          @font-face {
            font-family: 'Parallax';
            src: url('./resources/fonts/Parallax.ttf') format('truetype');
          }
          body {
            display: flex;
            flex-direction: column;
            margin: 0;
            padding: 0;
            font-family: 'Parallax', sans-serif;
            font-size: ${this.displaySpec.font.textSizePts}pt;
            //background-color: ${this.displaySpec.window.background};
            background-color: rgb(140, 52, 130);
            color: ${this.displaySpec.textColor};
          }
          #terminal-data {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 0;
            flex-shrink: 0;
            padding: 10px;
            //background-color:rgb(55, 170, 136);
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
        <div id="terminal-data">
          <canvas id="text-area" width="${canvasWidth}" height="${canvasHeight}"></canvas>
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
    this.logMessage(`at closeDebugWindow() TERM`);
    // let our base class do the work
    this.debugWindow = null;
  }

  public updateContent(lineParts: string[]): void {
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
    //this.logMessage(`at updateContent(${lineParts.join(' ')})`);
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
        // update window with latest content
        this.pushDisplayListToTerm();
      } else if (lineParts[index].toUpperCase() == 'CLEAR') {
        // clear window
        this.clearTerm();
      } else if (lineParts[index].toUpperCase() == 'CLOSE') {
        // close the window
        if (this.saveInProgress) {
          this.logMessage(`* UPD-WARNING  save in progress, waiting for save to finish...`);
          let sleepDuration: number = 0;
          const sleepIntervalInMS: number = 20;
          while (this.saveInProgress) {
            // wait for save to finish
            this.logMessage(`  -- Waiting for save to finish... - ${sleepDuration} msec`);
            sleepDuration += sleepIntervalInMS;
            // let's do a 200ms timeout
            const end = Date.now() + sleepIntervalInMS;
            while (Date.now() < end) {
              // This empty while loop allows other microtasks to run
            }
          }
        } else {
          this.logMessage(`* UPD-INFO (save complete) closing window...`);
        }
        this.closeDebugWindow();
      } else if (lineParts[index].toUpperCase() == 'SAVE') {
        // save the window to a file
        if (index + 1 < lineParts.length) {
          const saveFileName = this.removeStringQuotes(lineParts[++index]);
          // save the window to a file (as BMP)
          this.saveWindowToBMPWithCallback(saveFileName, () => {
            this.logMessage(`* Callback: saveWindowToBMPWithCallback(${saveFileName})`);
          });
          //this.saveWindowToBMPFilename(saveFileName);
        } else {
          this.logMessage(`at updateContent() missing SAVE fileName in [${lineParts.join(' ')}]`);
        }
      } else {
        this.logMessage(`* UPD-ERROR  unknown directive: ${lineParts[1]} of [${lineParts.join(' ')}]`);
      }
    }
  }

  private updateTermDisplay(text: string): void {
    // add action to our display list
    //this.logMessage(`* updateTermDisplay(${text})`);
    this.deferredCommands.push(text);
    // create window if not already
    if (this.isFirstDisplayData) {
      this.isFirstDisplayData = false;
      this.createDebugWindow();
    }
    // if not deferred update the act on display list now
    if (this.displaySpec.delayedUpdate == false) {
      // act on display list now
      this.pushDisplayListToTerm();
    }
  }

  private pushDisplayListToTerm() {
    if (this.deferredCommands.length > 0) {
      // act on display list now
      this.deferredCommands.forEach((displayString) => {
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
                this.cursorPosition.x = parseInt(numbers[1], 10);
              } else {
                this.logMessage(`* UPD-ERROR  missing column value for action 2`);
              }
              break;
            case 3:
              // set row to next character value
              if (numbers.length > 1) {
                this.cursorPosition.y = parseInt(numbers[1], 10);
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
              // backspace
              if (this.cursorPosition.x > 0) {
                this.cursorPosition.x--;
              }
              break;
            case 9:
              // move to next tab column (tabwidth 8)
              // move cursor to next tabstop
              this.cursorPosition.x += 8 - (this.cursorPosition.x % 8);
              break;
            case 10:
            case 13:
              // reset cursor to start of next line
              this.cursorPosition.x = 0;
              if (this.cursorPosition.y < this.displaySpec.size.rows - 1) {
                this.cursorPosition.y += 1;
              }
              break;
            default:
              this.logMessage(`* UPD-ERROR  unknown action: ${action}`);
              break;
          }
        }
      });
      this.deferredCommands = []; // all done, empty the list
    }
  }

  private clearTerm(): void {
    // erase the text display area
    this.clearTextArea();
    // home the cursorPosition
    this.cursorPosition = { x: 0, y: 0 };
  }

  private clearTextArea(): void {
    if (this.debugWindow) {
      this.logMessage(`at clearTextArea()`);
      try {
        const bgcolor: string = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
        this.logMessage(`  -- bgcolor=[${bgcolor}]`);
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            // Locate the canvas element by its ID
            const canvas = document.getElementById('text-area');

            if (canvas && canvas instanceof HTMLCanvasElement) {
              // Get the canvas context
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Set the bg color
                const backgroundColor = '${bgcolor}';

                // clear the entire canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // fill canvas with background
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 00, canvas.width, canvas.height);
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update text:', error);
      }
    }
  }

  private writeStringToTerm(text: string): void {
    if (this.debugWindow) {
      this.logMessage(`at writeStringToTerm(${text})`);
      try {
        const textHeight: number = this.displaySpec.font.charHeight;
        const textSizePts: number = this.displaySpec.font.textSizePts;
        const lineHeight: number = this.displaySpec.font.lineHeight;
        const textYOffset: number = this.cursorPosition.y * lineHeight;
        const textXOffset: number = this.cursorPosition.x * this.displaySpec.font.charWidth + this.contentInset;
        const vertLineInset: number = (lineHeight - textHeight) / 2;
        const textYbaseline: number = textYOffset + vertLineInset + this.displaySpec.font.baseline + 4; // 4 is fudge number
        const fgColor: string = this.displaySpec.colorCombos[this.selectedCombo].fgcolor;
        const bgcolor: string = this.displaySpec.colorCombos[this.selectedCombo].bgcolor;
        // cts.font NOTEs:
        // ORDER: [font-style] [font-variant] [font-weight] [font-size]/[line-height] [font-family]
        // font-style: Can be "normal", "italic", or "oblique" (optional)
        // font-variant: Can be "normal" or "small-caps" (optional)
        // font-weight: Can be "normal", "bold", "bolder", "lighter", or a number between 100 and 900 (optional)
        // font-size: Specified in pixels (px), em, or other valid CSS units (required)
        // line-height: Specified after font-size, separated by a forward slash (optional)
        // font-family: The name of the font family or a comma-separated list of font families (required)
        const fontSpec: string = `normal ${textSizePts}pt Consolas, sans-serif`;
        this.logMessage(
          `  -- textXY=(${textYOffset},${textXOffset}), ht=(${textHeight}) colors=[${fgColor},${bgcolor}]`
        );
        this.logMessage(`  -- text=[${text}] fontSpec=[${fontSpec}]`);
        this.debugWindow.webContents.executeJavaScript(`
          (function() {
            // Locate the canvas element by its ID
            const canvas = document.getElementById('text-area');


            if (canvas && canvas instanceof HTMLCanvasElement) {
              // Get the canvas context
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Set the line color and width
                const lineColor = '${fgColor}';
                const backgroundColor = '${bgcolor}';
                const lineHeight = ${lineHeight};

                // Add text background
                ctx.font = '${fontSpec}';
                const textWidth = ctx.measureText('${text}').width;

                // clear existing text & background
                // clearRect(x, y, width, height);
                ctx.clearRect(${textXOffset}, ${textYOffset}, textWidth, lineHeight);

                // Add text background color
                ctx.fillStyle = backgroundColor;
                // fillRect(x, y, width, height);
                ctx.fillRect(${textXOffset}, ${textYOffset}, textWidth, lineHeight);

                // Add text of color
                ctx.fillStyle = lineColor;
                // fillText(text, x, y [, maxWidth]); // where y is baseline
                ctx.fillText('${text}', ${textXOffset}, ${textYbaseline});
              }
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to update text:', error);
      }
    }
  }
}
