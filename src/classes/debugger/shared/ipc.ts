/** @format */

/**
 * IPC contract between the main process and the renderer-side debugger bundle.
 *
 * Rules:
 *   - Data-only. No JS source code is ever shipped across the IPC boundary.
 *   - Envelope is a discriminated union on `kind`; every new message adds a new
 *     variant. Both sides must switch-case exhaustively.
 *   - Binary payloads travel as `Uint8Array`; Electron's structured clone
 *     handles these without a JSON round-trip.
 */

// ============================================================================
// Main → Renderer
// ============================================================================

/**
 * Sent once per window, right after did-finish-load. Tells the renderer
 * which cog it is rendering and gives it a stable window ID for logging.
 */
export interface MainToRendererInitialize {
  kind: 'initialize';
  cogId: number;                 // 0..7
  windowId: string;              // e.g. "debugger-0-1766700245078"
  initialBreakCond: number;      // _brkcond_ patched into the binary (0x001 or 0x110)
  debugBaud: number;             // for CT elapsed-time calculation
}

/**
 * Phase 1 packet from the P2 — 456 bytes:
 *   80 bytes : 20-long debugger message (mCOGN..mCOND)
 *  128 bytes : 64 16-bit CRC words (cog + LUT, 16 registers per block)
 *  248 bytes : 124 16-bit hub checksum words (4 KB per block)
 *
 * There is NO 416-byte variant. The debugger kernel is fixed Parallax Spin2
 * (`Spin2_debugger.spin2` `bp_handler`), so the size is compiler-independent:
 * 20 longs + 64 CRC words + 124 hub words, and DebuggerUnit.pas `Breakpoint`
 * agrees (HubBlocks = $7C000/$1000 = 124). Proven on a hardware capture during
 * the comms re-frame sprint §5 — the smart-pin tail of every steady-state break
 * aligns on the next break only at 456. The earlier 416/104 belief mis-aligned
 * every Phase-3 by 40 bytes. See `debugger/shared/constants.ts`.
 */
export interface MainToRendererPhase1 {
  kind: 'phase1';
  bytes: Uint8Array;             // length === 456 (PHASE1_SIZE)
}

/**
 * Phase 3 data from the P2. Variable length, parsed by the renderer
 * based on which blocks it had requested in Phase 2.
 */
export interface MainToRendererPhase3 {
  kind: 'phase3';
  bytes: Uint8Array;
}

/**
 * DTR or RTS reset fired. All per-cog state should be invalidated so the
 * next Phase 1 is treated as a "first break".
 */
export interface MainToRendererReset {
  kind: 'reset';
}

/**
 * Another debugger window asked for a COGBRK. The main process broadcasts
 * the combined mask to every renderer so each can include it in its next
 * Phase 2 reply (whoever sends next wins the serial line).
 */
export interface MainToRendererCogBrkBroadcast {
  kind: 'cogBrkBroadcast';
  mask: number;                  // bit N = break cog N
}

export type MainToRendererMessage =
  | MainToRendererInitialize
  | MainToRendererPhase1
  | MainToRendererPhase3
  | MainToRendererReset
  | MainToRendererCogBrkBroadcast;

// ============================================================================
// Renderer → Main
// ============================================================================

/**
 * Phase 2 reply — exactly 52 bytes:
 *    8 bytes : COG/LUT block-request bitmap (64 bits packed LSB-first)
 *   16 bytes : Hub block-request bitmap (128 bits, only 124 used)
 *    4 bytes : Disassembly read (size<<20 | address); zero if none
 *    4 bytes : FPTR pointer window read
 *    4 bytes : PTRA pointer window read
 *    4 bytes : PTRB pointer window read
 *    4 bytes : Hub data viewer read
 *    4 bytes : COGBRK mask
 *    4 bytes : STALL/BRK command (0x800 to hold, or BreakValue to run)
 */
export interface RendererToMainPhase2 {
  kind: 'phase2';
  bytes: Uint8Array;             // length === 52
}

/**
 * User in this cog's window requested an async break on some set of cogs.
 * Main process ORs this into the global mask and broadcasts it to all
 * open debugger windows.
 */
export interface RendererToMainSetCogBrk {
  kind: 'setCogBrk';
  mask: number;
}

/**
 * Pass a log line through to the main-process logger (so it shows up in
 * the same debug_*.log file that everyone else uses).
 */
export interface RendererToMainLog {
  kind: 'log';
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
}

/**
 * Renderer declares it is fully wired up and ready to receive data. The
 * main process can now drain any buffered Phase 1/3 packets.
 */
export interface RendererToMainReady {
  kind: 'ready';
}

/**
 * Renderer has finished parsing all Phase 3 bytes. Main can now expect
 * the next 456-byte chunk to be a new Phase 1 (not a Phase 3 continuation).
 */
export interface RendererToMainPhase3Complete {
  kind: 'phase3Complete';
}

/**
 * Per-break Phase-3 fixed-size hint (§3). Fired right after this cog's
 * Phase-2 is built, carrying the exact FIXED Phase-3 byte count (changed
 * cog blocks + changed hub blocks + hub reads, EXCLUDING the self-describing
 * smart-pin tail the worker sizes itself). The main process relays this to
 * the extraction worker (§4) so its per-cog demux can delimit this break's
 * Phase-3 exactly — the worker cannot compute the optional-disasm term on its
 * own because it depends on the renderer-only `disMode`.
 */
export interface RendererToMainPhase3Size {
  kind: 'phase3Size';
  cogId: number;                 // 0..7 — which cog's Phase-3 this sizes
  size: number;                  // fixed Phase-3 byte count (excludes smart-pin tail)
}

export type RendererToMainMessage =
  | RendererToMainPhase2
  | RendererToMainSetCogBrk
  | RendererToMainLog
  | RendererToMainReady
  | RendererToMainPhase3Complete
  | RendererToMainPhase3Size;

// ============================================================================
// IPC channel names — single source of truth
// ============================================================================

export const IPC_CHANNELS = {
  /** Main → Renderer: any MainToRendererMessage */
  mainToRenderer: 'debugger:m2r',
  /** Renderer → Main: any RendererToMainMessage */
  rendererToMain: 'debugger:r2m'
} as const;
