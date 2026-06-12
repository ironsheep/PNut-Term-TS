# Window Parsing Foundation Parity — Sprint Plan

**Status:** STARTED 2026-06-11 (all §0 Open Questions resolved)
**Authored:** 2026-06-11
**Owner:** Stephen
**Type:** Sprint plan (commitment to ship code changes), not a study.

### Sprint execution record (pinned at sprint-start)

- **Outgoing build version:** **0.9.47** (current `package.json` = 0.9.46;
  bump applied at build-wrapup/release per the project's tag-on-release flow).
- **Branch:** `sprint/window-parsing-parity-0.9.47` (off `main`).
- **Working-tree decision:** TERM fix (task #33, `debugTermWin.ts` +
  `debugTermWin.test.ts`) committed as the protection point — commit `b08e50d`.
  The large batch of `D` DOCs deletions in the tree is Stephen's separate docs
  reorg, **outside this sprint's blast radius** (src/tests + 2 new docs); left
  untouched.
- **Entry check — tracking-readiness (2026-06-11):** task #33 (TERM fix)
  completed & archived. Board holds only unrelated leftovers: #31 (serial-offload
  finalize, awaiting HW), #30 (BITMAP RGB24 throughput, awaiting HW), #25
  (broken-image investigation) — **decision: left out of this sprint** (unrelated
  to parsing parity; HW-blocked). Context lean (4 keys / 5 KB); MEMORY.md 89
  lines. Minor: `lesson_todo_mcp_container_persistence` is a deprecated-prefix
  key (37 B) — non-blocking. **Verdict: ready.**
- **Entry baseline — baseline-health (2026-06-11):** build CLEAN (0 warnings;
  only the benign esbuild direct-eval notice). Full sequential suite **154/154
  registered tests pass, 0 failures, 0 in-suite skips reported.** This is the
  entry baseline closeout asserts no-regression against. **Caveat (→ §7):** the
  runner registers 154 of 161 present test files; 6 are unregistered and
  `memoryLeakDetection.test.ts` carries 2 `it.skip`s — so "154 green" does not
  yet mean "everything runs." §7 closes that gap and gates it.

---

## Purpose & context

All nine debug display windows were believed complete. We are now re-running
the **documented** manual examples (mostly pass) plus a **newly generated**
second example set (mostly fail). Some set-two failures are bad creation strings
in the new demos; others are **foundation parsing gaps** in the windows
themselves. This sprint cleans the foundation across **all 9 windows** so the
new examples mostly pass on their own merits and the remaining failures are
genuinely bad demos — not our misparse.

The prior nine-window sweep audited a **different axis**: directive×parameter
*coverage* and *rendering* parity. It did **not** systematically cover
**parsing robustness**: numeric-format handling, centralization vs. hand-rolled
code, clamp bounds, and accept/reject parity. That orthogonal axis is this
sprint. TERM's COLOR crash (fixed this session) was the thread that exposed it.

**Goal:** best-possible **100% functional parity with Pascal** (`DebugDisplayUnit.pas`)
for each window's CREATE-time declaration parser **and** its runtime command
handler, by routing every window through the shared, verified parsing helpers.

### The six issue-classes (the certification checklist)

