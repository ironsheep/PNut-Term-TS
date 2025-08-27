"use strict";
/** @format */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenManager = void 0;
// src/utils/screenManager.ts
var electron_1 = require("electron");
/**
 * ScreenManager - Wrapper for Electron's screen API
 *
 * Provides utility functions for multi-monitor support, window placement,
 * and screen real estate calculations. Includes fallback strategies for
 * single-monitor environments.
 *
 * Key features:
 * - Multi-monitor detection and enumeration
 * - Safe window placement within screen bounds
 * - Monitor change event handling
 * - Work area calculations (excluding taskbars)
 * - Fallback to single-monitor when multi-monitor unavailable
 */
var ScreenManager = /** @class */ (function () {
    function ScreenManager() {
        this.monitors = new Map();
        this.primaryMonitorId = null;
        this.initialized = false;
        this.initialize();
    }
    /**
     * Singleton pattern for global screen management
     */
    ScreenManager.getInstance = function () {
        if (!ScreenManager.instance) {
            ScreenManager.instance = new ScreenManager();
        }
        return ScreenManager.instance;
    };
    /**
     * Initialize screen manager and set up event listeners
     */
    ScreenManager.prototype.initialize = function () {
        var _this = this;
        if (this.initialized)
            return;
        try {
            // Initial monitor detection
            this.refreshMonitors();
            // Set up event listeners for monitor changes
            electron_1.screen.on('display-added', function () {
                console.log('Monitor added - refreshing display configuration');
                _this.refreshMonitors();
            });
            electron_1.screen.on('display-removed', function () {
                console.log('Monitor removed - refreshing display configuration');
                _this.refreshMonitors();
            });
            electron_1.screen.on('display-metrics-changed', function (event, display, changedMetrics) {
                if (changedMetrics.includes('bounds') || changedMetrics.includes('workArea')) {
                    console.log("Monitor ".concat(display.id, " metrics changed - refreshing"));
                    _this.refreshMonitors();
                }
            });
            this.initialized = true;
        }
        catch (error) {
            console.error('Failed to initialize ScreenManager:', error);
            // Fall back to basic single-monitor support
            this.setupSingleMonitorFallback();
        }
    };
    /**
     * Refresh monitor information
     */
    ScreenManager.prototype.refreshMonitors = function () {
        var _this = this;
        this.monitors.clear();
        try {
            var displays = electron_1.screen.getAllDisplays();
            var primaryDisplay_1 = electron_1.screen.getPrimaryDisplay();
            displays.forEach(function (display) {
                var monitorInfo = {
                    id: display.id.toString(),
                    display: display,
                    isPrimary: display.id === primaryDisplay_1.id,
                    name: "Monitor ".concat(display.id),
                    workArea: display.workArea,
                    bounds: display.bounds,
                    scaleFactor: display.scaleFactor
                };
                _this.monitors.set(monitorInfo.id, monitorInfo);
                if (monitorInfo.isPrimary) {
                    _this.primaryMonitorId = monitorInfo.id;
                }
            });
        }
        catch (error) {
            console.error('Failed to refresh monitors:', error);
            this.setupSingleMonitorFallback();
        }
    };
    /**
     * Set up fallback for single-monitor or error scenarios
     */
    ScreenManager.prototype.setupSingleMonitorFallback = function () {
        try {
            var primaryDisplay = electron_1.screen.getPrimaryDisplay();
            var monitorInfo = {
                id: 'primary',
                display: primaryDisplay,
                isPrimary: true,
                name: 'Primary Monitor',
                workArea: primaryDisplay.workArea,
                bounds: primaryDisplay.bounds,
                scaleFactor: primaryDisplay.scaleFactor
            };
            this.monitors.clear();
            this.monitors.set('primary', monitorInfo);
            this.primaryMonitorId = 'primary';
        }
        catch (error) {
            // Ultimate fallback - assume 1920x1080 screen
            console.error('Failed to get primary display, using defaults:', error);
            var defaultMonitor = {
                id: 'default',
                display: null,
                isPrimary: true,
                name: 'Default Monitor',
                workArea: { x: 0, y: 0, width: 1920, height: 1040 },
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                scaleFactor: 1
            };
            this.monitors.clear();
            this.monitors.set('default', defaultMonitor);
            this.primaryMonitorId = 'default';
        }
    };
    /**
     * Get all available monitors
     */
    ScreenManager.prototype.getMonitors = function () {
        if (this.monitors.size === 0) {
            this.refreshMonitors();
        }
        return Array.from(this.monitors.values());
    };
    /**
     * Get primary monitor
     */
    ScreenManager.prototype.getPrimaryMonitor = function () {
        if (!this.primaryMonitorId || !this.monitors.has(this.primaryMonitorId)) {
            this.refreshMonitors();
        }
        if (this.primaryMonitorId && this.monitors.has(this.primaryMonitorId)) {
            return this.monitors.get(this.primaryMonitorId);
        }
        // Fallback - return first monitor
        var monitors = this.getMonitors();
        return monitors[0];
    };
    /**
     * Get monitor by ID
     */
    ScreenManager.prototype.getMonitorById = function (id) {
        return this.monitors.get(id);
    };
    /**
     * Get monitor containing a specific point
     */
    ScreenManager.prototype.getMonitorAtPoint = function (x, y) {
        try {
            var display = electron_1.screen.getDisplayNearestPoint({ x: x, y: y });
            var monitorId = display.id.toString();
            if (this.monitors.has(monitorId)) {
                return this.monitors.get(monitorId);
            }
        }
        catch (error) {
            console.error('Failed to get monitor at point:', error);
        }
        // Fallback to primary
        return this.getPrimaryMonitor();
    };
    /**
     * Get monitor for a specific window
     */
    ScreenManager.prototype.getMonitorForWindow = function (window) {
        try {
            var bounds = window.getBounds();
            var center = {
                x: bounds.x + bounds.width / 2,
                y: bounds.y + bounds.height / 2
            };
            return this.getMonitorAtPoint(center.x, center.y);
        }
        catch (error) {
            console.error('Failed to get monitor for window:', error);
            return this.getPrimaryMonitor();
        }
    };
    /**
     * Check if multi-monitor setup is available
     */
    ScreenManager.prototype.isMultiMonitor = function () {
        return this.monitors.size > 1;
    };
    /**
     * Calculate total screen real estate across all monitors
     */
    ScreenManager.prototype.getScreenRealEstate = function () {
        var monitors = this.getMonitors();
        var primaryMonitor = this.getPrimaryMonitor();
        var minX = Infinity, minY = Infinity;
        var maxX = -Infinity, maxY = -Infinity;
        var totalAvailableWidth = 0;
        var totalAvailableHeight = 0;
        monitors.forEach(function (monitor) {
            // Calculate bounding box
            minX = Math.min(minX, monitor.bounds.x);
            minY = Math.min(minY, monitor.bounds.y);
            maxX = Math.max(maxX, monitor.bounds.x + monitor.bounds.width);
            maxY = Math.max(maxY, monitor.bounds.y + monitor.bounds.height);
            // Sum up available work areas
            totalAvailableWidth += monitor.workArea.width;
            totalAvailableHeight = Math.max(totalAvailableHeight, monitor.workArea.height);
        });
        return {
            totalWidth: maxX - minX,
            totalHeight: maxY - minY,
            availableWidth: totalAvailableWidth,
            availableHeight: totalAvailableHeight,
            monitors: monitors,
            primaryMonitor: primaryMonitor
        };
    };
    /**
     * Calculate safe window position ensuring it's fully on screen
     */
    ScreenManager.prototype.calculateSafePosition = function (width, height, preferredX, preferredY, options) {
        if (options === void 0) { options = {}; }
        // Determine target monitor
        var targetMonitor;
        if (options.monitorId) {
            targetMonitor = this.getMonitorById(options.monitorId) || this.getPrimaryMonitor();
        }
        else if (options.preferredMonitor === 'primary') {
            targetMonitor = this.getPrimaryMonitor();
        }
        else {
            targetMonitor = this.getMonitorAtPoint(preferredX, preferredY);
        }
        // Use work area if avoiding taskbar, otherwise use full bounds
        var bounds = options.avoidTaskbar ? targetMonitor.workArea : targetMonitor.bounds;
        // Calculate safe position within monitor bounds
        var safeX = preferredX;
        var safeY = preferredY;
        // Ensure window is fully within the monitor
        safeX = Math.max(bounds.x, Math.min(safeX, bounds.x + bounds.width - width));
        safeY = Math.max(bounds.y, Math.min(safeY, bounds.y + bounds.height - height));
        // Apply centering if requested
        if (options.centerOnScreen) {
            safeX = bounds.x + (bounds.width - width) / 2;
            safeY = bounds.y + (bounds.height - height) / 2;
        }
        return {
            x: Math.round(safeX),
            y: Math.round(safeY),
            monitor: targetMonitor
        };
    };
    /**
     * Calculate cascade position for multiple windows
     */
    ScreenManager.prototype.calculateCascadePosition = function (windowIndex, width, height, options) {
        if (options === void 0) { options = {}; }
        var offset = options.cascadeOffset || { x: 32, y: 32 };
        var baseX = windowIndex * offset.x;
        var baseY = windowIndex * offset.y;
        return this.calculateSafePosition(width, height, baseX, baseY, options);
    };
    /**
     * Calculate grid position for arranging multiple windows
     */
    ScreenManager.prototype.calculateGridPosition = function (index, totalWindows, windowWidth, windowHeight, options) {
        if (options === void 0) { options = {}; }
        var monitor = options.preferredMonitor === 'primary'
            ? this.getPrimaryMonitor()
            : this.getMonitors()[0];
        var bounds = options.avoidTaskbar ? monitor.workArea : monitor.bounds;
        // Calculate grid dimensions
        var cols = Math.ceil(Math.sqrt(totalWindows));
        var rows = Math.ceil(totalWindows / cols);
        // Calculate cell size
        var cellWidth = bounds.width / cols;
        var cellHeight = bounds.height / rows;
        // Calculate position
        var col = index % cols;
        var row = Math.floor(index / cols);
        // Center window in cell if smaller than cell
        var x = bounds.x + col * cellWidth + Math.max(0, (cellWidth - windowWidth) / 2);
        var y = bounds.y + row * cellHeight + Math.max(0, (cellHeight - windowHeight) / 2);
        return this.calculateSafePosition(windowWidth, windowHeight, x, y, options);
    };
    /**
     * Check if a window would be off-screen at the given position
     */
    ScreenManager.prototype.isPositionOffScreen = function (x, y, width, height) {
        var monitors = this.getMonitors();
        var windowBounds = { x: x, y: y, width: width, height: height };
        // Check if window intersects with any monitor
        for (var _i = 0, monitors_1 = monitors; _i < monitors_1.length; _i++) {
            var monitor = monitors_1[_i];
            if (this.rectanglesIntersect(windowBounds, monitor.bounds)) {
                return false;
            }
        }
        return true;
    };
    /**
     * Helper to check if two rectangles intersect
     */
    ScreenManager.prototype.rectanglesIntersect = function (r1, r2) {
        return !(r1.x + r1.width <= r2.x ||
            r2.x + r2.width <= r1.x ||
            r1.y + r1.height <= r2.y ||
            r2.y + r2.height <= r1.y);
    };
    /**
     * Get display scale factor for high-DPI displays
     */
    ScreenManager.prototype.getScaleFactor = function (monitor) {
        var targetMonitor = monitor || this.getPrimaryMonitor();
        return targetMonitor.scaleFactor || 1;
    };
    /**
     * Convert logical pixels to device pixels
     */
    ScreenManager.prototype.toDevicePixels = function (value, monitor) {
        var scaleFactor = this.getScaleFactor(monitor);
        return Math.round(value * scaleFactor);
    };
    /**
     * Convert device pixels to logical pixels
     */
    ScreenManager.prototype.toLogicalPixels = function (value, monitor) {
        var scaleFactor = this.getScaleFactor(monitor);
        return Math.round(value / scaleFactor);
    };
    ScreenManager.instance = null;
    return ScreenManager;
}());
exports.ScreenManager = ScreenManager;
