/** @format */

import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('EOL Detection - All 4 Forms', () => {
  let buffer: CircularBuffer;
  let outputQueue: DynamicQueue<ExtractedMessage>;
  let extractor: MessageExtractor;

  beforeEach(() => {
    buffer = new CircularBuffer(1024);
    outputQueue = new DynamicQueue<ExtractedMessage>();
    extractor = new MessageExtractor(buffer, outputQueue);
  });

  describe('Single EOL Forms', () => {
    test('should recognize CR as line ending', () => {
      const data = Buffer.from('Line1\rLine2\r');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(2);
      const msg1 = outputQueue.dequeue()!;
      const msg2 = outputQueue.dequeue()!;
      expect(Buffer.from(msg1.data).toString()).toBe('Line1');
      expect(Buffer.from(msg2.data).toString()).toBe('Line2');
    });

    test('should recognize LF as line ending', () => {
      const data = Buffer.from('Line1\nLine2\n');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(2);
      const msg1 = outputQueue.dequeue()!;
      const msg2 = outputQueue.dequeue()!;
      expect(Buffer.from(msg1.data).toString()).toBe('Line1');
      expect(Buffer.from(msg2.data).toString()).toBe('Line2');
    });

    test('should recognize CR-LF as single line ending', () => {
      const data = Buffer.from('Line1\r\nLine2\r\n');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(2);
      const msg1 = outputQueue.dequeue()!;
      const msg2 = outputQueue.dequeue()!;
      expect(Buffer.from(msg1.data).toString()).toBe('Line1');
      expect(Buffer.from(msg2.data).toString()).toBe('Line2');
    });

    test('should recognize LF-CR as single line ending', () => {
      const data = Buffer.from('Line1\n\rLine2\n\r');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(2);
      const msg1 = outputQueue.dequeue()!;
      const msg2 = outputQueue.dequeue()!;
      expect(Buffer.from(msg1.data).toString()).toBe('Line1');
      expect(Buffer.from(msg2.data).toString()).toBe('Line2');
    });
  });

  describe('Critical Edge Cases', () => {
    test('CR followed by separate LF should be TWO lines, not CR-LF', () => {
      const data = Buffer.from('Line1\rLine2\nLine3');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      // Should extract 2 complete lines (Line3 not terminated)
      expect(outputQueue.getSize()).toBe(2);
      const msg1 = outputQueue.dequeue()!;
      const msg2 = outputQueue.dequeue()!;
      expect(Buffer.from(msg1.data).toString()).toBe('Line1');
      expect(Buffer.from(msg2.data).toString()).toBe('Line2');
    });

    test('LF followed by separate CR should be TWO lines, not LF-CR', () => {
      const data = Buffer.from('Line1\nLine2\rLine3');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(2);
      const msg1 = outputQueue.dequeue()!;
      const msg2 = outputQueue.dequeue()!;
      expect(Buffer.from(msg1.data).toString()).toBe('Line1');
      expect(Buffer.from(msg2.data).toString()).toBe('Line2');
    });

    test('Multiple CRs should be multiple empty lines', () => {
      const data = Buffer.from('Line1\r\r\rLine2\r');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(4);
      const msg1 = outputQueue.dequeue()!;
      const msg2 = outputQueue.dequeue()!;
      const msg3 = outputQueue.dequeue()!;
      const msg4 = outputQueue.dequeue()!;
      expect(Buffer.from(msg1.data).toString()).toBe('Line1');
      expect(Buffer.from(msg2.data).toString()).toBe(''); // Empty
      expect(Buffer.from(msg3.data).toString()).toBe(''); // Empty
      expect(Buffer.from(msg4.data).toString()).toBe('Line2');
    });

    test('Multiple LFs should be multiple empty lines', () => {
      const data = Buffer.from('Line1\n\n\nLine2\n');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(4);
      const messages = [];
      while (outputQueue.getSize() > 0) {
        messages.push(outputQueue.dequeue()!);
      }
      expect(Buffer.from(messages[0].data).toString()).toBe('Line1');
      expect(Buffer.from(messages[1].data).toString()).toBe('');
      expect(Buffer.from(messages[2].data).toString()).toBe('');
      expect(Buffer.from(messages[3].data).toString()).toBe('Line2');
    });
  });

  describe('Complex Mixed Patterns', () => {
    test('should handle CR+CR+LF+LF+CR-LF+LF-CR correctly', () => {
      // This is: CR, CR, LF, LF, CR-LF, LF-CR
      // Expected: 6 empty lines
      const data = Buffer.from('\r\r\n\n\r\n\n\r');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(6);
      while (outputQueue.getSize() > 0) {
        const msg = outputQueue.dequeue()!;
        expect(Buffer.from(msg.data).toString()).toBe('');
      }
    });

    test('should handle text with all 4 EOL types mixed', () => {
      const data = Buffer.from('A\rB\nC\r\nD\n\rE');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(4); // E not terminated
      const messages = [];
      while (outputQueue.getSize() > 0) {
        messages.push(outputQueue.dequeue()!);
      }
      expect(Buffer.from(messages[0].data).toString()).toBe('A');
      expect(Buffer.from(messages[1].data).toString()).toBe('B');
      expect(Buffer.from(messages[2].data).toString()).toBe('C');
      expect(Buffer.from(messages[3].data).toString()).toBe('D');
    });
  });

  describe('45-byte Scan Limit', () => {
    test('should find EOL within 45-byte limit', () => {
      const longLine = 'A'.repeat(40);
      const data = Buffer.from(longLine + '\r' + 'Next');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      expect(Buffer.from(msg.data).toString()).toBe(longLine);
    });

    test('should handle EOL exactly at 45-byte position', () => {
      const longLine = 'B'.repeat(44);
      const data = Buffer.from(longLine + '\n' + 'Next');
      buffer.appendAtTail(new Uint8Array(data));
      
      extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      expect(Buffer.from(msg.data).toString()).toBe(longLine);
    });
  });

  describe('Performance - Stream of LFs', () => {
    test('should handle 1000 LFs efficiently', () => {
      const lfCount = 1000;
      const data = Buffer.from('\n'.repeat(lfCount));
      buffer.appendAtTail(new Uint8Array(data));
      
      const startTime = Date.now();
      extractor.extractMessages();
      const elapsed = Date.now() - startTime;
      
      expect(outputQueue.getSize()).toBe(lfCount);
      // Should process 1000 LFs in less than 10ms
      expect(elapsed).toBeLessThan(10);
      
      // Verify all are empty messages
      while (outputQueue.getSize() > 0) {
        const msg = outputQueue.dequeue()!;
        expect(Buffer.from(msg.data).toString()).toBe('');
      }
    });

    test('should handle 2Mbps worst-case scenario', () => {
      // 2Mbps = 250KB/sec = 250 bytes/ms
      // Test with 2500 LFs (10ms worth at 2Mbps)
      const lfCount = 2500;
      const data = Buffer.from('\n'.repeat(lfCount));
      buffer.appendAtTail(new Uint8Array(data));
      
      const startTime = Date.now();
      extractor.extractMessages();
      const elapsed = Date.now() - startTime;
      
      expect(outputQueue.getSize()).toBe(lfCount);
      // Should process in reasonable time (< 50ms for 2500 messages)
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('Partial EOL across chunks', () => {
    test('should handle CR and LF in separate chunks', () => {
      // Send CR first
      buffer.appendAtTail(new Uint8Array(Buffer.from('Line1\r')));
      extractor.extractMessages();
      expect(outputQueue.getSize()).toBe(1);
      const msg1 = outputQueue.dequeue()!;
      expect(Buffer.from(msg1.data).toString()).toBe('Line1');
      
      // Now send LF - should be separate line
      buffer.appendAtTail(new Uint8Array(Buffer.from('\nLine2\r')));
      extractor.extractMessages();
      expect(outputQueue.getSize()).toBe(2);
      const msg2 = outputQueue.dequeue()!;
      const msg3 = outputQueue.dequeue()!;
      expect(Buffer.from(msg2.data).toString()).toBe(''); // Empty from LF
      expect(Buffer.from(msg3.data).toString()).toBe('Line2');
    });
  });
});