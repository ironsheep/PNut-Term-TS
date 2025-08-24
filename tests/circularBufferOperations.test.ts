/** @format */

// tests/circularBufferOperationsTest.ts
// TEST 2: Higher-level Buffer Operations & Data Integrity

import { CircularBuffer, NextStatus, NextResult } from '../src/classes/shared/circularBuffer';

describe('CircularBuffer Operations Tests - Data Integrity', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer();
  });

  describe('AppendAtTail Functionality', () => {
    it('should append data sequentially without gaps', () => {
      const message1 = new Uint8Array([0x01, 0x02, 0x03]);
      const message2 = new Uint8Array([0x04, 0x05, 0x06]);
      const message3 = new Uint8Array([0x07, 0x08, 0x09]);
      
      expect(buffer.appendAtTail(message1)).toBe(true);
      expect(buffer.appendAtTail(message2)).toBe(true);
      expect(buffer.appendAtTail(message3)).toBe(true);
      
      // Verify perfect sequential reading
      const expected = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09];
      for (let i = 0; i < expected.length; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(expected[i]);
      }
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should append variable-sized messages perfectly', () => {
      const messages = [
        new Uint8Array([0x10]),
        new Uint8Array([0x20, 0x21, 0x22, 0x23]),
        new Uint8Array([]),  // Zero-length message
        new Uint8Array([0x30, 0x31]),
        new Uint8Array([0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49])
      ];
      
      messages.forEach(msg => {
        expect(buffer.appendAtTail(msg)).toBe(true);
      });
      
      // Verify continuous data stream
      const expected = [0x10, 0x20, 0x21, 0x22, 0x23, 0x30, 0x31, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49];
      for (let i = 0; i < expected.length; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(expected[i]);
      }
    });

    it('should handle buffer near-capacity scenarios', () => {
      // Buffer has full capacity (no reserved bytes with isEmpty flag)
      const maxCapacity = 1048576;
      const nearFull = new Uint8Array(maxCapacity);
      for (let i = 0; i < maxCapacity; i++) {
        nearFull[i] = i % 256;
      }
      
      expect(buffer.appendAtTail(nearFull)).toBe(true);
      
      // Should now be at capacity - any more should be rejected
      const overflow = new Uint8Array([0xFF]);
      expect(buffer.appendAtTail(overflow)).toBe(false);
      
      // Verify all data is intact
      for (let i = 0; i < maxCapacity; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(i % 256);
      }
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle wrap-around appends correctly', () => {
      // Create wrap scenario
      const initialFill = new Uint8Array(12000);
      initialFill.fill(0xAA);
      buffer.appendAtTail(initialFill);
      
      // Consume 8000 bytes to create space at front
      for (let i = 0; i < 8000; i++) {
        buffer.next();
      }
      
      // Now add data that will wrap around
      const wrapData = new Uint8Array(8000);
      wrapData.fill(0xBB);
      expect(buffer.appendAtTail(wrapData)).toBe(true);
      
      // Verify remaining AA bytes
      for (let i = 0; i < 4000; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(0xAA);
      }
      
      // Verify wrapped BB bytes
      for (let i = 0; i < 8000; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(0xBB);
      }
    });
  });

  describe('Consume Operation Integrity', () => {
    it('should consume bytes accurately without corruption', () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      buffer.appendAtTail(testData);
      
      // Consume first 3 bytes
      expect(buffer.consume(3)).toBe(true);
      
      // Verify remaining data starts at 4
      expect(buffer.next().value).toBe(4);
      expect(buffer.next().value).toBe(5);
      
      // Consume 2 more
      expect(buffer.consume(2)).toBe(true);
      
      // Should continue at 8
      expect(buffer.next().value).toBe(8);
      expect(buffer.next().value).toBe(9);
      expect(buffer.next().value).toBe(10);
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle consume across buffer wrap', () => {
      // Create wrap scenario
      const data1 = new Uint8Array(10000);
      data1.fill(0x11);
      buffer.appendAtTail(data1);
      
      // Consume most of it to position near end
      buffer.consume(9000);
      
      // Add more data that will wrap
      const data2 = new Uint8Array(8000);
      data2.fill(0x22);
      buffer.appendAtTail(data2);
      
      // Consume remaining 0x11 bytes
      buffer.consume(1000);
      
      // Should now be reading 0x22 bytes from wrapped area
      for (let i = 0; i < 8000; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(0x22);
      }
    });

    it('should reject invalid consume operations', () => {
      const data = new Uint8Array([1, 2, 3]);
      buffer.appendAtTail(data);
      
      // Try to consume more than available
      expect(buffer.consume(5)).toBe(false);
      
      // Data should be unchanged
      expect(buffer.next().value).toBe(1);
      expect(buffer.next().value).toBe(2);
      expect(buffer.next().value).toBe(3);
    });
  });

  describe('Message Splitting & Reconstruction', () => {
    it('should split messages without data loss', () => {
      // Create a recognizable pattern: header + data + footer
      const originalMessage = new Uint8Array([
        0xAA, 0xBB, 0xCC, 0xDD,  // Header
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,  // Data
        0xEE, 0xFF  // Footer
      ]);
      
      buffer.appendAtTail(originalMessage);
      
      // Split off first 4 bytes (header)
      const headerBytes = [];
      for (let i = 0; i < 4; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        headerBytes.push(result.value!);
      }
      expect(headerBytes).toEqual([0xAA, 0xBB, 0xCC, 0xDD]);
      
      // Verify remaining message is intact in buffer
      const dataBytes = [];
      for (let i = 0; i < 8; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        dataBytes.push(result.value!);
      }
      expect(dataBytes).toEqual([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
      
      // Verify footer is intact
      const footerBytes = [];
      for (let i = 0; i < 2; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        footerBytes.push(result.value!);
      }
      expect(footerBytes).toEqual([0xEE, 0xFF]);
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle message splitting across wrap boundary', () => {
      // Create near-end scenario
      const fillData = new Uint8Array(16380);  // Almost full
      fillData.fill(0x55);
      buffer.appendAtTail(fillData);
      
      // Consume most to get near end
      buffer.consume(16376);
      
      // Add message that will wrap
      const wrappingMessage = new Uint8Array([0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8]);
      buffer.appendAtTail(wrappingMessage);
      
      // Consume remaining fill data
      buffer.consume(4);
      
      // Now split the wrapped message
      const firstPart = [];
      for (let i = 0; i < 3; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        firstPart.push(result.value!);
      }
      expect(firstPart).toEqual([0xA1, 0xA2, 0xA3]);
      
      const secondPart = [];
      for (let i = 0; i < 5; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        secondPart.push(result.value!);
      }
      expect(secondPart).toEqual([0xA4, 0xA5, 0xA6, 0xA7, 0xA8]);
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should reconstruct split messages identically', () => {
      const originalMessage = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        originalMessage[i] = i + 1;  // Values 1-100
      }
      
      buffer.appendAtTail(originalMessage);
      
      // Split into chunks and reconstruct
      const reconstructed: number[] = [];
      const chunkSizes = [10, 15, 20, 25, 30];
      
      for (const chunkSize of chunkSizes) {
        // Read chunk directly
        for (let i = 0; i < chunkSize; i++) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          reconstructed.push(result.value!);
        }
      }
      
      // Verify perfect reconstruction
      expect(reconstructed.length).toBe(100);
      for (let i = 0; i < 100; i++) {
        expect(reconstructed[i]).toBe(i + 1);
      }
    });
  });

  describe('Data Integrity Under Stress', () => {
    it('should maintain data integrity through rapid operations', () => {
      const iterations = 100;
      const messageSize = 50;
      
      for (let iteration = 0; iteration < iterations; iteration++) {
        // Create unique message for this iteration
        const message = new Uint8Array(messageSize);
        message.fill(iteration % 256);
        
        buffer.appendAtTail(message);
        
        // Verify message immediately
        for (let i = 0; i < messageSize; i++) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(iteration % 256);
        }
      }
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle interleaved append/consume without corruption', () => {
      const pattern = [0x10, 0x20, 0x30, 0x40, 0x50];
      
      for (let cycle = 0; cycle < 1000; cycle++) {
        // Append pattern
        const message = new Uint8Array(pattern.map(b => b + (cycle % 16)));
        buffer.appendAtTail(message);
        
        // Consume first 2 bytes
        const first = buffer.next();
        const second = buffer.next();
        
        expect(first.status).toBe(NextStatus.DATA);
        expect(second.status).toBe(NextStatus.DATA);
        expect(first.value).toBe(0x10 + (cycle % 16));
        expect(second.value).toBe(0x20 + (cycle % 16));
        
        // Consume remaining 3 bytes
        buffer.consume(3);
      }
    });

    it('should detect and prevent buffer overflow corruption', () => {
      // Fill buffer to capacity
      const maxData = new Uint8Array(1048576);
      for (let i = 0; i < 1048576; i++) {
        maxData[i] = i % 256;
      }
      
      expect(buffer.appendAtTail(maxData)).toBe(true);
      
      // Any additional append should fail
      const overflow = new Uint8Array([0xFF]);
      expect(buffer.appendAtTail(overflow)).toBe(false);
      
      // Original data should be completely intact
      for (let i = 0; i < 1048576; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(i % 256);
      }
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });
  });

  describe('P2 Binary Protocol Simulation', () => {
    it('should handle 80-byte P2 debugger packets without corruption', () => {
      // Simulate P2 80-byte binary debugger packets
      const packetCount = 100;
      const packetSize = 80;
      
      // Create packets with recognizable patterns
      for (let packetNum = 0; packetNum < packetCount; packetNum++) {
        const packet = new Uint8Array(packetSize);
        
        // Packet header
        packet[0] = 0xAA;
        packet[1] = 0xBB;
        packet[2] = packetNum & 0xFF;
        packet[3] = (packetNum >> 8) & 0xFF;
        
        // Data payload (simulate the corruption-prone patterns)
        for (let i = 4; i < packetSize - 2; i++) {
          packet[i] = (i * packetNum) & 0xFF;
        }
        
        // Footer
        packet[packetSize - 2] = 0xEE;
        packet[packetSize - 1] = 0xFF;
        
        expect(buffer.appendAtTail(packet)).toBe(true);
      }
      
      // Verify all packets are intact
      for (let packetNum = 0; packetNum < packetCount; packetNum++) {
        // Check header
        expect(buffer.next().value).toBe(0xAA);
        expect(buffer.next().value).toBe(0xBB);
        expect(buffer.next().value).toBe(packetNum & 0xFF);
        expect(buffer.next().value).toBe((packetNum >> 8) & 0xFF);
        
        // Check data payload
        for (let i = 4; i < packetSize - 2; i++) {
          const expected = (i * packetNum) & 0xFF;
          const actual = buffer.next().value;
          expect(actual).toBe(expected);
        }
        
        // Check footer
        expect(buffer.next().value).toBe(0xEE);
        expect(buffer.next().value).toBe(0xFF);
      }
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle high-bit data without MSB corruption', () => {
      // Test specifically for the $40/$2F corruption pattern
      // Focus on bytes > 0x7F (MSB set)
      const highBitData = new Uint8Array([
        0x80, 0x81, 0x82, 0x83,  // High bit patterns
        0xFF, 0xFE, 0xFD, 0xFC,  // All high bits
        0x40, 0x2F, 0x40, 0x2F,  // The specific corruption pattern reported
        0xC0, 0xAF, 0x90, 0x8F   // More high bit variations
      ]);
      
      buffer.appendAtTail(highBitData);
      
      // Verify each byte exactly
      const expected = [0x80, 0x81, 0x82, 0x83, 0xFF, 0xFE, 0xFD, 0xFC, 0x40, 0x2F, 0x40, 0x2F, 0xC0, 0xAF, 0x90, 0x8F];
      for (let i = 0; i < expected.length; i++) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(expected[i]);
      }
    });
  });
});