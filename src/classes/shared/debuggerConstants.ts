/** @format */

// src/classes/shared/debuggerConstants.ts

/**
 * Debugger constants and message formats from Pascal implementation
 * Based on DebuggerUnit.pas from P2_PNut_Public
 */

// ============================================================================
// 20-Long Message Format Constants (mCOGN through mCOND)
// ============================================================================

/**
 * 20-Long Debugger Message Structure (P2 → PC)
 * Source: DebuggerUnit.pas lines 10-29
 *
 * This is the 80-byte (20 longs) message sent from P2 during debug break.
 * Each index represents a 32-bit long value at that offset.
 */
export const enum DebuggerMessageIndex {
  mCOGN = 0,   // COG number (0-7)
  mBRKCZ = 1,  // Break CZ flags + status bits (see BRKCZ_* constants)
  mBRKC = 2,   // Break C flags: events[15:0], xbyte[24:16], skipf[27], call_depth[31:28]
  mBRKZ = 3,   // Break Z flags: skip pattern (32 bits - which instructions to skip)
  mCTH2 = 4,   // CT counter high word
  mCTL2 = 5,   // CT counter low word
  mSTK0 = 6,   // Stack level 0 (most recent)
  mSTK1 = 7,   // Stack level 1
  mSTK2 = 8,   // Stack level 2
  mSTK3 = 9,   // Stack level 3
  mSTK4 = 10,  // Stack level 4
  mSTK5 = 11,  // Stack level 5
  mSTK6 = 12,  // Stack level 6
  mSTK7 = 13,  // Stack level 7 (oldest)
  mIRET = 14,  // Interrupt return address = PROGRAM COUNTER (PC & $FFFFF)
  mFPTR = 15,  // FIFO pointer for RD/WR file operations
  mPTRA = 16,  // PTRA pointer value
  mPTRB = 17,  // PTRB pointer value
  mFREQ = 18,  // Frequency/timing value
  mCOND = 19   // Condition codes
}

/**
 * Bit field constants for mBRKCZ (index 1)
 * Source: DebuggerUnit.pas usage patterns
 */
export const BRKCZ_BITS = {
  STALLI: 1,        // Bit 1: STALLI indicator
  EXEC_MODE_SHIFT: 2, // Bits 2-3, 4-5, 6-7: Execution mode (ExecMode = bits>>2 & 3, or >>4 & 3, or >>6 & 3)
  RFWF: 20,         // Bit 20: RFxx/WFxx mode (1=write, 0=read)
  STR: 21,          // Bit 21: STR indicator
  MOD: 22,          // Bit 22: MOD indicator
  INIT: 23          // Bit 23: INIT indicator
} as const;

/**
 * Bit field constants for mBRKC (index 2)
 * Source: DebuggerUnit.pas line 1417, 1427, 1434, 1458
 */
export const BRKC_BITS = {
  EVENTS_MASK: 0xFFFF,    // Bits 0-15: Event flags (16 events)
  XBYTE_SHIFT: 16,        // Bits 16-24: XBYTE value (9 bits)
  XBYTE_MASK: 0x1FF,
  XBYTE_ACTIVE: 25,       // Bit 25: XBYTE active indicator
  LUTS: 26,               // Bit 26: LUTS indicator
  SKIPF: 27,              // Bit 27: SKIPF mode (vs SKIP)
  CALL_DEPTH_SHIFT: 28,   // Bits 28-31: Call depth (4 bits)
  CALL_DEPTH_MASK: 0xF
} as const;

// ============================================================================
// Memory Block Sizes
// ============================================================================

/**
 * Memory block sizes for caching and transfer
 * Based on Pascal DebuggerUnit.pas lines 188-197
 *
 * Pascal uses combined COG+LUT (CogSize = $400 = 1024 longs total):
 * - CogBlockSize = $10 (16 longs per block)
 * - CogBlocks = 64 (covering $000-$3FF)
 * - CogImage[0..$3FF] is one contiguous array
 *
 * For TypeScript, we keep COG and LUT conceptually separate but
 * the CRC system uses 64 combined blocks for both.
 */
