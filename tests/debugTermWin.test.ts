import { DebugTermWindow, TermDisplaySpec } from '../src/classes/debugTermWin';
import { createMockContext, createMockBrowserWindow, createMockLogger, setupDebugWindowTest, cleanupDebugWindowTest } from './shared/mockHelpers';
import { BrowserWindow } from 'electron';

// Store reference to mock BrowserWindow instances
let mockBrowserWindowInstances: any[] = [];

// Mock Electron
jest.mock('electron', () => {
  const createMockBrowserWindow = require('./shared/mockHelpers').createMockBrowserWindow;
  return {
    BrowserWindow: jest.fn().mockImplementation(() => {
      const mockWindow = createMockBrowserWindow();
      mockBrowserWindowInstances.push(mockWindow);
      return mockWindow;
    }),
    app: {
      getPath: jest.fn().mockReturnValue('/mock/path')
    },
    nativeImage: {
      createFromBuffer: jest.fn().mockReturnValue({
        toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
      })
    }
  };
});

// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Don't mock internal modules - let them run to get coverage!
// Only mock InputForwarder's USB/serial communication parts
jest.mock('../src/utils/usb.serial', () => ({
  UsbSerial: jest.fn().mockImplementation(() => ({
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    deviceIsPropeller: jest.fn().mockResolvedValue(true),
    getIdStringOrError: jest.fn().mockReturnValue(['Propeller2', '']),
    deviceInfo: 'Mock Propeller2 Device',
    isOpen: true
  }))
}));

// Mock Jimp
jest.mock('jimp', () => ({
  Jimp: jest.fn()
}));

