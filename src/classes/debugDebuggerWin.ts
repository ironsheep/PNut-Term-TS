/** @format */

// src/classes/debugDebuggerWin.ts

import { BrowserWindow } from 'electron';
import { Context } from '../utils/context';
import { DebugWindowBase } from './debugWindowBase';
import { WindowRouter } from './shared/windowRouter';
import { WindowPlacer, PlacementConfig, PlacementStrategy } from '../utils/windowPlacer';
import {
  DebuggerInitialMessage,
  DebuggerMessageIndex,
  COGDebugState,
  LAYOUT_CONSTANTS,
  DEBUG_COLORS,
  DEBUG_COMMANDS,
  PASCAL_COLOR_SCHEME,
  PASCAL_LAYOUT_CONSTANTS,
  parseInitialMessage,
  createMemoryBlock
} from './shared/debuggerConstants';
import { DebuggerRenderer } from './shared/debuggerRenderer';
import { CanvasRenderer } from './shared/canvasRenderer';
import { DebuggerProtocol } from './shared/debuggerProtocol';
import { DebuggerDataManager } from './shared/debuggerDataManager';
import { DebuggerInteraction } from './shared/debuggerInteraction';
import { DebuggerResponse } from './shared/debuggerResponse';
import { DebuggerPhase3Receiver, Phase3Expectations, Phase3Data } from './shared/debuggerPhase3Receiver';
import { ExtractedMessage } from './shared/sharedMessagePool';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

/**
 * Layout region definition
 */
interface LayoutRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

/**
 * DebugDebuggerWindow - Interactive debugger window for Parallax Propeller 2 COGs
 * 
 * This window provides comprehensive debugging capabilities for P2 microcontrollers,
 * allowing real-time inspection and control of up to 8 COGs (processors).
 * 
 * Features:
 * - Step-by-step execution control (single-step, run, break)
 * - Memory inspection (COG, LUT, HUB)
 * - Register viewing and modification
 * - Disassembly with PC tracking
 * - Breakpoint management
 * - Call stack visualization
 * - Heat map visualization of memory access patterns
 * - Smart pin monitoring
 * - Interrupt and event tracking
 * 
 * Based on Pascal implementation: /pascal-source/P2_PNut_Public/DebuggerUnit.pas
 * 
 * Window Layout (123x77 character grid):
 * - Top: COG/LUT register maps with heat visualization
 * - Middle: Disassembly window (16 lines)
 * - Bottom: Control buttons, stack, pointers, pins
 * - Right: HUB memory viewer with mini-map
 */
export class DebugDebuggerWindow extends DebugWindowBase {
  private cogId: number;
  private cogState: COGDebugState;
  private currentDebuggerPacket: Uint8Array | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private charWidth: number = 8;      // Character width in pixels
  private charHeight: number = 16;    // Full character height in pixels
  private halfRowHeight: number = 8;  // Half-row height (charHeight/2) — grid Y unit
  private gridWidth: number = LAYOUT_CONSTANTS.GRID_WIDTH;
  private gridHeight: number = LAYOUT_CONSTANTS.GRID_HEIGHT;
  private isConnected: boolean = false;
  private lastUpdateTime: number = 0;
  private updateTimer: NodeJS.Timeout | null = null;
  
  // Core debugger components
  private renderer: DebuggerRenderer | null = null;
  private canvasRenderer: CanvasRenderer;
  private protocol: DebuggerProtocol | null = null;
  private dataManager: DebuggerDataManager | null = null;
  private interaction: DebuggerInteraction | null = null;
  private responseGenerator: DebuggerResponse;  // Phase 2 response generator
  private phase3Receiver: DebuggerPhase3Receiver;  // Phase 3 data receiver
  private awaitingPhase3: boolean = false;  // Flag for expecting Phase 3 data

  // Deferred messages queue for when components aren't ready
  private deferredMessages: any[] = [];
  private componentsReady: boolean = false;
  
  // Rendering state management
  private dirtyRegions: Set<string> = new Set();
  private regions: Map<string, LayoutRegion> = new Map();
  private tooltipText: string | null = null;
  private tooltipX: number = 0;
  private tooltipY: number = 0;
  private lastRenderTime: number = 0;
  private renderCount: number = 0;
  // No timer needed - using event-driven approach

  // Debug command state (Pascal: StallBrk, BreakValue, RepeatMode)
  // breakValue holds the break condition bits that control when/how debugger breaks
  // stallBrk is either STALL_CMD (hold) or breakValue (continue)
  private breakValue: number = DEBUG_COMMANDS.BREAK_DEBUG;  // Default: break on DEBUG opcode
  private stallBrk: number = DEBUG_COMMANDS.STALL_CMD;      // Start in stalled state
  private firstBreak: boolean = true;                        // First breakpoint flag
  private repeatMode: boolean = false;                       // Continuous run mode (Pascal: RepeatMode)
  private oldTickCount: number = 0;                          // Last Go command timestamp for repeat throttling
  private breakpointTimerHandle: NodeJS.Timeout | null = null; // 250ms breakpoint timeout (Pascal: BreakpointTimer)
  private isDimmed: boolean = false;                         // Display is dimmed (no breakpoint in 250ms)

  // Remove redundant queue - base class handles this via messageQueue
  // private initialMessageQueue: Uint8Array[] = [];  // REMOVED: Base class handles queuing
  // private isDebuggerReady: boolean = false;  // REMOVED: Use base class isWindowReady

  constructor(
    context: Context,
    cogId: number = 0,
    windowDetails?: {
      width?: number;
      height?: number;
      x?: number;
      y?: number;
      parent?: BrowserWindow;
    }
  ) {
    // Calculate window size based on character grid
    const width = windowDetails?.width || LAYOUT_CONSTANTS.GRID_WIDTH * 8 + 20;
    const height = windowDetails?.height || LAYOUT_CONSTANTS.GRID_HEIGHT * 8 + 40; // half-rows * 8px
    
    // Call super with windowId and windowType
    const windowId = `debugger-${cogId}`;
    super(context, windowId, 'debugger');
    
    this.cogId = cogId;
    
    // Initialize COG state (fresh on each window open - no persistence)
    this.cogState = this.createFreshCogState(cogId);
    
    // Initialize core components early (before window creation)
    // These don't depend on the DOM/window being ready
    this.dataManager = new DebuggerDataManager();
    this.canvasRenderer = new CanvasRenderer();
    this.protocol = new DebuggerProtocol();
    this.responseGenerator = new DebuggerResponse();
    this.phase3Receiver = new DebuggerPhase3Receiver();
    
    // Mark components as ready since we've created everything needed
    // for message processing (dataManager and protocol)
    this.componentsReady = true;
    this.logConsoleMessage(`[DEBUGGER] Components marked ready in constructor for COG ${cogId}`);
    
    // Initialize layout regions (based on LAYOUT_CONSTANTS)
    this.initializeRegions();
    
    this.logMessage(`DebugDebuggerWindow created for COG ${cogId}`);
    
    // Create the actual Electron window
    this.createDebugWindow(windowDetails);
  }

  /**
   * Create fresh COG state (no persistence between window opens)
   */
  private createFreshCogState(cogId: number): COGDebugState {
    const state: COGDebugState = {
      cogId,
      isActive: false,
      isBreaked: false,
      programCounter: 0,
      skipPattern: 0,
      callDepth: 0,
      breakpoints: new Set(),
      cogMemory: new Map(),
      lutMemory: new Map(),
      lastMessage: null,
      lastUpdateTime: 0
    };
    
    // Initialize memory blocks
    for (let i = 0; i < 64; i++) {
      state.cogMemory.set(i, createMemoryBlock(i, i * 16, 16));
      state.lutMemory.set(i, createMemoryBlock(i, 0x200 + i * 16, 16));
    }
    
    return state;
  }

