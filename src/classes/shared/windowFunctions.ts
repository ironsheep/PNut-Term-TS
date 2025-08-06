/** @format */

'use strict';

// src/classes/shared/windowFunctions.ts

/**
 * Window Functions for Signal Processing
 * 
 * This module provides window functions used in FFT processing to reduce
 * spectral leakage. Currently implements only the Hanning window to match
 * the Pascal reference implementation.
 * 
 * All window functions use 12-bit fixed-point arithmetic (scale 0x1000)
 * to exactly match Pascal's approach.
 */

/**
 * Window function type definition
 */
export type WindowFunction = 'hanning' | 'hamming' | 'blackman';

/**
 * Window Functions utility class
 */
export class WindowFunctions {
  private static readonly FIXED_POINT_SCALE = 0x1000; // 12-bit fixed-point scale (4096)
  
  /**
   * Generate Hanning window coefficients exactly matching Pascal implementation
   * 
   * Uses Pascal's exact formula: (1 - Cos((i / size) * Pi * 2)) * 0x1000
   * 
   * @param size Window size (must be power of 2, between 4 and 2048)
   * @returns Int32Array containing Hanning window coefficients
   * 
   * @example
   * const hanning = WindowFunctions.hanning(512);
   * // Apply to signal: windowed[i] = signal[i] * hanning[i] / 0x1000
   */
  public static hanning(size: number): Int32Array {
    if (size <= 0) {
      throw new Error(`Invalid window size: ${size}. Must be positive.`);
    }
    
    if (!this.isPowerOfTwo(size)) {
      throw new Error(`Window size ${size} is not a power of 2. FFT requires power-of-2 sizes.`);
    }
    
    if (size < 4 || size > 2048) {
      throw new Error(`Window size ${size} out of range. Must be between 4 and 2048.`);
    }
    
    const window = new Int32Array(size);
    
    // Generate Hanning window coefficients using Pascal's exact formula
    for (let i = 0; i < size; i++) {
      // Pascal formula: (1 - Cos((i / (1 shl FFTexp)) * Pi * 2)) * $1000
      const hanningValue = 1 - Math.cos((i / size) * Math.PI * 2);
      window[i] = Math.round(hanningValue * WindowFunctions.FIXED_POINT_SCALE);
    }
    
    return window;
  }
  
  /**
   * Generate Hamming window coefficients (not used in Pascal but included for completeness)
   * 
   * Formula: 0.54 - 0.46 * cos(2π * i / (N-1))
   * 
   * @param size Window size
   * @returns Int32Array containing Hamming window coefficients
   */
  public static hamming(size: number): Int32Array {
    if (size <= 0) {
      throw new Error(`Invalid window size: ${size}. Must be positive.`);
    }
    
    const window = new Int32Array(size);
    
    for (let i = 0; i < size; i++) {
      const hammingValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
      window[i] = Math.round(hammingValue * WindowFunctions.FIXED_POINT_SCALE);
    }
    
    return window;
  }
  
