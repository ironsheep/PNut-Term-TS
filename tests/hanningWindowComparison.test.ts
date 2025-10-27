/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('Hanning Window Pascal Comparison', () => {
  it('should verify Hanning window values match Pascal exactly', () => {
    const processor = new FFTProcessor();

    console.log('=== HANNING WINDOW COMPARISON ===\n');

    // Test with size 8 for easy verification
    processor.prepareFFT(8);
    const window8 = processor.getWindowTable();

    console.log('Size 8 window:');
    for (let i = 0; i < 8; i++) {
      const expected = Math.round((1 - Math.cos((i / 8) * Math.PI * 2)) * 0x1000);
      const actual = window8[i];
      const match = expected === actual ? '✓' : '✗';
      console.log(`  [${i}] Expected: 0x${expected.toString(16).padStart(4, '0')}, Actual: 0x${actual.toString(16).padStart(4, '0')} ${match}`);
    }

    // Test with 2048 (actual use case)
    processor.prepareFFT(2048);
    const window2048 = processor.getWindowTable();

    console.log('\nSize 2048 window (first 10 values):');
    for (let i = 0; i < 10; i++) {
      const expected = Math.round((1 - Math.cos((i / 2048) * Math.PI * 2)) * 0x1000);
      const actual = window2048[i];
      const match = expected === actual ? '✓' : '✗';
      console.log(`  [${i}] Expected: 0x${expected.toString(16).padStart(4, '0')}, Actual: 0x${actual.toString(16).padStart(4, '0')} ${match}`);
    }

    // Check specific important values
    console.log('\nKey window values for 2048:');
    console.log(`  window[0] = 0x${window2048[0].toString(16)} (should be 0 or near 0)`);
    console.log(`  window[1024] = 0x${window2048[1024].toString(16)} (should be 0x2000 at midpoint)`);
    console.log(`  window[2047] = 0x${window2048[2047].toString(16)} (should be near 0)`);

    // The Hanning window formula: (1 - cos(2πn/N)) * scale
    // At n=0: 1 - cos(0) = 1 - 1 = 0
    // At n=N/2: 1 - cos(π) = 1 - (-1) = 2
    // At n=N-1: 1 - cos(2π - ε) ≈ 0

    expect(window2048[0]).toBeLessThan(10); // Should be 0 or very small
    expect(window2048[1024]).toBe(0x2000); // Should be exactly 0x2000
    expect(window2048[2047]).toBeLessThan(10); // Should be near 0
  });

  it('should check if window scaling affects power differently', () => {
    // The hypothesis: Maybe Pascal's scale_factor already accounts for window scaling?

    console.log('\n=== SCALE FACTOR ANALYSIS ===\n');

    const fftExp = 11; // For 2048 FFT
    const scale_factor = 0x800 << fftExp;

    console.log(`Base scale factor: 0x800 << ${fftExp} = 0x${scale_factor.toString(16)}`);
    console.log(`Window scale: 0x1000`);

    // If Pascal's scale factor accounts for window:
    const adjusted_scale = scale_factor; // Just the base scale
    console.log(`If Pascal accounts for window in scale: 0x${adjusted_scale.toString(16)}`);

    // If we need to account for window separately:
    const our_scale = scale_factor / 0x1000;
    console.log(`If we need to compensate: 0x${our_scale.toString(16)}`);

    console.log('\nThis would make our power values:');
    console.log(`  Without compensation: too small by factor of 0x1000`);
    console.log(`  With compensation: correct scale`);
  });
});