/** @format */

'use strict';

// src/classes/shared/packedDataProcessor.ts

import { ePackedDataMode, ePackedDataWidth, PackedDataMode } from '../debugWindowBase';

export class PackedDataProcessor {
  static validatePackedMode(possibleMode: string): [boolean, PackedDataMode] {
    let havePackedDataStatus: boolean = false;
    let desiredMode: PackedDataMode = {
      mode: ePackedDataMode.PDM_UNKNOWN,
      bitsPerSample: 0,
      valueSize: ePackedDataWidth.PDW_UNKNOWN,
      isAlternate: false,
      isSigned: false
    };

    // define hash where key is mode string and value is ePackedDataMode
    const modeMap = new Map<string, ePackedDataMode>([
      ['longs_1bit', ePackedDataMode.PDM_LONGS_1BIT],
      ['longs_2bit', ePackedDataMode.PDM_LONGS_2BIT],
      ['longs_4bit', ePackedDataMode.PDM_LONGS_4BIT],
      ['longs_8bit', ePackedDataMode.PDM_LONGS_8BIT],
      ['longs_16bit', ePackedDataMode.PDM_LONGS_16BIT],
      ['words_1bit', ePackedDataMode.PDM_WORDS_1BIT],
      ['words_2bit', ePackedDataMode.PDM_WORDS_2BIT],
      ['words_4bit', ePackedDataMode.PDM_WORDS_4BIT],
      ['words_8bit', ePackedDataMode.PDM_WORDS_8BIT],
      ['bytes_1bit', ePackedDataMode.PDM_BYTES_1BIT],
      ['bytes_2bit', ePackedDataMode.PDM_BYTES_2BIT],
      ['bytes_4bit', ePackedDataMode.PDM_BYTES_4BIT]
    ]);

    // if possible mode matches key in modeMap, then set mode and return true
    if (modeMap.has(possibleMode.toLocaleLowerCase())) {
      desiredMode.mode = modeMap.get(possibleMode.toLocaleLowerCase()) as ePackedDataMode;
      havePackedDataStatus = true;

      // now set our bitsPerSample based on new mode
      switch (desiredMode.mode) {
        case ePackedDataMode.PDM_LONGS_1BIT:
        case ePackedDataMode.PDM_WORDS_1BIT:
        case ePackedDataMode.PDM_BYTES_1BIT:
          desiredMode.bitsPerSample = 1;
          break;
        case ePackedDataMode.PDM_LONGS_2BIT:
        case ePackedDataMode.PDM_WORDS_2BIT:
        case ePackedDataMode.PDM_BYTES_2BIT:
          desiredMode.bitsPerSample = 2;
          break;
        case ePackedDataMode.PDM_LONGS_4BIT:
        case ePackedDataMode.PDM_WORDS_4BIT:
        case ePackedDataMode.PDM_BYTES_4BIT:
          desiredMode.bitsPerSample = 4;
          break;
        case ePackedDataMode.PDM_LONGS_8BIT:
        case ePackedDataMode.PDM_WORDS_8BIT:
          desiredMode.bitsPerSample = 8;
          break;
        case ePackedDataMode.PDM_LONGS_16BIT:
          desiredMode.bitsPerSample = 16;
          break;
        default:
          desiredMode.bitsPerSample = 0;
          break;
      }

      // now set our desiredMode.valueSize based on new mode
      switch (desiredMode.mode) {
        case ePackedDataMode.PDM_LONGS_1BIT:
        case ePackedDataMode.PDM_LONGS_2BIT:
        case ePackedDataMode.PDM_LONGS_4BIT:
        case ePackedDataMode.PDM_LONGS_8BIT:
        case ePackedDataMode.PDM_LONGS_16BIT:
          desiredMode.valueSize = ePackedDataWidth.PDW_LONGS;
          break;
        case ePackedDataMode.PDM_WORDS_1BIT:
        case ePackedDataMode.PDM_WORDS_2BIT:
        case ePackedDataMode.PDM_WORDS_4BIT:
        case ePackedDataMode.PDM_WORDS_8BIT:
          desiredMode.valueSize = ePackedDataWidth.PDW_WORDS;
          break;
        case ePackedDataMode.PDM_BYTES_1BIT:
        case ePackedDataMode.PDM_BYTES_2BIT:
        case ePackedDataMode.PDM_BYTES_4BIT:
          desiredMode.valueSize = ePackedDataWidth.PDW_BYTES;
          break;
        default:
          desiredMode.valueSize = ePackedDataWidth.PDW_UNKNOWN;
          break;
      }
    }

    return [havePackedDataStatus, desiredMode];
  }

  static parsePackedModeKeywords(keywords: string[]): PackedDataMode {
    const mode: PackedDataMode = {
      mode: ePackedDataMode.PDM_UNKNOWN,
      bitsPerSample: 0,
      valueSize: ePackedDataWidth.PDW_UNKNOWN,
      isAlternate: false,
      isSigned: false
    };

    for (const keyword of keywords) {
      const upperKeyword = keyword.toUpperCase();
      if (upperKeyword === 'ALT') {
        mode.isAlternate = true;
      } else if (upperKeyword === 'SIGNED') {
        mode.isSigned = true;
      } else {
        // try to parse as packed data mode
        const [isValid, parsedMode] = this.validatePackedMode(keyword);
        if (isValid) {
          mode.mode = parsedMode.mode;
          mode.bitsPerSample = parsedMode.bitsPerSample;
          mode.valueSize = parsedMode.valueSize;
        }
      }
    }

    return mode;
  }

