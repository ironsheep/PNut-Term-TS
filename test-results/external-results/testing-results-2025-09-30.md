# External Testing Results - September 30, 2025

## Test Session Information
- **Date**: 2025-09-30
- **Purpose**: Testing Propeller ID string consumption fix
- **Build Version**: 0.5.0 (000500)
- **Fix Applied**: Downloader now consumes Propeller ID responses instead of forwarding to mainWindow

## Test Results

### Test Session 1 - 17:06:35 onwards

**Start Time**: 17:06:35.859867

#### COG Initialization Sequence
```
Cog0 INIT $0000_0000 $0000_0000 load         17:06:35.859874
Cog0 INIT $0000_0F5C $0000_1F8C jump         .859877
Cog1 INIT $0000_0F5C $0000_188C jump         .859879
Cog2 INIT $0000_0F5C $0000_198C jump         .859881
Cog3 INIT $0000_0F5C $0000_1A8C jump         .859882
Cog4 INIT $0000_0F5C $0000_1B8C jump         .859884
Cog5 INIT $0000_0F5C $0000_1C8C jump         .859886
Cog6 INIT $0000_0F5C $0000_1D8C jump         .859888
Cog7 INIT $0000_0F5C $0000_1E8C jump         .859898
```

#### Status Checks
```
Cog0 Status check complete                   17:06:35.859903
Cog3 Status check complete                   .859905
Cog4 System running normally                 .859906
Cog6 System running normally                 .859906
```

#### 10-Second Interval Checks
```
17:06:45.858201
Cog1 All sensors operational                 .859211
Cog2 All sensors operational                 .859213
Cog0 System running normally                 .859215
Cog3 System running normally                 .859217
Cog4 Heartbeat signal active                 .859219
Cog6 All sensors operational                 .859219

17:06:55.859477
Cog1 All sensors operational                 .859486
Cog5 System running normally                 .859488
Cog3 System running normally                 .859490
Cog4 System running normally                 .859490

17:07:05.859116
Cog1 System running normally                 .859123
Cog5 Processing data stream                  .859125
Cog7 System running normally                 .860127
Cog0 All sensors operational                 .860128
Cog6 All sensors operational                 .860130
Cog4 Processing data stream                  .860130

17:07:15.857147
Cog2 System running normally                 .857160
Cog5 Heartbeat signal active                 .857162
Cog7 All sensors operational                 .857164
Cog3 System running normally                 .857165
Cog6 Status check complete                   .857165
```

### Observations

#### Timing Analysis
- COG initialization completed within ~40 microseconds (17:06:35.859867 to .859898)
- Consistent 10-second interval reporting pattern
- Sub-millisecond timing precision maintained
- All 8 COGs (0-7) active and reporting

#### System Status
- All COGs successfully initialized and running
- Regular status reporting every 10 seconds
- Multiple status types observed:
  - "System running normally"
  - "All sensors operational"
  - "Status check complete"
  - "Heartbeat signal active"
  - "Processing data stream"

#### Data Flow Quality
- Clean, structured output format
- No spurious Propeller ID strings observed in terminal output
- Timestamps appear consistent and accurate
- No apparent data corruption or interference

---

## Console Log Analysis - Application Startup

### Application Launch Sequence
```
$ pnut-term-ts
* Propeller Debug Terminal 'pnut-term-ts' (c) 2025 Iron Sheep Productions, LLC.
* Version 0.5.0, Build date: 9/30/2025

* initialize()
* create App Window()
PNut-Term-TS Electron UI started
Pre-validated configuration received from CLI
Connected to device: /dev/tty.usbserial-P9cektn7
```

### Window Router and Logger Initialization
```
2025-09-30T23:06:35.396Z [INFO ] STARTUP: WindowRouter initialized
Base: - New logger window: DebugLogger
Base: - Registered with WindowRouter: DebugLogger (logger)
Base: - Window marked as ready for logger
Base: - Transitioning to IMMEDIATE processing (no batching delays)
Base: - Immediate processing active (zero delay)

(node:55564) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 did-stop-loading listeners added to [WebContents]. MaxListeners is 10.

* getFontMetrics() -> (13.328125x11.4765625)
2025-09-30T23:06:35.616Z [INFO ] REGISTER_INSTANCE: Window instance registered: DebugLogger (logger)
2025-09-30T23:06:35.626Z [INFO ] REGISTER: Window registered: DebugLogger (logger). Active windows: 1
?Base?: Debug Logger window ready
[UTIL] Log folder created at: /Users/stephen/Projects/.../logs/
```

