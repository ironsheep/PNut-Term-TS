/** @format */

// tests/performance2Mbps.test.ts

import { CircularBuffer } from '../src/classes/shared/circularBuffer';
import { MessageExtractor } from '../src/classes/shared/messageExtractor';
import { MessageRouter } from '../src/classes/shared/messageRouter';
import { MessageType } from '../src/classes/shared/messageExtractor';
import { SerialMessageProcessor } from '../src/classes/shared/serialMessageProcessor';
import { MessagePool } from '../src/classes/shared/messagePool';
import { PerformanceMonitor } from '../src/classes/shared/performanceMonitor';

describe('2Mbps Performance Stress Test', () => {
  let buffer: CircularBuffer;
  let extractor: MessageExtractor;
  let router: MessageRouter;
  let processor: SerialMessageProcessor;
  let pool: MessagePool;
  let monitor: PerformanceMonitor;
  
  beforeEach(() => {
    // Reset singletons
    (MessagePool as any).instance = undefined;
    
    // Initialize components
    buffer = new CircularBuffer();
    buffer.configure({
      size: 2 * 1024 * 1024,    // 2MB buffer
      minSize: 64 * 1024,        // 64KB min
      maxSize: 2 * 1024 * 1024,  // 2MB max
      baudRate: 2000000,         // 2 Mbps
      bufferTimeMs: 100          // 100ms buffer time
    });
    
    extractor = new MessageExtractor(buffer);
    router = new MessageRouter();
    processor = new SerialMessageProcessor(buffer, extractor, router);
    pool = MessagePool.getInstance();
    monitor = new PerformanceMonitor();
    
    // Configure pool for high throughput
    pool.configure({
      initialSize: 100,
      growthSize: 50,
      maxSize: 500,
      slowReleaseThresholdMs: 10
    });
  });
  
  afterEach(() => {
    processor.stop();
    pool.reset();
  });
  
  describe('Worst-Case Scenarios', () => {
    it('should handle continuous single-byte messages (LF stream)', (done) => {
      const targetBytesPerSecond = 2000000 / 8; // 250,000 bytes/sec
      const testDurationMs = 1000;
      const totalBytes = (targetBytesPerSecond * testDurationMs) / 1000;
      
      // Create worst-case data: all line feeds
      const lfStream = new Uint8Array(totalBytes);
      lfStream.fill(0x0A);
      
      let bytesProcessed = 0;
      let messagesExtracted = 0;
      let droppedBytes = 0;
      
      // Track extraction
      extractor.on('message', () => {
        messagesExtracted++;
      });
      
      // Track any drops
      buffer.on('overflow', (count) => {
        droppedBytes += count;
      });
      
      const startTime = Date.now();
      
      // Simulate 2Mbps stream
      const chunkSize = 25000; // Send in 25KB chunks (100us at 2Mbps)
      let offset = 0;
      
      const sendInterval = setInterval(() => {
        if (offset >= lfStream.length) {
          clearInterval(sendInterval);
          
          // Allow processing to complete
          setTimeout(() => {
            const elapsedMs = Date.now() - startTime;
            const effectiveThroughput = (bytesProcessed / elapsedMs) * 1000 * 8;
            
            console.log(`LF Stream Test Results:`);
            console.log(`  Duration: ${elapsedMs}ms`);
            console.log(`  Bytes sent: ${totalBytes}`);
            console.log(`  Messages extracted: ${messagesExtracted}`);
            console.log(`  Dropped bytes: ${droppedBytes}`);
            console.log(`  Effective throughput: ${(effectiveThroughput / 1000000).toFixed(2)} Mbps`);
            
            // Assertions
            expect(droppedBytes).toBe(0);
            expect(messagesExtracted).toBeGreaterThan(totalBytes * 0.95); // Allow 5% tolerance
            
            done();
          }, 500);
          return;
        }
        
        const chunk = lfStream.slice(offset, offset + chunkSize);
        const appended = buffer.appendAtTail(chunk);
        
        if (appended) {
          bytesProcessed += chunk.length;
          offset += chunkSize;
          
          // Trigger processing
          processor.processAvailableData();
        } else {
          droppedBytes += chunk.length;
        }
      }, 10); // Send every 10ms
    }, 30000); // 30 second timeout
    
    it('should handle mixed message sizes at 2Mbps', (done) => {
      const testDurationMs = 1000;
      const targetBytesPerSecond = 2000000 / 8;
      
      // Create mixed data: short messages, medium messages, binary packets
      const mixedData: Uint8Array[] = [];
      let totalSize = 0;
      
      while (totalSize < targetBytesPerSecond) {
        const messageType = Math.random();
        let message: Uint8Array;
        
        if (messageType < 0.3) {
          // Short terminal message
          message = new Uint8Array([...Buffer.from('OK\r\n')]);
        } else if (messageType < 0.6) {
          // Medium terminal message
          const text = `Debug output line ${Math.random()}\r\n`;
          message = new Uint8Array([...Buffer.from(text)]);
        } else if (messageType < 0.8) {
          // COG message
          const cogMsg = new Uint8Array([0xFE, ...Buffer.from(`Cog0 DATA ${Math.random()}\r`)]);
          message = cogMsg;
        } else {
          // Binary debugger packet
          const packet = new Uint8Array(82);
          packet[0] = 0xFF;
          packet[1] = 0x00;
          for (let i = 2; i < 82; i++) {
            packet[i] = Math.floor(Math.random() * 256);
          }
          message = packet;
        }
        
        mixedData.push(message);
        totalSize += message.length;
      }
      
      // Flatten to single array
      const dataStream = new Uint8Array(totalSize);
      let writeOffset = 0;
      for (const msg of mixedData) {
        dataStream.set(msg, writeOffset);
        writeOffset += msg.length;
      }
      
      let messagesRouted = 0;
      let droppedBytes = 0;
      
      router.on('message', () => {
        messagesRouted++;
      });
      
      buffer.on('overflow', (count) => {
        droppedBytes += count;
      });
      
      const startTime = Date.now();
      
      // Send data
      const chunkSize = 10000; // 10KB chunks
      let offset = 0;
      
      const sendInterval = setInterval(() => {
        if (offset >= dataStream.length) {
          clearInterval(sendInterval);
          
          setTimeout(() => {
            const elapsedMs = Date.now() - startTime;
            const throughput = (totalSize / elapsedMs) * 1000 * 8;
            
            console.log(`Mixed Messages Test Results:`);
            console.log(`  Duration: ${elapsedMs}ms`);
            console.log(`  Total bytes: ${totalSize}`);
            console.log(`  Messages routed: ${messagesRouted}`);
            console.log(`  Dropped bytes: ${droppedBytes}`);
            console.log(`  Throughput: ${(throughput / 1000000).toFixed(2)} Mbps`);
            
            expect(droppedBytes).toBe(0);
            expect(messagesRouted).toBeGreaterThan(0);
            
            done();
          }, 500);
          return;
        }
        
        const chunk = dataStream.slice(offset, offset + chunkSize);
        buffer.appendAtTail(chunk);
        offset += chunk.length;
        
        processor.processAvailableData();
      }, 5);
    }, 30000);
    
    it('should measure processing latency under load', (done) => {
      const measurements: number[] = [];
      const testMessages = 1000;
      let processed = 0;
      
      // Track latency for each message
      const originalExtract = extractor.extractMessages.bind(extractor);
      extractor.extractMessages = function() {
        const start = process.hrtime.bigint();
        const result = originalExtract();
        const end = process.hrtime.bigint();
        
        if (result) {
          const latencyNs = Number(end - start);
          measurements.push(latencyNs / 1000); // Convert to microseconds
          processed++;
        }
        
        return result;
      };
      
      // Generate test data
      const messages: Uint8Array[] = [];
      for (let i = 0; i < testMessages; i++) {
        messages.push(new Uint8Array([...Buffer.from(`Message ${i}\r\n`)]));
      }
      
      // Process all at once
      for (const msg of messages) {
        buffer.appendAtTail(msg);
      }
      
      // Process in batches
      const processInterval = setInterval(() => {
        processor.processAvailableData();
        
        if (processed >= testMessages) {
          clearInterval(processInterval);
          
          // Calculate statistics
          measurements.sort((a, b) => a - b);
          const avg = measurements.reduce((sum, v) => sum + v, 0) / measurements.length;
          const p50 = measurements[Math.floor(measurements.length * 0.5)];
          const p95 = measurements[Math.floor(measurements.length * 0.95)];
          const p99 = measurements[Math.floor(measurements.length * 0.99)];
          const max = measurements[measurements.length - 1];
          
          console.log(`Latency Statistics (microseconds):`);
          console.log(`  Average: ${avg.toFixed(1)}μs`);
          console.log(`  P50: ${p50.toFixed(1)}μs`);
          console.log(`  P95: ${p95.toFixed(1)}μs`);
          console.log(`  P99: ${p99.toFixed(1)}μs`);
          console.log(`  Max: ${max.toFixed(1)}μs`);
          
          // Performance requirements
          expect(avg).toBeLessThan(100);    // Average under 100μs
          expect(p95).toBeLessThan(500);    // P95 under 500μs
          expect(p99).toBeLessThan(1000);   // P99 under 1ms
          
          done();
        }
      }, 1);
    });
    
    it('should validate zero data loss with proper flow control', (done) => {
      const testBytes = 1000000; // 1MB test
      const testData = new Uint8Array(testBytes);
      
      // Create pattern that we can verify
      for (let i = 0; i < testBytes; i++) {
        testData[i] = i % 256;
      }
      
      const collectedData: number[] = [];
      let totalCollected = 0;
      
      // Collect all routed data
      router.on('message', (message: any) => {
        if (message.data) {
          for (const byte of message.data) {
            collectedData.push(byte);
            totalCollected++;
          }
        }
      });
      
      // Send data in realistic chunks
      const chunkSize = 4096; // 4KB chunks
      let offset = 0;
      let sendAttempts = 0;
      let backpressureEvents = 0;
      
      const sendInterval = setInterval(() => {
        if (offset >= testBytes) {
          clearInterval(sendInterval);
          
          // Wait for processing to complete
          setTimeout(() => {
            console.log(`Zero Loss Test Results:`);
            console.log(`  Bytes sent: ${testBytes}`);
            console.log(`  Bytes collected: ${totalCollected}`);
            console.log(`  Send attempts: ${sendAttempts}`);
            console.log(`  Backpressure events: ${backpressureEvents}`);
            
            // Verify no data loss
            expect(totalCollected).toBe(testBytes);
            
            // Verify data integrity
            let errors = 0;
            for (let i = 0; i < Math.min(1000, collectedData.length); i++) {
              if (collectedData[i] !== (i % 256)) {
                errors++;
              }
            }
            
            expect(errors).toBe(0);
            
            done();
          }, 1000);
          return;
        }
        
        const remaining = testBytes - offset;
        const size = Math.min(chunkSize, remaining);
        const chunk = testData.slice(offset, offset + size);
        
        sendAttempts++;
        const appended = buffer.appendAtTail(chunk);
        
        if (appended) {
          offset += size;
        } else {
          backpressureEvents++;
          // Apply backpressure - wait before retry
        }
        
        // Process available data
        processor.processAvailableData();
      }, 1);
    }, 30000);
  });
  
  describe('Performance Metrics', () => {
    it('should track message pool efficiency', () => {
      // Pre-warm the pool
      const messages = [];
      for (let i = 0; i < 50; i++) {
        const data = new Uint8Array([...Buffer.from(`Warmup ${i}\r\n`)]);
        buffer.appendAtTail(data);
      }
      
      processor.processAvailableData();
      
      const stats1 = pool.getStats();
      
      // Process more messages
      for (let i = 0; i < 100; i++) {
        const data = new Uint8Array([...Buffer.from(`Test ${i}\r\n`)]);
        buffer.appendAtTail(data);
      }
      
      processor.processAvailableData();
      
      const stats2 = pool.getStats();
      
      console.log(`Pool Efficiency:`);
      console.log(`  Initial: ${stats1.efficiency}`);
      console.log(`  After load: ${stats2.efficiency}`);
      console.log(`  Growth events: ${stats2.growthEvents}`);
      console.log(`  Slow releases: ${stats2.slowReleaseCount}`);
      
      // Efficiency should improve with use
      expect(parseFloat(stats2.efficiency)).toBeGreaterThan(50);
    });
    
    it('should measure batch extraction performance', () => {
      const batchSizes: number[] = [];
      const batchTimes: number[] = [];
      
      // Monitor batch extraction
      const originalProcess = processor.processAvailableData.bind(processor);
      let callCount = 0;
      
      processor.processAvailableData = function() {
        const start = process.hrtime.bigint();
        const result = originalProcess();
        const end = process.hrtime.bigint();
        
        const timeMs = Number(end - start) / 1000000;
        batchTimes.push(timeMs);
        callCount++;
        
        return result;
      };
      
      // Generate burst of messages
      for (let i = 0; i < 500; i++) {
        const msg = new Uint8Array([...Buffer.from(`Batch test ${i}\r\n`)]);
        buffer.appendAtTail(msg);
      }
      
      // Process
      for (let i = 0; i < 10; i++) {
        processor.processAvailableData();
      }
      
      const avgBatchTime = batchTimes.reduce((sum, t) => sum + t, 0) / batchTimes.length;
      
      console.log(`Batch Processing:`);
      console.log(`  Process calls: ${callCount}`);
      console.log(`  Avg batch time: ${avgBatchTime.toFixed(2)}ms`);
      
      expect(avgBatchTime).toBeLessThan(10); // Should process batches in under 10ms
    });
  });
});