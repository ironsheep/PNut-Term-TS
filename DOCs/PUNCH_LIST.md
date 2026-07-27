# Release Punch List

Tracking items that need attention before or shortly after release.

Last swept: **2026-07-27** (v1.0.0 release sweep — the 1.0.0 gate program and every other
confirmed-done item moved to `DOCs/plans/archive/PUNCH-LIST-2026-07-27-archive.md`).

**v1.0.0 is the current release.** The `🚦 GATES 1.0.0` program is complete — G1–G7 all closed — and the
roster, with each gate's closure record, is preserved in that archive. Nothing on this list
gates a release any longer; everything here is post-1.0 work.

---

## Open Items

### P2 - Should Fix

- [ ] **BITMAP sparse rendering model deviation — CONFIRMED real parity gap (audit 2026-06-14); small fix.**
  - `debugBitmapWin.ts:1435` `if (this.state.sparseMode && value === this.state.backgroundColor) { step; continue; }` SKIPS any pixel whose value equals the sparse colour. Pascal draws a bordered dot for *every* sparse pixel (`SmoothShape`, DebugDisplayUnit.pas:2472-2479) → we under-draw. Narrow edge case (only pixels exactly equal to the sparse colour). Fix = remove/relax that skip so those pixels also get the two-layer bordered-dot render.
  - Not exercised by fig-06 (no sparse). **Demo written:** `REF-NO-COMMIT/WIndow ISSUES/fig-12-bitmap-sparse/` (DRAFT, needs compile-check).

- [ ] **LOGIC RANGE bus-waveform rendering — CONFIRMED real parity gap (audit 2026-06-14); needs NEW drawing code.**
  - Parse parity complete (`isRange`/`busWidth` tagged), but the renderer has NO bus path: `drawChannelFromSamples` only draws a 1-bit high/low trace (`invSample = 1 - samples[i]`), so a RANGE bus shows as N stacked 1-bit lines instead of one multi-bit value (bus-band) waveform. Fix = a new bus-waveform draw branch (logic-analyzer bus band with value crossings).
  - Not exercised by fig-06 (single-bit channels only). **Demo written:** `REF-NO-COMMIT/WIndow ISSUES/fig-11-logic-range/` (DRAFT, needs compile-check).

### P3 - Stale-constant debris from the Phase-1 456-byte resize (found 2026-07-27, debugger-arc closeout)

Carried over from `DOCs/plans/archive/CLOSEOUT-2026-07-27-DEBUGGER-ARC.md`. The comms-re-frame
§5 work proved Phase-1 is **456 bytes / 124 hub words** and that **no 416/104 variant exists**;
these are the sites the resize did not sweep. None affects shipped behavior — they mislead the
next reader, which is why they are filed rather than forgotten.

- [ ] **`ENABLE_DEBUGGER_WINDOWS` is a dead feature flag — delete it and both dead branches.**
  Hardcoded `true` since v0.9.26 (`src/utils/context.ts:5`), so neither consumer can ever fire:
  `windowRouter.ts:419` (`!ENABLE_DEBUGGER_WINDOWS && data.length === 416` — dead twice over,
  since the length is never 416 either) and `mainWindow.ts:354`. Per the standing "remove
  controls that don't earn their keep" rule, delete rather than repair.
- [ ] **The Debug Logger's debugger-packet formatter still keys on 416.** `loggerWin.ts:2042`
  (`data.length === 416 ? 40 : data.length`) and `:2089` truncate a debugger packet to its
  40-byte status block — but Phase-1 is 456, so the truncation never triggers and the packet
  would hex-dump in full. Largely unreachable since the §2 wiretap guard
  (`windowRouter.ts:384`), which is why nobody has seen it. Fix the constant and add the test
  that would have caught it.
- [ ] **`DEBUGGER*_416BYTE` enum names are misnomers** (`sharedMessagePool.ts:58-65` plus ~10
  call sites). The values are correct; only the names lie. Cosmetic and repo-wide — do as a
  dedicated mechanical rename, never folded into behavioral work.

### P2 - Single-Step Debugger (ssdbgr) — pre-test audit findings (2026-06-16)

Audited `debugDebuggerWin.ts` message path while sweeping the v0.9.67/.68 serialization fixes across all windows. **VERDICT: the message path is SOUND** — it uses base `updateContent` (single-flight serialization applies) + base `onWindowReady` (the v0.9.68 drain-vs-live fix applies), and its own renderer-readiness buffering is correct (`forwardPhase1/3ToRenderer` push to `pendingPhase1`/`pendingPhase3` when `!rendererReady`, drained in order on renderer `'ready'` at :385-388). No premature-ready packet loss; not vulnerable to either problem we fixed. Items below are cleanup/watch, not blockers.

- [ ] **Remove vestigial dead code (clarity, low-risk).** `deferredMessages` (`debugDebuggerWin.ts:66`) is **write-only**: pushed at :629, reset at :605, **never read**. Its defer branch in `processMessageImmediate` (:625-635) is effectively dead — `componentsReady` is set `true` in the constructor (:96) and only flips `false` in `closeDebugWindow` (:606), so the branch fires only for a message racing window-close (a harmless drop). Also delete the two confirmed-uncalled deprecated methods: `queueInitialMessage` (:150) and `processQueuedMessages` (:159, a no-op). Removing these makes the real readiness logic (`componentsReady` / `rendererReady` buffering) the only thing visible. Risk: touches the debugger file — do before/after the test by preference, not mid-test.
- [ ] **WATCH during testing (protocol note, not a known bug).** `awaitingPhase3` is the one piece of cross-SOURCE shared state — mutated by BOTH the serial-packet path (`processMessageImmediate → handleBinaryMessage`) AND the renderer-reply path (`handleRendererMessage`, :400 set / :413 clear). The Phase1→phase2-reply→Phase3 protocol is inherently sequential so they shouldn't interleave, but if stepping misbehaves under rapid input, this flag is the first place to look.

