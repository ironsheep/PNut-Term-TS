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

## Why PNut-Term-TS is Essential

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
1. Extend command parser
2. Add new packed data modes
3. Update documentation
4. Maintain Pascal parity