# Single-Step Debugger — Operation Guide & Parity Audit

> **Purpose**: A lightweight, fact-based operator's guide to the P2 single-step
> debugger window, **plus** a TypeScript-vs-Pascal parity audit from the user-
> interaction standpoint. Every keystroke, mouse action, and window behavior
> below was verified against the actual source on both sides:
>
> - **Pascal (the specification)**: `/pascal-source/P2_PNut_Public/DebuggerUnit.pas`
>   — handlers `FormKeyDown` (L1012), `FormKeyPress` (L1033), `FormMouseDown`
>   (L716), `FormMouseWheel` (L972), `FormMouseMove` (L632).
> - **TypeScript (the reimplementation)** — the **live renderer bundle**
>   `src/classes/debugger/renderer/` (`DebuggerInteraction.ts`,
>   `DebuggerRenderer.ts`, `DebuggerController.ts`, `DebuggerPhase3.ts`,
>   `DebuggerState.ts`) plus the typed-IPC serial bridge
>   `src/classes/debugDebuggerWin.ts`. The former `src/classes/shared/debugger*`
>   main-process implementation was **dead code and was deleted** in the
>   ssdbg-parity sprint (§1); the renderer bundle is now the single source of
>   truth.
>
> Where the two differ, the Pascal behavior is correct (per project policy) and
> the discrepancy is flagged in **Part B**.
>
> **Status (ssdbg-parity sprint, v0.9.26):** the Part B punch list that was open
> at the 2026-05-31 audit is now essentially closed — see the verified scorecard
> below. One minor navigation convenience (hub-heatmap click) remains.

---

# PART A — OPERATOR'S GUIDE

## A.1 How the debugger appears

- The debugger is **not opened from a menu**. It opens automatically when the P2
  hits a debug breakpoint, which happens when:
  - the program executes a `DEBUG` statement, or
  - a configured break condition fires (`DEBUG_MAIN`, `DEBUG_COGINIT`, etc.).
- **One window per COG.** Each COG (0–7) that breaks gets its **own** window,
  titled **`Debugger - Cog N`**. There is no tab switching — up to **8 windows**
  coexist, each driven independently. (TS: `DebugDebuggerWindow` is constructed
  per `cogId`, `windowId = "debugger-${cogId}"`; COG id is range-checked 0–7.)
- Windows cascade so they don't stack exactly on top of each other.
- The debugger is **read-only**: you observe state and control execution. You
  **cannot** edit registers, memory, or pins from the window. (Confirmed: Pascal
  `FormMouseDown` has no edit/write path anywhere.)

## A.2 Window anatomy (123 × 77 half-row character grid)

```
     REGMAP  LUTMAP   C  Z  PC      SKIP/SKIPF pattern        XBYTE   CT(64-bit)
   +--------+--------+----------------------------------------------------------+
   |        |        | DISASSEMBLY (16 lines)        | WATCH | SFR ($1F0-$1FF) | E
   | reg    | lut    |                               | (reg  | (16 regs, 2 col)| V
   | heat   | heat   |                               | delta)|                 | E
   | map    | map    | EXEC  STACK (8 longs)                          BUTTON    | N
   |        |        | INT1/2/3   PTR (FPTR/PTRA/PTRB + bytes)         PANEL     | T
   |        |        | STATUS  PIN (DIR/OUT/IN, 64-bit binary)        (13 btns) |
   |        |        | SMART PIN WATCH                                          |
   |        |        | HUB DATA (8 rows × 16 bytes hex+ASCII)      HUB HEATMAP   |
   |        |        |            HINT BAR                                      |
   +--------+--------+----------------------------------------------------------+
```

Panels (all display-only unless noted in the mouse table):

