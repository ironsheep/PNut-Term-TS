# Release Punch List

Tracking items that need attention before or shortly after release.

Last swept: 2026-07-19 (pre-1.0 documentation audit, build 0.9.99).

---

## 🚦 1.0.0 RELEASE GATES

**We are pre-1.0. Items tagged `🚦 GATES 1.0.0` MUST be fixed and verified before the initial 1.0.0
release ships.** Everything else on this list may ship after 1.0.0.

**Convention:** every gating item carries the literal marker **`🚦 GATES 1.0.0`** on its own line inside the
item. This roster is the index; the marker is the source of truth. To find every gate regardless of which
priority section it sits in:

```bash
grep -n "🚦 GATES 1.0.0" DOCs/PUNCH_LIST.md
```

**As the list burns down, no 1.0.0 release goes out while any gate is open.** When a gate is closed, tick the
item AND strike its line in this roster — do not delete it, so the roster stays an auditable record of what
gated the release.

### Gate roster — G1–G6 CLOSED; **G7 OPEN (added 2026-07-27)**

| # | Gate | Section | Why it gates |
|---|---|---|---|
| ~~**G1**~~ | ~~Linux: Electron process doesn't exit when all windows closed~~ | P1 | **CLOSED 2026-07-18** — verified on Linux hardware; process exits cleanly, port released. |
| ~~**G2**~~ | ~~Whole-application + external-hardware parity sign-off (§18)~~ | P1 | **CLOSED 2026-07-17** — physical-P2 pass: 9 display windows (Debug Window Manual images, PNut vs term-ts) + debugger Tests 0–14 on v0.9.97. |
| ~~**G3**~~ | ~~Exit code never reaches the shell — the `ExitCode` contract is inert~~ | P1 (automation) | **CLOSED 2026-07-14** (build TBD). Exit codes now propagate in BOTH modes; proven end-to-end by `tests/cliExitCodes.test.ts` (spawns the real CLI, asserts `$?`). |
| ~~**G4**~~ | ~~A non-numeric `--timeout` silently disables the timeout~~ | P1 (automation) | **CLOSED 2026-07-14** (build TBD). `--timeout`/`--debugbaud` are strictly validated; bad values abort with code 2 before anything runs. |
| ~~**G5**~~ | ~~Effective default debug baud is 115200; help text and skill both say 2000000~~ | P1 (automation) | **CLOSED 2026-07-14** (build TBD). Default is now 2,000,000 — **and we no longer guess at all**: the debug baud is READ OUT OF THE BINARY being downloaded (`utils/p2DebugHeader.ts`), so an in-source `DEBUG_BAUD` CON finally works with this tool. `-b` remains an explicit override, and warns when it contradicts the image. |
| ~~**G6**~~ | ~~`POS` coordinate-space divergence from v55~~ | P2 | **CLOSED 2026-07-14 — NO CODE CHANGE.** The `POS`/210 premise was **disproven**: the compiler overwrites `EditorUnit`'s 210, so the normal-use origin is (0,0) and our absolute `POS` **already matches** PNut. Separately, our non-overlapping auto-layout was **adjudicated an intentional feature** (Stephen) and stands. One standing DOC RULE survives: window placement must be described as a **term-ts feature**, never as DEBUG-language behavior. |
| **G7** | **No development diagnostics in a released build — audited, not assumed** | P1 (release hygiene) | **OPEN.** Stephen, 2026-07-27, on seeing `[SAVE-READBACK]` and `{notSet}:` during Linux certification: *"that full audit sweep seems like a release gate to me"*. Correct — what a shipped binary prints is a property of the artifact, and it had been enforced only by hand-flipped per-file consts. See §Release hygiene below for the method, the baseline count, and the disposition rules. |

