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
        logMessage: jest.fn()
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
      expect(window.sampleCount).toBe(0);
      expect(window.channelMask).toBe(0xFF); // All channels enabled by default
    });

    it('should clear buffer correctly', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '256'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Add some samples
      window.addSample(100, 0);
      window.addSample(200, 1);
      
      // Clear buffer
      window.clearBuffer();
      
      expect(window.sampleWritePtr).toBe(0);
      expect(window.sampleReadPtr).toBe(0);
      expect(window.sampleCount).toBe(0);
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
      
      // Add samples to different channels
      window.addSample(100, 0);
      window.addSample(200, 1);
      window.addSample(300, 2);
      
      // Check buffer contents (interleaved channels)
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
      window.setChannelMask(0x05);
      
      // Try to add samples to all channels
      window.addSample(100, 0); // Should be added
      window.addSample(200, 1); // Should be ignored
      window.addSample(300, 2); // Should be added
      window.addSample(400, 3); // Should be ignored
      
      expect(window.sampleBuffer[0]).toBe(100); // Channel 0 added
      expect(window.sampleBuffer[1]).toBe(0);   // Channel 1 ignored
      expect(window.sampleBuffer[2]).toBe(300); // Channel 2 added
      expect(window.sampleBuffer[3]).toBe(0);   // Channel 3 ignored
    });

    it('should count enabled channels correctly', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      expect(window.getEnabledChannelCount()).toBe(8); // All enabled by default
      
      window.setChannelMask(0x0F); // Enable first 4 channels
      expect(window.getEnabledChannelCount()).toBe(4);
      
      window.setChannelMask(0x01); // Enable only channel 0
      expect(window.getEnabledChannelCount()).toBe(1);
      
      window.setChannelMask(0x00); // Disable all channels
      expect(window.getEnabledChannelCount()).toBe(0);
    });
  });

  describe('FFT Triggering', () => {
    it('should trigger FFT when rate counter reaches threshold', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64', 'RATE', '4'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Mock the triggerFFT method
      window.triggerFFT = jest.fn();
      
      // Enable only channel 0 for simplicity
      window.setChannelMask(0x01);
      
      // Add 3 samples - should not trigger
      for (let i = 0; i < 3; i++) {
        window.addSample(100 + i, 0);
      }
      
      expect(window.triggerFFT).not.toHaveBeenCalled();
      expect(window.sampleCount).toBe(3);
      
      // Add 4th sample - should trigger
      window.addSample(103, 0);
      
      expect(window.triggerFFT).toHaveBeenCalledTimes(1);
      expect(window.sampleCount).toBe(0); // Should reset after trigger
    });

    it('should extract correct samples for FFT processing', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '8'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Enable channels 0 and 1
      window.setChannelMask(0x03);
      
      // Add 10 samples to each channel
      for (let i = 0; i < 10; i++) {
        window.addSample(100 + i, 0);
        window.addSample(200 + i, 1);
      }
      
      // Extract 8 samples starting from position 2
      const samples = window.extractSamplesForFFT(2, 8);
      
      expect(samples.length).toBe(8);
      
      // Each sample should be sum of channels 0 and 1
      for (let i = 0; i < 8; i++) {
        const expectedSum = (102 + i) + (202 + i); // Ch0 + Ch1
        expect(samples[i]).toBe(expectedSum);
      }
    });
  });

  describe('Data Feeding', () => {
    it('should parse and add numeric samples', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Enable only channel 0
      window.setChannelMask(0x01);
      
      // Feed numeric data
      fftWindow.updateContent(['TestFFT', '100', '200', '300']);
      
      expect(window.sampleBuffer[0]).toBe(100);
      expect(window.sampleBuffer[8]).toBe(200); // Next sample position
      expect(window.sampleBuffer[16]).toBe(300);
    });

    it('should parse backtick-enclosed data', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Enable only channel 0
      window.setChannelMask(0x01);
      
      // Feed backtick data
      fftWindow.updateContent(['TestFFT', '`(500)`', '`(600)`']);
      
      expect(window.sampleBuffer[0]).toBe(500);
      expect(window.sampleBuffer[8]).toBe(600);
    });

    it('should handle CLEAR command', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '128'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Add some samples
      window.addSample(100, 0);
      window.addSample(200, 1);
      
      // Send CLEAR command
      fftWindow.updateContent(['TestFFT', 'CLEAR']);
      
      expect(window.sampleWritePtr).toBe(0);
      expect(window.sampleCount).toBe(0);
      expect(window.sampleBuffer[0]).toBe(0);
      expect(window.sampleBuffer[1]).toBe(0);
    });

    it('should parse channel configuration', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Add channel configuration
      fftWindow.updateContent([
        'TestFFT',
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
    it('should cycle through enabled channels', () => {
      const displaySpec = DebugFFTWindow.createDisplaySpec('TestFFT', [
        'FFT', 'TestFFT', 'SAMPLES', '64'
      ]);
      
      fftWindow = new DebugFFTWindow(mockContext, displaySpec);
      const window = fftWindow as any;
      
      // Enable channels 0, 2, and 4 (mask = 0x15)
      window.setChannelMask(0x15);
      
      // Feed 6 samples - should cycle through enabled channels
      fftWindow.updateContent(['TestFFT', '100', '200', '300', '400', '500', '600']);
      
      // Check distribution across enabled channels
      expect(window.sampleBuffer[0]).toBe(100);  // Ch0, sample 0
      expect(window.sampleBuffer[2]).toBe(200);  // Ch2, sample 0
      expect(window.sampleBuffer[4]).toBe(300);  // Ch4, sample 0
      expect(window.sampleBuffer[8]).toBe(400);  // Ch0, sample 1
      expect(window.sampleBuffer[10]).toBe(500); // Ch2, sample 1
      expect(window.sampleBuffer[12]).toBe(600); // Ch4, sample 1
    });
  });
});