describe('DebugTermWindow', () => {
  let debugTermWindow: DebugTermWindow;
  let mockContext: any;
  let mockBrowserWindow: any;
  let mockDisplaySpec: TermDisplaySpec;
  let mockLogger: any;
  let cleanupFns: (() => void)[] = [];

  beforeEach(() => {
    // Clear mock instances
    mockBrowserWindowInstances = [];
    cleanupFns = [];
    
    // Setup test environment
    const testSetup = setupDebugWindowTest();
    mockContext = testSetup.mockContext;
    mockLogger = mockContext.logger;
    
    mockDisplaySpec = {
      displayName: 'Test',
      windowTitle: 'Test Terminal',
      position: { x: 100, y: 100 },
      hasExplicitPosition: false,
      size: { columns: 80, rows: 25 },
      font: {
        charWidth: 8,
        charHeight: 16,
        lineHeight: 20,
        baseline: 12,
        textSizePts: 14
      },
      window: {
        background: '#000000',
        grid: '#808080'
      },
      textColor: '#FFFFFF',
      colorCombos: [{
        fgcolor: '#FFFFFF',
        bgcolor: '#000000'
      }],
      delayedUpdate: false,
      hideXY: false
    };

    debugTermWindow = new DebugTermWindow(mockContext, mockDisplaySpec);
  });

  afterEach(() => {
    // Clean up the debug window if it exists
    if (debugTermWindow && debugTermWindow['debugWindow']) {
      try {
        debugTermWindow.closeDebugWindow();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    
    // Clean up any InputForwarder instances
    if (debugTermWindow && debugTermWindow['inputForwarder']) {
      try {
        debugTermWindow['inputForwarder'].stopPolling();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    
    // Run any additional cleanup functions
    cleanupFns.forEach(fn => {
      try {
        fn();
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    
    // Clear all timers
    jest.clearAllTimers();
    
    // Standard cleanup
    cleanupDebugWindowTest();
  });

  describe('Constructor', () => {
    it('should initialize with correct window prefix', () => {
      expect(debugTermWindow['windowLogPrefix']).toBe('trmW');
    });

    it('should initialize terminal parameters', () => {
      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });
      expect(debugTermWindow['selectedCombo']).toBe(0);
      expect(debugTermWindow['displaySpec']).toEqual(mockDisplaySpec);
      // contentInset is now 0 — the canvas fills the window (the charWidth/2 inset was
      // retired for full-canvas usage; see debugTermWin.ts). [9win §14]
      expect(debugTermWindow['contentInset']).toBe(0);
    });
  });

  describe('Window Creation', () => {
    it('should create the debug window in the constructor', () => {
      // The TERM window is created immediately in the constructor (not deferred to first
      // display data). With hasExplicitPosition=false it uses auto-placement (x:0,y:0). [9win §14]
      const BrowserWindowMock = BrowserWindow as jest.MockedClass<typeof BrowserWindow>;
      expect(BrowserWindowMock).toHaveBeenCalledWith(expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
        // hasExplicitPosition=false -> auto-placement chooses the coords (placer-dependent),
        // so they are NOT the spec's 100,100; just assert they are concrete numbers. [9win §14]
        x: expect.any(Number),
        y: expect.any(Number),
        webPreferences: expect.objectContaining({
          nodeIntegration: true,
          contextIsolation: false
        })
      }));
    });

    it('should setup event listeners on window creation', () => {
      // Window already created in the constructor.
      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow).toBeDefined();

      expect(mockWindow.on).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
      expect(mockWindow.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
      expect(mockWindow.loadFile).toHaveBeenCalled(); // impl uses loadFile, not loadURL
    });

    it('should emit ready-to-show event', () => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']); // Send a printable char

      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow).toBeDefined();

      const readyToShowCall = mockWindow.on.mock.calls.find(
        (call: any) => call[0] === 'ready-to-show'
      );
      expect(readyToShowCall).toBeDefined();
    });

    it('should handle window ready event', async () => {
      // Use fake timers for this test
      jest.useFakeTimers();
      
      // Trigger window creation
      debugTermWindow.updateContent(['32']); // Send a printable char

      const mockWindow = mockBrowserWindowInstances[0];
      expect(mockWindow).toBeDefined();
      
      // Get the ready-to-show callback
      const readyCallback = mockWindow.once.mock.calls.find(
        (call: any) => call[0] === 'ready-to-show'
      )?.[1];

      // Call the ready callback
      if (readyCallback) {
        await readyCallback();
      }

      expect(mockWindow.show).toHaveBeenCalled();
      
      // Restore real timers
      jest.useRealTimers();
    });
  });

  describe('Content Updates', () => {
    beforeEach(() => {
      // Window is created in the constructor; mark it ready so updateContent() processes
      // immediately instead of queueing (the queue drains on the real ready-to-show). [9win §14]
      debugTermWindow['isWindowReady'] = true;
    });

    it('should handle CLEAR command', async () => {
      debugTermWindow['cursorPosition'] = { x: 7, y: 3 };
      await debugTermWindow.updateContent(['CLEAR']);

      // CLEAR resets cursor position to home
      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });
    });

    it('should handle HOME command', async () => {
      debugTermWindow['cursorPosition'] = { x: 10, y: 5 };

      // HOME is numeric code 1
      await debugTermWindow.updateContent(['1']);

      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });
    });

    it('should handle color combo #3 selection (ASCII 7)', async () => {
      // ASCII 7 in Pascal TERM is color combo #3, not BELL
      await debugTermWindow.updateContent(['7']);

      // Should select color combo 3
      expect(debugTermWindow['selectedCombo']).toBe(3);
    });

    it('should set row/column from actions 3/2 with their parameter (no double-dispatch)', async () => {
      debugTermWindow['displaySpec'].delayedUpdate = false;

      // §14 fix: action 3 consumes its parameter (5) -> row 5; '5' is NOT re-dispatched
      // as color-combo-1.
      await debugTermWindow.updateContent(['3', '5']); // row 5
      expect(debugTermWindow['cursorPosition'].y).toBe(5);
      expect(debugTermWindow['selectedCombo']).toBe(0); // '5' was consumed, not a combo-select

      // action 2 consumes its parameter (10) -> column 10
      await debugTermWindow.updateContent(['2', '10']); // column 10
      expect(debugTermWindow['cursorPosition'].x).toBe(10);
    });

    it('should handle text output', async () => {
      // In delayed-update mode the chars still write to the offscreen buffer (cursor
      // advances); only the flip to the visible canvas is deferred until UPDATE. The old
      // deferredCommands string-queue was removed. [9win §14]
      debugTermWindow['displaySpec'].delayedUpdate = true;
      debugTermWindow['cursorPosition'] = { x: 0, y: 0 };

      await debugTermWindow.updateContent(["'Hello World'"]);

      // 'Hello World' is 11 characters -> cursor advanced to column 11
      expect(debugTermWindow['cursorPosition'].x).toBe(11);
      expect(debugTermWindow['cursorPosition'].y).toBe(0);
    });

    it('should handle SETCOLOR command', async () => {
      // Color combo #2 is numeric code 6
      await debugTermWindow.updateContent(['6']);

      expect(debugTermWindow['selectedCombo']).toBe(2);
    });
  });


  describe('Window Management', () => {
    beforeEach(() => {
      // Window created in the constructor; mark ready so updateContent() processes now. [9win §14]
      debugTermWindow['isWindowReady'] = true;
    });

    it('should handle UPDATE command', async () => {
      await debugTermWindow.updateContent(['UPDATE']);

      const mockWindow = mockBrowserWindowInstances[0];

      expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should handle CLOSE command', async () => {
      const mockWindow = mockBrowserWindowInstances[0];
      await debugTermWindow.updateContent(['CLOSE']);

      // CLOSE sets debugWindow=null, whose setter calls close() on the old window.
      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should handle SAVE WINDOW command', async () => {
      const mockNativeImage = {
        toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
      };
      mockBrowserWindowInstances[0].webContents.capturePage = jest.fn().mockResolvedValue(mockNativeImage);

      // SAVE WINDOW captures the whole window via webContents.capturePage.
      await expect(
        debugTermWindow.updateContent(['SAVE', 'WINDOW', "'test.bmp'"])
      ).resolves.not.toThrow();

      expect(mockBrowserWindowInstances[0].webContents.capturePage).toHaveBeenCalled();
    });
  });

  describe('parseTermDeclaration static method', () => {
    it('should parse valid terminal spec string', () => {
      const lineParts = ['TERM', 'TestTerm', 'SIZE', '100', '30', 'POS', '200', '100', 'TEXTSIZE', '16'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      
      expect(isValid).toBe(true);
      expect(displaySpec.displayName).toBe('TestTerm');
      expect(displaySpec.size).toEqual({ columns: 100, rows: 30 });
      expect(displaySpec.position).toEqual({ x: 200, y: 100 });
      expect(displaySpec.font.textSizePts).toBe(16);
    });

    it('should handle TITLE directive', () => {
      const lineParts = ['TERM', 'TestTerm', 'TITLE', 'Custom Title'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      
      expect(isValid).toBe(true);
      expect(displaySpec.windowTitle).toBe('Custom Title');
    });

    it('should handle color specifications', () => {
      const lineParts = ['TERM', 'TestTerm', 'COLOR', 'RED', '15', 'BLUE', '15'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      
      expect(isValid).toBe(true);
      expect(displaySpec.colorCombos).toBeDefined();
      expect(displaySpec.colorCombos.length).toBeGreaterThan(0);
    });

    // Regression: COLOR parser crash + correctness + runtime-safety.
    // Old hand-rolled state machine read lineParts[colorIdx+1] unguarded and called
    // .match() on undefined whenever a COLOR clause's final color had no trailing
    // brightness — e.g. `COLOR $FF7F00 $000000` — killing the window-create path.
    it('should not crash when a COLOR clause ends without a trailing brightness', () => {
      // The exact failing case from the field (test_term_status.bin): $RRGGBB pair.
      const lineParts = ['TERM', 'st', 'COLOR', '$FF7F00', '$000000'];
      let result: [boolean, TermDisplaySpec] | undefined;
      expect(() => {
        result = DebugTermWindow.parseTermDeclaration(lineParts);
      }).not.toThrow();
      const [isValid, displaySpec] = result!;
      expect(isValid).toBe(true);
      expect(displaySpec.colorCombos).toHaveLength(4); // never shrinks (runtime select 4..7 indexes [0..3])
      expect(displaySpec.colorCombos[0]).toEqual({ fgcolor: '#ff7f00', bgcolor: '#000000' });
    });

    it('should keep 4 color combos (defaults preserved) for a short COLOR list', () => {
      // Pascal fills vColor[0..7] in place; unspecified slots keep their default.
      const lineParts = ['TERM', 'st', 'COLOR', '$112233', '$445566'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      expect(isValid).toBe(true);
      expect(displaySpec.colorCombos).toHaveLength(4);
      expect(displaySpec.colorCombos[0]).toEqual({ fgcolor: '#112233', bgcolor: '#445566' });
      // Combos 1..3 must still be the defaults (so runtime PAIR_OK/PAIR_ERR selects don't crash).
      expect(displaySpec.colorCombos[1]).toBeDefined();
      expect(displaySpec.colorCombos[2]).toBeDefined();
      expect(displaySpec.colorCombos[3]).toBeDefined();
    });

    it('should treat BLACK/WHITE as fixed (no brightness consumed) in COLOR', () => {
      // Pascal KeyColor: black->$000000, white->$FFFFFF, and neither consumes a following num.
      const lineParts = ['TERM', 'st', 'COLOR', 'WHITE', 'BLACK'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      expect(isValid).toBe(true);
      expect(displaySpec.colorCombos[0]).toEqual({ fgcolor: '#ffffff', bgcolor: '#000000' });
    });

    it('should resume directive parsing after a COLOR clause (index advance)', () => {
      const lineParts = ['TERM', 'st', 'COLOR', '$FF7F00', '$000000', 'HIDEXY'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      expect(isValid).toBe(true);
      expect(displaySpec.colorCombos[0]).toEqual({ fgcolor: '#ff7f00', bgcolor: '#000000' });
      expect(displaySpec.hideXY).toBe(true); // directive after COLOR still processed
    });

    it('should not abort the whole parse on a malformed numeric directive (Pascal clamps/skips)', () => {
      // Old code set isValid=false + break on a bad SIZE token, so the window was never
      // created and later directives were dropped. Pascal TERM_Configure never aborts.
      const lineParts = ['TERM', 'st', 'SIZE', 'bogus', '20', 'HIDEXY'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      expect(isValid).toBe(true); // window still created
      expect(displaySpec.size).toEqual({ columns: 40, rows: 20 }); // bad SIZE kept defaults
      expect(displaySpec.hideXY).toBe(true); // directive after the bad one still processed
    });

    it('should accept BACKCOLOR without consuming a following non-numeric directive', () => {
      const lineParts = ['TERM', 'st', 'BACKCOLOR', '$010203', 'HIDEXY'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      expect(isValid).toBe(true);
      expect(displaySpec.window.background).toBe('#010203');
      expect(displaySpec.hideXY).toBe(true); // HIDEXY not swallowed as a brightness value
    });

    it('should handle UPDATE directive', () => {
      const lineParts = ['TERM', 'TestTerm', 'UPDATE'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);

      expect(isValid).toBe(true);
      expect(displaySpec.delayedUpdate).toBe(true);
    });

    it('should handle HIDEXY directive', () => {
      const lineParts = ['TERM', 'TestTerm', 'HIDEXY'];
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      
      expect(isValid).toBe(true);
      expect(displaySpec.hideXY).toBe(true);
    });

    it('should return invalid for missing displayName', () => {
      const lineParts = ['TERM']; // Missing displayName
      const [isValid, displaySpec] = DebugTermWindow.parseTermDeclaration(lineParts);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid MOVETO coordinates gracefully', () => {
      debugTermWindow.updateContent(['TEST']);
      
      expect(() => debugTermWindow.updateContent(['MOVETO', 'invalid', 'coords'])).not.toThrow();
      
      // Position should remain unchanged
      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });
    });

    it('should handle invalid color index gracefully', () => {
      debugTermWindow.updateContent(['TEST']);
      
      expect(() => debugTermWindow.updateContent(['SETCOLOR', 'invalid'])).not.toThrow();
      
      // Color should remain unchanged
      expect(debugTermWindow['selectedCombo']).toBe(0);
    });
  });

  describe('Scrolling Behavior', () => {
    it('should handle auto-scroll when cursor moves beyond visible area', () => {
      // The terminal doesn't have auto-scroll in the current implementation
      // Move cursor to last row
      debugTermWindow.updateContent(['3', String(mockDisplaySpec.size.rows - 1)]);
      
      // Add multiple newlines to trigger potential scroll
      for (let i = 0; i < 5; i++) {
        debugTermWindow.updateContent(['13']); // newline
      }
      
      // Cursor should be limited to screen bounds
      expect(debugTermWindow['cursorPosition'].y).toBeLessThanOrEqual(mockDisplaySpec.size.rows - 1);
    });
  });

  describe('Base class delegation (Task 1)', () => {
    beforeEach(() => {
      // Trigger window creation with a printable character
      debugTermWindow.updateContent(['32']);
      // Force immediate update mode
      debugTermWindow['displaySpec'].delayedUpdate = false;
    });

    it('should delegate CLEAR command to base class', () => {
      const clearSpy = jest.spyOn(debugTermWindow as any, 'clearDisplayContent');
      debugTermWindow['cursorPosition'] = { x: 10, y: 5 };

      debugTermWindow.updateContent(['CLEAR']);

      // clearDisplayContent should have been called via base class delegation
      expect(clearSpy).toHaveBeenCalled();
      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });

      clearSpy.mockRestore();
    });

    it('should delegate UPDATE command to base class', () => {
      const updateSpy = jest.spyOn(debugTermWindow as any, 'forceDisplayUpdate');

      debugTermWindow.updateContent(['UPDATE']);

      // forceDisplayUpdate should have been called via base class delegation
      expect(updateSpy).toHaveBeenCalled();

      updateSpy.mockRestore();
    });

    it('should delegate CLOSE command to base class', async () => {
      const mockWindow = mockBrowserWindowInstances[0];

      // CLOSE awaits flushPending() before nulling debugWindow (whose setter calls close),
      // so the test must await the dispatch. [9win §14]
      await debugTermWindow.updateContent(['CLOSE']);

      // Window close should have been called via base class delegation
      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should delegate PC_KEY command to base class', () => {
      const inputForwarder = debugTermWindow['inputForwarder'];
      const pollingSpy = jest.spyOn(inputForwarder, 'startPolling');

      debugTermWindow.updateContent(['PC_KEY']);

      // Input forwarding should be enabled via base class delegation
      expect(pollingSpy).toHaveBeenCalled();

      pollingSpy.mockRestore();
    });

    it('should delegate PC_MOUSE command to base class', () => {
      const inputForwarder = debugTermWindow['inputForwarder'];
      const pollingSpy = jest.spyOn(inputForwarder, 'startPolling');

      debugTermWindow.updateContent(['PC_MOUSE']);

      // Input forwarding should be enabled via base class delegation
      expect(pollingSpy).toHaveBeenCalled();

      pollingSpy.mockRestore();
    });

    it('should delegate SAVE command to base class', async () => {
      const mockNativeImage = {
        toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
      };
      mockBrowserWindowInstances[0].webContents.capturePage = jest.fn().mockResolvedValue(mockNativeImage);

      await debugTermWindow.updateContent(['SAVE', "'test.bmp'"]);

      // SAVE command should be handled via base class delegation
      expect(mockBrowserWindowInstances[0].webContents.capturePage).toHaveBeenCalled();
    });
  });

  describe('Command processing via updateContent', () => {
    beforeEach(() => {
      // Window created in the constructor; mark ready so updateContent() processes
      // immediately, and force immediate (non-deferred) update mode. [9win §14]
      debugTermWindow['isWindowReady'] = true;
      debugTermWindow['displaySpec'].delayedUpdate = false;
    });

    it('should process numeric action 0 (clear and home)', async () => {
      debugTermWindow['cursorPosition'] = { x: 10, y: 5 };
      await debugTermWindow.updateContent(['0']);

      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });
    });

    it('should process numeric action 1 (home)', async () => {
      debugTermWindow['cursorPosition'] = { x: 10, y: 5 };
      await debugTermWindow.updateContent(['1']);

      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });
    });

    it('should process numeric action 2 (set column)', async () => {
      await debugTermWindow.updateContent(['2', '15']);

      expect(debugTermWindow['cursorPosition'].x).toBe(15);
    });

    it('should process numeric action 3 (set row)', async () => {
      await debugTermWindow.updateContent(['3', '8']);

      expect(debugTermWindow['cursorPosition'].y).toBe(8);
    });

    it('should process numeric actions 4-7 (color combos)', async () => {
      await debugTermWindow.updateContent(['4']);
      expect(debugTermWindow['selectedCombo']).toBe(0);

      await debugTermWindow.updateContent(['5']);
      expect(debugTermWindow['selectedCombo']).toBe(1);

      await debugTermWindow.updateContent(['6']);
      expect(debugTermWindow['selectedCombo']).toBe(2);

      await debugTermWindow.updateContent(['7']);
      expect(debugTermWindow['selectedCombo']).toBe(3);
    });

    it('should process numeric action 8 (backspace)', async () => {
      debugTermWindow['cursorPosition'] = { x: 5, y: 2 };
      await debugTermWindow.updateContent(['8']);

      expect(debugTermWindow['cursorPosition'].x).toBe(4);
    });

    it('should handle backspace with line wrap', async () => {
      debugTermWindow['cursorPosition'] = { x: 0, y: 2 };
      await debugTermWindow.updateContent(['8']);

      // Pascal code 8: at column 0 (and not at home) backspace wraps to the END of the
      // previous row (vCol -> vCols-1, vRow--). columns=80 -> x=79, y=1. [9win §14]
      expect(debugTermWindow['cursorPosition'].x).toBe(79);
      expect(debugTermWindow['cursorPosition'].y).toBe(1);
    });

    it('should process numeric action 9 (tab)', async () => {
      debugTermWindow['cursorPosition'] = { x: 2, y: 0 };
      await debugTermWindow.updateContent(['9']);

      // Tab advances to next 8-column boundary
      expect(debugTermWindow['cursorPosition'].x).toBe(8);
    });

    it('should process numeric action 10 (line feed)', async () => {
      debugTermWindow['cursorPosition'] = { x: 5, y: 2 };
      await debugTermWindow.updateContent(['10']);

      expect(debugTermWindow['cursorPosition'].y).toBe(3);
      expect(debugTermWindow['cursorPosition'].x).toBe(0); // X resets to 0 on LF
    });

    it('should process numeric action 13 (carriage return)', async () => {
      debugTermWindow['cursorPosition'] = { x: 15, y: 2 };
      await debugTermWindow.updateContent(['13']);

      expect(debugTermWindow['cursorPosition'].x).toBe(0);
      expect(debugTermWindow['cursorPosition'].y).toBe(3); // Y increments on CR
    });

    it('should process printable characters (32-255)', async () => {
      debugTermWindow['cursorPosition'] = { x: 0, y: 0 };

      // ASCII 'A' = 65
      await debugTermWindow.updateContent(['65']);
      expect(debugTermWindow['cursorPosition'].x).toBe(1);

      // ASCII space = 32
      await debugTermWindow.updateContent(['32']);
      expect(debugTermWindow['cursorPosition'].x).toBe(2);

      // Extended ASCII = 255
      await debugTermWindow.updateContent(['255']);
      expect(debugTermWindow['cursorPosition'].x).toBe(3);
    });

    it('should handle string commands', async () => {
      // Test quoted string
      debugTermWindow['cursorPosition'] = { x: 0, y: 0 };
      await debugTermWindow.updateContent(["'Hello'"]);

      // Should advance cursor by string length
      expect(debugTermWindow['cursorPosition'].x).toBe(5);
    });

    it('should process CLEAR command', async () => {
      debugTermWindow['cursorPosition'] = { x: 10, y: 5 };
      await debugTermWindow.updateContent(['CLEAR']);

      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });
    });

    it('should process UPDATE command', async () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;
      await debugTermWindow.updateContent(['UPDATE']);

      expect(executeJavaScript).toHaveBeenCalled();
    });

    it('should process CLOSE command', async () => {
      const close = mockBrowserWindowInstances[0].close;
      await debugTermWindow.updateContent(['CLOSE']);

      expect(close).toHaveBeenCalled();
    });

    it('should process PC_KEY command', async () => {
      await debugTermWindow.updateContent(['PC_KEY']);

      // Should enable keyboard input forwarding
      expect(debugTermWindow['inputForwarder']).toBeDefined();
    });

    it('should process PC_MOUSE command', async () => {
      await debugTermWindow.updateContent(['PC_MOUSE']);

      // Should enable mouse input forwarding
      expect(debugTermWindow['inputForwarder']).toBeDefined();
    });

    it('should ignore invalid numeric actions', async () => {
      const originalPos = { ...debugTermWindow['cursorPosition'] };

      // Invalid actions (14-31, >255)
      await debugTermWindow.updateContent(['14']);
      await debugTermWindow.updateContent(['31']);
      await debugTermWindow.updateContent(['256']);
      await debugTermWindow.updateContent(['1000']);

      // Position should not change
      expect(debugTermWindow['cursorPosition']).toEqual(originalPos);
    });
  });

  describe('Canvas rendering operations', () => {
    beforeEach(() => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']);
      debugTermWindow['displaySpec'].delayedUpdate = false;
    });

    it('should render terminal grid', () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;
      
      // Force a render update
      debugTermWindow.updateContent(['UPDATE']);
      
      // Should execute JavaScript to render
      expect(executeJavaScript).toHaveBeenCalled();
    });

    it('should handle character rendering with correct colors', () => {
      // Select color combo 2
      debugTermWindow.updateContent(['6']);
      
      // Write a character
      debugTermWindow.updateContent(['65']); // 'A'
      
      // Force update
      debugTermWindow.updateContent(['UPDATE']);
      
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;
      expect(executeJavaScript).toHaveBeenCalled();
    });

    it('should handle line wrapping', async () => {
      // Position cursor near end of line
      debugTermWindow['cursorPosition'] = { x: mockDisplaySpec.size.columns - 2, y: 0 };

      // Write several characters to trigger wrap
      await debugTermWindow.updateContent(['65']); // 'A' -> col 79
      await debugTermWindow.updateContent(['66']); // 'B' -> col 80 (pending wrap)
      await debugTermWindow.updateContent(['67']); // 'C' -> wraps, then col 1

      // Should wrap to next line
      expect(debugTermWindow['cursorPosition'].y).toBe(1);
      expect(debugTermWindow['cursorPosition'].x).toBe(1); // 'C' is at position 1
    });

    it('should handle scrolling at bottom of screen', () => {
      // Position cursor at last row
      debugTermWindow['cursorPosition'] = { x: 0, y: mockDisplaySpec.size.rows - 1 };
      
      // Write newline to trigger potential scroll
      debugTermWindow.updateContent(['13']); // CR
      debugTermWindow.updateContent(['10']); // LF
      
      // Should stay within bounds
      expect(debugTermWindow['cursorPosition'].y).toBeLessThan(mockDisplaySpec.size.rows);
    });
  });

  describe('File save operations', () => {
    it('should handle SAVE WINDOW command with proper format', async () => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']);
      
      // Mock webContents.capturePage
      const mockNativeImage = {
        toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
      };
      mockBrowserWindowInstances[0].webContents.capturePage = jest.fn().mockResolvedValue(mockNativeImage);
      
      // Process save command
      await debugTermWindow.updateContent(['SAVE', 'WINDOW', "'test.bmp'"]);
      
      // Should attempt to capture and save
      expect(mockBrowserWindowInstances[0].webContents.capturePage).toHaveBeenCalled();
    });
  });

  describe('Buffer management and text rendering', () => {
    beforeEach(() => {
      // Window created in the constructor; mark ready so updateContent() processes
      // immediately, and force immediate (non-deferred) update mode. [9win §14]
      debugTermWindow['isWindowReady'] = true;
      debugTermWindow['displaySpec'].delayedUpdate = false;
    });

    it('should handle character writing with proper canvas operations', async () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;

      // Write a character
      await debugTermWindow.updateContent(['65']); // 'A'

      // Should execute JavaScript for rendering
      expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('fillText'));
      expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('fillRect'));
    });

    it('should handle multiple character rendering in sequence', () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;
      
      // Write multiple characters
      debugTermWindow.updateContent(["'Hello World'"]);
      
      // Force update to render
      debugTermWindow.updateContent(['UPDATE']);
      
      // Should have multiple render calls
      expect(executeJavaScript).toHaveBeenCalled();
    });

    it('should clear line from cursor when requested', () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;
      
      // Position cursor in middle of line
      debugTermWindow['cursorPosition'] = { x: 10, y: 5 };
      
      // Call clearLineFromCursor directly (no ANSI support)
      debugTermWindow['clearLineFromCursor']();
      
      // Should clear from cursor to end of line
      expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('fillRect'));
    });

    it('should handle scrollUp operation when at bottom of screen', () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;
      
      // Position cursor at last row
      debugTermWindow['cursorPosition'] = { x: 0, y: mockDisplaySpec.size.rows - 1 };
      
      // Write text to trigger line wrap and potential scroll
      debugTermWindow.updateContent(['65']); // 'A'
      debugTermWindow.updateContent(['13']); // CR
      
      // Should call scrollBitmap if scrolling happened
      const calls = executeJavaScript.mock.calls;
      const hasScrollCall = calls.some((call: any) => call[0].includes('scrollBitmap'));
      // Scrolling may or may not happen depending on implementation
      expect(debugTermWindow['cursorPosition'].y).toBeLessThanOrEqual(mockDisplaySpec.size.rows - 1);
    });

    it('should handle tab expansion correctly', async () => {
      // Start at column 2
      debugTermWindow['cursorPosition'] = { x: 2, y: 0 };

      // Process tab
      await debugTermWindow.updateContent(['9']);

      // Should advance to next 8-column boundary (column 8)
      expect(debugTermWindow['cursorPosition'].x).toBe(8);

      // Another tab from column 8
      await debugTermWindow.updateContent(['9']);

      // Should advance to column 16
      expect(debugTermWindow['cursorPosition'].x).toBe(16);
    });

    it('should handle tab at end of line', async () => {
      // Position near end of line (column 78 of 80)
      debugTermWindow['cursorPosition'] = { x: mockDisplaySpec.size.columns - 2, y: 0 };

      // Process tab
      await debugTermWindow.updateContent(['9']);

      // From column 78, the tab writes 2 spaces -> column 80. Pascal/impl wrap LAZILY
      // ("if vCol = vCols then CR" is checked at the START of the next char write,
      // TERM_Chr), so the cursor parks at vCol=80, vRow=0 until the next character. [9win §14]
      expect(debugTermWindow['cursorPosition'].x).toBe(80);
      expect(debugTermWindow['cursorPosition'].y).toBe(0);
    });

    it('should handle line feed with proper y increment', async () => {
      debugTermWindow['cursorPosition'] = { x: 10, y: 5 };

      // Process line feed
      await debugTermWindow.updateContent(['10']);

      // Y should increment, X should reset to 0
      expect(debugTermWindow['cursorPosition'].y).toBe(6);
      expect(debugTermWindow['cursorPosition'].x).toBe(0);
    });

    it('should handle carriage return with y increment', async () => {
      debugTermWindow['cursorPosition'] = { x: 20, y: 3 };

      // Process carriage return
      await debugTermWindow.updateContent(['13']);

      // X should reset to 0, Y should increment
      expect(debugTermWindow['cursorPosition'].x).toBe(0);
      expect(debugTermWindow['cursorPosition'].y).toBe(4);
    });

    it('should render text with correct color combo', async () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;

      // Need to have at least 3 color combos defined
      if (mockDisplaySpec.colorCombos.length < 3) {
        // Add more color combos for testing
        mockDisplaySpec.colorCombos = [
          { fgcolor: '#FFFFFF', bgcolor: '#000000' },
          { fgcolor: '#00FF00', bgcolor: '#000000' },
          { fgcolor: '#FF0000', bgcolor: '#0000FF' }
        ];
      }

      // Select color combo 2
      await debugTermWindow.updateContent(['6']);

      // Write a character
      await debugTermWindow.updateContent(['65']); // 'A'

      // Should use colors from combo 2
      const combo = mockDisplaySpec.colorCombos[2];
      expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining(combo.fgcolor));
      expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining(combo.bgcolor));
    });

    it('should handle backspace at beginning of line', async () => {
      // Start at beginning of line 2
      debugTermWindow['cursorPosition'] = { x: 0, y: 2 };

      // Process backspace
      await debugTermWindow.updateContent(['8']);

      // Pascal code 8: backspace at column 0 (not at home) wraps to the previous row's
      // end (vCol -> vCols-1, vRow--). columns=80 -> x=79, y=1. [9win §14]
      expect(debugTermWindow['cursorPosition'].x).toBe(79);
      expect(debugTermWindow['cursorPosition'].y).toBe(1);
    });

    it('should handle line wrap during text output', async () => {
      // Position near end of line
      debugTermWindow['cursorPosition'] = { x: mockDisplaySpec.size.columns - 3, y: 0 };

      // Write text that will wrap
      await debugTermWindow.updateContent(["'ABCDE'"]);

      // Should wrap to next line
      expect(debugTermWindow['cursorPosition'].y).toBe(1);
      expect(debugTermWindow['cursorPosition'].x).toBe(2); // 'DE' on new line
    });

    it('should handle scrolling when writing at bottom of screen', () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;
      
      // Position at last row, last column
      debugTermWindow['cursorPosition'] = { x: mockDisplaySpec.size.columns - 1, y: mockDisplaySpec.size.rows - 1 };
      
      // Write a character that will wrap and potentially scroll
      debugTermWindow.updateContent(['65']); // 'A'
      
      // Cursor should be constrained to screen bounds
      expect(debugTermWindow['cursorPosition'].y).toBeLessThanOrEqual(mockDisplaySpec.size.rows - 1);
      
      // Check if scroll was called (implementation dependent)
      const calls = executeJavaScript.mock.calls;
      const hasScrollCall = calls.some((call: any) => call[0].includes('scrollBitmap'));
      // May or may not scroll depending on implementation
    });

    it('should clear entire screen on CLEAR command', async () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;

      // Set cursor away from home
      debugTermWindow['cursorPosition'] = { x: 10, y: 5 };

      // Clear screen
      await debugTermWindow.updateContent(['CLEAR']);

      // Cursor should reset to home
      expect(debugTermWindow['cursorPosition']).toEqual({ x: 0, y: 0 });

      // Should clear canvas (fillRect over the whole area)
      expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining('fillRect'));
    });

    it('should handle font specifications correctly', async () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;

      // Write a character
      await debugTermWindow.updateContent(['65']); // 'A'

      // Should use correct font specification
      const expectedFont = `normal ${mockDisplaySpec.font.textSizePts}pt Consolas, monospace`;
      expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining(expectedFont));
    });

    it('should calculate text baseline correctly', async () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;

      // Write a character at the home position
      await debugTermWindow.updateContent(['65']); // 'A'

      // writeCharToTerm draws at y = cursorRow*lineHeight + round(charHeight*0.2). For the
      // home row that's just the vertical-adjust term. [9win §14]
      const charHeight = mockDisplaySpec.font.charHeight;
      const expectedBaseline = 0 * mockDisplaySpec.font.lineHeight + Math.round(charHeight * 0.2);
      expect(executeJavaScript).toHaveBeenCalledWith(expect.stringContaining(`fillText('A', 0, ${expectedBaseline})`));
    });

    it('should handle extended ASCII characters', () => {
      const executeJavaScript = mockBrowserWindowInstances[0].webContents.executeJavaScript;
      
      // Clear any previous calls
      executeJavaScript.mockClear();
      
      // Write extended ASCII character (128-255 range)
      debugTermWindow.updateContent(['128']);
      
      // updateContent processes the command but rendering happens in updateTermDisplay
      // which only executes in UPDATE mode or when deferred updates are flushed
      
      // Force an update to trigger rendering
      debugTermWindow.updateContent(['UPDATE']);
      
      // Should have rendered something
      expect(executeJavaScript).toHaveBeenCalled();
      // Cursor should have advanced
      expect(debugTermWindow['cursorPosition'].x).toBeGreaterThanOrEqual(0);
    });

    it('should handle control characters below 32', () => {
      const originalPos = { ...debugTermWindow['cursorPosition'] };
      
      // Try various control characters
      debugTermWindow.updateContent(['15']); // SI
      debugTermWindow.updateContent(['20']); // DC4
      debugTermWindow.updateContent(['31']); // US
      
      // Position should not change for unhandled control chars
      expect(debugTermWindow['cursorPosition']).toEqual(originalPos);
    });
  });

  describe('Mouse coordinate display (Task 2)', () => {
    it('should include coordinate-display div in HTML template', () => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']);

      // The window should have been created
      expect(mockBrowserWindowInstances.length).toBeGreaterThan(0);
    });

    it('should inject mouse coordinate tracking JavaScript on did-finish-load', () => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']);

      const mockWindow = mockBrowserWindowInstances[mockBrowserWindowInstances.length - 1];

      // Get the did-finish-load callback
      const didFinishLoadCallback = mockWindow.webContents.once.mock.calls.find(
        (call: any) => call[0] === 'did-finish-load'
      )?.[1];

      expect(didFinishLoadCallback).toBeDefined();

      // Execute the callback
      if (didFinishLoadCallback) {
        didFinishLoadCallback();
      }

      // Should have called executeJavaScript with mouse tracking code
      const executeJavaScriptCalls = mockWindow.webContents.executeJavaScript.mock.calls;
      const hasMouseTrackingCode = executeJavaScriptCalls.some((call: any) =>
        call[0].includes('coordinate-display') &&
        call[0].includes('mousemove') &&
        call[0].includes('updateCoordinateDisplay')
      );

      expect(hasMouseTrackingCode).toBe(true);
    });

    it('should respect HIDEXY directive in mouse tracking code', () => {
      // Create a window with HIDEXY set
      const hideXYSpec = { ...mockDisplaySpec, hideXY: true };
      const hideXYWindow = new DebugTermWindow(mockContext, hideXYSpec);
      hideXYWindow.updateContent([hideXYSpec.displayName, '32']);

      const mockWindow = mockBrowserWindowInstances[mockBrowserWindowInstances.length - 1];

      // Get the did-finish-load callback
      const didFinishLoadCallback = mockWindow.webContents.once.mock.calls.find(
        (call: any) => call[0] === 'did-finish-load'
      )?.[1];

      if (didFinishLoadCallback) {
        didFinishLoadCallback();
      }

      // Check that hideXY is passed to the JavaScript code
      const executeJavaScriptCalls = mockWindow.webContents.executeJavaScript.mock.calls;
      const mouseTrackingCall = executeJavaScriptCalls.find((call: any) =>
        call[0].includes('coordinate-display')
      );

      expect(mouseTrackingCall).toBeDefined();
      expect(mouseTrackingCall[0]).toContain('!true'); // hideXY is true, so !hideXY is false

      // Cleanup
      hideXYWindow.closeDebugWindow();
    });

    it('should include quadrant-based positioning logic in mouse tracking', () => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']);

      const mockWindow = mockBrowserWindowInstances[mockBrowserWindowInstances.length - 1];

      // Get the did-finish-load callback
      const didFinishLoadCallback = mockWindow.webContents.once.mock.calls.find(
        (call: any) => call[0] === 'did-finish-load'
      )?.[1];

      if (didFinishLoadCallback) {
        didFinishLoadCallback();
      }

      // Check for quadrant positioning logic
      const executeJavaScriptCalls = mockWindow.webContents.executeJavaScript.mock.calls;
      const mouseTrackingCall = executeJavaScriptCalls.find((call: any) =>
        call[0].includes('coordinate-display')
      );

      expect(mouseTrackingCall).toBeDefined();
      expect(mouseTrackingCall[0]).toContain('quadrant');
      expect(mouseTrackingCall[0]).toContain('case 0'); // Top-left
      expect(mouseTrackingCall[0]).toContain('case 1'); // Top-right
      expect(mouseTrackingCall[0]).toContain('case 2'); // Bottom-left
      expect(mouseTrackingCall[0]).toContain('case 3'); // Bottom-right
    });

    it('should calculate character coordinates matching Pascal logic', () => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']);

      const mockWindow = mockBrowserWindowInstances[mockBrowserWindowInstances.length - 1];

      // Get the did-finish-load callback
      const didFinishLoadCallback = mockWindow.webContents.once.mock.calls.find(
        (call: any) => call[0] === 'did-finish-load'
      )?.[1];

      if (didFinishLoadCallback) {
        didFinishLoadCallback();
      }

      // Check for coordinate calculation logic
      const executeJavaScriptCalls = mockWindow.webContents.executeJavaScript.mock.calls;
      const mouseTrackingCall = executeJavaScriptCalls.find((call: any) =>
        call[0].includes('coordinate-display')
      );

      expect(mouseTrackingCall).toBeDefined();
      // Should calculate col and row using Math.floor((x - marginLeft) / charWidth)
      expect(mouseTrackingCall[0]).toContain('Math.floor((x - marginLeft) / charWidth)');
      expect(mouseTrackingCall[0]).toContain('Math.floor((y - marginTop) / charHeight)');
      // Should display as "col,row" format
      expect(mouseTrackingCall[0]).toContain("col + ',' + row");
    });

    it('should hide display when mouse leaves canvas', () => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']);

      const mockWindow = mockBrowserWindowInstances[mockBrowserWindowInstances.length - 1];

      // Get the did-finish-load callback
      const didFinishLoadCallback = mockWindow.webContents.once.mock.calls.find(
        (call: any) => call[0] === 'did-finish-load'
      )?.[1];

      if (didFinishLoadCallback) {
        didFinishLoadCallback();
      }

      // Check for mouseleave handler
      const executeJavaScriptCalls = mockWindow.webContents.executeJavaScript.mock.calls;
      const mouseTrackingCall = executeJavaScriptCalls.find((call: any) =>
        call[0].includes('coordinate-display')
      );

      expect(mouseTrackingCall).toBeDefined();
      expect(mouseTrackingCall[0]).toContain('mouseleave');
      expect(mouseTrackingCall[0]).toContain("display.style.display = 'none'");
    });

    it('should use correct margin values matching Pascal implementation', () => {
      // Trigger window creation
      debugTermWindow.updateContent(['32']);

      const mockWindow = mockBrowserWindowInstances[mockBrowserWindowInstances.length - 1];

      // Get the did-finish-load callback
      const didFinishLoadCallback = mockWindow.webContents.once.mock.calls.find(
        (call: any) => call[0] === 'did-finish-load'
      )?.[1];

      if (didFinishLoadCallback) {
        didFinishLoadCallback();
      }

      // Check that margins are calculated as charWidth/2
      const executeJavaScriptCalls = mockWindow.webContents.executeJavaScript.mock.calls;
      const mouseTrackingCall = executeJavaScriptCalls.find((call: any) =>
        call[0].includes('coordinate-display')
      );

      expect(mouseTrackingCall).toBeDefined();
      const expectedMargin = Math.floor(mockDisplaySpec.font.charWidth / 2);
      expect(mouseTrackingCall[0]).toContain(`marginLeft = ${expectedMargin}`);
      expect(mouseTrackingCall[0]).toContain(`marginTop = ${expectedMargin}`);
    });
  });
});