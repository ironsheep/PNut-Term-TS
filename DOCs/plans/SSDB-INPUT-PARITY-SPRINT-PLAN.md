# SSDB Input-Command Parity — Sprint Plan

**Goal:** 100% Pascal parity for every mouse and keyboard command in the single-step debugger.
**Specification:** `DOCs/SSDB-INPUT-PARITY-AUDIT-2026-08-12.md` **Part A** is the authoritative
behavioral spec for this sprint. Part B is the gap list this sprint closes.
**Pascal source:** `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` (v55).
**Scope decision (Stephen, 2026-08-12):** *"we need 100% pascal parity."* All findings are in
scope, including the address-model change and the keyboard control-character behaviors.

## Target version — v1.0.1 (patch)

**v1.0.1**, per Stephen: *"it was intended function, we just missed it."* Every finding is a
place where the intended behavior was always Pascal's and the implementation is slightly off.
No user gains a capability they did not have; corrected behavior is a **patch**, and a minor
bump would advertise new capability that does not exist.

**Release-gate relationship:**
- **v1.0.0** — already tagged and published (artifacts live, still flagged pre-release by hand).
  Certified against **v1** of the interactive test plan. It ships on that certification; this
  sprint does not gate it.
- **v1.0.1** — ships this sprint, certified against **v2** (§9). This is the build the
  pre-release flag is cleared on and announced.

**Two things to carry in with eyes open — neither changes the version number:**
1. **§2 is not patch-shaped internally.** The `CogAddr`/`HubAddr`/`DisAddr` split touches the
   Phase-2 wire payload, so the risk profile is heavier than "1.0.1" implies even though the
   observable outcome is purely corrective. That is an argument for §9b's mandatory full
   Tests 0-14 regression re-run, not for a different number.
2. **The five Ctrl combos (§5) are the one user-noticeable addition.** Ctrl+C/D/K/L/M currently
   do nothing and will begin navigating the hub and triggering go-repeat. It is parity — PNut
   has always done it — but it is the only change someone could call new. The changelog entry
   must read as *keyboard commands now match PNut*, not as a new feature.

## Entry baseline

- Full sequential suite **176/176 green** on an idle container (2026-08-11, commit `0824632`).
- **CI on `main` is RED** — `streamShapes` I1 miscalibrated for CI runners, task «#86». Known,
  unrelated to this sprint, tracked separately. Not a blocker; do not "fix" by threshold-raising.
- `tests/debuggerInteraction.test.ts` — 298 lines, 18 tests, with reusable fixture scaffolding
  that all new tests in this sprint extend rather than duplicate.

## Corrections to the audit applied during this planning pass

Research on the repeat driver overturned two Part B findings. **The audit doc must be updated**
(§8) so it doesn't drive phantom work later:

