# Sprint Closeout — Nine-Window Debug-DISPLAY Parity (Phase B)

**Closed:** 2026-06-16
**Branch:** `main` (no feature branch — per project convention)
**Build started:** `0.9.27` (2026-06-04); HW-validation tail shipped through `0.9.72`
**Sprint tag:** `9win-parity`
**Plan:** `DOCs/plans/archive/NINE-WINDOW-PARITY-FIX-SPRINT-PLAN.md`
**Backing study:** `DOCs/investigations/NINE-WINDOW-PARITY-AUDIT-PHASE-A.md`
**Verdict:** **CERTIFIED DONE.** All 20 task rows (§1–§18) SHIPPED and verified
against the live code; the §18 whole-application hardware pass is complete —
Stephen has HW-tested all 9 windows (sign-off 2026-06-16).

This document audits the **plan against the code** (not a commit inventory). The
§"Section ↔ task" cross-reference reconciled clean both directions: every numbered
section has a shipped commit tagged with its task id, and every task maps to a real
section.

---

## Per-section audit (PART A — shared roots)

| § | Deliverable | Task | Status | Evidence |
|---|---|---|---|---|
| §1 | PC_MOUSE wire-coordinate transform | #3 | **SHIPPED** | `fix(9win §1)` `a70521f` — base dispatch keyed on display type + `vDirX/vDirY/vDotSize`/margin; inverted per-window overrides removed. (LD-1 capture-time double-transform + LD-2 `electronAPI`-dead-IPC both fixed.) |
| §2 | PC_MOUSE LONG2 pixel color | #4 | **SHIPPED** | `fix(9win §2)` `4a7d3cb` — samples real canvas pixel, BGR→RGB swap; off-window `$FFFFFFFF`. |
| §3 | Parser clamps + `Trunc(log2)` floor | #5 | **SHIPPED** | `fix(9win §3)` `6cf120c` — per-window clamp constants; log2 round→floor; SCOPE_XY RATE/SAMPLES bound raised to 2048. |
| §4 | Color-keyword + default-color source of truth | #6 | **SHIPPED** | `§4a` `235e8f9` (SCOPE_XY clXxx defaults), `§4b-1` `fe8bcfa`+`05d76ae` (RGBI8X white-to-color math, `rgbi8xDirectiveColor.test.ts`), `§4b` `d2fa45f` (RGBI8X directive system vs clXxx defaults split). |
| §5 | RATE draw-throttle | #7 | **SHIPPED** | `feat(9win §5)` `52d5d30` — shared `RateCycle` for LOGIC + SCOPE. |
| §6 | CLEAR full state reset | #8 | **SHIPPED** | `fix(9win §6)` `28a0c7d` — per-window reset (rateCount / trigger / SetTrace / backcolor fill). |
| §7 | Create-time configuration parsing | #9 | **SHIPPED** | `feat(9win §7)` `759bf4b` — MIDI create-line config (was a stub); packed-mode/color at config. |

## Per-section audit (PART B — per-window residuals)