### P3 - Test hygiene (post-#24 follow-on)

The sequential runner is now **176/176 green** (was 70 of 183 files; 153 at the time this section was written). 42 obsolete suites that imported removed modules were deleted. The following test files remain **unregistered and documented** — none are silent skips of fixable tests, but they are not exercised in CI:

- [ ] **`fftMultipleExecutions` / `fftRealHardwareComparison`** — require P2 capture files (`debug_*.log`, `fft_input_samples.txt`) absent from the repo. Options: commit synthetic equivalent data, or move to an `external-hardware/` gated suite.
- [ ] **`spritedefRealUSB`** — requires an absent USB capture log (`test-results/external-results/usb-traffic_*.log`); graceful-skips when missing.
- [ ] **`memoryLeakDetection`** — 11 tests green; 2 gated with `.skip` due to jest-env timer pollution (the DebugLogicWindow stray-timer fix that likely un-gates these has since landed — re-check whether the `.skip`s can be removed).
- [ ] **`workerExtraction`** — worker-thread integration test that times out under jest (delivery never fires); same class as the registered-but-intermittent `workerSpritedefBug`. Needs a worker-runtime-friendly harness.
- [ ] **`workerSpritedefBug`** — registered but historically an intermittent Docker-saturation flake; passed in the 0.9.28 closeout run. Watch for flakiness.
- [ ] **Runner progress counter** (cosmetic) — `scripts/claude/run_tests_sequentially.sh` prints `[N/70]` with a stale `70` denominator; it actually runs/passes 176. Update the hardcoded total.

### P3 - Documentation

- [ ] **`/DOCs/project-specific` is gitignored** — the §17 refreshes to `ARCHITECTURE.md`, `IMPLEMENTATION-STATUS.md`, and `TEST-STATUS.md` exist only in the local working copy and are NOT in the repo (only `TECHNICAL-DEBT.md` is tracked there). Decide whether these spec docs should be tracked; if so, un-ignore and commit them.

### P3 - Nice to Have / Future

- [ ] **Headless mode: debug() output end-marker matching** — User report suggested it doesn't work, but our line reassembly fix should handle it. Need to verify with actual debug() program on hardware.
- [ ] **GUI: "binary data 5 bytes" display** — User reported seeing raw binary instead of decoded debug text. Needs reproduction with logs to determine if routing/classification issue.

- [ ] **Shared `SmoothShape` rounded-shape utility (refactor opportunity)** — Pascal's `SmoothShape` (anti-aliased rounded rect/ellipse) is reimplemented ad-hoc via `Canvas2D roundRect + fill/stroke` in at least four places: `debugPlotWin.ts:2544`, `debugScopeXyWin.ts:1424`, `debugBitmapWin.ts:1472`, and (added by the SSDB Visual Parity sprint) `DebuggerRenderer.ts` `drawBox`. No shared helper exists. Opportunity to extract a single shared `smoothShape()` util (e.g. into `src/classes/shared/`) and refactor these windows onto it. Deferred from the SSDB Visual Parity sprint (kept local per final-release surgical posture); broad re-test surface → do as a dedicated refactor. (Raised by Stephen 2026-06-20.)

- [ ] **SSDB `contextmenu` keyboard/touch-trigger guard — conditional, only if we find a need.** The Test-4 macOS right-click fix routes the secondary click through the canvas `contextmenu` event (`DebuggerInteraction.ts` listener-install block) and dispatches it as a right-click at `e.clientX/clientY`. `contextmenu` can *also* be raised by the keyboard "menu/apps" key or a touch long-press, where the coords may be `(0,0)` (or the element origin) rather than a real pointer position — that would dispatch a spurious right-click against whatever panel sits at the top-left corner. **Not observed; extremely rare on a mouse-driven debug tool, so left unguarded by design.** If it ever manifests, fix = in the `contextmenu` handler, ignore events not originating from a real pointer (e.g. guard on a tracked last-pointer position, or skip when `clientX===0 && clientY===0` with no preceding `mousemove`). (Raised 2026-06-29 during the Test-4 cross-platform review.)
- [ ] **Verify SSDB interrupt event-bit offsets** — `DebuggerRenderer.renderInterrupts` extracts the INT1/2/3 *event* nibble at bits 8/12/16 of `message[1]`, but Pascal `DrawInt` (DebuggerUnit.pas:2275) reads it at `mBRKCZ >> (int<<2 + 4)` = bits 4/8/12 — a 4-bit difference. Status bits (0/2/4) match Pascal. May be a real decoding bug OR our `message[1]` packing differs from Pascal `mBRKCZ`. Doesn't manifest while interrupts are off (test06). Verify the message-word layout against Pascal and correct if our offsets are wrong. (Surfaced during sprint task #53, 2026-06-20.)

### P3 - Window placement: a global display-origin parameter (the `DEBUG_DISPLAY_LEFT`/`TOP` gap)

*Background — G6, closed: `POS` is effectively absolute in normal PNut use and term-ts
already matches; our non-overlapping auto-layout is an adjudicated intentional feature. Both
records are in the 2026-07-27 archive. One **standing doc rule** survives from that
adjudication and is not archived because it constrains all future writing:* **auto-layout is
a PNut-Term-TS feature and must never be published as DEBUG-language or chip behavior.**

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
