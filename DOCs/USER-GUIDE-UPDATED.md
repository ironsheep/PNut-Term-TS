# PNut-Term-TS User Guide
*Version 0.9.85 - Updated September 2025*

## Table of Contents
1. [Introduction](#introduction)
2. [Installation & Setup](#installation--setup)
3. [Menu Structure](#menu-structure)
4. [Dialog Windows](#dialog-windows)
5. [Recording & Playback System](#recording--playback-system)
6. [Debug Windows](#debug-windows)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

PNut-Term-TS is a comprehensive debug terminal for the Parallax Propeller 2 (P2) microcontroller. It provides real-time visualization, interactive debugging, and session recording capabilities through specialized windows that interpret DEBUG commands from your P2 programs.

### Key Features
- **Real-time data streaming** at up to 16 Mbps
- **Binary recording system** for capturing and replaying debug sessions
- **Performance monitoring** with live metrics
- **Customizable preferences** for terminal behavior
- **Cross-platform support** (Windows, macOS, Linux)

---

## Installation & Setup

### System Requirements
- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 20.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Display**: 1920x1080 minimum resolution
- **USB**: USB 2.0 or higher for P2 connection

### Quick Start
1. Download the appropriate package for your platform
2. Extract the archive
3. Run the setup script (SETUP.command on macOS)
4. Connect your P2 device
5. Launch PNut-Term-TS

---

## Menu Structure

The application menu has been streamlined for better workflow:

### File Menu
- **New Recording** - Start a new debug session recording
- **Open Recording...** - Load and playback a .p2rec file
- **Save Recording As...** - Save current recording to disk
- ─────────────
- **Start Recording** (Ctrl+R) - Begin recording debug data
- **Stop Recording** - End current recording session
- **Playback Recording** (Ctrl+P) - Play selected recording
- ─────────────
- **Exit** (Ctrl+Q) - Close the application

### Edit Menu
- **Cut** (Ctrl+X) - Cut selected text
- **Copy** (Ctrl+C) - Copy selected text
- **Paste** (Ctrl+V) - Paste from clipboard
- ─────────────
- **Find...** (Ctrl+F) - Search in terminal output
- **Clear Terminal** - Clear terminal display
- ─────────────
- **Preferences...** (Ctrl+,) - Open settings dialog

### Window Menu
- **Performance Monitor** - Open performance metrics window
- ─────────────
- **Cascade** - Arrange windows in cascade
- **Tile** - Tile all windows
- ─────────────
- **Show All Windows** - Make all windows visible
- **Hide All Windows** - Hide all debug windows

### Help Menu
- **Documentation** (F1) - Open online documentation
- ─────────────
- **About PNut-Term-TS** - Version and copyright info

> **Note**: The Debug menu has been removed. Debug windows are now opened automatically by P2 DEBUG commands, not manually from the application menu.

---

## Dialog Windows

### Preferences Dialog (Edit → Preferences)

The Preferences dialog provides comprehensive control over terminal behavior:

#### Terminal Settings
- **Terminal Mode**: Choose between PST (Parallax Serial Terminal) or ANSI modes
- **Color Theme**: Select from multiple themes
  - Green on Black (classic terminal)
  - White on Black (high contrast)
  - Amber on Black (retro CRT)
- **Font Size**: Adjust from 10-24pt
- **Show COG Prefixes**: Display COG source indicators
- **Local Echo**: Echo typed characters locally

#### Serial Port Settings
- **Control Line**: Select DTR or RTS for reset control
  - DTR: Standard for Parallax Prop Plug
  - RTS: Some USB adapters use RTS
- **Default Baud Rate**: 115200 to 2000000
- **Auto-Reconnect**: Automatically reconnect on disconnect

#### Logging Settings
- **Log Directory**: Set where log files are saved (default: ./logs/)
- **Auto-Save Debug Output**: Automatically save all debug data
- **New Log on DTR Reset**: Create fresh log file on reset
- **Max Log Size**: Limit log file size (1MB, 10MB, 100MB, or unlimited)

> **Note**: Settings currently apply to the active session only. Persistence across sessions will be added in a future update.

### Performance Monitor (Window → Performance Monitor)

The Performance Monitor provides real-time system metrics:

#### Live Metrics Panel
- **Throughput Graph**: Sparkline showing data rate over time
- **Buffer Usage**: Visual percentage bar of circular buffer utilization
- **Queue Depth**: Number of messages waiting for processing
- **Status Indicator**: System health at a glance
  - ✓ Normal operation
  - ~ Light load
  - ! Heavy load
  - ⚠ Warning state
  - ✗ Error condition

#### Buffer Details
- **Buffer Size**: Total buffer capacity in KB
- **Used/Available**: Current usage statistics
- **High Water Mark**: Maximum usage reached
- **Overflow Events**: Count of data loss events

#### Message Routing
- **Total Messages**: Cumulative message count
- **Messages/sec**: Current throughput rate
- **Recording Status**: Active/Inactive with size
- **Parse Errors**: Count of malformed messages

#### Active Windows
Lists all open debug windows with their individual queue depths for monitoring processing load.

### New Recording Dialog (File → New Recording)

The New Recording dialog adapts based on recording state:

#### When No Recording Active
- Shows target path: `./recordings/recording_[timestamp].p2rec`
- **Start** button creates recordings folder if needed
- Begins capturing immediately

#### When Recording Active
- Displays warning: "Current recording will be saved"
- Shows current message count
- **Save & Start New**: Saves current, starts fresh
- **Cancel**: Continue current recording

---

## Recording & Playback System

### Overview
The recording system captures raw serial data with precise timing for later playback. This is invaluable for:
- **Regression Testing**: Verify fixes don't break existing functionality
- **Bug Reproduction**: Share exact debug sessions with team members
- **Performance Analysis**: Study timing-critical behaviors offline
- **Documentation**: Create reproducible examples

### Binary Format (.p2rec)
The recording format captures every byte with microsecond precision:

```
[4 bytes] Delta time (ms since start)
[2 bytes] Data length
[N bytes] Raw serial data
```

This format ensures perfect reproduction of the original debug session, including timing.

### Recording Workflow

#### Starting a Recording
1. **Toolbar Method**: Click ⏺ Record button
2. **Menu Method**: File → Start Recording
3. **New Recording Dialog**: File → New Recording

The recordings folder (`./recordings/`) is created automatically on first use.

#### During Recording
- Status bar shows "Recording..."
- Record button changes to ⏹ Stop
- All serial data is captured with timestamps
- Message count visible in New Recording dialog

#### Stopping Recording
- Click ⏹ Stop button or File → Stop Recording
- File automatically saved with timestamp
- Ready for immediate playback

### Playback System

#### Loading a Recording
1. File → Open Recording or click ▶ Play button
2. Select .p2rec file from file dialog
3. Playback controls appear automatically

#### Playback Controls Panel
When playing a recording, controls appear below the toolbar:

- **▶ Play / ⏸ Pause**: Start or pause playback
- **⏹ Stop**: End playback and hide controls
- **Progress Bar**: Shows position, click to seek
- **Time Display**: Shows elapsed / total time
- **Speed Selector**: 0.5x, 1x, or 2x playback speed

#### During Playback
- Data is injected as if arriving from serial port
- All debug windows respond normally
- Timing matches original capture
- Can pause, seek, or change speed at any time

#### Use Cases
- **Debugging**: Replay problematic sessions repeatedly
- **Testing**: Verify debug windows handle data correctly
- **Training**: Create example sessions for learning
- **Documentation**: Record demos of debug features

---

## Debug Windows

Debug windows open automatically when your P2 program sends appropriate DEBUG commands. Each window type serves specific visualization needs:

### Available Window Types
1. **Terminal** - Text output and ANSI graphics
2. **Logic Analyzer** - Digital signal visualization
3. **Oscilloscope** - Analog waveform display
4. **XY Scope** - Lissajous patterns and phase relationships
5. **Plot** - Real-time data plotting
6. **Bitmap** - Image and pixel data display
7. **MIDI Monitor** - MIDI message visualization
8. **FFT Analyzer** - Frequency spectrum analysis
9. **Debugger** - Interactive P2 debugging
10. **Debug Logger** - Message capture and filtering

> **Important**: Debug windows cannot be opened manually. They appear automatically when P2 code sends matching DEBUG commands.

---

## Keyboard Shortcuts

### Global Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+, | Open Preferences |
| Ctrl+R | Start/Stop Recording |
| Ctrl+P | Playback Recording |
| Ctrl+F | Find in Terminal |
| Ctrl+Q | Quit Application |
| F1 | Open Documentation |

### Terminal Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+C | Copy selection |
| Ctrl+V | Paste |
| Ctrl+A | Select all |
| Ctrl+L | Clear terminal |

---

## Troubleshooting

### Connection Issues
- **Device not detected**: Check USB cable and driver installation
- **Permission denied**: On Linux/macOS, add user to dialout group
- **Wrong baud rate**: Check Preferences → Serial Port settings

### Performance Issues
- **Slow response**: Open Performance Monitor to check buffer usage
- **Data loss**: Reduce baud rate or close unused debug windows
- **High CPU usage**: Disable unnecessary visual effects in Preferences

### Recording Problems
- **Can't start recording**: Check disk space and permissions
- **Playback timing off**: Ensure system isn't under heavy load
- **Large file sizes**: Use max log size setting to limit growth

### Window Issues
- **Windows not opening**: Verify P2 code sends correct DEBUG commands
- **Layout problems**: Use Window → Show All Windows to reset
- **Content not updating**: Check Performance Monitor for queue depth

---

## Tips & Best Practices

### Recording Sessions
1. **Name recordings descriptively** when saving
2. **Document test conditions** in a companion text file
3. **Keep recordings organized** in project folders
4. **Compress old recordings** to save disk space

### Performance Optimization
1. **Close unused windows** to reduce processing load
2. **Adjust buffer sizes** in Performance Monitor
3. **Use appropriate baud rates** for your data volume
4. **Monitor queue depths** to spot bottlenecks

### Debug Workflow
1. **Start recording before debugging** to capture issues
2. **Use Performance Monitor** to track system health
3. **Save interesting sessions** for later analysis
4. **Share recordings** with team for collaboration

---

## Support

For additional help:
- **GitHub Issues**: Report bugs and request features
- **Documentation**: https://github.com/ironsheep/PNut-Term-TS/wiki
- **Community Forum**: Parallax Forums P2 section

---

*© 2024 Iron Sheep Productions LLC*
*Licensed under MIT*