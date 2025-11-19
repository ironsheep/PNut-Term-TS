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
   - Multiple devices? Use `-p P9cektn7` (partial serial number)
   - List available ports: `pnut-term-ts -n`
   - First-time device? Automatically discovered and remembered

### Verify Connection
Watch for DTR/RTS indicators in toolbar:
- **DTR** button highlighted = Parallax Prop Plug connected (default)
- **RTS** button highlighted = Some USB adapters require RTS
- Click either button to reset P2
- Wrong control line? Change it in Edit → Preferences → PropPlug Management

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
- **PropPlug Management**: Manage devices and control lines
- **Auto-save Logs**: Logging → Auto-save Debug Logs

**Settings Hierarchy**:
1. Project settings (if present): `./.pnut-term-ts-settings.json`
2. User settings: Platform-specific location
3. Application defaults

### Managing Multiple PropPlugs

**Quick Switch Devices:**
- File → Select PropPlug → Choose device
- Devices show friendly name (if set) or serial number

**Set Device Names:**
1. Edit → Preferences → PropPlug Management tab
2. Select device from list
3. Enter friendly name (e.g., "Workbench Plug")
4. Apply changes

**Project-Specific Device:**
1. Edit → Preferences → Project Settings tab
2. Enable "PropPlug Selection" checkbox
3. Select device from dropdown
4. Project will always use this device

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
- Parallax Prop Plug uses DTR (default)
- Some adapters use RTS
- Change per-device in Preferences → PropPlug Management
- Select your device, toggle DTR/RTS, apply changes

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
# List available devices
pnut-term-ts -n

# Connect to specific device (by serial number)
pnut-term-ts -p P9cektn7

# Connect using partial serial match
pnut-term-ts -p P9c

# Download to RAM
pnut-term-ts -r program.binary

# Custom baud rate
pnut-term-ts -b 115200 -p P9cektn7
```

---

## Next Steps

- **Full Documentation**: See [USER-GUIDE](USER-GUIDE.md) for comprehensive reference
- **Report Issues**: https://github.com/ironsheep/PNut-Term-TS/issues
- **Community Support**: Parallax Forums P2 section

---

*© 2024-2025 Iron Sheep Productions LLC*
*Licensed under MIT License*
