# PNut-Term-TS Application Help

## Quick Start Guide

1. **Connect your Propeller 2** device via USB
2. **Launch PNut-Term-TS** from Applications (macOS), Start Menu (Windows), or command line
3. **Select your serial port** from the Connection menu
4. **Click Connect** or press `Cmd/Ctrl+Shift+C`
5. **Open Debug Logger** with `F2` to see all traffic
6. Your P2 debug messages will automatically route to appropriate windows!

## Introduction

**PNut-Term-TS** is a cross-platform debug terminal application for the Parallax Propeller 2 (P2) microcontroller. Built with Electron and TypeScript, it provides comprehensive debugging capabilities through multiple specialized visualization windows.

This application is the TypeScript reimplementation of the original Pascal-based PNut Terminal, maintaining 100% functional parity while adding modern cross-platform support for macOS, Windows, and Linux.

---

## What Does the App Do

PNut-Term-TS serves as a **real-time debugging interface** between your computer and the Propeller 2 chip. It:

- **Captures and displays** serial debug output from the P2
- **Routes messages** to appropriate debug windows based on content
- **Visualizes data** through specialized windows (logic analyzer, scope, FFT, etc.)
- **Logs all traffic** for analysis and troubleshooting
- **Provides multiple COG debuggers** for multi-core debugging
- **Supports binary downloads** to the P2 for program execution

---

## Services Provided

### Real-Time Message Routing
- **Intelligent classification** of incoming serial data
- **Automatic routing** to appropriate visualization windows
- **Zero-copy architecture** for high-performance data handling
- **Message extraction** via autonomous worker thread

### Data Visualization
- **10 window types** for different data formats
- **Multi-COG debugging** with 8 independent COG windows
- **Live updates** at full USB speed (up to 2\_000\_000 baud)
- **Synchronized displays** across multiple windows

### Debug Logging
- **Complete traffic logging** to timestamped files
- **TX/RX separation** with clear visual indicators
- **Configurable scrollback** buffer
- **Session markers** for P2 reboot events

### Binary Download
- **Fast binary transfer** to P2 RAM or flash
- **Automatic protocol handling** for download sequences

---

## Feature List

### Core Features
- ✅ **Cross-Platform**: macOS (x64, ARM64), Windows, Linux
- ✅ **High-Speed Serial**: Up to 2\_000\_000 baud
- ✅ **Worker Thread Architecture**: Non-blocking USB processing
- ✅ **Zero-Copy Buffers**: SharedArrayBuffer for peak performance
- ✅ **DTR/RTS Control**: Hardware reset line support

### Debug Windows
- ✅ **Debug Logger**: All traffic with timestamps and TX/RX indicators
- ✅ **COG Windows** (0-7): Individual COG state monitoring
- ✅ **Debugger Windows** (0-7): single-step debugger
- ✅ **Logic Analyzer**: 16-channel digital waveform display
- ✅ **Oscilloscope**: Analog waveform visualization
- ✅ **XY Scope**: Phase and trajectory plotting
- ✅ **FFT Analyzer**: Frequency spectrum analysis
- ✅ **Spectrogram**: Time-frequency waterfall display
- ✅ **Plot Window**: Multi-channel data plotting
- ✅ **Terminal Window**: Text-based debug output
- ✅ **Bitmap Display**: Graphical bitmap rendering
- ✅ **MIDI Display**: MIDI message visualization

---

## Supported Windows (Current State)

### 1. Debug Logger Window
**Status**: ✅ **Fully Implemented**

**Purpose**: Central logging window for all serial traffic

**Features**:
- Complete message logging with timestamps
- TX (transmitted) messages marked with `[TX]` prefix
- Control characters shown as `<cr>`, `<lf>` notation
- Configurable scrollback buffer (default: 10,000 lines)
- Session markers for P2 reboots (golden sync points)
- Color-coded message types

**Backtick Window Messages**: All backtick window commands are logged here for visibility

---

### 2. COG Windows (COG0 through COG7)
**Status**: ✅ **Fully Implemented**

**Purpose**: Monitor individual COG states during execution

**Features**:
- Independent window for each of 8 COGs
- Display COG-specific messages (format: `Cog[0-7]  <message>`)
- Optional - windows only created if user opens them
- Silent drop if COG messages arrive without window open
- P2 System Init messages route to COG0 window

