# Single-Step Debugger — Test Programs

Companion P2 source files for `../SingleStep-Debugger-Interactive-Test-Plan.md`.
Each file maps to one or more numbered tests in the plan.

## File → Test mapping

| Source file | Plan test(s) | What it exercises |
|---|---|---|
| `test01_basic_spin.spin2` | 1, 2, 5, 14 | Basic Spin2 loop; single-step, repeat mode, break-button matrix, hint bar |
| `test03_pasm_regs.spin2` | 3, 4 | PA/PB PASM loop; register watch, disassembly nav and wheel/clicks |
| `test06_flags_skip.spin2` | 6 | `cmp wz / cmp wc` and `skip #%1010`; C/Z flags, SKIP pattern, XBYTE, CT |
| `test07_stack_ptr.spin2` | 7 | PTRA/PTRB, `wrlong`, `call/ret`; SFR panel, pointer window, stack |
| `test08_hub_writes.spin2` | 8 | Tight loop writing hub[0..$FF]; hub viewer, heatmap, scroll keys |
| `test09_pins.spin2` | 9 | `drvh/drvl/fltl`; DIR/OUT/IN binary display, STATUS indicators |
| `test10_smart_pin.spin2` | 10 | Smart-pin NCO config + `rqpin`; smart-pin watch, DIR filter |
| `test11_interrupts.spin2` | 11, 13 | INT1 on CT1 event; EXEC panel, interrupt status, event breakpoints |
| `test12_multicog.spin2` | 12 | `cogspin` launches cog 1; per-cog debugger windows, COGBRK |

Tests 4, 5, 13 reuse the PASM code from earlier tests rather than duplicate it.
Test 14 (hint bar) runs against whatever program is loaded.

## Compiling

```bash
pnut_ts -d test01_basic_spin.spin2        # -d embeds the debug stub
```

All 9 files compile clean with `pnut_ts` v1.53.4 both with and without `-d`.

## Debug configuration

Every program defines:

- `_clkfreq = 200_000_000` (200 MHz system clock)
- `DEBUG_MAIN = 1` — break on the first MAIN instruction so the debugger window
  opens at startup
- `DEBUG_COGINIT = 1` (test 12 only) — also break when a cog is launched, so
  both cogs open their own debugger windows

To change the break behavior without editing the source, use the debugger's
button matrix (left-click exclusive set, right-click toggle; see Theory of
Operations §7.2).