- **C1 — Crash class.** Unguarded lookahead (`lineParts[i+1]`, `[++i]`) whose
  result is fed to a method that *throws on `undefined`*: `.match` / `.split` /
  `.toUpperCase` / `new DebugColor(...)` / `Spin2NumericParser.parseColor(...)` /
  `DebugColor.parseDirectiveColor(...)`. (Note: `parseInt`/`Number` on `undefined`
  yield `NaN`, **not** a throw — that's a C2/C3 wrong-value bug, not a crash.)
- **C2 — Numeric-format parity.** Raw `Number()` / `parseInt()` / `parseFloat()`
  for a directive parameter instead of `Spin2NumericParser`, which silently
  drops `$hex`, `%bin`, `%%quaternary`, and `1_000` underscore literals to `NaN`.
- **C3 — Clamp parity.** Missing or wrong clamp to the Pascal `Within` /
  `KeyValWithin` bounds (per §Pascal-Spec table below).
- **C4 — Abort parity.** Aborting window-create (or dropping later directives)
  on a bad parameter, where Pascal clamps/skips and **always creates** the window.
- **C5 — Color-system & completeness.** Wrong color *system* (clXxx default vs.
  RGBI8X directive vs. debugger cXxx) or an incomplete name+brightness parse;
  centralize directive colors through one shared KeyColor analog.
- **C6 — Regex null-deref.** A regex `.match()` result used without a null check.

### Methodology (binding for this sprint)

**Verify against real code before fixing — do not trust audit agents.** In the
audit that produced this plan, parallel agents over-reported: ~10 "high-severity
crashes" were properly guarded when the actual source was read (e.g. MIDI's
`i+2 < length` guard *does* cover `i+1`; BITMAP:455/:798 are inside
`while/if (i+1 < length)`). Every per-window task **re-verifies each cited site
against the current TS source and the Pascal procedure** before editing, and
quotes the guard/Pascal line as evidence. The cited `file:line`s below are from
the audit snapshot and are **starting points to confirm**, not gospel.

### Reference template (already shipped this session)

TERM is done and is the pattern every window follows:
- `DebugTermWindow.parseTermColor()` — a KeyColor analog: directive NAME +
  optional brightness (RGBI8X), BLACK/WHITE fixed (consume no brightness), or
  numeric/`$hex`, routed through the shared `DebugColor.parseDirectiveColor`.
- COLOR overwrites the 4 default combos **in place** (never shrinks the array →
  runtime color-select stays safe).
- No abort on bad SIZE/TEXTSIZE/BACKCOLOR — clamp/skip/continue like Pascal.
- 7 regression tests in `tests/debugTermWin.test.ts`.

### Shared infrastructure (the canonical paths)

- `src/classes/shared/spin2NumericParser.ts` — all numeric parsing (`parseInteger`,
  `parseCount`, `parsePixel`, `parseColor`). Guards `undefined`→`null` *except*
  `parseColor` (calls `.toUpperCase` first — see C1).
- `src/classes/shared/displaySpecParser.ts` — `parseCommonKeywords` (TITLE/POS/
  SIZE/SAMPLES), `parseColorKeyword` (background+grid), `clamp`.
- `src/classes/shared/debugColor.ts` — `parseDirectiveColor` (single KeyColor
  string), `fromDefaultName` (clXxx defaults only), `colorNameToRGB24UsingRGBI8X`.

---

## §Pascal-Spec — authoritative per-window bounds & semantics

Extracted from `DebugDisplayUnit.pas` (constants resolved). **This is the target.**
Every window's `*_Configure` is a `while NextKey do case val of …` loop that
**clamps or ignores** bad params and **never rejects the window**; the dispatcher
creates the window iff the display-type id is 0–8.

Resolved bounds: `SmoothFillMax = 2048`; sizes default `256×256`.

