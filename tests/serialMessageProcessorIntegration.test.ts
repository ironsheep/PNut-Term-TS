/** @format */

// tests/serialMessageProcessorIntegration.test.ts

import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { SharedMessageType } from '../src/classes/shared/sharedMessagePool';
import { RouteDestination } from '../src/classes/shared/messageRouter';

describe('SerialMessageProcessor Integration', () => {
  let processor: SerialMessageProcessor;
  let receivedMessages: any[] = [];
  let logRotations: any[] = [];

  beforeEach(async () => {
    processor = new SerialMessageProcessor();
    receivedMessages = [];
    logRotations = [];

    // Wait for worker to be ready
    await new Promise<void>((resolve) => {
      processor.once('workerReady' as any, () => {
        resolve();
      });
      // Timeout fallback
      setTimeout(() => resolve(), 2000);
    });

    // Set up test destination
    const testDestination: RouteDestination = {
      name: 'TestLogger',
      handler: (msg) => {
        receivedMessages.push({
          type: msg.type,
          data: Buffer.from(msg.data).toString(),
          timestamp: msg.timestamp
        });
      }
    };

    // Register destinations
    processor.registerDestination(SharedMessageType.TERMINAL_OUTPUT, testDestination);
    processor.registerDestination(SharedMessageType.DEBUGGER0_416BYTE, testDestination);
    processor.registerDestination(SharedMessageType.DB_PACKET, testDestination);
    processor.registerDestination(SharedMessageType.COG0_MESSAGE, testDestination);

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
      expect(receivedMessages[0].type).toBe(SharedMessageType.TERMINAL_OUTPUT);
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
      expect(receivedMessages[0].type).toBe(SharedMessageType.TERMINAL_OUTPUT);
      expect(receivedMessages[1].type).toBe(SharedMessageType.DB_PACKET);
      expect(receivedMessages[2].type).toBe(SharedMessageType.TERMINAL_OUTPUT);
    });

    it('should handle Cog messages', async () => {
      // Register handler for COG3 messages
      processor.registerDestination(SharedMessageType.COG3_MESSAGE, {
        name: 'Cog3Handler',
        handler: (msg) => {
          receivedMessages.push({
            type: msg.type,
            data: Buffer.from(msg.data).toString(),
            timestamp: msg.timestamp
          });
        }
      });

      processor.receiveData(Buffer.from('Cog3  Debug output\r\n'));

      await processor.waitForIdle(1000);

      expect(receivedMessages.length).toBeGreaterThan(0);
      const cogMsg = receivedMessages.find(m => m.type === SharedMessageType.COG3_MESSAGE);
      expect(cogMsg).toBeDefined();
      expect(cogMsg?.type).toBe(SharedMessageType.COG3_MESSAGE);
    });

    it('should handle 416-byte debugger packets', async () => {
      // Worker Thread architecture uses 416-byte packets, not 80-byte
      const packet = new Uint8Array(416);
      packet[0] = 2; // COG 2

      processor.receiveData(Buffer.from(packet));

      await processor.waitForIdle(1000);

      const debuggerMsg = receivedMessages.find(m => m.type === SharedMessageType.DEBUGGER2_416BYTE);
      expect(debuggerMsg).toBeDefined();
      expect(debuggerMsg?.type).toBe(SharedMessageType.DEBUGGER2_416BYTE);
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

      const textMessages = receivedMessages.filter(m => m.type === SharedMessageType.TERMINAL_OUTPUT);
      const protocolMessages = receivedMessages.filter(m => m.type === SharedMessageType.DB_PACKET);

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

      expect(stats.workerExtractor).toBeDefined();
      expect(stats.workerExtractor.totalBytesReceived).toBeGreaterThan(0);

      expect(stats.router).toBeDefined();
      expect(stats.dtrReset).toBeDefined();
      expect(stats.dtrReset.totalResets).toBe(1);
    });

    it('should reset statistics', async () => {
      processor.receiveData(Buffer.from('Test\n'));
      await processor.waitForIdle(100);

      processor.resetStats();

      const stats = processor.getStats();
      // Note: Worker Thread architecture doesn't reset workerExtractor stats
      expect(stats.router.totalMessagesRouted).toBe(0);
    });
  });

  describe('Component Integration', () => {
    it('should maintain separation of concerns', () => {
      const components = processor.getComponents();

      // Verify Worker Thread architecture components exist
      expect(components.workerExtractor).toBeDefined();
      expect(components.router).toBeDefined();
      expect(components.dtrResetManager).toBeDefined();
      expect(components.architecture).toBe('Worker Thread');

      // Verify no cross-coupling
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