**G1 and G2 were already declared gating** by the existing "P1 — Must Fix Before Release" / "P1 — Release
validation" sections; they are listed here so the roster is complete rather than a partial view.
**G3–G6 were added 2026-07-14** (Stephen: *"I want all three of these things fixed before we hit the 1.0.0
release — these are gating bugs"*). **G5 is included on our recommendation**, not from that instruction: it is
the same class of defect as G3/G4 (a documented contract the code does not honor) and it directly blocks a
statement the user manual is required to make. Flag if you disagree and we will demote it.

---

## Open Items

### P1 - Must Fix Before Release

#### Release hygiene: no development diagnostics in a released build
  - **🚦 GATES 1.0.0** — roster **G7** — **OPEN.**
  - **Why it gates:** what the shipped binary prints is a property of the artifact, not a
    preference. Until now it was enforced only by hand-flipped per-file `ENABLE_CONSOLE_LOG`
    consts — one forgotten `true`, or one ungated `console.log` added in a hurry, ships. Linux
    certification (v0.11.10) surfaced exactly that: `[SAVE-READBACK]` byte counts on every SAVE,
    an internal function name during download, and `{notSet}:` message prefixes.
  - **What "audited" means — the method (do not substitute a source grep):**
    1. Presence in the bundle is NOT the test. The release bundle is unminified, so
       `if (ENABLE_CONSOLE_LOG) console.log(...)` survives textually with the const folded to
       `false` and can never execute. **Reachability is the test.**
    2. Classify every `console.*` call site in `src/` as **GATED** (lexically inside an
       `ENABLE_CONSOLE_LOG` / `ENABLE_DIAGNOSTICS` guard, including guarded helper bodies),
       **RENDERER** (inside a template literal injected via `executeJavaScript`/`generateHTML` —
       prints to DevTools, not the user's terminal), or **LIVE** (can print on a released run).
    3. Triage every LIVE site against the disposition rules below.
  - **Baseline, 2026-07-27 (v0.11.11):** GATED 156 · RENDERER 70 · **LIVE 275**. The LIVE count
    is the working list; it is NOT 275 defects — most are error paths that SHOULD speak.
  - **Disposition rules:**
    - **Keep** — a genuine failure the user must know about (`console.error` on a real error),
      worded in plain language, no stack dumps for user-program mistakes.
    - **Gate** — development/tracing detail (`[FFT EXTRACT]`, `[TERM] Offscreen canvas
      initialized`, canvas byte counts): put behind `ENABLE_DIAGNOSTICS` so `build:release`
      compiles it out.
    - **Demote** — channel/mechanism internals that are useful when diagnosing that channel:
      move to `--diag-serial` (`logChannelDiag`) or the equivalent per-subsystem switch.
    - **Reword** — right to print, wrong voice: internal function names, raw object dumps.
  - **Done when:** every LIVE site carries one of the four dispositions, the routine-run print
    set is exactly the intended run narrative (per `DOCs/project-specific/LOGGING-STANDARDS.md`),
    and a re-run of the classifier shows no ungated routine diagnostics.
  - **Tooling:** the classifier used for the baseline is kept with the sprint notes; it is a
    ~40-line script over `src/` — rewrite rather than hunt for it if it has aged.


- [x] **Linux: Electron process doesn't exit when all windows closed** (v0.9.22 regression report, Fedora 42) — **CLOSED 2026-07-18 (Stephen, verified on Linux HW).**
  - **🚦 GATES 1.0.0** — roster **G1** — **CLOSED.** Process exits on its own; no lingering Electron, port released, no `kill -9` needed.
  - Root cause: Dual `window-all-closed` handlers racing — electron-main.ts called `app.quit()` before mainWindow.ts finished async serial port cleanup
  - Fix applied: Removed duplicate handler from electron-main.ts, added 5s safety timeout to mainWindow.ts handler
  - Status: **Code fix applied, needs testing on Linux hardware**
  - Files changed: `src/electron-main.ts`, `src/classes/mainWindow.ts`
  - **How to reproduce / verify (Linux).** The race is with *async serial cleanup*, so it only
    manifests with an **open serial port** — a run with no device will NOT exercise it.
    1. Connect the P2 (PropPlug/FTDI, e.g. `/dev/ttyUSB0`). Launch the app **headed** so the main
       window opens and the port is opened. Run a program that spawns a debug window or two, so
       "all windows closed" genuinely closes several windows.
    2. Confirm the port is held: `lsof /dev/ttyUSB0` (should show the app).
    3. **Close all windows from the UI** (close the main window). Do **not** kill the process.
    4. Within a few seconds, check:
       - `ps aux | grep -i pnut-term` → **no lingering process** *(bug: it stays alive)*
       - `lsof /dev/ttyUSB0` → **nothing** *(bug: port still held)*
       - `echo $?` → exit code reaches the shell (also exercises G3)
    5. Relaunch and connect again immediately → should connect cleanly *(bug: "port busy", and
       DTR left asserted holds the P2 in reset until `kill -9` + replug)*.
  - **PASS:** process exits on its own, `/dev/ttyUSB0` released, relaunch connects, no `kill -9`.
  - **FAIL (original v0.9.22 symptom):** Electron process not released; user must `kill -9`,
    which is what left DTR in a bad state (see the resolved P2 item below).
  - Also exercise the same teardown via `kill <pid>` (SIGTERM) and Ctrl+C (SIGINT) — both route
    through the same single-owner handler in `mainWindow.ts`. A safety timer force-quits at
    `SHUTDOWN_DRAIN_TIMEOUT_MS + 5s` (**≈15 s**), so an exit that takes ~15 s means the drain
    hung and should be reported rather than counted as a pass.

### P1 - Release validation (hardware) — the point of this build

- [x] **§18 whole-application + external-hardware parity sign-off** (9win-parity sprint, build 0.9.28) — **CLOSED 2026-07-17 (Stephen HW sign-off).**
  - **🚦 GATES 1.0.0** — roster **G2** — **CLOSED.**
  - Non-hardware gates were already MET: full sequential runner green; diagnostic logging off in touched windows.
  - **HW sign-off, two parts, both done on real P2:**
    - **9 debug DISPLAY windows** — all exercised against the shipping demos + diff demos and run against **both PNut (reference) and pnut-term-ts** to produce the images in the **Debug Window Manual**; that side-by-side is the visual-parity evidence.
    - **Single-step debugger** — full front-to-back interactive test plan walk, **Tests 0–14 PASS on v0.9.97** (`DOCs/pascal-REF/SingleStep-Debugger-Interactive-Test-Plan.md`; release-gate banner in that doc).

### P2 - Should Fix

- [x] **SCOPE_XY dot shape — DONE (post-0.9.52, not HW-validated)** — Stephen confirmed the crisp-rendering pass alone wasn't close enough. Verified our dot SIZE already matches Pascal (`SmoothDot(x,y,vDotSize shl 6)` in `<<8` fixed-point = `dotSize/4` px; DOTSIZE 4 → 1px radius). Replaced the anti-aliased `ctx.arc` circle at SUB-PIXEL float coords with INTEGER-positioned filled SQUARES (`fillRect`, radius `round(dotSize/4)`, 2×2 core for DOTSIZE 4) — crisp, pixel-aligned, matching Pascal's dot core and clean under HiDPI nearest-neighbor upscale. scopeXy tests 80/80.
- [ ] ~~**SCOPE_XY (et al.) dot shape — BACK-POCKET, conditional on HW re-test** (window-issues review, post-0.9.51)~~ (superseded by the DONE item above)
  - Context: SCOPE_XY dots read as fat/dispersed vs the reference's crisp ~5px cross + 2×2 darker core. Root cause of the *dispersion* was the Retina bilinear-upscale blur of the logical-res canvas — fixed via the `image-rendering: crisp-edges` sweep across all canvas windows (CSS-only). The grid-gray "difference" (read ~193 vs Pascal 132) was the SAME blur diluting the thin 0x848484 line; the color value is provably correct.
  - Residual: our dots are anti-aliased filled CIRCLES (`ctx.arc(x,y,dotSize/4)`) at sub-pixel float coords, vs Pascal's `SmoothDot` (crisp square-ish dot). After the crisp-rendering fix this softness should be much reduced.
  - **DECISION (Stephen): leave dot shape alone for now. Only promote to a fix if the next HW capture still doesn't look close enough.** If it does, candidate fix = round dot coords to integers and/or draw square dots to mirror `SmoothDot`.

- [x] **DebugLogicWindow timer fires after window close → null deref — FIXED (staged, post-0.9.55, not released).** Confirmed real on audit 2026-06-14: a leftover "HYPOTHESIS 4 DEBUGGING" `setTimeout(…, 100)` in `debugLogicWin.ts` re-read `this.debugWindow!.getBounds()` after WindowPlacer registration; `closeDebugWindow()` nulls `debugWindow` and clears no timer, so a close within 100 ms → null deref. Removed the diagnostic block (kept the functional `registerWindow`). tsc clean, 78 logic tests green. Change is STAGED/uncommitted (no release yet, per Stephen).

- [ ] **BITMAP sparse rendering model deviation — CONFIRMED real parity gap (audit 2026-06-14); small fix.**
  - `debugBitmapWin.ts:1435` `if (this.state.sparseMode && value === this.state.backgroundColor) { step; continue; }` SKIPS any pixel whose value equals the sparse colour. Pascal draws a bordered dot for *every* sparse pixel (`SmoothShape`, DebugDisplayUnit.pas:2472-2479) → we under-draw. Narrow edge case (only pixels exactly equal to the sparse colour). Fix = remove/relax that skip so those pixels also get the two-layer bordered-dot render.
  - Not exercised by fig-06 (no sparse). **Demo written:** `REF-NO-COMMIT/WIndow ISSUES/fig-12-bitmap-sparse/` (DRAFT, needs compile-check).

- [ ] **LOGIC RANGE bus-waveform rendering — CONFIRMED real parity gap (audit 2026-06-14); needs NEW drawing code.**
  - Parse parity complete (`isRange`/`busWidth` tagged), but the renderer has NO bus path: `drawChannelFromSamples` only draws a 1-bit high/low trace (`invSample = 1 - samples[i]`), so a RANGE bus shows as N stacked 1-bit lines instead of one multi-bit value (bus-band) waveform. Fix = a new bus-waveform draw branch (logic-analyzer bus band with value crossings).
  - Not exercised by fig-06 (single-bit channels only). **Demo written:** `REF-NO-COMMIT/WIndow ISSUES/fig-11-logic-range/` (DRAFT, needs compile-check).

### P2 - Single-Step Debugger (ssdbgr) — pre-test audit findings (2026-06-16)

Audited `debugDebuggerWin.ts` message path while sweeping the v0.9.67/.68 serialization fixes across all windows. **VERDICT: the message path is SOUND** — it uses base `updateContent` (single-flight serialization applies) + base `onWindowReady` (the v0.9.68 drain-vs-live fix applies), and its own renderer-readiness buffering is correct (`forwardPhase1/3ToRenderer` push to `pendingPhase1`/`pendingPhase3` when `!rendererReady`, drained in order on renderer `'ready'` at :385-388). No premature-ready packet loss; not vulnerable to either problem we fixed. Items below are cleanup/watch, not blockers.

- [ ] **Remove vestigial dead code (clarity, low-risk).** `deferredMessages` (`debugDebuggerWin.ts:66`) is **write-only**: pushed at :629, reset at :605, **never read**. Its defer branch in `processMessageImmediate` (:625-635) is effectively dead — `componentsReady` is set `true` in the constructor (:96) and only flips `false` in `closeDebugWindow` (:606), so the branch fires only for a message racing window-close (a harmless drop). Also delete the two confirmed-uncalled deprecated methods: `queueInitialMessage` (:150) and `processQueuedMessages` (:159, a no-op). Removing these makes the real readiness logic (`componentsReady` / `rendererReady` buffering) the only thing visible. Risk: touches the debugger file — do before/after the test by preference, not mid-test.
- [ ] **WATCH during testing (protocol note, not a known bug).** `awaitingPhase3` is the one piece of cross-SOURCE shared state — mutated by BOTH the serial-packet path (`processMessageImmediate → handleBinaryMessage`) AND the renderer-reply path (`handleRendererMessage`, :400 set / :413 clear). The Phase1→phase2-reply→Phase3 protocol is inherently sequential so they shouldn't interleave, but if stepping misbehaves under rapid input, this flag is the first place to look.

### P3 - Test hygiene (post-#24 follow-on)

The sequential runner is now **153/153 green** (was 70 of 183 files). 42 obsolete suites that imported removed modules were deleted. The following test files remain **unregistered and documented** — none are silent skips of fixable tests, but they are not exercised in CI:

- [ ] **`fftMultipleExecutions` / `fftRealHardwareComparison`** — require P2 capture files (`debug_*.log`, `fft_input_samples.txt`) absent from the repo. Options: commit synthetic equivalent data, or move to an `external-hardware/` gated suite.
- [ ] **`spritedefRealUSB`** — requires an absent USB capture log (`test-results/external-results/usb-traffic_*.log`); graceful-skips when missing.
- [ ] **`memoryLeakDetection`** — 11 tests green; 2 gated with `.skip` due to jest-env timer pollution (see the DebugLogicWindow timer P2 item — fixing that likely un-gates these).
- [ ] **`workerExtraction`** — worker-thread integration test that times out under jest (delivery never fires); same class as the registered-but-intermittent `workerSpritedefBug`. Needs a worker-runtime-friendly harness.
- [ ] **`workerSpritedefBug`** — registered but historically an intermittent Docker-saturation flake; passed in the 0.9.28 closeout run. Watch for flakiness.
- [ ] **Runner progress counter** (cosmetic) — `scripts/claude/run_tests_sequentially.sh` prints `[N/70]` with a stale `70` denominator; it actually runs/passes 153. Update the hardcoded total.

### P3 - Documentation

- [ ] **`/DOCs/project-specific` is gitignored** — the §17 refreshes to `ARCHITECTURE.md`, `IMPLEMENTATION-STATUS.md`, and `TEST-STATUS.md` exist only in the local working copy and are NOT in the repo (only `TECHNICAL-DEBT.md` is tracked there). Decide whether these spec docs should be tracked; if so, un-ignore and commit them.

### P3 - Nice to Have / Future

- [ ] **Headless mode: debug() output end-marker matching** — User report suggested it doesn't work, but our line reassembly fix should handle it. Need to verify with actual debug() program on hardware.
- [ ] **GUI: "binary data 5 bytes" display** — User reported seeing raw binary instead of decoded debug text. Needs reproduction with logs to determine if routing/classification issue.

- [ ] **Shared `SmoothShape` rounded-shape utility (refactor opportunity)** — Pascal's `SmoothShape` (anti-aliased rounded rect/ellipse) is reimplemented ad-hoc via `Canvas2D roundRect + fill/stroke` in at least four places: `debugPlotWin.ts:2544`, `debugScopeXyWin.ts:1424`, `debugBitmapWin.ts:1472`, and (added by the SSDB Visual Parity sprint) `DebuggerRenderer.ts` `drawBox`. No shared helper exists. Opportunity to extract a single shared `smoothShape()` util (e.g. into `src/classes/shared/`) and refactor these windows onto it. Deferred from the SSDB Visual Parity sprint (kept local per final-release surgical posture); broad re-test surface → do as a dedicated refactor. (Raised by Stephen 2026-06-20.)

- [ ] **SSDB `contextmenu` keyboard/touch-trigger guard — conditional, only if we find a need.** The Test-4 macOS right-click fix routes the secondary click through the canvas `contextmenu` event (`DebuggerInteraction.ts` listener-install block) and dispatches it as a right-click at `e.clientX/clientY`. `contextmenu` can *also* be raised by the keyboard "menu/apps" key or a touch long-press, where the coords may be `(0,0)` (or the element origin) rather than a real pointer position — that would dispatch a spurious right-click against whatever panel sits at the top-left corner. **Not observed; extremely rare on a mouse-driven debug tool, so left unguarded by design.** If it ever manifests, fix = in the `contextmenu` handler, ignore events not originating from a real pointer (e.g. guard on a tracked last-pointer position, or skip when `clientX===0 && clientY===0` with no preceding `mousemove`). (Raised 2026-06-29 during the Test-4 cross-platform review.)
- [ ] **Verify SSDB interrupt event-bit offsets** — `DebuggerRenderer.renderInterrupts` extracts the INT1/2/3 *event* nibble at bits 8/12/16 of `message[1]`, but Pascal `DrawInt` (DebuggerUnit.pas:2275) reads it at `mBRKCZ >> (int<<2 + 4)` = bits 4/8/12 — a 4-bit difference. Status bits (0/2/4) match Pascal. May be a real decoding bug OR our `message[1]` packing differs from Pascal `mBRKCZ`. Doesn't manifest while interrupts are off (test06). Verify the message-word layout against Pascal and correct if our offsets are wrong. (Surfaced during sprint task #53, 2026-06-20.)

### P1 - Headless / automation contract — three verified breaks (found 2026-07-14 while sourcing the user manual)

**Why these are P1 when the logging items are P3:** each one makes a **stated, documented contract of the
flagship headless feature non-functional**, and each is invisible in normal use — which is why 5-6 months of
agent use has not surfaced them (the `p2-dev-cycle` skill determines outcomes by *reading the log*, and its
wrapper scripts pass the affected flags explicitly). They will bite the moment a user follows the tool's own
documentation. All three are **cheap and carry zero performance risk.** Per Stephen 2026-07-14: no code change
now — filed.

- [x] **🔴 The exit code never reaches the shell. The entire `ExitCode` contract is inert. — FIXED 2026-07-14 (not yet released).**
  - **🚦 GATES 1.0.0** — roster **G3** — **CLOSED.**
  - **What landed:** the entry point now propagates `run()`'s code (`process.exitCode = …`, not `process.exit()`,
    so buffered stdout still flushes when piped). Removed the hardcoded `process.exit(0)` that made **every**
    abort report success, and the mid-validation `process.exit(1)` on `-p <not found>`. `launchElectron()` no
    longer turns a **signal death into a clean 0** (`code || 0` → real code, or `128+signum`).
  - **Proven end-to-end, not assumed:** `tests/cliExitCodes.test.ts` spawns the REAL built CLI and asserts on
    `$?` — 2 for twelve distinct bad command lines, 1 for a named-but-absent device, 0 for `--help`/`--version`/`-n`.
    Headed propagation verified in-container by watching the Electron child's own exit code (127, missing GUI
    libs) arrive at the shell verbatim — that same run reported **0** before the fix.
  - **Why it hid for months:** `tests/exitCodes.test.ts` pinned the enum's *values* and passed happily while the
    contract was inert. An enum can prove the numbers are spelled right; only spawning the process proves they
    arrive. The new suite is the one that would have caught this.
  - `cliTool.run();` (`src/pnut-term-ts.ts:1051`) **discards `run()`'s return value.** There is no
    `process.exit(code)` and no `process.exitCode = …` anywhere in `src/` that carries an `ExitCode`
    (grep-verified: the only `process.exit` sites are `pnut-term-ts.ts:69,74` (stream error), `:258` (`-V`),
    `:588` (`-p` not found), `:757` (`exit(0)` — **every** non-GUI path *including every abort*), and
    `electron-main.ts:110,120` (internal misuse)).
  - **Headless `1`/`3`/`124`/`125` are computed, logged, returned — then dropped**; the process ends with **0**.
    The Electron child's `app.exit(125)` is captured by `launchElectron()` (`:936-945`) and dropped too.
  - **Empirically confirmed** in-container: `node dist/pnut-term-ts.js --headless` → prints `Aborted!` → `$? = 0`.
  - **This directly contradicts the contract `exitCodes.ts:3-8` promises**: *"IDENTICAL across headed and headless,
    so a launching script can branch on `$?`."* A CI job branching on `$?` today sees **0** for run-timeout, **0**
    for download-failed, and **0** for flush-timeout ("your output may be truncated").
  - **Fix:** propagate — `cliTool.run().then(c => { process.exitCode = c; })` (prefer `process.exitCode` over
    `process.exit()` so buffered stdout/log writes still flush). **Perf risk: NONE.**
  - ⚠️ **Do NOT document "branch on `$?`" in the user manual until this lands** — it would publish a contract the
    tool does not honor.

