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
- **Provides multiple COG monitors** for multi-core debugging
- **Supports binary downloads** to the P2 for program execution

---

## Services Provided

### Real-Time Message Routing
- **Intelligent classification** of incoming serial data
- **Automatic routing** to appropriate visualization windows
- **Zero-copy architecture** for high-performance data handling
- **Message extraction** via autonomous worker thread

### Data Visualization
- **12 window types** for different data formats
- **Multi-COG monitoring** with 8 independent COG windows
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
- **Progress tracking** during downloads
- **Error detection** and recovery

---

## Feature List

### Core Features
- ✅ **Cross-Platform**: macOS (x64, ARM64), Windows, Linux
- ✅ **High-Speed Serial**: Up to 2\_000\_000 baud
- ✅ **Worker Thread Architecture**: Non-blocking USB processing
- ✅ **Zero-Copy Buffers**: SharedArrayBuffer for peak performance
- ✅ **DTR/RTS Control**: Hardware reset line support
- ✅ **Auto-Reconnect**: Handles device disconnection gracefully

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

### Performance Tracking
- ✅ **High Water Marks**: Buffer and pool usage peaks
- ✅ **Rate Tracking**: USB bytes/sec and messages/sec
- ✅ **Shutdown Statistics**: Complete session metrics
- ✅ **Full Capacity Alerts**: Immediate notification of limits

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
**Status**:  **Pending Final Implementation**

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
**Status**: ✅ **Fully Implemented**

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

**Open Binary File** (`Cmd/Ctrl+O`)
- Select .binary file for download to P2
- Opens file picker dialog

**Download to P2** (`Cmd/Ctrl+D`)
- Send previously loaded binary to P2 RAM
- Triggers download protocol sequence

**Save Log File** (`Cmd/Ctrl+S`)
- Save debug logger contents to file
- Preserves timestamps and formatting

**Preferences** (`Cmd/Ctrl+,`)
- Configure application settings with two tabs:
  - **User Settings**: Global preferences for all projects
  - **Project Settings**: Project-specific overrides with checkboxes
- Settings include: terminal mode, serial port, logging, recordings
- Settings files:
  - User global: `%APPDATA%\PNut-Term-TS\settings.json` (Win) or `~/.pnut-term-ts-settings.json` (Mac/Linux)
  - Project local: `./.pnut-term-ts-settings.json` in project directory
- See full documentation for detailed settings hierarchy

**Quit** (`Cmd/Ctrl+Q`)
- Exit application
- Logs final session statistics

---

### Edit Menu

**Copy** (`Cmd/Ctrl+C`)
- Copy selected text from active window

**Select All** (`Cmd/Ctrl+A`)
- Select all text in active window

**Find** (`Cmd/Ctrl+F`)
- Search within debug logger or terminal

**Clear Terminal** (`Cmd/Ctrl+K`)
- Clear main window blue terminal area

---

### Connection Menu

**Select Serial Port**
- Choose COM port / serial device
- Displays list of available ports

**Connect** (`Cmd/Ctrl+Shift+C`)
- Open selected serial port
- Start receiving debug data

**Disconnect** (`Cmd/Ctrl+Shift+D`)
- Close serial port connection
- Stop data reception

**Reconnect** (`Cmd/Ctrl+R`)
- Close and reopen current port
- Useful for recovering from errors

**DTR Reset** (`Cmd/Ctrl+Shift+R`)
- Toggle DTR line (hardware reset)
- Reboots P2 if DTR wired to RES pin

**RTS Reset**
- Toggle RTS line (alternative reset)
- Use if RTS wired to RES instead of DTR

---

### Understanding Connection Behavior

**Quick Decision Guide**: Does your P2 need to reset when you connect?

**How to Change**: File → Preferences (Ctrl/Cmd+,) → **User Settings** (or **Project Settings**) → Serial Port → "Reset P2 on Connection"

**Note**: Use User Settings for global preference across all projects, or Project Settings to override for specific projects.

#### ☑️ Enable "Reset on Connection" when:
- You're actively developing and testing code
- You want a clean start every time
- Previous P2 state doesn't matter
- **Result**: DTR toggles immediately → P2 resets → capture fresh output

#### ☐ Disable "Reset on Connection" when:
- P2 is already running something you want to observe
- You need to capture existing data stream
- You don't want to disturb the running program
- **Result**: No DTR toggle → P2 keeps running → capture immediately

**Default**: Enabled (traditional development mode)

**Note**: Setting persists - change it once for your preferred workflow.

#### 💡 Command-Line Downloads (`-R` RAM / `-F` Flash)
When launched from an IDE with download parameters:
- Connection behavior is automatic (ignores preference)
- DTR toggles only when download starts (not on port open)
- Ensures clean download protocol

**See Full User Guide** (Connection & Startup Behavior section) for detailed workflows and examples.

---

### Debug Menu

**Debug Logger** (`F2`)
- Open central debug logging window
- Shows all traffic with timestamps

**COG Windows** (`F3`-`F10`)
- F3: COG 0
- F4: COG 1
- F5: COG 2
- F6: COG 3
- F7: COG 4
- F8: COG 5
- F9: COG 6
- F10: COG 7

**Hide All Debug Windows** (`Cmd/Ctrl+Shift+H`)
- Close all open debug windows
- Clears window registry

---

### Window Menu

**Minimize** (`Cmd/Ctrl+M`)
- Minimize active window

**Zoom**
- Toggle window zoom state

**Bring All to Front**
- Raise all application windows

**Main Window**
- Focus main terminal window

**Window List**
- Shows all open windows
- Click to focus specific window

---

### Help Menu

**Documentation** (`F1`)
- Opens this help document
- Clickable table of contents
- Searchable content

**Debug Command Reference**
- Quick reference for backtick commands
- Window type keywords

**About PNut-Term-TS**
- Application version
- Build information
- Credits

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
- Auto-reconnect will attempt recovery
- Manual reconnect: `Cmd/Ctrl+R`
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
- **Issue Tracker**: Report bugs and request features
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

PNut-Term-TS can also be run from the command line:

### Installation
**macOS**: Add to PATH after installing the app:
```bash
export PATH="/Applications/PNut-Term-TS.app/Contents/Resources/bin:$PATH"
```

**Windows**: Add the installation directory to your PATH environment variable

**Linux**: The executable is in the bin directory of the extracted package

### Basic Commands
```bash
# Launch the GUI application
pnut-term-ts

# Connect to specific port at startup
pnut-term-ts --port /dev/tty.usbserial-1420 --baud 921600

# Enable verbose logging
pnut-term-ts --verbose

# Show help and available options
pnut-term-ts --help
```

### Advanced Options
- `--port <path>`: Serial port to connect on startup
- `--baud <rate>`: Baud rate (115200, 230400, 460800, 921600)
- `--dtr`: Use DTR for reset (default)
- `--rts`: Use RTS for reset instead of DTR
- `--verbose`: Enable verbose logging output
- `--quiet`: Suppress informational messages
- `--file <path>`: Load binary file for P2 download

---

**Last Updated**: 2025-11-05
**Version**: 0.5.0
