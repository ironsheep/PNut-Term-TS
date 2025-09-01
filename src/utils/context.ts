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
  rtsOverride: boolean;
  loggingEnabled: boolean;
  loggingLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
  logToFile: boolean;
  consoleMode: boolean;
  logToConsole: boolean;
  verbose: boolean;
  quiet: boolean;
}
export class Context {
  public libraryFolder: string;
  public extensionFolder: string;
  public currentFolder: string;
  public logger: Logger;
  public runEnvironment: RuntimeEnvironment;
  public actions: Actions;

  constructor(startupDirectory?: string) {
    this.runEnvironment = {
      selectedPropPlug: '',
      serialPortDevices: [],
      developerModeEnabled: false,
      logFilename: '',
      debugBaudrate: 2000000,
      ideMode: false,
      rtsOverride: false,     // Default to DTR unless IDE specifies RTS
      loggingEnabled: false,  // Default to false for production
      loggingLevel: 'INFO',   // Default log level
      logToFile: false,
      logToConsole: true,
      verbose: false,
      quiet: false,
      consoleMode: false      // Default to no console delay
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
    // Use provided startup directory, fallback to process.cwd() for compatibility
    this.currentFolder = startupDirectory || process.cwd();
    this.logger = new Logger();
    this.logger.setContext(this);
  }
}
