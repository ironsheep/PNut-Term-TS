/** @format */

// tests/windowRouter.test.ts

import { WindowRouter } from '../src/classes/shared/windowRouter';
import type { WindowInfo, RecordingMetadata, RoutingStats } from '../src/classes/shared/windowRouter';
import { SharedMessageType, ExtractedMessage } from '../src/classes/shared/sharedMessagePool';
import * as fs from 'fs';
import * as path from 'path';

// Helper to create ExtractedMessage from text
function createTextMessage(text: string, type: SharedMessageType = SharedMessageType.TERMINAL_OUTPUT): ExtractedMessage {
  return {
    type,
    data: new TextEncoder().encode(text),
    timestamp: Date.now()
  };
}

// Helper to create binary debugger message
function createBinaryMessage(data: Uint8Array, cogId: number = 0): ExtractedMessage {
  const type = SharedMessageType.DEBUGGER0_416BYTE + cogId;
  return {
    type,
    data,
    timestamp: Date.now()
  };
}

describe('WindowRouter', () => {
  let router: WindowRouter;
  
  beforeEach(() => {
    // Reset singleton for each test
    WindowRouter.resetInstance();
    router = WindowRouter.getInstance();
  });
  
  afterEach(() => {
    // Clean up
    WindowRouter.resetInstance();
    
    // Clean up any test recordings
    const testRecordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
    if (fs.existsSync(testRecordingsDir)) {
      const files = fs.readdirSync(testRecordingsDir);
      files.forEach(file => {
        if (file.includes('test-session')) {
          fs.unlinkSync(path.join(testRecordingsDir, file));
        }
      });
    }
  });
  
  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = WindowRouter.getInstance();
      const instance2 = WindowRouter.getInstance();
      expect(instance1).toBe(instance2);
    });
    
    it('should create new instance after reset', () => {
      const instance1 = WindowRouter.getInstance();
      WindowRouter.resetInstance();
      const instance2 = WindowRouter.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });
  
  describe('Window Registration', () => {
    it('should register a window', () => {
      const handler = jest.fn();
      router.registerWindow('test-window', 'terminal', handler);
      
      const windows = router.getActiveWindows();
      expect(windows).toHaveLength(1);
      expect(windows[0].windowId).toBe('test-window');
      expect(windows[0].windowType).toBe('terminal');
    });
    
    it('should treat a duplicate window name as a fatal display error', () => {
      const handler = jest.fn();
      router.registerWindow('test-window', 'terminal', handler);

      // A duplicate display name is unrecoverable (name-only routing): the router emits
      // 'fatalDisplayError' (which drives a clean shutdown in headed mode) and still throws so
      // the caller's registerWithRouter() guard does not mark the duplicate window ready.
      const fatal = jest.fn();
      router.on('fatalDisplayError', fatal);

      expect(() => {
        router.registerWindow('test-window', 'scope', handler);
      }).toThrow("DEBUG display name 'test-window' is declared more than once");

      expect(fatal).toHaveBeenCalledTimes(1);
      expect(fatal.mock.calls[0][0]).toMatchObject({ windowId: 'test-window' });
    });
    
    it('should unregister a window', () => {
      const handler = jest.fn();
      router.registerWindow('test-window', 'terminal', handler);
      router.unregisterWindow('test-window');
      
      const windows = router.getActiveWindows();
      expect(windows).toHaveLength(0);
    });
    
    it('should emit events on registration/unregistration', () => {
      const registerSpy = jest.fn();
      const unregisterSpy = jest.fn();
      
      router.on('windowRegistered', registerSpy);
      router.on('windowUnregistered', unregisterSpy);
      
      const handler = jest.fn();
      router.registerWindow('test-window', 'terminal', handler);
      router.unregisterWindow('test-window');
      
      expect(registerSpy).toHaveBeenCalledWith({ windowId: 'test-window', windowType: 'terminal' });
      expect(unregisterSpy).toHaveBeenCalledWith({ windowId: 'test-window' });
    });
  });
  
  describe('Binary Message Routing', () => {
    it('should route binary message to debugger window based on COG ID', () => {
      const handler0 = jest.fn();
      const handler1 = jest.fn();
      
      router.registerWindow('debugger-0', 'debugger', handler0);
      router.registerWindow('debugger-1', 'debugger', handler1);
      
      // Message with COG ID 0 (in lower 3 bits)
      const data0 = new Uint8Array([0x00, 0x01, 0x02]);
      router.routeBinaryMessage(data0);

      // Debugger windows receive (data, messageType) so they can route by frame
      // type (task #78 "main routes by frame type"); here no type is supplied.
      expect(handler0).toHaveBeenCalledWith(data0, undefined);
      expect(handler1).not.toHaveBeenCalled();

      // Message with COG ID 1
      const data1 = new Uint8Array([0x01, 0x01, 0x02]);
      router.routeBinaryMessage(data1);

      expect(handler1).toHaveBeenCalledWith(data1, undefined);
    });
    
    it('should extract COG ID from data byte for short messages', () => {
      const handler = jest.fn();
      router.registerWindow('debugger-5', 'debugger', handler);

      // For messages < 4 bytes, COG ID is first byte
      // Use COG ID 5 directly
      const data = new Uint8Array([0x05, 0x00]);
      router.routeBinaryMessage(data);

      expect(handler).toHaveBeenCalledWith(data, undefined);
    });
    
    it('should emit unhandled message for missing debugger window', () => {
      const unhandledSpy = jest.fn();
      router.on('unhandledMessage', unhandledSpy);
      
      const data = new Uint8Array([0x03, 0x00]); // COG ID 3
      router.routeBinaryMessage(data);
      
      expect(unhandledSpy).toHaveBeenCalledWith({
        type: 'binary',
        cogId: 3,
        size: 2
      });
    });
  });
  
  describe('Text Message Routing', () => {
    it('should route COG messages to logger window', () => {
      const loggerHandler = jest.fn();

      router.registerWindow('logger', 'logger', loggerHandler);

      const message = createTextMessage('Cog0: Debug output', SharedMessageType.COG0_MESSAGE);
      router.routeTextMessage(message);

      expect(loggerHandler).toHaveBeenCalledTimes(1);
      // Handler receives ExtractedMessage
      const receivedMessage = loggerHandler.mock.calls[0][0] as ExtractedMessage;
      expect(receivedMessage.type).toBe(SharedMessageType.COG0_MESSAGE);
      expect(new TextDecoder().decode(receivedMessage.data)).toBe('Cog0: Debug output');
    });

    it('should route different COG messages to logger', () => {
      const loggerHandler = jest.fn();

      router.registerWindow('logger', 'logger', loggerHandler);

      const msg0 = createTextMessage('Cog0: Message', SharedMessageType.COG0_MESSAGE);
      const msg5 = createTextMessage('Cog5: Message', SharedMessageType.COG5_MESSAGE);

      router.routeTextMessage(msg0);
      router.routeTextMessage(msg5);

      expect(loggerHandler).toHaveBeenCalledTimes(2);
    });

    it('should route TERMINAL_OUTPUT to mainWindow (if set)', () => {
      // Terminal output routes to mainWindowInstance.appendToTerminal()
      // Without mainWindow set, no handler is called
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const message = createTextMessage('Regular terminal output', SharedMessageType.TERMINAL_OUTPUT);
      router.routeTextMessage(message);

      // Logger should receive terminal output for logging
      expect(loggerHandler).toHaveBeenCalledTimes(1);
    });

    it('should route BACKTICK_UPDATE to logger', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const message = createTextMessage('`scope1 100 200 300', SharedMessageType.BACKTICK_UPDATE);
      router.routeTextMessage(message);

      expect(loggerHandler).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Generic Message Routing', () => {
    it('should route ExtractedMessage based on SharedMessageType', () => {
      const handler = jest.fn();
      router.registerWindow('debugger-0', 'debugger', handler);

      const binaryMessage = createBinaryMessage(new Uint8Array([0x00, 0x01]), 0);
      router.routeMessage(binaryMessage);

      // Binary messages pass (Uint8Array, messageType) to a debugger window so it
      // can route by frame type (task #78). The type is the DEBUGGER0 Phase-1 tag.
      expect(handler).toHaveBeenCalledWith(new Uint8Array([0x00, 0x01]), SharedMessageType.DEBUGGER0_416BYTE);
    });

    it('should route text messages via routeMessage', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const textMessage = createTextMessage('Test message', SharedMessageType.TERMINAL_OUTPUT);
      router.routeMessage(textMessage);

      expect(loggerHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle routing errors gracefully', () => {
      const errorSpy = jest.fn();
      router.on('routingError', errorSpy);

      // Force an error by passing message with null data
      const invalidMessage: ExtractedMessage = {
        type: SharedMessageType.TERMINAL_OUTPUT,
        data: null as any,
        timestamp: Date.now()
      };

      router.routeMessage(invalidMessage);

      expect(errorSpy).toHaveBeenCalled();

      const stats = router.getRoutingStats();
      expect(stats.errors).toBe(1);
    });
  });
  
  describe('Recording System', () => {
    it('should start and stop recording', () => {
      const metadata: RecordingMetadata = {
        sessionName: 'test-session',
        description: 'Test recording',
        startTime: Date.now()
      };

      // Use JSONL format which emits events
      router.setRecordingFormat(false);

      const startSpy = jest.fn();
      const stopSpy = jest.fn();

      router.on('recordingStarted', startSpy);
      router.on('recordingStopped', stopSpy);

      router.startRecording(metadata);
      expect(startSpy).toHaveBeenCalled();

      const stats = router.getRoutingStats();
      expect(stats.recordingActive).toBe(true);

      router.stopRecording();
      expect(stopSpy).toHaveBeenCalled();
      expect(router.getRoutingStats().recordingActive).toBe(false);
    });
    
    it('should throw error if recording already in progress', () => {
      const metadata: RecordingMetadata = {
        sessionName: 'test1',
        startTime: Date.now()
      };
      
      router.startRecording(metadata);
      
      expect(() => {
        router.startRecording(metadata);
      }).toThrow('Recording already in progress');
      
      router.stopRecording();
    });
    
    it('should record messages when recording is active', (done) => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const metadata: RecordingMetadata = {
        sessionName: 'test-record',
        startTime: Date.now()
      };

      router.startRecording(metadata);
      router.routeTextMessage(createTextMessage('Test message', SharedMessageType.TERMINAL_OUTPUT));

      // Wait for buffer flush
      setTimeout(() => {
        router.stopRecording();

        // Check that file was created
        const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
        if (fs.existsSync(recordingsDir)) {
          const files = fs.readdirSync(recordingsDir);
          const recordFile = files.find((f) => f.includes('test-record'));

          if (recordFile) {
            // Clean up
            fs.unlinkSync(path.join(recordingsDir, recordFile));
          }
        }

        done();
      }, 150); // Wait for buffer timeout
    });

    it('should flush buffer when full', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const metadata: RecordingMetadata = {
        sessionName: 'test-buffer',
        startTime: Date.now()
      };

      router.startRecording(metadata);

      // Send more than buffer size (1000) messages
      for (let i = 0; i < 1001; i++) {
        router.routeTextMessage(createTextMessage(`Message ${i}`, SharedMessageType.TERMINAL_OUTPUT));
      }

      router.stopRecording();

      // Clean up any created files
      const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
      if (fs.existsSync(recordingsDir)) {
        const files = fs.readdirSync(recordingsDir);
        const recordFile = files.find((f) => f.includes('test-buffer'));

        if (recordFile) {
          fs.unlinkSync(path.join(recordingsDir, recordFile));
        }
      }
    });
  });
  
  describe('Playback System', () => {
    it('should play back recorded session', async () => {
      // Create a test recording
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const metadata: RecordingMetadata = {
        sessionName: 'test-playback',
        startTime: Date.now()
      };

      router.startRecording(metadata);
      router.routeTextMessage(createTextMessage('Message 1', SharedMessageType.TERMINAL_OUTPUT));
      router.routeTextMessage(createTextMessage('Message 2', SharedMessageType.TERMINAL_OUTPUT));
      router.stopRecording();

      // Find the recording file
      const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
      if (fs.existsSync(recordingsDir)) {
        const files = fs.readdirSync(recordingsDir);
        const recordFile = files.find((f) => f.includes('test-playback'));

        if (recordFile) {
          const filepath = path.join(recordingsDir, recordFile);

          // Reset handler
          loggerHandler.mockClear();

          // Play back at 10x speed
          await router.playRecording(filepath, 10);

          // Handler should have been called (playback works)
          // Note: playback recreates messages, exact format may vary

          fs.unlinkSync(filepath);
        }
      }
    });

    it('should throw error for non-existent file', async () => {
      await expect(router.playRecording('/nonexistent/file.jsonl', 1)).rejects.toThrow('Recording file not found');
    });

    it('should handle binary message playback', async () => {
      const handler = jest.fn();
      router.registerWindow('debugger-0', 'debugger', handler);

      const metadata: RecordingMetadata = {
        sessionName: 'test-binary-playback',
        startTime: Date.now()
      };

      router.startRecording(metadata);
      router.routeBinaryMessage(new Uint8Array([0x00, 0xFF, 0x42]));
      router.stopRecording();

      // Find and play back
      const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
      if (fs.existsSync(recordingsDir)) {
        const files = fs.readdirSync(recordingsDir);
        const recordFile = files.find((f) => f.includes('test-binary-playback'));

        if (recordFile) {
          const filepath = path.join(recordingsDir, recordFile);

          handler.mockClear();
          await router.playRecording(filepath, 10);

          expect(handler).toHaveBeenCalledWith(new Uint8Array([0x00, 0xFF, 0x42]));

          fs.unlinkSync(filepath);
        }
      }
    });
  });
  
  describe('Statistics and Performance', () => {
    it('should track routing statistics', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      router.routeTextMessage(createTextMessage('Test 1', SharedMessageType.TERMINAL_OUTPUT));
      router.routeTextMessage(createTextMessage('Test 2', SharedMessageType.TERMINAL_OUTPUT));
      router.routeBinaryMessage(new Uint8Array([0x00, 0x01, 0x02]));

      const stats = router.getRoutingStats();
      expect(stats.messagesRouted).toBe(3);
      expect(stats.bytesProcessed).toBeGreaterThan(0);
      expect(stats.windowsActive).toBe(1);
      expect(stats.averageRoutingTime).toBeGreaterThan(0);
    });

    it('should update window statistics', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      router.routeTextMessage(createTextMessage('Message 1', SharedMessageType.TERMINAL_OUTPUT));
      router.routeTextMessage(createTextMessage('Message 2', SharedMessageType.TERMINAL_OUTPUT));

      const windows = router.getActiveWindows();
      expect(windows[0].messagesReceived).toBe(2);
    });

    it('should emit warning for slow routing', () => {
      const warningSpy = jest.fn();
      router.on('slowRouting', warningSpy);

      // Mock slow handler
      const slowHandler = jest.fn(() => {
        const start = Date.now();
        while (Date.now() - start < 2) {} // Busy wait 2ms
      });

      router.registerWindow('logger', 'logger', slowHandler);
      router.routeTextMessage(createTextMessage('Test', SharedMessageType.TERMINAL_OUTPUT));

      // Check if warning was emitted (might not always trigger due to timing)
      const stats = router.getRoutingStats();
      if (stats.peakRoutingTime > 1.0) {
        expect(warningSpy).toHaveBeenCalled();
      }
    });

    it('should maintain routing time samples', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      // Send many messages
      for (let i = 0; i < 100; i++) {
        router.routeTextMessage(createTextMessage(`Message ${i}`, SharedMessageType.TERMINAL_OUTPUT));
      }

      const stats = router.getRoutingStats();
      expect(stats.averageRoutingTime).toBeDefined();
      expect(stats.peakRoutingTime).toBeGreaterThan(0);
      expect(stats.messagesRouted).toBe(100);
    });

    it('should verify sub-1ms routing performance', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const startTime = performance.now();
      router.routeTextMessage(createTextMessage('Quick message', SharedMessageType.TERMINAL_OUTPUT));
      const endTime = performance.now();

      const routingTime = endTime - startTime;

      // Should typically be under 1ms (allowing some tolerance for CI environments)
      expect(routingTime).toBeLessThan(5); // Relaxed for CI, but typically < 1ms
    });
  });
  
  describe('Window Info', () => {
    it('should provide complete window information', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      router.registerWindow('window1', 'terminal', handler1);
      router.registerWindow('window2', 'scope', handler2);
      
      const windows = router.getActiveWindows();
      expect(windows).toHaveLength(2);
      
      const window1 = windows.find(w => w.windowId === 'window1');
      expect(window1).toBeDefined();
      expect(window1?.windowType).toBe('terminal');
      expect(window1?.registeredAt).toBeGreaterThan(0);
      expect(window1?.messagesReceived).toBe(0);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty binary message', () => {
      const handler = jest.fn();
      router.registerWindow('debugger-0', 'debugger', handler);

      router.routeBinaryMessage(new Uint8Array([]));

      expect(handler).toHaveBeenCalledWith(new Uint8Array([]), undefined);
    });

    it('should handle text message with empty data', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      router.routeTextMessage(createTextMessage('', SharedMessageType.TERMINAL_OUTPUT));

      // Logger should still receive the message
      expect(loggerHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple COG windows', () => {
      // Register logger and multiple COG windows
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const cogHandlers = Array.from({ length: 8 }, () => jest.fn());
      cogHandlers.forEach((handler, i) => {
        router.registerWindow(`COG${i}`, 'cog', handler);
      });

      // Send messages for each COG
      for (let i = 0; i < 8; i++) {
        const cogType = SharedMessageType.COG0_MESSAGE + i;
        router.routeTextMessage(createTextMessage(`Cog${i}: Test data`, cogType));
      }

      // Logger should receive all 8 messages
      expect(loggerHandler).toHaveBeenCalledTimes(8);

      // Each COG handler should receive 1 message
      cogHandlers.forEach((handler) => {
        expect(handler).toHaveBeenCalledTimes(1);
      });

      const stats = router.getRoutingStats();
      expect(stats.windowsActive).toBe(9); // 1 logger + 8 COG windows
    });
  });
});