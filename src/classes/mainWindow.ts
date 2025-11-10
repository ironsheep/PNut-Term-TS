/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
// src/classes/mainWindow.ts

// Import electron conditionally for standalone compatibility
let app: any, BrowserWindow: any, Menu: any, MenuItem: any, dialog: any, electron: any, ipcMain: any, nativeTheme: any;
// Only load Electron if we're actually in an Electron environment
if (process.versions && process.versions.electron) {
  try {
    const electronImport = eval("require('electron')");
    app = electronImport.app;
    BrowserWindow = electronImport.BrowserWindow;
    Menu = electronImport.Menu;
    MenuItem = electronImport.MenuItem;
    dialog = electronImport.dialog;
    electron = electronImport;
    ipcMain = electronImport.ipcMain;
    nativeTheme = electronImport.nativeTheme;
  } catch (error) {
    console.warn('Failed to load Electron in mainWindow.ts:', error);
  }
}
import { Context, FEATURE_FLAGS } from '../utils/context';
import { ensureDirExists, getFormattedDateTime } from '../utils/files';
import { UsbSerial } from '../utils/usb.serial';
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { DebugScopeWindow } from './debugScopeWin';
import { DebugScopeXyWindow } from './debugScopeXyWin';
import { DebugWindowBase } from './debugWindowBase';
import { PreferencesDialog } from './preferencesDialog';
import { PerformanceMonitor } from './performanceMonitor';
import { NewRecordingDialog } from './newRecordingDialog';
import { DocumentationViewer } from './documentationViewer';
import { BinaryPlayer } from './binaryPlayer';
import { DebugTermWindow } from './debugTermWin';
import { DebugPlotWindow } from './debugPlotWin';
import { DebugLogicWindow } from './debugLogicWin';
import { DebugBitmapWindow } from './debugBitmapWin';
import { DebugMidiWindow } from './debugMidiWin';
import { DebugFFTWindow } from './debugFftWin';
import { DebugSpectroWindow } from './debugSpectroWin';
import { LoggerWindow } from './loggerWin';
import { LoggerCOGWindow } from './loggerCOGWin';
import { DebugDebuggerWindow } from './debugDebuggerWin';
import { WindowRouter } from './shared/windowRouter';
import { SerialMessageProcessor } from './shared/serialMessageProcessor';
import { SharedMessageType, ExtractedMessage } from './shared/sharedMessagePool';
import { RouteDestination } from './shared/messageRouter';
import { COGWindowManager, COGDisplayMode } from './shared/cogWindowManager';
import { COGHistoryManager } from './shared/cogHistoryManager';
import { PlacementStrategy } from '../utils/windowPlacer';
import { COGLogExporter } from './shared/cogLogExporter';
import { Downloader } from './downloader';

export interface WindowCoordinates {
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;
}

export interface TerminalColor {
  xmitBGColor: string; // hex string '#RRGGBB'
  rcvBGColor: string;
  xmitFGColor: string;
  rcvFGColor: string;
}

export interface DeviceSettings {
  controlLine: 'DTR' | 'RTS';
  lastUsed: number; // timestamp
}

export interface GlobalSettings {
  defaultControlLine?: 'DTR' | 'RTS';
  deviceSettings?: { [deviceId: string]: DeviceSettings };
  devices?: any[]; // For compatibility with initialization
  selectedDeviceIndex?: number;
}

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

export class MainWindow {
  private context: Context;
  private _deviceNode: string = '';
  private _serialPort: UsbSerial | undefined = undefined;
  private _serialBaud: number = 0; // Will be set from context or preferences in constructor
  private mainWindow: any = null;
  private mainWindowOpen: boolean = false;
  private waitingForINIT: boolean = true;
  private windowRouter: WindowRouter;
  private dtrState: boolean = false;
  private rtsState: boolean = false;
  private preferencesDialog: PreferencesDialog | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private newRecordingDialog: NewRecordingDialog | null = null;
  private documentationViewer: DocumentationViewer | null = null;
  private binaryPlayer: BinaryPlayer | null = null;
  private controlLineMode: 'DTR' | 'RTS' = 'DTR'; // Default to DTR (Parallax standard)
  private downloadMode: 'ram' | 'flash' = 'ram'; // Default to RAM mode
  private activeCogs: Set<number> = new Set();
  private downloader: Downloader | undefined;
  private echoOffEnabled: boolean = false;
  private recentTransmitBuffer: string[] = [];
  private transmitTimestamp: number = 0;
  private txActivityTimer: NodeJS.Timeout | null = null;
  private rxActivityTimer: NodeJS.Timeout | null = null;
  private rxCharCounter: number = 0;
  private txCharCounter: number = 0;
  private mainWindowGeometry: WindowCoordinates = {
    xOffset: 0,
    yOffset: 0,
    width: 800,
    height: 600
  };
  private displays: { [key: string]: DebugWindowBase } = {};
  private debugLoggerWindow: LoggerWindow | null = null;
  private knownClosedBy: boolean = false; // compilicated determine if closed by app:quit or [x] close
  private immediateLog: boolean = true;
  private isShuttingDown: boolean = false; // Flag to prevent serial processing during shutdown
  private termColors: TerminalColor = {
    xmitBGColor: '#FFF8E7', // hex string '#RRGGBB' yellowish pastel
    rcvBGColor: '#8AB3E9', // cyan pastel
    xmitFGColor: '#000000', // black
    rcvFGColor: '#000000' // black
  };

  // Debugger message parsing and COG window management
  private serialProcessor: SerialMessageProcessor;
  private cogWindowManager: COGWindowManager;
  private cogHistoryManager: COGHistoryManager;
  private cogLogExporter: COGLogExporter;

  // Device settings storage
  private globalSettings: GlobalSettings;
  private settingsFilePath: string;

  // Performance monitoring for status bar
  private performanceUpdateTimer: NodeJS.Timeout | null = null;
  private readonly PERFORMANCE_UPDATE_INTERVAL = 100; // 10fps maximum
  private lastPerformanceState: 'normal' | 'warning' | 'critical' | 'error' = 'normal';
  private performanceFlashTimer: NodeJS.Timeout | null = null;

  constructor(ctx: Context) {
    this.context = ctx;
    this._deviceNode = this.context.runEnvironment.selectedPropPlug;

    // Initialize WindowRouter with context for proper directory handling
    this.windowRouter = WindowRouter.getInstance(this.context);
    this.windowRouter.setDisplaysMap(this.displays); // Give router access to displays map for routing
    this.windowRouter.setMainWindow(this); // Give router direct reference for PST terminal output
    if (this.context.runEnvironment.loggingEnabled) {
      this.context.logger.forceLogMessage('MainWindow started.');
    }

    // Initialize default settings immediately to prevent null reference crashes
    this.globalSettings = {
      devices: [],
      selectedDeviceIndex: 0
    };
    this.settingsFilePath = ''; // Will be set properly in loadSettings()

    // Initialize Two-Tier Pattern Matching serial processor and COG managers
    this.serialProcessor = new SerialMessageProcessor(true); // Enable performance logging
    this.cogWindowManager = new COGWindowManager();
    this.cogHistoryManager = new COGHistoryManager();
    this.cogLogExporter = new COGLogExporter();

    // Set up Two-Tier Pattern Matching event handlers
    this.logConsoleMessage('[TWO-TIER] 🔧 Setting up SerialProcessor event handlers...');
    this.setupSerialProcessorEvents();
    this.logConsoleMessage('[TWO-TIER] ✅ SerialProcessor event handlers setup complete');

    // Set up COG window creator
    this.cogWindowManager.setWindowCreator((cogId: number) => {
      return this.createCOGWindow(cogId);
    });

    // Listen for active COG changes to update status bar
    this.cogWindowManager.on(
      'activeCOGsChanged',
      (data: { cogId: number; activeCOGs: number[]; displayText: string }) => {
        this.logConsoleMessage(`[COG STATUS] COG ${data.cogId} became active, now active: ${data.displayText}`);
        this.updateActiveCogs(data.activeCOGs);
      }
    );

    // Listen for WindowRouter events
    this.setupWindowRouterEventListeners();

    // Initialize device settings using context startup directory
    this.settingsFilePath = path.join(this.context.currentFolder, 'pnut-term-settings.json');
    this.loadGlobalSettings();

    // Initialize serial baud rate from context or preferences
    this.initializeSerialBaud();

    /*
    let filesFound: string[] = listFiles("./");
    this.logMessage(
      `* MainWindow() - ./ ${filesFound.length} files found: [${filesFound}]`
    );
    filesFound = listFiles("./src");
    this.logMessage(
      `* MainWindow() - ./src ${filesFound.length} files found: [${filesFound}]`
    );
    */
  }

  /**
   * Controlled console logging for instance methods - only outputs when ENABLE_CONSOLE_LOG is true
   */
  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  /**
   * Setup event listeners for WindowRouter events
   */
  private setupWindowRouterEventListeners(): void {
    this.logConsoleMessage(`[WINDOW CREATION] 🎧 Setting up WindowRouter event listeners`);

    // Listen for windowNeeded events when WindowRouter can't route to existing window
    this.windowRouter.on('windowNeeded', (eventData: { type: string; command: string; error: string }) => {
      this.logConsoleMessage(`[WINDOW CREATION] 📨 Received windowNeeded event!`);
      this.logConsoleMessage(`[WINDOW CREATION] WindowRouter needs window of type: ${eventData.type}`);
      this.logConsoleMessage(`[WINDOW CREATION] Command: ${eventData.command}`);
      this.logConsoleMessage(`[WINDOW CREATION] Error: ${eventData.error}`);

      // Parse command to determine SharedMessageType
      const sharedType = this.parseBacktickCommandType(eventData.command);

      // Create ExtractedMessage for two-tier system compatibility
      const commandData = new TextEncoder().encode(eventData.command);
      const extractedMessage: ExtractedMessage = {
        type: sharedType,
        data: commandData,
        timestamp: Date.now(),
        confidence: 'VERY_DISTINCTIVE'
      };

      // Handle window creation through two-tier system
      this.handleWindowCommand(extractedMessage);
    });

    // Listen for P2 system reboot events (golden synchronization marker)
    this.windowRouter.on('p2SystemReboot', (eventData: { message: string; timestamp: number }) => {
      this.logConsoleMessage(`[P2 SYNC] 🎯 P2 SYSTEM REBOOT DETECTED!`);
      this.logConsoleMessage(`[P2 SYNC] Message: ${eventData.message}`);
      this.logConsoleMessage(`[P2 SYNC] Timestamp: ${new Date(eventData.timestamp).toISOString()}`);

      // Trigger complete synchronization reset
      this.handleP2SystemReboot(eventData);
    });

    this.logConsoleMessage(`[WINDOW CREATION] ✅ WindowRouter event listeners setup complete`);
  }

  /**
   * Setup event handlers for debugger message parser
   */
  private setupSerialProcessorEvents(): void {
    // CRITICAL: Import and setup debugger response handler
    const { DebuggerResponse } = require('./shared/debuggerResponse');
    const debuggerResponse = new DebuggerResponse();
    // Create routing destinations for Two-Tier Pattern Matching
    // ALL routing goes through WindowRouter - one class, one responsibility
    const debugLoggerDestination: RouteDestination = {
      name: 'DebugLogger',
      handler: (message: ExtractedMessage) => {
        // WindowRouter handles ALL window routing - pass ExtractedMessage directly
        this.windowRouter.routeMessage(message);
      }
    };

    const windowCreatorDestination: RouteDestination = {
      name: 'WindowCreator',
      handler: (message: ExtractedMessage) => {
        // Window creation is MainWindow's responsibility (not routing)
        this.handleWindowCommand(message);
      }
    };

    const debuggerWindowDestination: RouteDestination = {
      name: 'DebuggerWindow',
      handler: (message: ExtractedMessage) => {
        // WindowRouter handles ALL window routing - pass ExtractedMessage directly
        this.windowRouter.routeMessage(message);
      }
    };

    // NOTE: cogWindowRouterDestination removed - was causing duplicate routing to logger
    // Individual COG window routing (if needed) is handled by WindowRouter

    // Apply standard P2 routing configuration
    this.serialProcessor.applyStandardRouting(
      debugLoggerDestination,
      windowCreatorDestination,
      debuggerWindowDestination
    );

    // Listen for debugger packets to create/update debugger windows
    this.serialProcessor.on('debuggerPacketReceived', (packet: Uint8Array) => {
      // FEATURE FLAG: Skip debugger window creation if disabled (v0.9.x release)
      if (!FEATURE_FLAGS.ENABLE_DEBUGGER_WINDOWS) {
        this.logConsoleMessage(`[DEBUGGER] Debugger windows disabled - dropping 416-byte packet from COG${packet[0]}`);
        return; // Early exit - packet is dropped, nothing else happens
      }

      const cogId = packet[0];
      this.logConsoleMessage(`[DEBUGGER] Received 416-byte packet from COG${cogId}`);

      // Create debugger window directly like other debug windows (scope, plot, etc.)
      const windowName = `debugger-${cogId}`;
      // CASE-INSENSITIVE: Normalize for display lookup
      const normalizedName = windowName.toLowerCase();

      // Check if window already exists
      if (!this.displays[normalizedName]) {
        this.logConsoleMessage(`[DEBUGGER] Auto-creating debugger window for COG${cogId}`);
        const debuggerDisplay = new DebugDebuggerWindow(this.context, cogId);
        debuggerDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
        this.hookNotifcationsAndRememberWindow(windowName, debuggerDisplay);
        this.logConsoleMessage(`[DEBUGGER] Successfully created debugger window for COG${cogId}`);
      }

      // Send the packet to the window (whether new or existing)
      // Use updateContent() which handles queuing if window not ready
      const debuggerWindow = this.displays[normalizedName] as DebugDebuggerWindow;
      if (debuggerWindow) {
        this.logConsoleMessage(`[DEBUGGER] Sending 416-byte packet to debugger window for COG${cogId}`);
        debuggerWindow.updateContent(packet);
      }
    });

    // CRITICAL: Listen for P2 system reboot (golden sync marker)
    this.serialProcessor.on('p2SystemReboot', (eventData: { message: string; timestamp: number }) => {
      this.logConsoleMessage(`[P2 SYNC] 🎯 P2 SYSTEM REBOOT DETECTED from SerialProcessor!`);
      this.logConsoleMessage(`[P2 SYNC] Message: ${eventData.message}`);
      this.logConsoleMessage(`[P2 SYNC] Timestamp: ${new Date(eventData.timestamp).toISOString()}`);

      // Trigger complete synchronization reset
      this.handleP2SystemReboot(eventData);
    });

    // Reset debugger response state on DTR/RTS reset
    this.serialProcessor.on('dtrReset', () => {
      this.logConsoleMessage('[DEBUGGER RESPONSE] DTR reset detected, clearing response state');
      debuggerResponse.reset();
    });

    this.serialProcessor.on('rtsReset', () => {
      this.logConsoleMessage('[DEBUGGER RESPONSE] RTS reset detected, clearing response state');
      debuggerResponse.reset();
    });

    // Start the processor
    this.logConsoleMessage('[TWO-TIER] 🚀 Starting SerialMessageProcessor...');
    this.serialProcessor.start();
    this.logConsoleMessage('[TWO-TIER] ✅ SerialMessageProcessor started successfully');

    // Enable USB traffic logging if requested via CLI
    if (this.context.runEnvironment.usbTrafficLogging) {
      const components = this.serialProcessor.getComponents();
      if (components.workerExtractor) {
        // Create USB log path in Electron process (same as debug logger)
        const { getFormattedDateTime } = require('../utils/files');
        const path = require('path');
        const logsDir = this.context.getLogDirectory();
        const timestamp = getFormattedDateTime();
        const usbLogPath = path.join(logsDir, `usb-traffic_${timestamp}.log`);

        this.logConsoleMessage(`[USB LOGGING] Enabling USB traffic logging to ${usbLogPath}`);
        components.workerExtractor.enableUSBLogging(usbLogPath);
      }
    }

    // Performance monitoring will be started after DOM is ready (in did-finish-load handler)

    // Handle processor events
    this.serialProcessor.on('resetDetected', (event: any) => {
      this.logConsoleMessage(`[TWO-TIER] ${event.type} reset detected`);
    });

    this.serialProcessor.on('syncStatusChanged', (status: any) => {
      if (status.synchronized) {
        this.logConsoleMessage(`[TWO-TIER] ✅ Synchronized via ${status.source}`);
      } else {
        this.logConsoleMessage(`[TWO-TIER] ⚠️ Lost synchronization`);
      }
    });
  }

  /**
   * Tokenize a command string, preserving quoted strings
   * Handles both single and double quotes
   */
  private tokenizeCommand(command: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null; // null, '"', or "'"

    for (let i = 0; i < command.length; i++) {
      const ch = command[i];

      if (inQuote) {
        // Inside quoted string - add everything until closing quote
        current += ch;
        if (ch === inQuote) {
          inQuote = null;
        }
      } else {
        // Outside quoted string
        if (ch === '"' || ch === "'") {
          // Starting quoted string
          current += ch;
          inQuote = ch;
        } else if (ch === ',') {
          // Comma outside quotes - finish current token and add comma as separate token
          if (current.trim()) {
            tokens.push(current.trim());
            current = '';
          }
          tokens.push(',');
        } else if (ch === ' ' || ch === '\t') {
          // Whitespace outside quotes - finish current token
          if (current.trim()) {
            tokens.push(current.trim());
            current = '';
          }
        } else {
          current += ch;
        }
      }
    }

    // Add final token if any
    if (current.trim()) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  /**
   * Handle window command (backtick commands) - Two-Tier System
   * MIGRATED: Complete functionality from handleDebugCommand for performance
   */
  private handleWindowCommand(message: ExtractedMessage): void {
    // Valid display type keywords for window creation
    const VALID_DISPLAY_TYPES = ['SCOPE', 'SCOPE_XY', 'LOGIC', 'TERM', 'PLOT', 'BITMAP', 'MIDI', 'FFT', 'SPECTRO'];

    // Extract command data from two-tier message (stay in new system, don't convert back)
    const data = new TextDecoder().decode(message.data);

    // NOTE: Message is already logged via routeToDebugLogger (see applyStandardRouting line 504)
    // BACKTICK_WINDOW messages are routed to BOTH windowCreator AND debugLogger

    // Tokenize with proper quote handling (preserves 'Binary LEDS' as single token)
    const lineParts: string[] = this.tokenizeCommand(data);
    this.logConsoleMessage(
      `[TWO-TIER] handleWindowCommand() - [${data.trimEnd()}]: lineParts=[${lineParts.join(' | ')}](${
        lineParts.length
      })`
    );

    if (lineParts.length === 0 || lineParts[0].charAt(0) !== '`') {
      this.logConsoleMessage(`[TWO-TIER] Invalid window command format: ${data}`);
      return;
    }

    // Extract first token after backtick
    const firstToken = lineParts[0].substring(1).toUpperCase();

    // STEP 1: Check if this is a window creation command (display type keyword)
    // Only match exact display type (e.g., `bitmap MyBitmap), not window names ending with type (e.g., `MyBitmap)
    const isCreationCommand = VALID_DISPLAY_TYPES.some((type) => firstToken === type);

    if (isCreationCommand) {
      // This is a window CREATION command - proceed to creation logic below
      this.logConsoleMessage(`[TWO-TIER] Window creation command detected: ${firstToken}`);
      // Fall through to window creation logic below
    } else {
      // This is a window UPDATE command - route to WindowRouter for name-based routing
      this.logConsoleMessage(`[TWO-TIER] Window update command detected: ${firstToken}`);

      // Pass ExtractedMessage directly to WindowRouter (no conversion needed)
      this.windowRouter.routeMessage(message);

      // WindowRouter will:
      // - Decode Uint8Array to string
      // - Find window by name
      // - Route to window if exists
      // - Log error if window not found (ERROR on missing for updates)
      return;
    }

    // Window creation logic starts here (only reached if isCreationCommand = true)
    const possibleName: string = firstToken;
    let foundDisplay: boolean = false;

    // Infer window type from command
    let windowType = possibleName;

    // Check if it's already a window type or ends with a window type
    if (possibleName === 'LOGIC' || possibleName.endsWith('LOGIC')) {
      windowType = 'LOGIC';
    } else if (possibleName === 'TERM' || possibleName.endsWith('TERM')) {
      windowType = 'TERM';
    } else if (possibleName === 'SCOPE' || possibleName.endsWith('SCOPE')) {
      windowType = 'SCOPE';
    } else if (possibleName === 'SCOPE_XY' || possibleName.endsWith('SCOPE_XY')) {
      windowType = 'SCOPE_XY';
    } else if (possibleName === 'PLOT' || possibleName.endsWith('PLOT')) {
      windowType = 'PLOT';
    } else if (possibleName === 'BITMAP' || possibleName.endsWith('BITMAP')) {
      windowType = 'BITMAP';
    } else if (possibleName === 'MIDI' || possibleName.endsWith('MIDI')) {
      windowType = 'MIDI';
    } else if (possibleName === 'FFT' || possibleName.endsWith('FFT')) {
      windowType = 'FFT';
    }

    this.logConsoleMessage(`[TWO-TIER] Window creation - possibleName=[${possibleName}], windowType=[${windowType}]`);

    // Create new window based on type
    switch (windowType) {
      case this.DISPLAY_SCOPE: {
        this.logConsoleMessage(`[TWO-TIER] Creating SCOPE window for: ${data}`);
        const [isValid, scopeSpec] = DebugScopeWindow.parseScopeDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] SCOPE parse result: isValid=${isValid}`);
        if (isValid) {
          const scopeDisplay = new DebugScopeWindow(this.context, scopeSpec);
          scopeDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(scopeSpec.displayName, scopeDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ SCOPE window '${scopeSpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse SCOPE command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      case this.DISPLAY_SCOPEXY: {
        this.logConsoleMessage(`[TWO-TIER] Creating SCOPEXY window for: ${data}`);
        const [isValid, scopeXySpec] = DebugScopeXyWindow.parseScopeXyDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] SCOPEXY parse result: isValid=${isValid}`);
        if (isValid) {
          const scopeXyDisplay = new DebugScopeXyWindow(this.context, scopeXySpec);
          scopeXyDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(scopeXySpec.displayName, scopeXyDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ SCOPEXY window '${scopeXySpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse SCOPEXY command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      case this.DISPLAY_FFT: {
        this.logConsoleMessage(`[TWO-TIER] Creating FFT window for: ${data}`);
        const [isValid, fftSpec] = DebugFFTWindow.parseFftDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] FFT parse result: isValid=${isValid}`);

        if (isValid) {
          const fftDisplay = new DebugFFTWindow(this.context, fftSpec);
          fftDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(fftSpec.displayName, fftDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ FFT window '${fftSpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse FFT command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      case this.DISPLAY_SPECTRO: {
        this.logConsoleMessage(`[TWO-TIER] Creating SPECTRO window for: ${data}`);
        const [isValid, spectroSpec] = DebugSpectroWindow.parseSpectroDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] SPECTRO parse result: isValid=${isValid}`);

        if (isValid) {
          const spectroDisplay = new DebugSpectroWindow(this.context, spectroSpec);
          spectroDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(spectroSpec.displayName, spectroDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ SPECTRO window '${spectroSpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse SPECTRO command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      case this.DISPLAY_LOGIC: {
        this.logConsoleMessage(`[TWO-TIER] Creating LOGIC window for: ${data}`);
        const [isValid, logicSpec] = DebugLogicWindow.parseLogicDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] LOGIC parse result: isValid=${isValid}`);
        if (logicSpec) {
          this.logConsoleMessage(`[TWO-TIER] LogicSpec:`, JSON.stringify(logicSpec, null, 2));
        }

        if (isValid) {
          this.logConsoleMessage(`[TWO-TIER] Creating DebugLogicWindow instance...`);
          const logicDisplay = new DebugLogicWindow(this.context, logicSpec);
          logicDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(logicSpec.displayName, logicDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ LOGIC window '${logicSpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse LOGIC command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      case this.DISPLAY_TERM: {
        this.logConsoleMessage(`[TWO-TIER] Creating TERM window for: ${data}`);
        const [isValid, termSpec] = DebugTermWindow.parseTermDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] TERM parse result: isValid=${isValid}, termSpec=`, termSpec);

        if (isValid) {
          this.logConsoleMessage(`[TWO-TIER] Creating DebugTermWindow with spec:`, termSpec);
          const termDisplay = new DebugTermWindow(this.context, termSpec);
          termDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(termSpec.displayName, termDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ TERM window '${termSpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse TERM command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      case this.DISPLAY_PLOT: {
        this.logConsoleMessage(`[TWO-TIER] Creating PLOT window for: ${data}`);
        const [isValid, plotSpec] = DebugPlotWindow.parsePlotDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] PLOT parse result: isValid=${isValid}`);

        if (isValid) {
          const plotDisplay = new DebugPlotWindow(this.context, plotSpec);
          plotDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(plotSpec.displayName, plotDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ PLOT window '${plotSpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse PLOT command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      case this.DISPLAY_BITMAP: {
        this.logConsoleMessage(`[TWO-TIER] Creating BITMAP window for: ${data}`);
        const [isValid, bitmapSpec] = DebugBitmapWindow.parseBitmapDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] BITMAP parse result: isValid=${isValid}`);

        if (isValid) {
          const bitmapDisplay = new DebugBitmapWindow(this.context, bitmapSpec);
          bitmapDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(bitmapSpec.displayName, bitmapDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ BITMAP window '${bitmapSpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse BITMAP command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      case this.DISPLAY_MIDI: {
        this.logConsoleMessage(`[TWO-TIER] Creating MIDI window for: ${data}`);
        const [isValid, midiSpec] = DebugMidiWindow.parseMidiDeclaration(lineParts);
        this.logConsoleMessage(`[TWO-TIER] MIDI parse result: isValid=${isValid}`);

        if (isValid) {
          const midiDisplay = new DebugMidiWindow(this.context, midiSpec);
          midiDisplay.setSerialTransmissionCallback(this.sendSerialData.bind(this));
          this.hookNotifcationsAndRememberWindow(midiSpec.displayName, midiDisplay);
          foundDisplay = true;
          this.logConsoleMessage(`[TWO-TIER] ✅ MIDI window '${midiSpec.displayName}' created successfully`);
        } else {
          this.logConsoleMessage(`[TWO-TIER] ❌ Failed to parse MIDI command: ${data}`);
          if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage(`BAD DISPLAY: Received: ${data}`);
          }
        }
        break;
      }

      default:
        this.logConsoleMessage(`[TWO-TIER] ERROR: Unsupported window type [${windowType}] in command: ${data}`);
        this.logMessage(`ERROR: display [${windowType}] not supported!`);
        break;
    }

    // 4. FOURTH: Update logging behavior if window was found/created
    if (foundDisplay) {
      this.immediateLog = false; // Switch from immediate to buffered logging

      // Route creation command to WindowRouter for logging
      // WindowRouter will decode ExtractedMessage and log to DebugLogger
      this.windowRouter.routeMessage(message);
    }

    // 5. FIFTH: Log unhandled commands
    if (!foundDisplay && this.mainWindow != null) {
      this.logConsoleMessage(`[TWO-TIER] UNHANDLED window command: ${data}`);
      if (this.context.runEnvironment.loggingEnabled) {
        this.logMessage(`* Received: ${data} - UNHANDLED  lineParts=[${lineParts.join(',')}]`);
      }
    }
  }

  /**
   * Parse backtick command to determine SharedMessageType
   */
  private parseBacktickCommandType(command: string): SharedMessageType {
    // Extract first token after backtick
    const trimmed = command.trim();
    if (!trimmed.startsWith('`')) {
      return SharedMessageType.BACKTICK_UPDATE; // Default for malformed commands
    }

    const firstToken = trimmed.substring(1).split(/\s+/)[0].toUpperCase();

    // Map backtick command to SharedMessageType
    switch (firstToken) {
      case 'LOGIC':
        return SharedMessageType.BACKTICK_LOGIC;
      case 'SCOPE':
        return SharedMessageType.BACKTICK_SCOPE;
      case 'SCOPE_XY':
        return SharedMessageType.BACKTICK_SCOPE_XY;
      case 'FFT':
        return SharedMessageType.BACKTICK_FFT;
      case 'SPECTRO':
        return SharedMessageType.BACKTICK_SPECTRO;
      case 'PLOT':
        return SharedMessageType.BACKTICK_PLOT;
      case 'TERM':
        return SharedMessageType.BACKTICK_TERM;
      case 'BITMAP':
        return SharedMessageType.BACKTICK_BITMAP;
      case 'MIDI':
        return SharedMessageType.BACKTICK_MIDI;
      default:
        // Window name (update command) or unknown - use UPDATE type
        return SharedMessageType.BACKTICK_UPDATE;
    }
  }

  /**
   * Create a COG splitter window
   */
  private createCOGWindow(cogId: number): any {
    this.logConsoleMessage(`[COG WINDOW] Creating COG ${cogId} window`);

    // Generate window ID for tracking
    const windowId = `COG-${cogId}`;

    // Create COG window using the refactored class
    const cogWindow = new LoggerCOGWindow(cogId, {
      context: this.context,
      windowId: windowId
    });

    // Apply current theme to newly created COG window
    if (this.context.preferences?.terminal?.colorTheme) {
      const themeValue = this.context.preferences.terminal.colorTheme;
      this.logConsoleMessage(`[THEME] Applying theme to COG${cogId}: ${themeValue}`);
      let colorName: 'green' | 'amber' = 'green';
      if (themeValue.includes('amber')) {
        colorName = 'amber';
      } else if (themeValue.includes('green')) {
        colorName = 'green';
      }
      this.logConsoleMessage(`[THEME] Parsed color name for COG${cogId}: ${colorName}`);
      cogWindow.setTheme(colorName);
    } else {
      this.logConsoleMessage(`[THEME] No theme preference found for COG${cogId}, using default green`);
    }

    // Register with WindowRouter for message routing
    this.windowRouter.registerWindow(`COG${cogId}`, `COG${cogId}`, (message: any) => {
      // Router sends ExtractedMessage with data (Uint8Array), timestamp, and messageType
      // Decode the Uint8Array to string for text messages
      if (message.data && message.data instanceof Uint8Array) {
        const text = new TextDecoder().decode(message.data);
        cogWindow.processMessage(text, message.timestamp);
      } else if (typeof message === 'string') {
        // Fallback for direct string messages
        cogWindow.processMessage(message);
      }
    });

    // Track in displays
    this.displays[windowId] = cogWindow;

    // Update UI with active COGs when window opens
    const activeCogs = this.cogWindowManager.getActiveCOGs();
    this.updateActiveCogs(activeCogs);

    // Listen for close event
    cogWindow.on('closed', (closedCogId: number) => {
      this.logConsoleMessage(`[COG WINDOW] COG ${closedCogId} window closed`);
      this.cogWindowManager.onWindowClosed(closedCogId);
      delete this.displays[`COG-${closedCogId}`];
      this.windowRouter.unregisterWindow(`COG${closedCogId}`);

      // Update UI with active COGs
      const activeCogs = this.cogWindowManager.getActiveCOGs();
      this.updateActiveCogs(activeCogs);

      // Check if all COG windows are closed and update Debug Logger button
      let anyCOGsOpen = false;
      for (let i = 0; i < 8; i++) {
        if (this.displays[`COG-${i}`]) {
          anyCOGsOpen = true;
          break;
        }
      }

      // Update Debug Logger button state if all COGs are closed
      if (!anyCOGsOpen && this.debugLoggerWindow) {
        this.debugLoggerWindow.updateCOGsState(false);
      }
    });

    // Get the actual Electron BrowserWindow
    const electronWindow = cogWindow.getWindow();

    return electronWindow;
  }

