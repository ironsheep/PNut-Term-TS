/** @format */

// tests/circularBufferScaling.test.ts
// TEST: Buffer Size Scaling and P2 Data Rate Validation

import { CircularBuffer, NextStatus, NextResult } from '../src/classes/shared/circularBuffer';

describe('CircularBuffer Scaling Tests - 1MB Buffer Validation', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer(); // Default 1MB
  });

  describe('P2 Data Rate Simulation', () => {
    it('should handle 2Mbps burst for 4 seconds (1MB capacity)', () => {
      // P2 at 2Mbps = 250KB/sec, 4 seconds = 1MB total
      const burstSize = 1048576; // Exactly 1MB
      const testData = new Uint8Array(burstSize);
      
      // Fill with recognizable pattern
      for (let i = 0; i < burstSize; i++) {
        testData[i] = i % 256;
      }
      
      // Should accept exactly 1MB
      expect(buffer.appendAtTail(testData)).toBe(true);
      expect(buffer.getUsedSpace()).toBe(burstSize);
      expect(buffer.getAvailableSpace()).toBe(0);
      
      // Should reject any overflow
      const overflow = new Uint8Array([0xFF]);
      expect(buffer.appendAtTail(overflow)).toBe(false);
      
      // Verify data integrity at scale
      for (let i = 0; i < burstSize; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(i % 256);
      }
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle streaming P2 data with consumption', () => {
      // Simulate 10 seconds of P2 data with consumption
      const chunkSize = 100000; // 100KB chunks
      const totalChunks = 50; // 5MB total over time
      
      for (let chunkNum = 0; chunkNum < totalChunks; chunkNum++) {
        // Create chunk with unique pattern
        const chunk = new Uint8Array(chunkSize);
        chunk.fill(chunkNum % 256);
        
        // Append chunk
        expect(buffer.appendAtTail(chunk)).toBe(true);
        
        // Consume chunk immediately (streaming processing)
        for (let i = 0; i < chunkSize; i++) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(chunkNum % 256);
        }
      }
      
      // Buffer should be empty after streaming processing
      expect(buffer.getUsedSpace()).toBe(0);
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });
  });

  describe('P2 Binary Pattern Simulation at Scale', () => {
    it('should handle thousands of 80-byte debugger packets', () => {
      const packetCount = 10000; // 800KB of debugger data
      const packetSize = 80;
      const totalSize = packetCount * packetSize;
      
      // Should fit in 1MB buffer
      expect(totalSize).toBeLessThan(1048576);
      
      // Generate all packets with COG patterns
      for (let packetNum = 0; packetNum < packetCount; packetNum++) {
        const packet = new Uint8Array(packetSize);
        
        // COG ID in first 4 bytes (little-endian)
        const cogId = packetNum % 8; // COG 0-7
        packet[0] = cogId;
        packet[1] = 0;
        packet[2] = 0; 
        packet[3] = 0;
        
        // Fill with debugger data pattern
        for (let i = 4; i < packetSize; i++) {
          packet[i] = (i * packetNum) & 0xFF;
        }
        
        expect(buffer.appendAtTail(packet)).toBe(true);
      }
      
      expect(buffer.getUsedSpace()).toBe(totalSize);
      
      // Verify all packets with integrity
      for (let packetNum = 0; packetNum < packetCount; packetNum++) {
        const cogId = packetNum % 8;
        
        // Check COG ID
        expect(buffer.next().value).toBe(cogId);
        expect(buffer.next().value).toBe(0);
        expect(buffer.next().value).toBe(0);
        expect(buffer.next().value).toBe(0);
        
        // Check data payload
        for (let i = 4; i < packetSize; i++) {
          const expected = (i * packetNum) & 0xFF;
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(expected);
        }
      }
    });

    it('should handle mixed COG text messages at scale', () => {
      // Simulate thousands of COG messages
      const messageCount = 5000;
      const messages = [];
      
      for (let i = 0; i < messageCount; i++) {
        const cogId = i % 8;
        const message = `Cog${cogId}: Message ${i} with data\r\n`;
        messages.push(new TextEncoder().encode(message));
      }
      
      // Calculate total size
      const totalSize = messages.reduce((sum, msg) => sum + msg.length, 0);
      expect(totalSize).toBeLessThan(1048576); // Should fit in 1MB
      
      // Append all messages
      messages.forEach((msg, index) => {
        const success = buffer.appendAtTail(msg);
        expect(success).toBe(true);
      });
      
      // Verify by reconstructing messages
      let messageIndex = 0;
      let byteIndex = 0;
      
      while (buffer.hasData() && messageIndex < messageCount) {
        const currentMessage = messages[messageIndex];
        const result = buffer.next();
        
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(currentMessage[byteIndex]);
        
        byteIndex++;
        if (byteIndex >= currentMessage.length) {
          messageIndex++;
          byteIndex = 0;
        }
      }
      
      expect(messageIndex).toBe(messageCount);
    });
  });

  describe('Memory and Performance Validation', () => {
    it('should initialize 1MB buffer quickly', () => {
      const startTime = performance.now();
      const testBuffer = new CircularBuffer(); // 1MB default
      const initTime = performance.now() - startTime;
      
      // Should initialize in reasonable time (< 10ms)
      expect(initTime).toBeLessThan(10);
      expect(testBuffer.getBufferSize()).toBe(1048576);
      expect(testBuffer.getAvailableSpace()).toBe(1048576);
    });

    it('should handle rapid fill/drain cycles with large buffer', () => {
      const chunkSize = 50000; // 50KB chunks
      const cycles = 100;
      
      const startTime = performance.now();
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        // Fill with chunk
        const chunk = new Uint8Array(chunkSize);
        chunk.fill(cycle % 256);
        
        expect(buffer.appendAtTail(chunk)).toBe(true);
        
        // Drain chunk
        for (let i = 0; i < chunkSize; i++) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(cycle % 256);
        }
      }
      
      const totalTime = performance.now() - startTime;
      const throughput = (cycles * chunkSize) / (totalTime / 1000); // bytes/sec
      
      // Should handle significant throughput (> 10MB/sec)
      expect(throughput).toBeGreaterThan(10000000);
      expect(buffer.getUsedSpace()).toBe(0);
    });

    it('should maintain consistent performance across buffer positions', () => {
      // Test performance at different buffer positions
      const testPositions = [0, 262144, 524288, 786432]; // 0, 256KB, 512KB, 768KB
      const chunkSize = 10000;
      const performanceTimes = [];
      
      for (const position of testPositions) {
        // Position buffer by consuming
        if (position > 0) {
          const positionData = new Uint8Array(position);
          positionData.fill(0xAA);
          buffer.appendAtTail(positionData);
          buffer.consume(position);
        }
        
        // Time chunk processing
        const testData = new Uint8Array(chunkSize);
        testData.fill(0xBB);
        
        const startTime = performance.now();
        buffer.appendAtTail(testData);
        
        for (let i = 0; i < chunkSize; i++) {
          buffer.next();
        }
        
        const endTime = performance.now();
        performanceTimes.push(endTime - startTime);
        
        // Reset for next test
        buffer.clear();
      }
      
      // Performance should be consistent (variance < 50%)
      const avgTime = performanceTimes.reduce((sum, time) => sum + time, 0) / performanceTimes.length;
      performanceTimes.forEach(time => {
        const variance = Math.abs(time - avgTime) / avgTime;
        expect(variance).toBeLessThan(0.5); // < 50% variance
      });
    });
  });

  describe('Extreme Edge Cases at Scale', () => {
    it('should handle maximum single append (1MB - 1 byte)', () => {
      const maxSingleAppend = 1048575; // 1MB - 1 byte
      const largeData = new Uint8Array(maxSingleAppend);
      
      // Fill with pattern
      for (let i = 0; i < maxSingleAppend; i++) {
        largeData[i] = (i >> 16) & 0xFF; // High bits for variety
      }
      
      expect(buffer.appendAtTail(largeData)).toBe(true);
      expect(buffer.getAvailableSpace()).toBe(1);
      
      // Should reject even 1 more byte
      const oneByte = new Uint8Array([0xFF]);
      expect(buffer.appendAtTail(oneByte)).toBe(false);
      
      // Verify all data
      for (let i = 0; i < maxSingleAppend; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe((i >> 16) & 0xFF);
      }
    });

    it('should handle wrap-around with nearly full buffer', () => {
      // Fill buffer to 90% capacity
      const fillSize = Math.floor(1048576 * 0.9); // 943,718 bytes
      const fillData = new Uint8Array(fillSize);
      fillData.fill(0x11);
      buffer.appendAtTail(fillData);
      
      // Consume 50% to create wrap scenario
      const consumeSize = Math.floor(fillSize * 0.5);
      buffer.consume(consumeSize);
      
      // Add data that will wrap around
      const wrapSize = Math.floor(1048576 * 0.4); // 419,430 bytes
      const wrapData = new Uint8Array(wrapSize);
      wrapData.fill(0x22);
      
      expect(buffer.appendAtTail(wrapData)).toBe(true);
      
      // Verify remaining original data
      const remainingOriginal = fillSize - consumeSize;
      for (let i = 0; i < remainingOriginal; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(0x11);
      }
      
      // Verify wrapped data
      for (let i = 0; i < wrapSize; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(0x22);
      }
    });
  });
});