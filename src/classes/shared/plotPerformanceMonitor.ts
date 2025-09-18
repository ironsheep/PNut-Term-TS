/** @format */

/**
 * Performance monitoring system for PLOT window
 * Tracks frame rates, command processing times, memory usage, and rendering performance
 */

'use strict';

export interface PerformanceMetrics {
  // Frame rate metrics
  currentFPS: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;

  // Command processing metrics
  commandProcessingTime: number;
  averageCommandTime: number;
  totalCommandsProcessed: number;
  commandsPerSecond: number;

  // Memory metrics
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };

  // Rendering metrics
  renderTime: number;
  averageRenderTime: number;
  skippedFrames: number;

  // Canvas metrics
  canvasOperations: number;
  spriteOperations: number;
  layerOperations: number;

  // Session metrics
  sessionStartTime: number;
  uptime: number;
  totalOperations: number;
}

export interface PerformanceThresholds {
  targetFPS: number;
  maxCommandTime: number;
  maxRenderTime: number;
  memoryWarningThreshold: number;
}

export class PlotPerformanceMonitor {
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;

  // Frame rate tracking
  private frameTimestamps: number[] = [];
  private lastFrameTime: number = 0;

  // Command timing tracking
  private commandTimes: number[] = [];
  private commandStartTime: number = 0;

  // Render timing tracking
  private renderTimes: number[] = [];
  private renderStartTime: number = 0;

  // Rolling window size for averages
  private readonly WINDOW_SIZE = 60; // 60 samples for 1-second window at 60fps

