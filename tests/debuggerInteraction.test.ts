/** @format */

/**
 * Tests for the four §2 interaction-parity behaviors added to the debugger
 * bundle's DebuggerInteraction, built on the §5a fixture (#3).
 */

import { makeInteraction, makeDebuggerState, MSG } from './shared/debuggerFixture';
import {
  STALL_CMD, CHAR_WIDTH_PX, HALF_ROW_PX, PTR_CENTER,
  HUB_MAP_WIDTH, HUB_MAP_HEIGHT, HUB_SUB_BLOCK_SIZE, HUB_SUB_BLOCKS,
  BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX, BREAK_ADDR
} from '../src/classes/debugger/shared/constants';
import { DisMode } from '../src/classes/debugger/renderer/DebuggerState';

/** Pull a DOM listener the interaction registered on the (mock) canvas. */
function listener(h: ReturnType<typeof makeInteraction>, type: string): (e: any) => void {
  const call = (h.canvas.addEventListener as jest.Mock).mock.calls.find((c) => c[0] === type);
  if (!call) throw new Error(`no ${type} listener registered`);
  return call[1] as (e: any) => void;
}

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

describe('DebuggerInteraction — macOS input plumbing (Test 4 HW gate)', () => {
  // Map mouse coords 1:1 to canvas pixels (no CSS scaling) so clientX/Y == px.
  function harness(state = makeDebuggerState()) {
    const h = makeInteraction(state);
    (h.canvas.getBoundingClientRect as jest.Mock).mockReturnValue({
      left: 0, top: 0, right: BITMAP_WIDTH_PX, bottom: BITMAP_HEIGHT_PX,
      width: BITMAP_WIDTH_PX, height: BITMAP_HEIGHT_PX, x: 0, y: 0, toJSON: () => ({})
    });
    return h;
  }

  // The disassembly panel as a known rect; everything else is far off-screen.
  const DIS = { x: 100, y: 100, w: 300, h: 200 };
  function withDisPanel(h: ReturnType<typeof harness>) {
    h.renderer.hitTestButton.mockReturnValue(null);
    h.renderer.panelBoundsPx.mockImplementation((name: string) =>
      name === 'DIS' ? DIS : { x: -10, y: -10, w: 0, h: 0 });
    h.renderer.disassemblyLineAddress.mockReturnValue(0x123);
  }

  it('right-click via the contextmenu event toggles an address breakpoint (Mac Ctrl+click / trackpad)', () => {
    const h = harness();
    withDisPanel(h);
    const ev = { preventDefault: jest.fn(), clientX: DIS.x + 5, clientY: DIS.y + 1 };
    listener(h, 'contextmenu')(ev);
    expect(ev.preventDefault).toHaveBeenCalled();        // OS menu suppressed
    expect(h.state.breakAddr).toBe(0x123);               // breakpoint set at the line
    expect(h.state.breakValue & BREAK_ADDR).toBe(BREAK_ADDR);
  });

  it('mousedown with a physical right button (button 2) toggles the breakpoint directly', () => {
    const h = harness();
    withDisPanel(h);
    listener(h, 'mousedown')({ button: 2, ctrlKey: false, clientX: DIS.x + 5, clientY: DIS.y + 1 });
    expect(h.state.breakValue & BREAK_ADDR).toBe(BREAK_ADDR); // toggled ON from mousedown
  });

  it('one physical right-press fires exactly once across macOS TWO md+cm pairs (no double-toggle)', () => {
    // HW capture 2026-06-30 (debug_260630-143127): macOS/Electron delivers a single
    // physical right-press as mousedown,contextmenu,mousedown,contextmenu,mouseup —
    // TWO md+cm pairs but ONE mouseup. A per-event suppress flag let the 2nd mousedown
    // toggle back OFF (the right-click-does-nothing symptom). The gesture latch must
    // make all four pre-mouseup events collapse to a single toggle.
    const h = harness();
    withDisPanel(h);
    const at = () => ({ button: 2, ctrlKey: false, clientX: DIS.x + 5, clientY: DIS.y + 1 });
    const cm = () => ({ preventDefault: jest.fn(), clientX: DIS.x + 5, clientY: DIS.y + 1 });
    listener(h, 'mousedown')(at());     // pair 1 — toggles ON, latches the gesture
    listener(h, 'contextmenu')(cm());   // swallowed
    listener(h, 'mousedown')(at());     // pair 2 — must be ignored (latched)
    listener(h, 'contextmenu')(cm());   // swallowed
    expect(h.state.breakValue & BREAK_ADDR).toBe(BREAK_ADDR); // still ON → exactly one fire
  });

  it('a SECOND right-press (after mouseup releases the latch) toggles back OFF', () => {
    const h = harness();
    withDisPanel(h);
    const at = () => ({ button: 2, ctrlKey: false, clientX: DIS.x + 5, clientY: DIS.y + 1 });
    const cm = () => ({ preventDefault: jest.fn(), clientX: DIS.x + 5, clientY: DIS.y + 1 });
    // Gesture 1 → ON
    listener(h, 'mousedown')(at()); listener(h, 'contextmenu')(cm());
    listener(h, 'mousedown')(at()); listener(h, 'contextmenu')(cm());
    listener(h, 'mouseup')({});       // releases the gesture latch
    expect(h.state.breakValue & BREAK_ADDR).toBe(BREAK_ADDR);
    // Gesture 2 → OFF (proves the latch reset; a stuck latch would block this)
    listener(h, 'mousedown')(at()); listener(h, 'contextmenu')(cm());
    listener(h, 'mousedown')(at()); listener(h, 'contextmenu')(cm());
    listener(h, 'mouseup')({});
    expect(h.state.breakValue & BREAK_ADDR).toBe(0);
  });

  it('left mousedown still drives a normal left-click (lock-to-PC)', () => {
    const h = harness(makeDebuggerState());
    withDisPanel(h);
    h.state.disMode = DisMode.dmCog;
    listener(h, 'mousedown')({ button: 0, ctrlKey: false, clientX: DIS.x + 5, clientY: DIS.y + 1 });
    expect(h.state.disMode).toBe(DisMode.dmPC);
  });

  it('Shift+wheel arrives as horizontal deltaX on macOS and still scrolls (16/notch in cog mode)', () => {
    const h = harness();
    h.renderer.panelBoundsPx.mockImplementation((name: string) =>
      name === 'DIS' ? DIS : { x: -10, y: -10, w: 0, h: 0 });
    h.state.disMode = DisMode.dmCog;
    h.state.disTopAddr = 0x300;
    // Mac delivers Shift+wheel as deltaX with deltaY≈0.
    listener(h, 'wheel')({
      preventDefault: jest.fn(), clientX: DIS.x + 5, clientY: DIS.y + 5,
      deltaX: -120, deltaY: 0, ctrlKey: false, shiftKey: true
    });
    expect(h.state.disTopAddr).toBe((0x300 - 16) & 0x3FF); // shift magnitude = 16
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

  it('jumps on the last map cell — the 64×62 map is exactly 124×32 sub-blocks', () => {
    // With the authoritative HUB_BLOCKS=124, HUB_SUB_BLOCKS=3968 = 64×62, so the
    // map has NO dim region: every cell (incl. the last, row 61 col 63 →
    // sub-block 3967) maps to a real sub-block. Pascal's geometry is identical
    // ($7C000/$80 = 3968). (The prior 104/3328 value left a phantom dim region.)
    const h = harness();
    const subBlock = 61 * HUB_MAP_WIDTH + 63;
    expect(subBlock).toBe(HUB_SUB_BLOCKS - 1); // 3967 — the last valid cell
    (h.interaction as any).handleMouseDown(MAP.x + 63, MAP.y + 61, 0);
    expect(h.state.hubAddr).toBe((subBlock * HUB_SUB_BLOCK_SIZE) & 0xFFFFF);
    expect(h.renderer.render).toHaveBeenCalled();
  });

  it('does not treat a click outside the map rect as a map jump', () => {
    const h = harness();
    h.state.hubAddr = 0x12345;
    (h.interaction as any).handleMouseDown(MAP.x - 1, MAP.y, 0); // just left of the map
    expect(h.state.hubAddr).toBe(0x12345);
  });
});
