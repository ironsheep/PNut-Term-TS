"use strict";
/** @format */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = void 0;
// src/classes/shared/performanceMonitor.ts
var events_1 = require("events");
var fs = require("fs");
var path = require("path");
/**
 * Latency tracker for percentile calculations
 */
var LatencyTracker = /** @class */ (function () {
    function LatencyTracker() {
        this.samples = [];
        this.maxSamples = 1000;
        this.sum = 0;
        this.count = 0;
        this.min = Number.MAX_VALUE;
        this.max = 0;
    }
    /**
     * Add a latency sample
     */
    LatencyTracker.prototype.addSample = function (latencyMs) {
        this.samples.push(latencyMs);
        if (this.samples.length > this.maxSamples) {
            var removed = this.samples.shift();
            this.sum -= removed;
            this.count--;
        }
        this.sum += latencyMs;
        this.count++;
        this.min = Math.min(this.min, latencyMs);
        this.max = Math.max(this.max, latencyMs);
    };
    /**
     * Get percentile value
     */
    LatencyTracker.prototype.getPercentile = function (percentile) {
        if (this.samples.length === 0)
            return 0;
        var sorted = __spreadArray([], this.samples, true).sort(function (a, b) { return a - b; });
        var index = Math.floor((percentile / 100) * sorted.length);
        return sorted[Math.min(index, sorted.length - 1)];
    };
    /**
     * Get statistics
     */
    LatencyTracker.prototype.getStats = function () {
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
    };
    /**
     * Reset tracker
     */
    LatencyTracker.prototype.reset = function () {
        this.samples = [];
        this.sum = 0;
        this.count = 0;
        this.min = Number.MAX_VALUE;
        this.max = 0;
    };
    return LatencyTracker;
}());
/**
 * Rate calculator for throughput metrics
 */
var RateCalculator = /** @class */ (function () {
    function RateCalculator(windowMs) {
        if (windowMs === void 0) { windowMs = 1000; }
        this.samples = [];
        this.windowMs = windowMs;
    }
    /**
     * Add a sample
     */
    RateCalculator.prototype.addSample = function (value) {
        var now = Date.now();
        this.samples.push({ timestamp: now, value: value });
        // Remove old samples
        var cutoff = now - this.windowMs;
        this.samples = this.samples.filter(function (s) { return s.timestamp > cutoff; });
    };
    /**
     * Get current rate
     */
    RateCalculator.prototype.getRate = function () {
        var now = Date.now();
        var cutoff = now - this.windowMs;
        var recentSamples = this.samples.filter(function (s) { return s.timestamp > cutoff; });
        var sum = recentSamples.reduce(function (acc, s) { return acc + s.value; }, 0);
        return (sum / this.windowMs) * 1000; // Convert to per second
    };
    /**
     * Reset calculator
     */
    RateCalculator.prototype.reset = function () {
        this.samples = [];
    };
    return RateCalculator;
}());
/**
 * Queue metrics tracker
 */
