# Changelog

All notable changes to PNut-Term-TS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.2] - 2026-07-25

Measurement build. Windows downloading and debug output were confirmed working on hardware in
0.11.1; this adds what is needed to judge *sustained* performance from a log file, without
anyone having to watch a screen or hunt through a process list.

### Fixed

- **USB traffic log timestamps were wrong under load.** Each entry was stamped when it was
  written to the file rather than when the bytes actually arrived. Because entries are written
  in the background, a busy stream could push that moment arbitrarily late — so any timing read
  from a busy capture was misleading. Entries now carry the instant the bytes crossed the wire.

### Added

- **`--usb-counts-only`** (use with `-u`) — records the time and size of each block of received
  data without the hex dump. The dump makes a capture roughly six times larger, which is fine
  for inspecting content but impractical for a multi-megabyte performance capture. Transmitted
  data keeps its full detail, because that is what identifies a keystroke.
- **The serial connection now reports its own CPU usage** while `--diag-serial` is on. It
  measures the correct process by construction — on Windows every part of the app appears in
  Task Manager under the same name, so a process list cannot reliably tell you which one is
  handling the serial port.
- **A throughput test program and log verifier** (`DOCs/pascal-REF/Throughput-Test-Programs/`,
  `scripts/verify-stream-log.js`). The program emits numbered lines while driving a debug
  window, so missing or repeated data is a matter of arithmetic rather than judgement; the
  verifier reads a captured log and reports pass/fail. Both work on every platform, and the
  compiled binary is included so no compiler is needed to run it.

## [0.11.1] - 2026-07-24

Fixes the two problems that made 0.11.0 look like a lock-up on Windows.

### Fixed

- **The app could fail to exit, and then block its own next launch.** The new Windows serial
  reader scheduled its next poll with a timer that was never released, so the process had a
  reason to stay alive at every instant and could not shut down on its own. A serial process
  left running keeps the COM port claimed — which is why a following launch could find the
  port unavailable. The reader's timers no longer hold the app open.
