# Sprint Closeout — SingleStep Debugger Parity

**Closed:** 2026-06-16
**Branch:** `main` (no feature branch)
**Build shipped:** `0.9.26` (2026-06-02), tag `ssdbg-parity`
**Plan:** `DOCs/plans/archive/SINGLESTEP-DEBUGGER-PARITY-SPRINT-PLAN.md`
**Verdict:** **CERTIFIED DONE (implementation).** All 9 task rows / 6 plan sections
SHIPPED and verified against the live code. The one remaining gate — a manual
functional test on external P2 hardware — is a follow-up (see *Residual items*),
mirroring how the Window-Parsing sprint tracked its HW pass after closeout.

This document audits the **plan against the code** (not a commit inventory),
re-verified during the 2026-06-16 audit pass.

---

## Per-section audit

| Plan § | Deliverable | Task | Status | Evidence (verified 2026-06-16) |
|---|---|---|---|---|
| §1 | Remove dead main-process debugger | #1, #2 | **SHIPPED** | `shared/debuggerInteraction.ts`, `shared/debuggerRenderer.ts`, `shared/debuggerResponse.ts`, `utils/performanceBenchmark.ts` all **deleted**. Commits `5efb14a`, `9755318`, `6829f60`. |
| §5(a) | Test-harness fixture + expand runner | #3 | **SHIPPED** | shared renderer-bundle fixture (`6a7bc8a`); runner expanded 70 → 157 files (`7ab4f2a`). |
| §4(a) | Disassembler field-extraction fix + repair tests | #4 | **SHIPPED** | old 59-mnemonic decoder replaced by `debugger/renderer/pasm2Disassembler.ts` (silicon-exact mask/match). Commit `8aa554f`. |
| §4(b) | Full PASM2 table (p2kb-driven) | #5 | **SHIPPED** | 347 mnemonics from authoritative p2kb encodings (`7329a3f`). Corpus test names 100% of 176 real-compiled longs. |
| §4(c) | SETQ/SKIP/ROM strings + golden-file test | #6 | **SHIPPED** | `disassemblerGolden.test.ts` (27, real `blink_pasm.bin` longs), `disassemblerCorpus.test.ts` (176). Commits `614ed71`, `977e37e`. Cross-instruction SETQ/AUG threading verified **correctly absent** (Pascal disassembles each long standalone) — locked by a context-free test. |
| §2 | 4 interaction gaps (COGBRK, nibble wheel, ptr offset, Tab) | #7 | **SHIPPED** | `debugger/renderer/DebuggerInteraction.ts`: COGBRK; hub-addr nibble wheel (`:241`); Tab capture (`:110`); pointer per-click offset. Commit `f9a793f`. |
| §3 | 2 display gaps (SKIP strikethrough, hub-heatmap decay) | #8 | **SHIPPED** | `debugger/renderer/DebuggerRenderer.ts`: `shouldStrikeSkipped` (`:86`); hub sub-block intensity decay (`:645`). Commit `22fb91b`. |
| §6 | Documentation sync + CHANGELOG 0.9.26 | #9 | **SHIPPED** | audit doc re-pointed at the live bundle; `TECHNICAL-DEBT.md` "ssdbg-parity Sprint — Deferred Items (v0.9.26)". Commit `c9fc9c8`. |

Beyond-plan: commit `4a0dc6a` closed a parity tail (hub-map click navigation,
TESTP AND/OR/XOR-effect variants) and verified AUG/SETQ already at parity.

## Operand-text coverage (clarification)

Operand-**text** rendering is implemented and spot-check regression-tested with
hand-verified expected strings — `pasm2Disassembler.test.ts` asserts exact operand
output for register/register (`$101, $102`), register/immediate (`$101, #$5`),
single-operand (`$040`), and augmentation forms; `disassemblerGolden.test.ts`
asserts AUGD `#$`-immediate rendering. The *only* thing not auto-verifiable in this
container is an exhaustive byte-exact text diff of all 347 mnemonics against the
original Pascal PNut disassembler — `pnut-ts` is a compiler and emits no
disassembly text to diff against. That is a "confirm on hardware / Pascal if a
discrepancy ever surfaces" note, **not** outstanding implementation work.

## Exit baseline (verified 2026-06-16)

- `npm run build` clean (only the pre-existing `mainWindow.ts` esbuild
  direct-eval bundler notice — not a compiler warning).
- Debugger-relevant suites green: `pasm2Disassembler` 9/9, `disassemblerCorpus`
  176/176, `disassemblerGolden` 27/27.
- Runner inventory expanded (157 of 160 `tests/*.test.ts`; the unregistered files
  are hardware-gated/integration suites excluded with documented reasons).

## Residual items (do not block closeout)

1. **Hardware functional test (the actual gate).** Manually exercise the debugger
   per `DOCs/SingleStep-Debugger-Operation-Guide-and-Audit.md` and the 12
   `DOCs/pascal-REF/SingleStep-Debugger-Test-Programs/test*.spin2` programs on a
   real P2. Implementation is HW-test-**ready**; the run itself is pending (owner:
   Stephen). Disassembler byte-exact operand-text parity (above) is confirmed on
   this pass if it ever needs confirming.
2. **Vestigial dead-code cleanup (small, safe).** `debugDebuggerWin.ts` still
   carries three orphans left by §1's excision, confirmed dead by caller-grep:
   `deferredMessages` (written `:66/:605/:629`, never read), `queueInitialMessage()`
   (`:150`, zero callers), `processQueuedMessages()` (`:159`, uncalled deprecated
   no-op). One-commit removal; recommended before/with the next debugger touch.

*Closeout authored 2026-06-16, audit pass re-verified against the live
`debugger/renderer/` bundle. Spec authority: `DebuggerUnit.pas`.*
