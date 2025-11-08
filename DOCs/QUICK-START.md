# PNut-Term-TS Quick Start Guide
*Version 0.9.0*

## First Session (2 Minutes)

### Connect and Launch
1. Connect P2 board via USB
2. Launch terminal:
   ```bash
   pnut-term-ts
   ```
3. Terminal auto-connects if single USB device detected
   - Multiple devices? Use `-p COM3` (Windows) or `-p /dev/ttyUSB0` (Linux/macOS)
   - List available ports: `pnut-term-ts -n`

### Verify Connection
Watch for DTR/RTS indicators in toolbar:
- **DTR** button highlighted = Parallax Prop Plug connected
- **RTS** button highlighted = Some USB adapters
- Click either button to reset P2

[SCREENSHOT: Main window with DTR/RTS buttons highlighted]

### Debug Windows Open Automatically
Run your P2 program with DEBUG commands. Windows appear as needed - no menu interaction required.

---

## Essential Keyboard Shortcuts

| Action | Shortcut | Description |
|--------|----------|-------------|
| **Record** | `Ctrl+R` | Start/stop session recording |
| **Playback** | `Ctrl+P` | Open and play recording |
| **Settings** | `Ctrl+,` | Open preferences dialog |
| **Help** | `F1` | Open documentation |
| **Find** | `Ctrl+F` | Search in terminal |
| **Clear** | `Ctrl+L` | Clear terminal display |

---

## Key Features

### Recording Sessions
**Start Recording**: Press `Ctrl+R` or click ⏺ button
- Records all debug data to `.p2rec` file
- Default location: `./recordings/`
- Auto-named with timestamp

**Stop Recording**: Press `Ctrl+R` again or click ⏹
- File saved automatically

**Playback**: Press `Ctrl+P` or click ▶
- Select `.p2rec` file
- Use playback controls: speed, pause, seek

[SCREENSHOT: Recording controls in toolbar]

### Performance Monitor
**Open**: Window → Performance Monitor

**Key Metrics**:
- **Throughput graph**: Data rate over time
- **Buffer usage**: Should stay below 80%
- **Queue depth**: Messages waiting for processing
- **Status**: ✓ = healthy, ⚠ = warning, ✗ = error

[SCREENSHOT: Performance Monitor window]

### Preferences
**Open**: Edit → Preferences or `Ctrl+,`

**Quick Settings**:
- **Baud Rate**: Serial Port → Default Baud Rate
- **Color Theme**: Terminal → Color Theme
- **Control Line**: Serial Port → DTR or RTS
- **Auto-save Logs**: Logging → Auto-save Debug Logs

**Settings Hierarchy**:
1. Project settings (if present): `./.pnut-term-ts-settings.json`
2. User settings: Platform-specific location
3. Application defaults

---

## Common Tasks

### Monitor Running P2
1. Disable "Reset P2 on Connection" in Preferences
2. Connect to see existing debug output
3. P2 continues running undisturbed

### Development Mode
1. Enable "Reset P2 on Connection" in Preferences
2. Each connection resets P2 to clean state
3. Download fresh code after reset

### Capture Intermittent Issue
1. Start recording (`Ctrl+R`)
2. Run test until issue occurs
3. Stop recording (`Ctrl+R`)
4. Share `.p2rec` file for analysis

### Analyze High-Speed Data
1. Open Performance Monitor first
2. Watch buffer usage and queue depth
3. Reduce baud rate if buffers overflow
4. Close unused windows to reduce load

---

## Troubleshooting

### Connection Issues

**P2 Not Detected**
- Check USB cable and power
- Install FTDI drivers if needed
- Try different USB port
- List ports: `pnut-term-ts -n`

**Wrong Control Line**
- Parallax Prop Plug uses DTR
- Some adapters use RTS
- Toggle in Preferences → Serial Port

### Performance Issues

**Data Loss/Overflow**
- Open Performance Monitor
- Check buffer usage (>80% is problem)
- Reduce baud rate in Preferences
- Close unnecessary debug windows

**Slow Response**
- Check queue depth in Performance Monitor
- Reduce data rate from P2
- Close other applications

### Window Issues

**Debug Windows Won't Open**
- Windows only open from P2 DEBUG commands
- Check DEBUG command syntax in P2 code
- Verify P2 program is running

**Recording Won't Start**
- Check disk space
- Verify write permissions in `./recordings/`
- Close previous recording first

---

## Command-Line Options

### Basic Usage
```bash
pnut-term-ts [options] [file.binary]
```

### Common Options
- `-p <device>` - Specify serial port
- `-b <baud>` - Set baud rate (default: 2000000)
- `-n` - List available serial ports
- `-r <file>` - Download to P2 RAM
- `-f <file>` - Download to P2 Flash
- `--help` - Show all options

### Examples
```bash
# List ports
pnut-term-ts -n

# Connect to specific port
pnut-term-ts -p COM3

# Download to RAM
pnut-term-ts -r program.binary

# Custom baud rate
pnut-term-ts -b 115200 -p /dev/ttyUSB0
```

---

## Next Steps

- **Full Documentation**: See `USER-GUIDE.md` for comprehensive reference
- **Report Issues**: https://github.com/ironsheep/PNut-Term-TS/issues
- **Community Support**: Parallax Forums P2 section

---

*© 2024-2025 Iron Sheep Productions LLC*
*Licensed under MIT License*