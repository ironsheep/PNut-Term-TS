/** @format */

/**
 * Single source of truth for constants both sides of the debugger IPC need.
 *
 * This file replaces the ad-hoc constants scattered across the old
 * `debuggerConstants.ts` / `debuggerResponse.ts` / `debuggerProtocol.ts`.
 * Every value here traces to a specific line of Pascal reference source
 * (`DebuggerUnit.pas`, `Spin2_debugger.spin2`).
 *
 * References:
 *   - DOCs/pascal-REF/SingleStep-Debugger-Theory-of-Operations.md (the spec)
 *   - PNut-TypeScript/VERSION_STUDY/v51a/DebuggerUnit.pas (host-side Pascal)
 *   - PNut-TypeScript/VERSION_STUDY/v51a/Spin2_debugger.spin2 (target firmware)
 */

// ============================================================================
// Phase sizes (§3.3 of Theory of Operations)
//
// NOTE: Pascal (PNut) documents 124 hub blocks (456-byte packet). The
// TypeScript fork `pnut_ts` used by this host uses 104 hub blocks
// (416-byte packet) — confirmed by host-side extractor (`DEBUGGER*_416BYTE`
// in sharedMessagePool.ts, DEBUGGER_SIZE=416 in extractionWorker.ts) and
// by observed wire-format bytes. All constants below match pnut_ts reality.
// ============================================================================

/** Phase 1 packet: 20 longs + 64 CRC words + 104 hub checksums = 80 + 128 + 208 */
export const PHASE1_SIZE = 416;

/** Phase 2 response (8 + 16 + 5*4 + 4 + 4) = 52 bytes */
export const PHASE2_SIZE = 52;

// ============================================================================
// 20-long debugger message layout (§11.1 / DebuggerUnit.pas lines 10-29)
// ============================================================================

export const DEBUGGER_MSG_LONGS = 20;

export const enum M {
  COGN  = 0,   // cog number (0-7)
  BRKCZ = 1,   // break status CZ (interrupt states, COGINIT, streamer, modulator, FIFO dir)
  BRKC  = 2,   // break status C (events[15:0], xbyte[24:16], skipf[27], call depth[31:28], LUTS[26])
  BRKZ  = 3,   // break status Z (SKIP pattern, 32 bits)
  CTH2  = 4,   // clock ticks high 32
  CTL2  = 5,   // clock ticks low 32
  STK0  = 6,
  STK1  = 7,
  STK2  = 8,
  STK3  = 9,
  STK4  = 10,
  STK5  = 11,
  STK6  = 12,
  STK7  = 13,
  IRET  = 14,  // bit 31 = C, bit 30 = Z, bits 19..0 = PC
  FPTR  = 15,  // FIFO pointer (RFxx/WFxx)
  PTRA  = 16,
  PTRB  = 17,
  FREQ  = 18,  // clock frequency in Hz
  COND  = 19   // initial BRK condition (used on first break only)
}

// ============================================================================
// Memory layout constants (§11.2)
// ============================================================================

export const COG_LUT_SIZE      = 0x400;  // 1024 longs (COG 0x000-0x1FF + LUT 0x200-0x3FF)
export const COG_BLOCK_SIZE    = 0x10;   // 16 longs per CRC block
export const COG_BLOCKS        = 64;     // 1024 / 16
export const HUB_BLOCK_SIZE    = 0x1000; // 4096 bytes per checksum block
export const HUB_BLOCKS        = 104;    // pnut_ts firmware sends 104 checksum words (208 bytes)
export const HUB_SIZE          = HUB_BLOCKS * HUB_BLOCK_SIZE; // 425,984 bytes
export const HUB_SUB_BLOCK_SIZE = 0x80;  // 128 bytes per sub-block
export const HUB_BLOCK_RATIO   = 32;     // sub-blocks per block

export const REG_WATCH_SIZE       = 0x1F0; // 496 watchable cog registers
export const REG_WATCH_LIST_SIZE  = 16;
export const SMART_PINS           = 64;
export const SMART_WATCH_LIST_SIZE = 7;
export const PTR_BYTES            = 14;  // bytes per pointer display
export const PTR_CENTER           = 6;   // center byte index
export const STACK_DEPTH          = 8;

export const DIS_LINES           = 16;
export const DIS_LINE_IDEAL      = 3;
export const DIS_SCROLL_THRESHOLD = 8;

export const HIT_INITIAL    = 254; // initial heat value on change
export const HIT_DECAY_RATE = 2;   // per-break decay

// ============================================================================
// Command/break-condition word (§3.7)
// ============================================================================

export const STALL_CMD      = 0x00000800;
export const BREAK_MAIN     = 0x00000001;
export const BREAK_INT1     = 0x00000002;
export const BREAK_INT2     = 0x00000004;
export const BREAK_INT3     = 0x00000008;
export const BREAK_DEBUG    = 0x00000010;
export const BREAK_INT1E    = 0x00000020;
export const BREAK_INT2E    = 0x00000040;
export const BREAK_INT3E    = 0x00000080;
export const BREAK_INIT     = 0x00000100;
export const BREAK_EVENT    = 0x00000200;
export const BREAK_ADDR     = 0x00000400;
export const BREAK_STALL    = 0x00000800;

