/** @format */

/**
 * Worker Phase-3 framing check against GROUND TRUTH (multi-cog desync, task #78).
 *
 * Drives the corrected test11 RX capture (tests/fixtures/debugger/test11-desync-capture.bin,
 * RECV-only, Sent blocks excluded) through the REAL ExtractionCore worker and feeds
 * the per-break size hint from the CAPTURED Phase-2 requests (the ground-truth
 * `fixed` the HW debugger actually sent: 4330, 170, 7338, 12266). It asserts the
 * worker delimits each Phase-3 to the exact boundary where the next Phase-1 begins
 * (proven independently via the clkfreq signature at Phase-1 msg[18]).
 *
 * This isolates the WORKER delimiter from the renderer controller: if the worker
 * frames every break to the right boundary here, the desync is elsewhere (async
 * hint relay / controller); if it misframes, the bug is in the worker.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { makeWorkerHarness, type Emission } from './shared/debuggerMultiCog';

// Ground-truth per-break fixed sizes, decoded from the 4 captured Phase-2 sends
// (== the HW debug log's fixed=4330/170/7338/12266). Break #3's Phase-3 is not in
// the capture (session ended), so we exercise the first three complete breaks.
const GROUND_TRUTH_FIXED = [4330, 170, 7338, 12266];
// Real Phase-1 boundaries (clkfreq signature) → each break's true Phase-3 length.
const P1_OFFSETS = [39, 4841, 5483, 13293];

function loadCapture(): { bytes: Uint8Array; chunkLengths: number[] } {
  const dir = join(__dirname, 'fixtures', 'debugger');
  const bytes = new Uint8Array(readFileSync(join(dir, 'test11-desync-capture.bin')));
  const manifest = JSON.parse(readFileSync(join(dir, 'test11-desync-manifest.json'), 'utf8'));
  return { bytes, chunkLengths: manifest.chunkLengths };
}

describe('worker Phase-3 framing vs ground truth (test11 clean capture)', () => {
  it('delimits each break to the exact next-Phase-1 boundary when fed the captured sizes', () => {
    const { bytes, chunkLengths } = loadCapture();
    const h = makeWorkerHarness();

    // Expected complete-break Phase-3 lengths (next P1 - this P1 - 456).
    const expectedP3 = [
      P1_OFFSETS[1] - P1_OFFSETS[0] - 456, // break0
      P1_OFFSETS[2] - P1_OFFSETS[1] - 456, // break1
      P1_OFFSETS[3] - P1_OFFSETS[2] - 456 // break2
    ];

    let breakIdx = 0;
    const p1Emits: Emission[] = [];
    const p3TotalPerBreak: number[] = [0, 0, 0, 0];

    const relayHintsAndAccount = (ems: Emission[]): void => {
      for (const e of ems) {
        if (e.kind === 'p1') {
          p1Emits.push(e);
          // Relay the ground-truth size hint for THIS break, exactly as the
          // controller would (renderer→main→worker), so the worker can delimit.
          const fixed = GROUND_TRUTH_FIXED[breakIdx];
          if (fixed !== undefined) h.hint(e.cog, fixed);
          breakIdx++;
        } else if (e.kind === 'p3') {
          const idx = breakIdx - 1; // p3 belongs to the most recently framed break
          if (idx >= 0 && idx < p3TotalPerBreak.length) p3TotalPerBreak[idx] += e.bytes.length;
        }
      }
    };

    let off = 0;
    for (const len of chunkLengths) {
      h.advance(1);
      h.feed(bytes.subarray(off, off + len));
      off += len;
      relayHintsAndAccount(h.pump());
    }
    h.advance(200);
    relayHintsAndAccount(h.pump());

    // eslint-disable-next-line no-console
    console.log('p1 count:', p1Emits.length, 'PCs(cog):', p1Emits.map((e) => e.cog));
    // eslint-disable-next-line no-console
    console.log('per-break Phase-3 delivered:', p3TotalPerBreak, 'expected:', expectedP3);

    // The three complete breaks must each frame to their exact boundary.
    for (let i = 0; i < 3; i++) {
      expect(p3TotalPerBreak[i]).toBe(expectedP3[i]);
    }
    // All framed Phase-1s are cog 0 (single-cog test11).
    expect(p1Emits.every((e) => e.cog === 0)).toBe(true);
  });

  it('still frames correctly when hints arrive EARLY (async relay race — queue, not drop)', () => {
    // Reproduces the production failure mode: the renderer→main→worker hint relay
    // delivers a break's size hint before the worker has framed that break's
    // Phase-1 (or while it is still draining the previous break). The old
    // single-slot code DROPPED those → stall/resync → misframe ($14201). The
    // per-cog hint QUEUE must keep them and delimit every break correctly.
    const { bytes, chunkLengths } = loadCapture();
    const h = makeWorkerHarness();

    // Relay ALL hints up front, before a single byte is fed — the worst-case
    // early arrival (debugPhase3Cog is still null for every one of them).
    for (const fixed of GROUND_TRUTH_FIXED) h.hint(0, fixed);

    const expectedP3 = [
      P1_OFFSETS[1] - P1_OFFSETS[0] - 456,
      P1_OFFSETS[2] - P1_OFFSETS[1] - 456,
      P1_OFFSETS[3] - P1_OFFSETS[2] - 456
    ];
    let breakIdx = 0;
    const p3TotalPerBreak = [0, 0, 0, 0];
    const account = (ems: Emission[]): void => {
      for (const e of ems) {
        if (e.kind === 'p1') breakIdx++;
        else if (e.kind === 'p3') {
          const idx = breakIdx - 1;
          if (idx >= 0 && idx < p3TotalPerBreak.length) p3TotalPerBreak[idx] += e.bytes.length;
        }
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
    account(h.pump());

    // eslint-disable-next-line no-console
    console.log('EARLY-relay per-break Phase-3:', p3TotalPerBreak, 'expected:', expectedP3);
    for (let i = 0; i < 3; i++) expect(p3TotalPerBreak[i]).toBe(expectedP3[i]);
  });
});
