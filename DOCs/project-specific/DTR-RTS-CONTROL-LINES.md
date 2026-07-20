# DTR/RTS Control Line Documentation

## Critical Understanding

DTR and RTS are **functionally equivalent** reset/sync control lines in the P2 ecosystem. They are **mutually exclusive** - each device uses one OR the other, never both simultaneously.

## Device Types and Their Control Lines

| Device Type | Control Line | Notes |
|------------|--------------|-------|
| Parallax Prop Plug (vendor) | **DTR** | Official standard, always DTR |
| FTDI USB-to-serial (non-vendor) | **DTR** | Usually DTR, but configurable |
| Chinese FTDI clones | **RTS** | Often require RTS instead of DTR |

## Why Both Exist

- **DTR** is the Parallax standard for official Prop Plugs
- **RTS** support exists because many clone devices wire RTS for reset instead
- Users may have either type of device, so we must support both

## Current Implementation

### Parser Synchronization
Both DTR and RTS resets should:
1. Clear the debug log
2. Synchronize the debugger message parser
3. Log which control line was used
4. Create visual separation in debug output

### UI Simplification Strategy

**Problem**: Showing both DTR and RTS controls is confusing when only one works

**Solution**: Adaptive UI that shows only the active control

```
Default State:
  [x] DTR  (Parallax standard)

After RTS configuration:
  [x] RTS  (Device requires RTS)
```

## Two kinds of reset — observe vs download (how to think about this)

There are **two distinct reasons** the app toggles the reset line, serving two different
goals. Keeping them separate is essential to reasoning about the feature.

### 1. Reset on Connect — an OBSERVE-mode feature

Governed by the **Reset P2 on App Startup** preference (`runEnvironment.resetOnConnection`,
default on). It fires in `usb.serial.ts` `handleSerialOpen()` when the port opens.

**Its purpose is a known origin (t=0), not the reboot itself.** When you attach to a P2
that is already running a flash image, resetting it restarts the program from the
beginning so the captured `debug()` stream has a *reference frame*: you can map output to
program flow because you know it started from reset. Attach *without* resetting and you
join mid-stream — fragments with no anchor, unable to tell init from steady-state from the
tail of something.

This is the same principle as the log's **golden sync points**: a P2 reset / system-init
rotates the debug log, because the session boundary *is* the t=0 anchor. Reset-on-Connect
and new-log-on-reset are two expressions of one idea — pin a known start so the capture is
interpretable.

### 2. Download reset — the download OWNS its own stabilization

When the user asks to download (`-r`/`-f`), the current program's output is irrelevant —
it is about to be replaced. The download does **not** rely on Reset on Connect. Its
handshake (`requestPropellerVersionForDownload`) resets the P2 into its serial loader
*unconditionally*, regardless of the preference — "stabilize the processor, then download."

The fresh load establishes an even **cleaner** t=0 than rebooting stale code would: output
is captured from the start of the *newly downloaded* program. The download-start log
rotation (`=== Session ended - Download Started ===`) marks that anchor. So the
observability goal — an interpretable capture from a known origin — is preserved; the
download just reaches it a better way.

### Why download mode must SKIP Reset on Connect (necessary, but not the whole fix)

Because the download owns its reset, the connect-time reset before a download is **pure
redundancy** — it resets a P2 we are about to reset and overwrite anyway. Skip it on every
platform: it is an observe-mode feature with no role in a download.

### The Windows root cause: a DTR reset invalidates the COM handle

**Confirmed on hardware, v0.10.2, 2026-07-20.** On Windows, toggling DTR to reset the P2
causes the USB serial device to **re-enumerate**, and Windows invalidates the open COM
handle ~200 ms later. The next write fails with the textbook node-serialport symptom:

```
[P2-HANDSHAKE] result: device='' error='Writing to COM port (GetOverlappedResult): Invalid handle'
```

This affects **every** reset on Windows, not just the connect-time one. Two hardware runs
proved it:
- Reset-on-Connect **on**: the connect reset dropped the handle before the download's
  handshake even ran (`setDtr` → "Port is not open"). Prop_Chk never sent.
- Reset-on-Connect **off**: the download's *own* mandatory reset ran, sent Prop_Chk, then
  the handle died ~235 ms later (`GetOverlappedResult: Invalid handle`). Same wall, clearer
  error.

So skipping the connect reset is **necessary but insufficient** — it removes the first,
redundant failure, but the download cannot skip its *own* reset, and that one hits the same
Windows re-enumeration.

