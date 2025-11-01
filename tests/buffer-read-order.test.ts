/** @format */

'use strict';

/**
 * Test to verify circular buffer reading order in debugSpectroWin
 *
 * Theory 3: Check if samples are being read from the circular buffer in the wrong order
 *
 * Expected behavior:
 * - Circular buffer stores samples with write pointer
 * - FFT should read samples from oldest to newest
 * - Formula: (sampleWritePtr - fftSize + x) & BUFFER_MASK
 * - This should retrieve oldest sample at x=0, newest at x=fftSize-1
 */

describe('Circular Buffer Reading Order', () => {
  // Simulate the circular buffer logic from debugSpectroWin.ts
  const BUFFER_SIZE = 2048;
  const BUFFER_MASK = BUFFER_SIZE - 1;

  test('Buffer reading formula should retrieve oldest-to-newest samples', () => {
    // Create a buffer with incrementing samples [0, 1, 2, 3, ...]
    const sampleBuffer = new Int32Array(BUFFER_SIZE);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      sampleBuffer[i] = i;
    }

    // Simulate writing samples sequentially and wrapping around
    // After writing BUFFER_SIZE samples, writePtr should be at 0
    let sampleWritePtr = 0;

    // Fill the buffer completely (this advances writePtr back to 0)
    for (let i = 0; i < BUFFER_SIZE; i++) {
      sampleBuffer[sampleWritePtr] = i;
      sampleWritePtr = (sampleWritePtr + 1) & BUFFER_MASK;
    }

    // sampleWritePtr is now 0 (wrapped around)
    expect(sampleWritePtr).toBe(0);

    // Now read samples using the FFT formula for fftSize = 8
    const fftSize = 8;
    const fftInput: number[] = [];

    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (sampleWritePtr - fftSize + x) & BUFFER_MASK;
      fftInput[x] = sampleBuffer[bufferIndex];
    }

    // Expected: Should read the LAST 8 samples written [2040, 2041, 2042, 2043, 2044, 2045, 2046, 2047]
    // These are the "oldest" samples in the buffer from the FFT's perspective
    const expected = [2040, 2041, 2042, 2043, 2044, 2045, 2046, 2047];
    expect(fftInput).toEqual(expected);
  });

  test('Buffer reading with writePtr at arbitrary position', () => {
    // Create a buffer with known values
    const sampleBuffer = new Int32Array(BUFFER_SIZE);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      sampleBuffer[i] = i * 100; // [0, 100, 200, 300, ...]
    }

    // Simulate writePtr at position 100 (just wrote sample at index 99)
    let sampleWritePtr = 100;

    // Read 4 samples using FFT formula
    const fftSize = 4;
    const fftInput: number[] = [];

    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (sampleWritePtr - fftSize + x) & BUFFER_MASK;
      fftInput[x] = sampleBuffer[bufferIndex];
    }

    // Expected: Should read samples at indices [96, 97, 98, 99]
    // These are the 4 most recent samples before writePtr
    const expected = [9600, 9700, 9800, 9900];
    expect(fftInput).toEqual(expected);
  });

  test('Buffer reading with wraparound scenario', () => {
    // Test the case where reading wraps around the buffer boundary
    const sampleBuffer = new Int32Array(BUFFER_SIZE);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      sampleBuffer[i] = i;
    }

    // WritePtr at position 2 (just wrote samples 0, 1)
    let sampleWritePtr = 2;

    // Read 4 samples using FFT formula
    const fftSize = 4;
    const fftInput: number[] = [];

    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (sampleWritePtr - fftSize + x) & BUFFER_MASK;
      fftInput[x] = sampleBuffer[bufferIndex];
    }

    // Expected: Should read samples at indices [2046, 2047, 0, 1]
    // This wraps around from end of buffer to beginning
    const expected = [2046, 2047, 0, 1];
    expect(fftInput).toEqual(expected);
  });

  test('Time-domain order verification with incremental signal', () => {
    // Create a buffer simulating a time-domain signal that increments over time
    const sampleBuffer = new Int32Array(BUFFER_SIZE);

    // Simulate filling buffer over time: newest samples have higher values
    // Sample at time T has value T
    let timeCounter = 0;
    let sampleWritePtr = 0;

    // Write 2048 samples (fill buffer once)
    for (let t = 0; t < BUFFER_SIZE; t++) {
      sampleBuffer[sampleWritePtr] = timeCounter;
      sampleWritePtr = (sampleWritePtr + 1) & BUFFER_MASK;
      timeCounter++;
    }

    // Now writePtr is at 0 again
    // The oldest sample in the buffer should be at position 0 (value 0)
    // The newest sample should be at position 2047 (value 2047)

    // Read 16 samples for FFT
    const fftSize = 16;
    const fftInput: number[] = [];

    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (sampleWritePtr - fftSize + x) & BUFFER_MASK;
      fftInput[x] = sampleBuffer[bufferIndex];
    }

    // Expected: Should read [2032, 2033, ..., 2047]
    // These should be in chronological order (oldest to newest)
    const expected: number[] = [];
    for (let i = 0; i < fftSize; i++) {
      expected.push(BUFFER_SIZE - fftSize + i);
    }

    expect(fftInput).toEqual(expected);

    // Verify chronological ordering
    for (let i = 1; i < fftInput.length; i++) {
      expect(fftInput[i]).toBe(fftInput[i-1] + 1);
    }
  });

  test('Verify BUFFER_MASK calculation is correct', () => {
    // BUFFER_MASK should be BUFFER_SIZE - 1 for power-of-2 sizes
    expect(BUFFER_MASK).toBe(2047);
    expect(BUFFER_MASK).toBe(0b11111111111); // 11 bits set

    // Verify it works as a wrap-around mask
    expect((BUFFER_SIZE) & BUFFER_MASK).toBe(0); // Wraps to 0
    expect((BUFFER_SIZE + 1) & BUFFER_MASK).toBe(1); // Wraps to 1
    expect((BUFFER_SIZE - 1) & BUFFER_MASK).toBe(2047); // Stays at 2047
  });

  test('Compare with alternative reading orders', () => {
    // Test what happens if we read in REVERSE order
    const sampleBuffer = new Int32Array(16);
    for (let i = 0; i < 16; i++) {
      sampleBuffer[i] = i * 10;
    }

    const fftSize = 4;
    let sampleWritePtr = 4; // Just wrote samples 0, 1, 2, 3

    // Current formula (oldest to newest)
    const currentOrder: number[] = [];
    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (sampleWritePtr - fftSize + x) & 0xF;
      currentOrder[x] = sampleBuffer[bufferIndex];
    }

    // Alternative: newest to oldest (WRONG)
    const reversedOrder: number[] = [];
    for (let x = 0; x < fftSize; x++) {
      const bufferIndex = (sampleWritePtr - 1 - x) & 0xF;
      reversedOrder[x] = sampleBuffer[bufferIndex];
    }

    // Current order should be [0, 10, 20, 30] (indices 0, 1, 2, 3)
    expect(currentOrder).toEqual([0, 10, 20, 30]);

    // Reversed order would be [30, 20, 10, 0] (indices 3, 2, 1, 0)
    expect(reversedOrder).toEqual([30, 20, 10, 0]);

    // They should NOT be equal
    expect(currentOrder).not.toEqual(reversedOrder);
  });
});
