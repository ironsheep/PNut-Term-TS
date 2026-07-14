# PNut-Term-TS User Guide

*Version 0.9.73*

PNut-Term-TS is a cross-platform debug terminal for the Parallax Propeller 2 (P2).
It interprets the `debug()` output a P2 program emits over a serial (PropPlug/FTDI)
connection and renders it through a set of specialized visualization windows, with
support for downloading programs, recording/replaying sessions, and fully headless
operation for automation.

## Table of Contents

### Part 1 — Getting Started
1. [Introduction](#introduction)
2. [Operating Modes](#operating-modes)
3. [Quick Start](#quick-start)
4. [The Main Window](#the-main-window)

### Part 2 — Core Features
5. [Menu System](#menu-system)
6. [Settings & Preferences](#settings--preferences)
7. [PropPlug / Device Management](#propplug--device-management)
8. [Recording & Playback](#recording--playback)
9. [Performance Monitoring](#performance-monitoring)

### Part 3 — Debug Windows
10. [Debug Windows Overview](#debug-windows-overview)

### Part 4 — Reference
11. [Command-Line Reference](#command-line-reference)
12. [Keyboard Shortcuts](#keyboard-shortcuts)
13. [Troubleshooting](#troubleshooting)
14. [Tips & Best Practices](#tips--best-practices)
15. [Support & Resources](#support--resources)

---

## Introduction

PNut-Term-TS connects to a running Propeller 2 over a USB serial adapter (a Parallax
PropPlug or a generic FTDI device), optionally downloads a compiled program to the
P2's RAM or flash, then receives and visualizes the `debug()` stream the program
produces. Each kind of `debug()` display directive opens its own window
automatically.

### Key Features
- Specialized debug windows (TERM, BITMAP, PLOT, SCOPE, SCOPE_XY, LOGIC, FFT,
  SPECTRO, MIDI), plus the COG message logger and the single-step debugger.
- Real-time serial data streaming (default debug baud **2 Mbps**), with an
  off-main-thread serial reader for lossless capture.
- Download-to-RAM and download-to-flash with automatic P2 reset (DTR or RTS).
- Binary session recording and playback (`.p2rec`).
- Live performance monitoring.
- Hierarchical settings: application defaults → user (per-machine) → project.
- Headless and IDE-integration modes for automation and editor workflows.
- Cross-platform: Windows, macOS, Linux (x64 + arm64).

---

## Operating Modes

How you launch PNut-Term-TS determines how it runs.

### 1. Interactive (GUI) Mode — default
Launch with no special flags to open the full graphical interface.

```bash
pnut-term-ts                 # auto-detect a single USB device, open the GUI
pnut-term-ts -p P9cektn7     # connect to a specific PropPlug
```

The main window opens, connects to the P2, and renders debug windows as the P2
sends `debug()` output. Whether the P2 is reset on connect is governed by the
**Reset P2 on Connection** preference.

### 2. Command-Line Download Mode (GUI)
Provide a compiled binary to download and run immediately, then keep the GUI open.

```bash
pnut-term-ts -r myprogram.bin -p P9cektn7   # download to RAM and run
pnut-term-ts -f myprogram.bin -p P9cektn7   # download to FLASH and run
```

The program is downloaded, the P2 is reset into its loader at the right moment, and
debug capture begins. (Use only one of `-r`/`-f`.)

### 3. Headed Batch Mode (GUI with auto-exit)
Like download mode, but the whole application exits when the P2 signals completion —
useful for scripted capture runs that still need on-screen rendering and window
SAVEs.

```bash
pnut-term-ts -r gen.bin --exit-on-end-session -p P9cektn7
```

On the end-session marker the app **drains in-flight window SAVEs and logs** before
exiting, so queued output is never cut off.

### 4. IDE Integration Mode
A minimal UI intended to be driven by an editor (e.g. the VS Code Spin2 extension).

```bash
pnut-term-ts --ide -p P9cektn7            # IDE mode (DTR reset)
pnut-term-ts --ide --rts -p P9cektn7      # IDE mode, use RTS for reset
```

`--rts` selects the RTS control line for reset (some non-Parallax adapters need it)
and is intended for use with `--ide`.

### 5. Headless Mode
No GUI at all — serial data is captured to a timestamped log file. Designed for CI
pipelines, containers, and AI coding assistants running hardware-in-the-loop tests.

```bash
pnut-term-ts --headless -r test.bin -p P9cektn7 --end-marker          # exit on marker
pnut-term-ts --headless -r test.bin -p P9cektn7 --timeout 60          # exit after 60s
```

Headless runs terminate on a signal (Ctrl+C / SIGTERM), a `--timeout`, or an
`--end-marker` (see [Command-Line Reference](#command-line-reference)).

---

## Quick Start

For a condensed first-run walkthrough see **`DOCs/QUICK-START.md`**. In brief:

1. Plug in your PropPlug and connect it to the P2.
2. Run `pnut-term-ts -n` to confirm the device is detected.
3. Run `pnut-term-ts -r yourprogram.bin` to download and watch the debug output.

### Key concepts
- **Debug windows open automatically** from the P2's `debug()` directives — they are
  not opened from menus.
- **Connection/reset** is controlled by the **Reset P2 on Connection** preference
  (default: on). Enabled = reset on connect (development); disabled = attach to a
  running program (monitoring).
- **Recording** captures a whole session to a `.p2rec` file for later replay.

---

## The Main Window

The main window hosts a menu bar, a text-entry field, a toolbar, the terminal/log
display, and a status bar.

**Toolbar (left to right):**
- **Reset control line** — a button showing the active reset line (**DTR** or **RTS**)
  with a checkbox; click to assert a reset on the P2. The line is configured per device
  in PropPlug Management.
- **RAM** / **FLASH** — download the loaded binary to the P2's RAM or flash and run it.
  The adjacent LED is green for the active download target.
- **📥 Download** — choose a binary file and download it.
- **⏺ Record** / **▶ Play** — start/stop a recording and play one back, with a status
  label (e.g. "Ready", "Recording…") alongside.

A **text-entry field** above the toolbar sends a line of text to the running P2 when you
press **Enter**. During playback a transport strip appears with play/pause/stop, an
elapsed/total time readout, a scrubber, and a speed selector (0.5×, 1×, 2×).

**Status bar — left:**
- **Connection indicator** — green when connected to a P2, amber when disconnected.
- **Active COGs** — which COG cores are currently driving debug windows.
- **Logging indicator** — lit while a recording is active.

**Status bar — right:**
- **Echo** checkbox — filters locally echoed characters from the display.
- **TX/RX indicators** — flash during serial transmit/receive.
- **Port** — the connected device path.
- **Baud** — the active debug baud rate.
- **DTR/RTS control** — a toggle showing the active reset control line for the
  current device.

---

## Menu System

PNut-Term-TS uses the native application menu on macOS and an in-window menu bar on
Windows/Linux. The items are equivalent; accelerators differ by platform
(`Cmd` on macOS, `Ctrl` on Windows/Linux).

### File
| Item | Shortcut | Description |
|------|----------|-------------|
| New Recording | | Begin a new recording session |
| Open Recording… | | Load a `.p2rec` file for playback |
| Save Recording As… | | Save the current recording |
| Select PropPlug ▸ | | Choose among connected devices (submenu) |
| Start Recording | Ctrl+R | Begin recording the debug stream |
| Stop Recording | | End the current recording |
| Playback Recording | Ctrl+P | Replay the selected recording |
| Exit | Ctrl+Q | Quit the application |

### Edit
| Item | Shortcut | Description |
|------|----------|-------------|
| Cut | Ctrl+X | Cut selected text |
| Copy | Ctrl+C | Copy selected text |
| Paste | Ctrl+V | Paste from clipboard |
| Find… | Ctrl+F | Search the terminal output |
| Clear Terminal | | Clear the terminal display |
| Preferences… | Ctrl+, | Open the settings dialog |

### Window
| Item | Description |
|------|-------------|
| Performance Monitor | Open the performance metrics window |
| Cascade | Arrange debug windows in a cascade |
| Tile | Tile debug windows |
| Show All Windows | Reveal all debug windows |
| Hide All Windows | Hide all debug windows |

### Help
| Item | Shortcut | Description |
|------|----------|-------------|
| Documentation | F1 | Open the documentation |
| About PNut-Term-TS | | Version and license information |

> On macOS, **Preferences…** is under the application menu (**Cmd+,**), and
> standard **Quit/Hide** items appear there as well.

---

## Settings & Preferences

Open with **Edit → Preferences…** (`Ctrl+,`, or `Cmd+,` on macOS).

### Settings hierarchy
Settings resolve in priority order:
1. **Project settings** — overrides scoped to the current project directory.
2. **User settings** — your per-machine defaults.
3. **Application defaults** — built-in baseline.

The Preferences dialog has three tabs.

### User Settings tab
Your machine-wide defaults.

**Terminal**
| Setting | Options | Default |
|---------|---------|---------|
| Terminal Mode | PST, ANSI | PST |
| Color Theme | Green on Black, White on Black, Amber on Black | Green on Black |
| Font Size | 10–24 | 14 |
| Font Family | Default, Parallax, IBM 3270, IBM 3270 Green, IBM 3270 Amber | Default |
| Show COG Prefixes | on / off | on |
| Local Echo | on / off | off |

**Serial Port**
| Setting | Options | Default |
|---------|---------|---------|
| Default PropPlug | Auto-detect, or a named device | Auto-detect |
| Default Baud Rate | 115200, 230400, 460800, 921600, 1000000, 2000000 | — |
| Reset P2 on Connection | on / off | on |

**Logging**
| Setting | Options | Default |
|---------|---------|---------|
| Log Directory | path | `./logs/` |
| Auto-Save Debug Output | on / off | on |
| New Log on P2 Reset | on / off | — |
| Max Log Size | 1 MB, 10 MB, 100 MB, Unlimited | Unlimited |
| Enable USB Traffic Logging | on / off | off |
| USB Log Directory | path | `./logs/` |

**Recordings**
| Setting | Default |
|---------|---------|
| Recordings Directory | `./recordings/` |

**Debug Logger**
| Setting | Range | Default |
|---------|-------|---------|
| History Lines | 100–10000 | 1000 |

> The DTR/RTS control line is **not** set here — it is configured per device in the
> PropPlug Management tab.

### Project Settings tab
The same controls as User Settings, each with an **override** checkbox. Only checked
items override your user defaults for the current project (delta-save); unchecked
items show and inherit the global value.

### PropPlug Management tab
See [PropPlug / Device Management](#propplug--device-management).

---

## PropPlug / Device Management

PNut-Term-TS remembers each USB serial device it sees and lets you name it and set
its reset control line.

### Device discovery
New devices are detected on USB enumeration and added to the known-devices list with
default settings (control line = DTR, the Parallax standard).

### Managing devices
Open **Preferences → PropPlug Management**. The known-devices table shows each
device's serial, friendly name, control line, and last-used time. Select a row to:
- set a **Friendly Name** (e.g. "Workbench Plug"),
- choose the **Control Line** (**DTR** or **RTS**),
- view the device **VID/PID**,
- **Save Changes** or **Delete Device**.

### Device selection priority
1. Command-line `-p <device>` (exact, or case-insensitive partial match on path or
   serial number).
2. Project setting (if a project device override is enabled).
3. User default (set in User Settings, or auto-set on first connect).
4. Auto-detect (exactly one device connected).
5. Otherwise, selection is required (or the run errors if none matches).

### Control line (DTR vs RTS)
P2 reset is asserted over DTR or RTS:
- Parallax PropPlugs and most FTDI adapters → **DTR**.
- Some clones/adapters → **RTS**.

The control line is stored per device; the `--rts` command-line flag overrides it for
a session (primarily for `--ide`).

---

## Recording & Playback

The recording system captures an entire debug session for later replay and analysis —
useful for regression testing, sharing reproductions, and offline study.

### File format
- **Extension:** `.p2rec` (binary, with timing metadata). `.jsonl` recordings are
  also accepted for playback.
- **Default location:** `./recordings/` (configurable).
- **Auto-named:** `recording_YYYYMMDD_HHMMSS.p2rec`.

### Recording
Start with **File → Start Recording** (`Ctrl+R`); stop with **File → Stop
Recording**. While recording, the logging indicator is lit.

### Playback
Load a recording with **File → Open Recording…** (or `Ctrl+P` to play the selected
one). Playback reproduces the captured stream — including timing — driving the debug
windows exactly as the live session did.

---

## Performance Monitoring

Open with **Window → Performance Monitor**. It surfaces the health of the serial →
window data path:
- **Throughput** — recent data-rate history.
- **Buffer usage** — how full the receive/message buffers are.
- **Queue depth** — messages pending across windows, and per window (to spot a
  bottleneck window).
- **Message counts** — totals and current rate, plus any overflow/parse-error counts.

Use it to confirm the pipeline keeps up at high baud rates; if buffer usage climbs
toward full, reduce the data rate or close windows that aren't needed.

---

## Debug Windows Overview

Debug windows are created **automatically** by the P2 program's `debug()` display
directives — there is no menu command to open one. The available window types are:

| Window | Purpose |
|--------|---------|
| **TERM** | Text terminal — status messages and text UIs |
| **BITMAP** | Pixel/image display (LUT, RGB, LUMA, HSV color modes) |
| **PLOT** | General X/Y plotting, shapes, and sprites |
| **SCOPE** | Oscilloscope-style waveform display |
| **SCOPE_XY** | X-vs-Y (Lissajous / vector) display |
| **LOGIC** | Logic-analyzer timing display |
| **FFT** | Frequency spectrum |
| **SPECTRO** | Spectrogram / waterfall |
| **MIDI** | MIDI keyboard / message display |
| **COG logger** | Per-COG debug message log |
| **Debugger** | Interactive single-step PASM2 debugger |

### Shared window behaviors
- **Automatic placement** — a window with no `POS` directive is auto-laid-out on
  screen; windows with an explicit `POS` honor it.
- **Position readout while dragging** — drag a display window and its title bar shows
  the live `x, y` position, so you can pick coordinates for a `POS` directive. (The
  COG logger, debugger, and message-log windows don't show this.)
- **SAVE** — `debug()` `SAVE`/`SAVE WINDOW` directives write a window's image to a
  bitmap file.
- **Mouse/keyboard to the P2** — windows can forward pointer and key input back to
  the running program via the `PC_MOUSE` / `PC_KEY` mechanisms.

> **The directive syntax for each window type is part of the Parallax P2 `debug()`
> specification and is documented separately — this guide intentionally does not
> reproduce it.** See the official Propeller 2 DEBUG documentation for the full
> directive/parameter reference, and **`DOCs/DEBUGGER-USER-MANUAL.md`** for the
> single-step debugger.

---

## Command-Line Reference

### Usage
```bash
pnut-term-ts [options]
```

### Options
| Option | Long form | Argument | Description |
|--------|-----------|----------|-------------|
| `-r` | `--ram` | file | Download the file to **RAM** and run |
| `-f` | `--flash` | file | Download the file to **FLASH** and run |
| `-p` | `--plug` | device | Use the PropPlug at `<device>` (path or serial; partial match OK). Auto-detects if exactly one device is present |
| `-b` | `--debugbaud` | rate | **Override** the debug baud rate. Normally unnecessary — see *Debug baud* below |
| `-n` | `--dvcnodes` | | List detected USB serial devices and exit |
| `-m` | `--match-vendor-only` | | With `-n`, list any FTDI device (VID 0x0403), not just PropPlugs |
| `-d` | `--debug` | | Emit detailed diagnostic messages |
| `-v` | `--verbose` | | Emit verbose messages |
| `-q` | `--quiet` | | Suppress the banner and non-error text |
| `-u` | `--log-usb-trfc` | | Write a timestamped USB-traffic log |
| | `--ide` | | IDE-integration mode (minimal UI) |
| | `--rts` | | Use RTS instead of DTR for reset (intended with `--ide`) |
| | `--console-mode` | | Console output mode (adds a delay before close) |
| | `--headless` | | Run with no GUI (file logging only) |
| | `--timeout` | seconds | Exit after N seconds (**headless only**) |
| | `--end-marker` | [phrase] | Exit when `phrase` appears in output; with no value, matches `END_SESSION` or `DEBUG_END_SESSION` |
| | `--exit-on-end-session` | | GUI batch: exit the app on the end-session marker, draining saves/logs first |
| `-V` | `--version` | | Print the version |
| `-h` | `--help` | | Show help |

### Examples
```bash
pnut-term-ts -n                                  # list connected devices
pnut-term-ts -n -m                               # list all FTDI devices
pnut-term-ts -r prog.bin -p P9cektn7             # download to RAM and run (GUI)
pnut-term-ts -f prog.bin                         # download to FLASH and run
pnut-term-ts -p P9cektn7 -b 921600               # connect at 921600 baud
pnut-term-ts -p P9cektn7 -u                      # enable USB-traffic logging
pnut-term-ts --ide --rts -p P9cektn7             # IDE mode, RTS reset
pnut-term-ts --headless -r test.bin --end-marker # headless, exit on marker
pnut-term-ts --headless -r test.bin --timeout 60 # headless, exit after 60s
pnut-term-ts -r gen.bin --exit-on-end-session    # GUI batch capture, auto-exit
```

### End-session markers
By default the end-session condition matches either `END_SESSION` or
`DEBUG_END_SESSION` (a case-sensitive substring match). `--end-marker "PHRASE"`
substitutes your own phrase. Markers apply to headless mode (`--headless`) and to GUI
batch mode (`--exit-on-end-session`).

### Constraints
- `-r` and `-f` are mutually exclusive.
- `--timeout` requires `--headless`, and takes a positive whole number of seconds.
- `--end-marker` requires `--headless` or `--exit-on-end-session`, and its phrase cannot be empty.
- `--debugbaud` takes a positive whole number of bits/sec.

The command line is validated **before anything runs**. If any option is wrong,
every problem with it is reported at once and the tool exits with code 2 — no
device is touched, no download is attempted, and no window opens.

### Debug baud — you should not need to set it

**When you download a program with `-r` or `-f`, PNut-Term-TS reads the debug baud
rate out of the binary itself and listens at that rate.** Your compiler writes the
value into the image, so the binary already knows what the P2 will transmit at —
including when your source sets its own rate:

```spin2
CON  DEBUG_BAUD = 921600     ' PNut-Term-TS picks this up automatically
```

If your source says nothing, everything in the P2 world defaults to **2,000,000**,
and so do we. Either way it just works, with no flag.

`-b` / `--debugbaud` is an **override** for the cases the binary can't tell us
about — attaching to a P2 that is already running (no download), or a program built
by a toolchain we don't recognize. If you pass `-b` and it *contradicts* the binary
you're downloading, you'll get a warning saying so, because the P2 will transmit at
its own compiled rate regardless and the output would be unreadable:

```
WARNING: -b 115200 disagrees with this binary's compiled debug baud (2000000).
The P2 will transmit at 2000000 — expect unreadable output. Drop -b to use the binary's rate.
```

The full precedence is: **`-b` flag → the binary's own rate → project settings →
global settings → 2,000,000.**

### Exit codes
The same codes are returned whether you run with the GUI or `--headless`, so a
launching script can branch on `$?` identically in both modes.

| Code | Meaning |
|------|---------|
| 0 | Clean exit (all SAVEs and logs flushed) |
| 1 | Port / device error (the command was valid; the hardware wasn't there) |
| 2 | Bad command line — nothing ran |
| 3 | Download failed |
| 124 | Headless `--timeout` expired |
| 125 | Shutdown drain exceeded its timeout (output may be incomplete) |

---

## Keyboard Shortcuts

These are the application-level shortcuts (shown on Windows/Linux; use `Cmd` instead
of `Ctrl` on macOS).

| Shortcut | Action |
|----------|--------|
| Ctrl+R | Start Recording |
| Ctrl+P | Playback Recording |
| Ctrl+Q | Exit |
| Ctrl+, | Preferences |
| Ctrl+X / Ctrl+C / Ctrl+V | Cut / Copy / Paste |
| Ctrl+F | Find in terminal |
| F1 | Documentation |

> Inside a debug window, mouse and keyboard input may be forwarded to the running P2
> program when that program requested it (`PC_MOUSE` / `PC_KEY`). Dragging a display
> window shows its position in the title bar.

---

## Troubleshooting

### P2 not detected
1. Check the USB cable and that the P2 is powered.
2. Run `pnut-term-ts -n` to see whether the device enumerates.
3. Install FTDI drivers if needed; try another USB port.
4. On Linux/macOS, verify serial-port permissions (see below).

### Garbled or missing text
- Usually a baud mismatch. **If you passed `-b`, try dropping it** — when you download
  with `-r`/`-f` the binary's own debug baud is read automatically and is almost always
  right; an explicit `-b` overrides it and can be wrong. Look for the
  `WARNING: -b … disagrees with this binary's compiled debug baud` line.
- If you're attaching to an already-running P2 (no download), there is no binary to read
  from, so set the rate yourself with `-b` or the Default Baud Rate preference. Common
  rates: 115200, 921600, 2000000.

### P2 doesn't reset / program doesn't start
- The reset control line may be wrong for your adapter. Set **DTR** or **RTS** for the
  device in **Preferences → PropPlug Management**, or pass `--rts` for the session.
- Parallax PropPlugs use DTR; some clones use RTS.

### A window is blank or data is missing
- Confirm the P2 is actually sending `debug()` output and is running.
- Open the **Performance Monitor**; if buffer usage is high, lower the data rate.

### Recording problems
- Check free disk space and write permission to the recordings directory.
- Stop any in-progress recording before starting a new one.

### Platform notes
- **Windows:** if port access is denied, check that no other app holds the COM port;
  confirm the COM number in Device Manager.
- **macOS:** grant serial access if prompted; devices appear as `/dev/tty.usbserial-*`.
- **Linux:** add your user to the `dialout` group
  (`sudo usermod -a -G dialout $USER`, then re-login); devices appear as
  `/dev/ttyUSB*`.

---

## Tips & Best Practices

- **Development vs monitoring:** keep **Reset P2 on Connection** on for clean restarts
  during development; turn it off to attach to an already-running program.
- **Pick window positions:** drag a window and read its `x, y` from the title bar,
  then bake that into a `POS` directive in your Spin2 source.
- **High-speed runs:** watch the Performance Monitor; if buffers fill, reduce baud or
  close unneeded windows.
- **Reproducible captures:** record before reproducing an issue, and share the
  `.p2rec` file with your team.
- **Automation:** use `--headless` with `--end-marker`/`--timeout` for CI and
  AI-driven hardware-in-the-loop tests; use `--exit-on-end-session` when you still
  need on-screen rendering and window SAVEs.

---

## Support & Resources

- **GitHub issues:** https://github.com/ironsheep/PNut-Term-TS/issues
- **Propeller 2 documentation:** https://propeller.parallax.com/p2.html
- **P2 `debug()` directive reference:** the official Parallax P2 DEBUG documentation
- **Single-step debugger:** `DOCs/DEBUGGER-USER-MANUAL.md`
- **Quick start:** `DOCs/QUICK-START.md`
- **Parallax Forums:** the P2 section

---

*© 2024–2026 Iron Sheep Productions LLC*
*Licensed under the MIT License*
