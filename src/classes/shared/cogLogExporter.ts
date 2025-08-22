/** @format */

// src/classes/shared/cogLogExporter.ts

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * COG log data for export
 */
interface COGLogData {
  cogId: number;
  messages: string[];
  hasTraffic: boolean;
  messageCount: number;
  firstMessageTime?: Date;
  lastMessageTime?: Date;
}

/**
 * Export result
 */
interface ExportResult {
  success: boolean;
  filesCreated: string[];
  baseLogPath: string;
  error?: string;
}

/**
 * COGLogExporter - Exports COG-separated debug logs
 * 
 * Features:
 * - Saves all 8 COG logs alongside main debug log
 * - Uses naming convention: mainlog.cog.0.log through mainlog.cog.7.log
 * - Handles empty COGs with informative header
 * - Single action exports all COGs
 */
export class COGLogExporter extends EventEmitter {
  private mainLogPath: string | null = null;
  private cogBuffers: Map<number, string[]> = new Map();
  private cogMetadata: Map<number, COGLogData> = new Map();

  constructor() {
    super();
    
    // Initialize buffers for all 8 COGs
    for (let i = 0; i < 8; i++) {
      this.cogBuffers.set(i, []);
      this.cogMetadata.set(i, {
        cogId: i,
        messages: [],
        hasTraffic: false,
        messageCount: 0
      });
    }
  }

  /**
   * Set the main log file path (needed for naming COG logs)
   */
  public setMainLogPath(logPath: string): void {
    this.mainLogPath = logPath;
  }

  /**
   * Add message to COG buffer
   */
  public addCOGMessage(cogId: number, message: string): void {
    if (cogId < 0 || cogId > 7) return;
    
    const buffer = this.cogBuffers.get(cogId)!;
    buffer.push(message);
    
    const metadata = this.cogMetadata.get(cogId)!;
    metadata.messages.push(message);
    metadata.hasTraffic = true;
    metadata.messageCount++;
    
    const now = new Date();
    if (!metadata.firstMessageTime) {
      metadata.firstMessageTime = now;
    }
    metadata.lastMessageTime = now;
  }

