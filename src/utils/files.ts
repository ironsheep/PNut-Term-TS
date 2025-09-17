/** @format */

// Common file-system operations shares by classes in Pnut-TS.

// src/utils/files.ts

'use strict';
import * as path from 'path';
import * as fs from 'fs';
import { Context } from './context';

export function libraryDir(): string {
  return './lib';
}

// Function to format the current date and time
export function getFormattedDateTime(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Get last 2 digits of the year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-based
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

// return path to current folder with basename appended
export function localFSpecForFilename(
  ctx: Context,
  filename: string,
  fileType: string | undefined = undefined
): string {
  // get file type if any
  const fileSuffix = path.extname(filename);
  const basename: string = path.basename(filename).replace(fileSuffix, ''); // remove any path info
  let fileTypeNoDot: string = fileType !== undefined ? fileType : '';
  // remove dot if present
  if (fileTypeNoDot.startsWith('.')) {
    fileTypeNoDot = fileTypeNoDot.substring(1);
  }
  if (fileTypeNoDot.length == 0 && fileSuffix.length > 0) {
    fileTypeNoDot = fileSuffix.substring(1);
  }
  const fileName: string = `${basename}.${fileTypeNoDot}`;

  // Use context.currentFolder which is set correctly at startup
  // This preserves the launch directory even in Electron apps
  const workingDir = ctx.currentFolder;
  console.log(`[FILES] Using working directory: ${workingDir} (from context.currentFolder)`);
  return path.join(workingDir, fileName);
}

// return path to screenshot folder with basename appended
export function screenshotFSpecForFilename(
  ctx: Context,
  filename: string,
  fileType: string | undefined = undefined
): string {
  // get file type if any
  const fileSuffix = path.extname(filename);
  const basename: string = path.basename(filename).replace(fileSuffix, ''); // remove any path info
  let fileTypeNoDot: string = fileType !== undefined ? fileType : '';
  // remove dot if present
  if (fileTypeNoDot.startsWith('.')) {
    fileTypeNoDot = fileTypeNoDot.substring(1);
  }
  if (fileTypeNoDot.length == 0 && fileSuffix.length > 0) {
    fileTypeNoDot = fileSuffix.substring(1);
  }
  const fileName: string = `${basename}.${fileTypeNoDot}`;

  // Use context.getScreenshotDirectory() for dedicated screenshot folder
  const screenshotDir = ctx.getScreenshotDirectory();
  console.log(`[FILES] Using screenshot directory: ${screenshotDir} (from context.getScreenshotDirectory())`);

  // Ensure screenshot directory exists
  ensureDirExists(screenshotDir);

  return path.join(screenshotDir, fileName);
}

/**
 * filters interferring characters from URI form of fileSpec returning just a fileSpec
 * @export
 * @param {string} docUri the URI form of a filespec
 * @return {string}  just a useable fileSpec
 */
export function fileSpecFromURI(docUri: string): string {
  const spaceRegEx = /%20/g; // we are globally replacing %20 markers
  const fileRegEx = /^file:\/\//i; // remove leading "file://", case-insensative
  return docUri.replace(fileRegEx, '').replace(spaceRegEx, ' ');
}

/**
 * Checks if a file exists.
 * @param {string} pathSpec - The path to the file.
 * @returns {boolean} True if the file exists, false otherwise.
 */
export function fileExists(pathSpec: string): boolean {
  let existsStatus: boolean = false;
  if (fs.existsSync(pathSpec)) {
    // File exists in path
    existsStatus = true;
  }
  return existsStatus;
}

export function fileSize(fileSpec: string) {
  let fileSize: number = 0;
  if (fileExists(fileSpec)) {
    const stats = fs.statSync(fileSpec);
    fileSize = stats.size;
  }
  return fileSize;
}

export function listFiles(dirSpec: string): string[] {
  let fileList: string[] = [];
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
export function locateDataFile(workingDir: string, filename: string, ctx?: Context): string | undefined {
  let locatedFSpec: string | undefined = undefined;
  // is it in our current directory?
  let fileSpec: string = path.join(workingDir, filename);
  if (ctx) {
    // nothing
  }
  //if (ctx) ctx.logger.logMessage(`TRC: locateDataFile() checking [${fileSpec}]`);
  if (fileExists(fileSpec)) {
    locatedFSpec = fileSpec;
  } else {
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

export function dirExists(pathSpec: string): boolean {
  let existsStatus: boolean = false;
  if (fs.existsSync(pathSpec)) {
    // File exists in path
    existsStatus = true;
  }
  return existsStatus;
}

export function ensureDirExists(dirSpec: string): void {
  if (!dirExists(dirSpec)) {
    fs.mkdirSync(dirSpec, { recursive: true });
    console.log(`[UTIL] Log folder created at: ${dirSpec}`);
  } else {
    console.log(`[UTIL] Log folder already exists at: ${dirSpec}`);
  }
}

/**
 * loads the content of a file.
 * @param {string} fileSpec - The path to the file.
 * @returns {string} The content of the file.
 */
export function loadFileAsString(fspec: string): string {
  let fileContent: string = '';
  if (fs.existsSync(fspec)) {
    // ctx.logger.log(`TRC: loadFileAsString() attempt load of [${fspec}]`);
    try {
      fileContent = fs.readFileSync(fspec, 'utf-8');
      //fileContent = fs.readFileSync(fspec, 'latin1');  // NO THIS IS REALLY BAD!!!
      if (fileContent.includes('\x00') || fileContent.includes('\xC0')) {
        fileContent = fs.readFileSync(fspec, 'utf16le');
      }
    } catch (err) {
      // ctx.logger.log(`TRC: loadFileAsString() EXCEPTION: err=[${err}]`);
    }
  } else {
    // ctx.logger.log(`TRC: loadFileAsString() fspec=[${fspec}] NOT FOUND!`);
  }
  return fileContent;
}

export function extFile(filename: string, ctx: Context): string {
  // Get the path to the 'ext' distribution file
  const fileSpec = path.join(ctx.extensionFolder, filename);
  //const findStatus = fs.existsSync(fileSpec) ? 'FOUND' : 'NOT FOUND';
  //logExtensionMessage(`* extDir([${filename}]) extFileUri.fsPath=[${extFileUri.fsPath}] ->(${findStatus})`);
  return fileSpec;
}

export function getFlashLoaderBin(ctx: Context): Uint8Array {
  // Get the path to the 'ext' distribution file
  const flashLoaderBinFSPec = extFile('flash_loader.obj', ctx);
  // Read the file
  const flashLoaderBuffer = fs.readFileSync(flashLoaderBinFSPec);
  // Convert the Buffer to a Uint8Array
  const flashLoaderBin = new Uint8Array(
    flashLoaderBuffer.buffer,
    flashLoaderBuffer.byteOffset,
    flashLoaderBuffer.length
  );
  //logExtensionMessage(`* getFlashLoaderBin() ->(${flashLoaderBin.length}) bytes`);
  return flashLoaderBin;
}

const EMPTY_CONTENT_MARKER: string = 'XY$$ZZY';

export function loadFileAsUint8Array(fspec: string, ctx: Context | undefined = undefined): Uint8Array {
  let fileContent: Uint8Array | undefined = undefined;
  if (fs.existsSync(fspec)) {
    try {
      const buffer = fs.readFileSync(fspec);
      fileContent = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      //if (ctx) ctx.logger.logMessage(`TRC: loadFileAsUint8Array() loaded (${fileContent.length}) bytes from [${path.basename(fspec)}]`);
    } catch (err) {
      if (ctx) ctx.logger.logMessage(`TRC: loadFileAsUint8Array() ERROR: [${err}]!`);
    }
  } else {
    if (ctx) ctx.logger.logMessage(`TRC: loadFileAsUint8Array() fspec=[${fspec}] NOT FOUND!`);
  }

  if (fileContent === undefined) {
    const encoder = new TextEncoder();
    fileContent = new Uint8Array(encoder.encode(EMPTY_CONTENT_MARKER));
  } else {
    const fileSizeInBytes = fileSize(fspec);
    if (fileSizeInBytes != fileContent.length) {
      if (ctx)
        ctx.logger.logMessage(
          `TRC: loadFileAsUint8Array() loaded but SIZE MISMATCH stat=(${fileSizeInBytes}), loaded=(${fileContent.length})`
        );
    }
  }
  return fileContent;
}

export function loadUint8ArrayFailed(content: Uint8Array): boolean {
  // Convert Uint8Array back to string
  const decoder = new TextDecoder();
  const checkContent = content.length > 7 ? content.slice(0, 7) : content;
  const decodedString = decoder.decode(checkContent);
  // Test if decoded string is 'XY$$ZZY'
  const emptyStatus = decodedString === EMPTY_CONTENT_MARKER;
  return emptyStatus;
}
