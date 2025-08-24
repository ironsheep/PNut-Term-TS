/** @format */

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('Debugger Packet Test', () => {
  let buffer: CircularBuffer;
  let extractor: MessageExtractor;
  let outputQueue: DynamicQueue<ExtractedMessage>;

  beforeEach(() => {
    buffer = new CircularBuffer();
    outputQueue = new DynamicQueue<ExtractedMessage>(1000);
    extractor = new MessageExtractor(buffer, outputQueue);
  });

  it('should detect 80-byte debugger packet with binary COG ID', () => {
    // 80-byte packet starting with COG 1 (0x01) from hardware test
    const debuggerPacket = new Uint8Array([
      0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x0E, 0x00, 0xA1, 0x03, 0xF8, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x85, 0x22, 0x40, 0x00, 0xFF, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5F, 0x02, 0x00, 0x40, 0x5D, 0x1C, 0x00, 0x00, 0x4C, 0x18,
      0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x80, 0xB2, 0xE6, 0x0E, 0x10, 0x00, 0x00, 0x00, 0x40, 0x2F
    ]);

    console.log(`First 16 bytes (as decimals): [${Array.from(debuggerPacket.slice(0, 16)).join(', ')}]`);
    console.log(`Total length: ${debuggerPacket.length} bytes`);
    console.log(`First byte (COG ID): ${debuggerPacket[0]} (should be 1)`);

    // Feed to buffer
    const appended = buffer.appendAtTail(debuggerPacket);
    expect(appended).toBe(true);

    // Extract messages
    extractor.extractMessages();

    const extracted: ExtractedMessage[] = [];
    let message;
    while ((message = outputQueue.dequeue())) {
      extracted.push(message);
      const preview = Array.from(message.data.slice(0, 8)).join(', ');
      console.log(`EXTRACTED: ${message.type} - ${message.data.length} bytes - [${preview}...]`);
    }

    // Should detect exactly one DEBUGGER_80BYTE packet
    expect(extracted.length).toBe(1);
    expect(extracted[0].type).toBe(MessageType.DEBUGGER_80BYTE);
    expect(extracted[0].data.length).toBe(80);
    expect(extracted[0].data[0]).toBe(0x01); // Should start with COG 1
  });
});