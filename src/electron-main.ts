#!/usr/bin/env electron
/**
 * Electron Entry Point for PNut-Term-TS
 *
 * This file receives PRE-VALIDATED parameters from pnut-term-ts.ts
 * All validation and error checking has already been done.
 * This file's job is simply to create the Electron UI with the given parameters.
 */

import { app, BrowserWindow } from 'electron';
import { MainWindow } from './classes/mainWindow';
import { Logger } from './classes/logger';
import { Context } from './utils/context';
import * as fs from 'fs';

// GC PROFILING: Enable GC monitoring to detect pauses that delay serial receives
if (global.gc) {
  const gcStats = { count: 0, totalTime: 0, maxPause: 0 };

  // Monitor GC via performance observer
  const { PerformanceObserver } = require('perf_hooks');
  const obs = new PerformanceObserver((list: any) => {
    const entries = list.getEntries();
    for (const entry of entries) {
      if (entry.entryType === 'gc') {
        gcStats.count++;
        gcStats.totalTime += entry.duration;
        if (entry.duration > gcStats.maxPause) {
          gcStats.maxPause = entry.duration;
        }

        // Warn if GC pause is significant (>10ms could delay serial)
        if (entry.duration > 10) {
          console.warn(`[GC PAUSE] 🔥 ${entry.kind} took ${entry.duration.toFixed(2)}ms - may delay serial receives!`);
        }
      }
    }
  });
  obs.observe({ entryTypes: ['gc'] });

  // Log summary every 30 seconds
  setInterval(() => {
    if (gcStats.count > 0) {
      console.log(`[GC STATS] Count: ${gcStats.count}, Total: ${gcStats.totalTime.toFixed(0)}ms, Max pause: ${gcStats.maxPause.toFixed(2)}ms`);
      gcStats.count = 0;
      gcStats.totalTime = 0;
      gcStats.maxPause = 0;
    }
  }, 30000);
} else {
  console.log('[GC MONITORING] Not enabled - run with --expose-gc to enable');
}

// Get the context file path from command line
const args = process.argv.slice(2);
const contextIndex = args.findIndex(arg => arg === '--context');
const contextFile = contextIndex !== -1 && args[contextIndex + 1] ? args[contextIndex + 1] : null;

if (!contextFile) {
    console.error('❌ No context file provided. This file should be launched by pnut-term-ts.');
    process.exit(1);
}

// Read the validated context from the JSON file
let contextData: any;
try {
    const contextJson = fs.readFileSync(contextFile, 'utf-8');
    contextData = JSON.parse(contextJson);
} catch (error) {
    console.error(`❌ Failed to read context file: ${contextFile}`, error);
    process.exit(1);
}

// Extract the validated configuration
const config = contextData.runEnvironment;

// Initialize logger with validated settings
const logger = new Logger();

// Recreate a context object for use in Electron process
// This is a separate instance from the CLI process
const electronContext = new Context();

// Populate the context with validated data from CLI
electronContext.runEnvironment.selectedPropPlug = config.selectedPropPlug || '';
electronContext.runEnvironment.debugBaudrate = config.debugBaudrate || 2000000;
electronContext.runEnvironment.developerModeEnabled = config.developerModeEnabled || false;
electronContext.runEnvironment.verbose = config.verbose || false;
electronContext.runEnvironment.ideMode = config.ideMode || false;
electronContext.runEnvironment.rtsOverride = config.rtsOverride || false;
electronContext.runEnvironment.quiet = config.quiet || false;
electronContext.runEnvironment.serialPortDevices = config.serialPortDevices || [];
electronContext.runEnvironment.usbTrafficLogging = config.usbTrafficLogging || false;
electronContext.runEnvironment.usbLogFilePath = config.usbLogFilePath;
electronContext.logger = logger;

// Store download file specs separately since they're not in RuntimeEnvironment
const ramFileSpec = config.ramFileSpec;
const flashFileSpec = config.flashFileSpec;

