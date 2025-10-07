# Message Routing Table

Complete routing specification for P2 serial message traffic through Worker Thread architecture.

## Overview

Messages flow from USB serial → Worker Thread → SharedMessagePool → MessageRouter → WindowRouter → Specific Windows

## Complete Routing Table

All 28 SharedMessageType values from worker thread extraction.

| # | SharedMessageType | Maps to MessageType | Destinations | WindowRouter Behavior | Error if Missing? |
|---|-------------------|---------------------|--------------|----------------------|-------------------|
| **Protocol Messages** |
| 0 | `DB_PACKET` | `DB_PACKET` | DebugLogger + DebuggerWindow(cogId) | Routes to `debugger-{cogId}` | ✅ Yes |
| **COG Messages (0-7) + P2 Init** |
| 17 | `P2_SYSTEM_INIT` | `COG_MESSAGE` | DebugLogger + **COG0 window** + **Special Handling** | Routes to `COG0` | ❌ No (silent drop) |
| 1 | `COG0_MESSAGE` | `COG_MESSAGE` | DebugLogger + COG0 window | Routes to `COG0` | ❌ No (silent drop) |
| 2 | `COG1_MESSAGE` | `COG_MESSAGE` | DebugLogger + COG1 window | Routes to `COG1` | ❌ No (silent drop) |
| 3 | `COG2_MESSAGE` | `COG_MESSAGE` | DebugLogger + COG2 window | Routes to `COG2` | ❌ No (silent drop) |
| 4 | `COG3_MESSAGE` | `COG_MESSAGE` | DebugLogger + COG3 window | Routes to `COG3` | ❌ No (silent drop) |
| 5 | `COG4_MESSAGE` | `COG_MESSAGE` | DebugLogger + COG4 window | Routes to `COG4` | ❌ No (silent drop) |
| 6 | `COG5_MESSAGE` | `COG_MESSAGE` | DebugLogger + COG5 window | Routes to `COG5` | ❌ No (silent drop) |
| 7 | `COG6_MESSAGE` | `COG_MESSAGE` | DebugLogger + COG6 window | Routes to `COG6` | ❌ No (silent drop) |
| 8 | `COG7_MESSAGE` | `COG_MESSAGE` | DebugLogger + COG7 window | Routes to `COG7` | ❌ No (silent drop) |
| **Debugger Messages (0-7)** |
| 9 | `DEBUGGER0_416BYTE` | `DEBUGGER_416BYTE` | DebugLogger + DebuggerWindow | Routes to `debugger-0` (auto-create) | ⚠️ Auto-create |
| 10 | `DEBUGGER1_416BYTE` | `DEBUGGER_416BYTE` | DebugLogger + DebuggerWindow | Routes to `debugger-1` (auto-create) | ⚠️ Auto-create |
| 11 | `DEBUGGER2_416BYTE` | `DEBUGGER_416BYTE` | DebugLogger + DebuggerWindow | Routes to `debugger-2` (auto-create) | ⚠️ Auto-create |
| 12 | `DEBUGGER3_416BYTE` | `DEBUGGER_416BYTE` | DebugLogger + DebuggerWindow | Routes to `debugger-3` (auto-create) | ⚠️ Auto-create |
| 13 | `DEBUGGER4_416BYTE` | `DEBUGGER_416BYTE` | DebugLogger + DebuggerWindow | Routes to `debugger-4` (auto-create) | ⚠️ Auto-create |
| 14 | `DEBUGGER5_416BYTE` | `DEBUGGER_416BYTE` | DebugLogger + DebuggerWindow | Routes to `debugger-5` (auto-create) | ⚠️ Auto-create |
| 15 | `DEBUGGER6_416BYTE` | `DEBUGGER_416BYTE` | DebugLogger + DebuggerWindow | Routes to `debugger-6` (auto-create) | ⚠️ Auto-create |
| 16 | `DEBUGGER7_416BYTE` | `DEBUGGER_416BYTE` | DebugLogger + DebuggerWindow | Routes to `debugger-7` (auto-create) | ⚠️ Auto-create |
| **Window Commands (Backtick) - 9 Types** |
| 18 | `WINDOW_LOGIC` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| 19 | `WINDOW_SCOPE` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| 20 | `WINDOW_SCOPE_XY` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| 21 | `WINDOW_FFT` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| 22 | `WINDOW_SPECTRO` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| 23 | `WINDOW_PLOT` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| 24 | `WINDOW_TERM` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| 25 | `WINDOW_BITMAP` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| 26 | `WINDOW_MIDI` | `BACKTICK_WINDOW` | Creation OR Update | Routes to user-named window | ✅ Yes (if update) |
| **User Program Output (Catch-All)** |
| 27 | `TERMINAL_OUTPUT` | `TERMINAL_OUTPUT` | DebugLogger + **MainWindow.appendLog()** | N/A (direct to blue window) | N/A |
| 28 | `INVALID_COG` | `INVALID_COG` | DebugLogger + **MainWindow.appendLog()** | N/A (direct to blue window) | N/A |

## Routing Behaviors

### 1. Silent Drop (COG Messages)
- **When:** COG0-7 messages arrive
- **Behavior:** Route to DebugLogger (always) + COG window (if exists)
- **Error:** NO - COG windows are optional, silent drop if not created
- **Reason:** User may not have opened individual COG windows

