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
exports.BatchedMessageQueue = exports.MessageQueue = void 0;
// src/classes/shared/messageQueue.ts
/**
 * MessageQueue - Shared queue management for debug windows
 *
 * Provides consistent message queuing behavior across all debug windows:
 * - Size limits with overflow handling
 * - Age-based message expiration
 * - Performance metrics
 * - Batch processing support
 *
 * This replaces the ad-hoc queuing in debugWindowBase with a robust,
 * tested implementation that all windows can use.
 */
var MessageQueue = /** @class */ (function () {
    /**
     * Create a new message queue
     * @param maxSize Maximum queue size (default 1000)
     * @param maxAgeMs Maximum message age in ms (default 5000ms)
     */
    function MessageQueue(maxSize, maxAgeMs) {
        if (maxSize === void 0) { maxSize = 1000; }
        if (maxAgeMs === void 0) { maxAgeMs = 5000; }
        this.queue = [];
        this.processedCount = 0;
        this.droppedCount = 0;
        this.oldestDroppedAge = 0;
        this.maxSize = maxSize;
        this.maxAgeMs = maxAgeMs;
    }
    /**
     * Add a message to the queue
     * @returns true if queued, false if dropped
     */
    MessageQueue.prototype.enqueue = function (message) {
        // Drop oldest messages if at capacity
        if (this.queue.length >= this.maxSize) {
            var dropped = this.queue.shift();
            if (dropped) {
                this.droppedCount++;
                var age = Date.now() - dropped.timestamp;
                this.oldestDroppedAge = Math.max(this.oldestDroppedAge, age);
            }
        }
        this.queue.push({
            message: message,
            timestamp: Date.now()
        });
        return true;
    };
    /**
     * Get and remove the oldest message
     * @returns Message or undefined if queue is empty
     */
    MessageQueue.prototype.dequeue = function () {
        // Remove expired messages first
        this.removeExpired();
        var item = this.queue.shift();
        if (item) {
            this.processedCount++;
            return item.message;
        }
        return undefined;
    };
    /**
     * Get all messages and clear the queue
     * @param maxBatch Maximum number to return (default all)
     */
    MessageQueue.prototype.dequeueAll = function (maxBatch) {
        // Remove expired messages first
        this.removeExpired();
        var limit = maxBatch !== null && maxBatch !== void 0 ? maxBatch : this.queue.length;
        var batch = [];
        for (var i = 0; i < limit && this.queue.length > 0; i++) {
            var item = this.queue.shift();
            if (item) {
                batch.push(item.message);
                this.processedCount++;
            }
        }
        return batch;
    };
    /**
     * Peek at the oldest message without removing it
     */
    MessageQueue.prototype.peek = function () {
        var _a;
        this.removeExpired();
        return (_a = this.queue[0]) === null || _a === void 0 ? void 0 : _a.message;
    };
    Object.defineProperty(MessageQueue.prototype, "size", {
        /**
         * Get current queue size
         */
        get: function () {
            return this.queue.length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(MessageQueue.prototype, "isEmpty", {
        /**
         * Check if queue is empty
         */
        get: function () {
            return this.queue.length === 0;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(MessageQueue.prototype, "isFull", {
        /**
         * Check if queue is at capacity
         */
        get: function () {
            return this.queue.length >= this.maxSize;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Clear all messages
     */
    MessageQueue.prototype.clear = function () {
        var dropped = this.queue.length;
        this.droppedCount += dropped;
        this.queue = [];
    };
    /**
     * Get queue statistics
     */
    MessageQueue.prototype.getStats = function () {
        var _a, _b;
        var now = Date.now();
        var oldest = (_a = this.queue[0]) === null || _a === void 0 ? void 0 : _a.timestamp;
        var newest = (_b = this.queue[this.queue.length - 1]) === null || _b === void 0 ? void 0 : _b.timestamp;
        return {
            currentSize: this.queue.length,
            maxSize: this.maxSize,
            processedCount: this.processedCount,
            droppedCount: this.droppedCount,
            oldestMessageAge: oldest ? now - oldest : 0,
            newestMessageAge: newest ? now - newest : 0,
            isFull: this.isFull
        };
    };
    /**
     * Remove expired messages based on maxAgeMs
     */
    MessageQueue.prototype.removeExpired = function () {
        if (this.maxAgeMs <= 0)
            return;
        var now = Date.now();
        var cutoff = now - this.maxAgeMs;
        // Find first non-expired message
        var firstValid = 0;
        while (firstValid < this.queue.length && this.queue[firstValid].timestamp < cutoff) {
            firstValid++;
        }
        if (firstValid > 0) {
            // Track dropped messages
            this.droppedCount += firstValid;
            var oldestDropped = this.queue[0].timestamp;
            this.oldestDroppedAge = Math.max(this.oldestDroppedAge, now - oldestDropped);
            // Remove expired messages
            this.queue = this.queue.slice(firstValid);
        }
    };
    /**
     * Reset statistics
     */
    MessageQueue.prototype.resetStats = function () {
        this.processedCount = 0;
        this.droppedCount = 0;
        this.oldestDroppedAge = 0;
    };
    return MessageQueue;
}());
exports.MessageQueue = MessageQueue;
/**
 * BatchedMessageQueue - Enhanced queue with automatic batch processing
 *
 * Extends MessageQueue to automatically process messages in batches
 * at regular intervals, ideal for high-throughput scenarios.
 */
var BatchedMessageQueue = /** @class */ (function (_super) {
    __extends(BatchedMessageQueue, _super);
    function BatchedMessageQueue(maxSize, maxAgeMs, batchIntervalMs, // 60fps
    batchSize) {
        if (maxSize === void 0) { maxSize = 1000; }
        if (maxAgeMs === void 0) { maxAgeMs = 5000; }
        if (batchIntervalMs === void 0) { batchIntervalMs = 16; }
        if (batchSize === void 0) { batchSize = 100; }
        var _this = _super.call(this, maxSize, maxAgeMs) || this;
        _this.batchTimer = null;
        _this.batchIntervalMs = batchIntervalMs;
        _this.batchSize = batchSize;
        return _this;
    }
    /**
     * Set the batch processor callback
     */
    BatchedMessageQueue.prototype.setBatchProcessor = function (processor) {
        this.batchProcessor = processor;
    };
    /**
     * Override enqueue to trigger batch processing
     */
    BatchedMessageQueue.prototype.enqueue = function (message) {
        var _this = this;
        var result = _super.prototype.enqueue.call(this, message);
        // Schedule batch processing if not already scheduled
        if (!this.batchTimer && this.batchProcessor) {
            this.batchTimer = setTimeout(function () { return _this.processBatch(); }, this.batchIntervalMs);
        }
        // Force immediate processing if queue is getting full
        if (this.size >= this.batchSize * 0.8 && this.batchProcessor) {
            this.processBatch();
        }
        return result;
    };
    /**
     * Process a batch of messages
     */
    BatchedMessageQueue.prototype.processBatch = function () {
        var _this = this;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        if (!this.batchProcessor || this.isEmpty)
            return;
        var batch = this.dequeueAll(this.batchSize);
        if (batch.length > 0) {
            this.batchProcessor(batch);
        }
        // Schedule next batch if more messages remain
        if (!this.isEmpty) {
            this.batchTimer = setTimeout(function () { return _this.processBatch(); }, this.batchIntervalMs);
        }
    };
    /**
     * Stop batch processing
     */
    BatchedMessageQueue.prototype.stopBatchProcessing = function () {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
    };
    /**
     * Clear queue and stop processing
     */
    BatchedMessageQueue.prototype.clear = function () {
        this.stopBatchProcessing();
        _super.prototype.clear.call(this);
    };
    return BatchedMessageQueue;
}(MessageQueue));
exports.BatchedMessageQueue = BatchedMessageQueue;
