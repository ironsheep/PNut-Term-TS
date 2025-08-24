/** @format */

// src/classes/shared/performanceMonitor.ts

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Performance metrics snapshot
 */
export interface PerformanceSnapshot {
  timestamp: number;
  uptimeMs: number;
  metrics: {
    // Buffer metrics
    bufferUsagePercent: number;
    bufferHighWaterMark: number;
    bufferOverflows: number;
    
    // Queue metrics
    queues: {
      [name: string]: {
        currentDepth: number;
        highWaterMark: number;
        totalEnqueued: number;
        totalDequeued: number;
        avgDepth: number;
      };
    };
    
    // Message metrics
    messageLatency: {
      min: number;
      max: number;
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
    
    // Throughput metrics
    throughput: {
      bytesPerSecond: number;
      messagesPerSecond: number;
      extractionsPerSecond: number;
      routingsPerSecond: number;
    };
    
    // Event counts
    events: {
      dtrResets: number;
      rtsResets: number;
      bufferOverflows: number;
      queueOverflows: number;
      extractionErrors: number;
      routingErrors: number;
    };
  };
}

/**
 * Performance event for logging
 */
export interface PerformanceEvent {
  timestamp: number;
  type: 'threshold' | 'overflow' | 'reset' | 'error' | 'snapshot';
  component: string;
  event: string;
  details: any;
}

/**
 * Latency tracker for percentile calculations
 */
class LatencyTracker {
  private samples: number[] = [];
  private maxSamples: number = 1000;
  private sum: number = 0;
  private count: number = 0;
  private min: number = Number.MAX_VALUE;
  private max: number = 0;

  /**
   * Add a latency sample
   */
  public addSample(latencyMs: number): void {
    this.samples.push(latencyMs);
    if (this.samples.length > this.maxSamples) {
      const removed = this.samples.shift()!;
      this.sum -= removed;
      this.count--;
    }
    
    this.sum += latencyMs;
    this.count++;
    this.min = Math.min(this.min, latencyMs);
    this.max = Math.max(this.max, latencyMs);
  }

  /**
   * Get percentile value
   */
  public getPercentile(percentile: number): number {
    if (this.samples.length === 0) return 0;
    
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  /**
   * Get statistics
   */
  public getStats() {
    if (this.count === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }
    
    return {
      min: this.min,
      max: this.max,
      avg: this.sum / this.count,
      p50: this.getPercentile(50),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99)
    };
  }

  /**
   * Reset tracker
   */
  public reset(): void {
    this.samples = [];
    this.sum = 0;
    this.count = 0;
    this.min = Number.MAX_VALUE;
    this.max = 0;
  }
}

/**
 * Rate calculator for throughput metrics
 */
class RateCalculator {
  private windowMs: number;
  private samples: Array<{ timestamp: number; value: number }> = [];

  constructor(windowMs: number = 1000) {
    this.windowMs = windowMs;
  }

  /**
   * Add a sample
   */
  public addSample(value: number): void {
    const now = Date.now();
    this.samples.push({ timestamp: now, value });
    
    // Remove old samples
    const cutoff = now - this.windowMs;
    this.samples = this.samples.filter(s => s.timestamp > cutoff);
  }

  /**
   * Get current rate
   */
  public getRate(): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    
    const recentSamples = this.samples.filter(s => s.timestamp > cutoff);
    const sum = recentSamples.reduce((acc, s) => acc + s.value, 0);
    
    return (sum / this.windowMs) * 1000; // Convert to per second
  }

  /**
   * Reset calculator
   */
  public reset(): void {
    this.samples = [];
  }
}

/**
 * Queue metrics tracker
 */
class QueueMetrics {
  private totalEnqueued: number = 0;
  private totalDequeued: number = 0;
  private highWaterMark: number = 0;
  private depthSamples: number[] = [];
  private maxSamples: number = 100;

  /**
   * Record enqueue
   */
  public recordEnqueue(newDepth: number): void {
    this.totalEnqueued++;
    this.updateDepth(newDepth);
  }

  /**
   * Record dequeue
   */
  public recordDequeue(newDepth: number): void {
    this.totalDequeued++;
    this.updateDepth(newDepth);
  }

