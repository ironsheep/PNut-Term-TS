/** @format */

// tests/messageClassificationRouting.test.ts

import { MessageRouter, RouteDestination } from '../src/classes/shared/messageRouter';
import { SharedMessagePool, SharedMessageType, ExtractedMessage } from '../src/classes/shared/sharedMessagePool';

/**
 * MESSAGE CLASSIFICATION AND ROUTING VALIDATION
 *
 * Tests the MessageRouter component with the current architecture:
 * SharedMessagePool → MessageRouter → Destination Handlers
 *
 * CRITICAL FUNCTIONALITY:
 * - Verify messages route to correct destinations based on SharedMessageType
 * - Validate COG-specific routing (COG0-7 messages to specific handlers)
 * - Validate debugger packet routing (DEBUGGER0-7_416BYTE to debugger windows)
 * - Validate DB_PACKET, P2_SYSTEM_INIT, BACKTICK commands routing
 * - Ensure proper reference counting and pool cleanup
 * - Verify routing statistics and error handling
 */

describe('Message Classification and Routing', () => {
  let pool: SharedMessagePool;
  let router: MessageRouter;
  let routedMessages: Record<string, ExtractedMessage[]>;

  beforeEach(() => {
    pool = new SharedMessagePool();
    router = new MessageRouter();
    router.setSharedMessagePool(pool);
    routedMessages = {};
  });

  // Helper to create routing destinations
  function createDestination(name: string): RouteDestination {
    routedMessages[name] = [];
    return {
      name,
      handler: (msg: ExtractedMessage) => {
        routedMessages[name].push(msg);
      }
    };
  }

  // Helper to create and route a message
  function createAndRouteMessage(type: SharedMessageType, data: Uint8Array): number {
    const slot = pool.acquire(data.length);
    expect(slot).not.toBeNull();

    slot!.writeType(type);
    slot!.writeLength(data.length);
    slot!.writeData(data);
    slot!.setRefCount(1);

    const poolId = slot!.poolId;
    router.routeFromPool(poolId);

    return poolId;
  }

  describe('Destination Registration', () => {
    it('should register destination for COG0_MESSAGE', () => {
      const cog0Handler = createDestination('COG0Window');
      router.registerDestination(SharedMessageType.COG0_MESSAGE, cog0Handler);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.COG0_MESSAGE]).toHaveLength(1);
      expect(config[SharedMessageType.COG0_MESSAGE]![0].name).toBe('COG0Window');
    });

    it('should register destination for DEBUGGER0_416BYTE', () => {
      const debugHandler = createDestination('Debugger0');
      router.registerDestination(SharedMessageType.DEBUGGER0_416BYTE, debugHandler);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.DEBUGGER0_416BYTE]).toHaveLength(1);
      expect(config[SharedMessageType.DEBUGGER0_416BYTE]![0].name).toBe('Debugger0');
    });

    it('should register destination for DB_PACKET', () => {
      const dbHandler = createDestination('DBHandler');
      router.registerDestination(SharedMessageType.DB_PACKET, dbHandler);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.DB_PACKET]).toHaveLength(1);
      expect(config[SharedMessageType.DB_PACKET]![0].name).toBe('DBHandler');
    });

    it('should register multiple destinations for same message type', () => {
      const logger = createDestination('Logger');
      const display = createDestination('Display');

      router.registerDestination(SharedMessageType.COG1_MESSAGE, logger);
      router.registerDestination(SharedMessageType.COG1_MESSAGE, display);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.COG1_MESSAGE]).toHaveLength(2);
    });

    it('should not register duplicate destination', () => {
      const handler = createDestination('Handler');

      router.registerDestination(SharedMessageType.COG2_MESSAGE, handler);
      router.registerDestination(SharedMessageType.COG2_MESSAGE, handler);

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.COG2_MESSAGE]).toHaveLength(1);
    });
  });

  describe('COG Message Routing', () => {
    beforeEach(() => {
      // Register COG-specific handlers
      for (let i = 0; i < 8; i++) {
        const cogType = (SharedMessageType.COG0_MESSAGE + i) as SharedMessageType;
        router.registerDestination(cogType, createDestination(`COG${i}Window`));
      }
      // Also register logger for all COG messages
      const logger = createDestination('Logger');
      for (let i = 0; i < 8; i++) {
        const cogType = (SharedMessageType.COG0_MESSAGE + i) as SharedMessageType;
        router.registerDestination(cogType, logger);
      }
    });

    it('should route COG0_MESSAGE to COG0 window and logger', () => {
      const data = new TextEncoder().encode('Cog0 message\r\n');
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);

      expect(routedMessages['COG0Window']).toHaveLength(1);
      expect(routedMessages['Logger']).toHaveLength(1);

      const routed = routedMessages['COG0Window'][0];
      expect(routed.type).toBe(SharedMessageType.COG0_MESSAGE);
      expect(new TextDecoder().decode(routed.data)).toBe('Cog0 message\r\n');
    });

    it('should route COG3_MESSAGE to COG3 window and logger', () => {
      const data = new TextEncoder().encode('Cog3 debug output\r\n');
      createAndRouteMessage(SharedMessageType.COG3_MESSAGE, data);

      expect(routedMessages['COG3Window']).toHaveLength(1);
      expect(routedMessages['Logger']).toHaveLength(1);

      const routed = routedMessages['COG3Window'][0];
      expect(routed.type).toBe(SharedMessageType.COG3_MESSAGE);
    });

    it('should route COG7_MESSAGE to COG7 window and logger', () => {
      const data = new TextEncoder().encode('Cog7 last cog\r\n');
      createAndRouteMessage(SharedMessageType.COG7_MESSAGE, data);

      expect(routedMessages['COG7Window']).toHaveLength(1);
      expect(routedMessages['Logger']).toHaveLength(1);
    });

    it('should not cross-route between COG windows', () => {
      const cog0Data = new TextEncoder().encode('From COG0\r\n');
      const cog1Data = new TextEncoder().encode('From COG1\r\n');

      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, cog0Data);
      createAndRouteMessage(SharedMessageType.COG1_MESSAGE, cog1Data);

      // COG0 window should only have COG0 message
      expect(routedMessages['COG0Window']).toHaveLength(1);
      expect(routedMessages['COG0Window'][0].type).toBe(SharedMessageType.COG0_MESSAGE);

      // COG1 window should only have COG1 message
      expect(routedMessages['COG1Window']).toHaveLength(1);
      expect(routedMessages['COG1Window'][0].type).toBe(SharedMessageType.COG1_MESSAGE);

      // Logger should have both
      expect(routedMessages['Logger']).toHaveLength(2);
    });
  });

  describe('Debugger Packet Routing', () => {
    beforeEach(() => {
      // Register debugger-specific handlers
      for (let i = 0; i < 8; i++) {
        const debugType = (SharedMessageType.DEBUGGER0_416BYTE + i) as SharedMessageType;
        router.registerDestination(debugType, createDestination(`Debugger${i}`));
      }
      // Also register logger
      const logger = createDestination('Logger');
      for (let i = 0; i < 8; i++) {
        const debugType = (SharedMessageType.DEBUGGER0_416BYTE + i) as SharedMessageType;
        router.registerDestination(debugType, logger);
      }
    });

    it('should route DEBUGGER0_416BYTE to debugger window and logger', () => {
      const data = new Uint8Array(416);
      data[0] = 0x00; // COG 0 marker
      data.fill(0xFF, 1, 416);

      createAndRouteMessage(SharedMessageType.DEBUGGER0_416BYTE, data);

      expect(routedMessages['Debugger0']).toHaveLength(1);
      expect(routedMessages['Logger']).toHaveLength(1);

      const routed = routedMessages['Debugger0'][0];
      expect(routed.type).toBe(SharedMessageType.DEBUGGER0_416BYTE);
      expect(routed.data.length).toBe(416);
    });

    it('should route DEBUGGER5_416BYTE to correct debugger window', () => {
      const data = new Uint8Array(416);
      data[0] = 0x05; // COG 5 marker

      createAndRouteMessage(SharedMessageType.DEBUGGER5_416BYTE, data);

      expect(routedMessages['Debugger5']).toHaveLength(1);
      expect(routedMessages['Logger']).toHaveLength(1);

      // Other debugger windows should be empty
      expect(routedMessages['Debugger0'] || []).toHaveLength(0);
      expect(routedMessages['Debugger4'] || []).toHaveLength(0);
    });

    it('should not cross-route between debugger windows', () => {
      const data0 = new Uint8Array(416);
      data0.fill(0x00);

      const data7 = new Uint8Array(416);
      data7.fill(0x07);

      createAndRouteMessage(SharedMessageType.DEBUGGER0_416BYTE, data0);
      createAndRouteMessage(SharedMessageType.DEBUGGER7_416BYTE, data7);

      expect(routedMessages['Debugger0']).toHaveLength(1);
      expect(routedMessages['Debugger7']).toHaveLength(1);
      expect(routedMessages['Logger']).toHaveLength(2);
    });
  });

  describe('Special Message Type Routing', () => {
    it('should route DB_PACKET messages', () => {
      const dbHandler = createDestination('DBHandler');
      router.registerDestination(SharedMessageType.DB_PACKET, dbHandler);

      const data = new TextEncoder().encode('\xDBPacket data');
      createAndRouteMessage(SharedMessageType.DB_PACKET, data);

      expect(routedMessages['DBHandler']).toHaveLength(1);
      expect(routedMessages['DBHandler'][0].type).toBe(SharedMessageType.DB_PACKET);
    });

    it('should route P2_SYSTEM_INIT messages', () => {
      const initHandler = createDestination('InitHandler');
      router.registerDestination(SharedMessageType.P2_SYSTEM_INIT, initHandler);

      const data = new TextEncoder().encode('Cog0 INIT $0000_0000 $0000_0000 load\r\n');
      createAndRouteMessage(SharedMessageType.P2_SYSTEM_INIT, data);

      expect(routedMessages['InitHandler']).toHaveLength(1);
      expect(routedMessages['InitHandler'][0].type).toBe(SharedMessageType.P2_SYSTEM_INIT);
    });

    it('should route BACKTICK_LOGIC commands', () => {
      const logicHandler = createDestination('LogicWindow');
      router.registerDestination(SharedMessageType.BACKTICK_LOGIC, logicHandler);

      const data = new TextEncoder().encode('`logic command data');
      createAndRouteMessage(SharedMessageType.BACKTICK_LOGIC, data);

      expect(routedMessages['LogicWindow']).toHaveLength(1);
      expect(routedMessages['LogicWindow'][0].type).toBe(SharedMessageType.BACKTICK_LOGIC);
    });

    it('should route BACKTICK_SCOPE commands', () => {
      const scopeHandler = createDestination('ScopeWindow');
      router.registerDestination(SharedMessageType.BACKTICK_SCOPE, scopeHandler);

      const data = new TextEncoder().encode('`scope command data');
      createAndRouteMessage(SharedMessageType.BACKTICK_SCOPE, data);

      expect(routedMessages['ScopeWindow']).toHaveLength(1);
    });

    it('should route BACKTICK_FFT commands', () => {
      const fftHandler = createDestination('FFTWindow');
      router.registerDestination(SharedMessageType.BACKTICK_FFT, fftHandler);

      const data = new TextEncoder().encode('`fft command data');
      createAndRouteMessage(SharedMessageType.BACKTICK_FFT, data);

      expect(routedMessages['FFTWindow']).toHaveLength(1);
    });

    it('should route BACKTICK_BITMAP commands', () => {
      const bitmapHandler = createDestination('BitmapWindow');
      router.registerDestination(SharedMessageType.BACKTICK_BITMAP, bitmapHandler);

      const data = new TextEncoder().encode('`bitmap command data');
      createAndRouteMessage(SharedMessageType.BACKTICK_BITMAP, data);

      expect(routedMessages['BitmapWindow']).toHaveLength(1);
    });
  });

  describe('Multiple Destination Routing', () => {
    it('should route to all registered destinations', () => {
      const logger = createDestination('Logger');
      const display = createDestination('Display');
      const recorder = createDestination('Recorder');

      router.registerDestination(SharedMessageType.COG1_MESSAGE, logger);
      router.registerDestination(SharedMessageType.COG1_MESSAGE, display);
      router.registerDestination(SharedMessageType.COG1_MESSAGE, recorder);

      const data = new TextEncoder().encode('Multi-destination message\r\n');
      createAndRouteMessage(SharedMessageType.COG1_MESSAGE, data);

      expect(routedMessages['Logger']).toHaveLength(1);
      expect(routedMessages['Display']).toHaveLength(1);
      expect(routedMessages['Recorder']).toHaveLength(1);

      // All should have same message
      expect(routedMessages['Logger'][0].type).toBe(SharedMessageType.COG1_MESSAGE);
      expect(routedMessages['Display'][0].type).toBe(SharedMessageType.COG1_MESSAGE);
      expect(routedMessages['Recorder'][0].type).toBe(SharedMessageType.COG1_MESSAGE);
    });

    it('should handle independent routing for different message types', () => {
      const cog0Handler = createDestination('COG0');
      const cog1Handler = createDestination('COG1');
      const logger = createDestination('Logger');

      router.registerDestination(SharedMessageType.COG0_MESSAGE, cog0Handler);
      router.registerDestination(SharedMessageType.COG0_MESSAGE, logger);
      router.registerDestination(SharedMessageType.COG1_MESSAGE, cog1Handler);
      router.registerDestination(SharedMessageType.COG1_MESSAGE, logger);

      const data0 = new TextEncoder().encode('From COG0\r\n');
      const data1 = new TextEncoder().encode('From COG1\r\n');

      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data0);
      createAndRouteMessage(SharedMessageType.COG1_MESSAGE, data1);

      expect(routedMessages['COG0']).toHaveLength(1);
      expect(routedMessages['COG1']).toHaveLength(1);
      expect(routedMessages['Logger']).toHaveLength(2);
    });
  });

  describe('Routing Statistics', () => {
    it('should track message routing counts', () => {
      const handler = createDestination('Handler');
      router.registerDestination(SharedMessageType.COG0_MESSAGE, handler);

      const data = new TextEncoder().encode('Test\r\n');
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);

      const stats = router.getStats();
      expect(stats.messagesRouted[SharedMessageType.COG0_MESSAGE]).toBe(3);
      expect(stats.destinationCounts['Handler']).toBe(3);
      expect(stats.totalMessagesRouted).toBe(3);
    });

    it('should track routing to multiple destinations', () => {
      const logger = createDestination('Logger');
      const display = createDestination('Display');

      router.registerDestination(SharedMessageType.COG1_MESSAGE, logger);
      router.registerDestination(SharedMessageType.COG1_MESSAGE, display);

      const data = new TextEncoder().encode('Test\r\n');
      createAndRouteMessage(SharedMessageType.COG1_MESSAGE, data);

      const stats = router.getStats();
      expect(stats.messagesRouted[SharedMessageType.COG1_MESSAGE]).toBe(1);
      expect(stats.destinationCounts['Logger']).toBe(1);
      expect(stats.destinationCounts['Display']).toBe(1);
      expect(stats.totalMessagesRouted).toBe(1);
    });

    it('should reset statistics', () => {
      const handler = createDestination('Handler');
      router.registerDestination(SharedMessageType.COG0_MESSAGE, handler);

      const data = new TextEncoder().encode('Test\r\n');
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);

      router.resetStats();
      const stats = router.getStats();

      expect(stats.messagesRouted[SharedMessageType.COG0_MESSAGE]).toBe(0);
      expect(stats.destinationCounts['Handler']).toBe(0);
      expect(stats.totalMessagesRouted).toBe(0);
    });
  });

  describe('Unregistration', () => {
    it('should unregister destination', () => {
      const handler = createDestination('Handler');
      router.registerDestination(SharedMessageType.COG0_MESSAGE, handler);

      let config = router.getRoutingConfig();
      expect(config[SharedMessageType.COG0_MESSAGE]).toHaveLength(1);

      router.unregisterDestination(SharedMessageType.COG0_MESSAGE, 'Handler');

      config = router.getRoutingConfig();
      expect(config[SharedMessageType.COG0_MESSAGE] || []).toHaveLength(0);
    });

    it('should handle unregistering non-existent destination gracefully', () => {
      router.unregisterDestination(SharedMessageType.COG0_MESSAGE, 'NonExistent');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should only unregister specified destination', () => {
      const handler1 = createDestination('Handler1');
      const handler2 = createDestination('Handler2');

      router.registerDestination(SharedMessageType.COG0_MESSAGE, handler1);
      router.registerDestination(SharedMessageType.COG0_MESSAGE, handler2);

      router.unregisterDestination(SharedMessageType.COG0_MESSAGE, 'Handler1');

      const config = router.getRoutingConfig();
      expect(config[SharedMessageType.COG0_MESSAGE]).toHaveLength(1);
      expect(config[SharedMessageType.COG0_MESSAGE]![0].name).toBe('Handler2');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing destinations gracefully', () => {
      // Don't register any destinations
      const data = new TextEncoder().encode('Orphan message\r\n');

      // Should not throw
      expect(() => {
        createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);
      }).not.toThrow();

      const stats = router.getStats();
      // Message should not be counted as routed
      expect(stats.totalMessagesRouted).toBe(0);
    });

    it('should track routing errors when handler throws', () => {
      const errorHandler: RouteDestination = {
        name: 'ErrorHandler',
        handler: () => {
          throw new Error('Handler error');
        }
      };

      router.registerDestination(SharedMessageType.COG0_MESSAGE, errorHandler);

      const data = new TextEncoder().encode('Test\r\n');
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);

      const stats = router.getStats();
      expect(stats.routingErrors).toBe(1);
    });

    it('should continue routing to other handlers even if one fails', () => {
      const errorHandler: RouteDestination = {
        name: 'ErrorHandler',
        handler: () => {
          throw new Error('Handler error');
        }
      };
      const goodHandler = createDestination('GoodHandler');

      router.registerDestination(SharedMessageType.COG0_MESSAGE, errorHandler);
      router.registerDestination(SharedMessageType.COG0_MESSAGE, goodHandler);

      const data = new TextEncoder().encode('Test\r\n');
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);

      expect(routedMessages['GoodHandler']).toHaveLength(1);

      const stats = router.getStats();
      expect(stats.routingErrors).toBe(1);
    });
  });

  describe('Message Data Integrity', () => {
    it('should preserve message data content', () => {
      const handler = createDestination('Handler');
      router.registerDestination(SharedMessageType.COG0_MESSAGE, handler);

      const originalData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, originalData);

      expect(routedMessages['Handler']).toHaveLength(1);
      const routed = routedMessages['Handler'][0];
      expect(Array.from(routed.data)).toEqual(Array.from(originalData));
    });

    it('should include timestamp in routed message', () => {
      const handler = createDestination('Handler');
      router.registerDestination(SharedMessageType.COG0_MESSAGE, handler);

      const beforeTime = Date.now();
      const data = new TextEncoder().encode('Test\r\n');
      createAndRouteMessage(SharedMessageType.COG0_MESSAGE, data);
      const afterTime = Date.now();

      const routed = routedMessages['Handler'][0];
      expect(routed.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(routed.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve message type in routed message', () => {
      const handler = createDestination('Handler');
      router.registerDestination(SharedMessageType.COG3_MESSAGE, handler);

      const data = new TextEncoder().encode('COG3 data\r\n');
      createAndRouteMessage(SharedMessageType.COG3_MESSAGE, data);

      const routed = routedMessages['Handler'][0];
      expect(routed.type).toBe(SharedMessageType.COG3_MESSAGE);
    });
  });
});
