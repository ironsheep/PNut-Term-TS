# Changelog

All notable changes to PNut-Term-TS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.49] - 2026-06-12

Diagnostic build to pin a reported `Spin2NumericParser: Unknown numeric format - value: "'"`
error seen while running a TERM status-panel program. Static tracing of every parser call site
reachable by a TERM program shows none of the program's actual feeds can place a `'` where a
number is expected, so this build instruments the single log site to dump a call stack the
moment a quote token reaches the numeric parser. This pinpoints the exact window/method/line
producing the leak at runtime. No behavior change for well-formed feeds; the instrumentation is
temporary and will be removed once the path is identified and fixed.

### Added

- **Temporary diagnostic:** `Spin2NumericParser.logError` now emits a `[PARSER-LEAK TRACE]`
  call stack whenever a quote token (`'`/`"`) reaches `parseValue`, to locate the runtime path
  that leaks a quote into numeric parsing.

## [0.9.48] - 2026-06-12

A follow-on parsing fix to the 0.9.47 foundation pass. Runtime DEBUG feeds written in
Spin2 as `` `(a, b, c) `` are tokenized with each comma as its own standalone token, and
three windows passed those separator tokens straight to the numeric parser — producing
`Unknown numeric format - value: ","` and, in LOGIC, mis-grabbing positional values. The
trigger was a TERM status panel (`test_term_status.bin` @ 2Mbaud) that logged the error
six times. TERM, SCOPE_XY, and LOGIC now skip standalone comma tokens before parsing,
matching the six windows (PLOT, SCOPE, FFT, SPECTRO, BITMAP, MIDI) that already did. The
fix is surgical and invisible to well-formed feeds; it only stops the spurious errors and
restores correct value sequencing on comma-separated feeds.

### Fixed

- **TERM, SCOPE_XY, LOGIC: comma separators in `` `(a, b, c) `` runtime feeds no longer
  reach the numeric parser.** `tokenizeCommand` emits each `,` as its own token; these
  three windows now skip standalone comma tokens before calling `Spin2NumericParser`,
  eliminating `Unknown numeric format - value: ","` and fixing LOGIC's positional
  TRIGGER/HOLDOFF value grabs. The other six windows already guarded against this.

## [0.9.47] - 2026-06-12

Foundation parity pass over how all nine debug-display windows parse their declaration
and runtime directives. The earlier nine-window sprint aligned *which* directives each
window accepts and *how* it draws; this one aligns the parsing itself — numeric formats,
clamp bounds, color handling, and accept/reject behavior — to the original Pascal
(`DebugDisplayUnit.pas`). The trigger was a TERM `COLOR` crash that exposed a broader,
orthogonal gap: windows that drew correctly could still misparse a declaration.

Three things changed across the board. **Numeric parameters now accept the full Spin2
set** — `$hex`, `%bin`, `%%quaternary`, and `1_000` underscore separators — everywhere a
directive takes a number; previously several windows used raw `Number()`/`parseInt()`
that silently turned those into `NaN` and dropped the value. **Directive colors are
centralized** through one shared KeyColor parser, so a color name plus optional
brightness (e.g. `CYAN 8`) is honored consistently — MIDI and SCOPE_XY previously lost
named colors or the brightness byte. **Parsing never rejects a window:** matching Pascal,
an out-of-range or malformed parameter is clamped or skipped and parsing continues, and a
valid display type always creates its window — a single bad value can no longer abort the
declaration or drop the directives after it. As part of strict parity, a few invented,
non-Pascal directives (BITMAP runtime `DOTSIZE`/`SPARSE`) were removed.

For most demos this is invisible — well-formed declarations parse as before. The
difference shows on edge-case or machine-generated strings, which now clamp to a sensible
window instead of failing. The authoritative parsing reference is recorded in-repo at
`DOCs/project-specific/WINDOW-PARSING-PARITY.md`.

This release also adds a test-coverage gate that fails the build if any test file is
unregistered or any test is silently skipped, closing a class of invisible test gaps.

### Changed

- **All nine windows: numeric directive parameters accept full Spin2 numeric formats**
  (`$hex`, `%bin`, `%%quat`, `1_000`) via the shared `Spin2NumericParser`, replacing raw
  `Number()`/`parseInt()` that dropped those formats to `NaN`. Affects SCOPE_XY, MIDI,
  SPECTRO, FFT, LOGIC, BITMAP, PLOT (SCOPE/TERM were already compliant).
- **Directive colors centralized** through a shared `parseKeyColor` helper: a color name
  with optional brightness, or a numeric / `$hex` / `#rrggbb` literal, parsed the same way
  everywhere (COLOR / BACKCOLOR / SPARSE / LUTCOLORS). MIDI `COLOR name brightness` and
  SCOPE_XY named colors, previously lost, are now honored.
- **Parsing is clamp-and-continue, never reject** (strict Pascal parity): out-of-range
  parameters clamp to their documented bounds, malformed ones are skipped, and a valid
  display type always creates its window. A bad parameter no longer drops later directives.
- **Cross-window grid-color default fix:** a `COLOR` with only a background color now keeps
  each window's own grid-color default (`$404040`) instead of being overwritten — corrects
  SCOPE, LOGIC, and FFT.

### Removed

- **Invented non-Pascal directives:** BITMAP runtime `DOTSIZE` and `SPARSE` commands that
  have no counterpart in the Pascal source were removed (parity).

### Added

- **Test-coverage / no-skip gate** (`scripts/claude/check_test_coverage.sh`, wired into the
  sequential runner and CI): the build fails if any `tests/*.test.ts` is neither registered
  nor on the reasoned exclusion list, or if any non-excluded test carries a `.skip`/`.only`
  marker. Suite at release: 155/155, 0 silent skips.
- **`DOCs/project-specific/WINDOW-PARSING-PARITY.md`** — authoritative per-window directive
  bounds/defaults table, the two color-path distinction, and the never-reject policy.

## [0.9.46] - 2026-06-10

Fixes a crash that aborted the download (and killed the serial connection) when the off-main serial
worker was active — the default since v0.9.39. The symptom was an abrupt exit with
`TypeError: value.split is not a function` followed by `serial utility process exited`, seen on a
plain CLI download with or without USB-traffic logging (`-u`). The cause was a diagnostic log line
in the serial `write()` path that assumed any non-`Buffer` value is a `string`. A `Buffer` handed to
the serial worker crosses the process boundary via structured clone, which drops the `Buffer`
prototype and delivers it as a plain `Uint8Array`; `Buffer.isBuffer()` then returns `false`, so the
code called `.split()` on a `Uint8Array` and threw. The actual byte write had already succeeded — the
throw was purely in the post-write logging callback, but being unhandled it tore down the whole
serial process. The guard now keys on `typeof value === 'string'`, so both real `Buffer`s and
boundary-downgraded `Uint8Array`s take the byte-count log path. Transmit behavior is unchanged.

### Fixed