- [x] **🔴 A non-numeric `--timeout` silently disables the timeout entirely. — FIXED 2026-07-14 (not yet released).**
  - **🚦 GATES 1.0.0** — roster **G4** — **CLOSED.**
  - **What landed:** dropped commander's `parseInt` coercion (the source of the NaN) and validate the raw string
    strictly instead — `parsePositiveInt()` accepts only a run of digits with a positive value. This also closes
    the *quieter* half of the same bug: `parseInt('60s')` returned **60**, silently accepting garbage by ignoring
    the tail. Same treatment applied to `--debugbaud` (`-b 115200abc` used to be accepted as 115200).
  - Bad values are now a **usage error (exit 2) reported before anything runs** — no port opened, no download.
  - `--timeout abc` → commander's `parseInt` coercion yields **`NaN`**. The guard is
    `if (options.timeout <= 0)` (`pnut-term-ts.ts:354`) — and **`NaN <= 0` is `false`**, so it passes validation.
    `headlessTimeout = NaN`. Then `if (this.context.runEnvironment.headlessTimeout)`
    (`headlessController.ts:89`) is **falsy for NaN** → **the timer is never armed.**
  - Net: a typo in the one flag that exists to bound a run **removes the bound**, with no error and no log line.
    The run hangs until killed. For the automation loop whose primary safety net *is* the timeout, this is the
    worst possible failure mode.
  - **Fix:** `if (!Number.isFinite(options.timeout) || options.timeout <= 0)`. **Perf risk: NONE.**

