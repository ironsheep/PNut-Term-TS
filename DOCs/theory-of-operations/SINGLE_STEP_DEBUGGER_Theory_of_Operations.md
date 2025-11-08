# Single-Step Debugger Window - Theory of Operations

**Current as of**: PNut v51a for Propeller 2

## Document Purpose

This document provides a comprehensive theory of operations for the PNut Single-Step Debugger window. Unlike the other debug display windows (PLOT, SCOPE, FFT, LOGIC, etc.) which are unidirectional viewers, the Single-Step Debugger is a **bidirectional interactive debugging system** with components running on both the PC and the Propeller 2 (P2) chip.

**Key Source Files:**
- **PC-side**: `DebuggerUnit.pas` (114,751 bytes, 2,500+ lines)
- **P2-side**: `Spin2_debugger.spin2` (32,643 bytes, 1,262 lines)

**Primary Methods:**
- **PC-side**: `TFormDebugger.Breakpoint()` - Core debugging loop
- **P2-side**: `debugger` entry point at hub $FF1A0, Debug ISR at ROM $1F8

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [P2-Side Memory Map](#3-p2-side-memory-map)
4. [Debug ISR Entry Flow](#4-debug-isr-entry-flow)
5. [Debugger Entry Point](#5-debugger-entry-point)
6. [Overlay System](#6-overlay-system)
7. [PC↔P2 Communication Protocol](#7-pcp2-communication-protocol)
8. [Debugger Message Structure](#8-debugger-message-structure)
9. [BRK Condition System](#9-brk-condition-system)
10. [CRC and Checksum Protocol](#10-crc-and-checksum-protocol)
11. [Screen Layout Overview](#11-screen-layout-overview)
12. [Register Map Regions](#12-register-map-regions)
13. [LUT Map Regions](#13-lut-map-regions)
14. [Hub Map Regions](#14-hub-map-regions)
15. [Disassembly Display](#15-disassembly-display)
16. [Watch List Regions](#16-watch-list-regions)
17. [Smart Pin Monitoring](#17-smart-pin-monitoring)
18. [Status and Info Displays](#18-status-and-info-displays)
19. [Keyboard Commands](#19-keyboard-commands)
20. [Mouse Interactions](#20-mouse-interactions)
21. [Breakpoint Handling](#21-breakpoint-handling)
22. [Register and Memory Inspection](#22-register-and-memory-inspection)
23. [COGBRK Inter-Cog Debugging](#23-cogbrk-inter-cog-debugging)
24. [Display Rendering System](#24-display-rendering-system)
25. [Usage Examples](#25-usage-examples)
26. [Summary](#26-summary)

---

## 1. Introduction

The Single-Step Debugger is the most sophisticated component of the PNut development environment. It provides real-time interactive debugging of Spin2 code running on the Propeller 2 microcontroller.

**Unique Characteristics:**
- **Bidirectional**: Both PC and P2 actively participate in the debugging session
- **Interactive**: User can single-step, set breakpoints, inspect memory, and control execution
- **Multi-Cog**: Supports debugging all 8 cogs simultaneously with inter-cog COGBRK functionality
- **Memory Efficient**: Uses overlay system to minimize P2 memory footprint
- **Real-Time**: Provides live heatmaps showing register and memory changes

**Debugging Workflow:**
1. User compiles Spin2 code with DEBUG statements
2. Code runs on P2 until it hits a breakpoint or DEBUG statement
3. P2 enters Debug ISR at ROM $1F8, loads debugger code at hub $FF1A0
4. P2 sends state information to PC via serial protocol
5. PC displays current state in debugger window
6. User examines registers, memory, disassembly, watches
7. User issues command (step, go, break type change)
8. P2 receives command and continues execution
9. Process repeats

---

## 2. Architecture Overview

### 2.1 Two-Component System

The debugger consists of two tightly coupled components:

**PC-Side (DebuggerUnit.pas)**
- Receives debugging data from P2
- Renders comprehensive debugging display
- Handles user input (keyboard and mouse)
- Sends debugging commands back to P2
- Manages display state and heatmaps

**P2-Side (Spin2_debugger.spin2)**
- Loaded into protected hub RAM ($FF1A0..$FFFFF)
- Activated via Debug ISR at ROM $1F8
- Captures cog state (registers, LUT, flags)
- Transmits state to PC via serial protocol
- Receives and executes PC commands
- Returns to user code execution

### 2.2 Communication Flow

```
User Code (P2) → DEBUG/Breakpoint → Debug ISR ($1F8)
    ↓
Load Debugger ($FF1A0) → Capture Cog State
    ↓
Transmit Data to PC (serial) → DebuggerUnit.pas
    ↓
Display State → User Interaction
    ↓
Send Command (PC → P2) → Execute Command
    ↓
Return to User Code or Next Breakpoint
```

### 2.3 Key Design Principles

**Memory Protection**: Hub RAM $FC000..$FFFFF is protected and reserved for debugging infrastructure

**Overlay Optimization**: Two overlays share same memory space:
- Message Handler (for DEBUG output)
- Breakpoint Handler (for state capture/transmission)

**Non-Invasive**: Debugger preserves all user state except $000..$00F (saved/restored)

**Efficient Change Detection**: Uses CRC-16 for cog/LUT, 16-bit checksums for hub RAM to detect changes without sending all data

---

## 3. P2-Side Memory Map

The P2-side debugger uses protected hub RAM from $FC000 to $FFFFF (16KB).

### 3.1 Memory Layout

```
$FC000 - $FE9FF : DEBUG data storage (10.5KB)
$FEA00 - $FF19F : Cog register buffers ($010..$1F7 for each cog)
$FF1A0 - $FFBFF : Debugger code + two overlays
$FFC00 - $FFC3F : Cog 0 ISR buffer (64 bytes)
$FFC40 - $FFC7F : Cog 1 ISR buffer (64 bytes)
$FFC80 - $FFCBF : Cog 2 ISR buffer (64 bytes)
$FFCC0 - $FFCFF : Cog 3 ISR buffer (64 bytes)
$FFD00 - $FFD3F : Cog 4 ISR buffer (64 bytes)
$FFD40 - $FFD7F : Cog 5 ISR buffer (64 bytes)
$FFD80 - $FFDBF : Cog 6 ISR buffer (64 bytes)
$FFDC0 - $FFDFF : Cog 7 ISR buffer (64 bytes)
$FFE00 - $FFFFF : Reserved/unused
```

### 3.2 Debugger Code Section ($FF1A0..$FFBFF)

The debugger code is organized as:
- **Base debugger**: Entry point, state save/restore, protocol handler
- **Overlay 1**: Message handler for DEBUG bytecode execution
- **Overlay 2**: Breakpoint handler for state transmission

Overlays occupy the same memory space and are swapped in as needed.

### 3.3 ISR Buffers ($FFC00..$FFDFF)

Each cog has a 64-byte ISR buffer that stores:
- Registers $000..$00F (16 longs = 64 bytes)

These are saved when entering Debug ISR and restored when exiting.

---

## 4. Debug ISR Entry Flow

The Debug ISR is the entry point for all debugging activity on the P2. It resides in ROM at address $1F8.

### 4.1 Debug ISR Location

**ROM Address**: `$000001F8` (Debug ISR vector)

**Activation Triggers**:
- `DEBUG()` statement in Spin2 code
- Breakpoint condition met (BRK register)
- `COGBRK` instruction from another cog

### 4.2 Entry Sequence (Spin2_debugger.spin2:191-214)

```spin2
org
debug_isr
        ' Save $000..$00F to cog's ISR buffer in hub
        setq    #$10-1
        wrlong  $000, isr_addr

        ' Load debugger code from hub $FF1A0 into cog $000..$1FF
        setq2   #$200-1
        rdlong  $000, debug_addr

        ' Jump to debugger entry point
        jmp     #$000
```

**Steps**:
1. Save registers $000..$00F to hub ISR buffer ($FFC00 + cogid*$40)
2. Load debugger code ($FF1A0..$FF9FF) into cog registers $000..$1FF
3. Jump to debugger entry point at cog $000

### 4.3 ISR Buffer Calculation

```
ISR_Buffer_Address = $FFC00 + (COGID * $40)
```

Example for cog 3:
```
$FFC00 + (3 * $40) = $FFC00 + $C0 = $FFCC0
```

---

## 5. Debugger Entry Point

Once loaded into cog memory, the debugger determines why it was invoked and takes appropriate action.

### 5.1 Entry Analysis (Spin2_debugger.spin2:305-386)

**Invocation Sources**:
1. **COGINIT** - Cog just started, perform initialization
2. **COGBRK** - Another cog requested breakpoint
3. **DEBUG** - DEBUG() statement executed
4. **Breakpoint** - BRK condition satisfied

### 5.2 Entry Decision Tree

```
Check if COGINIT (first entry) →  Initialize, set BRK=INIT, return
    ↓
Check if COGBRK → Process inter-cog break request
    ↓
Check if DEBUG message → Call message_handler overlay
    ↓
Otherwise → Breakpoint hit, call breakpoint_handler overlay
```

### 5.3 Initialization Mode

On first entry (COGINIT), the debugger:
- Sets BRK condition to "INIT" (break on initialization)
- Optionally processes any pending DEBUG messages
- Returns to user code to begin execution

---

## 6. Overlay System

To minimize memory footprint, the debugger uses two mutually exclusive overlays that share the same cog memory space.

### 6.1 Overlay Architecture

**Shared Memory Region**: Cog $100..$1FF (256 longs)

**Overlay 1: Message Handler** (Spin2_debugger.spin2:526-996)
- Purpose: Process DEBUG() bytecode and format output
- Size: ~470 lines of PASM code
- Handles: Text output, number formatting, array dumps, timing

**Overlay 2: Breakpoint Handler** (Spin2_debugger.spin2:1005-1143)
- Purpose: Communicate with PC during breakpoint
- Size: ~138 lines of PASM code
- Handles: State transmission, command reception, memory requests

### 6.2 Overlay Loading

Overlays are loaded on-demand from hub RAM into cog memory:

```spin2
' Load message handler overlay
setq2   #message_handler_size-1
rdlong  $100, ##@message_handler

' Load breakpoint handler overlay
setq2   #breakpoint_handler_size-1
rdlong  $100, ##@breakpoint_handler
```

### 6.3 Why Overlays?

**Memory Constraint**: Cog has only 512 longs ($000..$1FF)
**Debugger Requirements**:
- Base debugger: ~200 longs
- Message handler: ~256 longs
- Breakpoint handler: ~256 longs
- Total if not overlaid: ~712 longs (exceeds 512!)

**Solution**: Message handler and breakpoint handler never need to run simultaneously, so they share memory space.

---

## 7. PC↔P2 Communication Protocol

The PC and P2 communicate via a structured serial protocol during each breakpoint.

### 7.1 Protocol Overview

**Direction**: Bidirectional
**Transport**: Serial UART (typically USB-Serial)
**Structure**: Fixed message formats with defined fields

### 7.2 Transmission Sequence

**Phase 1: P2 → PC (Initial State)**
```
1. Debugger message (20 longs) - registers, flags, stack, condition
2. BRK condition value (1 long)
3. CRC words (64 words) - cog/LUT change detection
4. Hub checksums (124 words) - hub RAM change detection
```

**Phase 2: PC → P2 (Requests)**
```
1. Register block requests (if CRCs show changes)
2. LUT block requests (if CRCs show changes)
3. Hub read requests (if checksums show changes)
4. COGBRK commands (if debugging other cogs)
5. BRK command (continue execution with new break condition)
```

**Phase 3: P2 → PC (Requested Data)**
```
1. Register blocks (32 longs each)
2. LUT blocks (32 longs each)
3. Hub data (variable length)
4. Smart pin data (RQPIN results)
```

### 7.3 Protocol Efficiency

The protocol minimizes data transfer by:
- Using CRC-16 to detect cog/LUT changes (64 words vs 512 longs)
- Using 16-bit checksums for hub RAM (124 words vs 496KB)
- Only requesting blocks that have changed
- Compressing state information into 20-long message

---

## 8. Debugger Message Structure

The debugger message is a 20-long structure that encapsulates the current cog state.

### 8.1 Message Long Definitions (DebuggerUnit.pas:9-49)

```pascal
const
  mCOGN = 0;   // Cog number (0-7)
  mBRKCZ = 1;  // BRK condition and C/Z flags
  mBRKC = 2;   // BRK C flag value
  mBRKZ = 3;   // BRK Z flag value
  mCTH2 = 4;   // CT register high word
  mCTL2 = 5;   // CT register low word
  mSTK0 = 6;   // Stack level 0
  mSTK1 = 7;   // Stack level 1
  mSTK2 = 8;   // Stack level 2
  mSTK3 = 9;   // Stack level 3
  mPC = 10;    // Program counter
  mCALL = 11;  // Call depth
  mBASE = 12;  // Base pointer
  mOBJT = 13;  // Object table pointer
  mDCOG = 14;  // Debug cog pointer
  mDTEX = 15;  // Debug text pointer
  mVASE = 16;  // Variable base pointer
  mSTOP = 17;  // Stop address
  mBRKA = 18;  // Break address
  mCOND = 19;  // Condition code
```

### 8.2 Message Field Descriptions

**mCOGN** (long 0): Cog number that hit breakpoint (0-7)

**mBRKCZ** (long 1): Combined BRK condition and flags
- Bits 0-1: Current C and Z flag values
- Bits 2-31: BRK condition type

**mBRKC/mBRKZ** (longs 2-3): Explicit C and Z flag values for BRK evaluation

**mCTH2/mCTL2** (longs 4-5): 64-bit CT (cycle counter) value

**mSTK0..mSTK3** (longs 6-9): Hardware call stack (4 levels deep)

**mPC** (long 10): Current program counter (cog or hub address)

**mCALL** (long 11): Current call depth

**mBASE** (long 12): Base pointer for local variables

**mOBJT** (long 13): Object table pointer

**mDCOG/mDTEX** (longs 14-15): Debug data pointers

**mVASE** (long 16): Variable base pointer

**mSTOP** (long 17): Stop address (for range breakpoints)

**mBRKA** (long 18): Break address (where breakpoint occurred)

**mCOND** (long 19): Condition code (reason for break)

---

## 9. BRK Condition System

The BRK register controls when the debugger activates. It supports multiple break types.

### 9.1 BRK Condition Types (DebuggerUnit.pas:51-77)

```pascal
const
  bcNONE  = 0;   // No breaking
  bcMAIN  = 1;   // Break on MAIN entry
  bcINT1  = 2;   // Break on INT1 entry
  bcINT2  = 3;   // Break on INT2 entry
  bcINT3  = 4;   // Break on INT3 entry
  bcDEBUG = 5;   // Break on DEBUG statements
  bcINIT  = 6;   // Break on cog initialization
  bcEVENT = 7;   // Break on events
  bcADDR  = 8;   // Break on address match
```

### 9.2 Break Type Descriptions

**bcNONE**: Debugger disabled, run freely

**bcMAIN**: Break when entering MAIN code block

**bcINT1/2/3**: Break when entering interrupt service routines

**bcDEBUG**: Break on every DEBUG() statement (default interactive mode)

**bcINIT**: Break immediately on cog initialization

**bcEVENT**: Break on specific hardware events

**bcADDR**: Break when PC matches specific address

### 9.3 BRK Register Encoding

The BRK register is set via the `BRK #condition` PASM instruction or by the PC sending a BRK command:

```
BRK Register = (break_type << 2) | (C_flag << 1) | Z_flag
```

Example: Break on DEBUG with C=1, Z=0:
```
BRK = (bcDEBUG << 2) | (1 << 1) | 0 = (5 << 2) | 2 = 20 + 2 = 22
```

### 9.4 User Control of BRK Type

The user can change break type via keyboard:
- **B** key: Set BRK = bcNONE (run freely, break on next explicit breakpoint)
- **I** key: Set BRK = bcINIT (break on initialization)
- **D** key: Set BRK = bcDEBUG (break on DEBUG statements)
- **M** key: Set BRK = bcMAIN (break on MAIN entry)

---

## 10. CRC and Checksum Protocol

To efficiently detect changes without transferring all memory, the debugger uses CRC and checksum techniques.

### 10.1 Cog/LUT CRC System

**Coverage**: Cog registers $000..$1FF (512 longs) divided into 64 blocks of 8 longs each

**Algorithm**: CRC-16 calculated over each 8-long (32-byte) block

**Transmission**: 64 CRC words (one per block) sent P2 → PC

**Detection**: PC compares received CRCs with previous values to identify changed blocks

**Request**: PC requests only changed blocks (32 bytes each)

### 10.2 Hub RAM Checksum System

**Coverage**: Hub RAM $00000..$7FFFF (512KB) divided into 124 blocks of 4KB each

**Algorithm**: 16-bit additive checksum over each 4KB block

**Transmission**: 124 checksum words sent P2 → PC

**Detection**: PC compares with previous checksums to identify changed 4KB regions

**Sub-Blocks**: Each 4KB block is further divided into 16 sub-blocks of 256 bytes

**Request**: PC requests specific 256-byte sub-blocks within changed 4KB blocks

### 10.3 Block Organization

**Cog/LUT Blocks** (DebuggerUnit.pas:79-80):
```pascal
const
  CogBlocks = 64;  // 512 longs / 8 longs per block = 64 blocks
```

**Hub Blocks** (DebuggerUnit.pas:82-83):
```pascal
const
  HubBlocks = 124;      // 512KB / 4KB per block = 124 blocks
  HubSubBlocks = 1984;  // 124 blocks * 16 sub-blocks = 1984 sub-blocks
```

### 10.4 Change Detection Example

**Scenario**: User code modifies register $050

**Process**:
1. Register $050 is in block 10 (blocks are 0-indexed, 8 longs each)
2. P2 calculates CRC for block 10 ($050..$057)
3. P2 sends 64 CRC words to PC
4. PC detects CRC mismatch for block 10
5. PC requests block 10 data
6. P2 sends 8 longs ($050..$057)
7. PC updates display and heatmap

---

## 11. Screen Layout Overview

The debugger window is divided into approximately 25 distinct regions, each displaying different aspects of the P2 state.

### 11.1 Main Region Categories

**Register Displays**:
- COG register map (16x16 grid)
- LUT register map (16x16 grid)
- Register delta watch list
- LUT delta watch list

**Memory Displays**:
- HUB memory map (heatmap)
- HUB memory hex dump (scrollable)

**Code Displays**:
- Disassembly (3 modes: PC, Cog, Hub)

**Status Displays**:
- Cog info (number, PC, CT, flags)
- Stack display (4 levels)
- BRK condition
- Call depth
- Base/Object pointers

**Interactive Controls**:
- Breakpoint buttons
- Mode selectors
- Scrollbars

### 11.2 Screen Region Constants (DebuggerUnit.pas:114-149)

```pascal
const
  rrNone = 0;
  rrRegMapAll = 1;
  rrRegMapReg = 2;
  rrRegMapLut = 3;
  rrRegInfo = 4;
  rrRegDelta = 5;
  rrLutMapAll = 6;
  rrLutMapLut = 7;
  rrLutInfo = 8;
  rrLutDelta = 9;
  rrHubMapAll = 10;
  rrHubMapHub = 11;
  rrHubInfo = 12;
  rrDisasmAll = 13;
  rrDisasmData = 14;
  rrDisasmMode = 15;
  rrStkInfo = 16;
  rrBrkInfo = 17;
  rrBrkButtons = 18;
  rrSmartAll = 19;
  rrSmartData = 20;
  // ... and more
```

Each region has specific mouse interaction behavior and display rendering logic.

---

## 12. Register Map Regions

The COG register map displays all 256 cog registers ($000..$0FF) as a 16×16 heatmap.

### 12.1 Register Map Display (rrRegMapAll, rrRegMapReg)

**Layout**: 16 rows × 16 columns grid

**Address Mapping**:
- Row 0: $000..$00F
- Row 1: $010..$01F
- ...
- Row 15: $0F0..$0FF

**Color Coding** (Heatmap):
- Blue → White: Recently changed (hot)
- Dark Blue: Unchanged (cold)
- Intensity fades over time

**Mouse Interaction**:
- Hover: Shows register address and current value
- Click: Selects register, adds to delta watch list

### 12.2 Register Info Display (rrRegInfo)

Shows detailed information about selected register:
- Address (hex)
- Current value (hex and decimal)
- Previous value (if changed)
- Special register names (PA, PB, PTRA, PTRB, etc.)

### 12.3 Register Delta Watch List (rrRegDelta)

Displays registers that have changed since last breakpoint:

**Format**:
```
$050: $12345678 → $12345ABC  (+132)
$051: $00000000 → $00000001  (+1)
$1F5: $FFFFFFFF → $00000000  (-1)
```

**Automatic Population**: Any register that changes between breakpoints is automatically added

**Manual Reset**: Press **R** key to clear watch list

---

## 13. LUT Map Regions

The LUT map displays all 256 LUT RAM locations ($100..$1FF) with the same visualization as registers.

### 13.1 LUT Map Display (rrLutMapAll, rrLutMapLut)

**Layout**: 16 rows × 16 columns grid

**Address Mapping**:
- Row 0: $100..$10F
- Row 1: $110..$11F
- ...
- Row 15: $1F0..$1FF

**Color Coding**: Same heatmap system as register map

**Special Consideration**: LUT is often used for:
- Lookup tables
- Code execution (cog exec mode)
- Data buffers
- FIFO queues

### 13.2 LUT Info Display (rrLutInfo)

Shows information about selected LUT location:
- Address (hex)
- Current value (hex and decimal)
- Disassembly (if contains PASM code)

### 13.3 LUT Delta Watch List (rrLutDelta)

Same format as register delta, but for LUT locations:
```
$150: $AABBCCDD → $AABBCCEE  (+17)
$1A0: $00000000 → $FF1A0000  (large change)
```

---

## 14. Hub Map Regions

The HUB memory map provides visualization and hex dump of all 512KB of hub RAM.

### 14.1 Hub Heatmap (rrHubMapAll, rrHubMapHub)

**Coverage**: $00000..$7FFFF (512KB)

**Visualization**: Scrollable heatmap showing memory activity

**Granularity**: 256-byte blocks (1984 total sub-blocks)

**Color Coding**:
- Red/Yellow: Recently written (hot)
- Blue/Cyan: Recently read (warm)
- Dark: No activity (cold)

**Mouse Interaction**:
- Hover: Shows address range
- Click: Jumps hex dump to that location

### 14.2 Hub Hex Dump Display

**Format**: Traditional hex dump with ASCII sidebar
```
00000: 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F  ................
00010: 10 11 12 13 14 15 16 17 18 19 1A 1B 1C 1D 1E 1F  ................
...
```

**Address Display**: Shows current offset in hub RAM

**Scrolling**:
- UP/DOWN arrows: Scroll 16 bytes per keypress
- PAGEUP/PAGEDOWN: Scroll 256 bytes per keypress
- Mouse wheel: Smooth scrolling
- Click heatmap: Jump to address

### 14.3 Hub Info Display (rrHubInfo)

Shows information about current hub address:
- Address (hex)
- Value at address (byte, word, long)
- ASCII representation
- Nearby symbol/label (if available)

---

## 15. Disassembly Display

The disassembly display shows PASM or Spin2 bytecode, depending on current execution context.

### 15.1 Disassembly Modes (rrDisasmMode)

**Three Display Modes**:

**dmPC (Mode 0)**: Follow Program Counter
- Always shows code at current PC
- Auto-scrolls as code executes
- Default mode for single-stepping

**dmCog (Mode 1)**: Cog Memory View
- Shows disassembly of cog RAM ($000..$1FF)
- Useful for examining cog-exec code
- User can scroll manually

**dmHub (Mode 2)**: Hub Memory View
- Shows disassembly of hub RAM
- Useful for examining hub-exec code
- User can scroll to any hub address

### 15.2 Disassembly Format (rrDisasmData)

**PASM Disassembly**:
```
000: F608C240            mov     PA, #$40
004: F608C641            mov     PB, #$41
008: FD640001            add     PA, #1
00C: A0FC0000            jmp     #$000
```

**Components**:
- Address (cog or hub)
- Opcode (hex, 32-bit)
- Mnemonic (ADD, MOV, JMP, etc.)
- Operands (registers, immediates, addresses)

**Spin2 Bytecode**:
```
100A0: 36                push #6
100A1: 02 40 00          call @method_offset
100A4: 33                return
```

**Current PC Indicator**: Line containing PC is highlighted or marked with "→"

### 15.3 Disassembly Navigation

**Keyboard**:
- UP/DOWN: Scroll disassembly
- PAGEUP/PAGEDOWN: Page through code

**Mouse**:
- Click: Set disassembly address
- Wheel: Scroll disassembly
- Click mode button: Toggle dmPC/dmCog/dmHub

---

## 16. Watch List Regions

Watch lists provide automatic tracking of value changes across breakpoints.

### 16.1 Register Delta Watch (rrRegDelta)

**Purpose**: Track register value changes

**Display Format**:
```
Register Changes:
$1F0 (PA):   $00000040 → $00000041  (+1)
$1F1 (PB):   $00000000 → $DEADBEEF  (large)
$1F8 (PTRA): $00010000 → $00010004  (+4)
```

**Features**:
- Shows old value → new value
- Calculates signed delta
- Highlights special registers (PA, PB, PTRA, PTRB, etc.)
- Persists across breakpoints until reset

**Reset**: Press **R** key to clear all watches

### 16.2 LUT Delta Watch (rrLutDelta)

Same functionality as register watch, but for LUT RAM:
```
LUT Changes:
$150: $00000000 → $12345678
$1A0: $FFFFFFFF → $00000000  (-1)
```

### 16.3 Hub Change Tracking

Hub memory changes are tracked via the checksum system and displayed in the hub heatmap with color intensity indicating recency of change.

---

## 17. Smart Pin Monitoring

The debugger can query smart pin states using the RQPIN instruction.

### 17.1 Smart Pin Display (rrSmartAll, rrSmartData)

**Display Information**:
- Pin number (P0-P63)
- Pin mode (configured function)
- Current measurement/count value
- Pin status flags

**Data Retrieval**: PC sends RQPIN request for selected pins during breakpoint handling

**Example Display**:
```
Smart Pins:
P16: PWM mode, duty=50%, period=1000 cycles
P32: ADC mode, value=$7FF (2047/4095)
P48: Counter mode, count=12,500
```

### 17.2 Smart Pin Requests

The PC can request smart pin data for any or all 64 pins. The P2 executes `RQPIN` instructions and returns the results.

---

## 18. Status and Info Displays

Various status regions show execution context and state information.

### 18.1 Cog Status (rrRegInfo)

**Displays**:
- Cog number (0-7)
- Current PC (program counter)
- CT value (cycle counter, 64-bit)
- C and Z flags
- COG/HUB execution mode

**Example**:
```
COG 3
PC: $00A4 (cog)
CT: $0000_1234_5678_9ABC
C=1 Z=0
Mode: Cog Exec
```

### 18.2 Stack Display (rrStkInfo)

Shows hardware call stack (4 levels):

**Format**:
```
Stack:
0: $00120
1: $00A40
2: $10A00
3: $00000 (empty)
```

**Note**: P2 hardware stack is only 4 levels deep. Spin2 uses software stack for deeper calls.

### 18.3 BRK Condition Display (rrBrkInfo)

Shows current breakpoint condition:

**Format**:
```
BRK: DEBUG (break on DEBUG statements)
Address: $00A40
```

**Possible Values**:
- NONE (run freely)
- MAIN (break on main entry)
- INT1/2/3 (break on interrupts)
- DEBUG (break on DEBUG statements)
- INIT (break on initialization)
- EVENT (break on events)
- ADDR (break on address match)

### 18.4 Pointer Display

Shows important pointers:
```
BASE: $10000  (local variable base)
OBJT: $12000  (object table)
VASE: $11000  (variable base)
DCOG: $FC000  (debug cog data)
```

---

## 19. Keyboard Commands

The debugger supports comprehensive keyboard control for all debugging operations.

### 19.1 Execution Control (DebuggerUnit.pas:1012-1089)

**SPACE**: Single-step (Go once)
- Sends BRK command with current break condition
- Executes one instruction/statement
- Returns to debugger on next break

**ENTER**: Go (continuous execution)
- Sends BRK command
- P2 runs until next breakpoint condition
- Useful for "run until next DEBUG()"

**ESC**: Abort/Close debugger window

### 19.2 Break Condition Control

**B**: Set BRK = NONE
- Disables automatic breaking
- Code runs freely until explicit breakpoint

**I**: Set BRK = INIT
- Breaks on cog initialization
- Useful for catching cog startup

**D**: Set BRK = DEBUG
- Breaks on every DEBUG() statement
- Default interactive debugging mode
- Most common mode for step-through debugging

**M**: Set BRK = MAIN
- Breaks when entering MAIN code block
- Useful for skipping initialization

### 19.3 Display Navigation

**UP/DOWN Arrow**: Scroll hub hex dump
- Moves 16 bytes per press
- Updates address display

**PAGEUP/PAGEDOWN**: Page scroll hub hex dump
- Moves 256 bytes per press
- Fast navigation through memory

**LEFT/RIGHT Arrow**: (Reserved for future use)

### 19.4 Watch List Control

**R**: Reset watch lists
- Clears register delta watch
- Clears LUT delta watch
- Useful after analyzing changes

### 19.5 Keyboard Summary Table

| Key | Action | Effect |
|-----|--------|--------|
| SPACE | Single Step | Execute one step, return to debugger |
| ENTER | Go | Run until next breakpoint |
| ESC | Close | Close debugger window |
| B | Break=NONE | Run freely |
| I | Break=INIT | Break on initialization |
| D | Break=DEBUG | Break on DEBUG statements |
| M | Break=MAIN | Break on MAIN entry |
| R | Reset Watches | Clear delta watch lists |
| ↑/↓ | Scroll | Scroll hub hex dump (16 bytes) |
| PgUp/PgDn | Page | Page hub hex dump (256 bytes) |

---

## 20. Mouse Interactions

The debugger provides comprehensive mouse interaction for all screen regions.

### 20.1 Mouse Handling Architecture (DebuggerUnit.pas:632-970)

**Hit Testing**: Every mouse move/click is tested against all screen regions using `GetRegion()` function

**Hover Behavior**: Each region displays context-sensitive hints showing:
- Current value under cursor
- Address information
- Interpretation (hex, decimal, ASCII)

**Click Behavior**: Region-specific actions on mouse click

### 20.2 Register Map Mouse Interaction

**Hover** (rrRegMapReg):
```
Hint: "$050 = $12345678 (305,419,896)"
```
Shows register address, hex value, and decimal value

**Click** (rrRegMapReg):
- Selects register
- Adds to watch list
- Highlights in display
- Shows detailed info in rrRegInfo panel

**Visual Feedback**: Selected register highlighted with border

### 20.3 LUT Map Mouse Interaction

**Hover** (rrLutMapLut):
```
Hint: "$150 = $AABBCCDD"
```

**Click** (rrLutMapLut):
- Selects LUT location
- Shows info in rrLutInfo panel
- Attempts disassembly if contains code

### 20.4 Hub Map Mouse Interaction

**Hover** (rrHubMapHub):
```
Hint: "$10000..$100FF (4KB block)"
```
Shows address range of heatmap block

**Click** (rrHubMapHub):
- Jumps hex dump to clicked address
- Centers display on selected block
- Updates hub info panel

**Scroll Wheel** (rrHubMapHub):
- Scrolls through hub memory
- Updates heatmap position
- Smooth scrolling experience

### 20.5 Disassembly Mouse Interaction

**Hover** (rrDisasmData):
```
Hint: "$00A4: ADD PA, #1"
```
Shows address and disassembled instruction

**Click** (rrDisasmData):
- Sets disassembly focus address
- Useful in dmCog or dmHub modes
- In dmPC mode, address updates on next step

**Mode Button Click** (rrDisasmMode):
- Cycles through dmPC → dmCog → dmHub
- Updates display immediately
- Mode persists across breakpoints

### 20.6 Breakpoint Button Mouse Interaction

**BRK Buttons** (rrBrkButtons):
- Click "NONE": Set BRK = bcNONE (run freely)
- Click "INIT": Set BRK = bcINIT (break on init)
- Click "DEBUG": Set BRK = bcDEBUG (break on DEBUG)
- Click "MAIN": Set BRK = bcMAIN (break on MAIN)

**Visual State**: Currently active break condition is highlighted

### 20.7 Smart Pin Mouse Interaction

**Hover** (rrSmartData):
```
Hint: "P32: ADC value = 2047"
```

**Click** (rrSmartData):
- Selects pin for detailed view
- May request additional RQPIN data

### 20.8 Mouse Interaction Summary

| Region | Hover | Click | Scroll |
|--------|-------|-------|--------|
| Register Map | Show address/value | Select register | - |
| LUT Map | Show address/value | Select LUT location | - |
| Hub Heatmap | Show address range | Jump to address | Navigate memory |
| Hex Dump | Show interpretation | - | Scroll bytes |
| Disassembly | Show instruction | Set focus | Scroll code |
| BRK Buttons | Show description | Set break mode | - |
| Smart Pins | Show pin state | Select pin | - |
| Watch Lists | Show details | - | Scroll list |

---

## 21. Breakpoint Handling

The core debugging loop is implemented in `TFormDebugger.Breakpoint()` method.

### 21.1 Breakpoint Method Flow (DebuggerUnit.pas:1161-1937)

**Entry**: Called when P2 hits a breakpoint and is ready to communicate

**Phase 1: Receive Initial State**
```pascal
1. Read debugger message (20 longs) → mCOGN..mCOND
2. Read BRK condition value
3. Read CRC words (64 words for cog/LUT)
4. Read hub checksums (124 words)
```

**Phase 2: Analyze Changes**
```pascal
5. Compare CRC words with previous → identify changed cog/LUT blocks
6. Compare checksums with previous → identify changed hub blocks
7. Build request list for changed data
```

**Phase 3: Request Changed Data**
```pascal
8. Send register block requests (for each changed CRC)
9. Send LUT block requests (for each changed CRC)
10. Send hub read requests (for each changed checksum)
11. Send COGBRK commands (if debugging other cogs)
```

**Phase 4: Receive Requested Data**
```pascal
12. Read register blocks (32 bytes each)
13. Read LUT blocks (32 bytes each)
14. Read hub data (256 bytes per sub-block)
15. Read smart pin data (if requested)
```

**Phase 5: Update Display**
```pascal
16. Update all heatmaps (register, LUT, hub)
17. Update delta watch lists
18. Update disassembly display
19. Update status displays
20. Render to screen
```

**Phase 6: Wait for User Input**
```pascal
21. Process keyboard/mouse events
22. User presses SPACE/ENTER/B/I/D/M
23. Determine new BRK condition
```

**Phase 7: Send Continue Command**
```pascal
24. Send BRK command with new condition
25. P2 resumes execution
26. Exit Breakpoint() method
27. Return to main event loop
```

### 21.2 Breakpoint Loop Example

**Scenario**: User single-steps through code that modifies PA register

**Sequence**:
1. P2 at breakpoint, PC=$00A4
2. PC receives: mPC=$00A4, CRC[31]=old_value (PA is in block 31)
3. User presses SPACE (single step)
4. PC sends: BRK=bcDEBUG
5. P2 executes one instruction: `ADD PA, #1`
6. P2 hits next breakpoint, PC=$00A8
7. PC receives: mPC=$00A8, CRC[31]=new_value (PA changed!)
8. PC requests: block 31 data (registers $1F0..$1F7)
9. P2 sends: 8 longs including new PA value
10. PC updates: Register map (PA cell turns hot), delta watch shows change
11. User sees PA change highlighted in real-time

---

## 22. Register and Memory Inspection

The debugger provides comprehensive tools for examining all aspects of P2 state.

### 22.1 Register Inspection Features

**Direct View**: 16×16 grid shows all 256 registers at once

**Heat Mapping**: Color intensity shows recency of changes
- White/bright: Just changed
- Blue/medium: Changed recently
- Dark blue: Unchanged

**Delta Tracking**: Automatic watch list of changed registers

**Special Registers**: Named registers highlighted (PA, PB, PTRA, PTRB, DIRA, DIRB, OUTA, OUTB, INA, INB)

**Click-to-Inspect**: Click any register for detailed view

### 22.2 LUT Inspection Features

Identical to register inspection, but for LUT RAM ($100..$1FF):
- 16×16 grid visualization
- Heat mapping
- Delta tracking
- Disassembly interpretation (if contains code)

### 22.3 Hub Memory Inspection Features

**Dual View System**:
1. **Heatmap**: High-level overview of all 512KB
2. **Hex Dump**: Detailed byte-by-byte view

**Efficient Change Detection**: Only changed 4KB blocks are re-requested

**Sub-Block Precision**: Within changed blocks, only modified 256-byte regions are transferred

**Scrolling**: Smooth navigation through entire address space

**Address Correlation**: Click heatmap jumps to hex dump

### 22.4 Smart Pin Inspection

**Pin State Query**: Use RQPIN to read smart pin measurements

**Supported Modes**:
- PWM (duty cycle, period)
- ADC (analog measurement)
- Counter (event counts)
- Serial (bit counts, frames)
- Encoder (position tracking)

**Real-Time Monitoring**: Can repeatedly query pins across breakpoints to watch values change

### 22.5 Stack Inspection

**Hardware Stack**: Shows 4-level call return addresses

**Stack Depth Tracking**: mCALL field shows total call depth (including software stack)

**Stack Unwinding**: Can trace call chain by examining stack values

---

## 23. COGBRK Inter-Cog Debugging

The COGBRK mechanism allows debugging interactions between multiple cogs.

### 23.1 COGBRK Concept

**Purpose**: One cog can force another cog into the debugger

**Use Case**: Debugging multi-cog coordination, synchronization, communication

**Instruction**: `COGBRK #cog_number`

### 23.2 COGBRK Flow

**Scenario**: COG 0 executes `COGBRK #3` (break into cog 3)

**Sequence**:
1. COG 0 executes COGBRK #3
2. COG 3 immediately enters Debug ISR
3. COG 3 loads debugger code
4. COG 3 enters breakpoint handler
5. COG 3 sends state to PC
6. PC displays COG 3 state (registers, LUT, PC, etc.)
7. User examines COG 3 state
8. User presses SPACE/ENTER
9. PC sends continue command to COG 3
10. COG 3 resumes execution
11. COG 0 continues (COGBRK is synchronous)

### 23.3 Multi-Cog Debugging Strategy

**Strategy 1: Sequential Inspection**
- Set breakpoint in COG 0
- Use COGBRK to inspect other cogs
- Resume all cogs
- Continue debugging COG 0

**Strategy 2: Coordinated Breakpoints**
- Place DEBUG statements in multiple cogs
- Each cog independently enters debugger
- Examine each cog's state when it breaks

**Strategy 3: Event-Driven Breaking**
- Use bcEVENT to break on hardware events
- Catch inter-cog race conditions
- Inspect all cog states at critical moments

---

## 24. Display Rendering System

The debugger uses sophisticated graphics rendering for anti-aliased, professional display.

### 24.1 Rendering Architecture

**Double Buffering**: All rendering to off-screen bitmap, then blit to screen

**Anti-Aliasing**: Text and graphics use anti-aliased rendering for smooth appearance

**Incremental Updates**: Only changed regions are re-rendered (optimization)

**Heatmap Shader**: Custom color interpolation for temperature visualization

### 24.2 Heatmap Color Schemes

**Register/LUT Heatmap**:
```
Value 0 (cold)    → RGB(0, 0, 64)     Dark blue
Value 128 (warm)  → RGB(64, 64, 255)  Medium blue
Value 255 (hot)   → RGB(255, 255, 255) White
```

**Hub Memory Heatmap**:
```
No access    → RGB(0, 0, 32)       Very dark blue
Read access  → RGB(0, 128, 255)    Cyan/blue
Write access → RGB(255, 128, 0)    Orange/red
Recent write → RGB(255, 255, 0)    Yellow
```

### 24.3 Text Rendering

**Font**: Fixed-width monospace font (Courier New or Consolas)

**Sizes**:
- Large: 12pt (section headers)
- Medium: 10pt (register values, disassembly)
- Small: 8pt (hints, status)

**Colors**:
- Normal text: White/light gray
- Highlighted: Yellow/cyan
- Changed values: Bright white
- Comments: Gray
- Addresses: Light blue

### 24.4 Performance Optimization

**Region Invalidation**: Only redraw regions that changed

**CRC-Based Rendering**: Use CRCs to detect if region needs redraw

**Lazy Evaluation**: Defer rendering until visible

**Frame Rate**: Target 30fps during active debugging

---

## 25. Usage Examples

### 25.1 Example 1: Single-Stepping Through PASM Code

**Scenario**: Debug a PASM loop that increments a counter

**Code**:
```spin2
PUB main()
  coginit(0, @loop, 0)

DAT
loop
  mov     PA, #0
.repeat
  add     PA, #1
  waitx   ##20_000_000  ' Wait 1 second at 20MHz
  debug(`udec(PA))      ' Print PA value
  jmp     #.repeat
```

**Debugging Session**:
1. Compile and download code
2. Debugger opens automatically at first DEBUG statement
3. Observe disassembly showing loop at cog $000
4. PA register = $00000001 (first iteration)
5. Press SPACE to single-step
6. Code executes WAITX, then DEBUG, then JMP, then ADD
7. PA register turns bright white (just changed)
8. PA = $00000002
9. Delta watch shows: `$1F0 (PA): $00000001 → $00000002 (+1)`
10. Press ENTER to run continuously
11. DEBUG output appears in terminal, debugger doesn't interrupt
12. Press D to break on next DEBUG
13. Observe PA has incremented multiple times

### 25.2 Example 2: Finding Memory Corruption

**Scenario**: Hub memory is being unexpectedly modified

**Strategy**:
1. Set BRK = bcDEBUG, place DEBUG statements in suspicious code
2. Run until breakpoint
3. Examine hub heatmap for unexpected hot spots
4. Click hot region to jump hex dump
5. Examine memory contents
6. Note address of corruption
7. Set disassembly mode to dmHub, navigate to address
8. Identify which code is writing to that location
9. Single-step through suspect code watching hub map
10. Catch the exact instruction causing corruption

### 25.3 Example 3: Multi-Cog Synchronization Bug

**Scenario**: Two cogs share a hub variable, synchronization issue suspected

**Code**:
```spin2
VAR long shared_counter

PUB main()
  shared_counter := 0
  coginit(0, @cog0_code, @shared_counter)
  coginit(1, @cog1_code, @shared_counter)

DAT
cog0_code
  mov     ptra, par        ' Get pointer to shared_counter
.loop
  rdlong  temp, ptra       ' Read counter
  add     temp, #1         ' Increment
  wrlong  temp, ptra       ' Write back
  debug(`udec(temp))       ' Print
  cogbrk  #1               ' Break into cog 1 to check its state
  waitx   ##1_000_000
  jmp     #.loop

cog1_code
  mov     ptra, par
.loop
  rdlong  temp, ptra
  add     temp, #1
  wrlong  temp, ptra
  debug(`udec(temp))
  waitx   ##1_000_000
  jmp     #.loop
```

**Debugging Session**:
1. COG 0 hits DEBUG, shows counter = 1
2. COG 0 executes COGBRK #1
3. Debugger switches to COG 1 display
4. Examine COG 1's temp and ptra registers
5. Verify COG 1 sees same shared_counter value
6. Observe potential race: if COG 1 read before COG 0 wrote, values desync
7. Identify need for atomic increment or mutex
8. Fix: Use P2 atomic operations (LOCKTRY, LOCKREL)

### 25.4 Example 4: Smart Pin PWM Debugging

**Scenario**: PWM output not producing expected waveform

**Code**:
```spin2
PUB main()
  ' Configure P16 for PWM mode
  dirh(16)
  wrpin(16, P_PWM_SAWTOOTH)
  wxpin(16, 1000)        ' Period
  wypin(16, 500)         ' Duty (50%)
  debug()                ' Enter debugger
```

**Debugging Session**:
1. Debugger opens at DEBUG statement
2. Navigate to Smart Pin display
3. Select P16
4. Verify pin mode = P_PWM_SAWTOOTH
5. Verify period = 1000
6. Verify duty = 500
7. Use RQPIN request to check current counter value
8. Press SPACE repeatedly, observe counter incrementing
9. If waveform wrong, check DIRA (pin direction)
10. Check WRPIN value matches expected mode
11. Adjust WXPIN/WYPIN values, continue execution, re-break to verify

---

## 26. Summary

The Single-Step Debugger is the most sophisticated component of the PNut IDE, providing comprehensive interactive debugging capabilities for the Propeller 2.

### 26.1 Key Capabilities

**Bidirectional Communication**: P2 and PC work together to provide real-time debugging

**Comprehensive State Inspection**:
- All 512 cog/LUT registers
- All 512KB hub RAM
- Hardware stack
- Smart pin states
- Execution flags

**Efficient Change Detection**:
- CRC-16 for cog/LUT blocks
- 16-bit checksums for hub blocks
- Only changed data transmitted

**Interactive Control**:
- Single-stepping
- Multiple break conditions
- Inter-cog debugging (COGBRK)
- Real-time memory inspection

**Professional Visualization**:
- Heat maps for activity tracking
- Delta watch lists
- Disassembly display
- Comprehensive mouse/keyboard interface

### 26.2 Architecture Highlights

**P2-Side** (Spin2_debugger.spin2):
- Minimal footprint via overlay system
- Protected memory region ($FC000..$FFFFF)
- Debug ISR at ROM $1F8
- Efficient serial protocol

**PC-Side** (DebuggerUnit.pas):
- ~2500 lines of Delphi code
- 25+ screen regions
- Sophisticated rendering system
- Comprehensive user interaction

### 26.3 Debugging Workflow

1. Developer writes Spin2 code with DEBUG() statements
2. Code compiled and downloaded to P2
3. P2 runs until breakpoint/DEBUG
4. Debugger window opens automatically
5. Developer examines state (registers, memory, stack, disassembly)
6. Developer single-steps or continues execution
7. Changes highlighted in real-time via heatmaps
8. Process repeats until bug found and fixed

### 26.4 Best Practices

**Use DEBUG() Liberally**: Place DEBUG statements at key points in code

**Watch the Heatmaps**: Unexpected hot spots often indicate bugs

**Use Delta Watches**: Track specific registers across breakpoints

**COGBRK for Multi-Cog**: Use COGBRK to inspect inter-cog interactions

**Disassembly Modes**: Use dmPC for stepping, dmCog/dmHub for exploration

**BRK Conditions**: Choose appropriate break type for debugging phase
- bcDEBUG: Interactive single-stepping
- bcMAIN: Skip initialization
- bcNONE: Run freely with selective breakpoints

### 26.5 Technical Achievement

The PNut debugger represents a significant technical achievement in embedded systems debugging:

**Challenge**: Debug code running on bare-metal microcontroller with no OS, no filesystem, minimal RAM

**Solution**:
- Load debugger dynamically into protected memory
- Use overlay technique to minimize footprint
- Efficient protocol to minimize data transfer
- Rich visual interface to maximize developer insight

**Result**: Professional-grade debugging experience comparable to desktop IDEs, but for a $8 microcontroller chip.

---

**End of Document**

*Single-Step Debugger Window - Theory of Operations*
*PNut v51a for Propeller 2*
*Document Date: 2025*

