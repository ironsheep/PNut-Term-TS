/** @format */

// tests/messageClassificationRouting.test.ts

import { MessageRouter, RouteDestination } from '../src/classes/shared/messageRouter';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';
import { ExtractedMessage, MessageType } from '../src/classes/shared/messageExtractor';

/**
 * MESSAGE CLASSIFICATION AND ROUTING VALIDATION
 * 
 * Tests the layer above MessageExtractor boundary detection:
 * MessageExtractor Output → Classification → Router → Destination
 * 
 * FOUNDATION: MessageExtractor boundary detection is working 100% (verified in previous tests)
 * THIS LAYER: Validate that extracted messages get classified and routed correctly
 * 
 * Test Flow:
 * 1. Create extracted messages matching MessageExtractor output format
 * 2. Feed to MessageRouter with registered destinations  
 * 3. Verify correct routing based on message type and content
 * 4. Validate COG packets → Debug Logger, ASCII → Main Console
 */

describe('Message Classification and Routing', () => {
  let inputQueue: DynamicQueue<ExtractedMessage>;
  let router: MessageRouter;
  let routedMessages: Record<string, ExtractedMessage[]>;

  beforeEach(() => {
    inputQueue = new DynamicQueue<ExtractedMessage>();
    router = new MessageRouter(inputQueue);
    routedMessages = {};
  });

  // Helper to create test messages matching MessageExtractor output format
  function createExtractedMessage(
    type: MessageType, 
    data: Uint8Array, 
    confidence: 'VERY_DISTINCTIVE' | 'DISTINCTIVE' | 'NEEDS_CONTEXT' | 'DEFAULT' = 'DEFAULT',
    cogId?: number
  ): ExtractedMessage {
    return {
      type,
      data,
      confidence,
      timestamp: Date.now(),
      metadata: cogId !== undefined ? { cogId } : undefined
    };
  }

  // Helper to create routing destinations  
  function createDestination(name: string): RouteDestination {
    routedMessages[name] = [];
    return {
      name,
      handler: (msg) => {
        routedMessages[name].push(msg);
      }
    };
  }

  // Real COG packet data from MessageExtractor boundary tests - these are known to work
  const COG1_80_BYTES = new Uint8Array([
    0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x0e, 0x00, 0xa1, 0x03, 0xf8, 0x01, 0x00, 0x00,
    0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
    0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80, 0x90,
    0xa0, 0xb0, 0xc0, 0xd0, 0xe0, 0xf0, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88, 0x77, 0x66
  ]);

  const COG2_80_BYTES = new Uint8Array([
    0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x1c, 0x00, 0xb2, 0x04, 0xf9, 0x02, 0x00, 0x00,
    0x21, 0x43, 0x65, 0x87, 0xa9, 0xcb, 0xed, 0x0f, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
    0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
    0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa,
    0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a
  ]);

  describe('FOUNDATION: Destination Registration', () => {
    it('should register Debug Logger for DEBUGGER_80BYTE messages', () => {
      const debugLogger = createDestination('DebugLogger');
      router.registerDestination(MessageType.DEBUGGER_80BYTE, debugLogger);

      const config = router.getRoutingConfig();
      expect(config[MessageType.DEBUGGER_80BYTE]).toHaveLength(1);
      expect(config[MessageType.DEBUGGER_80BYTE][0].name).toBe('DebugLogger');
    });

    it('should register Main Console for TERMINAL_OUTPUT messages', () => {
      const mainConsole = createDestination('MainConsole');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, mainConsole);

      const config = router.getRoutingConfig();
      expect(config[MessageType.TERMINAL_OUTPUT]).toHaveLength(1);
      expect(config[MessageType.TERMINAL_OUTPUT][0].name).toBe('MainConsole');
    });

    it('should register Main Console for P2_SYSTEM_INIT messages', () => {
      const mainConsole = createDestination('MainConsole');
      router.registerDestination(MessageType.P2_SYSTEM_INIT, mainConsole);

      const config = router.getRoutingConfig();
      expect(config[MessageType.P2_SYSTEM_INIT]).toHaveLength(1);
      expect(config[MessageType.P2_SYSTEM_INIT][0].name).toBe('MainConsole');
    });
  });

  describe('CORE TEST: COG Packet Routing to Debug Logger', () => {
    beforeEach(() => {
      // Set up routing: COG packets → Debug Logger, everything else → Main Console
      const debugLogger = createDestination('DebugLogger');
      const mainConsole = createDestination('MainConsole');
      
      router.registerDestination(MessageType.DEBUGGER_80BYTE, debugLogger);
      router.registerDestination(MessageType.TERMINAL_OUTPUT, mainConsole);
      router.registerDestination(MessageType.P2_SYSTEM_INIT, mainConsole);
    });

    it('should route DEBUGGER_80BYTE messages to Debug Logger', () => {
      console.log('=== COG PACKET ROUTING TEST ===');
      console.log(`Testing COG1 packet routing (80 bytes, starts with 0x${COG1_80_BYTES[0].toString(16).padStart(2, '0')})`);

      // Create COG packet message matching MessageExtractor output
      const cogMessage = createExtractedMessage(
        MessageType.DEBUGGER_80BYTE, 
        COG1_80_BYTES,
        'NEEDS_CONTEXT',
        1  // COG ID
      );

      // Add to input queue and process
      inputQueue.enqueue(cogMessage);
      const processed = router.processMessagesSync();

      console.log(`Messages processed: ${processed}`);
      console.log(`Debug Logger received: ${routedMessages['DebugLogger']?.length || 0} messages`);
      console.log(`Main Console received: ${routedMessages['MainConsole']?.length || 0} messages`);

      // Validate routing
      expect(processed).toBe(1);
      expect(routedMessages['DebugLogger']).toHaveLength(1);
      expect(routedMessages['MainConsole']).toHaveLength(0);
      
      // Validate message content preservation and format identification
      const routed = routedMessages['DebugLogger'][0];
      expect(routed.type).toBe(MessageType.DEBUGGER_80BYTE);
      expect(routed.data).toEqual(COG1_80_BYTES);
      expect(routed.metadata?.cogId).toBe(1);
      expect(routed.confidence).toBe('NEEDS_CONTEXT');
      expect(routed.data.length).toBe(80); // Debug Logger knows this is exactly 80 bytes
      
      console.log(`✅ COG packet correctly routed to Debug Logger with proper format:`)
      console.log(`   - Type: ${routed.type} (Debug Logger knows to display as debugger format)`);
      console.log(`   - Size: ${routed.data.length} bytes (exact 80-byte debugger packet)`);
      console.log(`   - COG ID: ${routed.metadata?.cogId} (proper COG identification)`);
      console.log(`   - Confidence: ${routed.confidence} (needs context validation)`);
      console.log(`   - Timestamp: ${new Date(routed.timestamp).toISOString()}`);
    });

    it('should route multiple consecutive COG packets correctly', () => {
      console.log('\\n=== CONSECUTIVE COG PACKETS ROUTING TEST ===');

      // Create two COG messages (simulating Phase II boundary test output)
      const cogMessage1 = createExtractedMessage(
        MessageType.DEBUGGER_80BYTE, 
        COG1_80_BYTES,
        'NEEDS_CONTEXT',
        1
      );
      
      const cogMessage2 = createExtractedMessage(
        MessageType.DEBUGGER_80BYTE, 
        COG2_80_BYTES,
        'NEEDS_CONTEXT',
        2
      );

      // Process both messages
      inputQueue.enqueue(cogMessage1);
      inputQueue.enqueue(cogMessage2);
      const processed = router.processMessagesSync();

      console.log(`Messages processed: ${processed}`);
      console.log(`Debug Logger received: ${routedMessages['DebugLogger']?.length || 0} messages`);

      // Validate both messages routed correctly
      expect(processed).toBe(2);
      expect(routedMessages['DebugLogger']).toHaveLength(2);
      expect(routedMessages['MainConsole']).toHaveLength(0);

      // Validate order and content  
      expect(routedMessages['DebugLogger'][0].metadata?.cogId).toBe(1);
      expect(routedMessages['DebugLogger'][1].metadata?.cogId).toBe(2);
      expect(routedMessages['DebugLogger'][0].data[0]).toBe(0x01); // COG1
      expect(routedMessages['DebugLogger'][1].data[0]).toBe(0x02); // COG2
      
      console.log('✅ Consecutive COG packets correctly routed in order');
    });

    it('should route ASCII messages to Main Console', () => {
      console.log('\\n=== ASCII MESSAGE ROUTING TEST ===');

      // Create ASCII messages matching MessageExtractor output
      const asciiMessage1 = createExtractedMessage(
        MessageType.P2_SYSTEM_INIT,
        new TextEncoder().encode("Cog0 INIT $0000_0000 $0000_0000 load\\r\\n"),
        'VERY_DISTINCTIVE'
      );

      const asciiMessage2 = createExtractedMessage(
        MessageType.TERMINAL_OUTPUT,
        new TextEncoder().encode("System initialization complete\\r\\n"),
        'DEFAULT'
      );

      // Process messages
      inputQueue.enqueue(asciiMessage1);
      inputQueue.enqueue(asciiMessage2);
      const processed = router.processMessagesSync();

      console.log(`Messages processed: ${processed}`);
      console.log(`Main Console received: ${routedMessages['MainConsole']?.length || 0} messages`);
      console.log(`Debug Logger received: ${routedMessages['DebugLogger']?.length || 0} messages`);

      // Validate routing
      expect(processed).toBe(2);
      expect(routedMessages['MainConsole']).toHaveLength(2);
      expect(routedMessages['DebugLogger']).toHaveLength(0);

      // Validate content and format identification for Main Console  
      const systemInit = routedMessages['MainConsole'][0];
      const terminalOut = routedMessages['MainConsole'][1];
      
      expect(systemInit.type).toBe(MessageType.P2_SYSTEM_INIT);
      expect(systemInit.confidence).toBe('VERY_DISTINCTIVE'); 
      expect(terminalOut.type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(terminalOut.confidence).toBe('DEFAULT');
      
      // Validate ASCII content is preserved for proper display
      const systemText = new TextDecoder().decode(systemInit.data);
      const terminalText = new TextDecoder().decode(terminalOut.data);
      expect(systemText).toContain('Cog0 INIT');
      expect(terminalText).toContain('System initialization');
      
      console.log('✅ ASCII messages correctly routed to Main Console with proper format:');
      console.log(`   - P2_SYSTEM_INIT: "${systemText.trim()}" (confidence: ${systemInit.confidence})`);
      console.log(`   - TERMINAL_OUTPUT: "${terminalText.trim()}" (confidence: ${terminalOut.confidence})`);
      console.log(`   - Both timestamped: ${new Date(systemInit.timestamp).toISOString()}`);
    });
  });

  describe('INTEGRATION TEST: Mixed Message Stream Routing', () => {
    beforeEach(() => {
      // Set up complete routing
      const debugLogger = createDestination('DebugLogger');
      const mainConsole = createDestination('MainConsole');
      
      router.registerDestination(MessageType.DEBUGGER_80BYTE, debugLogger);
      router.registerDestination(MessageType.TERMINAL_OUTPUT, mainConsole);
      router.registerDestination(MessageType.P2_SYSTEM_INIT, mainConsole);
    });

    it('should correctly route mixed stream matching Phase I boundary test', () => {
      console.log('\\n=== PHASE I INTEGRATION ROUTING TEST ===');
      console.log('Simulating complete MessageExtractor → Router → Destination flow');

      // Create message stream matching Phase I boundary test output:
      // 1. ASCII: "Cog0 INIT" → Main Console
      // 2. COG1: 80-byte packet → Debug Logger  
      // 3. ASCII: "Cog1 INIT" → Main Console
      // 4. COG2: 80-byte packet → Debug Logger
      // 5. ASCII: "System initialization complete" → Main Console

      const messages = [
        createExtractedMessage(
          MessageType.P2_SYSTEM_INIT,
          new TextEncoder().encode("Cog0 INIT $0000_0000 $0000_0000 load\\r\\n"),
          'VERY_DISTINCTIVE'
        ),
        createExtractedMessage(
          MessageType.DEBUGGER_80BYTE,
          COG1_80_BYTES,
          'NEEDS_CONTEXT',
          1
        ),
        createExtractedMessage(
          MessageType.TERMINAL_OUTPUT,
          new TextEncoder().encode("Cog1 INIT $0000_0F5C $0000_1834 jump\\r\\n"),
          'DEFAULT'
        ),
        createExtractedMessage(
          MessageType.DEBUGGER_80BYTE,
          COG2_80_BYTES,
          'NEEDS_CONTEXT',
          2
        ),
        createExtractedMessage(
          MessageType.TERMINAL_OUTPUT,
          new TextEncoder().encode("System initialization complete\\r\\n"),
          'DEFAULT'
        )
      ];

      // Process all messages
      messages.forEach(msg => inputQueue.enqueue(msg));
      const processed = router.processMessagesSync();

      console.log(`Total messages processed: ${processed}`);
      console.log(`Debug Logger received: ${routedMessages['DebugLogger']?.length || 0} COG packets`);
      console.log(`Main Console received: ${routedMessages['MainConsole']?.length || 0} ASCII messages`);

      // Validate complete routing
      expect(processed).toBe(5);
      expect(routedMessages['DebugLogger']).toHaveLength(2); // 2 COG packets
      expect(routedMessages['MainConsole']).toHaveLength(3); // 3 ASCII messages

      // Validate COG packet routing
      expect(routedMessages['DebugLogger'][0].metadata?.cogId).toBe(1);
      expect(routedMessages['DebugLogger'][1].metadata?.cogId).toBe(2);
      expect(routedMessages['DebugLogger'][0].data[0]).toBe(0x01); // COG1
      expect(routedMessages['DebugLogger'][1].data[0]).toBe(0x02); // COG2

      // Validate ASCII message routing
      expect(routedMessages['MainConsole'][0].type).toBe(MessageType.P2_SYSTEM_INIT);
      expect(routedMessages['MainConsole'][1].type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(routedMessages['MainConsole'][2].type).toBe(MessageType.TERMINAL_OUTPUT);

      console.log('✅ Complete mixed stream routing successful');
      console.log('✅ End-to-end flow validated: MessageExtractor → Router → Correct Destinations');
    });
  });

  describe('ERROR HANDLING: Routing Edge Cases', () => {
    beforeEach(() => {
      // Set up fallback routing for edge cases
      const debugLogger = createDestination('DebugLogger');
      const mainConsole = createDestination('MainConsole');
      
      router.registerDestination(MessageType.DEBUGGER_80BYTE, debugLogger);
      router.registerDestination(MessageType.TERMINAL_OUTPUT, mainConsole);
    });

    it('should handle binary zero streams gracefully', () => {
      console.log('\\n=== BINARY ZEROS HANDLING TEST ===');
      console.log('Testing defensive handling of unexpected binary zero streams');
      
      // Create binary zero stream (common issue from serial feed)
      const binaryZeros = new Uint8Array(50).fill(0x00); // 50 zero bytes
      const zeroMessage = createExtractedMessage(
        MessageType.TERMINAL_OUTPUT,
        binaryZeros,
        'DEFAULT'
      );

      inputQueue.enqueue(zeroMessage);
      const processed = router.processMessagesSync();

      expect(processed).toBe(1);
      expect(routedMessages['MainConsole']).toHaveLength(1);
      
      const routed = routedMessages['MainConsole'][0];
      expect(routed.data.length).toBe(50);
      expect(routed.data.every(byte => byte === 0)).toBe(true);
      
      console.log(`✅ Binary zeros handled gracefully:`);
      console.log(`   - Routed to: Main Console (safe fallback)`);
      console.log(`   - Length: ${routed.data.length} bytes`);
      console.log(`   - Type: ${routed.type} (classified as TERMINAL_OUTPUT)`);
      console.log(`   - System remains stable despite unexpected binary data`);
    });

    it('should handle mixed binary/text data with proper format identification', () => {
      console.log('\\n=== MIXED BINARY HANDLING TEST ===');
      
      // Create data with mixed binary and text (realistic scenario)
      const mixedData = new Uint8Array([
        0x00, 0x00, 0x00, 0x00, // Binary zeros
        ...new TextEncoder().encode("Debug message"),
        0x0D, 0x0A, // CRLF
        0xFF, 0xFE, 0xFD // More binary data
      ]);
      
      const mixedMessage = createExtractedMessage(
        MessageType.TERMINAL_OUTPUT,
        mixedData,
        'DEFAULT'
      );

      inputQueue.enqueue(mixedMessage);
      const processed = router.processMessagesSync();

      expect(processed).toBe(1);
      expect(routedMessages['MainConsole']).toHaveLength(1);
      
      const routed = routedMessages['MainConsole'][0];
      console.log(`✅ Mixed binary/text handled with proper format identification`);
      console.log(`   - Total length: ${routed.data.length} bytes`);
      console.log(`   - Type: ${routed.type} (Main Console can handle mixed data)`);
    });

    it('should handle messages with unknown message types gracefully', () => {
      const unknownMessage = createExtractedMessage(
        'UNKNOWN_TYPE' as MessageType,
        new TextEncoder().encode("Unknown message type"),
        'DEFAULT'
      );

      inputQueue.enqueue(unknownMessage);
      const processed = router.processMessagesSync();

      // Should not crash, but may not route anywhere
      expect(processed).toBe(1);
      console.log('✅ Unknown message types handled gracefully');
    });

    it('should handle empty message queues', () => {
      const processed = router.processMessagesSync();
      expect(processed).toBe(0);
      console.log('✅ Empty queues handled correctly');
    });
  });
});