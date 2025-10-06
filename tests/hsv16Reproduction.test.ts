/** @format */

// tests/hsv16Reproduction.test.ts

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { SerialReceiver } from '../src/classes/shared/serialReceiver';
import { MessageExtractor, ExtractedMessage, MessageType } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';
import { MessageRouter, RouteDestination } from '../src/classes/shared/messageRouter';
import { PooledMessage, MessagePool } from '../src/classes/shared/messagePool';

/**
 * HSV16 Reproduction Test
 *
 * Reproduces the exact traffic from DEBUG_BITMAP_HSV16_Demo.spin2:
 * - 3 window creation messages (j, k, l)
 * - 65,536 data messages (`j k l $0 through `j k l $FFFF)
 *
 * Tracks message counts at each pipeline stage to identify where loss occurs:
 * 1. SerialReceiver → CircularBuffer (bytes written)
 * 2. CircularBuffer → MessageExtractor (bytes read)
 * 3. MessageExtractor → ExtractionQueue (messages extracted)
 * 4. ExtractionQueue → Router (messages routed)
 */

describe('HSV16 Traffic Reproduction', () => {
  let buffer: CircularBuffer;
  let receiver: SerialReceiver;
  let outputQueue: DynamicQueue<ExtractedMessage>;
  let extractor: MessageExtractor;
  let router: MessageRouter;

  // Pipeline tracking counters
  let bytesReceived = 0;
  let bytesWrittenToBuffer = 0;
  let messagesExtracted = 0;
  let messagesQueued = 0;
  let messagesRouted = 0;
  let messagesReceived = 0;  // Destination handler count

  beforeEach(() => {
    // Use large buffer (2MB) to ensure we don't overflow
    buffer = new CircularBuffer(2 * 1024 * 1024);
    receiver = new SerialReceiver(buffer);
    outputQueue = new DynamicQueue<ExtractedMessage>(1000, 10000, 'HSV16TestQueue');
    extractor = new MessageExtractor(buffer, outputQueue);

    // Create router and register destination handlers
    router = new MessageRouter(outputQueue);

    const windowDestination: RouteDestination = {
      name: 'HSV16_Windows',
      handler: (message: ExtractedMessage | PooledMessage) => {
        messagesReceived++;
        // Release pooled message if needed
        if ('poolId' in message && message.poolId !== undefined) {
          MessagePool.getInstance().release(message as PooledMessage);
        }
      }
    };

    router.registerDestination(MessageType.BACKTICK_WINDOW, windowDestination);

    // Reset counters
    bytesReceived = 0;
    bytesWrittenToBuffer = 0;
    messagesExtracted = 0;
    messagesQueued = 0;
    messagesRouted = 0;
    messagesReceived = 0;

    // Track bytes written to buffer
    receiver.on('dataReceived', (event: any) => {
      bytesWrittenToBuffer += event.bytes;
    });

    // Track messages extracted
    extractor.on('messagesExtracted', (count: number) => {
      messagesExtracted += count;
    });

    // Track messages routed
    router.on('batchProcessed', (count: number) => {
      messagesRouted += count;
    });
  });

  afterEach(() => {
    // Stop router adaptive timer to prevent lingering timers
    if (router) {
      router.stopAdaptiveTimer();
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
   * Generate data message with hex value (no leading zeros)
   */
  function generateDataMessage(value: number): Buffer {
    const hexStr = value.toString(16).toUpperCase();
    const msg = `\`j k l $${hexStr}\r\n`;
    return Buffer.from(msg);
  }

  test('reproduces complete HSV16 traffic - 3 windows + 65,536 messages with realistic USB timing', async () => {
    console.log('=== HSV16 Reproduction Test (Realistic USB Simulation) ===\n');

    // USB packet size (typical USB full-speed endpoint)
    const USB_PACKET_SIZE = 64;
    // 2 Mbps = 250,000 bytes/sec
    const BYTES_PER_SECOND = 250000;

    // STEP 1: Generate all messages
    console.log('Step 1: Generating all messages...');
    const allMessages: Buffer[] = [];

    // Window creation messages
    allMessages.push(generateWindowCreation('j', 'HSV16', 100, 985, 'hsv16'));
    allMessages.push(generateWindowCreation('k', 'HSV16W', 370, 985, 'hsv16w'));
    allMessages.push(generateWindowCreation('l', 'HSV16X', 640, 985, 'hsv16x'));

    // Data messages
    for (let i = 0; i <= 65535; i++) {
      allMessages.push(generateDataMessage(i));
    }

    const totalMessages = allMessages.length;
    console.log(`  Generated ${totalMessages} messages\n`);

    // STEP 2: Combine messages into single byte stream
    console.log('Step 2: Creating byte stream...');
    const totalBytes = allMessages.reduce((sum, msg) => sum + msg.length, 0);
    const byteStream = Buffer.concat(allMessages);
    console.log(`  Total size: ${totalBytes} bytes (${(totalBytes/1024).toFixed(1)} KB)`);
    console.log(`  Expected duration at 2 Mbps: ${((totalBytes / BYTES_PER_SECOND) * 1000).toFixed(0)}ms\n`);

    // STEP 3: Send in USB-sized packets (simulating real USB driver behavior)
    console.log('Step 3: Sending data in USB packets...');
    const startTime = Date.now();
    let offset = 0;
    let packetsSet = 0;

    while (offset < byteStream.length) {
      // Extract USB packet-sized chunk
      const chunkSize = Math.min(USB_PACKET_SIZE, byteStream.length - offset);
      const chunk = byteStream.slice(offset, offset + chunkSize);

      bytesReceived += chunk.length;
      receiver.receiveData(chunk);
      offset += chunkSize;
      packetsSet++;

      // Extract messages periodically (simulating extraction callback)
      if (packetsSet % 10 === 0) {
        extractor.extractMessages();

        // Route messages synchronously (matching production fix)
        router.processMessagesSync();

        if (packetsSet % 100 === 0) {
          const progress = (offset / byteStream.length) * 100;
          console.log(`  Progress: ${packetsSet} packets, ${offset}/${byteStream.length} bytes (${progress.toFixed(1)}%)`);
        }
      }
    }

    // Final extraction and routing (multiple passes to drain queue)
    extractor.extractMessages();
    for (let i = 0; i < 10; i++) {
      if (outputQueue.getSize() === 0) break;
      router.processMessagesSync();
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`\n  Sent ${packetsSet} USB packets in ${elapsedMs}ms`);

    // STEP 3: Report pipeline statistics
    const extractorStats = extractor.getStats();
    const messagesExtracted = extractorStats.messagesExtracted.BACKTICK_WINDOW;

    console.log('=== Pipeline Statistics ===');
    console.log(`Total bytes received:           ${bytesReceived}`);
    console.log(`Bytes written to CircularBuffer: ${bytesWrittenToBuffer}`);
    console.log(`Buffer stats:`, buffer.getStats());
    console.log(`Messages extracted:             ${messagesExtracted}`);
    console.log(`Messages routed by Router:      ${router.getStats().totalMessagesRouted}`);
    console.log(`Messages received by Windows:   ${messagesReceived}`);
    console.log(`Expected messages:              65539 (3 window creation + 65536 data)`);
    console.log(`Message loss:                   ${65539 - messagesReceived} (${((1 - messagesReceived/65539)*100).toFixed(1)}%)`);
    console.log(`Queue stats:`, outputQueue.getStats());
    console.log(`Extractor stats:`, extractorStats);
    console.log(`Router stats:`, router.getStats());

    // STEP 4: Verify results
    console.log('\n=== Verification ===');

    // Check if all bytes were written to buffer
    expect(bytesWrittenToBuffer).toBe(bytesReceived);
    console.log('✓ All bytes written to CircularBuffer');

    // Check for message loss
    if (messagesReceived < 65539) {
      console.log(`✗ MESSAGE LOSS DETECTED: ${65539 - messagesReceived} messages lost`);
      console.log('\nPipeline Analysis:');
      console.log(`- Bytes received by SerialReceiver: ${bytesReceived}`);
      console.log(`- Bytes written to CircularBuffer:  ${bytesWrittenToBuffer}`);
      console.log(`- Messages extracted:               ${messagesExtracted}`);
      console.log(`- Messages routed by Router:        ${router.getStats().totalMessagesRouted}`);
      console.log(`- Messages received by Windows:     ${messagesReceived}`);

      // Calculate where loss occurred
      const bufferUtilization = buffer.getStats();
      console.log(`\nBuffer Utilization:`);
      console.log(`- Used space: ${bufferUtilization.used} bytes`);
      console.log(`- Available: ${bufferUtilization.available} bytes`);
      console.log(`- Overflows: ${bufferUtilization.overflowCount}`);

      const extractorStats = extractor.getStats();
      console.log(`\nExtractor Statistics:`);
      console.log(`- BACKTICK_WINDOW: ${extractorStats.messagesExtracted.BACKTICK_WINDOW}`);
      console.log(`- TERMINAL_OUTPUT: ${extractorStats.messagesExtracted.TERMINAL_OUTPUT}`);
      console.log(`- Total bytes extracted: ${extractorStats.totalBytesExtracted}`);
      console.log(`- Partial message waits: ${extractorStats.partialMessageWaits}`);

      const queueStats = outputQueue.getStats();
      console.log(`\nQueue Statistics:`);
      console.log(`- Current size: ${queueStats.currentSize}`);
      console.log(`- Capacity: ${queueStats.capacity}`);
      console.log(`- High water mark: ${queueStats.highWaterMark}`);
      console.log(`- Dropped count: ${queueStats.droppedCount}`);
      console.log(`- Total enqueued: ${queueStats.totalEnqueued}`);
      console.log(`- Total dequeued: ${queueStats.totalDequeued}`);

      // Identify the bottleneck
      console.log(`\n=== BOTTLENECK ANALYSIS ===`);
      const routerStats = router.getStats();

      if (queueStats.droppedCount > 0) {
        console.log(`❌ BOTTLENECK: ExtractionQueue is full (dropped ${queueStats.droppedCount} messages)`);
      } else if (bufferUtilization.overflowCount > 0) {
        console.log(`❌ BOTTLENECK: CircularBuffer overflowed (${bufferUtilization.overflowCount} times)`);
      } else if (extractorStats.totalBytesExtracted < bytesReceived) {
        console.log(`❌ BOTTLENECK: MessageExtractor not extracting all bytes`);
        console.log(`   Expected: ${bytesReceived} bytes`);
        console.log(`   Extracted: ${extractorStats.totalBytesExtracted} bytes`);
        console.log(`   Missing: ${bytesReceived - extractorStats.totalBytesExtracted} bytes`);
      } else if (messagesExtracted > messagesReceived) {
        console.log(`❌ BOTTLENECK: Router async timing (messages extracted but not all routed to Windows)`);
        console.log(`   Messages extracted: ${messagesExtracted}`);
        console.log(`   Messages routed:    ${routerStats.totalMessagesRouted}`);
        console.log(`   Messages received:  ${messagesReceived}`);
        console.log(`   Router timing:      ${router.getTimerStatus().currentInterval}ms interval`);
        console.log(`   Message velocity:   ${router.getTimerStatus().messageVelocity} msg/sec`);
      } else {
        console.log(`❓ UNKNOWN: Bytes reached extractor but messages not extracted correctly`);
      }
    } else {
      console.log('✓ All 65,539 messages routed and received successfully!');
    }

    // This test documents the issue, so we expect it to fail until fixed
    // Comment this out once the issue is resolved:
    expect(messagesReceived).toBe(65539);
  }, 60000); // 60 second timeout for large test

  test('tracks message flow through pipeline stages', () => {
    console.log('\n=== Detailed Pipeline Tracking ===\n');

    // Send a small batch to verify pipeline tracking
    const testMessages = [
      generateWindowCreation('j', 'HSV16', 100, 985, 'hsv16'),
      generateDataMessage(0),
      generateDataMessage(1),
      generateDataMessage(2)
    ];

    let stage1_bytesReceived = 0;
    let stage2_bytesInBuffer = 0;
    let stage3_messagesExtracted = 0;
    let stage4_messagesQueued = 0;

    testMessages.forEach((msg, index) => {
      console.log(`\nMessage ${index + 1}: ${msg.toString().trim()}`);

      // STAGE 1: SerialReceiver receives bytes
      stage1_bytesReceived += msg.length;
      receiver.receiveData(msg);
      console.log(`  Stage 1 (Receive): +${msg.length} bytes → ${stage1_bytesReceived} total`);

      // STAGE 2: Bytes written to CircularBuffer
      stage2_bytesInBuffer = buffer.getUsedSpace();
      console.log(`  Stage 2 (Buffer):  ${stage2_bytesInBuffer} bytes in buffer`);

      // STAGE 3: MessageExtractor extracts messages
      extractor.extractMessages();
      const extractorStats = extractor.getStats();
      stage3_messagesExtracted = extractorStats.messagesExtracted.BACKTICK_WINDOW;
      console.log(`  Stage 3 (Extract): ${stage3_messagesExtracted} messages extracted`);

      // STAGE 4: Messages in queue
      stage4_messagesQueued = outputQueue.getSize();
      console.log(`  Stage 4 (Queue):   ${stage4_messagesQueued} messages queued`);
    });

    console.log('\n=== Pipeline Summary ===');
    console.log(`Total bytes received: ${stage1_bytesReceived}`);
    console.log(`Messages extracted:   ${stage3_messagesExtracted}`);
    console.log(`Messages queued:      ${stage4_messagesQueued}`);

    // Should have 4 messages total (1 window creation + 3 data)
    expect(stage4_messagesQueued).toBe(4);
  });
});
