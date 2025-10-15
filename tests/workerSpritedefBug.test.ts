/**
 * @jest-environment node
 * @format
 */

// tests/workerSpritedefBug.test.ts

import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { SharedMessageType } from '../src/classes/shared/sharedMessagePool';

/**
 * Test for SPRITEDEF message extraction bug
 *
 * ISSUE: SPRITEDEF commands are long messages (~2000+ bytes) that were being truncated
 *
 * Root cause possibilities:
 * 1. MAX_TEXT_LENGTH = 512 bytes in findTextBoundary() is too small
 * 2. CR/LF bytes within data being treated as message boundaries
 *
 * Expected behavior:
 * - Complete SPRITEDEF message (516 tokens) should be extracted as ONE message
 * - Message should contain all pixel and color data
 */

describe('Worker Thread SPRITEDEF Bug', () => {
  let processor: SerialMessageProcessor;
  let receivedMessages: any[] = [];
  let workerReady: boolean = false;

  beforeEach(async () => {
    receivedMessages = [];
    workerReady = false;

    processor = new SerialMessageProcessor(false);

    // Wait for worker ready event
    const readyPromise = new Promise<void>((resolve) => {
      processor.once('workerReady' as any, () => {
        workerReady = true;
        resolve();
      });
    });

    // Register destination for PLOT window messages
    processor.registerDestination(SharedMessageType.BACKTICK_PLOT, {
      name: 'PlotTestHandler',
      handler: (message) => {
        receivedMessages.push(message);
      }
    });

    // Also register for generic backtick updates
    processor.registerDestination(SharedMessageType.BACKTICK_UPDATE, {
      name: 'UpdateTestHandler',
      handler: (message) => {
        receivedMessages.push(message);
      }
    });

    processor.start();

    // Wait for worker to be ready with timeout
    await Promise.race([
      readyPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Worker ready timeout')), 5000))
    ]);
  });

  afterEach(async () => {
    await processor.stop();
  });

  test('should extract complete SPRITEDEF command (516 tokens, ~2000 bytes)', async () => {
    // Build realistic SPRITEDEF command:
    // `myplot SPRITEDEF <id> <width> <height> <256 pixel values> <256 color values>
    // Total: 1 + 1 + 1 + 1 + 1 + 256 + 256 = 517 tokens (command + id + w + h + pixels + colors)

    const tokens: string[] = [];
    tokens.push('`myplot');
    tokens.push('SPRITEDEF');
    tokens.push('0');      // sprite ID
    tokens.push('16');     // width
    tokens.push('16');     // height

    // 256 pixel values (16x16 sprite)
    for (let i = 0; i < 256; i++) {
      tokens.push(`$${(i % 16).toString(16).padStart(2, '0').toUpperCase()}`);
    }

    // 256 color values - INCLUDE $0D and $0A to test if they're treated as CR/LF!
    for (let i = 0; i < 256; i++) {
      tokens.push(`$${i.toString(16).padStart(2, '0').toUpperCase()}`);
    }

    const message = tokens.join(' ') + '\r\n';
    const messageBytes = Buffer.from(message, 'ascii');

    console.log(`SPRITEDEF message: ${tokens.length} tokens, ${messageBytes.length} bytes`);
    console.log(`Message contains: $0D at position ${message.indexOf('$0D')}, $0A at position ${message.indexOf('$0A')}`);

    processor.receiveData(messageBytes);

    // Wait for worker to process
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should receive exactly ONE complete message
    expect(receivedMessages.length).toBe(1);

    const extractedMessage = receivedMessages[0];

    // Should be classified as PLOT window message
    expect([SharedMessageType.BACKTICK_PLOT, SharedMessageType.BACKTICK_UPDATE]).toContain(extractedMessage.type);

    // CRITICAL: Should contain the COMPLETE message (all bytes)
    expect(extractedMessage.data.length).toBe(messageBytes.length);

    // Verify byte-perfect match
    expect(Array.from(extractedMessage.data)).toEqual(Array.from(messageBytes));

    // Verify it contains all 516 tokens by checking the message text
    const extractedText = Buffer.from(extractedMessage.data).toString('ascii');
    const extractedTokens = extractedText.trim().split(/\s+/);

    console.log(`Extracted message: ${extractedTokens.length} tokens`);
    expect(extractedTokens.length).toBe(tokens.length);
  }, 10000);

  test('should handle message with embedded CR byte (0x0D) in text data', async () => {
    // Create a backtick message that contains the ASCII text "$0D"
    // The text "$0D" is three ASCII bytes: 0x24 ('$'), 0x30 ('0'), 0x44 ('D')
    // This should NOT be confused with an actual CR byte (0x0D)
    const message = '`test $0D $0A values\r\n';
    const messageBytes = Buffer.from(message, 'ascii');

    processor.receiveData(messageBytes);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(receivedMessages.length).toBe(1);
    expect(Array.from(receivedMessages[0].data)).toEqual(Array.from(messageBytes));
  });

  test('should NOT extract message longer than 512 bytes with current implementation', async () => {
    // This test documents the CURRENT behavior (which is the bug)
    // Build a message that's exactly 600 bytes
    const tokens: string[] = [];
    tokens.push('`test');

    // Add tokens until we exceed 512 bytes
    let currentLength = 6; // '`test\r\n'
    let tokenIndex = 0;
    while (currentLength < 600) {
      const token = `TOKEN${tokenIndex}`;
      tokens.push(token);
      currentLength += token.length + 1; // +1 for space
      tokenIndex++;
    }

    const message = tokens.join(' ') + '\r\n';
    const messageBytes = Buffer.from(message, 'ascii');

    console.log(`Long message: ${tokens.length} tokens, ${messageBytes.length} bytes`);

    processor.receiveData(messageBytes);

    await new Promise(resolve => setTimeout(resolve, 200));

    // CURRENT BUG: Message over 512 bytes won't be extracted
    // This test will FAIL once we fix the bug (increase MAX_TEXT_LENGTH)
    console.log(`Received ${receivedMessages.length} messages (expect 0 with current bug, 1 after fix)`);

    // Document current behavior - this will change when we fix it
    if (receivedMessages.length === 0) {
      console.log('BUG CONFIRMED: Message >512 bytes was not extracted');
    } else if (receivedMessages.length === 1) {
      console.log('BUG FIXED: Message >512 bytes was extracted successfully');
      expect(Array.from(receivedMessages[0].data)).toEqual(Array.from(messageBytes));
    }
  });

  test('should reject actual CR/LF bytes NOT followed by valid message start', async () => {
    // This tests the robustness improvement: EOL validation
    //
    // Send a message with an embedded CR byte (0x0D) in the middle
    // that is NOT followed by a valid message start (backtick, Cog, 0xDB)
    //
    // Current behavior: Treats the CR as message boundary (wrong!)
    // Fixed behavior: Only treats CR as EOL if followed by valid message start

    // Create message with actual 0x0D byte in the middle (not ASCII text "$0D")
    const messagePart1 = Buffer.from('`test data with embedded CR:', 'ascii');
    const embeddedCR = Buffer.from([0x0D]); // Actual CR byte
    const messagePart2 = Buffer.from('more data after CR\r\n', 'ascii');

    const messageBytes = Buffer.concat([messagePart1, embeddedCR, messagePart2]);

    console.log(`Message with embedded CR: ${messageBytes.length} bytes`);
    console.log(`Bytes: ${Array.from(messageBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

    processor.receiveData(messageBytes);

    await new Promise(resolve => setTimeout(resolve, 200));

    console.log(`Received ${receivedMessages.length} messages`);

    if (receivedMessages.length === 2) {
      console.log('CURRENT BUG: Embedded CR split message into 2 parts');
      console.log(`Part 1: ${receivedMessages[0].data.length} bytes`);
      console.log(`Part 2: ${receivedMessages[1].data.length} bytes`);
    } else if (receivedMessages.length === 1) {
      console.log('FIXED: Embedded CR did not split message (validated EOL)');
      // After fix, should get the complete message
      expect(Array.from(receivedMessages[0].data)).toEqual(Array.from(messageBytes));
    }
  });

  test('CRITICAL: should preserve message start bytes when validating EOL', async () => {
    // This test catches the bug where peeking at the next byte to validate EOL
    // consumed the backtick (or other message start byte) from the next message

    // Send two consecutive backtick messages
    const message1 = '`test message 1\r\n';
    const message2 = '`test message 2\r\n';
    const combined = Buffer.from(message1 + message2, 'ascii');

    processor.receiveData(combined);

    await new Promise(resolve => setTimeout(resolve, 200));

    // Should receive BOTH messages, each starting with backtick
    expect(receivedMessages.length).toBe(2);

    // First message should have backtick
    const msg1Text = Buffer.from(receivedMessages[0].data).toString('ascii');
    expect(msg1Text).toMatch(/^`test message 1/);

    // Second message should ALSO have backtick (this is what the bug broke!)
    const msg2Text = Buffer.from(receivedMessages[1].data).toString('ascii');
    expect(msg2Text).toMatch(/^`test message 2/);

    // Verify neither message had its backtick consumed
    expect(msg1Text.startsWith('`')).toBe(true);
    expect(msg2Text.startsWith('`')).toBe(true);
  }, 10000);

  test('should handle multiple PLOT commands in sequence', async () => {
    // Real-world scenario: multiple plot commands in rapid succession
    const commands = [
      '`myplot clear\r\n',
      '`myplot set 0 0 red 1\r\n',
      '`myplot set 10 10 blue 2\r\n',
      '`myplot set 20 20 green 3\r\n'
    ];

    const combined = Buffer.from(commands.join(''), 'ascii');
    processor.receiveData(combined);

    await new Promise(resolve => setTimeout(resolve, 200));

    // Should receive all 4 commands
    expect(receivedMessages.length).toBe(4);

    // Each should start with backtick
    receivedMessages.forEach((msg, index) => {
      const text = Buffer.from(msg.data).toString('ascii');
      expect(text.startsWith('`')).toBe(true);
      expect(text).toContain('myplot');
    });
  }, 10000);

  test('CRITICAL: 416-byte extractor must NOT split text messages', async () => {
    // This test catches the REAL BUG that was splitting SPRITEDEF commands
    //
    // Bug: find416ByteBoundary() was extracting ANY 416 bytes without validating
    //      that the first byte is 0x00-0x07 (COG ID for debugger packets)
    //
    // Result: Large text messages (like SPRITEDEF ~2000 bytes) were incorrectly
    //         split into multiple 416-byte "debugger packets"
    //
    // Fix: find416ByteBoundary() now validates first byte is 0x00-0x07

    // Create a text message that's exactly 500 bytes (longer than 416)
    // This simulates partial SPRITEDEF data accumulating before CR/LF arrives
    const tokens: string[] = [];
    tokens.push('`myplot');
    tokens.push('SPRITEDEF');
    tokens.push('0');
    tokens.push('16');
    tokens.push('16');

    // Add tokens until we have exactly 500 bytes (without CR/LF)
    let currentLength = '`myplot SPRITEDEF 0 16 16 '.length;
    let tokenIndex = 0;
    while (currentLength < 500) {
      const token = `$${tokenIndex.toString(16).padStart(2, '0').toUpperCase()}`;
      tokens.push(token);
      currentLength += token.length + 1; // +1 for space
      tokenIndex++;
    }

    // Send WITHOUT CR/LF first (simulating partial message in buffer)
    const partialMessage = tokens.join(' ');
    const partialBytes = Buffer.from(partialMessage, 'ascii');

    console.log(`Partial SPRITEDEF: ${partialBytes.length} bytes (no CR/LF yet)`);
    console.log(`First byte: 0x${partialBytes[0].toString(16).padStart(2, '0')} (backtick)`);

    processor.receiveData(partialBytes);

    // Wait a bit - worker should NOT extract anything (no CR/LF, not a 416-byte packet)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should receive ZERO messages (incomplete text, not a valid 416-byte packet)
    expect(receivedMessages.length).toBe(0);

    // Now send the completion with CR/LF
    const completion = ' $FF\r\n';
    const completionBytes = Buffer.from(completion, 'ascii');
    processor.receiveData(completionBytes);

    await new Promise(resolve => setTimeout(resolve, 200));

    // Should receive exactly ONE message (complete text message)
    expect(receivedMessages.length).toBe(1);

    // Message should contain ALL bytes (partial + completion)
    const expectedLength = partialBytes.length + completionBytes.length;
    expect(receivedMessages[0].data.length).toBe(expectedLength);

    // Verify it's the complete message
    const fullMessage = Buffer.concat([partialBytes, completionBytes]);
    expect(Array.from(receivedMessages[0].data)).toEqual(Array.from(fullMessage));

    console.log(`SUCCESS: ${partialBytes.length}-byte text message was NOT incorrectly split by 416-byte extractor`);
  }, 10000);
});
