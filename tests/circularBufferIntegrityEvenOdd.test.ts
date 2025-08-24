/** @format */

// tests/circularBufferIntegrityEvenOdd.test.ts  
// TEST 1 with Even/Odd Buffer Sizes - Algorithm Robustness Check

import { CircularBuffer, NextStatus, NextResult } from '../src/classes/shared/circularBuffer';

// Test suite runner for different buffer sizes
function runIntegrityTestsWithBufferSize(bufferSize: number, description: string) {
  describe(`${description} (${bufferSize} bytes)`, () => {
    let buffer: CircularBuffer;

    beforeEach(() => {
      buffer = new CircularBuffer(bufferSize);
    });

    describe('Raw Byte Storage With EOL Characters', () => {
      it('should store and retrieve EOL bytes as raw data', () => {
        // Test data with EOL byte patterns - buffer should treat as raw bytes
        const testData = new Uint8Array([
          // Pattern 1: \\n (LF only)
          65, 0x0A,
          // Pattern 2: \\r\\n (CRLF) 
          66, 0x0D, 0x0A,
          // Pattern 3: \\r (CR only)
          67, 0x0D,
          // Pattern 4: \\n\\r (LFCR)
          68, 0x0A, 0x0D,
          // Pattern 5: Double LF
          69, 0x0A, 0x0A
        ]);
        
        buffer.appendAtTail(testData);
        
        // CircularBuffer should return all bytes as raw data, no EOL detection
        const expected = [65, 0x0A, 66, 0x0D, 0x0A, 67, 0x0D, 68, 0x0A, 0x0D, 69, 0x0A, 0x0A];
        for (const expectedByte of expected) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(expectedByte);
        }
        
        expect(buffer.next().status).toBe(NextStatus.EMPTY);
      });

      it('should handle raw bytes across buffer boundaries', () => {
        // Create wrap scenario for this buffer size
        const fillSize = bufferSize - 10;
        const fillData = new Uint8Array(fillSize);
        fillData.fill(65); // Fill with 'A'
        buffer.appendAtTail(fillData);
        
        // Consume most data to create wrap scenario, leave 5 A's
        const consumeCount = fillSize - 5;
        for (let i = 0; i < consumeCount; i++) {
          buffer.next();
        }
        
        // Now add bytes that span the boundary (including EOL characters)
        const boundaryData = new Uint8Array([66, 0x0D, 0x0A, 67]); // B\r\nC as raw bytes
        buffer.appendAtTail(boundaryData);
        
        // Read remaining As
        for (let i = 0; i < 5; i++) {
          expect(buffer.next().value).toBe(65);
        }
        
        // Read all boundary bytes as raw data
        expect(buffer.next().value).toBe(66);  // B
        expect(buffer.next().value).toBe(0x0D); // \r as raw byte
        expect(buffer.next().value).toBe(0x0A); // \n as raw byte  
        expect(buffer.next().value).toBe(67);  // C
      });

      it('should handle raw byte patterns across boundary', () => {
        // Test byte patterns spanning buffer boundary
        const fillSize = bufferSize - 10;
        const fillData = new Uint8Array(fillSize);
        fillData.fill(65);
        buffer.appendAtTail(fillData);
        
        // Consume most to get near end, leave 2 A's
        const consumeCount = fillSize - 2;
        for (let i = 0; i < consumeCount; i++) {
          buffer.next();
        }
        
        // Add byte pattern spanning boundary
        const boundaryData = new Uint8Array([66, 0x0A, 0x0D, 67]); // B\n\rC as raw bytes
        buffer.appendAtTail(boundaryData);
        
        // Read remaining As
        expect(buffer.next().value).toBe(65);
        expect(buffer.next().value).toBe(65);
        
        // Read all bytes as raw data
        expect(buffer.next().value).toBe(66);  // B
        expect(buffer.next().value).toBe(0x0A); // \n as raw byte
        expect(buffer.next().value).toBe(0x0D); // \r as raw byte
        expect(buffer.next().value).toBe(67);  // C
      });
    });

    describe('Message Splicing Without Wrap', () => {
      it('should splice messages perfectly with no gaps', () => {
        const messageA = new Uint8Array([1, 2, 3]);
        const messageB = new Uint8Array([4, 5, 6]);
        const messageC = new Uint8Array([7, 8, 9]);
        
        // Add messages sequentially
        buffer.appendAtTail(messageA);
        buffer.appendAtTail(messageB);  
        buffer.appendAtTail(messageC);
        
        // Verify perfect concatenation
        const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = 0; i < expected.length; i++) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(expected[i]);
        }
        
        // Should be empty now
        expect(buffer.next().status).toBe(NextStatus.EMPTY);
      });

      it('should handle zero-length messages', () => {
        const messageA = new Uint8Array([1, 2]);
        const emptyMessage = new Uint8Array([]);
        const messageB = new Uint8Array([3, 4]);
        
        buffer.appendAtTail(messageA);
        buffer.appendAtTail(emptyMessage);
        buffer.appendAtTail(messageB);
        
        // Should read 1,2,3,4 with no gaps
        expect(buffer.next().value).toBe(1);
        expect(buffer.next().value).toBe(2);
        expect(buffer.next().value).toBe(3);
        expect(buffer.next().value).toBe(4);
        expect(buffer.next().status).toBe(NextStatus.EMPTY);
      });
    });

    describe('Message Wrapping Across Buffer', () => {
      it('should wrap messages perfectly across buffer boundary', () => {
        // Create scenario where message wraps for this buffer size
        const fillSize = Math.floor(bufferSize * 0.8); // Fill 80%
        const fillData = new Uint8Array(fillSize);
        for (let i = 0; i < fillSize; i++) {
          fillData[i] = i % 256;
        }
        buffer.appendAtTail(fillData);
        
        // Consume most data to create wrap opportunity
        const consumeCount = fillSize - 4;
        for (let i = 0; i < consumeCount; i++) {
          buffer.next();
        }
        
        // Add message that will wrap
        const wrappingMessage = new Uint8Array([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
        buffer.appendAtTail(wrappingMessage);
        
        // Read remaining fill data
        for (let i = consumeCount; i < fillSize; i++) {
          expect(buffer.next().value).toBe(i % 256);
        }
        
        // Read wrapped message - should be perfect
        const expected = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
        for (let i = 0; i < expected.length; i++) {
          const result = buffer.next();
          expect(result.status).toBe(NextStatus.DATA);
          expect(result.value).toBe(expected[i]);
        }
        
        expect(buffer.next().status).toBe(NextStatus.EMPTY);
      });

      it('should handle message ending exactly at buffer end', () => {
        // Calculate exact fill to end at boundary for this buffer size
        const exactFill = new Uint8Array(bufferSize - 1);
        exactFill.fill(42);
        buffer.appendAtTail(exactFill);
        
        // Consume all but last byte
        for (let i = 0; i < bufferSize - 2; i++) {
          buffer.next();
        }
        
        // Add final byte to end exactly at buffer end
        const finalByte = new Uint8Array([99]);
        buffer.appendAtTail(finalByte);
        
        // Read last fill byte
        expect(buffer.next().value).toBe(42);
        
        // Read final byte (at exact buffer end)
        expect(buffer.next().value).toBe(99);
        
        // Now add new message - should start perfectly at position 0
        const newMessage = new Uint8Array([200, 201, 202]);
        buffer.appendAtTail(newMessage);
        
        // Should read perfectly with no orphaned bytes
        expect(buffer.next().value).toBe(200);
        expect(buffer.next().value).toBe(201);
        expect(buffer.next().value).toBe(202);
        expect(buffer.next().status).toBe(NextStatus.EMPTY);
      });
    });

    describe('Multiple Wrap Cycles', () => {
      it('should maintain integrity through multiple wrap cycles', () => {
        // Use recognizable pattern that will detect corruption
        const pattern = [0x11, 0x22, 0x33, 0x44];
        const cycleSize = Math.floor(bufferSize / 8); // Size that will cause wrapping
        const cycles = 4;
        
        for (let cycle = 0; cycle < cycles; cycle++) {
          // Add data for this cycle
          const cycleData = new Uint8Array(cycleSize);
          for (let i = 0; i < cycleSize; i++) {
            cycleData[i] = pattern[i % 4] + cycle; // Unique per cycle
          }
          buffer.appendAtTail(cycleData);
          
          // Read and verify this cycle's data
          for (let i = 0; i < cycleSize; i++) {
            const result = buffer.next();
            expect(result.status).toBe(NextStatus.DATA);
            const expectedValue = pattern[i % 4] + cycle;
            expect(result.value).toBe(expectedValue);
          }
        }
        
        expect(buffer.next().status).toBe(NextStatus.EMPTY);
      });
    });

    describe('No Orphaned Bytes Detection', () => {
      it('should never leave partial data at boundaries', () => {
        // This test ensures buffer position calculations are exact for this size
        const messages = [
          new Uint8Array([1, 2, 3, 4, 5]),
          new Uint8Array([10, 11, 12]),           // 10 = 0x0A (LF) - now treated as raw data
          new Uint8Array([20, 21, 22, 23, 24, 25, 26])
        ];
        
        let totalExpected = 0;
        let appendFailures = 0;
        messages.forEach((msg, index) => {
          const success = buffer.appendAtTail(msg);
          if (!success) {
            appendFailures++;
            console.log(`APPEND FAILED for message ${index} with buffer size ${bufferSize}`);
          } else {
            totalExpected += msg.length;
          }
        });
        
        // All appends should succeed for small messages
        expect(appendFailures).toBe(0);
        
        // Read all data - CircularBuffer now treats everything as raw bytes
        const actualData: number[] = [];
        let result: NextResult;
        while ((result = buffer.next()).status === NextStatus.DATA) {
          actualData.push(result.value!);
        }
        
        // Verify exact count - no orphaned bytes
        console.log(`Buffer ${bufferSize}: Expected ${totalExpected}, got ${actualData.length}`);
        expect(actualData.length).toBe(totalExpected);
        
        // Verify exact content
        const expected = [1, 2, 3, 4, 5, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26];
        expect(actualData).toEqual(expected);
      });
    });
  });
}

// Run the complete test suite with different buffer sizes
describe('CircularBuffer Integrity Tests - Buffer Size Stress Testing', () => {
  // Test 1: Small even buffer - Forces constant wrapping and maximum boundary stress
  runIntegrityTestsWithBufferSize(30, 'Small Even Buffer (30 bytes)');
  
  // Test 2: Medium-large odd buffer - Less frequent wrapping, odd boundary testing
  runIntegrityTestsWithBufferSize(257, 'Medium Odd Buffer (257 bytes)');
});