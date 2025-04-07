/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
// src/classes/mainWindow.ts

import { app, BrowserWindow, Menu, MenuItem, dialog } from 'electron';
import electron from 'electron';
import { Context } from '../utils/context';
import { ensureDirExists, getFormattedDateTime } from '../utils/files';
import { UsbSerial } from '../utils/usb.serial';
import * as fs from 'fs';
import path from 'path';
import { DebugScopeWindow } from './debugScopeWin';
import { DebugWindowBase } from './debugWindowBase';
import { DebugTermWindow } from './debugTermWin';
import { DebugPlotWindow } from './debugPlotWin';
import { DebugLogicWindow } from './debugLogicWin';

export interface WindowCoordinates {
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;
}

export interface TerminalColor {
  xmitBGColor: string; // hex string '#RRGGBB'
  rcvBGColor: string;
  xmitFGColor: string;
  rcvFGColor: string;
}

const DEFAULT_SERIAL_BAUD = 2000000;
export class MainWindow {
  private context: Context;
  private isLogging: boolean = true; // WARNING (REMOVE BEFORE FLIGHT)- change to 'false' - disable before commit
  private _deviceNode: string = '';
  private _serialPort: UsbSerial | undefined = undefined;
  private _serialBaud: number = DEFAULT_SERIAL_BAUD;
  private mainWindow: BrowserWindow | null = null;
  private mainWindowOpen: boolean = false;
  private logFilenameBase: string = 'myapp';
  private loggingToFile: boolean = false;
  private waitingForINIT: boolean = true;
  private logFileSpec: string = '';
  private mainWindowGeometry: WindowCoordinates = {
    xOffset: 0,
    yOffset: 0,
    width: 800,
    height: 600
  };
  private displays: { [key: string]: DebugWindowBase } = {};
  private knownClosedBy: boolean = false; // compilicated determine if closed by app:quit or [x] close
  private rxQueue: string[] = [];
  private isProcessingQueue: boolean = false;
  private immediateLog: boolean = true;
  private termColors: TerminalColor = {
    xmitBGColor: '#FFF8E7', // hex string '#RRGGBB' yellowish pastel
    rcvBGColor: '#8AB3E9', // cyan pastel
    xmitFGColor: '#000000', // black
    rcvFGColor: '#000000' // black
  };

  constructor(ctx: Context) {
    this.context = ctx;
    this._deviceNode = this.context.runEnvironment.selectedPropPlug;
    if (this.isLogging) {
      this.logMessage('MainWindow started.');
    }
    const currFileTime: string = getFormattedDateTime();
    this.logFilenameBase = `myApp-${currFileTime}.log`;

    /*
    let filesFound: string[] = listFiles("./");
    this.logMessage(
      `* MainWindow() - ./ ${filesFound.length} files found: [${filesFound}]`
    );
    filesFound = listFiles("./src");
    this.logMessage(
      `* MainWindow() - ./src ${filesFound.length} files found: [${filesFound}]`
    );
    */
  }

