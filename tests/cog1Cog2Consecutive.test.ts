/**
 * Test COG1 followed immediately by COG2 - reproducing hardware scenario
 */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('COG1 followed by COG2 - Hardware Scenario', () => {
  
  function createDebuggerPacket(cogId: number): Uint8Array {
    const packet = new Uint8Array(416);
    
    // Status block (40 bytes)
    packet[0] = cogId;  // COG ID
    packet[1] = 0x00;
    packet[2] = 0x00;
    packet[3] = 0x00;
    
    // Some pattern to identify packets
    packet[4] = 0xAA;
    packet[5] = cogId;  // Echo COG ID
    packet[6] = 0xBB;
    packet[7] = cogId;
    
    // Fill middle section
    for (let i = 8; i < 400; i++) {
      packet[i] = (i % 256);
    }
    
    // CRITICAL: End COG1 packet with some zeros (common in real packets)
    if (cogId === 1) {
      // Last 16 bytes of COG1 are zeros (like in real hardware dumps)
      for (let i = 400; i < 416; i++) {
        packet[i] = 0x00;
      }
    } else {
      // COG2 has different ending
      for (let i = 400; i < 416; i++) {
        packet[i] = 0xFF;
      }
    }
    
    return packet;
  }

  test('COG1 ending with zeros followed by COG2 - potential boundary issue', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    console.log('\n=== COG1 + COG2 CONSECUTIVE TEST ===');
    
    // Create COG1 packet (ends with 16 zeros)
    const cog1Packet = createDebuggerPacket(1);
    console.log(`COG1 last 16 bytes: ${Array.from(cog1Packet.slice(-16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Create COG2 packet
    const cog2Packet = createDebuggerPacket(2);
    console.log(`COG2 first 8 bytes: ${Array.from(cog2Packet.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Add both packets consecutively (like hardware does)
    buffer.appendAtTail(cog1Packet);
    buffer.appendAtTail(cog2Packet);
    
    console.log(`Total bytes in buffer: ${416 + 416} = 832`);
    
    // Extract
    extractor.extractMessages();
    
    // Get all messages
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    console.log(`\nExtracted ${messages.length} total messages`);
    messages.forEach((msg, i) => {
      console.log(`Message ${i}: type=${msg.type}, length=${msg.data instanceof Uint8Array ? msg.data.length : 'N/A'}`);
      if (msg.type === MessageType.DEBUGGER_416BYTE && msg.data instanceof Uint8Array) {
        console.log(`  First 8 bytes: ${Array.from(msg.data.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
      }
    });
    
    // Find debugger packets
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    console.log(`\nDebugger packets extracted: ${debuggerPackets.length} (expected: 2)`);
    
    // Check both packets
    if (debuggerPackets.length >= 1 && debuggerPackets[0].data instanceof Uint8Array) {
      const cog1 = debuggerPackets[0].data;
      console.log(`\nCOG1 packet:`);
      console.log(`  First byte: 0x${cog1[0].toString(16).padStart(2, '0')} (expected: 0x01)`);
      console.log(`  Byte 5: 0x${cog1[5].toString(16).padStart(2, '0')} (should echo COG ID: 0x01)`);
      expect(cog1[0]).toBe(1);
    }
    
    if (debuggerPackets.length >= 2 && debuggerPackets[1].data instanceof Uint8Array) {
      const cog2 = debuggerPackets[1].data;
      console.log(`\nCOG2 packet:`);
      console.log(`  First byte: 0x${cog2[0].toString(16).padStart(2, '0')} (expected: 0x02)`);
      console.log(`  Byte 5: 0x${cog2[5].toString(16).padStart(2, '0')} (should echo COG ID: 0x02)`);
      
      // THIS IS THE CRITICAL TEST - Does COG2 have the right ID?
      if (cog2[0] !== 2) {
        console.log('\n❌ BUG REPRODUCED: COG2 packet has wrong first byte!');
        console.log(`Looking for 0x02 in packet... found at position: ${cog2.indexOf(0x02)}`);
        
        // If one of COG1's trailing zeros was matched as packet start,
        // the real COG2 data would be shifted
      }
      
      expect(cog2[0]).toBe(2); // This should fail if bug exists
    } else {
      console.log('\n❌ COG2 packet not extracted!');
      expect(debuggerPackets.length).toBe(2);
    }
  });

  test('What if extractor matches COG1 trailing zero as COG0 packet start?', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    console.log('\n=== TRAILING ZERO CONFUSION TEST ===');
    
    // COG1 packet ending with 0x00 bytes
    const cog1Data = new Uint8Array(416);
    cog1Data[0] = 0x01; // COG1
    // Fill middle
    for (let i = 1; i < 410; i++) {
      cog1Data[i] = 0xFF;
    }
    // Last 6 bytes are 0x00
    for (let i = 410; i < 416; i++) {
      cog1Data[i] = 0x00;
    }
    
    // COG2 packet
    const cog2Data = new Uint8Array(416);
    cog2Data[0] = 0x02; // COG2
    cog2Data[1] = 0x22; // Distinctive marker
    cog2Data[2] = 0x22;
    for (let i = 3; i < 416; i++) {
      cog2Data[i] = 0xEE;
    }
    
    buffer.appendAtTail(cog1Data);
    buffer.appendAtTail(cog2Data);
    
    // If extractor matches position 410 (0x00) as packet start,
    // it would extract bytes 410-825 as a "COG0" packet
    // This would include the last 6 bytes of COG1 and first 410 bytes of COG2!
    
    extractor.extractMessages();
    
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    console.log(`Extracted ${debuggerPackets.length} debugger packet(s)`);
    
    debuggerPackets.forEach((pkt, i) => {
      if (pkt.data instanceof Uint8Array) {
        console.log(`Packet ${i}: First byte = 0x${pkt.data[0].toString(16).padStart(2, '0')}, byte[6] = 0x${pkt.data[6].toString(16).padStart(2, '0')}`);
        // If bug exists, we might see a packet starting with 0x00 that contains COG2 data
        if (pkt.data[0] === 0x00) {
          // Check if COG2 marker (0x22) appears at wrong position
          const markerPos = pkt.data.indexOf(0x22);
          if (markerPos > 0) {
            console.log(`  ❌ Found COG2 marker 0x22 at position ${markerPos} in COG0 packet!`);
          }
        }
      }
    });
  });
});