/** @format */

// tests/serialMessageProcessorIntegration.test.ts

import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { MessageType } from '../src/classes/shared/messageExtractor';
import { RouteDestination } from '../src/classes/shared/messageRouter';

describe('SerialMessageProcessor Integration', () => {
  let processor: SerialMessageProcessor;
  let receivedMessages: any[] = [];
  let logRotations: any[] = [];

  beforeEach(() => {
    processor = new SerialMessageProcessor();
    receivedMessages = [];
    logRotations = [];

    // Set up test destination
    const testDestination: RouteDestination = {
      name: 'TestLogger',
      handler: (msg) => {
        receivedMessages.push({
          type: msg.type,
          data: Buffer.from(msg.data).toString(),
          timestamp: msg.timestamp,
          metadata: msg.metadata
        });
      }
    };

    // Register destinations
    processor.registerDestination(MessageType.TEXT, testDestination);
    processor.registerDestination(MessageType.DEBUGGER_INIT, testDestination);
    processor.registerDestination(MessageType.DEBUGGER_PROTOCOL, testDestination);
    processor.registerDestination(MessageType.BINARY_UNKNOWN, testDestination);

    // Listen for log rotations
    processor.on('rotateLog', (event) => {
      logRotations.push(event);
    });

    // Start processor
    processor.start();
  });

  afterEach(async () => {
    await processor.stop();
  });

  describe('Basic Message Flow', () => {
    it('should process text messages end-to-end', async () => {
      const testData = Buffer.from('Hello World\n');
      processor.receiveData(testData);

      // Wait for async processing
      await processor.waitForIdle(1000);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].type).toBe(MessageType.TEXT);
      expect(receivedMessages[0].data).toBe('Hello World');
    });

    it('should process multiple message types', async () => {
      // Send text
      processor.receiveData(Buffer.from('Text message\n'));

      // Send 0xDB protocol message
      const protocolMsg = Buffer.from([
        0xDB, 0x01, 0x04, 0x00,  // Header
        0xAA, 0xBB, 0xCC, 0xDD   // Payload
      ]);
      processor.receiveData(protocolMsg);

      // Send more text
      processor.receiveData(Buffer.from('Another line\n'));

      await processor.waitForIdle(1000);

      expect(receivedMessages).toHaveLength(3);
      expect(receivedMessages[0].type).toBe(MessageType.TEXT);
      expect(receivedMessages[1].type).toBe(MessageType.DEBUGGER_PROTOCOL);
      expect(receivedMessages[2].type).toBe(MessageType.TEXT);
    });

    it('should handle Cog messages with metadata', async () => {
      processor.receiveData(Buffer.from('Cog3: Debug output\n'));

      await processor.waitForIdle(1000);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].metadata?.cogId).toBe(3);
    });

    it('should handle 80-byte debugger packets', async () => {
      const packet = new Uint8Array(80);
      packet[0] = 2; // COG 2
      packet[20] = 0x10; // PC low byte

      processor.receiveData(Buffer.from(packet));

      // Follow with text to trigger detection
      processor.receiveData(Buffer.from('Text after packet\n'));

      await processor.waitForIdle(1000);

      const debuggerMsg = receivedMessages.find(m => m.type === MessageType.DEBUGGER_INIT);
      expect(debuggerMsg).toBeDefined();
      expect(debuggerMsg?.metadata?.cogId).toBe(2);
    });
  });

  describe('DTR/RTS Reset Handling', () => {
    it('should handle DTR reset with log rotation', async () => {
      // Send messages before reset
      processor.receiveData(Buffer.from('Before reset 1\n'));
      processor.receiveData(Buffer.from('Before reset 2\n'));

      await processor.waitForIdle(100);

      const beforeCount = receivedMessages.length;

      // Trigger DTR reset
      await processor.onDTRReset();

      // Check log rotation occurred
      expect(logRotations).toHaveLength(1);
      expect(logRotations[0].type).toBe('DTR');

      // Send messages after reset
      processor.receiveData(Buffer.from('After reset 1\n'));
      processor.receiveData(Buffer.from('After reset 2\n'));

      await processor.waitForIdle(100);

      // All messages should be received
      expect(receivedMessages.length).toBe(beforeCount + 2);
    });

    it('should handle RTS reset', async () => {
      await processor.onRTSReset();

      expect(logRotations).toHaveLength(1);
      expect(logRotations[0].type).toBe('RTS');

      const syncStatus = processor.getSyncStatus();
      expect(syncStatus.synchronized).toBe(true);
      expect(syncStatus.source).toBe('RTS');
    });

    it('should process all pending messages before log rotation', async () => {
      // Queue up many messages
      for (let i = 0; i < 10; i++) {
        processor.receiveData(Buffer.from(`Message ${i}\n`));
      }

      // Immediately trigger reset
      await processor.onDTRReset();

      // All messages should be processed before rotation
      expect(receivedMessages.length).toBe(10);
      expect(logRotations).toHaveLength(1);
    });

    it('should maintain message order across reset', async () => {
      // Messages before
      processor.receiveData(Buffer.from('First\n'));
      processor.receiveData(Buffer.from('Second\n'));

      await processor.waitForIdle(100);

      await processor.onDTRReset();

      // Messages after
      processor.receiveData(Buffer.from('Third\n'));
      processor.receiveData(Buffer.from('Fourth\n'));

      await processor.waitForIdle(100);

      expect(receivedMessages.map(m => m.data)).toEqual([
        'First', 'Second', 'Third', 'Fourth'
      ]);
    });
  });

  describe('Buffer Overflow Recovery', () => {
    it('should handle buffer overflow and recover', async () => {
      let overflowDetected = false;
      processor.on('bufferOverflow', () => {
        overflowDetected = true;
      });

      // Fill buffer to capacity
      const hugeData = new Uint8Array(16384);
      hugeData.fill(0xFF);
      
      // This fills the buffer
      processor.simulateData(hugeData);

      // This should cause overflow
      processor.receiveData(Buffer.from('Overflow\n'));

      expect(overflowDetected).toBe(true);

      // After overflow, should clear and resync
      const syncStatus = processor.getSyncStatus();
      expect(syncStatus.synchronized).toBe(false);

      // Should be able to process new messages after recovery
      processor.receiveData(Buffer.from('After recovery\n'));
      await processor.waitForIdle(100);

      const recoveryMsg = receivedMessages.find(m => m.data === 'After recovery');
      expect(recoveryMsg).toBeDefined();
    });
  });

  describe('Performance and Burst Handling', () => {
    it('should handle burst of messages', async () => {
      // Send 100 messages rapidly
      for (let i = 0; i < 100; i++) {
        processor.receiveData(Buffer.from(`Burst message ${i}\n`));
      }

      await processor.waitForIdle(2000);

      expect(receivedMessages.length).toBe(100);
    });

    it('should handle mixed binary and text burst', async () => {
      for (let i = 0; i < 50; i++) {
        // Text message
        processor.receiveData(Buffer.from(`Text ${i}\n`));
        
        // Binary protocol message
        const binary = Buffer.from([
          0xDB, 0x01, 0x02, 0x00,
          i & 0xFF, (i >> 8) & 0xFF
        ]);
        processor.receiveData(binary);
      }

      await processor.waitForIdle(2000);

      const textMessages = receivedMessages.filter(m => m.type === MessageType.TEXT);
      const protocolMessages = receivedMessages.filter(m => m.type === MessageType.DEBUGGER_PROTOCOL);

      expect(textMessages.length).toBe(50);
      expect(protocolMessages.length).toBe(50);
    });

    it('should maintain low latency under load', async () => {
      const startTime = Date.now();
      
      // Send message
      processor.receiveData(Buffer.from('Latency test\n'));
      
      // Wait for processing
      await processor.waitForIdle(100);
      
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Should process within 100ms even under load
      expect(latency).toBeLessThan(100);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive statistics', async () => {
      // Generate some activity
      processor.receiveData(Buffer.from('Test 1\n'));
      processor.receiveData(Buffer.from('Test 2\n'));
      await processor.onDTRReset();

      const stats = processor.getStats();

      expect(stats.receiver).toBeDefined();
      expect(stats.receiver.totalBytesReceived).toBeGreaterThan(0);
      
      expect(stats.buffer).toBeDefined();
      expect(stats.extractor).toBeDefined();
      expect(stats.router).toBeDefined();
      expect(stats.dtrReset).toBeDefined();
      expect(stats.dtrReset.totalResets).toBe(1);
    });

    it('should reset statistics', async () => {
      processor.receiveData(Buffer.from('Test\n'));
      await processor.waitForIdle(100);

      processor.resetStats();

      const stats = processor.getStats();
      expect(stats.receiver.totalBytesReceived).toBe(0);
      expect(stats.router.totalMessagesRouted).toBe(0);
    });
  });

  describe('Component Integration', () => {
    it('should maintain separation of concerns', () => {
      const components = processor.getComponents();

      // Verify components exist
      expect(components.buffer).toBeDefined();
      expect(components.receiver).toBeDefined();
      expect(components.extractor).toBeDefined();
      expect(components.router).toBeDefined();
      expect(components.dtrResetManager).toBeDefined();

      // Verify no cross-coupling
      // Receiver should not know about message types
      expect((components.receiver as any).MessageType).toBeUndefined();
      
      // Extractor should not know about routing
      expect((components.extractor as any).router).toBeUndefined();
      
      // Router should not know about buffer
      expect((components.router as any).buffer).toBeUndefined();
      
      // DTR manager should not have buffer reference
      expect((components.dtrResetManager as any).buffer).toBeUndefined();
    });

    it('should handle partial messages correctly', async () => {
      // Send partial message
      processor.receiveData(Buffer.from('Partial'));
      
      await processor.waitForIdle(50);
      
      // No message yet
      expect(receivedMessages.length).toBe(0);
      
      // Complete the message
      processor.receiveData(Buffer.from(' message\n'));
      
      await processor.waitForIdle(100);
      
      // Now should have the complete message
      expect(receivedMessages.length).toBe(1);
      expect(receivedMessages[0].data).toBe('Partial message');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data', async () => {
      processor.receiveData(Buffer.from(''));
      await processor.waitForIdle(100);
      
      expect(receivedMessages.length).toBe(0);
    });

    it('should handle stop and restart', async () => {
      processor.receiveData(Buffer.from('Before stop\n'));
      await processor.waitForIdle(100);

      await processor.stop();
      
      // Data received while stopped should be ignored
      processor.receiveData(Buffer.from('While stopped\n'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      processor.start();
      processor.receiveData(Buffer.from('After restart\n'));
      await processor.waitForIdle(100);

      const messages = receivedMessages.map(m => m.data);
      expect(messages).toContain('Before stop');
      expect(messages).not.toContain('While stopped');
      expect(messages).toContain('After restart');
    });

    it('should clear all buffers and queues', async () => {
      // Add some data
      processor.receiveData(Buffer.from('Data 1\n'));
      processor.receiveData(Buffer.from('Data 2\n'));
      
      // Clear everything
      processor.clearAll();
      
      await processor.waitForIdle(100);
      
      // Previous data should be gone
      const beforeClearCount = receivedMessages.length;
      
      // New data should work
      processor.receiveData(Buffer.from('After clear\n'));
      await processor.waitForIdle(100);
      
      expect(receivedMessages.length).toBe(beforeClearCount + 1);
      expect(receivedMessages[receivedMessages.length - 1].data).toBe('After clear');
    });
  });
});