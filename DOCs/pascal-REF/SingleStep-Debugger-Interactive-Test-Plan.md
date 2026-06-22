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
  pnut_ts -d testNN_xxx.spin2        # -d embeds the debug stub
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

---

## Test 1: Basic connection — single step

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
| 5 | Wait 10 seconds (don't press anything) | After ~250ms without a new breakpoint, display should **dim** (darker overlay). Go button caption changes to **"Break"** in dimmed orange. |
| 6 | Press **SPACE** | Display brightens immediately. Go button returns to **"Go"**. PC shows next instruction. |

**Pass criteria**: Window opens, PC advances on SPACE, register watch populates, dimming occurs after timeout.

---

## Test 2: Repeat mode — continuous execution

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

---

## Test 3: Register watch and reset

**▶ Load:** `test03_pasm_regs.spin2`

**The program**: a tight PASM loop that increments **PA** and decrements **PB** every pass.

**What this tests**: Delta tracking algorithm, R key reset, watch list display.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Press **SPACE** 3 times past initialization | WATCH panel (right of disassembly) shows PA and PB registers with their addresses and values. Format: `1F6 00000001` and `1F7 00000063`. |
| 2 | Press **SPACE** 3 more times | Watch values update. PA increments, PB decrements. Changed values remain visible (counter=1000 on change). |
| 3 | Press **R** | Watch list clears completely. All 16 slots show delta (△) symbols. |
| 4 | Press **SPACE** | Watch repopulates with only the registers that changed on this step. |
| 5 | Click anywhere in the WATCH box | Watch list resets (same as R key). |

**Pass criteria**: Watch tracks changed registers, R key and click both reset, format shows 3-hex address + 8-hex value.

---

## Test 4: Disassembly navigation — modes and scrolling

**▶ Load:** keep `test03` loaded.

**What this tests**: disassembly follow modes (*dmPC* follow-PC / *dmCog* cog-locked / *dmHub* hub), mouse wheel scrolling, click behaviors.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Observe disassembly | Shows **R-xxx** format addresses (cog registers). PC line highlighted with inverse colors. Currently following the PC (*dmPC*). |
| 2 | **Mouse wheel up** in disassembly box | Switches from PC-follow to cog-locked (*dmCog*). Disassembly scrolls up. PC highlight may scroll out of view. |
| 3 | **Ctrl+mouse wheel** | Scrolls by 4 instructions per tick (vs 1 without Ctrl). |
| 4 | **Shift+mouse wheel** | Scrolls by 16 instructions per tick. (NOTE: shift doesn't work on Mac?) |
| 5 | **Left-click** in disassembly box | Returns to PC-follow (*dmPC*). Disassembly snaps back to show PC. |
| 6 | **Right-click** on a disassembly line | Toggles address breakpoint at that line. Breakpoint marker (●) appears in red at left edge. ADDR button highlights in button panel. |
| 7 | Right-click same line again | Breakpoint clears. Marker disappears. ADDR button dims. |
| 8 | Click on **REG heatmap** (left side) | Disassembly locks to that cog address (*dmCog*). Shows registers around clicked area. (NOTE: Left click on Mac does nothing) |
| 9 | Click on **PC** value in header row | Returns to PC-follow. |

**Pass criteria**: All three disassembly follow modes work, mouse wheel scrolls with modifiers, breakpoints toggle, heatmap click navigates.

---

## Test 5: Breakpoint control buttons

**▶ Load:** `test01_basic_spin.spin2` — *or do this test right after Test 2, while
`test01` is still loaded* (see Suggested load order).

**What this tests**: Left-click exclusive set, right-click toggle, button highlight states. (*BreakValue* below is the internal break-condition word — it is not shown on screen; watch the button highlights.)

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Observe buttons | MAIN button should be highlighted (active). All others dimmed. This matches initial *BreakValue* = break on MAIN. |
| 2 | **Left-click DEBUG** button | DEBUG highlights, MAIN dims. Only DEBUG condition active. *BreakValue* = $10. |
| 3 | **Right-click INT1** button | INT1 highlights additionally (toggle on). *BreakValue* = $12 (DEBUG + INT1). DEBUG stays highlighted. |
| 4 | **Right-click INT1** again | INT1 dims (toggle off). *BreakValue* = $10 (DEBUG only). |
| 5 | **Left-click MAIN** | MAIN highlights exclusively. DEBUG, INT1 all dim. *BreakValue* = $01. |
| 6 | Press **I** key | INIT button toggles (independent bit 8). INIT highlights. MAIN stays highlighted. *BreakValue* = $101. |
| 7 | Press **I** again | INIT dims. *BreakValue* = $01. |
| 8 | Press **B** key | BREAK button action: clears all conditions except INIT. All mode buttons dim. |
| 9 | Press **M** key | MAIN toggles back on. |
| 10 | Press **D** key | DEBUG toggles on, MAIN cleared (mutual exclusion). |

NOTE: on Mac/Windows I don't see any BreakValue = $xxx

**Pass criteria**: Left-click sets exclusively, right-click toggles independently, INIT always independent, keyboard shortcuts match button behaviors.

---

## Test 6: Header display — flags, SKIP, XBYTE, CT

**▶ Load:** `test06_flags_skip.spin2`

**The program**: sets **Z** (`cmp wz`) then **C** (`cmp wc`), then a `skip #%1010` over the next four `nop`s (2nd and 4th skipped), then loops.

**What this tests**: Top row panels render correctly with proper bit extraction.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step to `cmp pa, #5 wz` | **Z** flag shows **1** (equal). **C** unchanged. |
| 2 | Step to `cmp pa, #3 wc` | **C** flag shows **1** (5 > 3, carry set). **Z** may change. |
| 3 | Step past `skip #%1010` | **SKIP** panel shows **SKIP** label with 32-bit binary pattern. Bits corresponding to %1010 are set. |
| 4 | Step through skipped instructions | Skipped instruction lines in disassembly show semi-transparent strikethrough. Non-skipped lines render normally. |
| 5 | Observe **CT** panel | Shows 16 hex digits split into two 8-digit groups. Value increases on each step. Hover over CT to see elapsed seconds in hint bar. |
| 6 | Observe **PC** | Shows current address as 5 hex digits. Click PC to lock disassembly to follow PC. |

**Pass criteria**: C/Z flags update correctly, SKIP shows 32-bit pattern, CT increments, strikethrough appears on skipped instructions.

---

## Test 7: SFR, stack, and pointer display

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

---

## Test 8: Hub memory viewer and heatmap

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

---

## Test 9: Pin registers and status indicators

**▶ Load:** `test09_pins.spin2`

**The program**: `drvh`/`drvl`/`fltl` to drive pins 0, 1, 16 and float pin 2, then loops.

**What this tests**: DIR/OUT/IN binary display, status indicators (INIT, STALLI, STR, MOD, LUTS).

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step past all `drv`/`flt` instructions | **PIN** panel shows three rows: **DIR**, **OUT**, **IN**. Each is 64 binary digits split 32+32 with byte separators. |
| 2 | Examine DIR row | Bits 0, 1, 16 should be '1' (driven). Bit 2 should be '0' (floating). All other bits '0'. |
| 3 | Examine OUT row | Bit 0 = '1' (high), bit 1 = '0' (low), bit 16 = '1' (high). |
| 4 | Examine IN row | Shows actual pin input states from hardware. |
| 5 | Observe **STATUS** indicators | **INIT** highlighted if COGINIT occurred. **STALLI**, **STR**, **MOD**, **LUTS** dimmed unless those features are active. Labels in bright orange when active, dark when inactive. |

**Pass criteria**: Binary digits show correct pin states, three rows (DIR/OUT/IN) render properly, status indicators highlight correctly.

---

## Test 10: Smart pin watch

**▶ Load:** `test10_smart_pin.spin2`

**The program**: configures pin 0 as a smart-pin NCO (`wrpin`/`wxpin`/`wypin`/`drvl`), then reads it with `rdpin` in a loop.

**What this tests**: Smart pin delta tracking, DIR filter, compressed data parsing.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step past smart pin setup | **SMART** panel shows `RQPIN△` label. |
| 2 | Step through `rdpin` repeatedly | Smart pin watch list shows `P00` + 8-hex RQPIN value. Value changes as NCO runs. |
| 3 | **Right-click** on smart pin watch box | Toggles between "DIR-only" and "all pins" filter. With "all pins", may show additional pins with non-zero RQPIN. |
| 4 | **Left-click** on smart pin watch box | Resets the smart pin watch list. |
| 5 | Continue stepping | Watch repopulates with newly changed pins. |

**Pass criteria**: Smart pin values appear, delta tracking shows changes, DIR filter toggles, reset clears list.

---

## Test 11: Interrupt status and execution mode

**▶ Load:** `test11_interrupts.spin2`

**The program**: enables INT1 on a CT1 event and waits for it; the handler re-arms CT1 and `reti1`s.

**What this tests**: INT1/INT2/INT3 display, execution mode (MAIN/INT1/INT2/INT3), SKIP suspension. (*ExecMode* below is the internal execution-mode value; on screen, read the **EXEC** panel.)

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step until interrupt fires | **EXEC** panel changes from **MAIN** to **INT1**. |
| 2 | Observe interrupt status | **INT** panel shows `INT1 CT1 busy`. INT2/INT3 show `idle` or `off`. |
| 3 | Observe SKIP panel | Should show **"Suspended during MODE"** (dimmed) when *ExecMode* != 0 (inside INT1). |
| 4 | Step through `reti1` | EXEC returns to **MAIN**. INT1 status changes to `idle`. SKIP pattern becomes active again. |

**Pass criteria**: Execution mode changes on interrupt entry/exit, interrupt status shows correct event name and state, SKIP suspension message appears.

---

## Test 12: Multi-COG debugging

**▶ Load:** `test12_multicog.spin2`

**The program**: `cogspin` launches a second cog running its own loop; both cogs break (`DEBUG_COGINIT = 1`).

**What this tests**: Per-cog debugger windows, COGBRK async break.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Compile and download | **Two** debugger windows open: "Debugger - Cog 0" and "Debugger - Cog 1". Windows cascaded by offset. |
| 2 | In Cog 0 window, press SPACE | Cog 0 steps. Cog 1 window remains at its breakpoint. |
| 3 | In Cog 1 window, press SPACE | Cog 1 steps independently. |
| 4 | In Cog 0 window, press ENTER (repeat mode) | Cog 0 runs continuously. Cog 1 can still be independently stepped. |
| 5 | Press ENTER in Cog 0 to stop | Cog 0 halts. Both windows show independent state. |
| 6 | Observe hint bar when dimmed | If one cog is running and the other is halted, dimmed window hint should mention async break availability. |

**Pass criteria**: Multiple debugger windows open, each cog steps independently, COGBRK hint appears when applicable.

---

## Test 13: Event breakpoints

**▶ Load:** keep `test11_interrupts.spin2` loaded (from Test 11) — it uses the CT1 event.

**What this tests**: Breaking on specific events, EVENT button behavior.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Click on **CT1** event name in events panel | Sets BreakEvent to CT1 (event index 1). |
| 2 | **Left-click EVENT** button | EVENT button highlights. *BreakValue* includes bit 9 + event ID. |
| 3 | Press **SPACE** (single go) | Execution continues until CT1 event fires. Debugger breaks at the event. |
| 4 | Observe event flags | CT1 event flag shows '1' in events panel. |
| 5 | **Right-click EVENT** button | Toggles EVENT condition off. |
| 6 | **Left-click MAIN** button | Returns to single-step MAIN mode. |

**Pass criteria**: Event breakpoint triggers on the correct event, event flag displays correctly.

---

## Test 14: Context-sensitive hint bar

**▶ Load:** any program — run this **throughout** Phases B and C by hovering as you go.

**What this tests**: Hint bar content changes based on mouse hover position.

### Interactions & Expected Results

| Step | Action | Expected Hint Bar Content |
|------|--------|--------------------------|
| 1 | Hover over **REG heatmap** | Shows register address: `Register $xxx = $yyyyyyyy` |
| 2 | Hover over **CT** value | Shows elapsed time: `Elapsed: N.NNNNNN seconds at 200.0 MHz` |
| 3 | Hover over **Go** button | Shows: `L-Click or SPACE to step | R-Click or ENTER for repeat` |
| 4 | Hover over **MAIN** button | Shows: `L-Click to break on MAIN instructions | R-Click or <M> to toggle` |
| 5 | Hover over **event name** | Shows event description: `Event CT1 (1)` |
| 6 | Hover over **disassembly** | Shows disassembly mode: `Disassembly (follow PC)` or `(cog locked)` |
| 7 | Hover over **hub data** | Shows hub address: `Hub address: $xxxxx` |
| 8 | Move mouse **off the window** | Hint bar clears. |

**Pass criteria**: Hint bar updates dynamically based on mouse position, clears when mouse leaves.

---

## Test summary matrix

| Test | Phase | Feature Area | Complexity | Load file |
|------|-------|-------------|------------|-----------|
| 0 | A | Visual verification (no interaction) | Trivial | `test01_basic_spin.spin2` |
| 1 | B | Basic connection, single step | Simple | `test01` (keep loaded) |
| 2 | B | Repeat mode, throttling | Simple | `test01` (keep loaded) |
| 3 | B | Register watch, reset | Simple | `test03_pasm_regs.spin2` |
| 4 | B | Disassembly navigation | Medium | `test03` (keep loaded) |
| 5 | B | Button behavior | Medium | `test01` (reuse — do with Tests 1–2) |
| 6 | B | Header display (C/Z/SKIP/CT) | Medium | `test06_flags_skip.spin2` |
| 7 | B | SFR, stack, pointers | Medium | `test07_stack_ptr.spin2` |
| 8 | B | Hub memory viewer | Medium | `test08_hub_writes.spin2` |
| 9 | B | Pin registers, status | Medium | `test09_pins.spin2` |
| 10 | C | Smart pin watch | Medium | `test10_smart_pin.spin2` |
| 11 | C | Interrupts, exec mode | Complex | `test11_interrupts.spin2` |
| 12 | C | Multi-COG | Complex | `test12_multicog.spin2` |
| 13 | C | Event breakpoints | Complex | `test11` (keep loaded) |
| 14 | B/C | Hint bar | Simple | Any (run throughout) |

---

*Generated from the Single-Step Debugger Theory of Operations document and the
PNut-Term-TS implementation review. Companion P2 sources: `SingleStep-Debugger-Test-Programs/`.*
