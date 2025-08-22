/** @format */

// tests/screenManager.test.ts

import { jest } from '@jest/globals';
import { ScreenManager } from '../src/utils/screenManager';
import { setupDebugWindowTest, cleanupDebugWindowTest } from './shared/mockHelpers';

// Mock Electron screen API
const mockDisplay = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 30, width: 1920, height: 1050 },
  scaleFactor: 1,
  rotation: 0,
  touchSupport: 'unavailable' as const
};

const mockSecondaryDisplay = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
  workArea: { x: 1920, y: 30, width: 1920, height: 1050 },
  scaleFactor: 1,
  rotation: 0,
  touchSupport: 'unavailable' as const
};

const mockHighDPIDisplay = {
  id: 3,
  bounds: { x: 0, y: 0, width: 3840, height: 2160 },
  workArea: { x: 0, y: 30, width: 3840, height: 2130 },
  scaleFactor: 2,
  rotation: 0,
  touchSupport: 'unavailable' as const
};

const mockScreen = {
  getPrimaryDisplay: jest.fn().mockReturnValue(mockDisplay),
  getAllDisplays: jest.fn().mockReturnValue([mockDisplay]),
  getDisplayNearestPoint: jest.fn().mockReturnValue(mockDisplay),
  on: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

jest.mock('electron', () => ({
  screen: mockScreen,
  BrowserWindow: jest.fn().mockImplementation(() => ({
    getBounds: jest.fn().mockReturnValue({ x: 100, y: 100, width: 800, height: 600 })
  }))
}));

describe('ScreenManager', () => {
  let screenManager: ScreenManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (ScreenManager as any).instance = null;
    screenManager = ScreenManager.getInstance();
  });

  afterEach(() => {
    cleanupDebugWindowTest();
  });

  describe('Single Monitor Support', () => {
    beforeEach(() => {
      mockScreen.getAllDisplays.mockReturnValue([mockDisplay]);
      mockScreen.getPrimaryDisplay.mockReturnValue(mockDisplay);
    });

    it('should detect single monitor setup', () => {
      expect(screenManager.isMultiMonitor()).toBe(false);
    });

    it('should get primary monitor information', () => {
      const primary = screenManager.getPrimaryMonitor();
      expect(primary.isPrimary).toBe(true);
      expect(primary.bounds.width).toBe(1920);
      expect(primary.bounds.height).toBe(1080);
    });

    it('should calculate safe position within screen bounds', () => {
      const position = screenManager.calculateSafePosition(
        800, 600, 1500, 800, { avoidTaskbar: true }
      );
      
      // Should constrain to work area
      expect(position.x).toBeLessThanOrEqual(1920 - 800);
      expect(position.y).toBeLessThanOrEqual(1050 - 600);
      expect(position.y).toBeGreaterThanOrEqual(30); // Taskbar height
    });

    it('should handle window placement when position would be off-screen', () => {
      const position = screenManager.calculateSafePosition(
        800, 600, 2000, 2000, {}
      );
      
      // Should bring back on screen
      expect(position.x).toBe(1920 - 800);
      expect(position.y).toBe(1080 - 600);
    });

    it('should center window on screen when requested', () => {
      const position = screenManager.calculateSafePosition(
        800, 600, 0, 0, { centerOnScreen: true, avoidTaskbar: true }
      );
      
      expect(position.x).toBe(Math.round((1920 - 800) / 2));
      expect(position.y).toBe(Math.round(30 + (1050 - 600) / 2));
    });

    it('should calculate cascade positions correctly', () => {
      const pos1 = screenManager.calculateCascadePosition(0, 400, 300);
      const pos2 = screenManager.calculateCascadePosition(1, 400, 300);
      const pos3 = screenManager.calculateCascadePosition(2, 400, 300);
      
      expect(pos1.x).toBe(0);
      expect(pos1.y).toBe(0);
      expect(pos2.x).toBe(32);
      expect(pos2.y).toBe(32);
      expect(pos3.x).toBe(64);
      expect(pos3.y).toBe(64);
    });

    it('should calculate grid positions for multiple windows', () => {
      const pos1 = screenManager.calculateGridPosition(0, 4, 400, 300);
      const pos2 = screenManager.calculateGridPosition(1, 4, 400, 300);
      const pos3 = screenManager.calculateGridPosition(2, 4, 400, 300);
      const pos4 = screenManager.calculateGridPosition(3, 4, 400, 300);
      
      // Should arrange in 2x2 grid
      expect(pos1.x).toBeLessThan(pos2.x);
      expect(pos1.y).toBe(pos2.y);
      expect(pos3.x).toBe(pos1.x);
      expect(pos3.y).toBeGreaterThan(pos1.y);
    });

    it('should fall back gracefully when screen API fails', () => {
      mockScreen.getPrimaryDisplay.mockImplementation(() => {
        throw new Error('Screen API failed');
      });
      
      // Reset to trigger error
      (ScreenManager as any).instance = null;
      const manager = ScreenManager.getInstance();
      
      const primary = manager.getPrimaryMonitor();
      expect(primary).toBeDefined();
      expect(primary.bounds.width).toBe(1920); // Default fallback
    });
  });

  describe('Multi-Monitor Support', () => {
    beforeEach(() => {
      mockScreen.getAllDisplays.mockReturnValue([mockDisplay, mockSecondaryDisplay]);
      mockScreen.getPrimaryDisplay.mockReturnValue(mockDisplay);
      mockScreen.getDisplayNearestPoint.mockImplementation(({ x }) => {
        return x >= 1920 ? mockSecondaryDisplay : mockDisplay;
      });
      
      // Reinitialize with multi-monitor setup
      (ScreenManager as any).instance = null;
      screenManager = ScreenManager.getInstance();
    });

    it('should detect multi-monitor setup', () => {
      expect(screenManager.isMultiMonitor()).toBe(true);
    });

    it('should enumerate all monitors', () => {
      const monitors = screenManager.getMonitors();
      expect(monitors).toHaveLength(2);
      expect(monitors[0].id).toBe('1');
      expect(monitors[1].id).toBe('2');
    });

    it('should calculate total screen real estate', () => {
      const realEstate = screenManager.getScreenRealEstate();
      expect(realEstate.totalWidth).toBe(3840); // Two 1920 wide monitors
      expect(realEstate.availableWidth).toBe(3840);
      expect(realEstate.monitors).toHaveLength(2);
    });

    it('should find correct monitor for point', () => {
      const monitor1 = screenManager.getMonitorAtPoint(500, 500);
      expect(monitor1.id).toBe('1');
      
      const monitor2 = screenManager.getMonitorAtPoint(2500, 500);
      expect(monitor2.id).toBe('2');
    });

    it('should place window on secondary monitor when specified', () => {
      const position = screenManager.calculateSafePosition(
        800, 600, 2500, 200, { monitorId: '2' }
      );
      
      expect(position.monitor.id).toBe('2');
      expect(position.x).toBeGreaterThanOrEqual(1920);
    });

    it('should detect off-screen positions correctly', () => {
      // Position between monitors (gap)
      expect(screenManager.isPositionOffScreen(900, 200, 200, 200)).toBe(false);
      
      // Position completely off screen
      expect(screenManager.isPositionOffScreen(-500, -500, 200, 200)).toBe(true);
      
      // Position on secondary monitor
      expect(screenManager.isPositionOffScreen(2000, 200, 200, 200)).toBe(false);
    });

    it('should handle cascade across multiple monitors', () => {
      // Large cascade index should wrap to secondary monitor
      const position = screenManager.calculateCascadePosition(
        50, 400, 300, { cascadeOffset: { x: 40, y: 40 } }
      );
      
      // Should be on secondary monitor
      expect(position.x).toBeGreaterThanOrEqual(1920);
    });
  });

  describe('High-DPI Support', () => {
    beforeEach(() => {
      mockScreen.getAllDisplays.mockReturnValue([mockHighDPIDisplay]);
      mockScreen.getPrimaryDisplay.mockReturnValue(mockHighDPIDisplay);
      
      // Reinitialize with high-DPI display
      (ScreenManager as any).instance = null;
      screenManager = ScreenManager.getInstance();
    });

    it('should detect high-DPI scale factor', () => {
      const primary = screenManager.getPrimaryMonitor();
      expect(primary.scaleFactor).toBe(2);
    });

    it('should convert between logical and device pixels', () => {
      const logicalPixels = 100;
      const devicePixels = screenManager.toDevicePixels(logicalPixels);
      expect(devicePixels).toBe(200); // 2x scale
      
      const backToLogical = screenManager.toLogicalPixels(devicePixels);
      expect(backToLogical).toBe(logicalPixels);
    });

    it('should handle window placement on high-DPI displays', () => {
      const position = screenManager.calculateSafePosition(
        800, 600, 1000, 1000, { avoidTaskbar: true }
      );
      
      // Should work with logical pixels
      expect(position.x).toBeLessThanOrEqual(3840 - 800);
      expect(position.y).toBeLessThanOrEqual(2130 - 600);
    });
  });

  describe('Monitor Change Events', () => {
    it('should register event listeners for monitor changes', () => {
      expect(mockScreen.on).toHaveBeenCalledWith('display-added', expect.any(Function));
      expect(mockScreen.on).toHaveBeenCalledWith('display-removed', expect.any(Function));
      expect(mockScreen.on).toHaveBeenCalledWith('display-metrics-changed', expect.any(Function));
    });

    it('should refresh monitors when display is added', () => {
      const addHandler = mockScreen.on.mock.calls.find(
        call => call[0] === 'display-added'
      )?.[1] as Function;
      
      // Initially single monitor
      mockScreen.getAllDisplays.mockReturnValue([mockDisplay]);
      
      // Simulate adding monitor
      mockScreen.getAllDisplays.mockReturnValue([mockDisplay, mockSecondaryDisplay]);
      addHandler();
      
      expect(screenManager.isMultiMonitor()).toBe(true);
      expect(screenManager.getMonitors()).toHaveLength(2);
    });

    it('should handle monitor removal gracefully', () => {
      // Start with two monitors
      mockScreen.getAllDisplays.mockReturnValue([mockDisplay, mockSecondaryDisplay]);
      
      const removeHandler = mockScreen.on.mock.calls.find(
        call => call[0] === 'display-removed'
      )?.[1] as Function;
      
      // Simulate removing monitor
      mockScreen.getAllDisplays.mockReturnValue([mockDisplay]);
      removeHandler();
      
      expect(screenManager.isMultiMonitor()).toBe(false);
      expect(screenManager.getMonitors()).toHaveLength(1);
    });

    it('should handle resolution changes', () => {
      const metricsHandler = mockScreen.on.mock.calls.find(
        call => call[0] === 'display-metrics-changed'
      )?.[1] as Function;
      
      const updatedDisplay = {
        ...mockDisplay,
        bounds: { x: 0, y: 0, width: 2560, height: 1440 },
        workArea: { x: 0, y: 30, width: 2560, height: 1410 }
      };
      
      mockScreen.getAllDisplays.mockReturnValue([updatedDisplay]);
      mockScreen.getPrimaryDisplay.mockReturnValue(updatedDisplay);
      
      // Simulate resolution change
      metricsHandler({}, updatedDisplay, ['bounds', 'workArea']);
      
      const primary = screenManager.getPrimaryMonitor();
      expect(primary.bounds.width).toBe(2560);
      expect(primary.bounds.height).toBe(1440);
    });
  });

  describe('Window-specific Helpers', () => {
    it('should get monitor for a window', () => {
      const mockWindow = {
        getBounds: jest.fn().mockReturnValue({ x: 100, y: 100, width: 800, height: 600 })
      };
      
      const monitor = screenManager.getMonitorForWindow(mockWindow as any);
      expect(monitor).toBeDefined();
      expect(mockScreen.getDisplayNearestPoint).toHaveBeenCalledWith({ x: 500, y: 400 });
    });

    it('should handle custom cascade offsets', () => {
      const position = screenManager.calculateCascadePosition(
        3, 400, 300, { cascadeOffset: { x: 50, y: 25 } }
      );
      
      expect(position.x).toBe(150); // 3 * 50
      expect(position.y).toBe(75);  // 3 * 25
    });

    it('should prefer primary monitor when specified', () => {
      mockScreen.getAllDisplays.mockReturnValue([mockDisplay, mockSecondaryDisplay]);
      
      const position = screenManager.calculateSafePosition(
        400, 300, 2500, 500, { preferredMonitor: 'primary' }
      );
      
      expect(position.monitor.id).toBe('1');
      expect(position.x).toBeLessThan(1920); // Should be on primary
    });
  });
});