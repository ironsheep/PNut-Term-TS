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
 * The suite has two tiers:
 *   • GREEN now — fixture integrity, structural invariants, byte-exact Phase-2,
 *     and the CURRENT broken-baseline symptoms (S1/S2 incomplete breaks, S3
 *     logger leak, F7 drops). Later sections FLIP their own symptom line:
 *       §2 → `loggerBinaryBytes === 0`   (kill the wiretap leak)
 *       §3 → all framed breaks complete with exact accounting
 *       §4 → `droppedBinaryMessages === 0` (no hard drops)
 *   • `it.failing` SPEC — the post-fix target (all 19 breaks complete, zero
 *     leak, zero drops). It is GREEN while the target is unmet and turns RED the
 *     moment §2–§4 satisfy it, which is the signal to convert it to a plain `it`.
 *
 * Fidelity note: this single-threaded, discrete-pump harness reproduces the S3
 * leak and F7 drops deterministically, but it under-detects break FRAMING (it
 * sees ~10 of the 19 Phase-1 frames) because the hardware derail is partly a
 * continuous-thread race the harness cannot reproduce exactly. The companion
 * `debug_260622-142138.log` records 19 `PHASE1 ok` / 10 `complete=true`. The
 * deterministic, faithful oracle signals are the leak, the drops, and "every
 * framed break completes with exact byte accounting" — §3's single-owner
 * transaction is expected to make framing detect all 19.
 */

import { loadCaptureFixture, runReplay } from './shared/debuggerReplay';

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
    it('frames every break as a 416-byte Phase-1 + 52-byte Phase-2', () => {
      expect(base.breaks.length).toBeGreaterThan(0);
      for (const b of base.breaks) {
        expect(b.phase1Length).toBe(416);
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

  // ── Current broken baseline — each later section flips its own line ────────
  describe('current (broken) behavior — reproduces the documented symptoms', () => {
    const r = base;

    it('S1/S2: not all breaks complete (Phase-3 desync)', () => {
      // §3/§4 target: every framed break completes. Flip to
      // `expect(r.completedBreaks).toBe(r.totalBreaks)` once that holds.
      expect(r.completedBreaks).toBeLessThan(fixture.phase2Sends.length);
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

    it('F7: out-of-window Phase-3 chunks are hard-dropped', () => {
      // §4 target: flip to `expect(r.droppedBinaryMessages).toBe(0)`.
      expect(r.droppedBinaryMessages).toBeGreaterThan(0);
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
      expect(tiny.breaks[0].phase1Length).toBe(416);
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

  // ── SPEC target — fails on current code by design (encodes the goal) ───────
  // `it.failing` is GREEN while the body throws (target unmet) and turns RED the
  // moment §2–§4 make it pass — the signal to convert this to a plain `it`.
  it.failing('SPEC: all 19 breaks complete with zero leak and zero drops', () => {
    const r = runReplay(fixture);
    expect(r.totalBreaks).toBe(19);
    expect(r.completedBreaks).toBe(19);
    expect(r.droppedBinaryMessages).toBe(0);
    expect(r.loggerBinaryBytes).toBe(0);
  });
});