- **A port that would not open said nothing.** If the connection could not be opened, the
  reason was recorded internally and never written to the log, so the app simply sat there
  with a dead port and a log that ended mid-startup. Opening is now announced before it is
  attempted, and a failure always names the port, the Windows error number, and a plain-English
  cause ("port already in use — another program, or a previous run that has not exited, holds
  it" / "no such COM port — is the Prop Plug plugged in?").
- **A briefly-busy port no longer fails the run.** When the port is held by a program that is
  still shutting down, the app now waits and retries a few times instead of giving up at once.
  Errors that waiting cannot fix are not retried.

### Changed

- If the Windows connection cannot be opened at all, the app now continues in a reduced mode
  rather than stopping: the terminal and debug windows still work against an already-running
  P2, and the log says clearly that downloading will not work until the port problem is fixed.

## [0.11.0] - 2026-07-24

Windows now talks to the P2 over a single connection, start to finish — the download and
the debug stream share one handle instead of handing off between two.

### Fixed

- **Blank debug windows after a successful Windows download.** Since 0.10.10 the download
  itself worked, but the program's debug output never appeared: the app finished loading
  over one kind of connection, closed it, and opened a *different* kind for the debug
  stream. Opening that second connection briefly pulses the reset line, which restarted the
  P2 into its idle boot loader — so the freshly-loaded program was still there, but silent.
  There is no longer a second connection to open. Windows uses one connection for the whole
  session: reset, identify, load, checksum, and the 2 Mbaud debug stream. macOS and Linux
  already worked this way and are unchanged.

### Changed

- **Windows serial is now one transport, not two.** The connection style that survives the
  P2's reset (the one the original PNut uses) previously handled only the download; it now
  carries everything, including the high-speed debug stream. One consequence worth knowing:
  the Windows and macOS/Linux builds now run the *same* download code — the identify
  sequence, the image transfer, and the checksum check are no longer implemented twice — so
  a fix or a behavior change lands on every platform at once.
- **The diagnostic `--dl-transport` and `--dl-baud` options are gone.** They existed to let
  one build try four combinations on hardware; that experiment is over and the answer is
  built in. Nothing replaces them: there is one Windows transport, chosen automatically.
- If the connection library is missing or damaged in an install (a broken install, not a
  setting), the app now says so plainly at startup and explains that the terminal and debug
  windows still work but downloading will fail — instead of failing later with no reason.

## [0.10.5] - 2026-07-21

Candidate fix for the Windows download failure (attempt 2).

### Fixed

- **Downloading to a P2 on Windows** — candidate fix. The v0.10.4 diagnostic proved the
  port is still open when the download's identify command is sent, yet the write fails and
  nothing on our side closed the port: the P2 reset invalidates the underlying Windows port
  connection out from under us (the original PNut avoids this by talking to the port a
  simpler, synchronous way). The download now recovers by re-opening a fresh connection to
  the port and retrying the reset-and-identify a few times, which is how you recover a
  connection the OS has invalidated. macOS and Linux are unaffected and unchanged.
  *(Needs confirming on Windows hardware.)*

## [0.10.4] - 2026-07-20

Diagnostic build for the Windows download failure (no behavior change).

### Diagnostics

- The v0.10.3 read-quiescing did not fix the Windows download; the failing operation is a
  *write*, which pausing reads cannot affect. Since the original PNut downloads on the same
  machine and adapter, the problem is on our side, not the hardware. This build adds two
  always-recorded log lines to pinpoint it: whether the serial port is closed at the moment
  the download's identify command is written, and a note whenever the port is closed at all.
  These tell us whether something is closing the port mid-write or the write itself is
  failing on an open port — which point to different fixes.

**The Windows download problem is still unfixed.**

## [0.10.3] - 2026-07-20

Candidate fix for the Windows download failure.

### Fixed

- **Downloading to a P2 on Windows** — candidate fix. Two hardware runs pinned the cause:
  toggling the reset line while the app was actively reading from the port caused Windows to
  invalidate the port connection (`GetOverlappedResult: Invalid handle`), so the download's
  "are you there?" handshake never reached the P2. The original PNut terminal avoids this by
  pausing its reader around the reset pulse; PNut-Term-TS now does the same — it stops
  reading, pulses the reset line, lets the P2's loader come up, then resumes. This applies to
  both the connect-time reset and the download's own reset. macOS and Linux were unaffected
  and are unchanged. *(Needs confirming on Windows hardware.)*

## [0.10.2] - 2026-07-20

Second diagnostic build for the Windows download failure. **Still unfixed** — but this
build explains why two previous builds of added logging produced nothing.

### Fixed

- **Reset-line activity and the P2 download handshake are now always recorded.** They were
  previously written through the same channel as the developer, file-by-file diagnostics
  that the application deliberately keeps switched off — so they never appeared in a log.
  That is why a failing Windows download produced a log with no record of the download in
  it, and why logging added in 0.10.0 and 0.10.1 still showed nothing. These events are the
  run narrative, not diagnostics: the logging specification classifies them as always live,
  and they are now treated that way. A download adds roughly half a dozen lines.

  The developer diagnostics are untouched and remain off.

**The Windows download problem itself is still unfixed.** This build should finally show
where the handshake fails.

## [0.10.1] - 2026-07-20

Re-issue of the 0.10.0 diagnostic build. **Application behavior is unchanged from 0.10.0** —
this release exists because 0.10.0's packages were built successfully but could not be
published.

### Fixed

- **Release publishing.** The 0.10.0 build produced and uploaded all six platform packages,
  then failed at the final publish step, leaving the release inaccessible. The cause was
  outside this project: GitHub changed its build runners to a newer Node version, and the
  publishing tool we used was built for the older one. Updated to the version built for the
  new runtime, and pinned to an exact version so a change on GitHub's side cannot silently
  alter our release process again.

**The Windows download problem is still unfixed** — as with 0.10.0, this build carries the
additional logging needed to identify it.

## [0.10.0] - 2026-07-19

Diagnostic build for the Windows download failure, plus documentation corrections.
**The Windows download problem is NOT yet fixed** — this build adds the logging needed to
find it.

> Version note: the jump from 0.9.99 to 0.10.0 keeps the six-digit package version
> (`001000`) that the release artifacts and workflow rely on; 0.9.100 would have produced
> a seven-digit name.

### Fixed

- **Serial activity now appears in the debug log.** Everything the serial layer reports —
  the port opening and closing, DTR/RTS transitions, and the P2 download handshake — runs
  in a separate process and was only ever written to the application console, which a
  packaged build does not show you. None of it reached your log file. A debug log captured
  during a download failure therefore contained no record of the download at all. Those
  events are now written to the debug log where they belong.
- **The P2 download handshake now reports each step** — which control line was used for
  reset, the baud rate the identify request was sent at, and what (if anything) the P2
  replied. If a download fails, the log now shows *where* it failed.
- **Edit → Cut now works on Windows and Linux.** The menu item did nothing; Copy and Paste
  were unaffected.
- **macOS packages now include the copyright file.** A filename-case mismatch meant it was
  silently omitted from every macOS package; the error was suppressed, so nothing reported
  it. Windows and Linux packages were unaffected.

### Documentation

- Corrected the project README: the single-step debugger was still described as "coming
  soon" and "not ready for use" despite being complete and hardware-tested; parity markers
  said v51a instead of v55; the Windows download filenames were wrong; and headless mode,
  IDE mode, batch mode, recording/playback and performance monitoring were missing from the
  feature list entirely.
- Rebuilt the command-line reference from the program's own `--help` output, and added the
  option constraints and exit codes it never documented.
- Rewrote the packaging guide, which described a build step that is no longer used and
  would have produced an unshippable build.
- Corrected the User Guide and Quick Start where they disagreed with the application.

## [0.9.99] - 2026-07-19

Windows download fix, working keyboard shortcuts, and recordings that save where you can
find them. **Built for hardware testing — the Windows download fix needs confirming on a P2.**

### Fixed

- **Downloading to a P2 now works on Windows.** `-r`/`-f` (and the RAM/FLASH buttons) failed
  on Windows with *"No Propeller v2 device found — check connection and try again"*, even
  though the device was detected and listed. Windows opened the serial port with the DTR
  line already asserted, which holds the P2 in reset; because the PropPlug generates its
  reset pulse from a *change* on that line, no reset ever occurred, so the P2 kept running
  its old program and never answered. The port is now opened with the reset line idle on
  every platform. macOS and Linux were unaffected. *(Needs confirming on Windows hardware.)*
- **Changing baud no longer disturbs the P2 on Windows** — the same port-open problem
  applied when reopening the port for a new baud rate.
- **Reset no longer drives the wrong control line.** Asserting DTR silently asserted RTS too
  (and vice versa). Harmless on a standard PropPlug, but on adapters wired for RTS reset it
  could hold the P2 in reset.
- **Keyboard shortcuts now work on Windows and Linux.** `Ctrl+R`, `Ctrl+P`, `Ctrl+F`,
  `Ctrl+,`, `Ctrl+Q` and `F1` were shown in the menus but were never actually connected to
  anything — pressing them did nothing. (They already worked on macOS.) Cut/Copy/Paste
  continue to use your platform's standard keys.
- **Recordings are saved where the app looks for them.** A recording was written to a
  `tests/recordings` folder while Open Recording searched the recordings folder, so a
  session you had just captured reported *"No recordings folder found"* and the Play button
  stayed disabled. Recording, playback and the catalog now all use the same location.
- **Save Recording As… actually saves.** It opened a file dialog and then discarded your
  choice. It now writes the recording to the file you pick, and reports a real error if it
  cannot.
- **Window → Show All Windows / Hide All Windows now work.** Both were menu items that did
  nothing. Hidden windows stay open and keep receiving data.

### Changed

- **Removed three settings that had no effect:** *New Log on P2 Reset*, *Max Log Size*, and
  *USB Log Directory*. A P2 reset always starts a new log file (that boundary is what makes
  a log readable as a single run), logs are not size-capped, and USB traffic logs are
  written to the Log Directory alongside the debug logs. *Enable USB Traffic Logging* is
  unaffected and still works.
- **Removed Window → Cascade and Window → Tile**, which were never implemented.
- **Headless and USB traffic logs now record the app version** in their opening banner, as
  the debug log already did — so any captured log states which build produced it.
- **Built-in help (F1) corrected throughout** and is now self-contained: it no longer refers
  to guides that are not included with the application, and it now documents the exit codes,
  the log file names, and the command-line options that were missing. Several descriptions
  that did not match the application have been fixed.

## [0.9.98] - 2026-07-18

Release-preparation build: batch-mode shutdown, cleaner logs, and no stray files.
**Built for hardware testing — the shutdown paint fix is not yet validated on a P2.**

### Fixed

- **Batch runs no longer close their windows before the last drawing appears.** With
  `--exit-on-end-session`, a scripted run that ended without an explicit SAVE could tear
  the debug windows down while the final drawing was still being painted, so the last
  frame of a plot, bitmap or spectrogram was lost. The app now waits for every outstanding
  drawing to finish — bounded to one second, the same limit SAVE already used — before it
  shuts the windows. *(Built and unit-tested; still needs a headed
  `--exit-on-end-session` run on real hardware to confirm.)*
- **The app exits on its own after an end-of-session marker.** On Linux, a scripted run
  could leave an Electron process behind holding the serial port open, requiring a manual
  kill before the next run. Confirmed fixed on Linux hardware.
- **Debug logs are readable again.** System and diagnostic entries were being appended to
  one enormous physical line — every `[SYSTEM]`, `[DEBUGGER]` and `[CTRL]` event piled up
  until a newline arrived in the serial stream. Each event now gets its own timestamped
  line, so a captured log can be read and searched directly instead of being split first.
- **Launching the app no longer scatters files into your working folder.** A settings
  file, a recordings catalog folder, and a performance log were all created on startup
  whether or not you used those features. Settings are written only when you actually save
  settings, the recordings catalog only when you make a recording, and the performance log
  not at all. Nothing is created merely by launching.

### Changed

- **Released builds no longer emit transport diagnostics.** The low-level serial framing
  chatter used during development is compiled out of every packaged build, so your debug
  log contains only what you care about and the serial path carries no diagnostic cost.
  Development builds keep it on.
- **Every debug-log session now records the app version** in its opening banner, so a
  captured log states which build produced it — useful when reporting an issue.
- The macOS disk-image window now shows the full Iron Sheep Productions logo, consistent
  with PNut-TS.

### Notes

All six release gates for 1.0.0 are now closed. Version 1.0.0 is held pending hardware
confirmation of the batch-mode shutdown fix above.

## [0.9.97] - 2026-07-17

Single-step debugger — hub-viewer blink fix (Test 13). **Built for hardware testing.**

### Fixed

- **The HUB memory grid no longer blinks between two sets of values while halted.** When a
  cog sat stopped at a breakpoint after stepping, the bottom hub-data panel could flip
  rapidly between two different byte-sets even though the memory wasn't changing. Root
  cause: after single-stepping introduced changed processor blocks, the chip occasionally
  delivered a few extra bytes at the end of one break's data; those leftover bytes were
  carried into the *next* break and shifted where the app read the hub window from — so it
  drew the wrong bytes on alternating refreshes. A fresh break boundary now discards any
  such leftover, so the hub grid stays steady (matching the original PNut debugger). The
  live `CT` clock and event flags still update every refresh, as they should. Confirmed
  against the two-minute hardware capture where the hub bytes were byte-identical on every
  poll yet the display flipped.

## [0.9.96] - 2026-07-17

Single-step debugger — event-breakpoint fix (Test 13). **Built for hardware testing.**

### Fixed

- **Clicking an event name (e.g. `CT1`) in the debugger now actually arms the event
  breakpoint.** Previously, left-clicking an event in the far-right event-flags list only
  *selected* which event it was — it never armed the break, so the on-screen `CT1↑` button
  stayed dim and pressing SPACE never ran the cog to that event. The name-click now behaves
  exactly like clicking the `CT1↑` button itself (left-click arms, right-click toggles),
  matching the original PNut debugger where both share one code path. Event breakpoints
  (Test 13) can now be set from either the event list or the button.

### Docs

- Rewrote **Test 13** in the single-step debugger interactive test plan to remove
  misleading terminology: there is no button labelled "EVENT" (it reads `CT1↑` — the event
  name plus an up-arrow), and there is no on-screen "break value" number (arming is shown
  only by the button going bright). Added on-screen landmarks (the event list sits across
  from `IRET3`; the button is near `Go`) and a plan-wide note that **SPACE = "single go"**
  (run once until the next armed break), which only looks like a single instruction step
  when the armed condition is MAIN.

## [0.9.95] - 2026-07-15

Multi-cog single-step debugger fix. **Built for hardware testing — not yet validated
on a P2.**

### Fixed

- **Debugging two cogs at once no longer freezes the debug session.** After 0.9.94 both
  cog windows open, but stepping test12 (with one cog running continuously while the
  other is halted) would wedge the whole channel — one cog's memory data leaked into
  the other cog's window and everything stopped. The cause: while a cog was running
  freely, its next break arrived on the wire immediately after the halted cog's break,
  and the app was reading "until told to stop" rather than reading an exact amount — so
  it kept attributing the running cog's bytes to the halted cog. The app now reads each
  break's reply as an **exact-size message** (the same size the chip itself uses to send
  it), so it stops at the precise boundary regardless of what the other cog is doing.
  This keeps each cog's data in its own window and lets both cogs step independently.
  Confirmed against the captured two-cog session; the single-cog debugger (test11) is
  unaffected.