  /**
   * Handle Show All COGs button click from Debug Logger window
   */
  public handleShowAllCOGs(): void {
    this.logConsoleMessage('[COG MANAGER] Show All COGs requested');

    // Send comment line to debug logger indicating windows are being opened
    if (this.debugLoggerWindow) {
      this.debugLoggerWindow.logSystemMessage(
        '=== Opening all 8 COG windows - messages after this will route to COG displays ==='
      );
    }

    // Temporarily switch to SHOW_ALL mode to display all COGs
    this.cogWindowManager.setMode(COGDisplayMode.SHOW_ALL);
    this.cogWindowManager.showAllCOGs();

    // Update Debug Logger button state
    if (this.debugLoggerWindow) {
      this.debugLoggerWindow.updateCOGsState(true);
    }
  }

  /**
   * Handle Hide All COGs button click from Debug Logger window
   */
  public handleHideAllCOGs(): void {
    this.logConsoleMessage('[COG MANAGER] Hide All COGs requested');

    // Send comment line to debug logger indicating windows are being hidden
    if (this.debugLoggerWindow) {
      this.debugLoggerWindow.logSystemMessage(
        '=== Hiding all 8 COG windows - messages will no longer route to COG displays ==='
      );
    }

    // Set mode to OFF to prevent any window recreation during closing
    this.cogWindowManager.setMode(COGDisplayMode.OFF);

    // Close all COG windows first
    for (let cogId = 0; cogId < 8; cogId++) {
      const windowKey = `COG-${cogId}`;
      const cogWindow = this.displays[windowKey];

      if (cogWindow && cogWindow instanceof LoggerCOGWindow) {
        cogWindow.close();
        delete this.displays[windowKey];
        // Don't manually unregister - the window will unregister itself when closed
        // this.windowRouter.unregisterWindow(`COG${cogId}`);
      }
    }

    // CRITICAL: Reset COG manager AFTER closing windows to clear all state cleanly
    // NOTE: This causes show/hide to work every OTHER time (not ideal, but better than never)
    // Root cause unknown - needs investigation into cogWindowManager.showAllCOGs() logic
    // Without reset(): show NEVER works after first hide
    // With reset(): show works every other time (acceptable workaround for now)
    this.cogWindowManager.reset();

    // Update Debug Logger button state
    if (this.debugLoggerWindow) {
      this.debugLoggerWindow.updateCOGsState(false);
    }

    // Update UI with active COGs (should be none)
    const activeCogs = this.cogWindowManager.getActiveCOGs();
    this.updateActiveCogs(activeCogs);
  }