  /**
   * Update depth tracking
   */
  private updateDepth(depth: number): void {
    this.highWaterMark = Math.max(this.highWaterMark, depth);
    this.depthSamples.push(depth);
    if (this.depthSamples.length > this.maxSamples) {
      this.depthSamples.shift();
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(currentDepth: number) {
    const avgDepth = this.depthSamples.length > 0
      ? this.depthSamples.reduce((a, b) => a + b, 0) / this.depthSamples.length
      : 0;

    return {
      currentDepth,
      highWaterMark: this.highWaterMark,
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      avgDepth
    };
  }

  /**
   * Reset metrics
   */
  public reset(): void {
    this.totalEnqueued = 0;
    this.totalDequeued = 0;
    this.highWaterMark = 0;
    this.depthSamples = [];
  }
}

/**
 * PerformanceMonitor - Comprehensive performance tracking
 * 
 * Tracks metrics across all components:
 * - Buffer utilization and overflow
 * - Queue depths and throughput
 * - Message latency (end-to-end)
 * - Processing rates
 * - Error events
 * 
 * Provides:
 * - Real-time metrics via getSnapshot()
 * - Threshold alerts via events
 * - JSON log file for post-analysis
 */
export class PerformanceMonitor extends EventEmitter {
  private startTime: number;
  private logFile: fs.WriteStream | null = null;
  private snapshotInterval: NodeJS.Timeout | null = null;

  // Metrics trackers
  private latencyTracker = new LatencyTracker();
  private bytesRate = new RateCalculator(1000);
  private messagesRate = new RateCalculator(1000);
  private extractionsRate = new RateCalculator(1000);
  private routingsRate = new RateCalculator(1000);
  private queueMetrics = new Map<string, QueueMetrics>();

  // Buffer metrics
  private bufferHighWaterMark: number = 0;
  private bufferOverflows: number = 0;

  // Event counters
  private dtrResets: number = 0;
  private rtsResets: number = 0;
  private queueOverflows: number = 0;
  private extractionErrors: number = 0;
  private routingErrors: number = 0;

  // Thresholds
  private thresholds = {
    bufferUsagePercent: 80,
    queueDepth: 500,
    latencyMs: 100
  };

  constructor(logFilePath?: string) {
    super();
    this.startTime = Date.now();

    if (logFilePath) {
      this.initializeLogFile(logFilePath);
    }
  }

  /**
   * Initialize performance log file
   */
  private initializeLogFile(logFilePath: string): void {
    try {
      const dir = path.dirname(logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.logFile = fs.createWriteStream(logFilePath, { flags: 'a' });
      
      // Write header
      this.logEvent({
        timestamp: Date.now(),
        type: 'snapshot',
        component: 'PerformanceMonitor',
        event: 'initialized',
        details: { startTime: this.startTime }
      });
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to initialize log file:', error);
    }
  }

  /**
   * Start periodic snapshots
   */
  public startSnapshots(intervalMs: number = 5000): void {
    this.stopSnapshots();
    
    this.snapshotInterval = setInterval(() => {
      const snapshot = this.getSnapshot();
      this.logEvent({
        timestamp: snapshot.timestamp,
        type: 'snapshot',
        component: 'PerformanceMonitor',
        event: 'periodic',
        details: snapshot
      });
    }, intervalMs);
  }

  /**
   * Stop periodic snapshots
   */
  public stopSnapshots(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  /**
   * Record buffer metrics
   */
  public recordBufferMetrics(usedBytes: number, totalBytes: number): void {
    const usagePercent = (usedBytes / totalBytes) * 100;
    this.bufferHighWaterMark = Math.max(this.bufferHighWaterMark, usagePercent);

    // Check threshold
    if (usagePercent > this.thresholds.bufferUsagePercent) {
      this.logEvent({
        timestamp: Date.now(),
        type: 'threshold',
        component: 'CircularBuffer',
        event: 'high_usage',
        details: { usagePercent, threshold: this.thresholds.bufferUsagePercent }
      });
      this.emit('threshold', { type: 'buffer', usagePercent });
    }
  }

  /**
   * Record buffer overflow
   */
  public recordBufferOverflow(): void {
    this.bufferOverflows++;
    this.logEvent({
      timestamp: Date.now(),
      type: 'overflow',
      component: 'CircularBuffer',
      event: 'overflow',
      details: { totalOverflows: this.bufferOverflows }
    });
  }

  /**
   * Record queue metrics
   */
  public recordQueueMetrics(name: string, depth: number, operation: 'enqueue' | 'dequeue'): void {
    if (!this.queueMetrics.has(name)) {
      this.queueMetrics.set(name, new QueueMetrics());
    }

    const metrics = this.queueMetrics.get(name)!;
    
    if (operation === 'enqueue') {
      metrics.recordEnqueue(depth);
    } else {
      metrics.recordDequeue(depth);
    }

    // Check threshold
    if (depth > this.thresholds.queueDepth) {
      this.logEvent({
        timestamp: Date.now(),
        type: 'threshold',
        component: name,
        event: 'high_depth',
        details: { depth, threshold: this.thresholds.queueDepth }
      });
      this.emit('threshold', { type: 'queue', name, depth });
    }
  }

  /**
   * Record queue overflow
   */
  public recordQueueOverflow(name: string): void {
    this.queueOverflows++;
    this.logEvent({
      timestamp: Date.now(),
      type: 'overflow',
      component: name,
      event: 'overflow',
      details: { totalOverflows: this.queueOverflows }
    });
  }

  /**
   * Record message latency
   */
  public recordMessageLatency(arrivalTime: number, processingTime: number): void {
    const latencyMs = processingTime - arrivalTime;
    this.latencyTracker.addSample(latencyMs);

    // Check threshold
    if (latencyMs > this.thresholds.latencyMs) {
      this.logEvent({
        timestamp: Date.now(),
        type: 'threshold',
        component: 'MessageProcessor',
        event: 'high_latency',
        details: { latencyMs, threshold: this.thresholds.latencyMs }
      });
      this.emit('threshold', { type: 'latency', latencyMs });
    }
  }

  /**
   * Record throughput metrics
   */
  public recordBytes(bytes: number): void {
    this.bytesRate.addSample(bytes);
  }

  public recordMessage(): void {
    this.messagesRate.addSample(1);
  }

  public recordExtraction(): void {
    this.extractionsRate.addSample(1);
  }

  public recordRouting(): void {
    this.routingsRate.addSample(1);
  }

  /**
   * Record reset events
   */
  public recordDTRReset(): void {
    this.dtrResets++;
    this.logEvent({
      timestamp: Date.now(),
      type: 'reset',
      component: 'DTRResetManager',
      event: 'dtr_reset',
      details: { totalResets: this.dtrResets }
    });
  }

  public recordRTSReset(): void {
    this.rtsResets++;
    this.logEvent({
      timestamp: Date.now(),
      type: 'reset',
      component: 'DTRResetManager',
      event: 'rts_reset',
      details: { totalResets: this.rtsResets }
    });
  }

  /**
   * Record errors
   */
  public recordExtractionError(): void {
    this.extractionErrors++;
    this.logEvent({
      timestamp: Date.now(),
      type: 'error',
      component: 'MessageExtractor',
      event: 'extraction_error',
      details: { totalErrors: this.extractionErrors }
    });
  }

  public recordRoutingError(): void {
    this.routingErrors++;
    this.logEvent({
      timestamp: Date.now(),
      type: 'error',
      component: 'MessageRouter',
      event: 'routing_error',
      details: { totalErrors: this.routingErrors }
    });
  }

  /**
   * Get current performance snapshot
   */
  public getSnapshot(): PerformanceSnapshot {
    const now = Date.now();
    const uptimeMs = now - this.startTime;

    // Collect queue metrics
    const queues: any = {};
    for (const [name, metrics] of this.queueMetrics) {
      queues[name] = metrics.getMetrics(0); // Current depth needs to be passed in
    }

    return {
      timestamp: now,
      uptimeMs,
      metrics: {
        bufferUsagePercent: 0, // Needs to be updated by buffer
        bufferHighWaterMark: this.bufferHighWaterMark,
        bufferOverflows: this.bufferOverflows,
        queues,
        messageLatency: this.latencyTracker.getStats(),
        throughput: {
          bytesPerSecond: this.bytesRate.getRate(),
          messagesPerSecond: this.messagesRate.getRate(),
          extractionsPerSecond: this.extractionsRate.getRate(),
          routingsPerSecond: this.routingsRate.getRate()
        },
        events: {
          dtrResets: this.dtrResets,
          rtsResets: this.rtsResets,
          bufferOverflows: this.bufferOverflows,
          queueOverflows: this.queueOverflows,
          extractionErrors: this.extractionErrors,
          routingErrors: this.routingErrors
        }
      }
    };
  }

  /**
   * Log performance event
   */
  private logEvent(event: PerformanceEvent): void {
    if (this.logFile) {
      try {
        this.logFile.write(JSON.stringify(event) + '\n');
      } catch (error) {
        console.error('[PerformanceMonitor] Failed to write log:', error);
      }
    }
  }

  /**
   * Set threshold values
   */
  public setThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.latencyTracker.reset();
    this.bytesRate.reset();
    this.messagesRate.reset();
    this.extractionsRate.reset();
    this.routingsRate.reset();
    this.queueMetrics.clear();

    this.bufferHighWaterMark = 0;
    this.bufferOverflows = 0;
    this.dtrResets = 0;
    this.rtsResets = 0;
    this.queueOverflows = 0;
    this.extractionErrors = 0;
    this.routingErrors = 0;

    this.logEvent({
      timestamp: Date.now(),
      type: 'snapshot',
      component: 'PerformanceMonitor',
      event: 'reset',
      details: {}
    });
  }

  /**
   * Close log file and cleanup
   */
  public close(): void {
    this.stopSnapshots();
    
    if (this.logFile) {
      this.logFile.end();
      this.logFile = null;
    }
  }
}