## [0.9.94] - 2026-07-15

Single-step debugger interaction fix. **Built for hardware testing — not yet validated
on a P2.**

### Fixed

- **The single-step debugger no longer goes dead after the first break.** On real hardware
  the debugger window would open, draw the startup break, and then stop responding — steps
  and button clicks did nothing. The cause was that every break's opening packet was being
  delivered to the window through **two different internal paths at once** (a leftover from
  the recent comms rework). The duplicate made the app send the P2 **two replies for one
  break**; because the P2 reads each reply as a fixed-size block, the extra bytes knocked its
  next read out of alignment and the debug session froze. The window now receives each break
  through a **single path**, so exactly one reply goes out per break and the P2 keeps
  stepping. Confirmed against the captured USB trace (both replies were correct "hold"
  commands — the problem was the extra one, not its contents).

## [0.9.92] - 2026-07-08

Structural fix for the single-step debugger comms desync. **Built for hardware testing —
not yet validated on a P2.**

### Fixed

- **The single-step debugger no longer garbles itself after the first few steps.** On real
  hardware the debugger window would step cleanly for a break or two, then derail —
  showing an impossible program counter, requesting a huge (multi-kilobyte) block of
  memory, and stalling. The root cause was that **two separate parts of the app were each
  trying to decide where one break's data ended and the next break began**, using a timing
  signal that could arrive out of order. When they disagreed, one break's data got read as
  the next break's, and every step after that was scrambled. The data path is now
  redesigned so **one component owns those boundaries** and hands each break to the display
  as a complete, correctly-ordered unit — the display no longer re-guesses the boundaries.
  This affects both single-cog and multi-cog debugging.