- **Serial `write()` no longer crashes the serial worker process when logging a binary write.** The
  diagnostic formatter guarded on `Buffer.isBuffer(value)`, but a `Buffer` sent across the
  serial-worker boundary arrives as a `Uint8Array` (structured clone drops the `Buffer` prototype),
  which failed the check and fell through to `value.split()` — throwing `TypeError: value.split is
  not a function` and terminating the serial utility process mid-download. The guard now tests
  `typeof value === 'string'` so non-string payloads are logged as `<Buffer N bytes>`.

## [0.9.45] - 2026-06-10

Fixes a false end-of-session detection that could disconnect the serial port mid-run and drop a
message from the log. The end-of-session signal is a single `0x1B` (ESC) byte, but the terminal was
treating *any* `0x1B` anywhere in a COG message as that signal. Binary `DEBUG` data legitimately
contains `0x1B` bytes — for example a 16-bit sample value of `$031B` serializes to the bytes
`1B 03`. When such a value appeared inside a binary payload, the terminal mistook it for the
end-of-session sentinel: it disconnected the serial port (so the rest of the run was never
received) and replaced the carrying message in the log with `[DEBUG_END_SESSION]` (dropping the
real bytes). The sentinel is now trusted **only** when the `0x1B` immediately follows a `CR LF`
line terminator (the 3-byte sequence `0D 0A 1B`), which binary sample data effectively never
produces. Surfaced during voice-recognizer (DF2301Q) hardware testing.

### Fixed

- **A `0x1B` byte inside binary DEBUG data no longer triggers a false end-of-session.** Detection
  was changed from "the message contains `0x1B` anywhere" to "a `0x1B` immediately preceded by a
  `CR LF` pair." This prevents the spurious serial-port disconnect and the lost log message when a
  binary sample value (e.g. `$031B`, or `$1B0A` → `0A 1B`) happens to carry a `0x1B` byte. New
  shared `isEndSessionSentinel()` helper is used by both the window router and the debug logger.

## [0.9.44] - 2026-06-10

Fixes an intermittent crash on command-line download (`-r`/`-f`): "Cannot read properties of
undefined (reading 'getCurrentBaudRate') — failed to download to RAM", seen every few starts on a
tight exit→relaunch cycle. The auto-download was kicked off on a fixed 2-second delay, but
establishing the serial connection is asynchronous and variable — especially when the previous
instance's serial process is still releasing the port on a rapid relaunch. When the connect ran
long, the download started against a half-initialized port and crashed. The download now **waits
for the connection to actually be ready** (up to 10 s) before starting, instead of guessing a
delay, and aborts cleanly with a clear message if it never connects.

### Fixed

- **Command-line download no longer races the serial connect.** `downloadFileFromPath` waits for
  the port + downloader to be fully established before downloading; the fixed 2-second pre-download
  delay was removed (the readiness wait replaces it). Resolves the intermittent
  undefined-port crash on fast download→exit→relaunch cycles.

## [0.9.43] - 2026-06-10

Fixes the "displays freeze for seconds, then jump" behavior on busy multi-window demos at the
root. The diagnostics showed the single main thread was being monopolized by serial-message
processing in long bursts, starving the display so it could only repaint in the gaps. This build
**time-shares the main thread**: it processes incoming messages for a short slice (~8 ms), then
yields so the display can repaint, then continues — so the windows paint at a steady cadence the
whole time instead of stalling and lurching. Because the slice is measured in *time* (not message
count), this behaves the same across hardware — a slower machine simply does less per slice but
still repaints just as often, so it looks responsive on a Raspberry Pi, a typical Windows box, or
a Mac without any per-machine tuning. Overall runtime is essentially unchanged; it just always
*looks* like it's working. This supersedes the v0.9.42 repaint cap, which has been removed.

### Changed

- **Main-thread work is now time-sliced between consuming the serial stream and repainting**
  (~8 ms processing slices with yields), so the display updates continuously instead of freezing
  in multi-second bursts. Hardware-independent by design.

### Removed

- The v0.9.42 per-pass repaint cap and its `PNUT_RENDER_BATCH_CAP` knob — the time-slicing makes
  it redundant, so it's gone rather than left as an unused control.

## [0.9.42] - 2026-06-10

Smooths out the repaint cadence on multi-window bitmap demos. v0.9.41's coordinated scheduler
fixed the ordering but made updates too coarse — when the busy main thread briefly freed up, a
window would repaint its entire accumulated backlog in one big jump, then the next window, so the
windows updated in large, infrequent steps. This build caps how much each window repaints per
pass, so all windows advance in small, even increments together — a more responsive feel. The cap
is tunable per-run via `PNUT_RENDER_BATCH_CAP` (smaller = finer/more-frequent updates) so the
sweet spot can be dialed in on hardware. Note: this is a smoothness change, not a throughput one —
the overall speed gate at high data rates is the main thread keeping up with the incoming stream,
which is a separate follow-up.

### Changed

- **Bitmap repaints are now capped per pass** (default ~8192 px/window, override with
  `PNUT_RENDER_BATCH_CAP`): windows advance in small even steps together instead of one window
  making a large jump at a time. Smoother, more responsive painting; no change to final output.

## [0.9.41] - 2026-06-10

Second bitmap-rendering performance pass, targeting the jerky, out-of-order painting on
multi-window demos. v0.9.40 fixed the missing-final-row glitch (and confirmed per-pixel drawing
was no longer the bottleneck), but the diagnostics showed the real cost is *serialization*: each
window was running its own independent repaint loop, and with several windows live at once they
all piled work onto the single rendering thread out of order — producing a backlog and the
visible "one window finishes late" reordering. This build replaces those per-window loops with a
**single coordinated repaint pass** that updates every window needing a refresh together, in a
fixed window order, one after another. That bounds the backlog and makes painting orderly. Run
with `PNUT_RENDER_STATS=1` to compare.

### Changed

- **One global render scheduler** replaces the per-window repaint timers. All windows that need a
  refresh are flushed together each frame in stable creation order, instead of competing
  independently — smoother, ordered painting with a bounded renderer backlog. No behavior change
  to what's drawn.

## [0.9.40] - 2026-06-10

First performance pass on the correct-but-slow bitmap rendering. The v0.9.39 render-timing
diagnostics showed the bottleneck is the **renderer**: drawing each pixel with its own canvas
fill call was, by far, the most expensive thing it did. This build replaces that per-pixel loop
with a single image blit — pixels are written into an in-memory image buffer and pushed to the
canvas in one operation per update. This should sharply cut the per-update render cost on dense
demos like RGB24. (A follow-up will coordinate the windows' repaints to also smooth out the
remaining jerkiness/reordering.) Run with `PNUT_RENDER_STATS=1` to compare the before/after.

### Changed

- **Bitmap pixels are now drawn via a single `putImageData` blit** instead of one `fillRect`
  per pixel. The image buffer is kept in sync with clears and scrolls, so behavior is unchanged
  — only much faster. Pixels also carry their color as a number rather than a CSS string.

## [0.9.39] - 2026-06-10

