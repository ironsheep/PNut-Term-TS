/** @format */

'use strict';

// tests/utils/signalGenerator.ts

/**
 * Test Signal Generator Utility
 * 
 * Provides deterministic signal generation functions for testing FFT implementations.
 * All functions are pure and generate arrays of the specified length.
 */

/**
 * Simple seeded pseudo-random number generator for deterministic noise
 * Uses a linear congruential generator (LCG) algorithm
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

/**
 * Generate a sine wave signal
 * @param length - Number of samples to generate
 * @param frequency - Frequency in cycles per sample (0-0.5 for Nyquist compliance)
 * @param amplitude - Peak amplitude of the sine wave
 * @param phase - Phase offset in radians (default: 0)
 * @returns Array of sine wave samples
 * 
 * @example
 * // Generate 256 samples of 10Hz sine at 1000 amplitude
 * const signal = generateSineWave(256, 10/256, 1000);
 */
export function generateSineWave(
  length: number,
  frequency: number,
  amplitude: number,
  phase: number = 0
): number[] {
  if (length <= 0) return [];
  
  const samples: number[] = [];
  const omega = 2 * Math.PI * frequency;
  
  for (let i = 0; i < length; i++) {
    samples.push(amplitude * Math.sin(omega * i + phase));
  }
  
  return samples;
}

/**
 * Generate a square wave signal
 * @param length - Number of samples to generate
 * @param frequency - Frequency in cycles per sample (0-0.5 for Nyquist compliance)
 * @param amplitude - Peak amplitude of the square wave
 * @param dutyCycle - Duty cycle (0-1, default: 0.5 for 50% duty cycle)
 * @returns Array of square wave samples
 * 
 * @example
 * // Generate 256 samples of 10Hz square wave at 1000 amplitude
 * const signal = generateSquareWave(256, 10/256, 1000);
 */
export function generateSquareWave(
  length: number,
  frequency: number,
  amplitude: number,
  dutyCycle: number = 0.5
): number[] {
  if (length <= 0) return [];
  
  const samples: number[] = [];
  const period = 1 / frequency;
  const highDuration = period * dutyCycle;
  
  for (let i = 0; i < length; i++) {
    const phaseInPeriod = (i % period) / period;
    samples.push(phaseInPeriod < dutyCycle ? amplitude : -amplitude);
  }
  
  return samples;
}

/**
 * Generate white noise signal with seeded random generator for deterministic results
 * @param length - Number of samples to generate
 * @param amplitude - Peak amplitude of the noise
 * @param seed - Random seed for deterministic generation (default: 12345)
 * @returns Array of white noise samples
 * 
 * @example
 * // Generate 256 samples of white noise at 500 amplitude
 * const signal = generateWhiteNoise(256, 500);
 */
export function generateWhiteNoise(
  length: number,
  amplitude: number,
  seed: number = 12345
): number[] {
  if (length <= 0) return [];
  
  const samples: number[] = [];
  const rng = new SeededRandom(seed);
  
  for (let i = 0; i < length; i++) {
    // Generate uniform random in [-1, 1] range
    const randomValue = (rng.next() * 2) - 1;
    samples.push(amplitude * randomValue);
  }
  
  return samples;
}

/**
 * Generate a DC offset signal (constant value)
 * @param length - Number of samples to generate
 * @param offset - DC offset value
 * @returns Array of constant DC samples
 * 
 * @example
 * // Generate 256 samples of DC offset at 100
 * const signal = generateDCOffset(256, 100);
 */
export function generateDCOffset(length: number, offset: number): number[] {
  if (length <= 0) return [];
  
  return new Array(length).fill(offset);
}

/**
 * Generate a sawtooth wave signal
 * @param length - Number of samples to generate
 * @param frequency - Frequency in cycles per sample
 * @param amplitude - Peak amplitude of the sawtooth wave
 * @returns Array of sawtooth wave samples
 * 
 * @example
 * // Generate 256 samples of 10Hz sawtooth at 1000 amplitude
 * const signal = generateSawtoothWave(256, 10/256, 1000);
 */