### Notes

- This replaces the earlier 0.9.89–0.9.91 attempts, which addressed the same symptom in the
  wrong layer and did not hold on hardware.
- Please re-run the debugger tests on a P2: **test11** (single cog) should single-step
  cleanly with no impossible program counter or stall; **test12 / test12a** (two cogs)
  should open both cog windows and step each independently.

## [0.9.85] - 2026-06-29

Debugger right-click instrumentation build. **Built for hardware testing — not yet validated
on a P2.**

### Changed

- **Debugger right-click is now handled from both the mouse-button press and the OS
  context-menu event**, deduplicated so a single right-click performs its action exactly once.
  On the tester's Mac a physical right button was not toggling breakpoints/buttons via either
  path alone, while the keyboard equivalents worked — so this build also **logs every mouse
  event in the debugger window to the debug log** to capture exactly what the right button
  emits, so the remaining issue can be pinned down. (Diagnostic logging will be removed once
  the right-click path is confirmed.)

## [0.9.84] - 2026-06-29

Two single-step-debugger mouse interactions that didn't work on macOS now work on all
platforms. **Built for hardware testing — not yet validated on a P2.**

### Fixed

- **Shift+mouse-wheel now scrolls the disassembly on macOS.** macOS delivers a Shift+wheel
  as a horizontal scroll, which the debugger was ignoring, so the 16-instruction-per-notch
  scroll did nothing. It now reads the scroll regardless of which axis the OS reports.
  (Ctrl+wheel was unaffected and already worked.)
- **Right-click now works in the debugger on macOS** — toggling an address breakpoint on a
  disassembly line, and the right-click button toggles. A Mac secondary click is usually a
  Ctrl+click or trackpad two-finger tap, which the debugger wasn't recognizing as a
  right-click. Right-click is now detected the same way across Windows, Linux, and macOS.

## [0.9.83] - 2026-06-24

A broad visual- and behavioral-parity pass on the single-step debugger window so every
panel matches the original PNut debugger, plus corrected test programs and a corrected
interactive test plan. **Built for hardware testing — not yet validated on a P2.**

### Fixed

- **The SKIP indicator now matches PNut.** Instructions the SKIP pattern will skip are marked
  with a translucent highlight band over the row (it used to be a harsh line through the text
  that read like a strike-out). The 32-bit pattern is shown byte-grouped, the **SKIP/SKIPF**
  label was inverted (it showed SKIPF when it should have shown SKIP, and vice-versa) and now
  stays bright, and the "Suspended during …" message is centered over the dimmed pattern.
- **The interrupt (INT) panel showed the wrong run state.** INT1/INT2/INT3 were reading their
  idle/wait/busy status two bits too low, so the state shown for each interrupt could be wrong.
  They now read the correct field.
- **EXEC, EVENT flags, and the HUB memory viewer match PNut.** The EXEC tab always shows the
  execution mode (MAIN/INT1/INT2/INT3); event-flag digits render white (no longer dimmed); and
  the hub viewer's hex bytes and ASCII column are aligned the way PNut draws them.
- **Register-watch and smart-pin-watch lists no longer reshuffle as you step.** Each watched
  register/pin now keeps a fixed row (a new entry replaces the most-decayed one), matching
  PNut's stable layout, with the correct header, row positions, and bold addresses.
- **The STATUS indicators (INIT / STALLI / STR / MOD / LUTS) use PNut's staggered layout.**
- **Panel labels are bold-italic like PNut**, and the **Go** button now flashes on press and
  carries the correct caption spacing.
- **The hover hint bar text now matches PNut word-for-word**, including the live XBYTE-mode
  decode, the clock-ticks/seconds readout, and the per-event "break on …" hints.

### Changed

