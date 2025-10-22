/** @format */

/**
 * Trace bit-reversal extraction to understand what bins we're actually reading
 */

describe('FFT Bit-Reversal Detailed Trace', () => {
  const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];

  function rev32(i: number): number {
    return (
      (REV4[(i >> 0) & 0xF] << 28) |
      (REV4[(i >> 4) & 0xF] << 24) |
      (REV4[(i >> 8) & 0xF] << 20)
    ) & 0xFFF00000;
  }

  test('Trace 2048-point FFT extraction indices', () => {
    const fftSize = 2048;
    const fftExp = 11;
    const resultSize = fftSize >> 1; // 1024

    console.log('\n=== 2048-Point FFT Extraction Mapping ===');
    console.log('First 32 output bins - which FFT bins do they read from?');
    console.log('Output | FFT Index | Frequency Type');
    console.log('-------|-----------|---------------');

    for (let i = 0; i < 32; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);

      // For real FFT, bins 0 to 1023 are positive frequencies
      // Bins 1024-2047 are negative frequencies (conjugates)
      let freqType = '';
      if (i2 === 0) freqType = 'DC';
      else if (i2 === 1024) freqType = 'Nyquist';
      else if (i2 < 1024) freqType = 'Positive';
      else freqType = 'NEGATIVE (conjugate)';

      const marker = freqType.includes('NEGATIVE') ? ' ⚠️ ' : '   ';
      console.log(`${marker}${i.toString().padStart(4)} | ${i2.toString().padStart(9)} | ${freqType}`);
    }

    // Count how many negative frequency bins we're extracting
    let positiveCount = 0;
    let negativeCount = 0;
    for (let i = 0; i < resultSize; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);
      if (i2 >= 1024) {
        negativeCount++;
      } else {
        positiveCount++;
      }
    }

    console.log(`\n=== Extraction Summary ===`);
    console.log(`Total bins: ${resultSize}`);
    console.log(`Positive frequency bins extracted: ${positiveCount}`);
    console.log(`Negative frequency bins extracted: ${negativeCount}`);

    if (negativeCount > 0) {
      console.log(`\n❌ BUG: We're extracting ${negativeCount} bins from NEGATIVE frequencies!`);
      console.log(`For real FFT, we should ONLY extract from bins 0-1023 (positive frequencies)`);
    }
  });

  test('Compare with sequential extraction (what we should be doing)', () => {
    const fftSize = 2048;
    const fftExp = 11;
    const resultSize = fftSize >> 1; // 1024

    console.log('\n=== What Sequential Extraction Would Give ===');
    console.log('First 32 bins:');
    console.log('Output | FFT Index | Frequency');
    console.log('-------|-----------|----------');

    for (let i = 0; i < 32; i++) {
      // Sequential: just use i directly
      const i2 = i;
      let freq = '';
      if (i === 0) freq = 'DC';
      else if (i === 1024) freq = 'Nyquist';
      else freq = `${i} cycles`;

      console.log(`   ${i.toString().padStart(4)} | ${i2.toString().padStart(9)} | ${freq}`);
    }

    console.log('\n✅ Sequential extraction reads bins 0-1023 (all positive frequencies)');
    console.log('This is what we should be doing for real FFT!');
  });
});
