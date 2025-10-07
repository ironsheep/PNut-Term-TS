// HSV16 test with WorkerExtractor
const { WorkerExtractor } = require('./dist/classes/shared/workerExtractor');

console.log('=== HSV16 Worker Test ===\n');

const extractor = new WorkerExtractor(2 * 1024 * 1024); // 2MB buffer
let messagesExtracted = 0;

extractor.on('workerReady', () => {
  console.log('✅ Worker ready, generating messages...\n');

  // Generate HSV16 messages
  const messages = [];

  // 3 window creations
  messages.push(Buffer.from("`bitmap j title 'HSV16' pos 100 985 size 256 256 trace 4 hsv16\r\n"));
  messages.push(Buffer.from("`bitmap k title 'HSV16W' pos 370 985 size 256 256 trace 4 hsv16w\r\n"));
  messages.push(Buffer.from("`bitmap l title 'HSV16X' pos 640 985 size 256 256 trace 4 hsv16x\r\n"));

  // 65,536 data messages
  for (let i = 0; i <= 65535; i++) {
    const hexStr = i.toString(16).toUpperCase(); // No leading zeros
    messages.push(Buffer.from(`\`j k l $${hexStr}\r\n`));
  }

  console.log(`Generated ${messages.length} messages (65,539 expected)`);
  console.log(`Total bytes: ${messages.reduce((sum, m) => sum + m.length, 0)}\n`);

  // Send all messages rapidly (simulate USB burst)
  const start = Date.now();
  messages.forEach(msg => extractor.receiveData(msg));
  const sendTime = Date.now() - start;

  console.log(`Sent all messages in ${sendTime}ms`);
  console.log('Waiting for extraction...\n');

  // Check progress every 500ms
  const checkInterval = setInterval(() => {
    console.log(`Progress: ${messagesExtracted} / 65539 messages (${((messagesExtracted/65539)*100).toFixed(1)}%)`);
  }, 500);

  // Final check after 10 seconds
  setTimeout(() => {
    clearInterval(checkInterval);

    const stats = extractor.getStats();
    console.log('\n=== RESULTS ===');
    console.log(`Messages extracted: ${messagesExtracted} / 65539`);
    console.log(`Success rate: ${((messagesExtracted/65539)*100).toFixed(2)}%`);
    console.log(`Message loss: ${65539 - messagesExtracted} (${((1 - messagesExtracted/65539)*100).toFixed(2)}%)`);
    console.log('\nStats:', stats);

    if (messagesExtracted === 65539) {
      console.log('\n🎉 SUCCESS! All messages extracted!');
      process.exit(0);
    } else {
      console.log('\n❌ FAILURE: Message loss detected');
      process.exit(1);
    }
  }, 10000);
});

extractor.on('messageExtracted', (message) => {
  messagesExtracted++;
});

extractor.on('bufferOverflow', () => {
  console.error('❌ BUFFER OVERFLOW!');
});

extractor.on('workerError', (error) => {
  console.error('❌ Worker error:', error);
  process.exit(1);
});

// Timeout safety
setTimeout(() => {
  console.error('\n❌ Test timeout (30 seconds)');
  process.exit(1);
}, 30000);
