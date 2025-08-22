# WindowRouter Logging Guide

## Overview

The WindowRouter includes comprehensive logging infrastructure via the `RouterLogger` class. This provides visibility into the critical routing operations without impacting performance through async operations and buffering.

## Quick Start

### Enable Logging via Environment Variables

```bash
# Set log level (TRACE, DEBUG, INFO, WARN, ERROR)
export ROUTER_LOG_LEVEL=DEBUG

# Enable console output
export ROUTER_LOG_CONSOLE=true

# Enable file logging
export ROUTER_LOG_FILE=true

# Custom log file path (optional)
export ROUTER_LOG_PATH=/path/to/custom/router.log

# Run the application
npm start
```

### Enable Logging Programmatically

```typescript
import { WindowRouter } from './src/classes/shared/windowRouter';

const router = WindowRouter.getInstance();

// Update logger configuration
router.updateLoggerConfig({
  level: LogLevel.DEBUG,
  console: true,
  file: true,
  filePath: './logs/debug-session.log'
});
```

## Log Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `TRACE` | Extremely detailed | Development debugging |
| `DEBUG` | Detailed operations | Troubleshooting routing |
| `INFO` | General information | Normal operations |
| `WARN` | Warning conditions | Performance issues |
| `ERROR` | Error conditions | Critical failures |

## Log Categories

### STARTUP
Router initialization and configuration
```
2025-08-09T22:42:01Z [INFO ] STARTUP: WindowRouter initialized
```

### REGISTER/UNREGISTER
Window registration operations
```
2025-08-09T22:42:05Z [DEBUG] REGISTER: Registering window: debugger-0 (DebugDebuggerWindow)
2025-08-09T22:42:05Z [INFO ] REGISTER: Window registered: debugger-0 (DebugDebuggerWindow). Active windows: 1
```

### ROUTING
Message routing operations with performance metrics
```
2025-08-09T22:42:10Z [DEBUG] ROUTING: binary -> debugger-0 (256B, 0.12ms)
2025-08-09T22:42:10Z [WARN ] PERFORMANCE: Slow routing detected: 2.34ms (binary, 1024B)
```

### RECORDING
Recording session management
```
2025-08-09T22:42:15Z [INFO ] RECORDING: Starting recording session: debug-session-001
```

### PERFORMANCE
System performance metrics
```
2025-08-09T22:42:20Z [INFO ] PERFORMANCE: Routing: 0.15ms, Queue: 3, Throughput: 45.2 msg/s, 12.3 KB/s
```

### DIAGNOSTIC
Diagnostic operations
```
2025-08-09T22:42:25Z [INFO ] DIAGNOSTIC: Generating diagnostic dump
```

## File Logging

### Default Log Location
- **Path**: `./logs/router-YYYY-MM-DD.log`
- **Format**: JSON-structured entries
- **Rotation**: Daily files by default

### Log File Format
```
2025-08-09T22:42:01Z [INFO ] STARTUP: WindowRouter initialized | {"config":{"level":2}}
2025-08-09T22:42:05Z [DEBUG] ROUTING: binary -> debugger-0 (256B, 0.12ms) | {"windowId":"debugger-0","messageType":"binary","size":256,"routingTime":0.12}
```

## Performance Features

### Non-Blocking Design
- **Async writes**: File I/O never blocks routing
- **Buffered output**: Messages batched for efficiency  
- **Immediate high-priority**: WARN/ERROR output immediately to console

### Circular Buffer
- **Always active**: Captures last 10,000 entries for debugging
- **Memory efficient**: Fixed-size ring buffer
- **Crash analysis**: Available even if file logging disabled

## Diagnostic Tools

### Get Logger Statistics
```typescript
const stats = router.getLoggerStats();
console.log(stats);
// {
//   totalMessages: 1542,
//   totalBytes: 245760,
//   totalErrors: 0,
//   bufferSize: 0,
//   isEnabled: true,
//   averageMetrics: { routingTime: 0.23, throughput: 42.1 }
// }
```

### Generate Diagnostic Dump
```typescript
// Get dump as JSON string
const dump = router.generateDiagnosticDump();

// Or save directly to file
const filePath = router.saveDiagnosticDump();
console.log(`Diagnostic dump saved: ${filePath}`);
```

### Access Recent Log Entries
```typescript
// Get last 50 entries from circular buffer
const recent = router.getRecentLogEntries(50);
recent.forEach(entry => {
  console.log(`[${LogLevel[entry.level]}] ${entry.category}: ${entry.message}`);
});
```

## Troubleshooting Common Issues

### High Routing Times
Look for `PERFORMANCE` warnings:
```bash
export ROUTER_LOG_LEVEL=WARN
npm start
```

### Missing Messages
Enable `DEBUG` level to see all routing decisions:
```bash
export ROUTER_LOG_LEVEL=DEBUG
export ROUTER_LOG_CONSOLE=true
npm start
```

### Memory Usage
Check circular buffer and performance metrics:
```typescript
const stats = router.getLoggerStats();
console.log(`Buffer usage: ${stats.circularBufferUsage}/10000`);
console.log(`Average queue depth: ${stats.averageMetrics?.queueDepth}`);
```

## Integration with Testing

### Disable Logging in Tests
```typescript
// In test setup
process.env.ROUTER_LOG_LEVEL = 'ERROR';
process.env.ROUTER_LOG_CONSOLE = 'false';
```

### Capture Logs for Assertions
```typescript
const router = WindowRouter.getInstance();
const initialCount = router.getLoggerStats().totalMessages;

// Perform operations...

const finalCount = router.getLoggerStats().totalMessages;
expect(finalCount).toBeGreaterThan(initialCount);
```

## Best Practices

1. **Production**: Use `INFO` level with file logging enabled
2. **Development**: Use `DEBUG` level with console output
3. **Troubleshooting**: Use `TRACE` level temporarily
4. **CI/CD**: Use `ERROR` level only to reduce noise
5. **Performance Testing**: Monitor routing times with `WARN` level

## Configuration Reference

```typescript
interface LoggerConfig {
  level: LogLevel;              // Minimum log level
  console: boolean;             // Console output enabled
  file: boolean;                // File output enabled  
  filePath?: string;            // Custom file path
  maxBufferSize: number;        // Buffer size before flush (default: 1000)
  flushInterval: number;        // Flush interval in ms (default: 100)
  circularBufferSize: number;   // Circular buffer size (default: 10000)
}
```

## Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `ROUTER_LOG_LEVEL` | TRACE/DEBUG/INFO/WARN/ERROR | INFO | Minimum log level |
| `ROUTER_LOG_CONSOLE` | true/false | true | Console output |
| `ROUTER_LOG_FILE` | true/false | false | File output |
| `ROUTER_LOG_PATH` | file path | ./logs/router-DATE.log | Log file location |