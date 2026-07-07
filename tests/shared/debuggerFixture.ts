/** @format */

/**
 * Shared test fixture for the single-step debugger renderer bundle
 * (src/classes/debugger/renderer/). Stood up in §5a so the §2 interaction
 * tests (#7) and §3 display tests (#8) have a common, byte-accurate way to
 * construct a DebuggerState, synthesize Phase-1/Phase-3 input, and drive the
 * controller / interaction layer with capturing callbacks.
 *
 * The live bridge feeds the bundle raw packet bytes over typed IPC; these
 * helpers reproduce that input shape exactly (PHASE1_SIZE, COG_BLOCKS,
 * HUB_BLOCKS imported from the bundle's own constants so the fixture can never
 * drift from the implementation).
 */

import { DebuggerState } from '../../src/classes/debugger/renderer/DebuggerState';
import {
  DebuggerController,
  ControllerCallbacks
} from '../../src/classes/debugger/renderer/DebuggerController';
import {
  DebuggerInteraction,
  InteractionCallbacks
} from '../../src/classes/debugger/renderer/DebuggerInteraction';
import {
  PHASE1_SIZE,
  COG_BLOCKS,
  HUB_BLOCKS,
  COG_BLOCK_SIZE,
  HUB_BLOCK_RATIO,
  HUB_SUB_BLOCK_SIZE,
  DIS_LINES,
  PTR_BYTES
} from '../../src/classes/debugger/shared/constants';
import { createMockCanvas } from './mockHelpers';

/**
 * 20-long debugger-message indices. Mirrors the `const enum M` in
 * `debugger/shared/constants.ts`, duplicated here as plain numbers so the
 * fixture does not import a const enum (which transpiles awkwardly under
 * isolatedModules-style test builds).
 */
export const MSG = {
  COGN: 0, BRKCZ: 1, BRKC: 2, BRKZ: 3, CTH2: 4, CTL2: 5,
  STK0: 6, STK1: 7, STK2: 8, STK3: 9, STK4: 10, STK5: 11, STK6: 12, STK7: 13,
  IRET: 14, FPTR: 15, PTRA: 16, PTRB: 17, FREQ: 18, COND: 19
} as const;

/** Construct a fresh DebuggerState (cog/baud default to harmless test values). */
export function makeDebuggerState(cogId = 0, debugBaud = 2_000_000): DebuggerState {
  return new DebuggerState(cogId, debugBaud);
}

export interface Phase1Opts {
  /** Override message longs by index (use MSG.*). */
  longs?: Partial<Record<number, number>>;
  /** Up to COG_BLOCKS (64) CRC words, written at byte 80. */
  cogCrc?: number[];
  /** Up to HUB_BLOCKS (104) checksum words, written after the CRC words. */
  hubSum?: number[];
}

/**
 * Build a Phase-1 packet (PHASE1_SIZE bytes) the controller will accept:
 * 20 longs, then COG_BLOCKS CRC words, then HUB_BLOCKS checksum words — all
 * little-endian, matching DebuggerController.processPhase1.
 */
export function buildPhase1Packet(opts: Phase1Opts = {}): Uint8Array {
  const buf = new Uint8Array(PHASE1_SIZE);
  const view = new DataView(buf.buffer);
  if (opts.longs) {
    for (const [idx, val] of Object.entries(opts.longs)) {
      view.setUint32(Number(idx) * 4, (val as number) >>> 0, true);
    }
  }
  const cogBase = 80;
  if (opts.cogCrc) {
    opts.cogCrc.forEach((w, i) => {
      if (i < COG_BLOCKS) view.setUint16(cogBase + i * 2, w & 0xffff, true);
    });
  }
  const hubBase = cogBase + COG_BLOCKS * 2;
  if (opts.hubSum) {
    opts.hubSum.forEach((w, i) => {
      if (i < HUB_BLOCKS) view.setUint16(hubBase + i * 2, w & 0xffff, true);
    });
  }
  return buf;
}

export interface Phase3Opts {
  /** 16-long value for each pending COG/LUT block (default 0). */
  cogLong?: (blockIdx: number, longIdx: number) => number;
  /** 16-bit sub-block checksum for each pending hub block (default 0). */
  hubSubWord?: (blockIdx: number, subIdx: number) => number;
}

/**
 * Build a Phase-3 byte stream matching DebuggerPhase3Parser's layout for the
 * blocks the controller requested in its last Phase-2 reply. Must be called
 * AFTER processPhase1 (which populates state.pendingCogBlocks / .pendingHubBlocks
 * / .pendingHubCode via buildPhase2). Hub reads and smart-pin masks are emitted
 * as zeros — enough to drive the parser to completion. The sub-block checksum
 * section is the part the §6.18 heat map consumes.
 */
