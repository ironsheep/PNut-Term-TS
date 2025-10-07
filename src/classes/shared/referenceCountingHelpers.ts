/** @format */

/**
 * Reference Counting Helpers for Single-Copy Message Passing
 *
 * LEGACY: These functions are no longer used in Worker Thread architecture.
 * SharedMessagePool handles reference counting via atomic operations.
 * Functions are stubs for backward compatibility only.
 */

import { ExtractedMessage } from './sharedMessagePool';

/**
 * Set the global message pool instance (LEGACY - no-op)
 */
export function setGlobalMessagePool(pool: any): void {
  // No-op: Worker Thread architecture uses SharedMessagePool directly
}

/**
 * Release a message reference (LEGACY - no-op)
 * @returns true (always succeeds as no-op)
 */
export function releaseMessage(message: ExtractedMessage): boolean {
  // No-op: Router handles SharedMessagePool release
  return true;
}

/**
 * Add a reference to a message (LEGACY - no-op)
 */
export function addReference(message: ExtractedMessage): void {
  // No-op: Router handles SharedMessagePool reference counting
}

/**
 * Check if message is disposed (LEGACY - always returns false)
 */
export function isMessageDisposed(message: ExtractedMessage): boolean {
  // No-op: Not applicable in Worker Thread architecture
  return false;
}

/**
 * Get message reference info (LEGACY - returns placeholder)
 */
export function getMessageRefInfo(message: ExtractedMessage): string {
  // No-op: Reference counting handled by SharedMessagePool
  return 'N/A (Worker Thread architecture)';
}

/**
 * Validate message references (LEGACY - always returns true)
 */
export function validateMessageRefs(message: ExtractedMessage): boolean {
  // No-op: SharedMessagePool validates internally
  return true;
}

/**
 * Track message for leak detection (LEGACY - returns 0)
 */
export function trackMessage(message: ExtractedMessage): number {
  // No-op: Leak detection not implemented
  return 0;
}

/**
 * Get leaked messages (LEGACY - returns empty array)
 */
export function getLeakedMessages(): ExtractedMessage[] {
  // No-op: Leak detection not implemented
  return [];
}

/**
 * Clear tracked messages (LEGACY - no-op)
 */
export function clearTrackedMessages(): void {
  // No-op: Leak detection not implemented
}
