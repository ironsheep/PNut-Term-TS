/** @format */

// tests/serialProcessorIntegration.test.ts
// Integration Tests for Two-Tier Pattern Matching Pipeline

import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { RouteDestination } from '../src/classes/shared/messageRouter';

describe('SerialMessageProcessor - Two-Tier Integration', () => {
  let processor: SerialMessageProcessor;
  let receivedMessages: ExtractedMessage[] = [];

  // Mock destination handlers
  const createMockDestination = (name: string): RouteDestination => ({
    name,
    handler: (message: ExtractedMessage) => {
      receivedMessages.push({ ...message, metadata: { ...message.metadata, destination: name } });
    }
  });

  beforeEach(() => {
    processor = new SerialMessageProcessor(false);
    receivedMessages = [];

    // Register destinations for all message types
    processor.registerDestination(MessageType.DB_PACKET, createMockDestination('DB_Handler'));
    processor.registerDestination(MessageType.COG_MESSAGE, createMockDestination('COG_Logger'));
    processor.registerDestination(MessageType.BACKTICK_WINDOW, createMockDestination('Window_Manager'));
    processor.registerDestination(MessageType.DEBUGGER_80BYTE, createMockDestination('Debugger_Window'));
    processor.registerDestination(MessageType.P2_SYSTEM_INIT, createMockDestination('Debug_Logger'));
    processor.registerDestination(MessageType.TERMINAL_OUTPUT, createMockDestination('Main_Terminal'));
    processor.registerDestination(MessageType.INVALID_COG, createMockDestination('Debug_Logger'));
    processor.registerDestination(MessageType.INCOMPLETE_DEBUG, createMockDestination('Debug_Logger'));

    processor.start();
  });

  afterEach(() => {
    processor.stop();
  });

  describe('End-to-End Message Processing', () => {
    it('should process P2 boot sequence correctly', async () => {
      // Simulate P2 boot sequence
      const bootSequence = [
        'Cog0 INIT $0000_0000 $0000_0000 load\r\n',  // System init
        'Cog0: System boot complete\r\n',              // COG 0 status
        'Cog1: Task processor ready\r\n',              // COG 1 status
        'User output: Hello from P2!\r\n'             // Terminal text
      ];

      // Process each message
      for (const message of bootSequence) {
        const buffer = Buffer.from(message);
        processor.processSerialData(buffer);
        
        // Allow async processing
        await new Promise(resolve => setImmediate(resolve));
      }

      // Verify correct number of messages processed
      expect(receivedMessages.length).toBe(4);

      // Check message types and destinations
      expect(receivedMessages[0].type).toBe(MessageType.P2_SYSTEM_INIT);
      expect(receivedMessages[0].metadata?.destination).toBe('Debug_Logger');

      expect(receivedMessages[1].type).toBe(MessageType.COG_MESSAGE);
      expect(receivedMessages[1].metadata?.destination).toBe('COG_Logger');
      expect(receivedMessages[1].metadata?.cogId).toBe(0);

      expect(receivedMessages[2].type).toBe(MessageType.COG_MESSAGE);
      expect(receivedMessages[2].metadata?.destination).toBe('COG_Logger');
      expect(receivedMessages[2].metadata?.cogId).toBe(1);

      expect(receivedMessages[3].type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(receivedMessages[3].metadata?.destination).toBe('Main_Terminal');
    });

    it('should route unknown data to terminal (Terminal FIRST)', async () => {
      // Unknown binary data
      const unknownData = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0x0D]);
      
      // Regular text without patterns
      const regularText = Buffer.from('This is just regular output\r\n');

      processor.processSerialData(unknownData);
      processor.processSerialData(regularText);
      
      await new Promise(resolve => setImmediate(resolve));

      // Both should be routed to terminal
      expect(receivedMessages.length).toBe(2);
      expect(receivedMessages[0].type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(receivedMessages[0].metadata?.destination).toBe('Main_Terminal');
      expect(receivedMessages[1].type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(receivedMessages[1].metadata?.destination).toBe('Main_Terminal');
    });

    it('should handle invalid COG IDs with warnings', async () => {
      const invalidCogMsg = Buffer.from('Cog9: This COG ID is invalid\r\n');
      
      processor.processSerialData(invalidCogMsg);
      await new Promise(resolve => setImmediate(resolve));

      expect(receivedMessages.length).toBe(1);
      expect(receivedMessages[0].type).toBe(MessageType.INVALID_COG);
      expect(receivedMessages[0].metadata?.destination).toBe('Debug_Logger');
      expect(receivedMessages[0].metadata?.validationStatus).toBe('INVALID');
      expect(receivedMessages[0].metadata?.warningMessage).toContain('Invalid COG ID');
    });
  });

  describe('Buffer Management', () => {
    it('should handle 1MB buffer capacity correctly', () => {
      const stats = processor.getStats();
      
      // Buffer should be 1MB (1048576 bytes)
      expect(stats.buffer.size).toBe(1048576);
      expect(stats.buffer.available).toBe(1048576);
      expect(stats.buffer.used).toBe(0);
    });
  });
});