/** @format */

// src/classes/debugDebuggerWin.ts

import { BrowserWindow } from 'electron';
import { Context } from '../utils/context';
import { DebugWindowBase } from './debugWindowBase';
import { WindowRouter } from './shared/windowRouter';
import { WindowPlacer, PlacementConfig, PlacementStrategy } from '../utils/windowPlacer';
import {
  DebuggerInitialMessage,
  COGDebugState,
  LAYOUT_CONSTANTS,
  DEBUG_COLORS,
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
import { MessagePool, PooledMessage } from './shared/messagePool';

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
  private charWidth: number = 8;
  private charHeight: number = 16;
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
    const height = windowDetails?.height || LAYOUT_CONSTANTS.GRID_HEIGHT * 16 + 40;
    
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
    
    // Mark components as ready since we've created everything needed
    // for message processing (dataManager and protocol)
    this.componentsReady = true;
    console.log(`[DEBUGGER] Components marked ready in constructor for COG ${cogId}`);
    
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
      lastMessage: null
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
    return {
      x: gridX * this.charWidth,  // charWidth = 8
      y: gridY * this.charHeight  // charHeight = 16
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
      commands.push(`ctx.fillRect(${px},${py},${width * 8},${height * 16});`);
    }
    
    // Draw filled background for thicker borders
    if (rim > 3) {
      const bgHex = this.colorToHex(color);
      const {x: px, y: py} = this.gridToPixel(x, y);
      commands.push(`ctx.fillStyle='${bgHex}';`);
      commands.push(`ctx.fillRect(${px},${py},${width * 8},${height * 16});`);
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
    const height = region.height * this.charHeight;
    const bgHex = this.colorToHex(PASCAL_COLOR_SCHEME.cBackground);
    return `ctx.fillStyle='${bgHex}';ctx.fillRect(${x},${y},${width},${height});`;
  }

  /**
   * Get window title
   */
  protected getWindowTitle(): string {
    return `P2 Debugger - COG ${this.cogId}`;
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
      const x = Math.floor((e.clientX - rect.left) / 8);
      const y = Math.floor((e.clientY - rect.top) / 16);
      
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
      console.log(`[DEBUGGER] Data manager not ready for COG ${this.cogId}, message will be lost`);
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
    console.log(`[DEBUGGER] processQueuedMessages called but base class handles this now`);
  }
  
  /**
   * Initialize window after creation
   */
  protected async initializeWindow(): Promise<void> {
    // Core components already initialized in constructor
    // Just register with WindowRouter
    this.registerWithRouter();
    
    // Wait for DOM to be ready, then create canvas-dependent components
    this.debugWindow?.webContents.once('did-finish-load', () => {
      console.log(`[DEBUGGER] did-finish-load event fired for COG ${this.cogId}`);
      console.log(`[DEBUGGER] componentsReady already = ${this.componentsReady}`);
      console.log(`[DEBUGGER] deferred messages count = ${this.deferredMessages.length}`);
      
      // Process any deferred messages if there are any
      // (components are already ready from constructor)
      if (this.deferredMessages.length > 0) {
        console.log(`[DEBUGGER] Processing ${this.deferredMessages.length} deferred messages now`);
        this.processDeferredMessages();
      }
      
      // Now try to get the canvas and create the renderer
      this.debugWindow?.webContents.executeJavaScript(`
        const canvas = document.getElementById('canvas');
        if (canvas) {
          // Return canvas for verification
          { id: 'canvas', width: canvas.width, height: canvas.height }
        } else {
          null
        }
      `).then((canvasInfo) => {
        if (canvasInfo) {
          this.logMessage(`Canvas found: ${canvasInfo.width}x${canvasInfo.height}`);
          
          // IMMEDIATE TEST RENDERING - Show that canvas works
          this.debugWindow?.webContents.executeJavaScript(`
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Clear canvas with dark background
              ctx.fillStyle = '#1e1e1e';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Show initialization message
              ctx.font = '16px monospace';
              ctx.fillStyle = '#00ff00';
              ctx.fillText('P2 Debugger - COG ${this.cogId}', 20, 30);
              ctx.fillStyle = '#ffffff';
              ctx.fillText('Canvas initialized successfully!', 20, 60);
              ctx.fillStyle = '#ffff00';  
              ctx.fillText('Waiting for debugger data...', 20, 90);
            }
          `).catch((err) => {
            console.error('[DEBUGGER] Initial rendering failed:', err);
          });
          
          // Create a proxy canvas that will delegate to the real canvas
          // For now, we'll need to handle rendering differently
          // The renderer needs to be refactored to work with remote canvas
          
          // For now, skip renderer creation to avoid the error
          // TODO: Refactor DebuggerRenderer to work with Electron's remote canvas
          
          // TODO: Create renderer proxy that works with remote canvas via IPC
          // For now, skip renderer creation due to Electron main/renderer process separation
          // this.renderer = new DebuggerRenderer needs HTMLCanvasElement which isn't available in main process
          
          // Only create interaction if protocol and dataManager are initialized
          if (this.protocol && this.dataManager) {
            // Note: Passing null for renderer temporarily until we implement IPC-based rendering
            this.interaction = new DebuggerInteraction(
              null as any, // TODO: Implement IPC-based renderer proxy
              this.protocol,
              this.dataManager,
              this.cogId
            );
            
            // Mark basic components as ready (renderer will be added later)
            this.startUpdateLoop();
            
            // Components already marked ready above
            console.log(`[DEBUGGER] Core components initialized and ready for COG ${this.cogId}`);
          } else {
            console.warn('[DEBUGGER] Cannot create interaction - missing required components');
          }
        } else {
          console.error(`[DEBUGGER] Canvas element not found for COG ${this.cogId}`);
        }
      }).catch((error) => {
        console.error(`[DEBUGGER] Failed to get canvas for COG ${this.cogId}:`, error);
      });
    });
    
    // Set up IPC handlers for keyboard/mouse
    this.setupIPCHandlers();
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
   * Send debug command to P2
   */
  private sendDebugCommand(command: string): void {
    if (!this.protocol) return;
    
    // Route command through protocol handler
    switch (command) {
      case 'GO':
        this.protocol.sendGo(this.cogId);
        break;
      case 'BREAK':
        this.protocol.sendBreak(this.cogId);
        break;
      case 'DEBUG':
        // Debug mode not implemented
        console.log('Debug toggle');
        break;
      case 'INIT':
        this.protocol.sendStall(this.cogId);
        break;
      case 'STEP_INTO':
        this.protocol.sendBreak(this.cogId);
        break;
      case 'STEP_OVER':
        this.protocol.sendBreak(this.cogId);
        break;
    }
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
    // Check if this is a 416-byte debugger packet
    if (data.length === 416) {
      this.processDebuggerPacket(data);
    }
    // Check if this is a 20-long initial message
    else if (data.length >= 80) { // 20 longs * 4 bytes
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
      title: `P2 Debugger - COG ${cogId}`,
      pc: `$${pc.toString(16).padStart(8, '0').toUpperCase()}`,
      state: `$${cogState.toString(16).padStart(8, '0').toUpperCase()}`,
      instruction: `$${instruction.toString(16).padStart(8, '0').toUpperCase()}`,
      statusHex: statusHex
    };
  }
  
  /**
   * Process a 416-byte debugger packet
   * Packet structure:
   * - Bytes 0-79: 20 longs containing DebuggerMsg array
   * - Bytes 80-415: COG/LUT memory snapshots
   */
  private processDebuggerPacket(data: Uint8Array): void {
    if (data.length !== 416) {
      this.logMessage(`Invalid packet size: ${data.length} (expected 416)`);
      return;
    }
    
    // Create DataView for proper little-endian reading
    const view = new DataView(data.buffer, data.byteOffset, data.length);
    
    // Parse the 20 initial longs (indices from DebuggerMessageIndex enum)
    const debugMsg = {
      cogNumber: view.getUint32(0, true),      // mCOGN
      breakStatus: view.getUint32(4, true),    // mBRKS
      stackAStart: view.getUint32(8, true),    // mSTAS
      stackBStart: view.getUint32(12, true),   // mSTBS
      callDepth: view.getUint32(16, true),     // mCALL
      programCounter: view.getUint32(20, true), // mPC
      skipPattern: view.getUint32(24, true),   // mSKIP
      registerA: view.getUint32(28, true),     // mREGA
      registerB: view.getUint32(32, true),     // mREGB
      pointerA: view.getUint32(36, true),      // mPTRA
      pointerB: view.getUint32(40, true),      // mPTRB
      directionA: view.getUint32(44, true),    // mDIRA
      directionB: view.getUint32(48, true),    // mDIRB
      outputA: view.getUint32(52, true),       // mOUTA
      outputB: view.getUint32(56, true),       // mOUTB
      inputA: view.getUint32(60, true),        // mINA
      inputB: view.getUint32(64, true),        // mINB
      flags: view.getUint32(68, true),         // mFLAG
      interruptJump: view.getUint32(72, true), // mIJMP
      conditionCodes: view.getUint32(76, true) // mCOND
    };
    
    // Check if this packet is for our COG
    if (debugMsg.cogNumber !== this.cogId) {
      this.logMessage(`Packet for wrong COG: ${debugMsg.cogNumber} (expected ${this.cogId})`);
      return;
    }
    
    // Update COG state
    this.cogState.programCounter = debugMsg.programCounter;
    this.cogState.isActive = true;
    this.cogState.isBreaked = (debugMsg.breakStatus & 0x01) !== 0;
    this.cogState.skipPattern = debugMsg.skipPattern;
    this.cogState.callDepth = debugMsg.callDepth;
    
    // Store parsed data in dataManager
    if (this.dataManager) {
      // Store status data
      this.dataManager.updateStatusData({
        cogId: debugMsg.cogNumber,
        breakStatus: debugMsg.breakStatus,
        programCounter: debugMsg.programCounter,
        skipPattern: debugMsg.skipPattern,
        flags: debugMsg.flags,
        pointerA: debugMsg.pointerA,
        pointerB: debugMsg.pointerB,
        directionA: debugMsg.directionA,
        directionB: debugMsg.directionB,
        outputA: debugMsg.outputA,
        outputB: debugMsg.outputB,
        inputA: debugMsg.inputA,
        inputB: debugMsg.inputB
      });
      
      // Parse and store COG registers (bytes 80-335, 64 longs)
      for (let i = 0; i < 64; i++) {
        const offset = 80 + i * 4;
        if (offset + 4 <= data.length) {
          const value = view.getUint32(offset, true);
          this.dataManager.updateCogRegister(i, value);
        }
      }
      
      // Parse and store LUT registers (bytes 336-415, 20 longs)
      // Note: 416-byte packet structure limits LUT data to 20 longs, not 64
      const lutLongCount = Math.min(64, (data.length - 336) / 4);
      for (let i = 0; i < lutLongCount; i++) {
        const offset = 336 + i * 4;
        if (offset + 4 <= data.length) {
          const value = view.getUint32(offset, true);
          this.dataManager.updateLutRegister(i, value);
        }
      }
    }
    
    // Store the packet for reference
    this.currentDebuggerPacket = data;
    
    // Trigger immediate display update
    this.renderDebuggerDisplay();
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
   */
  private updateCogState(message: DebuggerInitialMessage): void {
    if (!this.dataManager) return;
    
    // Update data manager with new state
    // Process initial message - store in state
    // processInitialMessage not implemented
    
    // Update local state copy
    this.cogState.lastMessage = message;
    this.cogState.programCounter = message.programCounter;
    this.cogState.skipPattern = message.skipPattern;
    this.cogState.callDepth = message.callDepth;
    this.cogState.isActive = true;
    this.cogState.isBreaked = (message.breakStatus & 0x01) !== 0;
    
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
    <title>P2 Debugger - COG ${this.cogId}</title>
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
    const width = windowDetails?.width || LAYOUT_CONSTANTS.GRID_WIDTH * 8 + 20;
    const height = windowDetails?.height || LAYOUT_CONSTANTS.GRID_HEIGHT * 16 + 40;
    
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
    }
    
    this.logMessage(`Creating debugger window for COG ${this.cogId}: ${width}x${height} at ${x},${y}`);
    
    this.debugWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      title: `P2 Debugger - COG ${this.cogId}`,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    // Register with WindowPlacer for position tracking
    const windowPlacer = WindowPlacer.getInstance();
    windowPlacer.registerWindow(`debugger-cog${this.cogId}`, this.debugWindow);
    
    // Set up window content
    const html = this.getHTML();
    this.debugWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    // Hook window events
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage(`Debugger window for COG ${this.cogId} ready to show`);
      this.debugWindow?.show();
      // Initialize window after it's shown
      this.initializeWindow();
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
      console.log(`[DEBUGGER] Processing ${this.deferredMessages.length} deferred messages for COG ${this.cogId}`);
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
   * Handles both PooledMessage objects and raw data for backward compatibility
   */
  protected processMessageImmediate(data: any): void {
    // Check if window components are initialized
    if (!this.componentsReady || !this.dataManager || !this.protocol) {
      console.warn(`[DEBUGGER] Window components not ready for COG ${this.cogId}, deferring message`);
      
      // Store the message for later processing
      this.deferredMessages.push(data);
      
      // Messages will be processed when components are ready (in did-finish-load event)
      // No timer needed - event-driven approach
      
      return;
    }
    
    let actualData: any;
    let pooledMessage: PooledMessage | null = null;
    
    // Check if this is a PooledMessage that needs to be released
    if (data && typeof data === 'object' && 'poolId' in data && 'consumerCount' in data) {
      pooledMessage = data as PooledMessage;
      actualData = pooledMessage.data;
      console.log(`[DEBUGGER] Received pooled message #${pooledMessage.poolId}, consumers: ${pooledMessage.consumersRemaining}`);
    } else {
      actualData = data;
    }
    
    try {
      // Route through the main message handler
      this.handleDebuggerMessage(actualData);
    } catch (error) {
      console.error(`[DEBUGGER] Error processing message: ${error}`);
    } finally {
      // Always release the pooled message if we have one
      if (pooledMessage) {
        try {
          const messagePool = MessagePool.getInstance();
          const wasLastConsumer = messagePool.release(pooledMessage);
          if (wasLastConsumer) {
            console.log(`[DEBUGGER] Released pooled message #${pooledMessage.poolId} (last consumer)`);
          } else {
            console.log(`[DEBUGGER] Released pooled message #${pooledMessage.poolId}, ${pooledMessage.consumersRemaining} consumers remaining`);
          }
        } catch (releaseError) {
          console.error(`[DEBUGGER] Error releasing pooled message: ${releaseError}`);
        }
      }
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