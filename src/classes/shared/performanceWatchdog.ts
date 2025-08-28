/** @format */

// src/classes/shared/performanceWatchdog.ts

import { EventEmitter } from 'events';
import { PerformanceMonitor } from './performanceMonitor';
import { MessagePool } from './messagePool';
import { CircularBuffer } from './circularBuffer';

/**
 * Performance level thresholds
 */
export enum PerformanceLevel {
  GREEN = 'green',     // Normal operation
  YELLOW = 'yellow',   // >80% capacity
  ORANGE = 'orange',   // >95% capacity  
  RED = 'red'          // Data loss occurring
}

/**
 * Alert event data
 */
export interface PerformanceAlert {
  level: PerformanceLevel;
  previousLevel: PerformanceLevel;
  metrics: WatchdogMetrics;
  message: string;
  timestamp: number;
}

/**
 * Comprehensive metrics tracked by watchdog
 */
export interface WatchdogMetrics {
  // Throughput metrics
  bytesPerSecond: number;
  messagesPerSecond: number;
  sustainableThroughput: number;
  burstCapacity: number;
  
  // Buffer metrics
  bufferUsagePercent: number;
  bufferBytesUsed: number;
  bufferBytesAvailable: number;
  bufferOverflowCount: number;
  
  // Queue metrics
  queueDepth: number;
  queueMaxDepth: number;
  queueDroppedMessages: number;
  
  // Processing metrics
  processingLagMs: number;
  averageMessageLatencyMs: number;
  maxMessageLatencyMs: number;
  
  // Memory metrics
  messagePoolUsage: number;
  messagePoolEfficiency: number;
  slowReleases: number;
  
  // System health
  droppedBytesTotal: number;
  droppedBytesPerSecond: number;
  errorCount: number;
  warningCount: number;
  
  // Pattern detection
  continuousLFsDetected: boolean;
  binaryFloodDetected: boolean;
  pathologicalPattern: string | null;
}

/**
 * Configuration for Performance Watchdog
 */
export interface WatchdogConfig {
  updateIntervalMs: number;        // How often to update metrics (default 100ms)
  historySize: number;              // Number of samples to keep (default 600 = 1 minute at 100ms)
  yellowThresholdPercent: number;   // Yellow alert threshold (default 80)
  orangeThresholdPercent: number;   // Orange alert threshold (default 95)
  sustainableThroughputBps: number; // Sustainable throughput in bytes/sec
  burstCapacityBps: number;         // Burst capacity in bytes/sec
}

/**
 * Performance Watchdog - Monitors all critical system metrics
 * 
 * RESPONSIBILITIES:
 * - Track throughput, buffer usage, queue depth, processing lag
 * - Detect pathological patterns (continuous LFs, binary floods)
 * - Emit alerts on threshold transitions
 * - Provide diagnostic reports
 * - Calculate sustainable vs burst capacity
 */
export class PerformanceWatchdog extends EventEmitter {
  private static instance: PerformanceWatchdog;
  
  private config: WatchdogConfig = {
    updateIntervalMs: 100,
    historySize: 600,
    yellowThresholdPercent: 80,
    orangeThresholdPercent: 95,
    sustainableThroughputBps: 2 * 1024 * 1024, // 2 Mbps
    burstCapacityBps: 4 * 1024 * 1024          // 4 Mbps burst
  };
  
  private performanceMonitor: PerformanceMonitor;
  private messagePool: MessagePool;
  private circularBuffer?: CircularBuffer;
  
  private updateTimer?: NodeJS.Timeout;
  private currentLevel: PerformanceLevel = PerformanceLevel.GREEN;
  private metricsHistory: WatchdogMetrics[] = [];
  
  // Tracking for rate calculations
  private lastUpdateTime: number = Date.now();
  private lastBytesProcessed: number = 0;
  private lastMessagesProcessed: number = 0;
  private lastDroppedBytes: number = 0;
  
  // Pattern detection
  private continuousLFCount: number = 0;
  private binaryFloodCount: number = 0;
  private lastPatternCheckTime: number = Date.now();
  
  // Alert management
  private alertCooldownMs: number = 5000; // Prevent alert spam
  private lastAlertTime: Map<PerformanceLevel, number> = new Map();
  
