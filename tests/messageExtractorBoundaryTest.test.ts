/** @format */

// tests/messageExtractorBoundaryTest.test.ts
// TEST: Message boundary detection with mixed ASCII + 80-byte COG packets

import { MessageExtractor } from '../src/classes/shared/messageExtractor';
import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('MessageExtractor - Boundary Detection Test', () => {
  let buffer: CircularBuffer;
  let outputQueue: DynamicQueue<any>;
  let extractor: MessageExtractor;

  beforeEach(() => {
    buffer = new CircularBuffer();
    outputQueue = new DynamicQueue<any>();
    extractor = new MessageExtractor(buffer, outputQueue);
  });

  // Same perfect 80-byte COG packets from Phase I
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

  describe('FOUNDATION TEST: Perfect Message Boundary Detection', () => {
    it('should extract complete messages with perfect boundaries - Phase I Stream', () => {
      // Create the same stream that CircularBuffer handled perfectly
      const streamData = [];
      
      // ASCII message 1
      const msg1 = "Cog0 INIT $0000_0000 $0000_0000 load\r\n";
      streamData.push(...new TextEncoder().encode(msg1));
      
      // COG1 80-byte packet (no EOL)
      streamData.push(...COG1_80_BYTES);
      
      // ASCII message 2  
      const msg2 = "Cog1 INIT $0000_0F5C $0000_1834 jump\r\n";
      streamData.push(...new TextEncoder().encode(msg2));
      
      // COG2 80-byte packet (no EOL)
      streamData.push(...COG2_80_BYTES);
      
      // ASCII message 3
      const msg3 = "System initialization complete\r\n";
      streamData.push(...new TextEncoder().encode(msg3));
      
      const totalBytes = new Uint8Array(streamData);
      
      console.log('=== MESSAGEEXTRACTOR BOUNDARY DETECTION TEST ===');
      console.log(`Total stream: ${totalBytes.length} bytes`);
      console.log(`Expected messages:`);
      console.log(`  1. ASCII: "${msg1.trim()}" (${msg1.length} bytes)`);
      console.log(`  2. COG1: 80-byte packet starting with 0x01`);
      console.log(`  3. ASCII: "${msg2.trim()}" (${msg2.length} bytes)`);
      console.log(`  4. COG2: 80-byte packet starting with 0x02`);
      console.log(`  5. ASCII: "${msg3.trim()}" (${msg3.length} bytes)`);
      
      // Add stream to buffer (we know this works from Phase I)
      expect(buffer.appendAtTail(totalBytes)).toBe(true);
      
      // Now test MessageExtractor boundary detection
      const extractedMessages: any[] = [];
      let extractionCycles = 0;
      const MAX_CYCLES = 20; // Prevent infinite loops
      
      while (extractionCycles < MAX_CYCLES) {
        const hasMore = extractor.extractMessages();
        extractionCycles++;
        
        // Collect all extracted messages
        while (outputQueue.getSize() > 0) {
          extractedMessages.push(outputQueue.dequeue());
        }
        
        if (!hasMore) break;
      }
      
      console.log(`\\nEXTRACTION RESULTS after ${extractionCycles} cycles:`);
      console.log(`Total messages extracted: ${extractedMessages.length}`);
      
      // DEBUG: Check specific messages for exact content
      if (extractedMessages.length >= 3) {
        const msg3 = extractedMessages[2]; // "Cog1 INIT..." message
        console.log(`\\nDEBUG: Message 3 actual length: ${msg3.data ? msg3.data.length : 'null'} bytes`);
        if (msg3.data && msg3.data.length > 0) {
          const first20 = Array.from(msg3.data.slice(0, 20)).map((b: number) => '0x' + b.toString(16).padStart(2, '0')).join(' ');
          console.log(`DEBUG: Message 3 first 20 bytes: [${first20}]`);
          
          if (msg3.data.length === 38) {
            const expectedMsg2 = new TextEncoder().encode("Cog1 INIT $0000_0F5C $0000_1834 jump\\r\\n");
            const matches = Array.from(msg3.data).every((byte, i) => byte === expectedMsg2[i]);
            console.log(`DEBUG: Message 3 exact match: ${matches}`);
          } else {
            console.log(`DEBUG: Message 3 length WRONG - expected 38, got ${msg3.data.length}`);
          }
        }
      }
      
      // Analyze what we got vs what we expected
      extractedMessages.forEach((msg, index) => {
        const dataLength = msg.data ? msg.data.length : 0;
        const dataPreview = msg.data ? 
          (msg.data.length > 20 ? 
            Array.from(msg.data.slice(0, 10)).map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ') + '...' :
            Array.from(msg.data).map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
          ) : 'none';
        
        console.log(`  ${index + 1}. Type: ${msg.type}, Confidence: ${msg.confidence}`);
        console.log(`     Length: ${dataLength} bytes`);
        console.log(`     Data: ${dataPreview}`);
        
        // If it's ASCII, try to decode it
        if (msg.data && msg.data.length < 100) {
          try {
            const text = new TextDecoder().decode(new Uint8Array(msg.data));
            const isAscii = /^[\x20-\x7E\r\n]+$/.test(text);
            // Show byte values for failed ASCII 
            const byteValues = Array.from(msg.data).map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
            console.log(`     ASCII: "${text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}" (isAscii: ${isAscii})`);
            if (!isAscii) {
              console.log(`     Bytes: ${byteValues}`);
              // Find non-ASCII characters
              for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                if (!((code >= 0x20 && code <= 0x7E) || code === 0x0D || code === 0x0A)) {
                  console.log(`     Non-ASCII at pos ${i}: 0x${code.toString(16)} ('${text[i]}')`);
                }
              }
            }
          } catch (e) {
            console.log(`     ASCII decode failed: ${e.message}`);
          }
        }
      });
      
      // CRITICAL TESTS: What we expect vs what we got
      
      console.log('\\n=== BOUNDARY DETECTION ANALYSIS ===');
      
      // Test 1: Should extract exactly 5 messages
      if (extractedMessages.length !== 5) {
        console.log(`❌ EXPECTED 5 messages, got ${extractedMessages.length}`);
        console.log('   This indicates MESSAGE FRAGMENTATION - boundary detection failed');
      } else {
        console.log('✅ Extracted exactly 5 messages');
      }
      
      // Test 2: Check for 80-byte COG packets
      const eightyByteMessages = extractedMessages.filter(msg => 
        msg.data && msg.data.length === 80 && (msg.data[0] === 0x01 || msg.data[0] === 0x02)
      );
      
      if (eightyByteMessages.length !== 2) {
        console.log(`❌ EXPECTED 2 COG packets (80 bytes each), found ${eightyByteMessages.length}`);
        console.log('   This indicates 80-BYTE BOUNDARY DETECTION FAILURE');
      } else {
        console.log('✅ Found exactly 2 COG packets (80 bytes each)');
      }
      
      // Test 3: Check ASCII message integrity
      const asciiMessages = extractedMessages.filter(msg => {
        if (!msg.data) return false;
        try {
          const text = new TextDecoder().decode(new Uint8Array(msg.data));
          const isAscii = /^[\x20-\x7E\r\n]+$/.test(text);
          const isRelevantContent = text.includes('INIT') || text.includes('System');
          return isAscii && isRelevantContent;
        } catch {
          return false;
        }
      });
      
      if (asciiMessages.length !== 3) {
        console.log(`❌ EXPECTED 3 ASCII messages, found ${asciiMessages.length}`);
        console.log('   This indicates ASCII EOL BOUNDARY DETECTION FAILURE');
      } else {
        console.log('✅ Found exactly 3 ASCII messages');
      }
      
      // Test 4: Check for fragmentation symptoms
      const fragmentedMessages = extractedMessages.filter(msg => 
        msg.data && (
          msg.data.length < 10 ||  // Suspiciously short
          (msg.data[0] === 0x0A || msg.data[0] === 0x0D) || // Starts with EOL
          msg.type === 'TERMINAL_OUTPUT' && msg.confidence === 'DEFAULT'  // Fallback classification
        )
      );
      
      if (fragmentedMessages.length > 0) {
        console.log(`❌ FOUND ${fragmentedMessages.length} FRAGMENTED MESSAGES`);
        console.log('   This confirms BOUNDARY DETECTION IS BROKEN');
        fragmentedMessages.forEach((msg, idx) => {
          console.log(`   Fragment ${idx + 1}: ${msg.data.length} bytes, starts with 0x${msg.data[0].toString(16)}`);
        });
      } else {
        console.log('✅ No obvious message fragmentation detected');
      }
      
      console.log('\\n=== FINAL DIAGNOSIS ===');
      
      // The actual test expectations - will likely fail
      expect(extractedMessages.length).toBe(5); // Should extract 5 complete messages
      expect(eightyByteMessages.length).toBe(2); // Should find 2 COG packets
      expect(asciiMessages.length).toBe(3); // Should find 3 ASCII messages
      
      console.log('✅ If you see this: MessageExtractor boundary detection is WORKING!');
    });
  });

  describe('PHASE II: Back-to-Back COG 80-Byte Packets', () => {
    it('should extract consecutive COG packets without ASCII separators', () => {
      // PHASE II: Back-to-back binary packets - the hardest boundary detection case
      const streamData = [];
      
      // ASCII message 1
      const msg1 = "Multi-COG debugger output follows:\r\n";
      streamData.push(...new TextEncoder().encode(msg1));
      
      // COG1 80-byte packet immediately followed by COG2 80-byte packet (no separator!)
      streamData.push(...COG1_80_BYTES);
      streamData.push(...COG2_80_BYTES);
      
      // ASCII message 2
      const msg2 = "Both COG packets processed\r\n";
      streamData.push(...new TextEncoder().encode(msg2));
      
      const totalBytes = new Uint8Array(streamData);
      
      console.log('=== PHASE II: BACK-TO-BACK COG PACKETS TEST ===');
      console.log(`Total stream: ${totalBytes.length} bytes`);
      console.log(`Expected messages:`);
      console.log(`  1. ASCII: "${msg1.trim()}" (${msg1.length} bytes)`);
      console.log(`  2. COG1: 80-byte packet starting with 0x01`);
      console.log(`  3. COG2: 80-byte packet starting with 0x02 (immediately after COG1)`);
      console.log(`  4. ASCII: "${msg2.trim()}" (${msg2.length} bytes)`);
      
      // Add stream to buffer
      expect(buffer.appendAtTail(totalBytes)).toBe(true);
      
      // Test MessageExtractor consecutive binary packet detection
      const extractedMessages: any[] = [];
      let extractionCycles = 0;
      const MAX_CYCLES = 20;
      
      while (extractionCycles < MAX_CYCLES) {
        const hasMore = extractor.extractMessages();
        extractionCycles++;
        
        // Collect all extracted messages
        while (outputQueue.getSize() > 0) {
          extractedMessages.push(outputQueue.dequeue());
        }
        
        if (!hasMore) break;
      }
      
      console.log(`\\\\nEXTRACTION RESULTS after ${extractionCycles} cycles:`);
      console.log(`Total messages extracted: ${extractedMessages.length}`);
      
      // Analyze consecutive binary packet extraction
      extractedMessages.forEach((msg, index) => {
        const dataLength = msg.data ? msg.data.length : 0;
        const dataPreview = msg.data ? 
          (msg.data.length > 10 ? 
            Array.from(msg.data.slice(0, 10)).map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ') + '...' :
            Array.from(msg.data).map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
          ) : 'none';
        
        console.log(`  ${index + 1}. Type: ${msg.type}, Confidence: ${msg.confidence}`);
        console.log(`     Length: ${dataLength} bytes`);
        console.log(`     Data: ${dataPreview}`);
        
        // Check for ASCII content
        if (msg.data && msg.data.length < 100) {
          try {
            const text = new TextDecoder().decode(new Uint8Array(msg.data));
            const isAscii = /^[\\x20-\\x7E\\r\\n]+$/.test(text);
            if (isAscii) {
              console.log(`     ASCII: "${text.replace(/\\r/g, '\\\\\\\\r').replace(/\\n/g, '\\\\\\\\n')}"`);
            }
          } catch (e) {
            // Binary data - not ASCII
          }
        }
      });
      
      // PHASE II CRITICAL TESTS
      console.log('\\\\n=== PHASE II BOUNDARY DETECTION ANALYSIS ===');
      
      // Test 1: Should extract exactly 4 messages
      if (extractedMessages.length !== 4) {
        console.log(`❌ EXPECTED 4 messages, got ${extractedMessages.length}`);
        console.log('   This indicates CONSECUTIVE BINARY PACKET fragmentation');
      } else {
        console.log('✅ Extracted exactly 4 messages');
      }
      
      // Test 2: Check for exactly 2 consecutive COG packets
      const consecutiveCogMessages = extractedMessages.filter(msg => 
        msg.data && msg.data.length === 80 && msg.type === 'DEBUGGER_80BYTE'
      );
      
      if (consecutiveCogMessages.length !== 2) {
        console.log(`❌ EXPECTED 2 consecutive COG packets, found ${consecutiveCogMessages.length}`);
        console.log('   This indicates CONSECUTIVE 80-BYTE BOUNDARY DETECTION FAILURE');
      } else {
        console.log('✅ Found exactly 2 consecutive COG packets (80 bytes each)');
        // Verify they are COG1 (0x01) and COG2 (0x02)
        if (consecutiveCogMessages[0].data[0] === 0x01 && consecutiveCogMessages[1].data[0] === 0x02) {
          console.log('✅ COG packets in correct sequence: COG1 (0x01) → COG2 (0x02)');
        } else {
          console.log(`❌ COG packet sequence wrong: got 0x${consecutiveCogMessages[0].data[0].toString(16)} → 0x${consecutiveCogMessages[1].data[0].toString(16)}`);
        }
      }
      
      // Test 3: Check ASCII message integrity
      const asciiMessages = extractedMessages.filter(msg => {
        if (!msg.data) return false;
        try {
          const text = new TextDecoder().decode(new Uint8Array(msg.data));
          const isAscii = /^[\x20-\x7E\r\n]+$/.test(text);
          const isRelevantContent = text.includes('Multi-COG') || text.includes('processed');
          return isAscii && isRelevantContent;
        } catch {
          return false;
        }
      });
      
      if (asciiMessages.length !== 2) {
        console.log(`❌ EXPECTED 2 ASCII messages, found ${asciiMessages.length}`);
      } else {
        console.log('✅ Found exactly 2 ASCII messages');
      }
      
      console.log('\\\\n=== PHASE II FINAL DIAGNOSIS ===');
      
      // The actual test expectations
      expect(extractedMessages.length).toBe(4); // Should extract 4 messages total
      expect(consecutiveCogMessages.length).toBe(2); // Should find 2 consecutive COG packets
      expect(asciiMessages.length).toBe(2); // Should find 2 ASCII messages
      expect(consecutiveCogMessages[0].data[0]).toBe(0x01); // First COG packet should be COG1
      expect(consecutiveCogMessages[1].data[0]).toBe(0x02); // Second COG packet should be COG2
      
      console.log('✅ If you see this: PHASE II consecutive binary packet detection is WORKING!');
    });
  });
});