/**
 * @jest-environment node
 * @format
 */

// tests/spritedefRealUSB.test.ts

import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { SharedMessageType } from '../src/classes/shared/sharedMessagePool';
import * as fs from 'fs';

/**
 * Test using ACTUAL USB packets from real P2 hardware
 * This will show us if the truncation is in our code or the P2
 */

describe('SPRITEDEF with Real USB Packets', () => {
  let processor: SerialMessageProcessor;
  let receivedMessages: any[] = [];

  beforeEach(async () => {
    receivedMessages = [];
    processor = new SerialMessageProcessor(false);

    // Wait for worker ready
    await new Promise<void>((resolve) => {
      processor.once('workerReady' as any, () => resolve());
      setTimeout(() => resolve(), 2000);
    });

    // Register destinations
    processor.registerDestination(SharedMessageType.BACKTICK_PLOT, {
      name: 'PlotTestHandler',
      handler: (message) => {
        receivedMessages.push(message);
      }
    });

    processor.registerDestination(SharedMessageType.BACKTICK_UPDATE, {
      name: 'UpdateTestHandler',
      handler: (message) => {
        receivedMessages.push(message);
      }
    });

    processor.start();
  });

  afterEach(async () => {
    await processor.stop();
  });

  test('should process SPRITEDEF from actual USB log', async () => {
    // Read the USB traffic log
    const usbLog = fs.readFileSync('test-results/external-results/usb-traffic_251015-171336.log', 'utf-8');
    const lines = usbLog.split('\n');

    // Find all SPRITEDEF commands and extract their bytes
    let inSpritedef = false;
    let spritedefBytes: number[] = [];
    let spritedefStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for start of SPRITEDEF in the ASCII view
      if (line.includes('plot spritedef') || line.includes('spritedef')) {
        inSpritedef = true;
        spritedefStart = i;
        console.log(`Found SPRITEDEF at line ${i}`);
      }

      // Extract bytes from hex dump lines
      if (inSpritedef && line.trim().startsWith('00')) {
        // Parse hex dump line: "  0000: $60 $6D $79 ... "
        const hexPart = line.substring(line.indexOf(':') + 1);
        const hexBytes = hexPart.split('  ')[0]; // Get the hex part before ASCII

        // Extract $XX format bytes
        const matches = hexBytes.matchAll(/\$([0-9A-F]{2})/g);
        for (const match of matches) {
          const byteVal = parseInt(match[1], 16);
          spritedefBytes.push(byteVal);

          // Check for CR LF (end of message)
          if (spritedefBytes.length >= 2 &&
              spritedefBytes[spritedefBytes.length - 2] === 0x0D &&
              spritedefBytes[spritedefBytes.length - 1] === 0x0A) {
            // Found complete SPRITEDEF message
            console.log(`Complete SPRITEDEF: ${spritedefBytes.length} bytes from lines ${spritedefStart} to ${i}`);

            // Convert to string to see tokens
            const message = Buffer.from(spritedefBytes).toString('ascii');
            const tokens = message.trim().split(/\s+/);
            console.log(`Tokens: ${tokens.length}`);
            console.log(`First 10 tokens: ${tokens.slice(0, 10).join(' ')}`);
            console.log(`Last 10 tokens: ${tokens.slice(-10).join(' ')}`);

            // Feed to processor
            processor.receiveData(Buffer.from(spritedefBytes));

            // Reset for next SPRITEDEF
            spritedefBytes = [];
            inSpritedef = false;
            break; // Just process the first one for now
          }
        }
      }
    }

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check results
    console.log(`Received ${receivedMessages.length} messages`);
    if (receivedMessages.length > 0) {
      const msg = receivedMessages[0];
      const text = Buffer.from(msg.data).toString('ascii');
      const extractedTokens = text.trim().split(/\s+/);
      console.log(`Extracted: ${msg.data.length} bytes, ${extractedTokens.length} tokens`);
      console.log(`First 10: ${extractedTokens.slice(0, 10).join(' ')}`);
      console.log(`Last 10: ${extractedTokens.slice(-10).join(' ')}`);

      expect(receivedMessages.length).toBe(1);
      expect(msg.data.length).toBe(spritedefBytes.length);
    }
  }, 30000);
});
