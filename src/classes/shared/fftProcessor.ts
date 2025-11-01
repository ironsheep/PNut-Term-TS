/** @format */

'use strict';

// src/classes/shared/fftProcessor.ts

/**
 * FFT Processor implementing Cooley-Tukey algorithm with fixed-point arithmetic
 * 
 * This implementation exactly matches the Pascal reference implementation from
 * DebugDisplayUnit.pas, using 12-bit fixed-point arithmetic (scale 0x1000).
 * 
 * Key features:
 * - Cooley-Tukey decimation-in-time FFT algorithm
 * - 12-bit fixed-point arithmetic for precision matching Pascal
 * - Hanning window function applied to input samples
 * - Bit-reversal using Rev4 lookup table
 * - Power and angle output arrays
 * - Support for FFT sizes from 4 to 2048 (powers of 2)
 */

/**
 * FFT Result interface containing power and angle arrays
 */
export interface FFTResult {
  power: Int32Array;
  angle: Int32Array;
}

/**
 * FFT Processor class implementing Pascal's exact algorithm
 */
export class FFTProcessor {
  private static readonly FIXED_POINT_SCALE = 0x1000; // 12-bit fixed-point scale (4096)
  private static readonly MAX_FFT_SIZE = 2048;
  private static readonly MIN_FFT_SIZE = 4;
  
  // Rev4 lookup table for bit reversal (from Pascal)
  private static readonly REV4 = [0x0, 0x8, 0x4, 0xC, 0x2, 0xA, 0x6, 0xE, 0x1, 0x9, 0x5, 0xD, 0x3, 0xB, 0x7, 0xF];
  
  // Lookup tables (allocated for maximum size)
  private fftSin: Int32Array;
  private fftCos: Int32Array;
  private fftWin: Int32Array; // Hanning window coefficients
  
  // Working arrays for FFT computation
  private fftReal: BigInt64Array;
  private fftImag: BigInt64Array;
  
  // Current FFT parameters
  private fftExp: number = 0;
  private fftSize: number = 0;
  
  constructor() {
    // Initialize lookup tables for maximum FFT size
    this.fftSin = new Int32Array(FFTProcessor.MAX_FFT_SIZE);
    this.fftCos = new Int32Array(FFTProcessor.MAX_FFT_SIZE);
    this.fftWin = new Int32Array(FFTProcessor.MAX_FFT_SIZE);
    
    // Initialize working arrays
    this.fftReal = new BigInt64Array(FFTProcessor.MAX_FFT_SIZE);
    this.fftImag = new BigInt64Array(FFTProcessor.MAX_FFT_SIZE);
  }
  
  /**
   * Prepare FFT lookup tables for the specified size
   * Exactly matches Pascal's PrepareFFT procedure
   * 
   * @param size FFT size (must be power of 2, between 4 and 2048)
   */
  public prepareFFT(size: number): void {
    if (!this.isPowerOfTwo(size) || size < FFTProcessor.MIN_FFT_SIZE || size > FFTProcessor.MAX_FFT_SIZE) {
      throw new Error(`Invalid FFT size: ${size}. Must be power of 2 between ${FFTProcessor.MIN_FFT_SIZE} and ${FFTProcessor.MAX_FFT_SIZE}`);
    }
    
    this.fftSize = size;
    this.fftExp = Math.log2(size);
    
    // Generate lookup tables exactly as Pascal does
    for (let i = 0; i < size; i++) {
      // Calculate angle using bit-reversed index (matching Pascal)
      const tf = this.rev32(i) / 0x100000000 * Math.PI;
      
      // Calculate sine and cosine with fixed-point scaling
      const yf = Math.sin(tf);
      const xf = Math.cos(tf);
      this.fftSin[i] = Math.round(yf * FFTProcessor.FIXED_POINT_SCALE);
      this.fftCos[i] = Math.round(xf * FFTProcessor.FIXED_POINT_SCALE);
      
      // Calculate Hanning window coefficient (matching Pascal formula exactly)
      const hanningValue = 1 - Math.cos((i / size) * Math.PI * 2);
      this.fftWin[i] = Math.round(hanningValue * FFTProcessor.FIXED_POINT_SCALE);
    }
  }
  
