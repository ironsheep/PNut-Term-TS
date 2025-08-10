import { DebugWindowBase } from './debugWindowBase';
import { Context } from '../utils/context';
import { BrowserWindow } from 'electron';
import { CanvasRenderer } from './shared/canvasRenderer';
import { ColorTranslator, ColorMode } from './shared/colorTranslator';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { ScopeXyRenderer } from './shared/scopeXyRenderer';
import { PersistenceManager } from './shared/persistenceManager';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { PackedDataMode, ePackedDataMode, ePackedDataWidth } from './debugWindowBase';

/**
 * Scope XY display specification
 */
export interface ScopeXyDisplaySpec {
  displayName: string;
  title: string;
  position?: { x: number; y: number };
  radius?: number;
  range?: number;
  samples?: number;
  rate?: number;
  dotSize?: number;
  polar?: { twopi: number; theta: number };
  logScale?: boolean;
  hideXY?: boolean;
}

/**
 * Debug SCOPE_XY Window - XY Oscilloscope Display
 * 
 * The SCOPE_XY display is an XY oscilloscope with 1-8 channels that displays data points
 * as X,Y coordinate pairs with optional persistence and multiple display modes.
 * 
 * ## Features
 * - **Display Modes**: Cartesian (default) or Polar coordinate systems
 * - **Scaling**: Linear or Logarithmic scaling for magnification
 * - **Persistence**: Infinite (samples=0) or fading (1-512 samples) with opacity gradient
 * - **Channels**: 1-8 channels, each represented as an X,Y coordinate pair
 * - **Anti-aliasing**: Points rendered with Canvas API anti-aliasing
 * - **Grid**: Circular grid with concentric circles and radial lines
 * 
 * ## Configuration Parameters
 * - `TITLE 'string'` - Set window caption
 * - `POS left top` - Set window position (default: 0, 0)
 * - `SIZE radius` - Set display radius in pixels (32-2048, default: 128)
 * - `RANGE 1_to_7FFFFFFF` - Set unit circle radius for data (default: 0x7FFFFFFF)
 * - `SAMPLES 0_to_512` - Set persistence (0=infinite, 1-512=fading, default: 256)
 * - `RATE 1_to_512` - Set update rate in samples (default: 1)
 * - `DOTSIZE 2_to_20` - Set dot size in half-pixels (default: 6)
 * - `TEXTSIZE 6_to_200` - Set legend text size (default: editor size)
 * - `COLOR back {grid}` - Set background and optional grid colors
 * - `POLAR {twopi {offset}}` - Enable polar mode with optional parameters
 * - `LOGSCALE` - Enable log scale mode for magnification
 * - `HIDEXY` - Hide X,Y mouse coordinates
 * - `'name' {color}` - Define channel name and optional color
 * - Packed data modes - Enable packed data processing
 * 
 * ## Data Format
 * Data is fed as numerical values representing X,Y coordinate pairs:
 * - Sequential values are paired: first value = X, second value = Y
 * - Multiple channels supported: pairs cycle through defined channels
 * - Values scaled by configured RANGE parameter
 * 
 * ## Commands
 * - `CLEAR` - Clear display and sample buffer
 * - `SAVE {WINDOW} 'filename'` - Save bitmap of display or entire window
 * - `CLOSE` - Close the window
 * - `PC_KEY` - Forward keyboard input to P2
 * - `PC_MOUSE` - Forward mouse input to P2
 * 
 * ## Examples
 * ```spin2
 * ' Basic XY grid pattern (DEBUG_SCOPE_XY_Grid.spin2)
 * debug(`SCOPE_XY MyXY SIZE 80 RANGE 8 SAMPLES 0 'Normal')
 * repeat x from -8 to 8
 *   repeat y from -8 to 8
 *     debug(`MyXY `(x,y))
 * 
 * ' Polar spiral pattern (DEBUG_SCOPE_XY_Spiral.spin2)
 * debug(`SCOPE_XY MyXY RANGE 500 POLAR 360 'G' 'R' 'B')
 * repeat i from 0 to 500
 *   debug(`MyXY `(i, i, i, i+120, i, i+240))
 * 
 * ' Log scale magnification (DEBUG_SCOPE_XY_LogScale.spin2)
 * debug(`SCOPE_XY MyXY SIZE 80 RANGE 8 SAMPLES 0 LOGSCALE 'Logscale')
 * ```
 * 
 * ## Pascal Reference
 * Based on Pascal implementation in DebugDisplayUnit.pas:
 * - Configuration: `SCOPE_XY_Configure` procedure (line 1386)
 * - Update: `SCOPE_XY_Update` procedure (line 1443)
 * - Coordinate transformation: `ScopeXY_Transform` procedures
 * - Persistence management: `ScopeXY_Persistence` procedures
 * 
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_SCOPE_XY_Grid.spin2
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_SCOPE_XY_LogScale.spin2
 * @see /pascal-source/P2_PNut_Public/DEBUG-TESTING/DEBUG_SCOPE_XY_Spiral.spin2
 * @see /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas
 */