- [x] **🔴 The effective default debug baud is 115200 — the help text and the `p2-dev-cycle` skill both say 2000000. — FIXED 2026-07-14 (not yet released). Fixed BETTER than proposed: we no longer guess at all.**
  - **🚦 GATES 1.0.0** — roster **G5** — **CLOSED.**
  - **WHAT LANDED (two parts):**
    1. **Default corrected to 2,000,000** — `mainWindow.ts` (`APP_DEFAULT_BAUD`, `DEFAULT_BAUD_RATE`),
       `usb.serial.ts` (`desiredCommsBaudRate`), `context.ts` ×2 (the persisted-preference defaults).
    2. **THE REAL FIX — read the baud out of the binary** (`src/utils/p2DebugHeader.ts`, new). The compiler
       installs the debug baud into the downloaded image as `_baud_`, so the image is the ONLY thing in our
       possession that knows what the P2 will actually transmit at. We were guessing while holding the answer.
       Wired into BOTH download paths (`mainWindow.executeDownload`, `headlessController.downloadFile`).
  - **This also closes a gap nobody had noticed: an in-source `DEBUG_BAUD` CON never worked with our tool.**
    It changes what the CHIP transmits and tells nobody else; PNut only knows because its compiler and GUI share
    one struct (`GlobalUnit.pas:149`). We never compile ⇒ we silently ignored the user's documented override and
    produced garbage. Now it Just Works — and we are **strictly better than PNut here**, which refuses to debug
    at all when the debug baud differs from the download baud (`SerialUnit.pas:132` silently closes the port).
  - **Binary layout (v55), verified against all 39 P2 binaries in the repo:** debug ROM at the head of the image;
    16-byte signature at `0x000` (`50 f8 08 fc 51 04 08 fc 41 a2 60 fd 51 6a 10 fc`, byte-identical across every
    debug binary); `_txpin_` `0x140`; `_rxpin_` `0x144` (bit 31 = `DEBUG_TIMESTAMP`); `_baud_` `0x148` (u32 LE).
    Field offsets from `p2com.asm:7442-7444`.
  - **PRECEDENCE (adjudicated with Stephen 2026-07-14): `-b` flag → binary's `_baud_` → project prefs → global
    prefs → 2,000,000.** The reasoning, so it is not relitigated: the binary is *ground truth* (the chip physically
    cannot transmit at any other rate), so a contradicting `-b` can only be wrong — **but** our header read is a
    signature heuristic coupled to v55, and if it ever goes stale (new PNut, flexspin, flash-wrapped image) `-b` is
    the user's ONLY escape hatch. Letting the binary win would leave that corner with no override at all. So the
    explicit flag wins (standard CLI semantics, escape hatch preserved) and we **WARN loudly** on disagreement,
    naming the remedy — turning a silent misdiagnosed failure into a diagnosed one.
  - **Safe by construction:** no signature match ⇒ no debug ROM ⇒ the program emits no DEBUG output ⇒ nothing for
    a debug baud to be right about ⇒ keep the user's configured rate for plain terminal traffic. Absence is
    *meaningful*, not a shrug. An insane `_baud_` (offsets moved) is likewise refused rather than obeyed.
  - **The persisted-preference migration question EVAPORATED.** `defaultBaud` is saved in user settings, so every
    existing user has `115200` on disk and changing the code default alone would have fixed new installs only. The
    binary read overrides a stale preference in the download flow — the case that actually breaks — so **no risky
    prefs migration is needed.** (Attach-without-download still honors the saved preference, which is correct: no
    binary, no ground truth.)
  - **FOLLOW-UP (needs Stephen — central skill, shared across projects):** `~/.claude/skills/p2-dev-cycle/SKILL.md`
    §"DEBUG baud verification" tells agents to manually cross-check the source's DEBUG baud against `--debugbaud`.
    **That step is now obsolete** — the tool reads the truth from the binary. Our own wrapper scripts passing `-b`
    on every run are also what kept G5 hidden for months; they should stop.
  - Help string (`pnut-term-ts.ts:179`): `'set debug baud rate for runtime communication (default 2000000)'`.
  - Reality: `initializeSerialBaud()` uses the CLI value **only** when `debugBaudRateFromCLI` is set
    (`mainWindow.ts:6977`); otherwise `preferences.serialPort.defaultBaud` = **115200** (`context.ts:207`, `:375`),
    else `APP_DEFAULT_BAUD = 115200` (`mainWindow.ts:6974`). Headless never consults preferences at all
    (`headlessController.ts:140-142`) and falls to `UsbSerial`'s class default **115200** (`usb.serial.ts:63`).
    (`electron-main.ts:137`'s `|| 2000000` is dead — `initializeSerialBaud` ignores the field unless the CLI set it.)
  - **The compounding hazard:** `p2-dev-cycle/SKILL.md` §2 states *"`pnut-term-ts` uses `--debugbaud` (default
    `2000000`)"* — and then warns, correctly, that a baud mismatch *"displays garbage and the agent will chase it
    as a hardware fault."* **The documented default would cause the exact failure the skill warns about.** It has
    not bitten because the project wrapper scripts pass `-b`/`P2_DEBUG_BAUD` explicitly.
  - **✅ FIX DIRECTION IS PROVEN, not a judgment call (established 2026-07-14 from the v55 compiler + host).**
    The correct default is **2,000,000**. Restore it; do not "pick" one.

    **The `DEBUG_BAUD` chain, from the source of truth:**
    - `DEBUG_BAUD` is a Spin2 CON that the **compiler bakes into the binary**. `p2com.asm:7418-7419`:
      `mov eax,[debug_baud]` → `mov [dword obj+@@_baud_],eax` — it installs `_baud_` into the generated object,
      so **the P2 configures its own debug TX when the program runs.**
    - When the source does **not** define `DEBUG_BAUD`, the compiler defaults it to the **download baud**
      (`p2com.asm:7141-7146`: *"not defined, use download_baud"*).
    - The download baud is `DefaultBaud = 2000000` (`SerialUnit.pas:49`), and PNut's host debug baud follows it
      (`P2.DebugBaud := P2.DownloadBaud`, `EditorUnit.pas:387`, `:532`).

    | | default |
    |---|---|
    | P2's compiled `_baud_` (no `DEBUG_BAUD` in source) | **2,000,000** |
    | PNut host debug baud | **2,000,000** |
    | term-ts **download** baud (`usb.serial.ts:37,73`) | **2,000,000** |
    | term-ts `--help` text claims | **2,000,000** |
    | **term-ts's actual effective debug baud** | **115200** ← the only disagreement in the entire system |

  - **Why this is worse than a wrong default.** There is **no handshake** — the P2 cannot announce its debug baud,
    and term-ts never compiles, so it never sees the CON. **The design works because the defaults agree.** Our
    115200 therefore breaks exactly the case that was engineered to need **no flag at all**: an unmodified program
    on an unmodified terminal emits garbage. It has stayed hidden only because the project's wrapper scripts pass
    `-b` / `P2_DEBUG_BAUD` explicitly.
  - **Fix:** set the effective default debug baud to **2,000,000** in both modes (`APP_DEFAULT_BAUD`
    `mainWindow.ts:6974`; `preferences.serialPort.defaultBaud` `context.ts:207`, `:375`; `UsbSerial`'s class
    default `usb.serial.ts:63`, which is what headless falls back to). Help text and the `p2-dev-cycle` skill
    already say 2000000 and then become correct. **Perf risk: NONE.**
  - Confirmed by Stephen 2026-07-14: `DEBUG_BAUD` is carried in the source, compiled into the executable, and
    applied by the P2 at run time — so no command-line baud *should* be needed.

