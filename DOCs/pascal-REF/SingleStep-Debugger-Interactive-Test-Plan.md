# Single-Step Debugger: Interactive Test Plan

> **Purpose**: Validate the single-step debugger against real P2 hardware. Tests run
> simplest → most complex. Each test names the P2 program to load, the keys/clicks to
> press, and what you should see.
>
> **Prerequisites**: P2 board connected via USB (PropPlug or FTDI), PNut-Term-TS
> running, serial port selected. The P2 programs are pre-built `.spin2` files in
> **`SingleStep-Debugger-Test-Programs/`** (next to this plan).

---

## How to read this plan

- **You load a file per test — you don't type code.** Each test starts with a
  **▶ Load** line naming the `.spin2` file. Compile and download it with:
  ```bash
  pnut-ts -d testNN_xxx.spin2        # -d embeds the debug stub
  ```
  The debugger window opens by itself on download — every program sets
  `DEBUG_MAIN = 1` to break on the first instruction.
- **When two tests share a file, the ▶ Load line says "keep loaded"** — no reload.
- **Example values are illustrative.** Addresses and hex such as `1F6 00000001`,
  `BreakValue = $10`, or `$DEADBEEF` will differ on your build/hardware. Match the
  **behavior** described, not the exact digits.
- **A few names in *italics* are internal references** from the Theory of Operations
  (*dmPC* / *dmCog* / *dmHub* disassembly modes, *BreakValue*, *ExecMode*). They explain
  *why* something happens — they are **not labels you will see on screen**. Judge each
  step by the on-screen change it describes (which panel lights up, what a flag reads).
  In particular, ***BreakValue* is never shown as a number.** You see it only as **which
  break button is highlighted** (bright = that condition is armed, dim = not).
- **Two keys drive execution, and "go" ≠ "step".** **SPACE** = *Go-single* (a left-click
  on the Go button): resume and run until the **next armed break condition** is hit, then
  stop. **ENTER** = *Go-repeat* (a right-click on Go): resume and keep re-breaking
  continuously until you press ENTER again. When the armed condition is **MAIN**
  (Tests 1–11) a *Go-single* runs to the very next MAIN instruction — so SPACE behaves
  like "single-step one instruction." When the armed condition is an **event or address**
  (Test 13) a *Go-single* runs freely until that event/address fires — many instructions,
  not one. That is why some steps say **"(single go)"** rather than "single step".

---

## Screen layout — where things are

The tests name panels by **purpose** (WATCH, SFR, EVENT, SMART, …). Most panels are
**not labelled with that word on screen** — you locate them by *position* and by the
*visible text* inside them. This map is the key; every test refers back to it.

```
 ┌───────────────────────── Debugger - Cog N ──────────────────────────────┐
 │ HEADER:   C  Z    PC:xxxxx    SKIP-pattern     XBYTE     CT:clock(16 hex) │
 │ ┌────┐ ┌───────────────────┐ ┌─────┐ ┌──────────┐ ┌────────┐             │
 │ │REG │ │   DISASSEMBLY     │ │WATCH│ │SFR: IJMP3│ │ EVENTS │             │
 │ │LUT │ │  code; PC line    │ │reg  │ │  IRET3 ◄─┼─┼─ CT1   │  CT1 sits   │
 │ │heat│ │  highlighted      │ │delta│ │  …  INB  │ │  CT2 … │  across     │
 │ └────┘ └───────────────────┘ └─────┘ └──────────┘ │  QMT   │  from IRET3 │
 │   EXEC | STACK | INT | PTR (Fxx/PTRA/PTRB)         └────────┘ ┌─buttons─┐ │
 │   STATUS | PIN:  DIR / OUT / IN  (64-bit binary)              │BRK  INIT│ │
 │   SMART  (RQPIN one-row strip)                                │ADDR CT1↑│ │
 │   HUB data (addr + hex + ASCII)        | hub heatmap          │ …   MAIN│ │
 │                                                               │ [  Go  ]│ │
 │ HINT BAR (hover text)                                         └─────────┘ │
 └───────────────────────────────────────────────────────────────────────────┘
```

| Test calls it | Where on screen | Find it by (visible text) |
|---|---|---|
| **C / Z flags** | top-left of the header row | single `0`/`1` digits |
| **PC** | header, after the flags | 5 hex digits |
| **SKIP** | header, center | long 32-bit binary pattern (or `Suspended during INTx`) |
| **CT** | header, far right | 16 hex digits (8+8) — the always-changing clock |
| **REG / LUT heatmap** | the two tall strips on the **far left** | colored bitmap, no text |
| **Disassembly** | **center** | code lines `R-xxx …`; one line highlighted |
| **WATCH** | just right of disassembly | `addr value` register-change list |
| **SFR** | right of WATCH | register-name column `IJMP3 / IRET3 / … / INB` |
| **EVENTS** (event-flags list) | **far-right edge**, right of SFR | vertical `INT / CT1 / CT2 … QMT`, each with `0`/`1`. **`CT1` is across from `IRET3`.** |
| **EXEC** | below disassembly, left | reads `MAIN` / `INT1` / `INT2` / `INT3` |
| **STACK** | middle band | 8 hex values under `STACK` |
| **INT** | middle band, left | `INT1 / INT2 / INT3` with `off/idle/wait/busy` |
| **PTR** | middle band | rows `Fxx / PTRA / PTRB` + hub bytes |
| **STATUS** | lower band, left | `INIT / STALLI / STR / MOD / LUTS` |
| **PIN** | lower band | rows `DIR / OUT / IN` (64 binary digits each) |
| **SMART** | one-row strip below the PIN rows | `RQPIN△` + pin list |
| **HUB viewer / heatmap** | bottom band | address + hex + ASCII; colored heatmap to its right |
| **Break-condition buttons** | **bottom-right cluster**, around `Go` | `BRK, ADDR, INT3E…` (left col) · `INIT, CT1↑, INT3, INT2, INT1, MAIN` (right col) |
| **EVENT button** | in that cluster, right col, below `INIT` | reads **`CT1↑`** (event name + up-arrow) — there is **no** button labelled "EVENT" |
| **Go button** | bottom-right, the large button | reads `Go` / `Stop` / `Break` |
| **HINT bar** | very bottom | hover text |

---

## Validation sequence (run in this order)

This plan is a **release gate**, walked front-to-back in three escalating phases. Do
not skip ahead — each phase assumes the prior one passed, and a failure early is
cheaper to diagnose than the same defect surfacing inside a complex interrupt test.

| Phase | Goal | Tests | Test program(s) | Effort to set up |
|-------|------|-------|-----------------|------------------|
| **A — Visual verification** | *Look, don't touch.* Confirm the debugger window opens and every panel renders with correct layout/labels/colors **before** exercising any behavior. | **Test 0** | `test01` | Trivial — load and observe |
| **B — Core interaction** | Single-step, repeat, watch, disassembly navigation, buttons, header flags, SFR/stack/pointers, hub viewer, pins. | **Tests 1–9** | `test01`, `test03`, `test06`, `test07`, `test08`, `test09` | Simple Spin2/PASM loops |
| **C — Advanced / special code** | Features needing purpose-built P2 code: smart-pin watch, interrupts, multi-COG, event breakpoints. | **Tests 10–13** | `test10`, `test11`, `test12` | Hardware-feature-specific code |

**Test 14 (hint bar)** is not a phase of its own — exercise it opportunistically
throughout Phases B and C by hovering over each region as you reach it.

**Gate rule**: a phase passes only when every test in it passes. If everything in
Phases A–C passes (and the nine display windows pass their manual visual sweep), the
build is release-ready.

### Suggested load order (minimizes reloads)