export class DebugScopeXyWindow extends DebugWindowBase {
  private renderer: ScopeXyRenderer | null = null;
  private persistenceManager: PersistenceManager;
  private canvasRenderer: CanvasRenderer | null = null;
  private colorTranslator: ColorTranslator;
  private packedDataProcessor: PackedDataProcessor;
  private packedDataMode: PackedDataMode | null = null;
  
  // Canvas elements
  private scopeXyCanvasId: string;
  private idString: string;
  private windowTitle: string;
  private windowContent: string = '';

  // Configuration
  private range: number = 0x7FFFFFFF;
  private samples: number = 256;
  private rate: number = 1;
  private dotSize: number = 6;
  private textSize: number = 10;
  private polar: boolean = false;
  private twopi: number = 0x100000000;
  private theta: number = 0;
  private logScale: boolean = false;
  private hideXY: boolean = false;
  private radius: number = 128;
  private scale: number = 1;
  private backgroundColor: number = 0x000000;

  // Channels
  private channels: Array<{ name: string; color: number }> = [];
  private channelIndex: number = 0;
  private currentChannel: number = 0;
  private dataBuffer: number[] = [];

  // Rate control
  private rateCounter: number = 0;

  // Colors - exact from Pascal DefaultScopeColors
  private readonly defaultColors = [
    0x00FF00, // clLime
    0xFF0000, // clRed
    0x00FFFF, // clCyan
    0xFFFF00, // clYellow
    0xFF00FF, // clMagenta
    0x0000FF, // clBlue
    0xFFA500, // clOrange
    0x808000  // clOlive
  ];

  constructor(ctx: Context, windowId: string = `scopexy-${Date.now()}`) {
    super(ctx, windowId, 'scopexy');
    this.windowLogPrefix = 'CL-scopeXy';

    // Initialize shared components
    this.colorTranslator = new ColorTranslator();
    this.packedDataProcessor = new PackedDataProcessor();
    this.persistenceManager = new PersistenceManager();
    
    // Generate unique canvas ID
    this.idString = Date.now().toString();
    this.scopeXyCanvasId = `scope-xy-canvas-${this.idString}`;
    this.windowTitle = 'SCOPE_XY';
  }

  /**
   * Get the canvas ID for this window
   */
  getCanvasId(): string {
    return this.scopeXyCanvasId;
  }

  /**
   * Override enableMouseInput to add SCOPE_XY-specific coordinate transformation
   */
  protected enableMouseInput(): void {
    // Call base implementation first
    super.enableMouseInput();
    
    // Add SCOPE_XY-specific coordinate display functionality
    if (!this.hideXY && this.debugWindow && !this.debugWindow.isDestroyed()) {
      // Set up mouse move handler for coordinate display
      this.debugWindow.webContents.on('console-message', (_event, _level, message) => {
        // Parse mouse coordinates from console messages if needed
        if (message.startsWith('MOUSE:')) {
          const coords = message.substring(6).split(',');
          if (coords.length === 2) {
            const screenX = parseInt(coords[0]);
            const screenY = parseInt(coords[1]);
            
            // Transform to data coordinates
            const dataCoords = this.screenToDataCoordinates(screenX, screenY);
            
            // Display coordinates in window title or overlay
            const coordStr = this.polar ? 
              `R:${dataCoords.x} θ:${dataCoords.y}` :
              `X:${dataCoords.x} Y:${dataCoords.y}`;
            
            if (this.debugWindow && !this.debugWindow.isDestroyed()) {
              this.debugWindow.setTitle(`${this.windowTitle} - ${coordStr}`);
            }
          }
        }
      });
      
      // Inject mouse tracking JavaScript
      const trackingScript = `
        document.addEventListener('mousemove', (e) => {
          const canvas = document.getElementById('${this.scopeXyCanvasId}');
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            console.log('MOUSE:' + Math.floor(x) + ',' + Math.floor(y));
          }
        });
      `;
      
      this.debugWindow.webContents.executeJavaScript(trackingScript).catch(err => {
        console.error('Failed to inject mouse tracking:', err);
      });
    }
  }

