# Debugger Comms — Phase-1/2/3 Pascal-Faithful Re-frame (Sprint Plan)

**Goal:** Make the single-step debugger (SSDB) wire protocol *robust* — a
single-owner, exact-byte-count break transaction that cannot wedge, leak, or
desync — so the debugger UI can be certified on a solid foundation instead of a
flaky channel.

**Scope decided with Stephen:** Full Pascal-faithful re-frame (Option A),
executed evidence-first (replay harness + leak-kill before the re-frame). The
high-throughput streaming classifier (the HW-validated 2 Mbaud `#31` path) is
**out of scope and must be provably untouched.**

**Spec source (oracle):** `/pascal-source/P2_PNut_Public/DebuggerUnit.pas`
(`TDebuggerForm.Breakpoint`, :1161-1383) and `DebugUnit.pas` (`ChrIn` demux,
:177-255). This plan cites Pascal for every behavioral target.

---

## § Open Questions — RESOLVED (Stephen, 2026-06-22)

1. **Commit a real-capture replay fixture into `tests/`?** → **YES.** Extract
   the raw RX byte stream (preserving USB chunk boundaries) from
   `REF-NO-COMMIT/logs/usb-traffic_260622-142138.log` into a committed fixture
   under `tests/fixtures/debugger/` (a `.bin` + a tiny manifest of chunk
   lengths). P2 register/hub data, no secrets. Drives §1.

2. **Support the 456-byte Phase-1 variant now?** → **YES — length-driven now
   (§5).** Derive hub-block count (104/124) from Phase-1 length; accept 416 or
   456. Removes a latent renderer hard-fail; matches Pascal.

3. **Phase-3 completion-timeout value?** → **250 ms** (reuse
   `BREAKPOINT_TIMEOUT_MS`; well above the ~11 ms full-break wall time; Pascal's
   `RByte` 500 ms hardware-lost bound is the outer limit). Tunable. Drives §4.

Gate met: code research complete, all questions resolved.

---

## Background — why it's fragile (one paragraph)

The serial stack was built for **streaming** (P2→host, "more is always coming,"
no transaction). The SSDB is **request/response** (Phase-1 in → Phase-2 out →
Phase-3 in) and was retrofitted onto the streaming classifier. The result: one
atomic exchange split across **three owners** — the extraction worker
(`debuggerTransactionCog` raw-drain flag, `extractionWorker.ts:644,682-708,
758-763,858-870`), the main window (`awaitingPhase3`, `debugDebuggerWin.ts:63,
230-238,412-441`), and the renderer parser (`section`, `DebuggerPhase3.ts:59`)
— resync'd only by a 5-hop "done" round-trip, with **no exact byte accounting,
no completion timeout, and a logger wiretap** that hex-dumps raw Phase-3 as
`INVALID(0xNN)`. A single byte-count slip or a chunk landing at the wrong
instant wedges the pipe until a DTR reset. Symptoms in the 2026-06-22 capture:
only 10/19 Phase-3 cycles complete (S1), 98 chunks stuck `complete=false` (S2),
register bytes leaking to the logger (S3), trailing packets dropped (S4).

**Key refinement from code research:** `DebuggerPhase3Parser` is *already
correct and exact* (it walks to `Section.Done` deterministically and even has an
unused `leftover()` for over-run bytes). This sprint fixes the *framing,
ownership, recovery, and leak around* that sound parser — it does **not** rewrite
parsing.

---

## §1 — Replay harness over the real capture *(foundation; do first)*

**Why:** Lock the protocol down deterministically in-container before changing
anything, and give every later section a pass/fail oracle. This is the safety
net that lets us prove the streaming path is untouched and watch the exact
derail point on real bytes.

**Current code:** No replay path exists; debugger tests use synthetic packets
(`tests/debuggerFixture.test.ts`, `makeDebuggerState`/`buildPhase1Packet`). The
capture format is structured: `[USB RECV …] Received N bytes` then
`0000: $43 $6F …` hex rows (`REF-NO-COMMIT/logs/usb-traffic_260622-142138.log`),
preserving the **real USB chunk sizes** (62, 124, …) that triggered the desync.

**Target:**
- A committed fixture (per Open-Q1): raw RX byte stream + the ordered chunk
  lengths, extracted from the capture.
- A `tests/debuggerReplay.test.ts` harness that feeds the byte stream **through
  the real pipeline** (extraction worker framing → router → controller →
  Phase-3 parser) at the **original chunk boundaries**, and asserts, per break:
  exact Phase-1 length, exact Phase-2 bytes, Phase-3 reaches `Done`, byte count
  consumed == computed exact size, and **zero** debugger bytes routed to the
  logger/terminal classifier.
- A small replay driver usable as shared test scaffolding (not inlined) so §3/§4
  reuse it.

