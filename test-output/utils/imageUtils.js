/** @format */
// object borrowed from pnut_ts
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectImage = void 0;
// src/classes/objectImage.ts
var SUPPRESS_LOG_MSG = true;
var ObjectImage = /** @class */ (function () {
    function ObjectImage(idString) {
        this.isLogging = false;
        this._objImage = new Uint8Array(ObjectImage.MAX_SIZE_IN_BYTES); // total memory size
        this._objOffset = 0; // current index into OBJ image
        this._maxOffset = 0; // current index into OBJ image
        this._id = idString;
    }
    ObjectImage.prototype.setLogging = function (enable) {
        this.isLogging = enable;
    };
    Object.defineProperty(ObjectImage.prototype, "rawUint8Array", {
        get: function () {
            return this._objImage;
        },
        enumerable: false,
        configurable: true
    });
    ObjectImage.prototype.adopt = function (sourceImage) {
        this._objImage.set(sourceImage);
        this._objOffset = sourceImage.length;
        this._maxOffset = sourceImage.length > this._maxOffset ? sourceImage.length : this._maxOffset;
    };
    Object.defineProperty(ObjectImage.prototype, "offset", {
        get: function () {
            // return current offset
            return this._objOffset;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ObjectImage.prototype, "offsetHex", {
        get: function () {
            // return current offset
            return this.hexAddress(this._objOffset);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ObjectImage.prototype, "length", {
        get: function () {
            return this._objOffset;
        },
        enumerable: false,
        configurable: true
    });
    ObjectImage.prototype.setOffsetTo = function (offset) {
        // ?? no guard for this for now...
        this.logMessage("* OBJ[".concat(this._id, "]: setOffsetTo() (").concat(this.hexAddress(this._objOffset), ") -> (").concat(this.hexAddress(offset), ") diff(").concat(this._objOffset - offset, ")"));
        this._objOffset = offset;
    };
    ObjectImage.prototype.readNext = function () {
        var desiredValue = 0;
        desiredValue = this._objImage[this._objOffset++];
        this.updateMax();
        return desiredValue;
    };
    ObjectImage.prototype.append = function (uint8, alreadyLogged) {
        if (alreadyLogged === void 0) { alreadyLogged = false; }
        // append byte to end of image
        if (alreadyLogged == false) {
            this.logMessage("* OBJ[".concat(this._id, "]: append(v=(").concat(this.hexByte(uint8 & 0xff), ")) wroteTo(").concat(this.hexAddress(this._objOffset), ")"));
        }
        if (this._objOffset < ObjectImage.MAX_SIZE_IN_BYTES) {
            this._objImage[this._objOffset++] = uint8 & 0xff;
            this.updateMax();
        }
        else {
            // [error_pex]
            throw new Error('Program exceeds 1024KB');
        }
    };
    ObjectImage.prototype.appendLong = function (uint32) {
        this.logMessage("* OBJ[".concat(this._id, "]: append(v=(").concat(this.hexLong(uint32 & 0xffffffff), ")) wroteTo(").concat(this.hexAddress(this._objOffset), ")"));
        this.append(uint32, SUPPRESS_LOG_MSG);
        this.append(uint32 >> 8, SUPPRESS_LOG_MSG);
        this.append(uint32 >> 16, SUPPRESS_LOG_MSG);
        this.append(uint32 >> 24, SUPPRESS_LOG_MSG);
    };
    ObjectImage.prototype.read = function (offset) {
        // read existing value from image
        var desiredValue = 0;
        //if (offset >= 0 && offset <= this._maxOffset - 1) {
        desiredValue = this._objImage[offset];
        //}
        return desiredValue;
    };
    ObjectImage.prototype.updateMax = function () {
        if (this._objOffset > this._maxOffset) {
            this._maxOffset = this._objOffset;
        }
    };
    ObjectImage.prototype.readWord = function (offset) {
        // read existing word from image
        var desiredValue = 0;
        //if (offset >= 0 && offset <= this._objOffset - 2) {
        desiredValue = this._objImage[offset];
        desiredValue |= this._objImage[offset + 1] << 8;
        //}
        return desiredValue;
    };
    ObjectImage.prototype.readLong = function (offset) {
        // read existing word from image
        var desiredValue = 0;
        //if (offset >= 0 && offset <= this._objOffset - 4) {
        desiredValue = this.readWord(offset);
        desiredValue |= this.readWord(offset + 2) << 16;
        //}
        return desiredValue;
    };
    ObjectImage.prototype.readLongNext = function () {
        // read existing word from image
        var desiredValue = 0;
        desiredValue = this._objImage[this._objOffset++];
        desiredValue |= this._objImage[this._objOffset++] << 8;
        desiredValue |= this._objImage[this._objOffset++] << 16;
        desiredValue |= this._objImage[this._objOffset++] << 24;
        this.logMessage("* OBJ: readLongNext() v=(".concat(this.hexLong(desiredValue), ") from(").concat(this.hexAddress(this._objOffset - 4), ")"));
        return desiredValue;
    };
    ObjectImage.prototype.replaceByte = function (uint8, offset) {
        // replace existing value within image
        this.logMessage("* OBJ: replaceByte(v=(".concat(this.hexByte(uint8), "), addr(").concat(this.hexAddress(offset), "))"));
        //if (offset >= 0 && offset <= this._objOffset - 1) {
        if (offset >= 0 && offset <= ObjectImage.MAX_SIZE_IN_BYTES - 1) {
            this._objImage[offset] = uint8;
        }
        else {
            this.logMessage("* OBJ: ERROR BAD address! replaceByte(v=(".concat(this.hexByte(uint8), "), addr(").concat(this.hexAddress(offset), "))"));
        }
    };
    ObjectImage.prototype.replaceWord = function (uint16, offset, alreadyLogged) {
        if (alreadyLogged === void 0) { alreadyLogged = false; }
        // replace existing value within image
        if (alreadyLogged == false) {
            this.logMessage("* OBJ: replaceWord(v=(".concat(this.hexWord(uint16), "), addr(").concat(this.hexAddress(offset), "))"));
        }
        //if (offset >= 0 && offset <= this._objOffset - 2) {
        this._objImage[offset] = uint16 & 0xff;
        this._objImage[offset + 1] = (uint16 >> 8) & 0xff;
        //} else {
        //  this.logMessage(`* OBJ: ERROR BAD address! replaceWord(v=(${this.hexWord(uint16)}), addr(${this.hexAddress(offset)}))`);
        //}
    };
    ObjectImage.prototype.replaceLong = function (uint32, offset) {
        // replace existing value within image
        this.logMessage("* OBJ: replaceLong(addr(".concat(this.hexAddress(offset), ")) (").concat(this.hexLong(this.readLong(offset)), ") -> (").concat(this.hexLong(uint32), ")"));
        //if (offset >= 0 && offset <= this._objOffset - 4) {
        this.replaceWord(uint32, offset, SUPPRESS_LOG_MSG);
        this.replaceWord(uint32 >> 16, offset + 2, SUPPRESS_LOG_MSG);
        //} else {
        //  this.logMessage(`* OBJ: ERROR BAD address! replacereplaceLongWord(v=(${this.hexLong(uint32)}), addr(${this.hexAddress(offset)}))`);
        //}
    };
    ObjectImage.prototype.padToLong = function () {
        // if image doesn't end on long boundary then pad it with zero bytes
        while (this.offset & 3) {
            this.append(0, SUPPRESS_LOG_MSG);
        }
    };
    ObjectImage.prototype.loadRamChecksum = function () {
        // compute negative sum of all data (loader checksum)
        var checkSum = 0x706f7250; // 'Prop'
        for (var offset = 0; offset < this.offset; offset += 4) {
            checkSum -= this.readLong(offset);
        }
        return checkSum;
    };
    ObjectImage.prototype.flasherChecksum = function () {
        // compute negative sum of all data (loader checksum)
        var checkSum = 0;
        for (var offset = 0; offset < this.offset; offset += 4) {
            checkSum -= this.readLong(offset);
        }
        return checkSum;
    };
    ObjectImage.prototype.calculateChecksum = function (fromOffset, toOffset) {
        var sumValue = 0;
        for (var index = fromOffset; index <= toOffset; index++) {
            sumValue -= this._objImage[index];
        }
        //const savedLogState = this.isLogging;
        //this.isLogging = true;
        this.logMessage("OBJ[".concat(this._id, "]: calculateChecksum(ofs=(").concat(fromOffset, "),len=(").concat(toOffset, ")) -> ").concat(sumValue & 0xff));
        //this.isLogging = savedLogState;
        return sumValue & 0xff;
    };
    ObjectImage.prototype.reset = function () {
        this.logMessage("* OBJ: reset Offset to zero");
        // effectively empty our image
        this.setOffsetTo(0); // call method, so logs
    };
    ObjectImage.prototype.dumpBytes = function (startOffset, byteCount, dumpId) {
        /// dump hex and ascii data
        var displayOffset = 0;
        var currOffset = startOffset;
        this.logMessage("-- -------- ".concat(dumpId, " ------------------ --"));
        while (displayOffset < byteCount) {
            var hexPart = '';
            var asciiPart = '';
            var remainingBytes = byteCount - displayOffset;
            var lineLength = remainingBytes > 16 ? 16 : remainingBytes;
            for (var i = 0; i < lineLength; i++) {
                var byteValue = this.read(currOffset + i);
                hexPart += byteValue.toString(16).padStart(2, '0').toUpperCase() + ' ';
                asciiPart += byteValue >= 0x20 && byteValue <= 0x7e ? String.fromCharCode(byteValue) : '.';
            }
            var offsetPart = displayOffset.toString(16).padStart(5, '0').toUpperCase();
            this.logMessage("".concat(offsetPart, "- ").concat(hexPart.padEnd(48, ' '), "  '").concat(asciiPart, "'"));
            currOffset += lineLength;
            displayOffset += lineLength;
        }
        this.logMessage("-- -------- -------- ------------------ --");
    };
    ObjectImage.prototype.hexByte = function (uint8, prefixStr) {
        if (prefixStr === void 0) { prefixStr = '$'; }
        return "".concat(prefixStr).concat(uint8.toString(16).toUpperCase().padStart(2, '0'));
    };
    ObjectImage.prototype.hexWord = function (uint16, prefixStr) {
        if (prefixStr === void 0) { prefixStr = '$'; }
        return "".concat(prefixStr).concat(uint16.toString(16).toUpperCase().padStart(4, '0'));
    };
    ObjectImage.prototype.hexLong = function (uint32, prefixStr) {
        if (prefixStr === void 0) { prefixStr = '$'; }
        // NOTE: the >>> shift forces this to unsigned math
        return "".concat(prefixStr).concat((uint32 >>> 0).toString(16).toUpperCase().padStart(8, '0'));
    };
    ObjectImage.prototype.hexAddress = function (uint32, prefixStr) {
        if (prefixStr === void 0) { prefixStr = '$'; }
        // NOTE: the >>> shift forces this to unsigned math
        return "".concat(prefixStr).concat((uint32 >>> 0).toString(16).toUpperCase().padStart(5, '0'));
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ObjectImage.prototype.logMessage = function (message) {
        if (this.isLogging) {
            //this.context.logger.logMessage(message);
        }
    };
    ObjectImage.MAX_SIZE_IN_BYTES = 0x100000;
    return ObjectImage;
}());
exports.ObjectImage = ObjectImage;
