# Single-Step Debugger — Input Commands: PNut Specification & PNut-Term-TS Parity

**Date:** 2026-08-12
**Part A source:** `/pascal-source/P2_PNut_Public/DebuggerUnit.pas` (v55 parity baseline)
**Part B source:** `src/classes/debugger/renderer/DebuggerInteraction.ts`,
`DebuggerRenderer.ts`, `shared/constants.ts`

This document has two independent halves.

- **Part A — PNut Debugger Input Reference.** A complete, self-contained description of every
  mouse and keyboard command the *original PNut debugger* supports, and what each one does.
  It is written to stand alone as the specification: no knowledge of our implementation is
  assumed or required, and it should remain valid regardless of what we do next. **This is the
  half that carries forward.**
- **Part B — PNut-Term-TS Parity Status.** Where our implementation stands against Part A,
  command by command, with findings ranked.

Scope: mouse and keyboard input only. Rendering, protocol framing, and the execution state
machine appear only where an input path writes them.

---
---

# PART A — PNut Debugger Input Reference

## A.0 Concepts you need first

**`BreakValue`** — the 32-bit word the debugger sends to the P2 to arm break conditions. Its
layout:

| Bits | Meaning |
|---|---|
| 0 | break on **MAIN** instruction (single-step) |
| 1 | break on **INT1** instruction |
| 2 | break on **INT2** instruction |
| 3 | break on **INT3** instruction |
| 4 | break on **DEBUG** |
| 5 | break on **INT1 entry** |
| 6 | break on **INT2 entry** |
| 7 | break on **INT3 entry** |
| 8 | break on **COGINIT** (also set on BRK before RETI0 to enable async break) |
| 9 | break on **event** (which event is in bits 15..12) |
| 10 | break on **PC address** (address is in bits 31..12) |
| 11 | `StallCmd` marker ($800) — the idle/stall command |
| 31..12 | payload: event number (4 bits) or break address (20 bits) |