  /**
   * Initialize layout regions using Pascal's exact layout constants
   * Based on DebuggerUnit.pas lines 114-134
   */
  private initializeRegions(): void {
    // COG Registers (REGMAP)
    this.regions.set('cogRegisters', {
      x: PASCAL_LAYOUT_CONSTANTS.REGMAP.l,
      y: PASCAL_LAYOUT_CONSTANTS.REGMAP.t,
      width: PASCAL_LAYOUT_CONSTANTS.REGMAP.w,
      height: PASCAL_LAYOUT_CONSTANTS.REGMAP.h,
      type: 'registers'
    });
    
    // LUT Registers (LUTMAP)
    this.regions.set('lutRegisters', {
      x: PASCAL_LAYOUT_CONSTANTS.LUTMAP.l,
      y: PASCAL_LAYOUT_CONSTANTS.LUTMAP.t,
      width: PASCAL_LAYOUT_CONSTANTS.LUTMAP.w,
      height: PASCAL_LAYOUT_CONSTANTS.LUTMAP.h,
      type: 'registers'
    });
    
    // C Flag
    this.regions.set('cflag', {
      x: PASCAL_LAYOUT_CONSTANTS.CF.l,
      y: PASCAL_LAYOUT_CONSTANTS.CF.t,
      width: PASCAL_LAYOUT_CONSTANTS.CF.w,
      height: PASCAL_LAYOUT_CONSTANTS.CF.h,
      type: 'flag'
    });
    
    // Z Flag
    this.regions.set('zflag', {
      x: PASCAL_LAYOUT_CONSTANTS.ZF.l,
      y: PASCAL_LAYOUT_CONSTANTS.ZF.t,
      width: PASCAL_LAYOUT_CONSTANTS.ZF.w,
      height: PASCAL_LAYOUT_CONSTANTS.ZF.h,
      type: 'flag'
    });
    
    // Program Counter
    this.regions.set('pc', {
      x: PASCAL_LAYOUT_CONSTANTS.PC.l,
      y: PASCAL_LAYOUT_CONSTANTS.PC.t,
      width: PASCAL_LAYOUT_CONSTANTS.PC.w,
      height: PASCAL_LAYOUT_CONSTANTS.PC.h,
      type: 'status'
    });
    
    // SKIP/SKIPF Pattern
    this.regions.set('skip', {
      x: PASCAL_LAYOUT_CONSTANTS.SKIP.l,
      y: PASCAL_LAYOUT_CONSTANTS.SKIP.t,
      width: PASCAL_LAYOUT_CONSTANTS.SKIP.w,
      height: PASCAL_LAYOUT_CONSTANTS.SKIP.h,
      type: 'status'
    });
    
    // Disassembly (DIS)
    this.regions.set('disassembly', {
      x: PASCAL_LAYOUT_CONSTANTS.DIS.l,
      y: PASCAL_LAYOUT_CONSTANTS.DIS.t,
      width: PASCAL_LAYOUT_CONSTANTS.DIS.w,
      height: PASCAL_LAYOUT_CONSTANTS.DIS.h,
      type: 'disassembly'
    });
    
    // Stack
    this.regions.set('stack', {
      x: PASCAL_LAYOUT_CONSTANTS.STACK.l,
      y: PASCAL_LAYOUT_CONSTANTS.STACK.t,
      width: PASCAL_LAYOUT_CONSTANTS.STACK.w,
      height: PASCAL_LAYOUT_CONSTANTS.STACK.h,
      type: 'stack'
    });
    
    // Events
    this.regions.set('events', {
      x: PASCAL_LAYOUT_CONSTANTS.EVENT.l,
      y: PASCAL_LAYOUT_CONSTANTS.EVENT.t,
      width: PASCAL_LAYOUT_CONSTANTS.EVENT.w,
      height: PASCAL_LAYOUT_CONSTANTS.EVENT.h,
      type: 'events'
    });
    
    // HUB Memory
    this.regions.set('hubMemory', {
      x: PASCAL_LAYOUT_CONSTANTS.HUB.l,
      y: PASCAL_LAYOUT_CONSTANTS.HUB.t,
      width: PASCAL_LAYOUT_CONSTANTS.HUB.w,
      height: PASCAL_LAYOUT_CONSTANTS.HUB.h,
      type: 'memory'
    });
    
    // Button panel (controls)
    this.regions.set('controls', {
      x: PASCAL_LAYOUT_CONSTANTS.B.l,
      y: PASCAL_LAYOUT_CONSTANTS.B.t,
      width: PASCAL_LAYOUT_CONSTANTS.B.w,
      height: PASCAL_LAYOUT_CONSTANTS.B.h,
      type: 'controls'
    });
    
    // XBYTE indicator
    this.regions.set('xbyte', {
      x: PASCAL_LAYOUT_CONSTANTS.XBYTE.l,
      y: PASCAL_LAYOUT_CONSTANTS.XBYTE.t,
      width: PASCAL_LAYOUT_CONSTANTS.XBYTE.w,
      height: PASCAL_LAYOUT_CONSTANTS.XBYTE.h,
      type: 'status'
    });
    
    // CT counter
    this.regions.set('ct', {
      x: PASCAL_LAYOUT_CONSTANTS.CT.l,
      y: PASCAL_LAYOUT_CONSTANTS.CT.t,
      width: PASCAL_LAYOUT_CONSTANTS.CT.w,
      height: PASCAL_LAYOUT_CONSTANTS.CT.h,
      type: 'status'
    });
    
    // Register Watch
    this.regions.set('watch', {
      x: PASCAL_LAYOUT_CONSTANTS.WATCH.l,
      y: PASCAL_LAYOUT_CONSTANTS.WATCH.t,
      width: PASCAL_LAYOUT_CONSTANTS.WATCH.w,
      height: PASCAL_LAYOUT_CONSTANTS.WATCH.h,
      type: 'watch'
    });
    
    // Special Function Registers
    this.regions.set('sfr', {
      x: PASCAL_LAYOUT_CONSTANTS.SFR.l,
      y: PASCAL_LAYOUT_CONSTANTS.SFR.t,
      width: PASCAL_LAYOUT_CONSTANTS.SFR.w,
      height: PASCAL_LAYOUT_CONSTANTS.SFR.h,
      type: 'sfr'
    });
    
    // Execution state
    this.regions.set('exec', {
      x: PASCAL_LAYOUT_CONSTANTS.EXEC.l,
      y: PASCAL_LAYOUT_CONSTANTS.EXEC.t,
      width: PASCAL_LAYOUT_CONSTANTS.EXEC.w,
      height: PASCAL_LAYOUT_CONSTANTS.EXEC.h,
      type: 'exec'
    });
    
    // Interrupts
    this.regions.set('interrupts', {
      x: PASCAL_LAYOUT_CONSTANTS.INT.l,
      y: PASCAL_LAYOUT_CONSTANTS.INT.t,
      width: PASCAL_LAYOUT_CONSTANTS.INT.w,
      height: PASCAL_LAYOUT_CONSTANTS.INT.h,
      type: 'interrupts'
    });
    
    // Pointers (PTRA/PTRB)
    this.regions.set('pointers', {
      x: PASCAL_LAYOUT_CONSTANTS.PTR.l,
      y: PASCAL_LAYOUT_CONSTANTS.PTR.t,
      width: PASCAL_LAYOUT_CONSTANTS.PTR.w,
      height: PASCAL_LAYOUT_CONSTANTS.PTR.h,
      type: 'pointers'
    });
    
    // Status box
    this.regions.set('status', {
      x: PASCAL_LAYOUT_CONSTANTS.STATUS.l,
      y: PASCAL_LAYOUT_CONSTANTS.STATUS.t,
      width: PASCAL_LAYOUT_CONSTANTS.STATUS.w,
      height: PASCAL_LAYOUT_CONSTANTS.STATUS.h,
      type: 'status'
    });
    
    // Pins (DIR/OUT/IN)
    this.regions.set('pins', {
      x: PASCAL_LAYOUT_CONSTANTS.PIN.l,
      y: PASCAL_LAYOUT_CONSTANTS.PIN.t,
      width: PASCAL_LAYOUT_CONSTANTS.PIN.w,
      height: PASCAL_LAYOUT_CONSTANTS.PIN.h,
      type: 'pins'
    });
    
    // Smart Pins
    this.regions.set('smartPins', {
      x: PASCAL_LAYOUT_CONSTANTS.SMART.l,
      y: PASCAL_LAYOUT_CONSTANTS.SMART.t,
      width: PASCAL_LAYOUT_CONSTANTS.SMART.w,
      height: PASCAL_LAYOUT_CONSTANTS.SMART.h,
      type: 'smartpins'
    });
    
    // Hint line
    this.regions.set('hint', {
      x: PASCAL_LAYOUT_CONSTANTS.HINT.l,
      y: PASCAL_LAYOUT_CONSTANTS.HINT.t,
      width: PASCAL_LAYOUT_CONSTANTS.HINT.w,
      height: PASCAL_LAYOUT_CONSTANTS.HINT.h,
      type: 'hint'
    });
  }

  /**
   * Convert grid coordinates to pixel coordinates
   */
  private gridToPixel(gridX: number, gridY: number): {x: number, y: number} {
    // Pascal grid: columns (charWidth=8px) × half-rows (charHeight/2=8px)
    // Both X and Y use 8px units, giving uniform grid cells
    return {
      x: gridX * this.charWidth,      // column → pixels (8px per column)
      y: gridY * this.halfRowHeight    // half-row → pixels (8px per half-row)
    };
  }

  /**
   * Convert debug color to hex string
   */
  private colorToHex(debugColor: number): string {
    return '#' + debugColor.toString(16).padStart(6, '0');
  }

  /**
   * Generate JavaScript to draw text at grid position with optional background
   */
  private drawTextJs(text: string, gridX: number, gridY: number, 
                     fgColor: number, bgColor?: number): string {
    const {x, y} = this.gridToPixel(gridX, gridY);
    const fgHex = this.colorToHex(fgColor);
    const commands = [];
    
    if (bgColor !== undefined) {
      const bgHex = this.colorToHex(bgColor);
      commands.push(`ctx.fillStyle='${bgHex}';ctx.fillRect(${x},${y},${text.length*8},16);`);
    }
    
    commands.push(`ctx.fillStyle='${fgHex}';ctx.font='14px Parallax,monospace';`);
    commands.push(`ctx.textBaseline='top';`);
    commands.push(`ctx.fillText('${text.replace(/'/g, "\\'")}',${x},${y});`);
    
    return commands.join('');
  }

  /**
   * Generate JavaScript to draw a single character at grid position
   */
  private drawCharJs(char: string, gridX: number, gridY: number, 
                     fgColor: number, bgColor?: number): string {
    return this.drawTextJs(char, gridX, gridY, fgColor, bgColor);
  }

