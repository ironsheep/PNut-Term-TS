import { DebugWindowBase, eVertJustification, eHorizJustification, eTextWeight, FontMetrics, TextStyle } from '../src/classes/debugWindowBase';
import { Context } from '../src/utils/context';
import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { WindowRouter } from '../src/classes/shared/windowRouter';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    webContents: {
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      capturePage: jest.fn().mockResolvedValue({
        toPNG: jest.fn().mockResolvedValue(Buffer.from('mock-png-data'))
      })
    },
    on: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    setAlwaysOnTop: jest.fn(),
    setMenu: jest.fn()
  })),
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  },
  nativeImage: {
    createFromBuffer: jest.fn().mockReturnValue({
      toPNG: jest.fn().mockReturnValue(Buffer.from('mock-png-data'))
    })
  }
}));

// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Mock InputForwarder
jest.mock('../src/classes/shared/inputForwarder', () => ({
  InputForwarder: jest.fn().mockImplementation(() => ({
    stopPolling: jest.fn(),
    startPolling: jest.fn(),
    enableKeyboard: jest.fn(),
    enableMouse: jest.fn()
  }))
}));

// Mock jimp
jest.mock('jimp', () => ({
  Jimp: {
    create: jest.fn().mockResolvedValue({
      bitmap: {
        width: 100,
        height: 100,
        data: Buffer.alloc(40000)
      },
      getPixelColor: jest.fn().mockReturnValue(0xFF0000FF),
      setPixelColor: jest.fn(),
      write: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

// Mock WindowRouter
jest.mock('../src/classes/shared/windowRouter', () => ({
  WindowRouter: {
    getInstance: jest.fn().mockReturnValue({
      registerWindow: jest.fn(),
      registerWindowInstance: jest.fn(),
      unregisterWindow: jest.fn(),
      routeMessage: jest.fn()
    })
  }
}));

// Create a concrete implementation for testing
class TestDebugWindow extends DebugWindowBase {
  public processedMessages: string[][] = [];

  constructor(ctx: Context, windowId: string = 'test-window', windowType: string = 'test') {
    // Set up the mock WindowRouter before calling super
    const mockRouter = {
      registerWindow: jest.fn(),
      registerWindowInstance: jest.fn(),
      unregisterWindow: jest.fn(),
      routeMessage: jest.fn()
    };
    (WindowRouter.getInstance as jest.Mock).mockReturnValue(mockRouter);

    super(ctx, windowId, windowType);
    this.windowLogPrefix = 'TestWin';
  }

  get windowTitle(): string {
    return 'Test Debug Window';
  }

  closeDebugWindow(): void {
    // Test implementation
  }

  protected clearDisplayContent(): void {
    // Override base class warning behavior for testing
    const window = this['debugWindow'];
    if (window && !window.isDestroyed()) {
      window.webContents.send('debug-clear', undefined);
    }
  }

  protected forceDisplayUpdate(): void {
    // Override base class warning behavior for testing
    const window = this['debugWindow'];
    if (window && !window.isDestroyed()) {
      window.webContents.send('debug-update', undefined);
    }
  }

  protected handleHideXY(): void {
    const window = this['debugWindow'];
    if (window && !window.isDestroyed()) {
      window.webContents.send('debug-hidexy', undefined);
    }
  }

  protected handleShowXY(): void {
    const window = this['debugWindow'];
    if (window && !window.isDestroyed()) {
      window.webContents.send('debug-showxy', undefined);
    }
  }

  protected async processMessageImmediate(lineParts: string[]): Promise<void> {
    // Track processed messages for testing
    this.processedMessages.push(lineParts);

    // For testing, handle commands synchronously (simplified)
    if (lineParts.length > 0) {
      const command = lineParts[0].toUpperCase();
      const window = this['debugWindow'];

      switch (command) {
        case 'CLEAR':
          this.clearDisplayContent();
          break;
        case 'UPDATE':
          this.forceDisplayUpdate();
          break;
        case 'CLOSE':
          if (window) {
            window.close();
          }
          break;
        case 'HIDEXY':
          this.handleHideXY();
          break;
        case 'SHOWXY':
          this.handleShowXY();
          break;
        case 'SIZE':
          if (lineParts.length >= 3 && window) {
            const width = parseInt(lineParts[1], 10);
            const height = parseInt(lineParts[2], 10);
            if (!isNaN(width) && !isNaN(height)) {
              window.setSize(width, height);
            }
          }
          break;
        case 'POS':
          if (lineParts.length >= 3 && window) {
            const x = parseInt(lineParts[1], 10);
            const y = parseInt(lineParts[2], 10);
            if (!isNaN(x) && !isNaN(y)) {
              window.setPosition(x, y);
            }
          }
          break;
        case 'TITLE':
          if (lineParts.length > 1 && window) {
            const title = lineParts.slice(1).join(' ');
            window.webContents.send('debug-title', title);
          }
          break;
      }
    }
  }

  protected getCanvasId(): string {
    return 'test-canvas';
  }
}

describe('DebugWindowBase', () => {
  let testWindow: TestDebugWindow;
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      logMessage: jest.fn(),
      logger: {
        logMessage: jest.fn(),
        forceLogMessage: jest.fn()
      },
      runtime: {
        verbose: false
      }
    } as any;

    testWindow = new TestDebugWindow(mockContext);
  });

  describe('Color Validation', () => {
    describe('getValidRgb24', () => {
      it('should NOT resolve color names — numeric-only [9win §4b]', () => {
        // getValidRgb24 is the "is this a numeric rgb24?" test. Color NAMES are
        // intentionally rejected here so callers route them through the RGBI8X
        // directive path (DebugColor) instead of a divergent local name map.
        ['BLACK', 'WHITE', 'ORANGE', 'BLUE', 'GREEN', 'CYAN', 'RED', 'MAGENTA', 'YELLOW', 'GRAY', 'gray'].forEach(
          (name) => {
            const [isValid, color] = DebugWindowBase.getValidRgb24(name);
            expect(isValid).toBe(false);
            expect(color).toBe('#a5a5a5');
          }
        );
      });

      it('should parse numeric color values', () => {
        const [isValid1, color1] = DebugWindowBase.getValidRgb24('$FF0000');
        expect(isValid1).toBe(true);
        expect(color1.toLowerCase()).toBe('#ff0000');

        const [isValid2, color2] = DebugWindowBase.getValidRgb24('16711680');
        expect(isValid2).toBe(true);
        expect(color2.toLowerCase()).toBe('#ff0000');

        const [isValid3, color3] = DebugWindowBase.getValidRgb24('%11111111_00000000_00000000');
        expect(isValid3).toBe(true);
        expect(color3.toLowerCase()).toBe('#ff0000');
      });

      it('should handle invalid color values', () => {
        const [isValid1, color1] = DebugWindowBase.getValidRgb24('INVALID');
        expect(isValid1).toBe(false);
        expect(color1).toBe('#a5a5a5'); // Default gray

        const [isValid2, color2] = DebugWindowBase.getValidRgb24('');
        expect(isValid2).toBe(false);
        expect(color2).toBe('#a5a5a5');
      });

      it('should mask to 24 bits (lower 24 bits of 32-bit value)', () => {
        // $FFFFFF00 as 32-bit unsigned is 0xFFFFFF00; the low 24 bits are 0xFFFF00.
        // The implementation does (value >>> 0) & 0xffffff — takes the LOW 24 bits,
        // not the upper. This matches actual getValidRgb24 behavior.
        const [isValid, color] = DebugWindowBase.getValidRgb24('$FFFFFF00');
        expect(isValid).toBe(true);
        expect(color.toLowerCase()).toBe('#ffff00'); // low 24 bits of 0xFFFFFF00
      });
    });
  });

  describe('Text Style Encoding', () => {
    describe('calcStyleFrom', () => {
      it('should encode text styles correctly', () => {
        // Test default style
        const style1 = DebugWindowBase.calcStyleFrom(
          eVertJustification.VJ_MIDDLE,
          eHorizJustification.HJ_CENTER,
          eTextWeight.TW_NORMAL
        );
        expect(style1).toBe(0b00000001); // Middle, center, normal weight

        // Test with all options
        const style2 = DebugWindowBase.calcStyleFrom(
          eVertJustification.VJ_TOP,
          eHorizJustification.HJ_LEFT,
          eTextWeight.TW_BOLD,
          true,  // underline
          true   // italic
        );
        expect(style2).toBe(0b11111110); // Top, left, underline, italic, bold
      });

      it('should handle all vertical justifications', () => {
        const middleStyle = DebugWindowBase.calcStyleFrom(
          eVertJustification.VJ_MIDDLE,
          eHorizJustification.HJ_CENTER,
          eTextWeight.TW_NORMAL
        );
        expect((middleStyle >> 6) & 0b11).toBe(0b00);

        const bottomStyle = DebugWindowBase.calcStyleFrom(
          eVertJustification.VJ_BOTTOM,
          eHorizJustification.HJ_CENTER,
          eTextWeight.TW_NORMAL
        );
        expect((bottomStyle >> 6) & 0b11).toBe(0b10);

        const topStyle = DebugWindowBase.calcStyleFrom(
          eVertJustification.VJ_TOP,
          eHorizJustification.HJ_CENTER,
          eTextWeight.TW_NORMAL
        );
        expect((topStyle >> 6) & 0b11).toBe(0b11);
      });

      it('should handle all horizontal justifications', () => {
        const centerStyle = DebugWindowBase.calcStyleFrom(
          eVertJustification.VJ_MIDDLE,
          eHorizJustification.HJ_CENTER,
          eTextWeight.TW_NORMAL
        );
        expect((centerStyle >> 4) & 0b11).toBe(0b00);

        const rightStyle = DebugWindowBase.calcStyleFrom(
          eVertJustification.VJ_MIDDLE,
          eHorizJustification.HJ_RIGHT,
          eTextWeight.TW_NORMAL
        );
        expect((rightStyle >> 4) & 0b11).toBe(0b10);

        const leftStyle = DebugWindowBase.calcStyleFrom(
          eVertJustification.VJ_MIDDLE,
          eHorizJustification.HJ_LEFT,
          eTextWeight.TW_NORMAL
        );
        expect((leftStyle >> 4) & 0b11).toBe(0b11);
      });

      it('should handle all font weights', () => {
        const weights = [
          { weight: eTextWeight.TW_LIGHT, expected: 0b00 },
          { weight: eTextWeight.TW_NORMAL, expected: 0b01 },
          { weight: eTextWeight.TW_BOLD, expected: 0b10 },
          { weight: eTextWeight.TW_HEAVY, expected: 0b11 }
        ];

        weights.forEach(test => {
          const style = DebugWindowBase.calcStyleFrom(
            eVertJustification.VJ_MIDDLE,
            eHorizJustification.HJ_CENTER,
            test.weight
          );
          expect(style & 0b11).toBe(test.expected);
        });
      });
    });

    describe('calcStyleFromBitfield', () => {
      it('should decode text styles correctly', () => {
        const textStyle: TextStyle = {
          vertAlign: eVertJustification.VJ_UNKNOWN,
          horizAlign: eHorizJustification.HJ_UNKNOWN,
          underline: false,
          italic: false,
          weight: eTextWeight.TW_UNKNOWN,
          angle: 0
        };

        // Test decoding of encoded style
        DebugWindowBase.calcStyleFromBitfield(0b11111110, textStyle);
        expect(textStyle.vertAlign).toBe(0b11); // TOP
        expect(textStyle.horizAlign).toBe(0b11); // LEFT
        expect(textStyle.underline).toBe(true);
        expect(textStyle.italic).toBe(true);
        expect(textStyle.weight).toBe(eTextWeight.TW_BOLD);
      });

      it('should handle invalid bitfield gracefully', () => {
        const textStyle: TextStyle = {
          vertAlign: eVertJustification.VJ_MIDDLE,
          horizAlign: eHorizJustification.HJ_CENTER,
          underline: false,
          italic: false,
          weight: eTextWeight.TW_NORMAL,
          angle: 0
        };

        // Should not crash on invalid input
        DebugWindowBase.calcStyleFromBitfield(1234567890, textStyle);
        // Style should remain unchanged for very large numbers
      });
    });
  });

  describe('Font Metrics', () => {
    it('should calculate font metrics correctly', () => {
      const metrics: FontMetrics = {
        textSizePts: 0,
        charHeight: 0,
        charWidth: 0,
        lineHeight: 0,
        baseline: 0
      };

      DebugWindowBase.calcMetricsForFontPtSize(14, metrics);
      expect(metrics.textSizePts).toBe(14);
      expect(metrics.charHeight).toBe(19); // 14 * 1.333 = 18.662 → 19
      expect(metrics.charWidth).toBe(11);  // 19 * 0.6 = 11.4 → 11
      expect(metrics.lineHeight).toBe(25); // 19 * 1.3 = 24.7 → 25
      expect(metrics.baseline).toBe(14);   // 19 * 0.7 + 0.5 = 13.8 → 14

      // Test another size
      DebugWindowBase.calcMetricsForFontPtSize(21, metrics);
      expect(metrics.textSizePts).toBe(21);
      expect(metrics.charHeight).toBe(28); // 21 * 1.333 = 27.993 → 28
      expect(metrics.charWidth).toBe(17);  // 28 * 0.6 = 16.8 → 17
      expect(metrics.lineHeight).toBe(36); // 28 * 1.3 = 36.4 → 36
      expect(metrics.baseline).toBe(20);   // 28 * 0.7 + 0.5 = 20.1 → 20
    });
  });

  describe('Window Lifecycle', () => {
    it('should initialize with context', () => {
      expect(testWindow['context']).toBe(mockContext);
      expect(testWindow['windowLogPrefix']).toBe('TestWin');
    });

    it('should handle window assignment', () => {
      const mockWindow = new BrowserWindow();
      // Enable logging so logMessageBase actually fires
      testWindow['isLogging'] = true;
      testWindow['debugWindow'] = mockWindow;

      expect(testWindow['debugWindow']).toBe(mockWindow);
      // Source logs: "- New ${windowType} window: ${windowId}" via logMessageBase -> "Base: ..."
      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith(
        expect.stringContaining('- New test window')
      );
    });

    it('should handle window destruction', () => {
      const mockWindow = new BrowserWindow();
      // Enable logging so logMessageBase actually fires
      testWindow['isLogging'] = true;
      testWindow['debugWindow'] = mockWindow;
      jest.clearAllMocks(); // clear the "new window" log call

      // Mock event listener registration
      const closeSpy = jest.fn();
      const closedSpy = jest.fn();
      testWindow.on('close', closeSpy);
      testWindow.on('closed', closedSpy);

      testWindow['debugWindow'] = null;

      // Source logs: "- Closing ${windowType} window: ${windowId}"
      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith(
        expect.stringContaining('- Closing test window')
      );
      expect(mockWindow.close).toHaveBeenCalled();
    });
  });

  describe('Input Helpers', () => {
    it('should validate spin numbers', () => {
      const [isValid1, value1] = testWindow['isSpinNumber']('123');
      expect(isValid1).toBe(true);
      expect(value1).toBe(123);

      const [isValid2, value2] = testWindow['isSpinNumber']('$FF');
      expect(isValid2).toBe(true);
      expect(value2).toBe(255);

      const [isValid3, value3] = testWindow['isSpinNumber']('%1010');
      expect(isValid3).toBe(true);
      expect(value3).toBe(10);

      const [isValid4, value4] = testWindow['isSpinNumber']('invalid');
      expect(isValid4).toBe(false);
      expect(value4).toBe(0);
    });

    it('should remove string quotes', () => {
      expect(testWindow['removeStringQuotes']('"hello"')).toBe('hello');
      expect(testWindow['removeStringQuotes']("'world'")).toBe('world');
      expect(testWindow['removeStringQuotes']('no quotes')).toBe('no quotes');
      expect(testWindow['removeStringQuotes']('"mixed\'quotes"')).toBe('mixed\'quotes');
    });

    it('should get parallax font URL', () => {
      const url = testWindow['getParallaxFontUrl']();
      expect(url).toContain('Parallax.ttf');
      expect(url).toMatch(/^file:\/\//);
    });
  });

  describe('Window Capture', () => {
    it('should save window to BMP file', async () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      
      // Setup fs mocks
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      
      await testWindow['saveWindowToBMPFilename']('test.bmp');
      
      expect(mockWindow.webContents.capturePage).toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      testWindow['debugWindow'] = null;
      
      // Should not throw when no window
      await expect(testWindow['saveWindowToBMPFilename']('test.bmp')).resolves.not.toThrow();
    });
  });

  describe('Abstract Method Enforcement', () => {
    it('should require getCanvasId implementation', () => {
      expect(testWindow['getCanvasId']()).toBe('test-canvas');
    });

    it('should require closeDebugWindow implementation', () => {
      expect(() => testWindow.closeDebugWindow()).not.toThrow();
    });

    it('should require updateContent implementation', () => {
      expect(() => testWindow.updateContent(['test'])).not.toThrow();
    });
  });

  describe('Font Weight Names', () => {
    it('should return correct font weight names', () => {
      // fontWeightName() returns CSS font-weight strings matching debugWindowBase.ts:
      // TW_LIGHT → '300', TW_NORMAL → 'normal', TW_BOLD → 'bold', TW_HEAVY → '900'
      // TW_UNKNOWN has no case, so falls through to the default 'normal' initializer
      const testCases = [
        { weight: eTextWeight.TW_LIGHT, expected: '300' },
        { weight: eTextWeight.TW_NORMAL, expected: 'normal' },
        { weight: eTextWeight.TW_BOLD, expected: 'bold' },
        { weight: eTextWeight.TW_HEAVY, expected: '900' },
        { weight: eTextWeight.TW_UNKNOWN, expected: 'normal' }
      ];

      testCases.forEach(test => {
        const style: TextStyle = {
          vertAlign: eVertJustification.VJ_MIDDLE,
          horizAlign: eHorizJustification.HJ_CENTER,
          underline: false,
          italic: false,
          weight: test.weight,
          angle: 0
        };
        expect(testWindow['fontWeightName'](style)).toBe(test.expected);
      });
    });
  });

  describe('Mouse and Keyboard Input', () => {
    it('should enable keyboard input', () => {
      testWindow['enableKeyboardInput']();
      expect(testWindow['inputForwarder']).toBeDefined();
    });

    it('should enable mouse input', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      
      // Create a mock DOM environment
      const mockContainer = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        style: {}
      };
      
      mockWindow.webContents.executeJavaScript = jest.fn().mockImplementation((script) => {
        if (script.includes('getElementById')) {
          return Promise.resolve(mockContainer);
        }
        return Promise.resolve(undefined);
      });

      testWindow['enableMouseInput']();
      expect(testWindow['inputForwarder']).toBeDefined();
    });

    it('should transform mouse coordinates (default implementation)', () => {
      const coords = testWindow['transformMouseCoordinates'](100, 200);
      expect(coords).toEqual({ x: 100, y: 200 });
    });

    it('should return undefined for pixel color getter by default', () => {
      const getter = testWindow['getPixelColorGetter']();
      expect(getter).toBeUndefined();
    });
  });

  describe('Logging', () => {
    it('should log messages with prefix when isLogging is enabled', () => {
      // logMessage() is gated by this.isLogging (false by default).
      // Must enable it explicitly or nothing is emitted.
      testWindow['isLogging'] = true;

      testWindow['logMessage']('test message');
      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith('TestWin: test message');

      testWindow['logMessage']('another message', 'CUSTOM');
      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith('CUSTOM: another message');
    });

    it('should NOT log messages when isLogging is disabled (default)', () => {
      // Default isLogging = false — nothing should be emitted
      testWindow['logMessage']('test message');
      expect((mockContext as any).logger.forceLogMessage).not.toHaveBeenCalled();
    });

    it('should log base messages when isLogging is enabled', () => {
      testWindow['isLogging'] = true;
      testWindow['logMessageBase']('base message');
      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith('Base: base message');
    });
  });

  describe('Common Command Handling', () => {
    it('should handle CLEAR command', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      // Process CLEAR command
      testWindow.updateContent(['CLEAR']);

      // Should send clear message to renderer
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-clear', undefined);
    });

    it('should handle UPDATE command for double buffering', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      // First UPDATE enables buffering mode
      testWindow.updateContent(['UPDATE']);

      // Send some messages
      testWindow.updateContent(['some', 'data']);

      // Second UPDATE flips the buffer
      testWindow.updateContent(['UPDATE']);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-update', undefined);
    });

    it('should handle HIDEXY command', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      testWindow.updateContent(['HIDEXY']);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-hidexy', undefined);
    });

    it('should handle SHOWXY command', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      testWindow.updateContent(['SHOWXY']);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-showxy', undefined);
    });

    it('should handle SIZE command', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      // Mock setSize
      mockWindow.setSize = jest.fn();

      testWindow.updateContent(['SIZE', '800', '600']);

      expect(mockWindow.setSize).toHaveBeenCalledWith(800, 600);
    });

    it('should handle POS command', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      // Mock setPosition
      mockWindow.setPosition = jest.fn();

      testWindow.updateContent(['POS', '100', '200']);

      expect(mockWindow.setPosition).toHaveBeenCalledWith(100, 200);
    });

    it('should handle TITLE command', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      testWindow.updateContent(['TITLE', 'Test', 'Window', 'Title']);

      // Title should be joined with spaces
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-title', 'Test Window Title');
    });

    it('should handle CLOSE command', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      mockWindow.close = jest.fn();

      testWindow.updateContent(['CLOSE']);

      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should handle compound commands (PLOT pattern)', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      mockWindow.setSize = jest.fn();
      mockWindow.setPosition = jest.fn();

      // Simulate compound command like PLOT uses
      testWindow.updateContent(['CLEAR']);
      testWindow.updateContent(['SIZE', '640', '480']);
      testWindow.updateContent(['POS', '50', '50']);
      testWindow.updateContent(['TITLE', 'Compound', 'Test']);
      testWindow.updateContent(['UPDATE']);

      // Verify all commands were processed
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-clear', undefined);
      expect(mockWindow.setSize).toHaveBeenCalledWith(640, 480);
      expect(mockWindow.setPosition).toHaveBeenCalledWith(50, 50);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-title', 'Compound Test');
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-update', undefined);
    });
  });

  describe('Message Queuing', () => {
    let queueTestWindow: TestDebugWindow;

    beforeEach(() => {
      // Create a fresh instance for queue tests
      queueTestWindow = new TestDebugWindow(mockContext, 'queue-test', 'QUEUE');
      // Track processed messages
      queueTestWindow.processedMessages = [];
    });
    
    it('should queue messages when window is not ready', () => {
      // Send messages before window is ready
      queueTestWindow.updateContent(['message', '1']);
      queueTestWindow.updateContent(['message', '2']);
      queueTestWindow.updateContent(['message', '3']);

      // Messages should not be processed yet (processMessageImmediate not called)
      expect(queueTestWindow.processedMessages).toHaveLength(0);

      // Note: logMessage() is gated by isLogging (false by default), so we cannot
      // assert on forceLogMessage here. The queue size is the observable proof.
      expect(queueTestWindow['messageQueue'].size).toBe(3);
    });

    it('should process messages immediately when window is ready', async () => {
      // Mark window as ready first (onWindowReady is async)
      await queueTestWindow['onWindowReady']();

      // Send messages
      await queueTestWindow.updateContent(['immediate', '1']);
      await queueTestWindow.updateContent(['immediate', '2']);

      // Messages should be processed immediately
      expect(queueTestWindow.processedMessages).toHaveLength(2);
      expect(queueTestWindow.processedMessages[0]).toEqual(['immediate', '1']);
      expect(queueTestWindow.processedMessages[1]).toEqual(['immediate', '2']);
    });

    it('should process queued messages when window becomes ready', async () => {
      // Queue messages (synchronous — not yet ready)
      queueTestWindow.updateContent(['queued', '1']);
      queueTestWindow.updateContent(['queued', '2']);
      queueTestWindow.updateContent(['queued', '3']);

      expect(queueTestWindow.processedMessages).toHaveLength(0);

      // Mark window as ready — must await because queue drain is async
      await queueTestWindow['onWindowReady']();

      // All queued messages should be processed
      expect(queueTestWindow.processedMessages).toHaveLength(3);
      expect(queueTestWindow.processedMessages[0]).toEqual(['queued', '1']);
      expect(queueTestWindow.processedMessages[1]).toEqual(['queued', '2']);
      expect(queueTestWindow.processedMessages[2]).toEqual(['queued', '3']);
    });

    it('should preserve message order when processing queue', async () => {
      // Queue messages in specific order
      const messages = [
        ['first', 'message'],
        ['second', 'message'],
        ['third', 'message'],
        ['fourth', 'message']
      ];

      messages.forEach(msg => queueTestWindow.updateContent(msg));

      // Process queue — must await for sequential processing
      await queueTestWindow['onWindowReady']();

      // Verify order is preserved
      expect(queueTestWindow.processedMessages).toEqual(messages);
    });

    it('should clear queue after processing', async () => {
      // Queue messages
      queueTestWindow.updateContent(['test', '1']);
      queueTestWindow.updateContent(['test', '2']);

      // Process queue — must await
      await queueTestWindow['onWindowReady']();

      // Queue new messages after ready (immediate processing)
      await queueTestWindow.updateContent(['new', '1']);

      // Should have 3 messages total
      expect(queueTestWindow.processedMessages).toHaveLength(3);
      expect(queueTestWindow.processedMessages[2]).toEqual(['new', '1']);
    });

    it('should not process queue twice if onWindowReady called multiple times', async () => {
      // Queue messages
      queueTestWindow.updateContent(['test', '1']);
      queueTestWindow.updateContent(['test', '2']);

      // Call onWindowReady twice — second call should be a no-op
      await queueTestWindow['onWindowReady']();
      await queueTestWindow['onWindowReady']();

      // Messages should only be processed once
      expect(queueTestWindow.processedMessages).toHaveLength(2);
    });
    
    it('should mark window as ready when registerWithRouter is called', () => {
      // Mock WindowRouter.getInstance
      const mockRouter = {
        registerWindow: jest.fn()
      };
      (WindowRouter.getInstance as jest.Mock).mockReturnValue(mockRouter);
      
      queueTestWindow['registerWithRouter']();
      
      // Window should be ready
      queueTestWindow.updateContent(['test']);
      expect(queueTestWindow.processedMessages).toHaveLength(1);
    });
    
    it('should store message arrays by reference (no defensive copy)', async () => {
      // The MessageQueue stores the reference, not a copy. Callers in production
      // always create fresh arrays (e.g. str.split(' ')), so this is safe.
      // This test documents the ACTUAL behavior, not an aspirational deep-copy.
      const originalMessage = ['mutable', 'array'];
      queueTestWindow.updateContent(originalMessage);

      // Mutate original array BEFORE processing
      originalMessage[0] = 'modified';
      originalMessage[1] = 'content';

      // Process queue — must await
      await queueTestWindow['onWindowReady']();

      // Queue stores by reference, so processed message reflects mutation
      expect(queueTestWindow.processedMessages[0]).toEqual(['modified', 'content']);
    });
  });

  describe('Error Handling', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid SIZE parameters gracefully', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      mockWindow.setSize = jest.fn();

      // Invalid size parameters
      testWindow.updateContent(['SIZE', 'invalid', 'params']);

      // Should not crash, setSize should not be called
      expect(mockWindow.setSize).not.toHaveBeenCalled();
    });

    it('should handle invalid POS parameters gracefully', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      mockWindow.setPosition = jest.fn();

      // Invalid position parameters
      testWindow.updateContent(['POS', 'not', 'numbers']);

      // Should not crash, setPosition should not be called
      expect(mockWindow.setPosition).not.toHaveBeenCalled();
    });

    it('should handle commands when window is destroyed', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      // Mock window as destroyed
      (mockWindow.isDestroyed as jest.Mock).mockReturnValue(true);

      // Try to send command
      testWindow.updateContent(['CLEAR']);

      // Should not throw error
      expect(() => testWindow.updateContent(['UPDATE'])).not.toThrow();
    });

    it('should propagate webContents.send failures from processMessageImmediate', async () => {
      // updateContent calls processMessageImmediate, which (in TestDebugWindow) calls
      // clearDisplayContent -> webContents.send(). If send() throws, the error
      // propagates through updateContent. The base class does NOT swallow errors from
      // processMessageImmediate (only handleRouterMessage has a try/catch).
      // This test documents the ACTUAL behavior.
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      await testWindow['onWindowReady']();

      // Mock send to throw error
      (mockWindow.webContents.send as jest.Mock).mockImplementation(() => {
        throw new Error('Send failed');
      });

      let threw = false;
      try {
        await testWindow.updateContent(['CLEAR']);
      } catch {
        threw = true;
      }
      // Error propagates from processMessageImmediate -> updateContent
      expect(threw).toBe(true);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle rapid command sequences', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      const startTime = Date.now();

      // Send many commands rapidly
      for (let i = 0; i < 1000; i++) {
        testWindow.updateContent(['CLEAR']);
        testWindow.updateContent(['UPDATE']);
      }

      const endTime = Date.now();

      // Should complete quickly (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // All commands should be sent
      expect(mockWindow.webContents.send).toHaveBeenCalledTimes(2000);
    });

    it('should not leak memory with repeated queue operations', async () => {
      // Queue and process many times — verify queue drains (size=0), not that it
      // becomes undefined (it's a persistent MessageQueue object, always defined).
      for (let i = 0; i < 100; i++) {
        const tempWindow = new TestDebugWindow(mockContext, `temp-${i}`, 'TEMP');

        // Queue messages
        for (let j = 0; j < 10; j++) {
          tempWindow.updateContent(['message', `${j}`]);
        }

        // Process queue — must await for async drain
        await tempWindow['onWindowReady']();

        // Queue should be empty after processing (size 0, not undefined)
        expect(tempWindow['messageQueue'].size).toBe(0);
      }
    });
  });

  describe('PLOT Window Integration Pattern', () => {
    it('should support PLOT-style initialization sequence', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;

      mockWindow.setSize = jest.fn();
      mockWindow.setPosition = jest.fn();

      // PLOT window initialization pattern
      testWindow['onWindowReady']();

      // Configure window
      testWindow.updateContent(['SIZE', '600', '650']);
      testWindow.updateContent(['TITLE', 'PLOT', 'Test']);
      testWindow.updateContent(['UPDATE']); // Enable double buffering

      // Drawing commands would go here
      testWindow.updateContent(['CLEAR']);
      // ... more drawing ...
      testWindow.updateContent(['UPDATE']); // Flip buffer

      // Verify initialization sequence
      expect(mockWindow.setSize).toHaveBeenCalledWith(600, 650);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-title', 'PLOT Test');
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-clear', undefined);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-update', undefined);
    });

    it('should handle PLOT coordinate visibility commands', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      // Hide coordinates
      testWindow.updateContent(['HIDEXY']);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-hidexy', undefined);

      // Show coordinates
      testWindow.updateContent(['SHOWXY']);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-showxy', undefined);
    });

    it('should support deferred command execution pattern', async () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;

      // Override setSize on the mock before queuing (so the queued handler sees it)
      mockWindow.setSize = jest.fn();

      // Queue commands before window ready
      testWindow.updateContent(['CLEAR']);
      testWindow.updateContent(['SIZE', '800', '600']);
      testWindow.updateContent(['UPDATE']);

      // Verify nothing sent yet
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();

      // Window becomes ready — must await so async queue drain completes
      await testWindow['onWindowReady']();

      // All commands should be processed
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-clear', undefined);
      expect(mockWindow.setSize).toHaveBeenCalledWith(800, 600);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('debug-update', undefined);
    });
  });

  describe('Window State Management', () => {
    it('should track window ready state', () => {
      expect(testWindow['isWindowReady']).toBe(false);

      testWindow['onWindowReady']();

      expect(testWindow['isWindowReady']).toBe(true);
    });

    it('should handle window close properly', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      // Close window
      testWindow['debugWindow'] = null;

      expect(mockWindow.close).toHaveBeenCalled();
      expect(testWindow['isWindowReady']).toBe(false);
    });

    it('should unregister from router on close', () => {
      const mockRouter = {
        registerWindow: jest.fn(),
        unregisterWindow: jest.fn()
      };
      // testWindow.windowRouter was stored in constructor — update it directly so
      // unregisterFromRouter() calls the same mock we can assert on.
      (WindowRouter.getInstance as jest.Mock).mockReturnValue(mockRouter);
      testWindow['windowRouter'] = mockRouter as any;

      testWindow['registerWithRouter']();
      testWindow['debugWindow'] = null;

      expect(mockRouter.unregisterWindow).toHaveBeenCalled();
    });
  });
});