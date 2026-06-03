/** @format */

/**
 * Tests for the four §2 interaction-parity behaviors added to the debugger
 * bundle's DebuggerInteraction, built on the §5a fixture (#3).
 */

import { makeInteraction, makeDebuggerState, MSG } from './shared/debuggerFixture';
import {
  STALL_CMD, CHAR_WIDTH_PX, HALF_ROW_PX, PTR_CENTER,
  HUB_MAP_WIDTH, HUB_MAP_HEIGHT, HUB_SUB_BLOCK_SIZE, HUB_SUB_BLOCKS
} from '../src/classes/debugger/shared/constants';
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

describe('DebuggerInteraction — hub heat-map click (B.1)', () => {
  // Map at (200,50), 64x62 px, 1:1 with sub-blocks (Pascal InHubMap, L968).
  const MAP = { x: 200, y: 50, w: HUB_MAP_WIDTH, h: HUB_MAP_HEIGHT };

  function harness() {
    const h = makeInteraction();
    h.renderer.hubMapBoundsPx.mockReturnValue(MAP);
    // No button and no panel under the map → click reaches the map branch.
    h.renderer.hitTestButton.mockReturnValue(null);
    h.renderer.panelBoundsPx.mockReturnValue({ x: -10, y: -10, w: 0, h: 0 });
    return h;
  }

  it('jumps the hub viewer to the clicked sub-block address (row*64+col)*128', () => {
    const h = harness();
    // top-left pixel → sub-block 0 → hub $00000
    (h.interaction as any).handleMouseDown(MAP.x, MAP.y, 0);
    expect(h.state.hubAddr).toBe(0x00000);
    // col 3, row 2 → sub-block 2*64+3 = 131 → $131 * 128 = 0x4180
    (h.interaction as any).handleMouseDown(MAP.x + 3, MAP.y + 2, 0);
    expect(h.state.hubAddr).toBe(((2 * HUB_MAP_WIDTH + 3) * HUB_SUB_BLOCK_SIZE) & 0xFFFFF);
    expect(h.renderer.render).toHaveBeenCalled();
  });

  it('ignores clicks on the dim region beyond the firmware sub-block count', () => {
    const h = harness();
    h.state.hubAddr = 0xABCDE;
    // last row (61) is past sub-block 3327 (3328 sub-blocks ⇒ rows 0..51 used);
    // col 63, row 61 → sub-block 3967 ≥ HUB_SUB_BLOCKS → no jump
    const subBlock = 61 * HUB_MAP_WIDTH + 63;
    expect(subBlock).toBeGreaterThanOrEqual(HUB_SUB_BLOCKS);
    (h.interaction as any).handleMouseDown(MAP.x + 63, MAP.y + 61, 0);
    expect(h.state.hubAddr).toBe(0xABCDE); // unchanged
  });

  it('does not treat a click outside the map rect as a map jump', () => {
    const h = harness();
    h.state.hubAddr = 0x12345;
    (h.interaction as any).handleMouseDown(MAP.x - 1, MAP.y, 0); // just left of the map
    expect(h.state.hubAddr).toBe(0x12345);
  });
});
