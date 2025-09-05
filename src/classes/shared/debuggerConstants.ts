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
 * Initial 20-long message indices from P2 to Debugger
 * Reference: DEBUGGER_IMPLEMENTATION.md lines 81-102
 */
export const enum DebuggerMessageIndex {
  mCOGN = 0,  // COG number
  mBRKS = 1,  // Break status
  mSTAS = 2,  // Stack A start
  mSTBS = 3,  // Stack B start
  mCALL = 4,  // Call depth
  mPC = 5,    // Program Counter
  mSKIP = 6,  // Skip pattern
  mREGA = 7,  // Register A
  mREGB = 8,  // Register B
  mPTRA = 9,  // Pointer A
  mPTRB = 10, // Pointer B
  mDIRA = 11, // Direction A
  mDIRB = 12, // Direction B
  mOUTA = 13, // Output A
  mOUTB = 14, // Output B
  mINA = 15,  // Input A
  mINB = 16,  // Input B
  mFLAG = 17, // Flags
  mIJMP = 18, // Interrupt jump
  mCOND = 19  // Condition codes
}

// ============================================================================
// Memory Block Sizes
// ============================================================================

/**
 * Memory block sizes for caching and transfer
 */
export const MEMORY_CONSTANTS = {
  // COG/LUT memory
  COG_BLOCK_SIZE: 16,     // 16 longs per block
  COG_BLOCKS: 64,         // 64 blocks total (1024 longs / 16)
  LUT_BLOCK_SIZE: 16,     // 16 longs per block
  LUT_BLOCKS: 64,         // 64 blocks total (1024 longs / 16)
  
  // HUB memory
  HUB_BLOCK_SIZE: 4096,   // 4KB blocks
  HUB_BLOCKS: 124,        // 124 blocks for 496KB
  HUB_SUB_BLOCK_SIZE: 128, // 128-byte sub-blocks for granular updates
  
  // Total memory sizes
  COG_MEMORY_SIZE: 1024,  // 1024 longs (4KB)
  LUT_MEMORY_SIZE: 1024,  // 1024 longs (4KB)
  HUB_MEMORY_SIZE: 507904 // 496KB
} as const;

// ============================================================================
// Command Constants
// ============================================================================

/**
 * Debugger command constants
 */
export const DEBUG_COMMANDS = {
  STALL_CMD: 0x00000800,  // Stall command
  BREAK_CMD: 0x00001000,  // Break command
  INIT_CMD: 0x00002000,   // Initialize command
  GO_CMD: 0x00004000,     // Go/Resume command
  
  // Request types
  REQUEST_COG: 0x01,      // Request COG memory block
  REQUEST_LUT: 0x02,      // Request LUT memory block
  REQUEST_HUB: 0x03,      // Request HUB memory block
  REQUEST_COGBRK: 0x04,   // Request COG break status
  
  // Response markers
  RESPONSE_DATA: 0x80,    // Data response marker
  RESPONSE_ACK: 0x81,     // Acknowledge marker
  RESPONSE_NAK: 0x82      // Not acknowledge marker
} as const;

// ============================================================================
// Display Layout Constants
// ============================================================================

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
export interface DebuggerInitialMessage {
  cogNumber: number;      // COG ID (0-7)
  breakStatus: number;    // Break/stall status
  stackAStart: number;    // Stack A start address
  stackBStart: number;    // Stack B start address
  callDepth: number;      // Call stack depth
  programCounter: number; // Current PC
  skipPattern: number;    // SKIP instruction pattern
  registerA: number;      // REGA value
  registerB: number;      // REGB value
  pointerA: number;       // PTRA value
  pointerB: number;       // PTRB value
  directionA: number;     // DIRA value
  directionB: number;     // DIRB value
  outputA: number;        // OUTA value
  outputB: number;        // OUTB value
  inputA: number;         // INA value
  inputB: number;         // INB value
  flags: number;          // Status flags
  interruptJump: number;  // Interrupt jump address
  conditionCodes: number; // Condition code flags
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
export function parseInitialMessage(data: Uint32Array): DebuggerInitialMessage {
  if (data.length < 20) {
    throw new Error('Invalid message length');
  }
  
  return {
    cogNumber: data[DebuggerMessageIndex.mCOGN],
    breakStatus: data[DebuggerMessageIndex.mBRKS],
    stackAStart: data[DebuggerMessageIndex.mSTAS],
    stackBStart: data[DebuggerMessageIndex.mSTBS],
    callDepth: data[DebuggerMessageIndex.mCALL],
    programCounter: data[DebuggerMessageIndex.mPC],
    skipPattern: data[DebuggerMessageIndex.mSKIP],
    registerA: data[DebuggerMessageIndex.mREGA],
    registerB: data[DebuggerMessageIndex.mREGB],
    pointerA: data[DebuggerMessageIndex.mPTRA],
    pointerB: data[DebuggerMessageIndex.mPTRB],
    directionA: data[DebuggerMessageIndex.mDIRA],
    directionB: data[DebuggerMessageIndex.mDIRB],
    outputA: data[DebuggerMessageIndex.mOUTA],
    outputB: data[DebuggerMessageIndex.mOUTB],
    inputA: data[DebuggerMessageIndex.mINA],
    inputB: data[DebuggerMessageIndex.mINB],
    flags: data[DebuggerMessageIndex.mFLAG],
    interruptJump: data[DebuggerMessageIndex.mIJMP],
    conditionCodes: data[DebuggerMessageIndex.mCOND]
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