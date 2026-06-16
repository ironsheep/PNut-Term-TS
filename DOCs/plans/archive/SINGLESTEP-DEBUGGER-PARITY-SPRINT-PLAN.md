# SingleStep Debugger Parity — Sprint Plan

> **✅ CLOSED 2026-06-16 — shipped v0.9.26.** All 9 tasks / 6 sections CERTIFIED DONE.
> Closeout audit: `DOCs/plans/archive/CLOSEOUT-2026-06-16-SINGLESTEP-DEBUGGER-PARITY.md`.
> Residual (non-blocking): manual P2 hardware functional test (owner: Stephen) +
> small dead-code cleanup in `debugDebuggerWin.ts`. See closeout for details.

> **Type:** Sprint plan (ship commitment), not a study.
> **Goal:** Bring the single-step debugger to verified parity with the Pascal
> original (`DebuggerUnit.pas`) across interaction, display, and disassembly,
> remove the abandoned dead implementation, unit-test each fix, and reach
> **100% functional-test-ready** for external P2 hardware.
> **Spec authority:** `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` is canonical;
> where TS differs, Pascal is correct.
> **Source audit:** `DOCs/SingleStep-Debugger-Operation-Guide-and-Audit.md`
> (Part B), **re-pointed at the live code** and re-verified during this plan's
> research pass.
> **Build target:** `0.9.26` (agreed at sprint-start 2026-05-31; `version` in
> `package.json`, bumped at build-wrapup).

---

## Sprint-start record (2026-05-31)

- **Build number:** 0.9.26 (next rightmost increment from 0.9.25).
- **Tracking-readiness entry check:** Board clean — no tasks pending/in-progress,
  nothing to archive; context store empty. No leftover work to fold in.
- **Baseline-health entry check (entry baseline = GREEN):** `npm run build` clean
  (one pre-existing esbuild `direct-eval` notice in `mainWindow.ts` — a bundler
  notice, not a compiler warning). Maintained runner
  `scripts/claude/run_tests_sequentially.sh`: clean run summary —
  **Total 70, Passed 70, Failed 0, "✅ All tests passed!"** Sprint-relevant tests
  included and green (`disassembler.test.ts`, `debuggerRenderer.test.ts`,
  `debuggerProtocol.test.ts`, scope-XY suite).
  **⚠ Runner-inventory gap:** the runner lists only **70 of 183**
  `tests/*.test.ts` files; 113 are not exercised by it. Expanding the runner to all
  183 is folded into §5.
  **Exit-baseline assertion for closeout:** build clean + runner green (expanded
  inventory) + every sprint-touched test green, no new failures or skips.
  **⚠ Runner-inventory gap:** the runner lists ~70 of 183 `tests/*.test.ts`; 113
  are not exercised by it. Expanding the runner to all 183 is folded into §5.
  **Exit-baseline assertion for closeout:** build clean + runner green (expanded
  inventory) + every sprint-touched test green, no new failures or skips.

---

## Critical context — there are TWO debugger implementations

Research for this plan surfaced a fact that re-aims the sprint:

- **LIVE** = the renderer bundle under `src/classes/debugger/renderer/`
  (`DebuggerState/Controller/Renderer/Interaction/Phase3.ts`, entry `index.ts`).
  Injected into the BrowserWindow (`debugDebuggerWin.ts:2085`), owns its own
  canvas listeners, round-trips Phase 1/2/3 over typed IPC. **This is the only
  debugger the user drives.**
- **DEAD** = the main-process path: `shared/debuggerInteraction.ts` (750),
  `shared/debuggerRenderer.ts` (3140), `shared/debuggerResponse.ts` (256),
  `sendPhase2Response()`/`renderDebuggerDisplay()` in `debugDebuggerWin.ts`, the
  `debugger-key/click/wheel` listeners (`631-665`) + IPC handlers (`808-820`).
  Never reaches the served HTML; never transmits.

The original Part B work order cited the **dead** `shared/debuggerInteraction.ts`,
so its "missing click regions / no hover / disassemblyScroll TODO" findings
describe the abandoned code. **Re-verified against the live bundle, most of those
are already implemented.** The "move disMode into the window" prerequisite is
**withdrawn** — `DisMode` exists and is wired in `DebuggerState.ts:35` and the
bundle's interaction mutates it directly. This plan targets only the *genuine*
live-bundle gaps below.

