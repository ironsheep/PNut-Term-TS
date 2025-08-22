/** @format */

// src/classes/shared/recordingCatalog.ts

import * as fs from 'fs';
import * as path from 'path';

/**
 * Catalog entry for a recording session
 */
export interface CatalogEntry {
  sessionId: string;
  filename: string;
  metadata: {
    sessionName: string;
    description?: string;
    timestamp: number;
    duration?: number;
    messageCount?: number;
    fileSize?: number;
    p2Model?: string;
    serialPort?: string;
    baudRate?: number;
    windowTypes?: string[];
    testScenario?: string;
    expectedResults?: string;
    tags?: string[];
  };
}

/**
 * Recording catalog for managing recorded debug sessions
 */
export class RecordingCatalog {
  private catalogPath: string;
  private catalog: CatalogEntry[] = [];
  
  constructor(basePath: string = path.join(process.cwd(), 'tests', 'recordings')) {
    this.catalogPath = path.join(basePath, 'catalog.json');
    
    // Ensure directory exists
    const dir = path.dirname(this.catalogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.loadCatalog();
  }
  
  /**
   * Load catalog from disk
   */
  private loadCatalog(): void {
    if (fs.existsSync(this.catalogPath)) {
      try {
        const content = fs.readFileSync(this.catalogPath, 'utf-8');
        this.catalog = JSON.parse(content);
      } catch (error) {
        console.error('Failed to load catalog:', error);
        this.catalog = [];
      }
    } else {
      this.catalog = [];
      this.saveCatalog();
    }
  }
  
  /**
   * Save catalog to disk
   */
  private saveCatalog(): void {
    try {
      const content = JSON.stringify(this.catalog, null, 2);
      fs.writeFileSync(this.catalogPath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to save catalog:', error);
    }
  }
  
  /**
   * Add a new recording to the catalog
   */
  public addRecording(entry: CatalogEntry): void {
    // Remove any existing entry with same sessionId
    this.catalog = this.catalog.filter(e => e.sessionId !== entry.sessionId);
    
    // Add new entry
    this.catalog.push(entry);
    
    // Sort by timestamp (newest first)
    this.catalog.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
    
    this.saveCatalog();
  }
  
  /**
   * Update recording metadata after completion
   */
  public updateRecording(sessionId: string, updates: Partial<CatalogEntry['metadata']>): void {
    const entry = this.catalog.find(e => e.sessionId === sessionId);
    if (entry) {
      entry.metadata = { ...entry.metadata, ...updates };
      this.saveCatalog();
    }
  }
  
  /**
   * Get all recordings
   */
  public getAllRecordings(): CatalogEntry[] {
    return [...this.catalog];
  }
  
  /**
   * Get recordings by tag
   */
  public getRecordingsByTag(tag: string): CatalogEntry[] {
    return this.catalog.filter(e => e.metadata.tags?.includes(tag));
  }
  
  /**
   * Get recordings by window type
   */
  public getRecordingsByWindowType(windowType: string): CatalogEntry[] {
    return this.catalog.filter(e => e.metadata.windowTypes?.includes(windowType));
  }
  
  /**
   * Get recording by session ID
   */
  public getRecording(sessionId: string): CatalogEntry | undefined {
    return this.catalog.find(e => e.sessionId === sessionId);
  }
  
  /**
   * Delete a recording
   */
  public deleteRecording(sessionId: string): boolean {
    const entry = this.catalog.find(e => e.sessionId === sessionId);
    if (entry) {
      // Delete the file
      const filePath = path.join(path.dirname(this.catalogPath), 'sessions', entry.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Remove from catalog
      this.catalog = this.catalog.filter(e => e.sessionId !== sessionId);
      this.saveCatalog();
      return true;
    }
    return false;
  }
  
  /**
   * Get recent recordings
   */
  public getRecentRecordings(limit: number = 10): CatalogEntry[] {
    return this.catalog.slice(0, limit);
  }
  
  /**
   * Search recordings by description or name
   */
  public searchRecordings(query: string): CatalogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.catalog.filter(e => 
      e.metadata.sessionName.toLowerCase().includes(lowerQuery) ||
      e.metadata.description?.toLowerCase().includes(lowerQuery) ||
      e.metadata.testScenario?.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * Get total size of all recordings
   */
  public getTotalSize(): number {
    return this.catalog.reduce((sum, e) => sum + (e.metadata.fileSize || 0), 0);
  }
  
  /**
   * Clean up old recordings
   */
  public cleanupOldRecordings(daysToKeep: number = 30): number {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const toDelete = this.catalog.filter(e => e.metadata.timestamp < cutoffTime);
    
    let deleted = 0;
    for (const entry of toDelete) {
      if (this.deleteRecording(entry.sessionId)) {
        deleted++;
      }
    }
    
    return deleted;
  }
  
  /**
   * Export catalog to CSV
   */
  public exportToCSV(): string {
    const headers = ['Session ID', 'Name', 'Description', 'Date', 'Duration (ms)', 'Messages', 'Size (bytes)', 'Window Types'];
    const rows = this.catalog.map(e => [
      e.sessionId,
      e.metadata.sessionName,
      e.metadata.description || '',
      new Date(e.metadata.timestamp).toISOString(),
      e.metadata.duration || '',
      e.metadata.messageCount || '',
      e.metadata.fileSize || '',
      e.metadata.windowTypes?.join(';') || ''
    ]);
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }
}