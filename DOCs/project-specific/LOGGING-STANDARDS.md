# PNut-Term-TS Logging Standards

## Purpose
This document is the authoritative logging specification for PNut-Term-TS. The **Principles**
section below defines *what we log, why, and how the logs are used*; the remaining sections
define the mechanical standards (file naming, timestamps, prefixes) that serve those principles.

---

## Logging Principles — what we log, why, and how logs are used

*(Established 2026-07 during the 1.0.0 release-prep audit. These principles govern every logging
decision; the standards further down exist to serve them.)*

### How the logs are used (this drives everything)

The debug log's **primary purpose is to capture program output** — it is read far more than it
is glanced at. Three distinct consumers:

1. **Headless mode → read by AI agents.** When an agent runs a P2 program headless, the program's
   `DEBUG()` output in the log is the agent's window into the behavior of code **the agent itself
   wrote**. This is a feedback loop, and it is the single most important use of the log. Program
   (terminal) output must therefore be **clean, complete, and never polluted** by internal noise.
2. **Interactive mode → read by agents during hardware testing,** and the logs are **archived as
   regression evidence** that later becomes release-note material. So logs must be well-formed and
   self-documenting (timestamps, one event per line) for after-the-fact reading.
3. **The user → sees their own output.** The user inspects their `DEBUG()` terminal output, their
   debug-window (display) output, and the system's placement/download advice.

### The four content buckets (split by audience, NOT by verbosity)

| Bucket | Whose content / role | Policy |
|---|---|---|
| **Terminal output** | user/agent `DEBUG()` text — the **primary** content; the agent feedback loop | **always live, kept clean** |
| **System advice** | window placement (`WINDOW_PLACED`), download start/success/fail, baud, DTR/RTS resets, **directive `ERROR`/`WARNING`** (validation failures + valid ranges that help the user fix their `DEBUG` directives), and the user's optional `LOG_PURPOSE` annotation — the run narrative | **always live** |
| **Debug-window (display) output** | tick-based bitmap/scope/plot/… data the user wants inspectable | **always live** (high-volume) |
| **Transport diagnostics** | *our* `[CTRL]`/`[DEBUGGER]` Phase-1/2/3 framing traffic + USB wire capture | **compile-time gated OFF for releases** |

The guiding rule: **program output is the log's reason to exist and stays clean; transport
diagnostics are ours, are meaningless to the user/agent reading program output, and must not
pollute it.**

### Policies that follow

1. **Discrete events are one line, with their own timestamp.** System/diagnostic messages write
   directly as complete lines (`loggerWin.writeLogEntry`); they must **not** flow through the
   serial-stream line-accumulator (`writeToLog`), whose job is reassembling the *streamed* P2
   serial data across chunks. (Mixing the two made newline-less events pile onto one physical
   line until a serial newline flushed the blob — fixed 2026-07-17.)
2. **Transport diagnostics are compile-time gated, not runtime.** A single constant,
   **`ENABLE_DIAGNOSTICS`** (injected by esbuild `define`), gates all `[CTRL]`/`[DEBUGGER]`
   framing traffic. Rationale: **performance** — the per-chunk firehose must be *dead-code-
   eliminated* for users, not merely branched-over. Dev / pre-release builds compile it **in**
   (we audit transport with it on); the **release build** (`build:release` / `PNUT_RELEASE=1`)
   compiles it **out** → zero runtime cost, no protocol noise. The package scripts run
   `build:release`, so every shipped bundle strips it automatically (a **structural release
   gate**, not a manual flip). `performance.log` is an independent developer diagnostic, off by
   default (it wrote to the hot serial path).
3. **The logs directory is intentional and user-overridable.** Logs live **next to the run**
   (working-directory-relative) on purpose, so artifacts land beside the test programs and are
   easy to gather/share; the user can override the location. Headless logs always go to the logs
   folder. **Do not relocate this to a user-data dir.**