- **Debugger test programs `test03/07/08/09/10/11` are now PASM-only.** They previously launched
  through a Spin2 `coginit`, so single-stepping started inside the Spin2 interpreter ("not my
  code") and the documented step counts and register values didn't line up. They now boot
  straight into their PASM so the debugger breaks on the first real instruction.
- **The single-step interactive test plan was corrected**: single-step idle correctly stays
  bright (it does **not** dim — that only happens when a cog is free-running with no break), the
  skip strike-through is expected behavior, and the scroll/break-button/hub steps were verified
  against the original.

## [0.9.82] - 2026-06-23

Fixes a single-step debugger lock-up: **repeat mode (and stepping) no longer freezes when your program launches a cog.** **Built for hardware testing — not yet validated on a P2.**

### Fixed

- **Single-step / repeat mode no longer dies the moment the program starts.** Because the debugger
  breaks on the very first instruction, stepping always walks through the startup `COGINIT` that launches
  `main()`. When that fires, the P2's debug ROM prints a `Cog0  INIT … jump` line on the same wire that
  carries the binary break protocol. The debugger was treating that text as if it were a break packet,
  which knocked the host and the P2 out of sync — so after a few steps the run silently stopped and the
  window dimmed to "Break". The debugger now separates the ROM's text messages from the break protocol
  (matching how the original PNut debugger demultiplexes the stream), so the text is consumed and the next
  breakpoint is read correctly. Repeat mode runs continuously again, and stepping survives a cog launch.
  The `Cog0  INIT …` line is debug-ROM control output, not user program output, so it is discarded rather
  than shown in the terminal — and a `COGINIT` mid-program does **not** trigger the full-reset that only
  the initial download should.

## [0.9.81] - 2026-06-23

Visual-parity polish for the single-step debugger window so it matches the original PNut debugger pixel-for-pixel. The register/LUT/hub heat maps now sit inside their panels the way PNut draws them, and the CT counter and break-condition buttons have the correct padding around their text. **Built for hardware testing — not yet validated on a P2.**

### Fixed

- **The REG and LUT register heat maps now sit inside their panels correctly.** Each heat map was filling
  its whole panel, so the "REG"/"LUT" title was painted on top of the bitmap and the colored container had
  no visible border. The maps are now inset the way PNut draws them — a dark header band holds the title,
  and the panel border and window background show through around each map.
- **The hub-memory heat map now fills the dark field to the right of the ASCII dump.** It was being drawn
  as a small 64×62 block tucked in the top-right corner; it now stretches to fill the whole remaining area
  of the HUB panel, matching PNut.
- **The CT cycle counter and the break-condition buttons now have proper padding.** Their rounded boxes
  were hugging the text on the left and right edges; the boxes are now drawn slightly wider and taller than
  the text and centered on it — the same surround PNut uses — so the orange CT field and the two columns of
  buttons read correctly. The "REG", "LUT", and "HUB" panel labels are now italic to match.

## [0.9.80] - 2026-06-23

The single-step debugger now talks to the P2 reliably. The break conversation between the host and the P2 is framed correctly from end to end, so the debugger no longer hangs on a blank "awaiting first breakpoint" screen, the message log stays clean while you single-step, and a lost byte on the wire no longer wedges the debugger permanently. **Built for hardware testing — not yet validated on a P2.**

### Fixed

- **The single-step debugger no longer gets stuck on a blank "awaiting first breakpoint" screen.** Each
  break is a three-part exchange — the P2 sends a status snapshot, the host asks for the registers/memory
  it wants, and the P2 streams them back. Three different parts of the host were each trying to track
  where one exchange ended and the next began, and they could disagree: data the P2 sent back could be
  dropped in the gap, so the break never finished and the panels stayed empty. The debugger window is now
  the single owner of the whole conversation and accounts for every byte, so each break completes and the
  panels fill in.
- **The break packet size was wrong, which corrupted every break after the first.** The P2's status
  snapshot is 456 bytes (20 status longs, 64 register-block checksums, and 124 hub-memory checksum words),
  but the host was reading it as 416 bytes (only 104 hub words). The two correct sizes were confirmed
  against the Parallax debugger sources. With the right size, the host stays aligned with the P2 across
  back-to-back breaks. This also corrects the **hub-memory heat-map**, whose grid is sized for 124 blocks
  and was reading past the end of the (too-small) checksum array.
- **The message-log window no longer fills with bogus `Cog N:` / hex-dump lines while you single-step.**
  During a break the wire is dedicated to the debugger, but the binary break packets were also being
  copied to the message log, which rendered them as meaningless hex dumps with a mis-derived cog number.
  Those packets now go only to their debugger window.
- **A dropped byte mid-transfer no longer wedges the debugger.** If the P2 stops sending partway through a
  break's data (a lost byte or an unplugged cable), the debugger now times out after a quarter second,
  discards the incomplete break, and resynchronizes on the next clean break instead of waiting forever.

## [0.9.79] - 2026-06-22

Single-step debugger fixes: keyboard control now works the moment the window opens, and the dimmed screen shows the original's explanatory hint.

### Fixed

- **The debugger window ignored all keyboard input (Enter, Space, and every other key).** A diagnostic
  developer-tools window was opening automatically next to each debugger and taking keyboard focus, so
  key presses never reached the debugger until you clicked back into its window. That auto-open is now
  off, so the debugger has keyboard focus as soon as it appears: Space and Enter drive the Go button,
  and B, I, D, M, R plus the arrow and page keys behave as in the original v55 debugger. (Developer
  tools can still be opened manually with F12 or the View menu, or by launching with
  `PNUT_DEBUGGER_DEVTOOLS=1`.)

### Added

- **The dimmed debugger now shows the "force an asynchronous break" hint** from the original. When a cog
  is free-running and the debugger screen dims after a quarter-second, it now explains that to force a
  break in that cog, another cog must be idling in its own debugger.

## [0.9.78] - 2026-06-21

Single-step debugger follow-up: fixes a row-alignment regression in v0.9.77 where four data panels were drawn one text row too low.

### Fixed

- **Hub memory rows were shifted down one row and overlapped the hint bar.** When the v0.9.77 work
  moved the "HUB" label to below the memory box, the hub data rows kept an old title-row offset, so
  the bottom row landed on top of the fly-over hint text. The rows now start at the top of the box,
  matching the original.
- **The SFR, event, and disassembly panels had the same one-row downward shift** (and slightly
  overflowed the bottom of their boxes). All three now start at the top of their boxes like the
  original, and clicks in those panels map to the correct row.

## [0.9.77] - 2026-06-20

Single-step debugger visual-parity release: the debugger window now matches the original v55 PNut debugger across boxes, fonts, labels, colors, buttons, heat maps, dimming, and hover hints.

### Changed

- **Panel boxes are now filled, rounded, and rim-highlighted** to match the original. Each panel
  (and every button) draws a filled rounded rectangle in its box color plus a brightened rounded rim,
  instead of the previous flat single-pixel outline. This is what gives the CT box its orange fill and
  every panel its rounded-corner look.
- **Debugger text now uses the bundled Parallax font sized to the 8×16 cell grid**, so labels and
  values fill their cells exactly instead of overflowing slightly.
- **Register/LUT/hub heat maps now use the original's exact (linear) blend** and add a brightness
  band over the rows currently shown in the disassembly window, linking the heat map to the
  disassembly view. Set vs. clear register bits render in their correct distinct tones.
- **The idle dim is now a true graded dim** — when 250 ms pass without a break, every pixel is halved
  in brightness (matching the original) rather than covered by a flat grey veil, and the GO button
  stays bright orange showing "Break".

### Fixed

- **Panel labels, titles, and indicators corrected to the original**: REG/LUT column titles, the
  REG ▲ / LUT ▲ watch indicator (replacing a spurious "DIS"/"WATCH"), execution-mode and CALL(n)
  display, interrupt off/active wording, RFxx/WFxx pointer labels, the RQPIN smart-pin title, and the
  HUB label below its box.
- **Pointer and hub data colors corrected**: pointer addresses are white with green data bytes; the
  center pointer byte gets a green highlight with inverted dark text; hub addresses are white with
  green hex/ASCII.
- **The XBYTE checkmark now always shows dim and brightens to orange** when C/Z are affected by XBYTE
  (previously no checkmark appeared).
- **Button panel matches the original**: correct active/dim colors per button, the orange GO button,
  the INT-entry right-arrows and the EVENT up-arrow, and the Go/Stop/Break caption logic.
- **Fly-over hover hints are now orange italic** (previously white), and appear live on hover without
  waiting for the next break.

## [0.9.73] - 2026-06-17

Bug-fix release: two graphical debug windows of the same type created at the same instant no longer collide.

### Fixed

- **Two windows of the same type (e.g. two SCOPE windows) created in the same instant could fail to
  register.** Each graphical debug window (SCOPE, FFT, MIDI, SCOPE_XY, SPECTRO, PLOT, BITMAP) derived
  its internal ID from a millisecond timestamp. When a program created two windows of the same type
  back-to-back, they could land in the same millisecond and receive an identical ID, so the second
  one's handler registration failed with "Window … is already registered". These windows now use the
  user-assigned display name as their ID — already guaranteed unique and the value used for message
  routing — matching what the TERM and LOGIC windows already do. (Message routing itself was never
  affected, since it keys on the display name.)

## [0.9.59] - 2026-06-14

Bug-fix release: the MIDI saved image now actually shows the held chord (the real fix — see below).

### Fixed

- **MIDI: the saved image showed an un-pressed keyboard even with a chord held (real root cause).**
  The window receives its messages from a dispatcher that does not wait for one message to finish
  before delivering the next. A MIDI program holds a chord, issues SAVE (and SAVE WINDOW), then
  immediately releases the notes. Capturing the image is asynchronous, so the note-off release was
  redrawing the keyboard — clearing the lit keys — *before* the capture had sampled the canvas, and
  the saved file showed an un-pressed keyboard. Message processing is now serialized per window: each
  message (including the full SAVE capture) completes before the next is processed, so the release can
  no longer clobber an in-flight SAVE. This honors the "no message reordering" guarantee on
  completion, not just on arrival order. (The 0.9.56/0.9.58 readiness fixes addressed a separate
  startup race and were necessary but not sufficient; this is the fix that resolves the symptom.)

## [0.9.58] - 2026-06-14

Bug-fix release: the MIDI window's saved image now shows the keys held at the moment of capture.

### Fixed

- **MIDI: a saved image showed an un-pressed keyboard even with a chord held.** The window was
  marked "ready" (which replays buffered messages, including SAVE) before its drawing canvas
  finished its asynchronous setup. The held-note draws were therefore deferred until after the setup
  completed — losing the race to the SAVE capture, which grabbed a keyboard with no lit keys. The
  window now registers to receive messages without being marked ready, and only becomes ready once
  its canvas is initialized, so the held chord is drawn before SAVE captures it. (The same latent
  timing issue was corrected in the PLOT window.)

## [0.9.57] - 2026-06-14

Parity release: closes the last two known deviations from the original PNut behavior — how the
BITMAP window draws SPARSE pixels, and how the LOGIC window draws a RANGE (multi-bit bus) channel.

### Fixed

- **BITMAP SPARSE now draws every pixel, with the correct frame and dot.** Three deviations from
  the original were corrected: (1) sparse pixels whose value happened to match the background were
  being dropped — the original draws *every* sparse pixel, so a matching pixel still shows its
  SPARSE-colored frame against the field; (2) the SPARSE color was being used as the bitmap
  background, washing out the field — the background is now the mode's normal clear color (black, or
  white for the "…W" modes) and the SPARSE color is used only for the dot's frame; (3) each sparse
  dot is now an outer square in the SPARSE frame color with an inner *rounded* dot in the pixel's
  color, matching the original's two-layer shape (the inner dot was previously square).
