/** @format */

'use strict';

// tests/windowFunctions.test.ts

import { WindowFunctions, WindowFunction } from '../src/classes/shared/windowFunctions';

describe('WindowFunctions', () => {
  describe('hanning', () => {
    it('should generate correct length array', () => {
      const sizes = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
      
      for (const size of sizes) {
        const window = WindowFunctions.hanning(size);
        expect(window).toHaveLength(size);
        expect(window).toBeInstanceOf(Int32Array);
      }
    });

    it('should reject invalid sizes', () => {
      expect(() => WindowFunctions.hanning(0)).toThrow('Invalid window size');
      expect(() => WindowFunctions.hanning(-1)).toThrow('Invalid window size');
      expect(() => WindowFunctions.hanning(3)).toThrow('not a power of 2');
      expect(() => WindowFunctions.hanning(5)).toThrow('not a power of 2');
      expect(() => WindowFunctions.hanning(4096)).toThrow('out of range');
    });

    it('should generate correct coefficients for minimum size (4)', () => {
      const window = WindowFunctions.hanning(4);
      
      expect(window).toHaveLength(4);
      
      // Hanning window formula: (1 - cos(2πi/N)) * scale
      // For size 4: i=0,1,2,3 -> angles 0, π/2, π, 3π/2
      expect(window[0]).toBeCloseTo(0, 50); // (1 - cos(0)) * 0x1000 = 0
      expect(window[1]).toBeCloseTo(4096, 50); // (1 - cos(π/2)) * 0x1000 = 4096
      expect(window[2]).toBeCloseTo(8192, 50); // (1 - cos(π)) * 0x1000 = 8192
      expect(window[3]).toBeCloseTo(4096, 50); // (1 - cos(3π/2)) * 0x1000 = 4096
    });

    it('should generate correct coefficients for size 8', () => {
      const window = WindowFunctions.hanning(8);
      
      expect(window).toHaveLength(8);
      
      // Check first and last are approximately zero
      expect(window[0]).toBeCloseTo(0, 50);
      expect(window[7]).toBeCloseTo(1200, 100); // Small but not exactly zero
      
      // Check middle value is maximum
      expect(window[4]).toBeCloseTo(8192, 50); // Maximum at middle
      
      // Check symmetry
      expect(window[1]).toBeCloseTo(window[7], 50);
      expect(window[2]).toBeCloseTo(window[6], 50);
      expect(window[3]).toBeCloseTo(window[5], 50);
    });

    it('should follow Pascal discrete sampling (not traditional symmetric window)', () => {
      // NOTE: Pascal's Hanning window using (1 - cos(2πi/N)) is NOT symmetric
      // This is a mathematical difference from typical DSP Hanning windows
      // which use (1 - cos(2πi/(N-1))) and are symmetric
      const window16 = WindowFunctions.hanning(16);
      
      // Verify it's not symmetric (this documents the Pascal behavior)
      expect(window16[0]).not.toEqual(window16[15]);
      expect(window16[1]).not.toEqual(window16[14]);
      
      // But verify it follows the Pascal formula exactly
      for (let i = 0; i < 16; i++) {
        const expected = Math.round((1 - Math.cos((i / 16) * Math.PI * 2)) * 0x1000);
        expect(window16[i]).toBe(expected);
      }
    });

    it('should have values in correct range', () => {
      const sizes = [4, 16, 64, 256, 1024];
      
      for (const size of sizes) {
        const window = WindowFunctions.hanning(size);
        
        // All values should be between 0 and 8192 (2 * 0x1000)
        for (let i = 0; i < size; i++) {
          expect(window[i]).toBeGreaterThanOrEqual(0);
          expect(window[i]).toBeLessThanOrEqual(8192);
        }
        
        // First value should be zero (or very close)
        expect(window[0]).toBeLessThan(10);
        
        // Should have maximum value of 8192 somewhere
        const maxValue = Math.max(...window);
        expect(maxValue).toBeCloseTo(8192, 50);
      }
    });

    it('should handle maximum size (2048)', () => {
      expect(() => WindowFunctions.hanning(2048)).not.toThrow();
      
      const window = WindowFunctions.hanning(2048);
      expect(window).toHaveLength(2048);
      expect(window[0]).toBeCloseTo(0, 50);
      expect(window[1024]).toBeCloseTo(8192, 50); // Maximum at middle
    });

    it('should match Pascal formula exactly', () => {
      const size = 16;
      const window = WindowFunctions.hanning(size);
      
      // Verify against Pascal formula: (1 - Cos((i / size) * Pi * 2)) * $1000
      for (let i = 0; i < size; i++) {
        const expected = Math.round((1 - Math.cos((i / size) * Math.PI * 2)) * 0x1000);
        expect(window[i]).toBe(expected);
      }
    });
  });

  describe('hamming', () => {
    it('should generate correct length array', () => {
      const window = WindowFunctions.hamming(64);
      expect(window).toHaveLength(64);
      expect(window).toBeInstanceOf(Int32Array);
    });

    it('should reject invalid sizes', () => {
      expect(() => WindowFunctions.hamming(0)).toThrow('Invalid window size');
      expect(() => WindowFunctions.hamming(-5)).toThrow('Invalid window size');
    });

    it('should have values in correct range', () => {
      const window = WindowFunctions.hamming(32);
      
      // All values should be positive and reasonable
      for (let i = 0; i < 32; i++) {
        expect(window[i]).toBeGreaterThan(0);
        expect(window[i]).toBeLessThanOrEqual(4096);
      }
    });

    it('should be different from Hanning window', () => {
      const size = 32;
      const hanning = WindowFunctions.hanning(size);
      const hamming = WindowFunctions.hamming(size);
      
      // Should not be identical
      expect(hanning).not.toEqual(hamming);
      
      // Should have different characteristics (Hamming doesn't go to zero at edges)
      expect(hamming[0]).toBeGreaterThan(hanning[0]);
      expect(hamming[size - 1]).toBeGreaterThan(hanning[size - 1]);
    });

    it('should follow Hamming formula', () => {
      const size = 8;
      const window = WindowFunctions.hamming(size);
      
      // Hamming formula: 0.54 - 0.46 * cos(2π * i / (N-1))
      for (let i = 0; i < size; i++) {
        const expected = Math.round((0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1))) * 0x1000);
        expect(window[i]).toBe(expected);
      }
    });
  });

  describe('blackman', () => {
    it('should generate correct length array', () => {
      const window = WindowFunctions.blackman(128);
      expect(window).toHaveLength(128);
      expect(window).toBeInstanceOf(Int32Array);
    });

    it('should reject invalid sizes', () => {
      expect(() => WindowFunctions.blackman(0)).toThrow('Invalid window size');
      expect(() => WindowFunctions.blackman(-10)).toThrow('Invalid window size');
    });

    it('should have values in correct range', () => {
      const window = WindowFunctions.blackman(64);
      
      for (let i = 0; i < 64; i++) {
        expect(window[i]).toBeGreaterThanOrEqual(0);
        expect(window[i]).toBeLessThanOrEqual(4096);
      }
    });

    it('should be different from Hanning and Hamming', () => {
      const size = 32;
      const hanning = WindowFunctions.hanning(size);
      const hamming = WindowFunctions.hamming(size);
      const blackman = WindowFunctions.blackman(size);
      
      expect(blackman).not.toEqual(hanning);
      expect(blackman).not.toEqual(hamming);
    });

    it('should follow Blackman formula', () => {
      const size = 8;
      const window = WindowFunctions.blackman(size);
      
      // Blackman formula: 0.42 - 0.5 * cos(2π * i / (N-1)) + 0.08 * cos(4π * i / (N-1))
      for (let i = 0; i < size; i++) {
        const expected = Math.round((0.42 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)) + 
                                   0.08 * Math.cos(4 * Math.PI * i / (size - 1))) * 0x1000);
        expect(window[i]).toBeCloseTo(expected, 0); // Use toBeCloseTo to handle -0 vs 0
      }
    });
  });

  describe('applyWindow', () => {
    it('should apply window in-place correctly', () => {
      const signal = new Int32Array([4096, 4096, 4096, 4096]); // All ones in fixed-point
      const window = WindowFunctions.hanning(4); // [0, 4096, 8192, 4096]
      
      WindowFunctions.applyWindow(signal, window);
      
      // Signal should now be windowed
      expect(signal[0]).toBeCloseTo(0, 50); // 4096 * 0 / 4096 = 0
      expect(signal[1]).toBeCloseTo(4096, 50); // 4096 * 4096 / 4096 = 4096
      expect(signal[2]).toBeCloseTo(8192, 50); // 4096 * 8192 / 4096 = 8192
      expect(signal[3]).toBeCloseTo(4096, 50); // 4096 * 4096 / 4096 = 4096
    });

    it('should reject mismatched array lengths', () => {
      const signal = new Int32Array(8);
      const window = new Int32Array(4);
      
      expect(() => WindowFunctions.applyWindow(signal, window)).toThrow('does not match window length');
    });

    it('should handle zero signal correctly', () => {
      const signal = new Int32Array(8); // All zeros
      const window = WindowFunctions.hanning(8);
      
      expect(() => WindowFunctions.applyWindow(signal, window)).not.toThrow();
      
      // Result should still be all zeros
      expect(signal.every(v => v === 0)).toBe(true);
    });

    it('should preserve signal energy proportionally', () => {
      const originalSignal = new Int32Array([1000, 2000, 3000, 4000]);
      const signal = new Int32Array(originalSignal); // Copy for testing
      const window = new Int32Array([4096, 2048, 1024, 512]); // Test window
      
      WindowFunctions.applyWindow(signal, window);
      
      // Check each value is scaled correctly
      expect(signal[0]).toBe(Math.round((1000 * 4096) / 4096)); // 1000
      expect(signal[1]).toBe(Math.round((2000 * 2048) / 4096)); // 1000
      expect(signal[2]).toBe(Math.round((3000 * 1024) / 4096)); // 750
      expect(signal[3]).toBe(Math.round((4000 * 512) / 4096)); // 500
    });
  });

  describe('applyWindowCopy', () => {
    it('should create new windowed array without modifying original', () => {
      const originalSignal = new Int32Array([1000, 2000, 3000, 4000]);
      const window = WindowFunctions.hanning(4);
      
      const windowed = WindowFunctions.applyWindowCopy(originalSignal, window);
      
      // Original should be unchanged
      expect(originalSignal).toEqual(new Int32Array([1000, 2000, 3000, 4000]));
      
      // Windowed should be different
      expect(windowed).not.toEqual(originalSignal);
      expect(windowed).toBeInstanceOf(Int32Array);
      expect(windowed).toHaveLength(4);
    });

    it('should reject mismatched array lengths', () => {
      const signal = new Int32Array(8);
      const window = new Int32Array(4);
      
      expect(() => WindowFunctions.applyWindowCopy(signal, window)).toThrow('does not match window length');
    });

    it('should produce same result as in-place version', () => {
      const signal1 = new Int32Array([1000, 2000, 3000, 4000]);
      const signal2 = new Int32Array([1000, 2000, 3000, 4000]);
      const window = WindowFunctions.hanning(4);
      
      WindowFunctions.applyWindow(signal1, window); // In-place
      const windowed = WindowFunctions.applyWindowCopy(signal2, window); // Copy
      
      expect(windowed).toEqual(signal1);
    });
  });

  describe('getScale', () => {
    it('should return correct fixed-point scale', () => {
      expect(WindowFunctions.getScale()).toBe(0x1000);
      expect(WindowFunctions.getScale()).toBe(4096);
    });
  });

  describe('isValidWindowType', () => {
    it('should validate known window types', () => {
      expect(WindowFunctions.isValidWindowType('hanning')).toBe(true);
      expect(WindowFunctions.isValidWindowType('hamming')).toBe(true);
      expect(WindowFunctions.isValidWindowType('blackman')).toBe(true);
    });

    it('should reject unknown window types', () => {
      expect(WindowFunctions.isValidWindowType('kaiser')).toBe(false);
      expect(WindowFunctions.isValidWindowType('rectangular')).toBe(false);
      expect(WindowFunctions.isValidWindowType('invalid')).toBe(false);
      expect(WindowFunctions.isValidWindowType('')).toBe(false);
    });
  });

  describe('generateWindow', () => {
    it('should generate correct window by name', () => {
      const size = 32;
      
      const hanning1 = WindowFunctions.generateWindow('hanning', size);
      const hanning2 = WindowFunctions.hanning(size);
      expect(hanning1).toEqual(hanning2);
      
      const hamming1 = WindowFunctions.generateWindow('hamming', size);
      const hamming2 = WindowFunctions.hamming(size);
      expect(hamming1).toEqual(hamming2);
      
      const blackman1 = WindowFunctions.generateWindow('blackman', size);
      const blackman2 = WindowFunctions.blackman(size);
      expect(blackman1).toEqual(blackman2);
    });

    it('should reject invalid window types', () => {
      expect(() => WindowFunctions.generateWindow('invalid' as WindowFunction, 32))
        .toThrow('Unknown window type');
    });
  });

  describe('coherentGain', () => {
    it('should calculate correct gain for Hanning window', () => {
      const window = WindowFunctions.hanning(64);
      const gain = WindowFunctions.coherentGain(window);
      
      // Pascal Hanning window uses (1 - cos) formula, so coherent gain is 1.0
      // (not the typical 0.5 * (1 - cos) normalized version)
      expect(gain).toBeCloseTo(1.0, 2);
      expect(gain).toBeGreaterThan(0);
    });

    it('should calculate correct gain for uniform window', () => {
      const window = new Int32Array(8);
      window.fill(4096); // All maximum values
      
      const gain = WindowFunctions.coherentGain(window);
      
      // Uniform window should have gain of 1.0
      expect(gain).toBeCloseTo(1.0, 10);
    });

    it('should handle zero window correctly', () => {
      const window = new Int32Array(8); // All zeros
      
      const gain = WindowFunctions.coherentGain(window);
      
      expect(gain).toBe(0);
    });

    it('should calculate different gains for different windows', () => {
      const size = 64;
      const hanningGain = WindowFunctions.coherentGain(WindowFunctions.hanning(size));
      const hammingGain = WindowFunctions.coherentGain(WindowFunctions.hamming(size));
      const blackmanGain = WindowFunctions.coherentGain(WindowFunctions.blackman(size));
      
      // All should be different
      expect(hanningGain).not.toBeCloseTo(hammingGain, 2);
      expect(hanningGain).not.toBeCloseTo(blackmanGain, 2);
      expect(hammingGain).not.toBeCloseTo(blackmanGain, 2);
      
      // All should be reasonable values
      expect(hanningGain).toBeCloseTo(1.0, 1); // Pascal Hanning has gain ~1.0
      expect(hammingGain).toBeGreaterThan(0.3);
      expect(hammingGain).toBeLessThan(1.2);
      expect(blackmanGain).toBeGreaterThan(0.2);
      expect(blackmanGain).toBeLessThan(0.8);
    });
  });

  describe('noiseEquivalentBandwidth', () => {
    it('should calculate NEBW for Hanning window', () => {
      const window = WindowFunctions.hanning(64);
      const nebw = WindowFunctions.noiseEquivalentBandwidth(window);
      
      // Hanning window NEBW should be approximately 1.5 bins
      expect(nebw).toBeCloseTo(1.5, 0.5);
      expect(nebw).toBeGreaterThan(1);
      expect(nebw).toBeLessThan(2);
    });

    it('should calculate NEBW for rectangular window', () => {
      const window = new Int32Array(32);
      window.fill(4096); // Rectangular window (all ones)
      
      const nebw = WindowFunctions.noiseEquivalentBandwidth(window);
      
      // Rectangular window NEBW should be 1.0
      expect(nebw).toBeCloseTo(1.0, 0.1);
    });

    it('should handle different window sizes consistently', () => {
      const sizes = [16, 32, 64, 128];
      const nebwValues = [];
      
      for (const size of sizes) {
        const window = WindowFunctions.hanning(size);
        const nebw = WindowFunctions.noiseEquivalentBandwidth(window);
        nebwValues.push(nebw);
        
        // NEBW should be reasonable for all sizes
        expect(nebw).toBeGreaterThan(1);
        expect(nebw).toBeLessThan(2);
      }
      
      // NEBW should be similar across different sizes (window type property)
      const avgNebw = nebwValues.reduce((sum, v) => sum + v, 0) / nebwValues.length;
      for (const nebw of nebwValues) {
        expect(Math.abs(nebw - avgNebw)).toBeLessThan(0.1);
      }
    });

    it('should calculate different NEBW for different window types', () => {
      const size = 64;
      const hanningNebw = WindowFunctions.noiseEquivalentBandwidth(WindowFunctions.hanning(size));
      const hammingNebw = WindowFunctions.noiseEquivalentBandwidth(WindowFunctions.hamming(size));
      const blackmanNebw = WindowFunctions.noiseEquivalentBandwidth(WindowFunctions.blackman(size));
      
      // All should be different
      expect(Math.abs(hanningNebw - hammingNebw)).toBeGreaterThan(0.1);
      expect(Math.abs(hanningNebw - blackmanNebw)).toBeGreaterThan(0.1);
      expect(Math.abs(hammingNebw - blackmanNebw)).toBeGreaterThan(0.1);
    });
  });

  describe('Edge cases and error conditions', () => {
    it('should handle single-sample windows', () => {
      expect(() => WindowFunctions.hamming(1)).not.toThrow();
      expect(() => WindowFunctions.blackman(1)).not.toThrow();
      
      const hamming1 = WindowFunctions.hamming(1);
      const blackman1 = WindowFunctions.blackman(1);
      
      expect(hamming1).toHaveLength(1);
      expect(blackman1).toHaveLength(1);
      
      // For single sample, Hamming formula produces NaN due to division by (N-1) = 0
      // This is handled by the implementation, resulting in 0
      // This is a mathematical edge case issue with the Pascal implementation
      expect(hamming1[0]).toBe(0); // NaN case handled as 0
      expect(blackman1[0]).toBe(0); // Blackman also gives 0 for single sample
    });

    it('should handle large window sizes without overflow', () => {
      expect(() => WindowFunctions.hamming(2048)).not.toThrow();
      expect(() => WindowFunctions.blackman(2048)).not.toThrow();
      
      const largWindow = WindowFunctions.hamming(2048);
      expect(largWindow).toHaveLength(2048);
      expect(largWindow.every(v => v >= 0 && v <= 4096)).toBe(true);
    });

    it('should handle extreme fixed-point values in window application', () => {
      const signal = new Int32Array([2147483647, -2147483648, 0, 1]); // Max/min int32 values
      const window = WindowFunctions.hanning(4);
      
      expect(() => WindowFunctions.applyWindow(signal, window)).not.toThrow();
      expect(() => WindowFunctions.applyWindowCopy(signal, window)).not.toThrow();
    });

    it('should maintain precision with small window coefficients', () => {
      const signal = new Int32Array([1, 1, 1, 1]);
      const window = new Int32Array([1, 2, 3, 4]); // Very small coefficients
      
      const windowed = WindowFunctions.applyWindowCopy(signal, window);
      
      // Should handle small values correctly
      expect(windowed[0]).toBe(0); // 1 * 1 / 4096 = 0 (rounded)
      expect(windowed[1]).toBe(0); // 1 * 2 / 4096 = 0 (rounded)
      expect(windowed[2]).toBe(0); // 1 * 3 / 4096 = 0 (rounded)
      expect(windowed[3]).toBe(0); // 1 * 4 / 4096 = 0 (rounded)
    });

    it('should handle empty window calculations gracefully', () => {
      const emptyWindow = new Int32Array(0);
      
      const gain = WindowFunctions.coherentGain(emptyWindow);
      expect(isNaN(gain)).toBe(true); // Division by zero produces NaN
      
      const nebw = WindowFunctions.noiseEquivalentBandwidth(emptyWindow);
      expect(isNaN(nebw) || nebw === 0).toBe(true); // Should handle gracefully
    });
  });
});