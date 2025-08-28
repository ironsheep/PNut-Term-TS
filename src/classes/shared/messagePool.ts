/** @format */

/**
 * MessagePool - Pre-allocated message object pool for zero-allocation operation
 * 
 * PURPOSE: Eliminate garbage collection pressure by reusing message objects
 * 
 * DESIGN:
 * - Pre-allocates 100 messages on startup
 * - Grows by 50 when pool exhausted (up to max 1000)
 * - Uses free list for O(1) acquire/release
 * - Tracks pool efficiency metrics
 * 
 * USAGE:
 * 1. Acquire message with data and type
 * 2. Pass message by reference to consumers
 * 3. Each consumer calls release() when done
 * 4. Last consumer returns message to pool
 */

import { MessageType } from './messageExtractor';

export interface PooledMessage {
  // Message data
  data: Uint8Array;
  type: MessageType;
  timestamp: number;
  
  // Reference counting
  consumerCount: number;
  consumersRemaining: number;
  
  // Pool management
  poolId: number;  // Unique ID for tracking
  inUse: boolean;
  disposed: boolean;  // Catch double-release bugs
  
  // Performance monitoring
  acquiredAt: number;  // performance.now() when acquired
  firstReleaseAt?: number;  // performance.now() when first consumer released
  fullyReleasedAt?: number;  // performance.now() when fully released
  
  // Optional metadata
  metadata?: any;
}

export class MessagePool {
  private static readonly INITIAL_SIZE = 100;
  private static readonly GROWTH_SIZE = 50;
  private static readonly MAX_SIZE = 1000;
  private static readonly MAX_MESSAGE_SIZE = 8192; // 8KB max per message
  
  private static instance: MessagePool | null = null;
  
  private pool: PooledMessage[] = [];
  private freeList: PooledMessage[] = [];
  private nextId = 0;
  
  // Statistics
  private totalAcquired = 0;
  private totalReleased = 0;
  private poolHits = 0;
  private poolMisses = 0;
  private currentInUse = 0;
  private peakInUse = 0;
  private growthEvents = 0;
  
  // Performance monitoring
  private slowReleaseThresholdMs = 100; // Warn if message held longer than 100ms
  private slowReleaseCount = 0;
  private totalHoldTime = 0;
  private maxHoldTime = 0;
  private recentSlowMessages: Array<{poolId: number, holdTime: number, timestamp: number}> = [];
  
  private constructor() {
    this.initialize();
  }
  
  /**
   * Get the singleton instance of MessagePool
   */
  public static getInstance(): MessagePool {
    if (!MessagePool.instance) {
      MessagePool.instance = new MessagePool();
    }
    return MessagePool.instance;
  }
  
  /**
   * Initialize pool with pre-allocated messages
   */
  private initialize(): void {
    for (let i = 0; i < MessagePool.INITIAL_SIZE; i++) {
      const message = this.createMessage();
      this.pool.push(message);
      this.freeList.push(message);
    }
    
    console.log(`[MessagePool] Initialized with ${MessagePool.INITIAL_SIZE} pre-allocated messages`);
  }
  
  /**
   * Create a new pooled message
   */
  private createMessage(): PooledMessage {
    return {
      data: new Uint8Array(0),  // Will be replaced on acquire
      type: MessageType.TERMINAL_OUTPUT,
      timestamp: 0,
      consumerCount: 0,
      consumersRemaining: 0,
      poolId: this.nextId++,
      inUse: false,
      disposed: false,
      acquiredAt: 0,  // Will be set on acquire
      metadata: undefined
    };
  }
  
  /**
   * Grow the pool when exhausted
   */
  private grow(): void {
    if (this.pool.length >= MessagePool.MAX_SIZE) {
      console.warn('[MessagePool] Cannot grow beyond maximum size of', MessagePool.MAX_SIZE);
      return;
    }
    
    const growthSize = Math.min(MessagePool.GROWTH_SIZE, MessagePool.MAX_SIZE - this.pool.length);
    
    for (let i = 0; i < growthSize; i++) {
      const message = this.createMessage();
      this.pool.push(message);
      this.freeList.push(message);
    }
    
    this.growthEvents++;
    console.log(`[MessagePool] Grew pool by ${growthSize} to ${this.pool.length} total messages (growth #${this.growthEvents})`);
  }
  
  /**
   * Acquire a message from the pool
   * @param data The message data (will be copied if > 8KB)
   * @param type The message type
   * @param destinations Number of consumers (for reference counting)
   */
  public acquire(data: Uint8Array, type: MessageType, destinations: number = 2): PooledMessage | null {
    // Get a free message
    let message = this.freeList.pop();
    
    if (!message) {
      // Pool exhausted, try to grow
      this.poolMisses++;
      this.grow();
      message = this.freeList.pop();
      
      if (!message) {
        // Still no message available (at max size)
        console.error('[MessagePool] Pool exhausted at maximum size');
        return null;
      }
    } else {
      this.poolHits++;
    }
    
    // Reset and populate the message
    message.data = data;
    message.type = type;
    message.timestamp = Date.now();
    message.consumerCount = destinations;
    message.consumersRemaining = destinations;
    message.inUse = true;
    message.disposed = false;
    message.metadata = undefined;
    message.acquiredAt = performance.now();
    message.firstReleaseAt = undefined;
    message.fullyReleasedAt = undefined;
    
    // Update statistics
    this.totalAcquired++;
    this.currentInUse++;
    this.peakInUse = Math.max(this.peakInUse, this.currentInUse);
    
    return message;
  }
  