| Window | Directive | Params | Clamp bounds | Default | Pascal line |
|---|---|---|---|---|---|
| **LOGIC** | SAMPLES | 1 | 4 … 2047 | 32 | 951 |
| | SPACING | 1 | 1 … 32 | 8 | 953 |
| | RATE | 1 | 1 … 2048 | 1 | 955 |
| | DOTSIZE | 1 | 0 … 32 | 0 | 957 |
| | LINESIZE | 1 | 1 … 32 | 3 | 959 |
| | TEXTSIZE | 1 | 6 … 200 | FontSize(10) | 961 |
| | COLOR | 2 | KeyColor (bg,grid) | defaults | 963 |
| **SCOPE** | SIZE | 2 | 32…2048 × 32…2048 | 256×256 | 1168 |
| | SAMPLES | 1 | 16 … 2048 | 256 | 1170 |
| | RATE | 1 | 1 … 2048 | 1 | 1172 |
| | DOTSIZE | 1 | 0 … 32 | 0 | 1174 |
| | LINESIZE | 1 | 0 … 32 | 3 | 1176 |
| | TEXTSIZE | 1 | 6 … 200 | 10 | 1178 |
| | COLOR | 2 | KeyColor (bg,grid) | DefaultScopeColors | 1180 |
| **SCOPE_XY** | SIZE | 1 | `Within(val*2, 32, 2048)`; h=w | 256 | 1404 |
| | RANGE | 1 | 1 … $7FFFFFFF | $7FFFFFFF | 1408 |
| | SAMPLES | 1 | 0 … 2048 | 256 | 1410 |
| | RATE | 1 | 1 … 2048 | 1 | 1412 |
| | DOTSIZE | 1 | 2 … 20 | 6 | 1414 |
| | TEXTSIZE | 1 | 6 … 200 | 10 | 1416 |
| | COLOR | 2 | KeyColor (bg,grid) | defaults | 1418 |
| | POLAR / LOGSCALE / HIDEXY | 0–2 | flags | off | 1420–1424 |
| **FFT** | SIZE | 2 | 32…2048 × 32…2048 | 256×256 | 1572 |
| | SAMPLES | 1 or 3 | FFT 4…2048 (floor pow2); first 0…(N/2-2); last (first+1)…(N/2-1) | 512 / 0 / 255 | 1574 |
| | RATE | 1 | 1 … 2048 | vSamples | 1584 |
| | DOTSIZE | 1 | 0 … 32 | 0 | 1586 |
| | LINESIZE | 1 | -32 … 32 | 3 | 1588 |
| | TEXTSIZE | 1 | 6 … 200 | 10 | 1590 |
| | COLOR | 2 | KeyColor (bg,grid) | DefaultScopeColors | 1592 |
| **SPECTRO** | SAMPLES | 1 or 3 | as FFT | 512 | 1741 |
| | DEPTH | 1 | 1 … 2048 | 512 | 1752 |
| | MAG | 1 | 0 … 11 | 0 | 1754 |
| | RANGE | 1 | 1 … $7FFFFFFF | $7FFFFFFF | 1756 |
| | RATE | 1 | 1 … 2048 | 64 | 1758 |
| | TRACE | 1 | 0 … 255 (KeyVal, no clamp) | $F | 1760 |
| | DOTSIZE | 1–2 | 1 … 16 (x and y) | 1 | 1762 |
| | LUMA8…HSV16x | 1 | color MODE (KeyColorMode) | luma8x | 1767 |
| **PLOT** | SIZE | 2 | 32…2048 × 32…2048 | 256×256 | 1889 |
| | DOTSIZE | 1–2 | 1 … 256 (x and y) | 1 | 1891 |
| | LUT1…RGB24 | 1 | color MODE | rgb24 | 1896 |
| | LUTCOLORS | 256 | KeyColor each | 0 | 1898 |
| | BACKCOLOR | 1 | KeyColor | clBlack | 1900 |
| **TERM** ✅ | SIZE | 2 | 1 … 256 (cols,rows) | 40×20 | 2200 |
| | TEXTSIZE | 1 | 6 … 200 | 10 | 2202 |
| | COLOR | up to 8 | KeyColor ×8 (4 pairs) | DefaultTermColors | 2204 |
| | BACKCOLOR | 1 | KeyColor | clBlack | 2206 |
| **BITMAP** | SIZE | 2 | 1…2048 × 1…2048 | 256×256 | 2386 |
| | DOTSIZE | 1–2 | 1 … 256 | 1 | 2388 |
| | SPARSE | 1 | KeyColor | -1 (off) | 2394 |
| | LUT1…RGB24 | 1 | color MODE | rgb24 | 2395 |
| | LUTCOLORS | 256 | KeyColor each | 0 | 2397 |
| | TRACE | 1 | 0 … 255 (KeyVal) | 0 | 2399 |
| | RATE | 1 | any int (KeyVal); -1→w*h | -1 | 2401 |
| **MIDI** | SIZE | 1 | 1 … 50 | 4 | 2513 |
| | RANGE | 2 | first 0…127; last first…127 | 21,108 | 2514 |
| | CHANNEL | 1 | 0 … 15 | 0 | 2520 |
| | COLOR | 2 | KeyColor (on,off) | clCyan,clMagenta | 2522 |

