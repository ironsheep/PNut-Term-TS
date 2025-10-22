/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

/**
 * FFT 2048-sample validation test
 *
 * This test specifically validates FFT with 2048 samples (the size used in external test)
 * to ensure no alternating zero pattern appears in the output.
 */

describe('FFT 2048-Sample Validation', () => {
  let fftProcessor: FFTProcessor;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
  });

  test('should handle 2048-sample sine wave without alternating zeros', () => {
    const fftSize = 2048;
    fftProcessor.prepareFFT(fftSize);

    // Generate sine wave (similar to external test)
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      // Simple sine wave
      samples[i] = Math.floor(Math.sin((i / fftSize) * Math.PI * 2 * 32) * 1000);
    }

    console.log('\n=== 2048-Sample FFT Test ===');
    console.log(`Input size: ${fftSize}`);
    console.log(`First 20 input samples: ${Array.from(samples.slice(0, 20)).join(', ')}`);

    // Perform FFT
    const result = fftProcessor.performFFT(samples, 0);

    console.log(`\nFFT result:`);
    console.log(`  Output bins: ${result.power.length} (expected ${fftSize / 2})`);
    console.log(`  First 20 power bins: ${Array.from(result.power.slice(0, 20)).join(', ')}`);

    // Check for alternating zeros in output
    let zeroCount = 0;
    let alternatingPattern = true;

    for (let i = 1; i < 20; i += 2) {
      if (result.power[i] === 0) {
        zeroCount++;
      } else {
        alternatingPattern = false;
      }
    }

    console.log(`\nAlternating zero analysis:`);
    console.log(`  Odd bins 1,3,5,7,9... that are zero: ${zeroCount}/10`);
    console.log(`  Has alternating zero pattern: ${alternatingPattern ? 'YES (BUG!)' : 'NO (GOOD)'}`);

    // Verify
    expect(result.power.length).toBe(1024); // Half of 2048
    expect(alternatingPattern).toBe(false); // Should NOT have alternating zeros

    // Find peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log(`\nPeak analysis:`);
    console.log(`  Peak at bin: ${maxBin}`);
    console.log(`  Peak power: ${maxPower}`);
    console.log(`  Expected bin: ~32 (32 cycles in 2048 samples)`);

    // Peak should be near bin 32
    expect(maxBin).toBeGreaterThanOrEqual(30);
    expect(maxBin).toBeLessThanOrEqual(34);
    expect(maxPower).toBeGreaterThan(100);
  });

  test('EXACT external test data with magnitude=0', () => {
    const fftSize = 2048;
    fftProcessor.prepareFFT(fftSize);

    // EXACT samples from external test logs Build 000500
    // Multiple consecutive sample extractions logged - using the first complete set
    const realSamples = [
      194, 380, 552, 703, 827, 920, 979, 983, 929, 840, 719, 570, 400, 215, 21, -173, -361, -535, -689, -817
    ];

    // For 2048 samples, we'll extend this pattern by repeating the sine wave cycle
    // The real data appears to be ~64 samples per cycle based on the pattern
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      // Use actual samples for first 20, then continue the sine pattern
      if (i < realSamples.length) {
        samples[i] = realSamples[i];
      } else {
        // Continue the sine wave pattern (roughly 1.5 cycles per 64 samples based on data)
        samples[i] = Math.floor(Math.sin((i / 64) * Math.PI * 2 * 1.5) * 1000);
      }
    }

    console.log('\n=== EXACT External Test Data (magnitude=0) ===');
    console.log(`First 20 samples (REAL data from logs): ${Array.from(samples.slice(0, 20)).join(', ')}`);

    // Use magnitude=0 matching external test
    const result = fftProcessor.performFFT(samples, 0);

    console.log(`\nRAW FFT output (before log scaling):`);
    console.log(`  Total bins: ${result.power.length}`);
    console.log(`  First 20 bins: ${Array.from(result.power.slice(0, 20)).join(', ')}`);

    // Check for alternating zeros in RAW output
    const oddBins = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let oddZeroCount = 0;
    for (const i of oddBins) {
      if (result.power[i] === 0) oddZeroCount++;
    }

    console.log(`\nAlternating zero analysis (RAW FFT output):`);
    console.log(`  Odd bins that are zero: ${oddZeroCount}/${oddBins.length}`);
    console.log(`  Pattern: ${oddZeroCount === oddBins.length ? 'ALL ODD BINS ZERO!' : 'Not alternating pattern'}`);

    // Now apply log scaling as external test does (high=1000, logscale enabled)
    const high = 1000;
    const logScaledPower: number[] = [];
    for (let i = 0; i < Math.min(20, result.power.length); i++) {
      const v = result.power[i];
      const scaled = Math.round((Math.log2(v + 1) / Math.log2(high + 1)) * high);
      logScaledPower.push(scaled);
    }

    console.log(`\nAfter LOG SCALING (high=1000):`);
    console.log(`  First 20 bins: ${logScaledPower.join(', ')}`);
    console.log(`  Compare to external: [318, 0, 434, 0, 538, 0, 282, 0, 541, 0]`);

    // Find peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log(`\nPeak in RAW data: bin ${maxBin}, power ${maxPower}`);
  });
});
