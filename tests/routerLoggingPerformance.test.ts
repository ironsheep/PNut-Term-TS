/** @format */

// tests/routerLoggingPerformance.test.ts

import { WindowRouter } from '../src/classes/shared/windowRouter';
import { LogLevel } from '../src/classes/shared/routerLogger';
import { RouterDiagnostics } from '../src/classes/shared/routerDiagnostics';

describe('RouterLogger Performance Impact', () => {
  let router: WindowRouter;
  let diagnostics: RouterDiagnostics;
  
  beforeEach(() => {
    // Reset singleton
    (WindowRouter as any).instance = null;
    router = WindowRouter.getInstance();
    diagnostics = RouterDiagnostics.getInstance();
    
    // Register a test window
    router.registerWindow('test-window', 'terminal', () => {});
  });
  
  afterEach(() => {
    // Clean up
    WindowRouter.resetInstance();
  });
  
  describe('Performance Impact Measurement', () => {
    it('should maintain sub-1ms routing with DEBUG logging enabled', async () => {
      // Enable DEBUG level logging
      router.updateLoggerConfig({
        level: LogLevel.DEBUG,
        console: false, // Disable console to avoid output overhead
        file: false     // Disable file I/O overhead for pure routing test
      });
      
      const messages = [];
      const routingTimes = [];
      
      // Prepare test messages
      for (let i = 0; i < 1000; i++) {
        messages.push({
          type: 'text' as const,
          data: `Test message ${i} with some data content`,
          timestamp: Date.now(),
          source: 'test'
        });
      }
      
      // Measure routing performance with logging
      const startTime = performance.now();
      
      for (const message of messages) {
        const routingStart = performance.now();
        router.routeMessage(message);
        const routingEnd = performance.now();
        routingTimes.push(routingEnd - routingStart);
      }
      
      const totalTime = performance.now() - startTime;
      const averageRoutingTime = routingTimes.reduce((a, b) => a + b, 0) / routingTimes.length;
      const p95Time = routingTimes.sort((a, b) => a - b)[Math.floor(routingTimes.length * 0.95)];
      
      // Verify performance requirements
      expect(averageRoutingTime).toBeLessThan(1.0); // Average < 1ms
      expect(p95Time).toBeLessThan(2.0); // P95 < 2ms
      expect(totalTime).toBeLessThan(1000); // Total < 1 second for 1000 messages
      
      console.log(`Performance with DEBUG logging:
        - Average routing time: ${averageRoutingTime.toFixed(3)}ms
        - P95 routing time: ${p95Time.toFixed(3)}ms
        - Total time for 1000 messages: ${totalTime.toFixed(1)}ms
        - Throughput: ${(1000 / totalTime * 1000).toFixed(0)} messages/second`);
    });
    
    it('should maintain performance with TRACE logging enabled', async () => {
      // Enable TRACE level logging (most verbose)
      router.updateLoggerConfig({
        level: LogLevel.TRACE,
        console: false,
        file: false
      });
      
      const routingTimes = [];
      
      // Test with smaller batch for TRACE level
      for (let i = 0; i < 100; i++) {
        const message = {
          type: 'text' as const,
          data: `Trace test message ${i}`,
          timestamp: Date.now(),
          source: 'trace-test'
        };
        
        const startTime = performance.now();
        router.routeMessage(message);
        const endTime = performance.now();
        routingTimes.push(endTime - startTime);
      }
      
      const averageTime = routingTimes.reduce((a, b) => a + b, 0) / routingTimes.length;
      
      // Even with TRACE logging, routing should remain fast
      expect(averageTime).toBeLessThan(2.0); // Allow higher threshold for TRACE
      
      console.log(`Performance with TRACE logging:
        - Average routing time: ${averageTime.toFixed(3)}ms
        - Messages tested: ${routingTimes.length}`);
    });
    
    it('should demonstrate minimal overhead from logging infrastructure', async () => {
      const runWithLoggingLevel = async (level: LogLevel, messageCount: number) => {
        // Reset router state
        router.updateLoggerConfig({
          level: level,
          console: false,
          file: false
        });
        
        const routingTimes = [];
        
        for (let i = 0; i < messageCount; i++) {
          const message = {
            type: 'text' as const,
            data: `Benchmark message ${i}`,
            timestamp: Date.now(),
            source: 'benchmark'
          };
          
          const startTime = performance.now();
          router.routeMessage(message);
          const endTime = performance.now();
          routingTimes.push(endTime - startTime);
        }
        
        return {
          average: routingTimes.reduce((a, b) => a + b, 0) / routingTimes.length,
          p95: routingTimes.sort((a, b) => a - b)[Math.floor(routingTimes.length * 0.95)]
        };
      };
      
      // Test different logging levels
      const errorResults = await runWithLoggingLevel(LogLevel.ERROR, 500);
      const infoResults = await runWithLoggingLevel(LogLevel.INFO, 500);
      const debugResults = await runWithLoggingLevel(LogLevel.DEBUG, 500);
      
      // Verify logging overhead is minimal
      const errorToDebugRatio = debugResults.average / errorResults.average;
      expect(errorToDebugRatio).toBeLessThan(3.0); // Debug should be less than 3x slower
      
      console.log(`Logging level performance comparison:
        - ERROR level: ${errorResults.average.toFixed(3)}ms avg, ${errorResults.p95.toFixed(3)}ms p95
        - INFO level:  ${infoResults.average.toFixed(3)}ms avg, ${infoResults.p95.toFixed(3)}ms p95
        - DEBUG level: ${debugResults.average.toFixed(3)}ms avg, ${debugResults.p95.toFixed(3)}ms p95
        - Overhead ratio (DEBUG/ERROR): ${errorToDebugRatio.toFixed(2)}x`);
    });
  });
  
  describe('Binary Message Performance', () => {
    beforeEach(() => {
      // Register debugger window for binary message routing
      router.registerWindow('debugger-0', 'debugger', () => {});
    });
    
    it('should maintain performance for binary message routing', async () => {
      router.updateLoggerConfig({
        level: LogLevel.DEBUG,
        console: false,
        file: false
      });
      
      const routingTimes = [];
      
      for (let i = 0; i < 500; i++) {
        // Create binary message (80 bytes typical for P2 debugger)
        const binaryData = new Uint8Array(80);
        binaryData[0] = i & 0x07; // COG ID in lower 3 bits
        for (let j = 1; j < 80; j++) {
          binaryData[j] = (i + j) & 0xFF;
        }
        
        const startTime = performance.now();
        router.routeBinaryMessage(binaryData);
        const endTime = performance.now();
        routingTimes.push(endTime - startTime);
      }
      
      const averageTime = routingTimes.reduce((a, b) => a + b, 0) / routingTimes.length;
      const p95Time = routingTimes.sort((a, b) => a - b)[Math.floor(routingTimes.length * 0.95)];
      
      expect(averageTime).toBeLessThan(0.5); // Binary routing should be even faster
      expect(p95Time).toBeLessThan(1.0);
      
      console.log(`Binary message routing performance:
        - Average time: ${averageTime.toFixed(3)}ms
        - P95 time: ${p95Time.toFixed(3)}ms
        - Messages tested: ${routingTimes.length}`);
    });
  });
  
  describe('Diagnostic Tools Performance', () => {
    it('should provide fast diagnostic analysis', async () => {
      // Generate some routing activity first
      for (let i = 0; i < 100; i++) {
        router.routeMessage({
          type: 'text',
          data: `Activity message ${i}`,
          timestamp: Date.now(),
          source: 'test'
        });
      }
      
      // Test diagnostic operations
      const startTime = performance.now();
      
      const healthReport = diagnostics.generateHealthReport(router, (router as any).logger);
      const performanceAnalysis = diagnostics.analyzePerformance((router as any).logger);
      const messagePatterns = diagnostics.analyzeMessagePatterns((router as any).logger);
      
      const analysisTime = performance.now() - startTime;
      
      // Diagnostic analysis should be fast
      expect(analysisTime).toBeLessThan(50); // Less than 50ms for analysis
      
      // Verify results are meaningful
      expect(healthReport.status).toBeDefined();
      expect(performanceAnalysis.totalMessages).toBeGreaterThan(0);
      expect(Object.keys(messagePatterns.messageTypeDistribution)).toContain('text');
      
      console.log(`Diagnostic analysis performance:
        - Analysis time: ${analysisTime.toFixed(2)}ms
        - Health status: ${healthReport.status}
        - Messages analyzed: ${performanceAnalysis.totalMessages}`);
    });
    
    it('should handle large log buffers efficiently', async () => {
      // Fill up the circular buffer with activity
      for (let i = 0; i < 2000; i++) {
        router.routeMessage({
          type: 'text',
          data: `Buffer fill message ${i}`,
          timestamp: Date.now(),
          source: 'buffer-test'
        });
      }
      
      const startTime = performance.now();
      const recentEntries = router.getRecentLogEntries(1000);
      const retrievalTime = performance.now() - startTime;
      
      expect(retrievalTime).toBeLessThan(10); // Should be very fast
      expect(recentEntries.length).toBeGreaterThan(0);
      expect(recentEntries.length).toBeLessThanOrEqual(1000);
      
      console.log(`Circular buffer retrieval performance:
        - Retrieval time: ${retrievalTime.toFixed(2)}ms
        - Entries retrieved: ${recentEntries.length}`);
    });
  });
  
  describe('Memory Usage', () => {
    it('should maintain stable memory usage', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate sustained activity
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < 100; i++) {
          router.routeMessage({
            type: 'text',
            data: `Memory test message ${batch}-${i}`,
            timestamp: Date.now(),
            source: 'memory-test'
          });
        }
        
        // Allow some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory growth should be reasonable (less than 10MB for 1000 messages)
      expect(heapGrowth).toBeLessThan(10 * 1024 * 1024);
      
      console.log(`Memory usage test:
        - Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Growth: ${(heapGrowth / 1024 / 1024).toFixed(2)} MB`);
    });
  });
});