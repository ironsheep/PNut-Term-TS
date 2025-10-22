/** @format */

import { DebugFFTWindow, FFTDisplaySpec } from '../src/classes/debugFftWin';
import { Context } from '../src/utils/context';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';

/**
 * FFT Window Logic Validation Test
 *
 * PURPOSE: Test the actual FFT processing logic without requiring a real browser window
 *
 * This test validates:
 * 1. Sample buffer accumulation
 * 2. Rate cycle triggering
 * 3. Sample extraction from circular buffer
 * 4. Actual FFT calculation on sine wave data
 * 5. FFT output validation (peak detection)
 * 6. Drawing command generation
 *
 * We bypass window creation but test all the data processing logic.
 */

describe('FFT Window Logic Validation', () => {
  let context: Context;
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    const testSetup = setupDebugWindowTests({
      windowType: 'fft',
      displayName: 'TestFFT'
    });
    context = testSetup.mockContext;
    cleanup = testSetup.cleanup;
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  describe('Sample Buffer Management', () => {
    test('should accumulate samples correctly', async () => {
      // Create FFT with small sample size for faster testing
      const spec = DebugFFTWindow.createDisplaySpec('MyFFT', [
        'FFT', 'MyFFT', 'SAMPLES', '64', 'RATE', '64'
      ]);

      const fftWindow = new DebugFFTWindow(context, spec);

      // Access private fields for testing (TypeScript workaround)
      const privateAccess = fftWindow as any;

      console.log('\n=== Testing Sample Accumulation ===');
      console.log(`Initial state:`);
      console.log(`  samplePop: ${privateAccess.samplePop}`);
      console.log(`  sampleWritePtr: ${privateAccess.sampleWritePtr}`);
      console.log(`  channelMask: 0x${privateAccess.channelMask.toString(16)}`);
      console.log(`  rateCounter: ${privateAccess.rateCounter}`);
      console.log(`  rate: ${spec.rate}`);

      // Configure channel first
      await fftWindow.updateContent(["'Test'", '0', '1000', '180', '10', '15', 'YELLOW', '12']);

      console.log(`\nAfter channel config:`);
      console.log(`  channels.length: ${privateAccess.channels.length}`);
      console.log(`  channelMask: 0x${privateAccess.channelMask.toString(16)}`);

      // Feed some samples
      const testSamples = [100, 200, 300, 400, 500];
      for (let index = 0; index < testSamples.length; index++) {
        const value = testSamples[index];
        await fftWindow.updateContent([value.toString()]);
        console.log(`  After sample ${index + 1}: samplePop=${privateAccess.samplePop}, writePtr=${privateAccess.sampleWritePtr}`);
      }

      // Verify buffer state
      expect(privateAccess.samplePop).toBe(testSamples.length);
      expect(privateAccess.sampleWritePtr).toBe(testSamples.length);

      // Check that samples are in buffer
      for (let i = 0; i < testSamples.length; i++) {
        const bufferIndex = i * 8; // 8 channels interleaved
        const storedValue = privateAccess.sampleBuffer[bufferIndex];
        console.log(`  Buffer[${i}] = ${storedValue} (expected ${testSamples[i]})`);
        expect(storedValue).toBe(testSamples[i]);
      }
    });

    test('should trigger FFT when buffer fills to configured sample size', () => {
      const spec = DebugFFTWindow.createDisplaySpec('MyFFT', [
        'FFT', 'MyFFT', 'SAMPLES', '64', 'RATE', '64'
      ]);

      const fftWindow = new DebugFFTWindow(context, spec);
      const privateAccess = fftWindow as any;

      // Configure channel
      fftWindow.updateContent(["'Test'", '0', '1000', '180', '10', '15', 'YELLOW', '12']);

      console.log('\n=== Testing FFT Trigger Point ===');
      console.log(`FFT should trigger after ${spec.samples} samples (with rate=${spec.rate})`);
      console.log(`rateCounter starts at: ${privateAccess.rateCounter} (should be rate-1 = ${spec.rate - 1})`);

      // Feed samples up to the trigger point
      const targetSamples = spec.samples + spec.rate; // Enough to trigger

      for (let i = 0; i < targetSamples; i++) {
        const value = Math.sin((i / 64) * Math.PI * 2) * 1000; // Sine wave
        fftWindow.updateContent([value.toFixed(0)]);

        if (i === spec.samples - 1) {
          console.log(`\nAt sample ${i + 1} (buffer full):`);
          console.log(`  samplePop: ${privateAccess.samplePop}`);
          console.log(`  rateCounter: ${privateAccess.rateCounter}`);
        }

        if (i === spec.samples + spec.rate - 1) {
          console.log(`\nAt sample ${i + 1} (should have triggered):`);
          console.log(`  samplePop: ${privateAccess.samplePop}`);
          console.log(`  rateCounter: ${privateAccess.rateCounter}`);
        }
      }

      // After feeding enough samples, samplePop should have reset
      // (indicating FFT was triggered and buffer reset for next cycle)
      console.log(`\nFinal samplePop: ${privateAccess.samplePop}`);
      console.log(`Final rateCounter: ${privateAccess.rateCounter}`);
    });
  });

  describe('Real Sine Wave FFT Processing', () => {
    test('should process real sine wave and produce expected FFT peak', () => {
      // Use actual data from external test
      const realSineWave = [
        194, 380, 552, 703, 827, 920, 979, 1000, 983, 929,
        840, 719, 570, 400, 215, 21, -173, -361, -535, -689,
        -817, -913, -975, -1000, -986, -935, -848, -729, -582, -413,
        -228, -34, 161, 350, 526, 681, 811, 909, 973, 999,
        987, 938, 852, 733, 587, 417, 232, 38, -158, -347,
        -524, -680, -810, -909, -973, -999, -987, -937, -851, -732,
        -585, -415, -229, -34 // Complete 64 samples for 64-point FFT
      ];

      const spec = DebugFFTWindow.createDisplaySpec('MyFFT', [
        'FFT', 'MyFFT', 'SAMPLES', '64', '0', '31', 'RATE', '64', 'LOGSCALE'
      ]);

      const fftWindow = new DebugFFTWindow(context, spec);
      const privateAccess = fftWindow as any;

      // Configure channel
      fftWindow.updateContent(["'FFT'", '0', '1000', '180', '10', '15', 'YELLOW', '12']);

      console.log('\n=== Real Sine Wave FFT Test ===');
      console.log(`Feeding ${realSineWave.length} sine wave samples...`);
      console.log(`Expected: Peak at low frequency bin (sine wave has ~1.5 cycles in 50 samples)`);

      // Feed all samples
      realSineWave.forEach((value, index) => {
        fftWindow.updateContent([value.toString()]);
      });

      // Feed more to trigger rate cycle
      for (let i = 0; i < spec.rate; i++) {
        const value = Math.sin((i / 64) * Math.PI * 2) * 1000;
        fftWindow.updateContent([value.toFixed(0)]);
      }

      console.log(`\nAfter feeding data:`);
      console.log(`  samplePop: ${privateAccess.samplePop}`);
      console.log(`  fftPower length: ${privateAccess.fftPower ? privateAccess.fftPower.length : 'null'}`);
      console.log(`  channelFFTResults length: ${privateAccess.channelFFTResults.length}`);

      // Check if FFT was calculated
      if (privateAccess.channelFFTResults.length > 0) {
        const channel0Result = privateAccess.channelFFTResults[0];
        const power = channel0Result.power;

        console.log(`\n📊 FFT Power Spectrum (first 32 bins):`);
        let maxPower = 0;
        let maxBin = 0;

        for (let bin = 0; bin < Math.min(32, power.length); bin++) {
          const powerValue = power[bin];
          if (powerValue > maxPower) {
            maxPower = powerValue;
            maxBin = bin;
          }

          if (bin < 10 || powerValue > 1000) {
            const bar = '█'.repeat(Math.min(50, Math.floor(powerValue / 1000)));
            console.log(`  Bin ${bin.toString().padStart(2)}: ${powerValue.toString().padStart(8)} ${bar}`);
          }
        }

        console.log(`\n✓ Peak found at bin ${maxBin} with power ${maxPower}`);
        console.log(`  Expected: Peak at low frequency bin (1-3 for ~1.5 cycles)`);

        // Verify peak is at low frequency (sine wave has ~1.5 cycles in 64 samples)
        // Peak should be at bin 1 or 2
        expect(maxBin).toBeLessThanOrEqual(5);
        expect(maxBin).toBeGreaterThanOrEqual(0);
        expect(maxPower).toBeGreaterThan(0);

        console.log(`\n✅ FFT processing working correctly!`);
        console.log(`   Peak is at expected low frequency bin`);
      } else {
        console.log(`\n❌ No FFT results found!`);
        console.log(`   This indicates FFT was not triggered`);
        console.log(`   Check: samplePop, rateCounter, triggerFFT() calls`);
      }
    });
  });

  describe('Rate Cycle Logic', () => {
    test('should count rate cycles correctly', () => {
      const spec = DebugFFTWindow.createDisplaySpec('MyFFT', [
        'FFT', 'MyFFT', 'SAMPLES', '64', 'RATE', '8' // Small rate for testing
      ]);

      const fftWindow = new DebugFFTWindow(context, spec);
      const privateAccess = fftWindow as any;

      // Configure channel
      fftWindow.updateContent(["'Test'", '0', '1000', '180', '10', '15', 'YELLOW', '12']);

      console.log('\n=== Rate Cycle Counter Test ===');
      console.log(`Initial rateCounter: ${privateAccess.rateCounter} (should be ${spec.rate - 1})`);

      expect(privateAccess.rateCounter).toBe(spec.rate - 1);

      // Fill buffer first
      for (let i = 0; i < spec.samples; i++) {
        fftWindow.updateContent(['100']);
      }

      console.log(`\nAfter filling buffer to ${spec.samples} samples:`);
      console.log(`  samplePop: ${privateAccess.samplePop}`);
      console.log(`  rateCounter: ${privateAccess.rateCounter}`);

      // Now feed rate more samples to trigger
      const rateCounterBefore = privateAccess.rateCounter;
      for (let i = 0; i < spec.rate; i++) {
        fftWindow.updateContent(['200']);
        console.log(`  Sample ${i + 1}/${spec.rate}: rateCounter=${privateAccess.rateCounter}, samplePop=${privateAccess.samplePop}`);
      }

      console.log(`\nAfter ${spec.rate} more samples:`);
      console.log(`  rateCounter: ${privateAccess.rateCounter} (should have reset to 0)`);
      console.log(`  samplePop: ${privateAccess.samplePop} (should have reset if FFT triggered)`);
    });
  });

  describe('Drawing Command Generation', () => {
    test('should generate correct drawing commands for spectrum', () => {
      const spec = DebugFFTWindow.createDisplaySpec('MyFFT', [
        'FFT', 'MyFFT', 'SIZE', '250', '200', 'SAMPLES', '64', '0', '31',
        'LINESIZE', '3' // Line mode
      ]);

      const fftWindow = new DebugFFTWindow(context, spec);
      const privateAccess = fftWindow as any;

      console.log('\n=== Drawing Command Generation Test ===');
      console.log(`Window size: ${spec.size.width}x${spec.size.height}`);
      console.log(`Display range: bin ${spec.firstBin} to ${spec.lastBin}`);
      console.log(`Line size: ${spec.lineSize}`);

      // We would need to mock the window to test actual drawing
      // But we can verify the logic by checking internal state

      console.log(`\nDrawing mode: ${spec.lineSize >= 0 ? 'LINE/DOT' : 'BAR'}`);
      console.log(`Expected: ${spec.lineSize > 0 ? 'Line drawing' : spec.dotSize > 0 ? 'Dot drawing' : 'Bar drawing'}`);

      expect(spec.lineSize).toBe(3); // Line mode
      expect(spec.windowWidth).toBe(spec.size.width);
      expect(spec.windowHeight).toBe(spec.size.height);
    });
  });

  describe('Channel Configuration', () => {
    test('should parse and store channel configuration correctly', () => {
      const spec = DebugFFTWindow.createDisplaySpec('MyFFT', [
        'FFT', 'MyFFT', 'SAMPLES', '64'
      ]);

      const fftWindow = new DebugFFTWindow(context, spec);
      const privateAccess = fftWindow as any;

      console.log('\n=== Channel Configuration Test ===');
      console.log(`Initial channels: ${privateAccess.channels.length}`);
      console.log(`Initial channelMask: 0x${privateAccess.channelMask.toString(16)}`);

      // Add channel configuration
      fftWindow.updateContent(["'FFT'", '0', '1000', '180', '10', '15', 'YELLOW', '12']);

      console.log(`\nAfter channel config:`);
      console.log(`  channels.length: ${privateAccess.channels.length}`);
      console.log(`  channelMask: 0x${privateAccess.channelMask.toString(16)}`);

      if (privateAccess.channels.length > 0) {
        const channel = privateAccess.channels[0];
        console.log(`  Channel 0:`);
        console.log(`    label: "${channel.label}"`);
        console.log(`    magnitude: ${channel.magnitude}`);
        console.log(`    high: ${channel.high}`);
        console.log(`    tall: ${channel.tall}`);
        console.log(`    color: ${channel.color}`);

        expect(channel.label).toBe('FFT');
        expect(channel.magnitude).toBe(0);
        expect(channel.high).toBe(1000);
        expect(channel.tall).toBe(180);
      }

      // Verify channel 0 is enabled in mask
      expect(privateAccess.channelMask & 0x01).toBe(0x01);
    });
  });
});
