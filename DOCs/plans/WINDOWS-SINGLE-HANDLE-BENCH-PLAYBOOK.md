# Bench playbook — Windows single-handle transport (v0.11.0)

One install, one pass. Each exercise is pass/fail keyed; record the verdict and drop the logs
in `REF-NO-COMMIT/windows-logs/`. Exercises 1–3 are the release gate; 4–6 are the margin checks
that tell us whether this ships as-is or needs tuning.

**What changed:** Windows now uses ONE connection for the whole session (reset → identify →
load → checksum → 2 Mbaud debug stream). There is no handoff between two connection types, and
no `--dl-transport` / `--dl-baud` flags any more — the transport is chosen automatically.

**Reference for the log lines:** the transport tags itself `[WIN-SYNC]`; the handshake steps are
`[P2-HANDSHAKE]`. The old `[SYNC-DL]` tag is gone (that was the download-only experiment).

---

## 1. Startup names the transport — GATE

```
pnut-term-ts -n
pnut-term-ts -r <any>.bin --diag-serial
```

**PASS:** the log carries
`* Windows: using the synchronous COM transport (single handle, survives the P2 reset)`.

**FAIL (broken install):** a WARNING that the synchronous transport is unavailable, naming the
reason. If you see this, koffi did not ship in the package — the download will fail and the rest
of the playbook is moot. Report the reason string; don't chase anything else.

## 2. Download still works — GATE (regression check on 0.10.10's win)

```
pnut-term-ts -r fig-05-plot-gauge.bin --diag-serial
```

**PASS:** `[WIN-SYNC] DCB readback: baud=2000000 byteSize=8 parity=0 stopBits=0`, then
`Prop_Ver 'G'`, then checksum `.`, then the program starts.

**FAIL:** anything short of the checksum `.`. Capture the whole `[P2-HANDSHAKE]` +
`[WIN-SYNC]` trace — the DCB readback and the per-try Prop_Chk replies are what localize it.

## 3. **Debug windows actually paint — THE GATE THIS BUILD EXISTS FOR**

Same run as #2, with a program that opens debug displays.

**PASS:** debug windows appear and update. This is the defect 0.10.11 could not clear: the
download succeeded but the stream was silent because the handoff reset the P2.

**FAIL:** windows open but stay blank, or no data arrives. That would mean the P2 is silent on
the surviving handle too — which falsifies the root-cause analysis, not just the fix. Say so
plainly; do not retry-and-hope.

## 4. Sustained 2 Mbaud without loss — MARGIN

Run a BITMAP-heavy / high-rate program (the #30 throughput case) for at least 30 seconds.

**PASS:** output is continuous, no gaps, no corrupted frames; the picture matches what the same
binary produces on macOS/Linux.

**WATCH FOR:** periodic stutter or dropped chunks — that would point at the read pump's idle
backoff, which is tunable (`POLL_IDLE_MAX_MS` in `winSyncPort.ts`). Note *how often* it stutters.

## 5. Terminal responsiveness while streaming — MARGIN

With #4's program still streaming, type into the terminal and (if the program supports it) drive
the single-step debugger.

**PASS:** keystrokes echo without noticeable lag.

**WHY THIS ONE MATTERS:** on a synchronous handle Windows serializes reads and writes, so a slow
write path would show up here first and nowhere else.

## 6. CPU cost — MARGIN

Task Manager, while streaming (#4) and while idle at a prompt.

**PASS:** the serial process's CPU is unremarkable in both states, and *drops* when idle.

**WATCH FOR:** a busy idle. The pump backs off to a 4 ms poll when the P2 is quiet; a pegged core
at idle means the backoff isn't engaging.

---

## Recording the outcome

| # | Exercise | Verdict | Notes |
|---|---|---|---|
| 1 | transport named at startup | | |
| 2 | download completes (checksum `.`) | | |
| 3 | **debug windows paint** | | |
| 4 | sustained 2 Mbaud, no loss | | |
| 5 | terminal responsive while streaming | | |
| 6 | CPU sane idle + streaming | | |

**Gates 1–3 green** = the Windows download story is closed and Windows stops blocking 1.0.
**4–6 amber** = ships, with a tuning follow-up named.
**3 red** = the root cause is elsewhere; stop and re-analyze rather than iterating on the pump.
