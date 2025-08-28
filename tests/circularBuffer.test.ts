/** @format */

// tests/circularBuffer.test.ts

import { CircularBuffer, NextStatus, NextResult } from '../src/classes/shared/circularBuffer';

describe('CircularBuffer', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer();
  });

  describe('Basic Operations', () => {
    it('should initialize empty', () => {
      const stats = buffer.getStats();
      expect(stats.used === 0).toBe(true); // Buffer is empty
      expect(stats.used).toBe(0);
      expect(stats.available).toBe(1048576);
      expect(buffer.hasData()).toBe(false);
    });

    it('should append data to tail', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = buffer.appendAtTail(data);
      
      expect(result).toBe(true);
      expect(buffer.hasData()).toBe(true);
      expect(buffer.getUsedSpace()).toBe(5);
    });

    it('should reject append when insufficient space', () => {
      // Create data larger than 1MB buffer
      const largeData = new Uint8Array(1048577);
      const result = buffer.appendAtTail(largeData);
      
      expect(result).toBe(false);
      expect(buffer.getUsedSpace()).toBe(0);
    });

    it('should read data with next()', () => {
      const data = new Uint8Array([65, 66, 67]); // ABC
      buffer.appendAtTail(data);

      let result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(65);

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(66);

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(67);

      result = buffer.next();
      expect(result.status).toBe(NextStatus.EMPTY);
    });

    it('should clear buffer', () => {
      const data = new Uint8Array([1, 2, 3]);
      buffer.appendAtTail(data);
      expect(buffer.hasData()).toBe(true);

      buffer.clear();
      expect(buffer.hasData()).toBe(false);
      expect(buffer.getUsedSpace()).toBe(0);
    });
  });

  describe('Raw Byte Storage', () => {
    it('should store and retrieve LF as raw data', () => {
      const data = new Uint8Array([65, 0x0A, 66]); // A\nB
      buffer.appendAtTail(data);

      let result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(65);

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(0x0A); // LF as raw byte

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(66);
    });

    it('should store and retrieve CRLF as raw data bytes', () => {
      const data = new Uint8Array([65, 0x0D, 0x0A, 66]); // A\r\nB
      buffer.appendAtTail(data);

      let result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(65);

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(0x0D); // CR as raw byte

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(0x0A); // LF as raw byte

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(66);
    });

    it('should treat lone CR as data', () => {
      const data = new Uint8Array([65, 0x0D, 66]); // A\rB
      buffer.appendAtTail(data);

      let result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(65);

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(0x0D);

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(66);
    });

    it('should handle raw bytes at buffer boundary', () => {
      // Fill buffer to near capacity
      const fillSize = 16382;
      const fillData = new Uint8Array(fillSize);
      fillData.fill(65); // Fill with 'A'
      buffer.appendAtTail(fillData);

      // Add CRLF that wraps around
      const eolData = new Uint8Array([0x0D, 0x0A]);
      buffer.appendAtTail(eolData);

      // Consume fill data
      for (let i = 0; i < fillSize; i++) {
        buffer.next();
      }

      // Should read raw bytes properly
      let result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(0x0D);

      result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(0x0A);
    });
  });

  describe('Wrap-Around Handling', () => {
    it('should handle wrap-around transparently', () => {
      // Fill buffer halfway
      const firstData = new Uint8Array(8192);
      firstData.fill(65); // 'A'
      buffer.appendAtTail(firstData);

      // Consume half
      for (let i = 0; i < 4096; i++) {
        buffer.next();
      }

      // Add more data that will wrap
      const secondData = new Uint8Array(8192);
      secondData.fill(66); // 'B'
      buffer.appendAtTail(secondData);

      // Should read remaining As then Bs
      for (let i = 0; i < 4096; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(65);
      }

      for (let i = 0; i < 8192; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(66);
      }

      const result = buffer.next();
      expect(result.status).toBe(NextStatus.EMPTY);
    });

    it('should calculate space correctly with wrap-around', () => {
      // Fill and consume to create wrap scenario
      const data1 = new Uint8Array(10000);
      buffer.appendAtTail(data1);
      
      // Consume 8000 bytes
      for (let i = 0; i < 8000; i++) {
        buffer.next();
      }

      // Should have 2000 used, 1046576 available (1MB - 2000)
      expect(buffer.getUsedSpace()).toBe(2000);
      expect(buffer.getAvailableSpace()).toBe(1046576);

      // Add more data
      const data2 = new Uint8Array(5000);
      const result = buffer.appendAtTail(data2);
      expect(result).toBe(true);
      expect(buffer.getUsedSpace()).toBe(7000);
    });

    it('should handle multiple wrap-arounds', () => {
      const chunkSize = 1000;
      const chunk = new Uint8Array(chunkSize);
      
      // Do multiple cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        chunk.fill(cycle);
        
        // Fill buffer
        for (let i = 0; i < 16; i++) {
          const result = buffer.appendAtTail(chunk);
          expect(result).toBe(true);
        }

        // Consume all
        for (let i = 0; i < 16000; i++) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(cycle);
        }

        expect(buffer.next().status).toBe(NextStatus.EMPTY);
      }
    });
  });

  describe('Position Management', () => {

    it('should save and restore position', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      buffer.appendAtTail(data);

      // Read first two
      buffer.next();
      buffer.next();

      // Save position
      buffer.savePosition();

      // Read more
      buffer.next();
      buffer.next();

      // Restore
      const restored = buffer.restorePosition();
      expect(restored).toBe(true);

      // Should be back at position 2
      const result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(3);
    });


    it('should handle multiple saved positions', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      buffer.appendAtTail(data);

      buffer.next(); // Read 1
      buffer.savePosition();
      
      buffer.next(); // Read 2
      buffer.savePosition();
      
      buffer.next(); // Read 3

      // Restore to position 2
      buffer.restorePosition();
      expect(buffer.next().value).toBe(3);

      // Restore to position 1
      buffer.restorePosition();
      expect(buffer.next().value).toBe(2);
    });
  });

  describe('Utility Methods', () => {


    it('should consume bytes correctly', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      buffer.appendAtTail(data);

      const consumed = buffer.consume(3);
      expect(consumed).toBe(true);

      // Should start at 4
      expect(buffer.next().value).toBe(4);
    });

    it('should handle consume with wrap-around', () => {
      // Create wrap scenario
      const data1 = new Uint8Array(10000);
      data1.fill(1);
      buffer.appendAtTail(data1);
      
      buffer.consume(9000); // Consume most
      
      const data2 = new Uint8Array(8000);
      data2.fill(2);
      buffer.appendAtTail(data2);

      // Now have 1000 of '1' and 8000 of '2', wrapped
      const consumed = buffer.consume(1000);
      expect(consumed).toBe(true);

      // Should now read '2's
      expect(buffer.next().value).toBe(2);
    });

    it('should return correct stats', () => {
      const data = new Uint8Array([1, 2, 3]);
      buffer.appendAtTail(data);

      buffer.next(); // Consume one byte

      const stats = buffer.getStats();
      expect(stats.size).toBe(1048576);
      expect(stats.used).toBe(2);
      expect(stats.available).toBe(1048574);
      expect(stats.used > 0).toBe(true); // Buffer not empty
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty buffer operations', () => {
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
      expect(buffer.consume(1)).toBe(false);
      expect(buffer.restorePosition()).toBe(false);
    });

    it('should handle full buffer correctly', () => {
      const fullData = new Uint8Array(1048576);
      fullData.fill(42);
      
      const result = buffer.appendAtTail(fullData);
      expect(result).toBe(true);
      
      // Should reject any more data
      const moreData = new Uint8Array([1]);
      expect(buffer.appendAtTail(moreData)).toBe(false);

      // But should accept after consuming some
      buffer.consume(100);
      expect(buffer.appendAtTail(moreData)).toBe(true);
    });

    it('should handle rapid fill/drain cycles', () => {
      const chunk = new Uint8Array(100);
      chunk.fill(77);

      for (let i = 0; i < 1000; i++) {
        buffer.appendAtTail(chunk);
        
        for (let j = 0; j < 100; j++) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(77);
        }
      }

      expect(buffer.getUsedSpace()).toBe(0);
    });
  });
});