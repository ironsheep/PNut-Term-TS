"use strict";
/** @format */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouterLogger = exports.LogLevel = void 0;
// src/classes/shared/routerLogger.ts
var fs = require("fs");
var path = require("path");
/**
 * Log levels in order of severity
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["TRACE"] = 0] = "TRACE";
    LogLevel[LogLevel["DEBUG"] = 1] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["WARN"] = 3] = "WARN";
    LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * RouterLogger - High-performance logging for WindowRouter
 *
 * This logger is designed specifically for the WindowRouter's needs:
 * - Never blocks routing operations
 * - Configurable log levels
 * - Circular buffer for recent messages
 * - Optional file output with buffering
 * - Performance metrics tracking
 * - Diagnostic dump functionality
 *
 * The logger uses async writes and buffering to ensure routing
 * performance is never impacted by logging operations.
 */
var RouterLogger = /** @class */ (function () {
    function RouterLogger(config) {
        if (config === void 0) { config = {}; }
        this.buffer = [];
        this.circularBuffer = [];
        this.circularIndex = 0;
        this.fileStream = null;
        this.flushTimer = null;
        this.isEnabled = false;
        // Performance tracking
        this.metricsBuffer = [];
        this.lastMetricsTime = 0;
        this.messageCount = 0;
        this.byteCount = 0;
        this.errorCount = 0;
        this.config = __assign({ level: LogLevel.INFO, console: true, file: false, maxBufferSize: 1000, flushInterval: 100, circularBufferSize: 10000 }, config);
        // Check environment variables for configuration
        this.loadEnvironmentConfig();
        // Initialize file logging if enabled
        if (this.config.file) {
            this.initializeFileLogging();
        }
        // Start flush timer
        this.startFlushTimer();
        this.isEnabled = this.shouldLog(LogLevel.TRACE);
    }
    /**
     * Load configuration from environment variables
     */
    RouterLogger.prototype.loadEnvironmentConfig = function () {
        // ROUTER_LOG_LEVEL: TRACE, DEBUG, INFO, WARN, ERROR
        var envLevel = process.env.ROUTER_LOG_LEVEL;
        if (envLevel) {
            var level = LogLevel[envLevel.toUpperCase()];
            if (level !== undefined) {
                this.config.level = level;
            }
        }
        // ROUTER_LOG_CONSOLE: true/false
        var envConsole = process.env.ROUTER_LOG_CONSOLE;
        if (envConsole !== undefined) {
            this.config.console = envConsole.toLowerCase() === 'true';
        }
        // ROUTER_LOG_FILE: true/false
        var envFile = process.env.ROUTER_LOG_FILE;
        if (envFile !== undefined) {
            this.config.file = envFile.toLowerCase() === 'true';
        }
        // ROUTER_LOG_PATH: file path
        var envPath = process.env.ROUTER_LOG_PATH;
        if (envPath) {
            this.config.filePath = envPath;
        }
    };
    /**
     * Initialize file logging
     */
    RouterLogger.prototype.initializeFileLogging = function () {
        var _this = this;
        var logDir = path.dirname(this.getLogFilePath());
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.fileStream = fs.createWriteStream(this.getLogFilePath(), {
            flags: 'a',
            encoding: 'utf8'
        });
        this.fileStream.on('error', function (error) {
            console.error('RouterLogger: File stream error:', error);
            _this.config.file = false; // Disable file logging on error
        });
    };
    /**
     * Get log file path
     */
    RouterLogger.prototype.getLogFilePath = function () {
        if (this.config.filePath) {
            return this.config.filePath;
        }
        var timestamp = new Date().toISOString().split('T')[0];
        return path.join(process.cwd(), 'logs', "router-".concat(timestamp, ".log"));
    };
    /**
     * Start flush timer
     */
    RouterLogger.prototype.startFlushTimer = function () {
        var _this = this;
        this.flushTimer = setInterval(function () {
            _this.flushBuffer();
        }, this.config.flushInterval);
    };
    /**
     * Check if a log level should be logged
     */
    RouterLogger.prototype.shouldLog = function (level) {
        return level >= this.config.level;
    };
    /**
     * Log a message at TRACE level
     */
    RouterLogger.prototype.trace = function (category, message, data) {
        this.log(LogLevel.TRACE, category, message, data);
    };
    /**
     * Log a message at DEBUG level
     */
    RouterLogger.prototype.debug = function (category, message, data) {
        this.log(LogLevel.DEBUG, category, message, data);
    };
    /**
     * Log a message at INFO level
     */
    RouterLogger.prototype.info = function (category, message, data) {
        this.log(LogLevel.INFO, category, message, data);
    };
    /**
     * Log a message at WARN level
     */
    RouterLogger.prototype.warn = function (category, message, data) {
        this.log(LogLevel.WARN, category, message, data);
    };
    /**
     * Log a message at ERROR level
     */
    RouterLogger.prototype.error = function (category, message, data) {
        this.log(LogLevel.ERROR, category, message, data);
    };
    /**
     * Log a routing operation
     */
    RouterLogger.prototype.logRouting = function (windowId, messageType, size, routingTime) {
        if (!this.shouldLog(LogLevel.DEBUG))
            return;
        this.log(LogLevel.DEBUG, 'ROUTING', "".concat(messageType, " -> ").concat(windowId, " (").concat(size, "B, ").concat(routingTime.toFixed(2), "ms)"), {
            windowId: windowId,
            messageType: messageType,
            size: size,
            routingTime: routingTime
        });
        // Update performance metrics
        this.messageCount++;
        this.byteCount += size;
    };
    /**
     * Log a performance metric
     */
    RouterLogger.prototype.logPerformance = function (metrics) {
        if (!this.shouldLog(LogLevel.INFO))
            return;
        this.log(LogLevel.INFO, 'PERFORMANCE', "Routing: ".concat(metrics.routingTime.toFixed(2), "ms, Queue: ").concat(metrics.queueDepth, ", ") +
            "Throughput: ".concat(metrics.throughput.toFixed(1), " msg/s, ").concat((metrics.bytesPerSecond / 1024).toFixed(1), " KB/s"), metrics);
        // Store in metrics buffer
        this.metricsBuffer.push(metrics);
        if (this.metricsBuffer.length > 100) {
            this.metricsBuffer.shift();
        }
    };
    /**
     * Log an error
     */
    RouterLogger.prototype.logError = function (category, error, context) {
        this.errorCount++;
        this.log(LogLevel.ERROR, category, error.message, {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context: context
        });
    };
    /**
     * Core logging method
     */
    RouterLogger.prototype.log = function (level, category, message, data) {
        var _this = this;
        if (!this.shouldLog(level))
            return;
        var entry = {
            timestamp: Date.now(),
            level: level,
            category: category,
            message: message,
            data: data
        };
        // Add to circular buffer (always, for debugging)
        this.addToCircularBuffer(entry);
        // Add to main buffer for output
        this.buffer.push(entry);
        // Immediate console output for high-priority messages
        if (level >= LogLevel.WARN && this.config.console) {
            this.outputToConsole(entry);
        }
        // Flush if buffer is full
        if (this.buffer.length >= this.config.maxBufferSize) {
            setImmediate(function () { return _this.flushBuffer(); });
        }
    };
    /**
     * Add entry to circular buffer
     */
    RouterLogger.prototype.addToCircularBuffer = function (entry) {
        this.circularBuffer[this.circularIndex] = entry;
        this.circularIndex = (this.circularIndex + 1) % this.config.circularBufferSize;
    };
    /**
     * Output entry to console
     */
    RouterLogger.prototype.outputToConsole = function (entry) {
        var timestamp = new Date(entry.timestamp).toISOString();
        var levelName = LogLevel[entry.level].padEnd(5);
        var message = "".concat(timestamp, " [").concat(levelName, "] ").concat(entry.category, ": ").concat(entry.message);
        switch (entry.level) {
            case LogLevel.ERROR:
                console.error(message, entry.data || '');
                break;
            case LogLevel.WARN:
                console.warn(message, entry.data || '');
                break;
            case LogLevel.INFO:
                console.info(message, entry.data || '');
                break;
            case LogLevel.DEBUG:
            case LogLevel.TRACE:
                console.debug(message, entry.data || '');
                break;
        }
    };
    /**
     * Flush buffer to outputs
     */
    RouterLogger.prototype.flushBuffer = function () {
        if (this.buffer.length === 0)
            return;
        var entries = this.buffer.splice(0); // Clear buffer atomically
        // Console output (if not already output)
        if (this.config.console) {
            for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                var entry = entries_1[_i];
                if (entry.level < LogLevel.WARN) { // High-priority already output
                    this.outputToConsole(entry);
                }
            }
        }
        // File output
        if (this.config.file && this.fileStream && this.fileStream.writable) {
            for (var _a = 0, entries_2 = entries; _a < entries_2.length; _a++) {
                var entry = entries_2[_a];
                var line = this.formatLogLine(entry);
                this.fileStream.write(line + '\n');
            }
        }
    };
    /**
     * Format log entry for file output
     */
    RouterLogger.prototype.formatLogLine = function (entry) {
        var timestamp = new Date(entry.timestamp).toISOString();
        var levelName = LogLevel[entry.level].padEnd(5);
        var line = "".concat(timestamp, " [").concat(levelName, "] ").concat(entry.category, ": ").concat(entry.message);
        if (entry.data) {
            try {
                line += ' | ' + JSON.stringify(entry.data);
            }
            catch (error) {
                line += ' | [Unserializable data]';
            }
        }
        return line;
    };
    /**
     * Get recent log entries from circular buffer
     */
    RouterLogger.prototype.getRecentEntries = function (count) {
        var maxCount = count || this.config.circularBufferSize;
        var entries = [];
        // Start from oldest entry in circular buffer
        var index = this.circularIndex;
        for (var i = 0; i < Math.min(maxCount, this.config.circularBufferSize); i++) {
            var entry = this.circularBuffer[index];
            if (entry) {
                entries.push(entry);
            }
            index = (index + 1) % this.config.circularBufferSize;
        }
        return entries.sort(function (a, b) { return a.timestamp - b.timestamp; });
    };
    /**
     * Generate diagnostic dump
     */
    RouterLogger.prototype.generateDiagnosticDump = function () {
        var dump = {
            timestamp: new Date().toISOString(),
            config: this.config,
            statistics: {
                totalMessages: this.messageCount,
                totalBytes: this.byteCount,
                totalErrors: this.errorCount,
                bufferSize: this.buffer.length,
                circularBufferUsage: this.circularIndex
            },
            recentMetrics: this.metricsBuffer.slice(-10),
            recentEntries: this.getRecentEntries(50)
        };
        return JSON.stringify(dump, null, 2);
    };
    /**
     * Save diagnostic dump to file
     */
    RouterLogger.prototype.saveDiagnosticDump = function (filePath) {
        var dump = this.generateDiagnosticDump();
        var outputPath = filePath || path.join(process.cwd(), 'logs', "router-diagnostic-".concat(Date.now(), ".json"));
        // Ensure directory exists
        var dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, dump, 'utf8');
        return outputPath;
    };
    /**
     * Get current statistics
     */
    RouterLogger.prototype.getStatistics = function () {
        return {
            totalMessages: this.messageCount,
            totalBytes: this.byteCount,
            totalErrors: this.errorCount,
            bufferSize: this.buffer.length,
            circularBufferUsage: this.circularIndex,
            averageMetrics: this.calculateAverageMetrics(),
            isEnabled: this.isEnabled,
            config: __assign({}, this.config)
        };
    };
    /**
     * Calculate average metrics
     */
    RouterLogger.prototype.calculateAverageMetrics = function () {
        if (this.metricsBuffer.length === 0) {
            return null;
        }
        var sum = this.metricsBuffer.reduce(function (acc, metrics) { return ({
            routingTime: acc.routingTime + metrics.routingTime,
            queueDepth: acc.queueDepth + metrics.queueDepth,
            throughput: acc.throughput + metrics.throughput,
            bytesPerSecond: acc.bytesPerSecond + metrics.bytesPerSecond,
            errorRate: acc.errorRate + metrics.errorRate
        }); }, { routingTime: 0, queueDepth: 0, throughput: 0, bytesPerSecond: 0, errorRate: 0 });
        var count = this.metricsBuffer.length;
        return {
            routingTime: sum.routingTime / count,
            queueDepth: sum.queueDepth / count,
            throughput: sum.throughput / count,
            bytesPerSecond: sum.bytesPerSecond / count,
            errorRate: sum.errorRate / count
        };
    };
    /**
     * Update configuration
     */
    RouterLogger.prototype.updateConfig = function (newConfig) {
        var oldConfig = __assign({}, this.config);
        this.config = __assign(__assign({}, this.config), newConfig);
        // Reinitialize file logging if needed
        if (!oldConfig.file && this.config.file) {
            this.initializeFileLogging();
        }
        else if (oldConfig.file && !this.config.file && this.fileStream) {
            this.fileStream.end();
            this.fileStream = null;
        }
        this.isEnabled = this.shouldLog(LogLevel.TRACE);
    };
    /**
     * Cleanup and close logger
     */
    RouterLogger.prototype.destroy = function () {
        // Flush remaining buffer
        this.flushBuffer();
        // Clear timer
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        // Close file stream
        if (this.fileStream) {
            this.fileStream.end();
            this.fileStream = null;
        }
        // Clear buffers
        this.buffer = [];
        this.circularBuffer = [];
        this.metricsBuffer = [];
    };
    return RouterLogger;
}());
exports.RouterLogger = RouterLogger;
