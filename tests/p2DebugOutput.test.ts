/** @format */

// tests/p2DebugOutput.test.ts
// Tests using actual P2 debug output from test-log-forParsing.log

import { MainWindow } from '../src/classes/mainWindow';
import { DebugLoggerWindow } from '../src/classes/debugLoggerWin';
import { setupDebugWindowTests } from './shared/debugWindowTestUtils';

// Mock electron
jest.mock('electron', () => ({
  app: {
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    quit: jest.fn(),
    getPath: jest.fn().mockReturnValue('/tmp'),
  },
  BrowserWindow: jest.fn(),
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

describe('P2 Debug Output Processing', () => {
  let mainWindow: MainWindow;
  let mockContext: any;
  let cleanup: () => void;
  
  // Actual P2 debug output from test-log-forParsing.log
  const P2_DEBUG_OUTPUT = [
    "Cog0  INIT $0000_0000 $0000_0000 load",
    "Cog0  INIT $0000_0EB8 $0000_1570 jump",
    "`LOGIC MyLogic POS 100 100 SAMPLES 32 'Low' 3 'Mid' 2 'High'",
    "`MyLogic TRIGGER $07 $04 HOLDOFF 2",
    "`MyLogic 0",
    "`MyLogic 1",
    "`TERM MyTerm SIZE 9 1 TEXTSIZE 40",
    "`MyTerm 1 'Temp = 50'",
    "`MyTerm 1 'Temp = 51'",
    "`MyTerm 1 'Temp = 52'",
    "`MyTerm 1 'Temp = 53'",
    "`MyTerm 1 'Temp = 54'",
    "`MyTerm 1 'Temp = 55'",
    "`MyTerm 1 'Temp = 56'",
    "`MyTerm 1 'Temp = 57'",
    "`MyTerm 1 'Temp = 58'",
    "`MyTerm 1 'Temp = 59'",
    "`MyTerm 1 'Temp = 60'",
    "`MyLogic close",
    "`MyTerm close"
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up test environment
    const testSetup = setupDebugWindowTests({
      windowType: 'term',
      displayName: 'TestLogger'
    });
    mockContext = testSetup.mockContext;
    
    // Add runEnvironment to context for MainWindow
    mockContext.runEnvironment = {
      selectedPropPlug: '/dev/tty.mock',
      loggingEnabled: true,
      serialPortDevices: ['/dev/tty.mock'],
      ideMode: false,
      quiet: false,
      verbose: false
    };
    
    cleanup = testSetup.cleanup;
    
    // Create MainWindow instance
    mainWindow = new MainWindow(mockContext);
  });
  
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });
  
  describe('Cog message processing', () => {
    it('should detect and route Cog messages to debug logger', () => {
      const handleCogMessageSpy = jest.spyOn(mainWindow as any, 'handleCogMessage');
      
      // Process Cog INIT messages
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[0]);
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[1]);
      
      // Verify Cog messages were detected
      expect(handleCogMessageSpy).toHaveBeenCalledTimes(2);
      expect(handleCogMessageSpy).toHaveBeenCalledWith("Cog0  INIT $0000_0000 $0000_0000 load");
      expect(handleCogMessageSpy).toHaveBeenCalledWith("Cog0  INIT $0000_0EB8 $0000_1570 jump");
    });
    
    it('should auto-create DebugLoggerWindow on first Cog message', () => {
      const getInstanceSpy = jest.spyOn(DebugLoggerWindow, 'getInstance');
      
      // Process first Cog message
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[0]);
      
      // Verify logger was created
      expect(getInstanceSpy).toHaveBeenCalledWith(mockContext);
    });
    
    it('should route all Cog messages to logger window', () => {
      // Create mock logger
      const mockLogger = {
        updateContent: jest.fn(),
        on: jest.fn(),
      };
      jest.spyOn(DebugLoggerWindow, 'getInstance').mockReturnValue(mockLogger as any);
      
      // Process both Cog messages
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[0]);
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[1]);
      
      // Verify both were sent to logger
      expect(mockLogger.updateContent).toHaveBeenCalledTimes(2);
      expect(mockLogger.updateContent).toHaveBeenCalledWith("Cog0  INIT $0000_0000 $0000_0000 load");
      expect(mockLogger.updateContent).toHaveBeenCalledWith("Cog0  INIT $0000_0EB8 $0000_1570 jump");
    });
  });
  
  describe('Backtick command processing', () => {
    it('should detect and route backtick commands', () => {
      const handleDebugCommandSpy = jest.spyOn(mainWindow as any, 'handleDebugCommand');
      
      // Set up state
      (mainWindow as any).waitingForINIT = false;
      
      // Process LOGIC window creation command
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[2]);
      
      // Verify command was detected
      expect(handleDebugCommandSpy).toHaveBeenCalledWith(
        "`LOGIC MyLogic POS 100 100 SAMPLES 32 'Low' 3 'Mid' 2 'High'"
      );
    });
    
    it('should handle window creation commands', () => {
      const handleDebugCommandSpy = jest.spyOn(mainWindow as any, 'handleDebugCommand');
      
      // Set up state
      (mainWindow as any).waitingForINIT = false;
      
      // Process window creation commands
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[2]); // LOGIC window
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[6]); // TERM window
      
      // Verify commands were handled
      expect(handleDebugCommandSpy).toHaveBeenCalledTimes(2);
    });
    
    it('should handle window update commands', () => {
      const handleDebugCommandSpy = jest.spyOn(mainWindow as any, 'handleDebugCommand');
      
      // Set up state
      (mainWindow as any).waitingForINIT = false;
      
      // Process window updates
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[4]); // MyLogic 0
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[5]); // MyLogic 1
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[7]); // MyTerm update
      
      // Verify commands were handled
      expect(handleDebugCommandSpy).toHaveBeenCalledTimes(3);
    });
    
    it('should handle window close commands', () => {
      const handleDebugCommandSpy = jest.spyOn(mainWindow as any, 'handleDebugCommand');
      
      // Set up state
      (mainWindow as any).waitingForINIT = false;
      
      // Process close commands
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[18]); // MyLogic close
      (mainWindow as any).handleSerialRx(P2_DEBUG_OUTPUT[19]); // MyTerm close
      
      // Verify commands were handled
      expect(handleDebugCommandSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Complete P2 debug session', () => {
    it('should process entire debug session correctly', () => {
      const handleCogMessageSpy = jest.spyOn(mainWindow as any, 'handleCogMessage');
      const handleDebugCommandSpy = jest.spyOn(mainWindow as any, 'handleDebugCommand');
      
      // Create mock logger
      const mockLogger = {
        updateContent: jest.fn(),
        on: jest.fn(),
      };
      jest.spyOn(DebugLoggerWindow, 'getInstance').mockReturnValue(mockLogger as any);
      
      // Set up state
      (mainWindow as any).waitingForINIT = false;
      
      // Process entire P2 output
      P2_DEBUG_OUTPUT.forEach(line => {
        (mainWindow as any).handleSerialRx(line);
      });
      
      // Verify Cog messages
      expect(handleCogMessageSpy).toHaveBeenCalledTimes(2); // Only first 2 lines
      
      // Verify backtick commands
      expect(handleDebugCommandSpy).toHaveBeenCalledTimes(18); // All backtick lines
      
      // Verify logger received Cog messages
      expect(mockLogger.updateContent).toHaveBeenCalledTimes(2);
    });
    
    it('should maintain message order during processing', () => {
      const messages: string[] = [];
      
      // Mock to capture order
      jest.spyOn(mainWindow as any, 'handleCogMessage').mockImplementation((msg) => {
        messages.push(`COG: ${msg}`);
      });
      
      jest.spyOn(mainWindow as any, 'handleDebugCommand').mockImplementation((cmd) => {
        messages.push(`CMD: ${cmd}`);
      });
      
      // Set up state
      (mainWindow as any).waitingForINIT = false;
      
      // Process lines
      P2_DEBUG_OUTPUT.slice(0, 7).forEach(line => {
        (mainWindow as any).handleSerialRx(line);
      });
      
      // Verify order preserved
      expect(messages[0]).toBe("COG: Cog0  INIT $0000_0000 $0000_0000 load");
      expect(messages[1]).toBe("COG: Cog0  INIT $0000_0EB8 $0000_1570 jump");
      expect(messages[2]).toBe("CMD: `LOGIC MyLogic POS 100 100 SAMPLES 32 'Low' 3 'Mid' 2 'High'");
      expect(messages[3]).toBe("CMD: `MyLogic TRIGGER $07 $04 HOLDOFF 2");
    });
  });
  
  describe('Performance with rapid messages', () => {
    it('should handle rapid message burst without loss', () => {
      const mockLogger = {
        updateContent: jest.fn(),
        on: jest.fn(),
      };
      jest.spyOn(DebugLoggerWindow, 'getInstance').mockReturnValue(mockLogger as any);
      
      // Set up state
      (mainWindow as any).waitingForINIT = false;
      
      // Send 100 rapid Cog messages
      for (let i = 0; i < 100; i++) {
        (mainWindow as any).handleSerialRx(`Cog0  Message ${i}`);
      }
      
      // All should be captured
      expect(mockLogger.updateContent).toHaveBeenCalledTimes(100);
    });
    
    it('should handle interleaved Cog and backtick messages', () => {
      const handleCogMessageSpy = jest.spyOn(mainWindow as any, 'handleCogMessage');
      const handleDebugCommandSpy = jest.spyOn(mainWindow as any, 'handleDebugCommand');
      
      // Set up state
      (mainWindow as any).waitingForINIT = false;
      
      // Interleaved messages
      const interleaved = [
        "Cog0  Debug 1",
        "`TERM Test SIZE 10 10",
        "Cog1  Debug 2",
        "`Test 1 'data'",
        "Cog2  Debug 3"
      ];
      
      interleaved.forEach(line => {
        (mainWindow as any).handleSerialRx(line);
      });
      
      // Verify correct routing
      expect(handleCogMessageSpy).toHaveBeenCalledTimes(3);
      expect(handleDebugCommandSpy).toHaveBeenCalledTimes(2);
    });
  });
});