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

### P3 - Measure the real throughput ceiling per platform (raised 2026-08-22, baud-naming sprint)

**Not release-gating. v1.0.2 ships without this** — Stephen's call, 2026-08-22. The product is
correct as it stands; this closes a *knowledge* gap, not a defect.

- [ ] **Build the throughput rig and set `MAX_VALIDATED_BAUD` from measured data.**

  **What we know today.** The only hardware-measured sustained figure is **2 Mbaud** (v0.11.7:
  161,252 sequence-numbered lines, zero gaps, 0.6-1.9% of a core). `MAX_VALIDATED_BAUD` in
  `src/utils/p2DebugHeader.ts` is set from exactly that run, and `--baud` above it warns that
  behavior is UNMEASURED — deliberately NOT that data will drop, because nobody has run the
  experiment in either direction.

  **What is NOT evidence** (do not promote any of these into the constant):
  - `CRITICAL_FIXES_DETAILED_EXPLANATION.md:486` "Potential for 2.5-3 Mbps with minor tuning" —
    the closing line of a CPU-budget arithmetic block, a projection.
  - `usb-performance-investigation/README.md:117` "3-5 Mbps capability" — the predicted *result*
    of Phase 2 work, and :127 "5-10 Mbps" is labelled theoretical in the doc itself.
  - `IMPLEMENTATION_NOTES.md:5505` "Max sustained rate: 16 Mbps" — **wrong**, sits two lines from
    "CPU: ~5% at 2 Mbps" and is contradicted by the investigation's own "~2 Mbps". Correct it.

  **Why it needs its own rig, not the DEBUG path.** We control both ends, so we can measure
  instead of infer: a purpose-built P2 generator + host harness with structured packets removes
  every debug-ROM constraint and yields exact loss rather than an inference from a gap in a log.

  **Design agreed 2026-08-22** (build to this; do not re-derive):
  - **TWO numbers, and the gap between them is the actionable part.** (1) *Transport ceiling* — a
    minimal Node reader over the same `serialport` stack that only counts bytes, i.e. what the
    platform can do with our pipeline absent. (2) *App ceiling* — the same stream through
    PNut-Term-TS end to end. Close together = platform-bound, optimizing us is wasted; far apart
    = our code, and worth work. Today we cannot tell those apart, which is how both "16 Mbps" and
    "~2 Mbps" ended up in the docs.
  - **Frame**: fixed 256 bytes — magic(4) | seq(4) | rateId(2) | payload(242, PRNG seeded from
    seq) | CRC32(4). The seeded payload is load-bearing: without it a torn read that substitutes
    bytes is indistinguishable from a clean one. CRC + derivable payload separates DROPPED,
    CORRUPTED and REORDERED — three failure modes with three different fixes.
  - **Sweep**: P2-driven, one-way, no bidirectional timing to get wrong. Idle at 115200 (safe on
    every platform per our own open-at-115200-first workarounds), announce `RATE <n> BEGIN` in
    ASCII at the base rate, idle ~100 ms as a clean seam, switch the TX smart pin, stream N
    frames, drop back and report `RATE <n> SENT <count>`. The host compares its intact count
    against the P2's SENT count, so we never trust the host's idea of what *should* have arrived.
  - **Bisect, don't ladder** — coarse walk up until loss goes non-zero, then bisect. Bench time on
    three machines is the scarce resource.
  - **Two axes beyond rate, and these are the ones that will surprise us**: (a) RENDER LOAD — the
    [#30] finding was that loss appeared under render pressure, not on a quiet line, so every rate
    needs a quiet pass and a loaded pass and the delta is the result; (b) CONSUMER SHAPE — headless
    (pure pipe) and GUI-with-windows-open are different ceilings, and **the GUI number is the one
    that belongs in `MAX_VALIDATED_BAUD`**, because that is what a user runs.
  - **Duration**: long enough to be *sustained*. Cautionary precedent in
    `DOCs/pascal-REF/Throughput-Test-Programs/stress01_stream.spin2` — its first version streamed
    200,000 lines and left the app chewing a ~4 minute backlog, which measures the backlog, not
    the rate.

  **Platforms**: macOS, Linux, Windows x64 AND Windows ARM64 — the last two separately, since
  macOS and Windows ARM64 are the ones that cannot open above 230400 directly
  (`usb.serial.ts:146` opens at 115200 first) and Windows needed a wholly different transport.
  A single hard cap would be wrong on at least one of them; that is why the current behavior
  warns rather than refuses.

  **Container work vs bench work**: both halves of the rig (the `.spin2` generator compiled with
  `pnut-ts -d`, the Node harness, the analysis script) can be built in the container. Only the
  running needs hardware. Run it as its own session — do NOT bolt it onto the SSDB
  re-certification session, which is already loaded.

  **Done means**: one table per platform (rate → sent → intact → loss % → corrupted-vs-dropped,
  quiet and loaded); `MAX_VALIDATED_BAUD` reset from the measured GUI number with the run cited in
  its comment; the warning text revisited if the data shows a real cliff; and the three stale
  figures above corrected in the docs.

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

### ✅ Single-Step Debugger input parity (SSDB input-parity sprint, v1.0.1, 2026-08-12)

Registered here for the next sweep. All sixteen live findings of
`DOCs/SSDB-INPUT-PARITY-AUDIT-2026-08-12.md` Part B are **closed in code and tests**
(commits `9da7e46`, `7a5b0a0`); F10 was withdrawn as a false finding. Documentation is
reconciled: the manual source, the Theory of Operations §8.3, the superseded 2026-05-31
operation guide, the audit's own Part B, and the changelog.

**Still open in this sprint:** hardware re-certification against Interactive Test Plan v2
(«#97») — Tests 0–14 in full, because the address-model change touches the Phase-2 window
request, plus the new Phase D input-command exercises. v1.0.1 is not clear to tag until
that passes.

This also retires the "hub-heatmap click is not yet wired" note that survived in the manual
source long after the click shipped (2026-06-03).

### P3 - Documentation-drift instrument findings (first run, 2026-08-12)

The project now has a `DOC_AUDIT_COMMAND` (`scripts/claude/check_doc_claims.sh` +
`check_doc_counts.sh`, advisory, never a build gate). Fixed on the first run: the
`12 window types` claim in `DOCs/IMPLEMENTATION_NOTES.md` (actual: 11 — 9 displays, the
debugger, the logger), and the stale handoff snapshot of the interactive test plan, which
now names its canonical source. Left open, both low-risk DUPLICATE findings:

- [ ] **The hub-dump and pin-row sample layouts are maintained in two SSDB documents** —
  `DOCs/manual-source/SINGLE-STEP-DEBUGGER-MANUAL-SOURCE.md:368,392` and
  `DOCs/pascal-REF/SingleStep-Debugger-Theory-of-Operations.md:884,911`. One canonical copy
  with a link from the other; do not "keep them aligned".
- [ ] **Shared Pascal procedure excerpts are duplicated across the per-window theory-of-
  operations documents** (`RateCycle` in six places, `SmoothDot`/`NewPack`/`SetTextMetrics`
  in three each). Deliberate self-containment, but worth a shared "common procedures"
  section if those docs are ever revised.
- [ ] **~15 ORPHAN candidates remain**, mostly Pascal identifiers (`TA_LEFT`) quoted in the
  reference docs, which are not our strings. Either accept them as expected noise or teach
  the instrument to skip Pascal-identifier spans in `DOCs/pascal-REF/`.

### P2 - Single-Step Debugger (ssdbgr) — pre-test audit findings (2026-06-16)

Audited `debugDebuggerWin.ts` message path while sweeping the v0.9.67/.68 serialization fixes across all windows. **VERDICT: the message path is SOUND** — it uses base `updateContent` (single-flight serialization applies) + base `onWindowReady` (the v0.9.68 drain-vs-live fix applies), and its own renderer-readiness buffering is correct (`forwardPhase1/3ToRenderer` push to `pendingPhase1`/`pendingPhase3` when `!rendererReady`, drained in order on renderer `'ready'` at :385-388). No premature-ready packet loss; not vulnerable to either problem we fixed. Items below are cleanup/watch, not blockers.

- [ ] **Remove vestigial dead code (clarity, low-risk).** `deferredMessages` (`debugDebuggerWin.ts:66`) is **write-only**: pushed at :629, reset at :605, **never read**. Its defer branch in `processMessageImmediate` (:625-635) is effectively dead — `componentsReady` is set `true` in the constructor (:96) and only flips `false` in `closeDebugWindow` (:606), so the branch fires only for a message racing window-close (a harmless drop). Also delete the two confirmed-uncalled deprecated methods: `queueInitialMessage` (:150) and `processQueuedMessages` (:159, a no-op). Removing these makes the real readiness logic (`componentsReady` / `rendererReady` buffering) the only thing visible. Risk: touches the debugger file — do before/after the test by preference, not mid-test.
- [ ] **WATCH during testing (protocol note, not a known bug).** `awaitingPhase3` is the one piece of cross-SOURCE shared state — mutated by BOTH the serial-packet path (`processMessageImmediate → handleBinaryMessage`) AND the renderer-reply path (`handleRendererMessage`, :400 set / :413 clear). The Phase1→phase2-reply→Phase3 protocol is inherently sequential so they shouldn't interleave, but if stepping misbehaves under rapid input, this flag is the first place to look.

### P3 - Test hygiene (post-#24 follow-on)

The sequential runner is **176/176 green** (was 70 of 183 files when this section was written).
42 obsolete suites that imported removed modules were deleted. Four test files remain
**excluded with a documented reason** in `scripts/claude/check_test_coverage.sh` — the gate
enforces that every present file is either registered or excluded, so these cannot rot
silently. They are still not exercised in CI, which is what keeps them on this list:

- [ ] **`fftMultipleExecutions` / `fftRealHardwareComparison`** — require P2 capture files (`debug_*.log`, `fft_input_samples.txt`) absent from the repo. Options: commit synthetic equivalent data, or move to an `external-hardware/` gated suite.
- [ ] **`spritedefRealUSB`** — requires an absent USB capture log (`test-results/external-results/usb-traffic_*.log`); graceful-skips when missing.
- [ ] **`memoryLeakDetection`** — excluded (env-only: asserts on real GC / wall-clock heap
  growth). 11 tests green; 2 gated with `.skip` (`tests/memoryLeakDetection.test.ts:646,666`) due to jest-env timer pollution (the DebugLogicWindow stray-timer fix that likely un-gates these has since landed — re-check whether the `.skip`s can be removed).

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
