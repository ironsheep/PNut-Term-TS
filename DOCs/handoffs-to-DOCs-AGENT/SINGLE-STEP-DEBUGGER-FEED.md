# Parallax Propeller 2 Single-Step Debugger — Reference Detail

> ## 📤 HANDOFF SNAPSHOT — not the maintained copy
>
> The canonical document is **`DOCs/manual-source/SINGLE-STEP-DEBUGGER-MANUAL-SOURCE.md`**.
> This is a point-in-time copy made for the docs agent, snapshotted **2026-09-07** at
> **v1.0.6**, with the whole input surface re-verified against the code that day.
>
> Edit the canonical copy, then re-snapshot. Never edit both.

> ## 📥 SOURCE MATERIAL — NOT A USER DELIVERABLE
>
> **Role:** input for the externally-published *Single-Step Debugger Manual*. This file is
> the accurate behavioral detail an author (human or agent) encodes into that manual — it is
> **not** the manual, and it is **not shipped** in application packages.
>
> **Do not:**
> - ship this file, or reference it from `APP-HELP.md` (users never receive it)
> - treat it as the published manual, or maintain a second copy of its content there
>
> **Do:**
> - keep it *correct* rather than polished — precision over prose
> - verify claims against `DebuggerUnit.pas` (the v55 parity baseline) and against observed
>   behavior; the Tests 0–14 hardware walk validated much of what's here
>
> **Why this marking exists:** the file was originally written as a shippable user manual,
> before the external-manual strategy existed. Two artifacts with the same title inevitably
> diverge, and the unshipped one silently rots. Its role is now source, and only source.
>
> Companion source docs of the same kind: `pascal-REF/theory-of-operations/` (display
> windows) and `project-specific/LOGGING-STANDARDS.md` (logging behavior). See
> `DOCs/README.md` for the full document taxonomy.
>
> **Currency: verified against the code on 2026-09-07, at v1.0.6.** The input surface
> (keyboard, click regions, wheel, hover hints, the button panel and GO) was re-derived
> from `src/classes/debugger/renderer/DebuggerInteraction.ts` and checked region by region,
> not assumed from the previous revision. The authored PNut specification this parity is
> measured against is Part A of `DOCs/SSDB-INPUT-PARITY-AUDIT-2026-08-12.md`; where this
> file and Part A disagree, **Part A is corrected first** and the correction then flows here
> and to the Test Plan.

## Table of Contents

