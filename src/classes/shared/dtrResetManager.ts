/** @format */

// src/classes/shared/dtrResetManager.ts

const ENABLE_CONSOLE_LOG: boolean = false;

import { EventEmitter } from 'events';
import { MessageRouter } from './messageRouter';
import { DynamicQueue } from './dynamicQueue';
import { PerformanceMonitor } from './performanceMonitor';

/**
 * Reset event data
 */
export interface ResetEvent {
  type: 'DTR' | 'RTS';
  timestamp: number;
  sequenceNumber: number;
}

/**
 * DTRResetManager - Manages DTR/RTS reset synchronization
 * 
 * Handles DTR/RTS reset events WITHOUT touching the buffer.
 * Only manages synchronization flags and queue draining.
 * 
 * Key responsibilities:
 * - Mark boundaries in message stream
 * - Wait for queues to drain before log rotation
 * - Signal DebugLogger for new log file
 * - Maintain complete separation from buffer
 */

export class DTRResetManager extends EventEmitter {
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
  private router: MessageRouter;
  private resetPending: boolean = false;
  private currentResetEvent: ResetEvent | null = null;
  private resetSequence: number = 0;
  private boundaryMarkers: Map<number, ResetEvent> = new Map();
  
  // Synchronization flags
  private isSynchronized: boolean = false;
  private syncSource: string = '';
  
  // Statistics
  private totalResets: number = 0;
  private dtrResets: number = 0;
  private rtsResets: number = 0;
  private messagesBeforeReset: number = 0;
  private messagesAfterReset: number = 0;
  
  // Performance monitoring
  private performanceMonitor: PerformanceMonitor | null = null;

  constructor(router: MessageRouter) {
    super();
    this.router = router;
  }

  /**
   * Set performance monitor for instrumentation
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Handle DTR reset event
   * ONLY sets flags, does NOT touch buffer
   */
  public async onDTRReset(): Promise<void> {
    await this.handleReset('DTR');
  }

  /**
   * Handle RTS reset event
   * ONLY sets flags, does NOT touch buffer
   */
  public async onRTSReset(): Promise<void> {
    await this.handleReset('RTS');
  }

  /**
   * Common reset handler
   */
  private async handleReset(type: 'DTR' | 'RTS'): Promise<void> {
    // Create reset event
    const resetEvent: ResetEvent = {
      type,
      timestamp: Date.now(),
      sequenceNumber: ++this.resetSequence
    };

    // Update statistics
    this.totalResets++;
    if (type === 'DTR') {
      this.dtrResets++;
      // Record DTR reset in performance monitor
      if (this.performanceMonitor) {
        this.performanceMonitor.recordDTRReset();
      }
    } else {
      this.rtsResets++;
      // Record RTS reset in performance monitor
      if (this.performanceMonitor) {
        this.performanceMonitor.recordRTSReset();
      }
    }

    // Store current reset
    this.currentResetEvent = resetEvent;
    this.resetPending = true;

    // Mark boundary in stream
    this.boundaryMarkers.set(resetEvent.sequenceNumber, resetEvent);

    // Set synchronization flags
    this.isSynchronized = true;
    this.syncSource = type;

    this.logConsoleMessage(`[DTRResetManager] ${type} reset detected, sequence ${resetEvent.sequenceNumber}`);

    // Emit reset event for other components
    this.emit('resetDetected', resetEvent);

    // Wait for queues to drain
    await this.drainQueues();

    // Signal log rotation
    this.emit('rotateLog', resetEvent);

    // Clear reset pending
    this.resetPending = false;

    this.logConsoleMessage(`[DTRResetManager] ${type} reset complete, log rotated`);
  }

  /**
   * Wait for all queues to drain
   */
  private async drainQueues(): Promise<void> {
    this.logConsoleMessage('[DTRResetManager] Waiting for queues to drain...');

    // Wait for router queue to empty
    const routerDrained = await this.router.waitForQueueDrain(5000);
    
    if (!routerDrained) {
      console.warn('[DTRResetManager] Router queue drain timeout');
      this.emit('drainTimeout', { queue: 'router' });
    }

    // Additional drain time for any pending async operations
    await this.delay(50);

    this.logConsoleMessage('[DTRResetManager] All queues drained');
  }

  /**
   * Check if message is before or after reset boundary
   */
  public isMessageBeforeReset(timestamp: number): boolean {
    if (!this.currentResetEvent) {
      return true; // No reset yet
    }
    return timestamp < this.currentResetEvent.timestamp;
  }

  /**
   * Get current synchronization status
   */
  public getSyncStatus(): { synchronized: boolean; source: string } {
    return {
      synchronized: this.isSynchronized,
      source: this.syncSource
    };
  }

  /**
   * Mark synchronization from another source
   */
  public markSynchronized(source: string): void {
    this.isSynchronized = true;
    this.syncSource = source;
    this.emit('syncStatusChanged', this.getSyncStatus());
  }

  /**
   * Clear synchronization
   */
  public clearSynchronization(): void {
    this.isSynchronized = false;
    this.syncSource = '';
    this.emit('syncStatusChanged', this.getSyncStatus());
  }

  /**
   * Check if reset is pending
   */
  public isResetPending(): boolean {
    return this.resetPending;
  }

  /**
   * Get current reset event
   */
  public getCurrentReset(): ResetEvent | null {
    return this.currentResetEvent;
  }

  /**
   * Get boundary marker by sequence
   */
  public getBoundaryMarker(sequence: number): ResetEvent | undefined {
    return this.boundaryMarkers.get(sequence);
  }

  /**
   * Get all boundary markers
   */
  public getAllBoundaries(): ResetEvent[] {
    return Array.from(this.boundaryMarkers.values());
  }

  /**
   * Update message counts
   */
  public updateMessageCounts(beforeReset: boolean): void {
    if (beforeReset) {
      this.messagesBeforeReset++;
    } else {
      this.messagesAfterReset++;
    }
  }

  /**
   * Get statistics
   */
  public getStats() {
    return {
      totalResets: this.totalResets,
      dtrResets: this.dtrResets,
      rtsResets: this.rtsResets,
      messagesBeforeReset: this.messagesBeforeReset,
      messagesAfterReset: this.messagesAfterReset,
      currentSequence: this.resetSequence,
      boundaryCount: this.boundaryMarkers.size,
      resetPending: this.resetPending,
      synchronized: this.isSynchronized,
      syncSource: this.syncSource
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.totalResets = 0;
    this.dtrResets = 0;
    this.rtsResets = 0;
    this.messagesBeforeReset = 0;
    this.messagesAfterReset = 0;
  }

  /**
   * Clear old boundary markers (keep last N)
   */
  public pruneOldBoundaries(keepCount: number = 10): void {
    if (this.boundaryMarkers.size <= keepCount) {
      return;
    }

    const sortedKeys = Array.from(this.boundaryMarkers.keys()).sort((a, b) => a - b);
    const toDelete = sortedKeys.slice(0, sortedKeys.length - keepCount);
    
    for (const key of toDelete) {
      this.boundaryMarkers.delete(key);
    }

    this.logConsoleMessage(`[DTRResetManager] Pruned ${toDelete.length} old boundary markers`);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Force immediate log rotation (for testing)
   */
  public forceLogRotation(): void {
    const resetEvent: ResetEvent = {
      type: 'DTR',
      timestamp: Date.now(),
      sequenceNumber: ++this.resetSequence
    };
    
    this.emit('rotateLog', resetEvent);
  }
}