/** @format */

import { TLongTransmission } from '../src/classes/shared/tLongTransmission';
import { Context } from '../src/utils/context';

describe('TLongTransmission', () => {
  let tLong: TLongTransmission;
  let mockContext: Context;
  let transmittedData: string[] = [];

  // Mock send callback that captures transmitted data
  const mockSendCallback = (data: string) => {
    transmittedData.push(data);
  };

  beforeEach(() => {
    // Create mock context
    mockContext = {
      logger: {
        forceLogMessage: jest.fn()
      }
    } as any;

    tLong = new TLongTransmission(mockContext);
    tLong.setSendCallback(mockSendCallback);
    transmittedData = [];
  });

  describe('transmitTLong', () => {
    it('should transmit positive integer in little-endian format', () => {
      // Test value: 0x12345678
      const testValue = 0x12345678;
      tLong.transmitTLong(testValue);

      expect(transmittedData).toHaveLength(1);
      const bytes = transmittedData[0];
      expect(bytes.length).toBe(4);

      // Verify little-endian byte order: LSB first
      expect(bytes.charCodeAt(0)).toBe(0x78); // Byte 0: bits 0-7
      expect(bytes.charCodeAt(1)).toBe(0x56); // Byte 1: bits 8-15
      expect(bytes.charCodeAt(2)).toBe(0x34); // Byte 2: bits 16-23
      expect(bytes.charCodeAt(3)).toBe(0x12); // Byte 3: bits 24-31
    });

    it('should transmit negative integer correctly', () => {
      // Test value: -1 (0xFFFFFFFF in 32-bit two's complement)
      const testValue = -1;
      tLong.transmitTLong(testValue);

      expect(transmittedData).toHaveLength(1);
      const bytes = transmittedData[0];
      expect(bytes.length).toBe(4);

      // All bytes should be 0xFF for -1
      expect(bytes.charCodeAt(0)).toBe(0xFF);
      expect(bytes.charCodeAt(1)).toBe(0xFF);
      expect(bytes.charCodeAt(2)).toBe(0xFF);
      expect(bytes.charCodeAt(3)).toBe(0xFF);
    });

    it('should transmit zero correctly', () => {
      const testValue = 0;
      tLong.transmitTLong(testValue);

      expect(transmittedData).toHaveLength(1);
      const bytes = transmittedData[0];
      expect(bytes.length).toBe(4);

      // All bytes should be 0x00 for zero
      expect(bytes.charCodeAt(0)).toBe(0x00);
      expect(bytes.charCodeAt(1)).toBe(0x00);
      expect(bytes.charCodeAt(2)).toBe(0x00);
      expect(bytes.charCodeAt(3)).toBe(0x00);
    });

    it('should handle maximum positive 32-bit integer', () => {
      // Test value: 0x7FFFFFFF (2147483647)
      const testValue = 0x7FFFFFFF;
      tLong.transmitTLong(testValue);

      expect(transmittedData).toHaveLength(1);
      const bytes = transmittedData[0];
      expect(bytes.length).toBe(4);

      expect(bytes.charCodeAt(0)).toBe(0xFF); // LSB
      expect(bytes.charCodeAt(1)).toBe(0xFF);
      expect(bytes.charCodeAt(2)).toBe(0xFF);
      expect(bytes.charCodeAt(3)).toBe(0x7F); // MSB
    });

    it('should throw error when no send callback is set', () => {
      const tLongNoCallback = new TLongTransmission(mockContext);
      expect(() => {
        tLongNoCallback.transmitTLong(123);
      }).toThrow('TLong transmission: Serial port not available - no send callback set');
    });

    it('should log transmission details', () => {
      const testValue = 0x12345678;
      tLong.transmitTLong(testValue);

      expect(mockContext.logger.forceLogMessage).toHaveBeenCalledWith(
        '[TLONG] Transmitting value=305419896 (0x12345678) as bytes=[0x78, 0x56, 0x34, 0x12]'
      );
    });
  });

  describe('encodeMouseData', () => {
    it('should encode mouse position with no buttons pressed', () => {
      const encoded = tLong.encodeMouseData(100, 200, false, false, false, 0);

      // Expected: y=200 at bits 13-25, x=100 at bits 0-12
      // 200 << 13 = 0x190000, 100 = 0x64
      // Combined: 0x190064
      expect(encoded).toBe(0x190064);
    });

    it('should encode mouse position with left button pressed', () => {
      const encoded = tLong.encodeMouseData(100, 200, true, false, false, 0);

      // Expected: 0x190064 | 0x10000000 = 0x10190064
      expect(encoded).toBe(0x10190064);
    });

    it('should encode mouse position with all buttons pressed', () => {
      const encoded = tLong.encodeMouseData(100, 200, true, true, true, 0);

      // Expected: 0x190064 | 0x70000000 = 0x70190064
      expect(encoded).toBe(0x70190064);
    });

    it('should encode wheel delta correctly', () => {
      const encoded = tLong.encodeMouseData(0, 0, false, false, false, 1);

      // Expected: wheel=1 at bits 26-27: 1 << 26 = 0x04000000
      expect(encoded).toBe(0x04000000);
    });

    it('should mask coordinates to 13 bits', () => {
      // Test with coordinates larger than 13 bits (8191 max)
      const encoded = tLong.encodeMouseData(0x3FFF, 0x3FFF, false, false, false, 0);

      // 0x3FFF = 16383, but should be masked to 0x1FFF = 8191
      // y=0x1FFF << 13 = 0x3FFE000, x=0x1FFF = 0x1FFF
      // Combined: 0x3FFFFFF
      expect(encoded).toBe(0x3FFFFFF);
    });
  });

  describe('createOutOfBoundsMouseData', () => {
    it('should return correct out-of-bounds values matching Pascal', () => {
      const outOfBounds = tLong.createOutOfBoundsMouseData();

      expect(outOfBounds.position).toBe(0x03FFFFFF);
      expect(outOfBounds.color).toBe(0xFFFFFFFF);
    });
  });

  describe('transmitMouseData', () => {
    it('should transmit position and color as two TLong values', () => {
      const position = 0x12345678;
      const color = 0x87654321;

      tLong.transmitMouseData(position, color);

      expect(transmittedData).toHaveLength(2);

      // First transmission: position
      let bytes = transmittedData[0];
      expect(bytes.charCodeAt(0)).toBe(0x78);
      expect(bytes.charCodeAt(1)).toBe(0x56);
      expect(bytes.charCodeAt(2)).toBe(0x34);
      expect(bytes.charCodeAt(3)).toBe(0x12);

      // Second transmission: color
      bytes = transmittedData[1];
      expect(bytes.charCodeAt(0)).toBe(0x21);
      expect(bytes.charCodeAt(1)).toBe(0x43);
      expect(bytes.charCodeAt(2)).toBe(0x65);
      expect(bytes.charCodeAt(3)).toBe(0x87);
    });
  });

  describe('transmitKeyPress', () => {
    it('should transmit key value as TLong', () => {
      const keyValue = 65; // 'A' key

      tLong.transmitKeyPress(keyValue);

      expect(transmittedData).toHaveLength(1);
      const bytes = transmittedData[0];
      expect(bytes.charCodeAt(0)).toBe(65);  // LSB
      expect(bytes.charCodeAt(1)).toBe(0);
      expect(bytes.charCodeAt(2)).toBe(0);
      expect(bytes.charCodeAt(3)).toBe(0);   // MSB
    });
  });

  describe('Pascal compatibility verification', () => {
    it('should match Pascal TLong behavior for specific test cases', () => {
      // Test cases that match Pascal implementation
      const testCases = [
        { value: 0x00000000, expected: [0x00, 0x00, 0x00, 0x00] },
        { value: 0x00000001, expected: [0x01, 0x00, 0x00, 0x00] },
        { value: 0x00000100, expected: [0x00, 0x01, 0x00, 0x00] },
        { value: 0x00010000, expected: [0x00, 0x00, 0x01, 0x00] },
        { value: 0x01000000, expected: [0x00, 0x00, 0x00, 0x01] },
        { value: 0x12345678, expected: [0x78, 0x56, 0x34, 0x12] },
        { value: -1,          expected: [0xFF, 0xFF, 0xFF, 0xFF] }
      ];

      testCases.forEach(({ value, expected }) => {
        transmittedData = [];
        tLong.transmitTLong(value);

        const bytes = transmittedData[0];
        for (let i = 0; i < 4; i++) {
          expect(bytes.charCodeAt(i)).toBe(expected[i]);
        }
      });
    });
  });
});