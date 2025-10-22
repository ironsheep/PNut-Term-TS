/** @format */

/**
 * Test FFT butterfly WITHOUT Hanning window to isolate the algorithm
 * This bypasses windowing to verify pure butterfly calculation
 */

describe('FFT Without Hanning Window', () => {
  test('DC signal without windowing should have 100% power in bin 0', () => {
    const fftSize = 8;
    const fftExp = 3;
    const SCALE = 0x1000;

    // Initialize arrays
    const fftReal = new BigInt64Array(fftSize);
    const fftImag = new BigInt64Array(fftSize);

    // Generate sin/cos tables
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

    for (let i = 0; i < fftSize; i++) {
      const tf = (rev32(i) / 0x100000000) * Math.PI;
      fftSin[i] = Math.round(Math.sin(tf) * SCALE);
      fftCos[i] = Math.round(Math.cos(tf) * SCALE);
    }

    console.log('\n=== DC Signal WITHOUT Hanning Window ===');

    // Load DC signal WITHOUT windowing - just multiply by SCALE to match fixed-point
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = 100;
      fftReal[i] = BigInt(samples[i]) * BigInt(SCALE); // No windowing!
      fftImag[i] = 0n;
    }

    console.log('Input (constant):', Array.from(samples).join(', '));
    console.log('fftReal after load (no window):', Array.from(fftReal).map(v => Number(v)).join(', '));

    // Butterfly (matching our implementation exactly)
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

    console.log('\nAfter butterfly:');
    console.log('fftReal:', Array.from(fftReal).map(v => Number(v)).join(', '));
    console.log('fftImag:', Array.from(fftImag).map(v => Number(v)).join(', '));

    // Extract power
    const resultSize = fftSize >> 1;
    const power = new Int32Array(resultSize);

    console.log('\n=== Extracting Power ===');
    for (let i = 0; i < resultSize; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);
      const rx = Number(fftReal[i2]);
      const ry = Number(fftImag[i2]);
      const scale_factor = (0x800 << fftExp) >> 0; // magnitude=0
      power[i] = Math.round(Math.hypot(rx, ry) / scale_factor);

      console.log(`Bin ${i}: real=${rx}, imag=${ry}, power=${power[i]}`);
    }

    const totalPower = power.reduce((sum, p) => sum + p, 0);
    const bin0Ratio = power[0] / totalPower;
    console.log(`\nBin 0 ratio: ${(bin0Ratio * 100).toFixed(1)}% (should be 100% for constant signal)`);

    // For constant DC signal (no windowing), ALL power should be in bin 0
    expect(bin0Ratio).toBeGreaterThan(0.99);
  });
});