> An earlier draft of this section claimed the download's reset→Prop_Chk was "tight enough
> to beat the re-enumeration." **The reset-off hardware run disproved that** — the download's
> own reset drops the handle just the same. Corrected here so the wrong timing model isn't
> re-derived.

### The fix: QUIESCE READS around the reset pulse (the PNut method — NOT a reopen)

The reference implementation is authoritative here. PNut's `SerialUnit.pas ResetHardware`:

```pascal
SerialThreadStop;                       // stop the read thread FIRST
SETDTR / Sleep(1) / CLRDTR              // pulse DTR via EscapeCommFunction
Sleep(15);                              // let the ROM loader come up
SerialThreadStart;                      // resume reading
```

Two things this settled:

1. **The DTR toggle mechanism is not the problem.** node-serialport's `.set({dtr})`
   (`serialport_win.cpp` `SetBaton::Execute`) uses **`EscapeCommFunction(SETDTR/CLRDTR)`** —
   identical to PNut, and it does NOT call `SetCommState`. So we pulse DTR the same way. No
   reopen is needed, and PNut proves it: same handle throughout, never reopened.

2. **The difference is that PNut stops reading around the pulse; we don't.** Our worker keeps
   a continuous overlapped read live on the port. When the P2 reset blips the USB device,
   that in-flight overlapped I/O is what invalidates the handle — exactly the shape of
   `GetOverlappedResult: Invalid handle` (an *overlapped* result failing). PNut has no I/O in
   flight during the pulse, so its handle survives.

So the fix is **not** reopen-after-reset — an earlier draft of this doc said reopen, which was
wrong. The fix is to quiesce reads around every reset pulse: `pauseReads()` → toggle → ~15 ms
for the loader → `resumeReads()`. Implemented in `usb.serial.ts`:
- `toggleDTR()` / `toggleRTS()` — covers the observe-mode connect reset (`handleSerialOpen`).
- `requestPropellerVersionForDownload()` wraps its own DTR/RTS sequence the same way.

macOS/Linux keep the fd valid across the reset and never had the problem; the quiesce is
harmless there.

> Status (2026-07-20): root cause CONFIRMED on hardware; fix follows the PNut reference.
> - Reads are quiesced around EVERY reset (connect + download), so both observe mode and
>   download survive the P2-reset USB blip on Windows. — implemented
> - Download mode still SKIPPING the redundant connect reset is worthwhile cleanup (don't
>   reset twice) but is no longer a correctness requirement now that resets are quiesced —
>   deferred as an optimization.
>
> **Needs on-bench verification:** node-serialport has no literal `SerialThreadStop`;
> `pauseReads()` uses the stream's `pause()` to stop the poller plus a short settle for any
> already-issued overlapped read. Whether `pause()` reliably halts the native read on Windows
> is the one thing that can't be verified off-hardware — the next Windows download run
> confirms it (look for the handshake completing without "Invalid handle").

## Configuration Hierarchy

1. **Global Default**: `settings.defaultControlLine: 'DTR' | 'RTS'`
   - "All my devices use DTR" (default)
   - "All my devices use RTS"

2. **Per-Device Override**: `deviceSettings[deviceId].controlLine: 'DTR' | 'RTS'`
   - Remembered per USB device ID
   - Overrides global setting

3. **Runtime Detection**: When possible, auto-detect based on device response

## Code Locations

- **DTR Handler**: `mainWindow.ts` - `toggleDTR()`
- **RTS Handler**: `mainWindow.ts` - `toggleRTS()` 
- **Parser Sync**: `debuggerMessageParser.ts` - `onDTRReset()` and `onRTSReset()`
- **UI Controls**: HTML generation in `mainWindow.ts`
- **Settings**: Settings dialog in `mainWindow.ts`

## Log Message Examples

```
[DTR RESET] Device reset via DTR at 14:30:00.123
--- Debug log cleared, parser synchronized ---

[RTS RESET] Device reset via RTS at 14:30:00.123  
--- Debug log cleared, parser synchronized ---
```

## Implementation TODOs

- [ ] Add `onRTSReset()` method to DebuggerMessageParser
- [ ] Update UI to show only active control line
- [ ] Add control line preference to settings
- [ ] Store per-device control line preferences
- [ ] Update log messages to indicate DTR vs RTS
- [ ] Test with both DTR and RTS devices

## Testing Scenarios

1. **Parallax Prop Plug**: Should use DTR, work immediately
2. **FTDI Device**: Try DTR first, allow RTS switch if needed
3. **Clone Device**: May need RTS, settings should persist
4. **Device Switching**: UI should adapt when switching between DTR/RTS devices