Promotes the off-main-thread serial path from opt-in to **the** serial path. The dedicated serial child process + lossless backpressure (v0.9.36–v0.9.38) validated on hardware — HSV16 clean and RGB24 lossless at 2 Mbaud — so it now runs by default with no flag. The verbose connect-handshake logging used to bring it up has been quieted (genuine errors still print). This build also adds **opt-in render-timing diagnostics** (`PNUT_RENDER_STATS=1`) that measure where each bitmap window spends its drawing time — building the update on the main process vs. waiting on the renderer — so we can pin down and tune the remaining slowness on dense demos like RGB24 (which is correct, but paints slowly/jerkily). macOS is the validated platform for this test-release stage.

### Changed

- **Off-main serial I/O is now the default and only path** (the `PNUT_SERIAL_WORKER` flag is gone). The legacy main-thread serial code still runs inside the serial child process.
- **Quieted the serial connect/RPC play-by-play logging** (the `[HOST]`/`[SERIAL-PROXY]` chatter); real failures still log.

### Added

- **Render-timing diagnostics** (`PNUT_RENDER_STATS=1`): per-second, per-window split of main-side update-build time vs. renderer round-trip time, plus active-window count and pixel/flush counts — to identify which rendering bottleneck to tune.

### Removed

- Dead `getRingTransferables()` helpers left over from the worker-thread→child-process pivot.

## [0.9.38] - 2026-06-10

Makes the experimental off-main-thread serial path **lossless under heavy display load**. With the serial port now hosted off the main process (v0.9.36+), high-volume demos like the RGB24 bitmap test still dropped data — not at the port, but downstream: when the main process can't process incoming messages as fast as they arrive, the internal hand-off buffers filled and the oldest messages were discarded ("message lost"), producing incomplete renders. This build replaces dropping with **backpressure**: when a buffer is full the producer briefly waits instead of discarding, so a momentary slow-down delays a message rather than losing it. Every byte is preserved and the picture renders complete. Includes opt-in receive-pipeline telemetry (`PNUT_RX_STATS=1`) to confirm the behavior on hardware. Still opt-in via `PNUT_SERIAL_WORKER=1`; default behavior unchanged.

### Changed

- **Receive pipeline never drops data under load.** The message pool and the shared ring buffer now apply backpressure instead of discarding when full: the extraction worker holds a message (leaving data in the ring) until a slot frees, and the main process holds incoming chunks in an ordered queue until the ring drains. The ring is also kept at most half-full so its data stays in a race-free region. No message is lost; rendering simply catches up.

### Added

- **Receive-pipeline diagnostics** (`PNUT_RX_STATS=1`): once-per-second logging of extraction rate, backpressure activations, pool occupancy, and ring-queue depth, to validate losslessness on real hardware.

## [0.9.37] - 2026-06-09

Diagnostic build for the experimental off-main-thread serial path. v0.9.36 fixed the crash (the serial child process is now stable and survives incoming data), but connecting hangs: the main process waits forever for the child to confirm the port opened, so downloads report "Please connect to a Propeller 2 device first" even though the port is open. This build adds detailed connect-handshake logging (visible in the console) to pinpoint where the request/response between the two processes stalls. Opt-in path only (`PNUT_SERIAL_WORKER=1`); default behavior unchanged.

## [0.9.36] - 2026-06-09

Continues the experimental off-main-thread serial work. v0.9.35 loaded the serial worker but crashed the instant data arrived: the native serial library pins its data-ready callback to the **main process's** event loop, so it cannot run inside a background thread (it fired against the wrong context and segfaulted). The opt-in path now hosts the serial port in a **dedicated child process** (an Electron utility process) instead — where that callback runs correctly on the child's own loop, fully off the main process. Still opt-in via `PNUT_SERIAL_WORKER=1`; default behavior unchanged.

### Changed

- **Off-main serial I/O now uses a dedicated child process** rather than a worker thread (the serial library is not thread-safe). The child drains the port and forwards data to the main process, which feeds the existing pipeline; downloads and device detection are preserved.

## [0.9.35] - 2026-06-09

Packaging fix for the v0.9.34 experimental serial worker: in the packaged app the worker failed to start with `Cannot find module 'serialport'`. The worker bundle now inlines the serialport JS (keeping only the native binding resolved at runtime), exactly as the main bundle does, so the opt-in `PNUT_SERIAL_WORKER=1` path can load on macOS/Windows/Linux installs. No change to default behavior.

## [0.9.34] - 2026-06-09

Root-cause work on the high-rate serial corruption seen at 2 Mbaud. Investigation showed the received bytes were being corrupted **before** the app could parse them — the serial-port read shares the main thread with all the on-screen rendering, so under heavy display load the driver isn't serviced fast enough and bytes get garbled on arrival. This release adds an opt-in path that moves serial reception off the main thread entirely, plus the supporting render and instrumentation changes needed to validate it on hardware.

### Added

- **Experimental off-main-thread serial I/O (opt-in, `PNUT_SERIAL_WORKER=1`).** The USB serial port can now be hosted in a dedicated worker that reads bytes straight into the shared receive buffer, so display/render work on the main thread can never starve the driver. Downloads and device detection are preserved. **Default behavior is unchanged** — this path is off unless the flag is set, so normal use and existing builds are unaffected. Intended for hardware validation of the high-rate fix.
- **Event-loop responsiveness monitor (opt-in, `PNUT_LOOP_MONITOR=1`).** Logs main-thread scheduling delay (p50/p90/p99/max) so the before/after of the serial-offload work can be measured directly.

### Performance

- **Bitmap rendering coalesces canvas updates.** Pixels are now batched and flushed on a timer instead of one cross-process draw call per pixel, dramatically reducing per-message main-thread cost at high data rates. Display refresh cadence is unchanged.
- **Reduced hot-path work in the message router.** Diagnostic strings that were always being built (even with logging off) are now only built when logging is enabled.

### Known issues / not yet verified

- The off-main-thread serial path requires on-hardware validation at 2 Mbaud (open/read in the worker, downloads, DTR/RTS reset) before it becomes the default.

## [0.9.33] - 2026-06-09

Two hardware-certification fixes: the MIDI keyboard now renders when more than one note is held, and a hot-path performance fix toward sustaining high-rate bitmap streams.

### Fixed

- **MIDI keyboard now draws correctly with multiple notes held (chords).** The keyboard is drawn by one injected script built from all keys; each active note's velocity bar declared a JavaScript variable, so a second simultaneous note re-declared it and the whole draw failed with a script error ("MIDI drawing error"). The velocity-bar geometry is now computed up front so the drawing code declares no variables — any number of notes can be held at once.

### Performance

- **Bitmap pixel rendering does far less work per pixel.** The bitmap data path built several diagnostic log strings for *every pixel* even though that diagnostic logging is off by default — wasted work that, on a fast pixel stream, kept the app from draining the serial port quickly enough and caused dropped data at the higher communication rates. Those strings are now only built when diagnostic logging is explicitly enabled. (Further high-rate streaming work continues.)

### Known issues / not yet verified

- **Verified against the local test suite, type-check, and build.** On hardware: confirm a multi-note MIDI program draws the keyboard, and re-check the high-rate HSV16 bitmap demo at full speed to see how much the per-pixel fix recovers.

## [0.9.32] - 2026-06-09

