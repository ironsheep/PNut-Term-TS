# Debug Logger Window Behavior

> **⚠️ FORMAT NOTE (2026-07):** The ` * ` system-message prefix and `LOG_START`/`LOG_ENDED`
> markers shown in the examples below are **stale**. The code actually emits the **`[SYSTEM]`**
> prefix and `=== … ===` session banners (with a `PNut-Term-TS: vX.Y.Z` line). The **canonical
> current formats** — prefixes, session boundaries, timestamps, filenames — and the governing
> **logging principles** live in **`LOGGING-STANDARDS.md`** (§ Logging Principles / § Canonical
> message formats). This doc's *behavior* (routing, session lifecycle, message categories) is
> still accurate; only the literal prefix/marker spellings drifted.

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
- Log files named: `debug_YYMMDD-HHMMSS.log` (see LOGGING-STANDARDS.md for every logger's name)
- Opens with a banner block, not a `LOG_START` marker:
  ```
  === Debug Logger Session Started at 2026-07-19T14:11:01.872 ===
  PNut-Term-TS: v0.9.98
  Program: debug
  =====================================
  ```
  The version line is required of every log kind — see LOGGING-STANDARDS.md principle 6.

#### Ending Logs
Closed with a banner carrying the reason, not a `LOG_ENDED` marker — e.g.
`=== Session ended - Download Started at <ISO> ===`,
`=== Session ended due to DTR Reset at <ISO> ===`,
`=== Debug Logger Session Ended at <ISO> ===`.
Reasons include: download started, DTR/RTS reset, app shutdown, connection lost, logger window
closed.

#### Window Persistence
- Debug Logger window **stays open** during DTR/RTS reset
- Only the log file closes/reopens
- Provides continuous view across multiple debug sessions

## System Messages

System messages are written as their own timestamped line, prefixed `[SYSTEM]`:

```
[2026-07-19T14:11:01.770] [SYSTEM] BAUD_RATE_SET 2000000 baud (preferences/default)
```

> ⚠️ The ` * ` prefix described in older revisions of this document is **retired**. Grep filters
> built on ` * ` match nothing. Filter on `[SYSTEM]` instead. (Each system/diagnostic event has
> had its own line since the fix in v0.9.98; previously they accumulated onto one physical line
> until a serial newline flushed them.)

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
As actually emitted — banner blocks, not `LOG_START`/`LOG_ENDED` markers:
```
=== Debug Logger Session Started at 2026-07-19T14:11:01.872 ===
PNut-Term-TS: v0.9.98
Program: debug
=====================================

[2026-07-19T14:11:01.770] [SYSTEM] LOG_PURPOSE Debugging I2C timing issues

=== Session ended - Download Started at 2026-07-19T14:11:02.287 ===
```

## Message Routing

### To Debug Logger
- **Cog-prefixed messages**: `Cog0  Debug output`
- **INIT messages**: `INIT $0000_0000 $0000_0000 load`
- **System messages**: `[SYSTEM] WINDOW_PLACED ...` (own timestamped line)

### To Blue Terminal (Main Window)
- **Regular output**: Non-prefixed serial data
- **Prop messages**: Download responses (`Prop_Hex`, `Prop_Ver`)
- **User input echo**: If echo enabled

### To Specific Debug Windows
- **Backtick commands**: `` `SCOPE 'MyScope' POS 100 100``
- **Embedded in Cog messages**: Extracted and processed

## Filtering and Searching

Users can filter system messages using grep (log lines are timestamped, so match anywhere,
not with `^`):
```bash
grep "\[SYSTEM\] WINDOW_PLACED" debug.log   # auto-positioned windows
grep "\[SYSTEM\] ERROR" debug.log           # directive validation errors
grep "^=== " debug.log                      # session boundaries (banner lines)
grep "\[SYSTEM\]" debug.log                 # all system messages
grep "\] Cog" debug.log                     # all Cog output
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