**Message Format**:
```
Cog0  INIT $0000_0000 $0000_0000 load
Cog1  STATUS: Running
Cog2  Counter: 1234
```

---

### 3. Debugger Windows (Debugger 0-7)
**Status**: 🔴 **NOT ready for Use!**

**Purpose**: Display single-step debugger for each COG

**Features**:
- Auto-create on first debugger packet arrival
- Display processor state data in structured format
- One window per COG (0-7)

---

### 4. Logic Analyzer Window
**Status**: ✅ **Fully Implemented**

**Purpose**: 16-channel digital waveform display

**Backtick Command**:
```
`logic <name> <bits> <samples> ...
`<name> <data> ...  (updates)
```

**Features**:
- 16-channel digital display
- Horizontal timeline with zoom
- Vertical channel labels
- Color-coded signal transitions

---

### 5. Oscilloscope Window
**Status**: ✅ **Fully Implemented**

**Purpose**: Analog waveform visualization

**Backtick Command**:
```
`scope <name> <channels> <samples> ...
`<name> <data> ...  (updates)
```

**Features**:
- Multi-channel analog display
- Automatic scaling
- Trigger controls
- Timebase adjustment

---

### 6. XY Scope Window
**Status**: ✅ **Fully Implemented**

**Purpose**: Two-channel XY phase plotting

**Backtick Command**:
```
`scope_xy <name> <samples> ...
`<name> <x> <y> ...  (updates)
```

**Features**:
- Lissajous patterns
- Phase relationships
- Trajectory plotting

---

### 7. FFT Analyzer Window
**Status**: ✅ **Fully Implemented** (*noise floor display issue*)

**Purpose**: Frequency spectrum analysis

**Backtick Command**:
```
`fft <name> <bins> <sample_rate> ...
`<name> <data> ...  (updates)
```

**Features**:
- Frequency domain display
- Peak detection
- Logarithmic/linear scales
- **Note**: Infrastructure fixes applied for window creation and routing

---

### 8. Spectrogram Window
**Status**: ✅ **Fully Implemented**

**Purpose**: Time-frequency waterfall display

**Backtick Command**:
```
`spectro <name> <bins> <time_slices> ...
`<name> <data> ...  (updates)
```

**Features**:
- Waterfall display
- Color-coded intensity
- Time evolution of spectrum
- **Note**: Window creation pattern updated to match working windows

---

### 9. Plot Window
**Status**: ✅ **Fully Implemented**

**Purpose**: Multi-channel data plotting

**Backtick Command**:
```
`plot <name> <channels> <samples> ...
`<name> <data> ...  (updates)
```

**Features**:
- Multiple data series
- Automatic scaling
- Legend display

---

### 10. Terminal Window
**Status**: ✅ **Fully Implemented**

**Purpose**: Text-based debug output

**Backtick Command**:
```
`term <name> <rows> <cols>
`<name> <text> ...  (updates)
```

**Features**:
- Scrolling text display
- ANSI color support (if implemented)
- Configurable dimensions

---

### 11. Bitmap Display Window
**Status**: ✅ **Fully Implemented**

**Purpose**: Graphical bitmap rendering

**Backtick Command**:
```
`bitmap <name> <width> <height> <format>
`<name> <pixel_data> ...  (updates)
```

**Features**:
- Multiple pixel formats
- Scaling and zoom
- Real-time updates

---

### 12. MIDI Display Window
**Status**: ✅ **Fully Implemented**

**Purpose**: MIDI message visualization

**Backtick Command**:
```
`midi <name>
`<name> <midi_bytes> ...  (updates)
```

**Features**:
- MIDI message decoding
- Note on/off visualization
- Control change display
- **Note**: Fixed message routing and canvas rendering issues

---

## Menus and Usage

### File Menu

**New Recording**
- Start a new recording session
- Clears any existing recording buffer

**Open Recording...**
- Load a previously saved .p2rec recording file
- Opens file picker dialog

**Save Recording As...**
- Save current recording buffer to .p2rec file
- Opens file save dialog

**Start Recording** (`Ctrl/Cmd+R`)
- Begin capturing all serial traffic to recording buffer
- Recording indicator shows "Recording..." status

