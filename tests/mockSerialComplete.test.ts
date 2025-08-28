/** @format */

import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { MessageClassification } from '../src/classes/shared/messageRouter';

describe('Mock Serial Stream - Complete P2 Session', () => {
  let processor: SerialMessageProcessor;
  let receivedMessages: any[] = [];

  beforeEach(() => {
    processor = new SerialMessageProcessor();
    receivedMessages = [];
    
    // Capture all emitted messages
    processor.on('message', (classification: MessageClassification, data: any) => {
      receivedMessages.push({ classification, data });
    });
    
    processor.start();
  });

  afterEach(() => {
    processor.stop();
  });

  describe('Perfect P2 Stream with Both COG Packets', () => {
    test('should extract all ASCII messages and both debugger packets', () => {
      // Build the exact stream we expect from P2
      // This matches what we saw in the test, but with COG2 packet added
      
      // First batch: Initial COG0 messages
      const batch1 = Buffer.from('Cog0  INIT $0000_0000 $0000_0000 load\r\n');
      
      // Second batch: More COG messages
      const batch2 = Buffer.concat([
        Buffer.from('Cog0  INIT $0000_0F5C $0000_1C68 jump\r\n'),
        Buffer.from('Cog0  hi from debug demo\r\n'),
        Buffer.from('Cog1  INIT $0000_0F5C $0000_1834 jump\r\n'),
        Buffer.from('Cog2  INIT $0000_0F5C $0000_1A34 jump\r\n'),
        Buffer.from('Cog0  Tasks run, Main now looping!\r\n'),
        Buffer.from('Cog1  Task in new COG started\r\n'),
        Buffer.from('Cog2  Task in new COG started\r\n')
      ]);
      
      // COG1 debugger packet (80 bytes)
      const cog1Packet = Buffer.from([
        // Header: COG ID = 1
        0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
        // Data (72 more bytes)
        0x0E, 0x00, 0xA1, 0x03, 0xF8, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x85, 0x22, 0x40, 0x00,
        0xFF, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x5F, 0x02, 0x00, 0x40, 0x5D, 0x1C, 0x00, 0x00,
        0x4C, 0x18, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00,
        0x80, 0xB2, 0xE6, 0x0E, 0x10, 0x00, 0x00, 0x00
      ]);
      
      // COG2 debugger packet (80 bytes) - THIS WAS MISSING IN ACTUAL STREAM
      const cog2Packet = Buffer.from([
        // Header: COG ID = 2
        0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00,
        // Data (72 more bytes) - similar pattern to COG1
        0x0E, 0x00, 0xA1, 0x03, 0xF8, 0x01, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x85, 0x22, 0x40, 0x00,
        0xFF, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x5F, 0x02, 0x00, 0x40, 0x5D, 0x1C, 0x00, 0x00,
        0x4C, 0x18, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00,
        0x80, 0xB2, 0xE6, 0x0E, 0x10, 0x00, 0x00, 0x00
      ]);
      
      // Combine into full stream as P2 would send it
      const fullStream = Buffer.concat([
        batch1,
        batch2,
        cog1Packet,
        cog2Packet
      ]);
      
      // Process the stream
      processor.receiveData(fullStream);
      
      // Allow processing to complete
      jest.runAllTimers();
      
      // Verify we extracted the right number and types of messages
      const cogMessages = receivedMessages.filter(m => m.classification === MessageClassification.COG_MESSAGE);
      const debuggerMessages = receivedMessages.filter(m => m.classification === MessageClassification.DEBUGGER_MESSAGE);
      
      // Should have 8 COG ASCII messages
      expect(cogMessages.length).toBe(8);
      
      // Should have 2 debugger packets
      expect(debuggerMessages.length).toBe(2);
      
      // Verify COG message content
      expect(cogMessages[0].data.toString()).toContain('INIT $0000_0000');
      expect(cogMessages[1].data.toString()).toContain('INIT $0000_0F5C');
      expect(cogMessages[2].data.toString()).toContain('hi from debug demo');
      expect(cogMessages[3].data.toString()).toContain('Cog1  INIT');
      expect(cogMessages[4].data.toString()).toContain('Cog2  INIT');
      expect(cogMessages[5].data.toString()).toContain('Tasks run');
      expect(cogMessages[6].data.toString()).toContain('Cog1  Task in new COG');
      expect(cogMessages[7].data.toString()).toContain('Cog2  Task in new COG');
      
      // Verify debugger packets
      expect(debuggerMessages[0].data[0]).toBe(0x01); // COG1
      expect(debuggerMessages[1].data[0]).toBe(0x02); // COG2
      expect(debuggerMessages[0].data.length).toBe(80);
      expect(debuggerMessages[1].data.length).toBe(80);
    });

    test('should handle stream received in chunks', () => {
      // Simulate data arriving in multiple chunks as it would over serial
      const chunk1 = Buffer.from('Cog0  INIT $0000_0000 $0000_0000 load\r\n');
      const chunk2 = Buffer.from('Cog0  INIT $0000_0F5C $0000_1C68 jump\r\nCog0  hi from ');
      const chunk3 = Buffer.from('debug demo\r\n');
      
      // Process chunks
      processor.receiveData(chunk1);
      processor.receiveData(chunk2);
      processor.receiveData(chunk3);
      
      jest.runAllTimers();
      
      // Should have extracted 3 messages
      const cogMessages = receivedMessages.filter(m => m.classification === MessageClassification.COG_MESSAGE);
      expect(cogMessages.length).toBe(3);
      
      // Verify message boundaries were preserved
      expect(cogMessages[0].data.toString()).toContain('INIT $0000_0000');
      expect(cogMessages[1].data.toString()).toContain('INIT $0000_0F5C');
      expect(cogMessages[2].data.toString()).toContain('hi from debug demo');
    });

    test('should not extract partial debugger packets', () => {
      // Send a partial debugger packet (only 70 bytes instead of 80)
      const partialPacket = Buffer.from([
        0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
        // Only 62 more bytes (should be 72)
        ...Array(62).fill(0x00)
      ]);
      
      processor.receiveData(partialPacket);
      jest.runAllTimers();
      
      // Should NOT extract as debugger packet (incomplete)
      const debuggerMessages = receivedMessages.filter(m => m.classification === MessageClassification.DEBUGGER_MESSAGE);
      expect(debuggerMessages.length).toBe(0);
      
      // Now send the remaining 10 bytes
      const remaining = Buffer.from(Array(10).fill(0xFF));
      processor.receiveData(remaining);
      jest.runAllTimers();
      
      // Now should extract the complete packet
      const debuggerMessages2 = receivedMessages.filter(m => m.classification === MessageClassification.DEBUGGER_MESSAGE);
      expect(debuggerMessages2.length).toBe(1);
      expect(debuggerMessages2[0].data.length).toBe(80);
    });

    test('should handle mixed binary and ASCII correctly', () => {
      // Create stream with ASCII, then binary, then more ASCII
      const asciiPart1 = Buffer.from('Cog0  Start message\r\n');
      
      const binaryPacket = Buffer.from([
        0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
        ...Array(72).fill(0xAA)
      ]);
      
      const asciiPart2 = Buffer.from('Cog0  End message\r\n');
      
      const mixedStream = Buffer.concat([asciiPart1, binaryPacket, asciiPart2]);
      
      processor.receiveData(mixedStream);
      jest.runAllTimers();
      
      // Should extract 2 ASCII and 1 binary
      const cogMessages = receivedMessages.filter(m => m.classification === MessageClassification.COG_MESSAGE);
      const debuggerMessages = receivedMessages.filter(m => m.classification === MessageClassification.DEBUGGER_MESSAGE);
      
      expect(cogMessages.length).toBe(2);
      expect(debuggerMessages.length).toBe(1);
      
      // Verify order is preserved
      expect(cogMessages[0].data.toString()).toContain('Start message');
      expect(debuggerMessages[0].data[0]).toBe(0x01);
      expect(cogMessages[1].data.toString()).toContain('End message');
    });

    test('should measure extraction performance', () => {
      // Create a large stream to test performance
      const messages = [];
      
      // Add 100 ASCII messages
      for (let i = 0; i < 100; i++) {
        messages.push(Buffer.from(`Cog${i % 3}  Message number ${i}\r\n`));
      }
      
      // Add 10 debugger packets
      for (let i = 0; i < 10; i++) {
        const packet = Buffer.from([
          i % 8, 0x00, 0x00, 0x00, i % 8, 0x00, 0x00, 0x00,
          ...Array(72).fill(i)
        ]);
        messages.push(packet);
      }
      
      const largeStream = Buffer.concat(messages);
      console.log(`Testing with stream of ${largeStream.length} bytes`);
      
      const startTime = Date.now();
      processor.receiveData(largeStream);
      jest.runAllTimers();
      const elapsed = Date.now() - startTime;
      
      console.log(`Extraction took ${elapsed}ms`);
      
      // Verify all messages extracted
      const cogMessages = receivedMessages.filter(m => m.classification === MessageClassification.COG_MESSAGE);
      const debuggerMessages = receivedMessages.filter(m => m.classification === MessageClassification.DEBUGGER_MESSAGE);
      
      expect(cogMessages.length).toBe(100);
      expect(debuggerMessages.length).toBe(10);
      
      // Performance check: should process in reasonable time
      expect(elapsed).toBeLessThan(100); // 100ms for this volume
    });
  });

  describe('Edge Cases from Actual Testing', () => {
    test('should handle case where COG2 packet is missing (actual bug)', () => {
      // Recreate the actual stream where COG2 was missing
      const actualStream = Buffer.concat([
        Buffer.from('Cog0  INIT $0000_0000 $0000_0000 load\r\n'),
        Buffer.from('Cog0  INIT $0000_0F5C $0000_1C68 jump\r\n'),
        Buffer.from('Cog0  hi from debug demo\r\n'),
        Buffer.from('Cog1  INIT $0000_0F5C $0000_1834 jump\r\n'),
        Buffer.from('Cog2  INIT $0000_0F5C $0000_1A34 jump\r\n'),
        Buffer.from('Cog0  Tasks run, Main now looping!\r\n'),
        Buffer.from('Cog1  Task in new COG started\r\n'),
        Buffer.from('Cog2  Task in new COG started\r\n'),
        // COG1 packet
        Buffer.from([
          0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
          ...Array(72).fill(0x00)
        ]),
        // NO COG2 PACKET - This is the bug!
        // Just 15 null bytes instead
        Buffer.from(Array(15).fill(0x00))
      ]);
      
      processor.receiveData(actualStream);
      jest.runAllTimers();
      
      // Should extract all ASCII messages
      const cogMessages = receivedMessages.filter(m => m.classification === MessageClassification.COG_MESSAGE);
      expect(cogMessages.length).toBe(8);
      
      // Should extract only 1 debugger packet (COG1)
      const debuggerMessages = receivedMessages.filter(m => m.classification === MessageClassification.DEBUGGER_MESSAGE);
      expect(debuggerMessages.length).toBe(1);
      expect(debuggerMessages[0].data[0]).toBe(0x01);
      
      // The 15 null bytes should not cause any issues
      // They might be extracted as empty messages or ignored
    });

    test('should verify Debug Logger formatting requirements', () => {
      // When debugger packets are sent to Debug Logger, they need proper formatting
      const cog1Packet = Buffer.from([
        0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
        ...Array(72).fill(0xAB)
      ]);
      
      processor.receiveData(cog1Packet);
      jest.runAllTimers();
      
      const debuggerMessages = receivedMessages.filter(m => m.classification === MessageClassification.DEBUGGER_MESSAGE);
      expect(debuggerMessages.length).toBe(1);
      
      // Message should have metadata for formatting
      const message = debuggerMessages[0];
      expect(message.data).toBeDefined();
      expect(message.data.length).toBe(80);
      
      // COG ID should be extractable
      const cogId = message.data[0];
      expect(cogId).toBe(1);
      
      // Data should be suitable for hex dump formatting
      // Debug Logger should display as:
      // "Cog 1" header
      // Then 5 rows of 16 bytes each in hex format
    });
  });
});