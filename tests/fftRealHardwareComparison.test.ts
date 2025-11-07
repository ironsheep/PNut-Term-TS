/** @format */

/**
 * FFT Real Hardware Data Comparison Test
 *
 * This test uses ACTUAL sample data from P2 hardware captured in logs
 * and compares TypeScript FFT vs Python Pascal FFT implementations
 *
 * Data source: test-results/external-results/debug_251106-164458.log
 * Sample count: 2048 (exactly one FFT window)
 */

import { FFTProcessor } from '../src/classes/shared/fftProcessor';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('FFT Real Hardware Data Comparison', () => {
  let fftProcessor: FFTProcessor;
  const FFT_SIZE = 2048;
  const MAGNITUDE = 0;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
    fftProcessor.prepareFFT(FFT_SIZE);
  });

  /**
   * Load actual sample data from P2 hardware log
   */
  function loadRealHardwareSamples(): Int32Array {
    const samplesFile = path.join(__dirname, '../test-results/external-results/fft_input_samples.txt');
    const data = fs.readFileSync(samplesFile, 'utf8');
    const values = data.trim().split('\n').map(line => parseInt(line.trim(), 10));

    if (values.length !== FFT_SIZE) {
      throw new Error(`Expected ${FFT_SIZE} samples, got ${values.length}`);
    }

    return new Int32Array(values);
  }

  /**
   * Run Python Pascal FFT on the same data
   */
  function runPythonFFT(samples: Int32Array): {
    power: number[];
    peak: number;
    peakBin: number;
    noiseFloorAvg: number;
    noiseFloorMax: number;
    first20Bins: number[];
  } {
    // Write samples to temp file
    const tempInputFile = path.join(__dirname, '../temp_real_fft_input.txt');
    const samplesStr = Array.from(samples).join('\n');
    fs.writeFileSync(tempInputFile, samplesStr);

    // Python script that matches pascal_fft_simulator_v2.py exactly
    const pythonScript = `
import sys
import math

def pascal_round(x):
    """Pascal's Round() uses banker's rounding."""
    if x - math.floor(x) == 0.5:
        floor_val = int(math.floor(x))
        return floor_val if floor_val % 2 == 0 else int(math.ceil(x))
    return int(round(x))

def pascal_div(a, b):
    """Pascal's div operator."""
    return int(a // b)

def rev32(i):
    """Pascal's Rev32 function."""
    Rev4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE,
            0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF]
    result = ((Rev4[(i >> 0) & 0xF] << 28) |
              (Rev4[(i >> 4) & 0xF] << 24) |
              (Rev4[(i >> 8) & 0xF] << 20)) & 0xFFF00000
    return result

def prepare_fft_tables(fft_size):
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
    fft_size = len(samples)
    FFTreal = [0] * fft_size
    FFTimag = [0] * fft_size

    # Windowing
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

# Read samples
with open('${tempInputFile}', 'r') as f:
    samples = [int(line.strip()) for line in f.readlines()]

# Prepare and run FFT
fft_size = len(samples)
FFTsin, FFTcos, FFTwin, fft_exp = prepare_fft_tables(fft_size)
power = perform_fft_pascal(samples, FFTsin, FFTcos, FFTwin, fft_exp, magnitude=0)

# Analyze results
peak_power = max(power)
peak_bin = power.index(peak_power)
noise_bins = [p for i, p in enumerate(power) if abs(i - peak_bin) > 10]
avg_noise = sum(noise_bins) / len(noise_bins) if noise_bins else 0
max_noise = max(noise_bins) if noise_bins else 0

# Output as JSON
import json
result = {
    'power': power,
    'peak': peak_power,
    'peakBin': peak_bin,
    'noiseFloorAvg': avg_noise,
    'noiseFloorMax': max_noise,
    'first20Bins': power[:20]
}
print(json.dumps(result))
`;

    const tempPythonFile = path.join(__dirname, '../temp_real_fft_test.py');
    fs.writeFileSync(tempPythonFile, pythonScript);

    try {
      const output = execSync(`cd ${path.dirname(tempPythonFile)} && python3 temp_real_fft_test.py`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });

      const result = JSON.parse(output);

      // Cleanup
      fs.unlinkSync(tempInputFile);
      fs.unlinkSync(tempPythonFile);

      return result;
    } catch (error) {
      if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
      if (fs.existsSync(tempPythonFile)) fs.unlinkSync(tempPythonFile);
      throw error;
    }
  }

  /**
   * Calculate noise floor statistics
   */
  function analyzeNoiseFloor(power: Int32Array, excludeBin: number) {
    const bins = Array.from(power);
    const noiseBins = bins.filter((_, i) => Math.abs(i - excludeBin) > 10);

    // Calculate INCLUDING zeros (Pascal method)
    const avgNoise = noiseBins.reduce((a, b) => a + b, 0) / noiseBins.length;
    const maxNoise = Math.max(...noiseBins);
    const minNoise = Math.min(...noiseBins);
    const zeroBins = noiseBins.filter(p => p === 0).length;

    return {
      average: avgNoise,
      max: maxNoise,
      min: minNoise,
      zeroBins,
      totalNoiseBins: noiseBins.length,
      distribution: {
        zero: noiseBins.filter(p => p === 0).length,
        low: noiseBins.filter(p => p >= 1 && p <= 3).length,
        medium: noiseBins.filter(p => p >= 4 && p <= 7).length,
        high: noiseBins.filter(p => p > 7).length
      }
    };
  }

  test('Real P2 hardware data - TypeScript vs Python', () => {
    console.log('\n========================================');
    console.log('REAL P2 HARDWARE DATA COMPARISON');
    console.log('========================================\n');

    // Load real hardware samples
    const samples = loadRealHardwareSamples();
    console.log('Sample data loaded:');
    console.log(`  Count: ${samples.length}`);
    console.log(`  Range: ${Math.min(...samples)} to ${Math.max(...samples)}`);
    console.log(`  First 10: [${Array.from(samples.slice(0, 10)).join(', ')}]`);
    console.log(`  Last 10: [${Array.from(samples.slice(-10)).join(', ')}]`);

    // Run TypeScript FFT
    console.log('\n--- TypeScript FFT ---');
    const tsResult = fftProcessor.performFFT(samples, MAGNITUDE);
    const tsPeak = Math.max(...tsResult.power);
    const tsPeakBin = tsResult.power.indexOf(tsPeak);
    const tsNoise = analyzeNoiseFloor(tsResult.power, tsPeakBin);
    const tsFirst20 = Array.from(tsResult.power.slice(0, 20));

    console.log(`Peak: ${tsPeak} at bin ${tsPeakBin}`);
    console.log(`Noise floor (avg): ${tsNoise.average.toFixed(3)}`);
    console.log(`Noise floor (max): ${tsNoise.max}`);
    console.log(`Zero bins: ${tsNoise.zeroBins}/${tsNoise.totalNoiseBins}`);
    console.log(`Distribution: zero=${tsNoise.distribution.zero}, low=${tsNoise.distribution.low}, med=${tsNoise.distribution.medium}, high=${tsNoise.distribution.high}`);
    console.log(`First 20 bins: [${tsFirst20.join(', ')}]`);

    // Run Python FFT
    console.log('\n--- Python Pascal FFT ---');
    const pyResult = runPythonFFT(samples);

    console.log(`Peak: ${pyResult.peak} at bin ${pyResult.peakBin}`);
    console.log(`Noise floor (avg): ${pyResult.noiseFloorAvg.toFixed(3)}`);
    console.log(`Noise floor (max): ${pyResult.noiseFloorMax}`);
    console.log(`First 20 bins: [${pyResult.first20Bins.join(', ')}]`);

    // Comparison
    console.log('\n========================================');
    console.log('COMPARISON RESULTS');
    console.log('========================================');
    console.log(`TypeScript noise floor: ${tsNoise.average.toFixed(3)}`);
    console.log(`Python noise floor:     ${pyResult.noiseFloorAvg.toFixed(3)}`);

    const ratio = tsNoise.average / (pyResult.noiseFloorAvg || 0.001);
    console.log(`\nRatio: ${ratio.toFixed(2)}x`);
    console.log(`Difference: ${(tsNoise.average - pyResult.noiseFloorAvg).toFixed(3)}`);

    console.log('\nFirst 20 bins comparison:');
    console.log(`TypeScript: [${tsFirst20.join(', ')}]`);
    console.log(`Python:     [${pyResult.first20Bins.join(', ')}]`);

    // Check if they match
    const binsMatch = tsFirst20.every((val, idx) => val === pyResult.first20Bins[idx]);
    console.log(`\nFirst 20 bins match: ${binsMatch ? '✅ YES' : '❌ NO'}`);

    if (ratio > 10) {
      console.log('\n🔴 SIGNIFICANT DIFFERENCE - TypeScript has much higher noise!');
      console.log('   This confirms the noise floor problem exists in TypeScript.');
    } else if (ratio > 2) {
      console.log('\n⚠️  MODERATE DIFFERENCE - TypeScript noise is elevated');
    } else {
      console.log('\n✅ SIMILAR - Both implementations have comparable noise floors');
    }

    // Also log SNR comparison
    const tsSNR = tsPeak / (tsNoise.average || 0.001);
    const pySNR = pyResult.peak / (pyResult.noiseFloorAvg || 0.001);
    console.log(`\nSNR comparison:`);
    console.log(`  TypeScript: ${tsSNR.toFixed(1)}:1`);
    console.log(`  Python:     ${pySNR.toFixed(1)}:1`);
    console.log(`  SNR ratio:  ${(pySNR / tsSNR).toFixed(2)}x (Python better)`);
  });
});
