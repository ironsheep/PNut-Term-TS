"use strict";
/** @format */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.WindowRouter = void 0;
// src/classes/shared/windowRouter.ts
var fs = require("fs");
var path = require("path");
var events_1 = require("events");
var recordingCatalog_1 = require("./recordingCatalog");
var routerLogger_1 = require("./routerLogger");
var displayUtils_1 = require("../../utils/displayUtils");
/**
 * Centralized message router for all debug windows and debugger
 * Singleton pattern ensures single routing point
 */
var WindowRouter = /** @class */ (function (_super) {
    __extends(WindowRouter, _super);
    function WindowRouter() {
        var _this = _super.call(this) || this;
        // Window management
        _this.windows = new Map();
        // Two-tiered registration: Track window instances even before they're ready
        _this.windowInstances = new Map();
        // Recording state
        _this.isRecording = false;
        _this.recordingMetadata = null;
        _this.recordingStream = null;
        _this.recordingBuffer = [];
        _this.recordingTimer = null;
        _this.recordingCatalog = new recordingCatalog_1.RecordingCatalog();
        _this.recordingSessionId = null;
        _this.recordingMessageCount = 0;
        _this.recordingStartTime = 0;
        _this.samplingSeed = 0;
        // Statistics
        _this.stats = {
            messagesRouted: 0,
            bytesProcessed: 0,
            averageRoutingTime: 0,
            peakRoutingTime: 0,
            errors: 0,
            windowsActive: 0,
            recordingActive: false
        };
        // Performance tracking
        _this.routingTimes = [];
        _this.MAX_ROUTING_SAMPLES = 1000;
        // Buffer settings
        _this.BUFFER_SIZE = 1000;
        _this.BUFFER_TIMEOUT = 100; // ms
        // Initialize logger
        _this.logger = new routerLogger_1.RouterLogger({
            level: process.env.NODE_ENV === 'development' ? routerLogger_1.LogLevel.DEBUG : routerLogger_1.LogLevel.INFO,
            console: true,
            file: process.env.ROUTER_LOG_FILE === 'true'
        });
        _this.logger.info('STARTUP', 'WindowRouter initialized');
        return _this;
    }
    /**
     * Get singleton instance of WindowRouter
     */
    WindowRouter.getInstance = function () {
        if (!WindowRouter.instance) {
            WindowRouter.instance = new WindowRouter();
        }
        return WindowRouter.instance;
    };
    /**
     * Phase 1: Register window instance (called during window construction)
     * This allows early message routing to window's internal queue
     */
    WindowRouter.prototype.registerWindowInstance = function (windowId, windowType, instance) {
        this.logger.debug('REGISTER_INSTANCE', "Registering window instance: ".concat(windowId, " (").concat(windowType, ")"));
        this.windowInstances.set(windowId, {
            type: windowType,
            instance: instance,
            isReady: false
        });
        this.logger.info('REGISTER_INSTANCE', "Window instance registered: ".concat(windowId, " (").concat(windowType, "). Can receive messages to queue."));
    };
    /**
     * Phase 2: Register window handler (called when window is ready)
     * This enables direct message processing
     */
    WindowRouter.prototype.registerWindow = function (windowId, windowType, handler) {
        this.logger.debug('REGISTER', "Registering window handler: ".concat(windowId, " (").concat(windowType, ")"));
        if (this.windows.has(windowId)) {
            var error = new Error("Window ".concat(windowId, " is already registered"));
            this.logger.logError('REGISTER', error);
            throw error;
        }
        // Mark instance as ready if it exists
        var instance = this.windowInstances.get(windowId);
        if (instance) {
            instance.isReady = true;
            this.logger.debug('REGISTER', "Marked window instance ".concat(windowId, " as ready"));
        }
        var windowInfo = {
            windowId: windowId,
            windowType: windowType,
            registeredAt: Date.now(),
            messagesReceived: 0
        };
        this.windows.set(windowId, {
            type: windowType,
            handler: handler,
            stats: windowInfo
        });
        this.stats.windowsActive = this.windows.size;
        this.logger.info('REGISTER', "Window registered: ".concat(windowId, " (").concat(windowType, "). Active windows: ").concat(this.stats.windowsActive));
        this.emit('windowRegistered', { windowId: windowId, windowType: windowType });
    };
    /**
     * Unregister a debug window
     */
    WindowRouter.prototype.unregisterWindow = function (windowId) {
        this.logger.debug('UNREGISTER', "Unregistering window: ".concat(windowId));
        if (this.windows.delete(windowId)) {
            this.stats.windowsActive = this.windows.size;
            this.logger.info('UNREGISTER', "Window unregistered: ".concat(windowId, ". Active windows: ").concat(this.stats.windowsActive));
            this.emit('windowUnregistered', { windowId: windowId });
        }
        else {
            this.logger.warn('UNREGISTER', "Attempted to unregister non-existent window: ".concat(windowId));
        }
    };
    /**
     * Route a message to appropriate window(s)
     */
    WindowRouter.prototype.routeMessage = function (message) {
        var startTime = performance.now();
        try {
            var dataSize = typeof message.data === 'string' ? message.data.length : message.data.length;
            this.logger.trace('ROUTE', "Routing ".concat(message.type, " message (").concat(dataSize, " bytes)"));
            if (message.type === 'binary') {
                // Use tagged COG ID if available
                this.routeBinaryMessage(message.data, message.cogId);
            }
            else {
                this.routeTextMessage(message.data);
            }
            // Update statistics
            var routingTime = performance.now() - startTime;
            this.updateRoutingStats(routingTime, message.data);
            // Log performance if slow
            if (routingTime > 1.0) {
                this.logger.warn('PERFORMANCE', "Slow routing detected: ".concat(routingTime.toFixed(2), "ms (").concat(message.type, ", ").concat(dataSize, "B)"));
            }
        }
        catch (error) {
            this.stats.errors++;
            this.logger.logError('ROUTE', error, { messageType: message.type });
            this.emit('routingError', { error: error, message: message });
        }
    };
    /**
     * Route binary message (debugger protocol)
     * @param data Binary data to route
     * @param taggedCogId Optional pre-extracted COG ID from message tag
     */
    WindowRouter.prototype.routeBinaryMessage = function (data, taggedCogId) {
        var startTime = performance.now();
        // Use tagged COG ID if provided, otherwise extract from 32-bit little-endian word
        // P2 debugger protocol: COG ID is first 32-bit little-endian word (not just first byte!)
        var extractedCogId = 0;
        if (data.length >= 4) {
            // Extract 32-bit little-endian COG ID
            extractedCogId = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
        }
        else if (data.length > 0) {
            // Fallback for shorter messages
            extractedCogId = data[0];
        }
        var cogId = taggedCogId !== undefined ? taggedCogId : extractedCogId;
        // Validate COG ID  
        if (cogId > 0x07 && taggedCogId === undefined) {
            this.logger.warn('ROUTE_BINARY', "Invalid COG ID extracted: 0x".concat(extractedCogId.toString(16).toUpperCase(), " (expected 0x00-0x07)"));
        }
        var windowId = "debugger-".concat(cogId);
        this.logger.debug('ROUTE_BINARY', "Routing binary message to COG ".concat(cogId, " (").concat(data.length, "B)"));
        // ALWAYS route binary messages to DebugLogger window for logging/analysis
        var loggerWindowFound = false;
        for (var _i = 0, _a = this.windows; _i < _a.length; _i++) {
            var _b = _a[_i], winId = _b[0], window_1 = _b[1];
            if (window_1.type === 'logger') { // DebugLoggerWindow registers as 'logger' type
                window_1.handler(data); // Send raw Uint8Array for hex formatting
                window_1.stats.messagesReceived++;
                loggerWindowFound = true;
                if (this.isRecording) {
                    this.recordMessage(winId, window_1.type, 'binary', data);
                }
            }
        }
        // Defensive error logging: warn if no logger window found for binary data
        if (!loggerWindowFound) {
            this.logger.warn('ROUTE_ERROR', "No DebugLoggerWindow registered to receive binary message from COG ".concat(cogId, " (").concat(data.length, "B)"));
            console.warn("[ROUTING] \u26A0\uFE0F Binary debugger message from COG ".concat(cogId, " received but no DebugLoggerWindow registered! Message will be lost."));
            console.warn('[ROUTING] 💡 This usually means DebugLoggerWindow failed to call registerWithRouter()');
        }
        // Also route to specific debugger window if it exists
        var window = this.windows.get(windowId);
        if (window) {
            window.handler(data);
            window.stats.messagesReceived++;
            var routingTime_1 = performance.now() - startTime;
            this.logger.logRouting(windowId, 'binary', data.length, routingTime_1);
            // Record if enabled
            if (this.isRecording) {
                this.recordMessage(windowId, window.type, 'binary', data);
            }
        }
        else {
            // No debugger window for this COG - could be normal
            this.logger.debug('ROUTE_BINARY', "No window registered for COG ".concat(cogId, ", message unhandled"));
            this.emit('unhandledMessage', { type: 'binary', cogId: cogId, size: data.length });
        }
        // Update statistics
        var routingTime = performance.now() - startTime;
        this.updateRoutingStats(routingTime, data);
    };
    /**
     * Route text message (DEBUG commands, Cog messages, etc.)
     */
    WindowRouter.prototype.routeTextMessage = function (text) {
        var startTime = performance.now();
        var handled = false;
        // 1. Check for Cog messages, INIT messages, OR backtick commands (all P2 debug output)
        if (text.startsWith('Cog') || text.includes('INIT') || text.includes('`')) {
            this.logger.debug('ROUTE', "Routing Cog/INIT message: ".concat(text.substring(0, 50), "..."));
            // Always route to DebugLogger window for logging
            var loggerWindowFound = false;
            for (var _i = 0, _a = this.windows; _i < _a.length; _i++) {
                var _b = _a[_i], windowId = _b[0], window_2 = _b[1];
                if (window_2.type === 'logger') { // DebugLoggerWindow registers as 'logger' type
                    console.log("[ROUTER->LOGGER] Sending ".concat(text.length, " bytes to DebugLogger window"));
                    window_2.handler(text);
                    window_2.stats.messagesReceived++;
                    handled = true;
                    loggerWindowFound = true;
                    if (this.isRecording) {
                        this.recordMessage(windowId, window_2.type, 'text', text);
                    }
                }
            }
            // Defensive error logging: warn if no logger window found
            if (!loggerWindowFound) {
                this.logger.warn('ROUTE_ERROR', "No DebugLoggerWindow registered to receive Cog message: \"".concat(text.substring(0, 50), "...\""));
                console.warn('[ROUTING] ⚠️ Cog message received but no DebugLoggerWindow registered! Message will be lost.');
                console.warn('[ROUTING] 💡 This usually means DebugLoggerWindow failed to call registerWithRouter()');
            }
            // Check for embedded backtick commands in Cog messages
            if (text.includes('`')) {
                var tickIndex = text.indexOf('`');
                var embeddedCommand = text.substring(tickIndex);
                this.logger.debug('ROUTE', "Found embedded command in Cog message: ".concat(embeddedCommand));
                // Parse and route the embedded command
                this.routeBacktickCommand(embeddedCommand);
            }
            // DISABLED: False reboot detection - only actual DTR/RTS events should trigger resets
            // Normal P2 debug messages should NOT trigger system reboot events
            /*
            // Detect P2 processor reset/reboot events
            if (text.startsWith('Cog0') && text.includes('INIT')) {
              // Check for the golden synchronization marker
              if (text.includes('$0000_0000 $0000_0000 load')) {
                this.logger.info('ROUTE', '🎯 P2 SYSTEM REBOOT detected - golden sync marker found');
                console.log(`[P2 SYNC] 🎯 SYSTEM REBOOT: ${text}`);
                // Emit special event for complete synchronization reset
                this.emit('p2SystemReboot', { message: text, timestamp: Date.now() });
              } else {
                this.logger.info('ROUTE', 'Processor reset detected (Cog0 INIT)');
                // Regular processor reset event
                this.emit('processorReset', { message: text });
              }
            */
        }
        // 2. Check for standalone backtick commands
        else if (text.includes('`')) {
            var tickIndex = text.indexOf('`');
            var command = text.substring(tickIndex);
            this.routeBacktickCommand(command);
            handled = true;
        }
        // 3. Check for DEBUG command format
        else if (text.startsWith('DEBUG ')) {
            var parts = text.split(' ', 3);
            if (parts.length >= 2) {
                var windowType = parts[1].toLowerCase();
                // Route to all windows of this type
                for (var _c = 0, _d = this.windows; _c < _d.length; _c++) {
                    var _e = _d[_c], windowId = _e[0], window_3 = _e[1];
                    if (window_3.type === windowType) {
                        window_3.handler(text);
                        window_3.stats.messagesReceived++;
                        handled = true;
                        // Record if enabled
                        if (this.isRecording) {
                            this.recordMessage(windowId, window_3.type, 'text', text);
                        }
                    }
                }
            }
        }
        // Default to terminal window if not handled
        if (!handled) {
            var terminalWindow = this.windows.get('terminal');
            if (terminalWindow) {
                terminalWindow.handler(text);
                terminalWindow.stats.messagesReceived++;
                if (this.isRecording) {
                    this.recordMessage('terminal', 'terminal', 'text', text);
                }
            }
        }
        // Update statistics
        var routingTime = performance.now() - startTime;
        this.updateRoutingStats(routingTime, text);
    };
    /**
     * Parse and route backtick commands to appropriate debug windows
     */
    WindowRouter.prototype.routeBacktickCommand = function (command) {
        // Backtick commands have format: `WINDOWTYPE command data...
        // Example: `TERM MyTerm SIZE 80 25
        console.log("[ROUTER DEBUG] routeBacktickCommand called with: \"".concat(command, "\""));
        if (!command.startsWith('`')) {
            console.log("[ROUTER DEBUG] \u274C Invalid backtick command (no backtick): \"".concat(command, "\""));
            this.logger.warn('ROUTE', "Invalid backtick command: ".concat(command));
            return;
        }
        // CRITICAL: Never create COG-0 windows from backtick commands
        // COG0 is the system COG and should never have a debug window
        if (command.includes('COG-0') || command.includes('COG0')) {
            console.log("[ROUTER DEBUG] \u26A0\uFE0F Ignoring COG-0 backtick command (system COG): \"".concat(command, "\""));
            this.logger.info('ROUTE', 'Ignoring COG-0 backtick command (system COG)');
            return;
        }
        // Remove the backtick and parse
        var cleanCommand = command.substring(1).trim();
        var parts = cleanCommand.split(' ');
        console.log("[ROUTER DEBUG] Parsed command: \"".concat((0, displayUtils_1.safeDisplayString)(cleanCommand), "\", parts: [").concat(parts.map(function (p) { return (0, displayUtils_1.safeDisplayString)(p); }).join(', '), "]"));
        if (parts.length < 1) {
            console.log("[ROUTER DEBUG] \u274C Empty backtick command");
            this.logger.warn('ROUTE', "Empty backtick command");
            return;
        }
        // First check if this is a CLOSE command (e.g., `MyLogic close)
        var windowName = parts[0]; // Keep original case for window name
        var isCloseCommand = parts.length >= 2 && parts[1].toLowerCase() === 'close';
        // CRITICAL: Never create COG-0 windows
        if (windowName === 'COG-0' || windowName === 'COG0') {
            console.log("[ROUTER DEBUG] \u26A0\uFE0F Blocking COG-0 window creation (system COG)");
            this.logger.info('ROUTE', 'Blocked COG-0 window creation attempt');
            return;
        }
        console.log("[ROUTER DEBUG] Looking for window: \"".concat(windowName, "\"").concat(isCloseCommand ? ' (CLOSE command)' : ''));
        console.log("[ROUTER DEBUG] Registered windows: [".concat(Array.from(this.windows.keys()).join(', '), "]"));
        if (isCloseCommand) {
            // Handle CLOSE command - find and close the window
            console.log("[ROUTER DEBUG] Processing CLOSE command for window: \"".concat(windowName, "\""));
            var window_4 = this.windows.get(windowName);
            if (window_4) {
                console.log("[ROUTER DEBUG] \u2705 Found window \"".concat(windowName, "\" - sending close command"));
                window_4.handler(command); // Let the window handle its own close
                // Window will unregister itself when it closes
                return;
            }
            else {
                console.log("[ROUTER DEBUG] \u274C Window \"".concat(windowName, "\" not found for CLOSE command"));
                return; // Don't emit windowNeeded for CLOSE commands
            }
        }
        // Try to route to window by exact name first (e.g., MyLogic, MyTerm)
        var routed = false;
        var window = this.windows.get(windowName);
        if (window) {
            console.log("[ROUTER DEBUG] \u2705 Found window by name: \"".concat(windowName, "\""));
            // Send the full command including backtick for window to parse
            window.handler(command);
            window.stats.messagesReceived++;
            routed = true;
            if (this.isRecording) {
                this.recordMessage(windowName, window.type, 'text', command);
            }
        }
        if (!routed) {
            // Log error to terminal for user visibility - safely display binary data
            var safeWindowName = (0, displayUtils_1.safeDisplayString)(windowName);
            var safeCommand = (0, displayUtils_1.safeDisplayString)(command);
            var errorMsg = "ERROR: Unknown window '".concat(safeWindowName, "' - cannot route command: ").concat(safeCommand);
            console.log("[ROUTER DEBUG] \uD83D\uDEA8 No window found for \"".concat(safeWindowName, "\" - emitting windowNeeded event"));
            this.logger.error('ROUTE', errorMsg);
            // Send error to terminal window for user visibility
            var terminalWindow = this.windows.get('terminal');
            if (terminalWindow) {
                terminalWindow.handler("\n".concat(errorMsg, "\n"));
            }
            // Emit event in case someone wants to handle missing windows
            console.log("[ROUTER DEBUG] \uD83D\uDCE1 Emitting windowNeeded event: type=\"".concat(windowName, "\", command=\"").concat(command, "\""));
            this.emit('windowNeeded', { type: windowName, command: command, error: errorMsg });
        }
        else {
            console.log("[ROUTER DEBUG] \u2705 Successfully routed command to existing window");
        }
    };
    /**
     * Start recording debug session
     */
    WindowRouter.prototype.startRecording = function (metadata) {
        var _this = this;
        if (this.isRecording) {
            var error = new Error('Recording already in progress');
            this.logger.logError('RECORDING', error);
            throw error;
        }
        this.logger.info('RECORDING', "Starting recording session: ".concat(metadata.sessionName));
        // Create recordings directory if needed
        var recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
        if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
        }
        // Generate session ID and filename
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.recordingSessionId = "".concat(timestamp, "-").concat(metadata.sessionName);
        var filename = "".concat(this.recordingSessionId, ".jsonl");
        var filepath = path.join(recordingsDir, filename);
        // Start recording
        this.recordingMetadata = metadata;
        this.recordingStream = fs.createWriteStream(filepath, { flags: 'w' });
        this.isRecording = true;
        this.stats.recordingActive = true;
        this.recordingMessageCount = 0;
        this.recordingStartTime = Date.now();
        this.samplingSeed = 0;
        // Add to catalog
        var catalogEntry = {
            sessionId: this.recordingSessionId,
            filename: filename,
            metadata: {
                sessionName: metadata.sessionName,
                description: metadata.description,
                timestamp: metadata.startTime,
                p2Model: metadata.p2Model,
                serialPort: metadata.serialPort,
                baudRate: metadata.baudRate,
                windowTypes: metadata.windowTypes,
                testScenario: metadata.testScenario,
                expectedResults: metadata.expectedResults,
                tags: metadata.tags
            }
        };
        this.recordingCatalog.addRecording(catalogEntry);
        // Write metadata as first line
        this.recordingStream.write(JSON.stringify({ metadata: metadata }) + '\n');
        // Setup buffered write timer
        this.recordingTimer = setInterval(function () { return _this.flushRecordingBuffer(); }, this.BUFFER_TIMEOUT);
        this.emit('recordingStarted', { metadata: metadata, filepath: filepath, sessionId: this.recordingSessionId });
    };
    /**
     * Stop recording debug session
     */
    WindowRouter.prototype.stopRecording = function () {
        if (!this.isRecording) {
            return;
        }
        // Flush remaining buffer
        this.flushRecordingBuffer();
        // Update catalog with final stats
        if (this.recordingSessionId) {
            var duration = Date.now() - this.recordingStartTime;
            var filepath = path.join(process.cwd(), 'tests', 'recordings', 'sessions', "".concat(this.recordingSessionId, ".jsonl"));
            var fileSize = 0;
            if (fs.existsSync(filepath)) {
                fileSize = fs.statSync(filepath).size;
            }
            this.recordingCatalog.updateRecording(this.recordingSessionId, {
                duration: duration,
                messageCount: this.recordingMessageCount,
                fileSize: fileSize
            });
        }
        // Clean up
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        if (this.recordingStream) {
            this.recordingStream.end();
            this.recordingStream = null;
        }
        this.isRecording = false;
        this.stats.recordingActive = false;
        this.recordingMetadata = null;
        this.recordingSessionId = null;
        this.emit('recordingStopped');
    };
    /**
     * Get recording catalog
     */
    WindowRouter.prototype.getRecordingCatalog = function () {
        return this.recordingCatalog;
    };
    /**
     * Play back a recorded session
     */
    WindowRouter.prototype.playRecording = function (filePath_1) {
        return __awaiter(this, arguments, void 0, function (filePath, speed, headless) {
            var content, lines, metadataLine, lastTimestamp, messagesPlayed, errors, _loop_1, this_1, i;
            if (speed === void 0) { speed = 1.0; }
            if (headless === void 0) { headless = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!fs.existsSync(filePath)) {
                            throw new Error("Recording file not found: ".concat(filePath));
                        }
                        content = fs.readFileSync(filePath, 'utf-8');
                        lines = content.split('\n').filter(function (line) { return line.trim(); });
                        if (lines.length === 0) {
                            throw new Error('Recording file is empty');
                        }
                        metadataLine = JSON.parse(lines[0]);
                        if (!metadataLine.metadata) {
                            throw new Error('Recording file missing metadata');
                        }
                        this.emit('playbackStarted', { metadata: metadataLine.metadata, speed: speed, headless: headless });
                        lastTimestamp = 0;
                        messagesPlayed = 0;
                        errors = 0;
                        _loop_1 = function (i) {
                            var message, delay_1, data, window_5, data;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        message = JSON.parse(lines[i]);
                                        if (!(!headless && lastTimestamp > 0)) return [3 /*break*/, 2];
                                        delay_1 = (message.timestamp - lastTimestamp) / speed;
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                                    case 1:
                                        _b.sent();
                                        _b.label = 2;
                                    case 2:
                                        lastTimestamp = message.timestamp;
                                        // Route message (or validate in headless mode)
                                        if (headless) {
                                            // In headless mode, just validate the message format
                                            try {
                                                if (message.messageType === 'binary') {
                                                    data = Buffer.from(message.data, 'base64');
                                                    if (data.length === 0)
                                                        throw new Error('Empty binary data');
                                                }
                                                else if (typeof message.data !== 'string') {
                                                    throw new Error('Invalid text message');
                                                }
                                                messagesPlayed++;
                                            }
                                            catch (error) {
                                                errors++;
                                                this_1.emit('playbackError', { message: message, error: error });
                                            }
                                        }
                                        else {
                                            window_5 = this_1.windows.get(message.windowId);
                                            if (window_5) {
                                                if (message.messageType === 'binary') {
                                                    data = Buffer.from(message.data, 'base64');
                                                    // CRITICAL FIX: Properly convert Buffer to Uint8Array to avoid data corruption
                                                    window_5.handler(new Uint8Array(data.buffer, data.byteOffset, data.length));
                                                }
                                                else {
                                                    window_5.handler(message.data);
                                                }
                                                messagesPlayed++;
                                            }
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        i = 1;
                        _a.label = 1;
                    case 1:
                        if (!(i < lines.length)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(i)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4:
                        this.emit('playbackCompleted', { messagesPlayed: messagesPlayed, errors: errors, headless: headless });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get list of active windows
     */
    WindowRouter.prototype.getActiveWindows = function () {
        return Array.from(this.windows.values()).map(function (w) { return (__assign({}, w.stats)); });
    };
    /**
     * Get routing statistics
     */
    WindowRouter.prototype.getRoutingStats = function () {
        return __assign({}, this.stats);
    };
    /**
     * Record a message to the buffer
     */
    WindowRouter.prototype.recordMessage = function (windowId, windowType, messageType, data) {
        var _a, _b;
        // Check sampling mode
        if ((_b = (_a = this.recordingMetadata) === null || _a === void 0 ? void 0 : _a.samplingMode) === null || _b === void 0 ? void 0 : _b.enabled) {
            this.samplingSeed++;
            if (this.samplingSeed % this.recordingMetadata.samplingMode.rate !== 0) {
                return; // Skip this message
            }
        }
        var recordedMessage = {
            timestamp: Date.now(),
            windowId: windowId,
            windowType: windowType,
            messageType: messageType,
            data: messageType === 'binary'
                ? Buffer.from(data).toString('base64')
                : data,
            size: messageType === 'binary'
                ? data.length
                : data.length
        };
        this.recordingBuffer.push(recordedMessage);
        this.recordingMessageCount++;
        // Flush if buffer is full
        if (this.recordingBuffer.length >= this.BUFFER_SIZE) {
            this.flushRecordingBuffer();
        }
    };
    /**
     * Flush recording buffer to disk
     */
    WindowRouter.prototype.flushRecordingBuffer = function () {
        if (this.recordingBuffer.length === 0 || !this.recordingStream) {
            return;
        }
        // Write all buffered messages
        for (var _i = 0, _a = this.recordingBuffer; _i < _a.length; _i++) {
            var message = _a[_i];
            this.recordingStream.write(JSON.stringify(message) + '\n');
        }
        // Clear buffer
        this.recordingBuffer = [];
    };
    /**
     * Update routing statistics
     */
    WindowRouter.prototype.updateRoutingStats = function (routingTime, data) {
        this.stats.messagesRouted++;
        // Update bytes processed
        if (typeof data === 'string') {
            this.stats.bytesProcessed += data.length;
        }
        else {
            this.stats.bytesProcessed += data.length;
        }
        // Track routing time
        this.routingTimes.push(routingTime);
        if (this.routingTimes.length > this.MAX_ROUTING_SAMPLES) {
            this.routingTimes.shift();
        }
        // Update average
        var sum = this.routingTimes.reduce(function (a, b) { return a + b; }, 0);
        this.stats.averageRoutingTime = sum / this.routingTimes.length;
        // Update peak
        if (routingTime > this.stats.peakRoutingTime) {
            this.stats.peakRoutingTime = routingTime;
        }
        // Emit warning if routing took too long
        if (routingTime > 1.0) {
            this.emit('slowRouting', { routingTime: routingTime, threshold: 1.0 });
        }
    };
    /**
     * Get logger statistics and diagnostic information
     */
    WindowRouter.prototype.getLoggerStats = function () {
        return this.logger.getStatistics();
    };
    /**
     * Generate diagnostic dump for support
     */
    WindowRouter.prototype.generateDiagnosticDump = function () {
        this.logger.info('DIAGNOSTIC', 'Generating diagnostic dump');
        return this.logger.generateDiagnosticDump();
    };
    /**
     * Save diagnostic dump to file
     */
    WindowRouter.prototype.saveDiagnosticDump = function (filePath) {
        this.logger.info('DIAGNOSTIC', 'Saving diagnostic dump to file');
        return this.logger.saveDiagnosticDump(filePath);
    };
    /**
     * Update logger configuration
     */
    WindowRouter.prototype.updateLoggerConfig = function (config) {
        this.logger.info('CONFIG', 'Updating logger configuration', config);
        this.logger.updateConfig(config);
    };
    /**
     * Get recent log entries for debugging
     */
    WindowRouter.prototype.getRecentLogEntries = function (count) {
        return this.logger.getRecentEntries(count);
    };
    /**
     * Log performance metrics
     */
    WindowRouter.prototype.logPerformanceMetrics = function () {
        var metrics = {
            routingTime: this.stats.averageRoutingTime,
            queueDepth: this.recordingBuffer.length,
            throughput: this.stats.messagesRouted,
            bytesPerSecond: this.stats.bytesProcessed,
            errorRate: this.stats.errors
        };
        this.logger.logPerformance(metrics);
    };
    /**
     * Reset singleton instance (for testing)
     */
    WindowRouter.resetInstance = function () {
        if (WindowRouter.instance) {
            WindowRouter.instance.logger.info('SHUTDOWN', 'Resetting WindowRouter instance');
            WindowRouter.instance.logger.destroy();
            WindowRouter.instance.stopRecording();
            WindowRouter.instance.windows.clear();
            WindowRouter.instance = null;
        }
    };
    WindowRouter.instance = null;
    return WindowRouter;
}(events_1.EventEmitter));
exports.WindowRouter = WindowRouter;