Follow-up to the v0.9.31 `SAVE` work, from continued hardware-cert testing: the SCOPE window's saved image still showed a strip down the right edge, and the **SCOPE_XY window ignored `SAVE`, `SAVE WINDOW`, and `CLOSE` entirely**. Both are fixed, and a new test guards the whole class of bug.

### Fixed

- **SCOPE `SAVE` no longer has a strip down the right edge.** After v0.9.31 sized the window to its exact content, SCOPE was the one debug window whose page didn't suppress scrollbars, so a 1-pixel internal border overflowed the window by a hair and a vertical scrollbar appeared — captured in the saved image as a pale band on the right. SCOPE now suppresses scrollbars like every other window.
- **SCOPE_XY now honors `SAVE`, `SAVE WINDOW`, and `CLOSE`.** The X/Y scope silently dropped every one of these commands — no image file was written and the window would not close on `` `name CLOSE `` — because it stripped the window name from the message a second time (the router had already removed it), which discarded the actual command word. It now processes commands the same way the other windows do. (Numeric plotting was unaffected, which is why the dots still drew.)

### Internal

- **New command-dispatch test across all nine display windows.** Each window is now verified to handle `SAVE`, `SAVE WINDOW`, `CLEAR`, and `CLOSE` as the router actually delivers them (window name already removed). This is the regression net for the SCOPE_XY-style bug, where a window mishandles the delivered message shape — the previous SCOPE_XY test passed only because it fed the message in a shape the real router never produces.

### Known issues / not yet verified

- **Verified against the local test suite, type-check, and build.** Re-run the SCOPE and SCOPE_XY demos on a physical P2 to confirm SCOPE's saved BMP is clean to the right edge and that SCOPE_XY now writes both `SAVE` and `SAVE WINDOW` files and closes on end-of-session.

## [0.9.31] - 2026-06-09

Hardware-certification fixes for the `SAVE 'filename'` command (save window *contents* to a BMP). Two problems surfaced while exercising the demo programs: most windows saved with a **white strip down the right edge**, and the **SCOPE_XY window saved no file at all**.

### Fixed

- **`SAVE 'filename'` no longer leaves a white strip on the right (and bottom) edge.** Every debug *display* window except FFT sized its window by adding a fixed chrome estimate to the *outer* window size. On macOS — which has no left/right window borders — that made the drawable area wider than the actual content, so the saved image (which captures the whole content area) carried an unpainted white margin on the right, with a smaller one along the bottom. All of these windows now size by their **client area** and let the OS add the correct chrome (the same approach FFT already used): LOGIC, SCOPE, SPECTRO, PLOT, TERM, BITMAP, MIDI, and the debugger window. The visible on-screen window is now correctly sized as well.
- **`SAVE 'filename'` on a SCOPE_XY window now writes a file.** The plain-`SAVE` path could fail to produce any file at all: if the window snapshot came back empty for a moment, the failure went unhandled and the save was abandoned silently (the `SAVE WINDOW` form was unaffected because it already had a fallback). `SAVE` now detects an empty snapshot, waits a beat for the window to finish painting and retries once, and — if it still cannot capture — reports the reason instead of failing silently.

### Known issues / not yet verified

- **Verified against the local test suite, type-check, and build.** Re-run the SCOPE and SCOPE_XY demos on a physical P2 to confirm the saved BMPs are full-bleed (no white edge) and that SCOPE_XY produces a file.
- **The separate "broken `SAVE WINDOW` image" report remains open** — that is a distinct capture-timing issue during end-of-session shutdown.

## [0.9.30] - 2026-06-08

A hardware-certification crash fix. Automated batch runs that launch the app, download/run a program, and let it self-exit on `DEBUG_END_SESSION` (the `--exit-on-end-session` workflow) could crash the whole app with an abort (SIGABRT) on macOS during shutdown — observed mid-way through a back-to-back run of several files.

### Fixed

- **No more crash on `--exit-on-end-session` shutdown.** When a windowed run exited on end-of-session, two shutdown paths each closed the serial port — once unawaited from the end-session handler, then again from the window-close handler — so the port's native reader was torn down twice at the same time and aborted the process. End-of-session shutdown now hands serial-port teardown to a single owner that closes it once, cleanly, before the app exits. As a second line of defense, the serial close is now idempotent: any overlapping close requests share one teardown instead of racing. Interactive (window-close) shutdown was never affected; only the automated end-session path could hit this.

### Known issues / not yet verified

- **Verified against the local test suite, type-check, and build.** The fix targets the automated end-session shutdown path; confirm on a physical P2 with the same scripted launch → download → run → self-exit loop that previously crashed.
- **The separate "broken `SAVE WINDOW` image" report is still open.** A `SAVE WINDOW` capture that overlaps end-of-session shutdown can still produce a corrupt image; that is a distinct capture-timing issue from this crash and is tracked separately.

## [0.9.29] - 2026-06-08

Hardware-certification polish for the windowed (headed) workflow. This build fixes `SAVE WINDOW` so it once again captures the **full window including its title bar/frame**, makes `--exit-on-end-session` actually exit a windowed run, and quiets a cosmetic macOS startup log line found during certification testing.

### Added

- **macOS: a one-time Screen Recording permission prompt for `SAVE WINDOW`.** Because `SAVE WINDOW` now captures the window *with* its native title bar (see below), macOS requires Screen Recording permission. On startup, if the permission hasn't been granted, the app offers to enable it — with **Enable… / Remind Me Later / Don't Ask Again**. The dialog states clearly that this is **only** for `SAVE WINDOW`; the plain `SAVE` command (window contents only) is unaffected and never needs it. Windows and Linux are unaffected.

### Fixed

- **`SAVE WINDOW 'name'` again includes the window chrome.** It had regressed to saving only the window *contents* (same as plain `SAVE`). It now captures the on-screen window region including the native title bar and frame, matching PNut. `SAVE l t w h 'name'` (capture an explicit desktop rectangle) is fixed the same way. If the desktop capture is unavailable (e.g. macOS permission not yet granted), it falls back to a contents-only image so a file is always produced.
- **`--exit-on-end-session` now actually exits a windowed run.** The flag (and any `--end-marker` phrase) was parsed in the launcher but never reached the GUI process, so a headed run ignored `DEBUG(DEBUG_END_SESSION)` and stayed open. The setting now crosses the launcher→app process boundary, so a windowed run shuts itself down on end-of-session as documented.
- **macOS: the benign `SecCodeCheckValidity … (-67062)` startup line is suppressed.** This is a cosmetic upstream Electron/Chromium log on newer macOS (it appears even for valid, notarized signatures; tracked at electron/electron#49652) and has no functional impact. The launcher now filters just that line from output; all other diagnostics pass through untouched.

### Changed

- **`SAVE` reports the file it wrote.** Every `SAVE` now prints `pnut-term-ts: File written [<full path>]` (path and filename), replacing internal screenshot-directory debug chatter.

### Known issues / not yet verified

- **Not yet exercised on external P2 hardware.** Verified against the local test suite, type-check, and build only. The `SAVE WINDOW` chrome capture, the macOS permission flow, and headed `--exit-on-end-session` are validated on a physical P2 / real macOS as the next step.

## [0.9.28] - 2026-06-06

The nine Pascal-drawn **debug *display* windows** (LOGIC, SCOPE, SCOPE_XY, FFT, SPECTRO, PLOT, TERM, BITMAP, MIDI) are brought to **full behavioral parity** with the official PNut v55 — each window was checked directive-by-directive against the original and the remaining differences corrected (most visibly in BITMAP and MIDI). This build also fixes two real defects found while hardening the test suite: **binary-recording playback was completely broken**, and **SAVE could hang the app** on a failed capture.

### Fixed

- **Binary recording playback is fixed.** Every `.p2rec` recording failed to play back ("metadata truncated" / JSON parse error): the player read the metadata-length field from the wrong byte offset in the file header, so it never matched what the recorder wrote. Recordings made with earlier builds now load correctly.
- **SAVE no longer hangs the app on a failed capture.** If capturing the window image failed, the SAVE operation never completed and the app could appear frozen. The capture failure is now handled gracefully (SAVE finishes with an empty image instead of hanging).
- **BITMAP: a bitmap with no color mode now renders correctly.** The default is now RGB24 (one 24-bit color per long), matching PNut — previously the default decoded your data as RGB8, shredding each color into eight garbage pixels.
- **BITMAP: selecting a color mode no longer eats your first pixel.** Only the LUMA8 and HSV modes take a tint value; RGBI8/RGBI8W/RGBI8X, the LUT modes, and RGB8/RGB16/RGB24 do **not**. Previously every mode greedily consumed the next value as a tint, so e.g. `RGBI8 <data> …` silently dropped the first sample. HSV tints also now use the full 0–255 range instead of being clamped to 0–7.
- **BITMAP: reloading `LUTCOLORS` replaces the palette instead of growing it.** Each `LUTCOLORS` directive now fills the palette from index 0 (as PNut does), so sending a new palette mid-stream takes effect; previously colors were appended past the end and ignored.
- **BITMAP: the "W" color schemes (LUMA8W/HSV8W/RGBI8W/HSV16W) now clear to a white background**, and the background is chosen from the color mode (white / palette-0 / black) independent of the SPARSE color, matching PNut.
- **BITMAP: `SPARSE` and `LUTCOLORS` accept color names** (BLACK…GRAY with an optional brightness), not just numbers. SPARSE is also correctly disabled when the dot size is too small (< 4) to draw a bordered dot.
- **MIDI: piano-key positions and note-number labels are corrected.** The key-placement table had drifted for the upper half of each octave (F♯ through B), so those keys and their labels sat a pixel or two off; they now match PNut exactly.
- **MIDI: keys draw with the correct flat top edge** (the rounded-rectangle top is clipped as in PNut) instead of a rounded top, and the velocity bar height matches the original.
- **MIDI: an `UPDATE` directive is now ignored.** MIDI redraws immediately on every note event and has no deferred-update mode, so `UPDATE` no longer triggers a spurious redraw.

### Internal

- **Test suite hardened.** Each of the nine display windows now has a dedicated parity test pinned to the Pascal algorithm, and the maintained sequential test runner was expanded from 70 to 153 files — all green. 42 obsolete test suites covering removed/replaced internal architectures were deleted.

### Known issues / not yet verified

- **Not yet exercised on external P2 hardware.** This build is verified against the local test suite only. The whole-application + hardware visual-parity sign-off (all nine windows against the basic demos, then the single-step debugger) runs on a physical P2 and is the next step. See `tasks/PUNCH_LIST.md` for the full open-item list, including a handful of hardware-gated tests and two recorded parity deviations to confirm during that pass.

## [0.9.26] - 2026-06-02

The single-step debugger reaches **full Pascal parity and is ready for hardware testing**. This build finishes the debugger that the 0.9.25 architecture rewrite set up: a real disassembler, the remaining display behaviors, and the last interaction gaps.

### Added

- **Real, complete PASM2 disassembler in the debugger.** The disassembly panel now decodes the full PASM2 instruction set — CORDIC, smart-pin, pin control, hub-FIFO, LUT, streamer, ALT, bit-manipulation, cog/lock control, events/interrupts, and augmentation — instead of the previous partial/placeholder decoder. Every encoding is taken from the authoritative P2 instruction data, and a golden test pins the output against real compiled code. You will now see correct mnemonics and operands for any code the cog is running, including ROM debug entry/exit.
- **Skipped instructions are now struck through.** When a SKIP/SKIPF pattern is active, the instructions that will be skipped show a translucent strikethrough in the disassembly, so you can see at a glance what the cog will and won't execute on resume.
- **Hub heat-map now shows graded change intensity.** Each 128-byte hub sub-block flashes bright when it changes and fades over subsequent breaks (matching the register/LUT heat maps), instead of the old on/off coloring. Recently-written regions stand out, making memory-corruption hunting much easier.
- **"Go" while the cog is free-running now forces an async break.** If the display has dimmed (the cog is running, no recent breakpoint), pressing Go / Space requests a COGBRK for that cog instead of doing nothing — provided another cog is halted in its debugger to carry the request.
- **Mouse wheel over the hub address digits** now adjusts the individual hex nibble under the cursor, for fast hub-address targeting.
- **Clicking a pointer's data/character bytes** (FPTR / PTRA / PTRB rows) now jumps the hub viewer to that exact byte, not just the pointer's base address.
- **Tab no longer escapes the debugger window** — it is captured so keyboard focus stays put.
- **Headed batch mode — auto-exit on end of session (`--exit-on-end-session`).** A windowed run can now shut itself down when your code signals it's done — ideal for scripting a render farm (open windows, `SAVE` a bitmap, exit, repeat per file). Enable with `--exit-on-end-session`; the app exits when it sees the `DEBUG(DEBUG_END_SESSION)` sentinel, or a phrase you supply with `--end-marker "YOUR_PHRASE"` (now valid in headed mode, not just headless). It exits even in interactive mode once the flag is set. Before exiting it **drains all in-flight saves, logs, and recordings** so nothing is truncated.
- **Documented, consistent exit codes (headed == headless).** `0` clean (all data flushed), `1` serial-port error, `3` download failed, `124` run timeout (`--timeout`), and a new `125` = a save/log/recording flush didn't finish in time (your output may be incomplete). A launching script can branch on `$?` identically regardless of mode, and can now tell a clean shutdown from a truncation-risk timeout.

### Fixed

- **Truncated bitmap/log files on shutdown.** Previously, quitting the app (or an end-of-session) could tear down a window or the process while a `SAVE` was still writing — or while the log stream was still flushing — producing a truncated or missing file. Shutdown now **drains all in-flight saves, the debug log, and any active recording before tearing anything down**, on every exit path (window close, Ctrl+C/terminate, and end-of-session). This applies to headless too (the log is its product). Best-effort with a 10-second window; if a flush overruns, the app still exits but returns code `125` so you know the output may be incomplete rather than failing silently.

### Changed

- Internal cleanup: the old, unused main-process debugger implementation (~12k lines that had been superseded by the 0.9.25 renderer-process bundle) was removed. No user-visible change; the debugger you interact with is unchanged except for the additions above.

### Known issues / not yet verified

- **Not yet exercised on external P2 hardware** — this build is verified against the local test suite and recorded sessions only. Hardware bring-up is the next step.
- **Clicking the hub heat-map to jump the viewer is not wired yet.** The heat-map is display-only for now; use a hub-data click, the address-nibble wheel, or a pointer/SFR click to navigate. (Tracked in technical debt.)
- **Byte-exact disassembly operand text** has not been diffed against `pnut-ts` output, because `pnut-ts` is not available in the build container; the golden test pins our own decoder, not a third-party comparison.

## [0.9.25] - 2026-04-17

### Changed

- **Single-step debugger rewritten with a proper renderer-process architecture** (a week of implementation effort). The debugger UI now runs entirely in Electron's renderer process where `HTMLCanvasElement` lives, shipped as a new `dist/debugger-renderer.js` bundle (esbuild, browser target). Main process is now thin: it dispatches cog bytes 0-7 to the correct window, forwards Phase 1 and Phase 3 bytes to the bundle via typed IPC, and pushes the bundle's Phase 2 reply onto the TX ring. Everything else — Phase 1/2/3 parsing, CRC-diff detection, state machine (Halted/SingleGo/Repeat with Pascal-exact thresholds), register/smart-pin watch-list delta tracking, disassembly auto-scroll, heat-map bitmaps with gamma-2.0 blending, all 22 panel renderers, keyboard and mouse handlers with the full Pascal L/R-click matrix — lives renderer-side. Prior implementation used main-process `executeJavaScript()` string generation which was limited to placeholder stubs; this architectural move was required to achieve Pascal parity.
  - New directory tree: `src/classes/debugger/{shared,renderer}/`
  - Typed IPC contract in `shared/ipc.ts` (6 message kinds main→renderer, 5 renderer→main)
  - Every constant traceable to Pascal line numbers in `shared/constants.ts`
  - `renderer/DebuggerState.ts`: all per-cog state in one class
  - `renderer/DebuggerController.ts`: Phase 1 parser, Phase 2 builder (bit-packing verified equivalent to Pascal's shift-MSB), repeat-mode 50 ms throttle, 250 ms breakpoint-timeout dim
  - `renderer/DebuggerPhase3.ts`: streaming parser for variable-size Phase 3 packets (changed cog blocks, hub sub-checksums, pointer windows, hub viewer, interleaved smart-pin mask/longs)
  - `renderer/DebuggerRenderer.ts`: 22 panel renderers painting directly to canvas; triple-buffer pattern with OffscreenCanvas base template; 32×512 REG/LUT heatmap bitmaps stretch-drawn into their panels
  - `renderer/DebuggerInteraction.ts`: DOM keyboard/mouse handlers with Pascal-exact button semantics (exclusive set on left-click, mutual-exclusion toggle on right-click, DEBUG's special mask, EVENT/ADDR composite masks), SPACE/ENTER/B/I/D/M/R keybindings, arrows + PageUp/Down with Ctrl/Shift modifiers for hub navigation, disassembly wheel with cog/hub delta matrix from Theory §8.3
  - Cross-window COGBRK broadcast: when any debugger window requests async break, main routes the mask to every open window so whichever cog is next in its debug ISR performs the break
  - DTR/RTS reset invalidates all per-cog state (each bundle receives a `reset` IPC)
  - Legacy main-process stubs (`renderCogRegisters`, `renderStack`, etc.) remain on disk only to keep test mocks compiling; they are never called now that `render()` is a no-op, and will be pruned in a follow-up

### Fixed

- **Single-step debugger window never opened despite correct compilation** - Downloading a debug-enabled `.bin` produced no debugger window on first break, even though the P2 was correctly transmitting 416-byte breakpoint packets and the host byte dispatcher was receiving cog ID bytes 0-7
  - Root cause: a hard-coded feature flag `FEATURE_FLAGS.ENABLE_DEBUGGER_WINDOWS` set to `false` in `src/utils/context.ts:5` with the comment "Disable debugger windows for v0.9.x release"
  - Both gates (`mainWindow.ts:320` auto-create path and `windowRouter.ts:365` route path) silently dropped every 416-byte packet with a "Debugger windows disabled - dropping" log line
  - Flipped the flag to `true`; the debugger window now opens automatically on first breakpoint from any debug-enabled cog
- **Single-step debugger user interaction was non-functional** - Pressing SPACE, ENTER, B, I, D, M, R, or clicking any button in the debugger window had no effect, blocking all interactive testing of the debugger
  - The interaction layer emitted high-level command events (`'command'`, `'hubNavigate'`) but nothing in the window class subscribed to them; the window's correct `sendDebugCommand()` state machine was never reached from keyboard or mouse input
  - Button click handler routed most buttons through `logConsoleMessage()` stubs and the two real handlers (`BREAK`, `GO`) called deprecated protocol methods that sent `STALL_CMD` in both directions
  - Button hit-test coordinates were at grid (88..123, 2..11) but Pascal puts the button panel at (109..120, 37..52) with a 2-column × 6-row mode matrix plus GO spanning both columns
  - No differentiation between left-click (exclusive-set per Pascal mask `$100`) and right-click (toggle with mutual-exclusion mask `$FFFFFFEF`) semantics
  - Mouse wheel on disassembly or hub viewer ignored Ctrl/Shift modifiers (Theory of Operations §8.3 scroll-delta matrix)
  - Right-click on disassembly lines routed to a stubbed `showContextMenu()` instead of toggling an address breakpoint
- **Fixes applied** in `debuggerInteraction.ts`, `debugDebuggerWin.ts`, and `debuggerDataManager.ts`:
  - Wire `interaction.on('command', ...)` and `interaction.on('hubNavigate', ...)` to the window's state machine
  - Rewrite `hitTestButtons()` to use `PASCAL_LAYOUT_CONSTANTS.B` and the 13-button Pascal layout (6 left / 6 right / GO)
  - Rewrite `sendDebugCommand()` to accept `rightClick` and implement every button's exact BreakValue manipulation from Pascal's `FormMouseDown` (lines 716-856): MAIN/INT1-3/INT1-3E all use `$FFFFFFEF xor bit`, DEBUG uses special `$110 xor` for mutual exclusion, INIT uses plain `xor $100`, EVENT/ADDR use the $200/$400 composite masks
  - Add `handleHubNavigate()` on the window + `resetRegWatch()` on the data manager for UP/DOWN/PAGEUP/PAGEDOWN/R key
  - Extend wheel handler with ctrl/shift modifiers through IPC and honor the Theory §8.3 delta matrix (cog: 1/4/16/32, hub: 16/1/4/128)
  - Right-click on disassembly line now toggles an address breakpoint via `toggleBreakpointAt()`

## [0.9.24] - 2026-04-16

### Fixed

- **FFT window shows noisy baseline instead of a clean peak** - The FFT spectrum rendered a carpet of small spikes across the entire display, obscuring what should have been a clean sweeping peak, even though the underlying FFT math was correct
  - Sample parsing used `Number()` directly, which returns `NaN` for Spin2's underscore-separated numeric format (e.g. `1_000`, `-1_000`); every such sample was silently dropped from the FFT buffer
  - For a ±1000 amplitude sine, the peaks of every cycle were dropped, cutting a notch into the waveform and producing broadband harmonics across the spectrum
  - `debugFftWin.ts` now uses the shared `isSpinNumber()` parser from `DebugWindowBase` (the same one the Scope window was already using correctly) for all three sample-parsing sites: raw numeric values, packed-data values, and backtick-enclosed expressions

## [0.9.23] - 2026-03-09

### Fixed

- **Application process not exiting on Fedora Linux** - Closing all windows left the Electron process running invisibly in the background, holding the serial port open and requiring `kill -9` to free it for the next session
  - Removed a duplicate `window-all-closed` handler that raced with serial port cleanup, calling `app.quit()` before the port was properly closed
  - Added a 5-second safety timeout so the process exits even if serial port cleanup hangs
- **CR-only line endings overwrite lines in PST terminal** - Programs written for Parallax Serial Terminal that terminate lines with CR only (no LF) had every line overwritten in place, because CR was treated as carriage return without line feed
  - CR now implies LF in PST mode, matching Parallax Serial Terminal behavior; programs sending CR+LF are not double-spaced

## [0.9.22] - 2026-03-06

### Fixed

- **Window focus error on activate** - Focusing the data entry field via `executeJavaScript` failed with renderer errors when the window received focus while the page was still loading, producing noisy error logs on every activation
  - Added a `webContents.isLoading()` guard to skip the focus attempt when the renderer context is unavailable

## [0.9.21] - 2026-03-06

### Fixed

- **Mid-word line splits in log files** - Raw USB chunks were logged individually, causing lines to break at arbitrary byte boundaries (mid-word, mid-number) wherever the FTDI chip's 16ms latency timer flushed its buffer
  - Both the debug logger and headless file logger now reassemble USB chunks into complete logical lines before writing, holding partial data until a CR/LF boundary is confirmed or a 50ms idle timeout expires
  - Each reassembled line is individually timestamped, eliminating both mid-word splits and mid-line timestamp collisions

## [0.9.20] - 2026-03-06

### Fixed

- **Mid-line timestamps in log files** - Multi-line messages from the P2 were written with a single timestamp on the first line, leaving subsequent lines un-timestamped and producing mid-line timestamp collisions when interleaved with other entries
  - Both the debug logger and headless file logger now split on embedded newlines and timestamp every line individually, making log output consistently parseable

## [0.9.19] - 2026-03-04

### Added

- **DEBUG_END_SESSION support** - The P2 compiler's `DEBUG(DEBUG_END_SESSION)` command now cleanly ends the debug session, disconnecting the serial port automatically
  - The 0x1B sentinel byte is displayed as `[DEBUG_END_SESSION]` in the debug logger and COG windows instead of a binary routing error

### Fixed

- **Window focus error on startup** - Auto-focus of the data entry field fired before the DOM was loaded, producing a script execution error in the console on every launch

## [0.9.18] - 2026-02-28

### Fixed

- **Headless end-marker detection fails on split USB chunks** - The `END_SESSION` / `DEBUG_END_SESSION` marker string frequently arrives split across two serial data events (e.g., `END_` then `SESSION`), causing detection to fail and the session to reach timeout
  - Added a rolling search buffer that accumulates text across chunk boundaries, keeping enough tail from the previous chunk to detect any marker split at any point
- **USB traffic logging not available in headless mode** - The `-u` / `--log-usb-trfc` flag was parsed but never acted on in headless mode; no `usb-traffic_*.log` file was created
  - HeadlessController now creates and manages its own `USBTrafficLogger`, logging raw serial data with hex dumps identical to GUI mode
  - USB log is properly closed (with session footer and statistics) on all exit paths: end-marker, timeout, signal, and download failure

## [0.9.17] - 2026-02-27

### Fixed

- **Data entry field not focused on window activation** - Clicking the title bar to return to the main window did not place the cursor in the yellow `#dataEntry` input field, requiring a second click
  - Added a `focus` event handler on the main window that auto-focuses `#dataEntry` whenever the window is activated
