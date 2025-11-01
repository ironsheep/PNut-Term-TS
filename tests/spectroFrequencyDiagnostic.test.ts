/** @format */

/**
 * SPECTRO Frequency Diagnostic Test
 *
 * This test isolates the FFT frequency mapping issue by testing:
 * 1. Direct FFT processor with known inputs
 * 2. Comparison of sine wave generation formulas
 * 3. Verification of FFT bin → frequency mapping
 */

'use strict';

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('SPECTRO Frequency Diagnostic', () => {
  let fftProcessor: FFTProcessor;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
  });

  describe('Sine Wave Generation Formula Verification', () => {
    it('should clarify the relationship between bin number and sine wave generation', () => {
      const fftSize = 2048;
      const targetBin = 10;

      console.log('\n========================================');
      console.log('SINE WAVE FORMULA ANALYSIS');
      console.log('========================================\n');

      console.log('FFT Properties:');
      console.log(`- FFT Size (N): ${fftSize}`);
      console.log(`- Sample rate (normalized): 1.0`);
      console.log(`- Frequency resolution: 1/N = ${1/fftSize}`);
      console.log(`- Target bin: ${targetBin}`);
      console.log(`- Expected frequency: bin/N = ${targetBin}/${fftSize} = ${targetBin/fftSize}\n`);

      console.log('Sine Wave Generation Formula:');
      console.log(`  sample[i] = A * sin(2π * f * i / N)`);
      console.log(`  where f = target_bin (NOT target_bin/N!)`);
      console.log(`  This creates a sine wave that completes ${targetBin} full cycles over N samples\n`);

      console.log('Verification:');
      console.log(`- For bin ${targetBin}, use: sin(2π * ${targetBin} * i / ${fftSize})`);
      console.log(`- This completes ${targetBin} cycles in ${fftSize} samples`);
      console.log(`- FFT will detect energy at bin ${targetBin}\n`);

      // Generate test samples
      const amplitude = 1000;
      const samples = new Int32Array(fftSize);

      for (let i = 0; i < fftSize; i++) {
        samples[i] = Math.round(amplitude * Math.sin((2 * Math.PI * targetBin * i) / fftSize));
      }

      // Show first few samples
      console.log('First 10 samples:');
      for (let i = 0; i < 10; i++) {
        const phase = (2 * Math.PI * targetBin * i) / fftSize;
        console.log(`  [${i}] = ${samples[i].toString().padStart(5)} (phase: ${phase.toFixed(4)} rad)`);
      }

      // Verify it completes exact cycles
      const finalSample = samples[fftSize - 1];
      const expectedFinalSample = Math.round(amplitude * Math.sin((2 * Math.PI * targetBin * (fftSize - 1)) / fftSize));
      console.log(`\nLast sample [${fftSize-1}] = ${finalSample}`);
      console.log(`Expected (should be close to first sample for perfect cycle): ${expectedFinalSample}`);
      console.log(`First sample: ${samples[0]}`);
      console.log('========================================\n');
    });
  });

  describe('Direct FFT Processor Test', () => {
    it('should identify correct bin for pure sine wave input', () => {
      const fftSize = 2048;
      const targetBin = 10;
      const amplitude = 1000;

      // Prepare FFT
      fftProcessor.prepareFFT(fftSize);

      // Generate sine wave
      const samples = new Int32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        samples[i] = Math.round(amplitude * Math.sin((2 * Math.PI * targetBin * i) / fftSize));
      }

      // Perform FFT
      const result = fftProcessor.performFFT(samples, 0);

      // Find peak
      let maxPower = 0;
      let peakBin = -1;
      for (let i = 0; i < result.power.length; i++) {
        if (result.power[i] > maxPower) {
          maxPower = result.power[i];
          peakBin = i;
        }
      }

      console.log('\n========================================');
      console.log('DIRECT FFT PROCESSOR TEST');
      console.log('========================================\n');

      console.log('Input:');
      console.log(`- Target bin: ${targetBin}`);
      console.log(`- FFT size: ${fftSize}`);
      console.log(`- Amplitude: ${amplitude}\n`);

      console.log('Output:');
      console.log(`- Peak bin: ${peakBin}`);
      console.log(`- Peak power: ${maxPower}`);
      console.log(`- Match: ${peakBin === targetBin ? 'YES ✅' : 'NO ❌'}\n`);

      // Show power distribution around target
      console.log('Power distribution around target bin:');
      for (let i = Math.max(0, targetBin - 3); i <= Math.min(result.power.length - 1, targetBin + 3); i++) {
        const marker = i === peakBin ? ' <-- PEAK' : (i === targetBin ? ' <-- TARGET' : '');
        console.log(`  Bin ${i.toString().padStart(3)}: ${result.power[i].toString().padStart(8)}${marker}`);
      }

      console.log('\nTop 5 bins by power:');
      const sorted = Array.from(result.power)
        .map((power, bin) => ({ bin, power }))
        .sort((a, b) => b.power - a.power)
        .slice(0, 5);

      sorted.forEach((entry, rank) => {
        console.log(`  ${rank + 1}. Bin ${entry.bin.toString().padStart(3)}: ${entry.power}`);
      });

      console.log('========================================\n');

      // Assertion
      expect(peakBin).toBe(targetBin);
    });

    it('should test multiple target bins to verify consistent behavior', () => {
      const fftSize = 2048;
      const amplitude = 1000;
      const testBins = [1, 5, 10, 20, 50, 100, 200];

      fftProcessor.prepareFFT(fftSize);

      console.log('\n========================================');
      console.log('MULTI-BIN FREQUENCY MAPPING TEST');
      console.log('========================================\n');

      console.log('Testing frequency mapping across multiple bins:\n');

      const results: Array<{target: number, peak: number, power: number, match: boolean}> = [];

      for (const targetBin of testBins) {
        // Generate sine wave
        const samples = new Int32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
          samples[i] = Math.round(amplitude * Math.sin((2 * Math.PI * targetBin * i) / fftSize));
        }

        // Perform FFT
        const result = fftProcessor.performFFT(samples, 0);

        // Find peak
        let maxPower = 0;
        let peakBin = -1;
        for (let i = 0; i < result.power.length; i++) {
          if (result.power[i] > maxPower) {
            maxPower = result.power[i];
            peakBin = i;
          }
        }

        const match = peakBin === targetBin;
        results.push({ target: targetBin, peak: peakBin, power: maxPower, match });

        const status = match ? '✅' : '❌';
        const ratio = targetBin > 0 ? (peakBin / targetBin).toFixed(2) : 'N/A';
        console.log(`  Target: ${targetBin.toString().padStart(3)} → Peak: ${peakBin.toString().padStart(3)} (ratio: ${ratio}) ${status}`);
      }

      console.log('\nSummary:');
      const passing = results.filter(r => r.match).length;
      const failing = results.filter(r => !r.match).length;
      console.log(`- Passing: ${passing}/${testBins.length}`);
      console.log(`- Failing: ${failing}/${testBins.length}`);

      if (failing > 0) {
        console.log('\nFailed bins analysis:');
        const failed = results.filter(r => !r.match);
        failed.forEach(r => {
          const ratio = r.target > 0 ? (r.peak / r.target).toFixed(3) : 'N/A';
          const difference = r.peak - r.target;
          console.log(`  Bin ${r.target}: found at ${r.peak} (ratio: ${ratio}, diff: ${difference})`);
        });

        // Check for consistent scaling factor
        const ratios = failed.map(r => r.peak / r.target);
        const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
        console.log(`  Average ratio: ${avgRatio.toFixed(4)}`);

        if (Math.abs(avgRatio - 0.5) < 0.01) {
          console.log('  ⚠️  CONSISTENT 2X SHIFT DETECTED - peaks appear at half expected frequency!');
        } else if (Math.abs(avgRatio - 2.0) < 0.01) {
          console.log('  ⚠️  CONSISTENT 0.5X SHIFT DETECTED - peaks appear at double expected frequency!');
        }
      }

      console.log('========================================\n');

      // All should match
      expect(failing).toBe(0);
    });
  });

  describe('FFT Output Array Structure', () => {
    it('should verify FFT output array length and bin indices', () => {
      const fftSize = 2048;
      fftProcessor.prepareFFT(fftSize);

      const samples = new Int32Array(fftSize).fill(0);
      const result = fftProcessor.performFFT(samples, 0);

      console.log('\n========================================');
      console.log('FFT OUTPUT ARRAY STRUCTURE');
      console.log('========================================\n');

      console.log('Array dimensions:');
      console.log(`- Input samples: ${fftSize}`);
      console.log(`- Output power array length: ${result.power.length}`);
      console.log(`- Output angle array length: ${result.angle.length}`);
      console.log(`- Expected output length: ${fftSize / 2} (N/2 for real FFT)\n`);

      console.log('Frequency bin mapping:');
      console.log(`- Bin 0: DC component (0 Hz)`);
      console.log(`- Bin 1: 1/${fftSize} of sample rate`);
      console.log(`- Bin k: k/${fftSize} of sample rate`);
      console.log(`- Bin ${result.power.length - 1}: Nyquist frequency (0.5 * sample rate)\n`);

      console.log('Index verification:');
      console.log(`- result.power[10] represents frequency bin 10`);
      console.log(`- Frequency: 10/${fftSize} = ${(10/fftSize).toFixed(6)}\n`);

      console.log('========================================\n');

      expect(result.power.length).toBe(fftSize / 2);
      expect(result.angle.length).toBe(fftSize / 2);
    });
  });
});
