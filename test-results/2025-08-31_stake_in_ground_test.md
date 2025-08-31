# Stake in Ground Test Results - 2025-08-31

## Test Environment
- Date/Time: 2025-08-31 17:42:38
- Package: electron-ready-macos
- Device: /dev/tty.usbserial-P9cektn7
- Test Program: P2 debug demo with COG0, COG1, COG2

## PART 1: CONSOLE LOG

### Startup Sequence
```
/Users/stephen/Projects/Projects-ExtGit/IronSheepProductionsLLC/Propeller2/PNut-Term-TypeScript/PNut-Term-TS/release/electron-ready-macos/TEST.command ; exit;
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

### Initialization
- CircularBuffer initialized with 1MB
- MessagePool initialized with 100 pre-allocated messages
- SerialMessageProcessor started successfully
- WindowRouter event listeners setup complete
- Debug Logger window auto-created and registered immediately
- Window geometry: 960x450 @800,915
- Debug Logger positioned at: 1720, 913

### Critical Errors Found
1. **Font selector setup failed**:
   ```
   [UI UPDATE] ❌ Failed to execute font-selector-setup: Error: Script failed to execute
   ```

2. **Log file initialization error**:
   ```
   [DEBUG LOGGER] Failed to initialize log file: TypeError: The "fd" argument must be of type number. Received null
   ```

### Serial Data Reception
- Initial COG0 INIT message received: 39 bytes
- COG1 initialization and task start received
- COG2 initialization and task start received  
- Debugger 416-byte packets received and processed
- Stub responses sent (52-byte zeros for COG0 and COG1)

### Message Routing
- COG messages successfully routed to Debug Logger
- Debugger packets routed to both destinations
- Message pool working (messages #99 down to #92)
- Adaptive timer adjusting (20ms → 5ms based on velocity)

### Data Flow Summary
- Serial RX timestamps showing continuous reception
- Two-tier processor handling all incoming data
- Messages properly classified and routed
- Debug Logger receiving and processing messages
- Log file flushing occurring (multiple 64-byte flushes)

### Performance Notes
- MaxListenersExceededWarning for WebContents (11 listeners, max 10)
- Font metrics measured: 13.328125 x 11.4765625
- Performance monitoring started after DOM ready

## PART 2: DEBUG LOGGER WINDOW OUTPUT

### Initial Messages (11:42:41)
```
11:42:41.265406
Cog0 INIT $0000_0000 $0000_0000 load
        .266415
Cog0 INIT $0000_0F5C $0000_1C74 jump
        .266418
Cog0 hi from debug demo
        .267420
Cog0 Start 1st Cog
        .267422
Cog1 INIT $0000_0F5C $0000_1834 jump
        .267424
Cog1 Task in new COG started
        .269425
Cog 1:
  000: $01000000 $01000000   $0E00A103 $F8010000    $00000000 $757A3E00   $FF010000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
        .279427
Cog 0:
  000: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $00000000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
```

## PART 3: CONSOLE LOG (DTR Assert)

### DTR Toggle Sequence
```
[TWO-TIER] 🔄 SerialMessageProcessor.receiveData(): 3 bytes, running: true
[IPC] Received toggle-dtr request, delegating to toggleDTR()
```

### Log File Initialization Errors (Repeated)
- Multiple attempts to create log file at `/Users/stephen/logs/debug_250831-1147.log`
- Each attempt fails with same error:
  ```
  TypeError: The "fd" argument must be of type number. Received null
  at Object.fsyncSync (node:fs:1311:11)
  ```
- Error occurs in `initializeLogFile` and `handleDTRReset` methods

### DTR Reset Processing
- DTR reset detected twice (sequence 1 and 2)
- Multiple subsystems notified:
  - DTRResetManager
  - Processor
  - TWO-TIER
  - DEBUGGER RESPONSE (clearing response state)
- Queues drained successfully
- Log rotation requested and completed for both sequences
- Debug Logger adds "[SYSTEM] DTR Reset - New session started" to buffer
- Log file eventually writes header and flushes 68 bytes (twice)

## PART 4: DEBUG LOGGER WINDOW (DTR Assert)

### Window State After DTR Assert
- Debug Logger window is **cleared** of all previous content
- Only displays DTR assertion message at top:
  ```
  [SYSTEM] DTR Reset - New session started
  ```
- All previous COG messages and debugger packets cleared from display
- Window ready for new debug session

## PART 5: CONSOLE LOG (After DTR Release)

### DTR Toggle Sequence (Double Toggle)
- Two toggle-dtr requests received in quick succession
- New log file attempted: `/Users/stephen/logs/debug_250831-1148.log`
- Same fsyncSync error repeated multiple times
- DTR reset sequences 3 and 4 processed

### Serial Data Reception After Reset
- P2 program restarted, all COGs reinitialize:
  - COG0 INIT messages
  - COG1 INIT and task start
  - COG2 INIT and task start  
- Multiple 416-byte debugger packets received
- Stub responses sent for COG0 and COG1
- Message routing continues normally

### Data Stream Analysis
- Large amount of zeros in data stream (multiple 62-byte blocks of all zeros)
- Debugger packets interspersed with zero blocks
- Terminal output message: "Task in new COG started"
- Final message: "Cog0 Tasks run, Main now looping!"

### System Errors
- Multiple NSXPCSharedListener errors at 11:48:26 and 11:48:36:
  ```
  Connection interrupted
  failed to warm up class NSThemeWidgetZoomMenuServiceViewController
  ```
- These appear to be macOS system-level IPC errors

## PART 6: DEBUG LOGGER WINDOW (After DTR Release)

### Debug Output (11:48:20)
```
11:48:20.046431
Cog 0:
  000: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $00000000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
        .046450
