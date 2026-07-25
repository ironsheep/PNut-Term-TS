# Bench playbook — Windows single-handle transport

## Part 1 — gates 1–3: **PASSED on hardware 2026-07-25 (v0.11.1)**

Kept for the record; do not re-run unless something regresses.

| # | Exercise | Verdict | Evidence |
|---|---|---|---|
| 1 | transport named at startup | **PASS** | `[WIN-SYNC] opened \\.\COM6 synchronous handle=0x37c` |
| 2 | download completes | **PASS** | DCB readback `baud=2000000 8/0/0` → `Prop_Ver` Rev B/C → `[DOWNLOAD SUCCESS]` |
| 3 | **debug windows paint** | **PASS** | `WINDOW_PLACED PLOT 'Gauge'` + 959 bytes in 2 chunks, all accounted for, no dupes |

That closed the question the whole arc existed for: **the P2 keeps talking on the surviving
handle.** One connection carries reset → identify → load → checksum → debug stream.

---

## Part 2 — gates 4–6: ONE run, three answers

These are **margins, not architecture**. They decide tuning and whether Windows streaming is
ready to ship, not whether the design is right.

Everything is derived from the logs, so the Windows-side work is: **flash, type a few keys, send
two files.** No screen-watching, no Task Manager.

### The run

```
pnut-term-ts -r stress01_stream.bin -u --usb-counts-only --diag-serial
```

- **`stress01_stream.bin`** — `DOCs/pascal-REF/Throughput-Test-Programs/`, pre-compiled, ~9.6 KB.
  It emits 200,000 sequence-numbered lines (~2.4 MB, roughly 12s at 2 Mbaud) while continuously
  redrawing a PLOT window, then ends itself with `DEBUG_END_SESSION`. **No `--timeout` needed.**
- **`--usb-counts-only`** — new. Logs RX timestamps and byte counts without the hex dump, which
  would otherwise inflate this capture ~6× into tens of MB.
- **`--diag-serial`** — enables the serial process's CPU self-sampling (gate 6).

**One thing to do by hand:** partway through, **click the PLOT window and type a few keys**
(letters are fine). `PC_KEY` needs window focus. The program echoes each as `KEY <code> AT <seq>`.
Skipping this is fine — it just leaves gate 5 unmeasured rather than failing the run.

### Then

Send back both files from the log directory:

- `debug_*.log`
- `usb-traffic_*.log`

and I run:

```
node scripts/verify-stream-log.js <debug_*.log> <usb-traffic_*.log>
```

which prints a PASS/FAIL verdict per gate.

### What the verifier decides

**Gate 4a — integrity.** Every line carries a sequence number, so loss is arithmetic: a gap is
loss, a repeat is duplication, a short tail against the program's own `STRESS COMPLETE` count is
truncation. This is why the stream is numbered rather than pictorial — a bitmap that dropped a
chunk still looks like a bitmap.

**Gate 4b — throughput.** From per-chunk timestamps and sizes: sustained KB/s against the
~200 KB/s ceiling, chunk-size distribution, and the largest inter-chunk gap. A reader keeping up
returns small chunks often; one falling behind shows chunks climbing toward the 64 KB buffer
*and* widening gaps. Both are flagged.

**Gate 5 — write under load.** The host TX-logs each keystroke with a timestamp and the P2 echoes
it back, so the round-trip is measured while the stream is saturated. This is the canary for the
Windows synchronous-handle hazard, where a write can block behind a read. Ordering and integrity
are proven outright; latency is bounded from above.

**Gate 6 — cost.** The serial process samples its own CPU. It measures the right process *by
construction* — on Windows every one of our processes is `electron.exe`, so a human reading a
process list can't reliably tell which row is the serial reader. Idle samples prove the poll
backoff engages.

### Reading the result

- **PASS, no notes** → margins are fine; Windows streaming is ready.
- **PASS with notes** → ships, with a named tuning follow-up (e.g. `POLL_IDLE_MAX_MS`).
- **FAIL on integrity** → the one case needing a second run: re-run with the PLOT window
  **closed** to separate transport from render path. If loss disappears, it's render pressure
  (the #30 condition), not the pump. I'd ask for that bisect rather than guess.

### Caveat worth stating

200k lines also exercise the extraction worker and the log writer, so a failure is not
automatically the transport's fault. The verifier reports *where* the sequence broke, which
usually distinguishes them — but the bisect above is what settles it.
