/** @format */

// tests/sharedMessagePool.test.ts

import { SharedMessagePool, SharedMessageType } from '../src/classes/shared/sharedMessagePool';

describe('SharedMessagePool', () => {
  let pool: SharedMessagePool;

  beforeEach(() => {
    pool = new SharedMessagePool();
  });

  describe('Basic Operations', () => {
    test('should acquire a slot', () => {
      const slot = pool.acquire(100);
      expect(slot).not.toBeNull();
      expect(slot!.poolId).toBeGreaterThanOrEqual(0);
    });

    test('should release a slot', () => {
      const slot = pool.acquire(100);
      expect(slot).not.toBeNull();

      pool.release(slot!.poolId);

      const stats = pool.getStats();
      // After release, slot should be free in appropriate pool
      expect(stats.smallPool.slotsFree + stats.largePool.slotsFree).toBeGreaterThan(0);
    });
  });

  describe('Message Data', () => {
    test('should write and read data using subarray (zero-copy fix)', () => {
      const slot = pool.acquire(100);
      expect(slot).not.toBeNull();

      const testData = new Uint8Array([0x60, 0x62, 0x69, 0x74, 0x6D, 0x61, 0x70]); // "bitmap"
      slot!.writeLength(testData.length);
      slot!.writeData(testData);

      const readData = slot!.readData();
      expect(readData.length).toBe(testData.length);
      expect(Array.from(readData)).toEqual(Array.from(testData));

      // Critical: readData should be a view (subarray), not a copy (slice)
      // This validates our performance fix
      expect(readData).toBeInstanceOf(Uint8Array);
    });

    test('should handle large messages', () => {
      const largeData = new Uint8Array(1000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const slot = pool.acquire(largeData.length);
      expect(slot).not.toBeNull();

      slot!.writeLength(largeData.length);
      slot!.writeData(largeData);

      const readData = slot!.readData();
      expect(readData.length).toBe(1000);
      expect(Array.from(readData)).toEqual(Array.from(largeData));
    });
  });

  describe('Statistics', () => {
    test('should return stats structure with smallPool and largePool', () => {
      const stats = pool.getStats();

      expect(stats.smallPool).toBeDefined();
      expect(stats.largePool).toBeDefined();
      expect(stats.total).toBeDefined();

      expect(stats.smallPool.totalSlots).toBeGreaterThan(0);
      expect(stats.largePool.totalSlots).toBeGreaterThan(0);
    });
  });

  describe('Transferables', () => {
    test('should create transferables', () => {
      const transferables = pool.getTransferables();

      expect(transferables.metadataBuffer).toBeInstanceOf(SharedArrayBuffer);
      expect(transferables.dataBuffer).toBeInstanceOf(SharedArrayBuffer);
    });

    test('should create pool from transferables', () => {
      const transferables = pool.getTransferables();
      const pool2 = SharedMessagePool.fromTransferables(transferables);

      // Both pools should see the same SharedArrayBuffer
      const slot1 = pool.acquire(10);
      expect(slot1).not.toBeNull();

      slot1!.writeType(SharedMessageType.COG3_MESSAGE);
      slot1!.writeLength(5);
      slot1!.writeData(new Uint8Array([1, 2, 3, 4, 5]));

      // Read from pool2 using same poolId
      const slot2 = pool2.get(slot1!.poolId);
      expect(slot2.readType()).toBe(SharedMessageType.COG3_MESSAGE);
      expect(slot2.readLength()).toBe(5);
      expect(Array.from(slot2.readData())).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Complete Message Flow', () => {
    test('should handle typical Worker → Main flow', () => {
      // Simulate Worker acquiring and writing
      const slot = pool.acquire(100);
      expect(slot).not.toBeNull();

      const message = new Uint8Array([0x43, 0x6F, 0x67, 0x33]); // "Cog3"
      slot!.writeType(SharedMessageType.COG3_MESSAGE);
      slot!.writeLength(message.length);
      slot!.writeData(message);
      slot!.setRefCount(2); // Logger + Window

      const poolId = slot!.poolId;

      // Simulate Main thread receiving poolId and reading
      const mainSlot = pool.get(poolId);
      expect(mainSlot.readType()).toBe(SharedMessageType.COG3_MESSAGE);
      expect(mainSlot.readLength()).toBe(4);
      expect(Array.from(mainSlot.readData())).toEqual([0x43, 0x6F, 0x67, 0x33]);

      // Simulate Logger releasing
      pool.release(poolId);
      expect(mainSlot.getRefCount()).toBe(1);

      // Simulate Window releasing
      pool.release(poolId);
      expect(mainSlot.getRefCount()).toBe(0);
    });
  });
});
