/** @format */

'use strict';

/**
 * Test to determine if butterflies output in bit-reversed or natural order
 */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

// Access internal arrays by creating a test processor with inspection
class InspectableFFTProcessor extends FFTProcessor {
  public inspectInternalArrays(samples: Int32Array, magnitude: number): {
    fftReal: BigInt64Array;
    fftImag: BigInt64Array;
  } {
    // We need to duplicate the logic from performFFT up to the butterfly completion
    const fftSize = this.getFFTSize();
    const fftExp = this.getFFTExp();

    // Initialize working arrays
    const fftReal = new BigInt64Array(2048);
    const fftImag = new BigInt64Array(2048);

    // Load samples with Hanning window (simplified - we'll use no window for testing)
    for (let i = 0; i < fftSize; i++) {
      fftReal[i] = BigInt(samples[i]) * 0x1000n; // Fixed-point scale without window
      fftImag[i] = 0n;
    }

    // Perform butterfly operations (copied from performFFT)
    let i1 = 1 << (fftExp - 1);
    let i2 = 1;

    // Get twiddle factors
    const sinTable = this.getSinTable();
    const cosTable = this.getCosTable();
    const FIXED_POINT_SCALE = 0x1000;

    while (i1 !== 0) {
      let th = 0;
      let i3 = 0;
      let i4 = i1;
      let c1 = i2;

      while (c1 !== 0) {
        let ptra = i3;
        let ptrb = ptra + i1;
        let c2 = i4 - i3;

        while (c2 !== 0) {
          const ax = fftReal[ptra];
          const ay = fftImag[ptra];
          const bx = fftReal[ptrb];
          const by = fftImag[ptrb];

          const rx = (bx * BigInt(cosTable[th]) - by * BigInt(sinTable[th])) / BigInt(FIXED_POINT_SCALE);
          const ry = (bx * BigInt(sinTable[th]) + by * BigInt(cosTable[th])) / BigInt(FIXED_POINT_SCALE);

          fftReal[ptra] = ax + rx;
          fftImag[ptra] = ay + ry;
          fftReal[ptrb] = ax - rx;
          fftImag[ptrb] = ay - ry;

          ptra++;
          ptrb++;
          c2--;
        }

        th++;
        i3 += i1 << 1;
        i4 += i1 << 1;
        c1--;
      }

      i1 >>= 1;
      i2 <<= 1;
    }

    return { fftReal, fftImag };
  }
}

function rev32(i: number, fftExp: number): number {
  const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
  const result =
    ((REV4[(i >> 0) & 0xf] << 28) | (REV4[(i >> 4) & 0xf] << 24) | (REV4[(i >> 8) & 0xf] << 20)) & 0xfff00000;
  return result >>> (32 - fftExp);
}

