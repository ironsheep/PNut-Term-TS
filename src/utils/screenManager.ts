/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

// src/utils/screenManager.ts

import { screen, Display, Rectangle, BrowserWindow } from 'electron';

/**
 * Monitor information with additional metadata
 */
export interface MonitorInfo {
  id: string;
  display: Display;
  isPrimary: boolean;
  name: string;
  workArea: Rectangle;
  bounds: Rectangle;
  scaleFactor: number;
}

/**
 * Window placement options
 */
export interface PlacementOptions {
  preferredMonitor?: 'primary' | 'same-as-main' | 'specific';
  monitorId?: string;
  avoidTaskbar?: boolean;
  centerOnScreen?: boolean;
  cascadeOffset?: { x: number; y: number };
}

/**
 * Calculated window position
 */
export interface WindowPosition {
  x: number;
  y: number;
  monitor: MonitorInfo;
}

/**
 * Screen real estate calculation result
 */
export interface ScreenRealEstate {
  totalWidth: number;
  totalHeight: number;
  availableWidth: number;
  availableHeight: number;
  monitors: MonitorInfo[];
  primaryMonitor: MonitorInfo;
}

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
export class ScreenManager {
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

  private static instance: ScreenManager | null = null;
  private monitors: Map<string, MonitorInfo> = new Map();
  private primaryMonitorId: string | null = null;
  private initialized: boolean = false;

  /**
   * Singleton pattern for global screen management
   */
  public static getInstance(): ScreenManager {
    if (!ScreenManager.instance) {
      ScreenManager.instance = new ScreenManager();
    }
    return ScreenManager.instance;
  }

  private constructor() {
    this.initialize();
  }

  /**
   * Initialize screen manager and set up event listeners
   */
  private initialize(): void {
    if (this.initialized) return;
    
    try {
      // Initial monitor detection
      this.refreshMonitors();
      
      // Set up event listeners for monitor changes
      screen.on('display-added', () => {
        this.logConsoleMessage('Monitor added - refreshing display configuration');
        this.refreshMonitors();
      });
      
      screen.on('display-removed', () => {
        this.logConsoleMessage('Monitor removed - refreshing display configuration');
        this.refreshMonitors();
      });
      
      screen.on('display-metrics-changed', (event, display, changedMetrics) => {
        if (changedMetrics.includes('bounds') || changedMetrics.includes('workArea')) {
          this.logConsoleMessage(`Monitor ${display.id} metrics changed - refreshing`);
          this.refreshMonitors();
        }
      });
      
      this.initialized = true;
    } catch (error) {
      this.logConsoleMessage('Failed to initialize ScreenManager:', error);
      // Fall back to basic single-monitor support
      this.setupSingleMonitorFallback();
    }
  }

  /**
   * Refresh monitor information
   */
  private refreshMonitors(): void {
    this.monitors.clear();
    
    try {
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();
      
      displays.forEach(display => {
        const monitorInfo: MonitorInfo = {
          id: display.id.toString(),
          display: display,
          isPrimary: display.id === primaryDisplay.id,
          name: `Monitor ${display.id}`,
          workArea: display.workArea,
          bounds: display.bounds,
          scaleFactor: display.scaleFactor
        };
        
        this.monitors.set(monitorInfo.id, monitorInfo);
        
        if (monitorInfo.isPrimary) {
          this.primaryMonitorId = monitorInfo.id;
        }
      });
    } catch (error) {
      this.logConsoleMessage('Failed to refresh monitors:', error);
      this.setupSingleMonitorFallback();
    }
  }

