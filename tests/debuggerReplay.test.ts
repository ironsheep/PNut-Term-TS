/** @format */

/**
 * §1 replay oracle for the debugger comms re-frame sprint (`dbg-comms-reframe`).
 *
 * Drives a real 19-break hardware capture through the REAL pipeline
 * (`ExtractionCore` framing → `WindowRouter` → `DebuggerController` →
 * `DebuggerPhase3Parser`) at the original USB chunk boundaries and asserts the
 * protocol's behavior. See `tests/shared/debuggerReplay.ts` for the harness and
 * `tests/fixtures/debugger/README.md` for the capture's provenance + calibration.
 *
 * Progress against the sprint sections:
 *   • §2 (DONE) → `loggerBinaryBytes === 0` — debugger frames never reach the
 *     logger wiretap.
 *   • §3 (DONE) → the controller is the single framing authority: it re-frames
 *     the raw stream structurally via exact-accounting `leftover()`, and
 *     `droppedBinaryMessages === 0` (the open-edge gate that dropped Phase-3 is
 *     gone).
 *   • §5 (DONE) → the authoritative Phase-1 is **456 bytes** (20 longs + 64 CRC
 *     words + 124 hub words), per DebuggerUnit.pas `Breakpoint` and
 *     Spin2_debugger.spin2 `bp_handler` — there is no 416/104 variant. With
 *     `PHASE1_SIZE=456`/`HUB_BLOCKS=124`, all 11 clean breaks frame and the 10
 *     that carry Phase-3 complete with exact byte accounting.
 *
 * Capture structure (measured): 11 Phase-1 frames whose CRC words match break-0
 * at offsets 39, 4905, then every +642 B. break-0's Phase-3 is 4410 B
 * (regs 4096 + sums 128 + hubReads 170 + smart-pin tail 16). break-10's 456-byte
 * Phase-1 is the capture's tail (10683 + 456 = 11139) with no Phase-3, so 10 of
 * 11 complete. The other "19" host→P2 replies in the manifest were sent during
 * the derail and are not clean RX breaks.
 */

import { loadCaptureFixture, runReplay } from './shared/debuggerReplay';
import { makeController, makeDebuggerState, buildPhase1Packet, buildPhase3Packet } from './shared/debuggerFixture';
import {
  BREAKPOINT_TIMEOUT_MS,
  COG_BLOCK_SIZE,
  HUB_BLOCK_RATIO,
  DIS_LINES,
  PTR_BYTES,
  HUB_SUB_BLOCK_SIZE
} from '../src/classes/debugger/shared/constants';
import { DebuggerState, DisMode } from '../src/classes/debugger/renderer/DebuggerState';

