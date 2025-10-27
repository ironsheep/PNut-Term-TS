/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('FFT DC Signal Test', () => {
  it('should process a DC signal and check power output', () => {
    console.log('=== FFT DC SIGNAL TEST ===\n');

    const processor = new FFTProcessor();
    const fftSize = 2048;
    processor.prepareFFT(fftSize);

    // Create a DC signal (all samples = 1000)
    const samples = new Int32Array(fftSize);
    samples.fill(1000);

    console.log(`Input: DC signal, all samples = 1000`);
    console.log(`FFT size: ${fftSize}\n`);

    // Process with magnitude = 0
    const result = processor.performFFT(samples, 0);

    // Check DC bin (bin 0)
    console.log(`DC bin (bin 0) power: ${result.power[0]}`);

    // Check first few bins
    console.log(`First 10 bins:`);
    for (let i = 0; i < 10; i++) {
      console.log(`  Bin ${i}: power = ${result.power[i]}`);
    }

    // Calculate what we expect
    console.log(`\nExpected calculation:`);
    console.log(`  Sample value: 1000`);
    console.log(`  Window sum for DC: sum of all window values`);

    // Get window values
    const windowTable = processor.getWindowTable();
    let windowSum = 0;
    for (let i = 0; i < fftSize; i++) {
      windowSum += windowTable[i];
    }
    console.log(`  Window sum: ${windowSum} (0x${windowSum.toString(16)})`);
    console.log(`  Window average: ${(windowSum / fftSize).toFixed(2)}`);

    // After FFT, DC component = sum(samples * window)
    const dcComponent = 1000 * windowSum;
    console.log(`  DC component after FFT: ${dcComponent}`);

    // Scale factor
    const scale_factor = 0x800 << 11;  // For 2048 FFT, magnitude = 0
    console.log(`  Scale factor: ${scale_factor} (0x${scale_factor.toString(16)})`);

    // Expected power
    const expectedPower = Math.round(dcComponent / scale_factor);
    console.log(`  Expected power: ${expectedPower}`);
    console.log(`  Actual power: ${result.power[0]}`);
    console.log(`  Ratio: ${(result.power[0] / expectedPower).toFixed(2)}x`);
  });

  it('should compare sine wave power to expected', () => {
    console.log('\n=== FFT SINE WAVE TEST ===\n');

    const processor = new FFTProcessor();
    const fftSize = 2048;
    processor.prepareFFT(fftSize);

    // Create a sine wave at bin 48 (matching our logs)
    const samples = new Int32Array(fftSize);
    const frequency = 48;  // Bin 48
    const amplitude = 999;  // Peak amplitude

    for (let i = 0; i < fftSize; i++) {
      samples[i] = Math.round(amplitude * Math.sin(2 * Math.PI * frequency * i / fftSize));
    }

    console.log(`Input: Sine wave`);
    console.log(`  Frequency: bin ${frequency}`);
    console.log(`  Amplitude: ${amplitude}`);
    console.log(`  FFT size: ${fftSize}\n`);

    // Process with magnitude = 0
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

    console.log(`Peak found at bin ${maxBin} with power ${maxPower}`);

    // Show surrounding bins
    console.log(`\nBins around peak:`);
    for (let i = Math.max(0, maxBin - 2); i <= Math.min(result.power.length - 1, maxBin + 2); i++) {
      console.log(`  Bin ${i}: power = ${result.power[i]}`);
    }

    // Theoretical calculation
    console.log(`\nTheoretical analysis:`);
    console.log(`  Sine amplitude: ${amplitude}`);
    console.log(`  With Hanning window, energy reduced by 3/8`);
    console.log(`  Effective amplitude: ~${(amplitude * Math.sqrt(3/8)).toFixed(0)}`);

    // Compare to our logs
    console.log(`\nComparison to logs:`);
    console.log(`  Our FFT: max power = ${maxPower}`);
    console.log(`  From logs: max power = 306-336`);
    console.log(`  Match: ${maxPower >= 250 && maxPower <= 350 ? 'YES' : 'NO'}`);
  });
});