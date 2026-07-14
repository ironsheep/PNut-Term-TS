# Skill update request → `p2-dev-cycle`

**To:** the agent that maintains our central skills
**From:** PNut-Term-TS engineering
**Date:** 2026-07-14
**Target skill:** `~/.claude/skills/p2-dev-cycle/SKILL.md`
**Urgency:** apply now. These are PNut-Term-TS behaviors **from this build forward**, and two
sections of the skill are now actively *wrong* (not merely stale) — following them will cause
the failures they were written to prevent.

---

## TL;DR — three changes

| # | Section | Action |
|---|---|---|
| 1 | **DEBUG baud verification** | **Delete the manual cross-check.** The tool now reads the debug baud out of the binary. Stop passing `-b` / `--debugbaud` in wrapper scripts and command templates — a stale `-b` now *overrides* the correct value and causes the exact garbage the section warns about. |
| 2 | **Exit codes / cycle outcomes** | **`$?` now works.** It never did. The skill reads the log because the exit code was inert; that workaround is no longer necessary and the codes are now the reliable signal. New code `2` = bad command line. |
| 3 | **FAIL FAST — new rule** | **A failed launch must stop the cycle IMMEDIATELY. Never wait out the timeout on a run that never started.** See §2a — this is the highest-value change for the agent loop. |
| 4 | **`--timeout` guidance** | A non-numeric `--timeout` used to **silently disable the timeout**. It is now rejected. Any advice to defensively re-check the timeout value can go. |

---

## 1. DEBUG baud — the tool no longer needs to be told

### What the skill says today

> **DEBUG baud verification.**
> `pnut-term-ts` uses `--debugbaud` (default `2000000`) — your source's actual DEBUG baud must
> match. Verify against `{{P2_DEBUG_BAUD}}`. With a mismatch, the terminal displays garbage and
> the agent will chase it as a hardware fault.

### Why that was necessary — and why it no longer is

There is **no baud handshake anywhere in the P2 debug system.** When a program is compiled with
debug enabled, the compiler installs the debug baud *into the downloaded image* as `_baud_`
(`p2com.asm:7418-7419`). That value — not any host setting — is what the P2 will physically
transmit at. PNut gets to know it because its compiler and its GUI share one memory struct
(`GlobalUnit.pas:149`). **PNut-Term-TS never compiles, so nothing handed it that value.** It
guessed a default, and a user's `DEBUG_BAUD` CON — a documented override — was silently ignored.

We were guessing while holding the answer. **PNut-Term-TS now reads `_baud_` out of the binary it
is about to download** and listens at that rate. An in-source `DEBUG_BAUD` finally works:

```spin2
CON  DEBUG_BAUD = 921600     ' picked up automatically; no flag needed
```

If the source says nothing, everything in the P2 world (compiler, PNut, our downloader) defaults
to **2,000,000** — and so do we now. Our old default was 115,200, which made us the single
disagreeing party in a system that only works because the defaults agree.

### The trap this creates for the skill

**Precedence is: `-b` flag → the binary's `_baud_` → project settings → global settings →
2,000,000.** The explicit flag still wins, deliberately: our binary read is a signature match
coupled to PNut v55, so if it ever goes stale (a new PNut, flexspin, a flash-wrapped image) `-b`
must remain the escape hatch. Nothing else could override us.

**Consequence: a wrapper script that reflexively passes `-b` now overrides the correct,
authoritative value with a guess.** Our own scripts passing `-b 2000000` on every run are exactly
why this defect stayed hidden for months. If the flag disagrees with the image you will see:

```
WARNING: -b 115200 disagrees with this binary's compiled debug baud (2000000).
The P2 will transmit at 2000000 — expect unreadable output. Drop -b to use the binary's rate.
```

### Requested edits

- **Delete** the "DEBUG baud verification" section. The manual cross-check is obsolete work, and
  the `{{P2_DEBUG_BAUD}}` comparison it prescribes no longer has a purpose in the download flow.
- **Remove `-b` / `--debugbaud` from all command templates and wrapper scripts** that download
  with `-r` / `-f`. Let the binary speak.
- **Keep `{{P2_DEBUG_BAUD}}` for exactly one case, and say so:** *attaching to an already-running
  P2 with no download.* There is no binary to read, so there is no ground truth, and the rate must
  be supplied. This is the only surviving legitimate use of `-b`.
- **Add to the troubleshooting/symptom list:** if output is garbage, **check for the `WARNING: -b …
  disagrees …` line first, and try dropping `-b`.** This turns the old "chase it as a hardware
  fault" failure into a one-line diagnosis.

---

## 2. Exit codes now actually reach the shell

### What was broken

The documented exit-code contract (`0` clean, `1` port error, `3` download failed, `124` run
timeout, `125` flush timeout) was **completely inert**. The entry point called `run()` and threw
away its return value, so the shell saw **`0` for everything** — including `Aborted!`, a failed
download, and a run timeout.

**This is almost certainly why the skill was written to parse the log rather than check `$?`.**
That workaround was correct at the time. It is no longer necessary.

### What is true now

Exit codes propagate correctly in **both** headed and headless mode (a launching script can branch
on `$?` identically either way — that was always the promise). The full map:

| code | meaning |
|---|---|
| `0` | clean exit; all saves/logs flushed |
| `1` | port / device error (the command was valid; the hardware was not there) |
| **`2`** | **NEW — bad command line. Nothing ran:** no device touched, no download attempted, no window opened |
| `3` | download failed |
| `124` | run timeout (`--timeout`) elapsed |
| `125` | shutdown drain timed out — **output may be truncated** |

