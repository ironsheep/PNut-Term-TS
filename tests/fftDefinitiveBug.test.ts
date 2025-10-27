/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('FFT Definitive Bug', () => {
  it('should prove the window scaling is not being handled correctly', () => {
    const processor = new FFTProcessor();
    processor.prepareFFT(2048);

    console.log('=== THE DEFINITIVE BUG ===\n');

    // Create the EXACT samples from our log
    const samples = new Int32Array(2048);
    const logSamples = [194, 380, 552, 703, 827, 920, 979, 983, 929, 840, 719, 570, 400, 215, 21, -173, -361, -535, -689, -817];

    // This is approximately a sine wave with frequency around bin 48
    for (let i = 0; i < 2048; i++) {
      samples[i] = Math.round(1000 * Math.sin(2 * Math.PI * 48 * i / 2048));
    }

    const result = processor.performFFT(samples, 0);

    // Find the peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log('Our FFT produces:');
    console.log(`  First 20 bins: ${Array.from(result.power.slice(0, 20))}`);
    console.log(`  Max power: ${maxPower} at bin ${maxBin}`);

    console.log('\nFrom actual logs, we see:');
    console.log('  First 20 bins: 8, 17, 19, 10, 40, 10, 6, 28, 41, 30...');
    console.log('  Max power: 220 at bin 48');

    console.log('\nThe scale factor calculation:');
    const fftExp = 11;
    const magnitude = 0;
    const scale_factor = (0x800 << fftExp) >> magnitude;
    console.log(`  scale_factor = (0x800 << ${fftExp}) >> ${magnitude} = 0x${scale_factor.toString(16)} = ${scale_factor}`);

    console.log('\nPascal formula: Round(Hypot(rx, ry) / scale_factor)');
    console.log('Our formula: Math.round(Math.hypot(rx, ry) / scale_factor)');
    console.log('\nThese are IDENTICAL in structure!');

    console.log('\nThe problem:');
    console.log('  rx, ry in Pascal: int64 values scaled by 0x1000 from windowing');
    console.log('  rx, ry in ours: BigInt converted to Number, also scaled by 0x1000');
    console.log('  Both do: hypot(scaled_values) / scale_factor');

    console.log('\nBUT Pascal\'s scale_factor might be designed to compensate for the 0x1000 window scale!');
    console.log('The 0x800 constant might be chosen specifically because:');
    console.log('  0x800 * 0x1000 = 0x800000');
    console.log('  This would make the effective divisor correct for windowed values');

    console.log('\nOr, Pascal might be doing something we\'re missing in the data flow.');
  });

  it('should test if the bug is in our BigInt to Number conversion', () => {
    console.log('\n=== BIGINT CONVERSION CHECK ===\n');

    // Simulate what happens in our FFT
    const windowScale = 0x1000;
    const sampleValue = 1000;
    const windowValue = 0x1000; // Max window value

    const afterWindow = BigInt(sampleValue) * BigInt(windowValue);
    console.log(`After windowing: ${sampleValue} * 0x${windowValue.toString(16)} = ${afterWindow.toString()} (0x${afterWindow.toString(16)})`);

    // Convert to Number (what we do in power calculation)
    const asNumber = Number(afterWindow);
    console.log(`As Number: ${asNumber} (0x${asNumber.toString(16)})`);

    // Check if there's precision loss
    const backToBigInt = BigInt(asNumber);
    console.log(`Back to BigInt: ${backToBigInt.toString()}`);
    console.log(`Precision lost: ${afterWindow !== backToBigInt}`);

    // The hypot would then operate on these Number values
    const hypotResult = Math.hypot(asNumber, 0);
    console.log(`hypot result: ${hypotResult}`);

    // Divided by scale factor
    const scale_factor = 0x400000;
    const power = Math.round(hypotResult / scale_factor);
    console.log(`Power: ${hypotResult} / 0x${scale_factor.toString(16)} = ${power}`);

    // This should give us a small value like we're seeing
    expect(power).toBeLessThan(10);
  });
});