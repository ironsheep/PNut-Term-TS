/**
 * Test Debug Logger window creation and routing
 */

import { MainWindow } from '../src/classes/mainWindow';
import { LoggerWindow } from '../src/classes/loggerWin';
import { Context } from '../src/utils/context';
import { WindowRouter } from '../src/classes/shared/windowRouter';

// Mock Electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp'),
    getName: jest.fn(() => 'pnut-term-ts'),
    getVersion: jest.fn(() => '0.1.0'),
    quit: jest.fn(),
    on: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn(() => false),
    webContents: {
      send: jest.fn(),
      executeJavaScript: jest.fn(),
      on: jest.fn(),
      openDevTools: jest.fn(),
    },
    setPosition: jest.fn(),
    getPosition: jest.fn(() => [100, 100]),
    getSize: jest.fn(() => [800, 600]),
    getBounds: jest.fn(() => ({ x: 100, y: 100, width: 800, height: 600 })),
    setSize: jest.fn(),
    setTitle: jest.fn(),
    id: 1,
  })),
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn(),
  },
  MenuItem: jest.fn(),
  screen: {
    getAllDisplays: jest.fn(() => [
      { 
        id: 1, 
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 25, width: 1920, height: 1055 }
      }
    ]),
    getPrimaryDisplay: jest.fn(() => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 25, width: 1920, height: 1055 }
    })),
  },
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
}));

// Mock serial port
jest.mock('@serialport/bindings-cpp', () => ({
  autoDetect: jest.fn(() => ({
    list: jest.fn(() => Promise.resolve([])),
  })),
}));

jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    write: jest.fn(),
    close: jest.fn(),
    isOpen: true,
    set: jest.fn(),
  })),
}));

// Mock fs for log file operations
jest.mock('fs');

