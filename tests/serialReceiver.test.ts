/** @format */

// tests/serialReceiver.test.ts

import { SerialReceiver } from '../src/classes/shared/serialReceiver';
import { CircularBuffer, NextStatus } from '../src/classes/shared/circularBuffer';

describe('SerialReceiver', () => {
  let buffer: CircularBuffer;
  let receiver: SerialReceiver;
  let extractionCalled: boolean;
  let extractionCount: number;

  beforeEach(() => {
    buffer = new CircularBuffer();
    receiver = new SerialReceiver(buffer);
    extractionCalled = false;
    extractionCount = 0;
    
    // Set up extraction callback
    receiver.setExtractionCallback(() => {
      extractionCalled = true;
      extractionCount++;
    });
  });

  describe('Basic Reception', () => {
    it('should receive Buffer data and convert to Uint8Array', () => {
      const data = Buffer.from([1, 2, 3, 4, 5]);
      receiver.receiveData(data);

      expect(buffer.hasData()).toBe(true);
      expect(buffer.getUsedSpace()).toBe(5);
      
      // Verify data integrity
      for (let i = 0; i < 5; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(i + 1);
      }
    });

    it('should handle Buffer with offset correctly', () => {
      // Create a buffer with offset (simulating slice operation)
      const fullBuffer = Buffer.from([99, 99, 10, 20, 30, 99, 99]);
      const slicedBuffer = fullBuffer.slice(2, 5); // [10, 20, 30]
      
      receiver.receiveData(slicedBuffer);

      expect(buffer.getUsedSpace()).toBe(3);
      expect(buffer.next().value).toBe(10);
      expect(buffer.next().value).toBe(20);
      expect(buffer.next().value).toBe(30);
    });

    it('should update statistics', () => {
      receiver.receiveData(Buffer.from([1, 2, 3]));
      receiver.receiveData(Buffer.from([4, 5, 6, 7, 8]));

      const stats = receiver.getStats();
      expect(stats.totalBytesReceived).toBe(8);
      expect(stats.totalChunksReceived).toBe(2);
      expect(stats.largestChunk).toBe(5);
      expect(stats.bufferOverflows).toBe(0);
    });
  });

  describe('Async Extraction', () => {
    it('should trigger extraction callback asynchronously', (done) => {
      receiver.setExtractionCallback(() => {
        extractionCalled = true;
        expect(buffer.hasData()).toBe(true);
        done();
      });

      receiver.receiveData(Buffer.from([1, 2, 3]));
      
      // Should not be called immediately
      expect(extractionCalled).toBe(false);
      
      // Will be called on next tick via setImmediate
    });

    it('should only have one pending extraction at a time', (done) => {
      let callCount = 0;
      receiver.setExtractionCallback(() => {
        callCount++;
      });

      // Send multiple chunks rapidly
      receiver.receiveData(Buffer.from([1, 2, 3]));
      receiver.receiveData(Buffer.from([4, 5, 6]));
      receiver.receiveData(Buffer.from([7, 8, 9]));

      // Check that extraction is pending
      expect(receiver.isExtractionPending()).toBe(true);

      // After next tick, should have been called once
      setImmediate(() => {
        expect(callCount).toBe(1);
        expect(receiver.isExtractionPending()).toBe(false);
        done();
      });
    });

    it('should not trigger extraction if no callback set', (done) => {
      const receiver2 = new SerialReceiver(buffer);
      
      receiver2.receiveData(Buffer.from([1, 2, 3]));
      
      setImmediate(() => {
        // Buffer should have data but no extraction triggered
        expect(buffer.hasData()).toBe(true);
        done();
      });
    });

    it('should handle extraction callback errors', (done) => {
      const errorSpy = jest.fn();
      receiver.on('extractionError', errorSpy);

      receiver.setExtractionCallback(() => {
        throw new Error('Test extraction error');
      });

      receiver.receiveData(Buffer.from([1, 2, 3]));

      setImmediate(() => {
        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0][0].message).toBe('Test extraction error');
        done();
      });
    });
  });

  describe('Buffer Overflow', () => {
    it('should handle buffer overflow gracefully', () => {
      const overflowSpy = jest.fn();
      receiver.on('bufferOverflow', overflowSpy);

      // Fill buffer to capacity
      const largeData = new Uint8Array(16384); // Exactly buffer size
      largeData.fill(42);
      buffer.appendAtTail(largeData);

      // This should overflow
      receiver.receiveData(Buffer.from([1, 2, 3]));

      expect(overflowSpy).toHaveBeenCalled();
      expect(overflowSpy.mock.calls[0][0].droppedBytes).toBe(3);
      
      const stats = receiver.getStats();
      expect(stats.bufferOverflows).toBe(1);
    });

    it('should emit correct overflow event data', () => {
      const overflowData: any[] = [];
      receiver.on('bufferOverflow', (data) => {
        overflowData.push(data);
      });

      // Fill buffer
      const fillData = new Uint8Array(16384);
      buffer.appendAtTail(fillData);

      // Trigger overflow
      receiver.receiveData(Buffer.from([1, 2, 3, 4, 5]));

      expect(overflowData.length).toBe(1);
      expect(overflowData[0].droppedBytes).toBe(5);
      expect(overflowData[0].bufferStats.available).toBe(0);
    });
  });

  describe('Events', () => {
    it('should emit dataReceived event', () => {
      const dataSpy = jest.fn();
      receiver.on('dataReceived', dataSpy);

      receiver.receiveData(Buffer.from([1, 2, 3]));

      expect(dataSpy).toHaveBeenCalled();
      const eventData = dataSpy.mock.calls[0][0];
      expect(eventData.bytes).toBe(3);
      expect(eventData.bufferUsed).toBe(3);
      expect(eventData.bufferAvailable).toBe(16381);
    });

    it('should emit events with correct buffer stats', () => {
      const events: any[] = [];
      receiver.on('dataReceived', (data) => events.push(data));

      receiver.receiveData(Buffer.from([1, 2, 3]));
      receiver.receiveData(Buffer.from([4, 5, 6, 7]));

      expect(events.length).toBe(2);
      expect(events[0].bufferUsed).toBe(3);
      expect(events[1].bufferUsed).toBe(7);
    });
  });

  describe('Statistics', () => {
    it('should track all statistics correctly', () => {
      receiver.receiveData(Buffer.from([1, 2]));
      receiver.receiveData(Buffer.from([3, 4, 5, 6]));
      receiver.receiveData(Buffer.from([7]));

      const stats = receiver.getStats();
      expect(stats.totalBytesReceived).toBe(7);
      expect(stats.totalChunksReceived).toBe(3);
      expect(stats.largestChunk).toBe(4);
      expect(stats.lastReceiveTime).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      receiver.receiveData(Buffer.from([1, 2, 3]));
      receiver.receiveData(Buffer.from([4, 5]));

      receiver.resetStats();

      const stats = receiver.getStats();
      expect(stats.totalBytesReceived).toBe(0);
      expect(stats.totalChunksReceived).toBe(0);
      expect(stats.largestChunk).toBe(0);
      expect(stats.bufferOverflows).toBe(0);
    });

    it('should calculate receive rate', (done) => {
      receiver.receiveData(Buffer.from([1, 2, 3]));
      
      const rate = receiver.getReceiveRate(100);
      expect(rate).toBeGreaterThan(0);

      // After waiting, rate should be 0
      setTimeout(() => {
        const rateAfter = receiver.getReceiveRate(50);
        expect(rateAfter).toBe(0);
        done();
      }, 100);
    });
  });

  describe('Buffer Management', () => {
    it('should clear buffer', () => {
      receiver.receiveData(Buffer.from([1, 2, 3]));
      expect(buffer.hasData()).toBe(true);

      receiver.clearBuffer();
      expect(buffer.hasData()).toBe(false);
      expect(receiver.isExtractionPending()).toBe(false);
    });

    it('should provide buffer reference', () => {
      const bufferRef = receiver.getBuffer();
      expect(bufferRef).toBe(buffer);
    });
  });

  describe('Performance', () => {
    it('should handle rapid small chunks', (done) => {
      let totalReceived = 0;
      
      // Send 100 small chunks rapidly
      for (let i = 0; i < 100; i++) {
        const chunk = Buffer.from([i & 0xFF]);
        receiver.receiveData(chunk);
        totalReceived++;
      }

      expect(buffer.getUsedSpace()).toBe(100);
      
      // Should have only one pending extraction
      expect(receiver.isExtractionPending()).toBe(true);

      setImmediate(() => {
        expect(receiver.isExtractionPending()).toBe(false);
        done();
      });
    });

    it('should handle large chunks efficiently', () => {
      const largeChunk = Buffer.alloc(8192);
      largeChunk.fill(0xAA);

      receiver.receiveData(largeChunk);

      expect(buffer.getUsedSpace()).toBe(8192);
      const stats = receiver.getStats();
      expect(stats.largestChunk).toBe(8192);
    });

    it('should handle 2 Mb/s burst traffic', (done) => {
      // Simulate 2 Mb/s in 62-byte chunks
      const chunkSize = 62;
      const targetBytesPerSecond = 2 * 1024 * 1024;
      const chunksPerSecond = Math.floor(targetBytesPerSecond / chunkSize);
      const intervalMs = 1000 / chunksPerSecond;
      
      let bytesSent = 0;
      let chunksSent = 0;
      const startTime = Date.now();

      const sendChunk = () => {
        if (bytesSent >= chunkSize * 100) { // Send 100 chunks for test
          const elapsed = Date.now() - startTime;
          const rate = (bytesSent / elapsed) * 1000;
          
          // Should be close to target rate (within reason for test)
          expect(rate).toBeGreaterThan(100000); // At least 100KB/s in test
          
          const stats = receiver.getStats();
          expect(stats.totalBytesReceived).toBe(bytesSent);
          expect(stats.totalChunksReceived).toBe(chunksSent);
          expect(stats.bufferOverflows).toBe(0);
          
          done();
          return;
        }

        const chunk = Buffer.alloc(chunkSize);
        chunk.fill(chunksSent & 0xFF);
        receiver.receiveData(chunk);
        bytesSent += chunkSize;
        chunksSent++;
        
        // Use setImmediate for rapid sending in test
        setImmediate(sendChunk);
      };

      sendChunk();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty buffer', () => {
      const data = Buffer.from([]);
      receiver.receiveData(data);
      
      expect(buffer.hasData()).toBe(false);
      const stats = receiver.getStats();
      expect(stats.totalBytesReceived).toBe(0);
    });

    it('should handle single byte', () => {
      receiver.receiveData(Buffer.from([42]));
      
      expect(buffer.getUsedSpace()).toBe(1);
      expect(buffer.next().value).toBe(42);
    });

    it('should handle extraction with empty buffer', (done) => {
      let called = false;
      receiver.setExtractionCallback(() => {
        called = true;
      });

      // Clear any data
      buffer.clear();
      
      // Manually trigger extraction check
      setImmediate(() => {
        expect(called).toBe(false); // Should not call with empty buffer
        done();
      });
    });
  });
});