export const MEMORY_CONSTANTS = {
  // Combined COG+LUT memory (Pascal: CogSize, CogBlockSize, CogBlocks)
  // The CRC system treats COG($000-$1FF) + LUT($200-$3FF) as one array
  COG_LUT_SIZE: 0x400,        // $400 = 1024 longs (combined COG + LUT)
  COG_BLOCK_SIZE: 0x10,       // $10 = 16 longs per CRC block (used for both COG and LUT)
  COG_BLOCKS: 64,             // 64 blocks total covering both COG and LUT (1024 / 16)

  // Individual region sizes (for display and separate iteration)
  COG_MEMORY_SIZE: 512,       // $000-$1FF = 512 longs (COG registers only)
  LUT_MEMORY_SIZE: 512,       // $200-$3FF = 512 longs (LUT RAM only)
  COG_ONLY_BLOCKS: 32,        // First 32 blocks for COG ($000-$1FF)
  LUT_ONLY_BLOCKS: 32,        // Last 32 blocks for LUT ($200-$3FF)

  // HUB memory (Pascal: HubSize, HubBlockSize, HubBlocks, HubSubBlockSize)
  HUB_SIZE: 0x7C000,          // $7C000 = 507,904 bytes (non-protected region)
  HUB_BLOCK_SIZE: 0x1000,     // $1000 = 4096 bytes per checksum block
  HUB_BLOCKS: 124,            // 124 blocks (507904 / 4096)
  HUB_SUB_BLOCK_SIZE: 0x80,   // $80 = 128 bytes per sub-block
  HUB_SUB_BLOCKS: 3968,       // 507904 / 128 = 3968 sub-blocks
  HUB_BLOCK_RATIO: 32,        // 4096 / 128 = 32 sub-blocks per block

  // Hub map display dimensions
  HUB_MAP_WIDTH: 64,          // 64 columns in mini-map
  HUB_MAP_HEIGHT: 62          // 3968 / 64 = 62 rows
} as const;

// ============================================================================
// Command Constants
// ============================================================================

/**
 * Debugger command constants - matching Pascal DebuggerUnit.pas
 * StallCmd ($800) is sent to hold at current breakpoint
 * BreakValue is built from bits below and sent to continue/step
 */
export const DEBUG_COMMANDS = {
  // Primary command value - holds execution at breakpoint
  STALL_CMD: 0x00000800,  // StallCmd = $00000800 (Pascal line 181)

  // BreakValue bits (Pascal lines 757-856)
  // Low 4 bits select break condition
  BREAK_MAIN: 0x00000001,   // Break on DEBUG statement (bit 0)
  BREAK_INT1: 0x00000002,   // Break on INT1 (bit 1)
  BREAK_INT2: 0x00000004,   // Break on INT2 (bit 2)
  BREAK_INT3: 0x00000008,   // Break on INT3 (bit 3)
  BREAK_DEBUG: 0x00000010,  // Break on DEBUG opcode (bit 4)
  BREAK_INT1E: 0x00000020,  // Break on INT1 event (bit 5)
  BREAK_INT2E: 0x00000040,  // Break on INT2 event (bit 6)
  BREAK_INT3E: 0x00000080,  // Break on INT3 event (bit 7)
  BREAK_INIT: 0x00000100,   // Break on COGINIT (bit 8) - also enables async break
  BREAK_EVENT: 0x00000200,  // Break on specific event (bit 9), event ID in bits 12-15
  BREAK_ADDR: 0x00000400,   // Break on address match (bit 10), address in bits 12-31

  // Masks for BreakValue manipulation
  BREAK_KEEP_INIT: 0x00000100,  // Mask to preserve INIT bit
  BREAK_CLEAR_ADDR: 0x00000BFF, // Mask to clear address break
  BREAK_CLEAR_EVENT: 0x00000DEF, // Mask to clear event break

  // Request types (not used in basic protocol)
  REQUEST_COG: 0x01,      // Request COG memory block
  REQUEST_LUT: 0x02,      // Request LUT memory block
  REQUEST_HUB: 0x03,      // Request HUB memory block
  REQUEST_COGBRK: 0x04,   // Request COG break status

  // Response markers (not used in basic protocol)
  RESPONSE_DATA: 0x80,    // Data response marker
  RESPONSE_ACK: 0x81,     // Acknowledge marker
  RESPONSE_NAK: 0x82      // Not acknowledge marker
} as const;

// ============================================================================
// Display Layout Constants
// ============================================================================

/**
 * Special Function Register names (addresses $1F0-$1FF)
 * From DebuggerUnit.pas lines 168-171
 */
