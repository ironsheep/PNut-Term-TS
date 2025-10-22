/** @format */

/**
 * Test FFT sample buffer extraction logic
 * Verifies that circular buffer extraction matches Pascal implementation
 */

describe('FFT Buffer Extraction', () => {
  // Simulate the buffer extraction logic from debugFftWin.ts
  function extractSamples(
    buffer: Int32Array,
    writePtr: number,
    bufferSize: number,
    sampleCount: number,
    channelCount: number,
    channelIndex: number
  ): Int32Array {
    const samples = new Int32Array(sampleCount);
    const startPtr = (writePtr - sampleCount) & (bufferSize - 1);

    for (let i = 0; i < sampleCount; i++) {
      const bufferPos = ((startPtr + i) & (bufferSize - 1)) * channelCount + channelIndex;
      samples[i] = buffer[bufferPos];
    }

    return samples;
  }

  test('should extract correct samples from circular buffer without wraparound', () => {
    const BUFFER_SIZE = 16; // Small for testing
    const CHANNELS = 2;
    const SAMPLES = 4;

    // Create buffer with known pattern
    // Channel 0: 100, 101, 102, 103, 104, 105, 106, 107...
    // Channel 1: 200, 201, 202, 203, 204, 205, 206, 207...
    const buffer = new Int32Array(BUFFER_SIZE * CHANNELS);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      buffer[i * CHANNELS + 0] = 100 + i; // Channel 0
      buffer[i * CHANNELS + 1] = 200 + i; // Channel 1
    }

    // Write pointer at position 8 (we've written 8 samples)
    const writePtr = 8;

    // Extract last 4 samples for channel 0
    const ch0 = extractSamples(buffer, writePtr, BUFFER_SIZE, SAMPLES, CHANNELS, 0);

    // Should get samples from positions 4, 5, 6, 7
    expect(Array.from(ch0)).toEqual([104, 105, 106, 107]);

    // Extract last 4 samples for channel 1
    const ch1 = extractSamples(buffer, writePtr, BUFFER_SIZE, SAMPLES, CHANNELS, 1);
    expect(Array.from(ch1)).toEqual([204, 205, 206, 207]);

    console.log('✓ No wraparound: extracted correct samples');
  });

  test('should extract correct samples from circular buffer WITH wraparound', () => {
    const BUFFER_SIZE = 16;
    const CHANNELS = 2;
    const SAMPLES = 4;

    // Create buffer
    const buffer = new Int32Array(BUFFER_SIZE * CHANNELS);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      buffer[i * CHANNELS + 0] = 100 + i;
      buffer[i * CHANNELS + 1] = 200 + i;
    }

    // Write pointer at position 2 (wrapped around)
    // Last 4 samples are at positions: 14, 15, 0, 1
    const writePtr = 2;

    const ch0 = extractSamples(buffer, writePtr, BUFFER_SIZE, SAMPLES, CHANNELS, 0);

    // Should get: buffer[14*2+0], buffer[15*2+0], buffer[0*2+0], buffer[1*2+0]
    //           = 114, 115, 100, 101
    expect(Array.from(ch0)).toEqual([114, 115, 100, 101]);

    const ch1 = extractSamples(buffer, writePtr, BUFFER_SIZE, SAMPLES, CHANNELS, 1);
    expect(Array.from(ch1)).toEqual([214, 215, 200, 201]);

    console.log('✓ With wraparound: extracted correct samples');
  });

  test('should handle FFT-sized extraction (2048 samples)', () => {
    const BUFFER_SIZE = 4096; // Large enough for 2048 samples
    const CHANNELS = 1;
    const SAMPLES = 2048;

    // Fill buffer with incrementing values
    const buffer = new Int32Array(BUFFER_SIZE * CHANNELS);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      buffer[i] = i;
    }

    const writePtr = 3000;
    const samples = extractSamples(buffer, writePtr, BUFFER_SIZE, SAMPLES, CHANNELS, 0);

    // Should extract from position (3000-2048) = 952 to 2999
    expect(samples[0]).toBe(952);
    expect(samples[1]).toBe(953);
    expect(samples[2047]).toBe(2999);
    expect(samples.length).toBe(2048);

    console.log('✓ FFT-sized extraction: correct');
  });

  test('should extract MOST RECENT samples (Pascal behavior)', () => {
    const BUFFER_SIZE = 16;
    const CHANNELS = 1;
    const SAMPLES = 4;

    // Simulate adding samples one by one
    const buffer = new Int32Array(BUFFER_SIZE * CHANNELS);
    let writePtr = 0;

    // Add samples: 10, 20, 30, 40, 50, 60, 70, 80
    for (let value of [10, 20, 30, 40, 50, 60, 70, 80]) {
      buffer[writePtr * CHANNELS] = value;
      writePtr = (writePtr + 1) & (BUFFER_SIZE - 1);
    }

    // writePtr is now at 8
    // Extract last 4 samples - should get 50, 60, 70, 80
    const samples = extractSamples(buffer, writePtr, BUFFER_SIZE, SAMPLES, CHANNELS, 0);

    expect(Array.from(samples)).toEqual([50, 60, 70, 80]);

    console.log('✓ Extracts most recent samples: correct');
  });

  test('should match Pascal formula exactly', () => {
    // Pascal: FFTsamp[x] := Y_SampleBuff[((SamplePtr - vSamples + x) and Y_PtrMask) * Y_SetSize + j]

    const Y_PtrMask = 15; // BUFFER_SIZE - 1 (for size 16)
    const Y_SetSize = 2; // 2 channels
    const vSamples = 4;
    const SamplePtr = 10; // Write pointer
    const j = 0; // Channel index

    // Create buffer
    const buffer = new Int32Array(16 * 2);
    for (let i = 0; i < 16; i++) {
      buffer[i * 2 + 0] = 1000 + i;
      buffer[i * 2 + 1] = 2000 + i;
    }

    // Pascal calculation
    const pascalSamples: number[] = [];
    for (let x = 0; x < vSamples; x++) {
      const index = ((SamplePtr - vSamples + x) & Y_PtrMask) * Y_SetSize + j;
      pascalSamples.push(buffer[index]);
    }

    // TypeScript calculation
    const tsSamples = extractSamples(buffer, SamplePtr, 16, vSamples, Y_SetSize, j);

    console.log('Pascal samples:', pascalSamples);
    console.log('TypeScript samples:', Array.from(tsSamples));

    expect(Array.from(tsSamples)).toEqual(pascalSamples);

    console.log('✓ Matches Pascal formula exactly');
  });
});
