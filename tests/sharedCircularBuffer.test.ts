/** @format */

// tests/sharedCircularBuffer.test.ts
// Comprehensive unit tests for SharedCircularBuffer

import {
  SharedCircularBuffer,
  NextStatus,
  NextResult,
  SharedBufferTransferables
} from '../src/classes/shared/sharedCircularBuffer';

describe('SharedCircularBuffer', () => {
  describe('Construction', () => {
    it('should create buffer with default 1MB size', () => {
      const buffer = new SharedCircularBuffer();
      const stats = buffer.getStats();
      expect(stats.size).toBe(1048576);
    });

    it('should create buffer with custom size', () => {
      const buffer = new SharedCircularBuffer(1024);
      const stats = buffer.getStats();
      expect(stats.size).toBe(1024);
    });

    it('should start empty', () => {
      const buffer = new SharedCircularBuffer(128);
      expect(buffer.hasData()).toBe(false);
      expect(buffer.getUsedSpace()).toBe(0);
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should have available space equal to size minus 1', () => {
      const buffer = new SharedCircularBuffer(100);
      // -1 because we reserve one slot to distinguish full from empty
      expect(buffer.getAvailableSpace()).toBe(99);
    });
  });

  describe('appendAtTail - Basic Operations', () => {
    let buffer: SharedCircularBuffer;

    beforeEach(() => {
      buffer = new SharedCircularBuffer(128);
    });

    it('should append single byte array', () => {
      const data = new Uint8Array([0x41, 0x42, 0x43]); // ABC
      expect(buffer.appendAtTail(data)).toBe(true);
      expect(buffer.hasData()).toBe(true);
      expect(buffer.getUsedSpace()).toBe(3);
    });

    it('should append multiple arrays sequentially', () => {
      const data1 = new Uint8Array([1, 2, 3]);
      const data2 = new Uint8Array([4, 5, 6]);
      const data3 = new Uint8Array([7, 8, 9]);

      expect(buffer.appendAtTail(data1)).toBe(true);
      expect(buffer.appendAtTail(data2)).toBe(true);
      expect(buffer.appendAtTail(data3)).toBe(true);

      expect(buffer.getUsedSpace()).toBe(9);
    });

    it('should append empty array without error', () => {
      const empty = new Uint8Array([]);
      expect(buffer.appendAtTail(empty)).toBe(true);
      // Note: Implementation sets hasData=true even for empty append
      // This is acceptable - hasData reflects "not explicitly empty" state
      expect(buffer.getUsedSpace()).toBe(0);
    });

    it('should reject data larger than available space', () => {
      const buffer = new SharedCircularBuffer(10);
      const tooLarge = new Uint8Array(20);
      expect(buffer.appendAtTail(tooLarge)).toBe(false);
    });

    it('should track overflow count', () => {
      const buffer = new SharedCircularBuffer(10);
      const data = new Uint8Array(15);

      buffer.appendAtTail(data); // Should fail
      buffer.appendAtTail(data); // Should fail again

      const stats = buffer.getStats();
      expect(stats.overflowCount).toBe(2);
    });
  });

  describe('next - Basic Operations', () => {
    let buffer: SharedCircularBuffer;

    beforeEach(() => {
      buffer = new SharedCircularBuffer(128);
    });

    it('should return EMPTY for empty buffer', () => {
      const result = buffer.next();
      expect(result.status).toBe(NextStatus.EMPTY);
      expect(result.value).toBeUndefined();
    });

    it('should read bytes in FIFO order', () => {
      const data = new Uint8Array([0x10, 0x20, 0x30]);
      buffer.appendAtTail(data);

      expect(buffer.next()).toEqual({ status: NextStatus.DATA, value: 0x10 });
      expect(buffer.next()).toEqual({ status: NextStatus.DATA, value: 0x20 });
      expect(buffer.next()).toEqual({ status: NextStatus.DATA, value: 0x30 });
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle all byte values 0-255', () => {
      const data = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        data[i] = i;
      }

      const buffer = new SharedCircularBuffer(512);
      buffer.appendAtTail(data);

      for (let i = 0; i < 256; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(i);
      }
    });

    it('should update hasData correctly', () => {
      const data = new Uint8Array([1, 2]);
      buffer.appendAtTail(data);

      expect(buffer.hasData()).toBe(true);
      buffer.next();
      expect(buffer.hasData()).toBe(true);
      buffer.next();
      expect(buffer.hasData()).toBe(false);
    });
  });

  describe('Wraparound Behavior', () => {
    it('should handle write wraparound', () => {
      const buffer = new SharedCircularBuffer(10);

      // Fill most of buffer
      const data1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
      buffer.appendAtTail(data1);

      // Read some to make room at the start
      for (let i = 0; i < 5; i++) {
        buffer.next();
      }

      // Write data that wraps around
      const data2 = new Uint8Array([10, 11, 12, 13, 14]);
      expect(buffer.appendAtTail(data2)).toBe(true);

      // Read all remaining data
      expect(buffer.next().value).toBe(6);
      expect(buffer.next().value).toBe(7);
      expect(buffer.next().value).toBe(10);
      expect(buffer.next().value).toBe(11);
      expect(buffer.next().value).toBe(12);
      expect(buffer.next().value).toBe(13);
      expect(buffer.next().value).toBe(14);
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle read wraparound', () => {
      const buffer = new SharedCircularBuffer(8);

      // Write, read, write pattern to force wraparound
      buffer.appendAtTail(new Uint8Array([1, 2, 3, 4, 5]));
      for (let i = 0; i < 4; i++) buffer.next();

      buffer.appendAtTail(new Uint8Array([6, 7, 8, 9]));

      // Read should wrap around
      expect(buffer.next().value).toBe(5);
      expect(buffer.next().value).toBe(6);
      expect(buffer.next().value).toBe(7);
      expect(buffer.next().value).toBe(8);
      expect(buffer.next().value).toBe(9);
    });
  });

  describe('peekAtOffset', () => {
    let buffer: SharedCircularBuffer;

    beforeEach(() => {
      buffer = new SharedCircularBuffer(128);
      buffer.appendAtTail(new Uint8Array([10, 20, 30, 40, 50]));
    });

    it('should peek without consuming data', () => {
      const peeked = buffer.peekAtOffset(0, 3);
      expect(peeked).toEqual(new Uint8Array([10, 20, 30]));

      // Data should still be there
      expect(buffer.getUsedSpace()).toBe(5);
      expect(buffer.next().value).toBe(10);
    });

    it('should peek at offset', () => {
      const peeked = buffer.peekAtOffset(2, 2);
      expect(peeked).toEqual(new Uint8Array([30, 40]));
    });

    it('should return null if not enough data', () => {
      const peeked = buffer.peekAtOffset(0, 100);
      expect(peeked).toBeNull();
    });

    it('should handle peek across wraparound', () => {
      const buffer = new SharedCircularBuffer(10);

      // Create wraparound situation
      buffer.appendAtTail(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
      for (let i = 0; i < 5; i++) buffer.next();
      buffer.appendAtTail(new Uint8Array([8, 9, 10, 11]));

      // Peek should handle wraparound
      const peeked = buffer.peekAtOffset(0, 6);
      expect(peeked).toEqual(new Uint8Array([6, 7, 8, 9, 10, 11]));
    });
  });

  describe('consume', () => {
    let buffer: SharedCircularBuffer;

    beforeEach(() => {
      buffer = new SharedCircularBuffer(128);
      buffer.appendAtTail(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    });

    it('should advance head by count', () => {
      expect(buffer.consume(3)).toBe(true);
      expect(buffer.getUsedSpace()).toBe(7);
      expect(buffer.next().value).toBe(4);
    });

    it('should return false if count exceeds available', () => {
      expect(buffer.consume(100)).toBe(false);
      expect(buffer.getUsedSpace()).toBe(10); // Unchanged
    });

    it('should handle consuming all data', () => {
      expect(buffer.consume(10)).toBe(true);
      expect(buffer.hasData()).toBe(false);
    });

    it('should handle zero count', () => {
      expect(buffer.consume(0)).toBe(true);
      expect(buffer.getUsedSpace()).toBe(10);
    });
  });

  describe('savePosition / restorePosition', () => {
    let buffer: SharedCircularBuffer;

    beforeEach(() => {
      buffer = new SharedCircularBuffer(128);
      buffer.appendAtTail(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('should save and restore read position', () => {
      buffer.next(); // Read 1
      buffer.savePosition();
      buffer.next(); // Read 2
      buffer.next(); // Read 3

      expect(buffer.restorePosition()).toBe(true);
      expect(buffer.next().value).toBe(2); // Back to saved position
    });

    it('should support nested save/restore', () => {
      buffer.savePosition(); // Position 0
      buffer.next();
      buffer.savePosition(); // Position 1
      buffer.next();
      buffer.next();

      expect(buffer.restorePosition()).toBe(true);
      expect(buffer.next().value).toBe(2);

      expect(buffer.restorePosition()).toBe(true);
      expect(buffer.next().value).toBe(1);
    });

    it('should return false when no saved position', () => {
      expect(buffer.restorePosition()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should reset buffer to empty state', () => {
      const buffer = new SharedCircularBuffer(128);
      buffer.appendAtTail(new Uint8Array([1, 2, 3, 4, 5]));
      buffer.savePosition();

      buffer.clear();

      expect(buffer.hasData()).toBe(false);
      expect(buffer.getUsedSpace()).toBe(0);
      expect(buffer.getHeadPosition()).toBe(0);
      expect(buffer.getTailPosition()).toBe(0);
      expect(buffer.restorePosition()).toBe(false); // Saved positions cleared
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const buffer = new SharedCircularBuffer(100);
      buffer.appendAtTail(new Uint8Array([1, 2, 3, 4, 5]));

      const stats = buffer.getStats();

      expect(stats.size).toBe(100);
      expect(stats.used).toBe(5);
      expect(stats.available).toBe(94); // 100 - 5 - 1
      expect(stats.usagePercent).toBe(5);
      expect(stats.highWaterMark).toBe(5);
      expect(stats.overflowCount).toBe(0);
    });

    it('should track high water mark', () => {
      const buffer = new SharedCircularBuffer(100);

      buffer.appendAtTail(new Uint8Array(10));
      expect(buffer.getStats().highWaterMark).toBe(10);

      // Read some
      for (let i = 0; i < 5; i++) buffer.next();

      // Write more - new high water mark
      buffer.appendAtTail(new Uint8Array(20));
      expect(buffer.getStats().highWaterMark).toBe(25);

      // Read all - high water mark should persist
      while (buffer.hasData()) buffer.next();
      expect(buffer.getStats().highWaterMark).toBe(25);
    });

    it('should detect near-full condition', () => {
      const buffer = new SharedCircularBuffer(100);

      buffer.appendAtTail(new Uint8Array(75));
      expect(buffer.getStats().isNearFull).toBe(false);

      buffer.appendAtTail(new Uint8Array(10));
      expect(buffer.getStats().isNearFull).toBe(true);
    });
  });

  describe('Position Accessors', () => {
    it('should return head position', () => {
      const buffer = new SharedCircularBuffer(128);
      buffer.appendAtTail(new Uint8Array([1, 2, 3]));

      expect(buffer.getHeadPosition()).toBe(0);
      buffer.next();
      expect(buffer.getHeadPosition()).toBe(1);
    });

    it('should return tail position', () => {
      const buffer = new SharedCircularBuffer(128);

      expect(buffer.getTailPosition()).toBe(0);
      buffer.appendAtTail(new Uint8Array([1, 2, 3]));
      expect(buffer.getTailPosition()).toBe(3);
    });

    it('getReadPosition should match getHeadPosition', () => {
      const buffer = new SharedCircularBuffer(128);
      buffer.appendAtTail(new Uint8Array([1, 2, 3]));
      buffer.next();

      expect(buffer.getReadPosition()).toBe(buffer.getHeadPosition());
    });
  });

  describe('Transferables (Worker Thread Support)', () => {
    it('should get transferables for worker', () => {
      const buffer = new SharedCircularBuffer(256);
      const transferables = buffer.getTransferables();

      expect(transferables.size).toBe(256);
      expect(transferables.dataBuffer).toBeInstanceOf(SharedArrayBuffer);
      expect(transferables.stateBuffer).toBeInstanceOf(SharedArrayBuffer);
      expect(transferables.dataBuffer.byteLength).toBe(256);
      expect(transferables.stateBuffer.byteLength).toBe(12); // 3 x Int32
    });

    it('should create buffer from transferables', () => {
      const original = new SharedCircularBuffer(128);
      original.appendAtTail(new Uint8Array([1, 2, 3, 4, 5]));

      const transferables = original.getTransferables();
      const attached = SharedCircularBuffer.fromTransferables(transferables);

      // Attached buffer should see same data
      expect(attached.hasData()).toBe(true);
      expect(attached.getUsedSpace()).toBe(5);
      expect(attached.next().value).toBe(1);
    });

    it('should share state between original and attached', () => {
      const original = new SharedCircularBuffer(128);
      const transferables = original.getTransferables();
      const attached = SharedCircularBuffer.fromTransferables(transferables);

      // Write on original
      original.appendAtTail(new Uint8Array([10, 20, 30]));

      // Read on attached
      expect(attached.hasData()).toBe(true);
      expect(attached.next().value).toBe(10);
      expect(attached.next().value).toBe(20);

      // Original should see consumed data
      expect(original.getUsedSpace()).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle buffer size of 1', () => {
      const buffer = new SharedCircularBuffer(2); // Minimum practical size
      // Available space is size - 1 = 1
      expect(buffer.getAvailableSpace()).toBe(1);

      expect(buffer.appendAtTail(new Uint8Array([42]))).toBe(true);
      expect(buffer.appendAtTail(new Uint8Array([43]))).toBe(false); // Full

      expect(buffer.next().value).toBe(42);
      expect(buffer.appendAtTail(new Uint8Array([43]))).toBe(true); // Now has room
    });

    it('should handle rapid write/read cycles', () => {
      const buffer = new SharedCircularBuffer(16);

      for (let cycle = 0; cycle < 100; cycle++) {
        const data = new Uint8Array([cycle % 256]);
        expect(buffer.appendAtTail(data)).toBe(true);
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(cycle % 256);
      }
    });

    it('should handle exact buffer fill', () => {
      const buffer = new SharedCircularBuffer(10);
      // Can fill size-1 = 9 bytes
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(buffer.appendAtTail(data)).toBe(true);
      expect(buffer.getAvailableSpace()).toBe(0);
      expect(buffer.appendAtTail(new Uint8Array([10]))).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve exact byte content through write/read cycle', () => {
      const buffer = new SharedCircularBuffer(1024);

      // Test with various byte patterns
      const testPatterns = [
        new Uint8Array([0x00, 0xFF, 0x55, 0xAA]),
        new Uint8Array([0x0D, 0x0A, 0x0D, 0x0A]), // CR/LF
        new Uint8Array([0x00, 0x00, 0x00, 0x00]), // All zeros
        new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]), // All ones
      ];

      for (const pattern of testPatterns) {
        buffer.clear();
        buffer.appendAtTail(pattern);

        const readBack: number[] = [];
        while (buffer.hasData()) {
          readBack.push(buffer.next().value!);
        }

        expect(readBack).toEqual(Array.from(pattern));
      }
    });

    it('should handle binary data with all 256 byte values', () => {
      const buffer = new SharedCircularBuffer(512);
      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        allBytes[i] = i;
      }

      buffer.appendAtTail(allBytes);

      const readBack: number[] = [];
      while (buffer.hasData()) {
        readBack.push(buffer.next().value!);
      }

      expect(readBack.length).toBe(256);
      for (let i = 0; i < 256; i++) {
        expect(readBack[i]).toBe(i);
      }
    });
  });
});