  private constructor() {
    super();
    this.performanceMonitor = new PerformanceMonitor();
    this.messagePool = MessagePool.getInstance();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PerformanceWatchdog {
    if (!PerformanceWatchdog.instance) {
      PerformanceWatchdog.instance = new PerformanceWatchdog();
    }
    return PerformanceWatchdog.instance;
  }
  
  /**
   * Configure watchdog parameters
   */
  public configure(config: Partial<WatchdogConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Set circular buffer reference for monitoring
   */
  public setCircularBuffer(buffer: CircularBuffer): void {
    this.circularBuffer = buffer;
  }
  
  /**
   * Start monitoring
   */
  public start(): void {
    if (this.updateTimer) {
      return; // Already running
    }
    
    this.updateTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.updateIntervalMs);
    
    console.log('[PerformanceWatchdog] Started monitoring');
  }
  
  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    
    console.log('[PerformanceWatchdog] Stopped monitoring');
  }
  
  /**
   * Update all metrics and check thresholds
   */
  private updateMetrics(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // Convert to seconds
    
    // Get current performance stats
    const perfSnapshot = this.performanceMonitor.getSnapshot();
    const poolStats = this.messagePool.getStats();
    const bufferStats = this.circularBuffer?.getStats();
    
    // Calculate rates (using snapshot metrics)
    const bytesPerSecond = perfSnapshot.metrics.throughput.bytesPerSecond;
    const messagesPerSecond = perfSnapshot.metrics.throughput.messagesPerSecond;
    const droppedBytesPerSecond = 0; // Not tracked in current implementation
    
    // Build metrics object
    const metrics: WatchdogMetrics = {
      // Throughput
      bytesPerSecond: Math.round(bytesPerSecond),
      messagesPerSecond: Math.round(messagesPerSecond),
      sustainableThroughput: this.config.sustainableThroughputBps,
      burstCapacity: this.config.burstCapacityBps,
      
      // Buffer
      bufferUsagePercent: bufferStats?.usagePercent || 0,
      bufferBytesUsed: bufferStats?.used || 0,
      bufferBytesAvailable: bufferStats?.available || 0,
      bufferOverflowCount: bufferStats?.overflowCount || 0,
      
      // Queue
      queueDepth: Object.values(perfSnapshot.metrics.queues).reduce(
        (sum, q) => sum + q.currentDepth, 0
      ),
      queueMaxDepth: 1000, // Typical max queue size
      queueDroppedMessages: 0, // Not currently tracked
      
      // Processing
      processingLagMs: perfSnapshot.metrics.messageLatency.avg,
      averageMessageLatencyMs: perfSnapshot.metrics.messageLatency.avg,
      maxMessageLatencyMs: perfSnapshot.metrics.messageLatency.max,
      
      // Memory
      messagePoolUsage: poolStats.poolSize - poolStats.freeCount,
      messagePoolEfficiency: parseFloat(poolStats.efficiency) / 100,
      slowReleases: poolStats.slowReleaseCount,
      
      // System health
      droppedBytesTotal: 0, // Not currently tracked
      droppedBytesPerSecond: Math.round(droppedBytesPerSecond),
      errorCount: perfSnapshot.metrics.events.extractionErrors + perfSnapshot.metrics.events.routingErrors,
      warningCount: 0, // Not currently tracked
      
      // Pattern detection
      continuousLFsDetected: this.continuousLFCount > 100,
      binaryFloodDetected: this.binaryFloodCount > 50,
      pathologicalPattern: this.detectPathologicalPattern()
    };
    
    // Update history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.config.historySize) {
      this.metricsHistory.shift();
    }
    
    // Check performance levels
    const newLevel = this.calculatePerformanceLevel(metrics);
    if (newLevel !== this.currentLevel) {
      this.handleLevelTransition(newLevel, metrics);
    }
    
