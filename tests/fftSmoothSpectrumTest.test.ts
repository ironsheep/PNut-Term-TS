/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

/**
 * Test if sequential extraction produces a smooth spectrum
 * like Pascal's target image shows
 */
describe('FFT Smooth Spectrum Test', () => {
  test('Pure sine wave should produce smooth bell curve around peak', () => {
    const fftSize = 2048;
    const peakFreq = 32; // Sine wave at bin 32

    const fftProcessor = new FFTProcessor();
    fftProcessor.prepareFFT(fftSize);

    // Generate pure sine wave at exact bin frequency
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = Math.floor(Math.sin((i / fftSize) * Math.PI * 2 * peakFreq) * 1000);
    }

    const result = fftProcessor.performFFT(samples, 0);

    console.log('\n=== Testing for Smooth Spectrum ===');
    console.log(`Expected: Smooth bell curve centered at bin ${peakFreq}`);

    // Find peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log(`\nActual peak: bin ${maxBin}, power ${maxPower}`);
    expect(maxBin).toBe(peakFreq);

    // Check for smooth distribution around peak
    // A smooth spectrum should have:
    // 1. Peak at expected frequency
    // 2. Gradual falloff on both sides (not random jumps)
    // 3. Low power far from peak

    console.log('\nPower distribution around peak:');
    const range = 10;
    for (let i = Math.max(0, maxBin - range); i <= Math.min(result.power.length - 1, maxBin + range); i++) {
      const pct = ((result.power[i] / maxPower) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(result.power[i] / maxPower * 20));
      console.log(`  Bin ${i.toString().padStart(3)}: ${result.power[i].toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
    }

    // Test smoothness: adjacent bins shouldn't differ wildly
    console.log('\n=== Smoothness Check ===');
    let maxJump = 0;
    let jumpLocation = -1;

    for (let i = maxBin - range; i < maxBin + range; i++) {
      if (i < 0 || i >= result.power.length - 1) continue;

      const diff = Math.abs(result.power[i + 1] - result.power[i]);
      if (diff > maxJump) {
        maxJump = diff;
        jumpLocation = i;
      }
    }

    console.log(`Max jump in ±${range} bins around peak: ${maxJump} at bin ${jumpLocation}→${jumpLocation + 1}`);
    console.log(`Jump: ${result.power[jumpLocation]} → ${result.power[jumpLocation + 1]}`);

    // For smooth spectrum with Hanning window, adjacent bins shouldn't jump more than ~50% of peak
    const jumpThreshold = maxPower * 0.5;
    console.log(`Jump threshold (50% of peak): ${jumpThreshold}`);

    if (maxJump > jumpThreshold) {
      console.log('❌ JAGGED: Large jumps indicate non-smooth spectrum');
    } else {
      console.log('✅ SMOOTH: Gradual transitions indicate smooth spectrum');
    }

    // Test that power decreases smoothly as we move away from peak
    console.log('\n=== Distance-from-Peak Test ===');
    let prevPower = result.power[maxBin];
    let monotonic = true;

    for (let dist = 1; dist <= 5; dist++) {
      const leftBin = maxBin - dist;
      const rightBin = maxBin + dist;

      if (leftBin >= 0) {
        const leftPower = result.power[leftBin];
        console.log(`  ${dist} bins left of peak: ${leftPower} ${leftPower <= prevPower ? '✓' : '✗ INCREASED!'}`);
        if (leftPower > prevPower) monotonic = false;
      }

      if (rightBin < result.power.length) {
        const rightPower = result.power[rightBin];
        console.log(`  ${dist} bins right of peak: ${rightPower} ${rightPower <= prevPower ? '✓' : '✗ INCREASED!'}`);
        if (rightPower > prevPower) monotonic = false;
      }
    }

    if (monotonic) {
      console.log('✅ Power decreases smoothly away from peak');
    } else {
      console.log('❌ Power increases away from peak - NOT smooth!');
    }
  });
});
