/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

/**
 * Test FFT with clean sine wave at known frequency
 * Verifies that FFT produces a clear single peak
 */
describe('FFT Sine Wave Peak Validation', () => {
  let fftProcessor: FFTProcessor;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
  });

  test('2048-sample sine wave at frequency 32 should produce clear peak at bin 32', () => {
    const fftSize = 2048;
    const sineFrequency = 32; // 32 complete cycles in 2048 samples
    fftProcessor.prepareFFT(fftSize);

    // Generate PURE sine wave with amplitude 1000
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = Math.floor(Math.sin((i / fftSize) * Math.PI * 2 * sineFrequency) * 1000);
    }

    console.log('\n=== Pure Sine Wave FFT Test ===');
    console.log(`Frequency: ${sineFrequency} cycles in ${fftSize} samples`);
    console.log(`Expected peak at bin: ${sineFrequency}`);

    // Perform FFT
    const result = fftProcessor.performFFT(samples, 0);

    // DIAGNOSTIC: Check for alternating zeros in raw output
    console.log(`\nFirst 20 bins (raw FFT output):`);
    for (let i = 0; i < 20; i++) {
      console.log(`  Bin ${i}: ${result.power[i]}`);
    }

    // Find peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log(`\nPeak found at bin: ${maxBin}, power: ${maxPower}`);

    // Show power distribution around peak
    const peakStart = Math.max(0, maxBin - 5);
    const peakEnd = Math.min(result.power.length - 1, maxBin + 5);
    console.log(`\nPower around peak (bins ${peakStart}-${peakEnd}):`);
    for (let i = peakStart; i <= peakEnd; i++) {
      console.log(`  Bin ${i}: ${result.power[i]}`);
    }

    // Show DC and low frequency content
    console.log(`\nLow frequency bins (0-10):`);
    for (let i = 0; i <= 10; i++) {
      console.log(`  Bin ${i}: ${result.power[i]}`);
    }

    // Verify peak is at expected frequency
    expect(maxBin).toBeGreaterThanOrEqual(sineFrequency - 2);
    expect(maxBin).toBeLessThanOrEqual(sineFrequency + 2);

    // Peak should be MUCH larger than DC component
    expect(maxPower).toBeGreaterThan(result.power[0] * 10);

    // Peak should be MUCH larger than nearby bins (excluding spectral leakage)
    const nearbyAvg = (result.power[maxBin - 5] + result.power[maxBin + 5]) / 2;
    expect(maxPower).toBeGreaterThan(nearbyAvg * 5);

    console.log(`\nTest PASSED: Clear peak at bin ${maxBin}`);
  });

  test('2048-sample sine wave at frequency 64 should produce clear peak at bin 64', () => {
    const fftSize = 2048;
    const sineFrequency = 64; // 64 complete cycles in 2048 samples
    fftProcessor.prepareFFT(fftSize);

    // Generate PURE sine wave
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = Math.floor(Math.sin((i / fftSize) * Math.PI * 2 * sineFrequency) * 1000);
    }

    const result = fftProcessor.performFFT(samples, 0);

    // Find peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log(`\nFreq ${sineFrequency}: Peak at bin ${maxBin}, power ${maxPower}`);

    // Verify
    expect(maxBin).toBeGreaterThanOrEqual(sineFrequency - 2);
    expect(maxBin).toBeLessThanOrEqual(sineFrequency + 2);
    expect(maxPower).toBeGreaterThan(result.power[0] * 10);
  });
});
