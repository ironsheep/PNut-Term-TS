/**
 * Test that reproduces COG2 boundary detection failure
 * The bug: Any 0x00-0x07 byte can be mistaken for start of 416-byte packet
 */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('COG2 Boundary Detection Failure', () => {
  
  function createDebuggerPacket(cogId: number): Uint8Array {
    const packet = new Uint8Array(416);
    
    // First byte MUST be the COG ID
    packet[0] = cogId;
    packet[1] = 0x00;
    packet[2] = 0x00;
    packet[3] = 0x00;
    
    // Add some recognizable pattern
    packet[4] = 0xAA;
    packet[5] = 0xBB;
    packet[6] = 0xCC;
    packet[7] = 0xDD;
    
    // Fill rest
    for (let i = 8; i < 416; i++) {
      packet[i] = (i % 256);
    }
    
    return packet;
  }

  test('REPRODUCES BUG: 0x00 byte before COG2 packet causes wrong boundary', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    console.log('\n=== BOUNDARY FAILURE TEST ===');
    
    // Add some data that ends with 0x00 (like end of COG1 packet or other data)
    const precedingData = new Uint8Array([
      0xFF, 0xFF, 0xFF, 0xFF,  // Some data
      0x00  // THIS 0x00 will be mistaken for COG ID!
    ]);
    
    // Create real COG2 packet
    const cog2Packet = createDebuggerPacket(2);
    console.log(`Real COG2 packet starts with: ${Array.from(cog2Packet.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Add preceding data
    buffer.appendAtTail(precedingData);
    
    // Add COG2 packet
    buffer.appendAtTail(cog2Packet);
    
    // Total in buffer: 5 + 416 = 421 bytes
    // But extractor will think packet starts at byte 4 (the 0x00)
    // So it will extract bytes 4-419 (416 bytes starting from 0x00)
    
    // Extract
    extractor.extractMessages();
    
    // Check what was extracted
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    // Log all messages extracted
    console.log(`Total messages extracted: ${messages.length}`);
    messages.forEach((msg, i) => {
      console.log(`Message ${i}: type=${msg.type}, length=${msg.data instanceof Uint8Array ? msg.data.length : 'N/A'}`);
    });
    
    // Find debugger packets
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    console.log(`Extracted ${debuggerPackets.length} debugger packet(s)`);
    
    if (debuggerPackets.length > 0) {
      const packet = debuggerPackets[0];
      if (packet.data instanceof Uint8Array) {
        console.log(`Extracted packet first 8 bytes: ${Array.from(packet.data.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        
        // BUG DEMONSTRATION: The extracted packet will start with 0x00 (from preceding data)
        // not 0x02 (the real COG2 ID)
        console.log(`\nEXPECTED: First byte = 0x02 (COG2)`);
        console.log(`ACTUAL: First byte = 0x${packet.data[0].toString(16).padStart(2, '0')}`);
        
        // The real COG2 ID (0x02) is now at position 1 in the extracted packet!
        console.log(`\nReal COG2 ID (0x02) is now at position: ${packet.data.indexOf(0x02)}`);
        
        // THIS TEST SHOULD FAIL, PROVING THE BUG
        expect(packet.data[0]).toBe(2); // Will be 0x00, not 0x02!
      }
    } else {
      console.log('NO DEBUGGER PACKETS EXTRACTED!');
      // Maybe the 0x00 wasn't matched as a packet start?
    }
  });

  test('Multiple 0x00 bytes can cause multiple false matches', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    // Create data with multiple 0x00 bytes
    const data = new Uint8Array([
      0x00, // Could match as COG0
      0xFF, 0xFF, 0xFF,
      0x00, // Could match as COG0 again
      0xFF, 0xFF,
      0x01, // Could match as COG1
      0xFF,
      0x02, // The REAL COG2 packet starts here
      0x00, 0x00, 0x00, 0xAA, 0xBB, 0xCC, 0xDD
    ]);
    
    // Add enough data to make 416 bytes after any potential start
    const padding = new Uint8Array(420);
    for (let i = 0; i < 420; i++) {
      padding[i] = (i % 256);
    }
    
    buffer.appendAtTail(data);
    buffer.appendAtTail(padding);
    
    // Extract
    extractor.extractMessages();
    
    // Check extractions
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    console.log(`\nExtracted ${debuggerPackets.length} packet(s) from data with multiple 0x00 bytes`);
    
    // The first match will win, even if it's wrong!
    if (debuggerPackets.length > 0 && debuggerPackets[0].data instanceof Uint8Array) {
      console.log(`First packet starts with: 0x${debuggerPackets[0].data[0].toString(16).padStart(2, '0')}`);
    }
  });

  test('Correct extraction when no ambiguous bytes precede packet', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    // Use safe preceding data (no 0x00-0x07 bytes)
    const safePrecedingData = new Uint8Array([
      0xFF, 0xFE, 0xFD, 0xFC, 0xFB
    ]);
    
    // Create COG2 packet
    const cog2Packet = createDebuggerPacket(2);
    
    buffer.appendAtTail(safePrecedingData);
    buffer.appendAtTail(cog2Packet);
    
    // Extract
    extractor.extractMessages();
    
    // Get messages
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    if (debuggerPackets.length > 0 && debuggerPackets[0].data instanceof Uint8Array) {
      console.log(`\nWith safe preceding data, packet starts with: 0x${debuggerPackets[0].data[0].toString(16).padStart(2, '0')}`);
      // This should work correctly
      expect(debuggerPackets[0].data[0]).toBe(2);
    }
  });
});