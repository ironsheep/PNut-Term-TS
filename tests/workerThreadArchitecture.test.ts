/**
 * @jest-environment node
 * @format
 */

// tests/workerThreadArchitecture.test.ts

import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { MessageType } from '../src/classes/shared/messageExtractor';

describe('Worker Thread Architecture', () => {
  let processor: SerialMessageProcessor;
  let receivedMessages: any[] = [];
  let workerReady: boolean = false;

  beforeEach(async () => {
    receivedMessages = [];
    workerReady = false;

    // Create processor with Worker Thread architecture enabled
    processor = new SerialMessageProcessor(false, undefined, true);

    // Wait for worker ready event
    const readyPromise = new Promise<void>((resolve) => {
      processor.once('workerReady' as any, () => {
        workerReady = true;
        resolve();
      });
    });

    // Register test destination
    processor.registerDestination(MessageType.BACKTICK_WINDOW, {
      name: 'TestHandler',
      handler: (message) => {
        receivedMessages.push(message);
      }
    });

    processor.start();

    // Wait for worker to be ready with timeout
    await Promise.race([
      readyPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Worker ready timeout')), 2000))
    ]);
  });

  afterEach(async () => {
    await processor.stop();
  });

  test('should process backtick message via Worker Thread', async () => {
    const testMessage = Buffer.from('`test message\r\n');

    processor.receiveData(testMessage);

    // Wait for Worker to process
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(receivedMessages.length).toBeGreaterThan(0);
    const message = receivedMessages[0];

    expect(message.type).toBe(MessageType.BACKTICK_WINDOW);
    expect(Array.from(message.data)).toEqual(Array.from(testMessage));
  });

  test('should process COG message via Worker Thread', async () => {
    receivedMessages = [];

    processor.registerDestination(MessageType.COG_MESSAGE, {
      name: 'CogTestHandler',
      handler: (message) => {
        receivedMessages.push(message);
      }
    });

    const cogMessage = Buffer.from('Cog3: Test\r\n');

    processor.receiveData(cogMessage);

    // Wait for Worker to process
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(receivedMessages.length).toBeGreaterThan(0);
    const message = receivedMessages[0];

    expect(message.type).toBe(MessageType.COG_MESSAGE);
    expect(Array.from(message.data)).toEqual(Array.from(cogMessage));
  });

  test('should process DB_PACKET via Worker Thread', async () => {
    receivedMessages = [];

    processor.registerDestination(MessageType.DB_PACKET, {
      name: 'DBTestHandler',
      handler: (message) => {
        receivedMessages.push(message);
      }
    });

    // DB_PACKET: 0xDB + length (5) + 5 bytes payload
    const dbPacket = Buffer.from([0xDB, 0x05, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);

    processor.receiveData(dbPacket);

    // Wait for Worker to process
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(receivedMessages.length).toBeGreaterThan(0);
    const message = receivedMessages[0];

    expect(message.type).toBe(MessageType.DB_PACKET);
    expect(Array.from(message.data)).toEqual(Array.from(dbPacket));
  });

  test('should handle multiple messages in sequence', async () => {
    receivedMessages = [];

    processor.registerDestination(MessageType.COG_MESSAGE, {
      name: 'CogHandler',
      handler: (message) => {
        receivedMessages.push(message);
      }
    });

    const messages = [
      Buffer.from('`window1\r\n'),
      Buffer.from('Cog0: test\r\n'),
      Buffer.from('`window2\r\n'),
      Buffer.from('Cog1: test\r\n')
    ];

    messages.forEach(msg => processor.receiveData(msg));

    // Wait for Worker to process all
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(receivedMessages.length).toBeGreaterThanOrEqual(2);
  });

  test('should report Worker Thread architecture in stats', () => {
    const stats = processor.getStats();

    expect(stats.buffer).toHaveProperty('architecture', 'Worker Thread');
    expect(stats.extractor).toHaveProperty('architecture', 'Worker Thread');
  });

  test('should report Worker Thread architecture in components', () => {
    const components = processor.getComponents();

    expect(components).toHaveProperty('architecture', 'Worker Thread');
    expect(components).toHaveProperty('workerExtractor');
    expect(components).not.toHaveProperty('buffer');
    expect(components).not.toHaveProperty('receiver');
    expect(components).not.toHaveProperty('extractor');
  });
});
