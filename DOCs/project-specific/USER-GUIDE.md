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
17. [Advanced Topics](#advanced-topics)
    - [Custom Window Layouts](#custom-window-layouts)
    - [Scripting](#scripting)
    - [Serial Communication Architecture](#serial-communication-architecture)
    - [Performance Tuning](#performance-tuning)
    - [Integration](#integration)

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