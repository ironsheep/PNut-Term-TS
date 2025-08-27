/** @format */
// this is our common logging mechanism
//  Now context/runtime option aware
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
var Logger = /** @class */ (function () {
    function Logger() {
        this.verboseEnabled = false;
        this.debugEnabled = false;
        this.programName = "{notSet}";
    }
    Logger.prototype.setContext = function (context) {
        this.context = context;
    };
    Logger.prototype.setProgramName = function (name) {
        this.programName = name;
    };
    Logger.prototype.shouldLog = function (level) {
        if (!this.context || !this.context.runEnvironment.loggingEnabled) {
            return level === 'ERROR'; // Always log errors
        }
        var levels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
        var configuredLevel = this.context.runEnvironment.loggingLevel;
        var configuredIndex = levels.indexOf(configuredLevel);
        var requestedIndex = levels.indexOf(level);
        return requestedIndex <= configuredIndex;
    };
    Logger.prototype.enabledVerbose = function () {
        this.progressMsg("Verbose output is enabled");
        this.verboseEnabled = true;
    };
    Logger.prototype.enabledDebug = function () {
        this.progressMsg("Debug output is enabled");
        this.debugEnabled = true;
    };
    Logger.prototype.errorMsg = function (message) {
        if (this.shouldLog('ERROR')) {
            var redMessage = this.errorColor(message);
            this.logErrorMessage("".concat(this.programName, ": ERROR- ").concat(redMessage));
        }
    };
    Logger.prototype.compilerErrorMsg = function (message, underTest) {
        if (underTest === void 0) { underTest = false; }
        if (typeof message !== "string") {
            this.logMessage("* compilerErrorMsg() - message is ".concat(typeof message));
        }
        var redMessage = underTest ? message : this.errorColor(message);
        if (typeof redMessage !== "string") {
            this.logMessage("* compilerErrorMsg() - redMessage is ".concat(typeof redMessage));
        }
        this.logErrorMessage("".concat(redMessage));
    };
    Logger.prototype.verboseMsg = function (message) {
        if (this.verboseEnabled && this.shouldLog('DEBUG')) {
            if (message.length == 0) {
                this.logMessage(""); // blank line
            }
            else {
                this.logMessage("".concat(this.programName, ": Verbose- ").concat(message));
            }
        }
    };
    Logger.prototype.debugMsg = function (message) {
        if (this.debugEnabled && this.shouldLog('DEBUG')) {
            if (message.length == 0) {
                this.logMessage(""); // blank line
            }
            else {
                this.logMessage("".concat(this.programName, " (DBG): ").concat(message));
            }
        }
    };
    Logger.prototype.infoMsg = function (message) {
        if (this.shouldLog('INFO')) {
            this.logMessage("".concat(this.programName, ": ").concat(message));
        }
    };
    Logger.prototype.warningMsg = function (message) {
        if (this.shouldLog('WARN')) {
            var yellowMessage = this.warningColor(message);
            this.logErrorMessage("".concat(this.programName, ": WARNING- ").concat(yellowMessage));
        }
    };
    Logger.prototype.progressMsg = function (message) {
        if (this.shouldLog('INFO')) {
            this.logMessage("".concat(this.programName, ": ").concat(message));
        }
    };
    Logger.prototype.errorColor = function (str) {
        // Add ANSI escape codes to display text in red.
        return "\u001B[31m".concat(str, "\u001B[0m");
    };
    Logger.prototype.warningColor = function (str) {
        // Add ANSI escape codes to display text in yellow.
        return "\u001B[33m".concat(str, "\u001B[0m");
    };
    /**
     * Write message to stdout with trailing CRLF
     *
     * @param {string} message
     * @memberof Logger
     */
    Logger.prototype.logMessage = function (message) {
        // Only log if context is not set, or if logging is enabled
        if (!this.context || this.context.runEnvironment.loggingEnabled) {
            if (!this.context || this.context.runEnvironment.logToConsole) {
                process.stdout.write("".concat(message, "\r\n"));
            }
            // TODO: Add file logging support when logToFile is true
        }
    };
    /**
     * Write message to stderr with trailing CRLF
     *
     * @param {string} message
     * @memberof Logger
     */
    Logger.prototype.logErrorMessage = function (message) {
        if (typeof message !== "string") {
            this.logMessage("* logErrorMessage() - message is ".concat(typeof message));
        }
        // Errors should always be logged regardless of logging settings
        process.stderr.write("".concat(message, "\r\n"));
    };
    /**
     * Force write message to stdout with trailing CRLF, bypassing all logging flags
     * Used for system startup messages that should always appear in console
     *
     * @param {string} message
     * @memberof Logger
     */
    Logger.prototype.forceLogMessage = function (message) {
        if (typeof message !== "string") {
            process.stdout.write("* forceLogMessage() - message is ".concat(typeof message, "\r\n"));
            return;
        }
        // System messages should always be logged to console regardless of settings
        process.stdout.write("".concat(message, "\r\n"));
    };
    return Logger;
}());
exports.Logger = Logger;
