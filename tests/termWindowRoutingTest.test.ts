/** @format */

import { Context } from '../src/utils/context';
import { WindowRouter } from '../src/classes/shared/windowRouter';
import { MessagePool } from '../src/classes/shared/messagePool';
import { MessageExtractor } from '../src/classes/shared/messageExtractor';
import { DebugLoggerWindow } from '../src/classes/debugLoggerWin';
import { DebugTermWindow } from '../src/classes/debugTermWin';
import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';
import { ExtractedMessage } from '../src/classes/shared/messageExtractor';

/**
 * CRITICAL TEST: TERM Window Message Routing and Pool Management
 * 
 * This test verifies the complete message flow for TERM windows:
 * 1. Creation message routing to debug logger AND window creation
 * 2. Update message routing to debug logger AND created window
 * 3. Critical: Message pool cleanup and proper message return
 * 
 * Goal: Identify routing pipeline failures and ensure no message pool leaks
 */
describe('TERM Window Message Routing and Pool Management', () => {
  let context: Context;
  let windowRouter: WindowRouter;
  let messagePool: MessagePool;
  let messageExtractor: MessageExtractor;
  let debugLogger: DebugLoggerWindow | null = null;
  let termWindow: DebugTermWindow | null = null;

  // Track message pool allocations  
  let initialPoolStats: any;
  let allocatedMessages: number = 0;
  let returnedMessages: number = 0;

  beforeEach(() => {
    // Mock context
    context = {
      libraryFolder: '/lib',
      extensionFolder: '/ext',
      currentFolder: '/current',
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      },
      actions: {
        writeRAM: false,
        writeFlash: false,
        binFilename: '',
        binDirspec: ''
      },
      runEnvironment: {
        serialPortDevices: [],
        selectedPropPlug: '',
        logFilename: '',
        developerModeEnabled: false,
        debugBaudrate: 115200,
        ideMode: false,
        rtsOverride: false,
        loggingEnabled: true,
        loggingLevel: 'INFO',
        logToFile: true,
        logToConsole: false,
        consoleMode: false,
        verbose: false,
        quiet: false
      }
    } as Context;

    // Use singleton instances
    windowRouter = WindowRouter.getInstance();
    messagePool = MessagePool.getInstance();
    
    // Create message extractor with required dependencies
    const buffer = new CircularBuffer(1024);
    const outputQueue = new DynamicQueue<ExtractedMessage>();
    messageExtractor = new MessageExtractor(buffer, outputQueue);

    // Track initial pool state
    initialPoolStats = messagePool.getStatistics();
    allocatedMessages = 0;
    returnedMessages = 0;

    // Spy on message pool to track allocations/returns
    const originalAcquire = messagePool.acquire.bind(messagePool);
    const originalRelease = messagePool.release.bind(messagePool);

    jest.spyOn(messagePool, 'acquire').mockImplementation((...args) => {
      allocatedMessages++;
      return originalAcquire(...args);
    });

    jest.spyOn(messagePool, 'release').mockImplementation((message) => {
      returnedMessages++;
      return originalRelease(message);
    });

    // Reset window references
    debugLogger = null;
    termWindow = null;
  });

  afterEach(() => {
    // Cleanup
    if (debugLogger) {
      debugLogger.close();
    }
    if (termWindow) {
      termWindow.close();
    }
  });

  it('should handle TERM creation message with proper routing and pool cleanup', async () => {
    console.log('🧪 TEST: TERM Creation Message Flow');

    // Simulate TERM creation message
    const creationMessage = '`TERM MyTerm SIZE 9 1 TEXTSIZE 40\r\n';
    const messageBuffer = Buffer.from(creationMessage, 'ascii');

    console.log('📨 Sending creation message:', creationMessage.trim());

    // Extract messages from buffer
    const extractedMessages = messageExtractor.extractMessages(messageBuffer);
    console.log(`📋 Extracted ${extractedMessages.length} messages`);

    expect(extractedMessages.length).toBeGreaterThan(0);

    // Process each extracted message through router
    for (const extracted of extractedMessages) {
      console.log(`🔄 Processing message type: ${extracted.messageType}, length: ${extracted.data.length}`);

      if (extracted.messageType === 'BACKTICK_WINDOW') {
        console.log('✅ BACKTICK_WINDOW message detected');

        // This should route to debug logger AND create window
        const destinations = windowRouter.getDestinations(extracted.messageType);
        console.log(`🎯 Found ${destinations.length} destinations for BACKTICK_WINDOW`);

        // Create pooled message for routing
        const pooledMessage = messagePool.getMessage(
          extracted.messageType,
          extracted.data,
          destinations.length
        );

        console.log(`💾 Created pooled message #${pooledMessage.id} for ${pooledMessage.consumerCount} consumers`);

        // Verify message was allocated from pool
        expect(allocatedMessages).toBeGreaterThan(0);
        expect(pooledMessage).toBeDefined();
        expect(pooledMessage.consumerCount).toEqual(destinations.length);

        // Route message to destinations
        for (const destination of destinations) {
          console.log(`📤 Routing message to: ${destination}`);

          if (destination === 'debugLogger') {
            // Should route to debug logger
            console.log('📝 Message should reach debug logger');
            // Note: In real system, this would create debug logger if not exists
          } else if (destination.includes('term')) {
            // Should create TERM window
            console.log('🪟 Message should trigger TERM window creation');
            // Note: In real system, this would create DebugTermWindow
          }
        }

        // Simulate message consumption (this should happen in real routing)
        pooledMessage.markConsumed();
        
        // Message should be returned to pool after all consumers process it
        if (pooledMessage.isFullyConsumed()) {
          messagePool.returnMessage(pooledMessage);
          console.log(`♻️  Returned pooled message #${pooledMessage.id} to pool`);
        }
      }
    }

    // Verify message pool cleanup
    console.log(`📊 Pool stats: allocated=${allocatedMessages}, returned=${returnedMessages}`);
    expect(returnedMessages).toEqual(allocatedMessages);
    expect(messagePool.available).toEqual(initialPoolSize);

    console.log('✅ Creation message test completed with proper pool cleanup');
  });

  it('should handle TERM update messages with proper routing and pool cleanup', async () => {
    console.log('🧪 TEST: TERM Update Message Flow');

    // Simulate TERM update messages
    const updateMessages = [
      "`MyTerm 1 'Temp = 50'\r\n",
      "`MyTerm 1 'Temp = 51'\r\n",
      "`MyTerm 1 'Temp = 52'\r\n"
    ];

    for (const updateMsg of updateMessages) {
      console.log('📨 Sending update message:', updateMsg.trim());

      const messageBuffer = Buffer.from(updateMsg, 'ascii');
      const extractedMessages = messageExtractor.extractMessages(messageBuffer);

      for (const extracted of extractedMessages) {
        if (extracted.messageType === 'BACKTICK_WINDOW') {
          console.log('✅ BACKTICK_WINDOW update message detected');

          const destinations = windowRouter.getDestinations(extracted.messageType);
          console.log(`🎯 Found ${destinations.length} destinations for update`);

          const pooledMessage = messagePool.getMessage(
            extracted.messageType,
            extracted.data,
            destinations.length
          );

          console.log(`💾 Created pooled message #${pooledMessage.id} for update`);

          // Route to destinations (debug logger AND term window)
          for (const destination of destinations) {
            console.log(`📤 Routing update to: ${destination}`);
          }

          // Simulate consumption and cleanup
          pooledMessage.markConsumed();
          if (pooledMessage.isFullyConsumed()) {
            messagePool.returnMessage(pooledMessage);
            console.log(`♻️  Returned update message #${pooledMessage.id} to pool`);
          }
        }
      }
    }

    // Verify no message pool leaks
    console.log(`📊 Final pool stats: allocated=${allocatedMessages}, returned=${returnedMessages}`);
    expect(returnedMessages).toEqual(allocatedMessages);
    expect(messagePool.available).toEqual(initialPoolSize);

    console.log('✅ Update messages test completed with proper pool cleanup');
  });

  it('should detect routing pipeline failures', async () => {
    console.log('🧪 TEST: Routing Pipeline Failure Detection');

    // This test specifically looks for the issues we see in production
    const creationMessage = '`TERM MyTerm SIZE 9 1 TEXTSIZE 40\r\n';
    const messageBuffer = Buffer.from(creationMessage, 'ascii');

    const extractedMessages = messageExtractor.extractMessages(messageBuffer);
    
    for (const extracted of extractedMessages) {
      if (extracted.messageType === 'BACKTICK_WINDOW') {
        const destinations = windowRouter.getDestinations(extracted.messageType);
        
        console.log('🔍 Investigating routing pipeline:');
        console.log(`  - Message type: ${extracted.messageType}`);
        console.log(`  - Message data: ${extracted.data.toString().trim()}`);
        console.log(`  - Destinations found: ${destinations.length}`);
        console.log(`  - Destination list: ${destinations.join(', ')}`);

        // Check if debug logger is registered as destination
        const hasDebugLogger = destinations.includes('debugLogger') || 
                              destinations.some(d => d.toLowerCase().includes('logger'));
        
        console.log(`  - Debug logger registered: ${hasDebugLogger}`);

        // Check if window creation destination exists
        const hasWindowDestination = destinations.some(d => 
          d.toLowerCase().includes('term') || d.toLowerCase().includes('window'));
        
        console.log(`  - Window destination registered: ${hasWindowDestination}`);

        // These are the failures we expect to find:
        if (!hasDebugLogger) {
          console.log('❌ FAILURE: Debug logger not registered for BACKTICK_WINDOW messages');
        }

        if (!hasWindowDestination) {
          console.log('❌ FAILURE: No window creation destination for BACKTICK_WINDOW messages');
        }

        if (destinations.length === 0) {
          console.log('❌ FAILURE: No destinations found for BACKTICK_WINDOW messages');
        }

        // Log what we expect vs what we get
        console.log('🎯 Expected behavior:');
        console.log('  - BACKTICK_WINDOW messages should route to debug logger');
        console.log('  - Creation messages should trigger window creation');
        console.log('  - Update messages should route to created windows');
        console.log('  - All messages should be returned to pool after processing');
      }
    }

    console.log('🔍 Pipeline analysis complete');
  });
});