export const SFR_NAMES = [
  'IJMP3', 'IRET3', 'IJMP2', 'IRET2', 'IJMP1', 'IRET1',  // Interrupt vectors
  '   PA', '   PB', ' PTRA', ' PTRB',                    // Pointer registers
  ' DIRA', ' DIRB', ' OUTA', ' OUTB', '  INA', '  INB'   // I/O port registers
] as const;

/**
 * Event names (16 events from mBRKC bits 0-15)
 * From DebuggerUnit.pas lines 165-166
 */
export const EVENT_NAMES = [
  'INT', 'CT1', 'CT2', 'CT3', 'SE1', 'SE2', 'SE3', 'SE4',
  'PAT', 'FBW', 'XMT', 'XFI', 'XRO', 'XRL', 'ATN', 'QMT'
] as const;

/**
 * Execution mode names
 * From DebuggerUnit.pas context
 */
export const MODE_NAMES = ['MAIN', 'INT1', 'INT2', 'INT3'] as const;

/**
 * Pascal Layout Constants from DebuggerUnit.pas lines 114-134
 * These define the exact positions and sizes for all debugger window regions
 * l=left, t=top, w=width, h=height (in character cells)
 */
export const PASCAL_LAYOUT_CONSTANTS = {
  // Register maps
  REGMAP: { l: 2, t: 1, w: 9, h: 75 },      // COG registers
  LUTMAP: { l: 13, t: 1, w: 9, h: 75 },     // LUT registers
  
  // Flags and status
  CF: { l: 24, t: 1, w: 3, h: 2 },          // C flag
  ZF: { l: 29, t: 1, w: 3, h: 2 },          // Z flag
  PC: { l: 34, t: 1, w: 8, h: 2 },          // Program Counter
  SKIP: { l: 44, t: 1, w: 41, h: 2 },       // SKIP/SKIPF pattern
  XBYTE: { l: 87, t: 1, w: 12, h: 2 },      // XBYTE indicator
  CT: { l: 101, t: 1, w: 20, h: 2 },        // CT counter
  
  // Main display regions
  DIS: { l: 24, t: 4, w: 56, h: 32 },       // Disassembly
  WATCH: { l: 82, t: 4, w: 12, h: 32 },     // Register Watch
  SFR: { l: 96, t: 4, w: 18, h: 32 },       // Special Function Registers
  EVENT: { l: 116, t: 4, w: 5, h: 32 },     // Events
  
  // Execution and stack
  EXEC: { l: 24, t: 35, w: 4, h: 4 },       // Execution state
  STACK: { l: 30, t: 37, w: 77, h: 2 },     // Stack
  
  // Interrupts and pointers
  INT: { l: 24, t: 40, w: 13, h: 6 },       // Interrupts (INT1/2/3)
  PTR: { l: 39, t: 40, w: 68, h: 6 },       // Pointers (PTRA/PTRB)
  
  // Status and pins
  STATUS: { l: 24, t: 47, w: 6, h: 6 },     // Status box
  PIN: { l: 32, t: 47, w: 75, h: 6 },       // Pins (DIR/OUT/IN)
  
  // Smart pins and memory
  SMART: { l: 24, t: 54, w: 97, h: 2 },     // Smart Pins
  HUB: { l: 24, t: 57, w: 97, h: 16 },      // HUB Memory
  HINT: { l: 29, t: 74, w: 92, h: 2 },      // Hint line
  
  // Button panel
  B: { l: 109, t: 37, w: 12, h: 16 },       // Button panel container
} as const;

/**
 * Debugger window layout constants
 */
export const LAYOUT_CONSTANTS = {
  // Character grid
  GRID_WIDTH: 123,        // Characters wide
  GRID_HEIGHT: 77,        // Characters tall
  
  // Disassembly window
  DIS_LINES: 16,          // Number of disassembly lines
  DIS_START_Y: 20,        // Starting Y position
  
  // Register display
  REG_COLS: 16,           // Registers per row
  REG_ROWS: 4,            // Number of register rows
  
  // Memory display
  PTR_BYTES: 14,          // Bytes displayed for pointers
  STACK_DEPTH: 8,         // Stack display depth
  
  // Button dimensions
  BUTTON_WIDTH: 8,        // Button width in characters
  BUTTON_HEIGHT: 3,       // Button height in characters
  
  // Heat map decay
  HIT_DECAY_RATE: 2       // Heat visualization decay rate
} as const;

// ============================================================================
// Color Constants
// ============================================================================

/**
 * Color scheme matching Pascal implementation
 */
