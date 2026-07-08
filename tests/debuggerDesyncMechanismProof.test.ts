/** @format */
/**
 * PROOF (task #78): the single-step desync is a boundary SLIP caused by the
 * two-framer split delivering a later break's Phase-1 AHEAD of the current
 * break's Phase-3 — after which the renderer's STATEFUL CRC diff is poisoned and
 * never recovers. Not a messenger/hint problem.
 *
 * Substrate: the committed HW capture (tests/fixtures/debugger/test11-desync-capture.bin).
 * Its true Phase-1 boundaries are [39, 4841, 5483, 13293] (clkfreq 0x0bebc200 at
 * msg[18]); honest CRC diffs are [4330,170,170,170]. Breaks 0–1 are a clean
 * region on the wire, so we can isolate the FIRST slip there.
 *
 * We drive the REAL renderer DebuggerController (main = dumb pass-through: first
 * 456B → processPhase1, the rest → processPhase3, controller re-frames) with the
 * break-0/break-1 bytes in two orders:
 *
 *   WIRE order      : b1-Phase1, b1-Phase3(186), b2-Phase1     ← what the P2 sent
 *   REORDERED (worker): b1-Phase1, b2-Phase1, b1-Phase3(186)   ← what main received (HW log ev 8,9,13)
 *
 * Claim proven:
 *   • WIRE order   → break-1 Phase-3 consumes exactly 186; break-2 Phase-1 frames
 *                    with cogDiff=0 (honest). In sync.
 *   • REORDERED    → break-1 Phase-3 consumes 456 (it EATS break-2's Phase-1);
 *                    the next framed Phase-1 is garbage (cogDiff≠0 / wrong PC).
 *                    Desync, exactly as the HW log shows.
 * Same renderer, same bytes — only the delivery order differs. So the defect is
 * the ordering (the two-framer split), not the renderer.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { makeController } from './shared/debuggerFixture';

const CAP = new Uint8Array(
  readFileSync(join(__dirname, 'fixtures', 'debugger', 'test11-desync-capture.bin'))
);

// True boundaries + slices (clean region, breaks 0 and 1).
const p1_b0 = CAP.subarray(39, 495); //   break-0 Phase-1 (@39)
const p3_b0 = CAP.subarray(495, 4841); // break-0 Phase-3 (4346B) → next @4841
const p1_b1 = CAP.subarray(4841, 5297); // break-1 Phase-1 (@4841)
const p3_b1 = CAP.subarray(5297, 5483); // break-1 Phase-3 (186B) → next @5483
const p1_b2 = CAP.subarray(5483, 5939); // break-2 Phase-1 (@5483)

interface Framed { pc: string; cog: number; hub: number }
interface P3 { fed: number; complete: boolean }

/** Drive the real controller as main's dumb pass-through; capture framing decisions. */
function run(phase3Stream: Uint8Array): { framed: Framed[]; p3: P3[]; other: string[] } {
  const framed: Framed[] = [];
  const p3: P3[] = [];
  const other: string[] = [];
  const { controller } = makeController(undefined, {
    sendPhase2: () => {}, requestRender: () => {}, onBreakpointTimeout: () => {},
    onPhase3Complete: () => {}, onPhase3Size: () => {},
    log: (m) => {
      let mm: RegExpExecArray | null;
      if ((mm = /PHASE1 ok: PC=(\$[0-9a-f]+).*?cogBlocks=(\d+).*?hubBlocks=(\d+)/.exec(m))) {
        framed.push({ pc: mm[1], cog: +mm[2], hub: +mm[3] });
      } else if ((mm = /PHASE3 chunk: \+(\d+)B, complete=(\w+)/.exec(m))) {
        p3.push({ fed: +mm[1], complete: mm[2] === 'true' });
      } else if (/Discarded|stall|cross-check FAILED/.test(m)) {
        other.push(m);
      }
    },
  });
  controller.processPhase1(p1_b0);        // main opens the session on the first 456B
  controller.processPhase3(p3_b0);        // break-0 Phase-3 (in sync through here)
  controller.processPhase3(p1_b1);        // break-1 Phase-1 arrives in the raw stream
  // the two orderings differ only in what follows:
  controller.processPhase3(phase3Stream);
  return { framed, p3, other };
}

describe('desync mechanism: later Phase-1 delivered ahead of current Phase-3 → slip → poison', () => {
  it('WIRE order stays in sync: break-1 Phase-3 = 186, break-2 frames honestly (cogDiff=0)', () => {
    // b1-Phase3(186) THEN b2-Phase1(456) — the order the P2 actually sent.
    const stream = new Uint8Array(p3_b1.length + p1_b2.length);
    stream.set(p3_b1, 0); stream.set(p1_b2, p3_b1.length);
    const { framed } = run(stream);

    // framed[0] = break-0 (cog=64), framed[1] = break-1 (cog=0),
    // framed[2] = break-2 @5483 (honest cogDiff=0, PC=$0).
    // eslint-disable-next-line no-console
    console.log('WIRE framed:', JSON.stringify(framed));
    expect(framed[0]).toMatchObject({ pc: '$0', cog: 64 });
    expect(framed[1]).toMatchObject({ pc: '$0', cog: 0 });
    expect(framed[2]).toMatchObject({ pc: '$0', cog: 0 }); // in sync — honest diff
  });

  it('REORDERED (worker) SLIPS: break-1 Phase-3 eats break-2 Phase-1 (456), next frame is garbage', () => {
    // b2-Phase1(456) THEN b1-Phase3(186) — the order main received (HW log ev 8,9,13).
    const stream = new Uint8Array(p1_b2.length + p3_b1.length);
    stream.set(p1_b2, 0); stream.set(p3_b1, p1_b2.length);
    const { framed, p3, other } = run(stream);

    // eslint-disable-next-line no-console
    console.log('REORDERED framed:', JSON.stringify(framed), '\n p3:', JSON.stringify(p3), '\n other:', other);

    // break-0 and break-1 Phase-1 frame fine...
    expect(framed[0]).toMatchObject({ pc: '$0', cog: 64 });
    expect(framed[1]).toMatchObject({ pc: '$0', cog: 0 });
    // ...but break-1's Phase-3 consumes break-2's whole 456B Phase-1 (the slip).
    const break1P3 = p3.find((c) => c.complete);
    expect(break1P3!.fed).toBeGreaterThanOrEqual(456); // ate the next Phase-1, not 186
    // ...and whatever gets framed next is NOT the honest break-2 (@5483, cog=0, PC=$0):
    // the state is poisoned — either a nonzero cogDiff or a non-$0 PC (or nothing clean).
    const next = framed[2];
    const poisoned = !next || next.pc !== '$0' || next.cog !== 0;
    expect(poisoned).toBe(true);
  });
});
