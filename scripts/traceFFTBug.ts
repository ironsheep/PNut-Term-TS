/** @format */

'use strict';

/**
 * Deep trace of FFT computation to identify the bug
 */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

// Manual implementation of what Pascal does for comparison
function rev32Pascal(i: number): number {
  const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
  const result =
    ((REV4[(i >> 0) & 0xf] << 28) | (REV4[(i >> 4) & 0xf] << 24) | (REV4[(i >> 8) & 0xf] << 20)) & 0xfff00000;
  return result >>> 0; // Ensure unsigned
}

function main(): void {
  console.log('FFT Output Order Deep Trace');
  console.log('============================\n');

  const size = 512;
  const fftExp = 9;

  // Create a simple test: single frequency at bin 10
  const samples = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    const phase = (2 * Math.PI * 10 * i) / size;
    samples[i] = Math.round(1000 * Math.sin(phase));
  }

  // Run FFT
  const processor = new FFTProcessor();
  processor.prepareFFT(size);
  const result = processor.performFFT(samples, 0);

  // Find where energy ended up
  let maxPower = 0;
  let maxBin = -1;
  for (let i = 0; i < size / 2; i++) {
    if (result.power[i] > maxPower) {
      maxPower = result.power[i];
      maxBin = i;
    }
  }

  console.log(`Input: Sine wave at frequency bin 10`);
  console.log(`Output: Peak at bin ${maxBin} (power ${maxPower})\n`);

  // Now trace through what SHOULD happen according to Pascal
  console.log('Pascal Algorithm (what SHOULD happen):');
  console.log('---------------------------------------');
  console.log('After FFT butterflies complete, FFTreal[] and FFTimag[] contain results');
  console.log('in BIT-REVERSED order.\n');

  console.log('Pascal then does:');
  console.log('  for i1 := 0 to 255 do');
  console.log('    i2 := Rev32(i1) shr (32 - FFTexp);');
  console.log('    rx := FFTreal[i2];  // Read from BIT-REVERSED index');
  console.log('    ry := FFTimag[i2];');
  console.log('    FFTpower[i1] := ... // Store at NATURAL index\n');

  console.log('This UN-REVERSES the data back to natural order.\n');

  // Trace specific examples
  console.log('Trace for bin 10:');
  const i1_10 = 10;
  const i2_10 = rev32Pascal(i1_10) >>> (32 - fftExp);
  console.log(`  i1 = ${i1_10}`);
  console.log(`  Rev32(${i1_10}) = 0x${rev32Pascal(i1_10).toString(16)} = ${rev32Pascal(i1_10)}`);
  console.log(`  i2 = Rev32(${i1_10}) >>> ${32 - fftExp} = ${i2_10}`);
  console.log(`  Pascal reads FFTreal[${i2_10}] and stores result in FFTpower[${i1_10}]`);
  console.log();

  console.log('Trace for bin 6:');
  const i1_6 = 6;
  const i2_6 = rev32Pascal(i1_6) >>> (32 - fftExp);
  console.log(`  i1 = ${i1_6}`);
  console.log(`  Rev32(${i1_6}) = 0x${rev32Pascal(i1_6).toString(16)} = ${rev32Pascal(i1_6)}`);
  console.log(`  i2 = Rev32(${i1_6}) >>> ${32 - fftExp} = ${i2_6}`);
  console.log(`  Pascal reads FFTreal[${i2_6}] and stores result in FFTpower[${i1_6}]`);
  console.log();

  // Now let's understand the butterfly output
  console.log('\nHypothesis Check:');
  console.log('-----------------');
  console.log('After butterflies, a sine wave at frequency 10 will have energy at:');
  console.log('  - FFTreal[bit_reverse(10)] in bit-reversed output');
  console.log(`  - bit_reverse(10) in 9-bit space = ${i2_10}`);
  console.log();
  console.log('When Pascal un-reverses:');
  console.log(`  - It reads from FFTreal[${i2_10}] (which has the energy)`);
  console.log(`  - It stores in FFTpower[10] (natural order output)`);
  console.log('  - Result: Energy appears at bin 10 ✓ CORRECT');
  console.log();

  console.log('But our code sees peak at bin 6, so:');
  console.log('  - Something wrote to result.power[6]');
  console.log('  - Our loop does: power[i] = ... reading from fftReal[i2]');
  console.log(`  - For i=6: i2 = Rev32(6) >>> ${32 - fftExp} = ${i2_6}`);
  console.log(`  - We read fftReal[${i2_6}]`);
  console.log();

  // The key question
  console.log('KEY QUESTION:');
  console.log('-------------');
  console.log('Where is the energy actually stored after butterflies?');
  console.log();
  console.log('Theory 1: Energy at FFTreal[160] (bit-reverse of 10)');
  console.log('  - When i=10: we read FFTreal[160], store power[10] ✓ correct');
  console.log('  - When i=6: we read FFTreal[192], store power[6] - no energy unless...');
  console.log();
  console.log('Theory 2: Energy at FFTreal[10] (already in natural order)');
  console.log('  - When i=6: we read FFTreal[192], store power[6] - still wrong');
  console.log();
  console.log('Theory 3: Energy at wrong position due to butterfly bug');
  console.log('  - Need to check if butterflies are producing bit-reversed output');
  console.log();

  // Let's check the symmetry
  console.log('\nBit-reversal symmetry check:');
  console.log('---------------------------');
  for (let i = 0; i < 20; i++) {
    const i2 = rev32Pascal(i) >>> (32 - fftExp);
    const i2_reversed_back = rev32Pascal(i2) >>> (32 - fftExp);
    console.log(
      `i=${i.toString().padStart(3)} -> i2=${i2.toString().padStart(3)} -> rev(i2)=${i2_reversed_back.toString().padStart(3)}`
    );
  }
}

main();
