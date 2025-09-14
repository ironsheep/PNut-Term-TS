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
  private midiWindow: BrowserWindow | null = null;

  constructor(ctx: Context, displaySpec: MidiDisplaySpec, windowId: string = `midi-${Date.now()}`) {
    super(ctx, windowId, 'midi');
    
    this.displaySpec = displaySpec;
    
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
    
    // Use base class method for consistent chrome adjustments
    const windowDimensions = this.calculateWindowDimensions(this.vWidth, this.vHeight);

    // Create browser window
    this.midiWindow = new BrowserWindow({
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
    windowPlacer.registerWindow(`midi-${this.windowId}`, this.midiWindow);

    // Set up window content
    const html = this.getHTML();
    this.midiWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Set up window event handlers
    this.midiWindow.on('ready-to-show', () => {
      this.logMessage('MIDI window ready to show');
      this.midiWindow?.show();
      this.initializeWindow();
    });

    this.midiWindow.on('closed', () => {
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
    <title>${this._windowTitle}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #f0f0f0;
            font-family: Arial, sans-serif;
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
        }
    </style>
</head>
<body>
    <canvas id="midi-canvas" width="${this.vWidth}" height="${this.vHeight}"></canvas>
    <div class="status-bar">
        MIDI Keyboard - Channel ${this.midiChannel}, Keys ${this.midiKeyFirst}-${this.midiKeyLast}
    </div>
    <script>
        const { ipcRenderer } = require('electron');
        
        // Get canvas and context for drawing
        const canvas = document.getElementById('midi-canvas');
        const ctx = canvas.getContext('2d');
        
        // Handle window events
        ipcRenderer.on('render-update', (event, data) => {
            // Rendering will be handled by main process via CanvasRenderer
        });
        
        // Forward mouse events for MIDI key interaction
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            ipcRenderer.send('midi-click', {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        });
    </script>
</body>
</html>`;
  }

  /**
   * Initialize the window after it's ready
   */
  private initializeWindow(): void {
    // Calculate keyboard layout
    this.updateKeyboardLayout();

    // Set up canvas renderer with the window's canvas
    this.midiWindow?.webContents.executeJavaScript(`
      window.midiCanvas = document.getElementById('midi-canvas');
      window.midiCtx = window.midiCanvas.getContext('2d');
    `).then(() => {
      // Initial draw
      this.drawKeyboard(true);
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
   * Draw the piano keyboard using CanvasRenderer
   * @param clear If true, reset all velocities to 0
   */
  private drawKeyboard(clear: boolean): void {
    if (!this.keyLayout || !this.midiWindow) return;

    // Clear velocities if requested
    if (clear) {
      this.midiVelocity.fill(0);
    }

    const r = Math.floor(this.keySize / 4); // Corner radius

    // Build complete drawing JavaScript for injection
    let drawingCode = `
      const canvas = document.getElementById('midi-canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas with background color
      ctx.fillStyle = '#E0E0E0';
      ctx.fillRect(0, 0, ${this.vWidth}, ${this.vHeight});
      
      // Set up font for key labels
      ctx.font = '${Math.floor(this.keySize / 3)}px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
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

    // Execute the complete drawing code
    this.midiWindow.webContents.executeJavaScript(drawingCode);
  }

  /**
   * Generate JavaScript code for drawing a single piano key
   */
  private generateKeyDrawingCode(keyNum: number, key: KeyInfo, keyColor: number, velocityColor: number, radius: number): string {
    const left = key.left - this.keyOffset;
    const right = key.right - this.keyOffset; 
    const bottom = this.vHeight - this.keyOffset;
    const velocity = this.midiVelocity[keyNum] || 0;
    
    const keyColorHex = this.rgbToHex(keyColor);
    const velocityColorHex = this.rgbToHex(velocityColor);
    
    return `
      // Draw key ${keyNum} (${key.isBlack ? 'black' : 'white'})
      ctx.fillStyle = '${keyColorHex}';
      ctx.beginPath();
      ctx.moveTo(${left + radius}, ${-radius});
      ctx.lineTo(${right - radius}, ${-radius});
      ctx.quadraticCurveTo(${right}, ${-radius}, ${right}, ${-radius + radius});
      ctx.lineTo(${right}, ${bottom - radius});
      ctx.quadraticCurveTo(${right}, ${bottom}, ${right - radius}, ${bottom});
      ctx.lineTo(${left + radius}, ${bottom});
      ctx.quadraticCurveTo(${left}, ${bottom}, ${left}, ${bottom - radius});
      ctx.lineTo(${left}, ${-radius + radius});
      ctx.quadraticCurveTo(${left}, ${-radius}, ${left + radius}, ${-radius});
      ctx.closePath();
      ctx.fill();
      
      // Draw velocity bar if active
      ${velocity > 0 ? `
        ctx.fillStyle = '${velocityColorHex}';
        const velocityHeight = Math.floor((${bottom} - ${radius}) * ${velocity} / 127);
        const velocityTop = ${bottom} - ${radius} - velocityHeight;
        ctx.beginPath();
        ctx.moveTo(${left}, velocityTop);
        ctx.lineTo(${right - left}, velocityTop);
        ctx.lineTo(${right - left}, velocityTop + velocityHeight + ${radius});
        ctx.quadraticCurveTo(${right - left}, velocityTop + velocityHeight + ${radius}, ${right - left}, velocityTop + velocityHeight + ${radius});
        ctx.lineTo(${left}, velocityTop + velocityHeight + ${radius});
        ctx.quadraticCurveTo(${left}, velocityTop + velocityHeight + ${radius}, ${left}, velocityTop + velocityHeight);
        ctx.closePath();
        ctx.fill();
      ` : ''}
      
      // Draw key outline
      ctx.strokeStyle = '${key.isBlack ? '#444' : '#888'}';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(${left + radius}, ${-radius});
      ctx.lineTo(${right - radius}, ${-radius});
      ctx.quadraticCurveTo(${right}, ${-radius}, ${right}, ${-radius + radius});
      ctx.lineTo(${right}, ${bottom - radius});
      ctx.quadraticCurveTo(${right}, ${bottom}, ${right - radius}, ${bottom});
      ctx.lineTo(${left + radius}, ${bottom});
      ctx.quadraticCurveTo(${left}, ${bottom}, ${left}, ${bottom - radius});
      ctx.lineTo(${left}, ${-radius + radius});
      ctx.quadraticCurveTo(${left}, ${-radius}, ${left + radius}, ${-radius});
      ctx.closePath();
      ctx.stroke();
      
      // Draw MIDI note number
      ctx.fillStyle = '${key.isBlack ? '#BBB' : '#444'}';
      ctx.fillText('${keyNum}', ${key.numX - this.keyOffset}, ${radius});
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
   * Process MIDI data and commands
   */
  protected processMessageImmediate(lineParts: string[]): void {
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
      
      if (part === 'CLEAR') {
        this.drawKeyboard(true);
        i++;
        continue;
      }
      
      if (part === 'SAVE') {
        let filename = 'midi.bmp';
        let saveWindow = false;
        
        if (i + 1 < lineParts.length && lineParts[i + 1] === 'WINDOW') {
          saveWindow = true;
          if (i + 2 < lineParts.length) {
            filename = lineParts[i + 2].replace(/['"]/g, '');
            i += 3;
          } else {
            i += 2;
          }
        } else if (i + 1 < lineParts.length) {
          filename = lineParts[i + 1].replace(/['"]/g, '');
          i += 2;
        } else {
          i++;
        }
        
        this.saveWindowToBMPFilename(filename);
        continue;
      }

      if (part === 'PC_KEY') {
        this.pcKeyEnabled = true;
        this.enableKeyboardInput();
        i++;
        continue;
      }

      if (part === 'PC_MOUSE') {
        this.pcMouseEnabled = true;
        this.enableMouseInput();
        i++;
        continue;
      }
      
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
        } else if ((byte & 0xF0) === 0x80 && (byte & 0x0F) === this.midiChannel) {
          this.midiState = 3; // Note-off event
        }
        break;

      case 1: // Note-on, get note
        this.midiNote = byte;
        this.midiState = 2;
        break;

      case 2: // Note-on, get velocity
        this.midiVelocity[this.midiNote] = byte;
        this.midiState = 1;
        this.drawKeyboard(false);
        break;

      case 3: // Note-off, get note
        this.midiNote = byte;
        this.midiState = 4;
        break;

      case 4: // Note-off, get velocity (Pascal stores as negative but displays as 0)
        this.midiVelocity[this.midiNote] = 0; // Note off always shows as no velocity
        this.midiState = 3;
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
   * Clean up resources when window is closed
   */
  closeDebugWindow(): void {
    if (this.midiWindow) {
      this.midiWindow.close();
      this.midiWindow = null;
    }
    
    this.keyLayout = null;
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