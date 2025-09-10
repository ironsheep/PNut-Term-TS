/** @format */

import { MessageExtractor } from '../src/classes/shared/messageExtractor';
import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';
import { ExtractedMessage, MessageType } from '../src/classes/shared/messageExtractor';

describe('EOL Detection in MessageExtractor', () => {
  let extractor: MessageExtractor;
  let buffer: CircularBuffer;
  let outputQueue: DynamicQueue<ExtractedMessage>;

  beforeEach(() => {
    buffer = new CircularBuffer(1024);
    outputQueue = new DynamicQueue<ExtractedMessage>();
    extractor = new MessageExtractor(buffer, outputQueue);
  });

  // Helper to add data to buffer and extract messages
  const addDataAndExtract = (data: string): ExtractedMessage[] => {
    const bytes = Buffer.from(data);
    buffer.appendAtTail(new Uint8Array(bytes));
    extractor.extractMessages();
    
    const messages: ExtractedMessage[] = [];
    while (outputQueue.getSize() > 0) {
      messages.push(outputQueue.dequeue()!);
    }
    return messages;
  };

  describe('All 4 EOL Forms', () => {
    test('should recognize CR as single line ending', () => {
      const messages = addDataAndExtract('Line1\rLine2\r');
      
      expect(messages.length).toBe(2);
      expect(messages[0].type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(Buffer.from(messages[0].data).toString()).toBe('Line1');
      expect(Buffer.from(messages[1].data).toString()).toBe('Line2');
    });

    test('should recognize LF as single line ending', () => {
      const messages = addDataAndExtract('Line1\nLine2\n');
      
      expect(messages.length).toBe(2);
      expect(messages[0].type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(Buffer.from(messages[0].data).toString()).toBe('Line1');
      expect(Buffer.from(messages[1].data).toString()).toBe('Line2');
    });

    test('should recognize CR-LF as single line ending', () => {
      const messages = addDataAndExtract('Line1\r\nLine2\r\n');
      
      expect(messages.length).toBe(2);
      expect(messages[0].type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(Buffer.from(messages[0].data).toString()).toBe('Line1');
      expect(Buffer.from(messages[1].data).toString()).toBe('Line2');
    });

    test('should recognize LF-CR as single line ending', () => {
      const messages = addDataAndExtract('Line1\n\rLine2\n\r');
      
      expect(messages.length).toBe(2);
      expect(messages[0].type).toBe(MessageType.TERMINAL_OUTPUT);
      expect(Buffer.from(messages[0].data).toString()).toBe('Line1');
      expect(Buffer.from(messages[1].data).toString()).toBe('Line2');
    });
  });

  describe('45-byte Scan Limit', () => {
    test('should find EOL within 45-byte limit', () => {
      // Create a 40-byte line followed by CR
      const longLine = 'A'.repeat(40);
      const messages = addDataAndExtract(longLine + '\r' + 'Next');
      
      expect(messages.length).toBeGreaterThan(0);
      expect(Buffer.from(messages[0].data).toString()).toBe(longLine);
    });

    test('should handle case where EOL is exactly at 45-byte limit', () => {
      // Create a 44-byte line + EOL at position 45
      const longLine = 'B'.repeat(44); 
      const messages = addDataAndExtract(longLine + '\n' + 'Next');
      
      expect(messages.length).toBeGreaterThan(0);
      expect(Buffer.from(messages[0].data).toString()).toBe(longLine);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty lines', () => {
      const messages = addDataAndExtract('\r\n\r\nContent\r\n');
      
      expect(messages.length).toBeGreaterThan(0);
      // Empty lines should be processed
      expect(messages.some(m => Buffer.from(m.data).toString() === '')).toBe(true);
      expect(messages.some(m => Buffer.from(m.data).toString() === 'Content')).toBe(true);
    });

    test('should handle incomplete lines (no EOL)', () => {
      const messages = addDataAndExtract('IncompleteContent');
      
      // Should not extract incomplete lines without EOL
      expect(messages.length).toBe(0);
    });

    test('should handle mixed EOL patterns', () => {
      // Mix all 4 EOL types
      const messages = addDataAndExtract('A\rB\nC\r\nD\n\rE\r');
      
      expect(messages.length).toBe(5);
      expect(Buffer.from(messages[0].data).toString()).toBe('A');
      expect(Buffer.from(messages[1].data).toString()).toBe('B');
      expect(Buffer.from(messages[2].data).toString()).toBe('C');
      expect(Buffer.from(messages[3].data).toString()).toBe('D');
      expect(Buffer.from(messages[4].data).toString()).toBe('E');
    });
  });
});