- **F10 (stop-repeat doesn't reset `StallBrk`) — FALSE.** `setRepeatMode(false)` sets
  `stallBrk = STALL_CMD` itself (`DebuggerController.ts:639`). Behavior is correct; only the
  call site differs from Pascal's.
- **F11 (go-repeat sets `StallBrk`) — benign, not a defect.** Pascal's send path
  (`DebuggerUnit.pas:1331-1344`) ignores `StallBrk` entirely while repeating, and our port
  (`DebuggerController.ts:580-592`) matches it exactly, including the 50 ms `oldTickCount`
  throttle (`REPEAT_THROTTLE_MS = 50`). The extra `setStallBrk` is dead but harmless; §1 removes
  it for clarity only.
- **The GO state machine is therefore 4/4 at parity**, not 3/4.

---

## 1. Wheel: hub scroll magnitude and heat-map exclusion

**Why.** F1 is the largest user-visible error in the audit: the hub wheel moves 16× too far in
every modifier combination.

**Current code.** `DebuggerInteraction.ts:301` — `this.navHub(direction * hubMag * 16)`.
`hubMag` is already Part A's hub step **in bytes** (16 / 1 / 4 / 128), so the `* 16` is a
double-scale. `:288-303` tests only the HUB panel bounds.

**Target behavior (Part A §A.4).** Hub-area wheel: `HubAddr += HubStep` — 16 bytes plain,
1 byte with Ctrl, 4 with Shift, 128 with Ctrl+Shift. The heat-map is **excluded**
(`InHubBox and not InHubMap`, `DebuggerUnit.pas:1008`): wheeling over the map does nothing.

**Work.** Drop the `* 16`. Add a hub-map rect test that returns without action, reusing the
existing `renderer.hubMapBoundsPx()` already used by the click path (`:211`) — no new helper.
Remove the dead `setStallBrk` in `onGoRightClick` (`:427`) per the correction note above.

**Verification.** *Normal:* each of the four modifier combos advances `hubAddr` by exactly
16/1/4/128 bytes per notch, both directions. *Edge:* wheel at `hubAddr` 0 wraps to `$FFFFF`
(mask, not clamp — hub is masked in Pascal); wheel exactly on the map rect boundary. *Error:*
wheel over the heat-map produces **no** state change and no render.

## 2. Address model: adopt Pascal's `CogAddr` / `HubAddr` / `DisAddr` split

**Why.** F4. This is the sprint's one structural change, and §3 cannot be done correctly
without it. Stephen's directive resolves the trade-off in favor of parity.

**Current model.** `state.disTopAddr` (`DebuggerState.ts:120`) is a single variable serving as
the disassembly top in **both** cog and hub modes. `state.hubAddr` serves only the HUB data
pane. **There is no `cogAddr`.**

**Pascal's model (Part A §A.0).** Three distinct concepts:
- `CogAddr` — cog/LUT disassembly lock address.
- `HubAddr` — **shared** by the HUB data pane *and* hub-mode disassembly. Scrolling one moves
  the other. This coupling is observable behavior.
- `DisAddr` — the *currently displayed* top line. In `dmPC` it is **derived** from the PC and
  is **never written back** into `CogAddr`/`HubAddr`.

**The trap this planning pass found.** Our auto-scroll (`DebuggerRenderer.ts:1051-1084`) writes
`disTopAddr` even in `dmPC`. A naive merge of `disTopAddr` into `hubAddr` would make the HUB
data pane chase the program counter — a **new** divergence, since Pascal's `dmPC` never writes
`HubAddr`. The three-concept split is what prevents this.

**Producer/consumer inventory of `disTopAddr` (complete, 19 sites).**

| Site | Role | Disposition |
|---|---|---|
| `DebuggerState.ts:120`, `:188` | declaration, reset | split into `cogAddr` + derived `disAddr` |
| `DebuggerRenderer.ts:536`, `:967`, `:1285` | read for render / line-address | read `disAddr` |
| `DebuggerRenderer.ts:1051-1084` | auto-scroll writes (dmPC) | write **`disAddr` only** — never `hubAddr` |
| `DebuggerInteraction.ts:282` | wheel scroll | §3: write `cogAddr` or `hubAddr` by mode |
| `DebuggerInteraction.ts:452`, `:458` | REG/LUT map click | write `cogAddr` (see §4) |
| `DebuggerInteraction.ts:493`, `:506` | SFR / stack click | write `cogAddr` or `hubAddr` by mode (§4) |
| `DebuggerController.ts:610-616` | **Phase-2 wire payload** | must request the window for the *effective* top |
| `tests/debuggerInteraction.test.ts:170`, `:176` | existing assertions | update to the new field |

**⚠️ This touches the wire.** `DebuggerController.ts:616` packs the address into the Phase-2
window request (`(bytes << 20) | (addr & 0xFFFFF)`). The effective displayed top must continue
to drive that request, or the P2 returns the wrong window and the disassembly renders garbage.
This is the highest-risk item in the sprint and the reason §2 lands before §3.

**Work.** Introduce `cogAddr`; make `disAddr` the derived display top; route hub-mode
disassembly through `hubAddr`. Keep the Phase-2 payload driven by the effective top.

**Verification.** *Normal:* in `dmHub`, scrolling the disassembly moves the HUB pane and vice
versa; in `dmCog`, neither touches `hubAddr`. *Edge:* `dmPC` following a moving PC leaves
`hubAddr` **unchanged** (the trap above — assert explicitly). *Error:* Phase-2 payload still
requests the window matching what is displayed, in all three modes — assert against a captured
Phase-2 buffer, not just state.

## 3. Disassembly wheel semantics

**Why.** F2, F3. Depends on §2.

**Current code.** `DebuggerInteraction.ts:275-284` — uses `hubMag` in hub mode and masks
`& 0x3FF` in cog mode.

**Target (Part A §A.4).** On the first wheel in `dmPC`, break the lock: switch to `dmCog`/
`dmHub` based on whether the **currently displayed** address is below `$400`, seeding the new
mode from that address (`DebuggerUnit.pas:986-998` — seeds from `DisAddr`, *not* from the PC;
our `:277` currently seeds from `state.pc`). Then:
- `dmCog`: `CogAddr := Within(CogAddr + DisStep, $000, $400 - DisLines)` — **clamped** to
  `$000..$3F0`, not masked.
- `dmHub`: `HubAddr := (HubAddr + DisStep shl 2) and $FFFFF` — the **disassembly** step ×4,
  long-aligned, writing the shared `HubAddr`.

**Verification.** *Normal:* cog mode steps 1/4/16/32 registers; hub mode steps 4/16/64/128
bytes and the HUB pane follows. *Edge:* cog scroll at the top clamps at `$000` and at the
bottom stops at `$3F0` with a full 16-line window — explicitly **not** wrapping to `$000`.
*Error:* first wheel in `dmPC` seeds from the displayed address, verified with a PC deliberately
far from the displayed top.

## 4. Click-region corrections

**Why.** F5, F6, F7, F8, F9, F13 — six independent region-handler defects, each small.

| # | Current | Target (Part A §A.2/§A.3) |
|---|---|---|
| F5 | right-click BREAK swallowed (`:344-366` has no `BREAK` case) | BREAK is **not button-sensitive**: either button does `BreakValue and $100` |
| F6 | `:450`, `:456` — no centering, `& 0x1FF` | `Within((relY shl 9 div h) - 8, $000, $1F0)`, LUT `+ $200`: clicked register lands **mid-window**, clamped |
| F7 | `:490` keys only on row < 6 | require **both** `value < $400` **and** row < 6 for code-pointer; else `dmHub` **and** `hubAddr` |
| F8 | `:508` sets `hubAddr` only | also set `disMode = dmHub` |
| F9 | `:557` handles hex columns only | ASCII column is its own region: `hubAddr += row*16 + column` |
| F13 | no guard | in hub mode, **refuse** a break address below `$400` (`DebuggerUnit.pas:876` `Exit`) |

**Verification.** *Normal:* each region performs its documented navigation. *Edge (F6):* clicks
at the very top and bottom of both maps clamp correctly and never exceed `$1F0` / `$3F0`.
*Edge (F7):* an interrupt vector holding a hub-range value routes to `dmHub`, not `dmCog` — the
specific case the current code gets wrong. *Error (F13):* right-click on a hub-mode line
resolving below `$400` leaves `breakValue` and `breakAddr` completely unchanged.

## 5. Keyboard: control-character parity

**Why.** F17, F18. Under the 100%-parity directive these are implemented, not ratified away.

**Current code.** `:158` derives letters from `e.code` (`KeyX`, physical position) and does not
inspect modifier state.

**Target (Part A §A.1).** Pascal dispatches on the **produced character**, uppercased
(`DebuggerUnit.pas:1041`). Two consequences:
1. Layout-correct dispatch — switch to the produced character rather than scan-code position.
2. Delphi delivers Ctrl+letter as control characters `#1..#26`, which **collide with the
   pseudo-codes `FormKeyDown` uses for the arrow/page keys** (`:1016-1028`). The collisions are
   reachable PNut behavior and must be reproduced:

| Combo | Char | Effect in PNut |
|---|---|---|
| Ctrl+C | #3 | hub view up one line |
| Ctrl+D | #4 | hub view down one line (**not** "toggle DEBUG") |
| Ctrl+K | #11 | hub page up |
| Ctrl+L | #12 | hub page down |
| Ctrl+M | #13 | ENTER → go-repeat |

Ctrl combos with no matching case (e.g. Ctrl+A `#1`, Ctrl+B `#2`) do nothing.

**Documented assumptions — verify what is verifiable, record the rest.** (a) Delphi's
`OnKeyPress` control-character delivery is inferred from the Pascal source, not observed on a
running PNut. (b) `KeyShift` is assigned only in `FormKeyDown` (`:1029`), which `Exit`s before
that line for these keys — so a real Ctrl+K uses a **stale** shift state for its page magnitude.
We implement the straightforward reading (current modifier state) and record the divergence in
the audit doc rather than reproduce a stale-state artifact.

**Verification.** *Normal:* all 13 Part A §A.1 commands still fire, case-insensitively.
*Normal:* the five Ctrl combos produce their table effects. *Edge:* Ctrl+B and Ctrl+A do
nothing. *Edge:* Alt/Meta+letter does nothing. *Error:* Space and Enter continue to work after
the character-based dispatch change — the specific regression risk of switching off `e.code`.

## 6. Hint layer

**Why.** F12, F15, F16.

- **F12** — `updateHint` (`:621`) subtracts a `2 * HALF_ROW_PX` title offset before indexing
  the 16-entry `EVENT_NAMES` (index 0 = `'INT'`), so hovering CT1 reads **"INT"**. The **click
  path is correct** and must not be touched. Remove the offset subtraction.
  *(Part A §A.0 documents why Pascal's `+1` exists — `BoxBoundary(..., EVENTt + 1 shl 1, 3,
  15 shl 1, 0)` at `:2081` starts the clickable strip one row down. This closes the
  "ambiguous +1" question standing in the project notes.)*
- **F15** — add the six missing hints: REG box, LUT box, hub tab, hub address, hub map, button
  box. Strings verbatim from Part A §A.5.
- **F16** — **remove** the invented smart-watch hint (`:614`); Pascal's is empty.

**Verification.** *Normal:* hovering each of the 15 event rows names that row's event.
*Normal:* all six new regions show their exact Pascal strings. *Edge:* hovering the smart-watch
box now yields an empty hint bar. *Error:* the click path's row→`breakEvent` mapping is
unchanged — assert it alongside the hint fix so the two cannot drift again.

## 7. Tests

Extend `tests/debuggerInteraction.test.ts` using its existing fixture scaffolding — **do not**
create a parallel harness or duplicate mocks (project rule: shared test utilities from the
start). Add coverage for every normal/edge/error case named in §1-§6.

Two tests need to assert beyond renderer state:
- §2's Phase-2 payload assertions require a captured Phase-2 buffer. Reuse the existing
  Phase-2 fixtures in `tests/debuggerPhase2Isolation.test.ts` rather than inventing new ones.
- §3's clamp-vs-wrap distinction must assert the **boundary value** (`$3F0`), not merely "did
  not change."

Existing assertions at `tests/debuggerInteraction.test.ts:170`, `:176` reference `disTopAddr`
and must be migrated with §2.

## 8. Documentation Blast Radius

`DOC_AUDIT_COMMAND` is **unset** for this project — no doc-audit instrument exists. This
section is composed **by hand** this once; `plan-to-tasks` should generate a task to build the
instrument (see `references/doc-audit-instruments.md`). *Unset means owed, not exempt.*

| Artifact | What changes | Note |
|---|---|---|
| `DOCs/SSDB-INPUT-PARITY-AUDIT-2026-08-12.md` | Part B findings marked closed; **F10 removed and F11 downgraded** per the corrections above; GO scorecard → 4/4; §5's two documented assumptions recorded | Part A is the spec — changes only if Pascal research corrects it |
| `DOCs/manual-source/SINGLE-STEP-DEBUGGER-MANUAL-SOURCE.md` | **Already stale today, independent of this sprint:** lines 171 and 499 claim the hub-heatmap click "is not yet wired," but it shipped 2026-06-03 and `TECHNICAL-DEBT.md:63` already records it RESOLVED. Remove the note. Then: the click table (`:153-167`) needs REG/LUT map, disassembly L/R, hub map, and hub ASCII rows; the **Event names** row must say a click *arms* the break, and its right-click cell is currently "—"; the keyboard section needs the five Ctrl combos | The manual is the input to the external manual — highest user impact |
| `DOCs/pascal-REF/SingleStep-Debugger-Theory-of-Operations.md` | §8.3 "Mouse Wheel Actions" (`:74`, `:940-941`) — reconcile against Part A §A.4, incl. the heat-map exclusion | Per the pascal-REF trust chain: this is *a reading*, Part A is derived directly from source |
| `DOCs/SingleStep-Debugger-Operation-Guide-and-Audit.md` | Its input-handling half is superseded by the new audit. **Mark superseded with a pointer** — do not maintain two copies | Duplication rule: one canonical copy, links from the others |
| `CHANGELOG.md` | Always in scope | User-facing voicing per the changelog guide |
| `DOCs/pascal-REF/SingleStep-Debugger-Interactive-Test-Plan.md` | **Revised to v2** — see §9. Amend non-discriminating steps (Test 4 step 8), add Phase D, re-stamp every per-test Status line after re-certification | The certification gate for the release shipping this sprint |
| `DOCs/PUNCH_LIST.md` | Register the sprint; retire items it closes | |
| Memory `single-step-debugger-audit.md` | Points at the superseded doc and lists gaps now closed | Re-point at the new audit |

**Checked and confirmed NOT in scope:** `DOCs/APP-HELP.md` and `DOCs/USER-GUIDE.md` — neither
documents debugger mouse/keyboard input (verified by grep, zero matches).

**No counts, sample-output transcripts, or README file lists are affected** — this sprint
changes interactive behavior, not printed output.

## 9. SSDB Interactive Test Plan **v2** — re-certification gate

The current plan (`DOCs/pascal-REF/SingleStep-Debugger-Interactive-Test-Plan.md`, Tests 0-14,
903 lines) certified the **pre-sprint** behavior and all its gates pass as of v0.9.97. This
sprint changes certified behavior, so **the release that ships it is gated on a v2 of that
document, re-certified on hardware.** This is a deliverable, not a follow-up.

### 9a. Why v1's passing gates are not evidence for this sprint

Established by inspection during planning — worth stating, because it determines v2's shape:

- **v1 is non-discriminating where it matters, not wrong.** Test 4 step 8 reads *"Click on REG
  heatmap → Disassembly locks to that cog address. Shows registers **around** clicked area."*
  That prose describes Pascal's `-8` centering, which we do **not** implement (F6) — our click
  puts the register on the top line. The step passes either way, because "around" cannot
  discriminate centered from top-of-window.
- **Where v1 *is* precise, it is correct and still valid.** Test 4 steps 3-4 ("4 instructions
  per tick", "16 instructions per tick") are exactly `DisDeltas` and will still pass after §3.
  **These steps are the model for v2's style.**
- **v1 is silent on most of the changed surface.** There is no hub-wheel magnitude step at all —
  which is precisely why F1, a 16× error, survived certification. Nothing covers the hub ASCII
  column, right-click BREAK, SFR/stack `dmHub` routing, the five Ctrl combos, or per-row hint
  naming.

**Consequence:** v2 must add a *measurement* class of exercise — exact expected values keyed to
Part A ("one notch advances `hubAddr` by exactly `$10`"), never prose like "scrolls the hub."

### 9b. Structure — one versioned document, not a replacement

v2 = the existing document, revised:

1. **Tests 0-14 retained as the regression base.** ⚠️ **Mandatory full re-run:** §2 changes the
   Phase-2 window request, so it can regress the execution/protocol behavior these tests
   certify. This is the sprint's main regression exposure.
2. **Amend non-discriminating steps** — starting with Test 4 step 8, which must state the
   clicked register lands **mid-window** (Part A §A.3), with a checkable expectation.
3. **New Phase D — Input Command Certification**, one exercise per Part A command, each citing
   the Part A rule it checks. Minimum coverage: the four hub-wheel magnitudes (§1); heat-map
   wheel does nothing (§1); disassembly↔HUB pane coupling in `dmHub` and `dmPC` **not** dragging
   the HUB pane (§2); cog-scroll clamping at `$3F0` rather than wrapping (§3); right-click BREAK
   (§4); REG/LUT map centering and clamp (§4); SFR/stack `dmHub` routing (§4); hub ASCII column
   click (§4); hub-mode break-address refusal below `$400` (§4); the five Ctrl combos (§5); and
   the event-row hint naming the hovered row (§6).

Author with the `test-playbook` skill. Test programs already exist in
`DOCs/pascal-REF/SingleStep-Debugger-Test-Programs/`; prefer extending them over new ones.

### 9c. Certification gate

The sprint is not complete until **every v2 gate passes on hardware** — Tests 0-14 as
regression plus all of Phase D. Per project convention this is a formal release gate, so
partial passes are recorded as failures with the observed behavior, not waived.

**Note on the doc feed:** Part A of the audit is the upstream source for the separate
single-step-debugger document. v2's Phase D and Part A must agree; if hardware shows Part A is
wrong about PNut, **Part A is corrected first** and the change flows to both v2 and the manual
source (§8).

---

## Open Questions

**None.** Both parties' questions are resolved:

- Stephen's four scope questions answered by the 100%-parity directive (recorded at the top).
- F10 and F11 resolved by tracing the repeat driver during this planning pass — both were
  planning-time discoveries that removed work rather than adding it.
- F4's shape resolved by the producer/consumer inventory: three concepts, not a merge, with the
  `dmPC` trap and the wire-payload risk identified.
- §5's two unverifiable Delphi behaviors are recorded as **documented assumptions with a stated
  implementation choice**, not open questions.

## Sequencing note

§2 → §3 is the only hard dependency (the address model gates the wheel semantics). §1, §4, §5,
§6 are mutually independent and can proceed in any order. §7 tracks whatever lands. §8 and §9
close the sprint.

---

## Section ↔ task cross-reference

Sprint tag: **`ssdb-input-parity`**. Generated 2026-08-12 by `plan-to-tasks`.

| Plan § | Deliverable | Task | seq | Depends on | Est |
| --- | --- | --- | --- | --- | --- |
| §1 | Hub-wheel magnitude + heat-map exclusion (F1, F14) | «#87» | 1 | — | 45m |
| §2 | Address model: CogAddr/HubAddr/DisAddr (F4) — **foundational, touches the wire** | «#88» | 2 | — | 4h |
| §3 | Disassembly wheel semantics (F2, F3) | «#89» | 3 | «#88» | 1h30 |
| §4 | Six click-region corrections (F5-F9, F13) | «#90» | 4 | «#88» | 2h30 |
| §5 | Keyboard control-character parity (F17, F18) | «#91» | 5 | — | 2h |
| §6 | Hint layer (F12, F15, F16) | «#92» | 6 | — | 1h15 |
| §7 | Test-coverage audit + shared-fixture conformance | «#93» | 7 | — | 1h |
| §8 | *(prerequisite)* Build the doc-drift instrument | «#94» | 8 | — | 2h |
| §8 | Documentation blast radius | «#95» | 9 | «#94» | 2h30 |
| §9a/b | Author Interactive Test Plan **v2** | «#96» | 10 | — | 3h |
| §9c | **Hardware re-certification — final gate** | «#97» | 11 | «#96» | 2h |

Total estimated effort: **~22.5 consecutive work-hours.**

**Notes on the ordering.**
- «#94» (doc instrument) is generated by the plan, not by choice: `DOC_AUDIT_COMMAND` is unset
  and the blast radius is non-empty. It precedes «#95» so the documentation task consumes real
  instrument output rather than the hand-composed list in §8 — *discovery before utilization*.
- «#88» is deliberately scoped as a **behavior-preserving refactor** so it ends green on its
  own; §3's semantic corrections are «#89»'s job. Without that split the pair would be an
  atomic green-unit, and neither half could reach a protection point alone.
- «#97» is last because a verification run certifies the tree it ran against — **any edit
  afterwards decertifies it.** All code, test, and documentation work lands first.
- **Not in this sprint:** «#86» (CI red — `streamShapes` I1 miscalibrated for CI runners) and
  «#84» (stream-shape NAME-CARDINALITY cell). Neither is an SSDB parity item.
