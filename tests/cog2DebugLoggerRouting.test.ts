/**
 * End-to-end test for COG2 packet routing to Debug Logger
 * Verifies that COG2 packets arrive at Debug Logger with correct COG ID
 *
 * Updated to use new SharedMessagePool architecture
 */

import { SharedMessagePool, SharedMessageType, ExtractedMessage } from '../src/classes/shared/sharedMessagePool';
import { MessageRouter, RouteDestination } from '../src/classes/shared/messageRouter';

describe('COG2 Debug Logger Routing Test', () => {
  let messagePool: SharedMessagePool;
  let router: MessageRouter;
  let debugLoggerMessages: ExtractedMessage[] = [];

  beforeEach(() => {
    // Create shared message pool
    messagePool = new SharedMessagePool(100, 1024);

    // Create router and configure with message pool
    router = new MessageRouter();
    router.setSharedMessagePool(messagePool);

    // Reset captured messages
    debugLoggerMessages = [];

    // Mock Debug Logger destination to capture messages
    const mockDebugLogger: RouteDestination = {
      name: 'MockDebugLogger',
      handler: (message: ExtractedMessage) => {
        // Clone the data since SharedMessagePool may reuse the buffer
        const dataCopy = new Uint8Array(message.data);
        debugLoggerMessages.push({
          type: message.type,
          data: dataCopy,
          timestamp: message.timestamp
        });
        console.log(`[Mock Debug Logger] Received type=${message.type}, first byte: 0x${
          dataCopy[0].toString(16)
        }`);
      }
    };

    // Register the mock debug logger for debugger packets (COG0-COG7)
    for (let cogId = 0; cogId <= 7; cogId++) {
      const debuggerType = SharedMessageType.DEBUGGER0_416BYTE + cogId;
      router.registerDestination(debuggerType, mockDebugLogger);
    }
  });

  afterEach(() => {
    // Clean up
    debugLoggerMessages = [];
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

  /**
   * Helper to acquire a slot, write a message to the pool, then route it
   */
  function acquireAndRoute(messageType: SharedMessageType, data: Uint8Array): void {
    const slot = messagePool.acquire(data.length);
    if (!slot) {
      throw new Error('Failed to acquire message pool slot');
    }

    slot.writeType(messageType);
    slot.writeLength(data.length);  // Must set length before readData() will work
    slot.writeData(data);

    // Route the message
    router.routeFromPool(slot.poolId);
  }

  test('COG2 packet should arrive at Debug Logger with COG ID 2', () => {
    console.log('\n=== COG2 END-TO-END ROUTING TEST ===');

    // Create packets for COG1 and COG2
    const cog1Packet = createDebuggerPacket(1);
    const cog2Packet = createDebuggerPacket(2);

    console.log(`COG1 packet first byte: 0x${cog1Packet[0].toString(16)}`);
    console.log(`COG2 packet first byte: 0x${cog2Packet[0].toString(16)}`);

    // Route COG1 debugger packet (type = DEBUGGER1_416BYTE)
    acquireAndRoute(SharedMessageType.DEBUGGER1_416BYTE, cog1Packet);

    // Route COG2 debugger packet (type = DEBUGGER2_416BYTE)
    acquireAndRoute(SharedMessageType.DEBUGGER2_416BYTE, cog2Packet);

    // Verify Debug Logger received both packets
    expect(debugLoggerMessages.length).toBe(2);

    // CRITICAL TEST: Verify COG IDs are correct at Debug Logger
    const cog1Message = debugLoggerMessages[0];
    const cog2Message = debugLoggerMessages[1];

    expect(cog1Message.type).toBe(SharedMessageType.DEBUGGER1_416BYTE);
    expect(cog2Message.type).toBe(SharedMessageType.DEBUGGER2_416BYTE);

    // Check the actual data
    console.log(`\nDebug Logger received:`);
    console.log(`  COG1 first byte: 0x${cog1Message.data[0].toString(16)} (expected 0x01)`);
    console.log(`  COG2 first byte: 0x${cog2Message.data[0].toString(16)} (expected 0x02)`);

    // THE CRITICAL ASSERTIONS
    expect(cog1Message.data[0]).toBe(0x01); // COG1 ID
    expect(cog2Message.data[0]).toBe(0x02); // COG2 ID

    console.log('\n✓ COG IDs preserved correctly through routing');
  });

  test('COG messages route to correct destinations', () => {
    // Create COG text message
    const cogText = new TextEncoder().encode('Cog2  Task started\r\n');

    // Mock destination for COG messages
    const cogMessages: ExtractedMessage[] = [];
    const mockCogDestination: RouteDestination = {
      name: 'MockCogDestination',
      handler: (message: ExtractedMessage) => {
        cogMessages.push({
          type: message.type,
          data: new Uint8Array(message.data),
          timestamp: message.timestamp
        });
      }
    };

    // Register for COG2 messages
    router.registerDestination(SharedMessageType.COG2_MESSAGE, mockCogDestination);

    // Route COG2 message
    acquireAndRoute(SharedMessageType.COG2_MESSAGE, cogText);

    // Verify
    expect(cogMessages.length).toBe(1);
    expect(cogMessages[0].type).toBe(SharedMessageType.COG2_MESSAGE);

    const receivedText = new TextDecoder().decode(cogMessages[0].data);
    expect(receivedText).toBe('Cog2  Task started\r\n');
  });

  test('Mixed COG messages and debugger packets should route correctly', () => {
    // Track both types
    const cogMessages: ExtractedMessage[] = [];
    const mockCogDestination: RouteDestination = {
      name: 'MockCogDestination',
      handler: (message: ExtractedMessage) => {
        cogMessages.push({
          type: message.type,
          data: new Uint8Array(message.data),
          timestamp: message.timestamp
        });
      }
    };
    router.registerDestination(SharedMessageType.COG2_MESSAGE, mockCogDestination);

    // Send COG text message
    const cogText = new TextEncoder().encode('Cog2  Task started\r\n');
    acquireAndRoute(SharedMessageType.COG2_MESSAGE, cogText);

    // Send COG2 debugger packet
    const cog2Packet = createDebuggerPacket(2);
    acquireAndRoute(SharedMessageType.DEBUGGER2_416BYTE, cog2Packet);

    // Send another COG text message
    const cogText2 = new TextEncoder().encode('Cog2  Still running\r\n');
    acquireAndRoute(SharedMessageType.COG2_MESSAGE, cogText2);

    // Verify COG messages
    expect(cogMessages.length).toBe(2);

    // Verify debugger packets (from beforeEach setup)
    const debuggerPackets = debugLoggerMessages.filter(
      m => m.type === SharedMessageType.DEBUGGER2_416BYTE
    );
    expect(debuggerPackets.length).toBe(1);

    // CRITICAL: Verify COG2 ID preserved in debugger packet
    const cog2Message = debuggerPackets[0];
    expect(cog2Message.data[0]).toBe(0x02); // COG2 ID must be preserved

    console.log('✓ Mixed routing works correctly');
  });
});