/** Mask to "clear all but INIT" — used by BREAK button (§7.2 Pascal line 856). */
export const KEEP_INIT_MASK = BREAK_INIT;
/** Mask to "clear bit 4 (DEBUG)" — used by right-click toggles on single-step bits. */
export const CLEAR_DEBUG_MASK = 0xFFFFFFEF;
/** Mask to "keep only bits 4 and 8" — DEBUG's mutual-exclusion mask. */
export const KEEP_INIT_OR_DEBUG_MASK = BREAK_INIT | BREAK_DEBUG;

// ============================================================================
// Repeat-mode throttling (§4.4)
// ============================================================================

/** If less than this many ms since last Go, send StallCmd instead (20 Hz cap). */
export const REPEAT_THROTTLE_MS = 50;
/** After this long without a new break, dim the display and show "Break". */
export const BREAKPOINT_TIMEOUT_MS = 250;

// ============================================================================
// Pascal panel grid layout (§5.5) — columns (charWidth=8) × half-rows (8 px)
// ============================================================================

export const PANEL = {
  REGMAP: { l: 2,   t: 1,  w: 9,  h: 75 },
  LUTMAP: { l: 13,  t: 1,  w: 9,  h: 75 },
  CF:     { l: 24,  t: 1,  w: 3,  h: 2  },
  ZF:     { l: 29,  t: 1,  w: 3,  h: 2  },
  PC:     { l: 34,  t: 1,  w: 8,  h: 2  },
  SKIP:   { l: 44,  t: 1,  w: 41, h: 2  },
  XBYTE:  { l: 87,  t: 1,  w: 12, h: 2  },
  CT:     { l: 101, t: 1,  w: 20, h: 2  },
  DIS:    { l: 24,  t: 4,  w: 56, h: 32 },
  WATCH:  { l: 82,  t: 4,  w: 12, h: 32 },
  SFR:    { l: 96,  t: 4,  w: 18, h: 32 },
  EVENT:  { l: 116, t: 4,  w: 5,  h: 32 },
  EXEC:   { l: 24,  t: 35, w: 4,  h: 4  },
  STACK:  { l: 30,  t: 37, w: 77, h: 2  },
  INT:    { l: 24,  t: 40, w: 13, h: 6  },
  PTR:    { l: 39,  t: 40, w: 68, h: 6  },
  STATUS: { l: 24,  t: 47, w: 6,  h: 6  },
  PIN:    { l: 32,  t: 47, w: 75, h: 6  },
  SMART:  { l: 24,  t: 54, w: 97, h: 2  },
  HUB:    { l: 24,  t: 57, w: 97, h: 16 },
  HINT:   { l: 29,  t: 74, w: 92, h: 2  },
  B:      { l: 109, t: 37, w: 12, h: 16 }
} as const;

/** Bitmap pixel dimensions — grid width × 8, grid half-rows × 8. */
export const BITMAP_WIDTH_PX  = 123 * 8;   // 984
export const BITMAP_HEIGHT_PX = 77 * 8;    // 616
export const CHAR_WIDTH_PX    = 8;
export const HALF_ROW_PX      = 8;
export const CHAR_HEIGHT_PX   = 16;        // full row = 2 half-rows

// ============================================================================
// Button sub-grid positions (DebuggerUnit.pas lines 137-149)
// Pascal uses fractional offsets q1=1/4, q3=3/4 char. We store as pixel offsets.
// ============================================================================

const Q1_PX = 2; // 1/4 char = 2 px when charWidth=8
const Q3_PX = 6; // 3/4 char = 6 px

/**
 * Button position in pixels relative to the canvas origin. Each button
 * rectangle for hit-testing / drawing:
 *   x:      PANEL.B.l * CHAR_WIDTH_PX + xOffsetPx
 *   y:      PANEL.B.t * HALF_ROW_PX   + yOffsetPx
 *   width:  wCells     * CHAR_WIDTH_PX
 *   height: hHalfRows  * HALF_ROW_PX
 */
export interface ButtonSpec {
  name: string;
  xOffsetPx: number; // offset from panel B's left edge
  yOffsetPx: number; // offset from panel B's top edge
  wCells: number;    // width in character columns
  hHalfRows: number; // height in half-rows
}