Default color tables: `DefaultScopeColors = (clLime, clRed, clCyan, clYellow,
clMagenta, clBlue, clOrange, clOlive)` (line 241); `DefaultTermColors =
(clOrange, clBlack, clBlack, clOrange, clLime, clBlack, clBlack, clLime)` (242).

**Two distinct color paths — do not conflate (governs C5 scope):**
1. **Directive-name colors** → Pascal `KeyColor` (RGBI8X, name+brightness or
   numeric). Used by COLOR/BACKCOLOR/SPARSE/LUTCOLORS-entries. **Centralize these.**
2. **Pixel color-MODE** → Pascal `KeyColorMode` + `TranslateColor(val, vColorMode)`
   (LUT1…RGB24, LUMA8…HSV16x). A *different* mechanism for pixel-stream decoding,
   handled by `ColorTranslator`. **Leave as-is** — not a KeyColor site.

---

## §0 — Open Questions (MUST be resolved before sprint start)

**OQ-1 — RESOLVED 2026-06-11 (Stephen): decision (a), strict parity.** "I asked
for 100% Pascal **functional** parity. If Pascal never fails, then we have to
never fail per the 100% parity rule. That overrides." Therefore **TS must never
reject or abort window-create on a bad/missing parameter** — it clamps (`Within`)
or leaves the value unchanged and continues, and always creates the window for a
valid display type (§Pascal-Spec col 5). Consequences for this sprint:
  - All `isValid = false` / `break` / early-return-on-bad-param paths in the
    create-parsers are **removed** (TERM already done); the `isValid` return
    becomes solely "is this a parseable declaration of a valid display type."
  - A "bad" set-two demo string yields a **clamped/default window**, not an
    error — so a demo that looks wrong is the *demo's* bug, not ours.
  - Existing informational `BAD DISPLAY: Received: …` logging is **non-gating**
    (a log line only; it never prevents creation). Keep it as a diagnostic; it
    does not change parity behavior.

  This also retires C4 as a *risk* and converts it into a concrete deliverable:
  hunt and remove every abort-on-bad-param across all 9 windows.

**OQ-2 — RESOLVED 2026-06-11 (Stephen): both, per window.** Each window section
does create-parser parity first, then its runtime (`*_Update`) handler as a
second sub-task (splittable if scope runs long). §3 stands.

**OQ-3 — RESOLVED 2026-06-11 (Stephen): yes, promote.** Extract TERM's
`parseTermColor()` into a shared `DisplaySpecParser.parseKeyColor()`; every
directive-color site uses it; `parseColorKeyword` (bg+grid) is re-expressed on
top of it. §1 stands.

**Questions pass: EMPTY.** All open questions resolved — the plan is ready to
start (`sprint-start`).

---

## §1 — Shared foundation: one KeyColor analog + numeric/clamp policy

**Why:** the centralization Stephen asked for. Today directive-color parsing is
split across `parseColorKeyword` (bg+grid), `parseDirectiveColor` (one string),
TERM's new `parseTermColor` (token-stream), plus per-window `new DebugColor(...)`
calls. Unify on one helper.

**Work:**
1. Promote `parseTermColor(lineParts, idx) → {rgb, nextIdx} | null` into
   `DisplaySpecParser.parseKeyColor(...)` (or `DebugColor.keyColor(...)`), the
   canonical KeyColor analog: directive NAME + optional brightness (RGBI8X,
   masked `&15`), BLACK/WHITE fixed (no brightness consumed), or numeric/`$hex`/
   `#rrggbb`; returns `null` on a non-color token (Pascal `Dec(ptr)`).
2. Re-express `DisplaySpecParser.parseColorKeyword` (background+grid) in terms of
   two `parseKeyColor` calls, preserving its return signature.
3. Repoint TERM's `parseTermColor` to the shared helper (keep a thin wrapper or
   inline). Confirm TERM's 7 tests still pass.
