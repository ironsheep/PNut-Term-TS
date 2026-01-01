/** @format */

// tests/messageRouter.test.ts
// Comprehensive tests for MessageRouter

import { MessageRouter, RouteDestination } from '../src/classes/shared/messageRouter';
import { SharedMessagePool, SharedMessageType, ExtractedMessage } from '../src/classes/shared/sharedMessagePool';

describe('MessageRouter', () => {
  let router: MessageRouter;
  let pool: SharedMessagePool;
  let messagesReceived: Record<string, ExtractedMessage[]>;

  beforeEach(() => {
    router = new MessageRouter();
    pool = new SharedMessagePool();
    router.setSharedMessagePool(pool);
    messagesReceived = {};
  });

  afterEach(() => {
    pool.logFinalStats();
  });

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

  // Helper to create a message in the pool
  function createPoolMessage(type: SharedMessageType, data: Uint8Array): number {
    const slot = pool.acquire(data.length);
    if (slot === null) {
      throw new Error('Failed to acquire pool slot');
    }
    slot.writeType(type);
    slot.writeLength(data.length);
    slot.writeData(data);
    return slot.poolId;
  }

  describe('Destination Registration', () => {
    it('should register destinations for message types', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.TERMINAL_OUTPUT]).toHaveLength(1);
      expect(config[SharedMessageType.TERMINAL_OUTPUT]![0].name).toBe('TestDest');
    });

    it('should not register duplicate destinations', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.TERMINAL_OUTPUT]).toHaveLength(1);
    });

    it('should unregister destinations', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);
      router.unregisterDestination(SharedMessageType.TERMINAL_OUTPUT, 'TestDest');

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.TERMINAL_OUTPUT]).toHaveLength(0);
    });

    it('should register multiple destinations for same type', () => {
      const dest1 = createDestination('Dest1');
      const dest2 = createDestination('Dest2');

      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest2);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.TERMINAL_OUTPUT]).toHaveLength(2);
    });

    it('should register destinations for different types', () => {
      const dest1 = createDestination('TerminalDest');
      const dest2 = createDestination('CogDest');

      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(SharedMessageType.COG0_MESSAGE, dest2);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.TERMINAL_OUTPUT]).toHaveLength(1);
      expect(config[SharedMessageType.COG0_MESSAGE]).toHaveLength(1);
    });
  });

  describe('Message Routing', () => {
    it('should route message to registered destination', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);

      const data = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, data);

      router.routeFromPool(poolId);

      expect(messagesReceived['TestDest']).toHaveLength(1);
      expect(messagesReceived['TestDest'][0].type).toBe(SharedMessageType.TERMINAL_OUTPUT);
      expect(Array.from(messagesReceived['TestDest'][0].data)).toEqual([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
    });

    it('should route to multiple destinations', () => {
      const dest1 = createDestination('Dest1');
      const dest2 = createDestination('Dest2');

      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest2);

      const data = new Uint8Array([1, 2, 3]);
      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, data);

      router.routeFromPool(poolId);

      expect(messagesReceived['Dest1']).toHaveLength(1);
      expect(messagesReceived['Dest2']).toHaveLength(1);
    });

    it('should route different message types to appropriate destinations', () => {
      const termDest = createDestination('TerminalDest');
      const cogDest = createDestination('CogDest');

      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, termDest);
      router.registerDestination(SharedMessageType.COG0_MESSAGE, cogDest);

      const termPoolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([1]));
      const cogPoolId = createPoolMessage(SharedMessageType.COG0_MESSAGE, new Uint8Array([2]));

      router.routeFromPool(termPoolId);
      router.routeFromPool(cogPoolId);

      expect(messagesReceived['TerminalDest']).toHaveLength(1);
      expect(messagesReceived['CogDest']).toHaveLength(1);
      expect(messagesReceived['TerminalDest'][0].type).toBe(SharedMessageType.TERMINAL_OUTPUT);
      expect(messagesReceived['CogDest'][0].type).toBe(SharedMessageType.COG0_MESSAGE);
    });

    it('should handle messages with no registered destinations', () => {
      // No destinations registered
      const data = new Uint8Array([1, 2, 3]);
      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, data);

      // Should not throw
      expect(() => router.routeFromPool(poolId)).not.toThrow();
    });
  });

  describe('COG Message Routing', () => {
    it('should route COG0 through COG7 messages to correct destinations', () => {
      const cogTypes = [
        SharedMessageType.COG0_MESSAGE,
        SharedMessageType.COG1_MESSAGE,
        SharedMessageType.COG2_MESSAGE,
        SharedMessageType.COG3_MESSAGE,
        SharedMessageType.COG4_MESSAGE,
        SharedMessageType.COG5_MESSAGE,
        SharedMessageType.COG6_MESSAGE,
        SharedMessageType.COG7_MESSAGE
      ];

      cogTypes.forEach((cogType, index) => {
        const dest = createDestination(`Cog${index}Dest`);
        router.registerDestination(cogType, dest);
      });

      cogTypes.forEach((cogType, index) => {
        const poolId = createPoolMessage(cogType, new Uint8Array([index]));
        router.routeFromPool(poolId);
      });

      // Verify each destination received exactly one message with correct type
      cogTypes.forEach((cogType, index) => {
        expect(messagesReceived[`Cog${index}Dest`]).toHaveLength(1);
        expect(messagesReceived[`Cog${index}Dest`][0].type).toBe(cogType);
      });
    });
  });

  describe('Statistics', () => {
    it('should track routed message counts', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);

      for (let i = 0; i < 5; i++) {
        const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([i]));
        router.routeFromPool(poolId);
      }

      const stats = router.getStats();
      expect(stats.totalMessagesRouted).toBe(5);
      expect(stats.messagesRouted[SharedMessageType.TERMINAL_OUTPUT]).toBe(5);
    });

    it('should track per-destination counts', () => {
      const dest1 = createDestination('Dest1');
      const dest2 = createDestination('Dest2');

      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest2);

      for (let i = 0; i < 3; i++) {
        const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([i]));
        router.routeFromPool(poolId);
      }

      const stats = router.getStats();
      expect(stats.destinationCounts['Dest1']).toBe(3);
      expect(stats.destinationCounts['Dest2']).toBe(3);
    });

    it('should reset statistics', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);

      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([1]));
      router.routeFromPool(poolId);

      router.resetStats();

      const stats = router.getStats();
      expect(stats.totalMessagesRouted).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle destination handler errors gracefully', () => {
      const errorDest: RouteDestination = {
        name: 'ErrorDest',
        handler: () => {
          throw new Error('Handler error');
        }
      };

      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, errorDest);

      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([1]));

      // Should not throw
      expect(() => router.routeFromPool(poolId)).not.toThrow();

      // Should track routing error
      const stats = router.getStats();
      expect(stats.routingErrors).toBe(1);
    });

    it('should continue routing to other destinations after handler error', () => {
      const errorDest: RouteDestination = {
        name: 'ErrorDest',
        handler: () => {
          throw new Error('Handler error');
        }
      };
      const goodDest = createDestination('GoodDest');

      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, errorDest);
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, goodDest);

      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([1]));
      router.routeFromPool(poolId);

      // Good destination should still receive message
      expect(messagesReceived['GoodDest']).toHaveLength(1);
    });
  });

  describe('clearAllDestinations', () => {
    it('should remove all registered destinations', () => {
      const dest1 = createDestination('Dest1');
      const dest2 = createDestination('Dest2');

      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest1);
      router.registerDestination(SharedMessageType.COG0_MESSAGE, dest2);

      router.clearAllDestinations();

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.TERMINAL_OUTPUT] || []).toHaveLength(0);
      expect(config[SharedMessageType.COG0_MESSAGE] || []).toHaveLength(0);
    });
  });

  describe('Events', () => {
    it('should emit messageRouted event', (done) => {
      const dest = createDestination('TestDest');
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);

      router.on('messageRouted', (event) => {
        expect(event.destination).toBe('TestDest');
        expect(event.message.type).toBe(SharedMessageType.TERMINAL_OUTPUT);
        done();
      });

      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([1]));
      router.routeFromPool(poolId);
    });

    it('should emit destinationError event on handler failure', (done) => {
      const errorDest: RouteDestination = {
        name: 'ErrorDest',
        handler: () => {
          throw new Error('Test error');
        }
      };
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, errorDest);

      router.on('destinationError', (event) => {
        expect(event.destination).toBe('ErrorDest');
        expect(event.error).toBeDefined();
        done();
      });

      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([1]));
      router.routeFromPool(poolId);
    });

    it('should emit p2SystemReboot for P2_SYSTEM_INIT messages', (done) => {
      const dest = createDestination('SystemDest');
      router.registerDestination(SharedMessageType.P2_SYSTEM_INIT, dest);

      router.on('p2SystemReboot', (event) => {
        expect(event.timestamp).toBeDefined();
        done();
      });

      const poolId = createPoolMessage(SharedMessageType.P2_SYSTEM_INIT, new Uint8Array([0x49, 0x4E, 0x49, 0x54])); // "INIT"
      router.routeFromPool(poolId);
    });
  });

  describe('Pool Integration', () => {
    it('should release pool slot after routing', () => {
      const dest = createDestination('TestDest');
      router.registerDestination(SharedMessageType.TERMINAL_OUTPUT, dest);

      const initialStats = pool.getStats();

      const poolId = createPoolMessage(SharedMessageType.TERMINAL_OUTPUT, new Uint8Array([1, 2, 3]));
      router.routeFromPool(poolId);

      // Pool slot should be released (message routed and slot freed)
      // We can verify by checking we can still acquire slots
      const newSlot = pool.acquire(10);
      expect(newSlot).not.toBeNull();
      if (newSlot) pool.release(newSlot.poolId);
    });
  });
});