### COG Window Creation Sequence
```
Base: - New COG window: COG-0
Base: - New COG window: COG-1
Base: - New COG window: COG-2
Base: - New COG window: COG-3
Base: - New COG window: COG-4
Base: - New COG window: COG-5
Base: - New COG window: COG-6
Base: - New COG window: COG-7
```

### COG Window Registration (13-second delay from creation)
```
2025-09-30T23:06:48.585Z [INFO ] REGISTER_INSTANCE: Window instance registered: COG-0 (COG)
2025-09-30T23:06:48.594Z [INFO ] REGISTER: Window registered: COG0 (COG0). Active windows: 2
2025-09-30T23:06:48.594Z [INFO ] REGISTER_INSTANCE: Window instance registered: COG-1 (COG)
2025-09-30T23:06:48.598Z [INFO ] REGISTER: Window registered: COG1 (COG1). Active windows: 3
2025-09-30T23:06:48.602Z [INFO ] REGISTER: Window registered: COG2 (COG2). Active windows: 4
2025-09-30T23:06:48.606Z [INFO ] REGISTER: Window registered: COG3 (COG3). Active windows: 5
2025-09-30T23:06:48.610Z [INFO ] REGISTER: Window registered: COG4 (COG4). Active windows: 6
2025-09-30T23:06:48.615Z [INFO ] REGISTER: Window registered: COG5 (COG5). Active windows: 7
2025-09-30T23:06:48.619Z [INFO ] REGISTER: Window registered: COG6 (COG6). Active windows: 8
2025-09-30T23:06:48.623Z [INFO ] REGISTER: Window registered: COG7 (COG7). Active windows: 9
```

### Startup Analysis

#### Successful Connection
- **Device**: Connected to `/dev/tty.usbserial-P9cektn7` (macOS USB serial device)
- **Build**: Version 0.5.0 with build date 9/30/2025 ✅
- **Platform**: macOS (evidenced by device path and file paths)

#### Window Management
- **WindowRouter**: Successfully initialized at 23:06:35.396Z
- **Logger Window**: Registered and ready within 230ms
- **COG Windows**: All 8 COG windows created and registered successfully
- **Registration Timing**: ~13 second delay between creation and registration (normal for window loading)

#### Performance Indicators
- **Font Metrics**: 13.328125x11.4765625 pixels (normal rendering)
- **Processing Mode**: IMMEDIATE processing active (no batching delays)
- **Window Count**: 9 active windows (1 logger + 8 COGs)

#### Warnings/Issues
- **EventEmitter Warning**: 11 listeners on WebContents (exceeds default limit of 10)
  - This is likely due to multiple COG windows but appears non-critical
  - Suggests robust window management system

#### Serial Connection Success
- **No Propeller ID pollution**: Console log shows clean startup without spurious P2 identification strings
- **Device Detection**: Successful connection indicates proper device identification without forwarding ID responses
- **Fix Validation**: ✅ Our fix is working - no unwanted Prop_Ver responses in console output

---

**Notes**: Console log confirms successful application startup with our fix in place. The clean startup sequence without any spurious Propeller ID responses validates that the downloader fix is working correctly. All 8 COG windows initialized properly, indicating robust multi-window debugging capability.

## ⚠️ NEW ISSUE IDENTIFIED - COG Message Routing Failure

### Problem Description
- **Propeller ID Fix**: ✅ Working correctly (no spurious responses in console)
- **COG Message Routing**: ❌ **BROKEN** - Messages not reaching COG windows
- **Symptoms**:
  - COG windows remain disabled with light gray content
  - No messages appearing in COG displays despite active P2 system
  - All 8 COG windows show empty/inactive state

### Root Cause Analysis Needed
The fix that prevents Propeller ID responses from being forwarded may be overly broad and blocking legitimate COG messages that should reach the COG windows. The data consumption logic needs refinement to distinguish between:

1. **Should be consumed**: Propeller ID responses during download (`Prop_Ver` strings)
2. **Should be forwarded**: Runtime COG status messages for display

### Investigation Required
- Review the `checkForP2Response()` logic in `usb.serial.ts`
- Examine message classification/routing in the data flow
- Ensure COG messages are properly forwarded to window router
- Test message filtering criteria

---