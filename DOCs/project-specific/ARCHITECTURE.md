# Architecture Documentation

This document provides detailed architecture and implementation notes for PNut-Term-TS.

## P2 Development Ecosystem

PNut-Term-TS is the third component in a complete P2 multiplatform development environment:

### 1. **Spin2 Extension for VSCode**
- Provides semantic highlighting for Spin2 code
- Integrates with VSCode for P2 development
- Invokes external tools (compiler and terminal)

### 2. **PNut-TS Compiler**
- Complete reimplementation of the Windows PNut compiler
- Translated from x86 assembly and Pascal source code
- Months of collaborative effort between the team and Chip Gracey
- Provides cross-platform P2 compilation

### 3. **PNut-Term-TS (This Tool)**
- Command-line tool invoked by VSCode with parameters
- Combines downloading and debug window display
- Creates timestamped log files for all P2 traffic
- Provides regression testing capabilities through comprehensive logging

## Project History and Motivation

### University of Virginia Connection
The debug system's semantic highlighting was developed while auditing Gavin's mechatronics course at the University of Virginia. The course uses P2 microcontrollers for teaching hardware control with:
- Servo control
- Light and temperature sensors
- Linear actuators
- Sprite-based games

This real-world educational use case drives our requirements:
- Cross-platform support (students can use any OS, not just Windows)
- Recording/playback for classroom demonstrations
- Clear visual debugging for learning hardware concepts
- Robust capture of high-speed data streams

### The Parallax Legacy
- PST (Parallax Serial Terminal) originated in the 1980s for Basic Stamp
- Evolved through P1 (Propeller 1) era
- Now enhanced for P2 (Propeller 2) capabilities
- PNut-Term-TS brings this legacy to modern, cross-platform development

## The Propeller 2: Unique Position in Embedded Systems

### P2 Architecture Overview
The Propeller 2 (P2) is a unique 8-core 32-bit multiprocessor that occupies a distinctive position in the embedded systems landscape:

- **8 Independent Cores (COGs)**: True parallel processing without OS overhead
- **Shared Hub Memory**: 512KB RAM accessible by all cores
- **Smart Pins**: 64 I/O pins with dedicated hardware for complex protocols
- **No Interrupts**: Deterministic timing through dedicated cores
- **180MHz-300MHz Operation**: High-speed signal processing capability

### Bridging Hardware and Software
The P2 stands uniquely between traditional approaches:

**Pure Software (Traditional MCU)**
- Limited by single/dual core constraints
- Requires RTOS for complex timing
- Interrupt-driven, non-deterministic

**P2's Sweet Spot**
- Multiple cores handle real-time tasks independently
- No FPGA needed for many signal processing tasks
- No DSP required for audio/video processing
- Deterministic timing without interrupt complexity

**Pure Hardware (FPGA/ASIC)**
- Complex development cycle
- Expensive tooling
- Fixed functionality

### Real-World P2 Applications
The P2 community is using these capabilities for extraordinary projects:
- **Movie Special Effects**: Real-time motion control and lighting
- **Medical Devices**: Precise sensor fusion and signal processing
- **Scientific Instruments**: High-speed data acquisition and analysis
- **Gaming Systems**: Retro console emulation and arcade machines
- **Industrial Control**: Deterministic motor control and automation

## Development Timeline and Impact

### Traditional Development Timeline
The three-component P2 toolset represents significant development effort:
1. **Spin2 VSCode Extension**: Months of development (completed)
2. **PNut-TS Compiler**: Months of x86/Pascal translation (completed)
3. **PNut-Term-TS**: Originally estimated at months for Pascal port

### Claude-Enhanced Development
With Claude Code assistance, PNut-Term-TS development timeline:
- **Traditional Estimate**: 2-3 months for Pascal to TypeScript port
- **With Claude**: Less than 2 weeks for complete implementation
- **Productivity Gain**: 6-10x development velocity
- **Quality**: Comprehensive test coverage, documentation included

### Why MCP (Model Context Protocol) Was Essential

**The Problem That Led to MCP**:
During initial development, context loss through auto-compaction was "distracting, demeaning, and demoralizing" - destroying detailed planning and task organization. This friction threatened the entire rapid development approach.

**MCP as Survival Mechanism**:
MCP exists as an additional capability beyond TodoWrite specifically to survive auto-compaction events:
- **TodoWrite**: Temporary task management within a session (lost on compaction)
- **MCP Tasks**: Persistent task storage across all sessions (survives compaction)
- **MCP Context**: Key-value storage for rapid state recovery after compaction
- **The Combination**: Enables complex multi-session projects that would be impossible with compaction losses

**The Evolution (One Week Timeline)**:
1. **Day 1-2**: Basic prototype with windows, hitting context loss
2. **Day 3-4**: Built MCP 6.04 for task persistence after Claude suggested MCP investigation
3. **Day 5**: Claude revealed need for context storage ("collection of key-value pairs")
4. **Day 6**: MCP 6.05-6.06 iterations removing friction discovered through usage
5. **Day 7**: Near-complete implementation with debugger and main window

**The Co-Evolution Pattern**:
- Claude reveals friction through usage → User implements solutions
- User provides unconstrained tools → Claude reveals actual needs
- Each iteration enables tackling harder problems
- Friction emerges at progressively finer grain
- 6.04: Basic persistence → 6.05: Human readability → 6.06: Task management → 6.08: Context lifecycle

**The Result**: "The best pair coding experience ever" - true collaboration where human experience guides AI capability, and AI usage patterns reveal tool improvement opportunities. The 480x productivity gains on pattern-based tasks demonstrate the power of this co-evolutionary approach.

### Community Impact (2025)
- **Wednesday Demo**: First public demonstration of complete toolset
- **Community Presentation**: One month later, sharing development approach
- **Future Vision**: Training Claude for Spin2 development
  - Rich, initially correct embedded code generation
  - Complex multiprocessor coordination patterns
  - Signal processing implementations
  - Hardware abstraction libraries

## Project Development Metrics

