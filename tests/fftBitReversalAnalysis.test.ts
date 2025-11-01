/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

/**
 * Bit-Reversal Analysis Test
 *
 * Purpose: Analyze the relationship between expected and actual bin locations
 * to understand the exact nature of the bit-reversal bug.
 */

describe('FFT Bit-Reversal Analysis', () => {
  it('should analyze bit-reversal pattern for known frequency bins', () => {
    console.log('\n' + '='.repeat(70));
    console.log('FFT BIT-REVERSAL ANALYSIS');
    console.log('='.repeat(70));

    const processor = new FFTProcessor();
    const FFT_SIZE = 1024;
    const OUTPUT_BINS = FFT_SIZE / 2;
    const FFT_EXP = 10; // log2(1024)

    processor.prepareFFT(FFT_SIZE);

    // Test several known frequencies
    const testFrequencies = [
      { bin: 0, name: 'DC' },
      { bin: 1, name: 'Bin 1' },
      { bin: 2, name: 'Bin 2' },
      { bin: 4, name: 'Bin 4' },
      { bin: 8, name: 'Bin 8' },
      { bin: 10, name: 'Bin 10' },
      { bin: 16, name: 'Bin 16' },
      { bin: 32, name: 'Bin 32' },
      { bin: 64, name: 'Bin 64' },
      { bin: 128, name: 'Bin 128' },
      { bin: 256, name: 'Bin 256' },
      { bin: 512, name: 'Nyquist (bin 512)' }
    ];

    console.log('\nAnalyzing bit-reversal pattern:\n');
    console.log('Expected | Actual  | Offset | Expected Binary    | Actual Binary      | Rev(Expected)');
    console.log('-'.repeat(95));

    testFrequencies.forEach(test => {
      // Create sine wave at this frequency
      const samples = new Int32Array(FFT_SIZE);
      const amplitude = 1000;

      if (test.bin === 0) {
        // DC signal
        samples.fill(amplitude);
      } else if (test.bin === 512) {
        // Nyquist - alternating
        for (let i = 0; i < FFT_SIZE; i++) {
          samples[i] = (i % 2 === 0) ? amplitude : -amplitude;
        }
      } else {
        // Sine wave
        for (let i = 0; i < FFT_SIZE; i++) {
          samples[i] = Math.round(amplitude * Math.sin(2 * Math.PI * test.bin * i / FFT_SIZE));
        }
      }

      // Perform FFT
      const result = processor.performFFT(samples, 0);

      // Find peak
      let maxPower = 0;
      let actualBin = 0;
      for (let i = 0; i < OUTPUT_BINS; i++) {
        if (result.power[i] > maxPower) {
          maxPower = result.power[i];
          actualBin = i;
        }
      }

      // Calculate bit-reversed expected bin
      const expectedBinBinary = test.bin.toString(2).padStart(FFT_EXP, '0');
      const actualBinBinary = actualBin.toString(2).padStart(FFT_EXP, '0');
      const reversedExpected = parseInt(expectedBinBinary.split('').reverse().join(''), 2);

      const offset = actualBin - test.bin;
      const match = actualBin === test.bin ? '✓' : '✗';

      console.log(
        `${test.bin.toString().padStart(4)} ${match}  | ` +
        `${actualBin.toString().padStart(4)}   | ` +
        `${offset.toString().padStart(5)}  | ` +
        `${expectedBinBinary} | ` +
        `${actualBinBinary} | ` +
        `${reversedExpected.toString().padStart(3)} (0b${reversedExpected.toString(2).padStart(FFT_EXP, '0')})`
      );
    });

    console.log('\n' + '='.repeat(70));
    console.log('LEGEND:');
    console.log('  Expected: The frequency bin we generated');
    console.log('  Actual: The bin where the peak power appears');
    console.log('  Offset: Actual - Expected (positive = too high, negative = too low)');
    console.log('  Expected Binary: Expected bin in binary (10-bit for 1024-point FFT)');
    console.log('  Actual Binary: Actual bin in binary');
    console.log('  Rev(Expected): Bit-reverse of expected bin');
    console.log('='.repeat(70));
    console.log('\n');

    // Additional analysis: Check if there's a pattern in the bit manipulation
    console.log('BIT-REVERSAL FUNCTION ANALYSIS:\n');
    console.log('Current rev32() implementation (from fftProcessor.ts):');
    console.log('  REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF]');
    console.log('  return (');
    console.log('    (REV4[(i >> 0) & 0xF] << 28) |');
    console.log('    (REV4[(i >> 4) & 0xF] << 24) |');
    console.log('    (REV4[(i >> 8) & 0xF] << 20)');
    console.log('  ) & 0xFFF00000;');
    console.log('\nNote: This reverses 32 bits, then shifts right by (32 - fftExp)');
    console.log('      For 1024-point FFT, fftExp = 10, so shift = 22\n');

    // Test the rev32 function directly for a few values
    console.log('Testing rev32() directly:\n');
    console.log('Input | rev32(Input) | After >>> 22 | Expected Reverse');
    console.log('-'.repeat(60));

    [0, 1, 2, 4, 8, 10, 16, 32, 64, 128, 256, 512].forEach(val => {
      // Simulate rev32 (simplified version)
      const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
      const rev32Result = (
        (REV4[(val >> 0) & 0xF] << 28) |
        (REV4[(val >> 4) & 0xF] << 24) |
        (REV4[(val >> 8) & 0xF] << 20)
      ) & 0xFFF00000;
      const shifted = rev32Result >>> 22;

      const binaryStr = val.toString(2).padStart(FFT_EXP, '0');
      const reversed = parseInt(binaryStr.split('').reverse().join(''), 2);

      console.log(
        `${val.toString().padStart(3)}   | ` +
        `0x${rev32Result.toString(16).toUpperCase().padStart(8, '0')} | ` +
        `${shifted.toString().padStart(4)}         | ` +
        `${reversed.toString().padStart(3)}`
      );
    });

    console.log('\n');
  });
});
