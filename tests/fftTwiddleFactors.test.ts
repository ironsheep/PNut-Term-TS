/** @format */

'use strict';

// tests/fftTwiddleFactors.test.ts

/**
 * Test to verify FFT twiddle factors (sin/cos lookup tables) match Pascal implementation
 *
 * This test verifies that the TypeScript FFTProcessor generates the same twiddle factors
 * as the Pascal PrepareFFT procedure in DebugDisplayUnit.pas (lines 4170-4183).
 *
 * Pascal formula (line 4177-4180):
 *   Tf := Rev32(i) / $100000000 * Pi;
 *   SinCos(Tf, Yf, Xf);
 *   FFTsin[i] := Round(Yf * $1000);
 *   FFTcos[i] := Round(Xf * $1000);
 *
 * TypeScript formula (fftProcessor.ts lines 82-88):
 *   const tf = this.rev32(i) / 0x100000000 * Math.PI;
 *   const yf = Math.sin(tf);
 *   const xf = Math.cos(tf);
 *   this.fftSin[i] = Math.round(yf * 0x1000);
 *   this.fftCos[i] = Math.round(xf * 0x1000);
 */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('FFT Twiddle Factor Verification', () => {
  /**
   * Reference Pascal Rev32 implementation (lines 4245-4252)
   * Used to generate expected values for verification
   */
  function pascalRev32(i: number): number {
    const Rev4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
    return (
      (Rev4[(i >> 0) & 0xF] << 28 |
       Rev4[(i >> 4) & 0xF] << 24 |
       Rev4[(i >> 8) & 0xF] << 20) & 0xFFF00000
    ) >>> 0; // Unsigned 32-bit
  }

  /**
   * Generate expected twiddle factors using Pascal's exact formula
   */
  function generateExpectedTwiddles(size: number): { sin: number[], cos: number[] } {
    const sin: number[] = [];
    const cos: number[] = [];
    const FIXED_POINT_SCALE = 0x1000;

    for (let i = 0; i < size; i++) {
      // Pascal formula: Tf := Rev32(i) / $100000000 * Pi;
      const tf = pascalRev32(i) / 0x100000000 * Math.PI;

      // Pascal SinCos function (Yf = sin, Xf = cos)
      const yf = Math.sin(tf);
      const xf = Math.cos(tf);

      // Pascal Round with fixed-point scaling
      sin[i] = Math.round(yf * FIXED_POINT_SCALE);
      cos[i] = Math.round(xf * FIXED_POINT_SCALE);
    }

    return { sin, cos };
  }

  describe('Rev32 bit-reversal function', () => {
    it('should match Pascal Rev32 implementation', () => {
      const processor = new FFTProcessor();
      processor.prepareFFT(512); // Initialize to access rev32

      // Test key indices that exercise different bit patterns
      const testIndices = [0, 1, 128, 255, 256, 384, 511];

      for (const i of testIndices) {
        const pascalResult = pascalRev32(i);
        // We can't directly access rev32, but we can verify through twiddle factors
        // If twiddles match, rev32 must be correct
        const tf = pascalResult / 0x100000000 * Math.PI;
        const expectedSin = Math.round(Math.sin(tf) * 0x1000);
        const expectedCos = Math.round(Math.cos(tf) * 0x1000);

        const sinTable = processor.getSinTable();
        const cosTable = processor.getCosTable();

        expect(sinTable[i]).toBe(expectedSin);
        expect(cosTable[i]).toBe(expectedCos);
      }
    });
  });

  describe('FFT size 512 twiddle factors', () => {
    let processor: FFTProcessor;
    let expected: { sin: number[], cos: number[] };

    beforeAll(() => {
      processor = new FFTProcessor();
      processor.prepareFFT(512);
      expected = generateExpectedTwiddles(512);
    });

    it('should match Pascal implementation for index 0', () => {
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      expect(sinTable[0]).toBe(expected.sin[0]);
      expect(cosTable[0]).toBe(expected.cos[0]);
    });

    it('should match Pascal implementation for index 128', () => {
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      expect(sinTable[128]).toBe(expected.sin[128]);
      expect(cosTable[128]).toBe(expected.cos[128]);
    });

    it('should match Pascal implementation for index 256', () => {
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      expect(sinTable[256]).toBe(expected.sin[256]);
      expect(cosTable[256]).toBe(expected.cos[256]);
    });

    it('should match Pascal implementation for index 384', () => {
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      expect(sinTable[384]).toBe(expected.sin[384]);
      expect(cosTable[384]).toBe(expected.cos[384]);
    });

    it('should match Pascal implementation for index 511', () => {
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      expect(sinTable[511]).toBe(expected.sin[511]);
      expect(cosTable[511]).toBe(expected.cos[511]);
    });

    it('should match Pascal implementation for all 512 indices', () => {
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      for (let i = 0; i < 512; i++) {
        expect(sinTable[i]).toBe(expected.sin[i]);
        expect(cosTable[i]).toBe(expected.cos[i]);
      }
    });
  });

  describe('FFT size 1024 twiddle factors', () => {
    let processor: FFTProcessor;
    let expected: { sin: number[], cos: number[] };

    beforeAll(() => {
      processor = new FFTProcessor();
      processor.prepareFFT(1024);
      expected = generateExpectedTwiddles(1024);
    });

    it('should match Pascal implementation for all 1024 indices', () => {
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      for (let i = 0; i < 1024; i++) {
        expect(sinTable[i]).toBe(expected.sin[i]);
        expect(cosTable[i]).toBe(expected.cos[i]);
      }
    });
  });

  describe('FFT size 2048 twiddle factors', () => {
    let processor: FFTProcessor;
    let expected: { sin: number[], cos: number[] };

    beforeAll(() => {
      processor = new FFTProcessor();
      processor.prepareFFT(2048);
      expected = generateExpectedTwiddles(2048);
    });

    it('should match Pascal implementation for all 2048 indices', () => {
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      for (let i = 0; i < 2048; i++) {
        expect(sinTable[i]).toBe(expected.sin[i]);
        expect(cosTable[i]).toBe(expected.cos[i]);
      }
    });
  });

  describe('Detailed twiddle factor values', () => {
    it('should generate correct values for key indices at size 512', () => {
      const processor = new FFTProcessor();
      processor.prepareFFT(512);
      const sinTable = processor.getSinTable();
      const cosTable = processor.getCosTable();

      // Print actual values for verification report
      const keyIndices = [0, 128, 256, 384, 511];
      const results: { index: number, sin: number, cos: number, rev32: number }[] = [];

      for (const i of keyIndices) {
        const rev32Value = pascalRev32(i);
        results.push({
          index: i,
          sin: sinTable[i],
          cos: cosTable[i],
          rev32: rev32Value
        });
      }

      // Store for reporting (test will pass regardless, this is for documentation)
      expect(results.length).toBe(5);

      // Print results for documentation
      console.log('\n=== FFT Twiddle Factor Values (N=512) ===');
      console.log('Fixed-point scale: 0x1000 (4096)');
      console.log('\nKey index values:');
      for (const r of results) {
        const tf = r.rev32 / 0x100000000 * Math.PI;
        console.log(`\nIndex ${r.index}:`);
        console.log(`  Rev32(${r.index}) = 0x${r.rev32.toString(16).toUpperCase()}`);
        console.log(`  Angle (tf) = ${tf.toFixed(10)} radians`);
        console.log(`  Sin[${r.index}] = ${r.sin} (${(r.sin / 4096).toFixed(6)})`);
        console.log(`  Cos[${r.index}] = ${r.cos} (${(r.cos / 4096).toFixed(6)})`);
      }
    });
  });
});
