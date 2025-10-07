/** @format */

// tests/workerExtraction.test.ts

import { WorkerExtractor } from '../src/classes/shared/workerExtractor';

/**
 * Test Worker-based message extraction
 *
 * Verifies:
 * 1. Worker can be created and initialized
 * 2. Messages can be extracted from SharedCircularBuffer
 * 3. No data loss with Worker approach
 * 4. Performance is acceptable
 */

describe('Worker-based Extraction', () => {
  let extractor: WorkerExtractor;
  let messagesReceived: any[] = [];

  beforeEach((done) => {
    messagesReceived = [];
    extractor = new WorkerExtractor(1024 * 1024); // 1MB buffer

    // Wait for worker to be ready
    extractor.on('workerReady', () => {
      done();
    });

    // Collect extracted messages
    extractor.on('messageExtracted', (message) => {
      messagesReceived.push(message);
    });

    // Set timeout in case worker doesn't initialize
    setTimeout(() => {
      if (!extractor) {
        done(new Error('Worker failed to initialize within 5 seconds'));
      }
    }, 5000);
  });

  afterEach(async () => {
    if (extractor) {
      await extractor.shutdown();
    }
  });

  test('initializes worker successfully', () => {
    const stats = extractor.getStats();
    expect(stats.workerReady).toBe(true);
  });

  test('extracts simple backtick message', (done) => {
    const message = Buffer.from('`test message\r\n');

    extractor.receiveData(message);

    // Wait for extraction
    setTimeout(() => {
      expect(messagesReceived.length).toBe(1);
      expect(messagesReceived[0].type).toBe('BACKTICK_WINDOW');
      expect(messagesReceived[0].data.length).toBe(message.length);
      done();
    }, 100);
  });

  test('extracts multiple messages', (done) => {
    const messages = [
      Buffer.from('`message 1\r\n'),
      Buffer.from('`message 2\r\n'),
      Buffer.from('`message 3\r\n')
    ];

    messages.forEach(msg => extractor.receiveData(msg));

    // Wait for extraction
    setTimeout(() => {
      expect(messagesReceived.length).toBe(3);
      messagesReceived.forEach((msg, i) => {
        expect(msg.type).toBe('BACKTICK_WINDOW');
      });
      done();
    }, 200);
  });

  test('handles HSV16 message format (no leading zeros)', (done) => {
    const hsv16Messages = [
      Buffer.from('`j k l $0\r\n'),
      Buffer.from('`j k l $A\r\n'),
      Buffer.from('`j k l $10\r\n'),
      Buffer.from('`j k l $FF\r\n'),
      Buffer.from('`j k l $100\r\n'),
      Buffer.from('`j k l $FFFF\r\n')
    ];

    hsv16Messages.forEach(msg => extractor.receiveData(msg));

    // Wait for extraction
    setTimeout(() => {
      expect(messagesReceived.length).toBe(6);
      messagesReceived.forEach((msg) => {
        expect(msg.type).toBe('BACKTICK_WINDOW');
      });
      done();
    }, 200);
  });

  test('handles rapid message arrival', (done) => {
    const count = 1000;
    const messages: Buffer[] = [];

    // Generate 1000 messages
    for (let i = 0; i < count; i++) {
      messages.push(Buffer.from(`\`msg ${i}\r\n`));
    }

    // Send all messages rapidly
    const start = Date.now();
    messages.forEach(msg => extractor.receiveData(msg));
    const sendTime = Date.now() - start;

    console.log(`Sent ${count} messages in ${sendTime}ms`);

    // Wait for extraction (give it plenty of time)
    setTimeout(() => {
      const stats = extractor.getStats();
      console.log(`Extracted ${messagesReceived.length} of ${count} messages`);
      console.log('Buffer stats:', stats.bufferStats);

      // Should extract all messages
      expect(messagesReceived.length).toBe(count);
      expect(stats.bufferOverflows).toBe(0);

      done();
    }, 2000); // 2 seconds should be plenty
  }, 10000); // 10 second test timeout

  test('handles partial messages correctly', (done) => {
    // Send incomplete message first
    extractor.receiveData(Buffer.from('`incomplete'));

    setTimeout(() => {
      // Should not have extracted anything yet
      expect(messagesReceived.length).toBe(0);

      // Complete the message
      extractor.receiveData(Buffer.from(' message\r\n'));

      setTimeout(() => {
        // Now should have the complete message
        expect(messagesReceived.length).toBe(1);
        expect(messagesReceived[0].data.length).toBe(21); // Full message length
        done();
      }, 100);
    }, 100);
  });

  test('performance: main thread receiveData is fast', () => {
    const data = Buffer.from('`test message\r\n');
    const iterations = 1000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      extractor.receiveData(data);
    }
    const end = performance.now();

    const avgTime = (end - start) / iterations;
    console.log(`Average receiveData() time: ${avgTime.toFixed(3)}ms`);

    // Should be very fast (target <0.5ms)
    expect(avgTime).toBeLessThan(1.0);
  });
});