4. Establish the **numeric policy**: a tiny shared `clampInt(lineParts, idx,
   min, max, signed)` convenience (parse via `Spin2NumericParser` then
   `DisplaySpecParser.clamp`) so per-window sites become one-liners and no raw
   `Number()`/`parseInt()` survives for directive params.

**Verification:** unit tests for `parseKeyColor` (name, name+brightness,
BLACK/WHITE no-brightness, `$hex`, `#rrggbb`, non-color→null, end-of-stream→null)
and `clampInt` (decimal/`$hex`/`%bin`/underscore/out-of-range→clamp/garbage→null).
Existing `displaySpecParser.test.ts` + `debugTermWin.test.ts` stay green.

---

## §2 — Per-window create-parser parity

Each section is one task. Pattern per window: **(1) verify** cited sites against
current source + Pascal; **(2) fix** C1–C6 using §1 helpers + §Pascal-Spec
bounds; **(3) regression tests** for normal/edge/error cases; **(4) build green**.

### §2.1 SCOPE (`debugScopeWin.ts`, `parseScopeDeclaration` ~249)
- **State:** COLOR centralized (`parseColorKeyword` ~314 ✓); numeric via
  `Spin2NumericParser` + clamp (clean per audit). Channel colors hand-rolled
  (`new DebugColor`/`fromDefaultName` ~958-960) — correct systems.
- **Do:** confirm SIZE 32-2048, SAMPLES 16-2048, RATE 1-2048, DOTSIZE 0-32,
  LINESIZE **0**-32, TEXTSIZE 6-200 bounds match §Pascal-Spec; route channel
  colors through `parseKeyColor`; no abort paths.
- **Verify cases:** SAMPLES `$100`; DOTSIZE 0 (valid, dots-off); LINESIZE 0;
  COLOR name+brightness; trailing non-color after COLOR.

### §2.2 LOGIC (`debugLogicWin.ts`, `parseLogicDeclaration` ~275)
- **State:** COLOR centralized (~458 ✓). **C2/C3:** SPACING via raw `Number()`
  (~474) and **unclamped** (Pascal 1-32). Channel colors hand-rolled (~418).
- **Do:** SPACING → `Spin2NumericParser` + clamp 1-32; confirm SAMPLES 4-2047,
  RATE 1-2048, DOTSIZE 0-32, LINESIZE 1-32; channel colors → `parseKeyColor`.
- **Verify:** SPACING `%1000`; SPACING 99→32; SAMPLES 3→4.

### §2.3 SCOPE_XY (`debugScopeXyWin.ts`, `parseScopeXyDeclaration` ~350 +
`parseConfiguration`)
- **State:** **C2 heavy** — raw `parseInt` throughout (~722,768,775,783,790,
  800,807,826,839). **C5** — COLOR via `colorTranslator` numeric-only → **lost
  named-color support** (Pascal KeyColor accepts names). SIZE special:
  `Within(val*2, 32, 2048)`, h=w.
- **Do:** all numerics → `Spin2NumericParser`; COLOR (bg/grid + channel) →
  `parseKeyColor`; SIZE doubling+clamp; RANGE 1-$7FFFFFFF, SAMPLES 0-2048,
  RATE 1-2048, DOTSIZE 2-20.
- **Verify:** COLOR RED (named, previously broken); SIZE `$80`; RANGE `$7FFFFFFF`;
  DOTSIZE 1→2 (clamp up).

### §2.4 FFT (`debugFftWin.ts`, `parseFftDeclaration` ~929 → `createDisplaySpec`)
- **State:** COLOR centralized (~800 ✓) and channel color via `parseDirectiveColor`
  (~1232 ✓). **C2:** raw `Number()` for SAMPLES/FIRST/LAST (~673,696,703).
- **Do:** SAMPLES → `Spin2NumericParser`, then floor-power-of-two within 4-2048
  (`DisplaySpecParser.floorPowerOfTwoWithin`); FIRST 0…(N/2-2), LAST (first+1)…
  (N/2-1); RATE 1-2048, DOTSIZE 0-32, LINESIZE -32…32, TEXTSIZE 6-200.