### P2 - Window placement: `POS` (RESOLVED — no defect) and the auto-layout labeling question (G6)

- [x] **~~`POS x y` is an OFFSET in PNut and ABSOLUTE in term-ts (210 px divergence)~~ — PREMISE DISPROVEN 2026-07-14. NO CODE CHANGE. term-ts is already correct.**
  - ⚠️ **DO NOT "FIX" THIS. Two separate readings of the Pascal have now reached the wrong conclusion.** The
    arithmetic below is airtight and the answer is still wrong — a classic
    [[pascal-ref-trust-chain]] failure (Pascal = what the tool COMPUTES; hardware = what the reader SEES).
  - **The trap:** `KeyPos` (`DebugDisplayUnit.pas:2712-2715`) really *is* `Left := val + P2.DebugDisplayLeft`,
    and `EditorUnit.pas:392-393`/`537-538` really *do* set `DebugDisplayTop := 210`. Both true. Both misleading.
  - **What actually happens:** `GlobalUnit.pas:149` (`P2InitStruct: pointer; external`) shows the Pascal `TP2`
    record and `p2com.asm` share **ONE struct** — the asm's `debug_display_top` **IS** `P2.DebugDisplayTop`
    (the `ddx`/`dbx` declaration order maps field-for-field onto the record). `determine_bauds_pins` is called
    **unconditionally** from `_compile2` (`p2com.asm:2878`), and `@@hostsymbol` (`:7179-7183`) writes `ecx` when
    the CON is absent — with `xor ecx,ecx` for the display group. **Every compile overwrites the 210 with 0.**

    | PNut launch mode | compiles? | effective display origin |
    |---|---|---|
    | GUI: open source, compile & run (**the normal way**) | yes | **(0, 0)** ← the compiler wins |
    | `PNut file.bin -b` / `-bd` (run a pre-compiled binary) | no | (0, 210) |
    | `PNut -debug <port>` (batch terminal mode) | no | (0, 210) |

  - **Confirmed on hardware (Stephen, Windows, 2026-07-14):** PNut's display windows appear at the **top-left**
    with no 210 px margin. Same compile also sets `DebugLeft/Top/Width/Height := -1` (`mov ecx,-1`), and
    `DebugUnit.pas:107-110` guards `if P2.DebugLeft >= 0 then` → −1 means "unspecified", placement is skipped, and
    the debug LOG window keeps its own form position — which is why Stephen's debug terminal sits at the **bottom**
    of his screen, not in the full-width 200 px top strip the source appears to describe. Both halves of the
    observation fall out of the same fact.
  - ⇒ **`POS` is effectively ABSOLUTE in normal PNut use, and term-ts already matches it.** The manual may state
    "POS takes absolute screen coordinates" without qualification. G6 no longer gates the manual on this.
  - **Residual (inherent, low priority):** `DEBUG_DISPLAY_LEFT`/`TOP` are explicitly *host-side* symbols
    (`p2com.asm:7155` — literally `;check for host-side symbols`), never installed into the binary the way
    `DEBUG_BAUD` is (contrast roster **G5**). term-ts never compiles ⇒ **structurally cannot see them.** A user who
    sets those CONs gets PNut's layout and not ours. Only a term-ts origin *setting* could mitigate; not worth it
    while the default (0,0) is the one we already match.
  - **Candidate 3rd v55 bug for Chip:** PNut is internally inconsistent — the *same binary* lands windows at (0,0)
    compiled-and-run from the GUI but at (0,210) via `-b`; and `DEBUG_DISPLAY_*` CONs are silently ignored in the
    `-b`/`-debug` modes because the compiler never runs to read them.

