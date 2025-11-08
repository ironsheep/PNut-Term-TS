/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */

const ENABLE_CONSOLE_LOG: boolean = false; // Temporarily enabled for debugging settings
const ENABLE_DEBUGGER_WINDOWS: boolean = false; // Feature flag: Disable debugger windows for v0.9.0 release

// Export feature flags for use throughout the application
export const FEATURE_FLAGS = {
  ENABLE_DEBUGGER_WINDOWS: ENABLE_DEBUGGER_WINDOWS
} as const;

// Common runtime context shares by classes in Pnut-TS.

// src/utils/context.ts

('use strict');
import fs from 'fs';
import path from 'path';
import os from 'os';
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
  debugBaudrate?: number; // Optional - only set if specified on command line
  debugBaudRateFromCLI: boolean; // True if -b was provided on command line
  ideMode: boolean;
  rtsOverride: boolean;
  resetOnConnection: boolean; // Control DTR/RTS reset on port open
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
    resetOnConnection: boolean;
  };
  debugLogger: {
    scrollbackLines: number;
  };
  suppressedDirectoryWarnings?: string[]; // Directories to not warn about
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

  /**
   * Get platform-specific user global settings path
   * Windows: %APPDATA%\PNut-Term-TS\settings.json
   * Linux/Mac: ~/.pnut-term-ts-settings.json
   */
  private static getUserGlobalSettingsPath(): string {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Use AppData\Roaming to avoid permissions issues
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const settingsDir = path.join(appData, 'PNut-Term-TS');

      // Ensure directory exists
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }

      return path.join(settingsDir, 'settings.json');
    } else {
      // Linux/Mac: Use dotfile in home directory
      return path.join(os.homedir(), '.pnut-term-ts-settings.json');
    }
  }

  public libraryFolder: string;
  public extensionFolder: string;
  public currentFolder: string;
  public logger: Logger;
  public runEnvironment: RuntimeEnvironment;
  public actions: Actions;
  public preferences: UserPreferences;
  private userGlobalSettingsPath: string = '';
  private projectLocalSettingsPath: string = '';

  constructor(startupDirectory?: string) {
    this.runEnvironment = {
      selectedPropPlug: '',
      serialPortDevices: [],
      developerModeEnabled: false,
      logFilename: '',
      debugBaudrate: undefined, // No default - will be set from CLI or preferences
      debugBaudRateFromCLI: false, // Default: not specified on command line
      ideMode: false,
      rtsOverride: false, // Default to DTR unless IDE specifies RTS
      resetOnConnection: true, // Default to traditional mode (reset on connect)
      loggingEnabled: false, // Default to false for production
      loggingLevel: 'INFO', // Default log level
      logToFile: false,
      logToConsole: true,
      verbose: false,
      quiet: false,
      consoleMode: false, // Default to no console delay
      usbTrafficLogging: false, // Default USB logging off
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

    // Set settings file paths
    this.userGlobalSettingsPath = Context.getUserGlobalSettingsPath();
    this.projectLocalSettingsPath = path.join(this.currentFolder, '.pnut-term-ts-settings.json');

    // Load settings with cascade: app defaults → user global → project local
    this.loadHierarchicalSettings();
  }

  /**
   * Load settings with hierarchical cascade:
   * 1. App defaults (already set in constructor)
   * 2. User global settings (override defaults)
   * 3. Project local settings (override user global)
   */
  private loadHierarchicalSettings(): void {
    // Start with app defaults (already initialized in constructor)
    const appDefaults = { ...this.preferences };

    // Layer 2: Load user global settings
    const userGlobalSettings = this.loadUserGlobalSettings();
    if (userGlobalSettings) {
      this.deepMerge(this.preferences, userGlobalSettings);
      this.logConsoleMessage(`[SETTINGS] Loaded user global from ${this.userGlobalSettingsPath}`);
    } else {
      this.logConsoleMessage(`[SETTINGS] No user global settings, using app defaults`);
    }

    // Layer 3: Load project local settings
    const projectLocalSettings = this.loadProjectLocalSettings();
    if (projectLocalSettings) {
      this.deepMerge(this.preferences, projectLocalSettings);
      this.logConsoleMessage(`[SETTINGS] Loaded project local from ${this.projectLocalSettingsPath}`);
    } else {
      this.logConsoleMessage(`[SETTINGS] No project local settings, using user global/defaults`);
    }

    // Sync important settings to runtime environment
    this.syncToRuntimeEnvironment();
  }

  /**
   * Load user global settings from platform-specific location
   */
  private loadUserGlobalSettings(): Partial<UserPreferences> | null {
    try {
      if (fs.existsSync(this.userGlobalSettingsPath)) {
        const data = fs.readFileSync(this.userGlobalSettingsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logConsoleMessage(`[SETTINGS] Error loading user global: ${error}`);
    }
    return null;
  }

  /**
   * Load project local settings from project directory
   */
  private loadProjectLocalSettings(): Partial<UserPreferences> | null {
    try {
      if (fs.existsSync(this.projectLocalSettingsPath)) {
        const data = fs.readFileSync(this.projectLocalSettingsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logConsoleMessage(`[SETTINGS] Error loading project local: ${error}`);
    }
    return null;
  }

  /**
   * Get user global settings (non-cascaded, user file only)
   * Returns defaults merged with user settings, but NOT project overrides
   */
  public getUserGlobalSettings(): UserPreferences {
    const userOnlySettings: UserPreferences = this.getAppDefaults();
    const userGlobal = this.loadUserGlobalSettings();
    if (userGlobal) {
      this.deepMerge(userOnlySettings, userGlobal);
    }
    return userOnlySettings;
  }

  /**
   * Deep merge source into target, recursively
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          // Ensure target has this nested object
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          this.deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  /**
   * Sync preferences to runtime environment
   */
  private syncToRuntimeEnvironment(): void {
    if (this.preferences.serialPort && this.preferences.serialPort.resetOnConnection !== undefined) {
      this.runEnvironment.resetOnConnection = this.preferences.serialPort.resetOnConnection;
      this.logConsoleMessage(
        `[SETTINGS] Synced resetOnConnection to runtime: ${this.runEnvironment.resetOnConnection}`
      );
    } else {
      this.logConsoleMessage(
        `[SETTINGS] resetOnConnection not found in preferences, using default: ${this.runEnvironment.resetOnConnection}`
      );
    }
  }

  /**
   * Get app default settings (hardcoded defaults)
   */
  private getAppDefaults(): UserPreferences {
    return {
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
        resetOnConnection: true
      },
      debugLogger: {
        scrollbackLines: 1000
      }
    };
  }

  /**
   * Calculate delta between current settings and defaults
   */
  private calculateDelta(current: any, defaults: any): any {
    const delta: any = {};

    for (const key in current) {
      if (current.hasOwnProperty(key)) {
        const currentValue = current[key];
        const defaultValue = defaults[key];

        if (currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
          // Recursively calculate delta for nested objects
          const nestedDelta = this.calculateDelta(currentValue, defaultValue || {});
          if (Object.keys(nestedDelta).length > 0) {
            delta[key] = nestedDelta;
          }
        } else if (currentValue !== defaultValue) {
          // Value differs from default, include it
          delta[key] = currentValue;
        }
        // If equal to default, don't include it
      }
    }

    return delta;
  }

  /**
   * Save user global settings (only differences from app defaults)
   */
  public saveUserGlobalSettings(settings: UserPreferences): void {
    try {
      this.logConsoleMessage(`[SETTINGS] saveUserGlobalSettings called with:`, settings);

      const appDefaults = this.getAppDefaults();
      this.logConsoleMessage(`[SETTINGS] App defaults:`, appDefaults);

      const delta = this.calculateDelta(settings, appDefaults);
      this.logConsoleMessage(`[SETTINGS] Calculated delta:`, delta);

      // If no differences, don't create/keep the file
      if (Object.keys(delta).length === 0) {
        if (fs.existsSync(this.userGlobalSettingsPath)) {
          fs.unlinkSync(this.userGlobalSettingsPath);
          this.logConsoleMessage(`[SETTINGS] Removed user global (matches defaults)`);
        } else {
          this.logConsoleMessage(`[SETTINGS] No user global file to remove (all settings match defaults)`);
        }
        return;
      }

      const data = JSON.stringify(delta, null, 2);
      this.logConsoleMessage(`[SETTINGS] Writing to file: ${data}`);

      // Ensure directory exists (Windows only)
      const dir = path.dirname(this.userGlobalSettingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.userGlobalSettingsPath, data, 'utf8');
      this.logConsoleMessage(`[SETTINGS] Saved user global to ${this.userGlobalSettingsPath}`);
    } catch (error) {
      this.logConsoleMessage(`[SETTINGS] Error saving user global: ${error}`);
    }
  }

  /**
   * Save project local settings (differences from user global)
   */
  public saveProjectLocalSettings(settings: Partial<UserPreferences>): void {
    try {
      // Remove keys with null/undefined values (un-overridden settings)
      const cleanedSettings = this.removeNullValues(settings);

      if (Object.keys(cleanedSettings).length === 0) {
        // No overrides, delete the file if it exists
        if (fs.existsSync(this.projectLocalSettingsPath)) {
          fs.unlinkSync(this.projectLocalSettingsPath);
          this.logConsoleMessage(`[SETTINGS] Removed project local (no overrides)`);
        }
        return;
      }

      const data = JSON.stringify(cleanedSettings, null, 2);
      fs.writeFileSync(this.projectLocalSettingsPath, data, 'utf8');
      this.logConsoleMessage(`[SETTINGS] Saved project local to ${this.projectLocalSettingsPath}`);
    } catch (error) {
      this.logConsoleMessage(`[SETTINGS] Error saving project local: ${error}`);
    }
  }

  /**
   * Remove null/undefined values recursively (for delta-save)
   */
  private removeNullValues(obj: any): any {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (value === null || value === undefined) {
          continue; // Skip null/undefined
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
          const nested = this.removeNullValues(value);
          if (Object.keys(nested).length > 0) {
            cleaned[key] = nested;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  }

  /**
   * Reload hierarchical settings from disk (after project local file changed)
   */
  public reloadHierarchicalSettings(): void {
    // Reset to app defaults
    this.preferences = this.getAppDefaults();

    // Re-apply the cascade
    this.loadHierarchicalSettings();

    this.logConsoleMessage('[CONTEXT] Reloaded hierarchical settings');
  }

  /**
   * Update user preferences and notify components (legacy compatibility)
   */
  public updatePreferences(newPreferences: UserPreferences): void {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.syncToRuntimeEnvironment();
    this.logConsoleMessage('[CONTEXT] Preferences updated:', this.preferences);
    // Note: Caller should explicitly call saveUserGlobalSettings or saveProjectLocalSettings
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
