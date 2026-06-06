/** @format */

'use strict';

// tests/debugFftCircularBuffer.test.ts

/**
 * Test suite for FFT window circular buffer implementation
 *
 * Verifies:
 * - Circular buffer wraparound behavior
 * - Multi-channel sample interleaving
 * - Rate control and FFT triggering
 * - Channel masking and summing
 * - Buffer overflow handling
 *
 * NOTE ON API DRIFT:
 * The old `extractSamplesForFFT(startPtr, length)` (combined-channel sum helper) was
 * removed when §11 refactored to per-channel FFTs. The current private API is
 * `extractChannelSamples(startPtr, length, channelIndex)`. Tests that previously called
 * the removed helper are rewritten to either:
 *   a) call `(window as any).extractChannelSamples(...)` for the per-channel path, or
 *   b) verify the equivalent combined behavior through the public data flow.
 *
 * NOTE ON channelMask DEFAULT:
 * Source initialises `channelMask = 0x01` (channel 0 only). Tests that assumed 0xFF
 * have been corrected. `setChannelMask()` is used where multi-channel tests require it.
 *
 * NOTE ON ASYNC:
 * `updateContent` is async. All test calls to it are awaited so buffer side-effects are
 * visible synchronously in the assertions that follow.
 *
 * NOTE ON WINDOW-NAME STRIPPING:
 * The router strips the window name before calling `updateContent`. Direct test calls
 * must therefore NOT include the window name as the first element.
 */

import { DebugFFTWindow } from '../src/classes/debugFftWin';
import { Context } from '../src/utils/context';

// Mock electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeMenu: jest.fn(),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue(undefined)
    },
    show: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    removeAllListeners: jest.fn()
  }))
}));

