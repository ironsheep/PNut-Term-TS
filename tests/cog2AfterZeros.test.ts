/**
 * Test that reproduces the exact hardware scenario:
 * COG1 packet, then 416+ zeros, then COG2 packet
 * The zeros get extracted as "COG0" and COG2 is missed
 */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('COG2 After Zeros - Reproduces Hardware Bug', () => {
  
  function createDebuggerPacket(cogId: number): Uint8Array {
    const packet = new Uint8Array(416);
    
    // First byte is COG ID
    packet[0] = cogId;
    packet[1] = 0x00;
    packet[2] = 0x00;
    packet[3] = 0x00;
    
    // Add pattern to identify real packets
    packet[4] = cogId;
    packet[5] = cogId;
    packet[6] = cogId;
    packet[7] = cogId;
    
    // Fill rest
    for (let i = 8; i < 416; i++) {
      packet[i] = (cogId + i) % 256;
    }
    
    return packet;
  }

  test('REPRODUCES HARDWARE BUG: 416 zeros between COG1 and COG2', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    console.log('\n=== HARDWARE BUG REPRODUCTION ===');
    console.log('Scenario: COG1 packet, 416 zeros, COG2 packet');
    
    // Create COG1 packet
    const cog1Packet = createDebuggerPacket(1);
    console.log(`COG1 first 8 bytes: ${Array.from(cog1Packet.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Create 416 bytes of zeros (stub response or padding from P2)
    const zeros = new Uint8Array(416);
    zeros.fill(0x00);
    console.log(`Zeros: 416 bytes of 0x00`);
    
    // Create COG2 packet
    const cog2Packet = createDebuggerPacket(2);
    console.log(`COG2 first 8 bytes: ${Array.from(cog2Packet.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Add all to buffer in order
    buffer.appendAtTail(cog1Packet);
    buffer.appendAtTail(zeros);
    buffer.appendAtTail(cog2Packet);
    
    console.log(`\nTotal bytes in buffer: ${416 + 416 + 416} = 1248`);
    
    // Extract
    extractor.extractMessages();
    
    // Get all messages
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    console.log(`\nExtracted ${messages.length} messages`);
    
    // Find debugger packets
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    console.log(`Debugger packets: ${debuggerPackets.length}`);
    
    // Analyze each packet
    debuggerPackets.forEach((pkt, i) => {
      if (pkt.data instanceof Uint8Array) {
        const cogId = pkt.data[0];
        const isAllZeros = pkt.data.every(b => b === 0);
        
        console.log(`\nPacket ${i}:`);
        console.log(`  COG ID: ${cogId}`);
        console.log(`  First 8 bytes: ${Array.from(pkt.data.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        
        if (isAllZeros) {
          console.log(`  ❌ This is the ZERO packet being shown as "Cog 0:" in Debug Logger!`);
        } else if (cogId === 1) {
          console.log(`  ✓ This is COG1`);
        } else if (cogId === 2) {
          console.log(`  ✓ This is COG2`);
        }
      }
    });
    
    // THE BUG: We expect 3 packets (COG1, zeros as COG0, COG2)
    // But we might only get 2 (COG1 and zeros as COG0)
    // because the zeros consume 416 bytes and COG2 is missed
    
    expect(debuggerPackets.length).toBe(2); // BUG: Should be 3 but will be 2
    
    // Check what we got
    if (debuggerPackets.length >= 1 && debuggerPackets[0].data instanceof Uint8Array) {
      expect(debuggerPackets[0].data[0]).toBe(1); // COG1
    }
    
    if (debuggerPackets.length >= 2 && debuggerPackets[1].data instanceof Uint8Array) {
      // Second packet will be the zeros, not COG2!
      const secondPacket = debuggerPackets[1].data;
      const isZeros = secondPacket.every(b => b === 0);
      
      if (isZeros) {
        console.log('\n🔴 BUG CONFIRMED: Second packet is all zeros (shown as "Cog 0:" in Debug Logger)');
        console.log('    COG2 packet was NOT extracted!');
      }
      
      expect(secondPacket[0]).toBe(0); // Will be 0, not 2!
    }
    
    if (debuggerPackets.length < 3) {
      console.log('\n🔴 COG2 packet missing - only extracted COG1 and zeros!');
    }
  });

  test('What if zeros are shorter than 416 bytes?', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    // Only 100 zeros - not enough for a packet
    const shortZeros = new Uint8Array(100);
    shortZeros.fill(0x00);
    
    const cog1Packet = createDebuggerPacket(1);
    const cog2Packet = createDebuggerPacket(2);
    
    buffer.appendAtTail(cog1Packet);
    buffer.appendAtTail(shortZeros);
    buffer.appendAtTail(cog2Packet);
    
    extractor.extractMessages();
    
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    console.log(`\nWith only 100 zeros: extracted ${debuggerPackets.length} packets`);
    
    // With insufficient zeros, COG2 should be found
    if (debuggerPackets.length >= 2 && debuggerPackets[1].data instanceof Uint8Array) {
      console.log(`Second packet COG ID: ${debuggerPackets[1].data[0]}`);
      expect(debuggerPackets[1].data[0]).toBe(2); // Should find COG2
    }
  });
});