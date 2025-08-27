/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */
// Common runtime context shares by classes in Pnut-TS.
// src/utils/context.ts
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var logger_1 = require("../classes/logger");
var Context = /** @class */ (function () {
    function Context() {
        this.runEnvironment = {
            selectedPropPlug: '',
            serialPortDevices: [],
            developerModeEnabled: false,
            logFilename: '',
            debugBaudrate: 2000000,
            ideMode: false,
            rtsOverride: false, // Default to DTR unless IDE specifies RTS
            loggingEnabled: false, // Default to false for production
            loggingLevel: 'INFO', // Default log level
            logToFile: false,
            logToConsole: true,
            verbose: false,
            quiet: false,
            consoleMode: false // Default to no console delay
        };
        this.actions = {
            writeRAM: false,
            writeFlash: false,
            binFilename: '',
            binDirspec: ''
        };
        var possiblePath = path_1.default.join(__dirname, '../lib');
        if (!fs_1.default.existsSync(possiblePath)) {
            possiblePath = path_1.default.join(__dirname, 'lib');
        }
        this.libraryFolder = possiblePath;
        possiblePath = path_1.default.join(__dirname, '../ext');
        if (!fs_1.default.existsSync(possiblePath)) {
            possiblePath = path_1.default.join(__dirname, 'ext');
        }
        this.extensionFolder = possiblePath;
        this.currentFolder = process.cwd();
        this.logger = new logger_1.Logger();
        this.logger.setContext(this);
    }
    return Context;
}());
exports.Context = Context;