**`StallBrk`** — what actually goes on the wire. Either `StallCmd` ($800, meaning "stay
halted") or a copy of `BreakValue` (meaning "run until one of these conditions").

**`RepeatMode`** — when true, the debugger re-issues the go command after each break, running
continuously through breakpoints until stopped.

**Disassembly modes (`DisMode`)** — three ways the disassembly pane picks its address:
- `dmPC` (0) — follows the program counter automatically.
- `dmCog` (1) — locked to a fixed cog/LUT address (`CogAddr`).
- `dmHub` (2) — locked to a fixed hub address (`HubAddr`).

**Shared address variables.** There is no separate "disassembly scroll position" in PNut. The
disassembly pane in hub mode and the HUB data pane **share the single `HubAddr` variable**, and
cog-space navigation shares `CogAddr`. Scrolling one moves the other. This is load-bearing
behavior, not an accident.

**The 16 event names** (`EventName[0..15]`): `INT, CT1, CT2, CT3, SE1, SE2, SE3, SE4, PAT, FBW,
XMT, XFI, XRO, XRL, ATN, QMT`. Row 0 (`INT`) is drawn but **not selectable** — the clickable
strip is defined as starting one row below the panel top and spanning 15 rows
(`BoxBoundary(..., EVENTt + 1 shl 1, 3, 15 shl 1, 0)`, :2081), which is precisely why the click
handler adds `+1` (:830). Selectable events are therefore `CT1..QMT` = `BreakEvent` 1..15.

**The 16 special-function registers** (`RegName[0..15]`, at cog $1F0..$1FF): `IJMP3, IRET3,
IJMP2, IRET2, IJMP1, IRET1, PA, PB, PTRA, PTRB, DIRA, DIRB, OUTA, OUTB, INA, INB`. The first
six are **interrupt vectors (code pointers)**; the remaining ten are **data pointers**. That
split drives the SFR click behavior in A.3.

**Layout constants:** `DisLines = 16` (disassembly window height), `HubSubBlockSize = $80`,
`HubMapWidth = 64`, `PtrBytes = 14`, `PtrCenter = 6` (the pointer panel shows 14 bytes with the
pointer itself at offset 6, i.e. 6 bytes of context before it).

---

## A.1 Keyboard commands

All letter keys are case-insensitive — PNut uppercases the character before dispatch (:1041).
Non-character keys are captured in `FormKeyDown` (:1012-1031) and remapped to control codes
before reaching the same dispatcher.

| Key | What it does |
|---|---|
| `SPACE` | **Go-single.** Exactly a left-click on the GO button: run until the next armed break. (With MAIN armed this looks like single-stepping; with EVENT armed it runs to that event.) |
| `ENTER` | **Go-repeat.** Exactly a right-click on GO: run continuously through breaks. Pressing it again while repeating stops. |
| `B` | Left-click the **BREAK** button — arm asynchronous break (clears all other conditions except INIT). |
| `I` | Right-click the **INIT** button — toggle break-on-COGINIT. |
| `D` | Right-click the **DEBUG** button — toggle break-on-DEBUG. |
| `M` | Right-click the **MAIN** button — toggle break-on-MAIN. |
| `R` | Left-click the register-watch box — **reset the register-delta watch list**. |
| `↑` | Hub view up one line: `HubAddr -= $10` (16 bytes). |
| `↓` | Hub view down one line: `HubAddr += $10`. |
| `PageUp` | Hub view back one block: `-$80` (one sub-block). With **Ctrl**: `-$1000`. With **Shift**: `-$10000`. |
| `PageDown` | Same magnitudes, forward. |
| `TAB` | Swallowed. The form requests `DLGC_WANTTAB` (:530) so Tab cannot move focus off the debugger. |
| `←` `→` `Home` `End` `Delete` `Insert` | Captured by `FormKeyDown` and passed on, but **no dispatch case matches** — deliberately inert. |

Hub navigation keys work regardless of where the mouse is; they are not region-sensitive.

---

## A.2 Mouse — the break-control buttons

Thirteen buttons in two columns plus GO. Twelve share one grammar:

- **Left-click = arm exclusively.** Clear every other condition (but keep INIT), then set this
  one: `BreakValue := BreakValue and $100 or <bit>`.
- **Right-click = toggle.** Flip this condition, clearing DEBUG: `BreakValue := BreakValue and
  $FFFFFFEF xor <bit>`.

The exceptions are what make the panel work:

| Button | Left-click | Right-click | Notes |
|---|---|---|---|
| MAIN | arm bit 0 | toggle bit 0 | also `M` |
| INT1 / INT2 / INT3 | arm bits 1/2/3 | toggle | instruction-level |
| INT1E / INT2E / INT3E | arm bits 5/6/7 | toggle | interrupt **entry** |
| DEBUG | arm bit 4 | `and $110 xor $10` — **keeps INIT *and* DEBUG** | DEBUG is exclusive to all but INIT; also `D` |
| INIT | `or $100` — **sets, never clears others** | `xor $100` | INIT is independent of every other condition; also `I` |
| EVENT | `and $100 or $200 or BreakEvent shl 12` | if event armed → `and $DEF`; else `and $BEF or $200 or BreakEvent shl 12` | the `$DEF`/`$BEF` masks make EVENT and ADDR mutually exclusive |
| ADDR | `and $100 or $400 or BreakAddr shl 12` | if addr armed → `and $BEF`; else `and $DEF or $400 or BreakAddr shl 12` | address set by right-clicking a disassembly line |
| BREAK | `BreakValue := BreakValue and $100` | **same — the action is not button-sensitive** | clears all but INIT; also `B` |

### The GO button (:724-752)

GO is a four-way state machine, evaluated in this order:

1. **Cog is free-running** (breakpoint timer disabled ⇒ the display is dimmed): request an
   asynchronous COGBRK for this cog (`RequestCOGBRK or 1 shl (cogn and 7)`), set
   `StallBrk := StallCmd`, `RepeatMode := False`. *Either* mouse button does this.
2. **Already repeating**: stop. `StallBrk := StallCmd`, `RepeatMode := False`. Either button.
3. **Left-click**: go-single. `StallBrk := BreakValue`.
4. **Right-click**: go-repeat. Record `OldTickCount`, set `RepeatMode := True`. Note it does
   **not** itself set `StallBrk` — the repeat driver issues the command.

Pressing GO also sets `GoState := 2` and starts a 100 ms timer, which inverts the button colors
for a visible press-flash (:729, :1784).

---

## A.3 Mouse — click regions

PNut evaluates one `if / else-if` chain (:716-970); the first matching region wins.

| Region | Click behavior |
|---|---|
| **REG map / LUT map** (the vertical strips) | Lock the disassembly to the register under the cursor: `DisMode := dmCog`, `CogAddr := MapCogAddr`. The address is computed in `FormMouseMove` (:689) as `Within((MouseY - top) shl 9 div height - 8, $000, $1F0)` — note the **`-8`**, which centers the clicked register in the 16-line window rather than putting it on the top line, and the **clamp to $1F0** which keeps a full window in range. LUT adds `$200`. |
| **PC box** | `DisMode := dmPC` — resume following the program counter. |
| **Disassembly, left-click** | `DisMode := dmPC` — lock back to PC. |
| **Disassembly, right-click** | Toggle a **PC-address breakpoint** on the clicked line. Computes the line's address (hub mode: `top + line*4`; cog mode: `top + line`), then: if that address is already the armed break address, disarm (`and $BFF`); otherwise set `BreakAddr` and arm (`and $DFF or $400 or addr shl 12`). **Guard:** in hub mode, if the resulting address is below $400 the click is *refused* (`Exit`, :876) — you cannot set a hub breakpoint inside cog space. |
| **Register watch box** | `ResetRegWatch` — clears the delta-watch tracking (`WatchReg[] := $FFFF`, `WatchRegList[] := $FFFF0000`) so the list repopulates fresh. Same as `R`. |
| **SFR data** | Navigate to the value in the clicked register. **If the value is < $400 *and* the row is one of the first six (IJMP3..IRET1)** → treat as a code pointer: `DisMode := dmCog`, `CogAddr := value`. **Otherwise** → treat as a hub data pointer: `DisMode := dmHub`, `HubAddr := value`. Both conditions are required. |
| **Stack data** | Treat the clicked stack slot as a pointer. Slot = character column ÷ 9 (nine characters per slot). If value < $400 → `dmCog` + `CogAddr`; else → `dmHub` + `HubAddr`. |
| **Pointer addresses** | `DisMode := dmHub`, `HubAddr := <the pointer value>`. |
| **Pointer data bytes** | `DisMode := dmHub`, `HubAddr := (pointer - PtrCenter) + (column ÷ 3)` — navigate to the specific byte under the cursor, accounting for the 6-byte lead-in. |
| **Pointer characters** | Same, with `+ column` (one character = one byte). |
| **Smart-pin watch** | **Always** `ResetSmartWatch`. A **right-click additionally toggles `WatchSmartAll`** — watch all pins vs. only pins with DIR set. The unconditional reset is what makes the filter change visible immediately. |
| **Hub data (hex)** | `HubAddr += row*16 + (column ÷ 3)` — navigate to the clicked byte. |
| **Hub characters (ASCII)** | `HubAddr += row*16 + column` — same, one char per byte. A **separate region** from the hex area. |
| **Hub heat-map** | `HubAddr := MapHubAddr` — jump to the clicked sub-block. Each cell is one 128-byte sub-block, row-major across a 64-wide map, back-scaled from the stretched draw rect (:695). |
| **Events list (CT1..QMT)** | Selects the event **and arms it in the same action**: sets `BreakEvent` from the row, then applies exactly the EVENT-button logic — left-click arms, right-click toggles. Clicking a name is not merely a selection. |

**Hover-only regions** (no click action, hint text only): REG box, LUT box, C flag, Z flag,
SKIP, XBYTE, CT, EXEC, interrupt box, status box, pin box, SFR box, events box, stack box,
pointer box, hub tab, button box.

---

## A.4 Mouse wheel

Direction: wheel-up decreases the address, wheel-down increases it.

Two step tables, indexed by modifier (`j = shift shl 1 or ctrl`):

| Modifier | Disassembly step | Hub step |
|---|---|---|
| none | 1 | 16 bytes (one row) |
| Ctrl | 4 | 1 byte |
| Shift | 16 | 4 bytes |
| Ctrl+Shift | 32 | 128 bytes (one sub-block) |

| Region | Behavior |
|---|---|
| **Disassembly** | If currently `dmPC`, first **break the PC lock** — switch to `dmCog` or `dmHub` depending on whether the *currently displayed* address (`DisAddr`) is below $400, seeding the new mode from that address. Then scroll: in `dmCog`, `CogAddr := Within(CogAddr + DisStep, $000, $400 - DisLines)` — **clamped**, so it stops with a full window rather than wrapping. In `dmHub`, `HubAddr := (HubAddr + DisStep shl 2) and $FFFFF` — note this uses the **disassembly** step ×4 (long-aligned), and writes **`HubAddr`**, so the HUB pane follows the disassembly. |
| **Hub address digits** | Wheel over one of the five hex digits to increment/decrement **that digit**: `HubAddr += dir shl (4 * (4 - digit))`. |
| **Hub data area** (`InHubBox and not InHubMap`) | `HubAddr += HubStep`. **The heat-map is explicitly excluded** — wheeling over the map does nothing. |

No other region responds to the wheel.

---

## A.5 Hover hints

Every `MouseWithin` call carries a hint string, recomputed on every mouse-move; a 50 ms timer
(:703) detects the pointer leaving the form and clears the hint. Two hints are dynamic: the CT
box (elapsed seconds at the current clock frequency) and the XBYTE box (a 10-branch decode of
the XBYTE mode word, :1799-1825). The GO hint changes with `RepeatMode`.

Complete list of non-empty hints: REG box, REG map, LUT box, LUT map, C flag, Z flag, PC, SKIP,
disassembly, register watch, SFR box, events box, events list (per-row, naming the hovered
event), EXEC, stack box, interrupt box, pointer box, status box, pin box, hub tab, hub box, hub
address, hub map, button box, and all thirteen buttons. Regions with a deliberately empty hint:
XBYTE and CT (both are drawn dynamically elsewhere), SFR data, stack data, pointer address/data/
char, smart watch, hub data, hub char, GO button.

---
---

# PART B — PNut-Term-TS Parity Status

Measured against Part A. This supersedes the input half of
`DOCs/SingleStep-Debugger-Operation-Guide-and-Audit.md` (2026-05-31), which is **stale in our
favour**: it reported ~11 dead click regions, an unwired hint bar, and a no-op disassembly
wheel. All three have since been implemented.

## B.1 Scorecard

| Area | Status |
|---|---|
| Keyboard (A.1) | **13/13 at parity** |
| Button bit-math (A.2) | **13/13 exact**, incl. DEBUG's `$110` mask and EVENT/ADDR `$DEF`/`$BEF` |
| GO state machine (A.2) | **4/4 at parity** — F10 withdrawn, F11 benign (see below) |
| Click regions (A.3) | **14 of 17** actionable regions correct |
| Wheel (A.4) | step tables + direction correct; **4 of 5** target behaviors wrong |
| Hints (A.5) | 21 regions + 13 buttons present; **6 missing, 1 invented, 1 off-by-one** |

## B.2 Findings

### 🔴 F1 — Hub wheel scrolls 16× too far, every modifier combination
`DebuggerInteraction.ts:301` — `navHub(direction * hubMag * 16)`. `hubMag` already **is** the
A.4 hub step **in bytes**; multiplying by 16 again yields 256/16/64/2048 against the spec's
16/1/4/128. The plain wheel moves sixteen rows per notch instead of one, and the Ctrl-wheel
single-byte nudge moves sixteen bytes. **Fix:** drop the `* 16`.

### 🔴 F2 — Disassembly wheel in hub mode: wrong step table, wrong target
`:280-282`. Per A.4, hub-mode disassembly scrolling uses the **disassembly** step ×4 and writes
**`HubAddr`** so the HUB pane follows. We use the hub step and write `disTopAddr`. Both the
magnitudes and the pane coupling are lost.

### 🟠 F3 — Disassembly cog-mode wheel wraps instead of clamping
`:282` masks `& 0x3FF`; A.4 clamps to `$000..$3F0`. Scrolling past the end wraps to cog $000
instead of stopping with a full window.

### 🟠 F4 — `disTopAddr` vs PNut's shared `CogAddr`/`HubAddr` — **design decision required**
A.0 records that PNut has no separate disassembly scroll position: the disassembly and HUB
panes share `HubAddr`. We introduced `state.disTopAddr` as a distinct variable. This is the
root cause of F2's lost coupling and of the dmPC-seeding difference (`:277` seeds from
`state.pc`; A.4 seeds from the *currently displayed* `DisAddr`). **F2 is only correctly
fixable once this is settled**, so I have not touched it.

