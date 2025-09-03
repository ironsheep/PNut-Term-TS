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
  parseInitialMessage,
  createMemoryBlock
} from './shared/debuggerConstants';
import { DebuggerRenderer } from './shared/debuggerRenderer';
import { DebuggerProtocol } from './shared/debuggerProtocol';
import { DebuggerDataManager } from './shared/debuggerDataManager';
import { DebuggerInteraction } from './shared/debuggerInteraction';
import { MessagePool, PooledMessage } from './shared/messagePool';

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
  private protocol: DebuggerProtocol | null = null;
  private dataManager: DebuggerDataManager | null = null;
  private interaction: DebuggerInteraction | null = null;
  
  // Deferred messages queue for when components aren't ready
  private deferredMessages: any[] = [];
  private componentsReady: boolean = false;
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
    this.protocol = new DebuggerProtocol();
    
    // Mark components as ready since we've created everything needed
    // for message processing (dataManager and protocol)
    this.componentsReady = true;
    console.log(`[DEBUGGER] Components marked ready in constructor for COG ${cogId}`);
    
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
   */
  private processDebuggerPacket(data: Uint8Array): void {
    // Parse the status block (first 40 bytes)
    const cogId = data[0];
    if (cogId !== this.cogId) {
      this.logMessage(`Packet for wrong COG: ${cogId} (expected ${this.cogId})`);
      return;
    }
    
    // Extract key information from status block
    const cogState = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
    const pc = data[8] | (data[9] << 8) | (data[10] << 16) | (data[11] << 24);
    const instruction = data[12] | (data[13] << 8) | (data[14] << 16) | (data[15] << 24);
    
    // Update COG state
    this.cogState.programCounter = pc;
    this.cogState.isActive = true;
    
    // Store the packet for rendering
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
   * Render debugger display
   */
  private renderDebuggerDisplay(): void {
    if (!this.debugWindow) return;
    
    // If no renderer yet, show the packet data directly
    if (!this.renderer) {
      const displayData = this.currentDebuggerPacket ? 
        this.formatDebuggerPacketDisplay(this.currentDebuggerPacket) :
        { title: `P2 Debugger - COG ${this.cogId}`, status: 'Waiting for debug data...' };
      
      this.debugWindow.webContents.executeJavaScript(`
        (function() {
          try {
            const canvas = document.getElementById('canvas');
            if (!canvas) {
              console.error('[DEBUGGER] Canvas element not found!');
              return 'Canvas not found';
            }
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              console.error('[DEBUGGER] Could not get 2D context from canvas!');
              return 'Context not available';
            }
            
            // Clear canvas
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Show debugger info
            ctx.font = '14px monospace';
            ctx.fillStyle = '#00ff00';
            
            const displayData = ${JSON.stringify(displayData)};
            ctx.fillText(displayData.title || 'P2 Debugger', 10, 25);
            
            if (displayData.pc !== undefined) {
              ctx.fillStyle = '#ffffff';
              ctx.fillText('PC: ' + displayData.pc, 10, 50);
              ctx.fillText('State: ' + displayData.state, 10, 70);
              ctx.fillText('Instruction: ' + displayData.instruction, 10, 90);
              
              // Show some status block bytes
              if (displayData.statusHex) {
                ctx.fillStyle = '#808080';
                ctx.fillText('Status Block (first 16 bytes):', 10, 120);
                ctx.fillText(displayData.statusHex, 10, 140);
              }
            } else if (displayData.status) {
              ctx.fillStyle = '#ffff00';
              ctx.fillText(displayData.status, 10, 50);
            }
            
            return 'Success';
          } catch (error) {
            console.error('[DEBUGGER] Error in canvas rendering:', error);
            return 'Error: ' + error.message;
          }
        })()
      `).then((result) => {
        if (result !== 'Success') {
          this.logMessage(`Canvas render result: ${result}`);
        }
      }).catch((error) => {
        this.logMessage(`Error showing display: ${error}`);
      });
      return;
    }
    
    try {
      // Get the rendered text grid
      const grid = this.renderer.render();
      
      // Send grid to window for display
      this.debugWindow.webContents.executeJavaScript(`
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Clear canvas
          ctx.fillStyle = '#1e1e1e';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Render text grid
          ctx.font = '14px Parallax, monospace';
          ctx.textBaseline = 'top';
          
          const grid = ${JSON.stringify(grid)};
          for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
              const cell = grid[y][x];
              if (cell.char !== ' ') {
                ctx.fillStyle = cell.fg || '#c0c0c0';
                ctx.fillText(cell.char, x * 8, y * 16);
              }
            }
          }
        }
      `).catch((error) => {
        this.logMessage(`Error executing JavaScript: ${error}`);
      });
    } catch (error) {
      this.logMessage(`Error rendering: ${error}`);
    }
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
            background-color: #${DEBUG_COLORS.BG_DEFAULT.toString(16).padStart(6, '0')};
            color: #${DEBUG_COLORS.FG_ACTIVE.toString(16).padStart(6, '0')};
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