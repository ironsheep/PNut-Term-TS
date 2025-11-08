# PNut-Term-TS User Guide

*Version 0.9.0 - November 2025*

## Table of Contents
1. [Introduction](#introduction)
2. [Installation & Setup](#installation--setup)
3. [Getting Started](#getting-started)
4. [Menu Structure](#menu-structure)
5. [Dialog Windows](#dialog-windows)
6. [Settings & Preferences](#settings--preferences)
7. [Connection & Startup Behavior](#connection--startup-behavior)
8. [Recording & Playback](#recording--playback)
9. [Debug Windows Overview](#debug-windows-overview)
10. [Terminal Window](#terminal-window)
11. [Logic Analyzer](#logic-analyzer)
12. [Oscilloscope](#oscilloscope)
13. [XY Scope](#xy-scope)
14. [Plot Window](#plot-window)
15. [Bitmap Display](#bitmap-display)
16. [MIDI Monitor](#midi-monitor)
17. [FFT Analyzer](#fft-analyzer)
18. [SPECTRO (Spectrogram/Waterfall Display)](#spectro-spectrogramwaterfall-display)
19. [P2 Debugger](#p2-debugger)
20. [Keyboard Shortcuts](#keyboard-shortcuts)
21. [Troubleshooting](#troubleshooting)
22. [Command-Line Reference](#command-line-reference)
23. [Automation and External Control](#automation-and-external-control)
24. [Advanced Topics](#advanced-topics)
    - [Custom Window Layouts](#custom-window-layouts)
    - [Scripting](#scripting)
    - [Serial Communication Architecture](#serial-communication-architecture)
    - [Performance Tuning](#performance-tuning)
    - [Integration](#integration)
25. [Tips & Best Practices](#tips--best-practices)

---

## Introduction

PNut-Term-TS is a comprehensive debugging environment for the Parallax Propeller 2 (P2) microcontroller. It provides real-time visualization, interactive debugging, and session recording capabilities through specialized windows that interpret DEBUG commands from your P2 programs.

### Key Features
- **9 specialized debug windows** for different data visualization needs
- **Real-time data streaming** at up to 2 Mbps (2,000,000 baud)
- **Binary recording system** for capturing and replaying debug sessions
- **Performance monitoring** with live metrics and sparkline graphs
- **Interactive P2 debugger** with breakpoints and memory inspection (future release)
- **Customizable preferences** with user/project hierarchy
- **Cross-platform support** (Windows, macOS, Linux)

---

## Installation & Setup

### System Requirements
- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 20.04+)
- **RAM**: 4GB minimum, 8GB recommended for multiple windows
- **Display**: 1920x1080 minimum resolution
- **USB**: USB 2.0 or higher for P2 connection

### Installation

#### Windows
```bash
# Download the latest release
curl -L https://github.com/parallaxinc/pnut-term-ts/releases/latest/download/pnut-term-win-x64.zip -o pnut-term-win.zip

# Extract and run
unzip pnut-term-win.zip
cd pnut-term-win-x64
./pnut-term-ts.exe
```

#### macOS
```bash
# Download the latest release
curl -L https://github.com/parallaxinc/pnut-term-ts/releases/latest/download/pnut-term-mac-x64.zip -o pnut-term-mac.zip

# Extract and install
unzip pnut-term-mac.zip
# Run the SETUP.command script to add to PATH
cd pnut-term-mac-x64
./SETUP.command

# Launch from Terminal
pnut-term-ts
```

#### Linux
```bash
# Download the latest release
curl -L https://github.com/parallaxinc/pnut-term-ts/releases/latest/download/pnut-term-linux-x64.zip -o pnut-term-linux.zip

# Extract and run
unzip pnut-term-linux.zip
cd pnut-term-linux-x64
./pnut-term-ts
```

### First Run Setup

1. **Connect your P2**: Plug in your Propeller 2 board via USB
2. **Auto-detect port**: If only one USB serial device is connected, it will be auto-selected
3. **Manual port selection**: Use `-p <device>` flag or `-n` to list available ports
4. **Set baud rate**: Default is 2,000,000 baud (2 Mbps), change with `-b` flag or in Preferences
5. **DTR/RTS control**: Toggle DTR or RTS to reset the P2 if needed (toolbar buttons)

---

## Getting Started

### Basic P2 Program with DEBUG

Here's a simple P2 program that demonstrates debug output:

```spin2
PUB main() | value
  debug(`term MyTerminal size 80 40 textsize 12`)  ' Create terminal window

  repeat
    value++
    debug(`term MyTerminal print "Count: ", dec(value), 13`)
    waitms(100)
```

### Opening Debug Windows

Debug windows open automatically when your P2 program sends the appropriate DEBUG commands:

```spin2
' Open different window types
debug(`scope MyScope size 400 300 samples 1000`)      ' Oscilloscope
debug(`logic MyLogic size 600 200 samples 8192`)      ' Logic analyzer
debug(`plot MyPlot size 500 500 polar`)               ' Plot window
debug(`bitmap MyBitmap size 320 240 lut8`)            ' Bitmap display
debug(`fft MyFFT size 512 rate 44100`)                ' FFT analyzer
debug(`midi MyMIDI`)                                  ' MIDI monitor
```

**Important**: Debug windows cannot be opened manually from the application menu. They appear automatically when your P2 code sends matching DEBUG commands.

---

## Menu Structure

The application menu provides access to recording, preferences, and window management:

### File Menu
- **New Recording** - Start a new debug session recording
- **Open Recording...** - Load and playback a .p2rec file
- **Save Recording As...** - Save current recording to disk
- **─────────────**
- **Start Recording** (Ctrl/Cmd+R) - Begin recording debug data
- **Stop Recording** - End current recording session
- **Playback Recording** (Ctrl/Cmd+P) - Play selected recording
- **─────────────**
- **Exit** (Ctrl/Cmd+Q) - Close the application

### Edit Menu
- **Cut** (Ctrl/Cmd+X) - Cut selected text
- **Copy** (Ctrl/Cmd+C) - Copy selected text
- **Paste** (Ctrl/Cmd+V) - Paste from clipboard
- **─────────────**
- **Find...** (Ctrl/Cmd+F) - Search in terminal output
- **Clear Terminal** - Clear terminal display
- **─────────────**
- **Preferences...** (Ctrl/Cmd+,) - Open settings dialog

### Window Menu
- **Performance Monitor** - Open performance metrics window
- **─────────────**
- **Cascade** - Arrange windows in cascade layout
- **Tile** - Tile all windows in grid layout
- **─────────────**
- **Show All Windows** - Make all windows visible
- **Hide All Windows** - Hide all debug windows

### Help Menu
- **Documentation** (F1) - Open this user guide
- **─────────────**
- **About PNut-Term-TS** - Version and copyright information

> **Note**: Debug windows (Terminal, Logic, Scope, etc.) are not in the menu. They open automatically from P2 DEBUG commands.

---

## Dialog Windows

### Preferences Dialog (Edit → Preferences)

The Preferences dialog provides comprehensive control over terminal behavior with a two-tab interface:

#### User Settings Tab
Global preferences that apply to all projects. Saved to:
- **Windows**: `%APPDATA%\PNut-Term-TS\settings.json`
- **macOS/Linux**: `~/.pnut-term-ts-settings.json`

#### Project Settings Tab
Project-specific overrides using checkboxes. Saved to:
- `./.pnut-term-ts-settings.json` in your project directory
- Only enabled overrides are saved (delta-save strategy)

#### Terminal Settings
- **Terminal Mode**: Classic Terminal, Split View, or Debug Only
- **Color Theme**: Dark (default), Light, High Contrast, Solarized
- **Font Size**: 10-24 pixels (default: 14px)
- **Font Family**: Consolas (Win), Monaco (Mac), Courier New, Monospace, Source Code Pro, Fira Code
- **Show COG Prefixes**: Display "Cog0", "Cog1" etc. in messages
- **Local Echo**: Echo typed characters locally (usually handled by P2)

#### Serial Port Settings
- **Control Line**: DTR (default for Parallax Prop Plug) or RTS (some USB adapters)
- **Default Baud Rate**: 115200, 230400, 460800, 921600, or 2000000 (default: 2000000)
- **Reset P2 on Connection**: Automatically toggle DTR/RTS when connecting
  - **Enabled**: P2 resets on connection (fresh start for development)
  - **Disabled**: Connect without reset (capture existing output)

#### Logging Settings
- **Log Directory**: Where debug logger files are saved (default: `./logs/`)
- **Auto-Save Debug Logs**: Automatically save to timestamped files
- **New Log on DTR/RTS**: Rotate to new file on reset (session boundaries)
- **Max Log Size**: 1MB, 5MB (default), 10MB, 50MB, or Unlimited
- **Enable USB Traffic Logging**: Log raw USB serial traffic (low-level debugging)
- **USB Log Path**: Directory for USB traffic logs (default: `./logs/`)

#### Recording Settings
- **Recordings Directory**: Where .p2rec files are saved (default: `./recordings/`)
- **Auto-Save Recordings**: Automatically save when stopped (no filename prompt)
- **Recording Buffer Size**: 10MB, 50MB, 100MB (default), 500MB, 1GB

### Performance Monitor (Window → Performance Monitor)

The Performance Monitor provides real-time system metrics with visual feedback:

#### Live Metrics Panel
- **Throughput Graph**: 50-sample sparkline showing data rate over time (auto-scaling)
- **Buffer Usage**: Visual percentage bar of circular buffer utilization
- **Queue Depth**: Number of messages waiting for processing across all windows
- **Status Indicator**: System health at a glance
  - ✓ Normal operation (green)
  - ⚠ Warning state (yellow)
  - ✗ Error condition (red)

#### Buffer Details
- **Buffer Size**: Total buffer capacity (default: 64KB)
- **Used/Available**: Current usage statistics in real-time
- **High Water Mark**: Maximum usage reached this session
- **Overflow Events**: Count of data loss events (buffer full)

#### Message Routing
- **Total Messages**: Cumulative message count processed
- **Messages/sec**: Current throughput rate
- **Recording Status**: Active/Inactive with current recording size
- **Parse Errors**: Count of malformed messages

#### Active Windows
Lists all open debug windows with their individual queue depths. Scrollable list (max 150px height) helps identify processing bottlenecks.

#### Controls
- **Clear Stats**: Reset counters (preserves high water marks and current state)
- **Auto-Refresh**: Toggle 100ms update interval

---

## Settings & Preferences

PNut-Term uses a hierarchical settings system that allows you to have global preferences for all projects while also overriding specific settings for individual projects.

### Settings Hierarchy

**3-Tier Cascading System**:
1. **Application Defaults** - Built-in baseline settings
2. **User Global Settings** - Your personal preferences across all projects
3. **Project Local Settings** - Project-specific overrides (optional)

**Effective Value** = Project Local **OR** User Global **OR** App Default (first non-empty value wins)

### Opening Preferences

**Menu**: Edit → Preferences
**Keyboard Shortcut**: Ctrl/Cmd+,

The Preferences dialog has two tabs:
- **User Settings**: Global settings that apply to all projects
- **Project Settings**: Project-specific overrides with checkboxes

### User Settings Tab

User Settings are global preferences that apply across all your P2 projects. Changes here affect all projects unless overridden.

**Available Settings** (see Dialog Windows section above for complete details):

- Terminal display (mode, theme, fonts)
- Serial port configuration (baud, control line, reset behavior)
- Logging paths and rotation settings
- Recording directories and buffer sizes

### Project Settings Tab

Project Settings allow you to override specific settings for individual projects using checkboxes:

- Each setting has a **checkbox to enable override**
- Unchecked settings use User Global or App Default values
- **Only enabled overrides are saved** (delta-save strategy)
- Keeps project files minimal and focused

**Example Use Case**:
- **User Default**: 2000000 baud, `~/Documents/P2Logs/`
- **Project Override**: Check "Default Baud Rate" → Set to 115200 (slower project)
- **Project Override**: Check "Log Directory" → Set to `./project-logs/` (logs with project)
- **Result**: This project uses 115200 and `./project-logs/`, all others use 2000000 and `~/Documents/P2Logs/`

### Delta-Save Strategy

Only enabled checkboxes are saved to `.pnut-term-ts-settings.json`, keeping project files minimal:

```json
{
  "serialPort": {
    "defaultBaud": 115200
  },
  "logging": {
    "logDirectory": "./project-logs/"
  }
}
```

All other settings cascade from User Global Settings.

---

## Connection & Startup Behavior

Understanding how the terminal handles connections and resets is important for effective debugging workflows. The P2 Debug Terminal supports two primary use cases, each requiring different startup behavior.

### The Two Primary Workflows

#### Workflow 1: Passive Monitoring (Non-Intrusive Debugging)

**Use Case**: Your P2 is already running a program and sending debug data. You want to capture and view this data stream without interrupting the running program.

**Example Scenarios**:
- Observing a long-running test or data collection program
- Capturing diagnostic output from a deployed system
- Monitoring real-time sensor data without causing a reset
- Debugging timing-sensitive code where a reset would lose state

**Setting**: Disable "Reset P2 on Connection" in preferences

**What Happens**:
1. You launch the terminal and select the COM port
2. The port opens without toggling DTR (no hardware reset)
3. The P2 continues running its current program undisturbed
4. You immediately begin receiving and displaying any debug output
5. The running program's state remains intact

**When to Use**: When you need to observe what's already happening without disrupting it. This is particularly valuable for:
- Production debugging (observing live systems)
- Time-series data collection
- Situations where program state must be preserved

---

#### Workflow 2: Active Development (Reset and Load)

**Use Case**: You're actively developing code, making changes, and want to download fresh code to the P2 for testing.

**Example Scenarios**:
- Writing new P2 code and testing iteratively
- Debugging a specific issue that requires code modifications
- Starting a program from a known clean state
- Running automated test sequences

**Setting**: Enable "Reset P2 on Connection" in preferences

**What Happens**:
1. You launch the terminal and select the COM port
2. The port opens and immediately toggles DTR (triggers hardware reset)
3. The P2 resets to a known clean state
4. You can then download new code via the GUI or observe the existing program restart
5. Debug output begins from the fresh start

**When to Use**: When you want guaranteed clean-slate execution. This is the traditional development workflow where:
- Each test run starts from reset
- Previous program state doesn't matter
- You're downloading new code to test
- Reproducible startup behavior is required

---

### Understanding the "Reset P2 on Connection" Preference

**Location**: Edit → Preferences → User Settings (or Project Settings) → Serial Port → "Reset P2 on Connection"

**To Change This Setting**:
1. Open the Preferences dialog (Edit → Preferences or Ctrl/Cmd+,)
2. Choose either **User Settings** tab (for all projects) or **Project Settings** tab (for this project only)
3. Look under the "Serial Port" section
4. Check or uncheck "Reset P2 on Connection"
5. Click "Apply" to save

For more details about User Settings vs. Project Settings, see [Settings & Preferences](#settings--preferences).

This single checkbox controls the fundamental behavior when connecting to your P2:

| Setting | DTR Toggled on Connect? | Data Capture Starts | Use Case |
|---------|-------------------------|---------------------|----------|
| ☑️ **Enabled** | Yes (immediate reset) | After reset | Active development, clean start |
| ☐ **Disabled** | No (no reset) | Immediately | Passive monitoring, observe running code |

**Default**: Enabled (traditional development mode)

**Note**: This setting persists across app restarts - you only need to change it once for your preferred workflow.

---

### Command-Line Mode (IDE Integration)

When the terminal is launched from an IDE (like Visual Studio Code) with download parameters (`-r` for RAM or `-f` for Flash), the startup behavior is **automatically controlled** regardless of your preference setting:

```bash
# Download to RAM
pnut-term-ts -r myprogram.binary

# Download to Flash
pnut-term-ts -f myprogram.binary
```

**Automatic Behavior**:
1. Port opens without resetting (ignores "Reset P2 on Connection" preference)
2. Any existing debug traffic is ignored
3. When download begins, DTR toggles to reset the P2 into bootloader mode
4. Code downloads cleanly
5. After download completes, debug output from the new program is captured

**Why This Works**: The download command needs precise control of the reset timing. Resetting on connection would interfere with the bootloader protocol, so the terminal delays the reset until the exact moment it's needed for download.

---

### Best Practices

**Choose "Reset on Connection" = Enabled when**:
- You're actively writing and testing code
- You want reproducible test runs
- Previous program state doesn't matter
- You're using the GUI to download code

**Choose "Reset on Connection" = Disabled when**:
- You need to observe a running program
- The P2 is in a specific state you need to preserve
- You're capturing data from a long-running process
- You want non-intrusive monitoring

**Command-Line Downloads**: Don't worry about the preference - it's automatically handled correctly.

---

### Technical Details: DTR and Hardware Reset

The P2 hardware reset is triggered by toggling the DTR (Data Terminal Ready) control line on the USB-serial connection:

- **DTR Toggle**: A 10ms pulse on the DTR line
- **Hardware Response**: The Parallax PropPlug or compatible adapter generates a 17µs reset pulse to the P2
- **Result**: The P2 resets, and the bootloader becomes active for ~17ms

Some USB-serial adapters use RTS (Request To Send) instead of DTR. The terminal supports both via the "Control Line" preference setting.

---

### Troubleshooting Connection Issues

**Problem**: "I enabled 'Reset on Connection' but my P2 doesn't reset"
- **Solution**: Your adapter might use RTS instead of DTR. Change "Control Line" to RTS in Preferences → Serial Port.

**Problem**: "My program keeps resetting when I just want to watch the output"
- **Solution**: Disable "Reset on Connection" in preferences.

**Problem**: "Command-line download doesn't work even though GUI download works"
- **Solution**: Command-line mode uses different timing. Ensure you're using `-r` (RAM) or `-f` (Flash) flags correctly.

**Problem**: "I see garbage data briefly before my program starts"
- **Solution**: This is normal with "Reset on Connection" disabled. The terminal captures whatever is on the serial line. Enable "Reset on Connection" for clean startup.

---

## Recording & Playback

### Overview
The recording system captures raw serial data with precise timing for later playback. This is invaluable for:
- **Regression Testing**: Verify fixes don't break existing functionality
- **Bug Reproduction**: Share exact debug sessions with team members
- **Performance Analysis**: Study timing-critical behaviors offline
- **Documentation**: Create reproducible examples

### Binary Format (.p2rec)
The recording format captures every byte with microsecond-precision timing:

```
Header (64 bytes):
  [4 bytes] Magic: 'P2RC'
  [4 bytes] Version (LE uint32)
  [8 bytes] Start timestamp (LE uint64)
  [4 bytes] Metadata length (LE uint32)
  [48 bytes] Reserved (future use)

Metadata (variable JSON):
  {
    "deviceName": "Propeller2",
    "recordingDate": "2025-11-08T12:34:56.789Z",
    "totalDuration": 45000,
    "entryCount": 1234
  }

Data Entries (repeating):
  [4 bytes] Delta time (ms since start, LE uint32)
  [1 byte] Data type (0=text, 1=binary)
  [4 bytes] Length (LE uint32)
  [N bytes] Payload data
```

This format ensures perfect reproduction of the original debug session, including exact timing relationships.

### Recording Workflow

#### Starting a Recording
1. **Toolbar Method**: Click ⏺ Record button
2. **Menu Method**: File → Start Recording (Ctrl/Cmd+R)
3. **New Recording Dialog**: File → New Recording

The recordings folder (`./recordings/`) is created automatically on first use.

#### During Recording
- Status indicator shows "Recording..." with red dot
- Record button changes to ⏹ Stop
- All serial data is captured with high-resolution timestamps
- Message count accumulates in real-time
- Recording indicator shows current file size

#### Stopping Recording
- Click ⏹ Stop button or File → Stop Recording
- File automatically saved with timestamp: `recording_YYYYMMDD_HHMMSS.p2rec`
- Ready for immediate playback
- No data loss - all buffered data is flushed to disk

### Playback System

#### Loading a Recording
1. **Menu**: File → Open Recording...
2. **Toolbar**: Click ▶ Play button
3. Select .p2rec file from file dialog
4. Playback controls appear automatically below toolbar

#### Playback Controls Panel
When playing a recording, an interactive control panel appears:

- **▶ Play / ⏸ Pause**: Start or pause playback at any time
- **⏹ Stop**: End playback, hide controls, reset to beginning
- **Progress Bar**: Visual timeline - click anywhere to seek
- **Time Display**: Shows `elapsed / total` time (MM:SS format)
- **Speed Selector**: Choose 0.5x (slow), 1x (normal), or 2x (fast) playback

#### During Playback
- Data is injected into the serial processing pipeline as if arriving from hardware
- All debug windows respond normally and update in real-time
- Timing relationships are preserved (within drift compensation limits)
- Can pause, seek, or change speed without stopping
- Progress bar updates smoothly (100ms refresh rate)

#### Playback Features
- **High-Resolution Timing**: Uses `process.hrtime.bigint()` for sub-millisecond accuracy
- **Drift Compensation**: Automatically corrects timer drift > 5ms for long recordings
- **Speed Scaling**: Delays adjusted proportionally (0.5x = double time, 2x = half time)
- **Seek Support**: Jump to any position instantly via progress bar click
- **Pause/Resume**: State preserved, resume from exact position

#### Use Cases
- **Debugging**: Replay problematic sessions repeatedly to isolate issues
- **Testing**: Verify debug windows handle edge cases correctly
- **Training**: Create example sessions for documentation or learning
- **Documentation**: Record demos of debug features with known-good data
- **Regression**: Build test library of edge cases for automated validation
- **Collaboration**: Share exact problem scenarios with remote team members

---

## Debug Windows Overview

### Window Types and Their Uses

| Window | Best For | Example Use Case |
|--------|----------|------------------|
| **Terminal** | Text output, logging | Status messages, debugging info |
| **Logic** | Digital signals | I2C/SPI protocol analysis |
| **Scope** | Analog waveforms | Sensor readings, PWM signals |
| **Scope XY** | Phase relationships | Lissajous patterns, vector displays |
| **Plot** | Data visualization | Graphs, charts, trajectories |
| **Bitmap** | Image display | Camera output, graphics |
| **MIDI** | Music data | MIDI device monitoring |
| **FFT** | Frequency analysis | Audio spectrum, vibration |
| **SPECTRO** | Time-frequency analysis | Waterfall displays, signal evolution |
| **Debugger** | Code debugging | Breakpoints, memory inspection |

## Terminal Window

The Terminal (TERM) window displays text output from your P2 program in a monospace character grid. It's perfect for status messages, debugging output, logging data, and creating simple text-based interfaces.

### Getting Started

#### Creating a Basic Terminal
```spin2
' Simple terminal with defaults (40 columns × 20 rows)
debug(`term MyTerminal`)

' Custom size terminal
debug(`term MyTerminal size 80 24`)

' Full configuration
debug(`term MyTerminal size 80 24 textsize 14 title "Debug Output"`)
```

#### Your First Output
```spin2
PUB main()
  ' Create terminal
  debug(`term MyTerminal size 80 24`)

  ' Display a message
  debug(`MyTerminal 'Hello, World!' 13)
```

### Configuration Options

When creating a terminal, you can customize its appearance and behavior:

**Window Setup:**
- `TITLE 'text'` - Set the window title (e.g., `TITLE "Sensor Monitor"`)
- `POS x y` - Position window on screen (default: auto-placement)
- `SIZE columns rows` - Terminal dimensions (1-256, default: 40×20)

**Text Appearance:**
- `TEXTSIZE points` - Font size in points (6-200, default: 12)
  - Larger values = bigger text
  - Smaller monitors: try 10-12
  - Larger monitors: try 14-18

**Colors:**
- `COLOR fg bg` - Set up to 4 color combinations
  - First pair is default (combo 0)
  - Add more pairs for combos 1-3
  - Example: `COLOR WHITE BLACK RED YELLOW LIME BLACK`

**Display Mode:**
- `UPDATE` - Enable smooth animation mode (see Advanced Features)
- `HIDEXY` - Hide mouse coordinate display

**Example:**
```spin2
debug(`term Status size 100 30 textsize 14 title "Sensor Readings" color LIME BLACK ORANGE BLACK`)
```

### Displaying Text

#### Simple Text Output
```spin2
' Display a string followed by newline (13 = carriage return)
debug(`MyTerminal 'Hello, World!' 13)

' Multiple lines
debug(`MyTerminal 'Line 1' 13 'Line 2' 13 'Line 3' 13)

' Mix text and numbers
debug(`MyTerminal 'Temperature: ' dec(temp) ' °C' 13)
```

#### Numeric Display
```spin2
' Display numbers in different formats
debug(`MyTerminal 'Decimal: ' dec(value) 13)
debug(`MyTerminal 'Hex: ' hex(value, 8) 13)
debug(`MyTerminal 'Binary: ' bin(value, 16) 13)
```

#### Using Colors
The terminal supports 4 color combinations (combos 0-3):

```spin2
' Set up 4 color combos: white/black, black/orange, lime/black, red/yellow
debug(`term MyTerminal color WHITE BLACK  BLACK ORANGE  LIME BLACK  RED YELLOW`)

' Select and use different combos
debug(`MyTerminal 4 'Normal text' 13)        ' Combo 0 (white on black)
debug(`MyTerminal 5 'Warning!' 13)           ' Combo 1 (black on orange)
debug(`MyTerminal 6 'Success!' 13)           ' Combo 2 (lime on black)
debug(`MyTerminal 7 'Error!' 13)             ' Combo 3 (red on yellow)
```

**Default Colors** (if you don't specify COLOR):
- Combo 0: Orange on Black
- Combo 1: Black on Orange
- Combo 2: Lime on Black
- Combo 3: Black on Lime

### Control Codes

Control codes let you position the cursor, clear the display, and control colors:

| Code | Function | Example |
|------|----------|---------|
| `0` | Clear screen and home cursor | `debug(\`MyTerm 0)` |
| `1` | Home cursor (no clear) | `debug(\`MyTerm 1)` |
| `2 col` | Set cursor column | `debug(\`MyTerm 2 10)` → column 10 |
| `3 row` | Set cursor row | `debug(\`MyTerm 3 5)` → row 5 |
| `4-7` | Select color combo 0-3 | `debug(\`MyTerm 5)` → combo 1 |
| `8` | Backspace | `debug(\`MyTerm 8)` |
| `9` | Tab to next 8-col boundary | `debug(\`MyTerm 9)` |
| `13` | Newline/carriage return | `debug(\`MyTerm 13)` |

**Example: Cursor Positioning**
```spin2
' Create a status display at specific positions
debug(`MyTerm 0)                    ' Clear screen
debug(`MyTerm 3 0 2 5 'CPU:')       ' Row 0, column 5
debug(`MyTerm 3 1 2 5 'Temp:')      ' Row 1, column 5
debug(`MyTerm 3 2 2 5 'Memory:')    ' Row 2, column 5

' Update values
debug(`MyTerm 3 0 2 15 dec(cpu_usage) '%')
debug(`MyTerm 3 1 2 15 dec(temperature) ' C')
debug(`MyTerm 3 2 2 15 dec(memory_free) ' KB')
```

### Mouse Coordinate Display (NEW!)

When you move your mouse over the terminal, a small flyout shows the character position under the cursor:

**What You See:**
- Format: `column,row` (e.g., "42,10" means column 42, row 10)
- Coordinates are 0-based (top-left is 0,0)
- Automatically positions itself to avoid blocking text

**When It Appears:**
- Mouse over the terminal character area → coordinates shown
- Mouse outside terminal → coordinates hidden
- Use `HIDEXY` directive to disable if not needed

**Use Cases:**
- Finding exact positions for cursor positioning (codes 2 and 3)
- Aligning text and graphics
- Planning terminal layouts

### Advanced Features

#### UPDATE Mode - Smooth Animation
For high-speed output or animations, use UPDATE mode to prevent flickering:

```spin2
' Enable UPDATE mode
debug(`term Display size 80 24 UPDATE`)

' Draw content (not visible yet)
debug(`Display 0)                     ' Clear
debug(`Display 'Frame 1' 13)          ' Add content
debug(`Display 'More data...' 13)     ' Add more

' Make it visible all at once
debug(`Display UPDATE)                ' Flip to screen
```

**How It Works:**
- Without UPDATE: Each character appears immediately (may flicker)
- With UPDATE: Changes buffered, displayed all at once when UPDATE sent
- Perfect for animations, graphs, or rapidly changing displays

**Example: Animated Counter**
```spin2
PUB animate_counter() | count

  debug(`term Counter size 20 5 UPDATE`)

  repeat count from 0 to 100
    debug(`Counter 0)                ' Clear (buffered)
    debug(`Counter 3 1 2 5)          ' Position (buffered)
    debug(`Counter dec(count))       ' Show count (buffered)
    debug(`Counter UPDATE)           ' Display all at once
    waitms(50)
```

#### PC_KEY - Keyboard Input
Forward keyboard input from your computer to the P2:

```spin2
' Enable keyboard forwarding
debug(`term MyTerm PC_KEY`)

' P2 can now read keystrokes
' (implementation details in your P2 program)
```

#### PC_MOUSE - Mouse Input
Forward mouse position and button clicks to the P2:

```spin2
' Enable mouse forwarding
debug(`term MyTerm PC_MOUSE`)

' P2 receives mouse coordinates and button states
' (implementation details in your P2 program)
```

### Common Tasks

#### Creating a Log Window
```spin2
PUB logger() | count

  debug(`term Log size 100 40 textsize 10 title "Event Log" HIDEXY`)

  repeat count from 1 to 100
    debug(`Log dec(count) ': Event occurred at ' dec(getms()) ' ms' 13)
    waitms(100)
```

#### Status Dashboard
```spin2
PUB dashboard() | temp, speed, status

  debug(`term Dash size 50 10 color LIME BLACK RED BLACK`)
  debug(`Dash 0)                                ' Clear
  debug(`Dash 3 1 2 2 'Temperature:')
  debug(`Dash 3 2 2 2 'Speed:')
  debug(`Dash 3 3 2 2 'Status:')

  repeat
    temp := read_temperature()
    speed := read_speed()
    status := system_status()

    ' Update temperature
    debug(`Dash 3 1 2 20 dec(temp) ' C  ')

    ' Update speed
    debug(`Dash 3 2 2 20 dec(speed) ' RPM  ')

    ' Update status with color
    if status == OK
      debug(`Dash 3 3 2 20 4 'OK     ')    ' Combo 0 (lime)
    else
      debug(`Dash 3 3 2 20 5 'ERROR  ')    ' Combo 1 (red)

    waitms(100)
```

#### Colorful Messages
```spin2
debug(`term Messages color WHITE BLACK YELLOW BLACK RED BLACK LIME BLACK`)

debug(`Messages 4 '[INFO] ' 'System started' 13)
debug(`Messages 5 '[WARN] ' 'Low memory' 13)
debug(`Messages 6 '[ERROR] ' 'Sensor failure' 13)
debug(`Messages 7 '[OK] ' 'All systems nominal' 13)
```

### Tips and Best Practices

**Choosing Terminal Size:**
- Text logging: 80-100 columns × 30-40 rows
- Status display: 40-60 columns × 10-20 rows
- Full debugging: 100-120 columns × 40-50 rows
- Consider your monitor resolution

**Font Size:**
- 1080p monitors: 12-14pt works well
- 4K monitors: 16-20pt for readability
- Experiment to find what's comfortable

**Using Colors Effectively:**
- Reserve bright colors for important messages
- Use consistent colors (red=error, yellow=warning, green=ok)
- Don't overuse colors - they lose impact

**Performance:**
- Use UPDATE mode for >10 updates/second
- Clear only when needed (clearing is slow)
- Position cursor once, then output data

**Mouse Coordinates:**
- Use to plan cursor positioning commands
- Hide with HIDEXY if coordinates aren't needed
- Coordinates help align multi-column displays

### Common Issues

**Text not appearing?**
- If using UPDATE mode, did you send UPDATE command?
- Check that terminal was created first
- Verify window isn't hidden behind other windows

**Wrong colors?**
- Color combos are 0-3, selected with codes 4-7
- Make sure you specified COLOR in configuration
- Default is orange on black if not specified

**Text wrapping unexpectedly?**
- Line wraps at column boundary automatically
- Use cursor positioning (codes 2,3) for control
- Consider larger SIZE if text is too wide

**Scrolling too fast?**
- Terminal auto-scrolls when full
- Use larger SIZE to see more lines
- Consider UPDATE mode to batch multiple lines

### Keyboard Shortcuts

When terminal window is focused:
- **Ctrl+C** - Copy selected text
- **Ctrl+S** - Save terminal contents
- **Ctrl+W** - Close window

## Logic Analyzer

The LOGIC window is a 32-channel logic analyzer that displays digital signals over time, perfect for debugging protocols, timing relationships, and digital I/O. It features advanced triggering, channel grouping, and a helpful crosshair display.

### What is a Logic Analyzer?

A logic analyzer captures and displays digital signals (high/low, 1/0) from your Propeller 2. Unlike an oscilloscope which shows voltage levels, a logic analyzer shows timing relationships between multiple digital channels.

**Perfect for:**
- Debugging serial protocols (SPI, I2C, UART)
- Analyzing timing between signals
- Watching multiple I/O pins simultaneously
- Capturing events that happen too fast to see

### Getting Started

#### Creating a Basic Logic Analyzer

```spin2
debug(`logic MyLogic)           ' Creates 32-channel logic analyzer
```

This creates a logic analyzer window with default settings (32 samples, 8-pixel spacing).

#### Sending Data

```spin2
repeat
  data := ina.[7..0]            ' Read 8 pins
  debug(`logic MyLogic `(data)) ' Send to analyzer
  waitms(10)
```

Each value you send represents one time sample. Each bit in the value represents one channel (bit 0 = channel 0, bit 1 = channel 1, etc.).

### Configuration Options

**Window Setup:**
```spin2
debug(`logic MyLogic title 'I/O Monitor' pos 100 50)
```
- `TITLE 'text'` - Custom window title
- `POS x y` - Window position on screen

**Capture Settings:**
```spin2
debug(`logic MyLogic samples 256 spacing 4)
```
- `SAMPLES count` - Number of samples to display (4-2048, default: 32)
- `SPACING pixels` - Width of each sample in pixels (1-256, default: 8)
- `RATE divisor` - Capture every Nth sample (default: 1)

**Display Settings:**
```spin2
debug(`logic MyLogic textsize 10 linesize 3)
```
- `TEXTSIZE points` - Font size for channel labels (6-200, default: 12)
- `LINESIZE size` - Signal line thickness (1-7, default: 1)
- `HIDEXY` - Hide mouse coordinate display

### Organizing Channels

Instead of 32 separate channels, you can group related bits with names and colors:

```spin2
debug(`logic MyLogic 'Clock' 1 lime)      ' Name bit 0 "Clock", lime color
debug(`logic MyLogic 'Data' 8 cyan)       ' Next 8 bits "Data 0-7", cyan color
debug(`logic MyLogic 'Control' 4 yellow)  ' Next 4 bits "Control 0-3", yellow
```

**Benefits:**
- Easier to read display
- Color-coded signals
- Grouped related bits
- Professional-looking waveforms

**Complete Example:**
```spin2
debug(`logic SPI 'SCK' 1 lime 'MOSI' 1 cyan 'MISO' 1 yellow 'CS' 1 red)
```

### Using Triggers

Triggers let you capture data only when a specific condition occurs, perfect for catching intermittent events.

#### Basic Trigger

```spin2
debug(`logic MyLogic trigger $FF $80)  ' Trigger when bits 0-7 match $80
```

**Parameters:**
- First number (`$FF`) - **Mask**: which bits to check (1 = check this bit, 0 = ignore)
- Second number (`$80`) - **Match**: pattern to look for

**Trigger fires when:** `(data & mask) == match`

#### Practical Trigger Examples

**Trigger on single bit high:**
```spin2
debug(`logic MyLogic trigger $01 $01)  ' Bit 0 goes high
```

**Trigger on specific byte value:**
```spin2
debug(`logic MyLogic trigger $FF $5A)  ' Bits 0-7 = $5A
```

**Trigger on any of several bits:**
```spin2
debug(`logic MyLogic trigger $0F $0F)  ' Any of bits 0-3 high
```

#### Advanced Trigger Control

```spin2
debug(`logic MyLogic trigger $FF $80 16 64)
```
- Third number (`16`) - **Offset**: Where to position trigger in display buffer
- Fourth number (`64`) - **Holdoff**: Minimum samples between triggers

**Holdoff Example:**
```spin2
debug(`logic MyLogic holdoff 100)  ' Wait 100 samples between triggers
```

Prevents re-triggering too quickly, giving you stable waveform capture.

### Mouse Coordinate Display

Move your mouse over the logic analyzer to see timing and channel information.

**Display shows:** "sample,channel"
- **Sample number**: How many samples from the right edge (negative = past samples)
- **Channel number**: Which channel (0 = top channel)

**Example:** "-5,3" means 5 samples ago on channel 3

**Bonus Feature - Crosshair:**
The LOGIC window includes crosshair lines that follow your mouse, making it easy to:
- Align timing across multiple channels
- Measure time between events
- See exact sample positions

**Hide coordinates:** Use `HIDEXY` directive if you don't want the display.

### Common Commands

**Window Management:**
```spin2
debug(`logic MyLogic clear)   ' Clear all channel data
debug(`logic MyLogic close)   ' Close the window
```

**Save Display:**
```spin2
debug(`logic MyLogic save 'capture.bmp')  ' Save waveform to file
```

### Complete Example: SPI Protocol Analyzer

```spin2
CON
  SCK_PIN = 0
  MOSI_PIN = 1
  MISO_PIN = 2
  CS_PIN = 3

PUB main()
  ' Configure logic analyzer with labeled channels
  debug(`logic SPI title 'SPI Protocol Monitor' samples 128)
  debug(`logic SPI 'SCK' 1 lime)     ' Clock on pin 0
  debug(`logic SPI 'MOSI' 1 cyan)    ' Master Out on pin 1
  debug(`logic SPI 'MISO' 1 yellow)  ' Master In on pin 2
  debug(`logic SPI 'CS' 1 red)       ' Chip Select on pin 3

  ' Trigger on CS going low (start of transaction)
  debug(`logic SPI trigger $08 $00)  ' Bit 3 (CS) = low

  repeat
    spi_data := ina.[3..0]           ' Read all 4 SPI pins
    debug(`logic SPI `(spi_data))    ' Send to analyzer
    waitms(1)
```

### Complete Example: I2C Bus Monitor

```spin2
PUB monitor_i2c()
  ' Setup 2-channel I2C monitor
  debug(`logic I2C title 'I2C Bus' samples 256 spacing 2)
  debug(`logic I2C 'SCL' 1 green)    ' Clock
  debug(`logic I2C 'SDA' 1 yellow)   ' Data

  ' Trigger on START condition (SDA falling while SCL high)
  debug(`logic I2C trigger $03 $02)  ' SCL=1, SDA=0

  repeat
    bus_state := ina.[1..0]
    debug(`logic I2C `(bus_state))
    waitus(10)
```

### Tips and Tricks

**Capture Fast Events:**
- Use smaller `SPACING` (1-2 pixels) to fit more samples
- Increase `SAMPLES` to capture longer sequences
- Use `RATE` to subsample very high-speed signals

**Analyze Slow Events:**
- Use `RATE` divisor to capture every Nth sample
- Example: `RATE 100` captures every 100th sample

**Debug Protocols:**
- Name channels after signal names (SCK, MOSI, etc.)
- Use colors to group related signals
- Use trigger to catch start conditions

**Stable Waveforms:**
- Set appropriate `HOLDOFF` to prevent re-triggering
- Position trigger in middle of display (default offset)
- Use mask to ignore noisy bits

### Mouse Coordinate Display Features

**What you see:**
- Coordinates update as you move mouse
- Format: "sample,channel" (e.g., "-10,5" = 10 samples ago, channel 5)
- Crosshair lines help align across channels

**Positioning:**
- Display automatically moves to avoid obscuring data
- Always readable regardless of mouse position
- Disappears when mouse leaves window

### Packed Data Modes (Advanced)

For efficient data transmission, the LOGIC window supports packed data formats:

```spin2
debug(`logic MyLogic 8BIT)  ' Pack 4 samples per long (8 bits each)
```

**Available formats:** 1BIT, 2BIT, 4BIT, 8BIT, 16BIT, 32BIT
**Modifiers:** ALT (alternate bits), SIGNED (signed values)

Most users won't need packed modes - they're for high-speed data capture.

## Oscilloscope

The Scope window displays analog waveforms, similar to a traditional oscilloscope.

### Basic Setup
```spin2
debug(`scope MyScope size 600 400 samples 1000 range -100 100`)
```

### Streaming Data
```spin2
repeat
  sensor_value := read_adc()
  debug(`scope MyScope`, sdec(sensor_value))
  waitms(1)
```

### Trigger Settings
- **Auto**: Automatic triggering
- **Normal**: Wait for trigger condition
- **Single**: Capture one trigger event
- **Level**: Adjustable trigger voltage
- **Slope**: Rising/falling edge selection

### Display Controls
- **Vertical Scale**: Adjust Y-axis range
- **Horizontal Scale**: Adjust time base
- **Offset**: Move waveform up/down
- **Persistence**: Show trace history

## XY Scope

The Scope XY window plots one signal against another, useful for phase analysis.

### Creating XY Display
```spin2
debug(`scopexy MyXY size 400 400 range -100 100 -100 100`)
```

### Plotting Points
```spin2
repeat angle from 0 to 359
  x := sin(angle) * 100 / $FFFF
  y := cos(angle) * 100 / $FFFF
  debug(`scopexy MyXY xy`, sdec(x), sdec(y))
```

### Applications
- Lissajous patterns for frequency comparison
- Vector displays
- Phase relationship visualization
- Trajectory plotting

## Plot Window

The Plot window provides comprehensive 2D graphics and data visualization with full PLOT command support. It features a high-performance canvas rendering system with double buffering, sprite support, and real-time performance monitoring.

### Getting Started

#### Basic Window Creation
```spin2
debug(`plot MyPlot size 640 480`)
debug(`plot MyPlot title "My Visualization"`)
debug(`plot MyPlot pos 100 100`)          ' Position window on screen
```

#### Drawing Basic Shapes
```spin2
debug(`plot MyPlot dot`)                  ' Dot at current position
debug(`plot MyPlot dot 3 200`)            ' 3-pixel dot with opacity 200
debug(`plot MyPlot line 100 200`)         ' Line to coordinates
debug(`plot MyPlot circle 50`)            ' Circle with 50px diameter
debug(`plot MyPlot box 80 60`)            ' Rectangle 80x60 pixels
debug(`plot MyPlot oval 70 50`)           ' Ellipse 70x50 pixels
```

### Command Reference

#### Window Configuration (CONFIGURE group)
- **`CONFIGURE TITLE "Window Title"`** - Set window title (supports spaces)
- **`CONFIGURE POS x y`** - Position window on screen (negative values supported for multi-monitor)
- **`CONFIGURE SIZE width height`** - Set canvas size (32-2048 pixels, values clamped)
- **`CONFIGURE DOTSIZE size`** - Set default dot size (1-32 pixels, affects all DOT commands)
- **`CONFIGURE BACKCOLOR color`** - Set background color (see color formats below)
- **`CONFIGURE HIDEXY 0|1`** - Toggle coordinate display visibility
- **`CONFIGURE UPDATE rate`** - Set display refresh rate (1-120 Hz)

#### Rendering Control (UPDATE group)
- **`COLORMODE mode`** - Set color interpretation mode:
  - `0` = RGB mode (default)
  - `1` = HSV mode
  - `2` = Indexed palette mode
  - `3` = Grayscale mode
- **`TEXTSIZE multiplier`** - Set text size multiplier (1-100, affects all TEXT commands)
- **`TEXTSTYLE flags`** - Set text style bitfield (0-7):
  - Bit 0 = Bold
  - Bit 1 = Italic
  - Bit 2 = Underline

#### Basic Drawing Commands
- **`DOT [lineSize] [opacity]`** - Draw dot at current position
  - `lineSize`: 1-32 pixels (default: 1)
  - `opacity`: 0-255 (default: 255)
- **`LINE x y [lineSize] [opacity]`** - Draw line to absolute coordinates
- **`CIRCLE diameter [lineSize] [opacity]`** - Draw circle outline
  - `diameter`: 1-2048 pixels (clamped automatically)
- **`BOX width height [lineSize] [opacity]`** - Draw rectangle outline
- **`OVAL width height [lineSize] [opacity]`** - Draw ellipse outline

#### Text Rendering
- **`TEXT "string"`** - Basic text at current position
- **`TEXT size "string"`** - Text with specific size
- **`TEXT size style "string"`** - Text with size and style
- **`TEXT size style angle "string"`** - Text with rotation

#### Interactive Commands
- **`PC_KEY`** - Read last pressed key (returns ASCII/scan code, consumes key)
- **`PC_MOUSE`** - Read current mouse state (returns 32-bit encoded position/buttons)

#### Color Support
All commands support multiple color formats:
- **Color names**: `BLACK`, `WHITE`, `RED`, `GREEN`, `BLUE`, `CYAN`, `MAGENTA`, `YELLOW`, `ORANGE`, `PINK`, `AQUA`, `LIME`, `SILVER`, `GRAY`, `MAROON`, `NAVY`
- **Hex RGB**: `$FF0000` (red), `$00FF00` (green), `$0000FF` (blue)
- **RGB values**: `0xRRGGBB` format

### Advanced Features

#### Sprite System (256 sprites supported)
```spin2
' Define a sprite (ID 0-255, size 1-32x1-32 pixels)
debug(`plot MyPlot spritedef 0 8 8 $FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00`)

' Draw sprites
debug(`plot MyPlot sprite 0`)                  ' At current position
debug(`plot MyPlot sprite 0 100 100`)          ' At specific coordinates
debug(`plot MyPlot sprite 0 100 100 200`)      ' With opacity
```

#### External Bitmap Loading (8 layers supported)
```spin2
' Load bitmap from project directory
debug(`plot MyPlot layer 0 "background.bmp"`)   ' Must be .bmp file

' Crop and display portions
debug(`plot MyPlot crop 0 0 32 32`)             ' Top-left 32x32 region
debug(`plot MyPlot crop 10 10 64 64 200 300`)   ' Crop region to canvas position
```

#### Error Handling
The PLOT window provides comprehensive error reporting through the Debug Logger:
- **File not found**: `[PLOT PARSE ERROR] Bitmap file not found: background.bmp`
- **Invalid parameters**: Parameter validation with helpful messages
- **Sprite/layer issues**: Clear error messages for undefined IDs

### Performance Features

#### Real-Time Performance Overlay
Click the **PERF** button (top-left corner) to display real-time performance metrics:
- **FPS**: Current and average frame rates
- **Command Processing**: Last and average command times
- **Render Time**: Canvas rendering performance
- **Memory Usage**: Current heap usage
- **Operations**: Canvas operation counts
- **Warnings**: Performance alerts

#### Performance Characteristics
- **Target Performance**: 60fps sustained, <10ms command processing
- **Memory Efficiency**: Optimized sprite and bitmap storage
- **Stress Testing**: Handles DataSets=2048 scenarios
- **Command Throughput**: 1000+ commands/second capability

### Coordinate System

#### Canvas Coordinates
- **Origin**: Top-left corner (0, 0)
- **X-axis**: Left to right (positive)
- **Y-axis**: Top to bottom (positive)
- **Range**: 0 to canvas width/height

#### Multi-Monitor Support
Window positioning supports negative coordinates for multi-monitor setups:
```spin2
debug(`plot MyPlot pos -1920 100`)    ' Position on left monitor
```

### Best Practices

#### Optimal Performance
- Use `CONFIGURE UPDATE` to control refresh rate based on data frequency
- Batch drawing commands when possible
- Consider sprite caching for repeated graphics
- Monitor performance overlay during development

#### Error Prevention
- Always check that bitmap files exist in the project directory
- Validate sprite IDs before use with `SPRITE` command
- Use appropriate canvas sizes (avoid extreme values)
- Test coordinate ranges for your specific use case

#### Memory Management
- Redefine sprites to update cached bitmaps
- Use appropriate sprite sizes (larger sprites use more memory)
- Consider layer bitmap sizes when loading external files

### Troubleshooting

#### Common Issues
- **Sprites not appearing**: Check that `SPRITEDEF` was called first
- **Bitmap not loading**: Verify .bmp file exists in project directory
- **Performance drops**: Use performance overlay to identify bottlenecks
- **Commands ignored**: Check Debug Logger for parsing errors

#### Debug Tips
- Enable performance overlay during development
- Use Debug Logger window to monitor PLOT parsing messages
- Test with simple commands first before complex scenes
- Verify file paths are relative to PNut-Term-TS executable

## Bitmap Display

The Bitmap window displays pixel-based graphics with support for animations, various color modes, and automated plotting patterns. Ideal for displaying images, creating visualizations, and real-time graphics.

### Creating a Bitmap Window

**Basic Declaration**:
```spin2
debug(`bitmap MyBitmap size 256 256`)
```

**With Configuration**:
```spin2
debug(`bitmap MyBitmap title "Graphics Display" pos 100 100 size 320 240 dotsize 2`)
```

**Complete Declaration Example** (all directives in one declaration):
```spin2
debug(`bitmap MyBitmap title "Test" size 256 256 dotsize 8 trace 5 rate 100 sparse $FF lut2 longs_2bit lutcolors RED GREEN BLUE YELLOW update`)
' Now send pixel data - window is already configured
debug(`MyBitmap \`(pixel_value))
```

**Configuration Options** (all can be used in declaration or as runtime commands):
- `TITLE "text"` - Window title
- `POS x y` - Window position on screen
- `SIZE width height` - Bitmap dimensions (1-2048 pixels)
- `DOTSIZE x {y}` - Pixel scaling factor (1-256). Single value sets both X and Y.
- `COLOR color` - Background color
- `HIDEXY` - Hide mouse coordinate display
- `SPARSE color` - Enable sparse mode with specified background color
- `TRACE pattern` - Set trace pattern (0-11) for pixel plotting direction
- `RATE count` - Update frequency (0=manual, -1=fullscreen, >0=pixel count)
- `LUTCOLORS c1 c2 ...` - Set LUT palette colors (up to 16 colors)
- `UPDATE` - Enable manual update mode (requires UPDATE command to refresh display)
- Color modes: `LUT1`, `LUT2`, `LUT4`, `LUT8`, `LUMA8`, `HSV8`, `RGB8`, `RGB16`, `RGB24`, etc.
- Packed data modes: `LONGS_2BIT`, `BYTES_4BIT`, etc. (optional ALT/SIGNED modifiers)

### Color Modes

The BITMAP window supports 19 different color modes for various use cases.

**LUT Modes** (Palette-based):
```spin2
debug(`bitmap MyBitmap size 256 256 lut8`)
debug(`bitmap MyBitmap lutcolors $FF0000 $00FF00 $0000FF RED BLUE`)  ' Set palette colors
```
- `LUT1` - 2 colors (1-bit)
- `LUT2` - 4 colors (2-bit)
- `LUT4` - 16 colors (4-bit)
- `LUT8` - 256 colors (8-bit)

**Direct Color Modes**:
```spin2
debug(`bitmap MyBitmap size 320 240 rgb24`)  ' 24-bit true color
debug(`bitmap MyBitmap size 256 192 rgb16`)  ' 16-bit color
debug(`bitmap MyBitmap size 256 192 rgb8`)   ' 8-bit RGB
```
- `RGB24` - 24-bit true color (16.7M colors)
- `RGB16` - 16-bit color
- `RGB8` - 8-bit RGB

**LUMA Modes** (Brightness with color):
```spin2
debug(`bitmap MyBitmap size 256 256 luma8 5`)  ' Tune parameter 0-7
```
- `LUMA8`, `LUMA8W`, `LUMA8X` - 8-bit luminance modes

**HSV Modes** (Hue-Saturation-Value):
```spin2
debug(`bitmap MyBitmap size 256 256 hsv16`)
```
- `HSV8`, `HSV8W`, `HSV8X` - 8-bit HSV modes
- `HSV16`, `HSV16W`, `HSV16X` - 16-bit HSV modes

**RGBI Modes** (RGB + Intensity):
```spin2
debug(`bitmap MyBitmap size 256 256 rgbi8`)
```
- `RGBI8`, `RGBI8W`, `RGBI8X` - 8-bit RGBI modes

**Tune Parameter**: Many modes accept an optional tune parameter (0-7) to adjust color rendering.

### Color Formats

Colors can be specified in multiple formats:

**Hexadecimal** (most common):
```spin2
debug(`bitmap MyBitmap sparse $FF0000`)  ' Red in hex
debug(`bitmap MyBitmap lutcolors $00FF00 $0000FF`)  ' Green and Blue
```

**Decimal**:
```spin2
debug(`bitmap MyBitmap sparse 16711680`)  ' Red as decimal
```

**Binary**:
```spin2
debug(`bitmap MyBitmap lutcolors %11111111 %10101010`)  ' Binary format
```

**Quaternary** (base-4):
```spin2
debug(`bitmap MyBitmap lutcolors %%33 %%00`)  ' Quaternary format
```

**Named Colors**:
```spin2
debug(`bitmap MyBitmap lutcolors RED GREEN BLUE YELLOW CYAN MAGENTA`)
debug(`bitmap MyBitmap sparse BLACK`)
```

Available named colors: `RED`, `GREEN`, `BLUE`, `YELLOW`, `CYAN`, `MAGENTA`, `ORANGE`, `PURPLE`, `PINK`, `BROWN`, `GRAY`/`GREY`, `WHITE`, `BLACK`

### Pixel Plotting

**Manual Pixel Placement**:
```spin2
debug(`bitmap MyBitmap set 100 50`)  ' Set position to (100, 50)
debug(`bitmap MyBitmap`, udec($FF0000))  ' Plot red pixel
```

**Streaming Data**:
```spin2
' Plot multiple pixels
debug(`bitmap MyBitmap`, udec($FF0000), udec($00FF00), udec($0000FF))
```

### Trace Patterns (Automated Plotting)

Trace patterns control how pixels are automatically plotted when streaming data. There are 16 patterns (0-15):

**Non-Scrolling Patterns (0-7)**:
```spin2
debug(`bitmap MyBitmap trace 0`)  ' Left to right, top to bottom (normal)
debug(`bitmap MyBitmap trace 1`)  ' Right to left, top to bottom
debug(`bitmap MyBitmap trace 2`)  ' Left to right, bottom to top
debug(`bitmap MyBitmap trace 3`)  ' Right to left, bottom to top
debug(`bitmap MyBitmap trace 4`)  ' Top to bottom, left to right
debug(`bitmap MyBitmap trace 5`)  ' Bottom to top, left to right
debug(`bitmap MyBitmap trace 6`)  ' Top to bottom, right to left
debug(`bitmap MyBitmap trace 7`)  ' Bottom to top, right to left
```

**Scrolling Patterns (8-15)**:
Same orientations as 0-7, but with scrolling enabled:
```spin2
debug(`bitmap MyBitmap trace 8`)   ' Pattern 0 + scroll down
debug(`bitmap MyBitmap trace 10`)  ' Pattern 2 + scroll up
debug(`bitmap MyBitmap trace 12`)  ' Pattern 4 + scroll right
debug(`bitmap MyBitmap trace 14`)  ' Pattern 6 + scroll left
```

**Plot Rate**:
```spin2
debug(`bitmap MyBitmap rate 256`)  ' Plot every 256th pixel
debug(`bitmap MyBitmap rate 0`)    ' Auto-suggest based on trace pattern
```

### SPARSE Mode (Border Effect)

SPARSE mode creates a border effect around pixels, useful for grid-like visualizations:

```spin2
debug(`bitmap MyBitmap sparse $000000`)  ' Enable SPARSE mode with black background
```

**How it Works**:
- Pixels matching the background color are skipped
- Non-background pixels get a border effect
- Border is drawn in the background color
- Inner pixel is drawn at 75% size in the pixel color
- Works with all `DOTSIZE` values

**Example**:
```spin2
debug(`bitmap MyBitmap size 64 64 dotsize 8 8 sparse $000000`)
debug(`bitmap MyBitmap trace 0`)
' Each pixel will have a black border with colored center
```

### Scrolling

**Scroll Bitmap Content**:
```spin2
debug(`bitmap MyBitmap scroll 1 0`)   ' Scroll right 1 pixel
debug(`bitmap MyBitmap scroll -1 0`)  ' Scroll left 1 pixel
debug(`bitmap MyBitmap scroll 0 1`)   ' Scroll down 1 pixel
debug(`bitmap MyBitmap scroll 0 -1`)  ' Scroll up 1 pixel
debug(`bitmap MyBitmap scroll 10 5`)  ' Scroll right 10, down 5
```

### Mouse Coordinate Display

**Hover Feature**: Move your mouse over the bitmap to see pixel coordinates.

**Features**:
- Shows (X,Y) coordinates in a flyout
- Automatically positions to avoid window edges
- Respects `DOTSIZE` scaling
- Can be disabled with `HIDEXY` directive

**Example**:
```spin2
debug(`bitmap MyBitmap size 256 256`)        ' Coordinates enabled
debug(`bitmap MyBitmap size 256 256 hidexy`) ' Coordinates disabled
```

### Common Commands

**Clear Display**:
```spin2
debug(`bitmap MyBitmap clear`)
```

**Save to File**:
```spin2
debug(`bitmap MyBitmap save "screenshot.bmp"`)          ' Save canvas
debug(`bitmap MyBitmap save window "fullwindow.bmp"`)   ' Save window with title bar
```

**Update Display**:
```spin2
debug(`bitmap MyBitmap update`)  ' Force display update
```

**Close Window**:
```spin2
debug(`bitmap MyBitmap close`)
```

### Practical Examples

**Creating an Animation**:
```spin2
' Setup bitmap with scrolling trace
debug(`bitmap Anim size 128 128 dotsize 4 4 rgb24 trace 8`)
debug(`bitmap Anim rate 128`)

' Stream color data - will scroll down automatically
repeat
  debug(`bitmap Anim`, udec(color_value))
  color_value := calculate_next_color()
```

**Drawing a Grid with SPARSE Mode**:
```spin2
' Setup grid with border effect
debug(`bitmap Grid size 32 32 dotsize 16 16 sparse $222222 rgb8`)
debug(`bitmap Grid trace 0 rate 1`)

' Draw colored cells
repeat y from 0 to 31
  repeat x from 0 to 31
    debug(`bitmap Grid`, udec(get_cell_color(x, y)))
```

**LUT Palette Animation**:
```spin2
' Setup palette-based bitmap
debug(`bitmap Palette size 256 256 lut8`)
debug(`bitmap Palette lutcolors RED ORANGE YELLOW GREEN CYAN BLUE PURPLE`)

' Animate by changing palette
repeat
  debug(`bitmap Palette lutcolors`, generate_palette_colors())
  waitms(50)
```

**Plotting Sensor Data**:
```spin2
' Heatmap display
debug(`bitmap Sensor size 320 240 dotsize 2 2 luma8`)
debug(`bitmap Sensor trace 0 rate 1`)

' Stream sensor readings
repeat
  value := read_temperature_sensor()
  debug(`bitmap Sensor`, udec(value))
```

### Troubleshooting

**Validation Errors**:
All validation errors appear in the LOGGER window with descriptive messages:
- "Bitmap size out of range" - Width or height exceeds 2048
- "SET command requires two numeric coordinates" - Invalid SET parameters
- "SCROLL command missing X and/or Y coordinates" - Invalid SCROLL parameters
- "Cannot plot pixels before bitmap size is defined" - Send SIZE first

**Performance Issues**:
- Large bitmaps (>1024×1024) with high DOTSIZE may show latency
- Use `RATE` command to reduce update frequency
- SPARSE mode has ~20% performance impact (acceptable for most uses)

**Pixel Positioning**:
- Coordinates are 0-based: (0,0) is top-left
- Maximum coordinates are (width-1, height-1)
- Out-of-bounds coordinates will show error message

**Color Issues**:
- Ensure color values match the selected color mode
- LUT modes require palette setup with `LUTCOLORS`
- Named colors work in all commands that accept colors

## MIDI Monitor

The MIDI window displays MIDI messages with a virtual piano keyboard.

### Setup
```spin2
debug(`midi MyMIDI size 800 400 title "MIDI Monitor"`)
```

### Sending MIDI Events
```spin2
' Note On (channel 1, note 60/Middle C, velocity 64)
debug(`midi MyMIDI`, ubyte($90), ubyte(60), ubyte(64))

' Note Off
debug(`midi MyMIDI`, ubyte($80), ubyte(60), ubyte(0))

' Control Change
debug(`midi MyMIDI`, ubyte($B0), ubyte(7), ubyte(100))  ' Volume
```

### Display Features
- Virtual piano keyboard with note highlighting
- MIDI message log
- Channel activity indicators
- Velocity visualization

## FFT Analyzer

The FFT window performs frequency analysis on incoming data.

### Configuration
```spin2
debug(`fft MyFFT size 800 400 samples 1024 rate 44100`)
```

### Display Modes
- **Line**: Traditional spectrum analyzer
- **Bar**: Bar graph display
- **Dot**: Point plot
- **Waterfall**: Time-frequency spectrogram

### Window Functions
Reduce spectral leakage:
- **RECTANGLE** - No window (maximum frequency resolution)
- **HANNING** - General purpose
- **HAMMING** - Similar to Hanning, better stopband
- **BLACKMAN** - Excellent stopband, wider mainlobe
- **FLATTOP** - Best amplitude accuracy

### Controls
- **Magnitude Scale**: Linear/Logarithmic
- **Frequency Range**: Zoom to specific bands
- **Peak Hold**: Capture maximum values
- **Averaging**: Smooth noisy signals

## SPECTRO (Spectrogram/Waterfall Display)

The SPECTRO window displays real-time spectrograms showing frequency content over time as a scrolling waterfall display. Perfect for visualizing how signals change, analyzing modulation, and identifying patterns in audio or sensor data.

### What is a Spectrogram?

A spectrogram combines frequency analysis (like FFT) with time visualization. Instead of showing just the current frequency content, it creates a "waterfall" where:
- **X-axis**: Frequency bins (or time, depending on trace pattern)
- **Y-axis**: Time progression (scrolls as new data arrives)
- **Color**: Magnitude (brightness shows signal strength)

**Perfect for:**
- Analyzing audio signals and music
- Visualizing sensor data over time
- Detecting frequency changes and patterns
- Monitoring signal quality and interference
- Creating heat maps of data trends

### Getting Started

#### Creating a Basic Spectrogram
```spin2
debug(`SPECTRO MySpectro)  ' Creates spectrogram with default settings
```

This creates a spectrogram with:
- 512-sample FFT (showing frequencies 0-255)
- 256 rows of history
- Scrolling waterfall display

#### Feeding Data
```spin2
repeat
  sample := read_adc()
  debug(`MySpectro `(sample))  ' Send audio/sensor samples
  waitms(1)
```

Each sample you send is buffered. When enough samples accumulate (default: 512), an FFT is performed and one row is added to the waterfall.

### Configuration Options

**Window Setup**:
```spin2
debug(`SPECTRO MySpectro title "Audio Analyzer" pos 100 50`)
```
- `TITLE 'text'` - Custom window title
- `POS x y` - Window position on screen

**FFT Configuration**:
```spin2
debug(`SPECTRO MySpectro samples 1024 0 127`)
```
- `SAMPLES n {first} {last}` - FFT size and frequency range (4-2048, power-of-2)
  - `n`: FFT size (default: 512)
  - `first`: First frequency bin to display (default: 0)
  - `last`: Last frequency bin to display (default: n/2-1)

**Waterfall Settings**:
```spin2
debug(`SPECTRO MySpectro depth 512 rate 64`)
```
- `DEPTH n` - Number of history rows (1-2048, default: 256)
  - More depth = longer history visible
- `RATE n` - Samples between FFT updates (default: samples/8)
  - Higher rate = slower updates, smoother display
  - Lower rate = faster updates, more detail

**Magnitude Control**:
```spin2
debug(`SPECTRO MySpectro mag 3 range 1000`)
```
- `MAG n` - Magnitude scaling (0-11, default: 0)
  - Acts as right-shift: 0=max sensitivity, 11=min sensitivity
- `RANGE n` - Maximum value for color mapping (default: 2147483647)
  - Magnitudes above this value saturate to white/bright

**Display Options**:
```spin2
debug(`SPECTRO MySpectro logscale dotsize 2 trace 15`)
```
- `LOGSCALE` - Enable logarithmic magnitude scale (compresses dynamic range)
- `DOTSIZE x {y}` - Pixel size (1-16, default: 1×1)
  - Makes waterfall rows taller/wider for visibility
- `TRACE n` - Scroll pattern (0-15, default: 15)
  - Controls scroll direction and orientation
- `HIDEXY` - Hide mouse coordinate display

### Color Modes

The SPECTRO window supports 6 color modes to visualize magnitude:

**Grayscale Modes** (luminance):
```spin2
debug(`SPECTRO MySpectro luma8`)    ' Standard grayscale
debug(`SPECTRO MySpectro luma8w`)   ' Grayscale with wrapping
debug(`SPECTRO MySpectro luma8x`)   ' Extended grayscale (default)
```

**HSV Modes** (hue-saturation-value with phase coloring):
```spin2
debug(`SPECTRO MySpectro hsv16`)    ' HSV with phase information
debug(`SPECTRO MySpectro hsv16w`)   ' HSV with wrapping
debug(`SPECTRO MySpectro hsv16x`)   ' Extended HSV
```

**HSV Phase Coloring**: In HSV16 modes, color represents the phase angle of the FFT, allowing you to see both magnitude (brightness) and phase (hue) simultaneously.

### Usage Examples

**Basic Audio Analyzer**:
```spin2
' Simple audio spectrogram
debug(`SPECTRO Audio samples 512 luma8x)

repeat
  sample := read_microphone()
  debug(`Audio `(sample))
  waitms(1)
```

**High-Resolution Frequency Analysis**:
```spin2
' Fine frequency resolution with large FFT
debug(`SPECTRO Fine samples 2048 0 236 range 1000 luma8x green)
debug(`Fine logscale depth 512)  ' Long history, log scale

repeat
  j += 2850 + qsin(2500, i++, 30_000)
  k := qsin(1000, j, 50_000)
  debug(`Fine `(k))
```

**Phase-Colored Spectrogram**:
```spin2
' HSV16 shows both magnitude (brightness) and phase (color)
debug(`SPECTRO Signal samples 1024 hsv16 logscale)

repeat
  signal := signal_generator()
  debug(`Signal `(signal))
```

**Compact Display with Scaling**:
```spin2
' Vertical orientation with scaled pixels
debug(`SPECTRO Compact samples 256 trace 6 dotsize 2 mag 3)

repeat
  debug(`Compact `(sensor_reading()))
  waitms(10)
```

### Understanding Trace Patterns

Trace patterns control how the waterfall scrolls and the orientation of the display:

**Patterns 0-3** (Horizontal, no scroll):
- Display fills left-to-right, top-to-bottom
- When full, continues from start (no scroll)

**Patterns 4-7** (Vertical, no scroll):
- Display fills top-to-bottom, left-to-right
- Width and height are swapped

**Patterns 8-11** (Horizontal with scroll):
- New rows push old rows off the edge
- Creates true waterfall effect

**Patterns 12-15** (Vertical with scroll):
- Same as 8-11 but rotated 90°
- Waterfall scrolls left/right instead of up/down

**Popular choices**:
- `TRACE 15` - Vertical waterfall scrolling down (default, most common)
- `TRACE 8` - Horizontal waterfall scrolling up
- `TRACE 6` - Vertical static display (90° clockwise)

### Common Commands

**Window Management**:
```spin2
debug(`SPECTRO MySpectro clear)   ' Clear waterfall and reset buffer
debug(`SPECTRO MySpectro update)  ' Force display refresh
debug(`SPECTRO MySpectro close)   ' Close the window
```

**Save Display**:
```spin2
debug(`SPECTRO MySpectro save 'spectrogram.bmp')  ' Save waterfall to file
```

### Tips and Best Practices

**Choosing FFT Size**:
- **Smaller (128-256)**: Fast updates, less frequency detail
- **Medium (512-1024)**: Good balance (most common)
- **Large (2048)**: Maximum frequency resolution, slower updates

**Setting MAG and RANGE**:
- Start with MAG=0 and RANGE=max (default)
- If display too bright → increase MAG (shift right)
- If display too dim → decrease RANGE to compress scale
- Use LOGSCALE for signals with wide dynamic range

**Using LOGSCALE**:
- Essential for audio (large amplitude variations)
- Helps visualize weak signals alongside strong ones
- Formula: `log2(mag+1) / log2(range+1) * range`

**Display Size**:
- DOTSIZE makes rows taller/wider for easier viewing
- Useful on high-resolution monitors
- Example: `DOTSIZE 2 1` makes rows 2× wider, same height

**Color Mode Selection**:
- **LUMA8X**: Best for general-purpose (default)
- **HSV16**: Shows phase information (advanced)
- **LUMA8/LUMA8W**: Alternative grayscale mappings

### Mouse Coordinate Display

Move your mouse over the spectrogram to see frequency bin and time information:

**Display format**: Coordinates show bin number and sample position
- Helps identify exact frequencies of interest
- Use with `HIDEXY` directive to disable if not needed

### Complete Example: Audio Spectrum Analyzer

```spin2
CON
  _clkfreq = 160_000_000

PUB main() | sample, i, j, k

  ' Configure high-resolution audio spectrogram
  debug(`SPECTRO AudioSpec title "Audio Analyzer" samples 1024 depth 512)
  debug(`AudioSpec range 5000 luma8x logscale dotsize 1 2)

  ' Generate test signal (two frequencies)
  repeat
    j += 2850 + qsin(2500, i++, 30_000)  ' Frequency modulation
    k := qsin(1000, j, 50_000)           ' Audio signal
    debug(`AudioSpec `(k))
    waitms(1)
```

### Troubleshooting

**Waterfall not scrolling?**:
- Check TRACE setting (patterns 8-15 enable scroll)
- Verify data is being sent continuously
- Ensure RATE setting allows updates

**Display too bright or too dim?**:
- Adjust MAG value (0-11)
- Reduce RANGE for dimmer signals
- Try LOGSCALE for better dynamic range

**Wrong orientation?**:
- Use TRACE patterns 0-7 for horizontal
- Use TRACE patterns 4-7 or 12-15 for vertical
- Patterns affect width/height calculation

**FFT not updating?**:
- Need to send at least SAMPLES values before first FFT
- RATE controls how often FFT runs (every RATE samples)
- Check that window was created successfully

**Performance issues?**:
- Reduce FFT size (512 or 256 instead of 2048)
- Increase RATE to update less frequently
- Decrease DEPTH for less history

## P2 Debugger

The Debugger window provides interactive debugging for P2 COGs.

### Opening the Debugger

The debugger opens automatically when:
1. Your P2 program hits a breakpoint
2. You manually break execution
3. An error condition occurs

### Main Display Areas

#### Disassembly View
Shows P2 assembly code with:
- Current program counter (PC) marker
- Breakpoint indicators
- Skip pattern visualization
- Both hex and decoded instructions

#### Register Maps
- **COG Registers**: 512 long registers (addresses $000-$1FF)
- **LUT Memory**: 512 long lookup table (addresses $200-$3FF)
- Heat map visualization shows recently accessed locations

#### HUB Memory Viewer
- Displays HUB RAM contents
- Mini-map for navigation
- Hex and ASCII display
- Memory modification capability

#### Status Displays
- **Flags**: Z, C, and condition code status
- **Stack**: 8-level hardware stack
- **Events**: Event counters and selectors
- **Interrupts**: Interrupt status and vectors
- **Pins**: I/O pin states (DIR/OUT/IN)
- **Smart Pins**: Configured smart pin modes

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space** | Resume execution (Go) |
| **B** | Break execution |
| **S** | Single step |
| **O** | Step over |
| **U** | Step out |
| **R** | Reset COG |
| **I** | Initialize |
| **D** | Toggle debug mode |
| **F9** | Toggle breakpoint |
| **Shift+F9** | Clear all breakpoints |
| **Arrows** | Navigate memory/code |
| **PageUp/Dn** | Page through memory |
| **Tab** | Cycle focus between views |
| **ESC** | Close debugger |

### Setting Breakpoints

#### Code Breakpoints
- Click on any instruction in the disassembly view
- Press F9 on the target line
- Double-click to toggle

#### Conditional Breakpoints
Right-click on an instruction to set conditions:
- Break when register equals value
- Break on specific flag states
- Break after N iterations

### Memory Inspection

#### Viewing Memory
- Click on any memory location to inspect
- Hover for quick value display
- Use mini-map for navigation

#### Modifying Memory
1. Double-click on a memory value
2. Enter new value (hex or decimal)
3. Press Enter to confirm

### Multi-COG Debugging

Debug multiple COGs simultaneously:
- Each COG gets its own debugger window
- Windows cascade automatically
- Synchronized breakpoints across COGs
- Global break/resume controls

### Advanced Features

#### Heat Maps
Memory access visualization:
- Blue: Cold (not accessed recently)
- Green: Warm (accessed recently)
- Yellow/Red: Hot (frequently accessed)
- Decay rate shows access patterns over time

#### Smart Pin Monitoring
- View configured smart pin modes
- Monitor pin states in real-time
- Decode smart pin configurations

#### Event Tracking
- Hardware event counters
- Event source selectors
- Interrupt status and history

## Recording & Playback

Record debug sessions for analysis and regression testing.

### Starting a Recording

#### Manual Recording
1. Click the **Record** button in the toolbar
2. Enter session metadata:
   - Name
   - Description
   - Tags (optional)
3. Click **Start Recording**

#### Automatic Recording
Recordings trigger automatically on:
- Breakpoint hits
- Error conditions
- High-frequency data bursts
- Multi-COG activity

### During Recording
- Red recording indicator shows active status
- Message count and duration displayed
- All debug windows capture data
- Binary and text messages preserved

### Stopping Recording
- Click **Stop** button
- Recording auto-stops after timeout
- Session saved to `recordings/` folder

### Playback

#### Loading a Recording
1. Click **Play** button in toolbar
2. Select recording from catalog
3. Choose playback options:
   - **Speed**: 0.5x, 1x, 2x, 5x
   - **Windows**: All or specific windows
   - **Mode**: Visual or validation-only

#### Playback Controls
- **Play/Pause**: Space bar
- **Step Forward**: Right arrow
- **Step Back**: Left arrow
- **Jump to Time**: Click on timeline
- **Loop**: Repeat playback

### Recording Catalog

Access via **Tools → Recording Catalog**:
- Browse all recordings
- Search by name, tags, date
- View session metadata
- Delete old recordings
- Export/import sessions

### Use Cases

#### Regression Testing
```javascript
// Run automated tests on recordings
npm run test:recordings
```

#### Bug Reports
1. Record the issue occurring
2. Export recording file
3. Attach to bug report
4. Developer can replay exactly

#### Teaching/Demos
- Record example sessions
- Students can replay and study
- Pause and examine any moment
- Step through complex operations

## Keyboard Shortcuts
## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+O** | Open file/port |
| **Ctrl+S** | Save current view |
| **Ctrl+R** | Start recording |
| **Ctrl+P** | Playback recording |
| **Ctrl+W** | Close current window |
| **Ctrl+Q** | Quit application |
| **F1** | Help |
| **F5** | Refresh/reconnect |
| **F11** | Fullscreen |

### Window Navigation

| Shortcut | Action |
|----------|--------|
| **Ctrl+Tab** | Next window |
| **Ctrl+Shift+Tab** | Previous window |
| **Alt+1-9** | Switch to window N |
| **Ctrl+N** | New terminal |

### Debug Controls

| Shortcut | Action |
|----------|--------|
| **F5** | Run/Continue |
| **F6** | Pause/Break |
| **F7** | Step into |
| **F8** | Step over |
| **F9** | Toggle breakpoint |
| **F10** | Step out |
| **Ctrl+F2** | Reset |

## Troubleshooting

### Connection Issues

#### P2 Not Detected
1. Check USB cable and connection
2. Verify P2 is powered on
3. Install FTDI drivers if needed
4. Try different USB port
5. Check Device Manager (Windows) or `ls /dev/tty*` (Mac/Linux)

#### Communication Errors
- Reduce baud rate (try 921600 or 460800)
- Enable DTR toggle
- Check for ground loops
- Use shorter USB cable
- Add powered USB hub for multiple devices

### Window Issues

#### Window Not Opening
- Check DEBUG command syntax
- Verify window name is unique
- Ensure sufficient memory
- Check console for errors

#### Poor Performance
- Reduce data rate from P2
- Close unused windows
- Increase buffer sizes
- Disable recording if not needed
- Check CPU/memory usage

### Data Issues

#### Missing Data
- Check P2 program is running
- Verify DEBUG commands executing
- Look for buffer overflows
- Check trigger settings
- Ensure proper data format

#### Corrupted Display
- Verify data format matches window type
- Check for protocol mismatches
- Clear buffers and restart
- Update to latest version

### Recording Issues

#### Recording Won't Start
- Check disk space
- Verify write permissions
- Close other recordings
- Check file path settings

#### Playback Problems
- Verify recording file intact
- Check version compatibility
- Ensure all windows available
- Try slower playback speed

### Getting Help

#### Built-in Help
- Press **F1** in any window
- Hover over controls for tooltips
- Check status bar for hints

#### Online Resources
- [GitHub Issues](https://github.com/parallaxinc/pnut-term-ts/issues)
- [Parallax Forums](https://forums.parallax.com)
- [P2 Documentation](https://www.parallax.com/propeller-2)

#### Debug Logs
Enable debug logging:
```bash
pnut-term --debug --log-level=trace
```

Log files location:
- Windows: `%APPDATA%\pnut-term\logs`
- macOS: `~/Library/Logs/pnut-term`
- Linux: `~/.config/pnut-term/logs`

## Advanced Topics

### Window Placement & Layouts

#### Automatic Window Placement (User Guide)

PNut-Term automatically arranges debug windows using an intelligent placement system that creates visually balanced layouts. Windows appear in a predictable pattern that grows outward from the screen center:

**Window Appearance Order:**
1. **First window** → Top center
2. **Second & third** → Left and right of center
3. **Fourth window** → Middle center (one row down)
4. **Additional windows** → Fill remaining positions in balanced pattern

**Key Benefits:**
- **Center-balanced layouts** maintain visual harmony
- **No manual positioning** required - works automatically
- **Collision avoidance** prevents windows from overlapping
- **Multi-monitor support** adapts to your display setup

**Common Window Arrangements:**
- **1-3 windows**: Horizontal line across top
- **4-6 windows**: Balanced rectangle pattern
- **7+ windows**: Expands to screen edges maintaining symmetry

To manually arrange windows:
1. Drag windows to desired positions
2. **Window → Save Layout** to preserve arrangement
3. **Window → Load Layout** to restore saved arrangement

#### Debug Window Types & Placement

**Standard Debug Windows (8 types):**
- **LOGIC** - Logic analyzer display
- **TERM** - Terminal text output
- **SCOPE** - Oscilloscope waveforms
- **SCOPE_XY** - XY coordinate plotting
- **PLOT** - Data plotting with dots
- **BITMAP** - Pixel graphics display
- **MIDI** - MIDI data visualization
- **FFT** - Frequency spectrum analysis

**Special Debugger Windows:**
- **Single-step debugger**: Appears in dedicated slots using larger window sizes
- **COG debuggers**: Each P2 COG gets its own debugger window when accessed
- **Side-by-side mode**: Multiple debugger windows arrange horizontally
- **Cascaded mode**: Debugger windows stack with offset positioning

#### Advanced Placement Control (Administrator Guide)

**Half-Moon Descending Algorithm:**

The placement system uses a sophisticated "Half-Moon Descending Algorithm" that creates center-balanced arrangements:

**Technical Details:**
- **Grid-based placement**: Monitor divided into 3×3, 5×3, or 5×4 grid depending on resolution
- **Adaptive sizing**: Grid automatically adjusts to monitor dimensions
  - 1440p+ monitors: 5×3 grid (15 positions)
  - 1080p+ monitors: 3×3 grid (9 positions)
  - 4K+ monitors: 5×4 grid (20 positions)
- **Balance principle**: Maintains symmetry around center column
- **Phase expansion**: Starts narrow, expands wider as more windows added

**Placement Sequence (5×3 Grid Example):**
1. **R0_C2** - Top center (balance: 0L,1C,0R)
2. **R0_C1, R0_C3** - Top left/right-center (balanced: 1L,1C,1R)
3. **R1_C2** - Middle center (balanced: 1L,2C,1R)
4. **R1_C1, R1_C3** - Middle left/right-center (balanced: 2L,2C,2R)
5. **R0_C0, R0_C4** - Top far edges (balanced: 3L,2C,3R)
6. **R1_C0, R1_C4** - Middle far edges (balanced: 4L,2C,4R)

**Reserved Positions:**
- **Bottom center**: Reserved for main application window
- **Bottom right**: Reserved for debug logger window
- **Collision zones**: Large windows automatically block adjacent cells

**Multi-Monitor Behavior:**
- **Primary monitor**: Preferred for window placement
- **Secondary monitors**: Used when primary monitor full
- **Monitor detection**: Automatically adapts to display configuration changes
- **Coordinate handling**: Smart positioning prevents windows appearing off-screen

**Debugger Window Placement:**

**Single P2 Debugger:**
- Uses **DEBUGGER strategy** with larger dedicated area
- Positions in **upper-left quadrant** to avoid interference with data windows
- **Minimum 800×600 size** for comprehensive register/memory display

**Multiple COG Debuggers:**
- **Side-by-side arrangement**: Horizontal layout for comparing COG states
- **Cascaded positioning**: Staggered windows when screen space limited
- **Automatic sizing**: Each debugger window sized based on available space
- **COG-specific placement**: COG0 takes priority position, others arrange around it

**COG Logger Windows (Show All 8 COGs):**

When you click "Show All 8 COGs" from the Debug Logger window, eight individual COG logger windows appear using an adaptive 4×2 grid layout optimized for laptop screens:

**Grid Layout (4 rows × 2 columns):**
```
COG 0  COG 4
COG 1  COG 5
COG 2  COG 6
COG 3  COG 7
```

**Adaptive Terminal Sizing:**

COG logger windows are text terminals that automatically adapt to your screen size:

- **Large screens (≥1640px available width):**
  - **80×24 terminal** (820×442 window)
  - Spacious layout with full 80-character lines
  - Recommended for desktop monitors and high-resolution displays

- **Medium screens (1320-1639px available width):**
  - **64×24 terminal** (660×442 window)
  - Comfortable layout for standard laptop screens (1440×900, 1920×1080)
  - Maintains 24-row height for good readability

- **Small screens (<1320px available width):**
  - **48×24 terminal** (540×442 window)
  - Compact layout for smaller laptops (1366×768)
  - Minimal but still readable with 24-row height preserved

**Design Rationale:**

- **Vertical orientation**: 4 rows × 2 columns works better than 2 rows × 4 columns on laptop screens where width is more constrained than height
- **24-row height preserved**: All size tiers maintain 24 visible lines for consistent readability
- **Width reduction strategy**: When space is limited, reduce character columns (80→64→48) rather than reducing row count
- **Terminal-based sizing**: Window dimensions are calculated from character grid size (chars × 10px, lines × 18px) plus padding for menu/status bars

**Common Screen Sizes:**

| Screen Resolution | COG Window Size | Terminal Size | Layout Quality |
|-------------------|-----------------|---------------|----------------|
| 2560×1440+ | 820×442 | 80×24 | Spacious ✅ |
| 1920×1080 | 820×442 | 80×24 | Comfortable ✅ |
| 1440×900 | 660×442 | 64×24 | Acceptable ✅ |
| 1366×768 | 660×442 | 64×24 | Compact but workable ✅ |

**Collision Detection & Oversized Windows:**
- **Width overflow**: Large windows mark adjacent horizontal cells as occupied
- **Height overflow**: Tall windows mark cells below as occupied
- **Safety margins**: 20px minimum spacing maintained between all windows
- **Boundary handling**: Oversized windows repositioned to fit available space

**Troubleshooting Placement Issues:**
- **Windows appearing wrong location**: Check monitor configuration in system settings
- **Overlapping windows**: Restart application to reset placement tracking
- **Missing windows**: Check if windows moved off-screen (Window → Show All)
- **Small monitors**: Some window types may cascade when grid space insufficient

**Configuration Options:**
- Placement behavior controlled via **preferences** (if available)
- **Debug logging**: Enable detailed placement logging for troubleshooting
- **Manual override**: Drag windows to preferred positions and save layout

### Scripting

Automate debug sessions with scripts:

```javascript
// automation.js
const { Terminal, Debugger } = require('pnut-term-api');

async function runTests() {
  const term = await Terminal.connect('/dev/ttyUSB0');
  
  // Start P2 program
  await term.loadBinary('test.binary');
  
  // Set breakpoint
  const dbg = await Debugger.open(0); // COG 0
  await dbg.setBreakpoint(0x1000);
  
  // Run and wait for break
  await dbg.run();
  await dbg.waitForBreak();
  
  // Inspect memory
  const value = await dbg.readLong(0x2000);
  console.log('Value:', value);
}
```

### Serial Communication Architecture

#### High-Performance Binary Protocol
The P2 Debug Terminal uses a direct raw binary communication pipeline optimized for the Propeller 2's mixed ASCII/binary debug protocol:

**Key Features:**
- **Zero-copy data path** from serial port to message processors
- **No UTF-8 conversion overhead** - binary data remains binary
- **Manual P2 detection** without parser interference
- **Guaranteed delivery** using drain() after writes
- **Two-Tier Pattern Matching** for robust message extraction

**Technical Implementation:**
1. **Raw Buffer Processing**: All serial data handled as raw bytes
2. **Pattern Recognition**: Hardware-optimized sync pattern detection
3. **Message Routing**: Direct dispatch to specialized debug windows
4. **Circular Buffering**: Lock-free buffers prevent data loss at high speeds

**Performance Benefits:**
- Supports full 16 Mbps debug speeds
- Enables P2 checksum verification during downloads
- Zero null-byte corruption in binary streams
- Microsecond-precision timing preservation

#### DTR/RTS Control Lines
The terminal supports both DTR and RTS control for different USB adapters:
- **Parallax Prop Plugs**: Use DTR (default)
- **FTDI USB adapters**: Usually DTR
- **Generic adapters**: May require RTS

Control lines trigger P2 reset and provide visual log separation.

### Performance Tuning

#### High-Speed Data
For data rates >1 Mbps:
1. Buffer sizes auto-adjust for optimal throughput
2. Binary protocol preserved without conversion
3. Hardware flow control optional (not required)
4. Pattern matching handles any data rate
5. Use recording for zero-loss capture

#### Multiple Windows
When running many windows:
1. Cascade or tile for visibility
2. Minimize hidden windows
3. Use window groups
4. Close unnecessary views
5. Monitor system resources

### Integration

#### VS Code Extension
Install the P2 Debug Terminal extension:
1. Open VS Code
2. Extensions → Search "P2 Debug"
3. Install and configure
4. Debug directly from editor

#### Command Line
See the comprehensive Command-Line Reference section below for all available options and examples.

## Command-Line Reference

### Overview

PNut-Term-TS provides a full command-line interface for launching the GUI, downloading binaries, and integrating with IDEs like VSCode.

### Getting Help

```bash
pnut-term-ts --help        # Show all options and examples
pnut-term-ts --version     # Show version and startup directory
```

### Command-Line Options

#### File Download Options
- **`-r, --ram <fileSpec>`** - Download binary to RAM and run
- **`-f, --flash <fileSpec>`** - Download binary to FLASH and run

#### Serial Port Options
- **`-p, --plug <dvcNode>`** - Specify serial device (e.g., P9cektn7, /dev/ttyUSB0, COM3)
  - Auto-detects if only one USB device connected
- **`-b, --debugbaud <rate>`** - Set debug baud rate (default: 2000000)
  - Common rates: 115200, 230400, 460800, 921600, 2000000
- **`-n, --dvcnodes`** - List all available USB PropPlug devices

#### Mode Options
- **`--ide`** - IDE mode (minimal UI for VSCode/IDE integration)
- **`--rts`** - Use RTS instead of DTR for device reset
  - Works in both standalone and IDE modes
  - Required for some non-Parallax USB adapters

#### Logging Options
- **`-d, --debug`** - Output Term-TS debug messages
- **`-v, --verbose`** - Output Term-TS verbose messages
- **`-q, --quiet`** - Quiet mode (suppress banner and non-error text)
- **`-u, --log-usb-trfc`** - Enable USB traffic logging (timestamped log file)

#### Special Options
- **`--console-mode`** - Running with console output (adds delay before close)
- **`-V, --version`** - Display version number and startup directory

### Usage Examples

#### Basic Usage

```bash
# Launch GUI (auto-detects single USB device)
pnut-term-ts

# Launch with specific device
pnut-term-ts -p P9cektn7

# List available devices
pnut-term-ts -n
```

#### Download to P2

```bash
# Download to RAM (auto-detects device)
pnut-term-ts -r myprogram.bin

# Download to RAM with specific device
pnut-term-ts -r myprogram.bin -p /dev/ttyUSB0

# Download to FLASH
pnut-term-ts -f myprogram.bin -p COM3

# Download with custom baud rate
pnut-term-ts -r myprogram.bin -b 115200
```

#### IDE Integration

```bash
# IDE mode (for VSCode SPIN2 extension)
pnut-term-ts --ide

# IDE mode with specific device
pnut-term-ts --ide -p P9cektn7

# IDE mode with RTS control line
pnut-term-ts --ide --rts -p P9cektn7
```

#### Debugging and Logging

```bash
# Enable verbose output
pnut-term-ts -v

# Enable debug messages
pnut-term-ts -d

# Enable USB traffic logging
pnut-term-ts -u -p P9cektn7

# Combine options
pnut-term-ts -v -u -r test.bin
```

#### Advanced Usage

```bash
# Quiet mode (no banner)
pnut-term-ts -q -r production.bin

# Console mode with delay before close
pnut-term-ts --console-mode -r test.bin

# Multiple options combined
pnut-term-ts -v -d -u -b 921600 -r debug.bin -p COM5
```

### Device Selection Behavior

**Auto-Detection:**
- If **only one** USB serial device is connected, it's automatically selected
- No need to specify `-p` option in this case

**Multiple Devices:**
- Use `-n` to list all available devices
- Use `-p` to specify which device to use

**Device Name Formats:**
- **macOS**: `/dev/tty.usbserial-P9cektn7` or just `P9cektn7`
- **Linux**: `/dev/ttyUSB0` or `/dev/ttyACM0`
- **Windows**: `COM3`, `COM4`, etc.

### IDE Mode vs. Standalone Mode

| Feature | Standalone Mode | IDE Mode (`--ide`) |
|---------|----------------|-------------------|
| **UI** | Full GUI with menus | Minimal UI |
| **DTR/RTS Control** | Toolbar buttons | Controlled by IDE |
| **File Downloads** | GUI file picker | Command-line only |
| **Intended Use** | Interactive debugging | VSCode integration |

### Understanding DTR and RTS

**DTR (Data Terminal Ready):**
- Used by **Parallax PropPlug** devices (default)
- Standard control line for P2 reset

**RTS (Request To Send):**
- Used by some **non-Parallax** USB adapters
- Use `--rts` flag when your adapter requires RTS

**How to know which to use:**
- If DTR reset doesn't work, try `--rts`
- Check your USB adapter documentation
- FTDI adapters usually use DTR
- Generic CH340/CP2102 adapters may use RTS

### Exit Codes

- **0** - Success
- **1** - Error (check error messages for details)

### Platform-Specific Notes

#### macOS

Add to PATH for easy access:
```bash
export PATH="/Applications/PNut-Term-TS.app/Contents/Resources/bin:$PATH"
```

#### Windows

Add installation directory to PATH environment variable, then use from any command prompt:
```cmd
pnut-term-ts -r myprogram.bin
```

#### Linux

The executable is in the bin directory of the extracted package:
```bash
./pnut-term-ts -r myprogram.bin
```

## Automation and External Control

### Background Operation
PNut-Term-TS can run in the background and be controlled externally, useful for automated testing, CI/CD pipelines, or integration with other tools.

#### Starting in Background
```bash
# Start terminal monitoring in background
pnut-term-ts -p /dev/ttyUSB0 &
PID=$!

# Capture output to file
pnut-term-ts -p /dev/ttyUSB0 2>&1 | tee session.log &
```

#### External Control Signals
Control the running instance using Unix signals:

```bash
# Reset the connected hardware (DTR/RTS pulse)
kill -USR1 $PID

# Graceful shutdown (saves state, closes cleanly)
kill -TERM $PID

# Also works with Ctrl+C in foreground
# (handled gracefully with SIGINT)
```

#### Automation Example
```bash
#!/bin/bash
# Automated test script

# Start terminal
pnut-term-ts -p /dev/ttyUSB0 &
PID=$!

# Download and run test
pnut-term-ts -r test.bin -p /dev/ttyUSB0

# Reset hardware
kill -USR1 $PID

# Monitor for 30 seconds
sleep 30

# Clean shutdown
kill -TERM $PID
```

#### Use Cases
- **Continuous Integration**: Automated hardware testing
- **Remote Development**: Control from SSH sessions
- **AI Assistants**: External tools can control hardware
- **Batch Processing**: Script multiple test scenarios
- **Monitoring**: Long-running data collection

**Note**: Signal support varies by platform:
- Linux/macOS: Full support
- Windows: Limited to SIGTERM/SIGINT
- Docker: Full support

## Conclusion

---

## Tips & Best Practices

### Recording Sessions
1. **Name recordings descriptively** when saving manually
2. **Document test conditions** in a companion text file or README
3. **Keep recordings organized** in project-specific folders
4. **Compress old recordings** to save disk space (.p2rec files compress well)
5. **Build regression test library** of edge cases and known issues

### Performance Optimization
1. **Close unused windows** to reduce processing load and queue depth
2. **Monitor Performance Monitor** regularly to track system health
3. **Adjust buffer sizes** if you see frequent overflow events
4. **Use appropriate baud rates** for your data volume (don't always use max)
5. **Watch queue depths** in Performance Monitor to spot bottlenecks early

### Debug Workflow
1. **Start recording before debugging** complex issues to capture exact conditions
2. **Use Performance Monitor** to track system health during testing
3. **Save interesting sessions** for later analysis or sharing with team
4. **Share recordings** instead of screenshots - exact reproduction beats description
5. **Create regression tests** from recordings of fixed bugs

### Settings Management
1. **Set User Defaults** for your typical workflow once
2. **Use Project Overrides** sparingly - only when truly project-specific
3. **Document project-specific settings** in your project README
4. **Test different baud rates** to find optimal balance of speed and reliability
5. **Enable USB logging** only when debugging low-level communication issues

### Connection Strategies
1. **Development mode**: Enable "Reset on Connection" for clean starts
2. **Monitoring mode**: Disable "Reset on Connection" to observe running programs
3. **IDE integration**: Let command-line mode handle resets automatically
4. **DTR vs RTS**: Know which your hardware uses, set preferences accordingly
5. **Auto-reconnect**: Consider enabling for long-running sessions

---

## Support & Resources

### Getting Help
- **GitHub Issues**: Report bugs and request features at https://github.com/ironsheep/PNut-Term-TS/issues
- **Documentation**: Complete guide at https://github.com/ironsheep/PNut-Term-TS/wiki
- **Community Forum**: Parallax Forums P2 section for community support
- **Email**: support@ironsheep.biz for direct technical support

### Additional Resources
- **Propeller 2 Documentation**: https://propeller.parallax.com/p2.html
- **DEBUG Command Reference**: Built into P2 documentation
- **Example Code**: See `examples/` directory in installation
- **Video Tutorials**: Available on Parallax YouTube channel

---

## Conclusion

PNut-Term-TS provides a comprehensive debugging environment for the Parallax Propeller 2, combining real-time visualization with powerful recording and playback capabilities. Whether you're developing new code, debugging complex issues, or documenting system behavior, the specialized debug windows and flexible preference system adapt to your workflow.

Key takeaways:
- Debug windows open automatically from P2 DEBUG commands
- Recording system captures exact sessions for regression testing
- Preferences hierarchy (App → User → Project) provides flexibility
- Performance Monitor helps optimize your debug workflow
- Connection behavior adapts to development vs monitoring use cases

Happy debugging!

---

*© 2024-2025 Iron Sheep Productions LLC*  
*Licensed under MIT License*  
*Version 0.9.0 - November 2025*

