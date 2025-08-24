/** @format */

// tests/circularBufferRealisticMessages.test.ts
// TEST 3: Realistic P2 Debugger Messages with Line Ending Preservation

import { CircularBuffer, NextStatus, NextResult } from '../src/classes/shared/circularBuffer';

describe('CircularBuffer Real P2 Debugger Messages - Production Code Test', () => {
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer();
  });

  describe('Realistic P2 Message Patterns', () => {
    it('should handle realistic COG messages with mixed line endings', () => {
      // Realistic COG messages with varying lengths and line endings
      const cogMessages = [
        "COG0 INIT\n",
        "COG1 INIT\r\n", 
        "COG2 INIT\r",
        "COG3 INIT\n\r",
        
        // Varying length COG messages
        "COG0: Starting execution at $1000\n",
        "COG1: Breakpoint hit at address $2000\r\n",
        "COG2: Variable watch triggered - VAR1 = $DEADBEEF, VAR2 = $12345678\r",
        "COG3: Memory access violation at address $F0000000 - attempting to access restricted hub memory region during RDLONG operation\n\r",
        
        // Short COG messages
        "COG0: OK\n",
        "COG1: ERR\r\n",
        "COG2: RDY\r",
        "COG3: HALT\n\r",
        
        // Complex COG debug output
        "COG0: REGISTER_DUMP PA=$12345678 PB=$87654321 PTRA=$AAAAAAAA PTRB=$BBBBBBBB\n",
        "COG1: STACK_TRACE [0]=$1000 [1]=$2000 [2]=$3000 [3]=$4000 [4]=$5000\r\n",
        "COG2: HUB_MEMORY_BLOCK ADDR=$10000 SIZE=512 CHECKSUM=$ABCD1234\r",
        "COG3: SPIN2_BYTECODE_TRACE PC=$800 OP=CALL_SUB PARAM1=$100 PARAM2=$200 PARAM3=$300\n\r"
      ];

      // Track expected data for perfect round-trip verification
      const expectedBytes: number[] = [];
      
      console.log(`Testing ${cogMessages.length} COG messages`);
      
      // Convert messages to bytes and append
      cogMessages.forEach((msg, index) => {
        const msgBytes = new TextEncoder().encode(msg);
        
        // Track expected bytes
        for (const byte of msgBytes) {
          expectedBytes.push(byte);
        }
        
        // Append to buffer using production code
        const success = buffer.appendAtTail(msgBytes);
        expect(success).toBe(true);
        
        console.log(`COG message ${index}: "${msg.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}" (${msgBytes.length} bytes)`);
      });

      console.log(`Total COG message bytes: ${expectedBytes.length}`);
      
      // Read back using production next() method
      const actualBytes: number[] = [];
      let result: NextResult;
      
      while ((result = buffer.next()).status !== NextStatus.EMPTY) {
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          actualBytes.push(result.value);
        } else if (result.status === NextStatus.EOL) {
          // EOL detected - but we want to preserve the original bytes
          // This indicates a problem with binary data handling
          console.log(`EOL detected at byte position ${actualBytes.length}`);
        }
      }
      
      // Verify perfect round-trip
      console.log(`Round-trip verification: Expected ${expectedBytes.length}, got ${actualBytes.length}`);
      expect(actualBytes.length).toBe(expectedBytes.length);
      
      // Reconstruct and verify exact message preservation
      const reconstructedText = new TextDecoder().decode(new Uint8Array(actualBytes));
      const expectedText = cogMessages.join('');
      
      expect(reconstructedText).toBe(expectedText);
    });

    it('should handle realistic TICK messages with varying lengths', () => {
      const tickMessages = [
        "TICK: 0\n",
        "TICK: 12345\r\n",
        "TICK: 0xFFFFFFFF\r", 
        "TICK_COUNT: 0x12345678ABCDEF00\n\r",
        
        // Detailed tick messages
        "DEBUG_TICK_START: SYS_CLK=160000000 HZ=160MHz TIMESTAMP=0x123456789ABCDEF0\n",
        "DEBUG_TICK_EVENT: COG0_ACTIVE COG1_WAIT COG2_HALT COG3_DEBUG TICK_DELTA=1000\r\n",
        "DEBUG_TICK_PROFILE: TOTAL_CYCLES=999999 HUB_CYCLES=123456 COG_CYCLES=876543\r",
        "DEBUG_TICK_END: NEXT_BREAKPOINT=0x2000 WATCHDOG_COUNTER=0xDEADBEEF\n\r",
        
        // Performance tick data
        "PERF_TICK: CPU_UTIL=85% MEM_UTIL=60% HUB_BANDWIDTH=1.2GB/s\n",
        "PERF_COUNTERS: CACHE_HITS=9876543 CACHE_MISSES=123456 PIPELINE_STALLS=789\r\n"
      ];

      let totalExpected = 0;
      const allMessageBytes: number[] = [];
      
      tickMessages.forEach((msg, index) => {
        const msgBytes = new TextEncoder().encode(msg);
        expect(buffer.appendAtTail(msgBytes)).toBe(true);
        
        for (const byte of msgBytes) {
          allMessageBytes.push(byte);
        }
        totalExpected += msgBytes.length;
        
        console.log(`TICK message ${index}: ${msgBytes.length} bytes`);
      });

      // Read back all data
      const actualBytes: number[] = [];
      let result: NextResult;
      
      while ((result = buffer.next()).status !== NextStatus.EMPTY) {
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          actualBytes.push(result.value);
        }
      }
      
      expect(actualBytes.length).toBe(totalExpected);
      expect(actualBytes).toEqual(allMessageBytes);
    });

    it('should handle INIT form messages with exact line ending preservation', () => {
      const initMessages = [
        "Propeller 2 Debugger v1.0\n",
        "P2 System Init Complete\r\n",
        "Hub RAM: 512KB Available\r",
        "Cog RAM: 8 x 2KB = 16KB Total\n\r",
        
        // Detailed init sequences
        "SYSTEM_INIT: Clock Source=XTAL Frequency=20MHz PLL=8x Final=160MHz\n",
        "MEMORY_INIT: Hub_RAM_Test=PASS Cog_RAM_Test=PASS LUT_RAM_Test=PASS\r\n",
        "PIN_INIT: Smart_Pins=Configured GPIO=Available ADC=Ready DAC=Ready\r",
        "DEBUG_INIT: Serial_Port=2000000_8N1 USB_Connection=Active Debugger=Ready\n\r",
        
        // Boot messages
        "BOOT: Loading application from $1000\n",
        "BOOT: Entry point set to $1000\r\n",
        "BOOT: Stack pointer initialized to $7FFFF\r",
        "BOOT: Debug symbols loaded\n\r",
        
        // Status messages  
        "STATUS: All systems operational\n",
        "STATUS: Ready for debug commands\r\n"
      ];

      const expectedData: number[] = [];
      
      initMessages.forEach((msg, index) => {
        const msgBytes = new TextEncoder().encode(msg);
        expect(buffer.appendAtTail(msgBytes)).toBe(true);
        
        for (const byte of msgBytes) {
          expectedData.push(byte);
        }
        
        console.log(`INIT message ${index}: Line ending = ${
          msg.endsWith('\n\r') ? '\\n\\r' :
          msg.endsWith('\r\n') ? '\\r\\n' :
          msg.endsWith('\n') ? '\\n' :
          msg.endsWith('\r') ? '\\r' : 'none'
        }`);
      });

      // Perfect round-trip test
      const actualData: number[] = [];
      let result: NextResult;
      
      while ((result = buffer.next()).status !== NextStatus.EMPTY) {
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          actualData.push(result.value);
        }
      }
      
      expect(actualData).toEqual(expectedData);
      
      // Verify reconstructed text matches exactly
      const reconstructed = new TextDecoder().decode(new Uint8Array(actualData));
      const expected = initMessages.join('');
      expect(reconstructed).toBe(expected);
    });

    it('should handle 2+ buffer volumes of mixed realistic traffic', () => {
      // Generate 2+ buffer volumes (32KB+ of realistic P2 debug data)
      const bufferSize = buffer.getBufferSize();
      const targetVolume = bufferSize * 2.5; // 2.5x buffer volume
      
      console.log(`Generating ${targetVolume} bytes of realistic P2 debug traffic`);
      
      const messageTemplates = [
        // COG templates
        (i: number) => `COG${i % 4}: Debug event ${i} at address $${(i * 1000).toString(16).padStart(4, '0').toUpperCase()}\n`,
        (i: number) => `COG${i % 4}: Breakpoint ${i} hit - Register dump follows\r\n`,
        (i: number) => `COG${i % 4}: Variable trace VAR${i}=$${i.toString(16).padStart(8, '0').toUpperCase()}\r`,
        (i: number) => `COG${i % 4}: Memory watch triggered at hub address $${(i * 16).toString(16).padStart(5, '0').toUpperCase()}\n\r`,
        
        // TICK templates
        (i: number) => `TICK: ${i}\n`,
        (i: number) => `DEBUG_TICK: CYCLE=${i} TIME=${i * 6.25}ns\r\n`,
        (i: number) => `PERF_TICK: CPU=${((i * 7) % 100)}% MEM=${((i * 11) % 100)}%\r`,
        
        // INIT templates  
        (i: number) => `INIT_STEP_${i}: Component initialization ${i % 10 === 0 ? 'complete' : 'in progress'}\n\r`,
      ];
      
      const eolPatterns = ['\n', '\r\n', '\r', '\n\r'];
      let totalGenerated = 0;
      let messageCount = 0;
      const allExpectedBytes: number[] = [];
      
      // Generate messages until we exceed target volume
      while (totalGenerated < targetVolume) {
        const template = messageTemplates[messageCount % messageTemplates.length];
        const message = template(messageCount);
        
        const msgBytes = new TextEncoder().encode(message);
        const success = buffer.appendAtTail(msgBytes);
        
        if (!success) {
          console.log(`Buffer full after ${totalGenerated} bytes, ${messageCount} messages`);
          break;
        }
        
        for (const byte of msgBytes) {
          allExpectedBytes.push(byte);
        }
        
        totalGenerated += msgBytes.length;
        messageCount++;
        
        // Periodically consume data to simulate realistic usage
        if (messageCount % 50 === 0) {
          // Consume some data to prevent buffer overflow
          const consumeCount = Math.min(200, buffer.getUsedSpace());
          for (let c = 0; c < consumeCount; c++) {
            const result = buffer.next();
            if (result.status === NextStatus.DATA && result.value !== undefined) {
              const expectedByte = allExpectedBytes.shift();
              expect(result.value).toBe(expectedByte);
            }
          }
        }
      }
      
      console.log(`Generated ${messageCount} messages, ${totalGenerated} bytes`);
      
      // Consume all remaining data
      while (allExpectedBytes.length > 0) {
        const result = buffer.next();
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          const expectedByte = allExpectedBytes.shift();
          expect(result.value).toBe(expectedByte);
        } else if (result.status === NextStatus.EMPTY) {
          break;
        }
      }
      
      // Should have consumed all expected data
      expect(allExpectedBytes.length).toBe(0);
      expect(buffer.next().status).toBe(NextStatus.EMPTY);
      
      console.log(`Perfect round-trip verified for ${messageCount} realistic P2 messages`);
    });

    it('should preserve binary data in P2 debugger packets without EOL corruption', () => {
      // Simulate P2 80-byte binary debugger packets mixed with text
      const binaryPackets = [
        // Packet with embedded line ending bytes
        new Uint8Array([
          0xAA, 0xBB, 0x00, 0x50, // Header: 80-byte packet
          0x01, 0x02, 0x03, 0x0A, 0x05, 0x06, 0x07, 0x0D, // Data with embedded LF/CR
          0x40, 0x2F, 0x40, 0x2F, // The specific corruption pattern user reported
          0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, // High-bit data
          // Fill rest of 80-byte packet
          ...Array.from({length: 80 - 20}, (_, i) => (i * 17) & 0xFF)
        ]),
        
        // Text message
        new TextEncoder().encode("COG0: Binary packet processed\n"),
        
        // Another binary packet
        new Uint8Array([
          0xCC, 0xDD, 0x00, 0x50, // Header
          0xFF, 0xFE, 0xFD, 0x0A, 0x0D, 0x0A, 0xF8, 0xF7, // More embedded EOL bytes
          ...Array.from({length: 80 - 12}, (_, i) => (i * 23) & 0xFF)
        ]),
        
        // Text message with line ending
        new TextEncoder().encode("COG1: Second binary packet processed\r\n"),
      ];
      
      const allExpectedBytes: number[] = [];
      
      // Append all packets
      binaryPackets.forEach((packet, index) => {
        expect(buffer.appendAtTail(packet)).toBe(true);
        for (const byte of packet) {
          allExpectedBytes.push(byte);
        }
        console.log(`Packet ${index}: ${packet.length} bytes (${packet.constructor.name})`);
      });
      
      // Read back all data - should be identical
      const actualBytes: number[] = [];
      let result: NextResult;
      
      while ((result = buffer.next()).status !== NextStatus.EMPTY) {
        if (result.status === NextStatus.DATA && result.value !== undefined) {
          actualBytes.push(result.value);
        }
      }
      
      // Perfect binary preservation test
      expect(actualBytes.length).toBe(allExpectedBytes.length);
      
      for (let i = 0; i < allExpectedBytes.length; i++) {
        if (actualBytes[i] !== allExpectedBytes[i]) {
          console.log(`CORRUPTION at byte ${i}: expected 0x${allExpectedBytes[i].toString(16).padStart(2, '0')} got 0x${actualBytes[i].toString(16).padStart(2, '0')}`);
        }
        expect(actualBytes[i]).toBe(allExpectedBytes[i]);
      }
      
      console.log(`Successfully preserved ${allExpectedBytes.length} bytes including binary data with embedded EOL bytes`);
    });
  });
});