Task in new COG started
        .047453
Cog 1:
  000: $01000000 $01000000   $0E00A103 $F8010000    $00000000 $757A3E00   $FF010000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
11:48:20.071945
Cog 0:
  000: $00000000 $00000000   $00000000 $00000000    $00000000 $00000000   $00000000 $00000000
  020: $00000000 $00000000
  ... [376 more bytes]
```

### Observations
- COG0 debugger packets show all zeros (empty/uninitialized state)
- COG1 debugger packet has actual data (non-zero values)
- Terminal message "Task in new COG started" properly displayed
- COG messages and debugger packets appearing in Debug Logger window
- Note: No COG2 debugger packet shown in this window output

## PART 7: FINAL OBSERVATIONS

### Critical UI Issues
- **HTML Menu Not Appearing**: Despite console indicating "HTML menu bar will be used", no menu is visible in the application window
- This is a confirmed regression - menu display still broken

---

## ANALYSIS OF ISSUES FOUND

### 1. CRITICAL FAILURES

#### A. Log File Initialization Error (REPEATED)
- **Error**: `TypeError: The "fd" argument must be of type number. Received null`
- **Location**: `fsyncSync` in `initializeLogFile` method
- **Impact**: Log files cannot be properly initialized or synced
- **Frequency**: Occurs on EVERY DTR reset attempt
- **Root Cause**: Write stream's file descriptor is null when fsyncSync is called

#### B. HTML Menu Not Visible
- **Symptom**: Console says "HTML menu bar will be used" but no menu appears
- **Impact**: Users cannot access File, Edit, View, Help menus
- **Status**: Regression - not fixed from previous attempts

#### C. Font Selector Script Failure
- **Error**: `Failed to execute font-selector-setup: Script failed to execute`
- **Impact**: Font selector dropdown non-functional
- **Likely Cause**: DOM element missing or script executing before DOM ready

### 2. FUNCTIONAL ISSUES

#### A. Active COGs Display Empty
- COG messages are being received and routed correctly
- Debug Logger shows COG0, COG1, COG2 messages
- Active COGs display remains empty (not updating)
- Window management appears to be working but display not updating

#### B. Double DTR Reset Processing
- DTR toggle triggers multiple reset sequences (1, 2, 3, 4)
- Each reset attempts to create new log file
- Causes redundant processing and errors

#### C. Excessive Zero Padding in Data Stream
- Hardware generating spurious blocks of zeros
- Multiple 62-byte blocks of all zeros between valid data
- Complicates parsing but doesn't break functionality

### 3. SYSTEM-LEVEL WARNINGS

#### A. MaxListenersExceededWarning
- 11 listeners added to WebContents (max 10)
- Potential memory leak in event listener management

#### B. macOS IPC Errors
- NSXPCSharedListener connection interrupts
- ThemeWidgetControlViewService failures
- May affect system integration features

### 4. WHAT'S WORKING CORRECTLY

#### ✅ Core Functionality
- Serial communication established
- Message extraction working (COG and debugger packets)
- Message routing to windows functional
- Debug Logger window receiving messages
- DTR/RTS control triggering resets
- Stub responses being sent for debugger packets

#### ✅ Data Processing
- Two-tier processor handling all data types
- Circular buffer and message pool working
- Adaptive timer adjusting based on message velocity
- Proper message classification

### 5. PRIORITY FIXES NEEDED

1. **HIGH**: Fix log file initialization error (fsyncSync issue)
2. **HIGH**: Fix HTML menu display 
3. **HIGH**: Fix font selector script execution
4. **MEDIUM**: Fix Active COGs display update
5. **MEDIUM**: Eliminate double DTR reset processing
6. **LOW**: Address MaxListenersExceededWarning
7. **DEFER**: Handle hardware zero padding (hardware issue)

### 6. ROOT CAUSE SUMMARY

Most issues appear to stem from:
1. **DOM Timing Issues**: Scripts executing before elements exist
2. **File Descriptor Management**: Write stream FD not available when needed
3. **Event Handler Duplication**: Multiple handlers for same events
4. **UI Layer Disconnection**: Data flowing but UI not updating

The core serial communication and message processing are working well, but the UI layer and file I/O have critical issues that need immediate attention.