function main(): void {
  console.log('Butterfly Output Order Test');
  console.log('===========================\n');

  const size = 512;
  const fftExp = 9;

  // Create DC signal (constant) - FFT should have all energy at bin 0
  const samples = new Int32Array(size);
  samples.fill(1000);

  const processor = new InspectableFFTProcessor();
  processor.prepareFFT(size);

  // Inspect internal state after butterflies
  const { fftReal, fftImag } = processor.inspectInternalArrays(samples, 0);

  // Find where the energy is
  console.log('DC Signal Test (constant 1000):');
  console.log('Energy should be at frequency bin 0\n');

  // Calculate magnitude at each position
  const magnitudes: { index: number; magnitude: number }[] = [];
  for (let i = 0; i < size; i++) {
    const real = Number(fftReal[i]) / 0x1000; // Convert from fixed-point
    const imag = Number(fftImag[i]) / 0x1000;
    const mag = Math.sqrt(real * real + imag * imag);
    if (mag > 100) {
      // Only show significant magnitudes
      magnitudes.push({ index: i, magnitude: mag });
    }
  }

  magnitudes.sort((a, b) => b.magnitude - a.magnitude);

  console.log('Top 10 positions with energy after butterflies:');
  for (let i = 0; i < Math.min(10, magnitudes.length); i++) {
    const { index, magnitude } = magnitudes[i];
    const reversedIndex = rev32(index, fftExp);
    console.log(
      `  Position ${index.toString().padStart(3)}: magnitude ${magnitude.toFixed(0).padStart(6)} ` +
        `(bit-reversed: ${reversedIndex.toString().padStart(3)})`
    );
  }

  console.log('\nAnalysis:');
  if (magnitudes.length > 0) {
    const topIndex = magnitudes[0].index;
    const topReversed = rev32(topIndex, fftExp);

    console.log(`  Primary energy at position: ${topIndex}`);
    console.log(`  Bit-reversed position: ${topReversed}`);

    if (topIndex === 0) {
      console.log('  ✓ Energy at position 0 -> Butterflies output in NATURAL order');
      console.log('  ✗ BUG: We should NOT be un-reversing!');
    } else if (topReversed === 0) {
      console.log('  ✓ Energy at bit-reverse(0) -> Butterflies output in BIT-REVERSED order');
      console.log('  ✓ Un-reversing is correct');
    } else {
      console.log('  ✗ Energy at unexpected position!');
    }
  }

  // Now test with sine wave at frequency 10
  console.log('\n\nSine Wave Test (frequency bin 10):');
  console.log('Energy should be at frequency bin 10\n');

  const samples2 = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    const phase = (2 * Math.PI * 10 * i) / size;
    samples2[i] = Math.round(1000 * Math.sin(phase));
  }

  const { fftReal: fftReal2, fftImag: fftImag2 } = processor.inspectInternalArrays(samples2, 0);

  const magnitudes2: { index: number; magnitude: number }[] = [];
  for (let i = 0; i < size; i++) {
    const real = Number(fftReal2[i]) / 0x1000;
    const imag = Number(fftImag2[i]) / 0x1000;
    const mag = Math.sqrt(real * real + imag * imag);
    if (mag > 100) {
      magnitudes2.push({ index: i, magnitude: mag });
    }
  }

  magnitudes2.sort((a, b) => b.magnitude - a.magnitude);

  console.log('Top 10 positions with energy after butterflies:');
  for (let i = 0; i < Math.min(10, magnitudes2.length); i++) {
    const { index, magnitude } = magnitudes2[i];
    const reversedIndex = rev32(index, fftExp);
    console.log(
      `  Position ${index.toString().padStart(3)}: magnitude ${magnitude.toFixed(0).padStart(6)} ` +
        `(bit-reversed: ${reversedIndex.toString().padStart(3)})`
    );
  }

  console.log('\nAnalysis:');
  if (magnitudes2.length > 0) {
    const topIndex = magnitudes2[0].index;
    const topReversed = rev32(topIndex, fftExp);

    console.log(`  Primary energy at position: ${topIndex}`);
    console.log(`  Bit-reversed position: ${topReversed}`);
    console.log(`  Expected frequency bin: 10`);
    console.log(`  Bit-reverse(10): ${rev32(10, fftExp)}`);

    if (topIndex === 10) {
      console.log('  ✓ Energy at position 10 -> Butterflies output in NATURAL order');
      console.log('  ✗ BUG CONFIRMED: We should NOT be applying bit-reversal!');
      console.log('\n  FIX: Change line 178 to read directly: fftReal[i] instead of fftReal[i2]');
    } else if (topReversed === 10) {
      console.log('  ✓ Energy at bit-reverse(10) -> Butterflies output in BIT-REVERSED order');
      console.log('  ✓ Un-reversing is correct');
    } else if (topIndex === rev32(10, fftExp)) {
      console.log('  ✓ Energy at bit-reverse(10) = position 160 -> Butterflies output in BIT-REVERSED order');
      console.log('  ? But then why does final result show peak at bin 6?');
      console.log('  ? Need to check output extraction logic');
    } else {
      console.log('  ✗ Energy at unexpected position!');
    }
  }
}

main();