4. **Files are created only when needed, at the right time.** Config/catalog files are written
   **only on a real user action** (settings save, a recording added) — never merely by launching
   the app. `pnut-term-ts.json` project settings are created on save (they live alongside the
   source — *project*-specific, not user-specific); the recordings `catalog.json` is created
   lazily on the first recording; `performance.log` is off. Nothing appears just because the app
   started.
5. **The USB traffic log is the deep-wire transport tool** — a separate raw RECV/SEND capture
   retained for framing forensics, gated like the other transport diagnostics.
6. **Every debug-log session records the app version.** The session-start banner logs
   `PNut-Term-TS: vX.Y.Z` (baked from `package.json` at build time via the esbuild `APP_VERSION`
   define). This is essential for the regression-evidence / release-notes use — a captured log
   must state exactly which build produced it.
7. **The `RouterLogger` is a separate, ENV-VAR-controlled diagnostic** (`ROUTER_LOG_LEVEL`,
   `ROUTER_LOG_FILE`, `ROUTER_LOG_PATH`) — the one exception to the compile-time model, because
   it predates the gate. It must obey the "no files unless needed" rule: it currently opens a
   dated `router-*.log` every session even when its level emits nothing (empty-file clutter) —
   that is a known deviation to fix (open the stream lazily on first real write).

### Message routing (three program-output channels)

Program output fans out to three destinations (matches `DEBUG-LOGGER-BEHAVIOR.md`):
- **Debug Logger** ← Cog-prefixed output, `INIT` boot lines, and `[SYSTEM]` advice.
- **Blue Terminal (main window)** ← plain (non-prefixed) serial, `Prop_*` download responses, echo.
- **Specific debug windows** ← backtick directives (`` `SCOPE 'x' … `` ), extracted from the stream.

### Canonical message formats (code is truth — 2026-07)

These reflect the **current implementation** and supersede any older examples further down:
- **System-advice prefix:** `[SYSTEM] ` (e.g. `[SYSTEM] WINDOW_PLACED …`, `[SYSTEM] ERROR …`).
  *Note: earlier drafts used a ` * ` prefix and `grep "^ \* …"` filters — the code uses
  `[SYSTEM]`; filter with `grep "\[SYSTEM\]"`.*
- **Session boundaries:** banner lines, not `LOG_START`/`LOG_ENDED` markers —
  `=== Debug Logger Session Started at <ISO> ===`, then `PNut-Term-TS: vX.Y.Z`, then `Program: <name>`;
  end via `=== Session ended … ===` (with the reason: DTR/RTS reset, download started, shutdown).
- **Content timestamp:** ISO-8601 `[YYYY-MM-DDTHH:MM:SS.mmm]` (from `getFormattedDateTimeISO()`).
- **File names (per logger, as actually emitted):** debug logger `debug_YYMMDD-HHMMSS.log`;
  USB wire `usb-traffic_YYMMDD-HHMMSS.log`; router `router-YYYY-MM-DD.log`; window exports keep
  their format-specific extension (`.csv`/`.vcd`/`.bmp`). *(The single `{Prefix}_{Ctx}_…` pattern
  below is aspirational; the loggers currently differ per the list here.)*

### Where these live in code (pointers)

- Program-output + system-advice logging: `src/classes/loggerWin.ts`
  (`logSystemMessage` → `writeLogEntry`; serial stream via `writeToLog`; session banner writes
  `PNut-Term-TS: v${APP_VERSION}`).
- Transport-diagnostics gate: `ENABLE_DIAGNOSTICS` (`src/types/globals.d.ts`, `esbuild.config.js`
  `define`, `package.json` `build:release`); gate points in
  `src/classes/debugger/renderer/index.ts` (the `[CTRL]` callback) and
  `src/classes/debugDebuggerWin.ts` (`debugLog`).
- File-creation hygiene: `mainWindow.loadGlobalSettings` (settings on save only),
  `recordingCatalog.ts` (lazy catalog), `serialMessageProcessor` (`performance.log` off).

---

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