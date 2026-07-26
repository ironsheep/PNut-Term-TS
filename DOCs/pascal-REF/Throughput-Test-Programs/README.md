# Throughput / stream-integrity test programs

Purpose-built P2 programs whose output makes serial-transport behavior **provable from a log**,
so judging throughput needs no screen-watching and no process-list reading.

Distinct from `../SingleStep-Debugger-Test-Programs/`, which exercise the single-step debugger.
These exercise the **serial path**: transport, extraction worker, router, log writer.

| Program | What it proves | Duration |
|---|---|---|
| `stress01_stream.spin2` / `.bin` | Stream integrity + throughput + write-under-load | ~2.5s — ends itself |
| `stress02_escape.spin2` / `.bin` | **Escapability**: windows stay responsive, quitting works, exit is prompt, log is intact | ~2 min — quit whenever |

Same rate; they differ only in how long they run. stress01 is too short to quit "mid-storm",
which is exactly what escapability has to test — hence the pair.

## Why the stream is numbered

Every line carries a monotonically increasing sequence number, so loss becomes **arithmetic**
rather than opinion: a gap is loss, a repeat is duplication, and a short tail measured against
the program's own `STRESS COMPLETE` count is truncation. A pictorial stress test cannot do this —
a bitmap that dropped a chunk still looks like a bitmap.

## Running one

```
pnut-term-ts -r stress01_stream.bin -u --usb-counts-only --diag-serial
node scripts/verify-stream-log.js <debug_*.log> <usb-traffic_*.log>
```

The verifier prints a per-gate PASS/FAIL. It reports missing evidence as **UNMEASURED** rather
than passing it — a gate with no data is not a gate that passed.

`--usb-counts-only` keeps the capture small (the hex dump inflates it ~6×); `--diag-serial`
enables the serial process's CPU self-sampling.

**Platform-agnostic.** Nothing here is Windows-specific: the same program and verifier judge
macOS and Linux captures, which is what makes this a standing regression asset for any future
serial work rather than a one-off for the Windows single-handle transport.

## Recompiling

```
cd DOCs/pascal-REF/Throughput-Test-Programs
pnut-ts -d stress01_stream.spin2
```

`-d` is required — without it the program has no DEBUG output at all. The compiled `.bin` is
committed alongside the source (same convention as the debugger test programs) so a bench run
needs no toolchain.