### Parity scorecard (LIVE bundle, verified this pass)

| Layer | State |
|---|---|
| Keyboard | 11/12 (Tab unhandled — minor) |
| Mouse: Go + 13 buttons, REG/LUT-map lock, PC box, disassembly L/R, SFR/stack/event/pointer/hub/smart-pin clicks | ✅ implemented |
| Hover → hint bar | ✅ implemented (`DebuggerInteraction.ts:439-490`, mouseleave clear) |
| Protocol Phase 1/2/3 | ✅ complete & correct |
| Display panels | 20/22 fully rendered |
| Disassembler | full-decode architecture, **~25-30% instruction coverage** |
| Dead main-process duplicate | present, ~4,150 lines + 2 stray importers |

**Net:** interaction & display are near-complete; the real work is the
**disassembler** (large) + **dead-code removal** + a handful of small gaps +
tests + docs.

---

## § Open Questions

None blocking. Three "verify during implementation" items are folded into their
sections: (a) disassembler opcode-field width — existing `disassembler.test.ts`
shows failing assertions suggesting an encoding mismatch (§5); (b) hub-heatmap
decay model vs REG/LUT (§4.2); (c) pointer byte-vs-char offset math vs Pascal
L931-946 (§3.3).

---

## 1. Remove the dead main-process debugger implementation

**Why.** A single source of truth is a prerequisite for an honest parity claim;
the dead path already mis-led the first audit.

**Current code (confirmed dead, by importer trace):**
- `src/classes/shared/debuggerInteraction.ts` (750) — superseded by
  `debugger/renderer/DebuggerInteraction.ts`. Imported only by `debugDebuggerWin.ts`.
- `src/classes/shared/debuggerRenderer.ts` (3140) — superseded by
  `debugger/renderer/DebuggerRenderer.ts`. Imported by `debugDebuggerWin.ts` **and
  `src/utils/performanceBenchmark.ts:9`** (a dead/stale benchmark — assess & likely
  delete or re-point).
- `src/classes/shared/debuggerResponse.ts` (256) — Phase 2 now built in
  `DebuggerController.buildPhase2()`. Imported by `debugDebuggerWin.ts:34` **and
  `mainWindow.ts:279`** (verify the mainWindow use is dead before removing).
- In `debugDebuggerWin.ts`: `sendPhase2Response()`/`sendResponseBytes()`,
  `renderDebuggerDisplay()` (already no-op), the `keydown/click/wheel` listeners
  (631-665), the `debugger-key/click/wheel` IPC handlers (808-820), and the dead
  `interaction`/`responseGenerator` instantiations.

**Disposition for the maybe-live shared files** (decide each individually — some
may still serve the live serial↔bundle bridge): `debuggerDataManager.ts`,
`debuggerProtocol.ts`, `debuggerPhase3Receiver.ts`. Keep what the live Phase-1
forwarding path uses; delete the duplicated logic. Also assess
`performanceBenchmark.ts` as a whole.

**Safety (CODE-REPAIR discipline).** `debugDebuggerWin.ts` hosts the **live**
serial↔bundle IPC bridge. Before deleting any symbol, grep for live references;
delete only what the bundle path doesn't touch. Per CLAUDE.md, no `git restore`;
deletions are normal commits on the sprint branch.

**Verification.** `{{BUILD_COMMAND}}` + `tsc` clean; full suite green; debugger
opens and round-trips on a recorded session; grep proves zero live imports of the
deleted files.

## 2. Interaction gaps (4, small)

**Why.** Four genuine Pascal behaviors absent from the live bundle's
`debugger/renderer/DebuggerInteraction.ts`.

1. **Async COGBRK from Go button** (Pascal L732-737): when Go is clicked while the
   cog is *not* halted, request `COGBRK` for this cog (`RequestCOGBRK |= 1<<cog`)
   instead of no-op. The bundle's Go handler lacks the not-halted branch. Wire via
   the existing `onCogBrkRequest` IPC callback (`index.ts:57`).
2. **Hub-address nibble wheel** (Pascal L1004-1006): wheel over the hub-address
   digits changes the nibble under the cursor (`HubAddr += dir<<(4*(4-digit))`).
   `handleWheel` has no `InHubAddr` region branch.
