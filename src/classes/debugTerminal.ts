/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

"use strict";
// src/classes/logger.ts
import { Context } from "../utils/context";
import { UsbSerial } from "../utils/usb.serial";
import { app, BrowserWindow } from "electron";

const DEFAULT_SERIAL_BAUD = 2000000;

export class DebugTerminal {
  private context: Context;
  private isLogging: boolean = false;
  private _deviceNode: string = "";
  private _serialPort: UsbSerial;
  private _serialBaud: number = DEFAULT_SERIAL_BAUD;
  private mainWindow: BrowserWindow | undefined = undefined;

  constructor(ctx: Context, deviceNode: string) {
    this.context = ctx;
    this._deviceNode = deviceNode;
    if (this.isLogging) {
      this.logMessage("DebugTerminal log started.");
    }
    this._serialPort = new UsbSerial(this.context, this._deviceNode);
    this._serialPort.on("data", (data) => this.handleSerialRx(data));
    app.whenReady().then(() => {
      this.createWindow();
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
    if (this.mainWindow !== undefined) {
      this.mainWindow.webContents.send("serial-data", data);
    }
  }

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

    this.mainWindow.loadFile("index.html");
  }

  // ----------------------------------------------------------------------

  private logMessage(message: string): void {
    if (this.isLogging) {
      //Write to output window.
      this.context.logger.logMessage(message);
    }
  }
}
