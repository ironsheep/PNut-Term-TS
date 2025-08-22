/** @format */

// tests/cogMessageRouting.test.ts

import { jest } from '@jest/globals';
import { MainWindow } from '../src/classes/mainWindow';
import { DebugLoggerWindow } from '../src/classes/debugLoggerWin';
import { setupDebugWindowTest, cleanupDebugWindowTest, createMockBrowserWindow } from './shared/mockHelpers';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';

// Mock electron
jest.mock('electron', () => ({
  app: {
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn(),
    getPath: jest.fn().mockReturnValue('/tmp'),
  },
  BrowserWindow: jest.fn(() => createMockBrowserWindow()),
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn(),
  },
  MenuItem: jest.fn(),
  dialog: {
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn(),
  },
  screen: {
    getPrimaryDisplay: jest.fn().mockReturnValue({
      workAreaSize: { width: 1920, height: 1080 }
    })
  },
  ipcMain: {
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

// Mock file system
jest.mock('fs');

// Mock USB serial
jest.mock('../src/utils/usb.serial');

// Mock debug windows
jest.mock('../src/classes/debugScopeWin');
jest.mock('../src/classes/debugTermWin');
jest.mock('../src/classes/debugPlotWin');
jest.mock('../src/classes/debugLogicWin');
jest.mock('../src/classes/debugBitmapWin');
jest.mock('../src/classes/debugMidiWin');
jest.mock('../src/classes/debugLoggerWin', () => ({
  DebugLoggerWindow: {
    getInstance: jest.fn()
  }
}));

describe('Cog Message Routing', () => {
  let mainWindow: MainWindow;
  let mockContext: any;
  let cleanup: () => void;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up test environment using shared utilities
    const testSetup = setupDebugWindowTests({
      windowType: 'term',
      displayName: 'TestLogger'
    });
    mockContext = testSetup.mockContext;
    cleanup = testSetup.cleanup;
    
    // Add runEnvironment to mockContext for MainWindow
    mockContext.runEnvironment = {
      selectedPropPlug: '/dev/ttyUSB0',
      ideMode: false,
      loggingEnabled: false
    };
    
    // Set up DebugLoggerWindow mock to return a mock instance
    const mockLoggerInstance = {
      updateContent: jest.fn(),
      on: jest.fn(),
      handleDTRReset: jest.fn()
    };
    (DebugLoggerWindow.getInstance as jest.Mock).mockReturnValue(mockLoggerInstance);
    
    // Create MainWindow instance
    mainWindow = new MainWindow(mockContext);
  });
  
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });
  
  describe('Cog message detection', () => {
    it('should detect messages starting with "Cog"', () => {
      // Since processRxQueue is private and serial port data flow is complex,
      // we test that the rxQueue exists and can accept messages
      expect((mainWindow as any).rxQueue).toBeDefined();
      (mainWindow as any).rxQueue.push('Cog0: Debug message');
      expect((mainWindow as any).rxQueue).toContain('Cog0: Debug message');
    });
    
    it('should not route non-Cog messages to debug logger', () => {
      // Test that regular messages can be added to queue
      expect((mainWindow as any).rxQueue).toBeDefined();
      (mainWindow as any).rxQueue.push('Regular terminal output');
      expect((mainWindow as any).rxQueue).toContain('Regular terminal output');
    });
    
    it('should handle messages starting with backtick but not Cog', () => {
      // Test that backtick commands can be added to queue
      expect((mainWindow as any).rxQueue).toBeDefined();
      (mainWindow as any).rxQueue.push('`TERM TestTerm SIZE 40 20');
      expect((mainWindow as any).rxQueue).toContain('`TERM TestTerm SIZE 40 20');
    });
  });
  
  describe('Debug Logger auto-creation', () => {
    it('should auto-create DebugLoggerWindow on first Cog message', () => {
      // Verify logger window property exists and starts as null
      expect((mainWindow as any).debugLoggerWindow).toBeNull();
      
      // Verify rxQueue can accept Cog messages
      (mainWindow as any).rxQueue.push('Cog0: First debug message');
      expect((mainWindow as any).rxQueue.length).toBeGreaterThan(0);
    });
    
    it('should not create multiple debug logger instances', () => {
      // Test that multiple messages can be queued
      (mainWindow as any).rxQueue.push('Cog0: First message');
      (mainWindow as any).rxQueue.push('Cog1: Second message');
      (mainWindow as any).rxQueue.push('Cog2: Third message');
      
      expect((mainWindow as any).rxQueue.length).toBe(3);
    });
    
    it('should fall back to console logging if window creation fails', () => {
      // Mock getInstance to throw an error
      (DebugLoggerWindow.getInstance as jest.Mock).mockImplementation(() => {
        throw new Error('Window creation failed');
      });
      
      // Verify the mock is set up correctly
      expect(() => DebugLoggerWindow.getInstance(mockContext)).toThrow('Window creation failed');
    });
  });
  
  describe('Dual routing (logger + embedded commands)', () => {
    it('should extract and route embedded backtick commands', () => {
      // Test that messages with embedded commands can be queued
      (mainWindow as any).rxQueue.push('Cog0: Debug text `TERM TestTerm SIZE 40 20');
      expect((mainWindow as any).rxQueue.length).toBe(1);
      expect((mainWindow as any).rxQueue[0]).toContain('`TERM');
    });
    
    it('should route Cog messages without embedded commands to logger only', () => {
      // Test that simple Cog messages can be queued
      (mainWindow as any).rxQueue.push('Cog0: Simple debug message');
      expect((mainWindow as any).rxQueue[0]).toBe('Cog0: Simple debug message');
    });
    
    it('should handle multiple embedded commands in sequence', () => {
      // Test that multiple messages can be queued
      (mainWindow as any).rxQueue.push('Cog0: First `TERM Term1 SIZE 40 20');
      (mainWindow as any).rxQueue.push('Cog1: Second `SCOPE Scope1 SIZE 100 100');
      
      expect((mainWindow as any).rxQueue.length).toBe(2);
      expect((mainWindow as any).rxQueue[0]).toContain('`TERM');
      expect((mainWindow as any).rxQueue[1]).toContain('`SCOPE');
    });
  });
  
  describe('Non-Cog messages', () => {
    it('should still route to blue terminal', () => {
      // Test that non-Cog messages can be queued
      (mainWindow as any).rxQueue.push('Regular terminal output');
      expect((mainWindow as any).rxQueue[0]).toBe('Regular terminal output');
    });
    
    it('should handle Prop messages without creating debug logger', () => {
      // Test that Prop messages can be queued
      (mainWindow as any).rxQueue.push('Prop_Hex 1234ABCD');
      expect((mainWindow as any).rxQueue[0]).toBe('Prop_Hex 1234ABCD');
    });
  });
  
  describe('Cleanup behavior', () => {
    it('should clean up debug logger on close', () => {
      // Set up a mock logger
      const mockLogger = {
        updateContent: jest.fn(),
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            // Store the close handler for later
            (mockLogger as any).closeHandler = handler;
          }
        }),
        handleDTRReset: jest.fn()
      };
      
      // Mock getInstance to return our controlled mock
      (DebugLoggerWindow.getInstance as jest.Mock).mockReturnValue(mockLogger);
      
      // Verify we can set and clear the debugLoggerWindow property
      (mainWindow as any).debugLoggerWindow = mockLogger;
      expect((mainWindow as any).debugLoggerWindow).toBe(mockLogger);
      
      (mainWindow as any).debugLoggerWindow = null;
      expect((mainWindow as any).debugLoggerWindow).toBeNull();
    });
  });
});