- **Verify:** SAMPLES `1_024`; SAMPLES 768→512 (floor pow2); LINESIZE -3 (valid).

### §2.5 SPECTRO (`debugSpectroWin.ts`, `parseSpectroDeclaration` ~549 →
`createDisplaySpec`)
- **State:** No directive COLOR (uses KeyColorMode luma8/hsv16 — leave). **C2:**
  raw `Number()` for SAMPLES/DEPTH/MAG/RANGE/RATE/TRACE/DOTSIZE (~353,377,382,
  409,418,427,436,445).
- **Do:** all → `Spin2NumericParser`; SAMPLES floor-pow2 4-2048; DEPTH 1-2048,
  MAG 0-11, RANGE 1-$7FFFFFFF, RATE 1-2048, TRACE 0-255 (KeyVal: no clamp — set
  raw, matching Pascal), DOTSIZE x/y 1-16.
- **Verify:** DEPTH `$200`; MAG 12→11; RANGE `$7FFFFFFF`; DOTSIZE single + dual.

### §2.6 PLOT (`debugPlotWin.ts`, `parsePlotDeclaration` ~348)
- **State:** color modes via KeyColorMode (leave); BACKCOLOR hand-rolled
  `new DebugColor` (~445) — correct system; DOTSIZE raw `Number()` clamped 1-256
  (~423-429). Mostly correct; centralization-only.
- **Do:** BACKCOLOR → `parseKeyColor`; DOTSIZE → `Spin2NumericParser` (keep
  1-256 clamp); confirm SIZE 32-2048; LUTCOLORS entries → `parseKeyColor`.
- **Verify:** BACKCOLOR `$112233`; DOTSIZE `%1010`; DOTSIZE dual x/y.

### §2.7 TERM ✅ (`debugTermWin.ts`) — VERIFY-ONLY
- **State:** done this session. **Do:** after §1 promotion, confirm `parseTermColor`
  delegates to shared `parseKeyColor`; re-run the 7 tests; no behavior change.

### §2.8 BITMAP (`debugBitmapWin.ts`, `parseBitmapDeclaration` ~299)
- **State:** common via `parseCommonKeywords` (~341); LUTCOLORS/SPARSE hand-rolled
  but **guarded** (C1 false alarms confirmed: `while/if (i+1<length)` at 448/790).
  **C2:** raw `parseInt` for DOTSIZE/TRACE/RATE (~363,367,429).
- **Do:** numerics → `Spin2NumericParser`; SIZE 1-2048, DOTSIZE 1-256, TRACE
  0-255, RATE = KeyVal (any int; -1 sentinel→w*h, preserve); SPARSE + LUTCOLORS
  entries → `parseKeyColor` (keep color-MODE path on `ColorTranslator`).
- **Verify:** SET/SCROLL bounds (runtime §3); SPARSE name vs numeric; RATE -1
  sentinel preserved; TRACE `$0F`.

### §2.9 MIDI (`debugMidiWin.ts`, `parseMidiDeclaration` ~921)
- **State:** **C5** — COLOR via `new DebugColor(lineParts[i+1])` with **no
  brightness** (~711-713,987-988): drops the optional brightness token (Pascal
  KeyColor accepts `NAME [brightness]`). C1 guard `i+2<length` confirmed *safe*.
  **C2/C3:** SIZE/RANGE/CHANNEL via raw `parseInt`, key range unclamped (~515-518).
- **Do:** COLOR (on/off pair) → two `parseKeyColor` calls (gains brightness);
  SIZE 1-50, RANGE first 0-127 / last first-127, CHANNEL 0-15 via
  `Spin2NumericParser` + clamp.
- **Verify:** `COLOR CYAN 8 MAGENTA 4` (brightness now honored); RANGE 200→127;
  CHANNEL 16→15; SIZE 99→50.

---

## §3 — Runtime command-handler parity (per window, `*_Update`)