export function buildPhase3Packet(state: DebuggerState, opts: Phase3Opts = {}): Uint8Array {
  const bytes: number[] = [];
  const pushU16 = (w: number) => { bytes.push(w & 0xff, (w >>> 8) & 0xff); };
  const pushU32 = (v: number) => {
    bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  };

  for (const blockIdx of state.pendingCogBlocks) {
    for (let j = 0; j < COG_BLOCK_SIZE; j++) pushU32(opts.cogLong ? opts.cogLong(blockIdx, j) >>> 0 : 0);
  }
  for (const blockIdx of state.pendingHubBlocks) {
    for (let j = 0; j < HUB_BLOCK_RATIO; j++) pushU16(opts.hubSubWord ? opts.hubSubWord(blockIdx, j) : 0);
  }
  // Hub reads: optional disassembly longs + 3 pointer windows + hub viewer.
  if (state.pendingHubCode) for (let j = 0; j < DIS_LINES; j++) pushU32(0);
  for (let j = 0; j < PTR_BYTES * 3 + HUB_SUB_BLOCK_SIZE; j++) bytes.push(0);
  // Smart pins: 8 group masks, all zero → no following longs.
  for (let g = 0; g < 8; g++) bytes.push(0);

  return new Uint8Array(bytes);
}

/** Captured controller callback activity, for assertions. */
export interface ControllerCalls {
  phase2: Uint8Array[];
  render: number;
  timeout: number;
  phase3Complete: number;
  /** Per-break Phase-3 size hints (§3), in emit order. */
  phase3Size: Array<{ cogId: number; size: number }>;
}

export interface ControllerHarness {
  controller: DebuggerController;
  state: DebuggerState;
  calls: ControllerCalls;
}

/** Build a DebuggerController wired to capturing callbacks. */
export function makeController(
  state: DebuggerState = makeDebuggerState(),
  cb: Partial<ControllerCallbacks> = {}
): ControllerHarness {
  const calls: ControllerCalls = { phase2: [], render: 0, timeout: 0, phase3Complete: 0, phase3Size: [] };
  const callbacks: ControllerCallbacks = {
    sendPhase2: (b) => { calls.phase2.push(b); },
    requestRender: () => { calls.render++; },
    onBreakpointTimeout: () => { calls.timeout++; },
    onPhase3Complete: () => { calls.phase3Complete++; },
    onPhase3Size: (cogId, size) => { calls.phase3Size.push({ cogId, size }); },
    ...cb
  };
  return { controller: new DebuggerController(state, callbacks), state, calls };
}

/**
 * Minimal renderer stub exposing only the methods DebuggerInteraction calls
 * (hitTestButton, panelBoundsPx, render). Tests set the return values to
 * simulate clicking a given button / panel region without a real canvas
 * (the real DebuggerRenderer needs OffscreenCanvas, absent in jsdom).
 */
export interface MockRenderer {
  hitTestButton: jest.Mock;
  panelBoundsPx: jest.Mock;
  hubMapBoundsPx: jest.Mock;
  disassemblyLineAddress: jest.Mock;
  render: jest.Mock;
}
export function makeMockRenderer(): MockRenderer {
  return {
    hitTestButton: jest.fn().mockReturnValue(null),
    panelBoundsPx: jest.fn().mockReturnValue(null),
    // Zero-size rect never matches a click; tests that exercise the hub map
    // override this with a real rect.
    hubMapBoundsPx: jest.fn().mockReturnValue({ x: -1, y: -1, w: 0, h: 0 }),
    disassemblyLineAddress: jest.fn().mockReturnValue(0x000),
    render: jest.fn()
  };
}

export interface InteractionHarness {
  interaction: DebuggerInteraction;
  state: DebuggerState;
  renderer: MockRenderer;
  controller: DebuggerController;
  /** COGBRK masks emitted via the onCogBrkRequest callback. */
  cogBrkRequests: number[];
  canvas: jest.Mocked<HTMLCanvasElement>;
}

/** Build a DebuggerInteraction over a mock canvas + mock renderer. */
export function makeInteraction(state: DebuggerState = makeDebuggerState()): InteractionHarness {
  const { controller } = makeController(state);
  const renderer = makeMockRenderer();
  const cogBrkRequests: number[] = [];
  const cb: InteractionCallbacks = { onCogBrkRequest: (m) => cogBrkRequests.push(m) };
  const canvas = createMockCanvas();
  const interaction = new DebuggerInteraction(
    canvas as unknown as HTMLCanvasElement,
    state,
    renderer as unknown as never,
    controller,
    cb
  );
  return { interaction, state, renderer, controller, cogBrkRequests, canvas };
}