Load each file **once** and run all of its tests before moving on. The only deviation
from strict numeric order is **Test 5**: it reuses `test01`, so do it together with
Tests 1–2 while that file is still loaded.

| Order | Load this file | Run these tests | Phase |
|-------|----------------|-----------------|-------|
| 1 | `test01_basic_spin.spin2` | **0**, **1**, **2**, **5** (+ 14 anytime) | A, B |
| 2 | `test03_pasm_regs.spin2` | **3**, **4** | B |
| 3 | `test06_flags_skip.spin2` | **6** | B |
| 4 | `test07_stack_ptr.spin2` | **7** | B |
| 5 | `test08_hub_writes.spin2` | **8** | B |
| 6 | `test09_pins.spin2` | **9** | B |
| 7 | `test10_smart_pin.spin2` | **10** | C |
| 8 | `test11_interrupts.spin2` | **11**, **13** | C |
| 9 | `test12_multicog.spin2` | **12** | C |

---

## Test 0: Visual verification (lightweight — no interaction)

**Status:** ✅ PASS (v0.9.81)

**▶ Load:** `test01_basic_spin.spin2`

**What this tests**: The debugger window opens and every panel is present, correctly
laid out, and correctly labeled/colored — a pure visual parity pass against the Pascal
screenshots, with **no stepping or clicking**. This catches layout and rendering-parity
regressions immediately, before any behavioral test muddies the picture.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Compile and download | A single debugger window opens, titled **"Debugger - Cog 0"**, at a sensible cascade position. |
| 2 | Observe the **header row** | **PC** (5 hex digits), **C** and **Z** flags ('0'/'1'), **SKIP** panel, **XBYTE** panel, and **CT** (16 hex digits split 8+8) all render with their labels. |
| 3 | Observe the **left column** | **REG heatmap** renders as a bitmap grid (cold/dark at rest). |
| 4 | Observe the **center** | **Disassembly** panel shows **R-xxx** cog-register addresses; the PC line is highlighted (inverse colors); a few decoded mnemonics are visible and read sensibly. |
| 5 | Observe the **data panels** | **WATCH**, **SFR** (two columns), **PTR**, **STACK**, and **EXEC** panels are all present with correct headings. |
| 6 | Observe the **pin/status panels** | **PIN** panel shows three rows **DIR / OUT / IN** (64 binary digits each, split 32+32); **STATUS** indicators (**INIT / STALLI / STR / MOD / LUTS**) render, dimmed when inactive. |
| 7 | Observe the **interrupt/smart panels** | **SMART**, **INT**, and the **events** panel render with labels. |
| 8 | Observe the **button column (right)** | All **13 buttons** in a two-column layout. **Go** button reads **"Go"** in bright orange. |
| 9 | Observe the **hub viewer** | Hub data viewer (8 rows × 16 bytes, 5-hex address + hex + ASCII) and the **hub heatmap** both render. |
| 10 | Observe the **hint bar** | Present and empty (no hover yet). |
| 11 | Side-by-side compare | Hold the layout up against the Pascal PNut debugger screenshot — panel positions, fonts, colors, and labels should match. |

**Pass criteria**: The window opens with **all** panels present and correctly
laid out/labeled/colored, matching the Pascal reference, with no interaction
required. Any layout or rendering-parity defect is logged here before Phase B.

ON HW TEST: PASS w/Version 0.9.81! (2026-06-23)

---

## Test 1: Basic connection — single step

**Status:** ✅ PASS (v0.9.82)

**▶ Load:** keep `test01_basic_spin.spin2` loaded (from Test 0).

**The program**: a Spin2 `repeat: x++` loop that runs forever.

