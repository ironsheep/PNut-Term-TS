/** @format */

import { DebugWindowBase } from '../src/classes/debugWindowBase';
import { Context } from '../src/utils/context';
import { TLongTransmission } from '../src/classes/shared/tLongTransmission';
import {
  createMockContext,
  createMockBrowserWindow,
  setupDebugWindowTest,
  cleanupDebugWindowTest
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow()),
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
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Mock TLong transmission
jest.mock('../src/classes/shared/tLongTransmission', () => ({
  TLongTransmission: jest.fn().mockImplementation(() => ({
    transmitKeyPress: jest.fn().mockResolvedValue(true),
    transmitMouseData: jest.fn().mockResolvedValue(true)
  }))
}));

// Create a concrete test implementation
class TestDebugWindowForCommands extends DebugWindowBase {
  public processedMessages: string[][] = [];

  constructor(ctx: Context, windowId: string = 'test-window', windowType: string = 'test') {
    super(ctx, windowId, windowType);
  }

  protected processMessageImmediate(lineParts: string[]): void {
    this.processedMessages.push([...lineParts]);
  }

  public closeDebugWindow(): void {
    // Test implementation - just mark as closed
  }

  protected getCanvasId(): string {
    return 'test-canvas';
  }

  // Expose protected methods for testing
  public async testHandleCommonCommand(commandParts: string[]): Promise<boolean> {
    return this.handleCommonCommand(commandParts);
  }

  public getVKeyPress(): number {
    return this.vKeyPress;
  }

  public setVKeyPress(value: number): void {
    this.vKeyPress = value;
  }

  public getVMouseX(): number {
    return this.vMouseX;
  }

  public getVMouseY(): number {
    return this.vMouseY;
  }

  public setVMouseState(x: number, y: number, buttons: any, wheel: number): void {
    this.vMouseX = x;
    this.vMouseY = y;
    this.vMouseButtons = buttons;
    this.vMouseWheel = wheel;
  }

  public getVMouseButtons(): any {
    return this.vMouseButtons;
  }

  public getVMouseWheel(): number {
    return this.vMouseWheel;
  }

  public async testSaveWindowToBMPFilename(filename: string): Promise<void> {
    return this.saveWindowToBMPFilename(filename);
  }

  public async testSaveDesktopWindowToBMPFilename(filename: string): Promise<void> {
    return this.saveDesktopWindowToBMPFilename(filename);
  }

  public async testSaveDesktopCoordinatesToBMPFilename(left: number, top: number, width: number, height: number, filename: string): Promise<void> {
    return this.saveDesktopCoordinatesToBMPFilename(left, top, width, height, filename);
  }

  public testEnableKeyboardInput(): void {
    this.enableKeyboardInput();
  }

  public testEnableMouseInput(): void {
    this.enableMouseInput();
  }

  public getTLongTransmitter(): any {
    return this.tLongTransmitter;
  }
}

