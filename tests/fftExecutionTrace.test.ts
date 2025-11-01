/** @format */

'use strict';

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('FFT Execution Trace - Known Signal Verification', () => {
  let fftProcessor: FFTProcessor;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
  });

  describe('Test Case 1: Pure Sine at Bin 8', () => {
    it('should produce single peak at bin 8', () => {
      const fftSize = 64;
      const cycleCount = 8;
      
      fftProcessor.prepareFFT(fftSize);
      
      const samples = new Int32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        samples[i] = Math.round(1000 * Math.sin(2 * Math.PI * cycleCount * i / fftSize));
      }
      
      console.log('\n=== Pure Sine at Bin 8 ===');
      const result = fftProcessor.performFFT(samples, 0);
      
      let maxPower = 0;
      let maxBin = 0;
      for (let i = 0; i < result.power.length; i++) {
        if (result.power[i] > maxPower) {
          maxPower = result.power[i];
          maxBin = i;
        }
      }
      
      console.log('Peak at bin ' + maxBin + ', power ' + maxPower);
      
      expect(maxBin).toBeGreaterThanOrEqual(6);
      expect(maxBin).toBeLessThanOrEqual(10);
      expect(maxPower).toBeGreaterThan(100);
    });
  });

  describe('Test Case 2: DC Offset', () => {
    it('should concentrate energy in bin 0', () => {
      fftProcessor.prepareFFT(64);
      const samples = new Int32Array(64).fill(500);
      
      console.log('\n=== DC Offset ===');
      const result = fftProcessor.performFFT(samples, 0);
      
      const dcPower = result.power[0];
      const maxOther = Math.max(...result.power.slice(1));
      
      console.log('DC power ' + dcPower + ', max other ' + maxOther);
      
      expect(dcPower).toBeGreaterThan(100);
      expect(dcPower).toBeGreaterThan(maxOther * 5);
    });
  });

  describe('Test Case 3: Two Frequencies', () => {
    it('should show two separate peaks', () => {
      fftProcessor.prepareFFT(64);
      
      const samples = new Int32Array(64);
      for (let i = 0; i < 64; i++) {
        const sine4 = 500 * Math.sin(2 * Math.PI * 4 * i / 64);
        const sine12 = 500 * Math.sin(2 * Math.PI * 12 * i / 64);
        samples[i] = Math.round(sine4 + sine12);
      }
      
      console.log('\n=== Two Frequencies ===');
      const result = fftProcessor.performFFT(samples, 0);
      
      const sorted = Array.from(result.power)
        .map((power, bin) => ({ bin, power }))
        .sort((a, b) => b.power - a.power);
      
      console.log('Peak 1: bin ' + sorted[0].bin + ', Peak 2: bin ' + sorted[1].bin);
      
      expect([4, 12]).toContain(sorted[0].bin);
      expect([4, 12]).toContain(sorted[1].bin);
    });
  });

  describe('Scaling Tests', () => {
    it('should not produce all-zero output', () => {
      fftProcessor.prepareFFT(128);
      
      const samples = new Int32Array(128);
      for (let i = 0; i < 128; i++) {
        samples[i] = Math.round(1000 * Math.sin(2 * Math.PI * 8 * i / 128));
      }
      
      const result = fftProcessor.performFFT(samples, 0);
      const maxPower = Math.max(...result.power);
      
      expect(maxPower).toBeGreaterThan(50);
    });

    it('should scale magnitude parameter correctly', () => {
      fftProcessor.prepareFFT(64);
      
      const samples = new Int32Array(64);
      for (let i = 0; i < 64; i++) {
        samples[i] = Math.round(1000 * Math.sin(2 * Math.PI * 4 * i / 64));
      }
      
      const result0 = fftProcessor.performFFT(samples, 0);
      const result5 = fftProcessor.performFFT(samples, 5);
      
      const max0 = Math.max(...result0.power);
      const max5 = Math.max(...result5.power);
      
      const ratio = max5 / max0;
      console.log('Magnitude scaling: 5/0 = ' + ratio.toFixed(1) + 'x (expect 32x)');
      
      expect(ratio).toBeGreaterThan(25);
      expect(ratio).toBeLessThan(40);
    });
  });
});