  /**
   * Generate JavaScript to draw a box with box-drawing characters
   * Based on Pascal DrawBox procedure (lines 2123-2149)
   * @param rim - Border thickness (3 for normal boxes, 6 for buttons)
   */
  private drawBoxJs(x: number, y: number, width: number, height: number, color: number, rim: number = 3): string {
    const commands = [];
    
    // Add drop shadow for buttons (rim = 6)
    if (rim === 6) {
      // Create darker shadow color
      const shadowColor = (color >> 1) & 0x7F7F7F; // Darken by shifting bits
      const shadowHex = this.colorToHex(shadowColor);
      const {x: px, y: py} = this.gridToPixel(x + 1, y + 1);
      commands.push(`ctx.fillStyle='${shadowHex}';`);
      commands.push(`ctx.fillRect(${px},${py},${width * 8},${height * 8});`);
    }

    // Draw filled background for thicker borders
    if (rim > 3) {
      const bgHex = this.colorToHex(color);
      const {x: px, y: py} = this.gridToPixel(x, y);
      commands.push(`ctx.fillStyle='${bgHex}';`);
      commands.push(`ctx.fillRect(${px},${py},${width * 8},${height * 8});`);
    }
    
    // Top line
    commands.push(this.drawCharJs('┌', x, y, color));
    for (let i = 1; i < width - 1; i++) {
      commands.push(this.drawCharJs('─', x + i, y, color));
    }
    commands.push(this.drawCharJs('┐', x + width - 1, y, color));
    
    // Sides
    for (let i = 1; i < height - 1; i++) {
      commands.push(this.drawCharJs('│', x, y + i, color));
      commands.push(this.drawCharJs('│', x + width - 1, y + i, color));
    }
    
    // Bottom line
    commands.push(this.drawCharJs('└', x, y + height - 1, color));
    for (let i = 1; i < width - 1; i++) {
      commands.push(this.drawCharJs('─', x + i, y + height - 1, color));
    }
    commands.push(this.drawCharJs('┘', x + width - 1, y + height - 1, color));
    
    return commands.join('');
  }

  /**
   * Generate JavaScript to clear a region
   */
  private clearRegionJs(region: {x: number, y: number, width: number, height: number}): string {
    const {x, y} = this.gridToPixel(region.x, region.y);
    const width = region.width * this.charWidth;
    const height = region.height * this.halfRowHeight; // height is in half-rows
    const bgHex = this.colorToHex(PASCAL_COLOR_SCHEME.cBackground);
    return `ctx.fillStyle='${bgHex}';ctx.fillRect(${x},${y},${width},${height});`;
  }

  /**
   * Get window title (public getter for base class abstract requirement)
   */
  get windowTitle(): string {
    return this.getWindowTitle();
  }

  /**
   * Get window title
   */
  protected getWindowTitle(): string {
    return `Debugger - Cog ${this.cogId}`;
  }

