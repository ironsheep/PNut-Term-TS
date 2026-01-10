/** @format */

// tests/serialProcessorIntegration.test.ts
// Integration Tests for Worker Thread Architecture Pipeline

import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { SharedMessageType, ExtractedMessage } from '../src/classes/shared/sharedMessagePool';
import { RouteDestination } from '../src/classes/shared/messageRouter';

// Extended type for test tracking (adds destination for verification)
interface TestMessage extends ExtractedMessage {
  testDestination?: string;
}

describe('SerialMessageProcessor - Worker Thread Integration', () => {
  let processor: SerialMessageProcessor;
  let receivedMessages: TestMessage[] = [];

  // Mock destination handlers - capture received messages with destination tracking
  const createMockDestination = (name: string): RouteDestination => ({
    name,
    handler: (message: ExtractedMessage) => {
      receivedMessages.push({ ...message, testDestination: name });
    }
  });

  beforeEach(() => {
    processor = new SerialMessageProcessor(false);
    receivedMessages = [];

    // Register destinations for message types (using current SharedMessageType enum)
    processor.registerDestination(SharedMessageType.DB_PACKET, createMockDestination('DB_Handler'));

    // Register COG message destinations (COG ID embedded in type: COG0-COG7)
    processor.registerDestination(SharedMessageType.COG0_MESSAGE, createMockDestination('COG0_Logger'));
    processor.registerDestination(SharedMessageType.COG1_MESSAGE, createMockDestination('COG1_Logger'));
    processor.registerDestination(SharedMessageType.COG2_MESSAGE, createMockDestination('COG2_Logger'));
    processor.registerDestination(SharedMessageType.COG3_MESSAGE, createMockDestination('COG3_Logger'));
    processor.registerDestination(SharedMessageType.COG4_MESSAGE, createMockDestination('COG4_Logger'));
    processor.registerDestination(SharedMessageType.COG5_MESSAGE, createMockDestination('COG5_Logger'));
    processor.registerDestination(SharedMessageType.COG6_MESSAGE, createMockDestination('COG6_Logger'));
    processor.registerDestination(SharedMessageType.COG7_MESSAGE, createMockDestination('COG7_Logger'));

    // Register backtick window destinations (specific window types)
    processor.registerDestination(SharedMessageType.BACKTICK_LOGIC, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_SCOPE, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_SCOPE_XY, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_FFT, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_SPECTRO, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_PLOT, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_TERM, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_BITMAP, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_MIDI, createMockDestination('Window_Manager'));
    processor.registerDestination(SharedMessageType.BACKTICK_UPDATE, createMockDestination('Window_Manager'));

    // Register debugger destinations (COG ID embedded: DEBUGGER0-DEBUGGER7)
    processor.registerDestination(SharedMessageType.DEBUGGER0_416BYTE, createMockDestination('Debugger_Window'));
    processor.registerDestination(SharedMessageType.DEBUGGER1_416BYTE, createMockDestination('Debugger_Window'));
    processor.registerDestination(SharedMessageType.DEBUGGER2_416BYTE, createMockDestination('Debugger_Window'));
    processor.registerDestination(SharedMessageType.DEBUGGER3_416BYTE, createMockDestination('Debugger_Window'));
    processor.registerDestination(SharedMessageType.DEBUGGER4_416BYTE, createMockDestination('Debugger_Window'));
    processor.registerDestination(SharedMessageType.DEBUGGER5_416BYTE, createMockDestination('Debugger_Window'));
    processor.registerDestination(SharedMessageType.DEBUGGER6_416BYTE, createMockDestination('Debugger_Window'));
    processor.registerDestination(SharedMessageType.DEBUGGER7_416BYTE, createMockDestination('Debugger_Window'));

    processor.registerDestination(SharedMessageType.P2_SYSTEM_INIT, createMockDestination('Debug_Logger'));
    processor.registerDestination(SharedMessageType.TERMINAL_OUTPUT, createMockDestination('Main_Terminal'));
    processor.registerDestination(SharedMessageType.INVALID_COG, createMockDestination('Debug_Logger'));

    processor.start();
  });

  afterEach(async () => {
    await processor.stop();
  });

  describe('Buffer Management', () => {
    it('should handle 1MB buffer capacity correctly', () => {
      const stats = processor.getStats();

      // Buffer should be 1MB (1048576 bytes)
      // Access via workerExtractor.bufferStats (Worker Thread architecture)
      expect(stats.workerExtractor.bufferStats.size).toBe(1048576);
      // Note: Circular buffer reserves 1 byte to distinguish full vs empty state
      expect(stats.workerExtractor.bufferStats.available).toBe(1048575);
      expect(stats.workerExtractor.bufferStats.used).toBe(0);
    });
  });

  describe('Processor State Management', () => {
    it('should report running state correctly', () => {
      const stats = processor.getStats();

      expect(stats.isRunning).toBe(true);
      expect(stats.startTime).toBeGreaterThan(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should have worker extractor initialized', () => {
      const stats = processor.getStats();

      expect(stats.workerExtractor).toBeDefined();
      expect(stats.workerExtractor.bufferStats).toBeDefined();
      expect(stats.workerExtractor.poolStats).toBeDefined();
    });

    it('should have router initialized', () => {
      const stats = processor.getStats();

      expect(stats.router).toBeDefined();
    });
  });

  describe('SharedMessageType Enum', () => {
    it('should have correct COG message type values', () => {
      // COG messages should have sequential values 1-8
      expect(SharedMessageType.COG0_MESSAGE).toBe(1);
      expect(SharedMessageType.COG1_MESSAGE).toBe(2);
      expect(SharedMessageType.COG2_MESSAGE).toBe(3);
      expect(SharedMessageType.COG3_MESSAGE).toBe(4);
      expect(SharedMessageType.COG4_MESSAGE).toBe(5);
      expect(SharedMessageType.COG5_MESSAGE).toBe(6);
      expect(SharedMessageType.COG6_MESSAGE).toBe(7);
      expect(SharedMessageType.COG7_MESSAGE).toBe(8);
    });

    it('should have correct debugger type values', () => {
      // Debugger messages should have sequential values 9-16
      expect(SharedMessageType.DEBUGGER0_416BYTE).toBe(9);
      expect(SharedMessageType.DEBUGGER1_416BYTE).toBe(10);
      expect(SharedMessageType.DEBUGGER2_416BYTE).toBe(11);
      expect(SharedMessageType.DEBUGGER3_416BYTE).toBe(12);
      expect(SharedMessageType.DEBUGGER4_416BYTE).toBe(13);
      expect(SharedMessageType.DEBUGGER5_416BYTE).toBe(14);
      expect(SharedMessageType.DEBUGGER6_416BYTE).toBe(15);
      expect(SharedMessageType.DEBUGGER7_416BYTE).toBe(16);
    });

    it('should have correct special message type values', () => {
      expect(SharedMessageType.DB_PACKET).toBe(0);
      expect(SharedMessageType.P2_SYSTEM_INIT).toBe(17);
      expect(SharedMessageType.TERMINAL_OUTPUT).toBe(28);
      expect(SharedMessageType.INVALID_COG).toBe(29);
    });

    it('should have correct backtick window type values', () => {
      expect(SharedMessageType.BACKTICK_LOGIC).toBe(18);
      expect(SharedMessageType.BACKTICK_SCOPE).toBe(19);
      expect(SharedMessageType.BACKTICK_SCOPE_XY).toBe(20);
      expect(SharedMessageType.BACKTICK_FFT).toBe(21);
      expect(SharedMessageType.BACKTICK_SPECTRO).toBe(22);
      expect(SharedMessageType.BACKTICK_PLOT).toBe(23);
      expect(SharedMessageType.BACKTICK_TERM).toBe(24);
      expect(SharedMessageType.BACKTICK_BITMAP).toBe(25);
      expect(SharedMessageType.BACKTICK_MIDI).toBe(26);
      expect(SharedMessageType.BACKTICK_UPDATE).toBe(27);
    });
  });

  describe('Utility Functions', () => {
    it('should extract COG ID from message type', () => {
      // Helper to extract COG ID from SharedMessageType
      const getCogId = (type: SharedMessageType): number | null => {
        if (type >= SharedMessageType.COG0_MESSAGE && type <= SharedMessageType.COG7_MESSAGE) {
          return type - SharedMessageType.COG0_MESSAGE;
        }
        if (type >= SharedMessageType.DEBUGGER0_416BYTE && type <= SharedMessageType.DEBUGGER7_416BYTE) {
          return type - SharedMessageType.DEBUGGER0_416BYTE;
        }
        return null;
      };

      expect(getCogId(SharedMessageType.COG0_MESSAGE)).toBe(0);
      expect(getCogId(SharedMessageType.COG1_MESSAGE)).toBe(1);
      expect(getCogId(SharedMessageType.COG7_MESSAGE)).toBe(7);
      expect(getCogId(SharedMessageType.DEBUGGER0_416BYTE)).toBe(0);
      expect(getCogId(SharedMessageType.DEBUGGER3_416BYTE)).toBe(3);
      expect(getCogId(SharedMessageType.TERMINAL_OUTPUT)).toBeNull();
    });
  });
});
