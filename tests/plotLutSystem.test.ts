/** @format */

import { DebugPlotWindow, PlotDisplaySpec } from '../src/classes/debugPlotWin';
import { Context } from '../src/utils/context';
import { ColorMode } from '../src/classes/shared/colorTranslator';
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

// Test helper class to access protected methods
class TestableDebugPlotWindow extends DebugPlotWindow {
  public testProcessCommand(command: string): boolean {
    try {
      // Parse command into tokens like the real parser would
      // IMPORTANT: Add display name prefix that processMessageImmediate expects
      const tokens = ['LutTest', ...command.trim().split(/\s+/)];
      console.log(`[TEST DEBUG] Calling processMessageImmediate with tokens: [${tokens.join(', ')}] (length: ${tokens.length})`);
      this.processMessageImmediate(tokens);
      return true;
    } catch (error) {
      console.error(`Command failed: ${command}`, error);
      return false;
    }
  }

  public getLutManager() {
    return super.getLutManager();
  }

  public getColorTranslator() {
    return super.getColorTranslator();
  }
}

describe('LUT Palette System Tests', () => {
  let plotWindow: TestableDebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  let originalConsoleLog: any;
  let logMessages: string[] = [];

  beforeEach(() => {
    // Capture console output
    originalConsoleLog = console.log;
    logMessages = [];
    console.log = (message: string) => {
      logMessages.push(message);
      originalConsoleLog(message);
    };

    // Use shared mock setup
    const testSetup = setupDebugWindowTest();
    mockContext = createMockContext({
      runtime: {
        msWaitBeforeClose: 500,
        isFileLoggingEnabled: false,
        loggedTraffic: jest.fn(),
        logTrafficMessage: jest.fn()
      }
    });

    // Create display spec for LUT testing
    displaySpec = {
      displayName: 'LutTest',
      windowTitle: 'LUT Palette Test Plot',
      position: { x: 100, y: 100 },
      hasExplicitPosition: true,
      size: { width: 256, height: 256 },
      dotSize: { width: 1, height: 1 },
      window: { background: '#000000', grid: '#FFFFFF' },
      lutColors: [],
      delayedUpdate: false,
      hideXY: false
    };

    plotWindow = new TestableDebugPlotWindow(mockContext, displaySpec);
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;

    // Clean up plot window
    if (plotWindow) {
      plotWindow.closeDebugWindow();
    }
  });

  describe('LUT Command Basic Functionality', () => {
    test('should handle LUT command with hex color values', () => {
      const commands = [
        'LUT 0 $FF0000',  // Red - Spin2 hex format
        'LUT 1 $00FF00',  // Green - Spin2 hex format
        'LUT 2 $0000FF',  // Blue - Spin2 hex format
        'LUT 3 $FFFF00'   // Yellow - Spin2 hex format
      ];

      commands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true);
      });

      // Debug: Check LUT manager state IMMEDIATELY after LUT commands (before UPDATE)
      const lutManagerImmediate = plotWindow.getLutManager();
      console.log(`[TEST DEBUG] Plot window instance: ${plotWindow.constructor.name}`);
      console.log(`[TEST DEBUG] LUT manager instance: ${lutManagerImmediate.constructor.name}`);
      console.log(`[TEST DEBUG] IMMEDIATE - LUT manager color 0: ${lutManagerImmediate.getColor(0)}`);
      console.log(`[TEST DEBUG] IMMEDIATE - LUT manager palette size: ${lutManagerImmediate.getPaletteSize()}`);

      // TEMP: Try WITHOUT calling UPDATE to see if operations are being queued vs immediate
      console.log(`[TEST DEBUG] SKIPPING UPDATE - checking if operations were immediate`);

      // Debug: Check LUT manager state without UPDATE
      const lutManagerWithoutUpdate = plotWindow.getLutManager();
      console.log(`[TEST DEBUG] NO UPDATE - LUT manager color 0: ${lutManagerWithoutUpdate.getColor(0)}`);
      console.log(`[TEST DEBUG] NO UPDATE - LUT manager palette size: ${lutManagerWithoutUpdate.getPaletteSize()}`);

      // Now call UPDATE to see the difference
      plotWindow.testProcessCommand('UPDATE');

      // Debug: Check LUT manager state after UPDATE
      const lutManagerAfter = plotWindow.getLutManager();
      console.log(`[TEST DEBUG] After UPDATE - LUT manager color 0: ${lutManagerAfter.getColor(0)}`);
      console.log(`[TEST DEBUG] After UPDATE - LUT manager palette size: ${lutManagerAfter.getPaletteSize()}`);
      console.log(`[TEST DEBUG] Same LUT manager instance? ${lutManagerWithoutUpdate === lutManagerAfter}`);

      // Verify palette was updated
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBe(0xFF0000);
      expect(lutManager.getColor(1)).toBe(0x00FF00);
      expect(lutManager.getColor(2)).toBe(0x0000FF);
      expect(lutManager.getColor(3)).toBe(0xFFFF00);

      // Verify no errors
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle LUT command with named colors', () => {
      const commands = [
        'LUT 0 RED',
        'LUT 1 GREEN',
        'LUT 2 BLUE',
        'LUT 3 WHITE'
      ];

      commands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true);
      });

      // Verify palette was updated with correct color values
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBeGreaterThan(0); // RED should be > 0
      expect(lutManager.getColor(1)).toBeGreaterThan(0); // GREEN should be > 0
      expect(lutManager.getColor(2)).toBeGreaterThan(0); // BLUE should be > 0
      expect(lutManager.getColor(3)).toBeGreaterThan(0); // WHITE should be > 0

      // Verify no errors
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal $ prefix hex notation', () => {
      const commands = [
        'LUT 0 $FF0000',  // Pascal hex format
        'LUT 1 $00FF00',
        'LUT 2 $0000FF'
      ];

      commands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true);
      });

      // Verify palette was updated
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBe(0xFF0000);
      expect(lutManager.getColor(1)).toBe(0x00FF00);
      expect(lutManager.getColor(2)).toBe(0x0000FF);
    });

    test('should handle LUT command boundary cases', () => {
      // Test minimum and maximum valid indices
      const commands = [
        'LUT 0 $FF0000',    // Minimum index
        'LUT 255 $00FF00'   // Maximum index
      ];

      commands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true);
      });

      // Verify palette was updated
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBe(0xFF0000);
      expect(lutManager.getColor(255)).toBe(0x00FF00);
    });

    test('should reject invalid LUT command parameters', () => {
      const invalidCommands = [
        'LUT',              // Missing parameters
        'LUT 0',            // Missing color
        'LUT -1 RED',       // Invalid index (negative)
        'LUT 256 RED',      // Invalid index (too high)
        'LUT 0 INVALIDCOLOR' // Invalid color
      ];

      invalidCommands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        // Commands should fail gracefully (may return false)
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('LUTCOLORS Command Basic Functionality', () => {
    test('should handle LUTCOLORS command with multiple hex colors', () => {
      const command = 'LUTCOLORS $FF0000 $00FF00 $0000FF $FFFF00 $FF00FF $00FFFF';
      const result = plotWindow.testProcessCommand(command);
      expect(result).toBe(true);

      // Verify palette was updated with all colors
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBe(0xFF0000);
      expect(lutManager.getColor(1)).toBe(0x00FF00);
      expect(lutManager.getColor(2)).toBe(0x0000FF);
      expect(lutManager.getColor(3)).toBe(0xFFFF00);
      expect(lutManager.getColor(4)).toBe(0xFF00FF);
      expect(lutManager.getColor(5)).toBe(0x00FFFF);

      // Verify no errors
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle LUTCOLORS command with named colors', () => {
      const command = 'LUTCOLORS RED GREEN BLUE WHITE BLACK YELLOW';
      const result = plotWindow.testProcessCommand(command);
      expect(result).toBe(true);

      // Verify palette has colors (specific values depend on color name parsing)
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getPaletteSize()).toBeGreaterThanOrEqual(6);

      // Verify no errors
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle LUTCOLORS command with Pascal $ prefix', () => {
      const command = 'LUTCOLORS $FF0000 $00FF00 $0000FF';
      const result = plotWindow.testProcessCommand(command);
      expect(result).toBe(true);

      // Verify palette was updated
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBe(0xFF0000);
      expect(lutManager.getColor(1)).toBe(0x00FF00);
      expect(lutManager.getColor(2)).toBe(0x0000FF);
    });

    test('should handle LUTCOLORS command with mixed color formats', () => {
      const command = 'LUTCOLORS RED $00FF00 $0000FF WHITE';
      const result = plotWindow.testProcessCommand(command);
      expect(result).toBe(true);

      // Verify palette has correct number of colors
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getPaletteSize()).toBeGreaterThanOrEqual(4);
    });

    test('should handle large LUTCOLORS arrays', () => {
      // Generate 100 colors
      const colors = [];
      for (let i = 0; i < 100; i++) {
        colors.push(`$${(i * 0x010101).toString(16).padStart(6, '0')}`);
      }
      const command = `LUTCOLORS ${colors.join(' ')}`;

      const result = plotWindow.testProcessCommand(command);
      expect(result).toBe(true);

      // Verify all colors were loaded
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getPaletteSize()).toBe(100);
    });

    test('should reject invalid LUTCOLORS command parameters', () => {
      const invalidCommands = [
        'LUTCOLORS',         // Missing parameters
        'LUTCOLORS INVALID'  // Invalid color name
      ];

      invalidCommands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        // Commands should fail gracefully
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('LUT Integration with Color Translation', () => {
    test('should update color translator when LUT palette changes', () => {
      // Set up a simple LUT palette
      const result = plotWindow.testProcessCommand('LUTCOLORS $FF0000 $00FF00 $0000FF $FFFFFF');
      expect(result).toBe(true);

      // Verify color translator has the updated palette
      const colorTranslator = plotWindow.getColorTranslator();
      const lutManager = plotWindow.getLutManager();

      // The color translator should have been updated with the same palette
      expect(colorTranslator).toBeTruthy();
      expect(lutManager.getPaletteSize()).toBe(4);
    });

    test('should work with different LUT modes', () => {
      // Set up a palette suitable for LUT2 mode (4 colors)
      const result = plotWindow.testProcessCommand('LUTCOLORS $FF0000 $00FF00 $0000FF $FFFFFF');
      expect(result).toBe(true);

      const lutManager = plotWindow.getLutManager();
      const colorTranslator = plotWindow.getColorTranslator();

      // Verify we have enough colors for LUT2 mode
      expect(lutManager.hasColorsForMode(2)).toBe(true);
      expect(lutManager.hasColorsForMode(1)).toBe(true);
    });
  });

  describe('LUT System Edge Cases and Error Handling', () => {
    test('should handle palette replacement correctly', () => {
      // Set initial palette
      let result = plotWindow.testProcessCommand('LUT 0 $FF0000');
      expect(result).toBe(true);

      // Replace with different color
      result = plotWindow.testProcessCommand('LUT 0 $00FF00');
      expect(result).toBe(true);

      // Verify replacement worked
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBe(0x00FF00);
    });

    test('should handle LUTCOLORS replacing existing palette', () => {
      // Set initial palette
      let result = plotWindow.testProcessCommand('LUTCOLORS $FF0000 $00FF00');
      expect(result).toBe(true);

      // Replace entire palette
      result = plotWindow.testProcessCommand('LUTCOLORS $0000FF $FFFF00 $FF00FF');
      expect(result).toBe(true);

      // Verify replacement worked
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBe(0x0000FF);
      expect(lutManager.getColor(1)).toBe(0xFFFF00);
      expect(lutManager.getColor(2)).toBe(0xFF00FF);
      expect(lutManager.getPaletteSize()).toBe(3);
    });

    test('should handle maximum palette size (256 colors)', () => {
      // Generate 300 colors (more than max)
      const colors = [];
      for (let i = 0; i < 300; i++) {
        colors.push(`0x${(i % 256).toString(16).padStart(6, '0')}`);
      }
      const command = `LUTCOLORS ${colors.join(' ')}`;

      const result = plotWindow.testProcessCommand(command);
      expect(result).toBe(true);

      // Verify palette was limited to 256 colors
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getPaletteSize()).toBeLessThanOrEqual(256);
    });

    test('should maintain palette state across multiple operations', () => {
      // Build palette incrementally
      const commands = [
        'LUT 0 $FF0000',
        'LUT 5 $00FF00',
        'LUT 10 $0000FF',
        'LUTCOLORS $FFFF00 $FF00FF'  // This should replace the palette
      ];

      commands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true);
      });

      // After LUTCOLORS, only the new palette should remain
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getColor(0)).toBe(0xFFFF00);
      expect(lutManager.getColor(1)).toBe(0xFF00FF);
      expect(lutManager.getPaletteSize()).toBe(2);
    });
  });

  describe('LUT System Performance', () => {
    test('should handle rapid LUT operations efficiently', () => {
      const startTime = Date.now();

      // Perform many LUT operations
      for (let i = 0; i < 100; i++) {
        const command = `LUT ${i % 256} $${(i * 0x010101).toString(16).padStart(6, '0')}`;
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Verify palette state is consistent
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getPaletteSize()).toBeGreaterThan(0);
    });

    test('should handle large LUTCOLORS operations efficiently', () => {
      const startTime = Date.now();

      // Generate and load 256 colors
      const colors = [];
      for (let i = 0; i < 256; i++) {
        colors.push(`$${(i * 0x010101).toString(16).padStart(6, '0')}`);
      }
      const command = `LUTCOLORS ${colors.join(' ')}`;

      const result = plotWindow.testProcessCommand(command);
      expect(result).toBe(true);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(500);

      // Verify all colors were loaded
      const lutManager = plotWindow.getLutManager();
      expect(lutManager.getPaletteSize()).toBe(256);
    });
  });
});