**Stop Recording**
- End current recording session
- Data remains in buffer until saved or cleared

**Playback Recording** (`Ctrl/Cmd+P`)
- Play back a loaded .p2rec recording
- Simulates real serial traffic with accurate timing

**Exit** (`Ctrl/Cmd+Q`)
- Exit application
- Logs final session statistics
- Prompts to save unsaved recordings

---

### Edit Menu

**Cut** (`Ctrl/Cmd+X`)
- Cut selected text to clipboard

**Copy** (`Ctrl/Cmd+C`)
- Copy selected text from active window

**Paste** (`Ctrl/Cmd+V`)
- Paste clipboard contents

**Find...** (`Ctrl/Cmd+F`)
- Search within debug logger or terminal
- Opens find dialog with search options

**Clear Terminal**
- Clear main window blue terminal area
- Does not affect debug logger

**Preferences...** (`Ctrl/Cmd+,`)
- Configure application settings with two tabs:
  - **User Settings**: Global preferences for all projects
  - **Project Settings**: Project-specific overrides with checkboxes
- Settings include: terminal mode, serial port, logging, recordings
- Settings files:
  - User global: `%APPDATA%\PNut-Term-TS\settings.json` (Win) or `~/.pnut-term-ts-settings.json` (Mac/Linux)
  - Project local: `./.pnut-term-ts-settings.json` in project directory
- See Preferences Settings section below for details

---

### Window Menu

**Performance Monitor**
- Open performance monitoring window
- Shows real-time metrics: throughput, buffer usage, queue depth
- Live sparkline graphs and statistics

**Cascade**
- Arrange all debug windows in cascading layout
- Overlapping windows with title bars visible

**Tile**
- Arrange all debug windows in tiled grid layout
- Non-overlapping, maximizes screen space

**Show All Windows**
- Unhide and bring to front all debug windows
- Restores hidden windows

**Hide All Windows**
- Hide all debug windows
- Useful for decluttering workspace
- Windows remain active, just not visible

---

### Help Menu

**Documentation** (`F1`)
- Opens this help document
- Clickable table of contents
- Searchable content

**About PNut-Term-TS**
- Application version information
- Build date and commit hash
- Platform and architecture details
- Runtime versions (Node.js, Chromium, Electron)

---

## Preferences Settings

Access via **Edit → Preferences** (`Ctrl/Cmd+,`)

### Settings Hierarchy

PNut-Term-TS uses a **3-tier cascading settings system**:

1. **Application Defaults** - Built-in baseline settings
2. **User Global Settings** - Your personal preferences across all projects
3. **Project Local Settings** - Project-specific overrides (optional)

**Effective Value** = Project Local **OR** User Global **OR** App Default (first non-empty value wins)

### Two-Tab Interface

#### User Settings Tab
- **Global preferences** that apply to all projects
- Saved to user profile directory
- Changes affect all projects unless overridden

#### Project Settings Tab
- **Project-specific overrides** using checkboxes
- Saved to `.pnut-term-ts-settings.json` in project directory
- Each setting has a checkbox to enable override
- Unchecked settings use User Global or App Default values
- Only enabled overrides are saved (delta-save strategy)

### Settings File Locations

**User Global Settings**:
- **Windows**: `%APPDATA%\PNut-Term-TS\settings.json`
- **macOS/Linux**: `~/.pnut-term-ts-settings.json`

**Project Local Settings** (optional):
- `./.pnut-term-ts-settings.json` in project directory
- Only created when you enable project-specific overrides

---

### Terminal Display Settings

**Terminal Mode**
- **Options**: Classic Terminal, Split View, Debug Only
- **Default**: Split View
- **Description**: Controls main window layout
  - **Classic Terminal**: Single terminal area (traditional mode)
  - **Split View**: Terminal + status panels side-by-side
  - **Debug Only**: Hides terminal, focuses on debug windows

**Color Theme**
- **Options**: Dark (Default), Light, High Contrast, Solarized
- **Default**: Dark
- **Description**: Color scheme for terminal and debug windows

**Font Size**
- **Range**: 10-24 pixels
- **Default**: 14px
- **Description**: Terminal and debug window text size

