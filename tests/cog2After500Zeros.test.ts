/**
 * Test with MORE than 416 zeros - this would consume COG2!
 */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('COG2 After 500+ Zeros - This breaks COG2 extraction', () => {
  
  function createDebuggerPacket(cogId: number): Uint8Array {
    const packet = new Uint8Array(416);
    packet[0] = cogId;
    packet[1] = 0x00;
    packet[2] = 0x00;
    packet[3] = 0x00;
    
    // Distinctive pattern
    packet[4] = 0xAA;
    packet[5] = cogId;
    packet[6] = 0xBB;
    packet[7] = cogId;
    
    for (let i = 8; i < 416; i++) {
      packet[i] = (cogId + i) % 256;
    }
    
    return packet;
  }

  test('FOUND THE BUG: 500+ zeros consume COG2 packet!', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    console.log('\n=== THE REAL BUG ===');
    console.log('If P2 sends more than 416 zeros, COG2 gets consumed!');
    
    // COG1 packet
    const cog1Packet = createDebuggerPacket(1);
    
    // 500 bytes of zeros (more than 416!)
    const zeros = new Uint8Array(500);
    zeros.fill(0x00);
    console.log(`Zeros: ${zeros.length} bytes (MORE than 416!)`);
    
    // COG2 packet
    const cog2Packet = createDebuggerPacket(2);
    console.log(`COG2 first 8 bytes: ${Array.from(cog2Packet.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Add all to buffer
    buffer.appendAtTail(cog1Packet);
    buffer.appendAtTail(zeros);
    buffer.appendAtTail(cog2Packet);
    
    console.log(`\nTotal: COG1(416) + zeros(500) + COG2(416) = 1332 bytes`);
    console.log(`\nWHAT WILL HAPPEN:`);
    console.log(`1. COG1 extracted at position 0-415`);
    console.log(`2. First zero at position 416 matches as COG0`);
    console.log(`3. Extractor takes 416 bytes from position 416-831`);
    console.log(`4. This includes 416 zeros`);
    console.log(`5. Position 832 has remaining 84 zeros`);
    console.log(`6. COG2 starts at position 916`);
    console.log(`7. But extractor is now at position 832, sees zeros, not COG2!`);
    
    // Extract
    extractor.extractMessages();
    
    // Get messages
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    console.log(`\nExtracted ${debuggerPackets.length} debugger packets (should be 3, but...)`);
    
    debuggerPackets.forEach((pkt, i) => {
      if (pkt.data instanceof Uint8Array) {
        console.log(`Packet ${i}: COG ID = ${pkt.data[0]}, byte[4] = 0x${pkt.data[4].toString(16)}`);
        
        // Check if this is really COG2 or zeros
        if (pkt.data[4] === 0xAA && pkt.data[5] === 2) {
          console.log(`  This is the real COG2!`);
        } else if (pkt.data.every(b => b === 0)) {
          console.log(`  This is all zeros`);
        }
      }
    });
    
    // The bug: COG2 won't be found because the zeros consumed too much
    expect(debuggerPackets.length).toBe(2); // Only COG1 and zeros
    
    // Verify COG2 is missing
    const hasCog2 = debuggerPackets.some(pkt => 
      pkt.data instanceof Uint8Array && pkt.data[0] === 2
    );
    
    if (!hasCog2) {
      console.log('\n🔴 CONFIRMED: COG2 packet was NOT extracted!');
      console.log('   The zeros consumed the buffer position where COG2 should be found');
    }
    
    expect(hasCog2).toBe(false); // COG2 will be missing!
  });

  test('Edge case: Exactly 832 zeros would put COG2 at wrong boundary', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    // COG1 (416) + exactly 832 zeros + COG2 (416)
    // After extracting COG1, position 416 has a zero
    // Extractor takes 416 bytes (416-831) as COG0
    // Position 832 has a zero again!
    // Extractor would try to take 416 bytes (832-1247) as another COG0
    // But only 416 bytes remain (the COG2 packet)
    // So COG2 data gets extracted as a COG0 packet!
    
    const cog1 = createDebuggerPacket(1);
    const zeros = new Uint8Array(832);
    zeros.fill(0x00);
    const cog2 = createDebuggerPacket(2);
    
    buffer.appendAtTail(cog1);
    buffer.appendAtTail(zeros);
    buffer.appendAtTail(cog2);
    
    extractor.extractMessages();
    
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue();
      if (msg) messages.push(msg);
    }
    
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    console.log(`\nWith 832 zeros: extracted ${debuggerPackets.length} packets`);
    
    if (debuggerPackets.length >= 3 && debuggerPackets[2].data instanceof Uint8Array) {
      const thirdPacket = debuggerPackets[2].data;
      console.log(`Third packet: first byte = ${thirdPacket[0]}, byte[4] = 0x${thirdPacket[4].toString(16)}`);
      
      if (thirdPacket[0] === 0 && thirdPacket[4] === 0xAA) {
        console.log('🔴 BUG: COG2 data extracted as COG0!');
        console.log('   The third "COG0" packet actually contains COG2 data shifted by 2 bytes!');
      }
    }
  });
});