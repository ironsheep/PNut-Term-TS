/** @format */

// tests/workerExtraction.test.ts

import { WorkerExtractor } from '../src/classes/shared/workerExtractor';

/**
 * Test Worker-based message extraction.
 *
 * Verifies the CURRENT WorkerExtractor contract:
 *   1. The worker initializes and signals 'workerReady'.
 *   2. Complete messages written to the SharedCircularBuffer are extracted and
 *      delivered as poolIds via 'messageExtracted'; each poolId is a readable
 *      SharedMessagePool slot (zero-copy hand-off).
 *   3. No data loss under rapid arrival.
 *   4. Partial (incomplete) messages are buffered until completed.
 *   5. The main-thread receiveData() fast path stays cheap.
 *
 * NOTE: 'messageExtracted' emits a poolId (number) — the consumer reads the
 * message from the SharedMessagePool and releases the slot. (The pre-pool API
 * that emitted a {type,data} object no longer exists.) Waits are event-driven
 * rather than fixed timers so the worker's cold-start latency cannot make them
 * flaky.
 */

describe('Worker-based Extraction', () => {
  let extractor: WorkerExtractor;
  let messagesReceived: Array<{ poolId: number; type: number; length: number }> = [];

  beforeEach((done) => {
    messagesReceived = [];
    extractor = new WorkerExtractor(1024 * 1024); // 1MB ring buffer

    extractor.on('workerReady', () => done());

    // Current consumer pattern: read the extracted message from the pool by
    // poolId, record it, then release the slot so the worker can reuse it.
    extractor.on('messageExtracted', (poolId: number) => {
      const pool = extractor.getMessagePool();
      const type = pool.getMessageType(poolId);
      const length = pool.get(poolId).readData().length;
      messagesReceived.push({ poolId, type, length });
      pool.release(poolId);
    });

    // Fail fast if the worker never signals ready.
    setTimeout(() => {
      if (!extractor.getStats().workerReady) {
        done(new Error('Worker failed to initialize within 5 seconds'));
      }
    }, 5000);
  });

  afterEach(async () => {
    if (extractor) {
      await extractor.shutdown();
    }
  });

  /** Resolve once at least `count` messages have been extracted (event-driven). */
  function waitForMessages(count: number, timeoutMs = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (messagesReceived.length >= count) return resolve();
      const onMsg = (): void => {
        if (messagesReceived.length >= count) {
          extractor.off('messageExtracted', onMsg);
          clearTimeout(timer);
          resolve();
        }
      };
      const timer = setTimeout(() => {
        extractor.off('messageExtracted', onMsg);
        if (messagesReceived.length >= count) resolve();
        else reject(new Error(`Timeout: expected ${count} messages, got ${messagesReceived.length}`));
      }, timeoutMs);
      extractor.on('messageExtracted', onMsg);
    });
  }

  test('initializes worker successfully', () => {
    expect(extractor.getStats().workerReady).toBe(true);
  });

  test('extracts a simple backtick message', async () => {
    extractor.receiveData(Buffer.from('`test message\r\n'));
    await waitForMessages(1);
    expect(messagesReceived).toHaveLength(1);
    expect(messagesReceived[0].length).toBeGreaterThan(0);
  });

  test('extracts multiple messages', async () => {
    ['`message 1\r\n', '`message 2\r\n', '`message 3\r\n'].forEach((m) =>
      extractor.receiveData(Buffer.from(m))
    );
    await waitForMessages(3);
    expect(messagesReceived).toHaveLength(3);
  });

  test('handles HSV16 message format (no leading zeros)', async () => {
    ['`j k l $0\r\n', '`j k l $A\r\n', '`j k l $10\r\n', '`j k l $FF\r\n', '`j k l $100\r\n', '`j k l $FFFF\r\n'].forEach(
      (m) => extractor.receiveData(Buffer.from(m))
    );
    await waitForMessages(6);
    expect(messagesReceived).toHaveLength(6);
  });

  test('handles rapid message arrival', async () => {
    const count = 1000;
    for (let i = 0; i < count; i++) {
      extractor.receiveData(Buffer.from(`\`msg ${i}\r\n`));
    }
    await waitForMessages(count, 10000);
    expect(messagesReceived).toHaveLength(count);
    expect(extractor.getStats().bufferOverflows).toBe(0);
  }, 15000);

  test('handles partial messages correctly', async () => {
    // An incomplete line (no CR/LF) must NOT be extracted yet.
    extractor.receiveData(Buffer.from('`incomplete'));
    await new Promise((r) => setTimeout(r, 300));
    expect(messagesReceived).toHaveLength(0);

    // Completing it yields exactly one message.
    extractor.receiveData(Buffer.from(' message\r\n'));
    await waitForMessages(1);
    expect(messagesReceived).toHaveLength(1);
    expect(messagesReceived[0].length).toBeGreaterThan(0);
  });

  test('performance: main thread receiveData is fast', () => {
    const data = Buffer.from('`test message\r\n');
    const iterations = 1000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      extractor.receiveData(data);
    }
    const avgTime = (performance.now() - start) / iterations;
    expect(avgTime).toBeLessThan(1.0);
  });
});
