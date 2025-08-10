/** @format */

// src/utils/memoryProfiler.ts

/**
 * Memory profiler for detecting memory leaks in debug windows
 */
export class MemoryProfiler {
  private initialHeap: number = 0;
  private samples: number[] = [];
  private sampleInterval: NodeJS.Timeout | null = null;
  private readonly SAMPLE_INTERVAL = 100; // ms
  private readonly MAX_SAMPLES = 1000;
  
  /**
   * Start memory profiling
   */
  public startProfiling(): void {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Get initial heap usage
    this.initialHeap = this.getHeapUsage();
    this.samples = [this.initialHeap];
    
    // Start sampling
    this.sampleInterval = setInterval(() => {
      const usage = this.getHeapUsage();
      this.samples.push(usage);
      
      // Keep only recent samples
      if (this.samples.length > this.MAX_SAMPLES) {
        this.samples.shift();
      }
    }, this.SAMPLE_INTERVAL);
  }
  
  /**
   * Stop memory profiling
   */
  public stopProfiling(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }
  
  /**
   * Get current heap usage in MB
   */
  private getHeapUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024; // Convert to MB
  }
  
  /**
   * Get memory statistics
   */
  public getStats(): MemoryStats {
    if (this.samples.length === 0) {
      return {
        initial: 0,
        current: 0,
        peak: 0,
        average: 0,
        growth: 0,
        growthRate: 0,
        trend: 'stable'
      };
    }
    
    const current = this.samples[this.samples.length - 1];
    const peak = Math.max(...this.samples);
    const average = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const growth = current - this.initialHeap;
    const growthRate = this.calculateGrowthRate();
    const trend = this.determineTrend();
    
    return {
      initial: this.initialHeap,
      current,
      peak,
      average,
      growth,
      growthRate,
      trend
    };
  }
  
  /**
   * Calculate growth rate (MB per second)
   */
  private calculateGrowthRate(): number {
    if (this.samples.length < 10) return 0;
    
    // Use linear regression on last 10 samples
    const recentSamples = this.samples.slice(-10);
    const n = recentSamples.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recentSamples[i];
      sumXY += i * recentSamples[i];
      sumX2 += i * i;
    }
    
    // Calculate slope (MB per sample)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Convert to MB per second
    return slope * (1000 / this.SAMPLE_INTERVAL);
  }
  
  /**
   * Determine memory trend
   */
  private determineTrend(): 'stable' | 'growing' | 'leaking' {
    const rate = this.calculateGrowthRate();
    
    if (Math.abs(rate) < 0.01) return 'stable';  // Less than 10KB/s
    if (rate > 0.1) return 'leaking';  // More than 100KB/s
    if (rate > 0) return 'growing';
    return 'stable';
  }
  
  /**
   * Check for memory leak
   */
  public hasLeak(thresholdMB: number = 50): boolean {
    const stats = this.getStats();
    return stats.growth > thresholdMB || stats.trend === 'leaking';
  }
  
  /**
   * Get memory graph data for visualization
   */
  public getGraphData(): { time: number[]; memory: number[] } {
    const time = this.samples.map((_, i) => i * this.SAMPLE_INTERVAL / 1000);
    return { time, memory: this.samples };
  }
  
  /**
   * Force garbage collection if available
   */
  public forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }
  
  /**
   * Take heap snapshot (requires --expose-gc flag)
   */
  public takeSnapshot(): HeapSnapshot {
    const usage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0,
      rss: usage.rss
    };
  }
  
  /**
   * Compare two snapshots
   */
  public compareSnapshots(before: HeapSnapshot, after: HeapSnapshot): SnapshotDiff {
    return {
      heapUsedDiff: after.heapUsed - before.heapUsed,
      heapTotalDiff: after.heapTotal - before.heapTotal,
      externalDiff: after.external - before.external,
      arrayBuffersDiff: after.arrayBuffers - before.arrayBuffers,
      rssDiff: after.rss - before.rss,
      timeDiff: after.timestamp - before.timestamp
    };
  }
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  initial: number;      // Initial heap size (MB)
  current: number;      // Current heap size (MB)
  peak: number;         // Peak heap size (MB)
  average: number;      // Average heap size (MB)
  growth: number;       // Total growth (MB)
  growthRate: number;   // Growth rate (MB/s)
  trend: 'stable' | 'growing' | 'leaking';
}

