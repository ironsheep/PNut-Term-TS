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
- `\`PLOT name` - Plot/strip chart window
- `\`BITMAP name` - Bitmap display window
- `\`MIDI name` - MIDI monitor window
- `\`DEBUGGER name` - Interactive debugger windows (Cog0-Cog7)
- `\`SPECTRO name` - Spectrogram window (NOT YET IMPLEMENTED)

## Message Routing

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