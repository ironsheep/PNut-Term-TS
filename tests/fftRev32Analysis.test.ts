/** @format */

/**
 * Deep analysis of rev32 function for different FFT sizes
 */

describe('Rev32 Function Analysis', () => {
  const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];

  function rev32(i: number): number {
    return (
      (REV4[(i >> 0) & 0xF] << 28) |
      (REV4[(i >> 4) & 0xF] << 24) |
      (REV4[(i >> 8) & 0xF] << 20)
    ) & 0xFFF00000;
  }

  test('Rev32 for 8-point FFT (fftExp=3)', () => {
    const fftExp = 3;
    const fftSize = 1 << fftExp; // 8
    const resultSize = fftSize >> 1; // 4

    console.log('\n=== 8-Point FFT Bit-Reversal ===');
    console.log('fftSize=8, resultSize=4, fftExp=3');
    console.log('\nInput i | Rev32(i) | Shift | i2=Rev32(i)>>>(32-3) | Valid? | Notes');
    console.log('--------|----------|-------|----------------------|--------|------');

    for (let i = 0; i < resultSize; i++) {
      const rev = rev32(i);
      const i2 = rev >>> (32 - fftExp);
      const valid = i2 < fftSize;
      const notes = i2 === 0 ? 'DC' : i2 === fftSize/2 ? 'Nyquist' : i2 < fftSize/2 ? 'Pos freq' : 'Neg freq!';

      console.log(
        `${i.toString().padStart(7)} | 0x${rev.toString(16).padStart(8,'0')} | ${(32-fftExp).toString().padStart(5)} | ${i2.toString().padStart(20)} | ${valid?'YES':'NO!'} | ${notes}`
      );
    }
  });

  test('Rev32 for 2048-point FFT (fftExp=11)', () => {
    const fftExp = 11;
    const fftSize = 1 << fftExp; // 2048
    const resultSize = fftSize >> 1; // 1024

    console.log('\n=== 2048-Point FFT Bit-Reversal ===');
    console.log('fftSize=2048, resultSize=1024, fftExp=11');
    console.log('\nFirst 20 indices:');
    console.log('Input i | Rev32(i) | Shift | i2=Rev32(i)>>>(32-11) | Valid? | Notes');
    console.log('--------|----------|-------|----------------------|--------|------');

    for (let i = 0; i < 20; i++) {
      const rev = rev32(i);
      const i2 = rev >>> (32 - fftExp);
      const valid = i2 < fftSize;
      const notes = i2 === 0 ? 'DC' :
                   i2 === fftSize/2 ? 'Nyquist' :
                   i2 < fftSize/2 ? 'Pos freq' :
                   'NEG FREQ!';

      console.log(
        `${i.toString().padStart(7)} | 0x${rev.toString(16).padStart(8,'0')} | ${(32-fftExp).toString().padStart(5)} | ${i2.toString().padStart(20)} | ${valid?'YES':'NO!'} | ${notes}`
      );
    }

    // Count positives vs negatives
    let posCount = 0;
    let negCount = 0;
    for (let i = 0; i < resultSize; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);
      if (i2 < fftSize / 2) {
        posCount++;
      } else {
        negCount++;
      }
    }

    console.log(`\n=== Summary for ${resultSize} output bins ===`);
    console.log(`Positive frequencies (0-1023): ${posCount}`);
    console.log(`Negative frequencies (1024-2047): ${negCount}`);
  });
});
