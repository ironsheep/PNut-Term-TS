/** @format */

// src/classes/debugDebuggerWin.ts

import { BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Context } from '../utils/context';
import { DebugWindowBase } from './debugWindowBase';
import {
  IPC_CHANNELS,
  MainToRendererMessage,
  RendererToMainMessage
} from './debugger/shared/ipc';
import { WindowRouter } from './shared/windowRouter';
import { WindowPlacer, PlacementConfig, PlacementStrategy } from '../utils/windowPlacer';
import {
  COGDebugState,
  LAYOUT_CONSTANTS,
  PASCAL_COLOR_SCHEME,
  createMemoryBlock
} from './shared/debuggerConstants';
import { CanvasRenderer } from './shared/canvasRenderer';
import { ExtractedMessage } from './shared/sharedMessagePool';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

/**
 * Layout region definition
 */
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
  // Core debugger components. The renderer bundle (debugger/renderer/) owns all
  // state, parsing, and rendering; this window is just the main-process bridge.
  private canvasRenderer: CanvasRenderer;
  private awaitingPhase3: boolean = false;  // Flag for expecting Phase 3 data

  // Deferred messages queue for when components aren't ready
  private deferredMessages: any[] = [];
  private componentsReady: boolean = false;

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
    
    // The renderer bundle owns parsing, state, and rendering. Main only needs
    // the canvas-renderer util and to mark itself ready to forward packets.
    this.canvasRenderer = new CanvasRenderer();
    this.componentsReady = true;
    this.logConsoleMessage(`[DEBUGGER] Components marked ready in constructor for COG ${cogId}`);
    
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
   * Queue initial message before window is ready
   * DEPRECATED: Use updateContent() instead which handles queuing automatically
   */
  public queueInitialMessage(data: Uint8Array): void {
    // Base class handles queuing via updateContent()
    this.updateContent(data);
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
   * Initialize window after creation
   * NOTE: No longer used - initialization now happens via:
   *   - did-finish-load -> initializeRenderer() (sends 'initialize' to the bundle)
   *   - ready-to-show -> registerWithRouter()
   * Kept for interface compatibility with base class
   */
  protected async initializeWindow(): Promise<void> {
    // All initialization now happens in proper event handlers
    // See createDebugWindow() for the correct event wiring
    this.logConsoleMessage(`[DEBUGGER] initializeWindow called (legacy - no action needed)`);
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
    // The renderer bundle owns all parsing, state, and rendering. Main only
    // routes raw packets to it: Phase 3 continuations while awaitingPhase3 (set
    // by the bundle's phase2 reply in handleRendererMessage, cleared on
    // phase3Complete), otherwise Phase 1 packets (pnut_ts emits 416 bytes;
    // Pascal documents 456 — accept either).
    //
    // CRITICAL: the router hands us a zero-copy Uint8Array view onto the
    // SharedMessagePool's SharedArrayBuffer. We MUST copy it into an owned,
    // non-shared buffer before doing anything else, for TWO reasons:
    //   1. webContents.send (IPC to the renderer bundle) cannot structured-clone
    //      a SharedArrayBuffer-backed typed array — it throws "Failed to
    //      serialize arguments", so the renderer never receives the packet and
    //      the window sits at "awaiting first breakpoint" forever.
    //   2. The pool reuses this slot once processMessageImmediate returns, so any
    //      view buffered in pendingPhase1/pendingPhase3 (renderer not yet ready)
    //      would read clobbered bytes on drain.
    // new Uint8Array(view) allocates a fresh regular ArrayBuffer and copies.
    const owned = new Uint8Array(data);
    // DIAGNOSTIC (build A): log EVERY binary message the router delivers to this
    // window. Correlate with the USB-traffic log: if the P2 streams Phase 3 bytes
    // but none show up here, the extractor is dropping/misrouting them (no Phase 3
    // framing path) — the suspected data-region defect.
    const first16 = Array.from(owned.slice(0, 16)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
    this.debugLog(`RX binary len=${owned.length} awaitingP3=${this.awaitingPhase3} first16=[${first16}]`);
    if (this.awaitingPhase3) {
      this.forwardPhase3ToRenderer(owned);
      return;
    }
    if (owned.length === 416 || owned.length === 456) {
      this.forwardPhase1ToRenderer(owned);
    } else {
      this.debugLog(`RX binary len=${owned.length} DID NOT match Phase 1 (416/456) and not awaitingP3 — DROPPED`);
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
   * Generate HTML content for the debugger window.
   *
   * The page is minimal: a canvas + status bar + the inlined renderer
   * bundle (`dist/debugger-renderer.js`). All logic — state machine,
   * rendering, keyboard/mouse handling, Phase 1/2/3 protocol — lives in
   * the bundle. Main process only forwards data via IPC.
   *
   * See `src/classes/debugger/renderer/index.ts` for the bundle entry.
   */
  public getHTML(): string {
    const bundleJs = this.readRendererBundle();
    const bg = `#${PASCAL_COLOR_SCHEME.cBackground.toString(16).padStart(6, '0')}`;
    const fg = `#${PASCAL_COLOR_SCHEME.cData.toString(16).padStart(6, '0')}`;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Debugger - Cog ${this.cogId}</title>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; }
    body {
      background-color: ${bg};
      color: ${fg};
      font-family: 'Parallax', 'Courier New', monospace;
      font-size: 14px;
      user-select: none;
    }
    #canvas {
      display: block;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    #status-bar {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      height: 20px;
      padding: 2px 8px;
      background-color: #222;
      color: #888;
      font-size: 12px;
      border-top: 1px solid #444;
    }
  </style>
</head>
<body>
  <canvas id="canvas" width="984" height="616"></canvas>
  <div id="status-bar">Cog ${this.cogId} — bundle:loading</div>
  <pre id="bundle-error" style="position:fixed;top:0;left:0;right:0;padding:8px;margin:0;background:#400;color:#fbb;font:12px/1.3 monospace;white-space:pre-wrap;display:none;z-index:10"></pre>
  <script>
    (function () {
      var err = document.getElementById('bundle-error');
      var status = document.getElementById('status-bar');
      function show(msg) {
        if (err) { err.style.display = 'block'; err.textContent = msg; }
        if (status) { status.textContent = 'Cog ${this.cogId} — bundle ERROR (see overlay/devtools)'; }
      }
      window.addEventListener('error', function (e) {
        show((e && e.message) + '\\n' + (e && e.error && e.error.stack ? e.error.stack : ''));
      });
      window.addEventListener('unhandledrejection', function (e) {
        var r = e && e.reason;
        show('UnhandledRejection: ' + (r && r.message ? r.message : r) + '\\n' + (r && r.stack ? r.stack : ''));
      });
    })();
  </script>
  <script>
${bundleJs}
  </script>
</body>
</html>`;
  }

  /**
   * Read the renderer bundle JS from disk and return its contents for
   * inlining into the window's HTML. Works in both dev (dist/ in repo)
   * and packaged modes (dist/ in app Resources) because __dirname always
   * resolves to the dist directory containing the compiled main bundle.
   */
  private readRendererBundle(): string {
    const bundlePath = path.join(__dirname, 'debugger-renderer.js');
    try {
      return fs.readFileSync(bundlePath, 'utf8');
    } catch (error) {
      this.logConsoleMessage(`[DEBUGGER] FATAL: renderer bundle not found at ${bundlePath}: ${error}`);
      // Fall back to a loud placeholder so the window isn't silently blank
      return `
        document.body.style.background = '#400';
        document.body.style.color = '#f88';
        document.body.innerHTML = '<h2 style="padding:20px">Debugger bundle missing at ${bundlePath.replace(/\\/g, '/')}.<br>Build did not produce dist/debugger-renderer.js.</h2>';
      `;
    }
  }

  // ============================================================================
  // Bundle ↔ main IPC
  //
  // The renderer bundle owns the window UI. Main forwards Phase 1/3 packet
  // bytes in and receives Phase 2 bytes (plus COGBRK requests, log lines)
  // back out. See src/classes/debugger/shared/ipc.ts for the full contract.
  // ============================================================================

  /** Whether the renderer bundle has reported DOMContentLoaded + initialize. */
  private rendererReady: boolean = false;
  /** Buffered incoming packets while the renderer is still starting up. */
  private pendingPhase1: Uint8Array[] = [];
  private pendingPhase3: Uint8Array[] = [];
  /** Listener handle so we can remove it on window close. */
  private ipcListener: ((event: Electron.IpcMainEvent, message: RendererToMainMessage) => void) | null = null;

  /**
   * Wire up the main-side IPC listener for messages from the renderer bundle.
   * Called once after the BrowserWindow is created.
   */
  private installBundleIpc(): void {
    const listener = (event: Electron.IpcMainEvent, message: RendererToMainMessage): void => {
      // Only respond to messages from our own window — multiple debugger
      // windows share the ipcMain dispatcher, so we must filter by sender.
      if (!this.debugWindow || event.sender.id !== this.debugWindow.webContents.id) {
        return;
      }
      this.handleRendererMessage(message);
    };
    ipcMain.on(IPC_CHANNELS.rendererToMain, listener);
    this.ipcListener = listener;
  }

  /** Tear down the IPC listener when the window closes. */
  private removeBundleIpc(): void {
    if (this.ipcListener) {
      ipcMain.removeListener(IPC_CHANNELS.rendererToMain, this.ipcListener);
      this.ipcListener = null;
    }
  }

  /**
   * Route a diagnostic line into the shared debug log file via LoggerWindow so
   * renderer-bundle lifecycle events are visible alongside WINDOW_PLACED and
   * formatted packet dumps. Avoids the silent-stdout dead-end of logMessage/
   * logConsoleMessage in packaged builds.
   */
  private debugLog(msg: string): void {
    try {
      const LoggerWindow = require('./loggerWin').LoggerWindow;
      const debugLogger = LoggerWindow.getInstance(this.context);
      debugLogger.logSystemMessage(`[DEBUGGER COG${this.cogId}] ${msg}`);
    } catch {
      // Logger not yet available — swallow rather than crash the debugger window.
    }
  }

  private handleRendererMessage(message: RendererToMainMessage): void {
    switch (message.kind) {
      case 'ready': {
        this.rendererReady = true;
        this.debugLog(`renderer 'ready' received (pending ph1=${this.pendingPhase1.length} ph3=${this.pendingPhase3.length})`);
        // Drain any buffered packets that arrived before the bundle was ready.
        for (const bytes of this.pendingPhase1) this.sendToRenderer({ kind: 'phase1', bytes });
        for (const bytes of this.pendingPhase3) this.sendToRenderer({ kind: 'phase3', bytes });
        this.pendingPhase1 = [];
        this.pendingPhase3 = [];
        break;
      }
      case 'phase2':
        // Renderer bundle built the 52-byte reply; push it onto the TX ring
        // via the same TLongTransmitter the old path used. The base class
        // exposes tLongTransmitter from DebugWindowBase — both transmit
        // paths land on the same sendSerialData callback wired by
        // mainWindow.setSerialTransmissionCallback().
        try {
          this.tLongTransmitter.transmitBuffer(message.bytes);
          // With the cut-over complete, we expect Phase 3 next.
          this.awaitingPhase3 = true;
          // DIAGNOSTIC (build A): mark the Phase 2 TX → Phase 3 boundary so the
          // log timeline lines up with the USB-traffic capture.
          this.debugLog(`PHASE2 transmitted (${message.bytes.length}B) → awaitingPhase3=true`);
        } catch (error) {
          this.logConsoleMessage(`[DEBUGGER] Error transmitting Phase 2 from bundle: ${error}`);
        }
        break;
      case 'setCogBrk':
        // Forward the user's COGBRK request to the main-process broadcast
        // so every open debugger window includes it in its next Phase 2.
        this.emit('setGlobalCogBrk', { mask: message.mask, originCogId: this.cogId });
        break;
      case 'phase3Complete':
        // Bundle finished parsing Phase 3. The next 416-byte chunk is a
        // new Phase 1 (not a Phase 3 continuation).
        this.awaitingPhase3 = false;
        // Close the worker's raw-passthrough transaction so the next phase1 is
        // framed normally (see DebugDebuggerWindow ctor wiring in mainWindow).
        this.emit('debuggerPhase3Done', { cogId: this.cogId });
        this.debugLog(`PHASE3 complete → awaitingPhase3=false, transaction closed`);
        break;
      case 'log':
        this.debugLog(`[R/${message.level}] ${message.msg}`);
        break;
      default: {
        const _exhaustive: never = message;
        void _exhaustive;
        break;
      }
    }
  }

  /** Send a typed message to the renderer bundle. Safe to call before 'ready'. */
  private sendToRenderer(message: MainToRendererMessage): void {
    if (!this.debugWindow || this.debugWindow.isDestroyed()) return;
    this.debugWindow.webContents.send(IPC_CHANNELS.mainToRenderer, message);
  }

  /**
   * Forward a Phase 1 packet (456 bytes) to the renderer bundle. If the
   * bundle hasn't finished initializing yet, buffer and replay on 'ready'.
   */
  private forwardPhase1ToRenderer(bytes: Uint8Array): void {
    if (!this.rendererReady) {
      this.pendingPhase1.push(bytes);
      return;
    }
    this.sendToRenderer({ kind: 'phase1', bytes });
  }

  /** Forward Phase 3 data to the renderer bundle. */
  private forwardPhase3ToRenderer(bytes: Uint8Array): void {
    if (!this.rendererReady) {
      this.pendingPhase3.push(bytes);
      return;
    }
    this.sendToRenderer({ kind: 'phase3', bytes });
  }

  /**
   * Broadcast a COGBRK mask into this window's renderer. Called by the
   * main-process coordinator when ANY other debugger window requests a
   * cross-cog async break (§3.9). The mask is OR'd into the renderer's
   * pending requestCogBrk and included in its next Phase 2 reply.
   */
  public broadcastCogBrk(mask: number): void {
    this.sendToRenderer({ kind: 'cogBrkBroadcast', mask });
  }

  /**
   * Tell the renderer bundle to invalidate all per-cog state. Called on
   * DTR/RTS reset so the next Phase 1 is treated as a fresh first-break.
   */
  public broadcastReset(): void {
    this.sendToRenderer({ kind: 'reset' });
    this.awaitingPhase3 = false;
    this.rendererReady = true; // bundle stays alive; just its state is reset
    this.pendingPhase1 = [];
    this.pendingPhase3 = [];
  }

  /**
   * Send the one-shot 'initialize' message to the renderer bundle. Called
   * from did-finish-load. The renderer won't render anything until it has
   * received this.
   */
  private initializeRenderer(): void {
    this.sendToRenderer({
      kind: 'initialize',
      cogId: this.cogId,
      windowId: `debugger-${this.cogId}-${Date.now()}`,
      // Initial BRK condition matches what the compiler patched into _brkcond_.
      // We'll get the authoritative value from the first breakpoint's mCOND.
      initialBreakCond: 0x001,
      debugBaud: 2_000_000
    });
  }
  
  /**
   * Create the Electron BrowserWindow
   */
  private createDebugWindow(windowDetails?: any): void {
    // Calculate content dimensions
    const contentWidth = windowDetails?.width || LAYOUT_CONSTANTS.GRID_WIDTH * 8;
    const contentHeight = windowDetails?.height || LAYOUT_CONSTANTS.GRID_HEIGHT * 8; // half-rows * 8px

    // Size by CLIENT area + useContentSize:true on the BrowserWindow (Electron
    // adds OS chrome). The old +20w/+40h outer-size estimate left the web
    // content wider than our drawing on macOS (no side borders), which plain
    // SAVE captured as a white right/bottom edge. Matches the FFT window.
    const windowDimensions = { width: contentWidth, height: contentHeight };
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
      useContentSize: true, // width/height are the client area; Electron adds OS chrome (no white SAVE overhang)
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        devTools: true,
        // Keep the renderer painting + rAF firing while occluded so SAVE captures a fresh frame.
        backgroundThrottling: false
      }
    });

    // Diagnostic only: a DETACHED DevTools window steals OS keyboard focus on
    // open, so the debugger page never receives keydown (Enter/Space and every
    // other key are dead) until the user clicks back into the window. The
    // renderer bundle is proven stable, so DevTools is OFF by default; opt in
    // with PNUT_DEBUGGER_DEVTOOLS=1. (devTools:true above still allows manual
    // open via the menu / F12.)
    if (process.env.PNUT_DEBUGGER_DEVTOOLS === '1') {
      this.debugWindow.webContents.openDevTools({ mode: 'detach' });
    }

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
      this.debugLog(`did-finish-load — sending 'initialize' to bundle`);
      // Kick the renderer bundle — it's been waiting for `initialize` since
      // DOMContentLoaded. After this the bundle will paint its placeholder
      // and start accepting Phase 1/3 packets.
      this.initializeRenderer();
    });

    // Hook window events
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage(`Debugger window for COG ${this.cogId} ready to show`);
      this.debugWindow?.show();
      // Register with router. Keyboard/mouse are owned by the renderer bundle
      // (typed IPC); no main-process input handlers needed.
      this.registerWithRouter();
    });

    this.debugWindow.on('closed', () => {
      this.logMessage(`Debugger window for COG ${this.cogId} closed`);
      this.removeBundleIpc();
      this.closeDebugWindow();
    });

    // Listen for messages from the renderer bundle. Install BEFORE the page
    // loads so we don't miss the bundle's DOMContentLoaded log line.
    this.installBundleIpc();
  }
  
  /**
   * Required abstract method - close window
   */
  public closeDebugWindow(): void {
    // Clear deferred messages
    this.deferredMessages = [];
    this.componentsReady = false;

    // Unregister from WindowRouter
    this.windowRouter.unregisterWindow(this.windowId);
    
    // Close the window
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
    }
    
    this.logMessage(`DebugDebuggerWindow closed for COG ${this.cogId}`);
  }

  /**
   * Required abstract method - update content
   * Receives ExtractedMessage from router (router handles SharedMessagePool release)
   */
  protected async processMessageImmediate(data: any): Promise<void> {
    // Check if window components are initialized
    if (!this.componentsReady) {
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

}