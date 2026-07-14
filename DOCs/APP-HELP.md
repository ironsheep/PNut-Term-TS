# PNut-Term-TS Application Help

PNut-Term-TS is a cross-platform debug terminal for the Parallax Propeller 2 (P2).
It receives the `debug()` output a P2 program emits over a USB serial adapter
(PropPlug or FTDI) and renders it through a set of specialized debug windows, with
support for downloading programs, recording and replaying sessions, and headless
automation.

For a fuller treatment see the **User Guide** (`DOCs/USER-GUIDE.md`); for the
single-step debugger see the **Debugger User Manual** (`DOCs/DEBUGGER-USER-MANUAL.md`).

> Shortcuts below are shown in their Windows/Linux form. On macOS, use `Cmd` wherever
> `Ctrl` is listed.

---

## Quick start

1. Plug the PropPlug into USB and connect it to the P2.
2. Run `pnut-term-ts -n` to confirm the device is detected.
3. Launch PNut-Term-TS. With exactly one device connected it auto-detects; otherwise
   pass `-p <device>` or pick one from **File → Select PropPlug**.
4. Download and run a program with `pnut-term-ts -r yourprogram.bin`.
5. Debug windows open automatically as the P2 sends `debug()` output.

Whether the P2 is reset when you connect is governed by the **Reset P2 on Connection**
preference (default: on).

---

## What the app does

PNut-Term-TS is the real-time interface between your computer and a running P2. It:

- receives the P2's serial `debug()` stream and classifies it,
- routes each message to the right debug window automatically,
- visualizes data through specialized windows (terminal, logic, scope, FFT, and more),
- logs all traffic to timestamped files for later analysis,
- downloads compiled binaries to P2 RAM or flash and resets the P2 to run them,
- captures full-rate streams (default debug baud **2 Mbps**) without data loss via an
  off-main-thread serial reader.

This is the TypeScript reimplementation of the original Pascal PNut Terminal,
targeting full functional parity with cross-platform support for Windows, macOS, and
Linux (x64 and arm64).

---

## Debug windows

Debug windows are created **automatically** by the P2 program's `debug()` display
directives — there is no menu command to open one. The directive syntax for each
window type is part of the Parallax P2 `debug()` specification and is documented in the
official Propeller 2 DEBUG documentation; this Help does not reproduce it.

| Window | Shows |
|--------|-------|
| **TERM** | Text terminal — status text and text UIs (PST or ANSI) |
| **BITMAP** | Pixel/image display (LUT, RGB, LUMA, HSV color modes) |
| **PLOT** | General X/Y plotting, shapes, and sprites |
| **SCOPE** | Oscilloscope-style waveform display |
| **SCOPE_XY** | X-vs-Y (Lissajous / vector) display |
| **LOGIC** | Logic-analyzer timing display |
| **FFT** | Frequency spectrum |
| **SPECTRO** | Spectrogram / waterfall |
| **MIDI** | MIDI keyboard / message display |
| **COG logger** | Per-COG `debug()` message log (COG 0–7) |
| **Debugger** | Interactive single-step PASM2 debugger (one per COG) |

### Shared window behavior

- **Automatic placement** — a window with no `POS` directive is laid out for you;
  windows with an explicit `POS` honor it.
