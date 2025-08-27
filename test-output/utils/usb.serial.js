/* eslint-disable @typescript-eslint/no-unused-vars */
'use strict';
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
exports.UsbSerial = void 0;
var serialport_1 = require("serialport");
var parser_readline_1 = require("@serialport/parser-readline");
var timerUtils_1 = require("./timerUtils");
var events_1 = require("events");
var DEFAULT_DOWNLOAD_BAUD = 2000000;
var UsbSerial = /** @class */ (function (_super) {
    __extends(UsbSerial, _super);
    function UsbSerial(ctx, deviceNode) {
        var _this = _super.call(this) || this;
        _this.endOfLineStr = '\r\n';
        _this._deviceNode = '';
        _this._downloadBaud = DEFAULT_DOWNLOAD_BAUD;
        _this._p2DeviceId = '';
        _this._p2loadLimit = 0;
        _this._latestError = '';
        _this._dtrValue = false;
        _this._rtsValue = false;
        _this._downloadChecksumGood = false;
        _this._downloadResponse = '';
        _this.checkedForP2 = false;
        _this.context = ctx;
        _this._deviceNode = deviceNode;
        if (_this.context.runEnvironment.loggingEnabled) {
            _this.logMessage('Spin/Spin2 USB.Serial log started.');
        }
        _this.logMessage("* Connecting to ".concat(_this._deviceNode));
        _this._serialPort = new serialport_1.SerialPort({
            path: _this._deviceNode,
            baudRate: UsbSerial.desiredCommsBaudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: false
        });
        // Open errors will be emitted as an error event
        _this._serialPort.on('error', function (err) { return _this.handleSerialError(err.message); });
        _this._serialPort.on('open', function () { return _this.handleSerialOpen(); });
        // For MainWindow: Get RAW data (not parsed) so we can detect binary debugger protocol
        // The parser is still needed for internal P2 version checking, but MainWindow needs raw bytes
        _this._serialPort.on('data', function (data) {
            // Emit raw data for MainWindow to handle (can be binary or text)
            _this.emit('data', data);
        });
        // Also set up parser for internal use (P2 version detection, etc)
        _this._serialParser = _this._serialPort.pipe(new parser_readline_1.ReadlineParser({ delimiter: _this.endOfLineStr }));
        _this._serialParser.on('data', function (data) { return _this.handleSerialRxInternal(data); });
        // now open the port
        _this._serialPort.open(function (err) {
            if (err) {
                _this.handleSerialError(err.message);
            }
        });
        return _this;
    }
    // Dispose method
    /*
    private dispose(): void {
      if (this._serialPort) {
        // Remove all listeners to prevent memory leaks
        this._serialPort.removeAllListeners();
  
        // Set the port to null
        this._serialPort = null;
      }
    }
    */
    // ----------------------------------------------------------------------------
    //   CLASS Methods (static)
    // ----------------------------------------------------------------------------
    //
    UsbSerial.setCommBaudRate = function (baudRate) {
        UsbSerial.desiredCommsBaudRate = baudRate;
    };
    UsbSerial.serialDeviceList = function (ctx) {
        return __awaiter(this, void 0, void 0, function () {
            var devicesFound, ports;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        devicesFound = [];
                        return [4 /*yield*/, serialport_1.SerialPort.list()];
                    case 1:
                        ports = _a.sent();
                        ports.forEach(function (port) {
                            var tmpSerialNumber = port.serialNumber;
                            var serialNumber = tmpSerialNumber !== undefined ? tmpSerialNumber : '{unknownSN}';
                            var deviceNode = port.path;
                            if (port.vendorId == '0403' && port.productId == '6015') {
                                devicesFound.push("".concat(deviceNode, ",").concat(serialNumber));
                            }
                        });
                        return [2 /*return*/, devicesFound];
                }
            });
        });
    };
    Object.defineProperty(UsbSerial.prototype, "deviceError", {
        // ----------------------------------------------------------------------------
        //   PUBLIC Instance Methods
        // ----------------------------------------------------------------------------
        //
        get: function () {
            var desiredText = undefined;
            if (this._latestError.length > 0) {
                desiredText = this._latestError;
            }
            return desiredText;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(UsbSerial.prototype, "deviceInfo", {
        get: function () {
            return this._p2DeviceId;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(UsbSerial.prototype, "foundP2", {
        get: function () {
            return this._p2DeviceId === '' ? false : true;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(UsbSerial.prototype, "usbConnected", {
        get: function () {
            return this._serialPort.isOpen;
        },
        enumerable: false,
        configurable: true
    });
    UsbSerial.prototype.getIdStringOrError = function () {
        return [this._p2DeviceId, this._latestError];
    };
    UsbSerial.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // (alternate suggested by perplexity search)
                        // release the usb port
                        this.logMessage("* USBSer closing...");
                        if (!(this._serialPort && this._serialPort.isOpen)) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, timerUtils_1.waitMSec)(10)];
                    case 1:
                        _a.sent(); // 500 allowed prop to restart? use 10 mSec instead
                        _a.label = 2;
                    case 2:
                        // Remove all listeners to prevent memory leaks and allow port to be reused
                        this._serialPort.removeAllListeners();
                        return [2 /*return*/, new Promise(function (resolve, reject) {
                                if (_this._serialPort && _this._serialPort.isOpen) {
                                    _this._serialPort.close(function (err) {
                                        if (err) {
                                            _this.logMessage("  -- close() Error: ".concat(err.message));
                                            reject(err);
                                        }
                                        else {
                                            _this.logMessage("  -- close() - port close: isOpen=(".concat(_this._serialPort.isOpen, ")"));
                                            resolve();
                                        }
                                    });
                                }
                                else if (!_this._serialPort.isOpen) {
                                    _this.logMessage("  -- close() ?? port already closed ??");
                                    resolve();
                                }
                                else {
                                    _this.logMessage("  -- close() ?? no port to close ??");
                                    resolve();
                                }
                                _this.logMessage("* USBSer closed");
                            })];
                }
            });
        });
    };
    UsbSerial.prototype.deviceIsPropellerV2 = function () {
        return __awaiter(this, void 0, void 0, function () {
            var didCheck, foundPropellerStatus, _a, deviceString, deviceErrorString;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.requestPropellerVersion()];
                    case 1:
                        didCheck = _b.sent();
                        foundPropellerStatus = this.foundP2;
                        if (!didCheck) return [3 /*break*/, 3];
                        return [4 /*yield*/, (0, timerUtils_1.waitMSec)(200)];
                    case 2:
                        _b.sent(); // wait 0.2 sec for response (usually takes 0.09 sec)
                        _a = this.getIdStringOrError(), deviceString = _a[0], deviceErrorString = _a[1];
                        if (deviceErrorString.length > 0) {
                            this.logMessage("* deviceIsPropeller() ERROR: ".concat(deviceErrorString));
                        }
                        else if (deviceString.length > 0 && deviceErrorString.length == 0) {
                            foundPropellerStatus = true;
                        }
                        _b.label = 3;
                    case 3:
                        this.logMessage("* deviceIsPropeller() -> (".concat(foundPropellerStatus, ")"));
                        return [2 /*return*/, foundPropellerStatus];
                }
            });
        });
    };
    UsbSerial.prototype.downloadNoCheck = function (uint8Bytes) {
        return __awaiter(this, void 0, void 0, function () {
            var requestStartDownload, byteCount, dataBase64, LINE_LENGTH, lineCount, lastLineLength, index, lineLength, singleLine;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestStartDownload = '> Prop_Txt 0 0 0 0';
                        byteCount = uint8Bytes.length < this._p2loadLimit ? uint8Bytes.length : this._p2loadLimit;
                        if (!(this.usbConnected && uint8Bytes.length > 0)) return [3 /*break*/, 7];
                        dataBase64 = Buffer.from(uint8Bytes).toString('base64');
                        return [4 /*yield*/, this.write("".concat(requestStartDownload, "\r"))];
                    case 1:
                        _a.sent();
                        LINE_LENGTH = 1024;
                        lineCount = dataBase64.length + LINE_LENGTH - 1 / LINE_LENGTH;
                        lastLineLength = dataBase64.length % LINE_LENGTH;
                        index = 0;
                        _a.label = 2;
                    case 2:
                        if (!(index < lineCount)) return [3 /*break*/, 5];
                        lineLength = index == lineCount - 1 ? lastLineLength : LINE_LENGTH;
                        singleLine = dataBase64.substring(index * LINE_LENGTH, index * LINE_LENGTH + lineLength);
                        return [4 /*yield*/, this.write('>' + singleLine)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        index++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, this.write(' ~\r')];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    UsbSerial.prototype.download = function (uint8Bytes, needsP2CheckumVerify) {
        return __awaiter(this, void 0, void 0, function () {
            var requestStartDownload, byteCount, didOpen, dataBase64, LINE_LENGTH, lineCount, lastLineLength, dumpBytes, index, lineLength, singleLine, READ_RETRY_COUNT, readValue, retryCount, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // reset our status indicators
                        this._downloadChecksumGood = false;
                        this._downloadResponse = '';
                        requestStartDownload = '> Prop_Txt 0 0 0 0';
                        byteCount = uint8Bytes.length < this._p2loadLimit ? uint8Bytes.length : this._p2loadLimit;
                        this.logMessage("* download() - port open (".concat(this._serialPort.isOpen, ")"));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 14, , 15]);
                        return [4 /*yield*/, this.waitForPortOpen()];
                    case 2:
                        didOpen = _a.sent();
                        this.logMessage("* download() port opened = (".concat(didOpen, ") "));
                        if (!(this.usbConnected && uint8Bytes.length > 0)) return [3 /*break*/, 13];
                        dataBase64 = Buffer.from(uint8Bytes).toString('base64').replace(/=+$/, '');
                        LINE_LENGTH = 512;
                        lineCount = Math.ceil(dataBase64.length / LINE_LENGTH);
                        lastLineLength = dataBase64.length % LINE_LENGTH;
                        // log what we are sending (or first part of it)
                        this.dumpBytes(uint8Bytes, 0, 99, 'download-source');
                        dumpBytes = dataBase64.length < 100 ? dataBase64 : "".concat(dataBase64.substring(0, 99), "...");
                        this.logMessage("* download() SENDING [".concat(dumpBytes, "](").concat(dataBase64.length, ")"));
                        // * Now do the download
                        return [4 /*yield*/, this.write("".concat(requestStartDownload, "\r"))];
                    case 3:
                        // * Now do the download
                        _a.sent();
                        index = 0;
                        _a.label = 4;
                    case 4:
                        if (!(index < lineCount)) return [3 /*break*/, 7];
                        lineLength = index == lineCount - 1 ? lastLineLength : LINE_LENGTH;
                        singleLine = dataBase64.substring(index * LINE_LENGTH, index * LINE_LENGTH + lineLength);
                        return [4 /*yield*/, this.write('>' + singleLine)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        index++;
                        return [3 /*break*/, 4];
                    case 7:
                        if (!needsP2CheckumVerify) return [3 /*break*/, 11];
                        READ_RETRY_COUNT = 100;
                        this.stopReadListener();
                        this.write('?'); // removed AWAIT to allow read to happen earlier
                        readValue = '';
                        retryCount = READ_RETRY_COUNT;
                        _a.label = 8;
                    case 8:
                        if (!(null === (readValue = this._serialPort.read(1)) && --retryCount > 0)) return [3 /*break*/, 10];
                        return [4 /*yield*/, (0, timerUtils_1.waitMSec)(1)];
                    case 9:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 10:
                        //const response = await this._serialPort.read(1);
                        //const statusMsg: string = this._downloadChecksumGood ? 'Checksum OK' : 'Checksum BAD';
                        this.startReadListener();
                        this.logMessage("* download(RAM) end w/[".concat(readValue, "]"));
                        return [3 /*break*/, 13];
                    case 11: return [4 /*yield*/, this.write('~')];
                    case 12:
                        _a.sent();
                        _a.label = 13;
                    case 13: return [3 /*break*/, 15];
                    case 14:
                        error_1 = _a.sent();
                        this.logMessage("* download() ERROR: ".concat(JSON.stringify(error_1, null, 2)));
                        return [3 /*break*/, 15];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    UsbSerial.prototype.write = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                //this.logMessage(`--> Tx ...`);
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        if (_this.usbConnected) {
                            _this._serialPort.write(value, function (err) {
                                if (err)
                                    reject(err);
                                else {
                                    _this.logMessage("--> Tx [".concat(value.split(/\r?\n/).filter(Boolean)[0], "]"));
                                    resolve();
                                }
                            });
                        }
                    })];
            });
        });
    };
    // ----------------------------------------------------------------------------
    //   PRIVATE Instance Methods
    // ----------------------------------------------------------------------------
    //
    UsbSerial.prototype.handleSerialError = function (errMessage) {
        this.logMessage("* handleSerialError() Error: ".concat(errMessage));
        this._latestError = errMessage;
    };
    UsbSerial.prototype.handleSerialOpen = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.context.runEnvironment.ideMode && this.context.runEnvironment.rtsOverride)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.toggleRTS()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.toggleDTR()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Internal handler for parsed text data (used for P2 version detection)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    UsbSerial.prototype.handleSerialRxInternal = function (data) {
        this.logMessage("<-- Rx [".concat(data, "]"));
        // Don't emit here - raw data is emitted directly from serial port
        var lines = data.split(/\r?\n/).filter(Boolean);
        var propFound = false;
        if (lines.length > 0) {
            for (var index = 0; index < lines.length; index++) {
                var replyString = 'Prop_Ver ';
                var currLine = lines[index];
                if (currLine.startsWith(replyString) && currLine.length == 10) {
                    this.logMessage("  -- REPLY [".concat(currLine, "](").concat(currLine.length, ")"));
                    var idLetter = currLine.charAt(replyString.length);
                    this._p2DeviceId = this.descriptionForVerLetter(idLetter);
                    this._p2loadLimit = this.limitForVerLetter(idLetter);
                    propFound = true;
                    break;
                }
            }
        }
        if (propFound == true) {
            // log findings...
            this.logMessage("* FOUND Prop: [".concat(this._p2DeviceId, "]"));
        }
    };
    UsbSerial.prototype.setDTR = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Set the DTR line state
                        if (!this._serialPort || !this._serialPort.isOpen) {
                            throw new Error('Serial port is not open');
                        }
                        return [4 /*yield*/, this.setDtr(value)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    UsbSerial.prototype.setRTS = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Set the RTS line state
                        if (!this._serialPort || !this._serialPort.isOpen) {
                            throw new Error('Serial port is not open');
                        }
                        return [4 /*yield*/, this.setRts(value)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    UsbSerial.prototype.toggleDTR = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // toggle the propPlug DTR line
                        this.logMessage("* toggleDTR() - port open (".concat(this._serialPort.isOpen, ")"));
                        return [4 /*yield*/, (0, timerUtils_1.waitSec)(1)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.setDtr(true)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, timerUtils_1.waitSec)(1)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.setDtr(false)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    UsbSerial.prototype.toggleRTS = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // toggle the propPlug RTS line
                        this.logMessage("* toggleRTS() - port open (".concat(this._serialPort.isOpen, ")"));
                        return [4 /*yield*/, (0, timerUtils_1.waitSec)(1)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.setRts(true)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, timerUtils_1.waitSec)(1)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.setRts(false)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    UsbSerial.prototype.startReadListener = function () {
        var _this = this;
        // wait for any returned data
        this._serialParser.on('data', function (data) { return _this.handleSerialRxInternal(data); });
    };
    UsbSerial.prototype.stopReadListener = function () {
        var _this = this;
        // stop waiting for any returned data
        this._serialParser.off('data', function (data) { return _this.handleSerialRxInternal(data); });
    };
    UsbSerial.prototype.requestP2IDString = function () {
        return __awaiter(this, void 0, void 0, function () {
            var requestPropType;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestPropType = '> Prop_Chk 0 0 0 0';
                        this.logMessage("* requestP2IDString() - port open (".concat(this._serialPort.isOpen, ")"));
                        return [4 /*yield*/, (0, timerUtils_1.waitSec)(1)];
                    case 1:
                        _a.sent();
                        if (!(this.context.runEnvironment.ideMode && this.context.runEnvironment.rtsOverride)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.setRts(true)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, timerUtils_1.waitSec)(1)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.setRts(false)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 5: return [4 /*yield*/, this.setDtr(true)];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, (0, timerUtils_1.waitSec)(1)];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, this.setDtr(false)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9: 
                    //this.logMessage(`  -- plug reset!`);
                    // NO wait yields a 1.5 mSec delay on my mac Studio
                    // NOTE: if nothing sent, and Edge Module default switch settings, the prop will boot in 142 mSec
                    return [4 /*yield*/, (0, timerUtils_1.waitMSec)(15)];
                    case 10:
                        //this.logMessage(`  -- plug reset!`);
                        // NO wait yields a 1.5 mSec delay on my mac Studio
                        // NOTE: if nothing sent, and Edge Module default switch settings, the prop will boot in 142 mSec
                        _a.sent();
                        return [4 /*yield*/, this.write("".concat(requestPropType, "\r"))];
                    case 11: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    UsbSerial.prototype.requestPropellerVersion = function () {
        return __awaiter(this, void 0, void 0, function () {
            var requestPropType, didCheck, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestPropType = '> Prop_Chk 0 0 0 0';
                        didCheck = this.checkedForP2 == false;
                        if (!(this.checkedForP2 == false)) return [3 /*break*/, 15];
                        this.logMessage("* requestPropellerVersion() - port open (".concat(this._serialPort.isOpen, ")"));
                        this.checkedForP2 = true;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 14, , 15]);
                        return [4 /*yield*/, this.waitForPortOpen()];
                    case 2:
                        _a.sent();
                        // continue with ID effort...
                        return [4 /*yield*/, (0, timerUtils_1.waitMSec)(250)];
                    case 3:
                        // continue with ID effort...
                        _a.sent();
                        if (!(this.context.runEnvironment.ideMode && this.context.runEnvironment.rtsOverride)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.setRts(true)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, timerUtils_1.waitMSec)(10)];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, this.setRts(false)];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 11];
                    case 7: return [4 /*yield*/, this.setDtr(true)];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, (0, timerUtils_1.waitMSec)(10)];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, this.setDtr(false)];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11: 
                    // Fm Silicon Doc:
                    //   Unless preempted by a program in a SPI memory chip with a pull-up resistor on P60 (SPI_CK), the
                    //     serial loader becomes active within 15ms of reset being released.
                    //
                    //   If nothing sent, and Edge Module default switch settings, the prop will boot in 142 mSec
                    //
                    // NO wait yields a 102 mSec delay on my mac Studio
                    return [4 /*yield*/, (0, timerUtils_1.waitMSec)(15)];
                    case 12:
                        // Fm Silicon Doc:
                        //   Unless preempted by a program in a SPI memory chip with a pull-up resistor on P60 (SPI_CK), the
                        //     serial loader becomes active within 15ms of reset being released.
                        //
                        //   If nothing sent, and Edge Module default switch settings, the prop will boot in 142 mSec
                        //
                        // NO wait yields a 102 mSec delay on my mac Studio
                        _a.sent(); // at least a  15 mSec delay, yields a 230mSec delay when 2nd wait above is 100 mSec
                        return [4 /*yield*/, this.write("".concat(requestPropType, "\r"))];
                    case 13:
                        _a.sent();
                        return [3 /*break*/, 15];
                    case 14:
                        error_2 = _a.sent();
                        this.logMessage("* requestPropellerVersion() ERROR: ".concat(JSON.stringify(error_2, null, 2)));
                        return [3 /*break*/, 15];
                    case 15: return [2 /*return*/, didCheck];
                }
            });
        });
    };
    UsbSerial.prototype.waitForPortOpen = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var attempts = 0;
                        var maxAttempts = 2000 / 30; // 2 seconds / 30 ms
                        var intervalId = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if (this._serialPort.isOpen) {
                                    clearInterval(intervalId);
                                    resolve(true);
                                }
                                else if (attempts >= maxAttempts) {
                                    clearInterval(intervalId);
                                    reject(new Error('Port did not open within 2 seconds'));
                                }
                                else {
                                    attempts++;
                                }
                                return [2 /*return*/];
                            });
                        }); }, 30); // Check every 30ms
                    })];
            });
        });
    };
    /*
    private async downloadNew(uint8Bytes: Uint8Array) {
      const byteCount: number = uint8Bytes.length;
      const base64String: string = Buffer.from(uint8Bytes).toString('base64');
      this.dumpStringHex(base64String, 'builtin64');
    }
  
    private dumpBufferHex(uint6Buffer: Uint8Array, callerId: string) {
      //
      const byteCount: number = uint6Buffer.length;
      /// dump hex and ascii data
      let displayOffset: number = 0;
      let currOffset = 0;
      this.logMessage(`-- -------- ${callerId} ------------------ --`);
      while (displayOffset < byteCount) {
        let hexPart = '';
        let asciiPart = '';
        const remainingBytes = byteCount - displayOffset;
        const lineLength = remainingBytes > 16 ? 16 : remainingBytes;
        for (let i = 0; i < lineLength; i++) {
          const byteValue = uint6Buffer[currOffset + i];
          hexPart += byteValue.toString(16).padStart(2, '0').toUpperCase() + ' ';
          asciiPart += byteValue >= 0x20 && byteValue <= 0x7e ? String.fromCharCode(byteValue) : '.';
        }
        const offsetPart = displayOffset.toString(16).padStart(5, '0').toUpperCase();
  
        this.logMessage(`${offsetPart}- ${hexPart.padEnd(48, ' ')}  '${asciiPart}'`);
        currOffset += lineLength;
        displayOffset += lineLength;
      }
      this.logMessage(`-- -------- -------- ------------------ --`);
    }
  
    private dumpStringHex(uint6Buffer: string, callerId: string) {
      //
      const byteCount: number = uint6Buffer.length;
      let displayOffset: number = 0;
      let currOffset = 0;
      this.logMessage(`-- -------- ${callerId} ------------------ --`);
      while (displayOffset < byteCount) {
        let hexPart = '';
        let asciiPart = '';
        const remainingBytes = byteCount - displayOffset;
        const lineLength = remainingBytes > 16 ? 16 : remainingBytes;
        for (let i = 0; i < lineLength; i++) {
          const byteValue = uint6Buffer.charCodeAt(currOffset + i);
          hexPart += byteValue.toString(16).padStart(2, '0').toUpperCase() + ' ';
          asciiPart += byteValue >= 0x20 && byteValue <= 0x7e ? String.fromCharCode(byteValue) : '.';
        }
        const offsetPart = displayOffset.toString(16).padStart(5, '0').toUpperCase();
  
        this.logMessage(`${offsetPart}- ${hexPart.padEnd(48, ' ')}  '${asciiPart}'`);
        currOffset += lineLength;
        displayOffset += lineLength;
      }
      this.logMessage(`-- -------- -------- ------------------ --`);
    }
    */
    UsbSerial.prototype.drain = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.logMessage("--> Tx drain");
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this._serialPort.drain(function (err) {
                            if (err)
                                reject(err);
                            else {
                                _this.logMessage("--> Tx {empty}");
                                resolve();
                            }
                        });
                    })];
            });
        });
    };
    UsbSerial.prototype.setDtr = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this._serialPort.set({ dtr: value }, function (err) {
                            if (err) {
                                _this.logMessage("DTR: ERROR:".concat(err.name, " - ").concat(err.message));
                                reject(err);
                            }
                            else {
                                _this._dtrValue = value;
                                _this.logMessage("DTR: ".concat(value));
                                resolve();
                            }
                        });
                    })];
            });
        });
    };
    UsbSerial.prototype.setRts = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this._serialPort.set({ rts: value }, function (err) {
                            if (err) {
                                _this.logMessage("RTS: ERROR:".concat(err.name, " - ").concat(err.message));
                                reject(err);
                            }
                            else {
                                _this._rtsValue = value;
                                _this.logMessage("RTS: ".concat(value));
                                resolve();
                            }
                        });
                    })];
            });
        });
    };
    UsbSerial.prototype.limitForVerLetter = function (idLetter) {
        var desiredvalue = 0;
        if (idLetter === 'A') {
            desiredvalue = 0x100000;
        }
        else if (idLetter === 'B') {
            desiredvalue = 0x040000;
        }
        else if (idLetter === 'C') {
            desiredvalue = 0x008000;
        }
        else if (idLetter === 'D') {
            desiredvalue = 0x020000;
        }
        else if (idLetter === 'E') {
            desiredvalue = 0x080000;
        }
        else if (idLetter === 'F') {
            desiredvalue = 0x100000;
        }
        else if (idLetter === 'G') {
            desiredvalue = 0x100000;
        }
        return desiredvalue;
    };
    UsbSerial.prototype.descriptionForVerLetter = function (idLetter) {
        var desiredInterp = '?unknown-propversion?';
        if (idLetter === 'A') {
            desiredInterp = 'FPGA - 8 cogs, 512KB hub, 48 smart pins 63..56, 39..0, 80MHz';
        }
        else if (idLetter === 'B') {
            desiredInterp = 'FPGA - 4 cogs, 256KB hub, 12 smart pins 63..60/7..0, 80MHz';
        }
        else if (idLetter === 'C') {
            desiredInterp = 'unsupported';
        }
        else if (idLetter === 'D') {
            desiredInterp = 'unsupported';
        }
        else if (idLetter === 'E') {
            desiredInterp = 'FPGA - 4 cogs, 512KB hub, 18 smart pins 63..62/15..0, 80MHz';
        }
        else if (idLetter === 'F') {
            desiredInterp = 'unsupported';
        }
        else if (idLetter === 'G') {
            desiredInterp = 'P2X8C4M64P Rev B/C - 8 cogs, 512KB hub, 64 smart pins';
        }
        return desiredInterp;
    };
    UsbSerial.prototype.dumpBytes = function (bytes, startOffset, maxBytes, dumpId) {
        /// dump hex and ascii data
        var displayOffset = 0;
        var currOffset = startOffset;
        var byteCount = bytes.length > maxBytes ? maxBytes : bytes.length;
        this.logMessage("-- -------- ".concat(dumpId, " ------------------ --"));
        while (displayOffset < byteCount) {
            var hexPart = '';
            var asciiPart = '';
            var remainingBytes = byteCount - displayOffset;
            var lineLength = remainingBytes > 16 ? 16 : remainingBytes;
            for (var i = 0; i < lineLength; i++) {
                var byteValue = bytes[currOffset + i];
                hexPart += byteValue.toString(16).padStart(2, '0').toUpperCase() + ' ';
                asciiPart += byteValue >= 0x20 && byteValue <= 0x7e ? String.fromCharCode(byteValue) : '.';
            }
            var offsetPart = displayOffset.toString(16).padStart(5, '0').toUpperCase();
            this.logMessage("".concat(offsetPart, "- ").concat(hexPart.padEnd(48, ' '), "  '").concat(asciiPart, "'"));
            currOffset += lineLength;
            displayOffset += lineLength;
        }
        this.logMessage("-- -------- ".concat('-'.repeat(dumpId.length), " ------------------ --"));
        this.logMessage("-- ".concat(bytes.length, " Bytes --"));
    };
    UsbSerial.prototype.logMessage = function (message) {
        if (this.context.runEnvironment.loggingEnabled) {
            //Write to output window.
            this.context.logger.logMessage(message);
        }
    };
    UsbSerial.desiredCommsBaudRate = DEFAULT_DOWNLOAD_BAUD;
    return UsbSerial;
}(events_1.EventEmitter));
exports.UsbSerial = UsbSerial;