### Actual Development Statistics
Based on our todo-mcp tracked development:
- **Total Tasks**: 34 completed (100% success rate)
- **Total Estimated Time**: 136+ hours
- **Actual Time**: Significantly less (many 6h estimates completed in minutes)
- **Key Features Implemented**:
  - 10 debug windows with full Pascal parity
  - WindowRouter architecture with <1ms routing
  - Multi-COG debugging support
  - Recording/playback system
  - DTR/RTS hardware control
  - IDE integration mode

### Why These Metrics Matter
For a developer with 40+ years experience and 7 years in process improvement:
- Validates Claude's capability for complex systems work
- Demonstrates feasibility of AI-assisted embedded development
- Provides concrete data for community adoption decisions
- Shows path forward for Spin2 language support in Claude

## Upcoming P2 Community Projects

Following the successful completion of PNut-Term-TS, three major projects will enhance the P2 development ecosystem:

### 1. Spin2 VSCode Extension Enhancement
- **Current State**: Functional syntax highlighter
- **Planned Improvements**: 
  - Enhanced semantic analysis
  - Better error reporting integration
  - Improved IntelliSense support
  - Tighter integration with compiler and debugger

### 2. PNut-TS Compiler Optimization
- **Current State**: Complete, functional compiler
- **Planned Improvements**:
  - Performance optimizations
  - Enhanced error messages
  - Additional P2 instruction support
  - Cross-compilation targets

### 3. PNut-Term-TS Polish (This Project)
- **Current State**: Feature complete with all 10 debug windows
- **Remaining Work**:
  - Flash download support (RAM complete)
  - Performance optimization for extreme data rates
  - Enhanced recording/playback features
  - Community-requested debug window enhancements

These three projects will demonstrate todo-mcp's effectiveness across different development patterns and solidify the workflow before 1.0 release.

## Reference Tools: Understanding the Heritage

PNut-Term-TS combines behaviors from two distinct Parallax tools for Windows:

### 1. Propeller Tool (Two Operating Modes)

#### Mode A: Legacy Mode with PST
- **Two separate applications**: PropellerTool compiles/downloads, then launches PST
- **Parallax Serial Terminal (PST)**: Full bidirectional I/O terminal
- **Debug Output**: ALL output including "Cog" prefixed messages go to PST's blue terminal window
- **Behavior**: Exactly what PNut-Term-TS MainWindow currently does (we patterned after PST)
- **Use Case**: Traditional P1 and early P2 development before debug windows existed

#### Mode B: PNut Mode (without PST)
- **Single application**: PropellerTool handles everything internally
- **Debug Terminal**: Lightweight OUTPUT-ONLY terminal window (not PST)
- **Debug Output**: Receives all P2 debug output when debug statements are used
- **Behavior**: Auto-opens when debug output begins

### 2. PNut (Standalone)
- **Single integrated application**: IDE, compiler, and debug terminal combined
- **Debug Terminal**: Lightweight green-on-black OUTPUT-ONLY terminal window
- **Debug Output**: Routes ALL P2 output to this terminal (not just debug-filtered)
- **Behavior**: Auto-opens when P2 output begins
- **Visual Style**: Green text on black background (high contrast for debugging)

### Key Behavioral Similarities
- **PropellerTool Mode B** and **PNut** both use:
  - Lightweight output-only terminal windows
  - Auto-open on P2 output
  - Route ALL P2 output (including Cog messages) to this terminal
  - Green-on-black color scheme (PNut) for debug visibility

### Key Behavioral Differences
- **PST Mode (PropellerTool Mode A)**: 
  - Full bidirectional I/O
  - Blue terminal window
  - Separate application
  - What PNut-Term-TS currently implements
  
- **PNut Mode (PropellerTool Mode B & PNut)**:
  - Output-only terminal
  - Green-on-black (or similar high contrast)
  - Integrated/lightweight window
  - Missing from PNut-Term-TS

### Debug Traffic Architecture

#### Critical Baud Rate Distinction
- **Download Baud Rate**: Used for programming the P2 (typically 2 Mbps)
- **Debug Baud Rate**: SEPARATE rate used for debug statement output
- **Important**: Debug statements ALWAYS use debug baud rate, not download rate

#### Debug Message Structure (CORRECTED)
All debug output from P2 follows this specific pattern:

**Format**: `"CogN: [content]"` where N is 0-7

**Content Types**:
1. **Plain debug text**: `"Cog0: Temperature is 72.5"`
2. **Window creation**: `"Cog0: `TERM MyTerm SIZE 80 24"`
3. **Window routing**: `"Cog0: `MyTerm 'Hello World'"`

**Critical**: The backtick (`) appears WITHIN the content portion, not at the message start!

#### Routing Logic
The router processes each Cog-prefixed message as follows:

1. **Receive**: `"CogN: [content]"`
2. **Log**: Write to debug log file (always)
3. **Route to General Terminal**: Display in debug output terminal
4. **Parse Content**: Look for backtick commands
   - If window creation: Create new window with user-specified name
   - If window routing: Send to named window (e.g., `MyTerm)
5. **Track Association**: Remember CogN + WindowName pairs for routing