| Panel | Shows |
|---|---|
| REG / LUT heatmap | Per-bit change "heat" for COG `$000–$1FF` / LUT `$200–$3FF` |
| C / Z / PC | Carry, Zero, 20-bit program counter (5 hex) |
| SKIP / SKIPF | 32-bit skip pattern (dim "Suspended…" when in CALL/interrupt) |
| XBYTE | XBYTE engine config (3 hex + checkmark if C/Z affected) |
| CT | 64-bit clock-tick counter (16 hex) |
| DISASSEMBLY | 16 disassembled lines; PC line inverse-highlighted |
| WATCH | Auto delta list of changed COG registers |
| SFR | The 16 special-function registers `$1F0–$1FF` |
| EVENT | 16 event flags (INT, CT1…QMT) as 0/1 |
| EXEC | Current context: MAIN / INT1 / INT2 / INT3 |
| STACK | 8 hardware-stack longs (STK0 = top) |
| INT1/2/3 | Interrupt event + idle/wait/busy state |
| PTR | 14 bytes of hub around FPTR, PTRA, PTRB |
| STATUS | INIT, STALLI, STR, MOD, LUTS indicators |
| PIN | DIR / OUT / IN as 64-bit binary |
| SMART | Auto delta list of changed smart-pin RQPIN values |
| HUB | Hub hex+ASCII viewer (8×16) |
| HUB heatmap | Block-level hub change activity |
| HINT BAR | Context help for whatever the mouse is over |

## A.3 Execution model (what "running" means here)

The cog is always either **halted in the debug ISR** (polling the host ~15×/sec)
or **running**. The host drives three states (TS `sendDebugCommand`, mirrors
Pascal §4):

| State | How you enter it | Behavior |
|---|---|---|
| **Halted** | Default at every break | Display fully drawn. Go button reads **"Go"**. |
| **Single Go** | `SPACE` or **left-click Go** | Sends the break condition **once**, cog runs until the condition is met, then halts again (one step). |
| **Repeat** | `ENTER` or **right-click Go** | Cog runs continuously, throttled to ~20 breaks/sec for visual tracking. Go button reads **"Stop"**. Press `SPACE`/`ENTER`/click Go to stop. |
| **Dimmed** | ~250 ms with no new break while running | Whole display dims (brightness halved); Go button reads **"Break"**. Next break re-brightens it. |

## A.4 Keyboard — complete set

This is the **entire** keyboard interface. There are no other keys.
(Pascal `FormKeyPress` handles SPACE/ENTER/B/I/D/M/R; `FormKeyDown` handles the
arrow/page keys. TS `KEYBOARD_SHORTCUTS` matches exactly.)

| Key | Action | Equivalent to |
|---|---|---|
| **Space** | Single-step (one Go) | Left-click **Go** |
| **Enter** | Toggle repeat (continuous) run | Right-click **Go** |
| **B** | Async-break mode: clear all break conditions except INIT | Left-click **BREAK** |
| **I** | Toggle INIT break (bit 8) | Right-click **INIT** |
| **D** | Toggle DEBUG break (bit 4) | Right-click **DEBUG** |
| **M** | Toggle MAIN single-step (bit 0) | Right-click **MAIN** |
| **R** | Reset the register-watch list | Left-click **WATCH** box |
| **↑ / ↓** | Hub viewer −/+ `$10` (one row) | — |
| **PageUp / PageDown** | Hub viewer −/+ `$80`; **Ctrl** = `$1000`; **Shift** = `$10000` | — |
| **Tab** | Captured/ignored (prevents focus loss) | — |

Letter keys are case-insensitive. Arrow/Page keys are global to the window (no
panel needs focus first).

## A.5 Mouse — complete set

Left/right click and the wheel are the only mouse inputs.
(Reference: Pascal `FormMouseDown` L716–971, `FormMouseWheel` L972–1010.)

### Clicks

| Region | Left-click | Right-click |
|---|---|---|
| **Break-condition buttons** (MAIN, INT1/2/3, DEBUG, INT1E/2E/3E, INIT, EVENT, ADDR) | Set that condition **exclusively** (keeps INIT bit 8) | **Toggle** that condition on/off |
| **BREAK button** | Clear all conditions except INIT | — |
| **Go button** | Single-step | Toggle repeat mode |
| **Disassembly** | Lock view to the clicked line (`dmPC → dmCog`) | Toggle an address breakpoint at that line (sets ADDR) |
| **REG / LUT heatmap** | Lock disassembly to that COG/LUT address | — |
| **PC box** | Return to follow-PC mode (`dmPC`) | — |
| **SFR value** | IJMP/IRET → lock disassembly there; PA/PB/PTRA/PTRB → jump hub viewer | — |
| **Stack value** | Jump disassembly to that return address | — |
| **Event name** | Select that event as the EVENT-break target | — |
| **Pointer box (FPTR/PTRA/PTRB)** | Jump hub viewer to that pointer | — |
| **Hub data / hub heatmap** | Jump hub viewer to the clicked address | — |
| **WATCH box** | Reset register-watch list | — |
| **SMART pin watch box** | Reset smart-pin watch list | Toggle "DIR-only / all pins" filter |

