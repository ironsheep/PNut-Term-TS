# Hardware Test Results - 2025-08-30

## Test Environment
- Date/Time: 2025-08-30 12:20:14 - 12:23:31
- Package: electron-ready-macos
- Device: /dev/tty.usbserial-P9cektn7
- Test Program: P2 debug demo with COG0, COG1, COG2

## Console Log Output

### Initial Startup
```
🔍 Looking for serial devices...

Available devices:
/dev/tty.usbserial-P9cektn7

✅ Found device: P9cektn7

🚀 Launching with device P9cektn7...
   (Toggle DTR on your P2 to trigger debug messages)

=========================================
Debug output will appear below:
=========================================
PNut-Term-TS: Storing dumps inside:  /Users/stephen/Library/Application Support/pnut-term-ts/Crashpad
* Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC., Parallax Inc.
* Version 0.1.0, Build date: 8/30/2025

* pnut-term-ts /Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/PNut-Term-TS.app/Contents/Resources/app -p P9cektn7 --verbose
```

### Key Startup Events
- CircularBuffer initialized with 1MB
- MessagePool initialized with 100 pre-allocated messages
- SerialMessageProcessor started successfully
- WindowRouter event listeners setup complete
- Debug Logger window auto-created and registered immediately
- **ERROR**: `[UI UPDATE] ❌ Failed to execute toolbar-event-handlers: Error: Script failed to execute`

### Initial Serial Data Reception
```
[SERIAL RX 2197031148614µs] Received 39 bytes
[SERIAL RX HEX/ASCII]:
  0000: $43 $6F $67 $30 $20 $20 $49 $4E  $49 $54 $20 $24 $30 $30 $30 $30   Cog0  INIT $0000
  0010: $5F $30 $30 $30 $30 $20 $24 $30  $30 $30 $30 $5F $30 $30 $30 $30   _0000 $0000_0000
  0020: $20 $6C $6F $61 $64 $0D $0A                                         load..
```

Followed by COG1 and COG2 initialization messages and debugger packets.

### DTR Assert Sequence
```
[IPC] Received toggle-dtr request
[IPC] Setting DTR to: true (was false)
[DTRResetManager] DTR reset detected, sequence 1
[Processor] DTR reset detected
[TWO-TIER] DTR reset detected
[DEBUGGER RESPONSE] DTR reset detected, clearing response state
[DTRResetManager] Waiting for queues to drain...
[IPC] DTR line set to: true
[IPC] DTR asserted, triggering reset
[IPC] DTR Reset triggered in Debug Logger
[DTRResetManager] DTR reset detected, sequence 2
[Processor] DTR reset detected
[TWO-TIER] DTR reset detected
[DEBUGGER RESPONSE] DTR reset detected, clearing response state
[DTRResetManager] Waiting for queues to drain...
[DEBUG LOGGER] Sending batch of 1 messages to window
[DTRResetManager] All queues drained
[Processor] Log rotation requested for DTR reset
[DTRResetManager] DTR reset complete, log rotated
[DTRResetManager] All queues drained
[Processor] Log rotation requested for DTR reset
[DTRResetManager] DTR reset complete, log rotated
```

### DTR Release Sequence
```
[IPC] Received toggle-dtr request
[IPC] Setting DTR to: false (was true)
[IPC] DTR line set to: false
[IPC] DTR de-asserted
[SERIAL RX 2197227746873µs] Received 39 bytes
```
Followed by program restart with COG0, COG1, COG2 initialization.

## Debug Logger Window Output

### Initial Run (Before DTR)
```
12:20:14.540565
Cog0 INIT $0000_0000 $0000_0000 load
        .540585
Cog0 INIT $0000_0F5C $0000_1C74 jump
        .540591
Cog0 hi from debug demo
        .541595
Cog0 Start 1st Cog
        .541599
Cog1 INIT $0000_0F5C $0000_1834 jump
        .541603
Cog1 Task in new COG started
12:20:14.565834
Cog 1:
  000: $01000000 $01000000   $0E00A103 $F8010000    $00000000 $757A3E00   $FF010000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
12:20:14.591787
Cog 0:
  000: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $00000000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
```