- **Headless mode continued after download failure** - When a binary download failed in headless/CLI mode, the process continued to monitor serial output instead of reporting the failure
  - Download failure now aborts immediately with exit code 3, allowing CI/CD pipelines and scripts to detect the failure

### Changed

- **Devcontainer configuration** - Renamed `docker-compose.local.yml` to `docker-compose.override.yml` (Docker Compose native convention), updated port mappings, added OCR library dependencies for container tooling

## [0.9.16] - 2026-02-12

### Fixed

- **Worker extractor PST misclassification** - Terminal text containing PST control codes (0x00-0x07) was misclassified as debugger packets by the extraction worker
  - `classifyMessage()` in the worker thread now validates bytes 1-3 are 0x00 (32-bit little-endian COG ID) before classifying as debugger, matching the existing `find416ByteBoundary()` validation
  - NUL bytes (0x00) in PST terminal text no longer produce spurious "Cog 0:" hex dump entries in the debug logger
  - PST POS command (0x02) and other control codes no longer produce spurious "Cog 2:" entries
- **False message boundary splits on NUL bytes** - `looksLikeMessageStart()` treated NUL (0x00) as a valid message start, causing PST terminal text to fragment at CR+NUL sequences
  - NUL removed from message-start detection; 416-byte debugger packets are found by `find416ByteBoundary()` with proper 4-byte validation instead
