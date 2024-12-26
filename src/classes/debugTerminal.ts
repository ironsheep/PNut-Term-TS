/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

"use strict";
// src/classes/debugTerminal.ts

import { app, BrowserWindow, Menu, MenuItem, dialog } from "electron";
import electron from "electron";
import { Context } from "../utils/context";
import { listFiles } from "../utils/files";
import { UsbSerial } from "../utils/usb.serial";
import * as fs from "fs";

const DEFAULT_SERIAL_BAUD = 2000000;
export interface WindowCoordinates {
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;
}

export class DebugTerminal {
  private context: Context;
  private isLogging: boolean = true; // remove before flight
  private _deviceNode: string = "";
  private _serialPort: UsbSerial | undefined = undefined;
  private _serialBaud: number = DEFAULT_SERIAL_BAUD;
  private mainWindow: BrowserWindow | null = null;
  private mainWindowOpen: boolean = false;
  private screenWidth: number = 800;
  private screenHeight: number = 600;
  private mainWindowGeometry: WindowCoordinates = {
    xOffset: 0,
    yOffset: 0,
    width: 800,
    height: 600,
  };

  constructor(ctx: Context) {
    this.context = ctx;
    this._deviceNode = this.context.runEnvironment.selectedPropPlug;
    if (this.isLogging) {
      this.logMessage("DebugTerminal started.");
    }

    /*
    let filesFound: string[] = listFiles("./");
    this.logMessage(
      `* DebugTerminal() - ./ ${filesFound.length} files found: [${filesFound}]`
    );
    filesFound = listFiles("./src");
    this.logMessage(
      `* DebugTerminal() - ./src ${filesFound.length} files found: [${filesFound}]`
    );
    */

    if (this._deviceNode.length > 0) {
      // we have a selected device. Attach to it.
      this.openSerialPort(this._deviceNode);
    }
  }

  public initialize() {
    // app.on('ready', this.createAppWindow);
    app.whenReady().then(() => {
      this.createAppWindow();
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
      this.mainWindowOpen = false;
    });

    app.on("activate", () => {
      if (this.mainWindow === null) {
        this.createAppWindow();
      }
    });
  }

  public isDone(): boolean {
    // return T/F where T means are window is closed or closing
    return this.mainWindowOpen == true ? false : true;
  }

  public close(): void {
    // Remove all listeners to prevent memory leaks and allow port to be reused
    if (this._serialPort !== undefined) {
      this._serialPort.removeAllListeners();
      this._serialPort.close();
    }
  }

  // ----------------------------------------------------------------------
  // this is our serial receiver!!
  //
  private openSerialPort(deviceNode: string) {
    UsbSerial.setCommBaudRate(this._serialBaud);
    this._serialPort = new UsbSerial(this.context, deviceNode);
    this._serialPort.on("data", (data) => this.handleSerialRx(data));
  }

  private handleSerialRx(data: any) {
    // Handle received data
    if (this.isLogging) {
      this.logMessage(`TERM: Received: ${data}`);
    }
    if (this.mainWindow !== null) {
      this.mainWindow.webContents.send("serial-data", data);
    }
  }

  // ----------------------------------------------------------------------
  // this is our Window Configuration
  //
  private CalcWindowCoords(): void {
    const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
    this.screenWidth = width;
    this.screenHeight = height;
    console.log(`work area size: ${width} x ${height}`);
    this.mainWindowGeometry.xOffset = Math.round(width / 4) * 3;
    this.mainWindowGeometry.yOffset = Math.round(height / 4) * 3;
    this.mainWindowGeometry.width = Math.round(width / 5);
    this.mainWindowGeometry.height = Math.round(height / 5);
    console.log(
      `window geom: ${this.mainWindowGeometry.width} x ${this.mainWindowGeometry.height} @ ${this.mainWindowGeometry.xOffset} x ${this.mainWindowGeometry.yOffset}`
    );
  }