### 🟠 F5 — Right-click on BREAK does nothing
Per A.2, BREAK is not button-sensitive — either button clears all-but-INIT. We route
right-clicks to `onButtonRightClick`, which has no `'BREAK'` case (`:344-366`), so the click is
swallowed.

### 🟠 F6 — REG/LUT map click drops the `-8` centering and the `$1F0` clamp
`:450`, `:456`. Per A.3 the clicked register should land **mid-window**; ours lands on the top
line, and the address can run past `$1F0` (LUT past `$3F0`).

### 🟠 F7 — SFR click ignores the `< $400` test and never sets `dmHub`
`:490`. A.3 requires **both** value `< $400` **and** row `< 6`. We key only on the row, so an
interrupt vector holding a hub address wrongly locks the disassembly to cog space. The
else-branch (`:496`) sets `hubAddr` without setting `disMode = dmHub`, so the disassembly does
not follow the pointer.

### 🟠 F8 — Stack click never sets `dmHub`
`:508` — same omission as F7's else-branch. The nine-characters-per-slot column math is
correct.

### 🟠 F9 — Clicking the hub ASCII column does nothing
Per A.3 the character area is its own region (`+ column`, one char per byte). `onHubClick`
(`:557`) handles only the hex columns and returns without action for the ASCII column.