  /**
   * Generate Blackman window coefficients (not used in Pascal but included for completeness)
   * 
   * Formula: 0.42 - 0.5 * cos(2π * i / (N-1)) + 0.08 * cos(4π * i / (N-1))
   * 
   * @param size Window size
   * @returns Int32Array containing Blackman window coefficients
   */
  public static blackman(size: number): Int32Array {
    if (size <= 0) {
      throw new Error(`Invalid window size: ${size}. Must be positive.`);
    }
    
    const window = new Int32Array(size);
    
    for (let i = 0; i < size; i++) {
      const blackmanValue = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)) + 
                           0.08 * Math.cos(4 * Math.PI * i / (size - 1));
      window[i] = Math.round(blackmanValue * WindowFunctions.FIXED_POINT_SCALE);
    }
    
    return window;
  }
  
  /**
   * Apply a window function to a signal array in-place
   * 
   * @param signal Signal array to window (modified in-place)
   * @param windowCoefficients Window coefficients from hanning(), hamming(), etc.
   * @throws Error if signal and window arrays have different lengths
   * 
   * @example
   * const signal = new Int32Array([1000, 2000, 3000, 4000]);
   * const window = WindowFunctions.hanning(4);
   * WindowFunctions.applyWindow(signal, window);
   * // signal is now windowed in-place
   */
  public static applyWindow(signal: Int32Array, windowCoefficients: Int32Array): void {
    if (signal.length !== windowCoefficients.length) {
      throw new Error(`Signal length ${signal.length} does not match window length ${windowCoefficients.length}`);
    }
    
    // Apply window using fixed-point multiplication (matching Pascal approach)
    for (let i = 0; i < signal.length; i++) {
      // Fixed-point multiplication: (signal * window) / scale
      signal[i] = Math.round((signal[i] * windowCoefficients[i]) / WindowFunctions.FIXED_POINT_SCALE);
    }
  }
  
  /**
   * Apply a window function to a signal array, returning a new array
   * 
   * @param signal Signal array to window (original unchanged)
   * @param windowCoefficients Window coefficients from hanning(), hamming(), etc.
   * @returns New Int32Array containing windowed signal
   * @throws Error if signal and window arrays have different lengths
   * 
   * @example
   * const signal = new Int32Array([1000, 2000, 3000, 4000]);
   * const window = WindowFunctions.hanning(4);
   * const windowed = WindowFunctions.applyWindowCopy(signal, window);
   * // original signal unchanged, windowed contains windowed values
   */
  public static applyWindowCopy(signal: Int32Array, windowCoefficients: Int32Array): Int32Array {
    if (signal.length !== windowCoefficients.length) {
      throw new Error(`Signal length ${signal.length} does not match window length ${windowCoefficients.length}`);
    }
    
    const result = new Int32Array(signal.length);
    
    // Apply window using fixed-point multiplication
    for (let i = 0; i < signal.length; i++) {
      result[i] = Math.round((signal[i] * windowCoefficients[i]) / WindowFunctions.FIXED_POINT_SCALE);
    }
    
    return result;
  }
  
  /**
   * Get the fixed-point scale used by window functions
   * 
   * @returns Fixed-point scale (0x1000 = 4096)
   */
  public static getScale(): number {
    return WindowFunctions.FIXED_POINT_SCALE;
  }
  
  /**
   * Check if a number is a power of two
   * 
   * @param n Number to check
   * @returns True if n is a power of two
   */
  private static isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }
  
  /**
   * Validate window function name
   * 
   * @param windowType Window function type
   * @returns True if valid window type
   */
  public static isValidWindowType(windowType: string): windowType is WindowFunction {
    return ['hanning', 'hamming', 'blackman'].includes(windowType);
  }
  
  /**
   * Generate window coefficients by name
   * 
   * @param windowType Type of window function
   * @param size Window size
   * @returns Int32Array containing window coefficients
   * @throws Error if invalid window type or size
   * 
   * @example
   * const window = WindowFunctions.generateWindow('hanning', 512);
   */
  public static generateWindow(windowType: WindowFunction, size: number): Int32Array {
    switch (windowType) {
      case 'hanning':
        return this.hanning(size);
      case 'hamming':
        return this.hamming(size);
      case 'blackman':
        return this.blackman(size);
      default:
        throw new Error(`Unknown window type: ${windowType}`);
    }
  }
  
  /**
   * Calculate the coherent gain of a window function
   * 
   * The coherent gain is the sum of all window coefficients divided by the
   * number of samples. This is used to normalize the window's effect on
   * signal amplitude.
   * 
   * @param windowCoefficients Window coefficients
   * @returns Coherent gain as a fraction of the fixed-point scale
   * 
   * @example
   * const window = WindowFunctions.hanning(512);
   * const gain = WindowFunctions.coherentGain(window);
   * // Use gain to compensate for window's amplitude effect
   */
  public static coherentGain(windowCoefficients: Int32Array): number {
    let sum = 0;
    for (let i = 0; i < windowCoefficients.length; i++) {
      sum += windowCoefficients[i];
    }
    return sum / (windowCoefficients.length * WindowFunctions.FIXED_POINT_SCALE);
  }
  
  /**
   * Calculate the noise equivalent bandwidth of a window function
   * 
   * NEBW = N * sum(w[i]^2) / (sum(w[i]))^2
   * where w[i] are the window coefficients and N is the window length.
   * 
   * @param windowCoefficients Window coefficients
   * @returns Noise equivalent bandwidth
   * 
   * @example
   * const window = WindowFunctions.hanning(512);
   * const nebw = WindowFunctions.noiseEquivalentBandwidth(window);
   */
  public static noiseEquivalentBandwidth(windowCoefficients: Int32Array): number {
    let sumW = 0;
    let sumW2 = 0;
    
    for (let i = 0; i < windowCoefficients.length; i++) {
      const w = windowCoefficients[i];
      sumW += w;
      sumW2 += w * w;
    }
    
    const N = windowCoefficients.length;
    const scale = WindowFunctions.FIXED_POINT_SCALE;
    
    // Convert from fixed-point and calculate NEBW
    return (N * sumW2 / (scale * scale)) / ((sumW / scale) * (sumW / scale));
  }
}