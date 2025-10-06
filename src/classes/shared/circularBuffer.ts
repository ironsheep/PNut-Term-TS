/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

// src/classes/shared/circularBuffer.ts

import { EventEmitter } from 'events';
import { PerformanceMonitor } from './performanceMonitor';

/**
 * Configuration interface for CircularBuffer sizing
 */
export interface CircularBufferConfig {
  size: number;           // Buffer size in bytes
  minSize: number;        // Minimum size (64KB)
  maxSize: number;        // Maximum size (2MB)
  baudRate?: number;      // Baud rate for dynamic sizing
  bufferTimeMs?: number;  // Buffer time in milliseconds (default 100ms)
}

/**
 * Buffer statistics for monitoring
 */
export interface BufferStats {
  size: number;
  used: number;
  available: number;
  usagePercent: number;
  highWaterMark: number;
  overflowCount: number;
  warningThreshold: number;
  isNearFull: boolean;
}

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
 * - Dynamic sizing based on baud rate for optimal buffering
 * - Buffer usage monitoring and overflow warnings
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
 * - Configurable buffer size with dynamic sizing (default 1MB for P2 2Mbps data rates)
 * - Baud rate-based sizing: minimum 64KB, recommended baudRate/8 * 0.1 (100ms of data), maximum 2MB
 * - Never reallocates - fixed size once created
 * - Transparent wrap-around handling
 * - Position save/restore for parsing backtrack scenarios
 * - Atomic space checking on append
 * - Buffer usage statistics and high-water mark tracking
 * - Performance instrumentation hooks and overflow monitoring
 */

export enum NextStatus {
  DATA = 'DATA',
  EMPTY = 'EMPTY'
}

export interface NextResult {
  status: NextStatus;
  value?: number;
}

export class CircularBuffer extends EventEmitter {
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private readonly bufferSize: number;
  private readonly buffer: Uint8Array;
  private head: number = 0;  // Read position
  private tail: number = 0;  // Write position
  private isEmpty: boolean = true;
  
  // Saved positions for restore
  private savedPositions: number[] = [];

  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;
  private highWaterMark: number = 0;
  
  // Enhanced buffer monitoring
  private overflowCount: number = 0;
  private warningThreshold: number = 0.8; // 80% threshold
  private lastWarningTime: number = 0;
  private warningCooldownMs: number = 5000; // 5 second cooldown
  private config: CircularBufferConfig;

  constructor(bufferSize: number = 1048576, config?: Partial<CircularBufferConfig>) {
    super();
    
    // Create configuration with defaults
    this.config = {
      size: bufferSize,
      minSize: 64 * 1024,        // 64KB minimum
      maxSize: 2 * 1024 * 1024,  // 2MB maximum
      bufferTimeMs: 100,          // 100ms of buffer time
      ...config
    };
    
    // Validate and adjust buffer size
    this.bufferSize = this.calculateOptimalBufferSize(this.config);
    this.buffer = new Uint8Array(this.bufferSize);
    
    this.logConsoleMessage(`[CircularBuffer] Initialized with ${this.bufferSize} bytes (${(this.bufferSize/1024).toFixed(1)}KB)`);
  }
  
  /**
   * Calculate optimal buffer size based on configuration
   */
  private calculateOptimalBufferSize(config: CircularBufferConfig): number {
    let optimalSize = config.size;
    
    // If baud rate is provided, calculate recommended size
    if (config.baudRate && config.bufferTimeMs) {
      // Formula: (baudRate / 8) * (bufferTimeMs / 1000) = bytes needed for the time period
      const recommendedSize = Math.ceil((config.baudRate / 8) * (config.bufferTimeMs / 1000));
      this.logConsoleMessage(`[CircularBuffer] Baud rate ${config.baudRate}, recommended size: ${recommendedSize} bytes`);
      optimalSize = recommendedSize;
    }
    
    // Apply size constraints
    if (optimalSize < config.minSize) {
      this.logConsoleMessage(`[CircularBuffer] Size ${optimalSize} below minimum, using ${config.minSize}`);
      optimalSize = config.minSize;
    } else if (optimalSize > config.maxSize) {
      this.logConsoleMessage(`[CircularBuffer] Size ${optimalSize} above maximum, using ${config.maxSize}`);
      optimalSize = config.maxSize;
    }
    
    return optimalSize;
  }
  
