/** @format */

/**
 * Test to understand FFT output order after Cooley-Tukey butterfly
 */

describe('FFT Output Order Analysis', () => {
  test('Check if we should extract sequentially instead of bit-reversed', () => {
    const fftSize = 8;
    const fftExp = 3;
    const SCALE = 0x1000;

    // Setup
    const fftReal = new BigInt64Array(fftSize);
    const fftImag = new BigInt64Array(fftSize);
    const fftSin = new Int32Array(fftSize);
    const fftCos = new Int32Array(fftSize);

    const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
    function rev32(i: number): number {
      return (
        (REV4[(i >> 0) & 0xF] << 28) |
        (REV4[(i >> 4) & 0xF] << 24) |
        (REV4[(i >> 8) & 0xF] << 20)
      ) & 0xFFF00000;
    }

    // Generate sin/cos tables
    for (let i = 0; i < fftSize; i++) {
      const tf = (rev32(i) / 0x100000000) * Math.PI;
      fftSin[i] = Math.round(Math.sin(tf) * SCALE);
      fftCos[i] = Math.round(Math.cos(tf) * SCALE);
    }

    // Load sine wave at bin 2 (integer frequency)
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = Math.floor(Math.sin((i / fftSize) * Math.PI * 2 * 2) * 1000);
      fftReal[i] = BigInt(samples[i]) * BigInt(SCALE); // No windowing for clarity
      fftImag[i] = 0n;
    }

    console.log('\n=== Sine Wave at Frequency 2 (8-point FFT) ===');
    console.log('Input:', Array.from(samples).join(', '));

    // Butterfly
    let i1 = 1 << (fftExp - 1);
    let i2 = 1;
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
          const rx = (bx * BigInt(fftCos[th]) - by * BigInt(fftSin[th])) / BigInt(SCALE);
          const ry = (bx * BigInt(fftSin[th]) + by * BigInt(fftCos[th])) / BigInt(SCALE);
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

    console.log('\nAfter butterfly - Raw FFT output:');
    for (let i = 0; i < fftSize; i++) {
      const mag = Math.hypot(Number(fftReal[i]), Number(fftImag[i]));
      console.log(`  Index ${i}: real=${Number(fftReal[i]).toString().padStart(8)}, imag=${Number(fftImag[i]).toString().padStart(8)}, mag=${Math.round(mag)}`);
    }

    // Method 1: Bit-reversed extraction (current)
    console.log('\n=== Method 1: Bit-Reversed Extraction (CURRENT) ===');
    const resultSize = fftSize >> 1;
    for (let i = 0; i < resultSize; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);
      const mag = Math.hypot(Number(fftReal[i2]), Number(fftImag[i2]));
      console.log(`  Output bin ${i} ← FFT index ${i2}, magnitude=${Math.round(mag)}`);
    }

    // Method 2: Sequential extraction from first half
    console.log('\n=== Method 2: Sequential Extraction (ALTERNATIVE) ===');
    for (let i = 0; i < resultSize; i++) {
      const mag = Math.hypot(Number(fftReal[i]), Number(fftImag[i]));
      console.log(`  Output bin ${i} ← FFT index ${i}, magnitude=${Math.round(mag)}`);
    }

    console.log('\n=== Expected Result ===');
    console.log('For sine wave at frequency 2, we expect:');
    console.log('  Bin 0 (DC): ~0');
    console.log('  Bin 1: ~0');
    console.log('  Bin 2: LARGE (the signal frequency!)');
    console.log('  Bin 3: ~0');
  });
});
