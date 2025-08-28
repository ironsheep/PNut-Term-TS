/** @format */

import { MessageExtractor } from '../src/classes/shared/messageExtractor';
import { CircularBuffer, NextResult, NextStatus } from '../src/classes/shared/circularBuffer';

describe('EOL Detection Edge Cases', () => {
  let extractor: MessageExtractor;
  let buffer: CircularBuffer;

  beforeEach(() => {
    buffer = new CircularBuffer(1024);
    extractor = new MessageExtractor(buffer);
  });

  describe('All 4 EOL Forms', () => {
    test('should recognize CR as single line ending', () => {
      const data = Buffer.from('Line1\rLine2\r');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(2);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('Line2'));
    });

    test('should recognize LF as single line ending', () => {
      const data = Buffer.from('Line1\nLine2\n');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(2);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('Line2'));
    });

    test('should recognize CR-LF as single line ending', () => {
      const data = Buffer.from('Line1\r\nLine2\r\n');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(2);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('Line2'));
    });

    test('should recognize LF-CR as single line ending', () => {
      const data = Buffer.from('Line1\n\rLine2\n\r');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(2);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('Line2'));
    });
  });

  describe('Adjacent Different EOLs (Critical Cases)', () => {
    test('CR followed by LF should be TWO lines, not CR-LF', () => {
      // This tests that we don't confuse CR + LF as CR-LF when they're separate
      const data = Buffer.from('Line1\rLine2\nLine3');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(2); // Line3 not terminated yet
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('Line2'));
    });

    test('LF followed by CR should be TWO lines, not LF-CR', () => {
      // This tests that we don't confuse LF + CR as LF-CR when they're separate
      const data = Buffer.from('Line1\nLine2\rLine3');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(2); // Line3 not terminated yet
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('Line2'));
    });

    test('CR-LF followed by LF-CR should be TWO lines', () => {
      const data = Buffer.from('Line1\r\nLine2\n\r');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(2);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('Line2'));
    });

    test('Multiple CRs should be multiple empty lines', () => {
      const data = Buffer.from('Line1\r\r\rLine2\r');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(4);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('')); // Empty line
      expect(messages[2].content).toEqual(Buffer.from('')); // Empty line
      expect(messages[3].content).toEqual(Buffer.from('Line2'));
    });

    test('Multiple LFs should be multiple empty lines', () => {
      const data = Buffer.from('Line1\n\n\nLine2\n');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(4);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('')); // Empty line
      expect(messages[2].content).toEqual(Buffer.from('')); // Empty line
      expect(messages[3].content).toEqual(Buffer.from('Line2'));
    });
  });

  describe('Complex Mixed Patterns', () => {
    test('should handle CR+CR+LF+LF+CR-LF+LF-CR+CR+LF-CR+LF correctly', () => {
      // This is: CR, CR, LF, LF, CR-LF, LF-CR, CR, LF-CR, LF
      // Expected lines: empty, empty, empty, empty, empty, empty, empty, empty, empty (9 lines)
      const data = Buffer.from('\r\r\n\n\r\n\n\r\r\n\r\n');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(9);
      messages.forEach(msg => {
        expect(msg.content).toEqual(Buffer.from(''));
      });
    });

    test('should handle text with mixed EOL patterns', () => {
      // Mix all 4 EOL types with actual text
      const data = Buffer.from('A\rB\nC\r\nD\n\rE\r\rF\n\nG');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(7); // G not terminated
      expect(messages[0].content).toEqual(Buffer.from('A'));
      expect(messages[1].content).toEqual(Buffer.from('B'));
      expect(messages[2].content).toEqual(Buffer.from('C'));
      expect(messages[3].content).toEqual(Buffer.from('D'));
      expect(messages[4].content).toEqual(Buffer.from('E'));
      expect(messages[5].content).toEqual(Buffer.from('')); // Empty between E and F
      expect(messages[6].content).toEqual(Buffer.from('F'));
      // Note: There's an empty line between F and G (from \n\n) but G isn't terminated
    });

    test('should handle randomized EOL placement', () => {
      // Create a pattern that could confuse the parser
      const patterns = ['\r', '\n', '\r\n', '\n\r'];
      let testData = 'START';
      
      // Add 20 random EOLs with text between some
      for (let i = 0; i < 20; i++) {
        const eol = patterns[Math.floor(Math.random() * patterns.length)];
        testData += eol;
        if (i % 3 === 0) {
          testData += `TEXT${i}`;
        }
      }
      
      const data = Buffer.from(testData);
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      
      // Verify we got some messages (exact count depends on random pattern)
      expect(messages.length).toBeGreaterThan(0);
      
      // First message should be 'START'
      expect(messages[0].content).toEqual(Buffer.from('START'));
      
      // All messages should be valid (no corruption)
      messages.forEach(msg => {
        expect(msg.content).toBeDefined();
        expect(msg.content instanceof Buffer || msg.content instanceof Uint8Array).toBe(true);
      });
    });
  });

  describe('45-byte Scan Limit', () => {
    test('should find EOL within 45-byte limit', () => {
      // Create a 40-byte line followed by CR
      const longLine = 'A'.repeat(40);
      const data = Buffer.from(longLine + '\r' + 'Next');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].content).toEqual(Buffer.from(longLine));
    });

    test('should handle case where EOL is exactly at 45-byte limit', () => {
      // Create a 45-byte line with EOL at position 45
      const longLine = 'B'.repeat(44); // 44 chars + 1 EOL = 45
      const data = Buffer.from(longLine + '\n' + 'Next');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].content).toEqual(Buffer.from(longLine));
    });

    test('should not confuse binary data beyond 45-byte limit', () => {
      // This simulates the case where we have ASCII text followed by binary COG packet
      // The binary might contain 0x0A or 0x0D that aren't EOL
      const asciiText = 'C'.repeat(30);
      const binaryData = Buffer.from([
        0x0A, 0x0D, // These look like EOL but are at position 31-32
        0xFF, 0xFE, 0xF0, // Start of binary packet
        0x01, 0x00, 0x00, 0x00
      ]);
      
      // Add real EOL after binary
      const data = Buffer.concat([
        Buffer.from(asciiText),
        binaryData,
        Buffer.from('\r\n')
      ]);
      
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      
      // Should extract the whole thing as one message (EOL at end)
      expect(messages.length).toBe(1);
      expect(messages[0].content.length).toBe(asciiText.length + binaryData.length);
    });
  });

  describe('Performance: Worst Case Stream of LFs', () => {
    test('should handle continuous stream of LFs efficiently', () => {
      // This is the worst case at 2Mbps mentioned by user
      const lfCount = 1000;
      const data = Buffer.from('\n'.repeat(lfCount));
      buffer.write(data);
      
      const startTime = Date.now();
      const messages = extractor.extractMessages();
      const elapsed = Date.now() - startTime;
      
      expect(messages.length).toBe(lfCount);
      messages.forEach(msg => {
        expect(msg.content).toEqual(Buffer.from(''));
      });
      
      // Performance check: should process 1000 LFs in < 10ms
      expect(elapsed).toBeLessThan(10);
    });

    test('should handle 2Mbps equivalent data rate', () => {
      // 2Mbps = 250,000 bytes/sec = 250 bytes/ms
      // Test with 2500 bytes (10ms worth at 2Mbps)
      const data = Buffer.from('\n'.repeat(2500));
      buffer.write(data);
      
      const startTime = Date.now();
      const messages = extractor.extractMessages();
      const elapsed = Date.now() - startTime;
      
      expect(messages.length).toBe(2500);
      
      // Should process in reasonable time (< 50ms for 2500 messages)
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('Edge Cases That Could Break Sync', () => {
    test('should not lose sync with CR-LF-CR-LF pattern', () => {
      // This could be interpreted wrong if not careful
      const data = Buffer.from('Line1\r\n\r\nLine2\r\n');
      buffer.write(data);
      
      const messages = extractor.extractMessages();
      expect(messages.length).toBe(3);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      expect(messages[1].content).toEqual(Buffer.from('')); // Empty line
      expect(messages[2].content).toEqual(Buffer.from('Line2'));
    });

    test('should handle partial EOL sequences across buffer boundaries', () => {
      // Simulate receiving CR and LF in separate chunks
      buffer.write(Buffer.from('Line1\r'));
      let messages = extractor.extractMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].content).toEqual(Buffer.from('Line1'));
      
      // Now send LF - should be a new line, not part of CR-LF
      buffer.write(Buffer.from('\nLine2\r'));
      messages = extractor.extractMessages();
      expect(messages.length).toBe(2); // Empty line from LF, then Line2
      expect(messages[0].content).toEqual(Buffer.from(''));
      expect(messages[1].content).toEqual(Buffer.from('Line2'));
    });

    test('should handle interleaved binary and ASCII with various EOLs', () => {
      // Mix binary sync patterns with ASCII messages
      const syncPattern = Buffer.from([0xFE, 0xFF, 0xF0]);
      const asciiMsg = Buffer.from('Cog0 Message');
      const data = Buffer.concat([
        asciiMsg,
        Buffer.from('\r\n'), // CR-LF
        syncPattern,
        Buffer.from([0x0A]), // This is binary, not EOL!
        Buffer.from('Next\r'), // CR only
        Buffer.from('Line\n\r'), // LF-CR
      ]);
      
      buffer.write(data);
      const messages = extractor.extractMessages();
      
      // Should extract based on actual message structure
      expect(messages.length).toBeGreaterThan(0);
      
      // First message should be the ASCII
      expect(messages[0].content.slice(0, asciiMsg.length)).toEqual(asciiMsg);
    });
  });
});