describe('Debug Logger Routing', () => {
  let mainWindow: MainWindow;
  let context: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create context with all required properties
    context = {
      homeDirectory: '/tmp',
      isPackaged: false,
      isDevelopment: true,
      isWindows: false,
      isMac: false,
      isLinux: true,
      appPath: '/tmp',
      documentsDirectory: '/tmp',
      libraryFolder: '/tmp/library',
      extensionFolder: '/tmp/extensions',
      currentFolder: '/tmp',
      logger: console,
      runEnvironment: {
        selectedPropPlug: '/dev/ttyUSB0',
        loggingEnabled: false,
        downloadBaud: 115200,
        terminalBaud: 115200,
        cliMode: false,
        verboseMode: false,
      },
      settings: {
        showDTR: true,
        showRTS: false,
        serialEcho: false,
        currentTheme: 'dark',
        debuggerFont: 'monospace',
        selectedRAMAddress: false,
        selectedFLASHAddress: true,
      }
    } as unknown as Context;
    
    // Create main window (constructor only takes context)
    mainWindow = new MainWindow(context);
  });

  afterEach(() => {
    // Clean up singleton
    (LoggerWindow as any).instance = null;
    // Clean up router if it has cleanup method
    const router = WindowRouter.getInstance();
    if (typeof (router as any).cleanup === 'function') {
      (router as any).cleanup();
    }
  });

  describe('Cog message routing', () => {
    it('should create Debug Logger window on first INIT or Cog message', () => {
      // Simulate P2 boot sequence - INIT messages come first after DTR/RTS
      const initMessage = 'INIT $0000_0000 $0000_0000 load';
      
      // Simulate serial receive by pushing to queue and processing
      (mainWindow as any).rxQueue.push(initMessage);
      (mainWindow as any).processRxQueue();
      
      // Verify Debug Logger was created
      expect((mainWindow as any).loggerWindow).toBeDefined();
      expect((mainWindow as any).displays['DebugLogger']).toBeDefined();
    });

    it('should route Cog messages to Debug Logger after INIT', () => {
      // First INIT to create window (happens after DTR/RTS reset)
      (mainWindow as any).rxQueue.push('INIT $0000_0000 $0000_0000 load');
      (mainWindow as any).processRxQueue();
      
      const messages = [
        'Cog0  Debug message 1',
        'Cog1  Debug message 2', 
        'Cog2  Debug message 3',
      ];
      
      // Process messages
      messages.forEach(msg => {
        (mainWindow as any).rxQueue.push(msg);
        (mainWindow as any).processRxQueue();
      });
      
      // Get the logger instance
      const logger = (mainWindow as any).loggerWindow;
      expect(logger).toBeDefined();
      
      // Check that appendLog was called for each message
      const appendLogSpy = jest.spyOn(logger, 'appendLog');
      
      // Process another message to test the spy
      (mainWindow as any).processRxData('Cog3  Debug message 4');
      expect(appendLogSpy).toHaveBeenCalledWith('Cog3  Debug message 4');
    });

    it('should route INIT messages to Debug Logger', () => {
      // INIT messages are first after DTR/RTS - they start new log
      const initMessage = 'INIT $0000_0000 $0000_0000 load';
      
      (mainWindow as any).rxQueue.push(initMessage);
      (mainWindow as any).processRxQueue();
      
      // Verify Debug Logger was created
      expect((mainWindow as any).loggerWindow).toBeDefined();
      
      // Verify message was routed
      const logger = (mainWindow as any).loggerWindow;
      const appendLogSpy = jest.spyOn(logger, 'appendLog');
      
      // Process another INIT message
      (mainWindow as any).rxQueue.push('INIT $0000_1000 $0000_2000 data');
      (mainWindow as any).processRxQueue();
      expect(appendLogSpy).toHaveBeenCalledWith('INIT $0000_1000 $0000_2000 data');
    });

    it('should extract and process embedded backtick commands', () => {
      // Cog message with embedded command
      const messageWithCommand = "Cog0  Debug output `SCOPE 'Test Scope' POS 200 200 SIZE 400 300";
      
      // Spy on handleDebugCommand
      const handleDebugCommandSpy = jest.spyOn(mainWindow as any, 'handleDebugCommand');
      
      (mainWindow as any).rxQueue.push(messageWithCommand);
      (mainWindow as any).processRxQueue();
      
      // Verify command was extracted and processed
      expect(handleDebugCommandSpy).toHaveBeenCalledWith(
        "`SCOPE 'Test Scope' POS 200 200 SIZE 400 300"
      );
      
      // Verify message still went to logger (without command)
      const logger = (mainWindow as any).loggerWindow;
      expect(logger).toBeDefined();
    });

    it('should NOT route non-Cog messages to Debug Logger', () => {
      // Regular output should go to blue terminal
      const regularMessage = 'Regular terminal output';
      
      // Spy on appendLog for blue terminal
      const appendLogSpy = jest.spyOn(mainWindow as any, 'appendLog');
      
      (mainWindow as any).rxQueue.push(regularMessage);
      (mainWindow as any).processRxQueue();
      
      // Should go to blue terminal
      expect(appendLogSpy).toHaveBeenCalledWith(regularMessage);
      
      // Should NOT create Debug Logger
      expect((mainWindow as any).loggerWindow).toBeUndefined();
    });

    it('should handle rapid Cog messages efficiently', () => {
      // Simulate rapid message stream
      const messages = [];
      for (let i = 0; i < 100; i++) {
        messages.push(`Cog${i % 8}  High speed message ${i}`);
      }
      
      // Process all messages rapidly
      const startTime = Date.now();
      messages.forEach(msg => {
        (mainWindow as any).rxQueue.push(msg);
        (mainWindow as any).processRxQueue();
      });
      const elapsed = Date.now() - startTime;
      
      // Should process quickly (< 100ms for 100 messages)
      expect(elapsed).toBeLessThan(100);
      
      // Logger should be created
      const logger = (mainWindow as any).loggerWindow;
      expect(logger).toBeDefined();
    });
  });

  describe('Window lifecycle', () => {
    it('should handle Debug Logger window close', () => {
      // Create logger
      (mainWindow as any).processRxData('Cog0  Test message');
      const logger = (mainWindow as any).loggerWindow;
      expect(logger).toBeDefined();
      
      // Simulate window close
      logger.emit('close');
      
      // Should be removed from displays
      expect((mainWindow as any).displays['DebugLogger']).toBeUndefined();
      expect((mainWindow as any).loggerWindow).toBeNull();
    });

    it('should recreate Debug Logger if closed and new Cog message arrives', () => {
      // Create and close
      (mainWindow as any).processRxData('Cog0  First message');
      const firstLogger = (mainWindow as any).loggerWindow;
      firstLogger.emit('close');
      
      // Send new Cog message
      (mainWindow as any).processRxData('Cog1  Second message');
      
      // Should have new logger
      const secondLogger = (mainWindow as any).loggerWindow;
      expect(secondLogger).toBeDefined();
      expect(secondLogger).not.toBe(firstLogger);
    });
  });
});