**Example Flow**:
```
"Cog0: `TERM MyTerm SIZE 80 24"  → Creates TERM window "MyTerm" for Cog0
"Cog0: `MyTerm 'Temperature: '"  → Routes to MyTerm window
"Cog0: `MyTerm 72.5"             → Routes to MyTerm window
"Cog0: Debug checkpoint reached"  → General debug terminal only
"Cog1: `SCOPE Signals"           → Creates SCOPE window for Cog1
```

#### Display System Layers

**Layer 1: General Debug Terminal**
- Receives ALL Cog-prefixed messages
- Shows complete debug stream
- Logs everything to files

**Layer 2: Specialized Debug Windows**
- Created dynamically by content commands
- Receive filtered data by CogN + WindowName
- Each Cog can have multiple named windows

### Mutual Exclusion: Two Distinct Paradigms

PNut-Term-TS must handle two **mutually exclusive** operational paradigms:

#### Paradigm 1: PST Terminal Mode
- **Purpose**: Interactive terminal applications
- **Features**: 
  - Cursor positioning (PST/ANSI commands)
  - Blue terminal aesthetic
  - Bidirectional I/O
  - Games, menus, interactive displays
- **Use Cases**: 
  - Terminal-based user interfaces
  - Interactive configuration tools
  - Text-based games
  - Command-line interfaces

#### Paradigm 2: Debug Instrumentation Mode
- **Purpose**: Software-defined test equipment
- **Features**:
  - High-speed logging of all debug output
  - Dynamic debug window creation
  - Multi-core visualization
  - Timestamped capture files
- **Use Cases**:
  - Hardware debugging
  - Sensor monitoring
  - Protocol analysis
  - Performance profiling

#### Why These Are Mutually Exclusive

1. **Conceptual Conflict**: You don't mix cursor-controlled UI with oscilloscopes
2. **Data Rate Mismatch**: Debug floods with data, terminal UI needs controlled output
3. **User Mental Model**: Clear separation between "running an app" vs "debugging hardware"
4. **Screen Real Estate**: Debug windows consume space needed for terminal display
5. **Performance Focus**: Terminal mode prioritizes interaction, debug mode prioritizes capture

### PNut-Term-TS Mode Selection Strategy

**Open Design Question**: How to trigger/detect which mode?

**Potential Triggers** (to be determined):
- Automatic detection (presence of CogN: messages)
- Command-line flag at startup
- User menu selection
- Binary metadata (debug-compiled vs release)
- First message type received

**Visual Mode Indication**:
- PST Mode: Blue terminal (current)
- Debug Mode: Green terminal or separate debug window

**Architecture Decision**: Keep both paradigms but make them mutually exclusive with clear mode indication and switching mechanism

### Implementation Plan for Debug Mode

#### DebugLoggerWindow Class (New)
- **Purpose**: Dedicated output-only terminal for debug messages
- **Visual Style**: Themeable, defaults to green text on black background
- **Features**:
  - No input field (output only)
  - High-speed message buffering
  - Automatic file logging with timestamps
  - Log status bar showing current log filename
  - Auto-opens on first CogN: message
  - Theme support (shares preference system with MainWindow)

**Theme Options**:
- **Green on Black** (default): #00FF00 on #000000
- **Amber on Black**: #FFBF00 on #000000
- Future: Could support all MainWindow themes (PST cyan/ivory, etc.)

**Performance Requirements**:
- Must handle 8 COGs × 2 Mbps = 16 Mbps aggregate data rate
- Buffered writes to prevent UI blocking
- Batch DOM updates (e.g., every 16ms frame)
- Asynchronous file I/O for logging
- Memory-efficient circular buffer for display
- No parsing or processing delays in critical path

**User Settings Integration**:
- Extends existing settings pane used by MainWindow
- Separate theme selection for logger window
- Persisted in user preferences
- Hot-swappable themes (no restart required)

#### Message Routing Implementation
```typescript
// Proposed routing logic in MainWindow
if (message.startsWith('Cog')) {
  // Debug mode triggered
  if (!debugLoggerWindow) {
    debugLoggerWindow = new DebugLoggerWindow();
  }
  
  // Route to debug logger
  debugLoggerWindow.appendMessage(message);
  
  // Parse for embedded backtick commands
  const content = message.substring(5); // After "CogN: "
  if (content.includes('`')) {
    windowRouter.parseDebugCommand(cogId, content);
  }
} else {
  // PST mode - route to blue terminal
  mainWindow.appendToTerminal(message);
}
```

#### Mode Switching Trigger
**Decision**: Automatic detection based on first message type
- If first message contains "CogN:" → Auto-create debug logger window
- Debug logger sits side-by-side with blue terminal
- ALL Cog-prefixed messages route to debug logger (NOT blue terminal)
- Blue terminal remains for non-debug I/O

### Window Placement Management

#### Multi-Monitor Support (Research Required)
- Investigate Electron's `screen` API for multi-monitor detection
- Allow window placement across multiple displays
- Enable monitor preference specification (e.g., "always use Monitor 2")

#### Default Window Positions

**Main Window**:
- Position: Bottom-center of primary display
- Size: Fixed (e.g., 1024x600)
- Always appears first

**Debug Logger Window**:
- Position: Bottom-right, aligned with main window top
- Size: 80 columns × 24 lines (approximately 640×400)
- Auto-opens on first Cog message
- Has close button, no menu bar
- Status bar at bottom showing log filename

#### Auto-Placement Algorithm (Heads-Up Console Pattern)

Windows auto-place in a predictable console arrangement:

```
Order:  [4]     [1]     [5]
        [6]     [2]     [7]
                [3]
        [Main]      [Logger]