export const BUTTONS: readonly ButtonSpec[] = [
  // Left column: bBREAKl = Bl+q3 (8 cols * 0 + q3 px), width 5 cells, height 2 half-rows
  { name: 'BREAK', xOffsetPx: Q3_PX,         yOffsetPx: 0  * HALF_ROW_PX + Q1_PX, wCells: 5, hHalfRows: 2 },
  { name: 'ADDR',  xOffsetPx: Q3_PX,         yOffsetPx: 2  * HALF_ROW_PX + Q1_PX, wCells: 5, hHalfRows: 2 },
  { name: 'INT3E', xOffsetPx: Q3_PX,         yOffsetPx: 4  * HALF_ROW_PX + Q1_PX, wCells: 5, hHalfRows: 2 },
  { name: 'INT2E', xOffsetPx: Q3_PX,         yOffsetPx: 6  * HALF_ROW_PX + Q1_PX, wCells: 5, hHalfRows: 2 },
  { name: 'INT1E', xOffsetPx: Q3_PX,         yOffsetPx: 8  * HALF_ROW_PX + Q1_PX, wCells: 5, hHalfRows: 2 },
  { name: 'DEBUG', xOffsetPx: Q3_PX,         yOffsetPx: 10 * HALF_ROW_PX + Q1_PX, wCells: 5, hHalfRows: 2 },
  // Right column: bINITl = Bl+7+q1
  { name: 'INIT',  xOffsetPx: 7 * CHAR_WIDTH_PX + Q1_PX, yOffsetPx: 0  * HALF_ROW_PX + Q1_PX, wCells: 4, hHalfRows: 2 },
  { name: 'EVENT', xOffsetPx: 7 * CHAR_WIDTH_PX + Q1_PX, yOffsetPx: 2  * HALF_ROW_PX + Q1_PX, wCells: 4, hHalfRows: 2 },
  { name: 'INT3',  xOffsetPx: 7 * CHAR_WIDTH_PX + Q1_PX, yOffsetPx: 4  * HALF_ROW_PX + Q1_PX, wCells: 4, hHalfRows: 2 },
  { name: 'INT2',  xOffsetPx: 7 * CHAR_WIDTH_PX + Q1_PX, yOffsetPx: 6  * HALF_ROW_PX + Q1_PX, wCells: 4, hHalfRows: 2 },
  { name: 'INT1',  xOffsetPx: 7 * CHAR_WIDTH_PX + Q1_PX, yOffsetPx: 8  * HALF_ROW_PX + Q1_PX, wCells: 4, hHalfRows: 2 },
  { name: 'MAIN',  xOffsetPx: 7 * CHAR_WIDTH_PX + Q1_PX, yOffsetPx: 10 * HALF_ROW_PX + Q1_PX, wCells: 4, hHalfRows: 2 },
  // GO spans both columns: bGOl = Bl+1, bGOt = Bt+13, width 10, height 2
  { name: 'GO',    xOffsetPx: 1 * CHAR_WIDTH_PX,         yOffsetPx: 13 * HALF_ROW_PX,         wCells: 10, hHalfRows: 2 }
] as const;

// ============================================================================
// Pascal color scheme (§5.6 / DebuggerUnit.pas lines 84-105) — 0xRRGGBB
// ============================================================================

export const COLOR = {
  cBackground:     0x000000,
  cBox:            0x1F1F00, // primary box
  cBox2:           0x001F00, // secondary box (disassembly, hint)
  cBox3:           0x7F3F00, // tertiary box (CT)
  cData:           0xFFFFFF,
  cData2:          0x007F00,
  cDataDim:        0x0F0F00,
  cIndicator:      0xFF7F00, // active status orange
  cName:           0xFFFF00, // label yellow
  cHighSame:       0x3F3F00, // heatmap: high bit, unchanged
  cLowSame:        0x0F0F00,
  cHighDiff:       0xFFFF00, // heatmap: high bit, changed
  cLowDiff:        0x7F7F00,
  cModeButton:     0x7F7F00, // active mode button bg
  cModeText:       0xFFFFFF,
  cModeButtonDim:  0x3F3F00,
  cModeTextDim:    0x0F0F00,
  cCmdButton:      0xBF5F00, // Go button bg
  cCmdText:        0xFFFFFF,
  cCmdButtonDim:   0x3F1F00,
  cCmdTextDim:     0x1F0F00
} as const;

// ============================================================================
// SFR register names — addresses 0x1F0..0x1FF in display order (§6.8)
// ============================================================================

export const SFR_NAMES = [
  'IJMP3', 'IRET3', 'IJMP2', 'IRET2', 'IJMP1', 'IRET1', '   PA', '   PB',
  ' PTRA', ' PTRB', ' DIRA', ' DIRB', ' OUTA', ' OUTB', '  INA', '  INB'
] as const;

// ============================================================================
// Event names — indices 0..15 (§6.9)
// ============================================================================

export const EVENT_NAMES = [
  'INT', 'CT1', 'CT2', 'CT3', 'SE1', 'SE2', 'SE3', 'SE4',
  'PAT', 'FBW', 'XMT', 'XFI', 'XRO', 'XRL', 'ATN', 'QMT'
] as const;

// ============================================================================
// Execution mode names (§6.10)
// ============================================================================

export const EXEC_MODE_NAMES = ['MAIN', 'INT1', 'INT2', 'INT3'] as const;

// ============================================================================
// ROM debug disassembly strings for cog addresses 0x1F8..0x1FF (§11.5)
// ============================================================================

export const ROM_DEBUG_STRINGS = [
  "setq    #$F     'DEBUG Entry",
  'wrlong  0,#$FFF80-cog<<7',
  "setq    #$F",
  'rdlong  0,#$FFFC0-cog<<7',
  'jmp     #\\0',
  "setq    #$F     'DEBUG Exit",
  'rdlong  0,#$FFF80-cog<<7',
  'reti0'
] as const;