  static unpackSamples(numericValue: number, mode: PackedDataMode): number[] {
    const sampleSet: number[] = [];

    if (mode.mode === ePackedDataMode.PDM_UNKNOWN) {
      sampleSet.push(numericValue);
    } else {
      // unpack the data based on configured mode generating a list of samples
      // we have a single value which according to packed mode we need to unpack
      switch (mode.valueSize) {
        case ePackedDataWidth.PDW_BYTES:
          // we have data as a byte [0-255] 8-bits
          switch (mode.bitsPerSample) {
            case 1:
              // we have data as 8 single bit samples
              // push each bit as a sample from LSB to MSB
              for (let index = 0; index < 8; index++) {
                sampleSet.push((numericValue >> index) & 0x01);
              }
              break;

            case 2:
              // we have data as 4 2-bit samples
              // push each 2bits as a sample from LSB to MSB
              for (let index = 0; index < 4; index++) {
                sampleSet.push((numericValue >> (index * 2)) & 0x03);
              }
              break;

            case 4:
              // we have data as 2 4-bit samples
              // push each 4bits as a sample from LSB to MSB
              for (let index = 0; index < 2; index++) {
                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
              }
              break;

            default:
              break;
          }
          break;

        case ePackedDataWidth.PDW_WORDS:
          // we have data as a word [0-65535] 16-bits
          switch (mode.bitsPerSample) {
            case 1:
              // we have data as 16 single bit samples
              // push each bit as a sample from LSB to MSB
              for (let index = 0; index < 16; index++) {
                sampleSet.push((numericValue >> index) & 0x01);
              }
              break;
            case 2:
              // we have data as 8 2-bit samples
              // push each 2bits as a sample from LSB to MSB
              for (let index = 0; index < 8; index++) {
                sampleSet.push((numericValue >> (index * 2)) & 0x03);
              }
              break;
            case 4:
              // we have data as 4 4-bit samples
              // push each 4bits as a sample from LSB to MSB
              for (let index = 0; index < 4; index++) {
                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
              }
              break;
            case 8:
              // we have data as 2 8-bit samples
              // push each 8bits as a sample from LSB to MSB
              for (let index = 0; index < 2; index++) {
                sampleSet.push((numericValue >> (index * 8)) & 0xff);
              }
              break;

            default:
              break;
          }
          break;

        case ePackedDataWidth.PDW_LONGS:
          // we have data as a long 32-bits
          switch (mode.bitsPerSample) {
            case 1:
              // we have data as 32 single bit samples
              // push each bit as a sample from LSB to MSB
              for (let index = 0; index < 32; index++) {
                sampleSet.push((numericValue >> index) & 0x01);
              }
              break;
            case 2:
              // we have data as 16 2-bit samples
              // push each 2bits as a sample from LSB to MSB
              for (let index = 0; index < 16; index++) {
                sampleSet.push((numericValue >> (index * 2)) & 0x03);
              }
              break;
            case 4:
              // we have data as 8 4-bit samples
              // push each 4bits as a sample from LSB to MSB
              for (let index = 0; index < 8; index++) {
                sampleSet.push((numericValue >> (index * 4)) & 0x0f);
              }
              break;
            case 8:
              // we have data as 4 8-bit samples
              // push each 8bits as a sample from LSB to MSB
              for (let index = 0; index < 4; index++) {
                sampleSet.push((numericValue >> (index * 8)) & 0xff);
              }
              break;
            case 16:
              // we have data as 2 16-bit samples
              // push each 16bits as a sample from LSB to MSB
              for (let index = 0; index < 2; index++) {
                sampleSet.push((numericValue >> (index * 16)) & 0xffff);
              }
              break;
            default:
              break;
          }
          break;

        default:
          break;
      }

      // if SIGNED then sign extend each sample
      if (mode.isSigned) {
        for (let index = 0; index < sampleSet.length; index++) {
          sampleSet[index] = this.signExtend(sampleSet[index], mode.bitsPerSample - 1);
        }
      }

      // if ALT then alternate the samples
      if (mode.isAlternate) {
        // FIXME: Implement alternating sample order based on Pascal reference
        // This would reorder samples to alternate between channels/sources
        // Need to understand the exact alternating pattern from Pascal code
      }
    }

    return sampleSet;
  }

  private static signExtend(value: number, signBitNbr: number): number {
    // Create a mask to zero out all bits above the sign bit
    const mask = (1 << (signBitNbr + 1)) - 1;
    value &= mask;

    // Check if the sign bit is set
    const isNegative = (value & (1 << signBitNbr)) !== 0;

    if (isNegative) {
      // If the sign bit is set, convert the value to a negative number
      value = value - (1 << (signBitNbr + 1));
    }

    return value;
  }
}