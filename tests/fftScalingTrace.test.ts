/** @format */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';

describe('FFT Scaling Trace', () => {
  it('should trace scaling through FFT pipeline', () => {
    const processor = new FFTProcessor();

    // Setup for 8 samples (smallest FFT for easy tracing)
    processor.prepareFFT(8);

    // Create a simple test signal
    const samples = new Int32Array(8);
    samples[0] = 1000;  // DC component
    samples[1] = 500;
    samples[2] = 0;
    samples[3] = -500;
    samples[4] = -1000;
    samples[5] = -500;
    samples[6] = 0;
    samples[7] = 500;

    console.log('=== FFT SCALING TRACE ===');
    console.log('Input samples:', Array.from(samples));

    // Get window coefficients
    const window = processor.getWindowTable();
    console.log('Hanning window (hex):', Array.from(window).map(w => '0x' + w.toString(16)));

    // Manually calculate what should happen
    console.log('\n--- After Windowing (sample * window) ---');
    for (let i = 0; i < 8; i++) {
      const afterWindow = samples[i] * window[i];
      console.log(`samples[${i}] * window[${i}] = ${samples[i]} * 0x${window[i].toString(16)} = 0x${afterWindow.toString(16)}`);
    }

    // Run actual FFT
    const result = processor.performFFT(samples, 0);

    console.log('\n--- FFT Output ---');
    console.log('Power array:', Array.from(result.power));
    console.log('First 4 power values (hex):', Array.from(result.power.slice(0, 4)).map(p => '0x' + p.toString(16)));

    // Calculate what the scale factor should be
    const fftExp = 3; // log2(8)
    const magnitude = 0;
    const scale_factor = (0x800 << fftExp) >> magnitude;
    console.log(`\nScale factor: 0x800 << ${fftExp} >> ${magnitude} = 0x${scale_factor.toString(16)}`);

    // Check if our power values are too small
    const maxPower = Math.max(...result.power);
    console.log(`\nMax power: ${maxPower}`);

    if (maxPower < 100) {
      console.log('WARNING: Power values seem too small!');
    }
  });

  it('should compare with Pascal calculation', () => {
    const processor = new FFTProcessor();
    processor.prepareFFT(8);

    // Simple DC signal
    const samples = new Int32Array(8);
    samples.fill(1000); // All samples = 1000 (pure DC)

    console.log('\n=== PASCAL COMPARISON ===');
    console.log('Input: 8 samples, all = 1000 (pure DC)');

    const result = processor.performFFT(samples, 0);

    console.log('Power at DC (bin 0):', result.power[0]);
    console.log('Power at other bins:', Array.from(result.power.slice(1, 4)));

    // With pure DC input, all power should be at bin 0
    // The value depends on the scaling

    // Let's manually calculate what Pascal would do:
    // 1. Window: sample * window[i] where window[0] = 0 (Hanning starts at 0)
    //    So the DC gets heavily attenuated by the window!

    const window = processor.getWindowTable();
    let windowedSum = 0;
    for (let i = 0; i < 8; i++) {
      windowedSum += 1000 * window[i];
    }
    console.log(`\nSum after windowing: ${windowedSum} (0x${windowedSum.toString(16)})`);

    // After FFT, this should mostly appear at DC
    // Power = hypot(real, imag) / scale_factor
    // For DC, imag = 0, so power = abs(real) / scale_factor
  });
});