### Wheel

| Over… | No modifier | Ctrl | Shift |
|---|---|---|---|
| **Disassembly (cog-locked)** | ±1 reg | ±4 | ±16 |
| **Disassembly (hub-locked)** | ±16 bytes | ±1 | ±4 |
| **Hub data box** | ±16 bytes | ±1 | ±4 |
| **Hub address digits** | ±1 on the hex nibble under the cursor | — | — |

Wheeling the disassembly while in follow-PC mode first unlocks it to cog/hub mode.

### Hover

Moving the mouse over any panel updates the **HINT BAR** at the bottom with
context help (register address+value, "click to reset", "Special function
registers", disassembly mode, etc.). See Pascal `FormMouseMove`.

## A.6 Break conditions (the button panel)

Break conditions are **bitmask flags** in `BreakValue`; several can be active at
once. Left-click = exclusive set (keeps INIT); right-click = toggle.

| Button | Bit / mask | Meaning |
|---|---|---|
| MAIN | `$001` | Break on each MAIN instruction (single-step) |
| INT1 / INT2 / INT3 | `$002 / $004 / $008` | Single-step within that interrupt |
| DEBUG | `$010` | Break on `DEBUG` (BRK with non-zero code) — **mutually exclusive** with the single-step bits |
| INT1E / INT2E / INT3E | `$020 / $040 / $080` | Break on interrupt entry |
| INIT | `$100` | Break on COGINIT — **independent**, never cleared by other buttons |
| EVENT | `$200` (+ event id in bits 15:12) | Break on a chosen event |
| ADDR | `$400` (+ addr in bits 31:12) | Break on an address match |
| BREAK | — | Clear all conditions except INIT (async-break mode) |
| (internal) | `$800` | STALL flag — keeps the cog halted; not a user button |

## A.7 Multi-COG notes

- Each COG window steps/runs **independently**.
- **COGBRK (async break)** lets one halted cog force another into the debugger —
  but only works while **some** cog is already halted in its debug ISR and
  pumping the protocol. If no cog is in debug, the host cannot force a break.

---

# PART B — TYPESCRIPT ↔ PASCAL PARITY AUDIT (user-interaction)

Scope: only the **operator-facing** behaviors above. Rendering/protocol internals
are out of scope here. Legend: ✅ implemented & matches · ⚠️ partial/incorrect ·
❌ missing · ➕ TS-only behavior not in Pascal (removed).

> **All file/line references below are to the LIVE bundle**
> `src/classes/debugger/renderer/DebuggerInteraction.ts` unless noted. The
> 2026-05-31 edition of this audit referenced the now-deleted
> `src/classes/shared/debugger*` files; those line numbers no longer apply and
> the gaps they described have been closed (see the scorecard).

## B.0 Verified scorecard (ssdbg-parity sprint, v0.9.26)

Re-audited 2026-06-02 against the live bundle. Every row was confirmed by reading
the cited handler.

| Area | 2026-05-31 status | **Now** | Evidence (live `DebuggerInteraction.ts`) |
|---|---|---|---|
| Keyboard (incl. Tab capture) | ✅ | ✅ | `handleKey` L104–148 (Tab swallow L111) |
| Execution / 13 buttons | ✅ | ✅ | `onButtonClick` L241, L/R semantics L254–299 |
| **COGBRK when free-running** (Go ⇒ async break) | — | ✅ **new** | `goWhileRunning` L310–317 → `onCogBrkRequest` |
| Disassembly wheel (auto-unlock + scroll) | ❌ | ✅ **fixed** | `handleWheel` L203–216 |
| Hub-box wheel (16/1/4 + ctrl+shift) | ⚠️ | ✅ | `handleWheel` L219–234 |
| **Hub-address nibble wheel** | ❌ | ✅ **new** | `handleWheel` L224–230 (`dir << 4*(4-col)`) |
| REG map → lock `dmCog` | ❌ | ✅ | `onRegMapClick` L358 |
| LUT map → lock `dmCog` (`$200+`) | ❌ | ✅ | `onLutMapClick` L365 |
| PC box → `dmPC` | ❌ | ✅ | `onPCClick` L354 |
| SFR value → disasm / hub nav | ❌ | ✅ | `onSFRClick` L392 |
| Stack value → disasm / hub nav | ❌ | ✅ | `onStackClick` L409 |
| Event name → set `BreakEvent` | ❌ | ✅ | `onEventClick` L421 |
| Pointer box (addr / **data / chr offset**) → hub | ❌ | ✅ | `onPointerClick` L427–449 |
| Hub data/ASCII click → move `HubAddr` | ⚠️ no move | ✅ | `onHubClick` L451–461 |
| SMART watch box (L reset / R DIR filter) | ❌ | ✅ | panels `SMART` L175 |
| WATCH box click → **reset** reg-watch | ⚠️ no reset | ✅ | `onResetWatch` L472 → `controller.resetRegisterWatch` |
| Disassembly L/R click (`dmPC` / addr-bp toggle) | ✅ | ✅ | `onDisassemblyClick` L371 |
| Hover hint bar | ❌ not wired | ✅ **fixed** | `mousemove` listener L75 → `updateHint` L485 |
| TS-only edit-dialog / pin-toggle / stack-wheel | ➕ remove | ✅ **removed** | absent from live bundle (dead files deleted §1) |
| **Disassembly SKIP strikethrough** (draw) | ⚠️ | ✅ **new** | `DebuggerRenderer.shouldStrikeSkipped` + `renderDisassembly` |
| **Hub heat-map graded decay** (draw) | ⚠️ binary | ✅ **new** | `DebuggerPhase3` sub-block capture + `nextHubHeat` + `renderHubMap` |
| Hub-heatmap **click** → jump viewer | ❌ | ✅ **new** | `handleMouseDown` hub-map branch → `renderer.hubMapBoundsPx()` → `hubAddr = subBlock*128` (Pascal L968) |
| Disassembler mnemonics vs real pnut-ts | ⚠️ untested | ✅ **new** | `disassemblerCorpus.test.ts` (174 longs, authoritative pnut-ts encodings) |

## B.1 Hub-heatmap click — RESOLVED (2026-06-03)

Clicking the **hub heat-map** (Pascal `FormMouseDown` InHubMap, L968:
`HubAddr := MapHubAddr`) now jumps the hub viewer to the clicked sub-block's
address. Implemented in `DebuggerInteraction.handleMouseDown` as a dedicated
branch *before* the panel loop (mirroring Pascal's separate InHubMap test), using
`renderer.hubMapBoundsPx()` — the single source of truth shared with
`renderHubMap` for the map's pixel rect. Each pixel is one 128-byte sub-block,
row-major: `hubAddr = (row*HUB_MAP_WIDTH + col) * HUB_SUB_BLOCK_SIZE`. Clicks on
the dim region past this firmware's sub-block count (`≥ HUB_SUB_BLOCKS`, since
pnut_ts reports 104 hub blocks ⇒ 3328 sub-blocks) are ignored. Tested in
`debuggerInteraction.test.ts` ("hub heat-map click (B.1)"). **No interaction gaps
remain.**

## B.2 How the gaps were closed

- The interaction, render, protocol, and Phase-3 logic now live entirely in the
  renderer bundle (`src/classes/debugger/renderer/`); `debugDebuggerWin.ts` is a
  thin typed-IPC bridge that forwards raw serial bytes to the bundle. The old
  main-process `shared/debugger*` files — which the 2026-05-31 audit measured —
  were confirmed dead and deleted (sprint §1/§2). The `disassemblyScroll`
  no-op TODO that B.3 flagged no longer exists; wheel handling is native in the
  bundle's `handleWheel`.
- The TS-only inventions (register-edit dialog, pin toggle, stack wheel) went
  away with the dead files; the live bundle is faithfully read-only.

---

*Re-verified against the live `src/classes/debugger/renderer/` bundle and
`DebuggerUnit.pas` (v51a tree), 2026-06-02. Pascal references use `FMD` =
`FormMouseDown`. Prior audit edition: 2026-05-31.*
