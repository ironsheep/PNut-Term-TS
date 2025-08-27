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
exports.Downloader = void 0;
var files_1 = require("../utils/files");
var imageUtils_1 = require("../utils/imageUtils");
var Downloader = /** @class */ (function () {
    function Downloader(ctx, serialPort) {
        this.context = ctx;
        this.serialPort = serialPort;
    }
    Downloader.prototype.download = function (binaryFilespec, toFlash) {
        return __awaiter(this, void 0, void 0, function () {
            var binaryImage, failedToLoad, target, writeToFlash, needsP2ChecksumVerify, usbPort, errMsg, noDownloadError, error_1, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        binaryImage = (0, files_1.loadFileAsUint8Array)(binaryFilespec);
                        failedToLoad = (0, files_1.loadUint8ArrayFailed)(binaryImage) ? true : false;
                        if (!(failedToLoad == false)) return [3 /*break*/, 15];
                        target = 'RAM';
                        writeToFlash = toFlash;
                        needsP2ChecksumVerify = false;
                        if (!writeToFlash) return [3 /*break*/, 2];
                        target = 'FLASH';
                        return [4 /*yield*/, this.insertP2FlashLoader(binaryImage)];
                    case 1:
                        binaryImage = _a.sent();
                        this.logMessage("  -- load image w/flasher = (".concat(binaryImage.length, ") bytes"));
                        _a.label = 2;
                    case 2:
                        usbPort = void 0;
                        errMsg = '';
                        noDownloadError = true;
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 8, 9, 15]);
                        return [4 /*yield*/, this.serialPort.deviceIsPropellerV2()];
                    case 4:
                        if (!_a.sent()) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.serialPort.download(binaryImage, needsP2ChecksumVerify)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        //downloaderTerminal.sendText(`# ERROR: No Propller v2 found`);
                        noDownloadError = false;
                        _a.label = 7;
                    case 7: return [3 /*break*/, 15];
                    case 8:
                        error_1 = _a.sent();
                        noDownloadError = false;
                        if (error_1 instanceof Error) {
                            errMsg = "Dnld: Error thrown: ".concat(error_1.toString());
                        }
                        else {
                            // Handle the case where error is not an Error object
                            errMsg = "Dnld: Non-error thrown: ".concat(JSON.stringify(error_1));
                        } // Re-throw the error if you want to fail
                        return [3 /*break*/, 15];
                    case 9:
                        if (errMsg.length > 0) {
                            this.logMessage(errMsg);
                            //downloaderTerminal.sendText(`# ERROR: ${errMsg}`);
                        }
                        if (!this.serialPort) return [3 /*break*/, 14];
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, this.serialPort.close()];
                    case 11:
                        _a.sent(); // we're done with this port
                        return [3 /*break*/, 13];
                    case 12:
                        error_2 = _a.sent();
                        noDownloadError = false;
                        if (error_2 instanceof Error) {
                            errMsg = "Dnld: close Error thrown: ".concat(error_2.toString());
                        }
                        else {
                            // Handle the case where error is not an Error object
                            errMsg = "Dnld: close Non-error thrown: ".concat(JSON.stringify(error_2));
                        } // Re-throw the error if you want to fail
                        return [3 /*break*/, 13];
                    case 13:
                        if (errMsg.length > 0) {
                            this.logMessage(errMsg);
                            //downloaderTerminal.sendText(`# ERROR: ${errMsg}`);
                        }
                        _a.label = 14;
                    case 14: return [7 /*endfinally*/];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    Downloader.prototype.insertP2FlashLoader = function (binaryImage) {
        return __awaiter(this, void 0, void 0, function () {
            var objImage, debugPinRx, debugPinTx, _checksum_, _debugnop_, _NOP_INSTRU_, flashLoaderBin, flashLoaderLength, checkSum;
            return __generator(this, function (_a) {
                objImage = new imageUtils_1.ObjectImage('bin-w/loader');
                debugPinRx = 63;
                debugPinTx = 62;
                /*
                  const overrideDebugPinTx = await findDebugPinTx();
                  if (overrideDebugPinTx !== null) {
                    this.logMessage(
                      `  -- insertFL default=(${debugPinTx}) but found debugPinTx=(${overrideDebugPinTx}) in Spin2 src`
                    );
                    debugPinTx = overrideDebugPinTx;
                  }
                  this.logMessage(`  -- insertFL using - debugPinTx=(${debugPinTx})`);
                  */
                objImage.adopt(binaryImage);
                // pad object to next long
                while (objImage.offset & 3) {
                    objImage.append(0);
                }
                _checksum_ = 0x04;
                _debugnop_ = 0x08;
                _NOP_INSTRU_ = 0;
                flashLoaderBin = (0, files_1.getFlashLoaderBin)(this.context);
                flashLoaderLength = flashLoaderBin.length;
                // move object upwards to accommodate flash loader
                this.logMessage("  -- move object up - flashLoaderLength=(".concat(flashLoaderLength, ") bytes"));
                this.moveObjectUp(objImage, flashLoaderLength, 0, objImage.offset);
                // install flash loader
                this.logMessage("  -- load flash loader");
                objImage.rawUint8Array.set(flashLoaderBin, 0);
                objImage.setOffsetTo(flashLoaderLength + binaryImage.length);
                checkSum = objImage.flasherChecksum();
                // insert checksum into loader
                objImage.replaceLong(checkSum, _checksum_);
                // return only the active portion of the array
                return [2 /*return*/, objImage.rawUint8Array.subarray(0, objImage.offset)];
            });
        });
    };
    Downloader.prototype.moveObjectUp = function (objImage, destOffset, sourceOffset, nbrBytes) {
        var currOffset = objImage.offset;
        this.logMessage("* moveObjUp() from=(".concat(sourceOffset, "), to=(").concat(destOffset, "), length=(").concat(nbrBytes, ")"));
        if (currOffset + nbrBytes > imageUtils_1.ObjectImage.MAX_SIZE_IN_BYTES) {
            // [error_pex]
            throw new Error('Program exceeds 1024KB');
        }
        for (var index = 0; index < nbrBytes; index++) {
            var invertedIndex = nbrBytes - index - 1;
            objImage.replaceByte(objImage.read(sourceOffset + invertedIndex), destOffset + invertedIndex);
        }
        this.logMessage("* moveObjUp()offset (".concat(currOffset, ") -> (").concat(currOffset + destOffset, ") "));
        objImage.setOffsetTo(currOffset + destOffset);
    };
    // ----------------------------------------------------------------------
    Downloader.prototype.logMessage = function (message) {
        if (this.context.runEnvironment.loggingEnabled) {
            //Write to output window.
            this.context.logger.logMessage('Dnldr: ' + message);
        }
    };
    return Downloader;
}());
exports.Downloader = Downloader;
