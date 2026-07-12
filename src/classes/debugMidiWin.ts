/**
 * @file debugMidiWin.ts
 * @description MIDI keyboard debug window for viewing note-on/off status with velocity
 *
 * This window displays a piano keyboard that visualizes MIDI note events in real-time.
 * It implements the exact behavior of the Pascal MIDI debug window including:
 * - Variable-size piano keyboard (SIZE 1-50)
 * - Configurable key range (default 21-108 for 88-key piano)
 * - MIDI channel filtering (0-15)
 * - Velocity visualization as colored bars
 * - MIDI note numbers displayed on keys
 *
 * MIDI Protocol:
 * - Note-on: 0x90 + channel, followed by note (0-127) and velocity (0-127)
 * - Note-off: 0x80 + channel, followed by note and velocity
 *
 * Future enhancements (not in Pascal implementation):
 * - Mouse interaction: Click keys to send MIDI (mouse down = note-on velocity 64, mouse up = note-off)
 * - Multi-channel support: Monitor multiple channels with different colors per channel
 */

import { BrowserWindow } from 'electron';
import { Context } from '../utils/context';
import { DebugWindowBase, Position, Size } from './debugWindowBase';
import { PianoKeyboardLayout, KeyInfo } from './shared/pianoKeyboardLayout';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { DisplaySpecParser, BaseDisplaySpec } from './shared/displaySpecParser';
import { CanvasRenderer } from './shared/canvasRenderer';
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

export interface MidiDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  position: Position;
  hasExplicitPosition: boolean; // true if POS clause was present
  size: Size;
  keySize: number; // Keyboard size (1-50, affects key width)
  keyRange: { first: number; last: number }; // Key range (0-127, default 21-108)
  channel: number; // MIDI channel to monitor (0-15, default 0)
  keyColors: { white: number; black: number }; // Key colors in RGB
}

