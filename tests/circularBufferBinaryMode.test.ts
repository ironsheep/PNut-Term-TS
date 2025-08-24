/** @format */

// tests/circularBufferBinaryMode.test.ts
// Test binary data mode with EOL detection disabled

import { CircularBuffer, NextStatus } from '../src/classes/shared/circularBuffer';

describe('CircularBuffer Binary Mode - EOL Detection Control', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer();
  });

  describe('EOL Detection Control', () => {
    it('should have EOL detection enabled by default', () => {
      expect(buffer.isEolDetectionEnabled()).toBe(true);
    });

    it('should allow disabling EOL detection for binary mode', () => {
      buffer.setEolDetection(false);
      expect(buffer.isEolDetectionEnabled()).toBe(false);
    });

    it('should treat LF as data when EOL detection is disabled', () => {
      buffer.setEolDetection(false);
      
      const testData = new Uint8Array([1, 2, 3, 0x0A, 5, 6]); // Include LF byte
      buffer.appendAtTail(testData);
      
      // All bytes should be returned as DATA
      const expected = [1, 2, 3, 0x0A, 5, 6];
      for (const expectedValue of expected) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(expectedValue);
      }
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should treat CRLF as data when EOL detection is disabled', () => {
      buffer.setEolDetection(false);
      
      const testData = new Uint8Array([65, 0x0D, 0x0A, 66]); // A\r\nB
      buffer.appendAtTail(testData);
      
      // All bytes should be returned as DATA
      expect(buffer.next().value).toBe(65);
      expect(buffer.next().value).toBe(0x0D);
      expect(buffer.next().value).toBe(0x0A);
      expect(buffer.next().value).toBe(66);
    });

    it('should still detect EOL when enabled (default behavior)', () => {
      // EOL detection enabled by default
      const testData = new Uint8Array([65, 0x0A, 66]); // A\nB
      buffer.appendAtTail(testData);
      
      expect(buffer.next().value).toBe(65);
      
      const eol = buffer.next();
      expect(eol.status).toBe(NextStatus.EOL);
      expect(eol.length).toBe(1);
      
      expect(buffer.next().value).toBe(66);
    });
  });

  describe('Binary Data Preservation', () => {
    it('should preserve the exact orphaned bytes test data in binary mode', () => {
      buffer.setEolDetection(false); // Disable EOL detection
      
      // The exact test that was failing
      const messages = [
        new Uint8Array([1, 2, 3, 4, 5]),        // 5 bytes
        new Uint8Array([10, 11, 12]),           // 3 bytes (10 = 0x0A was causing EOL detection!)
        new Uint8Array([20, 21, 22, 23, 24, 25, 26])  // 7 bytes
      ];
      
      let totalExpected = 0;
      messages.forEach(msg => {
        expect(buffer.appendAtTail(msg)).toBe(true);
        totalExpected += msg.length;
      });
      
      // Read all data as binary
      const actualData: number[] = [];
      let result = buffer.next();
      while (result.status === NextStatus.DATA) {
        actualData.push(result.value!);
        result = buffer.next();
      }
      
      // Should now get all 15 bytes!
      expect(actualData.length).toBe(15);
      expect(actualData).toEqual([1, 2, 3, 4, 5, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26]);
    });

    it('should preserve P2 binary packets with embedded EOL bytes', () => {
      buffer.setEolDetection(false);
      
      // P2 packet with embedded LF/CR bytes
      const binaryPacket = new Uint8Array([
        0xAA, 0xBB, // Header
        0x40, 0x2F, 0x40, 0x2F, // The corruption pattern user reported
        0x01, 0x0A, 0x0D, 0x02, // Embedded LF/CR 
        0x80, 0x81, 0x82, 0x83, // High-bit bytes
        0xFF, 0xFE, 0xFD, 0xFC  // More high-bit bytes
      ]);
      
      expect(buffer.appendAtTail(binaryPacket)).toBe(true);
      
      // Read back all bytes - should be identical
      const actualBytes: number[] = [];
      let result = buffer.next();
      while (result.status === NextStatus.DATA) {
        actualBytes.push(result.value!);
        result = buffer.next();
      }
      
      expect(actualBytes.length).toBe(binaryPacket.length);
      expect(actualBytes).toEqual(Array.from(binaryPacket));
    });
  });

  describe('Mode Switching', () => {
    it('should allow switching between text and binary modes', () => {
      // Start in text mode (default)
      const textData = new Uint8Array([65, 0x0A, 66]); // A\nB
      buffer.appendAtTail(textData);
      
      expect(buffer.next().value).toBe(65);
      const eol = buffer.next();
      expect(eol.status).toBe(NextStatus.EOL);
      expect(buffer.next().value).toBe(66);
      
      // Switch to binary mode
      buffer.setEolDetection(false);
      const binaryData = new Uint8Array([67, 0x0A, 68]); // C\nD (but treated as binary)
      buffer.appendAtTail(binaryData);
      
      expect(buffer.next().value).toBe(67);
      expect(buffer.next().value).toBe(0x0A); // Should be DATA, not EOL
      expect(buffer.next().value).toBe(68);
    });
  });
});