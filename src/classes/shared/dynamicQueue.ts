/** @format */

// src/classes/shared/dynamicQueue.ts

import { PerformanceMonitor } from './performanceMonitor';

/**
 * DynamicQueue - Self-tuning queue with automatic capacity management
 * 
 * A generic queue that starts small and grows as needed during bursts,
 * then stabilizes at the right size for the workload. Tracks statistics
 * to help identify traffic patterns and bottlenecks.
 * 
 * Key features:
 * - Starts at capacity 10, doubles when needed
 * - Maximum capacity of 1000 to prevent runaway growth
 * - Tracks high water mark and resize count
 * - Returns false on enqueue when max capacity reached
 * - Self-tunes to traffic patterns
 */

export interface QueueStats {
  currentSize: number;
  capacity: number;
  highWaterMark: number;
  resizeCount: number;
  totalEnqueued: number;
  totalDequeued: number;
  droppedCount: number;
  isEmpty: boolean;
  isFull: boolean;
}

export class DynamicQueue<T> {
  private items: T[] = [];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private capacity: number = 10;
  private readonly maxCapacity: number = 1000;
  
  // Statistics
  private highWaterMark: number = 0;
  private resizeCount: number = 0;
  private totalEnqueued: number = 0;
  private totalDequeued: number = 0;
  private droppedCount: number = 0;
  
  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;
  private queueName: string = 'DynamicQueue';

  constructor(initialCapacity: number = 10, maxCapacity: number = 1000, name?: string) {
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
  public setPerformanceMonitor(monitor: PerformanceMonitor, name?: string): void {
    this.performanceMonitor = monitor;
    if (name) {
      this.queueName = name;
    }
  }

  /**
   * Add item to queue, auto-resizing if needed
   * @returns false if max capacity reached and can't enqueue
   */
  public enqueue(item: T): boolean {
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
  }

  /**
   * Remove and return item from queue
   * @returns item or undefined if empty
   */
  public dequeue(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    const item = this.items[this.head];
    this.items[this.head] = undefined as any; // Clear reference for GC
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    this.totalDequeued++;
    
    // Record metrics in performance monitor
    if (this.performanceMonitor) {
      this.performanceMonitor.recordQueueMetrics(this.queueName, this.size, 'dequeue');
    }

    return item;
  }

  /**
   * Peek at next item without removing
   */
  public peek(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    return this.items[this.head];
  }

  /**
   * Resize the queue by doubling capacity
   * @returns false if already at max capacity
   */
  private resize(): boolean {
    if (this.capacity >= this.maxCapacity) {
      return false;
    }

    // Calculate new capacity (double, but don't exceed max)
    const newCapacity = Math.min(this.capacity * 2, this.maxCapacity);
    const newItems = new Array(newCapacity);

    // Copy existing items to new array
    let newIndex = 0;
    let oldIndex = this.head;
    for (let i = 0; i < this.size; i++) {
      newItems[newIndex++] = this.items[oldIndex];
      oldIndex = (oldIndex + 1) % this.capacity;
    }

    // Update queue state
    this.items = newItems;
    this.capacity = newCapacity;
    this.head = 0;
    this.tail = this.size;
    this.resizeCount++;

    console.log(`[DynamicQueue] Resized from ${this.capacity / 2} to ${this.capacity} (resize #${this.resizeCount})`);

    return true;
  }

  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
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
  }

  /**
   * Get current queue size
   */
  public getSize(): number {
    return this.size;
  }

  /**
   * Check if queue is empty
   */
  public isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Check if queue is at max capacity
   */
  public isFull(): boolean {
    return this.size >= this.capacity && this.capacity >= this.maxCapacity;
  }

  /**
   * Clear the queue
   */
  public clear(): void {
    this.items = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    // Don't reset statistics - they're cumulative
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.highWaterMark = this.size; // Current size becomes new baseline
    this.resizeCount = 0;
    this.totalEnqueued = 0;
    this.totalDequeued = 0;
    this.droppedCount = 0;
  }

  /**
   * Get all items as array (for debugging)
   * Does not modify queue
   */
  public toArray(): T[] {
    const result: T[] = [];
    let index = this.head;
    for (let i = 0; i < this.size; i++) {
      result.push(this.items[index]);
      index = (index + 1) % this.capacity;
    }
    return result;
  }

  /**
   * Process items with a callback until empty or callback returns false
   * Useful for batch processing
   */
  public processWhile(callback: (item: T) => boolean): number {
    let processed = 0;
    while (!this.isEmpty()) {
      const item = this.dequeue();
      if (item === undefined) break;
      
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
  }

  /**
   * Get capacity utilization percentage
   */
  public getUtilization(): number {
    return (this.size / this.capacity) * 100;
  }

  /**
   * Check if queue should shrink (optional optimization)
   * Returns true if utilization is low and we've been stable
   */
  public shouldShrink(): boolean {
    // Only shrink if we're using less than 25% and we're above initial capacity
    return this.capacity > 10 && this.getUtilization() < 25;
  }
}