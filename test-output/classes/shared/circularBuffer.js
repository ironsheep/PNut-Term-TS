"use strict";
/** @format */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircularBuffer = exports.NextStatus = void 0;
/**
 * CircularBuffer - Pure byte storage container with wrap-around handling
 *
 * CLASS PURPOSE: Raw byte storage and retrieval - nothing more, nothing less
 *
 * WHAT THIS CLASS DOES:
 * - Stores bytes in a fixed-size circular buffer
 * - Provides transparent wrap-around via next() pattern
 * - Handles space management and boundary conditions
 * - Offers consume/save/restore operations for parsing layers
 *
 * WHAT THIS CLASS DOES NOT DO:
 * - No message parsing or protocol knowledge
 * - No EOL detection or text interpretation
 * - No data transformation or filtering
 * - No routing or business logic decisions
 * - NO LOOK-AHEAD: No peeking operations (architectural violation)
 *
 * BOUNDARIES: If you're tempted to add "smart" behavior, it belongs in a higher layer!
 * Message parsing/extraction should consume FROM this buffer, not be IN this buffer.
 * Pattern matching and validation belong in MessageExtractor, not here.
 *
 * Key features:
 * - Configurable buffer size (default 1MB for P2 2Mbps data rates)
 * - Never reallocates - fixed size
 * - Transparent wrap-around handling
 * - Position save/restore for parsing backtrack scenarios
 * - Atomic space checking on append
 * - Performance instrumentation hooks
 */
var NextStatus;
(function (NextStatus) {
    NextStatus["DATA"] = "DATA";
    NextStatus["EMPTY"] = "EMPTY";
})(NextStatus || (exports.NextStatus = NextStatus = {}));
var CircularBuffer = /** @class */ (function () {
    function CircularBuffer(bufferSize) {
        if (bufferSize === void 0) { bufferSize = 1048576; }
        this.head = 0; // Read position
        this.tail = 0; // Write position
        this.isEmpty = true;
        // Saved positions for restore
        this.savedPositions = [];
        // Performance monitoring
        this.performanceMonitor = null;
        this.highWaterMark = 0;
        this.bufferSize = bufferSize;
        this.buffer = new Uint8Array(this.bufferSize);
    }
    /**
     * Set performance monitor for instrumentation
     */
    CircularBuffer.prototype.setPerformanceMonitor = function (monitor) {
        this.performanceMonitor = monitor;
    };
    /**
     * Get buffer size for testing purposes
     */
    CircularBuffer.prototype.getBufferSize = function () {
        return this.bufferSize;
    };
    /**
     * Append data to tail of buffer
     * @returns false if insufficient space
     */
    CircularBuffer.prototype.appendAtTail = function (data) {
        var dataLength = data.length;
        // Check available space
        var available = this.getAvailableSpace();
        if (dataLength > available) {
            // Record overflow
            if (this.performanceMonitor) {
                this.performanceMonitor.recordBufferOverflow();
            }
            return false;
        }
        // Copy data, handling wrap-around
        for (var i = 0; i < dataLength; i++) {
            this.buffer[this.tail] = data[i];
            this.tail = (this.tail + 1) % this.bufferSize;
        }
        this.isEmpty = false;
        // Update performance metrics
        if (this.performanceMonitor) {
            var used = this.getUsedSpace();
            this.highWaterMark = Math.max(this.highWaterMark, used);
            this.performanceMonitor.recordBufferMetrics(used, this.bufferSize);
        }
        return true;
    };
    /**
     * Get next byte from buffer
     * Completely abstracts wrap-around from consumer
     */
    CircularBuffer.prototype.next = function () {
        // Check if buffer is empty
        if (this.isEmpty) {
            return { status: NextStatus.EMPTY };
        }
        // Get current byte and advance position
        var value = this.buffer[this.head];
        this.head = (this.head + 1) % this.bufferSize;
        // Check if we've consumed all data
        if (this.head === this.tail) {
            this.isEmpty = true;
        }
        return { status: NextStatus.DATA, value: value };
    };
    /**
     * Save current position for later restore
     */
    CircularBuffer.prototype.savePosition = function () {
        this.savedPositions.push(this.head);
    };
    /**
     * Restore to last saved position
     */
    CircularBuffer.prototype.restorePosition = function () {
        if (this.savedPositions.length === 0) {
            return false;
        }
        var pos = this.savedPositions.pop();
        this.head = pos;
        // Recalculate isEmpty
        this.isEmpty = (this.head === this.tail);
        return true;
    };
    /**
     * Get available space in buffer
     */
    CircularBuffer.prototype.getAvailableSpace = function () {
        if (this.isEmpty) {
            return this.bufferSize; // Completely empty
        }
        // Check for full buffer condition
        if (this.head === this.tail) {
            return 0; // Buffer is full
        }
        if (this.tail > this.head) {
            // Free space = buffer size - used space
            return this.bufferSize - (this.tail - this.head);
        }
        else {
            // Free space = gap between head and tail
            return this.head - this.tail;
        }
    };
    /**
     * Get used space in buffer
     */
    CircularBuffer.prototype.getUsedSpace = function () {
        if (this.isEmpty) {
            return 0;
        }
        // Check for full buffer condition
        if (this.head === this.tail) {
            return this.bufferSize; // Buffer is full
        }
        if (this.tail > this.head) {
            return this.tail - this.head;
        }
        else {
            return this.bufferSize - this.head + this.tail;
        }
    };
    /**
     * Clear the buffer
     */
    CircularBuffer.prototype.clear = function () {
        this.head = 0;
        this.tail = 0;
        this.isEmpty = true;
        this.savedPositions = [];
    };
    /**
     * Check if buffer has data
     */
    CircularBuffer.prototype.hasData = function () {
        return !this.isEmpty;
    };
    /**
     * Get buffer statistics
     */
    CircularBuffer.prototype.getStats = function () {
        var used = this.getUsedSpace();
        var usagePercent = (used / this.bufferSize) * 100;
        return {
            size: this.bufferSize,
            used: used,
            available: this.getAvailableSpace(),
            head: this.head,
            tail: this.tail,
            isEmpty: this.isEmpty,
            usagePercent: usagePercent,
            highWaterMark: this.highWaterMark
        };
    };
    /**
     * Consume N bytes from head
     * Returns false if not enough bytes available
     */
    CircularBuffer.prototype.consume = function (count) {
        if (count <= 0)
            return true;
        var available = this.getUsedSpace();
        if (count > available)
            return false;
        this.head = (this.head + count) % this.bufferSize;
        if (this.head === this.tail) {
            this.isEmpty = true;
        }
        return true;
    };
    return CircularBuffer;
}());
exports.CircularBuffer = CircularBuffer;