**Integration points:** extraction worker entry, `WindowRouter`, controller
Phase-1/2/3 entry. Must run under the Docker-safe runner; add to
`run_tests_sequentially.sh`.

**Verification — normal:** the captured 19-break run replays with 19/19 Phase-3
completions *as the spec requires* (this test will initially FAIL on current
code — that is the point; it encodes the target). **Edge:** chunk boundaries
split mid-element (62 B vs 64 B block) reassemble correctly; a break whose
Phase-3 is only the fixed 170 B + smart-pins (no changed blocks) completes.
**Error:** a deliberately truncated Phase-3 in a fixture variant triggers the
recovery path (§4), not a hang.

---

## §2 — Kill the logger wiretap leak (S3)

**Why:** Debugger Phase-1/3 binary is being hex-dumped to the logger as
`INVALID(0xNN)`/`Cog N:` because every binary packet is wiretapped and a cog-id
is mis-derived from register bytes. Pascal dedicates the wire to the debugger
during a break — nothing else sees those bytes.

**Current code:** `windowRouter.ts:340-389` (`routeBinaryMessage`) unconditionally
copies every binary packet to all `logger`-type windows and derives cogId from
the first 4 bytes (:343-353). Out-of-window Phase-3 also re-classifies via
`extractionWorker.ts:559-588` → `INVALID_COG` → logger (`messageRouter.ts:331`).

**Target:** `DEBUGGER{N}_416BYTE` and `DEBUGGER{N}_PHASE3` message types are
**never** routed to the logger wiretap or the text/terminal classifier — they
go solely to their debugger window. The logger keeps wiretapping genuine
streaming binary (unchanged).

**Integration points:** `routeBinaryMessage` type guard; `routeMessage`
dispatch; ensure no INVALID_COG path can receive debugger-tagged bytes.

**Verification — normal:** replaying the capture, the logger receives **zero**
`INVALID(0x..)`/`Cog N:` lines derived from debugger Phase-3. **Edge:** genuine
terminal output interleaved at break boundaries (`Cog0 … load\r\n` seen in the
capture) still reaches the logger/terminal correctly. **Error:** a non-debugger
INVALID byte still logs as before (no regression to streaming diagnostics).

---

## §3 — Single-owner transaction + exact byte accounting (S1/S2 core)

**Why:** Collapse the three unsynchronized owners into one authority with exact
byte accounting, mirroring Pascal's atomic `Breakpoint`. This removes the race
*class*, not just instances.

**Current code:** Worker opens its transaction on Phase-1 detection
(`extractionWorker.ts:758-763`) *before* Phase-2 exists; main sets
`awaitingPhase3` only on the Phase-2 IPC (`debugDebuggerWin.ts:421`) — an
open-edge ordering gap (F8). Parser trusts `state.pendingCogBlocks`/
`pendingHubBlocks` (`DebuggerPhase3.ts:140,158`) which can be stale across a
desync (F10); `leftover()` is never called (over-run bytes abandoned).

**Target:**
- The **controller is the single authority.** On Phase-1 it parses (exact
  length), builds Phase-2, and **atomically** records the per-break request
  (`pendingCogBlocks`/`pendingHubBlocks`/`pendingHubCode`) AND sets
  "awaiting Phase-3" in the same synchronous step before any Phase-3 byte can be
  accepted — closing the open-edge race (F8).
- **Exact Phase-3 size** is computed at Phase-2 build:
  `cogPopcount·64 + hubPopcount·64 + (hubCode?64:0) + 170` fixed, plus the
  self-describing smart-pin tail (`8 mask bytes + 4·Σsetbits`, known as masks
  parse). Used as the authoritative **close + cross-check** (over/under-run
  detected, not silently mis-walked). Mirrors Pascal :1304-1383.
- The **worker becomes a dumb dedicated pass-through** for a debugging cog:
  forward raw bytes, no classify, no wiretap; its transaction flag is **slaved
  to the controller's close** (exact-count Done), not a guessed structural
  round-trip.
- On `Done`, **re-dispatch `leftover()`** rather than abandon it.

**Integration points:** `DebuggerController` Phase-1/Phase-2 path,
`DebuggerPhase3Parser` (add exact-size cross-check; call `leftover()`),
`extractionWorker` debugger branch (pass-through + slaved close),
`debugDebuggerWin` IPC (`awaitingPhase3` set synchronously).

**Verification — normal:** all 19 captured breaks complete with
consumed == computed exact size; one source of truth (no `awaitingPhase3` vs
`debuggerTransactionCog` divergence in a trace). **Edge:** first break (all
blocks, full ~4402 B) and a steady-state break (one changed cog block + fixed
tail) both frame exactly; smart-pin tail with mixed masks sizes correctly.
**Error:** Phase-2/Phase-3 desync by one break is *detected* by the size
cross-check and routed to recovery (§4), never silently mis-parsed.

