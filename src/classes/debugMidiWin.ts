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
import { DebugColor } from './shared/debugColor';
import { CanvasRenderer } from './shared/canvasRenderer';
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = true;

export interface MidiDisplaySpec {
  displayName: string;
  windowTitle: string; // composite or override w/TITLE
  position: Position;
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
  protected vColor: number[] = [0x00FFFF, 0xFF00FF, 0, 0, 0, 0, 0, 0]; // Cyan, Magenta
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
  private whiteKeyColor: number = 0x00FFFF; // Cyan
  private blackKeyColor: number = 0xFF00FF; // Magenta
  
  // Canvas properties (transitional - keeping old properties for compatibility)
  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private canvasRenderer: CanvasRenderer = new CanvasRenderer();

  // Track canvas initialization state to prevent race conditions
  private canvasInitialized: boolean = false;
  private pendingDrawRequest: boolean = false;
  private pendingClear: boolean = false;

  constructor(ctx: Context, displaySpec: MidiDisplaySpec, windowId: string = `midi-${Date.now()}`) {
    super(ctx, windowId, 'midi');

    this.displaySpec = displaySpec;

    // Enable logging for MIDI window
    this.isLogging = true;

    // Initialize MIDI configuration from displaySpec
    this.midiSize = displaySpec.keySize;
    this.midiKeyFirst = displaySpec.keyRange.first;
    this.midiKeyLast = displaySpec.keyRange.last;
    this.midiChannel = displaySpec.channel;
    this.whiteKeyColor = displaySpec.keyColors.white;
    this.blackKeyColor = displaySpec.keyColors.black;
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

    // CRITICAL: Mark window as ready to process messages (matches TERM window pattern)
    // This ensures messages are processed immediately instead of being queued indefinitely
    this.onWindowReady();
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
      debugLogger.logSystemMessage(`WINDOW_PLACED (${x},${y} ${this.vWidth}x${this.vHeight} Mon:${monitorId}) MIDI '${this.displaySpec.displayName}' POS ${x} ${y} SIZE ${this.vWidth} ${this.vHeight}`);
    } catch (error) {
      console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
    }
    
    // Use base class method for consistent chrome adjustments
    // Add status bar height (20px + 2px border) to ensure no scrollbar
    const STATUS_BAR_HEIGHT = 22;
    const windowDimensions = this.calculateWindowDimensions(this.vWidth, this.vHeight + STATUS_BAR_HEIGHT);

