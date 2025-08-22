# P2 Debug Terminal User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Installation & Setup](#installation--setup)
3. [Getting Started](#getting-started)
4. [Debug Windows Overview](#debug-windows-overview)
5. [Terminal Window](#terminal-window)
6. [Logic Analyzer](#logic-analyzer)
7. [Oscilloscope](#oscilloscope)
8. [XY Scope](#xy-scope)
9. [Plot Window](#plot-window)
10. [Bitmap Display](#bitmap-display)
11. [MIDI Monitor](#midi-monitor)
12. [FFT Analyzer](#fft-analyzer)
13. [P2 Debugger](#p2-debugger)
14. [Recording & Playback](#recording--playback)
15. [Keyboard Shortcuts](#keyboard-shortcuts)
16. [Troubleshooting](#troubleshooting)

## Introduction

The P2 Debug Terminal is a comprehensive debugging environment for the Parallax Propeller 2 (P2) microcontroller. It provides real-time visualization and interactive debugging capabilities through specialized windows that interpret DEBUG commands from your P2 programs.

### Key Features
- **10 specialized debug windows** for different data visualization needs
- **Real-time data streaming** at up to 16 Mbps
- **Interactive P2 debugger** with breakpoints and memory inspection
- **Recording and playback** for regression testing
- **Cross-platform support** (Windows, macOS, Linux)

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
curl -L https://github.com/parallaxinc/pnut-term-ts/releases/latest/download/pnut-term-win.exe -o pnut-term.exe

# Run the application
./pnut-term.exe
```

#### macOS
```bash
# Download the latest release
curl -L https://github.com/parallaxinc/pnut-term-ts/releases/latest/download/pnut-term-mac.dmg -o pnut-term.dmg

# Mount and install
hdiutil attach pnut-term.dmg
cp -R /Volumes/PNut-Term/PNut-Term.app /Applications/
```

#### Linux
```bash
# Download the latest release
curl -L https://github.com/parallaxinc/pnut-term-ts/releases/latest/download/pnut-term-linux.AppImage -o pnut-term.AppImage

# Make executable and run
chmod +x pnut-term.AppImage
./pnut-term.AppImage
```

### First Run Setup

1. **Connect your P2**: Plug in your Propeller 2 board via USB
2. **Select COM port**: The terminal will auto-detect available ports
3. **Set baud rate**: Default is 2,000,000 baud (2 Mbps)
4. **Enable DTR**: Toggle DTR to reset the P2 if needed

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
```

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
| **Debugger** | Code debugging | Breakpoints, memory inspection |

## Terminal Window

The Terminal window displays text output from your P2 program.

### Creating a Terminal
```spin2
debug(`term MyTerm size 80 25 textsize 14 title "Status Monitor"`)
```

### Displaying Text
```spin2
' Simple text
debug(`term MyTerm print "Hello World" 13`)

' Formatted numbers
debug(`term MyTerm print "Value: ", dec(value), " hex: ", hex(value, 8)`)

' Colors
debug(`term MyTerm color 2 print "Green text"`)
debug(`term MyTerm color 0 4 print "Black on red"`)
```

### Terminal Controls
- **Echo Off**: Filter echoed characters for cleaner display
- **Clear**: Clear the terminal screen
- **Save**: Export terminal contents to file

### Special Characters
- `13` - Newline
- `9` - Tab
- `8` - Backspace
- `12` - Clear screen

## Logic Analyzer

The Logic window displays digital signals over time, perfect for protocol debugging.

### Setup
```spin2
debug(`logic MyLogic size 800 300 samples 8192 trigger %0001`)
```

### Capturing Data
```spin2
repeat
  debug(`logic MyLogic`, ubin(ina.[7..0]))  ' Send 8 digital channels
```

### Trigger Modes
- **None**: Free-running capture
- **Rising Edge**: Trigger on 0→1 transition
- **Falling Edge**: Trigger on 1→0 transition
- **Either Edge**: Trigger on any transition
- **Pattern Match**: Trigger on specific bit pattern

### Measurements
- Click and drag to measure time between edges
- Hover over signals for instant values
- Use zoom controls for detailed analysis

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

The Plot window provides flexible 2D graphics and data visualization.

### Coordinate Systems

#### Cartesian Mode
```spin2
debug(`plot MyPlot size 500 500 cartesian range -100 100 -100 100`)
debug(`plot MyPlot set 50 75`)          ' Move to (50, 75)
debug(`plot MyPlot dot 5`)               ' Draw 5-pixel dot
```

#### Polar Mode
```spin2
debug(`plot MyPlot size 500 500 polar`)
debug(`plot MyPlot set 45 100`)         ' 45 degrees, radius 100
debug(`plot MyPlot line 135 100`)       ' Draw line to 135°, r=100
```

### Drawing Commands
- `DOT [size]` - Draw dot at current position
- `LINE x y` - Draw line to position
- `BOX width height [opacity]` - Draw filled rectangle
- `OBOX width height [linesize]` - Draw outlined rectangle
- `OVAL width height [opacity]` - Draw filled ellipse
- `TEXT "string"` - Draw text at current position

### Advanced Features

#### Sprites
```spin2
' Define a sprite
debug(`plot MyPlot spritedef 0 2 2 1 2 3 4 $FF0000 $00FF00 $0000FF $FFFF00`)

' Draw sprite
debug(`plot MyPlot sprite 0 100 100`)            ' Basic
debug(`plot MyPlot sprite 0 100 100 2`)          ' Rotated 90°
debug(`plot MyPlot sprite 0 100 100 2 200`)      ' Scaled 2x
```

#### Layers
```spin2
' Load background image
debug(`plot MyPlot layer 1 "background.png"`)

' Draw layer
debug(`plot MyPlot crop 1`)  ' Draw entire layer
```

## Bitmap Display

The Bitmap window displays raster images and supports various pixel formats.

### Display Modes

#### RGB8 Mode (8-bit color)
```spin2
debug(`bitmap MyBitmap size 256 192 rgb8 lut8`)
```

#### RGB16 Mode (16-bit color)
```spin2
debug(`bitmap MyBitmap size 320 240 rgb16`)
```

#### RGB24 Mode (24-bit true color)
```spin2
debug(`bitmap MyBitmap size 640 480 rgb24`)
```

### Trace Patterns
Control how pixels are drawn:
- `SPARSE` - Random pixel placement
- `LUMA` - Brightness-based 
- `RGB` - Color channel separation
- `HSBLUMA` - HSB color space
- Custom patterns via `TRACE` command

### Scrolling
```spin2
debug(`bitmap MyBitmap scroll 1 0`)  ' Scroll right 1 pixel
debug(`bitmap MyBitmap scroll 0 -1`) ' Scroll up 1 pixel
```

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
- `RECTANGLE` - No window (maximum frequency resolution)
- `HANNING` - General purpose
- `HAMMING` - Similar to Hanning, better stopband
- `BLACKMAN` - Excellent stopband, wider mainlobe
- `FLATTOP` - Best amplitude accuracy

### Controls
- **Magnitude Scale**: Linear/Logarithmic
- **Frequency Range**: Zoom to specific bands
- **Peak Hold**: Capture maximum values
- **Averaging**: Smooth noisy signals

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

### Custom Window Layouts

Save and restore window arrangements:

1. Arrange windows as desired
2. **Window → Save Layout**
3. Name your layout
4. **Window → Load Layout** to restore

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

### Performance Tuning

#### High-Speed Data
For data rates >1 Mbps:
1. Increase buffer sizes in Settings
2. Use binary protocol when possible
3. Enable hardware flow control
4. Consider sampling/decimation
5. Use recording for post-analysis

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
```bash
# Open with specific settings
pnut-term --port=/dev/ttyUSB0 --baud=2000000 --ide

# Replay recording
pnut-term --replay=session.jsonl --speed=2

# Export data
pnut-term --export=csv --input=recording.jsonl
```

## Conclusion

The P2 Debug Terminal provides powerful visualization and debugging capabilities for Propeller 2 development. Whether you're debugging protocols with the logic analyzer, visualizing sensor data with the oscilloscope, or stepping through code with the interactive debugger, the tool adapts to your debugging needs.

For additional help and updates:
- Check for updates via **Help → Check for Updates**
- Report issues on [GitHub](https://github.com/parallaxinc/pnut-term-ts/issues)
- Join the community on [Parallax Forums](https://forums.parallax.com)

Happy debugging!