  /**
   * Get HTML content for the window
   */
  protected getHtmlContent(): string {
    const bgColor = '#1e1e1e';
    const fgColor = '#c0c0c0';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.getWindowTitle()}</title>
  <style>
    @font-face {
      font-family: 'Parallax';
      src: url('${this.getParallaxFontUrl()}') format('truetype');
    }
    body {
      margin: 0;
      padding: 0;
      background-color: ${bgColor};
      color: ${fgColor};
      font-family: 'Parallax', monospace;
      font-size: 14px;
      overflow: hidden;
      user-select: none;
    }
    #canvas {
      display: block;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    #status {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 20px;
      background-color: #2d2d2d;
      color: #888;
      padding: 2px 10px;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #444;
    }
    .status-item {
      margin: 0 10px;
    }
    .status-connected {
      color: #4ec9b0;
    }
    .status-disconnected {
      color: #f48771;
    }
    .status-breaked {
      color: #ffcc00;
    }
    .status-running {
      color: #4ec9b0;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="status">
    <div class="status-item">
      COG ${this.cogId}
      <span id="cog-status" class="status-disconnected">●</span>
    </div>
    <div class="status-item">
      PC: <span id="pc-value">0x00000</span>
    </div>
    <div class="status-item">
      <span id="run-status">Stopped</span>
    </div>
    <div class="status-item">
      <span id="update-time">--</span> ms
    </div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    
    // Set up canvas
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    // Size canvas to window
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 22; // Account for status bar
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Handle keyboard input
    document.addEventListener('keydown', (e) => {
      ipcRenderer.send('debugger-key', {
        cogId: ${this.cogId},
        key: e.key,
        code: e.code,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey
      });
    });
    
    // Handle mouse input
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / 8);  // column
      const y = Math.floor((e.clientY - rect.top) / 8);   // half-row
      
      ipcRenderer.send('debugger-click', {
        cogId: ${this.cogId},
        x: x,
        y: y,
        button: e.button
      });
    });
    
    // Handle mouse wheel
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      ipcRenderer.send('debugger-wheel', {
        cogId: ${this.cogId},
        deltaY: e.deltaY
      });
    });
    
    // Status updates
    ipcRenderer.on('status-update', (event, data) => {
      if (data.connected !== undefined) {
        const statusEl = document.getElementById('cog-status');
        statusEl.className = data.connected ? 'status-connected' : 'status-disconnected';
      }
      if (data.pc !== undefined) {
        document.getElementById('pc-value').textContent = '0x' + data.pc.toString(16).padStart(5, '0').toUpperCase();
      }
      if (data.running !== undefined) {
        const runEl = document.getElementById('run-status');
        runEl.textContent = data.running ? 'Running' : (data.breaked ? 'Breaked' : 'Stopped');
        runEl.className = data.running ? 'status-running' : (data.breaked ? 'status-breaked' : '');
      }
      if (data.updateTime !== undefined) {
        document.getElementById('update-time').textContent = data.updateTime.toFixed(1);
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Queue initial message before window is ready
   * DEPRECATED: Use updateContent() instead which handles queuing automatically
   */
  public queueInitialMessage(data: Uint8Array): void {
    // Base class handles queuing via updateContent()
    this.updateContent(data);
  }
  
  /**
   * Process debugger message (80-byte initial or other protocol messages)
   */
  private processDebuggerMessage(data: Uint8Array): void {
    if (!this.dataManager) {
      this.logConsoleMessage(`[DEBUGGER] Data manager not ready for COG ${this.cogId}, message will be lost`);
      return;
    }
    
    // Process the binary message
    this.handleBinaryMessage(data);
  }
  
  /**
   * Process queued messages
   * DEPRECATED: Base class handles this via its own processQueuedMessages()
   */
  private processQueuedMessages(): void {
    // Base class handles this automatically when window becomes ready
    this.logConsoleMessage(`[DEBUGGER] processQueuedMessages called but base class handles this now`);
  }

  /**
   * Handle DOM ready - called when did-finish-load fires
   * This is where we initialize canvas-dependent components
   */
  private handleDomReady(): void {
    this.logConsoleMessage(`[DEBUGGER] handleDomReady for COG ${this.cogId}`);
    this.logConsoleMessage(`[DEBUGGER] componentsReady = ${this.componentsReady}`);
    this.logConsoleMessage(`[DEBUGGER] deferred messages = ${this.deferredMessages.length}`);

    // Process any deferred messages
    if (this.deferredMessages.length > 0) {
      this.logConsoleMessage(`[DEBUGGER] Processing ${this.deferredMessages.length} deferred messages now`);
      this.processDeferredMessages();
    }

    // Verify canvas exists and start rendering
    this.debugWindow?.webContents.executeJavaScript(`
      const canvas = document.getElementById('canvas');
      if (canvas) {
        { id: 'canvas', width: canvas.width, height: canvas.height }
      } else {
        null
      }
    `).then((canvasInfo) => {
      if (canvasInfo) {
        this.logMessage(`Canvas found: ${canvasInfo.width}x${canvasInfo.height}`);

        // Create interaction handler
        if (this.protocol && this.dataManager) {
          this.interaction = new DebuggerInteraction(
            null as any, // Renderer handled by main process executeJavaScript
            this.protocol,
            this.dataManager,
            this.cogId
          );
        }

        // Start the render loop
        this.startUpdateLoop();
        this.logConsoleMessage(`[DEBUGGER] Render loop started for COG ${this.cogId}`);

        // Trigger immediate render to show the UI
        this.renderDebuggerDisplay();
      } else {
        console.error(`[DEBUGGER] Canvas element not found for COG ${this.cogId}`);
      }
    }).catch((error) => {
      console.error(`[DEBUGGER] Failed to verify canvas for COG ${this.cogId}:`, error);
    });
  }

  /**
   * Initialize window after creation
   * NOTE: No longer used - initialization now happens via:
   *   - did-finish-load -> handleDomReady() (canvas init, render loop)
   *   - ready-to-show -> registerWithRouter(), setupIPCHandlers()
   * Kept for interface compatibility with base class
   */
  protected async initializeWindow(): Promise<void> {
    // All initialization now happens in proper event handlers
    // See createDebugWindow() for the correct event wiring
    this.logConsoleMessage(`[DEBUGGER] initializeWindow called (legacy - no action needed)`);
  }

  /**
   * Set up IPC handlers for user input
   */
  private setupIPCHandlers(): void {
    if (!this.debugWindow) return;
    
    // Keyboard handler
    this.debugWindow.webContents.on('ipc-message', (event, channel, data) => {
      switch (channel) {
        case 'debugger-key':
          this.handleKeyPress(data);
          break;
        case 'debugger-click':
          this.handleMouseClick(data);
          break;
        case 'debugger-wheel':
          this.handleMouseWheel(data);
          break;
      }
    });
  }

  /**
   * Handle keyboard input
   */
  private handleKeyPress(data: any): void {
    if (!this.interaction) return;
    
    // Create a synthetic KeyboardEvent-like object
    const event = {
      key: data.key,
      code: data.code,
      shiftKey: data.shift,
      ctrlKey: data.ctrl,
      altKey: data.alt,
      preventDefault: () => {} // Mock preventDefault
    } as KeyboardEvent;
    
    // Let the interaction handler process it
    this.interaction.handleKeyboard(event);
  }

  /**
   * Handle mouse click
   */
  private handleMouseClick(data: any): void {
    if (!this.interaction) return;
    
    const { x, y, button } = data;
    this.interaction.handleMouseClick(x, y, button);
  }

  /**
   * Handle mouse wheel
   */
  private handleMouseWheel(data: any): void {
    if (!this.interaction) return;
    
    const { deltaY } = data;
    this.interaction.handleMouseWheel(deltaY);
  }

  /**
   * Send debug command to P2 using TLong protocol (Pascal: TLong(StallBrk))
   *
   * Pascal Protocol (DebuggerUnit.pas lines 1330-1345):
   * - STALL_CMD ($800): Hold execution at current breakpoint
   * - BreakValue: Continue to next breakpoint matching these conditions
   *
   * Commands:
   * - GO: Set stallBrk = breakValue, send TLong(stallBrk)
   * - STALL/BREAK: Send TLong(STALL_CMD) to hold
   * - STEP: Send TLong(breakValue) to execute until next break
   */
  /**
   * Three-state debugger state machine matching Pascal DebuggerUnit.pas Section 4:
   *
   * HALTED (A): Cog stopped at breakpoint. StallBrk = StallCmd ($800).
   *   Host continuously sends StallCmd on each poll (~15/sec from P2 stall loop).
   *
   * SINGLE GO (B): User pressed SPACE or left-clicked Go.
   *   StallBrk = BreakValue for ONE exchange, then immediately StallBrk = StallCmd.
   *   P2 resumes, hits break condition, re-enters ISR -> back to HALTED.
   *
   * REPEAT MODE (C): User pressed ENTER or right-clicked Go.
   *   Host alternates: if < 50ms since last Go, send StallCmd (throttle).
   *   Otherwise send BreakValue. Limits to ~20 breaks/sec for visual tracking.
   *   Any SPACE/ENTER/Go click -> back to HALTED.
   */
  private sendDebugCommand(command: string): void {
    try {
      switch (command) {
        case 'GO':
        case 'STEP':
        case 'STEP_INTO':
          // SINGLE GO — send BreakValue once, then revert to StallCmd
          // Pascal: StallBrk := BreakValue; (sent in next Phase 2); StallBrk := StallCmd
          if (this.repeatMode) {
            // If in repeat mode, SPACE/Go stops it (transition C -> A)
            this.repeatMode = false;
            this.stallBrk = DEBUG_COMMANDS.STALL_CMD;
          } else {
            // Single Go (transition A -> B)
            this.stallBrk = this.breakValue;
            this.oldTickCount = Date.now();
            // stallBrk will be reset to STALL_CMD after the next Phase 2 send
            // (handled in getStallBrkForExchange)
          }
          break;

        case 'RUN':
          // REPEAT MODE — continuous execution with throttled updates
          if (this.repeatMode) {
            // Already in repeat mode, stop it (transition C -> A)
            this.repeatMode = false;
            this.stallBrk = DEBUG_COMMANDS.STALL_CMD;
          } else {
            // Enter repeat mode (transition A -> C)
            this.repeatMode = true;
            this.stallBrk = this.breakValue;
            this.oldTickCount = Date.now();
          }
          break;

        case 'BREAK':
        case 'STALL':
          // HALT — clear all conditions except INIT, stop repeat mode
          this.stallBrk = DEBUG_COMMANDS.STALL_CMD;
          this.repeatMode = false;
          break;

        case 'INIT':
          // Toggle INIT break (bit 8) — always independent, additive
          this.breakValue ^= DEBUG_COMMANDS.BREAK_INIT;
          break;

        case 'DEBUG':
          // Toggle DEBUG break condition (bit 4)
          // Mutual exclusion: clear single-step bits 0-3 and entry bits 5-7
          if (this.breakValue & DEBUG_COMMANDS.BREAK_DEBUG) {
            this.breakValue &= ~DEBUG_COMMANDS.BREAK_DEBUG;
          } else {
            this.breakValue = (this.breakValue & DEBUG_COMMANDS.BREAK_INIT) | DEBUG_COMMANDS.BREAK_DEBUG;
          }
          break;

        case 'MAIN':
          // Toggle MAIN single-step (bit 0) — right-click behavior
          this.breakValue ^= DEBUG_COMMANDS.BREAK_MAIN;
          this.breakValue &= ~DEBUG_COMMANDS.BREAK_DEBUG; // Clear DEBUG (mutual exclusion)
          break;

        default:
          this.logConsoleMessage(`[DEBUGGER] Unknown command: ${command}`);
      }

      // Update the protocol's response generator with current stallBrk
      if (this.protocol) {
        this.protocol.setStallBreak(this.cogState.cogId, this.stallBrk);
      }
    } catch (error) {
      this.logConsoleMessage(`[DEBUGGER] Error sending command ${command}: ${error}`);
    }
  }

  /**
   * Get the stallBrk value for the next Phase 2 exchange.
   * Implements repeat mode throttling (50ms) and single-go auto-reset.
   * Called by the protocol before each breakpoint exchange.
   */
  public getStallBrkForExchange(): number {
    if (this.repeatMode) {
      // Repeat mode throttling: if < 50ms since last Go, send StallCmd instead
      const now = Date.now();
      if (now - this.oldTickCount < 50) {
        return DEBUG_COMMANDS.STALL_CMD; // Throttle — too soon
      }
      this.oldTickCount = now;
      return this.breakValue; // Allow execution
    }

    // Single Go: send stallBrk (which is breakValue), then auto-reset to StallCmd
    const value = this.stallBrk;
    this.stallBrk = DEBUG_COMMANDS.STALL_CMD; // Reset after sending
    return value;
  }

  /**
   * Called when a breakpoint is received from the P2.
   * Resets the 250ms breakpoint timeout and clears dimming.
   */
  public onBreakpointReceived(): void {
    this.isDimmed = false;
    this.resetBreakpointTimer();
  }

  /**
   * Start/reset the 250ms breakpoint timeout timer.
   * If no breakpoint arrives within 250ms, the display is dimmed.
   */
  private resetBreakpointTimer(): void {
    if (this.breakpointTimerHandle) {
      clearTimeout(this.breakpointTimerHandle);
    }
    this.breakpointTimerHandle = setTimeout(() => {
      this.onBreakpointTimeout();
    }, 250);
  }

  /**
   * Called when 250ms pass without a new breakpoint.
   * Dims the display and changes Go button to "Break".
   */
  private onBreakpointTimeout(): void {
    this.isDimmed = true;
    this.breakpointTimerHandle = null;
    // Re-render with dimming overlay applied
    // Go button caption changes from "Go"/"Stop" to "Break" — handled by renderer
    this.markAllDirty();
    this.render();
    this.emit('breakpointTimeout');
  }

  /**
   * Handle incoming debugger message
   */
  private handleDebuggerMessage(message: any): void {
    if (message instanceof Uint8Array) {
      // Binary message - debugger protocol
      this.handleBinaryMessage(message);
    } else if (typeof message === 'string') {
      // Text message - might be a response
      this.handleTextMessage(message);
    }
  }

  /**
   * Handle binary debugger message
   */
  private handleBinaryMessage(data: Uint8Array): void {
    // If we're awaiting Phase 3 data, accumulate it
    if (this.awaitingPhase3) {
      const complete = this.phase3Receiver.addData(data);
      if (complete) {
        this.processPhase3Data();
      }
      return; // Don't process as Phase 1 while awaiting Phase 3
    }

    // Check if this is a 456-byte debugger packet (Phase 1 protocol)
    // Structure: 20 longs (80) + 64 words CRC (128) + 124 words Hub checksums (248) = 456
    if (data.length === 456) {
      this.processDebuggerPacket(data);
    }
    // Check if this is a 20-long initial message
    else if (data.length >= 80) {
      // 20 longs * 4 bytes
      const longs = new Uint32Array(data.buffer, data.byteOffset, 20);
      try {
        const message = parseInitialMessage(longs);
        if (message.cogNumber === this.cogId) {
          this.updateCogState(message);
        }
      } catch (error) {
        this.logMessage(`Error parsing message: ${error}`);
      }
    }
  }

  /**
   * Process received Phase 3 data
   */
  private processPhase3Data(): void {
    const phase3Data = this.phase3Receiver.parse();
    if (!phase3Data) {
      this.logConsoleMessage('[DEBUGGER] Failed to parse Phase 3 data');
      this.awaitingPhase3 = false;
      this.phase3Receiver.reset();
      return;
    }

    this.logConsoleMessage(
      `[DEBUGGER] Phase 3 received: ${phase3Data.cogMemory.size} COG blocks, ` +
        `${phase3Data.hubSubBlocks.size} Hub blocks`
    );

    // Update COG/LUT memory in data manager
    if (this.dataManager) {
      for (const [blockIndex, blockData] of phase3Data.cogMemory) {
        // Determine if this is COG (0-31) or LUT (32-63)
        if (blockIndex < 32) {
          // COG memory
          for (let i = 0; i < blockData.length; i++) {
            const regIndex = blockIndex * 16 + i;
            this.dataManager.updateCogRegister(regIndex, blockData[i]);
          }
        } else {
          // LUT memory
          for (let i = 0; i < blockData.length; i++) {
            const regIndex = (blockIndex - 32) * 16 + i;
            this.dataManager.updateLutRegister(regIndex, blockData[i]);
          }
        }
      }

      // Phase 3 additional data processing (future enhancement):
      // - Hub sub-blocks: phase3Data.hubSubBlocks
      // - Disassembly: phase3Data.disassemblyData
      // - Pointer windows: phase3Data.fptrWindow, ptraWindow, ptrbWindow
      // - Hub memory: phase3Data.hubWindow
      // - Smart pins: phase3Data.smartPinFlags, smartPinData
    }

    // Clear dirty flags on received blocks
    // This would be done in the data manager

    // Reset Phase 3 state
    this.awaitingPhase3 = false;
    this.phase3Receiver.reset();

    // Trigger UI update
    this.renderDebuggerDisplay();
  }
  
  /**
   * Format debugger packet for display
   */
  private formatDebuggerPacketDisplay(data: Uint8Array): any {
    const cogId = data[0];
    const cogState = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
    const pc = data[8] | (data[9] << 8) | (data[10] << 16) | (data[11] << 24);
    const instruction = data[12] | (data[13] << 8) | (data[14] << 16) | (data[15] << 24);
    
    // Format first 16 bytes as hex
    const statusHex = Array.from(data.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    
    return {
      title: `Debugger - Cog ${cogId}`,
      pc: `$${pc.toString(16).padStart(8, '0').toUpperCase()}`,
      state: `$${cogState.toString(16).padStart(8, '0').toUpperCase()}`,
      instruction: `$${instruction.toString(16).padStart(8, '0').toUpperCase()}`,
      statusHex: statusHex
    };
  }
  
  /**
   * Process a 456-byte debugger packet (Phase 1 Protocol)
   * Packet structure from Pascal DebuggerUnit.pas:
   * - Bytes 0-79: 20 longs containing DebuggerMsg array (RLong reads)
   * - Bytes 80-207: 64 words for COG/LUT CRC values (RWord reads)
   * - Bytes 208-455: 124 words for Hub checksum values (RWord reads)
   *
   * Note: This packet does NOT contain actual memory data!
   * The CRC/checksum values are used to detect which blocks changed.
   * The PC then requests actual block data in Phase 2/3.
   */
  private processDebuggerPacket(data: Uint8Array): void {
    // Packet should be exactly 456 bytes for Phase 1 protocol
    if (data.length < 456) {
      this.logMessage(`Invalid packet size: ${data.length} (expected 456 bytes for Phase 1 protocol)`);
      return;
    }

    // Create DataView for proper little-endian reading
    const view = new DataView(data.buffer, data.byteOffset, data.length);

    // Parse the 20 longs using CORRECT Pascal indices from DebuggerUnit.pas
    // Each index is byte offset = index * 4 (little-endian 32-bit values)
    const breakC = view.getUint32(DebuggerMessageIndex.mBRKC * 4, true);
    const iret = view.getUint32(DebuggerMessageIndex.mIRET * 4, true);

    // Build stack array
    const stack: number[] = [];
    for (let i = 0; i < 8; i++) {
      stack.push(view.getUint32((DebuggerMessageIndex.mSTK0 + i) * 4, true));
    }

    const debugMsg = {
      cogNumber: view.getUint32(DebuggerMessageIndex.mCOGN * 4, true),
      breakCZ: view.getUint32(DebuggerMessageIndex.mBRKCZ * 4, true),
      breakC: breakC,
      breakZ: view.getUint32(DebuggerMessageIndex.mBRKZ * 4, true),
      ctHigh: view.getUint32(DebuggerMessageIndex.mCTH2 * 4, true),
      ctLow: view.getUint32(DebuggerMessageIndex.mCTL2 * 4, true),
      stack: stack,
      iret: iret,
      fifoPtr: view.getUint32(DebuggerMessageIndex.mFPTR * 4, true),
      ptrA: view.getUint32(DebuggerMessageIndex.mPTRA * 4, true),
      ptrB: view.getUint32(DebuggerMessageIndex.mPTRB * 4, true),
      freq: view.getUint32(DebuggerMessageIndex.mFREQ * 4, true),
      cond: view.getUint32(DebuggerMessageIndex.mCOND * 4, true),
      // Derived values
      programCounter: iret & 0xFFFFF,
      callDepth: (breakC >>> 28) & 0xF,
      skipPattern: view.getUint32(DebuggerMessageIndex.mBRKZ * 4, true),
      events: breakC & 0xFFFF,
      xbyte: (breakC >>> 16) & 0x1FF
    };

    // Check if this packet is for our COG
    if (debugMsg.cogNumber !== this.cogId) {
      this.logMessage(`Packet for wrong COG: ${debugMsg.cogNumber} (expected ${this.cogId})`);
      return;
    }

    // Initialize breakValue from first message (Pascal: BreakValue := DebuggerMsg[mCOND])
    if (this.firstBreak) {
      this.breakValue = debugMsg.cond;
      this.firstBreak = false;
      this.logConsoleMessage(`[DEBUGGER] First break - initialized breakValue from cond: $${debugMsg.cond.toString(16).padStart(8, '0')}`);
    }

    // Update COG state with correctly parsed values
    this.cogState.programCounter = debugMsg.programCounter;
    this.cogState.isActive = true;
    this.cogState.isBreaked = (debugMsg.breakCZ & 0x01) !== 0;  // Check STALLI bit
    this.cogState.skipPattern = debugMsg.skipPattern;
    this.cogState.callDepth = debugMsg.callDepth;

    // Store parsed data in dataManager
    if (this.dataManager) {
      // Store status data with correct structure
      this.dataManager.updateStatusData({
        cogId: debugMsg.cogNumber,
        breakCZ: debugMsg.breakCZ,
        breakC: debugMsg.breakC,
        breakZ: debugMsg.breakZ,
        ctHigh: debugMsg.ctHigh,
        ctLow: debugMsg.ctLow,
        stack: debugMsg.stack,
        programCounter: debugMsg.programCounter,
        callDepth: debugMsg.callDepth,
        skipPattern: debugMsg.skipPattern,
        ptrA: debugMsg.ptrA,
        ptrB: debugMsg.ptrB
      });

      // Parse 64 COG/LUT CRC words (bytes 80-207, little-endian)
      // These are NOT register values - they're checksums for change detection
      const cogCRCs: number[] = [];
      for (let i = 0; i < 64; i++) {
        const offset = 80 + i * 2;  // Words, not longs!
        cogCRCs.push(view.getUint16(offset, true));
      }

      // Parse 124 Hub checksum words (bytes 208-455, little-endian)
      const hubChecksums: number[] = [];
      for (let i = 0; i < 124; i++) {
        const offset = 208 + i * 2;  // Words, not longs!
        hubChecksums.push(view.getUint16(offset, true));
      }

      // Process Phase 1 CRCs - triggers change detection for dirty blocks
      this.dataManager.processPhase1CRCs(debugMsg.cogNumber, cogCRCs, hubChecksums);

      // Log changed blocks for debugging
      const changedCogBlocks = this.dataManager.getChangedCogBlocks();
      const changedHubBlocks = this.dataManager.getChangedHubBlocks();
      if (changedCogBlocks.length > 0 || changedHubBlocks.length > 0) {
        this.logConsoleMessage(`[DEBUGGER] Changed blocks - COG: [${changedCogBlocks.join(',')}], HUB: [${changedHubBlocks.join(',')}]`);
      }
    }

    // Store the packet for reference
    this.currentDebuggerPacket = data;

    // Generate and send Phase 2 response to P2
    // CRITICAL: The P2 is waiting for this response before releasing lock #15!
    this.sendPhase2Response(data);

    // Trigger immediate display update
    this.renderDebuggerDisplay();
  }

  /**
   * Send Phase 2 response to P2 debugger
   *
   * After receiving Phase 1 data (456 bytes), we must respond with:
   * - 8 bytes: COG/LUT change request bits
   * - 16 bytes: Hub change request bits
   * - 20 bytes: Hub read requests (5 longs)
   * - 4 bytes: COGBRK request
   * - 4 bytes: Stall/Break command
   * Total: 52 bytes
   *
   * Reference: Pascal DebuggerUnit.pas lines 1304-1345
   */
  private sendPhase2Response(phase1Packet: Uint8Array): void {
    // Configure response generator with current state
    this.responseGenerator.setStallBreak(this.stallBrk);

    // Get breakpoint mask from data manager if available
    const breakpointMask = this.dataManager?.getBreakpointMask() ?? 0;
    this.responseGenerator.setRequestCogBrk(breakpointMask);

    // Set hub memory view address (for now, start at 0)
    this.responseGenerator.setHubAddress(0);

    // Determine if we need hub code for disassembly
    // PC in hub means we need to fetch instructions from hub memory
    const pc = this.cogState.programCounter;
    const pcInHub = pc >= 0x400; // PC >= $400 means code is in hub
    this.responseGenerator.setGetHubCode(pcInHub);
    if (pcInHub) {
      this.responseGenerator.setDisassemblyAddress(pc, 16);
    }

    // Generate the 52-byte response
    const response = this.responseGenerator.generateResponse(phase1Packet);

    // Set up Phase 3 expectations based on what we're requesting
    const changedCogBlocks = this.responseGenerator.getChangedCogBlocks();
    const changedHubBlocks = this.responseGenerator.getChangedHubBlocks();
    const expectations: Phase3Expectations = {
      changedCogBlocks,
      changedHubBlocks,
      getHubCode: pcInHub,
      disLines: pcInHub ? 16 : 0
    };
    this.phase3Receiver.setExpectations(expectations);
    this.awaitingPhase3 = true;

    // Log expected Phase 3 size
    this.logConsoleMessage(
      `[DEBUGGER] Expecting Phase 3: ${this.phase3Receiver.getExpectedSize()} bytes ` +
        `(${changedCogBlocks.length} COG blocks, ${changedHubBlocks.length} Hub blocks)`
    );

    // Send response via serial (tLongTransmitter handles byte-by-byte sending)
    this.sendResponseBytes(response);

    // After sending response, reset stallBrk to STALL_CMD
    this.stallBrk = DEBUG_COMMANDS.STALL_CMD;
  }

  /**
   * Send response bytes to P2 via serial callback
   */
  private sendResponseBytes(response: Uint8Array): void {
    try {
      // Use tLongTransmitter's transmitBuffer for binary data
      this.tLongTransmitter.transmitBuffer(response);
      this.logConsoleMessage(`[DEBUGGER] Sent Phase 2 response: ${response.length} bytes`);
    } catch (error) {
      this.logConsoleMessage(`[DEBUGGER] Error sending Phase 2 response: ${error}`);
    }
  }

  /**
   * Handle text message
   */
  private handleTextMessage(text: string): void {
    // Handle text responses
    this.logMessage(`Text message: ${text}`);
  }

  /**
   * Update COG state from message
   * Pascal reference: DebuggerUnit.pas lines 1199-1206
   */
  private updateCogState(message: DebuggerInitialMessage): void {
    if (!this.dataManager) return;

    // Initialize breakValue from first message (Pascal: BreakValue := DebuggerMsg[mCOND])
    if (this.firstBreak) {
      this.breakValue = message.cond;
      this.firstBreak = false;
      this.logConsoleMessage(`[DEBUGGER] First break - initialized breakValue from mCOND: $${message.cond.toString(16).padStart(8, '0')}`);
    }

    // Update data manager with new state
    // Process initial message - store in state
    // processInitialMessage not implemented

    // Update local state copy
    this.cogState.lastMessage = message;
    this.cogState.programCounter = message.programCounter;
    this.cogState.skipPattern = message.skipPattern;
    this.cogState.callDepth = message.callDepth;
    this.cogState.isActive = true;
    this.cogState.isBreaked = (message.breakCZ & 0x02) !== 0; // Check bit 1 (STALLI) in breakCZ

    // Update status display
    this.updateStatusDisplay();

    // Trigger render update
    this.renderDebuggerDisplay();
  }

  /**
   * Update status display
   */
  private updateStatusDisplay(): void {
    if (!this.debugWindow) return;
    
    const updateTime = Date.now() - this.lastUpdateTime;
    this.lastUpdateTime = Date.now();
    
    this.debugWindow.webContents.send('status-update', {
      connected: this.isConnected,
      pc: this.cogState.programCounter,
      running: this.cogState.isActive && !this.cogState.isBreaked,
      breaked: this.cogState.isBreaked,
      updateTime: updateTime
    });
  }

  /**
   * Start update loop
   */
  private startUpdateLoop(): void {
    // Update display at 30 FPS
    this.updateTimer = setInterval(() => {
      this.renderDebuggerDisplay();
    }, 33);
  }

  /**
   * Stop update loop
   */
  private stopUpdateLoop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Render COG registers region
   */
  private renderCogRegisters(region: LayoutRegion): string[] {
    const jsCommands = [];
    
    // Clear region background
    jsCommands.push(this.clearRegionJs(region));
    
    // Draw title
    jsCommands.push(this.drawTextJs('COG Registers', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    
    // Draw register values from real data
    if (this.dataManager) {
      for (let row = 0; row < 16; row++) {
        for (let col = 0; col < 4; col++) {
          const regNum = row * 4 + col;
          const x = region.x + 2 + col * 14;
          const y = region.y + 2 + row;
          
          // Get actual register value from dataManager
          const value = this.dataManager.getCogRegister(this.cogId, regNum);
          const hexStr = (value ?? 0).toString(16).padStart(8, '0').toUpperCase();
          
          jsCommands.push(this.drawTextJs(hexStr, x, y, PASCAL_COLOR_SCHEME.cData));
        }
      }
    }
    
    return jsCommands;
  }
  
  /**
   * Render disassembly region
   */
  private renderDisassembly(region: LayoutRegion): string[] {
    const jsCommands = [];
    
    // Clear region background
    jsCommands.push(this.clearRegionJs(region));
    
    // Draw title
    jsCommands.push(this.drawTextJs('Disassembly', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    
    // Draw border
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    
    // Placeholder for disassembly lines
    for (let i = 0; i < 14; i++) {
      const y = region.y + 2 + i;
      jsCommands.push(this.drawTextJs(`0x${(i * 4).toString(16).padStart(8, '0')}  NOP`, region.x + 2, y, PASCAL_COLOR_SCHEME.cDataDim));
    }
    
    return jsCommands;
  }
  
  /**
   * Render LUT registers region
   */
  private renderLutRegisters(region: LayoutRegion): string[] {
    const jsCommands = [];
    
    // Clear region background
    jsCommands.push(this.clearRegionJs(region));
    
    // Draw title
    jsCommands.push(this.drawTextJs('LUT Registers', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    
    // Draw register values from real data
    if (this.dataManager) {
      for (let row = 0; row < 16; row++) {
        for (let col = 0; col < 4; col++) {
          const regNum = row * 4 + col;
          const x = region.x + 2 + col * 14;
          const y = region.y + 2 + row;
          
          // Get actual LUT register value from dataManager
          const value = this.dataManager.getLutRegister(this.cogId, regNum);
          const hexStr = (value ?? 0).toString(16).padStart(8, '0').toUpperCase();
          
          jsCommands.push(this.drawTextJs(hexStr, x, y, PASCAL_COLOR_SCHEME.cData));
        }
      }
    }
    
    return jsCommands;
  }
  
  /**
   * Render flags region
   */
  private renderFlags(region: LayoutRegion): string[] {
    const jsCommands = [];
    
    // Clear region background
    jsCommands.push(this.clearRegionJs(region));
    
    // Draw title
    jsCommands.push(this.drawTextJs('Flags', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    
    // Draw flag states
    const flags = ['Z', 'C', 'IRQ', 'CT1', 'CT2', 'CT3'];
    let x = region.x + 2;
    for (const flag of flags) {
      jsCommands.push(this.drawTextJs(flag, x, region.y + 2, PASCAL_COLOR_SCHEME.cDataDim));
      x += 4;
    }
    
    return jsCommands;
  }
  
  /**
   * Render stack region
   */
  private renderStack(region: LayoutRegion): string[] {
    const jsCommands = [];
    
    // Clear region background
    jsCommands.push(this.clearRegionJs(region));
    
    // Draw title
    jsCommands.push(this.drawTextJs('Stack', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    
    // Draw border
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    
    // Stack entries placeholder
    for (let i = 0; i < 6; i++) {
      jsCommands.push(this.drawTextJs(`[${i}] 00000000`, region.x + 2, region.y + 2 + i, PASCAL_COLOR_SCHEME.cDataDim));
    }
    
    return jsCommands;
  }
  
  /**
   * Render events region
   */
  private renderEvents(region: LayoutRegion): string[] {
    const jsCommands = [];
    
    // Clear region background
    jsCommands.push(this.clearRegionJs(region));
    
    // Draw title
    jsCommands.push(this.drawTextJs('Events', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    
    // Draw border
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    
    // Event entries placeholder
    jsCommands.push(this.drawTextJs('No events', region.x + 2, region.y + 2, PASCAL_COLOR_SCHEME.cDataDim));
    
    return jsCommands;
  }
  
  /**
   * Render HUB memory region
   */
  private renderHubMemory(region: LayoutRegion): string[] {
    const jsCommands = [];
    
    // Clear region background
    jsCommands.push(this.clearRegionJs(region));
    
    // Draw title
    jsCommands.push(this.drawTextJs('HUB Memory', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    
    // Draw border
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    
    // Memory display placeholder
    for (let row = 0; row < 16; row++) {
      const addr = row * 16;
      const addrStr = addr.toString(16).padStart(8, '0').toUpperCase();
      jsCommands.push(this.drawTextJs(`${addrStr}:`, region.x + 2, region.y + 2 + row, PASCAL_COLOR_SCHEME.cName));
      
      // Hex bytes
      for (let col = 0; col < 8; col++) {
        const x = region.x + 12 + col * 3;
        jsCommands.push(this.drawTextJs('00', x, region.y + 2 + row, PASCAL_COLOR_SCHEME.cDataDim));
      }
    }
    
    return jsCommands;
  }
  
  /**
   * Render control buttons
   */
  private renderControls(region: LayoutRegion): string[] {
    const jsCommands = [];
    
    // Clear region background
    jsCommands.push(this.clearRegionJs(region));
    
    // Draw buttons
    const buttons = [
      { label: '[F5] Run', x: 2 },
      { label: '[F8] Step', x: 12 },
      { label: '[F9] Break', x: 24 },
      { label: '[F10] Reset', x: 36 },
      { label: '[ESC] Close', x: 48 }
    ];
    
    for (const button of buttons) {
      // Draw button box
      jsCommands.push(this.drawBoxJs(region.x + button.x, region.y + 1, 10, 3, PASCAL_COLOR_SCHEME.cCmdButton));
      // Draw button label
      jsCommands.push(this.drawTextJs(button.label, region.x + button.x + 1, region.y + 2, PASCAL_COLOR_SCHEME.cCmdText));
    }
    
    return jsCommands;
  }

  /**
   * Render C Flag
   */
  private renderCFlag(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('C', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render Z Flag  
   */
  private renderZFlag(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('Z', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render Program Counter
   */
  private renderPC(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('PC', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    jsCommands.push(this.drawTextJs('00000000', region.x + 1, region.y + 1, PASCAL_COLOR_SCHEME.cData));
    return jsCommands;
  }
  
  /**
   * Render SKIP pattern
   */
  private renderSkip(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('SKIP', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render XBYTE indicator
   */
  private renderXByte(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('XBYTE', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render CT counter
   */
  private renderCT(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('CT', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render Register Watch
   */
  private renderWatch(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox2));
    jsCommands.push(this.drawTextJs('WATCH', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render Special Function Registers
   */
  private renderSFR(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox2));
    jsCommands.push(this.drawTextJs('SFR', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    // Add register names: IJMP3, IRET3, IJMP2, IRET2, IJMP1, IRET1, PA, PB, PTRA, PTRB, DIRA, DIRB, OUTA, OUTB, INA, INB
    return jsCommands;
  }
  
  /**
   * Render Execution state
   */
  private renderExec(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox3));
    jsCommands.push(this.drawTextJs('EXEC', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render Interrupts
   */
  private renderInterrupts(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('INTERRUPTS', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    jsCommands.push(this.drawTextJs('INT1', region.x + 1, region.y + 2, PASCAL_COLOR_SCHEME.cDataDim));
    jsCommands.push(this.drawTextJs('INT2', region.x + 1, region.y + 3, PASCAL_COLOR_SCHEME.cDataDim));
    jsCommands.push(this.drawTextJs('INT3', region.x + 1, region.y + 4, PASCAL_COLOR_SCHEME.cDataDim));
    return jsCommands;
  }
  
  /**
   * Render Pointers (PTRA/PTRB)
   */
  private renderPointers(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('POINTERS', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    jsCommands.push(this.drawTextJs('PTRA: 00000000', region.x + 2, region.y + 2, PASCAL_COLOR_SCHEME.cData));
    jsCommands.push(this.drawTextJs('PTRB: 00000000', region.x + 2, region.y + 3, PASCAL_COLOR_SCHEME.cData));
    return jsCommands;
  }
  
  /**
   * Render Status box
   */
  private renderStatus(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox3));
    jsCommands.push(this.drawTextJs('STATUS', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render Pins (DIR/OUT/IN)
   */
  private renderPins(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox));
    jsCommands.push(this.drawTextJs('PINS', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    jsCommands.push(this.drawTextJs('DIR A/B', region.x + 2, region.y + 1, PASCAL_COLOR_SCHEME.cDataDim));
    jsCommands.push(this.drawTextJs('OUT A/B', region.x + 2, region.y + 2, PASCAL_COLOR_SCHEME.cDataDim));
    jsCommands.push(this.drawTextJs('IN  A/B', region.x + 2, region.y + 3, PASCAL_COLOR_SCHEME.cDataDim));
    return jsCommands;
  }
  
  /**
   * Render Smart Pins
   */
  private renderSmartPins(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawBoxJs(region.x, region.y, region.width, region.height, PASCAL_COLOR_SCHEME.cBox2));
    jsCommands.push(this.drawTextJs('SMART PINS', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cName));
    return jsCommands;
  }
  
  /**
   * Render Hint line
   */
  private renderHint(region: LayoutRegion): string[] {
    const jsCommands = [];
    jsCommands.push(this.clearRegionJs(region));
    jsCommands.push(this.drawTextJs('Press F1 for help', region.x + 1, region.y, PASCAL_COLOR_SCHEME.cDataDim));
    return jsCommands;
  }

  /**
   * Get render commands for a specific region
   */
  private getRenderCommands(regionName: string, region: LayoutRegion): string[] {
    switch (regionName) {
      case 'cogRegisters':
        return this.renderCogRegisters(region);
      case 'lutRegisters':
        return this.renderLutRegisters(region);
      case 'disassembly':
        return this.renderDisassembly(region);
      case 'flags':
        return this.renderFlags(region);
      case 'stack':
        return this.renderStack(region);
      case 'events':
        return this.renderEvents(region);
      case 'hubMemory':
        return this.renderHubMemory(region);
      case 'controls':
        return this.renderControls(region);
      case 'cflag':
        return this.renderCFlag(region);
      case 'zflag':
        return this.renderZFlag(region);
      case 'pc':
        return this.renderPC(region);
      case 'skip':
        return this.renderSkip(region);
      case 'xbyte':
        return this.renderXByte(region);
      case 'ct':
        return this.renderCT(region);
      case 'watch':
        return this.renderWatch(region);
      case 'sfr':
        return this.renderSFR(region);
      case 'exec':
        return this.renderExec(region);
      case 'interrupts':
        return this.renderInterrupts(region);
      case 'pointers':
        return this.renderPointers(region);
      case 'status':
        return this.renderStatus(region);
      case 'pins':
        return this.renderPins(region);
      case 'smartPins':
        return this.renderSmartPins(region);
      case 'hint':
        return this.renderHint(region);
      default:
        return [];
    }
  }
  
  /**
   * Main render method - batches all dirty regions
   */
  public render(): void {
    if (!this.debugWindow) return;
    
    const startTime = performance.now();
    const allJsCommands = [];
    
    // Add canvas clear at the beginning
    allJsCommands.push(`ctx.fillStyle='#1e1e1e';ctx.fillRect(0,0,canvas.width,canvas.height);`);
    
    // Collect commands for all dirty regions
    for (const regionName of this.dirtyRegions) {
      const region = this.regions.get(regionName);
      if (region) {
        const commands = this.getRenderCommands(regionName, region);
        allJsCommands.push(...commands);
      }
    }
    
    // Render tooltip if visible
    if (this.tooltipText) {
      allJsCommands.push(this.drawTextJs(this.tooltipText, this.tooltipX, this.tooltipY, 0xffff00, 0x333333));
    }

    // Apply dimming overlay when no breakpoint received in 250ms
    // Pascal: right-shift each R,G,B byte by 1 (halve brightness)
    // Canvas equivalent: semi-transparent black overlay at 50% opacity
    if (this.isDimmed) {
      allJsCommands.push(`ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,canvas.width,canvas.height);`);
    }

    // Execute all commands in single call
    if (allJsCommands.length > 0) {
      this.debugWindow.webContents.executeJavaScript(
        `(function() {
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.textBaseline = 'top';
          ${allJsCommands.join('')}
        })()`
      ).catch(error => {
        this.logMessage(`Render error: ${error}`);
      });
    }
    
    // Clear dirty regions
    this.dirtyRegions.clear();
    
    // Track performance
    const renderTime = performance.now() - startTime;
    this.lastRenderTime = renderTime;
    this.renderCount++;
    
    if (renderTime > 50) {
      console.warn(`Slow render: ${renderTime.toFixed(1)}ms`);
    }
  }
  
  /**
   * Mark a region as dirty for re-rendering
   */
  private markDirty(regionName: string): void {
    this.dirtyRegions.add(regionName);
  }
  
  /**
   * Mark all regions as dirty
   */
  private markAllDirty(): void {
    for (const regionName of this.regions.keys()) {
      this.dirtyRegions.add(regionName);
    }
  }

  /**
   * Render debugger display - now uses the batched render system
   */
  private renderDebuggerDisplay(): void {
    if (!this.debugWindow) return;
    
    // Mark all regions as dirty for initial render
    this.markAllDirty();
    
    // Use the batched render system
    this.render();
  }

  /**
   * Generate HTML content for the debugger window
   */
  public getHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Debugger - Cog ${this.cogId}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #${PASCAL_COLOR_SCHEME.cBackground.toString(16).padStart(6, '0')};
            color: #${PASCAL_COLOR_SCHEME.cData.toString(16).padStart(6, '0')};
            font-family: 'Courier New', monospace;
            font-size: 14px;
            overflow: hidden;
        }
        #canvas {
            width: 100%;
            height: 100%;
            display: block;
        }
        .status-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 20px;
            background-color: #222;
            color: #0F0;
            padding: 2px 5px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    <div class="status-bar">
        COG ${this.cogId} - Ready
    </div>
    <script>
        const { ipcRenderer } = require('electron');
        
        // Initialize canvas
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 24; // Account for status bar
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Handle keyboard input
        document.addEventListener('keydown', (e) => {
            ipcRenderer.send('debugger-key', { 
                cogId: ${this.cogId},
                key: e.key,
                code: e.code,
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey
            });
        });
        
        // Handle mouse input
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            ipcRenderer.send('debugger-click', {
                cogId: ${this.cogId},
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        });
        
        // Handle render updates from main process
        ipcRenderer.on('render-update', (event, data) => {
            // Render logic will go here
            console.log('Render update for COG ${this.cogId}:', data);
        });
    </script>
</body>
</html>`;
  }
  
  /**
   * Create the Electron BrowserWindow
   */
  private createDebugWindow(windowDetails?: any): void {
    // Calculate content dimensions
    const contentWidth = windowDetails?.width || LAYOUT_CONSTANTS.GRID_WIDTH * 8;
    const contentHeight = windowDetails?.height || LAYOUT_CONSTANTS.GRID_HEIGHT * 8; // half-rows * 8px

    // Use base class method for consistent chrome adjustments
    const windowDimensions = this.calculateWindowDimensions(contentWidth, contentHeight);
    const width = windowDimensions.width;
    const height = windowDimensions.height;
    
    let x = windowDetails?.x;
    let y = windowDetails?.y;
    
    // If position is not explicitly set, use WindowPlacer for intelligent debugger positioning
    if (x === undefined && y === undefined) {
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width, height },
        strategy: PlacementStrategy.DEBUGGER,  // Use special debugger positioning strategy
        margin: 40,  // Larger margin for debugger windows
        cascadeIfFull: true
      };
      const position = windowPlacer.getNextPosition(`debugger-cog${this.cogId}`, placementConfig);
      x = position.x;
      y = position.y;

      // Log to debug logger with reproducible command format
      try {
        const LoggerWindow = require('./loggerWin').LoggerWindow;
        const debugLogger = LoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(`WINDOW_PLACED (${x},${y} ${width}x${height} Mon:${monitorId}) DEBUGGER 'COG${this.cogId}' POS ${x} ${y} SIZE ${width} ${height}`);
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    }
    
    this.logMessage(`Creating debugger window for COG ${this.cogId}: ${width}x${height} at ${x},${y}`);
    
    this.debugWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      title: `Debugger - Cog ${this.cogId}`,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false
      }
    });

    // Register with WindowPlacer for position tracking (only if using auto-placement)
    // Debugger uses windowDetails parameter, not displaySpec
    const usedAutoPlacement = (windowDetails?.x === undefined && windowDetails?.y === undefined);
    if (usedAutoPlacement) {
      const windowPlacer = WindowPlacer.getInstance();
      windowPlacer.registerWindow(`debugger-cog${this.cogId}`, this.debugWindow);
    }
    
    // Set up window content
    const html = this.getHTML();
    this.debugWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // CRITICAL: Register did-finish-load IMMEDIATELY after loadURL, before ready-to-show
    // This ensures we catch the event since did-finish-load fires BEFORE ready-to-show
    this.debugWindow.webContents.once('did-finish-load', () => {
      this.logConsoleMessage(`[DEBUGGER] did-finish-load event fired for COG ${this.cogId}`);
      this.handleDomReady();
    });

    // Hook window events
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage(`Debugger window for COG ${this.cogId} ready to show`);
      this.debugWindow?.show();
      // Register with router and set up IPC handlers (DOM already ready at this point)
      this.registerWithRouter();
      this.setupIPCHandlers();
    });
    
    this.debugWindow.on('closed', () => {
      this.logMessage(`Debugger window for COG ${this.cogId} closed`);
      this.closeDebugWindow();
    });
  }
  
  /**
   * Required abstract method - close window
   */
  public closeDebugWindow(): void {
    this.stopUpdateLoop();
    
    // Clear deferred messages
    this.deferredMessages = [];
    this.componentsReady = false;
    
    // Clean up components
    if (this.interaction) {
      this.interaction.cleanup();
      this.interaction = null;
    }
    
    if (this.renderer) {
      // Renderer cleanup not implemented
      this.renderer = null;
    }
    
    if (this.protocol) {
      // Protocol cleanup not implemented
      this.protocol = null;
    }
    
    if (this.dataManager) {
      // DataManager cleanup not implemented
      this.dataManager = null;
    }
    
    // Unregister from WindowRouter
    this.windowRouter.unregisterWindow(this.windowId);
    
    // Close the window
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
    }
    
    this.logMessage(`DebugDebuggerWindow closed for COG ${this.cogId}`);
  }

  /**
   * Process deferred messages once components are ready
   */
  private processDeferredMessages(): void {
    if (this.deferredMessages.length > 0) {
      this.logConsoleMessage(`[DEBUGGER] Processing ${this.deferredMessages.length} deferred messages for COG ${this.cogId}`);
      const messages = [...this.deferredMessages];
      this.deferredMessages = [];
      
      // Process each deferred message
      messages.forEach(message => {
        try {
          this.processMessageImmediate(message);
        } catch (error) {
          console.error(`[DEBUGGER] Error processing deferred message: ${error}`);
        }
      });
    }
  }
  
  /**
   * Required abstract method - update content
   * Receives ExtractedMessage from router (router handles SharedMessagePool release)
   */
  protected async processMessageImmediate(data: any): Promise<void> {
    // Check if window components are initialized
    if (!this.componentsReady || !this.dataManager || !this.protocol) {
      console.warn(`[DEBUGGER] Window components not ready for COG ${this.cogId}, deferring message`);
      
      // Store the message for later processing
      this.deferredMessages.push(data);
      
      // Messages will be processed when components are ready (in did-finish-load event)
      // No timer needed - event-driven approach
      
      return;
    }
    
    // In Worker Thread architecture, windows receive ExtractedMessage
    // Router handles SharedMessagePool release
    try {
      // Route through the main message handler
      this.handleDebuggerMessage(data);
    } catch (error) {
      console.error(`[DEBUGGER] Error processing message: ${error}`);
    }
  }

  /**
   * Get canvas ID for this window type
   */
  protected getCanvasId(): string {
    return 'canvas';
  }

  /**
   * Public method to send commands (for multi-COG coordination)
   */
  public sendCommand(command: string): void {
    this.sendDebugCommand(command);
  }

  /**
   * Get the current COG state (for multi-COG coordination)
   */
  public getCogState(): COGDebugState {
    return { ...this.cogState };
  }

  /**
   * Get Go button state for rendering.
   * Pascal: "Go" when halted, "Stop" when in repeat mode, "Break" when dimmed/timeout.
   */
  public getGoButtonState(): { caption: string; isDimmed: boolean; isRepeatMode: boolean } {
    if (this.isDimmed) {
      return { caption: 'Break', isDimmed: true, isRepeatMode: false };
    }
    if (this.repeatMode) {
      return { caption: 'Stop', isDimmed: false, isRepeatMode: true };
    }
    return { caption: 'Go', isDimmed: false, isRepeatMode: false };
  }

  /**
   * Get current break condition value for button highlight rendering.
   */
  public getBreakValue(): number {
    return this.breakValue;
  }

  /**
   * Add a breakpoint (for multi-COG synchronization)
   */
  public addBreakpoint(address: number): void {
    if (this.dataManager) {
      this.dataManager.setBreakpoint(this.cogId, address);
      this.cogState.breakpoints.add(address);
    }
  }

  /**
   * Remove a breakpoint (for multi-COG synchronization)
   */
  public removeBreakpoint(address: number): void {
    if (this.dataManager) {
      this.dataManager.clearBreakpoint(this.cogId, address);
      this.cogState.breakpoints.delete(address);
    }
  }

  /**
   * Set window position (for window arrangement)
   */
  public setPosition(x: number, y: number): void {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.setBounds({ x, y });
    }
  }

  /**
   * Focus the window
   */
  public focus(): void {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.focus();
    }
  }

  /**
   * Register a close handler
   */
  public onClose(handler: () => void): void {
    if (this.debugWindow) {
      this.debugWindow.on('closed', handler);
    }
  }

  /**
   * Handle incoming debugger protocol message
   * This method is called by MainWindow when debugger data arrives
   */
  public handleMessage(rawData: Buffer): void {
    if (!this.dataManager) {
      this.logMessage(`[DEBUGGER] Received data but data manager not initialized for COG ${this.cogId}`);
      return;
    }
    
    // Process the debugger protocol data directly through data manager
    // The data manager will parse and store the state
    try {
      // Convert buffer to appropriate format for data manager
      // Assuming the data manager handles raw debugger protocol messages
      // For now, just log that we received data
      this.logMessage(`[DEBUGGER] Received ${rawData.length} bytes of data for COG ${this.cogId}`);
      
      // Update the display
      if (this.renderer) {
        this.renderer.render();
      }
    } catch (error) {
      this.logMessage(`[DEBUGGER] Error processing data for COG ${this.cogId}: ${error}`);
    }
  }
}