/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */

// Common runtime context shares by classes in Pnut-TS.

// src/utils/context.ts

'use strict';
import fs from 'fs';
import path from 'path';
import { Logger } from '../classes/logger';

export interface Actions {
  writeRAM: boolean;
  writeFlash: boolean;
  binFilename: string;
  binDirspec: string;
}
export interface RuntimeEnvironment {
  serialPortDevices: string[];
  selectedPropPlug: string;
  logFilename: string;
  developerModeEnabled: boolean;
  debugBaudrate: number;
  ideMode: boolean;
}
export class Context {
  public libraryFolder: string;
  public extensionFolder: string;
  public currentFolder: string;
  public logger: Logger;
  public runEnvironment: RuntimeEnvironment;
  public actions: Actions;

  constructor() {
    this.runEnvironment = {
      selectedPropPlug: '',
      serialPortDevices: [],
      developerModeEnabled: false,
      logFilename: '',
      debugBaudrate: 2000000,
      ideMode: false
    };
    this.actions = {
      writeRAM: false,
      writeFlash: false,
      binFilename: '',
      binDirspec: ''
    };

    let possiblePath = path.join(__dirname, '../lib');
    if (!fs.existsSync(possiblePath)) {
      possiblePath = path.join(__dirname, 'lib');
    }
    this.libraryFolder = possiblePath;
    possiblePath = path.join(__dirname, '../ext');
    if (!fs.existsSync(possiblePath)) {
      possiblePath = path.join(__dirname, 'ext');
    }
    this.extensionFolder = possiblePath;
    this.currentFolder = process.cwd();
    this.logger = new Logger();
  }
}