export const DEBUG_COLORS = {
  // Background colors
  BG_DEFAULT: 0x000000,   // Black
  BG_ACTIVE: 0x002040,    // Dark blue for active elements
  BG_BREAK: 0x400000,     // Dark red for breakpoints
  BG_CHANGED: 0x404000,   // Dark yellow for changed values

  // Foreground colors
  FG_DEFAULT: 0xC0C0C0,   // Silver
  FG_ACTIVE: 0x00FF00,    // Green
  FG_BREAK: 0xFF0000,     // Red
  FG_CHANGED: 0xFFFF00,   // Yellow
  FG_DIM: 0x808080,       // Gray
  FG_LABEL: 0xFFFF00,     // Yellow - for labels (cName from Pascal)
  FG_DATA: 0xFFFFFF,      // White - for data values (cData from Pascal)
  FG_WARNING: 0xFF7F00,   // Orange - for warnings/indicators
  FG_INDICATOR: 0xFF7F00, // Orange - for active indicators (cIndicator from Pascal)

  // Heat map colors (intensity levels)
  HEAT_0: 0x000000,       // Black (cold)
  HEAT_1: 0x000040,       // Very dark blue
  HEAT_2: 0x000080,       // Dark blue
  HEAT_3: 0x0000C0,       // Medium blue
  HEAT_4: 0x0040FF,       // Light blue
  HEAT_5: 0x00FF40,       // Green-blue
  HEAT_6: 0x40FF00,       // Yellow-green
  HEAT_7: 0xFFFF00,       // Yellow
  HEAT_8: 0xFF8000,       // Orange
  HEAT_9: 0xFF0000        // Red (hot)
} as const;

/**
 * Pascal ColorScheme array from DebuggerUnit.pas lines 84-105
 * These are the exact colors used in the original Pascal implementation
 */
