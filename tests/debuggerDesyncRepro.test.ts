/** @format */

/**
 * Worker Phase-3 behaviour on the REAL test11 desync capture (Path 1, task #78).
 *
 * Drives the corrected test11 RX capture (tests/fixtures/debugger/test11-desync-capture.bin,
 * RECV-only, Sent blocks excluded) through the REAL ExtractionCore worker. Under
 * Path 1 the worker is a pure DISPATCHER: it frames each break's Phase-1 and then
 * STREAMS that cog's Phase-3 bytes verbatim until the controller relays
 * break-complete (`done`). It never delimits Phase-3 by a size hint and never
 * re-scans Phase-3 for a Phase-1 header — which is exactly what makes the $14201
 * desync impossible (an all-zero hub-dump run in real Phase-3 can never be
 * manufactured into a spurious Phase-1).
 *
 * Two complementary checks on the SAME real bytes:
 *   1. Break-atomic drive (models the P2 lockstep + controller relay): feeding each
 *      break then relaying `done` frames every real Phase-1 and streams each
 *      break's exact Phase-3 (fixed + smart-pin tail).
 *   2. Continuous drive with NO `done`: the worker frames exactly ONE Phase-1 and
 *      streams the entire remainder as raw Phase-3 — proving it never fabricates a
 *      spurious Phase-1 from the many all-zero runs in real hub dumps (the desync).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { makeWorkerHarness, type Emission } from './shared/debuggerMultiCog';

// Real Phase-1 boundaries in the capture (clkfreq signature at Phase-1 msg[18]);
// each break's true Phase-3 length is next-P1 − this-P1 − 456. The banner precedes
// the first Phase-1 (bytes 0..38). Break #3's Phase-3 is truncated (session ended).
const P1_OFFSETS = [39, 4841, 5483, 13293];

function loadCapture(): { bytes: Uint8Array; chunkLengths: number[] } {
  const dir = join(__dirname, 'fixtures', 'debugger');
  const bytes = new Uint8Array(readFileSync(join(dir, 'test11-desync-capture.bin')));
  const manifest = JSON.parse(readFileSync(join(dir, 'test11-desync-manifest.json'), 'utf8'));
  return { bytes, chunkLengths: manifest.chunkLengths };
}

describe('worker Phase-3 behaviour on the real test11 capture (Path 1)', () => {
  it('frames every break and streams each break\'s exact Phase-3 when driven break-atomically', () => {
    const { bytes } = loadCapture();
    const h = makeWorkerHarness();

    // The exact Phase-3 length of each COMPLETE break (next P1 − this P1 − 456).
    const expectedP3 = [
      P1_OFFSETS[1] - P1_OFFSETS[0] - 456, // break0
      P1_OFFSETS[2] - P1_OFFSETS[1] - 456, // break1
      P1_OFFSETS[3] - P1_OFFSETS[2] - 456 // break2
    ];

    let breakIdx = 0;
    const p1Emits: Emission[] = [];
    const p3TotalPerBreak = [0, 0, 0, 0];
    const account = (ems: Emission[]): void => {
      for (const e of ems) {
        if (e.kind === 'p1') {
          p1Emits.push(e);
          breakIdx++;
        } else if (e.kind === 'p3') {
          const idx = breakIdx - 1; // p3 belongs to the most recently framed break
          if (idx >= 0 && idx < p3TotalPerBreak.length) p3TotalPerBreak[idx] += e.bytes.length;
        }
      }
    };
    const pumpAll = (): void => {
      for (let i = 0; i < 32; i++) {
        const em = h.pump();
        account(em);
        if (em.length === 0) break;
      }
    };

    // Feed each break atomically (banner+P1+P3 up to the next P1), then relay the
    // controller's break-complete so the worker returns to awaitingPhase1. This is
    // the P2 lockstep gap: a next break's bytes never share the wire with this
    // break's Phase-3.
    const segments = [0, ...P1_OFFSETS.slice(1), bytes.length];
    for (let i = 0; i < segments.length - 1; i++) {
      h.advance(1);
      h.feed(bytes.subarray(segments[i], segments[i + 1]));
      pumpAll();
      h.done(0); // controller break-complete (cog 0, single-cog test11)
    }
    h.advance(200);
    pumpAll();

    // The three complete breaks each stream to their exact Phase-3 length.
    for (let i = 0; i < 3; i++) {
      expect(p3TotalPerBreak[i]).toBe(expectedP3[i]);
    }
    // Every framed Phase-1 is cog 0 (single-cog test11); at least the 3 complete
    // breaks (the 4th, truncated, may or may not frame its Phase-1).
    expect(p1Emits.length).toBeGreaterThanOrEqual(3);
    expect(p1Emits.every((e) => e.cog === 0)).toBe(true);
  });

  it('never fabricates a spurious Phase-1 from real hub-dump zero runs (continuous, no break-complete)', () => {
    // The desync-proof on REAL bytes: fed continuously with NO break-complete
    // relay, the worker frames exactly ONE Phase-1 (the first) and streams the
    // entire remainder — including three more real Phase-1 packets AND the many
    // all-zero hub-dump runs that used to be mis-framed as $14201 Phase-1s — as
    // raw Phase-3. Exactly one Phase-1 ⇒ zero spurious fabrications.
    const { bytes, chunkLengths } = loadCapture();
    const h = makeWorkerHarness();

    let p1Count = 0;
    let p3Bytes = 0;
    const account = (ems: Emission[]): void => {
      for (const e of ems) {
        if (e.kind === 'p1') p1Count++;
        else if (e.kind === 'p3') p3Bytes += e.bytes.length;
      }
    };

    let off = 0;
    for (const len of chunkLengths) {
      h.advance(1);
      h.feed(bytes.subarray(off, off + len));
      off += len;
      account(h.pump());
    }
    h.advance(200);
    for (let i = 0; i < 8; i++) account(h.pump());

    expect(p1Count).toBe(1); // the first break only; NO spurious Phase-1s
    // Everything after the first Phase-1 streamed as raw Phase-3 (the controller
    // would frame the later breaks out of it).
    expect(p3Bytes).toBe(bytes.length - P1_OFFSETS[0] - 456);
  });
});
