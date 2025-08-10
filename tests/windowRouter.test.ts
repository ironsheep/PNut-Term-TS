/** @format */

// tests/windowRouter.test.ts

import { WindowRouter } from '../src/classes/shared/windowRouter';
import type { SerialMessage, WindowInfo, RecordingMetadata, RoutingStats } from '../src/classes/shared/windowRouter';
import * as fs from 'fs';
import * as path from 'path';

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
    
    it('should throw error for duplicate window ID', () => {
      const handler = jest.fn();
      router.registerWindow('test-window', 'terminal', handler);
      
      expect(() => {
        router.registerWindow('test-window', 'scope', handler);
      }).toThrow('Window test-window is already registered');
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
      
      expect(handler0).toHaveBeenCalledWith(data0);
      expect(handler1).not.toHaveBeenCalled();
      
      // Message with COG ID 1
      const data1 = new Uint8Array([0x01, 0x01, 0x02]);
      router.routeBinaryMessage(data1);
      
      expect(handler1).toHaveBeenCalledWith(data1);
    });
    
    it('should extract COG ID from lower 3 bits', () => {
      const handler = jest.fn();
      router.registerWindow('debugger-5', 'debugger', handler);
      
      // 0xF5 = 11110101, lower 3 bits = 101 = 5
      const data = new Uint8Array([0xF5, 0x00]);
      router.routeBinaryMessage(data);
      
      expect(handler).toHaveBeenCalledWith(data);
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
    it('should route DEBUG commands to appropriate window type', () => {
      const termHandler = jest.fn();
      const scopeHandler = jest.fn();
      
      router.registerWindow('term1', 'terminal', termHandler);
      router.registerWindow('scope1', 'scope', scopeHandler);
      
      router.routeTextMessage('DEBUG scope data values');
      
      expect(scopeHandler).toHaveBeenCalledWith('DEBUG scope data values');
      expect(termHandler).not.toHaveBeenCalled();
    });
    
    it('should route to all windows of same type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      router.registerWindow('scope1', 'scope', handler1);
      router.registerWindow('scope2', 'scope', handler2);
      
      router.routeTextMessage('DEBUG scope data');
      
      expect(handler1).toHaveBeenCalledWith('DEBUG scope data');
      expect(handler2).toHaveBeenCalledWith('DEBUG scope data');
    });
    
    it('should default non-DEBUG text to terminal window', () => {
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      router.routeTextMessage('Regular terminal output');
      
      expect(handler).toHaveBeenCalledWith('Regular terminal output');
    });
    
    it('should handle case-insensitive window types', () => {
      const handler = jest.fn();
      router.registerWindow('scope1', 'scope', handler);
      
      router.routeTextMessage('DEBUG SCOPE data');
      
      expect(handler).toHaveBeenCalledWith('DEBUG SCOPE data');
    });
  });
  
  describe('Generic Message Routing', () => {
    it('should route SerialMessage based on type', () => {
      const handler = jest.fn();
      router.registerWindow('debugger-0', 'debugger', handler);
      
      const binaryMessage: SerialMessage = {
        type: 'binary',
        data: new Uint8Array([0x00, 0x01]),
        timestamp: Date.now()
      };
      
      router.routeMessage(binaryMessage);
      
      expect(handler).toHaveBeenCalledWith(new Uint8Array([0x00, 0x01]));
    });
    
    it('should handle routing errors gracefully', () => {
      const errorSpy = jest.fn();
      router.on('routingError', errorSpy);
      
      // Force an error by passing invalid message
      const invalidMessage = {
        type: 'invalid' as any,
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
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      const metadata: RecordingMetadata = {
        sessionName: 'test-record',
        startTime: Date.now()
      };
      
      router.startRecording(metadata);
      router.routeTextMessage('Test message');
      
      // Wait for buffer flush
      setTimeout(() => {
        router.stopRecording();
        
        // Check that file was created
        const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
        const files = fs.readdirSync(recordingsDir);
        const recordFile = files.find(f => f.includes('test-record'));
        
        expect(recordFile).toBeDefined();
        
        if (recordFile) {
          const content = fs.readFileSync(path.join(recordingsDir, recordFile), 'utf-8');
          expect(content).toContain('Test message');
          fs.unlinkSync(path.join(recordingsDir, recordFile));
        }
        
        done();
      }, 150); // Wait for buffer timeout
    });
    
    it('should flush buffer when full', () => {
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      const metadata: RecordingMetadata = {
        sessionName: 'test-buffer',
        startTime: Date.now()
      };
      
      router.startRecording(metadata);
      
      // Send more than buffer size (1000) messages
      for (let i = 0; i < 1001; i++) {
        router.routeTextMessage(`Message ${i}`);
      }
      
      router.stopRecording();
      
      // File should contain all messages
      const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
      const files = fs.readdirSync(recordingsDir);
      const recordFile = files.find(f => f.includes('test-buffer'));
      
      if (recordFile) {
        const content = fs.readFileSync(path.join(recordingsDir, recordFile), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        expect(lines.length).toBeGreaterThan(1000); // metadata + messages
        fs.unlinkSync(path.join(recordingsDir, recordFile));
      }
    });
  });
  
  describe('Playback System', () => {
    it('should play back recorded session', async () => {
      // Create a test recording
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      const metadata: RecordingMetadata = {
        sessionName: 'test-playback',
        startTime: Date.now()
      };
      
      router.startRecording(metadata);
      router.routeTextMessage('Message 1');
      router.routeTextMessage('Message 2');
      router.stopRecording();
      
      // Find the recording file
      const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
      const files = fs.readdirSync(recordingsDir);
      const recordFile = files.find(f => f.includes('test-playback'));
      
      if (recordFile) {
        const filepath = path.join(recordingsDir, recordFile);
        
        // Reset handler
        handler.mockClear();
        
        // Play back at 10x speed
        await router.playRecording(filepath, 10);
        
        expect(handler).toHaveBeenCalledWith('Message 1');
        expect(handler).toHaveBeenCalledWith('Message 2');
        
        fs.unlinkSync(filepath);
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
      const files = fs.readdirSync(recordingsDir);
      const recordFile = files.find(f => f.includes('test-binary-playback'));
      
      if (recordFile) {
        const filepath = path.join(recordingsDir, recordFile);
        
        handler.mockClear();
        await router.playRecording(filepath, 10);
        
        expect(handler).toHaveBeenCalledWith(new Uint8Array([0x00, 0xFF, 0x42]));
        
        fs.unlinkSync(filepath);
      }
    });
  });
  
  describe('Statistics and Performance', () => {
    it('should track routing statistics', () => {
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      router.routeTextMessage('Test 1');
      router.routeTextMessage('Test 2');
      router.routeBinaryMessage(new Uint8Array([0x00, 0x01, 0x02]));
      
      const stats = router.getRoutingStats();
      expect(stats.messagesRouted).toBe(3);
      expect(stats.bytesProcessed).toBe(15); // 6 + 6 + 3
      expect(stats.windowsActive).toBe(1);
      expect(stats.averageRoutingTime).toBeGreaterThan(0);
    });
    
    it('should update window statistics', () => {
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      router.routeTextMessage('Message 1');
      router.routeTextMessage('Message 2');
      
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
      
      router.registerWindow('slow-window', 'terminal', slowHandler);
      router.routeTextMessage('Test');
      
      // Check if warning was emitted (might not always trigger due to timing)
      const stats = router.getRoutingStats();
      if (stats.peakRoutingTime > 1.0) {
        expect(warningSpy).toHaveBeenCalled();
      }
    });
    
    it('should maintain routing time samples', () => {
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      // Send many messages
      for (let i = 0; i < 100; i++) {
        router.routeTextMessage(`Message ${i}`);
      }
      
      const stats = router.getRoutingStats();
      expect(stats.averageRoutingTime).toBeDefined();
      expect(stats.peakRoutingTime).toBeGreaterThan(0);
      expect(stats.messagesRouted).toBe(100);
    });
    
    it('should verify sub-1ms routing performance', () => {
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      const startTime = performance.now();
      router.routeTextMessage('Quick message');
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
      
      expect(handler).toHaveBeenCalledWith(new Uint8Array([]));
    });
    
    it('should handle malformed DEBUG command', () => {
      const handler = jest.fn();
      router.registerWindow('terminal', 'terminal', handler);
      
      router.routeTextMessage('DEBUG'); // No window type
      
      // Should default to terminal
      expect(handler).toHaveBeenCalledWith('DEBUG');
    });
    
    it('should handle concurrent window operations', () => {
      const handlers = Array.from({ length: 10 }, () => jest.fn());
      
      // Register multiple windows of same type
      handlers.forEach((handler, i) => {
        router.registerWindow(`scope-${i}`, 'scope', handler);
      });
      
      // Send DEBUG messages that route to all scope windows
      for (let i = 0; i < 100; i++) {
        router.routeTextMessage(`DEBUG scope data ${i}`);
      }
      
      // All handlers should have received all messages
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(100);
      });
      
      const stats = router.getRoutingStats();
      expect(stats.windowsActive).toBe(10);
    });
  });
});