1. [Overview](#overview)
2. [Invoking the Debugger](#invoking-the-debugger)
3. [Debugger Window Layout](#debugger-window-layout)
4. [Keyboard Controls](#keyboard-controls)
5. [Mouse Controls](#mouse-controls)
6. [Breakpoint Control Buttons](#breakpoint-control-buttons)
7. [Display Regions](#display-regions)
8. [Multi-COG Debugging](#multi-cog-debugging)
9. [DEBUG Statement Formatting](#debug-statement-formatting)
10. [Configuration Symbols](#configuration-symbols)
11. [Tips and Common Scenarios](#tips-and-common-scenarios)

---

## Overview

The Parallax Propeller 2 Single-Step Debugger provides interactive debugging of PASM2 code running on the P2 microcontroller. It is a **bidirectional** system: the P2 captures cog state and transmits it to the host PC, while the host renders the display and sends commands back to the P2.

### Key Features

- Single-step and continuous execution control
- Real-time inspection of all 512 COG registers, 512 LUT registers, and 507,904 bytes of HUB RAM
- 8-level hardware stack display
- Heatmap visualization showing register and memory changes
- Disassembly with three viewing modes (follow PC, cog lock, hub lock)
- Automatic register change tracking (delta watch list)
- Smart pin monitoring (64 pins via RQPIN)
- Interrupt and event status
- Per-cog debugger windows (each cog gets its own window)
- Inter-cog debugging via COGBRK

### Important Notes

- The debugger is **read-only** — you cannot modify register or memory values from the debugger UI
- The top 16KB of HUB RAM (`$FC000`-`$FFFFF`) is reserved for the debugger infrastructure and is not visible in the HUB viewer
- The debuggable HUB range is `$00000`-`$7BFFF` (507,904 bytes)

---

## Invoking the Debugger

### DEBUG Statement in Code

The debugger opens automatically when the P2 executes a `DEBUG` statement:

```spin2
PUB main()
  DEBUG                          ' Triggers debugger breakpoint
```

### Break on COGINIT

Define `DEBUG_COGINIT` to break whenever a cog starts:

```spin2
CON
  DEBUG_COGINIT = 1              ' Break on every COGINIT
```

This sets the initial BRK condition to `$110` (INIT + DEBUG bits).

### Break on First Execution

Define `DEBUG_MAIN` to break on the first instruction executed:

```spin2
CON
  DEBUG_MAIN = 1                 ' Break at initial cog execution
```

This sets the initial BRK condition to `$001` (MAIN bit).

---

## Debugger Window Layout

Each cog gets its own debugger window titled "Debugger - Cog N". The window uses a **123-column x 77-half-row** character grid:

```
     Col 2      Col 13    Col 24                          Col 82  Col 96  Col 116
      |           |         |                               |       |       |
Row 1 [REG MAP ] [LUT MAP] [CF] [ZF] [PC---] [SKIP/SKIPF pattern--] [XBYTE] [CT---------]
      |           |         |                                                |
Row 4 [          ][         ] [DISASSEMBLY (16 lines)----------] [WATCH] [SFR----] [EVENT]
      |           |         |                                    |       |         |
Row 35|           |         | [EXEC] [STACK (8 longs)----------]        |   [BUTTONS----]
      |           |         |                                           |   |            |
Row 40|           |         | [INT---------] [PTR (FPTR/PTRA/PTRB)---] |   |            |
      |           |         |                                           |   |            |
Row 47|           |         | [STAT] [PIN (DIR/OUT/IN binary)--------] |   |            |
      |           |         |                                           |   [            ]
Row 54|           |         | [SMART PIN WATCH---------------------]   |
      |           |         |                                           |
Row 57|           |         | [HUB DATA (8 rows hex+ASCII)--------] [HUB MAP]
      |           |         |                                           |
Row 74|           |         |      [HINT BAR-----------------------]
Row 77+-----------+---------+----------------------------------------------+
```

---

## Keyboard Controls

| Key | Action | Description |
|-----|--------|-------------|
| **Space** | Go — single | Exactly a left-click on GO: run until the next **armed** break, then halt. With MAIN armed this looks like single-stepping; with EVENT armed it runs to that event |
| **Enter** | Go — repeat | Exactly a right-click on GO: run continuously through breaks with throttled updates (~20 breaks/sec); press again to stop |
| **B** | Break | Set async break mode — clears all conditions except INIT (bit 8) |
| **I** | INIT Toggle | Toggle INIT breakpoint (right-click INIT button equivalent) |
| **D** | DEBUG Toggle | Toggle DEBUG breakpoint (right-click DEBUG button equivalent) |
| **M** | MAIN Toggle | Toggle MAIN single-step (right-click MAIN button equivalent) |
| **R** | Reset Watch | Clear the register-delta watch list (there is no LUT watch list) |
| **Up Arrow** | Hub Scroll Up | Scroll HUB data viewer up one row (`HubAddr -= $10`) |
| **Down Arrow** | Hub Scroll Down | Scroll HUB data viewer down one row (`HubAddr += $10`) |
| **Page Up** | Hub Page Up | Scroll HUB viewer up: `$80` (normal), `$1000` (Ctrl), `$10000` (Shift) |
| **Page Down** | Hub Page Down | Scroll HUB viewer down: same modifier scheme |

**Captured but deliberately inert:** `Tab` is swallowed so keyboard focus cannot leave the
debugger window, and `Left Arrow`, `Right Arrow`, `Home`, `End`, `Delete` and `Insert` are
captured but reach no command. This matches PNut, where `FormKeyDown` remaps exactly ten
non-character keys onto pseudo control codes and only some of those have a dispatch case.

All letter keys are case-insensitive, and dispatch on the character you type — not on
the physical key position — so non-QWERTY layouts behave the same way. **Alt+ and
Cmd/Meta+ combinations are ignored entirely** — they have no Delphi `OnKeyPress` analog,
so they reach no command rather than falling through to the plain letter.

**Control-key combinations.** Five Ctrl combinations reach the hub-navigation commands
rather than their letter commands:

| Key | Action |
|-----|--------|
| **Ctrl+C** | Hub scroll up one row (same as Up Arrow) |
| **Ctrl+D** | Hub scroll down one row (same as Down Arrow) — *not* the DEBUG toggle |
| **Ctrl+K** | Hub page up |
| **Ctrl+L** | Hub page down |
| **Ctrl+M** | Repeat Mode (same as Enter) |

Other Ctrl combinations (Ctrl+A, Ctrl+B, …) do nothing. Note in particular that **Ctrl+D
does not toggle DEBUG and Ctrl+M does not toggle MAIN** — holding Ctrl replaces the letter
command with the control code, it does not add to it.

These collisions are not a design choice of ours: Delphi delivers Ctrl+letter to
`OnKeyPress` as control characters `#1`..`#26`, which land in the same code space as the
pseudo codes assigned to the arrow and page keys. They are reachable PNut behavior and are
reproduced deliberately.

> **One documented divergence from PNut.** PNut assigns its modifier state only in
> `FormKeyDown`, which exits before that assignment for letter-produced codes — so a real
> Ctrl+K in PNut pages using whatever shift state was left over from the last non-character
> key. We use the **current** modifier state, which makes Ctrl+K page by `$1000`. This is
> the straightforward reading rather than a reproduction of a stale-state artifact, and it
> is recorded here so the difference is not mistaken for a defect.

---

## Mouse Controls

### Click Actions by Region

Most regions are **not** button-sensitive: only the buttons, the disassembly box, the
event names and the smart-pin watch box read which button was pressed. Everywhere else a
right-click does exactly what a left-click does — it is not ignored, and it is not a
separate command.

| Region | Left-Click | Right-Click |
|--------|------------|-------------|
| **Break condition buttons** | Arm this condition exclusively: clear every other condition (INIT excepted) and set this bit | Toggle this condition — **and clear DEBUG** (mask `$FFFFFFEF`). See the per-button exceptions below; "toggles without affecting others" is not accurate for this panel |
| **Go button (halted)** | Single Go (same as Space) | Repeat Mode (same as Enter) |
| **Go button (repeating)** | Stop | Stop |
| **Go button (running, display dimmed)** | Request an asynchronous COGBRK for **this** cog | Same — the free-running case is decided before the button is examined |
| **BREAK button** | Clear all conditions except INIT | Same as left-click — BREAK is not button-sensitive |
| **Disassembly box** | Lock disassembly to follow PC (`dmPC` mode) | Toggle address breakpoint at clicked line — refused in hub mode if the line resolves below `$400` |
| **REG/LUT heat strip** | Lock disassembly to the clicked cog/LUT address, placed mid-window | Same as left-click |
| **PC box** | Lock disassembly to follow PC | Same as left-click |
| **SFR values** | Navigate to value: the first six rows (IJMP3..IRET1) go to cog space only when the value is itself below `$400`; every other case is a hub pointer, and the disassembly follows | Same as left-click |
| **Stack values** | Navigate to value as code/hub pointer; a hub-range value takes the disassembly with it | Same as left-click |
| **Pointer address column** | Navigate hub viewer and disassembly to the pointer's own address | Same as left-click |
| **Pointer data bytes** | Navigate to the specific byte under the cursor, accounting for the 6-byte lead-in (`pointer - 6 + column ÷ 3`) | Same as left-click |
| **Pointer characters** | Same, one character per byte | Same as left-click |
| **Register watch box** | Reset watch list | Same as left-click |
| **Smart pin watch box** | Reset smart pin watch list | Reset the list **and** toggle: all pins vs. only pins with DIR set |
| **Hub data (hex)** | Navigate hub address to the clicked byte | Same as left-click |
| **Hub characters (ASCII)** | Same, one character per byte — a separate region from the hex columns | Same as left-click |
| **Hub heatmap** | Jump the hub viewer to the clicked 128-byte sub-block | Same as left-click |
| **Event names** | Set the break event to the clicked event (CT1..QMT) **and arm it** | Toggle that event break off/on |

**The REG and LUT heat strips are inset inside their boxes.** Only the strip itself is
clickable; the surrounding labelled box is hover-only, exactly as in PNut. The clicked
register is placed **mid-window** (the address is offset by 8 lines) and clamped to `$1F0`
so a full 16-line window always remains in range; the LUT strip adds `$200` after the clamp,
covering `$200`..`$3F0`.

**Right-clicking on macOS.** A physical right-press, a two-finger trackpad tap, and
**Ctrl+left-click** all deliver a right-click. macOS/Electron delivers two mousedown +
contextmenu pairs for one physical right-press, so the whole gesture is latched — a single
right-press toggles an address breakpoint exactly once, not twice.

### Mouse Wheel

**In disassembly box** (switches to cog/hub lock mode if in follow-PC mode, seeded from
the address currently displayed):

| Modifier | Cog mode | Hub mode |
|----------|----------|----------|
| None | 1 register | 4 bytes (one long) |
| Ctrl | 4 registers | 16 bytes |
| Shift | 16 registers | 64 bytes |
| Ctrl+Shift | 32 registers | 128 bytes |

Cog-mode scrolling **stops** at `$000` and `$3F0` rather than wrapping, so the window
always stays full. Hub-mode scrolling **wraps** at 20 bits (`$FFFFF`) instead, and it moves
the HUB data viewer with it — the disassembly and the hub viewer share one hub address.

**In hub address digits**: wheeling over one of the five hex digits of the hub address
changes **that digit** by +/-1 — digit 0 is the most significant nibble. This works only
over the address column itself, inside the hub panel.

**In hub data box**:

| Modifier | Hub scroll |
|----------|------------|
| None | 16 bytes (one row) |
| Ctrl | 1 byte |
| Shift | 4 bytes |
| Ctrl+Shift | 128 bytes (one sub-block) |

Hub scrolling **wraps** at `$FFFFF`; it does not clamp.

**Over the hub heatmap**: the wheel does nothing — the heatmap is excluded from hub
scrolling. Click it instead to jump.

**Everywhere else**: nothing. Only the disassembly box and the hub panel handle the wheel;
over the buttons, PC, watch list, SFRs, stack, events, pointers, smart-pin watch, or the
REG/LUT strips the wheel has no effect.

**On macOS**, Shift+wheel is delivered as a horizontal scroll rather than a vertical one.
It is folded back into a single delta, so Shift+wheel scrolls exactly as it does elsewhere.

### Mouse Hover (Hint Bar)

Moving the mouse over a region displays context-sensitive text in the hint bar at the
bottom of the window. The hint is recomputed on every mouse-move.

**Regions that carry a hint:** all thirteen break-control buttons and the GO button, the
break-control panel itself, the REG and LUT boxes *and* their inset heat strips (each with
its own text — the strip's names the click action, the box's does not), C flag, Z flag, PC,
SKIP, XBYTE, CT, the disassembly box, the register watch list, the SFR box, the events box
and each event row, EXEC, the stack box, the interrupt box, the pointer box, the status box,
the pin box, the hub tab, the hub box, the hub address digits, and the hub heat-map.

**Three hints are dynamic:**
- **CT** — the elapsed seconds implied by the tick count at the current clock frequency.
- **XBYTE** — a decode of the XBYTE mode word, naming the addressing mode in words and
  noting whether C and Z are affected.
- **GO** — changes with repeat mode: while repeating it offers to stop; otherwise it names
  both the left-click and right-click actions.

**Regions with a deliberately empty hint** — hovering them clears the bar rather than
leaving the previous text: the smart-pin watch box, and the data sub-regions (SFR values,
stack values, pointer address/data/characters, hub data bytes and characters). PNut passes
an empty string for these, and so do we; an invented hint here was removed as a deviation.

Most hints name the action available on that region, e.g. the disassembly box reads
*"L-Click to lock to PC | R-Click to toggle break address | Mousewheel {+Ctrl/Shift}
scrolls"*, and each event row names the event under the cursor.

---

## Breakpoint Control Buttons

The button panel occupies the bottom-right of the window.

### Break Condition Buttons

Break conditions are **bitmask flags** that can be combined (not mutually exclusive enums):

| Button | Bit | Mask | Description |
|--------|-----|------|-------------|
| **MAIN** | 0 | `$001` | Single-step main code instructions |
| **INT1** | 1 | `$002` | Single-step INT1 instructions |
| **INT2** | 2 | `$004` | Single-step INT2 instructions |
| **INT3** | 3 | `$008` | Single-step INT3 instructions |
| **DEBUG** | 4 | `$010` | Break on DEBUG (BRK with non-zero code) |
| **INT1E** | 5 | `$020` | Break on INT1 entry |
| **INT2E** | 6 | `$040` | Break on INT2 entry |
| **INT3E** | 7 | `$080` | Break on INT3 entry |
| **INIT** | 8 | `$100` | Break on COGINIT (independent — never cleared by other buttons) |
| **EVENT** | 9 | `$200` | Break on event (event ID in bits 15..12) |
| **ADDR** | 10 | `$400` | Break on address match (address in bits 31..12) |
| **BREAK** | — | — | Clear all conditions except INIT (async break mode) |

**Bit 11** (`$800`) is the **STALL** flag — used internally to keep the cog halted in the debug polling loop. Not a user-settable button.

**The general grammar:** left-click **arms exclusively** — clear every other condition
(keeping INIT) and set this one. Right-click **toggles** this condition — and also clears
DEBUG (mask `$FFFFFFEF`). Right-click is therefore *not* "toggle without affecting others";
DEBUG always drops out.

Four buttons depart from that grammar, and the departures are what make the panel usable:

| Button | Departure |
|--------|-----------|
| **INIT** | Left-click **sets** bit 8 without clearing anything else (`or $100`); right-click toggles it alone. INIT is independent of every other condition in both directions. |
| **DEBUG** | Right-click keeps **both** INIT and DEBUG before toggling (`and $110 xor $010`), so toggling DEBUG does not clear DEBUG out from under itself. DEBUG is exclusive to everything but INIT. |
| **EVENT** | Right-click is mutually exclusive with ADDR: if EVENT is armed it clears (`and $DEF`); otherwise it clears ADDR and arms EVENT with the selected event number in bits 15..12 (`and $BEF or $200 or event shl 12`). |
| **ADDR** | The mirror image: clears with `and $BEF`, or arms with `and $DEF or $400 or address shl 12`. The address comes from right-clicking a disassembly line. |

**BREAK** is not button-sensitive at all — either button clears every condition except INIT.

### Go/Stop/Break Button

GO is a state machine, and the state is examined **before** the mouse button is:

| Caption | State | Left-click | Right-click |
|---------|-------|------------|-------------|
| **Break** | Cog free-running — 250 ms passed with no breakpoint, display dimmed | Request an asynchronous COGBRK for this cog | Same |
| **Stop** | Repeat mode active | Stop | Same |
| **Go** | Cog halted at a breakpoint | Single Go — run until the next armed break | Repeat Mode — run continuously through breaks |

So Space and Enter both stop a repeat run, and both request a COGBRK when the display is
dimmed; the left/right distinction only applies from a halted cog.

When the cog is running and 250 ms pass without a breakpoint, the display dims (each pixel
halved in brightness) and the button shows "Break". Any press of GO also flashes the button
— its colors invert for about 100 ms — so a press is visible even when it changes nothing
on screen.

---

## Display Regions

### Register and LUT Heatmaps (Left Side)

Two narrow bitmaps spanning nearly the full window height:

- **REG bitmap**: 32 pixels wide x 512 pixels tall — one row per cog register (`$000`-`$1FF`), one column per bit (MSB left, LSB right)
- **LUT bitmap**: Same structure for LUT addresses (`$200`-`$3FF`)

**Color encoding** (yellow-based palette, not blue/white):
- **Just changed** (hit value = 254): bright yellow (`cHighDiff`/`cLowDiff`)
- **Decaying**: fades by 2 per break toward cold
- **Unchanged** (cold): dark yellow (`cHighSame`/`cLowSame`)
- High bits (=1) use `cHigh*` colors; low bits (=0) use `cLow*` colors

Click the **strip** to lock the disassembly view to that address. Only the inset strip is
clickable — the surrounding labelled box is hover-only. The clicked register lands
mid-window rather than on the top line, and the address is clamped to `$1F0` so the window
stays full; the LUT strip adds `$200` after the clamp.

### C Flag, Z Flag, and Program Counter (Top Row)

- **C flag**: Single character '0' or '1' (from bit 31 of interrupt return register)
- **Z flag**: Single character '0' or '1' (from bit 30 of interrupt return register)
- **PC**: 5 hex digits (20-bit program counter)

### SKIP/SKIPF Pattern (Top Row)

32-bit pattern showing which instructions are skipped. Label shows "SKIP" or "SKIPF" depending on mode. Shown dimmed with explanatory message when suspended during CALL or interrupt.

### XBYTE Status (Top Row)

9-bit XBYTE configuration displayed as 3 hex digits. A dim checkmark glyph is always present; it brightens to orange when C/Z are affected by XBYTE.

### Clock Ticks (Top Row)

64-bit CT value displayed as 16 hex digits in two 8-digit groups. Hint bar shows elapsed seconds computed from the clock frequency.

### Disassembly View (Middle)

16 lines of disassembled P2 instructions. Three modes:

| Mode | Description |
|------|-------------|
| **Follow PC** (`dmPC`) | Auto-scrolls to keep PC visible; positions PC at line 4 (from top) |
| **Cog Lock** (`dmCog`) | Locked to a cog/LUT address; scroll with mouse wheel |
| **Hub Lock** (`dmHub`) | Locked to a hub address; scroll with mouse wheel |

Each line shows: address + raw 32-bit opcode + disassembled mnemonic and operands. The current PC line is highlighted with an inverse-color rounded rectangle. Instructions with SKIP bits set show a semi-transparent strikethrough. Address breakpoints show as semi-transparent highlights.

### Register Watch List (Middle-Right)

Automatically tracks up to 16 cog registers (`$000`-`$1EF`) that have changed. Shows 3-digit hex address + 8-digit hex value. Entries persist for ~1000 breaks after last change, then age out. Press **R**, or click the box, to clear. Note the range stops at `$1EF`: the special-function registers at `$1F0`-`$1FF` — PA and PB included — are never watched here.

### Special Function Registers (Middle-Right)

All 16 SFRs at `$1F0`-`$1FF` displayed in two columns:

```
$1F0  IJMP3  xxxxxxxx      $1F8   PTRA  xxxxxxxx
$1F1  IRET3  xxxxxxxx      $1F9   PTRB  xxxxxxxx
$1F2  IJMP2  xxxxxxxx      $1FA   DIRA  xxxxxxxx
$1F3  IRET2  xxxxxxxx      $1FB   DIRB  xxxxxxxx
$1F4  IJMP1  xxxxxxxx      $1FC   OUTA  xxxxxxxx
$1F5  IRET1  xxxxxxxx      $1FD   OUTB  xxxxxxxx
$1F6     PA  xxxxxxxx      $1FE    INA  xxxxxxxx
$1F7     PB  xxxxxxxx      $1FF    INB  xxxxxxxx
```

**Clicking a value navigates to it**, and the rule needs both halves: a value goes to
**cog space** (locking the disassembly to it) only when it is below `$400` **and** the row
is one of the first six — the interrupt vectors IJMP3..IRET1, which are the only code
pointers here. Every other case is treated as a **hub** pointer: the hub viewer moves there
and the disassembly follows it. So an interrupt vector holding a hub address routes to hub,
and a data-pointer row (PA, PB, PTRA, PTRB, DIRA/B, OUTA/B, INA/B) is always a hub pointer
regardless of its value.

### Event Flags (Right)

16 P2 events displayed as single '0' or '1' characters:

| Index | Event | Index | Event |
|-------|-------|-------|-------|
| 0 | INT | 8 | PAT |
| 1 | CT1 | 9 | FBW |
| 2 | CT2 | 10 | XMT |
| 3 | CT3 | 11 | XFI |
| 4 | SE1 | 12 | XRO |
| 5 | SE2 | 13 | XRL |
| 6 | SE3 | 14 | ATN |
| 7 | SE4 | 15 | QMT |

**Row 0 (INT) is drawn but not selectable** — the clickable strip starts one row below the
panel top and spans the 15 rows CT1..QMT.

Clicking an event name does two things in one action: it selects that event **and arms the
break on it** — left-click arms it exclusively, right-click toggles it. Clicking a name is
not merely a selection.

### Execution Mode (Below Disassembly)

Tab label showing current execution context: **MAIN**, **INT1**, **INT2**, or **INT3**.

### Stack Registers

8 hardware stack values displayed as 8-digit hex. STK0 is top of stack. Click a value to
navigate to it as a pointer: below `$400` locks the disassembly to that cog address,
otherwise the hub viewer moves there and the disassembly follows.

### Interrupt Status

Three interrupt levels (INT1/INT2/INT3), each showing the assigned event name and state (idle, wait, or busy).

### Pointer Data (FPTR, PTRA, PTRB)

Three rows showing 14 bytes of memory centered on each pointer:

```
Rxx  xxxxx  xx xx xx xx xx xx [xx] xx xx xx xx xx xx xx  ..............
PTRA xxxxx  xx xx xx xx xx xx [xx] xx xx xx xx xx xx xx  ..............
PTRB xxxxx  xx xx xx xx xx xx [xx] xx xx xx xx xx xx xx  ..............
```

> *This layout also appears in `DOCs/pascal-REF/SingleStep-Debugger-Theory-of-Operations.md`, which carries the bit-field sourcing beneath it. Both copies are deliberate — this document ships as a handoff feed without that one, so a cross-reference would not resolve for its reader. **Change one and change the other.***

FPTR prefix shows 'R' (read) or 'W' (write). Center byte (index 6) is highlighted.

The row is **three separate click regions**: clicking the **address** navigates to the
pointer itself; clicking a **data byte** navigates to that specific byte, accounting for the
6-byte lead-in; clicking a **character** does the same at one byte per character. All three
put the disassembly into hub-lock mode.

### Status Indicators

Five flags highlighted in bright orange when active, dimmed when inactive:

| Indicator | Meaning |
|-----------|---------|
| INIT | COGINIT occurred |
| STALLI | Stall interrupt active |
| STR | Streamer active |
| MOD | Color modulator active |
| LUTS | LUT sharing active |

### Pin Registers

Three rows of 64-bit binary values (DIR, OUT, IN) split into byte groups:

```
DIR  xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx  xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx
OUT  xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx  xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx
IN   xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx  xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx
```

> *This layout also appears in `DOCs/pascal-REF/SingleStep-Debugger-Theory-of-Operations.md`, which carries the bit-field sourcing beneath it. Both copies are deliberate — this document ships as a handoff feed without that one, so a cross-reference would not resolve for its reader. **Change one and change the other.***

### Smart Pin Watch

Automatically tracks up to 7 smart pins with changed RQPIN values. Shows pin number
(P00-P61) + 8-digit hex value. Pins 62/63 (TX/RX) are excluded. By default only pins with
the DIR bit set are shown.

**Any click on this box resets the watch list** — left or right. A right-click *additionally*
toggles the filter between all pins and DIR-only. The unconditional reset is what makes the
filter change visible immediately: the list clears and repopulates under the new filter
instead of the change hiding behind the delta-decay counters.

### Hub Data Viewer

8 rows x 16 bytes of hub memory:

```
xxxxx  xx xx xx xx xx xx xx xx  xx xx xx xx xx xx xx xx  ................
```

Each row: 5-digit address + 16 hex bytes + 16 ASCII characters (non-printable shown as '.'). Address wraps at `$FFFFF`.

Navigation: arrow keys (Up/Down = +/-`$10`), page keys with modifiers, the mouse wheel over
the data area (16 bytes per notch, or 1/4/128 with modifiers), the mouse wheel over an
address digit to change that nibble, a click on a hub data byte or ASCII character to jump
to it, or a click on the hub heatmap to jump to that 128-byte sub-block. The heatmap is
**excluded** from wheel scrolling — click it, don't scroll it.

The hex columns and the ASCII column are **separate click regions**: three characters per
byte in the hex area, one per byte in the ASCII area, and the gap between them does nothing.

### Hub Heatmap

Small bitmap (64 x 62 pixels) showing block-level change activity across hub memory. Each pixel represents one 128-byte sub-block (3,968 sub-blocks total). Brighter = recently changed.

### Hint Bar

Context-sensitive status bar at the bottom showing details about whatever the mouse is hovering over.

---

## Multi-COG Debugging

Each cog that hits a breakpoint gets its **own separate debugger window**. There is no tab-switching between cogs — you work with multiple windows simultaneously.

### COGBRK (Asynchronous Break)

One cog can force another into the debugger using the `COGBRK` instruction:

```spin2
COGBRK  #3             ' Force cog 3 into debugger
```

**Important limitations**:
- The target cog must have debugging enabled
- Async break from the host only works when another cog is currently halted in its debug ISR (and thus processing the serial protocol)
- If no cog is in debug, there is no way to force a break from the host

### Viewing Another Cog's State

When a cog is halted at a breakpoint, you can request COGBRK for other cogs via the protocol. The target cog enters its debug ISR and opens its own debugger window.

---

## DEBUG Statement Formatting

The debugger supports various output formats for `DEBUG` statements in the text console:

```spin2
' Decimal formats
DEBUG(UDEC(value))             ' Unsigned decimal
DEBUG(SDEC(value))             ' Signed decimal

' Hexadecimal formats
DEBUG(UHEX(value))             ' Unsigned hex
DEBUG(SHEX(value))             ' Signed hex

' Binary formats
DEBUG(UBIN(value))             ' Unsigned binary
DEBUG(SBIN(value))             ' Signed binary

' Floating point
DEBUG(FDEC(fpvalue))           ' Float as decimal

' Strings
DEBUG(ZSTR(@string))           ' Zero-terminated string

' Boolean
DEBUG(BOOL(value))             ' Boolean value

' Arrays (append _ARRAY suffix and add count)
DEBUG(UDEC_BYTE_ARRAY(@array, count))

' Timing
DEBUG(DLY(1000))               ' Delay 1000ms after output

' PC interaction
DEBUG(PC_KEY(@buffer))         ' Get keyboard input from host
DEBUG(PC_MOUSE(@buffer))       ' Get mouse input from host

' Flags
DEBUG(C_Z)                     ' Output "C=? Z=?"
```

Each format supports display specifiers controlling separator and label output.

---

## Configuration Symbols

Define these `CON` symbols in your Spin2 source to configure debugging:

| Symbol | Default | Effect |
|--------|---------|--------|
| `DEBUG_DISABLE` | 0 | Non-zero disables all DEBUG statements |
| `DEBUG_PIN_TX` (or `DEBUG_PIN`) | 62 | TX pin number |
| `DEBUG_PIN_RX` | 63 | RX pin number |
| `DEBUG_BAUD` | Download baud | Serial baud rate |
| `DEBUG_COGS` | `$FF` (all) | Bitmask of cogs to enable debugging on |
| `DEBUG_COGINIT` | — | If defined, break on COGINIT events |
| `DEBUG_MAIN` | — | If defined, break on initial cog execution |
| `DEBUG_DELAY` | 0 | Startup delay in milliseconds |
| `DEBUG_TIMESTAMP` | — | If defined, show 64-bit timestamps in output |
| `DEBUG_LEFT/TOP/WIDTH/HEIGHT` | — | Host terminal window position |
| `DEBUG_DISPLAY_LEFT/TOP` | — | Host display window position |
| `DEBUG_LOG_SIZE` | 0 | Host log file size (0 = disabled) |
| `DEBUG_WINDOWS_OFF` | 0 | Suppress host debug windows |

---

## Tips and Common Scenarios

### Understanding the Display States

- **Halted**: Cog stopped at breakpoint. Display fully rendered. Go button shows "Go".
- **Single Go**: After pressing Space. Cog executes until break condition met, then halts again.
- **Repeat Mode**: After pressing Enter. Cog runs continuously with throttled updates (~20 breaks/sec). Press Enter or Space, or click GO with either button, to stop.
- **Running (dimmed)**: 250ms timeout without a breakpoint. Display dims, Go button shows "Break".

### Finding Memory Corruption

1. Place `DEBUG` statements around suspicious code
2. Run until breakpoint
3. Examine the **hub heatmap** for unexpected bright spots (recently written areas)
4. Click that spot on the heatmap to jump the viewer there, or navigate the hex dump
   with the address-nibble wheel
5. Switch disassembly to hub mode, navigate to suspect code
6. Single-step while watching the hub heatmap for the write

### Debugging Interrupts

1. Enable the appropriate **INT1/INT2/INT3** single-step button (left column)
2. Or enable **INT1E/INT2E/INT3E** entry break button to catch interrupt entry
3. Monitor the **Event Flags** panel to see which events are triggering
4. Check interrupt vectors in the **SFR** panel (IJMP1/IRET1, etc.)

### Watching Register Changes

The register watch list automatically populates when registers change between breakpoints. This is purely automatic — you don't manually add registers. The heatmap provides a visual overview, and the watch list shows specific values. Press **R** to clear the accumulated watch list.

### Navigating Disassembly

- **Follow PC mode** (default): Disassembly auto-scrolls to keep PC visible
- Use **mouse wheel** in the disassembly box to switch to cog/hub lock mode for free
  scrolling. The new lock is seeded from the address **currently on screen**, not from the
  PC — once the view has auto-scrolled away from the PC those differ, and you scroll on from
  what you were looking at
- **Click on the PC box**, or **left-click anywhere in the disassembly box**, to return to
  follow-PC mode
- **Click on an SFR** (IJMP/IRET) to navigate disassembly to that address — see the SFR
  rule above; it goes to cog space only for an interrupt-vector row holding a cog address
- **Right-click** in disassembly to set/clear an address breakpoint at that line. In hub
  mode a line that resolves below `$400` is refused — you cannot set a hub breakpoint inside
  cog space

### Performance Overhead

- The debugger stub occupies the top 16KB of hub RAM (`$FC000`-`$FFFFF`)
- Lock[15] is reserved for debugger mutual exclusion
- Serial pins (default 62/63) are used for debug communication
- Clock frequency must be at least 10 MHz

### Troubleshooting

| Symptom | Cause / Solution |
|---------|-----------------|
| Debugger window not opening | Ensure debug mode is enabled; check that `DEBUG_WINDOWS_OFF` is not set |
| Cog not breaking | Verify break condition bits match your intent; check `DEBUG_COGS` bitmask includes the target cog |
| Display dimmed, showing "Break" | Cog is running and hasn't hit a break condition in 250ms; check your break condition settings |
| COGBRK not working | Another cog must be halted in its debugger for async break to work; if no cog is in debug, the host cannot force a break |
| Hub data not updating | Only changed 4KB blocks are re-transferred; if the data hasn't changed since last break, it won't refresh |

---

For technical details on the debugger's internal protocol, CRC-based change detection, overlay architecture, and rendering system, see the [Single-Step Debugger: Theory of Operations](pascal-REF/SingleStep-Debugger-Theory-of-Operations.md).
