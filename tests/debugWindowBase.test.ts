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
      it('should recognize color names', () => {
        const colorTests = [
          { input: 'BLACK', expected: '#000000' },
          { input: 'WHITE', expected: '#ffffff' },
          { input: 'ORANGE', expected: '#ff6600' },
          { input: 'BLUE', expected: '#0080ff' },
          { input: 'GREEN', expected: '#00ff00' },
          { input: 'CYAN', expected: '#00ffff' },
          { input: 'RED', expected: '#ff0000' },
          { input: 'MAGENTA', expected: '#ff00ff' },
          { input: 'YELLOW', expected: '#ffff00' },
          { input: 'BROWN', expected: '#906020' },
          { input: 'gray', expected: '#808080' },  // Case insensitive
          { input: 'GRAY', expected: '#808080' }
        ];

        colorTests.forEach(test => {
          const [isValid, color] = DebugWindowBase.getValidRgb24(test.input);
          expect(isValid).toBe(true);
          expect(color).toBe(test.expected);
        });
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

      it('should clamp out-of-range numeric values', () => {
        const [isValid, color] = DebugWindowBase.getValidRgb24('$FFFFFF00');
        expect(isValid).toBe(true);
        expect(color.toLowerCase()).toBe('#ffffff'); // Clamped to 24-bit max
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
      testWindow['debugWindow'] = mockWindow;

      expect(testWindow['debugWindow']).toBe(mockWindow);
      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith('Base: - New TestDebugWindow window');
    });

    it('should handle window destruction', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;

      // Mock event listener registration
      const closeSpy = jest.fn();
      const closedSpy = jest.fn();
      testWindow.on('close', closeSpy);
      testWindow.on('closed', closedSpy);

      testWindow['debugWindow'] = null;

      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith('Base: - Closing TestDebugWindow window');
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
      const testCases = [
        { weight: eTextWeight.TW_LIGHT, expected: 'light' },
        { weight: eTextWeight.TW_NORMAL, expected: 'normal' },
        { weight: eTextWeight.TW_BOLD, expected: 'bold' },
        { weight: eTextWeight.TW_HEAVY, expected: 'heavy' },
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
    it('should log messages with prefix', () => {
      testWindow['logMessage']('test message');
      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith('TestWin: test message');

      testWindow['logMessage']('another message', 'CUSTOM');
      expect((mockContext as any).logger.forceLogMessage).toHaveBeenCalledWith('CUSTOM: another message');
    });

    it('should log base messages', () => {
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
      
      // Messages should not be processed yet
      expect(queueTestWindow.processedMessages).toHaveLength(0);
      
      // Logger should indicate queuing
      expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('Queued message')
      );
    });
    
    it('should process messages immediately when window is ready', () => {
      // Mark window as ready first
      queueTestWindow['onWindowReady']();
      
      // Send messages
      queueTestWindow.updateContent(['immediate', '1']);
      queueTestWindow.updateContent(['immediate', '2']);
      
      // Messages should be processed immediately
      expect(queueTestWindow.processedMessages).toHaveLength(2);
      expect(queueTestWindow.processedMessages[0]).toEqual(['immediate', '1']);
      expect(queueTestWindow.processedMessages[1]).toEqual(['immediate', '2']);
    });
    
    it('should process queued messages when window becomes ready', () => {
      // Queue messages
      queueTestWindow.updateContent(['queued', '1']);
      queueTestWindow.updateContent(['queued', '2']);
      queueTestWindow.updateContent(['queued', '3']);
      
      expect(queueTestWindow.processedMessages).toHaveLength(0);
      
      // Mark window as ready
      queueTestWindow['onWindowReady']();
      
      // All queued messages should be processed
      expect(queueTestWindow.processedMessages).toHaveLength(3);
      expect(queueTestWindow.processedMessages[0]).toEqual(['queued', '1']);
      expect(queueTestWindow.processedMessages[1]).toEqual(['queued', '2']);
      expect(queueTestWindow.processedMessages[2]).toEqual(['queued', '3']);
    });
    
    it('should preserve message order when processing queue', () => {
      // Queue messages in specific order
      const messages = [
        ['first', 'message'],
        ['second', 'message'],
        ['third', 'message'],
        ['fourth', 'message']
      ];
      
      messages.forEach(msg => queueTestWindow.updateContent(msg));
      
      // Process queue
      queueTestWindow['onWindowReady']();
      
      // Verify order is preserved
      expect(queueTestWindow.processedMessages).toEqual(messages);
    });
    
    it('should clear queue after processing', () => {
      // Queue messages
      queueTestWindow.updateContent(['test', '1']);
      queueTestWindow.updateContent(['test', '2']);
      
      // Process queue
      queueTestWindow['onWindowReady']();
      
      // Queue new messages after ready
      queueTestWindow.updateContent(['new', '1']);
      
      // Should only have 3 messages total
      expect(queueTestWindow.processedMessages).toHaveLength(3);
      expect(queueTestWindow.processedMessages[2]).toEqual(['new', '1']);
    });
    
    it('should not process queue twice if onWindowReady called multiple times', () => {
      // Queue messages
      queueTestWindow.updateContent(['test', '1']);
      queueTestWindow.updateContent(['test', '2']);
      
      // Call onWindowReady twice
      queueTestWindow['onWindowReady']();
      queueTestWindow['onWindowReady']();
      
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
    
    it('should clone message arrays to avoid reference issues', () => {
      const originalMessage = ['mutable', 'array'];
      queueTestWindow.updateContent(originalMessage);
      
      // Modify original array
      originalMessage[0] = 'modified';
      originalMessage[1] = 'content';
      
      // Process queue
      queueTestWindow['onWindowReady']();
      
      // Should have original values, not modified ones
      expect(queueTestWindow.processedMessages[0]).toEqual(['mutable', 'array']);
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

    it('should handle webContents.send failures', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;
      testWindow['onWindowReady']();

      // Mock send to throw error
      (mockWindow.webContents.send as jest.Mock).mockImplementation(() => {
        throw new Error('Send failed');
      });

      // Should not crash
      expect(() => testWindow.updateContent(['CLEAR'])).not.toThrow();
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

    it('should not leak memory with repeated queue operations', () => {
      // Queue and process many times
      for (let i = 0; i < 100; i++) {
        const tempWindow = new TestDebugWindow(mockContext, `temp-${i}`, 'TEMP');

        // Queue messages
        for (let j = 0; j < 10; j++) {
          tempWindow.updateContent(['message', `${j}`]);
        }

        // Process queue
        tempWindow['onWindowReady']();

        // Queue should be empty after processing
        expect(tempWindow['messageQueue']).toBeUndefined();
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

    it('should support deferred command execution pattern', () => {
      const mockWindow = new BrowserWindow();
      testWindow['debugWindow'] = mockWindow;

      // Queue commands before window ready
      testWindow.updateContent(['CLEAR']);
      testWindow.updateContent(['SIZE', '800', '600']);
      testWindow.updateContent(['UPDATE']);

      // Verify nothing sent yet
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();

      // Window becomes ready
      mockWindow.setSize = jest.fn();
      testWindow['onWindowReady']();

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
      (WindowRouter.getInstance as jest.Mock).mockReturnValue(mockRouter);

      testWindow['registerWithRouter']();
      testWindow['debugWindow'] = null;

      expect(mockRouter.unregisterWindow).toHaveBeenCalled();
    });
  });
});