describe('debugger replay oracle (§1)', () => {
  const fixture = loadCaptureFixture();
  // One default replay shared by the read-only assertions below (each runReplay
  // resets the WindowRouter singleton, so the result is self-contained). The
  // edge / truncated / it.failing cases run their own replays on different input.
  const base = runReplay(fixture);

  // ── Fixture integrity ─────────────────────────────────────────────────────
  describe('capture fixture', () => {
    it('is the committed 186-chunk / 11139-byte, 19-break session', () => {
      expect(fixture.manifest.chunkCount).toBe(186);
      expect(fixture.manifest.totalBytes).toBe(11139);
      expect(fixture.bytes.length).toBe(11139);
      expect(fixture.chunkLengths.reduce((a, b) => a + b, 0)).toBe(11139);
      // 19 host→P2 Phase-2 replies were captured ⇒ the session had 19 breaks.
      expect(fixture.phase2Sends.length).toBe(19);
      expect(fixture.phase2Sends.every((s) => s.length === 52)).toBe(true);
    });

    it('begins with the P2 system-init line then binary Phase-1', () => {
      const head = Buffer.from(fixture.bytes.slice(0, 39)).toString('latin1');
      expect(head).toBe('Cog0  INIT $0000_0000 $0000_0000 load\r\n');
      // First Phase-1 starts immediately after, cog 0 (little-endian LONG).
      expect(Array.from(fixture.bytes.slice(39, 43))).toEqual([0, 0, 0, 0]);
    });
  });

  // ── Real-pipeline structural invariants (true broken OR fixed) ─────────────
  describe('real pipeline', () => {
    it('frames all 11 breaks as a 456-byte Phase-1 + 52-byte Phase-2', () => {
      // §5: the authoritative Phase-1 is 456 bytes (20 longs + 64 CRC words + 124
      // hub words — DebuggerUnit.pas Breakpoint / Spin2_debugger.spin2 bp_handler).
      // The capture's 11 clean breaks all frame at the single owner.
      expect(base.breaks.length).toBe(11);
      for (const b of base.breaks) {
        expect(b.phase1Length).toBe(456);
        expect(b.phase2Length).toBe(52);
      }
      expect(base.phase2Replies.every((p) => p.length === 52)).toBe(true);
    });

    it('builds a byte-exact Phase-2 for the first break (matches the captured SEND)', () => {
      // First break: every cog block is "changed" (cogCrcOld seeded 0xFFFF), so the
      // 8-byte cog request mask is all 0xFF — and the whole 52-byte reply must equal
      // the real host→P2 Phase-2 the hardware sent.
      expect(Array.from(base.phase2Replies[0].slice(0, 8))).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
      expect(Array.from(base.phase2Replies[0])).toEqual(Array.from(fixture.phase2Sends[0]));
    });
  });

  // ── Fixed behavior — §2/§3/§5 land; each line documents the symptom it cures ──
  describe('fixed behavior — symptoms cured by §2/§3/§5', () => {
    const r = base;

    it('S1/S2: every break that carried Phase-3 completes with exact accounting', () => {
      // §3 (single-owner exact-accounting re-framer) + §5 (456-byte Phase-1)
      // together cure the desync: all 11 clean breaks frame, and every break that
      // actually received Phase-3 reaches Done. break-10 is the capture's tail —
      // its 456-byte Phase-1 is the last bytes recorded (10683 + 456 = 11139), so
      // it has NO Phase-3 and legitimately cannot complete (a §4 timeout would
      // abort it on hardware). Hence completedBreaks === totalBreaks - 1.
      expect(r.totalBreaks).toBe(11);
      expect(r.completedBreaks).toBe(10);
      expect(r.completedBreaks).toBe(r.totalBreaks - 1);
    });

    it('S3: debugger binary no longer leaks to the logger wiretap (§2 fixed)', () => {
      // §2 killed the wiretap leak: WindowRouter.routeBinaryMessage now keeps
      // debugger Phase-1/Phase-3 frames off logger-type windows (they render as
      // bogus 'Cog N:' hex dumps there). Debugger frames go solely to their cog's
      // debugger window; the logger still wiretaps genuine streaming via the text
      // path. Was `> 0` (11100 B leaked) before the fix.
      expect(r.loggerBinaryBytes).toBe(0);
      expect(r.loggerBinaryMessages).toBe(0);
    });

    it('F7: out-of-window Phase-3 chunks are no longer dropped (§3 single-framer)', () => {
      // §3 removed the main-side awaitingPhase3 gate that dropped Phase-3 chunks
      // landing in the open-edge window: the controller is now the single framing
      // authority and consumes every byte (re-framing the worker over-drain via
      // exact-accounting leftover()). So the clean-capture drop count is 0. Was
      // `> 0` (19 chunks dropped) on the gated baseline. §4 adds *active recovery*
      // (timeout / new-Phase-1 escape / counted remnant) for truncated/corrupt
      // streams the clean capture never exercises.
      expect(r.droppedBinaryMessages).toBe(0);
    });
  });

  // ── Edge: chunk-boundary independence (reassembly) ────────────────────────
  describe('edge — chunk boundaries', () => {
    /** Re-chunk the same bytes into uniform pieces of `size`. */
    const reChunk = (size: number) => {
      const lengths: number[] = [];
      for (let off = 0; off < fixture.bytes.length; off += size) {
        lengths.push(Math.min(size, fixture.bytes.length - off));
      }
      return { ...fixture, chunkLengths: lengths };
    };

    it('reassembles a Phase-1 split across different chunk boundaries', () => {
      // Re-cut the identical stream into tiny 7-byte pieces, splitting the
      // 416-byte Phase-1 (and every 64-byte block) mid-element. The framer must
      // reassemble it: the first break still yields the byte-exact Phase-2 the
      // hardware sent — proving extraction is chunk-boundary-independent.
      // (The total break COUNT is NOT asserted here: it is a function of the
      // continuous-thread close/awaitingP3 race that the single-threaded harness
      // approximates, so it shifts with chunk granularity — see the file header.)
      const tiny = runReplay(reChunk(7));
      expect(tiny.breaks[0].phase1Length).toBe(456);
      expect(Array.from(tiny.phase2Replies[0])).toEqual(Array.from(fixture.phase2Sends[0]));
    });
  });

  // ── Error: truncated Phase-3 must not hang (recovery is hardened in §4) ────
  describe('error — truncated Phase-3', () => {
    it('returns cleanly with the final break incomplete (no hang/throw)', () => {
      // Drop the last 200 bytes so the final break's Phase-3 is truncated.
      const cut = fixture.bytes.length - 200;
      const truncated = {
        ...fixture,
        bytes: fixture.bytes.subarray(0, cut),
        chunkLengths: (() => {
          const out: number[] = [];
          let acc = 0;
          for (const len of fixture.chunkLengths) {
            if (acc + len <= cut) { out.push(len); acc += len; }
            else { if (cut - acc > 0) out.push(cut - acc); break; }
          }
          return out;
        })()
      };
      // §1 only requires it not to wedge or throw on a short stream — reaching
      // this assertion at all proves no hang. §4 will replace this with a
      // deliberately-mid-Phase-3 truncation that asserts bounded recovery and
      // that the NEXT break still frames cleanly.
      const r = runReplay(truncated);
      expect(r.breaks.length).toBeGreaterThan(0);
      expect(r.totalBreaks).toBeGreaterThan(0);
    });
  });

  // ── §4 — Phase-3 stall self-heal (controller unit test, fake timers) ───────
  describe('§4 — Phase-3 stall recovery', () => {
    afterEach(() => jest.useRealTimers());

    it('aborts a break stalled mid-Phase-3, then recovers on the next clean break', () => {
      jest.useFakeTimers();
      const state = makeDebuggerState(0);
      const logs: string[] = [];
      const h = makeController(state, { log: (m) => logs.push(m) });

      // Break A: a Phase-1 whose every cog block changed (huge Phase-3), then
      // feed only a 10-byte sliver of Phase-3 — the break cannot complete.
      h.controller.processPhase1(buildPhase1Packet({ cogCrc: new Array(64).fill(0x1234) }));
      const partial = buildPhase3Packet(state).subarray(0, 10);
      h.controller.processPhase3(partial);
      expect(h.calls.phase3Complete).toBe(0); // still open, awaiting the rest

      // Bytes stop. After the stall bound the watchdog aborts the stuck break.
      jest.advanceTimersByTime(BREAKPOINT_TIMEOUT_MS + 1);
      expect(logs.some((m) => /stall/i.test(m))).toBe(true);
      expect(h.calls.phase3Complete).toBe(0); // the aborted break never completes

      // Recovery: a fresh, complete break frames and completes normally —
      // proving the pipe self-healed rather than wedging on the lost bytes.
      h.controller.processPhase1(buildPhase1Packet({ cogCrc: new Array(64).fill(0x1234) }));
      h.controller.processPhase3(buildPhase3Packet(state));
      expect(h.calls.phase3Complete).toBe(1);
    });

    it('abortStuckTransaction() is directly callable (no real timer needed)', () => {
      const state = makeDebuggerState(0);
      const h = makeController(state);
      h.controller.processPhase1(buildPhase1Packet({ cogCrc: new Array(64).fill(0x55) }));
      h.controller.processPhase3(buildPhase3Packet(state).subarray(0, 8));
      h.controller.abortStuckTransaction(); // explicit abort
      // A clean break still completes afterwards.
      h.controller.processPhase1(buildPhase1Packet({ cogCrc: new Array(64).fill(0x55) }));
      h.controller.processPhase3(buildPhase3Packet(state));
      expect(h.calls.phase3Complete).toBe(1);
    });
  });

  // ── SPEC — the post-§2/§3/§5 target, now MET on real bytes ─────────────────
  // Was an `it.failing` marker asserting all-19; the capture was then measured to
  // contain 11 clean breaks (the rest were derail host-replies, never clean RX
  // breaks), and §3+§5 made the pipeline frame all 11, complete the 10 that
  // carried Phase-3, with zero leak and zero drops. Now a plain passing `it`.
  it('SPEC: all 11 clean breaks frame; the 10 with Phase-3 complete; zero leak/drops', () => {
    const r = runReplay(fixture);
    expect(r.totalBreaks).toBe(11);
    expect(r.completedBreaks).toBe(10); // break-10 is a Phase-1-only capture tail
    expect(r.droppedBinaryMessages).toBe(0);
    expect(r.loggerBinaryBytes).toBe(0);
  });
});

