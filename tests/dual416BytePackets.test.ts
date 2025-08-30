/**
 * Test for 416-byte P2 Debugger Packet Extraction and Response
 * 
 * Tests the complete flow:
 * 1. Extract COG1 416-byte packet
 * 2. Send response to unlock COG2
 * 3. Extract COG2 416-byte packet
 * 4. Verify both packets routed correctly
 */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';
import { DebuggerResponse } from '../src/classes/shared/debuggerResponse';

describe('416-byte Dual COG Packet Extraction', () => {
  let buffer: CircularBuffer;
  let extractor: MessageExtractor;
  let queue: DynamicQueue<ExtractedMessage>;
  let debuggerResponse: DebuggerResponse;

  beforeEach(() => {
    buffer = new CircularBuffer(8192);
    queue = new DynamicQueue(100, 1000, 'test');
    extractor = new MessageExtractor(buffer, queue);
    debuggerResponse = new DebuggerResponse();
  });

  /**
   * Create a 416-byte debugger packet for a specific COG
   */
  function createDebuggerPacket(cogId: number): Uint8Array {
    const packet = new Uint8Array(416);
    
    // Status block (40 bytes)
    // First long is COG ID (little-endian)
    packet[0] = cogId;
    packet[1] = 0x00;
    packet[2] = 0x00;
    packet[3] = 0x00;
    
    // Second long - COG state
    packet[4] = cogId; // Echo COG ID for testing
    packet[5] = 0x00;
    packet[6] = 0x00;
    packet[7] = 0x00;
    
    // Third long - PC
    packet[8] = 0x0E;
    packet[9] = 0x00;
    packet[10] = 0xA1;
    packet[11] = 0x03;
    
    // Fourth long - Instruction
    packet[12] = 0xF8;
    packet[13] = 0x01;
    packet[14] = 0x00;
    packet[15] = 0x00;
    
    // Fill rest of status block with pattern
    for (let i = 16; i < 40; i++) {
      packet[i] = (i % 256);
    }
    
    // CRC block (128 bytes) - Fill with test pattern
    for (let i = 40; i < 168; i++) {
      packet[i] = ((i - 40) % 256);
    }
    
    // Hub checksums (248 bytes) - Fill with test pattern
    for (let i = 168; i < 416; i++) {
      packet[i] = ((i - 168) % 256);
    }
    
    return packet;
  }

  test('should extract single 416-byte COG1 packet', () => {
    // Create COG1 packet
    const cog1Packet = createDebuggerPacket(1);
    
    // Add to buffer
    buffer.appendAtTail(cog1Packet);
    
    // Extract messages
    extractor.extractMessages();
    
    // Check queue
    expect(queue.getSize()).toBe(1);
    
    const message = queue.dequeue();
    expect(message).toBeDefined();
    if (!message) throw new Error('Message should be defined');
    expect(message.type).toBe(MessageType.DEBUGGER_416BYTE);
    expect(message.data.length).toBe(416);
    
    // Verify COG ID
    expect(message.data[0]).toBe(1);
    
    // Verify structure
    const statusBlock = message.data.slice(0, 40);
    const crcBlock = message.data.slice(40, 168);
    const hubBlock = message.data.slice(168, 416);
    
    expect(statusBlock.length).toBe(40);
    expect(crcBlock.length).toBe(128);
    expect(hubBlock.length).toBe(248);
  });

  test('should extract two consecutive 416-byte packets (COG1 and COG2)', () => {
    // Create packets for COG1 and COG2
    const cog1Packet = createDebuggerPacket(1);
    const cog2Packet = createDebuggerPacket(2);
    
    // Add both packets to buffer consecutively
    buffer.appendAtTail( cog1Packet);
    buffer.appendAtTail( cog2Packet);
    
    // Extract messages
    extractor.extractMessages();
    
    // Should extract both packets
    expect(queue.getSize()).toBe(2);
    
    // Verify COG1 packet
    const message1 = queue.dequeue();
    expect(message1).toBeDefined();
    if (!message1) throw new Error('message1 should be defined');
    expect(message1.type).toBe(MessageType.DEBUGGER_416BYTE);
    expect(message1.data.length).toBe(416);
    expect(message1.data[0]).toBe(1); // COG1
    
    // Verify COG2 packet
    const message2 = queue.dequeue();
    expect(message2).toBeDefined();
    if (!message2) throw new Error('message2 should be defined');
    expect(message2.type).toBe(MessageType.DEBUGGER_416BYTE);
    expect(message2.data.length).toBe(416);
    expect(message2.data[0]).toBe(2); // COG2
  });

  test('should generate correct 75-byte response for debugger packet', () => {
    // Create a debugger packet
    const cogPacket = createDebuggerPacket(1);
    
    // Generate response
    const response = debuggerResponse.generateResponse(cogPacket);
    
    // Verify response size
    expect(response.length).toBe(75);
    
    // Verify response structure:
    // - 16 bytes COG checksums
    // - 31 bytes Hub checksums  
    // - 20 bytes Hub requests (5 longs)
    // - 4 bytes COGBRK request
    // - 4 bytes Stall command
    
    // Check that stall command is present (0x80000000 in little-endian)
    expect(response[71]).toBe(0x00);
    expect(response[72]).toBe(0x00);
    expect(response[73]).toBe(0x00);
    expect(response[74]).toBe(0x80);
  });

  test('should handle partial packet correctly', () => {
    // Add only part of a packet
    const partialPacket = createDebuggerPacket(1).slice(0, 300);
    
    buffer.appendAtTail( partialPacket);
    
    // Try to extract
    extractor.extractMessages();
    
    // Should not extract incomplete packet
    expect(queue.getSize()).toBe(0);
    
    // Add rest of packet
    const restOfPacket = createDebuggerPacket(1).slice(300);
    buffer.appendAtTail( restOfPacket);
    
    // Now extraction should work
    extractor.extractMessages();
    expect(queue.getSize()).toBe(1);
    
    const message = queue.dequeue();
    if (!message) throw new Error('message should be defined');
    expect(message.type).toBe(MessageType.DEBUGGER_416BYTE);
    expect(message.data.length).toBe(416);
  });

  test('should handle mixed content: text + 416-byte packet + text', () => {
    // Add some text before
    const textBefore = new TextEncoder().encode('Cog0  INIT $0000_0000 $0000_0000 load\r\n');
    buffer.appendAtTail( textBefore);
    
    // Add debugger packet
    const cogPacket = createDebuggerPacket(1);
    buffer.appendAtTail( cogPacket);
    
    // Add some text after
    const textAfter = new TextEncoder().encode('Cog1  Task started\r\n');
    buffer.appendAtTail( textAfter);
    
    // Extract messages
    extractor.extractMessages();
    
    // Should extract 3 messages
    expect(queue.getSize()).toBe(3);
    
    // First message: COG text
    const msg1 = queue.dequeue();
    if (!msg1) throw new Error('msg1 should be defined');
    expect(msg1.type).toBe(MessageType.COG_MESSAGE);
    
    // Second message: Debugger packet
    const msg2 = queue.dequeue();
    if (!msg2) throw new Error('msg2 should be defined');
    expect(msg2.type).toBe(MessageType.DEBUGGER_416BYTE);
    expect(msg2.data.length).toBe(416);
    
    // Third message: COG text
    const msg3 = queue.dequeue();
    if (!msg3) throw new Error('msg3 should be defined');
    expect(msg3.type).toBe(MessageType.COG_MESSAGE);
  });

  test('should reject invalid COG IDs', () => {
    // Create packet with invalid COG ID
    const invalidPacket = createDebuggerPacket(8); // COG ID > 7
    
    buffer.appendAtTail( invalidPacket);
    
    // Try to extract
    extractor.extractMessages();
    
    // Should not extract packet with invalid COG ID
    expect(queue.getSize()).toBe(0);
  });

  test('should handle back-to-back packets from different COGs', () => {
    // Simulate real scenario: COG1, response, COG2, response, COG3...
    const packets = [];
    const responses = [];
    
    for (let cogId = 0; cogId < 4; cogId++) {
      const packet = createDebuggerPacket(cogId);
      packets.push(packet);
      
      // Generate response for this packet
      const response = debuggerResponse.generateResponse(packet);
      responses.push(response);
      
      // Add packet to buffer
      buffer.appendAtTail(packet);
    }
    
    // Extract all messages
    extractor.extractMessages();
    
    // Should have extracted all 4 packets
    expect(queue.getSize()).toBe(4);
    
    // Verify each packet
    for (let cogId = 0; cogId < 4; cogId++) {
      const message = queue.dequeue();
      if (!message) throw new Error('message should be defined');
      expect(message.type).toBe(MessageType.DEBUGGER_416BYTE);
      expect(message.data[0]).toBe(cogId);
      expect(message.data.length).toBe(416);
    }
    
    // Verify all responses are valid
    expect(responses.every(r => r.length === 75)).toBe(true);
  });

  test('should maintain extraction after DTR reset', () => {
    // Add first packet
    const packet1 = createDebuggerPacket(1);
    buffer.appendAtTail( packet1);
    
    // Extract first packet
    extractor.extractMessages();
    expect(queue.getSize()).toBe(1);
    queue.dequeue(); // Clear queue
    
    // Simulate DTR reset by resetting response generator
    debuggerResponse.reset();
    
    // Add second packet after reset
    const packet2 = createDebuggerPacket(2);
    buffer.appendAtTail( packet2);
    
    // Should still extract correctly
    extractor.extractMessages();
    expect(queue.getSize()).toBe(1);
    
    const message = queue.dequeue();
    if (!message) throw new Error('message should be defined');
    expect(message.type).toBe(MessageType.DEBUGGER_416BYTE);
    expect(message.data[0]).toBe(2);
  });
});

describe('Performance with 416-byte packets', () => {
  test('should handle rapid succession of packets', () => {
    const buffer = new CircularBuffer(65536); // Larger buffer for performance test
    const queue = new DynamicQueue<ExtractedMessage>(1000, 5000, 'perf-test');
    const extractor = new MessageExtractor(buffer, queue);
    
    const startTime = Date.now();
    const packetCount = 100;
    
    // Add many packets rapidly
    for (let i = 0; i < packetCount; i++) {
      const packet = createDebuggerPacket(i % 8); // Cycle through COG IDs
      buffer.appendAtTail(packet);
    }
    
    // Extract all
    extractor.extractMessages();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should extract all packets
    expect(queue.getSize()).toBe(packetCount);
    
    // Performance check - should be fast
    console.log(`Extracted ${packetCount} 416-byte packets in ${duration}ms`);
    expect(duration).toBeLessThan(1000); // Should take less than 1 second
  });
  
  /**
   * Helper to create debugger packet for tests
   */
  function createDebuggerPacket(cogId: number): Uint8Array {
    const packet = new Uint8Array(416);
    packet[0] = cogId & 0xFF;
    for (let i = 1; i < 416; i++) {
      packet[i] = (i % 256);
    }
    return packet;
  }
});