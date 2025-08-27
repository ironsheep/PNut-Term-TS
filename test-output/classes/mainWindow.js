/** @format */
// this is our common logging mechanism
//  TODO: make it context/runtime option aware
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainWindow = void 0;
// src/classes/mainWindow.ts
// Import electron conditionally for standalone compatibility
var app, BrowserWindow, Menu, MenuItem, dialog, electron;
try {
    var electronImport = require('electron');
    app = electronImport.app;
    BrowserWindow = electronImport.BrowserWindow;
    Menu = electronImport.Menu;
    MenuItem = electronImport.MenuItem;
    dialog = electronImport.dialog;
    electron = electronImport;
}
catch (error) {
    // Running in standalone mode without Electron
    console.warn('Warning: Electron not available, running in CLI mode');
}
var files_1 = require("../utils/files");
var usb_serial_1 = require("../utils/usb.serial");
var fs = require("fs");
var path_1 = require("path");
var debugScopeWin_1 = require("./debugScopeWin");
var debugTermWin_1 = require("./debugTermWin");
var debugPlotWin_1 = require("./debugPlotWin");
var debugLogicWin_1 = require("./debugLogicWin");
var debugBitmapWin_1 = require("./debugBitmapWin");
var debugMidiWin_1 = require("./debugMidiWin");
var debugLoggerWin_1 = require("./debugLoggerWin");
var debugCOGWindow_1 = require("./debugCOGWindow");
var windowRouter_1 = require("./shared/windowRouter");
var serialMessageProcessor_1 = require("./shared/serialMessageProcessor");
var messageExtractor_1 = require("./shared/messageExtractor");
var cogWindowManager_1 = require("./shared/cogWindowManager");
var cogHistoryManager_1 = require("./shared/cogHistoryManager");
var windowPlacer_1 = require("../utils/windowPlacer");
var cogLogExporter_1 = require("./shared/cogLogExporter");
var downloader_1 = require("./downloader");
var DEFAULT_SERIAL_BAUD = 2000000;
var MainWindow = /** @class */ (function () {
    function MainWindow(ctx) {
        var _this = this;
        this._deviceNode = '';
        this._serialPort = undefined;
        this._serialBaud = DEFAULT_SERIAL_BAUD;
        this.mainWindow = null;
        this.mainWindowOpen = false;
        this.logFilenameBase = 'myapp';
        this.loggingToFile = false;
        this.waitingForINIT = true;
        this.logFileSpec = '';
        this.windowRouter = windowRouter_1.WindowRouter.getInstance();
        this.dtrState = false;
        this.rtsState = false;
        this.controlLineMode = 'DTR'; // Default to DTR (Parallax standard)
        this.downloadMode = 'ram'; // Default to RAM mode
        this.activeCogs = new Set();
        this.echoOffEnabled = false;
        this.recentTransmitBuffer = [];
        this.transmitTimestamp = 0;
        this.txActivityTimer = null;
        this.rxActivityTimer = null;
        this.rxCharCounter = 0;
        this.txCharCounter = 0;
        this.mainWindowGeometry = {
            xOffset: 0,
            yOffset: 0,
            width: 800,
            height: 600
        };
        this.displays = {};
        this.debugLoggerWindow = null;
        this.knownClosedBy = false; // compilicated determine if closed by app:quit or [x] close
        this.immediateLog = true;
        this.termColors = {
            xmitBGColor: '#FFF8E7', // hex string '#RRGGBB' yellowish pastel
            rcvBGColor: '#8AB3E9', // cyan pastel
            xmitFGColor: '#000000', // black
            rcvFGColor: '#000000' // black
        };
        // ASCII + CogN sync buffer for handling partial commands
        this.syncBuffer = '';
        this.lastSyncTime = 0;
        this.MAX_LINE_CHARS = 80; // Typical max line length
        this.DEFAULT_BAUD_RATE = 115200; // Default P2 baud rate
        this.DISPLAY_SCOPE = 'SCOPE';
        this.DISPLAY_TERM = 'TERM';
        this.DISPLAY_PLOT = 'PLOT';
        this.DISPLAY_LOGIC = 'LOGIC';
        this.DISPLAY_BITMAP = 'BITMAP';
        this.DISPLAY_MIDI = 'MIDI';
        this.PEND_MESSAGE_COUNT = 100;
        this.logBuffer = [];
        // Terminal mode tracking
        this.terminalMode = 'PST';
        this.cursorX = 0;
        this.cursorY = 0;
        this.terminalWidth = 80;
        this.terminalHeight = 25;
        this.context = ctx;
        this._deviceNode = this.context.runEnvironment.selectedPropPlug;
        if (this.context.runEnvironment.loggingEnabled) {
            this.context.logger.forceLogMessage('MainWindow started.');
        }
        // Initialize Two-Tier Pattern Matching serial processor and COG managers
        this.serialProcessor = new serialMessageProcessor_1.SerialMessageProcessor(true); // Enable performance logging
        this.cogWindowManager = new cogWindowManager_1.COGWindowManager();
        this.cogHistoryManager = new cogHistoryManager_1.COGHistoryManager();
        this.cogLogExporter = new cogLogExporter_1.COGLogExporter();
        // Set up Two-Tier Pattern Matching event handlers
        console.log('[TWO-TIER] 🔧 Setting up SerialProcessor event handlers...');
        this.setupSerialProcessorEvents();
        console.log('[TWO-TIER] ✅ SerialProcessor event handlers setup complete');
        // Set up COG window creator
        this.cogWindowManager.setWindowCreator(function (cogId) {
            return _this.createCOGWindow(cogId);
        });
        // Listen for WindowRouter events
        this.setupWindowRouterEventListeners();
        // Initialize device settings
        this.settingsFilePath = path_1.default.join(process.cwd(), 'pnut-term-settings.json');
        this.loadGlobalSettings();
        var currFileTime = (0, files_1.getFormattedDateTime)();
        this.logFilenameBase = "myApp-".concat(currFileTime, ".log");
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
    MainWindow.prototype.setupWindowRouterEventListeners = function () {
        var _this = this;
        console.log("[WINDOW CREATION] \uD83C\uDFA7 Setting up WindowRouter event listeners");
        // Listen for windowNeeded events when WindowRouter can't route to existing window
        this.windowRouter.on('windowNeeded', function (eventData) {
            console.log("[WINDOW CREATION] \uD83D\uDCE8 Received windowNeeded event!");
            console.log("[WINDOW CREATION] WindowRouter needs window of type: ".concat(eventData.type));
            console.log("[WINDOW CREATION] Command: ".concat(eventData.command));
            console.log("[WINDOW CREATION] Error: ".concat(eventData.error));
            // Handle window creation based on type
            _this.handleWindowCreationRequest(eventData.type, eventData.command);
        });
        // Listen for P2 system reboot events (golden synchronization marker)
        this.windowRouter.on('p2SystemReboot', function (eventData) {
            console.log("[P2 SYNC] \uD83C\uDFAF P2 SYSTEM REBOOT DETECTED!");
            console.log("[P2 SYNC] Message: ".concat(eventData.message));
            console.log("[P2 SYNC] Timestamp: ".concat(new Date(eventData.timestamp).toISOString()));
            // Trigger complete synchronization reset
            _this.handleP2SystemReboot(eventData);
        });
        console.log("[WINDOW CREATION] \u2705 WindowRouter event listeners setup complete");
    };
    /**
     * Setup event handlers for debugger message parser
     */
    MainWindow.prototype.setupSerialProcessorEvents = function () {
        var _this = this;
        // Create routing destinations for Two-Tier Pattern Matching
        var debugLoggerDestination = {
            name: 'DebugLogger',
            handler: function (message) {
                _this.routeToDebugLogger(message);
            }
        };
        var windowCreatorDestination = {
            name: 'WindowCreator',
            handler: function (message) {
                _this.handleWindowCommand(message);
            }
        };
        var debuggerWindowDestination = {
            name: 'DebuggerWindow',
            handler: function (message) {
                _this.routeToDebuggerWindow(message);
            }
        };
        // Apply standard P2 routing configuration
        this.serialProcessor.applyStandardRouting(debugLoggerDestination, windowCreatorDestination, debuggerWindowDestination);
        // Start the processor
        console.log('[TWO-TIER] 🚀 Starting SerialMessageProcessor...');
        this.serialProcessor.start();
        console.log('[TWO-TIER] ✅ SerialMessageProcessor started successfully');
        // Handle processor events
        this.serialProcessor.on('resetDetected', function (event) {
            console.log("[TWO-TIER] ".concat(event.type, " reset detected"));
        });
        this.serialProcessor.on('syncStatusChanged', function (status) {
            if (status.synchronized) {
                console.log("[TWO-TIER] \u2705 Synchronized via ".concat(status.source));
            }
            else {
                console.log("[TWO-TIER] \u26A0\uFE0F Lost synchronization");
            }
        });
    };
    /**
     * Route message to Debug Logger (Terminal FIRST principle)
     */
    MainWindow.prototype.routeToDebugLogger = function (message) {
        var _a;
        console.log("[TWO-TIER] \uD83D\uDCE8 Routing message to Debug Logger: ".concat(message.type, ", ").concat(message.data.length, " bytes"));
        // Use type-safe handoff to debug logger - no more guessing!
        if (this.debugLoggerWindow) {
            console.log("[TWO-TIER] \u2705 Debug Logger window available, processing message");
        }
        else {
            console.log("[TWO-TIER] \u274C Debug Logger window NOT available, using fallback");
        }
        if (this.debugLoggerWindow) {
            // Convert buffer to appropriate data type
            var data = void 0;
            if (message.type === messageExtractor_1.MessageType.DEBUGGER_80BYTE) {
                // Binary data stays as Uint8Array
                data = message.data;
            }
            else {
                // Text data converted to string array
                var textData = new TextDecoder().decode(message.data);
                data = textData.split(/\s+/).filter(function (part) { return part.length > 0; });
            }
            // Direct type-safe call - no router guessing needed
            this.debugLoggerWindow.processTypedMessage(message.type, data);
        }
        else {
            // Fallback to router if debug logger not available
            var routerMessage = {
                type: 'text',
                data: this.formatMessageForDisplay(message),
                timestamp: message.timestamp,
                cogId: (_a = message.metadata) === null || _a === void 0 ? void 0 : _a.cogId
            };
            this.windowRouter.routeMessage(routerMessage);
        }
    };
    /**
     * Handle window command (backtick commands)
     */
    MainWindow.prototype.handleWindowCommand = function (message) {
        var _a;
        if ((_a = message.metadata) === null || _a === void 0 ? void 0 : _a.windowCommand) {
            console.log("[TWO-TIER] Window command: ".concat(message.metadata.windowCommand));
            // Route to appropriate window creation logic
            this.windowRouter.routeMessage({
                type: 'text',
                data: message.metadata.windowCommand,
                timestamp: message.timestamp
            });
        }
    };
    /**
     * Route to debugger window (80-byte packets)
     */
    MainWindow.prototype.routeToDebuggerWindow = function (message) {
        var _a;
        if (((_a = message.metadata) === null || _a === void 0 ? void 0 : _a.cogId) !== undefined) {
            console.log("[TWO-TIER] Debugger data for COG ".concat(message.metadata.cogId));
            // Route binary debugger data to appropriate COG debugger window
            this.windowRouter.routeMessage({
                type: 'binary',
                data: message.data,
                timestamp: message.timestamp,
                cogId: message.metadata.cogId
            });
        }
    };
    /**
     * Format extracted message for display in debug logger
     */
    MainWindow.prototype.formatMessageForDisplay = function (message) {
        var _a, _b;
        var displayText = '';
        switch (message.type) {
            case messageExtractor_1.MessageType.TERMINAL_OUTPUT:
                displayText = new TextDecoder().decode(message.data);
                break;
            case messageExtractor_1.MessageType.COG_MESSAGE:
                displayText = new TextDecoder().decode(message.data);
                break;
            case messageExtractor_1.MessageType.P2_SYSTEM_INIT:
                displayText = "[GOLDEN SYNC] ".concat(new TextDecoder().decode(message.data));
                break;
            case messageExtractor_1.MessageType.DB_PACKET:
                displayText = this.formatHexDump(message.data, 'DB_PACKET');
                break;
            case messageExtractor_1.MessageType.INVALID_COG:
                displayText = "[INVALID COG] ".concat(((_a = message.metadata) === null || _a === void 0 ? void 0 : _a.warningMessage) || '', ": ").concat(new TextDecoder().decode(message.data));
                break;
            case messageExtractor_1.MessageType.INCOMPLETE_DEBUG:
                displayText = "[INCOMPLETE] ".concat(((_b = message.metadata) === null || _b === void 0 ? void 0 : _b.warningMessage) || '', ": ").concat(new TextDecoder().decode(message.data));
                break;
            default:
                displayText = this.formatHexDump(message.data, message.type);
        }
        return displayText;
    };
    /**
     * Format binary data as hex dump for display
     */
    MainWindow.prototype.formatHexDump = function (data, label) {
        var lines = ["[".concat(label, "] ").concat(data.length, " bytes:")];
        var bytesPerLine = 16;
        for (var offset = 0; offset < data.length; offset += bytesPerLine) {
            var lineBytes = data.slice(offset, Math.min(offset + bytesPerLine, data.length));
            var hexPart = '';
            for (var i = 0; i < bytesPerLine; i++) {
                if (i < lineBytes.length) {
                    hexPart += "$".concat(lineBytes[i].toString(16).toUpperCase().padStart(2, '0'), " ");
                }
                else {
                    hexPart += '    ';
                }
                if (i === 7)
                    hexPart += ' ';
            }
            var asciiPart = '';
            for (var i = 0; i < lineBytes.length; i++) {
                var byte = lineBytes[i] & 0x7F;
                asciiPart += (byte >= 0x20 && byte <= 0x7E) ? String.fromCharCode(byte) : '.';
            }
            var offsetHex = offset.toString(16).padStart(4, '0');
            lines.push("  ".concat(offsetHex, ": ").concat(hexPart, "  ").concat(asciiPart));
        }
        return lines.join('\n');
    };
    /**
     * Create a COG splitter window
     */
    MainWindow.prototype.createCOGWindow = function (cogId) {
        var _this = this;
        console.log("[COG WINDOW] Creating COG ".concat(cogId, " window"));
        // Generate window ID for tracking
        var windowId = "COG-".concat(cogId);
        // Create COG window using the proper class
        var cogWindow = new debugCOGWindow_1.DebugCOGWindow(cogId, {
            mainWindow: this,
            context: this.context,
            placementStrategy: windowPlacer_1.PlacementStrategy.COG_GRID,
            windowId: windowId
        });
        // Register with WindowRouter for message routing
        this.windowRouter.registerWindow("COG".concat(cogId), "COG".concat(cogId), function (message) {
            if (typeof message === 'string') {
                cogWindow.processCOGMessage(message);
            }
        });
        // Track in displays
        this.displays[windowId] = cogWindow;
        // Listen for close event
        cogWindow.on('cog-window-closed', function (closedCogId) {
            console.log("[COG WINDOW] COG ".concat(closedCogId, " window closed"));
            _this.cogWindowManager.onWindowClosed(closedCogId);
            delete _this.displays["COG-".concat(closedCogId)];
            _this.windowRouter.unregisterWindow("COG".concat(closedCogId));
        });
        // Listen for export request
        cogWindow.on('request-export', function (exportCogId) {
            _this.handleCOGExportRequest(exportCogId);
        });
        // Get the actual Electron BrowserWindow
        var electronWindow = cogWindow.getWindow();
        return electronWindow;
    };
    /**
     * Handle Show All COGs button click from Debug Logger window
     */
    MainWindow.prototype.handleShowAllCOGs = function () {
        console.log('[COG MANAGER] Show All COGs requested');
        this.cogWindowManager.showAllCOGs();
    };
    /**
     * Handle COG export request
     */
    MainWindow.prototype.handleCOGExportRequest = function (cogId) {
        console.log("[COG EXPORT] Export requested for COG ".concat(cogId));
        // Get the COG window
        var windowKey = "COG-".concat(cogId);
        var cogWindow = this.displays[windowKey];
        if (cogWindow) {
            var messages = cogWindow.exportMessages();
            // TODO: Save to file or send to COGLogExporter
            console.log("[COG EXPORT] Exported ".concat(messages.length, " characters from COG ").concat(cogId));
        }
    };
    /**
     * Route binary data to debug logger with type information
     */
    MainWindow.prototype.routeBinaryToDebugLogger = function (data, binaryType) {
        var _this = this;
        if (!this.debugLoggerWindow) {
            // Auto-create debug logger if needed
            try {
                this.debugLoggerWindow = debugLoggerWin_1.DebugLoggerWindow.getInstance(this.context);
                this.displays['DebugLogger'] = this.debugLoggerWindow;
                this.debugLoggerWindow.on('close', function () {
                    delete _this.displays['DebugLogger'];
                    _this.debugLoggerWindow = null;
                });
            }
            catch (error) {
                console.error('[DEBUG LOGGER] Failed to create:', error);
                return;
            }
        }
        // Send binary data to logger with type flag
        if (this.debugLoggerWindow) {
            // Format based on type
            var formattedMessage = void 0;
            if (binaryType === 'debugger') {
                // Use 32-byte/line format for debugger packets
                formattedMessage = this.formatDebuggerBinary(data);
            }
            else {
                // Use 16-byte/line format with ASCII for raw P2 data
                formattedMessage = this.formatRawBinary(data);
            }
            this.debugLoggerWindow.logMessage(formattedMessage);
        }
    };
    /**
     * Format debugger binary packets (80-byte format)
     */
    MainWindow.prototype.formatDebuggerBinary = function (data) {
        var lines = [];
        // Extract COG ID using proper 32-bit little-endian for 80-byte packets
        var cogId = -1;
        if (data.length === 80) {
            cogId = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24); // Little-endian 32-bit
        }
        var prefix = cogId >= 0 && cogId <= 7 ? "Cog ".concat(cogId, " ") : '';
        var indent = ' '.repeat(prefix.length);
        for (var offset = 0; offset < data.length; offset += 32) {
            var lineBytes = Math.min(32, data.length - offset);
            var hexOffset = "0x".concat(offset.toString(16).padStart(2, '0').toUpperCase(), ":");
            var linePrefix = offset === 0 ? prefix : indent;
            var hexLine = "".concat(linePrefix).concat(hexOffset, " ");
            for (var i = 0; i < lineBytes; i++) {
                var byte = data[offset + i];
                hexLine += "$".concat(byte.toString(16).padStart(2, '0').toUpperCase());
                if ((i + 1) % 16 === 0 && i < lineBytes - 1) {
                    hexLine += '  '; // Double space at 16-byte boundary
                }
                else if ((i + 1) % 8 === 0 && i < lineBytes - 1) {
                    hexLine += '  '; // Double space at 8-byte boundary  
                }
                else if (i < lineBytes - 1) {
                    hexLine += ' '; // Single space between bytes
                }
            }
            lines.push(hexLine);
        }
        return lines.join('\n');
    };
    /**
     * Format raw P2 binary data (16-byte/line with ASCII)
     */
    MainWindow.prototype.formatRawBinary = function (data) {
        var lines = [];
        lines.push("[P2 Binary Data - ".concat(data.length, " bytes]"));
        for (var offset = 0; offset < data.length; offset += 16) {
            var lineBytes = Math.min(16, data.length - offset);
            var hexPart = "".concat(offset.toString(16).padStart(4, '0'), ": ");
            var asciiPart = '';
            // Hex columns
            for (var i = 0; i < 16; i++) {
                if (i < lineBytes) {
                    var byte = data[offset + i];
                    hexPart += "$".concat(byte.toString(16).padStart(2, '0').toUpperCase(), " ");
                    // ASCII representation
                    asciiPart += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
                }
                else {
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
    };
    /**
     * Handle window creation requests from WindowRouter
     */
    MainWindow.prototype.handleWindowCreationRequest = function (windowType, command) {
        console.log("[WINDOW CREATION] Analyzing command: ".concat(command));
        // Check if this looks like a window creation command vs data/control command
        // Creation commands typically have: `WINDOWTYPE Name POS x y ... or similar setup directives
        // Data commands are: `Name data... or `Name close save etc.
        var cleanCommand = command.substring(1).trim(); // Remove backtick
        var parts = cleanCommand.split(' ');
        // If first word after backtick matches windowType (LOGIC, TERM, etc), it's likely a creation command
        // Otherwise it's a command for an existing window (like `MyLogic close save`)
        var firstWord = parts[0].toUpperCase();
        var isCreationCommand = firstWord === windowType.toUpperCase() ||
            (parts.length > 2 && parts.includes('POS')) ||
            (parts.length > 2 && parts.includes('SIZE'));
        if (!isCreationCommand) {
            // This is a data/control command for a window that should already exist
            console.log("[WINDOW CREATION] Not a creation command - appears to be data/control for existing window");
            console.log("[WINDOW CREATION] Command: \"".concat(command, "\" contains: ").concat(parts.join(', ')));
            // Check if command contains 'close' anywhere (might be compound: `MyLogic save close`)
            if (cleanCommand.toLowerCase().includes('close')) {
                console.log("[WINDOW CREATION] Contains 'close' - window is being closed, not created");
            }
            return;
        }
        console.log("[WINDOW CREATION] Identified as creation command - creating ".concat(windowType, " window"));
        // Parse the command and create the appropriate window
        // The command should still have the backtick, so we can use existing handleDebugCommand logic
        this.handleDebugCommand(command);
    };
    MainWindow.prototype.initialize = function () {
        var _this = this;
        this.context.logger.forceLogMessage('* initialize()');
        console.log('[STARTUP] MainWindow.initialize() called');
        // app.on('ready', this.createAppWindow);
        // CRITICAL FIX: Don't open serial port until DOM is ready!
        // Store the device node to open later
        if (this._deviceNode.length > 0) {
            this.logMessage("* Device specified: ".concat(this._deviceNode, " - will connect after window loads"));
            console.log("[STARTUP] Device specified: ".concat(this._deviceNode));
        }
        else {
            this.logMessage('* No device specified - will check available devices when window loads');
            console.log('[STARTUP] No device specified');
        }
        if (app && app.whenReady) {
            console.log('[STARTUP] Electron app object found, calling whenReady()');
            app.whenReady().then(function () {
                _this.logMessage('* [whenReady]');
                console.log('[STARTUP] Electron app is ready, creating window');
                _this.createAppWindow();
            }).catch(function (error) {
                console.error('[STARTUP] Error in app.whenReady():', error);
            });
        }
        else {
            // Running in CLI mode without Electron
            console.log('[STARTUP] Running in CLI mode - no GUI windows available (app object not found)');
        }
        if (app) {
            app.on('window-all-closed', function () {
                // Quit the app when all windows are closed, even on macOS
                // This makes the app behave like a single-window application
                console.log('[STARTUP] All windows closed, quitting app');
                app.quit();
                _this.mainWindowOpen = false;
            });
        }
        app.on('activate', function () {
            if (_this.mainWindow === null) {
                _this.logMessage('* [activate]');
                _this.createAppWindow();
            }
        });
    };
    MainWindow.prototype.isDone = function () {
        // return T/F where T means are window is closed or closing
        return this.mainWindowOpen == true ? false : true;
    };
    MainWindow.prototype.getParallaxFontUrl = function () {
        // In packaged app, use process.resourcesPath, in dev use relative path
        var resourcesPath = process.resourcesPath || path_1.default.join(__dirname, '../../../');
        var fontPath = path_1.default.join(resourcesPath, 'fonts', 'Parallax.ttf');
        // Convert to file URL with forward slashes for cross-platform compatibility
        return "file://".concat(fontPath.replace(/\\/g, '/'));
    };
    MainWindow.prototype.getIBM3270FontUrl = function () {
        // In packaged app, use process.resourcesPath, in dev use relative path
        var resourcesPath = process.resourcesPath || path_1.default.join(__dirname, '../../../');
        var fontPath = path_1.default.join(resourcesPath, 'src/assets/fonts', '3270-Regular.ttf');
        // Convert to file URL with forward slashes for cross-platform compatibility
        return "file://".concat(fontPath.replace(/\\/g, '/'));
    };
    MainWindow.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Remove all listeners to prevent memory leaks and allow port to be reused
                        this.logMessage('* close()');
                        if (!(this._serialPort !== undefined)) return [3 /*break*/, 2];
                        this._serialPort.removeAllListeners();
                        return [4 /*yield*/, this._serialPort.close()];
                    case 1:
                        _a.sent();
                        this._serialPort = undefined;
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    // ----------------------------------------------------------------------
    // this is our serial transmitter!!
    //
    MainWindow.prototype.sendSerialData = function (data) {
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
    };
    // ----------------------------------------------------------------------
    // this is our serial receiver!!
    //
    MainWindow.prototype.openSerialPort = function (deviceNode) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_1;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        usb_serial_1.UsbSerial.setCommBaudRate(this._serialBaud);
                        this.logMessage("* openSerialPort() - ".concat(deviceNode));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        _a = this;
                        return [4 /*yield*/, new usb_serial_1.UsbSerial(this.context, deviceNode)];
                    case 2:
                        _a._serialPort = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        this.logMessage("ERROR: openSerialPort() - ".concat(deviceNode, " failed to open. Error: ").concat(error_1));
                        // Notify user visually about connection failure
                        this.appendLog("\u26A0\uFE0F SERIAL PORT CONNECTION FAILED: ".concat(deviceNode));
                        this.appendLog("   Error: ".concat(error_1));
                        this.appendLog("   Possible causes:");
                        this.appendLog("   \u2022 Device not plugged in");
                        this.appendLog("   \u2022 USB hub disconnected (try unplug/replug hub)");
                        this.appendLog("   \u2022 Device in use by another application");
                        this.appendLog("   \u2022 Insufficient permissions");
                        return [3 /*break*/, 4];
                    case 4:
                        if (this._serialPort === undefined) {
                            this.logMessage("ERROR: openSerialPort() - ".concat(deviceNode, " failed to open"));
                            this.updateConnectionStatus(false);
                            this.updateStatusBarField('propPlug', "".concat(deviceNode, " (FAILED)"));
                        }
                        if (this._serialPort !== undefined) {
                            this.logMessage("* openSerialPort() - IS OPEN");
                            this._serialPort.on('data', function (data) { return _this.handleSerialRx(data); });
                            this.updateConnectionStatus(true);
                            // Removed startup text - connection status now shown in status bar
                            // Load device-specific control line preference
                            this.controlLineMode = this.getDeviceControlLine();
                            this.updateControlLineUI();
                            this.logMessage("\uD83D\uDD27 Control line mode set to ".concat(this.controlLineMode, " for this device"));
                            // Initialize downloader with serial port
                            if (!this.downloader && this._serialPort) {
                                this.downloader = new downloader_1.Downloader(this.context, this._serialPort);
                                this.logMessage("* openSerialPort() - Downloader initialized");
                            }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate timeout based on baud rate - time to transmit MAX_LINE_CHARS
     */
    MainWindow.prototype.calculateSyncTimeout = function () {
        // Get baud rate from UsbSerial static property
        var baudRate = usb_serial_1.UsbSerial.desiredCommsBaudRate || this.DEFAULT_BAUD_RATE;
        var bitsPerChar = 10; // Start bit + 8 data bits + stop bit
        var totalBits = this.MAX_LINE_CHARS * bitsPerChar;
        var timeoutMs = (totalBits / baudRate) * 1000;
        // Add 50% safety margin for processing delays
        var safetyMargin = timeoutMs * 0.5;
        var finalTimeout = Math.max(timeoutMs + safetyMargin, 10); // Minimum 10ms
        console.log("[SYNC TIMEOUT] Baud: ".concat(baudRate, ", Line: ").concat(this.MAX_LINE_CHARS, " chars, Timeout: ").concat(finalTimeout.toFixed(1), "ms"));
        return finalTimeout;
    };
    MainWindow.prototype.handleSerialRx = function (data) {
        // Handle received data - can be Buffer (raw bytes) or string (from parser)
        // RX activity indicator - blink for ALL received data (binary or text)
        var dataLength = Buffer.isBuffer(data) ? data.length : data.length;
        this.rxCharCounter += dataLength;
        if (this.rxCharCounter >= 50 || !this.rxActivityTimer) {
            this.blinkActivityLED('rx');
            this.rxCharCounter = 0;
        }
        if (Buffer.isBuffer(data)) {
            console.log("[SERIAL RX] Received ".concat(data.length, " bytes"));
            // Log hex and ASCII for debugging - same format as debug logger
            var hexLines = [];
            var bytesPerLine = 16;
            for (var offset = 0; offset < data.length; offset += bytesPerLine) {
                var lineBytes = data.slice(offset, Math.min(offset + bytesPerLine, data.length));
                // Build hex part
                var hexPart = '';
                for (var i = 0; i < bytesPerLine; i++) {
                    if (i < lineBytes.length) {
                        hexPart += "$".concat(lineBytes[i].toString(16).toUpperCase().padStart(2, '0'), " ");
                    }
                    else {
                        hexPart += '    ';
                    }
                    if (i === 7)
                        hexPart += ' '; // Extra space in middle
                }
                // Build ASCII part
                var asciiPart = '';
                for (var i = 0; i < lineBytes.length; i++) {
                    var byte = lineBytes[i] & 0x7F; // Mask with 0x7F to clean up binary data display
                    asciiPart += (byte >= 0x20 && byte <= 0x7E) ? String.fromCharCode(byte) : '.';
                }
                var offsetHex = offset.toString(16).padStart(4, '0');
                hexLines.push("  ".concat(offsetHex, ": ").concat(hexPart, "  ").concat(asciiPart));
            }
            console.log('[SERIAL RX HEX/ASCII]:');
            hexLines.forEach(function (line) { return console.log(line); });
            // Two-Tier Pattern Matching: Process serial data through new architecture
            this.serialProcessor.receiveData(data);
            return;
        }
        if (typeof data === 'string') {
            console.log("[SERIAL RX] Text data: ".concat(data.length, " chars: \"").concat(data, "\""));
            // GROUND ZERO RECOVERY: Check for Cog-prefixed messages first (backward compatibility)
            if (data.startsWith('Cog')) {
                console.log("[DEBUG] Potential COG message found: \"".concat(data, "\", length: ").concat(data.length, ", char[3]: \"").concat(data[3], "\", char[4]: \"").concat(data[4], "\""));
                if (data.length > 4 && data[4] === ' ') {
                    console.log("[COG DETECTION] Found Cog message: ".concat(data));
                    this.handleCogMessage(data);
                    return; // Don't process through new architecture for backward compatibility
                }
            }
            // Convert string to Buffer and process through Two-Tier Pattern Matching
            var buffer = Buffer.from(data);
            this.serialProcessor.receiveData(buffer);
            return;
        }
    };
    /**
     * Log binary data to debug logger with appropriate formatting
     */
    MainWindow.prototype.logBinaryData = function (data, binaryType) {
        if (this.debugLoggerWindow) {
            // Format based on type
            var formattedMessage = void 0;
            if (binaryType === 'debugger') {
                // Use 32-byte/line format for debugger packets
                formattedMessage = this.formatDebuggerBinary(data);
            }
            else {
                // Use 16-byte/line format with ASCII for raw P2 data
                formattedMessage = this.formatRawBinary(data);
            }
            this.debugLoggerWindow.logMessage(formattedMessage);
        }
    };
    /**
     * Create Debug Logger Window immediately on startup for auto-logging
     */
    MainWindow.prototype.createDebugLoggerWindow = function () {
        var _this = this;
        if (this.debugLoggerWindow) {
            console.log('[DEBUG LOGGER] Debug Logger already exists, skipping creation');
            return;
        }
        console.log('[DEBUG LOGGER] Creating debug logger window for auto-logging...');
        try {
            this.debugLoggerWindow = debugLoggerWin_1.DebugLoggerWindow.getInstance(this.context);
            console.log('[DEBUG LOGGER] Auto-created successfully - logging started immediately');
            this.displays['DebugLogger'] = this.debugLoggerWindow;
            // Set up event listeners
            this.debugLoggerWindow.on('close', function () {
                _this.logMessage('Debug Logger Window closed');
                console.log('[DEBUG LOGGER] Window closed by user');
                delete _this.displays['DebugLogger'];
                _this.debugLoggerWindow = null;
                _this.updateLoggingStatus(false);
            });
            this.debugLoggerWindow.on('loggingStatusChanged', function (status) {
                _this.updateLoggingStatus(status.isLogging, status.filename);
                if (_this.context.runEnvironment.loggingEnabled) {
                    _this.logMessage("Debug Logger logging status: ".concat(status.isLogging ? 'STARTED' : 'STOPPED', " ").concat(status.filename || ''));
                }
            });
            // Listen for COG-related events
            this.debugLoggerWindow.on('show-all-cogs-requested', function () {
                _this.handleShowAllCOGs();
            });
            this.debugLoggerWindow.on('export-cog-logs-requested', function () {
                console.log('[MAIN] Export COG logs requested');
            });
            if (this.context.runEnvironment.loggingEnabled) {
                this.logMessage('Auto-created Debug Logger Window - logging started immediately');
            }
        }
        catch (error) {
            console.error('[DEBUG LOGGER] Failed to create Debug Logger Window:', error);
            this.logMessage("ERROR: Failed to create Debug Logger Window: ".concat(error));
        }
    };
    /**
     * Handle P2 system reboot event - complete synchronization reset
     * Triggered by "Cog0 INIT $0000_0000 $0000_0000 load" message
     */
    MainWindow.prototype.handleP2SystemReboot = function (eventData) {
        var _this = this;
        console.log("[P2 SYNC] \uD83D\uDD04 Starting complete P2 synchronization reset...");
        // 1. Clear all sync buffers and parser state
        console.log("[P2 SYNC] \uD83E\uDDF9 Clearing sync buffers and parser state");
        this.syncBuffer = ''; // Clear the message synchronization buffer
        // 2. Reset debugger parser state  
        console.log("[P2 SYNC] \uD83D\uDD04 Resetting debugger parser state");
        this.serialProcessor.onDTRReset(); // Trigger Two-Tier reset
        // 3. Clear and restart the Debug Logger session
        if (this.debugLoggerWindow) {
            console.log("[P2 SYNC] \uD83D\uDCDD Restarting Debug Logger session");
            try {
                // Signal DTR reset to create new log file boundary
                this.debugLoggerWindow.handleDTRReset();
                // Signal DTR reset to create new log file boundary (no reboot marker in log)
            }
            catch (error) {
                console.error("[P2 SYNC] Error restarting Debug Logger:", error);
            }
        }
        // 4. Reset COG window tracking (all COGs start fresh after reboot)
        console.log("[P2 SYNC] \uD83C\uDFAF Resetting COG window tracking");
        // Note: Don't close existing COG windows - user may want to see previous session data
        // Just reset their internal state for new session
        Object.keys(this.displays).forEach(function (key) {
            if (key.startsWith('COG-')) {
                var cogWindow = _this.displays[key];
                if (cogWindow && typeof cogWindow.clear === 'function') {
                    console.log("[P2 SYNC] \uD83D\uDD04 Resetting ".concat(key, " window state"));
                    // Clear the window but keep it open for comparison
                }
            }
        });
        // 5. Update main window status
        if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage("\uD83C\uDFAF P2 SYSTEM REBOOT DETECTED - Complete synchronization reset performed");
            this.logMessage("   Golden marker: ".concat(eventData.message));
            this.logMessage("   All parsers and buffers reset - perfect sync achieved");
        }
        // P2 system messages go to debug logger, not main terminal
        console.log("[P2 SYNC] \u2705 Complete P2 synchronization reset finished - perfect sync achieved");
    };
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
    MainWindow.prototype.applySyncStrategy = function (data) {
        var results = [];
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
        var syncPattern = /(\r\n|\n\r|\r|\n)(?:Cog\d\s|`)/g;
        // Find all sync pattern positions
        var syncPoints = [];
        var match;
        while ((match = syncPattern.exec(this.syncBuffer)) !== null) {
            syncPoints.push(match.index);
        }
        var completeContent = '';
        var incompleteFragment = '';
        if (syncPoints.length > 0) {
            // We have at least one sync point - everything before the last sync is complete
            var lastSyncPoint = syncPoints[syncPoints.length - 1];
            completeContent = this.syncBuffer.substring(0, lastSyncPoint);
            incompleteFragment = this.syncBuffer.substring(lastSyncPoint);
            console.log("[SYNC] Found ".concat(syncPoints.length, " sync points, splitting at position ").concat(lastSyncPoint));
        }
        else {
            // No sync patterns found - use simple line ending detection
            var lines = this.syncBuffer.split(/\r?\n/);
            // Process all lines except the last one (which might be incomplete)
            for (var i = 0; i < lines.length - 1; i++) {
                if (completeContent.length > 0) {
                    completeContent += '\r\n';
                }
                completeContent += lines[i];
            }
            // The last line is incomplete if buffer doesn't end with line ending
            var lastLine = lines[lines.length - 1];
            var endsWithLineEnding = this.syncBuffer.match(/\r?\n$/);
            if (endsWithLineEnding && lastLine.length > 0) {
                if (completeContent.length > 0) {
                    completeContent += '\r\n';
                }
                completeContent += lastLine;
                incompleteFragment = '';
            }
            else {
                incompleteFragment = lastLine;
            }
        }
        // Forward all complete content immediately, split by lines
        if (completeContent.length > 0) {
            // Split complete content into individual lines for proper routing
            // This ensures each Cog message and backtick command is processed separately
            var lines = completeContent.split(/\r\n|\n\r|\r|\n/);
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                if (line.length > 0) { // Skip empty lines
                    if (this.isAsciiPrintable(line)) {
                        console.log("[SYNC] \u2705 Forwarding line: \"".concat(line.substring(0, 50)).concat(line.length > 50 ? '...' : '', "\""));
                        results.push(line);
                    }
                    else {
                        console.log("[SYNC] \u26A0\uFE0F Non-ASCII line, dumping as hex:");
                        this.dumpHexData(line);
                        results.push(line); // Forward anyway for debugging
                    }
                }
            }
        }
        // Handle incomplete fragment
        if (incompleteFragment.length > 0) {
            console.log("[SYNC] \uD83D\uDD04 Buffering incomplete fragment (".concat(incompleteFragment.length, " chars): \"").concat(incompleteFragment, "\""));
            this.syncBuffer = incompleteFragment;
            this.lastSyncTime = Date.now(); // Start timer for fragment
        }
        else {
            console.log("[SYNC] \uD83D\uDFE2 No incomplete fragment - buffer cleared");
            this.syncBuffer = '';
        }
        // Check for timeout on buffered fragment
        if (this.syncBuffer.length > 0) {
            var dynamicTimeout = this.calculateSyncTimeout();
            var timeSinceLastSync = Date.now() - this.lastSyncTime;
            if (timeSinceLastSync > dynamicTimeout) {
                // Timeout reached - process incomplete fragment
                console.log("[SYNC] \u23F1\uFE0F Timeout (".concat(dynamicTimeout.toFixed(1), "ms) - processing incomplete fragment: \"").concat(this.syncBuffer, "\""));
                if (this.isAsciiPrintable(this.syncBuffer)) {
                    results.push(this.syncBuffer);
                }
                else {
                    console.log("[SYNC] \u26A0\uFE0F Non-ASCII fragment, dumping as hex:");
                    this.dumpHexData(this.syncBuffer);
                }
                this.syncBuffer = '';
            }
        }
        return results;
    };
    /**
     * Check if string contains only printable ASCII characters
     */
    MainWindow.prototype.isAsciiPrintable = function (str) {
        for (var i = 0; i < str.length; i++) {
            var code = str.charCodeAt(i);
            // Allow printable ASCII (32-126), plus common control chars (9=TAB, 10=LF, 13=CR)
            if (!((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13)) {
                return false;
            }
        }
        return true;
    };
    /**
     * Dump non-ASCII data in hex + ASCII format for debugging
     */
    MainWindow.prototype.dumpHexData = function (data) {
        var bytes = [];
        var ascii = [];
        for (var i = 0; i < data.length; i++) {
            var code = data.charCodeAt(i);
            bytes.push(code.toString(16).padStart(2, '0'));
            ascii.push(code >= 32 && code <= 126 ? data.charAt(i) : '.');
        }
        // Format as hex dump: address | hex bytes | ASCII
        var bytesPerLine = 16;
        for (var i = 0; i < bytes.length; i += bytesPerLine) {
            var hexLine = bytes.slice(i, i + bytesPerLine).join(' ').padEnd(bytesPerLine * 3 - 1, ' ');
            var asciiLine = ascii.slice(i, i + bytesPerLine).join('');
            console.log("[SYNC] ".concat(i.toString(16).padStart(4, '0'), ": ").concat(hexLine, " | ").concat(asciiLine));
        }
    };
    MainWindow.prototype.handleDebugCommand = function (data) {
        //const lineParts: string[] = data.split(' ').filter(Boolean); // extra whitespace caused empty strings
        // Split the data and remove empty values
        var lineParts = data.split(' ').filter(function (part) { return part.trim() !== ''; });
        this.logMessage("* handleDebugCommand() - [".concat(data, "]: lineParts=[").concat(lineParts.join(' | '), "](").concat(lineParts.length, ")"));
        var possibleName = lineParts[0].substring(1).toUpperCase();
        var foundDisplay = false;
        if (lineParts[0].charAt(0) === '`') {
            // first, is this for one of our displays?
            var displayEntries = Object.entries(this.displays);
            displayEntries.forEach(function (_a) {
                var displayName = _a[0], window = _a[1];
                if (displayName.toUpperCase() === possibleName) {
                    // found it, route to the window handler
                    var debugWindow = window;
                    // remove commas from the data
                    var cleanedParts = lineParts.map(function (part) { return part.replace(/,/g, ''); });
                    debugWindow.updateContent(cleanedParts); // NOTE: this will eventually show the debug window!
                    foundDisplay = true;
                }
            });
            if (!foundDisplay) {
                // 2nd, is it a window creation command?
                // For LOGIC windows, check if the name ends with "LOGIC"
                // This handles commands like `MyLogic which should create a LOGIC window
                var windowType = possibleName;
                if (possibleName.endsWith('LOGIC')) {
                    windowType = 'LOGIC';
                }
                else if (possibleName.endsWith('TERM')) {
                    windowType = 'TERM';
                }
                else if (possibleName.endsWith('SCOPE')) {
                    windowType = 'SCOPE';
                }
                this.logMessage("* handleDebugCommand() - possibleName=[".concat(possibleName, "], windowType=[").concat(windowType, "]"));
                switch (windowType) {
                    case this.DISPLAY_SCOPE: {
                        // create new window to display scope data
                        var _a = debugScopeWin_1.DebugScopeWindow.parseScopeDeclaration(lineParts), isValid = _a[0], scopeSpec = _a[1];
                        this.logMessage("* handleDebugCommand() - back from parse");
                        if (isValid) {
                            // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
                            var scopeDisplay = new debugScopeWin_1.DebugScopeWindow(this.context, scopeSpec);
                            // remember active displays!
                            this.hookNotifcationsAndRememberWindow(scopeSpec.displayName, scopeDisplay);
                        }
                        else {
                            if (this.context.runEnvironment.loggingEnabled) {
                                this.logMessage("BAD DISPLAY: Received: ".concat(data));
                            }
                        }
                        foundDisplay = true;
                        break;
                    }
                    case this.DISPLAY_LOGIC: {
                        console.log("[LOGIC WINDOW CREATION] Starting LOGIC window creation for: ".concat(data));
                        console.log("[LOGIC WINDOW CREATION] LineParts: [".concat(lineParts.join(' | '), "]"));
                        // create new window to display scope data
                        var _b = debugLogicWin_1.DebugLogicWindow.parseLogicDeclaration(lineParts), isValid = _b[0], logicSpec = _b[1];
                        console.log("[LOGIC WINDOW CREATION] Parse result: isValid=".concat(isValid));
                        if (logicSpec) {
                            console.log("[LOGIC WINDOW CREATION] LogicSpec:", JSON.stringify(logicSpec, null, 2));
                        }
                        this.logMessage("* handleDebugCommand() - back from parse");
                        if (isValid) {
                            console.log("[LOGIC WINDOW CREATION] Creating DebugLogicWindow instance...");
                            // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
                            var logicDisplay = new debugLogicWin_1.DebugLogicWindow(this.context, logicSpec);
                            console.log("[LOGIC WINDOW CREATION] Instance created, now hooking notifications...");
                            // remember active displays!
                            this.hookNotifcationsAndRememberWindow(logicSpec.displayName, logicDisplay);
                            console.log("[LOGIC WINDOW CREATION] \u2705 LOGIC window '".concat(logicSpec.displayName, "' should be visible now!"));
                        }
                        else {
                            console.log("[LOGIC WINDOW CREATION] \u274C Failed to parse LOGIC command: ".concat(data));
                            if (this.context.runEnvironment.loggingEnabled) {
                                this.logMessage("BAD DISPLAY: Received: ".concat(data));
                            }
                        }
                        foundDisplay = true;
                        break;
                    }
                    case this.DISPLAY_TERM: {
                        // create new window to display term data
                        console.log("[TERM CREATION] Processing TERM command: ".concat(data));
                        console.log("[TERM CREATION] LineParts: [".concat(lineParts.join(' | '), "]"));
                        var _c = debugTermWin_1.DebugTermWindow.parseTermDeclaration(lineParts), isValid = _c[0], termSpec = _c[1];
                        console.log("[TERM CREATION] Parse result: isValid=".concat(isValid, ", termSpec="), termSpec);
                        this.logMessage("* handleDebugCommand() - back from parse, isValid=".concat(isValid));
                        if (isValid) {
                            // create new window from spec, recording the new window has name: termSpec.displayName so we can find it later
                            console.log("[TERM CREATION] Creating DebugTermWindow with spec:", termSpec);
                            var termDisplay = new debugTermWin_1.DebugTermWindow(this.context, termSpec);
                            // remember active displays!
                            this.hookNotifcationsAndRememberWindow(termSpec.displayName, termDisplay);
                            console.log("[TERM CREATION] \u2705 Successfully created TERM window: ".concat(termSpec.displayName));
                        }
                        else {
                            console.log("[TERM CREATION] \u274C Failed to parse TERM command: ".concat(data));
                            if (this.context.runEnvironment.loggingEnabled) {
                                this.logMessage("BAD DISPLAY: Received: ".concat(data));
                            }
                        }
                        foundDisplay = true;
                        break;
                    }
                    case this.DISPLAY_PLOT: {
                        // create new window to display scope data
                        var _d = debugPlotWin_1.DebugPlotWindow.parsePlotDeclaration(lineParts), isValid = _d[0], plotSpec = _d[1];
                        this.logMessage("* handleDebugCommand() - back from parse");
                        if (isValid) {
                            // create new window from spec, recording the new window has name: scopeSpec.displayName so we can find it later
                            var plotDisplay = new debugPlotWin_1.DebugPlotWindow(this.context, plotSpec);
                            // remember active displays!
                            this.hookNotifcationsAndRememberWindow(plotSpec.displayName, plotDisplay);
                        }
                        else {
                            if (this.context.runEnvironment.loggingEnabled) {
                                this.logMessage("BAD DISPLAY: Received: ".concat(data));
                            }
                        }
                        foundDisplay = true;
                        break;
                    }
                    case this.DISPLAY_BITMAP: {
                        // create new window to display bitmap data
                        var _e = debugBitmapWin_1.DebugBitmapWindow.parseBitmapDeclaration(lineParts), isValid = _e[0], bitmapSpec = _e[1];
                        this.logMessage("* handleDebugCommand() - back from parse");
                        if (isValid) {
                            // create new window from spec, recording the new window has name: bitmapSpec.displayName so we can find it later
                            var bitmapDisplay = new debugBitmapWin_1.DebugBitmapWindow(bitmapSpec.title, bitmapSpec.displayName, this.context, bitmapSpec.position);
                            // remember active displays!
                            this.hookNotifcationsAndRememberWindow(bitmapSpec.displayName, bitmapDisplay);
                        }
                        else {
                            if (this.context.runEnvironment.loggingEnabled) {
                                this.logMessage("BAD DISPLAY: Received: ".concat(data));
                            }
                        }
                        foundDisplay = true;
                        break;
                    }
                    case this.DISPLAY_MIDI: {
                        // MIDI window instantiation: Extract display name
                        var displayName = 'MIDI';
                        if (lineParts.length > 1) {
                            displayName = lineParts[1];
                        }
                        // Create new MIDI window
                        var midiDisplay = new debugMidiWin_1.DebugMidiWindow(this.context);
                        midiDisplay.windowTitle = displayName;
                        midiDisplay.createDebugWindow();
                        // Process remaining parameters
                        if (lineParts.length > 2) {
                            midiDisplay.updateContent(lineParts.slice(2));
                        }
                        // Remember active display
                        this.hookNotifcationsAndRememberWindow(displayName, midiDisplay);
                        foundDisplay = true;
                        break;
                    }
                    default:
                        this.logMessage("ERROR: display [".concat(possibleName, "] not supported!"));
                        break;
                }
            }
            if (foundDisplay) {
                this.immediateLog = false; // change from immediate log to buffered log
            }
            if (!foundDisplay && this.mainWindow != null) {
                if (this.context.runEnvironment.loggingEnabled) {
                    this.logMessage("* Received: ".concat(data, " - UNHANDLED  lineParts=[").concat(lineParts.join(','), "]"));
                }
            }
        }
    };
    MainWindow.prototype.hookNotifcationsAndRememberWindow = function (windowName, windowObject) {
        var _this = this;
        this.logMessage("GOOD DISPLAY: Received for ".concat(windowName));
        // esure we get notifications of window close
        windowObject.on('close', function () {
            _this.logMessage("CallBack: Window ".concat(windowName, " is closing."));
            _this.cleanupOnClose(windowName);
        });
        windowObject.on('closed', function () {
            _this.logMessage("CallBack: Window ".concat(windowName, " has closed."));
        });
        // remember active displays!
        this.displays[windowName] = windowObject;
    };
    MainWindow.prototype.cleanupOnClose = function (windowName) {
        this.logMessage("cleanupOnClose() ".concat(windowName));
        // flush the log buffer
        this.flushLogBuffer();
        this.immediateLog = true;
        var windowObject = this.displays[windowName];
        // remove the window from the list of active displays
        delete this.displays[windowName];
        // and remove listeners
        windowObject.removeAllListeners();
    };
    /**
     * Handle Cog-prefixed messages - route to debug logger and extract embedded commands
     */
    // RESTORED: handleCogMessage - Temporarily restored for Ground Zero Recovery
    MainWindow.prototype.handleCogMessage = function (data) {
        var _this = this;
        // Auto-create debug logger window on first Cog or INIT message
        if (!this.debugLoggerWindow) {
            console.log('[DEBUG LOGGER] Creating debug logger window...');
            try {
                this.debugLoggerWindow = debugLoggerWin_1.DebugLoggerWindow.getInstance(this.context);
                // Register it in displays for cleanup tracking
                this.displays['DebugLogger'] = this.debugLoggerWindow;
                // Set up cleanup handler
                this.debugLoggerWindow.on('close', function () {
                    _this.logMessage('Debug Logger Window closed');
                    console.log('[DEBUG LOGGER] Window closed by user');
                    delete _this.displays['DebugLogger'];
                    _this.debugLoggerWindow = null;
                });
                if (this.context.runEnvironment.loggingEnabled) {
                    this.logMessage('Auto-created Debug Logger Window for Cog messages');
                }
            }
            catch (error) {
                // Fall back to console logging if window creation fails
                console.error('Failed to create Debug Logger Window:', error);
                console.log("[COG] ".concat(data));
                return;
            }
        }
        // Route FULL message to debug logger (don't strip prefix)
        // Window will decide what to display
        if (this.debugLoggerWindow) {
            console.log("[DEBUG LOGGER] Sending message: ".concat(data));
            // updateContent expects array format
            this.debugLoggerWindow.updateContent([data]);
        }
        else {
            // Fallback to console if logger window is unavailable
            console.error('[DEBUG LOGGER] Window not available, falling back to console');
            console.log("[DEBUG OUTPUT] ".concat(data));
        }
        // Check for embedded backtick commands within the Cog message
        // Format: "Cog0: Some text `TERM TestTerm SIZE 40 20"
        var backtickIndex = data.indexOf('`');
        if (backtickIndex !== -1) {
            var embeddedCommand = data.substring(backtickIndex);
            if (this.context.runEnvironment.loggingEnabled) {
                this.logMessage("* Extracting embedded command from Cog message: ".concat(embeddedCommand));
            }
            // Route the embedded command to the appropriate debug window
            this.handleDebugCommand(embeddedCommand);
        }
        // Log the Cog message receipt if logging is enabled
        if (this.context.runEnvironment.loggingEnabled) {
            this.logMessage("* Received Cog message: ".concat(data));
        }
    };
    // ----------------------------------------------------------------------
    // this is our Window Configuration
    //
    MainWindow.prototype.CalcWindowCoords = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, width, height, charWidth, charHeight, minWidth, minHeight, targetScreenWidth, targetScreenHeight;
            return __generator(this, function (_b) {
                _a = electron.screen.getPrimaryDisplay().workAreaSize, width = _a.width, height = _a.height;
                console.log("work area size: ".concat(width, " x ").concat(height));
                charWidth = 12;
                charHeight = 18;
                console.log("     char size (default): ".concat(charWidth, " x ").concat(charHeight));
                minWidth = 80 * charWidth;
                minHeight = (24 + 1) * charHeight;
                targetScreenWidth = height < 800 ? Math.round(width / 2) : Math.round(width / 4);
                targetScreenHeight = height < 800 ? Math.round((height / 5) * 2) : Math.round(this.mainWindowGeometry.width / 3.3);
                // Ensure the window is at least the minimum size
                this.mainWindowGeometry.width = Math.max(minWidth, targetScreenWidth);
                this.mainWindowGeometry.height = Math.max(minHeight, targetScreenHeight);
                // position window bottom-center
                this.mainWindowGeometry.xOffset = Math.round((width - this.mainWindowGeometry.width) / 2); // Center horizontally
                this.mainWindowGeometry.yOffset = Math.round(height - this.mainWindowGeometry.height - 50); // Bottom with 50px margin
                console.log("window geom: ".concat(this.mainWindowGeometry.width, "x").concat(this.mainWindowGeometry.height, " @").concat(this.mainWindowGeometry.xOffset, ",").concat(this.mainWindowGeometry.yOffset));
                return [2 /*return*/];
            });
        });
    };
    MainWindow.prototype.createAppWindow = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_2, dataEntryBGColor, dataEntryFGColor, logContentBGColor, logContentFGColor, isIdeMode, htmlContent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[STARTUP] createAppWindow() called');
                        this.context.logger.forceLogMessage("* create App Window()");
                        this.mainWindowOpen = true;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.CalcWindowCoords()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error('[STARTUP] ERROR in CalcWindowCoords:', error_2);
                        return [3 /*break*/, 4];
                    case 4:
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
                        dataEntryBGColor = this.termColors.xmitBGColor;
                        dataEntryFGColor = this.termColors.xmitFGColor;
                        logContentBGColor = this.termColors.rcvBGColor;
                        logContentFGColor = this.termColors.rcvFGColor;
                        isIdeMode = this.context.runEnvironment.ideMode;
                        htmlContent = isIdeMode ? this.createIDEModeHTML() : this.createStandardHTML();
                        this.mainWindow.loadURL("data:text/html;charset=utf-8,".concat(encodeURIComponent(htmlContent)));
                        // Only set up menu in standard mode
                        console.log("[MENU SETUP] IDE Mode: ".concat(isIdeMode, ", Setting up menu: ").concat(!isIdeMode));
                        // Set up the system menu (macOS only, prevents "Electron" from showing)
                        this.setupApplicationMenu();
                        if (!isIdeMode) {
                            console.log('[MENU SETUP] Standalone Mode - HTML menu bar will be used');
                            // Standard mode: HTML menu bar in the window
                            // No native menu bar in window on any platform
                            this.mainWindow.setMenuBarVisibility(false);
                        }
                        else {
                            console.log('[MENU SETUP] IDE Mode - No menus');
                            // IDE mode: No menus at all
                            this.mainWindow.setMenuBarVisibility(false);
                        }
                        this.setupWindowHandlers();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Set the control line mode and update UI
     */
    MainWindow.prototype.setControlLineMode = function (mode) {
        var previousMode = this.controlLineMode;
        this.controlLineMode = mode;
        this.logMessage("Control line mode changed from ".concat(previousMode, " to ").concat(mode));
        // Update the toolbar to show the correct control
        this.updateControlLineUI();
        // If switching modes, ensure both are off to avoid conflicts
        if (previousMode !== mode) {
            this.dtrState = false;
            this.rtsState = false;
            if (this._serialPort) {
                this._serialPort.setDTR(false).catch(function () { });
                this._serialPort.setRTS(false).catch(function () { });
            }
        }
    };
    /**
     * Update the UI to show only the active control line
     */
    MainWindow.prototype.updateControlLineUI = function () {
        // Regenerate the toolbar HTML with the correct control
        var toolbarHTML = this.getControlLineHTML();
        var isIdeMode = this.context.runEnvironment.ideMode;
        // Update the toolbar element
        this.safeExecuteJS("\n      const toolbar = document.getElementById('toolbar');\n      if (toolbar) {\n        // Find the control line elements (before first separator)\n        const separator = toolbar.querySelector('.toolbar-separator');\n        if (separator) {\n          // Remove old control elements\n          while (toolbar.firstChild && toolbar.firstChild !== separator) {\n            toolbar.removeChild(toolbar.firstChild);\n          }\n          \n          // Insert new control HTML\n          const temp = document.createElement('div');\n          temp.innerHTML = `".concat(toolbarHTML.replace(/`/g, '\\`'), "`;\n          while (temp.firstChild) {\n            toolbar.insertBefore(temp.firstChild, separator);\n          }\n          \n          // Re-attach event handlers\n          ").concat(this.controlLineMode === 'DTR' ? "\n            const dtrToggle = document.getElementById('dtr-toggle');\n            const dtrCheckbox = document.getElementById('dtr-checkbox');\n            if (dtrToggle) {\n              dtrToggle.addEventListener('click', () => {\n                window.ipcRenderer.send('toggle-dtr');\n              });\n            }\n            if (dtrCheckbox) {\n              dtrCheckbox.addEventListener('change', (e) => {\n                if (!e.isTrusted) return;\n                window.ipcRenderer.send('toggle-dtr');\n              });\n              // Set current state\n              dtrCheckbox.checked = ".concat(this.dtrState, ";\n            }\n          ") : "\n            const rtsToggle = document.getElementById('rts-toggle');\n            const rtsCheckbox = document.getElementById('rts-checkbox');\n            if (rtsToggle) {\n              rtsToggle.addEventListener('click', () => {\n                window.ipcRenderer.send('toggle-rts');\n              });\n            }\n            if (rtsCheckbox) {\n              rtsCheckbox.addEventListener('change', (e) => {\n                if (!e.isTrusted) return;\n                window.ipcRenderer.send('toggle-rts');\n              });\n              // Set current state\n              rtsCheckbox.checked = ".concat(this.rtsState, ";\n            }\n          "), "\n        }\n      }\n    "), 'update control line UI');
    };
    /**
     * Generate HTML for control line (DTR or RTS) based on current mode
     * Only shows the active control line to reduce UI confusion
     */
    MainWindow.prototype.getControlLineHTML = function () {
        if (this.controlLineMode === 'RTS') {
            return "\n        <button id=\"rts-toggle\" class=\"toolbar-button\">RTS</button>\n        <input type=\"checkbox\" id=\"rts-checkbox\" style=\"margin-left: 5px;\">\n      ";
        }
        else {
            // Default to DTR (Parallax standard)
            return "\n        <button id=\"dtr-toggle\" class=\"toolbar-button\">DTR</button>\n        <input type=\"checkbox\" id=\"dtr-checkbox\" style=\"margin-left: 5px;\">\n      ";
        }
    };
    MainWindow.prototype.createIDEModeHTML = function () {
        var logContentBGColor = this.termColors.rcvBGColor;
        var logContentFGColor = this.termColors.rcvFGColor;
        // Minimal UI for IDE mode - just log content
        return "\n  <html>\n    <head>\n      <meta charset=\"UTF-8\">\n      <title>PNut Term TS - IDE Mode</title>\n      <style>\n        @font-face {\n          font-family: 'Parallax';\n          src: url('".concat(this.getParallaxFontUrl(), "') format('truetype');\n        }\n        body {\n          margin: 0;\n          padding: 0;\n          font-family: Consolas, 'Courier New', monospace;\n          font-size: 12px;\n          overflow: hidden;\n        }\n        #log-content {\n          position: absolute;\n          top: 0;\n          bottom: 20px;\n          left: 0;\n          right: 0;\n          overflow-y: auto;\n          padding: 5px;\n          background-color: ").concat(logContentBGColor, ";\n          color: ").concat(logContentFGColor, ";\n          font-family: 'Parallax', Consolas, monospace;\n        }\n        #status-bar {\n          position: fixed;\n          bottom: 0;\n          left: 0;\n          right: 0;\n          height: 20px;\n          background-color: #f0f0f0;\n          border-top: 1px solid #ccc;\n          display: flex;\n          align-items: center;\n          padding: 0 5px;\n          font-size: 11px;\n        }\n        .status-field {\n          margin-right: 15px;\n        }\n      </style>\n    </head>\n    <body>\n      <div id=\"log-content\"></div>\n      <div id=\"status-bar\">\n        <div class=\"status-field\">\n          <span id=\"connection-status\">Disconnected</span>\n        </div>\n        <div class=\"status-field\">\n          <span id=\"port-info\"></span>\n        </div>\n      </div>\n    </body>\n  </html>");
    };
    MainWindow.prototype.createStandardHTML = function () {
        var dataEntryBGColor = this.termColors.xmitBGColor;
        var dataEntryFGColor = this.termColors.xmitFGColor;
        var logContentBGColor = this.termColors.rcvBGColor;
        var logContentFGColor = this.termColors.rcvFGColor;
        // Standard mode with full UI
        return "\n  <html>\n    <head>\n      <meta charset=\"UTF-8\">\n      <title>PNut Term TS</title>\n      <style>\n          @font-face {\n            font-family: 'Parallax';\n            src: url('".concat(this.getParallaxFontUrl(), "') format('truetype');\n          }\n          @font-face {\n            font-family: 'IBM 3270';\n            src: url('").concat(this.getIBM3270FontUrl(), "') format('truetype');\n            font-weight: normal;\n            font-style: normal;\n          }\n        body {\n          display: flex;\n          flex-direction: column;\n          height: 100vh;\n          margin: 0;\n          font-family: Consolas, sans-serif; /* Use Arial or any sans-serif font */\n          font-size: 12px; /* Set a smaller font size */\n        }\n        p {\n          margin: 0;\n        }\n        #menu-bar {\n          position: fixed;\n          top: 0;\n          left: 0;\n          right: 0;\n          min-height: 24px;\n          background-color: #2d2d30;\n          border-bottom: 1px solid #464647;\n          z-index: 3;\n          font-size: 12px;\n        }\n        .menu-container {\n          display: flex;\n          background: #2d2d30;\n          font-size: 13px;\n          user-select: none;\n          width: 100%;\n        }\n        .menu-item {\n          position: relative;\n          padding: 4px 12px;\n          color: #cccccc;\n          cursor: pointer;\n        }\n        .menu-item:hover {\n          background: #094771;\n        }\n        .menu-dropdown {\n          display: none;\n          position: absolute;\n          top: 100%;\n          left: 0;\n          background: #383838;\n          border: 1px solid #464647;\n          min-width: 200px;\n          z-index: 1000;\n          box-shadow: 0 2px 8px rgba(0,0,0,0.3);\n        }\n        .menu-dropdown-item {\n          padding: 8px 16px;\n          color: #cccccc;\n          cursor: pointer;\n        }\n        .menu-dropdown-item:hover {\n          background: #094771;\n        }\n        #toolbar {\n          position: fixed;\n          top: 24px;\n          left: 0;\n          right: 0;\n          height: 32px;\n          background-color: #f5f5f5;\n          border-bottom: 1px solid #ddd;\n          display: flex;\n          align-items: center;\n          padding: 0 10px;\n          z-index: 2;\n        }\n        #dataEntry {\n          position: fixed;\n          top: 56px; /* Below menu (24px) + toolbar (32px) */\n          left: 8px;\n          right: 8px;\n          padding: 8px;\n          margin: 4px;\n          background-color: ").concat(dataEntryBGColor, ";\n          color: ").concat(dataEntryFGColor, ";\n          height: 36px; /* Input field height */\n          font-size: 14px; /* Slightly larger font */\n          border: 2px inset #c0c0c0; /* Recessed/inset appearance like original PST */\n          border-radius: 2px;\n          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.1); /* Lighter shadow effect */\n          font-family: 'Courier New', monospace;\n          z-index: 1;\n        }\n        #log-content {\n          position: absolute;\n          top: 108px; /* Height of menu (24px) + toolbar (32px) + dataEntry with margins (52px) */\n          bottom: 41px; /* Height of #status-bar */\n          left: 8px;\n          right: 8px;\n          flex-grow: 1;\n          overflow-y: auto;\n          padding: 10px;\n          background-color: ").concat(logContentBGColor, ";\n          color: ").concat(logContentFGColor, ";\n          border: 2px inset #c0c0c0; /* Recessed/inset appearance like original PST */\n          border-radius: 2px;\n          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.1); /* Lighter shadow effect */\n          margin: 4px;\n          font-family: Consolas, 'Courier New', monospace;\n        }\n        /* Font styles for terminal */\n        #log-content.font-default {\n          font-family: Consolas, 'Courier New', monospace;\n        }\n        #log-content.font-parallax {\n          font-family: 'Parallax', Consolas, monospace;\n        }\n        #log-content.font-ibm3270 {\n          font-family: 'IBM 3270', 'Courier New', monospace;\n          font-size: 14px;\n        }\n        /* IBM 3270 Green Phosphor theme */\n        #log-content.font-ibm3270-green {\n          font-family: 'IBM 3270', 'Courier New', monospace;\n          font-size: 14px;\n          background-color: #000000;\n          color: #00FF00;\n          text-shadow: 0 0 2px #00FF00;\n        }\n        /* IBM 3270 Amber Phosphor theme */\n        #log-content.font-ibm3270-amber {\n          font-family: 'IBM 3270', 'Courier New', monospace;\n          font-size: 14px;\n          background-color: #000000;\n          color: #FFBF00;\n          text-shadow: 0 0 2px #FFBF00;\n        }\n        .toolbar-button {\n          margin: 0 5px;\n          padding: 4px 8px;\n          background-color: #fff;\n          border: 1px solid #ccc;\n          border-radius: 3px;\n          cursor: pointer;\n          font-size: 12px;\n        }\n        .toolbar-button:hover {\n          background-color: #e8e8e8;\n        }\n        .toolbar-button:active {\n          background-color: #d0d0d0;\n        }\n        .toolbar-separator {\n          width: 1px;\n          height: 20px;\n          background-color: #ccc;\n          margin: 0 10px;\n        }\n        #status-bar {\n          position: fixed;\n          bottom: 0;\n          display: flex;\n          justify-content: space-between;\n          background-color: #f0f0f0;\n          padding: 10px;\n          border-top: 1px solid #ccc;\n          z-index: 1;\n        }\n        .status-left {\n          display: flex;\n          align-items: center;\n        }\n        .status-right {\n          display: flex;\n          align-items: center;\n        }\n        .status-field {\n          margin-left: 20px;\n          display: flex;\n          align-items: center;\n        }\n        .status-label {\n          font-weight: bold;\n          margin-right: 5px;\n        }\n        .status-value {\n          padding: 2px 5px;\n          background-color: #e0e0e0;\n          border: 1px solid #ccc;\n          border-radius: 3px;\n        }\n        #kbd-entry {\n          width: 100%; /* Make kbd-entry span the full width */\n        }\n        #in-out {\n          width: 100%; /* Make kbd-entry span the full width */\n          display: flex;\n          flex-direction: column;\n          margin: 0px;\n          padding: 0px;\n        }\n      </style>\n    </head>\n    <body>\n      <div id=\"in-out\">\n        <div id=\"kbd-entry\">\n          <input type=\"text\" id=\"dataEntry\" placeholder=\"Enter text here\">\n        </div>\n        <div id=\"menu-bar\"></div>\n        <div id=\"toolbar\">\n          ").concat(this.getControlLineHTML(), "\n          <div class=\"toolbar-separator\"></div>\n          <button id=\"download-ram\" class=\"toolbar-button\">RAM</button>\n          <span id=\"ram-led\" style=\"color: #00FF00; margin-left: 3px; font-size: 20px; text-shadow: 0 0 2px #000;\">\u25CF</span>\n          <button id=\"download-flash\" class=\"toolbar-button\" style=\"margin-left: 10px;\">FLASH</button>\n          <span id=\"flash-led\" style=\"color: #808080; margin-left: 3px; font-size: 20px; text-shadow: 0 0 2px #000;\">\u25CF</span>\n          <button id=\"download-file\" class=\"toolbar-button\" style=\"margin-left: 15px;\">\uD83D\uDCE5 Download</button>\n          <div class=\"toolbar-separator\"></div>\n          <button id=\"record-btn\" class=\"toolbar-button\">\u23FA Record</button>\n          <button id=\"playback-btn\" class=\"toolbar-button\">\u25B6 Play</button>\n          <div class=\"toolbar-separator\"></div>\n          <span id=\"recording-status\" style=\"color: #666; font-size: 12px;\">Ready</span>\n          <div class=\"toolbar-separator\"></div>\n          <label for=\"font-selector\" style=\"margin-right: 5px; font-size: 12px;\">Font:</label>\n          <select id=\"font-selector\" class=\"toolbar-button\" style=\"padding: 2px 5px;\">\n            <option value=\"default\">Default</option>\n            <option value=\"parallax\">Parallax</option>\n            <option value=\"ibm3270\">IBM 3270</option>\n            <option value=\"ibm3270-green\">IBM 3270 Green</option>\n            <option value=\"ibm3270-amber\">IBM 3270 Amber</option>\n          </select>\n        </div>\n        <div id=\"log-content\">\n</div>\n      </div>\n      <div id=\"status-bar\">\n        <div class=\"status-left\">\n          <div id=\"connection-status\" class=\"status-field\">\n            <span class=\"status-label\">Connected</span>\n            <span id=\"conn-led\" style=\"color: #808080; margin-left: 5px; font-size: 18px; text-shadow: 0 0 2px #000;\">\u25CF</span>\n          </div>\n          <div id=\"active-cogs\" class=\"status-field\">\n            <span class=\"status-label\">Active COGs:</span>\n            <span class=\"status-value\" id=\"cogs-status\">None</span>\n          </div>\n          <div id=\"log-status\" class=\"status-field\">\n            <span class=\"status-label\">Logging</span>\n            <span id=\"log-led\" style=\"color: #FFBF00; margin-left: 5px; font-size: 18px; text-shadow: 0 0 2px #000;\">\u25CF</span>\n          </div>\n        </div>\n        <div class=\"status-right\">\n          <div id=\"echo-control\" class=\"status-field\">\n            <label style=\"display: flex; align-items: center;\" title=\"When checked, filters out echoed characters from receive display\">\n              <span class=\"status-label\">Echo</span>\n              <input type=\"checkbox\" id=\"echo-checkbox\" style=\"margin-left: 5px;\">\n            </label>\n          </div>\n          <div id=\"activity-indicators\" class=\"status-field\">\n            <span class=\"status-label\">TX</span>\n            <span id=\"tx-led\" style=\"color: #333; margin-left: 3px; margin-right: 10px; font-size: 18px; text-shadow: 0 0 2px #000;\">\u25CF</span>\n            <span class=\"status-label\">RX</span>\n            <span id=\"rx-led\" style=\"color: #333; margin-left: 3px; font-size: 18px; text-shadow: 0 0 2px #000;\">\u25CF</span>\n          </div>\n          <div id=\"propPlug\" class=\"status-field\">\n            <span class=\"status-label\">Port:</span>\n            <span class=\"status-value\"> </span>\n          </div>\n        </div>\n      </div>\n      <script>\n        // IPC Setup - runs directly in renderer with node integration\n        const { ipcRenderer } = require('electron');\n        \n        // Wait for DOM to be ready\n        document.addEventListener('DOMContentLoaded', () => {\n          // DTR button setup\n          const dtrToggle = document.getElementById('dtr-toggle');\n          const dtrCheckbox = document.getElementById('dtr-checkbox');\n          \n          console.log('[DTR SETUP] DTR Toggle found:', !!dtrToggle);\n          console.log('[DTR SETUP] DTR Checkbox found:', !!dtrCheckbox);\n          \n          if (dtrToggle) {\n            dtrToggle.addEventListener('click', () => {\n              console.log('[DTR] Button clicked');\n              ipcRenderer.send('toggle-dtr');\n            });\n          }\n          if (dtrCheckbox) {\n            dtrCheckbox.addEventListener('change', (e) => {\n              if (!e.isTrusted) return;\n              console.log('[DTR] Checkbox changed');\n              ipcRenderer.send('toggle-dtr');\n            });\n          }\n          \n          // RTS button setup  \n          const rtsToggle = document.getElementById('rts-toggle');\n          const rtsCheckbox = document.getElementById('rts-checkbox');\n          \n          if (rtsToggle) {\n            rtsToggle.addEventListener('click', () => {\n              console.log('[RTS] Button clicked');\n              ipcRenderer.send('toggle-rts');\n            });\n          }\n          if (rtsCheckbox) {\n            rtsCheckbox.addEventListener('change', (e) => {\n              if (!e.isTrusted) return;\n              console.log('[RTS] Checkbox changed');\n              ipcRenderer.send('toggle-rts');\n            });\n          }\n          \n          // RAM/FLASH buttons\n          const ramBtn = document.getElementById('download-ram');\n          if (ramBtn) {\n            ramBtn.addEventListener('click', () => {\n              ipcRenderer.send('download-ram');\n            });\n          }\n          const flashBtn = document.getElementById('download-flash');\n          if (flashBtn) {\n            flashBtn.addEventListener('click', () => {\n              ipcRenderer.send('download-flash');\n            });\n          }\n          \n          // Download file button\n          const downloadBtn = document.getElementById('download-file');\n          if (downloadBtn) {\n            downloadBtn.addEventListener('click', () => {\n              ipcRenderer.send('download-file');\n            });\n          }\n          \n          // Recording buttons\n          const recordBtn = document.getElementById('record-btn');\n          if (recordBtn) {\n            recordBtn.addEventListener('click', () => {\n              ipcRenderer.send('toggle-recording');\n            });\n          }\n          const playbackBtn = document.getElementById('playback-btn');\n          if (playbackBtn) {\n            playbackBtn.addEventListener('click', () => {\n              ipcRenderer.send('play-recording');\n            });\n          }\n          \n          // Listen for DTR state updates from main process\n          ipcRenderer.on('update-dtr-state', (event, state) => {\n            console.log('[IPC] Received DTR state update:', state);\n            const checkbox = document.getElementById('dtr-checkbox');\n            if (checkbox) {\n              // Temporarily remove listener to avoid loops\n              const oldListener = checkbox.onchange;\n              checkbox.onchange = null;\n              checkbox.checked = state;\n              checkbox.onchange = oldListener;\n              console.log('[DTR] Checkbox updated to:', state);\n            }\n          });\n          \n          // Listen for RTS state updates from main process\n          ipcRenderer.on('update-rts-state', (event, state) => {\n            console.log('[IPC] Received RTS state update:', state);\n            const checkbox = document.getElementById('rts-checkbox');\n            if (checkbox) {\n              // Temporarily remove listener to avoid loops\n              const oldListener = checkbox.onchange;\n              checkbox.onchange = null;\n              checkbox.checked = state;\n              checkbox.onchange = oldListener;\n              console.log('[RTS] Checkbox updated to:', state);\n            }\n          });\n          \n          // Echo checkbox\n          const echoCheckbox = document.getElementById('echo-checkbox');\n          if (echoCheckbox) {\n            echoCheckbox.addEventListener('change', (e) => {\n              ipcRenderer.send('toggle-echo', e.target.checked);\n            });\n          }\n          \n          // Font selector\n          const fontSelector = document.getElementById('font-selector');\n          const logContent = document.getElementById('log-content');\n          if (fontSelector && logContent) {\n            fontSelector.addEventListener('change', (e) => {\n              logContent.className = logContent.className.replace(/font-[w-]+/g, '').trim();\n              const selectedFont = e.target.value;\n              logContent.classList.add('font-' + selectedFont);\n              localStorage.setItem('terminal-font', selectedFont);\n            });\n            \n            // Load saved preference\n            const savedFont = localStorage.getItem('terminal-font') || 'default';\n            fontSelector.value = savedFont;\n            logContent.classList.add('font-' + savedFont);\n          }\n          \n          // Initialize menu bar for standalone mode\n          const isIdeModeJS = ").concat(this.context.runEnvironment.ideMode, ";\n          if (!isIdeModeJS) {\n            const menuBar = document.getElementById('menu-bar');\n            if (menuBar) {\n              console.log('[MENU] Initializing menu bar...');\n              menuBar.innerHTML = `\n                <div class=\"menu-container\">\n                  <div class=\"menu-item\" data-menu=\"file\">\n                    <span>File</span>\n                    <div class=\"menu-dropdown\">\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('menu-connect')\">Connect...</div>\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('menu-disconnect')\">Disconnect</div>\n                      <hr class=\"menu-separator\">\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('menu-quit')\">Exit</div>\n                    </div>\n                  </div>\n                  <div class=\"menu-item\" data-menu=\"edit\">\n                    <span>Edit</span>\n                    <div class=\"menu-dropdown\">\n                      <div class=\"menu-dropdown-item\" onclick=\"document.execCommand('copy')\">Copy</div>\n                      <div class=\"menu-dropdown-item\" onclick=\"document.execCommand('paste')\">Paste</div>\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('menu-clear')\">Clear Terminal</div>\n                    </div>\n                  </div>\n                  <div class=\"menu-item\" data-menu=\"device\">\n                    <span>Device</span>\n                    <div class=\"menu-dropdown\">\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('download-ram')\">Download to RAM</div>\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('download-flash')\">Download to FLASH</div>\n                      <hr class=\"menu-separator\">\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('toggle-dtr')\">Send DTR Reset</div>\n                    </div>\n                  </div>\n                  <div class=\"menu-item\" data-menu=\"view\">\n                    <span>View</span>\n                    <div class=\"menu-dropdown\">\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('menu-toggle-echo')\">Echo Off</div>\n                      <hr class=\"menu-separator\">\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('menu-zoom-in')\">Zoom In</div>\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('menu-zoom-out')\">Zoom Out</div>\n                      <div class=\"menu-dropdown-item\" onclick=\"ipcRenderer.send('menu-zoom-reset')\">Reset Zoom</div>\n                    </div>\n                  </div>\n                </div>\n              `;\n              \n              // Add menu click handlers\n              document.querySelectorAll('.menu-item').forEach(item => {\n                item.addEventListener('click', (e) => {\n                  e.stopPropagation();\n                  const dropdown = item.querySelector('.menu-dropdown');\n                  // Close all other dropdowns\n                  document.querySelectorAll('.menu-dropdown').forEach(d => {\n                    if (d !== dropdown) d.style.display = 'none';\n                  });\n                  // Toggle this dropdown\n                  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';\n                });\n              });\n              \n              // Close menu when clicking outside\n              document.addEventListener('click', () => {\n                document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');\n              });\n              \n              console.log('[MENU] Menu bar initialized');\n            }\n          }\n        });\n      </script>\n    </body>\n  </html>");
    };
    MainWindow.prototype.setupWindowHandlers = function () {
        // Inject JavaScript into the renderer process
        var _this = this;
        // Set up IPC handlers for toolbar events (both IDE and standard modes)
        this.mainWindow.webContents.on('ipc-message', function (event, channel) {
            var args = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                args[_i - 2] = arguments[_i];
            }
            switch (channel) {
                case 'set-terminal-mode':
                    var mode = args[0];
                    _this.terminalMode = mode;
                    _this.logMessage("Terminal mode set to ".concat(mode));
                    // Clear terminal when switching modes
                    _this.safeExecuteJS("\n            (function() {\n              const terminal = document.getElementById('log-content');\n              if (terminal) {\n                terminal.innerHTML = '';\n                terminal.dataset.cursorX = '0';\n                terminal.dataset.cursorY = '0';\n              }\n            })();\n          ", 'clear terminal on mode switch');
                    break;
                case 'set-cog-display-mode':
                    var cogMode = args[0];
                    var displayMode = cogMode === 'show_all' ? cogWindowManager_1.COGDisplayMode.SHOW_ALL : cogWindowManager_1.COGDisplayMode.ON_DEMAND;
                    _this.cogWindowManager.setMode(displayMode);
                    _this.logMessage("COG display mode set to ".concat(cogMode));
                    break;
                case 'set-control-line-mode':
                    var newControlLineMode = args[0];
                    _this.setControlLineMode(newControlLineMode);
                    break;
                case 'toggle-echo':
                    _this.echoOffEnabled = args[0];
                    _this.logMessage("Echo Off ".concat(_this.echoOffEnabled ? 'enabled' : 'disabled', " - filtering echoed characters"));
                    if (!_this.echoOffEnabled) {
                        // Clear buffer when turning off
                        _this.recentTransmitBuffer = [];
                    }
                    break;
                case 'toggle-dtr':
                    _this.toggleDTR();
                    break;
                case 'toggle-rts':
                    _this.toggleRTS();
                    break;
                case 'download-ram':
                    _this.setDownloadMode('ram');
                    break;
                case 'download-flash':
                    _this.setDownloadMode('flash');
                    break;
                case 'download-file':
                    _this.downloadFile();
                    break;
                case 'toggle-recording':
                    if (_this.windowRouter.getRoutingStats().recordingActive) {
                        _this.stopRecording();
                    }
                    else {
                        _this.startRecording();
                    }
                    break;
                case 'play-recording':
                    _this.playRecording();
                    break;
                case 'menu-settings':
                    _this.showSettingsDialog();
                    break;
                case 'menu-about':
                    _this.showAboutDialog();
                    break;
                case 'menu-check-updates':
                    _this.checkForUpdates();
                    break;
                case 'menu-clear':
                    _this.clearTerminal();
                    break;
                case 'menu-quit':
                    app.quit();
                    break;
                case 'menu-save-log':
                    _this.saveLogFile();
                    break;
                case 'menu-debug-reference':
                    _this.showDebugCommandReference();
                    break;
            }
        });
        // Set up toolbar button event handlers and load settings
        this.mainWindow.webContents.once('did-finish-load', function () {
            var isIdeMode = _this.context.runEnvironment.ideMode;
            // CRITICAL: Auto-create Debug Logger Window immediately on startup
            // This ensures logging starts immediately, not waiting for first message
            _this.createDebugLoggerWindow();
            // Load terminal mode setting after window is ready
            _this.loadTerminalMode();
            // Measure actual font metrics now that window is ready
            _this.measureAndStoreFontMetrics();
            // Initialize download mode LEDs after DOM is ready
            _this.updateDownloadMode(_this.downloadMode);
            // Initialize activity LEDs to OFF state
            _this.safeExecuteJS("\n        const txLed = document.getElementById('tx-led');\n        const rxLed = document.getElementById('rx-led');\n        if (txLed) {\n          txLed.style.color = '#333';\n          txLed.style.fontSize = '20px';\n          txLed.style.textShadow = '0 0 2px #000';\n        }\n        if (rxLed) {\n          rxLed.style.color = '#333';\n          rxLed.style.fontSize = '20px';\n          txLed.style.textShadow = '0 0 2px #000';\n        }\n      ", 'initialize-activity-leds');
            // Initialize serial connection after DOM is ready
            if (_this._deviceNode.length > 0 && !_this._serialPort) {
                _this.logMessage("* Opening serial port after DOM ready: ".concat(_this._deviceNode));
                _this.openSerialPort(_this._deviceNode);
            }
            // Setup logging configuration
            var logDisplayName = _this.context.runEnvironment.logFilename;
            if (logDisplayName.length == 0) {
                logDisplayName = '{none}';
                _this.loggingToFile = false;
            }
            else {
                _this.enableLogging(logDisplayName);
            }
            // Update status bar with device info
            if (_this._deviceNode.length > 0) {
                _this.updateStatusBarField('propPlug', _this._deviceNode);
            }
            _this.safeExecuteJS("\n        // Check if ipcRenderer is available in window context\n        const ipcRenderer = window.ipcRenderer || (window.require && window.require('electron').ipcRenderer);\n        if (!ipcRenderer) {\n          console.error('[IPC ERROR] ipcRenderer not available in renderer context');\n          return;\n        }\n        \n        // DTR button setup - direct pattern like RAM/FLASH\n        const dtrToggle = document.getElementById('dtr-toggle');\n        const dtrCheckbox = document.getElementById('dtr-checkbox');\n        \n        console.log('[DTR SETUP] DTR Toggle found:', !!dtrToggle);\n        console.log('[DTR SETUP] DTR Checkbox found:', !!dtrCheckbox);\n        \n        if (dtrToggle) {\n          dtrToggle.addEventListener('click', () => {\n            console.log('[DTR] Button clicked');\n            ipcRenderer.send('toggle-dtr');\n          });\n        }\n        if (dtrCheckbox) {\n          dtrCheckbox.addEventListener('change', (e) => {\n            if (!e.isTrusted) return; // Ignore programmatic changes\n            console.log('[DTR] Checkbox changed');\n            ipcRenderer.send('toggle-dtr');\n          });\n        }\n        \n        // RTS button setup - direct pattern like RAM/FLASH\n        const rtsToggle = document.getElementById('rts-toggle');\n        const rtsCheckbox = document.getElementById('rts-checkbox');\n        \n        console.log('[RTS SETUP] RTS Toggle found:', !!rtsToggle);\n        console.log('[RTS SETUP] RTS Checkbox found:', !!rtsCheckbox);\n        \n        if (rtsToggle) {\n          rtsToggle.addEventListener('click', () => {\n            console.log('[RTS] Button clicked');\n            ipcRenderer.send('toggle-rts');\n          });\n        }\n        if (rtsCheckbox) {\n          rtsCheckbox.addEventListener('change', (e) => {\n            if (!e.isTrusted) return; // Ignore programmatic changes\n            console.log('[RTS] Checkbox changed');\n            ipcRenderer.send('toggle-rts');\n          });\n        }\n        \n        // Download mode buttons (RAM/FLASH) - just set mode\n        const ramBtn = document.getElementById('download-ram');\n        if (ramBtn) {\n          ramBtn.addEventListener('click', () => {\n            ipcRenderer.send('download-ram');\n          });\n        }\n        const flashBtn = document.getElementById('download-flash');\n        if (flashBtn) {\n          flashBtn.addEventListener('click', () => {\n            ipcRenderer.send('download-flash');\n          });\n        }\n        \n        // Download file button - opens file dialog\n        const downloadBtn = document.getElementById('download-file');\n        if (downloadBtn) {\n          downloadBtn.addEventListener('click', () => {\n            ipcRenderer.send('download-file');\n          });\n        }\n        \n        // Font selector dropdown\n        const fontSelector = document.getElementById('font-selector');\n        const logContent = document.getElementById('log-content');\n        if (fontSelector && logContent) {\n          fontSelector.addEventListener('change', (e) => {\n            // Remove all font classes\n            logContent.className = logContent.className.replace(/font-[\\w-]+/g, '').trim();\n            // Add the selected font class\n            const selectedFont = e.target.value;\n            logContent.classList.add('font-' + selectedFont);\n            \n            // Store preference (could be saved to settings file later)\n            localStorage.setItem('terminal-font', selectedFont);\n          });\n          \n          // Load saved preference\n          const savedFont = localStorage.getItem('terminal-font') || 'default';\n          fontSelector.value = savedFont;\n          logContent.classList.add('font-' + savedFont);\n        }\n        \n        // Recording buttons\n        const recordBtn = document.getElementById('record-btn');\n        if (recordBtn) {\n          recordBtn.addEventListener('click', () => {\n            ipcRenderer.send('toggle-recording');\n          });\n        }\n        const playbackBtn = document.getElementById('playback-btn');\n        if (playbackBtn) {\n          playbackBtn.addEventListener('click', () => {\n            ipcRenderer.send('play-recording');\n          });\n        }\n        \n        // Echo checkbox - send IPC message to main process\n        const echoCheckbox = document.getElementById('echo-checkbox');\n        if (echoCheckbox) {\n          echoCheckbox.addEventListener('change', (e) => {\n            ipcRenderer.send('toggle-echo', e.target.checked);\n          });\n        }\n        \n        // Initialize HTML menu bar for standalone mode\n        const isStandalone = ".concat(!_this.context.runEnvironment.ideMode, ";\n        if (isStandalone) {\n          // Wait for DOM to be fully ready before initializing menu\n          if (document.readyState === 'loading') {\n            document.addEventListener('DOMContentLoaded', () => {\n              initializeMenuBar();\n            });\n          } else {\n            // DOM is already ready\n            initializeMenuBar();\n          }\n          \n          function initializeMenuBar() {\n            try {\n              // Since we can't require modules in renderer context, check if the menu-bar element exists\n              const menuContainer = document.getElementById('menu-bar');\n              if (!menuContainer) {\n                console.warn('[MENU BAR] menu-bar container not found');\n                return;\n              }\n              \n              // Simple HTML menu bar implementation\n              console.log('[MENU BAR] Initializing HTML menu bar...');\n          \n          // Define menu structure\n          const menus = [\n            {\n              label: 'File',\n              items: [\n                { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => ipcRenderer.send('menu-open') },\n                { label: 'Save Log...', accelerator: 'CmdOrCtrl+S', click: () => ipcRenderer.send('menu-save-log') },\n                { type: 'separator' },\n                { label: process.platform === 'darwin' ? 'Preferences...' : 'Settings...', \n                  accelerator: 'CmdOrCtrl+,', \n                  click: () => ipcRenderer.send('menu-settings') },\n                { type: 'separator' },\n                { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => ipcRenderer.send('menu-quit') }\n              ]\n            },\n            {\n              label: 'Edit',\n              items: [\n                { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },\n                { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },\n                { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },\n                { type: 'separator' },\n                { label: 'Clear Terminal', accelerator: 'CmdOrCtrl+L', click: () => ipcRenderer.send('menu-clear') }\n              ]\n            },\n            {\n              label: 'Device',\n              items: [\n                { label: 'Connect...', click: () => ipcRenderer.send('menu-connect') },\n                { label: 'Disconnect', click: () => ipcRenderer.send('menu-disconnect') },\n                { type: 'separator' },\n                { label: 'Download to RAM', accelerator: 'F10', click: () => ipcRenderer.send('download-ram') },\n                { label: 'Download to FLASH', accelerator: 'F11', click: () => ipcRenderer.send('download-flash') },\n                { type: 'separator' },\n                { label: 'Send DTR Reset', click: () => ipcRenderer.send('toggle-dtr') }\n              ]\n            },\n            {\n              label: 'View',\n              items: [\n                { label: 'Show Line Endings', type: 'checkbox', checked: false, \n                  click: () => ipcRenderer.send('menu-toggle-line-endings') },\n                { label: 'Echo Off', type: 'checkbox', checked: false,\n                  click: () => ipcRenderer.send('menu-toggle-echo') },\n                { type: 'separator' },\n                { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', \n                  click: () => ipcRenderer.send('menu-zoom-in') },\n                { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', \n                  click: () => ipcRenderer.send('menu-zoom-out') },\n                { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', \n                  click: () => ipcRenderer.send('menu-zoom-reset') }\n              ]\n            },\n            {\n              label: 'Debug',\n              items: [\n                { label: 'Start Recording', accelerator: 'CmdOrCtrl+R', \n                  click: () => ipcRenderer.send('toggle-recording') },\n                { label: 'Play Recording...', click: () => ipcRenderer.send('play-recording') },\n                { type: 'separator' },\n                { label: 'Open Debug Logger', click: () => ipcRenderer.send('menu-open-logger') },\n                { label: 'Split Cog Output', type: 'checkbox', checked: false,\n                  click: () => ipcRenderer.send('menu-toggle-cog-split') }\n              ]\n            },\n            {\n              label: 'Help',\n              items: [\n                { label: 'About PNut-Term-TS', click: () => ipcRenderer.send('menu-about') },\n                { label: 'Check for Updates...', click: () => ipcRenderer.send('menu-check-updates') },\n                { type: 'separator' },\n                { label: 'Debug Command Reference', click: () => ipcRenderer.send('menu-debug-reference') },\n                { label: 'Documentation', click: () => ipcRenderer.send('menu-docs') }\n              ]\n            }\n          ];\n          \n              // Create simple menu HTML\n              let menuHTML = '<div class=\"menu-container\">';\n              menus.forEach((menu, menuIndex) => {\n                menuHTML += '<div class=\"menu-item\" data-menu=\"' + menuIndex + '\">';\n                menuHTML += '<span class=\"menu-label\">' + menu.label + '</span>';\n                menuHTML += '<div class=\"menu-dropdown\" id=\"dropdown-' + menuIndex + '\">';\n                \n                menu.items.forEach((item, itemIndex) => {\n                  if (item.type === 'separator') {\n                    menuHTML += '<hr class=\"menu-separator\">';\n                  } else {\n                    const itemId = 'menu-' + menuIndex + '-' + itemIndex;\n                    menuHTML += '<div class=\"menu-dropdown-item\" data-action=\"' + itemId + '\">';\n                    menuHTML += item.label;\n                    if (item.accelerator) {\n                      menuHTML += '<span class=\"accelerator\">' + item.accelerator + '</span>';\n                    }\n                    menuHTML += '</div>';\n                  }\n                });\n                \n                menuHTML += '</div></div>';\n              });\n              menuHTML += '</div>';\n              \n              // Add CSS\n              menuHTML += '<style>';\n              menuHTML += '.menu-container { display: flex; background: #2d2d30; border-bottom: 1px solid #464647; font-size: 13px; user-select: none; }';\n              menuHTML += '.menu-item { position: relative; padding: 8px 12px; color: #cccccc; cursor: pointer; }';\n              menuHTML += '.menu-item:hover { background: #094771; }';\n              menuHTML += '.menu-dropdown { display: none; position: absolute; top: 100%; left: 0; background: #383838; border: 1px solid #464647; min-width: 200px; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }';\n              menuHTML += '.menu-dropdown-item { padding: 8px 16px; color: #cccccc; cursor: pointer; display: flex; justify-content: space-between; }';\n              menuHTML += '.menu-dropdown-item:hover { background: #094771; }';\n              menuHTML += '.accelerator { color: #999999; font-size: 11px; }';\n              menuHTML += '.menu-separator { border: none; border-top: 1px solid #464647; margin: 4px 0; }';\n              menuHTML += '</style>';\n              \n              menuContainer.innerHTML = menuHTML;\n              \n              // Add event handlers\n              document.querySelectorAll('.menu-item').forEach((menuItem, menuIndex) => {\n                const dropdown = document.getElementById('dropdown-' + menuIndex);\n                \n                menuItem.addEventListener('click', (e) => {\n                  e.stopPropagation();\n                  // Close all other dropdowns\n                  document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');\n                  // Toggle this dropdown\n                  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';\n                });\n              });\n              \n              // Close dropdowns when clicking outside\n              document.addEventListener('click', () => {\n                document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');\n              });\n              \n              // Handle menu item clicks\n              document.querySelectorAll('.menu-dropdown-item').forEach(item => {\n                item.addEventListener('click', (e) => {\n                  const action = e.currentTarget.getAttribute('data-action');\n                  console.log('[MENU BAR] Menu action:', action);\n                  // Here we would handle the menu actions\n                  // For now just close the dropdown\n                  document.querySelectorAll('.menu-dropdown').forEach(d => d.style.display = 'none');\n                });\n              });\n              \n              console.log('[MENU BAR] HTML menu bar initialized successfully');\n            } catch (error) {\n              console.error('[MENU BAR] Failed to initialize HTML menu bar:', error);\n              // Fallback: Log the error but don't crash\n            }\n          }\n        }\n      "), 'toolbar-event-handlers');
            // Setup text input control for data entry
            _this.hookTextInputControl('dataEntry', function (event) {
                var inputElement = event.target;
                console.log("Input value: [".concat(inputElement.value, "]"));
                if (event instanceof KeyboardEvent && event.key === 'Enter') {
                    _this.sendSerialData(inputElement.value);
                    inputElement.value = '';
                }
            });
            // Check serial port status after window loads - delayed to let async operations complete
            setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                var UsbSerial_1, availableDevices, deviceInfo, devicePath, error_3;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(this._serialPort === undefined)) return [3 /*break*/, 8];
                            if (!(this._deviceNode.length > 0)) return [3 /*break*/, 1];
                            // Device was specified but connection failed
                            this.appendLog("\u26A0\uFE0F Waiting for serial port: ".concat(this._deviceNode));
                            this.appendLog("   Try: File > Select PropPlug to choose a different device");
                            return [3 /*break*/, 8];
                        case 1:
                            _a.trys.push([1, 7, , 8]);
                            UsbSerial_1 = require('../utils/usb.serial').UsbSerial;
                            return [4 /*yield*/, UsbSerial_1.serialDeviceList()];
                        case 2:
                            availableDevices = _a.sent();
                            if (!(availableDevices.length === 0)) return [3 /*break*/, 3];
                            this.appendLog("\u26A0\uFE0F No PropPlug devices found");
                            this.appendLog("   \u2022 Connect your PropPlug device via USB");
                            this.appendLog("   \u2022 Use File > Select PropPlug after connecting a device");
                            this.updateConnectionStatus(false);
                            this.updateStatusBarField('propPlug', 'No devices found');
                            return [3 /*break*/, 6];
                        case 3:
                            if (!(availableDevices.length === 1)) return [3 /*break*/, 5];
                            deviceInfo = availableDevices[0].split(',');
                            devicePath = deviceInfo[0];
                            this.appendLog("\u2139\uFE0F Found PropPlug device: ".concat(devicePath));
                            this.appendLog("   Auto-connecting...");
                            this._deviceNode = devicePath;
                            this.updateStatusBarField('propPlug', "".concat(devicePath, " (connecting...)"));
                            return [4 /*yield*/, this.openSerialPort(devicePath)];
                        case 4:
                            _a.sent();
                            return [3 /*break*/, 6];
                        case 5:
                            // Multiple devices found
                            this.appendLog("\u26A0\uFE0F Multiple PropPlug devices found (".concat(availableDevices.length, " devices)"));
                            this.appendLog("   Available devices:");
                            availableDevices.forEach(function (device, index) {
                                var devicePath = device.split(',')[0];
                                _this.appendLog("   ".concat(index + 1, ". ").concat(devicePath));
                            });
                            this.appendLog("   Use: File > Select PropPlug to choose a device");
                            this.appendLog("   Or restart with: -p <device_path>");
                            this.updateConnectionStatus(false);
                            this.updateStatusBarField('propPlug', "".concat(availableDevices.length, " devices found"));
                            _a.label = 6;
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            error_3 = _a.sent();
                            this.appendLog("\u26A0\uFE0F Error scanning for devices: ".concat(error_3));
                            this.updateConnectionStatus(false);
                            this.updateStatusBarField('propPlug', 'Error scanning');
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/];
                    }
                });
            }); }, 500);
        });
    };
    MainWindow.prototype.createApplicationMenu = function () {
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
    };
    MainWindow.prototype.createMacSystemMenu = function () {
        var _this = this;
        var menuTemplate = [
            {
                label: 'PNut-Term-TS',
                submenu: [
                    {
                        label: 'About PNut-Term-TS',
                        click: function () { return _this.showAboutDialog(); }
                    },
                    {
                        label: 'Check for Updates...',
                        click: function () { return _this.checkForUpdates(); }
                    },
                    { type: 'separator' },
                    {
                        label: 'Preferences...',
                        accelerator: 'Cmd+,',
                        click: function () { return _this.showSettingsDialog(); }
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
                        click: function () { return app.quit(); }
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
        var menu = Menu.buildFromTemplate(menuTemplate);
        Menu.setApplicationMenu(menu);
        console.log('[MENU SETUP] ✅ macOS system menu set');
    };
    MainWindow.prototype.createOldApplicationMenu = function () {
        var _this = this;
        // Keeping old menu code for reference - will be replaced by HTML menu bar
        var menuTemplate = [
            {
                label: 'PNut Term TS',
                submenu: [
                    {
                        label: '&About...',
                        click: function () {
                            // show about dialog with runtime versions
                            var nodeVersion = process.versions.node;
                            var chromiumVersion = process.versions.chrome;
                            var electronVersion = process.versions.electron;
                            var args = process.argv.slice(2);
                            var argsDisplay = args.length > 0 ? args.join(' ') : '(none)';
                            var isIdeMode = _this.context.runEnvironment.ideMode;
                            var modeDisplay = isIdeMode ? 'IDE Mode (no menus)' : 'Standalone Mode';
                            dialog.showMessageBox(_this.mainWindow, {
                                type: 'info',
                                title: 'About PNut Term TS',
                                message: 'PNut Term TS\nVersion 1.0.0\n\nby Iron Sheep Productions, LLC',
                                detail: "Runtime Versions:\n" +
                                    "Node.js: ".concat(nodeVersion, "\n") +
                                    "Chromium: ".concat(chromiumVersion, "\n") +
                                    "Electron: ".concat(electronVersion, "\n\n") +
                                    "Mode: ".concat(modeDisplay, "\n") +
                                    "Invocation: ".concat(argsDisplay),
                                buttons: ['OK']
                            });
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '&Quit',
                        accelerator: 'CmdOrCtrl+Q',
                        click: function () {
                            console.log('MENU: Application is quitting...');
                            _this.knownClosedBy = true;
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
                        click: function () {
                            dialog
                                .showSaveDialog(_this.mainWindow, {
                                title: 'Save Log',
                                defaultPath: "./Logs/".concat(_this.logFilenameBase),
                                filters: [{ name: 'Text Files', extensions: ['txt'] }]
                            })
                                .then(function (result) {
                                if (!result.canceled && result.filePath) {
                                    var logFilename = _this.enableLogging(result.filePath);
                                    // Log name field removed from status bar per user request
                                    _this.safeExecuteJS('document.getElementById("log-content").innerText', 'get-log-content')
                                        .then(function (fileContent) {
                                        if (fileContent !== undefined) {
                                            fs.writeFileSync(_this.logFileSpec, fileContent);
                                        }
                                    });
                                }
                            })
                                .catch(function (error) {
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
                        click: function () { return _this.downloadToRAM(); }
                    },
                    {
                        label: 'Download to Flash',
                        accelerator: 'CmdOrCtrl+F',
                        click: function () { return _this.downloadToFlash(); }
                    },
                    { type: 'separator' },
                    {
                        label: 'Toggle DTR',
                        accelerator: 'CmdOrCtrl+D',
                        click: function () { return _this.toggleDTR(); }
                    },
                    {
                        label: 'Toggle RTS',
                        accelerator: 'CmdOrCtrl+R',
                        click: function () { return _this.toggleRTS(); }
                    },
                    { type: 'separator' },
                    {
                        label: 'Start Recording',
                        accelerator: 'CmdOrCtrl+Shift+R',
                        click: function () { return _this.startRecording(); }
                    },
                    {
                        label: 'Stop Recording',
                        click: function () { return _this.stopRecording(); }
                    },
                    {
                        label: 'Play Recording...',
                        accelerator: 'CmdOrCtrl+Shift+P',
                        click: function () { return _this.playRecording(); }
                    }
                ]
            },
            {
                label: 'Tools',
                submenu: [
                    {
                        label: 'Select Serial Port...',
                        click: function () {
                            var names = _this.context.runEnvironment.serialPortDevices; // List of names
                            dialog
                                .showMessageBox(_this.mainWindow, {
                                type: 'question',
                                buttons: names,
                                title: 'Select Prop Plug',
                                message: 'Choose a lProp Plug:'
                            })
                                .then(function (response) {
                                var propPlug = names[response.response];
                                _this.context.runEnvironment.selectedPropPlug = propPlug;
                                // Update the status bar with the selected name
                                _this.updateStatusBarField('propPlug', propPlug);
                            })
                                .catch(function (error) {
                                console.error('Failed to show plug select dialog:', error);
                            });
                        }
                    },
                    {
                        label: 'Baud Rate...',
                        click: function () { return _this.selectBaudRate(); }
                    },
                    { type: 'separator' },
                    {
                        label: 'Settings...',
                        accelerator: 'CmdOrCtrl+,',
                        click: function () { return _this.showSettingsDialog(); }
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
                        click: function () {
                            electron.shell.openExternal('https://github.com/parallaxinc/PNut-Term-TS');
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Debug Command Reference',
                        click: function () { return _this.showDebugCommandReference(); }
                    }
                ]
            }
        ];
        // Old menu code - kept for reference when implementing HTML menu bar
    };
    MainWindow.prototype.clearTerminal = function () {
        this.safeExecuteJS("\n      (function() {\n        const terminal = document.getElementById('log-content');\n        if (terminal) {\n          terminal.innerHTML = '';\n          terminal.dataset.cursorX = '0';\n          terminal.dataset.cursorY = '0';\n        }\n      })();\n    ", 'clear terminal');
    };
    MainWindow.prototype.saveLogFile = function () {
        var _a = require('electron'), dialog = _a.dialog, fs = _a.fs;
        // TODO: Implement save log file dialog
        console.log('Save log file - to be implemented');
    };
    MainWindow.prototype.showAboutDialog = function () {
        var dialog = require('electron').dialog;
        var packageJson = require('../../package.json');
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'About PNut-Term-TS',
            message: 'PNut-Term-TS',
            detail: "Version: ".concat(packageJson.version, "\n") +
                "Electron: ".concat(process.versions.electron, "\n") +
                "Node: ".concat(process.versions.node, "\n") +
                "Chrome: ".concat(process.versions.chrome, "\n\n") +
                "Cross-platform debug terminal for Parallax Propeller 2\n" +
                "\u00A9 2024 Parallax Inc.",
            buttons: ['OK'],
            icon: null // Will use app icon
        });
    };
    MainWindow.prototype.checkForUpdates = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, dialog, shell, https, packageJson, currentVersion, data, latestRelease, latestVersion, result, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = require('electron'), dialog = _a.dialog, shell = _a.shell;
                        https = require('https');
                        packageJson = require('../../package.json');
                        currentVersion = packageJson.version;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                https.get('https://api.github.com/repos/parallaxinc/PNut-Term-TS/releases/latest', {
                                    headers: {
                                        'User-Agent': 'PNut-Term-TS'
                                    }
                                }, function (res) {
                                    var data = '';
                                    res.on('data', function (chunk) { return data += chunk; });
                                    res.on('end', function () { return resolve(data); });
                                }).on('error', reject);
                            })];
                    case 2:
                        data = _b.sent();
                        latestRelease = JSON.parse(data);
                        latestVersion = latestRelease.tag_name.replace(/^v/, '');
                        if (!(latestVersion > currentVersion)) return [3 /*break*/, 4];
                        return [4 /*yield*/, dialog.showMessageBox(this.mainWindow, {
                                type: 'info',
                                title: 'Update Available',
                                message: "A new version of PNut-Term-TS is available",
                                detail: "Current version: ".concat(currentVersion, "\nLatest version: ").concat(latestVersion, "\n\nWould you like to download it?"),
                                buttons: ['Download', 'Later'],
                                defaultId: 0
                            })];
                    case 3:
                        result = _b.sent();
                        if (result.response === 0) {
                            shell.openExternal(latestRelease.html_url);
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        dialog.showMessageBox(this.mainWindow, {
                            type: 'info',
                            title: 'No Updates',
                            message: 'You have the latest version',
                            detail: "PNut-Term-TS v".concat(currentVersion, " is up to date"),
                            buttons: ['OK']
                        });
                        _b.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_4 = _b.sent();
                        dialog.showMessageBox(this.mainWindow, {
                            type: 'error',
                            title: 'Update Check Failed',
                            message: 'Could not check for updates',
                            detail: 'Please check your internet connection and try again later',
                            buttons: ['OK']
                        });
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.setupApplicationMenu = function () {
        var _this = this;
        // This method is called from createAppWindow() and sets up the menu
        try {
            this.createApplicationMenu();
        }
        catch (error) {
            console.error('[MENU SETUP] ERROR in setupApplicationMenu:', error);
            // Don't crash the app if menu setup fails
        }
        this.updateStatus(); // set initial values
        // REMOVED: Duplicate did-finish-load handler eliminated to fix race condition
        // All DOM initialization now consolidated in single handler above (line ~2248)
        this.mainWindow.on('close', function (event) {
            if (!_this.knownClosedBy) {
                _this.logMessage('[x]: Application is quitting...[close]');
            }
            // Only delay in console mode
            if (_this.context.runEnvironment.consoleMode) {
                // Prevent immediate close to allow reading console messages
                event.preventDefault();
                // Close all debug windows first
                _this.closeAllDebugWindows();
                // Show closing message and wait 2 seconds before actually closing
                console.log('============================================');
                console.log('Closing application - waiting for logs to flush...');
                console.log('============================================');
                setTimeout(function () {
                    console.log('✅ COMPLETE - Application closed');
                    if (_this.mainWindow && !_this.mainWindow.isDestroyed()) {
                        _this.mainWindow.destroy();
                    }
                }, 6000); // 6 second delay (3x original)
            }
            else {
                // Normal close without delay
                _this.closeAllDebugWindows();
            }
        });
        this.mainWindow.on('closed', function () {
            _this.logMessage('* Main window [closed]');
            _this.mainWindow = null;
            _this.mainWindowOpen = false;
            // Force quit on macOS when main window is closed
            if (process.platform === 'darwin') {
                app.quit();
            }
        });
    };
    // Method to close all debug windows
    MainWindow.prototype.closeAllDebugWindows = function () {
        var _this = this;
        var _a;
        // step usb receiver
        (_a = this.mainWindow) === null || _a === void 0 ? void 0 : _a.removeAllListeners();
        // flush one last time in case there are any left
        this.flushLogBuffer(); // will do nothing if buffer is empty
        // shut down any active displays
        var displayEntries = Object.entries(this.displays);
        displayEntries.forEach(function (_a) {
            var windowName = _a[0], windowObject = _a[1];
            _this.logMessage("* closeAllDebugWindows() - Closing window: ".concat(windowName));
            var window = windowObject;
            window.closeDebugWindow();
        });
        this.displays = {}; // and empty the list
    };
    MainWindow.prototype.setKnownClosedBy = function () {
        this.knownClosedBy = true;
    };
    MainWindow.prototype.enableLogging = function (logFilename) {
        var filename = '';
        if (logFilename.length == 0) {
            this.loggingToFile = false;
        }
        else {
            this.loggingToFile = true;
            filename = path_1.default.basename(logFilename);
            var logFolder = path_1.default.join(this.context.currentFolder, 'Logs');
            (0, files_1.ensureDirExists)(logFolder);
            this.logFileSpec = path_1.default.join(logFolder, filename);
        }
        // Update log LED (green filled when logging, gray empty when not)
        var logSymbol = this.loggingToFile ? '●' : '○';
        var logColor = this.loggingToFile ? '#00FF00' : '#808080';
        this.safeExecuteJS("\n      const logLed = document.getElementById('log-led');\n      if (logLed) {\n        logLed.textContent = '".concat(logSymbol, "';\n        logLed.style.color = '").concat(logColor, "';\n      }\n    "), 'updateActiveUIElements-logLed');
        return filename;
    };
    MainWindow.prototype.getRuntimeVersions = function () {
        // Get invocation parameters
        var args = process.argv.slice(2); // Skip 'node' and script path
        var argsDisplay = args.length > 0 ? args.join(' ') : 'None';
        var isIdeMode = this.context.runEnvironment.ideMode;
        var modeDisplay = isIdeMode ? 'IDE Mode (no menus)' : 'Standalone Mode';
        this.safeExecuteJS("\n      const replaceText = (selector, text) => {\n        const element = document.getElementById(selector);\n        if (element) element.innerText = text;\n      }\n\n      // Update runtime versions\n      for (const type of ['chrome', 'node', 'electron']) {\n        replaceText(`${type}-version`, process.versions[type]);\n      }\n      \n      // Update invocation parameters and mode\n      replaceText('invocation-params', '".concat(argsDisplay.replace(/'/g, "\\'"), "');\n      replaceText('app-mode', '").concat(modeDisplay, "');\n    "), 'update runtime versions and params');
    };
    MainWindow.prototype.updateStatusBarField = function (fieldId, value) {
        if (this.mainWindow) {
            this.safeExecuteJS("document.getElementById(\"".concat(fieldId, "\").querySelector('.status-value').innerText = \"").concat(value, "\";"), "updateStatusBarField-".concat(fieldId));
        }
    };
    MainWindow.prototype.updateStatus = function () {
        // Status update no longer needed - line count removed from status bar
        // Keeping method stub in case other status updates needed in future
    };
    MainWindow.prototype.getFontMetrics = function (fontSpec_1) {
        return __awaiter(this, arguments, void 0, function (fontSpec, defaultCharWidth, defaultCharHeight) {
            var charWidth, charHeight, metrics;
            if (defaultCharWidth === void 0) { defaultCharWidth = 12; }
            if (defaultCharHeight === void 0) { defaultCharHeight = 12; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        charWidth = defaultCharWidth;
                        charHeight = defaultCharHeight;
                        if (!this.mainWindow) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.safeExecuteJS("\n        (function() {\n          const canvas = document.createElement('canvas');\n          const context = canvas.getContext('2d');\n          context.font = '".concat(fontSpec, "'; // Set the font to match the one used in the app\n\n          // Measure the width and height of a single character\n          const metrics = context.measureText('M');\n          const charWidth = metrics.width;\n          const actualBoundingBoxAscent = metrics.actualBoundingBoxAscent || 0;\n          const actualBoundingBoxDescent = metrics.actualBoundingBoxDescent || 0;\n          const charHeight = actualBoundingBoxAscent + actualBoundingBoxDescent;\n\n          return { charWidth, charHeight };\n        })();\n      "), 'getFontMetrics')];
                    case 1:
                        metrics = _a.sent();
                        if (metrics) {
                            // Override defaults with measured values
                            charWidth = metrics.charWidth;
                            charHeight = metrics.charHeight;
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        console.error('ERROR: getFontMetrics() NO Main Window!');
                        _a.label = 3;
                    case 3:
                        console.error("* getFontMetrics() -> (".concat(charWidth, "x").concat(charHeight, ")"));
                        return [2 /*return*/, { charWidth: charWidth, charHeight: charHeight }]; // Default values
                }
            });
        });
    };
    MainWindow.prototype.measureAndStoreFontMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, charWidth, charHeight, error_5;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getFontMetrics('12pt Consolas, sans-serif', 12, 18)];
                    case 1:
                        _a = _b.sent(), charWidth = _a.charWidth, charHeight = _a.charHeight;
                        console.log("[FONT METRICS] Measured after window ready: ".concat(charWidth, " x ").concat(charHeight));
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _b.sent();
                        console.error('[FONT METRICS] Error measuring fonts after window load:', error_5);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.hookTextInputControl = function (inputId, callback) {
        if (this.mainWindow) {
            // Convert the callback function to a string
            var callbackString = callback.toString();
            // Inject JavaScript into the renderer process to attach the callback
            this.safeExecuteJS("\n        (function() {\n          const inputElement = document.getElementById('".concat(inputId, "');\n          if (inputElement) {\n            inputElement.addEventListener('input', ").concat(callbackString, ");\n          } else {\n            console.error('Input element with id \"").concat(inputId, "\" not found.');\n          }\n        })();\n      "), "hookInputControl-".concat(inputId));
        }
    };
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
    MainWindow.prototype.appendLogOld = function (message) {
        this.safeExecuteJS("\n      (function() {\n        const logContent = document.getElementById('log-content');\n        const p = document.createElement('p');\n        p.textContent = \"".concat(message, "\";\n        logContent.appendChild(p);\n        logContent.scrollTop = logContent.scrollHeight;\n      })();\n    "), 'append log message');
        // and if logging, append to output file
        if (this.loggingToFile) {
            this.appendToFile(this.logFileSpec, "".concat(message, "\n"));
        }
    };
    MainWindow.prototype.appendLog = function (message) {
        if (this.mainWindow) {
            this.logBuffer.push(message);
            if (this.logBuffer.length > this.PEND_MESSAGE_COUNT || this.immediateLog) {
                this.flushLogBuffer();
            }
        }
        // and if logging, append to output file
        if (this.loggingToFile) {
            this.appendToFile(this.logFileSpec, "".concat(message, "\n"));
        }
    };
    MainWindow.prototype.flushLogBuffer = function () {
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
            var hasControlChars = this.logBuffer.some(function (currString) { return /[\x01-\x10]/.test(currString); });
            if (hasControlChars) {
                // since we have control characters, let's handle each string individually
                for (var index = 0; index < this.logBuffer.length; index++) {
                    var currLine = this.logBuffer[index];
                    // handle control characters found in any of the strings BUT
                    // we need to handle each in the order we find and emit non-control characters as we go
                    // Control chars 0x02, 0x0e and 0x0f require x,y or x or y which are the next byte(s) in the string
                    // let's also gather the non-control in strings before we emit them.
                    var nonControlChars = '';
                    var i = 0;
                    while (i < currLine.length) {
                        var charCode = currLine.charCodeAt(i);
                        var x = 0;
                        var y = 0;
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
                        }
                        else {
                            // Non-control character
                            nonControlChars = "".concat(nonControlChars).concat(currLine[i]);
                        }
                        i++;
                    }
                }
            }
            else {
                // If no control characters are found, just append the logBuffer directly
                this.emitStrings(this.logBuffer);
            }
            this.logBuffer = [];
            this.updateStatus();
        }
    };
    MainWindow.prototype.emitStrings = function (buffer) {
        if (buffer.length > 0) {
            var messages = JSON.stringify(buffer);
            this.safeExecuteJS("\n        (function() {\n          const logContent = document.getElementById('log-content');\n          const messagesArray = ".concat(messages, ";  // Parse the JSON string to get the array\n          messagesArray.forEach(message => {\n            const p = document.createElement('p');\n            p.textContent = message;\n            logContent.appendChild(p);\n          });\n          logContent.scrollTop = logContent.scrollHeight;\n        })();\n      "), 'emit strings to log');
        }
    };
    // Method to append a message to an existing file
    MainWindow.prototype.appendToFile = function (filePath, message) {
        fs.appendFile(filePath, message, function (err) {
            if (err) {
                console.error('Failed to append to file:', err);
            }
        });
    };
    // ----------------------------------------------------------------------
    MainWindow.prototype.logMessage = function (message) {
        if (this.context.runEnvironment.loggingEnabled) {
            //Write to output window.
            this.context.logger.logMessage('Tmnl: ' + message);
        }
    };
    MainWindow.prototype.loadTerminalMode = function () {
        var _this = this;
        // This will be loaded from localStorage initially,
        // then from project .json file in a future sprint
        this.safeExecuteJS("\n      (function() {\n        try {\n          // Check if localStorage is available\n          if (typeof localStorage === 'undefined') {\n            console.warn('[TERMINAL MODE] localStorage not available, using defaults');\n            return { mode: 'PST', controlLine: 'DTR' };\n          }\n          \n          const mode = localStorage.getItem('terminal-mode') || 'PST';\n          const controlLine = localStorage.getItem('control-line-mode') || 'DTR';\n          console.log('[TERMINAL MODE] Successfully loaded from localStorage:', { mode, controlLine });\n          return { mode, controlLine };\n        } catch (error) {\n          console.error('[TERMINAL MODE] Error accessing localStorage:', error);\n          console.log('[TERMINAL MODE] Using default values: PST, DTR');\n          return { mode: 'PST', controlLine: 'DTR' };\n        }\n      })();\n    ", 'load terminal mode').then(function (result) {
            if (result && typeof result === 'object') {
                _this.terminalMode = result.mode;
                _this.controlLineMode = result.controlLine;
                _this.logMessage("Terminal mode loaded: ".concat(_this.terminalMode));
                _this.logMessage("Control line mode: ".concat(_this.controlLineMode));
                // Update UI to show correct control line
                if (_this.controlLineMode !== 'DTR') {
                    _this.updateControlLineUI();
                }
            }
            else {
                // Fallback if script execution failed completely
                console.warn('[TERMINAL MODE] Script execution failed, using fallback defaults');
                _this.terminalMode = 'PST';
                _this.controlLineMode = 'DTR';
                _this.logMessage("Terminal mode set to fallback defaults: ".concat(_this.terminalMode, ", ").concat(_this.controlLineMode));
            }
        }).catch(function (error) {
            console.error('[TERMINAL MODE] safeExecuteJS failed:', error);
            // Ultimate fallback
            _this.terminalMode = 'PST';
            _this.controlLineMode = 'DTR';
            _this.logMessage("Terminal mode set to ultimate fallback: ".concat(_this.terminalMode, ", ").concat(_this.controlLineMode));
        });
    };
    // Execute PST control commands
    MainWindow.prototype.executePSTCommand = function (command, arg1, arg2) {
        if (this.terminalMode !== 'PST') {
            return; // Only execute PST commands in PST mode
        }
        switch (command) {
            case 'home':
                this.cursorX = 0;
                this.cursorY = 0;
                this.safeExecuteJS("\n          (function() {\n            const terminal = document.getElementById('log-content');\n            if (terminal) {\n              terminal.dataset.cursorX = '0';\n              terminal.dataset.cursorY = '0';\n              // Move cursor to home position\n              const cursor = document.getElementById('terminal-cursor');\n              if (cursor) {\n                cursor.style.left = '0px';\n                cursor.style.top = '0px';\n              }\n            }\n          })();\n        ", 'PST home command');
                break;
            case 'position':
                if (arg1 !== undefined && arg2 !== undefined) {
                    this.cursorX = Math.min(arg1, this.terminalWidth - 1);
                    this.cursorY = Math.min(arg2, this.terminalHeight - 1);
                    this.safeExecuteJS("\n            (function() {\n              const terminal = document.getElementById('log-content');\n              if (terminal) {\n                terminal.dataset.cursorX = '".concat(this.cursorX, "';\n                terminal.dataset.cursorY = '").concat(this.cursorY, "';\n                // Position cursor at x,y\n                const cursor = document.getElementById('terminal-cursor');\n                if (cursor) {\n                  const charWidth = 9; // Approximate character width\n                  const lineHeight = 20; // Approximate line height\n                  cursor.style.left = (").concat(this.cursorX, " * charWidth) + 'px';\n                  cursor.style.top = (").concat(this.cursorY, " * lineHeight) + 'px';\n                }\n              }\n            })();\n          "), 'PST position command');
                }
                break;
            case 'clearScreen':
                this.safeExecuteJS("\n          (function() {\n            const terminal = document.getElementById('log-content');\n            if (terminal) {\n              terminal.innerHTML = '';\n              terminal.dataset.cursorX = '0';\n              terminal.dataset.cursorY = '0';\n            }\n          })();\n        ", 'PST clear screen');
                this.cursorX = 0;
                this.cursorY = 0;
                break;
            case 'clearEOL':
                this.safeExecuteJS("\n          (function() {\n            const terminal = document.getElementById('log-content');\n            if (terminal) {\n              const lines = terminal.querySelectorAll('p');\n              const cursorY = parseInt(terminal.dataset.cursorY || '0');\n              const cursorX = parseInt(terminal.dataset.cursorX || '0');\n              if (lines[cursorY]) {\n                const text = lines[cursorY].textContent || '';\n                lines[cursorY].textContent = text.substring(0, cursorX);\n              }\n            }\n          })();\n        ", 'PST clear to EOL');
                break;
            case 'clearBelow':
                this.safeExecuteJS("\n          (function() {\n            const terminal = document.getElementById('log-content');\n            if (terminal) {\n              const lines = terminal.querySelectorAll('p');\n              const cursorY = parseInt(terminal.dataset.cursorY || '0');\n              for (let i = cursorY + 1; i < lines.length; i++) {\n                lines[i].remove();\n              }\n            }\n          })();\n        ", 'PST clear below');
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
                    this.safeExecuteJS("\n            (function() {\n              const terminal = document.getElementById('log-content');\n              if (terminal) {\n                const lines = terminal.querySelectorAll('p');\n                const cursorY = parseInt(terminal.dataset.cursorY || '0');\n                const cursorX = ".concat(this.cursorX, ";\n                if (lines[cursorY]) {\n                  const text = lines[cursorY].textContent || '';\n                  lines[cursorY].textContent = text.substring(0, cursorX) + text.substring(cursorX + 1);\n                }\n                terminal.dataset.cursorX = '").concat(this.cursorX, "';\n              }\n            })();\n          "), 'PST backspace');
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
                    this.safeExecuteJS("\n            (function() {\n              const terminal = document.getElementById('log-content');\n              if (terminal) {\n                const lines = terminal.querySelectorAll('p');\n                if (lines.length > 0) {\n                  lines[0].remove();\n                }\n                const newLine = document.createElement('p');\n                terminal.appendChild(newLine);\n              }\n            })();\n          ", 'PST linefeed scroll');
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
                this.safeExecuteJS("\n          (function() {\n            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURE');\n            audio.play();\n          })();\n        ", 'PST bell');
                break;
        }
    };
    // Update cursor position in the terminal
    MainWindow.prototype.updateCursorPosition = function () {
        this.safeExecuteJS("\n      (function() {\n        const terminal = document.getElementById('log-content');\n        if (terminal) {\n          terminal.dataset.cursorX = '".concat(this.cursorX, "';\n          terminal.dataset.cursorY = '").concat(this.cursorY, "';\n          const cursor = document.getElementById('terminal-cursor');\n          if (cursor) {\n            const charWidth = 9; // Approximate character width\n            const lineHeight = 20; // Approximate line height\n            cursor.style.left = (").concat(this.cursorX, " * charWidth) + 'px';\n            cursor.style.top = (").concat(this.cursorY, " * lineHeight) + 'px';\n          }\n        }\n      })();\n    "), 'update cursor position');
    };
    // Helper to safely execute JavaScript in renderer
    MainWindow.prototype.safeExecuteJS = function (script_1) {
        return __awaiter(this, arguments, void 0, function (script, errorContext) {
            var error_6;
            if (errorContext === void 0) { errorContext = 'script'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
                            console.warn("[UI UPDATE] \u26A0\uFE0F Cannot execute ".concat(errorContext, ": MainWindow is destroyed"));
                            return [2 /*return*/, undefined];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.mainWindow.webContents.executeJavaScript(script)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_6 = _a.sent();
                        console.error("[UI UPDATE] \u274C Failed to execute ".concat(errorContext, ":"), error_6);
                        console.error("[UI UPDATE] \uD83D\uDD0D Script was: ".concat(script.substring(0, 100), "..."));
                        console.error("[UI UPDATE] \uD83D\uDCA1 This usually means a DOM element is missing or script syntax error");
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // UI Control Methods
    MainWindow.prototype.setDTR = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            var error_7, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.dtrState = state;
                        if (!this._serialPort) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this._serialPort.setDTR(this.dtrState)];
                    case 2:
                        _a.sent();
                        this.logMessage("[DTR] Hardware control set to ".concat(this.dtrState ? 'ON' : 'OFF'));
                        // If DTR goes high, reset the Debug Logger and sync parser
                        if (this.dtrState) {
                            this.logMessage("[DTR RESET] Device reset via DTR - clearing log and synchronizing parser");
                            if (this.debugLoggerWindow) {
                                this.debugLoggerWindow.handleDTRReset();
                            }
                            // Signal parser that DTR reset occurred - expect sync
                            this.serialProcessor.onDTRReset();
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _a.sent();
                        errorMsg = error_7 instanceof Error ? error_7.message : String(error_7);
                        this.logMessage("ERROR: Failed to set DTR: ".concat(errorMsg));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.setRTS = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            var error_8, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.rtsState = state;
                        if (!this._serialPort) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this._serialPort.setRTS(this.rtsState)];
                    case 2:
                        _a.sent();
                        this.logMessage("[RTS] Hardware control set to ".concat(this.rtsState ? 'ON' : 'OFF'));
                        // If RTS goes high, reset the Debug Logger
                        if (this.rtsState) {
                            this.logMessage("[RTS RESET] Device reset via RTS - clearing log and synchronizing parser");
                            if (this.debugLoggerWindow) {
                                this.debugLoggerWindow.handleDTRReset(); // Same reset behavior for RTS
                            }
                            // Sync parser on RTS reset (using RTS-specific method)
                            this.serialProcessor.onRTSReset();
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_8 = _a.sent();
                        errorMsg = error_8 instanceof Error ? error_8.message : String(error_8);
                        this.logMessage("ERROR: Failed to set RTS: ".concat(errorMsg));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.toggleDTR = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_9, errorMsg;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.dtrState = !this.dtrState;
                        if (!this._serialPort) return [3 /*break*/, 4];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this._serialPort.setDTR(this.dtrState)];
                    case 2:
                        _b.sent();
                        this.logMessage("[DTR] Hardware control set to ".concat(this.dtrState ? 'ON' : 'OFF'));
                        // If DTR goes high, reset the Debug Logger and sync parser
                        if (this.dtrState) {
                            this.logMessage("[DTR RESET] Device reset via DTR - clearing log and synchronizing parser");
                            if (this.debugLoggerWindow) {
                                this.debugLoggerWindow.handleDTRReset();
                            }
                            // Signal parser that DTR reset occurred - expect sync
                            this.serialProcessor.onDTRReset();
                            // Save DTR preference for this device when successfully used
                            this.saveDeviceControlLine('DTR');
                            // Update control line mode and UI if needed
                            if (this.controlLineMode !== 'DTR') {
                                this.controlLineMode = 'DTR';
                                this.updateControlLineUI();
                            }
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_9 = _b.sent();
                        errorMsg = error_9 instanceof Error ? error_9.message : String(error_9);
                        this.logMessage("ERROR: Failed to set DTR: ".concat(errorMsg));
                        // Revert state on error
                        this.dtrState = !this.dtrState;
                        return [3 /*break*/, 4];
                    case 4:
                        // Update checkbox via webContents send (IPC)
                        if ((_a = this.mainWindow) === null || _a === void 0 ? void 0 : _a.webContents) {
                            this.mainWindow.webContents.send('update-dtr-state', this.dtrState);
                        }
                        this.logMessage("[DTR TOGGLE] State changed to ".concat(this.dtrState ? 'ON' : 'OFF'));
                        return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.toggleRTS = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_10, errorMsg;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.rtsState = !this.rtsState;
                        if (!this._serialPort) return [3 /*break*/, 4];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this._serialPort.setRTS(this.rtsState)];
                    case 2:
                        _b.sent();
                        this.logMessage("[RTS] Hardware control set to ".concat(this.rtsState ? 'ON' : 'OFF'));
                        // If RTS goes high, reset the Debug Logger
                        if (this.rtsState) {
                            this.logMessage("[RTS RESET] Device reset via RTS - clearing log and synchronizing parser");
                            if (this.debugLoggerWindow) {
                                this.debugLoggerWindow.handleDTRReset(); // Same reset behavior for RTS
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
                        return [3 /*break*/, 4];
                    case 3:
                        error_10 = _b.sent();
                        errorMsg = error_10 instanceof Error ? error_10.message : String(error_10);
                        this.logMessage("ERROR: Failed to set RTS: ".concat(errorMsg));
                        // Revert state on error
                        this.rtsState = !this.rtsState;
                        return [3 /*break*/, 4];
                    case 4:
                        // Update checkbox via webContents send (IPC)
                        if ((_a = this.mainWindow) === null || _a === void 0 ? void 0 : _a.webContents) {
                            this.mainWindow.webContents.send('update-rts-state', this.rtsState);
                        }
                        this.logMessage("[RTS TOGGLE] State changed to ".concat(this.rtsState ? 'ON' : 'OFF'));
                        return [2 /*return*/];
                }
            });
        });
    };
    // Removed duplicate currentDownloadMode - using downloadMode from line 68
    MainWindow.prototype.updateDownloadMode = function (mode) {
        var ramColor = mode === 'ram' ? '#00FF00' : '#808080';
        var flashColor = mode === 'flash' ? '#00FF00' : '#808080';
        // CRITICAL FIX: Use setTimeout to ensure DOM is ready and properly update LEDs
        this.safeExecuteJS("\n      setTimeout(() => {\n        const ramLed = document.getElementById('ram-led');\n        const flashLed = document.getElementById('flash-led');\n        const ramBtn = document.getElementById('download-ram');\n        const flashBtn = document.getElementById('download-flash');\n        \n        // Debug logging\n        console.log('Updating download mode to: ".concat(mode, "');\n        console.log('RAM LED found:', !!ramLed, 'Flash LED found:', !!flashLed);\n        \n        // Update LED indicators - mutual exclusivity\n        if (ramLed) {\n          ramLed.textContent = '\u25CF';\n          ramLed.style.color = '").concat(ramColor, "';\n          ramLed.style.fontSize = '20px';\n          ramLed.style.textShadow = '0 0 2px #000';\n        } else {\n          console.error('RAM LED element not found!');\n        }\n        \n        if (flashLed) {\n          flashLed.textContent = '\u25CF';\n          flashLed.style.color = '").concat(flashColor, "';\n          flashLed.style.fontSize = '20px';\n          flashLed.style.textShadow = '0 0 2px #000';\n        } else {\n          console.error('Flash LED element not found!');\n        }\n        \n        // Update button states to show active mode\n        if (ramBtn) {\n          if ('").concat(mode, "' === 'ram') {\n            ramBtn.classList.add('active');\n          } else {\n            ramBtn.classList.remove('active');\n          }\n        }\n        if (flashBtn) {\n          if ('").concat(mode, "' === 'flash') {\n            flashBtn.classList.add('active');\n          } else {\n            flashBtn.classList.remove('active');\n          }\n        }\n      }, 0);\n    "), 'download mode update');
    };
    MainWindow.prototype.setDownloadMode = function (mode) {
        // Update the single source of truth
        this.downloadMode = mode;
        this.updateDownloadMode(mode);
        this.logMessage("Download mode set to ".concat(mode.toUpperCase()));
    };
    MainWindow.prototype.downloadFile = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.downloadMode === 'ram')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.downloadToRAM()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.downloadToFlash()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.downloadToRAM = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, filePath, error_11, errorMsg;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dialog.showOpenDialog(this.mainWindow, {
                            title: 'Select Binary File to Download to RAM',
                            filters: [{ name: 'Binary Files', extensions: ['binary', 'bin'] }],
                            properties: ['openFile']
                        })];
                    case 1:
                        result = _a.sent();
                        if (!(!result.canceled && result.filePaths.length > 0)) return [3 /*break*/, 7];
                        filePath = result.filePaths[0];
                        if (!(this._serialPort && this.downloader)) return [3 /*break*/, 6];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        this.logMessage("Downloading ".concat(path_1.default.basename(filePath), " to RAM..."));
                        this.updateRecordingStatus("Downloading to RAM...");
                        // Download to RAM (toFlash = false)
                        return [4 /*yield*/, this.downloader.download(filePath, false)];
                    case 3:
                        // Download to RAM (toFlash = false)
                        _a.sent();
                        this.logMessage("Successfully downloaded ".concat(path_1.default.basename(filePath), " to RAM"));
                        this.updateRecordingStatus("Download complete");
                        // Brief status display then clear
                        setTimeout(function () {
                            _this.updateRecordingStatus('Ready');
                        }, 2000);
                        return [3 /*break*/, 5];
                    case 4:
                        error_11 = _a.sent();
                        errorMsg = error_11 instanceof Error ? error_11.message : String(error_11);
                        this.logMessage("ERROR: Failed to download to RAM: ".concat(errorMsg));
                        this.updateRecordingStatus("Download failed");
                        dialog.showErrorBox('Download Failed', "Failed to download to RAM:\n".concat(errorMsg));
                        return [3 /*break*/, 5];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        this.logMessage("ERROR: Serial port or downloader not initialized");
                        dialog.showErrorBox('Not Connected', 'Please connect to a Propeller 2 device first.');
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.downloadToFlash = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, filePath, error_12, errorMsg;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dialog.showOpenDialog(this.mainWindow, {
                            title: 'Select Binary File to Download to Flash',
                            filters: [{ name: 'Binary Files', extensions: ['binary', 'bin'] }],
                            properties: ['openFile']
                        })];
                    case 1:
                        result = _a.sent();
                        if (!(!result.canceled && result.filePaths.length > 0)) return [3 /*break*/, 7];
                        filePath = result.filePaths[0];
                        if (!(this._serialPort && this.downloader)) return [3 /*break*/, 6];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        this.logMessage("Downloading ".concat(path_1.default.basename(filePath), " to Flash..."));
                        this.updateRecordingStatus("Downloading to Flash...");
                        // Download to Flash (toFlash = true)
                        return [4 /*yield*/, this.downloader.download(filePath, true)];
                    case 3:
                        // Download to Flash (toFlash = true)
                        _a.sent();
                        this.logMessage("Successfully downloaded ".concat(path_1.default.basename(filePath), " to Flash"));
                        this.updateRecordingStatus("Flash complete");
                        // Brief status display then clear
                        setTimeout(function () {
                            _this.updateRecordingStatus('Ready');
                        }, 2000);
                        return [3 /*break*/, 5];
                    case 4:
                        error_12 = _a.sent();
                        errorMsg = error_12 instanceof Error ? error_12.message : String(error_12);
                        this.logMessage("ERROR: Failed to download to Flash: ".concat(errorMsg));
                        this.updateRecordingStatus("Flash failed");
                        dialog.showErrorBox('Flash Failed', "Failed to download to Flash:\n".concat(errorMsg));
                        return [3 /*break*/, 5];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        this.logMessage("ERROR: Serial port or downloader not initialized");
                        dialog.showErrorBox('Not Connected', 'Please connect to a Propeller 2 device first.');
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.startRecording = function () {
        var metadata = {
            sessionName: "session-".concat((0, files_1.getFormattedDateTime)()),
            description: 'Debug session recording',
            startTime: Date.now(),
            serialPort: this._deviceNode,
            baudRate: this._serialBaud
        };
        this.windowRouter.startRecording(metadata);
        this.updateRecordingStatus('Recording...');
        this.updateToolbarButton('record-btn', '⏹ Stop');
    };
    MainWindow.prototype.stopRecording = function () {
        this.windowRouter.stopRecording();
        this.updateRecordingStatus('Ready');
        this.updateToolbarButton('record-btn', '⏺ Record');
    };
    MainWindow.prototype.playRecording = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, filePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dialog.showOpenDialog(this.mainWindow, {
                            title: 'Select Recording to Play',
                            filters: [{ name: 'Recording Files', extensions: ['jsonl'] }],
                            properties: ['openFile']
                        })];
                    case 1:
                        result = _a.sent();
                        if (!(!result.canceled && result.filePaths.length > 0)) return [3 /*break*/, 3];
                        filePath = result.filePaths[0];
                        this.updateRecordingStatus('Playing...');
                        return [4 /*yield*/, this.windowRouter.playRecording(filePath, 1.0)];
                    case 2:
                        _a.sent();
                        this.updateRecordingStatus('Ready');
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MainWindow.prototype.selectBaudRate = function () {
        var _this = this;
        var baudRates = ['115200', '230400', '460800', '921600', '2000000'];
        dialog.showMessageBox(this.mainWindow, {
            type: 'question',
            buttons: baudRates,
            title: 'Select Baud Rate',
            message: 'Choose baud rate:'
        }).then(function (response) {
            _this._serialBaud = parseInt(baudRates[response.response]);
            if (_this._serialPort) {
                usb_serial_1.UsbSerial.setCommBaudRate(_this._serialBaud);
            }
            _this.logMessage("Baud rate set to ".concat(_this._serialBaud));
        });
    };
    MainWindow.prototype.showDebugCommandReference = function () {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Debug Command Reference',
            message: 'Debug Command Reference',
            detail: 'DEBUG TERM - Open terminal window\nDEBUG SCOPE - Open scope window\nDEBUG LOGIC - Open logic analyzer\nDEBUG PLOT - Open plot window\nDEBUG BITMAP - Open bitmap display\nDEBUG MIDI - Open MIDI display\nDEBUG FFT - Open FFT analyzer',
            buttons: ['OK']
        });
    };
    MainWindow.prototype.showSettingsDialog = function () {
        // Create a simple settings dialog
        var settingsWindow = new BrowserWindow({
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
        var settingsHTML = "\n      <html>\n        <head>\n          <style>\n            body {\n              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n              margin: 0;\n              padding: 0;\n              background: #f5f5f5;\n              height: 100vh;\n              display: flex;\n              flex-direction: column;\n            }\n            .settings-container {\n              flex: 1;\n              overflow-y: auto;\n              padding: 20px;\n              padding-bottom: 80px; /* Space for buttons */\n            }\n            h2 {\n              margin-top: 0;\n              color: #333;\n            }\n            .settings-section {\n              background: white;\n              border-radius: 8px;\n              padding: 15px;\n              margin-bottom: 15px;\n              box-shadow: 0 1px 3px rgba(0,0,0,0.1);\n            }\n            .setting-row {\n              display: flex;\n              align-items: center;\n              margin-bottom: 10px;\n            }\n            .setting-row:last-child {\n              margin-bottom: 0;\n            }\n            label {\n              flex: 1;\n              color: #555;\n            }\n            select, input[type=\"number\"], input[type=\"text\"] {\n              width: 200px;\n              padding: 5px;\n              border: 1px solid #ddd;\n              border-radius: 4px;\n            }\n            input[type=\"checkbox\"] {\n              margin-left: auto;\n            }\n            .button-row {\n              position: fixed;\n              bottom: 0;\n              left: 0;\n              right: 0;\n              background: white;\n              border-top: 1px solid #ddd;\n              padding: 15px 20px;\n              display: flex;\n              justify-content: flex-end;\n              box-shadow: 0 -2px 5px rgba(0,0,0,0.1);\n            }\n            button {\n              padding: 8px 16px;\n              margin-left: 10px;\n              border: 1px solid #ddd;\n              border-radius: 4px;\n              background: white;\n              cursor: pointer;\n            }\n            button:hover {\n              background: #f0f0f0;\n            }\n            button.primary {\n              background: #007AFF;\n              color: white;\n              border-color: #007AFF;\n            }\n            button.primary:hover {\n              background: #0056b3;\n            }\n          </style>\n        </head>\n        <body>\n          <div class=\"settings-container\">\n            <h2>Settings</h2>\n            \n            <div class=\"settings-section\">\n            <h3>Terminal</h3>\n            <div class=\"setting-row\">\n              <label for=\"terminal-mode\">Terminal Mode:</label>\n              <select id=\"terminal-mode\">\n                <option value=\"PST\">PST (Parallax Serial Terminal)</option>\n                <option value=\"ANSI\">ANSI (Standard escape sequences)</option>\n              </select>\n            </div>\n            <div class=\"setting-row\">\n              <label for=\"theme\">Color Theme:</label>\n              <select id=\"theme\">\n                <option value=\"pst\">PST (Cyan/Yellow)</option>\n                <option value=\"classic\">Classic (Green/Black)</option>\n                <option value=\"amber\">Amber Terminal</option>\n              </select>\n            </div>\n            <div class=\"setting-row\">\n              <label for=\"fontsize\">Font Size:</label>\n              <input type=\"number\" id=\"fontsize\" value=\"12\" min=\"8\" max=\"24\" />\n            </div>\n            <div class=\"setting-row\">\n              <label for=\"echo\">Local Echo:</label>\n              <input type=\"checkbox\" id=\"echo\" />\n            </div>\n          </div>\n          \n          <div class=\"settings-section\">\n            <h3>Debug Logger</h3>\n            <div class=\"setting-row\">\n              <label for=\"logger-theme\">Logger Theme:</label>\n              <select id=\"logger-theme\">\n                <option value=\"green\">Green on Black</option>\n                <option value=\"amber\">Amber on Black</option>\n              </select>\n            </div>\n            <div class=\"setting-row\">\n              <label for=\"auto-log\">Auto-start Logging:</label>\n              <input type=\"checkbox\" id=\"auto-log\" />\n            </div>\n            <div class=\"setting-row\">\n              <label for=\"log-basename\">Log File Base Name:</label>\n              <input type=\"text\" id=\"log-basename\" value=\"debug_capture\" />\n            </div>\n          </div>\n          \n          <div class=\"settings-section\">\n            <h3>COG Windows</h3>\n            <div class=\"setting-row\">\n              <label for=\"cog-display-mode\">COG Display Mode:</label>\n              <select id=\"cog-display-mode\">\n                <option value=\"show_all\">Show All 8 COGs</option>\n                <option value=\"on_demand\">Show Only Active COGs</option>\n              </select>\n            </div>\n            <div class=\"setting-row\">\n              <label for=\"cog-auto-open\">Auto-open on traffic:</label>\n              <input type=\"checkbox\" id=\"cog-auto-open\" checked />\n            </div>\n          </div>\n          \n          <div class=\"settings-section\">\n            <h3>Serial Control</h3>\n            <div class=\"setting-row\">\n              <label for=\"control-line-mode\">Reset Control Line:</label>\n              <select id=\"control-line-mode\">\n                <option value=\"DTR\">DTR (Parallax Prop Plug)</option>\n                <option value=\"RTS\">RTS (FTDI Clones)</option>\n              </select>\n            </div>\n            <div class=\"setting-row\" style=\"font-size: 11px; color: #666; margin-left: 20px;\">\n              DTR: Standard for official Parallax devices<br>\n              RTS: Required by some FTDI clones\n            </div>\n          </div>\n          \n          <div class=\"settings-section\">\n            <h3>Window Placement</h3>\n            <div class=\"setting-row\">\n              <label for=\"cascade\">Cascade Windows:</label>\n              <input type=\"checkbox\" id=\"cascade\" />\n            </div>\n            <div class=\"setting-row\">\n              <label for=\"remember-pos\">Remember Window Positions:</label>\n              <input type=\"checkbox\" id=\"remember-pos\" />\n            </div>\n          </div>\n          </div><!-- end settings-container -->\n          \n          <div class=\"button-row\">\n            <button onclick=\"window.close()\">Cancel</button>\n            <button class=\"primary\" onclick=\"saveAndClose()\">OK</button>\n          </div>\n          \n          <script>\n            const { ipcRenderer } = require('electron');\n            \n            // Load current settings\n            window.addEventListener('DOMContentLoaded', () => {\n              // Load terminal mode\n              const terminalMode = localStorage.getItem('terminal-mode') || 'PST';\n              const modeSelect = document.getElementById('terminal-mode');\n              if (modeSelect) {\n                modeSelect.value = terminalMode;\n              }\n              \n              // Load other settings...\n              // TODO: Load theme, font size, echo, etc.\n              \n              // Load COG display mode\n              const cogMode = localStorage.getItem('cog-display-mode') || 'show_all';\n              const cogModeSelect = document.getElementById('cog-display-mode');\n              if (cogModeSelect) {\n                cogModeSelect.value = cogMode;\n              }\n              \n              const cogAutoOpen = localStorage.getItem('cog-auto-open') !== 'false';\n              const cogAutoOpenCheck = document.getElementById('cog-auto-open');\n              if (cogAutoOpenCheck) {\n                cogAutoOpenCheck.checked = cogAutoOpen;\n              }\n              \n              // Load control line mode\n              const controlLineMode = localStorage.getItem('control-line-mode') || 'DTR';\n              const controlLineSelect = document.getElementById('control-line-mode');\n              if (controlLineSelect) {\n                controlLineSelect.value = controlLineMode;\n              }\n            });\n            \n            function saveAndClose() {\n              // Save terminal mode\n              const modeSelect = document.getElementById('terminal-mode');\n              if (modeSelect) {\n                const selectedMode = modeSelect.value;\n                localStorage.setItem('terminal-mode', selectedMode);\n                // Send to main process to update terminal\n                ipcRenderer.send('set-terminal-mode', selectedMode);\n              }\n              \n              // Save COG display mode\n              const cogModeSelect = document.getElementById('cog-display-mode');\n              if (cogModeSelect) {\n                const selectedCogMode = cogModeSelect.value;\n                localStorage.setItem('cog-display-mode', selectedCogMode);\n                ipcRenderer.send('set-cog-display-mode', selectedCogMode);\n              }\n              \n              const cogAutoOpenCheck = document.getElementById('cog-auto-open');\n              if (cogAutoOpenCheck) {\n                localStorage.setItem('cog-auto-open', cogAutoOpenCheck.checked);\n              }\n              \n              // Save control line mode\n              const controlLineSelect = document.getElementById('control-line-mode');\n              if (controlLineSelect) {\n                const selectedControlLine = controlLineSelect.value;\n                localStorage.setItem('control-line-mode', selectedControlLine);\n                ipcRenderer.send('set-control-line-mode', selectedControlLine);\n              }\n              \n              // TODO: Save other settings\n              // In a future sprint, this will save to external project .json file\n              \n              window.close();\n            }\n          </script>\n        </body>\n      </html>\n    ";
        settingsWindow.loadURL("data:text/html;charset=utf-8,".concat(encodeURIComponent(settingsHTML)));
        settingsWindow.setMenu(null);
    };
    /**
     * Load global settings from file, creating defaults if needed
     */
    MainWindow.prototype.loadGlobalSettings = function () {
        try {
            if (fs.existsSync(this.settingsFilePath)) {
                var data = fs.readFileSync(this.settingsFilePath, 'utf8');
                this.globalSettings = JSON.parse(data);
                this.logMessage("\u2713 Loaded settings from ".concat(this.settingsFilePath));
            }
            else {
                // Create default settings
                this.globalSettings = {
                    defaultControlLine: 'DTR', // Parallax standard
                    deviceSettings: {}
                };
                this.saveGlobalSettings();
                this.logMessage("\u2713 Created default settings at ".concat(this.settingsFilePath));
            }
        }
        catch (error) {
            this.logMessage("\u26A0\uFE0F Error loading settings: ".concat(error, ", using defaults"));
            this.globalSettings = {
                defaultControlLine: 'DTR',
                deviceSettings: {}
            };
        }
    };
    /**
     * Save global settings to file
     */
    MainWindow.prototype.saveGlobalSettings = function () {
        try {
            var data = JSON.stringify(this.globalSettings, null, 2);
            fs.writeFileSync(this.settingsFilePath, data, 'utf8');
            this.logMessage("\u2713 Settings saved to ".concat(this.settingsFilePath));
        }
        catch (error) {
            this.logMessage("\u26A0\uFE0F Error saving settings: ".concat(error));
        }
    };
    /**
     * Get unique device identifier for current device
     * Format: "vendorId:productId:serialNumber" or fallback to device path
     */
    MainWindow.prototype.getCurrentDeviceId = function () {
        if (this._serialPort) {
            // Try to get USB device information
            var deviceInfo = this._serialPort.deviceInfo;
            if (deviceInfo && deviceInfo !== '') {
                // Use P2 device ID if available
                return "p2:".concat(deviceInfo);
            }
        }
        // Fallback to device path (less reliable but works)
        return "path:".concat(this._deviceNode);
    };
    /**
     * Get control line preference for current device
     */
    MainWindow.prototype.getDeviceControlLine = function () {
        var deviceId = this.getCurrentDeviceId();
        var deviceSettings = this.globalSettings.deviceSettings[deviceId];
        if (deviceSettings) {
            this.logMessage("\uD83D\uDCCB Using saved ".concat(deviceSettings.controlLine, " for device ").concat(deviceId));
            return deviceSettings.controlLine;
        }
        this.logMessage("\uD83D\uDCCB Using default ".concat(this.globalSettings.defaultControlLine, " for new device ").concat(deviceId));
        return this.globalSettings.defaultControlLine;
    };
    /**
     * Save control line preference for current device
     */
    MainWindow.prototype.saveDeviceControlLine = function (controlLine) {
        var deviceId = this.getCurrentDeviceId();
        this.globalSettings.deviceSettings[deviceId] = {
            controlLine: controlLine,
            lastUsed: Date.now()
        };
        this.saveGlobalSettings();
        this.logMessage("\uD83D\uDCBE Saved ".concat(controlLine, " preference for device ").concat(deviceId));
    };
    MainWindow.prototype.updateToolbarButton = function (id, text) {
        this.safeExecuteJS("\n      const btn = document.getElementById('".concat(id, "');\n      if (btn) btn.textContent = '").concat(text, "';\n    "), "updateToolbarButton-".concat(id));
    };
    MainWindow.prototype.updateRecordingStatus = function (status) {
        this.safeExecuteJS("\n      const statusEl = document.getElementById('recording-status');\n      if (statusEl) statusEl.textContent = '".concat(status, "';\n    "), 'updateRecordingStatus');
    };
    MainWindow.prototype.updateConnectionStatus = function (connected) {
        var color = connected ? '#00FF00' : '#FFBF00'; // Green when connected, Yellow when not
        this.safeExecuteJS("\n      // Update connection LED indicator (GREEN when connected, YELLOW when disconnected)\n      const connLed = document.getElementById('conn-led');\n      if (connLed) {\n        connLed.textContent = '\u25CF';  // Always filled circle\n        connLed.style.color = '".concat(color, "';\n        connLed.style.fontSize = '20px';  // Make it bigger\n      }\n    "), 'updateConnectionStatus');
    };
    MainWindow.prototype.updateCheckbox = function (id, checked) {
        this.safeExecuteJS("\n      const checkbox = document.getElementById('".concat(id, "');\n      if (checkbox) {\n        checkbox.checked = ").concat(checked, ";\n      }\n    "), "updateCheckbox-".concat(id));
    };
    MainWindow.prototype.updateActiveCogs = function (cogs) {
        var cogList = Array.from(cogs).sort().join(', ') || 'None';
        this.safeExecuteJS("\n      const status = document.getElementById('cogs-status');\n      if (status) status.textContent = '".concat(cogList, "';\n    "), 'updateActiveCogs');
    };
    MainWindow.prototype.toggleEchoOff = function () {
        this.echoOffEnabled = !this.echoOffEnabled;
        this.updateEchoCheckbox(this.echoOffEnabled);
        this.logMessage("Echo Off ".concat(this.echoOffEnabled ? 'enabled' : 'disabled', " - filtering echoed characters"));
        if (!this.echoOffEnabled) {
            this.recentTransmitBuffer = [];
        }
    };
    MainWindow.prototype.updateEchoCheckbox = function (checked) {
        this.safeExecuteJS("\n      const checkbox = document.getElementById('echo-checkbox');\n      if (checkbox) checkbox.checked = ".concat(checked, ";\n    "), 'updateEchoCheckbox');
    };
    MainWindow.prototype.blinkActivityLED = function (type) {
        var _this = this;
        var ledId = type === 'tx' ? 'tx-led' : 'rx-led';
        var color = type === 'tx' ? '#0080FF' : '#FF0000'; // Blue for TX, Red for RX
        var timer = type === 'tx' ? this.txActivityTimer : this.rxActivityTimer;
        // Clear existing timer
        if (timer) {
            clearTimeout(timer);
        }
        // Turn LED on - ensure DOM is ready with timeout
        var script = "\n      setTimeout(() => {\n        const led = document.getElementById('".concat(ledId, "');\n        if (led) {\n          led.style.color = '").concat(color, "';\n          led.style.fontSize = '20px';  // Consistent size\n          led.style.textShadow = '0 0 2px #000';\n        } else {\n          console.warn('[LED] Element ").concat(ledId, " not found in DOM');\n        }\n      }, 10);\n    ");
        this.safeExecuteJS(script, "".concat(type, "LED-on"));
        // Turn LED off after 150ms
        var newTimer = setTimeout(function () {
            _this.safeExecuteJS("\n        setTimeout(() => {\n          const led = document.getElementById('".concat(ledId, "');\n          if (led) {\n            led.style.color = '#333';\n            led.style.fontSize = '20px';  // Consistent size\n            led.style.textShadow = '0 0 2px #000';\n          }\n        }, 10);\n      "), "".concat(type, "LED-off")).then(function () {
                // Only clear timer after successful LED update
                if (type === 'tx') {
                    _this.txActivityTimer = null;
                }
                else {
                    _this.rxActivityTimer = null;
                }
            }).catch(function () {
                // If LED update fails, still clear timer to prevent memory leaks
                if (type === 'tx') {
                    _this.txActivityTimer = null;
                }
                else {
                    _this.rxActivityTimer = null;
                }
            });
        }, 150);
        if (type === 'tx') {
            this.txActivityTimer = newTimer;
        }
        else {
            this.rxActivityTimer = newTimer;
        }
    };
    MainWindow.prototype.updateLoggingStatus = function (isLogging, filename, lineCount) {
        var symbol = isLogging ? '●' : '○';
        var color = isLogging ? '#00FF00' : '#333';
        this.safeExecuteJS("\n      // Update log LED indicator\n      const logLed = document.getElementById('log-led');\n      if (logLed) {\n        logLed.textContent = '".concat(symbol, "';\n        logLed.style.color = '").concat(color, "';\n      }\n    "), 'updateLoggingStatus');
    };
    return MainWindow;
}());
exports.MainWindow = MainWindow;