- **LOGIC RANGE channels now draw as a single analog waveform, not stacked on/off traces.** A
  channel declared with a bit range (a multi-bit bus) is now rendered the way the original does it:
  one continuous value-waveform occupying a band as tall as the bus, bounded by two dimmed
  guide-lines at the band's top and bottom. Previously each bit of the bus was drawn as its own
  separate high/low trace.

## [0.9.56] - 2026-06-14

Capture-pipeline correctness pass: a window-by-window audit of how each debug window draws and how
SAVE captures it. Fixes the windows whose saved image could miss content because the drawing
finished after the capture, and makes SAVE WINDOW capture the correct window even when another
window sits on top of it.

### Fixed

- **MIDI: the held chord was missing from the saved image.** The window marked itself "ready"
  (which replays the buffered commands, including SAVE) before its canvas finished initializing, so
  the chord's key-lighting was deferred and lost the race to the capture. Readiness now waits for
  the canvas, so the lit chord is drawn before SAVE captures it.
- **PLOT: a saved plot could be incomplete (only the first drawing operation).** PLOT draws its
  operations asynchronously, one after another, and SAVE did not wait for them — so the capture
  could land mid-draw. PLOT now finishes all pending drawing before the capture. (Its readiness
  ordering was corrected the same way as MIDI.)
- **FFT: a saved spectrum could be stale or blank.** FFT draws to an off-screen buffer and copies
  it to the visible canvas partway through an asynchronous draw; SAVE did not wait for that copy.
  FFT now finishes the draw before the capture.
- **SAVE WINDOW captured the wrong window when windows overlapped.** SAVE WINDOW grabs the
  on-screen region, so if another window covered the target, it captured that other window. SAVE
  WINDOW now raises the target window to the front (and lets the screen settle) before grabbing, so
  it always captures the intended window and its title-bar/chrome.
- **LOGIC: removed a leftover diagnostic timer that could crash on window close.** A debug-only
  100 ms timer re-read the window bounds after the window was already closed, causing a null
  reference. The diagnostic was removed.

## [0.9.55] - 2026-06-14

Bug-fix release: SPECTRO once again produces its saved bitmap *and* draws its waterfall; LOGIC's
SAVE WINDOW now captures the full trace; and the SCOPE value legend is grey (not blue) with its
dotted graticule line no longer running through the label.

### Fixed

