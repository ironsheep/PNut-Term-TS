/** @format */

// tests/messageExtractor.test.ts

import { MessageExtractor, MessageType, ExtractedMessage } from '../src/classes/shared/messageExtractor';
import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';

describe('MessageExtractor', () => {
  let buffer: CircularBuffer;
  let outputQueue: DynamicQueue<ExtractedMessage>;
  let extractor: MessageExtractor;

  beforeEach(() => {
    buffer = new CircularBuffer();
    outputQueue = new DynamicQueue<ExtractedMessage>();
    extractor = new MessageExtractor(buffer, outputQueue);
  });

  describe('Text Message Extraction', () => {
    it('should extract simple text message with LF', () => {
      const text = 'Hello World\n';
      const data = new Uint8Array(Buffer.from(text));
      buffer.appendAtTail(data);

      const hasMore = extractor.extractMessages();
      
      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.TEXT);
      expect(Buffer.from(msg.data).toString()).toBe('Hello World');
      expect(hasMore).toBe(false);
    });

    it('should extract text with CRLF', () => {
      const text = 'Test Line\r\n';
      buffer.appendAtTail(new Uint8Array(Buffer.from(text)));

      extractor.extractMessages();

      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.TEXT);
      expect(Buffer.from(msg.data).toString()).toBe('Test Line');
    });

    it('should extract Cog messages with COG ID', () => {
      const cogMsg = 'Cog0: Debug info\n';
      buffer.appendAtTail(new Uint8Array(Buffer.from(cogMsg)));

      extractor.extractMessages();

      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.TEXT);
      expect(msg.metadata?.cogId).toBe(0);
      expect(Buffer.from(msg.data).toString()).toBe('Cog0: Debug info');
    });

    it('should handle multiple text lines', () => {
      const lines = 'Line 1\nLine 2\nLine 3\n';
      buffer.appendAtTail(new Uint8Array(Buffer.from(lines)));

      extractor.extractMessages();

      expect(outputQueue.getSize()).toBe(3);
      expect(outputQueue.dequeue()!.type).toBe(MessageType.TEXT);
      expect(outputQueue.dequeue()!.type).toBe(MessageType.TEXT);
      expect(outputQueue.dequeue()!.type).toBe(MessageType.TEXT);
    });

    it('should wait for complete text line', () => {
      // Partial line without EOL
      const partial = 'Incomplete line';
      buffer.appendAtTail(new Uint8Array(Buffer.from(partial)));

      const hasMore = extractor.extractMessages();

      expect(outputQueue.getSize()).toBe(0);
      expect(hasMore).toBe(false); // Waiting for more data

      // Add EOL
      buffer.appendAtTail(new Uint8Array([0x0A]));
      extractor.extractMessages();

      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      expect(Buffer.from(msg.data).toString()).toBe('Incomplete line');
    });
  });

  describe('0xDB Protocol Message Extraction', () => {
    it('should extract 0xDB protocol message', () => {
      // Create a 0xDB message: header (4 bytes) + payload
      const header = new Uint8Array([
        0xDB,       // Marker
        0x01,       // Message type
        0x08, 0x00  // Payload size (8 bytes, little-endian)
      ]);
      const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      
      buffer.appendAtTail(header);
      buffer.appendAtTail(payload);

      extractor.extractMessages();

      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.DEBUGGER_PROTOCOL);
      expect(msg.data.length).toBe(12); // 4 header + 8 payload
      expect(msg.data[0]).toBe(0xDB);
      expect(msg.metadata?.messageSubtype).toBe(0x01);
      expect(msg.metadata?.payloadSize).toBe(8);
    });

    it('should wait for complete 0xDB message', () => {
      // Send header only
      const header = new Uint8Array([0xDB, 0x02, 0x10, 0x00]); // 16-byte payload
      buffer.appendAtTail(header);

      let hasMore = extractor.extractMessages();
      expect(outputQueue.getSize()).toBe(0); // Waiting for payload

      // Send partial payload
      const partialPayload = new Uint8Array(8);
      buffer.appendAtTail(partialPayload);

      hasMore = extractor.extractMessages();
      expect(outputQueue.getSize()).toBe(0); // Still waiting

      // Send rest of payload
      const restPayload = new Uint8Array(8);
      buffer.appendAtTail(restPayload);

      extractor.extractMessages();
      expect(outputQueue.getSize()).toBe(1);
    });

    it('should reject invalid 0xDB payload size', () => {
      // Create message with huge payload size
      const badHeader = new Uint8Array([
        0xDB, 0x01,
        0xFF, 0xFF  // 65535 bytes - too large
      ]);
      buffer.appendAtTail(badHeader);

      extractor.extractMessages();

      // Should skip the bad 0xDB byte and continue
      expect(outputQueue.getSize()).toBe(0);
    });
  });

  describe('80-byte Debugger Init Extraction', () => {
    it('should extract 80-byte debugger initialization packet', () => {
      const packet = new Uint8Array(80);
      // Set COG number (first 4 bytes, little-endian)
      packet[0] = 3; // COG 3
      packet[1] = 0;
      packet[2] = 0;
      packet[3] = 0;
      
      // Set PC (bytes 20-23)
      packet[20] = 0x00;
      packet[21] = 0x10;
      packet[22] = 0x00;
      packet[23] = 0x00;

      buffer.appendAtTail(packet);

      extractor.extractMessages();

      expect(outputQueue.getSize()).toBe(1);
      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.DEBUGGER_INIT);
      expect(msg.data.length).toBe(80);
      expect(msg.metadata?.cogId).toBe(3);
    });

    it('should validate debugger init packet', () => {
      const packet = new Uint8Array(80);
      // Invalid COG number
      packet[0] = 99; // > 7
      
      buffer.appendAtTail(packet);
      extractor.extractMessages();

      // Should not extract as debugger init
      const msg = outputQueue.dequeue();
      expect(msg?.type).not.toBe(MessageType.DEBUGGER_INIT);
    });

    it('should detect 80-byte packet followed by text', () => {
      const packet = new Uint8Array(80);
      packet[0] = 2; // COG 2
      
      buffer.appendAtTail(packet);
      buffer.appendAtTail(new Uint8Array(Buffer.from('Text after packet\n')));

      extractor.extractMessages();

      expect(outputQueue.getSize()).toBe(2);
      const init = outputQueue.dequeue()!;
      expect(init.type).toBe(MessageType.DEBUGGER_INIT);
      
      const text = outputQueue.dequeue()!;
      expect(text.type).toBe(MessageType.TEXT);
    });
  });

  describe('Unknown Binary Extraction', () => {
    it('should extract unknown binary data', () => {
      // Non-text, non-protocol binary data
      const binary = new Uint8Array([0xFF, 0xFE, 0x00, 0x01, 0x02]);
      buffer.appendAtTail(binary);
      
      // Add text boundary
      buffer.appendAtTail(new Uint8Array(Buffer.from('Text\n')));

      extractor.extractMessages();

      expect(outputQueue.getSize()).toBe(2);
      const binaryMsg = outputQueue.dequeue()!;
      expect(binaryMsg.type).toBe(MessageType.BINARY_UNKNOWN);
      expect(binaryMsg.data).toEqual(binary);

      const textMsg = outputQueue.dequeue()!;
      expect(textMsg.type).toBe(MessageType.TEXT);
    });

    it('should limit unknown binary chunk size', () => {
      // Create 300 bytes of binary
      const binary = new Uint8Array(300);
      for (let i = 0; i < 300; i++) {
        binary[i] = 0xFF;
      }
      buffer.appendAtTail(binary);

      extractor.extractMessages();

      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.BINARY_UNKNOWN);
      expect(msg.data.length).toBe(256); // Limited to 256
    });

    it('should find text boundary in mixed data', () => {
      // Binary followed by text
      const mixed = new Uint8Array([
        0xFF, 0xFE, 0xFD, // Binary
        0x43, 0x6F, 0x67, 0x30, // "Cog0"
        0x0A // LF
      ]);
      buffer.appendAtTail(mixed);

      extractor.extractMessages();

      expect(outputQueue.getSize()).toBe(2);
      
      const binary = outputQueue.dequeue()!;
      expect(binary.type).toBe(MessageType.BINARY_UNKNOWN);
      expect(binary.data.length).toBe(3);

      const text = outputQueue.dequeue()!;
      expect(text.type).toBe(MessageType.TEXT);
      expect(Buffer.from(text.data).toString()).toBe('Cog0');
    });
  });

  describe('Message Order Priority', () => {
    it('should check 0xDB before text', () => {
      // 0xDB packet that contains text-like bytes
      const packet = new Uint8Array([
        0xDB, 0x01, 0x04, 0x00, // Header
        0x43, 0x6F, 0x67, 0x30  // Payload happens to be "Cog0"
      ]);
      buffer.appendAtTail(packet);

      extractor.extractMessages();

      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.DEBUGGER_PROTOCOL);
      expect(msg.data.length).toBe(8);
    });

    it('should check text before 80-byte packet', () => {
      // Text line exactly 80 bytes (including EOL)
      let text = 'X'.repeat(79) + '\n';
      buffer.appendAtTail(new Uint8Array(Buffer.from(text)));

      extractor.extractMessages();

      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.TEXT);
      expect(msg.data.length).toBe(79);
    });
  });

  describe('Partial Message Handling', () => {
    it('should handle partial messages across multiple extractions', () => {
      // Send message in parts
      const fullMessage = 'This is a complete message\n';
      const bytes = Buffer.from(fullMessage);
      
      // Send first part
      buffer.appendAtTail(new Uint8Array(bytes.slice(0, 10)));
      let hasMore = extractor.extractMessages();
      expect(outputQueue.getSize()).toBe(0);
      expect(hasMore).toBe(false);

      // Send second part
      buffer.appendAtTail(new Uint8Array(bytes.slice(10, 20)));
      hasMore = extractor.extractMessages();
      expect(outputQueue.getSize()).toBe(0);

      // Send final part with EOL
      buffer.appendAtTail(new Uint8Array(bytes.slice(20)));
      extractor.extractMessages();
      expect(outputQueue.getSize()).toBe(1);

      const msg = outputQueue.dequeue()!;
      expect(Buffer.from(msg.data).toString()).toBe('This is a complete message');
    });

    it('should track partial message waits', () => {
      // Send incomplete messages
      buffer.appendAtTail(new Uint8Array(Buffer.from('Partial')));
      extractor.extractMessages();

      buffer.appendAtTail(new Uint8Array([0xDB, 0x01, 0x10])); // Incomplete 0xDB
      extractor.extractMessages();

      const stats = extractor.getStats();
      expect(stats.partialMessageWaits).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should track message counts by type', () => {
      // Add various message types
      buffer.appendAtTail(new Uint8Array(Buffer.from('Text 1\n')));
      buffer.appendAtTail(new Uint8Array([0xDB, 0x01, 0x02, 0x00, 0xAA, 0xBB]));
      buffer.appendAtTail(new Uint8Array(Buffer.from('Text 2\n')));

      extractor.extractMessages();

      const stats = extractor.getStats();
      expect(stats.messagesExtracted[MessageType.TEXT]).toBe(2);
      expect(stats.messagesExtracted[MessageType.DEBUGGER_PROTOCOL]).toBe(1);
    });

    it('should track total bytes extracted', () => {
      const text = 'Hello\n'; // 5 bytes without EOL
      buffer.appendAtTail(new Uint8Array(Buffer.from(text)));

      extractor.extractMessages();

      const stats = extractor.getStats();
      expect(stats.totalBytesExtracted).toBe(5);
    });

    it('should reset statistics', () => {
      buffer.appendAtTail(new Uint8Array(Buffer.from('Test\n')));
      extractor.extractMessages();

      extractor.resetStats();

      const stats = extractor.getStats();
      expect(stats.messagesExtracted[MessageType.TEXT]).toBe(0);
      expect(stats.totalBytesExtracted).toBe(0);
      expect(stats.partialMessageWaits).toBe(0);
    });
  });

  describe('Queue Integration', () => {
    it('should handle output queue full', () => {
      const tinyQueue = new DynamicQueue<ExtractedMessage>(1, 1);
      const extractor2 = new MessageExtractor(buffer, tinyQueue);

      const errorSpy = jest.fn();
      extractor2.on('queueFull', errorSpy);

      // Add two messages
      buffer.appendAtTail(new Uint8Array(Buffer.from('Message 1\n')));
      buffer.appendAtTail(new Uint8Array(Buffer.from('Message 2\n')));

      extractor2.extractMessages();

      expect(tinyQueue.getSize()).toBe(1);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should emit messagesExtracted event', () => {
      const eventSpy = jest.fn();
      extractor.on('messagesExtracted', eventSpy);

      buffer.appendAtTail(new Uint8Array(Buffer.from('Line 1\nLine 2\n')));
      extractor.extractMessages();

      expect(eventSpy).toHaveBeenCalledWith(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty buffer', () => {
      const hasMore = extractor.extractMessages();
      expect(hasMore).toBe(false);
      expect(outputQueue.getSize()).toBe(0);
    });

    it('should skip unidentifiable bytes', () => {
      // Single unidentifiable byte
      buffer.appendAtTail(new Uint8Array([0x99]));
      buffer.appendAtTail(new Uint8Array(Buffer.from('Text\n')));

      extractor.extractMessages();

      // Should skip the 0x99 and extract text
      expect(outputQueue.getSize()).toBeGreaterThan(0);
    });

    it('should handle text line exceeding limit', () => {
      // Create very long line
      const longLine = 'X'.repeat(1030) + '\n';
      buffer.appendAtTail(new Uint8Array(Buffer.from(longLine)));

      extractor.extractMessages();

      const msg = outputQueue.dequeue()!;
      expect(msg.type).toBe(MessageType.TEXT);
      expect(msg.data.length).toBe(1024); // Truncated
    });
  });
});