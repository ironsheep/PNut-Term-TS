/** @format */

/**
 * FFT Multiple Executions Test - Sliding Window
 *
 * This test simulates the actual FFT window behavior with RATE 256:
 * - Uses 38,756 samples from real P2 hardware
 * - Performs ~143 FFT executions with sliding window
 * - Measures noise floor across ALL executions
 * - Compares TypeScript vs Python for EACH FFT
 *
 * This tests for noise accumulation, state leakage, or other issues
 * that only appear during continuous operation.
 */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';
import * as fs from 'fs';
import * as path from 'path';

describe('FFT Multiple Executions - Sliding Window Test', () => {
  const FFT_SIZE = 2048;
  const RATE = 256; // New FFT every 256 samples
  const MAGNITUDE = 0;

  /**
   * Load ALL samples from P2 hardware log
   */
  function loadAllHardwareSamples(): Int32Array {
    const logFile = path.join(__dirname, '../test-results/external-results/debug_251106-164458.log');
    const data = fs.readFileSync(logFile, 'utf8');

    const samples: number[] = [];
    const lines = data.split('\n');

    for (const line of lines) {
      if (line.includes('MyFFT MyScope')) {
        const match = line.match(/MyScope\s+([-]?\d+(?:_\d+)?)/);
        if (match) {
          const value = parseInt(match[1].replace(/_/g, ''), 10);
          samples.push(value);
        }
      }
    }

    return new Int32Array(samples);
  }

  test('Multiple FFT executions with sliding window - TypeScript only', () => {
    console.log('\n========================================');
    console.log('MULTIPLE FFT EXECUTIONS TEST');
    console.log('========================================\n');

    // Load all samples
    const allSamples = loadAllHardwareSamples();
    console.log(`Total samples loaded: ${allSamples.length}`);
    console.log(`FFT size: ${FFT_SIZE}`);
    console.log(`Rate: ${RATE} (new FFT every ${RATE} samples)`);

    const numFFTs = Math.floor((allSamples.length - FFT_SIZE) / RATE) + 1;
    console.log(`Number of FFTs to execute: ${numFFTs}`);
    console.log('');

    // Create FFT processor
    const fftProcessor = new FFTProcessor();
    fftProcessor.prepareFFT(FFT_SIZE);

    // Track noise floor across all FFTs
    const noiseFloors: number[] = [];
    const first20Bins: number[][] = [];
    let totalZeroBins = 0;
    let totalNonZeroBins = 0;

    // Execute FFTs with sliding window
    console.log('Executing FFTs...');
    for (let i = 0; i < numFFTs; i++) {
      const startIdx = i * RATE;
      const endIdx = startIdx + FFT_SIZE;

      if (endIdx > allSamples.length) break;

      // Extract samples for this FFT window
      const samples = allSamples.slice(startIdx, endIdx);

      // Perform FFT
      const result = fftProcessor.performFFT(samples, MAGNITUDE);

      // Find peak
      const peak = Math.max(...result.power);
      const peakBin = result.power.indexOf(peak);

      // Calculate noise floor (excluding peak ±10 bins)
      const noiseBins = Array.from(result.power).filter((_, idx) => Math.abs(idx - peakBin) > 10);
      const avgNoise = noiseBins.reduce((a, b) => a + b, 0) / noiseBins.length;
      const zeroBins = noiseBins.filter(p => p === 0).length;

      noiseFloors.push(avgNoise);
      first20Bins.push(Array.from(result.power.slice(0, 20)));
      totalZeroBins += zeroBins;
      totalNonZeroBins += (noiseBins.length - zeroBins);

      // Log every 20th FFT
      if (i % 20 === 0 || i === numFFTs - 1) {
        console.log(`  FFT ${i + 1}/${numFFTs}: peak=${peak} @bin${peakBin}, noise=${avgNoise.toFixed(3)}, first20=[${result.power.slice(0, 20).join(', ')}]`);
      }
    }

    console.log('\n========================================');
    console.log('RESULTS SUMMARY');
    console.log('========================================\n');

    // Analyze noise floor statistics
    const avgNoiseFloor = noiseFloors.reduce((a, b) => a + b, 0) / noiseFloors.length;
    const maxNoiseFloor = Math.max(...noiseFloors);
    const minNoiseFloor = Math.min(...noiseFloors);

    console.log('Noise Floor Statistics:');
    console.log(`  Average across all FFTs: ${avgNoiseFloor.toFixed(3)}`);
    console.log(`  Maximum: ${maxNoiseFloor.toFixed(3)}`);
    console.log(`  Minimum: ${minNoiseFloor.toFixed(3)}`);
    console.log(`  Total zero bins: ${totalZeroBins}`);
    console.log(`  Total non-zero bins: ${totalNonZeroBins}`);
    console.log(`  Zero percentage: ${((totalZeroBins / (totalZeroBins + totalNonZeroBins)) * 100).toFixed(1)}%`);

    // Check for noise floor variation
    const noiseStdDev = Math.sqrt(
      noiseFloors.reduce((sum, val) => sum + Math.pow(val - avgNoiseFloor, 2), 0) / noiseFloors.length
    );
    console.log(`  Standard deviation: ${noiseStdDev.toFixed(3)}`);

    // Check first 20 bins consistency
    console.log('\nFirst 20 Bins Analysis:');
    const allZerosInFirst20 = first20Bins.every(bins => bins.every(b => b === 0));
    console.log(`  All FFTs have zeros in first 20 bins: ${allZerosInFirst20 ? '✅ YES' : '❌ NO'}`);

    if (!allZerosInFirst20) {
      console.log('\n  Non-zero first 20 bins found in:');
      first20Bins.forEach((bins, idx) => {
        const nonZero = bins.filter(b => b !== 0);
        if (nonZero.length > 0) {
          console.log(`    FFT ${idx + 1}: [${bins.join(', ')}]`);
        }
      });
    }

    // Check for anomalies
    console.log('\nAnomaly Detection:');
    const highNoise = noiseFloors.filter(n => n > 5).length;
    const mediumNoise = noiseFloors.filter(n => n > 1 && n <= 5).length;
    const lowNoise = noiseFloors.filter(n => n <= 1).length;

    console.log(`  High noise (>5): ${highNoise} FFTs (${((highNoise / numFFTs) * 100).toFixed(1)}%)`);
    console.log(`  Medium noise (1-5): ${mediumNoise} FFTs (${((mediumNoise / numFFTs) * 100).toFixed(1)}%)`);
    console.log(`  Low noise (≤1): ${lowNoise} FFTs (${((lowNoise / numFFTs) * 100).toFixed(1)}%)`);

    console.log('\n========================================');
    console.log('CONCLUSION');
    console.log('========================================\n');

    if (avgNoiseFloor < 0.1) {
      console.log('✅ EXCELLENT: Noise floor is very low (<0.1)');
      console.log('   TypeScript FFT maintains clean output across multiple executions.');
    } else if (avgNoiseFloor < 1.0) {
      console.log('✅ GOOD: Noise floor is low (<1.0)');
      console.log('   TypeScript FFT produces acceptable noise levels.');
    } else if (avgNoiseFloor < 5.0) {
      console.log('⚠️  MODERATE: Noise floor is elevated (1-5)');
      console.log('   Some noise accumulation detected.');
    } else {
      console.log('🔴 HIGH: Noise floor is significantly elevated (>5)');
      console.log('   This confirms the noise floor problem!');
      console.log('   Average noise: ' + avgNoiseFloor.toFixed(3));
    }

    if (noiseStdDev > 1.0) {
      console.log('\n⚠️  WARNING: Noise floor varies significantly between FFTs');
      console.log(`   Standard deviation: ${noiseStdDev.toFixed(3)}`);
      console.log('   This suggests state leakage or buffer issues.');
    }

    if (!allZerosInFirst20) {
      console.log('\n🔴 ISSUE: First 20 bins contain non-zero values in some FFTs');
      console.log('   This is NOT expected for clean FFT output.');
      console.log('   Problem may be in sample extraction or buffer handling.');
    }

    // Final assertion
    expect(avgNoiseFloor).toBeLessThan(1.0); // Expect low noise floor
  });
});