  /**
   * Export all COG logs to files (only COGs with traffic)
   */
  public async exportAllCOGLogs(): Promise<ExportResult> {
    if (!this.mainLogPath) {
      return {
        success: false,
        filesCreated: [],
        baseLogPath: '',
        error: 'Main log path not set - cannot determine output location'
      };
    }

    const filesCreated: string[] = [];
    const baseDir = path.dirname(this.mainLogPath);
    const baseName = path.basename(this.mainLogPath, '.log');
    
    try {
      // Export only COG logs that have traffic
      for (let cogId = 0; cogId < 8; cogId++) {
        const metadata = this.cogMetadata.get(cogId)!;
        
        // Skip empty COGs - no point creating empty files
        if (!metadata.hasTraffic || metadata.messageCount === 0) {
          continue;
        }
        
        // Use hyphen separator, not dots: timestamp-cog0.log
        const cogLogPath = path.join(baseDir, `${baseName}-cog${cogId}.log`);
        const content = this.generateCOGLogContent(cogId);
        
        await fs.promises.writeFile(cogLogPath, content, 'utf8');
        filesCreated.push(cogLogPath);
      }

      // Emit success event
      this.emit('exportComplete', {
        filesCreated,
        totalMessages: this.getTotalMessageCount(),
        timestamp: new Date()
      });

      return {
        success: true,
        filesCreated,
        baseLogPath: this.mainLogPath
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('exportError', {
        error: errorMsg,
        timestamp: new Date()
      });

      return {
        success: false,
        filesCreated,
        baseLogPath: this.mainLogPath,
        error: errorMsg
      };
    }
  }

  /**
   * Generate content for a COG log file
   */
  private generateCOGLogContent(cogId: number): string {
    const metadata = this.cogMetadata.get(cogId)!;
    const buffer = this.cogBuffers.get(cogId)!;
    
    const lines: string[] = [];
    
    // Add header
    lines.push('=' .repeat(80));
    lines.push(`COG ${cogId} Debug Log`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Main Log: ${this.mainLogPath ? path.basename(this.mainLogPath) : 'Unknown'}`);
    lines.push('=' .repeat(80));
    lines.push('');
    
    // Handle empty COG
    if (!metadata.hasTraffic || buffer.length === 0) {
      lines.push(`COG ${cogId} - No traffic received during this session`);
      lines.push('');
      lines.push('This COG did not send any debug messages during the logging period.');
      lines.push('If you expected traffic from this COG, verify:');
      lines.push('  1. The COG is running debug code');
      lines.push('  2. Debug output is enabled for this COG');
      lines.push('  3. The COG ID is correctly configured');
    } else {
      // Add statistics
      lines.push(`Message Count: ${metadata.messageCount}`);
      if (metadata.firstMessageTime) {
        lines.push(`First Message: ${metadata.firstMessageTime.toISOString()}`);
      }
      if (metadata.lastMessageTime) {
        lines.push(`Last Message: ${metadata.lastMessageTime.toISOString()}`);
      }
      lines.push('');
      lines.push('-'.repeat(80));
      lines.push('');
      
      // Add all messages
      for (const message of buffer) {
        lines.push(message);
      }
    }
    
    lines.push('');
    lines.push('=' .repeat(80));
    lines.push('End of COG ' + cogId + ' Log');
    lines.push('=' .repeat(80));
    
    return lines.join('\n');
  }

  /**
   * Get total message count across all COGs
   */
  private getTotalMessageCount(): number {
    let total = 0;
    for (const metadata of this.cogMetadata.values()) {
      total += metadata.messageCount;
    }
    return total;
  }

  /**
   * Clear all COG buffers
   */
  public clearAll(): void {
    for (let i = 0; i < 8; i++) {
      this.cogBuffers.set(i, []);
      this.cogMetadata.set(i, {
        cogId: i,
        messages: [],
        hasTraffic: false,
        messageCount: 0
      });
    }
  }

  /**
   * Get statistics for display
   */
  public getStatistics(): any {
    const stats = {
      mainLogPath: this.mainLogPath,
      totalMessages: this.getTotalMessageCount(),
      cogsWithTraffic: 0,
      cogDetails: [] as any[]
    };
    
    for (const [cogId, metadata] of this.cogMetadata) {
      if (metadata.hasTraffic) {
        stats.cogsWithTraffic++;
      }
      
      stats.cogDetails.push({
        cogId,
        messageCount: metadata.messageCount,
        hasTraffic: metadata.hasTraffic,
        bufferSize: this.cogBuffers.get(cogId)!.length
      });
    }
    
    return stats;
  }

  /**
   * Generate export summary for notification
   */
  public generateExportSummary(result: ExportResult): string {
    if (!result.success) {
      return `Failed to export COG logs: ${result.error}`;
    }
    
    const stats = this.getStatistics();
    const baseName = path.basename(this.mainLogPath || 'logs');
    
    if (stats.cogsWithTraffic === 0) {
      return `No COG logs to export - no COGs received traffic`;
    }
    
    // Extract COG IDs from created files
    const cogIds: number[] = [];
    for (const filePath of result.filesCreated) {
      const match = path.basename(filePath).match(/-cog(\d)\.log$/);
      if (match) {
        cogIds.push(parseInt(match[1], 10));
      }
    }
    
    if (cogIds.length === 1) {
      return `Exported COG ${cogIds[0]} log (${stats.totalMessages} messages) alongside ${baseName}`;
    } else if (cogIds.length === 8) {
      return `Exported all 8 COG logs (${stats.totalMessages} total messages) alongside ${baseName}`;
    } else {
      const cogList = cogIds.join(', ');
      return `Exported ${cogIds.length} COG logs (COGs ${cogList}) alongside ${baseName}`;
    }
  }
}