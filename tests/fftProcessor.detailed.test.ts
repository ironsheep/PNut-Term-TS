/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

/**
 * Detailed FFT Test Cases with Known Expected Outputs
 *
 * Purpose: Create test cases that reveal bit-reversal bugs by testing:
 * 1. DC signal (all samples = 1000) - should have power in bin 0
 * 2. Nyquist frequency (alternating +1000, -1000) - should have power in bin 512
 * 3. Single frequency bin 10 - should have power in bin 10
 *
 * These tests use a 1024-point FFT for clarity (512 output bins).
 */

describe('FFT Processor - Detailed Test Cases with Known Expected Outputs', () => {
  let processor: FFTProcessor;
  const FFT_SIZE = 1024;
  const OUTPUT_BINS = FFT_SIZE / 2; // 512 bins
  const MAGNITUDE = 0; // No magnitude scaling for clarity

  beforeEach(() => {
    processor = new FFTProcessor();
    processor.prepareFFT(FFT_SIZE);
  });

  describe('Test 1: DC Signal', () => {
    it('should place all power in bin 0 for DC signal', () => {
      console.log('\n=== TEST 1: DC SIGNAL ===');

      // Create DC signal: all samples = 1000
      const samples = new Int32Array(FFT_SIZE);
      samples.fill(1000);

      console.log(`Input: DC signal (all samples = 1000)`);
      console.log(`FFT size: ${FFT_SIZE}`);
      console.log(`Expected: power[0] should be MAXIMUM, all others near zero\n`);

      // Perform FFT
      const result = processor.performFFT(samples, MAGNITUDE);

      // Find maximum power and its location
      let maxPower = 0;
      let maxBin = -1;
      for (let i = 0; i < OUTPUT_BINS; i++) {
        if (result.power[i] > maxPower) {
          maxPower = result.power[i];
          maxBin = i;
        }
      }

      console.log(`RESULT:`);
      console.log(`  Maximum power: ${maxPower} at bin ${maxBin}`);
      console.log(`  Expected bin: 0`);
      console.log(`  Status: ${maxBin === 0 ? 'PASS ✓' : 'FAIL ✗'}`);

      // Show first 10 bins
      console.log(`\nFirst 10 bins:`);
      for (let i = 0; i < 10; i++) {
        const marker = i === maxBin ? ' ← PEAK' : '';
        console.log(`  Bin ${i}: ${result.power[i]}${marker}`);
      }

      // Calculate ratio of DC power to next highest
      const secondHighest = Math.max(...Array.from(result.power.slice(1, 10)));
      const ratio = maxPower / secondHighest;
      console.log(`\nDC power / next highest: ${ratio.toFixed(1)}x`);
      console.log(`(Should be >> 10x for pure DC signal)\n`);

      // Test assertion
      expect(maxBin).toBe(0);
      expect(ratio).toBeGreaterThan(10);
    });
  });

  describe('Test 2: Nyquist Frequency', () => {
    it('should place all power in bin 512 for Nyquist frequency (alternating +1000/-1000)', () => {
      console.log('\n=== TEST 2: NYQUIST FREQUENCY ===');

      // Create Nyquist signal: alternating +1000, -1000
      const samples = new Int32Array(FFT_SIZE);
      for (let i = 0; i < FFT_SIZE; i++) {
        samples[i] = (i % 2 === 0) ? 1000 : -1000;
      }

      console.log(`Input: Nyquist frequency (alternating +1000, -1000)`);
      console.log(`FFT size: ${FFT_SIZE}`);
      console.log(`Expected: power[512] should be MAXIMUM (Nyquist = FFT_SIZE/2)\n`);

      // Show first few samples
      console.log(`First 10 samples: ${Array.from(samples.slice(0, 10)).join(', ')}`);

      // Perform FFT
      const result = processor.performFFT(samples, MAGNITUDE);

      // Find maximum power and its location
      let maxPower = 0;
      let maxBin = -1;
      for (let i = 0; i < OUTPUT_BINS; i++) {
        if (result.power[i] > maxPower) {
          maxPower = result.power[i];
          maxBin = i;
        }
      }

      const expectedBin = FFT_SIZE / 2; // 512

      console.log(`\nRESULT:`);
      console.log(`  Maximum power: ${maxPower} at bin ${maxBin}`);
      console.log(`  Expected bin: ${expectedBin}`);
      console.log(`  Status: ${maxBin === expectedBin ? 'PASS ✓' : 'FAIL ✗'}`);

      // Show bins around expected location
      console.log(`\nBins around expected (bin 512):`);
      for (let i = Math.max(0, expectedBin - 5); i <= Math.min(OUTPUT_BINS - 1, expectedBin + 5); i++) {
        const marker = i === maxBin ? ' ← PEAK' : '';
        console.log(`  Bin ${i}: ${result.power[i]}${marker}`);
      }

      // Calculate ratio of Nyquist power to next highest
      const otherBins = Array.from(result.power).filter((_, idx) => Math.abs(idx - expectedBin) > 5);
      const nextHighest = Math.max(...otherBins);
      const ratio = maxPower / nextHighest;
      console.log(`\nNyquist power / next highest: ${ratio.toFixed(1)}x`);
      console.log(`(Should be >> 10x for pure Nyquist signal)\n`);

      // Test assertion
      expect(maxBin).toBe(expectedBin);
      expect(ratio).toBeGreaterThan(10);
    });
  });

  describe('Test 3: Single Frequency Bin 10', () => {
    it('should place all power in bin 10 for sine wave at bin 10 frequency', () => {
      console.log('\n=== TEST 3: SINGLE FREQUENCY BIN 10 ===');

      const targetBin = 10;
      const amplitude = 1000;

      // Create sine wave at exact bin 10 frequency
      const samples = new Int32Array(FFT_SIZE);
      for (let i = 0; i < FFT_SIZE; i++) {
        samples[i] = Math.round(amplitude * Math.sin(2 * Math.PI * targetBin * i / FFT_SIZE));
      }

      console.log(`Input: Sine wave at bin ${targetBin} frequency`);
      console.log(`  Amplitude: ${amplitude}`);
      console.log(`  FFT size: ${FFT_SIZE}`);
      console.log(`Expected: power[${targetBin}] should be MAXIMUM\n`);

      // Show first few samples
      console.log(`First 10 samples: ${Array.from(samples.slice(0, 10)).join(', ')}`);

      // Perform FFT
      const result = processor.performFFT(samples, MAGNITUDE);

      // Find maximum power and its location
      let maxPower = 0;
      let maxBin = -1;
      for (let i = 0; i < OUTPUT_BINS; i++) {
        if (result.power[i] > maxPower) {
          maxPower = result.power[i];
          maxBin = i;
        }
      }

      console.log(`RESULT:`);
      console.log(`  Maximum power: ${maxPower} at bin ${maxBin}`);
      console.log(`  Expected bin: ${targetBin}`);
      console.log(`  Status: ${maxBin === targetBin ? 'PASS ✓' : 'FAIL ✗'}`);

      // Show bins around target and actual peak
      console.log(`\nBins around expected (bin ${targetBin}):`);
      for (let i = Math.max(0, targetBin - 3); i <= Math.min(OUTPUT_BINS - 1, targetBin + 3); i++) {
        const marker = i === maxBin ? ' ← PEAK' : '';
        console.log(`  Bin ${i}: ${result.power[i]}${marker}`);
      }

      if (maxBin !== targetBin) {
        console.log(`\nBins around ACTUAL peak (bin ${maxBin}):`);
        for (let i = Math.max(0, maxBin - 3); i <= Math.min(OUTPUT_BINS - 1, maxBin + 3); i++) {
          const marker = i === maxBin ? ' ← PEAK' : '';
          console.log(`  Bin ${i}: ${result.power[i]}${marker}`);
        }
      }

      // Calculate spectral leakage
      const peakPower = result.power[maxBin];
      const adjacentPower = Math.max(
        maxBin > 0 ? result.power[maxBin - 1] : 0,
        maxBin < OUTPUT_BINS - 1 ? result.power[maxBin + 1] : 0
      );
      const leakage = (adjacentPower / peakPower) * 100;
      console.log(`\nSpectral leakage: ${leakage.toFixed(1)}%`);
      console.log(`(Should be < 10% for pure tone with Hanning window)\n`);

      // Test assertion
      expect(maxBin).toBe(targetBin);
      expect(leakage).toBeLessThan(10);
    });
  });

  describe('Summary Report', () => {
    it('should run all three tests and generate summary report', () => {
      console.log('\n' + '='.repeat(60));
      console.log('FFT TEST RESULTS SUMMARY');
      console.log('='.repeat(60));

      const results: Array<{test: string, expected: string, actual: string, status: string}> = [];

      // Test 1: DC Signal
      {
        const samples = new Int32Array(FFT_SIZE);
        samples.fill(1000);
        const result = processor.performFFT(samples, MAGNITUDE);
        let maxBin = 0;
        for (let i = 1; i < OUTPUT_BINS; i++) {
          if (result.power[i] > result.power[maxBin]) {
            maxBin = i;
          }
        }
        results.push({
          test: 'Test 1: DC Signal',
          expected: 'power[0] = MAX',
          actual: `power[${maxBin}] = MAX`,
          status: maxBin === 0 ? 'PASS ✓' : 'FAIL ✗'
        });
      }

      // Test 2: Nyquist
      {
        const samples = new Int32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
          samples[i] = (i % 2 === 0) ? 1000 : -1000;
        }
        const result = processor.performFFT(samples, MAGNITUDE);
        let maxBin = 0;
        for (let i = 1; i < OUTPUT_BINS; i++) {
          if (result.power[i] > result.power[maxBin]) {
            maxBin = i;
          }
        }
        const expectedBin = FFT_SIZE / 2;
        results.push({
          test: 'Test 2: Nyquist',
          expected: `power[${expectedBin}] = MAX`,
          actual: `power[${maxBin}] = MAX`,
          status: maxBin === expectedBin ? 'PASS ✓' : 'FAIL ✗'
        });
      }

      // Test 3: Bin 10
      {
        const targetBin = 10;
        const samples = new Int32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
          samples[i] = Math.round(1000 * Math.sin(2 * Math.PI * targetBin * i / FFT_SIZE));
        }
        const result = processor.performFFT(samples, MAGNITUDE);
        let maxBin = 0;
        for (let i = 1; i < OUTPUT_BINS; i++) {
          if (result.power[i] > result.power[maxBin]) {
            maxBin = i;
          }
        }
        results.push({
          test: 'Test 3: Bin 10',
          expected: `power[${targetBin}] = MAX`,
          actual: `power[${maxBin}] = MAX`,
          status: maxBin === targetBin ? 'PASS ✓' : 'FAIL ✗'
        });
      }

      // Print results table
      console.log('\n');
      results.forEach(r => {
        console.log(`${r.test}`);
        console.log(`  Input:    [${r.test.split(':')[1].trim()}]`);
        console.log(`  Expected: ${r.expected}`);
        console.log(`  Actual:   ${r.actual}`);
        console.log(`  Status:   ${r.status}`);
        console.log('');
      });

      const allPassed = results.every(r => r.status.includes('PASS'));
      console.log('='.repeat(60));
      console.log(`OVERALL CONCLUSION: ${allPassed ? 'ALL TESTS PASS ✓' : 'BUG CONFIRMED ✗'}`);
      console.log('='.repeat(60));
      console.log('');

      if (!allPassed) {
        console.log('DIAGNOSIS:');
        console.log('  Tests confirm bug exists: YES');
        console.log('  The FFT output peaks are appearing in wrong bins.');
        console.log('  This indicates a bit-reversal problem in output extraction.\n');
      }
    });
  });
});
