# PNut-Term-TS User Guide

*Version 0.11.9*

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
10. [Debug Logger](#debug-logger)

### Part 3 — Debug Windows
11. [Debug Windows Overview](#debug-windows-overview)

### Part 4 — Reference
12. [Command-Line Reference](#command-line-reference)
13. [Keyboard Shortcuts](#keyboard-shortcuts)
14. [Troubleshooting](#troubleshooting)
15. [Tips & Best Practices](#tips--best-practices)
16. [Support & Resources](#support--resources)

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
**Reset P2 on App Startup** preference.

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
and works in standalone mode as well as with `--ide`; it overrides the per-device setting.
A device first seen while `--rts` is active is *recorded* as an RTS device.

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
- **Connection/reset** is controlled by the **Reset P2 on App Startup** preference
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

A **text-entry field** below the toolbar sends a line of text to the running P2 when you
press **Enter**. During playback a transport strip appears with play/pause/stop, an
elapsed/total time readout, a scrubber, and a speed selector (0.5×, 1×, 2×).

**Status bar — left:**
- **Connection indicator** — green when connected to a P2, amber when disconnected.
- **Active COGs** — which COG cores are currently driving debug windows.
- **Logging indicator** — lit while the Debug Logger is writing a log file (recording state
  is shown by the toolbar's status label instead).

**Status bar — right:**
- **Echo** checkbox — when checked, suppresses characters echoed back by the P2 so typed
  input isn't shown twice.
- **TX/RX indicators** — flash during serial transmit/receive.
- **Port** — the connected device path.
- **Baud** — the active debug baud rate.
(The active DTR/RTS control line is shown on the *toolbar* button, not in the status bar.)

---

## Menu System

**The in-window menu bar is the application's menu on every platform** — File, Edit,
Window and Help, exactly as documented below, on Windows, Linux and macOS alike.

macOS *additionally* shows a native application menu in the system menu bar, carrying the
standard macOS items only: About, Preferences… (`Cmd+,`), Hide/Show All, Quit, the
clipboard commands, and Minimize/Close/Zoom/Bring All to Front. It is not a second copy
of the app's menus — anything not in that list is in the in-window menu bar.
Accelerators differ by platform (`Cmd` on macOS, `Ctrl` on Windows/Linux).

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
| Find… | Ctrl+F | Open the find bar to search the terminal output |
| Clear Terminal | | Clear the terminal display |
| Preferences… | Ctrl+, | Open the settings dialog |

### Window
| Item | Description |
|------|-------------|
| Show Log / Hide Log | Open or close the Debug Logger window; the entry names whichever action is available. Closing the window does **not** stop logging — see [Debug Logger](#debug-logger) |
| Performance Monitor | Open the performance metrics window |
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
| Reset P2 on App Startup | on / off | on |

**Logging**
| Setting | Options | Default |
|---------|---------|---------|
| Log Directory | path | `./logs/` |
| Auto-Save Debug Output | on / off | on |
| Enable USB Traffic Logging | on / off | off |

A P2 reset always starts a new log file (that boundary is what makes a log readable as a
single run). Logs are not size-capped. USB traffic logs go to the Log Directory above.

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
- **Extension:** `.p2rec` (binary, with timing metadata). The Play dialog filters to
  `.p2rec`, so `.jsonl` recordings cannot be selected there.
- **Location:** a `sessions` folder inside your Recordings Directory (default
  `./recordings/`, configurable). The folder is created on your first recording.
- **Auto-named** with a timestamp and session name; use **Save Recording As…** to copy a
  finished recording anywhere you like.

### Recording
Start with **File → Start Recording** (`Ctrl+R`); stop with **File → Stop
Recording**. While recording, the toolbar status label reads "Recording...".

### Playback
Load a recording with **File → Open Recording…** or `Ctrl+P` — either one opens the file
chooser and starts playback. Playback reproduces the captured stream — including timing — driving the debug
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

## Debug Logger

The Debug Logger is the central, timestamped record of all serial traffic. It is two
things that are easy to confuse, and worth keeping separate in your head:

- **the log file** — the durable record on disk, in the Log Directory;
- **the Debug Logger window** — a *viewer* onto that log.

### The window is a viewer, not the log

Closing the Debug Logger window closes the window only. **Logging continues.** The file
stays open, keeps receiving every line, and records when the window was closed and when
it was reopened, so a gap in your attention is never a gap in the record.

- **Window > Show Log** reopens it. It attaches to the **same** log file — it does not
  start a new one — and repaints the recent history so it isn't blank.
- **Window > Hide Log** closes it. The menu entry names whichever action applies.
- The log is ended by the *session*, not by the window: a P2 reset rotates it, and
  quitting closes it.

The same holds for a COG window — closing it stops that window; that COG's log keeps
recording.

### Reading it

- The view **follows live data**; scroll up to pause and review, then click
  **↓ Follow Live Data** to resume. It stays where you put it while you read.
- Transmitted bytes are marked `[TX]`, with control characters shown as `<cr>`, `<lf>`.
- A P2 reset writes a session marker, clears the view, and rotates the log file.
- System messages, errors, warnings, binary/hex fallbacks and debugger output are
  color-coded.
- **Show All 8 COGs** opens the full set of COG windows; **Export Active COG Logs**
  writes the current COG logs to files.
- The status bar shows the log filename, line count, file size, and live/paused state.

History length is set by **History Lines** in Preferences (default 1000).

### Under a very fast stream

If output arrives faster than the window can draw it, the window skips ahead to stay
current and says so:

```
⋯ 4,500 line(s) not shown — display fell behind; the log file has every line ⋯
```

Only the *drawing* is reduced, and only while it is behind — **the log file always
receives every line**. At normal rates you will never see this message. If you want the
application at its most responsive during a flood, **Hide Log** is the single most
effective thing to close, and it costs you nothing in the record.

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
> directive/parameter reference, and the published **Single-Step Debugger Manual** for the
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
| | `--rts` | | Use RTS instead of DTR for reset (works standalone and with `--ide`; overrides the per-device setting) |
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
| Ctrl+F | Find in terminal |
| F1 | Documentation |

Cut / Copy / Paste use your platform's standard keys (`Ctrl+X`/`C`/`V`, or `Cmd` on
macOS) in any text field.

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
- If a *reopened* Debug Logger window looks like it is missing earlier output, check the
  log file: the window repaints only the recent history, while the file holds the whole
  session.

### The application feels sluggish under a heavy stream
- Close the Debug Logger window (**Window > Hide Log**) — it is the most expensive window
  to draw, and closing it does not interrupt logging. **Window > Show Log** brings it back.
- Close debug windows you are not watching, or lower the data rate in the P2 program.
- A `⋯ N line(s) not shown ⋯` marker in the Debug Logger is the display keeping up on
  purpose, not an error, and not data loss — the log file has every line.

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

- **Development vs monitoring:** keep **Reset P2 on App Startup** on for clean restarts
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
- **Single-step debugger:** the published Single-Step Debugger Manual
- **Quick start:** `DOCs/QUICK-START.md`
- **Parallax Forums:** the P2 section

---

*© 2024–2026 Iron Sheep Productions LLC*
*Licensed under the MIT License*
