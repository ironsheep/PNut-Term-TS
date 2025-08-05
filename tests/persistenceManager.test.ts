import { PersistenceManager } from '../src/classes/shared/persistenceManager';

describe('PersistenceManager', () => {
  let manager: PersistenceManager;

  beforeEach(() => {
    manager = new PersistenceManager();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default persistence of 256', () => {
      expect(manager.getPersistence()).toBe(256);
    });

    it('should start with empty buffer', () => {
      expect(manager.getSampleCount()).toBe(0);
    });

    it('should have buffer size of 2048', () => {
      expect(manager.getBufferSize()).toBe(2048);
    });
  });

  describe('setPersistence', () => {
    it('should set persistence within valid range', () => {
      manager.setPersistence(100);
      expect(manager.getPersistence()).toBe(100);
    });

    it('should clamp persistence to maximum 512', () => {
      manager.setPersistence(1000);
      expect(manager.getPersistence()).toBe(512);
    });

    it('should allow persistence of 0 for infinite', () => {
      manager.setPersistence(0);
      expect(manager.getPersistence()).toBe(0);
      expect(manager.isInfinitePersistence()).toBe(true);
    });

    it('should not allow negative persistence', () => {
      manager.setPersistence(-10);
      expect(manager.getPersistence()).toBe(0);
    });

    it('should adjust population when reducing persistence', () => {
      manager.setPersistence(10);
      // Add 15 samples
      for (let i = 0; i < 15; i++) {
        manager.addSample([i, i]);
      }
      expect(manager.getSampleCount()).toBe(10);
      
      // Reduce persistence
      manager.setPersistence(5);
      expect(manager.getSampleCount()).toBe(5);
    });
  });

  describe('addSample', () => {
    it('should add samples to buffer', () => {
      manager.addSample([10, 20]);
      expect(manager.getSampleCount()).toBe(1);
    });

    it('should handle multiple samples', () => {
      manager.addSample([10, 20]);
      manager.addSample([30, 40]);
      manager.addSample([50, 60]);
      expect(manager.getSampleCount()).toBe(3);
    });

    it('should respect persistence limit', () => {
      manager.setPersistence(5);
      for (let i = 0; i < 10; i++) {
        manager.addSample([i, i]);
      }
      expect(manager.getSampleCount()).toBe(5);
    });

    it('should handle infinite persistence up to buffer size', () => {
      manager.setPersistence(0);
      for (let i = 0; i < 100; i++) {
        manager.addSample([i, i]);
      }
      expect(manager.getSampleCount()).toBe(100);
    });

    it('should wrap around at buffer size with infinite persistence', () => {
      manager.setPersistence(0);
      const bufferSize = manager.getBufferSize();
      
      // Fill buffer completely
      for (let i = 0; i < bufferSize + 10; i++) {
        manager.addSample([i, i]);
      }
      
      expect(manager.getSampleCount()).toBe(bufferSize);
    });

    it('should handle multi-channel data', () => {
      const channelData = [10, 20, 30, 40, 50, 60]; // 3 channels
      manager.addSample(channelData);
      
      const samples = manager.getSamplesWithOpacity();
      expect(samples[0].data).toEqual(channelData);
    });
  });

  describe('getSamplesWithOpacity', () => {
    it('should return samples with opacity gradient', () => {
      manager.setPersistence(10);
      
      for (let i = 0; i < 5; i++) {
        manager.addSample([i, i]);
      }
      
      const samples = manager.getSamplesWithOpacity();
      expect(samples.length).toBe(5);
      
      // Newest sample should have highest opacity
      expect(samples[0].opacity).toBe(255);
      
      // Older samples should have decreasing opacity
      expect(samples[1].opacity).toBeLessThan(samples[0].opacity);
      expect(samples[2].opacity).toBeLessThan(samples[1].opacity);
    });

    it('should calculate correct opacity values', () => {
      manager.setPersistence(4);
      
      for (let i = 0; i < 4; i++) {
        manager.addSample([i, i]);
      }
      
      const samples = manager.getSamplesWithOpacity();
      
      // Pascal formula: opa := 255 - (k * 255 div vSamples)
      expect(samples[0].opacity).toBe(255); // 255 - floor(0 * 255 / 4) = 255
      expect(samples[1].opacity).toBe(192); // 255 - floor(1 * 255 / 4) = 255 - 63 = 192
      expect(samples[2].opacity).toBe(128); // 255 - floor(2 * 255 / 4) = 255 - 127 = 128
      expect(samples[3].opacity).toBe(64);  // 255 - floor(3 * 255 / 4) = 255 - 191 = 64
    });

    it('should return full opacity for infinite persistence', () => {
      manager.setPersistence(0);
      
      for (let i = 0; i < 10; i++) {
        manager.addSample([i, i]);
      }
      
      const samples = manager.getSamplesWithOpacity();
      
      // All samples should have full opacity
      samples.forEach(sample => {
        expect(sample.opacity).toBe(255);
      });
    });

    it('should return samples in reverse chronological order', () => {
      manager.setPersistence(5);
      
      for (let i = 0; i < 5; i++) {
        manager.addSample([i, i]);
      }
      
      const samples = manager.getSamplesWithOpacity();
      
      // Newest sample first
      expect(samples[0].data).toEqual([4, 4]);
      expect(samples[1].data).toEqual([3, 3]);
      expect(samples[2].data).toEqual([2, 2]);
      expect(samples[3].data).toEqual([1, 1]);
      expect(samples[4].data).toEqual([0, 0]);
    });

    it('should handle empty buffer', () => {
      const samples = manager.getSamplesWithOpacity();
      expect(samples).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all samples', () => {
      manager.addSample([10, 20]);
      manager.addSample([30, 40]);
      
      manager.clear();
      
      expect(manager.getSampleCount()).toBe(0);
      expect(manager.getSamplesWithOpacity()).toEqual([]);
    });

    it('should reset pointers', () => {
      manager.addSample([10, 20]);
      manager.clear();
      manager.addSample([30, 40]);
      
      const samples = manager.getSamplesWithOpacity();
      expect(samples.length).toBe(1);
      expect(samples[0].data).toEqual([30, 40]);
    });
  });

  describe('Circular Buffer Behavior', () => {
    it('should wrap pointer using power-of-2 mask', () => {
      manager.setPersistence(3);
      
      // Add many samples to ensure wraparound
      for (let i = 0; i < 100; i++) {
        manager.addSample([i, i]);
      }
      
      const samples = manager.getSamplesWithOpacity();
      expect(samples.length).toBe(3);
      
      // Should have the 3 most recent samples
      expect(samples[0].data).toEqual([99, 99]);
      expect(samples[1].data).toEqual([98, 98]);
      expect(samples[2].data).toEqual([97, 97]);
    });

    it('should handle buffer boundary correctly', () => {
      const bufferSize = manager.getBufferSize();
      manager.setPersistence(0); // Infinite
      
      // Fill buffer to boundary
      for (let i = 0; i < bufferSize; i++) {
        manager.addSample([i, i]);
      }
      
      expect(manager.getSampleCount()).toBe(bufferSize);
      
      // Add one more - should wrap
      manager.addSample([bufferSize, bufferSize]);
      expect(manager.getSampleCount()).toBe(bufferSize);
    });
  });

  describe('Edge Cases', () => {
    it('should handle persistence of 1', () => {
      manager.setPersistence(1);
      
      manager.addSample([10, 20]);
      manager.addSample([30, 40]);
      
      const samples = manager.getSamplesWithOpacity();
      expect(samples.length).toBe(1);
      expect(samples[0].data).toEqual([30, 40]);
      expect(samples[0].opacity).toBe(255);
    });

    it('should handle maximum persistence of 512', () => {
      manager.setPersistence(512);
      
      for (let i = 0; i < 600; i++) {
        manager.addSample([i, i]);
      }
      
      expect(manager.getSampleCount()).toBe(512);
      
      const samples = manager.getSamplesWithOpacity();
      expect(samples.length).toBe(512);
    });

    it('should handle rapid persistence changes', () => {
      manager.setPersistence(10);
      for (let i = 0; i < 5; i++) {
        manager.addSample([i, i]);
      }
      
      manager.setPersistence(3);
      expect(manager.getSampleCount()).toBe(3);
      
      manager.setPersistence(0);
      expect(manager.getSampleCount()).toBe(3);
      
      manager.setPersistence(10);
      expect(manager.getSampleCount()).toBe(3);
    });

    it('should preserve data integrity through operations', () => {
      const testData = [100, 200, 300, 400];
      manager.addSample(testData);
      
      const samples = manager.getSamplesWithOpacity();
      expect(samples[0].data).toEqual(testData);
      
      // Original data should not be modified
      testData[0] = 999;
      expect(samples[0].data[0]).toBe(100);
    });
  });
});