    // Update tracking values
    this.lastUpdateTime = now;
    this.lastBytesProcessed = 0; // Would need cumulative tracking
    this.lastMessagesProcessed = 0; // Would need cumulative tracking
    this.lastDroppedBytes = 0; // Not currently tracked
  }
  
  /**
   * Calculate current performance level based on metrics
   */
  private calculatePerformanceLevel(metrics: WatchdogMetrics): PerformanceLevel {
    // RED - Data loss occurring
    if (metrics.droppedBytesPerSecond > 0 || metrics.queueDroppedMessages > 0) {
      return PerformanceLevel.RED;
    }
    
    // Calculate overall system load
    const bufferLoad = metrics.bufferUsagePercent;
    const queueLoad = (metrics.queueDepth / metrics.queueMaxDepth) * 100;
    const throughputLoad = (metrics.bytesPerSecond / this.config.sustainableThroughputBps) * 100;
    const maxLoad = Math.max(bufferLoad, queueLoad, throughputLoad);
    
    // ORANGE - Very high load (>95%)
    if (maxLoad >= this.config.orangeThresholdPercent) {
      return PerformanceLevel.ORANGE;
    }
    
    // YELLOW - High load (>80%)
    if (maxLoad >= this.config.yellowThresholdPercent) {
      return PerformanceLevel.YELLOW;
    }
    
    // GREEN - Normal operation
    return PerformanceLevel.GREEN;
  }
  
  /**
   * Handle transition between performance levels
   */
  private handleLevelTransition(newLevel: PerformanceLevel, metrics: WatchdogMetrics): void {
    const previousLevel = this.currentLevel;
    this.currentLevel = newLevel;
    
    // Check cooldown to prevent alert spam
    const lastAlert = this.lastAlertTime.get(newLevel) || 0;
    const now = Date.now();
    if (now - lastAlert < this.alertCooldownMs) {
      return; // Still in cooldown
    }
    
    // Generate alert message
    let message: string;
    switch (newLevel) {
      case PerformanceLevel.RED:
        message = `CRITICAL: Data loss occurring! Dropped ${metrics.droppedBytesPerSecond} bytes/sec`;
        break;
      case PerformanceLevel.ORANGE:
        message = `WARNING: System at ${Math.round(Math.max(
          metrics.bufferUsagePercent,
          (metrics.queueDepth / metrics.queueMaxDepth) * 100
        ))}% capacity`;
        break;
      case PerformanceLevel.YELLOW:
        message = `CAUTION: High system load detected`;
        break;
      case PerformanceLevel.GREEN:
        message = `System performance returned to normal`;
        break;
    }
    
    // Emit alert event
    const alert: PerformanceAlert = {
      level: newLevel,
      previousLevel,
      metrics,
      message,
      timestamp: now
    };
    
    this.emit('alert', alert);
    this.lastAlertTime.set(newLevel, now);
    
    console.log(`[PerformanceWatchdog] ${message}`);
  }
  
  /**
   * Detect pathological patterns in data stream
   */
  private detectPathologicalPattern(): string | null {
    if (this.continuousLFCount > 100) {
      return 'Continuous line feeds detected';
    }
    
    if (this.binaryFloodCount > 50) {
      return 'Binary data flood detected';
    }
    
    // Check for other patterns in history
    if (this.metricsHistory.length >= 10) {
      const recent = this.metricsHistory.slice(-10);
      
      // Check for sustained high message rate with small messages
      const avgMessagesPerSec = recent.reduce((sum, m) => sum + m.messagesPerSecond, 0) / recent.length;
      const avgBytesPerMessage = recent.reduce((sum, m) => 
        m.messagesPerSecond > 0 ? sum + (m.bytesPerSecond / m.messagesPerSecond) : sum, 0
      ) / recent.length;
      
      if (avgMessagesPerSec > 1000 && avgBytesPerMessage < 10) {
        return 'High frequency small messages detected';
      }
    }
    
    return null;
  }
  
  /**
   * Update pattern detection counters
   */
  public updatePatternDetection(data: Uint8Array): void {
    // Count consecutive LFs
    let lfCount = 0;
    for (const byte of data) {
      if (byte === 0x0A) {
        lfCount++;
      }
    }
    
    if (lfCount > data.length * 0.8) {
      this.continuousLFCount += lfCount;
    } else {
      this.continuousLFCount = Math.max(0, this.continuousLFCount - 10);
    }
    
    // Detect binary flood (high proportion of non-printable)
    let binaryCount = 0;
    for (const byte of data) {
      if (byte < 0x20 || byte > 0x7E) {
        binaryCount++;
      }
    }
    
    if (binaryCount > data.length * 0.9) {
      this.binaryFloodCount++;
    } else {
      this.binaryFloodCount = Math.max(0, this.binaryFloodCount - 1);
    }
  }
  
  /**
   * Get current metrics
   */
  public getCurrentMetrics(): WatchdogMetrics | null {
    if (this.metricsHistory.length === 0) {
      return null;
    }
    return this.metricsHistory[this.metricsHistory.length - 1];
  }
  
  /**
   * Get current performance level
   */
  public getCurrentLevel(): PerformanceLevel {
    return this.currentLevel;
  }
  
  /**
   * Get metrics history
   */
  public getMetricsHistory(): WatchdogMetrics[] {
    return [...this.metricsHistory];
  }
  
  /**
   * Generate diagnostic report
   */
  public generateDiagnosticReport(): string {
    const current = this.getCurrentMetrics();
    if (!current) {
      return 'No metrics available yet';
    }
    
    const report = [
      '=== PERFORMANCE WATCHDOG DIAGNOSTIC REPORT ===',
      `Generated: ${new Date().toISOString()}`,
      `Current Level: ${this.currentLevel.toUpperCase()}`,
      '',
      '--- THROUGHPUT ---',
      `Current: ${(current.bytesPerSecond / 1024 / 1024).toFixed(2)} Mbps`,
      `Messages/sec: ${current.messagesPerSecond}`,
      `Sustainable: ${(current.sustainableThroughput / 1024 / 1024).toFixed(2)} Mbps`,
      `Burst Capacity: ${(current.burstCapacity / 1024 / 1024).toFixed(2)} Mbps`,
      '',
      '--- BUFFER ---',
      `Usage: ${current.bufferUsagePercent.toFixed(1)}%`,
      `Used: ${current.bufferBytesUsed.toLocaleString()} bytes`,
      `Available: ${current.bufferBytesAvailable.toLocaleString()} bytes`,
      `Overflows: ${current.bufferOverflowCount}`,
      '',
      '--- QUEUES ---',
      `Total Depth: ${current.queueDepth}`,
      `Dropped Messages: ${current.queueDroppedMessages}`,
      '',
      '--- PROCESSING ---',
      `Processing Lag: ${current.processingLagMs.toFixed(1)}ms`,
      `Avg Latency: ${current.averageMessageLatencyMs.toFixed(1)}ms`,
      `Max Latency: ${current.maxMessageLatencyMs.toFixed(1)}ms`,
      '',
      '--- MEMORY ---',
      `Message Pool Usage: ${current.messagePoolUsage}`,
      `Pool Efficiency: ${(current.messagePoolEfficiency * 100).toFixed(1)}%`,
      `Slow Releases: ${current.slowReleases}`,
      '',
      '--- HEALTH ---',
      `Total Dropped: ${current.droppedBytesTotal.toLocaleString()} bytes`,
      `Dropping Rate: ${current.droppedBytesPerSecond} bytes/sec`,
      `Errors: ${current.errorCount}`,
      `Warnings: ${current.warningCount}`,
      '',
      '--- PATTERN DETECTION ---',
      `Continuous LFs: ${current.continuousLFsDetected ? 'YES' : 'NO'}`,
      `Binary Flood: ${current.binaryFloodDetected ? 'YES' : 'NO'}`,
      `Pattern: ${current.pathologicalPattern || 'None detected'}`,
      '',
      '--- HISTORY SUMMARY ---',
      this.generateHistorySummary(),
      '================================='
    ];
    
    return report.join('\n');
  }
  
  /**
   * Generate summary of metrics history
   */
  private generateHistorySummary(): string {
    if (this.metricsHistory.length < 10) {
      return 'Insufficient history for summary';
    }
    
    const recent = this.metricsHistory.slice(-60); // Last 6 seconds at 100ms intervals
    
    const avgThroughput = recent.reduce((sum, m) => sum + m.bytesPerSecond, 0) / recent.length;
    const maxThroughput = Math.max(...recent.map(m => m.bytesPerSecond));
    const avgBufferUsage = recent.reduce((sum, m) => sum + m.bufferUsagePercent, 0) / recent.length;
    const maxQueueDepth = Math.max(...recent.map(m => m.queueDepth));
    
    return [
      `Samples: ${recent.length}`,
      `Avg Throughput: ${(avgThroughput / 1024 / 1024).toFixed(2)} Mbps`,
      `Max Throughput: ${(maxThroughput / 1024 / 1024).toFixed(2)} Mbps`,
      `Avg Buffer: ${avgBufferUsage.toFixed(1)}%`,
      `Max Queue: ${maxQueueDepth}`
    ].join(', ');
  }
  
  /**
   * Reset all metrics and history
   */
  public reset(): void {
    this.metricsHistory = [];
    this.currentLevel = PerformanceLevel.GREEN;
    this.continuousLFCount = 0;
    this.binaryFloodCount = 0;
    this.lastAlertTime.clear();
    
    console.log('[PerformanceWatchdog] Reset complete');
  }
}