### 2. Error on Missing (Window Updates)
- **When:** Backtick update command for specific window (e.g., `` `MyLogic $FF $00``)
- **Behavior:** Route to WindowRouter → find window by name
- **Error:** YES - Log error to DebugLogger and terminal
- **Reason:** Window should have been created by earlier command

### 3. Auto-Create (Debugger Windows)
- **When:** 416-byte debugger packet arrives
- **Behavior:** Create debugger window on-demand if doesn't exist
- **Error:** NO - Automatically created
- **Reason:** Debugger windows created by protocol traffic, not user commands

## Two Router Architecture

### Router 1: MessageRouter (Type-Based)
**Location:** `src/classes/shared/messageRouter.ts`

**Input:** poolId from Worker Thread → reads from SharedMessagePool

**Responsibility:** Route by MESSAGE TYPE (protocol-level classification)

**Outputs:**
- `routeToDebugLogger()` - DebugLogger window + MainWindow terminal
- `handleWindowCommand()` - Window creation/update logic
- `routeToDebuggerWindow()` - Debugger window routing
- `routeToCOGWindows()` - COG window routing

### Router 2: WindowRouter (Name-Based)
**Location:** `src/classes/shared/windowRouter.ts`

**Input:** `routeMessage()` calls with window names or COG IDs

**Responsibility:** Route by WINDOW NAME (instance-level routing)

**Maintains Registry:**
```typescript
windows: Map<string, { type: string; handler: WindowHandler; stats }>
```

**Example Entries:**
- `"LOGIC1"` → LogicWindow instance
- `"SCOPE2"` → ScopeWindow instance
- `"COG3"` → COG Window for COG 3
- `"debugger-5"` → Debugger window for COG 5
- `"logger"` → Debug Logger window
- `"terminal"` → Main window terminal

## Message Flow

```
USB Serial Data
    ↓
MainWindow.receiveSerial()
    ↓
SerialMessageProcessor.receiveData()
    ↓
WorkerExtractor.receiveData()
    ↓
SharedCircularBuffer (bulk write)
    ↓
[Worker Thread: Autonomous extraction loop]
    ↓
Worker allocates message in SharedMessagePool
    ↓
Worker sends poolId to main thread
    ↓
WorkerExtractor emits 'messageExtracted' event
    ↓
SerialMessageProcessor.routeFromPool(poolId)
    ↓
MessageRouter queries SharedMessagePool for type
    ↓
MessageRouter maps SharedMessageType → MessageType
    ↓
MessageRouter routes to destination handlers
    ↓
    ├─ DebugLogger → Always receives for logging
    ├─ MainWindow.appendLog() → Blue terminal for user output
    ├─ handleWindowCommand() → Window creation/updates
    │       ↓
    │   [Creation] → MainWindow creates window
    │   [Update] → WindowRouter routes by name
    └─ WindowRouter → Routes to specific window instances
            ↓
        Specific window receives data
```

## Interspersed Traffic Model

The P2 sends **interspersed traffic** - debug protocol messages mixed with user program output.

- **Debug Protocol:** Specific message shapes → Routed to debug windows
- **User Output:** Everything else → `TERMINAL_OUTPUT` → Blue window
- **No "Incomplete":** All unrecognized data is valid user output

**Examples:**
- User program `print("Hello")` → `TERMINAL_OUTPUT` → Blue window
- COG message "Cog1  STATUS OK" → `COG_MESSAGE` → DebugLogger + COG1 window
- Unknown backtick `` `UNKNOWN ...`` → `TERMINAL_OUTPUT` → Blue window
- Binary debugger packet → `DEBUGGER_416BYTE` → DebugLogger + Debugger window

## P2_SYSTEM_INIT Special Handling

**Critical:** `P2_SYSTEM_INIT` ("Cog0 INIT $0000_0000 $0000_0000 load") triggers golden synchronization:

1. **Routes as COG0 message:** Goes to DebugLogger + COG0 window with `[GOLDEN SYNC]` prefix
2. **Emits `p2SystemReboot` event:** Triggers complete system synchronization reset
3. **Synchronization actions performed:**
   - Clears sync buffers and parser state
   - Resets debugger parser via `serialProcessor.onDTRReset()`
   - Restarts Debug Logger session (new log file boundary)
   - Resets COG window tracking for fresh session
   - Preserves existing COG windows (user may want previous session data)

**Event flow:**
```
Worker detects P2_SYSTEM_INIT pattern
    ↓
MessageRouter detects SharedMessageType.P2_SYSTEM_INIT
    ↓
Emits 'p2SystemReboot' event
    ↓
SerialMessageProcessor forwards event
    ↓
MainWindow.handleP2SystemReboot() performs sync reset
```

## Key Design Decisions

1. **P2_SYSTEM_INIT dual behavior:** Routes as COG0 message for display + triggers golden sync for system reset

2. **COG messages always logged:** Even if COG windows don't exist, messages go to DebugLogger for visibility.

3. **Single WindowRouter:** All window name-to-instance mapping goes through one router for consistency.

4. **Terminal output duplicated:** `TERMINAL_OUTPUT` and `INVALID_COG` go to BOTH DebugLogger (for record) and MainWindow blue terminal (for visibility).

5. **INCOMPLETE_DEBUG removed:** Legacy type no longer needed - all EOL-terminated messages are either classified or treated as terminal output.

## Implementation Files

- **MessageRouter:** `src/classes/shared/messageRouter.ts`
- **WindowRouter:** `src/classes/shared/windowRouter.ts`
- **Message Types:** `src/classes/shared/sharedMessagePool.ts`
- **Worker Extraction:** `src/workers/extractionWorker.ts`
- **Main Window:** `src/classes/mainWindow.ts`

## Related Documentation

- `SERIAL-MESSAGE-PROCESSING-ARCHITECTURE.md` - Overall architecture
- `WORKER_THREAD_EXTRACTION_DESIGN.md` - Worker thread design
- `WORKER_STATUS.md` - Worker implementation status
