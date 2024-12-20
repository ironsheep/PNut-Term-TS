/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

"use strict";
// src/classes/debugTerminal.ts
import { app, BrowserWindow } from "electron";
import { Context } from "../utils/context";
import { fileExists, listFiles } from "../utils/files";
import { UsbSerial } from "../utils/usb.serial";
import path from "path";

const DEFAULT_SERIAL_BAUD = 2000000;

export class DebugTerminal {
  private context: Context;
  private isLogging: boolean = true; // remove before flight
  private _deviceNode: string = "";
  private _serialPort: UsbSerial;
  private _serialBaud: number = DEFAULT_SERIAL_BAUD;
  private mainWindow: BrowserWindow | null = null;
  private _indexPath: string = "./index.html";

  constructor(ctx: Context) {
    this.context = ctx;
    this._deviceNode = this.context.runEnvironment.selectedPropPlug;
    if (this.isLogging) {
      this.logMessage("DebugTerminal log started.");
    }
    this._serialPort = new UsbSerial(this.context, this._deviceNode);
    this._serialPort.on("data", (data) => this.handleSerialRx(data));

    if (!fileExists(this._indexPath)) {
      this._indexPath = "./src/index.html";
    }

    if (!fileExists(this._indexPath)) {
      this.logMessage(`* DebugTerminal() - ${this._indexPath} not found!`);
    }

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
  private handleSerialRx(data: any) {
    // Handle received data
    if (this.isLogging) {
      this.logMessage(`TERM: Received: ${data}`);
    }
    if (this.mainWindow !== null) {
      this.mainWindow.webContents.send("serial-data", data);
    }
  }

  private createWindow() {
    this.logMessage(`* createWindow()`);
    const preloadFSpec: string = path.join(__dirname, "preload.js");
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        preload: preloadFSpec, // Optional: preload script
      },
    });

    if (!fileExists(preloadFSpec)) {
      this.logMessage(`* createWindow() - preload.js not found!`);
    }
    // Load the local index.html file
    if (fileExists(this._indexPath)) {
      this.mainWindow.loadFile(this._indexPath);
    } else {
      this.logMessage(`* createWindow() - index.html not found!`);
    }

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
  }

  // ----------------------------------------------------------------------

  private logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage(message);
    }
  }
}
