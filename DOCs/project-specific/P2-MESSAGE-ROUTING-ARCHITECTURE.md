# P2 Message Routing Architecture

## Overview
Complete architectural documentation for P2 debug message routing, synchronization, and window management in PNut-Term-TS.

## P2 Hardware Architecture

### Propeller 2 Multi-Processor System
The P2 contains **8 independent processors** called COGs (COG 0 through COG 7):
- **COG 0**: System/boot processor (always boots first)
- **COG 1-7**: Application processors (boot as needed)
- **Typical Usage**: Only 1-3 COGs active for most applications
- **Maximum Usage**: All 8 COGs can be active simultaneously
- **Each COG**: Independent processor with its own execution context

### Processor Boot Sequence
```
"Cog0 INIT ..." = Processor 0 has booted
"Cog1 INIT ..." = Processor 1 has booted  
"Cog2 INIT ..." = Processor 2 has booted
... up to COG 7
```

## Critical Message Types

### 1. P2 System Reboot Synchronization Message
```
"Cog0 INIT $0000_0000 $0000_0000 load"
```
- **Meaning**: Entire P2 system rebooted - processor 0 (system processor) has started
- **Usage**: Primary synchronization marker - clear all sync states and start fresh
- **Routing**: Debug Logger only (never creates windows)
- **Significance**: Golden sync point - everything after this is guaranteed ordered

### 2. Processor Boot Messages (INIT Messages)
```
"Cog0 INIT ..." - System processor 0 booted (boot/system functions)
"Cog1 INIT ..." - Application processor 1 booted
"Cog2 INIT ..." - Application processor 2 booted
... (COG 3-7 as needed)
```
- **Purpose**: Individual processor boot status
- **Routing**: Respective COG logger windows + Debug Logger
- **NEVER**: Create debugger windows
- **Order**: Text messages appear before corresponding debugger packets
- **Scaling**: Can see 1-8 processors depending on application

### 3. Debugger Window Creation
- **ONLY SOURCE**: 80-byte binary debugger packets
- **Valid COGs**: 1, 2, 3, 4, 5, 6, 7 (NEVER COG 0 for this test hardware)
- **Packet Format**: 20 x 32-bit little-endian values (80 bytes total)
- **COG ID Location**: First 32-bit word (bytes 0-3)

## Message Ordering Requirements

### Golden Rule: NEVER REORDER MESSAGES
Messages must be processed in exact receive order through single synchronous pipeline.

### Expected Test Pattern
```
1. Cog0: INIT/hello messages (system processor 0 boot status)
2. Cog1: INIT message (application processor 1 starting)  
3. Cog1: hello message (processor 1 ready)
4. [80-byte COG 1 debugger packet] → Creates COG 1 debugger window
5. Cog2: INIT message (application processor 2 starting)
6. Cog2: hello message (processor 2 ready)
7. [80-byte COG 2 debugger packet] → Creates COG 2 debugger window
8. (Future) Cog1: completed message (processor 1 task complete)
9. (Future) Cog2: completed message (processor 2 task complete)
```

### Scaling Behavior
- **Simple Applications**: May only see COG 0 + 1 active processor
- **Complex Applications**: Could see all 8 processors active
- **Debug Logger**: Will show messages from all active processors
- **COG Windows**: Created dynamically as processors start sending debug packets

### Success Metric
Debug Logger window shows perfect interleaved order with binary debugger packets appearing immediately after their corresponding text messages.

## Synchronization Architecture

### Two-Level Synchronization Strategy

#### Level 1: Stream Synchronization
- **Trigger**: "Cog0 INIT $0000_0000 $0000_0000 load" message
- **Effect**: Perfect synchronization - clear all sync states
- **Use Case**: Fresh starts, DTR resets

#### Level 2: Individual Window Synchronization  
- **Trigger**: 80-byte debugger packet validation
- **Effect**: Per-window synchronization
- **Use Case**: Midstream joins, long-running sessions

### DTR Reset Sequence
```
1. User clicks DTR button
2. Close current log file
3. Start new log file
4. Clear parser state (prepare for sync)
5. P2 hardware reboots
6. P2 sends "Cog0 INIT $0000_0000 $0000_0000 load"
7. Perfect synchronization achieved
```

## Window Types and Routing

### COG Logger Windows
- **Purpose**: Text message logging per COG
- **Created**: On demand when COG traffic appears
- **Receives**: INIT messages, hello messages, status messages
- **Route**: Text messages for specific COG ID

### COG Debugger Windows  
- **Purpose**: Binary debugging interface
- **Created**: ONLY by 80-byte debugger packets
- **Receives**: Debugger packets for stepping/breakpoints
- **Route**: Binary packets for specific COG ID

### Debug Logger Window
- **Purpose**: Master log of all activity
- **Created**: Auto-created on first message
- **Receives**: ALL messages (text + binary)
- **Auto-logging**: Starts log file immediately
- **Log Management**: DTR closes old log, starts new log

### Main Terminal Window
- **Purpose**: Direct P2 communication
- **Receives**: Only non-debug messages
- **Display**: Blue terminal area
- **Rule**: No debug messages should appear here

## Critical Implementation Rules

### Window Creation Rules
1. **INIT messages**: NEVER create windows (boot status only)
2. **80-byte packets**: ONLY source for debugger window creation
3. **COG 0 debugger**: NEVER created by test hardware
4. **Text parsing**: NEVER triggers debugger window creation

### Message Processing Rules  
1. **Single pipeline**: All messages through one synchronous path
2. **No reordering**: Maintain exact receive order
3. **Queue-based**: Each window processes messages in order
4. **No racing**: Eliminate async processing paths

### Synchronization Rules
1. **Stream sync**: Use P2 reboot message as golden reference
2. **Window sync**: Validate 80-byte packets individually  
3. **DTR reset**: Complete synchronization reset
4. **Midstream join**: Fall back to individual window sync

## Log Management

### Auto-Logging Behavior
- **Startup**: Immediately start log file
- **DTR Reset**: Close current log, start new log
- **File Naming**: Include timestamp and session info
- **LED Status**: Reflects actual logging state

### Log File Boundaries
- **Session Start**: Program startup or DTR reset
- **Session End**: DTR reset or program exit
- **Purpose**: One log file per test session

## Error Conditions

### Synchronization Loss Indicators
- Messages appearing out of order in Debug Logger
- COG 0 debugger windows (should never happen)
- Binary data appearing at wrong positions
- Duplicate messages

### Recovery Strategies
- DTR reset for user-initiated resync
- Individual window sync for partial recovery
- Stream validation for automatic detection

## Architecture Notes

### Why This Design
- **P2 Hardware Constraints**: Limited to specific message patterns
- **Real-time Requirements**: Must maintain message timing
- **Debug Clarity**: Clear separation of log vs debug data
- **User Experience**: Predictable synchronization via DTR

### Historical Context
This architecture evolved through multiple iterations of window routing attempts. The key insight was recognizing that P2 hardware provides its own synchronization signals that should be leveraged rather than fighting against.

---
*Document Version: 1.0*  
*Last Updated: 2025-08-20*  
*Critical for: Message routing, window management, synchronization*