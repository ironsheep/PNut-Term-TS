/** @format */

const ENABLE_CONSOLE_LOG: boolean = true;

// src/utils/windowPlacer.ts

import { BrowserWindow } from 'electron';
import { ScreenManager, WindowPosition, MonitorInfo } from './screenManager';
import * as os from 'os';

/**
 * Predefined placement slots for 5x3 grid system
 * Grid layout provides organized window placement
 */
export enum PlacementSlot {
  // Row 0 (Top)
  R0_C0 = 'row0-col0', // Top far left
  R0_C1 = 'row0-col1', // Top left-center
  R0_C2 = 'row0-col2', // Top center
  R0_C3 = 'row0-col3', // Top right-center
  R0_C4 = 'row0-col4', // Top far right

  // Row 1 (Middle)
  R1_C0 = 'row1-col0', // Middle far left
  R1_C1 = 'row1-col1', // Middle left-center
  R1_C2 = 'row1-col2', // Middle center
  R1_C3 = 'row1-col3', // Middle right-center
  R1_C4 = 'row1-col4', // Middle far right

  // Row 2 (Bottom)
  R2_C0 = 'row2-col0', // Bottom far left
  R2_C1 = 'row2-col1', // Bottom left-center
  R2_C2 = 'row2-col2', // Bottom center (MainWindow)
  R2_C3 = 'row2-col3', // Bottom right-center
  R2_C4 = 'row2-col4', // Bottom far right (DebugLogger)

  // Legacy aliases for compatibility
  TOP_LEFT = R0_C0,
  TOP_CENTER = R0_C2,
  TOP_RIGHT = R0_C4,
  MIDDLE_LEFT = R1_C0,
  MIDDLE_CENTER = R1_C2,
  MIDDLE_RIGHT = R1_C4,
  BOTTOM_LEFT = R2_C0
  // BOTTOM_CENTER = R2_C2 reserved for MainWindow
  // BOTTOM_RIGHT = R2_C4 reserved for DebugLoggerWindow
}

/**
 * Window dimensions for placement calculation
 */
export interface WindowDimensions {
  width: number;
  height: number;
}

/**
 * Placement strategy for special window types
 */
export enum PlacementStrategy {
  DEFAULT = 'default', // Standard slot-based placement
  DEBUGGER = 'debugger', // Special placement for debugger windows
  COG_GRID = 'cog_grid' // 2x4 grid placement for COG windows
}

/**
 * Placement configuration for a window
 */
export interface PlacementConfig {
  slot?: PlacementSlot;
  preferredSlot?: PlacementSlot; // Hint for system windows (MainWindow, DebugLogger)
  dimensions: WindowDimensions;
  margin?: number;
  avoidOverlap?: boolean;
  cascadeIfFull?: boolean;
  strategy?: PlacementStrategy; // Special placement strategy
}

/**
 * Tracked window information with monitor awareness
 */
interface TrackedWindow {
  id: string;
  slot?: PlacementSlot;
  bounds: { x: number; y: number; width: number; height: number };
  monitorId: string;
  windowRef?: BrowserWindow;
}

/**
 * WindowPlacer - Intelligent window placement for debug windows
 *
 * Implements a sophisticated placement system based on the "Half-Moon Descending Algorithm"
 * that provides center-balanced window arrangements with collision detection for oversized windows.
 *
 * ## HALF-MOON DESCENDING ALGORITHM
 *
 * The placement algorithm creates a visual pattern that resembles a half-moon sliding down
 * the screen and getting wider as it descends. This maintains visual balance around the
 * center column while providing predictable, organized placement.
 *
 * **Algorithm Phases:**
 * 1. **Start the half-moon**: Place first window at top center (balance: 0L,1C,0R)
 * 2. **Expand horizontally**: Fill 3 columns across current rows (left/right of center)
 * 3. **Descend and match**: Drop down one row, match the pattern above
 * 4. **Go wider**: Expand to 5 columns across existing rows (far left/right)
 * 5. **Continue descending**: Repeat pattern on subsequent rows
 *
 * **Balance Principle**:
 * Windows are placed to maintain symmetry around the center line (Column 2).
 * - Left side: Columns 0, 1 (2 positions per row)
 * - Center: Column 2 (1 position per row)
 * - Right side: Columns 3, 4 (2 positions per row)
 *
 * Balance is achieved at: 1, 3, 4, 6, 8, 10 windows (symmetrical arrangements)
 *
 * **Sequence Example (5×3 grid):**
 * 1. R0_C2 (Top center) → Balanced
 * 2. R0_C1 (Top left-center) → Unbalanced
 * 3. R0_C3 (Top right-center) → Balanced
 * 4. R1_C2 (Middle center) → Balanced
 * 5. R1_C1 (Middle left-center) → Unbalanced
 * 6. R1_C3 (Middle right-center) → Balanced
 * 7. R0_C0 (Top far-left) → Unbalanced
 * 8. R0_C4 (Top far-right) → Balanced
 *
 * ## COORDINATE CALCULATION AND POSITIONING
 *
 * **Grid-Based Layout:**
 * - Adaptive grid sizing based on monitor dimensions and aspect ratio
 * - Very large displays (4K+): 5×4 grid, Large displays (1440p+): 5×3 grid
 * - Medium displays (1080p+): 3×3 grid, Small displays: 3×2 grid
 * - Ultra-wide adjustments: Add columns, Tall displays: Add rows
 *
 * **Coordinate System:**
 * - X-axis: Windows centered within their assigned column
 * - Y-axis: Title bars aligned across each row with safety margin from top
 * - Safety margin: 20px between windows (10px above + 10px below each window)
 *
 * **Y-Positioning Formula:**
 * ```
 * y = workArea.y + margin + (row * rowHeight) + halfSafetyMargin
 * ```
 * This ensures:
 * - Consistent title bar alignment across rows
 * - Proper spacing between rows
 * - Visual coherence regardless of window heights
 *
 * ## COLLISION DETECTION FOR OVERSIZED WINDOWS
 *
 * The system automatically detects and handles windows that exceed their cell boundaries:
 *
 * **Width Overflow (Horizontal Collision):**
 * - Detection: `windowWidth > (columnWidth - safetyMargin)`
 * - Strategy: Centered overflow - mark cells left AND right of assigned slot
 * - Calculation: Split additional columns needed between left and right sides
 * - Small windows can coexist if safety margins are maintained
 *
 * **Height Overflow (Vertical Collision):**
 * - Detection: `windowHeight > (rowHeight - safetyMargin)`
 * - Strategy: Mark cells BELOW only (preserves title bar alignment)
 * - Tall windows affect subsequent rows but maintain row structure
 *
 * **Boundary Handling:**
 * - If oversized window would overflow grid edges → Developer edge case
 * - System attempts to relocate to available space when possible
 * - Document as placement exception requiring smaller window sizes
 *
 * ## RESERVED SLOTS
 *
 * **Bottom Row Reservations:**
 * - R2_C2: Reserved for MainWindow (user's primary workspace)
 * - R2_C4: Reserved for DebugLoggerWindow
 * - MainWindow: Centered in column or fit within boundaries
 * - DebugLogger: Minimum gap from MainWindow, centered if possible
 *
 * ## MULTI-MONITOR SUPPORT
 *
 * **Monitor Selection:**
 * - Uses smart monitor selection with macOS optimization
 * - Prefers monitors with positive coordinates to avoid positioning bugs
 * - Falls back to primary monitor if all have negative coordinates
 *
 * **Cross-Monitor Limitations:**
 * - Current implementation focuses on single-monitor placement
 * - Cross-monitor placement requires explicit coordinate calculation
 * - Future enhancement: Multi-monitor grid spanning
 *
 * This is a SHARED component used by all debug windows for consistent
 * placement behavior across the application.
 */
