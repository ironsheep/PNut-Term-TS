/** @format */

/**
 * Tests for the four §2 interaction-parity behaviors added to the debugger
 * bundle's DebuggerInteraction, built on the §5a fixture (#3).
 */

import { makeInteraction, makeDebuggerState, MSG } from './shared/debuggerFixture';
import { STALL_CMD, CHAR_WIDTH_PX, HALF_ROW_PX, PTR_CENTER } from '../src/classes/debugger/shared/constants';
import { DisMode } from '../src/classes/debugger/renderer/DebuggerState';

describe('DebuggerInteraction §2 parity gaps (#7)', () => {
  it('(1) Go while running (dimmed) requests COGBRK for this cog, not a step', () => {
    const h = makeInteraction(makeDebuggerState(5)); // cogId 5
    h.state.isDimmed = true;        // not halted at a breakpoint → free-running
    h.state.repeatMode = false;
    (h.interaction as any).onGoLeftClick();          // Space / left-click Go
    expect(h.cogBrkRequests).toEqual([1 << 5]);
    expect(h.state.stallBrk).toBe(STALL_CMD);
    expect(h.state.repeatMode).toBe(false);
  });

  it('(1) Go while halted does NOT request COGBRK (normal single-step)', () => {
    const h = makeInteraction(makeDebuggerState(5));
    h.state.isDimmed = false;       // halted at a breakpoint
    (h.interaction as any).onGoLeftClick();
    expect(h.cogBrkRequests).toEqual([]);
    // repeat-mode Go (right-click) while running also requests COGBRK
    h.state.isDimmed = true;
    (h.interaction as any).onGoRightClick();
    expect(h.cogBrkRequests).toEqual([1 << 5]);
  });

  it('(2) wheel over the hub-address digits adjusts the nibble under the cursor', () => {
    const h = makeInteraction();
    h.renderer.panelBoundsPx.mockImplementation((name: string) =>
      name === 'HUB' ? { x: 100, y: 100, w: 300, h: 100 } : { x: -10, y: -10, w: 0, h: 0 });
    h.state.hubAddr = 0x00000;
    // col 0 (most-significant nibble) → ±0x10000 per wheel notch
    (h.interaction as any).handleWheel(100 + 0 * CHAR_WIDTH_PX, 110, +1, false, false);
    expect(h.state.hubAddr).toBe(0x10000);
    // col 4 (least-significant nibble) → ±1
    h.state.hubAddr = 0x10000;
    (h.interaction as any).handleWheel(100 + 4 * CHAR_WIDTH_PX, 110, +1, false, false);
    expect(h.state.hubAddr).toBe(0x10001);
    // negative direction wraps within 20-bit mask
    h.state.hubAddr = 0x00000;
    (h.interaction as any).handleWheel(100 + 4 * CHAR_WIDTH_PX, 110, -1, false, false);
    expect(h.state.hubAddr).toBe(0xFFFFF);
  });

  it('(3) pointer data/chr click navigates to that byte, centered on PTR_CENTER', () => {
    const h = makeInteraction();
    h.state.message[MSG.FPTR] = 0x01000;  // row 0 pointer address
    // Click first data byte (col 11) of row 0
    (h.interaction as any).onPointerClick(11 * CHAR_WIDTH_PX, 0 * (2 * HALF_ROW_PX));
    expect(h.state.disMode).toBe(DisMode.dmHub);
    expect(h.state.hubAddr).toBe((0x01000 - PTR_CENTER + 0) & 0xFFFFF);
    // Click the 3rd data byte (byteIdx 2 → col 11 + 2*3 = 17)
    (h.interaction as any).onPointerClick(17 * CHAR_WIDTH_PX, 0);
    expect(h.state.hubAddr).toBe((0x01000 - PTR_CENTER + 2) & 0xFFFFF);
    // Click the address column (col 5) → navigate to the pointer itself
    (h.interaction as any).onPointerClick(5 * CHAR_WIDTH_PX, 0);
    expect(h.state.hubAddr).toBe(0x01000);
  });

  it('(4) Tab is swallowed (preventDefault) so focus cannot move', () => {
    makeInteraction();
    const ev = new KeyboardEvent('keydown', { code: 'Tab', cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