(Scope gated by **OQ-2**.) For each window, apply the same C1–C6 + numeric/color
policy to the runtime handler. Audit found runtime paths **C1-clean** (guarded),
so this is primarily C2 (numeric formats in data/command values) and C5 (runtime
COLOR/BACKCOLOR tokens → `parseKeyColor`). Notable surfaces:
- **TERM** runtime (codes 0-13) already verified clean this session.
- **PLOT** ~30 commands (SET/LINE/CIRCLE/TEXT/SPRITE/…): largest; numeric args
  via `Spin2NumericParser`; runtime COLOR/BACKCOLOR via `parseKeyColor`.
- **BITMAP** SET/SCROLL/RATE/TRACE: numeric via `Spin2NumericParser`.
- **SCOPE/LOGIC/FFT** TRIGGER/HOLDOFF param parsing.
- **MIDI** 3-byte note state machine (verify channel/velocity handling).

Each runtime handler is a sub-task of its window section; may split per OQ-2.

---

## §4 — Test strategy

- **Per-window regression tests** (`tests/debug*Win.test.ts`): for each fixed
  directive add normal + edge (clamp boundaries) + error (`$hex`, non-color,
  missing param, end-of-stream) cases. Follow the TERM template (7 tests added).
- **Shared-helper tests** (`tests/displaySpecParser.test.ts`): `parseKeyColor`
  and `clampInt` matrices (§1).
- **Acceptance via the example sets:** the documented example set must remain
  ≥ its current pass rate; the **new** example set is the real signal — re-run
  after the sweep and compare failure counts (expectation: most non-demo-bug
  failures clear). Demo-bug failures get triaged back to Stephen.
- **Run discipline:** `scripts/claude/run_tests_sequentially.sh` for full suite
  (never bare `npm test`); single files via `npm test -- <file>` during dev.
- **Build per window:** `npm run build` green after each window section.

---

## §5 — Documentation deliverable

- **Parsing-parity reference:** record the §Pascal-Spec bounds table + the
  two-color-path distinction as a durable doc (new
  `DOCs/project-specific/WINDOW-PARSING-PARITY.md`) so future windows/regens have
  the authoritative target in-repo.
- **Spec update:** note the centralized-parsing foundation + the
  **never-reject/always-clamp-and-create** policy (OQ-1 resolved) in
  `DOCs/project-specific/ARCHITECTURE.md` where parsing is described.
- (No `STYLE_GUIDE`/`HELP`/`MANUAL` voicing docs configured — those steps skip.)

---

## §6 — Build / verify gate per window

Definition of done for each window section: cited sites verified against source +
Pascal; C1–C6 addressed via shared helpers; bounds match §Pascal-Spec; no abort
paths (per OQ-1); regression tests added and green; `npm run build` clean. The
documented example set re-runs at or above baseline; the new example set re-runs
with failure delta recorded.

---

## §7 — Test-suite coverage & no-skip gate (foundation deliverable)

**Why:** a test the runner never invokes, or one marked `.skip`, is an invisible
failure. Stephen's standard: **no test is ever silently skipped** — it must be
enforced by the gate, not by vigilance. Verified state (2026-06-11): the runner
registers **154 of 161** present `tests/*.test.ts`; the gap is **6 unregistered**
files + **2 `it.skip`s** in `memoryLeakDetection.test.ts`. (Earlier "17 missing,
blast-radius uncovered" was a false count from a hyphen-excluding regex — the
BITMAP/MIDI/PLOT `.commands/.integration` tests are all registered.)

**Triage of the 6 unregistered + the internal skips:**
- **Drift → register (verify pass first):** `endSessionSentinel.test.ts`,
  `workerExtraction.test.ts` (no external deps, no internal skips).
- **Internal `.skip` → fix to run:** `memoryLeakDetection.test.ts` — register the
  file and make the 2 skipped tests deterministic (fake timers; isolate the
  DebugLogicWindow-mock timer pollution). If a timing test proves genuinely
  environment-dependent, escalate to Stephen — do **not** silently re-skip.
