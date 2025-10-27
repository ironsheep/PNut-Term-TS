/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('FFT Exact Replication Test', () => {
  it('should replicate exact conditions from logs', () => {
    console.log('=== FFT EXACT REPLICATION TEST ===\n');

    const processor = new FFTProcessor();
    const fftSize = 2048;
    processor.prepareFFT(fftSize);

    // Create samples matching the logs: sine wave with peaks at ±999
    // The logs show the signal has a peak at bin 48 (from 1024 bins)
    // This means frequency = 48 cycles in 2048 samples
    const samples = new Int32Array(fftSize);
    const frequency = 48;  // 48 cycles over the window

    for (let i = 0; i < fftSize; i++) {
      // Generate sine wave at frequency 48
      samples[i] = Math.round(999 * Math.sin(2 * Math.PI * frequency * i / fftSize));
    }

    // Verify sample range matches logs
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    console.log(`Sample range: ${min} to ${max} (logs show: -999 to 999)`);

    // Process with magnitude = 0 (matching logs)
    const result = processor.performFFT(samples, 0);

    // Find peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log(`\nFFT Results:`);
    console.log(`  Peak at bin ${maxBin} with power ${maxPower}`);
    console.log(`  Expected from logs: bin 48 with power 306-336`);

    // Show bins around expected peak (bin 48)
    console.log(`\nBins around 48:`);
    for (let i = 46; i <= 50; i++) {
      if (i < result.power.length) {
        console.log(`  Bin ${i}: power = ${result.power[i]}`);
      }
    }

    // Calculate what the scale factor is
    const scale_factor = (0x800 << 11) >> 0;  // magnitude = 0
    console.log(`\nScale factor: ${scale_factor} (0x${scale_factor.toString(16)})`);

    // Show what's happening at different stages
    console.log(`\nSignal flow:`);
    console.log(`  1. Input sample: 999`);
    console.log(`  2. Max window value: 0x2000 = ${0x2000}`);
    console.log(`  3. After windowing: 999 * 8192 = ${999 * 8192}`);
    console.log(`  4. After FFT (approx): maintains scale`);
    console.log(`  5. Scale factor: ${scale_factor}`);
    console.log(`  6. Expected power: ~${(999 * 8192) / scale_factor}`);
    console.log(`  7. Actual power: ${maxPower}`);

    // Compare to logs
    const logsPower = 320;  // Average of 306-336
    const ratio = maxPower / logsPower;
    console.log(`\nComparison:`);
    console.log(`  Our FFT processor: ${maxPower}`);
    console.log(`  From logs: ${logsPower} (average of 306-336)`);
    console.log(`  Ratio: ${ratio.toFixed(2)}x`);

    if (ratio > 1.8 && ratio < 2.2) {
      console.log(`  ✓ Our processor is ~2x higher than logs`);
    } else {
      console.log(`  ✗ Unexpected ratio (expected ~2x)`);
    }
  });

  it('should test with different window formula', () => {
    console.log('\n=== ALTERNATIVE WINDOW TEST ===\n');

    const processor = new FFTProcessor();
    const fftSize = 2048;
    processor.prepareFFT(fftSize);

    // What if Pascal's window is different?
    // Standard Hanning: 0.5 * (1 - cos(angle))  -> range 0 to 1
    // Pascal uses: (1 - cos(angle))              -> range 0 to 2

    // If Pascal expects range 0-1 but gets 0-2, power would be 2x too high
    // But we see power 2x too LOW...

    // Create constant signal to test window sum
    const samples = new Int32Array(fftSize);
    samples.fill(1000);

    const result = processor.performFFT(samples, 0);
    const dcPower = result.power[0];

    console.log(`DC signal test:`);
    console.log(`  Input: all samples = 1000`);
    console.log(`  DC power: ${dcPower}`);

    // Get window table to check
    const windowTable = processor.getWindowTable();
    let windowSum = 0;
    let windowMin = Infinity;
    let windowMax = -Infinity;

    for (let i = 0; i < fftSize; i++) {
      const w = windowTable[i];
      windowSum += w;
      windowMin = Math.min(windowMin, w);
      windowMax = Math.max(windowMax, w);
    }

    console.log(`\nWindow analysis:`);
    console.log(`  Window min: ${windowMin} (0x${windowMin.toString(16)})`);
    console.log(`  Window max: ${windowMax} (0x${windowMax.toString(16)})`);
    console.log(`  Window sum: ${windowSum}`);
    console.log(`  Window average: ${(windowSum / fftSize).toFixed(2)}`);

    // Check if window is 0-2 range as expected
    if (windowMax === 0x2000) {
      console.log(`  ✓ Window uses (1 - cos) formula with range 0 to 2`);
    } else {
      console.log(`  ✗ Unexpected window max (expected 0x2000)`);
    }
  });
});