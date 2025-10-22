/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

/**
 * Deep dive into FFT calculation to find the spectral leakage bug
 */
describe('FFT Deep Dive - Finding the Bug', () => {
  test('Trace FFT calculation for simple DC signal', () => {
    const fftSize = 16; // Small size for easy manual verification
    const fftProcessor = new FFTProcessor();
    fftProcessor.prepareFFT(fftSize);

    // DC signal: all samples = 100
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = 100;
    }

    console.log('\n=== DC Signal Test (all samples = 100) ===');
    console.log('Input samples:', Array.from(samples).join(', '));

    const result = fftProcessor.performFFT(samples, 0);

    console.log('\nFFT Output:');
    console.log('Result size:', result.power.length, '(expected:', fftSize / 2, ')');

    for (let i = 0; i < result.power.length; i++) {
      console.log(`  Bin ${i}: power=${result.power[i]}`);
    }

    // For DC signal, ALL power should be in bin 0
    console.log('\nExpected: All power in bin 0, other bins should be near-zero');
    console.log(`Actual bin 0: ${result.power[0]}`);
    console.log(`Actual bin 1: ${result.power[1]}`);

    const totalPower = result.power.reduce((sum, p) => sum + p, 0);
    const bin0Ratio = result.power[0] / totalPower;
    console.log(`\nBin 0 has ${(bin0Ratio * 100).toFixed(1)}% of total power`);

    // DC should have >99% of power
    expect(bin0Ratio).toBeGreaterThan(0.99);
  });

  test('Check output array bounds for 2048-point FFT', () => {
    const fftSize = 2048;
    const fftExp = 11;
    const resultSize = fftSize >> 1; // 1024

    console.log('\n=== Checking Output Bounds ===');
    console.log(`FFT Size: ${fftSize}, Result Size: ${resultSize}`);

    // Simulate the rev32 + shift operation
    const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
    function rev32(i: number): number {
      return (
        (REV4[(i >> 0) & 0xF] << 28) |
        (REV4[(i >> 4) & 0xF] << 24) |
        (REV4[(i >> 8) & 0xF] << 20)
      ) & 0xFFF00000;
    }

    console.log('\nChecking if any output indices are out of bounds:');
    console.log('Index | i2 (rev32 >>> shift) | Valid?');
    console.log('------|---------------------|-------');

    let outOfBounds = 0;
    for (let i = 0; i < resultSize; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);
      const valid = i2 >= 0 && i2 < fftSize;

      if (i < 20 || !valid) {
        console.log(`${i.toString().padStart(5)} | ${i2.toString().padStart(19)} | ${valid ? 'YES' : 'NO - OUT OF BOUNDS!'}`);
      }

      if (!valid) {
        outOfBounds++;
      }
    }

    console.log(`\nTotal out-of-bounds indices: ${outOfBounds} / ${resultSize}`);

    if (outOfBounds > 0) {
      console.log('❌ PROBLEM: Some indices are out of bounds!');
    }

    expect(outOfBounds).toBe(0);
  });

  test('Compare with Pascal formula for small FFT', () => {
    const fftSize = 8;
    const fftExp = 3;
    const resultSize = fftSize >> 1; // 4

    console.log('\n=== Pascal Formula Comparison (8-point FFT) ===');

    // Pascal: for i1 := 0 to 1 shl (FFTexp - 1) - 1 do
    //           i2 := Rev32(i1) shr (32 - FFTexp);

    const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
    function rev32(i: number): number {
      return (
        (REV4[(i >> 0) & 0xF] << 28) |
        (REV4[(i >> 4) & 0xF] << 24) |
        (REV4[(i >> 8) & 0xF] << 20)
      ) & 0xFFF00000;
    }

    console.log('i | Rev32(i) | >> (32-3) | >>> (32-3) | In Range [0-7]?');
    console.log('--|----------|-----------|-----------|----------------');

    for (let i = 0; i < resultSize; i++) {
      const rev = rev32(i);
      const signedShift = rev >> (32 - fftExp);
      const unsignedShift = rev >>> (32 - fftExp);
      const inRange = unsignedShift >= 0 && unsignedShift < fftSize;

      console.log(
        `${i} | 0x${rev.toString(16).padStart(8, '0')} | ${signedShift.toString().padStart(9)} | ${unsignedShift.toString().padStart(10)} | ${inRange ? 'YES' : 'NO'}`
      );
    }
  });
});
