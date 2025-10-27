/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('FFT Power Scale Bug Investigation', () => {
  it('should identify the power scaling issue with 2048 FFT', () => {
    const processor = new FFTProcessor();
    processor.prepareFFT(2048);

    console.log('=== FFT POWER SCALE BUG ===');

    // Calculate scale factor for 2048-point FFT
    const fftExp = 11; // log2(2048)
    const magnitude = 0;
    const scale_factor = (0x800 << fftExp) >> magnitude;

    console.log(`FFT size: 2048`);
    console.log(`Scale factor: 0x800 << ${fftExp} = 0x${scale_factor.toString(16)} = ${scale_factor}`);

    // The issue:
    // 1. After windowing: samples are multiplied by window (scaled by 0x1000)
    // 2. After FFT: values still scaled by 0x1000
    // 3. When we do Number(fftReal), we get values scaled by 0x1000
    // 4. hypot(rx, ry) gives magnitude scaled by 0x1000
    // 5. We divide by scale_factor (0x400000)
    // 6. Result: power = (actual_magnitude * 0x1000) / 0x400000 = actual_magnitude / 0x400

    console.log('\n--- The Bug ---');
    console.log('Window scale: 0x1000 = 4096');
    console.log('FFT maintains this scale through butterflies');
    console.log('hypot(scaled_rx, scaled_ry) = actual_magnitude * 0x1000');
    console.log(`Power = hypot / scale_factor = (magnitude * 0x1000) / 0x${scale_factor.toString(16)}`);
    console.log(`Power = magnitude * 0x1000 / 0x400000 = magnitude / 0x400`);
    console.log(`Power is 0x400 (1024) times too small!`);

    // This explains our symptoms:
    console.log('\n--- Symptom Explanation ---');
    console.log('Expected power range with high=1000: 0-1000');
    console.log('Actual power range we get: 0-220 (about 1000/4)');
    console.log('When log scale applied with high=1000:');
    console.log('  Small value 8 -> log scaled to 318 (40x amplification)');
    console.log('  This massive amplification makes noise dominant');

    // The fix:
    console.log('\n--- The Fix ---');
    console.log('Pascal correctly accounts for the window scaling.');
    console.log('We need to either:');
    console.log('  1. Divide rx,ry by 0x1000 before hypot, OR');
    console.log('  2. Adjust scale_factor to account for 0x1000 scaling');

    // Test the fix idea
    const testSamples = new Int32Array(2048);
    for (let i = 0; i < 2048; i++) {
      testSamples[i] = Math.round(1000 * Math.sin(2 * Math.PI * 48 * i / 2048));
    }

    const result = processor.performFFT(testSamples, 0);
    const maxPower = Math.max(...result.power);

    console.log(`\n--- Current Output ---`);
    console.log(`Max power: ${maxPower}`);
    console.log(`First 10 bins: ${Array.from(result.power.slice(0, 10))}`);

    // If our theory is correct, maxPower should be ~220 (1/4 of expected ~1000)
    expect(maxPower).toBeLessThan(300);
    expect(maxPower).toBeGreaterThan(100);
  });
});