### ~~F10 — Stopping a repeat run doesn't reset `StallBrk`~~ — **WITHDRAWN, false finding**
*Corrected 2026-08-12 during the sprint-plan research pass.* The behavior is correct: it is
`setRepeatMode(false)` itself that sets `stallBrk = STALL_CMD`
(`DebuggerController.ts:635-640`), so both Go paths do reset it. Only the call site differs
from PNut's. **No work required.** Retained here, struck through, so the finding is not
re-raised by a future reading.

### 🟡 F11 — Go-repeat sets `StallBrk` where PNut does not — **benign, not a defect**
*Downgraded 2026-08-12 during the sprint-plan research pass.* PNut's send path
(`DebuggerUnit.pas:1331-1344`) ignores `StallBrk` entirely while repeating — sending
`BreakValue` throttled by `OldTickCount`, else `StallCmd` — and our port
(`DebuggerController.ts:580-592`) matches it exactly, 50 ms throttle included
(`REPEAT_THROTTLE_MS = 50`). The extra `setStallBrk(breakValue)` at `:427` is therefore dead:
the repeat branch never reads it, and `setRepeatMode(false)` overwrites it on exit. Remove for
clarity only.

**Consequence of both corrections: the GO state machine is 4/4 at parity, not 3/4.**

### 🟡 F12 — Event hint is off by one row (the click is correct)
Now fully resolved against the spec. A.0 explains PNut's `+1`: the clickable strip begins one
row below the panel, so `+1` maps strip-row 0 → `EventName[1]` = CT1.
- Our **click** (`:514`) measures from the panel top and uses the row directly, guarded to
  1..15 → CT1..QMT. **Correct**, and equivalent to PNut.
