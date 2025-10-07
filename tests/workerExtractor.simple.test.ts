/**
 * @jest-environment node
 * @format
 */

// tests/workerExtractor.simple.test.ts

import { WorkerExtractor } from '../src/classes/shared/workerExtractor';

describe('WorkerExtractor Simple Test', () => {
  test('should create WorkerExtractor and wait for ready', async () => {
    const extractor = new WorkerExtractor();

    const readyPromise = new Promise<void>((resolve) => {
      extractor.once('workerReady', () => {
        console.log('Worker is ready!');
        resolve();
      });
    });

    extractor.on('workerError', (error) => {
      console.error('Worker error:', error);
    });

    // Wait for worker ready with timeout
    await Promise.race([
      readyPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker ready timeout')), 5000)
      )
    ]);

    const stats = extractor.getStats();
    console.log('Worker stats:', stats);

    expect(stats.workerReady).toBe(true);

    await extractor.shutdown();
  }, 10000);
});
