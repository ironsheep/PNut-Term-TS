# Memory Management and Leak Prevention Guide

Best practices for preventing memory leaks in the P2 Debug Terminal system.

## Table of Contents

1. [Memory Baselines](#memory-baselines)
2. [Cleanup Patterns](#cleanup-patterns)
3. [Common Leak Sources](#common-leak-sources)
4. [Testing for Leaks](#testing-for-leaks)
5. [Performance Monitoring](#performance-monitoring)

## Memory Baselines

Expected memory usage for each window type (measured after initialization):

| Window Type | Baseline (MB) | Peak (MB) | Notes |
|------------|---------------|-----------|--------|
| Terminal | 2-5 | 10 | Text buffer dependent |
| Scope | 5-10 | 20 | Canvas + waveform data |
| Logic | 5-10 | 25 | Buffered samples |
| Plot | 3-8 | 15 | Double-buffered canvas |
| MIDI | 2-4 | 8 | Event history |
| Bitmap | 8-15 | 30 | Image data |
| FFT | 10-20 | 40 | Complex calculations |
| ScopeXY | 5-10 | 20 | Trace buffers |
| Debugger | 15-30 | 50 | Complex UI + state |

## Cleanup Patterns

### 1. Window Lifecycle Management

Every debug window MUST implement proper cleanup in `closeDebugWindow()`:

```typescript
class DebugWindow extends DebugWindowBase {
  private updateTimer?: NodeJS.Timeout;
  private eventListeners: Array<{ element: any; event: string; handler: Function }> = [];
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  
  public closeDebugWindow(): void {
    // 1. Stop all timers
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    
    // 2. Remove all event listeners
    for (const listener of this.eventListeners) {
      listener.element.removeEventListener(listener.event, listener.handler);
    }
    this.eventListeners = [];
    
    // 3. Clean up canvas contexts
    if (this.context) {
      this.context.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
      this.context = undefined;
    }
    
    // 4. Clear canvas dimensions to free memory
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.canvas = undefined;
    }
    
    // 5. Unregister from WindowRouter
    this.unregisterFromRouter();
    
    // 6. Clear data buffers
    this.clearDataBuffers();
    
    // 7. Call parent cleanup
    super.closeDebugWindow();
  }
  
  private clearDataBuffers(): void {
    // Clear any accumulated data
    // This is window-specific
  }
}
```

### 2. Event Listener Management

Always track and clean up event listeners:

```typescript
// GOOD: Tracked listener
private addTrackedListener(element: any, event: string, handler: Function): void {
  element.addEventListener(event, handler);
  this.eventListeners.push({ element, event, handler });
}

// BAD: Untracked listener
element.addEventListener('click', () => {
  // Anonymous function can't be removed!
});

// GOOD: Named function that can be removed
const clickHandler = () => { /* ... */ };
element.addEventListener('click', clickHandler);
this.eventListeners.push({ element, event: 'click', handler: clickHandler });
```

### 3. Timer Management

Always store timer references and clear them:

```typescript
// GOOD: Stored timer reference
this.updateTimer = setInterval(() => {
  this.update();
}, 100);

// Cleanup
if (this.updateTimer) {
  clearInterval(this.updateTimer);
  this.updateTimer = undefined;
}

// BAD: No reference stored
setInterval(() => {
  this.update();
}, 100); // Can't be cleared!
```

### 4. Canvas Memory Management

Canvas elements can consume significant memory:

```typescript
// Proper canvas cleanup
private cleanupCanvas(): void {
  if (this.context) {
    // Clear the canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Release the context
    this.context = null;
  }
  
  if (this.canvas) {
    // Reset dimensions to free backing store
    this.canvas.width = 0;
    this.canvas.height = 0;
    
    // Remove from DOM if added
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    this.canvas = null;
  }
}
```

### 5. WebGL Context Management

WebGL contexts require special attention:

```typescript
private cleanupWebGL(): void {
  if (this.gl) {
    // Delete all WebGL resources
    this.deleteBuffers();
    this.deleteTextures();
    this.deleteShaders();
    
    // Lose the context
    const loseContext = this.gl.getExtension('WEBGL_lose_context');
    if (loseContext) {
      loseContext.loseContext();
    }
    
    this.gl = null;
  }
}
```

### 6. Data Buffer Management

Limit buffer sizes to prevent unbounded growth:

```typescript
class DataBuffer {
  private readonly MAX_SIZE = 10000;
  private data: any[] = [];
  
  public add(item: any): void {
    this.data.push(item);
    
    // Prevent unbounded growth
    if (this.data.length > this.MAX_SIZE) {
      // Remove oldest items
      this.data.splice(0, this.data.length - this.MAX_SIZE);
    }
  }
  
  public clear(): void {
    this.data = [];
  }
}
```

### 7. WindowRouter Integration

Proper registration and unregistration with WindowRouter:

```typescript
protected registerWithRouter(): void {
  const router = WindowRouter.getInstance();
  const windowId = `${this.windowType}-${this.windowNumber}`;
  
  // Store the handler reference so we can unregister later
  this.messageHandler = (message: any) => {
    this.updateContent(message);
  };
  
  router.registerWindow(windowId, this.windowType, this.messageHandler);
  this.isRegistered = true;
}

protected unregisterFromRouter(): void {
  if (this.isRegistered) {
    const router = WindowRouter.getInstance();
    const windowId = `${this.windowType}-${this.windowNumber}`;
    router.unregisterWindow(windowId);
    this.isRegistered = false;
    this.messageHandler = undefined;
  }
}
```

## Common Leak Sources

### 1. Circular References

Avoid circular references that prevent garbage collection:

```typescript
// BAD: Circular reference
class Window {
  private child: Child;
  
  constructor() {
    this.child = new Child(this); // Child holds reference to parent
  }
}

// GOOD: Use weak references or explicit cleanup
class Window {
  private child: Child;
  
  constructor() {
    this.child = new Child(new WeakRef(this));
  }
  
  public cleanup(): void {
    this.child.cleanup();
    this.child = null;
  }
}
```

### 2. Forgotten Timers

```typescript
// BAD: Timer continues after window closes
class Window {
  constructor() {
    setInterval(() => this.update(), 100);
  }
}

// GOOD: Store and clear timer
class Window {
  private timer?: NodeJS.Timeout;
  
  constructor() {
    this.timer = setInterval(() => this.update(), 100);
  }
  
  public cleanup(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
```

### 3. Event Listener Accumulation

```typescript
// BAD: Listeners accumulate on global objects
window.addEventListener('resize', this.handleResize);

// GOOD: Track and remove listeners
this.resizeHandler = this.handleResize.bind(this);
window.addEventListener('resize', this.resizeHandler);

// In cleanup:
window.removeEventListener('resize', this.resizeHandler);
```

### 4. Large Data Accumulation

```typescript
// BAD: Unbounded array growth
class Logger {
  private logs: string[] = [];
  
  public log(message: string): void {
    this.logs.push(message); // Grows forever!
  }
}

// GOOD: Circular buffer with max size
class Logger {
  private readonly MAX_LOGS = 1000;
  private logs: string[] = [];
  
  public log(message: string): void {
    this.logs.push(message);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
  }
}
```

## Testing for Leaks

### 1. Run Memory Leak Tests

```bash
# Run with garbage collection exposed
node --expose-gc node_modules/.bin/jest tests/memoryLeakDetection.test.ts

# Run with heap snapshots
node --expose-gc --inspect node_modules/.bin/jest tests/memoryLeakDetection.test.ts
```

### 2. Use Chrome DevTools

1. Run the app with `--inspect` flag
2. Open Chrome DevTools
3. Take heap snapshots before and after operations
4. Compare snapshots to find retained objects

### 3. Automated Leak Detection

The `MemoryProfiler` class provides automated leak detection:

```typescript
const profiler = new MemoryProfiler();
profiler.startProfiling();

// Perform operations
for (let i = 0; i < 100; i++) {
  const window = new DebugWindow();
  window.initialize();
  window.close();
}

// Check for leaks
const stats = profiler.getStats();
if (stats.trend === 'leaking') {
  console.error('Memory leak detected!');
  console.log('Growth rate:', stats.growthRate, 'MB/s');
}
```

### 4. Continuous Monitoring

Add memory monitoring to long-running tests:

```typescript
describe('Long-running test', () => {
  it('should not leak over time', async () => {
    const profiler = new MemoryProfiler();
    profiler.startProfiling();
    
    // Run test for extended period
    await runTestFor(60000); // 60 seconds
    
    const stats = profiler.getStats();
    expect(stats.trend).not.toBe('leaking');
    expect(stats.growth).toBeLessThan(50); // Less than 50MB growth
  });
});
```

## Performance Monitoring

### 1. Memory Usage Tracking

Monitor memory usage in production:

```typescript
class MemoryMonitor {
  private interval?: NodeJS.Timeout;
  
  public start(): void {
    this.interval = setInterval(() => {
      const usage = process.memoryUsage();
      console.log('Memory Usage:', {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(usage.rss / 1024 / 1024) + ' MB'
      });
      
      // Alert if memory usage is high
      if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.warn('High memory usage detected!');
      }
    }, 30000); // Every 30 seconds
  }
  
  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
```

### 2. Window Count Tracking

Monitor active window count:

```typescript
class WindowMonitor {
  private windowCounts = new Map<string, number>();
  
  public windowOpened(type: string): void {
    const count = this.windowCounts.get(type) || 0;
    this.windowCounts.set(type, count + 1);
    this.checkLimits();
  }
  
  public windowClosed(type: string): void {
    const count = this.windowCounts.get(type) || 0;
    if (count > 0) {
      this.windowCounts.set(type, count - 1);
    }
  }
  
  private checkLimits(): void {
    let total = 0;
    for (const count of this.windowCounts.values()) {
      total += count;
    }
    
    if (total > 20) {
      console.warn(`High window count: ${total} windows open`);
    }
  }
}
```

### 3. Performance Metrics

Track key performance indicators:

```typescript
interface PerformanceMetrics {
  messageRate: number;      // Messages per second
  renderTime: number;        // Average render time (ms)
  memoryUsage: number;       // Current heap usage (MB)
  activeWindows: number;     // Number of open windows
  routingLatency: number;    // Message routing time (ms)
}

class PerformanceTracker {
  public getMetrics(): PerformanceMetrics {
    const router = WindowRouter.getInstance();
    const usage = process.memoryUsage();
    
    return {
      messageRate: router.getMessageRate(),
      renderTime: this.getAverageRenderTime(),
      memoryUsage: usage.heapUsed / 1024 / 1024,
      activeWindows: router.getActiveWindows().length,
      routingLatency: router.getRoutingLatency()
    };
  }
}
```

## Best Practices Summary

1. **Always clean up resources** in `closeDebugWindow()`
2. **Track all event listeners** and remove them on cleanup
3. **Store timer references** and clear them when done
4. **Limit buffer sizes** to prevent unbounded growth
5. **Clear canvas contexts** and reset dimensions
6. **Unregister from WindowRouter** when closing
7. **Use weak references** where appropriate
8. **Test for leaks** with automated tests
9. **Monitor memory usage** in production
10. **Document cleanup requirements** for new features

## Troubleshooting

### High Memory Usage

1. Check for unclosed windows
2. Look for accumulated data buffers
3. Verify timer cleanup
4. Check for retained event listeners
5. Use heap snapshots to identify large objects

### Gradual Memory Growth

1. Check for circular references
2. Verify buffer size limits
3. Look for accumulating arrays/maps
4. Check WindowRouter message queue
5. Verify canvas cleanup

### Performance Degradation

1. Check active window count
2. Monitor message rate
3. Check for excessive re-renders
4. Verify timer intervals
5. Look for synchronous operations

---

Following these patterns ensures the P2 Debug Terminal can handle long-running sessions with high-frequency data streams without memory issues.