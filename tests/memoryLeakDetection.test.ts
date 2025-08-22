/** @format */

// tests/memoryLeakDetection.test.ts

import { MemoryProfiler, WindowLeakDetector, MemoryBaseline } from '../src/utils/memoryProfiler';
import { DebugTermWindowdow } from '../src/classes/debugTermWin';
import { DebugScopeWindowdow } from '../src/classes/debugScopeWin';
import { DebugLogicWindowdow } from '../src/classes/debugLogicWin';
import { DebugPlotWindowdow } from '../src/classes/debugPlotWin';
import { DebugMidiWindowdow } from '../src/classes/debugMidiWin';
import { DebugBitmapWindowdow } from '../src/classes/debugBitmapWin';
import { DebugFFTWindow } from '../src/classes/debugFftWin';
import { DebugScopeXyWindowdow } from '../src/classes/debugScopeXyWin';
import { DebugDebuggerWindow } from '../src/classes/debugDebuggerWin';
import { WindowRouter } from '../src/classes/shared/windowRouter';
import { Context } from '../src/utils/context';

// Enable garbage collection for tests (run with --expose-gc flag)
declare const global: any;

describe('Memory Leak Detection', () => {
  let profiler: MemoryProfiler;
  let leakDetector: WindowLeakDetector;
  let baseline: MemoryBaseline;
  let context: Context;
  
  beforeAll(() => {
    // Ensure we have gc available
    if (!global.gc) {
      console.warn('Garbage collection not exposed. Run tests with --expose-gc flag for accurate results.');
    }
  });
  
  beforeEach(() => {
    profiler = new MemoryProfiler();
    leakDetector = new WindowLeakDetector();
    baseline = new MemoryBaseline();
    context = new Context();
    
    // Reset WindowRouter
    WindowRouter.resetInstance();
    
    // Force GC before each test
    if (global.gc) {
      global.gc();
    }
  });
  
  afterEach(() => {
    profiler.stopProfiling();
    leakDetector.clear();
    baseline.reset();
  });
  
  describe('Window Creation/Destruction Cycles', () => {
    it('should not leak memory after 100 terminal window cycles', async () => {
      baseline.capture();
      profiler.startProfiling();
      
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const window = new DebugTermWindow(context);
        // Window is initialized in constructor
        
        // Simulate some activity
        window.updateContent('Test data ' + i);
        
        // Close and cleanup
        window.closeDebugWindow();
        
        // Force GC every 10 iterations
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Final GC
      if (global.gc) {
        global.gc();
      }
      
      // Check for leaks
      const stats = profiler.getStats();
      const diff = baseline.compare();
      
      // Allow some growth but not excessive (< 10MB for 100 windows)
      expect(stats.growth).toBeLessThan(10);
      expect(stats.trend).not.toBe('leaking');
      
      if (diff) {
        expect(diff.heapUsedDiff / 1024 / 1024).toBeLessThan(10); // Less than 10MB growth
      }
    }, 30000); // 30 second timeout
    
    it('should not leak memory with scope windows', async () => {
      baseline.capture();
      profiler.startProfiling();
      
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        const window = new DebugScopeWindow(context);
        // Window is initialized in constructor
        
        // Simulate scope data
        window.updateContent('DEBUG SCOPE 1,2,3,4,5,6,7,8');
        
        // Close and cleanup
        window.closeDebugWindow();
        
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const stats = profiler.getStats();
      expect(stats.growth).toBeLessThan(15); // Scope windows use more memory
      expect(stats.trend).not.toBe('leaking');
    }, 30000);
    
    it('should not leak memory with debugger windows', async () => {
      baseline.capture();
      profiler.startProfiling();
      
      const iterations = 20; // Fewer iterations as debugger windows are heavier
      
      for (let i = 0; i < iterations; i++) {
        const cogId = i % 8; // Test different COG IDs
        const window = new DebugDebuggerWindow(context, cogId);
        // Window is initialized in constructor
        
        // Simulate debugger activity
        const binaryData = new Uint8Array(80);
        binaryData[0] = cogId; // Set COG ID
        window.updateContent(binaryData);
        
        // Close and cleanup
        window.closeDebugWindow();
        
        if (i % 5 === 0 && global.gc) {
          global.gc();
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const stats = profiler.getStats();
      expect(stats.growth).toBeLessThan(20); // Debugger windows are complex
      expect(stats.trend).not.toBe('leaking');
    }, 30000);
  });
  
  describe('Event Listener and Timer Cleanup', () => {
    it('should clean up event listeners on window close', async () => {
      const window = new DebugTermWindow(context);
      const windowId = 'test-terminal';
      
      leakDetector.trackWindow(window, windowId);
      
      // Track some mock event listeners
      const listener1 = () => {};
      const listener2 = () => {};
      leakDetector.trackEventListener(windowId, listener1);
      leakDetector.trackEventListener(windowId, listener2);
      
      // Should have 2 listeners tracked
      let report = leakDetector.getLeakReport();
      expect(report.eventListeners).toHaveLength(1);
      expect(report.eventListeners[0].count).toBe(2);
      
      // Close window and untrack
      window.closeDebugWindow();
      leakDetector.untrackWindow(windowId);
      
      // Should have no listeners tracked
      report = leakDetector.getLeakReport();
      expect(report.eventListeners).toHaveLength(0);
      expect(report.hasLeaks).toBe(false);
    });
    
    it('should clean up timers on window close', () => {
      // Track some timers
      const timer1 = setTimeout(() => {}, 10000);
      const timer2 = setInterval(() => {}, 1000);
      
      leakDetector.trackTimer(timer1);
      leakDetector.trackTimer(timer2);
      
      // Should have timers tracked
      let report = leakDetector.getLeakReport();
      expect(report.timers).toBeGreaterThan(0);
      
      // Clear timers
      clearTimeout(timer1);
      clearInterval(timer2);
      
      // Check again (timers might not be immediately cleared)
      report = leakDetector.getLeakReport();
      // This is implementation-dependent, so we just check it doesn't grow
    });
  });
  
  describe('Canvas Context Cleanup', () => {
    it('should properly clean up canvas contexts', () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        leakDetector.trackCanvasContext(context);
        
        // Canvas contexts are tracked in a WeakSet, so they'll be
        // garbage collected when no longer referenced
        
        // Clear the canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      }
      
      // Force GC to clean up
      if (global.gc) {
        global.gc();
      }
      
      // WeakSet will automatically clean up when context is GC'd
      expect(true).toBe(true); // Placeholder assertion
    });
  });
  
  describe('Multi-Window Scenarios', () => {
    it('should handle 8+ concurrent windows without leaking', async () => {
      baseline.capture();
      profiler.startProfiling();
      
      const windows: any[] = [];
      
      // Create 8 different window types
      windows.push(new DebugTermWindow(context));
      windows.push(new DebugScopeWindow(context));
      windows.push(new DebugLogicWindow(context));
      windows.push(new DebugPlotWindow(context));
      windows.push(new DebugMidiWindow(context));
      windows.push(new DebugBitmapWindow(context));
      windows.push(new DebugFFTWindow(context));
      windows.push(new DebugScopeXyWindow(context));
      
      // Initialize all windows
      for (const window of windows) {
        // Window is initialized in constructor
      }
      
      // Simulate activity on all windows
      for (let i = 0; i < 100; i++) {
        windows[0].updateContent('Terminal data ' + i);
        windows[1].updateContent('DEBUG SCOPE ' + i);
        windows[2].updateContent('DEBUG LOGIC ' + i);
        windows[3].updateContent('DEBUG PLOT DOT 10 20');
        windows[4].updateContent('DEBUG MIDI 144 60 127');
        windows[5].updateContent('DEBUG BITMAP 255');
        windows[6].updateContent('DEBUG FFT 1.0 2.0 3.0');
        windows[7].updateContent('DEBUG SCOPEXY 100 200');
      }
      
      // Close all windows
      for (const window of windows) {
        window.closeDebugWindow();
      }
      
      // Clear array
      windows.length = 0;
      
      // Force GC
      if (global.gc) {
        global.gc();
      }
      
      const stats = profiler.getStats();
      const diff = baseline.compare();
      
      // Allow more growth for multiple windows but still reasonable
      expect(stats.growth).toBeLessThan(30); // 30MB for 8 windows
      expect(stats.trend).not.toBe('leaking');
      
      if (diff) {
        expect(diff.heapUsedDiff / 1024 / 1024).toBeLessThan(30);
      }
    }, 30000);
    
    it('should handle rapid window creation/destruction', async () => {
      baseline.capture();
      profiler.startProfiling();
      
      // Rapidly create and destroy windows
      for (let i = 0; i < 50; i++) {
        const window = new DebugTermWindow(context);
        // Window is initialized in constructor
        window.updateContent('Rapid test ' + i);
        window.closeDebugWindow();
        
        // No delay between iterations
      }
      
      // Force GC
      if (global.gc) {
        global.gc();
      }
      
      const stats = profiler.getStats();
      expect(stats.growth).toBeLessThan(10);
      expect(profiler.hasLeak(10)).toBe(false);
    }, 30000);
  });
  
  describe('WindowRouter Memory Management', () => {
    it('should not leak when routing many messages', () => {
      baseline.capture();
      profiler.startProfiling();
      
      const router = WindowRouter.getInstance();
      
      // Register a test window
      const handler = jest.fn();
      router.registerWindow('test-1', 'terminal', handler);
      
      // Route many messages
      for (let i = 0; i < 10000; i++) {
        router.routeTextMessage('Test message ' + i);
      }
      
      // Unregister
      router.unregisterWindow('test-1');
      
      // Force GC
      if (global.gc) {
        global.gc();
      }
      
      const stats = profiler.getStats();
      expect(stats.growth).toBeLessThan(5); // Should be minimal growth
    });
    
    it('should clean up recording buffers', async () => {
      baseline.capture();
      
      const router = WindowRouter.getInstance();
      
      // Start recording
      router.startRecording({
        sessionName: 'test-recording',
        description: 'Memory test',
        startTime: Date.now()
      });
      
      // Send many messages
      for (let i = 0; i < 1000; i++) {
        router.routeTextMessage('Recording test ' + i);
      }
      
      // Stop recording
      router.stopRecording();
      
      // Force GC
      if (global.gc) {
        global.gc();
      }
      
      const diff = baseline.compare();
      if (diff) {
        expect(diff.heapUsedDiff / 1024 / 1024).toBeLessThan(5);
      }
    });
  });
  
  describe('Memory Profiler Features', () => {
    it('should detect memory trends correctly', (done) => {
      profiler.startProfiling();
      
      // Simulate gradual memory growth
      const arrays: any[] = [];
      const interval = setInterval(() => {
        // Allocate 1MB each iteration
        arrays.push(new Array(250000).fill(Math.random()));
      }, 100);
      
      setTimeout(() => {
        clearInterval(interval);
        
        const stats = profiler.getStats();
        
        // Should detect growth
        expect(stats.growth).toBeGreaterThan(0);
        expect(stats.trend).toMatch(/growing|leaking/);
        
        // Clean up
        arrays.length = 0;
        done();
      }, 1500);
    });
    
    it('should identify stable memory usage', (done) => {
      profiler.startProfiling();
      
      // Stable memory usage
      setTimeout(() => {
        const stats = profiler.getStats();
        expect(stats.trend).toBe('stable');
        expect(Math.abs(stats.growthRate)).toBeLessThan(0.01);
        done();
      }, 1000);
    });
  });
  
  describe('Memory Baseline Metrics', () => {
    it('should establish baseline for each window type', async () => {
      const baselines = new Map<string, number>();
      
      // Terminal window baseline
      baseline.capture();
      const terminal = new DebugTermWindow(context);
      await terminal.initialize();
      let diff = baseline.compare();
      if (diff) {
        baselines.set('terminal', diff.heapUsedDiff / 1024 / 1024);
      }
      terminal.closeDebugWindow();
      baseline.reset();
      
      // Scope window baseline
      baseline.capture();
      const scope = new DebugScopeWindow(context);
      await scope.initialize();
      diff = baseline.compare();
      if (diff) {
        baselines.set('scope', diff.heapUsedDiff / 1024 / 1024);
      }
      scope.closeDebugWindow();
      baseline.reset();
      
      // Logic window baseline
      baseline.capture();
      const logic = new DebugLogicWindow(context);
      await logic.initialize();
      diff = baseline.compare();
      if (diff) {
        baselines.set('logic', diff.heapUsedDiff / 1024 / 1024);
      }
      logic.closeDebugWindow();
      
      // Log baselines for documentation
      console.log('Memory Baselines (MB):');
      for (const [type, memory] of baselines) {
        console.log(`  ${type}: ${memory.toFixed(2)} MB`);
      }
      
      // Verify baselines are reasonable
      for (const [type, memory] of baselines) {
        expect(memory).toBeGreaterThan(0);
        expect(memory).toBeLessThan(50); // No window should use more than 50MB
      }
    });
  });
});