---

## §4 — Deterministic completion + recovery (S1/S2/S4)

**Why:** Today one bad byte wedges the pipe forever (no timeout, worker swallows
the next Phase-1 as Phase-3). Pascal's `RByte` times out (500 ms) into a clean
error. We need bounded recovery so the channel self-heals.

**Current code:** No Phase-3 timeout anywhere (`BREAKPOINT_TIMEOUT_MS` only dims
the display, `DebuggerController.ts:165-168`). Worker raw-drain has priority and
cannot recognize a fresh 416 frame mid-Phase-3 (F9, `extractionWorker.ts:682`).
Non-416 non-awaited binary is hard-dropped (F7, `debugDebuggerWin.ts:234-238`).

**Target:**
- **Phase-3 completion timeout** (Open-Q3): if bytes stop mid-Phase-3 for the
  bound, abort the stuck transaction, reset the parser, return worker to normal
  framing, and log one diagnostic — recover, don't wedge.
- **New-Phase-1 escape (F9):** a 416/456-length frame arriving while awaiting
  Phase-3 is treated as the **start of a new break** — abort the stuck stream
  and resync. (Pascal guarantees the P2 sends only Phase-3 then the next break's
  Phase-1; a Phase-1-shaped frame mid-stream means we lost sync.)
- **Remove the hard drop (F7):** out-of-window binary is routed by the unified
  authority, not silently dropped; trailing all-zero remnants after a clean Done
  are recognized and discarded with a counted diagnostic, not logged as DROPPED.

**Integration points:** controller transaction state machine + a timeout timer;
worker debugger-branch escape check; `debugDebuggerWin` binary dispatch.

**Verification — normal:** clean runs never trigger timeout/escape (no spurious
aborts). **Edge:** a truncated-Phase-3 fixture recovers within the bound and the
*next* break frames cleanly (proving no wedge); a back-to-back break with no gap
still frames. **Error:** a corrupted mid-stream byte that shifts length is
caught by §3's cross-check and recovered here — assert the pipeline returns to a
good state without DTR reset.

---

## §5 — 416/456 Phase-1 hardware-variant correctness

**Why:** `PHASE1_SIZE=416` is hardcoded and the renderer **throws** on any other
length (`DebuggerController.ts:130-131`), while main accepts 416|456
(`debugDebuggerWin.ts:234`). A 456-byte (124-hub-block) part would hard-fail in
the renderer. Pascal selects layout by hub size.

**Current code:** `constants.ts:28` `PHASE1_SIZE=416`; `HUB_BLOCKS=104`;
controller hub-word loop reads `208 + i*2` for `HUB_BLOCKS` words (correct for
416 — the `// Parse 124 hub checksum words` comment is **stale and wrong**, it
loops 104).

**Target:** Phase-1 length-driven: accept 416 **or** 456, set the hub-block
count (104 or 124) from `(length-208)/2`, and size the Phase-2 hub bitmask and
Phase-3 hub loop accordingly. Fix the stale 124-comment.

**Integration points:** `DebuggerController.processPhase1`, Phase-2 hub-mask
build, `DebuggerPhase3` hub-block loop, `constants.ts`.

**Verification — normal:** 416-byte capture unchanged. **Edge:** a synthetic
456-byte Phase-1 fixture parses 124 hub words, builds a 16-byte hub mask, and
frames Phase-3 correctly. **Error:** a length that is neither 416 nor 456 is
rejected with a clear diagnostic and recovered (§4), not an unhandled throw.

---

## §6 — Documentation

**Why:** Keep the spec and durable references current; the protocol is now
authoritatively understood.

**Target deliverables:**
- Update `DOCs/project-specific/ARCHITECTURE.md` (SPEC_DOC) debugger-routing
  section with the re-framed single-owner transaction model and the exact
  Phase-1/2/3 byte layout (the authoritative spec captured during this sprint's
  research).
- Fix the stale `// Parse 124 hub checksum words` comment (§5).
- CHANGELOG v-entry at release via `build-wrapup` (P2-developer language:
  "the single-step debugger now talks to the P2 reliably — no stuck/blank
  panels, no log spam").
- The synthesized Pascal protocol spec (from §-research) recorded under
  `DOCs/project-specific/` as a durable debugger-protocol reference.

**Verification:** SPEC_DOC describes the shipped behavior; no code path the
sprint changed is left undocumented; CHANGELOG entry present.

---

## Sequencing

§1 (harness) → §2 (leak) first — foundation + clean signal. Then §3
(single-owner) → §4 (recovery) — the core, each proven against the §1 harness.
§5 (variant) is adjacent correctness, independent after §3. §6 at closeout.
Every section is a complete, first-testable deliverable. The streaming path is
out of scope throughout and the §1 harness must show it unchanged.
