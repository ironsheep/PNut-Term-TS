# Sprint Closeout — Window Parsing Foundation Parity (0.9.47)

**Closed:** 2026-06-12
**Branch:** `sprint/window-parsing-parity-0.9.47` (off `main`)
**Plan:** `DOCs/plans/archive/WINDOW-PARSING-FOUNDATION-PARITY-SPRINT-PLAN.md`
**Verdict:** **CERTIFIED DONE.** All 12 commitments SHIPPED; exit baseline green and
improved vs. entry.
**Retrospective:** `DOCs/plans/archive/2026-06-12-Window-Parsing-Foundation-Parity-Retrospective.md`

This document audits the **plan against the code** (not a commit inventory). The
cross-reference table (plan §"Section ↔ task") reconciled clean both directions:
every numbered section has a task row and every task row maps to a real section.

---

## Per-section audit

| Plan § | Deliverable | Task | Status | Evidence |
|---|---|---|---|---|
| §1 | Shared `parseKeyColor` + `clampInt` foundation (+ §2.7 TERM repoint) | #34 | **SHIPPED** | `displaySpecParser.ts:86` (`parseKeyColor`), `:118` (`clampInt`); `parseColorKeyword` re-expressed on `parseKeyColor` (`:227`). commit `e847ffc` |
| §7 | No-skip / test-coverage gate | #35 | **SHIPPED** (deviation, accepted) | `scripts/claude/check_test_coverage.sh`; runner header `run_tests_sequentially.sh:15-16,180-183`. commit `990d4ce`. See *Deviation 1*. |
| §2.3 | SCOPE_XY create+runtime parity (C2 heavy, C5 named-color restore) | #36 | **SHIPPED** | `debugScopeXyWin.ts` uses `parseKeyColor` + `clampInt`; COLOR bg/grid `:827-830`, channel `:918`. commit `d03dd7e` |
| §2.9 | MIDI create+runtime parity (C5 brightness, C2/C3 key range) | #37 | **SHIPPED** | `debugMidiWin.ts` COLOR via `parseKeyColor` (on/off pair) `:711-723`, `:1010-1013`; SIZE/RANGE/CHANNEL via `Spin2NumericParser`+clamp. commit `c4142a8` |
| §2.5 | SPECTRO create-parser numeric parity (C2) | #38 | **SHIPPED** | `debugSpectroWin.ts` uses `clampInt`; SAMPLES/DEPTH/MAG/RANGE/RATE/TRACE/DOTSIZE no longer raw `Number()` (`:359` comment marks the conversion). commit `79eefb5` |
| §2.4 | FFT create+runtime parity (C2 samples/first/last) | #39 | **SHIPPED** | `debugFftWin.ts` uses `parseKeyColor` + `clampInt`; floor-pow2 SAMPLES; runtime numerics via `isSpinNumber` (`:1063,1085,1212`). commit `1622ce3` |
| §2.2 | LOGIC create+runtime parity (SPACING C2/C3) | #40 | **SHIPPED** | `debugLogicWin.ts` SPACING via `Spin2NumericParser`+clamp 1..32 (`:462`); `parseKeyColor` + `clampInt` adopted. commit `34a93f7` |
| §2.8 | BITMAP create+runtime parity (C2, sparse/lut color) | #41 | **SHIPPED** | `debugBitmapWin.ts` SPARSE/LUTCOLORS via `parseKeyColor` (`:252,273`); `clampInt` adopted; color-MODE tune kept on `&0xff` mask (`:520,529,1356,1364`). commits `783de18` + `732618a` (invented runtime DOTSIZE/SPARSE removed — parity) |
| §2.6 | PLOT create-parser parity (BACKCOLOR, DOTSIZE) | #42 | **SHIPPED** | `debugPlotWin.ts` BACKCOLOR/LUTCOLORS via `parseKeyColor` (`:463`); DOTSIZE via `clampInt`. commit `05c0964` |
| §3 | PLOT runtime parity (~30 commands) | #43 | **SHIPPED** | `debugPlotWin.ts` runtime numerics via `Spin2NumericParser`; runtime color via parse helpers. commit `c3a0b06`. See *Note A* (`processLutCommand`). |
| §2.1 | SCOPE create+runtime parity (verify + channel colors) | #44 | **SHIPPED** (deviation, accepted) | `debugScopeWin.ts` COLOR via `parseColorKeyword`; channel-color brightness via `Spin2NumericParser`&15; cross-window grid-default `$404040` fix. commit `7a4ccd0`. See *Deviation 2*. |
| §2.7 | TERM verify-only | (in #34) | **SHIPPED** | `debugTermWin.ts` `parseTermColor` delegates to shared `parseKeyColor`; 7 tests green (template, commit `b08e50d`) |
| §5 | Documentation (`WINDOW-PARSING-PARITY.md` + `ARCHITECTURE.md`) | #45 | **SHIPPED** | `DOCs/project-specific/WINDOW-PARSING-PARITY.md` (new); `ARCHITECTURE.md` parsing section (~line 1209) + shared-component inventory updated; README index entry. On-disk only — `DOCs/project-specific/` is gitignored (`.gitignore:250`, host bind-mount). |

---

## Deviations from plan (all accepted)

**Deviation 1 — §7 gate final shape (155 registered + 5 excluded, not 158 + 3).**
The plan predicted the suite would rise to 158 registered (154 + 2 drift +
2 un-skipped memory tests) with 3 hardware-capture exclusions. What landed:
**155 registered + 5 excluded-with-reason, 0 stray skips.** Two tests the plan
expected to *register* turned out genuinely environment-dependent and were
**excluded-with-reason** instead (the §7 escalation path — "if genuinely
environment-dependent, escalate; do not silently re-skip" — was followed):
- `tests/workerExtraction.test.ts` — worker_threads SAB round-trip does not
  deliver under Jest in-container (30s timeout); the worker serial path itself is
  HW-validated (#31).
- `tests/memoryLeakDetection.test.ts` — its profiler tests assert on real
  GC / wall-clock heap growth and hit DebugLogicWindow-mock timer pollution;
  non-deterministic under Jest.

The durable invariant — **0 silent skips, every exclusion carries a reason** — is
fully met. `check_test_coverage.sh` is the authoritative record.

**Deviation 2 — SCOPE channel colors stay surgical (#44).** Plan §2.1 proposed
routing SCOPE channel colors through `parseKeyColor`. Stephen chose the surgical
path: keep `DebugColor`/`Spin2NumericParser`&15 for channel/grid/text, route only
the COLOR background+grid directive through the centralized `parseColorKeyword`.
The cross-window root-cause fix (grid-default `$404040` sentinel) was the more
valuable part and shipped to SCOPE + LOGIC + FFT. Accepted at execution time.

---

## Notes (non-blocking, not carryover)

- **Note A — `debugPlotWin.ts:processLutCommand` (`:2411-2422`)** parses a runtime
  LUT color spec with its own `$`/`#`/name/decimal ladder rather than delegating
  to `parseKeyColor`. It is **format-complete** (handles all four forms correctly),
  so it is not a parity defect — only a missed centralization opportunity. Left
  as-is; record here so a future reader doesn't re-flag it as a C5 gap.
- **Dead code:** `debugScopeWin.ts:400-410` contains a commented-out
  `/* ORIGINAL PARSING … */` block with raw `Number()` SIZE parsing. Not live
  (the active path uses `DisplaySpecParser`). Candidate for a future cleanup
  sweep; harmless.

## Carryover

**None.** Every commitment shipped. No items moved out of scope; nothing added to
`tasks/PUNCH_LIST.md` from this sprint.

(Pre-existing, unrelated, out-of-scope from sprint start — **not** carryover from
this sprint, tracked separately on the board: #31 serial-offload finalize and #30
BITMAP RGB24 throughput, both awaiting HW validation. #25 broken-image was closed
during the sprint — already fixed in v0.9.31/v0.9.32.)

---

## Baselines

| | Build | Suite | No-skip gate |
|---|---|---|---|
| **Entry** (2026-06-11) | CLEAN (0 warnings) | 154/154 registered, 0 fail | did not exist |
| **Exit** (2026-06-12) | CLEAN (0 warnings) | **155/155 registered, 0 fail** | **green** (155 reg + 5 excluded-with-reason, 0 stray skips) |

**Health did not worsen — it improved:** +1 registered test, and the no-skip gate
now exists and is enforced in the runner and `check_test_coverage.sh`. No new
failures, no new silent skips. This exit baseline is the protection point the next
sprint climbs from.

---

## Verification mode

Verified on the **canonical test target** (local Node + Jest, sequential
in-container — `scripts/claude/run_tests_sequentially.sh`). Parsing parity is
unit-test-verified against the Pascal-spec bounds (per-window regression tests +
`displaySpecParser.test.ts` for the shared helpers). The parsing layer is
deterministic and fully exercised in-container; it does **not** depend on external
P2 hardware. (Hardware-only items #30/#31 remain separately HW-blocked and are out
of this sprint's scope.)