| § | Window | Task | Status | Evidence |
|---|---|---|---|---|
| §8 | LOGIC | #10 | **SHIPPED** | `6cf79ef` — no-abort directives, default-32 channels, RANGE bus-waveform, trigger/holdoff, grid `$404040`, lineSize 3. |
| §9 | SCOPE | #11 | **SHIPPED** | `5fa8610` — DOTSIZE/LINESIZE/TEXTSIZE, per-channel autoscale, legend bit-order. |
| §10 | SCOPE_XY | #12 | **SHIPPED** | `14d91aa` — `vGridColor`/opacity, on-screen readout, POLAR -1, SIZE clamp, channel cap. |
| §11 | FFT | #13 | **SHIPPED** | `790f7fe` — dropped invented RANGE/GRID, in-place channel redefine, pixel readout, 256×256, `DefaultScopeColors`. |
| §12 | SPECTRO | #14 | **SHIPPED** | `fcccecc` — noise floor removed, inclusive bin clamp, reject SIZE, HSV numeric tune, mouse readout. |
| §13a | PLOT coord model | #15 | **SHIPPED** | `4bc2510` — standalone PRECISE toggle, origin-at-draw, config DOTSIZE. |
| §13b | PLOT shapes/sprites | #16 | **SHIPPED** | `ff3daa4` — SPRITE flip/transpose orientations 0–7, OBOX rounded-rect. |
| §13c | PLOT update directives | #17 | **SHIPPED** | `f39c5f7` — OPACITY/BACKCOLOR/TEXTANGLE/color-mode + range fixes. |
| §14 | TERM | #18 | **SHIPPED** | `eceb243` + `9a20fbf` — runtime named colors, SET/CR-LF dispatch, 10pt font, clamps (test finalized 39 fail→0). |
| §15 | BITMAP | #19 | **SHIPPED** | `8643202` — RGB24 default, mode-gated tune, LUTCOLORS idx0, W-mode white bg. |
| §16 | MIDI | #20 | **SHIPPED** | `36e92e7` — black-key tweak table, note-off `-val`, flat-top keys, UPDATE no-op. |

## PART C — docs & verification

| § | Deliverable | Task | Status | Evidence |
|---|---|---|---|---|
| §17 | Documentation sync | #21 | **SHIPPED** | `docs(9win §17)` `8b81672` — DIRECTIVE-MATRIX new §8 TS-status column, CHANGELOG 0.9.27, per-window Theory-of-Operations, ARCHITECTURE/IMPLEMENTATION-STATUS/TEST-STATUS, TECHNICAL-DEBT (one deliberate BITMAP sparse deviation recorded). |
| §18 | Verification & parity sign-off | #22 | **DONE** | Incremental unit tests landed per section + registered in the runner. Final whole-application HW pass complete: Stephen HW-tested all 9 windows (2026-06-16). `ENABLE_CONSOLE_LOG=false` across all windows; section markers `[9win §N]` present in every window source. |

## §18 hardware tail (the long defect-fix arc)

The §18 whole-app HW exercise surfaced a sequence of parity/rendering defects that
were fixed across the v0.9.28 → v0.9.72 releases (all within this sprint's
"fix-every-parity-issue" scope, per Stephen 2026-06-04). The notable tail:
SAVE/capture correctness, the unified draw→SAVE flow (kills the
fire-and-forget-draw-vs-SAVE race class), MIDI held-chord SAVE, BITMAP SPARSE/UPDATE,
PLOT cursor drain, SAVE-WINDOW native chrome, and finally LOGIC crisp traces
(line-width-is-a-radius + Pascal amplitude, v0.9.72). All HW-confirmed by Stephen.

## Deviations / residuals (accepted)

1. **One deliberate BITMAP deviation** recorded in §17 (`TECHNICAL-DEBT.md`, BITMAP
   sparse) — left out of §15 scope with reason; not a parity regression.
2. **`loggerWin.ts` stale comment** — `ENABLE_CONSOLE_LOG = false` carries a leftover
   "Temporarily enabled" comment; the value is correct (off). Cosmetic, non-blocking.
3. **Disassembler/debugger** is a separate sprint (closed 2026-06-16, its own
   closeout) — not part of this nine-window scope.

## Exit baseline (verified 2026-06-16)

- `npm run build` clean (only the pre-existing `mainWindow.ts` esbuild direct-eval
  bundler notice — not a compiler warning).
- Sequential test suite (`scripts/claude/run_tests_sequentially.sh`):
  **Total 155, Passed 155, Failed 0 — "✅ All tests passed!"**
- Diagnostic logging off across all windows; §17 docs synced.

*Closeout authored 2026-06-16; plan-vs-code audit re-verified against the live
`src/classes/debug*Win.ts` + shared base. Spec authority: PNut v55
`DebugDisplayUnit.pas`.*
