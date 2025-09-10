/** @format */

// src/utils/windowPlacer.ts

import { BrowserWindow } from 'electron';
import { ScreenManager, WindowPosition, MonitorInfo } from './screenManager';

/**
 * Predefined placement slots for 5x3 grid system
 * Grid layout provides organized window placement
 */
export enum PlacementSlot {
  // Row 0 (Top)
  R0_C0 = 'row0-col0',  // Top far left
  R0_C1 = 'row0-col1',  // Top left-center
  R0_C2 = 'row0-col2',  // Top center
  R0_C3 = 'row0-col3',  // Top right-center
  R0_C4 = 'row0-col4',  // Top far right
  
  // Row 1 (Middle)
  R1_C0 = 'row1-col0',  // Middle far left
  R1_C1 = 'row1-col1',  // Middle left-center
  R1_C2 = 'row1-col2',  // Middle center
  R1_C3 = 'row1-col3',  // Middle right-center
  R1_C4 = 'row1-col4',  // Middle far right
  
  // Row 2 (Bottom)
  R2_C0 = 'row2-col0',  // Bottom far left
  R2_C1 = 'row2-col1',  // Bottom left-center
  R2_C2 = 'row2-col2',  // Bottom center (MainWindow)
  R2_C3 = 'row2-col3',  // Bottom right-center
  R2_C4 = 'row2-col4',  // Bottom far right (DebugLogger)
  
  // Legacy aliases for compatibility
  TOP_LEFT = R0_C0,
  TOP_CENTER = R0_C2,
  TOP_RIGHT = R0_C4,
  MIDDLE_LEFT = R1_C0,
  MIDDLE_CENTER = R1_C2,
  MIDDLE_RIGHT = R1_C4,
  BOTTOM_LEFT = R2_C0,
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
  DEFAULT = 'default',      // Standard slot-based placement
  DEBUGGER = 'debugger',    // Special placement for debugger windows
  COG_GRID = 'cog_grid'     // 2x4 grid placement for COG windows
}

/**
 * Placement configuration for a window
 */
export interface PlacementConfig {
  slot?: PlacementSlot;
  preferredSlot?: PlacementSlot;  // Hint for system windows (MainWindow, DebugLogger)
  dimensions: WindowDimensions;
  margin?: number;
  avoidOverlap?: boolean;
  cascadeIfFull?: boolean;
  strategy?: PlacementStrategy;  // Special placement strategy
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
 * Implements heads-up console pattern with predefined slots that avoid
 * overlapping MainWindow and DebugLoggerWindow. Tracks window positions
 * and provides smart placement with cascade fallback.
 * 
 * This is a SHARED component used by all debug windows for consistent
 * placement behavior across the application.
 * 
 * Key features:
 * - Slot-based placement system
 * - Collision avoidance
 * - Multi-monitor support
 * - Cascade fallback when slots are full
 * - Window tracking and cleanup
 */
export class WindowPlacer {
  private static instance: WindowPlacer | null = null;
  private screenManager: ScreenManager;
  private trackedWindows: Map<string, TrackedWindow> = new Map();
  private occupiedSlots: Set<PlacementSlot> = new Set();
  private cascadeOffset = { x: 30, y: 30 };
  private cascadeCounter = 0;
  private defaultMargin = 20;
  private debuggerWindowCount = 0;  // Track number of debugger windows
  private debuggerCascadeOffset = { x: 20, y: 20 };  // Smaller cascade for large windows

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
    console.log(`[WINDOW PLACER] 🎯 getNextPosition requested for: ${windowId}`);
    console.log(`[WINDOW PLACER] 📊 Current occupied slots:`, Array.from(this.occupiedSlots));
    console.log(`[WINDOW PLACER] 🪟 Current tracked windows:`, Array.from(this.trackedWindows.keys()));
    
    // If window already tracked, return its current position
    const tracked = this.trackedWindows.get(windowId);
    if (tracked) {
      console.log(`[WINDOW PLACER] ♻️  Window ${windowId} already tracked, returning existing position`);
      return {
        x: tracked.bounds.x,
        y: tracked.bounds.y,
        monitor: this.screenManager.getMonitorAtPoint(
          tracked.bounds.x, 
          tracked.bounds.y
        )
      };
    }

