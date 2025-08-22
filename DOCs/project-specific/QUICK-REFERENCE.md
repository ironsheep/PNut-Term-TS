# P2 Debug Terminal Quick Reference

## Window Creation Commands

```spin2
' Terminal - Text output
debug(`term MyTerm size 80 25 textsize 14`)

' Logic Analyzer - Digital signals  
debug(`logic MyLogic size 800 300 samples 8192`)

' Oscilloscope - Analog waveforms
debug(`scope MyScope size 600 400 samples 1000 range -100 100`)

' XY Scope - Phase relationships
debug(`scopexy MyXY size 400 400 range -100 100 -100 100`)

' Plot - 2D graphics
debug(`plot MyPlot size 500 500 cartesian`)  
debug(`plot MyPlot size 500 500 polar`)

' Bitmap - Image display
debug(`bitmap MyBitmap size 320 240 rgb16`)

' MIDI Monitor
debug(`midi MyMIDI size 800 400`)

' FFT Analyzer  
debug(`fft MyFFT size 800 400 samples 1024 rate 44100`)
```

## Data Output Commands

### Terminal
```spin2
debug(`term MyTerm print "Text", 13`)              ' Print with newline
debug(`term MyTerm print dec(value)`)              ' Decimal number
debug(`term MyTerm print hex(value, 8)`)           ' Hex with width
debug(`term MyTerm color 2`)                       ' Set text color
debug(`term MyTerm clear`)                         ' Clear screen
```

### Logic Analyzer  
```spin2
debug(`logic MyLogic`, ubin(ina.[7..0]))          ' 8 digital channels
debug(`logic MyLogic trigger %0001`)               ' Set trigger pattern
```

### Oscilloscope
```spin2
debug(`scope MyScope`, sdec(value))                ' Signed decimal
debug(`scope MyScope trigger 50`)                  ' Set trigger level
```

### XY Scope
```spin2
debug(`scopexy MyXY xy`, sdec(x), sdec(y))        ' Plot X,Y point
```

### Plot Window
```spin2
debug(`plot MyPlot set`, sdec(x), sdec(y))        ' Move cursor
debug(`plot MyPlot dot 5`)                         ' Draw 5-pixel dot
debug(`plot MyPlot line`, sdec(x2), sdec(y2))     ' Draw line
debug(`plot MyPlot box 100 50`)                    ' Draw filled box
debug(`plot MyPlot text "Hello"`)                  ' Draw text
debug(`plot MyPlot update`)                        ' Update display
```

### Bitmap
```spin2
debug(`bitmap MyBitmap`, ubin(pixel_data))         ' Send pixel data
debug(`bitmap MyBitmap scroll 1 0`)                ' Scroll right
```

### MIDI
```spin2
' Note On: Channel 1, Note 60 (Middle C), Velocity 64
debug(`midi MyMIDI`, ubyte($90), ubyte(60), ubyte(64))

' Note Off
debug(`midi MyMIDI`, ubyte($80), ubyte(60), ubyte(0))
```

### FFT
```spin2
debug(`fft MyFFT`, sdec(audio_sample))             ' Send audio sample
```

## Debugger Keyboard Shortcuts

### Execution Control
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

### Navigation
| Key | Action |
|-----|--------|
| **↑/↓** | Move up/down |
| **←/→** | Move left/right |
| **PgUp/PgDn** | Page up/down |
| **Home/End** | Jump to start/end |
| **Tab** | Next view |
| **Shift+Tab** | Previous view |

### Breakpoints
| Key | Action |
|-----|--------|
| **F9** | Toggle breakpoint |
| **Shift+F9** | Clear all breakpoints |

### Window
| Key | Action |
|-----|--------|
| **ESC** | Close window |
| **F1** | Help |

## Global Application Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+O** | Open file/port |
| **Ctrl+S** | Save current view |
| **Ctrl+R** | Start recording |
| **Ctrl+P** | Playback recording |
| **Ctrl+W** | Close window |
| **Ctrl+Q** | Quit application |
| **Ctrl+Tab** | Next window |
| **Ctrl+Shift+Tab** | Previous window |
| **F5** | Run/Continue |
| **F6** | Pause/Break |
| **F11** | Fullscreen |

