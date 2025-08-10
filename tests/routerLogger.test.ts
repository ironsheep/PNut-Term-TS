/** @format */

// tests/routerLogger.test.ts

import { RouterLogger, LogLevel, LogEntry, PerformanceMetrics } from '../src/classes/shared/routerLogger';
import * as fs from 'fs';
import * as path from 'path';

describe('RouterLogger', () => {
  let logger: RouterLogger;
  let testLogDir: string;

  beforeEach(() => {
    // Create test log directory
    testLogDir = path.join(__dirname, 'test-logs');
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }

    // Clear environment variables
    delete process.env.ROUTER_LOG_LEVEL;
    delete process.env.ROUTER_LOG_CONSOLE;
    delete process.env.ROUTER_LOG_FILE;
    delete process.env.ROUTER_LOG_PATH;

    // Create logger with test configuration
    logger = new RouterLogger({
      level: LogLevel.TRACE,
      console: false, // Disable console for tests
      file: false,
      circularBufferSize: 100,
      maxBufferSize: 10,
      flushInterval: 50
    });
  });

  afterEach(() => {
    if (logger) {
      logger.destroy();
    }

    // Clean up test log directory
    if (fs.existsSync(testLogDir)) {
      const files = fs.readdirSync(testLogDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testLogDir, file));
      }
      fs.rmdirSync(testLogDir);
    }
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultLogger = new RouterLogger();
      const stats = defaultLogger.getStatistics();
      
      expect(stats.config.level).toBe(LogLevel.INFO);
      expect(stats.config.console).toBe(true);
      expect(stats.config.file).toBe(false);
      
      defaultLogger.destroy();
    });

    it('should load configuration from environment variables', () => {
      process.env.ROUTER_LOG_LEVEL = 'DEBUG';
      process.env.ROUTER_LOG_CONSOLE = 'false';
      process.env.ROUTER_LOG_FILE = 'true';

      const envLogger = new RouterLogger();
      const stats = envLogger.getStatistics();

      expect(stats.config.level).toBe(LogLevel.DEBUG);
      expect(stats.config.console).toBe(false);
      expect(stats.config.file).toBe(true);

      envLogger.destroy();
    });

    it('should update configuration dynamically', () => {
      logger.updateConfig({
        level: LogLevel.WARN,
        console: true,
        file: true
      });

      const stats = logger.getStatistics();
      expect(stats.config.level).toBe(LogLevel.WARN);
      expect(stats.config.console).toBe(true);
      expect(stats.config.file).toBe(true);
    });
  });

  describe('Logging Methods', () => {
    it('should log messages at different levels', () => {
      logger.trace('TEST', 'Trace message');
      logger.debug('TEST', 'Debug message');
      logger.info('TEST', 'Info message');
      logger.warn('TEST', 'Warning message');
      logger.error('TEST', 'Error message');

      const entries = logger.getRecentEntries();
      expect(entries).toHaveLength(5);
      expect(entries[0].level).toBe(LogLevel.TRACE);
      expect(entries[4].level).toBe(LogLevel.ERROR);
    });

    it('should respect log level filtering', () => {
      logger.updateConfig({ level: LogLevel.WARN });
      
      logger.trace('TEST', 'Should not appear');
      logger.debug('TEST', 'Should not appear');
      logger.info('TEST', 'Should not appear');
      logger.warn('TEST', 'Should appear');
      logger.error('TEST', 'Should appear');

      const entries = logger.getRecentEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe(LogLevel.WARN);
      expect(entries[1].level).toBe(LogLevel.ERROR);
    });

    it('should log routing operations', () => {
      logger.logRouting('debugger-0', 'binary', 1024, 0.5);
      
      const entries = logger.getRecentEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe('ROUTING');
      expect(entries[0].data.windowId).toBe('debugger-0');
      expect(entries[0].data.size).toBe(1024);
      expect(entries[0].data.routingTime).toBe(0.5);
    });

    it('should log performance metrics', () => {
      const metrics: PerformanceMetrics = {
        routingTime: 0.8,
        queueDepth: 5,
        throughput: 1000,
        bytesPerSecond: 50000,
        errorRate: 0.01
      };

      logger.logPerformance(metrics);
      
      const entries = logger.getRecentEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe('PERFORMANCE');
      expect(entries[0].data).toEqual(metrics);
    });

    it('should log errors with context', () => {
      const error = new Error('Test error');
      const context = { windowId: 'test-window' };

      logger.logError('TEST_CATEGORY', error, context);
      
      const entries = logger.getRecentEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(LogLevel.ERROR);
      expect(entries[0].data.error.message).toBe('Test error');
      expect(entries[0].data.context).toEqual(context);
    });
  });

  describe('Circular Buffer', () => {
    it('should maintain circular buffer of recent entries', () => {
      // Fill buffer beyond capacity
      for (let i = 0; i < 150; i++) {
        logger.info('TEST', `Message ${i}`);
      }

      const entries = logger.getRecentEntries();
      expect(entries.length).toBeLessThanOrEqual(100); // Circular buffer size
      
      // Should have most recent messages
      const lastEntry = entries[entries.length - 1];
      expect(lastEntry.message).toBe('Message 149');
    });

    it('should return limited number of recent entries', () => {
      for (let i = 0; i < 20; i++) {
        logger.info('TEST', `Message ${i}`);
      }

      const entries = logger.getRecentEntries(10);
      expect(entries).toHaveLength(10);
    });
  });

  describe('File Logging', () => {
    it('should write to file when enabled', (done) => {
      const logFile = path.join(testLogDir, 'test.log');
      
      logger.updateConfig({
        file: true,
        filePath: logFile,
        flushInterval: 10 // Fast flush for testing
      });

      logger.info('TEST', 'Test file message');
      
      // Wait for flush
      setTimeout(() => {
        expect(fs.existsSync(logFile)).toBe(true);
        const content = fs.readFileSync(logFile, 'utf8');
        expect(content).toContain('Test file message');
        done();
      }, 100);
    });

    it('should handle file errors gracefully', () => {
      const invalidPath = path.join('/', 'invalid', 'path', 'test.log');
      
      // Should not throw
      expect(() => {
        logger.updateConfig({
          file: true,
          filePath: invalidPath
        });
      }).not.toThrow();
    });
  });

  describe('Performance Tracking', () => {
    it('should track statistics', () => {
      logger.logRouting('test-1', 'binary', 100, 0.5);
      logger.logRouting('test-2', 'text', 200, 1.0);
      logger.logError('TEST', new Error('Test error'));

      const stats = logger.getStatistics();
      expect(stats.totalMessages).toBe(2);
      expect(stats.totalBytes).toBe(300);
      expect(stats.totalErrors).toBe(1);
    });
  });

  describe('Diagnostic Dump', () => {
    it('should generate diagnostic dump', () => {
      logger.info('TEST', 'Test message for dump');
      logger.logRouting('debugger-0', 'binary', 512, 0.3);
      
      const dump = logger.generateDiagnosticDump();
      const data = JSON.parse(dump);
      
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('config');
      expect(data).toHaveProperty('statistics');
      expect(data).toHaveProperty('recentEntries');
      
      expect(data.recentEntries.length).toBeGreaterThan(0);
      expect(data.statistics.totalMessages).toBeGreaterThan(0);
    });

    it('should save diagnostic dump to file', () => {
      const dumpFile = path.join(testLogDir, 'diagnostic.json');
      
      logger.info('TEST', 'Test message');
      const savedPath = logger.saveDiagnosticDump(dumpFile);
      
      expect(savedPath).toBe(dumpFile);
      expect(fs.existsSync(dumpFile)).toBe(true);
      
      const content = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
      expect(content).toHaveProperty('timestamp');
      expect(content).toHaveProperty('statistics');
    });
  });

  describe('Buffer Management', () => {
    it('should flush buffer automatically when full', (done) => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      logger.updateConfig({
        console: true,
        maxBufferSize: 3,
        flushInterval: 1000 // Long interval to test buffer size trigger
      });

      // Fill buffer beyond capacity
      logger.info('TEST', 'Message 1');
      logger.info('TEST', 'Message 2');
      logger.info('TEST', 'Message 3');
      logger.info('TEST', 'Message 4'); // Should trigger flush

      // Give time for flush
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
        done();
      }, 50);
    });

    it('should flush buffer on timer', (done) => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      logger.updateConfig({
        console: true,
        flushInterval: 25 // Fast flush
      });

      logger.info('TEST', 'Timer flush test');

      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
        done();
      }, 75);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const fileLogger = new RouterLogger({
        file: true,
        filePath: path.join(testLogDir, 'cleanup.log')
      });

      fileLogger.info('TEST', 'Test message');
      
      // Should not throw
      expect(() => fileLogger.destroy()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle unserializable data', () => {
      const circular: any = {};
      circular.self = circular;

      // Should not throw
      expect(() => {
        logger.info('TEST', 'Circular reference test', circular);
      }).not.toThrow();

      const entries = logger.getRecentEntries();
      expect(entries).toHaveLength(1);
    });

    it('should handle empty or null messages', () => {
      logger.info('TEST', '');
      logger.info('TEST', null as any);
      logger.info('TEST', undefined as any);

      const entries = logger.getRecentEntries();
      expect(entries).toHaveLength(3);
    });
  });
});