```

**Placement Sequence**:
1. **Top-center** - Most dominant/important window
2. **Left-of-center** - Secondary display
3. **Top-right** - Third display  
4. **Top-left** - Fourth display
5. **Right-of-center** (row 2) - Fifth display
6. **Left-of-center** (row 2) - Sixth display
7. **Bottom-center** - Seventh display

**Algorithm Properties**:
- No overlapping windows
- Predictable placement pattern
- Forms visual "console" arrangement
- Respects monitor boundaries
- Adjusts for available screen space

#### Auto-Placement Logging
When windows are auto-placed, inject formatted log entries:
```
[WINDOW] Term_MyDisplay placed at (320, 240) size 800x600
[WINDOW] Scope_Signals placed at (1120, 240) size 512x256
[WINDOW] Logic_Bus placed at (100, 240) size 400x300
```

**Requirements**:
- Use distinctive prefix `[WINDOW]` (not "CogN:")
- Fixed, parseable format for easy copy/paste
- Include window type, name, position (x,y), and size
- Users can copy these values into their debug() POS statements
- Enables reproducible window layouts

#### Message Routing Architecture

**Complete Flow**:
1. **Receive**: `"Cog0: `TERM MyTerm SIZE 80 24"`
2. **Log**: Write to debug logger window AND file
3. **Parse**: Detect window creation command
4. **Create**: Spawn new TERM window named "MyTerm"
5. **Register**: Router remembers Cog0+MyTerm association
6. **Route Updates**: `"Cog0: `MyTerm 'Hello'"` goes to:
   - Debug logger window (always)
   - Log file (always)
   - MyTerm window (for display)

**Special Case: Debugger Windows**
- Named `debugger-0` through `debugger-7` (one per Cog)
- Use binary protocol, not text
- Bidirectional communication (unlike other debug windows)
- Different routing mechanism from text-based debug windows

### Minimal System Architecture Summary

Yes, this represents the minimal complete system:

**Core Components**:
1. **MainWindow** - Blue PST-style terminal for non-debug I/O
2. **DebugLoggerWindow** - Green high-performance logger for ALL debug output
3. **WindowRouter** - Routes messages to appropriate windows
4. **Debug Windows** (10 types) - Specialized visualization windows
5. **Debugger Windows** (8 instances) - Per-COG interactive debugging

**Data Flow**:
1. Serial data arrives at MainWindow
2. Non-Cog messages → Blue terminal
3. Cog messages → Debug logger + routing
4. Window commands → Create/update specific windows
5. All messages → Log files

**This is minimal because**:
- Separates debug from normal I/O (required for both modes)
- Provides high-speed logging (required for P2's data rates)
- Enables software-defined instrumentation (core value proposition)
- Supports multi-core debugging (P2 has 8 cores)
- No redundant components - each serves a specific purpose

## The Revolutionary Power: Software-Defined Instrumentation

### A Complete Test Workbench in Your Source Code

The P2 debug system represents a paradigm shift in embedded development: **software-defined instrumentation**. With just a couple lines of code, developers can spawn an entire electronics test bench directly from their embedded application.

**Traditional Embedded Debugging**:
- Physical oscilloscope ($500-$5000)
- Physical logic analyzer ($200-$2000)
- Physical spectrum analyzer ($1000-$10000)
- Complex probe connections
- Limited channels
- Setup time and expertise required

**P2 Software-Defined Approach**:
```spin2
' Instant oscilloscope tracking sensor voltages
debug(`SCOPE MyScope SIZE 512 256 SAMPLES 1024)
debug(`MyScope sensor1_voltage, sensor2_voltage)

' Instant logic analyzer for protocol debugging
debug(`LOGIC Signals 'CLK' 'DATA' 'CS')
debug(`Signals long_value)

