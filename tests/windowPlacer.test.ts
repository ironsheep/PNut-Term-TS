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
    on: jest.fn()
  },
  BrowserWindow: jest.fn()
}));

// Mock ScreenManager
jest.mock('../src/utils/screenManager');

// ─── Test monitor ───────────────────────────────────────────────────────────
// 1920×1040 workArea (standard 1080p minus 40px taskbar at bottom).
// calculateGridDimensions(1920,1040) → COLS=3, ROWS=3
// colWidth = Math.round((1920-40)/3) = Math.round(626.67) = 627
// rowHeight = Math.round((1040-40)/3) = Math.round(333.33) = 333
// halfSafetyMargin = 10

// Helper: compute expected position for a slot (must mirror calculateSlotPosition logic)
const WA = { x: 0, y: 0, width: 1920, height: 1040 };
const COLS = 3;
const ROWS = 3;
const DEFAULT_MARGIN = 20;

function expectedPos(
  rowIdx: number,
  colIdx: number,
  winW: number,
  winH: number,
  margin: number = DEFAULT_MARGIN
): { x: number; y: number } {
  const colWidth = Math.round((WA.width - margin * 2) / COLS);
  const rowHeight = Math.round((WA.height - margin * 2) / ROWS);
  const isWide = winW > colWidth;
  let x: number;
  if (isWide) {
    if (colIdx <= 1) {
      const joinedWidth = colWidth * 2;
      const joinedStartX = WA.x + margin;
      x = Math.round(joinedStartX + joinedWidth - winW);
    } else if (colIdx >= 3) {
      const joinedStartX = WA.x + margin + 3 * colWidth;
      x = Math.round(joinedStartX);
    } else {
      const cellCenterX = WA.x + margin + colIdx * colWidth + colWidth / 2;
      x = Math.round(cellCenterX - winW / 2);
    }
  } else {
    const cellCenterX = WA.x + margin + colIdx * colWidth + colWidth / 2;
    x = Math.round(cellCenterX - winW / 2);
  }
  const halfSafetyMargin = 10;
  const y = Math.round(WA.y + margin + rowIdx * rowHeight + halfSafetyMargin);
  const finalX = Math.round(
    Math.max(WA.x + margin, Math.min(x, WA.x + WA.width - winW - margin))
  );
  const finalY = Math.round(
    Math.max(WA.y + margin, Math.min(y, WA.y + WA.height - winH - margin))
  );
  return { x: finalX, y: finalY };
}

// Precompute commonly used values (400×300 window, margin=20)
const W = 400, H = 300;
// TOP_LEFT = R0_C0 → (0,0)
const TOP_LEFT_POS = expectedPos(0, 0, W, H);
// TOP_CENTER = R0_C2 → (0,2)
const TOP_CENTER_POS = expectedPos(0, 2, W, H);
// TOP_RIGHT = R0_C4 → (0,4)
const TOP_RIGHT_POS = expectedPos(0, 4, W, H);
// MIDDLE_CENTER = R1_C2 → (1,2)
const MID_CENTER_POS = expectedPos(1, 2, W, H);
// MIDDLE_LEFT = R1_C0 → (1,0)
const MID_LEFT_POS = expectedPos(1, 0, W, H);
// BOTTOM_LEFT = R2_C0 → (2,0)
const BOT_LEFT_POS = expectedPos(2, 0, W, H);

// Center position (getCenterPosition fallback)
const CENTER_X = Math.round(WA.x + (WA.width - W) / 2);
const CENTER_Y = Math.round(WA.y + (WA.height - H) / 2);

