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
  private _serialPort: UsbSerial;
  private _serialBaud: number = DEFAULT_SERIAL_BAUD;
  private mainWindow: BrowserWindow | null = null;

  constructor(ctx: Context) {
    this.context = ctx;
    this._deviceNode = this.context.runEnvironment.selectedPropPlug;
    if (this.isLogging) {
      this.logMessage("DebugTerminal log started.");
    }
    this._serialPort = new UsbSerial(this.context, this._deviceNode);
    this._serialPort.on("data", (data) => this.handleSerialRx(data));

    let filesFound: string[] = listFiles("./");
    this.logMessage(
      `* DebugTerminal() - ./ ${filesFound.length} files found: [${filesFound}]`
    );
    filesFound = listFiles("./src");
    this.logMessage(
      `* DebugTerminal() - ./src ${filesFound.length} files found: [${filesFound}]`
    );
  }

  public initialize() {
    // app.on('ready', this.createWindow);
    app.whenReady().then(() => {
      this.createWindow();
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", () => {
      if (this.mainWindow === null) {
        this.createWindow();
      }
    });
  }

  public isDone(): boolean {
    return false; // FIXME: this needs to be set when user wants to close the terminal
  }

  public close(): void {
    // Remove all listeners to prevent memory leaks and allow port to be reused
    this._serialPort.removeAllListeners();
    this._serialPort.close();
  }

  // ----------------------------------------------------------------------
  // this is our serial receiver!!
  //
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
  private createWindow() {
    this.logMessage(`* createWindow()`);
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

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
            background-color: #ddd;
            padding: 5px;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div id="log-content"></div>
        <div id="status-bar">Ready</div>
      </body>
    </html>
  `);

    // every second write a new log entry (DUMMY for TESTING)
    this.mainWindow.webContents.on("did-finish-load", () => {
      setInterval(() => {
        this.appendLog("Log message " + new Date().toISOString());
        this.updateStatus();
      }, 1000);
    });

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
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