- **Duplicate debugger log entries** - 416-byte debugger packets were registered to two routing destinations, both calling `routeBinaryMessage()` which already routes to all logger windows
  - DEBUGGER0-7 messages now registered to a single destination, eliminating 2x delivery to the debug logger
- **COG window PST misclassification** - Legacy `isASCIIData()` in COG logger rejected PST control codes (0x00-0x10), causing hex dump display for PST-containing data
  - Now uses 3-tier classification matching the main logger, with proper PST parameter byte skipping
- **Stale idle timeout causing message fragmentation** - The extraction worker's idle timeout tracker only updated when the buffer transitioned from empty to non-empty, so unterminated data (e.g., a prompt with no CR/LF) kept the timestamp stale for seconds
  - Now tracks the buffer's write position via `getTailPosition()` to detect new data arriving even when old data remains in the buffer
- **Multi-line text output swallowed by overly strict boundary validation** - `looksLikeMessageStart()` only recognized protocol-specific bytes (backtick, 'C', 0xDB, PST 0x01-0x10) as valid starts after CR/LF, causing all text lines starting with spaces or regular ASCII (e.g., `help` command output) to be merged into a single giant message
  - Added `looksLikeTextLineStart()` relaxed validator that also accepts printable ASCII (0x20-0x7E)
  - Non-backtick messages use the relaxed check; backtick messages retain strict validation to protect SPRITEDEF bitmap data with embedded CR/LF
