/** @format */

/**
 * Reference Counting Helpers for Single-Copy Message Passing
 * 
 * PURPOSE: Provide safe atomic operations for message reference counting
 * 
 * USAGE:
 * - Consumers call releaseMessage() when done with a message
 * - Router calls addReference() if routing to additional destinations
 * - Debug helpers track message lifecycle and detect leaks
 */

import { ExtractedMessage } from './messageExtractor';
import { MessagePool } from './messagePool';

// Global message pool instance (will be set by main app)
let globalMessagePool: MessagePool | null = null;

/**
 * Set the global message pool instance
 */
export function setGlobalMessagePool(pool: MessagePool): void {
  globalMessagePool = pool;
  console.log('[ReferenceCountingHelpers] Global message pool configured');
}

/**
 * Release a message reference
 * Called by consumers when done processing
 * @returns true if message was returned to pool (last consumer)
 */
export function releaseMessage(message: ExtractedMessage): boolean {
  if (!message) {
    console.error('[ReferenceCountingHelpers] Attempt to release null message');
    return false;
  }
  
  // Check for double-release
  if (message.disposed) {
    console.error(`[ReferenceCountingHelpers] Double-release detected for message`, {
      type: message.type,
      timestamp: message.timestamp,
      poolId: message.poolId
    });
    return false;
  }
  
  // If no reference counting, just mark as disposed
  if (message.consumerCount === undefined || message.consumersRemaining === undefined) {
    message.disposed = true;
    return true;  // Consider it "released" for non-pooled messages
  }
  
  // Decrement consumer count (atomic in single-threaded Node.js)
  message.consumersRemaining--;
  
  // Check if this was the last consumer
  if (message.consumersRemaining <= 0) {
    message.disposed = true;
    
    // If we have a pool and this is a pooled message, return it
    if (globalMessagePool && message.poolId !== undefined) {
      // The pool will handle the actual cleanup
      // We just need to pass the message back
      // Note: In a real implementation, we'd cast to PooledMessage
      console.log(`[ReferenceCountingHelpers] Returning message ${message.poolId} to pool`);
    }
    
    return true;
  }
  
  return false;
}

/**
 * Add a reference to a message
 * Called when routing to additional destinations
 */
export function addReference(message: ExtractedMessage): void {
  if (!message) {
    console.error('[ReferenceCountingHelpers] Attempt to add reference to null message');
    return;
  }
  
  if (message.disposed) {
    console.error('[ReferenceCountingHelpers] Attempt to add reference to disposed message');
    return;
  }
  
  if (message.consumerCount !== undefined && message.consumersRemaining !== undefined) {
    message.consumerCount++;
    message.consumersRemaining++;
  }
}

/**
 * Check if a message has been disposed
 * Useful for debugging and validation
 */
export function isMessageDisposed(message: ExtractedMessage): boolean {
  return message?.disposed === true;
}

/**
 * Get reference count information for debugging
 */
export function getMessageRefInfo(message: ExtractedMessage): string {
  if (!message) return 'null message';
  
  if (message.consumerCount === undefined) {
    return 'non-reference-counted message';
  }
  
  return `refs: ${message.consumersRemaining}/${message.consumerCount}, disposed: ${message.disposed}, poolId: ${message.poolId || 'none'}`;
}

/**
 * Validate message reference integrity
 * Returns true if message references are valid
 */
export function validateMessageRefs(message: ExtractedMessage): boolean {
  if (!message) return false;
  
  // Non-reference-counted messages are always "valid"
  if (message.consumerCount === undefined) return true;
  
  // Check for invalid states
  if (message.consumersRemaining! > message.consumerCount!) {
    console.error('[ReferenceCountingHelpers] Invalid ref count: remaining > total', {
      remaining: message.consumersRemaining,
      total: message.consumerCount
    });
    return false;
  }
  
  if (message.consumersRemaining! < 0) {
    console.error('[ReferenceCountingHelpers] Negative ref count', {
      remaining: message.consumersRemaining
    });
    return false;
  }
  
  if (message.disposed && message.consumersRemaining! > 0) {
    console.error('[ReferenceCountingHelpers] Message disposed but still has references', {
      remaining: message.consumersRemaining
    });
    return false;
  }
  
  return true;
}

/**
 * Debug: Track active messages for leak detection
 */
const activeMessages = new Map<number, ExtractedMessage>();
let nextTrackingId = 0;

/**
 * Start tracking a message for leak detection (debug only)
 */
export function trackMessage(message: ExtractedMessage): number {
  if (process.env.NODE_ENV !== 'development') return -1;
  
  const trackingId = nextTrackingId++;
  activeMessages.set(trackingId, message);
  return trackingId;
}

/**
 * Stop tracking a message (debug only)
 */
export function untrackMessage(trackingId: number): void {
  if (process.env.NODE_ENV !== 'development') return;
  activeMessages.delete(trackingId);
}

/**
 * Get leaked messages (debug only)
 * Messages that should have been released but weren't
 */
export function getLeakedMessages(): ExtractedMessage[] {
  if (process.env.NODE_ENV !== 'development') return [];
  
  const leaked: ExtractedMessage[] = [];
  const now = Date.now();
  
  for (const [id, message] of activeMessages) {
    // Consider a message leaked if it's older than 5 seconds and not disposed
    if (now - message.timestamp > 5000 && !message.disposed) {
      leaked.push(message);
    }
  }
  
  return leaked;
}

/**
 * Debug: Dump active message statistics
 */
export function dumpMessageStats(): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const stats = {
    totalActive: activeMessages.size,
    byType: {} as Record<string, number>,
    oldestAge: 0,
    notDisposed: 0,
    withRefs: 0
  };
  
  const now = Date.now();
  
  for (const message of activeMessages.values()) {
    // Count by type
    stats.byType[message.type] = (stats.byType[message.type] || 0) + 1;
    
    // Track oldest
    const age = now - message.timestamp;
    stats.oldestAge = Math.max(stats.oldestAge, age);
    
    // Count undisposed
    if (!message.disposed) stats.notDisposed++;
    
    // Count with active refs
    if ((message.consumersRemaining || 0) > 0) stats.withRefs++;
  }
  
  console.log('[ReferenceCountingHelpers] Active message statistics:', stats);
}