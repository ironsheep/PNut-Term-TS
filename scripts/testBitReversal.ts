/** @format */

'use strict';

/**
 * Test script to investigate FFT bit-reversal order issue
 *
 * THEORY: The mirrored SPECTRO pattern may be caused by incorrect bit-reversal
 * in the FFT output extraction.
 */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

// Simple test: DC signal (all zeros) should produce spike at bin 0
function testDCSignal(size: number): void {
  console.log(`\n=== Testing DC Signal (FFT size: ${size}) ===`);

  const processor = new FFTProcessor();
  processor.prepareFFT(size);

  // Create DC signal (constant value)
  const samples = new Int32Array(size);
  samples.fill(1000);

  const result = processor.performFFT(samples, 0);

  // Check first few bins
  console.log('First 10 bins:');
  for (let i = 0; i < Math.min(10, size / 2); i++) {
    console.log(`  Bin ${i}: power=${result.power[i]}`);
  }

  // Check if power is concentrated at bin 0
  const bin0Power = result.power[0];
  const otherBinsPower = result.power.slice(1, 10).reduce((sum, p) => sum + p, 0);

  console.log(`\nBin 0 power: ${bin0Power}`);
  console.log(`Bins 1-9 total power: ${otherBinsPower}`);
  console.log(`Ratio: ${bin0Power / Math.max(1, otherBinsPower)}`);

  if (bin0Power > otherBinsPower * 10) {
    console.log('✓ PASS: DC signal correctly concentrated at bin 0');
  } else {
    console.log('✗ FAIL: DC signal not concentrated at bin 0 - possible bit-reversal issue');
  }
}

// Test: Single frequency sine wave
function testSineWave(size: number, frequency: number): void {
  console.log(`\n=== Testing Sine Wave (FFT size: ${size}, frequency bin: ${frequency}) ===`);

  const processor = new FFTProcessor();
  processor.prepareFFT(size);

  // Create sine wave at specific frequency
  const samples = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    const phase = (2 * Math.PI * frequency * i) / size;
    samples[i] = Math.round(1000 * Math.sin(phase));
  }

  const result = processor.performFFT(samples, 0);

  // Find peak
  let maxPower = 0;
  let maxBin = 0;
  for (let i = 0; i < size / 2; i++) {
    if (result.power[i] > maxPower) {
      maxPower = result.power[i];
      maxBin = i;
    }
  }

  console.log(`Expected peak at bin: ${frequency}`);
  console.log(`Actual peak at bin: ${maxBin} (power: ${maxPower})`);

  // Show power around expected frequency
  console.log('\nPower around expected frequency:');
  for (let i = Math.max(0, frequency - 3); i <= Math.min(size / 2 - 1, frequency + 3); i++) {
    const marker = i === frequency ? ' <- expected' : i === maxBin ? ' <- actual peak' : '';
    console.log(`  Bin ${i}: power=${result.power[i]}${marker}`);
  }

  if (maxBin === frequency) {
    console.log('✓ PASS: Sine wave peak at correct bin');
  } else {
    console.log(`✗ FAIL: Sine wave peak at bin ${maxBin}, expected ${frequency}`);

    // Check if it's mirrored
    const mirroredBin = (size / 2) - frequency;
    if (maxBin === mirroredBin) {
      console.log(`  ⚠ MIRRORED: Peak appears at mirror position (${mirroredBin})`);
    }

    // Check if it's bit-reversed
    const rev32 = (i: number, exp: number): number => {
      const REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
      const result = (
        (REV4[(i >> 0) & 0xF] << 28) |
        (REV4[(i >> 4) & 0xF] << 24) |
        (REV4[(i >> 8) & 0xF] << 20)
      ) & 0xFFF00000;
      return result >>> (32 - exp);
    };

    const fftExp = Math.log2(size);
    const reversedFreq = rev32(frequency, fftExp);
    if (maxBin === reversedFreq) {
      console.log(`  ⚠ BIT-REVERSED: Peak appears at bit-reversed position (${reversedFreq})`);
    }
  }
}

// Test: Check if output order matches input order
function testOutputOrder(size: number): void {
  console.log(`\n=== Testing Output Order (FFT size: ${size}) ===`);

  const processor = new FFTProcessor();
  processor.prepareFFT(size);

  // Create impulse at bin 1 by using sine wave at frequency 1
  const samples = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    const phase = (2 * Math.PI * 1 * i) / size;
    samples[i] = Math.round(1000 * Math.sin(phase));
  }

  const result = processor.performFFT(samples, 0);

  // Check first 16 bins
  console.log('Power spectrum (first 16 bins):');
  for (let i = 0; i < Math.min(16, size / 2); i++) {
    const bar = '#'.repeat(Math.floor(result.power[i] / 100));
    console.log(`  Bin ${i.toString().padStart(2)}: ${result.power[i].toString().padStart(6)} ${bar}`);
  }
}

// Main test runner
function main(): void {
  console.log('FFT Bit-Reversal Order Investigation');
  console.log('=====================================');

  // Test 1: DC signal (should have all power at bin 0)
  testDCSignal(512);

  // Test 2: Sine waves at different frequencies
  testSineWave(512, 1);   // Fundamental frequency
  testSineWave(512, 10);  // Low frequency
  testSineWave(512, 50);  // Mid frequency
  testSineWave(512, 100); // Higher frequency

  // Test 3: Output order visualization
  testOutputOrder(512);

  console.log('\n=====================================');
  console.log('Test complete. Check results above.');
}

main();
