/** @format */
// Common file-system operations shares by classes in Pnut-TS.
// src/utils/files.ts
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.libraryDir = libraryDir;
exports.getFormattedDateTime = getFormattedDateTime;
exports.localFSpecForFilename = localFSpecForFilename;
exports.fileSpecFromURI = fileSpecFromURI;
exports.fileExists = fileExists;
exports.fileSize = fileSize;
exports.listFiles = listFiles;
exports.locateDataFile = locateDataFile;
exports.dirExists = dirExists;
exports.ensureDirExists = ensureDirExists;
exports.loadFileAsString = loadFileAsString;
exports.extFile = extFile;
exports.getFlashLoaderBin = getFlashLoaderBin;
exports.loadFileAsUint8Array = loadFileAsUint8Array;
exports.loadUint8ArrayFailed = loadUint8ArrayFailed;
var path = require("path");
var fs = require("fs");
function libraryDir() {
    return './lib';
}
// Function to format the current date and time
function getFormattedDateTime() {
    var now = new Date();
    var year = now.getFullYear().toString().slice(-2); // Get last 2 digits of the year
    var month = (now.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-based
    var day = now.getDate().toString().padStart(2, '0');
    var hours = now.getHours().toString().padStart(2, '0');
    var minutes = now.getMinutes().toString().padStart(2, '0');
    return "".concat(year).concat(month).concat(day, "-").concat(hours).concat(minutes);
}
// return path to current folder with basename appended
function localFSpecForFilename(ctx, filename, fileType) {
    if (fileType === void 0) { fileType = undefined; }
    // get file type if any
    var fileSuffix = path.extname(filename);
    var basename = path.basename(filename).replace(fileSuffix, ''); // remove any path info
    var fileTypeNoDot = fileType !== undefined ? fileType : '';
    // remove dot if present
    if (fileTypeNoDot.startsWith('.')) {
        fileTypeNoDot = fileTypeNoDot.substring(1);
    }
    if (fileTypeNoDot.length == 0 && fileSuffix.length > 0) {
        fileTypeNoDot = fileSuffix.substring(1);
    }
    var fileName = "".concat(basename, ".").concat(fileTypeNoDot);
    return path.join(ctx.currentFolder, fileName);
}
/**
 * filters interferring characters from URI form of fileSpec returning just a fileSpec
 * @export
 * @param {string} docUri the URI form of a filespec
 * @return {string}  just a useable fileSpec
 */
function fileSpecFromURI(docUri) {
    var spaceRegEx = /%20/g; // we are globally replacing %20 markers
    var fileRegEx = /^file:\/\//i; // remove leading "file://", case-insensative
    return docUri.replace(fileRegEx, '').replace(spaceRegEx, ' ');
}
/**
 * Checks if a file exists.
 * @param {string} pathSpec - The path to the file.
 * @returns {boolean} True if the file exists, false otherwise.
 */
function fileExists(pathSpec) {
    var existsStatus = false;
    if (fs.existsSync(pathSpec)) {
        // File exists in path
        existsStatus = true;
    }
    return existsStatus;
}
function fileSize(fileSpec) {
    var fileSize = 0;
    if (fileExists(fileSpec)) {
        var stats = fs.statSync(fileSpec);
        fileSize = stats.size;
    }
    return fileSize;
}
function listFiles(dirSpec) {
    var fileList = [];
    if (fs.existsSync(dirSpec)) {
        fileList = fs.readdirSync(dirSpec);
    }
    return fileList;
}
/**
 * locate named file which can be in current directory
 * NOTE: The current directory is searched first then the built-in library path is searched
 *
 * @export
 * @param {string} filename
 * @return {*}  {(string | undefined)}
 */
function locateDataFile(workingDir, filename, ctx) {
    var locatedFSpec = undefined;
    // is it in our current directory?
    var fileSpec = path.join(workingDir, filename);
    if (ctx) {
        // nothing
    }
    //if (ctx) ctx.logger.logMessage(`TRC: locateDataFile() checking [${fileSpec}]`);
    if (fileExists(fileSpec)) {
        locatedFSpec = fileSpec;
    }
    else {
        // no, is it in our LIB directory?
        fileSpec = path.join(libraryDir(), filename);
        //if (ctx) ctx.logger.logMessage(`TRC: locateDataFile() checking [${fileSpec}]`);
        if (fileExists(fileSpec)) {
            locatedFSpec = fileSpec;
        }
    }
    //if (ctx) ctx.logger.logMessage(`TRC: locateDataFile() -> [${locatedFSpec}]`);
    return locatedFSpec;
}
function dirExists(pathSpec) {
    var existsStatus = false;
    if (fs.existsSync(pathSpec)) {
        // File exists in path
        existsStatus = true;
    }
    return existsStatus;
}
function ensureDirExists(dirSpec) {
    if (!dirExists(dirSpec)) {
        fs.mkdirSync(dirSpec, { recursive: true });
        //console.log(`Log folder created at: ${dirSpec}`);
    }
    else {
        //console.log(`Log folder already exists at: ${dirSpec}`);
    }
}
/**
 * loads the content of a file.
 * @param {string} fileSpec - The path to the file.
 * @returns {string} The content of the file.
 */
function loadFileAsString(fspec) {
    var fileContent = '';
    if (fs.existsSync(fspec)) {
        // ctx.logger.log(`TRC: loadFileAsString() attempt load of [${fspec}]`);
        try {
            fileContent = fs.readFileSync(fspec, 'utf-8');
            //fileContent = fs.readFileSync(fspec, 'latin1');  // NO THIS IS REALLY BAD!!!
            if (fileContent.includes('\x00') || fileContent.includes('\xC0')) {
                fileContent = fs.readFileSync(fspec, 'utf16le');
            }
        }
        catch (err) {
            // ctx.logger.log(`TRC: loadFileAsString() EXCEPTION: err=[${err}]`);
        }
    }
    else {
        // ctx.logger.log(`TRC: loadFileAsString() fspec=[${fspec}] NOT FOUND!`);
    }
    return fileContent;
}
function extFile(filename, ctx) {
    // Get the path to the 'ext' distribution file
    var fileSpec = path.join(ctx.extensionFolder, filename);
    //const findStatus = fs.existsSync(fileSpec) ? 'FOUND' : 'NOT FOUND';
    //logExtensionMessage(`* extDir([${filename}]) extFileUri.fsPath=[${extFileUri.fsPath}] ->(${findStatus})`);
    return fileSpec;
}
function getFlashLoaderBin(ctx) {
    // Get the path to the 'ext' distribution file
    var flashLoaderBinFSPec = extFile('flash_loader.obj', ctx);
    // Read the file
    var flashLoaderBuffer = fs.readFileSync(flashLoaderBinFSPec);
    // Convert the Buffer to a Uint8Array
    var flashLoaderBin = new Uint8Array(flashLoaderBuffer.buffer, flashLoaderBuffer.byteOffset, flashLoaderBuffer.length);
    //logExtensionMessage(`* getFlashLoaderBin() ->(${flashLoaderBin.length}) bytes`);
    return flashLoaderBin;
}
var EMPTY_CONTENT_MARKER = 'XY$$ZZY';
function loadFileAsUint8Array(fspec, ctx) {
    if (ctx === void 0) { ctx = undefined; }
    var fileContent = undefined;
    if (fs.existsSync(fspec)) {
        try {
            var buffer = fs.readFileSync(fspec);
            fileContent = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            //if (ctx) ctx.logger.logMessage(`TRC: loadFileAsUint8Array() loaded (${fileContent.length}) bytes from [${path.basename(fspec)}]`);
        }
        catch (err) {
            if (ctx)
                ctx.logger.logMessage("TRC: loadFileAsUint8Array() ERROR: [".concat(err, "]!"));
        }
    }
    else {
        if (ctx)
            ctx.logger.logMessage("TRC: loadFileAsUint8Array() fspec=[".concat(fspec, "] NOT FOUND!"));
    }
    if (fileContent === undefined) {
        var encoder = new TextEncoder();
        fileContent = new Uint8Array(encoder.encode(EMPTY_CONTENT_MARKER));
    }
    else {
        var fileSizeInBytes = fileSize(fspec);
        if (fileSizeInBytes != fileContent.length) {
            if (ctx)
                ctx.logger.logMessage("TRC: loadFileAsUint8Array() loaded but SIZE MISMATCH stat=(".concat(fileSizeInBytes, "), loaded=(").concat(fileContent.length, ")"));
        }
    }
    return fileContent;
}
function loadUint8ArrayFailed(content) {
    // Convert Uint8Array back to string
    var decoder = new TextDecoder();
    var checkContent = content.length > 7 ? content.slice(0, 7) : content;
    var decodedString = decoder.decode(checkContent);
    // Test if decoded string is 'XY$$ZZY'
    var emptyStatus = decodedString === EMPTY_CONTENT_MARKER;
    return emptyStatus;
}