/**
 * Heap snapshot
 */
export interface HeapSnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
}

/**
 * Snapshot difference
 */
export interface SnapshotDiff {
  heapUsedDiff: number;
  heapTotalDiff: number;
  externalDiff: number;
  arrayBuffersDiff: number;
  rssDiff: number;
  timeDiff: number;
}

/**
 * Window leak detector for tracking DOM and event listener leaks
 */
export class WindowLeakDetector {
  private windowRefs: WeakMap<any, string> = new WeakMap();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private timers: Set<NodeJS.Timeout> = new Set();
  private canvasContexts: WeakSet<any> = new WeakSet();
  
  /**
   * Track a window instance
   */
  public trackWindow(window: any, id: string): void {
    this.windowRefs.set(window, id);
    this.eventListeners.set(id, new Set());
  }
  
  /**
   * Track an event listener
   */
  public trackEventListener(windowId: string, listener: Function): void {
    const listeners = this.eventListeners.get(windowId);
    if (listeners) {
      listeners.add(listener);
    }
  }
  
  /**
   * Track a timer
   */
  public trackTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer);
  }
  
  /**
   * Track a canvas context
   */
  public trackCanvasContext(context: any): void {
    this.canvasContexts.add(context);
  }
  
  /**
   * Untrack a window
   */
  public untrackWindow(windowId: string): void {
    this.eventListeners.delete(windowId);
  }
  
  /**
   * Check for leaked event listeners
   */
  public getLeakedListeners(): Map<string, number> {
    const leaks = new Map<string, number>();
    
    for (const [windowId, listeners] of this.eventListeners) {
      if (listeners.size > 0) {
        leaks.set(windowId, listeners.size);
      }
    }
    
    return leaks;
  }
  
  /**
   * Check for leaked timers
   */
  public getLeakedTimers(): number {
    // Filter out cleared timers
    const activeTimers = new Set<NodeJS.Timeout>();
    for (const timer of this.timers) {
      // Check if timer is still active (this is a heuristic)
      if (timer.hasRef && timer.hasRef()) {
        activeTimers.add(timer);
      }
    }
    this.timers = activeTimers;
    return activeTimers.size;
  }
  
  /**
   * Clear all tracked resources
   */
  public clear(): void {
    this.eventListeners.clear();
    this.timers.clear();
    // WeakMap and WeakSet clean themselves up
  }
  
  /**
   * Get leak report
   */
  public getLeakReport(): LeakReport {
    const leakedListeners = this.getLeakedListeners();
    const leakedTimers = this.getLeakedTimers();
    
    return {
      eventListeners: Array.from(leakedListeners.entries()).map(([id, count]) => ({
        windowId: id,
        count
      })),
      timers: leakedTimers,
      hasLeaks: leakedListeners.size > 0 || leakedTimers > 0
    };
  }
}

/**
 * Leak report
 */
export interface LeakReport {
  eventListeners: { windowId: string; count: number }[];
  timers: number;
  hasLeaks: boolean;
}

/**
 * Memory baseline for comparing before/after states
 */
export class MemoryBaseline {
  private baseline: HeapSnapshot | null = null;
  
  /**
   * Capture baseline
   */
  public capture(): void {
    const usage = process.memoryUsage();
    this.baseline = {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0,
      rss: usage.rss
    };
  }
  
  /**
   * Compare against baseline
   */
  public compare(): SnapshotDiff | null {
    if (!this.baseline) return null;
    
    const current = process.memoryUsage();
    const now: HeapSnapshot = {
      timestamp: Date.now(),
      heapUsed: current.heapUsed,
      heapTotal: current.heapTotal,
      external: current.external,
      arrayBuffers: current.arrayBuffers || 0,
      rss: current.rss
    };
    
    return {
      heapUsedDiff: now.heapUsed - this.baseline.heapUsed,
      heapTotalDiff: now.heapTotal - this.baseline.heapTotal,
      externalDiff: now.external - this.baseline.external,
      arrayBuffersDiff: now.arrayBuffers - this.baseline.arrayBuffers,
      rssDiff: now.rss - this.baseline.rss,
      timeDiff: now.timestamp - this.baseline.timestamp
    };
  }
  
  /**
   * Reset baseline
   */
  public reset(): void {
    this.baseline = null;
  }
}