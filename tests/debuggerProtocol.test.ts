/** @format */

// tests/debuggerProtocol.test.ts

import { DebuggerProtocol } from '../src/classes/shared/debuggerProtocol';
import { EventEmitter } from 'events';
import {
  DebuggerInitialMessage,
  DEBUG_COMMANDS,
  MEMORY_CONSTANTS
} from '../src/classes/shared/debuggerConstants';

// Mock UsbSerial
class MockUsbSerial extends EventEmitter {
  public writtenData: Buffer[] = [];
  
  write(data: Buffer): void {
    this.writtenData.push(data);
  }
  
  simulateData(data: Buffer): void {
    this.emit('data', data);
  }
}

describe('DebuggerProtocol', () => {
  let protocol: DebuggerProtocol;
  let mockSerial: MockUsbSerial;

  beforeEach(() => {
    protocol = new DebuggerProtocol();
    mockSerial = new MockUsbSerial();
    jest.useFakeTimers();
  });

  afterEach(() => {
    protocol.disconnect();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Connection Management', () => {
    it('should connect to serial port', (done) => {
      protocol.on('connected', () => {
        expect(protocol.isActive()).toBe(true);
        done();
      });

      protocol.connect(mockSerial as any);
    });

    it('should disconnect from serial port', (done) => {
      protocol.on('disconnected', () => {
        expect(protocol.isActive()).toBe(false);
        done();
      });

      protocol.connect(mockSerial as any);
      protocol.disconnect();
    });

    it('should handle reconnection', () => {
      const mockSerial2 = new MockUsbSerial();
      
      protocol.connect(mockSerial as any);
      expect(protocol.isActive()).toBe(true);
      
      protocol.connect(mockSerial2 as any);
      expect(protocol.isActive()).toBe(true);
    });
  });

  describe('Initial Message Parsing', () => {
    it('should parse valid 20-long initial message', (done) => {
      protocol.on('initialMessage', (data) => {
        expect(data.message.cogNumber).toBe(3);
        expect(data.message.programCounter).toBe(0x1234);
        expect(data.message.breakStatus).toBe(1);
        done();
      });

      protocol.connect(mockSerial as any);

      // Create 20-long message (80 bytes)
      const message = new Uint32Array(20);
      message[0] = 3;        // COG number
      message[1] = 1;        // Break status
      message[5] = 0x1234;   // PC
      
      const buffer = Buffer.from(message.buffer);
      mockSerial.simulateData(buffer);
    });

    it('should reject invalid initial messages', () => {
      let errorEmitted = false;
      protocol.on('error', () => {
        errorEmitted = true;
      });

      protocol.connect(mockSerial as any);

      // Invalid message - COG number > 7
      const message = new Uint32Array(20);
      message[0] = 8; // Invalid COG
      
      const buffer = Buffer.from(message.buffer);
      mockSerial.simulateData(buffer);
      
      // Message should be skipped
      expect(errorEmitted).toBe(false);
    });

    it('should handle partial messages', () => {
      let messageReceived = false;
      protocol.on('initialMessage', () => {
        messageReceived = true;
      });

      protocol.connect(mockSerial as any);

      // Send partial message
      const message = new Uint32Array(20);
      message[0] = 2;
      
      const fullBuffer = Buffer.from(message.buffer);
      const part1 = fullBuffer.slice(0, 40);
      const part2 = fullBuffer.slice(40);
      
      mockSerial.simulateData(part1);
      expect(messageReceived).toBe(false);
      
      mockSerial.simulateData(part2);
      expect(messageReceived).toBe(true);
    });
  });

  describe('Command Sending', () => {
    beforeEach(() => {
      protocol.connect(mockSerial as any);
    });

    it('should send STALL command', () => {
      protocol.sendStall(4);
      
      expect(mockSerial.writtenData.length).toBe(1);
      const data = new Uint32Array(mockSerial.writtenData[0].buffer);
      expect(data[0]).toBe(DEBUG_COMMANDS.STALL_CMD);
      expect(data[2]).toBe(4); // COG ID
    });

    it('should send BREAK command', () => {
      protocol.sendBreak(2);
      
      expect(mockSerial.writtenData.length).toBe(1);
      const data = new Uint32Array(mockSerial.writtenData[0].buffer);
      expect(data[0]).toBe(DEBUG_COMMANDS.BREAK_CMD);
      expect(data[2]).toBe(2); // COG ID
    });

    it('should send GO command', () => {
      protocol.sendGo(6);
      
      expect(mockSerial.writtenData.length).toBe(1);
      const data = new Uint32Array(mockSerial.writtenData[0].buffer);
      expect(data[0]).toBe(DEBUG_COMMANDS.GO_CMD);
      expect(data[2]).toBe(6); // COG ID
    });

    it('should send memory request with sequence number', () => {
      const seq1 = protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_COG,
        cogId: 1,
        blockIndex: 5
      });
      
      const seq2 = protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_LUT,
        cogId: 2,
        blockIndex: 10
      });
      
      expect(seq2).toBe(seq1 + 1);
      expect(mockSerial.writtenData.length).toBe(2);
    });

    it('should throw when not connected', () => {
      protocol.disconnect();
      
      expect(() => {
        protocol.sendRequest({
          command: DEBUG_COMMANDS.REQUEST_COG,
          cogId: 0
        });
      }).toThrow('Not connected');
    });
  });

  describe('Response Handling', () => {
    beforeEach(() => {
      protocol.connect(mockSerial as any);
    });

    it('should handle data response', (done) => {
      protocol.on('response', (response) => {
        expect(response.responseType).toBe(DEBUG_COMMANDS.RESPONSE_DATA);
        expect(response.cogId).toBe(3);
        expect(response.address).toBe(0x100);
        expect(response.data?.length).toBe(4);
        done();
      });

      const sequence = protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_COG,
        cogId: 3,
        blockIndex: 1
      });

      // Simulate response with proper structure
      const dataSize = 16; // 4 longs = 16 bytes
      const payloadSize = 8 + dataSize; // 8 bytes header (seq + addr) + data
      const response = new Uint8Array(4 + payloadSize);
      // Header: 0xDB marker | type | payload size
      response[0] = payloadSize & 0xFF;
      response[1] = (payloadSize >> 8) & 0xFF;
      response[2] = DEBUG_COMMANDS.RESPONSE_DATA;
      response[3] = 0xDB;
      // Sequence
      response[4] = sequence & 0xFF;
      response[5] = (sequence >> 8) & 0xFF;
      response[6] = 0;
      response[7] = 0;
      // Address
      response[8] = 0x00;
      response[9] = 0x01;
      response[10] = 0;
      response[11] = 0;
      // Data (4 longs = 16 bytes)
      for (let i = 0; i < dataSize; i++) {
        response[12 + i] = i;
      }
      
      mockSerial.simulateData(Buffer.from(response));
    });

    it('should handle ACK response', (done) => {
      protocol.on('ack', (data) => {
        expect(data.sequence).toBe(1);
        expect(data.request.cogId).toBe(5);
        done();
      });

      const sequence = protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_HUB,
        cogId: 5,
        address: 0x1000
      });

      // Simulate ACK with proper header structure
      const ack = new Uint8Array(8);
      ack[0] = 0x04; // payload size
      ack[1] = 0x00;
      ack[2] = DEBUG_COMMANDS.RESPONSE_ACK;
      ack[3] = 0xDB;
      ack[4] = sequence & 0xFF;
      ack[5] = (sequence >> 8) & 0xFF;
      ack[6] = 0;
      ack[7] = 0;
      
      mockSerial.simulateData(Buffer.from(ack));
    });

    it('should handle NAK response', (done) => {
      protocol.on('nak', (data) => {
        expect(data.sequence).toBe(1);
        done();
      });

      const sequence = protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_COG,
        cogId: 7
      });

      // Simulate NAK with proper header structure
      const nak = new Uint8Array(8);
      nak[0] = 0x04; // payload size
      nak[1] = 0x00;
      nak[2] = DEBUG_COMMANDS.RESPONSE_NAK;
      nak[3] = 0xDB;
      nak[4] = sequence & 0xFF;
      nak[5] = (sequence >> 8) & 0xFF;
      nak[6] = 0;
      nak[7] = 0;
      
      mockSerial.simulateData(Buffer.from(nak));
    });
  });

  describe('Timeout Handling', () => {
    beforeEach(() => {
      protocol.connect(mockSerial as any);
    });

    it('should timeout pending requests', (done) => {
      protocol.on('timeout', (data) => {
        expect(data.sequence).toBe(1);
        expect(data.request.cogId).toBe(0);
        done();
      });

      protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_COG,
        cogId: 0
      });

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(1001);
    });

    it('should clear timeout on response', () => {
      let timeoutEmitted = false;
      protocol.on('timeout', () => {
        timeoutEmitted = true;
      });

      const sequence = protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_COG,
        cogId: 1
      });

      // Send ACK response before timeout
      const response = new Uint8Array(8);
      response[0] = 0x04; // payload size
      response[1] = 0x00;
      response[2] = DEBUG_COMMANDS.RESPONSE_ACK;
      response[3] = 0xDB;
      response[4] = sequence & 0xFF;
      response[5] = (sequence >> 8) & 0xFF;
      response[6] = 0;
      response[7] = 0;
      
      mockSerial.simulateData(Buffer.from(response));
      
      jest.advanceTimersByTime(1001);
      expect(timeoutEmitted).toBe(false);
    });
  });

  describe('Communication Loss Detection', () => {
    it('should detect communication loss', (done) => {
      protocol.on('communicationLost', () => {
        done();
      });

      protocol.connect(mockSerial as any);
      
      // Fast-forward time past communication timeout
      jest.advanceTimersByTime(6000);
    });

    it('should reset timeout on data reception', () => {
      let lostEmitted = false;
      protocol.on('communicationLost', () => {
        lostEmitted = true;
      });

      protocol.connect(mockSerial as any);
      
      // Send data periodically
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(4000);
        mockSerial.simulateData(Buffer.from([1, 2, 3, 4]));
      }
      
      jest.advanceTimersByTime(2000);
      expect(lostEmitted).toBe(false);
    });
  });

  describe('Memory Request Methods', () => {
    beforeEach(() => {
      protocol.connect(mockSerial as any);
    });

    it('should request COG memory block', () => {
      protocol.requestCogBlock(2, 15);
      
      const data = new Uint32Array(mockSerial.writtenData[0].buffer);
      expect(data[0]).toBe(DEBUG_COMMANDS.REQUEST_COG);
      expect(data[2]).toBe(2); // COG ID
      expect(data[3]).toBe(15); // Block index
    });

    it('should request LUT memory block', () => {
      protocol.requestLutBlock(4, 32);
      
      const data = new Uint32Array(mockSerial.writtenData[0].buffer);
      expect(data[0]).toBe(DEBUG_COMMANDS.REQUEST_LUT);
      expect(data[2]).toBe(4); // COG ID
      expect(data[3]).toBe(32); // Block index
    });

    it('should request HUB memory', () => {
      protocol.requestHubMemory(0x10000, 256);
      
      const data = new Uint32Array(mockSerial.writtenData[0].buffer);
      expect(data[0]).toBe(DEBUG_COMMANDS.REQUEST_HUB);
      expect(data[2]).toBe(0); // COG 0 for HUB
      expect(data[3]).toBe(0x10000); // Address
    });
  });

  describe('Status Methods', () => {
    it('should report connection status', () => {
      expect(protocol.isActive()).toBe(false);
      
      protocol.connect(mockSerial as any);
      expect(protocol.isActive()).toBe(true);
      
      protocol.disconnect();
      expect(protocol.isActive()).toBe(false);
    });

    it('should track pending request count', () => {
      protocol.connect(mockSerial as any);
      
      expect(protocol.getPendingCount()).toBe(0);
      
      protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_COG,
        cogId: 0
      });
      expect(protocol.getPendingCount()).toBe(1);
      
      protocol.sendRequest({
        command: DEBUG_COMMANDS.REQUEST_LUT,
        cogId: 1
      });
      expect(protocol.getPendingCount()).toBe(2);
    });
  });
});