    // Handle special placement strategies
    if (config.strategy === PlacementStrategy.DEBUGGER) {
      return this.getDebuggerPosition(windowId, config);
    }
    
    if (config.strategy === PlacementStrategy.COG_GRID) {
      return this.getCOGGridPosition(windowId, config);
    }

    // If specific slot requested and available, use it
    if (config.slot && !this.occupiedSlots.has(config.slot)) {
      const position = this.calculateSlotPosition(config.slot, config.dimensions, config.margin);
      this.markSlotOccupied(windowId, config.slot, position, config.dimensions);
      return position;
    }

    // Check for preferred slot hint (for system windows)
    if (config.preferredSlot && !this.occupiedSlots.has(config.preferredSlot)) {
      const position = this.calculateSlotPosition(config.preferredSlot, config.dimensions, config.margin);
      this.markSlotOccupied(windowId, config.preferredSlot, position, config.dimensions);
      return position;
    }

    // Find first available slot
    const availableSlot = this.findAvailableSlot(config.avoidOverlap);
    if (availableSlot) {
      console.log(`[WINDOW PLACER] ✅ Found available slot: ${availableSlot} for window: ${windowId}`);
      const position = this.calculateSlotPosition(availableSlot, config.dimensions, config.margin);
      this.markSlotOccupied(windowId, availableSlot, position, config.dimensions);
      console.log(`[WINDOW PLACER] 🎯 Assigned position: ${position.x},${position.y} in slot: ${availableSlot}`);
      return position;
    }

    // All slots full, cascade if enabled
    if (config.cascadeIfFull !== false) {
      console.log(`[WINDOW PLACER] ⚠️  All slots full, using cascade for window: ${windowId}`);
      return this.getCascadePosition(windowId, config.dimensions, config.margin);
    }

    // Default to center of primary monitor
    return this.getCenterPosition(config.dimensions);
  }

  /**
   * Register an existing window position with monitor tracking
   * Used when window is manually positioned or loaded from saved state
   */
  public registerWindow(windowId: string, window: BrowserWindow): void {
    const bounds = window.getBounds();
    const monitor = this.screenManager.getMonitorAtPoint(bounds.x, bounds.y);
    const slot = this.detectSlotFromPosition(bounds);
    
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
        console.log(`Window ${windowId} moved from monitor ${oldMonitorId} to ${newMonitor.id}`);
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
      console.log(`[WINDOW PLACER] 🗑️  Unregistering window: ${windowId} from slot: ${tracked.slot}`);
      if (tracked.slot) {
        this.occupiedSlots.delete(tracked.slot);
        console.log(`[WINDOW PLACER] ♻️  Freed slot: ${tracked.slot}, remaining slots:`, Array.from(this.occupiedSlots));
      }
      this.trackedWindows.delete(windowId);
    } else {
      console.log(`[WINDOW PLACER] ⚠️  Attempted to unregister unknown window: ${windowId}`);
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
   * Calculate position for a specific slot
   */
  private calculateSlotPosition(
    slot: PlacementSlot, 
    dimensions: WindowDimensions,
    margin?: number
  ): WindowPosition {
    const m = margin ?? this.defaultMargin;
    const monitor = this.screenManager.getPrimaryMonitor();
    const workArea = monitor.workArea;

    // Determine grid size based on display characteristics
    const displayWidth = monitor.bounds.width;
    const displayHeight = monitor.bounds.height;
    const aspectRatio = displayWidth / displayHeight;
    const totalPixels = displayWidth * displayHeight;
    
    // Base grid calculation on display area and aspect ratio
    let COLS: number;
    let ROWS: number;
    
    // Calculate base grid size from pixel area
    if (totalPixels >= 8000000) {
      // Very large displays (4K+) - 5x4 base
      COLS = 5;
      ROWS = 4;
    } else if (totalPixels >= 4000000) {
      // Large displays (1440p+) - 5x3 base  
      COLS = 5;
      ROWS = 3;
    } else if (totalPixels >= 2000000) {
      // Medium displays (1080p+) - 3x3 base
      COLS = 3;
      ROWS = 3;
    } else {
      // Small displays - 3x2 base
      COLS = 3;
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
    
    // Calculate column width and row height
    const colWidth = (workArea.width - (m * 2)) / COLS;
    const rowHeight = (workArea.height - (m * 2)) / ROWS;

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
        x = joinedStartX + joinedWidth - dimensions.width; // Right-align
      } else if (col >= 3) {
        // Right side (cols 3-4): Join columns and left-align  
        const joinedStartX = workArea.x + m + (3 * colWidth);
        x = joinedStartX; // Left-align
      } else {
        // Center column: Center the window
        const cellCenterX = workArea.x + m + (col * colWidth) + (colWidth / 2);
        x = Math.round(cellCenterX - (dimensions.width / 2));
      }
    } else {
      // Normal centering for windows that fit in a column
      const cellCenterX = workArea.x + m + (col * colWidth) + (colWidth / 2);
      x = Math.round(cellCenterX - (dimensions.width / 2));
    }
    
    // Always align to top of row (for consistent menu bar alignment)
    y = workArea.y + m + (row * rowHeight);

    // Ensure window stays within work area
    const finalX = Math.max(workArea.x + m, Math.min(x, workArea.x + workArea.width - dimensions.width - m));
    const finalY = Math.max(workArea.y + m, Math.min(y, workArea.y + workArea.height - dimensions.height - m));

    return { x: finalX, y: finalY, monitor };
  }

