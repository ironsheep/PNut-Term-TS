/** @format */

// src/classes/shared/serialReceiver.ts

import { EventEmitter } from 'events';
import { CircularBuffer } from './circularBuffer';
import { PerformanceMonitor } from './performanceMonitor';

/**
 * SerialReceiver - Clean serial data receiver with async decoupling
 * 
 * Receives Buffer data from serial port and appends to CircularBuffer.
 * Uses setImmediate to trigger extraction on next tick, ensuring
 * serial receive is never blocked by processing.
 * 
 * This component has ZERO knowledge of:
 * - Message types or formats
 * - Windows or routing
 * - Any processing logic
 * 
 * It only knows how to:
 * - Convert Buffer to Uint8Array properly
 * - Append to CircularBuffer
 * - Trigger async extraction
 */

export interface ReceiverStats {
  totalBytesReceived: number;
  totalChunksReceived: number;
  largestChunk: number;
  bufferOverflows: number;
  extractionsPending: number;
  lastReceiveTime: number;
}

export class SerialReceiver extends EventEmitter {
  private buffer: CircularBuffer;
  private extractionPending: boolean = false;
  private extractionCallback: (() => void) | null = null;
  
  // Statistics
  private totalBytesReceived: number = 0;
  private totalChunksReceived: number = 0;
  private largestChunk: number = 0;
  private bufferOverflows: number = 0;
  private lastReceiveTime: number = 0;
  
  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;

  constructor(buffer: CircularBuffer) {
    super();
    this.buffer = buffer;
  }

  /**
   * Set performance monitor for instrumentation
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Set the extraction callback
   * This will be called asynchronously when data is available
   */
  public setExtractionCallback(callback: () => void): void {
    this.extractionCallback = callback;
  }

  /**
   * Receive data from serial port
   * Converts Buffer to Uint8Array and appends to circular buffer
   * Triggers async extraction if not already pending
   */
  public receiveData(data: Buffer): void {
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
    const uint8Data = new Uint8Array(data.buffer, data.byteOffset, data.length);

    // Try to append to buffer
    const appended = this.buffer.appendAtTail(uint8Data);
    
    if (!appended) {
      // Buffer overflow - data was dropped
      this.bufferOverflows++;
      this.emit('bufferOverflow', {
        droppedBytes: data.length,
        bufferStats: this.buffer.getStats()
      });
      
      console.error(`[SerialReceiver] Buffer overflow! Dropped ${data.length} bytes`);
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
      setImmediate(() => {
        this.extractionPending = false;
        
        // Only trigger if we still have data
        if (this.buffer.hasData() && this.extractionCallback) {
          try {
            this.extractionCallback();
          } catch (error) {
            console.error('[SerialReceiver] Extraction callback error:', error);
            this.emit('extractionError', error);
          }
        }
      });
    }
  }

  /**
   * Get receiver statistics
   */
  public getStats(): ReceiverStats {
    return {
      totalBytesReceived: this.totalBytesReceived,
      totalChunksReceived: this.totalChunksReceived,
      largestChunk: this.largestChunk,
      bufferOverflows: this.bufferOverflows,
      extractionsPending: this.extractionPending ? 1 : 0,
      lastReceiveTime: this.lastReceiveTime
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.totalBytesReceived = 0;
    this.totalChunksReceived = 0;
    this.largestChunk = 0;
    this.bufferOverflows = 0;
  }

  /**
   * Get buffer reference (for testing/monitoring)
   */
  public getBuffer(): CircularBuffer {
    return this.buffer;
  }

  /**
   * Check if extraction is pending
   */
  public isExtractionPending(): boolean {
    return this.extractionPending;
  }

  /**
   * Calculate receive rate (bytes per second)
   * @param windowMs Time window in milliseconds
   */
  public getReceiveRate(windowMs: number = 1000): number {
    const now = Date.now();
    const timeSinceLastReceive = now - this.lastReceiveTime;
    
    if (timeSinceLastReceive > windowMs) {
      return 0; // No recent data
    }
    
    // Simple approximation - would need ring buffer for accurate windowed rate
    return (this.totalBytesReceived / (now / 1000)) | 0;
  }

  /**
   * Clear the buffer (used for reset scenarios)
   */
  public clearBuffer(): void {
    this.buffer.clear();
    this.extractionPending = false;
  }
}