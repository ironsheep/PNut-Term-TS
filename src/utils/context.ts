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
  resetOnConnection: boolean;  // Control DTR/RTS reset on port open
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
    resetOnConnection: boolean;
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
  private preferencesFilePath: string = '';

  constructor(startupDirectory?: string) {
    this.runEnvironment = {
      selectedPropPlug: '',
      serialPortDevices: [],
      developerModeEnabled: false,
      logFilename: '',
      debugBaudrate: 2000000,
      ideMode: false,
      rtsOverride: false,     // Default to DTR unless IDE specifies RTS
      resetOnConnection: true,  // Default to traditional mode (reset on connect)
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
        autoReconnect: true,
        resetOnConnection: true
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

    // Set preferences file path and load saved preferences
    this.preferencesFilePath = path.join(this.currentFolder, 'pnut-term-preferences.json');
    this.loadPreferences();
  }

  /**
   * Load preferences from disk, or use defaults if file doesn't exist
   */
  private loadPreferences(): void {
    try {
      if (fs.existsSync(this.preferencesFilePath)) {
        const data = fs.readFileSync(this.preferencesFilePath, 'utf8');
        const savedPrefs = JSON.parse(data);
        this.preferences = { ...this.preferences, ...savedPrefs };

        // Sync resetOnConnection to runtime environment
        if (savedPrefs.serialPort && savedPrefs.serialPort.resetOnConnection !== undefined) {
          this.runEnvironment.resetOnConnection = savedPrefs.serialPort.resetOnConnection;
        }

        this.logConsoleMessage(`[CONTEXT] Loaded preferences from ${this.preferencesFilePath}`);
      } else {
        this.logConsoleMessage(`[CONTEXT] No preferences file found, using defaults`);
      }
    } catch (error) {
      this.logConsoleMessage(`[CONTEXT] Error loading preferences: ${error}, using defaults`);
    }
  }

  /**
   * Save preferences to disk
   */
  private savePreferences(): void {
    try {
      const data = JSON.stringify(this.preferences, null, 2);
      fs.writeFileSync(this.preferencesFilePath, data, 'utf8');
      this.logConsoleMessage(`[CONTEXT] Saved preferences to ${this.preferencesFilePath}`);
    } catch (error) {
      this.logConsoleMessage(`[CONTEXT] Error saving preferences: ${error}`);
    }
  }

  /**
   * Update user preferences and notify components
   */
  public updatePreferences(newPreferences: UserPreferences): void {
    this.preferences = { ...this.preferences, ...newPreferences };

    // Sync resetOnConnection to runtime environment
    if (newPreferences.serialPort && newPreferences.serialPort.resetOnConnection !== undefined) {
      this.runEnvironment.resetOnConnection = newPreferences.serialPort.resetOnConnection;
    }

    this.logConsoleMessage('[CONTEXT] Preferences updated:', this.preferences);

    // Save to disk
    this.savePreferences();
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