- **SPECTRO (and any occluded window) saved no bitmap.** The 0.9.54 capture flush waited for the
  renderer to paint a frame before capturing, but it waited *without a time limit*. A debug window
  that is behind other windows during a scripted multi-window SAVE has its animation frames paused
  by the OS (background throttling), so the wait never finished — the SAVE hung and the window was
  then closed before any file could be written. (Before 0.9.54 SPECTRO produced a partial image;
  0.9.54 turned "partial" into "nothing.") Two fixes: the pre-capture wait now has a 1-second cap
  so a SAVE can never hang, and every debug window now keeps rendering while it is occluded so the
  wait finishes immediately and the capture is a fresh, complete frame.
- **SPECTRO drew no content (blank window).** Each FFT column was painted one pixel at a time over
  256 separate round-trips to the renderer, guarded by a "skip if a draw is already running" flag.
  When the spectrogram data arrives as one high-speed burst, that guard tripped on nearly every
  column, so only about one column out of ~240 was ever drawn — effectively blank. Each column is
  now computed and drawn in a single batched renderer update, so the full waterfall renders.
- **LOGIC SAVE WINDOW was missing most of the trace.** Plain SAVE (which captures the window's
  drawing) was complete, but SAVE WINDOW (which captures the on-screen region including the title
  bar) grabbed the screen before the renderer had finished drawing the traces. SAVE WINDOW now
  waits for the same draw-flush that plain SAVE uses, so both capture the complete window.
- **SCOPE value legend was blue and overran its label.** The min/max value labels and their dotted
  graticule lines were drawn in the channel/trace color (blue) instead of the window grid color, and
  the live redraw ran the dotted line edge-to-edge through the value text. The legend is now grey
  (the window grid color, e.g. `COLOR WHITE GRAY`) and the dotted line starts just past the value
  text — matching PNut.

## [0.9.54] - 2026-06-14

Continuation of the debug-window parity pass, driven by re-capturing each window against the
Pascal (PNut) reference. Closes the remaining visual gaps found in the 0.9.53 captures — clipped
text, windows that captured before their content finished drawing, and several per-window
graticule/label/background mismatches — and finishes the SCOPE_XY dots so they are both smooth and
crisp on HiDPI displays.

### Fixed

- **SCOPE_XY dots were soft/fuzzy on HiDPI (Retina) displays.** The canvas drew at logical
  resolution and was then up-scaled by the OS compositor, blurring the small anti-aliased dots.
  The canvas is now rendered at device resolution (DPR-aware): the backing store is sized to the
  display's pixel ratio while the layout size is unchanged, so the trace is now both smooth
  (sub-pixel placement) and crisp — matching PNut. No effect on standard-DPI displays.
- **SCOPE_XY curve looked stair-stepped.** The 0.9.53 change that crisped the dots also snapped
  each point to the nearest whole pixel, making the connected curve jagged. Sub-pixel dot
  positions are restored (Pascal plots at fractional coordinates), so the curve is smooth again.
- **SCOPE_XY had a black band above/below the plot.** The window body was painted black, showing
  as a letterbox around the square plot; it now matches the plot background.
- **Text with descenders was clipped at the bottom in the TERM window** (letters like y, g, p, q —
  e.g. `Ready.` could read as `Readv.`). Each character cell is now drawn at the full row height
  instead of the glyph height, so descenders are no longer cut off.
- **LOGIC traces and the SPECTRO chirp were missing from saved/scripted captures.** Heavy windows
  issue many asynchronous draw operations per frame, and a capture could land before those draws
  had painted, producing a partial or empty image. The capture path now flushes all pending draws
  (waits for the next rendered frame) before grabbing the image, so every window is fully drawn
  when saved.
- **SCOPE "Wave" channel-name label was missing.** The label was drawn before the queued
  channel definition had been applied; the label pass now waits for the window to finish
  initializing, so the channel name appears.
- **SCOPE graticule lines and value labels were drawn in the saturated trace color** and read as
  overlapping the trace. They now use the pale blend of trace and background color that Pascal
  uses, so the gridlines and labels are clearly distinct from the trace.
- **SPECTRO white-field (…W) spectrograms had a black frame** on the top and left edges from a
  hardcoded black clear/padding. The frame and the newly-scrolled region now clear to the mode's
  background color (white for the …W color modes), matching PNut.

## [0.9.53] - 2026-06-14

Follow-up to 0.9.52, driven by re-capturing the debug windows against the Pascal (PNut)
reference. Corrects an incomplete window-readiness change from 0.9.52, closes a class of
spurious parser warnings, hardens the scripted-shutdown path, and makes the SCOPE_XY dots match
Pascal.

### Fixed

- **Some windows produced no saved image on scripted/headless capture runs.** 0.9.52 moved
  window readiness off the constructor but left TERM/MIDI/LOGIC/SPECTRO depending solely on the
  `ready-to-show` event, which is unreliable for always-shown windows — so the deferred content
  and the SAVE were never processed (e.g. SPECTRO timed out with no `.bmp`). All windows now
  follow ONE proven construction sequence (the SCOPE_XY pattern): the canvas is initialized and
  the window marked ready in `did-finish-load`, which always fires on page load. TERM, MIDI,
  LOGIC, SPECTRO and PLOT were aligned to this sequence (MIDI's canvas init was moved into
  `did-finish-load`).
- **Spurious `Unknown numeric format` warnings on valid programs.** When a directive that takes
  an *optional* trailing value was followed by the next directive (e.g. `SAMPLES 512 DEPTH …`),
  the parser probed that directive keyword as if it were a number and logged a warning. The
  optional-value probes in SPECTRO and FFT (`SAMPLES [first] [last]`) now only read the next
  element when it is actually numeric, matching the Pascal behavior.
- **SCOPE_XY dots rendered as soft, oversized blobs.** Points were drawn as anti-aliased circles
  at sub-pixel coordinates. They are now drawn as crisp, integer-positioned squares of the same
  radius Pascal uses (`DOTSIZE/4`), so the trace is sharp and matches the reference dot.
- **`Failed to download … serial utility process exited` on scripted batch runs.** When a
  download was interrupted by an intentional shutdown, the serial host process is killed (a
  non-zero exit) and any in-flight operation was reported as a hard download failure. The
  intentional shutdown is now recognized as benign teardown rather than an error.

