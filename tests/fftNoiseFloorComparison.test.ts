/** @format */

/**
 * FFT Noise Floor Comparison Test
 *
 * This test runs identical input data through:
 * 1. TypeScript FFT implementation (current)
 * 2. Python Pascal FFT simulator (via child process)
 *
 * Goal: Measure actual noise floor differences to identify root cause
 */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('FFT Noise Floor Comparison - TypeScript vs Python', () => {
  let fftProcessor: FFTProcessor;
  const FFT_SIZE = 2048;
  const MAGNITUDE = 0;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
    fftProcessor.prepareFFT(FFT_SIZE);
  });

  /**
   * Generate the EXACT P2 waveform used in Python simulator
   * This matches the generate_p2_waveform() function in pascal_fft_simulator_v2.py
   */
  function generateP2Waveform(numSamples: number): Int32Array {
    const samples = new Int32Array(numSamples);
    let i = 0;
    let j = 0;

    for (let idx = 0; idx < numSamples; idx++) {
      // Phase increment with FM modulation
      // modulation = qsin(1300, i, 31_000)
      const modAngle = (2 * Math.PI * (i % 31000)) / 31000;
      const modulation = Math.round(1300 * Math.sin(modAngle));
      j += 1550 + modulation;
      i += 1;

      // Generate output sample
      // k = qsin(1000, j, 50_000)
      const outAngle = (2 * Math.PI * (j % 50000)) / 50000;
      const k = Math.round(1000 * Math.sin(outAngle));
      samples[idx] = k;
    }

    return samples;
  }

  /**
   * Generate simple test signals for comparison
   */
  function generateTestSignals() {
    return {
      zeros: new Int32Array(FFT_SIZE).fill(0),

      dc: new Int32Array(FFT_SIZE).fill(1000),

      pureSine: (() => {
        const sine = new Int32Array(FFT_SIZE);
        const frequency = 10; // bin 10
        const amplitude = 10000;
        for (let i = 0; i < FFT_SIZE; i++) {
          sine[i] = Math.round(amplitude * Math.sin(2 * Math.PI * frequency * i / FFT_SIZE));
        }
        return sine;
      })(),

      p2Waveform: generateP2Waveform(FFT_SIZE)
    };
  }

  /**
   * Calculate noise floor statistics from FFT power output
   */
  function analyzeNoiseFloor(power: Int32Array, excludeBin: number | null = null) {
    const bins = Array.from(power);

    // Exclude peak bin and neighbors if specified
    let noiseBins = bins;
    if (excludeBin !== null) {
      noiseBins = bins.filter((_, i) => Math.abs(i - excludeBin) > 10);
    }

    const zeroBins = noiseBins.filter(p => p === 0).length;
    const nonZeroBins = noiseBins.filter(p => p > 0);
    const avgNoise = nonZeroBins.length > 0
      ? nonZeroBins.reduce((a, b) => a + b, 0) / nonZeroBins.length
      : 0;
    const maxNoise = Math.max(...noiseBins);
    const minNoise = Math.min(...noiseBins);

    return {
      average: avgNoise,
      max: maxNoise,
      min: minNoise,
      zeroBins,
      nonZeroBins: nonZeroBins.length,
      distribution: {
        zero: zeroBins,
        low: noiseBins.filter(p => p >= 1 && p <= 3).length,
        medium: noiseBins.filter(p => p >= 4 && p <= 7).length,
        high: noiseBins.filter(p => p > 7).length
      }
    };
  }

  /**
   * Run Python FFT simulator on the same data
   */
  function runPythonFFT(samples: Int32Array): { power: number[], noiseFloor: number, peak: number, peakBin: number } {
    // Create temporary input file with samples
    const tempInputFile = path.join(__dirname, '../temp_fft_input.txt');
    const samplesStr = Array.from(samples).join('\n');
    fs.writeFileSync(tempInputFile, samplesStr);

    // Create a Python script that reads our data and runs the FFT
    const pythonScript = `
import sys
import math

def pascal_round(x):
    """Pascal's Round() uses banker's rounding (round half to even)."""
    if x - math.floor(x) == 0.5:
        floor_val = int(math.floor(x))
        if floor_val % 2 == 0:
            return floor_val
        else:
            return int(math.ceil(x))
    else:
        return int(round(x))

def pascal_div(a, b):
    """Pascal's div operator - integer division that truncates toward zero."""
    return int(a // b)

def rev32(i):
    """Pascal's Rev32 function for bit reversal."""
    Rev4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE,
            0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF]
    result = ((Rev4[(i >> 0) & 0xF] << 28) |
              (Rev4[(i >> 4) & 0xF] << 24) |
              (Rev4[(i >> 8) & 0xF] << 20)) & 0xFFF00000
    return result

def prepare_fft_tables(fft_size):
    """Prepare FFT lookup tables exactly as Pascal does."""
    fft_exp = int(math.log2(fft_size))
    FFTsin = [0] * fft_size
    FFTcos = [0] * fft_size
    FFTwin = [0] * fft_size

    for i in range(fft_size):
        tf = rev32(i) / 0x100000000 * math.pi
        Yf = math.sin(tf)
        Xf = math.cos(tf)
        FFTsin[i] = pascal_round(Yf * 0x1000)
        FFTcos[i] = pascal_round(Xf * 0x1000)
        hanningValue = 1 - math.cos((i / fft_size) * math.pi * 2)
        FFTwin[i] = pascal_round(hanningValue * 0x1000)

    return FFTsin, FFTcos, FFTwin, fft_exp

def perform_fft_pascal(samples, FFTsin, FFTcos, FFTwin, fft_exp, magnitude=0):
    """Perform FFT exactly as Pascal does."""
    fft_size = len(samples)
    FFTreal = [0] * fft_size
    FFTimag = [0] * fft_size

    # Load samples with Hanning window
    for i in range(fft_size):
        FFTreal[i] = samples[i] * FFTwin[i]
        FFTimag[i] = 0

    # Cooley-Tukey FFT
    i1 = 1 << (fft_exp - 1)
    i2 = 1

    while i1 != 0:
        th = 0
        i3 = 0
        i4 = i1
        c1 = i2

        while c1 != 0:
            ptra = i3
            ptrb = ptra + i1
            c2 = i4 - i3

            while c2 != 0:
                ax = FFTreal[ptra]
                ay = FFTimag[ptra]
                bx = FFTreal[ptrb]
                by = FFTimag[ptrb]

                rx = pascal_div(bx * FFTcos[th] - by * FFTsin[th], 0x1000)
                ry = pascal_div(bx * FFTsin[th] + by * FFTcos[th], 0x1000)

                FFTreal[ptra] = ax + rx
                FFTimag[ptra] = ay + ry
                FFTreal[ptrb] = ax - rx
                FFTimag[ptrb] = ay - ry

                ptra += 1
                ptrb += 1
                c2 -= 1

            th += 1
            i3 += i1 << 1
            i4 += i1 << 1
            c1 -= 1

        i1 >>= 1
        i2 <<= 1

    # Convert to power
    result_size = 1 << (fft_exp - 1)
    FFTpower = [0] * result_size

    for i in range(result_size):
        i2 = rev32(i) >> (32 - fft_exp)
        rx = FFTreal[i2]
        ry = FFTimag[i2]
        scale_factor = (0x800 << fft_exp) >> magnitude
        magnitude_val = math.hypot(rx, ry)
        FFTpower[i] = pascal_round(magnitude_val / scale_factor)

    return FFTpower

# Read samples from temp file
with open('${tempInputFile}', 'r') as f:
    samples = [int(line.strip()) for line in f.readlines()]

# Prepare FFT
fft_size = len(samples)
FFTsin, FFTcos, FFTwin, fft_exp = prepare_fft_tables(fft_size)

# Perform FFT
power = perform_fft_pascal(samples, FFTsin, FFTcos, FFTwin, fft_exp, magnitude=0)

# Find peak
peak_power = max(power)
peak_bin = power.index(peak_power)

# Calculate noise floor (excluding peak ±10 bins)
noise_bins = [p for i, p in enumerate(power) if abs(i - peak_bin) > 10]
avg_noise = sum(noise_bins) / len(noise_bins) if noise_bins else 0

# Output results as JSON
import json
result = {
    'power': power,
    'peak': peak_power,
    'peakBin': peak_bin,
    'noiseFloor': avg_noise
}
print(json.dumps(result))
`;

    const tempPythonFile = path.join(__dirname, '../temp_fft_test.py');
    fs.writeFileSync(tempPythonFile, pythonScript);

    try {
      const output = execSync(`cd ${path.dirname(tempPythonFile)} && python3 temp_fft_test.py`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large output
      });

      const result = JSON.parse(output);

      // Cleanup
      fs.unlinkSync(tempInputFile);
      fs.unlinkSync(tempPythonFile);

      return result;
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
      if (fs.existsSync(tempPythonFile)) fs.unlinkSync(tempPythonFile);
      throw error;
    }
  }

  test('Zero input - TypeScript vs Python noise floor', () => {
    const signals = generateTestSignals();

    console.log('\n========================================');
    console.log('TEST: ZERO INPUT');
    console.log('========================================\n');

    // TypeScript FFT
    const tsResult = fftProcessor.performFFT(signals.zeros, MAGNITUDE);
    const tsNoise = analyzeNoiseFloor(tsResult.power);

    console.log('TypeScript FFT:');
    console.log(`  Average noise: ${tsNoise.average.toFixed(3)}`);
    console.log(`  Max noise: ${tsNoise.max}`);
    console.log(`  Zero bins: ${tsNoise.zeroBins}/${tsResult.power.length}`);
    console.log(`  Distribution: ${JSON.stringify(tsNoise.distribution)}`);

    // Python FFT
    const pyResult = runPythonFFT(signals.zeros);
    const pyPower = new Int32Array(pyResult.power);
    const pyNoise = analyzeNoiseFloor(pyPower);

    console.log('\nPython FFT:');
    console.log(`  Average noise: ${pyNoise.average.toFixed(3)}`);
    console.log(`  Max noise: ${pyNoise.max}`);
    console.log(`  Zero bins: ${pyNoise.zeroBins}/${pyPower.length}`);
    console.log(`  Distribution: ${JSON.stringify(pyNoise.distribution)}`);

    console.log('\nComparison:');
    const ratio = tsNoise.average / (pyNoise.average || 0.001);
    console.log(`  TypeScript / Python ratio: ${ratio.toFixed(1)}x`);
    console.log(`  Difference: ${(tsNoise.average - pyNoise.average).toFixed(3)}`);

    // Zero input MUST produce zero output
    expect(tsNoise.max).toBe(0);
    expect(pyNoise.max).toBe(0);
  });

  test('DC signal - TypeScript vs Python noise floor', () => {
    const signals = generateTestSignals();

    console.log('\n========================================');
    console.log('TEST: DC SIGNAL');
    console.log('========================================\n');

    // TypeScript FFT
    const tsResult = fftProcessor.performFFT(signals.dc, MAGNITUDE);
    const tsPeak = Math.max(...tsResult.power);
    const tsPeakBin = tsResult.power.indexOf(tsPeak);
    const tsNoise = analyzeNoiseFloor(tsResult.power, tsPeakBin);

    console.log('TypeScript FFT:');
    console.log(`  Peak: ${tsPeak} at bin ${tsPeakBin}`);
    console.log(`  Average noise: ${tsNoise.average.toFixed(3)}`);
    console.log(`  Max noise: ${tsNoise.max}`);
    console.log(`  Distribution: ${JSON.stringify(tsNoise.distribution)}`);

    // Python FFT
    const pyResult = runPythonFFT(signals.dc);
    const pyPower = new Int32Array(pyResult.power);
    const pyNoise = analyzeNoiseFloor(pyPower, pyResult.peakBin);

    console.log('\nPython FFT:');
    console.log(`  Peak: ${pyResult.peak} at bin ${pyResult.peakBin}`);
    console.log(`  Average noise: ${pyNoise.average.toFixed(3)}`);
    console.log(`  Max noise: ${pyNoise.max}`);
    console.log(`  Distribution: ${JSON.stringify(pyNoise.distribution)}`);

    console.log('\nComparison:');
    const ratio = tsNoise.average / (pyNoise.average || 0.001);
    console.log(`  TypeScript / Python ratio: ${ratio.toFixed(1)}x`);
    console.log(`  Difference: ${(tsNoise.average - pyNoise.average).toFixed(3)}`);
  });

  test('Pure sine wave - TypeScript vs Python noise floor', () => {
    const signals = generateTestSignals();

    console.log('\n========================================');
    console.log('TEST: PURE SINE WAVE (bin 10)');
    console.log('========================================\n');

    // TypeScript FFT
    const tsResult = fftProcessor.performFFT(signals.pureSine, MAGNITUDE);
    const tsPeak = Math.max(...tsResult.power);
    const tsPeakBin = tsResult.power.indexOf(tsPeak);
    const tsNoise = analyzeNoiseFloor(tsResult.power, tsPeakBin);

    console.log('TypeScript FFT:');
    console.log(`  Peak: ${tsPeak} at bin ${tsPeakBin}`);
    console.log(`  Average noise: ${tsNoise.average.toFixed(3)}`);
    console.log(`  Max noise: ${tsNoise.max}`);
    console.log(`  SNR: ${(tsPeak / (tsNoise.average || 0.001)).toFixed(1)}:1`);
    console.log(`  Distribution: ${JSON.stringify(tsNoise.distribution)}`);

    // Python FFT
    const pyResult = runPythonFFT(signals.pureSine);
    const pyPower = new Int32Array(pyResult.power);
    const pyNoise = analyzeNoiseFloor(pyPower, pyResult.peakBin);

    console.log('\nPython FFT:');
    console.log(`  Peak: ${pyResult.peak} at bin ${pyResult.peakBin}`);
    console.log(`  Average noise: ${pyNoise.average.toFixed(3)}`);
    console.log(`  Max noise: ${pyNoise.max}`);
    console.log(`  SNR: ${(pyResult.peak / (pyNoise.average || 0.001)).toFixed(1)}:1`);
    console.log(`  Distribution: ${JSON.stringify(pyNoise.distribution)}`);

    console.log('\nComparison:');
    const ratio = tsNoise.average / (pyNoise.average || 0.001);
    console.log(`  TypeScript / Python ratio: ${ratio.toFixed(1)}x`);
    console.log(`  Difference: ${(tsNoise.average - pyNoise.average).toFixed(3)}`);
  });

  test('P2 FM waveform - TypeScript vs Python noise floor', () => {
    const signals = generateTestSignals();

    console.log('\n========================================');
    console.log('TEST: P2 FM WAVEFORM (realistic data)');
    console.log('========================================\n');

    console.log('Input waveform:');
    console.log(`  Sample count: ${signals.p2Waveform.length}`);
    console.log(`  Range: ${Math.min(...signals.p2Waveform)} to ${Math.max(...signals.p2Waveform)}`);
    console.log(`  First 10: [${Array.from(signals.p2Waveform.slice(0, 10)).join(', ')}]`);

    // TypeScript FFT
    const tsResult = fftProcessor.performFFT(signals.p2Waveform, MAGNITUDE);
    const tsPeak = Math.max(...tsResult.power);
    const tsPeakBin = tsResult.power.indexOf(tsPeak);
    const tsNoise = analyzeNoiseFloor(tsResult.power, tsPeakBin);

    console.log('\nTypeScript FFT:');
    console.log(`  Peak: ${tsPeak} at bin ${tsPeakBin}`);
    console.log(`  Average noise: ${tsNoise.average.toFixed(3)}`);
    console.log(`  Max noise: ${tsNoise.max}`);
    console.log(`  SNR: ${(tsPeak / (tsNoise.average || 0.001)).toFixed(1)}:1`);
    console.log(`  Distribution: ${JSON.stringify(tsNoise.distribution)}`);
    console.log(`  First 20 bins: [${Array.from(tsResult.power.slice(0, 20)).join(', ')}]`);

    // Python FFT
    const pyResult = runPythonFFT(signals.p2Waveform);
    const pyPower = new Int32Array(pyResult.power);
    const pyNoise = analyzeNoiseFloor(pyPower, pyResult.peakBin);

    console.log('\nPython FFT:');
    console.log(`  Peak: ${pyResult.peak} at bin ${pyResult.peakBin}`);
    console.log(`  Average noise: ${pyNoise.average.toFixed(3)}`);
    console.log(`  Max noise: ${pyNoise.max}`);
    console.log(`  SNR: ${(pyResult.peak / (pyNoise.average || 0.001)).toFixed(1)}:1`);
    console.log(`  Distribution: ${JSON.stringify(pyNoise.distribution)}`);
    console.log(`  First 20 bins: [${pyResult.power.slice(0, 20).join(', ')}]`);

    console.log('\n========================================');
    console.log('FINAL COMPARISON');
    console.log('========================================');
    const ratio = tsNoise.average / (pyNoise.average || 0.001);
    console.log(`TypeScript noise floor: ${tsNoise.average.toFixed(3)}`);
    console.log(`Python noise floor: ${pyNoise.average.toFixed(3)}`);
    console.log(`Ratio: ${ratio.toFixed(1)}x`);
    console.log(`Difference: ${(tsNoise.average - pyNoise.average).toFixed(3)}`);

    if (ratio > 10) {
      console.log('\n🔴 SIGNIFICANT DIFFERENCE - TypeScript has much higher noise!');
    } else if (ratio > 2) {
      console.log('\n⚠️  MODERATE DIFFERENCE - TypeScript noise is elevated');
    } else {
      console.log('\n✅ SIMILAR - Both implementations have comparable noise floors');
    }
  });
});