  public initialize() {
    this.logMessage('* initialize()');
    // app.on('ready', this.createAppWindow);
    if (this._deviceNode.length > 0) {
      // we have a selected device. Attach to it.
      this.openSerialPort(this._deviceNode);
    }
    app.whenReady().then(() => {
      this.logMessage('* [whenReady]');
      this.createAppWindow();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
      this.mainWindowOpen = false;
    });

    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.logMessage('* [activate]');
        this.createAppWindow();
      }
    });
  }

  public isDone(): boolean {
    // return T/F where T means are window is closed or closing
    return this.mainWindowOpen == true ? false : true;
  }

  public async close(): Promise<void> {
    // Remove all listeners to prevent memory leaks and allow port to be reused
    this.logMessage('* close()');
    if (this._serialPort !== undefined) {
      this._serialPort.removeAllListeners();
      await this._serialPort.close();
      this._serialPort = undefined;
    }
  }

  // ----------------------------------------------------------------------
  // this is our serial transmitter!!
  //
  public sendSerialData(data: string): void {
    if (this._serialPort !== undefined) {
      this._serialPort.write(data);
    }
  }
  // ----------------------------------------------------------------------
  // this is our serial receiver!!
  //
  private async openSerialPort(deviceNode: string) {
    UsbSerial.setCommBaudRate(this._serialBaud);
    this.logMessage(`* openSerialPort() - ${deviceNode}`);
    try {
      this._serialPort = await new UsbSerial(this.context, deviceNode);
    } catch (error) {
      this.logMessage(`ERROR: openSerialPort() - ${deviceNode} failed to open. Error: ${error}`);
    }
    if (this._serialPort === undefined) {
      this.logMessage(`ERROR: openSerialPort() - ${deviceNode} failed to open`);
    }
    if (this._serialPort !== undefined) {
      this.logMessage(`* openSerialPort() - IS OPEN`);
      this._serialPort.on('data', (data) => this.handleSerialRx(data));
    }
  }

  private handleSerialRx(data: any) {
    // Handle received data
    let cleanedData = data.replace(/\0/g, ''); // remove any NULLs
    cleanedData = cleanedData.replace(/\x0a\x0d/g, '\x0a'); // replace any CRLFs with LFs
    cleanedData = cleanedData.replace(/\x0d/g, '\x0a'); // replace any CRs with LFs
    this.rxQueue.push(cleanedData);
    this.processRxQueue();
  }

  private emptyRxQueue() {
    this.rxQueue = [];
  }

  private processRxQueue() {
    if (!this.isProcessingQueue) {
      this.isProcessingQueue = true;
      const data: string | undefined = this.rxQueue.shift();
      if (data) {
        this.appendLog(data);
        if (data.charAt(0) === '`' && !this.waitingForINIT) {
          // handle debug command
          this.handleDebugCommand(data);
        } else if (data.startsWith('Cog') || data.startsWith('Prop')) {
          if (data.startsWith('Cog')) {
            this.waitingForINIT = false;
          }
          if (this.isLogging) {
            this.logMessage(`* Received: ${data}`);
          }
        }
      }
      this.isProcessingQueue = false;
    }
  }

  private DISPLAY_SCOPE: string = 'SCOPE';
  private DISPLAY_TERM: string = 'TERM';
  private DISPLAY_PLOT: string = 'PLOT';
  private DISPLAY_LOGIC: string = 'LOGIC';

  private handleDebugCommand(data: string) {
    //const lineParts: string[] = data.split(' ').filter(Boolean); // extra whitespace caused empty strings
    // Split the data and remove empty values
    const lineParts: string[] = data.split(' ').filter((part) => part.trim() !== '');
    this.logMessage(`* handleDebugCommand() - [${data}]: lineParts=[${lineParts.join(' | ')}](${lineParts.length})`);
    const possibleName: string = lineParts[0].substring(1).toUpperCase();
    let foundDisplay: boolean = false;
    if (lineParts[0].charAt(0) === '`') {
      // first, is this for one of our displays?
      const displayEntries = Object.entries(this.displays);
      displayEntries.forEach(([displayName, window]) => {
        if (displayName.toUpperCase() === possibleName) {
          // found it, route to the window handler
          const debugWindow = window as DebugWindowBase;
          // remove commas from the data
          const cleanedParts: string[] = lineParts.map((part) => part.replace(/,/g, ''));
          debugWindow.updateContent(cleanedParts); // NOTE: this will eventually show the debug window!
          foundDisplay = true;
        }
      });
      if (!foundDisplay) {
        // 2nd, is it a window creation command?
        this.logMessage(`* handleDebugCommand() - [${possibleName}]`);
        switch (possibleName) {
          case this.DISPLAY_SCOPE: {
            // create new window to display scope data
            const [isValid, scopeSpec] = DebugScopeWindow.parseScopeDeclaration(lineParts);
            this.logMessage(`* handleDebugCommand() - back from parse`);
            if (isValid) {
              // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
              const scopeDisplay = new DebugScopeWindow(this.context, scopeSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(scopeSpec.displayName, scopeDisplay);
            } else {
              if (this.isLogging) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          case this.DISPLAY_LOGIC: {
            // create new window to display scope data
            const [isValid, logicSpec] = DebugLogicWindow.parseLogicDeclaration(lineParts);
            this.logMessage(`* handleDebugCommand() - back from parse`);
            if (isValid) {
              // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
              const logicDisplay = new DebugLogicWindow(this.context, logicSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(logicSpec.displayName, logicDisplay);
            } else {
              if (this.isLogging) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          case this.DISPLAY_TERM: {
            // create new window to display scope data
            const [isValid, termSpec] = DebugTermWindow.parseTermDeclaration(lineParts);
            this.logMessage(`* handleDebugCommand() - back from parse`);
            if (isValid) {
              // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
              const termDisplay = new DebugTermWindow(this.context, termSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(termSpec.displayName, termDisplay);
            } else {
              if (this.isLogging) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          case this.DISPLAY_PLOT: {
            // create new window to display scope data
            const [isValid, plotSpec] = DebugPlotWindow.parsePlotDeclaration(lineParts);
            this.logMessage(`* handleDebugCommand() - back from parse`);
            if (isValid) {
              // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
              const plotDisplay = new DebugPlotWindow(this.context, plotSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(plotSpec.displayName, plotDisplay);
            } else {
              if (this.isLogging) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          default:
            this.logMessage(`ERROR: display [${possibleName}] not supported!`);
            break;
        }
      }
      if (foundDisplay) {
        this.immediateLog = false; // change from immediate log to buffered log
      }
      if (!foundDisplay && this.mainWindow != null) {
        if (this.isLogging) {
          this.logMessage(`* Received: ${data} - UNHANDLED  lineParts=[${lineParts.join(',')}]`);
        }
      }
    }
  }

  private hookNotifcationsAndRememberWindow(windowName: string, windowObject: DebugWindowBase) {
    this.logMessage(`GOOD DISPLAY: Received for ${windowName}`);
    // esure we get notifications of window close
    windowObject.on('close', () => {
      this.logMessage(`CallBack: Window ${windowName} is closing.`);
      this.cleanupOnClose(windowName);
    });
    windowObject.on('closed', () => {
      this.logMessage(`CallBack: Window ${windowName} has closed.`);
    });
    // remember active displays!
    this.displays[windowName] = windowObject;
  }

  private cleanupOnClose(windowName: string) {
    this.logMessage(`cleanupOnClose() ${windowName}`);
    // flush the log buffer
    this.flushLogBuffer();
    this.immediateLog = true;
    const windowObject: DebugWindowBase = this.displays[windowName];
    // remove the window from the list of active displays
    delete this.displays[windowName];
    // and remove listeners
    windowObject.removeAllListeners();
  }

  // ----------------------------------------------------------------------
  // this is our Window Configuration
  //
  private async CalcWindowCoords(): Promise<void> {
    const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
    console.log(`work area size: ${width} x ${height}`);

    // Create a canvas element to measure text dimensions
    const { charWidth, charHeight } = await this.getFontMetrics('12pt Consolas, sans-serif', 12, 18);
    console.log(`     char size: ${charWidth} x ${charHeight}`);

    // Calculate the required dimensions for 24 lines by 80 characters
    const minWidth = 80 * charWidth; // Minimum width for 80 characters
    const minHeight = (24 + 1) * charHeight; // Minimum height for 24 lines + 1 for xmit data entry

    // have small screen
    // linux: 1280x720
    // set to 80x24 porportioned screen

    // have larger screen
    // macOS (rt): 3200x1775
    // macOS (lt): 3200?x1775?
    // set to 80x24 porportioned screen
    const targetScreenWidth: number = height < 800 ? Math.round(width / 2) : Math.round(width / 4);
    const targetScreenHeight: number =
      height < 800 ? Math.round((height / 5) * 2) : Math.round(this.mainWindowGeometry.width / 3.3);

    // Ensure the window is at least the minimum size
    this.mainWindowGeometry.width = Math.max(minWidth, targetScreenWidth);
    this.mainWindowGeometry.height = Math.max(minHeight, targetScreenHeight);
    // position window bottom-right
    this.mainWindowGeometry.xOffset = Math.round((width - this.mainWindowGeometry.width) / 4) * 3;
    this.mainWindowGeometry.yOffset = Math.round((height - this.mainWindowGeometry.height) / 4) * 3;

    console.log(
      `window geom: ${this.mainWindowGeometry.width}x${this.mainWindowGeometry.height} @${this.mainWindowGeometry.xOffset},${this.mainWindowGeometry.yOffset}`
    );
  }

  private async createAppWindow() {
    this.logMessage(`* create App Window()`);
    this.mainWindowOpen = true;

    await this.CalcWindowCoords();

    this.mainWindow = new BrowserWindow({
      width: this.mainWindowGeometry.width,
      height: this.mainWindowGeometry.height,
      x: this.mainWindowGeometry.xOffset,
      y: this.mainWindowGeometry.yOffset,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const dataEntryBGColor: string = this.termColors.xmitBGColor;
    const dataEntryFGColor: string = this.termColors.xmitFGColor;
    const logContentBGColor: string = this.termColors.rcvBGColor;
    const logContentFGColor: string = this.termColors.rcvFGColor;

    // and load the main window .html of the app
    const htmlContent = `
  <html>
    <head>
      <meta charset="UTF-8">
      <title>PNut Term TS</title>
      <style>
          @font-face {
            font-family: 'Parallax';
            src: url('./resources/fonts/Parallax.ttf') format('truetype');
          }
        body {
          display: flex;
          flex-direction: column;
          height: 100vh;
          margin: 0;
          font-family: Consolas, sans-serif; /* Use Arial or any sans-serif font */
          font-size: 12px; /* Set a smaller font size */
        }
        p {
          margin: 0;
        }
        #dataEntry {
          position: fixed;
          top: 0;
          flex-grow: 1;
          padding: 0px;
          margin-bottom: 0px;
          background-color: ${dataEntryBGColor};
          color: ${dataEntryFGColor};
          width: 100%; /* Make dataEntry span the full width */
          z-index: 1;
        }
        #log-content {
          position: absolute;
          top: 18px; /* Height of #dataEntry -10? */
          bottom: 41px; /* Height of #status-bar -18? */
          left: 0;
          right: 0;
          flex-grow: 1;
          overflow-y: auto;
          padding: 10px;
          background-color: ${logContentBGColor};
          color: ${logContentFGColor};
        }
        #status-bar {
          position: fixed;
          bottom: 0;
          display: flex;
          justify-content: flex-end;
          background-color: #f0f0f0;
          padding: 10px;
          border-top: 1px solid #ccc;
          z-index: 1;
        }
        .status-field {
          margin-left: 20px;
          display: flex;
          align-items: center;
        }
        .status-label {
          font-weight: bold;
          margin-right: 5px;
        }
        .status-value {
          padding: 2px 5px;
          background-color: #e0e0e0;
          border: 1px solid #ccc;
          border-radius: 3px;
        }
        #kbd-entry {
          width: 100%; /* Make kbd-entry span the full width */
        }
        #in-out {
          width: 100%; /* Make kbd-entry span the full width */
          display: flex;
          flex-direction: column;
          margin: 0px;
          padding: 0px;
        }
      </style>
    </head>
    <body>
      <div id="in-out">
        <div id="kbd-entry">
          <input type="text" id="dataEntry" placeholder="Enter text here">
        </div>
        <div id="log-content">
            <h1>Hello World!</h1>
<P>We are using Node.js <span id="node-version"></span>,
Chromium <span id="chrome-version"></span>,
and Electron <span id="electron-version"></span>.</P>
<P>---------+---------+---------+---------+---------+---------+---------+---------+</P>
</div>
      </div>
      <div id="status-bar">
  <div id="logName" class="status-field">
    <span class="status-label">Log Name:</span>
    <span class="status-value"> </span>
  </div>
  <div id="propPlug" class="status-field">
    <span class="status-label">Prop Plug:</span>
    <span class="status-value"> </span>
  </div>
  <div id="otherField" class="status-field">
    <span class="status-label">Nbr Lines:</span>
    <span class="status-value"> </span>
  </div>
      </div>
    </body>
  </html>
`;

    this.mainWindow.loadURL(`data:text/html,${encodeURIComponent(htmlContent)}`);

    // Inject JavaScript into the renderer process
    this.getRuntimeVersions();

    const menuTemplate: (Electron.MenuItemConstructorOptions | MenuItem)[] = [
      {
        label: 'PNut Term TS', // Explicitly set the application name here
        submenu: [
          {
            label: '&About...',
            click: () => {
              // show about dialog
              dialog.showMessageBox(this.mainWindow!, {
                type: 'info',
                title: 'About PNut Term TS',
                message: 'PNut Term TS\nVersion 1.0.0\n\n by Iron Sheep Productions, LLC',
                buttons: ['OK']
              });
            }
          },
          { type: 'separator' },
          {
            label: '&Quit',
            click: () => {
              console.log('MENU: Application is quitting...');
              this.knownClosedBy = true;
              app.quit();
            }
          }
        ]
      },
      {
        label: 'File',
        submenu: [
          {
            label: '&Log to file...',
            click: () => {
              dialog
                .showSaveDialog(this.mainWindow!, {
                  title: 'Save Log',
                  defaultPath: `./Logs/${this.logFilenameBase}`,
                  filters: [{ name: 'Text Files', extensions: ['txt'] }]
                })
                .then((result) => {
                  if (!result.canceled && result.filePath) {
                    const logFilename: string = this.enableLogging(result.filePath);
                    // Update the status bar with the selected name
                    this.updateStatusBarField('logName', logFilename);
                    this.mainWindow!.webContents.executeJavaScript('document.getElementById("log-content").innerText')
                      .then((fileContent: string) => {
                        fs.writeFileSync(this.logFileSpec!, fileContent);
                      })
                      .catch((error: Error) => {
                        console.error('Failed to get log content:', error);
                      });
                  }
                })
                .catch((error: Error) => {
                  console.error('Failed to show save dialog:', error);
                });
            }
          }
        ]
      },
      {
        label: 'ProPlug',
        submenu: [
          {
            label: 'Select...',
            click: () => {
              const names = this.context.runEnvironment.serialPortDevices; // List of names
              dialog
                .showMessageBox(this.mainWindow!, {
                  type: 'question',
                  buttons: names,
                  title: 'Select Prop Plug',
                  message: 'Choose a lProp Plug:'
                })
                .then((response) => {
                  const propPlug: string = names[response.response];
                  this.context.runEnvironment.selectedPropPlug = propPlug;

                  // Update the status bar with the selected name
                  this.updateStatusBarField('propPlug', propPlug);
                })
                .catch((error: Error) => {
                  console.error('Failed to show plug select dialog:', error);
                });
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    this.updateStatus(); // set initial values

    // every second write a new log entry (DUMMY for TESTING)
    this.mainWindow.webContents.on('did-finish-load', () => {
      // if logging post filename to status bar
      this.logMessage('* [did-finish-load]');
      let logDisplayName: string = this.context.runEnvironment.logFilename;
      if (logDisplayName.length == 0) {
        logDisplayName = '{none}';
        this.loggingToFile = false;
      } else {
        this.enableLogging(logDisplayName);
      }
      // Update the status bar with the selected name
      this.updateStatusBarField('logName', logDisplayName);
      //   and PropPlug
      if (this._deviceNode.length > 0) {
        this.updateStatusBarField('propPlug', this._deviceNode);
      }

      this.hookTextInputControl('dataEntry', (event: Event) => {
        const inputElement = event.target as HTMLInputElement;
        console.log(`Input value: [${inputElement.value}]`);
        if (event instanceof KeyboardEvent && event.key === 'Enter') {
          this.sendSerialData(inputElement.value);
          inputElement.value = '';
        }
      });

      if (this._serialPort === undefined) {
        this.logMessage('* no serial port, generating test data');
        // TEST CODE - TEST CODE - TEST CODE - TEST CODE
        // load the log file into the
        setInterval(() => {
          this.appendLog('- TEST Log message ' + new Date().toISOString());
          this.updateStatus(); // TEST CODE - TEST CODE - TEST CODE - TEST CODE
        }, 1000);
      }
    });

    this.mainWindow.on('close', () => {
      if (!this.knownClosedBy) {
        this.logMessage('[x]: Application is quitting...[close]');
      }
      this.closeAllDebugWindows(); // close all child windows, too
    });

    this.mainWindow.on('closed', () => {
      this.logMessage('* Main window [closed]');
      this.mainWindow = null;
      this.mainWindowOpen = false;
    });
  }

  // Method to close all debug windows
  private closeAllDebugWindows(): void {
    // step usb receiver
    this.mainWindow?.removeAllListeners();
    // empty any pending messages by processing them...
    this.processRxQueue();
    // flsuh one last time in case there are any left
    this.flushLogBuffer(); // will do nothing if buffer is empty
    this.emptyRxQueue();
    // shut down any active displays
    const displayEntries = Object.entries(this.displays);
    displayEntries.forEach(([windowName, windowObject]) => {
      this.logMessage(`* closeAllDebugWindows() - Closing window: ${windowName}`);
      const window: DebugWindowBase = windowObject as DebugWindowBase;
      window.closeDebugWindow();
    });
    this.displays = {}; // and empty the list
  }

  private setKnownClosedBy() {
    this.knownClosedBy = true;
  }

  private enableLogging(logFilename: string): string {
    let filename: string = '';
    if (logFilename.length == 0) {
      this.loggingToFile = false;
    } else {
      this.loggingToFile = true;
      filename = path.basename(logFilename);
      const logFolder = path.join(this.context.currentFolder, 'Logs');
      ensureDirExists(logFolder);
      this.logFileSpec = path.join(logFolder, filename);
    }
    return filename;
  }

  private getRuntimeVersions() {
    if (this.mainWindow) {
      try {
        // locate text in window and make substitutions...
        this.mainWindow.webContents.executeJavaScript(`
          const replaceText = (selector, text) => {
            const element = document.getElementById(selector);
            if (element) element.innerText = text;
          }

          for (const type of ['chrome', 'node', 'electron']) {
            replaceText(\`\${type}-version\`, process.versions[type]);
          }
        `);
      } catch (error) {
        console.error('Failed to update text in main document:', error);
      }
    }
  }

  private updateStatusBarField(fieldId: string, value: string) {
    if (this.mainWindow) {
      try {
        // locate named element in status bar and update it
        this.mainWindow.webContents.executeJavaScript(
          `document.getElementById("${fieldId}").querySelector('.status-value').innerText = "${value}";`
        );
      } catch (error) {
        console.error('Failed to update status bar field:', error);
      }
    }
  }

  private updateStatus() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.executeJavaScript(`
          (function() {
            const logContent = document.getElementById('log-content');
            const statusBar = document.getElementById('status-bar');
            const lineCount = logContent.childElementCount;
            document.getElementById("otherField").querySelector('.status-value').innerText = lineCount;
          })();
        `);
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    }
  }

  private async getFontMetrics(
    fontSpec: string,
    defaultCharWidth: number = 12,
    defaultCharHeight: number = 12
  ): Promise<{ charWidth: number; charHeight: number }> {
    let charWidth = defaultCharWidth;
    let charHeight = defaultCharHeight;
    if (this.mainWindow) {
      try {
        const metrics = await this.mainWindow.webContents.executeJavaScript(`
          (function() {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = \'${fontSpec}\'; // Set the font to match the one used in the app

            // Measure the width and height of a single character
            const metrics = context.measureText('M');
            const charWidth = metrics.width;
            const actualBoundingBoxAscent = metrics.actualBoundingBoxAscent || 0;
            const actualBoundingBoxDescent = metrics.actualBoundingBoxDescent || 0;
            const charHeight = actualBoundingBoxAscent + actualBoundingBoxDescent;

            return { charWidth, charHeight };
          })();
        `);
        // Override defaults with measured values
        charWidth = metrics.charWidth;
        charHeight = metrics.charHeight;
      } catch (error) {
        console.error('ERROR: getFontMetrics() Failed to get font metrics:', error);
      }
    } else {
      console.error('ERROR: getFontMetrics() NO Main Window!');
    }
    console.error(`* getFontMetrics() -> (${charWidth}x${charHeight})`);
    return { charWidth, charHeight }; // Default values
  }

  private hookTextInputControl(inputId: string, callback: (event: Event) => void): void {
    if (this.mainWindow) {
      try {
        // Convert the callback function to a string
        const callbackString = callback.toString();

        // Inject JavaScript into the renderer process to attach the callback
        this.mainWindow.webContents.executeJavaScript(`
          (function() {
            const inputElement = document.getElementById('${inputId}');
            if (inputElement) {
              inputElement.addEventListener('input', ${callbackString});
            } else {
              console.error('Input element with id "${inputId}" not found.');
            }
          })();
        `);
      } catch (error) {
        console.error('Failed to hook input control:', error);
      }
    }
  }

  /*
  // ----------------------------------------------------------------------
  //   this didin't work but it is a good example of how to buffer log messages?
  // ----------------------------------------------------------------------
  private logBuffer: string[] = [];
  private logBufferTimeout: NodeJS.Timeout | null = null;
  private FLUSH_INERVAL_MS: number = 100; // Adjust the timeout as needed

  private appendLog(message: string) {
    // Add the message to the buffer
    this.logBuffer.push(message);

    // If there is no timeout set, set one to process the buffer
    if (this.logBufferTimeout == null) {
      this.logBufferTimeout = setTimeout(() => {
        this.flushLogBuffer();
      }, this.FLUSH_INERVAL_MS);
    }

    // If logging to file, append to output file
    if (this.loggingToFile) {
      this.appendToFile(this.logFileSpec, `${message}\n`);
    }
  }

  private flushLogBuffer() {
    if (this.mainWindow && this.logBuffer.length > 0) {
      const messages = this.logBuffer.join('\n');
      this.mainWindow.webContents.executeJavaScript(`
        (function() {
          const logContent = document.getElementById('log-content');
          const p = document.createElement('p');
          p.textContent = "${messages.replace(/"/g, '\\"')}";
          logContent.appendChild(p);
          logContent.scrollTop = logContent.scrollHeight;
        })();
      `);
      this.logBuffer = [];
      this.logBufferTimeout = null;
    }
  }

  // ----------------------------------------------------------------------
  */

  private appendLogOld(message: string) {
    if (this.mainWindow) {
      this.mainWindow.webContents.executeJavaScript(`
        (function() {
          const logContent = document.getElementById('log-content');
          const p = document.createElement('p');
          p.textContent = "${message}";
          logContent.appendChild(p);
          logContent.scrollTop = logContent.scrollHeight;
        })();
      `);
    }
    // and if logging, append to output file
    if (this.loggingToFile) {
      this.appendToFile(this.logFileSpec, `${message}\n`);
    }
  }

  private PEND_MESSAGE_COUNT: number = 100;

  private appendLog(message: string) {
    if (this.mainWindow) {
      this.logBuffer.push(message);
      if (this.logBuffer.length > this.PEND_MESSAGE_COUNT || this.immediateLog) {
        this.flushLogBuffer();
      }
    }
    // and if logging, append to output file
    if (this.loggingToFile) {
      this.appendToFile(this.logFileSpec, `${message}\n`);
    }
  }

  private logBuffer: string[] = [];

  private flushLogBuffer() {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.logBuffer.length > 0) {
      // Serialize the logBuffer array to a JSON string
      const messages = JSON.stringify(this.logBuffer);
      this.mainWindow.webContents.executeJavaScript(`
        (function() {
          const logContent = document.getElementById('log-content');
          const messagesArray = ${messages};  // Parse the JSON string to get the array
          messagesArray.forEach(message => {
            const p = document.createElement('p');
            p.textContent = message;
            logContent.appendChild(p);
          });
          logContent.scrollTop = logContent.scrollHeight;
        })();
      `);
      this.logBuffer = [];
      this.updateStatus();
    }
  }

  // Method to append a message to an existing file
  private appendToFile(filePath: string, message: string) {
    fs.appendFile(filePath, message, (err) => {
      if (err) {
        console.error('Failed to append to file:', err);
      }
    });
  }

  // ----------------------------------------------------------------------

  private logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage('Tmnl: ' + message);
    }
  }
}
