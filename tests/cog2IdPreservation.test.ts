/**
 * Test to verify COG2 packet ID is preserved during extraction
 */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('COG2 ID Preservation Test', () => {
  
  function createDebuggerPacket(cogId: number): Uint8Array {
    const packet = new Uint8Array(416);
    
    // First byte MUST be the COG ID
    packet[0] = cogId;
    packet[1] = 0x00;
    packet[2] = 0x00;
    packet[3] = 0x00;
    
    // Fill rest with pattern
    for (let i = 4; i < 416; i++) {
      packet[i] = (i % 256);
    }
    
    return packet;
  }

  test('COG2 packet should preserve COG ID through extraction', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    // Create COG2 packet with ID = 2
    const cog2Packet = createDebuggerPacket(2);
    console.log(`\nOriginal COG2 packet first 8 bytes: ${Array.from(cog2Packet.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Add to buffer
    buffer.appendAtTail(cog2Packet);
    
    // Extract
    extractor.extractMessages();
    
    // Verify extraction
    expect(outputQueue.getSize()).toBe(1);
    
    const message = outputQueue.dequeue();
    expect(message).toBeDefined();
    if (!message) throw new Error('No message extracted');
    
    expect(message.type).toBe(MessageType.DEBUGGER_416BYTE);
    expect(message.data).toBeInstanceOf(Uint8Array);
    
    if (message.data instanceof Uint8Array) {
      console.log(`Extracted packet first 8 bytes: ${Array.from(message.data.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
      
      // CRITICAL TEST: First byte must be 2
      expect(message.data[0]).toBe(2);
      expect(message.data.length).toBe(416);
      
      // Verify the entire packet matches
      for (let i = 0; i < 416; i++) {
        if (message.data[i] !== cog2Packet[i]) {
          console.error(`Mismatch at byte ${i}: expected 0x${cog2Packet[i].toString(16)}, got 0x${message.data[i].toString(16)}`);
          break;
        }
      }
    }
  });

  test('Multiple COG packets should preserve their IDs', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    // Create packets for COG0, COG1, COG2
    const packets = [
      createDebuggerPacket(0),
      createDebuggerPacket(1),
      createDebuggerPacket(2)
    ];
    
    // Add all to buffer
    packets.forEach(p => buffer.appendAtTail(p));
    
    // Extract
    extractor.extractMessages();
    
    // Verify all extracted with correct IDs
    expect(outputQueue.getSize()).toBe(3);
    
    for (let cogId = 0; cogId < 3; cogId++) {
      const message = outputQueue.dequeue();
      expect(message).toBeDefined();
      if (!message) continue;
      
      expect(message.type).toBe(MessageType.DEBUGGER_416BYTE);
      if (message.data instanceof Uint8Array) {
        console.log(`COG${cogId} extracted, first byte: 0x${message.data[0].toString(16).padStart(2, '0')}`);
        expect(message.data[0]).toBe(cogId);
      }
    }
  });

  test('COG2 after COG1 should preserve ID (reproduce hardware scenario)', () => {
    const buffer = new CircularBuffer(8192);
    const outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    const extractor = new MessageExtractor(buffer, outputQueue);
    
    // Exactly like hardware: COG1 then COG2
    const cog1Packet = createDebuggerPacket(1);
    const cog2Packet = createDebuggerPacket(2);
    
    console.log('\n=== Hardware Scenario Test ===');
    console.log(`COG1 first byte: 0x${cog1Packet[0].toString(16).padStart(2, '0')}`);
    console.log(`COG2 first byte: 0x${cog2Packet[0].toString(16).padStart(2, '0')}`);
    
    // Add COG1
    buffer.appendAtTail(cog1Packet);
    
    // Add COG2 immediately after
    buffer.appendAtTail(cog2Packet);
    
    // Extract both
    extractor.extractMessages();
    
    // Check extraction
    expect(outputQueue.getSize()).toBe(2);
    
    // Check COG1
    const msg1 = outputQueue.dequeue();
    if (msg1 && msg1.data instanceof Uint8Array) {
      console.log(`Extracted message 1, first byte: 0x${msg1.data[0].toString(16).padStart(2, '0')}`);
      expect(msg1.data[0]).toBe(1);
    }
    
    // Check COG2 - THIS IS THE CRITICAL TEST
    const msg2 = outputQueue.dequeue();
    if (msg2 && msg2.data instanceof Uint8Array) {
      console.log(`Extracted message 2, first byte: 0x${msg2.data[0].toString(16).padStart(2, '0')}`);
      expect(msg2.data[0]).toBe(2); // MUST BE 2, NOT 0!
    }
  });
});