  /**
   * Find first available slot
   */
  private findAvailableSlot(avoidOverlap?: boolean): PlacementSlot | null {
    // Compact Dashboard Pattern: Radial expansion from center for most compact look
    const preferredOrder: PlacementSlot[] = [
      // Ring 1: Center start
      PlacementSlot.R0_C2,         // 1st: Top center (start point)
      
      // Ring 2: Immediate neighbors (compact horizontal growth)
      PlacementSlot.R0_C1,         // 2nd: Top left-center  
      PlacementSlot.R0_C3,         // 3rd: Top right-center
      
      // Ring 3: Drop down one row, stay compact (vertical growth)
      PlacementSlot.R1_C1,         // 4th: Middle left-center
      PlacementSlot.R1_C3,         // 5th: Middle right-center
      
      // Ring 4: Fill remaining top row (extreme ends)
      PlacementSlot.R0_C0,         // 6th: Top far left
      PlacementSlot.R0_C4,         // 7th: Top far right
      
      // Ring 5: Fill remaining middle row (extreme ends) 
      PlacementSlot.R1_C0,         // 8th: Middle far left
      PlacementSlot.R1_C4,         // 9th: Middle far right
      
      // Ring 6: Center column fill (avoid MainWindow area)
      PlacementSlot.R1_C2,         // 10th: Middle center
      
      // Last resort: Bottom row (only if dashboard completely full)
      PlacementSlot.R2_C0,         // Bottom far left
      PlacementSlot.R2_C1,         // Bottom left-center (R2_C2=MainWindow, R2_C4=DebugLogger reserved)
      PlacementSlot.R2_C3,         // Bottom right-center
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
  private getCascadePosition(
    windowId: string,
    dimensions: WindowDimensions,
    margin?: number
  ): WindowPosition {
    const monitor = this.screenManager.getPrimaryMonitor();
    const workArea = monitor.workArea;
    const m = margin ?? this.defaultMargin;

    // Calculate cascade position
    const baseX = workArea.x + m;
    const baseY = workArea.y + m;
    const offsetX = this.cascadeOffset.x * this.cascadeCounter;
    const offsetY = this.cascadeOffset.y * this.cascadeCounter;

    let x = baseX + offsetX;
    let y = baseY + offsetY;

    // Reset cascade if we go off screen
    if (x + dimensions.width > workArea.x + workArea.width ||
        y + dimensions.height > workArea.y + workArea.height) {
      this.cascadeCounter = 0;
      x = baseX;
      y = baseY;
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
    const monitor = this.screenManager.getPrimaryMonitor();
    const workArea = monitor.workArea;

    const x = workArea.x + (workArea.width - dimensions.width) / 2;
    const y = workArea.y + (workArea.height - dimensions.height) / 2;

    return { x, y, monitor };
  }

  /**
   * Get position for debugger windows using special algorithm
   * - 1 window: Left side with margins
   * - 2 windows: Left and right with margins
   * - 3+ windows: Cascade from top-left
   */
  private getDebuggerPosition(windowId: string, config: PlacementConfig): WindowPosition {
    const monitor = this.screenManager.getPrimaryMonitor();
    const workArea = monitor.workArea;
    const margin = config.margin ?? 40;  // Larger margin for debugger windows
    
    // Track this as a debugger window
    this.debuggerWindowCount++;
    
    let x: number;
    let y: number;
    
    if (this.debuggerWindowCount === 1) {
      // First debugger: Left side with margin
      x = workArea.x + margin;
      y = workArea.y + margin;
    } else if (this.debuggerWindowCount === 2) {
      // Second debugger: Right side with margin
      // Calculate position to fit window with right margin
      x = workArea.x + workArea.width - config.dimensions.width - margin;
      y = workArea.y + margin;
    } else {
      // 3+ debuggers: Cascade from top-left
      const cascadeIndex = this.debuggerWindowCount - 1;  // 0-based for cascade
      x = workArea.x + margin + (this.debuggerCascadeOffset.x * cascadeIndex);
      y = workArea.y + margin + (this.debuggerCascadeOffset.y * cascadeIndex);
      
      // Reset cascade if we go off screen
      if (x + config.dimensions.width > workArea.x + workArea.width - margin ||
          y + config.dimensions.height > workArea.y + workArea.height - margin) {
        // Reset to top-left
        x = workArea.x + margin;
        y = workArea.y + margin;
        this.debuggerWindowCount = 1;  // Reset counter
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
   * Get position for COG windows using 2x4 grid layout
   * COG windows are numbered 0-7 and arranged as:
   * 
   *   COG 0  COG 1  COG 2  COG 3
   *   COG 4  COG 5  COG 6  COG 7
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
    
    const monitor = this.screenManager.getPrimaryMonitor();
    const workArea = monitor.workArea;
    const margin = config.margin ?? 20;  // Smaller margins for COG grid
    
    // Calculate grid dimensions (2 rows, 4 columns)
    const GRID_COLS = 4;
    const GRID_ROWS = 2;
    
    // Calculate available space for grid
    const availableWidth = workArea.width - (margin * 2);
    const availableHeight = workArea.height - (margin * 3) - 100; // Leave space for main window
    
    // Calculate cell dimensions with gaps between windows
    const gapX = 10;  // Horizontal gap between COG windows
    const gapY = 10;  // Vertical gap between COG windows
    const cellWidth = (availableWidth - (gapX * (GRID_COLS - 1))) / GRID_COLS;
    const cellHeight = (availableHeight - (gapY * (GRID_ROWS - 1))) / GRID_ROWS;
    
    // Ensure windows aren't too small
    const minWidth = 400;
    const minHeight = 300;
    const windowWidth = Math.max(Math.min(cellWidth, config.dimensions.width), minWidth);
    const windowHeight = Math.max(Math.min(cellHeight, config.dimensions.height), minHeight);
    
    // Calculate grid position (row and column)
    const col = cogId % GRID_COLS;
    const row = Math.floor(cogId / GRID_COLS);
    
    // Calculate actual position
    const x = workArea.x + margin + (col * (windowWidth + gapX));
    const y = workArea.y + margin + (row * (windowHeight + gapY));
    
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
    this.occupiedSlots.add(slot);
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
   * Detect which slot a position corresponds to
   */
  private detectSlotFromPosition(bounds: { x: number; y: number; width: number; height: number }): PlacementSlot | undefined {
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
      'bottom-left': PlacementSlot.BOTTOM_LEFT,
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
    return !(r1.x + r1.width < r2.x || 
             r2.x + r2.width < r1.x || 
             r1.y + r1.height < r2.y || 
             r2.y + r2.height < r1.y);
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