# Changelog

## v1.1.1 (2026-09-30)

A P2 program that reads the keyboard or mouse from a debug display gets its answer.

### Bug Fixes

- **`PC_KEY` / `PC_MOUSE`**: answered when other directives precede them in the same
  statement, such as `` debug(`p clear pc_key(@k)) ``. The P2 program no longer hangs there
- **`PC_MOUSE` in a LOGIC display**: answered on every read; the P2 program no longer hangs
  on the first one
- **`PC_MOUSE`**: reports the mouse wheel in every display type. In PLOT, a notch not read
  within 100 ms is no longer reported
- **`PC_KEY` in a loop, PLOT display**: keyboard and mouse input no longer falls behind or
  repeats. Most noticeable on a slow host such as a Raspberry Pi
- **SCOPE and FFT displays**: the keyboard and mouse are captured even when the program
  reads them before sending its first data

## v1.1.0 (2026-09-29)

Downloads, debug windows and shutdown work on a slow host such as a Raspberry Pi.

### New Features

- **Exit code `70`**: PNut-Term-TS itself failed and printed the error. An internal crash
  no longer exits `0` in the windowed app, or `1` from the command line

### Improvements

- **Console output**: a download that cannot start names the reason — the port failed to
  open, no PropPlug was found, or several were found
- **Console output**: bytes discarded after switching to a serial baud that differs from
  the download baud are logged as hex and text

### Bug Fixes

- **Download at launch (`-r`, `-f`)**: a slow-loading window no longer fails the download
  with `serial connection not ready (timed out after 10s)`. Seen on a Raspberry Pi
- **`--exit-on-end-session`**: a failed download no longer ends with
  `Uncaught exception: TypeError: Object has been destroyed`
- **Debug Logger window**: on a slow host, its color theme and first lines no longer go
  missing
- **Debug display windows**: output sent while a window is still loading is drawn, however
  long the window takes to open
- **Download**: a P2 that answers identification late is found, not reported as
  `No Propeller v2 device found`
- **Quit and end of session**: a SAVE still finishing is given the full shutdown window;
  one that cannot finish exits `125`, not `0`
- **Single-step debugger**: a slow screen repaint no longer aborts a break as stalled; the
  stall limit matches PNut's 500 ms

## v1.0.10 (2026-09-23)

RAM downloads no longer fail at random with a checksum timeout.

### Improvements

- **Console output**: a checksum timeout reports how many bytes arrived after the `?` and
  how the first chunk began, telling no answer apart from garbled data

### Bug Fixes

- **RAM download (`-r`)**: a download whose CRC passed no longer intermittently fails with
  `P2 checksum response timeout`. Seen on macOS; affected v1.0.6 through v1.0.9

## v1.0.9 (2026-09-11)

The log records the P2's checksum verdict for every download that asks for one.

### Improvements

- `--diag-serial`: includes the checksum handshake detail — the wait, the reply detection,
  and the context around a timeout

### Bug Fixes

- **Log file**: a download's P2 checksum verdict — CRC passed, CRC failed, or no answer —
  is written in every build, with no flag needed

## v1.0.8 (2026-09-11)

In the windowed app, a RAM download reports the CRC result of the download that just ran.

### Bug Fixes

- **RAM download (windowed)**: a download whose CRC passed no longer fails, every time,
  with `P2 checksum verification did not complete`. Affected v1.0.6 and v1.0.7; headless
  was unaffected
- **Log file**: in the windowed app, lines reporting the port's baud rate after a change
  show the new rate, not the previous one

## v1.0.7 (2026-09-08)

The debugger's hint bar shows the P2's clock frequency when the pointer is away.

### Bug Fixes

- **Debugger hint bar**: shows `Clock frequency is N Hz`, the P2's reported clock, whenever
  the pointer is off the window, from the moment it opens

## v1.0.6 (2026-08-29)

RAM downloads verify the P2's CRC reply, and fail when it cannot be verified.

### Bug Fixes

- **RAM download (`-r`)**: the P2's CRC is verified; a download it rejects or never
  confirms fails, and says which
- **RAM download (`-r`)**: the CRC reply is read even when program output follows it at
  once, so the download ends about a second sooner
- `-f`: an image that already carries its flash loader is downloaded and CRC-verified like
  a RAM download
- **Log file**: `Download completed successfully` is written the moment the CRC passes,
  ahead of the program's first output
- **Log file**: the `[DOWNLOAD TO ...]` line naming the file, its size and its timestamp
  appears at the top of the new log

### Known Issues

- **RAM download (windowed)**: every download fails with `P2 checksum verification did not
  complete`, even when its CRC passed. Headless is unaffected. Fixed in v1.0.8

## v1.0.5 (2026-08-24)

Headless runs exit with the status they decided, and flag a log that is incomplete.

### Improvements

- **Console output**: a headless run that lost captured data says so, stamps
  `*** THIS LOG IS INCOMPLETE ***` into the log file, and exits non-zero

### Bug Fixes

- **Headless download**: a `--timeout` (exit `124`), Ctrl-C or end marker (exit `0`)
  arriving mid-download no longer ends in `unexpected failure` and exit `1`
- `--end-marker`: a serial device that stops responding ends the run with exit `1`
  instead of waiting forever for the marker
- `--headless --timeout` with a port that cannot be opened exits `1` immediately rather
  than waiting out the timeout
- **Control lines**: closing the app during a DTR or RTS reset no longer reports a
  control-line failure

## v1.0.4 (2026-08-24)

A headless run that ended cleanly no longer tells your script it failed.

### Improvements

- **Console output**: an error while closing the port or log after a run has decided its
  exit status is reported, and the decided status is kept

### Bug Fixes

- **Headless exit status**: a run ending on its end marker no longer prints
  `(exit code: 0)` and then exits `1`. It happened on about half of runs

## v1.0.3 (2026-08-23)

The serial baud gets its own name, and the download baud becomes a setting.

### New Features

- `--downloadbaud` / **Download Baud Rate** preference: sets the download rate, from 9600
  to 2000000; values outside that range are refused

### Improvements

- `--baud` / **Serial Baud Rate** preference: the rate for DEBUG output and terminal
  traffic. `--debugbaud` still works; giving both with different values is refused
- **Console output**: a serial or download rate above 2 Mbps prints a warning that the rate
  is unmeasured, and is still used

### Bug Fixes

- **Headless runs**: a program's own `DEBUG_BAUD` is applied to the port, not only
  recorded. Windowed runs were unaffected

## v1.0.2 (2026-08-14)

The debug log window keeps up with your program, and a release build's console stays quiet.

### Improvements

- **Console output**: individual `DTR:` / `RTS:` transitions, port-handle notes and the
  Windows synchronous-COM note print only under `--diag-serial`; resets and failures still print

### Bug Fixes

- **Debug log window**: a finished program no longer leaves the log or per-COG windows
  parked above their last lines and out of live mode
- **Scrollback preference**: sets how far back the log viewer scrolls, takes effect at
  once, and survives reopening the viewer. The default is 1000 lines
- **Debug log window**: quitting the app or ending a batch run shows every queued line
  before the window closes
- **Debug log window**: reopening the viewer replays the full history without reporting
  that the display fell behind

## v1.0.1 (2026-08-12)

Single-step debugger mouse, wheel, keyboard and hint-bar input matches PNut.

### Bug Fixes

- **Debugger wheel**: over the hub data pane, one notch moves one row and Ctrl+wheel one
  byte, not sixteen; over the hub heatmap it does not scroll
- **Debugger disassembly**: scrolling in hub mode moves the hub viewer with it; scrolling
  cog space stops at the end instead of wrapping to register zero
- **Debugger clicks**: the hub ASCII column and both buttons on BREAK respond; right-click
  on a hub-mode line below `$400` is refused, not an unreachable breakpoint
- **Debugger navigation**: clicking a REG or LUT heat strip centres the clicked register;
  an interrupt vector holding a hub address follows it into hub space
- **Debugger hint bar**: names the event row under the pointer, and six more regions show
  a hint
- **Debugger keyboard**: commands follow the typed character, so non-QWERTY layouts work;
  Ctrl+C, Ctrl+D, Ctrl+K, Ctrl+L and Ctrl+M respond as in PNut

## v1.0.0 (2026-07-27)

The first public release.

PNut-Term-TS is a debug terminal for the Parallax Propeller 2. It downloads a compiled
program to a P2 over a serial connection and then presents everything the P2 sends back —
as a serial terminal, as the P2's debug display windows, and in the single-step debugger —
while writing the whole session to a timestamped log file. It runs on Windows, macOS, and
Linux, on both x64 and arm64, and it runs with or without a graphical interface, so the
same tool serves a person at a desk and an automated hardware-in-the-loop test. Its
handling of the DEBUG display language follows PNut v55. It brings together the runtime
halves of PNut and Parallax Serial Terminal in one executable, and adds the automatic
logging that neither of them has.
