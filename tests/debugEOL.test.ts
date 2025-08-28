/** @format */

import { MessageExtractor, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('Debug EOL Issue', () => {
  let buffer: CircularBuffer;
  let outputQueue: DynamicQueue<ExtractedMessage>;
  let extractor: MessageExtractor;

  beforeEach(() => {
    buffer = new CircularBuffer(1024);
    outputQueue = new DynamicQueue<ExtractedMessage>();
    extractor = new MessageExtractor(buffer, outputQueue);
  });

  test('simple double CR', () => {
    // Two CRs should give us two messages (one with text, one empty)
    const data = Buffer.from('Line1\r\r');
    buffer.appendAtTail(new Uint8Array(data));
    
    console.log('Buffer has', buffer.getUsedSpace(), 'bytes');
    
    const hasMore = extractor.extractMessages();
    console.log('extractMessages returned', hasMore);
    console.log('Queue size:', outputQueue.getSize());
    
    // Dump all messages
    const messages = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue()!;
      messages.push(msg);
      console.log('Message:', {
        type: msg.type,
        data: Buffer.from(msg.data).toString(),
        dataHex: Array.from(msg.data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
        confidence: msg.confidence
      });
    }
    
    expect(messages.length).toBe(2);
    expect(Buffer.from(messages[0].data).toString()).toBe('Line1');
    expect(Buffer.from(messages[1].data).toString()).toBe('');
  });

  test('triple LF', () => {
    // Three LFs should give us three messages (all empty)
    const data = Buffer.from('\n\n\n');
    buffer.appendAtTail(new Uint8Array(data));
    
    console.log('Buffer has', buffer.getUsedSpace(), 'bytes');
    
    const hasMore = extractor.extractMessages();
    console.log('extractMessages returned', hasMore);
    console.log('Queue size:', outputQueue.getSize());
    
    // Dump all messages
    const messages = [];
    while (outputQueue.getSize() > 0) {
      const msg = outputQueue.dequeue()!;
      messages.push(msg);
      console.log('Message:', {
        type: msg.type,
        data: Buffer.from(msg.data).toString(),
        dataHex: Array.from(msg.data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
        confidence: msg.confidence
      });
    }
    
    expect(messages.length).toBe(3);
    messages.forEach(msg => {
      expect(Buffer.from(msg.data).toString()).toBe('');
    });
  });
});