/** @format */

/**
 * Test bit-reversal function to verify it matches Pascal
 */

// Copy of rev32 from FFTProcessor
function rev32(i: number): number {
  const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
  return (
    (REV4[(i >> 0) & 0xF] << 28) |
    (REV4[(i >> 4) & 0xF] << 24) |
    (REV4[(i >> 8) & 0xF] << 20)
  ) & 0xFFF00000;
}

describe('Rev32 Bit Reversal', () => {
  test('Compare with Pascal Rev32 for first 20 values', () => {
    console.log('\n=== Rev32 Bit-Reversal Test ===');
    console.log('Testing even vs odd indices for 2048-sample FFT (fftExp=11):\n');

    const fftExp = 11;

    console.log('Index | Rev32(i) | >> (32-11) | >>> (32-11) | Expected for 2048');
    console.log('------|----------|------------|-------------|------------------');

    for (let i = 0; i < 20; i++) {
      const rev = rev32(i);
      const signedShift = rev >> (32 - fftExp);
      const unsignedShift = rev >>> (32 - fftExp);
      const symbol = (i % 2 === 0) ? 'EVEN' : 'ODD ';

      console.log(
        `${i.toString().padStart(5)} | 0x${rev.toString(16).padStart(8, '0')} | ${signedShift.toString().padStart(10)} | ${unsignedShift.toString().padStart(11)} | ${symbol}`
      );
    }

    // Check if even indices produce different results than odd
    console.log('\n=== Checking for pattern in output indices ===');
    const outputIndices: number[] = [];
    for (let i = 0; i < 40; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);
      outputIndices.push(i2);
    }

    console.log('First 40 output indices:', outputIndices.join(', '));

    // Check if all output indices are unique
    const uniqueIndices = new Set(outputIndices);
    console.log(`\nUnique indices: ${uniqueIndices.size} out of ${outputIndices.length}`);

    if (uniqueIndices.size !== outputIndices.length) {
      console.log('❌ PROBLEM: Duplicate indices detected!');
      // Find duplicates
      const seen = new Set<number>();
      const duplicates = new Set<number>();
      for (const idx of outputIndices) {
        if (seen.has(idx)) {
          duplicates.add(idx);
        }
        seen.add(idx);
      }
      console.log('Duplicate indices:', Array.from(duplicates).join(', '));
    } else {
      console.log('✓ All indices are unique (no duplicates)');
    }
  });

  test('Verify rev32 produces correct bit-reversal pattern', () => {
    // For a small FFT size, manually verify the pattern
    const fftExp = 4; // 16-point FFT for easy manual verification
    const fftSize = 1 << fftExp;
    const resultSize = fftSize >> 1; // 8 results

    console.log(`\n=== Manual Verification for ${fftSize}-point FFT ===`);
    console.log('Input | Binary    | Reversed  | Output');
    console.log('------|-----------|-----------|-------');

    for (let i = 0; i < resultSize; i++) {
      const i2 = rev32(i) >>> (32 - fftExp);
      const inputBin = i.toString(2).padStart(4, '0');
      const reversedBin = i2.toString(2).padStart(4, '0');

      console.log(`${i.toString().padStart(5)} | ${inputBin} | ${reversedBin} | ${i2}`);

      // Verify: manually reverse the bits
      const manualReverse = parseInt(inputBin.split('').reverse().join(''), 2);
      expect(i2).toBe(manualReverse);
    }
  });
});