## Number Formats (Spin2)

```spin2
' Decimal
debug(dec(value))           ' Unsigned decimal
debug(sdec(value))          ' Signed decimal
debug(dec(value, 8))        ' With minimum width

' Hexadecimal  
debug(hex(value))           ' Hex
debug(hex(value, 8))        ' 8-digit hex

' Binary
debug(bin(value))           ' Binary
debug(bin(value, 32))       ' 32-bit binary

' Special
debug(real(fvalue))         ' Floating point
debug(char(ch))             ' Character
```

## Color Values

### Terminal Colors (0-15)
```
0 = Black      8 = Dark Gray
1 = Red        9 = Light Red  
2 = Green     10 = Light Green
3 = Brown     11 = Yellow
4 = Blue      12 = Light Blue
5 = Magenta   13 = Light Magenta
6 = Cyan      14 = Light Cyan
7 = Gray      15 = White
```

### RGB Colors
```spin2
$FF0000  ' Red
$00FF00  ' Green  
$0000FF  ' Blue
$FFFF00  ' Yellow
$FF00FF  ' Magenta
$00FFFF  ' Cyan
$FFFFFF  ' White
$000000  ' Black
```

## Common DEBUG Patterns

### Status Display
```spin2
PUB show_status(value, state)
  debug(`term Status clear`)
  debug(`term Status print "Value: ", dec(value), 13`)
  debug(`term Status print "State: "`)
  if state
    debug(`term Status color 2 print "OK"`)
  else  
    debug(`term Status color 1 print "ERROR"`)
```

### Data Logger
```spin2
PUB log_data() | sample
  repeat
    sample := read_sensor()
    debug(`scope Data`, sdec(sample))
    debug(`term Log print dec(cnt), ",", dec(sample), 13`)
    waitms(10)
```

### Protocol Analyzer
```spin2
PUB monitor_i2c() | sda, scl
  repeat
    sda := ina[SDA_PIN]
    scl := ina[SCL_PIN]  
    debug(`logic I2C`, ubin(scl << 1 | sda))
```

### Performance Monitor
```spin2
PUB benchmark() | start, elapsed
  start := cnt
  ' ... code to benchmark ...
  elapsed := cnt - start
  debug(`term Perf print "Time: ", dec(elapsed / (clkfreq / 1000)), " ms", 13`)
```

## Troubleshooting Tips

### No Window Appears
- Check DEBUG command syntax
- Verify P2 is running
- Check serial connection
- Look for errors in terminal

### Data Not Updating
- Check trigger settings
- Verify data format
- Look for buffer overflow
- Try slower data rate

### Performance Issues
- Reduce data rate
- Close unused windows
- Check CPU usage
- Increase buffer size

### Connection Lost
- Check USB cable
- Verify power supply
- Toggle DTR
- Reconnect port

## Command Line Options

```bash
# Basic connection
pnut-term --port=/dev/ttyUSB0 --baud=2000000

# IDE mode (minimal UI)
pnut-term --ide

# Debug mode
pnut-term --debug --log-level=trace

# Replay recording
pnut-term --replay=session.jsonl --speed=2

# Export data
pnut-term --export=csv --input=recording.jsonl --output=data.csv
```

## File Locations

### Windows
- Settings: `%APPDATA%\pnut-term\settings.json`
- Recordings: `%APPDATA%\pnut-term\recordings\`
- Logs: `%APPDATA%\pnut-term\logs\`

### macOS
- Settings: `~/Library/Application Support/pnut-term/settings.json`
- Recordings: `~/Library/Application Support/pnut-term/recordings/`
- Logs: `~/Library/Logs/pnut-term/`

### Linux
- Settings: `~/.config/pnut-term/settings.json`
- Recordings: `~/.config/pnut-term/recordings/`
- Logs: `~/.config/pnut-term/logs/`

## Getting Help

- **In-app**: Press F1 in any window
- **GitHub**: https://github.com/parallaxinc/pnut-term-ts/issues
- **Forums**: https://forums.parallax.com
- **Docs**: https://www.parallax.com/propeller-2

---
*P2 Debug Terminal v1.0 - Quick Reference Card*