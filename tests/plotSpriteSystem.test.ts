/** @format */

import { DebugPlotWindow, PlotDisplaySpec } from '../src/classes/debugPlotWin';
import { SpriteManager } from '../src/classes/shared/spriteManager';
import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { PlotWindowIntegrator } from '../src/classes/shared/plotParserIntegration';
import { Context } from '../src/utils/context';
import {
  createMockContext,
  createMockBrowserWindow,
  setupDebugWindowTest,
  cleanupDebugWindowTest
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow())
}));

describe('PLOT Sprite System Tests', () => {
  let plotWindow: DebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  let spriteManager: SpriteManager;
  let commandParser: PlotCommandParser;
  let integrator: PlotWindowIntegrator;

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

    // Create display spec
    displaySpec = {
      displayName: 'TestPlot',
      windowTitle: 'Test Plot Window',
      position: { x: 100, y: 100 },
      hasExplicitPosition: false,
      size: { width: 256, height: 256 },
      dotSize: { width: 1, height: 1 },
      window: { background: '#000000', grid: '#FFFFFF' },
      lutColors: [],
      delayedUpdate: false,
      hideXY: false
    };

    plotWindow = new DebugPlotWindow(mockContext, displaySpec);

    // Get components for direct testing
    spriteManager = (plotWindow as any).spriteManager;
    commandParser = (plotWindow as any).plotCommandParser;
    integrator = (plotWindow as any).plotWindowIntegrator;
  });

  afterEach(() => {
    if (plotWindow) {
      plotWindow.closeDebugWindow();
    }
    jest.clearAllMocks();
  });

  describe('SPRITEDEF Command Tests', () => {
    describe('Basic SPRITEDEF functionality', () => {
      test('should parse valid SPRITEDEF command', () => {
        const command = 'SPRITEDEF 0 2 2 0 1 2 3 0xFF0000 0x00FF00 0x0000FF 0x000000';
        const context = {
          originalCommand: command,
          tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteDefCommand(context);

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.canvasOperations).toHaveLength(1);

        const operation = result.canvasOperations[0];
        expect(operation.parameters.spriteId).toBe(0);
        expect(operation.parameters.width).toBe(2);
        expect(operation.parameters.height).toBe(2);
        expect(operation.parameters.pixels).toEqual([0, 1, 2, 3]);
        expect(operation.parameters.colors[0]).toBe(0xFF0000);
        expect(operation.parameters.colors[1]).toBe(0x00FF00);
        expect(operation.parameters.colors[2]).toBe(0x0000FF);
        expect(operation.parameters.colors[3]).toBe(0x000000);
      });

      test('should validate sprite ID range (0-255)', () => {
        const invalidCommands = [
          'SPRITEDEF -1 2 2 0 1 2 3',
          'SPRITEDEF 256 2 2 0 1 2 3',
          'SPRITEDEF abc 2 2 0 1 2 3'
        ];

        for (const command of invalidCommands) {
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteDefCommand(context);
          expect(result.success).toBe(false);
          expect(result.errors.some((error: string) => error.includes('sprite ID'))).toBe(true);
        }
      });

      test('should validate sprite dimensions (1-32 x 1-32)', () => {
        const invalidCommands = [
          'SPRITEDEF 0 0 2 0 1',      // width = 0
          'SPRITEDEF 0 2 0 0 1',      // height = 0
          'SPRITEDEF 0 33 2 0 1',     // width > 32
          'SPRITEDEF 0 2 33 0 1',     // height > 32
          'SPRITEDEF 0 -1 2 0 1',     // negative width
          'SPRITEDEF 0 2 -1 0 1'      // negative height
        ];

        for (const command of invalidCommands) {
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteDefCommand(context);
          expect(result.success).toBe(false);
          expect(result.errors.some((error: string) =>
            error.includes('width') || error.includes('height')
          )).toBe(true);
        }
      });

      test('should validate pixel data array size', () => {
        // 2x2 sprite needs exactly 4 pixels
        const insufficientPixels = 'SPRITEDEF 0 2 2 0 1 2'; // only 3 pixels
        const context1 = {
          originalCommand: insufficientPixels,
          tokens: insufficientPixels.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result1 = (commandParser as any).handleSpriteDefCommand(context1);
        expect(result1.success).toBe(false);
        expect(result1.errors.some((error: string) => error.includes('pixel values'))).toBe(true);
      });

      test('should validate pixel index range (0-255)', () => {
        const invalidPixelCommand = 'SPRITEDEF 0 2 2 0 1 256 3'; // pixel index 256 > 255
        const context = {
          originalCommand: invalidPixelCommand,
          tokens: invalidPixelCommand.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteDefCommand(context);
        expect(result.success).toBe(false);
        expect(result.errors.some((error: string) => error.includes('pixel index'))).toBe(true);
      });

      test('should handle hex color values', () => {
        const command = 'SPRITEDEF 0 1 1 0 $FF0000 $00FF00';
        const context = {
          originalCommand: command,
          tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteDefCommand(context);
        expect(result.success).toBe(true);
        expect(result.canvasOperations[0].parameters.colors[0]).toBe(0xFF0000);
        expect(result.canvasOperations[0].parameters.colors[1]).toBe(0x00FF00);
      });

      test('should fill missing colors with black', () => {
        const command = 'SPRITEDEF 0 1 1 0 0xFF0000 0x00FF00'; // Only 2 colors
        const context = {
          originalCommand: command,
          tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteDefCommand(context);
        expect(result.success).toBe(true);
        expect(result.canvasOperations[0].parameters.colors).toHaveLength(256);
        expect(result.canvasOperations[0].parameters.colors[0]).toBe(0xFF0000);
        expect(result.canvasOperations[0].parameters.colors[1]).toBe(0x00FF00);
        expect(result.canvasOperations[0].parameters.colors[2]).toBe(0x000000); // Black fill
        expect(result.canvasOperations[0].parameters.colors[255]).toBe(0x000000); // Black fill
      });

      test('should handle maximum sprite size (32x32)', () => {
        const pixels = new Array(32 * 32).fill(0).map((_, i) => i % 256);
        const colors = new Array(256).fill(0).map((_, i) => i * 0x010101); // Grayscale
        const command = `SPRITEDEF 255 32 32 ${pixels.join(' ')} ${colors.map(c => `0x${c.toString(16).padStart(6, '0')}`).join(' ')}`;

        const context = {
          originalCommand: command,
          tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteDefCommand(context);
        expect(result.success).toBe(true);
        expect(result.canvasOperations[0].parameters.spriteId).toBe(255);
        expect(result.canvasOperations[0].parameters.width).toBe(32);
        expect(result.canvasOperations[0].parameters.height).toBe(32);
        expect(result.canvasOperations[0].parameters.pixels).toHaveLength(1024);
        expect(result.canvasOperations[0].parameters.colors).toHaveLength(256);
      });
    });

    describe('SPRITEDEF error handling', () => {
      test('should handle insufficient parameters', () => {
        const invalidCommands = [
          'SPRITEDEF',           // No parameters
          'SPRITEDEF 0',         // Only ID
          'SPRITEDEF 0 2',       // Missing height
        ];

        for (const command of invalidCommands) {
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteDefCommand(context);
          expect(result.success).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      test('should handle malformed numeric values', () => {
        const malformedCommand = 'SPRITEDEF 0 2 2 0 1 invalid 3';
        const context = {
          originalCommand: malformedCommand,
          tokens: malformedCommand.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteDefCommand(context);
        expect(result.success).toBe(false);
        expect(result.errors.some((error: string) => error.includes('pixel index'))).toBe(true);
      });

      test('should handle malformed color values', () => {
        const malformedCommand = 'SPRITEDEF 0 1 1 0 invalid_color';
        const context = {
          originalCommand: malformedCommand,
          tokens: malformedCommand.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteDefCommand(context);
        expect(result.success).toBe(false);
        expect(result.errors.some((error: string) => error.includes('color value'))).toBe(true);
      });
    });

    describe('SPRITEDEF memory management', () => {
      test('should execute sprite definition through integrator', async () => {
        if (spriteManager && integrator) {
          const spriteId = 42;
          const width = 4;
          const height = 4;
          const pixels = new Array(16).fill(0).map((_, i) => i % 4);
          const colors = new Array(256).fill(0).map((_, i) => i * 0x010101);

          // Execute sprite definition
          const operation = {
            spriteId,
            width,
            height,
            pixels,
            colors
          };

          await (integrator as any).executeDefineSprite(operation);

          // Verify sprite was stored
          expect(spriteManager.isSpriteDefine(spriteId)).toBe(true);

          const spriteDimensions = spriteManager.getSpriteDimensions(spriteId);
          expect(spriteDimensions?.width).toBe(width);
          expect(spriteDimensions?.height).toBe(height);

          const sprite = spriteManager.getSprite(spriteId);
          expect(sprite?.pixels).toEqual(pixels);
          expect(sprite?.colors).toEqual(colors);
        }
      });

      test('should handle sprite replacement', async () => {
        if (spriteManager && integrator) {
          const spriteId = 1;

          // Define initial sprite
          const operation1 = {
            spriteId,
            width: 2,
            height: 2,
            pixels: [0, 1, 2, 3],
            colors: new Array(256).fill(0xFF0000)
          };

          await (integrator as any).executeDefineSprite(operation1);
          expect(spriteManager.isSpriteDefine(spriteId)).toBe(true);

          // Replace with different sprite
          const operation2 = {
            spriteId,
            width: 3,
            height: 3,
            pixels: [0, 1, 2, 3, 4, 5, 6, 7, 8],
            colors: new Array(256).fill(0x00FF00)
          };

          await (integrator as any).executeDefineSprite(operation2);

          // Verify replacement
          const dimensions = spriteManager.getSpriteDimensions(spriteId);
          expect(dimensions?.width).toBe(3);
          expect(dimensions?.height).toBe(3);

          const sprite = spriteManager.getSprite(spriteId);
          expect(sprite?.pixels).toEqual(operation2.pixels);
          expect(sprite?.colors[0]).toBe(0x00FF00);
        }
      });
    });
  });

  describe('SPRITE Command Tests', () => {
    beforeEach(async () => {
      // Define a test sprite for SPRITE command tests
      if (spriteManager && integrator) {
        const testSpriteOperation = {
          spriteId: 42,
          width: 4,
          height: 4,
          pixels: [
            0, 1, 2, 3,
            1, 2, 3, 0,
            2, 3, 0, 1,
            3, 0, 1, 2
          ],
          colors: new Array(256).fill(0).map((_, i) => {
            if (i === 0) return 0xFF0000; // Red
            if (i === 1) return 0x00FF00; // Green
            if (i === 2) return 0x0000FF; // Blue
            if (i === 3) return 0xFFFF00; // Yellow
            return 0x000000; // Black for rest
          })
        };

        await (integrator as any).executeDefineSprite(testSpriteOperation);
      }
    });

    describe('Basic SPRITE functionality', () => {
      test('should parse valid SPRITE command with ID only', () => {
        const command = 'SPRITE 42';
        const context = {
          originalCommand: command,
          tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteCommand(context);

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.canvasOperations).toHaveLength(1);

        const operation = result.canvasOperations[0];
        expect(operation.parameters.spriteId).toBe(42);
        expect(operation.parameters.orientation).toBe(0);    // Default
        expect(operation.parameters.scale).toBe(1.0);        // Default
        expect(operation.parameters.opacity).toBe(255);      // Default
      });

      test('should parse SPRITE command with all parameters', () => {
        const command = 'SPRITE 42 90 2.5 128';
        const context = {
          originalCommand: command,
          tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteCommand(context);

        expect(result.success).toBe(true);
        expect(result.canvasOperations[0].parameters.spriteId).toBe(42);
        expect(result.canvasOperations[0].parameters.orientation).toBe(90);
        expect(result.canvasOperations[0].parameters.scale).toBe(2.5);
        expect(result.canvasOperations[0].parameters.opacity).toBe(128);
      });

      test('should validate sprite ID range (0-255)', () => {
        const invalidCommands = [
          'SPRITE -1',
          'SPRITE 256',
          'SPRITE abc'
        ];

        for (const command of invalidCommands) {
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteCommand(context);
          expect(result.success).toBe(false);
          expect(result.errors.some((error: string) => error.includes('sprite ID'))).toBe(true);
        }
      });

      test('should validate orientation range (0-359)', () => {
        const invalidCommands = [
          'SPRITE 42 -1',
          'SPRITE 42 360',
          'SPRITE 42 abc'
        ];

        for (const command of invalidCommands) {
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteCommand(context);
          expect(result.success).toBe(false);
          expect(result.errors.some((error: string) => error.includes('orientation'))).toBe(true);
        }
      });

      test('should validate opacity range (0-255)', () => {
        const invalidCommands = [
          'SPRITE 42 0 1.0 -1',
          'SPRITE 42 0 1.0 256',
          'SPRITE 42 0 1.0 abc'
        ];

        for (const command of invalidCommands) {
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteCommand(context);
          expect(result.success).toBe(false);
          expect(result.errors.some((error: string) => error.includes('opacity'))).toBe(true);
        }
      });
    });

    describe('SPRITE transformation tests', () => {
      test('should handle various orientation values', () => {
        const orientations = [0, 45, 90, 135, 180, 225, 270, 315, 359];

        for (const orientation of orientations) {
          const command = `SPRITE 42 ${orientation}`;
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteCommand(context);
          expect(result.success).toBe(true);
          expect(result.canvasOperations[0].parameters.orientation).toBe(orientation);
        }
      });

      test('should handle various scale values', () => {
        const scales = [0.1, 0.5, 1.0, 1.5, 2.0, 5.0, 10.0];

        for (const scale of scales) {
          const command = `SPRITE 42 0 ${scale}`;
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteCommand(context);
          expect(result.success).toBe(true);
          expect(result.canvasOperations[0].parameters.scale).toBe(scale);
        }
      });

      test('should handle various opacity values', () => {
        const opacities = [0, 32, 64, 128, 192, 255];

        for (const opacity of opacities) {
          const command = `SPRITE 42 0 1.0 ${opacity}`;
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteCommand(context);
          expect(result.success).toBe(true);
          expect(result.canvasOperations[0].parameters.opacity).toBe(opacity);
        }
      });
    });

    describe('SPRITE rendering integration', () => {
      test('should execute sprite drawing through integrator', () => {
        if (integrator && spriteManager) {
          // Mock canvas context
          const mockCtx = {
            save: jest.fn(),
            restore: jest.fn(),
            translate: jest.fn(),
            scale: jest.fn(),
            rotate: jest.fn(),
            drawImage: jest.fn(),
            globalAlpha: 1,
            createImageData: jest.fn(() => ({
              data: new Uint8ClampedArray(16 * 4),
              width: 4,
              height: 4
            })),
            putImageData: jest.fn()
          };

          // Mock cursor position
          (plotWindow as any).cursorPosition = { x: 100, y: 100 };

          // Execute sprite drawing
          const operation = {
            spriteId: 42,
            orientation: 45,
            scale: 1.5,
            opacity: 200
          };

          // This should not throw
          expect(() => {
            (integrator as any).executeDrawSprite(operation);
          }).not.toThrow();
        }
      });

      test('should handle undefined sprite ID gracefully', () => {
        if (integrator) {
          const operation = {
            spriteId: 99, // Undefined sprite
            orientation: 0,
            scale: 1.0,
            opacity: 255
          };

          expect(() => {
            (integrator as any).executeDrawSprite(operation);
          }).toThrow('Sprite 99 is not defined');
        }
      });

      test('should validate sprite rendering parameters', () => {
        if (integrator) {
          // Missing sprite ID
          expect(() => {
            (integrator as any).executeDrawSprite({});
          }).toThrow();

          // Invalid orientation
          expect(() => {
            (integrator as any).executeDrawSprite({
              spriteId: 42,
              orientation: -1
            });
          }).toThrow();

          // Invalid scale
          expect(() => {
            (integrator as any).executeDrawSprite({
              spriteId: 42,
              scale: 0
            });
          }).toThrow();

          // Invalid opacity
          expect(() => {
            (integrator as any).executeDrawSprite({
              spriteId: 42,
              opacity: -1
            });
          }).toThrow();
        }
      });
    });

    describe('SPRITE error handling', () => {
      test('should handle missing sprite ID', () => {
        const command = 'SPRITE';
        const context = {
          originalCommand: command,
          tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
        };

        const result = (commandParser as any).handleSpriteCommand(context);
        expect(result.success).toBe(false);
        expect(result.errors.some((error: string) => error.includes('sprite ID'))).toBe(true);
      });

      test('should handle malformed parameters', () => {
        const malformedCommands = [
          'SPRITE abc',           // Invalid ID
          'SPRITE 42 abc',        // Invalid orientation
          'SPRITE 42 90 abc',     // Invalid scale
          'SPRITE 42 90 1.0 abc'  // Invalid opacity
        ];

        for (const command of malformedCommands) {
          const context = {
            originalCommand: command,
            tokens: command.split(' ').map(token => ({ value: token, type: 'token' as any }))
          };

          const result = (commandParser as any).handleSpriteCommand(context);
          expect(result.success).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Sprite System Integration Tests', () => {
    describe('Coordinate system integration', () => {
      test('should work with CARTESIAN coordinate mode', async () => {
        // Set CARTESIAN mode
        (plotWindow as any).coordinateMode = 2; // CM_CARTESIAN

        if (spriteManager && integrator) {
          // Define and draw sprite
          await (integrator as any).executeDefineSprite({
            spriteId: 10,
            width: 2,
            height: 2,
            pixels: [0, 1, 2, 3],
            colors: new Array(256).fill(0).map((_, i) => i * 0x010101)
          });

          expect(() => {
            (integrator as any).executeDrawSprite({
              spriteId: 10,
              orientation: 0,
              scale: 1.0,
              opacity: 255
            });
          }).not.toThrow();
        }
      });

      test('should work with POLAR coordinate mode', async () => {
        // Set POLAR mode
        (plotWindow as any).coordinateMode = 1; // CM_POLAR

        if (spriteManager && integrator) {
          // Define and draw sprite
          await (integrator as any).executeDefineSprite({
            spriteId: 11,
            width: 2,
            height: 2,
            pixels: [0, 1, 2, 3],
            colors: new Array(256).fill(0).map((_, i) => i * 0x010101)
          });

          expect(() => {
            (integrator as any).executeDrawSprite({
              spriteId: 11,
              orientation: 0,
              scale: 1.0,
              opacity: 255
            });
          }).not.toThrow();
        }
      });
    });

    describe('Performance tests', () => {
      test('should handle multiple sprite instances efficiently', async () => {
        if (spriteManager && integrator) {
          // Define a sprite
          await (integrator as any).executeDefineSprite({
            spriteId: 20,
            width: 8,
            height: 8,
            pixels: new Array(64).fill(0).map((_, i) => i % 16),
            colors: new Array(256).fill(0).map((_, i) => i * 0x010101)
          });

          // Render multiple instances
          const startTime = performance.now();

          for (let i = 0; i < 100; i++) {
            (integrator as any).executeDrawSprite({
              spriteId: 20,
              orientation: i % 360,
              scale: 1.0 + (i % 10) * 0.1,
              opacity: 255 - (i % 128)
            });
          }

          const endTime = performance.now();
          const duration = endTime - startTime;

          // Should complete within reasonable time (1 second)
          expect(duration).toBeLessThan(1000);
        }
      });

      test('should handle sprite definitions efficiently', async () => {
        if (spriteManager && integrator) {
          const startTime = performance.now();

          // Define multiple sprites
          for (let id = 0; id < 50; id++) {
            await (integrator as any).executeDefineSprite({
              spriteId: id,
              width: 4,
              height: 4,
              pixels: new Array(16).fill(0).map((_, i) => (i + id) % 256),
              colors: new Array(256).fill(0).map((_, i) => (i * id) % 0xFFFFFF)
            });
          }

          const endTime = performance.now();
          const duration = endTime - startTime;

          // Should complete within reasonable time (500ms)
          expect(duration).toBeLessThan(500);

          // Verify all sprites were defined
          for (let id = 0; id < 50; id++) {
            expect(spriteManager.isSpriteDefine(id)).toBe(true);
          }
        }
      });
    });

    describe('Memory management integration', () => {
      test('should track memory usage correctly', async () => {
        if (spriteManager && integrator) {
          const initialStats = spriteManager.getMemoryStats();
          expect(initialStats.currentUsage).toBe(0);

          // Define sprites and track memory
          await (integrator as any).executeDefineSprite({
            spriteId: 30,
            width: 16,
            height: 16,
            pixels: new Array(256).fill(0),
            colors: new Array(256).fill(0xFF0000)
          });

          const afterFirstSprite = spriteManager.getMemoryStats();
          expect(afterFirstSprite.currentUsage).toBeGreaterThan(0);
          expect(afterFirstSprite.spriteCount).toBe(1);

          // Define second sprite
          await (integrator as any).executeDefineSprite({
            spriteId: 31,
            width: 8,
            height: 8,
            pixels: new Array(64).fill(0),
            colors: new Array(256).fill(0x00FF00)
          });

          const afterSecondSprite = spriteManager.getMemoryStats();
          expect(afterSecondSprite.currentUsage).toBeGreaterThan(afterFirstSprite.currentUsage);
          expect(afterSecondSprite.spriteCount).toBe(2);

          // Clear sprites and verify cleanup
          spriteManager.clearAllSprites();
          const afterClear = spriteManager.getMemoryStats();
          expect(afterClear.currentUsage).toBe(0);
          expect(afterClear.spriteCount).toBe(0);
        }
      });

      test('should handle memory cleanup on sprite replacement', async () => {
        if (spriteManager && integrator) {
          const spriteId = 40;

          // Define initial sprite
          await (integrator as any).executeDefineSprite({
            spriteId,
            width: 4,
            height: 4,
            pixels: new Array(16).fill(0),
            colors: new Array(256).fill(0xFF0000)
          });

          const afterFirst = spriteManager.getMemoryStats();
          const firstMemory = afterFirst.currentUsage;

          // Replace with larger sprite
          await (integrator as any).executeDefineSprite({
            spriteId,
            width: 16,
            height: 16,
            pixels: new Array(256).fill(0),
            colors: new Array(256).fill(0x00FF00)
          });

          const afterReplace = spriteManager.getMemoryStats();
          expect(afterReplace.spriteCount).toBe(1); // Still one sprite
          expect(afterReplace.currentUsage).toBeGreaterThan(firstMemory); // But more memory
          expect(afterReplace.totalCreated).toBe(2); // Two creation operations
        }
      });
    });

    describe('Error recovery and robustness', () => {
      test('should recover from sprite definition errors', async () => {
        if (spriteManager && integrator) {
          // Valid sprite first
          await (integrator as any).executeDefineSprite({
            spriteId: 50,
            width: 2,
            height: 2,
            pixels: [0, 1, 2, 3],
            colors: new Array(256).fill(0xFF0000)
          });

          expect(spriteManager.isSpriteDefine(50)).toBe(true);

          // Invalid sprite should not affect valid one
          await expect((integrator as any).executeDefineSprite({
            spriteId: 51,
            width: 0, // Invalid
            height: 2,
            pixels: [],
            colors: []
          })).rejects.toThrow();

          // Original sprite should still be valid
          expect(spriteManager.isSpriteDefine(50)).toBe(true);
          expect(spriteManager.isSpriteDefine(51)).toBe(false);
        }
      });

      test('should handle canvas rendering errors gracefully', () => {
        if (integrator) {
          // Try to draw undefined sprite
          expect(() => {
            (integrator as any).executeDrawSprite({
              spriteId: 999 // Undefined
            });
          }).toThrow();

          // System should remain stable
          expect(spriteManager.getMemoryStats().spriteCount).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});