/**
 * Debug MIDI Window - MIDI Keyboard Visualization
 *
 * Displays a piano keyboard that visualizes MIDI note events in real-time with velocity indication.
 * Supports configurable keyboard size, key range, channel filtering, and mouse interaction for MIDI output.
 *
 * ## Features
 * - **Piano Keyboard Display**: Variable-size keyboard (SIZE 1-50) with 88-key default range
 * - **MIDI Protocol Support**: Standard MIDI note-on/off message parsing (0x80-0x90)
 * - **Channel Filtering**: Monitor specific MIDI channels (0-15) with color coding
 * - **Velocity Visualization**: Colored velocity bars showing note intensity (0-127)
 * - **Key Labeling**: MIDI note numbers displayed on piano keys
 * - **Mouse Interaction**: Click keys to generate MIDI output (note-on/off)
 *
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE keysize` - Set keyboard size (1-50, affects key width, default: 4)
 * - `RANGE first last` - Set key range (0-127, default: 21-108 for 88-key piano)
 * - `CHANNEL ch` - Set MIDI channel to monitor (0-15, default: 0)
 * - `COLOR bg {key_color}` - Background and key colors
 * - `HIDEXY` - Hide coordinate display
 *
 * ## Data Format
 * MIDI data is fed as standard MIDI protocol messages:
 * - Note-on: 0x90 + channel, followed by note (0-127) and velocity (0-127)
 * - Note-off: 0x80 + channel, followed by note and velocity (ignored)
 * - Data can be fed byte-by-byte or as complete MIDI messages
 * - Example: `debug(\`MyMIDI \`($90, note, velocity))  ' Note-on`
 *
 * ## Commands
 * - `CLEAR` - Clear all active notes and reset keyboard display
 * - `UPDATE` - Force display update (when UPDATE directive is used)
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Enable keyboard input forwarding to P2
 * - `PC_MOUSE` - Enable mouse input forwarding to P2
 * - `CHANNEL ch` - Change monitored MIDI channel during runtime
 * - `RANGE first last` - Change key range during runtime
 * - MIDI bytes: Direct MIDI protocol data (0x80-0x9F for note events)
 *
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `MIDI_Configure` procedure (line 2484)
 * - Update: `MIDI_Update` procedure (line 2582)
 * - Note handling: `MIDI_Note_Process` procedures
 * - Keyboard rendering: `MIDI_Draw_Keyboard` procedures
 *
 * ## Examples
 * ```spin2
 * ' Basic MIDI keyboard monitor
 * debug(`MIDI MyKeyboard SIZE 6 RANGE 36 84 CHANNEL 0)
 *
 * ' Send note-on and note-off
 * note := 60  ' Middle C
 * velocity := 100
 * debug(`MyKeyboard \`($90, note, velocity))  ' Note-on
 * waitms(500)
 * debug(`MyKeyboard \`($80, note, 0))        ' Note-off
 *
 * ' Monitor multiple notes
 * repeat
 *   debug(`MyKeyboard \`($90, 60, 100))  ' C
 *   debug(`MyKeyboard \`($90, 64, 80))   ' E
 *   debug(`MyKeyboard \`($90, 67, 90))   ' G
 * ```
 *
 * ## Implementation Notes
 * - Implements exact Pascal MIDI debug window behavior including key layout
 * - MIDI state machine parses incoming bytes according to MIDI protocol
 * - Velocity bars use color intensity to show note velocity (0-127)
 * - Piano keyboard layout handles both white and black key positioning
 * - Mouse coordinates are transformed to MIDI note numbers for interaction
 * - Supports future enhancements: multi-channel display with color coding
 *
 * ## Deviations from Pascal
 * - Enhanced mouse interaction for bidirectional MIDI communication
 * - Additional velocity visualization options and color schemes
 * - Improved keyboard layout calculations for various screen resolutions
 *
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_MIDI.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugMidiWindow extends DebugWindowBase {
  // Display specification
  private displaySpec: MidiDisplaySpec;

  // Window properties
  protected midiWindowId: number = 0; // Rename to avoid conflict with base class
  protected _windowTitle: string = 'MIDI';
  protected vWidth: number = 256;
  protected vHeight: number = 256;
  protected vColor: number[] = [0x00ffff, 0xff00ff, 0, 0, 0, 0, 0, 0]; // Cyan, Magenta
  protected pcKeyEnabled: boolean = false;
  protected pcMouseEnabled: boolean = false;

  // MIDI-specific properties
  private midiSize: number = 4; // Keyboard size (1-50)
  private midiKeyFirst: number = 21; // First key to display (0-127)
  private midiKeyLast: number = 108; // Last key to display (0-127)
  private midiChannel: number = 0; // MIDI channel to monitor (0-15)
  private midiState: number = 0; // State machine for MIDI parsing
  private midiNote: number = 0; // Current note being processed
  private midiVelocity: number[] = new Array(128).fill(0); // Velocity for each key

  // Keyboard layout
  private keySize: number = 0;
  private keyLayout: Map<number, KeyInfo> | null = null;
  private keyOffset: number = 0;
  private whiteKeyColor: number = 0x00ffff; // Cyan
  private blackKeyColor: number = 0xff00ff; // Magenta

  // Canvas properties (transitional - keeping old properties for compatibility)
  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private canvasRenderer: CanvasRenderer = new CanvasRenderer();

  // Track canvas initialization state to prevent race conditions
  private canvasInitialized: boolean = false;
  private pendingDrawRequest: boolean = false;
  private pendingClear: boolean = false;

  constructor(ctx: Context, displaySpec: MidiDisplaySpec, windowId?: string) {
    // Use the user-provided display name as the window ID (the unique routing key), matching
    // TERM/LOGIC. The old `midi-${Date.now()}` default collided when two same-type windows were
    // created in the same millisecond → "Window … is already registered". [windowid-datenow-collision]
    const actualWindowId = windowId || displaySpec.displayName;
    super(ctx, actualWindowId, 'midi');

    this.displaySpec = displaySpec;

    // Disable logging for MIDI window
    this.isLogging = false;

    // Initialize MIDI configuration from displaySpec
    this.midiSize = displaySpec.keySize;
    this.midiKeyFirst = displaySpec.keyRange.first;
    this.midiKeyLast = displaySpec.keyRange.last;
    this.midiChannel = displaySpec.channel;
    this.whiteKeyColor = displaySpec.keyColors.white;
    this.blackKeyColor = displaySpec.keyColors.black;
    // The draw reads vColor[0]/[1]; seed them from the spec so a create-time COLOR
    // directive (Pascal vColor[0]/vColor[1]) actually colors the keys. [9win §7]
    this.vColor[0] = displaySpec.keyColors.white;
    this.vColor[1] = displaySpec.keyColors.black;
    this._windowTitle = displaySpec.windowTitle;
    this.vWidth = displaySpec.size.width;
    this.vHeight = displaySpec.size.height;

    // Calculate initial key size using Pascal formula
    this.keySize = 8 + this.midiSize * 4; // MidiSizeBase=8, MidiSizeFactor=4

    // Window ID will be set by MainWindow
    this.midiWindowId = Date.now() % 1000000;

    // Calculate keyboard layout BEFORE creating window to get correct dimensions
    this.updateKeyboardLayout();

    // Create the actual BrowserWindow (now with correct dimensions)
    this.createDebugWindow();

    // Readiness is marked from registerWithRouter() in the ready-to-show handler, which
    // fires AFTER did-finish-load initializes the canvas. Marking ready HERE in the
    // constructor (before the canvas exists) lets content drawn in the gap be silently
    // dropped against a not-yet-initialized context — the blank-window class bug found in
    // TERM. Matches the working PLOT/BITMAP/SCOPE_XY pattern. [class-fix: premature-ready]
  }

  // Getter for window title
  get windowTitle(): string {
    return this._windowTitle;
  }

  // Setter for window title
  set windowTitle(title: string) {
    this._windowTitle = title;
    this.setWindowTitle(title);
  }

  /**
   * Create and configure the MIDI window using standard BrowserWindow pattern
   */
  createDebugWindow(): void {
    this.logMessage(`Creating MIDI debug window: ${this._windowTitle}`);

    let x = 0;
    let y = 0;

    // Use WindowPlacer for intelligent positioning
    const windowPlacer = WindowPlacer.getInstance();
    const placementConfig: PlacementConfig = {
      dimensions: { width: this.vWidth, height: this.vHeight },
      cascadeIfFull: true
    };
    const position = windowPlacer.getNextPosition(`midi-${this.windowId}`, placementConfig);
    x = position.x;
    y = position.y;

    // Log to debug logger with reproducible command format
    try {
      const LoggerWindow = require('./loggerWin').LoggerWindow;
      const debugLogger = LoggerWindow.getInstance(this.context);
      const monitorId = position.monitor ? position.monitor.id : '1';
      debugLogger.logSystemMessage(
        `WINDOW_PLACED (${x},${y} ${this.vWidth}x${this.vHeight} Mon:${monitorId}) MIDI '${this.displaySpec.displayName}' POS ${x} ${y} SIZE ${this.vWidth} ${this.vHeight}`
      );
    } catch (error) {
      console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
    }

    // Add status bar height (20px + 2px border) to ensure no scrollbar
    const STATUS_BAR_HEIGHT = 22;
    // Size by CLIENT area + useContentSize:true on the BrowserWindow (Electron
    // adds OS chrome). The old +20w/+40h outer-size estimate left the web
    // content wider than our drawing on macOS (no side borders), which plain
    // SAVE captured as a white right/bottom edge. Matches the FFT window.
    const windowDimensions = { width: this.vWidth, height: this.vHeight + STATUS_BAR_HEIGHT };

    // Create browser window using base class property
    this.debugWindow = new BrowserWindow({
      width: windowDimensions.width,
      height: windowDimensions.height,
      x,
      y,
      title: this._windowTitle,
      useContentSize: true, // width/height are the client area; Electron adds OS chrome (no white SAVE overhang)
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        // Keep the renderer painting + rAF firing while this window is occluded/unfocused so a
        // scripted multi-window SAVE captures a fresh frame and the capture flush never stalls.
        backgroundThrottling: false
      }
    });

    // Register window with WindowPlacer for position tracking (only if using auto-placement)
    if (!this.displaySpec.hasExplicitPosition) {
      windowPlacer.registerWindow(`midi-${this.windowId}`, this.debugWindow);
    }

    // Write HTML to temp file to allow file:// font URLs to work (like TERM window does)
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `pnut-midi-${this.windowId}-${Date.now()}.html`);

    const html = this.getHTML();
    fs.writeFileSync(tempFile, html);
    this.logMessage(`Wrote MIDI HTML to temp file: ${tempFile}`);

    // Load the temp file instead of using data URL
    this.debugWindow.loadFile(tempFile);

    // Clean up temp file after a delay
    setTimeout(() => {
      try {
        fs.unlinkSync(tempFile);
        this.logMessage(`Cleaned up MIDI temp file: ${tempFile}`);
      } catch (err) {
        // File might already be gone, that's ok
      }
    }, 5000);

    // Initialize the canvas AND mark ready on did-finish-load — like SCOPE_XY. did-finish-load
    // ALWAYS fires on page load (the 'midi-canvas' element exists by then), so the offscreen/
    // visible contexts are set up and queued content + the SAVE drain reliably. Doing canvas
    // init + readiness in ready-to-show was unreliable with show:true (the SAVE could go
    // unprocessed → no .bmp on capture runs). [window-readiness uniform sequence]
    this.debugWindow.webContents.once('did-finish-load', () => {
      // Canvas init is ASYNC (an executeJavaScript round-trip that flips canvasInitialized true in
      // its .then). Readiness must fire AFTER that, not here: onWindowReady() makes the router drain
      // buffered messages (the held-chord note-ons AND the SAVE). If we marked ready before the
      // canvas exists, every drawKeyboard during the drain is DEFERRED via pendingDrawRequest, and
      // the deferred chord draw then loses the FIFO race to SAVE's capturePage — capturing the
      // keyboard with NO lit chord. initializeWindow() now calls onWindowReady() once the canvas is
      // ready, so the chord draws synchronously during the drain and the capture flush catches it.
      // [MIDI lit-chord-not-captured: ready-after-canvas-init]
      this.logMessage('MIDI did-finish-load: init canvas (readiness fires when the canvas is ready)');
      this.initializeWindow();
    });

    // Set up window event handlers
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('MIDI window ready to show');
      // Register for message DELIVERY but do NOT mark ready here: MIDI's canvas init is async and
      // completes in initializeWindow()'s .then() (did-finish-load). ready-to-show fires before that
      // .then() resolves, so marking ready here would drain the buffered note-ons against an
      // uninitialized canvas — each drawKeyboard() would DEFER via pendingDrawRequest and the held
      // chord would miss the SAVE capture. Passing markReady=false keeps isWindowReady false so
      // incoming messages ENQUEUE; onWindowReady() then fires from the canvas-init .then(), draining
      // them onto a ready canvas before SAVE captures. [MIDI lit-chord-not-captured: ready-after-canvas-init]
      this.registerWithRouter(false);
      this.debugWindow?.show();
    });

    this.debugWindow.on('closed', () => {
      this.logMessage('MIDI window closed');
      this.closeDebugWindow();
    });
  }

  /**
   * Get HTML content for the MIDI window
   */
  private getHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${this._windowTitle}</title>
    <style>
        @font-face {
            font-family: 'Parallax';
            src: url('${this.getParallaxFontUrl()}') format('truetype');
        }
        body {
            margin: 0;
            padding: 0;
            background: #f0f0f0;
            font-family: 'Parallax', Arial, sans-serif;
            overflow: hidden;
        }
        canvas {
            display: block;
            border: 1px solid #ccc;
            /* Nearest-neighbor on the Retina (DPR>1) upscale — avoids bilinear blur of the
               logical-res canvas. Matches BITMAP/SPECTRO; Chromium resolves to crisp-edges. */
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        }
        .status-bar {
            height: 20px;
            background: #e0e0e0;
            border-top: 1px solid #ccc;
            padding: 2px 5px;
            font-size: 11px;
            font-family: 'Parallax', Arial, sans-serif;
        }
    </style>