**What this tests**: Debugger window opens, breakpoint protocol works, basic display renders.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Compile and download | Debugger window opens titled **"Debugger - Cog 0"** |
| 2 | Observe initial state | PC shows 5-hex address. C and Z flags show '0' or '1'. CT shows non-zero 16-hex-digit clock value. All 13 buttons visible in two-column layout on right side. Go button says **"Go"** in bright orange. |
| 3 | Press **SPACE** | PC advances by one instruction. Disassembly highlights new PC line with inverse colors (white background, green text). Register watch may show changed register. |
| 4 | Press **SPACE** 5 more times | PC advances each time. Register watch list populates with registers that change (3-hex address + 8-hex value). REG heatmap on left shows bright pixels where registers changed. |
| 5 | Wait 10 seconds (don't press anything) | Display stays **bright**; Go button stays **"Go"**. **It does NOT dim.** In single-step the cog idles *inside its own debug ISR* and keeps polling the host (~12 breaks/sec on the wire), so the host's 250 ms dim timer is continuously restarted and never fires. This is correct v55 behavior (Pascal `Breakpoint` restarts `BreakpointTimer` at `DebuggerUnit.pas:1932` on every break; `FormBreakpointTimeout` only dims when no break arrives for 250 ms). |
| 6 | Press **SPACE** | PC shows next instruction. Display still bright. |

**Pass criteria**: Window opens, PC advances on SPACE, register watch populates, display stays bright while idle-stepping.

> **Dimming is verified separately (free-run scenario, NOT single-step).** The dim
> + **"Break"** caption means *"this cog is running free and not hitting a break — press
> to force an asynchronous break."* To see it: set a break condition that is never met,
> then press **GO** (R-click / ENTER) so the cog runs free. After ~250 ms with no break the
> display dims and Go reads **"Break"** (dimmed orange); pressing it forces an async COGBRK
> and the display brightens. Async break requires another cog idling in its own debugger
> (Pascal hint, `DebuggerUnit.pas:1128`).

ON HW TEST (v0.9.82): **PASS — corrected expectation.** Window correctly stays bright
while single-step-idle; the earlier "didn't dim" was a test-spec error, not a defect.
Logs confirm 1380 breaks at ~12 Hz with no >250 ms gap (audit 2026-06-24).

---

## Test 2: Repeat mode — continuous execution

**Status:** ✅ PASS (v0.9.83)

**▶ Load:** keep `test01` loaded.

**What this tests**: ENTER key toggles repeat mode, ~20 breaks/sec throttling, Stop button.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | After debugger opens, press **ENTER** | Go button changes to **"Stop"**. Display updates rapidly (~20 times/sec). PC scrolls through instructions continuously. REG heatmap lights up showing active registers. |
| 2 | Observe disassembly | Disassembly auto-scrolls to keep PC visible. PC line highlighted. After 8 consecutive breaks in the same area, disassembly gradually scrolls PC toward line 4 (ideal position). |
| 3 | Press **ENTER** again | Execution stops (repeat mode off). Go button returns to **"Go"**. Display shows final state. PC frozen at last break address. |
| 4 | Press **SPACE** | Single step resumes. One instruction advances. |

**Pass criteria**: ENTER starts/stops repeat mode, display updates visibly, throttling prevents overwhelming updates.

ON HW TEST: visual green lines (center of each row, like a strikethrough) in the
disassembly **are EXPECTED — they are not a defect.** They are the SKIP-pattern
strikethrough (same feature as Test 6 step 4): each marked row is an upcoming
instruction the live SKIP pattern (`mBRKZ`, shown in the top **SKIP** panel) will skip.
The Spin2 bytecode interpreter (running here in cog $0) uses SKIPF/EXECF constantly, so
a non-zero skip pattern — and thus strikethroughs — is normal. **Which rows, and how
many at once, change continuously as the run proceeds because they track the live skip
pattern** (data-driven, not a constant overlay → proof it is correct, not a rendering
bug). Gated in Pascal by `SkipOn = (ExecMode=0) and (CallDepth=0)` and the per-row bit
test (`DebuggerUnit.pas:1530-1532`); our `shouldStrikeSkipped()` matches it exactly.

> **Rendering style — FIXED (not yet released).** Pascal draws each mark as a
> *half-row-height translucent band* (`SmoothShape(... ys shr 1 ..., cData2, opacity 160)`);
> we previously drew a *2 px solid line* at the row center (read as a harsh "crossed-out"
> line). `DebuggerRenderer.renderDisassembly` now draws a half-row translucent band
> centered on the row, matching Pascal. Which rows are marked was already correct.
> Recapture this view after the next build to confirm the band matches the reference.

ON HW TEST: pass v0.9.83

---

## Test 3: Register watch and reset

**Status:** 🔧 **RETEST — needs recompiled `test03` (v0.9.97 program fix)**; the app is correct

> **▶ Recompile + re-download `test03_pasm_regs.spin2`** — the program was fixed (see the
> note below). Then `pnut-ts -d test03_pasm_regs.spin2` and download the new `.bin`.

**▶ Load:** `test03_pasm_regs.spin2`

**The program**: a tight PASM loop that increments cog register **`count`** (~`$005`) and
decrements **`limit`** (~`$006`) — both **low** registers *inside* the watch range
(`$000..$1EF`), so they appear in the WATCH panel as they change.

**What this tests**: Delta tracking algorithm, R key reset, watch list display.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Press **SPACE** 3 times past initialization | WATCH panel (right of disassembly) shows the changed cog registers with addresses + values, e.g. `005 00000001` and `006 00000063`. |
| 2 | Press **SPACE** 3 more times | Watch values update — `count` increments, `limit` decrements. Changed values remain visible (counter=1000 on change). |
| 3 | Press **R** | Watch list clears completely. All 16 slots show delta (△) symbols. |
| 4 | Press **SPACE** | Watch repopulates with only the registers that changed on this step. |
| 5 | Click anywhere in the WATCH box | Watch list resets (same as R key). |

**Pass criteria**: Watch tracks changed registers, R key and click both reset, format shows 3-hex address + 8-hex value.

> **PROGRAM FIX (v0.9.97) — the empty-watch report was a test-program bug, not an app
> defect.** The old `test03` incremented **PA (`$1F6`) / PB (`$1F7`)** — but those are
> SPECIAL registers **above** the reg-delta watch range (`RegWatchSize = $1F0` → watch
> covers `$000..$1EF`, *identical* in Pascal `DebuggerUnit.pas:202/1543`). PA/PB changes
> show only in the **SFR panel**, never in the WATCH — so that program could never populate
> the panel it was meant to test (its own comment "Expected register watch: PA increments"
> was wrong). Rewritten to increment/decrement **low** registers `count`/`limit`, which the
> watch tracks. The app's watch logic is exact Pascal parity — no code change.

ON HW TEST: pass v0.9.83 — **SUPERSEDED**: that "pass" could not have shown PA/PB in the
watch (out of range); it verified the mechanism loosely. Re-verify on the recompiled program.

---

## Test 4: Disassembly navigation — modes and scrolling

**Status:** ✅ PASS (v0.9.86 — macOS shift-wheel + right-click plumbing fixed)

**▶ Load:** keep `test03` loaded.

**What this tests**: disassembly follow modes (*dmPC* follow-PC / *dmCog* cog-locked / *dmHub* hub), mouse wheel scrolling, click behaviors.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Observe disassembly | Shows **R-xxx** format addresses (cog registers). PC line highlighted with inverse colors. Currently following the PC (*dmPC*). |
| 2 | **Mouse wheel up** in disassembly box | Switches from PC-follow to cog-locked (*dmCog*). Disassembly scrolls up. PC highlight may scroll out of view. |
| 3 | **Ctrl+mouse wheel** | Scrolls by 4 instructions per tick (vs 1 without Ctrl). |
| 4 | **Shift+mouse wheel** | Scrolls by 16 instructions per tick. |
| 5 | **Left-click** in disassembly box | Returns to PC-follow (*dmPC*). Disassembly snaps back to show PC. |
| 6 | **Right-click** on a disassembly line | Toggles address breakpoint at that line. Breakpoint marker (●) appears in red at left edge. ADDR button highlights in button panel. |
| 7 | Right-click same line again | Breakpoint clears. Marker disappears. ADDR button dims. |
| 8 | Click on **REG heatmap** (left side) | Disassembly locks to that cog address (*dmCog*). Shows registers around clicked area. |
| 9 | Click on **PC** value in header row | Returns to PC-follow. |

**Pass criteria**: All three disassembly follow modes work, mouse wheel scrolls with modifiers, breakpoints toggle, heatmap click navigates.

ON HW TEST: v0.9.83 confirmed shift deosn't work, also right-click doesn't work. (right click help, does show) rest of steps pass

> **Both failures — FIXED (not yet released), macOS input plumbing, not logic.**
> The Pascal-faithful handlers underneath were correct; the bugs were in how the
> browser delivers two macOS gestures:
> - **Shift+wheel (step 4):** on macOS Chromium delivers Shift+wheel as a
>   *horizontal* scroll — `deltaX` carries the motion and `deltaY≈0`. The handler
>   read only `deltaY` (→ `Math.sign(0)=0`, no scroll). Fixed by folding whichever
>   axis carries the motion into one delta. (Ctrl-wheel worked because Ctrl does
>   not trigger the axis swap.)
> - **Right-click breakpoint (steps 6–7):** we detected right-click as `mousedown`
>   `button===2`, but a Mac secondary click is usually **Ctrl+click / trackpad
>   two-finger tap**, reported as `button 0 + ctrlKey` — so it never matched. (The
>   hover hint still showed because that is `mousemove`-driven, hence "help shows.")
>   Fixed by routing the secondary click through the `contextmenu` event (reliable
>   for real right-button, trackpad, and Mac Ctrl+click), driving left-clicks from
>   `mousedown`. **This same defect would have broken every right-click in Test 5**,
>   so Test 5's mouse steps are now unblocked by this fix.
>
> `src/classes/debugger/renderer/DebuggerInteraction.ts` (listener install block).
> Regression coverage added in `tests/debuggerInteraction.test.ts` (macOS input
> plumbing). **Recapture Test 4 — and proceed to Test 5 — after the next build.**

ON HW TEST: v0.9.84: shift+click works, right-click does not

> **Shift+wheel: CONFIRMED FIXED (v0.9.84). Right-click: still failing — under active
> diagnosis in v0.9.85.** With a PHYSICAL right mouse button, right-click failed in BOTH
> v0.9.83 (acted on `mousedown` button===2) AND v0.9.84 (acted on the `contextmenu` event),
> and ALSO fails for the button toggles in Test 5 — yet the SAME toggle works from the
> keyboard (Test 5 `M`/`D`/`I`). That proves the downstream toggle/render is correct and the
> right-button **event is not reaching the canvas handler** — anomalous, since a plain
> `mousedown` listener should receive every button. v0.9.85: (1) acts on a right-click from
> EITHER mousedown (button 2 / Mac Ctrl+left) OR contextmenu, deduped to one action per
> gesture; (2) **logs every pointer event** (type, button code, buttons mask, ctrl, coords)
> to the shared debug log. **NEXT HW CAPTURE:** right-click a disassembly line, then send the
> `debug-*.log` — the `[R/info] [MOUSE] …` lines will show exactly what your right button
> emits, making the fix deterministic.

ON HW TEST: v0.9.85: right-click does not yet work
ON HW TEST: v0.9.86: right-click WORKS ✅ (root cause: macOS/Electron delivers TWO mousedown+contextmenu pairs per physical right-press but only ONE mouseup; the per-event suppress flag let the 2nd mousedown double-toggle the action back off. Fix = whole-gesture latch released on mouseup.)

---

## Test 5: Breakpoint control buttons

**Status:** ✅ PASS (v0.9.86 — steps 3–4 expectations corrected to exact Pascal parity)

**▶ Load:** `test01_basic_spin.spin2` — *or do this test right after Test 2, while
`test01` is still loaded* (see Suggested load order).

**What this tests**: Left-click exclusive set, right-click toggle, button highlight states. (*BreakValue* below is the internal break-condition word — it is not shown on screen; watch the button highlights.)

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Observe buttons | MAIN button should be highlighted (active). All others dimmed. This matches initial *BreakValue* = break on MAIN. |
| 2 | **Left-click DEBUG** button | DEBUG highlights, MAIN dims. Only DEBUG condition active. *BreakValue* = $10. |
| 3 | **Right-click INT1** (plain) | **DEBUG dims, INT1 highlights.** DEBUG is *exclusive* to every single-step bit, so right-clicking any INT/MAIN clears it (Pascal `:768` masks with `$FFFFFFEF` before XOR). *BreakValue* = $02 (INT1 only). |
| 4 | **Right-click INT1** again | INT1 dims (toggle off). No break conditions remain, so the **top-left BREAK button highlights** — its "no condition set" indicator (Pascal `:1775`, `BreakValue and $6FF = 0`). *BreakValue* = $00. |
| 5 | **Left-click MAIN** | MAIN highlights exclusively; BREAK un-highlights. *BreakValue* = $01. |
| 5a | **Right-click INT1** | **Additive toggle:** INT1 highlights and **MAIN stays highlighted** (right-click INT1 only clears the DEBUG bit, which isn't set here). This is the additive-toggle behavior — it works when the base is MAIN/an INT, but NOT when the base is the exclusive DEBUG (step 3). *BreakValue* = $03 (MAIN + INT1). |
| 5b | **Right-click INT1** again | INT1 dims, MAIN stays. *BreakValue* = $01. |
| 6 | Press **I** key | INIT button toggles (independent bit 8). INIT highlights. MAIN stays highlighted. *BreakValue* = $101. |
| 7 | Press **I** again | INIT dims. *BreakValue* = $01. |
| 8 | Press **B** key | BREAK button action: clears all conditions except INIT. All mode buttons dim. |
| 9 | Press **M** key | MAIN toggles back on. |
| 10 | Press **D** key | DEBUG **toggles** on. MAIN stays as it was — `D` (right-click DEBUG) is a *toggle*, it does **not** clear MAIN. Only **left-click** sets a mode exclusively (clears the others). (Pascal `DebuggerUnit.pas:768` — RB DEBUG clears bit 4 then XORs it; MAIN bit 0 untouched. Note the asymmetry: `M`/RB-MAIN at :760 *does* clear DEBUG, but `D`/RB-DEBUG does not clear MAIN.) |

NOTE: `BreakValue = $xxx` is INTERNAL and never shown on screen (see this test's
preamble) — judge every step by the **button highlights**, not by a displayed value.
The `$xx` values are given only to explain what each click does internally.

**Pass criteria**: Left-click sets exclusively, right-click toggles independently, INIT always independent, keyboard shortcuts match button behaviors.

ON HW TEST: v0.9.84: 3, 4 don't work. and we have [->int1] and [int1] you are not specifying in test (since you don't say not the other one..) 

> **Button disambiguation (test clarified):** there are TWO INT1-related buttons —
> **"INT1"** (plain, `BREAK_INT1` = $02) and **"→INT1"** (the right-arrow *entry* button,
> `INT1E` = $20). Steps 3–4 mean the **plain "INT1"** button (yielding BreakValue $12 =
> DEBUG $10 + INT1 $02), NOT the "→INT1" entry button. Steps 3–4 fail for the SAME
> right-click delivery defect as Test 4 (see Test 4 note) — confirmed not a button-logic
> bug because the keyboard equivalents work: step 6 (`I`), 9 (`M`), 10 (`D`) all toggle
> correctly. Re-run 3–4 after the v0.9.85 right-click fix lands.

ON HW TEST: v0.9.86: right-click now delivers correctly, and the observed behavior is
EXACT Pascal parity — the ORIGINAL steps 3–4 expectations ($12 DEBUG+INT1) were WRONG and
are corrected above. Verified vs `DebuggerUnit.pas`: (a) DEBUG is mutually exclusive —
right-clicking INT1 clears the DEBUG bit (`:768` `and $FFFFFFEF`), so DEBUG turning off in
step 3 is correct, not a bug; (b) when all conditions clear (step 4 → $00), the top-left
BREAK button lights as the "no break condition set" indicator (`:1775`). Our
`DebuggerInteraction.ts` mirrors the Pascal formulas bit-for-bit. Added steps 5a/5b to
demonstrate the *additive* right-click toggle on a MAIN base — the coverage the old steps
3–4 were reaching for but couldn't get from an exclusive-DEBUG base.

ON HW TEST: v0.9.86 - PASS

---

## Test 6: Header display — flags, SKIP, XBYTE, CT

**Status:** ✅ PASS (v0.9.86 — needed test-program fix: `cmp … #9 wc`)

**▶ Load:** `test06_flags_skip.spin2`

**The program**: sets **Z** (`cmp wz`) then **C** (`cmp wc`), then a `skip #%1010` over the next four `nop`s (2nd and 4th skipped), then loops.

**What this tests**: Top row panels render correctly with proper bit extraction.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step **through** `cmp pa, #5 wz` (press SPACE so the instruction EXECUTES, i.e. PC moves past it) | **Z** flag shows **1** (equal). **C** unchanged. |
| 2 | Step **through** `cmp pa, #9 wc` | **C** flag shows **1** (P2 `CMP…WC` sets C on unsigned *borrow*: 5 < 9 → C=1). **Z** stays 1 (`wc`-only leaves Z). |
| 3 | Step past `skip #%1010` | **SKIP** panel shows **SKIP** label with 32-bit binary pattern. Bits corresponding to %1010 are set. |
| 4 | Step through skipped instructions | Skipped instruction lines in disassembly show semi-transparent strikethrough. Non-skipped lines render normally. |
| 5 | Observe **CT** panel | Shows 16 hex digits split into two 8-digit groups. Value increases on each step. Hover over CT to see elapsed seconds in hint bar. |
| 6 | Observe **PC** | Shows current address as 5 hex digits. Click PC to lock disassembly to follow PC. |

**Pass criteria**: C/Z flags update correctly, SKIP shows 32-bit pattern, CT increments, strikethrough appears on skipped instructions.

ON HW TEST: v0.9.84: nope step 2 no C flag - and don't you mean step thru so the instruction runs?

> **You're right — "step THROUGH", now corrected in steps 1–2.** The header C/Z reflect the
> flags AFTER the instruction at PC executes. When you merely step *to* `cmp …wc` it is the
> highlighted, not-yet-executed instruction, so C hasn't been written — that alone explains
> "no C flag". The C/Z extraction itself is verified correct (C = bit 31, Z = bit 30 of
> mIRET; `DebuggerState.cFlag/zFlag`). **Re-verify on HW after stepping THROUGH the
> `cmp …wc`:** C should read 1. If it still reads 0 after the instruction executes, THAT is a
> real defect — capture the step and flag it.

ON HW TEST: v0.9.86 C flag not set

> **ROOT CAUSE = test-program bug, NOT a debugger defect (v0.9.86).** The old program ran
> `cmp pa, #3 wc` with `pa = 5`. P2 `CMP…WC` sets **C only on unsigned borrow — C = 1 iff
> Dest < Src** (authoritative P2 spec; Pascal-independent). `5 < 3` is false, so C = 0, and
> nothing later touches C — the test could NEVER show C=1 regardless of the debugger. The
> program comment "(5 > 3, carry set)" had the carry convention backwards. The C/Z
> *extraction* is confirmed EXACT Pascal parity (`DebuggerState.cFlag` = `message[14] >>> 31`
> = Pascal `:1410` `DebuggerMsg[mIRET] shr 31 and 1`; Z = bit 30; PC = `& $FFFFF`). **Fix:
> the test program now does `cmp pa, #9 wc` (5 < 9 → C=1).** Recompile & re-download
> `test06_flags_skip.spin2`, then re-run — C should read 1 after stepping through it.

ON HW TEST: v0.9.86 PASS

---

## Test 7: SFR, stack, and pointer display

**Status:** ✅ PASS (v0.9.86 — AUGS double-step is correct v55 behavior, not a bug)

**▶ Load:** `test07_stack_ptr.spin2`

**The program**: sets PTRA/PTRB, `wrlong`s test values to hub, then `call`s a subroutine that `ret`s.

**What this tests**: Special function registers, hardware stack, pointer data windows.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step to after `mov ptra` | **SFR** panel shows `1F8 PTRA 00001000`. 16 SFR values visible in two columns. |
| 2 | Step to after `wrlong` | **PTR** panel shows `PTRA 01000` with 14 hex bytes around address $1000. Center byte (index 6) highlighted. ASCII column shows decoded characters. |
| 3 | Step to after `wrlong ptrb` | PTR panel shows PTRB row with data around $2000. Data should include the $CAFEBABE bytes. |
| 4 | Step into `call #subroutine` | **STACK** panel shows 8 hex values. STK0 (leftmost) contains return address. **EXEC** panel shows MAIN. |
| 5 | Step to `ret` | Stack level consumed (STK0 changes). PC returns to caller. |
| 6 | Click on **PTRA value** in SFR panel | Hub viewer navigates to address $1000. Hub data shows the $DEADBEEF bytes. |
| 7 | Click on **STK0 value** in stack | Disassembly navigates to that return address. |

**Pass criteria**: SFR values update correctly, pointer windows show hub data, stack shows call/return, click navigation works.

ON HW TEST: v0.9.84: space bar is stepping two instructions, is this due to AUGS preceeding? or do we need to debounce space bar?

> **AUGS — correct v55 behavior, NOT a debounce bug.** A `##` 32-bit immediate (e.g.
> `mov ptra, ##$1000`) compiles to **AUGS + the instruction** (two longs). P2 hardware
> treats an AUGS/AUGD prefix and the instruction it augments as **atomic** — it will not
> break (interrupt or debug single-step) between them — so one SPACE advances PC past BOTH
> longs. That is exactly what you'd see here (this program is full of `##` pointer loads).
> No debounce needed. (Sanity check: on a routine with NO `##`/AUG prefix, one SPACE should
> advance exactly one instruction. If it double-steps THERE too, that would be a real
> double-keydown bug — but the AUG case above is expected and matches PNut.)

ON HW TEST: v0.9.86 PASS

---

## Test 8: Hub memory viewer and heatmap

**Status:** ✅ PASS (v0.9.87 — heat decay made wall-clock-based so the trail is visible)

**▶ Load:** `test08_hub_writes.spin2`

**The program**: a tight loop writing each hub long across `hub[$00..$FF]`, then repeats.

**What this tests**: Hub data display, scrolling, nibble editing, heatmap visualization.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Run in repeat mode (ENTER), wait 2 seconds, press ENTER to stop | Hub heatmap (small bitmap right of hub data) should show bright area at low addresses ($000-$0FF). Rest of heatmap cold. |
| 2 | Observe hub data viewer | Shows 8 rows × 16 bytes. Address column shows 5-hex address. Data shows hex bytes + ASCII. |
| 3 | Press **DOWN arrow** | Hub address scrolls down by $10 (one row). |
| 4 | Press **UP arrow** | Hub address scrolls up by $10. |
| 5 | Press **PAGEDOWN** | Scrolls by $80. |
| 6 | Press **Ctrl+PAGEDOWN** | Scrolls by $1000. |
| 7 | Press **Shift+PAGEDOWN** | Scrolls by $10000. |
| 8 | **Mouse wheel** on hub address digits | Each click changes one hex nibble of the address. Scrolling on different digit positions changes different magnitude. |
| 9 | Click on hub **heatmap** bright area | Hub viewer jumps to that address. Data shows the written values. |
| 10 | Click on a hex byte in hub data | Hub viewer navigates to that byte's address. |

**Pass criteria**: Hub data renders correctly, all scroll amounts match spec, nibble editing works, heatmap click navigates.

ON HW TEST: v0.9.86 all steps work but HUB heatmap shows no content (just background color)

> **ROOT CAUSE = heat decay washout at high break rate; FIXED (time-based decay).**
> Single-stepping proved the mechanism works: a `wrlong` to a NEW hub address lights a
> single yellow sub-block pixel — which then *fades*. While a cog sits halted the P2
> re-breaks continuously (we hold it with `STALL_CMD`), and Pascal decays heat by
> `HIT_DECAY_RATE` on EVERY break (`DebuggerUnit.pas:1677-1688`). Pascal's slow GDI loop
> processed few breaks/sec → a visible ~1-2s trail; our fast offloaded pipeline processes
> breaks far faster → the sparse hub flashes (once per `wrlong`) washed out almost instantly,
> so 2-second repeat mode looked blank. (The REG map survives only because registers change
> on every advance, constantly re-flashing.) **Fix:** heat now decays by ELAPSED WALL-CLOCK
> TIME (`HEAT_FADE_MS`, ~2s full→cold) instead of per-break — break-rate independent,
> reproducing Pascal's intended trail on any hardware; applied to both hub and REG/LUT heat.
> `DebuggerController.heatDecayStep()`; tests in `debuggerDisplay.test.ts`. **Re-test:** in
> repeat mode the low-address area should now stay lit (fading over ~2s) rather than going
> blank. Ships in the next build.

ON HW TEST: v0.9.87 pass timeout might still be too short? but it does appear to be seconds now, so if matched pascal then good.

---

## Test 9: Pin registers and status indicators

**Status:** ✅ PASS (v0.9.87 — bit-orientation is exact Pascal parity; note added to steps)

**▶ Load:** `test09_pins.spin2`

**The program**: `drvh`/`drvl`/`fltl` to drive pins 0, 1, 16 and float pin 2, then loops.

**What this tests**: DIR/OUT/IN binary display, status indicators (INIT, STALLI, STR, MOD, LUTS).

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step past all `drv`/`flt` instructions | **PIN** panel shows three rows: **DIR**, **OUT**, **IN**. Each is 64 binary digits split 32+32 with byte separators. **Bit orientation (Pascal `DrawRegBin`/`:1461`): bit 0 is the RIGHTMOST digit (LSB-right, standard binary); the LEFT 32-bit group is pins 63–32 (…B register), the RIGHT group is pins 31–0 (…A register).** So a low pin like 0/1/16 appears in the **right-hand** group. |
| 2 | Examine DIR row | Bits 0, 1, 16 should be '1' (driven), Bit 2 '0' (floating), all others '0'. With bit 0 rightmost: the RIGHT half reads `… 00000001 00000000 00000011` — bit 16 is the rightmost digit of the 2nd byte-group, bits 0,1 in the last group. The LEFT half (pins 63–32) is all zeros. |
| 3 | Examine OUT row | Bit 0 = '1' (high), bit 1 = '0' (low), bit 16 = '1' (high). |
| 4 | Examine IN row | Shows actual pin input states from hardware. |
| 5 | Observe **STATUS** indicators | **INIT** highlighted if COGINIT occurred. **STALLI**, **STR**, **MOD**, **LUTS** dimmed unless those features are active. Labels in bright orange when active, dark when inactive. |

**Pass criteria**: Binary digits show correct pin states, three rows (DIR/OUT/IN) render properly, status indicators highlight correctly.

ON HW TEST: v0.9.87 PASS — bit-orientation query, NOT a defect. Display is exact Pascal parity
(`DrawRegBin` :2221 `for i := 31 downto 0` → bit 0 rightmost; `:1461-1462` draws the …B/high
register LEFT, …A/low register RIGHT). Driven low pins 0/1/16 correctly appear in the
right-hand 32-bit group; bit 16 sits in the same column on both DIR and OUT (`drvh #16` sets
both). The only inversion was the tester's assumption that bit 0 is leftmost — orientation
note added to steps 1–2 above. No code change.

---

## Test 10: Smart pin watch

**Status:** ✅ PASS (v0.9.88 — mechanism-verified by unit tests; DIR-filter has no HW visual gate)

**▶ Load:** `test10_smart_pin.spin2`

**The program**: configures pin 0 as a smart-pin NCO (`wrpin`/`wxpin`/`wypin`/`dirh`), then reads it with `rqpin` in a loop. (The SMART watch panel reads RQPIN itself via the debugger's Phase-3 smart-pin data, so it populates while the NCO runs regardless of the program's own `rqpin`/`rdpin` — the loop just keeps the cog busy.)

**What this tests**: Smart pin delta tracking, DIR filter, compressed data parsing.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step past smart pin setup | **SMART** panel shows `RQPIN△` label. |
| 2 | Step through `rqpin` repeatedly | Smart pin watch list shows `P00` + 8-hex RQPIN value. Value changes as NCO runs. |
| 3 | **Right-click** on smart pin watch box | **Clears the list** (box momentarily shows `RQPIN▲`) **and** toggles the "DIR-only" ↔ "all pins" filter; the list then repopulates as you step. The momentary clear is the visible cue that the click registered. NOTE: this program has only ONE active smart pin (P00), so both filter modes usually show just P00 — the filter difference only appears if another pin has a *changing* RQPIN. (SMART is a 1-row strip just below the DIR/OUT/IN rows — click squarely on it.) |
| 4 | **Left-click** on smart pin watch box | **Clears the list** (no filter change); it repopulates as you step. |
| 5 | Continue stepping | Watch repopulates with newly changed pins. |

**Pass criteria**: Smart pin values appear, delta tracking shows changes, DIR filter toggles, reset clears list.

ON HW TEST: v0.9.87 — FOUND + FIXED a parity bug: right-click on the SMART box only toggled
the filter without resetting, so the toggle hid behind the delta-decay counters and felt
unresponsive ("changes occasionally, can't tell why"). Pascal `:948-953` ALWAYS resets the
watch on a click (LB and RB) and RB *additionally* toggles the filter — so each click visibly
clears + repopulates. Fixed in `DebuggerInteraction.ts` (+2 regression tests). Re-test in the
next build. Separately, plan wording corrected: the program's read instruction is `rqpin`
(not `rdpin`) and setup ends in `dirh #0` (not `drvl`); step past `rqpin`. Not a defect —
the SMART watch panel reads RQPIN via the debugger's Phase-3 smart-pin data independently of
the program. Continue Test 10.

ON HW TEST: v0.9.88 — right-click on SMART "does nothing" VISIBLY, which is EXPECTED for this
program (fix IS in the 0.9.88 binary; NOT a regression). Two reasons: (1) the NCO smart pin
free-runs, so P00's RQPIN changes on every break — incl. the idle hold-breaks that stream
while halted — and repopulates within a frame of the reset, so the momentary clear is
imperceptible; (2) only pin 0 has DIR set, so DIR-only and all-pins show the identical list.
The reset+toggle IS firing (proven by the 2 unit tests). A VISUAL gate for the DIR filter is
architecturally INFEASIBLE with a clean program: the watch condition (`:1590-1592`) shows a
pin only if `(all-pins OR DIR[i]=1) AND RQPIN changed`, so all-pins adds over DIR-only ONLY a
pin with DIR=0 AND changing RQPIN — but on P2 you enable a smart pin by driving DIR high
(`dirh`, true for input/counting modes too), so every changing-RQPIN pin has DIR=1 (shows in
BOTH modes) and every DIR=0 pin is disabled → static RQPIN (shows in NEITHER). The only
difference case is spurious noise on a floating DIR=0 input — not a reliable gate. RESOLUTION:
Test 10 step 3 verified by the 2 committed unit tests (reset-only on LB; reset+toggle on RB,
exact Pascal parity); no HW visual demo. Step 3 = PASS (mechanism-verified).

---

## Test 11: Interrupt status and execution mode

**Status:** ✅ PASS (v0.9.94 — regressed v0.9.89–93 by the comms rework, re-fixed v0.9.94)

**▶ Load:** `test11_interrupts.spin2`

**The program**: enables INT1 on a CT1 event and waits for it; the handler re-arms CT1 and `reti1`s.

**What this tests**: INT1/INT2/INT3 display, execution mode (MAIN/INT1/INT2/INT3), SKIP suspension. (*ExecMode* below is the internal execution-mode value; on screen, read the **EXEC** panel.)

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 0 | **Enable the INT1 break condition** (prerequisite) | Left-click **MAIN**, then **right-click the plain `INT1` button** (right column, *not* `→INT1`) → BreakValue = MAIN + INT1 ($03). Without this the debugger breaks ONLY on MAIN, so the INT1 handler runs invisibly between steps and INT1 stays perpetually `wait` (armed) — you never see the interrupt. INT states are `off`→`idle`→`wait`→`busy` (Pascal `:2282`); `wait` = armed, `busy` = handler executing. |
| 1 | Step until interrupt fires | With MAIN+INT1 breaking, a step or two into `.idle` the pending CT1 fires and you break at the first handler instruction: **EXEC** panel changes from **MAIN** to **INT1**. |
| 2 | Observe interrupt status | **INT** panel shows `INT1 CT1 busy` (you are now *inside* the handler). INT2/INT3 show `off` (no event armed). |
| 3 | Observe SKIP panel | When *ExecMode* != 0 (inside INT1) it shows **"Suspended during INT1"** — the MESSAGE text is bright **WHITE** bold (Pascal `:1424`, cData); only the 32-bit pattern *behind* it dims to `cDataDim`. (test11 runs no `skip`, so that pattern is zeros — the white "Suspended during INT1" line is the thing to watch, appearing in the handler and vanishing on return to MAIN.) |
| 4 | Step through `reti1` | EXEC returns to **MAIN**. INT1 re-arms to **`wait`** (the handler's `addct1` re-armed CT1 — NOT `idle`/`off`). SKIP pattern becomes active again. |

ON HW TEST: v0.9.88 PASS — needed the step-0 enable-INT1 prerequisite (added). INT1 flips
busy↔wait as you step into/out of the handler; "Suspended during INT1" shows correctly in
WHITE bold (Pascal `:1424` cData, exact parity — the pattern behind it dims, the message does
not). Log `debug_260706-132450.log` confirmed clean single-owner framing (no errors/desync).

REGRESSED v0.9.89–v0.9.93, RE-FIXED v0.9.94 PASS — the comms rework
(0.9.89→0.9.93 per-cog demux / single-framer) shipped the new typed delivery path but left
the old direct main-side feed live, so every Phase-1 was delivered TWICE → two Phase-2 replies
per break → the P2's fixed-size Phase-2 read byte-desynced and the window went dead to input
(the startup break drew, then nothing responded). Wire-confirmed in
`usb-traffic_260715-124708.log` (break 2 = 2× Phase-2, both `$800` STALL). Fixed in v0.9.94 by
making the typed WindowRouter path the sole framing authority: the window registers
synchronously in its constructor and `debuggerPacketReceived` is creation-only (no direct
feed). test11 passes again on real HW.

**Pass criteria**: Execution mode changes on interrupt entry/exit, interrupt status shows correct event name and state, SKIP suspension message appears.

---

## Test 12: Multi-COG debugging

**Status:** ✅ PASS (v0.9.95 — Cert Pass 1 gate met; both cog windows step independently)

**▶ Load:** `test12_multicog.spin2`

**The program**: `cogspin` launches a second cog running its own loop; both cogs break (`DEBUG_COGINIT = 1`).

**What this tests**: Per-cog debugger windows, COGBRK async break.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Compile and download, then **run Cog 0 to the `cogspin`** | On download only **"Debugger - Cog 0"** opens — Cog 0 is halted at main()'s FIRST instruction, BEFORE the `cogspin` that launches Cog 1 (so Cog 1 doesn't exist yet; "two windows on download" was a wrong expectation). In the Cog 0 window press **ENTER (repeat mode)** (or step) so Cog 0 executes the `cogspin`; Cog 1 then launches, breaks on `DEBUG_COGINIT`, and **"Debugger - Cog 1"** auto-opens (cascaded). |
| 2 | In Cog 0 window, press SPACE | Cog 0 steps. Cog 1 window remains at its breakpoint. |
| 3 | In Cog 1 window, press SPACE | Cog 1 steps independently. |
| 4 | In Cog 0 window, press ENTER (repeat mode) | Cog 0 runs continuously. Cog 1 can still be independently stepped. |
| 5 | Press ENTER in Cog 0 to stop | Cog 0 halts. Both windows show independent state. |
| 6 | Observe hint bar when dimmed | If one cog is running and the other is halted, dimmed window hint should mention async break availability. |

**Pass criteria**: Multiple debugger windows open, each cog steps independently, COGBRK hint appears when applicable.

ON HW TEST: v0.9.88 — "2nd window didn't open" = EXPECTED with this program, not a code bug.
Log `debug_260706-133241.log`: Cog 0 stuck at PC=$0 (main's 1st break, BEFORE the `cogspin`),
zero Cog-1 activity. Multi-cog window creation IS implemented + cog-agnostic
(`mainWindow.ts:355` auto-creates `DebugDebuggerWindow(ctx, cogId)` per cog on first Phase-1)
— it just never got a Cog-1 packet because Cog 1 was never launched. Fix the run procedure
(step 1: run Cog 0 to the `cogspin`).

CONFIRMED (log `debug_260706-134258.log`): running Cog 0 to the `cogspin` DID launch Cog 1
(`Cog1 INIT $0000_0FA8 …` demuxed), but NO Cog-1 window formed — Cog 1's break traffic was
funneled into Cog 0's controller. ROOT CAUSE = **multi-cog single-step debugging is NOT
supported by the v0.9.80 single-owner comms model.** `extractionCore.ts:222`
`debuggerTransactionCog: number|null` tracks ONE cog: once Cog 0's first Phase-1 opens the
session the worker raw-passes ALL subsequent debug bytes to Cog 0 (tagged DEBUGGER0) and never
re-classifies a 2nd cog's Phase-1 → `debuggerPacketReceived` never fires for Cog 1, no window;
Cog 1's breaks mis-attribute into Cog 0 (its PC jumps around). Per-cog window CREATION is fine
(`mainWindow.ts:355`); the gap is the worker's single-cog transaction. FIX (non-surgical,
tractable — breaks are lock-atomic per cog, `lock[15]`, so NOT byte-interleaved): demux by the
Phase-1 cog-ID at the worker — emit DEBUGGER{cogId}, spawn that cog's window, route its raw
stream to its own controller; per-cog transaction map instead of a single `debuggerTransactionCog`.
DECISION PENDING: build the multi-cog fix vs defer as a known limitation. Test 13/14 are
single-cog and unaffected.

RESOLVED — multi-cog fix BUILT and HW-VALIDATED across v0.9.94 + v0.9.95:
- v0.9.94: per-cog window creation + single Phase-1 delivery (each cog registers its own
  `debugger-{cogId}` window synchronously; removed the double-feed) — both windows now open.
- v0.9.95: the worker is the SOLE Phase-3 framer and delimits each break by EXACT byte
  count (relayed FIXED size = popcount of the request bitmap the P2 obeys, + the
  interleaved 8-group smart-pin tail). This fixed the residual wedge where a repeat-mode
  cog's next break over-read into the halted cog's Phase-3. The old "stream verbatim until
  onPhase3Done" model assumed the P2 is halted between breaks — false when a 2nd cog runs.
ON HW TEST v0.9.95 PASS (log `debug_260715-171328.log`): both Cog-0 and Cog-1 windows open
and step INDEPENDENTLY — 60s sustained, Cog0 755 breaks / Cog1 533 (one Phase-2 per Phase-1
per cog), RX binary=0, zero cross-tag/over-read, zero spurious Phase-1. Cert Pass 1 «#74»
acceptance gate MET.

---

## Test 13: Event breakpoints

**Status:** ✅ **PASS (v0.9.97)** — event-name click arms the break (v0.9.96) + HUB-grid blink fixed (v0.9.97); HW-confirmed

**▶ Load:** keep `test11_interrupts.spin2` loaded (from Test 11) — it uses the CT1 event.

**What this tests**: Breaking on a specific hardware event (CT1) instead of on
instructions, and how the armed event is shown on screen.

> **Where these controls are — none are labelled with the words this test uses:**
> - **The event-flags list** = the tall column of 3-letter names at the **far-right edge**:
>   `INT, CT1, CT2, CT3, SE1 … QMT`, each with a `0`/`1` beside it. It sits just **right of
>   the register-name column** (`IJMP3, IRET3, IJMP2 …`) — landmark: **`CT1` is directly
>   across from `IRET3`**, on the same row.
> - **The "EVENT button"** = in the little **button cluster around the big `Go` button**
>   (bottom-right). It's the button reading **`CT1↑`** (the event name + an up-arrow),
>   right-hand column, **below `INIT`** and **above `INT3`**. There is **no** button that
>   says the word "EVENT"; it shows `CT1↑` (dim) even before you arm it.
> - **The "break value"** = never a number on screen. You read it as **which break button
>   is bright vs dim**. Arming CT1 makes the `CT1↑` button go **bright** — that is your
>   only visual confirmation.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | In the **event-flags panel** (the tall strip at the **top-right** listing `INT, CT1, CT2 … QMT`), **left-click the `CT1` name** | Selects **and arms** CT1 as the break event. The `CT1↑` button in the button matrix goes **bright**. *(This single click already arms it — see the note below.)* |
| 2 | *(Optional, redundant)* **Left-click the `CT1↑` button** in the button matrix | **No visible change** — it re-arms the identical condition. This just confirms the button is the same control as the name-click in step 1. |
| 3 | Press **SPACE** (*Go-single* — **not** a one-instruction step) | The cog runs **freely** until CT1 fires, then breaks **once**. PC jumps to wherever CT1 is serviced (a low cog address in this test) — **not** the next MAIN line. |
| 4 | Observe the **event-flags panel** | The **CT1** row reads its flag set ('1') at the break. Live values (CT counter, flags) refresh on every idle poll — see the flipping note below. |
| 5 | **Right-click the `CT1↑` button** | Disarms the event break; the `CT1↑` button goes **dim** again. |
| 6 | **Left-click the `MAIN` button** (labelled `MAIN`, bottom of the right column) | Re-arms MAIN single-step. SPACE now steps one instruction again. |

**Pass criteria**: arming CT1 (by *either* click) makes the `CT1↑` button bright; SPACE
runs to the CT1 event and breaks once; the CT1 flag reads '1' at the break; right-click
disarms it (button dims).

> **Fix note (v0.9.96):** before 0.9.96 the step-1 name-click *selected* CT1 but did not
> *arm* it — the `CT1↑` button never lit and SPACE never ran to the event (`onEventClick`
> set the event index but not the break value). Fixed to match Pascal
> (`DebuggerUnit.pas:827-839`: a name-click arms exactly like the button). **Requires a
> build ≥ 0.9.96 on hardware.**

ON HW TEST v0.9.97: **hub-grid blink RESOLVED** (log `debug_260717-143028.log`). ~3 min /
2113 breaks / zero framing anomalies; the HUB data panel at `$0` stays steady with no
flash or flicker (the `CT` clock still ticks, as expected). Wire capture showed only the
4-byte CT clock changing per break — every hub byte byte-identical — confirming the earlier
flip was the stale-frameBuf parse shift, now fixed (`processPhase1` authoritative frameBuf
clear). Remaining to close Test 13: confirm the event-break behavior end-to-end (left-click
`CT1` to arm EVENT *exclusively* so SPACE runs to the event rather than single-stepping —
right-click keeps MAIN set, which single-steps).

> **Steps 1 and 2 do the same thing — that's expected, not a bug.** Left-clicking the
> `CT1` name and left-clicking the `CT1↑` button run the *same* code path (Pascal
> `DebuggerUnit.pas:827` handles both), each setting the break value to
> `$200 | (CT1 << 12)`. The name-click *additionally* selects **which** event. So once
> you've clicked `CT1`, step 2 is only a confirmation — do it to prove the button works,
> or skip it.

> **Some "flipping" is expected; the HUB grid flip was a bug (fixed v0.9.97).** While the
> cog is stopped at a break it is **not frozen on the wire** — it idles inside its own
> debug ISR and the debugger polls it in a continuous ~12 Hz lockstep, **redrawing every
> poll** (same mechanism as Test 1 step 5). Two different things can appear to "flip":
> - **The `CT` clock (top row) and the CT1 event flag** genuinely change every poll (the
>   system counter is free-running) — that is **correct**, PNut shows it too.
> - **The HUB data grid (bottom) blinking between two value-sets at a *low* address** was a
>   **defect** — the wire hub bytes were provably identical every poll (only `CT` changed),
>   so the values were not actually changing. Cause: after stepping introduced changed-cog
>   blocks, an over-delivered Phase-3 tail left stale bytes in the frame buffer that shifted
>   the *next* break's parse, so `hubWindow` was read from the wrong offset and alternated.
>   **Fixed in v0.9.97** (the authoritative Phase-1 from main now drops stale leftover;
>   `DebuggerController.processPhase1`). The register snapshot was always byte-identical
>   across polls — that is how we knew the cog was held and the hub data was clean.

ON HW TEST v0.9.97: **PASS.** Event-name click arms CT1 (button lights), SPACE runs to the
CT1 event, and the HUB grid stays steady (no flash/flicker) over a sustained run. Closes the
event-breakpoint suite.

---

## Test 14: Context-sensitive hint bar

**Status:** ✅ **PASS (v0.9.97)** — hint strings Pascal-verbatim (doc corrected; the app was
already correct — steps 1/6/7 "diff text" was correct behavior)

**▶ Load:** any program — run this **throughout** Phases B and C by hovering as you go.

**What this tests**: Hint bar content changes based on mouse hover position.

### Interactions & Expected Results

> **The hint strings below are verbatim from Pascal `DebuggerUnit.pas` (verified
> 2026-07-17).** They are *action/label* hints, **not** live address/value read-outs — the
> earlier "Register $xxx = …" / "Hub address: …" style expectations were wrong (never in
> PNut). Match the wording; only the CT line and the event name interpolate live values.

| Step | Hover over (on-screen landmark) | Expected Hint Bar Content (exact) |
|------|--------|--------------------------|
| 1 | **REG heatmap** (tall strip, far left) | `Cog Register Bitmap/Heatmap \| Click to lock disassembly to REG subrange` — **no address/value** (that "nothing" is correct). Pascal `:640`. |
| 2 | **CT** clock (top-right, 16 hex) | `Clock Ticks Since Reset \| N.N seconds at 200,000,000 Hz` — 1 decimal, live. Pascal `:1833`. |
| 3 | **Go** button (bottom-right) | `L-Click or <SPACE> to execute to next break \| R-Click or <ENTER> to execute through breaks` (in repeat mode: `Click or <ENTER> to stop executing through breaks`). Pascal `:1909/1911`. |
| 4 | **MAIN** button (button cluster) | `L-Click to break on MAIN instructions (single-step) \| R-Click or <M> to toggle`. Pascal `:685`. |
| 5 | an **event name** (`CT1`…, far-right list) | `Event Flags \| L-Click to break on CT1 event \| R-Click to toggle` (event name follows the hovered row). Pascal `:654`. |
| 6 | **disassembly** (center) | `L-Click to lock to PC \| R-Click to toggle break address \| Mousewheel {+Ctrl/Shift} scrolls`. Pascal `:649`. |
| 7 | **hub data** (bottom grid) | `Hub Data \| Mousewheel {+Ctrl/Shift} scrolls`. Pascal `:668`. |
| 8 | Move mouse **off the window** | Hint bar clears. |

**Pass criteria**: Hint bar updates dynamically based on mouse position and shows the
**exact strings above** (Pascal-verbatim), clears when the mouse leaves.

> **Finer-grain nuance (not required to pass):** in Pascal, hovering directly over the hub
> **data bytes / ASCII** shows an *empty* hint (`:670-671`), and hovering the 5-hex **address
> column** shows `Hub Data | Mousewheel changes HUB address digit(s)` (`:669`); our build
> currently shows the single box hint (row 7) across the whole hub panel. Minor — flag if you
> want exact hub sub-region parity.

ON HW TEST v0.9.97: **PASS.** Hint bar shows the exact Pascal-verbatim strings above and
clears when the mouse leaves. (No code change — the app was already correct; the plan's old
expected strings were wrong and are now fixed.)

---

## Test summary matrix

| Test | Phase | Feature Area | Status | Load file |
|------|-------|-------------|--------|-----------|
| 0 | A | Visual verification (no interaction) | ✅ v0.9.81 | `test01_basic_spin.spin2` |
| 1 | B | Basic connection, single step | ✅ v0.9.82 | `test01` (keep loaded) |
| 2 | B | Repeat mode, throttling | ✅ v0.9.83 | `test01` (keep loaded) |
| 3 | B | Register watch, reset | 🔧 recompile test03 | `test03_pasm_regs.spin2` |
| 4 | B | Disassembly navigation | ✅ v0.9.86 | `test03` (keep loaded) |
| 5 | B | Button behavior | ✅ v0.9.86 | `test01` (reuse — do with Tests 1–2) |
| 6 | B | Header display (C/Z/SKIP/CT) | ✅ v0.9.86 | `test06_flags_skip.spin2` |
| 7 | B | SFR, stack, pointers | ✅ v0.9.86 | `test07_stack_ptr.spin2` |
| 8 | B | Hub memory viewer | ✅ v0.9.87 | `test08_hub_writes.spin2` |
| 9 | B | Pin registers, status | ✅ v0.9.87 | `test09_pins.spin2` |
| 10 | C | Smart pin watch | ✅ v0.9.88 | `test10_smart_pin.spin2` |
| 11 | C | Interrupts, exec mode | ✅ v0.9.94 | `test11_interrupts.spin2` |
| 12 | C | Multi-COG | ✅ v0.9.95 | `test12_multicog.spin2` |
| 13 | C | Event breakpoints | ✅ v0.9.97 | `test11` (keep loaded) |
| 14 | B/C | Hint bar | ✅ v0.9.97 | Any (run throughout) |

---

*Generated from the Single-Step Debugger Theory of Operations document and the
PNut-Term-TS implementation review. Companion P2 sources: `SingleStep-Debugger-Test-Programs/`.*