  /**
   * Export all COG logs to individual files
   */
  private exportCOGLogs(): void {
    this.logConsoleMessage('[COG EXPORT] Starting COG log export...');

    const fs = require('fs');
    const path = require('path');
    const { getFormattedDateTime } = require('../utils/files');
    const { dialog } = require('electron');

    try {
      // Get logs directory and debug logger filename base
      const logsDir = this.context.getLogDirectory();

      // Get current debug logger filename to match naming pattern
      let debugLogBaseName = 'debug_log';
      if (this.debugLoggerWindow && this.debugLoggerWindow.getLogFilePath()) {
        const debugLogPath = this.debugLoggerWindow.getLogFilePath();
        const debugLogFile = path.basename(debugLogPath, '.log'); // Remove .log extension
        debugLogBaseName = debugLogFile;
      } else {
        // If no active debug log, create new basename with timestamp
        const timestamp = getFormattedDateTime();
        debugLogBaseName = `debug_log_${timestamp}`;
      }

      let exportedCount = 0;
      const exportedFiles: string[] = [];

      // Export each COG window's log
      for (let cogId = 0; cogId < 8; cogId++) {
        const windowKey = `COG-${cogId}`;
        const cogWindow = this.displays[windowKey] as unknown as LoggerCOGWindow;

        if (cogWindow && cogWindow instanceof LoggerCOGWindow) {
          const stats = cogWindow.getStatistics();

          // Only export if window has messages
          if (stats.messageCount > 0) {
            // Use debug log basename + _cogN.log
            const logFileName = `${debugLogBaseName}_cog${cogId}.log`;
            const logFilePath = path.join(logsDir, logFileName);

            // Get history buffer from window (need to add getter method)
            const logContent = cogWindow.getHistoryBuffer().join('\n');

            // Write log file
            fs.writeFileSync(logFilePath, logContent, 'utf8');
            exportedFiles.push(logFileName);
            exportedCount++;

            this.logConsoleMessage(`[COG EXPORT] Exported COG ${cogId} log to ${logFileName}`);
          }
        }
      }

      // Show confirmation dialog
      if (exportedCount > 0) {
        const message = `Exported ${exportedCount} COG log file(s) to:\n${logsDir}\n\nFiles:\n${exportedFiles.join(
          '\n'
        )}`;

        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'COG Logs Exported',
          message: message,
          buttons: ['OK']
        });

        this.logConsoleMessage(`[COG EXPORT] Successfully exported ${exportedCount} COG logs`);
      } else {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'No COG Logs to Export',
          message: 'No COG windows have received messages yet.',
          buttons: ['OK']
        });

        this.logConsoleMessage('[COG EXPORT] No COG logs to export (no messages received)');
      }
    } catch (error) {
      this.logConsoleMessage(`[COG EXPORT] Error exporting COG logs: ${error}`);

      dialog.showMessageBox(this.mainWindow, {
        type: 'error',
        title: 'Export Failed',
        message: `Failed to export COG logs:\n${error}`,
        buttons: ['OK']
      });
    }
  }

  /**
   * Handle COG export request
   */
  private handleCOGExportRequest(cogId: number): void {
    this.logConsoleMessage(`[COG EXPORT] Export requested for COG ${cogId}`);

    // Get the COG window
    const windowKey = `COG-${cogId}`;
    const cogWindow = this.displays[windowKey] as unknown as LoggerCOGWindow;

    if (cogWindow) {
      // Export is now handled internally by the COG window
      // It will show a save dialog and handle the file writing
      this.logConsoleMessage(`[COG EXPORT] COG ${cogId} handling export internally`);
    }
  }

  /**
   * Route binary data to debug logger with type information
   */
  private routeBinaryToDebugLogger(data: Uint8Array, binaryType: 'debugger' | 'p2_raw'): void {
    if (!this.debugLoggerWindow) {
      // Auto-create debug logger if needed
      try {
        this.debugLoggerWindow = LoggerWindow.getInstance(this.context);
        this.displays['DebugLogger'] = this.debugLoggerWindow; // Store with original case

        // Apply current theme from preferences
        if (this.context.preferences?.terminal?.colorTheme) {
          const themeValue = this.context.preferences.terminal.colorTheme;
          this.logConsoleMessage(`[THEME] Applying theme to debug logger: ${themeValue}`);
          let colorName: 'green' | 'amber' = 'green';
          if (themeValue.includes('amber')) {
            colorName = 'amber';
          } else if (themeValue.includes('green')) {
            colorName = 'green';
          }
          this.logConsoleMessage(`[THEME] Parsed color name: ${colorName}`);
          this.debugLoggerWindow.setTheme(colorName);
        } else {
          this.logConsoleMessage('[THEME] No theme preference found, using default green');
        }

        // Register with WindowRouter for message routing
        this.windowRouter.registerWindow(
          'logger',
          'logger',
          this.debugLoggerWindow.handleRouterMessage.bind(this.debugLoggerWindow)
        );

        this.debugLoggerWindow.on('close', () => {
          this.windowRouter.unregisterWindow('logger');
          delete this.displays['DebugLogger']; // Use original case
          this.debugLoggerWindow = null;
        });

        // Connect performance monitor for warnings
        const components = this.serialProcessor.getComponents();
        if (components.performanceMonitor) {
          this.debugLoggerWindow.setPerformanceMonitor(components.performanceMonitor);
        }
      } catch (error) {
        console.error('[DEBUG LOGGER] Failed to create:', error);
        return;
      }
    }

    // Send binary data to logger with type flag
    if (this.debugLoggerWindow) {
      // Format based on type
      let formattedMessage: string;
      if (binaryType === 'debugger') {
        // Use 32-byte/line format for debugger packets
        formattedMessage = this.formatDebuggerBinary(data);
      } else {
        // Use 16-byte/line format with ASCII for raw P2 data
        formattedMessage = this.formatRawBinary(data);
      }
      this.debugLoggerWindow.logSerialMessage(formattedMessage);
    }
  }

  /**
   * Format debugger binary packets (80-byte format)
   */
  private formatDebuggerBinary(data: Uint8Array): string {
    const lines: string[] = [];
    // Extract COG ID using proper 32-bit little-endian for 80-byte packets
    let cogId = -1;
    if (data.length === 80) {
      cogId = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24); // Little-endian 32-bit
    }
    const prefix = cogId >= 0 && cogId <= 7 ? `Cog ${cogId} ` : '';
    const indent = ' '.repeat(prefix.length);

    for (let offset = 0; offset < data.length; offset += 32) {
      const lineBytes = Math.min(32, data.length - offset);
      const hexOffset = `0x${offset.toString(16).padStart(2, '0').toUpperCase()}:`;
      const linePrefix = offset === 0 ? prefix : indent;
      let hexLine = `${linePrefix}${hexOffset} `;

      for (let i = 0; i < lineBytes; i++) {
        const byte = data[offset + i];
        hexLine += `$${byte.toString(16).padStart(2, '0').toUpperCase()}`;

        if ((i + 1) % 16 === 0 && i < lineBytes - 1) {
          hexLine += '  '; // Double space at 16-byte boundary
        } else if ((i + 1) % 8 === 0 && i < lineBytes - 1) {
          hexLine += '  '; // Double space at 8-byte boundary
        } else if (i < lineBytes - 1) {
          hexLine += ' '; // Single space between bytes
        }
      }
      lines.push(hexLine);
    }
    return lines.join('\n');
  }

  /**
   * Format raw P2 binary data (16-byte/line with ASCII)
   */
  private formatRawBinary(data: Uint8Array): string {
    const lines: string[] = [];
    lines.push(`[P2 Binary Data - ${data.length} bytes]`);

    for (let offset = 0; offset < data.length; offset += 16) {
      const lineBytes = Math.min(16, data.length - offset);
      let hexPart = `${offset.toString(16).padStart(4, '0')}: `;
      let asciiPart = '';

      // Hex columns
      for (let i = 0; i < 16; i++) {
        if (i < lineBytes) {
          const byte = data[offset + i];
          hexPart += `$${byte.toString(16).padStart(2, '0').toUpperCase()} `;
          // ASCII representation
          asciiPart += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
        } else {
          hexPart += '    '; // Placeholder for missing bytes
        }

        // Add double space between 8-byte groups
        if (i === 7) {
          hexPart += ' ';
        }
      }

      lines.push(hexPart + '  ' + asciiPart);
    }
    return lines.join('\n');
  }

  public initialize() {
    if (ENABLE_CONSOLE_LOG) this.context.logger.forceLogMessage('* initialize()');
    this.logConsoleMessage('[STARTUP] MainWindow.initialize() called');
    // app.on('ready', this.createAppWindow);
    // CRITICAL FIX: Don't open serial port until DOM is ready!
    // Store the device node to open later
    if (this._deviceNode.length > 0) {
      this.logMessage(`* Device specified: ${this._deviceNode} - will connect after window loads`);
      this.logConsoleMessage(`[STARTUP] Device specified: ${this._deviceNode}`);
    } else {
      this.logMessage('* No device specified - will check available devices when window loads');
      this.logConsoleMessage('[STARTUP] No device specified');
    }
    if (app && app.whenReady) {
      this.logConsoleMessage('[STARTUP] Electron app object found, calling whenReady()');
      app
        .whenReady()
        .then(() => {
          this.logMessage('* [whenReady]');
          this.logConsoleMessage('[STARTUP] Electron app is ready, creating window');

          // Force light mode for native dialogs and UI elements
          if (nativeTheme) {
            nativeTheme.themeSource = 'light';
            this.logConsoleMessage('[STARTUP] Native theme set to light mode');
          }

          // Query and log complete display system configuration
          this.logDisplaySystemConfiguration();

          this.createAppWindow();
        })
        .catch((error: any) => {
          console.error('[STARTUP] Error in app.whenReady():', error);
        });
    } else {
      // Running in CLI mode without Electron
      this.logConsoleMessage('[STARTUP] Running in CLI mode - no GUI windows available (app object not found)');
    }

    if (app) {
      app.on('window-all-closed', async () => {
        // Shutdown flags and listener removal already done in mainWindow 'close' event
        // This makes the app behave like a single-window application
        this.logConsoleMessage(
          `[SHUTDOWN ${new Date().toISOString()}] All windows closed, initiating shutdown sequence`
        );

        // STEP 3: Close all debug windows (clean up references)
        this.closeAllDebugWindows();

        // STEP 3.5: Clear LED activity timers to prevent firing after window destruction
        if (this.txActivityTimer) {
          clearTimeout(this.txActivityTimer);
          this.txActivityTimer = null;
        }
        if (this.rxActivityTimer) {
          clearTimeout(this.rxActivityTimer);
          this.rxActivityTimer = null;
        }

        // STEP 4: Close serial port properly to prevent Napi::Error on shutdown
        if (this._serialPort) {
          this.logConsoleMessage(`[SHUTDOWN ${new Date().toISOString()}] Closing serial port before app exit`);
          try {
            // CRITICAL: Set shutdown flag to stop processing incoming data
            this._serialPort.setShuttingDown(true);
            // CRITICAL: Properly await async close() to ensure clean shutdown
            await this._serialPort.close();
            this.logConsoleMessage(`[SHUTDOWN ${new Date().toISOString()}] Serial port closed successfully`);
          } catch (error) {
            this.logConsoleMessage(
              `[SHUTDOWN ${new Date().toISOString()}] Serial port close error (non-fatal): ${error}`
            );
          }
          this._serialPort = undefined; // Release reference
        }

        // STEP 5: Quit app
        this.logConsoleMessage(`[SHUTDOWN ${new Date().toISOString()}] Quitting app`);
        app.quit();
        this.mainWindowOpen = false;
      });
    }

    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.logMessage('* [activate]');
        this.createAppWindow();
      }
    });
  }

  public isDone(): boolean {
    // return T/F where T means are window is closed or closing
    return this.mainWindowOpen == true ? false : true;
  }

  private getParallaxFontUrl(): string {
    // Use file:// URLs directly - base64 makes the HTML too large
    const resourcesPath = process.resourcesPath;
    let fontPath: string;

    if (resourcesPath) {
      // Packaged app: fonts are directly in Resources/fonts (NOT Resources/app/fonts)
      fontPath = path.join(resourcesPath, 'fonts', 'Parallax.ttf');
    } else {
      // Development: fonts are in the fonts directory
      fontPath = path.join(__dirname, '../../fonts', 'Parallax.ttf');
    }

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(fontPath)) {
      console.error('[FONT] Parallax font not found at:', fontPath);
      // Try alternate paths
      const alternatePaths = [
        path.join(resourcesPath || __dirname, 'app', 'fonts', 'Parallax.ttf'),
        path.join(__dirname, '../../../fonts', 'Parallax.ttf'),
        path.join(__dirname, '../../../src/assets/fonts', 'Parallax.ttf')
      ];

      for (const altPath of alternatePaths) {
        if (fs.existsSync(altPath)) {
          fontPath = altPath;
          this.logConsoleMessage('[FONT] Found font at alternate path:', fontPath);
          break;
        }
      }
    }

    const fileUrl = `file://${fontPath.replace(/\\/g, '/')}`;
    this.logConsoleMessage('[FONT] Using Parallax font URL:', fileUrl);
    return fileUrl;
  }

  private getIBM3270FontUrl(): string {
    // Use file:// URLs directly - base64 makes the HTML too large
    const resourcesPath = process.resourcesPath;
    let fontPath: string;

    if (resourcesPath) {
      // Packaged app: fonts are directly in Resources/fonts (NOT Resources/app/fonts)
      fontPath = path.join(resourcesPath, 'fonts', '3270-Regular.ttf');
    } else {
      // Development: fonts are in the fonts directory
      fontPath = path.join(__dirname, '../../fonts', '3270-Regular.ttf');
    }

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(fontPath)) {
      console.error('[FONT] IBM 3270 font not found at:', fontPath);
      // Try alternate paths
      const alternatePaths = [
        path.join(resourcesPath || __dirname, 'app', 'fonts', '3270-Regular.ttf'),
        path.join(__dirname, '../../../fonts', '3270-Regular.ttf'),
        path.join(__dirname, '../../../src/assets/fonts', '3270-Regular.ttf')
      ];

      for (const altPath of alternatePaths) {
        if (fs.existsSync(altPath)) {
          fontPath = altPath;
          this.logConsoleMessage('[FONT] Found font at alternate path:', fontPath);
          break;
        }
      }
    }

    const fileUrl = `file://${fontPath.replace(/\\/g, '/')}`;
    this.logConsoleMessage('[FONT] Using IBM 3270 font URL:', fileUrl);
    return fileUrl;
  }

  public async close(): Promise<void> {
    // Remove all listeners to prevent memory leaks and allow port to be reused
    this.logMessage('* close()');
    if (this._serialPort !== undefined) {
      this._serialPort.removeAllListeners();
      await this._serialPort.close();
      this._serialPort = undefined;
    }
  }

  // ----------------------------------------------------------------------
  // this is our serial transmitter!!
  //
  public sendSerialData(data: string | Buffer): void {
    if (this._serialPort !== undefined) {
      // Convert Buffer to string once (if needed) for all downstream uses
      // Use latin1 encoding to preserve binary bytes (1:1 byte mapping)
      const dataString = Buffer.isBuffer(data) ? data.toString('latin1') : data;

      // Log transmitted data to USB traffic log if enabled
      const components = this.serialProcessor.getComponents();
      if (components.workerExtractor) {
        components.workerExtractor.logTxData(dataString);
      }

      // Write to serial port - accepts both string and Buffer
      this._serialPort.write(data);

      // Store transmitted characters for echo filtering
      if (this.echoOffEnabled) {
        this.recentTransmitBuffer = dataString.split('');
        this.transmitTimestamp = Date.now();
      }

      // TX activity indicator - blink every 50 chars or first char
      this.txCharCounter += dataString.length;
      if (this.txCharCounter >= 50 || !this.txActivityTimer) {
        this.blinkActivityLED('tx');
        this.txCharCounter = 0;
      }
    }
  }
  // ----------------------------------------------------------------------
  // this is our serial receiver!!
  //
  private async openSerialPort(deviceNode: string) {
    UsbSerial.setCommBaudRate(this._serialBaud);
    this.logMessage(`* openSerialPort() - ${deviceNode}`);

    // Log baud rate and its source
    const source = this.context.runEnvironment.debugBaudRateFromCLI ? 'command-line' : 'preferences/default';
    this.logConsoleMessage(`[BAUD RATE] Setting debug baud rate to ${this._serialBaud} (from ${source})`);
    if (this.debugLoggerWindow) {
      this.debugLoggerWindow.logSystemMessage(`BAUD_RATE_SET ${this._serialBaud} baud (${source})`);
    }
    try {
      this._serialPort = new UsbSerial(this.context, deviceNode);
      // Wait for port to actually open before proceeding
      await this._serialPort.waitForPortOpen();
    } catch (error) {
      this.logMessage(`ERROR: openSerialPort() - ${deviceNode} failed to open. Error: ${error}`);
      // Notify user visually about connection failure
      this.appendLog(`⚠️ SERIAL PORT CONNECTION FAILED: ${deviceNode}`);
      this.appendLog(`   Error: ${error}`);
      this.appendLog(`   Possible causes:`);
      this.appendLog(`   • Device not plugged in`);
      this.appendLog(`   • USB hub disconnected (try unplug/replug hub)`);
      this.appendLog(`   • Device in use by another application`);
      this.appendLog(`   • Insufficient permissions`);
    }
    if (this._serialPort === undefined) {
      this.logMessage(`ERROR: openSerialPort() - ${deviceNode} failed to open`);
      this.updateConnectionStatus(false);
      this.updateStatusBarField('propPlug', `${deviceNode} (FAILED)`);
    }
    if (this._serialPort !== undefined) {
      this.logMessage(`* openSerialPort() - IS OPEN`);

      // Verify the port opened at the requested baud rate
      const actualBaud = this._serialPort.getCurrentBaudRate();
      this.logConsoleMessage(`[BAUD RATE] Port opened, actual baud rate: ${actualBaud}`);

      // Initialize DTR/RTS to known de-asserted state (HIGH) for hardware sync
      // This ensures our state variables match the actual hardware state
      try {
        await this._serialPort.setDTR(false); // false = HIGH/de-asserted
        await this._serialPort.setRTS(false); // false = HIGH/de-asserted

        // Keep our state variables in sync with what we just set
        this.dtrState = false;
        this.rtsState = false;

        this.logMessage(`* openSerialPort() - DTR/RTS initialized to de-asserted (HIGH)`);
        this.logMessage(`* openSerialPort() - DTR state: ${this.dtrState}, RTS state: ${this.rtsState}`);
      } catch (error) {
        this.logMessage(`* openSerialPort() - WARNING: Failed to initialize DTR/RTS: ${error}`);
        // Continue anyway - not critical for basic operation
      }

      this._serialPort.on('data', (data) => this.handleSerialRx(data));
      this.updateConnectionStatus(true);
      // Removed startup text - connection status now shown in status bar

      // Load device-specific control line preference
      this.controlLineMode = this.getDeviceControlLine();
      this.updateControlLineUI();
      this.logMessage(`🔧 Control line mode set to ${this.controlLineMode} for this device`);

      // Initialize downloader with serial port
      if (!this.downloader && this._serialPort) {
        this.downloader = new Downloader(this.context, this._serialPort);
        this.logMessage(`* openSerialPort() - Downloader initialized`);
      }
    }
  }

  // ASCII + CogN sync buffer for handling partial commands
  private syncBuffer: string = '';
  private lastSyncTime: number = 0;
  private readonly MAX_LINE_CHARS = 80; // Typical max line length
  private readonly DEFAULT_BAUD_RATE = 115200; // Default P2 baud rate

  /**
   * Calculate timeout based on baud rate - time to transmit MAX_LINE_CHARS
   */
  private calculateSyncTimeout(): number {
    // Get baud rate from UsbSerial static property
    const baudRate = UsbSerial.desiredCommsBaudRate || this.DEFAULT_BAUD_RATE;
    const bitsPerChar = 10; // Start bit + 8 data bits + stop bit
    const totalBits = this.MAX_LINE_CHARS * bitsPerChar;
    const timeoutMs = (totalBits / baudRate) * 1000;

    // Add 50% safety margin for processing delays
    const safetyMargin = timeoutMs * 0.5;
    const finalTimeout = Math.max(timeoutMs + safetyMargin, 10); // Minimum 10ms

    this.logConsoleMessage(
      `[SYNC TIMEOUT] Baud: ${baudRate}, Line: ${this.MAX_LINE_CHARS} chars, Timeout: ${finalTimeout.toFixed(1)}ms`
    );
    return finalTimeout;
  }

  private handleSerialRx(data: Buffer | string) {
    // GUARD: Ignore all serial data during shutdown
    if (this.isShuttingDown) {
      return; // Silently drop data - no logging to avoid spam
    }

    // Handle received data - can be Buffer (raw bytes) or string (from parser)

    // RX activity indicator - blink for ALL received data (binary or text)
    const dataLength = Buffer.isBuffer(data) ? data.length : data.length;
    this.rxCharCounter += dataLength;
    if (this.rxCharCounter >= 50 || !this.rxActivityTimer) {
      this.blinkActivityLED('rx');
      this.rxCharCounter = 0;
    }

    if (Buffer.isBuffer(data)) {
      // USB traffic logging deferred to MessageExtractor (via metadata queue)
      // Removed hot-path hex dump that was blocking serial receives

      // During download: give Downloader first chance to consume protocol messages
      if (this.downloader?.isDownloading()) {
        const result = this.downloader.handleProtocolData(data);
        if (result.consumed) {
          // Protocol message consumed by Downloader
          this.logConsoleMessage(`[DOWNLOAD] Protocol message consumed`);

          // If there's remaining data (checksum was concatenated with app output), route it
          if (result.remainingData) {
            this.logConsoleMessage(
              `[DOWNLOAD] Routing ${result.remainingData.length} bytes of app output that was concatenated with checksum`
            );
            this.serialProcessor.receiveData(result.remainingData);
          }
          return;
        }
        // Not a protocol message - log details for debugging
        const hex = Array.from(data.slice(0, Math.min(32, data.length)))
          .map((b) => '0x' + b.toString(16).padStart(2, '0'))
          .join(' ');
        // Use latin1 to preserve binary bytes for logging (1:1 byte mapping)
        const text = data.toString('latin1', 0, Math.min(32, data.length)).replace(/[\r\n]/g, '\\n');
        this.logConsoleMessage(`[DOWNLOAD] Non-protocol data: ${data.length} bytes, hex=[${hex}], text="${text}"`);
        this.logConsoleMessage(`[DOWNLOAD] Non-protocol data during download, dropping (${data.length} bytes)`);
        return; // Drop all non-protocol data during download
      }

      // Two-Tier Pattern Matching: Process serial data through new architecture
      this.serialProcessor.receiveData(data);
      return;
    }

    if (typeof data === 'string') {
      this.logConsoleMessage(`[SERIAL RX] Text data: ${data.length} chars: "${data}"`);

      // GROUND ZERO RECOVERY: Check for Cog-prefixed messages first (backward compatibility)
      if (data.startsWith('Cog')) {
        this.logConsoleMessage(
          `[DEBUG] Potential COG message found: "${data}", length: ${data.length}, char[3]: "${data[3]}", char[4]: "${data[4]}"`
        );
        if (data.length > 4 && data[4] === ' ') {
          this.logConsoleMessage(`[COG DETECTION] Found Cog message: ${data}`);
          this.handleCogMessage(data);
          return; // Don't process through new architecture for backward compatibility
        }
      }

      // Convert string to Buffer and process through Two-Tier Pattern Matching
      const buffer = Buffer.from(data);
      this.serialProcessor.receiveData(buffer);
      return;
    }
  }

  /**
   * Log binary data to debug logger with appropriate formatting
   */
  private logBinaryData(data: Uint8Array, binaryType: 'debugger' | 'raw-p2'): void {
    if (this.debugLoggerWindow) {
      // Format based on type
      let formattedMessage: string;
      if (binaryType === 'debugger') {
        // Use 32-byte/line format for debugger packets
        formattedMessage = this.formatDebuggerBinary(data);
      } else {
        // Use 16-byte/line format with ASCII for raw P2 data
        formattedMessage = this.formatRawBinary(data);
      }
      this.debugLoggerWindow.logSerialMessage(formattedMessage);
    }
  }

  /**
   * Create Debug Logger Window immediately on startup for auto-logging
   */
  private createLoggerWindow(): void {
    if (this.debugLoggerWindow) {
      this.logConsoleMessage('[DEBUG LOGGER] Debug Logger already exists, skipping creation');
      return;
    }

    this.logConsoleMessage('[DEBUG LOGGER] Creating debug logger window for auto-logging...');
    try {
      this.debugLoggerWindow = LoggerWindow.getInstance(this.context);
      this.logConsoleMessage('[DEBUG LOGGER] Auto-created successfully - logging started immediately');
      this.displays['DebugLogger'] = this.debugLoggerWindow; // Store with original case

      // Apply current theme from preferences
      if (this.context.preferences?.terminal?.colorTheme) {
        const themeValue = this.context.preferences.terminal.colorTheme;
        this.logConsoleMessage(`[THEME] Applying theme to auto-created debug logger: ${themeValue}`);
        let colorName: 'green' | 'amber' = 'green';
        if (themeValue.includes('amber')) {
          colorName = 'amber';
        } else if (themeValue.includes('green')) {
          colorName = 'green';
        }
        this.logConsoleMessage(`[THEME] Parsed color name: ${colorName}`);
        this.debugLoggerWindow.setTheme(colorName);
      } else {
        this.logConsoleMessage('[THEME] No theme preference found for auto-created logger, using default green');
      }

      // Register with WindowRouter for message routing
      this.windowRouter.registerWindow(
        'logger',
        'logger',
        this.debugLoggerWindow.handleRouterMessage.bind(this.debugLoggerWindow)
      );

      // Set up event listeners
      this.debugLoggerWindow.on('close', () => {
        this.logMessage('Debug Logger Window closed');
        this.logConsoleMessage('[DEBUG LOGGER] Window closed by user');
        this.windowRouter.unregisterWindow('logger');
        delete this.displays['DebugLogger']; // Use original case
        this.debugLoggerWindow = null;
        this.updateLoggingStatus(false);
      });

      this.debugLoggerWindow.on('loggingStatusChanged', (status: any) => {
        this.updateLoggingStatus(status.isLogging, status.filename);
        if (this.context.runEnvironment.loggingEnabled) {
          this.logMessage(
            `Debug Logger logging status: ${status.isLogging ? 'STARTED' : 'STOPPED'} ${status.filename || ''}`
          );
        }
      });

      // Listen for COG-related events
      this.debugLoggerWindow.on('show-all-cogs-requested', () => {
        this.handleShowAllCOGs();
      });

      this.debugLoggerWindow.on('hide-all-cogs-requested', () => {
        this.handleHideAllCOGs();
      });

      this.debugLoggerWindow.on('export-cog-logs-requested', () => {
        this.logConsoleMessage('[MAIN] Export COG logs requested');
        this.exportCOGLogs();
      });

      // Connect performance monitor for warnings
      const components = this.serialProcessor.getComponents();
      if (components.performanceMonitor) {
        this.debugLoggerWindow.setPerformanceMonitor(components.performanceMonitor);
        this.logConsoleMessage('[DEBUG LOGGER] Connected to performance monitor for warnings');
      }

      if (this.context.runEnvironment.loggingEnabled) {
        this.logMessage('Auto-created Debug Logger Window - logging started immediately');
      }
    } catch (error) {
      console.error('[DEBUG LOGGER] Failed to create Debug Logger Window:', error);
      this.logMessage(`ERROR: Failed to create Debug Logger Window: ${error}`);
    }
  }

  /**
   * Handle P2 system reboot event - complete synchronization reset
   * Triggered by "Cog0 INIT $0000_0000 $0000_0000 load" message
   */
  private handleP2SystemReboot(eventData: { message: string; timestamp: number }): void {
    this.logConsoleMessage(`[P2 SYNC] 🔄 Starting complete P2 synchronization reset...`);

    // 1. Clear all sync buffers and parser state
    this.logConsoleMessage(`[P2 SYNC] 🧹 Clearing sync buffers and parser state`);
    this.syncBuffer = ''; // Clear the message synchronization buffer

    // 2. Reset debugger parser state
    this.logConsoleMessage(`[P2 SYNC] 🔄 Resetting debugger parser state`);
    this.serialProcessor.onDTRReset(); // Trigger Two-Tier reset

    // 3. Clear and restart the Debug Logger session
    if (this.debugLoggerWindow) {
      this.logConsoleMessage(`[P2 SYNC] 📝 Restarting Debug Logger session`);
      try {
        // Signal DTR reset to create new log file boundary
        this.debugLoggerWindow.handleDTRReset();

        // Signal DTR reset to create new log file boundary (no reboot marker in log)
      } catch (error) {
        console.error(`[P2 SYNC] Error restarting Debug Logger:`, error);
      }
    }

    // 4. Reset COG window tracking (all COGs start fresh after reboot)
    this.logConsoleMessage(`[P2 SYNC] 🎯 Resetting COG window tracking`);
    // Note: Don't close existing COG windows - user may want to see previous session data
    // Just reset their internal state for new session
    for (let cogId = 0; cogId < 8; cogId++) {
      const windowKey = `COG-${cogId}`;
      const cogWindow = this.displays[windowKey] as unknown as LoggerCOGWindow;
      if (cogWindow && cogWindow.isOpen()) {
        this.logConsoleMessage(`[P2 SYNC] 🔄 Resetting ${windowKey} window state`);
        cogWindow.handleDTRReset();
      }
    }

    // 5. Update main window status
    if (this.context.runEnvironment.loggingEnabled) {
      this.logMessage(`🎯 P2 SYSTEM REBOOT DETECTED - Complete synchronization reset performed`);
      this.logMessage(`   Golden marker: ${eventData.message}`);
      this.logMessage(`   All parsers and buffers reset - perfect sync achieved`);
    }

    // P2 system messages go to debug logger, not main terminal

    this.logConsoleMessage(`[P2 SYNC] ✅ Complete P2 synchronization reset finished - perfect sync achieved`);
  }

  /**
   * Apply ASCII + CogN synchronization strategy to handle partial backtick commands
   *
   * Strategy:
   * 1. Add new data to buffer
   * 2. Look for P2 debug message boundaries: "\nCogN " or "\n`"
   * 3. Extract and forward all complete messages immediately
   * 4. Keep only incomplete fragment in buffer
   * 5. Start baud-rate-aware timer for incomplete fragment
   * 6. On timeout, process incomplete fragment
   *
   * Goal: Use P2-specific sync patterns to identify complete messages
   */
  private applySyncStrategy(data: string): string[] {
    const results: string[] = [];

    // Add new data to sync buffer
    this.syncBuffer += data;

    // Look for P2 debug message sync patterns with flexible EOL:
    // - Single EOL followed by "CogN " or backtick
    // EOL can be any of these 4 variants:
    //   \r    (CR - classic Mac)
    //   \n    (LF - Unix/Linux)
    //   \r\n  (CRLF - Windows)
    //   \n\r  (LFCR - the backwards one that should be forgotten!)
    // Note: EOL is max 2 chars, never repeating. Double EOLs = blank lines (content)
    const syncPattern = /(\r\n|\n\r|\r|\n)(?:Cog\d\s|`)/g;

    // Find all sync pattern positions
    const syncPoints: number[] = [];
    let match;
    while ((match = syncPattern.exec(this.syncBuffer)) !== null) {
      syncPoints.push(match.index);
    }

    let completeContent = '';
    let incompleteFragment = '';

    if (syncPoints.length > 0) {
      // We have at least one sync point - everything before the last sync is complete
      const lastSyncPoint = syncPoints[syncPoints.length - 1];
      completeContent = this.syncBuffer.substring(0, lastSyncPoint);
      incompleteFragment = this.syncBuffer.substring(lastSyncPoint);

      this.logConsoleMessage(`[SYNC] Found ${syncPoints.length} sync points, splitting at position ${lastSyncPoint}`);
    } else {
      // No sync patterns found - use simple line ending detection
      const lines = this.syncBuffer.split(/\r?\n/);

      // Process all lines except the last one (which might be incomplete)
      for (let i = 0; i < lines.length - 1; i++) {
        if (completeContent.length > 0) {
          completeContent += '\r\n';
        }
        completeContent += lines[i];
      }

      // The last line is incomplete if buffer doesn't end with line ending
      const lastLine = lines[lines.length - 1];
      const endsWithLineEnding = this.syncBuffer.match(/\r?\n$/);

      if (endsWithLineEnding && lastLine.length > 0) {
        if (completeContent.length > 0) {
          completeContent += '\r\n';
        }
        completeContent += lastLine;
        incompleteFragment = '';
      } else {
        incompleteFragment = lastLine;
      }
    }

    // Forward all complete content immediately, split by lines
    if (completeContent.length > 0) {
      // Split complete content into individual lines for proper routing
      // This ensures each Cog message and backtick command is processed separately
      const lines = completeContent.split(/\r\n|\n\r|\r|\n/);

      for (const line of lines) {
        if (line.length > 0) {
          // Skip empty lines
          if (this.isAsciiPrintable(line)) {
            this.logConsoleMessage(
              `[SYNC] ✅ Forwarding line: "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`
            );
            results.push(line);
          } else {
            this.logConsoleMessage(`[SYNC] ⚠️ Non-ASCII line, dumping as hex:`);
            this.dumpHexData(line);
            results.push(line); // Forward anyway for debugging
          }
        }
      }
    }

    // Handle incomplete fragment
    if (incompleteFragment.length > 0) {
      this.logConsoleMessage(
        `[SYNC] 🔄 Buffering incomplete fragment (${incompleteFragment.length} chars): "${incompleteFragment}"`
      );
      this.syncBuffer = incompleteFragment;
      this.lastSyncTime = Date.now(); // Start timer for fragment
    } else {
      this.logConsoleMessage(`[SYNC] 🟢 No incomplete fragment - buffer cleared`);
      this.syncBuffer = '';
    }

    // Check for timeout on buffered fragment
    if (this.syncBuffer.length > 0) {
      const dynamicTimeout = this.calculateSyncTimeout();
      const timeSinceLastSync = Date.now() - this.lastSyncTime;

      if (timeSinceLastSync > dynamicTimeout) {
        // Timeout reached - process incomplete fragment
        this.logConsoleMessage(
          `[SYNC] ⏱️ Timeout (${dynamicTimeout.toFixed(1)}ms) - processing incomplete fragment: "${this.syncBuffer}"`
        );

        if (this.isAsciiPrintable(this.syncBuffer)) {
          results.push(this.syncBuffer);
        } else {
          this.logConsoleMessage(`[SYNC] ⚠️ Non-ASCII fragment, dumping as hex:`);
          this.dumpHexData(this.syncBuffer);
        }

        this.syncBuffer = '';
      }
    }

    return results;
  }

  /**
   * Check if string contains only printable ASCII characters
   */
  private isAsciiPrintable(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // Allow printable ASCII (32-126), plus common control chars (9=TAB, 10=LF, 13=CR)
      if (!((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Dump non-ASCII data in hex + ASCII format for debugging
   */
  private dumpHexData(data: string): void {
    const bytes = [];
    const ascii = [];

    for (let i = 0; i < data.length; i++) {
      const code = data.charCodeAt(i);
      bytes.push(code.toString(16).padStart(2, '0'));
      ascii.push(code >= 32 && code <= 126 ? data.charAt(i) : '.');
    }

    // Format as hex dump: address | hex bytes | ASCII
    const bytesPerLine = 16;
    for (let i = 0; i < bytes.length; i += bytesPerLine) {
      const hexLine = bytes
        .slice(i, i + bytesPerLine)
        .join(' ')
        .padEnd(bytesPerLine * 3 - 1, ' ');
      const asciiLine = ascii.slice(i, i + bytesPerLine).join('');
      this.logConsoleMessage(`[SYNC] ${i.toString(16).padStart(4, '0')}: ${hexLine} | ${asciiLine}`);
    }
  }

  private DISPLAY_SCOPE: string = 'SCOPE';
  private DISPLAY_SCOPEXY: string = 'SCOPE_XY';
  private DISPLAY_FFT: string = 'FFT';
  private DISPLAY_SPECTRO: string = 'SPECTRO';
  private DISPLAY_TERM: string = 'TERM';
  private DISPLAY_PLOT: string = 'PLOT';
  private DISPLAY_LOGIC: string = 'LOGIC';
  private DISPLAY_BITMAP: string = 'BITMAP';
  private DISPLAY_MIDI: string = 'MIDI';

  private hookNotifcationsAndRememberWindow(windowName: string, windowObject: DebugWindowBase) {
    // CASE-INSENSITIVE: Store with ORIGINAL case - comparisons handle case-insensitivity
    this.logMessage(`GOOD DISPLAY: Received for ${windowName}`);
    // esure we get notifications of window close
    windowObject.on('close', () => {
      this.logMessage(`CallBack: Window ${windowName} is closing.`);
      this.cleanupOnClose(windowName); // Pass original case name
    });
    windowObject.on('closed', () => {
      this.logMessage(`CallBack: Window ${windowName} has closed.`);
    });
    // remember active displays - store with ORIGINAL case
    this.displays[windowName] = windowObject;
  }

  private cleanupOnClose(windowName: string) {
    this.logMessage(`cleanupOnClose() ${windowName}`);
    // flush the log buffer
    this.flushLogBuffer();
    this.immediateLog = true;
    const windowObject: DebugWindowBase = this.displays[windowName];
    // remove the window from the list of active displays
    delete this.displays[windowName];
    // and remove listeners
    windowObject.removeAllListeners();
  }

  /**
   * Handle Cog-prefixed messages - route to debug logger and extract embedded commands
   */
  // RESTORED: handleCogMessage - Temporarily restored for Ground Zero Recovery
  private handleCogMessage(data: string): void {
    // Auto-create debug logger window on first Cog or INIT message
    if (!this.debugLoggerWindow) {
      this.logConsoleMessage('[DEBUG LOGGER] Creating debug logger window...');
      try {
        this.debugLoggerWindow = LoggerWindow.getInstance(this.context);
        // Register it in displays for cleanup tracking
        this.displays['DebugLogger'] = this.debugLoggerWindow; // Store with original case

        // Register with WindowRouter for message routing
        this.windowRouter.registerWindow(
          'logger',
          'logger',
          this.debugLoggerWindow.handleRouterMessage.bind(this.debugLoggerWindow)
        );

        // Set up cleanup handler
        this.debugLoggerWindow.on('close', () => {
          this.logMessage('Debug Logger Window closed');
          this.logConsoleMessage('[DEBUG LOGGER] Window closed by user');
          this.windowRouter.unregisterWindow('logger');
          delete this.displays['DebugLogger']; // Use original case
          this.debugLoggerWindow = null;
        });

        // Connect performance monitor for warnings
        const components = this.serialProcessor.getComponents();
        if (components.performanceMonitor) {
          this.debugLoggerWindow.setPerformanceMonitor(components.performanceMonitor);
        }

        if (this.context.runEnvironment.loggingEnabled) {
          this.logMessage('Auto-created Debug Logger Window for Cog messages');
        }
      } catch (error) {
        // Fall back to console logging if window creation fails
        console.error('Failed to create Debug Logger Window:', error);
        this.logConsoleMessage(`[COG] ${data}`);
        return;
      }
    }

    // Route FULL message to debug logger (don't strip prefix)
    // Window will decide what to display
    if (this.debugLoggerWindow) {
      this.logConsoleMessage(`[DEBUG LOGGER] Sending message: ${data}`);
      // updateContent expects array format
      this.debugLoggerWindow.updateContent([data]);
    } else {
      // Fallback to console if logger window is unavailable
      console.error('[DEBUG LOGGER] Window not available, falling back to console');
      this.logConsoleMessage(`[DEBUG OUTPUT] ${data}`);
    }

    // Check for embedded backtick commands within the Cog message
    // Format: "Cog0: Some text `TERM TestTerm SIZE 40 20"
    const backtickIndex = data.indexOf('`');
    if (backtickIndex !== -1) {
      const embeddedCommand = data.substring(backtickIndex);
      if (this.context.runEnvironment.loggingEnabled) {
        this.logMessage(`* Extracting embedded command from Cog message: ${embeddedCommand}`);
      }

      // Create ExtractedMessage for two-tier system compatibility
      const sharedType = this.parseBacktickCommandType(embeddedCommand);
      const commandData = new TextEncoder().encode(embeddedCommand);
      const extractedMessage: ExtractedMessage = {
        type: sharedType,
        data: commandData,
        timestamp: Date.now(),
        confidence: 'VERY_DISTINCTIVE'
      };

      // Route the embedded command through two-tier system
      this.handleWindowCommand(extractedMessage);
    }

    // Log the Cog message receipt if logging is enabled
    if (this.context.runEnvironment.loggingEnabled) {
      this.logMessage(`* Received Cog message: ${data}`);
    }
  }

  // ----------------------------------------------------------------------
  // this is our Window Configuration
  //
  private async CalcWindowCoords(): Promise<void> {
    const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
    this.logConsoleMessage(`work area size: ${width} x ${height}`);

    // Use default font metrics for initial window sizing
    // Actual metrics will be measured after window loads
    const charWidth = 12; // Default character width
    const charHeight = 18; // Default character height
    this.logConsoleMessage(`     char size (default): ${charWidth} x ${charHeight}`);

    // Calculate the required dimensions for 27 lines by 80 characters
    const minWidth = 80 * charWidth; // Minimum width for 80 characters
    const minHeight = (27 + 1) * charHeight; // Minimum height for 27 lines + 1 for xmit data entry

    // have small screen
    // linux: 1280x720
    // set to 80x27 proportioned screen

    // have larger screen
    // macOS (rt): 3200x1775
    // macOS (lt): 3200?x1775?
    // set to 80x27 proportioned screen
    const targetScreenWidth: number = height < 800 ? Math.round(width / 2) : Math.round(width / 4);
    const targetScreenHeight: number =
      height < 800 ? Math.round((height / 5) * 2) : Math.round(this.mainWindowGeometry.width / 3.3);

    // Ensure the window is at least the minimum size
    this.mainWindowGeometry.width = Math.max(minWidth, targetScreenWidth);
    this.mainWindowGeometry.height = Math.max(minHeight, targetScreenHeight);
    // position window bottom-center
    this.mainWindowGeometry.xOffset = Math.round((width - this.mainWindowGeometry.width) / 2); // Center horizontally
    this.mainWindowGeometry.yOffset = Math.round(height - this.mainWindowGeometry.height - 50); // Bottom with 50px margin

    this.logConsoleMessage(
      `window geom: ${this.mainWindowGeometry.width}x${this.mainWindowGeometry.height} @${this.mainWindowGeometry.xOffset},${this.mainWindowGeometry.yOffset}`
    );
  }

  private async createAppWindow() {
    this.logConsoleMessage('[STARTUP] createAppWindow() called');
    this.context.logger.debugMsg(`* create App Window()`);
    this.mainWindowOpen = true;

    try {
      await this.CalcWindowCoords();
    } catch (error) {
      console.error('[STARTUP] ERROR in CalcWindowCoords:', error);
      // Use default coords
    }

    this.logConsoleMessage('[WINDOW] Creating BrowserWindow with geometry:', this.mainWindowGeometry);

    this.mainWindow = new BrowserWindow({
      width: this.mainWindowGeometry.width,
      height: this.mainWindowGeometry.height,
      x: this.mainWindowGeometry.xOffset,
      y: this.mainWindowGeometry.yOffset,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Increase max listeners to prevent EventEmitter warning
    // Multiple debug windows + IPC handlers can exceed default limit of 10
    this.mainWindow.webContents.setMaxListeners(20);

    this.logConsoleMessage('[WINDOW] BrowserWindow created successfully');

    const dataEntryBGColor: string = this.termColors.xmitBGColor;
    const dataEntryFGColor: string = this.termColors.xmitFGColor;
    const logContentBGColor: string = this.termColors.rcvBGColor;
    const logContentFGColor: string = this.termColors.rcvFGColor;

    // Check if we're in IDE mode
    const isIdeMode = this.context.runEnvironment.ideMode;

    // and load the main window .html of the app
    const htmlContent = isIdeMode ? this.createIDEModeHTML() : this.createStandardHTML();

    this.logConsoleMessage('[WINDOW] Loading HTML content, length:', htmlContent.length);

    // Write HTML to temp file to allow file:// font URLs to work
    const fs = require('fs');
    const os = require('os');
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `pnut-main-${Date.now()}.html`);

    try {
      fs.writeFileSync(tempFile, htmlContent);
      this.logConsoleMessage('[WINDOW] Wrote HTML to temp file:', tempFile);

      // Load the temp file instead of using data URL
      this.mainWindow.loadFile(tempFile).catch((error: any) => {
        console.error('[WINDOW] Failed to load HTML file:', error);
        console.error('[WINDOW] HTML content preview (first 500 chars):', htmlContent.substring(0, 500));
      });

      // Clean up temp file after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFile);
          this.logConsoleMessage('[WINDOW] Cleaned up temp file:', tempFile);
        } catch (err) {
          // File might already be gone, that's ok
        }
      }, 5000);
    } catch (error) {
      console.error('[WINDOW] Failed to write temp file:', error);
    }

    // Add error handler for window crashes
    this.mainWindow.webContents.on('did-fail-load', (event: any, errorCode: any, errorDescription: any) => {
      console.error('[WINDOW] Failed to load:', errorCode, errorDescription);
    });

    this.mainWindow.webContents.on('crashed', () => {
      console.error('[WINDOW] Renderer process crashed!');
    });

    // Only set up menu in standard mode
    this.logConsoleMessage(`[MENU SETUP] IDE Mode: ${isIdeMode}, Setting up menu: ${!isIdeMode}`);
    // Set up the system menu (macOS only, prevents "Electron" from showing)
    this.setupApplicationMenu();

    if (!isIdeMode) {
      this.logConsoleMessage('[MENU SETUP] Standalone Mode - HTML menu bar will be used');
      // Standard mode: HTML menu bar in the window
      // No native menu bar in window on any platform
      this.mainWindow.setMenuBarVisibility(false);
    } else {
      this.logConsoleMessage('[MENU SETUP] IDE Mode - No menus');
      // IDE mode: No menus at all
      this.mainWindow.setMenuBarVisibility(false);
    }

    this.setupWindowHandlers();
  }

  /**
   * Set the control line mode and update UI
   */
  private setControlLineMode(mode: 'DTR' | 'RTS'): void {
    const previousMode = this.controlLineMode;
    this.controlLineMode = mode;

    this.logMessage(`Control line mode changed from ${previousMode} to ${mode}`);

    // Update the toolbar to show the correct control
    this.updateControlLineUI();

    // If switching modes, ensure both are off to avoid conflicts
    if (previousMode !== mode) {
      this.dtrState = false;
      this.rtsState = false;
      if (this._serialPort) {
        this._serialPort.setDTR(false).catch(() => {});
        this._serialPort.setRTS(false).catch(() => {});
      }
    }
  }

  /**
   * Update the UI to show only the active control line
   */
  // REMOVED: attachControlLineHandlers method - IPC doesn't work in injected JavaScript
  // All button handlers are now attached in the initial HTML DOMContentLoaded event

  private updateControlLineUI(): void {
    // FIXED: Only update button text and data attribute, don't destroy elements
    const isIdeMode = this.context.runEnvironment.ideMode;
    const mode = this.controlLineMode;

    // Build the script using string replacement for the mode value
    // Wrap in IIFE to avoid variable redeclaration errors
    const updateScript = `
      (function() {
        const toolbar = document.getElementById('toolbar');
        if (toolbar) {
          // Find the reset button - it should ALWAYS have the same ID
          let resetButton = document.getElementById('reset-toggle');

          // Fallback for legacy IDs (but don't change them)
          if (!resetButton) {
            resetButton = document.getElementById('dtr-toggle') || document.getElementById('rts-toggle');
          }

          // Update button text and data attribute
          if (resetButton) {
            resetButton.textContent = '__MODE__';
            resetButton.dataset.line = '__MODE__';
          }

          // Find checkbox and update its data attribute
          // The checkbox should ALWAYS have the same ID - don't rename it!
          let resetCheckbox = document.getElementById('reset-checkbox');

          // Fallback for legacy IDs (but don't change them)
          if (!resetCheckbox) {
            resetCheckbox = document.getElementById('dtr-checkbox') || document.getElementById('rts-checkbox');
          }

          if (resetCheckbox) {
            // Only update the data attribute to indicate which line is active
            resetCheckbox.dataset.line = '__MODE__';
          }
        }
      })();
    `.replace(/__MODE__/g, mode);

    this.safeExecuteJS(updateScript, 'update control line UI');

    // Update checkbox state
    this.updateControlLineCheckboxState();
  }

  private updateControlLineCheckboxState(): void {
    // Update checkbox state based on active control line
    const state = this.controlLineMode === 'RTS' ? this.rtsState : this.dtrState;
    // Wrap in IIFE to avoid variable redeclaration errors
    this.safeExecuteJS(
      `
      (function() {
        const resetCheckbox = document.getElementById('reset-checkbox');
        if (resetCheckbox) {
          resetCheckbox.checked = ${state};
        }
      })();
    `,
      'update-checkbox-state'
    );
  }

  /**
   * Generate HTML for control line (DTR or RTS) based on current mode
   * Only shows the active control line to reduce UI confusion
   */
  private getControlLineHTML(): string {
    const mode = this.controlLineMode;
    // Use unified IDs that don't change when switching modes
    return `
      <button id="reset-toggle" class="toolbar-button" data-line="${mode}">${mode}</button>
      <input type="checkbox" id="reset-checkbox" data-line="${mode}" style="margin-left: 5px;">
    `;
  }

  private createIDEModeHTML(): string {
    const logContentBGColor: string = this.termColors.rcvBGColor;
    const logContentFGColor: string = this.termColors.rcvFGColor;

    // Minimal UI for IDE mode - just log content
    return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <title>PNut Term TS - IDE Mode</title>
      <style>
        @font-face {
          font-family: 'Parallax';
          src: url('${this.getParallaxFontUrl()}') format('truetype');
        }
        body {
          margin: 0;
          padding: 0;
          font-family: Consolas, 'Courier New', monospace;
          font-size: 12px;
          overflow: hidden;
        }
        #pst-content {
          position: absolute;
          top: 0;
          bottom: 20px;
          left: 0;
          right: 0;
          overflow-y: auto;
          padding: 5px;
          background-color: ${logContentBGColor};
          color: ${logContentFGColor};
          font-family: 'Parallax', Consolas, monospace;
          white-space: pre-wrap;
        }
        #pst-content p {
          margin: 0;
          padding: 0;
          white-space: pre-wrap;
        }
        #status-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 20px;
          background-color: #f0f0f0;
          border-top: 1px solid #ccc;
          display: flex;
          align-items: center;
          padding: 0 5px;
          font-size: 11px;
        }
        .status-field {
          margin-right: 15px;
        }
      </style>
    </head>
    <body>
      <div id="pst-content"></div>
      <div id="status-bar">
        <div class="status-field">
          <span id="connection-status">Disconnected</span>
        </div>
        <div class="status-field">
          <span id="port-info"></span>
        </div>
      </div>
    </body>
  </html>`;
  }

  private createStandardHTML(): string {
    const dataEntryBGColor: string = this.termColors.xmitBGColor;
    const dataEntryFGColor: string = this.termColors.xmitFGColor;
    const logContentBGColor: string = this.termColors.rcvBGColor;
    const logContentFGColor: string = this.termColors.rcvFGColor;

    // Standard mode with full UI
    return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <title>PNut Term TS</title>
      <style>
          @font-face {
            font-family: 'Parallax';
            src: url('${this.getParallaxFontUrl()}') format('truetype');
          }
          @font-face {
            font-family: 'IBM 3270';
            src: url('${this.getIBM3270FontUrl()}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        body {
          display: flex;
          flex-direction: column;
          height: 100vh;
          margin: 0;
          /* background-color: #FF00FF; */ /* MAGENTA - for debugging exposed areas - commented out for normal operation */
          font-family: Consolas, sans-serif; /* Use Arial or any sans-serif font */
          font-size: 12px; /* Set a smaller font size */
        }
        p {
          margin: 0;
        }
        #menu-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 28px; /* Standard menu height */
          background-color: #f5f5f5; /* Match toolbar color */
          border-bottom: 1px solid #ddd;
          z-index: 9999; /* Maximum z-index to ensure on top */
          font-size: 13px;
          user-select: none;
          display: block;
          box-sizing: border-box;
        }
        .menu-container {
          display: flex;
          background: #f5f5f5; /* Match toolbar color */
          font-size: 13px;
          user-select: none;
          width: 100%;
        }
        .menu-item {
          position: relative;
          padding: 4px 12px;
          color: #333333; /* Dark text for light background */
          cursor: pointer;
        }
        .menu-item:hover {
          background: #e0e0e0; /* Light gray hover */
        }
        .menu-dropdown {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          background: #ffffff; /* White dropdown background */
          border: 1px solid #ccc;
          min-width: 200px;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .menu-dropdown.open {
          display: block;
        }
        .menu-dropdown-item {
          padding: 8px 16px;
          color: #333333; /* Dark text */
          cursor: pointer;
        }
        .menu-dropdown-item:hover {
          background: #e8e8e8; /* Light gray hover */
        }
        #toolbar {
          position: fixed;
          top: 28px; /* Below menu bar (28px) */
          left: 0;
          right: 0;
          height: 32px;
          background-color: #f5f5f5;
          border-bottom: 1px solid #ddd;
          display: flex;
          align-items: center;
          padding: 0 10px;
          z-index: 2;
        }
        #dataEntry {
          position: fixed;
          top: 60px; /* Below menu (28px) + toolbar (32px) */
          left: 8px;
          right: 8px;
          padding: 8px;
          margin: 4px;
          background-color: ${dataEntryBGColor};
          color: ${dataEntryFGColor};
          height: 36px; /* Input field height */
          font-size: 14px; /* Slightly larger font */
          border: 2px inset #c0c0c0; /* Recessed/inset appearance like original PST */
          border-radius: 2px;
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.1); /* Lighter shadow effect */
          font-family: 'Courier New', monospace;
          z-index: 1;
        }
        #pst-content {
          position: absolute;
          top: 112px; /* Height of menu (28px) + toolbar (32px) + dataEntry with margins (52px) */
          bottom: 41px; /* Height of #status-bar */
          left: 8px;
          right: 8px;
          flex-grow: 1;
          overflow-y: auto;
          padding: 10px;
          background-color: ${logContentBGColor};
          color: ${logContentFGColor};
          border: 2px inset #c0c0c0; /* Recessed/inset appearance like original PST */
          border-radius: 2px;
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.1); /* Lighter shadow effect */
          margin: 4px;
          font-family: Consolas, 'Courier New', monospace;
          white-space: pre-wrap;
        }
        #pst-content p {
          margin: 0;
          padding: 0;
          white-space: pre-wrap;
        }
        /* Font styles for terminal */
        #pst-content.font-default {
          font-family: Consolas, 'Courier New', monospace;
        }
        #pst-content.font-parallax {
          font-family: 'Parallax', Consolas, monospace;
        }
        #pst-content.font-ibm3270 {
          font-family: 'IBM 3270', 'Courier New', monospace;
          font-size: 14px;
        }
        /* IBM 3270 Green Phosphor theme */
        #pst-content.font-ibm3270-green {
          font-family: 'IBM 3270', 'Courier New', monospace;
          font-size: 14px;
          background-color: #000000;
          color: #00FF00;
          text-shadow: 0 0 2px #00FF00;
        }
        /* IBM 3270 Amber Phosphor theme */
        #pst-content.font-ibm3270-amber {
          font-family: 'IBM 3270', 'Courier New', monospace;
          font-size: 14px;
          background-color: #000000;
          color: #FFBF00;
          text-shadow: 0 0 2px #FFBF00;
        }
        .toolbar-button {
          margin: 0 5px;
          padding: 4px 8px;
          background-color: #fff;
          border: 1px solid #ccc;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
        }
        .toolbar-button:hover {
          background-color: #e8e8e8;
        }
        .toolbar-button:active {
          background-color: #d0d0d0;
        }
        .toolbar-separator {
          width: 1px;
          height: 20px;
          background-color: #ccc;
          margin: 0 10px;
        }
        #status-bar {
          position: fixed;
          bottom: 0;
          display: flex;
          justify-content: space-between;
          background-color: #f0f0f0;
          padding: 10px;
          border-top: 1px solid #ccc;
          z-index: 1;
        }
        .status-left {
          display: flex;
          align-items: center;
        }
        .status-right {
          display: flex;
          align-items: center;
        }
        .status-field {
          margin-left: 20px;
          display: flex;
          align-items: center;
        }
        .status-label {
          font-weight: bold;
          margin-right: 5px;
        }
        .status-value {
          padding: 2px 5px;
          background-color: #e0e0e0;
          border: 1px solid #ccc;
          border-radius: 3px;
        }
        #kbd-entry {
          width: 100%; /* Make kbd-entry span the full width */
        }
        #in-out {
          width: 100%; /* Make kbd-entry span the full width */
          display: flex;
          flex-direction: column;
          margin: 0px;
          margin-top: 26px; /* Account for fixed menu bar (24px height + 2px border) */
          padding: 0px;
        }
      </style>
    </head>
    <body>
      <div id="menu-bar">
        <div class="menu-container">
          <div class="menu-item" data-menu="file">
            <span>File</span>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-action="menu-new-recording">New Recording</div>
              <div class="menu-dropdown-item" data-action="menu-open-recording">Open Recording...</div>
              <div class="menu-dropdown-item" data-action="menu-save-recording">Save Recording As...</div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-start-recording">Start Recording <span style="float: right; color: #999;">Ctrl+R</span></div>
              <div class="menu-dropdown-item" data-action="menu-stop-recording">Stop Recording</div>
              <div class="menu-dropdown-item" data-action="menu-playback-recording">Playback Recording <span style="float: right; color: #999;">Ctrl+P</span></div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-quit">Exit <span style="float: right; color: #999;">Ctrl+Q</span></div>
            </div>
          </div>
          <div class="menu-item" data-menu="edit">
            <span>Edit</span>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-action="cut">Cut <span style="float: right; color: #999;">Ctrl+X</span></div>
              <div class="menu-dropdown-item" data-action="copy">Copy <span style="float: right; color: #999;">Ctrl+C</span></div>
              <div class="menu-dropdown-item" data-action="paste">Paste <span style="float: right; color: #999;">Ctrl+V</span></div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-find">Find... <span style="float: right; color: #999;">Ctrl+F</span></div>
              <div class="menu-dropdown-item" data-action="menu-clear">Clear Terminal</div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-preferences">Preferences... <span style="float: right; color: #999;">Ctrl+,</span></div>
            </div>
          </div>
          <div class="menu-item" data-menu="window">
            <span>Window</span>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-action="menu-performance-monitor">Performance Monitor</div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-cascade">Cascade</div>
              <div class="menu-dropdown-item" data-action="menu-tile">Tile</div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-show-all">Show All Windows</div>
              <div class="menu-dropdown-item" data-action="menu-hide-all">Hide All Windows</div>
            </div>
          </div>
          <div class="menu-item" data-menu="help">
            <span>Help</span>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-action="menu-documentation">Documentation <span style="float: right; color: #999;">F1</span></div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-about">About PNut-Term-TS</div>
            </div>
          </div>
        </div>
      </div>
      <div id="in-out">
        <div id="kbd-entry">
          <input type="text" id="dataEntry" placeholder="Enter text here">
        </div>
        <div id="toolbar">
          ${this.getControlLineHTML()}
          <div class="toolbar-separator"></div>
          <button id="download-ram" class="toolbar-button">RAM</button>
          <span id="ram-led" style="color: #00FF00; margin-left: 3px; font-size: 20px; text-shadow: 0 0 2px #000;">●</span>
          <button id="download-flash" class="toolbar-button" style="margin-left: 10px;">FLASH</button>
          <span id="flash-led" style="color: #808080; margin-left: 3px; font-size: 20px; text-shadow: 0 0 2px #000;">●</span>
          <button id="download-file" class="toolbar-button" style="margin-left: 15px;">📥 Download</button>
          <div class="toolbar-separator"></div>
          <button id="record-btn" class="toolbar-button">⏺ Record</button>
          <button id="playback-btn" class="toolbar-button">▶ Play</button>
          <div class="toolbar-separator"></div>
          <span id="recording-status" style="color: #666; font-size: 12px;">Ready</span>
          <div class="toolbar-separator"></div>
        </div>
        <div id="playback-controls" style="display: none; background: #252526; padding: 10px; border-bottom: 1px solid #3e3e42;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button id="playback-play" class="toolbar-button" style="width: 40px;">▶</button>
            <button id="playback-pause" class="toolbar-button" style="width: 40px; display: none;">⏸</button>
            <button id="playback-stop" class="toolbar-button" style="width: 40px;">⏹</button>
            <div style="flex: 1; display: flex; align-items: center; gap: 10px;">
              <span id="playback-time" style="color: #969696; font-size: 12px; min-width: 100px;">00:00 / 00:00</span>
              <div style="flex: 1; position: relative; height: 20px; background: #3e3e42; border-radius: 3px; cursor: pointer;" id="playback-progress">
                <div id="playback-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #007acc, #0099ff); border-radius: 3px;"></div>
                <div id="playback-handle" style="position: absolute; top: 50%; transform: translateY(-50%); left: 0%; width: 12px; height: 12px; background: white; border-radius: 50%; box-shadow: 0 0 2px rgba(0,0,0,0.5);"></div>
              </div>
            </div>
            <select id="playback-speed" class="toolbar-button" style="padding: 2px 5px;">
              <option value="0.5">0.5x</option>
              <option value="1" selected>1x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>
        <div id="pst-content">
</div>
      </div>
      <div id="status-bar">
        <div class="status-left">
          <div id="connection-status" class="status-field">
            <span class="status-label">Connected</span>
            <span id="conn-led" style="color: #808080; margin-left: 5px; font-size: 18px; text-shadow: 0 0 2px #000;">●</span>
          </div>
          <div id="active-cogs" class="status-field">
            <span class="status-label">Active COGs:</span>
            <span class="status-value" id="cogs-status">None</span>
          </div>
          <div id="log-status" class="status-field">
            <span class="status-label">Logging</span>
            <span id="log-led" style="color: #FFBF00; margin-left: 5px; font-size: 18px; text-shadow: 0 0 2px #000;">●</span>
          </div>
        </div>
        <div class="status-right">
          <div id="echo-control" class="status-field">
            <label style="display: flex; align-items: center;" title="When checked, filters out echoed characters from receive display">
              <span class="status-label">Echo</span>
              <input type="checkbox" id="echo-checkbox" style="margin-left: 5px;">
            </label>
          </div>
          <div id="activity-indicators" class="status-field">
            <span class="status-label">TX</span>
            <span id="tx-led" style="color: #333; margin-left: 3px; margin-right: 10px; font-size: 18px; text-shadow: 0 0 2px #000;">●</span>
            <span class="status-label">RX</span>
            <span id="rx-led" style="color: #333; margin-left: 3px; font-size: 18px; text-shadow: 0 0 2px #000;">●</span>
          </div>
          <div id="propPlug" class="status-field">
            <span class="status-label">Port:</span>
            <span class="status-value"> </span>
          </div>
        </div>
      </div>
      <script>
        // console.log('[MENU] Script execution started');
        // IPC Setup - runs directly in renderer with node integration
        let ipcRenderer;
        try {
          const electron = require('electron');
          ipcRenderer = electron.ipcRenderer;
          // console.log('[MENU] ipcRenderer loaded:', !!ipcRenderer);
        } catch (e) {
          console.error('[MENU] Failed to load ipcRenderer:', e);
          // Will be injected from main process if this fails
        }

        // Function to initialize all handlers
        function initializeHandlers() {
          // console.log('[INIT] Initializing all button handlers...');

          if (!ipcRenderer) {
            console.error('[INIT] ipcRenderer not available, cannot attach handlers');
            return;
          }

          // DEBUG: Check what buttons exist in the DOM
          // console.log('[DEBUG] Checking for control line buttons...');

          // RAM/FLASH buttons
          const ramBtn = document.getElementById('download-ram');
          if (ramBtn) {
            ramBtn.addEventListener('click', () => {
              ipcRenderer.send('download-ram');
            });
          }
          const flashBtn = document.getElementById('download-flash');
          if (flashBtn) {
            flashBtn.addEventListener('click', () => {
              ipcRenderer.send('download-flash');
            });
          }

          // Download file button
          const downloadBtn = document.getElementById('download-file');
          if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
              ipcRenderer.send('download-file');
            });
          }

          // Unified reset button handler - works for both DTR and RTS
          // Try both possible IDs since we're transitioning from old to new
          let resetToggle = document.getElementById('reset-toggle');
          if (!resetToggle) {
            resetToggle = document.getElementById('dtr-toggle') || document.getElementById('rts-toggle');
          }

          if (resetToggle && !resetToggle.dataset.handlerAttached) {
            // console.log('[RESET] Found reset button, attaching handler');
            // Mark that we've attached the handler to prevent duplicates
            resetToggle.dataset.handlerAttached = 'true';
            let clickCount = 0;
            resetToggle.addEventListener('click', (event) => {
              clickCount++;
              // Check which line is active from the button's data attribute
              const line = resetToggle.dataset.line || resetToggle.textContent;
              // console.log('[RESET] Button CLICK #' + clickCount + ' for line: ' + line);
              // console.log('[RESET] Event type: ' + event.type + ', isTrusted: ' + event.isTrusted);
              // console.log('[RESET] Event timestamp: ' + event.timeStamp);

              if (line === 'RTS') {
                // console.log('[RESET] Sending toggle-rts IPC (click #' + clickCount + ')');
                ipcRenderer.send('toggle-rts');
              } else {
                // Default to DTR
                // console.log('[RESET] Sending toggle-dtr IPC (click #' + clickCount + ')');
                ipcRenderer.send('toggle-dtr');
              }
            });
            // console.log('[RESET] Reset button handler attached successfully');
          } else if (resetToggle) {
            // console.log('[RESET] Reset button handler already attached, skipping');
          } else {
            // console.log('[RESET] Reset button not found in DOM');
          }

          // Unified reset checkbox handler
          let resetCheckbox = document.getElementById('reset-checkbox');
          if (!resetCheckbox) {
            resetCheckbox = document.getElementById('dtr-checkbox') || document.getElementById('rts-checkbox');
          }

          if (resetCheckbox && !resetCheckbox.dataset.handlerAttached) {
            // console.log('[RESET] Found reset checkbox, attaching handler');
            // Mark that we've attached the handler to prevent duplicates
            resetCheckbox.dataset.handlerAttached = 'true';
            let checkboxClickCount = 0;
            // Use 'click' event instead of 'change' - click only fires for user interaction
            resetCheckbox.addEventListener('click', (e) => {
              checkboxClickCount++;
              // console.log('[RESET] Checkbox CLICKED by user #' + checkboxClickCount);
              // console.log('[RESET] Current checkbox state before click: ' + e.target.checked);

              // IMPORTANT: Prevent default to avoid double-toggle
              // The checkbox will be updated by the IPC response only
              e.preventDefault();

              // Check which line is active from the checkbox's data attribute
              const line = resetCheckbox.dataset.line ||
                           (document.getElementById('reset-toggle') || resetToggle)?.textContent;
              // console.log('[RESET] User clicked checkbox for line: ' + line + ', sending IPC...');

              if (line === 'RTS') {
                // console.log('[RESET] Sending toggle-rts IPC from checkbox click #' + checkboxClickCount);
                ipcRenderer.send('toggle-rts');
              } else {
                // Default to DTR
                // console.log('[RESET] Sending toggle-dtr IPC from checkbox click #' + checkboxClickCount);
                ipcRenderer.send('toggle-dtr');
              }
            });
            // console.log('[RESET] Reset checkbox click handler attached successfully');
          } else if (resetCheckbox) {
            // console.log('[RESET] Reset checkbox handler already attached, skipping');
          } else {
            // console.log('[RESET] Reset checkbox not found in DOM');
          }

          // Note: Legacy DTR/RTS specific handlers removed - unified reset handlers above handle both modes

          // Recording buttons
          const recordBtn = document.getElementById('record-btn');
          if (recordBtn) {
            recordBtn.addEventListener('click', () => {
              ipcRenderer.send('toggle-recording');
            });
          }
          const playbackBtn = document.getElementById('playback-btn');
          if (playbackBtn) {
            playbackBtn.addEventListener('click', () => {
              ipcRenderer.send('play-recording');
            });
          }

          // Playback control panel handlers
          const playBtn = document.getElementById('playback-play');
          const pauseBtn = document.getElementById('playback-pause');
          const stopBtn = document.getElementById('playback-stop');
          const speedSelect = document.getElementById('playback-speed');
          const progressBar = document.getElementById('playback-progress');

          if (playBtn) {
            playBtn.addEventListener('click', () => {
              ipcRenderer.send('playback-control', 'play');
            });
          }

          if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
              ipcRenderer.send('playback-control', 'pause');
            });
          }

          if (stopBtn) {
            stopBtn.addEventListener('click', () => {
              ipcRenderer.send('playback-control', 'stop');
            });
          }

          if (speedSelect) {
            speedSelect.addEventListener('change', (e) => {
              const speed = parseFloat(e.target.value);
              ipcRenderer.send('playback-control', 'speed', speed);
            });
          }

          if (progressBar) {
            progressBar.addEventListener('click', (e) => {
              const rect = progressBar.getBoundingClientRect();
              const position = (e.clientX - rect.left) / rect.width;
              ipcRenderer.send('playback-control', 'seek', position);
            });
          }

          // Listen for DTR state updates from main process
          ipcRenderer.on('update-dtr-state', (event, state) => {
            // console.log('[IPC] Received DTR state update:', state);
            const checkbox = document.getElementById('reset-checkbox');
            if (checkbox && checkbox.dataset.line === 'DTR') {
              // Simply update the checkbox - no flags needed since we use click event
              checkbox.checked = state;
              // console.log('[DTR] Checkbox display updated to:', state);
            }
          });

          // Listen for RTS state updates from main process
          ipcRenderer.on('update-rts-state', (event, state) => {
            // console.log('[IPC] Received RTS state update:', state);
            const checkbox = document.getElementById('reset-checkbox');
            if (checkbox && checkbox.dataset.line === 'RTS') {
              // Simply update the checkbox - no flags needed since we use click event
              checkbox.checked = state;
              // console.log('[RTS] Checkbox display updated to:', state);
            }
          });

          // Echo checkbox
          const echoCheckbox = document.getElementById('echo-checkbox');
          if (echoCheckbox) {
            echoCheckbox.addEventListener('change', (e) => {
              ipcRenderer.send('toggle-echo', e.target.checked);
            });
          }

          // Data entry input handler
          const dataEntry = document.getElementById('dataEntry');
          if (dataEntry && !dataEntry.dataset.handlerAttached) {
            dataEntry.dataset.handlerAttached = 'true';
            dataEntry.addEventListener('keydown', function(event) {
              if (event.key === 'Enter') {
                const data = dataEntry.value + '\\r';
                ipcRenderer.send('send-serial-data', data);
                console.log('[TERMINAL] Sent to P2:', JSON.stringify(data));
                dataEntry.value = '';
                event.preventDefault();
              }
            });

            // Auto-focus on page load
            dataEntry.focus();
            console.log('[TERMINAL] Input control hooked for dataEntry');
          }

          // Menu initialization moved to programmatic injection after window loads
          // This avoids data URL script execution restrictions
          const isIdeModeJS = ${this.context.runEnvironment.ideMode};
          // console.log('[MENU] IDE Mode in renderer:', isIdeModeJS);

          // REMOVED: Old menu initialization code that relied on window.ipcRenderer
          // Menu is now handled via Electron's native menu system
        }

        // Check if DOM is already loaded or wait for it
        // console.log('[INIT] Document readyState:', document.readyState);
        if (document.readyState === 'loading') {
          // console.log('[INIT] Waiting for DOMContentLoaded...');
          document.addEventListener('DOMContentLoaded', initializeHandlers);
        } else {
          // console.log('[INIT] DOM already ready, initializing immediately...');
          initializeHandlers();
        }
      </script>
    </body>
  </html>`;
  }

  /**
   * Set up IPC handlers for DTR/RTS and other toolbar controls
   */
  private setupIPCHandlers(): void {
    if (!ipcMain) {
      console.warn('[IPC] ipcMain not available, skipping IPC handler setup');
      return;
    }

    // Remove any existing handlers to avoid duplicates
    ipcMain.removeAllListeners('toggle-dtr');
    ipcMain.removeAllListeners('toggle-rts');
    ipcMain.removeAllListeners('send-serial-data');

    // File menu handlers
    ipcMain.removeAllListeners('menu-new-recording');
    ipcMain.removeAllListeners('menu-open-recording');
    ipcMain.removeAllListeners('menu-save-recording');
    ipcMain.removeAllListeners('menu-start-recording');
    ipcMain.removeAllListeners('menu-stop-recording');
    ipcMain.removeAllListeners('menu-playback-recording');
    ipcMain.removeAllListeners('menu-quit');

    // Edit menu handlers
    ipcMain.removeAllListeners('menu-find');
    ipcMain.removeAllListeners('menu-clear');
    ipcMain.removeAllListeners('menu-preferences');

    // Window menu handlers
    ipcMain.removeAllListeners('menu-performance-monitor');
    ipcMain.removeAllListeners('menu-cascade');
    ipcMain.removeAllListeners('menu-tile');
    ipcMain.removeAllListeners('menu-show-all');
    ipcMain.removeAllListeners('menu-hide-all');

    // Help menu handlers
    ipcMain.removeAllListeners('menu-documentation');
    ipcMain.removeAllListeners('menu-about');

    // DTR/RTS Toggle Handlers
    let dtrToggleCount = 0;
    ipcMain.on('toggle-dtr', async () => {
      dtrToggleCount++;
      this.logConsoleMessage(`[IPC] Received toggle-dtr request #${dtrToggleCount}`);
      this.logConsoleMessage(`[IPC] Current DTR state before toggle: ${this.dtrState}`);
      await this.toggleDTR();
      this.logConsoleMessage(`[IPC] DTR state after toggle: ${this.dtrState}`);
    });

    ipcMain.on('toggle-rts', async () => {
      this.logConsoleMessage('[IPC] Received toggle-rts request');
      await this.toggleRTS();
    });

    // Terminal input handler - send data to P2
    ipcMain.on('send-serial-data', (event: any, data: string) => {
      this.logConsoleMessage(`[TERMINAL INPUT] Sending to P2: ${JSON.stringify(data)}`);
      this.sendSerialData(data);

      // Log to debug logger if it exists
      if (this.debugLoggerWindow) {
        // Format with <cr> notation for carriage returns
        // Examples: "hello\r" → "hello<cr>", "\r" → "<cr>"
        const displayData = data.replace(/\r/g, '<cr>').replace(/\n/g, '<lf>');
        this.debugLoggerWindow.logSystemMessage(`[TX] ${displayData}`);
      }
    });

    // Recording dialog actions
    ipcMain.on('recording-action', (event: any, action: string, data?: string) => {
      this.logConsoleMessage('[IPC] Recording action:', action, data);
      if (action === 'save-and-start') {
        this.windowRouter.stopRecording();
        // TODO: Save current recording
        this.startRecording();
      } else if (action === 'start-new') {
        this.startRecording(data); // data contains the file path
      }
    });

    // Playback control handlers
    ipcMain.on('playback-control', async (event: any, action: string, data?: any) => {
      this.logConsoleMessage('[IPC] Playback control:', action, data);

      if (!this.binaryPlayer) {
        this.logConsoleMessage('[PLAYBACK] No player instance');
        return;
      }

      switch (action) {
        case 'play':
          this.binaryPlayer.play();
          this.showPlaybackControls();
          this.updatePlaybackButton(true);
          break;

        case 'pause':
          this.binaryPlayer.pause();
          this.updatePlaybackButton(false);
          break;

        case 'stop':
          this.binaryPlayer.stop();
          this.hidePlaybackControls();
          this.updatePlaybackButton(false);
          break;

        case 'seek':
          this.binaryPlayer.seek(data);
          break;

        case 'speed':
          this.binaryPlayer.setSpeed(data);
          break;
      }
    });

    // Recording toolbar button handler
    ipcMain.on('toggle-recording', () => {
      this.logConsoleMessage('[IPC] Toggle recording from toolbar');
      if (this.windowRouter.isRecordingActive()) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    // Playback toolbar button handler
    ipcMain.on('play-recording', async () => {
      this.logConsoleMessage('[IPC] Play recording from toolbar');
      await this.playRecording();
    });

    // File menu handlers
    ipcMain.on('menu-new-recording', () => {
      this.logConsoleMessage('[IPC] New recording');
      if (!this.newRecordingDialog) {
        this.newRecordingDialog = new NewRecordingDialog(this.mainWindow, this.context);
      }
      const isRecording = this.windowRouter.isRecordingActive();
      const messageCount = this.windowRouter.getRecordingMessageCount();
      this.newRecordingDialog.show(isRecording, messageCount);
    });

    ipcMain.on('menu-open-recording', async () => {
      this.logConsoleMessage('[IPC] Open recording');

      // Use context-based recordings directory with user preferences
      const recordingsDir = this.context.getRecordingsDirectory();
      if (!fs.existsSync(recordingsDir)) {
        dialog.showMessageBox(this.mainWindow!, {
          type: 'info',
          title: 'No Recordings',
          message: 'No recordings folder found',
          detail: 'Start a recording first to create the recordings folder.',
          buttons: ['OK']
        });
        return;
      }

      const recordingFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.p2rec') || f.endsWith('.jsonl'));

      if (recordingFiles.length === 0) {
        dialog.showMessageBox(this.mainWindow!, {
          type: 'info',
          title: 'No Recordings',
          message: 'No recordings found',
          detail: 'The recordings folder is empty. Start a recording to create recording files.',
          buttons: ['OK']
        });
        return;
      }

      await this.playRecording();
    });

    ipcMain.on('menu-save-recording', async () => {
      this.logConsoleMessage('[IPC] Save recording');

      // Check if recording is in progress
      if (!this.windowRouter.isRecordingActive()) {
        dialog.showMessageBox(this.mainWindow!, {
          type: 'info',
          title: 'No Recording',
          message: 'No recording in progress to save',
          detail: 'Start a recording first before trying to save.',
          buttons: ['OK']
        });
        return;
      }

      // Stop recording first to flush buffer
      this.windowRouter.stopRecording();

      // TODO: Access the saved recording file
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        title: 'Save Recording As',
        defaultPath: `recording_${getFormattedDateTime()}.p2rec`,
        filters: [
          { name: 'Binary Recording Files', extensions: ['p2rec'] },
          { name: 'JSON Recording Files', extensions: ['jsonl'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        // The recording is already saved by stopRecording()
        // We would need to copy/move it to the user's chosen location
        this.logConsoleMessage('[RECORDING] Would save to:', result.filePath);
      }
    });

    ipcMain.on('menu-start-recording', () => {
      this.logConsoleMessage('[IPC] Start recording');
      this.startRecording();
    });

    ipcMain.on('menu-stop-recording', () => {
      this.logConsoleMessage('[IPC] Stop recording');
      this.stopRecording();
    });

    ipcMain.on('menu-playback-recording', async () => {
      this.logConsoleMessage('[IPC] Playback recording');
      await this.playRecording();
    });

    ipcMain.on('menu-preferences', () => {
      this.logConsoleMessage('[IPC] Preferences');
      this.showPreferencesDialog();
    });

    ipcMain.on('menu-quit', () => {
      this.logConsoleMessage('[IPC] Quit');
      app.quit();
    });

    // Edit menu handlers
    ipcMain.on('menu-find', () => {
      this.logConsoleMessage('[IPC] Find');
      // TODO: Implement find dialog
      this.showFindDialog();
    });

    ipcMain.on('menu-clear', () => {
      this.logConsoleMessage('[IPC] Clear terminal');
      this.clearTerminal();
    });

    // Window menu handlers
    ipcMain.on('menu-performance-monitor', () => {
      this.logConsoleMessage('[IPC] Performance monitor');
      this.showPerformanceMonitor();
    });

    ipcMain.on('menu-cascade', () => {
      this.logConsoleMessage('[IPC] Cascade windows');
      this.cascadeWindows();
    });

    ipcMain.on('menu-tile', () => {
      this.logConsoleMessage('[IPC] Tile windows');
      this.tileWindows();
    });

    ipcMain.on('menu-show-all', () => {
      this.logConsoleMessage('[IPC] Show all windows');
      this.showAllWindows();
    });

    ipcMain.on('menu-hide-all', () => {
      this.logConsoleMessage('[IPC] Hide all windows');
      this.hideAllWindows();
    });

    // Help menu handlers
    ipcMain.on('menu-documentation', () => {
      this.logConsoleMessage('[IPC] Documentation');
      this.showDocumentation();
    });

    // menu-about is handled by executeCommand

    this.logConsoleMessage('[IPC] All menu handlers registered');
  }

  /**
   * Initialize menu system programmatically after window loads
   * This avoids the data URL script execution restrictions
   */
  private initializeMenu(): void {
    if (!this.mainWindow) return;

    this.logConsoleMessage('[MENU] Starting programmatic menu initialization...');

    // Inject menu event handlers from main process
    this.mainWindow.webContents
      .executeJavaScript(
        `
      (function() {
        // console.log('[MENU] Programmatic menu setup starting...');

        const menuBar = document.getElementById('menu-bar');
        if (!menuBar) {
          console.error('[MENU] Menu bar element not found!');
          return;
        }

        // console.log('[MENU] Found menu bar, setting up handlers...');

        // Get all menu items
        const menuItems = document.querySelectorAll('.menu-item');
        // console.log('[MENU] Found ' + menuItems.length + ' menu items');

        // Add click handlers to menu items using CSS classes for state
        menuItems.forEach((item, index) => {
          // console.log('[MENU] Attaching handler to menu item ' + index + ': ' + item.textContent);

          item.addEventListener('click', (e) => {
            // console.log('[MENU] Menu item clicked: ' + item.textContent);
            e.stopPropagation();

            const dropdown = item.querySelector('.menu-dropdown');
            if (dropdown) {
              // Close all other dropdowns using CSS class
              document.querySelectorAll('.menu-dropdown.open').forEach(d => {
                if (d !== dropdown) {
                  d.classList.remove('open');
                }
              });

              // Toggle this dropdown using CSS class
              dropdown.classList.toggle('open');
              // console.log('[MENU] Dropdown toggled, open:', dropdown.classList.contains('open'));
            }
          });
        });

        // Add handlers for dropdown items
        const dropdownItems = document.querySelectorAll('.menu-dropdown-item');
        // console.log('[MENU] Found ' + dropdownItems.length + ' dropdown items');

        dropdownItems.forEach((item, index) => {
          const action = item.getAttribute('data-action');
          // console.log('[MENU] Attaching handler to dropdown item ' + index + ', action: ' + action);

          item.addEventListener('click', (e) => {
            // console.log('[MENU] Dropdown item clicked, action: ' + action);
            e.stopPropagation();

            // Close all dropdowns using CSS class
            document.querySelectorAll('.menu-dropdown.open').forEach(d => d.classList.remove('open'));

            // Handle the action
            if (action) {
              // For actions that don't need IPC, handle directly
              if (action === 'copy') {
                document.execCommand('copy');
              } else if (action === 'paste') {
                document.execCommand('paste');
              } else {
                // Send IPC message for other actions
                // Use require to get ipcRenderer directly
                try {
                  const { ipcRenderer } = require('electron');
                  // console.log('[MENU] Sending IPC message: ' + action);
                  ipcRenderer.send(action);
                } catch (err) {
                  console.error('[MENU] Failed to send IPC:', err);
                  // Note: If this fails, the menu action won't work
                  // All IPC must be set up in initial HTML, not injected code
                }
              }
            }
          });
        });

        // Close menu when clicking outside - fixed with event parameter
        document.addEventListener('click', (e) => {
          // Only close if click was outside menu system
          if (!e.target.closest('.menu-item')) {
            document.querySelectorAll('.menu-dropdown.open').forEach(d => d.classList.remove('open'));
          }
        });

        // console.log('[MENU] Menu initialization complete');
        return 'Menu initialized';
      })();
    `
      )
      .then((result: any) => {
        this.logConsoleMessage('[MENU] Menu injection result:', result);
      })
      .catch((error: any) => {
        console.error('[MENU] Failed to inject menu handlers:', error);
      });
  }

  private setupWindowHandlers(): void {
    // Inject JavaScript into the renderer process

    // Set up IPC handlers for toolbar events (both IDE and standard modes)
    this.mainWindow!.webContents.on('ipc-message', (event: any, channel: any, ...args: any[]) => {
      switch (channel) {
        case 'set-terminal-mode':
          const mode = args[0] as 'PST' | 'ANSI';
          this.terminalMode = mode;
          this.logMessage(`Terminal mode set to ${mode}`);
          // Clear terminal when switching modes
          this.safeExecuteJS(
            `
            (function() {
              const terminal = document.getElementById('pst-content');
              if (terminal) {
                terminal.innerHTML = '';
                terminal.dataset.cursorX = '0';
                terminal.dataset.cursorY = '0';
              }
            })();
          `,
            'clear terminal on mode switch'
          );
          break;
        case 'set-cog-display-mode':
          const cogMode = args[0] as 'show_all' | 'on_demand';
          const displayMode = cogMode === 'show_all' ? COGDisplayMode.SHOW_ALL : COGDisplayMode.ON_DEMAND;
          this.cogWindowManager.setMode(displayMode);
          this.logMessage(`COG display mode set to ${cogMode}`);
          break;
        case 'set-control-line-mode':
          const newControlLineMode = args[0] as 'DTR' | 'RTS';
          this.setControlLineMode(newControlLineMode);
          break;
        case 'toggle-echo':
          this.echoOffEnabled = args[0];
          this.logMessage(`Echo Off ${this.echoOffEnabled ? 'enabled' : 'disabled'} - filtering echoed characters`);
          if (!this.echoOffEnabled) {
            // Clear buffer when turning off
            this.recentTransmitBuffer = [];
          }
          break;
        // DTR/RTS toggles are handled by setupIPCHandlers() to avoid duplication
        // case 'toggle-dtr' and 'toggle-rts' removed from here
        case 'download-ram':
          this.setDownloadMode('ram');
          break;
        case 'download-flash':
          this.setDownloadMode('flash');
          break;
        case 'download-file':
          this.downloadFile();
          break;
        case 'toggle-recording':
          if (this.windowRouter.getRoutingStats().recordingActive) {
            this.stopRecording();
          } else {
            this.startRecording();
          }
          break;
        case 'play-recording':
          this.playRecording();
          break;
        case 'menu-preferences':
          this.showPreferencesDialog();
          break;
        case 'menu-about':
          this.showAboutDialog();
          break;
        case 'menu-check-updates':
          this.checkForUpdates();
          break;
        case 'menu-clear':
          this.clearTerminal();
          break;
        case 'menu-quit':
          app.quit();
          break;
        case 'menu-save-log':
          this.saveLogFile();
          break;
        case 'menu-debug-reference':
          this.showDebugCommandReference();
          break;
      }
    });

    // Set up IPC handlers for DTR/RTS control
    this.setupIPCHandlers();

    // Set up toolbar button event handlers and load settings
    this.mainWindow!.webContents.once('did-finish-load', () => {
      const isIdeMode = this.context.runEnvironment.ideMode;

      // DevTools removed - was causing MaxListenersExceededWarning
      // The warning was: "11 did-stop-loading listeners added to [WebContents]"
      // DevTools internally adds these listeners when opened
      // To debug, use View > Toggle Developer Tools menu instead

      // Initialize menu if in standalone mode
      if (!isIdeMode) {
        this.logConsoleMessage('[MENU] Injecting menu setup after window load...');
        this.initializeMenu();
      }

      // REMOVED: injectAllButtonHandlers() was overwriting good handlers with broken ones
      // All button handlers are now properly attached in DOMContentLoaded event
      // The executeJavaScript injection cannot access require('electron') since Electron v5.0.0
      // console.log('[BUTTON] Skipping button injection - handlers attached in DOMContentLoaded');

      // CRITICAL: Auto-create Debug Logger Window immediately on startup
      // This ensures logging starts immediately, not waiting for first message
      this.createLoggerWindow();

      // Load terminal mode setting after window is ready
      this.loadTerminalMode();

      // Measure actual font metrics now that window is ready
      this.measureAndStoreFontMetrics();

      // Initialize download mode LEDs after DOM is ready
      this.updateDownloadMode(this.downloadMode);

      // DTR/RTS button handlers are now attached in the initial HTML DOMContentLoaded handler
      // where ipcRenderer is available from require('electron')

      // Start performance monitoring now that DOM is ready
      this.startPerformanceMonitoring();
      this.logConsoleMessage('[PERF DISPLAY] Performance monitoring started after DOM ready');

      // Check if playback recordings exist and update playback controls state
      this.updatePlaybackControlsState();

      // Initialize activity LEDs to OFF state
      this.safeExecuteJS(
        `
        const txLed = document.getElementById('tx-led');
        const rxLed = document.getElementById('rx-led');
        if (txLed) {
          txLed.style.color = '#333';
          txLed.style.fontSize = '20px';
          txLed.style.textShadow = '0 0 2px #000';
        }
        if (rxLed) {
          rxLed.style.color = '#333';
          rxLed.style.fontSize = '20px';
          txLed.style.textShadow = '0 0 2px #000';
        }
      `,
        'initialize-activity-leds'
      );

      // Initialize serial connection after DOM is ready
      if (this._deviceNode.length > 0 && !this._serialPort) {
        this.openSerialPort(this._deviceNode);
      }

      // Initialize log LED to OFF state (logging now handled by DebugLogger)
      this.updateLoggingStatus(false);

      // Update status bar with device info
      if (this._deviceNode.length > 0) {
        this.updateStatusBarField('propPlug', this._deviceNode);
      }

      // Data entry input handler now attached in initial HTML DOMContentLoaded
      // (removed hookTextInputControl call - executeJavaScript cannot access require('electron'))

      // Check directory context after window is ready
      // Delay slightly to ensure window is fully visible
      setTimeout(() => {
        this.checkDirectoryContext();
      }, 1000);

      // Check serial port status after window loads - delayed to let async operations complete
      setTimeout(async () => {
        if (this._serialPort === undefined) {
          if (this._deviceNode.length > 0) {
            // Device was specified but connection failed
            this.appendLog(`⚠️ Waiting for serial port: ${this._deviceNode}`);
            this.appendLog(`   Try: File > Select PropPlug to choose a different device`);
          } else {
            // No device specified - check what's available
            try {
              const { UsbSerial } = require('../utils/usb.serial');
              const availableDevices = await UsbSerial.serialDeviceList();

              if (availableDevices.length === 0) {
                this.appendLog(`⚠️ No PropPlug devices found`);
                this.appendLog(`   • Connect your PropPlug device via USB`);
                this.appendLog(`   • Use File > Select PropPlug after connecting a device`);
                this.updateConnectionStatus(false);
                this.updateStatusBarField('propPlug', 'No devices found');
              } else if (availableDevices.length === 1) {
                // Single device found - should have been auto-selected
                const deviceInfo = availableDevices[0].split(',');
                const devicePath = deviceInfo[0];
                this.appendLog(`ℹ️ Found PropPlug device: ${devicePath}`);
                this.appendLog(`   Auto-connecting...`);
                this._deviceNode = devicePath;
                this.updateStatusBarField('propPlug', `${devicePath} (connecting...)`);
                await this.openSerialPort(devicePath);
              } else {
                // Multiple devices found
                this.appendLog(`⚠️ Multiple PropPlug devices found (${availableDevices.length} devices)`);
                this.appendLog(`   Available devices:`);
                availableDevices.forEach((device: any, index: any) => {
                  const devicePath = device.split(',')[0];
                  this.appendLog(`   ${index + 1}. ${devicePath}`);
                });
                this.appendLog(`   Use: File > Select PropPlug to choose a device`);
                this.appendLog(`   Or restart with: -p <device_path>`);
                this.updateConnectionStatus(false);
                this.updateStatusBarField('propPlug', `${availableDevices.length} devices found`);
              }
            } catch (error) {
              this.appendLog(`⚠️ Error scanning for devices: ${error}`);
              this.updateConnectionStatus(false);
              this.updateStatusBarField('propPlug', 'Error scanning');
            }
          }
        }
      }, 500);
    });
  }

  private createApplicationMenu(): void {
    this.logConsoleMessage('[MENU SETUP] Starting createApplicationMenu()');

    if (!Menu) {
      console.error('[MENU SETUP] ERROR: Menu is not available from Electron!');
      return;
    }

    // macOS only gets the system menu
    if (process.platform === 'darwin') {
      this.createMacSystemMenu();
      return;
    }

    // Windows/Linux: No system menu, will use HTML menu bar
    Menu.setApplicationMenu(null);
    this.logConsoleMessage('[MENU SETUP] No system menu for Windows/Linux - using HTML menu bar');
  }

  private createMacSystemMenu(): void {
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'PNut-Term-TS',
        submenu: [
          {
            label: 'About PNut-Term-TS',
            click: () => this.showAboutDialog()
          },
          {
            label: 'Check for Updates...',
            click: () => this.checkForUpdates()
          },
          { type: 'separator' },
          {
            label: 'Preferences...',
            accelerator: 'Cmd+,',
            click: () => this.showPreferencesDialog()
          },
          { type: 'separator' },
          {
            label: 'Hide PNut-Term-TS',
            accelerator: 'Cmd+H',
            role: 'hide'
          },
          {
            label: 'Hide Others',
            accelerator: 'Cmd+Option+H',
            role: 'hideOthers'
          },
          {
            label: 'Show All',
            role: 'unhide'
          },
          { type: 'separator' },
          {
            label: 'Quit PNut-Term-TS',
            accelerator: 'Cmd+Q',
            click: () => app.quit()
          }
        ]
      },
      // Standard Edit menu for Mac (Copy/Paste/etc)
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      // Standard Window menu for Mac
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'close' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
      }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
    this.logConsoleMessage('[MENU SETUP] ✅ macOS system menu set');
  }

  private createOldApplicationMenu(): void {
    // Keeping old menu code for reference - will be replaced by HTML menu bar
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'PNut Term TS',
        submenu: [
          {
            label: '&About...',
            click: () => {
              // show about dialog with runtime versions
              const nodeVersion = process.versions.node;
              const chromiumVersion = process.versions.chrome;
              const electronVersion = process.versions.electron;
              const args = process.argv.slice(2);
              const argsDisplay = args.length > 0 ? args.join(' ') : '(none)';
              const isIdeMode = this.context.runEnvironment.ideMode;
              const modeDisplay = isIdeMode ? 'IDE Mode (no menus)' : 'Standalone Mode';

              dialog.showMessageBox(this.mainWindow!, {
                type: 'info',
                title: 'About PNut Term TS',
                message: 'PNut Term TS\nVersion 1.0.0\n\nby Iron Sheep Productions, LLC',
                detail:
                  `Runtime Versions:\n` +
                  `Node.js: ${nodeVersion}\n` +
                  `Chromium: ${chromiumVersion}\n` +
                  `Electron: ${electronVersion}\n\n` +
                  `Mode: ${modeDisplay}\n` +
                  `Invocation: ${argsDisplay}`,
                buttons: ['OK']
              });
            }
          },
          { type: 'separator' },
          {
            label: '&Quit',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
              this.logConsoleMessage('MENU: Application is quitting...');
              this.knownClosedBy = true;
              app.quit();
            }
          }
        ]
      },
      // File menu removed - logging now handled by DebugLogger
      {
        label: 'Edit',
        submenu: [
          { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
          { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
          { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
          { type: 'separator' },
          { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
        ]
      },
      {
        label: 'Debug',
        submenu: [
          {
            label: 'Download to RAM',
            accelerator: 'CmdOrCtrl+R',
            click: () => this.downloadToRAM()
          },
          {
            label: 'Download to Flash',
            accelerator: 'CmdOrCtrl+F',
            click: () => this.downloadToFlash()
          },
          { type: 'separator' },
          {
            label: 'Toggle DTR',
            accelerator: 'CmdOrCtrl+D',
            click: () => this.toggleDTR()
          },
          {
            label: 'Toggle RTS',
            accelerator: 'CmdOrCtrl+R',
            click: () => this.toggleRTS()
          },
          { type: 'separator' },
          {
            label: 'Start Recording',
            accelerator: 'CmdOrCtrl+Shift+R',
            click: () => this.startRecording()
          },
          {
            label: 'Stop Recording',
            click: () => this.stopRecording()
          },
          {
            label: 'Play Recording...',
            accelerator: 'CmdOrCtrl+Shift+P',
            click: () => this.playRecording()
          }
        ]
      },
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Select Serial Port...',
            click: () => {
              const names = this.context.runEnvironment.serialPortDevices; // List of names
              dialog
                .showMessageBox(this.mainWindow!, {
                  type: 'question',
                  buttons: names,
                  title: 'Select Prop Plug',
                  message: 'Choose a lProp Plug:'
                })
                .then((response: any) => {
                  const propPlug: string = names[response.response];
                  this.context.runEnvironment.selectedPropPlug = propPlug;

                  // Update the status bar with the selected name
                  this.updateStatusBarField('propPlug', propPlug);
                })
                .catch((error: Error) => {
                  console.error('Failed to show plug select dialog:', error);
                });
            }
          },
          {
            label: 'Baud Rate...',
            click: () => this.selectBaudRate()
          },
          { type: 'separator' },
          {
            label: 'Settings...',
            accelerator: 'CmdOrCtrl+,',
            click: () => this.showPreferencesDialog()
          }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
          { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
          { type: 'separator' },
          { label: 'Bring All to Front', role: 'front' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation',
            click: () => {
              electron.shell.openExternal('https://github.com/parallaxinc/PNut-Term-TS');
            }
          },
          { type: 'separator' },
          {
            label: 'Debug Command Reference',
            click: () => this.showDebugCommandReference()
          }
        ]
      }
    ];

    // Old menu code - kept for reference when implementing HTML menu bar
  }

  private async showConnectionDialog(): Promise<void> {
    this.logConsoleMessage('[MENU] Showing connection dialog');

    // Get available serial ports using UsbSerial
    const deviceList = await UsbSerial.serialDeviceList(this.context);
    const portList = deviceList.map((device: string) => {
      // deviceList entries are "path,serialNumber" - split to get just the path
      const lineParts = device.split(',');
      const devicePath = lineParts[0];
      const serialNumber = lineParts[1] || 'unknown';
      return {
        label: `${devicePath} (SN: ${serialNumber})`,
        value: devicePath // Only the path, not the comma-separated string
      };
    });

    if (portList.length === 0) {
      dialog.showMessageBox(this.mainWindow!, {
        type: 'warning',
        title: 'No Serial Ports Found',
        message: 'No USB serial ports were detected.',
        detail: 'Please connect a Propeller device and try again.',
        buttons: ['OK']
      });
      return;
    }

    // UNUSED: HTML dialog code removed - using Electron dialog instead
    // If we need HTML dialogs in future, handlers must be in initial HTML script

    // Use Electron's built-in dialog
    const result = await dialog.showMessageBox(this.mainWindow!, {
      type: 'question',
      title: 'Connect to Serial Port',
      message: 'Select a serial port to connect:',
      detail: portList.map((p: any) => p.label).join('\n'),
      buttons: ['Cancel', ...portList.map((p: any) => p.label)],
      defaultId: 1
    });

    if (result.response > 0) {
      const selectedPort = portList[result.response - 1].value;
      this.logConsoleMessage('[MENU] Connecting to port:', selectedPort);
      await this.connectSerialPort(selectedPort);
    }
  }

  private async connectSerialPort(deviceNode: string): Promise<void> {
    this.logConsoleMessage('[MENU] Connecting to serial port:', deviceNode);

    // Disconnect any existing connection first
    if (this._serialPort) {
      await this.disconnectSerialPort();
    }

    // Open the serial port using existing method
    this._deviceNode = deviceNode;
    await this.openSerialPort(deviceNode);

    // Update UI to show connected state
    if (this._serialPort) {
      this.safeExecuteJS(
        `
        (function() {
          const propPlug = document.querySelector('#propPlug .status-value');
          if (propPlug) {
            propPlug.textContent = '${deviceNode}';
          }
        })();
      `,
        'update connect status'
      );
    }
  }

  private async disconnectSerialPort(): Promise<void> {
    this.logConsoleMessage('[MENU] Disconnecting serial port');

    if (this._serialPort) {
      try {
        await this._serialPort.close();
        this.logConsoleMessage('[SERIAL] Port closed successfully');

        this._serialPort = undefined;
        this.logMessage('Serial port disconnected');

        // Update UI to show disconnected state
        this.safeExecuteJS(
          `
          (function() {
            const propPlug = document.querySelector('#propPlug .status-value');
            if (propPlug) {
              propPlug.textContent = 'Disconnected';
            }
          })();
        `,
          'update disconnect status'
        );
      } catch (error) {
        console.error('[SERIAL] Failed to disconnect:', error);
      }
    } else {
      this.logConsoleMessage('[SERIAL] No port to disconnect');
    }
  }

  /**
   * Log complete display system configuration for debugging window placement
   */
  private logDisplaySystemConfiguration(): void {
    try {
      const { screen } = require('electron');

      this.logConsoleMessage('[DISPLAY SYSTEM] ========================================');
      this.logConsoleMessage('[DISPLAY SYSTEM] 🖥️  COMPLETE MONITOR CONFIGURATION');
      this.logConsoleMessage('[DISPLAY SYSTEM] ========================================');

      // Get all displays
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();

      this.logConsoleMessage(`[DISPLAY SYSTEM] 📊 Total Monitors: ${displays.length}`);
      this.logConsoleMessage(`[DISPLAY SYSTEM] 🎯 Primary Monitor ID: ${primaryDisplay.id}`);

      // Log each display in detail
      displays.forEach((display: any, index: number) => {
        const isPrimary = display.id === primaryDisplay.id;
        this.logConsoleMessage(
          `[DISPLAY SYSTEM] 📺 Monitor ${index + 1}${isPrimary ? ' (PRIMARY)' : ''}: ID=${display.id}`
        );
        this.logConsoleMessage(`[DISPLAY SYSTEM]    📐 Size: ${display.size.width}x${display.size.height}`);
        this.logConsoleMessage(`[DISPLAY SYSTEM]    🧮 Scale: ${display.scaleFactor}x`);
        this.logConsoleMessage(`[DISPLAY SYSTEM]    📍 Position: (${display.bounds.x}, ${display.bounds.y})`);
        this.logConsoleMessage(
          `[DISPLAY SYSTEM]    📏 Bounds: ${display.bounds.x},${display.bounds.y} → ${
            display.bounds.x + display.bounds.width
          },${display.bounds.y + display.bounds.height}`
        );
        this.logConsoleMessage(
          `[DISPLAY SYSTEM]    💼 Work Area: ${display.workArea.x},${display.workArea.y} → ${
            display.workArea.x + display.workArea.width
          },${display.workArea.y + display.workArea.height}`
        );
        this.logConsoleMessage(
          `[DISPLAY SYSTEM]    🎚️  Work Size: ${display.workArea.width}x${display.workArea.height}`
        );
        if (display.internal !== undefined) {
          this.logConsoleMessage(`[DISPLAY SYSTEM]    💻 Internal: ${display.internal}`);
        }
      });

      // Calculate total desktop area
      const totalBounds = {
        left: Math.min(...displays.map((d: any) => d.bounds.x)),
        top: Math.min(...displays.map((d: any) => d.bounds.y)),
        right: Math.max(...displays.map((d: any) => d.bounds.x + d.bounds.width)),
        bottom: Math.max(...displays.map((d: any) => d.bounds.y + d.bounds.height))
      };

      this.logConsoleMessage(`[DISPLAY SYSTEM] 🌐 Total Desktop Area:`);
      this.logConsoleMessage(
        `[DISPLAY SYSTEM]    📏 Bounds: (${totalBounds.left},${totalBounds.top}) → (${totalBounds.right},${totalBounds.bottom})`
      );
      this.logConsoleMessage(
        `[DISPLAY SYSTEM]    📐 Size: ${totalBounds.right - totalBounds.left}x${totalBounds.bottom - totalBounds.top}`
      );

      // Show where the cursor currently is
      const cursorPoint = screen.getCursorScreenPoint();
      const displayAtCursor = screen.getDisplayNearestPoint(cursorPoint);
      this.logConsoleMessage(
        `[DISPLAY SYSTEM] 🖱️  Cursor: (${cursorPoint.x}, ${cursorPoint.y}) on Monitor ID=${displayAtCursor.id}`
      );

      this.logConsoleMessage('[DISPLAY SYSTEM] ========================================');

      // Create grid test windows with delay for main window repositioning
      // console.log(`[GRID TEST] 🕐 Starting 3-second delay - MOVE MAIN WINDOW NOW if desired...`);
      // setTimeout(() => {
      //   this.createGridTestWindows();
      // }, 3000); // Wait 3 seconds - time to move main window
    } catch (error) {
      console.error('[DISPLAY SYSTEM] ❌ Failed to query display configuration:', error);
    }
  }

  /**
   * Create 4 small test windows in the corners of each monitor to verify coordinate mapping
   */
  private createGridTestWindows(): void {
    try {
      const { screen, BrowserWindow } = require('electron');

      // STEP 1: Query main window's current monitor (after potential user repositioning)
      const mainWindowBounds = this.mainWindow?.getBounds();
      if (!mainWindowBounds) {
        console.error('[GRID TEST] ❌ Cannot get main window bounds');
        return;
      }

      const currentDisplay = screen.getDisplayMatching(mainWindowBounds);
      const workArea = currentDisplay.workArea;

      this.logConsoleMessage('[GRID TEST] 🎯 Creating grid test windows...');
      this.logConsoleMessage(`[GRID TEST] 📺 Main window on Monitor ID=${currentDisplay.id}`);
      this.logConsoleMessage(
        `[GRID TEST]    Main bounds: (${mainWindowBounds.x}, ${mainWindowBounds.y}) ${mainWindowBounds.width}x${mainWindowBounds.height}`
      );
      this.logConsoleMessage(
        `[GRID TEST]    Monitor bounds: (${currentDisplay.bounds.x}, ${currentDisplay.bounds.y}) ${currentDisplay.bounds.width}x${currentDisplay.bounds.height}`
      );
      this.logConsoleMessage(
        `[GRID TEST]    Work area: (${workArea.x}, ${workArea.y}) ${workArea.width}x${workArea.height}`
      );

      // STEP 2: Calculate adaptive grid size for this monitor (same logic as WindowPlacer)
      const displayArea = workArea.width * workArea.height;
      let COLS: number, ROWS: number;

      if (displayArea > 3000000) {
        COLS = 5;
        ROWS = 4;
      } else if (displayArea > 1000000) {
        COLS = 5;
        ROWS = 3;
      } else if (displayArea > 500000) {
        COLS = 3;
        ROWS = 3;
      } else {
        COLS = 3;
        ROWS = 2;
      }

      // Aspect ratio adjustments
      const aspectRatio = workArea.width / workArea.height;
      if (aspectRatio > 2.0) COLS = Math.min(COLS + 2, 7);
      if (aspectRatio < 1.0) ROWS = Math.min(ROWS + 1, 5);
      if (COLS % 2 === 0) COLS += 1; // Prefer odd columns

      this.logConsoleMessage(`[GRID TEST] 📐 Calculated grid: ${COLS}x${ROWS} (${COLS * ROWS} total slots)`);
      this.logConsoleMessage(`[GRID TEST]    Display area: ${displayArea} pixels, aspect: ${aspectRatio.toFixed(2)}`);

      // STEP 3: Calculate grid cell dimensions
      const m = 20; // margin
      const colWidth = Math.round((workArea.width - m * 2) / COLS);
      const rowHeight = Math.round((workArea.height - m * 2) / ROWS);

      this.logConsoleMessage(`[GRID TEST] 📏 Cell size: ${colWidth}x${rowHeight} with ${m}px margins`);

      // STEP 4: Define test pattern - top row + edges + center column
      const testSlots = [];

      // Top row (all columns)
      for (let col = 0; col < COLS; col++) {
        testSlots.push({ row: 0, col, type: 'top-row' });
      }

      // Middle and bottom rows - edges + center column only
      const centerCol = Math.floor(COLS / 2);
      for (let row = 1; row < ROWS; row++) {
        testSlots.push({ row, col: 0, type: 'left-edge' }); // Left edge
        testSlots.push({ row, col: centerCol, type: 'center-col' }); // Center column
        testSlots.push({ row, col: COLS - 1, type: 'right-edge' }); // Right edge
      }

      this.logConsoleMessage(
        `[GRID TEST] 🎨 Test pattern: ${testSlots.length} windows (top-row + edges + center-column)`
      );
      this.logConsoleMessage(`[GRID TEST]    Center column: ${centerCol} (0-indexed)`);

      // STEP 5: Create test windows
      const colors = [
        '#ff6b6b',
        '#4ecdc4',
        '#45b7d1',
        '#96ceb4',
        '#feca57',
        '#ff9ff3',
        '#54a0ff',
        '#5f27cd',
        '#00d2d3',
        '#ff9f43',
        '#10ac84',
        '#ee5a52',
        '#0984e3',
        '#a29bfe',
        '#fd79a8'
      ];

      testSlots.forEach((slot, index) => {
        const slotNumber = slot.row * COLS + slot.col + 1;
        const color = colors[index % colors.length];

        // Calculate position using same logic as WindowPlacer
        const x = workArea.x + m + slot.col * colWidth;
        const y = workArea.y + m + slot.row * rowHeight;

        const label = `SLOT-${slotNumber.toString().padStart(2, '0')} (R${slot.row}C${slot.col})`;

        this.logConsoleMessage(`[GRID TEST] 🎯 ${label}: Creating at (${x}, ${y}) - ${slot.type}`);

        const testWindow = new BrowserWindow({
          width: 280,
          height: 120,
          x,
          y,
          title: `Grid Test - ${label}`,
          alwaysOnTop: true,
          frame: true,
          resizable: false,
          show: false,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
          }
        });

        // Create content with diagnostic info
        const html = `<html>
          <head><style>
            body { margin:0; padding:15px; background:${color}; color:white; font-family:monospace; font-size:12px; text-align:center; }
            .label { font-size:14px; font-weight:bold; margin-bottom:8px; }
            .coords { font-size:10px; color:#ddd; margin-top:8px; }
          </style></head>
          <body>
            <div class="label">${label}</div>
            <div>Monitor ID: ${currentDisplay.id}</div>
            <div>Type: ${slot.type}</div>
            <div class="coords">Target: (${x}, ${y})</div>
          </body>
        </html>`;

        // Load content and show window
        testWindow
          .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
          .then(() => {
            this.logConsoleMessage(`[GRID TEST] ✅ ${label}: Content loaded`);
          })
          .catch((error: any) => {
            console.error(`[GRID TEST] ❌ ${label}: Content load failed:`, error);
          });

        // DIAGNOSTIC LOGGING: Compare intended vs actual position
        testWindow.once('ready-to-show', () => {
          const actualBounds = testWindow.getBounds();
          const moved = actualBounds.x !== x || actualBounds.y !== y;
          const moveDistance = moved ? Math.sqrt(Math.pow(actualBounds.x - x, 2) + Math.pow(actualBounds.y - y, 2)) : 0;

          this.logConsoleMessage(`[GRID TEST] 📍 ${label}:`);
          this.logConsoleMessage(`[GRID TEST]    INTENDED: (${x}, ${y})`);
          this.logConsoleMessage(`[GRID TEST]    ACTUAL:   (${actualBounds.x}, ${actualBounds.y})`);
          this.logConsoleMessage(
            `[GRID TEST]    STATUS:   ${moved ? `❌ MOVED ${moveDistance.toFixed(0)}px` : '✅ CORRECT'}`
          );

          testWindow.show();
        });

        // Auto-close after 60 seconds
        setTimeout(() => {
          if (!testWindow.isDestroyed()) {
            testWindow.close();
          }
        }, 60000);
      });

      this.logConsoleMessage(`[GRID TEST] ⏰ ${testSlots.length} test windows created - will auto-close in 60 seconds`);
      this.logConsoleMessage(`[GRID TEST] 🔍 Watch logs for INTENDED vs ACTUAL position comparison`);
    } catch (error) {
      console.error('[GRID TEST] ❌ Failed to create grid test windows:', error);
    }
  }

  // Window management methods
  private cascadeWindows(): void {
    // TODO: Implement cascade window arrangement
    this.logConsoleMessage('[WINDOW] Cascade windows - not yet implemented');
  }

  private tileWindows(): void {
    // TODO: Implement tile window arrangement
    this.logConsoleMessage('[WINDOW] Tile windows - not yet implemented');
  }

  private showAllWindows(): void {
    // Show all debug windows
    const windows = this.windowRouter.getActiveWindows();
    this.logConsoleMessage(`[WINDOW] Showing ${windows.length} windows`);
    // TODO: Implement actual show functionality for each window
  }

  private hideAllWindows(): void {
    // Hide all debug windows except main
    const windows = this.windowRouter.getActiveWindows();
    this.logConsoleMessage(`[WINDOW] Hiding ${windows.length} windows`);
    // TODO: Implement actual hide functionality for each window
  }

  // Debug methods
  private openDebuggerWindow(cogId: number): void {
    this.logConsoleMessage(`[DEBUG] Opening debugger for COG ${cogId}`);
    // TODO: Create debugger window for specified COG
    const windowName = `p2debugger_cog${cogId}`;
    // For now, just log the request
    this.logConsoleMessage(`[DEBUG] Would create window: ${windowName} for COG ${cogId}`);
  }

  private breakAllCogs(): void {
    this.logConsoleMessage('[DEBUG] Breaking all COGs');
    // TODO: Send break command to all COG debuggers
  }

  private resumeAllCogs(): void {
    this.logConsoleMessage('[DEBUG] Resuming all COGs');
    // TODO: Send resume command to all COG debuggers
  }

  private showPerformanceMonitor(): void {
    this.logConsoleMessage('[PERF] Showing performance monitor');
    if (!this.performanceMonitor) {
      this.performanceMonitor = new PerformanceMonitor(this.mainWindow);
    }
    this.performanceMonitor.show();
  }

  private showDocumentation(): void {
    this.logConsoleMessage('[DOC] Showing documentation viewer');
    if (!this.documentationViewer) {
      this.documentationViewer = new DocumentationViewer(this.mainWindow);
    }
    this.documentationViewer.show();
  }

  private showFindDialog(): void {
    this.logConsoleMessage('[EDIT] Showing find dialog');
    // TODO: Implement find dialog for terminal
    // For now, use browser's built-in find
    if (this.mainWindow) {
      this.mainWindow.webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: 'F',
        modifiers: ['control']
      } as any);
    }
  }

  private clearTerminal(): void {
    this.safeExecuteJS(
      `
      (function() {
        const terminal = document.getElementById('pst-content');
        if (terminal) {
          terminal.innerHTML = '';
          terminal.dataset.cursorX = '0';
          terminal.dataset.cursorY = '0';
        }
      })();
    `,
      'clear terminal'
    );
  }

  private saveLogFile(): void {
    const { dialog, fs } = require('electron');
    // TODO: Implement save log file dialog
    this.logConsoleMessage('Save log file - to be implemented');
  }

  private showAboutDialog(): void {
    const { dialog } = require('electron');
    const packageJson = require('../../package.json');

    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'About PNut-Term-TS',
      message: 'PNut-Term-TS',
      detail:
        `Version: ${packageJson.version}\n` +
        `Electron: ${process.versions.electron}\n` +
        `Node: ${process.versions.node}\n` +
        `Chrome: ${process.versions.chrome}\n\n` +
        `Cross-platform debug terminal for\n` +
        `Parallax Propeller 2 microcontroller\n\n` +
        `© 2024 Iron Sheep Productions LLC\n` +
        `Licensed under MIT`,
      buttons: ['OK'],
      icon: null // Will use app icon
    });
  }

  private async checkForUpdates(): Promise<void> {
    const { dialog, shell } = require('electron');
    const https = require('https');
    const packageJson = require('../../package.json');
    const currentVersion = packageJson.version;

    try {
      // Check GitHub releases API using https module
      const data = await new Promise<string>((resolve, reject) => {
        https
          .get(
            'https://api.github.com/repos/parallaxinc/PNut-Term-TS/releases/latest',
            {
              headers: {
                'User-Agent': 'PNut-Term-TS'
              }
            },
            (res: any) => {
              let data = '';
              res.on('data', (chunk: any) => (data += chunk));
              res.on('end', () => resolve(data));
            }
          )
          .on('error', reject);
      });

      const latestRelease = JSON.parse(data);
      const latestVersion = latestRelease.tag_name.replace(/^v/, '');

      // Simple version comparison (you might want to use semver for proper comparison)
      if (latestVersion > currentVersion) {
        const result = await dialog.showMessageBox(this.mainWindow!, {
          type: 'info',
          title: 'Update Available',
          message: `A new version of PNut-Term-TS is available`,
          detail: `Current version: ${currentVersion}\nLatest version: ${latestVersion}\n\nWould you like to download it?`,
          buttons: ['Download', 'Later'],
          defaultId: 0
        });

        if (result.response === 0) {
          shell.openExternal(latestRelease.html_url);
        }
      } else {
        dialog.showMessageBox(this.mainWindow!, {
          type: 'info',
          title: 'No Updates',
          message: 'You have the latest version',
          detail: `PNut-Term-TS v${currentVersion} is up to date`,
          buttons: ['OK']
        });
      }
    } catch (error) {
      dialog.showMessageBox(this.mainWindow!, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Could not check for updates',
        detail: 'Please check your internet connection and try again later',
        buttons: ['OK']
      });
    }
  }

  private setupApplicationMenu(): void {
    // This method is called from createAppWindow() and sets up the menu
    try {
      this.createApplicationMenu();
    } catch (error) {
      console.error('[MENU SETUP] ERROR in setupApplicationMenu:', error);
      // Don't crash the app if menu setup fails
    }

    this.updateStatus(); // set initial values

    // REMOVED: Duplicate did-finish-load handler eliminated to fix race condition
    // All DOM initialization now consolidated in single handler above (line ~2248)

    this.mainWindow!.on('close', (event: any) => {
      // CRITICAL: Set shutdown flags IMMEDIATELY when close begins
      // This prevents serial data from being processed during shutdown
      this.isShuttingDown = true;
      this.windowRouter.setShuttingDown(true);
      if (this._serialPort) {
        this._serialPort.setShuttingDown(true);
        this._serialPort.removeAllListeners('data');
        this._serialPort.removeAllListeners('error');
        this._serialPort.removeAllListeners('close');
      }

      if (!this.knownClosedBy) {
        this.logMessage('[x]: Application is quitting...[close]');
      }

      // Only delay in console mode
      if (this.context.runEnvironment.consoleMode) {
        // Prevent immediate close to allow reading console messages
        event.preventDefault();

        // Close all debug windows first
        this.closeAllDebugWindows();

        // Show closing message and wait 2 seconds before actually closing
        this.logConsoleMessage('============================================');
        this.logConsoleMessage('Closing application - waiting for logs to flush...');
        this.logConsoleMessage('============================================');

        setTimeout(() => {
          this.logConsoleMessage('✅ COMPLETE - Application closed');
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.destroy();
          }
        }, 6000); // 6 second delay (3x original)
      } else {
        // Normal close without delay
        this.closeAllDebugWindows();
      }
    });

    this.mainWindow!.on('closed', () => {
      this.logMessage('* Main window [closed]');
      this.mainWindow = null;
      this.mainWindowOpen = false;
      // Force quit on macOS when main window is closed
      if (process.platform === 'darwin') {
        app.quit();
      }
    });
  }

  // Method to close all debug windows
  private closeAllDebugWindows(): void {
    // Stop performance monitoring
    this.stopPerformanceMonitoring();

    // step usb receiver
    this.mainWindow?.removeAllListeners();
    // flush one last time in case there are any left
    this.flushLogBuffer(); // will do nothing if buffer is empty
    // shut down any active displays
    const displayEntries = Object.entries(this.displays);
    displayEntries.forEach(([windowName, windowObject]) => {
      this.logMessage(`* closeAllDebugWindows() - Closing window: ${windowName}`);
      const window: DebugWindowBase = windowObject as DebugWindowBase;
      window.closeDebugWindow();
    });
    this.displays = {}; // and empty the list
  }

  private setKnownClosedBy() {
    this.knownClosedBy = true;
  }

  private getRuntimeVersions() {
    // Get invocation parameters
    const args = process.argv.slice(2); // Skip 'node' and script path
    const argsDisplay = args.length > 0 ? args.join(' ') : 'None';
    const isIdeMode = this.context.runEnvironment.ideMode;
    const modeDisplay = isIdeMode ? 'IDE Mode (no menus)' : 'Standalone Mode';

    this.safeExecuteJS(
      `
      const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
      }

      // Update runtime versions
      for (const type of ['chrome', 'node', 'electron']) {
        replaceText(\`\${type}-version\`, process.versions[type]);
      }

      // Update invocation parameters and mode
      replaceText('invocation-params', '${argsDisplay.replace(/'/g, "\\'")}');
      replaceText('app-mode', '${modeDisplay}');
    `,
      'update runtime versions and params'
    );
  }

  private updateStatusBarField(fieldId: string, value: string) {
    if (this.mainWindow) {
      this.safeExecuteJS(
        `document.getElementById("${fieldId}").querySelector('.status-value').innerText = "${value}";`,
        `updateStatusBarField-${fieldId}`
      );
    }
  }

  private updateStatus() {
    // Status update no longer needed - line count removed from status bar
    // Keeping method stub in case other status updates needed in future
  }

  private async getFontMetrics(
    fontSpec: string,
    defaultCharWidth: number = 12,
    defaultCharHeight: number = 12
  ): Promise<{ charWidth: number; charHeight: number }> {
    let charWidth = defaultCharWidth;
    let charHeight = defaultCharHeight;
    if (this.mainWindow) {
      const metrics = await this.safeExecuteJS(
        `
        (function() {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          context.font = \'${fontSpec}\'; // Set the font to match the one used in the app

          // Measure the width and height of a single character
          const metrics = context.measureText('M');
          const charWidth = metrics.width;
          const actualBoundingBoxAscent = metrics.actualBoundingBoxAscent || 0;
          const actualBoundingBoxDescent = metrics.actualBoundingBoxDescent || 0;
          const charHeight = actualBoundingBoxAscent + actualBoundingBoxDescent;

          return { charWidth, charHeight };
        })();
      `,
        'getFontMetrics'
      );

      if (metrics) {
        // Override defaults with measured values
        charWidth = metrics.charWidth;
        charHeight = metrics.charHeight;
      }
    } else {
      console.error('ERROR: getFontMetrics() NO Main Window!');
    }
    //console.error(`* getFontMetrics() -> (${charWidth}x${charHeight})`);
    return { charWidth, charHeight }; // Default values
  }

  private async measureAndStoreFontMetrics(): Promise<void> {
    try {
      const { charWidth, charHeight } = await this.getFontMetrics('12pt Consolas, sans-serif', 12, 18);
      this.logConsoleMessage(`[FONT METRICS] Measured after window ready: ${charWidth} x ${charHeight}`);

      // Store for future use - could be used for dynamic window sizing
      // For now, just log the actual measurements
      // TODO: Could implement window resize if metrics differ significantly from defaults
    } catch (error) {
      console.error('[FONT METRICS] Error measuring fonts after window load:', error);
    }
  }

  private hookTextInputControl(inputId: string): void {
    if (this.mainWindow) {
      // Inject JavaScript into the renderer process to handle keyboard input
      this.safeExecuteJS(
        `
        (function() {
          const inputElement = document.getElementById('${inputId}');
          if (inputElement) {
            // Handle keydown event for immediate character transmission
            inputElement.addEventListener('keydown', function(event) {
              if (event.key === 'Enter') {
                // Send the current input value plus carriage return
                const data = inputElement.value + '\\r';
                if (window.electronAPI && window.electronAPI.sendSerialData) {
                  window.electronAPI.sendSerialData(data);
                  console.log('[TERMINAL] Sent to P2:', JSON.stringify(data));
                } else if (window.ipcRenderer) {
                  window.ipcRenderer.send('send-serial-data', data);
                  console.log('[TERMINAL] Sent to P2:', JSON.stringify(data));
                }
                // Clear the input field after sending
                inputElement.value = '';
                event.preventDefault();
              }
            });

            // Focus the input element when clicked or when window is active
            inputElement.addEventListener('click', function() {
              inputElement.focus();
            });

            // Auto-focus on page load
            inputElement.focus();

            console.log('[TERMINAL] Input control hooked for element: ${inputId}');
          } else {
            console.error('Input element with id "${inputId}" not found.');
          }
        })();
      `,
        `hookInputControl-${inputId}`
      );
    }
  }

  /*
  // ----------------------------------------------------------------------
  //   this didin't work but it is a good example of how to buffer log messages?
  // ----------------------------------------------------------------------
  private logBuffer: string[] = [];
  private logBufferTimeout: NodeJS.Timeout | null = null;
  private FLUSH_INERVAL_MS: number = 100; // Adjust the timeout as needed

  private appendLog(message: string) {
    // Add the message to the buffer
    this.logBuffer.push(message);

    // If there is no timeout set, set one to process the buffer
    if (this.logBufferTimeout == null) {
      this.logBufferTimeout = setTimeout(() => {
        this.flushLogBuffer();
      }, this.FLUSH_INERVAL_MS);
    }

    // Logging now handled by DebugLogger
  }

  private flushLogBuffer() {
    if (this.logBuffer.length > 0) {
      const messages = this.logBuffer.join('\n');
      this.safeExecuteJS(`
        (function() {
          const logContent = document.getElementById('pst-content');
          const p = document.createElement('p');
          p.textContent = "${messages.replace(/"/g, '\\"')}";
          logContent.appendChild(p);
          logContent.scrollTop = logContent.scrollHeight;
        })();
      `, 'flush log buffer');
      this.logBuffer = [];
      this.logBufferTimeout = null;
    }
  }

  // ----------------------------------------------------------------------
  */

  private appendLogOld(message: string) {
    this.safeExecuteJS(
      `
      (function() {
        const logContent = document.getElementById('pst-content');
        const p = document.createElement('p');
        p.textContent = "${message}";
        logContent.appendChild(p);
        logContent.scrollTop = logContent.scrollHeight;
      })();
    `,
      'append log message'
    );

    // Logging now handled by DebugLogger
  }

  private PEND_MESSAGE_COUNT: number = 100;

  // ======================================================================
  // PST (Propeller Serial Terminal) Output System
  // Handles P2 terminal output with PST control codes and ANSI sequences
  // ======================================================================

  private pstBuffer: string[] = [];
  private pstBufferTimer: NodeJS.Timeout | null = null;
  private readonly MAX_PST_BUFFER: number = 1000; // Safety valve
  private readonly PST_FLUSH_TIMEOUT_MS: number = 100; // Flush partial lines after 100ms

  /**
   * Append P2 terminal output to PST buffer
   * PUBLIC - Called by WindowRouter for TERMINAL_OUTPUT messages
   */
  public appendToTerminal(message: string): void {
    this.pstBuffer.push(message);

    // Primary flush trigger: EOL detected (CR, LF, CRLF, LFCR)
    const hasEOL = /[\r\n]/.test(message);

    // Safety valve: prevent runaway buffer
    const hitSafetyLimit = this.pstBuffer.length >= this.MAX_PST_BUFFER;

    if (hasEOL || hitSafetyLimit) {
      // Clear any pending timeout
      if (this.pstBufferTimer) {
        clearTimeout(this.pstBufferTimer);
        this.pstBufferTimer = null;
      }
      this.flushPSTBuffer();
    } else {
      // Timeout flush: catch partial lines after 100ms of no new data
      if (this.pstBufferTimer) {
        clearTimeout(this.pstBufferTimer);
      }
      this.pstBufferTimer = setTimeout(() => {
        this.pstBufferTimer = null;
        this.flushPSTBuffer();
      }, this.PST_FLUSH_TIMEOUT_MS);
    }
  }

  /**
   * Flush PST buffer - Process PST control codes and display text
   * Handles PST control characters (0x01-0x10) and ANSI sequences
   */
  private flushPSTBuffer(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.pstBuffer.length > 0) {
      // PST Control Characters:
      //   0x01 - HM: Home
      //   0x02,x,y - PC: Cursor to x,y
      //   0x03 - ML: Cursor Left
      //   0x04 - MR: Cursor Right
      //   0x05 - MU: Cursor Up
      //   0x06 - MD: Cursor Down
      //   0x07 - BP: Bell (beep speaker)
      //   0x08 - BS: Backspace
      //   0x09 - TB: Horizontal Tab
      //   0x0A - LF: Line Feed
      //   0x0B - CE: Clear to EOL
      //   0x0C - CB: Clear lines below
      //   0x0D - NL: Carriage Return
      //   0x0E,x - PX: Set Cursor to x
      //   0x0F,y - PY: Set Cursor to y
      //   0x10 - CS: Clear Screen

      // Check if any string in the pstBuffer contains control characters
      const hasControlChars = this.pstBuffer.some((currString) => /[\x01-\x10]/.test(currString));
      if (hasControlChars) {
        // Handle each string individually, processing control codes
        for (let index = 0; index < this.pstBuffer.length; index++) {
          const currLine: string = this.pstBuffer[index];
          // Process control characters in order, emitting non-control characters as we go
          // Control chars 0x02, 0x0E and 0x0F require x,y or x or y (next byte(s) in the string)
          let nonControlChars: string = '';
          let i = 0;
          while (i < currLine.length) {
            const charCode = currLine.charCodeAt(i);
            let x: number = 0;
            let y: number = 0;
            // Check if the character is a PST control character
            if (charCode >= 1 && charCode <= 16) {
              // First, emit any accumulated non-control characters
              if (nonControlChars.length > 0) {
                this.emitPSTStrings([nonControlChars]);
                nonControlChars = ''; // reset for next round
              }
              // Process PST control character
              switch (charCode) {
                case 1:
                  // HM: Home - Move cursor to position (0,0)
                  this.executePSTCommand('home');
                  break;
                case 2:
                  // PC: Position Cursor to x,y
                  x = currLine.charCodeAt(++i);
                  y = currLine.charCodeAt(++i);
                  this.executePSTCommand('position', x, y);
                  break;
                case 3:
                  // ML: Move Left
                  this.executePSTCommand('left');
                  break;
                case 4:
                  // MR: Move Right
                  this.executePSTCommand('right');
                  break;
                case 5:
                  // MU: Move Up
                  this.executePSTCommand('up');
                  break;
                case 6:
                  // MD: Move Down
                  this.executePSTCommand('down');
                  break;
                case 7:
                  // BP: Bell (beep speaker)
                  this.executePSTCommand('bell');
                  break;
                case 8:
                  // BS: Backspace
                  this.executePSTCommand('backspace');
                  break;
                case 9:
                  // TB: Horizontal Tab
                  this.executePSTCommand('tab');
                  break;
                case 10:
                  // LF: Line Feed
                  this.executePSTCommand('linefeed');
                  break;
                case 11:
                  // CE: Clear to End of Line
                  this.executePSTCommand('clearEOL');
                  break;
                case 12:
                  // CB: Clear lines Below
                  this.executePSTCommand('clearBelow');
                  break;
                case 13:
                  // NL: New Line (Carriage Return)
                  this.executePSTCommand('newline');
                  break;
                case 14:
                  // PX: Position cursor X (next byte)
                  x = currLine.charCodeAt(++i);
                  this.executePSTCommand('positionX', x);
                  break;
                case 15:
                  // PY: Position cursor Y (next byte)
                  y = currLine.charCodeAt(++i);
                  this.executePSTCommand('positionY', y);
                  break;
                case 16:
                  // CS: Clear Screen
                  this.executePSTCommand('clearScreen');
                  break;
              }
            } else {
              // Non-control character - accumulate for display
              nonControlChars = `${nonControlChars}${currLine[i]}`;
            }
            i++;
          }
          // Emit any remaining non-control characters
          if (nonControlChars.length > 0) {
            this.emitPSTStrings([nonControlChars]);
          }
        }
      } else {
        // No control characters - just display the buffer directly
        this.emitPSTStrings(this.pstBuffer);
      }
      // Clear buffer after processing
      this.pstBuffer = [];
    }
  }

  // ======================================================================
  // Diagnostic Logging (Application Status Messages)
  // ======================================================================

  private appendLog(message: string) {
    this.logConsoleMessage(`[APPEND_LOG] 📝 Called with message: "${message}" (${message.length} chars)`);
    if (this.mainWindow) {
      this.logConsoleMessage(`[APPEND_LOG] ✅ mainWindow exists, adding to buffer`);
      this.logBuffer.push(message);
      this.logConsoleMessage(
        `[APPEND_LOG] Buffer size: ${this.logBuffer.length}, PEND_MESSAGE_COUNT: ${this.PEND_MESSAGE_COUNT}`
      );
      if (this.logBuffer.length > this.PEND_MESSAGE_COUNT || this.immediateLog) {
        this.logConsoleMessage(
          `[APPEND_LOG] 🚀 Triggering flush (buffer=${this.logBuffer.length}, immediate=${this.immediateLog})`
        );
        this.flushLogBuffer();
      }
    } else {
      this.logConsoleMessage(`[APPEND_LOG] ❌ mainWindow is null/undefined, message dropped!`);
    }
    // Logging now handled by DebugLogger
  }

  private logBuffer: string[] = [];

  private flushLogBuffer() {
    this.logConsoleMessage(`[DIAG FLUSH] 🌊 flushLogBuffer called, buffer size: ${this.logBuffer.length}`);
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.logBuffer.length > 0) {
      this.logConsoleMessage(`[DIAG FLUSH] ✅ Window valid, emitting ${this.logBuffer.length} diagnostic messages`);
      // Simple diagnostic message output - no PST control code processing
      // PST control codes are only processed in flushPSTBuffer() for P2 terminal output
      this.emitDiagnosticStrings(this.logBuffer);
      this.logBuffer = [];
      this.updateStatus();
    }
  }

  private emitDiagnosticStrings(buffer: string[]) {
    this.logConsoleMessage(`[DIAG EMIT] 📤 emitDiagnosticStrings called with ${buffer.length} messages`);
    if (buffer.length > 0) {
      this.logConsoleMessage(`[DIAG EMIT] Diagnostic messages to display: ${JSON.stringify(buffer)}`);
      const messages = JSON.stringify(buffer);
      this.safeExecuteJS(
        `
        (function() {
          const pstContent = document.getElementById('pst-content');
          const messagesArray = ${messages};  // Parse the JSON string to get the array
          messagesArray.forEach(message => {
            const p = document.createElement('p');
            p.textContent = message;
            pstContent.appendChild(p);
          });
          pstContent.scrollTop = pstContent.scrollHeight;
        })();
      `,
        'emit diagnostic strings to terminal'
      );
    }
  }

  private emitPSTStrings(buffer: string[]) {
    this.logConsoleMessage(`[PST EMIT] 📤 emitPSTStrings called with ${buffer.length} messages`);
    if (buffer.length > 0) {
      this.logConsoleMessage(`[PST EMIT] Messages to display: ${JSON.stringify(buffer)}`);
      const messages = JSON.stringify(buffer);
      this.safeExecuteJS(
        `
        (function() {
          const pstContent = document.getElementById('pst-content');
          const messagesArray = ${messages};  // Parse the JSON string to get the array
          messagesArray.forEach(message => {
            const p = document.createElement('p');
            p.textContent = message;
            pstContent.appendChild(p);
          });
          pstContent.scrollTop = pstContent.scrollHeight;
        })();
      `,
        'emit PST strings to terminal'
      );
    }
  }

  // Method to append a message to an existing file
  private appendToFile(filePath: string, message: string) {
    fs.appendFile(filePath, message, (err) => {
      if (err) {
        console.error('Failed to append to file:', err);
      }
    });
  }

  // ----------------------------------------------------------------------

  private logMessage(message: string): void {
    if (this.context.runEnvironment.loggingEnabled) {
      // Terminal system messages should go to console, not Debug Logger window
      // These are startup diagnostics, not P2 serial data
      this.context.logger.forceLogMessage('Tmnl: ' + message);
    }
  }

  /**
   * Update Active COGs display in status bar
   */
  private updateActiveCogs(activeCogs: number[]): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    const displayText = activeCogs.length > 0 ? activeCogs.join(',') : 'None';

    // Update the status bar UI
    this.mainWindow.webContents
      .executeJavaScript(
        `
      (function() {
        const cogsStatus = document.getElementById('cogs-status');
        if (cogsStatus) {
          cogsStatus.textContent = '${displayText}';
          // console.log('[COG STATUS] Updated Active COGs display: ${displayText}');
        } else {
          console.warn('[COG STATUS] cogs-status element not found in DOM');
        }
      })();
    `
      )
      .catch((error: any) => {
        console.error('[COG STATUS] Error updating Active COGs display:', error);
      });
  }

  /**
   * Start performance monitoring for status bar
   */
  private startPerformanceMonitoring(): void {
    if (this.performanceUpdateTimer) {
      return; // Already running
    }

    // Verify DOM elements exist before starting monitoring
    this.verifyPerformanceElementsReady().then((ready) => {
      if (ready) {
        this.performanceUpdateTimer = setInterval(() => {
          this.updatePerformanceDisplay();
        }, this.PERFORMANCE_UPDATE_INTERVAL);
        this.logConsoleMessage('[PERF DISPLAY] Performance monitoring timer started');
      } else {
        console.warn('[PERF DISPLAY] Performance elements not ready, retrying in 500ms...');
        setTimeout(() => this.startPerformanceMonitoring(), 500);
      }
    });
  }

  /**
   * Verify that performance monitoring can proceed (performance monitor dialog handles display)
   */
  private async verifyPerformanceElementsReady(): Promise<boolean> {
    // Performance metrics now handled by Performance Monitor dialog
    // Just verify window is ready
    return !!(this.mainWindow && !this.mainWindow.isDestroyed());
  }

  /**
   * Stop performance monitoring
   */
  private stopPerformanceMonitoring(): void {
    if (this.performanceUpdateTimer) {
      clearInterval(this.performanceUpdateTimer);
      this.performanceUpdateTimer = null;
    }
    if (this.performanceFlashTimer) {
      clearTimeout(this.performanceFlashTimer);
      this.performanceFlashTimer = null;
    }
  }

  /**
   * Update performance display in status bar
   */
  private updatePerformanceDisplay(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    try {
      // Get performance snapshot from serial processor
      const stats = this.serialProcessor.getStats();
      const perfSnapshot = stats.performance;

      if (!perfSnapshot) {
        return;
      }

      // Calculate metrics
      const throughputKbps = (perfSnapshot.metrics.throughput.bytesPerSecond / 1024).toFixed(1);
      const bufferUsage = perfSnapshot.metrics.bufferUsagePercent.toFixed(0);

      // Get queue depths (sum of all queues)
      let totalQueueDepth = 0;
      for (const [name, queueStats] of Object.entries(perfSnapshot.metrics.queues)) {
        if (queueStats && typeof queueStats === 'object' && 'currentDepth' in queueStats) {
          totalQueueDepth += (queueStats as any).currentDepth || 0;
        }
      }

      // Determine performance state based on metrics
      let newState: 'normal' | 'warning' | 'critical' | 'error' = 'normal';
      let statusSymbol = '✓';
      let indicatorColor = '#00FF00'; // Green

      // Buffer usage thresholds
      if (perfSnapshot.metrics.bufferUsagePercent >= 95) {
        newState = 'error';
        statusSymbol = '⚠';
        indicatorColor = '#FF0000'; // Red
      } else if (perfSnapshot.metrics.bufferUsagePercent >= 80) {
        newState = 'critical';
        statusSymbol = '!';
        indicatorColor = '#FF8000'; // Orange
      } else if (perfSnapshot.metrics.bufferUsagePercent >= 60 || totalQueueDepth >= 100) {
        newState = 'warning';
        statusSymbol = '~';
        indicatorColor = '#FFFF00'; // Yellow
      }

      // Queue depth thresholds
      if (totalQueueDepth >= 500) {
        newState = 'error';
        statusSymbol = '⚠';
        indicatorColor = '#FF0000'; // Red
      } else if (totalQueueDepth >= 200) {
        if (newState === 'normal') {
          newState = 'critical';
          statusSymbol = '!';
          indicatorColor = '#FF8000'; // Orange
        }
      }

      // Check for data loss events
      if (perfSnapshot.metrics.events.bufferOverflows > 0 || perfSnapshot.metrics.events.queueOverflows > 0) {
        newState = 'error';
        statusSymbol = '✗';
        indicatorColor = '#FF0000'; // Red
      }

      // Performance metrics now only go to Performance Monitor dialog
      // Status bar no longer displays performance metrics

      // Flash indicator on state change (for performance monitor only)
      if (newState !== this.lastPerformanceState) {
        this.lastPerformanceState = newState;
      }

      // Status bar update removed - metrics now only in Performance Monitor
      // const metricsText = `${throughputKbps}kb/s | Buffer: ${bufferUsage}% | Queue: ${totalQueueDepth} | ${statusSymbol}`;

      // Update performance monitor if open
      if (this.performanceMonitor) {
        const routingStats = this.windowRouter.getRoutingStats();
        this.performanceMonitor.updateMetrics({
          throughput: parseFloat(throughputKbps),
          bufferUsage: perfSnapshot.metrics.bufferUsagePercent,
          queueDepth: totalQueueDepth,
          status: statusSymbol,
          bufferSize: stats.workerExtractor?.bufferStats?.size || 0,
          bufferUsed: stats.workerExtractor?.bufferStats?.used || 0,
          bufferAvailable: stats.workerExtractor?.bufferStats?.available || 0,
          highWaterMark: stats.workerExtractor?.bufferStats?.highWaterMark || 0,
          overflowEvents: stats.workerExtractor?.bufferOverflows || 0,
          totalMessages: routingStats.messagesRouted,
          messagesPerSecond: perfSnapshot.metrics.throughput.messagesPerSecond || 0,
          recordingActive: routingStats.recordingActive,
          recordingSize: 0, // TODO: Get actual recording size when implemented
          parseErrors: routingStats.errors,
          activeWindows: this.windowRouter.getActiveWindows().map((w) => ({
            name: `${w.windowType} (${w.windowId})`,
            queueDepth: 0 // TODO: Get queue depth per window when available
          }))
        });
      }
    } catch (error) {
      console.error('[PERF DISPLAY] Error in updatePerformanceDisplay:', error);
    }
  }

  // Flash performance indicator removed - now handled by Performance Monitor dialog

  // Terminal mode tracking
  private terminalMode: 'PST' | 'ANSI' = 'PST';
  private cursorX: number = 0;
  private cursorY: number = 0;
  private terminalWidth: number = 80;
  private terminalHeight: number = 25;

  private loadTerminalMode(): void {
    // Pass the current terminal mode values directly from the main process
    // No need for localStorage since we already have these values
    const currentMode = this.terminalMode || 'PST';
    const currentControlLine = this.controlLineMode || 'DTR';

    this.safeExecuteJS(
      `
      (function() {
        const mode = '${currentMode}';
        const controlLine = '${currentControlLine}';
        // console.log('[TERMINAL MODE] Using terminal mode values from main process:', { mode, controlLine });
        return { mode, controlLine };
      })();
    `,
      'load terminal mode'
    )
      .then((result) => {
        if (result && typeof result === 'object') {
          this.terminalMode = result.mode as 'PST' | 'ANSI';
          this.controlLineMode = result.controlLine as 'DTR' | 'RTS';
          this.logMessage(`Terminal mode loaded: ${this.terminalMode}`);
          this.logMessage(`Control line mode: ${this.controlLineMode}`);

          // Update UI to show correct control line
          if (this.controlLineMode !== 'DTR') {
            this.updateControlLineUI();
          }
        } else {
          // Fallback if script execution failed completely
          console.warn('[TERMINAL MODE] Script execution failed, using fallback defaults');
          this.terminalMode = 'PST';
          this.controlLineMode = 'DTR';
          this.logMessage(`Terminal mode set to fallback defaults: ${this.terminalMode}, ${this.controlLineMode}`);
        }
      })
      .catch((error) => {
        console.error('[TERMINAL MODE] safeExecuteJS failed:', error);
        // Ultimate fallback
        this.terminalMode = 'PST';
        this.controlLineMode = 'DTR';
        this.logMessage(`Terminal mode set to ultimate fallback: ${this.terminalMode}, ${this.controlLineMode}`);
      });
  }

  // Execute PST control commands
  private executePSTCommand(command: string, arg1?: number, arg2?: number): void {
    if (this.terminalMode !== 'PST') {
      return; // Only execute PST commands in PST mode
    }

    switch (command) {
      case 'home':
        this.cursorX = 0;
        this.cursorY = 0;
        this.safeExecuteJS(
          `
          (function() {
            const terminal = document.getElementById('pst-content');
            if (terminal) {
              terminal.dataset.cursorX = '0';
              terminal.dataset.cursorY = '0';
              // Move cursor to home position
              const cursor = document.getElementById('terminal-cursor');
              if (cursor) {
                cursor.style.left = '0px';
                cursor.style.top = '0px';
              }
            }
          })();
        `,
          'PST home command'
        );
        break;

      case 'position':
        if (arg1 !== undefined && arg2 !== undefined) {
          this.cursorX = Math.min(arg1, this.terminalWidth - 1);
          this.cursorY = Math.min(arg2, this.terminalHeight - 1);
          this.safeExecuteJS(
            `
            (function() {
              const terminal = document.getElementById('pst-content');
              if (terminal) {
                terminal.dataset.cursorX = '${this.cursorX}';
                terminal.dataset.cursorY = '${this.cursorY}';
                // Position cursor at x,y
                const cursor = document.getElementById('terminal-cursor');
                if (cursor) {
                  const charWidth = 9; // Approximate character width
                  const lineHeight = 20; // Approximate line height
                  cursor.style.left = (${this.cursorX} * charWidth) + 'px';
                  cursor.style.top = (${this.cursorY} * lineHeight) + 'px';
                }
              }
            })();
          `,
            'PST position command'
          );
        }
        break;

      case 'clearScreen':
        this.safeExecuteJS(
          `
          (function() {
            const terminal = document.getElementById('pst-content');
            if (terminal) {
              terminal.innerHTML = '';
              terminal.dataset.cursorX = '0';
              terminal.dataset.cursorY = '0';
            }
          })();
        `,
          'PST clear screen'
        );
        this.cursorX = 0;
        this.cursorY = 0;
        break;

      case 'clearEOL':
        this.safeExecuteJS(
          `
          (function() {
            const terminal = document.getElementById('pst-content');
            if (terminal) {
              const lines = terminal.querySelectorAll('p');
              const cursorY = parseInt(terminal.dataset.cursorY || '0');
              const cursorX = parseInt(terminal.dataset.cursorX || '0');
              if (lines[cursorY]) {
                const text = lines[cursorY].textContent || '';
                lines[cursorY].textContent = text.substring(0, cursorX);
              }
            }
          })();
        `,
          'PST clear to EOL'
        );
        break;

      case 'clearBelow':
        this.safeExecuteJS(
          `
          (function() {
            const terminal = document.getElementById('pst-content');
            if (terminal) {
              const lines = terminal.querySelectorAll('p');
              const cursorY = parseInt(terminal.dataset.cursorY || '0');
              for (let i = cursorY + 1; i < lines.length; i++) {
                lines[i].remove();
              }
            }
          })();
        `,
          'PST clear below'
        );
        break;

      case 'left':
        if (this.cursorX > 0) {
          this.cursorX--;
          this.updateCursorPosition();
        }
        break;

      case 'right':
        if (this.cursorX < this.terminalWidth - 1) {
          this.cursorX++;
          this.updateCursorPosition();
        }
        break;

      case 'up':
        if (this.cursorY > 0) {
          this.cursorY--;
          this.updateCursorPosition();
        }
        break;

      case 'down':
        if (this.cursorY < this.terminalHeight - 1) {
          this.cursorY++;
          this.updateCursorPosition();
        }
        break;

      case 'backspace':
        if (this.cursorX > 0) {
          this.cursorX--;
          this.safeExecuteJS(
            `
            (function() {
              const terminal = document.getElementById('pst-content');
              if (terminal) {
                const lines = terminal.querySelectorAll('p');
                const cursorY = parseInt(terminal.dataset.cursorY || '0');
                const cursorX = ${this.cursorX};
                if (lines[cursorY]) {
                  const text = lines[cursorY].textContent || '';
                  lines[cursorY].textContent = text.substring(0, cursorX) + text.substring(cursorX + 1);
                }
                terminal.dataset.cursorX = '${this.cursorX}';
              }
            })();
          `,
            'PST backspace'
          );
        }
        break;

      case 'tab':
        // Move to next tab stop (every 8 characters)
        this.cursorX = Math.min(Math.floor((this.cursorX + 8) / 8) * 8, this.terminalWidth - 1);
        this.updateCursorPosition();
        break;

      case 'linefeed':
        this.cursorY++;
        if (this.cursorY >= this.terminalHeight) {
          this.cursorY = this.terminalHeight - 1;
          // Scroll the terminal
          this.safeExecuteJS(
            `
            (function() {
              const terminal = document.getElementById('pst-content');
              if (terminal) {
                const lines = terminal.querySelectorAll('p');
                if (lines.length > 0) {
                  lines[0].remove();
                }
                const newLine = document.createElement('p');
                terminal.appendChild(newLine);
              }
            })();
          `,
            'PST linefeed scroll'
          );
        }
        this.updateCursorPosition();
        break;

      case 'newline':
        this.cursorX = 0;
        this.executePSTCommand('linefeed');
        break;

      case 'positionX':
        if (arg1 !== undefined) {
          this.cursorX = Math.min(arg1, this.terminalWidth - 1);
          this.updateCursorPosition();
        }
        break;

      case 'positionY':
        if (arg1 !== undefined) {
          this.cursorY = Math.min(arg1, this.terminalHeight - 1);
          this.updateCursorPosition();
        }
        break;

      case 'bell':
        // Play a beep sound or visual bell
        this.safeExecuteJS(
          `
          (function() {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURE');
            audio.play();
          })();
        `,
          'PST bell'
        );
        break;
    }
  }

  // Update cursor position in the terminal
  private updateCursorPosition(): void {
    this.safeExecuteJS(
      `
      (function() {
        const terminal = document.getElementById('pst-content');
        if (terminal) {
          terminal.dataset.cursorX = '${this.cursorX}';
          terminal.dataset.cursorY = '${this.cursorY}';
          const cursor = document.getElementById('terminal-cursor');
          if (cursor) {
            const charWidth = 9; // Approximate character width
            const lineHeight = 20; // Approximate line height
            cursor.style.left = (${this.cursorX} * charWidth) + 'px';
            cursor.style.top = (${this.cursorY} * lineHeight) + 'px';
          }
        }
      })();
    `,
      'update cursor position'
    );
  }

  // Helper to safely execute JavaScript in renderer
  private async safeExecuteJS(script: string, errorContext: string = 'script'): Promise<any> {
    // GUARD: Don't execute UI updates during shutdown
    if (this.isShuttingDown) {
      return undefined; // Silently skip - app is closing
    }

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn(`[UI UPDATE] ⚠️ Cannot execute ${errorContext}: MainWindow is destroyed`);
      return undefined;
    }
    try {
      return await this.mainWindow.webContents.executeJavaScript(script);
    } catch (error) {
      console.error(`[UI UPDATE] ❌ Failed to execute ${errorContext}:`, error);
      console.error(`[UI UPDATE] 🔍 Script was: ${script.substring(0, 100)}...`);
      console.error(`[UI UPDATE] 💡 This usually means a DOM element is missing or script syntax error`);
      return undefined;
    }
  }

  // UI Control Methods
  private async setDTR(state: boolean): Promise<void> {
    this.dtrState = state;
    // Update UI checkbox to reflect state (unified reset-checkbox)
    if (this.controlLineMode === 'DTR') {
      this.updateCheckbox('reset-checkbox', this.dtrState);
    }

    if (this._serialPort) {
      try {
        await this._serialPort.setDTR(this.dtrState);
        this.logMessage(`[DTR] Hardware control set to ${this.dtrState ? 'ON' : 'OFF'}`);

        // NOTE: Reset handling moved to toggleDTR() to avoid duplication
        // This method is for direct state setting without reset logic

        if (!this.dtrState) {
          // DTR OFF - maintain logging continuity, just log the state change
          this.logMessage(`[DTR] Control line released - continuing normal operation`);
          // Ensure Debug Logger continues logging without interruption
          if (this.debugLoggerWindow) {
            // No reset needed - just continue logging
            this.debugLoggerWindow.logSystemMessage('[DTR OFF] Control line released');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logMessage(`ERROR: Failed to set DTR: ${errorMsg}`);
      }
    }
  }

  private async setRTS(state: boolean): Promise<void> {
    this.rtsState = state;
    // Update UI checkbox to reflect state (unified reset-checkbox)
    if (this.controlLineMode === 'RTS') {
      this.updateCheckbox('reset-checkbox', this.rtsState);
    }

    if (this._serialPort) {
      try {
        await this._serialPort.setRTS(this.rtsState);
        this.logMessage(`[RTS] Hardware control set to ${this.rtsState ? 'ON' : 'OFF'}`);

        // NOTE: Reset handling moved to toggleRTS() to avoid duplication
        // This method is for direct state setting without reset logic

        if (!this.rtsState) {
          // RTS OFF - maintain logging continuity, just log the state change
          this.logMessage(`[RTS] Control line released - continuing normal operation`);
          // Ensure Debug Logger continues logging without interruption
          if (this.debugLoggerWindow) {
            // No reset needed - just continue logging
            this.debugLoggerWindow.logSystemMessage('[RTS OFF] Control line released');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logMessage(`ERROR: Failed to set RTS: ${errorMsg}`);
      }
    }
  }

  private toggleDTRCallCount = 0;

  private async toggleDTR(): Promise<void> {
    // DTR Toggle: State Management (press-on/press-off, NOT auto-toggle)
    this.toggleDTRCallCount++;
    const previousState = this.dtrState;
    const newState = !this.dtrState;
    this.logConsoleMessage(
      `[MAIN] toggleDTR() ENTER - Call #${this.toggleDTRCallCount}, ${previousState} -> ${newState}`
    );
    this.logMessage(`[DTR TOGGLE] ====== DTR TOGGLE START (Call #${this.toggleDTRCallCount}) ======`);
    this.logMessage(`[DTR TOGGLE] Previous state: ${previousState}`);
    this.logMessage(`[DTR TOGGLE] New state will be: ${newState}`);
    this.logMessage(`[DTR TOGGLE] Stack trace: ${new Error().stack?.split('\n').slice(1, 4).join(' -> ')}`);

    if (this._serialPort) {
      try {
        // With Prop Plug hardware, ANY DTR transition triggers a 17µs reset pulse
        // So we only touch the hardware when going from ON to OFF (de-asserting)

        if (newState) {
          // Press ON: Quiesce system (block traffic, flush logs, prepare for reset)
          this.logMessage(`[DTR TOGGLE] DTR ON - quiescing system`);

          // 1. Block incoming traffic immediately
          this._serialPort.setIgnoreFrontTraffic(true);
          this.logMessage(`[DTR TOGGLE] Traffic blocked`);

          // 2. Flush and rotate logs while traffic is blocked
          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.handleDTRReset(); // This flushes/rotates logs
            this.logMessage(`[DTR TOGGLE] Logs flushed and rotated`);
          }

          // Broadcast to COG windows to flush their logs too
          for (let cogId = 0; cogId < 8; cogId++) {
            const windowKey = `COG-${cogId}`;
            const cogWindow = this.displays[windowKey] as unknown as LoggerCOGWindow;
            if (cogWindow && cogWindow.isOpen()) {
              cogWindow.handleDTRReset();
            }
          }

          // 3. Log quiesce message to NEW log
          this.logMessage(`[DTR TOGGLE] System quiesced - awaiting reset on next button press`);

          // 4. Update state
          this.dtrState = newState;
        } else {
          // Press OFF: Release and reset (actual hardware reset happens now)
          this.logMessage(`[DTR TOGGLE] DTR OFF - releasing and resetting P2`);

          // 1. Log the reset action (before traffic resumes)
          this.logMessage(`[DTR RESET] DTR releasing - reset pulse now`);

          // 2. Toggle DTR to trigger Prop Plug's 17µs reset pulse
          await this._serialPort.setDTR(true);
          await this._serialPort.setDTR(false);
          this.logMessage(`[DTR TOGGLE] Hardware reset pulse triggered (P2 stopped in ~17µs)`);

          // 3. Open traffic gate (P2 stopped in µs, bootloader ready in 17ms, gate opens in ~1ms)
          this._serialPort.setIgnoreFrontTraffic(false);
          this.logMessage(`[DTR TOGGLE] Traffic gate opened`);

          // 4. Update state
          this.dtrState = newState;

          // 5. Signal parser that DTR reset occurred
          this.serialProcessor.onDTRReset();

          // Save DTR preference for this device
          this.saveDeviceControlLine('DTR');

          // Update control line mode and UI if needed
          if (this.controlLineMode !== 'DTR') {
            this.controlLineMode = 'DTR';
            this.updateControlLineUI();
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logMessage(`ERROR: Failed to set DTR: ${errorMsg}`);
        // Don't change state on error - keep checkbox in sync with actual state
      }
    } else {
      this.logMessage(`[DTR TOGGLE] No serial port connected - updating state for UI consistency`);
      // Still update state when no port connected (for UI consistency)
      this.dtrState = newState;
    }

    // Update checkbox via webContents send (IPC)
    if (this.mainWindow?.webContents) {
      this.logMessage(`[DTR TOGGLE] Sending IPC update-dtr-state with value: ${this.dtrState}`);
      this.mainWindow.webContents.send('update-dtr-state', this.dtrState);
    }
    this.logMessage(`[DTR TOGGLE] Final DTR state: ${this.dtrState ? 'ON' : 'OFF'}`);
    this.logConsoleMessage(`[MAIN] toggleDTR() EXIT - state is now ${this.dtrState}`);
    this.logMessage(`[DTR TOGGLE] ====== DTR TOGGLE END ======`);
  }

  private async toggleRTS(): Promise<void> {
    // RTS Toggle: State Management (press-on/press-off, NOT auto-toggle)
    // Same behavior as DTR: Press ON only tracks state, Press OFF triggers hardware pulse
    const previousState = this.rtsState;
    const newState = !this.rtsState;

    this.logMessage(`[RTS TOGGLE] ====== RTS TOGGLE START ======`);
    this.logMessage(`[RTS TOGGLE] Previous state: ${previousState}`);
    this.logMessage(`[RTS TOGGLE] New state will be: ${newState}`);

    if (this._serialPort) {
      try {
        if (newState) {
          // Press ON: Quiesce system (block traffic, flush logs, prepare for reset)
          this.logMessage(`[RTS TOGGLE] RTS ON - quiescing system`);

          // 1. Block incoming traffic immediately
          this._serialPort.setIgnoreFrontTraffic(true);
          this.logMessage(`[RTS TOGGLE] Traffic blocked`);

          // 2. Flush and rotate logs while traffic is blocked
          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.handleRTSReset(); // This flushes/rotates logs
            this.logMessage(`[RTS TOGGLE] Logs flushed and rotated`);
          }

          // Broadcast to COG windows to flush their logs too
          for (let cogId = 0; cogId < 8; cogId++) {
            const windowKey = `COG-${cogId}`;
            const cogWindow = this.displays[windowKey] as unknown as LoggerCOGWindow;
            if (cogWindow && cogWindow.isOpen()) {
              cogWindow.handleDTRReset(); // Same handler for DTR/RTS
            }
          }

          // 3. Log quiesce message to NEW log
          this.logMessage(`[RTS TOGGLE] System quiesced - awaiting reset on next button press`);

          // 4. Update state
          this.rtsState = newState;
        } else {
          // Press OFF: Release and reset (actual hardware reset happens now)
          this.logMessage(`[RTS TOGGLE] RTS OFF - releasing and resetting P2`);

          // 1. Log the reset action (before traffic resumes)
          this.logMessage(`[RTS RESET] RTS releasing - reset pulse now`);

          // 2. Toggle RTS to trigger Prop Plug's 17µs reset pulse
          await this._serialPort.setRTS(true);
          await this._serialPort.setRTS(false);
          this.logMessage(`[RTS TOGGLE] Hardware reset pulse triggered (P2 stopped in ~17µs)`);

          // 3. Open traffic gate (P2 stopped in µs, bootloader ready in 17ms, gate opens in ~1ms)
          this._serialPort.setIgnoreFrontTraffic(false);
          this.logMessage(`[RTS TOGGLE] Traffic gate opened`);

          // 4. Update state
          this.rtsState = newState;

          // 5. Signal parser that RTS reset occurred
          this.serialProcessor.onRTSReset();

          // Save RTS preference for this device when successfully used
          this.saveDeviceControlLine('RTS');

          // Update control line mode and UI if needed
          if (this.controlLineMode !== 'RTS') {
            this.controlLineMode = 'RTS';
            this.updateControlLineUI();
          }

          // Update state after successful hardware operation
          this.rtsState = newState;
        }

        this.logMessage(`[RTS TOGGLE] Final state: ${this.rtsState}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logMessage(`ERROR: Failed to set RTS: ${errorMsg}`);
        // Don't change state on error
      }
    }

    // Update checkbox via webContents send (IPC)
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('update-rts-state', this.rtsState);
    }

    this.logMessage(`[RTS TOGGLE] ====== RTS TOGGLE END ======`);
  }

  // Removed duplicate currentDownloadMode - using downloadMode from line 68

  private updateDownloadMode(mode: 'ram' | 'flash'): void {
    const ramColor = mode === 'ram' ? '#00FF00' : '#808080';
    const flashColor = mode === 'flash' ? '#00FF00' : '#808080';

    // CRITICAL FIX: Use setTimeout to ensure DOM is ready and properly update LEDs
    this.safeExecuteJS(
      `
      setTimeout(() => {
        const ramLed = document.getElementById('ram-led');
        const flashLed = document.getElementById('flash-led');
        const ramBtn = document.getElementById('download-ram');
        const flashBtn = document.getElementById('download-flash');

        // Debug logging
        // console.log('Updating download mode to: ${mode}');
        // console.log('RAM LED found:', !!ramLed, 'Flash LED found:', !!flashLed);

        // Update LED indicators with performance optimization - only update if different
        if (ramLed) {
          if (ramLed.textContent !== '●') {
            ramLed.textContent = '●';
          }
          if (ramLed.style.color !== '${ramColor}') {
            ramLed.style.color = '${ramColor}';
          }
          // Only set these once on initialization
          if (!ramLed.dataset.initialized) {
            ramLed.style.fontSize = '20px';
            ramLed.style.textShadow = '0 0 2px #000';
            ramLed.dataset.initialized = 'true';
          }
        } else {
          console.error('RAM LED element not found!');
        }

        if (flashLed) {
          if (flashLed.textContent !== '●') {
            flashLed.textContent = '●';
          }
          if (flashLed.style.color !== '${flashColor}') {
            flashLed.style.color = '${flashColor}';
          }
          // Only set these once on initialization
          if (!flashLed.dataset.initialized) {
            flashLed.style.fontSize = '20px';
            flashLed.style.textShadow = '0 0 2px #000';
            flashLed.dataset.initialized = 'true';
          }
        } else {
          console.error('Flash LED element not found!');
        }

        // Update button states with performance optimization - only update if different
        if (ramBtn) {
          const shouldBeActive = '${mode}' === 'ram';
          const isActive = ramBtn.classList.contains('active');
          if (shouldBeActive && !isActive) {
            ramBtn.classList.add('active');
          } else if (!shouldBeActive && isActive) {
            ramBtn.classList.remove('active');
          }
        }
        if (flashBtn) {
          const shouldBeActive = '${mode}' === 'flash';
          const isActive = flashBtn.classList.contains('active');
          if (shouldBeActive && !isActive) {
            flashBtn.classList.add('active');
          } else if (!shouldBeActive && isActive) {
            flashBtn.classList.remove('active');
          }
        }
      }, 0);
    `,
      'download mode update'
    );
  }

  private setDownloadMode(mode: 'ram' | 'flash'): void {
    // Update the single source of truth
    this.downloadMode = mode;
    this.updateDownloadMode(mode);
    this.logMessage(`Download mode set to ${mode.toUpperCase()}`);
  }

  public async downloadFileFromPath(filePath: string, toFlash: boolean): Promise<void> {
    // Public method for command-line initiated downloads
    await this.performDownloadFromPath(filePath, toFlash);
  }

  private async downloadFile(): Promise<void> {
    // Use the current download mode to determine where to download
    await this.performDownload(this.downloadMode === 'flash');
  }

  private async downloadToRAM(): Promise<void> {
    await this.performDownload(false);
  }

  private async downloadToFlash(): Promise<void> {
    await this.performDownload(true);
  }

  private async performDownloadFromPath(filePath: string, toFlash: boolean): Promise<void> {
    const target = toFlash ? 'Flash' : 'RAM';

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      this.logMessage(`ERROR: File not found: ${filePath}`);

      // Show error dialog to user
      if (this.mainWindow) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'error',
          title: 'File Not Found',
          message: `Cannot open file for download`,
          detail: `The file "${path.basename(filePath)}" does not exist.\n\nFull path: ${filePath}`,
          buttons: ['OK']
        });
      }
      return;
    }

    // Perform the actual download
    await this.executeDownload(filePath, toFlash, target);
  }

  private async performDownload(toFlash: boolean): Promise<void> {
    const target = toFlash ? 'Flash' : 'RAM';

    // Add null check and log for debugging
    if (!this.mainWindow) {
      console.error('[DOWNLOAD] Main window is null/undefined!');
      this.logMessage('ERROR: Cannot open download dialog - main window not available');
      return;
    }

    const result = await dialog.showOpenDialog(this.mainWindow, {
      title: `Select Binary File to Download to ${target}`,
      filters: [{ name: 'Binary Files', extensions: ['binary', 'bin', 'binf'] }],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      await this.executeDownload(filePath, toFlash, target);
    }
  }

  // P2 download always happens at 2Mbps for reliability
  private readonly DOWNLOAD_BAUD_RATE = 2000000;

  private async executeDownload(filePath: string, toFlash: boolean, target: string): Promise<void> {
    if (this._serialPort && this.downloader) {
      try {
        this.logMessage(`Downloading ${path.basename(filePath)} to ${target}...`);
        this.updateRecordingStatus(`Downloading to ${target}...`);

        // Get current debug baud rate (from CLI, preferences, or app default)
        const debugBaudRate = this._serialBaud;
        const downloadBaudRate = this.DOWNLOAD_BAUD_RATE; // Fixed download baud rate for P2

        // CRITICAL: Log current state before any changes
        const currentBaud = this._serialPort.getCurrentBaudRate();
        this.logConsoleMessage(
          `[DOWNLOAD] Current port baud rate: ${currentBaud}, debug rate: ${debugBaudRate}, download rate: ${downloadBaudRate}`
        );

        // FORCE switch to download baud rate - don't trust the debug rate comparison
        // The P2 needs 2Mbps for reliable download
        if (currentBaud !== downloadBaudRate) {
          this.logMessage(`Switching baud rate from ${debugBaudRate} to ${downloadBaudRate} for download`);
          this.logConsoleMessage(`[DOWNLOAD] MUST switch from ${debugBaudRate} to ${downloadBaudRate} for download`);
          await this._serialPort.changeBaudRate(downloadBaudRate);

          // Verify the baud rate actually changed
          const actualBaud = this._serialPort.getCurrentBaudRate();
          this.logConsoleMessage(`[DOWNLOAD] After switch, actual baud rate is: ${actualBaud}`);

          if (actualBaud !== downloadBaudRate) {
            this.logConsoleMessage(`[DOWNLOAD] ERROR: Baud rate did not change! Still at ${actualBaud}`);
            throw new Error(`Failed to switch to download baud rate: still at ${actualBaud}`);
          }
        } else {
          this.logConsoleMessage(`[DOWNLOAD] Already at download baud rate ${downloadBaudRate}, no switch needed`);
        }

        // Rotate log before download
        if (this.debugLoggerWindow) {
          // Close current log and start new one for download session
          this.debugLoggerWindow.handleDownloadStart();
          // Log download metadata
          const fileStats = fs.statSync(filePath);
          const downloadInfo = `[DOWNLOAD TO ${target.toUpperCase()}] File: ${path.basename(filePath)} | Size: ${
            fileStats.size
          } bytes | Modified: ${fileStats.mtime.toISOString()}`;
          this.debugLoggerWindow.logSystemMessage(downloadInfo);
        }

        // Download to target (RAM or Flash)
        this.logConsoleMessage(`[DOWNLOAD] Starting download at ${this._serialPort.getCurrentBaudRate()} baud`);
        const downloadResult = await this.downloader.download(filePath, toFlash);
        this.logConsoleMessage(`[DOWNLOAD] Download complete, port at ${this._serialPort.getCurrentBaudRate()} baud`);

        // Log download result FIRST (before switching baud rate back)
        if (downloadResult.success) {
          // Log download success to debug logger window
          const successMsg = `[DOWNLOAD SUCCESS] ${path.basename(filePath)} successfully downloaded to ${target}`;
          this.logConsoleMessage(`[DOWNLOAD] ${successMsg}`);

          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.logSystemMessage(successMsg);
          } else {
            console.warn('[DOWNLOAD] Debug logger window not available for success message');
          }
        }

        // Switch back to debug baud rate IMMEDIATELY if it was different
        // P2 code is already running, we need to be ready to receive!
        const postDownloadBaud = this._serialPort.getCurrentBaudRate();
        if (postDownloadBaud !== debugBaudRate) {
          this.logConsoleMessage(
            `[BAUD RATE] P2 code running! Quickly restoring from ${postDownloadBaud} to debug baud rate ${debugBaudRate}`
          );

          // Ensure TX buffer is empty before switching for a cleaner transition
          try {
            await this._serialPort.drain();
            this.logConsoleMessage(`[BAUD RATE] TX buffer drained before switch`);
          } catch (drainErr: any) {
            this.logConsoleMessage(`[BAUD RATE] Warning: Could not drain TX: ${drainErr.message}`);
          }

          await this._serialPort.changeBaudRate(debugBaudRate);

          // Verify the baud rate was actually changed
          const actualBaud = this._serialPort.getCurrentBaudRate();
          this.logConsoleMessage(`[BAUD RATE] Verified actual port baud rate: ${actualBaud}`);

          // CRITICAL: Handle garbage bytes from baud rate transition
          // Strategy: Read and discard garbage bytes with pattern detection
          // This is more reliable than flush() which doesn't work on macOS/FTDI

          // Use our new clearGarbageBytes method which actually removes bytes
          // It will discard garbage for 25ms to ensure we catch any late-arriving garbage
          // This preserves any clean data that arrives early
          try {
            const garbageCount = await this._serialPort.clearGarbageBytes(25);
            this.logConsoleMessage(`[BAUD RATE] Cleared ${garbageCount} garbage bytes from stream`);
          } catch (clearErr: any) {
            this.logConsoleMessage(`[BAUD RATE] Warning: Error clearing garbage: ${clearErr.message}`);
            // Fall back to the ignore approach if new method fails
            this._serialPort.setIgnoreFrontTraffic(true);
            await new Promise((resolve) => setTimeout(resolve, 25));
            this._serialPort.setIgnoreFrontTraffic(false);
          }

          this.logConsoleMessage(`[BAUD RATE] Ready to receive at ${actualBaud} baud`);

          // Single log message to debug logger window
          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.logSystemMessage(`BAUD_RATE_RESTORED ${actualBaud} baud (after download)`);
          }
        }

        if (downloadResult.success) {
          // Notify all COG windows about the download
          for (let cogId = 0; cogId < 8; cogId++) {
            const windowKey = `COG-${cogId}`;
            const cogWindow = this.displays[windowKey] as unknown as LoggerCOGWindow;
            if (cogWindow && cogWindow.isOpen()) {
              cogWindow.handleDownload();
            }
          }

          this.logMessage(`Successfully downloaded ${path.basename(filePath)} to ${target}`);
          this.updateRecordingStatus(`${toFlash ? 'Flash' : 'Download'} complete`);

          // Brief status display then clear
          setTimeout(() => {
            this.updateRecordingStatus('Ready');
          }, 2000);
        } else {
          // Download failed - use the actual error message from downloader
          const errorMsg = downloadResult.errorMessage || 'Unknown error occurred during download';

          // Log download failure to debug logger window WITH ACTUAL REASON
          const failureMsg = `[DOWNLOAD FAILED] ${path.basename(
            filePath
          )} failed to download to ${target}: ${errorMsg}`;
          this.logConsoleMessage(`[DOWNLOAD] ${failureMsg}`);

          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.logSystemMessage(failureMsg);
          } else {
            console.warn('[DOWNLOAD] Debug logger window not available for failure message');
          }

          this.logMessage(`ERROR: Failed to download to ${target}: ${errorMsg}`);
          this.updateRecordingStatus(`${toFlash ? 'Flash' : 'Download'} failed`);

          // Use non-blocking dialog to avoid interrupting serial data processing
          dialog.showMessageBox(this.mainWindow!, {
            type: 'error',
            title: 'Download Failed',
            message: `Failed to download to ${target}`,
            detail: errorMsg,
            buttons: ['OK']
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Log download failure to debug logger window
        const failureMsg = `[DOWNLOAD FAILED] ${path.basename(filePath)} failed to download to ${target}: ${errorMsg}`;
        this.logConsoleMessage(`[DOWNLOAD] ${failureMsg}`);

        if (this.debugLoggerWindow) {
          this.debugLoggerWindow.logSystemMessage(failureMsg);
        } else {
          console.warn('[DOWNLOAD] Debug logger window not available for error message');
        }

        this.logMessage(`ERROR: Failed to download to ${target}: ${errorMsg}`);
        this.updateRecordingStatus(`${toFlash ? 'Flash' : 'Download'} failed`);

        // Ensure we restore debug baud rate even on error
        try {
          const debugBaudRate = this._serialBaud;
          this.logConsoleMessage(`[BAUD RATE] Restoring debug baud rate to ${debugBaudRate} after download error`);
          await this._serialPort.changeBaudRate(debugBaudRate);

          // Verify and log single message to debug logger
          const actualBaud = this._serialPort.getCurrentBaudRate();
          this.logConsoleMessage(`[BAUD RATE] Verified actual port baud rate: ${actualBaud}`);
          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.logSystemMessage(`BAUD_RATE_RESTORED ${actualBaud} baud (after error)`);
          }
        } catch (restoreError) {
          this.logMessage(`ERROR: Failed to restore debug baud rate: ${restoreError}`);
        }

        // Use non-blocking dialog to avoid interrupting serial data processing
        dialog.showMessageBox(this.mainWindow!, {
          type: 'error',
          title: 'Download Failed',
          message: `Failed to download to ${target}`,
          detail: errorMsg,
          buttons: ['OK']
        });
      }
    } else {
      this.logMessage(`ERROR: Serial port or downloader not initialized`);
      // Use non-blocking dialog to avoid interrupting serial data processing
      dialog.showMessageBox(this.mainWindow!, {
        type: 'error',
        title: 'Not Connected',
        message: 'Please connect to a Propeller 2 device first.',
        buttons: ['OK']
      });
    }
  }

  private startRecording(filepath?: string): void {
    const metadata = {
      sessionName: filepath || `session-${getFormattedDateTime()}`,
      description: 'Debug session recording',
      startTime: Date.now(),
      serialPort: this._deviceNode,
      baudRate: this._serialBaud
    };

    this.windowRouter.startRecording(metadata);
    this.updateRecordingStatus('Recording...');
    this.updateToolbarButton('record-btn', '⏹ Stop');
  }

  private stopRecording(): void {
    this.windowRouter.stopRecording();
    this.updateRecordingStatus('Ready');
    this.updateToolbarButton('record-btn', '⏺ Record');

    // Check if this was the first recording - enable playback controls if so
    this.updatePlaybackControlsState();
  }

  private async playRecording(): Promise<void> {
    // Add null check
    if (!this.mainWindow) {
      console.error('[PLAYBACK] Main window is null/undefined!');
      this.logMessage('ERROR: Cannot open playback dialog - main window not available');
      return;
    }

    const result = await dialog.showOpenDialog(this.mainWindow, {
      title: 'Select Recording to Play',
      filters: [{ name: 'P2 Recording Files', extensions: ['p2rec'] }],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];

      // Initialize player if needed
      if (!this.binaryPlayer) {
        this.binaryPlayer = new BinaryPlayer();
        this.setupPlaybackListeners();
      }

      // Load and start playback
      await this.binaryPlayer.loadRecording(filePath);
      this.showPlaybackControls();
      this.binaryPlayer.play();
      this.updateRecordingStatus('Playing...');
    }
  }

  /**
   * Update playback controls enabled/disabled state based on recordings availability
   * Called on startup and when recordings are created
   */
  private updatePlaybackControlsState(): void {
    const recordingsDir = this.context.getRecordingsDirectory();
    let hasRecordings = false;

    // Check if recordings directory exists and has any recording files
    if (fs.existsSync(recordingsDir)) {
      try {
        const files = fs.readdirSync(recordingsDir);
        const recordingFiles = files.filter((f) => f.endsWith('.p2rec') || f.endsWith('.jsonl'));
        hasRecordings = recordingFiles.length > 0;
      } catch (error) {
        this.logConsoleMessage(`[PLAYBACK] Error checking recordings: ${error}`);
        hasRecordings = false;
      }
    }

    this.logConsoleMessage(`[PLAYBACK] Recordings available: ${hasRecordings}`);

    // Update playback button state
    this.safeExecuteJS(
      `
      (function() {
        const playbackBtn = document.getElementById('playback-btn');
        if (playbackBtn) {
          playbackBtn.disabled = ${!hasRecordings};
          playbackBtn.style.opacity = ${hasRecordings ? '1.0' : '0.5'};
          playbackBtn.title = ${hasRecordings ? "'Play recording'" : "'No recordings available'"};
        }
      })();
    `,
      'update playback controls state'
    );
  }

  private setupPlaybackListeners(): void {
    if (!this.binaryPlayer) return;

    // Listen for playback data
    this.binaryPlayer.on('data', (data: Buffer) => {
      // Inject data as if received from serial port
      this.handleSerialRx(data);
    });

    // Listen for progress updates
    this.binaryPlayer.on('progress', (progress) => {
      this.updatePlaybackProgress(progress);
    });

    // Listen for playback finished
    this.binaryPlayer.on('finished', () => {
      this.hidePlaybackControls();
      this.updateRecordingStatus('Ready');
    });
  }

  private showPlaybackControls(): void {
    this.safeExecuteJS(
      `
      const controls = document.getElementById('playback-controls');
      if (controls) {
        controls.style.display = 'block';
      }
    `,
      'showPlaybackControls'
    );
  }

  private hidePlaybackControls(): void {
    this.safeExecuteJS(
      `
      const controls = document.getElementById('playback-controls');
      if (controls) {
        controls.style.display = 'none';
      }
    `,
      'hidePlaybackControls'
    );
  }

  private updatePlaybackButton(isPlaying: boolean): void {
    this.safeExecuteJS(
      `
      const playBtn = document.getElementById('playback-play');
      const pauseBtn = document.getElementById('playback-pause');
      if (playBtn && pauseBtn) {
        if (${isPlaying}) {
          playBtn.style.display = 'none';
          pauseBtn.style.display = 'block';
        } else {
          playBtn.style.display = 'block';
          pauseBtn.style.display = 'none';
        }
      }
    `,
      'updatePlaybackButton'
    );
  }

  private updatePlaybackProgress(progress: { current: number; total: number; percentage: number }): void {
    const currentMinutes = Math.floor(progress.current / 60000);
    const currentSeconds = Math.floor((progress.current % 60000) / 1000);
    const totalMinutes = Math.floor(progress.total / 60000);
    const totalSeconds = Math.floor((progress.total % 60000) / 1000);

    const timeText = `${currentMinutes.toString().padStart(2, '0')}:${currentSeconds
      .toString()
      .padStart(2, '0')} / ${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;

    this.safeExecuteJS(
      `
      const timeEl = document.getElementById('playback-time');
      const barEl = document.getElementById('playback-bar');
      const handleEl = document.getElementById('playback-handle');

      if (timeEl) {
        timeEl.textContent = '${timeText}';
      }
      if (barEl) {
        barEl.style.width = '${progress.percentage}%';
      }
      if (handleEl) {
        handleEl.style.left = '${progress.percentage}%';
      }
    `,
      'updatePlaybackProgress'
    );
  }

  private selectBaudRate(): void {
    const baudRates = ['115200', '230400', '460800', '921600', '2000000'];
    dialog
      .showMessageBox(this.mainWindow!, {
        type: 'question',
        buttons: baudRates,
        title: 'Select Baud Rate',
        message: 'Choose baud rate:'
      })
      .then((response: any) => {
        this._serialBaud = parseInt(baudRates[response.response]);
        if (this._serialPort) {
          UsbSerial.setCommBaudRate(this._serialBaud);
        }
        this.logMessage(`Baud rate set to ${this._serialBaud}`);
      });
  }

  private showDebugCommandReference(): void {
    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'Debug Command Reference',
      message: 'Debug Command Reference',
      detail:
        'DEBUG TERM - Open terminal window\nDEBUG SCOPE - Open scope window\nDEBUG LOGIC - Open logic analyzer\nDEBUG PLOT - Open plot window\nDEBUG BITMAP - Open bitmap display\nDEBUG MIDI - Open MIDI display\nDEBUG FFT - Open FFT analyzer',
      buttons: ['OK']
    });
  }

  private showPreferencesDialog(): void {
    if (!this.preferencesDialog) {
      this.preferencesDialog = new PreferencesDialog(this.mainWindow, this.context, (settings) => {
        this.applyPreferences(settings);
      });
    }
    this.preferencesDialog.show();
  }

  /**
   * Apply updated preferences to all relevant components
   */
  private applyPreferences(settings: any): void {
    this.logConsoleMessage('[PREFERENCES] Applying settings:', settings);

    // Update context with new preferences
    this.context.updatePreferences(settings);

    // Apply debug logger scrollback setting
    if (settings.debugLogger && this.debugLoggerWindow) {
      this.logConsoleMessage(
        `[PREFERENCES] Updating debug logger scrollback to ${settings.debugLogger.scrollbackLines} lines`
      );
      this.debugLoggerWindow.updateScrollbackPreference(settings.debugLogger.scrollbackLines);
    }

    // Apply serial port settings
    if (settings.serialPort) {
      // Apply control line setting (DTR vs RTS)
      if (settings.serialPort.controlLine && settings.serialPort.controlLine !== this.controlLineMode) {
        this.logConsoleMessage(
          `[PREFERENCES] Changing control line from ${this.controlLineMode} to ${settings.serialPort.controlLine}`
        );
        this.setControlLineMode(settings.serialPort.controlLine);
      }

      // Apply default baud rate (will be used for next connection)
      // BUT: Skip if baud rate was set from command line (CLI always wins)
      if (settings.serialPort.defaultBaud && !this.context.runEnvironment.debugBaudRateFromCLI) {
        this._serialBaud = settings.serialPort.defaultBaud;
        this.logConsoleMessage(`[PREFERENCES] Default baud rate set to ${this._serialBaud}`);
      } else if (this.context.runEnvironment.debugBaudRateFromCLI) {
        this.logConsoleMessage(
          `[PREFERENCES] Skipping baud rate preference (command-line override: ${this._serialBaud})`
        );
      }

      // Apply reset on connection setting
      if (settings.serialPort.resetOnConnection !== undefined) {
        this.context.runEnvironment.resetOnConnection = settings.serialPort.resetOnConnection;
        this.logConsoleMessage(
          `[PREFERENCES] Reset on connection ${settings.serialPort.resetOnConnection ? 'enabled' : 'disabled'}`
        );
      }
    }

    // Apply USB logging settings
    if (settings.logging) {
      const components = this.serialProcessor.getComponents();
      if (components.workerExtractor) {
        if (settings.logging.enableUSBLogging) {
          // Create USB log path in Electron process (same as debug logger)
          const { getFormattedDateTime } = require('../utils/files');
          const path = require('path');
          const logsDir = this.context.getLogDirectory();
          const timestamp = getFormattedDateTime();
          const logFilePath = path.join(logsDir, `usb-traffic_${timestamp}.log`);
          this.logConsoleMessage(`[PREFERENCES] Enabling USB traffic logging to ${logFilePath}`);
          components.workerExtractor.enableUSBLogging(logFilePath);
        } else {
          if (components.workerExtractor.isUSBLoggingEnabled()) {
            this.logConsoleMessage('[PREFERENCES] Disabling USB traffic logging');
            components.workerExtractor.disableUSBLogging();
          }
        }
      }
    }

    // Apply terminal settings
    if (settings.terminal) {
      // Apply terminal mode (PST vs ANSI)
      if (settings.terminal.mode) {
        // Store for use when creating terminal windows
        this.logConsoleMessage(`[PREFERENCES] Terminal mode set to ${settings.terminal.mode}`);
      }

      // Apply color theme
      if (settings.terminal.colorTheme) {
        // Parse theme name (e.g., "green-on-black" -> "green", "amber-on-black" -> "amber")
        const themeValue = settings.terminal.colorTheme;
        let colorName: 'green' | 'amber' = 'green'; // default

        if (themeValue.includes('amber')) {
          colorName = 'amber';
        } else if (themeValue.includes('green')) {
          colorName = 'green';
        }
        // white and other colors default to green for logger windows

        // Update theme for debug logger window
        this.logConsoleMessage(
          `[PREFERENCES] Terminal color theme set to ${themeValue} (using ${colorName} for logger)`
        );
        if (this.debugLoggerWindow) {
          this.debugLoggerWindow.setTheme(colorName);
        }

        // Update theme for all COG logger windows
        for (let cogId = 0; cogId < 8; cogId++) {
          const windowKey = `COG-${cogId}`;
          const cogWindow = this.displays[windowKey] as unknown as LoggerCOGWindow;
          if (cogWindow && cogWindow instanceof LoggerCOGWindow) {
            cogWindow.setTheme(colorName);
          }
        }
      }

      // Apply font settings
      if (settings.terminal.fontSize) {
        // Store for future terminal windows
        this.logConsoleMessage(`[PREFERENCES] Terminal font size set to ${settings.terminal.fontSize}`);
      }

      if (settings.terminal.fontFamily) {
        // Store for future terminal windows
        this.logConsoleMessage(`[PREFERENCES] Terminal font family set to ${settings.terminal.fontFamily}`);
      }

      // Apply COG prefix and local echo settings
      if (settings.terminal.showCogPrefixes !== undefined) {
        this.logConsoleMessage(`[PREFERENCES] COG prefixes ${settings.terminal.showCogPrefixes ? 'shown' : 'hidden'}`);
      }

      if (settings.terminal.localEcho !== undefined) {
        this.logConsoleMessage(`[PREFERENCES] Local echo ${settings.terminal.localEcho ? 'enabled' : 'disabled'}`);
      }
    }

    // Apply logging settings
    if (settings.logging) {
      // Apply log directory
      if (settings.logging.logDirectory) {
        // Update log directory path for future logs
        this.logConsoleMessage(`[PREFERENCES] Log directory set to ${settings.logging.logDirectory}`);
      }

      // Apply auto-save debug output setting
      if (settings.logging.autoSaveDebug !== undefined) {
        this.immediateLog = settings.logging.autoSaveDebug;
        this.logConsoleMessage(`[PREFERENCES] Auto-save debug output ${this.immediateLog ? 'enabled' : 'disabled'}`);
      }

      // Apply new log on DTR reset setting
      if (settings.logging.newLogOnDtrReset !== undefined) {
        // Store for use in DTR reset handler
        this.logConsoleMessage(
          `[PREFERENCES] New log on DTR reset ${settings.logging.newLogOnDtrReset ? 'enabled' : 'disabled'}`
        );
      }

      // Apply max log size setting
      if (settings.logging.maxLogSize) {
        // Store for use in log rotation logic
        this.logConsoleMessage(`[PREFERENCES] Max log size set to ${settings.logging.maxLogSize}`);
      }
    }

    // Store settings for persistence
    // Note: This should be stored differently for global vs project settings
    // as per the planned settings restructure
  }

  /**
   * Load global settings from file, creating defaults if needed
   */
  private loadGlobalSettings(): void {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const data = fs.readFileSync(this.settingsFilePath, 'utf8');
        this.globalSettings = JSON.parse(data);
        this.logMessage(`✓ Loaded settings from ${this.settingsFilePath}`);
      } else {
        // Create default settings
        this.globalSettings = {
          defaultControlLine: 'DTR', // Parallax standard
          deviceSettings: {}
        };
        this.saveGlobalSettings();
        this.logMessage(`✓ Created default settings at ${this.settingsFilePath}`);
      }
    } catch (error) {
      this.logMessage(`⚠️ Error loading settings: ${error}, using defaults`);
      this.globalSettings = {
        defaultControlLine: 'DTR',
        deviceSettings: {}
      };
    }
  }

  /**
   * Save global settings to file
   */
  private saveGlobalSettings(): void {
    try {
      const data = JSON.stringify(this.globalSettings, null, 2);
      fs.writeFileSync(this.settingsFilePath, data, 'utf8');
      this.logMessage(`✓ Settings saved to ${this.settingsFilePath}`);
    } catch (error) {
      this.logMessage(`⚠️ Error saving settings: ${error}`);
    }
  }

  /**
   * Initialize serial baud rate from command line or preferences
   * Command line takes precedence over all preferences
   */
  private initializeSerialBaud(): void {
    const APP_DEFAULT_BAUD = 115200; // Default debug/terminal baud rate (NOT download rate!)

    // Check if baud rate was specified on command line
    if (this.context.runEnvironment.debugBaudRateFromCLI && this.context.runEnvironment.debugBaudrate) {
      this._serialBaud = this.context.runEnvironment.debugBaudrate;
      this.logConsoleMessage(`[SETTINGS] Using command-line baud rate: ${this._serialBaud}`);
      return;
    }

    // Try to get from user preferences (already merged: app defaults -> user global -> project local)
    try {
      if (this.context.preferences.serialPort?.defaultBaud) {
        this._serialBaud = this.context.preferences.serialPort.defaultBaud;
        this.logConsoleMessage(`[SETTINGS] Using preference baud rate: ${this._serialBaud}`);
        return;
      }
    } catch (error) {
      this.logConsoleMessage(`[SETTINGS] Error loading baud rate from preferences: ${error}`);
    }

    // Fall back to app default
    this._serialBaud = APP_DEFAULT_BAUD;
    this.logConsoleMessage(`[SETTINGS] Using app default baud rate: ${this._serialBaud}`);
  }

  /**
   * Get unique device identifier for current device
   * Format: "vendorId:productId:serialNumber" or fallback to device path
   */
  private getCurrentDeviceId(): string {
    if (this._serialPort) {
      // Try to get USB device information
      const deviceInfo = this._serialPort.deviceInfo;
      if (deviceInfo && deviceInfo !== '') {
        // Use P2 device ID if available
        return `p2:${deviceInfo}`;
      }
    }

    // Fallback to device path (less reliable but works)
    return `path:${this._deviceNode}`;
  }

  /**
   * Get control line preference for current device
   */
  private getDeviceControlLine(): 'DTR' | 'RTS' {
    const deviceId = this.getCurrentDeviceId();
    const deviceSettings = this.globalSettings.deviceSettings?.[deviceId];

    if (deviceSettings) {
      this.logMessage(`📋 Using saved ${deviceSettings.controlLine} for device ${deviceId}`);
      return deviceSettings.controlLine;
    }

    const defaultLine = this.globalSettings.defaultControlLine || 'DTR';
    this.logMessage(`📋 Using default ${defaultLine} for new device ${deviceId}`);
    return defaultLine;
  }

  /**
   * Save control line preference for current device
   */
  private saveDeviceControlLine(controlLine: 'DTR' | 'RTS'): void {
    const deviceId = this.getCurrentDeviceId();

    // Ensure deviceSettings object exists
    if (!this.globalSettings.deviceSettings) {
      this.globalSettings.deviceSettings = {};
    }

    this.globalSettings.deviceSettings[deviceId] = {
      controlLine,
      lastUsed: Date.now()
    };

    this.saveGlobalSettings();
    this.logMessage(`💾 Saved ${controlLine} preference for device ${deviceId}`);
  }

  private updateToolbarButton(id: string, text: string): void {
    this.safeExecuteJS(
      `
      const btn = document.getElementById('${id}');
      if (btn) btn.textContent = '${text}';
    `,
      `updateToolbarButton-${id}`
    );
  }

  private updateRecordingStatus(status: string): void {
    // Escape status string to prevent injection issues with quotes and special characters
    const escapedStatus = status.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    // Wrap in IIFE to avoid variable redeclaration errors when called multiple times
    this.safeExecuteJS(
      `
      (function() {
        const statusEl = document.getElementById('recording-status');
        if (statusEl) statusEl.textContent = '${escapedStatus}';
      })();
    `,
      'updateRecordingStatus'
    );
  }

  private updateConnectionStatus(connected: boolean): void {
    const color = connected ? '#00FF00' : '#FFBF00'; // Green when connected, Yellow when not
    this.safeExecuteJS(
      `
      // Update connection LED indicator (GREEN when connected, YELLOW when disconnected)
      const connLed = document.getElementById('conn-led');
      if (connLed) {
        connLed.textContent = '●';  // Always filled circle
        connLed.style.color = '${color}';
        connLed.style.fontSize = '20px';  // Make it bigger
      }
    `,
      'updateConnectionStatus'
    );
  }

  private updateCheckbox(id: string, checked: boolean): void {
    this.safeExecuteJS(
      `
      const checkbox = document.getElementById('${id}');
      if (checkbox) {
        checkbox.checked = ${checked};
      }
    `,
      `updateCheckbox-${id}`
    );
  }

  private toggleEchoOff(): void {
    this.echoOffEnabled = !this.echoOffEnabled;
    this.updateEchoCheckbox(this.echoOffEnabled);
    this.logMessage(`Echo Off ${this.echoOffEnabled ? 'enabled' : 'disabled'} - filtering echoed characters`);
    if (!this.echoOffEnabled) {
      this.recentTransmitBuffer = [];
    }
  }

  private updateEchoCheckbox(checked: boolean): void {
    this.safeExecuteJS(
      `
      const checkbox = document.getElementById('echo-checkbox');
      if (checkbox) checkbox.checked = ${checked};
    `,
      'updateEchoCheckbox'
    );
  }

  private blinkActivityLED(type: 'tx' | 'rx'): void {
    const ledId = type === 'tx' ? 'tx-led' : 'rx-led';
    const color = type === 'tx' ? '#0080FF' : '#FF0000'; // Blue for TX, Red for RX
    const timer = type === 'tx' ? this.txActivityTimer : this.rxActivityTimer;

    // Clear existing timer
    if (timer) {
      clearTimeout(timer);
    }

    // Turn LED on - ensure DOM is ready with timeout
    const script = `
      setTimeout(() => {
        const led = document.getElementById('${ledId}');
        if (led) {
          led.style.color = '${color}';
          led.style.fontSize = '20px';  // Consistent size
          led.style.textShadow = '0 0 2px #000';
        } else {
          console.warn('[LED] Element ${ledId} not found in DOM');
        }
      }, 10);
    `;
    this.safeExecuteJS(script, `${type}LED-on`);

    // Turn LED off after 150ms
    const newTimer = setTimeout(() => {
      this.safeExecuteJS(
        `
        setTimeout(() => {
          const led = document.getElementById('${ledId}');
          if (led) {
            led.style.color = '#333';
            led.style.fontSize = '20px';  // Consistent size
            led.style.textShadow = '0 0 2px #000';
          }
        }, 10);
      `,
        `${type}LED-off`
      )
        .then(() => {
          // Only clear timer after successful LED update
          if (type === 'tx') {
            this.txActivityTimer = null;
          } else {
            this.rxActivityTimer = null;
          }
        })
        .catch(() => {
          // If LED update fails, still clear timer to prevent memory leaks
          if (type === 'tx') {
            this.txActivityTimer = null;
          } else {
            this.rxActivityTimer = null;
          }
        });
    }, 150);

    if (type === 'tx') {
      this.txActivityTimer = newTimer;
    } else {
      this.rxActivityTimer = newTimer;
    }
  }

  private updateLoggingStatus(isLogging: boolean, filename?: string, lineCount?: number): void {
    const symbol = isLogging ? '●' : '○';
    const color = isLogging ? '#00FF00' : '#333';
    this.safeExecuteJS(
      `
      (function() {
        // Update log LED indicator
        const logLed = document.getElementById('log-led');
        if (logLed) {
          logLed.textContent = '${symbol}';
          logLed.style.color = '${color}';
        } else {
          console.warn('[LOG LED] Element not found in DOM');
        }
      })();
    `,
      'updateLoggingStatus'
    );
  }

  /**
   * Controlled console logging for static methods - only outputs when ENABLE_CONSOLE_LOG is true
   */
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  /**
   * Reset the connected hardware by toggling DTR or RTS
   * Called by external signal handler (SIGUSR1)
   */
  public async resetHardware(): Promise<void> {
    this.logMessage('[SIGNAL] Hardware reset requested via signal');

    // Check which control line is configured
    const useRTS = this.context.runEnvironment.rtsOverride;

    if (this._serialPort) {
      try {
        if (useRTS) {
          this.logMessage('[SIGNAL] Resetting hardware via RTS pulse');
          // Pulse RTS low for 100ms to trigger reset
          await this._serialPort.setRTS(false);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await this._serialPort.setRTS(true);
          this.logMessage('[SIGNAL] RTS reset pulse completed');

          // Notify debug windows about the reset
          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.handleRTSReset();
          }
        } else {
          this.logMessage('[SIGNAL] Resetting hardware via DTR pulse');
          // Pulse DTR low for 100ms to trigger reset
          await this._serialPort.setDTR(false);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await this._serialPort.setDTR(true);
          this.logMessage('[SIGNAL] DTR reset pulse completed');

          // Notify debug windows about the reset
          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.handleDTRReset();
          }
        }

        // Notify all COG windows about the reset
        for (let cogId = 0; cogId < 8; cogId++) {
          const windowKey = `COG-${cogId}`;
          const cogWindow = this.displays[windowKey] as unknown as LoggerCOGWindow;
          if (cogWindow) {
            if (useRTS) {
              cogWindow.handleDownload(); // Use download handler for RTS
            } else {
              cogWindow.handleDTRReset();
            }
          }
        }
      } catch (error) {
        this.logMessage(`[SIGNAL] Failed to reset hardware: ${error}`);
      }
    } else {
      this.logMessage('[SIGNAL] No serial port connected - cannot reset hardware');
    }
  }

  /**
   * Perform graceful shutdown
   * Called by external signal handler (SIGTERM/SIGINT)
   */
  public gracefulShutdown(): void {
    this.logMessage('[SIGNAL] Graceful shutdown initiated');

    try {
      // Stop recording if active
      if (this.windowRouter) {
        this.logMessage('[SIGNAL] Stopping active recording if in progress');
        this.windowRouter.stopRecording();
      }

      // Close all debug windows
      this.logMessage('[SIGNAL] Closing all debug windows');
      for (const key in this.displays) {
        const display = this.displays[key];
        if (display && typeof display.closeDebugWindow === 'function') {
          display.closeDebugWindow();
        }
      }

      // Close serial port
      if (this._serialPort) {
        this.logMessage('[SIGNAL] Closing serial port');
        this._serialPort.close();
      }

      // Close main window
      if (this.mainWindow) {
        this.logMessage('[SIGNAL] Closing main window');
        this.mainWindow.close();
      }

      this.logMessage('[SIGNAL] Graceful shutdown complete');
    } catch (error) {
      this.logMessage(`[SIGNAL] Error during shutdown: ${error}`);
    }
  }

  /**
   * Check if we're in a suspicious directory and warn the user
   */
  private checkDirectoryContext(): void {
    const cwd = process.cwd();
    const homeDir = os.homedir();

    // Check if we're in a suspicious location
    const suspiciousPatterns = this.getSuspiciousLocations();
    const isSuspicious = suspiciousPatterns.some((pattern) => pattern);

    // Check for project files
    const hasProjectFiles = this.detectProjectFiles();
    const hasProjectConfig = fs.existsSync('.pnut-term-ts-settings.json');

    // Check if this directory is in the suppressed list
    const suppressedDirs = this.context.preferences?.suppressedDirectoryWarnings || [];
    const isSupressed = suppressedDirs.includes(cwd);

    // Show warning if:
    // - In suspicious location AND
    // - No project files AND
    // - Not suppressed
    if (isSuspicious && !hasProjectFiles && !hasProjectConfig && !isSupressed) {
      // Don't show warnings for likely project directories
      const safePatterns = this.getAlwaysAllowedPatterns();
      const isSafeDir = safePatterns.some((pattern) => pattern.test(cwd));

      if (!isSafeDir) {
        this.showLocationWarning(cwd);
      }
    }
  }

  /**
   * Get platform-specific suspicious directory patterns
   */
  private getSuspiciousLocations(): boolean[] {
    const cwd = process.cwd();
    const homeDir = os.homedir();
    const platform = process.platform;

    // Common suspicious patterns for all platforms
    const commonPatterns = [
      cwd === homeDir, // Home directory root
      cwd === '/', // Unix root
      cwd.includes('node_modules'), // Inside node_modules
      cwd.includes('.git') && !cwd.endsWith('.git') // Inside .git folder
    ];

    // Platform-specific patterns
    let platformPatterns: boolean[] = [];

    switch (platform) {
      case 'darwin': // macOS
        platformPatterns = [
          cwd === '/Applications', // Applications folder
          cwd === '/System', // System folder
          cwd === '/Library', // Library folder
          cwd === '/Users', // Users root
          cwd === `${homeDir}/Desktop`, // Desktop
          cwd === `${homeDir}/Downloads`, // Downloads
          cwd === `${homeDir}/Documents`, // Documents root (too broad)
          cwd === `${homeDir}/Library`, // User Library
          cwd === `${homeDir}/.Trash`, // Trash
          cwd.includes('/Applications/') && cwd.includes('.app'), // Inside an app bundle
          cwd.includes('/Volumes/') // External volumes root
        ];
        break;

      case 'win32': // Windows
        platformPatterns = [
          /^[A-Z]:\\?$/i.test(cwd), // Any drive root
          cwd === `${homeDir}\\Desktop` || cwd === `${homeDir}/Desktop`, // Desktop
          cwd === `${homeDir}\\Downloads` || cwd === `${homeDir}/Downloads`, // Downloads
          cwd === `${homeDir}\\Documents` || cwd === `${homeDir}/Documents`, // Documents root
          cwd.includes('\\Windows\\') || cwd.includes('/Windows/'), // Windows system
          cwd.includes('\\Program Files') || cwd.includes('/Program Files'), // Program Files
          cwd.includes('\\ProgramData') || cwd.includes('/ProgramData'), // ProgramData
          cwd.includes('\\System32') || cwd.includes('/System32'), // System32
          cwd.includes('\\AppData\\') || cwd.includes('/AppData/'), // AppData folders
          cwd === `${homeDir}\\OneDrive` || cwd === `${homeDir}/OneDrive` // OneDrive root
        ];
        break;

      case 'linux': // Linux
        platformPatterns = [
          cwd === '/usr', // usr directory
          cwd === '/bin', // bin directory
          cwd === '/sbin', // sbin directory
          cwd === '/etc', // etc directory
          cwd === '/var', // var directory
          cwd === '/opt', // opt directory
          cwd === '/proc', // proc filesystem
          cwd === '/sys', // sys filesystem
          cwd === '/boot', // boot directory
          cwd === `${homeDir}/Desktop`, // Desktop
          cwd === `${homeDir}/Downloads`, // Downloads
          cwd === `${homeDir}/Documents`, // Documents root
          cwd === `${homeDir}/.local`, // .local directory
          cwd === `${homeDir}/.config`, // .config directory
          cwd === `${homeDir}/snap`, // Snap packages
          cwd.includes('/.cache/'), // Cache directories
          cwd === '/mnt', // Mount point root
          cwd === '/media' // Media mount root
        ];
        break;
    }

    return [...commonPatterns, ...platformPatterns];
  }

  /**
   * Check for project files in current directory
   */
  private detectProjectFiles(): boolean {
    try {
      const files = fs.readdirSync('.');
      return files.some(
        (f) =>
          f.endsWith('.spin2') ||
          f.endsWith('.spin') ||
          f.endsWith('.binary') ||
          f.endsWith('.bin') ||
          f === '.pnut-term-ts-settings.json'
      );
    } catch (error) {
      // If we can't read the directory, assume it's not a project
      return false;
    }
  }

  /**
   * Get patterns for directories that are always allowed
   */
  private getAlwaysAllowedPatterns(): RegExp[] {
    const platform = process.platform;

    // Common safe patterns for all platforms
    const common = [
      /\/P2Projects?\//i,
      /\/Propeller/i,
      /\/spin2?\//i,
      /\/projects?\//i,
      /\/dev(elopment)?\//i,
      /\/code\//i,
      /\/workspace/i,
      /\/src\//i
    ];

    // Platform-specific safe patterns (Windows needs backslash patterns)
    const platformSpecific =
      platform === 'win32'
        ? [
            /\\P2Projects?\\/i,
            /\\Propeller/i,
            /\\spin2?\\/i,
            /\\projects?\\/i,
            /\\dev(elopment)?\\/i,
            /\\code\\/i,
            /\\workspace/i,
            /\\src\\/i
          ]
        : [];

    return [...common, ...platformSpecific];
  }

  /**
   * Show warning dialog about suspicious directory
   */
  private async showLocationWarning(currentDir: string): Promise<void> {
    if (!dialog) return; // No dialog available

    const platform = process.platform;
    let examplePaths: string[];

    switch (platform) {
      case 'darwin':
        examplePaths = ['~/Documents/P2Projects/', '~/Development/Propeller/', '~/Code/spin2-workspace/'];
        break;

      case 'win32':
        examplePaths = [
          'C:\\Users\\YourName\\Documents\\P2Projects\\',
          'C:\\Development\\Propeller\\',
          'D:\\Projects\\Spin2\\'
        ];
        break;

      case 'linux':
        examplePaths = ['~/projects/propeller/', '~/Documents/p2-development/', '~/workspace/spin2/'];
        break;

      default:
        examplePaths = ['~/YourProjectFolder/'];
    }

    const detail =
      `Current directory: ${currentDir}\n\n` +
      `PNut-Term-TS is running in a directory with no .spin2, .spin, ` +
      `or .binary files detected.\n\n` +
      `Did you mean to run it from a different location?\n\n` +
      `Common project locations:\n` +
      examplePaths.map((p) => `  • ${p}`).join('\n');

    const result = await dialog.showMessageBox(this.mainWindow!, {
      type: 'warning',
      title: 'Check Directory Location',
      message: 'No Propeller 2 source files detected',
      detail: detail,
      buttons: ['Continue Anyway', 'Quit and Change Directory'],
      defaultId: 0,
      cancelId: 1,
      checkboxLabel: "Don't warn me about this directory again",
      checkboxChecked: false
    });

    if (result.checkboxChecked) {
      // Save this directory to the skip list in user settings
      this.addDirectoryToSkipList(currentDir);
    }

    if (result.response === 1) {
      // User chose to quit
      app.quit();
    }
    // Otherwise continue normally
  }

  /**
   * Add directory to suppressed warnings list
   */
  private addDirectoryToSkipList(directory: string): void {
    try {
      // Get current settings (preferences)
      const currentSettings = this.context.preferences || {};

      // Initialize suppressed list if it doesn't exist
      if (!currentSettings.suppressedDirectoryWarnings) {
        currentSettings.suppressedDirectoryWarnings = [];
      }

      // Add directory if not already in list
      if (!currentSettings.suppressedDirectoryWarnings.includes(directory)) {
        currentSettings.suppressedDirectoryWarnings.push(directory);

        // Save updated settings
        this.context.saveUserGlobalSettings(currentSettings);
        this.logMessage(`Added directory to suppressed warnings: ${directory}`);
      }
    } catch (error) {
      this.logMessage(`Failed to add directory to skip list: ${error}`);
    }
  }
}