**Font Family**
- **Options**:
  - Consolas (Default on Windows)
  - Monaco (Default on macOS)
  - Courier New
  - Monospace
  - Source Code Pro
  - Fira Code
- **Default**: Platform-dependent
- **Description**: Monospace font for terminal output

**Show COG Prefixes**
- **Type**: Checkbox
- **Default**: Enabled
- **Description**: Display "Cog0", "Cog1" etc. prefixes in COG window messages

**Local Echo**
- **Type**: Checkbox
- **Default**: Disabled
- **Description**: Echo typed characters back to terminal (usually handled by P2)

---

### Serial Port Settings

**Control Line**
- **Options**: DTR (Default), RTS
- **Default**: DTR
- **Description**: Hardware control line used for P2 reset
  - **DTR**: Used by Parallax PropPlug devices
  - **RTS**: Used by some non-Parallax USB serial adapters

**Default Baud Rate**
- **Options**:
  - 115200
  - 230400
  - 460800
  - 921600
  - 2000000 (Default)
- **Default**: 2000000
- **Description**: Serial communication speed (must match P2 program)

**Reset P2 on Connection**
- **Type**: Checkbox
- **Default**: Enabled
- **Description**: Automatically toggle DTR/RTS when connecting to port
  - **Enabled**: P2 resets on connection (fresh start)
  - **Disabled**: Connect without reset (capture existing output)

---

### Logging Settings

**Log Directory**
- **Type**: Text path
- **Default**: `./logs/`
- **Description**: Directory for debug logger output files
  - Supports absolute paths or relative to project directory
  - Timestamped log files created per session

**Auto-Save Debug Logs**
- **Type**: Checkbox
- **Default**: Enabled
- **Description**: Automatically save debug logger output to timestamped files

**New Log File on DTR/RTS**
- **Type**: Checkbox
- **Default**: Enabled
- **Description**: Rotate to new log file when DTR/RTS reset detected
  - Creates session boundaries in log files
  - Each P2 reboot starts fresh log file

**Max Log File Size**
- **Options**:
  - 1 MB
  - 5 MB (Default)
  - 10 MB
  - 50 MB
  - Unlimited
- **Default**: 5 MB
- **Description**: Maximum size before log rotation
  - When exceeded, creates new timestamped log file
  - Prevents single files from growing indefinitely

**Enable USB Traffic Logging**
- **Type**: Checkbox
- **Default**: Disabled
- **Description**: Log raw USB serial traffic to separate file
  - Low-level debugging tool
  - Logs all bytes sent/received with timestamps
  - Separate from debug logger window

**USB Log Path**
- **Type**: Text path
- **Default**: `./logs/`
- **Description**: Directory for USB traffic logs (if enabled)

---

### Recording Settings

**Recordings Directory**
- **Type**: Text path
- **Default**: `./recordings/`
- **Description**: Directory for .p2rec recording files
  - Used by Save Recording As... dialog
  - Used by Open Recording... dialog

**Auto-Save Recordings**
- **Type**: Checkbox
- **Default**: Disabled
- **Description**: Automatically save recordings when stopped
  - Creates timestamped .p2rec files in recordings directory
  - No prompt for filename

**Recording Buffer Size**
- **Options**: 10 MB, 50 MB, 100 MB (Default), 500 MB, 1 GB
- **Default**: 100 MB
- **Description**: Maximum memory for recording buffer
  - When exceeded, oldest data is discarded (ring buffer)

---

### Using Project Settings Effectively

**When to Use User Settings**:
- Personal preferences (font, colors, theme)
- Default baud rate for your hardware
- Your preferred log directory structure
- Global workflow preferences

**When to Use Project Settings**:
- Project-specific baud rate (if different from your usual)
- Custom log directory for this project
- Special control line (RTS instead of DTR)
- Project-specific recording directory

**Example Workflow**:

1. **Set User Defaults** (one-time setup):
   - Terminal Mode: Split View
   - Font Size: 14px
   - Default Baud: 2000000
   - Log Directory: `~/Documents/P2Logs/`

2. **Override for Specific Project** (as needed):
   - Enable "Default Baud Rate" checkbox
   - Set to 115200 (this project uses slower baud)
   - Enable "Log Directory" checkbox
   - Set to `./project-logs/` (keep logs with project)