3. **Pointer data/chr per-click offset** (Pascal L931-946): `onPointerClick`
   parses `relX` then discards it (`void relX;` ~L401); apply the byte/char column
   offset so clicks land on the right hub address.
4. **Tab capture** (Pascal WANTTAB, L533): swallow Tab so it can't move focus.
   Minor; include for completeness.

**Verification.** Unit test each against synthetic input → expected state mutation
(`requestCogBrk`, `hubAddr` nibble delta, pointer target addr, Tab swallowed).

## 3. Display gaps (2, small)

**Why.** Two Pascal draw behaviors missing/partial in
`debugger/renderer/DebuggerRenderer.ts`; everything else (20/22 panels) is verified
faithful.

1. **Disassembly SKIP strikethrough** (Pascal §6.6 / DebuggerUnit L793-794):
   instructions whose SKIP bit is set draw with a semi-transparent strikethrough.
   `renderDisassembly` (~L645-707) has PC highlight + addr-breakpoint marker but no
   strikethrough.
2. **Hub heatmap intensity decay** (Pascal §6.18): `renderHubMap` (~L616-639) does
   binary changed/unchanged; Pascal uses per-sub-block intensity decay like the
   REG/LUT maps. Bring it to graded decay using `hubSubBlocks` from Phase 3
   (which the bundle already receives).

**Verification.** Unit test the state→draw-decision functions (skip-bit set →
strikethrough emitted; sub-block hit values → expected intensity).

## 4. Disassembler — full PASM2 instruction-set parity

**Why.** User-chosen full parity; this is the sprint's center of mass. The live
decoder is `src/classes/shared/disassembler.ts` (used by
`DebuggerRenderer.ts:577`), ~466 lines, **~59 mnemonics (~25-30% of PASM2)**.

**Current code.** Generic condition-code table (all 16) and WC/WZ effects exist,
but: opcode-field extraction may be mis-width (existing `disassembler.test.ts` has
failing assertions — investigate first, Pascal/encoding is authoritative); and
entire classes are absent — CORDIC (QMUL/QDIV/QSQRT…), smart-pin (RD/WRPIN, AKPIN),
pin control (DRV*/FLT*/DIR*), hub-FIFO + SETQ/SETQ2 block, LUT ops, streamer,
ALTx, SKIP/SKIPF/EXECF operand display, bit-manip, DECOD/ENCOD, cog/lock control,
event/interrupt setup, AUGS/AUGD augmentation. ROM debug strings `$1F8-$1FF` exist
in the renderer (`DebuggerRenderer.ts:27-36`) and the cog/hub address formats are
correct.

**Scope bound — PASM2 only, no Spin2 bytecode (confirmed 2026-05-31).** The
Pascal debugger's disassembly window is PASM2-only: it decodes cog (`R-xxx`),
LUT, or hub machine instructions via `P2Disassemble(..., dmHub, addr)`
(`DebuggerUnit.pas:1554`). Spin2 bytecode is run by the interpreter (itself a
PASM2 program using XBYTE); the debugger shows the interpreter's PASM2, not the
bytecode. The XBYTE panel is a *status readout* of the XBYTE engine
(`mBRKC>>16 & $1FF` + C/Z-affected checkmark, Theory §6.4), **not** a bytecode
disassembler. So this section targets full PASM2 parity and explicitly does **not**
include a Spin2-bytecode disassembler — Pascal has none.

**Target behavior.** Complete the instruction table to full PASM2 coverage; fix
field extraction; add AUGS/AUGD, SETQ block annotation, and SKIP-pattern operand
rendering. **Drive every encoding from the authoritative source** (`p2kb-mcp`
PASM2 data / official P2 instruction CSV) — mask/match must be silicon-exact, not
hand-transcribed.

**Verification (window-porting "coverage matrix" applied to opcodes).** A coverage
list proving every PASM2 encoding is decoded (none silently absent); per-class unit
tests for added forms; a **golden-file test** disassembling a known compiled `.bin`
(the existing `.spin2` test programs) and diffing against `pnut-ts`/Pascal-expected
output.

## 5. Test harness & per-fix unit coverage

**Why.** Project standard: each fix carries a test; humans never test an
unvalidated system (test-playbook overlay).