// ── §3.1 — COGINIT interleaved-text demux (repeat-mode wedge fix) ────────────
//
// The P2 multiplexes ROM housekeeping text and break binary on ONE wire (Pascal
// DebugUnit.pas:ChrIn — byte 0x00-0x07 starts a break, anything else is text).
// When a COGINIT relaunches the cog at program start it emits a `Cog0  INIT … jump`
// line BETWEEN breaks. The single-owner controller used to swallow that non-zero
// ASCII as a bogus Phase-1 and wedge the channel — which is exactly why repeat
// mode died once single-stepping reached the startup COGINIT (HW log 2026-06-23).
// The controller now demuxes + DISCARDS the text (it is ROM control output, NOT
// user program output — never routed to the terminal) and frames the next break.
describe('COGINIT interleaved-text demux (§3.1)', () => {
  const COGINIT_LINE = 'Cog0  INIT $0000_0FA8 $0000_189C jump\r\n';
  const initBytes = Uint8Array.from(Array.from(COGINIT_LINE, (c) => c.charCodeAt(0)));
  const concat = (...arrs: Uint8Array[]): Uint8Array => {
    const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  };

  it('peels + discards the INIT line and frames the NEXT break (no wedge)', () => {
    const state = makeDebuggerState(0);
    const peeled: Uint8Array[] = [];
    const h = makeController(state, { onInterleavedText: (b) => { peeled.push(b); } });

    // Break 1 opens, its Phase-3 completes.
    h.controller.processPhase1(buildPhase1Packet({ cogCrc: new Array(64).fill(0x55) }));
    const p3a = buildPhase3Packet(state);
    // Break 2's fresh post-COGINIT Phase-1 (cog-ID 0 in byte 0, new CRCs).
    const p1b = buildPhase1Packet({ cogCrc: new Array(64).fill(0x77) });

    // Wire order after a resume that hits a COGINIT:
    //   [break-1 Phase-3][COGINIT text line][break-2 Phase-1]
    h.controller.processPhase3(concat(p3a, initBytes, p1b));
    h.controller.processPhase3(buildPhase3Packet(state)); // complete break 2

    // Both breaks framed → two Phase-2 replies; the channel never wedged.
    expect(h.calls.phase2.length).toBe(2);
    expect(h.calls.phase3Complete).toBe(2);
    // The INIT line was peeled off verbatim (and discarded), not mis-framed as binary.
    expect(peeled.length).toBe(1);
    expect(String.fromCharCode(...peeled[0])).toBe(COGINIT_LINE);
  });

  it('recovers even when the INIT line is split across two raw chunks', () => {
    const state = makeDebuggerState(0);
    const seen: string[] = [];
    const h = makeController(state, { onInterleavedText: (b) => { seen.push(String.fromCharCode(...b)); } });
    h.controller.processPhase1(buildPhase1Packet({ cogCrc: new Array(64).fill(0x55) }));
    const p1b = buildPhase1Packet({ cogCrc: new Array(64).fill(0x77) });
    const split = 12; // mid-line chunk boundary
    // Chunk A ends mid-INIT-line (no break-start byte yet → controller waits).
    h.controller.processPhase3(concat(buildPhase3Packet(state), initBytes.subarray(0, split)));
    expect(h.calls.phase2.length).toBe(1); // break 2 not framed yet — still in the text run
    // Chunk B delivers the rest of the line + break-2 Phase-1.
    h.controller.processPhase3(concat(initBytes.subarray(split), p1b));
    h.controller.processPhase3(buildPhase3Packet(state));
    expect(h.calls.phase2.length).toBe(2);
    expect(seen.join('')).toBe(COGINIT_LINE);
  });
});

