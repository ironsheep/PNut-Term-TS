/** @format */

// tests/dynamicQueue.test.ts

import { DynamicQueue, QueueStats } from '../src/classes/shared/dynamicQueue';

describe('DynamicQueue', () => {
  let queue: DynamicQueue<number>;

  beforeEach(() => {
    queue = new DynamicQueue<number>();
  });

  describe('Basic Operations', () => {
    it('should initialize with default capacity 10', () => {
      const stats = queue.getStats();
      expect(stats.capacity).toBe(10);
      expect(stats.currentSize).toBe(0);
      expect(stats.isEmpty).toBe(true);
    });

    it('should enqueue and dequeue items', () => {
      expect(queue.enqueue(1)).toBe(true);
      expect(queue.enqueue(2)).toBe(true);
      expect(queue.enqueue(3)).toBe(true);

      expect(queue.getSize()).toBe(3);
      expect(queue.dequeue()).toBe(1);
      expect(queue.dequeue()).toBe(2);
      expect(queue.dequeue()).toBe(3);
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should maintain FIFO order', () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue(i);
      }

      for (let i = 0; i < 5; i++) {
        expect(queue.dequeue()).toBe(i);
      }
    });

    it('should peek without removing', () => {
      queue.enqueue(42);
      expect(queue.peek()).toBe(42);
      expect(queue.getSize()).toBe(1);
      expect(queue.peek()).toBe(42);
    });

    it('should clear queue', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);
      
      queue.clear();
      expect(queue.isEmpty()).toBe(true);
      expect(queue.getSize()).toBe(0);
    });
  });

  describe('Dynamic Resizing', () => {
    it('should double capacity when full', () => {
      // Fill initial capacity (10)
      for (let i = 0; i < 10; i++) {
        expect(queue.enqueue(i)).toBe(true);
      }

      let stats = queue.getStats();
      expect(stats.capacity).toBe(10);
      expect(stats.resizeCount).toBe(0);

      // Add one more to trigger resize
      expect(queue.enqueue(10)).toBe(true);

      stats = queue.getStats();
      expect(stats.capacity).toBe(20);
      expect(stats.resizeCount).toBe(1);
      expect(stats.currentSize).toBe(11);
    });

    it('should maintain order during resize', () => {
      // Fill and trigger resize
      for (let i = 0; i < 15; i++) {
        queue.enqueue(i);
      }

      // Verify order is preserved
      for (let i = 0; i < 15; i++) {
        expect(queue.dequeue()).toBe(i);
      }
    });

    it('should handle multiple resizes', () => {
      // Trigger multiple resizes: 10 -> 20 -> 40 -> 80
      for (let i = 0; i < 75; i++) {
        expect(queue.enqueue(i)).toBe(true);
      }

      const stats = queue.getStats();
      expect(stats.capacity).toBe(80);
      expect(stats.resizeCount).toBe(3);
    });

    it('should stop at max capacity', () => {
      const smallQueue = new DynamicQueue<number>(10, 40);

      // Fill to max capacity
      for (let i = 0; i < 40; i++) {
        expect(smallQueue.enqueue(i)).toBe(true);
      }

      // Should reject after max capacity
      expect(smallQueue.enqueue(40)).toBe(false);

      const stats = smallQueue.getStats();
      expect(stats.capacity).toBe(40);
      expect(stats.droppedCount).toBe(1);
    });

    it('should track resize pattern correctly', () => {
      // Simulate burst pattern
      for (let i = 0; i < 25; i++) {
        queue.enqueue(i);
      }

      let stats = queue.getStats();
      expect(stats.capacity).toBe(40); // 10 -> 20 -> 40
      expect(stats.resizeCount).toBe(2);

      // Drain partially
      for (let i = 0; i < 15; i++) {
        queue.dequeue();
      }

      // Add more without triggering resize
      for (let i = 0; i < 10; i++) {
        queue.enqueue(100 + i);
      }

      stats = queue.getStats();
      expect(stats.capacity).toBe(40); // Should stay at 40
      expect(stats.resizeCount).toBe(2); // No new resizes
    });
  });

  describe('Statistics Tracking', () => {
    it('should track high water mark', () => {
      // Add items
      for (let i = 0; i < 15; i++) {
        queue.enqueue(i);
      }

      let stats = queue.getStats();
      expect(stats.highWaterMark).toBe(15);

      // Remove some
      for (let i = 0; i < 10; i++) {
        queue.dequeue();
      }

      // High water mark should remain
      stats = queue.getStats();
      expect(stats.highWaterMark).toBe(15);
      expect(stats.currentSize).toBe(5);
    });

    it('should track total enqueued and dequeued', () => {
      for (let i = 0; i < 100; i++) {
        queue.enqueue(i);
      }

      for (let i = 0; i < 50; i++) {
        queue.dequeue();
      }

      const stats = queue.getStats();
      expect(stats.totalEnqueued).toBe(100);
      expect(stats.totalDequeued).toBe(50);
    });

    it('should track dropped items', () => {
      const tinyQueue = new DynamicQueue<number>(2, 4);

      // Fill to max
      for (let i = 0; i < 4; i++) {
        expect(tinyQueue.enqueue(i)).toBe(true);
      }

      // These should be dropped
      expect(tinyQueue.enqueue(4)).toBe(false);
      expect(tinyQueue.enqueue(5)).toBe(false);

      const stats = tinyQueue.getStats();
      expect(stats.droppedCount).toBe(2);
    });

    it('should calculate utilization correctly', () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue(i);
      }

      expect(queue.getUtilization()).toBe(50); // 5/10 * 100
    });

    it('should reset statistics', () => {
      // Generate some stats
      for (let i = 0; i < 20; i++) {
        queue.enqueue(i);
      }
      for (let i = 0; i < 10; i++) {
        queue.dequeue();
      }

      queue.resetStats();

      const stats = queue.getStats();
      expect(stats.highWaterMark).toBe(10); // Current size
      expect(stats.resizeCount).toBe(0);
      expect(stats.totalEnqueued).toBe(0);
      expect(stats.totalDequeued).toBe(0);
    });
  });

  describe('Circular Buffer Behavior', () => {
    it('should wrap around correctly', () => {
      const smallQueue = new DynamicQueue<number>(5, 5);

      // Fill queue
      for (let i = 0; i < 5; i++) {
        smallQueue.enqueue(i);
      }

      // Remove 3
      for (let i = 0; i < 3; i++) {
        expect(smallQueue.dequeue()).toBe(i);
      }

      // Add 3 more (should wrap)
      for (let i = 5; i < 8; i++) {
        expect(smallQueue.enqueue(i)).toBe(true);
      }

      // Verify order
      expect(smallQueue.dequeue()).toBe(3);
      expect(smallQueue.dequeue()).toBe(4);
      expect(smallQueue.dequeue()).toBe(5);
      expect(smallQueue.dequeue()).toBe(6);
      expect(smallQueue.dequeue()).toBe(7);
    });

    it('should handle rapid enqueue/dequeue cycles', () => {
      for (let cycle = 0; cycle < 100; cycle++) {
        // Add 5
        for (let i = 0; i < 5; i++) {
          queue.enqueue(cycle * 100 + i);
        }

        // Remove 3
        for (let i = 0; i < 3; i++) {
          queue.dequeue();
        }
      }

      // Should have 200 items queued (100 cycles * 2 net items per cycle)
      expect(queue.getSize()).toBe(200);
    });
  });

  describe('Utility Methods', () => {
    it('should convert to array', () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue(i);
      }

      const array = queue.toArray();
      expect(array).toEqual([0, 1, 2, 3, 4]);
      expect(queue.getSize()).toBe(5); // Should not modify queue
    });

    it('should process items with callback', () => {
      for (let i = 0; i < 10; i++) {
        queue.enqueue(i);
      }

      let sum = 0;
      const processed = queue.processWhile((item) => {
        sum += item;
        return item < 5; // Stop at 5
      });

      expect(processed).toBe(5);
      expect(sum).toBe(0 + 1 + 2 + 3 + 4);
      expect(queue.getSize()).toBe(5); // 5-9 remain
      expect(queue.peek()).toBe(5);
    });

    it('should indicate when to shrink', () => {
      // Start with larger capacity
      for (let i = 0; i < 50; i++) {
        queue.enqueue(i);
      }

      // This triggers resizes to capacity 80
      expect(queue.getStats().capacity).toBe(80);

      // Remove most items
      for (let i = 0; i < 48; i++) {
        queue.dequeue();
      }

      // Now only 2 items in capacity 80
      expect(queue.getUtilization()).toBeLessThan(25);
      expect(queue.shouldShrink()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue operations', () => {
      expect(queue.dequeue()).toBeUndefined();
      expect(queue.peek()).toBeUndefined();
      expect(queue.isEmpty()).toBe(true);
      expect(queue.toArray()).toEqual([]);
    });

    it('should handle single item', () => {
      queue.enqueue(42);
      expect(queue.peek()).toBe(42);
      expect(queue.dequeue()).toBe(42);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should handle max capacity of 1', () => {
      const single = new DynamicQueue<number>(1, 1);
      expect(single.enqueue(1)).toBe(true);
      expect(single.enqueue(2)).toBe(false);
      expect(single.dequeue()).toBe(1);
      expect(single.enqueue(2)).toBe(true);
    });

    it('should handle processWhile with empty queue', () => {
      const processed = queue.processWhile(() => true);
      expect(processed).toBe(0);
    });

    it('should handle custom initial capacity', () => {
      const customQueue = new DynamicQueue<string>(50, 200);
      const stats = customQueue.getStats();
      expect(stats.capacity).toBe(50);
    });
  });

  describe('Load Patterns', () => {
    it('should stabilize after finding right size', () => {
      // Simulate realistic load pattern
      const load = new DynamicQueue<number>();
      const results: number[] = [];

      // Burst of 35 items
      for (let i = 0; i < 35; i++) {
        load.enqueue(i);
      }
      results.push(load.getStats().capacity); // Should be 40

      // Process some
      for (let i = 0; i < 20; i++) {
        load.dequeue();
      }

      // Steady state: add 10, remove 10
      for (let cycle = 0; cycle < 5; cycle++) {
        for (let i = 0; i < 10; i++) {
          load.enqueue(100 + cycle * 10 + i);
        }
        for (let i = 0; i < 10; i++) {
          load.dequeue();
        }
        results.push(load.getStats().capacity);
      }

      // Capacity should stabilize at 40 (enough for the burst)
      expect(results[0]).toBe(40);
      expect(results[results.length - 1]).toBe(40);
      expect(load.getStats().resizeCount).toBe(2); // Only initial resizes
    });

    it('should handle sustained high load', () => {
      const highLoad = new DynamicQueue<number>(10, 1000);

      // Sustained enqueue faster than dequeue
      for (let i = 0; i < 500; i++) {
        highLoad.enqueue(i);
        if (i % 3 === 0) {
          highLoad.dequeue(); // Dequeue every 3rd
        }
      }

      const stats = highLoad.getStats();
      expect(stats.currentSize).toBeGreaterThan(300);
      expect(stats.capacity).toBeGreaterThanOrEqual(320);
      expect(stats.capacity).toBeLessThanOrEqual(640);
    });
  });
});