## [0.9.52] - 2026-06-13

Debug-window display parity pass, driven by side-by-side captures of every window against the
Pascal (PNut) reference. The goal for each was strict behavioral parity: on identical source our
output should match PNut's, even where the source itself is imperfect. Several distinct defects
were found — a shared window-readiness race that silently dropped early content, HiDPI rendering
blur, and a handful of per-window parity gaps measured against the v55 Pascal spec — plus a
scripted-batch download crash.

### Fixed

- **Blank / partial windows on fast capture (window-readiness race).** TERM, MIDI, LOGIC and
  SPECTRO marked the window "ready to receive content" in their constructor, *before*
  `did-finish-load` had created the drawing canvas. Any content that arrived in that gap was drawn
  against a non-existent context and silently dropped — producing blank TERM windows, LOGIC windows
  with stale "Label" placeholders and missing traces, and all-black SPECTRO waterfalls on rapid
  create→content→save scripts. Readiness now comes from `ready-to-show` (after canvas init), matching
  the windows that already behaved correctly (PLOT / BITMAP / SCOPE_XY).
- **Blurry / "dispersed" rendering on HiDPI (Retina) displays.** Every display canvas now requests
  nearest-neighbor scaling (`image-rendering: crisp-edges`) for the device-pixel upscale instead of
  the default bilinear blur. SCOPE_XY dots are crisp again and thin grid/axis lines render at their
  true color (the apparent "lighter gray grid" was the blur diluting a correct color, not a wrong
  value). Matches the BITMAP / SPECTRO canvases, which already did this.
- **SCOPE_XY save was non-square with a black letterbox.** The window was sized with a hardcoded
  title-bar estimate and no `useContentSize`, so on macOS the web content ended slightly taller than
  the square canvas and the display-area SAVE captured black bands top and bottom. The window is now
  sized by client area so the content is exactly the square canvas.
- **SCOPE drew an invented trace where PNut draws nothing.** A SCOPE with no explicit channel
  definition used to fabricate a default `0..255` green channel, which railed any real-amplitude
  signal. Pascal (`SCOPE_Update`, v55) creates a channel only from an explicit channel-def; bare
  sample data with no channel defined commits nothing and the window stays empty. The fabricated
  default channel was removed.
- **SPECTRO LUMA8W rendered on black instead of white.** The waterfall cleared and scroll-filled to
  black regardless of color mode. Per Pascal `GetBackground`, the white-variant color modes
  (LUMA8W / HSV8W / RGBI8W / HSV16W) clear to white; every other mode clears to black. The background
  is now mode-aware (mirroring the BITMAP window, which already did this), so a LUMA8W spectrogram
  shows the correct white field.
- **Download crash on scripted batch runs.** Repeated `download → run → shut-down → next` batches
  could log `Failed to download to RAM: Cannot read properties of undefined (reading
  'getCurrentBaudRate')`. The download itself had already succeeded; a concurrent shutdown released
  the serial port while the post-download baud-rate-restore tail was still running, so a subsequent
  port access dereferenced a released port. The download routine now holds a local port reference and
  skips the (pointless) baud restore once a shutdown is underway.

## [0.9.51] - 2026-06-13

The real fix for the `Spin2NumericParser: Unknown numeric format - value: "'"` errors, plus
removal of the 0.9.49/0.9.50 diagnostics. Root cause (confirmed from a hardware `[TERM-FEED
TRACE]` capture): the TERM status program's Uptime line sends its seconds value as a bare feed
element via `` `udec_(secs) ``. When that value is small it collides with a TERM control code —
`2` = set-column, `3` = set-row — so TERM reads it as a positioning directive and then consumed
the *following* quoted string (`' s   '`) as the directive's numeric value, leaking a `'` into
`parsePixel → parseValue`. This is a general class — a value-reading directive consuming the next
token as a number without confirming it is a numeric element (`ele_num`) rather than a string
element (`ele_str`). Pascal never does this: `KeyValWithin` reads the next element only when it is
numeric; a string element is left in place and printed.

Fixed at two levels so the whole class is closed, not just the one symptom.

### Fixed

- **Parser choke point (class fix):** `Spin2NumericParser.parseValue` now returns `null`
  **silently** for a non-numeric protocol element — a quoted-string token (`'…'` / `"…"`) or a
  standalone comma — instead of logging `Unknown numeric format`. These are `ele_str` / separators,
  not malformed numbers; every window that reads a value through the shared parser is now immune to
  this error class, while genuinely malformed numeric tokens (e.g. `5x`) still log as before. New
  `isNonNumericElement` helper.
- **TERM set-col/row (behavioral parity):** action `2`/`3` consumes the next token **only when it
  is numeric** (Pascal `KeyValWithin`). A string element is no longer consumed — it is left to print
  on the next element, matching Pascal, so a `udec_` value that collides with a control code no
  longer eats the trailing string.

### Removed

- Temporary `[PARSER-LEAK TRACE]` (0.9.49) and `[TERM-FEED TRACE]` (0.9.50) diagnostics.

### Tests

- Regression tests proven to **fail on the pre-fix code** for the right reason: the parser suite
  reproduces the exact `value: "'"` / `","` / `'Mode :'` console errors; the TERM suite feeds the
  byte-exact runtime `lineParts` for the `secs=2`/`secs=3` collision and asserts the string is
  printed (cursor advances) rather than consumed.

## [0.9.50] - 2026-06-12

Second diagnostic build. The 0.9.49 stack trace confirmed the apostrophe leak path:
`processMessageAsync → updateTermDisplay → processDisplayCommand → parsePixel`, i.e. a
single-quote token is arriving as the value of a TERM set-column (action 2) or set-row
(action 3) directive — a feed shape the source program's feeds should never produce. This
build adds a `[TERM-FEED TRACE]` log at that exact spot that dumps the raw feed and the
tokenized `lineParts` whenever a set-col/row value is a quote, so the actual runtime feed
that produces the leak is captured verbatim. Temporary instrumentation; removed once the
root cause is identified and fixed.

### Added

- **Temporary diagnostic:** TERM logs `[TERM-FEED TRACE]` with the unparsed feed and
  tokenized `lineParts` when a set-col/row (action 2/3) value token is a quote.

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