export const PASCAL_COLOR_SCHEME = {
  // Index names match Pascal ColorScheme array comments
  cBackground: 0x000000,    // cBlack - background
  cBox: 0x1F1F00,           // cYellow4 - box borders  
  cBox2: 0x001F00,          // cGreen4 - secondary box
  cBox3: 0x7F3F00,          // cOrange2 - tertiary box
  cData: 0xFFFFFF,          // cWhite - data values
  cData2: 0x007F00,         // cGreen2 - secondary data
  cDataDim: 0x0F0F00,       // cYellow5 - dim data
  cIndicator: 0xFF7F00,     // cOrange - indicators
  cName: 0xFFFF00,          // cYellow - names/labels
  cHighSame: 0x3F3F00,      // cYellow3 - highlight same
  cLowSame: 0x0F0F00,       // cYellow5 - low intensity same
  cHighDiff: 0xFFFF00,      // cYellow - highlight different
  cLowDiff: 0x7F7F00,       // cYellow2 - low intensity different
  cModeButton: 0x7F7F00,    // cYellow2 - mode button
  cModeText: 0xFFFFFF,      // cWhite - mode text
  cModeButtonDim: 0x3F3F00, // cYellow3 - mode button dim
  cModeTextDim: 0x0F0F00,   // cYellow5 - mode text dim
  cCmdButton: 0xBF5F00,     // cOrange1 - command button
  cCmdText: 0xFFFFFF,       // cWhite - command text
  cCmdButtonDim: 0x3F1F00,  // cOrange3 - command button dim
  cCmdTextDim: 0x1F0F00     // cOrange4 - command text dim
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Initial 20-long message from P2 to Debugger
 */
/**
 * 20-long debugger message structure received from P2
 * This matches the exact layout from DebuggerUnit.pas lines 10-29
 */
export interface DebuggerInitialMessage {
  // Index 0: COG identification
  cogNumber: number;      // mCOGN - COG ID (0-7)

  // Indices 1-3: Break status flags (complex bit fields)
  breakCZ: number;        // mBRKCZ - Break CZ flags + status bits
  breakC: number;         // mBRKC - Events[15:0], XBYTE[24:16], CallDepth[31:28]
  breakZ: number;         // mBRKZ - Skip pattern (32 bits)

  // Indices 4-5: CT counter (64-bit value split into two 32-bit words)
  ctHigh: number;         // mCTH2 - CT counter high word
  ctLow: number;          // mCTL2 - CT counter low word

  // Indices 6-13: Stack (8 levels)
  stack: number[];        // mSTK0-7 - Stack levels 0-7 (array of 8)

  // Indices 14-17: Pointers and addresses
  iret: number;           // mIRET - Interrupt return = PROGRAM COUNTER (PC & $FFFFF)
  fifoPtr: number;        // mFPTR - FIFO pointer for RD/WR file operations
  ptrA: number;           // mPTRA - Pointer A value
  ptrB: number;           // mPTRB - Pointer B value

  // Indices 18-19: Frequency and condition
  freq: number;           // mFREQ - Frequency/timing value
  cond: number;           // mCOND - Condition codes

  // Derived values (extracted from bit fields for convenience)
  programCounter: number; // Extracted from iret & $FFFFF
  callDepth: number;      // Extracted from breakC >> 28 & $F
  skipPattern: number;    // Same as breakZ
  events: number;         // Extracted from breakC & $FFFF
  xbyte: number;          // Extracted from breakC >> 16 & $1FF
}

/**
 * Debugger request message to P2
 */
export interface DebuggerRequest {
  command: number;        // Command type
  cogId: number;          // Target COG (0-7)
  address?: number;       // Memory address (if applicable)
  blockIndex?: number;    // Block index for memory requests
  data?: number;          // Data value (for writes)
}

/**
 * Debugger response from P2
 */
export interface DebuggerResponse {
  responseType: number;   // Response type marker
  cogId: number;          // Source COG
  address?: number;       // Memory address
  data?: Uint32Array;     // Response data
  checksum?: number;      // Data checksum
}

/**
 * Memory block descriptor
 */
export interface MemoryBlock {
  index: number;          // Block index
  baseAddress: number;    // Starting address
  size: number;           // Block size in longs
  checksum: number;       // Current checksum
  data: Uint32Array;      // Block data
  isDirty: boolean;       // Needs refresh flag
  lastAccess: number;     // Last access timestamp
  hitCount: number;       // Access count for heat map
}

/**
 * COG state for debugger
 */
export interface COGDebugState {
  cogId: number;                      // COG ID (0-7)
  isActive: boolean;                  // COG is running
  isBreaked: boolean;                 // COG is at breakpoint
  programCounter: number;             // Current PC
  skipPattern: number;                // SKIP pattern
  callDepth: number;                  // Call stack depth
  breakpoints: Set<number>;           // Active breakpoints
  cogMemory: Map<number, MemoryBlock>; // COG memory cache
  lutMemory: Map<number, MemoryBlock>; // LUT memory cache
  lastMessage: DebuggerInitialMessage | null; // Last received message
  lastUpdateTime: number;             // Last update timestamp for this COG
}

/**
 * Global debugger state
 */
export interface DebuggerGlobalState {
  requestCOGBRK: number;              // Shared break request mask
  activeCOGs: Set<number>;            // Active COG IDs
  cogStates: Map<number, COGDebugState>; // Per-COG states
  hubMemory: Map<number, MemoryBlock>; // HUB memory cache
  isRecording: boolean;               // Recording active
  lastUpdateTime: number;             // Last update timestamp
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate checksum for memory block
 */
export function calculateChecksum(data: Uint32Array): number {
  let checksum = 0;
  for (let i = 0; i < data.length; i++) {
    checksum = (checksum + data[i]) & 0xFFFFFFFF;
    checksum = ((checksum << 1) | (checksum >>> 31)) & 0xFFFFFFFF;
  }
  return checksum;
}

/**
 * Parse initial 20-long message
 */
/**
 * Parse the 20-long debugger message from P2
 * Source: DebuggerUnit.pas message handling
 */
export function parseInitialMessage(data: Uint32Array): DebuggerInitialMessage {
  if (data.length < 20) {
    throw new Error(`Invalid message length: expected 20 longs, got ${data.length}`);
  }

  // Extract raw values using correct indices
  const breakC = data[DebuggerMessageIndex.mBRKC];
  const iret = data[DebuggerMessageIndex.mIRET];

  // Build stack array from mSTK0-7
  const stack: number[] = [];
  for (let i = 0; i < 8; i++) {
    stack.push(data[DebuggerMessageIndex.mSTK0 + i]);
  }

  return {
    // Raw message fields
    cogNumber: data[DebuggerMessageIndex.mCOGN],
    breakCZ: data[DebuggerMessageIndex.mBRKCZ],
    breakC: breakC,
    breakZ: data[DebuggerMessageIndex.mBRKZ],
    ctHigh: data[DebuggerMessageIndex.mCTH2],
    ctLow: data[DebuggerMessageIndex.mCTL2],
    stack: stack,
    iret: iret,
    fifoPtr: data[DebuggerMessageIndex.mFPTR],
    ptrA: data[DebuggerMessageIndex.mPTRA],
    ptrB: data[DebuggerMessageIndex.mPTRB],
    freq: data[DebuggerMessageIndex.mFREQ],
    cond: data[DebuggerMessageIndex.mCOND],

    // Derived convenience values
    programCounter: iret & 0xFFFFF,  // PC is in lower 20 bits of IRET
    callDepth: (breakC >>> BRKC_BITS.CALL_DEPTH_SHIFT) & BRKC_BITS.CALL_DEPTH_MASK,
    skipPattern: data[DebuggerMessageIndex.mBRKZ],
    events: breakC & BRKC_BITS.EVENTS_MASK,
    xbyte: (breakC >>> BRKC_BITS.XBYTE_SHIFT) & BRKC_BITS.XBYTE_MASK
  };
}

/**
 * Create a memory block
 */
export function createMemoryBlock(index: number, baseAddress: number, size: number): MemoryBlock {
  return {
    index,
    baseAddress,
    size,
    checksum: 0,
    data: new Uint32Array(size),
    isDirty: true,
    lastAccess: Date.now(),
    hitCount: 0
  };
}

/**
 * Get heat color based on hit count
 */
export function getHeatColor(hitCount: number): number {
  const heatColors = [
    DEBUG_COLORS.HEAT_0,
    DEBUG_COLORS.HEAT_1,
    DEBUG_COLORS.HEAT_2,
    DEBUG_COLORS.HEAT_3,
    DEBUG_COLORS.HEAT_4,
    DEBUG_COLORS.HEAT_5,
    DEBUG_COLORS.HEAT_6,
    DEBUG_COLORS.HEAT_7,
    DEBUG_COLORS.HEAT_8,
    DEBUG_COLORS.HEAT_9
  ];
  
  const index = Math.min(Math.floor(hitCount / 10), heatColors.length - 1);
  return heatColors[index];
}

/**
 * Decay heat value for visualization
 */
export function decayHeat(hitCount: number): number {
  return Math.max(0, hitCount - LAYOUT_CONSTANTS.HIT_DECAY_RATE);
}

/**
 * Blend two colors based on alpha value
 * Pascal BlendPixel algorithm: result = (a * (255-alpha) + b * alpha) / 255
 * @param colorA First color (shown when alpha=0)
 * @param colorB Second color (shown when alpha=255)
 * @param alpha Blend factor 0-255 (0=colorA, 255=colorB)
 * @returns Blended color as 0xRRGGBB
 */
export function blendColors(colorA: number, colorB: number, alpha: number): number {
  const notAlpha = 255 - alpha;

  // Extract and blend each channel
  const rA = (colorA >> 16) & 0xFF;
  const gA = (colorA >> 8) & 0xFF;
  const bA = colorA & 0xFF;

  const rB = (colorB >> 16) & 0xFF;
  const gB = (colorB >> 8) & 0xFF;
  const bB = colorB & 0xFF;

  const r = Math.min(255, ((rA * notAlpha + rB * alpha + 127) / 255) | 0);
  const g = Math.min(255, ((gA * notAlpha + gB * alpha + 127) / 255) | 0);
  const b = Math.min(255, ((bA * notAlpha + bB * alpha + 127) / 255) | 0);

  return (r << 16) | (g << 8) | b;
}

/**
 * Get heat-based color for COG/LUT register visualization
 * Pascal uses cHighSame/cLowSame (when no change) vs cHighDiff/cLowDiff (when changed)
 * blended based on heat value
 * @param bitSet Whether the bit is set (1) or clear (0)
 * @param heat Heat value 0-255 (higher = more recently changed)
 * @returns Color value as 0xRRGGBB
 */
export function getRegisterHeatColor(bitSet: boolean, heat: number): number {
  // Select base colors based on bit state
  const cSame = bitSet ? PASCAL_COLOR_SCHEME.cHighSame : PASCAL_COLOR_SCHEME.cLowSame;
  const cDiff = bitSet ? PASCAL_COLOR_SCHEME.cHighDiff : PASCAL_COLOR_SCHEME.cLowDiff;

  // Blend between same and diff colors based on heat
  return blendColors(cSame, cDiff, heat);
}