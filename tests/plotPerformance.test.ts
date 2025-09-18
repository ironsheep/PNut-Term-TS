/** @format */

/**
 * Performance test scenarios for PLOT window system
 * Tests realistic P2 debug scenarios and stress conditions
 */

import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { PlotPerformanceMonitor } from '../src/classes/shared/plotPerformanceMonitor';
import { Context } from '../src/utils/context';

describe('PLOT Performance Tests', () => {
  let parser: PlotCommandParser;
  let monitor: PlotPerformanceMonitor;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {} as Context;
    parser = new PlotCommandParser(mockContext);
    monitor = new PlotPerformanceMonitor({
      targetFPS: 60,
      maxCommandTime: 10,
      maxRenderTime: 16,
      memoryWarningThreshold: 100 * 1024 * 1024
    });
  });

  describe('Command Processing Performance', () => {
    test('should process simple commands within time limits', () => {
      const simpleCommands = [
        'DOT',
        'LINE 100 100',
        'CIRCLE 50',
        'TEXT "Hello"',
        'COLORMODE 0'
      ];

      simpleCommands.forEach(cmd => {
        monitor.commandStart();
        const commands = parser.parse(cmd);
        const results = parser.executeCommands(commands);
        monitor.commandEnd();

        expect(commands[0].isValid).toBe(true);
        expect(results[0].success).toBe(true);
      });

      const metrics = monitor.getMetrics();
      expect(metrics.averageCommandTime).toBeLessThan(10); // 10ms target
      expect(metrics.totalCommandsProcessed).toBe(simpleCommands.length);
    });

    test('should handle rapid command sequences efficiently', () => {
      const rapidCommands = Array.from({ length: 100 }, (_, i) => `DOT ${i} ${i}`);

      const startTime = performance.now();

      rapidCommands.forEach(cmd => {
        monitor.commandStart();
        const commands = parser.parse(cmd);
        parser.executeCommands(commands);
        monitor.commandEnd();
      });

      const totalTime = performance.now() - startTime;
      const metrics = monitor.getMetrics();

      expect(totalTime).toBeLessThan(1000); // 1 second for 100 commands
      expect(metrics.averageCommandTime).toBeLessThan(10);
      expect(metrics.commandsPerSecond).toBeGreaterThan(50);

      console.log(`Processed 100 commands in ${totalTime.toFixed(2)}ms (${metrics.commandsPerSecond.toFixed(1)} cmd/sec)`);
    });

    test('should handle complex sprite operations efficiently', () => {
      const spriteCommands = [
        'SPRITEDEF 0 16 16 $' + 'FF'.repeat(256), // 16x16 sprite
        'SPRITEDEF 1 32 32 $' + '00'.repeat(1024), // 32x32 sprite (max size)
        'SPRITE 0 100 100',
        'SPRITE 1 200 200 128', // with opacity
        'LAYER 0 test.bmp',
        'CROP 0 0 64 64 300 300'
      ];

      spriteCommands.forEach(cmd => {
        monitor.commandStart();
        const commands = parser.parse(cmd);
        parser.executeCommands(commands);
        monitor.commandEnd();
        monitor.recordCanvasOperation(cmd.split(' ')[0]);
      });

      const metrics = monitor.getMetrics();
      expect(metrics.averageCommandTime).toBeLessThan(15); // Slightly higher limit for complex operations
      expect(metrics.spriteOperations).toBeGreaterThanOrEqual(2);
      expect(metrics.layerOperations).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Memory Performance', () => {
    test('should not leak memory during repeated operations', () => {
      const initialMetrics = monitor.getMetrics();
      const initialMemory = initialMetrics.memoryUsage.heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        monitor.commandStart();
        const commands = parser.parse(`TEXT "Memory test ${i}"`);
        parser.executeCommands(commands);
        monitor.commandEnd();

        if (i % 100 === 0) {
          monitor.updateMemoryUsage();
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMetrics = monitor.getMetrics();
      const finalMemory = finalMetrics.memoryUsage.heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory should not grow excessively (allow some growth for legitimate caching)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB max growth

      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(1)}MB after 1000 operations`);
    });

    test('should handle large sprite data without excessive memory usage', () => {
      monitor.updateMemoryUsage();
      const initialMemory = monitor.getMetrics().memoryUsage.heapUsed;

      // Create multiple large sprites
      for (let i = 0; i < 10; i++) {
        const largePixelData = '$' + 'FF'.repeat(1024); // 32x32 sprite data
        monitor.commandStart();
        const commands = parser.parse(`SPRITEDEF ${i} 32 32 ${largePixelData}`);
        parser.executeCommands(commands);
        monitor.commandEnd();
      }

      monitor.updateMemoryUsage();
      const finalMemory = monitor.getMetrics().memoryUsage.heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Should handle large sprites efficiently
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024); // 20MB max for 10 large sprites

      console.log(`Large sprite memory usage: ${(memoryGrowth / 1024 / 1024).toFixed(1)}MB for 10 32x32 sprites`);
    });
  });

  describe('Realistic P2 Debug Scenarios', () => {
    test('should handle typical oscilloscope visualization', () => {
      // Simulate oscilloscope trace with 512 data points
      const dataPoints = Array.from({ length: 512 }, (_, i) => ({
        x: i * 2,
        y: 200 + Math.sin(i * 0.1) * 100
      }));

      monitor.commandStart();

      // Setup
      parser.executeCommands(parser.parse('CONFIGURE SIZE 1024 400'));
      parser.executeCommands(parser.parse('CONFIGURE TITLE "Oscilloscope"'));
      parser.executeCommands(parser.parse('COLORMODE 0'));

      // Draw grid
      for (let x = 0; x < 1024; x += 64) {
        parser.executeCommands(parser.parse(`LINE ${x} 0 ${x} 400`));
      }
      for (let y = 0; y < 400; y += 50) {
        parser.executeCommands(parser.parse(`LINE 0 ${y} 1024 ${y}`));
      }

      // Draw trace
      let lastPoint = dataPoints[0];
      for (let i = 1; i < dataPoints.length; i++) {
        const point = dataPoints[i];
        parser.executeCommands(parser.parse(`LINE ${lastPoint.x} ${lastPoint.y} ${point.x} ${point.y}`));
        lastPoint = point;
      }

      monitor.commandEnd();

      const metrics = monitor.getMetrics();
      expect(metrics.commandProcessingTime).toBeLessThan(100); // 100ms for complete oscilloscope setup

      console.log(`Oscilloscope simulation: ${metrics.commandProcessingTime.toFixed(2)}ms for 512 points + grid`);
    });

    test('should handle logic analyzer display', () => {
      // Simulate 8-channel logic analyzer with 1024 samples
      const channels = 8;
      const samples = 1024;

      monitor.commandStart();

      // Setup
      parser.executeCommands(parser.parse('CONFIGURE SIZE 1024 600'));
      parser.executeCommands(parser.parse('CONFIGURE TITLE "Logic Analyzer"'));

      // Draw channel traces
      for (let channel = 0; channel < channels; channel++) {
        const yBase = 50 + channel * 60;
        let lastState = 0;
        let lastX = 0;

        for (let x = 0; x < samples; x++) {
          const state = Math.random() > 0.7 ? 1 : 0; // Random digital signal

          if (state !== lastState) {
            // Draw vertical transition
            const yLow = yBase + 10;
            const yHigh = yBase + 40;
            parser.executeCommands(parser.parse(`LINE ${x} ${yLow} ${x} ${yHigh}`));

            // Draw horizontal line to this point
            const yLevel = lastState ? yHigh : yLow;
            parser.executeCommands(parser.parse(`LINE ${lastX} ${yLevel} ${x} ${yLevel}`));

            lastState = state;
            lastX = x;
          }
        }
      }

      monitor.commandEnd();

      const metrics = monitor.getMetrics();
      expect(metrics.commandProcessingTime).toBeLessThan(200); // 200ms for complete logic analyzer

      console.log(`Logic analyzer simulation: ${metrics.commandProcessingTime.toFixed(2)}ms for 8 channels x 1024 samples`);
    });

    test('should handle real-time data visualization', () => {
      // Simulate streaming data updates (like DataSets=2048 scenario)
      const updateCycles = 60; // 1 second at 60fps
      const pointsPerUpdate = 32;

      const frameTimes: number[] = [];

      for (let cycle = 0; cycle < updateCycles; cycle++) {
        monitor.frameStart();
        monitor.commandStart();

        // Clear previous data (in real scenario, this would be incremental)
        if (cycle % 10 === 0) {
          parser.executeCommands(parser.parse('CONFIGURE BACKCOLOR BLACK'));
        }

        // Add new data points
        for (let i = 0; i < pointsPerUpdate; i++) {
          const x = (cycle * pointsPerUpdate + i) % 1024;
          const y = 200 + Math.sin((cycle * pointsPerUpdate + i) * 0.05) * 150;
          parser.executeCommands(parser.parse(`DOT ${x} ${y}`));
        }

        monitor.commandEnd();

        const frameTime = performance.now();
        frameTimes.push(frameTime);
      }

      const metrics = monitor.getMetrics();
      expect(metrics.averageFPS).toBeGreaterThan(30); // Minimum acceptable for real-time
      expect(metrics.averageCommandTime).toBeLessThan(16); // 60fps target

      console.log(`Real-time data: ${metrics.averageFPS.toFixed(1)} fps average over ${updateCycles} frames`);
    });
  });

  describe('Stress Testing', () => {
    test('should handle maximum sprite usage', () => {
      // Test with maximum sprite count (256 sprites)
      const maxSprites = 256;
      const spriteSize = 8; // Use smaller sprites for stress test

      monitor.commandStart();

      // Define maximum sprites
      for (let i = 0; i < maxSprites; i++) {
        const pixelData = '$' + (i % 256).toString(16).padStart(2, '0').repeat(spriteSize * spriteSize);
        parser.executeCommands(parser.parse(`SPRITEDEF ${i} ${spriteSize} ${spriteSize} ${pixelData}`));
      }

      // Render many sprites
      for (let i = 0; i < maxSprites; i++) {
        const x = (i % 32) * 32;
        const y = Math.floor(i / 32) * 32;
        parser.executeCommands(parser.parse(`SPRITE ${i} ${x} ${y}`));
        monitor.recordCanvasOperation('SPRITE');
      }

      monitor.commandEnd();

      const metrics = monitor.getMetrics();
      expect(metrics.commandProcessingTime).toBeLessThan(1000); // 1 second for max sprites
      expect(metrics.spriteOperations).toBe(maxSprites);

      console.log(`Maximum sprites: ${metrics.commandProcessingTime.toFixed(2)}ms for ${maxSprites} sprites`);
    });

    test('should maintain performance under sustained load', () => {
      const sustainedCycles = 300; // 5 seconds at 60fps
      let frameDrops = 0;

      for (let cycle = 0; cycle < sustainedCycles; cycle++) {
        monitor.frameStart();
        monitor.commandStart();

        // Mixed workload per frame
        parser.executeCommands(parser.parse(`DOT ${cycle % 1024} ${(cycle * 2) % 600}`));
        parser.executeCommands(parser.parse(`LINE ${cycle % 1024} 0 ${cycle % 1024} 600`));
        parser.executeCommands(parser.parse(`CIRCLE ${20 + (cycle % 30)}`));
        parser.executeCommands(parser.parse(`TEXT "Frame ${cycle}"`));

        monitor.commandEnd();

        // Simulate frame budget
        const frameTime = performance.now() - (monitor as any).lastFrameTime;
        if (frameTime > 16.67) { // 60fps = 16.67ms per frame
          frameDrops++;
        }
      }

      const metrics = monitor.getMetrics();
      const dropRate = frameDrops / sustainedCycles;

      expect(dropRate).toBeLessThan(0.1); // Less than 10% frame drops
      expect(metrics.averageFPS).toBeGreaterThan(45); // Maintain reasonable fps

      console.log(`Sustained load: ${metrics.averageFPS.toFixed(1)} fps average, ${(dropRate * 100).toFixed(1)}% frame drops`);
    });
  });

  describe('Performance Reporting', () => {
    test('should generate comprehensive performance report', () => {
      // Generate some activity
      for (let i = 0; i < 50; i++) {
        monitor.frameStart();
        monitor.commandStart();
        parser.executeCommands(parser.parse(`DOT ${i} ${i}`));
        monitor.commandEnd();
        monitor.recordCanvasOperation('DOT');
      }

      const report = monitor.getPerformanceReport();
      expect(report).toContain('PLOT Window Performance Report');
      expect(report).toContain('Frame Rate:');
      expect(report).toContain('Command Processing:');
      expect(report).toContain('Memory Usage:');
      expect(report).toContain('Overall Performance:');

      const adequate = monitor.isPerformanceAdequate();
      expect(typeof adequate).toBe('boolean');

      console.log('\n' + report);
    });
  });
});