/** @format */

// src/classes/shared/serialReceiver.ts

import { EventEmitter } from 'events';
import { CircularBuffer } from './circularBuffer';
import { PerformanceMonitor } from './performanceMonitor';
import { DynamicQueue } from './dynamicQueue';

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

/**
 * USB Metadata for deferred logging
 * Captures arrival timestamp and buffer position (no data copy)
 * MessageExtractor reads actual bytes from CircularBuffer using offset/length
 */
export interface USBMetadata {
  timestamp: number;      // Date.now() when bytes arrived from USB
  writeOffset: number;    // Where in CircularBuffer data was written
  byteLength: number;     // How many bytes in this chunk
}

export class SerialReceiver extends EventEmitter {
  private buffer: CircularBuffer;
  private extractionPending: boolean = false;
  private extractionCallback: (() => void) | null = null;

  // USB traffic logging metadata queue (deferred logging to keep hot-path fast)
  private usbMetadataQueue: DynamicQueue<USBMetadata>;

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
    // Initialize metadata queue (start small, grow as needed, max 1000 entries)
    this.usbMetadataQueue = new DynamicQueue<USBMetadata>(10, 1000, 'USBMetadataQueue');
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
    // HOT PATH PROFILING: Start timing
    const startTime = performance.now();

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

    // CRITICAL: COPY Buffer data immediately!
    // Creating a VIEW (new Uint8Array(data.buffer, offset, length)) is UNSAFE because
    // Node.js serialport driver REUSES the same ArrayBuffer for multiple 'data' events.
    // If we create a view and the buffer gets overwritten before we finish copying
    // byte-by-byte in appendAtTail(), we get data corruption (merged messages, lost CRLFs).
    //
    // SOLUTION: Create independent copy using Buffer.from() - guaranteed fresh allocation.
    const uint8Data = new Uint8Array(Buffer.from(data));

    // Get write position before appending (for metadata logging)
    const writeOffset = this.buffer.getTailPosition();

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

    // Capture metadata for deferred USB traffic logging (HOT PATH - keep fast!)
    // Just push 3 numbers, no string formatting or I/O
    const metadata: USBMetadata = {
      timestamp: this.lastReceiveTime,  // Already captured above
      writeOffset: writeOffset,
      byteLength: data.length
    };
    this.usbMetadataQueue.enqueue(metadata);

    // HOT PATH: Skip 'dataReceived' event emission - no production listeners
    // (Only test code uses this event, and it's expensive to call getStats())

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
            const extractionStart = performance.now();
            this.extractionCallback();
            const extractionEnd = performance.now();
            const extractionTime = extractionEnd - extractionStart;

            // HOT PATH PROFILING: Warn if extraction takes too long
            if (extractionTime > 5) {
              console.warn(`[HOT PATH] 🔥 Extraction callback took ${extractionTime.toFixed(2)}ms - may delay serial receives!`);
            }
          } catch (error) {
            console.error('[SerialReceiver] Extraction callback error:', error);
            this.emit('extractionError', error);
          }
        }
      });
    }

    // HOT PATH PROFILING: End timing
    const endTime = performance.now();
    const receiveTime = endTime - startTime;

    // Warn if receiveData() takes too long (blocking serial driver)
    if (receiveTime > 1) {
      console.warn(`[HOT PATH] 🔥 receiveData() took ${receiveTime.toFixed(2)}ms for ${data.length} bytes - blocking USB driver!`);
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

  /**
   * Get USB metadata queue for deferred logging
   * MessageExtractor will drain this queue and log with proper timing
   */
  public getUSBMetadataQueue(): DynamicQueue<USBMetadata> {
    return this.usbMetadataQueue;
  }
}