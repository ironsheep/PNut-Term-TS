# Debug Logger Window Behavior

## Overview
The Debug Logger Window is a specialized terminal that captures ALL debug output from the Propeller 2, providing a complete audit trail of debug sessions with system messages for window placement, errors, and session boundaries.

## Message Flow and Window Creation

### Connection Scenarios

#### 1. Mid-Stream Connection (P2 Already Running)
- User connects while P2 is already executing
- May receive partial line, then Cog-prefixed messages
- **First Cog message** triggers Debug Logger window creation
- Window starts logging immediately

#### 2. Fresh Boot (After DTR/RTS Reset)
- DTR or RTS toggle resets the P2
- Boot sequence begins with INIT messages
- **First INIT message** triggers Debug Logger window creation
- Typical sequence:
  ```
  INIT $0000_0000 $0000_0000 load       ; Cog 0 boot loader
  INIT $0000_0400 $0000_0000 Spin2      ; Cog 1 Spin2 interpreter
  Cog0  Debug output begins...
  ```

### Log File Management

#### Starting Logs
- **First traffic after DTR/RTS** starts new log file
- Not the DTR/RTS event itself - ensures clean boundaries
- Log files named: `basename_YYYYMMDD_HHMMSS_debug.log`
- First line always: ` * LOG_START filename.log (P2 connected via /dev/ttyXXX)`
- Second line (if configured): ` * LOG_PURPOSE Testing feature XYZ`

#### Ending Logs
- **DTR/RTS toggle** closes current log with reason:
  - ` * LOG_ENDED DTR reset for download`
  - ` * LOG_ENDED RTS reset for download`
  - ` * LOG_ENDED User reset via DTR toggle`
- **Other endings**:
  - ` * LOG_ENDED App shutdown by user`
  - ` * LOG_ENDED Connection lost to P2`
  - ` * LOG_ENDED User closed debug logger window`

#### Window Persistence
- Debug Logger window **stays open** during DTR/RTS reset
- Only the log file closes/reopens
- Provides continuous view across multiple debug sessions

## System Messages

All system messages use ` * ` prefix for visual distinction and easy grep filtering:

### Message Categories

#### WINDOW_PLACED
Shows auto-positioned windows with exact command to reproduce:
```
 * WINDOW_PLACED (150,250 600x400 Mon:1) SCOPE 'Timing' POS 150 250 SIZE 600 400
```
Users can copy everything after the parentheses to lock the position.

#### ERROR
Validation failures with window type and name, including valid ranges:
```
 * ERROR SCOPE 'Timing' - missing SIZE parameter (requires: SIZE width height, range: 100-2000)
 * ERROR BITMAP 'Status' - position 2000,1500 exceeds screen bounds (0,0 to 1920,1080)
 * ERROR PLOT 'Data' - invalid samples value 5000 (valid range: 1-1024)
 * ERROR SCOPE 'Wave' - trace count 12 exceeds maximum (valid range: 1-8)
 * ERROR TERM 'Debug' - invalid font size 48 (valid range: 8-24)
```

#### WARNING
Non-fatal issues with corrective action taken:
```
 * WARNING TERM 'Debug2' - buffer overflow at 50000 lines, dropped oldest 5000 (max: 50000)
 * WARNING BITMAP 'Display' - position 2000,1500 adjusted to 1720,880 (screen: 1920x1080)
 * WARNING SCOPE 'Signal' - sample rate 10MHz exceeds maximum, clamped to 1MHz
```

#### Session Management
```
 * LOG_START filename.log (P2 connected via /dev/ttyUSB0)
 * LOG_PURPOSE Debugging I2C timing issues
 * LOG_ENDED DTR reset for download
```

## Message Routing

### To Debug Logger
- **Cog-prefixed messages**: `Cog0  Debug output`
- **INIT messages**: `INIT $0000_0000 $0000_0000 load`
- **System messages**: ` * WINDOW_PLACED ...`

### To Blue Terminal (Main Window)
- **Regular output**: Non-prefixed serial data
- **Prop messages**: Download responses (`Prop_Hex`, `Prop_Ver`)
- **User input echo**: If echo enabled

### To Specific Debug Windows
- **Backtick commands**: `` `SCOPE 'MyScope' POS 100 100``
- **Embedded in Cog messages**: Extracted and processed

## Filtering and Searching

Users can filter system messages using grep:
```bash
grep "^ \* WINDOW_PLACED" debug.log    # Find all auto-positioned windows
grep "^ \* ERROR" debug.log            # Find all errors
grep "^ \* LOG_" debug.log             # Find session boundaries
grep "^ \*" debug.log                  # All system messages
grep "^Cog" debug.log                  # All Cog output
```

## Performance Characteristics

- **Message batching**: 16ms intervals (60fps)
- **Buffer limit**: 10,000 lines displayed
- **File writing**: Async with 100ms flush interval
- **Circular buffer**: Drops oldest 10% when full
- **Target throughput**: 2 Mbps sustained

## User Benefits

1. **Complete audit trail** - Every debug session logged with context
2. **Window placement memory** - Copy AUTO_POS commands to lock layouts
3. **Error tracking** - All validation errors logged with context
4. **Session boundaries** - Clear start/stop with reasons
5. **Project context** - Log purpose tracks what you're debugging
6. **Easy filtering** - Consistent format enables grep/search