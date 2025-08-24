/** @format */

// tests/performanceMonitor.test.ts

import { PerformanceMonitor } from '../src/classes/shared/performanceMonitor';
import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { MessageType } from '../src/classes/shared/messageExtractor';
import * as fs from 'fs';
import * as path from 'path';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let processor: SerialMessageProcessor;
  let receivedMessages: any[] = [];

  beforeEach(() => {
    // Clean up any existing log file
    const logPath = 'test-performance.log';
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }

    monitor = new PerformanceMonitor(logPath);
    processor = new SerialMessageProcessor(true, logPath);
    receivedMessages = [];

    // Set up test destination
    processor.registerDestination(MessageType.TEXT, {
      name: 'TestLogger',
      handler: (msg) => {
        receivedMessages.push(msg);
      }
    });

    processor.start();
  });

  afterEach(async () => {
    await processor.stop();
    monitor.close();
    
    // Clean up log file
    const logPath = 'test-performance.log';
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
  });

  describe('Metric Recording', () => {
    it('should record buffer metrics', () => {
      monitor.recordBufferMetrics(8192, 16384);
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.bufferUsagePercent).toBe(50);
    });

    it('should track buffer high water mark', () => {
      monitor.recordBufferMetrics(4096, 16384);
      monitor.recordBufferMetrics(8192, 16384);
      monitor.recordBufferMetrics(2048, 16384);
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.bufferHighWaterMark).toBe(50);
    });

    it('should record buffer overflows', () => {
      monitor.recordBufferOverflow();
      monitor.recordBufferOverflow();
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.bufferOverflows).toBe(2);
    });

    it('should record queue metrics', () => {
      monitor.recordQueueMetrics('TestQueue', 10, 'enqueue');
      monitor.recordQueueMetrics('TestQueue', 9, 'dequeue');
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.queues['TestQueue']).toBeDefined();
      expect(snapshot.metrics.queues['TestQueue'].totalEnqueued).toBe(1);
      expect(snapshot.metrics.queues['TestQueue'].totalDequeued).toBe(1);
    });

    it('should track queue high water mark', () => {
      monitor.recordQueueMetrics('TestQueue', 5, 'enqueue');
      monitor.recordQueueMetrics('TestQueue', 10, 'enqueue');
      monitor.recordQueueMetrics('TestQueue', 3, 'dequeue');
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.queues['TestQueue'].highWaterMark).toBe(10);
    });

    it('should record message latency', () => {
      const arrivalTime = Date.now() - 50;
      const processingTime = Date.now();
      
      monitor.recordMessageLatency(arrivalTime, processingTime);
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.messageLatency.min).toBeGreaterThanOrEqual(45);
      expect(snapshot.metrics.messageLatency.max).toBeLessThanOrEqual(55);
    });

    it('should calculate latency percentiles', () => {
      // Record multiple latency samples
      for (let i = 1; i <= 100; i++) {
        monitor.recordMessageLatency(Date.now() - i, Date.now());
      }
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.messageLatency.p50).toBeCloseTo(50, 0);
      expect(snapshot.metrics.messageLatency.p95).toBeCloseTo(95, 0);
      expect(snapshot.metrics.messageLatency.p99).toBeCloseTo(99, 0);
    });

    it('should track throughput rates', () => {
      // Record bytes
      for (let i = 0; i < 10; i++) {
        monitor.recordBytes(100);
      }
      
      // Record messages
      for (let i = 0; i < 5; i++) {
        monitor.recordMessage();
      }
      
      // Wait a bit for rate calculation
      jest.advanceTimersByTime(100);
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.throughput.bytesPerSecond).toBeGreaterThan(0);
      expect(snapshot.metrics.throughput.messagesPerSecond).toBeGreaterThan(0);
    });

    it('should record reset events', () => {
      monitor.recordDTRReset();
      monitor.recordDTRReset();
      monitor.recordRTSReset();
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.events.dtrResets).toBe(2);
      expect(snapshot.metrics.events.rtsResets).toBe(1);
    });

    it('should record errors', () => {
      monitor.recordExtractionError();
      monitor.recordRoutingError();
      monitor.recordRoutingError();
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.events.extractionErrors).toBe(1);
      expect(snapshot.metrics.events.routingErrors).toBe(2);
    });
  });

  describe('Threshold Alerts', () => {
    it('should emit threshold alert for high buffer usage', (done) => {
      monitor.on('threshold', (alert) => {
        expect(alert.type).toBe('buffer');
        expect(alert.usagePercent).toBeGreaterThan(80);
        done();
      });
      
      monitor.recordBufferMetrics(14000, 16384);
    });

    it('should emit threshold alert for high queue depth', (done) => {
      monitor.on('threshold', (alert) => {
        expect(alert.type).toBe('queue');
        expect(alert.depth).toBeGreaterThan(500);
        done();
      });
      
      monitor.recordQueueMetrics('TestQueue', 600, 'enqueue');
    });

    it('should emit threshold alert for high latency', (done) => {
      monitor.on('threshold', (alert) => {
        expect(alert.type).toBe('latency');
        expect(alert.latencyMs).toBeGreaterThan(100);
        done();
      });
      
      monitor.recordMessageLatency(Date.now() - 150, Date.now());
    });

    it('should allow custom thresholds', (done) => {
      monitor.setThresholds({
        bufferUsagePercent: 50,
        queueDepth: 10,
        latencyMs: 10
      });
      
      monitor.on('threshold', (alert) => {
        expect(alert.type).toBe('buffer');
        done();
      });
      
      monitor.recordBufferMetrics(9000, 16384);
    });
  });

  describe('Performance Snapshots', () => {
    it('should provide comprehensive snapshot', () => {
      // Generate some activity
      monitor.recordBufferMetrics(8192, 16384);
      monitor.recordQueueMetrics('Queue1', 10, 'enqueue');
      monitor.recordMessageLatency(Date.now() - 25, Date.now());
      monitor.recordBytes(1024);
      monitor.recordMessage();
      monitor.recordDTRReset();
      
      const snapshot = monitor.getSnapshot();
      
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.metrics.bufferUsagePercent).toBe(50);
      expect(snapshot.metrics.queues['Queue1']).toBeDefined();
      expect(snapshot.metrics.messageLatency.avg).toBeGreaterThan(0);
      expect(snapshot.metrics.throughput).toBeDefined();
      expect(snapshot.metrics.events.dtrResets).toBe(1);
    });

    it('should start and stop periodic snapshots', (done) => {
      let snapshotCount = 0;
      
      // Mock the logEvent method to count snapshots
      const originalLogEvent = (monitor as any).logEvent;
      (monitor as any).logEvent = (event: any) => {
        if (event.type === 'snapshot' && event.event === 'periodic') {
          snapshotCount++;
          if (snapshotCount === 2) {
            monitor.stopSnapshots();
            expect(snapshotCount).toBe(2);
            done();
          }
        }
        originalLogEvent.call(monitor, event);
      };
      
      monitor.startSnapshots(50);
    });
  });

  describe('Statistics Reset', () => {
    it('should reset all metrics', () => {
      // Generate activity
      monitor.recordBufferMetrics(8192, 16384);
      monitor.recordBufferOverflow();
      monitor.recordQueueMetrics('Queue1', 10, 'enqueue');
      monitor.recordDTRReset();
      monitor.recordExtractionError();
      
      // Reset
      monitor.reset();
      
      const snapshot = monitor.getSnapshot();
      expect(snapshot.metrics.bufferHighWaterMark).toBe(0);
      expect(snapshot.metrics.bufferOverflows).toBe(0);
      expect(Object.keys(snapshot.metrics.queues)).toHaveLength(0);
      expect(snapshot.metrics.events.dtrResets).toBe(0);
      expect(snapshot.metrics.events.extractionErrors).toBe(0);
    });
  });

  describe('Log File Output', () => {
    it('should write events to log file', (done) => {
      const logPath = 'test-write.log';
      const writeMonitor = new PerformanceMonitor(logPath);
      
      writeMonitor.recordBufferOverflow();
      writeMonitor.recordDTRReset();
      
      // Give it time to write
      setTimeout(() => {
        writeMonitor.close();
        
        // Check log file exists and has content
        expect(fs.existsSync(logPath)).toBe(true);
        
        const logContent = fs.readFileSync(logPath, 'utf8');
        const lines = logContent.trim().split('\n');
        
        expect(lines.length).toBeGreaterThan(0);
        
        // Parse and verify log entries
        const events = lines.map(line => JSON.parse(line));
        
        const overflowEvent = events.find(e => e.type === 'overflow');
        expect(overflowEvent).toBeDefined();
        
        const resetEvent = events.find(e => e.type === 'reset');
        expect(resetEvent).toBeDefined();
        
        // Clean up
        fs.unlinkSync(logPath);
        done();
      }, 100);
    });
  });

  describe('Integration with SerialMessageProcessor', () => {
    it('should track end-to-end performance', async () => {
      // Send messages through the pipeline
      for (let i = 0; i < 10; i++) {
        processor.receiveData(Buffer.from(`Test message ${i}\n`));
      }
      
      // Wait for processing
      await processor.waitForIdle(1000);
      
      const stats = processor.getStats();
      
      // Check performance metrics are collected
      expect(stats.performance).toBeDefined();
      expect(stats.performance.metrics.throughput.messagesPerSecond).toBeGreaterThan(0);
      expect(stats.performance.metrics.throughput.bytesPerSecond).toBeGreaterThan(0);
    });

    it('should track queue depths during burst', async () => {
      // Send burst of messages
      for (let i = 0; i < 100; i++) {
        processor.receiveData(Buffer.from(`Burst message ${i}\n`));
      }
      
      await processor.waitForIdle(2000);
      
      const stats = processor.getStats();
      const queueStats = stats.performance.metrics.queues;
      
      // Should have queue metrics
      expect(queueStats['ExtractorQueue']).toBeDefined();
      expect(queueStats['ExtractorQueue'].highWaterMark).toBeGreaterThan(0);
    });

    it('should track DTR reset performance', async () => {
      // Send messages before reset
      processor.receiveData(Buffer.from('Before reset\n'));
      
      await processor.waitForIdle(100);
      
      // Trigger DTR reset
      await processor.onDTRReset();
      
      // Send messages after reset
      processor.receiveData(Buffer.from('After reset\n'));
      
      await processor.waitForIdle(100);
      
      const stats = processor.getStats();
      
      expect(stats.performance.metrics.events.dtrResets).toBe(1);
    });

    it('should measure message latency', async () => {
      // Send messages and track timing
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        processor.receiveData(Buffer.from(`Latency test ${i}\n`));
      }
      
      await processor.waitForIdle(500);
      
      const stats = processor.getStats();
      const latency = stats.performance.metrics.messageLatency;
      
      expect(latency.min).toBeGreaterThanOrEqual(0);
      expect(latency.avg).toBeGreaterThan(0);
      expect(latency.max).toBeLessThan(500);
    });

    it('should handle performance monitoring without log file', () => {
      const noLogProcessor = new SerialMessageProcessor(false);
      noLogProcessor.start();
      
      noLogProcessor.receiveData(Buffer.from('Test\n'));
      
      const stats = noLogProcessor.getStats();
      expect(stats.performance).toBeDefined();
      
      noLogProcessor.stop();
    });
  });

  describe('Performance Under Load', () => {
    it('should track metrics during sustained load', async () => {
      const messageCount = 500;
      const messageSize = 100;
      
      // Send sustained load
      for (let i = 0; i < messageCount; i++) {
        const data = Buffer.alloc(messageSize, 'X');
        data[messageSize - 1] = 0x0A; // Add newline
        processor.receiveData(data);
        
        // Small delay to simulate sustained traffic
        await new Promise(resolve => setImmediate(resolve));
      }
      
      await processor.waitForIdle(5000);
      
      const stats = processor.getStats();
      
      // Verify metrics under load
      expect(stats.performance.metrics.throughput.bytesPerSecond).toBeGreaterThan(0);
      expect(stats.performance.metrics.throughput.messagesPerSecond).toBeGreaterThan(0);
      expect(stats.performance.metrics.messageLatency.p95).toBeDefined();
      
      // Check for any overflows
      if (stats.performance.metrics.bufferOverflows > 0) {
        console.log('Buffer overflows detected:', stats.performance.metrics.bufferOverflows);
      }
      
      expect(receivedMessages.length).toBeGreaterThan(0);
    });

    it('should identify bottlenecks', async () => {
      // Create artificial bottleneck with slow handler
      let slowHandlerDelay = 10;
      
      processor.registerDestination(MessageType.TEXT, {
        name: 'SlowHandler',
        handler: async (msg) => {
          await new Promise(resolve => setTimeout(resolve, slowHandlerDelay));
        }
      });
      
      // Send messages
      for (let i = 0; i < 50; i++) {
        processor.receiveData(Buffer.from(`Bottleneck test ${i}\n`));
      }
      
      await processor.waitForIdle(3000);
      
      const stats = processor.getStats();
      
      // Should show queue buildup
      expect(stats.performance.metrics.queues['ExtractorQueue'].highWaterMark).toBeGreaterThan(1);
      
      // Latency should be elevated
      expect(stats.performance.metrics.messageLatency.max).toBeGreaterThan(slowHandlerDelay);
    });
  });
});