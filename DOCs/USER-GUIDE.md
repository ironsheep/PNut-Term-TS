# PNut-Term-TS User Guide

## Overview
PNut-Term-TS is a cross-platform debug terminal for the Parallax Propeller 2 microcontroller. It provides a comprehensive debugging environment with multiple specialized windows for different types of debug output.

## Installation

### From DMG (macOS)
1. Mount the DMG file
2. Drag PNut-Term-TS.app to Applications
3. To enable command-line access:
   ```bash
   echo 'export PATH="/Applications/PNut-Term-TS.app/Contents/MacOS:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

### Command-Line Usage
```bash
pnut-term-ts [options]

Options:
  -p, --port <device>     Serial port device (e.g., P9cektn7)
  -b, --baud <rate>       Baud rate (default: 2000000)
  --verbose               Enable verbose logging
  --help                  Show help
```

## Main Window Controls

### Hardware Control Buttons
- **DTR**: Data Terminal Ready control with checkbox indicator
  - Press to toggle DTR line
  - Checkbox shows current state (checked = asserted)
  - Asserting DTR resets the P2 and starts new log file

- **RTS**: Request To Send control with checkbox indicator  
  - Press to toggle RTS line
  - Checkbox shows current state (checked = asserted)

### Download Mode Selection
- **RAM**: Download to RAM (temporary)
  - Green LED indicator when selected
  - Mutually exclusive with FLASH
  
- **FLASH**: Download to FLASH (permanent)
  - Green LED indicator when selected
  - Mutually exclusive with RAM

### Status Indicators
- **Connected**: Green LED when connected to P2
- **TX**: Blue LED blinks on transmit activity
- **RX**: Red LED blinks on receive activity
- **Log**: Green LED when logging to file
- **Echo**: Checkbox to enable/disable local echo

## Debug Windows

### Debug Logger Window
- Auto-creates on first Cog message from P2
- Green text on black background (configurable)
- Shows all debug output with Cog prefixes
- Status bar shows log filename, line count, file size
- Logs saved to `Logs/` directory

### Debug Windows
Created by P2 debug commands:
- `\`TERM name` - Terminal window (text output)
- `\`SCOPE name` - Oscilloscope window (analog waveforms)
- `\`SCOPE_XY name` - XY Oscilloscope window (Lissajous patterns)
- `\`FFT name` - Fast Fourier Transform spectrum analyzer
- `\`LOGIC name` - Logic analyzer window (digital signals)
- `\`PLOT name` - Advanced 2D graphics and plotting window
- `\`BITMAP name` - Bitmap display window
- `\`MIDI name` - MIDI monitor window
- `\`DEBUGGER name` - Interactive debugger windows (Cog0-Cog7)
- `\`SPECTRO name` - Spectrogram window (NOT YET IMPLEMENTED)

## PLOT Window - Advanced Graphics

### Overview
The PLOT window is a sophisticated 2D graphics system supporting vector drawing, bitmap layers, sprites, and both Cartesian and polar coordinate systems. It features hardware-accelerated double buffering, gamma-corrected transparency, and real-time mouse coordinate tracking.

### Creating a PLOT Window
```
`PLOT myplot SIZE 600 650 BACKCOLOR white UPDATE
```

### Drawing Commands

#### Basic Shapes
- **SET x y** - Move cursor to position without drawing
- **DOT** - Draw a dot at cursor position
- **LINE x y {linesize}** - Draw line to position (linesize: 1-32 pixels)
- **CIRCLE diameter {linesize}** - Draw circle (linesize 0=filled)
- **BOX width height {linesize}** - Draw rectangle (linesize 0=filled)
- **OVAL width height {linesize}** - Draw ellipse (linesize 0=filled)

#### Text Rendering
- **TEXT 'string' {size style angle}**
  - Size: Font size in points
  - Style: Binary flags for bold/italic/underline
  - Angle: Rotation in degrees (0-359)

#### Colors and Transparency
- **COLOR colorname {brightness}** - Set drawing color
  - Colors: RED, GREEN, BLUE, CYAN, YELLOW, MAGENTA, GREY, WHITE, etc.
  - Brightness: 0-15 (0=darkest, 15=brightest)
- **OPACITY value** - Set transparency (0=transparent, 255=opaque)
  - Uses gamma-corrected blending for natural appearance

#### Coordinate Systems

**Cartesian Mode** (default):
```
`PLOT myplot CARTESIAN xdir ydir
```
- xdir: 0=left-to-right, 1=right-to-left
- ydir: 0=bottom-to-top, 1=top-to-bottom

