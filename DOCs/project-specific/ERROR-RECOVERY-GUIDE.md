# P2 Debug Terminal Error Recovery & Troubleshooting Guide

Comprehensive guide for diagnosing and recovering from errors in the P2 Debug Terminal system.

## Table of Contents

1. [Common Error Conditions](#common-error-conditions)
2. [Recovery Procedures](#recovery-procedures)
3. [Error Indicators](#error-indicators)
4. [Troubleshooting Flowchart](#troubleshooting-flowchart)
5. [Known Limitations](#known-limitations)
6. [Best Practices](#best-practices)
7. [Diagnostic Tools](#diagnostic-tools)
8. [FAQ](#faq)

## Common Error Conditions

### 1. USB Connection Issues

#### Symptoms
- "Device not found" error
- No data received from P2
- Intermittent disconnections

#### Causes
- USB cable issues (not all cables support data)
- Driver problems
- Port permissions (Linux/Mac)
- P2 not in debug mode

#### Recovery Steps
1. **Verify Physical Connection**
   ```bash
   # List USB devices
   ls /dev/tty* | grep -E "USB|ACM"
   
   # Check device permissions (Linux/Mac)
   ls -l /dev/ttyUSB0
   ```

2. **Reset USB Connection**
   ```bash
   # Unplug P2, wait 5 seconds, reconnect
   # Reset USB subsystem (Linux)
   sudo modprobe -r ftdi_sio
   sudo modprobe ftdi_sio
   ```

3. **Check P2 Debug Mode**
   - Ensure P2 program includes DEBUG statements
   - Verify baud rate matches (default: 2000000)
   - Check clock configuration

### 2. High-Speed Data Drops

#### Symptoms
- Missing debug messages
- Corrupted display data
- Incomplete window updates

#### Causes
- Buffer overflows at high data rates
- USB bandwidth limitations
- System performance issues

#### Recovery Steps
1. **Reduce Data Rate**
   ```spin2
   ' Add delays in P2 code
   DEBUG(`MYWINDOW DATA...`)
   waitms(1)  ' Small delay between messages
   ```

2. **Optimize System Performance**
   ```bash
   # Increase USB buffer size (Linux)
   echo 1048576 > /sys/module/usbcore/parameters/usbfs_memory_mb
   
   # Set process priority
   nice -n -10 npm start
   ```

3. **Enable Data Sampling**
   ```typescript
   // In recording metadata
   {
     samplingMode: {
       enabled: true,
       rate: 10  // Sample 1 in 10 messages
     }
   }
   ```

### 3. Protocol Mismatches

#### Symptoms
- Binary messages not decoded
- Window type not recognized
- Checksum failures

#### Causes
- Version mismatch between P2 code and terminal
- Corrupted message headers
- Incorrect message format

#### Recovery Steps
1. **Verify Protocol Version**
   ```bash
   # Check terminal version
   npm version
   
   # Ensure P2 code uses compatible DEBUG format
   ```

2. **Enable Protocol Logging**
   ```bash
   export ROUTER_LOG_LEVEL=DEBUG
   npm start 2>&1 | tee debug.log
   ```

3. **Validate Message Format**
   - Binary: 20-long format with checksum
   - Text: "DEBUG WINDOWTYPE data" format

### 4. Buffer Overflows

#### Symptoms
- Application freezes
- Memory usage spike
- Lost messages

#### Causes
- Excessive data rate
- Memory leaks
- Circular buffer overflow

#### Recovery Steps
1. **Monitor Memory Usage**
   ```bash
   # Watch memory in real-time
   watch -n 1 'ps aux | grep pnut-term'
   ```

2. **Clear Buffers**
   ```typescript
   // Force buffer flush
   router.getLogger().flushBuffer();
   ```

3. **Restart with Increased Limits**
   ```bash
   # Increase Node.js memory limit
   node --max-old-space-size=4096 dist/pnut-term-ts.min.js
   ```

### 5. Multi-Window Coordination Problems

#### Symptoms
- Windows not updating synchronously
- Messages routed to wrong window
- Window registration failures

#### Causes
- WindowRouter congestion
- Duplicate window IDs
- Race conditions

#### Recovery Steps
1. **Check Window Registration**
   ```typescript
   const windows = router.getActiveWindows();
   console.log('Active windows:', windows);
   ```

2. **Reset WindowRouter**
   ```typescript
   WindowRouter.resetInstance();
   ```

3. **Enable Router Diagnostics**
   ```bash
   export ROUTER_LOG_LEVEL=TRACE
   export ROUTER_LOG_CONSOLE=true
   ```

## Recovery Procedures

### Emergency Recovery Sequence

1. **Save Current State**
   ```bash
   # Generate diagnostic dump
   node -e "require('./dist/pnut-term-ts.min.js').WindowRouter.getInstance().saveDiagnosticDump()"
   ```

2. **Stop All Operations**
   - Close all debug windows
   - Stop P2 program execution
   - Kill terminal process if needed

3. **Clear System State**
   ```bash
   # Clear logs and temporary files
   rm -rf logs/*.log
   rm -rf recordings/*.jsonl
   
   # Reset USB (Linux)
   sudo usbreset /dev/bus/usb/001/002
   ```

4. **Restart with Diagnostics**
   ```bash
   # Start with full diagnostics
   export ROUTER_LOG_LEVEL=DEBUG
   export ROUTER_LOG_FILE=true
   npm start
   ```

### Lost Communication Recovery

1. **Check Physical Layer**
   - Verify cable connection
   - Test with different USB port
   - Try different cable

2. **Reset Serial Port**
   ```javascript
   // In application
   serialPort.close(() => {
     serialPort.open();
   });
   ```

3. **Verify P2 State**
   - Reset P2 board
   - Reload program with DEBUG
   - Check clock configuration

### Checksum Failure Recovery

1. **Enable Checksum Logging**
   ```typescript
   DebuggerProtocol.setChecksumLogging(true);
   ```

2. **Analyze Failed Messages**
   ```bash
   grep "checksum" logs/*.log | tail -20
   ```

3. **Implement Retry Logic**
   ```typescript
   // Request retransmission
   protocol.requestResend(messageId);
   ```

## Error Indicators

### Visual Indicators

| Indicator | Meaning | Action |
|-----------|---------|--------|
| 🔴 Red status | No connection | Check USB/serial |
| 🟡 Yellow status | Partial data | Check data rate |
| ⚠️ Warning icon | Performance issue | Review logs |
| 🔄 Spinning icon | Processing backlog | Reduce data rate |

### Log Indicators

| Log Level | Pattern | Meaning |
|-----------|---------|---------|
| ERROR | "routing failed" | Message delivery failure |
| WARN | "slow routing" | Performance degradation |
| WARN | "buffer full" | Data overflow risk |
| ERROR | "checksum mismatch" | Corrupted data |

## Troubleshooting Flowchart

```
Start
  ↓
[No Data Received?] → Yes → Check USB Connection
  ↓ No                        ↓
[Corrupted Data?] → Yes → Check Protocol/Checksum
  ↓ No                        ↓
[Missing Messages?] → Yes → Check Buffer/Rate
  ↓ No                        ↓
[Wrong Window?] → Yes → Check Routing/Registration
  ↓ No
[Performance Issue?] → Yes → Enable Diagnostics
  ↓ No
System OK
```

## Known Limitations

### System Limitations

1. **USB Bandwidth**
   - Maximum sustainable rate: ~10MB/s
   - Shared across all USB devices
   - May drop messages above 2Mbaud

2. **Memory Constraints**
   - Circular buffer: 10,000 entries
   - Recording buffer: 1000 messages
   - Canvas memory: ~100MB per window

3. **CPU Performance**
   - 30 FPS maximum update rate
   - Sub-1ms routing requirement
   - JavaScript single-threaded

### Workarounds

1. **For High Data Rates**
   - Use sampling mode
   - Implement P2-side buffering
   - Add delays between bursts

2. **For Memory Issues**
   - Close unused windows
   - Clear recording buffers
   - Restart periodically

3. **For CPU Limitations**
   - Reduce window count
   - Disable unused features
   - Use production build

## Best Practices

### Error Prevention

1. **Always Start Clean**
   ```bash
   npm run clean && npm run build
   npm test
   npm start
   ```

2. **Monitor System Health**
   ```typescript
   // Set up health monitoring
   diagnostics.startPerformanceMonitoring(router, logger, 30000);
   ```

3. **Use Appropriate Log Levels**
   - Development: DEBUG
   - Testing: INFO
   - Production: WARN
   - Troubleshooting: TRACE

### Error Handling Patterns

```typescript
// Wrap critical operations
try {
  router.routeMessage(message);
} catch (error) {
  logger.logError('ROUTING', error, { message });
  // Attempt recovery
  router.resetBuffers();
}

// Use event handlers for errors
router.on('routingError', (event) => {
  const dump = router.saveDiagnosticDump();
  console.error('Routing error, dump saved:', dump);
});
```

## Diagnostic Tools

### Built-in Diagnostics

1. **Health Report**
   ```bash
   node -e "
     const r = require('./dist/pnut-term-ts.min.js');
     const diag = r.RouterDiagnostics.getInstance();
     console.log(diag.createFormattedReport(
       r.WindowRouter.getInstance(),
       r.WindowRouter.getInstance().logger
     ));
   "
   ```

2. **Performance Analysis**
   ```typescript
   const analysis = diagnostics.analyzePerformance(logger);
   console.log('P95 routing time:', analysis.p95Time);
   ```

3. **Message Pattern Analysis**
   ```typescript
   const patterns = diagnostics.analyzeMessagePatterns(logger);
   console.log('Message distribution:', patterns.windowDistribution);
   ```

### External Tools

1. **USB Analysis**
   ```bash
   # Linux USB monitoring
   sudo usbmon -i 1
   
   # Serial port monitoring
   screen /dev/ttyUSB0 2000000
   ```

2. **System Monitoring**
   ```bash
   # CPU and memory
   htop
   
   # I/O statistics
   iotop
   
   # USB devices
   lsusb -v
   ```

## Recording/Playback for Diagnostics

### Capture Error Conditions

```typescript
// Start recording when error detected
router.on('error', () => {
  router.startRecording({
    sessionName: `error-${Date.now()}`,
    description: 'Captured error condition'
  });
});
```

### Replay for Analysis

```bash
# Replay recorded session
node -e "
  require('./dist/pnut-term-ts.min.js')
    .WindowRouter.getInstance()
    .playRecording('./recordings/error-session.jsonl', 0.5, true)
"
```

## FAQ

### Q: Why are my debug messages not appearing?

**A:** Check these common causes:
1. P2 program doesn't include DEBUG statements
2. USB connection issues
3. Wrong baud rate (should be 2000000)
4. Window not registered for message type

### Q: How do I handle "Device busy" errors?

**A:** The serial port is in use by another process:
```bash
# Find process using the port
lsof /dev/ttyUSB0

# Kill the process
kill -9 <PID>
```

### Q: What causes "Maximum call stack exceeded"?

**A:** Usually infinite recursion in message handling:
1. Check for circular message routing
2. Verify window handler doesn't re-emit same message
3. Add recursion depth limits

### Q: How do I debug binary protocol issues?

**A:** Enable binary message logging:
```typescript
DebuggerProtocol.enableBinaryLogging('./logs/binary.log');
```

### Q: Why do windows freeze during high-speed updates?

**A:** JavaScript event loop congestion:
1. Reduce update frequency
2. Use requestAnimationFrame for rendering
3. Implement message batching

### Q: How can I recover from a complete system hang?

**A:** Emergency recovery:
1. Force quit: Ctrl+C (Linux/Mac) or Ctrl+Break (Windows)
2. Kill Node process: `pkill -f pnut-term`
3. Reset USB subsystem
4. Restart terminal application

## Getting Help

If problems persist after following this guide:

1. **Generate Diagnostic Bundle**
   ```bash
   ./scripts/collect-diagnostics.sh
   ```

2. **Check GitHub Issues**
   https://github.com/parallax/pnut-term-ts/issues

3. **Community Support**
   - Parallax Forums: forums.parallax.com
   - P2 Community: p2community.org

4. **Include in Bug Reports**
   - Diagnostic dump file
   - Log files from failure
   - P2 code that triggers issue
   - System information (OS, Node version)
   - Steps to reproduce

---

Remember: Most issues can be resolved by checking USB connections, verifying P2 code includes proper DEBUG statements, and ensuring system resources are adequate for the data rate.