/** @format */

// tests/hsv16Worker.test.ts

import { WorkerExtractor } from '../src/classes/shared/workerExtractor';

/**
 * HSV16 Worker Thread Test
 *
 * Tests the complete HSV16 data stream (65,536 messages) through the worker thread architecture.
 * Identifies where message loss occurs in the pipeline.
 */

describe('HSV16 Worker Thread Test', () => {
  let extractor: WorkerExtractor;
  let messagesReceived: any[] = [];
  let messagesByType: { [key: string]: number } = {};

  beforeEach((done) => {
    messagesReceived = [];
    messagesByType = {};

    // Use large buffer (10MB) to ensure no overflow
    extractor = new WorkerExtractor(10 * 1024 * 1024);

    // Wait for worker to be ready
    extractor.on('workerReady', () => {
      console.log('✓ Worker ready');
      done();
    });

    // Collect extracted messages - CORRECT: receive poolId, get from pool, release
    extractor.on('messageExtracted', (poolId: number) => {
      const messagePool = extractor.getMessagePool();
      const slot = messagePool.get(poolId);

      const type = slot.readType();
      const data = slot.readData();

      messagesReceived.push({
        type,
        data,
        timestamp: Date.now()
      });
      messagesByType[type] = (messagesByType[type] || 0) + 1;

      // CRITICAL: Release message back to pool
      messagePool.release(poolId);
    });

    // Set timeout in case worker doesn't initialize
    setTimeout(() => {
      done(new Error('Worker failed to initialize within 10 seconds'));
    }, 10000);
  });

  afterEach(async () => {
    if (extractor) {
      await extractor.shutdown();
    }
  });

  /**
   * Generate window creation message
   */
  function generateWindowCreation(name: string, title: string, x: number, y: number, format: string): Buffer {
    const msg = `\`bitmap ${name} title '${title}' pos ${x} ${y} size 256 256 trace 4 ${format}\r\n`;
    return Buffer.from(msg);
  }

  /**
   * Generate data message with hex value (no leading zeros - matches P2 output)
   */
  function generateDataMessage(value: number): Buffer {
    const hexStr = value.toString(16).toUpperCase();
    const msg = `\`j k l $${hexStr}\r\n`;
    return Buffer.from(msg);
  }

  test('processes complete HSV16 dataset - 3 windows + 65,536 data messages', (done) => {
    console.log('\n=== HSV16 Complete Dataset Test ===\n');

    const EXPECTED_WINDOW_MESSAGES = 3;
    const EXPECTED_DATA_MESSAGES = 65536;
    const EXPECTED_TOTAL = EXPECTED_WINDOW_MESSAGES + EXPECTED_DATA_MESSAGES;

    // STEP 1: Generate all messages
    console.log('Step 1: Generating messages...');
    const allMessages: Buffer[] = [];

    // Window creation messages
    allMessages.push(generateWindowCreation('j', 'HSV16', 100, 985, 'hsv16'));
    allMessages.push(generateWindowCreation('k', 'HSV16W', 370, 985, 'hsv16w'));
    allMessages.push(generateWindowCreation('l', 'HSV16X', 640, 985, 'hsv16x'));

    // Data messages ($0 through $FFFF)
    for (let i = 0; i <= 65535; i++) {
      allMessages.push(generateDataMessage(i));
    }

    console.log(`  Generated ${allMessages.length} messages (${EXPECTED_TOTAL} expected)\n`);

    // STEP 2: Create byte stream
    console.log('Step 2: Creating byte stream...');
    const totalBytes = allMessages.reduce((sum, msg) => sum + msg.length, 0);
    const byteStream = Buffer.concat(allMessages);
    console.log(`  Total size: ${(totalBytes / 1024).toFixed(1)} KB (${totalBytes} bytes)\n`);

    // STEP 3: Send data in USB-sized packets (64 bytes) to simulate real conditions
    console.log('Step 3: Sending data in USB packets...');
    const USB_PACKET_SIZE = 64;
    const startTime = Date.now();
    let offset = 0;
    let packetsSent = 0;

    while (offset < byteStream.length) {
      const chunkSize = Math.min(USB_PACKET_SIZE, byteStream.length - offset);
      const chunk = byteStream.slice(offset, offset + chunkSize);

      extractor.receiveData(chunk);
      offset += chunkSize;
      packetsSent++;

      // Progress logging every 500 packets
      if (packetsSent % 500 === 0) {
        const progress = (offset / byteStream.length) * 100;
        console.log(`  Progress: ${packetsSent} packets, ${(offset / 1024).toFixed(1)} KB (${progress.toFixed(1)}%)`);
      }
    }

    const sendTime = Date.now() - startTime;
    console.log(`\n  Sent ${packetsSent} USB packets in ${sendTime}ms`);
    console.log(`  Average: ${(totalBytes / sendTime).toFixed(0)} bytes/ms (${((totalBytes / sendTime) * 1000 / 1024).toFixed(0)} KB/sec)\n`);

    // STEP 4: Wait for worker to process all messages
    console.log('Step 4: Waiting for worker extraction (5 seconds)...');

    setTimeout(() => {
      const elapsedTotal = Date.now() - startTime;

      console.log('\n=== Extraction Complete ===\n');
      console.log('Results:');
      console.log(`  Messages extracted:     ${messagesReceived.length}`);
      console.log(`  Expected messages:      ${EXPECTED_TOTAL}`);
      console.log(`  Message loss:           ${EXPECTED_TOTAL - messagesReceived.length} (${((1 - messagesReceived.length / EXPECTED_TOTAL) * 100).toFixed(1)}%)`);
      console.log(`  Total time:             ${elapsedTotal}ms`);
      console.log('\nBy Message Type:');
      Object.keys(messagesByType).forEach(type => {
        console.log(`  ${type}: ${messagesByType[type]}`);
      });

      // Get worker stats
      const stats = extractor.getStats();
      console.log('\nWorker Statistics:');
      console.log(`  Worker ready:           ${stats.workerReady}`);
      console.log(`  Total bytes received:   ${stats.totalBytesReceived}`);
      console.log(`  Total messages extracted: ${stats.totalMessagesExtracted}`);
      console.log(`  Buffer stats:`, stats.bufferStats);
      console.log(`  Buffer overflows:       ${stats.bufferOverflows}`);

      // STEP 5: Analyze results
      console.log('\n=== Analysis ===');

      // Check if we got the LAST messages (like production did)
      console.log('\nSequence Analysis (first 10 and last 10 data messages):');
      const dataMessages = messagesReceived.filter(m => {
        const text = new TextDecoder().decode(m.data);
        return text.match(/`j k l \$/);
      });

      console.log(`  Total data messages: ${dataMessages.length}`);

      if (dataMessages.length > 0) {
        console.log('\n  First 10 data messages:');
        for (let i = 0; i < Math.min(10, dataMessages.length); i++) {
          const text = new TextDecoder().decode(dataMessages[i].data);
          console.log(`    ${i}: ${text.trim()}`);
        }

        console.log('\n  Last 10 data messages:');
        const startIdx = Math.max(0, dataMessages.length - 10);
        for (let i = startIdx; i < dataMessages.length; i++) {
          const text = new TextDecoder().decode(dataMessages[i].data);
          console.log(`    ${i}: ${text.trim()}`);
        }
      }

      // CORRUPTION DETECTION: Verify message content matches expected
      console.log('\n=== Corruption Detection ===');
      let corruptionCount = 0;
      const corruptionExamples: string[] = [];

      for (const msg of dataMessages) {
        const text = new TextDecoder().decode(msg.data);
        const match = text.match(/`j k l \$([0-9A-F]+)/);

        if (!match) {
          corruptionCount++;
          if (corruptionExamples.length < 10) {
            corruptionExamples.push(`Malformed: "${text.trim()}"`);
          }
          continue;
        }

        const hexValue = match[1];
        const value = parseInt(hexValue, 16);

        // Verify value is in valid range (0-65535)
        if (value < 0 || value > 65535) {
          corruptionCount++;
          if (corruptionExamples.length < 10) {
            corruptionExamples.push(`Out of range: $${hexValue} (${value})`);
          }
        }

        // Verify window names are correct (should be 'j k l')
        const windowPart = text.substring(1, text.indexOf('$')).trim();
        if (windowPart !== 'j k l') {
          corruptionCount++;
          if (corruptionExamples.length < 10) {
            corruptionExamples.push(`Wrong windows: "${windowPart}" in "${text.trim()}"`);
          }
        }
      }

      console.log(`  Corrupted messages found: ${corruptionCount}/${dataMessages.length}`);
      if (corruptionCount > 0) {
        console.log('\n  Corruption examples:');
        corruptionExamples.forEach(ex => console.log(`    ${ex}`));
      } else {
        console.log('  ✓ No corruption detected - all messages valid!');
      }

      if (messagesReceived.length === EXPECTED_TOTAL) {
        console.log('\n✓ SUCCESS: All messages extracted correctly!');
      } else {
        console.log(`✗ FAILURE: Lost ${EXPECTED_TOTAL - messagesReceived.length} messages`);

        if (stats.bufferOverflows > 0) {
          console.log(`\n❌ BOTTLENECK: SharedCircularBuffer overflowed ${stats.bufferOverflows} times`);
          console.log('   → Buffer is too small or worker can\'t keep up with data rate');
        } else {
          console.log('\n❓ Buffer did not overflow - messages lost elsewhere in pipeline');
          console.log('   → Check worker extraction logic or message pool');
        }

        // Sample unique values if possible
        const uniqueValues = new Set(messagesReceived.map(m => {
          const text = new TextDecoder().decode(m.data);
          const match = text.match(/\$([0-9A-F]+)/);
          return match ? match[1] : null;
        }).filter(v => v !== null));

        console.log(`\n  Unique data values received: ${uniqueValues.size} (expected 65536)`);

        // Find gaps in sequence
        const values = Array.from(uniqueValues).map(v => parseInt(v as string, 16)).sort((a, b) => a - b);
        if (values.length > 0) {
          console.log(`  Value range: $${values[0].toString(16).toUpperCase()} to $${values[values.length - 1].toString(16).toUpperCase()}`);

          // Check for gaps
          let gaps = 0;
          for (let i = 1; i < values.length; i++) {
            if (values[i] !== values[i-1] + 1) {
              gaps++;
              if (gaps <= 5) { // Show first 5 gaps
                console.log(`  Gap: $${values[i-1].toString(16).toUpperCase()} → $${values[i].toString(16).toUpperCase()}`);
              }
            }
          }
          if (gaps > 5) {
            console.log(`  ... and ${gaps - 5} more gaps`);
          }
        }
      }

      // FINAL CHECK: Verify we have all values from $0 to $FFFF (no duplicates/gaps)
      console.log('\n=== Sequence Completeness Check ===');
      const values = new Set<number>();
      for (const msg of dataMessages) {
        const text = new TextDecoder().decode(msg.data);
        const match = text.match(/\$([0-9A-F]+)/);
        if (match) {
          const value = parseInt(match[1], 16);
          values.add(value);
        }
      }

      const uniqueValues = Array.from(values).sort((a, b) => a - b);
      console.log(`  Unique values received: ${uniqueValues.length} (expected 65536)`);
      console.log(`  Value range: $${uniqueValues[0]?.toString(16).toUpperCase()} to $${uniqueValues[uniqueValues.length - 1]?.toString(16).toUpperCase()}`);

      // Check for gaps in sequence
      const gaps: string[] = [];
      for (let i = 0; i <= 65535; i++) {
        if (!values.has(i)) {
          if (gaps.length < 10) {
            gaps.push(`$${i.toString(16).toUpperCase()}`);
          }
        }
      }

      if (gaps.length > 0) {
        console.log(`  ❌ Missing values: ${65536 - uniqueValues.length}`);
        console.log(`  First 10 missing: ${gaps.join(', ')}`);
      } else {
        console.log(`  ✓ Complete sequence: All values from $0 to $FFFF present!`);
      }

      // Verify test expectations
      expect(messagesReceived.length).toBe(EXPECTED_TOTAL);
      expect(stats.bufferOverflows).toBe(0);
      expect(corruptionCount).toBe(0);

      done();
    }, 5000); // Wait 5 seconds for extraction
  }, 30000); // 30 second test timeout

  test('verifies message extraction rate for HSV16 workload', (done) => {
    console.log('\n=== Message Extraction Rate Test ===\n');

    // Send smaller batch to measure extraction rate
    const TEST_COUNT = 1000;
    const messages: Buffer[] = [];

    for (let i = 0; i < TEST_COUNT; i++) {
      messages.push(generateDataMessage(i));
    }

    const startTime = Date.now();
    messages.forEach(msg => extractor.receiveData(msg));
    const sendTime = Date.now() - startTime;

    console.log(`Sent ${TEST_COUNT} messages in ${sendTime}ms`);

    setTimeout(() => {
      const extractTime = Date.now() - startTime;
      const extractionRate = (messagesReceived.length / extractTime) * 1000; // messages per second

      console.log(`Extracted ${messagesReceived.length} messages in ${extractTime}ms`);
      console.log(`Extraction rate: ${extractionRate.toFixed(0)} messages/sec`);
      console.log(`Time per message: ${(extractTime / messagesReceived.length).toFixed(3)}ms`);

      const stats = extractor.getStats();
      console.log('\nBuffer Stats:', stats.bufferStats);

      // For 65,536 messages, at this rate it would take:
      const projectedTime = (65536 / extractionRate) * 1000;
      console.log(`\nProjected time for 65,536 messages: ${projectedTime.toFixed(0)}ms`);

      expect(messagesReceived.length).toBe(TEST_COUNT);
      expect(stats.bufferOverflows).toBe(0);

      done();
    }, 2000);
  }, 10000);
});