- **Blue terminal line wrapping 1 character early** - PST grid rows used `white-space: pre-wrap` CSS, causing the browser to wrap the last character when sub-pixel font metric differences accumulated over 80 columns
  - Changed to `white-space: pre` (no wrapping) with `overflow-x: hidden` — each `<p>` row element is one grid line that never wraps
- **Blue terminal grid not using full window width** - Grid was initialized at 80×25 and font metrics were measured via canvas (could differ from actual rendered font). Dynamic resizing existed but used potentially inaccurate measurements
  - Switched from canvas `measureText()` to in-element measurement: inserts a test `<span>` (20 chars) and `<p>` into the actual `#pst-content` element to measure the real rendered character width and line height
  - Grid now fills the full window: cols = floor(containerWidth / charWidth), rows = floor(containerHeight / lineHeight)
  - Always-on diagnostic logging reports font metrics, container dimensions, and calculated grid size: `[PST GRID] Font: W×H px, Container: W×H px → C cols × R rows`

## [0.9.11] - 2025-02-10

### Fixed

- **NUL byte tolerance** - NUL bytes (0x00) in P2 serial data no longer trigger binary misclassification
  - Logger classifier treats NUL as non-binary (flagged as PST-class, silently discarded in display)
  - Blue terminal PST parser silently discards NUL bytes, matching real terminal behavior
  - Real terminals (VT100, PST) ignore NUL — now PNut-Term-TS does the same
