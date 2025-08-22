/** @format */

// tests/windowPlacer.test.ts

import { WindowPlacer, PlacementSlot, PlacementConfig } from '../src/utils/windowPlacer';
import { ScreenManager } from '../src/utils/screenManager';
import { BrowserWindow } from 'electron';

// Mock Electron
jest.mock('electron', () => ({
  screen: {
    getAllDisplays: jest.fn(),
    getPrimaryDisplay: jest.fn(),
    on: jest.fn(),
  },
  BrowserWindow: jest.fn(),
}));

// Mock ScreenManager
jest.mock('../src/utils/screenManager');

describe('WindowPlacer', () => {
  let windowPlacer: WindowPlacer;
  let mockScreenManager: jest.Mocked<ScreenManager>;
  
  const mockPrimaryMonitor = {
    id: '1',
    display: {} as any,
    isPrimary: true,
    name: 'Monitor 1',
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1
  };

  beforeEach(() => {
    // Reset singleton
    WindowPlacer.resetInstance();
    
    // Setup ScreenManager mock
    mockScreenManager = {
      getInstance: jest.fn(),
      getPrimaryMonitor: jest.fn().mockReturnValue(mockPrimaryMonitor),
      getMonitorAtPoint: jest.fn().mockReturnValue(mockPrimaryMonitor),
      getAllMonitors: jest.fn().mockReturnValue([mockPrimaryMonitor]),
      getScreenRealEstate: jest.fn(),
      getMonitorById: jest.fn(),
      findBestMonitorForWindow: jest.fn(),
      ensureWindowOnScreen: jest.fn(),
      getCenterPosition: jest.fn(),
      getWindowMonitor: jest.fn(),
    } as any;
    
    (ScreenManager.getInstance as jest.Mock).mockReturnValue(mockScreenManager);
    
    windowPlacer = WindowPlacer.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = WindowPlacer.getInstance();
      const instance2 = WindowPlacer.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance properly', () => {
      const instance1 = WindowPlacer.getInstance();
      WindowPlacer.resetInstance();
      const instance2 = WindowPlacer.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Slot-based Placement', () => {
    it('should place window in requested slot if available', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_LEFT,
        dimensions: { width: 400, height: 300 },
        margin: 20
      };
      
      const position = windowPlacer.getNextPosition('window1', config);
      
      expect(position.x).toBe(20); // margin from left
      expect(position.y).toBe(20); // margin from top
      expect(position.monitor).toBe(mockPrimaryMonitor);
    });

    it('should place window in TOP_CENTER slot', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_CENTER,
        dimensions: { width: 400, height: 300 },
        margin: 20
      };
      
      const position = windowPlacer.getNextPosition('window1', config);
      
      // Should be centered horizontally
      expect(position.x).toBe((1920 - 400) / 2);
      expect(position.y).toBe(20);
    });

    it('should place window in TOP_RIGHT slot', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_RIGHT,
        dimensions: { width: 400, height: 300 },
        margin: 20
      };
      
      const position = windowPlacer.getNextPosition('window1', config);
      
      expect(position.x).toBe(1920 - 400 - 20); // right aligned with margin
      expect(position.y).toBe(20);
    });

    it('should place window in MIDDLE positions correctly', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.MIDDLE_CENTER,
        dimensions: { width: 400, height: 300 }
      };
      
      const position = windowPlacer.getNextPosition('window1', config);
      
      expect(position.x).toBe((1920 - 400) / 2);
      expect(position.y).toBe((1040 - 300) / 2);
    });

    it('should place window in BOTTOM_LEFT slot', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.BOTTOM_LEFT,
        dimensions: { width: 400, height: 300 },
        margin: 20
      };
      
      const position = windowPlacer.getNextPosition('window1', config);
      
      expect(position.x).toBe(20);
      expect(position.y).toBe(1040 - 300 - 20); // bottom aligned with margin
    });
  });

  describe('Automatic Slot Selection', () => {
    it('should find first available slot when no slot specified', () => {
      const config: PlacementConfig = {
        dimensions: { width: 400, height: 300 }
      };
      
      // First window should get TOP_CENTER (preferred)
      const pos1 = windowPlacer.getNextPosition('window1', config);
      expect(pos1.y).toBe(20); // top position
      expect(pos1.x).toBe((1920 - 400) / 2); // centered
      
      // Second window should get TOP_LEFT
      const pos2 = windowPlacer.getNextPosition('window2', config);
      expect(pos2.y).toBe(20); // also top
      expect(pos2.x).toBe(20); // left position
    });

    it('should track occupied slots', () => {
      const config: PlacementConfig = {
        dimensions: { width: 400, height: 300 }
      };
      
      // Fill several slots
      windowPlacer.getNextPosition('window1', config); // TOP_CENTER
      windowPlacer.getNextPosition('window2', config); // TOP_LEFT  
      windowPlacer.getNextPosition('window3', config); // TOP_RIGHT
      
      // Fourth window should get MIDDLE_LEFT
      const pos4 = windowPlacer.getNextPosition('window4', config);
      expect(pos4.x).toBe(20); // left
      expect(pos4.y).toBeGreaterThan(100); // middle area
    });
  });

  describe('Cascade Fallback', () => {
    it('should cascade when all slots are full', () => {
      const config: PlacementConfig = {
        dimensions: { width: 400, height: 300 },
        cascadeIfFull: true
      };
      
      // Fill all available slots
      const slots = [
        PlacementSlot.TOP_CENTER,
        PlacementSlot.TOP_LEFT,
        PlacementSlot.TOP_RIGHT,
        PlacementSlot.MIDDLE_LEFT,
        PlacementSlot.MIDDLE_RIGHT,
        PlacementSlot.MIDDLE_CENTER,
        PlacementSlot.BOTTOM_LEFT,
      ];
      
      for (let i = 0; i < slots.length; i++) {
        windowPlacer.getNextPosition(`window${i}`, config);
      }
      
      // Next window should cascade
      const cascadePos = windowPlacer.getNextPosition('cascade1', config);
      expect(cascadePos.x).toBe(20); // base position
      expect(cascadePos.y).toBe(20); // base position
      
      // Next cascade should be offset
      const cascadePos2 = windowPlacer.getNextPosition('cascade2', config);
      expect(cascadePos2.x).toBe(50); // base + cascade offset (30)
      expect(cascadePos2.y).toBe(50); // base + cascade offset (30)
    });

    it('should reset cascade when going off screen', () => {
      const config: PlacementConfig = {
        dimensions: { width: 400, height: 300 },
        cascadeIfFull: true
      };
      
      // Fill all slots first
      for (let i = 0; i < 7; i++) {
        windowPlacer.getNextPosition(`slot${i}`, config);
      }
      
      // Create many cascade windows to go off screen
      for (let i = 0; i < 50; i++) {
        const pos = windowPlacer.getNextPosition(`cascade${i}`, config);
        
        // Should never go off screen
        expect(pos.x + 400).toBeLessThanOrEqual(1920);
        expect(pos.y + 300).toBeLessThanOrEqual(1040);
      }
    });
  });

  describe('Window Tracking', () => {
    it('should return same position for already tracked window', () => {
      const config: PlacementConfig = {
        dimensions: { width: 400, height: 300 }
      };
      
      const pos1 = windowPlacer.getNextPosition('window1', config);
      const pos2 = windowPlacer.getNextPosition('window1', config);
      
      expect(pos1).toEqual(pos2);
    });

    it('should register existing window', () => {
      const mockWindow = {
        getBounds: jest.fn().mockReturnValue({ x: 100, y: 200, width: 400, height: 300 }),
        on: jest.fn()
      } as any as BrowserWindow;
      
      windowPlacer.registerWindow('existing', mockWindow);
      
      const tracked = windowPlacer.getTrackedWindows();
      expect(tracked).toHaveLength(1);
      expect(tracked[0].id).toBe('existing');
      expect(tracked[0].bounds.x).toBe(100);
      expect(tracked[0].bounds.y).toBe(200);
    });

    it('should unregister window and free slot', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_LEFT,
        dimensions: { width: 400, height: 300 }
      };
      
      windowPlacer.getNextPosition('window1', config);
      expect(windowPlacer.getTrackedWindows()).toHaveLength(1);
      
      windowPlacer.unregisterWindow('window1');
      expect(windowPlacer.getTrackedWindows()).toHaveLength(0);
      
      // Slot should be available again
      const pos2 = windowPlacer.getNextPosition('window2', { ...config });
      expect(pos2.x).toBe(20); // TOP_LEFT position
      expect(pos2.y).toBe(20);
    });

    it('should auto-unregister when window closes', () => {
      let closeHandler: (() => void) | null = null;
      const mockWindow = {
        getBounds: jest.fn().mockReturnValue({ x: 100, y: 200, width: 400, height: 300 }),
        on: jest.fn((event: string, handler: () => void) => {
          if (event === 'closed') closeHandler = handler;
        })
      } as any as BrowserWindow;
      
      windowPlacer.registerWindow('window1', mockWindow);
      expect(windowPlacer.getTrackedWindows()).toHaveLength(1);
      
      // Simulate window close
      if (closeHandler) (closeHandler as any)();
      expect(windowPlacer.getTrackedWindows()).toHaveLength(0);
    });
  });

  describe('Overlap Detection', () => {
    it('should detect overlapping windows', () => {
      const config: PlacementConfig = {
        dimensions: { width: 400, height: 300 }
      };
      
      windowPlacer.getNextPosition('window1', config);
      
      // Check overlap with existing window
      const wouldOverlap1 = windowPlacer.wouldOverlap({
        x: 760, y: 20, width: 400, height: 300  // Same as window1 position
      });
      expect(wouldOverlap1).toBe(true);
      
      // Check non-overlapping position
      const wouldOverlap2 = windowPlacer.wouldOverlap({
        x: 0, y: 500, width: 100, height: 100
      });
      expect(wouldOverlap2).toBe(false);
    });

    it('should avoid overlap when avoidOverlap is true', () => {
      const config: PlacementConfig = {
        dimensions: { width: 400, height: 300 },
        avoidOverlap: true
      };
      
      const pos1 = windowPlacer.getNextPosition('window1', config);
      const pos2 = windowPlacer.getNextPosition('window2', config);
      
      // Windows should not overlap
      const overlap = (
        pos1.x < pos2.x + 400 &&
        pos1.x + 400 > pos2.x &&
        pos1.y < pos2.y + 300 &&
        pos1.y + 300 > pos2.y
      );
      
      expect(overlap).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large windows', () => {
      const config: PlacementConfig = {
        dimensions: { width: 1800, height: 900 }
      };
      
      const position = windowPlacer.getNextPosition('large', config);
      
      // Should still be on screen
      expect(position.x + 1800).toBeLessThanOrEqual(1920);
      expect(position.y + 900).toBeLessThanOrEqual(1040);
    });

    it('should handle zero margin', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_LEFT,
        dimensions: { width: 400, height: 300 },
        margin: 0
      };
      
      const position = windowPlacer.getNextPosition('window1', config);
      
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });

    it('should fall back to center when cascade disabled and slots full', () => {
      const config: PlacementConfig = {
        dimensions: { width: 400, height: 300 },
        cascadeIfFull: false
      };
      
      // Fill all slots
      for (let i = 0; i < 7; i++) {
        windowPlacer.getNextPosition(`window${i}`, config);
      }
      
      // Next should center
      const centerPos = windowPlacer.getNextPosition('centered', config);
      expect(centerPos.x).toBe((1920 - 400) / 2);
      expect(centerPos.y).toBe((1040 - 300) / 2);
    });
  });
});