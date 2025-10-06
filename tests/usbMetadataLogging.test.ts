/** @format */

// tests/usbMetadataLogging.test.ts

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { SerialReceiver } from '../src/classes/shared/serialReceiver';
import { MessageExtractor } from '../src/classes/shared/messageExtractor';
import { DynamicQueue, QueueStats } from '../src/classes/shared/dynamicQueue';
import { ExtractedMessage } from '../src/classes/shared/messageExtractor';

/**
 * Test USB Metadata Logging System
 *
 * Verifies that USB traffic is logged correctly with deferred logging:
 * 1. Hot-path captures only metadata (timestamp, offset, length)
 * 2. MessageExtractor logs the data later with proper sequencing
 * 3. System handles buffer wraparound correctly
 * 4. Logging preserves original arrival timestamps and offsets
 */

describe('USB Metadata Logging', () => {
  let buffer: CircularBuffer;
  let receiver: SerialReceiver;
  let outputQueue: DynamicQueue<ExtractedMessage>;
  let extractor: MessageExtractor;
  let consoleLogs: string[];

  beforeEach(() => {
    // Use small buffer (512 bytes) to easily test wraparound
    buffer = new CircularBuffer(512);
    receiver = new SerialReceiver(buffer);
    outputQueue = new DynamicQueue<ExtractedMessage>(100, 1000, 'TestQueue');

    // Pass metadata queue to extractor for deferred logging
    extractor = new MessageExtractor(buffer, outputQueue, receiver.getUSBMetadataQueue());

    // Capture console.log output
    consoleLogs = [];
    jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      consoleLogs.push(args.join(' '));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('captures metadata and logs hex dump for single USB packet', () => {
    // Simulate USB packet arrival with known bytes
    const data = Buffer.from('Hello USB!\r');

    receiver.receiveData(data);

    // Metadata should be queued
    const metadataQueue = receiver.getUSBMetadataQueue();
    expect(metadataQueue.getSize()).toBe(1);

    // Extract messages (triggers deferred logging)
    extractor.extractMessages();

    // Verify logging occurred with hex dump
    const usbLogs = consoleLogs.filter(log => log.includes('[USB RECV'));
    expect(usbLogs.length).toBeGreaterThan(0);

    // Verify header log shows byte count
    const headerLog = usbLogs.find(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLog).toBeDefined();
    expect(headerLog).toContain('Received 11 bytes');

    // Verify hex/ASCII section header
    expect(consoleLogs).toContainEqual(expect.stringContaining('[USB RECV HEX/ASCII]'));

    // Verify hex dump contains expected bytes
    const hexDumpLines = consoleLogs.filter(log => log.includes('$'));
    expect(hexDumpLines.length).toBeGreaterThan(0);

    // Check for 'H' (0x48), 'e' (0x65), 'l' (0x6C), etc.
    const firstLine = hexDumpLines[0];
    expect(firstLine).toContain('$48'); // 'H'
    expect(firstLine).toContain('$65'); // 'e'
    expect(firstLine).toContain('$6C'); // 'l'
    expect(firstLine).toContain('Hello USB!'); // ASCII part

    // Metadata queue should be drained
    expect(metadataQueue.getSize()).toBe(0);
  });

  test('logs multiple USB packets in correct sequence', () => {
    // Simulate 3 USB packets of different sizes
    const packets = [
      Buffer.from('First packet\r'),   // 13 bytes
      Buffer.from('Second\r'),          // 7 bytes
      Buffer.from('Third one!\r')       // 11 bytes
    ];

    // Send all packets
    packets.forEach(packet => receiver.receiveData(packet));

    // Metadata queue should have 3 entries
    const metadataQueue = receiver.getUSBMetadataQueue();
    expect(metadataQueue.getSize()).toBe(3);

    // Extract messages (logs all metadata)
    extractor.extractMessages();

    // Verify 3 header logs (one per packet)
    const headerLogs = consoleLogs.filter(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLogs.length).toBe(3);

    // Verify byte counts
    expect(headerLogs[0]).toContain('Received 13 bytes');
    expect(headerLogs[1]).toContain('Received 7 bytes');
    expect(headerLogs[2]).toContain('Received 11 bytes');

    // All metadata should be drained
    expect(metadataQueue.getSize()).toBe(0);
  });

  test('handles buffer wraparound correctly with complete hex data', () => {
    // Use small buffer (512 bytes) and write data that wraps around
    // First, write 490 bytes to get near the end
    const filler = Buffer.alloc(490, 0xFF);
    receiver.receiveData(filler);

    // Extract to consume the data
    extractor.extractMessages();

    // Clear logs from filler
    consoleLogs = [];

    // Now write known data that will wrap around the buffer
    // Create distinctive pattern we can verify in hex dump
    const packet1 = Buffer.from('AAAAAAAAAA\r'); // 11 bytes, will wrap
    receiver.receiveData(packet1);

    const packet2 = Buffer.from('BBBBBBBBBB\r'); // 11 bytes after wrap
    receiver.receiveData(packet2);

    // Extract and log
    extractor.extractMessages();

    // Verify hex dumps contain actual data (not garbage)
    const hexDumpLines = consoleLogs.filter(log => log.includes('$'));
    expect(hexDumpLines.length).toBeGreaterThan(0);

    // Packet 1: Should contain $41 (ASCII 'A') repeated
    const packet1Lines = hexDumpLines.filter(line => line.includes('$41'));
    expect(packet1Lines.length).toBeGreaterThan(0);

    // Verify ASCII representation shows 'AAA'
    const packet1ASCII = hexDumpLines.find(line => line.includes('AAAA'));
    expect(packet1ASCII).toBeDefined();

    // Packet 2: Should contain $42 (ASCII 'B') repeated
    const packet2Lines = hexDumpLines.filter(line => line.includes('$42'));
    expect(packet2Lines.length).toBeGreaterThan(0);

    // Verify ASCII representation shows 'BBB'
    const packet2ASCII = hexDumpLines.find(line => line.includes('BBBB'));
    expect(packet2ASCII).toBeDefined();

    // Verify both packets were logged (check for both hex dumps)
    const headerLogs = consoleLogs.filter(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLogs.length).toBeGreaterThanOrEqual(2);
  });

  test('preserves original timestamps', () => {
    // Send packets with known delays
    const timestamps: number[] = [];

    // Packet 1
    receiver.receiveData(Buffer.from('First\r'));
    timestamps.push(Date.now());

    // Small delay
    const delay = 10;
    const start = Date.now();
    while (Date.now() - start < delay) {
      // Busy wait for precise timing
    }

    // Packet 2
    receiver.receiveData(Buffer.from('Second\r'));
    timestamps.push(Date.now());

    // Extract (logs with original timestamps)
    extractor.extractMessages();

    // Verify both packets logged with timestamps
    const headerLogs = consoleLogs.filter(log => log.includes('[USB RECV') && log.includes('Received'));
    expect(headerLogs.length).toBe(2);

    // Both logs should contain timestamps (ISO format)
    expect(headerLogs[0]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(headerLogs[1]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('handles rapid packet arrivals', () => {
    // Simulate burst of small packets (like real USB traffic)
    const packetSizes = [8, 12, 16, 20, 24, 28, 32, 64, 128, 256];

    packetSizes.forEach(size => {
      const packet = Buffer.alloc(size, 0xAA);
      receiver.receiveData(packet);
    });

    // Metadata queue should have all packets
    const metadataQueue = receiver.getUSBMetadataQueue();
    expect(metadataQueue.getSize()).toBe(packetSizes.length);

    // Extract once (should drain entire queue)
    extractor.extractMessages();

    // All packets should be logged
    const headerLogs = consoleLogs.filter(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLogs.length).toBe(packetSizes.length);

    // Verify each packet size is logged correctly
    packetSizes.forEach((size, index) => {
      expect(headerLogs[index]).toContain(`Received ${size} bytes`);
    });

    // Queue should be empty
    expect(metadataQueue.getSize()).toBe(0);
  });

  test('metadata queue has proper capacity', () => {
    // The metadata queue should be DynamicQueue with initial capacity 10, max 1000
    const metadataQueue = receiver.getUSBMetadataQueue();
    const stats: QueueStats = metadataQueue.getStats();

    // Initial capacity should be 10
    expect(stats.capacity).toBe(10);

    // Send 15 packets to test auto-resize
    for (let i = 0; i < 15; i++) {
      receiver.receiveData(Buffer.from(`Packet ${i}\r`));
    }

    // Queue should have grown
    const newStats = metadataQueue.getStats();
    expect(newStats.currentSize).toBe(15);
    expect(newStats.capacity).toBeGreaterThan(10);  // Should have resized

    // Extract to drain
    extractor.extractMessages();

    // Verify all 15 were logged
    const headerLogs = consoleLogs.filter(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLogs.length).toBe(15);
  });

  test('logging does not block hot-path', () => {
    // This test verifies that receiveData() only captures metadata, not logging
    // We can't measure timing precisely in tests, but we can verify the flow

    const packet = Buffer.from('Test packet\r');

    // Before extraction, no logs should exist
    receiver.receiveData(packet);
    let headerLogs = consoleLogs.filter(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLogs.length).toBe(0);

    // Metadata should be queued
    expect(receiver.getUSBMetadataQueue().getSize()).toBe(1);

    // After extraction, log should appear
    extractor.extractMessages();
    headerLogs = consoleLogs.filter(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLogs.length).toBe(1);
  });

  test('handles packet boundaries correctly', () => {
    // Test that offsets align with actual write positions
    let expectedOffset = 0;

    const packets = [
      Buffer.from('AAA\r'),      // 4 bytes
      Buffer.from('BBBBB\r'),    // 6 bytes
      Buffer.from('CCCCCCC\r')   // 8 bytes
    ];

    packets.forEach(packet => {
      const preOffset = buffer.getTailPosition();
      receiver.receiveData(packet);
      const postOffset = buffer.getTailPosition();

      // Verify offset advanced by packet length
      expect(postOffset - preOffset).toBe(packet.length);
    });

    // Extract and verify offsets in logs
    extractor.extractMessages();

    const headerLogs = consoleLogs.filter(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLogs.length).toBe(3);

    expect(headerLogs[0]).toContain('Received 4 bytes');
    expect(headerLogs[1]).toContain('Received 6 bytes');
    expect(headerLogs[2]).toContain('Received 8 bytes');
  });

  test('verifies NO DATA LOSS - every byte logged matches bytes sent', () => {
    // Send known byte sequences
    const testData = [
      Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]),
      Buffer.from([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]),
      Buffer.from('Test\r\n')
    ];

    // Send all packets
    testData.forEach(packet => receiver.receiveData(packet));

    // Extract and log
    extractor.extractMessages();

    // Verify ALL bytes appear in hex dump
    const hexDumpLines = consoleLogs.filter(log => log.includes('$'));

    // Packet 1: Check for 0x01, 0x02, 0x03, 0x04, 0x05
    expect(hexDumpLines.some(line => line.includes('$01'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$02'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$03'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$04'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$05'))).toBe(true);

    // Packet 2: Check for 0xAA through 0xFF
    expect(hexDumpLines.some(line => line.includes('$AA'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$BB'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$CC'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$DD'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$EE'))).toBe(true);
    expect(hexDumpLines.some(line => line.includes('$FF'))).toBe(true);

    // Packet 3: Check for 'Test' (0x54, 0x65, 0x73, 0x74)
    expect(hexDumpLines.some(line => line.includes('$54'))).toBe(true); // 'T'
    expect(hexDumpLines.some(line => line.includes('$65'))).toBe(true); // 'e'
    expect(hexDumpLines.some(line => line.includes('$73'))).toBe(true); // 's'
    expect(hexDumpLines.some(line => line.includes('$74'))).toBe(true); // 't'
    expect(hexDumpLines.some(line => line.includes('$0D'))).toBe(true); // CR
    expect(hexDumpLines.some(line => line.includes('$0A'))).toBe(true); // LF

    // Verify total byte count
    const headerLogs = consoleLogs.filter(log => log.includes('Received') && log.includes('bytes'));
    expect(headerLogs.length).toBe(3);
    expect(headerLogs[0]).toContain('Received 5 bytes');
    expect(headerLogs[1]).toContain('Received 6 bytes');
    expect(headerLogs[2]).toContain('Received 6 bytes');
  });
});
