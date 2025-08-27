"use strict";
/** @format */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowPlacer = exports.PlacementStrategy = exports.PlacementSlot = void 0;
var screenManager_1 = require("./screenManager");
/**
 * Predefined placement slots for 5x3 grid system
 * Grid layout provides organized window placement
 */
var PlacementSlot;
(function (PlacementSlot) {
    // Row 0 (Top)
    PlacementSlot["R0_C0"] = "row0-col0";
    PlacementSlot["R0_C1"] = "row0-col1";
    PlacementSlot["R0_C2"] = "row0-col2";
    PlacementSlot["R0_C3"] = "row0-col3";
    PlacementSlot["R0_C4"] = "row0-col4";
    // Row 1 (Middle)
    PlacementSlot["R1_C0"] = "row1-col0";
    PlacementSlot["R1_C1"] = "row1-col1";
    PlacementSlot["R1_C2"] = "row1-col2";
    PlacementSlot["R1_C3"] = "row1-col3";
    PlacementSlot["R1_C4"] = "row1-col4";
    // Row 2 (Bottom)
    PlacementSlot["R2_C0"] = "row2-col0";
    PlacementSlot["R2_C1"] = "row2-col1";
    PlacementSlot["R2_C2"] = "row2-col2";
    PlacementSlot["R2_C3"] = "row2-col3";
    PlacementSlot["R2_C4"] = "row2-col4";
    // Legacy aliases for compatibility
    PlacementSlot["TOP_LEFT"] = "row0-col0";
    PlacementSlot["TOP_CENTER"] = "row0-col2";
    PlacementSlot["TOP_RIGHT"] = "row0-col4";
    PlacementSlot["MIDDLE_LEFT"] = "row1-col0";
    PlacementSlot["MIDDLE_CENTER"] = "row1-col2";
    PlacementSlot["MIDDLE_RIGHT"] = "row1-col4";
    PlacementSlot["BOTTOM_LEFT"] = "row2-col0";
    // BOTTOM_CENTER = R2_C2 reserved for MainWindow
    // BOTTOM_RIGHT = R2_C4 reserved for DebugLoggerWindow
})(PlacementSlot || (exports.PlacementSlot = PlacementSlot = {}));
/**
 * Placement strategy for special window types
 */
