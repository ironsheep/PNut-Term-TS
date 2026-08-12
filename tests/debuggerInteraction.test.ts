/** @format */

/**
 * Tests for the four §2 interaction-parity behaviors added to the debugger
 * bundle's DebuggerInteraction, built on the §5a fixture (#3).
 */

import {
  makeInteraction, makeDebuggerState, makeController, buildPhase1Packet, MSG
} from './shared/debuggerFixture';
import {
  STALL_CMD, CHAR_WIDTH_PX, HALF_ROW_PX, PTR_CENTER,
  HUB_MAP_WIDTH, HUB_MAP_HEIGHT, HUB_SUB_BLOCK_SIZE, HUB_SUB_BLOCKS,
  BITMAP_WIDTH_PX, BITMAP_HEIGHT_PX, BREAK_ADDR, BREAK_EVENT,
  BREAK_MAIN, BREAK_INIT, BREAK_DEBUG, PANEL, EVENT_NAMES
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
    h.state.disAddr = 0x300;
    // Mac delivers Shift+wheel as deltaX with deltaY≈0.
    listener(h, 'wheel')({
      preventDefault: jest.fn(), clientX: DIS.x + 5, clientY: DIS.y + 5,
      deltaX: -120, deltaY: 0, ctrlKey: false, shiftKey: true
    });
    expect(h.state.disAddr).toBe((0x300 - 16) & 0x3FF); // shift magnitude = 16
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

describe('Debugger address model — CogAddr / HubAddr / DisAddr (Part A §A.0, F4)', () => {
  // PNut keeps TWO locks and one derived value. The pane coupling below is
  // observable behavior, not an implementation detail: in hub mode the
  // disassembly and the HUB data pane are the same address.
  const DIS = { x: 100, y: 100, w: 300, h: 200 };
  function harness(mode: DisMode) {
    const h = makeInteraction();
    h.renderer.hitTestButton.mockReturnValue(null);
    h.renderer.panelBoundsPx.mockImplementation((name: string) =>
      name === 'DIS' ? DIS : { x: -10, y: -10, w: 0, h: 0 });
    h.state.disMode = mode;
    return h;
  }
  const wheelOverDis = (h: ReturnType<typeof harness>, dir: number) =>
    (h.interaction as any).handleWheel(DIS.x + 5, DIS.y + 5, dir, false, false);

  it('dmHub — scrolling the disassembly MOVES the HUB data pane (shared HubAddr)', () => {
    const h = harness(DisMode.dmHub);
    h.state.hubAddr = 0x01000;
    expect(h.state.disAddr).toBe(0x01000);   // one address, two panes
    wheelOverDis(h, +1);
    expect(h.state.hubAddr).toBe(h.state.disAddr);
    expect(h.state.hubAddr).not.toBe(0x01000);
  });

  it('dmHub — moving the HUB pane moves the disassembly (the coupling both ways)', () => {
    const h = harness(DisMode.dmHub);
    h.state.hubAddr = 0x02000;
    (h.interaction as any).navHub(0x10);
    expect(h.state.disAddr).toBe(0x02010);
  });

  it('dmCog — cog-space scrolling never touches hubAddr', () => {
    const h = harness(DisMode.dmCog);
    h.state.hubAddr = 0x0ABCD;
    h.state.cogAddr = 0x100;
    wheelOverDis(h, +1);
    expect(h.state.cogAddr).not.toBe(0x100);
    expect(h.state.disAddr).toBe(h.state.cogAddr);
    expect(h.state.hubAddr).toBe(0x0ABCD);   // untouched
  });

  it('dmPC — following a moving PC leaves hubAddr UNCHANGED (the pane must not chase the PC)', () => {
    // The trap the three-concept split exists to prevent: dmPC auto-scroll writes
    // the DERIVED top only. If it wrote HubAddr, the HUB data pane would follow
    // program execution — something PNut never does.
    const h = harness(DisMode.dmPC);
    h.state.hubAddr = 0x0BEEF;
    h.state.disAddr = 0x00800;               // dmPC scroll position, hub-space PC
    expect(h.state.hubAddr).toBe(0x0BEEF);
    h.state.disAddr = 0x00900;               // as the auto-scroll advances it
    expect(h.state.hubAddr).toBe(0x0BEEF);
    expect(h.state.disAddr).toBe(0x00900);
  });

  it('leaving dmPC by wheeling seeds the new lock from the address ON SCREEN', () => {
    const h = harness(DisMode.dmPC);
    h.state.hubAddr = 0x0BEEF;               // stale lock, must be overwritten
    h.state.disAddr = 0x00880;               // what the user is looking at
    wheelOverDis(h, +1);
    expect(h.state.disMode).toBe(DisMode.dmHub);
    expect(h.state.hubAddr).toBe(0x00884);   // seeded from the screen, then one long
  });
});

describe('DebuggerInteraction — disassembly wheel (Part A §A.4, F2/F3)', () => {
  const DIS = { x: 100, y: 100, w: 300, h: 200 };
  function harness(mode: DisMode) {
    const h = makeInteraction();
    h.renderer.hitTestButton.mockReturnValue(null);
    h.renderer.panelBoundsPx.mockImplementation((name: string) =>
      name === 'DIS' ? DIS : { x: -10, y: -10, w: 0, h: 0 });
    h.state.disMode = mode;
    return h;
  }
  const wheel = (h: ReturnType<typeof harness>, dir: number, ctrl = false, shift = false) =>
    (h.interaction as any).handleWheel(DIS.x + 5, DIS.y + 5, dir, ctrl, shift);

  // Pascal DisDeltas (:974) — in REGISTERS for cog mode, ×4 (long-aligned) for hub mode.
  const STEPS: Array<{ label: string; ctrl: boolean; shift: boolean; regs: number }> = [
    { label: 'no modifier', ctrl: false, shift: false, regs: 1 },
    { label: 'Ctrl', ctrl: true, shift: false, regs: 4 },
    { label: 'Shift', ctrl: false, shift: true, regs: 16 },
    { label: 'Ctrl+Shift', ctrl: true, shift: true, regs: 32 }
  ];

  for (const { label, ctrl, shift, regs } of STEPS) {
    it(`dmCog — ${label} moves exactly ${regs} register(s) per notch`, () => {
      const h = harness(DisMode.dmCog);
      h.state.cogAddr = 0x100;
      wheel(h, +1, ctrl, shift);
      expect(h.state.cogAddr).toBe(0x100 + regs);
      wheel(h, -1, ctrl, shift);
      expect(h.state.cogAddr).toBe(0x100);
    });

    it(`dmHub — ${label} moves exactly ${regs * 4} bytes per notch, and the HUB pane follows`, () => {
      const h = harness(DisMode.dmHub);
      h.state.hubAddr = 0x01000;
      wheel(h, +1, ctrl, shift);
      expect(h.state.hubAddr).toBe(0x01000 + regs * 4);
      expect(h.state.disAddr).toBe(h.state.hubAddr); // one shared address
    });
  }

  it('dmCog CLAMPS at the bottom of cog space — stops at $3F0, never wraps to $000', () => {
    const h = harness(DisMode.dmCog);
    h.state.cogAddr = 0x3F0;
    wheel(h, +1);                       // one more notch at the limit
    expect(h.state.cogAddr).toBe(0x3F0); // the boundary value itself, not $000
    wheel(h, +1, true, true);           // and a 32-register jump cannot jump past it
    expect(h.state.cogAddr).toBe(0x3F0);
  });

  it('dmCog clamps at the top of cog space ($000)', () => {
    const h = harness(DisMode.dmCog);
    h.state.cogAddr = 0x010;
    wheel(h, -1, true, true);           // 32 registers down from $010
    expect(h.state.cogAddr).toBe(0x000);
  });

  it('dmHub wraps rather than clamps (20-bit mask)', () => {
    const h = harness(DisMode.dmHub);
    h.state.hubAddr = 0x00000;
    wheel(h, -1);
    expect(h.state.hubAddr).toBe(0xFFFFC);
  });

  it('the first wheel in dmPC seeds from the DISPLAYED address, not from the PC', () => {
    // PC deliberately far from the displayed top: the PC is in cog space while the
    // view has been scrolled into hub space. Seeding from the PC would pick dmCog.
    const h = harness(DisMode.dmPC);
    h.state.message[MSG.IRET] = 0x00080;  // PC in COG space
    h.state.disAddr = 0x01000;            // but the user is looking at hub $01000
    wheel(h, +1);
    expect(h.state.disMode).toBe(DisMode.dmHub);
    expect(h.state.hubAddr).toBe(0x01004);
  });
});

describe('Debugger address model — the Phase-2 window request follows what is displayed', () => {
  // The wire consequence of the model: DebuggerController packs the disassembly
  // window request as (bytes<<20)|addr. If the effective displayed top stops
  // driving it, the P2 returns the wrong window and the pane renders garbage.
  const HUB_CODE_OFFSET = 24; // 8-byte cog bitmap + 16-byte hub bitmap
  const requestedAddr = (buf: Uint8Array): number =>
    new DataView(buf.buffer, buf.byteOffset).getUint32(HUB_CODE_OFFSET, true) & 0xFFFFF;
  const requestedBytes = (buf: Uint8Array): number =>
    new DataView(buf.buffer, buf.byteOffset).getUint32(HUB_CODE_OFFSET, true) >>> 20;

  function phase2For(mode: DisMode, setup: (s: any) => void): Uint8Array {
    const h = makeController();
    h.state.disMode = mode;
    setup(h.state);
    h.controller.processPhase1(buildPhase1Packet({ longs: { [MSG.IRET]: h.state.message[MSG.IRET] } }));
    return h.calls.phase2[h.calls.phase2.length - 1];
  }

  it('dmHub requests the window at the displayed (shared) hub address', () => {
    const buf = phase2For(DisMode.dmHub, (s) => { s.hubAddr = 0x03210; });
    expect(requestedAddr(buf)).toBe(0x03210);
    expect(requestedBytes(buf)).toBe(64);     // DIS_LINES * 4
  });

  it('dmPC in hub space requests the auto-scrolled top, not the hub pane address', () => {
    const buf = phase2For(DisMode.dmPC, (s) => {
      s.message[MSG.IRET] = 0x00900;
      s.hubAddr = 0x0BEEF;                    // hub pane parked elsewhere
      s.disAddr = 0x008C0;
    });
    expect(requestedAddr(buf)).not.toBe(0x0BEEF);
    expect(requestedBytes(buf)).toBe(64);
  });

  it('dmCog asks for no hub-code window at all', () => {
    const buf = phase2For(DisMode.dmCog, (s) => { s.cogAddr = 0x100; });
    expect(requestedBytes(buf)).toBe(0);
  });
});

describe('DebuggerInteraction — hub-data wheel (Part A §A.4, F1/F14)', () => {
  // HUB panel with the heat-map sitting inside its top-right, as on screen.
  const HUB = { x: 100, y: 100, w: 300, h: 100 };
  const MAP = { x: 320, y: 110, w: HUB_MAP_WIDTH, h: HUB_MAP_HEIGHT };
  // Well right of the 5-digit address column (cols 0..4) and left of the map.
  const DATA_X = HUB.x + 10 * CHAR_WIDTH_PX;
  const DATA_Y = HUB.y + 5;

  function harness() {
    const h = makeInteraction();
    h.renderer.hitTestButton.mockReturnValue(null);
    h.renderer.hubMapBoundsPx.mockReturnValue(MAP);
    h.renderer.panelBoundsPx.mockImplementation((name: string) =>
      name === 'HUB' ? HUB : { x: -10, y: -10, w: 0, h: 0 });
    return h;
  }

  // Pascal HubDeltas (DebuggerUnit.pas:975) — the step is already in BYTES.
  const STEPS: Array<{ label: string; ctrl: boolean; shift: boolean; step: number }> = [
    { label: 'no modifier → one 16-byte row', ctrl: false, shift: false, step: 16 },
    { label: 'Ctrl → one byte', ctrl: true, shift: false, step: 1 },
    { label: 'Shift → four bytes', ctrl: false, shift: true, step: 4 },
    { label: 'Ctrl+Shift → one 128-byte sub-block', ctrl: true, shift: true, step: 128 }
  ];

  for (const { label, ctrl, shift, step } of STEPS) {
    it(`one notch moves hubAddr by exactly ${step} bytes — ${label}`, () => {
      const h = harness();
      h.state.hubAddr = 0x01000;
      (h.interaction as any).handleWheel(DATA_X, DATA_Y, +1, ctrl, shift);
      expect(h.state.hubAddr).toBe(0x01000 + step);      // wheel-down → higher address
      (h.interaction as any).handleWheel(DATA_X, DATA_Y, -1, ctrl, shift);
      expect(h.state.hubAddr).toBe(0x01000);             // wheel-up → back
      (h.interaction as any).handleWheel(DATA_X, DATA_Y, -1, ctrl, shift);
      expect(h.state.hubAddr).toBe(0x01000 - step);
    });
  }

  it('wraps rather than clamps at the bottom of hub space (20-bit mask)', () => {
    const h = harness();
    h.state.hubAddr = 0x00000;
    (h.interaction as any).handleWheel(DATA_X, DATA_Y, -1, true, false); // Ctrl → 1 byte
    expect(h.state.hubAddr).toBe(0xFFFFF);
  });

  it('does nothing at all when the wheel is over the hub HEAT-MAP (Pascal: InHubBox and not InHubMap)', () => {
    const h = harness();
    h.state.hubAddr = 0x12345;
    h.renderer.render.mockClear();
    (h.interaction as any).handleWheel(MAP.x, MAP.y, +1, false, false);              // top-left cell
    (h.interaction as any).handleWheel(MAP.x + MAP.w - 1, MAP.y + MAP.h - 1, -1, false, false); // last cell
    expect(h.state.hubAddr).toBe(0x12345);
    expect(h.renderer.render).not.toHaveBeenCalled();
  });

  it('a notch one pixel outside the map rect still scrolls (boundary is exclusive)', () => {
    const h = harness();
    h.state.hubAddr = 0x01000;
    (h.interaction as any).handleWheel(MAP.x - 1, MAP.y, +1, false, false);
    expect(h.state.hubAddr).toBe(0x01010);
  });
});

describe('DebuggerInteraction — GO right-click starts repeat without a redundant stallBrk send', () => {
  it('sets repeat mode and leaves stallBrk at STALL_CMD (the repeat driver ignores it)', () => {
    const h = makeInteraction();
    h.state.isDimmed = false;   // halted, so this is a real repeat start
    h.state.repeatMode = false;
    h.state.breakValue = 0x1234;
    (h.interaction as any).onGoRightClick();
    expect(h.state.repeatMode).toBe(true);
    expect(h.state.stallBrk).toBe(STALL_CMD);
  });
});

describe('DebuggerInteraction — hover hints (Part A §A.5, F12/F15/F16)', () => {
  const EVENT = { x: 900, y: 40, w: 40, h: 256 };
  const HUB = { x: 100, y: 500, w: 776, h: 128 };
  const SMART = { x: 100, y: 460, w: 776, h: 16 };
  const BBOX = { x: 872, y: 296, w: 96, h: 128 };
  const REGSTRIP = { x: 20, y: 10, w: 56, h: 568 };
  const LUTSTRIP = { x: 110, y: 10, w: 56, h: 568 };
  const REGBOX = { x: 16, y: 8, w: 72, h: 600 };
  const LUTBOX = { x: 104, y: 8, w: 72, h: 600 };
  const HUBMAP = { x: 700, y: 508, w: 176, h: 112 };

  function harness() {
    const h = makeInteraction();
    h.renderer.hitTestButton.mockReturnValue(null);
    h.renderer.regMapBoundsPx.mockReturnValue(REGSTRIP);
    h.renderer.lutMapBoundsPx.mockReturnValue(LUTSTRIP);
    h.renderer.hubMapBoundsPx.mockReturnValue(HUBMAP);
    h.renderer.panelBoundsPx.mockImplementation((name: string) => {
      switch (name) {
        case 'EVENT':  return EVENT;
        case 'HUB':    return HUB;
        case 'SMART':  return SMART;
        case 'B':      return BBOX;
        case 'REGMAP': return REGBOX;
        case 'LUTMAP': return LUTBOX;
        default:       return { x: -10, y: -10, w: 0, h: 0 };
      }
    });
    return h;
  }
  const hintAt = (h: ReturnType<typeof harness>, x: number, y: number): string => {
    (h.interaction as any).updateHint(x, y);
    return h.renderer.hintText;
  };

  it('F12 — every event row names THAT row, with no title offset', () => {
    const h = harness();
    // EVENT_NAMES[0] = INT is drawn but not selectable; rows 1..15 are CT1..QMT.
    for (let row = 0; row < 16; row++) {
      const hint = hintAt(h, EVENT.x + 1, EVENT.y + row * (2 * HALF_ROW_PX) + 1);
      expect(hint).toContain(`break on ${EVENT_NAMES[row]} event`);
    }
  });

  it('F12 — the hint and the CLICK agree on which row is which (they had drifted)', () => {
    const h = harness();
    const y = EVENT.y + 1 * (2 * HALF_ROW_PX) + 1;   // the CT1 row
    expect(hintAt(h, EVENT.x + 1, y)).toContain('break on CT1 event');
    (h.interaction as any).handleMouseDown(EVENT.x + 1, y, 0);
    expect(h.state.breakEvent).toBe(1);              // same row → same event
  });

  it('F15 — the six previously-missing regions carry their Pascal hint strings', () => {
    const h = harness();
    expect(hintAt(h, REGBOX.x + 1, REGBOX.y + 1)).toBe('Cog Register Bitmap/Heatmap');
    expect(hintAt(h, LUTBOX.x + 1, LUTBOX.y + 1)).toBe('LUT Register Bitmap/Heatmap');
    // The tab hangs BELOW the hub box; where it overlaps the address column the
    // address hint wins, exactly as Pascal's later MouseWithin call overwrites.
    expect(hintAt(h, HUB.x + 1, HUB.y + HUB.h + 1)).toBe('Hub Data');
    expect(hintAt(h, HUB.x + 1, HUB.y + 1))
      .toBe('Hub Data | Mousewheel changes HUB address digit(s)');
    expect(hintAt(h, HUBMAP.x + 1, HUBMAP.y + 1)).toBe('HUB Heatmap | Click to lock HUB address');
    expect(hintAt(h, BBOX.x + 1, BBOX.y + 1))
      .toBe('Break Control | Select break condition(s) and execute code');
  });

  it('the heat STRIPS keep their own click-describing hints, distinct from the boxes', () => {
    const h = harness();
    expect(hintAt(h, REGSTRIP.x + 1, REGSTRIP.y + 1))
      .toBe('Cog Register Bitmap/Heatmap | Click to lock disassembly to REG subrange');
    expect(hintAt(h, LUTSTRIP.x + 1, LUTSTRIP.y + 1))
      .toBe('LUT Register Bitmap/Heatmap | Click to lock disassembly to LUT subrange');
  });

  it('F16 — the smart-watch box shows NO hint (Pascal passes an empty string)', () => {
    const h = harness();
    hintAt(h, EVENT.x + 1, EVENT.y + 1);                 // something is showing
    expect(hintAt(h, SMART.x + 1, SMART.y + 1)).toBe(''); // …and hovering SMART clears it
  });
});

describe('DebuggerInteraction — keyboard dispatches on the PRODUCED CHARACTER (Part A §A.1, F17/F18)', () => {
  function press(init: KeyboardEventInit): KeyboardEvent {
    const ev = new KeyboardEvent('keydown', { cancelable: true, ...init });
    document.dispatchEvent(ev);
    return ev;
  }

  it('letter commands are case-insensitive and still all fire', () => {
    const h = makeInteraction();
    h.state.breakValue = BREAK_MAIN | BREAK_INIT;
    press({ key: 'b', code: 'KeyB' });                      // BREAK
    expect(h.state.breakValue).toBe(BREAK_INIT);
    press({ key: 'I', code: 'KeyI' });                      // toggle INIT off
    expect(h.state.breakValue & BREAK_INIT).toBe(0);
    press({ key: 'm', code: 'KeyM' });                      // toggle MAIN on
    expect(h.state.breakValue & BREAK_MAIN).toBe(BREAK_MAIN);
  });

  it('a layout-shifted keyboard follows the CHARACTER, not the physical key', () => {
    // AZERTY: the key at the QWERTY 'M' position produces ',' — and the key that
    // produces 'm' sits elsewhere. PNut dispatches on what was typed.
    const h = makeInteraction();
    h.state.breakValue = 0;
    press({ key: ',', code: 'KeyM' });                      // physical M, types ','
    expect(h.state.breakValue).toBe(0);                     // nothing happens
    press({ key: 'm', code: 'Semicolon' });                 // types 'm' elsewhere
    expect(h.state.breakValue & BREAK_MAIN).toBe(BREAK_MAIN);
  });

  it('SPACE and ENTER still drive GO after moving off e.code', () => {
    const h = makeInteraction();
    h.state.isDimmed = false;
    press({ key: ' ', code: 'Space' });                     // go-single
    expect(h.state.stallBrk).toBe(h.state.breakValue);
    press({ key: 'Enter', code: 'Enter' });                 // go-repeat
    expect(h.state.repeatMode).toBe(true);
  });

  it('Ctrl+C / Ctrl+D reach the hub-view control codes #3 / #4, not the letter cases', () => {
    const h = makeInteraction();
    h.state.hubAddr = 0x01000;
    press({ key: 'c', code: 'KeyC', ctrlKey: true });
    expect(h.state.hubAddr).toBe(0x00FF0);                  // up one 16-byte line
    press({ key: 'd', code: 'KeyD', ctrlKey: true });
    expect(h.state.hubAddr).toBe(0x01000);                  // down one line…
    // …and specifically NOT the plain-D behavior (toggle break-on-DEBUG).
    expect(h.state.breakValue & BREAK_DEBUG).toBe(BREAK_DEBUG); // untouched from reset default
  });

  it('Ctrl+K / Ctrl+L page the hub view (#11 / #12)', () => {
    const h = makeInteraction();
    h.state.hubAddr = 0x02000;
    // Ctrl is held, so the page magnitude is the Ctrl one ($1000) — see the
    // documented KeyShift divergence in handleKey.
    press({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(h.state.hubAddr).toBe(0x01000);
    press({ key: 'l', code: 'KeyL', ctrlKey: true });
    expect(h.state.hubAddr).toBe(0x02000);
  });

  it('Ctrl+M is #13 — the same code as ENTER — so it starts go-repeat', () => {
    const h = makeInteraction();
    h.state.isDimmed = false;
    press({ key: 'm', code: 'KeyM', ctrlKey: true });
    expect(h.state.repeatMode).toBe(true);
  });

  it('Ctrl combos with no matching case do nothing (Ctrl+A #1, Ctrl+B #2)', () => {
    const h = makeInteraction();
    h.state.breakValue = BREAK_MAIN | BREAK_INIT;
    h.state.hubAddr = 0x03000;
    press({ key: 'a', code: 'KeyA', ctrlKey: true });
    press({ key: 'b', code: 'KeyB', ctrlKey: true });       // NOT the BREAK command
    expect(h.state.breakValue).toBe(BREAK_MAIN | BREAK_INIT);
    expect(h.state.hubAddr).toBe(0x03000);
  });

  it('Alt+letter and Meta+letter do nothing at all', () => {
    const h = makeInteraction();
    h.state.breakValue = BREAK_MAIN | BREAK_INIT;
    press({ key: 'b', code: 'KeyB', altKey: true });
    press({ key: 'b', code: 'KeyB', metaKey: true });
    expect(h.state.breakValue).toBe(BREAK_MAIN | BREAK_INIT);
  });

  it('arrow and page keys keep their unmodified magnitudes', () => {
    const h = makeInteraction();
    h.state.hubAddr = 0x04000;
    press({ key: 'ArrowUp', code: 'ArrowUp' });
    expect(h.state.hubAddr).toBe(0x03FF0);
    press({ key: 'ArrowDown', code: 'ArrowDown' });
    expect(h.state.hubAddr).toBe(0x04000);
    press({ key: 'PageDown', code: 'PageDown' });
    expect(h.state.hubAddr).toBe(0x04080);                  // one 128-byte sub-block
    press({ key: 'PageUp', code: 'PageUp', shiftKey: true });
    expect(h.state.hubAddr).toBe((0x04080 - 0x10000) & 0xFFFFF);
  });
});

describe('DebuggerInteraction — click-region corrections (Part A §A.2/§A.3, F5-F9/F13)', () => {
  it('F5 — RIGHT-click on BREAK clears all but INIT, exactly like a left-click', () => {
    const h = makeInteraction();
    h.renderer.hitTestButton.mockReturnValue('BREAK');
    h.state.breakValue = BREAK_MAIN | BREAK_INIT | BREAK_EVENT;
    h.state.repeatMode = true;
    (h.interaction as any).handleMouseDown(10, 10, 2);   // right button
    expect(h.state.breakValue).toBe(BREAK_INIT);
    expect(h.state.repeatMode).toBe(false);
  });

  describe('F6 — REG/LUT strip click centers the clicked register and clamps', () => {
    // Pascal MapCogAddr: Within((relY shl 9) div stripHeight - 8, $000, $1F0),
    // measured against the INSET strip, not the enclosing box.
    const REG = { x: 20, y: 10, w: 56, h: 568 };
    const LUT = { x: 110, y: 10, w: 56, h: 568 };
    function harness() {
      const h = makeInteraction();
      h.renderer.hitTestButton.mockReturnValue(null);
      h.renderer.panelBoundsPx.mockReturnValue({ x: -10, y: -10, w: 0, h: 0 });
      h.renderer.regMapBoundsPx.mockReturnValue(REG);
      h.renderer.lutMapBoundsPx.mockReturnValue(LUT);
      return h;
    }
    const yForRegister = (reg: number) => REG.y + Math.ceil((reg * REG.h) / 512);

    it('REG strip lands the clicked register MID-window, not on the top line', () => {
      const h = harness();
      (h.interaction as any).handleMouseDown(REG.x + 1, yForRegister(100), 0);
      expect(h.state.disMode).toBe(DisMode.dmCog);
      expect(h.state.cogAddr).toBe(100 - 8);   // the -8 centering
    });

    it('REG strip clamps at both ends ($000 and $1F0)', () => {
      const h = harness();
      (h.interaction as any).handleMouseDown(REG.x + 1, REG.y, 0);              // very top
      expect(h.state.cogAddr).toBe(0x000);
      (h.interaction as any).handleMouseDown(REG.x + 1, REG.y + REG.h - 1, 0);  // very bottom
      expect(h.state.cogAddr).toBe(0x1F0);                                      // never past $1F0
    });

    it('LUT strip adds $200 AFTER the clamp, so it spans $200..$3F0', () => {
      const h = harness();
      (h.interaction as any).handleMouseDown(LUT.x + 1, LUT.y, 0);
      expect(h.state.disMode).toBe(DisMode.dmCog);
      expect(h.state.cogAddr).toBe(0x200);
      (h.interaction as any).handleMouseDown(LUT.x + 1, LUT.y + LUT.h - 1, 0);
      expect(h.state.cogAddr).toBe(0x3F0);
    });
  });

  describe('F7 — SFR click needs BOTH a cog-range value AND an interrupt-vector row', () => {
    const rowY = (row: number) => row * (2 * HALF_ROW_PX) + 1;

    it('an interrupt vector holding a COG address locks the disassembly to cog space', () => {
      const h = makeInteraction();
      h.state.cogImage[0x1F2] = 0x0120;         // IJMP2, cog range
      (h.interaction as any).onSFRClick(rowY(2));
      expect(h.state.disMode).toBe(DisMode.dmCog);
      expect(h.state.cogAddr).toBe(0x0120);
    });

    it('an interrupt vector holding a HUB address routes to hub — the case we got wrong', () => {
      const h = makeInteraction();
      h.state.cogImage[0x1F2] = 0x0A000;        // IJMP2 pointing into hub
      (h.interaction as any).onSFRClick(rowY(2));
      expect(h.state.disMode).toBe(DisMode.dmHub);
      expect(h.state.hubAddr).toBe(0x0A000);
    });

    it('a data pointer row is always a hub pointer, and the disassembly follows it', () => {
      const h = makeInteraction();
      h.state.cogImage[0x1F8] = 0x00100;        // PTRA holding a cog-range value
      (h.interaction as any).onSFRClick(rowY(8));
      expect(h.state.disMode).toBe(DisMode.dmHub);   // row >= 6 ⇒ hub regardless
      expect(h.state.hubAddr).toBe(0x00100);
    });
  });

  it('F8 — a stack slot holding a hub address sets dmHub as well as hubAddr', () => {
    const h = makeInteraction();
    h.state.message[MSG.STK1] = 0x02040;
    (h.interaction as any).onStackClick(6 * CHAR_WIDTH_PX + CHAR_WIDTH_PX * 9 + 1); // slot 1
    expect(h.state.disMode).toBe(DisMode.dmHub);
    expect(h.state.hubAddr).toBe(0x02040);
  });

  describe('F9 — the hub ASCII column is its own click region', () => {
    const CHR_COL = 6 + 16 * 3 + 1;
    it('clicking a character navigates to that byte (one char = one byte)', () => {
      const h = makeInteraction();
      h.state.hubAddr = 0x01000;
      // row 2, 5th character → +2*16 + 4
      (h.interaction as any).onHubClick((CHR_COL + 4) * CHAR_WIDTH_PX, 2 * (2 * HALF_ROW_PX) + 1);
      expect(h.state.hubAddr).toBe(0x01000 + 2 * 16 + 4);
      expect(h.state.disMode).toBe(DisMode.dmHub);
    });

    it('the hex area still uses three characters per byte', () => {
      const h = makeInteraction();
      h.state.hubAddr = 0x01000;
      (h.interaction as any).onHubClick((6 + 3 * 4) * CHAR_WIDTH_PX, 1 * (2 * HALF_ROW_PX) + 1);
      expect(h.state.hubAddr).toBe(0x01000 + 16 + 4);
    });

    it('the gap between the two regions does nothing', () => {
      const h = makeInteraction();
      h.state.hubAddr = 0x01000;
      (h.interaction as any).onHubClick((CHR_COL - 1) * CHAR_WIDTH_PX, 1);
      expect(h.state.hubAddr).toBe(0x01000);
    });
  });

  it('F13 — a hub-mode disassembly right-click below $400 is refused outright', () => {
    const h = makeInteraction();
    h.state.disMode = DisMode.dmHub;
    h.state.breakValue = BREAK_MAIN;
    h.state.breakAddr = 0x00777;
    h.renderer.disassemblyLineAddress.mockReturnValue(0x0100);  // cog space
    (h.interaction as any).onDisassemblyClick(0, true);
    expect(h.state.breakValue).toBe(BREAK_MAIN);   // untouched
    expect(h.state.breakAddr).toBe(0x00777);       // untouched
    // …while a line at or above $400 still arms normally.
    h.renderer.disassemblyLineAddress.mockReturnValue(0x00400);
    (h.interaction as any).onDisassemblyClick(0, true);
    expect(h.state.breakValue & BREAK_ADDR).toBe(BREAK_ADDR);
    expect(h.state.breakAddr).toBe(0x00400);
  });
});

describe('DebuggerInteraction — SMART box click (Test 10, Pascal :948-953)', () => {
  const SMART = { x: 300, y: 300, w: 100, h: 20 };
  function harness() {
    const h = makeInteraction();
    h.renderer.hitTestButton.mockReturnValue(null);
    h.renderer.hubMapBoundsPx.mockReturnValue({ x: -10, y: -10, w: 0, h: 0 });
    // Only the SMART panel is under the cursor; all other panels miss.
    h.renderer.panelBoundsPx.mockImplementation((name: string) =>
      name === 'SMART' ? SMART : { x: -10, y: -10, w: 0, h: 0 }
    );
    return h;
  }

  it('left-click resets the watch list but does NOT toggle the DIR filter', () => {
    const h = harness();
    h.state.smartWatchList = [{ pin: 0, value: 0x1234, counter: 500 }];
    h.state.smartWatchDirOnly = true;
    (h.interaction as any).handleMouseDown(SMART.x + 1, SMART.y + 1, 0); // left
    expect(h.state.smartWatchList).toEqual([]);
    expect(h.state.smartWatchDirOnly).toBe(true); // unchanged
    expect(h.renderer.render).toHaveBeenCalled();
  });

  it('right-click ALWAYS resets the list AND toggles the DIR filter (Pascal :950-953)', () => {
    const h = harness();
    h.state.smartWatchList = [{ pin: 0, value: 0x1234, counter: 500 }];
    h.state.smartWatchDirOnly = true;
    (h.interaction as any).handleMouseDown(SMART.x + 1, SMART.y + 1, 2); // right
    expect(h.state.smartWatchList).toEqual([]);
    expect(h.state.smartWatchDirOnly).toBe(false); // toggled all-pins

    // A second right-click resets again and toggles back to DIR-only.
    h.state.smartWatchList = [{ pin: 1, value: 0x5, counter: 3 }];
    (h.interaction as any).handleMouseDown(SMART.x + 1, SMART.y + 1, 2);
    expect(h.state.smartWatchList).toEqual([]);
    expect(h.state.smartWatchDirOnly).toBe(true);
  });
});

describe('DebuggerInteraction — events-panel click arms the event break (Test 13)', () => {
  // Events flags panel as a known rect; every other panel/button misses. Rows are
  // 2 half-rows tall (renderEvents draws EVENT_NAMES[i] at p.t + i*2); row 1 = CT1.
  const EVENT = { x: 900, y: 40, w: 40, h: 256 };
  function withEventPanel(h: ReturnType<typeof makeInteraction>) {
    h.renderer.hitTestButton.mockReturnValue(null);
    h.renderer.hubMapBoundsPx.mockReturnValue({ x: -10, y: -10, w: 0, h: 0 });
    h.renderer.panelBoundsPx.mockImplementation((name: string) =>
      name === 'EVENT' ? EVENT : { x: -10, y: -10, w: 0, h: 0 });
  }
  const rowY = (row: number) => EVENT.y + row * (2 * HALF_ROW_PX) + 1;

  it('left-click on the CT1 row (row 1) selects AND arms the event (regression: used to only select)', () => {
    const h = makeInteraction();
    withEventPanel(h);
    h.state.breakValue = 0;
    (h.interaction as any).handleMouseDown(EVENT.x + 1, rowY(1), 0); // left-click CT1
    expect(h.state.breakEvent).toBe(1);                              // CT1 selected
    expect(h.state.breakValue & BREAK_EVENT).toBe(BREAK_EVENT);      // ← armed (was 0 before fix)
    expect((h.state.breakValue >>> 12) & 0xF).toBe(1);              // event id CT1 in bits 12-15
  });

  it('right-click toggles an armed event off, then back on (Pascal :833-838)', () => {
    const h = makeInteraction();
    withEventPanel(h);
    h.state.breakValue = 0;
    (h.interaction as any).handleMouseDown(EVENT.x + 1, rowY(2), 0); // arm CT2 (row 2)
    expect(h.state.breakValue & BREAK_EVENT).toBe(BREAK_EVENT);
    (h.interaction as any).handleMouseDown(EVENT.x + 1, rowY(2), 2); // right-click → off
    expect(h.state.breakValue & BREAK_EVENT).toBe(0);
    (h.interaction as any).handleMouseDown(EVENT.x + 1, rowY(2), 2); // right-click → on again
    expect(h.state.breakValue & BREAK_EVENT).toBe(BREAK_EVENT);
    expect((h.state.breakValue >>> 12) & 0xF).toBe(2);
  });
});
