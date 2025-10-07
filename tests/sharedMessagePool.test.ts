/** @format */

// tests/sharedMessagePool.test.ts

import { SharedMessagePool, MessageType, getCogIdFromType, getMessageCategory } from '../src/classes/shared/sharedMessagePool';

describe('SharedMessagePool', () => {
  let pool: SharedMessagePool;

  beforeEach(() => {
    pool = new SharedMessagePool(10, 1024); // Small pool for testing
  });

  describe('Basic Operations', () => {
    test('should acquire a slot', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();
      expect(slot!.poolId).toBeGreaterThanOrEqual(0);
      expect(slot!.poolId).toBeLessThan(10);
    });

    test('should release a slot', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      pool.release(slot!.poolId);

      const stats = pool.getStats();
      expect(stats.slotsFree).toBe(10);
      expect(stats.slotsAllocated).toBe(0);
    });

    test('should reuse released slots', () => {
      const slot1 = pool.acquire();
      const firstId = slot1!.poolId;

      pool.release(firstId);

      const slot2 = pool.acquire();
      expect(slot2!.poolId).toBe(firstId); // Should reuse same slot
    });
  });

  describe('Reference Counting', () => {
    test('should set and get reference count', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      slot!.setRefCount(3);
      expect(slot!.getRefCount()).toBe(3);
    });

    test('should decrement refCount on release', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      slot!.setRefCount(3);

      pool.release(slot!.poolId);
      expect(slot!.getRefCount()).toBe(2);

      pool.release(slot!.poolId);
      expect(slot!.getRefCount()).toBe(1);

      pool.release(slot!.poolId);
      expect(slot!.getRefCount()).toBe(0); // Now free
    });

    test('should mark slot free when refCount reaches 0', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      slot!.setRefCount(2);

      pool.release(slot!.poolId);
      let stats = pool.getStats();
      expect(stats.slotsFree).toBe(9); // Still allocated

      pool.release(slot!.poolId);
      stats = pool.getStats();
      expect(stats.slotsFree).toBe(10); // Now free
    });
  });

  describe('Message Data', () => {
    test('should write and read type', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      slot!.writeType(MessageType.COG3_MESSAGE);
      expect(slot!.readType()).toBe(MessageType.COG3_MESSAGE);
    });

    test('should write and read length', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      slot!.writeLength(256);
      expect(slot!.readLength()).toBe(256);
    });

    test('should write and read data', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      const testData = new Uint8Array([0x60, 0x62, 0x69, 0x74, 0x6D, 0x61, 0x70]); // "bitmap"
      slot!.writeLength(testData.length);
      slot!.writeData(testData);

      const readData = slot!.readData();
      expect(readData.length).toBe(testData.length);
      expect(Array.from(readData)).toEqual(Array.from(testData));
    });

    test('should handle large messages', () => {
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      const largeData = new Uint8Array(1000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      slot!.writeLength(largeData.length);
      slot!.writeData(largeData);

      const readData = slot!.readData();
      expect(readData.length).toBe(1000);
      expect(Array.from(readData)).toEqual(Array.from(largeData));
    });
  });

  describe('Pool Exhaustion', () => {
    test('should return null when pool exhausted', () => {
      const slots = [];

      // Acquire all 10 slots
      for (let i = 0; i < 10; i++) {
        const slot = pool.acquire();
        expect(slot).not.toBeNull();
        slots.push(slot);
      }

      // Try to acquire one more - should fail
      const overflow = pool.acquire();
      expect(overflow).toBeNull();

      const stats = pool.getStats();
      expect(stats.overflows).toBe(1);
    });

    test('should allow acquisition after release', () => {
      const slots = [];

      // Acquire all 10 slots
      for (let i = 0; i < 10; i++) {
        slots.push(pool.acquire());
      }

      // Pool exhausted
      expect(pool.acquire()).toBeNull();

      // Release one slot
      pool.release(slots[0]!.poolId);

      // Should be able to acquire again
      const newSlot = pool.acquire();
      expect(newSlot).not.toBeNull();
    });
  });

  describe('Statistics', () => {
    test('should track acquisitions and releases', () => {
      const slot1 = pool.acquire();
      const slot2 = pool.acquire();

      let stats = pool.getStats();
      expect(stats.acquisitions).toBe(2);
      expect(stats.releases).toBe(0);
      expect(stats.slotsAllocated).toBe(2);
      expect(stats.slotsFree).toBe(8);

      pool.release(slot1!.poolId);

      stats = pool.getStats();
      expect(stats.acquisitions).toBe(2);
      expect(stats.releases).toBe(1);
      expect(stats.slotsAllocated).toBe(1);
      expect(stats.slotsFree).toBe(9);
    });

    test('should calculate utilization percentage', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();

      const stats = pool.getStats();
      expect(stats.utilizationPercent).toBe(30); // 3/10 = 30%
    });
  });

  describe('Transferables', () => {
    test('should create transferables', () => {
      const transferables = pool.getTransferables();

      expect(transferables.metadataBuffer).toBeInstanceOf(SharedArrayBuffer);
      expect(transferables.dataBuffer).toBeInstanceOf(SharedArrayBuffer);
      expect(transferables.maxSlots).toBe(10);
      expect(transferables.maxMessageSize).toBe(1024);
    });

    test('should create pool from transferables', () => {
      const transferables = pool.getTransferables();
      const pool2 = SharedMessagePool.fromTransferables(transferables);

      // Both pools should see the same SharedArrayBuffer
      const slot1 = pool.acquire();
      expect(slot1).not.toBeNull();

      slot1!.writeType(MessageType.BACKTICK_WINDOW);
      slot1!.writeLength(5);
      slot1!.writeData(new Uint8Array([1, 2, 3, 4, 5]));

      // Read from pool2 using same poolId
      const slot2 = pool2.get(slot1!.poolId);
      expect(slot2.readType()).toBe(MessageType.BACKTICK_WINDOW);
      expect(slot2.readLength()).toBe(5);
      expect(Array.from(slot2.readData())).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Helper Functions', () => {
    test('getCogIdFromType should extract COG ID', () => {
      expect(getCogIdFromType(MessageType.COG0_MESSAGE)).toBe(0);
      expect(getCogIdFromType(MessageType.COG3_MESSAGE)).toBe(3);
      expect(getCogIdFromType(MessageType.COG7_MESSAGE)).toBe(7);
      expect(getCogIdFromType(MessageType.DEBUGGER0_416BYTE)).toBe(0);
      expect(getCogIdFromType(MessageType.DEBUGGER5_416BYTE)).toBe(5);
      expect(getCogIdFromType(MessageType.BACKTICK_WINDOW)).toBeNull();
      expect(getCogIdFromType(MessageType.DB_PACKET)).toBeNull();
    });

    test('getMessageCategory should categorize types', () => {
      expect(getMessageCategory(MessageType.COG0_MESSAGE)).toBe('COG');
      expect(getMessageCategory(MessageType.COG7_MESSAGE)).toBe('COG');
      expect(getMessageCategory(MessageType.DEBUGGER0_416BYTE)).toBe('DEBUGGER');
      expect(getMessageCategory(MessageType.DEBUGGER7_416BYTE)).toBe('DEBUGGER');
      expect(getMessageCategory(MessageType.BACKTICK_WINDOW)).toBe('BACKTICK');
      expect(getMessageCategory(MessageType.DB_PACKET)).toBe('DB_PACKET');
      expect(getMessageCategory(MessageType.TERMINAL_OUTPUT)).toBe('OTHER');
    });
  });

  describe('Clear', () => {
    test('should clear all slots', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();

      let stats = pool.getStats();
      expect(stats.slotsAllocated).toBe(3);

      pool.clear();

      stats = pool.getStats();
      expect(stats.slotsAllocated).toBe(0);
      expect(stats.slotsFree).toBe(10);
    });
  });

  describe('Complete Message Flow', () => {
    test('should handle typical Worker → Main flow', () => {
      // Simulate Worker acquiring and writing
      const slot = pool.acquire();
      expect(slot).not.toBeNull();

      const message = new Uint8Array([0x43, 0x6F, 0x67, 0x33]); // "Cog3"
      slot!.writeType(MessageType.COG3_MESSAGE);
      slot!.writeLength(message.length);
      slot!.writeData(message);
      slot!.setRefCount(2); // Logger + Window

      const poolId = slot!.poolId;

      // Simulate Main thread receiving poolId and reading
      const mainSlot = pool.get(poolId);
      expect(mainSlot.readType()).toBe(MessageType.COG3_MESSAGE);
      expect(mainSlot.readLength()).toBe(4);
      expect(Array.from(mainSlot.readData())).toEqual([0x43, 0x6F, 0x67, 0x33]);

      // Simulate Logger releasing
      pool.release(poolId);
      expect(mainSlot.getRefCount()).toBe(1);

      // Simulate Window releasing
      pool.release(poolId);
      expect(mainSlot.getRefCount()).toBe(0);

      // Slot should be free now
      const stats = pool.getStats();
      expect(stats.slotsFree).toBe(10);
    });
  });
});
