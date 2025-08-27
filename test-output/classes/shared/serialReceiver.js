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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerialReceiver = void 0;
// src/classes/shared/serialReceiver.ts
var events_1 = require("events");
var SerialReceiver = /** @class */ (function (_super) {
    __extends(SerialReceiver, _super);
    function SerialReceiver(buffer) {
        var _this = _super.call(this) || this;
        _this.extractionPending = false;
        _this.extractionCallback = null;
        // Statistics
        _this.totalBytesReceived = 0;
        _this.totalChunksReceived = 0;
        _this.largestChunk = 0;
        _this.bufferOverflows = 0;
        _this.lastReceiveTime = 0;
        // Performance monitoring
        _this.performanceMonitor = null;
        _this.buffer = buffer;
        return _this;
    }
    /**
     * Set performance monitor for instrumentation
     */
    SerialReceiver.prototype.setPerformanceMonitor = function (monitor) {
        this.performanceMonitor = monitor;
    };
    /**
     * Set the extraction callback
     * This will be called asynchronously when data is available
     */
    SerialReceiver.prototype.setExtractionCallback = function (callback) {
        this.extractionCallback = callback;
    };
    /**
     * Receive data from serial port
     * Converts Buffer to Uint8Array and appends to circular buffer
     * Triggers async extraction if not already pending
     */
    SerialReceiver.prototype.receiveData = function (data) {
        var _this = this;
        // Update receive time
        this.lastReceiveTime = Date.now();
        // Update statistics
        this.totalChunksReceived++;
        this.totalBytesReceived += data.length;
        if (data.length > this.largestChunk) {
            this.largestChunk = data.length;
        }
        // Record performance metrics
        if (this.performanceMonitor) {
            this.performanceMonitor.recordBytes(data.length);
        }
        // CRITICAL: Proper Buffer to Uint8Array conversion
        // Must handle offset and length correctly to avoid corruption
        var uint8Data = new Uint8Array(data.buffer, data.byteOffset, data.length);
        // Try to append to buffer
        var appended = this.buffer.appendAtTail(uint8Data);
        if (!appended) {
            // Buffer overflow - data was dropped
            this.bufferOverflows++;
            this.emit('bufferOverflow', {
                droppedBytes: data.length,
                bufferStats: this.buffer.getStats()
            });
            console.error("[SerialReceiver] Buffer overflow! Dropped ".concat(data.length, " bytes"));
            return;
        }
        // Emit data received event for monitoring
        this.emit('dataReceived', {
            bytes: data.length,
            bufferUsed: this.buffer.getUsedSpace(),
            bufferAvailable: this.buffer.getAvailableSpace()
        });
        // Trigger extraction on next tick if not already pending
        if (!this.extractionPending && this.extractionCallback) {
            this.extractionPending = true;
            // Use setImmediate to run on next tick
            // This ensures we return control to serial handler immediately
            setImmediate(function () {
                _this.extractionPending = false;
                // Only trigger if we still have data
                if (_this.buffer.hasData() && _this.extractionCallback) {
                    try {
                        _this.extractionCallback();
                    }
                    catch (error) {
                        console.error('[SerialReceiver] Extraction callback error:', error);
                        _this.emit('extractionError', error);
                    }
                }
            });
        }
    };
    /**
     * Get receiver statistics
     */
    SerialReceiver.prototype.getStats = function () {
        return {
            totalBytesReceived: this.totalBytesReceived,
            totalChunksReceived: this.totalChunksReceived,
            largestChunk: this.largestChunk,
            bufferOverflows: this.bufferOverflows,
            extractionsPending: this.extractionPending ? 1 : 0,
            lastReceiveTime: this.lastReceiveTime
        };
    };
    /**
     * Reset statistics
     */
    SerialReceiver.prototype.resetStats = function () {
        this.totalBytesReceived = 0;
        this.totalChunksReceived = 0;
        this.largestChunk = 0;
        this.bufferOverflows = 0;
    };
    /**
     * Get buffer reference (for testing/monitoring)
     */
    SerialReceiver.prototype.getBuffer = function () {
        return this.buffer;
    };
    /**
     * Check if extraction is pending
     */
    SerialReceiver.prototype.isExtractionPending = function () {
        return this.extractionPending;
    };
    /**
     * Calculate receive rate (bytes per second)
     * @param windowMs Time window in milliseconds
     */
    SerialReceiver.prototype.getReceiveRate = function (windowMs) {
        if (windowMs === void 0) { windowMs = 1000; }
        var now = Date.now();
        var timeSinceLastReceive = now - this.lastReceiveTime;
        if (timeSinceLastReceive > windowMs) {
            return 0; // No recent data
        }
        // Simple approximation - would need ring buffer for accurate windowed rate
        return (this.totalBytesReceived / (now / 1000)) | 0;
    };
    /**
     * Clear the buffer (used for reset scenarios)
     */
    SerialReceiver.prototype.clearBuffer = function () {
        this.buffer.clear();
        this.extractionPending = false;
    };
    return SerialReceiver;
}(events_1.EventEmitter));
exports.SerialReceiver = SerialReceiver;
