/** @format */

// this is our common logging mechanism
//  TODO: make it context/runtime option aware

'use strict';
import { Context } from '../utils/context';
import { getFlashLoaderBin, loadFileAsUint8Array, loadUint8ArrayFailed } from '../utils/files';
import { ObjectImage } from '../utils/imageUtils';
import { UsbSerial } from '../utils/usb.serial';

export class Downloader {
  private context: Context;
  private serialPort: UsbSerial;

  constructor(ctx: Context, serialPort: UsbSerial) {
    this.context = ctx;
    this.serialPort = serialPort;
  }

  public async download(binaryFilespec: string, toFlash: boolean): Promise<void> {
    let binaryImage: Uint8Array = loadFileAsUint8Array(binaryFilespec);
    const failedToLoad: boolean = loadUint8ArrayFailed(binaryImage) ? true : false;
    if (failedToLoad == false) {
      // Create ObjectImage to analyze the binary
      const imageAnalyzer = new ObjectImage('analyzer');
      imageAnalyzer.adopt(binaryImage);
      
      // Check if binary already has flash loader
      const hasFlashLoader = imageAnalyzer.hasFlashLoader();
      // Check if binary has debugger (indicates debug mode compilation)
      const hasDebugger = imageAnalyzer.hasDebugger();
      
      const fileExt = binaryFilespec.toLowerCase().endsWith('.binf') ? '.binf' : '.bin';
      this.logMessage(`  -- Loading ${fileExt} file: hasDebugger=${hasDebugger}, hasFlashLoader=${hasFlashLoader}`);
      
      let target: string = 'RAM';
      let actuallyWriteToFlash: boolean = toFlash;
      let needsP2ChecksumVerify: boolean = false;
      
      // If flash loader already present, don't add another one
      if (hasFlashLoader && toFlash) {
        this.logMessage(`  -- Flash loader already present in binary, using regular download`);
        actuallyWriteToFlash = false;
        target = 'FLASH (pre-loaded)';
      }
      
      if (actuallyWriteToFlash) {
        target = 'FLASH';
        binaryImage = await this.insertP2FlashLoader(binaryImage, hasDebugger);
        this.logMessage(`  -- load image w/flasher = (${binaryImage.length}) bytes, debug=${hasDebugger}`);
      } else {
        // For RAM downloads, enable checksum verification
        needsP2ChecksumVerify = true;
        this.logMessage(`  -- ${target} download with checksum verification enabled`);
      }
      //downloaderTerminal.sendText(`# Downloading [${filenameToDownload}] ${binaryImage.length} bytes to ${target}`);
      // write to USB PropPlug
      let usbPort: UsbSerial;
      let errMsg: string = '';
      let noDownloadError: boolean = true;
      try {
        if (await this.serialPort.deviceIsPropellerV2()) {
          const downloadResult = await this.serialPort.download(binaryImage, needsP2ChecksumVerify);
          // Check if checksum verification was requested and handle result
          if (needsP2ChecksumVerify) {
            const checksumStatus = this.serialPort.getChecksumStatus();
            if (checksumStatus.verified) {
              this.logMessage(`  -- Checksum verification: ${checksumStatus.valid ? 'PASSED' : 'FAILED'}`);
              if (!checksumStatus.valid) {
                throw new Error('P2 checksum verification failed - program may be corrupted');
              }
            } else {
              this.logMessage(`  -- Checksum verification: No response from P2`);
            }
          }
        } else {
          //downloaderTerminal.sendText(`# ERROR: No Propller v2 found`);
          noDownloadError = false;
        }
        //this.testDownloadFile(usbPort);
      } catch (error) {
        noDownloadError = false;
        if (error instanceof Error) {
          errMsg = `Dnld: Error thrown: ${error.toString()}`;
        } else {
          // Handle the case where error is not an Error object
          errMsg = `Dnld: Non-error thrown: ${JSON.stringify(error)}`;
        } // Re-throw the error if you want to fail
      } finally {
        if (errMsg.length > 0) {
          this.logMessage(errMsg);
          //downloaderTerminal.sendText(`# ERROR: ${errMsg}`);
        }
        // NOTE: Don't close serial port - MainWindow manages it and needs it for debug operations
        // The port will be reused for debug communications after download completes
      }
    }
  }

  public async insertP2FlashLoader(binaryImage: Uint8Array, enableDebug: boolean = false): Promise<Uint8Array> {
    // PNut insert_flash_loader:
    const objImage = new ObjectImage('bin-w/loader');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const debugPinRx: number = 63; // default maybe overridden by code
    let debugPinTx: number = 62; //default maybe overridden by code
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
    while (objImage.offset & 0b11) {
      objImage.append(0);
    }
    const _checksum_ = 0x04;
    const _debugnop_ = 0x08;
    const _NOP_INSTRU_ = 0;
    const flashLoaderBin: Uint8Array = getFlashLoaderBin(this.context);
    const flashLoaderLength = flashLoaderBin.length;
    // move object upwards to accommodate flash loader
    this.logMessage(`  -- move object up - flashLoaderLength=(${flashLoaderLength}) bytes`);
    this.moveObjectUp(objImage, flashLoaderLength, 0, objImage.offset);
    // install flash loader
    this.logMessage(`  -- load flash loader`);
    objImage.rawUint8Array.set(flashLoaderBin, 0);
    objImage.setOffsetTo(flashLoaderLength + binaryImage.length);
    // Set debug mode based on whether debugger was detected in the binary
    if (enableDebug) {
      // debug is on - set the debug pin in the flash loader
      const debugInstru = objImage.readLong(_debugnop_);
      objImage.replaceLong(debugInstru | debugPinTx, _debugnop_);
      this.logMessage(`  -- Flash loader debug enabled with TX pin ${debugPinTx}`);
    } else {
      // debug is off
      objImage.replaceLong(_NOP_INSTRU_, _debugnop_);
      this.logMessage(`  -- Flash loader debug disabled`);
    }
    // compute negative sum of all data
    const checkSum: number = objImage.flasherChecksum();
    // insert checksum into loader
    objImage.replaceLong(checkSum, _checksum_);
    // return only the active portion of the array
    return objImage.rawUint8Array.subarray(0, objImage.offset);
  }

  public moveObjectUp(objImage: ObjectImage, destOffset: number, sourceOffset: number, nbrBytes: number) {
    const currOffset = objImage.offset;
    this.logMessage(`* moveObjUp() from=(${sourceOffset}), to=(${destOffset}), length=(${nbrBytes})`);
    if (currOffset + nbrBytes > ObjectImage.MAX_SIZE_IN_BYTES) {
      // [error_pex]
      throw new Error('Program exceeds 1024KB');
    }
    for (let index = 0; index < nbrBytes; index++) {
      const invertedIndex = nbrBytes - index - 1;
      objImage.replaceByte(objImage.read(sourceOffset + invertedIndex), destOffset + invertedIndex);
    }
    this.logMessage(`* moveObjUp()offset (${currOffset}) -> (${currOffset + destOffset}) `);
    objImage.setOffsetTo(currOffset + destOffset);
  }

  // ----------------------------------------------------------------------

  private logMessage(message: string): void {
    if (this.context.runEnvironment.loggingEnabled) {
      // Downloader messages are system status, should go to console not Debug Logger
      this.context.logger.forceLogMessage('Dnldr: ' + message);
    }
  }
}
