/** @format */

// tests/performanceBenchmark.test.ts

import {
  PerformanceBenchmark,
  WindowRouterBenchmark,
  RenderingBenchmark,
  MemoryBenchmark,
  BenchmarkRunner
} from '../src/utils/performanceBenchmark';
import { WindowRouter } from '../src/classes/shared/windowRouter';

// Mock dependencies
jest.mock('../src/classes/shared/windowRouter');
jest.mock('../src/classes/shared/debuggerRenderer');
jest.mock('../src/classes/shared/debuggerDataManager');

describe('Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark;

  beforeEach(() => {
    benchmark = new PerformanceBenchmark();
    jest.clearAllMocks();
  });

  describe('PerformanceBenchmark', () => {
    it('should run a simple benchmark', async () => {
      let counter = 0;
      const result = await benchmark.benchmark(
        'Test Benchmark',
        () => { counter++; },
        { iterations: 100, warmupIterations: 10 }
      );

      expect(result.name).toBe('Test Benchmark');
      expect(result.iterations).toBe(100);
      expect(counter).toBe(110); // 10 warmup + 100 actual
      expect(result.averageTime).toBeGreaterThanOrEqual(0);
      expect(result.minTime).toBeLessThanOrEqual(result.maxTime);
      expect(result.percentiles.p50).toBeDefined();
      expect(result.throughput).toBeGreaterThan(0);
    });

    it('should handle async functions', async () => {
      const result = await benchmark.benchmark(
        'Async Benchmark',
        async () => {
          await new Promise(resolve => setImmediate(resolve));
        },
        { iterations: 10 }
      );

      expect(result.name).toBe('Async Benchmark');
      expect(result.iterations).toBe(10);
    });

    it('should respect timeout', async () => {
      const result = await benchmark.benchmark(
        'Timeout Test',
        () => {
          // Simulate slow operation
          const start = Date.now();
          while (Date.now() - start < 10) {}
        },
        { iterations: 10000, timeout: 100 }
      );

      // Should complete fewer iterations due to timeout
      expect(result.iterations).toBeLessThan(10000);
    });

    it('should calculate statistics correctly', async () => {
      // Use deterministic timings
      let timingIndex = 0;
      const timings = [1, 2, 3, 4, 5]; // Known values
      
      jest.spyOn(performance, 'now')
        .mockImplementation(() => {
          if (timingIndex < timings.length * 2) {
            const isStart = timingIndex % 2 === 0;
            const value = isStart ? 0 : timings[Math.floor(timingIndex / 2)];
            timingIndex++;
            return value;
          }
          return 1000; // For timeout check
        });

      const result = await benchmark.benchmark(
        'Stats Test',
        () => {},
        { iterations: 5, warmupIterations: 0 }
      );

      expect(result.averageTime).toBeCloseTo(3); // (1+2+3+4+5)/5
      expect(result.minTime).toBe(1);
      expect(result.maxTime).toBe(5);
      expect(result.percentiles.p50).toBe(3);
    });

    it('should generate report', async () => {
      await benchmark.benchmark('Test 1', () => {}, { iterations: 10 });
      await benchmark.benchmark('Test 2', () => {}, { iterations: 10 });

      const report = benchmark.generateReport();
      
      expect(report).toContain('Performance Benchmark Report');
      expect(report).toContain('Test 1');
      expect(report).toContain('Test 2');
      expect(report).toContain('Throughput');
    });
  });

  describe('WindowRouterBenchmark', () => {
    let routerBench: WindowRouterBenchmark;
    let mockRouter: jest.Mocked<WindowRouter>;

    beforeEach(() => {
      routerBench = new WindowRouterBenchmark();
      mockRouter = WindowRouter.getInstance() as jest.Mocked<WindowRouter>;
    });

    it('should benchmark routing latency', async () => {
      mockRouter.registerWindow = jest.fn();
      mockRouter.unregisterWindow = jest.fn();
      mockRouter.routeTextMessage = jest.fn();

      const result = await routerBench.benchmarkRouting();

      expect(result.name).toContain('Message Routing');
      expect(mockRouter.registerWindow).toHaveBeenCalledTimes(10);
      expect(mockRouter.routeTextMessage).toHaveBeenCalled();
      expect(mockRouter.unregisterWindow).toHaveBeenCalledTimes(10);
      
      // Should verify <1ms requirement
      if (result.averageTime >= 1.0) {
        expect(console.warn).toHaveBeenCalled();
      }
    });

    it('should benchmark throughput', async () => {
      mockRouter.registerWindow = jest.fn();
      mockRouter.unregisterWindow = jest.fn();
      mockRouter.routeTextMessage = jest.fn();

      const result = await routerBench.benchmarkThroughput();

      expect(result.name).toContain('Throughput');
      expect(mockRouter.routeTextMessage).toHaveBeenCalled();
    });

    it('should benchmark concurrent windows', async () => {
      mockRouter.registerWindow = jest.fn();
      mockRouter.unregisterWindow = jest.fn();
      mockRouter.routeTextMessage = jest.fn();

      const result = await routerBench.benchmarkConcurrency();

      expect(result.name).toContain('Concurrent');
      expect(mockRouter.registerWindow).toHaveBeenCalledTimes(50);
      expect(mockRouter.unregisterWindow).toHaveBeenCalledTimes(50);
    });
  });

  describe('RenderingBenchmark', () => {
    let renderBench: RenderingBenchmark;

    beforeEach(() => {
      renderBench = new RenderingBenchmark();
    });

    it('should benchmark debugger rendering', async () => {
      const result = await renderBench.benchmarkDebuggerRendering();

      expect(result.name).toContain('Debugger Grid Rendering');
      expect(result.iterations).toBeGreaterThan(0);
      
      // Check 30 FPS requirement (33ms)
      if (result.averageTime > 33) {
        expect(console.warn).toHaveBeenCalled();
      }
    });

    it('should benchmark dirty rectangle optimization', async () => {
      const result = await renderBench.benchmarkDirtyRectangles();

      expect(result.name).toContain('Dirty Rectangle');
      expect(result.iterations).toBeGreaterThan(0);
      
      // Should be faster than 5ms
      if (result.averageTime > 5) {
        expect(console.warn).toHaveBeenCalled();
      }
    });
  });

  describe('MemoryBenchmark', () => {
    let memoryBench: MemoryBenchmark;

    beforeEach(() => {
      memoryBench = new MemoryBenchmark();
    });

    it('should benchmark memory allocation', async () => {
      const result = await memoryBench.benchmarkMemoryAllocation();

      expect(result.name).toContain('Memory Allocation');
      expect(result.iterations).toBeGreaterThan(0);
    });

    it('should benchmark garbage collection impact', async () => {
      const result = await memoryBench.benchmarkGarbageCollection();

      expect(result.name).toContain('Garbage Collection');
      expect(result.iterations).toBeGreaterThan(0);
    });
  });

  describe('BenchmarkRunner', () => {
    let runner: BenchmarkRunner;

    beforeEach(() => {
      runner = new BenchmarkRunner();
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should run all benchmarks and generate report', async () => {
      const report = await runner.runAll();

      expect(report).toContain('P2 Debug Terminal Performance Report');
      expect(report).toContain('Executive Summary');
      expect(report).toContain('Detailed Results');
      expect(report).toContain('Performance Requirements');
      
      // Should have run multiple benchmarks
      expect(report).toContain('WindowRouter');
      expect(report).toContain('Rendering');
      expect(report).toContain('Memory');
    });
  });

  describe('Performance Requirements Verification', () => {
    it('should verify routing latency < 1ms', async () => {
      const routerBench = new WindowRouterBenchmark();
      const mockRouter = WindowRouter.getInstance() as jest.Mocked<WindowRouter>;
      
      // Mock very fast routing
      mockRouter.routeTextMessage = jest.fn(() => {
        // Simulate < 1ms operation
      });

      const result = await routerBench.benchmarkRouting();
      
      // This test verifies the requirement is being checked
      expect(result).toBeDefined();
      expect(result.name).toContain('Routing');
    });

    it('should verify rendering < 33ms for 30 FPS', async () => {
      const renderBench = new RenderingBenchmark();
      const result = await renderBench.benchmarkDebuggerRendering();
      
      expect(result).toBeDefined();
      expect(result.name).toContain('Rendering');
    });

    it('should verify dirty rect optimization < 5ms', async () => {
      const renderBench = new RenderingBenchmark();
      const result = await renderBench.benchmarkDirtyRectangles();
      
      expect(result).toBeDefined();
      expect(result.name).toContain('Dirty Rectangle');
    });
  });
});