**Polar Mode**:
```
`PLOT myplot POLAR twopi offset
```
- twopi: Full rotation value (e.g., -64 for ±64 units = 360°)
- offset: Angular offset for 0° position

#### Layers and Bitmaps
- **LAYER index 'filename.bmp'** - Load bitmap into layer (1-16)
- **CROP layer x y width height** - Display portion of layer
- **CROP layer AUTO x y** - Auto-crop transparent edges

#### Sprites
- **SPRITEDEF id width height pixels colors** - Define sprite
- **SPRITE id {angle scale opacity}** - Draw sprite with transformations
  - Angle: 0-359 degrees rotation
  - Scale: 0.1-10.0 scaling factor
  - Opacity: 0-255 transparency

#### Display Control
- **UPDATE** - Enable double buffering (smooth animation)
- **LIVE** - Disable buffering (immediate drawing)
- **CLEAR** - Clear display
- **HIDEXY** - Hide mouse coordinates
- **SHOWXY** - Show mouse coordinates

### Color Palettes (LUT)
- **LUT index color** - Set palette entry
- **LUTCOLORS color1 color2...** - Set multiple palette entries

### Mouse Interaction
The PLOT window displays real-time mouse coordinates in logical units (accounting for DOTSIZE scaling). The coordinate flyout intelligently positions itself based on cursor quadrant to remain visible.

### Performance Features
- Hardware-accelerated double buffering eliminates flashing
- Gamma-corrected alpha blending for natural transparency
- Efficient sprite caching and transformations
- 60 FPS sustained rendering

### Example: Animated Graphics
```
`PLOT demo SIZE 400 400 UPDATE
`PLOT demo POLAR -64 -16
`PLOT demo CLEAR
`PLOT demo COLOR cyan
`PLOT demo SET 100 0
`PLOT demo CIRCLE 50
`PLOT demo UPDATE
```

### Tips and Best Practices
1. Use UPDATE mode for animations to prevent flashing
2. Clear the display between animation frames
3. Set colors before drawing operations
4. Use opacity for smooth overlays and effects
5. Combine layers for complex backgrounds
6. Use sprites for repeated elements


### Cog Messages
- Format: `CogN: message` where N is 0-7
- Automatically routed to Debug Logger window
- May contain embedded window commands

### Window Commands
- Start with backtick (\`)
- Create or update specific debug windows
- Example: `\`TERM MyTerm SIZE 80 24`

### Regular Output
- Non-prefixed messages go to main terminal (blue panel)

## Keyboard Shortcuts
- `Ctrl+D` - Toggle DTR
- `Ctrl+R` - Toggle RTS
- `Ctrl+C` - Copy selected text
- `Ctrl+V` - Paste text

## Log Files
- Created automatically in `Logs/` directory
- Format: `debug_YYYYMMDD_HHMMSS_debug.log`
- New log created on DTR reset
- Contains all Cog messages with timestamps

## Troubleshooting

### No Debug Windows Appearing
- Ensure P2 is sending properly formatted Cog messages
- Check serial connection and baud rate
- Toggle DTR to reset P2 and trigger debug output

### Windows Not Positioned Correctly
- Windows use automatic grid placement
- Can be manually repositioned by dragging
- Position preferences saved for future sessions

### Connection Issues
- Verify serial port device name
- Check USB cable connection
- Ensure no other program is using the port
- Try toggling DTR to reset connection

## Tips
- DTR reset clears display and starts new log
- Multiple debug windows can be open simultaneously
- Window positions are remembered between sessions
- Use Echo checkbox to see transmitted characters