var PlacementStrategy;
(function (PlacementStrategy) {
    PlacementStrategy["DEFAULT"] = "default";
    PlacementStrategy["DEBUGGER"] = "debugger";
    PlacementStrategy["COG_GRID"] = "cog_grid"; // 2x4 grid placement for COG windows
})(PlacementStrategy || (exports.PlacementStrategy = PlacementStrategy = {}));
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
var WindowPlacer = /** @class */ (function () {
    function WindowPlacer() {
        this.trackedWindows = new Map();
        this.occupiedSlots = new Set();
        this.cascadeOffset = { x: 30, y: 30 };
        this.cascadeCounter = 0;
        this.defaultMargin = 20;
        this.debuggerWindowCount = 0; // Track number of debugger windows
        this.debuggerCascadeOffset = { x: 20, y: 20 }; // Smaller cascade for large windows
        this.screenManager = screenManager_1.ScreenManager.getInstance();
    }
    /**
     * Get singleton instance
     */
    WindowPlacer.getInstance = function () {
        if (!WindowPlacer.instance) {
            WindowPlacer.instance = new WindowPlacer();
        }
        return WindowPlacer.instance;
    };
    /**
     * Reset singleton instance (for testing)
     */
    WindowPlacer.resetInstance = function () {
        if (WindowPlacer.instance) {
            WindowPlacer.instance.cleanup();
            WindowPlacer.instance = null;
        }
    };
    /**
     * Get next available position for a window
     *
     * @param windowId Unique identifier for the window
     * @param config Placement configuration
     * @returns Calculated position and monitor info
     */
    WindowPlacer.prototype.getNextPosition = function (windowId, config) {
        // If window already tracked, return its current position
        var tracked = this.trackedWindows.get(windowId);
        if (tracked) {
            return {
                x: tracked.bounds.x,
                y: tracked.bounds.y,
                monitor: this.screenManager.getMonitorAtPoint(tracked.bounds.x, tracked.bounds.y)
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
            var position = this.calculateSlotPosition(config.slot, config.dimensions, config.margin);
            this.markSlotOccupied(windowId, config.slot, position, config.dimensions);
            return position;
        }
        // Check for preferred slot hint (for system windows)
        if (config.preferredSlot && !this.occupiedSlots.has(config.preferredSlot)) {
            var position = this.calculateSlotPosition(config.preferredSlot, config.dimensions, config.margin);
            this.markSlotOccupied(windowId, config.preferredSlot, position, config.dimensions);
            return position;
        }
        // Find first available slot
        var availableSlot = this.findAvailableSlot(config.avoidOverlap);
        if (availableSlot) {
            var position = this.calculateSlotPosition(availableSlot, config.dimensions, config.margin);
            this.markSlotOccupied(windowId, availableSlot, position, config.dimensions);
            return position;
        }
        // All slots full, cascade if enabled
        if (config.cascadeIfFull !== false) {
            return this.getCascadePosition(windowId, config.dimensions, config.margin);
        }
        // Default to center of primary monitor
        return this.getCenterPosition(config.dimensions);
    };
    /**
     * Register an existing window position with monitor tracking
     * Used when window is manually positioned or loaded from saved state
     */
    WindowPlacer.prototype.registerWindow = function (windowId, window) {
        var _this = this;
        var bounds = window.getBounds();
        var monitor = this.screenManager.getMonitorAtPoint(bounds.x, bounds.y);
        var slot = this.detectSlotFromPosition(bounds);
        this.trackedWindows.set(windowId, {
            id: windowId,
            slot: slot,
            bounds: bounds,
            monitorId: monitor.id,
            windowRef: window
        });
        if (slot) {
            this.occupiedSlots.add(slot);
        }
        // Track position changes
        window.on('move', function () {
            _this.updateWindowPosition(windowId, window);
        });
        // Clean up when window closes
        window.on('closed', function () {
            _this.unregisterWindow(windowId);
        });
    };
    /**
     * Update window position when moved
     */
    WindowPlacer.prototype.updateWindowPosition = function (windowId, window) {
        var bounds = window.getBounds();
        var newMonitor = this.screenManager.getMonitorAtPoint(bounds.x, bounds.y);
        var tracked = this.trackedWindows.get(windowId);
        if (tracked) {
            var oldMonitorId = tracked.monitorId;
            tracked.bounds = bounds;
            tracked.monitorId = newMonitor.id;
            // Detect monitor change
            if (oldMonitorId !== newMonitor.id) {
                console.log("Window ".concat(windowId, " moved from monitor ").concat(oldMonitorId, " to ").concat(newMonitor.id));
                // Could emit an event here for other components to react
            }
            // Update slot detection
            var newSlot = this.detectSlotFromPosition(bounds);
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
    };
    /**
     * Unregister a window and free its slot
     */
    WindowPlacer.prototype.unregisterWindow = function (windowId) {
        var tracked = this.trackedWindows.get(windowId);
        if (tracked) {
            if (tracked.slot) {
                this.occupiedSlots.delete(tracked.slot);
            }
            this.trackedWindows.delete(windowId);
        }
    };
    /**
     * Check if a position would overlap with existing windows
     */
    WindowPlacer.prototype.wouldOverlap = function (bounds) {
        for (var _i = 0, _a = this.trackedWindows.values(); _i < _a.length; _i++) {
            var tracked = _a[_i];
            if (this.rectanglesOverlap(bounds, tracked.bounds)) {
                return true;
            }
        }
        return false;
    };
    /**
     * Get all tracked windows
     */
    WindowPlacer.prototype.getTrackedWindows = function () {
        return Array.from(this.trackedWindows.values());
    };
    /**
     * Calculate position for a specific slot
     */
    WindowPlacer.prototype.calculateSlotPosition = function (slot, dimensions, margin) {
        var m = margin !== null && margin !== void 0 ? margin : this.defaultMargin;
        var monitor = this.screenManager.getPrimaryMonitor();
        var workArea = monitor.workArea;
        // Determine grid size based on display characteristics
        var displayWidth = monitor.bounds.width;
        var displayHeight = monitor.bounds.height;
        var aspectRatio = displayWidth / displayHeight;
        var totalPixels = displayWidth * displayHeight;
        // Base grid calculation on display area and aspect ratio
        var COLS;
        var ROWS;
        // Calculate base grid size from pixel area
        if (totalPixels >= 8000000) {
            // Very large displays (4K+) - 5x4 base
            COLS = 5;
            ROWS = 4;
        }
        else if (totalPixels >= 4000000) {
            // Large displays (1440p+) - 5x3 base  
            COLS = 5;
            ROWS = 3;
        }
        else if (totalPixels >= 2000000) {
            // Medium displays (1080p+) - 3x3 base
            COLS = 3;
            ROWS = 3;
        }
        else {
            // Small displays - 3x2 base
            COLS = 3;
            ROWS = 2;
        }
        // Adjust for aspect ratio
        if (aspectRatio > 2.0) {
            // Ultra-wide displays - add columns
            COLS = Math.min(COLS + 2, 7);
        }
        else if (aspectRatio < 1.3) {
            // Tall displays - add rows
            ROWS = Math.min(ROWS + 1, 5);
        }
        // Ensure odd number of columns for center alignment
        if (COLS % 2 === 0) {
            COLS += 1;
        }
        // Calculate column width and row height
        var colWidth = (workArea.width - (m * 2)) / COLS;
        var rowHeight = (workArea.height - (m * 2)) / ROWS;
        // Parse slot to get row and column
        var row = 0;
        var col = 0;
        // Extract row and column from slot enum
        var slotStr = slot.toString();
        if (slotStr.includes('row0'))
            row = 0;
        else if (slotStr.includes('row1'))
            row = 1;
        else if (slotStr.includes('row2'))
            row = 2;
        if (slotStr.includes('col0'))
            col = 0;
        else if (slotStr.includes('col1'))
            col = 1;
        else if (slotStr.includes('col2'))
            col = 2;
        else if (slotStr.includes('col3'))
            col = 3;
        else if (slotStr.includes('col4'))
            col = 4;
        // Check if window is wider than a single column
        var isWideWindow = dimensions.width > colWidth;
        var x;
        var y;
        if (isWideWindow) {
            // Smart alignment for wide windows
            if (col <= 1) {
                // Left side (cols 0-1): Join columns and right-align
                var joinedWidth = colWidth * 2;
                var joinedStartX = workArea.x + m;
                x = joinedStartX + joinedWidth - dimensions.width; // Right-align
            }
            else if (col >= 3) {
                // Right side (cols 3-4): Join columns and left-align  
                var joinedStartX = workArea.x + m + (3 * colWidth);
                x = joinedStartX; // Left-align
            }
            else {
                // Center column: Center the window
                var cellCenterX = workArea.x + m + (col * colWidth) + (colWidth / 2);
                x = Math.round(cellCenterX - (dimensions.width / 2));
            }
        }
        else {
            // Normal centering for windows that fit in a column
            var cellCenterX = workArea.x + m + (col * colWidth) + (colWidth / 2);
            x = Math.round(cellCenterX - (dimensions.width / 2));
        }
        // Always align to top of row (for consistent menu bar alignment)
        y = workArea.y + m + (row * rowHeight);
        // Ensure window stays within work area
        var finalX = Math.max(workArea.x + m, Math.min(x, workArea.x + workArea.width - dimensions.width - m));
        var finalY = Math.max(workArea.y + m, Math.min(y, workArea.y + workArea.height - dimensions.height - m));
        return { x: finalX, y: finalY, monitor: monitor };
    };
    /**
     * Find first available slot
     */
    WindowPlacer.prototype.findAvailableSlot = function (avoidOverlap) {
        // Compact Dashboard Pattern: Radial expansion from center for most compact look
        var preferredOrder = [
            // Ring 1: Center start
            PlacementSlot.R0_C2, // 1st: Top center (start point)
            // Ring 2: Immediate neighbors (compact horizontal growth)
            PlacementSlot.R0_C1, // 2nd: Top left-center  
            PlacementSlot.R0_C3, // 3rd: Top right-center
            // Ring 3: Drop down one row, stay compact (vertical growth)
            PlacementSlot.R1_C1, // 4th: Middle left-center
            PlacementSlot.R1_C3, // 5th: Middle right-center
            // Ring 4: Fill remaining top row (extreme ends)
            PlacementSlot.R0_C0, // 6th: Top far left
            PlacementSlot.R0_C4, // 7th: Top far right
            // Ring 5: Fill remaining middle row (extreme ends) 
            PlacementSlot.R1_C0, // 8th: Middle far left
            PlacementSlot.R1_C4, // 9th: Middle far right
            // Ring 6: Center column fill (avoid MainWindow area)
            PlacementSlot.R1_C2, // 10th: Middle center
            // Last resort: Bottom row (only if dashboard completely full)
            PlacementSlot.R2_C0, // Bottom far left
            PlacementSlot.R2_C1, // Bottom left-center (R2_C2=MainWindow, R2_C4=DebugLogger reserved)
            PlacementSlot.R2_C3, // Bottom right-center
        ];
        for (var _i = 0, preferredOrder_1 = preferredOrder; _i < preferredOrder_1.length; _i++) {
            var slot = preferredOrder_1[_i];
            if (!this.occupiedSlots.has(slot)) {
                return slot;
            }
        }
        return null;
    };
    /**
     * Get cascade position when all slots are full
     */
    WindowPlacer.prototype.getCascadePosition = function (windowId, dimensions, margin) {
        var monitor = this.screenManager.getPrimaryMonitor();
        var workArea = monitor.workArea;
        var m = margin !== null && margin !== void 0 ? margin : this.defaultMargin;
        // Calculate cascade position
        var baseX = workArea.x + m;
        var baseY = workArea.y + m;
        var offsetX = this.cascadeOffset.x * this.cascadeCounter;
        var offsetY = this.cascadeOffset.y * this.cascadeCounter;
        var x = baseX + offsetX;
        var y = baseY + offsetY;
        // Reset cascade if we go off screen
        if (x + dimensions.width > workArea.x + workArea.width ||
            y + dimensions.height > workArea.y + workArea.height) {
            this.cascadeCounter = 0;
            x = baseX;
            y = baseY;
        }
        else {
            this.cascadeCounter++;
        }
        // Track this window with monitor info
        this.trackedWindows.set(windowId, {
            id: windowId,
            bounds: { x: x, y: y, width: dimensions.width, height: dimensions.height },
            monitorId: monitor.id
        });
        return { x: x, y: y, monitor: monitor };
    };
    /**
     * Get center position as fallback
     */
    WindowPlacer.prototype.getCenterPosition = function (dimensions) {
        var monitor = this.screenManager.getPrimaryMonitor();
        var workArea = monitor.workArea;
        var x = workArea.x + (workArea.width - dimensions.width) / 2;
        var y = workArea.y + (workArea.height - dimensions.height) / 2;
        return { x: x, y: y, monitor: monitor };
    };
    /**
     * Get position for debugger windows using special algorithm
     * - 1 window: Left side with margins
     * - 2 windows: Left and right with margins
     * - 3+ windows: Cascade from top-left
     */
    WindowPlacer.prototype.getDebuggerPosition = function (windowId, config) {
        var _a;
        var monitor = this.screenManager.getPrimaryMonitor();
        var workArea = monitor.workArea;
        var margin = (_a = config.margin) !== null && _a !== void 0 ? _a : 40; // Larger margin for debugger windows
        // Track this as a debugger window
        this.debuggerWindowCount++;
        var x;
        var y;
        if (this.debuggerWindowCount === 1) {
            // First debugger: Left side with margin
            x = workArea.x + margin;
            y = workArea.y + margin;
        }
        else if (this.debuggerWindowCount === 2) {
            // Second debugger: Right side with margin
            // Calculate position to fit window with right margin
            x = workArea.x + workArea.width - config.dimensions.width - margin;
            y = workArea.y + margin;
        }
        else {
            // 3+ debuggers: Cascade from top-left
            var cascadeIndex = this.debuggerWindowCount - 1; // 0-based for cascade
            x = workArea.x + margin + (this.debuggerCascadeOffset.x * cascadeIndex);
            y = workArea.y + margin + (this.debuggerCascadeOffset.y * cascadeIndex);
            // Reset cascade if we go off screen
            if (x + config.dimensions.width > workArea.x + workArea.width - margin ||
                y + config.dimensions.height > workArea.y + workArea.height - margin) {
                // Reset to top-left
                x = workArea.x + margin;
                y = workArea.y + margin;
                this.debuggerWindowCount = 1; // Reset counter
            }
        }
        // Track this window
        this.trackedWindows.set(windowId, {
            id: windowId,
            bounds: { x: x, y: y, width: config.dimensions.width, height: config.dimensions.height },
            monitorId: monitor.id
        });
        return { x: x, y: y, monitor: monitor };
    };
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
    WindowPlacer.prototype.getCOGGridPosition = function (windowId, config) {
        var _a;
        // Extract COG ID from windowId (expected format: "COG-0", "COG-1", etc.)
        var cogMatch = windowId.match(/COG[- ]?(\d)/i);
        var cogId = cogMatch ? parseInt(cogMatch[1], 10) : 0;
        // Validate COG ID
        if (cogId < 0 || cogId > 7) {
            console.warn("Invalid COG ID ".concat(cogId, " in windowId ").concat(windowId, ", defaulting to 0"));
        }
        var monitor = this.screenManager.getPrimaryMonitor();
        var workArea = monitor.workArea;
        var margin = (_a = config.margin) !== null && _a !== void 0 ? _a : 20; // Smaller margins for COG grid
        // Calculate grid dimensions (2 rows, 4 columns)
        var GRID_COLS = 4;
        var GRID_ROWS = 2;
        // Calculate available space for grid
        var availableWidth = workArea.width - (margin * 2);
        var availableHeight = workArea.height - (margin * 3) - 100; // Leave space for main window
        // Calculate cell dimensions with gaps between windows
        var gapX = 10; // Horizontal gap between COG windows
        var gapY = 10; // Vertical gap between COG windows
        var cellWidth = (availableWidth - (gapX * (GRID_COLS - 1))) / GRID_COLS;
        var cellHeight = (availableHeight - (gapY * (GRID_ROWS - 1))) / GRID_ROWS;
        // Ensure windows aren't too small
        var minWidth = 400;
        var minHeight = 300;
        var windowWidth = Math.max(Math.min(cellWidth, config.dimensions.width), minWidth);
        var windowHeight = Math.max(Math.min(cellHeight, config.dimensions.height), minHeight);
        // Calculate grid position (row and column)
        var col = cogId % GRID_COLS;
        var row = Math.floor(cogId / GRID_COLS);
        // Calculate actual position
        var x = workArea.x + margin + (col * (windowWidth + gapX));
        var y = workArea.y + margin + (row * (windowHeight + gapY));
        // Track this window
        this.trackedWindows.set(windowId, {
            id: windowId,
            bounds: { x: x, y: y, width: windowWidth, height: windowHeight },
            monitorId: monitor.id
        });
        return { x: x, y: y, monitor: monitor };
    };
    /**
     * Mark a slot as occupied
     */
    WindowPlacer.prototype.markSlotOccupied = function (windowId, slot, position, dimensions) {
        this.occupiedSlots.add(slot);
        this.trackedWindows.set(windowId, {
            id: windowId,
            slot: slot,
            bounds: {
                x: position.x,
                y: position.y,
                width: dimensions.width,
                height: dimensions.height
            },
            monitorId: position.monitor.id
        });
    };
    /**
     * Detect which slot a position corresponds to
     */
    WindowPlacer.prototype.detectSlotFromPosition = function (bounds) {
        // This is a heuristic - improve as needed
        var monitor = this.screenManager.getMonitorAtPoint(bounds.x, bounds.y);
        var workArea = monitor.workArea;
        var relX = bounds.x - workArea.x;
        var relY = bounds.y - workArea.y;
        var xRatio = relX / workArea.width;
        var yRatio = relY / workArea.height;
        // Determine horizontal position
        var horizontal;
        if (xRatio < 0.33)
            horizontal = 'left';
        else if (xRatio < 0.67)
            horizontal = 'center';
        else
            horizontal = 'right';
        // Determine vertical position
        var vertical;
        if (yRatio < 0.33)
            vertical = 'top';
        else if (yRatio < 0.67)
            vertical = 'middle';
        else
            vertical = 'bottom';
        // Map to slot
        var slotMap = {
            'top-left': PlacementSlot.TOP_LEFT,
            'top-center': PlacementSlot.TOP_CENTER,
            'top-right': PlacementSlot.TOP_RIGHT,
            'middle-left': PlacementSlot.MIDDLE_LEFT,
            'middle-center': PlacementSlot.MIDDLE_CENTER,
            'middle-right': PlacementSlot.MIDDLE_RIGHT,
            'bottom-left': PlacementSlot.BOTTOM_LEFT,
        };
        return slotMap["".concat(vertical, "-").concat(horizontal)];
    };
    /**
     * Check if two rectangles overlap
     */
    WindowPlacer.prototype.rectanglesOverlap = function (r1, r2) {
        return !(r1.x + r1.width < r2.x ||
            r2.x + r2.width < r1.x ||
            r1.y + r1.height < r2.y ||
            r2.y + r2.height < r1.y);
    };
    /**
     * Clean up all tracked windows
     */
    WindowPlacer.prototype.cleanup = function () {
        this.trackedWindows.clear();
        this.occupiedSlots.clear();
        this.cascadeCounter = 0;
    };
    WindowPlacer.instance = null;
    return WindowPlacer;
}());
exports.WindowPlacer = WindowPlacer;
exports.default = WindowPlacer;
