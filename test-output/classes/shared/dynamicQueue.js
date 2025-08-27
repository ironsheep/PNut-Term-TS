"use strict";
/** @format */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicQueue = void 0;
var DynamicQueue = /** @class */ (function () {
    function DynamicQueue(initialCapacity, maxCapacity, name) {
        if (initialCapacity === void 0) { initialCapacity = 10; }
        if (maxCapacity === void 0) { maxCapacity = 1000; }
        this.items = [];
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.capacity = 10;
        this.maxCapacity = 1000;
        // Statistics
        this.highWaterMark = 0;
        this.resizeCount = 0;
        this.totalEnqueued = 0;
        this.totalDequeued = 0;
        this.droppedCount = 0;
        // Performance monitoring
        this.performanceMonitor = null;
        this.queueName = 'DynamicQueue';
        this.capacity = Math.min(initialCapacity, maxCapacity);
        this.maxCapacity = maxCapacity;
        this.items = new Array(this.capacity);
        if (name) {
            this.queueName = name;
        }
    }
    /**
     * Set performance monitor for instrumentation
     */
    DynamicQueue.prototype.setPerformanceMonitor = function (monitor, name) {
        this.performanceMonitor = monitor;
        if (name) {
            this.queueName = name;
        }
    };
    /**
     * Add item to queue, auto-resizing if needed
     * @returns false if max capacity reached and can't enqueue
     */
    DynamicQueue.prototype.enqueue = function (item) {
        // Check if we need to resize
        if (this.size >= this.capacity) {
            if (!this.resize()) {
                // Can't resize further, drop the item
                this.droppedCount++;
                // Record overflow in performance monitor
                if (this.performanceMonitor) {
                    this.performanceMonitor.recordQueueOverflow(this.queueName);
                }
                return false;
            }
        }
        // Add item at tail
        this.items[this.tail] = item;
        this.tail = (this.tail + 1) % this.capacity;
        this.size++;
        this.totalEnqueued++;
        // Update high water mark
        if (this.size > this.highWaterMark) {
            this.highWaterMark = this.size;
        }
        // Record metrics in performance monitor
        if (this.performanceMonitor) {
            this.performanceMonitor.recordQueueMetrics(this.queueName, this.size, 'enqueue');
        }
        return true;
    };
    /**
     * Remove and return item from queue
     * @returns item or undefined if empty
     */
    DynamicQueue.prototype.dequeue = function () {
        if (this.size === 0) {
            return undefined;
        }
        var item = this.items[this.head];
        this.items[this.head] = undefined; // Clear reference for GC
        this.head = (this.head + 1) % this.capacity;
        this.size--;
        this.totalDequeued++;
        // Record metrics in performance monitor
        if (this.performanceMonitor) {
            this.performanceMonitor.recordQueueMetrics(this.queueName, this.size, 'dequeue');
        }
        return item;
    };
    /**
     * Peek at next item without removing
     */
    DynamicQueue.prototype.peek = function () {
        if (this.size === 0) {
            return undefined;
        }
        return this.items[this.head];
    };
    /**
     * Resize the queue by doubling capacity
     * @returns false if already at max capacity
     */
    DynamicQueue.prototype.resize = function () {
        if (this.capacity >= this.maxCapacity) {
            return false;
        }
        // Calculate new capacity (double, but don't exceed max)
        var newCapacity = Math.min(this.capacity * 2, this.maxCapacity);
        var newItems = new Array(newCapacity);
        // Copy existing items to new array
        var newIndex = 0;
        var oldIndex = this.head;
        for (var i = 0; i < this.size; i++) {
            newItems[newIndex++] = this.items[oldIndex];
            oldIndex = (oldIndex + 1) % this.capacity;
        }
        // Update queue state
        this.items = newItems;
        this.capacity = newCapacity;
        this.head = 0;
        this.tail = this.size;
        this.resizeCount++;
        console.log("[DynamicQueue] Resized from ".concat(this.capacity / 2, " to ").concat(this.capacity, " (resize #").concat(this.resizeCount, ")"));
        return true;
    };
    /**
     * Get queue statistics
     */
    DynamicQueue.prototype.getStats = function () {
        return {
            currentSize: this.size,
            capacity: this.capacity,
            highWaterMark: this.highWaterMark,
            resizeCount: this.resizeCount,
            totalEnqueued: this.totalEnqueued,
            totalDequeued: this.totalDequeued,
            droppedCount: this.droppedCount,
            isEmpty: this.size === 0,
            isFull: this.size >= this.capacity && this.capacity >= this.maxCapacity
        };
    };
    /**
     * Get current queue size
     */
    DynamicQueue.prototype.getSize = function () {
        return this.size;
    };
    /**
     * Check if queue is empty
     */
    DynamicQueue.prototype.isEmpty = function () {
        return this.size === 0;
    };
    /**
     * Check if queue is at max capacity
     */
    DynamicQueue.prototype.isFull = function () {
        return this.size >= this.capacity && this.capacity >= this.maxCapacity;
    };
    /**
     * Clear the queue
     */
    DynamicQueue.prototype.clear = function () {
        this.items = new Array(this.capacity);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        // Don't reset statistics - they're cumulative
    };
    /**
     * Reset statistics
     */
    DynamicQueue.prototype.resetStats = function () {
        this.highWaterMark = this.size; // Current size becomes new baseline
        this.resizeCount = 0;
        this.totalEnqueued = 0;
        this.totalDequeued = 0;
        this.droppedCount = 0;
    };
    /**
     * Get all items as array (for debugging)
     * Does not modify queue
     */
    DynamicQueue.prototype.toArray = function () {
        var result = [];
        var index = this.head;
        for (var i = 0; i < this.size; i++) {
            result.push(this.items[index]);
            index = (index + 1) % this.capacity;
        }
        return result;
    };
    /**
     * Process items with a callback until empty or callback returns false
     * Useful for batch processing
     */
    DynamicQueue.prototype.processWhile = function (callback) {
        var processed = 0;
        while (!this.isEmpty()) {
            var item = this.dequeue();
            if (item === undefined)
                break;
            if (!callback(item)) {
                // Put it back if callback returns false
                // This is a bit tricky with circular buffer...
                // We'll add it to the tail again
                this.enqueue(item);
                break;
            }
            processed++;
        }
        return processed;
    };
    /**
     * Get capacity utilization percentage
     */
    DynamicQueue.prototype.getUtilization = function () {
        return (this.size / this.capacity) * 100;
    };
    /**
     * Check if queue should shrink (optional optimization)
     * Returns true if utilization is low and we've been stable
     */
    DynamicQueue.prototype.shouldShrink = function () {
        // Only shrink if we're using less than 25% and we're above initial capacity
        return this.capacity > 10 && this.getUtilization() < 25;
    };
    return DynamicQueue;
}());
exports.DynamicQueue = DynamicQueue;