  private createAppWindow() {
    this.logMessage(`* create App Window()`);

    this.CalcWindowCoords();

    this.mainWindow = new BrowserWindow({
      width: this.mainWindowGeometry.width,
      height: this.mainWindowGeometry.height,
      x: this.mainWindowGeometry.xOffset,
      y: this.mainWindowGeometry.yOffset,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.mainWindowOpen = true;

    // and load the main window .html of the app
    const htmlContent = `
  <html>
    <head>
      <meta charset="UTF-8">
      <title>PNut TermDebug TS</title>
      <style>
        body {
          display: flex;
          flex-direction: column;
          height: 100vh;
          margin: 0;
          font-family: Arial, sans-serif;
        }
        #log-content {
          flex-grow: 1;
          overflow-y: auto;
          padding: 10px;
          background-color: #000000; /* Black background */
          color: #00FF00; /* Lime-green text */
        }
        #status-bar {
          display: flex;
          justify-content: flex-end;
          background-color: #f0f0f0;
          padding: 10px;
          border-top: 1px solid #ccc;
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
      </style>
    </head>
    <body>
      <div id="log-content">
          <h1>Hello World!</h1>
<P>We are using Node.js <span id="node-version"></span>,
Chromium <span id="chrome-version"></span>,
and Electron <span id="electron-version"></span>.</P>
</div>
      <div id="status-bar">
      <div id="win-btns"> <button id="work-area-size">Create Window</button></div>
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

    this.mainWindow.loadURL(
      `data:text/html,${encodeURIComponent(htmlContent)}`
    );

    // Inject JavaScript into the renderer process
    this.getRuntimeVersions();

    const menuTemplate: (Electron.MenuItemConstructorOptions | MenuItem)[] = [
      {
        label: "PNut TermDebug TS", // Explicitly set the application name here
        submenu: [
          {
            label: "About...",
            click: () => {
              // show about dialog
              dialog.showMessageBox(this.mainWindow!, {
                type: "info",
                title: "About PNut TermDebug TS",
                message:
                  "PNut TermDebug TS\nVersion 1.0.0\n\nDeveloped by Your Iron Sheep Productions, LLC",
                buttons: ["OK"],
              });
            },
          },
          { type: "separator" },
          {
            label: "Quit",
            click() {
              console.log("MENU: Application is quitting...");
              app.quit();
            },
          },
        ],
      },
      {
        label: "File",
        submenu: [
          {
            label: "Save...",
            click: () => {
              dialog
                .showSaveDialog(this.mainWindow!, {
                  title: "Save Log",
                  defaultPath: "./Logs/log.txt",
                  filters: [{ name: "Text Files", extensions: ["txt"] }],
                })
                .then((result) => {
                  if (!result.canceled && result.filePath) {
                    this.mainWindow!.webContents.executeJavaScript(
                      'document.getElementById("log-content").innerText'
                    )
                      .then((fileContent: string) => {
                        fs.writeFileSync(result.filePath!, fileContent);
                      })
                      .catch((error: Error) => {
                        console.error("Failed to get log content:", error);
                      });
                  }
                })
                .catch((error: Error) => {
                  console.error("Failed to show save dialog:", error);
                });
            },
          },
        ],
      },
      {
        label: "ProPlug",
        submenu: [
          {
            label: "Select...",
            click: () => {
              const names = this.context.runEnvironment.serialPortDevices; // List of names
              dialog
                .showMessageBox(this.mainWindow!, {
                  type: "question",
                  buttons: names,
                  title: "Select Prop Plug",
                  message: "Choose a lProp Plug:",
                })
                .then((response) => {
                  const propPlug: string = names[response.response];
                  this.context.runEnvironment.selectedPropPlug = propPlug;

                  // Update the status bar with the selected name
                  this.updateStatusBarField("propPlug", propPlug);
                })
                .catch((error: Error) => {
                  console.error("Failed to show plug select dialog:", error);
                });
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    this.updateStatus();
    this.configWindowButtons();

    // every second write a new log entry (DUMMY for TESTING)
    this.mainWindow.webContents.on("did-finish-load", () => {
      // if logging post filename to status bar
      let logDisplayName: string = this.context.runEnvironment.logFilename;
      if (logDisplayName.length == 0) {
        logDisplayName = "{none}";
      }
      // Update the status bar with the selected name
      this.updateStatusBarField("logName", logDisplayName);

      setInterval(() => {
        this.appendLog("Log message " + new Date().toISOString());
        this.updateStatus();
      }, 1000);
    });

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
      this.mainWindowOpen = false;
    });
  }

  private getRuntimeVersions() {
    if (this.mainWindow) {
      try {
        this.mainWindow.webContents.executeJavaScript(
          ` const replaceText = (selector, text) => {
              const element = document.getElementById(selector);
              if (element) element.innerText = text;
            }

            for (const type of ['chrome', 'node', 'electron']) {
              replaceText(\`\${type}-version\`, process.versions[type]);
            }`
        );
      } catch (error) {
        console.error("Failed to update status bar field:", error);
      }
    }
  }

  private updateStatusBarField(fieldId: string, value: string) {
    this.mainWindow!.webContents.executeJavaScript(
      `document.getElementById("${fieldId}").innerText = "${value}";`
    );
  }

  private updateStatus() {
    if (this.mainWindow) {
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
        console.error("Failed to update status:", error);
      }
    }
  }

  private configWindowButtons() {
    if (this.mainWindow) {
      try {
        this.mainWindow.webContents.executeJavaScript(
          `const wasBtn = document.getElementById("work-area-size");
           wasBtn.addEventListener("click", function(event) {
                  const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize;
                  const win = new BrowserWindow({ width: width-50, height: height-50, x: 25, y: 25 });
                  win.loadURL("https://www.electronjs.org/");
        });`
        );
      } catch (error) {
        console.error("Failed to update status bar field:", error);
      }
    }
  }

  private appendLog(message: string) {
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
  }

  // ----------------------------------------------------------------------
  // fun code to remember...
  private getRandomColor(): string {
    const colors: string[] = [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffff00",
      "#00ffff",
      "#ff00ff",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ----------------------------------------------------------------------

  private logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage(message);
    }
  }
}
