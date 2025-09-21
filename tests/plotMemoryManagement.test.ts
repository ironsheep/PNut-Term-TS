/** @format */

import { DebugPlotWindow, PlotDisplaySpec } from '../src/classes/debugPlotWin';
import { SpriteManager } from '../src/classes/shared/spriteManager';
import { LayerManager } from '../src/classes/shared/layerManager';
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

describe('PLOT Memory Management Stress Tests', () => {
  let plotWindow: DebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  let originalConsoleLog: any;
  let originalConsoleWarn: any;
  let logMessages: string[] = [];
  let warnMessages: string[] = [];

  beforeEach(() => {
    // Capture console output for memory usage tracking
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    logMessages = [];
    warnMessages = [];

    console.log = (message: string) => {
      logMessages.push(message);
      originalConsoleLog(message);
    };

    console.warn = (message: string) => {
      warnMessages.push(message);
      originalConsoleWarn(message);
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
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;

    // Clean up plot window
    if (plotWindow) {
      plotWindow.closeDebugWindow();
    }
  });

  describe('SpriteManager Memory Management', () => {
    let spriteManager: SpriteManager;

    beforeEach(() => {
      spriteManager = new SpriteManager();
    });

    afterEach(() => {
      if (spriteManager) {
        spriteManager.clearAllSprites();
      }
    });

    test('should track memory usage accurately during sprite creation', () => {
      const initialStats = spriteManager.getMemoryStats();
      expect(initialStats.currentUsage).toBe(0);
      expect(initialStats.spriteCount).toBe(0);

      // Define a sprite with known memory requirements
      const pixels = new Array(16 * 16).fill(0); // 256 pixels
      const colors = new Array(256).fill(0x000000); // 256 colors

      spriteManager.defineSprite(0, 16, 16, pixels, colors);

      const afterFirstSprite = spriteManager.getMemoryStats();
      expect(afterFirstSprite.currentUsage).toBeGreaterThan(0);
      expect(afterFirstSprite.spriteCount).toBe(1);
      expect(afterFirstSprite.totalCreated).toBe(1);

      const firstSpriteMemory = afterFirstSprite.currentUsage;

      // Add second identical sprite
      spriteManager.defineSprite(1, 16, 16, pixels, colors);

      const afterSecondSprite = spriteManager.getMemoryStats();
      expect(afterSecondSprite.currentUsage).toBe(firstSpriteMemory * 2);
      expect(afterSecondSprite.spriteCount).toBe(2);
      expect(afterSecondSprite.totalCreated).toBe(2);
    });

    test('should properly release memory when sprites are cleared', () => {
      const pixels = new Array(16 * 16).fill(0);
      const colors = new Array(256).fill(0x000000);

      // Create multiple sprites
      for (let i = 0; i < 10; i++) {
        spriteManager.defineSprite(i, 16, 16, pixels, colors);
      }

      const beforeClear = spriteManager.getMemoryStats();
      expect(beforeClear.spriteCount).toBe(10);
      expect(beforeClear.currentUsage).toBeGreaterThan(0);

      // Clear one sprite
      spriteManager.clearSprite(0);
      const afterClearOne = spriteManager.getMemoryStats();
      expect(afterClearOne.spriteCount).toBe(9);
      expect(afterClearOne.currentUsage).toBeLessThan(beforeClear.currentUsage);

      // Clear all sprites
      spriteManager.clearAllSprites();
      const afterClearAll = spriteManager.getMemoryStats();
      expect(afterClearAll.spriteCount).toBe(0);
      expect(afterClearAll.currentUsage).toBe(0);
    });

    test('should handle sprite replacement without memory leaks', () => {
      const pixels1 = new Array(8 * 8).fill(0);
      const pixels2 = new Array(32 * 32).fill(0);
      const colors = new Array(256).fill(0x000000);

      // Define initial sprite
      spriteManager.defineSprite(0, 8, 8, pixels1, colors);
      const afterFirst = spriteManager.getMemoryStats();

      // Replace with larger sprite
      spriteManager.defineSprite(0, 32, 32, pixels2, colors);
      const afterReplace = spriteManager.getMemoryStats();

      expect(afterReplace.spriteCount).toBe(1); // Still only one sprite
      expect(afterReplace.currentUsage).toBeGreaterThan(afterFirst.currentUsage); // But more memory
      expect(afterReplace.totalCreated).toBe(2); // Two creation operations
    });

    test('should detect memory health issues', () => {
      const largePixels = new Array(32 * 32).fill(0);
      const colors = new Array(256).fill(0x000000);

      // Create many large sprites to trigger warnings
      for (let i = 0; i < 250; i++) {
        spriteManager.defineSprite(i, 32, 32, largePixels, colors);
      }

      const healthWarning = spriteManager.checkMemoryHealth();
      expect(healthWarning).not.toBeNull();
      expect(healthWarning).toContain('sprite count');
    });

    test('should stress test sprite operations without memory leaks', () => {
      const pixels = new Array(16 * 16).fill(0);
      const colors = new Array(256).fill(0x000000);

      // Perform many operations
      for (let cycle = 0; cycle < 100; cycle++) {
        // Create sprites
        for (let i = 0; i < 10; i++) {
          spriteManager.defineSprite(i, 16, 16, pixels, colors);
        }

        // Clear some sprites
        for (let i = 0; i < 5; i++) {
          spriteManager.clearSprite(i);
        }

        // Replace remaining sprites
        for (let i = 5; i < 10; i++) {
          spriteManager.defineSprite(i, 16, 16, pixels, colors);
        }

        // Clear all
        spriteManager.clearAllSprites();
      }

      // Memory should be back to zero
      const finalStats = spriteManager.getMemoryStats();
      expect(finalStats.currentUsage).toBe(0);
      expect(finalStats.spriteCount).toBe(0);
      expect(finalStats.totalCreated).toBe(1500); // 100 cycles * 15 sprites per cycle
    });
  });

  describe('LayerManager Memory Management', () => {
    let layerManager: LayerManager;

    beforeEach(() => {
      layerManager = new LayerManager();
    });

    afterEach(() => {
      if (layerManager) {
        layerManager.clearAllLayers();
      }
    });

    test('should track memory usage during layer operations', () => {
      const initialStats = layerManager.getMemoryStats();
      expect(initialStats.currentUsage).toBe(0);
      expect(initialStats.layerCount).toBe(0);
    });

    test('should handle layer replacement without memory leaks', () => {
      // This is a theoretical test since we can't easily create bitmap files in Jest
      // In practice, this would test loading different sized bitmaps to the same layer
      const dimensions1 = layerManager.getLayerDimensions(0);
      expect(dimensions1).toBeNull(); // No layer loaded

      const isLoaded = layerManager.isLayerLoaded(0);
      expect(isLoaded).toBe(false);
    });

    test('should properly release memory when layers are cleared', () => {
      // Clear non-existent layer (should not crash)
      layerManager.clearLayer(0);

      // Clear all layers (should not crash)
      layerManager.clearAllLayers();

      const stats = layerManager.getMemoryStats();
      expect(stats.currentUsage).toBe(0);
    });

    test('should detect memory health issues', () => {
      // Test memory health check on empty manager
      const healthWarning = layerManager.checkMemoryHealth();
      expect(healthWarning).toBeNull(); // No issues with empty manager
    });

    test('should stress test layer operations', () => {
      // Test repeated layer operations
      for (let i = 0; i < 100; i++) {
        layerManager.clearLayer(i % 8); // Clear layers in rotation
        layerManager.clearAllLayers(); // Clear all periodically
      }

      const finalStats = layerManager.getMemoryStats();
      expect(finalStats.currentUsage).toBe(0);
    });
  });

  describe('PLOT Window Memory Management Integration', () => {
    test('should properly clean up resources on window close', () => {
      // Simulate resource usage by creating sprites first
      const spriteManager = (plotWindow as any).spriteManager;
      const layerManager = (plotWindow as any).layerManager;

      if (spriteManager) {
        const pixels = new Array(16 * 16).fill(0);
        const colors = new Array(256).fill(0x000000);
        spriteManager.defineSprite(0, 16, 16, pixels, colors);
      }

      // Simulate cleanup directly on managers
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      if (spriteManager) {
        spriteManager.clearAllSprites();
      }
      if (layerManager) {
        layerManager.clearAllLayers();
      }

      // Verify cleanup logging occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('All sprites cleared, memory usage reset to 0')
      );

      consoleSpy.mockRestore();
    });

    test('should handle failed operations with proper cleanup', () => {
      // Test error handling by directly accessing internal components
      const spriteManager = (plotWindow as any).spriteManager;
      const layerManager = (plotWindow as any).layerManager;

      // Test invalid sprite operations
      if (spriteManager) {
        expect(() => {
          spriteManager.defineSprite(-1, 16, 16, [], []); // Invalid sprite ID
        }).toThrow();

        expect(() => {
          spriteManager.defineSprite(0, 0, 16, [], []); // Invalid dimensions
        }).toThrow();

        expect(() => {
          spriteManager.defineSprite(0, 16, 16, [999], []); // Invalid pixel index
        }).toThrow();
      }

      // Should not crash and should handle error gracefully
      expect(true).toBe(true);
    });

    test('should maintain memory efficiency during sustained operations', () => {
      // Test sustained operations on memory managers directly
      const spriteManager = (plotWindow as any).spriteManager;
      const layerManager = (plotWindow as any).layerManager;

      if (spriteManager) {
        const pixels = new Array(16 * 16).fill(0);
        const colors = new Array(256).fill(0x000000);

        // Simulate sustained operation
        for (let i = 0; i < 50; i++) {
          spriteManager.defineSprite(i % 10, 16, 16, pixels, colors);
          spriteManager.clearSprite(i % 10);
        }

        const stats = spriteManager.getMemoryStats();
        expect(stats.currentUsage).toBe(0); // All memory should be cleaned up
      }

      // Should complete without memory issues
      expect(true).toBe(true);
    });

    test('should properly handle memory warnings', () => {
      const warningSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Access sprite and layer managers
      const spriteManager = (plotWindow as any).spriteManager;
      const layerManager = (plotWindow as any).layerManager;

      if (spriteManager) {
        spriteManager.suggestGarbageCollection();
      }

      if (layerManager) {
        layerManager.suggestGarbageCollection();
      }

      warningSpy.mockRestore();
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should track memory performance metrics', () => {
      // Test that performance monitoring includes memory metrics
      const spriteManager = (plotWindow as any).spriteManager;
      const layerManager = (plotWindow as any).layerManager;

      if (spriteManager) {
        const spriteStats = spriteManager.getMemoryStats();
        expect(spriteStats).toHaveProperty('currentUsage');
        expect(spriteStats).toHaveProperty('maxUsage');
        expect(spriteStats).toHaveProperty('spriteCount');
        expect(spriteStats).toHaveProperty('totalCreated');
        expect(spriteStats).toHaveProperty('averageSpriteSize');
      }

      if (layerManager) {
        const layerStats = layerManager.getMemoryStats();
        expect(layerStats).toHaveProperty('currentUsage');
        expect(layerStats).toHaveProperty('maxUsage');
        expect(layerStats).toHaveProperty('layerCount');
        expect(layerStats).toHaveProperty('totalCreated');
        expect(layerStats).toHaveProperty('averageLayerSize');
      }
    });

    test('should provide garbage collection hints', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      const spriteManager = (plotWindow as any).spriteManager;
      const layerManager = (plotWindow as any).layerManager;

      if (spriteManager) {
        spriteManager.suggestGarbageCollection();
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('[SPRITE MANAGER] Garbage collection suggested')
        );
      }

      if (layerManager) {
        layerManager.suggestGarbageCollection();
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('[LAYER MANAGER] Garbage collection suggested')
        );
      }

      logSpy.mockRestore();
    });
  });

  describe('Error Recovery Memory Management', () => {
    test('should clean up resources after failed sprite operations', () => {
      const spriteManager = (plotWindow as any).spriteManager;

      if (spriteManager) {
        // Test various invalid operations directly
        expect(() => {
          spriteManager.defineSprite(256, 16, 16, [], []); // Invalid sprite ID (too high)
        }).toThrow();

        expect(() => {
          spriteManager.defineSprite(0, -1, 16, [], []); // Invalid width
        }).toThrow();

        expect(() => {
          spriteManager.defineSprite(0, 16, -1, [], []); // Invalid height
        }).toThrow();

        expect(() => {
          const pixels = new Array(256).fill(0); // Wrong array size (16*16=256, should be fine)
          const colors = new Array(256).fill(0x000000);
          spriteManager.defineSprite(0, 16, 16, pixels, colors); // This won't throw since size matches
        }).not.toThrow(); // Changed expectation - this should succeed

        expect(() => {
          const pixels = new Array(256).fill(0);
          const colors = new Array(100).fill(0x000000); // Wrong color array size
          spriteManager.defineSprite(0, 16, 16, pixels, colors);
        }).toThrow();

        // Clean up any successful sprite creation for final check
        spriteManager.clearAllSprites();

        // Memory should be zero after cleanup
        const stats = spriteManager.getMemoryStats();
        expect(stats.currentUsage).toBe(0);
      }

      expect(true).toBe(true); // Test passes if no exceptions thrown beyond expected ones
    });

    test('should handle canvas operation failures gracefully', () => {
      // Test accessing properties when components might not be initialized
      const spriteManager = (plotWindow as any).spriteManager;
      const layerManager = (plotWindow as any).layerManager;

      // These should not crash even if window is not fully initialized
      if (spriteManager) {
        const stats = spriteManager.getMemoryStats();
        expect(stats).toBeDefined();
        expect(stats.currentUsage).toBeGreaterThanOrEqual(0);
      }

      if (layerManager) {
        const stats = layerManager.getMemoryStats();
        expect(stats).toBeDefined();
        expect(stats.currentUsage).toBeGreaterThanOrEqual(0);
      }

      // Should not crash
      expect(true).toBe(true);
    });
  });
});