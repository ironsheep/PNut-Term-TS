/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

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
  usbTrafficLogging: boolean;
  usbLogFilePath?: string;
}
export interface UserPreferences {
  logging: {
    logDirectory: string;
    autoSaveDebug: boolean;
    newLogOnDtrReset: boolean;
    maxLogSize: string;
  };
  recordings: {
    recordingsDirectory: string;
  };
  screenshots: {
    screenshotDirectory: string;
  };
  terminal: {
    mode: string;
    colorTheme: string;
    fontSize: number;
    fontFamily: string;
    showCogPrefixes: boolean;
    localEcho: boolean;
  };
  serialPort: {
    controlLine: string;
    defaultBaud: number;
    autoReconnect: boolean;
  };
  debugLogger: {
    scrollbackLines: number;
  };
}

export class Context {
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  public libraryFolder: string;
  public extensionFolder: string;
  public currentFolder: string;
  public logger: Logger;
  public runEnvironment: RuntimeEnvironment;
  public actions: Actions;
  public preferences: UserPreferences;

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
      consoleMode: false,     // Default to no console delay
      usbTrafficLogging: false,  // Default USB logging off
      usbLogFilePath: undefined
    };
    this.actions = {
      writeRAM: false,
      writeFlash: false,
      binFilename: '',
      binDirspec: ''
    };

    // Initialize default preferences
    this.preferences = {
      logging: {
        logDirectory: './logs/',
        autoSaveDebug: true,
        newLogOnDtrReset: true,
        maxLogSize: 'unlimited'
      },
      recordings: {
        recordingsDirectory: './recordings/'
      },
      screenshots: {
        screenshotDirectory: './screenshots/'
      },
      terminal: {
        mode: 'PST',
        colorTheme: 'green-on-black',
        fontSize: 14,
        fontFamily: 'default',
        showCogPrefixes: true,
        localEcho: false
      },
      serialPort: {
        controlLine: 'DTR',
        defaultBaud: 115200,
        autoReconnect: true
      },
      debugLogger: {
        scrollbackLines: 1000
      }
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

  /**
   * Update user preferences and notify components
   */
  public updatePreferences(newPreferences: UserPreferences): void {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.logConsoleMessage('[CONTEXT] Preferences updated:', this.preferences);
  }

  /**
   * Get the absolute path for the log directory based on current context and preferences
   */
  public getLogDirectory(): string {
    return path.join(this.currentFolder, this.preferences.logging.logDirectory);
  }

  /**
   * Get the absolute path for the recordings directory based on current context and preferences
   */
  public getRecordingsDirectory(): string {
    return path.join(this.currentFolder, this.preferences.recordings.recordingsDirectory);
  }

  /**
   * Get the absolute path for the screenshot directory based on current context and preferences
   */
  public getScreenshotDirectory(): string {
    return path.join(this.currentFolder, this.preferences.screenshots.screenshotDirectory);
  }
}