**Current code.** `tests/` has `debuggerRenderer.test.ts`, `disassembler.test.ts`
(green at entry), `debugger_disassembler.test.ts` (uncovered by runner, green),
shared mock/util helpers. **The maintained runner lists only 70 of 183 test files**
— a real coverage hole found at sprint-start.

**Target.** A `DebuggerState` + synthetic-message/Phase-3 fixture reused across
§§2-3 tests; the §4 golden-file harness; **bring the runner up to all 183 files
(audit `ls tests/*.test.ts` vs the script) and register every new test file**.
Byte-perfect assertions on any data-stream path. (If any of the 113 currently-
uncovered files turn out to fail when added, surface as a scope decision — don't
silently drop them.)

**Verification.** `{{TEST_COMMAND}}` green incl. new files; coverage on new/changed
bundle code per project targets.

## 6. Documentation sync

**Why.** Docs currency is a deliverable (build-wrapup overlay); one doc is wrong.

1. **`DOCs/SingleStep-Debugger-Operation-Guide-and-Audit.md`** — rewrite Part B to
   cite the **live bundle** (it currently cites deleted dead files) and reflect the
   verified scorecard; mark resolved items as the sprint closes.
2. **`{{SPEC_DOC}}`** + `DOCs/project-specific/IMPLEMENTATION-STATUS.md` /
   `TEST-STATUS.md` — debugger → "parity-complete, hardware-test-ready."
3. **`DOCs/DEBUGGER-USER-MANUAL.md`** — verify each described behavior is now live
   (the manual already describes the full Pascal model).
4. **`TECHNICAL-DEBT.md`** — record any disassembler encodings deliberately
   deferred (target: none; log explicitly if any).

**Verification.** Each doc updated; the audit doc no longer points at deleted files.

---

## Sprint shape & sequencing (one sprint)

1. **§1 dead-code removal** — establishes a single implementation; unblocks clean
   reasoning for everything after.
2. **§4 disassembler** — largest; start early, runs in parallel (separate file)
   with the small gaps.
3. **§2 interaction gaps + §3 display gaps** — small, independent.
4. **§5 tests** — woven into each section; harness stood up alongside §4.
5. **§6 docs** — at close.

## Exit gate

Research complete and re-verified against live code; no open planning questions.
Plan ready for `sprint-start` (sets build number, runs entry baseline) →
`plan-to-tasks`.

*Authored 2026-05-31; scope re-verified against the live `debugger/renderer/`
bundle after discovering the dead duplicate. Pascal refs = `DebuggerUnit.pas`.*

---

## Section ↔ Task cross-reference

Tasks generated by `plan-to-tasks` 2026-05-31, sprint tag `ssdbg-parity`,
build 0.9.26. `seq` = creation order = `todo_next` walk order.

| Plan § | Deliverable | Task | seq | Deps | Est (min) | Model |
| --- | --- | --- | --- | --- | --- | --- |
| §1 (a) | Remove definitely-dead main-process debugger + orphaned tests | «#1» | 1 | — | 150 | opus |
| §1 (b) | Resolve maybe-live shared files (dataManager/protocol/phase3Receiver) | «#2» | 2 | #1 | 90 | opus |
| §5 (a) | Test harness fixture + expand runner to all files | «#3» | 3 | #1,#2 | 120 | sonnet |
| §4 (a) | Disassembler field-extraction fix + repair disassembler.test.ts | «#4» | 4 | — | 150 | opus |
| §4 (b) | Disassembler full PASM2 table (p2kb-driven) | «#5» | 5 | #4 | 360 | opus |
| §4 (c) | SETQ/SKIP/ROM strings + golden-file test | «#6» | 6 | #5 | 180 | opus |
| §2 | 4 interaction gaps (COGBRK, nibble wheel, ptr offset, Tab) + tests | «#7» | 7 | #3 | 150 | sonnet |
| §3 | 2 display gaps (SKIP strikethrough, hub-heatmap decay) + tests | «#8» | 8 | #3 | 120 | sonnet |
| §6 | Documentation sync + CHANGELOG 0.9.26 | «#9» | 9 | #1-#8 | 90 | sonnet |

Total estimate: 1410 min (~23.5 work-hours). §4 (a→b→c) is the center of mass
(~11.5h) and the disassembler track (#4-#6) is independent of the dead-code track
(#1-#2), so it can be picked up in parallel if a second agent is available;
solo execution walks `seq` order.
