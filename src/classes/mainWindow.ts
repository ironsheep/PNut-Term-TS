/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
// src/classes/mainWindow.ts

// Import electron conditionally for standalone compatibility
let app: any, BrowserWindow: any, Menu: any, MenuItem: any, dialog: any, electron: any, ipcMain: any;
try {
  const electronImport = require('electron');
  app = electronImport.app;
  BrowserWindow = electronImport.BrowserWindow;
  Menu = electronImport.Menu;
  MenuItem = electronImport.MenuItem;
  dialog = electronImport.dialog;
  electron = electronImport;
  ipcMain = electronImport.ipcMain;
} catch (error) {
  // Running in standalone mode without Electron
  console.warn('Warning: Electron not available, running in CLI mode');
}
import { Context } from '../utils/context';
import { ensureDirExists, getFormattedDateTime } from '../utils/files';
import { UsbSerial } from '../utils/usb.serial';
import * as fs from 'fs';
import path from 'path';
import { DebugScopeWindow } from './debugScopeWin';
import { DebugWindowBase } from './debugWindowBase';
import { DebugTermWindow } from './debugTermWin';
import { DebugPlotWindow } from './debugPlotWin';
import { DebugLogicWindow } from './debugLogicWin';
import { DebugBitmapWindow } from './debugBitmapWin';
import { DebugMidiWindow } from './debugMidiWin';
import { DebugLoggerWindow } from './debugLoggerWin';
import { DebugCOGWindow } from './debugCOGWindow';
import { DebugDebuggerWindow } from './debugDebuggerWin';
import { WindowRouter } from './shared/windowRouter';
import { SerialMessageProcessor } from './shared/serialMessageProcessor';
import { MessageType, ExtractedMessage } from './shared/messageExtractor';
import { RouteDestination } from './shared/messageRouter';
import { PooledMessage } from './shared/messagePool';
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
  devices?: any[];  // For compatibility with initialization
  selectedDeviceIndex?: number;
}

const DEFAULT_SERIAL_BAUD = 2000000;
export class MainWindow {
  private context: Context;
  private _deviceNode: string = '';
  private _serialPort: UsbSerial | undefined = undefined;
  private _serialBaud: number = DEFAULT_SERIAL_BAUD;
  private mainWindow: any = null;
  private mainWindowOpen: boolean = false;
  private logFilenameBase: string = 'myapp';
  private loggingToFile: boolean = false;
  private waitingForINIT: boolean = true;
  private logFileSpec: string = '';
  private windowRouter: WindowRouter = WindowRouter.getInstance();
  private dtrState: boolean = false;
  private rtsState: boolean = false;
  private controlLineMode: 'DTR' | 'RTS' = 'DTR'; // Default to DTR (Parallax standard)
  private downloadMode: 'ram' | 'flash' = 'ram';  // Default to RAM mode
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
  private debugLoggerWindow: DebugLoggerWindow | null = null;
  private knownClosedBy: boolean = false; // compilicated determine if closed by app:quit or [x] close
  private immediateLog: boolean = true;
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
    if (this.context.runEnvironment.loggingEnabled) {
      this.context.logger.forceLogMessage('MainWindow started.');
    }
    
    // Initialize default settings immediately to prevent null reference crashes
    this.globalSettings = {
      devices: [],
      selectedDeviceIndex: 0
    };
    this.settingsFilePath = '';  // Will be set properly in loadSettings()
    
    // Initialize Two-Tier Pattern Matching serial processor and COG managers
    this.serialProcessor = new SerialMessageProcessor(true); // Enable performance logging
    this.cogWindowManager = new COGWindowManager();
    this.cogHistoryManager = new COGHistoryManager();
    this.cogLogExporter = new COGLogExporter();
    
    // Set up Two-Tier Pattern Matching event handlers
    console.log('[TWO-TIER] 🔧 Setting up SerialProcessor event handlers...');
    this.setupSerialProcessorEvents();
    console.log('[TWO-TIER] ✅ SerialProcessor event handlers setup complete');
    
    // Set up COG window creator
    this.cogWindowManager.setWindowCreator((cogId: number) => {
      return this.createCOGWindow(cogId);
    });
    
    // Listen for active COG changes to update status bar
    this.cogWindowManager.on('activeCOGsChanged', (data: { cogId: number; activeCOGs: number[]; displayText: string }) => {
      console.log(`[COG STATUS] COG ${data.cogId} became active, now active: ${data.displayText}`);
      this.updateActiveCogs(data.activeCOGs);
    });
    
    // Listen for WindowRouter events
    this.setupWindowRouterEventListeners();
    
    // Initialize device settings using context startup directory
    this.settingsFilePath = path.join(this.context.currentFolder, 'pnut-term-settings.json');
    this.loadGlobalSettings();
    
    const currFileTime: string = getFormattedDateTime();
    this.logFilenameBase = `myApp-${currFileTime}.log`;

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
   * Setup event listeners for WindowRouter events
   */
  private setupWindowRouterEventListeners(): void {
    console.log(`[WINDOW CREATION] 🎧 Setting up WindowRouter event listeners`);
    
    // Listen for windowNeeded events when WindowRouter can't route to existing window
    this.windowRouter.on('windowNeeded', (eventData: { type: string; command: string; error: string }) => {
      console.log(`[WINDOW CREATION] 📨 Received windowNeeded event!`);
      console.log(`[WINDOW CREATION] WindowRouter needs window of type: ${eventData.type}`);
      console.log(`[WINDOW CREATION] Command: ${eventData.command}`);
      console.log(`[WINDOW CREATION] Error: ${eventData.error}`);
      
      // Handle window creation based on type
      this.handleWindowCreationRequest(eventData.type, eventData.command);
    });
    
    // Listen for P2 system reboot events (golden synchronization marker)
    this.windowRouter.on('p2SystemReboot', (eventData: { message: string; timestamp: number }) => {
      console.log(`[P2 SYNC] 🎯 P2 SYSTEM REBOOT DETECTED!`);
      console.log(`[P2 SYNC] Message: ${eventData.message}`);
      console.log(`[P2 SYNC] Timestamp: ${new Date(eventData.timestamp).toISOString()}`);
      
      // Trigger complete synchronization reset
      this.handleP2SystemReboot(eventData);
    });
    
    console.log(`[WINDOW CREATION] ✅ WindowRouter event listeners setup complete`);
  }
  
  /**
   * Setup event handlers for debugger message parser
   */
  private setupSerialProcessorEvents(): void {
    // CRITICAL: Import and setup debugger response handler
    const { DebuggerResponse } = require('./shared/debuggerResponse');
    const debuggerResponse = new DebuggerResponse();
    // Create routing destinations for Two-Tier Pattern Matching
    const debugLoggerDestination: RouteDestination = {
      name: 'DebugLogger',
      handler: (message: ExtractedMessage | PooledMessage) => {
        this.routeToDebugLogger(message);
      }
    };

    const windowCreatorDestination: RouteDestination = {
      name: 'WindowCreator', 
      handler: (message: ExtractedMessage | PooledMessage) => {
        this.handleWindowCommand(message);
      }
    };

    const debuggerWindowDestination: RouteDestination = {
      name: 'DebuggerWindow',
      handler: (message: ExtractedMessage | PooledMessage) => {
        this.routeToDebuggerWindow(message);
      }
    };

    // Apply standard P2 routing configuration
    this.serialProcessor.applyStandardRouting(
      debugLoggerDestination,
      windowCreatorDestination, 
      debuggerWindowDestination
    );
    
    // Listen for debugger packets to create/update debugger windows
    this.serialProcessor.on('debuggerPacketReceived', (packet: Uint8Array) => {
      const cogId = packet[0];
      console.log(`[DEBUGGER] Received 416-byte packet from COG${cogId}`);
      
      // Create debugger window directly like other debug windows (scope, plot, etc.)
      const windowName = `debugger-${cogId}`;
      
      // Check if window already exists
      if (!this.displays[windowName]) {
        console.log(`[DEBUGGER] Auto-creating debugger window for COG${cogId}`);
        const debuggerDisplay = new DebugDebuggerWindow(this.context, cogId);
        this.hookNotifcationsAndRememberWindow(windowName, debuggerDisplay);
        console.log(`[DEBUGGER] Successfully created debugger window for COG${cogId}`);
      }
      
      // Send the packet to the window (whether new or existing)
      // Use updateContent() which handles queuing if window not ready
      const debuggerWindow = this.displays[windowName] as DebugDebuggerWindow;
      if (debuggerWindow) {
        console.log(`[DEBUGGER] Sending 416-byte packet to debugger window for COG${cogId}`);
        debuggerWindow.updateContent(packet);
      }
    });
    
    // Reset debugger response state on DTR/RTS reset
    this.serialProcessor.on('dtrReset', () => {
      console.log('[DEBUGGER RESPONSE] DTR reset detected, clearing response state');
      debuggerResponse.reset();
    });
    
    this.serialProcessor.on('rtsReset', () => {
      console.log('[DEBUGGER RESPONSE] RTS reset detected, clearing response state');
      debuggerResponse.reset();
    });

    // Start the processor
    console.log('[TWO-TIER] 🚀 Starting SerialMessageProcessor...');
    this.serialProcessor.start();
    console.log('[TWO-TIER] ✅ SerialMessageProcessor started successfully');
    
    // Performance monitoring will be started after DOM is ready (in did-finish-load handler)

    // Handle processor events
    this.serialProcessor.on('resetDetected', (event: any) => {
      console.log(`[TWO-TIER] ${event.type} reset detected`);
    });

    this.serialProcessor.on('syncStatusChanged', (status: any) => {
      if (status.synchronized) {
        console.log(`[TWO-TIER] ✅ Synchronized via ${status.source}`);
      } else {
        console.log(`[TWO-TIER] ⚠️ Lost synchronization`);
      }
    });
  }

  /**
   * Route message to Debug Logger (Terminal FIRST principle)
   */
  private routeToDebugLogger(message: ExtractedMessage | PooledMessage): void {
    console.log(`[TWO-TIER] 📨 Routing message to Debug Logger: ${message.type}, ${message.data.length} bytes`);
    
    // Use type-safe handoff to debug logger - no more guessing!
    if (this.debugLoggerWindow) {
      console.log(`[TWO-TIER] ✅ Debug Logger window available, processing message`);
    } else {
      console.log(`[TWO-TIER] ❌ Debug Logger window NOT available, using fallback`);
    }
    
    if (this.debugLoggerWindow) {
      // Convert buffer to appropriate data type
      let data: string[] | Uint8Array;
      
      if (message.type === MessageType.DEBUGGER_416BYTE) {
        // Binary data stays as Uint8Array
        data = message.data;
      } else {
        // Text data converted to string array
        const textData = new TextDecoder().decode(message.data);
        data = textData.split(/\s+/).filter(part => part.length > 0);
      }
      
      // Direct type-safe call - no router guessing needed
      this.debugLoggerWindow.processTypedMessage(message.type, data);
    } else {
      // Fallback to router if debug logger not available
      const routerMessage = {
        type: 'text' as const,
        data: this.formatMessageForDisplay(message),
        timestamp: message.timestamp,
        cogId: message.metadata?.cogId
      };
      this.windowRouter.routeMessage(routerMessage);
    }
  }

  /**
   * Handle window command (backtick commands)
   */
  private handleWindowCommand(message: ExtractedMessage | PooledMessage): void {
    if (message.metadata?.windowCommand) {
      console.log(`[TWO-TIER] Window command: ${message.metadata.windowCommand}`);
      // Route to appropriate window creation logic
      this.windowRouter.routeMessage({
        type: 'text',
        data: message.metadata.windowCommand,
        timestamp: message.timestamp
      });
    }
  }

  /**
   * Route to debugger window (80-byte packets)
   */
  private routeToDebuggerWindow(message: ExtractedMessage | PooledMessage): void {
    if (message.metadata?.cogId !== undefined) {
      console.log(`[TWO-TIER] Debugger data for COG ${message.metadata.cogId}`);
      // Route binary debugger data to appropriate COG debugger window
      this.windowRouter.routeMessage({
        type: 'binary',
        data: message.data,
        timestamp: message.timestamp,
        cogId: message.metadata.cogId
      });
    }
  }

  /**
   * Format extracted message for display in debug logger
   */
  private formatMessageForDisplay(message: ExtractedMessage | PooledMessage): string {
    let displayText = '';
    
    switch (message.type) {
      case MessageType.TERMINAL_OUTPUT:
        displayText = new TextDecoder().decode(message.data);
        break;
      case MessageType.COG_MESSAGE:
        displayText = new TextDecoder().decode(message.data);
        // Extract COG ID from message and notify COGWindowManager
        const cogMatch = displayText.match(/^Cog(\d)\s\s/);
        if (cogMatch) {
          const cogId = parseInt(cogMatch[1], 10);
          if (cogId >= 0 && cogId <= 7) {
            // Notify COG window manager about this COG activity
            this.cogWindowManager.onCOGTraffic(cogId, message);
            console.log(`[COG TRACKING] COG${cogId} message detected, updating display`);
          }
        }
        break;
      case MessageType.P2_SYSTEM_INIT:
        displayText = `[GOLDEN SYNC] ${new TextDecoder().decode(message.data)}`;
        break;
      case MessageType.DB_PACKET:
        displayText = this.formatHexDump(message.data, 'DB_PACKET');
        break;
      case MessageType.INVALID_COG:
        displayText = `[INVALID COG] ${message.metadata?.warningMessage || ''}: ${new TextDecoder().decode(message.data)}`;
        break;
      case MessageType.INCOMPLETE_DEBUG:
        displayText = `[INCOMPLETE] ${message.metadata?.warningMessage || ''}: ${new TextDecoder().decode(message.data)}`;
        break;
      case MessageType.DEBUGGER_416BYTE:
        // Handle 416-byte debugger packets
        const cogId = message.data[0];
        displayText = `[DEBUGGER] COG${cogId} 416-byte packet received`;
        // Debugger window creation is now handled by the 'debuggerPacketReceived' event listener
        break;
      default:
        displayText = this.formatHexDump(message.data, message.type);
    }
    
    return displayText;
  }

