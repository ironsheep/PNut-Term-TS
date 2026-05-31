# Single-Step Debugger: Interactive Test Plan

> **Purpose**: Validate the corrected single-step debugger implementation against real P2 hardware. Tests are ordered from simplest to most complex. Each test specifies the P2 code, user interactions, and expected display behavior.
>
> **Prerequisites**: P2 board connected via USB (Prop Plug or FTDI), PNut-Term-TS running, serial port selected.

---

## Test 1: Basic Connection — DEBUG_MAIN Single Step

**What this tests**: Debugger window opens, breakpoint protocol works, basic display renders.

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1

PUB main() | x
  x := 0
  repeat
    x++
```

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

## Test 2: Repeat Mode — Continuous Execution

**What this tests**: ENTER key toggles repeat mode, ~20 breaks/sec throttling, Stop button.

### P2 Code
Same as Test 1.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | After debugger opens, press **ENTER** | Go button changes to **"Stop"**. Display updates rapidly (~20 times/sec). PC scrolls through instructions continuously. REG heatmap lights up showing active registers. |
| 2 | Observe disassembly | Disassembly auto-scrolls to keep PC visible. PC line highlighted. After 8 consecutive breaks in the same area, disassembly gradually scrolls PC toward line 4 (ideal position). |
| 3 | Press **ENTER** again | Execution stops (repeat mode off). Go button returns to **"Go"**. Display shows final state. PC frozen at last break address. |
| 4 | Press **SPACE** | Single step resumes. One instruction advances. |

**Pass criteria**: ENTER starts/stops repeat mode, display updates visibly, throttling prevents overwhelming updates.

---

## Test 3: Register Watch and Reset

**What this tests**: Delta tracking algorithm, R key reset, watch list display.

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1

DAT
  org
entry
  mov   pa, #0
  mov   pb, #100
  add   pa, #1
  sub   pb, #1
  jmp   #entry+2    ' Loop back to add/sub
```

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

## Test 4: Disassembly Navigation — Modes and Scrolling

**What this tests**: dmPC/dmCog/dmHub modes, mouse wheel scrolling, click behaviors.

### P2 Code
Same as Test 3 (simple PASM loop).

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Observe disassembly | Shows **R-xxx** format addresses (cog registers). PC line highlighted with inverse colors. Current mode: follow PC (dmPC). |
| 2 | **Mouse wheel up** in disassembly box | Switches from PC-follow to cog-locked mode (dmCog). Disassembly scrolls up. PC highlight may scroll out of view. |
| 3 | **Ctrl+mouse wheel** | Scrolls by 4 instructions per tick (vs 1 without Ctrl). |
| 4 | **Shift+mouse wheel** | Scrolls by 16 instructions per tick. |
| 5 | **Left-click** in disassembly box | Returns to PC-follow mode (dmPC). Disassembly snaps back to show PC. |
| 6 | **Right-click** on a disassembly line | Toggles address breakpoint at that line. Breakpoint marker (●) appears in red at left edge. ADDR button highlights in button panel. |
| 7 | Right-click same line again | Breakpoint clears. Marker disappears. ADDR button dims. |
| 8 | Click on **REG heatmap** (left side) | Disassembly locks to that cog address (dmCog mode). Shows registers around clicked area. |
| 9 | Click on **PC** value in header row | Returns to PC-follow mode. |

**Pass criteria**: Three disassembly modes work, mouse wheel scrolls with modifiers, breakpoints toggle, heatmap click navigates.

---

## Test 5: Breakpoint Control Buttons

**What this tests**: Left-click exclusive set, right-click toggle, button highlight states.

### P2 Code
Same as Test 1.

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Observe buttons | MAIN button should be highlighted (active). All others dimmed. This matches initial BreakValue = break on MAIN. |
| 2 | **Left-click DEBUG** button | DEBUG highlights, MAIN dims. Only DEBUG condition active. BreakValue = $10. |
| 3 | **Right-click INT1** button | INT1 highlights additionally (toggle on). BreakValue = $12 (DEBUG + INT1). DEBUG stays highlighted. |
| 4 | **Right-click INT1** again | INT1 dims (toggle off). BreakValue = $10 (DEBUG only). |
| 5 | **Left-click MAIN** | MAIN highlights exclusively. DEBUG, INT1 all dim. BreakValue = $01. |
| 6 | Press **I** key | INIT button toggles (independent bit 8). INIT highlights. MAIN stays highlighted. BreakValue = $101. |
| 7 | Press **I** again | INIT dims. BreakValue = $01. |
| 8 | Press **B** key | BREAK button action: clears all conditions except INIT. All mode buttons dim. |
| 9 | Press **M** key | MAIN toggles back on. |
| 10 | Press **D** key | DEBUG toggles on, MAIN cleared (mutual exclusion). |

**Pass criteria**: Left-click sets exclusively, right-click toggles independently, INIT always independent, keyboard shortcuts match button behaviors.

---

## Test 6: Header Display — Flags, SKIP, XBYTE, CT

**What this tests**: Top row panels render correctly with proper bit extraction.

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1

DAT
  org
entry
  mov   pa, #5
  cmp   pa, #5    wz   ' Sets Z flag
  cmp   pa, #3    wc   ' Sets C flag
  skip  #%1010         ' Set SKIP pattern
  nop                  ' Skipped
  nop                  ' Not skipped
  nop                  ' Skipped
  nop                  ' Not skipped
  jmp   #entry
```

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

## Test 7: SFR, Stack, and Pointer Display

**What this tests**: Special function registers, hardware stack, pointer data windows.

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1

DAT
  org
entry
  mov   ptra, ##$1000    ' Set PTRA to hub address
  mov   ptrb, ##$2000    ' Set PTRB to hub address
  wrlong #$DEADBEEF, ptra  ' Write to hub at PTRA
  wrlong #$CAFEBABE, ptrb  ' Write to hub at PTRB
  call  #subroutine
  jmp   #entry

subroutine
  nop
  ret
```

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

