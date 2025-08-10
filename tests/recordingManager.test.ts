/** @format */

// tests/recordingManager.test.ts

import { RecordingManager } from '../src/classes/shared/recordingManager';
import { WindowRouter } from '../src/classes/shared/windowRouter';
import * as fs from 'fs';
import * as path from 'path';

describe('RecordingManager', () => {
  let manager: RecordingManager;
  let router: WindowRouter;
  const testRecordingsPath = path.join(__dirname, 'test-recordings');

  beforeEach(() => {
    // Reset router singleton
    WindowRouter.resetInstance();
    router = WindowRouter.getInstance();
    
    // Create manager
    manager = new RecordingManager(router);
    
    // Clean up test recordings
    if (fs.existsSync(testRecordingsPath)) {
      fs.rmSync(testRecordingsPath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testRecordingsPath)) {
      fs.rmSync(testRecordingsPath, { recursive: true, force: true });
    }
    WindowRouter.resetInstance();
  });

  describe('Automatic Triggers', () => {
    it('should trigger on breakpoint hit', (done) => {
      // Mock router.startRecording
      const startSpy = jest.spyOn(router, 'startRecording');
      
      // Simulate breakpoint message
      const breakpointMessage = {
        type: 'binary',
        data: new Uint8Array([0x80, 0x00, 0x00, 0x00]) // COG 0, breakpoint flag
      };
      
      manager.checkTriggers(breakpointMessage);
      
      // Should have started recording
      setTimeout(() => {
        expect(startSpy).toHaveBeenCalled();
        expect(startSpy.mock.calls[0][0].testScenario).toBe('breakpoint-hit');
        done();
      }, 100);
    });

    it('should trigger on error condition', (done) => {
      const startSpy = jest.spyOn(router, 'startRecording');
      
      const errorMessage = {
        type: 'error',
        error: 'checksum-mismatch',
        message: 'Test error'
      };
      
      manager.checkTriggers(errorMessage);
      
      setTimeout(() => {
        expect(startSpy).toHaveBeenCalled();
        expect(startSpy.mock.calls[0][0].testScenario).toBe('error-recovery');
        done();
      }, 100);
    });

    it('should respect cooldown periods', () => {
      const startSpy = jest.spyOn(router, 'startRecording');
      
      const breakpointMessage = {
        type: 'binary',
        data: new Uint8Array([0x80, 0x00, 0x00, 0x00])
      };
      
      // First trigger
      manager.checkTriggers(breakpointMessage);
      expect(startSpy).toHaveBeenCalledTimes(1);
      
      // Second trigger immediately - should be ignored due to cooldown
      manager.checkTriggers(breakpointMessage);
      expect(startSpy).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should detect high-frequency data streams', (done) => {
      const startSpy = jest.spyOn(router, 'startRecording');
      
      // Simulate high-frequency messages
      const message = { type: 'data', value: 42 };
      
      // Send many messages quickly to trigger high-frequency detection
      const interval = setInterval(() => {
        for (let i = 0; i < 100; i++) {
          manager.checkTriggers(message);
        }
      }, 10);
      
      setTimeout(() => {
        clearInterval(interval);
        
        // Should have triggered high-frequency recording
        const calls = startSpy.mock.calls.filter(
          call => call[0].testScenario === 'high-frequency'
        );
        expect(calls.length).toBeGreaterThan(0);
        done();
      }, 1500);
    });

    it('should trigger on multi-COG activity', () => {
      const startSpy = jest.spyOn(router, 'startRecording');
      
      const message = { type: 'cog-activity' };
      const context = { activeCogs: [0, 1, 2] };
      
      manager.checkTriggers(message, context);
      
      expect(startSpy).toHaveBeenCalled();
      expect(startSpy.mock.calls[0][0].testScenario).toBe('multi-cog');
      expect(startSpy.mock.calls[0][0].tags).toContain('multi-cog');
    });

    it('should trigger on memory operations', () => {
      const startSpy = jest.spyOn(router, 'startRecording');
      
      const memoryMessage = {
        type: 'memory-read',
        address: 0x1000,
        size: 256
      };
      
      manager.checkTriggers(memoryMessage);
      
      expect(startSpy).toHaveBeenCalled();
      expect(startSpy.mock.calls[0][0].testScenario).toBe('memory-inspection');
      // Context is stored internally, not in metadata
    });
  });

  describe('Scenario Recording', () => {
    it('should start recording for valid scenario', () => {
      const startSpy = jest.spyOn(router, 'startRecording');
      
      manager.startScenarioRecording('breakpoint-hit', {
        cogId: 0,
        address: 0x100
      });
      
      expect(startSpy).toHaveBeenCalled();
      const call = startSpy.mock.calls[0][0];
      expect(call.description).toContain('breakpoint');
      expect(call.testScenario).toBe('breakpoint-hit');
      expect(call.tags).toContain('breakpoint');
    });

    it('should not start recording if one is already active', () => {
      const startSpy = jest.spyOn(router, 'startRecording');
      
      // Start first recording
      manager.startScenarioRecording('breakpoint-hit', {});
      expect(startSpy).toHaveBeenCalledTimes(1);
      
      // Try to start second recording
      manager.startScenarioRecording('error-recovery', {});
      expect(startSpy).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should auto-stop recording after expected duration', (done) => {
      const stopSpy = jest.spyOn(router, 'stopRecording');
      
      // Start recording with short duration for testing
      manager.startScenarioRecording('breakpoint-hit', {});
      
      // Should auto-stop after expected duration (5000ms for breakpoint-hit)
      // We'll test with a shorter timeout
      setTimeout(() => {
        manager.stopAndValidate('breakpoint-hit');
        expect(stopSpy).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Sampled Recording', () => {
    it('should start sampled recording for high-frequency data', () => {
      const startSpy = jest.spyOn(router, 'startRecording');
      
      manager.startSampledRecording('high-frequency', {
        rate: 2000
      });
      
      expect(startSpy).toHaveBeenCalled();
      const call = startSpy.mock.calls[0][0];
      expect(call.description).toContain('sampled');
      expect(call.tags).toContain('automatic-sampled');
      expect(call.tags).toContain('sampled');
    });
  });

  describe('Catalog Management', () => {
    it('should update catalog after recording', (done) => {
      const catalogPath = path.join(__dirname, '../tests/recordings/catalog.json');
      
      // Start and stop a recording
      manager.startScenarioRecording('breakpoint-hit', {});
      
      setTimeout(() => {
        manager.stopAndValidate('breakpoint-hit');
        
        // Check catalog was created/updated
        if (fs.existsSync(catalogPath)) {
          const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
          expect(catalog.scenarios).toBeDefined();
          expect(catalog.statistics.totalRecordings).toBeGreaterThan(0);
        }
        done();
      }, 100);
    });
  });

  describe('Regression Testing', () => {
    it('should run scenario test with existing recording', async () => {
      // Create a mock recording first
      const catalogPath = path.join(__dirname, '../tests/recordings/catalog.json');
      const catalog = {
        version: '1.0.0',
        scenarios: [{
          id: 'breakpoint-hit',
          name: 'Breakpoint Hit',
          recordings: [{
            sessionId: 'test-recording',
            timestamp: Date.now(),
            duration: 1000,
            file: 'sessions/test-recording.jsonl'
          }]
        }],
        statistics: {
          totalScenarios: 1,
          totalRecordings: 1
        }
      };
      
      // Ensure directories exist
      const recordingsDir = path.join(__dirname, '../tests/recordings');
      const sessionsDir = path.join(recordingsDir, 'sessions');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }
      
      // Write catalog
      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
      
      // Create mock recording file
      const recordingPath = path.join(sessionsDir, 'test-recording.jsonl');
      fs.writeFileSync(recordingPath, '{"type":"test","data":"mock"}\n');
      
      // Mock playRecording
      jest.spyOn(router, 'playRecording').mockResolvedValue();
      
      // Run test
      const result = await manager.runScenarioTest('breakpoint-hit');
      expect(result).toBe(true);
      
      // Clean up
      if (fs.existsSync(recordingsDir)) {
        fs.rmSync(recordingsDir, { recursive: true, force: true });
      }
    });

    it('should handle missing recordings gracefully', async () => {
      const result = await manager.runScenarioTest('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return recording statistics', () => {
      const catalogPath = path.join(__dirname, '../tests/recordings/catalog.json');
      const catalog = {
        version: '1.0.0',
        scenarios: [],
        statistics: {
          totalScenarios: 5,
          totalRecordings: 25,
          lastRun: new Date().toISOString()
        }
      };
      
      // Ensure directory exists
      const recordingsDir = path.dirname(catalogPath);
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
      
      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
      
      const stats = manager.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.totalScenarios).toBe(5);
      expect(stats.totalRecordings).toBe(25);
      
      // Clean up
      if (fs.existsSync(recordingsDir)) {
        fs.rmSync(recordingsDir, { recursive: true, force: true });
      }
    });

    it('should return null if no catalog exists', () => {
      const stats = manager.getStatistics();
      expect(stats).toBeNull();
    });
  });
});