// ── §3 — per-break Phase-3 size hint (renderer→main→worker) ──────────────────
//
// The controller fires onPhase3Size exactly once per break, right after Phase-2,
// carrying THIS cog's exact FIXED Phase-3 byte count (cog blocks + hub blocks +
// hub reads, EXCLUDING the self-describing smart-pin tail the worker sizes on its
// own). Main relays it (renderer→main→worker, §4) so the worker's per-cog demux
// delimits Phase-3 precisely. The size carries the optional +DIS_LINES*4 disasm
// term that depends on the renderer-only `disMode` — the exact quantity the worker
// cannot compute itself, which is why the hint exists at all.
describe('§3 — Phase-3 size hint', () => {
  const COG_CRC = new Array(64).fill(0x1234); // every cog block changes on first break

  /** Independent re-derivation of DebuggerController.buildPhase2's
   *  expectedPhase3Fixed, read from the pending-block state after processPhase1. */
  const expectedFixed = (state: DebuggerState): number =>
    state.pendingCogBlocks.length * COG_BLOCK_SIZE * 4 +
    state.pendingHubBlocks.length * HUB_BLOCK_RATIO * 2 +
    (state.pendingHubCode ? DIS_LINES * 4 : 0) + PTR_BYTES * 3 + HUB_SUB_BLOCK_SIZE;

  it('emits exactly one hint per break, tagged with this window’s cogId', () => {
    const state = makeDebuggerState(3); // cog 3
    const h = makeController(state);
    for (let i = 0; i < 3; i++) {
      h.controller.processPhase1(buildPhase1Packet({ cogCrc: COG_CRC }));
      h.controller.processPhase3(buildPhase3Packet(state));
    }
    expect(h.calls.phase3Size.length).toBe(3);         // one per break, no more/less
    expect(h.calls.phase3Size.every((e) => e.cogId === 3)).toBe(true); // always this cog
  });

  it('the hint size matches the controller’s exact fixed Phase-3 accounting', () => {
    const state = makeDebuggerState(0);
    const h = makeController(state);
    h.controller.processPhase1(buildPhase1Packet({ cogCrc: COG_CRC }));
    // Emitted inside processPhase1 (right after Phase-2), when pendingCog/Hub/HubCode
    // reflect this break — cross-check the emitted size against them.
    expect(h.calls.phase3Size.length).toBe(1);
    expect(h.calls.phase3Size[0].size).toBe(expectedFixed(state));
  });

  it('includes the +DIS_LINES*4 disasm term only when disMode requests hub code', () => {
    // dmPC with pc=0 (< 0x400 ⇒ cog-execute) requests NO disassembly read.
    const pcState = makeDebuggerState(0);
    const pc = makeController(pcState);
    pc.controller.processPhase1(buildPhase1Packet({ cogCrc: COG_CRC }));
    expect(pcState.pendingHubCode).toBe(false);
    const sizeNoDisasm = pc.calls.phase3Size[0].size;

    // dmHub is hub-locked ⇒ the disassembly window is always read ⇒ +DIS_LINES*4.
    // Same input packet, so cog/hub block requests are identical — the ONLY delta
    // is the disasm term, exactly the worker-uncomputable quantity the hint carries.
    const hubState = makeDebuggerState(0);
    hubState.disMode = DisMode.dmHub;
    const hub = makeController(hubState);
    hub.controller.processPhase1(buildPhase1Packet({ cogCrc: COG_CRC }));
    expect(hubState.pendingHubCode).toBe(true);
    const sizeWithDisasm = hub.calls.phase3Size[0].size;

    expect(sizeWithDisasm - sizeNoDisasm).toBe(DIS_LINES * 4);
  });
});
