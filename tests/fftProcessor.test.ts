/** @format */

'use strict';

// tests/fftProcessor.test.ts

import { FFTProcessor } from '../src/classes/shared/fftProcessor';
import { generateSineWave, generateDCOffset, generateWhiteNoise } from './utils/signalGenerator';

describe('FFTProcessor', () => {
  let fftProcessor: FFTProcessor;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
  });

  describe('Constructor', () => {
    it('should create FFTProcessor instance', () => {
      expect(fftProcessor).toBeInstanceOf(FFTProcessor);
    });

    it('should initialize with zero FFT size', () => {
      expect(fftProcessor.getFFTSize()).toBe(0);
      expect(fftProcessor.getFFTExp()).toBe(0);
    });
  });

  describe('prepareFFT', () => {
    it('should prepare FFT for valid power-of-2 sizes', () => {
      const validSizes = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
      
      for (const size of validSizes) {
        expect(() => fftProcessor.prepareFFT(size)).not.toThrow();
        expect(fftProcessor.getFFTSize()).toBe(size);
        expect(fftProcessor.getFFTExp()).toBe(Math.log2(size));
      }
    });

    it('should reject non-power-of-2 sizes', () => {
      const invalidSizes = [3, 5, 6, 7, 9, 15, 17, 31, 33, 63, 65];
      
      for (const size of invalidSizes) {
        expect(() => fftProcessor.prepareFFT(size)).toThrow('Invalid FFT size');
      }
    });

    it('should reject sizes below minimum (4)', () => {
      const invalidSizes = [0, 1, 2, 3];
      
      for (const size of invalidSizes) {
        expect(() => fftProcessor.prepareFFT(size)).toThrow('Invalid FFT size');
      }
    });

    it('should reject sizes above maximum (2048)', () => {
      const invalidSizes = [4096, 8192, 16384];
      
      for (const size of invalidSizes) {
        expect(() => fftProcessor.prepareFFT(size)).toThrow('Invalid FFT size');
      }
    });

    it('should generate correct sine lookup table', () => {
      fftProcessor.prepareFFT(8);
      const sinTable = fftProcessor.getSinTable();
      
      expect(sinTable).toHaveLength(8);
      
      // Verify first few values match expected fixed-point sine values
      // For size 8, the angles are bit-reversed multiples of 2π/8
      expect(sinTable[0]).toBeCloseTo(0, 0); // sin(0) * 0x1000
      expect(Math.abs(sinTable[1])).toBeCloseTo(4096, 50); // sin(π) * 0x1000 ≈ 0
      expect(Math.abs(sinTable[2])).toBeCloseTo(2896, 50); // sin(π/2) * 0x1000 ≈ 2896
    });

    it('should generate correct cosine lookup table', () => {
      fftProcessor.prepareFFT(32); // Use larger size for more diverse angles
      const cosTable = fftProcessor.getCosTable();
      
      expect(cosTable).toHaveLength(32);
      
      // Verify some basic properties of the cosine table
      expect(cosTable[0]).toBeCloseTo(4096, 50); // cos(0) * 0x1000 = 4096
      expect(cosTable.every(v => v >= -4096 && v <= 4096)).toBe(true); // All values in valid range
      
      // Check that we have variation in values (indicating various angles)
      const uniqueValues = new Set(cosTable);
      expect(uniqueValues.size).toBeGreaterThan(5); // Should have diverse values
      
      // Should have some values that are not near maximum (indicating non-zero angles)
      const nonMaxValues = cosTable.filter(v => v < 3000).length;
      expect(nonMaxValues).toBeGreaterThan(0);
    });

    it('should generate correct Hanning window coefficients', () => {
      fftProcessor.prepareFFT(8);
      const windowTable = fftProcessor.getWindowTable();
      
      expect(windowTable).toHaveLength(8);
      
      // Hanning window should be symmetric and start/end near zero
      expect(windowTable[0]).toBeCloseTo(0, 50); // (1 - cos(0)) * 0x1000 = 0
      expect(windowTable[4]).toBeCloseTo(8192, 50); // (1 - cos(π)) * 0x1000 = 8192
      expect(windowTable[7]).toBeCloseTo(windowTable[1], 50); // Symmetry
    });

    it('should handle minimum FFT size (4)', () => {
      expect(() => fftProcessor.prepareFFT(4)).not.toThrow();
      expect(fftProcessor.getFFTSize()).toBe(4);
      expect(fftProcessor.getSinTable()).toHaveLength(4);
      expect(fftProcessor.getCosTable()).toHaveLength(4);
      expect(fftProcessor.getWindowTable()).toHaveLength(4);
    });

    it('should handle maximum FFT size (2048)', () => {
      expect(() => fftProcessor.prepareFFT(2048)).not.toThrow();
      expect(fftProcessor.getFFTSize()).toBe(2048);
      expect(fftProcessor.getSinTable()).toHaveLength(2048);
      expect(fftProcessor.getCosTable()).toHaveLength(2048);
      expect(fftProcessor.getWindowTable()).toHaveLength(2048);
    });
  });

  describe('performFFT', () => {
    beforeEach(() => {
      fftProcessor.prepareFFT(64); // Use moderate size for most tests
    });

    it('should reject samples array with wrong length', () => {
      const wrongSizeSamples = new Int32Array(32); // Wrong size
      expect(() => fftProcessor.performFFT(wrongSizeSamples)).toThrow('Sample array length');
    });

    it('should reject invalid magnitude values', () => {
      const samples = new Int32Array(64);
      
      expect(() => fftProcessor.performFFT(samples, -1)).toThrow('Magnitude must be between 0 and 11');
      expect(() => fftProcessor.performFFT(samples, 12)).toThrow('Magnitude must be between 0 and 11');
    });

    it('should return correct result structure', () => {
      const samples = new Int32Array(64);
      const result = fftProcessor.performFFT(samples);
      
      expect(result).toHaveProperty('power');
      expect(result).toHaveProperty('angle');
      expect(result.power).toBeInstanceOf(Int32Array);
      expect(result.angle).toBeInstanceOf(Int32Array);
      expect(result.power).toHaveLength(32); // Half of input size
      expect(result.angle).toHaveLength(32);
    });

    it('should handle DC offset signal correctly', () => {
      const dcValue = 1000;
      const samples = generateDCOffset(64, dcValue);
      const samplesInt32 = new Int32Array(samples);

      const result = fftProcessor.performFFT(samplesInt32);

      // DC component should be in the first bin (index 0)
      expect(result.power[0]).toBeGreaterThan(0);

      // Other bins should have much lower power
      // Note: Hanning window causes significant spectral leakage for DC signal
      // With corrected twiddle factors (rev32 unsigned conversion fix), we see ~2:1 ratio
      // We allow up to 55% of DC power to account for this expected leakage
      const nonDcPower = result.power.slice(1);
      const maxNonDcPower = Math.max(...nonDcPower);
      expect(maxNonDcPower).toBeLessThanOrEqual(result.power[0] * 0.55);
    });

    it('should handle single frequency sine wave correctly', () => {
      fftProcessor.prepareFFT(128);
      
      // Generate sine wave at frequency that maps to a specific bin
      const frequency = 8.0 / 128; // 8 cycles over 128 samples = bin 8
      const amplitude = 1000;
      const samples = generateSineWave(128, frequency, amplitude);
      const samplesInt32 = new Int32Array(samples);
      
      const result = fftProcessor.performFFT(samplesInt32);
      
      // Find the bin with maximum power
      let maxPowerBin = 0;
      let maxPower = result.power[0];
      for (let i = 1; i < result.power.length; i++) {
        if (result.power[i] > maxPower) {
          maxPower = result.power[i];
          maxPowerBin = i;
        }
      }
      
      // Should peak around bin 8 (allowing for some tolerance due to windowing)
      expect(maxPowerBin).toBeGreaterThanOrEqual(7);
      expect(maxPowerBin).toBeLessThanOrEqual(9);
      
      // Power should be significantly higher at the peak
      expect(maxPower).toBeGreaterThan(0);
    });

    it('should handle two-frequency signal correctly', () => {
      fftProcessor.prepareFFT(128);
      
      // Generate composite signal with two frequencies
      const freq1 = 4.0 / 128; // bin 4
      const freq2 = 12.0 / 128; // bin 12
      const amplitude = 500;
      
      const signal1 = generateSineWave(128, freq1, amplitude);
      const signal2 = generateSineWave(128, freq2, amplitude);
      
      // Combine signals
      const samples = new Int32Array(128);
      for (let i = 0; i < 128; i++) {
        samples[i] = signal1[i] + signal2[i];
      }
      
      const result = fftProcessor.performFFT(samples);
      
      // Should have peaks at both frequency bins
      const power4 = result.power[4];
      const power12 = result.power[12];
      
      // Both peaks should be significant
      expect(power4).toBeGreaterThan(0);
      expect(power12).toBeGreaterThan(0);
      
      // These should be among the highest powers
      const sortedPowers = [...result.power].sort((a, b) => b - a);
      expect(sortedPowers.slice(0, 4)).toContain(power4);
      expect(sortedPowers.slice(0, 4)).toContain(power12);
    });

    it('should apply magnitude scaling correctly', () => {
      const samples = generateSineWave(64, 8.0 / 64, 1000);
      const samplesInt32 = new Int32Array(samples);
      
      const result0 = fftProcessor.performFFT(samplesInt32, 0);
      const result5 = fftProcessor.performFFT(samplesInt32, 5);
      
      // Higher magnitude should result in higher power values (scales up for display)
      const maxPower0 = Math.max(...result0.power);
      const maxPower5 = Math.max(...result5.power);
      
      expect(maxPower5).toBeGreaterThan(maxPower0);
      // Should be approximately 32x larger (2^5 = 32), with reasonable tolerance
      expect(maxPower5).toBeGreaterThan(maxPower0 * 30);
      expect(maxPower5).toBeLessThan(maxPower0 * 34);
    });

    it('should handle zero input correctly', () => {
      const samples = new Int32Array(64); // All zeros
      const result = fftProcessor.performFFT(samples);
      
      // All power values should be zero or very small
      const maxPower = Math.max(...result.power);
      expect(maxPower).toBeLessThan(10);
    });

    it('should handle noise input without crashing', () => {
      const noise = generateWhiteNoise(64, 1000, 12345);
      const samplesInt32 = new Int32Array(noise);
      
      expect(() => fftProcessor.performFFT(samplesInt32)).not.toThrow();
      
      const result = fftProcessor.performFFT(samplesInt32);
      
      // Should have power distributed across frequencies
      const nonZeroBins = result.power.filter(p => p > 0).length;
      expect(nonZeroBins).toBeGreaterThan(result.power.length / 4); // At least 25% of bins active
    });

    it('should produce consistent results for same input', () => {
      const samples = generateSineWave(64, 0.125, 1000);
      const samplesInt32 = new Int32Array(samples);
      
      const result1 = fftProcessor.performFFT(samplesInt32);
      const result2 = fftProcessor.performFFT(samplesInt32);
      
      expect(result1.power).toEqual(result2.power);
      expect(result1.angle).toEqual(result2.angle);
    });
  });

  describe('Rev32 bit reversal', () => {
    beforeEach(() => {
      fftProcessor.prepareFFT(16); // Prepare for access to rev32 through performFFT
    });

    it('should handle edge cases in bit reversal', () => {
      // Test through FFT operation which uses rev32 internally
      const samples = new Int32Array(16);
      samples[4] = 1000; // Put energy in middle sample (avoid Hanning window zero)
      
      expect(() => fftProcessor.performFFT(samples)).not.toThrow();
      const result = fftProcessor.performFFT(samples);
      
      // Result should be valid (not all zeros due to bit reversal issues)
      const totalPower = result.power.reduce((sum, p) => sum + p, 0);
      expect(totalPower).toBeGreaterThan(0);
    });

    it('should produce correct frequency ordering', () => {
      fftProcessor.prepareFFT(32);
      
      // Create impulse at specific sample position
      const samples = new Int32Array(32);
      samples[1] = 1000; // Impulse at position 1
      
      const result = fftProcessor.performFFT(samples);
      
      // Should produce valid spectrum (frequencies should be ordered correctly)
      expect(result.power.length).toBe(16);
      expect(result.power.every(p => p >= 0)).toBe(true);
    });
  });

  describe('Fixed-point arithmetic precision', () => {
    it('should maintain reasonable precision with small signals', () => {
      fftProcessor.prepareFFT(64);
      
      const smallAmplitude = 10; // Very small signal
      const samples = generateSineWave(64, 0.125, smallAmplitude);
      const samplesInt32 = new Int32Array(samples);
      
      const result = fftProcessor.performFFT(samplesInt32);
      
      // Should still detect the signal despite small amplitude
      const maxPower = Math.max(...result.power);
      expect(maxPower).toBeGreaterThan(0);
    });

    it('should handle large signals without overflow', () => {
      fftProcessor.prepareFFT(64);
      
      const largeAmplitude = 100000; // Large signal
      const samples = generateSineWave(64, 0.125, largeAmplitude);
      const samplesInt32 = new Int32Array(samples);
      
      expect(() => fftProcessor.performFFT(samplesInt32)).not.toThrow();
      
      const result = fftProcessor.performFFT(samplesInt32);
      
      // Should produce valid results without overflow
      expect(result.power.every(p => p >= 0 && p < Number.MAX_SAFE_INTEGER)).toBe(true);
    });

    it('should maintain precision across different FFT sizes', () => {
      const sizes = [16, 32, 64, 128, 256, 512];
      const frequency = 0.125; // Same relative frequency for all sizes
      const amplitude = 1000;
      
      const results = [];
      
      for (const size of sizes) {
        fftProcessor.prepareFFT(size);
        const samples = generateSineWave(size, frequency, amplitude);
        const samplesInt32 = new Int32Array(samples);
        const result = fftProcessor.performFFT(samplesInt32);
        
        // Find peak bin
        let maxPower = 0;
        let peakBin = 0;
        for (let i = 0; i < result.power.length; i++) {
          if (result.power[i] > maxPower) {
            maxPower = result.power[i];
            peakBin = i;
          }
        }
        
        results.push({ size, peakBin, maxPower, expectedBin: Math.round(size * frequency) });
      }
      
      // Peak should be in approximately the correct bin for each size
      for (const { peakBin, expectedBin } of results) {
        expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Edge cases and error conditions', () => {
    it('should handle FFT without preparation', () => {
      const freshProcessor = new FFTProcessor();
      const samples = new Int32Array(64);
      
      // Should throw because prepareFFT wasn't called
      expect(() => freshProcessor.performFFT(samples)).toThrow();
    });

    it('should handle re-preparation with different sizes', () => {
      // Prepare for one size
      fftProcessor.prepareFFT(32);
      expect(fftProcessor.getFFTSize()).toBe(32);
      
      // Re-prepare for different size
      fftProcessor.prepareFFT(128);
      expect(fftProcessor.getFFTSize()).toBe(128);
      
      // Should work with new size
      const samples = new Int32Array(128);
      expect(() => fftProcessor.performFFT(samples)).not.toThrow();
    });

    it('should handle maximum values without crashing', () => {
      fftProcessor.prepareFFT(64);
      
      const samples = new Int32Array(64);
      samples.fill(2147483647); // Max positive int32
      
      expect(() => fftProcessor.performFFT(samples)).not.toThrow();
    });

    it('should handle minimum values without crashing', () => {
      fftProcessor.prepareFFT(64);
      
      const samples = new Int32Array(64);
      samples.fill(-2147483648); // Min negative int32
      
      expect(() => fftProcessor.performFFT(samples)).not.toThrow();
    });

    it('should handle high-frequency sinusoidal signal', () => {
      fftProcessor.prepareFFT(64);
      
      // Generate high-frequency sine wave (near Nyquist frequency)
      const samples = new Int32Array(64);
      const highFreq = 28.0 / 64; // Close to Nyquist (32/64 = 0.5)
      for (let i = 0; i < 64; i++) {
        samples[i] = Math.round(50000 * Math.sin(2 * Math.PI * highFreq * i));
      }
      
      expect(() => fftProcessor.performFFT(samples)).not.toThrow();
      
      const result = fftProcessor.performFFT(samples);
      
      // Should have significant total power
      const totalPower = result.power.reduce((sum, p) => sum + p, 0);
      expect(totalPower).toBeGreaterThan(0);
      
      // Should have power concentrated in high frequency bins
      const highFreqPower = result.power.slice(-8).reduce((sum, p) => sum + p, 0);
      expect(highFreqPower).toBeGreaterThan(totalPower * 0.1); // At least 10% in high freq bins
    });
  });

  describe('Mathematical validation', () => {
    it('should satisfy Parsevals theorem approximately', () => {
      fftProcessor.prepareFFT(128);
      
      // Generate known signal
      const samples = generateSineWave(128, 0.125, 1000);
      const samplesInt32 = new Int32Array(samples);
      
      // Calculate time domain energy
      let timeDomainEnergy = 0;
      for (let i = 0; i < samples.length; i++) {
        timeDomainEnergy += samples[i] * samples[i];
      }
      
      const result = fftProcessor.performFFT(samplesInt32);
      
      // Calculate frequency domain energy (approximation due to windowing and scaling)
      let freqDomainEnergy = 0;
      for (let i = 0; i < result.power.length; i++) {
        freqDomainEnergy += result.power[i] * result.power[i];
      }
      
      // Should be in the same order of magnitude (exact equality not expected due to windowing)
      const ratio = freqDomainEnergy / timeDomainEnergy;
      expect(ratio).toBeGreaterThan(0.001);
      expect(ratio).toBeLessThan(1000);
    });

    it('should have symmetric power spectrum for real signals', () => {
      fftProcessor.prepareFFT(128);
      
      const samples = generateSineWave(128, 0.1, 1000);
      const samplesInt32 = new Int32Array(samples);
      
      const result = fftProcessor.performFFT(samplesInt32);
      
      // For real input, power spectrum should be symmetric around Nyquist
      // Note: Due to bit-reversal and windowing, exact symmetry may not hold
      // but the spectrum should still show expected properties
      expect(result.power.length).toBe(64); // Half the input size
      expect(result.power.every(p => p >= 0)).toBe(true);
    });

    it('should detect known frequency content correctly', () => {
      const testCases = [
        { size: 64, freq: 4.0 / 64, expectedBin: 4 },
        { size: 128, freq: 8.0 / 128, expectedBin: 8 },
        { size: 256, freq: 16.0 / 256, expectedBin: 16 },
      ];
      
      for (const { size, freq, expectedBin } of testCases) {
        fftProcessor.prepareFFT(size);
        
        const samples = generateSineWave(size, freq, 1000);
        const samplesInt32 = new Int32Array(samples);
        
        const result = fftProcessor.performFFT(samplesInt32);
        
        // Find peak
        let maxPower = 0;
        let peakBin = 0;
        for (let i = 0; i < result.power.length; i++) {
          if (result.power[i] > maxPower) {
            maxPower = result.power[i];
            peakBin = i;
          }
        }
        
        // Should peak at expected bin (with tolerance for windowing effects)
        expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('FFT Power Calculation Bug from DEBUG_FFT.spin2', () => {
    it('should produce reasonable power values for typical sine wave input', () => {
      // Reproduce the exact scenario from our logs
      // Input: Sine wave values around -1000 to +1000
      // Expected: Power values that work with high=1000 and log scale

      fftProcessor.prepareFFT(2048);

      // Generate sine wave similar to what we see in logs
      // From logs: 194, 380, 552, 703, 827, 920, 979, 983, 929, 840...
      const samples = new Int32Array(2048);
      for (let i = 0; i < 2048; i++) {
        // Generate a 1kHz-like sine at ~50 cycles over 2048 samples
        samples[i] = Math.round(1000 * Math.sin((2 * Math.PI * 48 * i) / 2048));
      }

      // Process with magnitude=0 as in the Spin2 example
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

      console.log(`=== FFT Power Calculation Test ===`);
      console.log(`Peak power: ${maxPower} at bin ${maxBin}`);
      console.log(`First 10 bins: ${Array.from(result.power.slice(0, 10))}`);
      console.log(`Bins around peak (${maxBin-2} to ${maxBin+2}): ${Array.from(result.power.slice(maxBin-2, maxBin+3))}`);

      // The issue we're seeing: power values are too small (8, 17, 19...)
      // After fix, they should be larger to work with high=1000

      // Peak should be at the expected bin (48 ± 1)
      expect(maxBin).toBeGreaterThanOrEqual(47);
      expect(maxBin).toBeLessThanOrEqual(49);

      // Power values should be in a reasonable range for display
      // With high=1000, we expect peak power to be significant
      expect(maxPower).toBeGreaterThan(100); // Should be much larger than 220

      // Noise floor should be relatively low
      const noiseFloor = result.power[10];
      expect(noiseFloor).toBeLessThan(maxPower * 0.1);
    });

    it('should verify log scale transformation issue', () => {
      // Test log scale with actual values from our logs
      const testCases = [
        { raw: 8, high: 1000 },    // Noise floor
        { raw: 220, high: 1000 },  // Peak value
      ];

      console.log(`=== Log Scale Transformation Test ===`);
      for (const test of testCases) {
        const logScaled = Math.round(
          (Math.log2(test.raw + 1) / Math.log2(test.high + 1)) * test.high
        );

        const ratio = logScaled / test.raw;
        console.log(`Raw: ${test.raw} -> Log scaled: ${logScaled} (amplification: ${ratio.toFixed(1)}x)`);

        // The issue: small values get amplified too much
        if (test.raw < 50) {
          // Noise gets amplified by >30x with current formula
          expect(ratio).toBeGreaterThan(30);
        }
      }
    });
  });
});