/** @format */

// src/classes/shared/cogHistoryManager.ts

import { EventEmitter } from 'events';

/**
 * Message types to filter out when replaying history
 */
const INJECTED_MESSAGE_PATTERNS = [
  /^\[WINDOW\]/,           // Window position messages
  /^\[ERROR\]/,            // Validation errors
  /^\[WARNING\]/,          // Warnings
  /^\[SYSTEM\]/,           // System messages
  /^\[DTR\]/,              // DTR state changes (handle specially)
  /^\[CONNECTION\]/,       // Connection status
];

/**
 * COGHistoryManager - Manages history replay for COG splitter windows
 * 
 * When user opens 8 COG windows, this manager:
 * 1. Snapshots the entire debug logger history
 * 2. Filters out injected system messages
 * 3. Routes COG-prefixed messages to appropriate windows
 * 4. Forwards DTR reset messages to windows that receive content
 * 
 * This ensures COG windows start with appropriate context
 */
export class COGHistoryManager extends EventEmitter {
  private cogWindows: Map<number, any> = new Map();
  private debugLogHistory: string[] = [];
  private dtrResetMessage: string | null = null;

  constructor() {
    super();
  }

  /**
   * Register a COG window for history replay
   */
  public registerCOGWindow(cogId: number, window: any): void {
    this.cogWindows.set(cogId, window);
  }

  /**
   * Unregister a COG window
   */
  public unregisterCOGWindow(cogId: number): void {
    this.cogWindows.delete(cogId);
  }

  /**
   * Snapshot debug logger history and distribute to COG windows
   * Called when user activates COG splitter feature
   */
  public replayHistoryToCOGs(history: string[]): void {
    this.debugLogHistory = [...history];
    
    // First pass: Find DTR reset message if any
    this.dtrResetMessage = this.findDTRResetMessage(history);
    
    // Second pass: Filter and route messages
    const cogMessages = new Map<number, string[]>();
    
    for (const message of history) {
      // Skip injected system messages
      if (this.isInjectedMessage(message)) {
        continue;
      }
      
      // Extract COG ID from message if present
      const cogId = this.extractCOGId(message);
      if (cogId !== null) {
        if (!cogMessages.has(cogId)) {
          cogMessages.set(cogId, []);
        }
        cogMessages.get(cogId)!.push(message);
      }
    }
    
    // Third pass: Send filtered history to each COG window
    for (const [cogId, messages] of cogMessages) {
      const window = this.cogWindows.get(cogId);
      if (window) {
        // If we have a DTR reset message, prepend it
        const replayMessages = this.dtrResetMessage 
          ? [this.formatDTRMessageForCOG(cogId), ...messages]
          : messages;
          
        this.sendHistoryToWindow(window, replayMessages);
      }
    }
    
    // Notify completion
    this.emit('historyReplayed', {
      totalMessages: history.length,
      cogDistribution: Array.from(cogMessages.entries()).map(([cog, msgs]) => ({
        cogId: cog,
        messageCount: msgs.length
      }))
    });
  }

  /**
   * Check if message is an injected system message
   */
  private isInjectedMessage(message: string): boolean {
    return INJECTED_MESSAGE_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Extract COG ID from message
   * Looks for patterns like "Cog0 ", "COG1 ", "[COG2]", etc.
   * EXACT format: "CogN " (no space between Cog and number)
   */
  private extractCOGId(message: string): number | null {
    // COG prefix patterns - EXACT format: "CogN " (no space between Cog and number)
    const patterns = [
      /^Cog(\d+)\s/i,            // "Cog0 ", "Cog1 " - EXACT required format
      /^COG(\d+)\s/i,            // "COG0 ", "COG1 " - uppercase variant
      /^\[COG(\d+)\]/i,          // "[COG0]" - bracketed variant
      /^<(\d+)>/,                // "<0>" - shorthand variant
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const cogId = parseInt(match[1], 10);
        if (cogId >= 0 && cogId <= 7) {
          return cogId;
        }
      }
    }
    
    return null;
  }

  /**
   * Find DTR reset message in history
   */
  private findDTRResetMessage(history: string[]): string | null {
    // Look for most recent DTR reset
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].includes('DTR reset') || 
          history[i].includes('Log started') ||
          history[i].includes('Connection established')) {
        return history[i];
      }
    }
    return null;
  }

  /**
   * Format DTR message for specific COG
   */
  private formatDTRMessageForCOG(cogId: number): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] COG ${cogId} - Session started (replayed from debug logger)`;
  }

  /**
   * Send history messages to a COG window
   */
  private sendHistoryToWindow(window: any, messages: string[]): void {
    // Send in batches to avoid overwhelming the window
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      
      // Use setTimeout to allow UI to update between batches
      setTimeout(() => {
        window.receiveHistoryBatch(batch);
      }, i / BATCH_SIZE * 10); // Small delay between batches
    }
  }

  /**
   * Clear all history and reset
   */
  public clear(): void {
    this.debugLogHistory = [];
    this.dtrResetMessage = null;
    this.cogWindows.clear();
  }

  /**
   * Get statistics about current state
   */
  public getStatistics(): any {
    return {
      registeredCOGs: Array.from(this.cogWindows.keys()),
      historySize: this.debugLogHistory.length,
      hasDTRReset: this.dtrResetMessage !== null
    };
  }
}