### Requested edits

- Wherever the skill infers a cycle outcome by reading the log, **prefer `$?`** and use the log for
  detail. Note especially that `125` is the "your log may be incomplete" signal — worth surfacing,
  because a truncated log is exactly the condition an agent would otherwise misread as a clean run.
- Add `2` to any outcome table. It is unambiguous and cheap to act on: **the invocation is wrong;
  nothing happened; fix the command, do not re-flash and do not touch the hardware.**
- The skill's existing rule — *"a marker hit means COMPLETED, not SUCCEEDED"* — is unaffected and
  should stay. Exit codes tell you the run's mechanics, not whether the program did the right thing.

---

## 2a. FAIL FAST — never wait out a timeout on a run that never started

**This is the highest-value change in this document for the agent loop.**

`2` (bad command line) and `3` (download failed) share a property that `0`/`124`/`125` do not:
**nothing is running on the P2.** There is no program to produce output, no end-marker that can
ever arrive, and no amount of waiting that will change that.

An agent that launches, then settles in to wait for its end-marker or its `--timeout` budget, will
**burn the entire timeout** waiting for output from a program that was never downloaded. That is
worse than slow — it *presents as a hang*, and a hang invites the wrong diagnosis entirely (chip
wedge? clock literal? cable?) when the real answer was "you typed the flag wrong" or "the download
failed," and the tool said so immediately.

### The rule

> **Check the exit status the moment the command returns. If it is `2` or `3`, STOP THE CYCLE
> IMMEDIATELY — do not wait for an end-marker, do not wait out `--timeout`, do not begin
> log analysis. Report the failure and go straight to the fix.**

| code | is the P2 running? | what the agent must do |
|---|---|---|
| `2` — bad command line | **No.** Nothing was touched: no port opened, no download attempted, no window opened. | **Stop now.** Fix the invocation. Do **not** re-flash, do **not** power-cycle, do **not** touch the hardware — the hardware was never involved. |
| `3` — download failed | **No.** The download did not complete, so the previous program (or nothing) is what's on the chip. | **Stop now.** Diagnose the download: cable, PropPlug, reset line (DTR/RTS), device selection. Waiting for output is pointless. |
| `1` — port error | No. | Stop now. Port/permissions/device problem. |
| `124` — run timeout | Yes — it ran, and outran its budget. | This is the *only* case where "we waited and nothing came" is a real signal worth analyzing. |
| `125` — flush timeout | Yes, and it finished. | Run completed but **the log may be truncated** — treat log-derived conclusions with suspicion. |
| `0` — clean | Yes, and it finished cleanly. | Proceed to log analysis. Remember: **completed ≠ succeeded.** |

The distinction the agent must internalize: **`124` means "it ran and we waited." `2` and `3` mean
"it never ran, and waiting was always futile."** Only the first is evidence about the program.

If the skill currently launches and then unconditionally waits/polls for the marker or the log, that
control flow needs an early-exit branch on the exit status *before* the wait begins.

### Do NOT scrape the log for `[DOWNLOAD FAILED]`

The temptation is to watch the log for a `failed to download` line and abort on it. **Don't.** That
is the same workaround as parsing the log for outcomes, and it is no longer needed:

- **The tool already aborts on a failed download and returns `3` — immediately, in both modes.**
  Headless has always done this. Headed *batch* (`--exit-on-end-session`) previously **hung forever**
  on a failed download — it popped a modal error dialog nobody was present to click, and since
  `--timeout` is headless-only there was no upper bound at all. **That is fixed in this build:** batch
  mode now aborts with `3`, the same code headless returns.
- So the exit status *is* the signal, it arrives *before* any waiting begins, and it is identical in
  both modes. A log scrape would be slower, mode-dependent, and fragile against wording changes.

**Rule: branch on `$?`. Use the log for the *reason*, never for the *verdict*.**

---

## 3. `--timeout` is now validated

A non-numeric `--timeout` (e.g. `--timeout abc`) used to **silently remove the only bound on an
unattended run** — `parseInt` produced `NaN`, `NaN <= 0` is `false` so it passed validation, and the
timer was then never armed. A typo in the one flag whose entire job is to bound the run *removed the
bound*, with no error. (`--timeout 60s` was quietly accepted as `60`, too.)

Both are now rejected with exit code `2` before anything runs. Any defensive guidance in the skill
about double-checking the timeout value can be dropped; the tool enforces it.

---

## Status / provenance

- Landed on `main` in the PNut-Term-TS working tree on **2026-07-14**; ships in the next build
  (after `0.9.93`). Verified by the full sequential suite, plus new suites `tests/p2DebugHeader.test.ts`
  and `tests/cliExitCodes.test.ts` (the latter spawns the real CLI and asserts on `$?`).
- Not yet exercised on external P2 hardware. The baud behavior is derived from the compiled binaries
  themselves (offsets verified against all 39 P2 binaries in the repo), so it does not depend on a
  hardware observation — but hardware sign-off is pending, as always.
- Binary layout, for reference (v55; debug ROM at the head of the image; offsets from
  `p2com.asm:7442-7444`): 16-byte signature at `0x000`; `_txpin_` at `0x140`; `_rxpin_` at `0x144`
  (bit 31 = `DEBUG_TIMESTAMP`); `_baud_` at `0x148`, u32 LE.
- Questions → PNut-Term-TS engineering. Implementation lives in `src/utils/p2DebugHeader.ts`.