export function generateSawtoothWave(
  length: number,
  frequency: number,
  amplitude: number
): number[] {
  if (length <= 0) return [];
  
  const samples: number[] = [];
  const period = 1 / frequency;
  
  for (let i = 0; i < length; i++) {
    const phaseInPeriod = (i % period) / period;
    // Linear ramp from -amplitude to +amplitude
    samples.push(amplitude * (2 * phaseInPeriod - 1));
  }
  
  return samples;
}

/**
 * Generate a triangle wave signal
 * @param length - Number of samples to generate
 * @param frequency - Frequency in cycles per sample
 * @param amplitude - Peak amplitude of the triangle wave
 * @returns Array of triangle wave samples
 * 
 * @example
 * // Generate 256 samples of 10Hz triangle at 1000 amplitude
 * const signal = generateTriangleWave(256, 10/256, 1000);
 */
export function generateTriangleWave(
  length: number,
  frequency: number,
  amplitude: number
): number[] {
  if (length <= 0) return [];
  
  const samples: number[] = [];
  const period = 1 / frequency;
  
  for (let i = 0; i < length; i++) {
    const phaseInPeriod = (i % period) / period;
    let value: number;
    
    if (phaseInPeriod < 0.5) {
      // Rising edge: -amplitude to +amplitude
      value = amplitude * (4 * phaseInPeriod - 1);
    } else {
      // Falling edge: +amplitude to -amplitude
      value = amplitude * (3 - 4 * phaseInPeriod);
    }
    
    samples.push(value);
  }
  
  return samples;
}

/**
 * Generate a composite signal by adding multiple signals together
 * @param signals - Array of signal arrays to add together
 * @param length - Desired output length (will truncate or pad with zeros)
 * @returns Array of composite signal samples
 * 
 * @example
 * // Add sine wave and noise together
 * const sine = generateSineWave(256, 10/256, 1000);
 * const noise = generateWhiteNoise(256, 100);
 * const composite = generateCompositeSignal([sine, noise], 256);
 */
export function generateCompositeSignal(signals: number[][], length: number): number[] {
  if (length <= 0 || signals.length === 0) return [];
  
  const result: number[] = new Array(length).fill(0);
  
  for (const signal of signals) {
    for (let i = 0; i < length && i < signal.length; i++) {
      result[i] += signal[i];
    }
  }
  
  return result;
}

/**
 * Generate a chirp signal (frequency sweep)
 * @param length - Number of samples to generate
 * @param startFreq - Starting frequency in cycles per sample
 * @param endFreq - Ending frequency in cycles per sample
 * @param amplitude - Peak amplitude of the chirp
 * @returns Array of chirp signal samples
 * 
 * @example
 * // Generate frequency sweep from 1Hz to 100Hz over 1024 samples
 * const signal = generateChirp(1024, 1/1024, 100/1024, 1000);
 */
export function generateChirp(
  length: number,
  startFreq: number,
  endFreq: number,
  amplitude: number
): number[] {
  if (length <= 0) return [];
  
  const samples: number[] = [];
  const freqStep = (endFreq - startFreq) / length;
  
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const currentFreq = startFreq + (freqStep * i);
    samples.push(amplitude * Math.sin(phase));
    phase += 2 * Math.PI * currentFreq;
  }
  
  return samples;
}

/**
 * Apply a window function to a signal (useful for FFT testing)
 * @param signal - Input signal array
 * @param windowType - Type of window ('hanning', 'hamming', 'blackman')
 * @returns Array of windowed signal samples
 * 
 * @example
 * // Apply Hanning window to a sine wave
 * const sine = generateSineWave(256, 10/256, 1000);
 * const windowed = applyWindow(sine, 'hanning');
 */
export function applyWindow(signal: number[], windowType: 'hanning' | 'hamming' | 'blackman' = 'hanning'): number[] {
  if (signal.length === 0) return [];
  
  const windowed: number[] = [];
  const N = signal.length;
  
  for (let i = 0; i < N; i++) {
    let windowValue: number;
    
    switch (windowType) {
      case 'hanning':
        windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        break;
      case 'hamming':
        windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
        break;
      case 'blackman':
        windowValue = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (N - 1));
        break;
      default:
        windowValue = 1.0;
    }
    
    windowed.push(signal[i] * windowValue);
  }
  
  return windowed;
}