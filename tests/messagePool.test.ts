/** @format */

// tests/messagePool.test.ts

import { MessagePool, PooledMessage } from '../src/classes/shared/messagePool';
import { MessageType } from '../src/classes/shared/messageExtractor';

describe('MessagePool', () => {
  let pool: MessagePool;

  beforeEach(() => {
    // Reset singleton for each test
    (MessagePool as any).instance = undefined;
    pool = MessagePool.getInstance();
    
    // Configure with small sizes for testing
    pool.configure({
      initialSize: 5,
      growthSize: 3,
      maxSize: 15,
      slowReleaseThresholdMs: 100
    });
  });

  afterEach(() => {
    pool.reset();
  });

  describe('Basic Operations', () => {
    it('should create singleton instance', () => {
      const pool2 = MessagePool.getInstance();
      expect(pool2).toBe(pool);
    });

    it('should acquire messages from pool', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = pool.acquire(data, MessageType.TERMINAL_OUTPUT, 2);
      
      expect(message).toBeDefined();
      expect(message.data).toEqual(data);
      expect(message.type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(message.consumerCount).toBe(2);
      expect(message.consumersRemaining).toBe(2);
      expect(message.disposed).toBe(false);
    });

    it('should release messages back to pool', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = pool.acquire(data, MessageType.TERMINAL_OUTPUT, 1);
      
      const wasLastConsumer = pool.release(message as PooledMessage);
      expect(wasLastConsumer).toBe(true);
      expect((message as PooledMessage).disposed).toBe(true);
    });

    it('should handle reference counting correctly', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = pool.acquire(data, MessageType.COG_MESSAGE, 3);
      
      // First two releases should not return to pool
      let wasLast = pool.release(message as PooledMessage);
      expect(wasLast).toBe(false);
      expect((message as PooledMessage).consumersRemaining).toBe(2);
      
      wasLast = pool.release(message as PooledMessage);
      expect(wasLast).toBe(false);
      expect((message as PooledMessage).consumersRemaining).toBe(1);
      
      // Third release should return to pool
      wasLast = pool.release(message as PooledMessage);
      expect(wasLast).toBe(true);
      expect((message as PooledMessage).disposed).toBe(true);
    });
  });

  describe('Pool Growth', () => {
    it('should grow pool when exhausted', () => {
      const messages: PooledMessage[] = [];
      
      // Acquire all initial messages (5)
      for (let i = 0; i < 5; i++) {
        const msg = pool.acquire(new Uint8Array([i]), MessageType.TERMINAL_OUTPUT, 1);
        messages.push(msg as PooledMessage);
      }
      
      const stats1 = pool.getStats();
      expect(stats1.poolSize).toBe(5);
      expect(stats1.available).toBe(0);
      
      // Acquire one more - should trigger growth
      const msg6 = pool.acquire(new Uint8Array([6]), MessageType.TERMINAL_OUTPUT, 1);
      messages.push(msg6 as PooledMessage);
      
      const stats2 = pool.getStats();
      expect(stats2.poolSize).toBe(8); // 5 + 3 growth
      expect(stats2.growthEvents).toBe(1);
      
      // Clean up
      messages.forEach(m => pool.release(m));
    });

    it('should respect maximum pool size', () => {
      const messages: PooledMessage[] = [];
      
      // Acquire messages to hit max size (15)
      for (let i = 0; i < 15; i++) {
        const msg = pool.acquire(new Uint8Array([i]), MessageType.TERMINAL_OUTPUT, 1);
        messages.push(msg as PooledMessage);
      }
      
      const stats = pool.getStats();
      expect(stats.poolSize).toBeLessThanOrEqual(15);
      
      // Try to acquire beyond max - should still work but allocate new
      const msg16 = pool.acquire(new Uint8Array([16]), MessageType.TERMINAL_OUTPUT, 1);
      expect(msg16).toBeDefined();
      expect((msg16 as any).pooled).toBe(false); // Not from pool
      
      // Clean up
      messages.forEach(m => pool.release(m));
    });

    it('should track growth events and efficiency', () => {
      const messages: PooledMessage[] = [];
      
      // Force multiple growth events
      for (let i = 0; i < 10; i++) {
        const msg = pool.acquire(new Uint8Array([i]), MessageType.TERMINAL_OUTPUT, 1);
        messages.push(msg as PooledMessage);
      }
      
      const stats = pool.getStats();
      expect(stats.growthEvents).toBeGreaterThan(0);
      expect(stats.totalAcquires).toBe(10);
      expect(stats.efficiency).toBeGreaterThan(0);
      
      // Release all and check efficiency improves
      messages.forEach(m => pool.release(m));
      
      // Acquire again - should all come from pool
      const messages2: PooledMessage[] = [];
      for (let i = 0; i < 10; i++) {
        const msg = pool.acquire(new Uint8Array([i]), MessageType.TERMINAL_OUTPUT, 1);
        messages2.push(msg as PooledMessage);
      }
      
      const stats2 = pool.getStats();
      expect(stats2.poolHits).toBeGreaterThan(stats.poolHits);
      expect(stats2.efficiency).toBeGreaterThan(stats.efficiency);
      
      // Clean up
      messages2.forEach(m => pool.release(m));
    });
  });

  describe('Error Handling', () => {
    it('should prevent double-release', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = pool.acquire(data, MessageType.TERMINAL_OUTPUT, 1);
      
      // First release should work
      const wasLast1 = pool.release(message as PooledMessage);
      expect(wasLast1).toBe(true);
      
      // Second release should be caught
      const wasLast2 = pool.release(message as PooledMessage);
      expect(wasLast2).toBe(false);
    });

    it('should handle invalid messages gracefully', () => {
      const invalidMessage = {
        data: new Uint8Array([1]),
        type: MessageType.TERMINAL_OUTPUT,
        consumerCount: 1,
        consumersRemaining: 1,
        disposed: false
      };
      
      // Should handle non-pooled message
      const result = pool.release(invalidMessage as any);
      expect(result).toBe(false);
    });

    it('should detect slow releases', (done) => {
      const data = new Uint8Array([1, 2, 3]);
      const message = pool.acquire(data, MessageType.TERMINAL_OUTPUT, 1);
      
      // Hold message longer than threshold
      setTimeout(() => {
        const stats1 = pool.getStats();
        pool.release(message as PooledMessage);
        const stats2 = pool.getStats();
        
        // Should have detected slow release
        expect(stats2.slowReleases).toBeGreaterThan(stats1.slowReleases);
        done();
      }, 150); // Greater than 100ms threshold
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid acquire/release cycles', () => {
      const cycles = 100;
      let successCount = 0;
      
      for (let i = 0; i < cycles; i++) {
        const msg = pool.acquire(new Uint8Array([i]), MessageType.TERMINAL_OUTPUT, 1);
        if (msg) {
          successCount++;
          pool.release(msg as PooledMessage);
        }
      }
      
      expect(successCount).toBe(cycles);
      
      const stats = pool.getStats();
      expect(stats.totalAcquires).toBe(cycles);
      expect(stats.totalReleases).toBe(cycles);
    });

    it('should handle multiple consumers correctly', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = pool.acquire(data, MessageType.DB_PACKET, 4); // 4 consumers
      
      // Simulate 4 different consumers releasing at different times
      const consumers = ['Logger', 'Debugger', 'COG', 'Terminal'];
      const releaseResults: boolean[] = [];
      
      consumers.forEach((consumer, index) => {
        const wasLast = pool.release(message as PooledMessage);
        releaseResults.push(wasLast);
        
        if (index < 3) {
          // Not last consumer
          expect(wasLast).toBe(false);
          expect((message as PooledMessage).consumersRemaining).toBe(3 - index);
        } else {
          // Last consumer
          expect(wasLast).toBe(true);
          expect((message as PooledMessage).disposed).toBe(true);
        }
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track all statistics accurately', () => {
      const initialStats = pool.getStats();
      expect(initialStats.poolSize).toBe(5);
      expect(initialStats.totalAcquires).toBe(0);
      expect(initialStats.totalReleases).toBe(0);
      
      // Perform operations
      const messages: PooledMessage[] = [];
      for (let i = 0; i < 8; i++) {
        messages.push(pool.acquire(new Uint8Array([i]), MessageType.TERMINAL_OUTPUT, 1) as PooledMessage);
      }
      
      messages.forEach(m => pool.release(m));
      
      const finalStats = pool.getStats();
      expect(finalStats.totalAcquires).toBe(8);
      expect(finalStats.totalReleases).toBe(8);
      expect(finalStats.growthEvents).toBeGreaterThan(0);
      expect(finalStats.poolHits).toBeGreaterThan(0);
    });

    it('should reset statistics correctly', () => {
      // Do some operations
      for (let i = 0; i < 5; i++) {
        const msg = pool.acquire(new Uint8Array([i]), MessageType.TERMINAL_OUTPUT, 1);
        pool.release(msg as PooledMessage);
      }
      
      const statsBeforeReset = pool.getStats();
      expect(statsBeforeReset.totalAcquires).toBeGreaterThan(0);
      
      // Reset
      pool.reset();
      
      const statsAfterReset = pool.getStats();
      expect(statsAfterReset.totalAcquires).toBe(0);
      expect(statsAfterReset.totalReleases).toBe(0);
      expect(statsAfterReset.poolSize).toBe(5); // Back to initial size
    });
  });

  describe('Memory Management', () => {
    it('should reuse pooled messages to avoid allocation', () => {
      // Acquire and release a message
      const msg1 = pool.acquire(new Uint8Array([1, 2, 3]), MessageType.TERMINAL_OUTPUT, 1);
      const poolId1 = (msg1 as PooledMessage).poolId;
      pool.release(msg1 as PooledMessage);
      
      // Acquire again - should get same pooled object
      const msg2 = pool.acquire(new Uint8Array([4, 5, 6]), MessageType.TERMINAL_OUTPUT, 1);
      const poolId2 = (msg2 as PooledMessage).poolId;
      
      // Pool IDs should match, indicating reuse
      expect(poolId2).toBe(poolId1);
    });

    it('should clear message data on release', () => {
      const data = new Uint8Array([1, 2, 3]);
      const message = pool.acquire(data, MessageType.TERMINAL_OUTPUT, 1) as PooledMessage;
      
      // Message should have data
      expect(message.data).toEqual(data);
      
      // Release
      pool.release(message);
      
      // Data should be cleared (null)
      expect(message.data).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero consumers gracefully', () => {
      const message = pool.acquire(new Uint8Array([1]), MessageType.TERMINAL_OUTPUT, 0);
      
      // Should still create message but with 0 consumers
      expect(message).toBeDefined();
      expect(message.consumerCount).toBe(0);
      expect(message.consumersRemaining).toBe(0);
    });

    it('should handle empty data arrays', () => {
      const message = pool.acquire(new Uint8Array(0), MessageType.TERMINAL_OUTPUT, 1);
      
      expect(message).toBeDefined();
      expect(message.data).toHaveLength(0);
    });

    it('should handle very large consumer counts', () => {
      const message = pool.acquire(new Uint8Array([1]), MessageType.DB_PACKET, 1000);
      
      expect(message).toBeDefined();
      expect(message.consumerCount).toBe(1000);
      expect(message.consumersRemaining).toBe(1000);
      
      // Should handle all releases
      for (let i = 0; i < 1000; i++) {
        const wasLast = pool.release(message as PooledMessage);
        expect(wasLast).toBe(i === 999);
      }
    });
  });
});