' Instant FFT for audio analysis
debug(`FFT Audio SAMPLES 1024)
debug(`Audio audio_buffer)
```

### The Complete Virtual Workbench

With PNut-Term-TS, developers have access to:
- **Oscilloscope** (`SCOPE): Visualize analog signals, sensor readings, control loops
- **Logic Analyzer** (`LOGIC): Debug digital protocols, timing issues, state machines
- **FFT Analyzer** (`FFT): Frequency analysis for audio, vibration, signal processing
- **XY Scope** (`SCOPE_XY): Phase relationships, Lissajous patterns, vector displays
- **Bitmap Display** (`BITMAP): Custom graphics, image processing, visual debugging
- **Data Plotter** (`PLOT): Time series data, trends, mathematical functions
- **MIDI Visualizer** (`MIDI): Music applications, MIDI protocol debugging
- **Terminal** (`TERM): Formatted text output with colors and positioning

### Multi-Core Visualization

Each of the 8 P2 cores can spawn and control its own set of debug windows:
- Cog 0 might run an oscilloscope monitoring power supply
- Cog 1 could display logic analyzer for SPI communication
- Cog 2 might show FFT of audio processing
- Cog 3 could have a terminal showing state machine status

All running simultaneously, all defined in source code, all captured to timestamped logs.

### Why This Matters

1. **Zero Hardware Cost**: No external test equipment needed
2. **Instant Setup**: Debug windows spawn from code, no physical connections
3. **Unlimited Channels**: Software-defined, not limited by physical probes
4. **Perfect Synchronization**: All debug data time-aligned from same source
5. **Reproducible**: Debug setup is part of source code, travels with project
6. **Remote Debugging**: Capture logs, replay sessions anywhere
7. **Teaching Tool**: Students see real-time visualization of embedded concepts

This is why PNut-Term-TS exists - to make this revolutionary debugging approach available cross-platform, with robust data capture and session recording.

## Why PNut-Term-TS is Essential (Technical Details)

### The P2's Extreme Data Capabilities
The Propeller 2 is an extraordinarily capable microcontroller that can overwhelm traditional terminal tools:

- **64 Smart Pins**: Every I/O pin includes intelligent hardware
  - Can be configured as UART, SPI, I2C, RS-485, ADC, DAC, and more
  - Operates independently without CPU intervention
  - Processor reads/writes bytes, not bits - hardware handles protocols

- **8 COGs (cores)**: Each can run independently
  - Possible to run 8 serial ports simultaneously at 2 Mbps each
  - Total potential throughput: 16 Mbps of serial data
  - Plus additional data from Smart Pin peripherals

- **Streamer Hardware**: Direct memory-to-pin streaming
  - Automated buffer feeding without CPU involvement
  - Enables sustained high-speed data transfer

### The Capture Challenge
Most terminal applications and logging tools cannot handle the P2's data rates:
- Traditional terminals drop data at high speeds
- File systems struggle with continuous high-bandwidth writes
- USB buffers overflow without proper flow control

This is why PNut-Term-TS implements:
- High-performance buffered logging that never blocks
- Efficient recording formats for massive data streams
- WindowRouter that can handle intermixed high-speed data
- Careful separation of logging from UI rendering

## Operating Modes and Use Cases

### Primary Mode: IDE External Tool
PNut-Term-TS operates as an external tool for IDEs:

1. **VSCode Integration** (primary):
   - VSCode compiles code using PNut-TS compiler
   - VSCode invokes PNut-Term-TS as downloader
   - MainWindow opens outside VSCode environment
   - Handles downloading, logging, and debug windows
   - COM port passed as parameter (no selection needed)
   - UI shows only essential controls

2. **Spin Tools IDE Integration** (MacaSoft, France):
   - Used as external tool similar to VSCode
   - Same parameter-based invocation model

### Secondary Mode: Standalone Operation
For regression testing and pre-compiled binaries:

1. **Hardware Regression Testing**:
   - Load pre-compiled binaries directly
   - Test hardware changes (actuators, sensors)
   - Automatic timestamped logging
   - Log naming: `timestamp-binaryname.log`

2. **Automatic Log Management**:
   - New log on every download
   - New log on DTR/RTS reset
   - Continuous regression record
   - First toolchain to make regression logging automatic

3. **UI Adaptation**:
   - Shows COM port selection
   - Shows download baud rate control
   - Shows runtime baud rate control
   - Full menu system enabled

## UI Mode Adaptation

### Mode Detection:
- **IDE Mode**: Triggered by `--ide` command-line parameter
- **Standalone Mode**: Default when `--ide` is absent
- Deterministic and explicit - no guessing required

### VSCode/IDE Mode (Minimal UI):
Invoked with: `pnut-term-ts --ide --device /dev/tty.123456 --file program.binary`
- Hide: COM port selector (provided via CLI)
- Hide: Download baud rate selector
- Hide: Preferences button (use menu)
- Show: DTR/RTS controls and indicators
- Show: TX/RX/DSR/CTS indicators
- Show: Echo checkbox
- Show: Runtime baud rate selector
- Show: Clear and Pause buttons
- Show: Recording controls

### Standalone Mode (Full UI):
Invoked with: `pnut-term-ts` or `pnut-term-ts --file program.binary`
- Show: COM port selector
- Show: Download baud rate selector
- Show: Runtime baud rate selector
- Show: All controls and indicators
- Show: Full menu system
- Show: Device discovery features

## System Architecture

### Overview

PNut-Term-TS is a command-line debug terminal application that communicates with Parallax Propeller2 microcontrollers. It is invoked by VSCode as an external tool and combines:
- File downloading capabilities to P2 RAM/FLASH (mode specified at invocation)
- Serial terminal functionality (PST replacement)
- Comprehensive debug display windows
- Real-time data visualization
- Timestamped logging of all P2 traffic for regression testing

## PST (Parallax Serial Terminal) Interface Reference

### Historical Context
PST (Parallax Serial Terminal) has a long history in the Parallax ecosystem:
- Originally developed in the 1980s for the Basic Stamp microcontroller
- Updated for Propeller 1 (P1) support when it was released
- Further updated ~7 years later for Propeller 2 (P2) support
- Has been the standard terminal interface for Parallax microcontrollers for decades
- Despite being a Windows application, used "Preferences" (non-Windows naming)

### Original PST Layout
PNut-Term-TS maintains compatibility with the original PST interface while adding modern enhancements:

#### Window Theme
- **Background**: Yellow-tinted window (themes planned for future implementation)
- **Font**: Parallax font throughout
- **Colors**: Configurable themes planned (default PST-style, dark mode, high contrast)

#### Main Window Areas

1. **Data Entry Window** (top section):
   - Single line height, full window width
   - Light yellow background with black text
   - Auto-sends typed characters to P2 immediately (no Enter required)
   - Scrolls horizontally and vertically
   - Used for sending commands to P2

2. **Output Display Window** (main area):
   - Light pale blue background with black text
   - Displays all P2 output
   - ANSI sequence support (from Parallax documentation)
   - Scrolls vertically and horizontally
   - Maintains default size for ANSI compatibility

#### Status Bar Layout (left to right)

**PST Original Controls**:
1. COM Port selection dropdown (OS-specific display)
   - Windows: COM1, COM2, etc.
   - Linux/Mac: Prop plug serial number (6-8 chars)
2. Baud Rate dropdown
3. TX indicator (blue LED blinky)
4. RX indicator (red LED blinky)
5. DTR checkbox
6. RTS checkbox
7. DSR indicator (blinky LED)
8. CTS indicator (blinky LED)
9. Echo On checkbox

**PST Original Buttons**:
1. Preferences - Settings dialog (moving to menu in PNut-Term-TS)
2. Clear - Clear output window (keeping)
3. Pause - Stop receiving data (keeping)
4. Disable - Release USB port (removing - we handle downloads)

### PNut-Term-TS Enhancements

#### Adaptive Interface
- **IDE Mode**: Minimal UI when invoked with `--ide` flag
- **Standalone Mode**: Full UI with all controls visible

#### Enhanced Status Bar
Preserves PST controls while adding:
- Recording indicator and controls
- Log file name and line count
- COG debugger status indicators
- Message throughput metrics

#### Menu System (PST didn't have menus)
Adding standard application menu bar:
- File, Edit, View, Tools, Window, Help
- "Preferences" menu item (maintaining PST naming consistency across all platforms)
- Following platform conventions for immediate familiarity

### Preferences Dialog Design

Based on PST's original Preferences dialog, with adaptations for PNut-Term-TS:

#### Dialog Structure
- Two tabs: "Appearance" and "Function"
- Standard "OK" and "Cancel" buttons at bottom
- "Restore Defaults" button in bottom right of each tab
- Cancel discards all changes, OK applies them

#### Appearance Tab

**Theme Section:**
1. **Theme Management**
   - Theme selector dropdown (shows all themes including custom)
   - [Customize...] button - opens color customization
   - [Delete Theme] button - disabled for built-in themes
   - Theme name field (when customizing)
   - [Save Theme] button (when customizing)

2. **Built-in Themes (cannot be deleted):**
   - **PST Classic**
     - Transmit BG: Light yellow (#FFF8E7)
     - Transmit FG: Black (#000000)
     - Receive BG: Light cyan (#8AB3E9)
     - Receive FG: Black (#000000)
     - Terminal Size: (PST default - TBD)
     - Wrap Width: (PST default cols)
   
   - **ANSI Green**
     - Transmit BG: Dark gray (#2D2D2D)
     - Transmit FG: Lime green (#00FF00)
     - Receive BG: Black (#000000)
     - Receive FG: Lime green (#00FF00)
     - Terminal Size: 80x24
     - Wrap Width: 80 columns
   
   - **ANSI Amber**
     - Transmit BG: Dark brown (#1A1400)
     - Transmit FG: Amber (#FFB000)
     - Receive BG: Black (#000000)
     - Receive FG: Amber (#FFB000)
     - Terminal Size: 80x24
     - Wrap Width: 80 columns

3. **Custom Theme Creation:**
   - Start from any existing theme (built-in or custom)
   - Modify individual colors via color pickers
   - Set terminal dimensions (width x height)
   - Set wrap width in columns
   - Save with new name
   - Custom themes can be deleted

**Theme Editor Fields:**
- Name: [_______________]
- Transmit BG: [color] [Choose...]
- Transmit FG: [color] [Choose...]
- Receive BG: [color] [Choose...]
- Receive FG: [color] [Choose...]
- Terminal Width: [80] columns
- Terminal Height: [24] rows
- Default Wrap: [80] columns

**Size and Display Section:**
   
5. **Font Size**
   - Default: 8 point
   - Dropdown with sizes: 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36
   
6. **Wrap Text To**
   - Dropdown: "Pane" or "Page"
   - Controls text wrapping behavior
   
7. **Page Width (characters)**
   - Default: 32
   - Editable text field
   - Defines page width when wrap mode is "Page"
   
8. **Max Buffer Size (lines)**
   - Default: 1024
   - Dropdown with powers of 2: 256, 512, 1024, 2048, 4096, 8192
   - Controls scrollback buffer size
   
9. **Tab Size**
   - Default: 8
   - Editable field or spinner (range: 3-16)
   - Controls tab character width

**Notes:**
- PST had "Blink enable button when terminal is disabled" - removing as we don't have disable button
- Using Electron's native color picker for color selection
- Colors already defined in mainWindow.ts match PST defaults

#### Function Tab

**Two-column layout with two main sections:**

**1. Treat ASCII Control Characters As:**
Two columns of checkboxes (all enabled by default):

**Left Column:**
- [ ] 0 (NULL) - Clear screen
- [ ] 1 - Home cursor
- [ ] 2 - Position cursor (X,Y)
- [ ] 3 - Move cursor left
- [ ] 4 - Move cursor right
- [ ] 5 - Move cursor up
- [ ] 6 - Move cursor down
- [ ] 7 - Beep speaker
- [ ] 8 - Backspace
- [ ] 9 - Tab
- [ ] 10 - Line feed
- [ ] 11 - Clear to end of line

**Right Column:**
- [ ] 12 - Clear lines below
- [ ] 13 - New line (CR)
- [ ] 14 - Position cursor X
- [ ] 15 - Position cursor Y
- [ ] 16 - Clear screen (same as 0)

**2. Serial Port Selection:**
- "Serial ports appear according to port search preferences" [Edit Ports...] button
- [ ] Automatically close port when application is inactive (checkbox, default checked)
- [ ] Wait for busy port up to [10] seconds when re-enabling (checkbox + editable field, default checked)

**Bottom:**
- [Restore Defaults] button (bottom right)
- [OK] [Cancel] buttons

**Notes:**
- All ASCII control character checkboxes default to checked (enabled)
- These map to ANSI/ASCII control sequences for terminal emulation
- Port selection behavior may need adaptation for our use case

### Edit Ports Dialog

Accessed via [Edit Ports...] button in Function tab:

**Fixed Text:**
"The computer's available serial ports are updated automatically and will be listed in the order shown. (Ports excluded from the search appear in italics.)"

**Port List:**
- Scrollable list (2-3 lines visible by default)
- Initially empty - populated with discovered ports
- Shows all FTDI-based devices (Prop Plugs and clones)
- Excluded ports shown in italics
- Supports both genuine Parallax Prop Plugs and FTDI clones

**Port Management:**
- **Reorder**: Click and drag ports up/down to change search priority
- **Include/Exclude**: Double-click to toggle (or right-click menu)
  - Included ports: Normal text
  - Excluded ports: Italic text
- **Note**: Some FTDI clones use RTS instead of DTR for reset

**Buttons:**
- [Restore Defaults] - Clears all exclusions, resets to auto-detected order
- [Accept] - Saves changes
- [Cancel] - Discards changes

**Purpose:**
- Control which ports are scanned and in what order
- Exclude ports that shouldn't be used (other FTDI devices)
- Prioritize commonly used ports for faster connection

### Core Components

#### 1. Application Entry Point
**File**: `src/pnut-term-ts.ts`
- CLI interface using Commander.js
- Handles command-line argument parsing
- Creates and manages the application context
- Initializes main window

#### 2. Window Management System
**Primary Controller**: `src/classes/mainWindow.ts`
- Manages Electron BrowserWindow instances
- Factory pattern for creating debug windows
- Inter-window communication
- Application lifecycle management
- Minimal UI controls (DTR toggle, download to RAM/Flash)
- Houses the singleton WindowRouter for all message routing

**WindowRouter** (singleton within MainWindow):
- Centralized routing for all window types
- Dual protocol support (binary for debugger, text for DEBUG commands)
- Built-in recording/playback for regression testing
- Performance-critical: <1ms routing overhead
- Never blocks on logging operations

#### 3. Debug Window Architecture
**Base Class**: `src/classes/debugWindowBase.ts`

All debug windows extend this base class and must implement:
```typescript
abstract closeDebugWindow(): void;
abstract updateContent(lineParts: string[]): void;
```

**Implemented Windows**:
- `DebugTermWindow` - Terminal emulation with ANSI support
- `DebugLogicWindow` - Logic analyzer with trigger support
- `DebugScopeWindow` - Oscilloscope with trigger support
- `DebugScopeXYWindow` - XY oscilloscope with persistence modes
- `DebugPlotWindow` - 2D plotting with layers and sprites
- `DebugBitmapWindow` - Bitmap display with trace patterns
- `DebugMidiWindow` - MIDI visualization with piano keyboard
- `DebugFFTWindow` - FFT spectrum analyzer with line/bar/dot modes
- `DebugDebuggerWindow` - Full P2 interactive debugger with multi-COG support

#### 4. Hardware Communication Layer
**USB Serial**: `src/utils/usb.serial.ts`
- SerialPort library wrapper
- Device enumeration and selection
- Async data streaming
- Error handling and recovery

**Downloader**: `src/classes/downloader.ts`
- P2 binary file downloading
- RAM and FLASH programming
- Protocol implementation
- Progress tracking

#### 5. Shared Components (`src/classes/shared/`)

**Data Processing**:
- `PackedDataProcessor` - Handles 13 packed data modes
- `Spin2NumericParser` - Parses all Spin2 numeric formats
- `DisplaySpecParser` - Parses display specifications
- `TriggerProcessor` - Evaluates trigger conditions

**Rendering Support**:
- `CanvasRenderer` - HTML5 Canvas operations
- `LayerManager` - Bitmap layer management
- `SpriteManager` - Sprite transformations
- `ColorTranslator` - Color mode conversions

**Input Handling**:
- `InputForwarder` - Keyboard/mouse event forwarding
- `debugInputConstants` - PC_KEY/PC_MOUSE definitions

## Debugger Window Architecture

### Overview
The P2 Debugger Window provides comprehensive debugging capabilities for all 8 COGs (cores) of the Propeller 2 microcontroller. It implements a full interactive debugger with Pascal parity, matching the original PNut debugger exactly.

### Key Components

**Core Infrastructure**:
- `DebuggerProtocol` - Manages bidirectional P2 serial communication
- `DebuggerDataManager` - Caches COG/LUT/HUB memory with checksum-based change detection
- `DebuggerRenderer` - Renders 123x77 character grid UI with all regions
- `DebuggerInteraction` - Handles mouse/keyboard input with Pascal shortcuts
- `Disassembler` - Decodes P2 instructions with SKIP pattern support

**Multi-COG Support**:
- `MultiCogManager` - Coordinates multiple debugger windows (up to 8)
- `GlobalCogState` - Shared state for breakpoint coordination (RequestCOGBRK)
- Window cascading with configurable positioning
- Synchronized debugging operations across COGs

**Advanced Features**:
- `AdvancedDebuggerFeatures` - Heat maps, smart pins, HUB viewer
- Heat map visualization with decay rate of 2 (Pascal HitDecayRate)
- Smart pin monitoring for all 64 P2 I/O pins
- HUB memory viewer with mini-map navigation
- Call stack tracking (8 levels)
- Event and interrupt monitoring

### Dual Protocol Architecture

The debugger uniquely supports two simultaneous protocols:

1. **Binary Protocol** (Debugger-specific):
   - 20-long initial messages from P2
   - COG/LUT CRCs and HUB checksums
   - Memory block requests/responses
   - Routed by COG ID to specific windows

2. **Text Protocol** (DEBUG commands):
   - Standard DEBUG window commands
   - Coexists with binary protocol
   - WindowRouter handles discrimination

### Memory Management

**Efficient Caching Strategy**:
- COG: 64 blocks of 16 longs each
- LUT: 64 blocks of 16 longs each
- HUB: 124 blocks of 4KB with 128-byte sub-blocks
- Checksum-based change detection minimizes data transfer
- Fresh state on window open (no persistence between sessions)

### Performance Optimizations

- **Dirty Rectangle Rendering**: Only redraws changed regions
- **<1ms Routing**: WindowRouter ensures minimal latency
- **Heat Map Decay**: Efficient memory access pattern visualization
- **30+ FPS Updates**: Smooth scrolling and interaction

## Data Flow Architecture

### Serial Data Pipeline

```
P2 Device → USB Serial → Downloader → WindowRouter → Debug Windows
                ↓                          ↓
           File Watcher              Timestamped Log
           (Auto re-download)        (Regression Testing)
```

### Logging System Architecture

**Performance Requirements**:
- Logging must NEVER block window operations
- All P2 traffic logged with timestamps
- Parse errors preserved for debugging
- Buffered writes for efficiency

**Automatic Log Management**:
- New log file created on:
  - Every download operation
  - Every DTR/RTS reset
  - Manual "New Log" command
- Log naming convention: `YYYY-MM-DD-HHMMSS-binaryname.log`
  - Timestamp prefix for chronological ordering
  - Binary name suffix for context (without .binary extension)
  - Example: `2025-01-15-143022-myprogram.log`

**Log Files**:
- Location: Timestamped files in workspace
- Format: Raw P2 traffic with timestamps
- Usage: Regression testing, error analysis
- Parse errors: Logged with context for debugging
- First toolchain to provide automatic regression logging

### Debug Command Processing

1. **Raw Data Reception**:
   - Binary data arrives via USB serial
   - Downloader routes to appropriate handler

2. **Command Parsing**:
   - Debug strings parsed by window-specific parsers
   - Commands extracted with parameters
   - Numeric values parsed via Spin2NumericParser

3. **Data Processing**:
   - Packed data unpacked if needed
   - Values validated and transformed
   - State updated in window instance

4. **Rendering**:
   - Canvas operations queued
   - Double buffering for complex windows
   - Real-time updates for streaming data

## Event System

### EventEmitter Pattern
- USB serial events
- Window lifecycle events
- Debug command events
- User input events

### Key Event Flows

**Download Complete**:
```
Downloader.downloadComplete → MainWindow.switchToTerminal → DebugTermWindow.activate
```

**Debug Command Received**:
```
SerialData → Downloader.parseDebugString → Window.updateContent → Canvas.render
```

**User Input**:
```
DOM Event → InputForwarder.queue → SerialPort.write → P2 Device
```

## Memory Management

### Window Lifecycle
- Windows created on-demand from debug commands
- Persist until explicitly closed
- Resources cleaned up in `closeDebugWindow()`
- No state persistence between sessions

### Canvas Management
- Main canvas for display
- OffscreenCanvas for complex rendering
- Double buffering prevents flicker
- Memory limits for bitmap storage

## Performance Optimizations

### Real-time Data Handling
- Efficient packed data processing
- Streaming updates without blocking
- Batched canvas operations
- Debounced input events

### Resource Management
- Lazy window creation
- Canvas size limits
- Bitmap memory pooling
- Serial buffer management

## Security Considerations

### File System Access
- Limited to workspace and downloads
- No execution of downloaded code
- Path validation for file operations

### Serial Communication
- No remote access capability
- Local USB devices only
- User permission required

## Baud Rate Configuration

### Current Implementation Status
**Implemented Infrastructure**:
- Default download baud: 2000000 (2 Mbps)
- `UsbSerial.setCommBaudRate()` method available
- Context stores `debugBaudrate` value

**Not Yet Connected** (prototype status):
- `--debugbaud` CLI option defined but not wired up
- No runtime baud rate separate from download baud
- No UI baud rate selection implemented

### Planned Baud Rate Support
**Standard Baud Rates**:
- 9600, 19200, 38400, 57600, 115200
- 230400, 460800, 921600
- 1000000, 2000000

**Two-Speed Operation**:
1. **Download/Flash Baud**: 2000000 (default, configurable)
2. **Runtime Communication Baud**: 115200 (default, configurable)

## Command-Line Interface

### Current Options
- `-f, --flash <file>` - Download to FLASH and run
- `-r, --ram <file>` - Download to RAM and run
- `-b, --debugbaud {rate}` - Set debug baud rate (defined but not connected)
- `-p, --plug <device>` - Select PropPlug device
- `-n, --dvcnodes` - List available devices
- `-l, --log <basename>` - Log file basename
- `-d, --debug` - Enable debug messages
- `-v, --verbose` - Enable verbose output
- `-q, --quiet` - Quiet mode

### Planned Additions (Phase 0)
- `--ide` - IDE mode flag (minimal UI)
- `--runbaud {rate}` - Runtime communication baud rate
- Wire up existing `--debugbaud` option

## Extension Points

### Adding New Window Types
1. Extend `DebugWindowBase`
2. Implement required methods
3. Register in window factory
4. Add to debug display types

### Custom Data Processors
1. Create processor in shared/
2. Integrate with window class
3. Add unit tests
4. Update documentation

### Protocol Extensions


## Packaging and Distribution Architecture

### Overview
PNut-Term-TS uses a hybrid CLI/GUI architecture that requires careful packaging to support cross-platform distribution while maintaining native module support (particularly serialport).

### Application Startup Flow
```
1. CLI Entry Point (src/pnut-term-ts.ts)
   ↓ Parse command-line arguments
   ↓ Detect serial ports
   ↓ Validate options
   
2. Mode Detection
   ├─→ CLI-only mode (--help, --version, -n)
   │   └─→ Execute and exit
   │
   └─→ GUI mode (normal operation)
       ↓ Check for Electron availability
       ↓ app.whenReady()
       ↓ Create MainWindow
       ↓ Initialize debug windows
       └─→ Window placement system activates
```

### Packaging Approaches Evaluated

#### 1. Node.js SEA (Single Executable Applications) ❌
**Attempted**: Native Node.js SEA support (v19+ experimental, v21+ stable)
**Result**: Failed - Cannot handle external native modules
**Issues**:
- SEA can only bundle JavaScript code
- Native modules like serialport require .node binaries
- External dependencies not supported
- "Killed: 9" errors on macOS when attempting to load native modules

#### 2. Traditional Node.js Package ✅ (Partial)
**Approach**: Shell script launcher + bundled JavaScript
**Result**: Works for CLI mode only
**Limitations**:
- Requires system Node.js installation
- No Electron GUI support
- Cannot create debug windows (Task #89 requirement)

#### 3. Electron Application ✅ (Recommended)
**Approach**: Full Electron app with bundled Node.js runtime
**Result**: Complete success for all features
**Benefits**:
- Bundles Node.js runtime (no external dependencies)
- Native module support through Electron's build system
- Full GUI window management
- Cross-platform compatibility
- Professional .app bundle on macOS

### Platform-Specific Build Requirements

#### macOS
- **Build Location**: Must build on macOS (not Linux container)
- **Tools Required**: electron-builder, codesign
- **Output**: .app bundle, optionally DMG installer
- **Code Signing**: Developer ID recommended for distribution
```bash
npm run packageMac                    # Build Electron app
codesign --sign "Developer ID" *.app  # Sign for Gatekeeper
hdiutil create *.dmg                  # Create installer
```

#### Linux
- **Build Location**: Can build on any platform
- **Output**: AppImage, .deb, or .tar.gz
- **Native Modules**: Automatically handled by electron-builder

#### Windows
- **Build Location**: Best built on Windows
- **Output**: .exe installer or portable
- **Code Signing**: Authenticode certificate for SmartScreen

### Native Module Handling

The serialport module requires special handling:
1. **Prebuilds**: Platform-specific binaries in `prebuilds/`
2. **Electron Rebuild**: Must rebuild for Electron's Node.js version
3. **ASAR Unpacking**: Native modules excluded from ASAR archive

Configuration in `electron.builder.json`:
```json
{
  "asarUnpack": ["**\\*.{node,dll}"],
  "files": ["prebuilds/**/*"]
}
```

### Distribution Strategy

#### Development/Testing
```
Container (Linux) → Build TypeScript → Transfer to macOS → Package Electron → Test
```

#### Production Release
1. Build on target platform (macOS for .app, Windows for .exe)
2. Code sign with platform certificates
3. Create installer (DMG, MSI, etc.)
4. Distribute via GitHub releases or direct download

### Key Learnings

1. **Electron is Required**: Debug windows need Electron's window management
2. **Platform-Native Builds**: Must build on target OS for best results
3. **Native Modules Complexity**: Serialport adds significant packaging challenges
4. **SEA Limitations**: Node.js SEA not ready for production apps with native deps
5. **Dual-Mount Development**: Container development with macOS signing works well

### Future Improvements

1. **GitHub Actions**: Automate builds for all platforms
2. **Auto-Update**: Implement electron-updater for seamless updates
3. **Notarization**: Add Apple notarization for macOS Catalina+
4. **Snap/Flatpak**: Linux universal packages
5. **Homebrew Formula**: Easy macOS installation via brew

This packaging architecture ensures PNut-Term-TS can be distributed professionally across all platforms while maintaining full functionality including the critical debug window system.
1. Extend command parser
2. Add new packed data modes
3. Update documentation
4. Maintain Pascal parity