- **Carriage return (CR) behavior** - CR (0x0D) now only returns cursor to column 0 without advancing the row
  - Previously CR acted as CR+LF, causing double line advance when paired with LF
- **macOS notarization** - Enabled Apple notarization and stapling in release workflow
  - Removed nested `node_modules/electron` from app bundle (dev dependency, not needed at runtime)
  - Fixed post-signing icon copy that was invalidating code signatures

## [0.9.9] - 2025-02-09

### Added

- **Blue terminal PST character grid** - Replaced append-only DOM rendering with a proper cursor-addressed character grid model (80x25 default)
  - PST control codes (Home, Position, Clear Screen, cursor movement, etc.) now work correctly
  - Text is written at the cursor position, not appended to the bottom
  - Grid auto-scrolls when cursor moves past the last row
  - Backspace is now non-destructive (moves cursor only, matches PST specification)
- **Dynamic terminal grid sizing** - Grid automatically resizes when the window is resized
  - Measures actual font metrics via canvas after window load
  - Recalculates rows and columns based on available space (debounced 200ms)
  - Preserves existing grid content during resize

### Fixed

- **Logger ASCII/binary misclassification** - Messages containing PST control codes with parameter bytes (e.g., Position x,y) were incorrectly classified as binary and displayed as hex dumps
  - New three-tier classifier: pure ASCII, ASCII with PST codes, or true binary
  - PST parameter bytes (0x02: 2 params, 0x0E/0x0F: 1 param each) are properly skipped during classification
  - Added missing Bell (0x07) to PST control code formatter
- Removed dead code: non-existent `terminal-cursor` DOM element references, unused `dataset.cursorX/Y` attributes

## [0.9.8] - 2025-02-03

### Fixed

- GitHub Actions release workflow - resolve tag immutability issue blocking v0.9.6
- macOS build - remove pip upgrade that fails on Homebrew-managed Python

## [0.9.6] - 2025-01-10

### Added

- **Headless mode** (`--headless`) for AI agents and CI/CD automation
  - Run without GUI windows, output to log files only
  - `--timeout <seconds>` - Auto-exit after specified duration
  - `--end-marker [phrase]` - Auto-exit when phrase detected in serial output
    - Default recognizes both `END_SESSION` and `DEBUG_END_SESSION` (PNut compatibility)
    - Custom phrases supported: `--end-marker "MY_PHRASE"`
  - Enables Claude Code, Cursor, and other AI agents to do hardware-in-the-loop testing
  - Three termination modes: signal (Ctrl+C), timeout, or end-marker detection

### Fixed

- macOS code signing in GitHub Actions release workflow
  - Proper inside-out signing order for Electron frameworks
  - Added USB/serial device entitlements for hardware access
  - Fixed DMG volume icon and app icon paths
- Suppress PropPlug "not found" warning when showing help or when auto-detect succeeds

## [0.9.5] - 2025-11-20

### Added

- Baud rate status indicator in main window status bar (both IDE and Standard modes)

### Fixed

- Case-insensitive device serial number matching for `-p/--plug` option
- Device selection now accepts serial numbers in any case (e.g., `p6yh4spg`, `P6yh4spg`, `P6YH4SPG`)

## [0.9.4] - 2025-11-19

### Added

- PropPlug device management system with persistent per-device settings
- PropPlug Management tab in Preferences dialog for viewing/editing known devices
- Per-device DTR/RTS control line settings (automatically determined by device type with manual override)
- Project-level PropPlug selection in Preferences
- Automatic discovery and tracking of new PropPlug devices
- Friendly name support for PropPlug devices

### Changed

- Exit with error if `-p` specifies a device that is not found (previously would silently proceed to UI)
- Control line (DTR/RTS) now determined per-device instead of global setting
- Device selection now matches by serial number in addition to path

### Known Issues

- The **Windows arm64 build** is having issues. It is not opening the serial port. This, so far, appears to be an [npm serialport](https://www.npmjs.com/package/serialport) issue. We filed a bug report to get clarification and/or a fix.

- **SPECIAL REQUEST**: If you have a **native arm64 Windows machine** please test this build and let me know if it works. I'm running Windows 11 Pro under Parallels on a macOS (Apple Silicon) machine and this problem may be limited to my context!

## [0.9.3] - 2025-11-17

### Added

- Add `-m, --match-vendor-only` option to match any FTDI device (VID 0x0403), ignoring product ID

## [0.9.2] - 2025-11-14

### Changes

- Improve main window layout when --IDE mode (used by VSCode)
- Use Local time within debug and USB log files, not UTC
- Disable Chromium sandbox to prevent Linux runtime error requiring root permissions
- Fixed macOS signing so that .dmg's can now be notarised

## [0.9.1] - 2025-11-09

- Packaging cleanup

## [0.9.0] - 2025-11-08

### Added

- Initial release of PNut-Term-TS cross-platform debug terminal
- Support for Parallax Propeller 2 debugging protocol
- P2 download implementation with RAM and FLASH support
- Serial communication with DTR/RTS control line support
- 9 Debug windows implemented:
  - Terminal window with full ANSI escape sequence support
  - Logic analyzer window for digital signal analysis
  - Oscilloscope window for analog signal visualization
  - XY scope display window for phase relationships
  - Plot window for data graphing and visualization
  - FFT spectrum analyzer window for frequency analysis
  - Bitmap display window for image visualization
  - MIDI interface window for musical data
  - Logger window for message capture and analysis
- Cross-platform packaging for Windows (x64, arm64), Linux (x64, arm64), and macOS (x64, arm64)
- Command-line launcher `pnut-term-ts` for all platforms
- Electron v33.3.1 runtime bundled in all packages

## [Unreleased]

### Planned

- Additional debug window improvements
