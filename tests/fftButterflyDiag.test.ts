/** @format */

/**
 * Diagnostic test to inspect FFT butterfly output
 * We'll create a minimal FFT implementation with full logging
 */

describe('FFT Butterfly Diagnostic', () => {
  test('Manual 8-point FFT with full logging', () => {
    const fftSize = 8;
    const fftExp = 3;
    const SCALE = 0x1000;

    // Initialize arrays
    const fftReal = new BigInt64Array(fftSize);
    const fftImag = new BigInt64Array(fftSize);

    // Generate sin/cos tables
    const fftSin = new Int32Array(fftSize);
    const fftCos = new Int32Array(fftSize);
    const fftWin = new Int32Array(fftSize);

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
      fftWin[i] = Math.round((1 - Math.cos((i / fftSize) * Math.PI * 2)) * SCALE);
    }

    // DC input: all samples = 100
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = 100;
    }

    console.log('\n=== Manual 8-Point FFT for DC Signal ===');
    console.log('Input:', Array.from(samples).join(', '));

    // Load with Hanning window
    for (let i = 0; i < fftSize; i++) {
      fftReal[i] = BigInt(samples[i]) * BigInt(fftWin[i]);
      fftImag[i] = 0n;
    }

    console.log('\nAfter windowing (fftReal):');
    console.log(Array.from(fftReal).map(v => Number(v)).join(', '));

    // Butterfly
    let i1 = 1 << (fftExp - 1);
    let i2 = 1;

    console.log('\n=== Butterfly Calculation ===');
    console.log(`Starting: i1=${i1}, i2=${i2}`);

    while (i1 !== 0) {
      console.log(`\nOuter loop: i1=${i1}, i2=${i2}`);

      let th = 0;
      let i3 = 0;
      let i4 = i1;
      let c1 = i2;

      while (c1 !== 0) {
        let ptra = i3;
        let ptrb = ptra + i1;
        let c2 = i4 - i3;

        console.log(`  Middle loop: th=${th}, i3=${i3}, i4=${i4}, c1=${c1}, c2=${c2}`);

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

          if (c2 === i4 - i3) {
            // First iteration - log it
            console.log(`    Butterfly: ptra=${ptra}, ptrb=${ptrb}`);
            console.log(`      ax=${ax}, bx=${bx}, cos[${th}]=${fftCos[th]}, sin[${th}]=${fftSin[th]}`);
            console.log(`      rx=${rx}, ry=${ry}`);
            console.log(`      real[${ptra}] = ${ax + rx}, real[${ptrb}] = ${ax - rx}`);
          }

          ptra++;
          ptrb++;
          c2--;
        }

        th++;
        i3 += i1 << 1;
        i4 += i1 << 1;
        c1--;
      }

      console.log(`After butterfly stage:`);
      console.log(`  fftReal: ${Array.from(fftReal).map(v => Number(v)).join(', ')}`);

      i1 >>= 1;
      i2 <<= 1;
    }

    console.log('\n=== Final FFT Arrays ===');
    console.log('fftReal:', Array.from(fftReal).map(v => Number(v)).join(', '));
    console.log('fftImag:', Array.from(fftImag).map(v => Number(v)).join(', '));

    // Extract power
    const resultSize = fftSize >> 1;
    const power = new Int32Array(resultSize);

    console.log('\n=== Extracting Power (bit-reversed) ===');
    for (let i = 0; i < resultSize; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);
      const rx = Number(fftReal[i2]);
      const ry = Number(fftImag[i2]);
      const scale_factor = (0x800 << fftExp) >> 0; // magnitude=0
      power[i] = Math.round(Math.hypot(rx, ry) / scale_factor);

      console.log(`i=${i} → i2=${i2}, real=${rx}, imag=${ry}, power=${power[i]}`);
    }

    console.log('\nFinal Power Array:', Array.from(power).join(', '));
    console.log(`\nBin 0: ${power[0]} (should have >>99% of power for DC signal)`);

    const totalPower = power.reduce((sum, p) => sum + p, 0);
    console.log(`Bin 0 ratio: ${((power[0] / totalPower) * 100).toFixed(1)}%`);
  });
});
