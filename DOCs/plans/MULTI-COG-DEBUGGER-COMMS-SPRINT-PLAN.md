# Multi-Cog Single-Step Debugger Comms — Sprint Plan

**Status:** STARTED (sprint-start run). Ships as build **0.9.89** (rightmost-digit increment
of 0.9.88, per Stephen's standing convention; single ship for the whole sprint).
**Working-tree audit (sprint-start §2):** no uncommitted edits to any sprint-target source;
only docs (this plan + test-plan corrections) and `.bin` test-compile residue are uncommitted
— clean foundation. Foundation-commit decision recorded below.
**Acceptance gate:** `test12_multicog` on real P2 hardware → **both** "Debugger - Cog 0"
and "Debugger - Cog 1" windows open and step independently.
**Sprint spine — two certification passes:** (1) build §2-§9 and **certify on HW** (Pass 1,
gates cleanup) → (2) **§10** remove the inert/dead code the sprint obsoletes → (3) **certify
again on HW** (Pass 2, §11, the true exit). Removal happens only against a certified baseline,
and is proven safe only by a second full certification.
**Spec authority:** Pascal `DebugUnit.pas ChrIn` (:177-194) + `DebuggerUnit.pas`
(`DebuggerForm[]`, `Breakpoint`). TS-side spec: `DOCs/project-specific/ARCHITECTURE.md`.

---

## 0. Problem, baseline, constraints

**Problem (confirmed on HW, v0.9.88, log `debug_260706-134258.log`):** a second cog that
hits a debug break never gets its own window. Running Cog 0 to the `cogspin` DID launch
Cog 1 (`Cog1 INIT …` demuxed), but Cog 1's break traffic funneled into Cog 0's controller
and mis-attributed (Cog 0's PC jumped around). Multi-cog single-step debugging is not
supported by the v0.9.80 single-owner comms model.

**Root cause:** `extractionCore.ts:222` `debuggerTransactionCog: number | null` tracks **one**
debugging cog. On the first Phase-1 (`extractionCore.ts:813`) the worker opens that cog's
transaction and thereafter raw-drains **every** byte to it (`extractionCore.ts:734-760`),
tagged `DEBUGGER{first}_PHASE3`. It never re-classifies a second cog's Phase-1, so
`debuggerPacketReceived` never fires for Cog 1 (`mainWindow.ts:331,355`) and no window is
created.

**Entry baseline (measured at sprint-start 2026-07-06):** build **clean** (`npm run build`
exit 0; `tsc` 0 warnings; the lone esbuild `direct-eval` notice on `mainWindow.ts:14` is an
intentional, load-bearing build-tool warning — electron-import pattern — pre-existing, not a
blocker per the baseline-health overlay). Full suite **157/157 green** via
`scripts/claude/run_tests_sequentially.sh` (161 files = 157 registered + 4
excluded-with-reason; 0 stray skips; runner covers 159/161 — the overlay's "~70" note is
stale). Single-cog debugger Tests 0-11 HW-validated through v0.9.88. **No failure groups — the
exit baseline (both certification passes) must hold 157/157 + clean build.** Foundation commit
`47f8ad4`; stale v0.9.80 tasks #60-#65 archived; todo backup `project_dump_20260706_204647.json`.

**Constraints (non-negotiable):**
- **No regression to single-cog debugging** (Tests 0-11) — the one-cog path is the common case.
- **No regression to the 2 Mbaud streaming classifier** (#31) — debug framing is a separate
  branch and must stay isolated from high-throughput text/binary extraction.
- **No new per-break work on the Electron main loop.** The 2 Mbaud arc offloaded serial to
  the worker UtilityProcess (#31) and time-sliced main (v0.9.43) to keep it responsive; the
  new stateful framing runs **in the worker**, not main.

---

## 1. Architecture (confirmed with Stephen)

**Model: worker-hosted central demux + per-cog renderer controllers — the Pascal shape.**
The worker's byte-stream demux **is** `ChrIn` (one place reads the cog-ID at each break
boundary and routes); the per-cog renderer controllers **are** `DebuggerForm[]`. The P2
holds `lock[15]` for each break, so exchanges are **atomic per cog — never byte-interleaved**
(`DebugUnit.pas`, and `extractionCore.ts:212-214`); the demux therefore only ever has one
cog's exchange in flight at a time.

**The framing-vs-display-state constraint (why the worker needs one hint).** Phase-3 length
= `changedCogBlocks·64 + changedHubBlocks·64 + (disasm?64:0) + 170 fixed + smart-pin tail`.
The `disasm?64` term depends on the renderer's `disMode` (`computeHubCodeRequest`,
`DebuggerController.ts:582-590`) — user-interaction state that lives only in the renderer.
So the worker **cannot** compute Phase-3 size purely on its own.

**Resolution (keeps main free, no duplicated logic):** the renderer already computes the
exact fixed size (`expectedPhase3Fixed`, `DebuggerController.ts:480`) when it builds Phase-2.
It sends that **single integer** to the worker as a per-break hint. The worker buffers the
cog's Phase-3 and delimits `fixed(from hint) + smart-pin-tail`, where the tail
(`8 + 4·popcount` of the 8 mask bytes) is self-describing and the worker peeks it directly.
- No `disMode` logic in the worker; no duplicated checksum/sizing state.
- No race: the worker buffers the cog's bytes until the hint arrives; the hint path
  (renderer→main→worker) has no hardware round-trip, so it beats the P2's Phase-3 response.
  If the hint or bytes stall, a worker-side timeout aborts and resyncs (§2).
- Main only **relays** the hint (a tiny message) and creates windows as it already does —
  **zero new per-break work on the main loop.**

**Alternatives considered & rejected:** (A) worker self-computes size — impossible, needs
`disMode`. (B) move the whole controller to main — big, inverts §3, needs per-break
display-state IPC, and still needs `disMode`. (C) first renderer frames all and fans out
foreign breaks — asymmetric and fragile (breaks if window 0 closes).

**Already-safe surfaces (verified in research, not rebuilt here):** the Phase-2/host→P2 path
is per-window isolated and multi-cog-safe today — each window has its own `event.sender.id`-
filtered IPC listener (`debugDebuggerWin.ts:376`), its own `tLongTransmitter`, and correctly
shares the one serial port; COGBRK broadcast already fans out to all windows
(`mainWindow.ts:365`). Per-cog window **creation** is already cog-agnostic
(`mainWindow.ts:355` `new DebugDebuggerWindow(ctx, cogId)`), and the `DEBUGGER0..7_416BYTE`
(=10..16) / `DEBUGGER0..7_PHASE3` (=30..37) types + `debugger-${cogId}` routing already exist
(`sharedMessagePool.ts:65,90-97`; `windowRouter.ts:301-380`). These sections **verify + guard**
these surfaces rather than change them.

---

## 2. Worker — per-cog demux / framing state machine (CORE)

**Why:** the single change that closes the gap. Replace the one-cog transaction with a
per-cog framer that delimits each break exactly and tags it with the correct cog-ID.

**Current code:** `extractionCore.ts` — single `debuggerTransactionCog` (:222), opened at
:813, drained at :734-760; `onPhase3Done()` (:268) closes only at DTR reset
(`mainWindow.ts:411`). Phase-1 boundary detection `find416ByteBoundary` (:541-590, validates
byte0 ∈ 0x00-0x07 and bytes1-3 == 0). Type derivation `classifyMessage` (:625).

**Target behavior — a small per-cog state machine in the worker:**
- **State:** `awaitingPhase1` (default) or `awaitingPhase3{cogId, fixedSize|null, buffer}`.
- **On `awaitingPhase1`:** run the existing text/DB/Phase-1 boundary detection. Interleaved
  terminal text (the `Cog0/Cog1 INIT … ` ROM lines) is peeled/routed as today. On a Phase-1
  (any cog-ID `N` via `find416ByteBoundary`), emit `DEBUGGER{N}_416BYTE` (drives window
  creation + routes the Phase-1 to renderer `N`), then transition to
  `awaitingPhase3{cogId:N, fixedSize:null}`.
- **On `awaitingPhase3`:** accumulate incoming bytes into the cog's buffer (do NOT run
  Phase-1 detection — bytes are this cog's Phase-3, guaranteed by atomic exchanges). When
  the renderer's `fixedSize` hint (§3) for cog `N` has been received AND
  `buffer.length ≥ fixedSize + 8`: read the 8 smart-pin mask bytes at `offset=fixedSize`,
  `tail = 8 + 4·popcount(masks)`, `total = fixedSize + tail`; once `buffer.length ≥ total`,
  emit `total` bytes as `DEBUGGER{N}_PHASE3`, drop them from the buffer, and transition back
  to `awaitingPhase1` (any buffered remainder is the next exchange's Phase-1 / interleaved
  text — re-run detection on it).
- Delete the single `debuggerTransactionCog`; keep `onClear()`/DTR-reset clearing **all**
  per-cog state.

**Integration points:** `extractionCore.ts` (the `extractMessages` loop :727-817, the drain
branch, the boundary detectors); `classifyMessage`/type derivation; the worker IPC surface in
`extractionWorker.ts` + `workerExtractor.ts` + `serialMessageProcessor.ts` (new inbound
`debuggerPhase3Size` control message — see §3).

**Verification:**
- *Normal:* replay a synthetic `[cog0 p1][cog0 p3][cog1 p1][cog1 p3][cog0 p1][cog0 p3]` stream
  (§7) → worker emits `DEBUGGER0_416, DEBUGGER0_PHASE3, DEBUGGER1_416, DEBUGGER1_PHASE3,
  DEBUGGER0_416, DEBUGGER0_PHASE3` with byte-exact Phase-3 sizes and zero cross-tagging.
- *Edge:* Phase-3 with 0 changed blocks (fixed 170 + tail only); a break whose tail has
  several set smart-pin mask bits (variable tail); a chunk boundary that splits
  `[p3 tail][next p1]` — worker delimits Phase-3 exactly and re-detects the next Phase-1.
- *Error:* hint never arrives / Phase-3 stalls mid-buffer → §2-timeout aborts and resyncs
  to `awaitingPhase1` (proven by a truncated fixture); a single-cog stream is unchanged
  (Tests 0-11 regression fixtures still pass byte-for-byte).

---

## 3. Renderer — emit the Phase-3 fixed-size hint; shed cross-break framing

**Why:** give the worker the one display-dependent number it needs, and stop the renderer
from being a second framing owner (the worker now delimits).

**Current code:** `DebuggerController.buildPhase2` computes `this.expectedPhase3Fixed`
(:480) and `pendingHubCode` (:511); the renderer re-frames the raw stream in `driveFrames`
(:180-228) with `looksLikePhase1`/`peelInterleavedText`/`leftover`. Renderer→main IPC is
wired in `debugger/renderer/index.ts:49-55` (`sendPhase2`, `onPhase3Complete`).

**Target behavior:**
- When Phase-2 is built, emit `{ kind: 'phase3Size', cogId, size: expectedPhase3Fixed }` to
  main (which relays to the worker). One tiny message per break, alongside `sendPhase2`.
- The renderer now receives exactly one cog-clean Phase-3 per `DEBUGGER{N}_PHASE3` delivery,
  so its cross-break re-framing (`driveFrames` leftover/`looksLikePhase1`/text-peel) is dead
  weight. **Decision (surgical):** keep `processPhase1`/`processPhase3`/the Phase-3 parser as
  the display path; the leftover-reframing simply never triggers on clean input, so we may
  leave it inert rather than rip it out — *unless* review shows it can mis-fire on a clean
  single-break delivery, in which case it is removed. Confirm during implementation.

**Integration points:** `DebuggerController.buildPhase2` (emit the hint via a new callback);
`debugger/renderer/index.ts` (wire the callback → `sendToMain`); `debugger/shared/ipc.ts`
(new `RendererToMain` message kind); `debugDebuggerWin.ts` (forward it to the worker).

**Verification:**
- *Normal:* each break emits exactly one `phase3Size` matching the worker's delimit.
- *Edge:* `disMode = dmCog/dmHub` (disasm requested) → hint includes the +64; `dmPC` with
  `pc < 0x400` (cog-exec, no disasm) → hint omits it; the worker frames both correctly.
- *Error:* a renderer that never sends the hint (simulated) → worker §2-timeout recovers.

---

## 4. Main — relay the hint; verify per-cog isolation & COGBRK

**Why:** main is a pure router here; the work is *wiring the relay* and *proving isolation*.

**Current code:** window creation `mainWindow.ts:331-389` (already per-cog); COGBRK broadcast
`mainWindow.ts:365-370`; DTR reset `resetAllDebuggers` :406-415.

**Target behavior:**
- Relay `phase3Size` from a debugger window's renderer to the worker
  (`serialProcessor.signalDebuggerPhase3Size(cogId, size)` → `workerExtractor` → worker), with
  **no framing/parsing on the main thread** — a pure forward.
- Verify (and add guards/tests, not new behavior): two windows (Cog 0, Cog 1) each keep
  fully independent `DebuggerController` state — no shared/last-wins references; COGBRK
  clicked in one window reaches every open debugger and only the intended cog acts;
  `resetAllDebuggers` clears all per-cog worker state (§2) and every window.

**Verification:**
- *Normal:* Cog 0 and Cog 1 windows open; stepping one does not advance the other.
- *Edge:* closing the Cog 1 window mid-session (worker still frames Cog 0 cleanly; a later
  Cog 1 break re-creates its window); COGBRK from Cog 1's window halts Cog 0.
- *Error:* DTR reset with two live windows → both reset, worker returns to `awaitingPhase1`.

---

## 5. Phase-2 / host→P2 path — verify multi-cog-safe (no change expected)

**Why:** research shows this path is already per-window isolated; this section *locks that in*
with a test so a future change can't silently break it.

**Current code:** `DebuggerController.sendPhase2` → `index.ts:50` → IPC → per-window listener
filtered by `event.sender.id` (`debugDebuggerWin.ts:376`) → per-window `tLongTransmitter`
(`debugWindowBase.ts:240`) → shared `mainWindow.sendSerialData` (:1434-1462) → one serial port.

**Target behavior:** unchanged. Add a regression test asserting two windows' Phase-2 replies
both reach the serial-send with the correct bytes and neither listener consumes the other's.

**Verification:** *Normal:* both replies transmitted. *Edge:* replies queued ~1 ms apart stay
ordered. *Error:* a closed window's listener does not receive/throw on the other's Phase-2.

---

## 6. `test12` — rewrite as PASM (fast, deterministic gate)

**Why:** `test12` is the only Spin2 program in the suite; single-stepping the interpreter to
reach the `cogspin` is impractical (this sprint's whole diagnosis). A PASM program that
`COGINIT`s Cog 1 as an early instruction makes it a 1–2-step gate like tests 1-11.

**Current code:** `DOCs/pascal-REF/SingleStep-Debugger-Test-Programs/test12_multicog.spin2`
(Spin2 `cogspin`). Two copies exist (root + `dmg-assets/…`); update both.

**Target behavior:** PASM `DAT org`; Cog 0 `COGINIT`s Cog 1 (running a small PASM loop in hub)
near the top; both set `DEBUG_MAIN=1`/`DEBUG_COGINIT=1`. Stepping Cog 0 past the `COGINIT`
launches Cog 1 → Cog 1 breaks → its window opens. Verify the PASM against the P2 KB
(COGINIT + hub-loaded cog code) before compiling with `pnut-ts -d`.

**Verification:** *Normal:* compiles clean; on HW, ≤2 steps of Cog 0 opens the Cog 1 window.
*Edge:* Cog 1's own loop steps independently in its window. *Error:* n/a (test asset). Update
the plan doc §Test 12 steps to match the PASM flow.

---

## 7. Regression — 2-cog replay fixture + harness tests

**Why:** the only way to guard multi-cog in-container (no HW in CI). Must drive the **worker**
path (where the fix lives), not the controller directly.

**Current code:** `tests/shared/debuggerReplay.ts` (`runReplay`: `ExtractionCore` →
`WindowRouter` → per-cog `DebuggerController`); `tests/shared/debuggerFixture.ts`
(`buildPhase1Packet({longs:{[MSG.COGN]:cogId}})`, `buildPhase3Packet`);
`tests/fixtures/debugger/` (capture.bin + manifest); existing `cog2DebugLoggerRouting.test.ts`
to model routing assertions on.

**Target behavior:** a **synthetic** two-cog fixture (committed): atomic, sequential
exchanges `[cog0 p1][cog0 p3][cog1 p1][cog1 p3][cog0 p1]…` built from the fixture helpers,
plus a manifest of chunk lengths that also exercise a `[p3 tail][next p1]` split boundary. The
replay must supply the per-break `phase3Size` hint (§3) into the worker so the delimiter runs.
Add a reusable helper in `tests/shared/` to concat per-cog frames + emit the manifest (shared
test scaffolding, not inlined). Register the new test in
`scripts/claude/run_tests_sequentially.sh` and the coverage gate.

**Verification:** *Normal:* 3 exchanges across 2 cogs → per-cog windows each receive only
their own breaks, byte-exact, zero cross-tag. *Edge:* the split-boundary chunk reassembles; a
break with a multi-bit smart-pin tail sizes correctly. *Error:* a truncated cog-1 Phase-3 →
worker timeout/recovery, and the *next* clean exchange frames (no wedge); the existing
single-cog capture fixture still passes unchanged (proves no single-cog regression).

---

## 8. Non-regression — streaming classifier & main-loop responsiveness

**Why:** explicit guardrails for the two things most at risk.

**Target behavior / verification:**
- *Streaming classifier:* the worker's debug-framing branch is entered only for a debug
  session; assert the 2 Mbaud text/binary extraction path is byte-identical with the change
  (run the existing streaming/classifier suites; they must stay green). No debug state touches
  the streaming classifier.
- *Main-loop responsiveness:* prove main gains **no** per-break framing — the only new main
  code is the `phase3Size` relay (a forward). Document that all stateful framing is in the
  worker process. (No perf test asset exists; the guardrail is code-review + the explicit
  "no framing on main" acceptance in §2/§4.)

---

## 9. Docs — ARCHITECTURE.md debugger-routing section

**Why:** the spec must describe the shipped behavior; the v0.9.80 write-up says single-owner-
one-cog.

**Target behavior:** update `DOCs/project-specific/ARCHITECTURE.md` debugger-routing section:
worker-hosted per-cog demux (the `ChrIn` analog) + per-cog renderer controllers (the
`DebuggerForm[]` analog) + the per-break `phase3Size` hint mechanism and why it exists
(display-dependent disasm term). Note the atomic-per-cog (`lock[15]`) guarantee the design
relies on. CHANGELOG v-entry is authored at release via `build-wrapup` in P2-developer voice
("the single-step debugger now opens a window per cog and steps each independently").

**Verification:** spec describes the shipped path; no sprint-changed code path undocumented.

---

## 10. Final phase — remove inert / dead code (POST-CERTIFICATION)

**Why:** the demux relocation renders several code paths dead. Left in place they become a
standing distraction — every future bug hunt or feature has to re-establish whether a
"single-owner re-framer" that no longer frames anything is live. Removing them is real
maintenance value. This is deliberately the **last** phase, gated on certification, so we
never delete something still load-bearing and every removal is re-verified against a
known-good baseline (technical-climbing: protection before you touch working code).

**GATE (hard) — Certification Pass 1 must be complete:** do NOT start §10 until the acceptance
gate is met — `test12` passes on real P2 hardware (both cog windows open + step
independently), single-cog Tests 0-11 re-verified, and the full suite green. §10 changes are
pure removals against that certified baseline. (This is the first of **two** certification
passes — see §11.)

**In scope — only what THIS sprint renders dead (not a codebase-wide dead-code hunt):**
- The renderer's now-redundant cross-break re-framing left inert by §3 — `driveFrames`
  leftover/`looksLikePhase1`/`peelInterleavedText`/the §4 new-Phase-1 escape in
  `DebuggerController.ts` — now that the worker delimits each break, the renderer receives one
  clean Phase-3 per delivery. Remove the dead branches; keep `processPhase1`/`processPhase3`/
  the display path.
- Any remnants of the single `debuggerTransactionCog` model superseded by §2 (stale comments,
  the DTR-only `onPhase3Done` semantics if the per-cog reset replaces it).
- Any bring-up diagnostics added during §2-§7 (per-cog `[CTRL]`/worker trace logs) —
  disabled/removed per the project's diagnostic-logging strategy once the window is complete.
- Stale doc/comment references to "single owner / one cog" superseded by §9.

**Explicitly OUT of scope:** unrelated dead code elsewhere in the tree — a broader sweep is a
separate future effort.

**Verification (in-phase):** after **each** removal, re-run the affected suites + the §7 2-cog
replay, and confirm the single-cog regression fixtures stay byte-identical. Because §10 is
removals-only against a certified baseline, any red is an unambiguous "this was still live —
revert that removal," never "did I break the feature." When all removals are in and the suite
is green, hand off to §11 for the final certification.

---

## 11. Certification Pass 2 — sprint exit (POST-CLEANUP, ON HARDWARE)

**Why:** "dead" is a hypothesis until hardware proves the feature still works without it.
Removing code — even provably-inert code — can have subtle effects, so the sprint is not done
until we re-run the **full** certification against the post-cleanup binary. This is the true
sprint exit.

**The two-pass structure (the sprint's spine):**
1. **Pass 1** — after §2-§9 land: build it and certify it works (the §10 gate).
2. **§10** — remove the inert/dead code the sprint obsoleted.
3. **Pass 2 (this section)** — certify *again* to prove the removal didn't damage what we built.

**Exit criteria (identical rigor to Pass 1, on the cleaned binary):**
- `test12_multicog` on real P2 hardware: both "Debugger - Cog 0" and "Debugger - Cog 1"
  windows open and step independently (the acceptance gate).
- Single-cog debugger **Tests 0-11 re-verified on hardware** — no regression from the cleanup.
- Full suite green via `scripts/claude/run_tests_sequentially.sh` (incl. the §7 2-cog replay).

**If Pass 2 finds any regression:** the cleanup removed something still live — revert the
specific removal (the diff since Pass 1 is removals-only, so the culprit is unambiguous),
re-verify, and re-run Pass 2. The sprint closes only on a clean Pass 2.

---

## § Open Questions

None. (The former "remove vs leave-inert the renderer re-framing" question is resolved by
sequencing: **leave inert through certification (§3), remove in the post-certification cleanup
phase (§10).**)