describe('WindowPlacer', () => {
  let windowPlacer: WindowPlacer;
  let mockScreenManager: jest.Mocked<ScreenManager>;

  const mockPrimaryMonitor = {
    id: '1',
    display: {} as any,
    isPrimary: true,
    name: 'Monitor 1',
    workArea: WA,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1
  };

  beforeEach(() => {
    // Reset singleton
    WindowPlacer.resetInstance();

    // Setup ScreenManager mock — include ALL methods the source calls
    mockScreenManager = {
      getInstance: jest.fn(),
      getPrimaryMonitor: jest.fn().mockReturnValue(mockPrimaryMonitor),
      getMonitorAtPoint: jest.fn().mockReturnValue(mockPrimaryMonitor),
      getMonitors: jest.fn().mockReturnValue([mockPrimaryMonitor]),
      getScreenRealEstate: jest.fn(),
      getMonitorById: jest.fn(),
      isMultiMonitor: jest.fn().mockReturnValue(false),
      calculateSafePosition: jest.fn(),
      isPositionOffScreen: jest.fn().mockReturnValue(false)
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
    it('should place window in requested TOP_LEFT slot', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_LEFT,
        dimensions: { width: W, height: H },
        margin: DEFAULT_MARGIN
      };

      const position = windowPlacer.getNextPosition('window1', config);

      expect(position.x).toBe(TOP_LEFT_POS.x);
      expect(position.y).toBe(TOP_LEFT_POS.y);
      expect(position.monitor).toBe(mockPrimaryMonitor);
    });

    it('should place window in TOP_CENTER slot', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_CENTER,
        dimensions: { width: W, height: H },
        margin: DEFAULT_MARGIN
      };

      const position = windowPlacer.getNextPosition('window1', config);

      expect(position.x).toBe(TOP_CENTER_POS.x);
      expect(position.y).toBe(TOP_CENTER_POS.y);
    });

    it('should place window in TOP_RIGHT slot', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_RIGHT,
        dimensions: { width: W, height: H },
        margin: DEFAULT_MARGIN
      };

      const position = windowPlacer.getNextPosition('window1', config);

      expect(position.x).toBe(TOP_RIGHT_POS.x);
      expect(position.y).toBe(TOP_RIGHT_POS.y);
    });

    it('should place window in MIDDLE positions correctly', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.MIDDLE_CENTER,
        dimensions: { width: W, height: H }
      };

      const position = windowPlacer.getNextPosition('window1', config);

      expect(position.x).toBe(MID_CENTER_POS.x);
      expect(position.y).toBe(MID_CENTER_POS.y);
    });

    it('should place window in BOTTOM_LEFT slot', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.BOTTOM_LEFT,
        dimensions: { width: W, height: H },
        margin: DEFAULT_MARGIN
      };

      const position = windowPlacer.getNextPosition('window1', config);

      expect(position.x).toBe(BOT_LEFT_POS.x);
      expect(position.y).toBe(BOT_LEFT_POS.y);
    });
  });

  describe('Automatic Slot Selection', () => {
    // Half-moon sequence: R0_C2, R0_C1, R0_C3, R1_C2, R1_C1, R1_C3, R0_C0, ...
    // First slot is R0_C2 (TOP_CENTER)
    it('should assign first window to TOP_CENTER via half-moon order', () => {
      const config: PlacementConfig = {
        dimensions: { width: W, height: H }
      };

      const pos1 = windowPlacer.getNextPosition('window1', config);
      // First slot: R0_C2
      expect(pos1.x).toBe(TOP_CENTER_POS.x);
      expect(pos1.y).toBe(TOP_CENTER_POS.y);
    });

    it('should assign second window to R0_C1 (second in half-moon)', () => {
      const config: PlacementConfig = {
        dimensions: { width: W, height: H }
      };

      windowPlacer.getNextPosition('window1', config); // R0_C2
      const pos2 = windowPlacer.getNextPosition('window2', config); // R0_C1

      // R0_C1 = (row=0, col=1)
      const expected = expectedPos(0, 1, W, H);
      expect(pos2.x).toBe(expected.x);
      expect(pos2.y).toBe(expected.y);
    });

    it('should track occupied slots across windows', () => {
      const config: PlacementConfig = {
        dimensions: { width: W, height: H }
      };

      // Fill first three half-moon slots: R0_C2, R0_C1, R0_C3
      windowPlacer.getNextPosition('window1', config);
      windowPlacer.getNextPosition('window2', config);
      windowPlacer.getNextPosition('window3', config);

      // Fourth window should get R1_C2 (Middle center)
      const pos4 = windowPlacer.getNextPosition('window4', config);
      const expected = expectedPos(1, 2, W, H);
      expect(pos4.x).toBe(expected.x);
      expect(pos4.y).toBeGreaterThan(TOP_CENTER_POS.y); // below top row
    });
  });

  describe('Cascade Fallback', () => {
    it('should cascade when all 13 slots are full', () => {
      const config: PlacementConfig = {
        dimensions: { width: W, height: H },
        cascadeIfFull: true
      };

      // Fill all 13 half-moon slots
      for (let i = 0; i < 13; i++) {
        windowPlacer.getNextPosition(`window${i}`, config);
      }

      // Next windows should cascade starting at workArea origin + margin
      const cascadePos1 = windowPlacer.getNextPosition('cascade1', config);
      expect(cascadePos1.x).toBe(WA.x + DEFAULT_MARGIN); // base position
      expect(cascadePos1.y).toBe(WA.y + DEFAULT_MARGIN);

      // Second cascade offset by 30,30
      const cascadePos2 = windowPlacer.getNextPosition('cascade2', config);
      expect(cascadePos2.x).toBe(WA.x + DEFAULT_MARGIN + 30);
      expect(cascadePos2.y).toBe(WA.y + DEFAULT_MARGIN + 30);
    });

    it('should reset cascade when going off screen', () => {
      const config: PlacementConfig = {
        dimensions: { width: W, height: H },
        cascadeIfFull: true
      };

      // Fill all slots first
      for (let i = 0; i < 13; i++) {
        windowPlacer.getNextPosition(`slot${i}`, config);
      }

      // Create many cascade windows — should never go off screen
      for (let i = 0; i < 50; i++) {
        const pos = windowPlacer.getNextPosition(`cascade${i}`, config);

        expect(pos.x + W).toBeLessThanOrEqual(WA.width);
        expect(pos.y + H).toBeLessThanOrEqual(WA.height);
      }
    });
  });

  describe('Window Tracking', () => {
    it('should return same position for already tracked window', () => {
      const config: PlacementConfig = {
        dimensions: { width: W, height: H }
      };

      const pos1 = windowPlacer.getNextPosition('window1', config);
      const pos2 = windowPlacer.getNextPosition('window1', config);

      expect(pos1.x).toBe(pos2.x);
      expect(pos1.y).toBe(pos2.y);
    });

    it('should register existing window', () => {
      const mockWindow = {
        getBounds: jest.fn().mockReturnValue({ x: 100, y: 200, width: W, height: H }),
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
        dimensions: { width: W, height: H }
      };

      windowPlacer.getNextPosition('window1', config);
      expect(windowPlacer.getTrackedWindows()).toHaveLength(1);

      windowPlacer.unregisterWindow('window1');
      expect(windowPlacer.getTrackedWindows()).toHaveLength(0);

      // Slot should be available again — should get same position
      const pos2 = windowPlacer.getNextPosition('window2', { ...config });
      expect(pos2.x).toBe(TOP_LEFT_POS.x);
      expect(pos2.y).toBe(TOP_LEFT_POS.y);
    });

    it('should auto-unregister when window closes', () => {
      let closeHandler: (() => void) | null = null;
      const mockWindow = {
        getBounds: jest.fn().mockReturnValue({ x: 100, y: 200, width: W, height: H }),
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
        dimensions: { width: W, height: H }
      };

      // Place first window (gets R0_C2 = TOP_CENTER_POS)
      windowPlacer.getNextPosition('window1', config);

      // Check overlap at the actual window1 position
      const wouldOverlap1 = windowPlacer.wouldOverlap({
        x: TOP_CENTER_POS.x, y: TOP_CENTER_POS.y, width: W, height: H
      });
      expect(wouldOverlap1).toBe(true);

      // Check non-overlapping position (far below all windows)
      const wouldOverlap2 = windowPlacer.wouldOverlap({
        x: 0, y: 800, width: 100, height: 100
      });
      expect(wouldOverlap2).toBe(false);
    });

    it('should avoid overlap when avoidOverlap is true', () => {
      const config: PlacementConfig = {
        dimensions: { width: W, height: H },
        avoidOverlap: true
      };

      const pos1 = windowPlacer.getNextPosition('window1', config);
      const pos2 = windowPlacer.getNextPosition('window2', config);

      // Windows should not overlap
      const overlap = (
        pos1.x < pos2.x + W &&
        pos1.x + W > pos2.x &&
        pos1.y < pos2.y + H &&
        pos1.y + H > pos2.y
      );

      expect(overlap).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large windows', () => {
      const largeW = 1800, largeH = 900;
      const config: PlacementConfig = {
        dimensions: { width: largeW, height: largeH }
      };

      const position = windowPlacer.getNextPosition('large', config);

      // Should still be on screen
      expect(position.x + largeW).toBeLessThanOrEqual(WA.width);
      expect(position.y + largeH).toBeLessThanOrEqual(WA.height);
    });

    it('should handle zero margin', () => {
      const config: PlacementConfig = {
        slot: PlacementSlot.TOP_LEFT,
        dimensions: { width: W, height: H },
        margin: 0
      };

      const position = windowPlacer.getNextPosition('window1', config);
      const expected = expectedPos(0, 0, W, H, 0);

      expect(position.x).toBe(expected.x);
      expect(position.y).toBe(expected.y);
    });

    it('should fall back to center when cascade disabled and slots full', () => {
      const config: PlacementConfig = {
        dimensions: { width: W, height: H },
        cascadeIfFull: false
      };

      // Fill all 13 slots
      for (let i = 0; i < 13; i++) {
        windowPlacer.getNextPosition(`window${i}`, config);
      }

      // Next should center (getCenterPosition fallback)
      const centerPos = windowPlacer.getNextPosition('centered', config);
      expect(centerPos.x).toBe(CENTER_X);
      expect(centerPos.y).toBe(CENTER_Y);
    });
  });
});
