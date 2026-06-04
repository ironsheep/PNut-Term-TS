# Nine-Window Debug-DISPLAY Parity — Fix Sprint Plan (Phase B)

> **Type:** Sprint plan (ships code). Home: `DOCs/plans/`.
> **Backing study:** `DOCs/investigations/NINE-WINDOW-PARITY-AUDIT-PHASE-A.md` (Phase A cold audit).
> **Spec authority:** PNut **v55** `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas`;
> Pascal-side inventory `DOCs/pascal-REF/DEBUG-WINDOW-DIRECTIVE-MATRIX.md`.
> **Branch:** `main` (no feature branch — [[feedback_no-feature-branches]]).
> **Scope decisions (Stephen, 2026-06-04):** cover **all severities**, all 9 windows;
> fix shared roots at the **base/shared code** (accept the wider regression run);
> **add unit tests as a first-class deliverable** for every section whose logic is
> unit-testable; **no hardware-testing gates between steps** — implement every feature
> end-to-end, then do ONE whole-application test pass (HW + visual parity) at the end.
> **Goal:** 100% functional parity, every directive + parameter variant, per
> `window-porting` sign-off. Pascal is the spec; every divergence found is an
> IMPL-BUG or TS over-acceptance — no Pascal source-quirk is in play.

## Sprint start (2026-06-04)

- **Build number:** `0.9.27` (bumped rightmost digit from 0.9.26; `package.json`).
- **Working-tree audit:** clean — fully committed, no untracked source in the blast
  radius (`src/`, `tests/`, `scripts/`, `DOCs/`). Protection point confirmed.
- **Backup:** `tasks/backups/project_dump_20260604_063156.json` (tasks + context).
- **Tracking-readiness:** READY — 0 context keys, MEMORY.md 68 lines, no completed
  tasks to archive. Parked: `#1` (debugger tail, pending HW). `#2` audit umbrella
  in_progress — dispose (complete vs keep) before starting `#3`.
- **Entry baseline (baseline-health):** Build **clean** (`tsc` 0 warnings; one
  pre-existing esbuild direct-eval bundler notice at `mainWindow.ts:14`, out of scope).
  Tests **80/80 pass, 0 failed, 0 skipped** via `scripts/claude/run_tests_sequentially.sh`.
  **Caveat:** runner exercises 80 of 183 `tests/*.test.ts` files (103 not run by the
  maintained runner) — "runner green" ≠ "all 183 green"; §17/§18 register tests added
  this sprint. No regression vs the v0.9.26 green baseline. **This is the entry baseline
  closeout compares the exit baseline against.**

## Open questions — RESOLVED at plan time

All Phase-A "verify before fixing" items were confirmed against live code during
planning (research gate met):

| Item | Pascal | TS today | Status |
|---|---|---|---|
| SCOPE_XY default colors | clBlue/Orange/Olive `7F7FFF/FF7F00/7F7F00` (`:181,185,186`,`:241`) | hardcoded `0000ff/ffa500/808000` (`debugScopeXyWin.ts:159-168`) | confirmed bug; **SCOPE_XY-only** (SCOPE name-path is correct) |
| PLOT PRECISE default | `vPrecise := 8` (`:1880`) | `isPrecise=false` (`debugPlotWin.ts:193`); `scale=isPrecise?256:1` (`:1417,1517`) | confirmed; default inverted → ×256 coordinate risk |
| BITMAP defaults | `vColorMode:=key_rgb24` (`:2889`), `SetPack(0)`=1/long (`:2915`) | `?? ColorMode.RGB8`, 8/long fallback | confirmed |
| TERM font | `FontSize`=10 | `calcMetricsForFontPtSize(12)` (`debugTermWin.ts:232`) | confirmed |
| MIDI tweaks | F#=-4,G#=0,A#=4,B=23 (`:2543-2548`) | F#=-3 (`pianoKeyboardLayout.ts:33`)… | confirmed |
| LONG2 pixel color scope | `c` computed for ALL on-window cases (`:3553`, before the `case`) | base `getPixelColorAt`→0 | **affects all 9 windows** |

---

## Late discoveries (during Phase B implementation)

> Parity-affecting issues uncovered while implementing the planned sections.
> Per Stephen (2026-06-04): **any issue affecting 100% functional parity is
> automatically in scope** — these are fixed in this sprint, not deferred.