// Note: File existence is already checked in pnut-term-ts.ts before launching Electron

// Suppress DevTools Autofill errors that don't apply to Electron
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');
app.commandLine.appendSwitch('disable-blink-features', 'Autofill');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    logger.logMessage('Another instance is already running. Exiting.');
    app.quit();
} else {
    app.on('second-instance', () => {
        // If someone tried to run a second instance, focus our window instead
        const mainWindow = (global as any).mainWindowInstance;
        if (mainWindow) {
            const win = mainWindow.getWindow();
            if (win) {
                if (win.isMinimized()) win.restore();
                win.focus();
            }
        }
    });

    // App event handlers
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });

    // Signal handlers for external control when running in background
    // SIGUSR1 - Reset hardware via DTR/RTS
    process.on('SIGUSR1', () => {
        logger.logMessage('[SIGNAL] Received SIGUSR1 - Resetting hardware via DTR/RTS');
        const mainWindow = (global as any).mainWindowInstance;
        if (mainWindow) {
            mainWindow.resetHardware();
        } else {
            logger.errorMsg('[SIGNAL] Cannot reset - MainWindow not available');
        }
    });

    // SIGTERM - Graceful shutdown
    process.on('SIGTERM', () => {
        logger.logMessage('[SIGNAL] Received SIGTERM - Initiating graceful shutdown');
        const mainWindow = (global as any).mainWindowInstance;
        if (mainWindow) {
            mainWindow.gracefulShutdown();
        }
        // Give time for cleanup, then quit
        setTimeout(() => {
            app.quit();
        }, 1000);
    });

    // SIGINT - Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        logger.logMessage('[SIGNAL] Received SIGINT - Initiating graceful shutdown');
        const mainWindow = (global as any).mainWindowInstance;
        if (mainWindow) {
            mainWindow.gracefulShutdown();
        }
        setTimeout(() => {
            app.quit();
        }, 1000);
    });

    // Create main window when Electron is ready
    app.whenReady().then(() => {
        createMainWindow();
    });
}

async function createMainWindow() {
    try {
        // Pass the reconstructed context to MainWindow
        // This context was validated in the CLI process and passed via JSON
        const mainWindow = new MainWindow(electronContext);
        // Store globally for second-instance handling
        (global as any).mainWindowInstance = mainWindow;
        mainWindow.initialize();

        if (!electronContext.runEnvironment.quiet) {
            logger.logMessage('PNut-Term-TS Electron UI started');
            logger.logMessage(`Pre-validated configuration received from CLI`);
            if (electronContext.runEnvironment.selectedPropPlug) {
                logger.logMessage(`Connected to device: ${electronContext.runEnvironment.selectedPropPlug}`);
            }
        }

        // If we have a download file, initiate download
        if (ramFileSpec) {
            logger.logMessage(`Downloading to RAM: ${ramFileSpec}`);
            // Wait a moment for the window to be fully ready, then download
            setTimeout(async () => {
                try {
                    await mainWindow.downloadFileFromPath(ramFileSpec, false);
                } catch (error) {
                    logger.errorMsg(`Failed to download to RAM: ${error}`);
                }
            }, 2000);
        } else if (flashFileSpec) {
            logger.logMessage(`Downloading to FLASH: ${flashFileSpec}`);
            // Wait a moment for the window to be fully ready, then download
            setTimeout(async () => {
                try {
                    await mainWindow.downloadFileFromPath(flashFileSpec, true);
                } catch (error) {
                    logger.errorMsg(`Failed to download to FLASH: ${error}`);
                }
            }, 2000);
        }

    } catch (error) {
        logger.errorMsg(`Failed to create main window: ${error}`);
        app.quit();
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.errorMsg(`Uncaught exception: ${error}`);
    app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.errorMsg(`Unhandled rejection at: ${promise}, reason: ${reason}`);
});