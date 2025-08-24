/** @format */

// tests/dtrResetManager.test.ts

import { DTRResetManager } from '../src/classes/shared/dtrResetManager';
import { MessageRouter } from '../src/classes/shared/messageRouter';
import { DynamicQueue } from '../src/classes/shared/dynamicQueue';
import { ExtractedMessage, MessageType } from '../src/classes/shared/messageExtractor';

describe('DTRResetManager', () => {
  let router: MessageRouter;
  let dtrManager: DTRResetManager;
  let inputQueue: DynamicQueue<ExtractedMessage>;

  beforeEach(() => {
    inputQueue = new DynamicQueue<ExtractedMessage>();
    router = new MessageRouter(inputQueue);
    dtrManager = new DTRResetManager(router);
  });

  // Helper to create test message
  function createMessage(type: MessageType, data: string, timestamp?: number): ExtractedMessage {
    return {
      type,
      data: new Uint8Array(Buffer.from(data)),
      timestamp: timestamp || Date.now(),
      metadata: undefined
    };
  }

  describe('Reset Detection', () => {
    it('should handle DTR reset', async () => {
      const resetSpy = jest.fn();
      dtrManager.on('resetDetected', resetSpy);

      await dtrManager.onDTRReset();

      expect(resetSpy).toHaveBeenCalled();
      expect(resetSpy.mock.calls[0][0].type).toBe('DTR');
    });

    it('should handle RTS reset', async () => {
      const resetSpy = jest.fn();
      dtrManager.on('resetDetected', resetSpy);

      await dtrManager.onRTSReset();

      expect(resetSpy).toHaveBeenCalled();
      expect(resetSpy.mock.calls[0][0].type).toBe('RTS');
    });

    it('should increment sequence number for each reset', async () => {
      await dtrManager.onDTRReset();
      const reset1 = dtrManager.getCurrentReset();
      
      await dtrManager.onRTSReset();
      const reset2 = dtrManager.getCurrentReset();

      expect(reset2!.sequenceNumber).toBe(reset1!.sequenceNumber + 1);
    });

    it('should mark reset pending during processing', async () => {
      const resetPromise = dtrManager.onDTRReset();
      
      // Should be pending immediately
      expect(dtrManager.isResetPending()).toBe(true);
      
      await resetPromise;
      
      // Should not be pending after completion
      expect(dtrManager.isResetPending()).toBe(false);
    });
  });

  describe('Boundary Marking', () => {
    it('should mark boundary in message stream', async () => {
      const beforeTime = Date.now() - 1000;
      const afterTime = Date.now() + 1000;

      await dtrManager.onDTRReset();

      // Messages before reset
      expect(dtrManager.isMessageBeforeReset(beforeTime)).toBe(true);
      
      // Messages after reset
      expect(dtrManager.isMessageBeforeReset(afterTime)).toBe(false);
    });

    it('should store boundary markers', async () => {
      await dtrManager.onDTRReset();
      const reset1 = dtrManager.getCurrentReset()!;
      
      await dtrManager.onRTSReset();
      const reset2 = dtrManager.getCurrentReset()!;

      const marker1 = dtrManager.getBoundaryMarker(reset1.sequenceNumber);
      const marker2 = dtrManager.getBoundaryMarker(reset2.sequenceNumber);

      expect(marker1).toBeDefined();
      expect(marker2).toBeDefined();
      expect(marker1!.type).toBe('DTR');
      expect(marker2!.type).toBe('RTS');
    });

    it('should return all boundaries', async () => {
      await dtrManager.onDTRReset();
      await dtrManager.onRTSReset();
      await dtrManager.onDTRReset();

      const boundaries = dtrManager.getAllBoundaries();
      expect(boundaries).toHaveLength(3);
    });

    it('should prune old boundaries', async () => {
      // Create many boundaries
      for (let i = 0; i < 15; i++) {
        await dtrManager.onDTRReset();
      }

      expect(dtrManager.getAllBoundaries().length).toBe(15);

      // Prune to keep only 5
      dtrManager.pruneOldBoundaries(5);

      expect(dtrManager.getAllBoundaries().length).toBe(5);
    });
  });

  describe('Queue Draining', () => {
    it('should wait for router queue to drain', async () => {
      // Add messages to queue
      for (let i = 0; i < 5; i++) {
        inputQueue.enqueue(createMessage(MessageType.TEXT, `Message ${i}`));
      }

      // Start processing
      router.processMessages();

      // Reset should wait for drain
      await dtrManager.onDTRReset();

      // Queue should be empty after reset
      expect(router.isIdle()).toBe(true);
    });

    it('should emit drain timeout if queue does not drain', async () => {
      // Create a slow destination that blocks processing
      const slowDestination = {
        name: 'SlowDest',
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      };

      router.registerDestination(MessageType.TEXT, slowDestination);

      // Fill queue
      for (let i = 0; i < 100; i++) {
        inputQueue.enqueue(createMessage(MessageType.TEXT, 'test'));
      }

      router.processMessages();

      const timeoutSpy = jest.fn();
      dtrManager.on('drainTimeout', timeoutSpy);

      // Use a short timeout for testing
      const manager = new DTRResetManager(router);
      manager.on('drainTimeout', timeoutSpy);
      
      // This should timeout quickly
      jest.setTimeout(6000);
      await manager.onDTRReset();

      // Timeout event should have been emitted
      expect(timeoutSpy).toHaveBeenCalled();
    }, 10000);

    it('should process all messages before reset', async () => {
      const processedMessages: ExtractedMessage[] = [];
      const destination = {
        name: 'TestDest',
        handler: (msg: ExtractedMessage) => {
          processedMessages.push(msg);
        }
      };

      router.registerDestination(MessageType.TEXT, destination);

      // Add messages before reset
      const beforeMessages = [];
      for (let i = 0; i < 3; i++) {
        const msg = createMessage(MessageType.TEXT, `Before ${i}`, Date.now() - 1000);
        beforeMessages.push(msg);
        inputQueue.enqueue(msg);
      }

      router.processMessages();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Do reset
      await dtrManager.onDTRReset();

      // All before messages should be processed
      expect(processedMessages.length).toBe(3);
    });
  });

  describe('Log Rotation', () => {
    it('should emit rotateLog event after queue drain', async () => {
      const rotateSpy = jest.fn();
      dtrManager.on('rotateLog', rotateSpy);

      await dtrManager.onDTRReset();

      expect(rotateSpy).toHaveBeenCalled();
      expect(rotateSpy.mock.calls[0][0].type).toBe('DTR');
    });

    it('should emit rotateLog with correct reset event data', async () => {
      const rotateSpy = jest.fn();
      dtrManager.on('rotateLog', rotateSpy);

      await dtrManager.onRTSReset();

      const event = rotateSpy.mock.calls[0][0];
      expect(event.type).toBe('RTS');
      expect(event.timestamp).toBeDefined();
      expect(event.sequenceNumber).toBeDefined();
    });

    it('should force log rotation', () => {
      const rotateSpy = jest.fn();
      dtrManager.on('rotateLog', rotateSpy);

      dtrManager.forceLogRotation();

      expect(rotateSpy).toHaveBeenCalled();
    });
  });

  describe('Synchronization', () => {
    it('should set synchronization on reset', async () => {
      await dtrManager.onDTRReset();

      const status = dtrManager.getSyncStatus();
      expect(status.synchronized).toBe(true);
      expect(status.source).toBe('DTR');
    });

    it('should mark synchronization from other sources', () => {
      dtrManager.markSynchronized('protocol');

      const status = dtrManager.getSyncStatus();
      expect(status.synchronized).toBe(true);
      expect(status.source).toBe('protocol');
    });

    it('should clear synchronization', () => {
      dtrManager.markSynchronized('test');
      dtrManager.clearSynchronization();

      const status = dtrManager.getSyncStatus();
      expect(status.synchronized).toBe(false);
      expect(status.source).toBe('');
    });

    it('should emit sync status changes', () => {
      const syncSpy = jest.fn();
      dtrManager.on('syncStatusChanged', syncSpy);

      dtrManager.markSynchronized('text');

      expect(syncSpy).toHaveBeenCalled();
      expect(syncSpy.mock.calls[0][0].synchronized).toBe(true);
    });
  });

  describe('Message Counting', () => {
    it('should track messages before and after reset', async () => {
      // Messages before reset
      dtrManager.updateMessageCounts(true);
      dtrManager.updateMessageCounts(true);
      dtrManager.updateMessageCounts(true);

      await dtrManager.onDTRReset();

      // Messages after reset
      dtrManager.updateMessageCounts(false);
      dtrManager.updateMessageCounts(false);

      const stats = dtrManager.getStats();
      expect(stats.messagesBeforeReset).toBe(3);
      expect(stats.messagesAfterReset).toBe(2);
    });

    it('should determine if message is before reset based on timestamp', async () => {
      const resetTime = Date.now();
      
      // Perform reset
      await dtrManager.onDTRReset();
      
      // Check messages with different timestamps
      expect(dtrManager.isMessageBeforeReset(resetTime - 1000)).toBe(true);
      expect(dtrManager.isMessageBeforeReset(resetTime + 1000)).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track reset counts by type', async () => {
      await dtrManager.onDTRReset();
      await dtrManager.onDTRReset();
      await dtrManager.onRTSReset();

      const stats = dtrManager.getStats();
      expect(stats.totalResets).toBe(3);
      expect(stats.dtrResets).toBe(2);
      expect(stats.rtsResets).toBe(1);
    });

    it('should reset statistics', async () => {
      await dtrManager.onDTRReset();
      dtrManager.updateMessageCounts(true);

      dtrManager.resetStats();

      const stats = dtrManager.getStats();
      expect(stats.totalResets).toBe(0);
      expect(stats.messagesBeforeReset).toBe(0);
    });

    it('should maintain boundary markers after stats reset', async () => {
      await dtrManager.onDTRReset();
      const reset = dtrManager.getCurrentReset()!;

      dtrManager.resetStats();

      // Boundary should still exist
      const marker = dtrManager.getBoundaryMarker(reset.sequenceNumber);
      expect(marker).toBeDefined();
    });
  });

  describe('Buffer Independence', () => {
    it('should not touch buffer during reset', async () => {
      // DTRResetManager has no reference to buffer
      // This is verified by the class implementation having no buffer property
      
      // The reset should complete without any buffer operations
      await dtrManager.onDTRReset();
      
      // Verify manager has no buffer reference
      const manager = dtrManager as any;
      expect(manager.buffer).toBeUndefined();
    });

    it('should only set flags, not manipulate data', async () => {
      const initialStats = dtrManager.getStats();
      
      await dtrManager.onDTRReset();
      
      const afterStats = dtrManager.getStats();
      
      // Only flags and counts should change
      expect(afterStats.synchronized).toBe(true);
      expect(afterStats.totalResets).toBe(initialStats.totalResets + 1);
      
      // No data manipulation methods exist
      expect((dtrManager as any).clearBuffer).toBeUndefined();
      expect((dtrManager as any).resetBuffer).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple rapid resets', async () => {
      const promises = [];
      
      // Fire multiple resets rapidly
      for (let i = 0; i < 5; i++) {
        promises.push(dtrManager.onDTRReset());
      }

      await Promise.all(promises);

      const stats = dtrManager.getStats();
      expect(stats.totalResets).toBe(5);
    });

    it('should handle reset with empty queue', async () => {
      // No messages in queue
      expect(inputQueue.isEmpty()).toBe(true);

      await dtrManager.onDTRReset();

      // Should complete normally
      const stats = dtrManager.getStats();
      expect(stats.totalResets).toBe(1);
    });

    it('should handle alternating DTR/RTS resets', async () => {
      const events: string[] = [];
      
      dtrManager.on('resetDetected', (event) => {
        events.push(event.type);
      });

      await dtrManager.onDTRReset();
      await dtrManager.onRTSReset();
      await dtrManager.onDTRReset();
      await dtrManager.onRTSReset();

      expect(events).toEqual(['DTR', 'RTS', 'DTR', 'RTS']);
    });

    it('should handle getCurrentReset before any reset', () => {
      const reset = dtrManager.getCurrentReset();
      expect(reset).toBeNull();
    });

    it('should return true for isMessageBeforeReset when no reset occurred', () => {
      // No reset yet, all messages are "before"
      expect(dtrManager.isMessageBeforeReset(Date.now())).toBe(true);
    });
  });
});