  // Performance warnings
  private warnings: string[] = [];

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      targetFPS: 60,
      maxCommandTime: 10, // 10ms max per command
      maxRenderTime: 16, // 16ms max render time (60fps target)
      memoryWarningThreshold: 100 * 1024 * 1024, // 100MB
      ...thresholds
    };

    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      currentFPS: 0,
      averageFPS: 0,
      minFPS: Number.MAX_VALUE,
      maxFPS: 0,

      commandProcessingTime: 0,
      averageCommandTime: 0,
      totalCommandsProcessed: 0,
      commandsPerSecond: 0,

      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      },

      renderTime: 0,
      averageRenderTime: 0,
      skippedFrames: 0,

      canvasOperations: 0,
      spriteOperations: 0,
      layerOperations: 0,

      sessionStartTime: Date.now(),
      uptime: 0,
      totalOperations: 0
    };
  }

  /**
   * Mark the start of a frame for FPS calculation
   */
  frameStart(): void {
    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only recent frames for rolling average
    if (this.frameTimestamps.length > this.WINDOW_SIZE) {
      this.frameTimestamps.shift();
    }

    // Calculate FPS
    if (this.frameTimestamps.length >= 2) {
      const frameTime = now - this.lastFrameTime;
      this.metrics.currentFPS = frameTime > 0 ? 1000 / frameTime : 0;

      // Calculate average FPS over window
      const windowTime = now - this.frameTimestamps[0];
      this.metrics.averageFPS = windowTime > 0 ? (this.frameTimestamps.length - 1) * 1000 / windowTime : 0;

      // Update min/max
      this.metrics.minFPS = Math.min(this.metrics.minFPS, this.metrics.currentFPS);
      this.metrics.maxFPS = Math.max(this.metrics.maxFPS, this.metrics.currentFPS);
    }

    this.lastFrameTime = now;
  }

  /**
   * Mark the start of command processing
   */
  commandStart(): void {
    this.commandStartTime = performance.now();
  }

  /**
   * Mark the end of command processing
   */
  commandEnd(): void {
    if (this.commandStartTime > 0) {
      const commandTime = performance.now() - this.commandStartTime;
      this.commandTimes.push(commandTime);

      // Keep rolling window
      if (this.commandTimes.length > this.WINDOW_SIZE) {
        this.commandTimes.shift();
      }

      this.metrics.commandProcessingTime = commandTime;
      this.metrics.averageCommandTime = this.commandTimes.reduce((a, b) => a + b, 0) / this.commandTimes.length;
      this.metrics.totalCommandsProcessed++;

      // Calculate commands per second
      const now = Date.now();
      this.metrics.commandsPerSecond = this.metrics.totalCommandsProcessed / ((now - this.metrics.sessionStartTime) / 1000);

      // Check for performance warning
      if (commandTime > this.thresholds.maxCommandTime) {
        this.addWarning(`Command processing exceeded ${this.thresholds.maxCommandTime}ms: ${commandTime.toFixed(2)}ms`);
      }

      this.commandStartTime = 0;
    }
  }

  /**
   * Mark the start of rendering
   */
  renderStart(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * Mark the end of rendering
   */
  renderEnd(): void {
    if (this.renderStartTime > 0) {
      const renderTime = performance.now() - this.renderStartTime;
      this.renderTimes.push(renderTime);

      // Keep rolling window
      if (this.renderTimes.length > this.WINDOW_SIZE) {
        this.renderTimes.shift();
      }

      this.metrics.renderTime = renderTime;
      this.metrics.averageRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;

      // Check for performance warning
      if (renderTime > this.thresholds.maxRenderTime) {
        this.addWarning(`Render time exceeded ${this.thresholds.maxRenderTime}ms: ${renderTime.toFixed(2)}ms`);
      }

      this.renderStartTime = 0;
    }
  }

  /**
   * Record a skipped frame
   */
  recordSkippedFrame(): void {
    this.metrics.skippedFrames++;
  }

  /**
   * Record canvas operation
   */
  recordCanvasOperation(type: string): void {
    this.metrics.canvasOperations++;
    this.metrics.totalOperations++;

    if (type.includes('SPRITE')) {
      this.metrics.spriteOperations++;
    }
    if (type.includes('LAYER') || type.includes('CROP')) {
      this.metrics.layerOperations++;
    }
  }

  /**
   * Update memory usage metrics
   */
  updateMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    };

    // Check for memory warning
    if (memUsage.heapUsed > this.thresholds.memoryWarningThreshold) {
      this.addWarning(`Memory usage high: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  /**
   * Update session metrics
   */
  updateSession(): void {
    this.metrics.uptime = Date.now() - this.metrics.sessionStartTime;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage();
    this.updateSession();
    return { ...this.metrics };
  }

  /**
   * Get performance warnings
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Clear performance warnings
   */
  clearWarnings(): void {
    this.warnings = [];
  }

  /**
   * Add performance warning
   */
  private addWarning(warning: string): void {
    const timestamp = new Date().toISOString();
    this.warnings.push(`[${timestamp}] ${warning}`);

    // Keep only recent warnings
    if (this.warnings.length > 100) {
      this.warnings.shift();
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.frameTimestamps = [];
    this.commandTimes = [];
    this.renderTimes = [];
    this.warnings = [];
  }

  /**
   * Check if performance meets targets
   */
  isPerformanceAdequate(): boolean {
    const metrics = this.getMetrics();

    return (
      metrics.averageFPS >= this.thresholds.targetFPS * 0.9 && // Allow 10% tolerance
      metrics.averageCommandTime <= this.thresholds.maxCommandTime &&
      metrics.averageRenderTime <= this.thresholds.maxRenderTime &&
      metrics.memoryUsage.heapUsed <= this.thresholds.memoryWarningThreshold
    );
  }

  /**
   * Get performance summary report
   */
  getPerformanceReport(): string {
    const metrics = this.getMetrics();
    const adequate = this.isPerformanceAdequate();

    return `
=== PLOT Window Performance Report ===
Session Uptime: ${(metrics.uptime / 1000 / 60).toFixed(1)} minutes

Frame Rate:
  Current: ${metrics.currentFPS.toFixed(1)} fps
  Average: ${metrics.averageFPS.toFixed(1)} fps
  Min/Max: ${metrics.minFPS.toFixed(1)} / ${metrics.maxFPS.toFixed(1)} fps
  Target: ${this.thresholds.targetFPS} fps ${metrics.averageFPS >= this.thresholds.targetFPS * 0.9 ? '✓' : '✗'}

Command Processing:
  Last Command: ${metrics.commandProcessingTime.toFixed(2)}ms
  Average: ${metrics.averageCommandTime.toFixed(2)}ms
  Commands/sec: ${metrics.commandsPerSecond.toFixed(1)}
  Total Processed: ${metrics.totalCommandsProcessed}
  Target: <${this.thresholds.maxCommandTime}ms ${metrics.averageCommandTime <= this.thresholds.maxCommandTime ? '✓' : '✗'}

Rendering:
  Last Render: ${metrics.renderTime.toFixed(2)}ms
  Average: ${metrics.averageRenderTime.toFixed(2)}ms
  Skipped Frames: ${metrics.skippedFrames}
  Target: <${this.thresholds.maxRenderTime}ms ${metrics.averageRenderTime <= this.thresholds.maxRenderTime ? '✓' : '✗'}

Memory Usage:
  Heap Used: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB
  Heap Total: ${(metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(1)}MB
  RSS: ${(metrics.memoryUsage.rss / 1024 / 1024).toFixed(1)}MB
  Target: <${(this.thresholds.memoryWarningThreshold / 1024 / 1024).toFixed(0)}MB ${metrics.memoryUsage.heapUsed <= this.thresholds.memoryWarningThreshold ? '✓' : '✗'}

Operations:
  Canvas Operations: ${metrics.canvasOperations}
  Sprite Operations: ${metrics.spriteOperations}
  Layer Operations: ${metrics.layerOperations}
  Total Operations: ${metrics.totalOperations}

Overall Performance: ${adequate ? 'ADEQUATE' : 'NEEDS OPTIMIZATION'} ${adequate ? '✓' : '✗'}

Recent Warnings: ${this.warnings.length}
${this.warnings.slice(-5).join('\n')}
    `.trim();
  }
}