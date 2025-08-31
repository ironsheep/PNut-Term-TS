/**
 * End-to-end test for COG2 packet routing to Debug Logger
 * Verifies that COG2 packets arrive at Debug Logger with correct COG ID
 */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { MessageRouter } from '../src/classes/shared/messageRouter';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('COG2 Debug Logger Routing Test', () => {
  let buffer: CircularBuffer;
  let extractor: MessageExtractor;
  let router: MessageRouter;
  let extractQueue: DynamicQueue<ExtractedMessage>;
  let debugLoggerMessages: ExtractedMessage[] = [];

  beforeEach(() => {
    buffer = new CircularBuffer(8192);
    extractQueue = new DynamicQueue(100, 1000, 'test');
    extractor = new MessageExtractor(buffer, extractQueue);
    router = new MessageRouter();
    
    // Mock Debug Logger destination to capture messages
    const mockDebugLogger = {
      processMessage: (message: ExtractedMessage) => {
        debugLoggerMessages.push(message);
        console.log(`[Mock Debug Logger] Received ${message.type}, first byte: 0x${
          message.data instanceof Uint8Array ? message.data[0].toString(16) : 'N/A'
        }`);
      }
    };
    
    // Register the mock debug logger
    router.registerDestination(MessageType.DEBUGGER_416BYTE, mockDebugLogger);
  });

  /**
   * Create a 416-byte debugger packet for a specific COG
   */
  function createDebuggerPacket(cogId: number): Uint8Array {
    const packet = new Uint8Array(416);
    
    // Status block (40 bytes)
    // First long is COG ID (little-endian)
    packet[0] = cogId;  // THIS IS THE CRITICAL BYTE
    packet[1] = 0x00;
    packet[2] = 0x00;
    packet[3] = 0x00;
    
    // Second long - COG state
    packet[4] = cogId; // Echo COG ID for testing
    packet[5] = 0x00;
    packet[6] = 0x00;
    packet[7] = 0x00;
    
    // Fill rest with test pattern
    for (let i = 8; i < 416; i++) {
      packet[i] = (i % 256);
    }
    
    return packet;
  }

  test('COG2 packet should arrive at Debug Logger with COG ID 2', () => {
    console.log('\n=== COG2 END-TO-END ROUTING TEST ===');
    
    // Create packets for COG1 and COG2
    const cog1Packet = createDebuggerPacket(1);
    const cog2Packet = createDebuggerPacket(2);
    
    console.log(`COG1 packet first byte: 0x${cog1Packet[0].toString(16)}`);
    console.log(`COG2 packet first byte: 0x${cog2Packet[0].toString(16)}`);
    
    // Add both packets to buffer
    buffer.appendAtTail(cog1Packet);
    buffer.appendAtTail(cog2Packet);
    
    // Extract messages
    extractor.extractMessages();
    
    // Process extracted messages through router
    let extractedCount = 0;
    while (extractQueue.getSize() > 0) {
      const message = extractQueue.dequeue();
      if (message) {
        extractedCount++;
        console.log(`Extracted message ${extractedCount}: type=${message.type}, first byte=0x${
          message.data instanceof Uint8Array ? message.data[0].toString(16) : 'N/A'
        }`);
        
        // Route the message
        router.routeMessage(message);
      }
    }
    
    // Verify extraction
    expect(extractedCount).toBe(2);
    
    // Verify Debug Logger received both packets
    expect(debugLoggerMessages.length).toBe(2);
    
    // CRITICAL TEST: Verify COG IDs are correct at Debug Logger
    const cog1Message = debugLoggerMessages[0];
    const cog2Message = debugLoggerMessages[1];
    
    expect(cog1Message.type).toBe(MessageType.DEBUGGER_416BYTE);
    expect(cog2Message.type).toBe(MessageType.DEBUGGER_416BYTE);
    
    // Check the actual data
    expect(cog1Message.data).toBeInstanceOf(Uint8Array);
    expect(cog2Message.data).toBeInstanceOf(Uint8Array);
    
    if (cog1Message.data instanceof Uint8Array && cog2Message.data instanceof Uint8Array) {
      console.log(`\nDebug Logger received:`);
      console.log(`  COG1 first byte: 0x${cog1Message.data[0].toString(16)} (expected 0x01)`);
      console.log(`  COG2 first byte: 0x${cog2Message.data[0].toString(16)} (expected 0x02)`);
      
      // THE CRITICAL ASSERTIONS
      expect(cog1Message.data[0]).toBe(0x01); // COG1 ID
      expect(cog2Message.data[0]).toBe(0x02); // COG2 ID - THIS IS WHAT'S FAILING IN HARDWARE
    }
  });

  test('Mixed COG messages and debugger packets should route correctly', () => {
    // Add COG text message
    const cogText = new TextEncoder().encode('Cog2  Task started\r\n');
    buffer.appendAtTail(cogText);
    
    // Add COG2 debugger packet
    const cog2Packet = createDebuggerPacket(2);
    buffer.appendAtTail(cog2Packet);
    
    // Add another COG text message
    const cogText2 = new TextEncoder().encode('Cog2  Still running\r\n');
    buffer.appendAtTail(cogText2);
    
    // Extract all messages
    extractor.extractMessages();
    
    // Process through router
    while (extractQueue.getSize() > 0) {
      const message = extractQueue.dequeue();
      if (message) {
        router.routeMessage(message);
      }
    }
    
    // Find the debugger packet in Debug Logger messages
    const debuggerPackets = debugLoggerMessages.filter(
      m => m.type === MessageType.DEBUGGER_416BYTE
    );
    
    expect(debuggerPackets.length).toBe(1);
    
    const cog2Message = debuggerPackets[0];
    if (cog2Message.data instanceof Uint8Array) {
      expect(cog2Message.data[0]).toBe(0x02); // COG2 ID must be preserved
    }
  });
});