  /**
   * Create CircularBuffer with dynamic sizing based on baud rate
   */
  public static createForBaudRate(baudRate: number, bufferTimeMs: number = 100): CircularBuffer {
    const config: CircularBufferConfig = {
      size: 1048576, // Default fallback
      minSize: 64 * 1024,
      maxSize: 2 * 1024 * 1024,
      baudRate,
      bufferTimeMs
    };
    
    return new CircularBuffer(1048576, config);
  }

  /**
   * Set performance monitor for instrumentation
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Get buffer size for testing purposes
   */
  public getBufferSize(): number {
    return this.bufferSize;
  }
  
  /**
   * Get comprehensive buffer statistics
   */
  public getStats(): BufferStats {
    const used = this.getBytesUsed();
    const available = this.bufferSize - used;
    const usagePercent = (used / this.bufferSize) * 100;
    
    return {
      size: this.bufferSize,
      used,
      available,
      usagePercent: Math.round(usagePercent * 10) / 10, // Round to 1 decimal
      highWaterMark: this.highWaterMark,
      overflowCount: this.overflowCount,
      warningThreshold: this.warningThreshold * 100,
      isNearFull: usagePercent >= (this.warningThreshold * 100)
    };
  }
  
  /**
   * Configure warning threshold (default 80%)
   */
  public setWarningThreshold(threshold: number): void {
    this.warningThreshold = Math.max(0.1, Math.min(0.95, threshold));
    this.logConsoleMessage(`[CircularBuffer] Warning threshold set to ${(this.warningThreshold * 100).toFixed(1)}%`);
  }
  
  /**
   * Get current buffer configuration
   */
  public getConfig(): CircularBufferConfig {
    return { ...this.config };
  }
  
  /**
   * Get number of bytes currently used in buffer
   */
  private getBytesUsed(): number {
    if (this.isEmpty) {
      return 0;
    }
    
    if (this.tail >= this.head) {
      return this.tail - this.head;
    } else {
      return (this.bufferSize - this.head) + this.tail;
    }
  }
  
  /**
   * Get available space in buffer (internal use)
   */
  private getInternalAvailableSpace(): number {
    return this.bufferSize - this.getBytesUsed() - 1; // -1 to prevent head==tail ambiguity
  }


  /**
   * Append data to tail of buffer with enhanced monitoring
   * @returns false if insufficient space
   */
  public appendAtTail(data: Uint8Array): boolean {
    const dataLength = data.length;
    
    // Check available space
    const available = this.getInternalAvailableSpace();
    if (dataLength > available) {
      // Record and emit overflow
      this.overflowCount++;
      if (this.performanceMonitor) {
        this.performanceMonitor.recordBufferOverflow();
      }
      
      const stats = this.getStats();
      this.emit('bufferOverflow', {
        attempted: dataLength,
        available: available,
        stats: stats
      });
      
      this.logConsoleMessage(`[CircularBuffer] OVERFLOW: Attempted to write ${dataLength} bytes, only ${available} available (${stats.usagePercent}% full)`);
      return false;
    }

    // Copy data using bulk operations for speed and safety
    // Split into two segments if wrap-around occurs
    const spaceAtEnd = this.bufferSize - this.tail;

    if (dataLength <= spaceAtEnd) {
      // No wrap-around: single copy
      this.buffer.set(data, this.tail);
      this.tail = (this.tail + dataLength) % this.bufferSize;
    } else {
      // Wrap-around: two copies
      // First: copy to end of buffer
      this.buffer.set(data.subarray(0, spaceAtEnd), this.tail);
      // Second: wrap around and copy remainder
      this.buffer.set(data.subarray(spaceAtEnd), 0);
      this.tail = dataLength - spaceAtEnd;
    }

    this.isEmpty = false;
    
    // Update performance metrics and check for warnings
    const used = this.getBytesUsed();
    this.highWaterMark = Math.max(this.highWaterMark, used);
    
    if (this.performanceMonitor) {
      this.performanceMonitor.recordBufferMetrics(used, this.bufferSize);
    }
    
    // Check warning threshold with cooldown
    const usagePercent = (used / this.bufferSize);
    if (usagePercent >= this.warningThreshold) {
      const now = Date.now();
      if (now - this.lastWarningTime >= this.warningCooldownMs) {
        this.lastWarningTime = now;
        const stats = this.getStats();
        
        this.emit('bufferWarning', {
          usagePercent: stats.usagePercent,
          threshold: this.warningThreshold * 100,
          stats: stats
        });
        
        this.logConsoleMessage(`[CircularBuffer] WARNING: Buffer usage ${stats.usagePercent}% exceeds ${(this.warningThreshold * 100)}% threshold`);
      }
    }
    
    return true;
  }