- [x] **Auto-layout (non-overlapping window placement) — ADJUDICATED 2026-07-14: it is an INTENTIONAL FEATURE. Not a defect. It stands.**
  - **RULING (Stephen, 2026-07-14, verbatim intent):** *"Our window placement algorithms are, by design, providing
    a new feature to the community. This is a PNut term, a desirable feature, and intentionally designed. It's not
    a defect. It's not accidental. We did this on purpose."* And: *"Our handling of POS is going to stand."*
  - **The divergence is real but deliberate.** Pascal creates every no-`POS` window at the origin
    (`DebugDisplayUnit.pas:628-629`) ⇒ in PNut they **all stack on top of each other** at the top-left (Stephen,
    on Windows: *"they default to the top-left corner when they're produced"*). `WindowPlacer` spreads them out
    instead. **We keep ours. Do not "restore parity" here.**
  - **STANDING DOC RULE (the part that must not be lost):** auto-layout is a **PNut-Term-TS feature** and must
    never be published as **DEBUG-language / chip behavior**. This exact confusion already put the chip-fact
    *"DEBUG windows don't overlap"* into the P2 Knowledge Base. Any manual/corpus text describing window
    placement must name the **tool**, not the language. `POS` itself may be stated plainly as absolute screen
    coordinates (see the resolved item above — term-ts matches PNut's normal behavior).
  - ⇒ **Roster G6 is CLOSED as a code gate.** What remains is the doc rule above, which is a writing constraint,
    not an open defect.

- [ ] **FUTURE / MAY NEVER DO — a global display-origin command-line parameter (the only thing we could do about `DEBUG_DISPLAY_LEFT`/`TOP`).**
  - **P3 — speculative. Filed with constraints so it is judged on the right merits; act ONLY if a real need appears.**
  - **The gap it would address:** `DEBUG_DISPLAY_LEFT`/`TOP` are *host-side* compiler symbols (`p2com.asm:7155`)
    — never installed into the binary the way `DEBUG_BAUD` is. term-ts never compiles, so it is **structurally
    unable to see them.** A user who sets those CONs gets PNut's origin and cannot get ours to match. There is no
    live/automatic fix — the information simply never reaches us. Stephen: *"I suspect there's nothing we can do."*
  - **The only coherent shape** — and NOT a `--top`/`--left` pair. In Pascal this is a **single GLOBAL ORIGIN for
    all display windows** (it is both the default spawn point *and* the base that `POS` adds to), so the only
    meaningful parameter is one global `--display-origin <x> <y>` that shifts the whole constellation. A per-window
    top/left would be useless in a multi-window debug session — which is exactly Stephen's objection, and it
    correctly kills the naive design.
  - **Constraints on the record (Stephen, 2026-07-14):**
    - **Not a live facility** — a command-line parameter only; nothing dynamic.
    - **It fights where we want to go.** Our direction is *automatic* placement without `POS`; a user-supplied
      origin re-introduces the manual-placement model we are deliberately moving away from.
    - **Low value.** It only changes anything for windows that carry an explicit `POS` — every un-positioned
      window is auto-placed by us and would ignore the origin entirely.
  - **Decision: potential future addition. We may or may not ever act on it.** Do not implement speculatively.

### P3 - Logging surfaces — weaknesses found while defining the logging contract (2026-07-14)

**Context, so a future reader doesn't over-react to this list (as the first pass did):** these were found by
*reading* the code while drafting the user manual, **not** by anything that has actually bitten anyone. The
logging system has been **in production use by agents for 5-6 months and has been fully functional for
everything we have asked of it.** It is also **deliberately performance-designed** (off-thread extraction,
`setImmediate`-deferred hex formatting, buffered writes) and that performance is **not** to be risked.
Nothing here is a release blocker. Decision (Stephen, 2026-07-14): **document today's behaviour; fix nothing
now.** Each item below is annotated with its performance risk, because that is the axis that decides whether
it is ever worth doing.

- [ ] **USB traffic log: timestamps are *format* time, not *arrival* time.** `USBTrafficLogger.formatHexDump`
  (`usbTrafficLogger.ts:155`) accepts a `timestamp` parameter and then **ignores it**, calling
  `getFormattedDateTimeISO()` (current time) instead. Because formatting runs inside `setImmediate`, the
  recorded time is when the formatter drained, not when the bytes landed — and under load (the 2 Mbaud case
  this log exists to diagnose) the backlog grows and the stamps drift with it. The correct value is *already
  being passed in* at `workerExtractor.ts:244` and thrown away.
  - **Why it matters:** this is the one item that makes a *stated purpose* untrue rather than merely limited —
    if the manual presents this log as the instrument for auditing wire traffic, a reader will reasonably
    assume the times are when bytes arrived.
  - **Perf risk: NONE.** Use the parameter that is already being passed; the `setImmediate` deferral (which is
    the performance design) is untouched. Cheapest item on this list by a wide margin.
  - Note the contrast: both debug loggers already do this correctly — they stamp *synchronously on the receive
    path, before* deferring the write (`headlessFileLogger.ts:243`, `loggerWin.ts:1243`). The USB logger is the
    odd one out.

- [ ] **USB traffic log: `disable()` can silently truncate the tail.** It writes the footer, then immediately
  `logStream.end()` and `logStream = null`. Any packets still queued in `setImmediate` then hit the null guard
  (`usbTrafficLogger.ts:107,142`) and are **dropped without a word** — and the footer's `Packets Logged: N`
  undercounts to match, so the file looks self-consistent while being short. The end of a session is often the
  interesting part.
  - **Perf risk: LOW** (drain the pending queue before ending the stream; shutdown-path only, not the hot path).

- [ ] **USB traffic log is RX-only in headless mode.** GUI logs transmits (`mainWindow.ts:1466` →
  `logTxData`); `headlessController` owns a *separate* `USBTrafficLogger` and only ever calls `.log()` (RX,
  line 178) — `logTx` is never called in that path. So in headless, the binary download, the DTR reset, and
  everything else host→P2 is absent from the log.
  - **Status: a LIMITATION to document, not necessarily a defect.** For auditing what the P2 *sent*, RX is the
    whole story, which is likely why nobody has missed it.
  - **Perf risk: LOW.** Only revisit if someone actually needs to audit the host→P2 direction headlessly.

- [ ] **Headless debug log does not share the GUI's classification/translation semantics.**
  `headlessController.handleSerialData` does `data.toString('utf-8')` and hands the string straight to
  `headlessFileLogger.logMessage`. There is **no `classifyData`** and **no `formatPSTControlCodes`** in that
  path, and `writeToLog` strips the trailing terminator. Net effect vs the GUI log: no `<CR>`/`<LF>` tags, no
  visible control-code tags, no binary hex-dump, and high/multi-byte sequences are mangled by the UTF-8 decode
  (`usbTrafficLogger.ts:128` carries the warning about exactly this: *use latin1 for 1:1 byte mapping*).
  - **This is probably NOT a bug — the two logs are different products.** The GUI log is a terminal-ish view
    for a *human* who needs to see which control codes their program emitted; the headless log is a clean,
    line-oriented, timestamped transcript for a *machine* to grep, where the terminator is noise once lines
    are split, and where `debug()`'s ASCII output is 1:1 under UTF-8 anyway. **Five to six months of agent use
    supports the current design.**
  - **Consequence for the manual (this part is NOT optional):** the line-ending-translation guarantee is
    **GUI-only** today. Timestamping is universal (verified in both). The manual must state guarantees
    **per log surface** rather than as one blanket promise. *(Documentation requirement, not a code change.)*
  - **Perf risk: REAL if "fixed."** Running `classifyData` + `formatPSTControlCodes` over every headless chunk
    puts per-byte work back on the receive path — precisely the kind of cost the headless design avoids. **Do
    not do this without a demonstrated need**; the only genuine exposure is a headless run of a program that
    emits packed/binary display data, whose log would be mangled rather than hex-dumped.

## Closed Items

- [x] **Single-step debugger: hub heat-map click navigation** (verified implemented 2026-06-06; commit 4a0dc6a) — `DebuggerInteraction.ts:165-181` hit-tests the click against `renderer.hubMapBoundsPx()` *before* the panel loop and sets `state.hubAddr = subBlock * HUB_SUB_BLOCK_SIZE`, matching Pascal `FormMouseDown` InHubMap (`DebuggerUnit.pas` L968). The earlier "display-only / not wired" note was stale. Confirm visually in the §18 hardware walk (Interactive Test Plan Test 8 step 9 / Test 4 step 8).
- [x] **`.p2rec` binary recordings could not be played back** (fixed 0.9.28, #24) — reader read `metadataLength` at byte offset 12 (the high half of the start-timestamp) while the writer puts it at 16; every recorded file failed to play. `binaryPlayer.ts` now reads at 16.
- [x] **SAVE could hang forever on a failed window capture** (fixed 0.9.28, #24) — `captureWindowAsPNG` did not catch a rejected `capturePage()`, leaving the wrapper Promise unresolved. Added `.catch`.
- [x] **Test runner inventory gap (113 missing files)** — substantially closed by #24: runner 70→153 registered, all green; 42 obsolete removed-architecture suites deleted; `debugTermWin` (was 39 failing) is 77/77; the prior "three known failing tests" are resolved (`serialReceiver` deleted, `memoryLeakDetection` finalized, `debugTermWin` green). Residual unregistered files tracked under P3 above.
- [x] **Linux: DTR left in bad state after kill -9** — Consequence of process-not-exiting bug. Fix for P1 item above resolves this (users won't need kill -9 anymore).
- [x] **Headless mode: port-lock between sessions** — Confirmed fixed in v0.9.22 by user testing.
- [x] **Headless mode: line reassembly / timestamp formatting** — Fixed previously (USB chunks reassembled into complete lines).

## Source

User report: "pnut-term-ts v0.9.22 — Electron process not released on Linux" (2026-03-07)
System: Fedora Linux 42, Wayland, Intel Pentium G630, P2 Edge via PropPlug on /dev/ttyUSB0