  /**
   * Set up fallback for single-monitor or error scenarios
   */
  private setupSingleMonitorFallback(): void {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const monitorInfo: MonitorInfo = {
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
    } catch (error) {
      // Ultimate fallback - assume 1920x1080 screen
      this.logConsoleMessage('Failed to get primary display, using defaults:', error);
      const defaultMonitor: MonitorInfo = {
        id: 'default',
        display: null as any,
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
  }

  /**
   * Get all available monitors
   */
  public getMonitors(): MonitorInfo[] {
    if (this.monitors.size === 0) {
      this.refreshMonitors();
    }
    return Array.from(this.monitors.values());
  }

  /**
   * Get primary monitor
   */
  public getPrimaryMonitor(): MonitorInfo {
    if (!this.primaryMonitorId || !this.monitors.has(this.primaryMonitorId)) {
      this.refreshMonitors();
    }
    
    if (this.primaryMonitorId && this.monitors.has(this.primaryMonitorId)) {
      return this.monitors.get(this.primaryMonitorId)!;
    }
    
    // Fallback - return first monitor
    const monitors = this.getMonitors();
    return monitors[0];
  }

  /**
   * Get monitor by ID
   */
  public getMonitorById(id: string): MonitorInfo | undefined {
    return this.monitors.get(id);
  }

  /**
   * Get monitor containing a specific point
   */
  public getMonitorAtPoint(x: number, y: number): MonitorInfo {
    try {
      const display = screen.getDisplayNearestPoint({ x, y });
      const monitorId = display.id.toString();
      
      if (this.monitors.has(monitorId)) {
        return this.monitors.get(monitorId)!;
      }
    } catch (error) {
      this.logConsoleMessage('Failed to get monitor at point:', error);
    }
    
    // Fallback to primary
    return this.getPrimaryMonitor();
  }

  /**
   * Get monitor for a specific window
   */
  public getMonitorForWindow(window: BrowserWindow): MonitorInfo {
    try {
      const bounds = window.getBounds();
      const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
      };
      return this.getMonitorAtPoint(center.x, center.y);
    } catch (error) {
      this.logConsoleMessage('Failed to get monitor for window:', error);
      return this.getPrimaryMonitor();
    }
  }

  /**
   * Check if multi-monitor setup is available
   */
  public isMultiMonitor(): boolean {
    return this.monitors.size > 1;
  }

  /**
   * Calculate total screen real estate across all monitors
   */
  public getScreenRealEstate(): ScreenRealEstate {
    const monitors = this.getMonitors();
    const primaryMonitor = this.getPrimaryMonitor();
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let totalAvailableWidth = 0;
    let totalAvailableHeight = 0;
    
    monitors.forEach(monitor => {
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
  }

  /**
   * Calculate safe window position ensuring it's fully on screen
   */
  public calculateSafePosition(
    width: number,
    height: number,
    preferredX: number,
    preferredY: number,
    options: PlacementOptions = {}
  ): WindowPosition {
    // Determine target monitor
    let targetMonitor: MonitorInfo;
    
    if (options.monitorId) {
      targetMonitor = this.getMonitorById(options.monitorId) || this.getPrimaryMonitor();
    } else if (options.preferredMonitor === 'primary') {
      targetMonitor = this.getPrimaryMonitor();
    } else {
      targetMonitor = this.getMonitorAtPoint(preferredX, preferredY);
    }
    
    // Use work area if avoiding taskbar, otherwise use full bounds
    const bounds = options.avoidTaskbar ? targetMonitor.workArea : targetMonitor.bounds;
    
    // Calculate safe position within monitor bounds
    let safeX = preferredX;
    let safeY = preferredY;
    
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
  }

  /**
   * Calculate cascade position for multiple windows
   */
  public calculateCascadePosition(
    windowIndex: number,
    width: number,
    height: number,
    options: PlacementOptions = {}
  ): WindowPosition {
    const offset = options.cascadeOffset || { x: 32, y: 32 };
    const baseX = windowIndex * offset.x;
    const baseY = windowIndex * offset.y;
    
    return this.calculateSafePosition(width, height, baseX, baseY, options);
  }

  /**
   * Calculate grid position for arranging multiple windows
   */
  public calculateGridPosition(
    index: number,
    totalWindows: number,
    windowWidth: number,
    windowHeight: number,
    options: PlacementOptions = {}
  ): WindowPosition {
    const monitor = options.preferredMonitor === 'primary' 
      ? this.getPrimaryMonitor() 
      : this.getMonitors()[0];
    
    const bounds = options.avoidTaskbar ? monitor.workArea : monitor.bounds;
    
    // Calculate grid dimensions
    const cols = Math.ceil(Math.sqrt(totalWindows));
    const rows = Math.ceil(totalWindows / cols);
    
    // Calculate cell size
    const cellWidth = bounds.width / cols;
    const cellHeight = bounds.height / rows;
    
    // Calculate position
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    // Center window in cell if smaller than cell
    const x = bounds.x + col * cellWidth + Math.max(0, (cellWidth - windowWidth) / 2);
    const y = bounds.y + row * cellHeight + Math.max(0, (cellHeight - windowHeight) / 2);
    
    return this.calculateSafePosition(windowWidth, windowHeight, x, y, options);
  }

  /**
   * Check if a window would be off-screen at the given position
   */
  public isPositionOffScreen(x: number, y: number, width: number, height: number): boolean {
    const monitors = this.getMonitors();
    const windowBounds = { x, y, width, height };
    
    // Check if window intersects with any monitor
    for (const monitor of monitors) {
      if (this.rectanglesIntersect(windowBounds, monitor.bounds)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Helper to check if two rectangles intersect
   */
  private rectanglesIntersect(r1: Rectangle, r2: Rectangle): boolean {
    return !(
      r1.x + r1.width <= r2.x ||
      r2.x + r2.width <= r1.x ||
      r1.y + r1.height <= r2.y ||
      r2.y + r2.height <= r1.y
    );
  }

  /**
   * Get display scale factor for high-DPI displays
   */
  public getScaleFactor(monitor?: MonitorInfo): number {
    const targetMonitor = monitor || this.getPrimaryMonitor();
    return targetMonitor.scaleFactor || 1;
  }

  /**
   * Convert logical pixels to device pixels
   */
  public toDevicePixels(value: number, monitor?: MonitorInfo): number {
    const scaleFactor = this.getScaleFactor(monitor);
    return Math.round(value * scaleFactor);
  }

  /**
   * Convert device pixels to logical pixels
   */
  public toLogicalPixels(value: number, monitor?: MonitorInfo): number {
    const scaleFactor = this.getScaleFactor(monitor);
    return Math.round(value / scaleFactor);
  }
}