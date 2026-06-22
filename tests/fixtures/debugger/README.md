# Debugger replay fixture (sprint `dbg-comms-reframe` §1)

A real single-step-debugger (SSDB) break session captured from P2 hardware on
2026-06-22, committed so the protocol can be replayed deterministically
in-container as the pass/fail oracle for the comms re-frame sprint.

## Files

| File | What it is |
| --- | --- |
| `capture.bin` | The raw **RX** byte stream (P2 → host), all USB chunks concatenated in arrival order. Begins with the `Cog0  INIT … load\r\n` terminal text, then the first Phase-1 (416 B, cog 0), then the interleaved Phase-3 stream. |
| `manifest.json` | `{ source, totalBytes, chunkCount, chunkLengths[] }` — the **ordered USB chunk lengths** (62, 124, …) so the harness re-feeds the stream at the exact boundaries that triggered the Phase-3 desync. |
| `extract-capture.mjs` | Provenance generator: parses the gitignored hardware capture into the two artifacts above. |

## Provenance

Source: `REF-NO-COMMIT/logs/usb-traffic_260622-142138.log` (the PNut-Term-TS
"USB Traffic Log" format). That capture lives under `REF-NO-COMMIT/`
(gitignored, hardware-only) and is **not** present on every machine, so the
committed `capture.bin` / `manifest.json` are the durable artifacts. To
regenerate on a machine that has the capture:

```
node tests/fixtures/debugger/extract-capture.mjs REF-NO-COMMIT/logs/usb-traffic_260622-142138.log
```

The generator drops the interleaved `[USB SEND] Sent 52 bytes` blocks (host→P2
Phase-2 replies — the controller generates those itself; they are not RX data)
and takes exactly `min(16, N-offset)` `$hh` tokens per hex row so an ascii tail
containing `$` (e.g. `… load $0000`) is never miscounted.

## Known-good calibration (from the companion `debug_260622-142138.log`)

- **19** Phase-1 breaks.
- On the **current (broken)** code: **10** Phase-3 exchanges complete
  (`complete=true`), **98** chunks stuck `complete=false` — the S1/S2 symptoms.
- Logger wiretap leak (S3): debugger Phase-3 bytes hex-dumped as
  `INVALID(0xNN)` / `Cog N:` lines.
- First break expects Phase-3 ≥ 4402 B (64 cog blocks + 2 hub blocks + 170
  fixed + smart-pin tail).

The §1 replay test asserts the **spec** target (19/19 complete) and therefore
**fails on current code** — that failure encodes the goal §3/§4 make pass.

`totalBytes` = 11139, `chunkCount` = 186 (chunk sizes: 173×62, 10×22, 1×124,
1×61, 1×8).
