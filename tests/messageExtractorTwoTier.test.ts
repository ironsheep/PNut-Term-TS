/** @format */

// tests/messageExtractorTwoTier.test.ts
// Two-Tier Pattern Matching Tests for MessageExtractor

import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('MessageExtractor - Two-Tier Pattern Matching', () => {
  let buffer: CircularBuffer;
  let outputQueue: DynamicQueue<ExtractedMessage>;
  let extractor: MessageExtractor;

  beforeEach(() => {
    buffer = new CircularBuffer();
    outputQueue = new DynamicQueue<ExtractedMessage>();
    extractor = new MessageExtractor(buffer, outputQueue);
  });

  describe('TIER 1 - VERY DISTINCTIVE Patterns', () => {
    describe('0xDB Protocol Packets', () => {
      it('should recognize and extract complete 0xDB packet', () => {
        // Create 0xDB packet: header(4) + payload(8) = 12 bytes
        const packet = new Uint8Array([
          0xDB, 0x01, 0x08, 0x00,  // Header: 0xDB, subtype=1, payload_len=8 (little-endian)
          0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22  // Payload (8 bytes)
        ]);
        buffer.appendAtTail(packet);

        const hasMore = extractor.extractMessages();
        
        expect(outputQueue.getSize()).toBe(1);
        const msg = outputQueue.dequeue()!;
        expect(msg.type).toBe(MessageType.DB_PACKET);
        expect(msg.confidence).toBe('VERY_DISTINCTIVE');
        expect(msg.data.length).toBe(12);
        expect(msg.data[0]).toBe(0xDB);
        expect(msg.metadata?.payloadSize).toBe(8);
        expect(msg.metadata?.validationStatus).toBe('COMPLETE');
      });

      it('should wait for incomplete 0xDB packet', () => {
        // Header says payload is 8 bytes, but only provide 4
        const incompletePacket = new Uint8Array([
          0xDB, 0x02, 0x08, 0x00,  // Header says 8-byte payload
          0xAA, 0xBB, 0xCC, 0xDD   // Only 4 bytes of payload
        ]);
        buffer.appendAtTail(incompletePacket);

        const hasMore = extractor.extractMessages();
        
        // Should not extract incomplete packet
        expect(outputQueue.getSize()).toBe(0);
        expect(hasMore).toBe(true);  // Indicates waiting for more data
      });

      it('should reject oversized 0xDB packets', () => {
        // Header claims 10KB payload (unreasonable)
        const oversizedPacket = new Uint8Array([
          0xDB, 0x03, 0x00, 0x28,  // Header: payload_len=10240 (0x2800)
          0xAA, 0xBB  // Some data
        ]);
        buffer.appendAtTail(oversizedPacket);

        const hasMore = extractor.extractMessages();
        
        // Should route to terminal as unrecognized
        expect(outputQueue.getSize()).toBe(1);
        const msg = outputQueue.dequeue()!;
        expect(msg.type).toBe(MessageType.TERMINAL_OUTPUT);
      });
    });

    describe('P2 System Initialization', () => {
      it('should recognize P2 system reboot synchronization', () => {
        const p2Init = 'Cog0 INIT $0000_0000 $0000_0000 load\r\n';
        buffer.appendAtTail(new TextEncoder().encode(p2Init));

        let syncEmitted = false;
        extractor.on('goldenSyncPoint', () => { syncEmitted = true; });

        const hasMore = extractor.extractMessages();
        
        expect(outputQueue.getSize()).toBe(1);
        const msg = outputQueue.dequeue()!;
        expect(msg.type).toBe(MessageType.P2_SYSTEM_INIT);
        expect(msg.confidence).toBe('VERY_DISTINCTIVE');
        expect(syncEmitted).toBe(true);
        expect(msg.metadata?.validationStatus).toBe('COMPLETE');
      });

      it('should not match partial P2 init messages', () => {
        const partialInit = 'Cog0 INIT $0000';  // Incomplete
        buffer.appendAtTail(new TextEncoder().encode(partialInit));

        const hasMore = extractor.extractMessages();
        
        // Should route to terminal
        expect(outputQueue.getSize()).toBe(1);
        const msg = outputQueue.dequeue()!;
        expect(msg.type).toBe(MessageType.TERMINAL_OUTPUT);
      });
    });
  });

  describe('TIER 1 - DISTINCTIVE Patterns', () => {
    describe('COG Messages', () => {
      it('should extract valid COG messages with proper format', () => {
        const cogMessages = [
          'Cog0: System starting\r\n',
          'Cog1: Task initialized\r\n',
          'Cog7: Processing complete\r\n'
        ];

        for (const cogMsg of cogMessages) {
          buffer.appendAtTail(new TextEncoder().encode(cogMsg));
        }

        extractor.extractMessages();
        
        expect(outputQueue.getSize()).toBe(3);
        
        for (let i = 0; i < 3; i++) {
          const msg = outputQueue.dequeue()!;
          expect(msg.type).toBe(MessageType.COG_MESSAGE);
          expect(msg.confidence).toBe('DISTINCTIVE');
          expect(msg.metadata?.cogId).toBeDefined();
          expect(msg.metadata?.cogId).toBe(i === 2 ? 7 : i);  // 0, 1, 7
          expect(msg.metadata?.validationStatus).toBe('COMPLETE');
        }
      });

      it('should reject invalid COG IDs with warning', () => {
        const invalidCogMsg = 'Cog9: Invalid COG ID\r\n';  // COG 9 doesn't exist
        buffer.appendAtTail(new TextEncoder().encode(invalidCogMsg));

        const hasMore = extractor.extractMessages();
        
        expect(outputQueue.getSize()).toBe(1);
        const msg = outputQueue.dequeue()!;
        expect(msg.type).toBe(MessageType.INVALID_COG);
        expect(msg.confidence).toBe('DEFAULT');
        expect(msg.metadata?.validationStatus).toBe('INVALID');
        expect(msg.metadata?.warningMessage).toContain('Invalid COG ID');
      });

      it('should handle case-sensitive COG pattern matching', () => {
        const testCases = [
          { input: 'Cog1: Valid case\r\n', shouldMatch: true },
          { input: 'cog1: Invalid case\r\n', shouldMatch: false },
          { input: 'COG1: Invalid case\r\n', shouldMatch: false }
        ];

        for (const testCase of testCases) {
          buffer.clear();
          outputQueue = new DynamicQueue<ExtractedMessage>();
          extractor = new MessageExtractor(buffer, outputQueue);
          
          buffer.appendAtTail(new TextEncoder().encode(testCase.input));
          extractor.extractMessages();
          
          const msg = outputQueue.dequeue()!;
          if (testCase.shouldMatch) {
            expect(msg.type).toBe(MessageType.COG_MESSAGE);
            expect(msg.confidence).toBe('DISTINCTIVE');
          } else {
            expect(msg.type).toBe(MessageType.TERMINAL_OUTPUT);
            expect(msg.confidence).toBe('DEFAULT');
          }
        }
      });
    });

    describe('Backtick Window Commands', () => {
      it('should extract backtick window commands', () => {
        const windowCmd = '`debug COG1\r\n';
        buffer.appendAtTail(new TextEncoder().encode(windowCmd));

        const hasMore = extractor.extractMessages();
        
        expect(outputQueue.getSize()).toBe(1);
        const msg = outputQueue.dequeue()!;
        expect(msg.type).toBe(MessageType.BACKTICK_WINDOW);
        expect(msg.confidence).toBe('DISTINCTIVE');
        expect(msg.metadata?.windowCommand).toBe('debug');
        expect(msg.metadata?.validationStatus).toBe('COMPLETE');
      });

      it('should handle various window command formats', () => {
        const commands = [
          '`terminal main\r\n',
          '`logger debug\r\n',
          '`monitor stats\r\n'
        ];

        for (const cmd of commands) {
          buffer.appendAtTail(new TextEncoder().encode(cmd));
        }

        extractor.extractMessages();
        
        expect(outputQueue.getSize()).toBe(3);
        const expectedCommands = ['terminal', 'logger', 'monitor'];
        
        for (let i = 0; i < 3; i++) {
          const msg = outputQueue.dequeue()!;
          expect(msg.type).toBe(MessageType.BACKTICK_WINDOW);
          expect(msg.metadata?.windowCommand).toBe(expectedCommands[i]);
        }
      });
    });
  });

  describe('TIER 2 - NEEDS CONTEXT Patterns', () => {
    describe('80-byte Debugger Packets', () => {
      it('should validate 80-byte packets with context boundary checking', () => {
        // Create 80-byte packet with COG ID 1
        const debuggerPacket = new Uint8Array(80);
        debuggerPacket[0] = 0x01;  // COG ID 1
        debuggerPacket[1] = 0x00;
        debuggerPacket[2] = 0x00;
        debuggerPacket[3] = 0x00;
        // Fill rest with debug data
        for (let i = 4; i < 80; i++) {
          debuggerPacket[i] = i % 256;
        }

        // Add valid follower (another COG message)
        const follower = 'Cog1: Next message\r\n';
        
        buffer.appendAtTail(debuggerPacket);
        buffer.appendAtTail(new TextEncoder().encode(follower));

        extractor.extractMessages();
        
        expect(outputQueue.getSize()).toBe(2);
        
        const debugMsg = outputQueue.dequeue()!;
        expect(debugMsg.type).toBe(MessageType.DEBUGGER_80BYTE);
        expect(debugMsg.confidence).toBe('NEEDS_CONTEXT');
        expect(debugMsg.data.length).toBe(80);
        expect(debugMsg.metadata?.cogId).toBe(1);
        expect(debugMsg.metadata?.validationStatus).toBe('COMPLETE');

        const cogMsg = outputQueue.dequeue()!;
        expect(cogMsg.type).toBe(MessageType.COG_MESSAGE);
      });

      it('should reject 80-byte packets with invalid boundaries', () => {
        // Create 80-byte packet
        const invalidPacket = new Uint8Array(80);
        invalidPacket[0] = 0x02;  // COG ID 2
        for (let i = 1; i < 80; i++) {
          invalidPacket[i] = 0xFF;
        }

        // Add invalid follower (random byte that doesn't match patterns)
        const invalidFollower = new Uint8Array([0x99, 0x88, 0x77]);
        
        buffer.appendAtTail(invalidPacket);
        buffer.appendAtTail(invalidFollower);

        extractor.extractMessages();
        
        // Should route to terminal due to invalid boundary
        expect(outputQueue.getSize()).toBe(1);
        const msg = outputQueue.dequeue()!;
        expect(msg.type).toBe(MessageType.TERMINAL_OUTPUT);
      });

      it('should handle incomplete 80-byte packets', () => {
        // Only provide 40 bytes of an 80-byte packet
        const incompletePacket = new Uint8Array(40);
        incompletePacket[0] = 0x03;  // COG ID 3
        for (let i = 1; i < 40; i++) {
          incompletePacket[i] = 0xAA;
        }

        buffer.appendAtTail(incompletePacket);

        const hasMore = extractor.extractMessages();
        
        // Should not extract incomplete packet
        expect(outputQueue.getSize()).toBe(0);
        expect(hasMore).toBe(true);  // Waiting for more data
      });
    });
  });

  describe('Terminal FIRST Principle', () => {
    it('should route unknown data to terminal by default', () => {
      const unknownData = new Uint8Array([
        0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0,
        0xFF, 0xEE, 0xDD, 0xCC, 0xBB, 0xAA, 0x99, 0x88
      ]);
      buffer.appendAtTail(unknownData);

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBeGreaterThan(0);
      
      // All messages should be terminal output
      while (outputQueue.getSize() > 0) {
        const msg = outputQueue.dequeue()!;
        expect(msg.type).toBe(MessageType.TERMINAL_OUTPUT);
        expect(msg.confidence).toBe('DEFAULT');
      }
    });

    it('should route text data without patterns to terminal', () => {
      const terminalText = 'This is regular terminal output\r\nSecond line\r\n';
      buffer.appendAtTail(new TextEncoder().encode(terminalText));

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(2);  // Two lines
      
      const msg1 = outputQueue.dequeue()!;
      const msg2 = outputQueue.dequeue()!;
      
      expect(msg1.type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(msg2.type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(msg1.confidence).toBe('DEFAULT');
      expect(msg2.confidence).toBe('DEFAULT');
    });

    it('should prefer terminal over ambiguous binary data', () => {
      // Create data that could be interpreted multiple ways
      const ambiguousData = new Uint8Array([
        0x43, 0x6F, 0x67, 0x39, 0x3A, 0x20,  // "Cog9: " (invalid COG ID)
        0x50, 0x72, 0x69, 0x6E, 0x74, 0x0D   // "Print\r"
      ]);
      buffer.appendAtTail(ambiguousData);

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      
      // Should be routed as invalid COG with warning, not terminal
      expect(msg.type).toBe(MessageType.INVALID_COG);
      expect(msg.metadata?.validationStatus).toBe('INVALID');
    });
  });

  describe('Partial Message Handling', () => {
    it('should wait for complete messages before extraction', () => {
      // Send partial COG message without CR terminator
      const partialCog = 'Cog1: Partial message';
      buffer.appendAtTail(new TextEncoder().encode(partialCog));

      const hasMore = extractor.extractMessages();
      
      // Should not extract until CR is received
      expect(outputQueue.getSize()).toBe(0);
      expect(hasMore).toBe(true);

      // Complete the message
      const completion = '\r\n';
      buffer.appendAtTail(new TextEncoder().encode(completion));

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.COG_MESSAGE);
    });

    it('should handle mixed complete and partial messages', () => {
      // Send complete message + partial message
      const mixed = 'Cog0: Complete message\r\nCog1: Partial';
      buffer.appendAtTail(new TextEncoder().encode(mixed));

      const hasMore1 = extractor.extractMessages();
      
      // Should extract the complete message
      expect(outputQueue.getSize()).toBe(1);
      expect(hasMore1).toBe(true);  // Still has partial data

      const msg1 = outputQueue.dequeue()!;
      expect(msg1.type).toBe(MessageType.COG_MESSAGE);
      expect(msg1.metadata?.cogId).toBe(0);

      // Complete the partial message
      buffer.appendAtTail(new TextEncoder().encode(' message\r\n'));

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(1);
      const msg2 = outputQueue.dequeue()!;
      expect(msg2.type).toBe(MessageType.COG_MESSAGE);
      expect(msg2.metadata?.cogId).toBe(1);
    });
  });

  describe('Pattern Priority and Precedence', () => {
    it('should prioritize 0xDB packets over other patterns', () => {
      // Create buffer with 0xDB packet followed by COG message
      const dbPacket = new Uint8Array([0xDB, 0x01, 0x04, 0x00, 0xAA, 0xBB, 0xCC, 0xDD]);
      const cogMessage = 'Cog1: Test message\r\n';
      
      buffer.appendAtTail(dbPacket);
      buffer.appendAtTail(new TextEncoder().encode(cogMessage));

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(2);
      
      // First message should be DB packet (higher priority)
      const msg1 = outputQueue.dequeue()!;
      expect(msg1.type).toBe(MessageType.DB_PACKET);
      expect(msg1.metadata?.patternMatched).toContain('0xDB protocol');

      // Second message should be COG message
      const msg2 = outputQueue.dequeue()!;
      expect(msg2.type).toBe(MessageType.COG_MESSAGE);
    });

    it('should handle pattern conflicts correctly', () => {
      // Create data that starts like a COG message but is actually something else
      const conflictingData = 'Cog? Invalid format\r\n';
      buffer.appendAtTail(new TextEncoder().encode(conflictingData));

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      
      // Should be routed to terminal since it doesn't match COG pattern exactly
      expect(msg.type).toBe(MessageType.TERMINAL_OUTPUT);
    });
  });

  describe('Statistics and Performance', () => {
    it('should track message extraction statistics', () => {
      const testMessages = [
        new Uint8Array([0xDB, 0x01, 0x02, 0x00, 0xAA, 0xBB]),  // DB packet
        new TextEncoder().encode('Cog1: Test\r\n'),              // COG message
        new TextEncoder().encode('`window test\r\n'),            // Backtick command
        new TextEncoder().encode('Terminal text\r\n')            // Terminal output
      ];

      for (const msg of testMessages) {
        buffer.appendAtTail(msg);
      }

      extractor.extractMessages();
      
      const stats = extractor.getStats();
      
      expect(stats.messagesExtracted[MessageType.DB_PACKET]).toBe(1);
      expect(stats.messagesExtracted[MessageType.COG_MESSAGE]).toBe(1);
      expect(stats.messagesExtracted[MessageType.BACKTICK_WINDOW]).toBe(1);
      expect(stats.messagesExtracted[MessageType.TERMINAL_OUTPUT]).toBe(1);
      expect(stats.totalBytesExtracted).toBeGreaterThan(0);
    });

    it('should reset statistics correctly', () => {
      const testMsg = new TextEncoder().encode('Test message\r\n');
      buffer.appendAtTail(testMsg);
      
      extractor.extractMessages();
      
      let stats = extractor.getStats();
      expect(stats.messagesExtracted[MessageType.TERMINAL_OUTPUT]).toBe(1);
      
      extractor.resetStats();
      
      stats = extractor.getStats();
      expect(stats.messagesExtracted[MessageType.TERMINAL_OUTPUT]).toBe(0);
      expect(stats.totalBytesExtracted).toBe(0);
    });
  });

  describe('Real-World P2 Data Scenarios', () => {
    it('should handle P2 boot sequence correctly', () => {
      // Simulate real P2 boot sequence
      const bootSequence = [
        'Cog0 INIT $0000_0000 $0000_0000 load\r\n',  // System init
        'Cog0: System boot complete\r\n',              // COG 0 message
        'Cog1 INIT $1000_0000 $0000_0008 start\r\n',  // COG 1 init
        'Cog1: Task processor ready\r\n'               // COG 1 message
      ];

      let syncEvents = 0;
      extractor.on('goldenSyncPoint', () => syncEvents++);

      for (const msg of bootSequence) {
        buffer.appendAtTail(new TextEncoder().encode(msg));
      }

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(4);
      expect(syncEvents).toBe(1);  // Only one golden sync point
      
      // Check message order and types
      const msg1 = outputQueue.dequeue()!;  // System init
      expect(msg1.type).toBe(MessageType.P2_SYSTEM_INIT);
      
      const msg2 = outputQueue.dequeue()!;  // COG 0 message
      expect(msg2.type).toBe(MessageType.COG_MESSAGE);
      expect(msg2.metadata?.cogId).toBe(0);
      
      const msg3 = outputQueue.dequeue()!;  // COG 1 init (should be terminal - not exact system init pattern)
      expect(msg3.type).toBe(MessageType.TERMINAL_OUTPUT);
      
      const msg4 = outputQueue.dequeue()!;  // COG 1 message
      expect(msg4.type).toBe(MessageType.COG_MESSAGE);
      expect(msg4.metadata?.cogId).toBe(1);
    });

    it('should handle mixed binary and text data streams', () => {
      // Simulate mixed P2 data stream
      const dbPacket = new Uint8Array([0xDB, 0x02, 0x06, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
      const cogMessage = 'Cog2: Debug checkpoint reached\r\n';
      const binaryPacket80 = new Uint8Array(80);
      binaryPacket80[0] = 0x02;  // COG 2
      const terminalText = 'User output: Hello from P2!\r\n';
      
      // Add valid follower for 80-byte packet
      const follower = 'Cog3: Processing\r\n';

      buffer.appendAtTail(dbPacket);
      buffer.appendAtTail(new TextEncoder().encode(cogMessage));
      buffer.appendAtTail(binaryPacket80);
      buffer.appendAtTail(new TextEncoder().encode(follower));
      buffer.appendAtTail(new TextEncoder().encode(terminalText));

      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(5);
      
      // Verify message types in order
      const types = [];
      while (outputQueue.getSize() > 0) {
        types.push(outputQueue.dequeue()!.type);
      }
      
      expect(types).toEqual([
        MessageType.DB_PACKET,        // Highest priority
        MessageType.COG_MESSAGE,      // COG 2 message  
        MessageType.DEBUGGER_80BYTE,  // 80-byte packet with valid boundary
        MessageType.COG_MESSAGE,      // COG 3 follower
        MessageType.TERMINAL_OUTPUT   // User output
      ]);
    });
  });
});