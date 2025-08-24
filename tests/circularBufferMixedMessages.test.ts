/** @format */

// tests/circularBufferMixedMessages.test.ts
// TEST 3: Mixed P2 Debug Messages with Various EOL patterns

import { CircularBuffer, NextStatus, NextResult } from '../src/classes/shared/circularBuffer';

describe('CircularBuffer Mixed Messages Test - P2 Debugger Simulation', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer();
  });

  // Define perfect 80-byte COG packets for extraction testing
  const COG1_80_BYTES = new Uint8Array([
    0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x0E, 0x00, 0xA1, 0x03, 0xF8, 0x01, 0x00, 0x00,
    0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
    0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80, 0x90,
    0xA0, 0xB0, 0xC0, 0xD0, 0xE0, 0xF0, 0xFF, 0xEE, 0xDD, 0xCC, 0xBB, 0xAA, 0x99, 0x88, 0x77, 0x66
  ]);

  const COG2_80_BYTES = new Uint8Array([
    0x02, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x1C, 0x00, 0xB2, 0x04, 0xF9, 0x02, 0x00, 0x00,
    0x21, 0x43, 0x65, 0x87, 0xA9, 0xCB, 0xED, 0x0F, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
    0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
    0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xAA,
    0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A
  ]);

  describe('PHASE I: Mixed ASCII + Single COG 80-Byte Packets', () => {
    it('should extract perfect ASCII messages and 80-byte COG packets without corruption', () => {
      // PHASE I: Mixed stream - ASCII text separated by single COG packets
      const streamData = [];
      
      // ASCII message 1
      const msg1 = "Cog0 INIT $0000_0000 $0000_0000 load\r\n";
      streamData.push(...new TextEncoder().encode(msg1));
      
      // COG1 80-byte packet (no EOL - pure binary)
      streamData.push(...COG1_80_BYTES);
      
      // ASCII message 2  
      const msg2 = "Cog1 INIT $0000_0F5C $0000_1834 jump\r\n";
      streamData.push(...new TextEncoder().encode(msg2));
      
      // COG2 80-byte packet (no EOL - pure binary)
      streamData.push(...COG2_80_BYTES);
      
      // ASCII message 3
      const msg3 = "System initialization complete\r\n";
      streamData.push(...new TextEncoder().encode(msg3));
      
      const totalBytes = new Uint8Array(streamData);
      
      console.log(`PHASE I TEST: ${totalBytes.length} total bytes`);
      console.log(`  ASCII msg1: ${msg1.length} bytes`);
      console.log(`  COG1 packet: ${COG1_80_BYTES.length} bytes`);
      console.log(`  ASCII msg2: ${msg2.length} bytes`);
      console.log(`  COG2 packet: ${COG2_80_BYTES.length} bytes`);
      console.log(`  ASCII msg3: ${msg3.length} bytes`);
      
      // Append mixed stream to buffer
      expect(buffer.appendAtTail(totalBytes)).toBe(true);
      
      // Extract and verify byte-perfect boundaries
      const extractedBytes: number[] = [];
      let result: NextResult;
      
      while ((result = buffer.next()).status !== NextStatus.EMPTY) {
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          extractedBytes.push(result.value);
        }
      }
      
      // CRITICAL TEST: Verify exact byte count and content
      expect(extractedBytes.length).toBe(totalBytes.length);
      
      // Verify byte-perfect extraction
      for (let i = 0; i < totalBytes.length; i++) {
        if (extractedBytes[i] !== totalBytes[i]) {
          console.log(`EXTRACTION CORRUPTION at byte ${i}:`);
          console.log(`  Expected: 0x${totalBytes[i].toString(16).padStart(2, '0')}`);
          console.log(`  Got:      0x${extractedBytes[i].toString(16).padStart(2, '0')}`);
          
          // Show context
          const start = Math.max(0, i - 10);
          const end = Math.min(totalBytes.length, i + 10);
          console.log(`  Context Expected: ${Array.from(totalBytes.slice(start, end)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
          console.log(`  Context Got:      ${Array.from(extractedBytes.slice(start, end)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
        }
        expect(extractedBytes[i]).toBe(totalBytes[i]);
      }
      
      console.log('✅ PHASE I: Perfect byte-level extraction - Foundation ready for MessageExtractor');
    });
  });

  describe.skip('PHASE II: Back-to-Back COG 80-Byte Packets', () => {
    it('should extract consecutive 80-byte COG packets without ASCII separators', () => {
      // PHASE II: Back-to-back binary packets - hardest case
      const streamData = [];
      
      // ASCII message 1
      const msg1 = "Multi-COG debugger output follows:\r\n";
      streamData.push(...new TextEncoder().encode(msg1));
      
      // COG1 80-byte packet immediately followed by COG2 80-byte packet
      streamData.push(...COG1_80_BYTES);
      streamData.push(...COG2_80_BYTES);
      
      // ASCII message 2
      const msg2 = "Both COG packets processed\r\n";
      streamData.push(...new TextEncoder().encode(msg2));
      
      const totalBytes = new Uint8Array(streamData);
      
      console.log(`PHASE II TEST: ${totalBytes.length} total bytes`);
      console.log(`  ASCII msg1: ${msg1.length} bytes`);
      console.log(`  COG1 packet: ${COG1_80_BYTES.length} bytes (starts at byte ${msg1.length})`);
      console.log(`  COG2 packet: ${COG2_80_BYTES.length} bytes (starts at byte ${msg1.length + COG1_80_BYTES.length})`);
      console.log(`  ASCII msg2: ${msg2.length} bytes`);
      
      // Verify no overlap in our test data
      const cog1Start = msg1.length;
      const cog2Start = msg1.length + COG1_80_BYTES.length;
      const msg2Start = msg1.length + COG1_80_BYTES.length + COG2_80_BYTES.length;
      
      console.log(`  COG1 bytes ${cog1Start}-${cog1Start + 79}`);
      console.log(`  COG2 bytes ${cog2Start}-${cog2Start + 79}`);
      console.log(`  No overlap: ${cog2Start === cog1Start + COG1_80_BYTES.length ? '✅' : '❌'}`);
      
      // Append mixed stream to buffer
      expect(buffer.appendAtTail(totalBytes)).toBe(true);
      
      // Extract and verify byte-perfect boundaries
      const extractedBytes: number[] = [];
      let result: NextResult;
      
      while ((result = buffer.next()).status !== NextStatus.EMPTY) {
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          extractedBytes.push(result.value);
        }
      }
      
      // CRITICAL TEST: Verify exact byte count and content
      expect(extractedBytes.length).toBe(totalBytes.length);
      
      // Verify byte-perfect extraction (especially at COG boundaries)
      for (let i = 0; i < totalBytes.length; i++) {
        if (extractedBytes[i] !== totalBytes[i]) {
          let location = "unknown";
          if (i >= cog1Start && i < cog1Start + 80) {
            location = `COG1 packet byte ${i - cog1Start}`;
          } else if (i >= cog2Start && i < cog2Start + 80) {
            location = `COG2 packet byte ${i - cog2Start}`;
          } else if (i < cog1Start) {
            location = `ASCII msg1`;
          } else if (i >= msg2Start) {
            location = `ASCII msg2`;
          }
          
          console.log(`EXTRACTION CORRUPTION at byte ${i} (${location}):`);
          console.log(`  Expected: 0x${totalBytes[i].toString(16).padStart(2, '0')}`);
          console.log(`  Got:      0x${extractedBytes[i].toString(16).padStart(2, '0')}`);
          
          // Show context
          const start = Math.max(0, i - 5);
          const end = Math.min(totalBytes.length, i + 5);
          console.log(`  Context Expected: ${Array.from(totalBytes.slice(start, end)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
          console.log(`  Context Got:      ${Array.from(extractedBytes.slice(start, end)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
        }
        expect(extractedBytes[i]).toBe(totalBytes[i]);
      }
      
      console.log('✅ PHASE II: Perfect back-to-back binary packet extraction');
    });
  });

  describe('Mixed Debug Message Types with Line Endings', () => {
    it('should handle mixed P2 debugger messages with preserved line endings', () => {
      // Create realistic P2 debugger messages with various line endings
      const messages = [
        // Init messages (typical startup)
        "Cog0 INIT\n",
        "Cog1 INIT\r\n", 
        "Cog2 INIT\r",
        "Cog3 INIT\n\r",
        
        // Debug tick messages (various lengths)
        "DEBUG_TICK 12345\n",
        "DEBUG_TICK 98765432\r\n",
        "TICK_COUNT: 0xFF123456\r",
        
        // Cog messages (different formats)
        "COG[0]: Starting execution at $1000\n",
        "COG[1]: Breakpoint hit at $2000\r\n",
        "COG[2]: Variable watch triggered - VAR1 = $DEADBEEF\n\r",
        "COG[3]: Memory access violation at address $F0000000\r",
        
        // Random length debug messages
        "DBG: A\n",
        "DEBUG: This is a medium length message with some data 0x12345678\r\n",
        "TRACE: Very long debug message containing lots of information about the current state of the P2 processor including register values, memory contents, and execution flow analysis that spans multiple lines when displayed\n",
        
        // Mixed binary-looking messages  
        "BIN_DATA: \x01\x02\x03\x0A\x0D\x04\x05\r\n",
        "HEX_DUMP: 0x40 0x2F 0x80 0xFF 0xAA 0x55\n\r",
        
        // Short messages
        "OK\n",
        "ERR\r\n",
        ">\r",
        
        // Long structured messages
        "REGISTER_DUMP: PA=$12345678 PB=$87654321 PTRA=$AAAAAAAA PTRB=$BBBBBBBB DIRA=$CCCCCCCC DIRB=$DDDDDDDD OUTA=$EEEEEEEE OUTB=$FFFFFFFF\n",
        "MEMORY_BLOCK: ADDR=$1000 SIZE=256 DATA=[0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0x0C,0x0D,0x0E,0x0F]\r\n",
        
        // Edge case messages
        "EMPTY_LINE_FOLLOWS:\n\n",
        "CRLF_DOUBLE:\r\n\r\n",
        "MIXED_EOL:\n\r\n",
        
        // More random lengths to cause multiple wraps
        "A".repeat(50) + "\n",
        "B".repeat(100) + "\r\n", 
        "C".repeat(200) + "\r",
        "D".repeat(75) + "\n\r",
        "E".repeat(150) + "\n",
        "F".repeat(300) + "\r\n",
        "G".repeat(25) + "\r",
        
        // Final messages
        "SYSTEM: Buffer wrap test complete\n",
        "FINAL: All messages processed\r\n"
      ];

      // Track expected data for verification
      const expectedMessages: string[] = [];
      const expectedBytes: number[] = [];
      
      // Convert messages to bytes and track expectations
      messages.forEach(msg => {
        expectedMessages.push(msg);
        const bytes = new TextEncoder().encode(msg);
        for (const byte of bytes) {
          expectedBytes.push(byte);
        }
      });

      console.log(`Total messages: ${messages.length}`);
      console.log(`Total bytes: ${expectedBytes.length}`);
      console.log(`Expected buffer wraps: ${Math.floor(expectedBytes.length / 1048576)}`);

      // Append all messages to buffer (should cause multiple wraps)
      let appendSuccesses = 0;
      messages.forEach((msg, index) => {
        const msgBytes = new TextEncoder().encode(msg);
        const success = buffer.appendAtTail(msgBytes);
        if (success) {
          appendSuccesses++;
        } else {
          console.log(`FAILED to append message ${index}: "${msg}" (${msgBytes.length} bytes)`);
        }
      });

      expect(appendSuccesses).toBe(messages.length);

      // Read all data back and verify exact match
      const actualBytes: number[] = [];
      let result: NextResult;
      
      while ((result = buffer.next()).status !== NextStatus.EMPTY) {
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          actualBytes.push(result.value);
        }
        // CircularBuffer only returns DATA or EMPTY - no EOL detection at this level
      }

      // Verify exact byte count
      expect(actualBytes.length).toBe(expectedBytes.length);
      
      // Verify exact byte-for-byte match
      for (let i = 0; i < expectedBytes.length; i++) {
        if (actualBytes[i] !== expectedBytes[i]) {
          console.log(`MISMATCH at byte ${i}: expected ${expectedBytes[i]} (0x${expectedBytes[i].toString(16)}) got ${actualBytes[i]} (0x${actualBytes[i].toString(16)})`);
          
          // Show context around the mismatch
          const start = Math.max(0, i - 10);
          const end = Math.min(expectedBytes.length, i + 10);
          console.log(`Expected context: ${expectedBytes.slice(start, end).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
          console.log(`Actual context:   ${actualBytes.slice(start, end).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
        }
        expect(actualBytes[i]).toBe(expectedBytes[i]);
      }

      // Reconstruct messages and verify line endings preserved
      const actualText = new TextDecoder().decode(new Uint8Array(actualBytes));
      const expectedText = messages.join('');
      
      expect(actualText).toBe(expectedText);
      
      console.log('SUCCESS: All messages preserved exactly with correct line endings');
    });

    it('should handle rapid append/consume cycles without data loss', () => {
      // Simulate high-speed debugging scenario
      const messageTemplates = [
        "TICK: ",
        "COG[0]: ",
        "COG[1]: ", 
        "COG[2]: ",
        "COG[3]: ",
        "DEBUG: ",
        "TRACE: ",
        "ERROR: "
      ];
      
      const eolPatterns = ["\n", "\r\n", "\r", "\n\r"];
      const totalCycles = 1000;
      const expectedData: number[] = [];
      
      for (let cycle = 0; cycle < totalCycles; cycle++) {
        // Create random message
        const template = messageTemplates[cycle % messageTemplates.length];
        const dataValue = cycle.toString(16).padStart(8, '0');
        const eol = eolPatterns[cycle % eolPatterns.length];
        const message = template + dataValue + eol;
        
        // Track expected bytes
        const messageBytes = new TextEncoder().encode(message);
        for (const byte of messageBytes) {
          expectedData.push(byte);
        }
        
        // Append to buffer
        expect(buffer.appendAtTail(messageBytes)).toBe(true);
        
        // Periodically consume some data to prevent overflow
        if (cycle % 10 === 0) {
          // Consume a portion
          const consumeCount = Math.min(50, buffer.getUsedSpace());
          if (consumeCount > 0) {
            // Verify consumed data matches expected
            for (let i = 0; i < consumeCount; i++) {
              const result = buffer.next();
              expect(result.status).toBe(NextStatus.DATA);
              expect(result.value).toBe(expectedData.shift());
            }
          }
        }
      }
      
      // Consume all remaining data
      while (expectedData.length > 0) {
        const result = buffer.next();
        expect(result.status).toBe(NextStatus.DATA);
        expect(result.value).toBe(expectedData.shift());
      }
      
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
    });

    it('should handle messages with embedded binary data and high-bit bytes', () => {
      // Test the specific $40/$2F corruption patterns reported by user
      const problematicMessages = [
        // Messages with high-bit bytes that were corrupting
        new Uint8Array([0x40, 0x2F, 0x40, 0x2F, 0x0A]),  // The specific corruption pattern + LF
        new Uint8Array([0x80, 0x81, 0x82, 0x83, 0x0D, 0x0A]),  // High bits + CRLF
        new Uint8Array([0xFF, 0xFE, 0xFD, 0xFC, 0x0D]),  // All high bits + CR
        new Uint8Array([0xC0, 0xAF, 0x90, 0x8F, 0x0A, 0x0D]),  // More high bits + LFCR
        
        // Mix with normal text
        new TextEncoder().encode("Normal text\n"),
        new Uint8Array([0xAA, 0x55, 0xAA, 0x55]),  // Binary without EOL
        new TextEncoder().encode("More normal text\r\n"),
        
        // P2 80-byte debugger packet simulation
        new Uint8Array(80).fill(0).map((_, i) => (i * 37) & 0xFF)  // Pseudo-random 80-byte packet
      ];
      
      // Track all expected bytes
      const expectedBytes: number[] = [];
      
      // Append all messages
      problematicMessages.forEach(msg => {
        expect(buffer.appendAtTail(msg)).toBe(true);
        for (const byte of msg) {
          expectedBytes.push(byte);
        }
      });
      
      // Read back all data
      const actualBytes: number[] = [];
      let result: NextResult;
      
      while ((result = buffer.next()).status !== NextStatus.EMPTY) {
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          actualBytes.push(result.value);
        }
        // Note: EOL detection should NOT interfere with binary data
      }
      
      // Verify exact match
      expect(actualBytes.length).toBe(expectedBytes.length);
      expect(actualBytes).toEqual(expectedBytes);
      
      console.log(`Successfully preserved ${expectedBytes.length} bytes including high-bit data`);
    });
  });
});