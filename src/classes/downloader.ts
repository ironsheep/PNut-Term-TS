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

  public async download(binaryFilespec: string, toFlash: boolean): Promise<{ success: boolean; errorMessage?: string }> {
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
        const originalSize = binaryImage.length;
        binaryImage = await this.insertP2FlashLoader(binaryImage, hasDebugger);
        this.logMessage(`  -- load image w/flasher = (${binaryImage.length}) bytes (original: ${originalSize} bytes), debug=${hasDebugger}`);
        this.logMessage(`  -- Composite aligned? ${binaryImage.length % 4 === 0 ? 'YES' : `NO (mod 4 = ${binaryImage.length % 4})`}`);
      }

      // Validate checksum locally before sending
      const validationImage = new ObjectImage('validation');
      validationImage.adopt(binaryImage);

      // Log the first few bytes of the image to see what we have
      const sig = validationImage.readLong(0x00);
      const headerChecksum = validationImage.readLong(0x04);

      // Also show the raw bytes for debugging
      const rawBytes = Array.from(binaryImage.slice(0, 8))
        .map(b => '0x' + b.toString(16).padStart(2, '0'))
        .join(' ');

      this.logMessage(`  -- First 8 bytes (raw): ${rawBytes}`);
      this.logMessage(`  -- Binary header: Sig=0x${sig.toString(16).padStart(8, '0')} Checksum=0x${headerChecksum.toString(16).padStart(8, '0')}`);
      this.logMessage(`  -- Binary size: ${binaryImage.length} bytes`);

      const checksumResult = validationImage.validateP2Checksum();
      this.logMessage(`  -- Local checksum validation: ${checksumResult.valid ? 'PASSED' : 'FAILED'}`);
      if (!checksumResult.valid) {
        this.logMessage(`  -- WARNING: ${checksumResult.details}`);
        this.logMessage(`  -- Calculated sum: 0x${checksumResult.calculatedSum.toString(16).padStart(8, '0')}`);
        this.logMessage(`  -- Stored checksum: 0x${checksumResult.storedSum.toString(16).padStart(8, '0')}`);
      }

      // For flash downloads, skip P2 checksum validation - it interferes with flashing
      // RAM downloads use P2 checksum validation
      if (actuallyWriteToFlash) {
        needsP2ChecksumVerify = false;
        this.logMessage(`  -- ${target} download WITHOUT P2 checksum (flash loader handles integrity)`);
      } else {
        needsP2ChecksumVerify = true;
        this.logMessage(`  -- ${target} download with checksum validation`);
      }

      // Append checksum for P2 validation (RAM downloads only)
      if (needsP2ChecksumVerify) {
        // Pad to long boundary
        const originalLength = binaryImage.length;
        if (binaryImage.length % 4 !== 0) {
          const padBytes = 4 - (binaryImage.length % 4);
          const paddedImage = new Uint8Array(binaryImage.length + padBytes);
          paddedImage.set(binaryImage);
          // Padding bytes are already 0 by default
          binaryImage = paddedImage;
          this.logMessage(`  -- Padded with ${padBytes} zero bytes (${originalLength} -> ${binaryImage.length})`);
        } else {
          this.logMessage(`  -- No padding needed, already aligned (${originalLength} bytes)`);
        }

        // Calculate sum of all longs
        let sum = 0;
        for (let i = 0; i < binaryImage.length; i += 4) {
          const long = binaryImage[i] |
                      (binaryImage[i+1] << 8) |
                      (binaryImage[i+2] << 16) |
                      (binaryImage[i+3] << 24);
          sum = (sum + long) >>> 0;
        }

        // Calculate checksum that makes sum = 'Prop' (0x706F7250)
        const targetSum = 0x706F7250; // This is the magic value for P2 checksum validation
        const checksum = (targetSum - sum) >>> 0;

        // Append checksum as little-endian bytes
        const checksumBytes = new Uint8Array(4);
        checksumBytes[0] = checksum & 0xFF;
        checksumBytes[1] = (checksum >> 8) & 0xFF;
        checksumBytes[2] = (checksum >> 16) & 0xFF;
        checksumBytes[3] = (checksum >> 24) & 0xFF;

        const finalImage = new Uint8Array(binaryImage.length + 4);
        finalImage.set(binaryImage);
        finalImage.set(checksumBytes, binaryImage.length);
        binaryImage = finalImage;

        this.logMessage(`  -- Binary sum before checksum: 0x${sum.toString(16).padStart(8, '0')}`);
        this.logMessage(`  -- Appended checksum: 0x${checksum.toString(16).padStart(8, '0')} (bytes: ${Array.from(checksumBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')})`);
        this.logMessage(`  -- Final size with P2 checksum: ${binaryImage.length} bytes`);
      } else {
        this.logMessage(`  -- Final size (no P2 checksum, flash loader handles integrity): ${binaryImage.length} bytes`);
      }
      //downloaderTerminal.sendText(`# Downloading [${filenameToDownload}] ${binaryImage.length} bytes to ${target}`);
      // write to USB PropPlug
      let usbPort: UsbSerial;
      let errMsg: string = '';
      let noDownloadError: boolean = true;
      try {
        const isP2 = await this.serialPort.deviceIsPropellerV2();
        this.logMessage(`  -- Device check: P2 found = ${isP2}`);
        if (isP2) {
          const downloadResult = await this.serialPort.download(binaryImage, needsP2ChecksumVerify);
          // Check if checksum verification was requested and handle result
          if (needsP2ChecksumVerify) {
            const checksumStatus = this.serialPort.getChecksumStatus();
            this.logMessage(`  -- Checksum status: verified=${checksumStatus.verified}, valid=${checksumStatus.valid}`);
            if (checksumStatus.verified) {
              this.logMessage(`  -- Checksum verification: ${checksumStatus.valid ? 'PASSED' : 'FAILED'}`);
              if (!checksumStatus.valid) {
                // Checksum failed - P2 is there but download is corrupted
                errMsg = 'P2 checksum verification FAILED (! received) - download corrupted';
                noDownloadError = false;
                // Don't throw, just set error and continue
              }
            } else {
              this.logMessage(`  -- Checksum verification: No response from P2`);
            }
          }
        } else {
          //downloaderTerminal.sendText(`# ERROR: No Propller v2 found`);
          errMsg = 'No Propeller v2 device found - check connection and try again';
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
      return { success: noDownloadError, errorMessage: noDownloadError ? undefined : errMsg };
    }
    return { success: false, errorMessage: 'Failed to load binary file' }; // Failed to load file
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
    // Remember the padded size
    const paddedBinaryLength = objImage.offset;
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
    // Use the padded length, not the original length!
    objImage.setOffsetTo(flashLoaderLength + paddedBinaryLength);
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
    // ALWAYS log downloader messages - they're critical for debugging
    // Use console.log directly to ensure visibility
    console.log(`[DOWNLOADER] ${message}`);

    // Also send to logger if enabled
    if (this.context.runEnvironment.loggingEnabled) {
      this.context.logger.forceLogMessage('Dnldr: ' + message);
    }
  }
}