### LD-1 — §1 capture-time double-transform (fixed in §2, commit `4a7d3cb`)
The base mouse handler (`setupMouseEventHandlers`) stored the **already-transformed**
position in `vMouseX/vMouseY` at capture time, then the PC_MOUSE handler transformed
**again** at send time. Harmless while `transformMouseCoordinates` was identity, but
§1 added SPECTRO/BITMAP overrides → the transform was applied twice, and the
bounds-check (Pascal `:3543`) and pixel-sample (`:3553`) ran against the wrong
coordinate. **Fix:** base handler now stores **raw** client coords (matching PLOT's
own handler and Pascal, which uses raw `p.x/p.y` for both the bounds check and
`Canvas.Pixels`); the wire transform is applied once, at PC_MOUSE send time. §1's
unit tests passed because they exercised the pure helpers in isolation, not the full
capture→send path.

### LD-2 — PC_MOUSE / PC_KEY capture is dead in 7 of 9 windows (root: `window.electronAPI` never defined)
The base `enableMouseInput` / `enableKeyboardInput` renderer injections forward input
via `window.electronAPI.sendMouseEvent` / `.sendKeyEvent`, **guarded by
`if (window.electronAPI …)`**. But `electronAPI` is **never defined** anywhere — there
is no preload and every debug window runs `nodeIntegration:true, contextIsolation:false`
(PLOT's own code comments say as much). So the guard is always false and the injected
handlers **silently no-op**: `vMouseX/vMouseY/vKeyPress` are never updated, and PC_MOUSE
always returns the off-window sentinel for SPECTRO, BITMAP, MIDI, LOGIC, SCOPE, SCOPE_XY.
Only **PLOT** works, because it uses `require('electron').ipcRenderer.send('mouse-event'…)`
directly. **This makes the §1/§2 transform + pixel-color code dead on hardware for those
7 windows.** **Fix:** rewrite the base injections to use `ipcRenderer.send('mouse-event'…)`
/ `ipcRenderer.send('key-event'…)` mirroring PLOT (the base IPC receiver in
`setupMouseEventHandlers` already listens for both channels); register the receiver from
the keyboard path too so PC_KEY-only windows are covered. (§2's `getPixelColorAt` reads
the canvas on-demand at PC_MOUSE-poll time, so it needs no injection change — once
mouse-move events flow again, `vMouseX/vMouseY` track the cursor and the on-demand read
samples the right pixel.)

### LD-3 — FFT `enableMouseInput` is a no-op stub
`debugFftWin.ts` overrides `enableMouseInput` with a body that only logs — FFT never
attaches any mouse handlers, so PC_MOUSE never works for FFT (independent of LD-2).
FFT is `dis_fft` → raw client pixels (no transform). **Fix:** FFT uses the (now-working)
base path. Requires LD-2.

### LD-4 — TERM `getCanvasId()` returns a phantom element id
`debugTermWin.ts` rendered its visible canvas as `<canvas id="text-area">` (also
captured as `window.visibleCanvas`), but `getCanvasId()` returned `'terminal-canvas'`
— an id present nowhere in the DOM. So the base mouse injection's
`getElementById('terminal-canvas')` was null, the `if (canvas)` guard skipped, and
TERM captured **no** mouse events (PC_MOUSE always out-of-bounds), independent of
LD-2. PC_KEY was unaffected (document-level keydown listener). **Fix:** return
`'text-area'`. TERM's char-cell `transformMouseCoordinates` (`:1307`) already exists
and — after LD-1 (raw coords stored, single transform at send) — now applies once
correctly; LONG2 samples from `text-area`. **Still owned by §14:** the in-margin →
off-window sentinel edge (Pascal `:3544-3546`) and verifying the margin VALUE
(`contentInset` vs Pascal `ChrWidth div 2`) against TERM's actual text origin.

### LD-5 — RGBI8X COLOR-directive math dropped the white-to-color path (fixed in §4b-1, fe8bcfa)
`DebugColor.colorNameToRGB24UsingRGBI8X` implemented only Pascal's black-to-color
branch and omitted the white-to-color XOR path (`TranslateColor` rgbi8x,
DebugDisplayUnit.pas:3124-3133). For chromatic names at the default brightness 8
the `w` (white) path is taken, so e.g. `COLOR BLUE` resolved to `#0000f6` instead
of the correct `#0909ff`. No test covered this function (the gap that hid it).
**Fix:** `translateRgbi8x()` — full faithful port, verified against the Pascal
source for all 10 names + brightness nibble (memory `rgbi8x-directive-color-values`),
locked by `tests/rgbi8xDirectiveColor.test.ts`. It is the RGBI8X entry point used
by PLOT, so PLOT COLOR directives are now correct.

**§4 split status:** §4a (SCOPE_XY default channel colors → clXxx, `235e8f9`) and
§4b-1 (RGBI8X math) are done. **§4b remainder** (open): route the `DebugColor`
*instance* path (`new DebugColor(name,b)`, used for COLOR directives across
LOGIC/SCOPE/TERM/MIDI) through `translateRgbi8x` and reconcile it against the clXxx
DEFAULT path and the grid/font-colour derivation; update the ~22 pre-existing stale
colour tests (`colorCommand`/`debugColor` `.test.ts`, not in the runner); remove
PLOT's over-accepted non-keyword colour names (`debugPlotWin.ts:2197-2208`); FFT
default palette (with §11). This is the broad/visible-rendering part — the two real
systems (clXxx defaults vs RGBI8X directives) must stay distinct, not be unified.

---

## PART A — Shared-root fixes (base / shared code)

### 1. PC_MOUSE wire-coordinate transform (SR-1)
**Why.** The wire value the P2 receives from `PC_MOUSE` is wrong in 6 windows; the
TS overrides are effectively inverted vs Pascal `SendMousePos`
(`DebugDisplayUnit.pas:3537-3577`).
**Current code.** Base `transformMouseCoordinates` (`debugWindowBase.ts:1888`),
per-window overrides: SCOPE (`debugScopeWin.ts:2270-2290`), PLOT
(`debugPlotWin.ts:3266-3278`), LOGIC (`debugLogicWin.ts:1555-1575`); SPECTRO/BITMAP
have **no** override (inherit identity).
**Target behavior** — mirror Pascal's `case DisplayType`:
- LOGIC, SCOPE, SCOPE_XY, FFT, MIDI → **raw client pixels** (no transform).
- SPECTRO, PLOT, BITMAP → `if vDirX: x:=ClientWidth−x; if not vDirY: y:=ClientHeight−y;`
  then `x÷=vDotSize; y÷=vDotSizeY`.
- TERM → `(x−vMarginLeft)÷ChrWidth, (y−vMarginTop)÷ChrHeight` with `vMarginLeft=ChrWidth div 2`.
- Off-window (and TERM in-margin) → LONG1 sentinel `$03FFFFFF`.
**Integration.** Implement the dispatch in the base keyed on a window-declared
display type + `vDirX/vDirY/vDotSize(Y)/margin` accessors; remove the inverted
per-window overrides. SCOPE_XY/FFT must end up raw (they already are — guard against regression).
**Verification.** Normal: a known cursor pixel yields the exact Pascal LONG1 bit-packing
(x bits0-12, y 13-25, wheel 26-27, buttons 28-30) per window. Edge: dotSize>1 division,
CARTESIAN-set `vDirY` on PLOT, TERM margin boundary. Error: off-window → `$03FFFFFF`.

### 2. PC_MOUSE LONG2 pixel color (SR-2)
**Why.** Pascal returns the actual canvas pixel under the cursor (BGR→RGB swap) in
LONG2 for **every on-window** case; TS always returns 0.
**Current code.** base `getPixelColorAt` (`debugWindowBase.ts:1923`) returns 0; no
window overrides.
**Target.** Sample the rendered canvas pixel at (x,y) and swap to `$00RRGGBB`
(Pascal `c and $FF shl 16 or c and $FF00 or c and $FF0000 shr 16`, `:3554`);
off-window → LONG2 `$FFFFFFFF`.
**Integration.** Read from each window's display canvas/offscreen bitmap via a base
hook the windows already expose; ensure read happens against the committed frame.
**Verification.** Normal: draw a known color, read it back swapped correctly. Edge:
sub-sampled/dotSize-scaled pixels read at the right source coordinate. Error:
off-window → `$FFFFFFFF`.

### 3. Shared parser: clamp ranges + power-of-2 selection (SR-3 + SR-4)
**Why.** `displaySpecParser` accepts SIZE/SAMPLES without Pascal clamps; FFT/SPECTRO
use `Math.round(log2)` not `Trunc`; SCOPE_XY caps RATE/SAMPLES at 512 vs 2048.
**Current code.** `shared/displaySpecParser.ts` `parseCommonKeywords` (SIZE `:56-64`,
SAMPLES `:67-76`); FFT `nearestPowerOfTwo` (`debugFftWin.ts:971`), SPECTRO `:363`;
SCOPE_XY `persistenceManager.ts:28`, `debugScopeXyWin.ts:766`.
**Target.** Per-window clamp constants from Pascal (`scope_wmin..bitmap_hmax` =
32/1..2048; `term 1..256`; SAMPLES per-window lower bounds: LOGIC 4, SCOPE 16, FFT/SPECTRO
power-of-2 4..FFTmax; RATE 1..2048). Replace round with **floor** on log2 (shared helper).
Raise SCOPE_XY RATE/SAMPLES bound to `XY_Sets=2048`.
**Verification.** Normal: in-range values pass unchanged. Edge: `SAMPLES 768`→512 (floor),
SCOPE_XY `RATE 1500` accepted, SIZE 1..31 clamped to 32. Error: 0/negative handled
per Pascal `KeyValWithin` (clamp, not abort).

### 4. Color-keyword handling + default-color source of truth (SR-6 + §3.1)
**Why.** Named-color parsing diverges: TERM update-phase colors missing, SCOPE_XY
`parseInt(keyword)`→black, PLOT over-accepts non-keyword names; SCOPE_XY default
channel-color array is hardcoded wrong.
**Current code.** `DebugColor` table (`debugColor.ts:43-61`) — **correct** clXxx values;
SCOPE uses it (correct); SCOPE_XY hardcoded array (`debugScopeXyWin.ts:159-168`) — wrong;
PLOT `isColorCommand` extra names (`debugPlotWin.ts:2197-2208`); FFT single `#00FF00` default.
**Target.** One `KeyColor`-equivalent path: the 10 directive color names
(`BLACK WHITE ORANGE BLUE GREEN CYAN RED MAGENTA YELLOW GRAY`), BLACK/WHITE literal,
the other 8 via RGBI8X with optional 0–15 brightness nibble. Reject names outside that
set. Replace SCOPE_XY's array and FFT's default with `DefaultScopeColors`
(clLime,clRed,clCyan,clYellow,clMagenta,clBlue,clOrange,clOlive).
**Verification.** Normal: `COLOR BLUE` → `$0909FF` (RGBI8X @ br8). Edge: brightness
nibble, multi-color channel lists. Error: invalid name → Pascal behavior (not silently black).

### 5. RATE draw-throttle (SR-5)
**Why.** LOGIC and SCOPE store `rate` but redraw every sample; Pascal gates via
`RateCycle` (`:3079-3088`).
**Current code.** LOGIC `:1386-1425`, SCOPE `processMessageAsync` (no rate counter).
**Target.** Shared `RateCycle` helper: draw only every `vRate`-th set; CLEAR resets the
counter (Pascal `vRateCount := vRate-1` on CLEAR for FFT/SPECTRO; match per-window init).
**Verification.** Normal: RATE 1 draws every set; RATE 4 every 4th. Edge: RATE 0 (Pascal
stores 0 — never auto-draws until UPDATE). Error: RATE>buffer.

### 6. CLEAR full state reset (SR-7)
**Why.** CLEAR leaves residual state per window.
**Current code/Target** (match each Pascal `key_clear`): LOGIC reset `vRateCount`
(`:1052-1058`); SCOPE reset `vTriggered`/armed/holdoff (`:1252-1259`); BITMAP call
`SetTrace(vTrace,True)` (`:2443-2447`); TERM fill with `vBackColor` not combo bg
(`ClearBitmap`); FFT/SPECTRO already reset SamplePop + rateCount (verify).
**Verification.** Normal: CLEAR then new data starts at the trace-correct origin /
un-triggered. Edge: CLEAR after BACKCOLOR (TERM fills with the set back color).

### 7. Create-time configuration parsing (SR-8)
**Why.** Config directives are dropped at window creation in several windows.
**Current code.** MIDI `parseMidiDeclaration` TODO stub (`debugMidiWin.ts:897-901`);
SCOPE/SCOPE_XY/FFT/PLOT drop packed-mode (`KeyPack`) and some color directives at config.
**Target.** Run the same directive vocabulary at config phase that Pascal `XXX_Configure`
accepts. MIDI: parse TITLE/POS/SIZE/RANGE/CHANNEL/COLOR from the creation line.
Others: accept packed-mode + color directives in the config switch.
**Verification.** Normal: `debug(\`MIDI m SIZE 6 RANGE 36 84 CHANNEL 1 COLOR YELLOW BLUE)`
creates the correct window. Edge: POS honored at creation (auto-place suppressed). Error:
out-of-range params clamp per Pascal.

---

> **Testing principle (applies to every section §1–§16).** Each section's
> "Verify: normal / edge / error" cases are a **unit-test deliverable** wherever the
> logic is unit-testable in isolation — which is most of this work: directive parsing
> & clamps, the PC_MOUSE wire transform & LONG1 bit-packing, pixel-color BGR→RGB swap,
> color-keyword/RGBI8X resolution, `Trunc(log2)` selection, FFT math, keyboard geometry,
> trace patterns, coordinate transforms. Add/extend Jest tests alongside each change
> (not at the end), register new files in `scripts/claude/run_tests_sequentially.sh`,
> and run them incrementally. Only inherently-visual behavior (anti-aliasing quality,
> pixel-exact rendering) defers to the final whole-app visual-parity pass (§18).

## PART B — Per-window residuals (each its own deliverable)

### 8. LOGIC residuals
Parser must not abort on `RATE/DOTSIZE/LINESIZE/TEXTSIZE` (`debugLogicWin.ts:451-461`
vs Pascal `:950-961`); build the **default 32-channel** set `'0'..'31'`/clLime when no
labels (`:1008-1017` vs `:480-482`); detect `RANGE` bus-waveform channel variant
(`:980,985-993`); TRIGGER initial `armed=False` (`:1045`); HOLDOFF range-validate + reset
counter; default grid `$404040` (not GRAY3+4) and lineSize **3** (not 1, `:958`); SAMPLES
lower bound 4. Verify: normal multi-directive LOGIC spec parses fully; edge bus-waveform
labels/dimmed color; error out-of-range clamps.

### 9. SCOPE residuals
Add `DOTSIZE/LINESIZE/TEXTSIZE` to config switch + render them (line width from
`lineSize`, dot rendering `DrawLineDot`); implement per-channel **autoscale**
(`vAuto[]`/`SCOPE_Range`, `:1346`) and stop conflating channel `AUTO` with auto-trigger
(`:806-808`); fix `vGrid`/legend numeric bit-ordering; remove/fix buggy TS-only LINE/DOT
update handlers (`:984-999`); default grid color `$404040`. Verify: normal scope with
DOTSIZE/LINESIZE renders; edge AUTO ranges to data min/max; error legend `%abcd` vs numeric.

### 10. SCOPE_XY residuals
Use `vGridColor` (default `$404040`) not hardcoded `0x808080` and full-opacity perimeter
(`:1269`, `scopeXyRenderer.ts:187-204`); enable the on-screen readout (remove the
`if(ENABLE_CONSOLE_LOG)` gate, `:266`); `POLAR -1` → `-$100000000` (`:812`); SIZE clamp on
`val*2` (valid input 16..1024, `:716`); cap channels at 8. (Default colors handled in §4.)
Verify: normal grid color/opacity; edge POLAR -1 angle wrap; error SIZE 1025 clamps.

### 11. FFT residuals
Remove invented `RANGE` and `GRID` config directives (`:765-783,832-833`); channel
re-definition **in place** at `vIndex-1` not append (`:1074-1086` vs `:1628-1637`);
on-screen readout format = pixel-offset Y-inverted (not Bin/Hz/Mag); default window
**256×256** (`:643-645`); default channel palette = `DefaultScopeColors`. (log2 floor in §3.)
Verify: normal `SAMPLES n first last`; edge channel re-send overwrites; error RANGE now ignored.

### 12. SPECTRO residuals
Remove the added **noise floor** (`:265-269,771-773`) — Pascal plots all bins; `SAMPLES
first` bin clamp inclusive (off-by-one, `:372`); stop accepting `SIZE` (Pascal SPECTRO has
none); HSV16 tune numeric-only; populate the `#coordinate-display` readout on mousemove.
(PC_MOUSE Y-invert/÷dotsize §1; LONG2 §2; log2 §3.) Verify: normal waterfall faithful to
Pascal intensities; edge low-amplitude bins now visible; error none.

### 13. PLOT residuals
**`PRECISE` default = 8** + standalone `PRECISE` toggle (`:1946-1947`) — handle the ×256
coordinate scaling end-to-end and regression-test simple plots; **SPRITE orientation 0–7 =
flip/transpose** matrix, not 90° rotations (`:2859-2910` vs `:2123-2133`); add `OPACITY`
(`:1944`), `OBOX` (`:2015,2034`), update-phase `BACKCOLOR` (`:1932`) + standalone
`TEXTANGLE` (`:2041`) + color-mode directives (wire `isColorModeCommand`, `:3226`);
`TEXTSIZE` range **6..200**; `ORIGIN` no-arg = current pixel (`:1952-1956`); `LUTCOLORS`
up to **256** not 8; `MakeTextAngle` ×10 conversion; honor config `DOTSIZE`; SmoothDot/
Line/Shape anti-aliasing; apply origin at draw time (`PLOT_GetXY`) not at SET; LAYER cap
**8**; reconcile the two Delete-key mappings to 7. Verify: normal precise DOT/LINE scale;
edge sprite orientations 1–7 match Pascal flips; error OBOX/OPACITY now honored.

### 14. TERM residuals
Update-phase named colors (`BLACK..GRAY`) + `BACKCOLOR` (`:2232-2239`); fix SET column/row
(`2`/`3`) dual-dispatch + consume the parameter token (`:873-887`); default font **10pt**
(`:232`); CR+LF (`13 10`) consume trailing `10` → single newline (`:2298-2302`); clamp
TEXTSIZE/SIZE out-of-range instead of aborting. (PC_MOUSE margin §1; CLEAR fill §6.) Verify:
normal runtime color change; edge `13 10` one newline; error TEXTSIZE 201 clamps.

### 15. BITMAP residuals
Default color mode **RGB24** (`:489`) and default pack **1 sample/long** (`SetPack(0)`,
`:1407`); `LUTCOLORS` update overwrites from index 0 not appends (`:1076`); RGBI modes do
**not** consume a tune token (`:1119-1149`); enforce SPARSE-disabled-when-dotsize<4
(`:2938`); W-mode (LUMA8W/HSV8W/RGBI8W/HSV16W) white background (`GetBackground`, `:3180-3204`);
named-color support for SPARSE/LUTCOLORS. (PC_MOUSE Y-invert §1; LONG2 §2.) Verify: normal
default BITMAP renders RGB24; edge 2× LUTCOLORS keeps palette; error RGBI8 followed by data.

### 16. MIDI residuals
(Create-time config parse in §7.) Correct black-key tweak table F#/G#/A#/B = `-4/0/4/23`
(`pianoKeyboardLayout.ts:33-38` vs `:2543-2548`); note-off velocity store `-val`
(`:809` vs `:2636`); key top draw at `-r` (flat-top clip, `:2671`); stop accepting `UPDATE`
on MIDI (Pascal ignores it). Verify: normal keyboard geometry matches Pascal pixel
positions; edge note-off rendering; error UPDATE no-op.

---

## PART C — Documentation & verification (plan deliverables)

### 17. Documentation sync
Update for the behaviors changed by §1–§16:
- `DOCs/project-specific/ARCHITECTURE.md` (SPEC) — PC_MOUSE wire model, parser clamp/parity notes.
- `DOCs/pascal-REF/DEBUG-WINDOW-DIRECTIVE-MATRIX.md` — add a **TS-status** column (the layer Phase A produced) so the matrix tracks parity, not just Pascal.
- `DOCs/pascal-REF/theory-of-operations/<WINDOW>_Theory_of_Operations.md` — refresh each touched window.
- `DOCs/project-specific/IMPLEMENTATION-STATUS.md` / `TEST-STATUS.md` — parity state per window.
- `DOCs/project-specific/TECHNICAL-DEBT.md` — any deliberately-deferred item (none expected at "all severities", but record deviations).
- `CHANGELOG.md` — audience-facing summary (P2 developers).
No style/help/manual guides exist in this project (slots unset) — those steps self-skip.

### 18. Verification & parity sign-off

**Incremental (continuous, per section — NO hardware).** As each of §1–§16 lands:
- Unit tests for that section's normal/edge/error cases (the Testing principle above);
  new files registered in `scripts/claude/run_tests_sequentially.sh`.
- Full suite green via `scripts/claude/run_tests_sequentially.sh` (never bare `npm test`);
  byte-perfect validation on data-stream paths.
- Coverage ≥80% per window, 100% on new shared classes.
- Directive-coverage matrix for the touched window advances toward 100%.
This is the only gating between steps — green unit/integration tests, not hardware. The
sprint does **not** stop for hardware between steps.

**Final whole-application pass (ONCE, after ALL of §1–§17 land).** The reason we build
straight through is to exercise the *entire* application together:
- Per-window directive-coverage matrix → 100%, every parameter variant exercised.
- External-hardware test on real P2 (Prop Plug / FTDI) across all 9 windows — evidence in
  `test-results/external-results/`; visual parity vs Pascal screenshots
  (`bitmaps/PNut-target.png` vs `pnut-term-ts-current.png`).
- Diagnostic logging off (window `ENABLE_CONSOLE_LOG=false`, constructor logging off,
  temp traces removed) before final sign-off.
- (Hardware run requires a P2 on the dev machine — not available in this container; this
  is the hand-off point to Stephen for the whole-app exercise.)

**Sequencing note (for `plan-to-tasks`).** Land Part A first (shared roots — the corrected
base everything else builds on), then Part B per-window, then Part C docs. Highest-risk
changes — PC_MOUSE rewrite §1/§2 and PLOT PRECISE ×256 §13 — get the most thorough
**unit/integration** coverage as they land, but there is **no hardware gate between
windows**; hardware/visual verification is the single final pass above.

## Section ↔ task cross-reference

Generated by `plan-to-tasks` (2026-06-04). Sprint tag `9win-parity`. PLOT §13 split
into 13a/b/c (protection-point sizing). Order is foundational → dependent via `seq`.

| Plan § | Deliverable | Task | seq |
|---|---|---|---|
| §1  | PC_MOUSE wire transform (base)        | «#3»  | 1  |
| §2  | PC_MOUSE LONG2 pixel color (base)     | «#4»  | 2  |
| §3  | Parser clamps + Trunc(log2) (shared)  | «#5»  | 3  |
| §4  | Color-keyword + default colors (shared)| «#6» | 4  |
| §5  | RATE draw-throttle (shared)           | «#7»  | 5  |
| §6  | CLEAR full reset                      | «#8»  | 6  |
| §7  | Create-time config parsing            | «#9»  | 7  |
| §8  | LOGIC residuals                       | «#10» | 8  |
| §9  | SCOPE residuals                       | «#11» | 9  |
| §10 | SCOPE_XY residuals                    | «#12» | 10 |
| §11 | FFT residuals                         | «#13» | 11 |
| §12 | SPECTRO residuals                     | «#14» | 12 |
| §13a| PLOT coordinate model                 | «#15» | 13 |
| §13b| PLOT shapes & sprites                 | «#16» | 14 |
| §13c| PLOT missing directives               | «#17» | 15 |
| §14 | TERM residuals                        | «#18» | 16 |
| §15 | BITMAP residuals                      | «#19» | 17 |
| §16 | MIDI residuals                        | «#20» | 18 |
| §17 | Documentation sync                    | «#21» | 19 |
| §18 | Final whole-app verification          | «#22» | 20 |

## Exit gate
Research complete; open questions empty (resolved above). Tasks generated
(`#3`–`#22`, tag `9win-parity`). **Not yet started** — execution is a separate go
decision gated on `sprint-start` (agree build number + capture entry baseline via
`baseline-health`/`tracking-readiness`), then `task-execution` works `seq` order.