  /**
   * Transform screen coordinates to data coordinates
   */
  private screenToDataCoordinates(screenX: number, screenY: number): { x: number; y: number } {
    // Convert screen coordinates to data values
    const centerX = this.radius;
    const centerY = this.radius;
    
    // Offset from center
    const x = screenX - centerX;
    const y = centerY - screenY; // Y is inverted in screen coordinates
    
    if (this.polar) {
      // Convert cartesian screen coords to polar data values
      const r = Math.sqrt(x * x + y * y);
      let dataRadius: number;
      
      if (this.logScale && r > 0) {
        // Inverse log transformation
        // Original: rf = (log2(r+1) / log2(range+1)) * scale
        // Inverse: r = 2^((rf/scale) * log2(range+1)) - 1
        const normalizedR = r / this.scale;
        dataRadius = Math.pow(2, normalizedR * Math.log2(this.range + 1)) - 1;
      } else {
        dataRadius = r / this.scale;
      }
      
      // Calculate angle in data units
      const angleRad = Math.atan2(-y, x); // Adjust for screen coords
      const normalizedAngle = (angleRad + Math.PI) / (2 * Math.PI); // 0 to 1
      const dataAngle = Math.floor((normalizedAngle * this.twopi - this.theta)) & 0xFFFFFFFF;
      
      return { x: Math.floor(dataRadius), y: dataAngle };
    } else {
      // Cartesian mode
      let dataX: number;
      let dataY: number;
      
      if (this.logScale) {
        // Inverse log transformation for cartesian
        const r = Math.sqrt(x * x + y * y);
        if (r > 0) {
          const normalizedR = r / this.scale;
          const originalR = Math.pow(2, normalizedR * Math.log2(this.range + 1)) - 1;
          const theta = Math.atan2(y, x);
          dataX = originalR * Math.cos(theta);
          dataY = originalR * Math.sin(theta);
        } else {
          dataX = 0;
          dataY = 0;
        }
      } else {
        // Simple linear scaling
        dataX = x / this.scale;
        dataY = y / this.scale;
      }
      
      return { x: Math.floor(dataX), y: Math.floor(dataY) };
    }
  }

  /**
   * Parse SCOPE_XY display declaration
   */
  static parseScopeXyDeclaration(lineParts: string[]): [boolean, ScopeXyDisplaySpec] {
    let displaySpec: ScopeXyDisplaySpec = {} as ScopeXyDisplaySpec;
    displaySpec.displayName = '';
    displaySpec.title = 'SCOPE_XY';
    
    let errorMessage = '';
    let isValid = true;

    if (lineParts.length < 2) {
      errorMessage = 'SCOPE_XY display name missing';
      isValid = false;
    } else {
      displaySpec.displayName = lineParts[1];
      
      // Process remaining directives (placeholder for static parsing)
      // Full parsing happens in instance method
    }

    return [isValid, displaySpec];
  }