3. **Result**:
   - This project uses 115200 baud and `./project-logs/`
   - All other projects use 2000000 baud and `~/Documents/P2Logs/`
   - Font and theme remain consistent across all projects

**Delta-Save Strategy**: Only enabled checkboxes are saved to `.pnut-term-ts-settings.json`, keeping project files minimal and focused.

---

## Window Controls and Status Indicators

### Main Window

#### Connection Status Indicator
**Location**: Top-left corner

**States**:
- 🔴 **Red**: Disconnected
- 🟢 **Green**: Connected and receiving data
- 🟡 **Yellow**: Connected but no recent data

#### Control Buttons

**Connect/Disconnect**
- Toggle serial port connection
- Shows current connection state

**DTR Button**
- Toggle DTR control line
- Used for hardware reset
- Indicator shows current state (ON/OFF)

**RTS Button**
- Toggle RTS control line
- Alternative reset mechanism
- Indicator shows current state (ON/OFF)

**Baud Rate Selector**
- Dropdown menu: 115200, 230400, 460800, 921600
- Changes take effect on next connect

#### Terminal Display Area (Blue Window)
**Location**: Bottom section of main window

**Purpose**: Displays user program output (not debug messages)

**Content**:
- Terminal output classified as `TERMINAL_OUTPUT`
- Invalid COG messages that don't match pattern
- User `print()` statements
- **NOT backtick window commands** (those route to specific windows)

---

## Debug Logger Window Controls

### Header Controls

**Scrollback Limit Indicator**
- Shows current buffer size (e.g., "10,000 lines")
- Configurable in Preferences

**Auto-Scroll Toggle**
- Enable/disable automatic scrolling
- When ON: always shows latest messages
- When OFF: manual scroll to review history

**Search Box**
- Filter messages by keyword
- Highlights matching lines
- Case-sensitive option

### Status Indicators

**Message Count**
- Total messages logged this session
- Resets on clear or new session

**Session Marker**
- `[GOLDEN SYNC]` indicates P2 reboot
- Triggers log rotation
- Marks session boundaries

**TX/RX Indicators**
- `[TX]` prefix: Transmitted to P2
- `[RX]` prefix: Received from P2 (rarely shown, most are unmarked RX)
- Control chars: `<cr>`, `<lf>` notation

### Message Colors

- **Blue**: User terminal output
- **Green**: COG messages
- **Yellow**: Window commands (backtick)
- **Red**: Errors and warnings
- **Gray**: Timestamps

---

## COG Window Controls

### Window Title
- Shows COG number (e.g., "COG 3 Debug")
- Updates dynamically with message count

### Message Display
- **Format**: `Cog<N>  <message content>`
- **Timestamp**: Each message has receive time
- **Auto-scroll**: Follows latest COG activity

### Status Indicators

**Activity Indicator**
- 🟢 **Green dot**: COG recently active (< 1 second)
- 🟡 **Yellow dot**: COG idle (1-5 seconds)
- ⚫ **Gray dot**: COG inactive (> 5 seconds)

**Message Counter**
- Total messages from this COG
- Resets on window close or session restart

### Special Messages

**P2_SYSTEM_INIT** (COG0 only)
- Message: `Cog0 INIT $0000_0000 $0000_0000 load`
- Prefix: `[GOLDEN SYNC]`
- Triggers complete system synchronization
- Clears all debug windows
- Rotates log files

### Controls

**Clear Buffer**
- Erases all messages in window
- Preserves message counter

**Save to File**
- Export COG messages to text file
- Includes timestamps

**Close Window**
- Closes COG window
- Messages still logged to Debug Logger
- Can reopen with F3-F10 keys

---

## Backtick Window Creation vs. Update

### Window Creation Commands
**Pattern**: `` `<type_keyword> <window_name> <parameters>``

**Type Keywords**:
- `logic` - Logic Analyzer
- `scope` - Oscilloscope
- `scope_xy` - XY Scope
- `fft` - FFT Analyzer
- `spectro` - Spectrogram
- `plot` - Plot Window
- `term` - Terminal Window
- `bitmap` - Bitmap Display
- `midi` - MIDI Display

**Example**:
```
`logic SIGNAL_BUS 16 1000
```
Creates window named "SIGNAL_BUS" with 16 channels, 1000 samples