### After DTR Assert/Release
```
12:21:52.881048
DTR Reset - New session started
12:23:31.139693
Cog 0:
  000: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $00000000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
        .140713
Task in new COG started
        .140717
Cog 1:
  000: $01000000 $01000000   $0E00A103 $F8010000    $00000000 $757A3E00   $FF010000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
12:23:31.164085
Cog 0:
  000: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $00000000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
```

## Issues Found

### 1. CRITICAL: Double DTR Reset Execution ❌
- **Issue**: DTR assert triggers TWO complete reset sequences (sequence 1 and sequence 2)
- **Evidence**: 
  - Two "DTR reset detected" events
  - Two "All queues drained" messages
  - Two "Log rotation requested" events
  - Two "DTR reset complete, log rotated" messages
- **Expected**: Single DTR reset sequence per assert
- **Impact**: Duplicate processing, potential race conditions

### 2. CRITICAL: COG2 Packet Not Extracted ❌
- **Issue**: COG2 debugger packet (starting with 0x02) is never extracted/displayed
- **Evidence**:
  - Raw hex shows COG2 packet at proper offset after COG1
  - COG2 packet starts with `$02 $00 $00 $00 $01...` 
  - Only COG0 and COG1 packets appear in Debug Logger
  - First displayed packet shows COG ID as 0 (should be 2)
- **Root Cause**: MessageExtractor not continuing after first packet extraction
- **Impact**: Missing COG2 debug data

### 3. ERROR: Toolbar Script Execution Failure ❌
- **Issue**: toolbar-event-handlers script fails to execute
- **Error**: "Script failed to execute, this normally means an error was thrown"
- **Impact**: Toolbar functionality may be compromised (except DTR which works via HTML template)

### 4. WARNING: Possible Double "debug" in Log Filename ⚠️
- **Issue**: User reported potential duplicate "debug" in log filename path
- **Need**: Verify actual log file path structure
- **Impact**: Confusing file naming

### 5. INFO: Three Debug Log Messages in Logger Window 🔍
- **Issue**: Unclear why three debug log messages appear
- **Need**: Investigation of message flow and timing

### 6. POSITIVE: DTR Hardware Control Working ✅
- **DTR assert/release properly controls hardware
- **P2 restarts correctly on DTR toggle
- **Messages resume after DTR release

### 7. POSITIVE: COG0 and COG1 Packets Extracted ✅
- **COG0 and COG1 debugger packets properly extracted
- **416-byte format recognized
- **52-byte stub responses sent correctly

### 8. POSITIVE: Message Routing Working ✅
- **Two-tier routing system functioning
- **Messages properly categorized and routed
- **Debug Logger receives messages correctly

## Root Cause Analysis

### Double DTR Reset
- Likely caused by duplicate event handling or cascading triggers
- Both IPC handler and DTRResetManager may be triggering resets
- Need to ensure single reset per DTR toggle

### COG2 Packet Extraction Failure
- MessageExtractor stops after first packet (COG1)
- Buffer position not properly advanced after extraction
- Pattern matching may fail for second 0x02 marker
- Need to debug extractDebuggerPacket() loop continuation

### Toolbar Script Error
- window.ipcRenderer not available in executeJavaScript context
- Timing issue with script execution vs DOM ready
- May need different approach for toolbar event handling

## Next Steps

1. **Fix Double DTR Reset** (Critical)
   - Trace DTR event flow
   - Ensure single reset sequence
   - Remove duplicate handlers

2. **Fix COG2 Packet Extraction** (Critical)
   - Debug MessageExtractor.extractDebuggerPacket()
   - Ensure buffer position advances correctly
   - Test consecutive packet extraction

3. **Fix Toolbar Script Error** (High)
   - Investigate script execution context
   - Consider alternative event binding approach
   - Verify IPC renderer availability

4. **Verify Log Filename** (Low)
   - Check actual log file paths
   - Fix any duplicate "debug" in naming

## Test Summary

- **Working**: Basic serial communication, COG0/COG1 packets, DTR hardware control, message routing
- **Broken**: COG2 packet extraction, double DTR reset execution, toolbar scripts
- **Needs Investigation**: Debug log message count, log filename structure

## Session Success Criteria
- ❌ COG2 packet extraction (still broken)
- ❌ Single DTR reset execution (doubles happening)
- ❌ Toolbar script execution (still failing)
- ✅ DTR hardware control
- ✅ Basic debugger packet handling for COG0/COG1
- ✅ Message routing and display