var QueueMetrics = /** @class */ (function () {
    function QueueMetrics() {
        this.totalEnqueued = 0;
        this.totalDequeued = 0;
        this.highWaterMark = 0;
        this.depthSamples = [];
        this.maxSamples = 100;
    }
    /**
     * Record enqueue
     */
    QueueMetrics.prototype.recordEnqueue = function (newDepth) {
        this.totalEnqueued++;
        this.updateDepth(newDepth);
    };
    /**
     * Record dequeue
     */
    QueueMetrics.prototype.recordDequeue = function (newDepth) {
        this.totalDequeued++;
        this.updateDepth(newDepth);
    };
    /**
     * Update depth tracking
     */
    QueueMetrics.prototype.updateDepth = function (depth) {
        this.highWaterMark = Math.max(this.highWaterMark, depth);
        this.depthSamples.push(depth);
        if (this.depthSamples.length > this.maxSamples) {
            this.depthSamples.shift();
        }
    };
    /**
     * Get current metrics
     */
    QueueMetrics.prototype.getMetrics = function (currentDepth) {
        var avgDepth = this.depthSamples.length > 0
            ? this.depthSamples.reduce(function (a, b) { return a + b; }, 0) / this.depthSamples.length
            : 0;
        return {
            currentDepth: currentDepth,
            highWaterMark: this.highWaterMark,
            totalEnqueued: this.totalEnqueued,
            totalDequeued: this.totalDequeued,
            avgDepth: avgDepth
        };
    };
    /**
     * Reset metrics
     */
    QueueMetrics.prototype.reset = function () {
        this.totalEnqueued = 0;
        this.totalDequeued = 0;
        this.highWaterMark = 0;
        this.depthSamples = [];
    };
    return QueueMetrics;
}());
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
var PerformanceMonitor = /** @class */ (function (_super) {
    __extends(PerformanceMonitor, _super);
    function PerformanceMonitor(logFilePath) {
        var _this = _super.call(this) || this;
        _this.logFile = null;
        _this.snapshotInterval = null;
        // Metrics trackers
        _this.latencyTracker = new LatencyTracker();
        _this.bytesRate = new RateCalculator(1000);
        _this.messagesRate = new RateCalculator(1000);
        _this.extractionsRate = new RateCalculator(1000);
        _this.routingsRate = new RateCalculator(1000);
        _this.queueMetrics = new Map();
        // Buffer metrics
        _this.bufferHighWaterMark = 0;
        _this.bufferOverflows = 0;
        // Event counters
        _this.dtrResets = 0;
        _this.rtsResets = 0;
        _this.queueOverflows = 0;
        _this.extractionErrors = 0;
        _this.routingErrors = 0;
        // Thresholds
        _this.thresholds = {
            bufferUsagePercent: 80,
            queueDepth: 500,
            latencyMs: 100
        };
        _this.startTime = Date.now();
        if (logFilePath) {
            _this.initializeLogFile(logFilePath);
        }
        return _this;
    }
    /**
     * Initialize performance log file
     */
    PerformanceMonitor.prototype.initializeLogFile = function (logFilePath) {
        try {
            var dir = path.dirname(logFilePath);
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
        }
        catch (error) {
            console.error('[PerformanceMonitor] Failed to initialize log file:', error);
        }
    };
    /**
     * Start periodic snapshots
     */
    PerformanceMonitor.prototype.startSnapshots = function (intervalMs) {
        var _this = this;
        if (intervalMs === void 0) { intervalMs = 5000; }
        this.stopSnapshots();
        this.snapshotInterval = setInterval(function () {
            var snapshot = _this.getSnapshot();
            _this.logEvent({
                timestamp: snapshot.timestamp,
                type: 'snapshot',
                component: 'PerformanceMonitor',
                event: 'periodic',
                details: snapshot
            });
        }, intervalMs);
    };
    /**
     * Stop periodic snapshots
     */
    PerformanceMonitor.prototype.stopSnapshots = function () {
        if (this.snapshotInterval) {
            clearInterval(this.snapshotInterval);
            this.snapshotInterval = null;
        }
    };
    /**
     * Record buffer metrics
     */
    PerformanceMonitor.prototype.recordBufferMetrics = function (usedBytes, totalBytes) {
        var usagePercent = (usedBytes / totalBytes) * 100;
        this.bufferHighWaterMark = Math.max(this.bufferHighWaterMark, usagePercent);
        // Check threshold
        if (usagePercent > this.thresholds.bufferUsagePercent) {
            this.logEvent({
                timestamp: Date.now(),
                type: 'threshold',
                component: 'CircularBuffer',
                event: 'high_usage',
                details: { usagePercent: usagePercent, threshold: this.thresholds.bufferUsagePercent }
            });
            this.emit('threshold', { type: 'buffer', usagePercent: usagePercent });
        }
    };
    /**
     * Record buffer overflow
     */
    PerformanceMonitor.prototype.recordBufferOverflow = function () {
        this.bufferOverflows++;
        this.logEvent({
            timestamp: Date.now(),
            type: 'overflow',
            component: 'CircularBuffer',
            event: 'overflow',
            details: { totalOverflows: this.bufferOverflows }
        });
    };
    /**
     * Record queue metrics
     */
    PerformanceMonitor.prototype.recordQueueMetrics = function (name, depth, operation) {
        if (!this.queueMetrics.has(name)) {
            this.queueMetrics.set(name, new QueueMetrics());
        }
        var metrics = this.queueMetrics.get(name);
        if (operation === 'enqueue') {
            metrics.recordEnqueue(depth);
        }
        else {
            metrics.recordDequeue(depth);
        }
        // Check threshold
        if (depth > this.thresholds.queueDepth) {
            this.logEvent({
                timestamp: Date.now(),
                type: 'threshold',
                component: name,
                event: 'high_depth',
                details: { depth: depth, threshold: this.thresholds.queueDepth }
            });
            this.emit('threshold', { type: 'queue', name: name, depth: depth });
        }
    };
    /**
     * Record queue overflow
     */
    PerformanceMonitor.prototype.recordQueueOverflow = function (name) {
        this.queueOverflows++;
        this.logEvent({
            timestamp: Date.now(),
            type: 'overflow',
            component: name,
            event: 'overflow',
            details: { totalOverflows: this.queueOverflows }
        });
    };
    /**
     * Record message latency
     */
    PerformanceMonitor.prototype.recordMessageLatency = function (arrivalTime, processingTime) {
        var latencyMs = processingTime - arrivalTime;
        this.latencyTracker.addSample(latencyMs);
        // Check threshold
        if (latencyMs > this.thresholds.latencyMs) {
            this.logEvent({
                timestamp: Date.now(),
                type: 'threshold',
                component: 'MessageProcessor',
                event: 'high_latency',
                details: { latencyMs: latencyMs, threshold: this.thresholds.latencyMs }
            });
            this.emit('threshold', { type: 'latency', latencyMs: latencyMs });
        }
    };
    /**
     * Record throughput metrics
     */
    PerformanceMonitor.prototype.recordBytes = function (bytes) {
        this.bytesRate.addSample(bytes);
    };
    PerformanceMonitor.prototype.recordMessage = function () {
        this.messagesRate.addSample(1);
    };
    PerformanceMonitor.prototype.recordExtraction = function () {
        this.extractionsRate.addSample(1);
    };
    PerformanceMonitor.prototype.recordRouting = function () {
        this.routingsRate.addSample(1);
    };
    /**
     * Record reset events
     */
    PerformanceMonitor.prototype.recordDTRReset = function () {
        this.dtrResets++;
        this.logEvent({
            timestamp: Date.now(),
            type: 'reset',
            component: 'DTRResetManager',
            event: 'dtr_reset',
            details: { totalResets: this.dtrResets }
        });
    };
    PerformanceMonitor.prototype.recordRTSReset = function () {
        this.rtsResets++;
        this.logEvent({
            timestamp: Date.now(),
            type: 'reset',
            component: 'DTRResetManager',
            event: 'rts_reset',
            details: { totalResets: this.rtsResets }
        });
    };
    /**
     * Record errors
     */
    PerformanceMonitor.prototype.recordExtractionError = function () {
        this.extractionErrors++;
        this.logEvent({
            timestamp: Date.now(),
            type: 'error',
            component: 'MessageExtractor',
            event: 'extraction_error',
            details: { totalErrors: this.extractionErrors }
        });
    };
    PerformanceMonitor.prototype.recordRoutingError = function () {
        this.routingErrors++;
        this.logEvent({
            timestamp: Date.now(),
            type: 'error',
            component: 'MessageRouter',
            event: 'routing_error',
            details: { totalErrors: this.routingErrors }
        });
    };
    /**
     * Get current performance snapshot
     */
    PerformanceMonitor.prototype.getSnapshot = function () {
        var now = Date.now();
        var uptimeMs = now - this.startTime;
        // Collect queue metrics
        var queues = {};
        for (var _i = 0, _a = this.queueMetrics; _i < _a.length; _i++) {
            var _b = _a[_i], name_1 = _b[0], metrics = _b[1];
            queues[name_1] = metrics.getMetrics(0); // Current depth needs to be passed in
        }
        return {
            timestamp: now,
            uptimeMs: uptimeMs,
            metrics: {
                bufferUsagePercent: 0, // Needs to be updated by buffer
                bufferHighWaterMark: this.bufferHighWaterMark,
                bufferOverflows: this.bufferOverflows,
                queues: queues,
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
    };
    /**
     * Log performance event
     */
    PerformanceMonitor.prototype.logEvent = function (event) {
        if (this.logFile) {
            try {
                this.logFile.write(JSON.stringify(event) + '\n');
            }
            catch (error) {
                console.error('[PerformanceMonitor] Failed to write log:', error);
            }
        }
    };
    /**
     * Set threshold values
     */
    PerformanceMonitor.prototype.setThresholds = function (thresholds) {
        this.thresholds = __assign(__assign({}, this.thresholds), thresholds);
    };
    /**
     * Reset all metrics
     */
    PerformanceMonitor.prototype.reset = function () {
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
    };
    /**
     * Close log file and cleanup
     */
    PerformanceMonitor.prototype.close = function () {
        this.stopSnapshots();
        if (this.logFile) {
            this.logFile.end();
            this.logFile = null;
        }
    };
    return PerformanceMonitor;
}(events_1.EventEmitter));
exports.PerformanceMonitor = PerformanceMonitor;