- **Position readout while dragging** — drag a display window and its title bar shows
  the live `x, y` position, so you can pick coordinates for a `POS` directive. (The COG
  logger and debugger windows don't show this.)
- **SAVE** — `debug()` `SAVE` / `SAVE WINDOW` directives write a window's image to a
  bitmap file.
- **Input forwarding** — a window forwards mouse and keyboard input back to the running
  P2 program when the program requested it (`PC_MOUSE` / `PC_KEY`).

---

## Menus

PNut-Term-TS uses the native application menu on macOS and an in-window menu bar on
Windows/Linux. The items are equivalent; accelerators follow the platform.

### File

| Item | Shortcut | Description |
|------|----------|-------------|
| New Recording | | Begin a new recording session |
| Open Recording… | | Load a `.p2rec` recording for playback |
| Save Recording As… | | Save the current recording |
| Select PropPlug ▸ | | Choose among connected devices; the chosen device becomes your default |
| Start Recording | `Ctrl+R` | Begin recording the debug stream |
| Stop Recording | | End the current recording |
| Playback Recording | `Ctrl+P` | Replay the selected recording with original timing |
| Exit | `Ctrl+Q` | Quit the application |

### Edit

| Item | Shortcut | Description |
|------|----------|-------------|
| Cut / Copy / Paste | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | Standard clipboard actions |
| Find… | `Ctrl+F` | Search the terminal output |
| Clear Terminal | | Clear the main terminal display (does not affect the Debug Logger) |
| Preferences… | `Ctrl+,` | Open the settings dialog |

### Window

| Item | Description |
|------|-------------|
| Performance Monitor | Open the performance metrics window |
| Cascade | Arrange debug windows in a cascade |
| Tile | Tile debug windows to fill the screen |
| Show All Windows | Reveal all debug windows |
| Hide All Windows | Hide all debug windows (they stay active) |

### Help

| Item | Shortcut | Description |
|------|----------|-------------|
| Documentation | `F1` | Open this Help |
| About PNut-Term-TS | | Version, build, platform, and runtime details |

> On macOS, **Preferences…** is under the application menu (`Cmd+,`), along with the
> standard **Quit** and **Hide** items.

---

## Settings & preferences

Open with **Edit → Preferences…** (`Ctrl+,`, or `Cmd+,` on macOS).

### Settings hierarchy

Settings resolve in priority order — the first that supplies a value wins:

1. **Project settings** — overrides scoped to the current project directory.
2. **User settings** — your per-machine defaults.
3. **Application defaults** — the built-in baseline.

The dialog has three tabs: **User Settings**, **Project Settings**, and **PropPlug
Management**. Project Settings mirrors the User Settings controls, each behind an
**override** checkbox — only checked items override your user defaults for the current
project (delta-save); unchecked items inherit and display the global value.

### Terminal

| Setting | Options | Default |
|---------|---------|---------|
| Terminal Mode | PST, ANSI | PST |
| Color Theme | Green on Black, White on Black, Amber on Black | Green on Black |
| Font Size | 10–24 | 14 |
| Font Family | Default, Parallax, IBM 3270, IBM 3270 Green, IBM 3270 Amber | Default |
| Show COG Prefixes | on / off | on |
| Local Echo | on / off | off |

### Serial Port

| Setting | Options | Default |
|---------|---------|---------|
| Default PropPlug | Auto-detect, or a named device | Auto-detect |
| Default Baud Rate | 115200, 230400, 460800, 921600, 1000000, 2000000 | 2000000 |
| Reset P2 on Connection | on / off | on |

> The DTR/RTS control line is **not** set here — it is configured per device in the
> PropPlug Management tab.

### Logging

| Setting | Options | Default |
|---------|---------|---------|
| Log Directory | path | `./logs/` |
| Auto-Save Debug Output | on / off | on |
| New Log on P2 Reset | on / off | on |
| Max Log Size | 1 MB, 10 MB, 100 MB, Unlimited | Unlimited |
| Enable USB Traffic Logging | on / off | off |
| USB Log Directory | path | `./logs/` |

### Recordings

| Setting | Default |
|---------|---------|
| Recordings Directory | `./recordings/` |

### Debug Logger

| Setting | Range | Default |
|---------|-------|---------|
| History Lines | 100–10000 | 1000 |

### Settings file locations

- **User (global):** `%APPDATA%\PNut-Term-TS\settings.json` (Windows) or
  `~/.pnut-term-ts-settings.json` (macOS/Linux).
- **Project (local):** `./.pnut-term-ts-settings.json` in the project directory —
  created only when you enable project-specific overrides.

---

## PropPlug / device management

PNut-Term-TS remembers each USB serial device it sees and lets you name it and set its
reset control line. Open **Preferences → PropPlug Management** to manage the
known-devices list: set a **Friendly Name**, choose the **Control Line** (DTR or RTS),
view VID/PID, and save or delete a device. New devices are added automatically on USB
enumeration with the Parallax default control line (DTR).

This tab manages device *properties*. Choose *which* device to use from the User or
Project Settings tabs, from **File → Select PropPlug**, or with the `-p` flag.

### Control line (DTR vs RTS)

P2 reset is asserted over DTR or RTS:

- Parallax PropPlugs and most FTDI adapters → **DTR**.
- Some clones/adapters → **RTS**.

The control line is stored per device; the `--rts` command-line flag overrides it for a
session (primarily for `--ide`).

### Device selection priority

1. Command-line `-p <device>` (exact, or case-insensitive partial match on path/serial).
2. Project device override (if enabled).
3. User default.
4. Auto-detect (exactly one device connected).
5. Otherwise selection is required.

---

## Recording & playback

A recording captures an entire debug session for later replay — useful for regression
testing, sharing reproductions, and offline study.

- **Format:** `.p2rec` (binary, with timing metadata); `.jsonl` recordings also play
  back. Default location `./recordings/`, auto-named `recording_YYYYMMDD_HHMMSS.p2rec`.
- **Record:** **File → Start Recording** (`Ctrl+R`); stop with **File → Stop
  Recording**. The logging indicator is lit while recording.
- **Play:** **File → Open Recording…**, then `Ctrl+P` to play. Playback reproduces the
  captured stream — including timing — driving the debug windows as the live session
  did.

---

## Performance monitoring

Open with **Window → Performance Monitor** to watch the health of the serial → window
data path: throughput history, receive/message buffer usage, per-window queue depth,
and message/error counts. If buffer usage climbs toward full at high baud, reduce the
data rate or close windows you don't need.

---

## The main window

The main window hosts a menu bar, a text-entry field, a toolbar, the terminal/log
display, and a status bar.

**Toolbar (left to right):**
- **Reset control line** — a button showing the active reset line (**DTR** or **RTS**)
  with a checkbox; click to assert a reset on the P2. (The line is set per device in
  PropPlug Management.)
- **RAM** / **FLASH** — download the loaded binary to the P2's RAM or flash and run it;
  the adjacent LED is green for the active download target.
- **📥 Download** — choose a binary file and download it.
- **⏺ Record** / **▶ Play** — start/stop a recording and play one back; a status label
  ("Ready", "Recording…") sits alongside.

A **text-entry field** above the toolbar sends a line of text to the running P2 when you
press **Enter**. During playback a transport strip appears with play/pause/stop, an
elapsed/total time readout, a scrubber, and a speed selector (0.5×, 1×, 2×).

**Connection indicator** (status bar): green when connected, amber when disconnected
(grey until the first connection).

**Other status fields:** active COGs, the logging indicator (lit while recording),
TX/RX activity indicators, the connected **Port**, the active **Baud**, and the
**DTR/RTS** control line for the current device. The **Echo** checkbox filters locally
echoed characters from the display.

**Terminal display area:** shows your program's terminal output — text classified as
terminal output, `print()` text, and COG lines that don't match the COG-window pattern.
Backtick window commands do **not** appear here; they route to their windows.

---

## Debug Logger

The Debug Logger is the central log of all serial traffic, with timestamps.

- **Auto-scroll** keeps the latest messages in view; turn it off to review history.
- **Search** filters messages by keyword.
- Transmitted bytes are marked `[TX]`; control characters show as `<cr>`, `<lf>`.
- A P2 reset produces a session marker (golden sync point) that separates sessions and
  rotates the log file.
- Messages are shown in distinct colors by type — terminal output, COG messages, window
  (backtick) commands, and errors.

History length is set by **History Lines** in Preferences (default 1000).

---

## COG windows

A COG window logs the `debug()` messages from one COG (0–7).

- **Message format:** `Cog<N>  <message>` — note the **two spaces** after the COG name.
- Each window shows recent-activity state and a per-COG message count.
- **P2 system init** (`Cog0 INIT … load`) is a golden sync point: it marks a new
  session, clears debug windows, and rotates the log.
- COG windows are optional — COG messages that arrive with no window open are logged to
  the Debug Logger and otherwise dropped silently.

---

## Backtick window: creation vs. update

`debug()` window traffic uses backtick commands. The first word decides whether a
command **creates** a window or **updates** one.

**Create** — first word is a window-type keyword:

```
`logic  scope  scope_xy  fft  spectro  plot  term  bitmap  midi
```

Example — create a 16-channel logic window named `SIGNAL_BUS`:

```
`logic SIGNAL_BUS 16 1000
```

**Update** — first word is an existing window's name (anything not a type keyword):

```
`SIGNAL_BUS $FFFF      updates the window named SIGNAL_BUS
`my_scope 123 456      updates the window named my_scope
```

Update commands must match the window name **exactly** (case-sensitive). An update to a
name that doesn't exist is an error — check the Debug Logger to see the raw command.

---

## Keyboard shortcuts

Windows/Linux shown; use `Cmd` instead of `Ctrl` on macOS.

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` | Start Recording |
| `Ctrl+P` | Playback Recording |
| `Ctrl+F` | Find in terminal |
| `Ctrl+,` | Preferences |
| `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | Cut / Copy / Paste |
| `Ctrl+Q` | Exit |
| `F1` | Documentation |

> Inside a debug window, mouse and keyboard input may be forwarded to the running P2
> program when that program requested it (`PC_MOUSE` / `PC_KEY`).

---

## Command-line usage

```bash
pnut-term-ts [options]
```

| Option | Long form | Description |
|--------|-----------|-------------|
| `-r` | `--ram` | Download the file to RAM and run |
| `-f` | `--flash` | Download the file to flash and run |
| `-p` | `--plug` | Use the PropPlug at `<device>` (path/serial; partial match OK) |
| `-b` | `--debugbaud` | Debug baud rate (default 2000000) |
| `-n` | `--dvcnodes` | List detected USB serial devices and exit |
| `-u` | `--log-usb-trfc` | Write a timestamped USB-traffic log |
| | `--ide` | IDE-integration mode (minimal UI) |
| | `--rts` | Use RTS instead of DTR for reset (intended with `--ide`) |
| | `--headless` | Run with no GUI (file logging only) |
| | `--timeout <s>` | Exit after N seconds (headless only) |
| | `--end-marker [phrase]` | Exit when `phrase` appears; default matches `END_SESSION` / `DEBUG_END_SESSION` |
| | `--exit-on-end-session` | GUI batch: exit on the end-session marker, draining saves/logs first |
| `-V` | `--version` | Print the version |
| `-h` | `--help` | Show help |

```bash
pnut-term-ts                                      # GUI, auto-detect a single device
pnut-term-ts -r myprogram.bin                     # download to RAM and run
pnut-term-ts --ide -p P9cektn7                    # IDE mode for the VS Code Spin2 extension
pnut-term-ts -n                                   # list connected devices
pnut-term-ts --headless -r test.bin --end-marker  # headless, exit on end-session marker
```

`-r` and `-f` are mutually exclusive; `--timeout` requires `--headless`; `--end-marker`
requires `--headless` or `--exit-on-end-session`. A bad command line is reported in full
and exits with code `2` without running anything. See the **User Guide** for the full
command-line reference, exit codes, and operating modes.

---

## Troubleshooting

**No data appears**
- Confirm the connection indicator is green and the correct port is selected.
- Match the debug baud to your program (`-b`, or the Default Baud Rate preference).
- Confirm the P2 is powered, running, and emitting `debug()` output; try a DTR/RTS reset.

**Garbled text** — usually a baud mismatch. Common rates: 115200, 921600, 2000000.

**P2 doesn't reset / program doesn't start** — the control line may be wrong for your
adapter. Set DTR or RTS for the device in **Preferences → PropPlug Management**, or pass
`--rts` for the session. PropPlugs use DTR; some clones use RTS.

**Messages in the wrong window** — backtick updates must match the window name exactly;
COG lines need the `Cog<N>  ` format (two spaces). Check the Debug Logger for the raw
stream.

**A window is blank** — confirm the P2 is sending to that window; open the Performance
Monitor and lower the data rate if buffer usage is high.

**Performance** — watch the Performance Monitor; if buffers fill at high baud, reduce
baud or close unneeded windows.

**Platform notes** — Windows: ensure no other app holds the COM port. macOS: grant
serial access if prompted; devices appear as `/dev/tty.usbserial-*`. Linux: add your
user to the `dialout` group (`sudo usermod -a -G dialout $USER`, then re-login).

---

## Getting help

- **GitHub repository / issues:** https://github.com/ironsheep/PNut-Term-TS
- **Propeller 2 documentation:** https://propeller.parallax.com/p2.html
- **P2 `debug()` directive reference:** the official Parallax P2 DEBUG documentation
- **Single-step debugger:** `DOCs/DEBUGGER-USER-MANUAL.md`
- **Parallax Forums:** the P2 section

Check **Help → About** for the version, build, platform, and runtime details. Log files
are written to your configured Log Directory (default `./logs/`); attach the relevant
log when reporting an issue.

---

*Version 0.9.73 — © 2024–2026 Iron Sheep Productions LLC, MIT License*