describe('FFT Circular Buffer Management', () => {
  let fftWindow: DebugFFTWindow;
  let mockContext: Context;

  beforeEach(() => {
    // Create mock context with logger
    mockContext = {
      logger: {
        logMessage: jest.fn(),
        forceLogMessage: jest.fn()
      }
    } as unknown as Context;
  });

  afterEach(() => {
    if (fftWindow) {
      fftWindow.close();
    }
  });

  describe('Buffer Initialization', () => {
    it('should initialize buffer with correct size and structure', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '512'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);

      // Access private properties via any cast for testing
      const window = fftWindow as any;

      expect(window.sampleBuffer).toBeDefined();
      expect(window.sampleBuffer.length).toBe(2048 * 8); // BUFFER_SIZE * MAX_CHANNELS
      expect(window.sampleWritePtr).toBe(0);
      expect(window.sampleReadPtr).toBe(0);
      // Source uses samplePop (not sampleCount)
      expect(window.samplePop).toBe(0);
      // Source default: channelMask = 0x01 (channel 0 only enabled by default)
      expect(window.channelMask).toBe(0x01);
    });

    it('should clear buffer correctly', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '256'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Add some samples (channel 0 only, which is the default enabled channel)
      window.addSample(100, 0);

      // Clear buffer
      window.clearBuffer();

      expect(window.sampleWritePtr).toBe(0);
      expect(window.sampleReadPtr).toBe(0);
      // samplePop is the field used in source (Pascal: SamplePop)
      expect(window.samplePop).toBe(0);
      expect(window.sampleBuffer[0]).toBe(0);
      expect(window.sampleBuffer[1]).toBe(0);
    });
  });

  describe('Sample Addition and Wraparound', () => {
    it('should add samples to correct channel positions', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128', 'RATE', '4'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Enable channels 0, 1, 2 so all three samples land in the same sample-set row
      window.setChannelMask(0x07);

      // Add samples to different channels
      // Write pointer advances only when the last enabled channel (ch2) is written
      window.addSample(100, 0);
      window.addSample(200, 1);
      window.addSample(300, 2); // last enabled channel → row advances

      // Buffer layout: interleaved channels [ch0, ch1, ch2, ..., ch7] per sample position
      expect(window.sampleBuffer[0]).toBe(100); // Channel 0, sample 0
      expect(window.sampleBuffer[1]).toBe(200); // Channel 1, sample 0
      expect(window.sampleBuffer[2]).toBe(300); // Channel 2, sample 0
    });

    it('should handle circular wraparound correctly', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64', 'RATE', '3000' // High rate to avoid FFT trigger
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Enable all 8 channels for testing
      window.channelMask = 0xFF; // Enable channels 0-7

      // Fill buffer to near capacity (2047 complete sample sets)
      for (let i = 0; i < 2047; i++) {
        for (let ch = 0; ch < 8; ch++) {
          window.addSample(i * 10 + ch, ch);
        }
      }

      // Pointer should be at 2047
      expect(window.sampleWritePtr).toBe(2047);

      // Add one more complete set to trigger wraparound
      for (let ch = 0; ch < 8; ch++) {
        window.addSample(20470 + ch, ch);
      }

      // After adding the 2048th set, pointer should wrap to 0
      expect(window.sampleWritePtr).toBe(0);
    });
  });

  describe('Channel Masking', () => {
    it('should respect channel mask when adding samples', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Enable only channels 0 and 2 (mask = 0x05)
      // Last enabled channel is 2 → write ptr advances when ch2 is written
      window.setChannelMask(0x05);

      // Try to add samples to all channels
      window.addSample(100, 0); // Should be stored (enabled)
      window.addSample(200, 1); // Should be ignored (disabled)
      window.addSample(300, 2); // Should be stored (enabled, last → row advances)
      window.addSample(400, 3); // Should be ignored (disabled)

      expect(window.sampleBuffer[0]).toBe(100); // Channel 0 stored
      expect(window.sampleBuffer[1]).toBe(0);   // Channel 1 ignored (buffer zeroed)
      expect(window.sampleBuffer[2]).toBe(300); // Channel 2 stored
      expect(window.sampleBuffer[3]).toBe(0);   // Channel 3 ignored
    });

    it('should count enabled channels correctly', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Default: channelMask = 0x01 → only channel 0 enabled
      expect(window.getEnabledChannelCount()).toBe(1);

      window.setChannelMask(0x0F); // Enable first 4 channels
      expect(window.getEnabledChannelCount()).toBe(4);

      window.setChannelMask(0x01); // Enable only channel 0
      expect(window.getEnabledChannelCount()).toBe(1);

      window.setChannelMask(0x00); // Disable all channels
      expect(window.getEnabledChannelCount()).toBe(0);

      window.setChannelMask(0xFF); // Enable all 8
      expect(window.getEnabledChannelCount()).toBe(8);
    });
  });

  describe('FFT Triggering', () => {
    it('should trigger FFT after buffer fills and rate counter reaches threshold', () => {
      // RATE=4, SAMPLES=64: buffer must accumulate 64 samples before FFT can fire;
      // then every 4 samples (rateCounter cycles) triggerFFT is called.
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64', 'RATE', '4'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Mock the triggerFFT method so we can observe calls
      window.triggerFFT = jest.fn();

      // Enable only channel 0 for simplicity (it's the last enabled channel too)
      window.setChannelMask(0x01);

      // Fill the buffer up to vSamples (64) − no trigger expected yet
      // Constructor sets rateCounter = rate - 1 = 3; first 3 samples after fill won't trigger
      for (let i = 0; i < 63; i++) {
        window.addSample(100 + i, 0);
      }
      expect(window.triggerFFT).not.toHaveBeenCalled();

      // 64th sample: samplePop reaches samples (64) for the first time.
      // rateCycle increments rateCounter from 3 → 4, hits rate (4) → triggers.
      window.addSample(163, 0);
      expect(window.triggerFFT).toHaveBeenCalledTimes(1);

      // After trigger rateCounter resets to 0. Next 3 samples → no trigger.
      for (let i = 0; i < 3; i++) {
        window.addSample(200 + i, 0);
      }
      expect(window.triggerFFT).toHaveBeenCalledTimes(1);

      // 4th sample after reset → second trigger
      window.addSample(203, 0);
      expect(window.triggerFFT).toHaveBeenCalledTimes(2);
    });

    it('should extract per-channel samples via extractChannelSamples', () => {
      // extractSamplesForFFT was removed; the current private API is extractChannelSamples.
      // This test validates that per-channel extraction returns correct values.
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '8'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Enable channels 0 and 1
      window.setChannelMask(0x03);

      // Directly populate the buffer (bypassing addSample logic)
      // Layout: buffer[pos * MAX_CHANNELS + channelIndex]
      const MAX_CHANNELS = 8;
      for (let i = 0; i < 10; i++) {
        window.sampleBuffer[i * MAX_CHANNELS + 0] = 100 + i; // ch0: 100..109
        window.sampleBuffer[i * MAX_CHANNELS + 1] = 200 + i; // ch1: 200..209
      }

      // Extract 8 samples for channel 0, starting at position 2
      const ch0Samples = window.extractChannelSamples(2, 8, 0);
      expect(ch0Samples.length).toBe(8);
      for (let i = 0; i < 8; i++) {
        expect(ch0Samples[i]).toBe(102 + i); // ch0: starts at position 2 → 102..109
      }

      // Extract 8 samples for channel 1, starting at position 2
      const ch1Samples = window.extractChannelSamples(2, 8, 1);
      expect(ch1Samples.length).toBe(8);
      for (let i = 0; i < 8; i++) {
        expect(ch1Samples[i]).toBe(202 + i); // ch1: starts at position 2 → 202..209
      }
    });
  });

  describe('Data Feeding', () => {
    it('should parse and add numeric samples', async () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Channel 0 is the default enabled channel (channelMask = 0x01)
      // Router strips window name before calling updateContent, so no 'TestFFT' prefix
      await fftWindow.updateContent(['100', '200', '300']);

      // Buffer layout: [ch0_s0, ch1_s0, ..., ch7_s0, ch0_s1, ch1_s1, ...]
      // With only ch0 enabled, each sample advances the write ptr by 1 row (8 slots)
      expect(window.sampleBuffer[0]).toBe(100);  // ch0, row 0
      expect(window.sampleBuffer[8]).toBe(200);  // ch0, row 1
      expect(window.sampleBuffer[16]).toBe(300); // ch0, row 2
    });

    it('should parse backtick-enclosed data', async () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Channel 0 default; no window name prefix
      await fftWindow.updateContent(['`(500)`', '`(600)`']);

      expect(window.sampleBuffer[0]).toBe(500); // ch0, row 0
      expect(window.sampleBuffer[8]).toBe(600); // ch0, row 1
    });

    it('should handle CLEAR command', async () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Add a sample (ch0)
      window.addSample(100, 0);
      expect(window.sampleWritePtr).toBe(1); // advanced after ch0

      // Send CLEAR command (window name already stripped by router)
      await fftWindow.updateContent(['CLEAR']);

      expect(window.sampleWritePtr).toBe(0);
      expect(window.samplePop).toBe(0);
      expect(window.sampleBuffer[0]).toBe(0);
    });

    it('should parse channel configuration', async () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Add channel configuration (no window name prefix – router strips it)
      await fftWindow.updateContent([
        "'Channel1'",
        '2',    // magnitude
        '1000', // high
        '100',  // tall
        '10',   // base
        '20',   // grid
        'RED'   // color
      ]);

      expect(window.channels.length).toBe(1);
      expect(window.channels[0].label).toBe('Channel1');
      expect(window.channels[0].magnitude).toBe(2);
      expect(window.channels[0].high).toBe(1000);
      expect(window.channels[0].color).toMatch(/^#[0-9A-F]{6}$/i); // Should be hex color
    });
  });

  describe('Round-Robin Channel Feeding', () => {
    it('should cycle through enabled channels', async () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64'
      ]);

      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;

      // Enable channels 0, 2, and 4 (mask = 0x15); last enabled = ch4
      window.setChannelMask(0x15);
      window.currentChannel = 0; // start from ch0

      // Feed 6 samples – should round-robin through ch0 → ch2 → ch4 → ch0 → ch2 → ch4
      // updateContent routes each numeric token to currentChannel then advances
      await fftWindow.updateContent(['100', '200', '300', '400', '500', '600']);

      // Buffer layout: [ch0, ch1, ch2, ch3, ch4, ...ch7] per row (8 slots per row)
      // Row 0 receives the first set (ch0=100, ch2=200, ch4=300); write ptr then advances.
      // Row 1 receives the second set (ch0=400, ch2=500, ch4=600).
      expect(window.sampleBuffer[0]).toBe(100);  // ch0, row 0
      expect(window.sampleBuffer[2]).toBe(200);  // ch2, row 0
      expect(window.sampleBuffer[4]).toBe(300);  // ch4, row 0
      expect(window.sampleBuffer[8]).toBe(400);  // ch0, row 1
      expect(window.sampleBuffer[10]).toBe(500); // ch2, row 1
      expect(window.sampleBuffer[12]).toBe(600); // ch4, row 1
    });
  });
});