## Test 8: Hub Memory Viewer and Heatmap

**What this tests**: Hub data display, scrolling, nibble editing, heatmap visualization.

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1

DAT
  org
entry
  mov   ptra, #0
.loop
  wrlong ptra, ptra      ' Write address to hub[address]
  add   ptra, #4
  cmp   ptra, ##$100  wz
  if_nz jmp #.loop
  jmp   #entry            ' Repeat forever
```

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

## Test 9: Pin Registers and Status Indicators

**What this tests**: DIR/OUT/IN binary display, status indicators (INIT, STALLI, STR, MOD, LUTS).

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1

DAT
  org
entry
  drvh  #0               ' Set pin 0 high (DIR=1, OUT=1)
  drvl  #1               ' Set pin 1 low  (DIR=1, OUT=0)
  drvh  #16              ' Set pin 16 high
  fltl  #2               ' Float pin 2    (DIR=0)
  jmp   #entry
```

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

## Test 10: Smart Pin Watch

**What this tests**: Smart pin delta tracking, DIR filter, compressed data parsing.

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1

DAT
  org
entry
  wrpin ##$4C_00_0000, #0   ' Configure pin 0 as NCO frequency
  wxpin ##1000, #0           ' Set base period
  wypin #500, #0             ' Set PWM value
  drvl  #0                   ' Enable smart pin
  nop
  rdpin pa, #0               ' Read smart pin value (RQPIN)
  jmp   #entry+4             ' Loop reading
```

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

## Test 11: Interrupt Status and Execution Mode

**What this tests**: INT1/INT2/INT3 display, execution mode (MAIN/INT1/INT2/INT3), SKIP suspension.

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1

DAT
  org
entry
  mov   ijmp1, #int1_handler
  mov   iret1, #0
  setint1 #EVENT_CT1          ' Enable INT1 on CT1 event
  addct1  cnt, ##1000         ' Set CT1 target
  nop
  jmp   #$-1                  ' Wait for interrupt

int1_handler
  addct1  cnt, ##1000         ' Reset CT1 target
  reti1
```

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Step until interrupt fires | **EXEC** panel changes from **MAIN** to **INT1**. |
| 2 | Observe interrupt status | **INT** panel shows `INT1 CT1 busy`. INT2/INT3 show `idle` or `off`. |
| 3 | Observe SKIP panel | Should show **"Suspended during MODE"** (dimmed) when ExecMode != 0 (inside INT1). |
| 4 | Step through `reti1` | EXEC returns to **MAIN**. INT1 status changes to `idle`. SKIP pattern becomes active again. |

**Pass criteria**: Execution mode changes on interrupt entry/exit, interrupt status shows correct event name and state, SKIP suspension message appears.

---

## Test 12: Multi-COG Debugging

**What this tests**: Per-cog debugger windows, COGBRK async break.

### P2 Code
```spin2
CON
  _clkfreq = 200_000_000
  DEBUG_MAIN = 1
  DEBUG_COGINIT = 1

PUB main()
  cogspin(NEWCOG, cog1_task(), @stack1)

PUB cog1_task() | x
  x := 0
  repeat
    x++

VAR
  long stack1[64]
```

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

## Test 13: Event Breakpoints

**What this tests**: Breaking on specific events, EVENT button behavior.

### P2 Code
Same as Test 11 (uses CT1 event for INT1).

### Interactions & Expected Results

| Step | Action | Expected Display |
|------|--------|-----------------|
| 1 | Click on **CT1** event name in events panel | Sets BreakEvent to CT1 (event index 1). |
| 2 | **Left-click EVENT** button | EVENT button highlights. BreakValue includes bit 9 + event ID. |
| 3 | Press **SPACE** (single go) | Execution continues until CT1 event fires. Debugger breaks at the event. |
| 4 | Observe event flags | CT1 event flag shows '1' in events panel. |
| 5 | **Right-click EVENT** button | Toggles EVENT condition off. |
| 6 | **Left-click MAIN** button | Returns to single-step MAIN mode. |

**Pass criteria**: Event breakpoint triggers on the correct event, event flag displays correctly.

---

## Test 14: Context-Sensitive Hint Bar

**What this tests**: Hint bar content changes based on mouse hover position.

### P2 Code
Any of the above test programs.

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

## Test Summary Matrix

| Test | Feature Area | Complexity | P2 Code Needed |
|------|-------------|------------|----------------|
| 1 | Basic connection, single step | Simple | Minimal Spin2 loop |
| 2 | Repeat mode, throttling | Simple | Same as Test 1 |
| 3 | Register watch, reset | Simple | PASM register ops |
| 4 | Disassembly navigation | Medium | Same as Test 3 |
| 5 | Button behavior | Medium | Same as Test 1 |
| 6 | Header display (C/Z/SKIP/CT) | Medium | PASM with flags/skip |
| 7 | SFR, stack, pointers | Medium | PASM with call/ptr |
| 8 | Hub memory viewer | Medium | PASM hub writes |
| 9 | Pin registers, status | Medium | PASM pin drive |
| 10 | Smart pin watch | Medium | PASM smart pin |
| 11 | Interrupts, exec mode | Complex | PASM with INT1 |
| 12 | Multi-COG | Complex | Spin2 + COGINIT |
| 13 | Event breakpoints | Complex | Same as Test 11 |
| 14 | Hint bar | Simple | Any test program |

---

*Generated from Single-Step Debugger Theory of Operations document and PNut-Term-TS implementation review.*