</head>
<body>
    <canvas id="midi-canvas" width="${this.vWidth}" height="${this.vHeight}"></canvas>
    <div class="status-bar">
        MIDI Keyboard - Channel ${this.midiChannel}, Keys ${this.midiKeyFirst}-${this.midiKeyLast}
    </div>
</body>
</html>`;
  }

  /**
   * Initialize the window after it's ready
   */
  private initializeWindow(): void {
    // Keyboard layout already calculated in constructor
    // Initialize double buffering and canvas with verification
    this.debugWindow?.webContents
      .executeJavaScript(
        `
      (function() {
        // Get visible canvas
        const visibleCanvas = document.getElementById('midi-canvas');
        if (!visibleCanvas) {
          console.error('[MIDI] FATAL: Canvas element not found');
          return 'Canvas element not found';
        }
        window.visibleCanvas = visibleCanvas;
        window.visibleCtx = visibleCanvas.getContext('2d');
        if (!window.visibleCtx) {
          console.error('[MIDI] FATAL: Could not get 2D context from canvas');
          return 'Could not get 2D context';
        }

        // Create offscreen canvas for double buffering (like TERM window)
        window.offscreenCanvas = document.createElement('canvas');
        window.offscreenCanvas.width = ${this.vWidth};
        window.offscreenCanvas.height = ${this.vHeight};
        window.offscreenCtx = window.offscreenCanvas.getContext('2d');
        if (!window.offscreenCtx) {
          console.error('[MIDI] FATAL: Could not create offscreen canvas context');
          return 'Could not create offscreen context';
        }

        // Clear both canvases with background color
        const bgColor = '#f0f0f0';
        window.offscreenCtx.fillStyle = bgColor;
        window.offscreenCtx.fillRect(0, 0, ${this.vWidth}, ${this.vHeight});
        window.visibleCtx.fillStyle = bgColor;
        window.visibleCtx.fillRect(0, 0, ${this.vWidth}, ${this.vHeight});

        console.log('[MIDI] Canvas initialization successful - double buffering enabled');
        console.log('[MIDI] Visible canvas:', visibleCanvas.width, 'x', visibleCanvas.height);
        console.log('[MIDI] Offscreen canvas:', window.offscreenCanvas.width, 'x', window.offscreenCanvas.height);
        return 'OK';
      })()
    `
      )
      .then((result) => {
        if (result === 'OK') {
          this.logMessage('MIDI: Canvas initialization successful with double buffering');
          // Mark canvas as initialized
          this.canvasInitialized = true;

          // Process any pending draw request (routed through renderChain so a SAVE awaits it)
          if (this.pendingDrawRequest) {
            this.logMessage('MIDI: Processing pending draw request');
            this.flushDraw(this.pendingClear);
            this.pendingDrawRequest = false;
            this.pendingClear = false;
          } else {
            // Initial draw if no pending request
            this.flushDraw(true);
          }
        } else {
          this.logMessage(`MIDI: ERROR during canvas initialization: ${result}`);
          console.error('MIDI canvas initialization failed:', result);
        }
        // Mark the window READY only now that the canvas is initialized (see did-finish-load): the
        // router then drains buffered messages against a ready canvas, so the held-chord draw is
        // issued synchronously during the drain and the SAVE capture flush catches it.
        this.onWindowReady();
      })
      .catch((error) => {
        this.logMessage(`MIDI: FATAL ERROR initializing canvas: ${error.message}`);
        console.error('MIDI canvas initialization error:', error);
        // Still mark ready so the buffered SAVE/messages drain instead of hanging on a failed init.
        this.onWindowReady();
      });

    // Enable input forwarding if requested
    if (this.pcKeyEnabled) {
      this.enableKeyboardInput();
    }
    if (this.pcMouseEnabled) {
      this.enableMouseInput();
    }
  }

  /**
   * Update keyboard layout based on current settings
   */
  private updateKeyboardLayout(): void {
    const layout = PianoKeyboardLayout.calculateLayout(this.keySize, this.midiKeyFirst, this.midiKeyLast);

    this.keyLayout = layout.keys;
    this.keyOffset = layout.offset;

    // Update window dimensions
    this.vWidth = layout.totalWidth;
    this.vHeight = layout.totalHeight;
  }

  /**
   * Funnel every keyboard render through the inherited renderChain so a SAVE awaits the in-flight
   * draw before capturing. drawKeyboard() is a SINGLE-SHOT executeJavaScript that redraws the whole
   * (idempotent) keyboard state, so we issue it EAGERLY and trackRender() its promise — awaiting the
   * latest draw implies any earlier chord-note draws already landed (FIFO). The base SAVE methods
   * await renderChain via flushBeforeCapture(); MIDI no longer overrides them. [#49]
   */
  private flushDraw(clear: boolean): void {
    this.trackRender(this.drawKeyboard(clear));
  }

  /**
   * Draw the piano keyboard using double buffering.
   * AWAITS the executeJavaScript draw so the renderChain represents true draw COMPLETION (not just
   * "issued"); a SAVE that awaits renderChain is then guaranteed to see the finished frame.
   * @param clear If true, reset all velocities to 0
   */
  private async drawKeyboard(clear: boolean): Promise<void> {
    if (!this.keyLayout || !this.debugWindow) return;

    // If canvas not initialized yet, queue the request for later
    if (!this.canvasInitialized) {
      this.pendingDrawRequest = true;
      if (clear) {
        this.pendingClear = true;
      }
      this.logMessage('MIDI: Canvas not initialized yet, queuing draw request');
      return;
    }

    // Clear velocities if requested
    if (clear) {
      this.midiVelocity.fill(0);
    }

    const r = Math.floor(this.keySize / 4); // Corner radius

    // Build complete drawing JavaScript for injection using double buffering
    let drawingCode = `
      (function() {
        // Verify canvas contexts exist
        if (!window.offscreenCtx || !window.visibleCtx) {
          console.error('[MIDI] Canvas contexts not initialized');
          return 'Canvas contexts not initialized';
        }

        const ctx = window.offscreenCtx; // Draw to offscreen buffer first

        // Clear offscreen canvas with background color
        ctx.fillStyle = '#E0E0E0';
        ctx.fillRect(0, 0, ${this.vWidth}, ${this.vHeight});

        // Set up font for key labels
        ctx.font = '${Math.floor(this.keySize / 3)}px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';  // Changed from 'top' to 'middle' for proper centering after rotation
    `;

    // Add white keys drawing code
    for (let i = this.midiKeyFirst; i <= this.midiKeyLast; i++) {
      const key = this.keyLayout.get(i);
      if (key && !key.isBlack) {
        drawingCode += this.generateKeyDrawingCode(i, key, 0xffffff, this.vColor[0], r);
      }
    }

    // Add black keys drawing code (drawn on top)
    for (let i = this.midiKeyFirst; i <= this.midiKeyLast; i++) {
      const key = this.keyLayout.get(i);
      if (key && key.isBlack) {
        drawingCode += this.generateKeyDrawingCode(i, key, 0x000000, this.vColor[1], r);
      }
    }

    // Add code to copy from offscreen to visible canvas at the end
    drawingCode += `
        // Copy offscreen canvas to visible canvas
        window.visibleCtx.drawImage(window.offscreenCanvas, 0, 0);
        console.log('[MIDI] Keyboard drawn successfully with double buffering');
        return 'OK';
      })()
    `;

    // Log first 500 chars of drawing code for debugging
    this.logMessage(
      `MIDI: Executing drawing JavaScript (${drawingCode.length} chars total):\n${drawingCode.substring(0, 500)}...`
    );

    // Execute the complete drawing code. AWAIT it (not fire-and-forget) so flushDraw()'s renderChain
    // resolves only once the offscreen→visible copy has actually run in the renderer — that is what
    // lets a SAVE awaiting renderChain capture the finished frame. [SAVE must await the draw]
    try {
      const result = await this.debugWindow.webContents.executeJavaScript(drawingCode);
      if (result === 'OK') {
        this.logMessage('MIDI: Keyboard drawn successfully');
      } else {
        this.logMessage(`MIDI: ERROR during drawing: ${result}`);
      }
    } catch (error) {
      this.logMessage(`MIDI: ERROR executing drawing JavaScript: ${(error as Error).message}`);
      console.error('MIDI drawing error:', error);
      console.error('Failed JavaScript code:', drawingCode);
    }
  }

  /**
   * Generate JavaScript code for drawing a single piano key
   */
  private generateKeyDrawingCode(
    keyNum: number,
    key: KeyInfo,
    keyColor: number,
    velocityColor: number,
    radius: number
  ): string {
    // Calculate key coordinates relative to canvas
    const border = Math.floor(this.keySize / 6);
    const left = key.left - this.keyOffset;
    const right = key.right - this.keyOffset;
    // Pascal MIDI_DrawKey: RoundRect(left, -r, right, MidiBottom, r, r) (DebugDisplayUnit.pas:2671).
    // The rect top is at -r so the rounded top corners fall above y=0 and the VISIBLE top edge is
    // flat; the border gap sits at the BOTTOM of the window (vHeight = keySize*6 + border). [9win §16]
    const top = -radius;
    const bottom = key.bottom; // Pascal MidiBottom is the Y coordinate directly (no top border added)
    const textTop = border; // note-label inset from the window top, independent of the clipped key top
    const velocity = this.midiVelocity[keyNum] || 0;

    const keyColorHex = this.rgbToHex(keyColor);
    const velocityColorHex = this.rgbToHex(velocityColor);

    // Velocity-bar geometry, computed in TS so the emitted draw code declares NO JS
    // variables. Every key's code is concatenated into ONE injected-function scope, so
    // a second active key (a chord) used to re-emit a "const velocityHeight/velocityTop"
    // declaration — a SyntaxError that failed the entire draw ("Script failed to
    // execute"). Pascal velocity bar: RoundRect(left, MidiBottom - r - (MidiBottom-r)*
    // vel div 127, ..., MidiBottom, ...) (DebugDisplayUnit.pas:2680-2683). [9win §16]
    const velocityHeight = velocity > 0 ? Math.floor(((bottom - radius) * velocity) / 127) : 0;
    const velocityTop = bottom - radius - velocityHeight;
    if (velocity > 0) {
      this.logMessage(
        `MIDI: Drawing velocity bar on key ${keyNum}: velocity=${velocity}, height=${velocityHeight}px, position Y=${velocityTop}-${
          velocityTop + velocityHeight
        }, color=${velocityColorHex}`
      );
    }

    return `
      // Draw key ${keyNum} (${key.isBlack ? 'black' : 'white'})
      ctx.fillStyle = '${keyColorHex}';
      ctx.beginPath();
      ctx.moveTo(${left + radius}, ${top});
      ctx.lineTo(${right - radius}, ${top});
      ctx.quadraticCurveTo(${right}, ${top}, ${right}, ${top + radius});
      ctx.lineTo(${right}, ${bottom - radius});
      ctx.quadraticCurveTo(${right}, ${bottom}, ${right - radius}, ${bottom});
      ctx.lineTo(${left + radius}, ${bottom});
      ctx.quadraticCurveTo(${left}, ${bottom}, ${left}, ${bottom - radius});
      ctx.lineTo(${left}, ${top + radius});
      ctx.quadraticCurveTo(${left}, ${top}, ${left + radius}, ${top});
      ctx.closePath();
      ctx.fill();

      // Draw velocity bar if active (literal numbers only; no JS var declarations)
      ${
        velocity > 0
          ? `
        ctx.fillStyle = '${velocityColorHex}';
        ctx.fillRect(${left + 1}, ${velocityTop}, ${right - left - 2}, ${velocityHeight});
      `
          : ''
      }

      // Draw key outline
      ctx.strokeStyle = '${key.isBlack ? '#444' : '#888'}';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(${left + radius}, ${top});
      ctx.lineTo(${right - radius}, ${top});
      ctx.quadraticCurveTo(${right}, ${top}, ${right}, ${top + radius});
      ctx.lineTo(${right}, ${bottom - radius});
      ctx.quadraticCurveTo(${right}, ${bottom}, ${right - radius}, ${bottom});
      ctx.lineTo(${left + radius}, ${bottom});
      ctx.quadraticCurveTo(${left}, ${bottom}, ${left}, ${bottom - radius});
      ctx.lineTo(${left}, ${top + radius});
      ctx.quadraticCurveTo(${left}, ${top}, ${left + radius}, ${top});
      ctx.closePath();
      ctx.stroke();

      // Draw MIDI note number (rotated 90 degrees clockwise to read vertically)
      // Note: key.numX already accounts for irregular white key shapes near black keys
      // Position text 12 pixels down from top to place it well inside the key
      ctx.save();
      ctx.translate(${key.numX - this.keyOffset}, ${textTop + 12});
      ctx.rotate(Math.PI / 2);  // 90 degrees clockwise
      ctx.fillStyle = '${key.isBlack ? '#BBB' : '#444'}';
      ctx.fillText('${keyNum}', 0, 0);
      ctx.restore();
    `;
  }

  /**
   * Convert RGB24 to hex string
   */
  private rgbToHex(rgb: number): string {
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Process MIDI data and commands. Awaits the async pipeline so callers that await
   * processMessageImmediate() observe completed state (note draws, command effects). [9win §16]
   *
   * IMPORTANT: do NOT override updateContent() here. The base updateContent() provides the
   * single-flight per-window serialization that keeps a note-off RELEASE from clobbering an
   * in-flight held-chord SAVE (the fig-11 blank-chord bug) AND the not-ready message queue. A
   * passthrough override (the old `updateContent → processMessageImmediate`) silently bypassed both,
   * so the SAVE and the release ran CONCURRENTLY and the capture sampled a bar-less canvas. The base
   * funnels here via processMessageImmediate, so this override alone is the correct extension point.
   * [MIDI save-clobber: override bypassed base serialization]
   */
  protected async processMessageImmediate(lineParts: string[]): Promise<void> {
    await this.processMessageAsync(lineParts);
  }

  /**
   * Process MIDI data and commands (async implementation)
   */
  private async processMessageAsync(lineParts: string[]): Promise<void> {
    // Pascal MIDI_Update ignores key_update (DebugDisplayUnit.pas:2589-2598): drop a leading
    // UPDATE token so the base class does not treat it as a force-update, while still letting any
    // remaining tokens on the line be processed (Pascal's parse loop simply continues). [9win §16]
    if (lineParts.length > 0 && lineParts[0].toUpperCase() === 'UPDATE') {
      lineParts = lineParts.slice(1);
      if (lineParts.length === 0) return;
    }

    // FIRST: Let base class handle common commands (CLEAR, CLOSE, SAVE, PC_KEY, PC_MOUSE)
    // Window name was already stripped by mainWindow before routing - pass lineParts directly
    if (await this.handleCommonCommand(lineParts)) {
      // Base class handled the command, we're done
      return;
    }

    // Process MIDI-specific commands and data starting from index 0
    let i = 0;

    while (i < lineParts.length) {
      const part = lineParts[i];

      // Custom SIZE override (1 parameter for midiSize, not 2 like shared parser)
      // Pascal KeyValWithin(MidiSize, 1, 50): clamp into range. [9win §7]
      if (part === 'SIZE' && i + 1 < lineParts.length) {
        const size = Spin2NumericParser.parseCount(lineParts[i + 1]);
        if (size !== null) {
          this.midiSize = DebugMidiWindow.within(size, 1, 50);
          this.keySize = 8 + this.midiSize * 4;
          this.updateKeyboardLayout();
        }
        i += 2;
        continue;
      }

      // COLOR white-key {bright} black-key {bright} — Pascal: if KeyColor(vColor[0])
      // then KeyColor(vColor[1]). Each color is ONE shared parseKeyColor (RGBI8X
      // NAME with optional brightness, or a numeric literal) so 'COLOR CYAN 8
      // MAGENTA 4' honors the brightness tokens. The 2nd color is optional and
      // never aborts the directive. [9win §7]
      if (part === 'COLOR') {
        const white = DisplaySpecParser.parseKeyColor(lineParts, i + 1);
        if (white !== null) {
          const color1 = parseInt(white.rgb.slice(1), 16);
          this.vColor[0] = color1;
          this.whiteKeyColor = color1;
          let next = white.nextIdx;
          const blackColor = DisplaySpecParser.parseKeyColor(lineParts, white.nextIdx);
          if (blackColor !== null) {
            const color2 = parseInt(blackColor.rgb.slice(1), 16);
            this.vColor[1] = color2;
            this.blackKeyColor = color2;
            next = blackColor.nextIdx;
          }
          i = next;
        } else {
          i += 1; // COLOR with no valid color token — skip keyword, keep current colors
        }
        continue;
      }

      // Try shared parser for TITLE and POS
      if (part === 'TITLE' || part === 'POS') {
        const compatibleSpec: Partial<BaseDisplaySpec> = {
          title: this._windowTitle,
          position: { x: 0, y: 0 },
          hasExplicitPosition: false,
          size: { width: 0, height: 0 }, // Not used
          nbrSamples: 0, // Not used
          window: { background: '#000000', grid: '#808080' } // Not used
        };
        const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(
          lineParts,
          i,
          compatibleSpec as BaseDisplaySpec
        );
        if (parsed) {
          // Copy parsed values back
          if (compatibleSpec.title) {
            this._windowTitle = compatibleSpec.title;
            this.setWindowTitle(compatibleSpec.title);
          }
          if (compatibleSpec.position) {
            this.setWindowPosition(compatibleSpec.position.x, compatibleSpec.position.y);
          }
          if (compatibleSpec.hasExplicitPosition) {
            this.displaySpec.hasExplicitPosition = compatibleSpec.hasExplicitPosition;
          }
          i += consumed;
          continue;
        }
      }

      // MIDI-specific keywords
      // Pascal: first := Within(val,0,127); last := Within(val,first,127). Clamp. [9win §7]
      if (part === 'RANGE' && i + 1 < lineParts.length) {
        const first = Spin2NumericParser.parseCount(lineParts[i + 1]);
        if (first !== null) {
          const f = DebugMidiWindow.within(first, 0, 127);
          let l = f;
          const last = i + 2 < lineParts.length ? Spin2NumericParser.parseCount(lineParts[i + 2]) : null;
          if (last !== null) {
            l = DebugMidiWindow.within(last, f, 127);
            i += 1;
          }
          this.midiKeyFirst = f;
          this.midiKeyLast = l;
          this.updateKeyboardLayout();
        }
        i += 2;
        continue;
      }

      // Pascal KeyValWithin(MidiChannel, 0, 15): clamp into range. [9win §7]
      if (part === 'CHANNEL' && i + 1 < lineParts.length) {
        const channel = Spin2NumericParser.parseCount(lineParts[i + 1]);
        if (channel !== null) {
          this.midiChannel = DebugMidiWindow.within(channel, 0, 15);
        }
        i += 2;
        continue;
      }

      // CLEAR, SAVE, PC_KEY, PC_MOUSE now handled by base class

      // Try to parse as MIDI data byte
      // Pre-check if value looks numeric to avoid error logging for non-numeric tokens (like commas)
      if (Spin2NumericParser.isNumeric(part)) {
        const value = Spin2NumericParser.parseCount(part);
        if (value !== null) {
          this.processMidiByte(value & 0xff);
        }
      }

      i++;
    }
  }

  /**
   * Process a single MIDI byte using state machine
   */
  private processMidiByte(byte: number): void {
    // MSB set forces command state
    if ((byte & 0x80) !== 0) {
      this.midiState = 0;
    }

    switch (this.midiState) {
      case 0: // Wait for note-on or note-off event
        if ((byte & 0xf0) === 0x90 && (byte & 0x0f) === this.midiChannel) {
          this.midiState = 1; // Note-on event
          this.logMessage(`MIDI: Note-on command received (channel ${byte & 0x0f})`);
        } else if ((byte & 0xf0) === 0x80 && (byte & 0x0f) === this.midiChannel) {
          this.midiState = 3; // Note-off event
          this.logMessage(`MIDI: Note-off command received (channel ${byte & 0x0f})`);
        }
        break;

      case 1: // Note-on, get note
        this.midiNote = byte;
        this.midiState = 2;
        this.logMessage(`MIDI: Note number = ${byte}`);
        break;

      case 2: // Note-on, get velocity
        this.midiVelocity[this.midiNote] = byte;
        this.midiState = 1;
        this.logMessage(
          `MIDI: ✅ Note-ON: key=${this.midiNote}, velocity=${byte} → Highlight color will be placed on key`
        );
        this.flushDraw(false);
        break;

      case 3: // Note-off, get note
        this.midiNote = byte;
        this.midiState = 4;
        this.logMessage(`MIDI: Note number = ${byte}`);
        break;

      case 4: // Note-off, get velocity
        // Pascal MIDI_Update: MidiVelocity[MidiNote] := -val (DebugDisplayUnit.pas:2636). A
        // negative velocity renders as "no bar" (draw guards on velocity > 0), matching the
        // note-off appearance, while preserving the Pascal value exactly. [9win §16]
        this.midiVelocity[this.midiNote] = -byte;
        this.midiState = 3;
        this.logMessage(`MIDI: ✅ Note-OFF: key=${this.midiNote} → Highlight removed`);
        this.flushDraw(false);
        break;
    }
  }

  /**
   * Get canvas ID for input forwarding
   */
  protected getCanvasId(): string {
    return `midi-canvas-${this.midiWindowId}`;
  }

  /**
   * Set window title
   */
  private setWindowTitle(title: string): void {
    const titleElement = document.querySelector(`#debug-window-${this.midiWindowId} .title`);
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Set window position
   */
  private setWindowPosition(x: number, y: number): void {
    const windowElement = document.getElementById(`debug-window-${this.midiWindowId}`);
    if (windowElement) {
      windowElement.style.left = `${x}px`;
      windowElement.style.top = `${y}px`;
    }
  }

  /**
   * Override: Clear display content (called by base class CLEAR command)
   */
  protected clearDisplayContent(): void {
    this.flushDraw(true);
  }

  /**
   * Override: UPDATE is a no-op for MIDI. Pascal MIDI_Update (DebugDisplayUnit.pas:2589-2598)
   * has no key_update case — the keyboard redraws immediately on every note event and MIDI has
   * no deferred-update mode, so an UPDATE directive must NOT trigger a redraw. [9win §16]
   */
  protected forceDisplayUpdate(): void {
    // intentionally empty — MIDI ignores UPDATE
  }

  /**
   * Force a fresh redraw of the CURRENT keyboard state immediately before SAVE captures, and AWAIT it.
   *
   * GROUND TRUTH (v0.9.63 [SAVE-READBACK] diagnostics): the canvas readback works perfectly — the
   * problem was that the canvas had NO velocity bars at capture time even though the held chord is
   * visible live. Two mechanisms produce that, and this guards against BOTH:
   *   (a) the note-off RELEASE that arrives in the same serial chunk as the SAVE clears the bars, or
   *   (b) the original note-on draw was deferred and lands after the capture.
   * `this.midiVelocity[]` still holds the held chord here (processMidiByte set it, and the SAVE is
   * serialized BEFORE the release on routerDispatchChain), so re-rendering it now — synchronously and
   * awaited — puts the bars on the canvas at the instant of capture, regardless of (a)/(b).
   * [#49 MIDI lit-chord: redraw current state at capture]
   */
  protected async flushBeforeCapture(): Promise<void> {
    await this.drawKeyboard(false);
    await super.flushBeforeCapture();
  }

  /**
   * Read SAVE pixels from the keyboard canvas BACKING STORE (toDataURL) — see captureCanvasAsPNG.
   */
  protected getCaptureCanvasId(): string | null {
    return 'midi-canvas';
  }

  /**
   * Clean up resources when window is closed
   */
  closeDebugWindow(): void {
    // Base class handles window closure via debugWindow property
    // Just clean up MIDI-specific resources
    this.keyLayout = null;
    this.canvasInitialized = false;
    this.pendingDrawRequest = false;
    this.pendingClear = false;

    // Let base class handle the actual window closure
    this.debugWindow = null;
  }

  /**
   * Parse MIDI window declaration from debug command
   * @param lineParts Array of command parts from debug statement
   * @returns Tuple of [isValid, displaySpec]
   */
  /** Pascal GlobalUnit.Within — clamp value into [min, max]. */
  private static within(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
  }

  static parseMidiDeclaration(lineParts: string[]): [boolean, MidiDisplaySpec] {
    const displaySpec: MidiDisplaySpec = {
      displayName: 'MIDI',
      windowTitle: 'MIDI Keyboard',
      position: { x: 0, y: 0 },
      hasExplicitPosition: false, // Default: use auto-placement
      size: { width: 400, height: 300 },
      keySize: 4, // Default keyboard size
      keyRange: { first: 21, last: 108 }, // Default 88-key piano range
      channel: 0, // Default MIDI channel
      keyColors: { white: 0x00ffff, black: 0xff00ff } // Cyan/Magenta
    };

    if (lineParts.length > 1) {
      displaySpec.displayName = lineParts[1];
      displaySpec.windowTitle = `${lineParts[1]} - MIDI`;
    }

    // Parse create-time config directives (Pascal MIDI_Configure, DebugDisplayUnit.pas:2492).
    // Previously a stub: TITLE/POS/SIZE/RANGE/CHANNEL/COLOR given on the creation line were
    // dropped and only took effect if re-sent during the update phase. Mirror the update-phase
    // parser here so they apply at window construction. [9win §7]
    let i = 2;
    while (i < lineParts.length) {
      const part = lineParts[i];

      // SIZE keysize — Pascal KeyValWithin(MidiSize, 1, 50): clamp into range
      if (part === 'SIZE' && i + 1 < lineParts.length) {
        const size = Spin2NumericParser.parseCount(lineParts[i + 1]);
        if (size !== null) {
          displaySpec.keySize = DebugMidiWindow.within(size, 1, 50);
        }
        i += 2;
        continue;
      }

      // RANGE first last — Pascal: first := Within(val,0,127); last := Within(val,first,127)
      if (part === 'RANGE' && i + 1 < lineParts.length) {
        const first = Spin2NumericParser.parseCount(lineParts[i + 1]);
        if (first !== null) {
          const f = DebugMidiWindow.within(first, 0, 127);
          let l = f; // Pascal: MidiKeyLast := MidiKeyFirst before reading the 2nd value
          const last = i + 2 < lineParts.length ? Spin2NumericParser.parseCount(lineParts[i + 2]) : null;
          if (last !== null) {
            l = DebugMidiWindow.within(last, f, 127);
            i += 1; // consumed the 2nd value
          }
          displaySpec.keyRange = { first: f, last: l };
        }
        i += 2;
        continue;
      }

      // CHANNEL ch — Pascal KeyValWithin(MidiChannel, 0, 15): clamp into range
      if (part === 'CHANNEL' && i + 1 < lineParts.length) {
        const channel = Spin2NumericParser.parseCount(lineParts[i + 1]);
        if (channel !== null) {
          displaySpec.channel = DebugMidiWindow.within(channel, 0, 15);
        }
        i += 2;
        continue;
      }

      // COLOR white-key {bright} black-key {bright} — Pascal: if KeyColor(vColor[0])
      // then KeyColor(vColor[1]). Each color is ONE shared parseKeyColor (RGBI8X
      // NAME with optional brightness, or a numeric literal), so 'COLOR CYAN 8
      // MAGENTA 4' honors the brightness tokens the bare DebugColor path dropped.
      // The 2nd color is optional (Pascal reads it only if the 1st succeeded; a
      // missing/invalid 2nd leaves black at its default). Never abort. [9win §7]
      if (part === 'COLOR') {
        const white = DisplaySpecParser.parseKeyColor(lineParts, i + 1);
        if (white !== null) {
          let black = displaySpec.keyColors.black;
          let next = white.nextIdx;
          const blackColor = DisplaySpecParser.parseKeyColor(lineParts, white.nextIdx);
          if (blackColor !== null) {
            black = parseInt(blackColor.rgb.slice(1), 16);
            next = blackColor.nextIdx;
          }
          displaySpec.keyColors = { white: parseInt(white.rgb.slice(1), 16), black };
          i = next;
        } else {
          i += 1; // COLOR with no valid color token — skip keyword, keep defaults
        }
        continue;
      }

      // TITLE 'caption' / POS left top — shared parser (sets hasExplicitPosition for POS)
      if (part === 'TITLE' || part === 'POS') {
        const compatibleSpec: Partial<BaseDisplaySpec> = {
          title: displaySpec.windowTitle,
          position: displaySpec.position,
          hasExplicitPosition: displaySpec.hasExplicitPosition,
          size: { width: 0, height: 0 }, // not used by MIDI
          nbrSamples: 0, // not used
          window: { background: '#000000', grid: '#808080' } // not used
        };
        const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(
          lineParts,
          i,
          compatibleSpec as BaseDisplaySpec
        );
        if (parsed) {
          if (compatibleSpec.title) displaySpec.windowTitle = compatibleSpec.title;
          if (compatibleSpec.position) displaySpec.position = compatibleSpec.position;
          if (compatibleSpec.hasExplicitPosition) displaySpec.hasExplicitPosition = compatibleSpec.hasExplicitPosition;
          i += consumed;
          continue;
        }
      }

      // Unknown / non-config token at creation — skip it (data bytes only arrive in update phase)
      i += 1;
    }

    return [true, displaySpec];
  }
}
