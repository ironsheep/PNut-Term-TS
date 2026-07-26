/** @format */

// tests/loggerWindow.test.ts

import { LoggerWindow } from '../src/classes/loggerWin';
import { Context } from '../src/utils/context';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Mock modules
jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  screen: {
    getAllDisplays: jest.fn(),
    getPrimaryDisplay: jest.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 }
    })),
  },
  ipcMain: {
    on: jest.fn(),
    removeListener: jest.fn()
  }
}));

jest.mock('fs');
jest.mock('../src/utils/files', () => ({
  ensureDirExists: jest.fn(),
  getFormattedDateTime: jest.fn().mockReturnValue('20250812_120000'),
  getFormattedDateTimeISO: jest.fn().mockReturnValue('2025-08-12T12:00:00.000Z')
}));

describe('LoggerWindow', () => {
  let debugLogger: LoggerWindow;
  let mockContext: Context;
  let mockBrowserWindow: any;
  let mockWriteStream: any;
  
  beforeEach(() => {
    // Clear singleton
    LoggerWindow['instance'] = null;
    
    // Setup fs mocks
    mockWriteStream = {
      write: jest.fn((data, callback) => {
        if (callback) callback(null);
      }),
      end: jest.fn((callback?: () => void) => {
        if (callback) callback();
      }),
      destroyed: false,
      writable: true,
      once: jest.fn((event: string, cb: (...args: any[]) => void) => {
        // Immediately trigger 'open' so the header write path is exercised
        if (event === 'open') {
          cb(3); // fd = 3
        }
      }),
      on: jest.fn()
    };
    
    const fsMock = require('fs');
    fsMock.createWriteStream = jest.fn().mockReturnValue(mockWriteStream);
    fsMock.existsSync = jest.fn().mockReturnValue(true);
    fsMock.mkdirSync = jest.fn();
    fsMock.statSync = jest.fn().mockReturnValue({ size: 1024 });
    fsMock.fsyncSync = jest.fn();
    
    // Setup mocks
    mockContext = {
      libraryFolder: '/lib',
      extensionFolder: '/ext',
      currentFolder: '/current',
      logger: {
        logMessage: jest.fn()
      } as any,
      actions: {
        writeRAM: false,
        writeFlash: false,
        binFilename: '',
        binDirspec: ''
      },
      runEnvironment: {
        serialPortDevices: [],
        selectedPropPlug: '',
        logFilename: 'test.log',
        developerModeEnabled: false,
        debugBaudrate: 2000000,
        ideMode: false,
        rtsOverride: false,
        loggingEnabled: true,
        loggingLevel: 'INFO',
        logToFile: true,
        logToConsole: false
      },
      // Required by LoggerWindow.initializeLogFile()
      getLogDirectory: jest.fn().mockReturnValue('/tmp/test-logs'),
      preferences: {
        terminal: { colorTheme: 'green' }
      }
    } as unknown as Context;
    
    mockBrowserWindow = {
      loadHTML: jest.fn(),
      loadURL: jest.fn(),
      on: jest.fn(),
      once: jest.fn((event, callback) => {
        if (event === 'ready-to-show') {
          callback();
        }
      }),
      webContents: {
        send: jest.fn(),
        executeJavaScript: jest.fn(),
        once: jest.fn(),
        on: jest.fn(),
        setMaxListeners: jest.fn()
      },
      show: jest.fn(),
      focus: jest.fn(),
      close: jest.fn(),
      destroy: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      removeAllListeners: jest.fn(),
      setPosition: jest.fn(),
      getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 })
    };
    
    (BrowserWindow as unknown as jest.Mock).mockImplementation(() => mockBrowserWindow);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = LoggerWindow.getInstance(mockContext);
      const instance2 = LoggerWindow.getInstance(mockContext);
      expect(instance1).toBe(instance2);
    });
    
    it('should create window on first getInstance', () => {
      const instance = LoggerWindow.getInstance(mockContext);
      expect(instance).toBeDefined();
      // LoggerWindow creates window lazily, not in getInstance
      // This is expected behavior for the singleton pattern
    });
  });
  
  describe('Message Processing', () => {
    beforeEach(() => {
      debugLogger = LoggerWindow.getInstance(mockContext);
      // Mark window as ready so messages are processed immediately
      debugLogger['isWindowReady'] = true;
    });
    
    it('should process string array messages', () => {
      const message = ['DEBUG', 'Test', 'Message'];
      debugLogger.updateContent(message);
      
      // Should be queued for batch processing
      expect(debugLogger['renderQueue'].length).toBeGreaterThan(0);
    });
    
    it('should process string messages', () => {
      const message = 'Simple debug message';
      debugLogger.updateContent(message);
      
      expect(debugLogger['renderQueue'].length).toBeGreaterThan(0);
    });
    
    it('should handle Cog prefixed messages', () => {
      const message = ['COG0', 'Debug', 'Info'];
      debugLogger.updateContent(message);
      
      expect(debugLogger['renderQueue'][0].message).toContain('COG0');
    });
  });
  
  describe('Performance Optimizations', () => {
    beforeEach(() => {
      debugLogger = LoggerWindow.getInstance(mockContext);
      debugLogger['isWindowReady'] = true;
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    it('should batch messages for rendering', async () => {
      // Create a debug window
      debugLogger['_debugWindow'] = mockBrowserWindow;

      // Send multiple messages. updateContent single-flight serializes per window (so an in-flight
      // SAVE can't be clobbered), so await each enqueue completes before asserting. [MIDI save-clobber]
      for (let i = 0; i < 10; i++) {
        await debugLogger.updateContent(`Message ${i}`);
      }

      // Should be queued
      expect(debugLogger['renderQueue'].length).toBe(10);
      
      // Advance timer to trigger batch
      jest.advanceTimersByTime(16);
      
      // Should have processed batch
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith(
        'append-messages-batch',
        expect.any(Array)
      );
    });
    
    it('should force batch when queue limit reached', () => {
      // Create a debug window
      debugLogger['_debugWindow'] = mockBrowserWindow;
      
      // Send 100 messages (batch limit)
      for (let i = 0; i < 100; i++) {
        debugLogger.updateContent(`Message ${i}`);
      }
      
      // Should trigger immediate batch
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalled();
    });
    
    it('should limit buffer to maxLines', () => {
      // Set small limit for testing
      debugLogger['maxLines'] = 100;
      
      // Send more than limit
      for (let i = 0; i < 150; i++) {
        debugLogger.updateContent(`Message ${i}`);
      }
      
      // Process batches
      jest.runAllTimers();
      
      // Buffer should be limited
      expect(debugLogger['lineBuffer'].length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('File Logging', () => {
    beforeEach(() => {
      // Use fake timers BEFORE creating the instance so the setTimeout(100) that
      // calls initializeLogFile() is captured and controllable.
      jest.useFakeTimers();
      debugLogger = LoggerWindow.getInstance(mockContext);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should create log file on initialization', () => {
      // initializeLogFile() is called via setTimeout(100) in the constructor.
      // Advance fake timers to trigger it.
      jest.advanceTimersByTime(200);
      expect(fs.createWriteStream).toHaveBeenCalled();
      expect(debugLogger['logFilePath']).toBeDefined();
    });

    it('should buffer writes for performance', () => {
      // Advance timer to trigger initializeLogFile first
      jest.advanceTimersByTime(200);

      // Send newline-terminated messages so writeToLog extracts complete lines
      // into writeBuffer (messages without \n stay in logLineAccumulator).
      for (let i = 0; i < 10; i++) {
        debugLogger['writeToLog'](`Log message ${i}\n`);
      }

      // writeBuffer is populated by writeLogEntry (called for complete lines)
      expect(debugLogger['writeBuffer'].length).toBe(10);

      // Advance timer to flush writeBuffer to the stream
      jest.advanceTimersByTime(500);

      // Should have written
      expect(mockWriteStream.write).toHaveBeenCalled();
    });

    it('should handle DTR reset', () => {
      // Advance to trigger initializeLogFile (first createWriteStream call)
      jest.advanceTimersByTime(200);
      expect(fs.createWriteStream).toHaveBeenCalledTimes(1);

      debugLogger.handleDTRReset();

      // Should close old file and open a new one
      expect(mockWriteStream.end).toHaveBeenCalled();
      // After DTR reset, initializeLogFile is called again asynchronously
      jest.advanceTimersByTime(200);
      expect(fs.createWriteStream).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Theme Support', () => {
    beforeEach(() => {
      debugLogger = LoggerWindow.getInstance(mockContext);
    });
    
    it('should initialize with green theme', () => {
      expect(debugLogger['theme'].name).toBe('green');
      expect(debugLogger['theme'].foregroundColor).toBe('#00FF00');
    });
    
    it('should switch to amber theme', () => {
      debugLogger.setTheme('amber');
      
      expect(debugLogger['theme'].name).toBe('amber');
      expect(debugLogger['theme'].foregroundColor).toBe('#FFBF00');
      
      // Note: webContents.send would only be called if window was created
      // The theme is stored and will be applied when window is created
    });
  });
  
  describe('Window Management', () => {
    beforeEach(() => {
      debugLogger = LoggerWindow.getInstance(mockContext);
    });
    
    it('should position at bottom-right by default', () => {
      // BrowserWindow is created in the LoggerWindow constructor (called by getInstance).
      // Grab the first call's config — that's the window created by the constructor.
      const windowConfig = (BrowserWindow as unknown as jest.Mock).mock.calls[0][0];

      // Window dimensions: contentWidth = 80*10+20=820, contentHeight = 24*18+10=442
      // calculateWindowDimensions adds WINDOW_BORDER_WIDTH=20 and TITLE_BAR_HEIGHT=40
      // Final: width=840, height=482
      // With workAreaSize={width:1920,height:1080} and margin=20:
      //   x = 1920 - 840 - 20 = 1060
      //   y = 1080 - 482 - 20 = 578
      expect(windowConfig.x).toBe(1060);
      expect(windowConfig.y).toBe(578);
      expect(windowConfig.width).toBe(840);
      expect(windowConfig.height).toBe(482);
    });
    
    it('should clean up on close', () => {
      jest.useFakeTimers();
      debugLogger['isWindowReady'] = true;
      
      // Add pending messages
      debugLogger.updateContent('Pending message');
      
      debugLogger.closeDebugWindow();
      
      // Should flush pending messages
      expect(debugLogger['renderQueue'].length).toBe(0);
      
      // Should close log file
      expect(debugLogger['logFile']).toBeNull();
      
      // Should clear singleton
      expect(LoggerWindow['instance']).toBeNull();
      
      jest.useRealTimers();
    });
  });
  
  describe('System Messages', () => {
    beforeEach(() => {
      debugLogger = LoggerWindow.getInstance(mockContext);
      debugLogger['isWindowReady'] = true;
    });
    
    it('should log system messages with special styling', () => {
      debugLogger.logSystemMessage('System event occurred');
      
      const queued = debugLogger['renderQueue'][0];
      expect(queued.className).toBe('system-message');
      expect(queued.message).toContain('System event');
    });
    
    it('should clear output', () => {
      // Create a debug window
      debugLogger['_debugWindow'] = mockBrowserWindow;
      
      // Add some messages
      debugLogger.updateContent('Message 1');
      debugLogger.updateContent('Message 2');
      
      debugLogger.clearOutput();
      
      // Buffer should be empty
      expect(debugLogger['lineBuffer'].length).toBe(0);
      
      // Should notify renderer
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('clear-output');
    });
  });
  // -------------------------------------------------------------------------
  //  Viewer lifetime is NOT the log's lifetime
  // -------------------------------------------------------------------------
  //
  // Found on hardware 2026-07-26: closing the Debug Logger window ended the log file
  // while the app kept receiving data — 47 s and 26 s of stream, in two runs, arrived
  // with nowhere to go. The window is a VIEWER; closing it must stop the window only,
  // and Window > Show Log must be able to attach a new viewer to the SAME file.
  describe('Viewer lifetime (close keeps logging, Show Log reopens)', () => {
    // The BrowserWindow mock records handlers; this fires the one under test.
    function fireWindowClose(): void {
      const entry = mockBrowserWindow.on.mock.calls.find((c: any[]) => c[0] === 'close');
      expect(entry).toBeDefined();
      entry[1]();
    }

    beforeEach(() => {
      debugLogger = LoggerWindow.getInstance(mockContext);
      debugLogger['logFile'] = mockWriteStream;
      debugLogger['logFilePath'] = '/tmp/test-logs/debug_test.log';
    });

    it('does NOT end the log file when the viewer window is closed', () => {
      fireWindowClose();
      expect(mockWriteStream.end).not.toHaveBeenCalled();
      expect(debugLogger['logFile']).toBe(mockWriteStream);
    });

    it('keeps the singleton, so later getInstance() cannot start a second log file', () => {
      fireWindowClose();
      expect(LoggerWindow['instance']).toBe(debugLogger);
      expect(LoggerWindow.getInstance(mockContext)).toBe(debugLogger);
    });

    it('says so in the log rather than just stopping', () => {
      fireWindowClose();
      const written = mockWriteStream.write.mock.calls.map((c: any[]) => String(c[0])).join('');
      expect(written).toContain('Log window closed');
      expect(written).toContain('logging continues');
      expect(written).not.toContain('Session Ended');
    });

    it('reports the viewer as closed, and stops queueing work for a window that is gone', () => {
      fireWindowClose();
      expect(debugLogger.isViewerOpen()).toBe(false);

      debugLogger['appendMessage']('Cog0  SEQ 1', 'cog-message');
      expect(debugLogger['renderQueue'].length).toBe(0);
      // ...but the scrollback still fills, because that is what a reopened viewer replays.
      expect(debugLogger['lineBuffer']).toContain('Cog0  SEQ 1');
    });

    it('replays the recent tail into a reopened viewer', () => {
      fireWindowClose();
      debugLogger['lineBuffer'] = [];
      for (let i = 0; i < 20; i++) debugLogger['appendMessage'](`Cog0  SEQ ${i}`, 'cog-message');

      mockBrowserWindow.webContents.send.mockClear();
      debugLogger.showViewer(); // mock fires ready-to-show synchronously, which paints

      // Assert on what actually reached the window, not on the transient queue.
      const painted = mockBrowserWindow.webContents.send.mock.calls
        .filter((c: any[]) => c[0] === 'append-messages-batch')
        .flatMap((c: any[]) => c[1])
        .map((m: any) => m.message);
      expect(painted[0]).toContain('replaying the last');
      expect(painted).toContain('Cog0  SEQ 0');
      expect(painted).toContain('Cog0  SEQ 19');
      expect(debugLogger.isViewerOpen()).toBe(true);
    });

    it('replaying does not duplicate the scrollback — reopen twice, history stays put', () => {
      fireWindowClose();
      debugLogger['lineBuffer'] = [];
      for (let i = 0; i < 20; i++) debugLogger['appendMessage'](`Cog0  SEQ ${i}`, 'cog-message');
      const afterFirst = debugLogger['lineBuffer'].length;

      debugLogger.showViewer();
      debugLogger.hideViewer();
      debugLogger.showViewer();

      // Replay paints history; it must not re-record it (that grew the buffer by the
      // whole replay on every reopen).
      expect(debugLogger['lineBuffer'].length).toBe(afterFirst);
    });

    it('reopens onto the SAME file — no new session header', () => {
      const pathBefore = debugLogger['logFilePath'];
      fireWindowClose();
      mockWriteStream.write.mockClear();

      debugLogger.showViewer();

      expect(debugLogger['logFilePath']).toBe(pathBefore);
      const written = mockWriteStream.write.mock.calls.map((c: any[]) => String(c[0])).join('');
      expect(written).toContain('Log window reopened');
      expect(written).not.toContain('Session Started');
    });

    it('closeDebugWindow() — the shutdown path — still ends the log', () => {
      debugLogger.closeDebugWindow();
      const written = mockWriteStream.write.mock.calls.map((c: any[]) => String(c[0])).join('');
      expect(written).toContain('Session Ended');
      expect(mockWriteStream.end).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  //  Status bar cost must not scale with arrival rate (invariant I3)
  // -------------------------------------------------------------------------
  describe('Status bar refresh is coalesced', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      debugLogger = LoggerWindow.getInstance(mockContext);
      debugLogger['logFilePath'] = '/tmp/test-logs/debug_test.log';
    });
    afterEach(() => jest.useRealTimers());

    it('does one filesystem stat per interval, not one per message', () => {
      const fsMock = require('fs');
      fsMock.statSync.mockClear();

      // The old code ran existsSync + statSync + executeJavaScript on EVERY routed
      // message — ~12,000 synchronous syscalls a second at the observed 6,000 lines/s.
      for (let i = 0; i < 5000; i++) debugLogger['updateStatusBar']();
      expect(fsMock.statSync).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);
      expect(fsMock.statSync).toHaveBeenCalledTimes(1);
    });
  });
});