  /**
   * Get next byte from buffer
   * Completely abstracts wrap-around from consumer
   */
  public next(): NextResult {
    // Check if buffer is empty
    if (this.isEmpty) {
      return { status: NextStatus.EMPTY };
    }

    // Get current byte and advance position
    const value = this.buffer[this.head];
    this.head = (this.head + 1) % this.bufferSize;
    
    // Check if we've consumed all data
    if (this.head === this.tail) {
      this.isEmpty = true;
    }
    
    return { status: NextStatus.DATA, value };
  }

  /**
   * Save current position for later restore
   */
  public savePosition(): void {
    this.savedPositions.push(this.head);
  }

  /**
   * Restore to last saved position
   */
  public restorePosition(): boolean {
    if (this.savedPositions.length === 0) {
      return false;
    }
    
    const pos = this.savedPositions.pop()!;
    this.head = pos;
    // Recalculate isEmpty
    this.isEmpty = (this.head === this.tail);
    return true;
  }

  /**
   * Get available space in buffer
   */
  public getAvailableSpace(): number {
    if (this.isEmpty) {
      return this.bufferSize;  // Completely empty
    }
    
    // Check for full buffer condition
    if (this.head === this.tail) {
      return 0;  // Buffer is full
    }
    
    if (this.tail > this.head) {
      // Free space = buffer size - used space
      return this.bufferSize - (this.tail - this.head);
    } else {
      // Free space = gap between head and tail
      return this.head - this.tail;
    }
  }

  /**
   * Get used space in buffer
   */
  public getUsedSpace(): number {
    if (this.isEmpty) {
      return 0;
    }
    
    // Check for full buffer condition
    if (this.head === this.tail) {
      return this.bufferSize;  // Buffer is full
    }
    
    if (this.tail > this.head) {
      return this.tail - this.head;
    } else {
      return this.bufferSize - this.head + this.tail;
    }
  }

  /**
   * Clear the buffer
   */
  public clear(): void {
    this.head = 0;
    this.tail = 0;
    this.isEmpty = true;
    this.savedPositions = [];
  }

  /**
   * Check if buffer has data
   */
  public hasData(): boolean {
    return !this.isEmpty;
  }




  /**
   * Extract a range of bytes from buffer efficiently
   * This allows single-copy extraction instead of byte-by-byte
   * @param startPos The absolute position in the buffer
   * @param length Number of bytes to extract
   * @returns Uint8Array with the extracted data
   */
  public extractRange(startPos: number, length: number): Uint8Array | null {
    if (length <= 0) return new Uint8Array(0);
    
    // Create result array
    const result = new Uint8Array(length);
    
    // Copy data, handling wrap-around
    let sourcePos = startPos;
    for (let i = 0; i < length; i++) {
      result[i] = this.buffer[sourcePos];
      sourcePos = (sourcePos + 1) % this.bufferSize;
    }
    
    return result;
  }

  /**
   * Get current head position for tracking
   */
  public getCurrentPosition(): number {
    return this.head;
  }

  /**
   * Get current tail (write) position for tracking
   */
  public getTailPosition(): number {
    return this.tail;
  }

  /**
   * Peek at bytes at a specific absolute offset (for logging)
   * Does not consume bytes or move head pointer
   * Returns null if offset/length would read invalid data
   */
  public peekAtOffset(offset: number, length: number): Uint8Array | null {
    if (offset < 0 || offset >= this.bufferSize || length <= 0) {
      return null;
    }

    // Create result array
    const result = new Uint8Array(length);

    // Read bytes from buffer (may wrap around)
    for (let i = 0; i < length; i++) {
      const pos = (offset + i) % this.bufferSize;
      result[i] = this.buffer[pos];
    }

    return result;
  }

  /**
   * Consume N bytes from head
   * Returns false if not enough bytes available
   */
  public consume(count: number): boolean {
    if (count <= 0) return true;
    
    const available = this.getUsedSpace();
    if (count > available) return false;

    this.head = (this.head + count) % this.bufferSize;
    if (this.head === this.tail) {
      this.isEmpty = true;
    }
    
    return true;
  }
}