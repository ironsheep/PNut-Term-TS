/**
 * @format
 * @jest-environment node
 */

// tests/rxBackpressure.test.ts
//
// [#30] Receive-pipeline backpressure (NO DROP) under sustained load.
//
// Forces BOTH backpressure points at once:
//   - SharedMessagePool full  → worker stashes one message + stops extracting (no drop)
//   - SAB ring full           → main holds chunks in an ordered queue (no drop, no block)
// by combining a SMALL ring (64 KB) with MORE messages than pool slots (20,000 > 10,500),
// blasted in a tight synchronous burst so the worker saturates the pool before main consumes.
//
// Pre-fix behavior: "[ExtractionWorker] Pool exhausted ... message lost!" +
// "[CircularBuffer] FULL CAPACITY" → missing values. Post-fix: byte-perfect, complete sequence.

import { WorkerExtractor } from '../src/classes/shared/workerExtractor';

describe('[#30] RX backpressure — lossless under pool+ring saturation', () => {
  let extractor: WorkerExtractor;
  const received: number[] = []; // parsed hex values, in arrival order
  let toRelease: number[] = []; // poolIds awaiting throttled release
  let pumpStop = false;

  beforeEach((done) => {
    received.length = 0;
    toRelease = [];
    pumpStop = false;

    // SMALL ring (64 KB) so the main-side hold-queue is exercised, not just the pool.
    extractor = new WorkerExtractor(64 * 1024);

    // CONSUMER SLOWER THAN PRODUCER: read each message immediately (value captured now) but DEFER
    // the pool release. A wall-clock-paced pump frees ~8,000 slots/sec while the worker extracts
    // ~20,000/sec → the 10,500-slot pool saturates → worker must stash + the 64 KB ring must queue.
    // This is the real 2M-baud condition (main can't keep up) that used to DROP; with backpressure
    // it must not. (We pace with setImmediate, not setInterval — timers starve under main load and
    // made the drain nondeterministic; setImmediate runs every loop iteration regardless.)
    extractor.on('messageExtracted', (poolId: number) => {
      const slot = extractor.getMessagePool().get(poolId);
      const text = new TextDecoder().decode(slot.readData());
      const m = text.match(/\$([0-9A-Fa-f]+)/);
      if (m) received.push(parseInt(m[1], 16));
      toRelease.push(poolId); // defer release → backpressure
    });

    let lastTick = Date.now();
    let budget = 0; // fractional slot-release credits
    const pump = (): void => {
      if (pumpStop || !extractor) return;
      const now = Date.now();
      budget = Math.min(budget + (now - lastTick) * 8, 8000); // 8/ms = 8,000/sec, capped
      lastTick = now;
      const pool = extractor.getMessagePool();
      while (budget >= 1 && toRelease.length > 0) {
        pool.release(toRelease.shift()!);
        budget -= 1;
      }
      setImmediate(pump);
    };
    setImmediate(pump);

    const initTimer = setTimeout(() => done(new Error('worker init timeout')), 10000);
    extractor.on('workerReady', () => {
      clearTimeout(initTimer);
      done();
    });
  });

  afterEach(async () => {
    pumpStop = true;
    if (extractor) await extractor.shutdown();
  });

  function dataMsg(value: number): Buffer {
    return Buffer.from(`\`j k l $${value.toString(16).toUpperCase()}\r\n`);
  }

  test('20,000 messages through a 64 KB ring + 10,500-slot pool → zero loss, complete sequence', (done) => {
    const COUNT = 20000; // > pool slots (10,500) → pool MUST saturate under a fast producer

    // Blast every message in one synchronous burst, split into 64-byte USB-sized packets.
    const stream = Buffer.concat(Array.from({ length: COUNT }, (_, i) => dataMsg(i)));
    const PKT = 64;
    for (let off = 0; off < stream.length; off += PKT) {
      extractor.receiveData(stream.subarray(off, Math.min(off + PKT, stream.length)));
    }

    // Allow the pipeline to fully drain under backpressure.
    setTimeout(() => {
      try {
        const stats = extractor.getStats();
        const seen = new Set(received);
        const missing: number[] = [];
        for (let i = 0; i < COUNT && missing.length < 10; i++) {
          if (!seen.has(i)) missing.push(i);
        }

        // On failure, surface where the backlog ended up to localize a regression.
        if (seen.size !== COUNT || stats.bufferOverflows !== 0) {
          process.stderr.write(
            `[rxBackpressure] received=${received.length}/${COUNT} missing(first)=${missing} ` +
              `bufferOverflows=${stats.bufferOverflows} ` +
              JSON.stringify(extractor.getBackpressureDebug()) +
              '\n'
          );
        }

        expect(stats.bufferOverflows).toBe(0); // ring never took the destructive overflow path
        expect(missing).toEqual([]); // complete, contiguous sequence
        expect(seen.size).toBe(COUNT);
        expect(received.length).toBe(COUNT);
        done();
      } catch (err) {
        done(err as Error);
      }
    }, 10000);
  }, 30000);
});
