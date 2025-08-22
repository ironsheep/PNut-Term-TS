/** @format */

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
export class MessageQueue<T = any> {
  private queue: Array<{message: T, timestamp: number}> = [];
  private readonly maxSize: number;
  private readonly maxAgeMs: number;
  private processedCount: number = 0;
  private droppedCount: number = 0;
  private oldestDroppedAge: number = 0;

  /**
   * Create a new message queue
   * @param maxSize Maximum queue size (default 1000)
   * @param maxAgeMs Maximum message age in ms (default 5000ms)
   */
  constructor(maxSize: number = 1000, maxAgeMs: number = 5000) {
    this.maxSize = maxSize;
    this.maxAgeMs = maxAgeMs;
  }

  /**
   * Add a message to the queue
   * @returns true if queued, false if dropped
   */
  enqueue(message: T): boolean {
    // Drop oldest messages if at capacity
    if (this.queue.length >= this.maxSize) {
      const dropped = this.queue.shift();
      if (dropped) {
        this.droppedCount++;
        const age = Date.now() - dropped.timestamp;
        this.oldestDroppedAge = Math.max(this.oldestDroppedAge, age);
      }
    }

    this.queue.push({
      message: message,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Get and remove the oldest message
   * @returns Message or undefined if queue is empty
   */
  dequeue(): T | undefined {
    // Remove expired messages first
    this.removeExpired();
    
    const item = this.queue.shift();
    if (item) {
      this.processedCount++;
      return item.message;
    }
    return undefined;
  }

  /**
   * Get all messages and clear the queue
   * @param maxBatch Maximum number to return (default all)
   */
  dequeueAll(maxBatch?: number): T[] {
    // Remove expired messages first
    this.removeExpired();
    
    const limit = maxBatch ?? this.queue.length;
    const batch: T[] = [];
    
    for (let i = 0; i < limit && this.queue.length > 0; i++) {
      const item = this.queue.shift();
      if (item) {
        batch.push(item.message);
        this.processedCount++;
      }
    }
    
    return batch;
  }

  /**
   * Peek at the oldest message without removing it
   */
  peek(): T | undefined {
    this.removeExpired();
    return this.queue[0]?.message;
  }

  /**
   * Get current queue size
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is at capacity
   */
  get isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  /**
   * Clear all messages
   */
  clear(): void {
    const dropped = this.queue.length;
    this.droppedCount += dropped;
    this.queue = [];
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    currentSize: number;
    maxSize: number;
    processedCount: number;
    droppedCount: number;
    oldestMessageAge: number;
    newestMessageAge: number;
    isFull: boolean;
  } {
    const now = Date.now();
    const oldest = this.queue[0]?.timestamp;
    const newest = this.queue[this.queue.length - 1]?.timestamp;
    
    return {
      currentSize: this.queue.length,
      maxSize: this.maxSize,
      processedCount: this.processedCount,
      droppedCount: this.droppedCount,
      oldestMessageAge: oldest ? now - oldest : 0,
      newestMessageAge: newest ? now - newest : 0,
      isFull: this.isFull
    };
  }

  /**
   * Remove expired messages based on maxAgeMs
   */
  private removeExpired(): void {
    if (this.maxAgeMs <= 0) return;
    
    const now = Date.now();
    const cutoff = now - this.maxAgeMs;
    
    // Find first non-expired message
    let firstValid = 0;
    while (firstValid < this.queue.length && this.queue[firstValid].timestamp < cutoff) {
      firstValid++;
    }
    
    if (firstValid > 0) {
      // Track dropped messages
      this.droppedCount += firstValid;
      const oldestDropped = this.queue[0].timestamp;
      this.oldestDroppedAge = Math.max(this.oldestDroppedAge, now - oldestDropped);
      
      // Remove expired messages
      this.queue = this.queue.slice(firstValid);
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.processedCount = 0;
    this.droppedCount = 0;
    this.oldestDroppedAge = 0;
  }
}

/**
 * BatchedMessageQueue - Enhanced queue with automatic batch processing
 * 
 * Extends MessageQueue to automatically process messages in batches
 * at regular intervals, ideal for high-throughput scenarios.
 */
export class BatchedMessageQueue<T = any> extends MessageQueue<T> {
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchIntervalMs: number;
  private readonly batchSize: number;
  private batchProcessor?: (messages: T[]) => void;

  constructor(
    maxSize: number = 1000, 
    maxAgeMs: number = 5000,
    batchIntervalMs: number = 16, // 60fps
    batchSize: number = 100
  ) {
    super(maxSize, maxAgeMs);
    this.batchIntervalMs = batchIntervalMs;
    this.batchSize = batchSize;
  }

  /**
   * Set the batch processor callback
   */
  setBatchProcessor(processor: (messages: T[]) => void): void {
    this.batchProcessor = processor;
  }

  /**
   * Override enqueue to trigger batch processing
   */
  enqueue(message: T): boolean {
    const result = super.enqueue(message);
    
    // Schedule batch processing if not already scheduled
    if (!this.batchTimer && this.batchProcessor) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.batchIntervalMs);
    }
    
    // Force immediate processing if queue is getting full
    if (this.size >= this.batchSize * 0.8 && this.batchProcessor) {
      this.processBatch();
    }
    
    return result;
  }

  /**
   * Process a batch of messages
   */
  private processBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (!this.batchProcessor || this.isEmpty) return;
    
    const batch = this.dequeueAll(this.batchSize);
    if (batch.length > 0) {
      this.batchProcessor(batch);
    }
    
    // Schedule next batch if more messages remain
    if (!this.isEmpty) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.batchIntervalMs);
    }
  }

  /**
   * Stop batch processing
   */
  stopBatchProcessing(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Clear queue and stop processing
   */
  clear(): void {
    this.stopBatchProcessing();
    super.clear();
  }
}