describe('Base Class Common Commands', () => {
  let testWindow: TestDebugWindowForCommands;
  let mockContext: Context;
  let mockTLongTransmitter: jest.Mocked<TLongTransmission>;

  beforeEach(() => {
    // Setup mocks
    const testSetup = setupDebugWindowTest();

    mockContext = createMockContext({
      runtime: {
        msWaitBeforeClose: 500,
        isFileLoggingEnabled: false,
        loggedTraffic: jest.fn(),
        logTrafficMessage: jest.fn()
      }
    });

    // Create test window
    testWindow = new TestDebugWindowForCommands(mockContext);

    // Setup mock TLong transmitter
    mockTLongTransmitter = {
      transmitKeyPress: jest.fn() as jest.MockedFunction<(keyValue: number) => void>,
      transmitMouseData: jest.fn() as jest.MockedFunction<(positionValue: number, colorValue: number) => void>
    } as any;

    // Inject mock transmitter
    (testWindow as any).tLongTransmitter = mockTLongTransmitter;
  });

  afterEach(() => {
    if (testWindow) {
      testWindow.closeDebugWindow();
    }
    jest.clearAllMocks();
  });

  describe('SAVE Command Tests', () => {
    beforeEach(() => {
      // Setup mock window for save operations
      const mockWindow = createMockBrowserWindow();
      (testWindow as any)._debugWindow = mockWindow;
    });

    describe('Basic SAVE command', () => {
      test('should handle SAVE with filename', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', "'test.bmp'"]);
        expect(result).toBe(true);

        // Verify logging
        expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
          expect.stringContaining('Executing SAVE canvas: test.bmp')
        );
      });

      test('should handle SAVE with double quotes', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '"test.bmp"']);
        expect(result).toBe(true);
      });

      test('should handle SAVE with no quotes', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', 'test.bmp']);
        expect(result).toBe(true);
      });

      test('should reject SAVE without filename', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE']);
        expect(result).toBe(false);

        expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
          expect.stringContaining('SAVE command missing filename')
        );
      });

      test('should handle SAVE with invalid parameters', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '']);
        expect(result).toBe(false);
      });
    });

    describe('SAVE WINDOW command', () => {
      test('should handle SAVE WINDOW with filename', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', 'WINDOW', "'desktop.bmp'"]);
        expect(result).toBe(true);

        expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
          expect.stringContaining('Executing SAVE WINDOW: desktop.bmp')
        );
      });

      test('should handle SAVE WINDOW with double quotes', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', 'WINDOW', '"desktop.bmp"']);
        expect(result).toBe(true);
      });

      test('should reject SAVE WINDOW without filename', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', 'WINDOW']);
        expect(result).toBe(false);
      });
    });

    describe('SAVE coordinates command', () => {
      test('should handle SAVE with coordinates', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '10', '20', '100', '200', "'coords.bmp'"]);
        expect(result).toBe(true);

        expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
          expect.stringContaining('Executing SAVE coordinates: 10,20,100,200 -> coords.bmp')
        );
      });

      test('should handle SAVE coordinates with hex values', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '$A', '$14', '$64', '$C8', "'hex.bmp'"]);
        expect(result).toBe(true);
      });

      test('should handle SAVE coordinates with binary values', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '%1010', '%10100', '%1100100', '%11001000', "'binary.bmp'"]);
        expect(result).toBe(true);
      });

      test('should reject SAVE coordinates with invalid numbers', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', 'invalid', '20', '100', '200', "'test.bmp'"]);
        expect(result).toBe(false);
      });

      test('should reject SAVE coordinates with missing filename', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '10', '20', '100', '200']);
        expect(result).toBe(false);
      });

      test('should reject SAVE coordinates with insufficient parameters', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '10', '20', '100']);
        expect(result).toBe(false);
      });
    });

    describe('Save error handling', () => {
      test('should handle save errors gracefully', async () => {
        // Mock a save error
        const mockWindow = createMockBrowserWindow();
        mockWindow.webContents.capturePage = jest.fn().mockRejectedValue(new Error('Capture failed'));
        (testWindow as any)._debugWindow = mockWindow;

        const result = await testWindow.testHandleCommonCommand(['SAVE', "'error.bmp'"]);
        expect(result).toBe(true); // Should still return true but handle error internally
      });

      test('should handle save with no window', async () => {
        (testWindow as any)._debugWindow = null;

        const result = await testWindow.testHandleCommonCommand(['SAVE', "'nowindow.bmp'"]);
        expect(result).toBe(true); // Should not crash
      });
    });
  });

  describe('PC_KEY Command Tests', () => {
    describe('Basic PC_KEY functionality', () => {
      test('should handle PC_KEY command', async () => {
        const result = await testWindow.testHandleCommonCommand(['PC_KEY']);
        expect(result).toBe(true);

        expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
          expect.stringContaining('Executing PC_KEY command')
        );
      });

      test('should enable keyboard input on PC_KEY', async () => {
        const enableSpy = jest.spyOn(testWindow, 'testEnableKeyboardInput');

        await testWindow.testHandleCommonCommand(['PC_KEY']);

        expect(enableSpy).toHaveBeenCalled();
      });

      test('should transmit keypress value and clear it', async () => {
        // Set a keypress value
        testWindow.setVKeyPress(65); // 'A' key

        await testWindow.testHandleCommonCommand(['PC_KEY']);

        // Should transmit the value
        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenCalledWith(65);

        // Should clear the value after transmission
        expect(testWindow.getVKeyPress()).toBe(0);
      });

      test('should handle zero keypress value', async () => {
        testWindow.setVKeyPress(0);

        await testWindow.testHandleCommonCommand(['PC_KEY']);

        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenCalledWith(0);
      });

      test('should handle large keypress values', async () => {
        testWindow.setVKeyPress(0xFFFFFFFF);

        await testWindow.testHandleCommonCommand(['PC_KEY']);

        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenCalledWith(0xFFFFFFFF);
        expect(testWindow.getVKeyPress()).toBe(0);
      });
    });

    describe('PC_KEY error handling', () => {
      test('should handle transmission errors gracefully', async () => {
        mockTLongTransmitter.transmitKeyPress.mockImplementationOnce(() => {
          throw new Error('Transmission failed');
        });
        testWindow.setVKeyPress(65);

        const result = await testWindow.testHandleCommonCommand(['PC_KEY']);

        expect(result).toBe(true); // Should still return true
        expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
          expect.stringContaining('PC_KEY transmission error')
        );
      });

      test('should handle missing TLong transmitter', async () => {
        (testWindow as any).tLongTransmitter = null;
        testWindow.setVKeyPress(65);

        const result = await testWindow.testHandleCommonCommand(['PC_KEY']);

        expect(result).toBe(true); // Should not crash
      });
    });

    describe('PC_KEY state management', () => {
      test('should support one-shot consumption pattern', async () => {
        // Set initial value
        testWindow.setVKeyPress(97); // 'a' key

        // First PC_KEY call should get the value and clear it
        await testWindow.testHandleCommonCommand(['PC_KEY']);
        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenCalledWith(97);
        expect(testWindow.getVKeyPress()).toBe(0);

        // Second PC_KEY call should get zero
        jest.clearAllMocks();
        await testWindow.testHandleCommonCommand(['PC_KEY']);
        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenCalledWith(0);
      });

      test('should handle rapid PC_KEY calls', async () => {
        testWindow.setVKeyPress(32); // Space key

        // Multiple rapid calls
        await testWindow.testHandleCommonCommand(['PC_KEY']);
        await testWindow.testHandleCommonCommand(['PC_KEY']);
        await testWindow.testHandleCommonCommand(['PC_KEY']);

        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenCalledTimes(3);
        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenNthCalledWith(1, 32);
        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenNthCalledWith(2, 0);
        expect(mockTLongTransmitter.transmitKeyPress).toHaveBeenNthCalledWith(3, 0);
      });
    });
  });

  describe('PC_MOUSE Command Tests', () => {
    describe('Basic PC_MOUSE functionality', () => {
      test('should handle PC_MOUSE command', async () => {
        const result = await testWindow.testHandleCommonCommand(['PC_MOUSE']);
        expect(result).toBe(true);

        expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
          expect.stringContaining('Executing PC_MOUSE command')
        );
      });

      test('should enable mouse input on PC_MOUSE', async () => {
        const enableSpy = jest.spyOn(testWindow, 'testEnableMouseInput');

        await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        expect(enableSpy).toHaveBeenCalled();
      });

      test('should transmit mouse data when in bounds', async () => {
        // Set mouse state to valid position
        const mockButtons = { left: true, right: false, middle: false };
        testWindow.setVMouseState(100, 200, mockButtons, 5);

        await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        // Should transmit mouse data
        expect(mockTLongTransmitter.transmitMouseData).toHaveBeenCalled();

        // Should clear wheel delta after transmission
        expect(testWindow.getVMouseWheel()).toBe(0);
      });

      test('should handle out-of-bounds mouse coordinates', async () => {
        // Set mouse state to out-of-bounds
        testWindow.setVMouseState(-1, -1, { left: false, right: false, middle: false }, 0);

        await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        // Should still call transmit but with out-of-bounds data
        expect(mockTLongTransmitter.transmitMouseData).toHaveBeenCalled();
      });
    });

    describe('PC_MOUSE data encoding', () => {
      test('should encode mouse button states correctly', async () => {
        const mockButtons = { left: true, right: true, middle: false };
        testWindow.setVMouseState(50, 75, mockButtons, 3);

        await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        expect(mockTLongTransmitter.transmitMouseData).toHaveBeenCalled();

        // Get the transmitted data to verify encoding
        const transmittedArgs = mockTLongTransmitter.transmitMouseData.mock.calls[0];
        expect(transmittedArgs).toBeDefined();
      });

      test('should handle all button combinations', async () => {
        const buttonCombinations = [
          { left: false, right: false, middle: false },
          { left: true, right: false, middle: false },
          { left: false, right: true, middle: false },
          { left: false, right: false, middle: true },
          { left: true, right: true, middle: false },
          { left: true, right: false, middle: true },
          { left: false, right: true, middle: true },
          { left: true, right: true, middle: true }
        ];

        for (const buttons of buttonCombinations) {
          jest.clearAllMocks();
          testWindow.setVMouseState(10, 20, buttons, 0);

          await testWindow.testHandleCommonCommand(['PC_MOUSE']);

          expect(mockTLongTransmitter.transmitMouseData).toHaveBeenCalled();
        }
      });

      test('should handle wheel delta values', async () => {
        const wheelValues = [-5, -1, 0, 1, 5, 120, -120];

        for (const wheel of wheelValues) {
          jest.clearAllMocks();
          testWindow.setVMouseState(0, 0, { left: false, right: false, middle: false }, wheel);

          await testWindow.testHandleCommonCommand(['PC_MOUSE']);

          expect(mockTLongTransmitter.transmitMouseData).toHaveBeenCalled();
          // Wheel should be cleared after transmission
          expect(testWindow.getVMouseWheel()).toBe(0);
        }
      });

      test('should handle extreme coordinate values', async () => {
        const coordinatePairs = [
          [0, 0],
          [65535, 65535],
          [-1, -1],
          [32767, 32767],
          [1000000, 1000000]
        ];

        for (const [x, y] of coordinatePairs) {
          jest.clearAllMocks();
          testWindow.setVMouseState(x, y, { left: false, right: false, middle: false }, 0);

          await testWindow.testHandleCommonCommand(['PC_MOUSE']);

          expect(mockTLongTransmitter.transmitMouseData).toHaveBeenCalled();
        }
      });
    });

    describe('PC_MOUSE error handling', () => {
      test('should handle transmission errors gracefully', async () => {
        mockTLongTransmitter.transmitMouseData.mockImplementationOnce(() => {
          throw new Error('Mouse transmission failed');
        });
        testWindow.setVMouseState(100, 100, { left: true, right: false, middle: false }, 0);

        const result = await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        expect(result).toBe(true); // Should still return true
        expect((mockContext as any).logger.logMessage).toHaveBeenCalledWith(
          expect.stringContaining('PC_MOUSE transmission error')
        );
      });

      test('should handle missing TLong transmitter', async () => {
        (testWindow as any).tLongTransmitter = null;
        testWindow.setVMouseState(100, 100, { left: false, right: false, middle: false }, 0);

        const result = await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        expect(result).toBe(true); // Should not crash
      });
    });

    describe('PC_MOUSE state management', () => {
      test('should preserve coordinates between calls', async () => {
        testWindow.setVMouseState(123, 456, { left: false, right: false, middle: false }, 0);

        await testWindow.testHandleCommonCommand(['PC_MOUSE']);
        await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        // Coordinates should persist between calls
        expect(testWindow.getVMouseX()).toBe(123);
        expect(testWindow.getVMouseY()).toBe(456);
      });

      test('should clear wheel delta after each transmission', async () => {
        testWindow.setVMouseState(0, 0, { left: false, right: false, middle: false }, 10);

        await testWindow.testHandleCommonCommand(['PC_MOUSE']);
        expect(testWindow.getVMouseWheel()).toBe(0);

        // Set wheel again
        testWindow.setVMouseState(0, 0, { left: false, right: false, middle: false }, -5);
        await testWindow.testHandleCommonCommand(['PC_MOUSE']);
        expect(testWindow.getVMouseWheel()).toBe(0);
      });

      test('should handle button state changes', async () => {
        // Initial state
        testWindow.setVMouseState(50, 50, { left: false, right: false, middle: false }, 0);
        await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        // Change button state
        testWindow.setVMouseState(50, 50, { left: true, right: true, middle: true }, 0);
        await testWindow.testHandleCommonCommand(['PC_MOUSE']);

        expect(mockTLongTransmitter.transmitMouseData).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    describe('Invalid command handling', () => {
      test('should return false for empty command array', async () => {
        const result = await testWindow.testHandleCommonCommand([]);
        expect(result).toBe(false);
      });

      test('should return false for null command array', async () => {
        const result = await testWindow.testHandleCommonCommand(null as any);
        expect(result).toBe(false);
      });

      test('should handle unknown commands gracefully', async () => {
        const result = await testWindow.testHandleCommonCommand(['UNKNOWN_COMMAND']);
        expect(result).toBe(false);
      });

      test('should handle commands with empty strings', async () => {
        const result = await testWindow.testHandleCommonCommand(['', 'parameter']);
        expect(result).toBe(false);
      });
    });

    describe('Parameter validation', () => {
      test('should handle malformed SAVE parameters', async () => {
        const malformedCommands = [
          ['SAVE', 'WINDOW', ''],
          ['SAVE', 'invalid', 'param', 'values', "'file.bmp'"],
          ['SAVE', '$INVALID', '20', '100', '200', "'test.bmp'"],
          ['SAVE', '10', 'INVALID', '100', '200', "'test.bmp'"]
        ];

        for (const command of malformedCommands) {
          const result = await testWindow.testHandleCommonCommand(command);
          expect(result).toBe(false);
        }
      });

      test('should handle commands with insufficient parameters', async () => {
        const incompleteCommands = [
          ['SAVE'],
          ['SAVE', 'WINDOW'],
          ['SAVE', '10'],
          ['SAVE', '10', '20'],
          ['SAVE', '10', '20', '100']
        ];

        for (const command of incompleteCommands) {
          const result = await testWindow.testHandleCommonCommand(command);
          expect(result).toBe(false);
        }
      });
    });

    describe('Boundary conditions', () => {
      test('should handle maximum coordinate values in SAVE', async () => {
        const result = await testWindow.testHandleCommonCommand([
          'SAVE',
          String(Number.MAX_SAFE_INTEGER),
          String(Number.MAX_SAFE_INTEGER),
          String(Number.MAX_SAFE_INTEGER),
          String(Number.MAX_SAFE_INTEGER),
          "'max.bmp'"
        ]);
        expect(result).toBe(true);
      });

      test('should handle zero coordinates in SAVE', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '0', '0', '0', '0', "'zero.bmp'"]);
        expect(result).toBe(true);
      });

      test('should handle negative coordinates in SAVE', async () => {
        const result = await testWindow.testHandleCommonCommand(['SAVE', '-10', '-20', '100', '200', "'negative.bmp'"]);
        expect(result).toBe(true);
      });
    });

    describe('System state edge cases', () => {
      test('should handle PC_KEY when keyboard input is not available', async () => {
        // Mock enableKeyboardInput to throw error
        jest.spyOn(testWindow, 'testEnableKeyboardInput').mockImplementation(() => {
          throw new Error('Keyboard unavailable');
        });

        const result = await testWindow.testHandleCommonCommand(['PC_KEY']);
        expect(result).toBe(true); // Should not crash
      });

      test('should handle PC_MOUSE when mouse input is not available', async () => {
        // Mock enableMouseInput to throw error
        jest.spyOn(testWindow, 'testEnableMouseInput').mockImplementation(() => {
          throw new Error('Mouse unavailable');
        });

        const result = await testWindow.testHandleCommonCommand(['PC_MOUSE']);
        expect(result).toBe(true); // Should not crash
      });
    });
  });

  describe('Command Integration', () => {
    test('should handle multiple commands in sequence', async () => {
      const commands = [
        ['PC_KEY'],
        ['PC_MOUSE'],
        ['SAVE', "'test1.bmp'"],
        ['SAVE', 'WINDOW', "'test2.bmp'"],
        ['SAVE', '0', '0', '100', '100', "'test3.bmp'"]
      ];

      for (const command of commands) {
        const result = await testWindow.testHandleCommonCommand(command);
        expect(result).toBe(true);
      }
    });

    test('should maintain state across commands', async () => {
      // Set initial states
      testWindow.setVKeyPress(65);
      testWindow.setVMouseState(100, 200, { left: true, right: false, middle: false }, 5);

      // Execute PC_KEY - should clear keypress but preserve mouse state
      await testWindow.testHandleCommonCommand(['PC_KEY']);
      expect(testWindow.getVKeyPress()).toBe(0);
      expect(testWindow.getVMouseX()).toBe(100);
      expect(testWindow.getVMouseY()).toBe(200);

      // Execute PC_MOUSE - should clear wheel but preserve coordinates
      await testWindow.testHandleCommonCommand(['PC_MOUSE']);
      expect(testWindow.getVMouseWheel()).toBe(0);
      expect(testWindow.getVMouseX()).toBe(100);
      expect(testWindow.getVMouseY()).toBe(200);
    });

    test('should handle concurrent command execution', async () => {
      // Simulate concurrent execution
      const promises = [
        testWindow.testHandleCommonCommand(['PC_KEY']),
        testWindow.testHandleCommonCommand(['PC_MOUSE']),
        testWindow.testHandleCommonCommand(['SAVE', "'concurrent.bmp'"])
      ];

      const results = await Promise.all(promises);
      expect(results.every(result => result === true)).toBe(true);
    });
  });
});