---

### Window Update Commands
**Pattern**: `` `<window_name> <data>``

**User-Defined Names**:
- Any name NOT matching type keywords
- Routes to existing window by name
- **Error if window doesn't exist**

**Examples**:
```
`j k l $FFB7        (updates window named "j")
`SIGNAL_BUS $FFFF   (updates previously created "SIGNAL_BUS")
`my_scope 123 456   (updates window named "my_scope")
```

**Important**: Update commands must match window name exactly (case-sensitive)

---

## Troubleshooting

### No Data Appearing
1. Check connection status (green indicator)
2. Verify correct serial port selected
3. Check baud rate matches P2 program
4. Try DTR/RTS reset
5. Check USB cable connection

### Messages in Wrong Window
- Backtick window updates require exact name match
- COG messages need `Cog[0-7]  ` format (note: TWO spaces)
- Check Debug Logger to see raw messages

### Window Won't Open
- Check Window menu for existing instance
- Try "Hide All Debug Windows" then reopen
- Restart application if persistent

### Performance Issues
- Check high water mark statistics (logged on shutdown)
- Reduce debug output frequency from P2
- Increase scrollback limit if messages dropping

### Connection Lost
- Check for USB power issues
- Verify P2 is powered and running

---

## Keyboard Shortcuts Reference

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| **File** |||
| Open Binary | `Cmd+O` | `Ctrl+O` |
| Download to P2 | `Cmd+D` | `Ctrl+D` |
| Save Log | `Cmd+S` | `Ctrl+S` |
| Preferences | `Cmd+,` | `Ctrl+,` |
| Quit | `Cmd+Q` | `Ctrl+Q` |
| **Edit** |||
| Copy | `Cmd+C` | `Ctrl+C` |
| Select All | `Cmd+A` | `Ctrl+A` |
| Find | `Cmd+F` | `Ctrl+F` |
| Clear Terminal | `Cmd+K` | `Ctrl+K` |
| **Connection** |||
| Connect | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| Disconnect | `Cmd+Shift+D` | `Ctrl+Shift+D` |
| Reconnect | `Cmd+R` | `Ctrl+R` |
| DTR Reset | `Cmd+Shift+R` | `Ctrl+Shift+R` |
| **Debug** |||
| Debug Logger | `F2` | `F2` |
| COG 0 | `F3` | `F3` |
| COG 1 | `F4` | `F4` |
| COG 2 | `F5` | `F5` |
| COG 3 | `F6` | `F6` |
| COG 4 | `F7` | `F7` |
| COG 5 | `F8` | `F8` |
| COG 6 | `F9` | `F9` |
| COG 7 | `F10` | `F10` |
| Hide All Windows | `Cmd+Shift+H` | `Ctrl+Shift+H` |
| **Help** |||
| Documentation | `F1` | `F1` |

---

## Getting Help

### Online Resources
- **GitHub Repository**: [PNut-Term-TS](https://github.com/parallaxinc/PNut-Term-TS)
- **Issue Tracker**: Report bugs and request features at our [issues](https://github.com/parallaxinc/PNut-Term-TS/issues) page
- **Parallax Forums**: Community support and discussion

### Version Information
Check **Help → About** for:

- Current version number
- Build date and commit
- Platform and architecture

### Log Files
Debug logs stored in:

- **macOS**: `~/Library/Logs/PNut-Term-TS/`
- **Windows**: `%APPDATA%\PNut-Term-TS\logs\`
- **Linux**: `~/.config/PNut-Term-TS/logs/`

Attach relevant log files when reporting issues.

---

## Command-Line Usage

PNut-Term-TS can be launched from the command line. For complete command-line documentation, run:

```bash
pnut-term-ts --help
```

### Quick Examples
```bash
# Launch GUI (auto-detects USB device if only one connected)
pnut-term-ts

# Download to RAM and run
pnut-term-ts -r myprogram.bin

# IDE mode for VSCode integration
pnut-term-ts --ide -p P9cektn7

# List available USB devices
pnut-term-ts -n
```

See the **User Guide** for detailed command-line reference and examples.

---

**Last Updated**: 2025-11-08

**Version**: 0.9.0
