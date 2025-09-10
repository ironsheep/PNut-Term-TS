/** @format */

// tests/messageRouter.test.ts

import { MessageRouter, RouteDestination } from '../src/classes/shared/messageRouter';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';
import { ExtractedMessage, MessageType } from '../src/classes/shared/messageExtractor';

describe('MessageRouter', () => {
  let inputQueue: DynamicQueue<ExtractedMessage>;
  let router: MessageRouter;
  let messagesReceived: Record<string, ExtractedMessage[]>;

  beforeEach(() => {
    inputQueue = new DynamicQueue<ExtractedMessage>();
    router = new MessageRouter(inputQueue);
    messagesReceived = {};
  });

  // Helper to create a test message
  function createMessage(type: MessageType, data: string, cogId?: number): ExtractedMessage {
    return {
      type,
      data: new Uint8Array(Buffer.from(data)),
      timestamp: Date.now(),
      confidence: 'DISTINCTIVE', // Default test confidence level
      metadata: cogId !== undefined ? { cogId } : undefined
    };
  }

  // Helper to create a test destination
  function createDestination(name: string): RouteDestination {
    messagesReceived[name] = [];
    return {
      name,
      handler: (msg) => {
        messagesReceived[name].push(msg as ExtractedMessage);
      }
    };
  }

  describe('Destination Registration', () => {
    it('should register destinations for message types', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);

      const config = router.getRoutingConfig();
      expect(config[MessageType.TERMINAL_OUTPUT]).toHaveLength(1);
      expect(config[MessageType.TERMINAL_OUTPUT][0].name).toBe('TestDest');
    });

    it('should not register duplicate destinations', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);

      const config = router.getRoutingConfig();
      expect(config[MessageType.TERMINAL_OUTPUT]).toHaveLength(1);
    });

    it('should unregister destinations', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);
      router.unregisterDestination(MessageType.TERMINAL_OUTPUT, 'TestDest');

      const config = router.getRoutingConfig();
      expect(config[MessageType.TERMINAL_OUTPUT]).toHaveLength(0);
    });

    it('should register multiple destinations for same type', () => {
      const dest1 = createDestination('Dest1');
      const dest2 = createDestination('Dest2');
      
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest2);

      const config = router.getRoutingConfig();
      expect(config[MessageType.TERMINAL_OUTPUT]).toHaveLength(2);
    });
  });

  describe('Message Routing', () => {
    it('should route messages to correct destination', (done) => {
      const textDest = createDestination('TextDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, textDest);

      const msg = createMessage(MessageType.TERMINAL_OUTPUT, 'Hello');
      inputQueue.enqueue(msg);

      router.processMessages();

      setTimeout(() => {
        expect(messagesReceived['TextDest']).toHaveLength(1);
        expect(messagesReceived['TextDest'][0].type).toBe(MessageType.TERMINAL_OUTPUT);
        done();
      }, 10);
    });

    it('should route to multiple destinations', (done) => {
      const dest1 = createDestination('Dest1');
      const dest2 = createDestination('Dest2');
      
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest2);

      const msg = createMessage(MessageType.TERMINAL_OUTPUT, 'Test');
      inputQueue.enqueue(msg);

      router.processMessages();

      setTimeout(() => {
        expect(messagesReceived['Dest1']).toHaveLength(1);
        expect(messagesReceived['Dest2']).toHaveLength(1);
        done();
      }, 10);
    });

    it('should copy messages for multiple destinations', (done) => {
      const dest1 = createDestination('Dest1');
      const dest2 = createDestination('Dest2');
      
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest2);

      const msg = createMessage(MessageType.TERMINAL_OUTPUT, 'Test');
      inputQueue.enqueue(msg);

      router.processMessages();

      setTimeout(() => {
        const msg1 = messagesReceived['Dest1'][0];
        const msg2 = messagesReceived['Dest2'][0];
        
        // Should be different objects
        expect(msg1).not.toBe(msg2);
        // But with same data
        expect(msg1.data).toEqual(msg2.data);
        // And data arrays should be different instances
        expect(msg1.data).not.toBe(msg2.data);
        done();
      }, 10);
    });

    it('should route different message types correctly', (done) => {
      const textDest = createDestination('TextDest');
      const initDest = createDestination('InitDest');
      const protoDest = createDestination('ProtoDest');
      
      router.registerDestination(MessageType.TERMINAL_OUTPUT, textDest);
      router.registerDestination(MessageType.P2_SYSTEM_INIT, initDest);
      router.registerDestination(MessageType.DEBUGGER_416BYTE, protoDest);

      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'text'));
      inputQueue.enqueue(createMessage(MessageType.P2_SYSTEM_INIT, 'init'));
      inputQueue.enqueue(createMessage(MessageType.DEBUGGER_416BYTE, 'proto'));

      router.processMessages();

      setTimeout(() => {
        expect(messagesReceived['TextDest']).toHaveLength(1);
        expect(messagesReceived['InitDest']).toHaveLength(1);
        expect(messagesReceived['ProtoDest']).toHaveLength(1);
        done();
      }, 10);
    });
  });

  describe('Async Processing', () => {
    it('should process messages asynchronously', (done) => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);

      // Add multiple messages
      for (let i = 0; i < 10; i++) {
        inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, `Message ${i}`));
      }

      router.processMessages();

      // Messages should not be processed immediately
      expect(messagesReceived['TestDest']).toHaveLength(0);

      // But should be processed after setImmediate
      setImmediate(() => {
        expect(messagesReceived['TestDest']).toHaveLength(10);
        done();
      });
    });

    it('should not process if already processing', () => {
      const result1 = router.processMessages();
      const result2 = router.processMessages();

      expect(result1).toBe(false); // Empty queue
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'test'));
      
      const result3 = router.processMessages();
      expect(result3).toBe(true);
      
      const result4 = router.processMessages();
      expect(result4).toBe(false); // Already processing
    });

    it('should process large batches', (done) => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);

      // Add 150 messages (more than batch size)
      for (let i = 0; i < 150; i++) {
        inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, `Msg${i}`));
      }

      router.processMessages();

      // Wait for multiple batches to complete
      setTimeout(() => {
        expect(messagesReceived['TestDest']).toHaveLength(150);
        done();
      }, 50);
    });
  });

  describe('Standard Routing', () => {
    it('should apply standard routing configuration', () => {
      const debugLogger = createDestination('DebugLogger');
      const windowCreator = createDestination('WindowCreator');
      const debuggerWindow = createDestination('DebuggerWindow');

      router.applyStandardRouting(debugLogger, windowCreator, debuggerWindow);

      const config = router.getRoutingConfig();
      
      // Text goes to DebugLogger
      expect(config[MessageType.TERMINAL_OUTPUT]).toHaveLength(1);
      expect(config[MessageType.TERMINAL_OUTPUT][0].name).toBe('DebugLogger');

      // Init goes to both WindowCreator and DebugLogger
      expect(config[MessageType.P2_SYSTEM_INIT]).toHaveLength(2);
      
      // Protocol goes to DebuggerWindow
      expect(config[MessageType.DEBUGGER_416BYTE]).toHaveLength(1);
      expect(config[MessageType.DEBUGGER_416BYTE][0].name).toBe('DebuggerWindow');

      // Unknown binary goes to DebugLogger
      expect(config[MessageType.DB_PACKET]).toHaveLength(1);
      expect(config[MessageType.DB_PACKET][0].name).toBe('DebugLogger');
    });
  });

  describe('Error Handling', () => {
    it('should handle destination errors', (done) => {
      const errorDest: RouteDestination = {
        name: 'ErrorDest',
        handler: () => {
          throw new Error('Test error');
        }
      };

      const errorSpy = jest.fn();
      router.on('destinationError', errorSpy);

      router.registerDestination(MessageType.TERMINAL_OUTPUT, errorDest);
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'test'));

      router.processMessages();

      setTimeout(() => {
        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0][0].destination).toBe('ErrorDest');
        done();
      }, 10);
    });

    it('should handle unroutable messages', (done) => {
      const unroutableSpy = jest.fn();
      router.on('unroutableMessage', unroutableSpy);

      // No destinations registered
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'test'));
      router.processMessages();

      setTimeout(() => {
        expect(unroutableSpy).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should continue processing after errors', (done) => {
      const errorDest: RouteDestination = {
        name: 'ErrorDest',
        handler: (msg) => {
          if (Buffer.from(msg.data).toString() === 'error') {
            throw new Error('Test error');
          }
          messagesReceived['ErrorDest'] = messagesReceived['ErrorDest'] || [];
          messagesReceived['ErrorDest'].push(msg as ExtractedMessage);
        }
      };

      router.registerDestination(MessageType.TERMINAL_OUTPUT, errorDest);
      
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'ok1'));
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'error'));
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'ok2'));

      router.processMessages();

      setTimeout(() => {
        expect(messagesReceived['ErrorDest']).toHaveLength(2);
        done();
      }, 10);
    });
  });

  describe('Queue Management', () => {
    it('should wait for queue to drain', async () => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);

      // Add messages
      for (let i = 0; i < 5; i++) {
        inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, `Msg${i}`));
      }

      router.processMessages();

      const drained = await router.waitForQueueDrain(1000);
      expect(drained).toBe(true);
      expect(router.isIdle()).toBe(true);
    });

    it('should timeout if queue does not drain', async () => {
      // Create a destination that delays processing
      const slowDest: RouteDestination = {
        name: 'SlowDest',
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      };

      router.registerDestination(MessageType.TERMINAL_OUTPUT, slowDest);
      
      // Add many messages
      for (let i = 0; i < 100; i++) {
        inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'test'));
      }

      router.processMessages();

      const drained = await router.waitForQueueDrain(50);
      expect(drained).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track routing statistics', (done) => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);
      router.registerDestination(MessageType.P2_SYSTEM_INIT, dest);

      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'text1'));
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'text2'));
      inputQueue.enqueue(createMessage(MessageType.P2_SYSTEM_INIT, 'init'));

      router.processMessages();

      setTimeout(() => {
        const stats = router.getStats();
        expect(stats.messagesRouted[MessageType.TERMINAL_OUTPUT]).toBe(2);
        expect(stats.messagesRouted[MessageType.P2_SYSTEM_INIT]).toBe(1);
        expect(stats.destinationCounts['TestDest']).toBe(3);
        expect(stats.totalMessagesRouted).toBe(3);
        done();
      }, 10);
    });

    it('should track routing errors', (done) => {
      const errorDest: RouteDestination = {
        name: 'ErrorDest',
        handler: () => {
          throw new Error('Test');
        }
      };

      router.registerDestination(MessageType.TERMINAL_OUTPUT, errorDest);
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'test'));
      
      router.processMessages();

      setTimeout(() => {
        const stats = router.getStats();
        expect(stats.routingErrors).toBe(1);
        done();
      }, 10);
    });

    it('should reset statistics', (done) => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);
      
      inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, 'test'));
      router.processMessages();

      setTimeout(() => {
        router.resetStats();
        const stats = router.getStats();
        expect(stats.messagesRouted[MessageType.TERMINAL_OUTPUT]).toBe(0);
        expect(stats.destinationCounts['TestDest']).toBe(0);
        expect(stats.routingErrors).toBe(0);
        done();
      }, 10);
    });
  });

  describe('Events', () => {
    it('should emit batchProcessed event', (done) => {
      const batchSpy = jest.fn();
      router.on('batchProcessed', batchSpy);

      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);

      for (let i = 0; i < 5; i++) {
        inputQueue.enqueue(createMessage(MessageType.TERMINAL_OUTPUT, `Msg${i}`));
      }

      router.processMessages();

      setTimeout(() => {
        expect(batchSpy).toHaveBeenCalledWith(5);
        done();
      }, 10);
    });

    it('should emit messageRouted event', (done) => {
      const routedSpy = jest.fn();
      router.on('messageRouted', routedSpy);

      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);

      const msg = createMessage(MessageType.TERMINAL_OUTPUT, 'test');
      inputQueue.enqueue(msg);

      router.processMessages();

      setTimeout(() => {
        expect(routedSpy).toHaveBeenCalled();
        expect(routedSpy.mock.calls[0][0].destination).toBe('TestDest');
        done();
      }, 10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue', () => {
      const result = router.processMessages();
      expect(result).toBe(false);
    });

    it('should clear all destinations', () => {
      const dest1 = createDestination('Dest1');
      const dest2 = createDestination('Dest2');
      
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(MessageType.P2_SYSTEM_INIT, dest2);

      router.clearAllDestinations();

      const config = router.getRoutingConfig();
      expect(config[MessageType.TERMINAL_OUTPUT]).toHaveLength(0);
      expect(config[MessageType.P2_SYSTEM_INIT]).toHaveLength(0);
    });

    it('should handle message with undefined metadata', (done) => {
      const dest = createDestination('TestDest');
      router.registerDestination(MessageType.TERMINAL_OUTPUT, dest);

      const msg: ExtractedMessage = {
        type: MessageType.TERMINAL_OUTPUT,
        data: new Uint8Array([1, 2, 3]),
        timestamp: Date.now(),
        confidence: 'DEFAULT',
        metadata: undefined
      };

      inputQueue.enqueue(msg);
      router.processMessages();

      setTimeout(() => {
        expect(messagesReceived['TestDest']).toHaveLength(1);
        expect(messagesReceived['TestDest'][0].metadata).toBeUndefined();
        done();
      }, 10);
    });
  });
});