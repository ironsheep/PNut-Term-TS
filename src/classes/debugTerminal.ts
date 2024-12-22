/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

"use strict";
// src/classes/debugTerminal.ts

import { app, BrowserWindow, Menu, MenuItem, dialog } from "electron";
import { Context } from "../utils/context";
import { listFiles } from "../utils/files";
import { UsbSerial } from "../utils/usb.serial";
import * as fs from "fs";

const DEFAULT_SERIAL_BAUD = 2000000;

export class DebugTerminal {
  private context: Context;
  private isLogging: boolean = true; // remove before flight
  private _deviceNode: string = "";
  private _serialPort: UsbSerial | undefined = undefined;
  private _serialBaud: number = DEFAULT_SERIAL_BAUD;
  private mainWindow: BrowserWindow | null = null;
  private mainWindowOpen: boolean = false;

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
  private createAppWindow() {
    this.logMessage(`* create App Window()`);
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.mainWindowOpen = true;

    const menuTemplate: (Electron.MenuItemConstructorOptions | MenuItem)[] = [
      {
        label: "Terminal",
        submenu: [{ label: "Quit", role: "quit" }],
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

    this.mainWindow.loadURL(`data:text/html,
    <html>
      <head>
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
            background-color: #f0f0f0;
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
          }
        </style>
      </head>
      <body>
        <div id="log-content"></div>
        <div id="status-bar">
          <div id="logName" class="status-field">Log Name: </div>
          <div id="propPlug" class="status-field">Prop Plug: </div>
          <div id="otherField" class="status-field">Other Field: </div>
        </div>
      </body>
    </html>
  `);

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

  private updateStatusBarField(fieldId: string, value: string) {
    this.mainWindow!.webContents.executeJavaScript(
      `document.getElementById("${fieldId}").innerText = "${value}";`
    );
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

  private updateStatus() {
    if (this.mainWindow) {
      this.mainWindow.webContents.executeJavaScript(`
        (function() {
          const logContent = document.getElementById('log-content');
          const statusBar = document.getElementById('status-bar');
          statusBar.textContent = 'Lines: ' + logContent.childElementCount;
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
