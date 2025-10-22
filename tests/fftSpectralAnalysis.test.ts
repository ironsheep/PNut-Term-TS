/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

/**
 * Detailed spectral analysis test to understand FFT behavior
 * Tests with known frequency to verify peak location and spectral purity
 */
describe('FFT Spectral Analysis', () => {
  let fftProcessor: FFTProcessor;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
  });

  test('2048-sample FFT: Analyze spectral purity for integer-frequency sine wave', () => {
    const fftSize = 2048;
    const binFrequency = 32; // Frequency that lands exactly on a bin
    fftProcessor.prepareFFT(fftSize);

    // Generate sine wave at exact bin frequency (no spectral leakage expected)
    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = Math.floor(Math.sin((i / fftSize) * Math.PI * 2 * binFrequency) * 1000);
    }

    console.log('\n=== Spectral Purity Analysis (Bin 32) ===');
    console.log(`FFT Size: ${fftSize}, Frequency Bin: ${binFrequency}`);

    const result = fftProcessor.performFFT(samples, 0);

    // Find peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log(`\nPeak: bin ${maxBin}, power ${maxPower}`);

    // Analyze power distribution around peak
    console.log(`\nPower distribution around peak:`);
    for (let i = Math.max(0, maxBin - 10); i <= Math.min(result.power.length - 1, maxBin + 10); i++) {
      const symbol = i === maxBin ? '***' : '   ';
      console.log(`  ${symbol} Bin ${i}: ${result.power[i]} (${((result.power[i] / maxPower) * 100).toFixed(1)}%)`);
    }

    // Calculate spectral purity metrics
    let totalPower = 0;
    let peakPower = result.power[maxBin];
    for (let i = 0; i < result.power.length; i++) {
      totalPower += result.power[i];
    }

    const peakRatio = peakPower / totalPower;
    const sidelobePower = totalPower - peakPower;

    console.log(`\nSpectral Purity Metrics:`);
    console.log(`  Total power: ${totalPower}`);
    console.log(`  Peak power: ${peakPower}`);
    console.log(`  Sidelobe power: ${sidelobePower}`);
    console.log(`  Peak ratio: ${(peakRatio * 100).toFixed(2)}% (higher is better)`);
    console.log(`  Sidelobe ratio: ${((sidelobePower / totalPower) * 100).toFixed(2)}%`);

    // For integer-frequency sine with Hanning window, expect peak to dominate
    // Hanning window causes some spectral leakage, but peak should still be >> sidel obes
    expect(peakRatio).toBeGreaterThan(0.5); // Peak should be at least 50% of total power
  });

  test('Analyze spectral leakage for non-integer-frequency sine wave', () => {
    const fftSize = 2048;
    const nonIntegerFreq = 32.7; // Frequency between bins
    fftProcessor.prepareFFT(fftSize);

    const samples = new Int32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      samples[i] = Math.floor(Math.sin((i / fftSize) * Math.PI * 2 * nonIntegerFreq) * 1000);
    }

    console.log('\n=== Spectral Leakage Analysis (Freq 32.7) ===');

    const result = fftProcessor.performFFT(samples, 0);

    // Find peak
    let maxPower = 0;
    let maxBin = 0;
    for (let i = 0; i < result.power.length; i++) {
      if (result.power[i] > maxPower) {
        maxPower = result.power[i];
        maxBin = i;
      }
    }

    console.log(`Peak: bin ${maxBin}, power ${maxPower}`);
    console.log(`Expected bin: ~${Math.round(nonIntegerFreq)}`);

    // Show wider range for leakage
    console.log(`\nPower around peak (showing leakage):`);
    for (let i = Math.max(0, maxBin - 5); i <= Math.min(result.power.length - 1, maxBin + 5); i++) {
      console.log(`  Bin ${i}: ${result.power[i]}`);
    }

    // Non-integer frequency should show MORE spectral leakage
    let totalPower = 0;
    for (let i = 0; i < result.power.length; i++) {
      totalPower += result.power[i];
    }

    const peakRatio = result.power[maxBin] / totalPower;
    console.log(`\nPeak ratio: ${(peakRatio * 100).toFixed(2)}%`);
    console.log('(Should be lower than integer-frequency case due to leakage)');
  });
});
