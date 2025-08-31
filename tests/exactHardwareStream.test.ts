/**
 * EXACT Hardware Stream Test
 * Tests extraction of 416-byte debugger packets from hardware stream
 * with COG messages interspersed
 */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('Exact Hardware Stream Test - 416-byte packets', () => {
  it('should extract both COG1 and COG2 416-byte packets from hardware stream', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    // Helper to create a 416-byte debugger packet
    function createDebuggerPacket(cogId: number): Uint8Array {
      const packet = new Uint8Array(416);
      
      // Status block (40 bytes)
      packet[0] = cogId;  // COG ID
      packet[1] = 0x00;
      packet[2] = 0x00;
      packet[3] = 0x00;
      
      // COG state
      packet[4] = cogId; 
      packet[5] = 0x00;
      packet[6] = 0x00;
      packet[7] = 0x00;
      
      // PC
      packet[8] = 0x0E;
      packet[9] = 0x00;
      packet[10] = 0xA1;
      packet[11] = 0x03;
      
      // Instruction
      packet[12] = 0xF8;
      packet[13] = 0x01;
      packet[14] = 0x00;
      packet[15] = 0x00;
      
      // Fill rest of status block
      for (let i = 16; i < 40; i++) {
        packet[i] = (i % 256);
      }
      
      // CRC block (128 bytes)
      for (let i = 40; i < 168; i++) {
        packet[i] = ((i - 40) % 256);
      }
      
      // Hub checksums (248 bytes)
      for (let i = 168; i < 416; i++) {
        packet[i] = ((i - 168) % 256);
      }
      
      return packet;
    }
    
    // Chunk 1: COG messages
    const chunk1 = new Uint8Array([
      // "Cog0  INIT $0000_0000 $0000_0000 load\r\n"
      0x43, 0x6F, 0x67, 0x30, 0x20, 0x20, 0x49, 0x4E, 0x49, 0x54, 0x20, 0x24, 0x30, 0x30, 0x30, 0x30,
      0x5F, 0x30, 0x30, 0x30, 0x30, 0x20, 0x24, 0x30, 0x30, 0x30, 0x30, 0x5F, 0x30, 0x30, 0x30, 0x30,
      0x20, 0x6C, 0x6F, 0x61, 0x64, 0x0D, 0x0A,
      // "Cog0  INIT $0000_0F5C $0000_1C68 jump\r\n"
      0x43, 0x6F, 0x67, 0x30, 0x20, 0x20, 0x49, 0x4E, 0x49, 0x54, 0x20, 0x24, 0x30, 0x30, 0x30, 0x30,
      0x5F, 0x30, 0x46, 0x35, 0x43, 0x20, 0x24, 0x30, 0x30, 0x30, 0x30, 0x5F, 0x31, 0x43, 0x36, 0x38,
      0x20, 0x6A, 0x75, 0x6D, 0x70, 0x0D, 0x0A,
      // "Cog0  hi from debug demo\r\n"
      0x43, 0x6F, 0x67, 0x30, 0x20, 0x20, 0x68, 0x69, 0x20, 0x66, 0x72, 0x6F, 0x6D, 0x20, 0x64, 0x65,
      0x62, 0x75, 0x67, 0x20, 0x64, 0x65, 0x6D, 0x6F, 0x0D, 0x0A
    ]);

    // Chunk 2: More COG messages then COG1 416-byte packet
    const cog1Messages = new Uint8Array([
      // "Cog1  INIT $0000_0F5C $0000_1834 jump\r\n"
      0x43, 0x6F, 0x67, 0x31, 0x20, 0x20, 0x49, 0x4E, 0x49, 0x54, 0x20, 0x24, 0x30, 0x30, 0x30, 0x30,
      0x5F, 0x30, 0x46, 0x35, 0x43, 0x20, 0x24, 0x30, 0x30, 0x30, 0x30, 0x5F, 0x31, 0x38, 0x33, 0x34,
      0x20, 0x6A, 0x75, 0x6D, 0x70, 0x0D, 0x0A,
      // "Cog2  INIT $0000_0F5C $0000_1A34 jump\r\n"
      0x43, 0x6F, 0x67, 0x32, 0x20, 0x20, 0x49, 0x4E, 0x49, 0x54, 0x20, 0x24, 0x30, 0x30, 0x30, 0x30,
      0x5F, 0x30, 0x46, 0x35, 0x43, 0x20, 0x24, 0x30, 0x30, 0x30, 0x30, 0x5F, 0x31, 0x41, 0x33, 0x34,
      0x20, 0x6A, 0x75, 0x6D, 0x70, 0x0D, 0x0A,
      // "Cog0  Tasks run, Main now looping!\r\n"
      0x43, 0x6F, 0x67, 0x30, 0x20, 0x20, 0x54, 0x61, 0x73, 0x6B, 0x73, 0x20, 0x72, 0x75, 0x6E, 0x2C,
      0x20, 0x4D, 0x61, 0x69, 0x6E, 0x20, 0x6E, 0x6F, 0x77, 0x20, 0x6C, 0x6F, 0x6F, 0x70, 0x69, 0x6E,
      0x67, 0x21, 0x0D, 0x0A,
      // "Cog1  Task in new COG started\r\n"
      0x43, 0x6F, 0x67, 0x31, 0x20, 0x20, 0x54, 0x61, 0x73, 0x6B, 0x20, 0x69, 0x6E, 0x20, 0x6E, 0x65,
      0x77, 0x20, 0x43, 0x4F, 0x47, 0x20, 0x73, 0x74, 0x61, 0x72, 0x74, 0x65, 0x64, 0x0D, 0x0A,
      // "Cog2  Task in new COG started\r\n" 
      0x43, 0x6F, 0x67, 0x32, 0x20, 0x20, 0x54, 0x61, 0x73, 0x6B, 0x20, 0x69, 0x6E, 0x20, 0x6E, 0x65,
      0x77, 0x20, 0x43, 0x4F, 0x47, 0x20, 0x73, 0x74, 0x61, 0x72, 0x74, 0x65, 0x64, 0x0D, 0x0A
    ]);
    
    // Create COG1 416-byte packet
    const cog1Packet = createDebuggerPacket(1);
    
    // Combine messages and COG1 packet
    const chunk2 = new Uint8Array(cog1Messages.length + cog1Packet.length);
    chunk2.set(cog1Messages);
    chunk2.set(cog1Packet, cog1Messages.length);

    // Chunk 3: COG2 416-byte packet immediately following COG1
    const cog2Packet = createDebuggerPacket(2);
    const chunk3 = cog2Packet;
    
    // Chunk 4: Some trailing COG messages
    const chunk4 = new Uint8Array([
      // "Cog0  Still running\r\n"
      0x43, 0x6F, 0x67, 0x30, 0x20, 0x20, 0x53, 0x74, 0x69, 0x6C, 0x6C, 0x20, 0x72, 0x75, 0x6E, 0x6E,
      0x69, 0x6E, 0x67, 0x0D, 0x0A
    ]);

    // Feed chunks to buffer exactly as hardware sends them
    console.log('\n=== EXACT HARDWARE STREAM TEST - 416-byte packets ===');
    console.log(`Chunk 1: ${chunk1.length} bytes (COG messages)`);
    buffer.appendAtTail(chunk1);
    
    console.log(`Chunk 2: ${chunk2.length} bytes (more COG messages + COG1 416-byte packet)`);
    buffer.appendAtTail(chunk2);
    
    console.log(`Chunk 3: ${chunk3.length} bytes (COG2 416-byte packet)`);
    buffer.appendAtTail(chunk3);
    
    console.log(`Chunk 4: ${chunk4.length} bytes (trailing COG messages)`);
    buffer.appendAtTail(chunk4);

    // Process all messages through extractor
    const result = extractor.extractBatch();
    console.log(`Extracted ${result.messages.length} messages in batch, hasMore: ${result.hasMore}`);
    
    // Get all messages
    const messages = result.messages;
    messages.forEach(msg => {
      if (msg.type === MessageType.DEBUGGER_416BYTE) {
        const cogId = msg.data[0];
        console.log(`Extracted: DEBUGGER_416BYTE for COG ${cogId}`);
      }
    });

    // Count message types
    const cogMessages = messages.filter(m => m.type === MessageType.COG_MESSAGE);
    const debuggerPackets = messages.filter(m => m.type === MessageType.DEBUGGER_416BYTE);
    
    console.log(`\nResults:`);
    console.log(`- COG Messages: ${cogMessages.length} (expected: 9)`);
    console.log(`- Debugger Packets: ${debuggerPackets.length} (expected: 2)`)
    
    if (debuggerPackets.length > 0) {
      console.log(`- COG1 ID: 0x${debuggerPackets[0].data[0].toString(16).padStart(2, '0')}`);
      if (debuggerPackets.length > 1) {
        console.log(`- COG2 ID: 0x${debuggerPackets[1].data[0].toString(16).padStart(2, '0')}`);
      } else {
        console.log('- COG2: NOT EXTRACTED!');
      }
    }

    // CRITICAL TESTS
    expect(cogMessages.length).toBe(9); // 9 COG text messages
    expect(debuggerPackets.length).toBe(2); // THIS IS THE KEY TEST - Must extract BOTH packets
    expect(debuggerPackets[0].data[0]).toBe(0x01); // COG1
    expect(debuggerPackets[0].data.length).toBe(416); // Full 416-byte packet
    expect(debuggerPackets[1].data[0]).toBe(0x02); // COG2
    expect(debuggerPackets[1].data.length).toBe(416); // Full 416-byte packet
  });
});