/** @format */

// tests/recordingCatalog.test.ts

import { RecordingCatalog, CatalogEntry } from '../src/classes/shared/recordingCatalog';
import * as fs from 'fs';
import * as path from 'path';

describe('RecordingCatalog', () => {
  const testBasePath = path.join(process.cwd(), 'tests', 'test-recordings');
  const catalogPath = path.join(testBasePath, 'catalog.json');
  let catalog: RecordingCatalog;
  
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
    fs.mkdirSync(testBasePath, { recursive: true });
    
    // Create new catalog
    catalog = new RecordingCatalog(testBasePath);
  });
  
  afterEach(() => {
    // Clean up
    if (fs.existsSync(testBasePath)) {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    }
  });
  
  describe('Catalog Creation', () => {
    it('should create catalog file on initialization', () => {
      expect(fs.existsSync(catalogPath)).toBe(true);
    });
    
    it('should initialize with empty catalog', () => {
      const recordings = catalog.getAllRecordings();
      expect(recordings).toEqual([]);
    });
  });
  
  describe('Recording Management', () => {
    it('should add a recording to catalog', () => {
      const entry: CatalogEntry = {
        sessionId: 'test-001',
        filename: 'test-001.jsonl',
        metadata: {
          sessionName: 'Test Session',
          description: 'Test recording',
          timestamp: Date.now(),
          windowTypes: ['terminal', 'scope']
        }
      };
      
      catalog.addRecording(entry);
      
      const recordings = catalog.getAllRecordings();
      expect(recordings).toHaveLength(1);
      expect(recordings[0].sessionId).toBe('test-001');
    });
    
    it('should update recording metadata', () => {
      const entry: CatalogEntry = {
        sessionId: 'test-002',
        filename: 'test-002.jsonl',
        metadata: {
          sessionName: 'Test Session',
          timestamp: Date.now()
        }
      };
      
      catalog.addRecording(entry);
      catalog.updateRecording('test-002', {
        duration: 5000,
        messageCount: 100,
        fileSize: 1024
      });
      
      const updated = catalog.getRecording('test-002');
      expect(updated?.metadata.duration).toBe(5000);
      expect(updated?.metadata.messageCount).toBe(100);
      expect(updated?.metadata.fileSize).toBe(1024);
    });
    
    it('should sort recordings by timestamp (newest first)', () => {
      const now = Date.now();
      
      catalog.addRecording({
        sessionId: 'old',
        filename: 'old.jsonl',
        metadata: { sessionName: 'Old', timestamp: now - 1000 }
      });
      
      catalog.addRecording({
        sessionId: 'new',
        filename: 'new.jsonl',
        metadata: { sessionName: 'New', timestamp: now }
      });
      
      const recordings = catalog.getAllRecordings();
      expect(recordings[0].sessionId).toBe('new');
      expect(recordings[1].sessionId).toBe('old');
    });
    
    it('should replace existing recording with same sessionId', () => {
      const entry1: CatalogEntry = {
        sessionId: 'test-003',
        filename: 'test-003.jsonl',
        metadata: {
          sessionName: 'Original',
          timestamp: Date.now()
        }
      };
      
      const entry2: CatalogEntry = {
        sessionId: 'test-003',
        filename: 'test-003.jsonl',
        metadata: {
          sessionName: 'Updated',
          timestamp: Date.now()
        }
      };
      
      catalog.addRecording(entry1);
      catalog.addRecording(entry2);
      
      const recordings = catalog.getAllRecordings();
      expect(recordings).toHaveLength(1);
      expect(recordings[0].metadata.sessionName).toBe('Updated');
    });
  });
  
  describe('Recording Queries', () => {
    beforeEach(() => {
      // Add test recordings
      catalog.addRecording({
        sessionId: 'test-1',
        filename: 'test-1.jsonl',
        metadata: {
          sessionName: 'Debug Test',
          description: 'Testing debugger',
          timestamp: Date.now(),
          windowTypes: ['debugger', 'terminal'],
          tags: ['debug', 'test']
        }
      });
      
      catalog.addRecording({
        sessionId: 'test-2',
        filename: 'test-2.jsonl',
        metadata: {
          sessionName: 'Scope Analysis',
          description: 'Analyzing scope data',
          timestamp: Date.now() - 1000,
          windowTypes: ['scope', 'terminal'],
          tags: ['scope', 'analysis']
        }
      });
      
      catalog.addRecording({
        sessionId: 'test-3',
        filename: 'test-3.jsonl',
        metadata: {
          sessionName: 'Performance Test',
          testScenario: 'High frequency data',
          timestamp: Date.now() - 2000,
          windowTypes: ['fft', 'scope'],
          tags: ['performance', 'test']
        }
      });
    });
    
    it('should get recordings by tag', () => {
      const testRecordings = catalog.getRecordingsByTag('test');
      expect(testRecordings).toHaveLength(2);
      expect(testRecordings.map(r => r.sessionId)).toContain('test-1');
      expect(testRecordings.map(r => r.sessionId)).toContain('test-3');
    });
    
    it('should get recordings by window type', () => {
      const scopeRecordings = catalog.getRecordingsByWindowType('scope');
      expect(scopeRecordings).toHaveLength(2);
      expect(scopeRecordings.map(r => r.sessionId)).toContain('test-2');
      expect(scopeRecordings.map(r => r.sessionId)).toContain('test-3');
    });
    
    it('should get recording by session ID', () => {
      const recording = catalog.getRecording('test-2');
      expect(recording).toBeDefined();
      expect(recording?.metadata.sessionName).toBe('Scope Analysis');
    });
    
    it('should get recent recordings', () => {
      const recent = catalog.getRecentRecordings(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].sessionId).toBe('test-1');
      expect(recent[1].sessionId).toBe('test-2');
    });
    
    it('should search recordings by query', () => {
      const results = catalog.searchRecordings('scope');
      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe('test-2');
      
      const results2 = catalog.searchRecordings('test');
      expect(results2).toHaveLength(2); // Debug Test and Performance Test
      
      const results3 = catalog.searchRecordings('frequency');
      expect(results3).toHaveLength(1);
      expect(results3[0].sessionId).toBe('test-3');
    });
  });
  
  describe('Recording Deletion', () => {
    it('should delete recording and remove from catalog', () => {
      const entry: CatalogEntry = {
        sessionId: 'to-delete',
        filename: 'to-delete.jsonl',
        metadata: {
          sessionName: 'Delete Me',
          timestamp: Date.now()
        }
      };
      
      // Create a dummy file
      const sessionsDir = path.join(testBasePath, 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });
      const filePath = path.join(sessionsDir, 'to-delete.jsonl');
      fs.writeFileSync(filePath, 'test content');
      
      catalog.addRecording(entry);
      expect(catalog.getAllRecordings()).toHaveLength(1);
      expect(fs.existsSync(filePath)).toBe(true);
      
      const deleted = catalog.deleteRecording('to-delete');
      expect(deleted).toBe(true);
      expect(catalog.getAllRecordings()).toHaveLength(0);
      expect(fs.existsSync(filePath)).toBe(false);
    });
    
    it('should return false when deleting non-existent recording', () => {
      const deleted = catalog.deleteRecording('non-existent');
      expect(deleted).toBe(false);
    });
  });
  
  describe('Catalog Statistics', () => {
    it('should calculate total size', () => {
      catalog.addRecording({
        sessionId: 'size-1',
        filename: 'size-1.jsonl',
        metadata: {
          sessionName: 'Size Test 1',
          timestamp: Date.now(),
          fileSize: 1024
        }
      });
      
      catalog.addRecording({
        sessionId: 'size-2',
        filename: 'size-2.jsonl',
        metadata: {
          sessionName: 'Size Test 2',
          timestamp: Date.now(),
          fileSize: 2048
        }
      });
      
      const totalSize = catalog.getTotalSize();
      expect(totalSize).toBe(3072);
    });
  });
  
  describe('Cleanup Operations', () => {
    it('should cleanup old recordings', () => {
      const now = Date.now();
      const oldTime = now - (31 * 24 * 60 * 60 * 1000); // 31 days ago
      
      // Create old recording file
      const sessionsDir = path.join(testBasePath, 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.writeFileSync(path.join(sessionsDir, 'old.jsonl'), 'old');
      fs.writeFileSync(path.join(sessionsDir, 'recent.jsonl'), 'recent');
      
      catalog.addRecording({
        sessionId: 'old',
        filename: 'old.jsonl',
        metadata: {
          sessionName: 'Old Recording',
          timestamp: oldTime
        }
      });
      
      catalog.addRecording({
        sessionId: 'recent',
        filename: 'recent.jsonl',
        metadata: {
          sessionName: 'Recent Recording',
          timestamp: now
        }
      });
      
      const deleted = catalog.cleanupOldRecordings(30);
      expect(deleted).toBe(1);
      expect(catalog.getAllRecordings()).toHaveLength(1);
      expect(catalog.getAllRecordings()[0].sessionId).toBe('recent');
    });
  });
  
  describe('Export Operations', () => {
    it('should export catalog to CSV', () => {
      catalog.addRecording({
        sessionId: 'csv-1',
        filename: 'csv-1.jsonl',
        metadata: {
          sessionName: 'CSV Test',
          description: 'Testing CSV export',
          timestamp: Date.now(),
          duration: 5000,
          messageCount: 100,
          fileSize: 1024,
          windowTypes: ['terminal', 'scope']
        }
      });
      
      const csv = catalog.exportToCSV();
      expect(csv).toContain('Session ID');
      expect(csv).toContain('csv-1');
      expect(csv).toContain('CSV Test');
      expect(csv).toContain('Testing CSV export');
      expect(csv).toContain('terminal;scope');
    });
  });
  
  describe('Persistence', () => {
    it('should persist catalog to disk', () => {
      catalog.addRecording({
        sessionId: 'persist-1',
        filename: 'persist-1.jsonl',
        metadata: {
          sessionName: 'Persistence Test',
          timestamp: Date.now()
        }
      });
      
      // Create new catalog instance to load from disk
      const catalog2 = new RecordingCatalog(testBasePath);
      const recordings = catalog2.getAllRecordings();
      
      expect(recordings).toHaveLength(1);
      expect(recordings[0].sessionId).toBe('persist-1');
    });
    
    it('should handle corrupted catalog file', () => {
      // Write invalid JSON
      fs.writeFileSync(catalogPath, 'invalid json{');
      
      // Should recover and create empty catalog
      const catalog2 = new RecordingCatalog(testBasePath);
      expect(catalog2.getAllRecordings()).toEqual([]);
    });
  });
});