  /**
   * Create the debug window and initialize canvas
   */
  createDebugWindow(lineParts: string[]): void {
    // Parse configuration
    this.parseConfiguration(lineParts);

    // Calculate scale
    this.scale = this.radius / this.range;

    // Create window content HTML
    const size = this.radius * 2;
    this.windowContent = `
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; background: black; overflow: hidden; }
            canvas { display: block; image-rendering: auto; }
          </style>
        </head>
        <body>
          <canvas id="${this.scopeXyCanvasId}" width="${size}" height="${size}"></canvas>
        </body>
      </html>
    `;

    // Create browser window
    this.debugWindow = new BrowserWindow({
      width: size + 16,
      height: size + 39,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: this.windowTitle,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Load content
    this.debugWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.windowContent)}`);

    // Wait for window to be ready, then initialize
    this.debugWindow.webContents.on('did-finish-load', () => {
      // Register with WindowRouter when window is ready
      this.registerWithRouter();
      // Initialize renderer after canvas is ready
      this.initializeRenderer();
      this.render();
    });

    // Handle window close
    this.debugWindow.on('closed', () => {
      this.closeDebugWindow();
    });
  }

  /**
   * Initialize renderer after canvas is ready
   */
  private initializeRenderer(): void {
    // Create the renderer
    this.renderer = new ScopeXyRenderer();
    
    // Draw initial grid if not in polar mode
    if (!this.polar && this.debugWindow && !this.debugWindow.isDestroyed()) {
      const gridScript = this.renderer.drawCircularGrid(
        this.scopeXyCanvasId,
        this.radius,
        this.radius,
        this.radius,
        8
      );
      this.debugWindow.webContents.executeJavaScript(gridScript).catch(err => {
        console.error('Grid render error:', err);
      });
    }
  }

  /**
   * Close the debug window
   */
  closeDebugWindow(): void {
    if (this.inputForwarder) {
      this.inputForwarder.stopPolling();
    }
    this.debugWindow = null;
  }

  /**
   * Update content with new data
   */
  updateContent(lineParts: string[]): void {
    const unparsedCommand = lineParts.join(' ');
    this.handleData(unparsedCommand);
  }

  private parseConfiguration(lineParts: string[]): void {
    // Start from index 2 to skip command and display name
    let i = 2;
    while (i < lineParts.length) {
      const element = lineParts[i].toUpperCase();

      switch (element) {
        case 'TITLE':
          if (i + 1 < lineParts.length) {
            this.windowTitle = this.parseString(lineParts[++i]);
          }
          break;

        case 'POS':
          if (i + 2 < lineParts.length) {
            const left = parseInt(lineParts[++i]);
            const top = parseInt(lineParts[++i]);
            // Position will be set when window is created
          }
          break;

        case 'SIZE':
          if (i + 1 < lineParts.length) {
            const size = parseInt(lineParts[++i]);
            this.radius = Math.max(32, Math.min(2048, size));
          }
          break;

        case 'RANGE':
          if (i + 1 < lineParts.length) {
            const range = parseInt(lineParts[++i]);
            this.range = Math.max(1, Math.min(0x7FFFFFFF, range));
          }
          break;

        case 'SAMPLES':
          if (i + 1 < lineParts.length) {
            const samples = parseInt(lineParts[++i]);
            this.samples = Math.max(0, Math.min(512, samples));
            this.persistenceManager.setPersistence(this.samples);
          }
          break;

        case 'RATE':
          if (i + 1 < lineParts.length) {
            const rate = parseInt(lineParts[++i]);
            this.rate = Math.max(1, Math.min(512, rate));
          }
          break;

        case 'DOTSIZE':
          if (i + 1 < lineParts.length) {
            const dotSize = parseInt(lineParts[++i]);
            this.dotSize = Math.max(2, Math.min(20, dotSize));
          }
          break;

        case 'TEXTSIZE':
          if (i + 1 < lineParts.length) {
            const textSize = parseInt(lineParts[++i]);
            this.textSize = Math.max(6, Math.min(200, textSize));
          }
          break;

        case 'COLOR':
          if (i + 1 < lineParts.length) {
            const bgColor = this.colorTranslator.translateColor(
              parseInt(lineParts[++i]) || 0
            );
            this.backgroundColor = bgColor;
            if (i + 1 < lineParts.length && !this.isKeyword(lineParts[i + 1])) {
              const gridColor = this.colorTranslator.translateColor(
                parseInt(lineParts[++i]) || 0
              );
              if (this.renderer) {
                this.renderer.setGridColor(gridColor);
              }
            }
          }
          break;

        case 'POLAR':
          this.polar = true;
          if (i + 1 < lineParts.length && !this.isKeyword(lineParts[i + 1])) {
            this.twopi = parseInt(lineParts[++i]) || 0x100000000;
            if (i + 1 < lineParts.length && !this.isKeyword(lineParts[i + 1])) {
              this.theta = parseInt(lineParts[++i]) || 0;
            }
          }
          break;

        case 'LOGSCALE':
          this.logScale = true;
          break;

        case 'HIDEXY':
          this.hideXY = true;
          break;

        // Packed data modes
        case 'LONGS_1BIT':
        case 'LONGS_2BIT':
        case 'LONGS_4BIT':
        case 'LONGS_8BIT':
        case 'LONGS_16BIT':
        case 'WORDS_1BIT':
        case 'WORDS_2BIT':
        case 'WORDS_4BIT':
        case 'WORDS_8BIT':
        case 'BYTES_1BIT':
        case 'BYTES_2BIT':
        case 'BYTES_4BIT':
          // Set packed data mode
          this.packedDataMode = this.getPackedDataMode(element);
          // Check for ALT and SIGNED modifiers
          if (i + 1 < lineParts.length) {
            if (lineParts[i + 1].toUpperCase() === 'ALT') {
              if (this.packedDataMode) this.packedDataMode.isAlternate = true;
              i++;
            }
            if (i + 1 < lineParts.length && lineParts[i + 1].toUpperCase() === 'SIGNED') {
              if (this.packedDataMode) this.packedDataMode.isSigned = true;
              i++;
            }
          }
          break;

        default:
          // Check if it's a channel definition (string)
          if (element.startsWith("'") || element.startsWith('"')) {
            const channelName = this.parseString(element);
            let color = this.defaultColors[this.channels.length % 8];
            
            // Check for optional color
            if (i + 1 < lineParts.length && !this.isKeyword(lineParts[i + 1])) {
              color = this.colorTranslator.translateColor(parseInt(lineParts[++i]) || 0);
            }
            
            this.channels.push({ name: channelName, color });
            this.channelIndex++;
          }
          break;
      }
      i++;
    }

    // If no channels defined, create one default channel
    if (this.channels.length === 0) {
      this.channels.push({ name: '', color: this.defaultColors[0] });
      this.channelIndex = 1;
    }
  }

  private parseString(str: string): string {
    // Remove quotes
    if ((str.startsWith("'") && str.endsWith("'")) || 
        (str.startsWith('"') && str.endsWith('"'))) {
      return str.slice(1, -1);
    }
    return str;
  }

  private isKeyword(str: string): boolean {
    const keywords = [
      'TITLE', 'POS', 'SIZE', 'RANGE', 'SAMPLES', 'RATE', 'DOTSIZE',
      'TEXTSIZE', 'COLOR', 'POLAR', 'LOGSCALE', 'HIDEXY', 'CLEAR',
      'SAVE', 'CLOSE', 'PC_KEY', 'PC_MOUSE', 'ALT', 'SIGNED',
      'LONGS_1BIT', 'LONGS_2BIT', 'LONGS_4BIT', 'LONGS_8BIT', 'LONGS_16BIT',
      'WORDS_1BIT', 'WORDS_2BIT', 'WORDS_4BIT', 'WORDS_8BIT',
      'BYTES_1BIT', 'BYTES_2BIT', 'BYTES_4BIT'
    ];
    return keywords.includes(str.toUpperCase());
  }

  private getPackedDataMode(modeStr: string): PackedDataMode | null {
    const modeMap: { [key: string]: PackedDataMode } = {
      'LONGS_1BIT': { mode: ePackedDataMode.PDM_LONGS_1BIT, bitsPerSample: 1, valueSize: ePackedDataWidth.PDW_LONGS, isAlternate: false, isSigned: false },
      'LONGS_2BIT': { mode: ePackedDataMode.PDM_LONGS_2BIT, bitsPerSample: 2, valueSize: ePackedDataWidth.PDW_LONGS, isAlternate: false, isSigned: false },
      'LONGS_4BIT': { mode: ePackedDataMode.PDM_LONGS_4BIT, bitsPerSample: 4, valueSize: ePackedDataWidth.PDW_LONGS, isAlternate: false, isSigned: false },
      'LONGS_8BIT': { mode: ePackedDataMode.PDM_LONGS_8BIT, bitsPerSample: 8, valueSize: ePackedDataWidth.PDW_LONGS, isAlternate: false, isSigned: false },
      'LONGS_16BIT': { mode: ePackedDataMode.PDM_LONGS_16BIT, bitsPerSample: 16, valueSize: ePackedDataWidth.PDW_LONGS, isAlternate: false, isSigned: false },
      'WORDS_1BIT': { mode: ePackedDataMode.PDM_WORDS_1BIT, bitsPerSample: 1, valueSize: ePackedDataWidth.PDW_WORDS, isAlternate: false, isSigned: false },
      'WORDS_2BIT': { mode: ePackedDataMode.PDM_WORDS_2BIT, bitsPerSample: 2, valueSize: ePackedDataWidth.PDW_WORDS, isAlternate: false, isSigned: false },
      'WORDS_4BIT': { mode: ePackedDataMode.PDM_WORDS_4BIT, bitsPerSample: 4, valueSize: ePackedDataWidth.PDW_WORDS, isAlternate: false, isSigned: false },
      'WORDS_8BIT': { mode: ePackedDataMode.PDM_WORDS_8BIT, bitsPerSample: 8, valueSize: ePackedDataWidth.PDW_WORDS, isAlternate: false, isSigned: false },
      'BYTES_1BIT': { mode: ePackedDataMode.PDM_BYTES_1BIT, bitsPerSample: 1, valueSize: ePackedDataWidth.PDW_BYTES, isAlternate: false, isSigned: false },
      'BYTES_2BIT': { mode: ePackedDataMode.PDM_BYTES_2BIT, bitsPerSample: 2, valueSize: ePackedDataWidth.PDW_BYTES, isAlternate: false, isSigned: false },
      'BYTES_4BIT': { mode: ePackedDataMode.PDM_BYTES_4BIT, bitsPerSample: 4, valueSize: ePackedDataWidth.PDW_BYTES, isAlternate: false, isSigned: false }
    };
    return modeMap[modeStr] || null;
  }

  protected handleData(data: string): void {
    const elements = data.trim().split(/\s+/);
    
    for (const element of elements) {
      const upperElement = element.toUpperCase();

      // Handle commands
      if (upperElement === 'CLEAR') {
        this.persistenceManager.clear();
        this.dataBuffer = [];
        this.currentChannel = 0;
        this.rateCounter = 0;
        this.render();
        continue;
      }

      if (upperElement === 'SAVE') {
        // Handle SAVE command with optional WINDOW parameter
        let saveWindow = false;
        let filename = 'scope_xy.bmp';
        const saveIdx = elements.indexOf(element);
        
        if (saveIdx + 1 < elements.length) {
          if (elements[saveIdx + 1].toUpperCase() === 'WINDOW') {
            saveWindow = true;
            if (saveIdx + 2 < elements.length) {
              filename = elements[saveIdx + 2];
            }
            elements.splice(saveIdx + 1, 2); // Remove WINDOW and filename
          } else {
            filename = elements[saveIdx + 1];
            elements.splice(saveIdx + 1, 1); // Remove filename
          }
        }
        
        // Use inherited method from DebugWindowBase
        if (this.debugWindow && !this.debugWindow.isDestroyed()) {
          if (saveWindow) {
            this.saveWindowToBMPFilename(filename);
          } else {
            // For now, save the whole window (canvas-only save would need additional implementation)
            this.saveWindowToBMPFilename(filename);
          }
        }
        continue;
      }

      if (upperElement === 'CLOSE') {
        this.closeDebugWindow();
        return;
      }

      if (upperElement === 'PC_KEY') {
        // Enable keyboard forwarding to P2 device
        this.enableKeyboardInput();
        continue;
      }

      if (upperElement === 'PC_MOUSE') {
        // Enable mouse forwarding to P2 device
        this.enableMouseInput();
        continue;
      }

      // Process numerical data
      const value = parseInt(element);
      if (!isNaN(value)) {
        // Unpack if using packed data mode
        const unpacked = this.packedDataMode ? 
          PackedDataProcessor.unpackSamples(value, this.packedDataMode) : [value];
        
        for (const v of unpacked) {
          this.dataBuffer.push(v);
          
          // Check if we have a complete X,Y pair for current channel
          if (this.dataBuffer.length === 2) {
            const x = this.dataBuffer[0];
            const y = this.dataBuffer[1];
            this.dataBuffer = [];
            
            // Add to current channel's data
            const channelData = new Array(this.channelIndex * 2).fill(0);
            channelData[this.currentChannel * 2] = x;
            channelData[this.currentChannel * 2 + 1] = y;
            
            // Move to next channel
            this.currentChannel = (this.currentChannel + 1) % this.channelIndex;
            
            // If we've filled all channels, process the sample
            if (this.currentChannel === 0) {
              this.rateCounter++;
              
              if (this.samples === 0) {
                // Infinite persistence - plot immediately
                // Note: We'll accumulate and render based on rate
                if (this.rateCounter >= this.rate) {
                  this.render();
                  this.rateCounter = 0;
                }
              } else {
                // Fading persistence - add to buffer
                this.persistenceManager.addSample(channelData);
                if (this.rateCounter >= this.rate) {
                  this.render();
                  this.rateCounter = 0;
                }
              }
            }
          }
        }
      }
    }
  }

  private render(): void {
    if (!this.debugWindow || this.debugWindow.isDestroyed() || !this.renderer) {
      return;
    }

    // Clear canvas
    const clearScript = this.renderer.clear(
      this.scopeXyCanvasId,
      this.radius * 2,
      this.radius * 2,
      this.backgroundColor
    );
    
    this.debugWindow.webContents.executeJavaScript(clearScript).then(() => {
      if (!this.debugWindow || this.debugWindow.isDestroyed() || !this.renderer) {
        return;
      }
      
      // Draw grid
      const gridScript = this.renderer.drawCircularGrid(
        this.scopeXyCanvasId,
        this.radius,
        this.radius,
        this.radius,
        8
      );
      
      return this.debugWindow.webContents.executeJavaScript(gridScript);
    }).then(() => {
      if (!this.debugWindow || this.debugWindow.isDestroyed() || !this.renderer) {
        return;
      }
      
      // Get samples with opacity
      const samples = this.persistenceManager.getSamplesWithOpacity();
      
      // Plot each sample
      const plotScripts: string[] = [];
      for (const sample of samples) {
        // Process each channel in the sample
        for (let ch = 0; ch < this.channelIndex; ch++) {
          const x = sample.data[ch * 2];
          const y = sample.data[ch * 2 + 1];
          
          if (x === undefined || y === undefined) continue;
          
          // Transform coordinates based on mode
          let screenCoords: { x: number; y: number };
          
          if (this.polar) {
            screenCoords = this.renderer.transformPolar(
              x,
              y,
              this.twopi,
              this.theta,
              this.scale,
              this.logScale,
              this.range
            );
          } else {
            screenCoords = this.renderer.transformCartesian(
              x,
              y,
              this.scale,
              this.logScale,
              this.range
            );
          }
          
          // Convert to screen coordinates (center at radius, radius)
          const screenX = this.radius + screenCoords.x;
          const screenY = this.radius - screenCoords.y; // Y is inverted
          
          // Get channel color
          const color = this.channels[ch]?.color || this.defaultColors[ch % 8];
          
          // Generate plot script
          const plotScript = this.renderer.plotPoint(
            this.scopeXyCanvasId,
            screenX,
            screenY,
            color,
            sample.opacity,
            this.dotSize
          );
          
          plotScripts.push(plotScript);
        }
      }
      
      // Execute all plot scripts as a batch
      if (plotScripts.length > 0) {
        const combinedScript = plotScripts.join('\n');
        return this.debugWindow.webContents.executeJavaScript(combinedScript);
      }
    }).catch(err => {
      console.error('Render error:', err);
    });
  }
}