/** @format */

/**
 * Smoke test for the shared debugger fixture (§5a). Proves the fixture builds
 * a byte-accurate Phase-1 packet the bundle's controller accepts, and that the
 * interaction harness constructs cleanly. The §2/§3 tests (#7/#8) build on these.
 */

import {
  makeDebuggerState,
  makeController,
  buildPhase1Packet,
  makeInteraction,
  MSG
} from './shared/debuggerFixture';
import { PHASE1_SIZE } from '../src/classes/debugger/shared/constants';

describe('debugger test fixture (§5a)', () => {
  it('makeDebuggerState seeds CRC-old to 0xFFFF so first break triggers every block', () => {
    const state = makeDebuggerState(3);
    expect(state.cogId).toBe(3);
    expect(state.firstBreak).toBe(true);
    expect(Array.from(state.cogCrcOld).every((w) => w === 0xffff)).toBe(true);
    expect(Array.from(state.hubSumOld).every((w) => w === 0xffff)).toBe(true);
  });

  it('buildPhase1Packet produces a PHASE1_SIZE packet the controller parses', () => {
    const { controller, state, calls } = makeController(makeDebuggerState(2));
    const pkt = buildPhase1Packet({
      longs: { [MSG.COGN]: 2, [MSG.IRET]: 0x000abcde, [MSG.COND]: 0x00001234 }
    });
    expect(pkt.length).toBe(PHASE1_SIZE);

    controller.processPhase1(pkt);

    // 20-long message parsed little-endian into state.message
    expect(state.message[MSG.COGN]).toBe(2);
    expect(state.message[MSG.IRET]).toBe(0x000abcde);
    // First break seeds breakValue from mCOND and clears firstBreak
    expect(state.firstBreak).toBe(false);
    expect(state.breakValue).toBe(0x00001234);
    // Controller built + sent a Phase-2 reply and asked for a repaint
    expect(calls.phase2.length).toBe(1);
    expect(calls.render).toBe(1);
  });

  it('CRC / hub-sum words land at the right offsets (old←current shift on parse)', () => {
    const { controller, state } = makeController();
    controller.processPhase1(buildPhase1Packet({ cogCrc: [0x1111, 0x2222], hubSum: [0x3333] }));
    expect(state.cogCrc[0]).toBe(0x1111);
    expect(state.cogCrc[1]).toBe(0x2222);
    expect(state.hubSum[0]).toBe(0x3333);
  });

  it('makeInteraction constructs a DebuggerInteraction over the mock canvas/renderer', () => {
    const h = makeInteraction(makeDebuggerState(1));
    expect(h.interaction).toBeDefined();
    expect(h.cogBrkRequests).toEqual([]);
    expect(h.canvas.addEventListener).toHaveBeenCalled(); // listeners installed
  });
});
