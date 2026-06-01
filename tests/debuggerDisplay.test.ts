/** @format */

/**
 * Tests for the two §3 display-parity behaviors added to the debugger bundle
 * (#8), built on the §5a fixture (#3):
 *   (1) disassembly SKIP strikethrough  — shouldStrikeSkipped (DebuggerRenderer)
 *   (2) hub heat-map graded decay        — nextHubHeat (DebuggerController) +
 *       the end-to-end Phase-3 sub-block capture / flash / decay chain.
 *
 * These exercise the pure state→draw-decision functions directly (no canvas),
 * plus the controller/parser wiring that feeds them.
 */

import {
  makeController,
  makeDebuggerState,
  buildPhase1Packet,
  buildPhase3Packet,
  MSG
} from './shared/debuggerFixture';
import { shouldStrikeSkipped } from '../src/classes/debugger/renderer/DebuggerRenderer';
import { nextHubHeat } from '../src/classes/debugger/renderer/DebuggerController';
import { HIT_DECAY_RATE, HUB_BLOCK_RATIO } from '../src/classes/debugger/shared/constants';

describe('§3 SKIP strikethrough — shouldStrikeSkipped (#8)', () => {
  // PC at cog address 0x010; SKIP pattern with bits 0, 2, 31 set.
  const PC = 0x010;
  const pattern = (1 << 0) | (1 << 2) | (1 << 31);

  it('strikes the instruction at the PC when its SKIP bit (0) is set', () => {
    expect(shouldStrikeSkipped(PC, PC, true, pattern, false)).toBe(true);
  });

  it('strikes a later instruction whose SKIP bit (2) is set', () => {
    expect(shouldStrikeSkipped(PC + 2, PC, true, pattern, false)).toBe(true);
  });

  it('does NOT strike an instruction whose SKIP bit (1) is clear', () => {
    expect(shouldStrikeSkipped(PC + 1, PC, true, pattern, false)).toBe(false);
  });

  it('does NOT strike when SKIP is not in effect (skipOn=false)', () => {
    expect(shouldStrikeSkipped(PC, PC, false, pattern, false)).toBe(false);
  });

  it('does NOT strike a hidden-PC (cog address shown in hub mode)', () => {
    expect(shouldStrikeSkipped(PC, PC, true, pattern, true)).toBe(false);
  });

  it('does NOT strike instructions before the PC (offset < 0)', () => {
    expect(shouldStrikeSkipped(PC - 1, PC, true, pattern, false)).toBe(false);
  });

  it('does NOT strike beyond the 32-bit window (offset > 31)', () => {
    // bit 31 IS set, but offset 32 is out of range.
    expect(shouldStrikeSkipped(PC + 32, PC, true, pattern, false)).toBe(false);
    // offset 31 (bit 31 set) is the last in-range line.
    expect(shouldStrikeSkipped(PC + 31, PC, true, pattern, false)).toBe(true);
  });

  it('uses long-stride (÷4) offsets for hub addresses', () => {
    const hubPc = 0x800;
    const p = (1 << 0) | (1 << 3); // bits 0 and 3 set
    expect(shouldStrikeSkipped(hubPc, hubPc, true, p, false)).toBe(true);        // offset 0
    expect(shouldStrikeSkipped(hubPc + 12, hubPc, true, p, false)).toBe(true);   // 12/4 = 3
    expect(shouldStrikeSkipped(hubPc + 4, hubPc, true, p, false)).toBe(false);   // 4/4 = 1, clear
  });
});

describe('§6.18 hub heat — nextHubHeat decision (#8)', () => {
  it('resolves the 255 sentinel to 0 (no flash on first ever paint)', () => {
    expect(nextHubHeat(0x1234, 0x1234, 255, HIT_DECAY_RATE)).toBe(0);
  });

  it('flashes to 254 when the sub-block checksum changed', () => {
    expect(nextHubHeat(0x9999, 0x1111, 0, HIT_DECAY_RATE)).toBe(254);
  });

  it('decays by HIT_DECAY_RATE when unchanged', () => {
    expect(nextHubHeat(0x1111, 0x1111, 254, HIT_DECAY_RATE)).toBe(254 - HIT_DECAY_RATE);
  });

  it('clamps decay at 0 (never goes negative)', () => {
    expect(nextHubHeat(0x1111, 0x1111, 1, HIT_DECAY_RATE)).toBe(0);
    expect(nextHubHeat(0x1111, 0x1111, 0, HIT_DECAY_RATE)).toBe(0);
  });
});

describe('§6.18 hub heat — end-to-end Phase-3 capture + flash/decay (#8)', () => {
  // Drive a full Phase-1 → Phase-3 exchange where hub block 0 changes, then
  // verify the sub-block checksums are captured and the heat state machine
  // flashes on a real change and decays when nothing changes.
  function step(h: ReturnType<typeof makeController>, hubBlock0Sum: number, subWord: number): void {
    const p1 = buildPhase1Packet({
      longs: { [MSG.COND]: 0 },
      hubSum: [hubBlock0Sum] // only block 0 carries a (changing) checksum
    });
    h.controller.processPhase1(p1);
    const p3 = buildPhase3Packet(h.state, {
      hubSubWord: (blockIdx) => (blockIdx === 0 ? subWord : 0)
    });
    h.controller.processPhase3(p3);
  }

  it('captures the 32 sub-block checksums of a changed hub block', () => {
    const h = makeController();
    step(h, 0x1111, 0xABCD);
    for (let j = 0; j < HUB_BLOCK_RATIO; j++) {
      expect(h.state.hubSubBlock[j]).toBe(0xABCD);
    }
    // First receipt: old synced to current, so no flash (heat stays 0).
    expect(h.state.hubSubBlockHit[0]).toBe(0);
  });

  it('flashes a sub-block to 254 when its checksum changes on a later break', () => {
    const h = makeController();
    step(h, 0x1111, 0xABCD);            // round 1: first receipt, heat 0
    step(h, 0x2222, 0x9999);            // round 2: block 0 changes, sub-word differs
    expect(h.state.hubSubBlock[0]).toBe(0x9999);
    expect(h.state.hubSubBlockHit[0]).toBe(254);
  });

  it('decays an unrequested sub-block toward 0 over successive breaks', () => {
    const h = makeController();
    step(h, 0x1111, 0xABCD);            // round 1
    step(h, 0x2222, 0x9999);            // round 2 → heat 254
    // Round 3: block 0 unchanged (same checksum) → not re-requested → decay.
    const p1 = buildPhase1Packet({ longs: { [MSG.COND]: 0 }, hubSum: [0x2222] });
    h.controller.processPhase1(p1);
    h.controller.processPhase3(buildPhase3Packet(h.state));
    expect(h.state.hubSubBlockHit[0]).toBe(254 - HIT_DECAY_RATE);
  });
});