export class WindowPlacer {
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private static instance: WindowPlacer | null = null;
  private screenManager: ScreenManager;
  private trackedWindows: Map<string, TrackedWindow> = new Map();
  private occupiedSlots: Set<PlacementSlot> = new Set();
  private cascadeOffset = { x: 30, y: 30 };
  private cascadeCounter = 0;
  private defaultMargin = 20;
  private debuggerWindowCount = 0; // Track number of debugger windows
  private debuggerCascadeOffset = { x: 20, y: 20 }; // Smaller cascade for large windows
  private isMacOS: boolean = os.platform() === 'darwin'; // macOS detection

  private constructor() {
    this.screenManager = ScreenManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WindowPlacer {
    if (!WindowPlacer.instance) {
      WindowPlacer.instance = new WindowPlacer();
    }
    return WindowPlacer.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (WindowPlacer.instance) {
      WindowPlacer.instance.cleanup();
      WindowPlacer.instance = null;
    }
  }

  /**
   * Get next available position for a window
   *
   * @param windowId Unique identifier for the window
   * @param config Placement configuration
   * @returns Calculated position and monitor info
   */
  public getNextPosition(windowId: string, config: PlacementConfig): WindowPosition {
    this.logConsoleMessage(`[WINDOW PLACER] 🎯 getNextPosition requested for: ${windowId}`);
    this.logConsoleMessage(`[WINDOW PLACER] 📊 Current occupied slots:`, Array.from(this.occupiedSlots));
    this.logConsoleMessage(`[WINDOW PLACER] 🪟 Current tracked windows:`, Array.from(this.trackedWindows.keys()));

    // If window already tracked, return its current position
    const tracked = this.trackedWindows.get(windowId);
    if (tracked) {
      this.logConsoleMessage(`[WINDOW PLACER] ♻️  Window ${windowId} already tracked, returning existing position`);
      return {
        x: tracked.bounds.x,
        y: tracked.bounds.y,
        monitor: this.screenManager.getMonitorAtPoint(tracked.bounds.x, tracked.bounds.y)
      };
    }

    // Handle special placement strategies
    if (config.strategy === PlacementStrategy.DEBUGGER) {
      const debuggerPosition = this.getDebuggerPosition(windowId, config);
      return this.applyMacOSWorkaround(debuggerPosition, config.dimensions, windowId);
    }

    if (config.strategy === PlacementStrategy.COG_GRID) {
      const cogPosition = this.getCOGGridPosition(windowId, config);
      return this.applyMacOSWorkaround(cogPosition, config.dimensions, windowId);
    }

    // If specific slot requested and available, use it
    if (config.slot && !this.occupiedSlots.has(config.slot)) {
      const position = this.calculateSlotPosition(config.slot, config.dimensions, config.margin);
      const correctedPosition = this.applyMacOSWorkaround(position, config.dimensions, windowId);
      this.markSlotOccupied(windowId, config.slot, correctedPosition, config.dimensions);
      return correctedPosition;
    }

    // Check for preferred slot hint (for system windows)
    if (config.preferredSlot && !this.occupiedSlots.has(config.preferredSlot)) {
      const position = this.calculateSlotPosition(config.preferredSlot, config.dimensions, config.margin);
      const correctedPosition = this.applyMacOSWorkaround(position, config.dimensions, windowId);
      this.markSlotOccupied(windowId, config.preferredSlot, correctedPosition, config.dimensions);
      return correctedPosition;
    }

    // Find first available slot
    const availableSlot = this.findAvailableSlot(config.avoidOverlap);
    if (availableSlot) {
      this.logConsoleMessage(`[WINDOW PLACER] ✅ Found available slot: ${availableSlot} for window: ${windowId}`);
      const position = this.calculateSlotPosition(availableSlot, config.dimensions, config.margin);
      const correctedPosition = this.applyMacOSWorkaround(position, config.dimensions, windowId);
      this.markSlotOccupied(windowId, availableSlot, correctedPosition, config.dimensions);
      this.logConsoleMessage(
        `[WINDOW PLACER] 🎯 Assigned position: ${correctedPosition.x},${correctedPosition.y} in slot: ${availableSlot}`
      );
      return correctedPosition;
    }

    // All slots full, cascade if enabled
    if (config.cascadeIfFull !== false) {
      this.logConsoleMessage(`[WINDOW PLACER] ⚠️  All slots full, using cascade for window: ${windowId}`);
      const cascadePosition = this.getCascadePosition(windowId, config.dimensions, config.margin);
      return this.applyMacOSWorkaround(cascadePosition, config.dimensions, windowId);
    }

    // Default to center of primary monitor
    const centerPosition = this.getCenterPosition(config.dimensions);
    return this.applyMacOSWorkaround(centerPosition, config.dimensions, windowId);
  }

  /**
   * Register an existing window position with monitor tracking
   * Used when window is manually positioned or loaded from saved state
   */
  public registerWindow(windowId: string, window: BrowserWindow, expectedPosition?: WindowPosition): void {
    const bounds = window.getBounds();
    this.logConsoleMessage(`[WINDOW PLACER] 📋 registerWindow called for: ${windowId}`);
    this.logConsoleMessage(
      `[WINDOW PLACER] 📏 ACTUAL window bounds from getBounds(): ${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`
    );

    // Apply macOS position validation if expected position provided
    if (expectedPosition) {
      this.validateMacOSPosition(window, expectedPosition, windowId);
    }

    const monitor = this.screenManager.getMonitorAtPoint(bounds.x, bounds.y);
    const slot = this.detectSlotFromPosition(bounds);
    this.logConsoleMessage(`[WINDOW PLACER] 🎯 ACTUAL detected slot: ${slot} (vs calculated slot)`);

    this.trackedWindows.set(windowId, {
      id: windowId,
      slot,
      bounds,
      monitorId: monitor.id,
      windowRef: window
    });

    if (slot) {
      this.occupiedSlots.add(slot);
    }

    // Track position changes
    window.on('move', () => {
      this.updateWindowPosition(windowId, window);
    });

    // Clean up when window closes
    window.on('closed', () => {
      this.unregisterWindow(windowId);
    });
  }

  /**
   * Update window position when moved
   */
  private updateWindowPosition(windowId: string, window: BrowserWindow): void {
    const bounds = window.getBounds();
    const newMonitor = this.screenManager.getMonitorAtPoint(bounds.x, bounds.y);
    const tracked = this.trackedWindows.get(windowId);

    if (tracked) {
      const oldMonitorId = tracked.monitorId;
      tracked.bounds = bounds;
      tracked.monitorId = newMonitor.id;

      // Detect monitor change
      if (oldMonitorId !== newMonitor.id) {
        this.logConsoleMessage(`Window ${windowId} moved from monitor ${oldMonitorId} to ${newMonitor.id}`);
        // Could emit an event here for other components to react
      }

      // Update slot detection
      const newSlot = this.detectSlotFromPosition(bounds);
      if (tracked.slot !== newSlot) {
        if (tracked.slot) {
          this.occupiedSlots.delete(tracked.slot);
        }
        tracked.slot = newSlot;
        if (newSlot) {
          this.occupiedSlots.add(newSlot);
        }
      }
    }
  }

  /**
   * Unregister a window and free its slot
   */
  public unregisterWindow(windowId: string): void {
    const tracked = this.trackedWindows.get(windowId);
    if (tracked) {
      this.logConsoleMessage(`[WINDOW PLACER] 🗑️  Unregistering window: ${windowId} from slot: ${tracked.slot}`);
      if (tracked.slot) {
        this.occupiedSlots.delete(tracked.slot);
        this.logConsoleMessage(
          `[WINDOW PLACER] ♻️  Freed slot: ${tracked.slot}, remaining slots:`,
          Array.from(this.occupiedSlots)
        );
      }
      this.trackedWindows.delete(windowId);
    } else {
      this.logConsoleMessage(`[WINDOW PLACER] ⚠️  Attempted to unregister unknown window: ${windowId}`);
    }
  }

  /**
   * Check if a position would overlap with existing windows
   */
  public wouldOverlap(bounds: { x: number; y: number; width: number; height: number }): boolean {
    for (const tracked of this.trackedWindows.values()) {
      if (this.rectanglesOverlap(bounds, tracked.bounds)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all tracked windows
   */
  public getTrackedWindows(): TrackedWindow[] {
    return Array.from(this.trackedWindows.values());
  }

  /**
   * macOS Coordinate Workaround: Apply platform-specific positioning fixes
   *
   * macOS has known bugs with negative coordinates where it automatically
   * moves windows to the display they "overlap most with". This method
   * implements several strategies to work around this limitation.
   *
   * @param position Original calculated position
   * @param dimensions Window dimensions
   * @param windowId Window identifier for tracking
   * @returns Corrected position that works on macOS
   */
  private applyMacOSWorkaround(
    position: WindowPosition,
    dimensions: WindowDimensions,
    windowId: string
  ): WindowPosition {
    if (!this.isMacOS) {
      return position; // No workaround needed on other platforms
    }

    const hasNegativeCoords = position.x < 0 || position.y < 0;

    if (!hasNegativeCoords) {
      return position; // No workaround needed for positive coordinates
    }

    this.logConsoleMessage(
      `[WINDOW PLACER] 🍎 macOS workaround: ${windowId} has negative coords (${position.x}, ${position.y})`
    );

    // Strategy 1: Use monitor-relative positioning instead of absolute coordinates
    const targetMonitor = position.monitor;
    const workArea = targetMonitor.workArea;

    // Convert absolute coordinates to monitor-relative
    const relativeX = position.x - targetMonitor.bounds.x;
    const relativeY = position.y - targetMonitor.bounds.y;

    // For monitors with negative origins, use work area relative positioning
    const correctedX = workArea.x + Math.max(0, relativeX);
    const correctedY = workArea.y + Math.max(0, relativeY);

    // Ensure window fits within monitor bounds
    const safeX = Math.min(correctedX, workArea.x + workArea.width - dimensions.width - 20);
    const safeY = Math.min(correctedY, workArea.y + workArea.height - dimensions.height - 20);

    const correctedPosition = {
      x: Math.max(workArea.x + 10, safeX), // Add minimum margin
      y: Math.max(workArea.y + 10, safeY),
      monitor: targetMonitor
    };

    this.logConsoleMessage(
      `[WINDOW PLACER] 🍎 macOS correction: ${windowId} moved from (${position.x}, ${position.y}) to (${correctedPosition.x}, ${correctedPosition.y})`
    );

    return correctedPosition;
  }

  /**
   * Post-creation position validation for macOS
   *
   * After window creation, check if macOS moved it and correct if needed.
   * This is called from registerWindow() to detect and fix position drift.
   *
   * @param window The BrowserWindow to validate
   * @param expectedPosition The position we intended
   * @param windowId Window identifier for logging
   */
  private validateMacOSPosition(window: BrowserWindow, expectedPosition: WindowPosition, windowId: string): void {
    if (!this.isMacOS) {
      return; // Only needed on macOS
    }

    // Give macOS a moment to potentially move the window
    setTimeout(() => {
      const actualBounds = window.getBounds();
      const tolerance = 50; // Allow some variance

      const xDiff = Math.abs(actualBounds.x - expectedPosition.x);
      const yDiff = Math.abs(actualBounds.y - expectedPosition.y);

      if (xDiff > tolerance || yDiff > tolerance) {
        this.logConsoleMessage(`[WINDOW PLACER] 🍎 macOS position drift detected for ${windowId}:`);
        this.logConsoleMessage(`[WINDOW PLACER] 🍎   Expected: (${expectedPosition.x}, ${expectedPosition.y})`);
        this.logConsoleMessage(`[WINDOW PLACER] 🍎   Actual: (${actualBounds.x}, ${actualBounds.y})`);
        this.logConsoleMessage(`[WINDOW PLACER] 🍎   Drift: (${xDiff}, ${yDiff})`);

        // Strategy 2: Try to move window back to intended position
        // Note: This may not work if macOS keeps overriding, but worth trying
        try {
          window.setPosition(expectedPosition.x, expectedPosition.y);
          this.logConsoleMessage(`[WINDOW PLACER] 🍎 Attempted position correction for ${windowId}`);
        } catch (error) {
          this.logConsoleMessage(`[WINDOW PLACER] 🍎 Position correction failed for ${windowId}:`, error);
        }
      }
    }, 100); // Short delay to allow macOS to do its thing first
  }

  /**
   * Smart monitor selection to avoid negative coordinates on macOS
   *
   * If possible, prefer monitors with positive coordinates to avoid
   * the macOS positioning bug entirely.
   *
   * @returns Monitor info for the best monitor to use
   */
  private selectOptimalMonitor(): MonitorInfo {
    const monitors = this.screenManager.getMonitors();
    const primaryMonitor = this.screenManager.getPrimaryMonitor();

    // HYPOTHESIS 2 DEBUGGING: Monitor ID vs Array Index
    this.logConsoleMessage(`[WINDOW_PLACER] 🔍 HYPOTHESIS 2: Monitor Selection Analysis`);
    this.logConsoleMessage(
      `[WINDOW_PLACER] 🔍 AVAILABLE MONITORS: [${monitors.map((m, i) => `Index:${i} ID:${m.id}`).join(', ')}]`
    );
    this.logConsoleMessage(`[WINDOW_PLACER] 🔍 PRIMARY MONITOR: ID:${primaryMonitor.id}`);

    if (!this.isMacOS) {
      this.logConsoleMessage(`[WINDOW_PLACER] 🔍 SELECTED: Primary monitor ID:${primaryMonitor.id} (non-macOS)`);
      return this.screenManager.getPrimaryMonitor(); // Use normal logic on other platforms
    }

    // If primary monitor has positive coordinates, use it
    if (primaryMonitor.bounds.x >= 0 && primaryMonitor.bounds.y >= 0) {
      this.logConsoleMessage(`[WINDOW_PLACER] 🔍 SELECTED: Primary monitor ID:${primaryMonitor.id} (positive coords)`);
      return primaryMonitor;
    }

    // Otherwise, find a monitor with positive coordinates
    const positiveMonitor = monitors.find((m) => m.bounds.x >= 0 && m.bounds.y >= 0);

    if (positiveMonitor) {
      this.logConsoleMessage(
        `[WINDOW PLACER] 🍎 macOS optimization: Using monitor ${positiveMonitor.id} with positive coords instead of primary`
      );
      this.logConsoleMessage(`[WINDOW_PLACER] 🔍 SELECTED: Monitor ID:${positiveMonitor.id} (macOS positive coords)`);
      return positiveMonitor;
    }

    // If all monitors have negative coordinates, use primary (least problematic)
    this.logConsoleMessage(`[WINDOW PLACER] 🍎 macOS warning: All monitors have negative coordinates, using primary`);
    this.logConsoleMessage(`[WINDOW_PLACER] 🔍 SELECTED: Primary monitor ID:${primaryMonitor.id} (fallback)`);
    return primaryMonitor;
  }

  /**
   * Calculate position for a specific slot
   */
  private calculateSlotPosition(slot: PlacementSlot, dimensions: WindowDimensions, margin?: number): WindowPosition {
    const m = margin ?? this.defaultMargin;
    const monitor = this.selectOptimalMonitor(); // Use smart monitor selection
    this.logConsoleMessage(
      `[WINDOW PLACER] 🖥️  Using monitor: ID=${monitor.id} (${monitor.workArea.width}x${monitor.workArea.height} at ${monitor.workArea.x},${monitor.workArea.y})`
    );
    const workArea = monitor.workArea;

    // Calculate grid dimensions using shared logic
    const { COLS, ROWS } = this.calculateGridDimensions(workArea);

    // Calculate column width and row height (rounded for integer positioning)
    const colWidth = Math.round((workArea.width - m * 2) / COLS);
    const rowHeight = Math.round((workArea.height - m * 2) / ROWS);

    // Parse slot to get row and column
    let row = 0;
    let col = 0;

    // Extract row and column from slot enum
    const slotStr = slot.toString();
    if (slotStr.includes('row0')) row = 0;
    else if (slotStr.includes('row1')) row = 1;
    else if (slotStr.includes('row2')) row = 2;

    if (slotStr.includes('col0')) col = 0;
    else if (slotStr.includes('col1')) col = 1;
    else if (slotStr.includes('col2')) col = 2;
    else if (slotStr.includes('col3')) col = 3;
    else if (slotStr.includes('col4')) col = 4;

    // Check if window is wider than a single column
    const isWideWindow = dimensions.width > colWidth;
    let x: number;
    let y: number;

    if (isWideWindow) {
      // Smart alignment for wide windows
      if (col <= 1) {
        // Left side (cols 0-1): Join columns and right-align
        const joinedWidth = colWidth * 2;
        const joinedStartX = workArea.x + m;
        x = Math.round(joinedStartX + joinedWidth - dimensions.width); // Right-align
      } else if (col >= 3) {
        // Right side (cols 3-4): Join columns and left-align
        const joinedStartX = workArea.x + m + 3 * colWidth;
        x = Math.round(joinedStartX); // Left-align
      } else {
        // Center column: Center the window
        const cellCenterX = workArea.x + m + col * colWidth + colWidth / 2;
        x = Math.round(cellCenterX - dimensions.width / 2);
      }
    } else {
      // Normal centering for windows that fit in a column
      const cellCenterX = workArea.x + m + col * colWidth + colWidth / 2;
      x = Math.round(cellCenterX - dimensions.width / 2);
    }

    // Align title bars across row with safety margin from top of cell
    const safetyMargin = 20; // Fixed margin between windows
    const halfSafetyMargin = safetyMargin / 2;
    y = Math.round(workArea.y + m + row * rowHeight + halfSafetyMargin);

    // Ensure window stays within work area and round to integer coordinates
    const finalX = Math.round(
      Math.max(workArea.x + m, Math.min(x, workArea.x + workArea.width - dimensions.width - m))
    );
    const finalY = Math.round(
      Math.max(workArea.y + m, Math.min(y, workArea.y + workArea.height - dimensions.height - m))
    );

    // HYPOTHESIS 1 DEBUGGING: Grid Math Calculations
    this.logConsoleMessage(`[WINDOW_PLACER] 🧮 HYPOTHESIS 1: Grid Math Analysis`);
    this.logConsoleMessage(`[WINDOW_PLACER] 🧮 SLOT: ${slot} -> grid(${col},${row}) on ${COLS}x${ROWS} grid`);
    this.logConsoleMessage(
      `[WINDOW_PLACER] 🧮 WORK_AREA: ${workArea.x},${workArea.y} ${workArea.width}x${workArea.height}`
    );
    this.logConsoleMessage(`[WINDOW_PLACER] 🧮 CELL_SIZE: ${colWidth}x${rowHeight} (margin:${m})`);
    this.logConsoleMessage(`[WINDOW_PLACER] 🧮 RAW_CALC: x=${x}, y=${y}`);
    this.logConsoleMessage(`[WINDOW_PLACER] 🧮 FINAL_POS: (${finalX}, ${finalY}) on Monitor ID:${monitor.id}`);
    this.logConsoleMessage(`[WINDOW_PLACER] 🧮 WINDOW_SIZE: ${dimensions.width}x${dimensions.height}`);

    return { x: finalX, y: finalY, monitor };
  }

  /**
   * Find first available slot
   */
  private findAvailableSlot(avoidOverlap?: boolean): PlacementSlot | null {
    // Half-Moon Descending Pattern: Center-balanced expansion that slides down like a descending half-moon
    const preferredOrder: PlacementSlot[] = [
      // Phase 1: Start the half-moon - center point
      PlacementSlot.R0_C2, // 1st: Top center (balance: 0L,1C,0R)

      // Phase 2: Expand horizontally from center - 3 columns wide
      PlacementSlot.R0_C1, // 2nd: Top left-center (1L,1C,0R - unbalanced)
      PlacementSlot.R0_C3, // 3rd: Top right-center (1L,1C,1R - balanced)

      // Phase 3: Descend one row, start with center - half-moon slides down
      PlacementSlot.R1_C2, // 4th: Middle center (1L,2C,1R - balanced)

      // Phase 4: Match the row above - fill row 1 to match row 0's 3 columns
      PlacementSlot.R1_C1, // 5th: Middle left-center (2L,2C,1R - unbalanced)
      PlacementSlot.R1_C3, // 6th: Middle right-center (2L,2C,2R - balanced)

      // Phase 5: Go wider - expand both rows to 5 columns (half-moon grows wider)
      PlacementSlot.R0_C0, // 7th: Top far left (3L,2C,2R - unbalanced)
      PlacementSlot.R0_C4, // 8th: Top far right (3L,2C,3R - balanced)

      // Phase 6: Match the wider pattern in row below
      PlacementSlot.R1_C0, // 9th: Middle far left (4L,2C,3R - unbalanced)
      PlacementSlot.R1_C4, // 10th: Middle far right (4L,2C,4R - balanced)

      // Phase 7: Descend to bottom row (avoiding R2_C2=MainWindow, R2_C4=DebugLogger)
      PlacementSlot.R2_C1, // 11th: Bottom left-center (left of MainWindow)
      PlacementSlot.R2_C3, // 12th: Bottom right-center (right of MainWindow)
      PlacementSlot.R2_C0 // 13th: Bottom far left (maintain left-right balance)
    ];

    for (const slot of preferredOrder) {
      if (!this.occupiedSlots.has(slot)) {
        return slot;
      }
    }

    return null;
  }

  /**
   * Get cascade position when all slots are full
   */
  private getCascadePosition(windowId: string, dimensions: WindowDimensions, margin?: number): WindowPosition {
    const monitor = this.selectOptimalMonitor(); // Use smart monitor selection
    const workArea = monitor.workArea;
    const m = margin ?? this.defaultMargin;

    // Calculate cascade position
    const baseX = workArea.x + m;
    const baseY = workArea.y + m;
    const offsetX = this.cascadeOffset.x * this.cascadeCounter;
    const offsetY = this.cascadeOffset.y * this.cascadeCounter;

    let x = Math.round(baseX + offsetX);
    let y = Math.round(baseY + offsetY);

    // Reset cascade if we go off screen
    if (x + dimensions.width > workArea.x + workArea.width || y + dimensions.height > workArea.y + workArea.height) {
      this.cascadeCounter = 0;
      x = Math.round(baseX);
      y = Math.round(baseY);
    } else {
      this.cascadeCounter++;
    }

    // Track this window with monitor info
    this.trackedWindows.set(windowId, {
      id: windowId,
      bounds: { x, y, width: dimensions.width, height: dimensions.height },
      monitorId: monitor.id
    });

    return { x, y, monitor };
  }

  /**
   * Get center position as fallback
   */
  private getCenterPosition(dimensions: WindowDimensions): WindowPosition {
    const monitor = this.selectOptimalMonitor(); // Use smart monitor selection
    const workArea = monitor.workArea;

    const x = Math.round(workArea.x + (workArea.width - dimensions.width) / 2);
    const y = Math.round(workArea.y + (workArea.height - dimensions.height) / 2);

    return { x, y, monitor };
  }

  /**
   * Get position for debugger windows using special algorithm
   * - 1 window: Left side with margins
   * - 2 windows: Left and right with margins
   * - 3+ windows: Cascade from top-left
   */
  private getDebuggerPosition(windowId: string, config: PlacementConfig): WindowPosition {
    const monitor = this.selectOptimalMonitor(); // Use smart monitor selection
    const workArea = monitor.workArea;
    const margin = config.margin ?? 40; // Larger margin for debugger windows

    // Track this as a debugger window
    this.debuggerWindowCount++;

    let x: number;
    let y: number;

    if (this.debuggerWindowCount === 1) {
      // First debugger: Left side with margin
      x = Math.round(workArea.x + margin);
      y = Math.round(workArea.y + margin);
    } else if (this.debuggerWindowCount === 2) {
      // Second debugger: Right side with margin
      // Calculate position to fit window with right margin
      x = Math.round(workArea.x + workArea.width - config.dimensions.width - margin);
      y = Math.round(workArea.y + margin);
    } else {
      // 3+ debuggers: Cascade from top-left
      const cascadeIndex = this.debuggerWindowCount - 1; // 0-based for cascade
      x = Math.round(workArea.x + margin + this.debuggerCascadeOffset.x * cascadeIndex);
      y = Math.round(workArea.y + margin + this.debuggerCascadeOffset.y * cascadeIndex);

      // Reset cascade if we go off screen
      if (
        x + config.dimensions.width > workArea.x + workArea.width - margin ||
        y + config.dimensions.height > workArea.y + workArea.height - margin
      ) {
        // Reset to top-left
        x = Math.round(workArea.x + margin);
        y = Math.round(workArea.y + margin);
        this.debuggerWindowCount = 1; // Reset counter
      }
    }

    // Track this window
    this.trackedWindows.set(windowId, {
      id: windowId,
      bounds: { x, y, width: config.dimensions.width, height: config.dimensions.height },
      monitorId: monitor.id
    });

    return { x, y, monitor };
  }

  /**
   * Get position for COG windows using adaptive 4x2 grid layout
   *
   * COG windows are text terminals (80×24, 64×24, or 48×24 character grid)
   * arranged in a 4×2 vertical grid optimized for laptop screens:
   *
   *   COG 0  COG 4
   *   COG 1  COG 5
   *   COG 2  COG 6
   *   COG 3  COG 7
   *
   * Terminal sizing adapts to available screen width:
   * - Large screens (≥1640px available): 80×24 terminal (820×442 window)
   * - Medium screens (≥1320px available): 64×24 terminal (660×442 window)
   * - Small screens (<1320px available): 48×24 terminal (540×442 window)
   *
   * @param windowId - Window identifier (should include COG number)
   * @param config - Placement configuration
   * @returns Window position for the COG window
   */
  private getCOGGridPosition(windowId: string, config: PlacementConfig): WindowPosition {
    // Extract COG ID from windowId (expected format: "COG-0", "COG-1", etc.)
    const cogMatch = windowId.match(/COG[- ]?(\d)/i);
    const cogId = cogMatch ? parseInt(cogMatch[1], 10) : 0;

    // Validate COG ID
    if (cogId < 0 || cogId > 7) {
      console.warn(`Invalid COG ID ${cogId} in windowId ${windowId}, defaulting to 0`);
    }

    const monitor = this.selectOptimalMonitor(); // Use smart monitor selection
    const workArea = monitor.workArea;
    const margin = config.margin ?? 20;

    // Adaptive grid layout based on screen dimensions
    // Large monitors (wide): 2 rows × 4 columns (horizontal orientation)
    // Laptop screens (narrow): 4 rows × 2 columns (vertical orientation)
    let GRID_ROWS: number;
    let GRID_COLS: number;

    if (workArea.width >= 1920) {
      // Large/desktop monitors: horizontal layout (2 rows × 4 columns)
      GRID_ROWS = 2;
      GRID_COLS = 4;
      this.logConsoleMessage(
        `[WINDOW PLACER] 📺 Using 2×4 grid for large monitor (${workArea.width}×${workArea.height})`
      );
    } else {
      // Laptop screens: vertical layout (4 rows × 2 columns)
      GRID_ROWS = 4;
      GRID_COLS = 2;
      this.logConsoleMessage(
        `[WINDOW PLACER] 📺 Using 4×2 grid for laptop screen (${workArea.width}×${workArea.height})`
      );
    }

    // Terminal character dimensions (monospace font rendering)
    const CHAR_WIDTH = 10; // pixels per character
    const LINE_HEIGHT = 18; // pixels per line
    const PADDING_X = 20; // horizontal padding inside window
    const PADDING_Y = 10; // vertical padding inside window

    // Gaps between windows (COG windows need visible spacing)
    const gapX = 20;  // Horizontal gap between COG windows
    const gapY = 20;  // Vertical gap between COG windows

    // Calculate available space for grid (leave room for main window at bottom)
    const availableWidth = workArea.width - margin * 2;
    const availableHeight = workArea.height - margin * 3 - 100;

    // Use actual window dimensions from config (windows are created with fixed size)
    // These are the ACTUAL dimensions that Electron will use
    const windowWidth = config.dimensions.width;
    const windowHeight = config.dimensions.height;

    // Log which terminal size would theoretically fit (for information only)
    const availableWidthPerWindow = (availableWidth - gapX * (GRID_COLS - 1)) / GRID_COLS;
    let terminalCols: number;
    const terminalRows: number = 24;

    if (availableWidthPerWindow >= 820) {
      terminalCols = 80;
      this.logConsoleMessage(`[WINDOW PLACER] 📺 COG ${cogId}: Screen can fit 80×24 terminal (using ${windowWidth}×${windowHeight} window)`);
    } else if (availableWidthPerWindow >= 660) {
      terminalCols = 64;
      this.logConsoleMessage(`[WINDOW PLACER] 📺 COG ${cogId}: Screen can fit 64×24 terminal (using ${windowWidth}×${windowHeight} window)`);
    } else if (availableWidthPerWindow >= 540) {
      terminalCols = 48;
      this.logConsoleMessage(`[WINDOW PLACER] 📺 COG ${cogId}: Screen can fit 48×24 terminal (using ${windowWidth}×${windowHeight} window)`);
    } else {
      terminalCols = 48;
      console.warn(
        `[WINDOW PLACER] ⚠️  COG ${cogId}: Screen width ${availableWidthPerWindow}px is below recommended minimum (540px)`
      );
    }

    // Calculate grid position
    // For 2×4 grid: row = floor(id / 4), col = id % 4
    // For 4×2 grid: row = id % 4, col = floor(id / 4)
    const row = GRID_ROWS === 2 ? Math.floor(cogId / GRID_COLS) : cogId % GRID_ROWS;
    const col = GRID_ROWS === 2 ? cogId % GRID_COLS : Math.floor(cogId / GRID_ROWS);

    // Calculate column width (evenly distribute available space across screen)
    const totalWindowsWidth = windowWidth * GRID_COLS;
    const totalGapsWidth = gapX * (GRID_COLS - 1);
    const remainingSpace = availableWidth - totalWindowsWidth - totalGapsWidth;
    const extraMarginPerSide = remainingSpace / 2; // Center the grid horizontally

    // Calculate actual position with centered, even distribution
    const x = Math.round(workArea.x + margin + extraMarginPerSide + col * (windowWidth + gapX));
    const y = Math.round(workArea.y + margin + row * (windowHeight + gapY));

    this.logConsoleMessage(
      `[WINDOW PLACER] 📍 COG ${cogId}: Positioned at grid(${row},${col}) = (${x},${y}) with ${terminalCols}×${terminalRows} terminal`
    );

    // Track this window
    this.trackedWindows.set(windowId, {
      id: windowId,
      bounds: { x, y, width: windowWidth, height: windowHeight },
      monitorId: monitor.id
    });

    return { x, y, monitor };
  }

  /**
   * Mark a slot as occupied
   */
  private markSlotOccupied(
    windowId: string,
    slot: PlacementSlot,
    position: WindowPosition,
    dimensions: WindowDimensions
  ): void {
    // Always mark the primary slot
    this.occupiedSlots.add(slot);

    // Calculate grid dimensions to check for collisions (same logic as calculateSlotPosition)
    const monitor = position.monitor;
    const workArea = monitor.workArea;

    // Calculate grid size using shared logic
    const { COLS, ROWS } = this.calculateGridDimensions(workArea);

    const m = 20; // margin
    const colWidth = Math.round((workArea.width - m * 2) / COLS);
    const rowHeight = Math.round((workArea.height - m * 2) / ROWS);
    const safetyMargin = 20;

    // Parse current slot to get row and column
    const [row, col] = this.parseSlotToRowCol(slot);

    // Check for width overflow (marks cells left and right)
    const widthOverflow = dimensions.width > colWidth - safetyMargin;
    if (widthOverflow) {
      this.logConsoleMessage(
        `[WINDOW PLACER] 🔍 COLLISION: Window ${windowId} (${dimensions.width}px) overflows column width (${colWidth}px)`
      );

      // Calculate how many additional columns are needed
      const additionalWidth = dimensions.width - colWidth;
      const additionalCols = Math.ceil(additionalWidth / colWidth);

      // Mark cells to the left and right (centered overflow)
      const leftCols = Math.floor(additionalCols / 2);
      const rightCols = Math.ceil(additionalCols / 2);

      for (let leftOffset = 1; leftOffset <= leftCols; leftOffset++) {
        const leftCol = col - leftOffset;
        if (leftCol >= 0) {
          const leftSlot = this.rowColToSlot(row, leftCol);
          if (leftSlot) {
            this.occupiedSlots.add(leftSlot);
            this.logConsoleMessage(`[WINDOW PLACER] 🔍 COLLISION: Marking left slot ${leftSlot} as occupied`);
          }
        }
      }

      for (let rightOffset = 1; rightOffset <= rightCols; rightOffset++) {
        const rightCol = col + rightOffset;
        if (rightCol < COLS) {
          const rightSlot = this.rowColToSlot(row, rightCol);
          if (rightSlot) {
            this.occupiedSlots.add(rightSlot);
            this.logConsoleMessage(`[WINDOW PLACER] 🔍 COLLISION: Marking right slot ${rightSlot} as occupied`);
          }
        }
      }
    }

    // Check for height overflow (marks cells below only)
    const heightOverflow = dimensions.height > rowHeight - safetyMargin;
    if (heightOverflow) {
      this.logConsoleMessage(
        `[WINDOW PLACER] 🔍 COLLISION: Window ${windowId} (${dimensions.height}px) overflows row height (${rowHeight}px)`
      );

      // Calculate how many additional rows are needed
      const additionalHeight = dimensions.height - rowHeight;
      const additionalRows = Math.ceil(additionalHeight / rowHeight);

      // Mark cells below (title bars stay aligned, tall windows affect rows below)
      for (let rowOffset = 1; rowOffset <= additionalRows; rowOffset++) {
        const belowRow = row + rowOffset;
        if (belowRow < ROWS) {
          const belowSlot = this.rowColToSlot(belowRow, col);
          if (belowSlot) {
            this.occupiedSlots.add(belowSlot);
            this.logConsoleMessage(`[WINDOW PLACER] 🔍 COLLISION: Marking below slot ${belowSlot} as occupied`);
          }
        }
      }
    }

    this.trackedWindows.set(windowId, {
      id: windowId,
      slot,
      bounds: {
        x: position.x,
        y: position.y,
        width: dimensions.width,
        height: dimensions.height
      },
      monitorId: position.monitor.id
    });
  }

  /**
   * Calculate grid dimensions for a given work area
   * @param workArea - Monitor work area dimensions
   * @returns Grid dimensions {COLS, ROWS}
   */
  private calculateGridDimensions(workArea: { width: number; height: number }): { COLS: number; ROWS: number } {
    const displayWidth = workArea.width;
    const displayHeight = workArea.height;
    const aspectRatio = displayWidth / displayHeight;

    // Width determines columns
    let COLS: number;
    if (displayWidth >= 3000) {
      // Very wide displays (4K+ width) - 5+ columns
      COLS = 5;
    } else if (displayWidth >= 2000) {
      // Wide displays (1440p+ width) - 5 columns
      COLS = 5;
    } else if (displayWidth >= 1500) {
      // Medium displays (1080p+ width) - 3 columns
      COLS = 3;
    } else {
      // Narrow displays - 3 columns
      COLS = 3;
    }

    // Height determines rows
    let ROWS: number;
    if (displayHeight >= 2000) {
      // Very tall displays (4K+ height) - 4 rows
      ROWS = 4;
    } else if (displayHeight >= 1200) {
      // Tall displays (1440p+ height) - 3 rows
      ROWS = 3;
    } else if (displayHeight >= 800) {
      // Medium displays (1080p+ height) - 3 rows
      ROWS = 3;
    } else {
      // Short displays - 2 rows
      ROWS = 2;
    }

    // Adjust for aspect ratio
    if (aspectRatio > 2.0) {
      // Ultra-wide displays - add columns
      COLS = Math.min(COLS + 2, 7);
    } else if (aspectRatio < 1.3) {
      // Tall displays - add rows
      ROWS = Math.min(ROWS + 1, 5);
    }

    // Ensure odd number of columns for center alignment
    if (COLS % 2 === 0) {
      COLS += 1;
    }

    return { COLS, ROWS };
  }

  /**
   * Parse a PlacementSlot enum to row and column coordinates
   * @param slot - The placement slot to parse
   * @returns [row, col] coordinates (0-indexed)
   */
  private parseSlotToRowCol(slot: PlacementSlot): [number, number] {
    const slotStr = slot.toString();
    if (slotStr.startsWith('row') && slotStr.includes('-col')) {
      const parts = slotStr.split('-');
      const row = parseInt(parts[0].replace('row', ''));
      const col = parseInt(parts[1].replace('col', ''));
      return [row, col];
    }

    // Handle legacy aliases
    const legacyMap: Record<string, [number, number]> = {
      [PlacementSlot.TOP_LEFT]: [0, 0],
      [PlacementSlot.TOP_CENTER]: [0, 2],
      [PlacementSlot.TOP_RIGHT]: [0, 4],
      [PlacementSlot.MIDDLE_LEFT]: [1, 0],
      [PlacementSlot.MIDDLE_CENTER]: [1, 2],
      [PlacementSlot.MIDDLE_RIGHT]: [1, 4],
      [PlacementSlot.BOTTOM_LEFT]: [2, 0]
    };

    return legacyMap[slot] || [0, 0];
  }

  /**
   * Convert row and column coordinates to a PlacementSlot enum
   * @param row - Row coordinate (0-indexed)
   * @param col - Column coordinate (0-indexed)
   * @returns PlacementSlot enum or null if invalid coordinates
   */
  private rowColToSlot(row: number, col: number): PlacementSlot | null {
    const slotKey = `row${row}-col${col}`;

    // Check if this slot exists in our PlacementSlot enum
    const enumValues = Object.values(PlacementSlot);
    const matchingSlot = enumValues.find((value) => value === slotKey);

    if (matchingSlot) {
      return matchingSlot as PlacementSlot;
    }

    // Handle coordinates that might be out of normal enum range
    if (row >= 0 && row <= 2 && col >= 0 && col <= 4) {
      return slotKey as PlacementSlot;
    }

    return null;
  }

  /**
   * Detect which slot a position corresponds to
   */
  private detectSlotFromPosition(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): PlacementSlot | undefined {
    // This is a heuristic - improve as needed
    const monitor = this.screenManager.getMonitorAtPoint(bounds.x, bounds.y);
    const workArea = monitor.workArea;

    const relX = bounds.x - workArea.x;
    const relY = bounds.y - workArea.y;
    const xRatio = relX / workArea.width;
    const yRatio = relY / workArea.height;

    // Determine horizontal position
    let horizontal: 'left' | 'center' | 'right';
    if (xRatio < 0.33) horizontal = 'left';
    else if (xRatio < 0.67) horizontal = 'center';
    else horizontal = 'right';

    // Determine vertical position
    let vertical: 'top' | 'middle' | 'bottom';
    if (yRatio < 0.33) vertical = 'top';
    else if (yRatio < 0.67) vertical = 'middle';
    else vertical = 'bottom';

    // Map to slot
    const slotMap: Record<string, PlacementSlot> = {
      'top-left': PlacementSlot.TOP_LEFT,
      'top-center': PlacementSlot.TOP_CENTER,
      'top-right': PlacementSlot.TOP_RIGHT,
      'middle-left': PlacementSlot.MIDDLE_LEFT,
      'middle-center': PlacementSlot.MIDDLE_CENTER,
      'middle-right': PlacementSlot.MIDDLE_RIGHT,
      'bottom-left': PlacementSlot.BOTTOM_LEFT
    };

    return slotMap[`${vertical}-${horizontal}`];
  }

  /**
   * Check if two rectangles overlap
   */
  private rectanglesOverlap(
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(r1.x + r1.width < r2.x || r2.x + r2.width < r1.x || r1.y + r1.height < r2.y || r2.y + r2.height < r1.y);
  }

  /**
   * Clean up all tracked windows
   */
  private cleanup(): void {
    this.trackedWindows.clear();
    this.occupiedSlots.clear();
    this.cascadeCounter = 0;
  }
}

export default WindowPlacer;