- Our **hint** (`:621`) subtracts a `2 * HALF_ROW_PX` title offset before indexing the same
  16-entry `EVENT_NAMES` (index 0 = `'INT'`). Hovering CT1 therefore reads **"INT"**.

The hint is one row off; remove the offset subtraction. *This also closes the "ambiguous +1"
question left open in the project notes — it is not ambiguous.*

### 🟡 F13 — Disassembly right-click missing the hub `< $400` guard
A.3 refuses to set a break address inside cog space while in hub mode (`Exit`, :876). We have
no such guard.

### 🟡 F14 — Wheel over the hub heat-map scrolls the hub
A.4 explicitly excludes the map (`and not InHubMap`). We test only the HUB panel bounds.

### 🟡 F15 — Six hover hints missing
Per A.5, absent in ours: REG box, LUT box, hub tab, hub address
("Hub Data | Mousewheel changes HUB address digit(s)"), hub map ("HUB Heatmap | Click to lock
HUB address"), button box ("Break Control | Select break condition(s) and execute code").

### 🟡 F16 — Smart-watch hint is invented
We show "RQPIN-Delta Watch List | L-Click to reset list | R-Click to watch all/only pins with
DIR set" (`:614`); per A.5 PNut's smart-watch hint is **empty**. The text is accurate and
arguably better, but it is a deviation — either remove it or ratify it as a documented one.

### 🟡 F17 — Letter commands fire while Ctrl/Alt/Meta are held
`:158` matches `KeyB`/`KeyD`/`KeyI`/`KeyM`/`KeyR` without checking modifiers. In Delphi,
Ctrl+letter delivers a control character, so PNut's Ctrl+B does nothing — and **Ctrl+M
delivers `#13`, i.e. ENTER (go-repeat)**. We treat Ctrl+M as "toggle MAIN".

### 🟡 F18 — `e.code` is physical key position; PNut uses the produced character
`:158` derives the letter from `KeyX` scan codes, so on AZERTY/Dvorak the commands sit under
different printed keys than in PNut.

## B.3 Verified correct — do not "fix"

- All thirteen button bit-masks, including DEBUG's `$110` right-click mask and the EVENT/ADDR
  mutual-exclusion toggles.
- The complete keyboard map, including PageUp/PageDown magnitudes and sign inversion, and Tab
  capture.
- Wheel step tables and wheel direction. The macOS shift+wheel axis-swap (`:111`) is a required
  platform accommodation, not a deviation.
- The right-click whole-gesture latch (`:80-104`) — required because macOS/Electron delivers
  two mousedown+contextmenu pairs per physical right-press.
- Event-name click **arming** (A.3's "not merely a selection"), fixed v0.9.96.
- Smart-watch always-reset plus right-click filter toggle.
- Pointer panel address/data/character column math, including `PtrCenter`.
- Hub heat-map click: stretch back-scaling and sub-block bounds check.
- The dynamic CT and XBYTE hint decoders.
- Disassembly left-click = follow-PC. This **is** PNut behavior.

## B.4 Suggested work order

1. **F1** — one line; largest user-visible error.
2. **F5, F12** — one line each, in otherwise-correct code.
   *(F10 was withdrawn as a false finding; F11 is a benign one-line removal.)*
3. **F7, F8, F9, F13, F14** — small localized region-handler corrections.
4. **F6** — apply the `-8` and clamp to both maps.
5. **F15, F16** — hint coverage and the invented-hint decision.
6. **F4 first, then F2** — the shared-address design decision gates the wheel fix.
7. **F11** — verify against the repeat driver.
8. **F17, F18** — cosmetic; only if you want strict layout fidelity.
