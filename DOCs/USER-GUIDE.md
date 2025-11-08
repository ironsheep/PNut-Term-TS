# PNut-Term-TS User Guide

*Version 0.9.0*

## Table of Contents

### Part 1: Getting Started
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Operating Modes](#operating-modes)
4. [Quick Start](#quick-start)

### Part 2: Core Features
5. [Menu System](#menu-system)
6. [Settings & Preferences](#settings--preferences)
7. [Recording & Playback](#recording--playback)
8. [Performance Monitoring](#performance-monitoring)

### Part 3: Debug Windows
9. [Debug Windows Reference](#debug-windows-reference)

### Part 4: Reference
10. [Command-Line Reference](#command-line-reference)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [Troubleshooting](#troubleshooting)
13. [Tips & Best Practices](#tips--best-practices)

---

## Introduction

PNut-Term-TS provides a debugging environment for Parallax Propeller 2 (P2) microcontrollers. The terminal interprets DEBUG commands from P2 programs, displaying data through specialized visualization windows and recording sessions for later analysis.

### Key Features
- 9 specialized debug windows for data visualization
- Real-time data streaming at up to 2 Mbps
- Binary recording and playback system
- Live performance monitoring
- Hierarchical settings (application/user/project)
- Cross-platform support (Windows, macOS, Linux)

---

## Installation

### System Requirements
- Operating System: Windows 10+, macOS 10.14+, or Linux (Ubuntu 20.04+)
- RAM: 4GB minimum, 8GB recommended
- Display: 1920x1080 minimum resolution
- USB 2.0 or higher for P2 connection

### Download and Install

#### Windows
1. Download latest release from https://github.com/ironsheep/PNut-Term-TS/releases
2. Extract `pnut-term-win-x64.zip`
3. Run `pnut-term-ts.exe` from extracted folder

#### macOS
1. Download latest release from https://github.com/ironsheep/PNut-Term-TS/releases
2. Extract `pnut-term-mac-x64.zip`
3. Run `SETUP.command` to add to PATH
4. Launch with `pnut-term-ts` from Terminal

#### Linux
1. Download latest release from https://github.com/ironsheep/PNut-Term-TS/releases
2. Extract `pnut-term-linux-x64.zip`
3. Run `./pnut-term-ts` from extracted folder

---

## Operating Modes

PNut-Term-TS operates in three distinct modes depending on how it's launched:

### 1. Interactive Mode
Launch in project directory for manual control of downloads and debugging.

```bash
cd /my/project
pnut-term-ts
```

**Behavior:**
- Opens main window with toolbar
- Connects to P2 (auto-detects single USB device)
- Waits for user interaction
- Manual control of downloads via menu/toolbar
- "Reset P2 on Connection" preference controls initial reset

**Use Cases:**
- Active development and testing
- Manual download control
- Interactive debugging sessions

### 2. Command-Line Download Mode
Launch with binary file for immediate download and execution.

```bash
pnut-term-ts -r myprogram.binary    # Download to RAM
pnut-term-ts -f myprogram.binary    # Download to Flash
```

**Behavior:**
- Connects without initial reset (ignores preference)
- Downloads specified file immediately
- Resets P2 into bootloader at precise moment
- Begins capturing debug output after download
- Continues in interactive mode

**Use Cases:**
- Automated testing scripts
- Quick program deployment
- Command-line workflows

### 3. IDE Integration Mode
Launched by VS Code or other IDEs with special flags.

```bash
pnut-term-ts --ide -r myprogram.binary
```

**Behavior:**
- Minimal UI mode (no menus/toolbars may be shown)
- Automatic download and execution
- Output streamed back to IDE
- May auto-close on program termination
- Special error reporting for IDE parsing

**Use Cases:**
- VS Code integration
- IDE build/run commands
- Automated build systems

---

## Quick Start

See `QUICK-START.md` for immediate startup instructions.

### Key Concepts

**Debug Windows**: Open automatically when P2 sends DEBUG commands. Cannot be opened manually from menus.

**Connection Behavior**: Controlled by "Reset P2 on Connection" preference:
- Enabled: Resets P2 on connect (development mode)
- Disabled: Connects without reset (monitoring mode)

**Recording**: Capture entire debug sessions to `.p2rec` files for later playback and analysis.

---

## Menu System

### File Menu
| Item | Shortcut | Description |
|------|----------|-------------|
| New Recording | | Start new debug session recording |
| Open Recording... | | Load and playback .p2rec file |
| Save Recording As... | | Save current recording to disk |
| Start Recording | Ctrl+R | Begin recording debug data |
| Stop Recording | | End current recording session |
| Playback Recording | Ctrl+P | Play selected recording |
| Exit | Ctrl+Q | Close application |

### Edit Menu
| Item | Shortcut | Description |
|------|----------|-------------|
| Cut | Ctrl+X | Cut selected text |
| Copy | Ctrl+C | Copy selected text |
| Paste | Ctrl+V | Paste from clipboard |
| Find... | Ctrl+F | Search in terminal output |
| Clear Terminal | | Clear terminal display |
| Preferences... | Ctrl+, | Open settings dialog |

### Window Menu
| Item | Description |
|------|-------------|
| Performance Monitor | Open performance metrics window |
| Cascade | Arrange windows in cascade layout |
| Tile | Tile all windows in grid layout |
| Show All Windows | Make all windows visible |
| Hide All Windows | Hide all debug windows |

### Help Menu
| Item | Shortcut | Description |
|------|----------|-------------|
| Documentation | F1 | Open user guide |
| About PNut-Term-TS | | Version and copyright information |

**Note**: Debug windows open automatically from P2 DEBUG commands, not from menus.

---

## Settings & Preferences

Access preferences via Edit → Preferences or Ctrl+,

### Settings Hierarchy

Settings cascade in priority order:
1. **Project Settings** (if present): `./.pnut-term-ts-settings.json`
2. **User Settings**: Platform-specific location
3. **Application Defaults**: Built-in baseline

### Preferences Dialog Tabs

#### User Settings Tab
Global preferences applying to all projects.

**Storage Location:**
- Windows: `%APPDATA%\PNut-Term-TS\settings.json`
- macOS/Linux: `~/.pnut-term-ts-settings.json`

#### Project Settings Tab
Project-specific overrides with checkboxes. Only checked items override user settings (delta-save strategy).

### Configuration Categories

#### Terminal Settings
| Setting | Options | Default |
|---------|---------|---------|
| Terminal Mode | Classic, Split View, Debug Only | Classic |
| Color Theme | Dark, Light, High Contrast, Solarized | Dark |
| Font Size | 10-24 pixels | 14px |
| Font Family | Platform-specific monospace fonts | Platform default |
| Show COG Prefixes | On/Off | On |
| Local Echo | On/Off | Off |

#### Serial Port Settings
| Setting | Options | Default |
|---------|---------|---------|
| Control Line | DTR, RTS | DTR |
| Default Baud Rate | 115200 to 2000000 | 2000000 |
| Reset P2 on Connection | Enabled/Disabled | Enabled |

**Reset Behavior:**
- Enabled: Resets P2 on connect (development mode)
- Disabled: Connects without reset (monitoring mode)

#### Logging Settings
| Setting | Options | Default |
|---------|---------|---------|
| Log Directory | Path | ./logs/ |
| Auto-Save Debug Logs | On/Off | Off |
| New Log on DTR/RTS | On/Off | On |
| Max Log Size | 1MB to Unlimited | 5MB |
| Enable USB Traffic Logging | On/Off | Off |
| USB Log Path | Path | ./logs/ |

#### Recording Settings
| Setting | Options | Default |
|---------|---------|---------|
| Recordings Directory | Path | ./recordings/ |
| Auto-Save Recordings | On/Off | Off |
| Recording Buffer Size | 10MB to 1GB | 100MB |

---

## Recording & Playback

### Overview
The recording system captures debug sessions for later playback and analysis.

**Use Cases:**
- Regression testing - Verify fixes don't break functionality
- Bug reproduction - Share exact sessions with team
- Performance analysis - Study timing offline
- Documentation - Create reproducible examples

### File Format
- **Extension**: `.p2rec`
- **Type**: Binary format with timing data
- **Storage**: Default location `./recordings/`

### Recording

#### Start Recording
| Method | Action |
|--------|--------|
| Toolbar | Click ⏺ Record button |
| Keyboard | Press Ctrl+R |
| Menu | File → Start Recording |

**During Recording:**
- Status shows "Recording..." with red dot
- Record button becomes ⏹ Stop
- Message count displays in real-time
- File size indicator updates

#### Stop Recording
Click ⏹ Stop button or press Ctrl+R again.
- Auto-saves as `recording_YYYYMMDD_HHMMSS.p2rec`
- Stored in `./recordings/` directory
- Ready for immediate playback

### Playback

#### Load Recording
| Method | Action |
|--------|--------|
| Menu | File → Open Recording... |
| Toolbar | Click ▶ Play button |
| Keyboard | Press Ctrl+P |

Select `.p2rec` file to begin playback.

#### Playback Controls
[SCREENSHOT: Playback control bar]

| Control | Function |
|---------|----------|
| ▶/⏸ | Play/Pause playback |
| ⏹ | Stop and reset |
| Progress Bar | Click to seek |
| Time Display | Shows elapsed/total |
| Speed | 0.5x, 1x, 2x options |

### Advanced Features
- **Precise Timing**: Sub-millisecond accuracy preserved
- **Seek Support**: Jump to any position via progress bar
- **Speed Control**: Slow down or speed up playback
- **Drift Compensation**: Automatic timing correction for long recordings

---

## Performance Monitoring

Access via Window → Performance Monitor

### Metrics Dashboard

#### System Health
- **Status Indicator**: ✓ (normal), ⚠ (warning), ✗ (error)
- **Throughput Graph**: 50-sample data rate history
- **Buffer Usage**: Percentage bar with visual warning levels
- **Queue Depth**: Messages pending across all windows

#### Statistics
| Metric | Description |
|--------|-------------|
| Buffer Size | Total capacity (default: 64KB) |
| High Water Mark | Maximum usage this session |
| Overflow Events | Data loss count |
| Total Messages | Cumulative processed |
| Messages/sec | Current throughput |
| Parse Errors | Malformed message count |

#### Active Windows
Lists open debug windows with individual queue depths for bottleneck identification.

### Controls
- **Clear Stats**: Reset counters (preserves current state)
- **Auto-Refresh**: Toggle 100ms updates

---

## Debug Windows Reference

All debug windows open automatically when P2 programs send corresponding DEBUG commands. Windows cannot be opened manually from menus.

### Terminal Window (TERM)

Displays text output in a monospace character grid.

**Use For:** Status messages, debugging output, text-based interfaces

**Key Features:**
- Configurable size and colors (4 color combinations)
- Cursor positioning and control codes
- Buffered update mode for flicker-free animations
- Keyboard/mouse input forwarding to P2

**Configuration Options:**
| Option | Range | Description |
|--------|-------|-------------|
| SIZE | 1-256 columns/rows | Terminal dimensions |
| TEXTSIZE | 6-200 points | Font size |
| POS | x,y coordinates | Window position |
| COLOR | 4 pairs | Foreground/background combinations |

**Mouse Features:**
- **Hover:** Shows character position as "column,row" in flyout
- **Click:** Sets focus for keyboard input

**Control Codes:**
| Code | Function |
|------|----------|
| 0 | Clear screen and home |
| 1 | Home cursor |
| 2 n | Set column to n |
| 3 n | Set row to n |
| 4-7 | Select color combo 0-3 |
| 8 | Backspace |
| 9 | Tab |
| 13 | Newline |

### Logic Analyzer (LOGIC)

Displays digital signal timing for protocol analysis.

**Use For:** I2C/SPI/UART debugging, digital signal analysis, timing measurements

**Key Features:**
- Up to 32 channels
- Configurable trigger modes
- Timing cursors for measurements
- Zoom and pan navigation

**Configuration Options:**
| Option | Range | Description |
|--------|-------|-------------|
| CHANNELS | 1-32 | Number of channels |
| SAMPLES | 1-1M | Sample buffer size |
| RATE | Hz | Sample rate |
| TRIGGER | Multiple modes | Trigger configuration |

**Mouse Controls:**
- **Hover:** Shows time and channel value at cursor
- **Wheel:** Zoom in/out
- **Drag:** Pan view or measure with cursors
- **Right-click:** Context menu

**Trigger Modes:** NONE, HIGH, LOW, RISE, FALL, CHANGE

### Oscilloscope (SCOPE)

Displays analog waveforms with real-time updates.

**Use For:** Analog signals, sensor readings, PWM analysis, waveform inspection

**Key Features:**
- Up to 8 channels simultaneous display
- Automatic or manual scaling
- Trigger system with level control
- Measurement cursors

**Configuration Options:**
| Option | Range | Description |
|--------|-------|-------------|
| CHANNELS | 1-8 | Number of channels |
| SAMPLES | 1-1M | Samples per channel |
| RATE | Hz | Sample rate |
| SCALE | mV/div | Vertical scale |
| TRIGGER | Multiple modes | Trigger settings |

**Mouse Controls:**
- **Hover:** Shows voltage and time at cursor position
- **Wheel:** Zoom timebase
- **Drag:** Adjust trigger level or pan
- **Right-click:** Channel options

### XY Scope (SCOPE_XY)

Displays phase relationships between two signals.

**Use For:** Lissajous patterns, phase measurement, vector displays

**Key Features:**
- X-Y plotting mode
- Persistence for pattern visualization
- Grid overlay for measurements
- Auto or manual scaling

**Configuration Options:**
| Option | Range | Description |
|--------|-------|-------------|
| SIZE | pixels | Window dimensions |
| PERSIST | ON/OFF | Trace persistence |
| GRID | ON/OFF | Grid display |
| DOT_SIZE | 1-10 | Point size |

**Mouse Controls:**
- **Hover:** Shows X,Y values at cursor
- **Wheel:** Zoom in/out
- **Drag:** Pan display

### Plot Window (PLOT)

General-purpose data plotting and visualization.

**Use For:** Trends, trajectories, mathematical functions, data graphing

**Key Features:**
- Cartesian and polar modes
- Multiple plot types (line, scatter, bar)
- Auto-scaling or fixed ranges
- Legend and grid options

**Configuration Options:**
| Option | Range | Description |
|--------|-------|-------------|
| MODE | CARTESIAN/POLAR | Plot type |
| SIZE | pixels | Window dimensions |
| GRID | ON/OFF | Grid display |
| LEGEND | ON/OFF | Legend display |

**Mouse Controls:**
- **Hover:** Shows data point values
- **Wheel:** Zoom in/out
- **Drag:** Pan or select region

### Bitmap Display (BITMAP)

Shows pixel data as images or graphics.

**Use For:** Camera output, graphics rendering, image processing, pixel art

**Key Features:**
- Multiple color modes (palette, RGB, grayscale)
- Configurable pixel scaling (DOTSIZE)
- SPARSE mode for grid effects
- Scrolling and trace patterns

**Configuration Options:**
| Option | Range | Description |
|--------|-------|-------------|
| SIZE | 1-2048 pixels | Bitmap dimensions |
| DOTSIZE | 1-256 | Pixel scaling factor |
| MODE | Multiple | Color mode (LUT, RGB, etc.) |
| TRACE | 0-15 | Scan pattern |

**Color Modes:**
- LUT1/2/4/8 - Palette-based (2-256 colors)
- RGB8/16/24 - Direct color
- LUMA8 - Grayscale
- HSV8/16 - Hue-saturation-value

**Mouse Controls:**
- **Hover:** Shows pixel coordinates (X,Y) and color value
- **Wheel:** Zoom in/out (if supported)
- **Click:** May set pixel or select color

**Special Features:**
- **SPARSE:** Creates border effect around pixels
- **SCROLL:** Pan image in any direction
- **TRACE:** Different pixel plotting patterns for streaming data

### MIDI Monitor (MIDI)

Displays MIDI messages and events.

**Use For:** MIDI device development, music applications, protocol debugging

**Key Features:**
- Real-time MIDI message display
- Channel filtering
- Note name translation
- Timing information

**Display Columns:**
| Column | Content |
|--------|---------|
| Time | Message timestamp |
| Channel | MIDI channel 1-16 |
| Type | Message type |
| Data | Message parameters |
| Note | Musical note name |

**Message Types:** Note On/Off, Control Change, Program Change, Pitch Bend, System Exclusive

**Mouse Controls:**
- **Hover:** Shows full message details
- **Click:** Select message for details
- **Right-click:** Filter options

### FFT Analyzer (FFT)

Frequency domain analysis and spectrum display.

**Use For:** Audio analysis, vibration monitoring, frequency identification

**Key Features:**
- Real-time spectrum analysis
- Multiple window functions
- Peak detection and markers
- Linear or logarithmic scales

**Configuration Options:**
| Option | Range | Description |
|--------|-------|-------------|
| FFT_SIZE | 128-8192 | FFT points |
| RATE | Hz | Sample rate |
| WINDOW | Multiple | Window function |
| SCALE | LINEAR/LOG | Magnitude scale |

**Window Functions:** Rectangular, Hamming, Hanning, Blackman

**Mouse Controls:**
- **Hover:** Shows frequency and magnitude at cursor
- **Click:** Place frequency marker
- **Wheel:** Zoom frequency range
- **Right-click:** Display options

### Spectrogram Display (SPECTRO)

Time-frequency visualization showing spectrum changes over time.

**Use For:** Signal evolution, frequency tracking, waterfall displays

**Key Features:**
- 2D or 3D waterfall display
- Adjustable color mapping
- Time and frequency cursors
- History buffer for analysis

**Configuration Options:**
| Option | Range | Description |
|--------|-------|-------------|
| FFT_SIZE | 128-8192 | Frequency resolution |
| OVERLAP | 0-90% | Frame overlap |
| COLORMAP | Multiple | Color scheme |

**Colormaps:** JET (blue-red), HOT (black-white), COOL (blue-cyan), GRAY

**Mouse Controls:**
- **Hover:** Shows time, frequency, and magnitude
- **Click:** Place measurement cursor
- **Drag:** Select time/frequency region
- **Wheel:** Zoom time axis

### P2 Debugger (DEBUGGER)

Interactive debugging interface for P2 programs.

**Status:** Planned for future release

**Planned Features:**
- Breakpoint management
- Single-step execution
- Memory inspection
- Register viewing
- Variable watches

### Common Window Features

**All Windows Support:**
- Resize by dragging borders
- Move by dragging title bar
- Close with X button
- Minimize/maximize buttons
- Context menus (right-click)

**Data Export:**
Most windows support data export via right-click menu:
- CSV for numerical data
- PNG/JPG for graphical displays
- Text for log data

---

## Command-Line Reference

### Basic Usage
```bash
pnut-term-ts [options] [file.binary]
```

### Quick Examples
```bash
# List available serial ports
pnut-term-ts -n

# Connect to specific port
pnut-term-ts -p COM3

# Download to RAM and run
pnut-term-ts -r program.binary

# Download to Flash
pnut-term-ts -f program.binary

# Custom baud rate
pnut-term-ts -b 115200 -p /dev/ttyUSB0

# IDE integration mode
pnut-term-ts --ide -r program.binary
```

### Options Reference

#### Connection Options
| Option | Long Form | Description |
|--------|-----------|-------------|
| -p | --port | Specify serial port |
| -b | --baud | Set baud rate (default: 2000000) |
| -n | --list | List available serial ports |

#### Download Options
| Option | Long Form | Description |
|--------|-----------|-------------|
| -r | --ram | Download file to RAM |
| -f | --flash | Download file to Flash |

#### Display Options
| Option | Long Form | Description |
|--------|-----------|-------------|
| -q | --quiet | Minimize output |
| -v | --verbose | Verbose output |
| --debug | | Enable debug logging |

#### Special Modes
| Option | Long Form | Description |
|--------|-----------|-------------|
| --ide | | IDE integration mode |
| --help | | Show help text |
| --version | | Show version info |

### Port Selection Priority
1. Command-line `-p` option
2. Single USB device auto-detection
3. Interactive selection from list

### Exit Codes
| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Port not found |
| 3 | Download failed |
| 4 | Connection lost |

---

## Keyboard Shortcuts

### Global Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+R | Start/stop recording |
| Ctrl+P | Playback recording |
| Ctrl+, | Open preferences |
| Ctrl+Q | Quit application |
| F1 | Open help |
| F11 | Toggle fullscreen |
| ESC | Exit fullscreen |

### Terminal Window
| Shortcut | Action |
|----------|--------|
| Ctrl+C | Copy selection |
| Ctrl+V | Paste |
| Ctrl+F | Find text |
| Ctrl+L | Clear terminal |
| Ctrl+A | Select all |

### Debug Windows
| Shortcut | Action |
|----------|--------|
| Mouse Wheel | Zoom in/out |
| Space | Pause/resume |
| R | Reset view |
| G | Toggle grid |
| C | Toggle cursors |
| Ctrl+S | Save/export data |

### Window Management
| Shortcut | Action |
|----------|--------|
| Alt+Tab | Switch windows |
| Ctrl+W | Close window |
| Win+↑ | Maximize |
| Win+↓ | Restore/minimize |
| Win+← | Snap left |
| Win+→ | Snap right |

---

## Troubleshooting

### Connection Issues

#### P2 Not Detected
1. Check USB cable and power
2. Install FTDI drivers if needed
3. Try different USB port
4. List ports with `pnut-term-ts -n`
5. Verify device permissions (Linux/macOS)

#### Wrong Baud Rate
- Symptoms: Garbled text, no data
- Solution: Match P2 program baud rate in preferences
- Common rates: 115200, 921600, 2000000

#### DTR vs RTS Control Line
- Parallax Prop Plug uses DTR
- Some USB adapters use RTS
- Toggle in Preferences → Serial Port

### Performance Issues

#### Data Overflow
1. Open Performance Monitor
2. Check buffer usage (should be <80%)
3. Reduce baud rate if needed
4. Close unnecessary windows

#### Slow Response
- Check CPU usage in system monitor
- Reduce number of open debug windows
- Disable recording if not needed
- Lower sample rates in scope/logic windows

### Window Issues

#### Windows Won't Open
- Windows only open from P2 DEBUG commands
- Check P2 program syntax
- Verify program is running
- Check serial connection

#### Missing Data
- Verify P2 is sending data
- Check trigger settings in scope/logic
- Ensure proper data format
- Look for buffer overflows in Performance Monitor

### Recording Issues

#### Can't Start Recording
- Check disk space
- Verify write permissions
- Close previous recording
- Check recordings directory setting

#### Playback Problems
- Verify file integrity
- Check version compatibility
- Ensure sufficient RAM
- Try slower playback speed

### Platform-Specific

#### Windows
- Run as Administrator if port access denied
- Check Windows Defender isn't blocking
- Verify COM port number in Device Manager

#### macOS
- Grant terminal/app serial port access in Security settings
- Check /dev/tty.* permissions
- May need to install FTDI drivers

#### Linux
- Add user to dialout group: `sudo usermod -a -G dialout $USER`
- Check /dev/ttyUSB* permissions
- May need to install udev rules

---

## Tips & Best Practices

### Connection Management
- **Development**: Enable "Reset P2 on Connection" for clean starts
- **Monitoring**: Disable reset to observe running programs
- **Multiple Devices**: Use `-p` flag to specify exact port
- **High-Speed Data**: Start at lower baud rates, increase gradually

### Recording Sessions
- Start recording before reproducing issues
- Name recordings descriptively when saving
- Keep recording sizes manageable (<100MB)
- Use playback speed control for detailed analysis
- Archive important recordings with documentation

### Performance Optimization
- Monitor Performance Monitor regularly
- Close unused debug windows
- Adjust buffer sizes for workload
- Use appropriate sample rates
- Enable only necessary logging

### Window Management
- Use Window → Tile for multi-window layouts
- Right-click for context menus
- Learn hover behaviors for each window type
- Export data frequently for external analysis

### Debugging Workflow
1. Start with Terminal window for basic output
2. Add specialized windows as needed
3. Use recording for complex issues
4. Share .p2rec files with team
5. Document window configurations that work

### Project Organization
- Keep project settings minimal (only overrides)
- Document required settings in README
- Use consistent baud rates across team
- Establish recording naming conventions
- Archive recordings with test results

### Best Practices
- Test at multiple baud rates for reliability
- Use Performance Monitor proactively
- Record before attempting to reproduce bugs
- Export data for documentation
- Keep terminal window visible for status

---

## Support & Resources

### Getting Help
- **GitHub Issues**: https://github.com/ironsheep/PNut-Term-TS/issues
- **Documentation**: See this guide and QUICK-START.md
- **Community Forum**: Parallax Forums P2 section

### Additional Resources
- **Propeller 2 Documentation**: https://propeller.parallax.com/p2.html
- **DEBUG Command Reference**: See P2 documentation
- **Video Tutorials**: Parallax YouTube channel

---

## Conclusion

PNut-Term-TS provides comprehensive debugging capabilities for P2 development. Key points:

- Debug windows open automatically from P2 DEBUG commands
- Three operating modes for different workflows
- Recording system preserves exact debug sessions
- Hierarchical settings provide flexibility
- Performance monitoring ensures smooth operation

For quick startup, see QUICK-START.md.

---

*© 2024-2025 Iron Sheep Productions LLC*
*Licensed under MIT License*
*Version 0.9.0*