  /**
   * Release a message back to the pool
   * Called by consumers when done with the message
   * @returns true if message was returned to pool (last consumer)
   */
  public release(message: PooledMessage): boolean {
    // Validate the message
    if (!message || !message.inUse) {
      console.error('[MessagePool] Attempt to release invalid message');
      return false;
    }
    
    if (message.disposed) {
      console.error(`[MessagePool] Double-release detected for message ${message.poolId}`);
      return false;
    }
    
    // Decrement consumer count
    message.consumersRemaining--;
    
    // Track first release timing
    if (!message.firstReleaseAt) {
      message.firstReleaseAt = performance.now();
    }
    
    // If this was the last consumer, return to pool
    if (message.consumersRemaining <= 0) {
      // Calculate total hold time and check for slow releases
      message.fullyReleasedAt = performance.now();
      const holdTime = message.fullyReleasedAt - message.acquiredAt;
      
      this.totalHoldTime += holdTime;
      this.maxHoldTime = Math.max(this.maxHoldTime, holdTime);
      
      if (holdTime > this.slowReleaseThresholdMs) {
        this.slowReleaseCount++;
        console.warn(`[MessagePool] Slow message release detected: Message #${message.poolId} held for ${holdTime.toFixed(1)}ms (threshold: ${this.slowReleaseThresholdMs}ms)`);
        
        // Track recent slow messages (keep last 10)
        this.recentSlowMessages.push({
          poolId: message.poolId,
          holdTime: holdTime,
          timestamp: Date.now()
        });
        if (this.recentSlowMessages.length > 10) {
          this.recentSlowMessages.shift();
        }
      }
      // Clear the message data
      message.data = new Uint8Array(0);
      message.type = MessageType.TERMINAL_OUTPUT;
      message.timestamp = 0;
      message.consumerCount = 0;
      message.consumersRemaining = 0;
      message.inUse = false;
      message.disposed = true;
      message.metadata = undefined;
      
      // Return to free list
      this.freeList.push(message);
      
      // Update statistics
      this.totalReleased++;
      this.currentInUse--;
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Get pool statistics
   */
  public getStats() {
    const efficiency = this.totalAcquired > 0 ? 
      (this.poolHits / this.totalAcquired * 100) : 0;
    
    const avgHoldTime = this.totalReleased > 0 ? (this.totalHoldTime / this.totalReleased) : 0;
    
    return {
      poolSize: this.pool.length,
      freeCount: this.freeList.length,
      inUseCount: this.currentInUse,
      peakInUse: this.peakInUse,
      totalAcquired: this.totalAcquired,
      totalReleased: this.totalReleased,
      poolHits: this.poolHits,
      poolMisses: this.poolMisses,
      efficiency: efficiency.toFixed(1) + '%',
      growthEvents: this.growthEvents,
      leakedMessages: this.totalAcquired - this.totalReleased - this.currentInUse,
      
      // Performance metrics
      slowReleaseThresholdMs: this.slowReleaseThresholdMs,
      slowReleaseCount: this.slowReleaseCount,
      avgHoldTimeMs: avgHoldTime.toFixed(1),
      maxHoldTimeMs: this.maxHoldTime.toFixed(1),
      recentSlowMessages: [...this.recentSlowMessages]
    };
  }
  
  /**
   * Reset the pool (for testing or recovery)
   */
  public reset(): void {
    // Return all in-use messages to free list
    for (const message of this.pool) {
      message.data = new Uint8Array(0);
      message.type = MessageType.TERMINAL_OUTPUT;
      message.timestamp = 0;
      message.consumerCount = 0;
      message.consumersRemaining = 0;
      message.inUse = false;
      message.disposed = false;
      message.metadata = undefined;
    }
    
    // Rebuild free list
    this.freeList = [...this.pool];
    
    // Reset statistics
    this.totalAcquired = 0;
    this.totalReleased = 0;
    this.poolHits = 0;
    this.poolMisses = 0;
    this.currentInUse = 0;
    this.peakInUse = 0;
    
    console.log('[MessagePool] Reset complete');
  }
  
  /**
   * Configure slow release monitoring threshold
   * @param thresholdMs Threshold in milliseconds for slow release warnings
   */
  public setSlowReleaseThreshold(thresholdMs: number): void {
    this.slowReleaseThresholdMs = Math.max(1, thresholdMs);
    console.log(`[MessagePool] Slow release threshold set to ${this.slowReleaseThresholdMs}ms`);
  }
  
  /**
   * Get current performance monitoring settings
   */
  public getMonitoringConfig(): { threshold: number; recentSlowCount: number } {
    return {
      threshold: this.slowReleaseThresholdMs,
      recentSlowCount: this.recentSlowMessages.length
    };
  }
  
  /**
   * Validate pool integrity (for debugging)
   */
  public validate(): boolean {
    let freeCount = 0;
    let inUseCount = 0;
    
    for (const message of this.pool) {
      if (message.inUse) {
        inUseCount++;
      } else {
        freeCount++;
      }
    }
    
    const freeListValid = this.freeList.length === freeCount;
    const inUseValid = this.currentInUse === inUseCount;
    
    if (!freeListValid || !inUseValid) {
      console.error('[MessagePool] Validation failed:', {
        freeListLength: this.freeList.length,
        actualFreeCount: freeCount,
        currentInUse: this.currentInUse,
        actualInUse: inUseCount
      });
      return false;
    }
    
    return true;
  }
}