- **Hardware-capture-only → documented allowlist (CONFIRMED with Stephen):** the
  3 tests below read external HW capture artifacts under
  `test-results/external-results/` (gitignored; never committed; exist only on a
  hardware-connected machine post-run). They genuinely cannot run on CI / in the
  container. Keep excluded, **explicitly listed with reason** so they're never
  re-triaged:
  - `fftMultipleExecutions.test.ts` — needs external P2 capture
    (`test-results/external-results/*`), hardware-only, gitignored.
  - `fftRealHardwareComparison.test.ts` — needs `debug_251106-164458.log` HW
    capture, gitignored.
  - `spritedefRealUSB.test.ts` — needs an absent USB capture log, hardware-only.

**The gate (the durable fix):**
1. Add an explicit `EXCLUDED_TESTS` block to `scripts/claude/run_tests_sequentially.sh`,
   each entry paired with its reason (the 3 hardware-capture tests above).
2. Add a **coverage-guard step** (in the runner and in CI `ci.yml`) that **fails**
   if: (a) any `tests/*.test.ts` is neither registered nor in `EXCLUDED_TESTS`, or
   (b) any test source contains `.skip` / `xit` / `describe.skip` / `it.skip`
   outside an `EXCLUDED_TESTS` file. Drift and casual skips then break the build
   instead of hiding. The `EXCLUDED_TESTS` list IS the "don't re-address" record.
3. Register the 2 drift files; register + un-skip `memoryLeakDetection`.

**Verification:** after the gate lands, deleting a `run_test` line or adding a
stray `.skip` must turn the runner/CI red; the full suite count rises from 154 to
158 (154 + 2 drift + 2 un-skipped memory tests, in their files), with the 3
hardware-capture tests explicitly excluded-with-reason and 0 silent skips.

---

## Sequencing note (not part of the plan's commitments)

Suggested order once started (heaviest-parity-debt first, TERM is the template):
SCOPE_XY → MIDI → SPECTRO → FFT → LOGIC → BITMAP → PLOT → SCOPE → (TERM verify).
Order is a `sprint-start`/`plan-to-tasks` concern, not fixed here.

---

## Section ↔ task cross-reference (generated by `plan-to-tasks`, 2026-06-11)

Sprint tag: `parsing-parity`. Tasks `«#34»`–`«#45»`. "Order" = intended
implementation sequence (foundation → dependent); `todo_next` walks it.

| Plan § | Deliverable | Task | Order |
| ------ | ----------- | ---- | ----- |
| §1 | Shared `parseKeyColor` + `clampInt` foundation (incl. §2.7 TERM repoint+verify) | «#34» | 1 |
| §7 | No-skip test-coverage gate (register drift, un-skip memory, EXCLUDED_TESTS + CI guard) | «#35» | 2 |
| §2.3 | SCOPE_XY create+runtime parity (C2 heavy, C5 named-color restore) | «#36» | 3 |
| §2.9 | MIDI create+runtime parity (C5 brightness, C2/C3 key range) | «#37» | 4 |
| §2.5 | SPECTRO create+runtime parity (C2) | «#38» | 5 |
| §2.4 | FFT create+runtime parity (C2 samples/first/last) | «#39» | 6 |
| §2.2 | LOGIC create+runtime parity (SPACING C2/C3) | «#40» | 7 |
| §2.8 | BITMAP create+runtime parity (C2, sparse/lut color) | «#41» | 8 |
| §2.6 | PLOT create-parser parity (BACKCOLOR, DOTSIZE) | «#42» | 9 |
| §3 | PLOT runtime parity (~30 commands) | «#43» | 10 |
| §2.1 | SCOPE create+runtime parity (verify + channel colors) | «#44» | 11 |
| §2.7 | TERM verify-only | covered by «#34» | — |
| §5 | Documentation (WINDOW-PARSING-PARITY.md + ARCHITECTURE.md) | «#45» | 12 |

Each per-window task carries its create-parser fix and its runtime (`*_Update`)
handler as a 2nd in-task phase (OQ-2), tracked with `TaskCreate` subtasks during
execution. A task is done only at a green protection point (regression tests +
`npm run build` clean).
