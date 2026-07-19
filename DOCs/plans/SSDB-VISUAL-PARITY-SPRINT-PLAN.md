# SSDB Visual Parity — Sprint Plan

**Type:** Sprint plan (ship commitment). **Window:** single-step debugger only.
**Authored:** 2026-06-20 (sprint-plan skill). **Entry build:** v0.9.76. **Target release:** v0.9.77.
**Spec authority:** `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` — Pascal is the
definitive rendering spec; the reference image is sanity-check only.
**Working docs (research backing):** `tasks/SSDB-VISUAL-PARITY-OBSERVATIONS.md`
(observation→root-cause table), reference captures in
`DOCs/testing/TEST-NO-COMMIT/{pascal-good-ssdb.png, pnut-term-bad-ssdb.png}`.
**Procedure reference:** this is debug-window parity work — implementers follow the
project `window-porting` skill (directive coverage, parity sign-off).

---

## § Open Questions — EMPTY ✅ (gate met)

All questions resolved (Stephen 2026-06-20). **G3 (window title): no change** — the
OS titlebar `Debugger - Cog 0` is correct; the Pass-1 "incorrect title" remark referred
to the **panel/sub-window titles** (DIS/WATCH/REG/LUT), addressed in §3.1–§3.2. Scope
decisions baked in below. Plan is sprint-ready.

## Scope decisions (confirmed by Stephen 2026-06-20)