  /**
   * Format binary data as hex dump for display
   */
  private formatHexDump(data: Uint8Array, label: string): string {
    const lines: string[] = [`[${label}] ${data.length} bytes:`];
    const bytesPerLine = 16;
    
    for (let offset = 0; offset < data.length; offset += bytesPerLine) {
      const lineBytes = data.slice(offset, Math.min(offset + bytesPerLine, data.length));
      
      let hexPart = '';
      for (let i = 0; i < bytesPerLine; i++) {
        if (i < lineBytes.length) {
          hexPart += `$${lineBytes[i].toString(16).toUpperCase().padStart(2, '0')} `;
        } else {
          hexPart += '    ';
        }
        if (i === 7) hexPart += ' ';
      }
      
      let asciiPart = '';
      for (let i = 0; i < lineBytes.length; i++) {
        const byte = lineBytes[i] & 0x7F;
        asciiPart += (byte >= 0x20 && byte <= 0x7E) ? String.fromCharCode(byte) : '.';
      }
      
      const offsetHex = offset.toString(16).padStart(4, '0');
      lines.push(`  ${offsetHex}: ${hexPart}  ${asciiPart}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Create a COG splitter window
   */
  private createCOGWindow(cogId: number): any {
    console.log(`[COG WINDOW] Creating COG ${cogId} window`);
    
    // Generate window ID for tracking
    const windowId = `COG-${cogId}`;
    
    // Create COG window using the proper class
    const cogWindow = new DebugCOGWindow(cogId, {
      mainWindow: this,
      context: this.context,
      placementStrategy: PlacementStrategy.COG_GRID,
      windowId: windowId
    });
    
    // Register with WindowRouter for message routing
    this.windowRouter.registerWindow(`COG${cogId}`, `COG${cogId}`, (message) => {
      if (typeof message === 'string') {
        cogWindow.processCOGMessage(message);
      }
    });
    
    // Track in displays
    this.displays[windowId] = cogWindow;
    
    // Update UI with active COGs when window opens
    const activeCogs = this.cogWindowManager.getActiveCOGs();
    this.updateActiveCogs(activeCogs);
    
    // Listen for close event
    cogWindow.on('cog-window-closed', (closedCogId: number) => {
      console.log(`[COG WINDOW] COG ${closedCogId} window closed`);
      this.cogWindowManager.onWindowClosed(closedCogId);
      delete this.displays[`COG-${closedCogId}`];
      this.windowRouter.unregisterWindow(`COG${closedCogId}`);
      
      // Update UI with active COGs
      const activeCogs = this.cogWindowManager.getActiveCOGs();
      this.updateActiveCogs(activeCogs);
    });
    
    // Listen for export request
    cogWindow.on('request-export', (exportCogId: number) => {
      this.handleCOGExportRequest(exportCogId);
    });
    
    // Get the actual Electron BrowserWindow
    const electronWindow = cogWindow.getWindow();
    
    return electronWindow;
  }
  
  /**
   * Handle Show All COGs button click from Debug Logger window
   */
  public handleShowAllCOGs(): void {
    console.log('[COG MANAGER] Show All COGs requested');
    this.cogWindowManager.showAllCOGs();
  }
  
  /**
   * Handle COG export request
   */
  private handleCOGExportRequest(cogId: number): void {
    console.log(`[COG EXPORT] Export requested for COG ${cogId}`);
    
    // Get the COG window
    const windowKey = `COG-${cogId}`;
    const cogWindow = this.displays[windowKey] as DebugCOGWindow;
    
    if (cogWindow) {
      const messages = cogWindow.exportMessages();
      // TODO: Save to file or send to COGLogExporter
      console.log(`[COG EXPORT] Exported ${messages.length} characters from COG ${cogId}`);
    }
  }
  
  
  /**
   * Route binary data to debug logger with type information
   */
  private routeBinaryToDebugLogger(data: Uint8Array, binaryType: 'debugger' | 'p2_raw'): void {
    if (!this.debugLoggerWindow) {
      // Auto-create debug logger if needed
      try {
        this.debugLoggerWindow = DebugLoggerWindow.getInstance(this.context);
        this.displays['DebugLogger'] = this.debugLoggerWindow;
        
        this.debugLoggerWindow.on('close', () => {
          delete this.displays['DebugLogger'];
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
          hexLine += ' ';  // Single space between bytes
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
          asciiPart += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
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
  
  
  /**
   * Handle window creation requests from WindowRouter
   */
  private handleWindowCreationRequest(windowType: string, command: string): void {
    console.log(`[WINDOW CREATION] Analyzing command: ${command}`);
    
    // Check if this looks like a window creation command vs data/control command
    // Creation commands typically have: `WINDOWTYPE Name POS x y ... or similar setup directives
    // Data commands are: `Name data... or `Name close save etc.
    const cleanCommand = command.substring(1).trim(); // Remove backtick
    const parts = cleanCommand.split(' ');
    
    // If first word after backtick matches windowType (LOGIC, TERM, etc), it's likely a creation command
    // Otherwise it's a command for an existing window (like `MyLogic close save`)
    const firstWord = parts[0].toUpperCase();
    const isCreationCommand = firstWord === windowType.toUpperCase() || 
                              (parts.length > 2 && parts.includes('POS')) ||
                              (parts.length > 2 && parts.includes('SIZE'));
    
    if (!isCreationCommand) {
      // This is a data/control command for a window that should already exist
      console.log(`[WINDOW CREATION] Not a creation command - appears to be data/control for existing window`);
      console.log(`[WINDOW CREATION] Command: "${command}" contains: ${parts.join(', ')}`);
      
      // Check if command contains 'close' anywhere (might be compound: `MyLogic save close`)
      if (cleanCommand.toLowerCase().includes('close')) {
        console.log(`[WINDOW CREATION] Contains 'close' - window is being closed, not created`);
      }
      return;
    }
    
    console.log(`[WINDOW CREATION] Identified as creation command - creating ${windowType} window`);
    // Parse the command and create the appropriate window
    // The command should still have the backtick, so we can use existing handleDebugCommand logic
    this.handleDebugCommand(command);
  }

  public initialize() {
    this.context.logger.forceLogMessage('* initialize()');
    console.log('[STARTUP] MainWindow.initialize() called');
    // app.on('ready', this.createAppWindow);
    // CRITICAL FIX: Don't open serial port until DOM is ready!
    // Store the device node to open later
    if (this._deviceNode.length > 0) {
      this.logMessage(`* Device specified: ${this._deviceNode} - will connect after window loads`);
      console.log(`[STARTUP] Device specified: ${this._deviceNode}`);
    } else {
      this.logMessage('* No device specified - will check available devices when window loads');
      console.log('[STARTUP] No device specified');
    }
    if (app && app.whenReady) {
      console.log('[STARTUP] Electron app object found, calling whenReady()');
      app.whenReady().then(() => {
        this.logMessage('* [whenReady]');
        console.log('[STARTUP] Electron app is ready, creating window');
        this.createAppWindow();
      }).catch((error: any) => {
        console.error('[STARTUP] Error in app.whenReady():', error);
      });
    } else {
      // Running in CLI mode without Electron
      console.log('[STARTUP] Running in CLI mode - no GUI windows available (app object not found)');
    }

    if (app) {
      app.on('window-all-closed', () => {
        // Quit the app when all windows are closed, even on macOS
        // This makes the app behave like a single-window application
        console.log('[STARTUP] All windows closed, quitting app');
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
    // In packaged app, use process.resourcesPath, in dev use relative path
    const resourcesPath = process.resourcesPath || path.join(__dirname, '../../../');
    const fontPath = path.join(resourcesPath, 'fonts', 'Parallax.ttf');
    // Convert to file URL with forward slashes for cross-platform compatibility
    return `file://${fontPath.replace(/\\/g, '/')}`;
  }

  private getIBM3270FontUrl(): string {
    // In packaged app, use process.resourcesPath, in dev use relative path
    const resourcesPath = process.resourcesPath || path.join(__dirname, '../../../');
    const fontPath = path.join(resourcesPath, 'src/assets/fonts', '3270-Regular.ttf');
    // Convert to file URL with forward slashes for cross-platform compatibility
    return `file://${fontPath.replace(/\\/g, '/')}`;
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
  public sendSerialData(data: string): void {
    if (this._serialPort !== undefined) {
      this._serialPort.write(data);
      
      // Store transmitted characters for echo filtering
      if (this.echoOffEnabled) {
        this.recentTransmitBuffer = data.split('');
        this.transmitTimestamp = Date.now();
      }
      
      // TX activity indicator - blink every 50 chars or first char
      this.txCharCounter += data.length;
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
    try {
      this._serialPort = await new UsbSerial(this.context, deviceNode);
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
    
    console.log(`[SYNC TIMEOUT] Baud: ${baudRate}, Line: ${this.MAX_LINE_CHARS} chars, Timeout: ${finalTimeout.toFixed(1)}ms`);
    return finalTimeout;
  }

  private handleSerialRx(data: Buffer | string) {
    // Handle received data - can be Buffer (raw bytes) or string (from parser)
    
    // RX activity indicator - blink for ALL received data (binary or text)
    const dataLength = Buffer.isBuffer(data) ? data.length : data.length;
    this.rxCharCounter += dataLength;
    if (this.rxCharCounter >= 50 || !this.rxActivityTimer) {
      this.blinkActivityLED('rx');
      this.rxCharCounter = 0;
    }
    
    if (Buffer.isBuffer(data)) {
      // Add microsecond timestamp using process.hrtime
      const hrtime = process.hrtime();
      const microseconds = Math.floor(hrtime[0] * 1000000 + hrtime[1] / 1000);
      console.log(`[SERIAL RX ${microseconds}µs] Received ${data.length} bytes`);
      
      // Log hex and ASCII for debugging - same format as debug logger
      const hexLines: string[] = [];
      const bytesPerLine = 16;
      for (let offset = 0; offset < data.length; offset += bytesPerLine) {
        const lineBytes = data.slice(offset, Math.min(offset + bytesPerLine, data.length));
        
        // Build hex part
        let hexPart = '';
        for (let i = 0; i < bytesPerLine; i++) {
          if (i < lineBytes.length) {
            hexPart += `$${lineBytes[i].toString(16).toUpperCase().padStart(2, '0')} `;
          } else {
            hexPart += '    ';
          }
          if (i === 7) hexPart += ' '; // Extra space in middle
        }
        
        // Build ASCII part
        let asciiPart = '';
        for (let i = 0; i < lineBytes.length; i++) {
          const byte = lineBytes[i] & 0x7F; // Mask with 0x7F to clean up binary data display
          asciiPart += (byte >= 0x20 && byte <= 0x7E) ? String.fromCharCode(byte) : '.';
        }
        
        const offsetHex = offset.toString(16).padStart(4, '0');
        hexLines.push(`  ${offsetHex}: ${hexPart}  ${asciiPart}`);
      }
      
      console.log('[SERIAL RX HEX/ASCII]:');
      hexLines.forEach(line => console.log(line));
      
      // Two-Tier Pattern Matching: Process serial data through new architecture
      this.serialProcessor.receiveData(data);
      return;
    }
    
    if (typeof data === 'string') {
      console.log(`[SERIAL RX] Text data: ${data.length} chars: "${data}"`);
      
      // GROUND ZERO RECOVERY: Check for Cog-prefixed messages first (backward compatibility)
      if (data.startsWith('Cog')) {
        console.log(`[DEBUG] Potential COG message found: "${data}", length: ${data.length}, char[3]: "${data[3]}", char[4]: "${data[4]}"`);
        if (data.length > 4 && data[4] === ' ') {
          console.log(`[COG DETECTION] Found Cog message: ${data}`);
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
  private createDebugLoggerWindow(): void {
    if (this.debugLoggerWindow) {
      console.log('[DEBUG LOGGER] Debug Logger already exists, skipping creation');
      return;
    }
    
    console.log('[DEBUG LOGGER] Creating debug logger window for auto-logging...');
    try {
      this.debugLoggerWindow = DebugLoggerWindow.getInstance(this.context);
      console.log('[DEBUG LOGGER] Auto-created successfully - logging started immediately');
      this.displays['DebugLogger'] = this.debugLoggerWindow;
      
      // Set up event listeners
      this.debugLoggerWindow.on('close', () => {
        this.logMessage('Debug Logger Window closed');
        console.log('[DEBUG LOGGER] Window closed by user');
        delete this.displays['DebugLogger'];
        this.debugLoggerWindow = null;
        this.updateLoggingStatus(false);
      });

      this.debugLoggerWindow.on('loggingStatusChanged', (status: any) => {
        this.updateLoggingStatus(status.isLogging, status.filename);
        if (this.context.runEnvironment.loggingEnabled) {
          this.logMessage(`Debug Logger logging status: ${status.isLogging ? 'STARTED' : 'STOPPED'} ${status.filename || ''}`);
        }
      });
      
      // Listen for COG-related events
      this.debugLoggerWindow.on('show-all-cogs-requested', () => {
        this.handleShowAllCOGs();
      });
      
      this.debugLoggerWindow.on('export-cog-logs-requested', () => {
        console.log('[MAIN] Export COG logs requested');
      });
      
      // Connect performance monitor for warnings
      const components = this.serialProcessor.getComponents();
      if (components.performanceMonitor) {
        this.debugLoggerWindow.setPerformanceMonitor(components.performanceMonitor);
        console.log('[DEBUG LOGGER] Connected to performance monitor for warnings');
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
    console.log(`[P2 SYNC] 🔄 Starting complete P2 synchronization reset...`);
    
    // 1. Clear all sync buffers and parser state
    console.log(`[P2 SYNC] 🧹 Clearing sync buffers and parser state`);
    this.syncBuffer = ''; // Clear the message synchronization buffer
    
    // 2. Reset debugger parser state  
    console.log(`[P2 SYNC] 🔄 Resetting debugger parser state`);
    this.serialProcessor.onDTRReset(); // Trigger Two-Tier reset
    
    // 3. Clear and restart the Debug Logger session
    if (this.debugLoggerWindow) {
      console.log(`[P2 SYNC] 📝 Restarting Debug Logger session`);
      try {
        // Signal DTR reset to create new log file boundary
        this.debugLoggerWindow.handleDTRReset();
        
        // Signal DTR reset to create new log file boundary (no reboot marker in log)
        
      } catch (error) {
        console.error(`[P2 SYNC] Error restarting Debug Logger:`, error);
      }
    }
    
    // 4. Reset COG window tracking (all COGs start fresh after reboot)
    console.log(`[P2 SYNC] 🎯 Resetting COG window tracking`);
    // Note: Don't close existing COG windows - user may want to see previous session data
    // Just reset their internal state for new session
    Object.keys(this.displays).forEach(key => {
      if (key.startsWith('COG-')) {
        const cogWindow = this.displays[key] as DebugCOGWindow;
        if (cogWindow && typeof cogWindow.clear === 'function') {
          console.log(`[P2 SYNC] 🔄 Resetting ${key} window state`);
          // Clear the window but keep it open for comparison
        }
      }
    });
    
    // 5. Update main window status
    if (this.context.runEnvironment.loggingEnabled) {
      this.logMessage(`🎯 P2 SYSTEM REBOOT DETECTED - Complete synchronization reset performed`);
      this.logMessage(`   Golden marker: ${eventData.message}`);
      this.logMessage(`   All parsers and buffers reset - perfect sync achieved`);
    }
    
    // P2 system messages go to debug logger, not main terminal
    
    console.log(`[P2 SYNC] ✅ Complete P2 synchronization reset finished - perfect sync achieved`);
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
      
      console.log(`[SYNC] Found ${syncPoints.length} sync points, splitting at position ${lastSyncPoint}`);
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
        if (line.length > 0) { // Skip empty lines
          if (this.isAsciiPrintable(line)) {
            console.log(`[SYNC] ✅ Forwarding line: "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`);
            results.push(line);
          } else {
            console.log(`[SYNC] ⚠️ Non-ASCII line, dumping as hex:`);
            this.dumpHexData(line);
            results.push(line); // Forward anyway for debugging
          }
        }
      }
    }
    
    // Handle incomplete fragment
    if (incompleteFragment.length > 0) {
      console.log(`[SYNC] 🔄 Buffering incomplete fragment (${incompleteFragment.length} chars): "${incompleteFragment}"`);
      this.syncBuffer = incompleteFragment;
      this.lastSyncTime = Date.now(); // Start timer for fragment
    } else {
      console.log(`[SYNC] 🟢 No incomplete fragment - buffer cleared`);
      this.syncBuffer = '';
    }
    
    // Check for timeout on buffered fragment
    if (this.syncBuffer.length > 0) {
      const dynamicTimeout = this.calculateSyncTimeout();
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      
      if (timeSinceLastSync > dynamicTimeout) {
        // Timeout reached - process incomplete fragment
        console.log(`[SYNC] ⏱️ Timeout (${dynamicTimeout.toFixed(1)}ms) - processing incomplete fragment: "${this.syncBuffer}"`);
        
        if (this.isAsciiPrintable(this.syncBuffer)) {
          results.push(this.syncBuffer);
        } else {
          console.log(`[SYNC] ⚠️ Non-ASCII fragment, dumping as hex:`);
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
      const hexLine = bytes.slice(i, i + bytesPerLine).join(' ').padEnd(bytesPerLine * 3 - 1, ' ');
      const asciiLine = ascii.slice(i, i + bytesPerLine).join('');
      console.log(`[SYNC] ${i.toString(16).padStart(4, '0')}: ${hexLine} | ${asciiLine}`);
    }
  }



  private DISPLAY_SCOPE: string = 'SCOPE';
  private DISPLAY_TERM: string = 'TERM';
  private DISPLAY_PLOT: string = 'PLOT';
  private DISPLAY_LOGIC: string = 'LOGIC';
  private DISPLAY_BITMAP: string = 'BITMAP';
  private DISPLAY_MIDI: string = 'MIDI';

  private handleDebugCommand(data: string) {
    //const lineParts: string[] = data.split(' ').filter(Boolean); // extra whitespace caused empty strings
    // Split the data and remove empty values
    const lineParts: string[] = data.split(' ').filter((part) => part.trim() !== '');
    this.logMessage(`* handleDebugCommand() - [${data}]: lineParts=[${lineParts.join(' | ')}](${lineParts.length})`);
    const possibleName: string = lineParts[0].substring(1).toUpperCase();
    let foundDisplay: boolean = false;
    if (lineParts[0].charAt(0) === '`') {
      // first, is this for one of our displays?
      const displayEntries = Object.entries(this.displays);
      displayEntries.forEach(([displayName, window]) => {
        if (displayName.toUpperCase() === possibleName) {
          // found it, route to the window handler
          const debugWindow = window as DebugWindowBase;
          // remove commas from the data
          const cleanedParts: string[] = lineParts.map((part) => part.replace(/,/g, ''));
          debugWindow.updateContent(cleanedParts); // NOTE: this will eventually show the debug window!
          foundDisplay = true;
        }
      });
      if (!foundDisplay) {
        // 2nd, is it a window creation command?
        // For LOGIC windows, check if the name ends with "LOGIC"
        // This handles commands like `MyLogic which should create a LOGIC window
        let windowType = possibleName;
        if (possibleName.endsWith('LOGIC')) {
          windowType = 'LOGIC';
        } else if (possibleName.endsWith('TERM')) {
          windowType = 'TERM';
        } else if (possibleName.endsWith('SCOPE')) {
          windowType = 'SCOPE';
        }
        
        this.logMessage(`* handleDebugCommand() - possibleName=[${possibleName}], windowType=[${windowType}]`);
        switch (windowType) {
          case this.DISPLAY_SCOPE: {
            // create new window to display scope data
            const [isValid, scopeSpec] = DebugScopeWindow.parseScopeDeclaration(lineParts);
            this.logMessage(`* handleDebugCommand() - back from parse`);
            if (isValid) {
              // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
              const scopeDisplay = new DebugScopeWindow(this.context, scopeSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(scopeSpec.displayName, scopeDisplay);
            } else {
              if (this.context.runEnvironment.loggingEnabled) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          case this.DISPLAY_LOGIC: {
            console.log(`[LOGIC WINDOW CREATION] Starting LOGIC window creation for: ${data}`);
            console.log(`[LOGIC WINDOW CREATION] LineParts: [${lineParts.join(' | ')}]`);
            
            // create new window to display scope data
            const [isValid, logicSpec] = DebugLogicWindow.parseLogicDeclaration(lineParts);
            console.log(`[LOGIC WINDOW CREATION] Parse result: isValid=${isValid}`);
            if (logicSpec) {
              console.log(`[LOGIC WINDOW CREATION] LogicSpec:`, JSON.stringify(logicSpec, null, 2));
            }
            
            this.logMessage(`* handleDebugCommand() - back from parse`);
            if (isValid) {
              console.log(`[LOGIC WINDOW CREATION] Creating DebugLogicWindow instance...`);
              // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
              const logicDisplay = new DebugLogicWindow(this.context, logicSpec);
              console.log(`[LOGIC WINDOW CREATION] Instance created, now hooking notifications...`);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(logicSpec.displayName, logicDisplay);
              console.log(`[LOGIC WINDOW CREATION] ✅ LOGIC window '${logicSpec.displayName}' should be visible now!`);
            } else {
              console.log(`[LOGIC WINDOW CREATION] ❌ Failed to parse LOGIC command: ${data}`);
              if (this.context.runEnvironment.loggingEnabled) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          case this.DISPLAY_TERM: {
            // create new window to display term data
            console.log(`[TERM CREATION] Processing TERM command: ${data}`);
            console.log(`[TERM CREATION] LineParts: [${lineParts.join(' | ')}]`);
            const [isValid, termSpec] = DebugTermWindow.parseTermDeclaration(lineParts);
            console.log(`[TERM CREATION] Parse result: isValid=${isValid}, termSpec=`, termSpec);
            this.logMessage(`* handleDebugCommand() - back from parse, isValid=${isValid}`);
            if (isValid) {
              // create new window from spec, recording the new window has name: termSpec.displayName so we can find it later
              console.log(`[TERM CREATION] Creating DebugTermWindow with spec:`, termSpec);
              const termDisplay = new DebugTermWindow(this.context, termSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(termSpec.displayName, termDisplay);
              console.log(`[TERM CREATION] ✅ Successfully created TERM window: ${termSpec.displayName}`);
            } else {
              console.log(`[TERM CREATION] ❌ Failed to parse TERM command: ${data}`);
              if (this.context.runEnvironment.loggingEnabled) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          case this.DISPLAY_PLOT: {
            // create new window to display scope data
            const [isValid, plotSpec] = DebugPlotWindow.parsePlotDeclaration(lineParts);
            this.logMessage(`* handleDebugCommand() - back from parse`);
            if (isValid) {
              // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
              const plotDisplay = new DebugPlotWindow(this.context, plotSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(plotSpec.displayName, plotDisplay);
            } else {
              if (this.context.runEnvironment.loggingEnabled) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          case this.DISPLAY_BITMAP: {
            // create new window to display bitmap data
            const [isValid, bitmapSpec] = DebugBitmapWindow.parseBitmapDeclaration(lineParts);
            this.logMessage(`* handleDebugCommand() - back from parse`);
            if (isValid) {
              // create new window from spec, recording the new window has name: bitmapSpec.displayName so we can find it later
              const bitmapDisplay = new DebugBitmapWindow(this.context, bitmapSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(bitmapSpec.displayName, bitmapDisplay);
            } else {
              if (this.context.runEnvironment.loggingEnabled) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          case this.DISPLAY_MIDI: {
            // Create new MIDI window using standardized pattern
            const [isValid, midiSpec] = DebugMidiWindow.parseMidiDeclaration(lineParts);
            if (isValid) {
              // create new window from spec, recording the new window has name: midiSpec.displayName so we can find it later
              const midiDisplay = new DebugMidiWindow(this.context, midiSpec);
              // remember active displays!
              this.hookNotifcationsAndRememberWindow(midiSpec.displayName, midiDisplay);
            } else {
              if (this.context.runEnvironment.loggingEnabled) {
                this.logMessage(`BAD DISPLAY: Received: ${data}`);
              }
            }
            foundDisplay = true;
            break;
          }
          default:
            this.logMessage(`ERROR: display [${possibleName}] not supported!`);
            break;
        }
      }
      if (foundDisplay) {
        this.immediateLog = false; // change from immediate log to buffered log
      }
      if (!foundDisplay && this.mainWindow != null) {
        if (this.context.runEnvironment.loggingEnabled) {
          this.logMessage(`* Received: ${data} - UNHANDLED  lineParts=[${lineParts.join(',')}]`);
        }
      }
    }
  }

  private hookNotifcationsAndRememberWindow(windowName: string, windowObject: DebugWindowBase) {
    this.logMessage(`GOOD DISPLAY: Received for ${windowName}`);
    // esure we get notifications of window close
    windowObject.on('close', () => {
      this.logMessage(`CallBack: Window ${windowName} is closing.`);
      this.cleanupOnClose(windowName);
    });
    windowObject.on('closed', () => {
      this.logMessage(`CallBack: Window ${windowName} has closed.`);
    });
    // remember active displays!
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
      console.log('[DEBUG LOGGER] Creating debug logger window...');
      try {
        this.debugLoggerWindow = DebugLoggerWindow.getInstance(this.context);
        // Register it in displays for cleanup tracking
        this.displays['DebugLogger'] = this.debugLoggerWindow;
        
        // Set up cleanup handler
        this.debugLoggerWindow.on('close', () => {
          this.logMessage('Debug Logger Window closed');
          console.log('[DEBUG LOGGER] Window closed by user');
          delete this.displays['DebugLogger'];
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
        console.log(`[COG] ${data}`);
        return;
      }
    }
    
    // Route FULL message to debug logger (don't strip prefix)
    // Window will decide what to display
    if (this.debugLoggerWindow) {
      console.log(`[DEBUG LOGGER] Sending message: ${data}`);
      // updateContent expects array format
      this.debugLoggerWindow.updateContent([data]);
    } else {
      // Fallback to console if logger window is unavailable
      console.error('[DEBUG LOGGER] Window not available, falling back to console');
      console.log(`[DEBUG OUTPUT] ${data}`);
    }
    
    // Check for embedded backtick commands within the Cog message
    // Format: "Cog0: Some text `TERM TestTerm SIZE 40 20"
    const backtickIndex = data.indexOf('`');
    if (backtickIndex !== -1) {
      const embeddedCommand = data.substring(backtickIndex);
      if (this.context.runEnvironment.loggingEnabled) {
        this.logMessage(`* Extracting embedded command from Cog message: ${embeddedCommand}`);
      }
      // Route the embedded command to the appropriate debug window
      this.handleDebugCommand(embeddedCommand);
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
    console.log(`work area size: ${width} x ${height}`);

    // Use default font metrics for initial window sizing
    // Actual metrics will be measured after window loads
    const charWidth = 12; // Default character width
    const charHeight = 18; // Default character height
    console.log(`     char size (default): ${charWidth} x ${charHeight}`);

    // Calculate the required dimensions for 24 lines by 80 characters
    const minWidth = 80 * charWidth; // Minimum width for 80 characters
    const minHeight = (24 + 1) * charHeight; // Minimum height for 24 lines + 1 for xmit data entry

    // have small screen
    // linux: 1280x720
    // set to 80x24 porportioned screen

    // have larger screen
    // macOS (rt): 3200x1775
    // macOS (lt): 3200?x1775?
    // set to 80x24 porportioned screen
    const targetScreenWidth: number = height < 800 ? Math.round(width / 2) : Math.round(width / 4);
    const targetScreenHeight: number =
      height < 800 ? Math.round((height / 5) * 2) : Math.round(this.mainWindowGeometry.width / 3.3);

    // Ensure the window is at least the minimum size
    this.mainWindowGeometry.width = Math.max(minWidth, targetScreenWidth);
    this.mainWindowGeometry.height = Math.max(minHeight, targetScreenHeight);
    // position window bottom-center
    this.mainWindowGeometry.xOffset = Math.round((width - this.mainWindowGeometry.width) / 2);  // Center horizontally
    this.mainWindowGeometry.yOffset = Math.round(height - this.mainWindowGeometry.height - 50);  // Bottom with 50px margin

    console.log(
      `window geom: ${this.mainWindowGeometry.width}x${this.mainWindowGeometry.height} @${this.mainWindowGeometry.xOffset},${this.mainWindowGeometry.yOffset}`
    );
  }

  private async createAppWindow() {
    console.log('[STARTUP] createAppWindow() called');
    this.context.logger.forceLogMessage(`* create App Window()`);
    this.mainWindowOpen = true;

    try {
      await this.CalcWindowCoords();
    } catch (error) {
      console.error('[STARTUP] ERROR in CalcWindowCoords:', error);
      // Use default coords
    }

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

    const dataEntryBGColor: string = this.termColors.xmitBGColor;
    const dataEntryFGColor: string = this.termColors.xmitFGColor;
    const logContentBGColor: string = this.termColors.rcvBGColor;
    const logContentFGColor: string = this.termColors.rcvFGColor;

    // Check if we're in IDE mode
    const isIdeMode = this.context.runEnvironment.ideMode;

    // and load the main window .html of the app
    const htmlContent = isIdeMode ? this.createIDEModeHTML() : this.createStandardHTML();

    this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Only set up menu in standard mode
    console.log(`[MENU SETUP] IDE Mode: ${isIdeMode}, Setting up menu: ${!isIdeMode}`);
    // Set up the system menu (macOS only, prevents "Electron" from showing)
    this.setupApplicationMenu();
    
    if (!isIdeMode) {
      console.log('[MENU SETUP] Standalone Mode - HTML menu bar will be used');
      // Standard mode: HTML menu bar in the window
      // No native menu bar in window on any platform
      this.mainWindow.setMenuBarVisibility(false);
    } else {
      console.log('[MENU SETUP] IDE Mode - No menus');
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
  private updateControlLineUI(): void {
    // Regenerate the toolbar HTML with the correct control
    const toolbarHTML = this.getControlLineHTML();
    const isIdeMode = this.context.runEnvironment.ideMode;
    
    // Update the toolbar element
    this.safeExecuteJS(`
      const toolbar = document.getElementById('toolbar');
      if (toolbar) {
        // Find the control line elements (before first separator)
        const separator = toolbar.querySelector('.toolbar-separator');
        if (separator) {
          // Remove old control elements
          while (toolbar.firstChild && toolbar.firstChild !== separator) {
            toolbar.removeChild(toolbar.firstChild);
          }
          
          // Insert new control HTML
          const temp = document.createElement('div');
          temp.innerHTML = \`${toolbarHTML.replace(/`/g, '\\`')}\`;
          while (temp.firstChild) {
            toolbar.insertBefore(temp.firstChild, separator);
          }
          
          // Re-attach event handlers (with duplicate prevention)
          ${this.controlLineMode === 'DTR' ? `
            const dtrToggle = document.getElementById('dtr-toggle');
            const dtrCheckbox = document.getElementById('dtr-checkbox');
            if (dtrToggle && !dtrToggle.hasAttribute('data-listener-attached')) {
              dtrToggle.setAttribute('data-listener-attached', 'true');
              dtrToggle.addEventListener('click', () => {
                window.ipcRenderer.send('toggle-dtr');
              });
            }
            if (dtrCheckbox) {
              if (!dtrCheckbox.hasAttribute('data-listener-attached')) {
                dtrCheckbox.setAttribute('data-listener-attached', 'true');
                dtrCheckbox.addEventListener('change', (e) => {
                  if (!e.isTrusted) return;
                  window.ipcRenderer.send('toggle-dtr');
                });
              }
              // Set current state
              dtrCheckbox.checked = ${this.dtrState};
            }
          ` : `
            const rtsToggle = document.getElementById('rts-toggle');
            const rtsCheckbox = document.getElementById('rts-checkbox');
            if (rtsToggle && !rtsToggle.hasAttribute('data-listener-attached')) {
              rtsToggle.setAttribute('data-listener-attached', 'true');
              rtsToggle.addEventListener('click', () => {
                window.ipcRenderer.send('toggle-rts');
              });
            }
            if (rtsCheckbox) {
              if (!rtsCheckbox.hasAttribute('data-listener-attached')) {
                rtsCheckbox.setAttribute('data-listener-attached', 'true');
                rtsCheckbox.addEventListener('change', (e) => {
                  if (!e.isTrusted) return;
                  window.ipcRenderer.send('toggle-rts');
                });
              }
              // Set current state
              rtsCheckbox.checked = ${this.rtsState};
            }
          `}
        }
      }
    `, 'update control line UI');
  }

  /**
   * Generate HTML for control line (DTR or RTS) based on current mode
   * Only shows the active control line to reduce UI confusion
   */
  private getControlLineHTML(): string {
    if (this.controlLineMode === 'RTS') {
      return `
        <button id="rts-toggle" class="toolbar-button">RTS</button>
        <input type="checkbox" id="rts-checkbox" style="margin-left: 5px;">
      `;
    } else {
      // Default to DTR (Parallax standard)
      return `
        <button id="dtr-toggle" class="toolbar-button">DTR</button>
        <input type="checkbox" id="dtr-checkbox" style="margin-left: 5px;">
      `;
    }
  }

  private createIDEModeHTML(): string {
    const logContentBGColor: string = this.termColors.rcvBGColor;
    const logContentFGColor: string = this.termColors.rcvFGColor;
    
    // Minimal UI for IDE mode - just log content
    return `
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
        #log-content {
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
      <div id="log-content"></div>
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
    return `
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
          background-color: #FF00FF; /* MAGENTA - for debugging exposed areas */
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
        #log-content {
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
        }
        /* Font styles for terminal */
        #log-content.font-default {
          font-family: Consolas, 'Courier New', monospace;
        }
        #log-content.font-parallax {
          font-family: 'Parallax', Consolas, monospace;
        }
        #log-content.font-ibm3270 {
          font-family: 'IBM 3270', 'Courier New', monospace;
          font-size: 14px;
        }
        /* IBM 3270 Green Phosphor theme */
        #log-content.font-ibm3270-green {
          font-family: 'IBM 3270', 'Courier New', monospace;
          font-size: 14px;
          background-color: #000000;
          color: #00FF00;
          text-shadow: 0 0 2px #00FF00;
        }
        /* IBM 3270 Amber Phosphor theme */
        #log-content.font-ibm3270-amber {
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
              <div class="menu-dropdown-item" data-action="menu-settings">Settings... <span style="float: right; color: #999;">Ctrl+,</span></div>
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
            </div>
          </div>
          <div class="menu-item" data-menu="debug">
            <span>Debug</span>
            <div class="menu-dropdown">
              <div class="menu-dropdown-item" data-action="menu-open-debugger">Open Debugger ▶
                <div class="menu-dropdown submenu" style="display: none; position: absolute; left: 100%; top: 0;">
                  <div class="menu-dropdown-item" data-action="menu-debugger-cog0">COG 0</div>
                  <div class="menu-dropdown-item" data-action="menu-debugger-cog1">COG 1</div>
                  <div class="menu-dropdown-item" data-action="menu-debugger-cog2">COG 2</div>
                  <div class="menu-dropdown-item" data-action="menu-debugger-cog3">COG 3</div>
                  <div class="menu-dropdown-item" data-action="menu-debugger-cog4">COG 4</div>
                  <div class="menu-dropdown-item" data-action="menu-debugger-cog5">COG 5</div>
                  <div class="menu-dropdown-item" data-action="menu-debugger-cog6">COG 6</div>
                  <div class="menu-dropdown-item" data-action="menu-debugger-cog7">COG 7</div>
                </div>
              </div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-break-all">Break All</div>
              <div class="menu-dropdown-item" data-action="menu-resume-all">Resume All <span style="float: right; color: #999;">F5</span></div>
              <hr class="menu-separator" style="margin: 4px 0; border: none; border-top: 1px solid #555;">
              <div class="menu-dropdown-item" data-action="menu-performance-monitor">Performance Monitor</div>
            </div>
          </div>
          <div class="menu-item" data-menu="window">
            <span>Window</span>
            <div class="menu-dropdown">
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
          <label for="font-selector" style="margin-right: 5px; font-size: 12px;">Font:</label>
          <select id="font-selector" class="toolbar-button" style="padding: 2px 5px;">
            <option value="default">Default</option>
            <option value="parallax">Parallax</option>
            <option value="ibm3270">IBM 3270</option>
            <option value="ibm3270-green">IBM 3270 Green</option>
            <option value="ibm3270-amber">IBM 3270 Amber</option>
          </select>
        </div>
        <div id="log-content">
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
          <div id="performance-display" class="status-field" title="Performance metrics: throughput | buffer usage | queue depth | status">
            <span id="perf-indicator" style="color: #00FF00; margin-right: 3px; font-size: 16px; text-shadow: 0 0 2px #000;">⚡</span>
            <span class="status-value" id="perf-metrics">0kb/s | Buffer: 0% | Queue: 0 | ✓</span>
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
        console.log('[MENU] Script execution started');
        // IPC Setup - runs directly in renderer with node integration
        const { ipcRenderer } = require('electron');
        console.log('[MENU] ipcRenderer loaded:', !!ipcRenderer);
        // Expose ipcRenderer globally for all scripts to use
        window.ipcRenderer = ipcRenderer;
        
        // Wait for DOM to be ready
        console.log('[MENU] Setting up DOMContentLoaded event listener');
        document.addEventListener('DOMContentLoaded', () => {
          console.log('[MENU] DOMContentLoaded event fired!');
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
          
          // Listen for DTR state updates from main process
          ipcRenderer.on('update-dtr-state', (event, state) => {
            console.log('[IPC] Received DTR state update:', state);
            const checkbox = document.getElementById('dtr-checkbox');
            if (checkbox) {
              // Temporarily remove listener to avoid loops
              const oldListener = checkbox.onchange;
              checkbox.onchange = null;
              checkbox.checked = state;
              checkbox.onchange = oldListener;
              console.log('[DTR] Checkbox updated to:', state);
            }
          });
          
          // Listen for RTS state updates from main process
          ipcRenderer.on('update-rts-state', (event, state) => {
            console.log('[IPC] Received RTS state update:', state);
            const checkbox = document.getElementById('rts-checkbox');
            if (checkbox) {
              // Temporarily remove listener to avoid loops
              const oldListener = checkbox.onchange;
              checkbox.onchange = null;
              checkbox.checked = state;
              checkbox.onchange = oldListener;
              console.log('[RTS] Checkbox updated to:', state);
            }
          });
          
          // Echo checkbox
          const echoCheckbox = document.getElementById('echo-checkbox');
          if (echoCheckbox) {
            echoCheckbox.addEventListener('change', (e) => {
              ipcRenderer.send('toggle-echo', e.target.checked);
            });
          }
          
          // Font selector
          const fontSelector = document.getElementById('font-selector');
          const logContent = document.getElementById('log-content');
          if (fontSelector && logContent) {
            fontSelector.addEventListener('change', (e) => {
              logContent.className = logContent.className.replace(/font-[\w-]+/g, '').trim();
              const selectedFont = e.target.value;
              logContent.classList.add('font-' + selectedFont);
              localStorage.setItem('terminal-font', selectedFont);
            });
            
            // Load saved preference
            const savedFont = localStorage.getItem('terminal-font') || 'default';
            fontSelector.value = savedFont;
            logContent.classList.add('font-' + savedFont);
          }
          
          // Menu initialization moved to programmatic injection after window loads
          // This avoids data URL script execution restrictions
          const isIdeModeJS = ${this.context.runEnvironment.ideMode};
          console.log('[MENU] IDE Mode in renderer:', isIdeModeJS);
          
          // OLD MENU INITIALIZATION - KEPT FOR REFERENCE BUT NOT USED
          // Menu is now initialized programmatically from main process
          /*
          const initMenu = () => {
            console.log('[MENU] Initializing menu event handlers...');
            console.log('[MENU] window.ipcRenderer available:', !!window.ipcRenderer);
            
            const menuBar = document.getElementById('menu-bar');
            if (menuBar) {
              console.log('[MENU] Found menu bar element');
              console.log('[MENU] Menu bar innerHTML length:', menuBar.innerHTML.length);
              
              const menuItems = document.querySelectorAll('.menu-item');
              console.log('[MENU] Found', menuItems.length, 'menu items');
              
              // Add menu click handlers
              menuItems.forEach((item, index) => {
                  console.log('[MENU] Attaching handler to menu item', index, ':', item.textContent);
                  item.addEventListener('click', (e) => {
                    console.log('[MENU] Menu item clicked! Index:', index, 'Text:', item.textContent);
                    e.stopPropagation();
                    const dropdown = item.querySelector('.menu-dropdown');
                    // Close all other dropdowns
                    document.querySelectorAll('.menu-dropdown').forEach(d => {
                      if (d !== dropdown) d.style.display = 'none';
                    });
                    // Toggle this dropdown
                    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                  });
                });
                
                // Add handlers for menu dropdown items
                const dropdownItems = document.querySelectorAll('.menu-dropdown-item');
                console.log('[MENU] Found', dropdownItems.length, 'dropdown items');
                
                dropdownItems.forEach((item, index) => {
                  const action = item.getAttribute('data-action');
                  console.log('[MENU] Attaching handler to dropdown item', index, 'action:', action);
                  
                  item.addEventListener('click', (e) => {
                    console.log('[MENU] Dropdown item clicked! Action:', action);
                    e.stopPropagation();
                    console.log('[MENU] Processing action:', action);
                    
                    // Handle the action
                    switch(action) {
                      case 'copy':
                        document.execCommand('copy');
                        break;
                      case 'paste':
                        document.execCommand('paste');
                        break;
                      default:
                        // Send IPC message for other actions
                        if (action && window.ipcRenderer) {
                          console.log('[MENU] Sending IPC message:', action);
                          window.ipcRenderer.send(action);
                        } else if (action) {
                          console.error('[MENU] ipcRenderer not available for action:', action);
                        }
                        break;
                    }
                    
                    // Close dropdown after action
                    document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');
                  });
                });
                
                // Close menu when clicking outside
                document.addEventListener('click', () => {
                  document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');
                });
                
                console.log('[MENU] Menu bar initialized successfully');
                console.log('[MENU] Menu items found:', document.querySelectorAll('.menu-item').length);
                console.log('[MENU] Menu dropdown items found:', document.querySelectorAll('.menu-dropdown-item').length);
            } else {
              console.error('[MENU] Menu bar element not found!');
            }
          };
          
          // Check if DOM is already loaded or wait for it
          console.log('[MENU] Document ready state:', document.readyState);
          console.log('[MENU] Menu bar HTML exists:', !!document.getElementById('menu-bar'));
          console.log('[MENU] Menu items exist:', document.querySelectorAll('.menu-item').length);
          
          if (document.readyState === 'loading') {
            console.log('[MENU] DOM still loading, waiting for DOMContentLoaded...');
            // DOM is still loading, wait for it
            document.addEventListener('DOMContentLoaded', () => {
              console.log('[MENU] DOMContentLoaded event fired!');
              // initMenu();  // Commented out - menu initialized from main process
            });
          } else {
            console.log('[MENU] DOM already loaded, initializing menu immediately...');
            // DOM is already loaded, initialize immediately
            // initMenu();  // Commented out - menu initialized from main process
          }
          */
        });
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
    
    // File menu handlers
    ipcMain.removeAllListeners('menu-new-recording');
    ipcMain.removeAllListeners('menu-open-recording');
    ipcMain.removeAllListeners('menu-save-recording');
    ipcMain.removeAllListeners('menu-start-recording');
    ipcMain.removeAllListeners('menu-stop-recording');
    ipcMain.removeAllListeners('menu-playback-recording');
    ipcMain.removeAllListeners('menu-settings');
    ipcMain.removeAllListeners('menu-quit');
    
    // Edit menu handlers
    ipcMain.removeAllListeners('menu-find');
    ipcMain.removeAllListeners('menu-clear');
    
    // Debug menu handlers
    ipcMain.removeAllListeners('menu-debugger-cog0');
    ipcMain.removeAllListeners('menu-debugger-cog1');
    ipcMain.removeAllListeners('menu-debugger-cog2');
    ipcMain.removeAllListeners('menu-debugger-cog3');
    ipcMain.removeAllListeners('menu-debugger-cog4');
    ipcMain.removeAllListeners('menu-debugger-cog5');
    ipcMain.removeAllListeners('menu-debugger-cog6');
    ipcMain.removeAllListeners('menu-debugger-cog7');
    ipcMain.removeAllListeners('menu-break-all');
    ipcMain.removeAllListeners('menu-resume-all');
    ipcMain.removeAllListeners('menu-performance-monitor');
    
    // Window menu handlers
    ipcMain.removeAllListeners('menu-cascade');
    ipcMain.removeAllListeners('menu-tile');
    ipcMain.removeAllListeners('menu-show-all');
    ipcMain.removeAllListeners('menu-hide-all');
    
    // Help menu handlers
    ipcMain.removeAllListeners('menu-documentation');
    ipcMain.removeAllListeners('menu-about');
    
    // DTR/RTS Toggle Handlers
    ipcMain.on('toggle-dtr', async () => {
      console.log('[IPC] Received toggle-dtr request');
      await this.toggleDTR();
    });
    
    ipcMain.on('toggle-rts', async () => {
      console.log('[IPC] Received toggle-rts request');
      await this.toggleRTS();
    });
    
    // File menu handlers
    ipcMain.on('menu-new-recording', () => {
      console.log('[IPC] New recording');
      // Clear current recording if any and start fresh
      this.windowRouter.stopRecording();
      this.startRecording();
    });
    
    ipcMain.on('menu-open-recording', async () => {
      console.log('[IPC] Open recording');
      await this.playRecording();
    });
    
    ipcMain.on('menu-save-recording', async () => {
      console.log('[IPC] Save recording');
      // Stop recording first to flush buffer
      this.windowRouter.stopRecording();
      
      // TODO: Access the saved recording file
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        title: 'Save Recording As',
        defaultPath: `recording_${getFormattedDateTime()}.jsonl`,
        filters: [{ name: 'Recording Files', extensions: ['jsonl'] }]
      });
      
      if (!result.canceled && result.filePath) {
        // The recording is already saved by stopRecording()
        // We would need to copy/move it to the user's chosen location
        console.log('[RECORDING] Would save to:', result.filePath);
      }
    });
    
    ipcMain.on('menu-start-recording', () => {
      console.log('[IPC] Start recording');
      this.startRecording();
    });
    
    ipcMain.on('menu-stop-recording', () => {
      console.log('[IPC] Stop recording');
      this.stopRecording();
    });
    
    ipcMain.on('menu-playback-recording', async () => {
      console.log('[IPC] Playback recording');
      await this.playRecording();
    });
    
    ipcMain.on('menu-settings', () => {
      console.log('[IPC] Settings');
      this.showSettingsDialog();
    });
    
    ipcMain.on('menu-quit', () => {
      console.log('[IPC] Quit');
      app.quit();
    });
    
    // Edit menu handlers
    ipcMain.on('menu-find', () => {
      console.log('[IPC] Find');
      // TODO: Implement find dialog
      this.showFindDialog();
    });
    
    ipcMain.on('menu-clear', () => {
      console.log('[IPC] Clear terminal');
      this.clearTerminal();
    });
    
    // Debug menu handlers
    for (let i = 0; i < 8; i++) {
      ipcMain.on(`menu-debugger-cog${i}`, () => {
        console.log(`[IPC] Open debugger for COG ${i}`);
        this.openDebuggerWindow(i);
      });
    }
    
    ipcMain.on('menu-break-all', () => {
      console.log('[IPC] Break all');
      // TODO: Implement break all COGs
      this.breakAllCogs();
    });
    
    ipcMain.on('menu-resume-all', () => {
      console.log('[IPC] Resume all');
      // TODO: Implement resume all COGs
      this.resumeAllCogs();
    });
    
    ipcMain.on('menu-performance-monitor', () => {
      console.log('[IPC] Performance monitor');
      this.showPerformanceMonitor();
    });
    
    // Window menu handlers
    ipcMain.on('menu-cascade', () => {
      console.log('[IPC] Cascade windows');
      this.cascadeWindows();
    });
    
    ipcMain.on('menu-tile', () => {
      console.log('[IPC] Tile windows');
      this.tileWindows();
    });
    
    ipcMain.on('menu-show-all', () => {
      console.log('[IPC] Show all windows');
      this.showAllWindows();
    });
    
    ipcMain.on('menu-hide-all', () => {
      console.log('[IPC] Hide all windows');
      this.hideAllWindows();
    });
    
    // Help menu handlers
    ipcMain.on('menu-documentation', () => {
      console.log('[IPC] Documentation');
      electron.shell.openExternal('https://github.com/parallaxinc/PNut-Term-TS/wiki');
    });
    
    ipcMain.on('menu-about', () => {
      console.log('[IPC] About');
      this.showAboutDialog();
    });
    
    console.log('[IPC] All menu handlers registered');
  }
  
  /**
   * Initialize menu system programmatically after window loads
   * This avoids the data URL script execution restrictions
   */
  private initializeMenu(): void {
    if (!this.mainWindow) return;
    
    console.log('[MENU] Starting programmatic menu initialization...');
    
    // Inject menu event handlers from main process
    this.mainWindow.webContents.executeJavaScript(`
      (function() {
        console.log('[MENU] Programmatic menu setup starting...');
        
        const menuBar = document.getElementById('menu-bar');
        if (!menuBar) {
          console.error('[MENU] Menu bar element not found!');
          return;
        }
        
        console.log('[MENU] Found menu bar, setting up handlers...');
        
        // Get all menu items
        const menuItems = document.querySelectorAll('.menu-item');
        console.log('[MENU] Found ' + menuItems.length + ' menu items');
        
        // Add click handlers to menu items
        menuItems.forEach((item, index) => {
          console.log('[MENU] Attaching handler to menu item ' + index + ': ' + item.textContent);
          
          item.addEventListener('click', (e) => {
            console.log('[MENU] Menu item clicked: ' + item.textContent);
            e.stopPropagation();
            
            const dropdown = item.querySelector('.menu-dropdown');
            if (dropdown) {
              // Close all other dropdowns
              document.querySelectorAll('.menu-dropdown').forEach(d => {
                if (d !== dropdown) d.style.display = 'none';
              });
              
              // Toggle this dropdown
              dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
              console.log('[MENU] Dropdown toggled to: ' + dropdown.style.display);
            }
          });
        });
        
        // Add handlers for dropdown items
        const dropdownItems = document.querySelectorAll('.menu-dropdown-item');
        console.log('[MENU] Found ' + dropdownItems.length + ' dropdown items');
        
        dropdownItems.forEach((item, index) => {
          const action = item.getAttribute('data-action');
          console.log('[MENU] Attaching handler to dropdown item ' + index + ', action: ' + action);
          
          item.addEventListener('click', (e) => {
            console.log('[MENU] Dropdown item clicked, action: ' + action);
            e.stopPropagation();
            
            // Close all dropdowns
            document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');
            
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
                  console.log('[MENU] Sending IPC message: ' + action);
                  ipcRenderer.send(action);
                } catch (err) {
                  console.error('[MENU] Failed to send IPC:', err);
                  // Fallback to window.ipcRenderer if available
                  if (window.ipcRenderer) {
                    window.ipcRenderer.send(action);
                  }
                }
              }
            }
          });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', () => {
          document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');
        });
        
        console.log('[MENU] Menu initialization complete');
        return 'Menu initialized';
      })();
    `).then((result: any) => {
      console.log('[MENU] Menu injection result:', result);
    }).catch((error: any) => {
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
          this.safeExecuteJS(`
            (function() {
              const terminal = document.getElementById('log-content');
              if (terminal) {
                terminal.innerHTML = '';
                terminal.dataset.cursorX = '0';
                terminal.dataset.cursorY = '0';
              }
            })();
          `, 'clear terminal on mode switch');
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
        case 'menu-settings':
          this.showSettingsDialog();
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
      
      // Initialize menu if in standalone mode
      if (!isIdeMode) {
        console.log('[MENU] Injecting menu setup after window load...');
        this.initializeMenu();
      }
      
      // CRITICAL: Auto-create Debug Logger Window immediately on startup
      // This ensures logging starts immediately, not waiting for first message
      this.createDebugLoggerWindow();
      
      // Load terminal mode setting after window is ready
      this.loadTerminalMode();
      
      // Measure actual font metrics now that window is ready
      this.measureAndStoreFontMetrics();
      
      // Initialize download mode LEDs after DOM is ready
      this.updateDownloadMode(this.downloadMode);
      
      // Start performance monitoring now that DOM is ready
      this.startPerformanceMonitoring();
      console.log('[PERF DISPLAY] Performance monitoring started after DOM ready');
      
      // Initialize activity LEDs to OFF state
      this.safeExecuteJS(`
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
      `, 'initialize-activity-leds');
      
      // Initialize serial connection after DOM is ready
      if (this._deviceNode.length > 0 && !this._serialPort) {
        this.logMessage(`* Opening serial port after DOM ready: ${this._deviceNode}`);
        this.openSerialPort(this._deviceNode);
      }
      
      // Setup logging configuration
      let logDisplayName: string = this.context.runEnvironment.logFilename;
      if (logDisplayName.length == 0) {
        logDisplayName = '{none}';
        this.loggingToFile = false;
        // Initialize log LED to OFF state
        this.updateLoggingStatus(false);
      } else {
        this.enableLogging(logDisplayName);
      }
      
      // Update status bar with device info
      if (this._deviceNode.length > 0) {
        this.updateStatusBarField('propPlug', this._deviceNode);
      }
      
      // Set up font selector dropdown - defer until DOM is ready
      this.mainWindow!.webContents.once('dom-ready', () => {
        this.safeExecuteJS(`
          // Font selector dropdown - DOM should be ready now
          const fontSelector = document.getElementById('font-selector');
          const logContent = document.getElementById('log-content');
          if (fontSelector && logContent) {
            console.log('[FONT SELECTOR] Elements found, setting up...');
            fontSelector.addEventListener('change', (e) => {
              // Remove all font classes
              logContent.className = logContent.className.replace(/font-[\\w-]+/g, '').trim();
              // Add the selected font class
              const selectedFont = e.target.value;
              logContent.classList.add('font-' + selectedFont);
              
              // Store preference (could be saved to settings file later)
              localStorage.setItem('terminal-font', selectedFont);
            });
            
            // Load saved preference
            const savedFont = localStorage.getItem('terminal-font') || 'default';
            fontSelector.value = savedFont;
            logContent.classList.add('font-' + savedFont);
            console.log('[FONT SELECTOR] Setup complete with font:', savedFont);
          } else {
            console.error('[FONT SELECTOR] Elements not found - fontSelector:', !!fontSelector, 'logContent:', !!logContent);
          }
        `, 'font-selector-setup');
      });
      
      // Setup text input control for data entry
      this.hookTextInputControl('dataEntry', (event: Event) => {
        const inputElement = event.target as HTMLInputElement;
        console.log(`Input value: [${inputElement.value}]`);
        if (event instanceof KeyboardEvent && event.key === 'Enter') {
          this.sendSerialData(inputElement.value);
          inputElement.value = '';
        }
      });
      
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
    console.log('[MENU SETUP] Starting createApplicationMenu()');
    
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
    console.log('[MENU SETUP] No system menu for Windows/Linux - using HTML menu bar');
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
            click: () => this.showSettingsDialog()
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
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
    console.log('[MENU SETUP] ✅ macOS system menu set');
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
                detail: `Runtime Versions:\n` +
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
              console.log('MENU: Application is quitting...');
              this.knownClosedBy = true;
              app.quit();
            }
          }
        ]
      },
      {
        label: 'File',
        submenu: [
          {
            label: '&Log to file...',
            click: () => {
              dialog
                .showSaveDialog(this.mainWindow!, {
                  title: 'Save Log',
                  defaultPath: `./Logs/${this.logFilenameBase}`,
                  filters: [{ name: 'Text Files', extensions: ['txt'] }]
                })
                .then((result: any) => {
                  if (!result.canceled && result.filePath) {
                    const logFilename: string = this.enableLogging(result.filePath);
                    // Log name field removed from status bar per user request
                    this.safeExecuteJS('document.getElementById("log-content").innerText', 'get-log-content')
                      .then((fileContent: string | undefined) => {
                        if (fileContent !== undefined) {
                          fs.writeFileSync(this.logFileSpec!, fileContent);
                        }
                      });
                  }
                })
                .catch((error: Error) => {
                  console.error('Failed to show save dialog:', error);
                });
            }
          }
        ]
      },
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
            click: () => this.showSettingsDialog()
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
    console.log('[MENU] Showing connection dialog');
    
    // Get available serial ports using UsbSerial
    const deviceList = await UsbSerial.serialDeviceList(this.context);
    const portList = deviceList
      .map((device: string) => ({
        label: device,
        value: device
      }));
    
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
    
    // Create a simple HTML dialog for port selection
    const dialogHTML = `
      <div style="padding: 20px;">
        <h3>Select Serial Port</h3>
        <select id="port-select" style="width: 100%; padding: 5px; margin: 10px 0;">
          ${portList.map((port: any) => `<option value="${port.value}">${port.label}</option>`).join('')}
        </select>
        <div style="margin-top: 15px;">
          <label>
            <input type="radio" name="control-line" value="DTR" checked> DTR (Parallax standard)
          </label>
          <br>
          <label>
            <input type="radio" name="control-line" value="RTS"> RTS
          </label>
        </div>
        <div style="margin-top: 20px; text-align: right;">
          <button onclick="window.close()">Cancel</button>
          <button onclick="
            const port = document.getElementById('port-select').value;
            const controlLine = document.querySelector('input[name=control-line]:checked').value;
            window.ipcRenderer.send('connect-port', { port, controlLine });
            window.close();
          " style="margin-left: 10px;">Connect</button>
        </div>
      </div>
    `;
    
    // For now, use a simple dialog
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
      console.log('[MENU] Connecting to port:', selectedPort);
      await this.connectSerialPort(selectedPort);
    }
  }
  
  private async connectSerialPort(deviceNode: string): Promise<void> {
    console.log('[MENU] Connecting to serial port:', deviceNode);
    
    // Disconnect any existing connection first
    if (this._serialPort) {
      await this.disconnectSerialPort();
    }
    
    // Open the serial port using existing method
    this._deviceNode = deviceNode;
    await this.openSerialPort(deviceNode);
    
    // Update UI to show connected state
    if (this._serialPort) {
      this.safeExecuteJS(`
        (function() {
          const propPlug = document.querySelector('#propPlug .status-value');
          if (propPlug) {
            propPlug.textContent = '${deviceNode}';
          }
        })();
      `, 'update connect status');
    }
  }
  
  private async disconnectSerialPort(): Promise<void> {
    console.log('[MENU] Disconnecting serial port');
    
    if (this._serialPort) {
      try {
        await this._serialPort.close();
        console.log('[SERIAL] Port closed successfully');
        
        this._serialPort = undefined;
        this.logMessage('Serial port disconnected');
        
        // Update UI to show disconnected state
        this.safeExecuteJS(`
          (function() {
            const propPlug = document.querySelector('#propPlug .status-value');
            if (propPlug) {
              propPlug.textContent = 'Disconnected';
            }
          })();
        `, 'update disconnect status');
      } catch (error) {
        console.error('[SERIAL] Failed to disconnect:', error);
      }
    } else {
      console.log('[SERIAL] No port to disconnect');
    }
  }
  
  // Window management methods
  private cascadeWindows(): void {
    // TODO: Implement cascade window arrangement
    console.log('[WINDOW] Cascade windows - not yet implemented');
  }
  
  private tileWindows(): void {
    // TODO: Implement tile window arrangement
    console.log('[WINDOW] Tile windows - not yet implemented');
  }
  
  private showAllWindows(): void {
    // Show all debug windows
    const windows = this.windowRouter.getActiveWindows();
    console.log(`[WINDOW] Showing ${windows.length} windows`);
    // TODO: Implement actual show functionality for each window
  }
  
  private hideAllWindows(): void {
    // Hide all debug windows except main
    const windows = this.windowRouter.getActiveWindows();
    console.log(`[WINDOW] Hiding ${windows.length} windows`);
    // TODO: Implement actual hide functionality for each window
  }
  
  // Debug methods
  private openDebuggerWindow(cogId: number): void {
    console.log(`[DEBUG] Opening debugger for COG ${cogId}`);
    // TODO: Create debugger window for specified COG
    const windowName = `p2debugger_cog${cogId}`;
    // For now, just log the request
    console.log(`[DEBUG] Would create window: ${windowName} for COG ${cogId}`);
  }
  
  private breakAllCogs(): void {
    console.log('[DEBUG] Breaking all COGs');
    // TODO: Send break command to all COG debuggers
  }
  
  private resumeAllCogs(): void {
    console.log('[DEBUG] Resuming all COGs');
    // TODO: Send resume command to all COG debuggers
  }
  
  private showPerformanceMonitor(): void {
    console.log('[PERF] Showing performance monitor');
    // TODO: Create performance monitor window
    const stats = this.windowRouter.getRoutingStats();
    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'Performance Monitor',
      message: 'Message Routing Statistics',
      detail: `Messages Routed: ${stats.messagesRouted}\n` +
              `Recording Active: ${stats.recordingActive}\n` +
              `Errors: ${stats.errors}\n\n` +
              `Active Windows: ${this.windowRouter.getActiveWindows().length}`,
      buttons: ['OK']
    });
  }
  
  private showFindDialog(): void {
    console.log('[EDIT] Showing find dialog');
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
    this.safeExecuteJS(`
      (function() {
        const terminal = document.getElementById('log-content');
        if (terminal) {
          terminal.innerHTML = '';
          terminal.dataset.cursorX = '0';
          terminal.dataset.cursorY = '0';
        }
      })();
    `, 'clear terminal');
  }
  
  private saveLogFile(): void {
    const { dialog, fs } = require('electron');
    // TODO: Implement save log file dialog
    console.log('Save log file - to be implemented');
  }
  
  private showAboutDialog(): void {
    const { dialog } = require('electron');
    const packageJson = require('../../package.json');
    
    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'About PNut-Term-TS',
      message: 'PNut-Term-TS',
      detail: `Version: ${packageJson.version}\n` +
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
        https.get('https://api.github.com/repos/parallaxinc/PNut-Term-TS/releases/latest', {
          headers: {
            'User-Agent': 'PNut-Term-TS'
          }
        }, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
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
        console.log('============================================');
        console.log('Closing application - waiting for logs to flush...');
        console.log('============================================');
        
        setTimeout(() => {
          console.log('✅ COMPLETE - Application closed');
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

  private enableLogging(logFilename: string): string {
    let filename: string = '';
    if (logFilename.length == 0) {
      this.loggingToFile = false;
    } else {
      this.loggingToFile = true;
      filename = path.basename(logFilename);
      const logFolder = path.join(this.context.currentFolder, 'Logs');
      ensureDirExists(logFolder);
      this.logFileSpec = path.join(logFolder, filename);
    }
    
    // Update log LED using the dedicated function
    this.updateLoggingStatus(this.loggingToFile, filename);
    
    return filename;
  }

  private getRuntimeVersions() {
    // Get invocation parameters
    const args = process.argv.slice(2); // Skip 'node' and script path
    const argsDisplay = args.length > 0 ? args.join(' ') : 'None';
    const isIdeMode = this.context.runEnvironment.ideMode;
    const modeDisplay = isIdeMode ? 'IDE Mode (no menus)' : 'Standalone Mode';
    
    this.safeExecuteJS(`
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
    `, 'update runtime versions and params');
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
      const metrics = await this.safeExecuteJS(`
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
      `, 'getFontMetrics');
      
      if (metrics) {
        // Override defaults with measured values
        charWidth = metrics.charWidth;
        charHeight = metrics.charHeight;
      }
    } else {
      console.error('ERROR: getFontMetrics() NO Main Window!');
    }
    console.error(`* getFontMetrics() -> (${charWidth}x${charHeight})`);
    return { charWidth, charHeight }; // Default values
  }

  private async measureAndStoreFontMetrics(): Promise<void> {
    try {
      const { charWidth, charHeight } = await this.getFontMetrics('12pt Consolas, sans-serif', 12, 18);
      console.log(`[FONT METRICS] Measured after window ready: ${charWidth} x ${charHeight}`);
      
      // Store for future use - could be used for dynamic window sizing
      // For now, just log the actual measurements
      // TODO: Could implement window resize if metrics differ significantly from defaults
    } catch (error) {
      console.error('[FONT METRICS] Error measuring fonts after window load:', error);
    }
  }

  private hookTextInputControl(inputId: string, callback: (event: Event) => void): void {
    if (this.mainWindow) {
      // Convert the callback function to a string
      const callbackString = callback.toString();

      // Inject JavaScript into the renderer process to attach the callback
      this.safeExecuteJS(`
        (function() {
          const inputElement = document.getElementById('${inputId}');
          if (inputElement) {
            inputElement.addEventListener('input', ${callbackString});
          } else {
            console.error('Input element with id "${inputId}" not found.');
          }
        })();
      `, `hookInputControl-${inputId}`);
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

    // If logging to file, append to output file
    if (this.loggingToFile) {
      this.appendToFile(this.logFileSpec, `${message}\n`);
    }
  }

  private flushLogBuffer() {
    if (this.logBuffer.length > 0) {
      const messages = this.logBuffer.join('\n');
      this.safeExecuteJS(`
        (function() {
          const logContent = document.getElementById('log-content');
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
    this.safeExecuteJS(`
      (function() {
        const logContent = document.getElementById('log-content');
        const p = document.createElement('p');
        p.textContent = "${message}";
        logContent.appendChild(p);
        logContent.scrollTop = logContent.scrollHeight;
      })();
    `, 'append log message');
    
    // and if logging, append to output file
    if (this.loggingToFile) {
      this.appendToFile(this.logFileSpec, `${message}\n`);
    }
  }

  private PEND_MESSAGE_COUNT: number = 100;

  private appendLog(message: string) {
    if (this.mainWindow) {
      this.logBuffer.push(message);
      if (this.logBuffer.length > this.PEND_MESSAGE_COUNT || this.immediateLog) {
        this.flushLogBuffer();
      }
    }
    // and if logging, append to output file
    if (this.loggingToFile) {
      this.appendToFile(this.logFileSpec, `${message}\n`);
    }
  }

  private logBuffer: string[] = [];

  private flushLogBuffer() {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.logBuffer.length > 0) {
      // Serialize the logBuffer array to a JSON string
      // -------------------------------------------------
      // Control Characters
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
      // ---------------------------------------------------
      // remove control characters from string, handle these separately

      // Check if any string in the logBuffer contains control characters
      const hasControlChars = this.logBuffer.some((currString) => /[\x01-\x10]/.test(currString));
      if (hasControlChars) {
        // since we have control characters, let's handle each string individually
        for (let index = 0; index < this.logBuffer.length; index++) {
          const currLine: string = this.logBuffer[index];
          // handle control characters found in any of the strings BUT
          // we need to handle each in the order we find and emit non-control characters as we go
          // Control chars 0x02, 0x0e and 0x0f require x,y or x or y which are the next byte(s) in the string
          // let's also gather the non-control in strings before we emit them.
          let nonControlChars: string = '';
          let i = 0;
          while (i < currLine.length) {
            const charCode = currLine.charCodeAt(i);
            let x: number = 0;
            let y: number = 0;
            // Check if the character is a control character
            if (charCode >= 1 && charCode <= 16) {
              // first, emit any non-control characters
              if (nonControlChars.length > 0) {
                this.emitStrings([nonControlChars]);
                nonControlChars = ''; // reset for next round
              }
              // Control character found
              // XYZZY filter for control characters (add the control handlers here)
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
              // Non-control character
              nonControlChars = `${nonControlChars}${currLine[i]}`;
            }
            i++;
          }
        }
      } else {
        // If no control characters are found, just append the logBuffer directly
        this.emitStrings(this.logBuffer);
      }
      this.logBuffer = [];
      this.updateStatus();
    }
  }

  private emitStrings(buffer: string[]) {
    if (buffer.length > 0) {
      const messages = JSON.stringify(buffer);
      this.safeExecuteJS(`
        (function() {
          const logContent = document.getElementById('log-content');
          const messagesArray = ${messages};  // Parse the JSON string to get the array
          messagesArray.forEach(message => {
            const p = document.createElement('p');
            p.textContent = message;
            logContent.appendChild(p);
          });
          logContent.scrollTop = logContent.scrollHeight;
        })();
      `, 'emit strings to log');
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
    this.mainWindow.webContents.executeJavaScript(`
      const cogsStatus = document.getElementById('cogs-status');
      if (cogsStatus) {
        cogsStatus.textContent = '${displayText}';
        console.log('[COG STATUS] Updated Active COGs display: ${displayText}');
      } else {
        console.warn('[COG STATUS] cogs-status element not found in DOM');
      }
    `).catch((error: any) => {
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
    this.verifyPerformanceElementsReady().then(ready => {
      if (ready) {
        this.performanceUpdateTimer = setInterval(() => {
          this.updatePerformanceDisplay();
        }, this.PERFORMANCE_UPDATE_INTERVAL);
        console.log('[PERF DISPLAY] Performance monitoring timer started');
      } else {
        console.warn('[PERF DISPLAY] Performance elements not ready, retrying in 500ms...');
        setTimeout(() => this.startPerformanceMonitoring(), 500);
      }
    });
  }
  
  /**
   * Verify that performance display DOM elements exist
   */
  private async verifyPerformanceElementsReady(): Promise<boolean> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return false;
    }
    
    try {
      const result = await this.safeExecuteJS(`
        (function() {
          const perfMetrics = document.getElementById('perf-metrics');
          const perfIndicator = document.getElementById('perf-indicator');
          return !!(perfMetrics && perfIndicator);
        })();
      `, 'verifyPerformanceElementsReady');
      return result === true;
    } catch (error) {
      console.error('[PERF DISPLAY] Error verifying elements:', error);
      return false;
    }
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

      // Format display string
      const metricsText = `${throughputKbps}kb/s | Buffer: ${bufferUsage}% | Queue: ${totalQueueDepth} | ${statusSymbol}`;

      // Flash indicator on state change
      if (newState !== this.lastPerformanceState) {
        this.flashPerformanceIndicator();
        this.lastPerformanceState = newState;
      }

      // Update the status bar using safeExecuteJS like working status updates
      this.safeExecuteJS(`
        (function() {
          const perfMetrics = document.getElementById('perf-metrics');
          const perfIndicator = document.getElementById('perf-indicator');
          if (perfMetrics) {
            perfMetrics.textContent = '${metricsText}';
          }
          if (perfIndicator) {
            perfIndicator.style.color = '${indicatorColor}';
          }
        })();
      `, 'updatePerformanceDisplay');

    } catch (error) {
      console.error('[PERF DISPLAY] Error in updatePerformanceDisplay:', error);
    }
  }

  /**
   * Flash performance indicator on state change
   */
  private flashPerformanceIndicator(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    if (this.performanceFlashTimer) {
      clearTimeout(this.performanceFlashTimer);
    }

    // Flash effect: bright -> normal using safeExecuteJS
    this.safeExecuteJS(`
      (function() {
        const perfIndicator = document.getElementById('perf-indicator');
        if (perfIndicator) {
          const originalColor = perfIndicator.style.color;
          perfIndicator.style.color = '#FFFFFF';
          perfIndicator.style.textShadow = '0 0 8px #FFFFFF';
          setTimeout(() => {
            perfIndicator.style.color = originalColor;
            perfIndicator.style.textShadow = '0 0 2px #000';
          }, 200);
        }
      })();
    `, 'flashPerformanceIndicator');
  }

  // Terminal mode tracking
  private terminalMode: 'PST' | 'ANSI' = 'PST';
  private cursorX: number = 0;
  private cursorY: number = 0;
  private terminalWidth: number = 80;
  private terminalHeight: number = 25;
  
  private loadTerminalMode(): void {
    // This will be loaded from localStorage initially,
    // then from project .json file in a future sprint
    this.safeExecuteJS(`
      (function() {
        try {
          // Check if localStorage is available
          if (typeof localStorage === 'undefined') {
            console.warn('[TERMINAL MODE] localStorage not available, using defaults');
            return { mode: 'PST', controlLine: 'DTR' };
          }
          
          const mode = localStorage.getItem('terminal-mode') || 'PST';
          const controlLine = localStorage.getItem('control-line-mode') || 'DTR';
          console.log('[TERMINAL MODE] Successfully loaded from localStorage:', { mode, controlLine });
          return { mode, controlLine };
        } catch (error) {
          console.error('[TERMINAL MODE] Error accessing localStorage:', error);
          console.log('[TERMINAL MODE] Using default values: PST, DTR');
          return { mode: 'PST', controlLine: 'DTR' };
        }
      })();
    `, 'load terminal mode').then((result) => {
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
    }).catch((error) => {
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
        this.safeExecuteJS(`
          (function() {
            const terminal = document.getElementById('log-content');
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
        `, 'PST home command');
        break;
        
      case 'position':
        if (arg1 !== undefined && arg2 !== undefined) {
          this.cursorX = Math.min(arg1, this.terminalWidth - 1);
          this.cursorY = Math.min(arg2, this.terminalHeight - 1);
          this.safeExecuteJS(`
            (function() {
              const terminal = document.getElementById('log-content');
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
          `, 'PST position command');
        }
        break;
        
      case 'clearScreen':
        this.safeExecuteJS(`
          (function() {
            const terminal = document.getElementById('log-content');
            if (terminal) {
              terminal.innerHTML = '';
              terminal.dataset.cursorX = '0';
              terminal.dataset.cursorY = '0';
            }
          })();
        `, 'PST clear screen');
        this.cursorX = 0;
        this.cursorY = 0;
        break;
        
      case 'clearEOL':
        this.safeExecuteJS(`
          (function() {
            const terminal = document.getElementById('log-content');
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
        `, 'PST clear to EOL');
        break;
        
      case 'clearBelow':
        this.safeExecuteJS(`
          (function() {
            const terminal = document.getElementById('log-content');
            if (terminal) {
              const lines = terminal.querySelectorAll('p');
              const cursorY = parseInt(terminal.dataset.cursorY || '0');
              for (let i = cursorY + 1; i < lines.length; i++) {
                lines[i].remove();
              }
            }
          })();
        `, 'PST clear below');
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
          this.safeExecuteJS(`
            (function() {
              const terminal = document.getElementById('log-content');
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
          `, 'PST backspace');
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
          this.safeExecuteJS(`
            (function() {
              const terminal = document.getElementById('log-content');
              if (terminal) {
                const lines = terminal.querySelectorAll('p');
                if (lines.length > 0) {
                  lines[0].remove();
                }
                const newLine = document.createElement('p');
                terminal.appendChild(newLine);
              }
            })();
          `, 'PST linefeed scroll');
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
        this.safeExecuteJS(`
          (function() {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURE');
            audio.play();
          })();
        `, 'PST bell');
        break;
    }
  }
  
  // Update cursor position in the terminal
  private updateCursorPosition(): void {
    this.safeExecuteJS(`
      (function() {
        const terminal = document.getElementById('log-content');
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
    `, 'update cursor position');
  }

  // Helper to safely execute JavaScript in renderer
  private async safeExecuteJS(script: string, errorContext: string = 'script'): Promise<any> {
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
    // Update UI checkbox to reflect state
    this.updateCheckbox('dtr-checkbox', this.dtrState);
    
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
    // Update UI checkbox to reflect state
    this.updateCheckbox('rts-checkbox', this.rtsState);
    
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

  private async toggleDTR(): Promise<void> {
    // DTR Toggle: State Management (press-on/press-off, NOT auto-toggle)
    const newState = !this.dtrState;
    this.logMessage(`[DTR TOGGLE] Setting DTR to: ${newState} (was ${this.dtrState})`);
    
    if (this._serialPort) {
      try {
        await this._serialPort.setDTR(newState);
        this.logMessage(`[DTR TOGGLE] DTR line set to: ${newState}`);
        
        // Only update state after successful hardware change
        this.dtrState = newState;
        
        // Trigger reset when DTR is asserted (going high)
        if (this.dtrState) {
          this.logMessage(`[DTR TOGGLE] DTR asserted - triggering reset`);
          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.handleDTRReset();
          }
          // Signal parser that DTR reset occurred
          this.serialProcessor.onDTRReset();
          
          // Save DTR preference for this device when successfully used
          this.saveDeviceControlLine('DTR');
          
          // Update control line mode and UI if needed
          if (this.controlLineMode !== 'DTR') {
            this.controlLineMode = 'DTR';
            this.updateControlLineUI();
          }
        } else {
          this.logMessage(`[DTR TOGGLE] DTR de-asserted`);
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
      this.mainWindow.webContents.send('update-dtr-state', this.dtrState);
    }
    this.logMessage(`[DTR TOGGLE] State changed to ${this.dtrState ? 'ON' : 'OFF'}`);
  }

  private async toggleRTS(): Promise<void> {
    // State management: press-on/press-off (NOT auto-toggle)
    const newState = !this.rtsState;
    if (this._serialPort) {
      try {
        await this._serialPort.setRTS(newState);
        this.logMessage(`[RTS] Hardware control set to ${newState ? 'ON' : 'OFF'}`);
        
        // Only update state after successful hardware change
        this.rtsState = newState;
        
        // If RTS goes high, reset the Debug Logger
        if (this.rtsState) {
          this.logMessage(`[RTS RESET] Device reset via RTS - clearing log and synchronizing parser`);
          if (this.debugLoggerWindow) {
            this.debugLoggerWindow.handleRTSReset();
          }
          // Sync parser on RTS reset (using RTS-specific method)
          this.serialProcessor.onRTSReset();
          
          // Save RTS preference for this device when successfully used
          this.saveDeviceControlLine('RTS');
          
          // Update control line mode and UI if needed
          if (this.controlLineMode !== 'RTS') {
            this.controlLineMode = 'RTS';
            this.updateControlLineUI();
          }
        }
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
    this.logMessage(`[RTS TOGGLE] State changed to ${this.rtsState ? 'ON' : 'OFF'}`);
  }

  // Removed duplicate currentDownloadMode - using downloadMode from line 68
  
  private updateDownloadMode(mode: 'ram' | 'flash'): void {
    const ramColor = mode === 'ram' ? '#00FF00' : '#808080';
    const flashColor = mode === 'flash' ? '#00FF00' : '#808080';
    
    // CRITICAL FIX: Use setTimeout to ensure DOM is ready and properly update LEDs
    this.safeExecuteJS(`
      setTimeout(() => {
        const ramLed = document.getElementById('ram-led');
        const flashLed = document.getElementById('flash-led');
        const ramBtn = document.getElementById('download-ram');
        const flashBtn = document.getElementById('download-flash');
        
        // Debug logging
        console.log('Updating download mode to: ${mode}');
        console.log('RAM LED found:', !!ramLed, 'Flash LED found:', !!flashLed);
        
        // Update LED indicators - mutual exclusivity
        if (ramLed) {
          ramLed.textContent = '●';
          ramLed.style.color = '${ramColor}';
          ramLed.style.fontSize = '20px';
          ramLed.style.textShadow = '0 0 2px #000';
        } else {
          console.error('RAM LED element not found!');
        }
        
        if (flashLed) {
          flashLed.textContent = '●';
          flashLed.style.color = '${flashColor}';
          flashLed.style.fontSize = '20px';
          flashLed.style.textShadow = '0 0 2px #000';
        } else {
          console.error('Flash LED element not found!');
        }
        
        // Update button states to show active mode
        if (ramBtn) {
          if ('${mode}' === 'ram') {
            ramBtn.classList.add('active');
          } else {
            ramBtn.classList.remove('active');
          }
        }
        if (flashBtn) {
          if ('${mode}' === 'flash') {
            flashBtn.classList.add('active');
          } else {
            flashBtn.classList.remove('active');
          }
        }
      }, 0);
    `, 'download mode update');
  }

  private setDownloadMode(mode: 'ram' | 'flash'): void {
    // Update the single source of truth
    this.downloadMode = mode;
    this.updateDownloadMode(mode);
    this.logMessage(`Download mode set to ${mode.toUpperCase()}`);
  }

  private async downloadFile(): Promise<void> {
    // Use the current download mode to determine where to download
    if (this.downloadMode === 'ram') {
      await this.downloadToRAM();
    } else {
      await this.downloadToFlash();
    }
  }

  private async downloadToRAM(): Promise<void> {
    
    const result = await dialog.showOpenDialog(this.mainWindow!, {
      title: 'Select Binary File to Download to RAM',
      filters: [{ name: 'Binary Files', extensions: ['binary', 'bin'] }],
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      if (this._serialPort && this.downloader) {
        try {
          this.logMessage(`Downloading ${path.basename(filePath)} to RAM...`);
          this.updateRecordingStatus(`Downloading to RAM...`);
          
          // Download to RAM (toFlash = false)
          await this.downloader.download(filePath, false);
          
          this.logMessage(`Successfully downloaded ${path.basename(filePath)} to RAM`);
          this.updateRecordingStatus(`Download complete`);
          
          // Brief status display then clear
          setTimeout(() => {
            this.updateRecordingStatus('Ready');
          }, 2000);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logMessage(`ERROR: Failed to download to RAM: ${errorMsg}`);
          this.updateRecordingStatus(`Download failed`);
          
          dialog.showErrorBox('Download Failed', `Failed to download to RAM:\n${errorMsg}`);
        }
      } else {
        this.logMessage(`ERROR: Serial port or downloader not initialized`);
        dialog.showErrorBox('Not Connected', 'Please connect to a Propeller 2 device first.');
      }
    }
  }

  private async downloadToFlash(): Promise<void> {
    const result = await dialog.showOpenDialog(this.mainWindow!, {
      title: 'Select Binary File to Download to Flash',
      filters: [{ name: 'Binary Files', extensions: ['binary', 'bin'] }],
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      if (this._serialPort && this.downloader) {
        try {
          this.logMessage(`Downloading ${path.basename(filePath)} to Flash...`);
          this.updateRecordingStatus(`Downloading to Flash...`);
          
          // Download to Flash (toFlash = true)
          await this.downloader.download(filePath, true);
          
          this.logMessage(`Successfully downloaded ${path.basename(filePath)} to Flash`);
          this.updateRecordingStatus(`Flash complete`);
          
          // Brief status display then clear
          setTimeout(() => {
            this.updateRecordingStatus('Ready');
          }, 2000);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logMessage(`ERROR: Failed to download to Flash: ${errorMsg}`);
          this.updateRecordingStatus(`Flash failed`);
          
          dialog.showErrorBox('Flash Failed', `Failed to download to Flash:\n${errorMsg}`);
        }
      } else {
        this.logMessage(`ERROR: Serial port or downloader not initialized`);
        dialog.showErrorBox('Not Connected', 'Please connect to a Propeller 2 device first.');
      }
    }
  }

  private startRecording(): void {
    const metadata = {
      sessionName: `session-${getFormattedDateTime()}`,
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
  }

  private async playRecording(): Promise<void> {
    const result = await dialog.showOpenDialog(this.mainWindow!, {
      title: 'Select Recording to Play',
      filters: [{ name: 'Recording Files', extensions: ['jsonl'] }],
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      this.updateRecordingStatus('Playing...');
      await this.windowRouter.playRecording(filePath, 1.0);
      this.updateRecordingStatus('Ready');
    }
  }

  private selectBaudRate(): void {
    const baudRates = ['115200', '230400', '460800', '921600', '2000000'];
    dialog.showMessageBox(this.mainWindow!, {
      type: 'question',
      buttons: baudRates,
      title: 'Select Baud Rate',
      message: 'Choose baud rate:'
    }).then((response: any) => {
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
      detail: 'DEBUG TERM - Open terminal window\nDEBUG SCOPE - Open scope window\nDEBUG LOGIC - Open logic analyzer\nDEBUG PLOT - Open plot window\nDEBUG BITMAP - Open bitmap display\nDEBUG MIDI - Open MIDI display\nDEBUG FFT - Open FFT analyzer',
      buttons: ['OK']
    });
  }

  private showSettingsDialog(): void {
    // Create a simple settings dialog
    const settingsWindow = new BrowserWindow({
      width: 600,
      height: 500,
      parent: this.mainWindow,
      modal: true,
      title: 'Settings',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const settingsHTML = `
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background: #f5f5f5;
              height: 100vh;
              display: flex;
              flex-direction: column;
            }
            .settings-container {
              flex: 1;
              overflow-y: auto;
              padding: 20px;
              padding-bottom: 80px; /* Space for buttons */
            }
            h2 {
              margin-top: 0;
              color: #333;
            }
            .settings-section {
              background: white;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .setting-row {
              display: flex;
              align-items: center;
              margin-bottom: 10px;
            }
            .setting-row:last-child {
              margin-bottom: 0;
            }
            label {
              flex: 1;
              color: #555;
            }
            select, input[type="number"], input[type="text"] {
              width: 200px;
              padding: 5px;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            input[type="checkbox"] {
              margin-left: auto;
            }
            .button-row {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              background: white;
              border-top: 1px solid #ddd;
              padding: 15px 20px;
              display: flex;
              justify-content: flex-end;
              box-shadow: 0 -2px 5px rgba(0,0,0,0.1);
            }
            button {
              padding: 8px 16px;
              margin-left: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
              background: white;
              cursor: pointer;
            }
            button:hover {
              background: #f0f0f0;
            }
            button.primary {
              background: #007AFF;
              color: white;
              border-color: #007AFF;
            }
            button.primary:hover {
              background: #0056b3;
            }
          </style>
        </head>
        <body>
          <div class="settings-container">
            <h2>Settings</h2>
            
            <div class="settings-section">
            <h3>Terminal</h3>
            <div class="setting-row">
              <label for="terminal-mode">Terminal Mode:</label>
              <select id="terminal-mode">
                <option value="PST">PST (Parallax Serial Terminal)</option>
                <option value="ANSI">ANSI (Standard escape sequences)</option>
              </select>
            </div>
            <div class="setting-row">
              <label for="theme">Color Theme:</label>
              <select id="theme">
                <option value="pst">PST (Cyan/Yellow)</option>
                <option value="classic">Classic (Green/Black)</option>
                <option value="amber">Amber Terminal</option>
              </select>
            </div>
            <div class="setting-row">
              <label for="fontsize">Font Size:</label>
              <input type="number" id="fontsize" value="12" min="8" max="24" />
            </div>
            <div class="setting-row">
              <label for="echo">Local Echo:</label>
              <input type="checkbox" id="echo" />
            </div>
          </div>
          
          <div class="settings-section">
            <h3>Debug Logger</h3>
            <div class="setting-row">
              <label for="logger-theme">Logger Theme:</label>
              <select id="logger-theme">
                <option value="green">Green on Black</option>
                <option value="amber">Amber on Black</option>
              </select>
            </div>
            <div class="setting-row">
              <label for="auto-log">Auto-start Logging:</label>
              <input type="checkbox" id="auto-log" />
            </div>
            <div class="setting-row">
              <label for="log-basename">Log File Base Name:</label>
              <input type="text" id="log-basename" value="debug_capture" />
            </div>
          </div>
          
          <div class="settings-section">
            <h3>COG Windows</h3>
            <div class="setting-row">
              <label for="cog-display-mode">COG Display Mode:</label>
              <select id="cog-display-mode">
                <option value="show_all">Show All 8 COGs</option>
                <option value="on_demand">Show Only Active COGs</option>
              </select>
            </div>
            <div class="setting-row">
              <label for="cog-auto-open">Auto-open on traffic:</label>
              <input type="checkbox" id="cog-auto-open" checked />
            </div>
          </div>
          
          <div class="settings-section">
            <h3>Serial Control</h3>
            <div class="setting-row">
              <label for="control-line-mode">Reset Control Line:</label>
              <select id="control-line-mode">
                <option value="DTR">DTR (Parallax Prop Plug)</option>
                <option value="RTS">RTS (FTDI Clones)</option>
              </select>
            </div>
            <div class="setting-row" style="font-size: 11px; color: #666; margin-left: 20px;">
              DTR: Standard for official Parallax devices<br>
              RTS: Required by some FTDI clones
            </div>
          </div>
          
          <div class="settings-section">
            <h3>Window Placement</h3>
            <div class="setting-row">
              <label for="cascade">Cascade Windows:</label>
              <input type="checkbox" id="cascade" />
            </div>
            <div class="setting-row">
              <label for="remember-pos">Remember Window Positions:</label>
              <input type="checkbox" id="remember-pos" />
            </div>
          </div>
          </div><!-- end settings-container -->
          
          <div class="button-row">
            <button onclick="window.close()">Cancel</button>
            <button class="primary" onclick="saveAndClose()">OK</button>
          </div>
          
          <script>
            const { ipcRenderer } = require('electron');
            
            // Load current settings
            window.addEventListener('DOMContentLoaded', () => {
              // Load terminal mode
              const terminalMode = localStorage.getItem('terminal-mode') || 'PST';
              const modeSelect = document.getElementById('terminal-mode');
              if (modeSelect) {
                modeSelect.value = terminalMode;
              }
              
              // Load other settings...
              // TODO: Load theme, font size, echo, etc.
              
              // Load COG display mode
              const cogMode = localStorage.getItem('cog-display-mode') || 'show_all';
              const cogModeSelect = document.getElementById('cog-display-mode');
              if (cogModeSelect) {
                cogModeSelect.value = cogMode;
              }
              
              const cogAutoOpen = localStorage.getItem('cog-auto-open') !== 'false';
              const cogAutoOpenCheck = document.getElementById('cog-auto-open');
              if (cogAutoOpenCheck) {
                cogAutoOpenCheck.checked = cogAutoOpen;
              }
              
              // Load control line mode
              const controlLineMode = localStorage.getItem('control-line-mode') || 'DTR';
              const controlLineSelect = document.getElementById('control-line-mode');
              if (controlLineSelect) {
                controlLineSelect.value = controlLineMode;
              }
            });
            
            function saveAndClose() {
              // Save terminal mode
              const modeSelect = document.getElementById('terminal-mode');
              if (modeSelect) {
                const selectedMode = modeSelect.value;
                localStorage.setItem('terminal-mode', selectedMode);
                // Send to main process to update terminal
                ipcRenderer.send('set-terminal-mode', selectedMode);
              }
              
              // Save COG display mode
              const cogModeSelect = document.getElementById('cog-display-mode');
              if (cogModeSelect) {
                const selectedCogMode = cogModeSelect.value;
                localStorage.setItem('cog-display-mode', selectedCogMode);
                ipcRenderer.send('set-cog-display-mode', selectedCogMode);
              }
              
              const cogAutoOpenCheck = document.getElementById('cog-auto-open');
              if (cogAutoOpenCheck) {
                localStorage.setItem('cog-auto-open', cogAutoOpenCheck.checked);
              }
              
              // Save control line mode
              const controlLineSelect = document.getElementById('control-line-mode');
              if (controlLineSelect) {
                const selectedControlLine = controlLineSelect.value;
                localStorage.setItem('control-line-mode', selectedControlLine);
                ipcRenderer.send('set-control-line-mode', selectedControlLine);
              }
              
              // TODO: Save other settings
              // In a future sprint, this will save to external project .json file
              
              window.close();
            }
          </script>
        </body>
      </html>
    `;

    settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(settingsHTML)}`);
    settingsWindow.setMenu(null);
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
    this.safeExecuteJS(`
      const btn = document.getElementById('${id}');
      if (btn) btn.textContent = '${text}';
    `, `updateToolbarButton-${id}`);
  }

  private updateRecordingStatus(status: string): void {
    this.safeExecuteJS(`
      const statusEl = document.getElementById('recording-status');
      if (statusEl) statusEl.textContent = '${status}';
    `, 'updateRecordingStatus');
  }

  private updateConnectionStatus(connected: boolean): void {
    const color = connected ? '#00FF00' : '#FFBF00';  // Green when connected, Yellow when not
    this.safeExecuteJS(`
      // Update connection LED indicator (GREEN when connected, YELLOW when disconnected)
      const connLed = document.getElementById('conn-led');
      if (connLed) {
        connLed.textContent = '●';  // Always filled circle
        connLed.style.color = '${color}';
        connLed.style.fontSize = '20px';  // Make it bigger
      }
    `, 'updateConnectionStatus');
  }

  private updateCheckbox(id: string, checked: boolean): void {
    this.safeExecuteJS(`
      const checkbox = document.getElementById('${id}');
      if (checkbox) {
        checkbox.checked = ${checked};
      }
    `, `updateCheckbox-${id}`);
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
    this.safeExecuteJS(`
      const checkbox = document.getElementById('echo-checkbox');
      if (checkbox) checkbox.checked = ${checked};
    `, 'updateEchoCheckbox');
  }

  private blinkActivityLED(type: 'tx' | 'rx'): void {
    const ledId = type === 'tx' ? 'tx-led' : 'rx-led';
    const color = type === 'tx' ? '#0080FF' : '#FF0000';  // Blue for TX, Red for RX
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
      this.safeExecuteJS(`
        setTimeout(() => {
          const led = document.getElementById('${ledId}');
          if (led) {
            led.style.color = '#333';
            led.style.fontSize = '20px';  // Consistent size
            led.style.textShadow = '0 0 2px #000';
          }
        }, 10);
      `, `${type}LED-off`).then(() => {
        // Only clear timer after successful LED update
        if (type === 'tx') {
          this.txActivityTimer = null;
        } else {
          this.rxActivityTimer = null;
        }
      }).catch(() => {
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
    this.safeExecuteJS(`
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
    `, 'updateLoggingStatus');
  }
}
