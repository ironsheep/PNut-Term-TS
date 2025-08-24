/** @format */

// tests/circularBufferConfigurable.test.ts
// Test configurable buffer sizes

import { CircularBuffer, NextStatus } from '../src/classes/shared/circularBuffer';

describe('CircularBuffer Configurable Size', () => {
  
  it('should create buffer with default 1MB size', () => {
    const buffer = new CircularBuffer();
    expect(buffer.getBufferSize()).toBe(1048576);
    expect(buffer.getStats().size).toBe(1048576);
    expect(buffer.getStats().available).toBe(1048576);
  });

  it('should create buffer with custom small size for testing', () => {
    const customSize = 128;
    const buffer = new CircularBuffer(customSize);
    
    expect(buffer.getBufferSize()).toBe(customSize);
    expect(buffer.getStats().size).toBe(customSize);
    expect(buffer.getStats().available).toBe(customSize);
  });

  it('should handle boundary conditions with small buffer', () => {
    // Now we can easily test boundary conditions with small buffers!
    const buffer = new CircularBuffer(10); // Tiny 10-byte buffer
    
    // Fill to capacity
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(buffer.appendAtTail(data)).toBe(true);
    expect(buffer.getStats().used).toBe(10);
    expect(buffer.getStats().available).toBe(0);
    
    // Should reject overflow
    const overflow = new Uint8Array([11]);
    expect(buffer.appendAtTail(overflow)).toBe(false);
    
    // Read back all data
    for (let i = 1; i <= 10; i++) {
      const result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(i);
    }
    
    expect(buffer.next().status).toBe(NextStatus.EMPTY);
  });

  it('should handle wrap-around with small buffer', () => {
    const buffer = new CircularBuffer(8); // 8-byte buffer
    
    // Fill halfway
    const data1 = new Uint8Array([1, 2, 3, 4]);
    buffer.appendAtTail(data1);
    
    // Consume half
    buffer.next(); // 1
    buffer.next(); // 2
    
    // Add more data that will wrap
    const data2 = new Uint8Array([5, 6, 7, 8, 9, 10]);
    expect(buffer.appendAtTail(data2)).toBe(true);
    
    // Should read: 3, 4, 5, 6, 7, 8, 9, 10
    const expected = [3, 4, 5, 6, 7, 8, 9, 10];
    for (const expectedValue of expected) {
      const result = buffer.next();
      expect(result.status).toBe(NextStatus.DATA);
      expect(result.value).toBe(expectedValue);
    }
  });

  it('should create very large buffer for stress testing', () => {
    const largeSize = 1024 * 1024; // 1MB buffer
    const buffer = new CircularBuffer(largeSize);
    
    expect(buffer.getBufferSize()).toBe(largeSize);
    expect(buffer.getStats().available).toBe(largeSize);
    
    // Should handle large data
    const largeData = new Uint8Array(100000).fill(42);
    expect(buffer.appendAtTail(largeData)).toBe(true);
    expect(buffer.getStats().used).toBe(100000);
  });
});