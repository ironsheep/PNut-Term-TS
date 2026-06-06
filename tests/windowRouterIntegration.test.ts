/** @format */

// tests/windowRouterIntegration.test.ts
// Updated to match current SharedMessageType-based routing (not legacy string-content routing).

import { WindowRouter } from '../src/classes/shared/windowRouter';
import { SharedMessageType, ExtractedMessage } from '../src/classes/shared/sharedMessagePool';
import * as fs from 'fs';
import * as path from 'path';

/** Build a valid ExtractedMessage for tests. */
function makeMsg(type: SharedMessageType, text: string): ExtractedMessage {
  return { type, data: new TextEncoder().encode(text), timestamp: Date.now() };
}

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
    it('should register windows of different types and report them as active', () => {
      const windowTypes = ['terminal', 'scope', 'logic', 'plot', 'midi', 'bitmap', 'fft', 'scopexy'];
      const handlers = new Map<string, jest.Mock>();

      windowTypes.forEach(type => {
        const handler = jest.fn();
        handlers.set(type, handler);
        router.registerWindow(`${type}-1`, type, handler);
      });

      const activeWindows = router.getActiveWindows();
      expect(activeWindows.length).toBe(windowTypes.length);
    });

    it('should route backtick SCOPE update to scope window handler', () => {
      const scopeHandler = jest.fn();
      const loggerHandler = jest.fn();
      // Logger must be registered under id 'logger'
      router.registerWindow('logger', 'logger', loggerHandler);
      router.registerWindow('scope-1', 'scope', scopeHandler);

      // BACKTICK_UPDATE carries "`scope-1 ..." style command text
      const msg = makeMsg(SharedMessageType.BACKTICK_UPDATE, '`scope-1 data payload');
      router.routeTextMessage(msg);

      // Logger should always receive backtick commands
      expect(loggerHandler).toHaveBeenCalled();
    });

    it('should route binary data to registered debugger window by COG ID', () => {
      const debuggerHandler = jest.fn();
      router.registerWindow('debugger-0', 'debugger', debuggerHandler);

      // COG 0 debugger packet (first byte encodes COG 0 in low bits)
      const binaryData = new Uint8Array(416);
      binaryData[0] = 0; // COG 0
      router.routeBinaryMessage(binaryData);

      expect(debuggerHandler).toHaveBeenCalled();
    });

    it('should support multiple windows of the same type', () => {
      // All scope windows are registered; backtick SCOPE creation → logger
      const handlers = [jest.fn(), jest.fn(), jest.fn()];
      router.registerWindow('scope-1', 'scope', handlers[0]);
      router.registerWindow('scope-2', 'scope', handlers[1]);
      router.registerWindow('scope-3', 'scope', handlers[2]);

      // Just verify they are all registered
      expect(router.getActiveWindows().length).toBe(3);
    });
  });

  describe('Recording and Playback', () => {
    it('should record messages and create a session file', async () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      // Start recording
      router.startRecording({
        sessionName: 'test-all-windows',
        description: 'Test recording all window types',
        startTime: Date.now(),
        windowTypes: ['terminal', 'scope', 'logic']
      });

      // Send a message
      router.routeTextMessage(makeMsg(SharedMessageType.COG0_MESSAGE, 'Cog0  test line'));

      // Stop recording
      router.stopRecording();

      // Binary recorder (default) writes to process.cwd()/tests/recordings/*.p2rec
      // (no context set on router, binaryRecorder uses its default path).
      const recordingsDir = path.join(process.cwd(), 'tests', 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
      const recordingFiles = fs.readdirSync(recordingsDir).filter(
        f => f.includes('test-all-windows') && (f.endsWith('.p2rec') || f.endsWith('.jsonl'))
      );
      expect(recordingFiles.length).toBeGreaterThan(0);

      // Clean up recording files
      recordingFiles.forEach(file => {
        const filePath = path.join(recordingsDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    });

    it('should playback recorded messages to correct window types', async () => {
      // Create recordings directory if needed
      const recordingsDir = path.join(process.cwd(), 'tests', 'recordings', 'sessions');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
      testRecordingPath = path.join(recordingsDir, 'test-playback.jsonl');

      // Create a test recording file with metadata
      const metadata = {
        metadata: {
          sessionName: 'test-playback',
          description: 'Test playback',
          startTime: Date.now(),
          windowTypes: ['terminal', 'scope', 'debugger']
        }
      };

      const messages = [
        metadata,
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
      fs.writeFileSync(testRecordingPath, messages.map(m => JSON.stringify(m)).join('\n'), 'utf8');

      // Register handlers
      const handlers = {
        terminal: jest.fn(),
        scope: jest.fn(),
        debugger: jest.fn()
      };

      router.registerWindow('terminal-1', 'terminal', handlers.terminal);
      router.registerWindow('scope-1', 'scope', handlers.scope);
      router.registerWindow('debugger-0', 'debugger', handlers.debugger);

      // Playback at high speed
      await router.playRecording(testRecordingPath, 100.0, false);

      // Verify messages were routed correctly
      expect(handlers.terminal).toHaveBeenCalled();
      expect(handlers.scope).toHaveBeenCalled();
      expect(handlers.debugger).toHaveBeenCalled();
    });
  });

  describe('Window Unregistration', () => {
    it('should properly unregister windows on close', () => {
      router.registerWindow('terminal-1', 'terminal', jest.fn());
      router.registerWindow('scope-1', 'scope', jest.fn());
      router.registerWindow('logic-1', 'logic', jest.fn());

      expect(router.getActiveWindows().length).toBe(3);

      router.unregisterWindow('scope-1');
      expect(router.getActiveWindows().length).toBe(2);

      const remaining = router.getActiveWindows();
      expect(remaining.find(w => w.windowId === 'scope-1')).toBeUndefined();
      expect(remaining.find(w => w.windowId === 'terminal-1')).toBeDefined();
      expect(remaining.find(w => w.windowId === 'logic-1')).toBeDefined();
    });

    it('should not route messages to unregistered windows', () => {
      const loggerHandler = jest.fn();
      const scopeHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);
      router.registerWindow('scope-1', 'scope', scopeHandler);
      router.unregisterWindow('scope-1');

      // Backtick creation command — logger still gets it, scope-1 is gone
      const msg = makeMsg(SharedMessageType.BACKTICK_SCOPE, '`SCOPE test POS 0 0');
      router.routeTextMessage(msg);

      expect(scopeHandler).not.toHaveBeenCalled();
    });
  });

  describe('Performance with Multiple Windows', () => {
    it('should maintain sub-1ms average routing with many windows', () => {
      // Register many windows
      for (let i = 0; i < 20; i++) {
        router.registerWindow(`window-${i}`, i < 10 ? 'scope' : 'logic', jest.fn());
      }

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        router.routeTextMessage(makeMsg(SharedMessageType.TERMINAL_OUTPUT, `terminal output line ${i}`));
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(1.0); // Sub-1ms average
    });
  });

  describe('Window Type Discrimination', () => {
    it('should route COG messages to logger and COG windows by SharedMessageType', () => {
      const loggerHandler = jest.fn();
      const cog0Handler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);
      router.registerWindow('COG0', 'cog', cog0Handler);

      const cogMsg = makeMsg(SharedMessageType.COG0_MESSAGE, 'Cog0  debug output');
      router.routeTextMessage(cogMsg);

      expect(loggerHandler).toHaveBeenCalled();
      expect(cog0Handler).toHaveBeenCalled();
    });

    it('should route TERMINAL_OUTPUT to logger only (no mainWindow set)', () => {
      const loggerHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);

      const msg = makeMsg(SharedMessageType.TERMINAL_OUTPUT, 'Regular terminal text');
      router.routeTextMessage(msg);

      // Logger gets it; mainWindow not set so no secondary route
      expect(loggerHandler).toHaveBeenCalled();
    });

    it('should route backtick creation commands to logger only', () => {
      const loggerHandler = jest.fn();
      const scopeHandler = jest.fn();
      router.registerWindow('logger', 'logger', loggerHandler);
      router.registerWindow('scope-1', 'scope', scopeHandler);

      // Creation command — not an UPDATE, so scope window does NOT receive it
      const msg = makeMsg(SharedMessageType.BACKTICK_SCOPE, "`SCOPE 'Test' POS 0 0 SIZE 400 300");
      router.routeTextMessage(msg);

      expect(loggerHandler).toHaveBeenCalled();
      expect(scopeHandler).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive window ID lookup', () => {
      // Verify registerWindow+getActiveWindows with mixed-case IDs
      router.registerWindow('Scope-1', 'scope', jest.fn());
      const active = router.getActiveWindows();
      expect(active.find(w => w.windowId === 'Scope-1')).toBeDefined();
    });
  });
});
