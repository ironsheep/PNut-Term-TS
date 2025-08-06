/** @format */

'use strict';

// tests/utils/signalGenerator.test.ts

import {
  generateSineWave,
  generateSquareWave,
  generateWhiteNoise,
  generateDCOffset,
  generateSawtoothWave,
  generateTriangleWave,
  generateCompositeSignal,
  generateChirp,
  applyWindow
} from './signalGenerator';

describe('SignalGenerator', () => {
  describe('generateSineWave', () => {
    it('should generate correct length array', () => {
      const signal = generateSineWave(100, 0.1, 1000);
      expect(signal).toHaveLength(100);
    });

    it('should return empty array for zero length', () => {
      const signal = generateSineWave(0, 0.1, 1000);
      expect(signal).toEqual([]);
    });

    it('should return empty array for negative length', () => {
      const signal = generateSineWave(-5, 0.1, 1000);
      expect(signal).toEqual([]);
    });

    it('should generate sine wave with correct amplitude', () => {
      const amplitude = 1000;
      const signal = generateSineWave(1000, 0.01, amplitude);
      
      // Find maximum absolute value
      const maxValue = Math.max(...signal.map(v => Math.abs(v)));
      
      // Should be close to amplitude (within 1% due to sampling)
      expect(maxValue).toBeCloseTo(amplitude, -1);
    });

    it('should generate sine wave with correct frequency', () => {
      // Generate a sine wave with known frequency
      const length = 1000;
      const frequency = 0.05; // 50 cycles over 1000 samples
      const signal = generateSineWave(length, frequency, 1000);
      
      // Check that signal completes expected number of cycles
      // Count zero crossings (rough frequency check)
      let zeroCrossings = 0;
      for (let i = 1; i < signal.length; i++) {
        if ((signal[i-1] >= 0 && signal[i] < 0) || (signal[i-1] <= 0 && signal[i] > 0)) {
          zeroCrossings++;
        }
      }
      
      // Each cycle has 2 zero crossings, so expect ~100 crossings
      expect(zeroCrossings).toBeGreaterThan(90);
      expect(zeroCrossings).toBeLessThan(110);
    });

    it('should handle phase offset correctly', () => {
      const signal1 = generateSineWave(100, 0.1, 1000, 0);
      const signal2 = generateSineWave(100, 0.1, 1000, Math.PI / 2);
      
      // Signal with π/2 phase should be different from original
      expect(signal1[0]).not.toBeCloseTo(signal2[0], 5);
      
      // First sample of π/2 phase should be close to amplitude
      expect(Math.abs(signal2[0])).toBeCloseTo(1000, -1);
    });

    it('should be deterministic for same parameters', () => {
      const signal1 = generateSineWave(100, 0.1, 1000);
      const signal2 = generateSineWave(100, 0.1, 1000);
      
      expect(signal1).toEqual(signal2);
    });
  });

  describe('generateSquareWave', () => {
    it('should generate correct length array', () => {
      const signal = generateSquareWave(100, 0.1, 1000);
      expect(signal).toHaveLength(100);
    });

    it('should return empty array for zero length', () => {
      const signal = generateSquareWave(0, 0.1, 1000);
      expect(signal).toEqual([]);
    });

    it('should generate square wave with correct amplitude', () => {
      const amplitude = 1000;
      const signal = generateSquareWave(100, 0.1, amplitude);
      
      // All values should be either +amplitude or -amplitude
      const uniqueValues = [...new Set(signal.map(v => Math.abs(v)))];
      expect(uniqueValues).toHaveLength(1);
      expect(uniqueValues[0]).toBe(amplitude);
    });

    it('should respect duty cycle', () => {
      const length = 100;
      const frequency = 0.1; // 10 cycles over 100 samples = 10 samples per cycle
      const dutyCycle = 0.3; // 30% high
      const signal = generateSquareWave(length, frequency, 1000, dutyCycle);
      
      // Count positive and negative samples in first cycle (samples 0-9)
      const firstCycle = signal.slice(0, 10);
      const positiveCount = firstCycle.filter(v => v > 0).length;
      
      // Should be approximately 30% of 10 samples = 3 samples
      expect(positiveCount).toBeCloseTo(3, 0);
    });

    it('should default to 50% duty cycle', () => {
      const length = 100;
      const frequency = 0.1;
      const signal = generateSquareWave(length, frequency, 1000);
      
      // Count positive and negative samples
      const positiveCount = signal.filter(v => v > 0).length;
      const negativeCount = signal.filter(v => v < 0).length;
      
      // Should be approximately equal
      expect(Math.abs(positiveCount - negativeCount)).toBeLessThanOrEqual(2);
    });

    it('should be deterministic for same parameters', () => {
      const signal1 = generateSquareWave(100, 0.1, 1000);
      const signal2 = generateSquareWave(100, 0.1, 1000);
      
      expect(signal1).toEqual(signal2);
    });
  });

  describe('generateWhiteNoise', () => {
    it('should generate correct length array', () => {
      const signal = generateWhiteNoise(100, 1000);
      expect(signal).toHaveLength(100);
    });

    it('should return empty array for zero length', () => {
      const signal = generateWhiteNoise(0, 1000);
      expect(signal).toEqual([]);
    });

    it('should be deterministic with same seed', () => {
      const signal1 = generateWhiteNoise(100, 1000, 12345);
      const signal2 = generateWhiteNoise(100, 1000, 12345);
      
      expect(signal1).toEqual(signal2);
    });

    it('should be different with different seeds', () => {
      const signal1 = generateWhiteNoise(100, 1000, 12345);
      const signal2 = generateWhiteNoise(100, 1000, 54321);
      
      expect(signal1).not.toEqual(signal2);
    });

    it('should have values within expected amplitude range', () => {
      const amplitude = 1000;
      const signal = generateWhiteNoise(1000, amplitude);
      
      // All values should be within [-amplitude, amplitude]
      const maxValue = Math.max(...signal);
      const minValue = Math.min(...signal);
      
      expect(maxValue).toBeLessThanOrEqual(amplitude);
      expect(minValue).toBeGreaterThanOrEqual(-amplitude);
    });

    it('should have statistical properties of white noise', () => {
      const signal = generateWhiteNoise(10000, 1000, 12345);
      
      // Calculate mean (should be close to 0)
      const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
      expect(Math.abs(mean)).toBeLessThan(50); // Within 5% of amplitude
      
      // Calculate standard deviation (should be non-zero for noise)
      const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
      const stdDev = Math.sqrt(variance);
      expect(stdDev).toBeGreaterThan(200); // Should have significant variation
    });

    it('should use default seed when not provided', () => {
      const signal1 = generateWhiteNoise(100, 1000);
      const signal2 = generateWhiteNoise(100, 1000);
      
      expect(signal1).toEqual(signal2);
    });
  });

  describe('generateDCOffset', () => {
    it('should generate correct length array', () => {
      const signal = generateDCOffset(100, 500);
      expect(signal).toHaveLength(100);
    });

    it('should return empty array for zero length', () => {
      const signal = generateDCOffset(0, 500);
      expect(signal).toEqual([]);
    });

    it('should generate constant value', () => {
      const offset = 500;
      const signal = generateDCOffset(100, offset);
      
      // All values should equal the offset
      const uniqueValues = [...new Set(signal)];
      expect(uniqueValues).toHaveLength(1);
      expect(uniqueValues[0]).toBe(offset);
    });

    it('should handle zero offset', () => {
      const signal = generateDCOffset(100, 0);
      
      expect(signal.every(v => v === 0)).toBe(true);
    });

    it('should handle negative offset', () => {
      const offset = -500;
      const signal = generateDCOffset(100, offset);
      
      expect(signal.every(v => v === offset)).toBe(true);
    });

    it('should be deterministic', () => {
      const signal1 = generateDCOffset(100, 500);
      const signal2 = generateDCOffset(100, 500);
      
      expect(signal1).toEqual(signal2);
    });
  });

  describe('generateSawtoothWave', () => {
    it('should generate correct length array', () => {
      const signal = generateSawtoothWave(100, 0.1, 1000);
      expect(signal).toHaveLength(100);
    });

    it('should return empty array for zero length', () => {
      const signal = generateSawtoothWave(0, 0.1, 1000);
      expect(signal).toEqual([]);
    });

    it('should have values within amplitude range', () => {
      const amplitude = 1000;
      const signal = generateSawtoothWave(100, 0.1, amplitude);
      
      const maxValue = Math.max(...signal);
      const minValue = Math.min(...signal);
      
      expect(maxValue).toBeLessThanOrEqual(amplitude);
      expect(minValue).toBeGreaterThanOrEqual(-amplitude);
    });

    it('should create linear ramp within each period', () => {
      // Use low frequency for clear periods
      const signal = generateSawtoothWave(20, 0.1, 1000); // 2 cycles over 20 samples
      
      // Check that values increase linearly within first half-period
      for (let i = 1; i < 5; i++) {
        expect(signal[i]).toBeGreaterThan(signal[i-1]);
      }
    });
  });

  describe('generateTriangleWave', () => {
    it('should generate correct length array', () => {
      const signal = generateTriangleWave(100, 0.1, 1000);
      expect(signal).toHaveLength(100);
    });

    it('should return empty array for zero length', () => {
      const signal = generateTriangleWave(0, 0.1, 1000);
      expect(signal).toEqual([]);
    });

    it('should have values within amplitude range', () => {
      const amplitude = 1000;
      const signal = generateTriangleWave(100, 0.1, amplitude);
      
      const maxValue = Math.max(...signal);
      const minValue = Math.min(...signal);
      
      expect(maxValue).toBeLessThanOrEqual(amplitude);
      expect(minValue).toBeGreaterThanOrEqual(-amplitude);
    });

    it('should create triangular shape within each period', () => {
      // Use low frequency for clear periods
      const signal = generateTriangleWave(20, 0.1, 1000); // 2 cycles over 20 samples
      
      // First quarter should be increasing
      expect(signal[2]).toBeGreaterThan(signal[1]);
      expect(signal[3]).toBeGreaterThan(signal[2]);
    });
  });

  describe('generateCompositeSignal', () => {
    it('should return empty array for zero length', () => {
      const signal1 = [1, 2, 3];
      const signal2 = [4, 5, 6];
      const composite = generateCompositeSignal([signal1, signal2], 0);
      
      expect(composite).toEqual([]);
    });

    it('should return empty array for no input signals', () => {
      const composite = generateCompositeSignal([], 100);
      
      expect(composite).toEqual([]);
    });

    it('should add signals together correctly', () => {
      const signal1 = [1, 2, 3, 4];
      const signal2 = [10, 20, 30, 40];
      const composite = generateCompositeSignal([signal1, signal2], 4);
      
      expect(composite).toEqual([11, 22, 33, 44]);
    });

    it('should handle signals of different lengths', () => {
      const signal1 = [1, 2, 3];
      const signal2 = [10, 20]; // Shorter signal
      const composite = generateCompositeSignal([signal1, signal2], 4);
      
      expect(composite).toEqual([11, 22, 3, 0]);
    });

    it('should pad with zeros for requested length longer than signals', () => {
      const signal1 = [1, 2];
      const composite = generateCompositeSignal([signal1], 4);
      
      expect(composite).toEqual([1, 2, 0, 0]);
    });

    it('should handle single signal', () => {
      const signal1 = [1, 2, 3];
      const composite = generateCompositeSignal([signal1], 3);
      
      expect(composite).toEqual([1, 2, 3]);
    });
  });

  describe('generateChirp', () => {
    it('should generate correct length array', () => {
      const signal = generateChirp(100, 0.01, 0.1, 1000);
      expect(signal).toHaveLength(100);
    });

    it('should return empty array for zero length', () => {
      const signal = generateChirp(0, 0.01, 0.1, 1000);
      expect(signal).toEqual([]);
    });

    it('should have values within amplitude range', () => {
      const amplitude = 1000;
      const signal = generateChirp(100, 0.01, 0.1, amplitude);
      
      const maxValue = Math.max(...signal.map(v => Math.abs(v)));
      expect(maxValue).toBeLessThanOrEqual(amplitude * 1.01); // Small tolerance
    });

    it('should start and end at different frequencies', () => {
      // Generate a chirp and check that frequency content changes
      const signal = generateChirp(1000, 0.01, 0.1, 1000);
      
      // Check that signal properties change over time
      const firstHalf = signal.slice(0, 500);
      const secondHalf = signal.slice(500);
      
      // Calculate approximate "activity" (sum of absolute differences)
      const firstActivity = firstHalf.slice(1).reduce((sum, val, i) => 
        sum + Math.abs(val - firstHalf[i]), 0);
      const secondActivity = secondHalf.slice(1).reduce((sum, val, i) => 
        sum + Math.abs(val - secondHalf[i]), 0);
      
      // Second half should have higher activity due to higher frequency
      expect(secondActivity).toBeGreaterThan(firstActivity);
    });
  });

  describe('applyWindow', () => {
    it('should return empty array for empty input', () => {
      const windowed = applyWindow([]);
      expect(windowed).toEqual([]);
    });

    it('should maintain array length', () => {
      const signal = [1, 2, 3, 4, 5];
      const windowed = applyWindow(signal);
      expect(windowed).toHaveLength(5);
    });

    it('should apply Hanning window by default', () => {
      const signal = [1, 1, 1, 1, 1]; // Constant signal
      const windowed = applyWindow(signal);
      
      // Hanning window should taper at edges
      expect(windowed[0]).toBeLessThan(signal[0]);
      expect(windowed[windowed.length - 1]).toBeLessThan(signal[signal.length - 1]);
      
      // Middle should be less affected
      const midIndex = Math.floor(windowed.length / 2);
      expect(windowed[midIndex]).toBeCloseTo(signal[midIndex], 1);
    });

    it('should apply Hanning window correctly', () => {
      const signal = [1, 1, 1, 1, 1];
      const windowed = applyWindow(signal, 'hanning');
      
      // First and last samples should be 0 for Hanning
      expect(windowed[0]).toBeCloseTo(0, 5);
      expect(windowed[windowed.length - 1]).toBeCloseTo(0, 5);
    });

    it('should apply Hamming window correctly', () => {
      const signal = [1, 1, 1, 1, 1];
      const windowed = applyWindow(signal, 'hamming');
      
      // Hamming window doesn't go to zero at edges
      expect(windowed[0]).toBeGreaterThan(0);
      expect(windowed[windowed.length - 1]).toBeGreaterThan(0);
      expect(windowed[0]).toBeLessThan(signal[0]);
    });

    it('should apply Blackman window correctly', () => {
      const signal = [1, 1, 1, 1, 1];
      const windowed = applyWindow(signal, 'blackman');
      
      // Blackman window should taper at edges
      expect(windowed[0]).toBeLessThan(signal[0]);
      expect(windowed[windowed.length - 1]).toBeLessThan(signal[signal.length - 1]);
    });

    it('should preserve signal when no windowing is specified', () => {
      const signal = [1, 2, 3, 4, 5];
      // Test invalid window type falls back to no windowing
      const windowed = applyWindow(signal, 'invalid' as any);
      
      expect(windowed).toEqual(signal);
    });

    it('should be symmetric for symmetric windows', () => {
      const signal = new Array(101).fill(1); // Odd length for symmetry test
      const windowed = applyWindow(signal, 'hanning');
      
      const midIndex = Math.floor(windowed.length / 2);
      
      // Check symmetry around middle
      for (let i = 0; i < midIndex; i++) {
        expect(windowed[i]).toBeCloseTo(windowed[windowed.length - 1 - i], 10);
      }
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle extreme amplitude values', () => {
      const largeAmplitude = 1e6;
      const signal = generateSineWave(100, 0.25, largeAmplitude); // Higher frequency for better sampling
      
      expect(signal).toHaveLength(100);
      // Should be within 5% of expected amplitude (sampling may not hit exact peak)
      const maxValue = Math.max(...signal.map(v => Math.abs(v)));
      expect(maxValue).toBeGreaterThan(largeAmplitude * 0.95);
      expect(maxValue).toBeLessThanOrEqual(largeAmplitude);
    });

    it('should handle very small amplitude values', () => {
      const smallAmplitude = 1e-6;
      const signal = generateSineWave(10, 0.1, smallAmplitude);
      
      expect(signal).toHaveLength(10);
      expect(signal.every(v => Math.abs(v) <= smallAmplitude)).toBe(true);
    });

    it('should handle zero amplitude', () => {
      const signal = generateSineWave(10, 0.1, 0);
      
      expect(signal).toHaveLength(10);
      expect(signal.every(v => v === 0)).toBe(true);
    });

    it('should handle very high frequencies', () => {
      const signal = generateSineWave(10, 0.49, 1000); // Close to Nyquist
      
      expect(signal).toHaveLength(10);
      expect(signal.every(v => Math.abs(v) <= 1000)).toBe(true);
    });

    it('should handle zero frequency', () => {
      const signal = generateSineWave(10, 0, 1000);
      
      expect(signal).toHaveLength(10);
      expect(signal.every(v => v === 0)).toBe(true); // sin(0) = 0
    });

    it('should handle single sample arrays', () => {
      const sine = generateSineWave(1, 0.1, 1000);
      const square = generateSquareWave(1, 0.1, 1000);
      const noise = generateWhiteNoise(1, 1000);
      const dc = generateDCOffset(1, 500);
      
      expect(sine).toHaveLength(1);
      expect(square).toHaveLength(1);
      expect(noise).toHaveLength(1);
      expect(dc).toHaveLength(1);
      expect(dc[0]).toBe(500);
    });
  });
});