    // Create browser window using base class property
    this.debugWindow = new BrowserWindow({
      width: windowDimensions.width,
      height: windowDimensions.height,
      x,
      y,
      title: this._windowTitle,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Register window with WindowPlacer for position tracking
    windowPlacer.registerWindow(`midi-${this.windowId}`, this.debugWindow);

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

    // Set up window event handlers
    this.debugWindow.on('ready-to-show', () => {
      this.logMessage('MIDI window ready to show');
      // Register with WindowRouter when window is ready
      this.registerWithRouter();
      this.debugWindow?.show();
      this.initializeWindow();
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
    this.debugWindow?.webContents.executeJavaScript(`
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
    `).then((result) => {
      if (result === 'OK') {
        this.logMessage('MIDI: Canvas initialization successful with double buffering');
        // Mark canvas as initialized
        this.canvasInitialized = true;

        // Process any pending draw request
        if (this.pendingDrawRequest) {
          this.logMessage('MIDI: Processing pending draw request');
          this.drawKeyboard(this.pendingClear);
          this.pendingDrawRequest = false;
          this.pendingClear = false;
        } else {
          // Initial draw if no pending request
          this.drawKeyboard(true);
        }
      } else {
        this.logMessage(`MIDI: ERROR during canvas initialization: ${result}`);
        console.error('MIDI canvas initialization failed:', result);
      }
    }).catch((error) => {
      this.logMessage(`MIDI: FATAL ERROR initializing canvas: ${error.message}`);
      console.error('MIDI canvas initialization error:', error);
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
    const layout = PianoKeyboardLayout.calculateLayout(
      this.keySize,
      this.midiKeyFirst,
      this.midiKeyLast
    );

    this.keyLayout = layout.keys;
    this.keyOffset = layout.offset;

    // Update window dimensions
    this.vWidth = layout.totalWidth;
    this.vHeight = layout.totalHeight;
  }

  /**
   * Draw the piano keyboard using double buffering
   * @param clear If true, reset all velocities to 0
   */
  private drawKeyboard(clear: boolean): void {
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
        drawingCode += this.generateKeyDrawingCode(i, key, 0xFFFFFF, this.vColor[0], r);
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
    this.logMessage(`MIDI: Executing drawing JavaScript (${drawingCode.length} chars total):\n${drawingCode.substring(0, 500)}...`);

    // Execute the complete drawing code
    this.debugWindow.webContents.executeJavaScript(drawingCode).then((result) => {
      if (result === 'OK') {
        this.logMessage('MIDI: Keyboard drawn successfully');
      } else {
        this.logMessage(`MIDI: ERROR during drawing: ${result}`);
      }
    }).catch((error) => {
      this.logMessage(`MIDI: ERROR executing drawing JavaScript: ${error.message}`);
      console.error('MIDI drawing error:', error);
      console.error('Failed JavaScript code:', drawingCode);
    });
  }

  /**
   * Generate JavaScript code for drawing a single piano key
   */
  private generateKeyDrawingCode(keyNum: number, key: KeyInfo, keyColor: number, velocityColor: number, radius: number): string {
    // Calculate key coordinates relative to canvas
    const border = Math.floor(this.keySize / 6);
    const left = key.left - this.keyOffset;
    const right = key.right - this.keyOffset;
    const top = border; // Top of all keys is at border offset
    const bottom = border + key.bottom; // CRITICAL: key.bottom is a HEIGHT, must add border offset for Y coordinate
    const velocity = this.midiVelocity[keyNum] || 0;

    const keyColorHex = this.rgbToHex(keyColor);
    const velocityColorHex = this.rgbToHex(velocityColor);

    // Log velocity bar placement for debugging
    if (velocity > 0) {
      const velocityHeight = Math.floor((bottom - top - radius) * velocity / 127);
      const velocityTop = bottom - radius - velocityHeight;
      this.logMessage(`MIDI: Drawing velocity bar on key ${keyNum}: velocity=${velocity}, height=${velocityHeight}px, position Y=${velocityTop}-${velocityTop + velocityHeight}, color=${velocityColorHex}`);
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

      // Draw velocity bar if active
      ${velocity > 0 ? `
        ctx.fillStyle = '${velocityColorHex}';
        const velocityHeight = Math.floor((${bottom} - ${top} - ${radius}) * ${velocity} / 127);
        const velocityTop = ${bottom} - ${radius} - velocityHeight;
        ctx.fillRect(${left + 1}, velocityTop, ${right - left - 2}, velocityHeight);
      ` : ''}

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
      // Position text at the top of the key - Pascal uses ChrWidth (≈ text size * 0.8)
      ctx.save();
      ctx.translate(${key.numX - this.keyOffset}, ${top + Math.floor(Math.floor(this.keySize / 3) * 0.8)});
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
    const r = (rgb >> 16) & 0xFF;
    const g = (rgb >> 8) & 0xFF;
    const b = rgb & 0xFF;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Entry point for message processing from WindowRouter
   * Called by router's updateContent(dataParts)
   */
  public updateContent(lineParts: string[]): void {
    this.processMessageImmediate(lineParts);
  }

  /**
   * Process MIDI data and commands (synchronous wrapper for async operations)
   */
  protected processMessageImmediate(lineParts: string[]): void {
    // Handle async internally
    this.processMessageAsync(lineParts);
  }

  /**
   * Process MIDI data and commands (async implementation)
   */
  private async processMessageAsync(lineParts: string[]): Promise<void> {
    // FIRST: Let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    // Window name was already stripped by mainWindow before routing - pass lineParts directly
    if (await this.handleCommonCommand(lineParts)) {
      // Base class handled the command, we're done
      return;
    }

    // Process MIDI-specific commands and data starting from index 0
    let i = 0;

    while (i < lineParts.length) {
      const part = lineParts[i];
      
      // Check for commands
      if (part === 'TITLE' && i + 1 < lineParts.length) {
        this._windowTitle = lineParts[i + 1];
        this.setWindowTitle(lineParts[i + 1]);
        i += 2;
        continue;
      }
      
      if (part === 'POS' && i + 2 < lineParts.length) {
        const x = Spin2NumericParser.parsePixel(lineParts[i + 1]) || 0;
        const y = Spin2NumericParser.parsePixel(lineParts[i + 2]) || 0;
        this.setWindowPosition(x, y);
        i += 3;
        continue;
      }
      
      if (part === 'SIZE' && i + 1 < lineParts.length) {
        const size = Spin2NumericParser.parseCount(lineParts[i + 1]);
        if (size !== null && size >= 1 && size <= 50) {
          this.midiSize = size;
          this.keySize = 8 + this.midiSize * 4;
          this.updateKeyboardLayout();
        }
        i += 2;
        continue;
      }
      
      if (part === 'RANGE' && i + 2 < lineParts.length) {
        const first = Spin2NumericParser.parseCount(lineParts[i + 1]);
        const last = Spin2NumericParser.parseCount(lineParts[i + 2]);
        if (first !== null && last !== null && 
            first >= 0 && first <= 127 && 
            last >= first && last <= 127) {
          this.midiKeyFirst = first;
          this.midiKeyLast = last;
          this.updateKeyboardLayout();
        }
        i += 3;
        continue;
      }
      
      if (part === 'CHANNEL' && i + 1 < lineParts.length) {
        const channel = Spin2NumericParser.parseCount(lineParts[i + 1]);
        if (channel !== null && channel >= 0 && channel <= 15) {
          this.midiChannel = channel;
        }
        i += 2;
        continue;
      }
      
      if (part === 'COLOR' && i + 2 < lineParts.length) {
        const color1 = new DebugColor(lineParts[i + 1]).rgbValue;
        const color2 = new DebugColor(lineParts[i + 2]).rgbValue;
        this.vColor[0] = color1;
        this.whiteKeyColor = color1;
        this.vColor[1] = color2;
        this.blackKeyColor = color2;
        i += 3;
        continue;
      }

      // CLEAR, SAVE, PC_KEY, PC_MOUSE now handled by base class

      // Try to parse as MIDI data byte
      const value = Spin2NumericParser.parseCount(part);
      if (value !== null) {
        this.processMidiByte(value & 0xFF);
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
        if ((byte & 0xF0) === 0x90 && (byte & 0x0F) === this.midiChannel) {
          this.midiState = 1; // Note-on event
          this.logMessage(`MIDI: Note-on command received (channel ${byte & 0x0F})`);
        } else if ((byte & 0xF0) === 0x80 && (byte & 0x0F) === this.midiChannel) {
          this.midiState = 3; // Note-off event
          this.logMessage(`MIDI: Note-off command received (channel ${byte & 0x0F})`);
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
        this.logMessage(`MIDI: ✅ Note-ON: key=${this.midiNote}, velocity=${byte} → Highlight color will be placed on key`);
        this.drawKeyboard(false);
        break;

      case 3: // Note-off, get note
        this.midiNote = byte;
        this.midiState = 4;
        this.logMessage(`MIDI: Note number = ${byte}`);
        break;

      case 4: // Note-off, get velocity (Pascal stores as negative but displays as 0)
        this.midiVelocity[this.midiNote] = 0; // Note off always shows as no velocity
        this.midiState = 3;
        this.logMessage(`MIDI: ✅ Note-OFF: key=${this.midiNote} → Highlight removed`);
        this.drawKeyboard(false);
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
    this.drawKeyboard(true);
  }

  /**
   * Override: Force display update (called by base class UPDATE command)
   */
  protected forceDisplayUpdate(): void {
    this.drawKeyboard(false);
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
  static parseMidiDeclaration(lineParts: string[]): [boolean, MidiDisplaySpec] {
    const displaySpec: MidiDisplaySpec = {
      displayName: 'MIDI',
      windowTitle: 'MIDI Keyboard',
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      keySize: 4, // Default keyboard size
      keyRange: { first: 21, last: 108 }, // Default 88-key piano range
      channel: 0, // Default MIDI channel
      keyColors: { white: 0x00FFFF, black: 0xFF00FF } // Cyan/Magenta
    };

    if (lineParts.length > 1) {
      displaySpec.displayName = lineParts[1];
      displaySpec.windowTitle = `MIDI - ${lineParts[1]}`;
    }

    // TODO: Parse additional MIDI-specific parameters from remaining lineParts
    // - TITLE, POS, SIZE, RANGE, CHANNEL parameters
    // For now, using defaults compatible with existing implementation

    return [true, displaySpec];
  }
}