/** @format */

'use strict';

/**
 * Check exact bit-reversal mapping to understand the FFT output order bug
 */

// Rev32 function from fftProcessor.ts
function rev32(i: number, fftExp: number): number {
  const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
  const result = (
    (REV4[(i >> 0) & 0xF] << 28) |
    (REV4[(i >> 4) & 0xF] << 24) |
    (REV4[(i >> 8) & 0xF] << 20)
  ) & 0xFFF00000;
  return result >>> (32 - fftExp);
}

function main(): void {
  console.log('FFT Bit-Reversal Mapping Analysis');
  console.log('==================================\n');

  const size = 512;
  const fftExp = Math.log2(size);

  console.log(`FFT Size: ${size}`);
  console.log(`FFT Exp: ${fftExp}\n`);

  // Check the observed failures
  const testCases = [
    { expected: 10, actual: 6 },
    { expected: 50, actual: 30 },
    { expected: 100, actual: 44 }
  ];

  console.log('Checking observed failures:\n');
  for (const { expected, actual } of testCases) {
    const reversedExpected = rev32(expected, fftExp);
    const reversedActual = rev32(actual, fftExp);

    console.log(`Expected bin ${expected}:`);
    console.log(`  Binary: ${expected.toString(2).padStart(9, '0')}`);
    console.log(`  Bit-reversed: ${reversedExpected} (binary: ${reversedExpected.toString(2).padStart(9, '0')})`);
    console.log(`  Actual peak at: ${actual}`);
    console.log(`  Actual binary: ${actual.toString(2).padStart(9, '0')}`);
    console.log(`  Actual bit-reversed: ${reversedActual} (binary: ${reversedActual.toString(2).padStart(9, '0')})`);

    // Check relationship
    if (reversedExpected === actual) {
      console.log(`  ✓ RELATIONSHIP: actual = bit_reverse(expected)`);
    } else if (reversedActual === expected) {
      console.log(`  ✓ RELATIONSHIP: expected = bit_reverse(actual)`);
    } else {
      console.log(`  ✗ NO CLEAR RELATIONSHIP`);
    }
    console.log();
  }

  // Show first 20 bins and their bit-reversed positions
  console.log('\nFirst 20 bins and their bit-reversed positions:\n');
  console.log('Natural | Binary    | Reversed | Rev Binary | Double-Rev');
  console.log('--------|-----------|----------|------------|------------');
  for (let i = 0; i < 20; i++) {
    const reversed = rev32(i, fftExp);
    const doubleReversed = rev32(reversed, fftExp);
    console.log(
      `${i.toString().padStart(7)} | ${i.toString(2).padStart(9, '0')} | ${reversed.toString().padStart(8)} | ${reversed.toString(2).padStart(10, '0')} | ${doubleReversed.toString().padStart(10)}`
    );
  }

  // Check if we're applying bit-reversal when we shouldn't
  console.log('\n\nDIAGNOSIS:');
  console.log('----------');
  console.log('In fftProcessor.ts lines 174-179, we extract FFT output like this:');
  console.log('  const i2 = this.rev32(i) >>> (32 - this.fftExp);');
  console.log('  const rx = Number(this.fftReal[i2]);');
  console.log('  const ry = Number(this.fftImag[i2]);');
  console.log('');
  console.log('This means:');
  console.log('  - We iterate i = 0, 1, 2, 3, ... (natural order)');
  console.log('  - We read from bit-reversed index i2');
  console.log('  - We store result at natural index i');
  console.log('');
  console.log('The comment says: "For DIT FFT with natural-order input,');
  console.log('output is in bit-reversed order"');
  console.log('');
  console.log('However, our test shows:');
  console.log('  - Input frequency 10 appears at output bin 6');
  console.log('  - bit_reverse(10) = ' + rev32(10, fftExp));
  console.log('  - bit_reverse(6) = ' + rev32(6, fftExp));
  console.log('');

  // Final analysis
  const bin10Rev = rev32(10, fftExp);
  const bin6Rev = rev32(6, fftExp);
  console.log('Analysis:');
  console.log(`  bin 10 reversed = ${bin10Rev}`);
  console.log(`  bin 6 reversed = ${bin6Rev}`);

  if (bin6Rev === 10) {
    console.log('\n⚠ CRITICAL BUG IDENTIFIED:');
    console.log('  Our current code un-reverses when reading, causing a DOUBLE REVERSAL.');
    console.log('  - FFT naturally outputs in bit-reversed order');
    console.log('  - We reverse AGAIN when reading');
    console.log('  - Result: data appears at bit_reverse(bit_reverse(i)) = wrong position');
    console.log('');
    console.log('FIX: Remove the bit-reversal in the output extraction loop.');
    console.log('     Read directly: this.fftReal[i] instead of this.fftReal[i2]');
  }
}

main();
