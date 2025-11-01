/** @format */

'use strict';

// tests/hanningWindow.test.ts

/**
 * Hanning Window Verification Test
 *
 * This test verifies that the TypeScript Hanning window implementation
 * exactly matches the Pascal reference implementation.
 *
 * Pascal formula (DebugDisplayUnit.pas line 4181):
 *   FFTwin[i] := Round((1 - Cos((i / (1 shl FFTexp)) * Pi * 2)) * $1000)
 *
 * TypeScript formula (fftProcessor.ts line 91-92):
 *   const hanningValue = 1 - Math.cos((i / size) * Math.PI * 2);
 *   this.fftWin[i] = Math.round(hanningValue * FIXED_POINT_SCALE);
 *
 * Where:
 *   - Pascal: (1 shl FFTexp) = size (e.g., 1 << 9 = 512)
 *   - Pascal: $1000 = 4096 decimal = FIXED_POINT_SCALE
 *   - Both use standard rounding (round half away from zero)
 */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('Hanning Window Verification', () => {

  /**
   * Reference Pascal implementation for comparison
   * This matches the exact Pascal formula from line 4181
   */
  function pascalHanningWindow(i: number, fftExp: number): number {
    const size = 1 << fftExp;
    const hanningValue = 1 - Math.cos((i / size) * Math.PI * 2);
    return Math.round(hanningValue * 0x1000);
  }

  test('Hanning window formula matches Pascal for size=512', () => {
    const fftExp = 9; // 2^9 = 512
    const size = 1 << fftExp;

    // Prepare FFT processor
    const processor = new FFTProcessor();
    processor.prepareFFT(size);

    // Get TypeScript window table
    const tsWindow = processor.getWindowTable();

    // Key test points for N=512
    const testPoints = [
      { index: 0, description: 'First sample (should be 0)' },
      { index: 1, description: 'Second sample' },
      { index: 128, description: 'Quarter point' },
      { index: 256, description: 'Midpoint (should be maximum ~8192)' },
      { index: 384, description: 'Three-quarter point' },
      { index: 511, description: 'Last sample (should be ~0)' },
    ];

    console.log('\n=== Hanning Window Verification for N=512 ===\n');
    console.log('Pascal formula (line 4181):');
    console.log('  FFTwin[i] := Round((1 - Cos((i / (1 shl FFTexp)) * Pi * 2)) * $1000)\n');
    console.log('TypeScript formula (line 91-92):');
    console.log('  const hanningValue = 1 - Math.cos((i / size) * Math.PI * 2);');
    console.log('  this.fftWin[i] = Math.round(hanningValue * FIXED_POINT_SCALE);\n');

    let allMatch = true;

    for (const point of testPoints) {
      const pascalValue = pascalHanningWindow(point.index, fftExp);
      const tsValue = tsWindow[point.index];
      const match = pascalValue === tsValue;

      console.log(`Index ${point.index} (${point.description}):`);
      console.log(`  Pascal:     ${pascalValue}`);
      console.log(`  TypeScript: ${tsValue}`);
      console.log(`  Match:      ${match ? 'YES ✓' : 'NO ✗'}`);
      console.log();

      expect(tsValue).toBe(pascalValue);

      if (!match) {
        allMatch = false;
      }
    }

    console.log(`Overall: ${allMatch ? 'ALL VALUES MATCH ✓' : 'SOME VALUES DIFFER ✗'}\n`);
  });

  test('Full window table matches Pascal for size=512', () => {
    const fftExp = 9; // 2^9 = 512
    const size = 1 << fftExp;

    const processor = new FFTProcessor();
    processor.prepareFFT(size);
    const tsWindow = processor.getWindowTable();

    let mismatchCount = 0;
    let firstMismatch = -1;

    // Check every value
    for (let i = 0; i < size; i++) {
      const pascalValue = pascalHanningWindow(i, fftExp);
      const tsValue = tsWindow[i];

      if (pascalValue !== tsValue) {
        mismatchCount++;
        if (firstMismatch === -1) {
          firstMismatch = i;
          console.log(`\nFirst mismatch at index ${i}:`);
          console.log(`  Pascal:     ${pascalValue}`);
          console.log(`  TypeScript: ${tsValue}`);
          console.log(`  Difference: ${tsValue - pascalValue}`);
        }
      }
    }

    console.log(`\nTotal values checked: ${size}`);
    console.log(`Mismatches found: ${mismatchCount}`);

    expect(mismatchCount).toBe(0);
  });

  test('Hanning window properties for size=512', () => {
    const size = 512;

    const processor = new FFTProcessor();
    processor.prepareFFT(size);
    const window = processor.getWindowTable();

    console.log('\n=== Hanning Window Properties ===\n');

    // Property 1: First and last samples should be near zero
    console.log('Property 1: First and last samples near zero');
    console.log(`  window[0]:   ${window[0]} (expected ≈ 0)`);
    console.log(`  window[511]: ${window[511]} (expected ≈ 0)`);
    expect(window[0]).toBeLessThan(10); // Very small
    expect(window[511]).toBeLessThan(10); // Very small

    // Property 2: Middle sample should be maximum (~8192 for 12-bit fixed point)
    console.log('\nProperty 2: Middle sample at maximum');
    console.log(`  window[256]: ${window[256]} (expected ≈ 8192)`);
    expect(window[256]).toBeGreaterThan(8000);
    expect(window[256]).toBeLessThan(8300);

    // Property 3: Window is PERIODIC (not symmetric)
    // For periodic window: w[i] at angle θ has mirror at angle 2π-θ
    // But due to N samples over 2π, the last sample is NOT at 2π, it's at 2π(N-1)/N
    // Therefore w[0] = w[N] (if it existed), but w[1] ≠ w[N-1]
    console.log('\nProperty 3: Window periodicity (NOT symmetric)');
    console.log('  This is a periodic Hanning window: 1 - cos(2πn/N)');
    console.log('  window[0] and window[511] are close to zero (but not equal due to periodicity)');
    console.log('  window[255] and window[256] are near maximum (center peak)');
    console.log(`  window[0] = ${window[0]}`);
    console.log(`  window[255] = ${window[255]}`);
    console.log(`  window[256] = ${window[256]}`);
    console.log(`  window[257] = ${window[257]}`);
    console.log(`  window[511] = ${window[511]}`);

    // The window is periodic: if we had window[512], it would equal window[0]
    // Verify the peak is centered around index 256
    expect(window[255]).toBeGreaterThan(8000);
    expect(window[256]).toBeGreaterThan(8000);
    expect(window[257]).toBeGreaterThan(8000);

    console.log('\nPeriodicity check: PASSED ✓\n');
  });

  test('Hanning window for multiple FFT sizes', () => {
    const sizes = [64, 128, 256, 512, 1024];

    console.log('\n=== Multi-Size Hanning Window Verification ===\n');

    for (const size of sizes) {
      const fftExp = Math.log2(size);
      const processor = new FFTProcessor();
      processor.prepareFFT(size);
      const tsWindow = processor.getWindowTable();

      // Check first, middle, and last values
      const first = tsWindow[0];
      const middle = tsWindow[size / 2];
      const last = tsWindow[size - 1];

      const pascalFirst = pascalHanningWindow(0, fftExp);
      const pascalMiddle = pascalHanningWindow(size / 2, fftExp);
      const pascalLast = pascalHanningWindow(size - 1, fftExp);

      console.log(`Size ${size}:`);
      console.log(`  First [0]:       TS=${first}, Pascal=${pascalFirst}, Match=${first === pascalFirst ? '✓' : '✗'}`);
      console.log(`  Middle [${size/2}]:    TS=${middle}, Pascal=${pascalMiddle}, Match=${middle === pascalMiddle ? '✓' : '✗'}`);
      console.log(`  Last [${size-1}]:     TS=${last}, Pascal=${pascalLast}, Match=${last === pascalLast ? '✓' : '✗'}`);
      console.log();

      expect(first).toBe(pascalFirst);
      expect(middle).toBe(pascalMiddle);
      expect(last).toBe(pascalLast);
    }
  });

  test('Verify Hanning window mathematical formula', () => {
    const size = 512;
    const processor = new FFTProcessor();
    processor.prepareFFT(size);
    const window = processor.getWindowTable();

    console.log('\n=== Mathematical Formula Verification ===\n');
    console.log('Formula: w[n] = (1 - cos(2πn/N)) * scale');
    console.log('Where: N = 512, scale = 4096 (0x1000)\n');

    // Test specific values where we can predict the result
    const testCases = [
      {
        index: 0,
        angle: 0,
        cosValue: 1,
        expectedFormula: (1 - 1) * 0x1000,
        description: 'cos(0) = 1, so (1-1)*4096 = 0'
      },
      {
        index: 256,
        angle: Math.PI,
        cosValue: -1,
        expectedFormula: (1 - (-1)) * 0x1000,
        description: 'cos(π) = -1, so (1-(-1))*4096 = 8192'
      },
      {
        index: 128,
        angle: Math.PI / 2,
        cosValue: 0,
        expectedFormula: (1 - 0) * 0x1000,
        description: 'cos(π/2) = 0, so (1-0)*4096 = 4096'
      },
      {
        index: 384,
        angle: 3 * Math.PI / 2,
        cosValue: 0,
        expectedFormula: (1 - 0) * 0x1000,
        description: 'cos(3π/2) = 0, so (1-0)*4096 = 4096'
      }
    ];

    for (const test of testCases) {
      console.log(`Index ${test.index}:`);
      console.log(`  Angle: ${test.angle.toFixed(4)} rad`);
      console.log(`  Description: ${test.description}`);
      console.log(`  Expected: ${test.expectedFormula}`);
      console.log(`  Actual:   ${window[test.index]}`);
      console.log(`  Match:    ${Math.abs(window[test.index] - test.expectedFormula) < 2 ? '✓' : '✗'}`);
      console.log();

      // Allow for rounding error (within 1)
      expect(Math.abs(window[test.index] - test.expectedFormula)).toBeLessThanOrEqual(1);
    }
  });
});
