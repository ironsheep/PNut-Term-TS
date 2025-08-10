/** @format */

// tests/windowRouterIntegration.test.ts

import { WindowRouter } from '../src/classes/shared/windowRouter';
import { Context } from '../src/utils/context';
import * as fs from 'fs';
import * as path from 'path';

describe('WindowRouter Integration with All Window Types', () => {
  let router: WindowRouter;
  let testRecordingPath: string;
  
  beforeEach(() => {
    // Reset singleton
    WindowRouter.resetInstance();
    router = WindowRouter.getInstance();
    
    // Set up test recording path
    testRecordingPath = path.join(__dirname, 'test-recording.jsonl');
    
    // Clean up any existing test recording
    if (fs.existsSync(testRecordingPath)) {
      fs.unlinkSync(testRecordingPath);
    }
  });
  
  afterEach(() => {
    // Clean up
    if (fs.existsSync(testRecordingPath)) {
      fs.unlinkSync(testRecordingPath);
    }
    WindowRouter.resetInstance();
  });
  
  describe('Window Registration and Routing', () => {
    it('should properly register and route to all window types', () => {
      const windowTypes = [
        'terminal',
        'scope', 
        'logic',
        'plot',
        'midi',
        'bitmap',
        'fft',
        'scopexy',
        'debugger'
      ];
      
      const handlers = new Map<string, jest.Mock>();
      
      // Register one window of each type
      windowTypes.forEach(type => {
        const handler = jest.fn();
        handlers.set(type, handler);
        router.registerWindow(`${type}-1`, type, handler);
      });
      
      // Verify all windows are registered
      const activeWindows = router.getActiveWindows();
      expect(activeWindows.length).toBe(windowTypes.length);
      
      // Test routing to each window type (except debugger which uses binary)
      windowTypes.filter(t => t !== 'debugger').forEach(type => {
        const message = `DEBUG ${type.toUpperCase()} test data`;
        router.routeTextMessage(message);
        
        const handler = handlers.get(type)!;
        expect(handler).toHaveBeenCalledWith(message);
      });
      
      // Test binary routing to debugger
      const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03]); // COG 0
      router.routeBinaryMessage(binaryData);
      expect(handlers.get('debugger')).toHaveBeenCalledWith(binaryData);
    });
    
    it('should support multiple windows of the same type', () => {
      const handlers = [jest.fn(), jest.fn(), jest.fn()];
      
      // Register multiple scope windows
      router.registerWindow('scope-1', 'scope', handlers[0]);
      router.registerWindow('scope-2', 'scope', handlers[1]);
      router.registerWindow('scope-3', 'scope', handlers[2]);
      
      // Send message - should go to all scope windows
      const message = 'DEBUG SCOPE multi-window test';
      router.routeTextMessage(message);
      
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledWith(message);
      });
    });
  });
  
  describe('Recording and Playback', () => {
    it('should record messages for all window types', async () => {
      // Register windows
      const terminal = jest.fn();
      const scope = jest.fn();
      const logic = jest.fn();
      
      router.registerWindow('terminal-1', 'terminal', terminal);
      router.registerWindow('scope-1', 'scope', scope);
      router.registerWindow('logic-1', 'logic', logic);
      
      // Start recording
      router.startRecording({
        sessionName: 'test-all-windows',
        description: 'Test recording all window types',
        startTime: Date.now(),
        windowTypes: ['terminal', 'scope', 'logic']
      });
      
      // Send various messages
      router.routeTextMessage('Terminal output text');
      router.routeTextMessage('DEBUG SCOPE waveform data');
      router.routeTextMessage('DEBUG LOGIC channel data');
      
      // Stop recording
      router.stopRecording();
      
      // Verify recording file exists
      const recordingFiles = fs.readdirSync(path.dirname(testRecordingPath))
        .filter(f => f.includes('test-all-windows'));
      expect(recordingFiles.length).toBeGreaterThan(0);
      
      // Clean up recording file
      recordingFiles.forEach(file => {
        const filePath = path.join(path.dirname(testRecordingPath), file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    });
    
    it('should playback recorded messages to correct window types', async () => {
      // Create a test recording file
      const messages = [
        {
          timestamp: Date.now(),
          windowId: 'terminal-1',
          windowType: 'terminal',
          messageType: 'text',
          data: 'Test terminal message',
          size: 21
        },
        {
          timestamp: Date.now() + 10,
          windowId: 'scope-1',
          windowType: 'scope',
          messageType: 'text',
          data: 'DEBUG SCOPE test data',
          size: 21
        },
        {
          timestamp: Date.now() + 20,
          windowId: 'debugger-0',
          windowType: 'debugger',
          messageType: 'binary',
          data: Buffer.from([0x00, 0x01, 0x02, 0x03]).toString('base64'),
          size: 4
        }
      ];
      
      // Write test recording
      fs.writeFileSync(
        testRecordingPath,
        messages.map(m => JSON.stringify(m)).join('\n'),
        'utf8'
      );
      
      // Register handlers
      const handlers = {
        terminal: jest.fn(),
        scope: jest.fn(),
        debugger: jest.fn()
      };
      
      router.registerWindow('terminal-1', 'terminal', handlers.terminal);
      router.registerWindow('scope-1', 'scope', handlers.scope);
      router.registerWindow('debugger-0', 'debugger', handlers.debugger);
      
      // Playback in headless mode (no window creation)
      await router.playRecording(testRecordingPath, 10.0, true);
      
      // Verify messages were routed correctly
      expect(handlers.terminal).toHaveBeenCalled();
      expect(handlers.scope).toHaveBeenCalled();
      expect(handlers.debugger).toHaveBeenCalled();
    });
  });
  
  describe('Window Unregistration', () => {
    it('should properly unregister windows on close', () => {
      // Register multiple windows
      router.registerWindow('terminal-1', 'terminal', jest.fn());
      router.registerWindow('scope-1', 'scope', jest.fn());
      router.registerWindow('logic-1', 'logic', jest.fn());
      
      expect(router.getActiveWindows().length).toBe(3);
      
      // Unregister one window
      router.unregisterWindow('scope-1');
      expect(router.getActiveWindows().length).toBe(2);
      
      // Verify the unregistered window is gone
      const remaining = router.getActiveWindows();
      expect(remaining.find(w => w.windowId === 'scope-1')).toBeUndefined();
      expect(remaining.find(w => w.windowId === 'terminal-1')).toBeDefined();
      expect(remaining.find(w => w.windowId === 'logic-1')).toBeDefined();
    });
    
    it('should not route messages to unregistered windows', () => {
      const handler = jest.fn();
      
      // Register and then unregister
      router.registerWindow('terminal-1', 'terminal', handler);
      router.unregisterWindow('terminal-1');
      
      // Try to route a message
      router.routeTextMessage('Test message');
      
      // Handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('Performance with Multiple Windows', () => {
    it('should maintain sub-1ms routing with many windows', () => {
      // Register many windows
      const handlers: jest.Mock[] = [];
      for (let i = 0; i < 20; i++) {
        const handler = jest.fn();
        handlers.push(handler);
        router.registerWindow(`window-${i}`, i < 10 ? 'scope' : 'logic', handler);
      }
      
      // Measure routing performance
      const iterations = 100;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        router.routeTextMessage(`DEBUG ${i < 50 ? 'SCOPE' : 'LOGIC'} performance test`);
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(1.0); // Sub-1ms average
    });
  });
  
  describe('Window Type Discrimination', () => {
    it('should correctly identify window types from DEBUG commands', () => {
      const handlers = {
        terminal: jest.fn(),
        scope: jest.fn(),
        logic: jest.fn(),
        plot: jest.fn(),
        midi: jest.fn(),
        bitmap: jest.fn(),
        fft: jest.fn(),
        scopexy: jest.fn()
      };
      
      // Register windows
      Object.entries(handlers).forEach(([type, handler]) => {
        router.registerWindow(`${type}-test`, type, handler);
      });
      
      // Test routing with various DEBUG formats
      const testCases = [
        { message: 'DEBUG SCOPE data', expectType: 'scope' },
        { message: 'DEBUG LOGIC bits', expectType: 'logic' },
        { message: 'DEBUG PLOT points', expectType: 'plot' },
        { message: 'DEBUG MIDI notes', expectType: 'midi' },
        { message: 'DEBUG BITMAP pixels', expectType: 'bitmap' },
        { message: 'DEBUG FFT spectrum', expectType: 'fft' },
        { message: 'DEBUG SCOPEXY xy-data', expectType: 'scopexy' },
        { message: 'Regular terminal text', expectType: 'terminal' }
      ];
      
      testCases.forEach(test => {
        // Reset all mocks
        Object.values(handlers).forEach(h => h.mockClear());
        
        // Route message
        router.routeTextMessage(test.message);
        
        // Verify only correct handler was called
        Object.entries(handlers).forEach(([type, handler]) => {
          if (type === test.expectType) {
            expect(handler).toHaveBeenCalledWith(test.message);
          } else {
            expect(handler).not.toHaveBeenCalled();
          }
        });
      });
    });
    
    it('should handle case-insensitive window type matching', () => {
      const handler = jest.fn();
      router.registerWindow('scope-1', 'scope', handler);
      
      // Test various case combinations
      ['DEBUG SCOPE data', 'DEBUG scope data', 'DEBUG Scope data'].forEach(message => {
        handler.mockClear();
        router.routeTextMessage(message);
        expect(handler).toHaveBeenCalledWith(message);
      });
    });
  });
});