  /**
   * Perform FFT on input samples
   * Exactly matches Pascal's PerformFFT procedure
   * 
   * @param samples Input sample array
   * @param magnitude Magnitude scaling factor (0-11, acts as right-shift)
   * @returns FFT result with power and angle arrays
   */
  public performFFT(samples: Int32Array, magnitude: number = 0): FFTResult {
    if (samples.length !== this.fftSize) {
      throw new Error(`Sample array length ${samples.length} does not match prepared FFT size ${this.fftSize}`);
    }
    
    if (magnitude < 0 || magnitude > 11) {
      throw new Error(`Magnitude must be between 0 and 11, got ${magnitude}`);
    }
    
    // Load samples into (real,imag) with Hanning window applied (matching Pascal)
    for (let i = 0; i < this.fftSize; i++) {
      // Apply Hanning window using fixed-point multiplication
      // The window values are in fixed-point format (scaled by FIXED_POINT_SCALE)
      // This scaling is handled during butterfly operations, not here
      this.fftReal[i] = BigInt(samples[i]) * BigInt(this.fftWin[i]);
      this.fftImag[i] = 0n;
    }
    
    // Perform FFT on (real,imag) - Cooley-Tukey algorithm (matching Pascal exactly)
    let i1 = 1 << (this.fftExp - 1);
    let i2 = 1;
    
    while (i1 !== 0) {
      let th = 0;
      let i3 = 0;
      let i4 = i1;
      let c1 = i2;
      
      while (c1 !== 0) {
        let ptra = i3;
        let ptrb = ptra + i1;
        let c2 = i4 - i3;
        
        while (c2 !== 0) {
          const ax = this.fftReal[ptra];
          const ay = this.fftImag[ptra];
          const bx = this.fftReal[ptrb];
          const by = this.fftImag[ptrb];
          
          // Complex multiplication with fixed-point arithmetic (matching Pascal)
          const rx = (bx * BigInt(this.fftCos[th]) - by * BigInt(this.fftSin[th])) / BigInt(FFTProcessor.FIXED_POINT_SCALE);
          const ry = (bx * BigInt(this.fftSin[th]) + by * BigInt(this.fftCos[th])) / BigInt(FFTProcessor.FIXED_POINT_SCALE);
          
          this.fftReal[ptra] = ax + rx;
          this.fftImag[ptra] = ay + ry;
          this.fftReal[ptrb] = ax - rx;
          this.fftImag[ptrb] = ay - ry;
          
          ptra++;
          ptrb++;
          c2--;
        }
        
        th++;
        i3 += i1 << 1;
        i4 += i1 << 1;
        c1--;
      }
      
      i1 >>= 1;
      i2 <<= 1;
    }
    
    // Convert (real,imag) to (power,angle)
    // CRITICAL: For Cooley-Tukey DIT FFT with natural-order input,
    // output is in BIT-REVERSED order. We must un-reverse it.
    const resultSize = this.fftSize >> 1;
    const power = new Int32Array(resultSize);
    const angle = new Int32Array(resultSize);

    for (let i = 0; i < resultSize; i++) {
      // Extract from bit-reversed indices (matching Pascal exactly)
      // For DIT FFT with natural-order input, output is in bit-reversed order
      const i2 = this.rev32(i) >>> (32 - this.fftExp);
      const rx = Number(this.fftReal[i2]);
      const ry = Number(this.fftImag[i2]);

      // Calculate power using Pascal's exact formula with banker's rounding
      // Pascal: FFTpower[i1] := Round(Hypot(rx, ry) / ($800 shl FFTexp shr FFTmag));
      // Pascal's Round uses banker's rounding (round half to even)
      const magnitude_shift = magnitude;
      const scale_factor = (0x800 << this.fftExp) >> magnitude_shift;
      power[i] = this.bankersRound(Math.hypot(rx, ry) / scale_factor);

      // Calculate angle (matching Pascal)
      angle[i] = Math.round(Math.atan2(rx, ry) / (Math.PI * 2) * 0x100000000) & 0xFFFFFFFF;
    }

    return { power, angle };
  }
  
  /**
   * Bit reversal function matching Pascal's Rev32
   * Uses Rev4 lookup table for 4-bit chunks
   *
   * @param i Input integer to reverse
   * @returns Bit-reversed value as unsigned 32-bit integer
   */
  private rev32(i: number): number {
    return ((
      (FFTProcessor.REV4[(i >> 0) & 0xF] << 28) |
      (FFTProcessor.REV4[(i >> 4) & 0xF] << 24) |
      (FFTProcessor.REV4[(i >> 8) & 0xF] << 20)
    ) & 0xFFF00000) >>> 0; // Force unsigned interpretation
  }
  
  /**
   * Check if a number is a power of two
   *
   * @param n Number to check
   * @returns True if n is a power of two
   */
  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  /**
   * Banker's rounding (round half to even) - matches Pascal's Round function
   *
   * When a value is exactly halfway between two integers, round to the nearest even number.
   * This reduces accumulation of rounding errors and matches Pascal's behavior.
   *
   * @param value The value to round
   * @returns The rounded integer
   */
  private bankersRound(value: number): number {
    const floor = Math.floor(value);
    const diff = value - floor;
    const EPSILON = 1e-9;

    // Handle exact halfway cases - round to even
    if (Math.abs(diff - 0.5) < EPSILON) {
      return floor % 2 === 0 ? floor : floor + 1;
    }

    if (Math.abs(diff + 0.5) < EPSILON) {
      return floor % 2 === 0 ? floor : floor - 1;
    }

    // Not a halfway case - use standard rounding
    return Math.round(value);
  }

  /**
   * Get the current prepared FFT size
   * 
   * @returns Current FFT size, or 0 if not prepared
   */
  public getFFTSize(): number {
    return this.fftSize;
  }
  
  /**
   * Get the current FFT exponent (log2 of size)
   * 
   * @returns Current FFT exponent
   */
  public getFFTExp(): number {
    return this.fftExp;
  }
  
  /**
   * Get a copy of the sine lookup table (for testing)
   * 
   * @returns Copy of sine lookup table for current FFT size
   */
  public getSinTable(): Int32Array {
    return this.fftSin.slice(0, this.fftSize);
  }
  
  /**
   * Get a copy of the cosine lookup table (for testing)
   * 
   * @returns Copy of cosine lookup table for current FFT size
   */
  public getCosTable(): Int32Array {
    return this.fftCos.slice(0, this.fftSize);
  }
  
  /**
   * Get a copy of the Hanning window table (for testing)
   * 
   * @returns Copy of Hanning window table for current FFT size
   */
  public getWindowTable(): Int32Array {
    return this.fftWin.slice(0, this.fftSize);
  }
}