- **One build** delivers all of §1–§8, then a single HW recapture (his "batch into
  one build" preference; accepts the larger verify surface for W0).
- **W14 dimming = full Pascal-graded parity** (not the flat veil).
- **W0 box-draw stays local** to `DebuggerRenderer.ts`; a shared `SmoothShape`
  utility is logged to `DOCs/PUNCH_LIST.md` as a future refactor (not this sprint).

## Entry baseline (sprint-start, 2026-06-20)

Final-release polish: minimal, debugger-only changes. W0 (drawBox) is the one
deliberately non-surgical item (touches every panel box) and is justified by
confirmed parity (CLAUDE.md precedence: parity overrides surgical).

**Build number:** v0.9.76 → **v0.9.77** (Stephen: increment rightmost digit). To be
bumped in `package.json` at build/ship time.

**Working-tree audit:** sprint blast radius (`src/classes/debugger/`,
`debugDebuggerWin.ts`, `constants.ts`) **clean** — no uncommitted edits, no untracked
source. Pre-existing unrelated uncommitted files (`.devcontainer/*`, a test-plan doc)
left as-is, out of scope. Decision: proceed.

**Tracking-readiness (entry):** READY. Board clean (0 tasks). Context 9 keys/16.9 KB
(under 40-key target). Non-blocking cleanup candidates noted: ~4 superseded dated
`recovery_*` snapshots; deprecated `lesson_*` key; `MEMORY.md` 33.6 KB > ~24 KB load
budget (verbose index entries truncating on load). Not pruned (persistent breadcrumbs;
Stephen's call) — none block the sprint.

**Baseline-health (entry):**
- *Build:* clean, exit 0. One **pre-existing esbuild bundler advisory** — `direct-eval`
  at `mainWindow.ts:14` (deliberate `eval("require('electron')")` to avoid bundling
  Electron). Build-tool notice, not a compiler warning; out of sprint scope. **Accepted
  as standing condition.**
- *Blast-radius suites (protection point):* `debuggerDisplay`, `debuggerFixture`,
  `debuggerInteraction`, `pasm2Disassembler` → **4 suites / 36 tests green.**
- *Full suite:* maintained sequential runner documented standing-green (no known-failing
  groups since v0.9.26); ~16 `tests/*.test.ts` files remain outside the runner
  (documented inventory gap, not regressions). Full-runner re-confirmation in progress
  at sprint-start; result appended below.
- **Entry baseline = runner green + blast-radius 36/36 green.** Exit baseline at closeout
  must not worsen this.

**Full-runner entry result:** ✅ **155/155 passed, 0 failed** (sequential runner, 2026-06-20). Entry baseline locked: build clean (1 accepted esbuild advisory), runner 155/155, blast-radius 36/36. Exit baseline at closeout must hold this.

## Pascal palette (authoritative — `DebuggerUnit.pas:84-105`)

`cBackground`=$000000 · `cBox`=$1F1F00 · `cBox2`=$001F00 · `cBox3`=$7F3F00 ·
`cData`=$FFFFFF · `cData2`=$007F00 · `cDataDim`=$0F0F00 · `cIndicator`=$FF7F00 ·
`cName`=$FFFF00 · `cHighSame`=$3F3F00 · `cLowSame`=$0F0F00 · `cHighDiff`=$FFFF00 ·
`cLowDiff`=$7F7F00 · `cModeButton`=$7F7F00 · `cModeText`=$FFFFFF ·
`cModeButtonDim`=$3F3F00 · `cModeTextDim`=$0F0F00 · `cCmdButton`=$BF5F00 ·
`cCmdText`=$FFFFFF · `cCmdButtonDim`=$3F1F00 · `cCmdTextDim`=$1F0F00.
Our `COLOR` map (`shared/constants.ts:210`) already holds these values correctly —
the defects are in *draw routines*, not the palette.

---

## §1 — Box rendering parity (drawBox)  · root cause of T3 + much of G2 · FOUNDATIONAL

**Why.** Every panel box is wrong. Our `drawBox` (`DebuggerRenderer.ts:181-191`) is a
flat 1px `strokeRect` — no fill, no rounded corners, no brightened rim. Pascal
`DrawBox` (`DebuggerUnit.pas:2123-2148`) draws a **filled rounded rectangle** in the
box color **plus a thick rounded rim brightened ×1.5** (`color·3>>1` per channel,
clamped to $FF), corner radius ≈ `ChrHeight/3+1`, rim thickness `t = ChrWidth·rim>>4`
(rim=3 for panels, 6 for the GO button). Verified against the reference: CT box =
`#704010` fill (`cBox3`) + `#B06020` rim (`cBox3·1.5`); ours samples ~0% orange.

**Current code.** `drawBox` (:181) used by `buildBaseTemplate` (:206-248) for all
panel boxes; `fillRect` (:194) used for tabs/buttons.

**Target.** Reimplement `drawBox(left, top, w, h, color, rim, small)` to mirror Pascal:
`ctx.roundRect` filled in `color`, then `ctx.roundRect` stroked in the ×1.5-brightened
color with `lineWidth = t`. Follow the existing `roundRect`-for-`SmoothShape` pattern
already used in PLOT/SCOPE_XY/BITMAP (kept local here — see punch-list). Pass the Pascal
`rim` (3 panels / 6 GO) and `small` flag through. Resolves CT-box orange, the
rounded-corner look, and the bulk of "colors generally incorrect."

**Verification.**
- *Normal:* CT box renders orange fill + brighter orange rim; all panels show rounded
  corners. Region-sample CT in recapture ≈ `#704010`/`#B06020`.
- *Edge:* small boxes (button tabs, `small=true` path → Pascal `wm/hd` variant) and the
  thick GO rim (rim=6) render correctly; 1-cell-tall boxes don't collapse.
- *Error:* degenerate sizes (w or h ≤ 0) don't throw.

## §2 — Font parity  · G1 · FOUNDATIONAL

**Why.** `drawText` hardcodes `14px monospace` (`:174`); buttons use `12px` (`:912`).
Cell pitch is 8×16 px (`constants.ts:159-161`). Pascal derives the grid from font
metrics (`ChrWidth := TextWidth('X')`, `:601`); since our grid is fixed at 8px, the
font must render `'X'` at 8px advance. Generic monospace at 14px overflows the cell.

**Current code.** `drawText:169-179`; button font `renderButtons:912`. The window HTML
already declares `Parallax` (`debugDebuggerWin.ts:273`) but the canvas uses generic
monospace.

**Target.** Mirror TERM's proven approach (`debugTermWin.ts:490-498`): use the bundled
`Parallax` (or `3270-Regular`) font, sized via `ctx.measureText('X')` so advance == 8px;
unify body + button font through one helper. Ensure the @font-face/font load is ready
before first paint.

**Verification.** *Normal:* glyph advance == `CHAR_WIDTH_PX`; text fills cells without
overflow; recapture text size matches reference. *Edge:* bold + (where used) italic
variants stay within the cell. *Error:* font-not-yet-loaded path falls back without
mis-positioning permanently (re-render once loaded).

## §3 — Static labels & text content  · T2, D1, S1, I1, P1, R1, H3, G3

Per-label fixes; all live in the per-panel render methods (our architecture re-draws
labels each frame rather than baking them into a base bitmap like Pascal — fixed in
place, not refactored).

- **§3.1 REG/LUT column titles (T2).** Add `'REG'`/`'LUT'` (cName, bold-italic) atop
  each map column (`renderRegMap/LutMap:332,344`); Pascal `:1954/1957`.
- **§3.2 Remove DIS/WATCH titles; add watch-mode indicator (D1).** Delete the `'DIS'`
  title and `renderRegisterWatch:811` `'WATCH'`; draw dynamic `"REG ▲"/"LUT ▲"`
  watch-mode indicator (reference). Removes disasm overrun into the next section.
- **§3.3 Exec "MAIN" by STACK (S1).** `renderExec:478-483`: draw `ModeName[execMode]`
  (or `CALL(n)` when execMode==0 && callDepth≠0) at `(EXECl, EXECt+2)` in cData2 green,
  plain, **no fill** (Pascal `:1423/1436`); the 4×4 EXEC tab stays a base box.
- **§3.4 Interrupt rows (I1).** `renderInterrupts:514-526`: match `DrawInt`
  (`:2270-2285`): off ⇒ only `'off'` (cData2) at +5; active ⇒ event name (cData) at +5
  **plus** status idle/wait/busy (cData2) at +9. Drop the always-on event word.
- **§3.5 Pointer label RFxx/WFxx (P1).** `renderPointers:537`: `'RFxx'`/`'WFxx'`
  (was `'Rxx'`/`'Wxx'`); Pascal static `' Fxx'` + dynamic 'R'/'W' (`:2003/1444`).
- **§3.6 RQPIN title (R1).** `renderSmartPinWatch:830`: title = `'RQPIN'` + `▲`; the
  DIR/all wording moves to the hover hint (Pascal `:1622/1887`).
- **§3.7 HUB label below memory (H3).** `renderHub:620`: draw `'HUB'` at
  `HUBt+HUBh+1` (below) + the small bottom tab box (Pascal `:2021/2023`).
- **§3.0 Window title (G3).** RESOLVED — no change; the OS titlebar is correct. The
  Pass-1 remark referred to panel titles (§3.1–§3.2).

**Verification.** *Normal:* each label matches the reference position/text. *Edge:*
interrupt active vs off both render correctly; CALL(n) depth shown; W-mode pointer shows
`WFxx`. *Error:* unknown event index doesn't crash (no `'???'` leak past Pascal's range).

## §4 — Data colors & checkmark  · P2, P3, H1, H2, T1

- **§4.1 Pointer data (P2, P3).** `renderPointers:551-559`: bytes → cData2 (green);
  center byte → green **filled rounded** highlight + dark (cBox) bold text (replace the
  orange outline); center ASCII char inverted too (Pascal `DrawPtrBytes:2249-2266`).
- **§4.2 Hub data (H1, H2).** `renderHub:626/634`: address → cData (white), hex bytes →
  cData2 (green); ASCII already green (correct). Net: address WHITE, hex GREEN, ascii
  GREEN (Pascal `:1471/1475/1477`).
- **§4.3 XBYTE check (T1).** `renderXByte:413`: draw dim check (cDataDim) **always** +
  bright orange (cIndicator) when `message[mBRKC]>>25 & 1` (Pascal base `:1973`, dynamic
  `:1428`).

**Verification.** *Normal:* pointer/hub colors match reference; checkmark visible dim,
turns orange on the BRKC bit. *Edge:* center-byte highlight aligns on all three pointer
rows; non-printable bytes render `.`. *Error:* short/empty pointer windows don't
mis-highlight.

## §5 — Button panel parity  · B1 / AUDIT-B

**Why/Target.** Enumerate every button vs Pascal base (`:2028-2056`) + dynamic highlight
(`:1700-1750`): dim default (cModeButtonDim/cModeTextDim), active bright
(cModeButton/cModeText), GO = cCmdButton/cCmdText (orange). Add the INT*E **right-arrows**
+ EVENT **up-arrow**; verify the full button set, captions, and GO caption
(Go/Stop/Break). Unify button font with §2. Code: `renderButtons:888-919`, `BUTTONS`
const, `isButtonActive:862`, `goCaption:882`.

**Verification.** *Normal:* every button's active/dim color + caption + arrow matches
reference; GO orange. *Edge:* GO caption flips Go↔Stop↔Break with repeat/dim state;
active-mode buttons (e.g. MAIN) light. *Error:* unknown button name → dim default.

## §6 — Heat-map parity  · AUDIT-HEAT

**Why/Target.** REG/LUT blend must be **bit-value-aware**: set bits blend
`cHighSame→cHighDiff` (`$3F3F00→$FFFF00`), clear bits `cLowSame→cLowDiff`
(`$0F0F00→$7F7F00`), plus a `$40` alpha highlight band over the disassembly-visible
address rows; HUB blends `cDataDim→cYellow`; decay `HitDecayRate=2`
(Pascal `:1648-1688`). Ours (`paintHeatBitmap:308`, `renderHubMap:643`, blend at :654)
uses a single `cDataDim→cName` ramp — not bit-aware, no highlight band.

**Verification.** *Normal:* changed registers flash bright; set vs clear bits differ in
base tone; visible-disasm rows show the highlight band. *Edge:* heat decays over breaks;
cells past firmware sub-block count stay dim. *Error:* hit-array shorter than cell count
doesn't index out of range.

## §7 — Screen dimming parity  · AUDIT-DIM

**Why/Target.** Replace the flat `rgba(0,0,0,0.5)` veil (`render:295-298`) with Pascal's
**graded** dim via the `BitmapToCanvas(Level)` approach (`:2300-2361`): the idle dim
re-maps colors through graded levels rather than a translucent black overlay. Match the
Pascal level behavior on the 250 ms idle transition.

**Verification.** *Normal:* idle dim looks graded like Pascal, not a grey wash; live
break restores full brightness. *Edge:* dim toggles cleanly on repeated breaks without
accumulating. *Error:* dim path never blocks/holds a frame (no unbounded wait).

## §8 — Fly-over hint parity  · AUDIT-HINT

**Why/Target.** Hints are under-wired. (a) Mousemove sets `renderer.hintText`
(`DebuggerInteraction:76`) but **triggers no re-render** → hints never paint between
breaks; add a render (or hint-layer redraw) on hover. (b) `updateHint:504` covers only
buttons+events — extend to all hover regions per Pascal hint strings (register-watch,
smart-pin, hub, disassembly, XBYTE, pointers, etc.). (c) Hint text color →
**cIndicator orange, italic** (Pascal `:1917`; ours is white at `renderHint:854`).
(d) Confirm `renderHint:851` paints at the HINT panel.

**Verification.** *Normal:* hovering each region shows its orange italic hint text live
(no break needed). *Edge:* moving off a region clears the hint; rapid moves don't flicker
stale text. *Error:* hover during a break-in-progress doesn't corrupt the frame.

## §9 — Documentation

No SPEC_DOC change: `ARCHITECTURE.md` documents debugger *routing/packets*, not pixel
rendering (Pascal is the rendering spec). `manual-source/SINGLE-STEP-DEBUGGER-MANUAL-SOURCE.md` is operation-focused
— no pixel-level content to change. **Deliverable:** verify both at sprint-closeout; if
either describes a visual element this sprint changes, update it then. Build-wrapup
records the visual fixes in `CHANGELOG.md` at release.

---

## Verification approach (whole sprint)
- `tsc` clean; debugger + touched-window suites green via
  `scripts/claude/run_tests_sequentially.sh` (never bare `npm test`). Update SSDB
  renderer tests for new label/color expectations; add cases for the bit-aware heat
  blend and the box fill/rim.
- One HW recapture of COG0 first-break (test06) → region-by-region image-tools diff vs
  `pascal-good-ssdb.png` (CT orange, REG/LUT titles, pointer/hub colors, buttons, hints).

## Section ↔ task cross-reference (plan-to-tasks, sprint tag `ssdb-visual-parity`)

| Plan § | Deliverable | Task | seq |
| ------ | ----------- | ---- | --- |
| §1 | Box-draw parity (drawBox) — foundational | «#51» | 1 |
| §2 | Font parity — foundational | «#52» | 2 |
| §3 | Static labels & text (REG/LUT, DIS/WATCH, MAIN, INT, RFxx, RQPIN, HUB) | «#53» | 3 |
| §4 | Data colors & checkmark | «#54» | 4 |
| §5 | Button panel parity | «#55» | 5 |
| §6 | Heat-map parity | «#56» | 6 |
| §7 | Screen dimming parity (graded) | «#57» | 7 |
| §8 | Fly-over hint parity | «#58» | 8 |
| §9 | Documentation | «#59» | 9 |

## Out of scope (parked — not visual; see resume note / observations doc)
- Rapid-break delta-refresh race; build-A diagnostic stripping; debugger dead-code
  cleanup. Address after visual parity lands.
- Shared `SmoothShape` utility extraction — logged in `DOCs/PUNCH_LIST.md`.
