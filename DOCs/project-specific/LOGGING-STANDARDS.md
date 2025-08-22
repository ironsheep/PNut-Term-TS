# PNut-Term-TS Logging Standards

## Purpose
This document defines the universal logging standards for all features in PNut-Term-TS that create log files. Following these standards ensures consistency, clarity, and easy organization of debug output.

## File Naming Convention

### Required Pattern
All log files MUST follow this naming pattern that builds on the existing prefix:
```
{ExistingPrefix}_{ContextInjection}_{YYYYMMDD}_{HHMMSS}.log
```

Where:
- **ExistingPrefix**: Binary name or project-specific override (e.g., `myProject`, `spin2binary`)
- **ContextInjection**: Feature-specific identifier (e.g., `Cog0`, `Term_MyTerm`)
- **Timestamp**: Standard `YYYYMMDD_HHMMSS` format

### Examples with Existing Prefix
Assuming binary/project prefix is `myProject`:
- `myProject_20250814_093045.log` - Main debug logger output (no injection)
- `myProject_Cog0_20250814_094512.log` - Cog 0 specific debug dump
- `myProject_Cog1_20250814_094515.log` - Cog 1 specific debug dump
- `myProject_Term_MyTerm_20250814_100230.log` - Terminal window "MyTerm"
- `myProject_Error_20250814_143022.log` - Error log capture

### Why This Approach Works
1. **Consistency**: All logs from same session share the base prefix
2. **Discoverability**: Sort by name groups all related logs together
3. **Clarity**: Context injection immediately shows log purpose
4. **Compatibility**: Extends existing system rather than replacing it

## Context Prefix Standards

### Required Prefixes by Feature

| Feature | Prefix Pattern | Example |
|---------|---------------|---------|
| Debug Logger | `DebugCapture` | `DebugCapture_20250814_093045.log` |
| Cog Windows | `Cog{0-7}` | `Cog0_20250814_094512.log` |
| Recording/Playback | `Recording` | `Recording_20250814_095000.jsonl` |
| Terminal Windows | `Term_{Name}` | `Term_MyTerm_20250814_100230.log` |
| Scope Windows | `Scope_{Name}` | `Scope_MyScope_20250814_101545.csv` |
| Logic Windows | `Logic_{Name}` | `Logic_MyLogic_20250814_102030.vcd` |
| FFT Windows | `FFT_{Name}` | `FFT_MyFFT_20250814_103000.csv` |
| Bitmap Windows | `Bitmap_{Name}` | `Bitmap_MyBitmap_20250814_104000.bmp` |
| Error Logs | `Error` | `Error_20250814_143022.log` |
| Performance Logs | `Performance` | `Performance_20250814_150000.log` |

## Timestamp Requirements

### In Filenames
- Format: `YYYYMMDD_HHMMSS`
- Example: `20250814_093045` (August 14, 2025, 9:30:45 AM)
- Use 24-hour format
- Always use local time

### In Log Content
Every log line MUST start with a timestamp:

#### Full Format (Recommended)
```
[2025-08-14 09:30:45.123] Log message here
```
- Format: `[YYYY-MM-DD HH:MM:SS.mmm]`
- Includes milliseconds for precision
- Square brackets for easy parsing

#### Short Format (For same-day logs)
```
[09:30:45.123] Log message here
```
- Format: `[HH:MM:SS.mmm]`
- Acceptable when date is in filename
- Still includes milliseconds

### Session Markers
Mark the beginning and end of logging sessions:
```
[2025-08-14 09:30:45.123] * LOG_START - User initiated recording
[2025-08-14 10:45:22.789] * LOG_END - User stopped recording
```

Common reasons:
- User initiated/stopped
- DTR reset
- Connection lost
- Application closing
- Buffer full
- Error occurred

## Directory Organization

### Standard Structure
```
Logs/
├── DebugCapture_20250814_093045.log      # Current session main log
├── Cog0_20250814_094512.log              # Cog-specific dump
├── Cog1_20250814_094515.log              # Another cog dump
├── Recording_20250814_095000.jsonl        # Session recording
├── archive/                               # Older logs
│   ├── DebugCapture_20250813_143022.log
│   └── DebugCapture_20250812_091500.log
└── .index                                 # Optional index file
```

### Archiving Rules
- Logs older than N days moved to `archive/` (N configurable, default 7)
- Archive can be cleaned manually or automatically
- Important logs can be marked as "keep" to prevent archiving

## Content Format Standards

### Debug Messages
```
[HH:MM:SS.mmm] Cog0: Debug message here
[HH:MM:SS.mmm] Cog1: Another message
[HH:MM:SS.mmm] * SYSTEM: Window created
```

### System Messages
Always prefix with ` * `:
```
[HH:MM:SS.mmm] * LOG_START - Recording initiated
[HH:MM:SS.mmm] * WINDOW_CREATED - Term 'MyTerm' at (100, 100)
[HH:MM:SS.mmm] * ERROR - Failed to open file
[HH:MM:SS.mmm] * LOG_END - User stopped recording
```

### Binary Data
Use hex notation with clear formatting:
```
[HH:MM:SS.mmm] BINARY: $00 $01 $02 $03 $04 $05 $06 $07  $08 $09 $0A $0B $0C $0D $0E $0F
```

## Implementation Guidelines

### Centralized Logging
Create a `LogFileManager` class that:
- Handles all file creation
- Enforces naming standards
- Manages timestamps
- Handles archiving
- Provides consistent API

### Example API
```typescript
class LogFileManager {
  createLog(type: LogType, name?: string): LogFile
  writeEntry(log: LogFile, message: string): void
  closeLog(log: LogFile, reason: string): void
  archiveOldLogs(daysToKeep: number): void
}
```

### Settings Integration
Allow users to configure:
- Log directory location (default: `./Logs`)
- Archive threshold (default: 7 days)
- Timestamp format preference
- Auto-archive enable/disable
- Maximum log size before rotation

## Benefits

Following these standards provides:
1. **Clarity**: Immediately obvious what each log contains
2. **Organization**: Easy to find specific logs
3. **Debugging**: Timestamps enable correlation across logs
4. **Automation**: Consistent format enables tooling
5. **Cleanup**: Clear archiving rules prevent disk bloat

## Enforcement

- All new features MUST follow these standards
- Existing features should be updated to comply
- Code reviews should check for compliance
- LogFileManager should enforce standards programmatically

## Version History

- v1.0 (2025-08-14): Initial standards definition
- Added context prefixes for all window types
- Defined timestamp requirements
- Established directory organization