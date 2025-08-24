// Quick debug test for 0xDB pattern matching
const { CircularBuffer } = require('./dist/pnut-term-ts.js');
const { DynamicQueue } = require('./dist/pnut-term-ts.js');
const { MessageExtractor, MessageType } = require('./dist/pnut-term-ts.js');

const buffer = new CircularBuffer();
const outputQueue = new DynamicQueue(100, 1000, 'TestQueue');
const extractor = new MessageExtractor(buffer, outputQueue);

// Test incomplete packet
const incompletePacket = new Uint8Array([
  0xDB, 0x02, 0x08, 0x00,  // Header says 8-byte payload
  0xAA, 0xBB, 0xCC, 0xDD   // Only 4 bytes of payload
]);

console.log('Adding incomplete packet to buffer:', Array.from(incompletePacket).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
buffer.appendAtTail(incompletePacket);

console.log('Buffer used space:', buffer.getUsedSpace());
console.log('Calling extractMessages...');

const hasMore = extractor.extractMessages();

console.log('hasMore:', hasMore);
console.log('Output queue size:', outputQueue.getSize());
console.log('Buffer used space after:', buffer.getUsedSpace());

// Check if any messages were extracted
if (outputQueue.getSize() > 0) {
  const msg = outputQueue.dequeue();
  console.log('Message type:', msg.type);
  console.log('Message data length:', msg.data.length);
  console.log('Message data:', Array.from(msg.data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
}

const stats = extractor.getStats();
console.log('Extraction stats:', stats);