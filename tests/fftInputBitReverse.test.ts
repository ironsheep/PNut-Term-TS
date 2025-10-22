/** @format */

/**
 * Test if we should bit-reverse the INPUT before the butterfly
 * instead of the output after
 */

describe('FFT Input Bit-Reversal Test', () => {
  test('Compare: bit-reversed input vs natural-order input', () => {
    const fftSize = 8;
    const fftExp = 3;
    const SCALE = 0x1000;

    const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
    function rev32(i: number): number {
      return (
        (REV4[(i >> 0) & 0xF] << 28) |
        (REV4[(i >> 4) & 0xF] << 24) |
        (REV4[(i >> 8) & 0xF] << 20)
      ) & 0xFFF00000;
    }

    // Generate sin/cos tables
    const fftSin = new Int32Array(fftSize);
    const fftCos = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const tf = (rev32(i) / 0x100000000) * Math.PI;
      fftSin[i] = Math.round(Math.sin(tf) * SCALE);
      fftCos[i] = Math.round(Math.cos(tf) * SCALE);
    }

    // Test signal: sine wave at frequency 2
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = Math.floor(Math.sin((i / fftSize) * Math.PI * 2 * 2) * 1000);
    }

    console.log('\n=== Method 1: Natural-Order Input (CURRENT) ===');
    {
      const fftReal = new BigInt64Array(fftSize);
      const fftImag = new BigInt64Array(fftSize);

      // Load in natural order
      for (let i = 0; i < fftSize; i++) {
        fftReal[i] = BigInt(samples[i]) * BigInt(SCALE);
        fftImag[i] = 0n;
      }

      // Butterfly
      let i1 = 1 << (fftExp - 1);
      let i2 = 1;
      while (i1 !== 0) {
        let th = 0, i3 = 0, i4 = i1, c1 = i2;
        while (c1 !== 0) {
          let ptra = i3, ptrb = ptra + i1, c2 = i4 - i3;
          while (c2 !== 0) {
            const ax = fftReal[ptra], ay = fftImag[ptra];
            const bx = fftReal[ptrb], by = fftImag[ptrb];
            const rx = (bx * BigInt(fftCos[th]) - by * BigInt(fftSin[th])) / BigInt(SCALE);
            const ry = (bx * BigInt(fftSin[th]) + by * BigInt(fftCos[th])) / BigInt(SCALE);
            fftReal[ptra] = ax + rx;
            fftImag[ptra] = ay + ry;
            fftReal[ptrb] = ax - rx;
            fftImag[ptrb] = ay - ry;
            ptra++; ptrb++; c2--;
          }
          th++; i3 += i1 << 1; i4 += i1 << 1; c1--;
        }
        i1 >>= 1; i2 <<= 1;
      }

      console.log('Output (after butterfly):');
      for (let i = 0; i < fftSize; i++) {
        const mag = Math.round(Math.hypot(Number(fftReal[i]), Number(fftImag[i])));
        console.log(`  [${i}]: mag=${mag.toString().padStart(8)}`);
      }
    }

    console.log('\n=== Method 2: Bit-Reversed Input ===');
    {
      const fftReal = new BigInt64Array(fftSize);
      const fftImag = new BigInt64Array(fftSize);

      // Load in BIT-REVERSED order
      for (let i = 0; i < fftSize; i++) {
        const i2 = rev32(i) >>> (32 - fftExp);
        fftReal[i2] = BigInt(samples[i]) * BigInt(SCALE);
        fftImag[i2] = 0n;
      }

      console.log('Input (after bit-reversal):');
      for (let i = 0; i < fftSize; i++) {
        console.log(`  [${i}]: ${Number(fftReal[i]) / SCALE}`);
      }

      // Same butterfly
      let i1 = 1 << (fftExp - 1);
      let i2 = 1;
      while (i1 !== 0) {
        let th = 0, i3 = 0, i4 = i1, c1 = i2;
        while (c1 !== 0) {
          let ptra = i3, ptrb = ptra + i1, c2 = i4 - i3;
          while (c2 !== 0) {
            const ax = fftReal[ptra], ay = fftImag[ptra];
            const bx = fftReal[ptrb], by = fftImag[ptrb];
            const rx = (bx * BigInt(fftCos[th]) - by * BigInt(fftSin[th])) / BigInt(SCALE);
            const ry = (bx * BigInt(fftSin[th]) + by * BigInt(fftCos[th])) / BigInt(SCALE);
            fftReal[ptra] = ax + rx;
            fftImag[ptra] = ay + ry;
            fftReal[ptrb] = ax - rx;
            fftImag[ptrb] = ay - ry;
            ptra++; ptrb++; c2--;
          }
          th++; i3 += i1 << 1; i4 += i1 << 1; c1--;
        }
        i1 >>= 1; i2 <<= 1;
      }

      console.log('\nOutput (after butterfly):');
      for (let i = 0; i < fftSize; i++) {
        const mag = Math.round(Math.hypot(Number(fftReal[i]), Number(fftImag[i])));
        console.log(`  [${i}]: mag=${mag.toString().padStart(8)}`);
      }
    }

    console.log('\n=== Analysis ===');
    console.log('If Method 2 (bit-reversed input) produces natural-order output,');
    console.log('then we should bit-reverse input BEFORE butterfly, not after!');
  });
});
