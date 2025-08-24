/** @format */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('COG Pattern Debug', () => {
  let buffer: CircularBuffer;
  let extractor: MessageExtractor;
  let outputQueue: DynamicQueue<ExtractedMessage>;

  beforeEach(() => {
    buffer = new CircularBuffer();
    outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    extractor = new MessageExtractor(buffer, outputQueue);
  });

  it('should debug single COG message pattern matching', () => {
    // Single COG message with clear CRLF termination
    const testMessage = "Cog0  INIT $0000_0000 $0000_0000 load\r\n";
    const messageBytes = new TextEncoder().encode(testMessage);
    
    console.log(`Test message: "${testMessage}"`);
    console.log(`Message bytes: [${Array.from(messageBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
    console.log(`Total length: ${messageBytes.length} bytes`);
    
    // Find CRLF positions
    const crIndex = messageBytes.indexOf(0x0D);
    const lfIndex = messageBytes.indexOf(0x0A);
    console.log(`CR (0x0D) at index: ${crIndex}`);
    console.log(`LF (0x0A) at index: ${lfIndex}`);
    
    // Feed to buffer
    const appended = buffer.appendAtTail(messageBytes);
    expect(appended).toBe(true);
    
    // Extract messages
    extractor.extractMessages();
    
    const extracted: ExtractedMessage[] = [];
    let message;
    while ((message = outputQueue.dequeue())) {
      extracted.push(message);
      const preview = new TextDecoder().decode(message.data);
      console.log(`EXTRACTED: ${message.type} - ${message.data.length} bytes - "${preview}"`);
    }
    
    // Should extract exactly one COG_MESSAGE with the complete text
    expect(extracted.length).toBe(1);
    expect(extracted[0].type).toBe(MessageType.COG_MESSAGE);
    expect(extracted[0].data.length).toBe(messageBytes.length);
  });
});