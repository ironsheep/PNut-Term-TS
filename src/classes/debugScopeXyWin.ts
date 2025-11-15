import { DebugWindowBase } from './debugWindowBase';
import { Context } from '../utils/context';
import { BrowserWindow } from 'electron';
import { CanvasRenderer } from './shared/canvasRenderer';
import { ColorTranslator, ColorMode } from './shared/colorTranslator';
import { PackedDataProcessor } from './shared/packedDataProcessor';
import { ScopeXyRenderer } from './shared/scopeXyRenderer';
import { PersistenceManager } from './shared/persistenceManager';
import { Spin2NumericParser } from './shared/spin2NumericParser';
import { DisplaySpecParser, BaseDisplaySpec } from './shared/displaySpecParser';
import { PackedDataMode, ePackedDataMode, ePackedDataWidth } from './debugWindowBase';
import { WindowPlacer, PlacementConfig } from '../utils/windowPlacer';

// Console logging control for debugging
const ENABLE_CONSOLE_LOG: boolean = false;

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
  hasExplicitPosition: boolean;
  fullConfiguration?: string[]; // Store the full configuration message
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
 * - `DOTSIZE 2_to_20` - Set dot size (default: 6, radius = dotSize/4 pixels)
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
  private displaySpec: ScopeXyDisplaySpec;

  private renderer: ScopeXyRenderer | null = null;
  private persistenceManager: PersistenceManager;
  private canvasRenderer: CanvasRenderer | null = null;
  private colorTranslator: ColorTranslator;
  private packedDataProcessor: PackedDataProcessor;
  private packedDataMode: PackedDataMode | null = null;

  // Canvas elements
  private scopeXyCanvasId: string;
  private idString: string;
  private _windowTitle: string;
  private windowContent: string = '';

  get windowTitle(): string {
    return this._windowTitle;
  }

  // Configuration
  private range: number = 0x7fffffff;
  private samples: number = 256;
  private rate: number = 1;
  private dotSize: number = 6;
  private textSize: number = 10;
  private polar: boolean = false;
  private twopi: number = 0x100000000;
  private theta: number = 0;
  private logScale: boolean = false;
  protected hideXY: boolean = false;
  private radius: number = 128;
  private scale: number = 1;
  private backgroundColor: number = 0x000000;

  // Channels
  private channels: Array<{ name: string; color: number }> = [];
  private channelIndex: number = 0;
  private dataBuffer: number[] = [];

  // Rate control
  private rateCounter: number = 0;

  // Render throttle control - prevents listener accumulation from concurrent executeJavaScript calls
  private renderInProgress: boolean = false;
  private renderPending: boolean = false;

  // Canvas margins - Pascal SetSize(ChrHeight*2, ChrHeight*2, ChrHeight*2, ChrHeight*2)
  private margin: number = 0; // Calculated as textSize * 2

  // Colors - exact from Pascal DefaultScopeColors
  private readonly defaultColors = [
    0x00ff00, // clLime
    0xff0000, // clRed
    0x00ffff, // clCyan
    0xffff00, // clYellow
    0xff00ff, // clMagenta
    0x0000ff, // clBlue
    0xffa500, // clOrange
    0x808000 // clOlive
  ];

  constructor(ctx: Context, displaySpec: ScopeXyDisplaySpec, windowId: string = `scopexy-${Date.now()}`) {
    super(ctx, windowId, 'scopexy');
    this.windowLogPrefix = 'CL-scopeXy';

    this.displaySpec = displaySpec;

    // Initialize shared components
    this.colorTranslator = new ColorTranslator();
    this.packedDataProcessor = new PackedDataProcessor();
    this.persistenceManager = new PersistenceManager();

    // Enable logging for SCOPE_XY window
    this.isLogging = false;

    // Generate unique canvas ID
    this.idString = Date.now().toString();
    this.scopeXyCanvasId = `scope-xy-canvas-${this.idString}`;
    // Window title format: "{displayName} - SCOPE_XY"
    this._windowTitle = `${displaySpec.displayName} - SCOPE_XY`;

    // CRITICAL FIX: Create window immediately, don't wait for first message
    // This ensures windows appear when created, matching Logic/Scope/Term pattern
    this.logMessage('Creating SCOPE_XY window immediately in constructor');

    // Use the full configuration if available, otherwise use defaults
    const configLineParts = displaySpec.fullConfiguration || ['SCOPE_XY', displaySpec.displayName || 'ScopeXY'];
    this.createDebugWindow(configLineParts);

    // NOTE: onWindowReady() is called in did-finish-load after renderer is initialized
  }

  /**
   * Get the canvas ID for this window
   */
  getCanvasId(): string {
    return this.scopeXyCanvasId;
  }

  /**
   * Clear display and sample buffer (called by base class CLEAR command)
   */
  protected clearDisplayContent(): void {
    this.persistenceManager.clear();
    this.dataBuffer = [];
    this.rateCounter = 0;
    this.backgroundDrawn = false;
    this.render(true); // Force clear
  }

  /**
   * Force display update (called by base class UPDATE command)
   */
  protected forceDisplayUpdate(): void {
    this.render();
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
            const coordStr = this.polar ? `R:${dataCoords.x} θ:${dataCoords.y}` : `X:${dataCoords.x} Y:${dataCoords.y}`;

            if (this.debugWindow && !this.debugWindow.isDestroyed()) {
              this.debugWindow.setTitle(`${this.windowTitle} - ${coordStr}`);
            }
          }
        }
      });

      // Wait for window to load before injecting JavaScript
      this.debugWindow.webContents.once('did-finish-load', () => {
        const trackingScript = `
          document.addEventListener('mousemove', (e) => {
            const canvas = document.getElementById('${this.scopeXyCanvasId}');
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              if (ENABLE_CONSOLE_LOG) console.log('MOUSE:' + Math.floor(x) + ',' + Math.floor(y));
            }
          });
        `;

        this.debugWindow!.webContents.executeJavaScript(trackingScript).catch((err) => {
          console.error('Failed to inject mouse tracking:', err);
        });
      });
    }
  }

  /**
   * Transform screen coordinates to data coordinates
   */
  private screenToDataCoordinates(screenX: number, screenY: number): { x: number; y: number } {
    // Convert screen coordinates to data values
    // Grid center is offset by margin
    const centerX = this.margin + this.radius;
    const centerY = this.margin + this.radius;

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
      const dataAngle = Math.floor(normalizedAngle * this.twopi - this.theta) & 0xffffffff;

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
    displaySpec.hasExplicitPosition = false; // Default: use auto-placement
    displaySpec.fullConfiguration = lineParts; // SAVE THE FULL CONFIGURATION!

    let errorMessage = '';
    let isValid = true;

    if (lineParts.length < 2) {
      errorMessage = 'SCOPE_XY display name missing';
      isValid = false;
    } else {
      displaySpec.displayName = lineParts[1];

      // Check for POS clause in declaration
      for (let i = 2; i < lineParts.length - 1; i++) {
        if (lineParts[i].toUpperCase() === 'POS') {
          displaySpec.hasExplicitPosition = true; // POS clause found - use explicit position
          break;
        }
      }
    }

    return [isValid, displaySpec];
  }

  /**
   * Create the debug window and initialize canvas
   */
  createDebugWindow(lineParts: string[]): void {
    // Parse configuration
    this.parseConfiguration(lineParts);

    // Calculate margin from textSize (matches Pascal ChrHeight * 2)
    this.margin = this.textSize * 2;

    // Calculate scale
    this.scale = this.radius / this.range;

    // Canvas size includes data area (radius * 2) PLUS margins on all sides
    const canvasSize = this.radius * 2 + this.margin * 2;
    this.windowContent = `
      <html>
        <head>
          <meta charset="UTF-8"></meta>
          <title>${this.windowTitle}</title>
          <style>
            body { margin: 0; padding: 0; background: black; overflow: hidden; display: flex; justify-content: center; align-items: center; }
            canvas { display: block; image-rendering: auto; width: ${canvasSize}px; height: ${canvasSize}px; }
          </style>
        </head>
        <body>
          <canvas id="${this.scopeXyCanvasId}" width="${canvasSize}" height="${canvasSize}"></canvas>
        </body>
      </html>
    `;

    // Calculate window dimensions
    // SCOPE_XY uses square canvas that should fill window horizontally
    // Only add height for title bar, no side borders (matches Pascal behavior)
    const TITLE_BAR_HEIGHT = 40;
    const windowWidth = canvasSize;
    const windowHeight = canvasSize + TITLE_BAR_HEIGHT;

    // Determine position based on hasExplicitPosition flag
    let windowX: number;
    let windowY: number;

    if (!this.displaySpec.hasExplicitPosition) {
      // Use WindowPlacer for intelligent auto-positioning
      this.logConsoleMessage(`[SCOPEXY] 🎯 Using WindowPlacer for auto-placement`);
      const windowPlacer = WindowPlacer.getInstance();
      const placementConfig: PlacementConfig = {
        dimensions: { width: windowWidth, height: windowHeight },
        avoidOverlap: true
      };
      const position = windowPlacer.getNextPosition(`scopexy-${this.windowTitle}`, placementConfig);
      windowX = position.x;
      windowY = position.y;

      // Log to debug logger with reproducible command format
      try {
        const LoggerWindow = require('./loggerWin').LoggerWindow;
        const debugLogger = LoggerWindow.getInstance(this.context);
        const monitorId = position.monitor ? position.monitor.id : '1';
        debugLogger.logSystemMessage(
          `WINDOW_PLACED (${windowX},${windowY} ${windowWidth}x${windowHeight} Mon:${monitorId}) SCOPE_XY '${this.displaySpec.displayName}' POS ${windowX} ${windowY} SIZE ${windowWidth} ${windowHeight}`
        );
      } catch (error) {
        console.warn('Failed to log WINDOW_PLACED to debug logger:', error);
      }
    } else {
      // Use explicit position from POS clause
      this.logConsoleMessage(
        `[SCOPEXY] 📍 Using explicit position from POS clause: (${this.displaySpec.position?.x}, ${this.displaySpec.position?.y})`
      );
      windowX = this.displaySpec.position?.x || 0;
      windowY = this.displaySpec.position?.y || 0;
    }

    // Create browser window with determined position
    this.debugWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: this.windowTitle,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false
      }
    });

    // Load content - Debug the HTML being loaded
    this.logConsoleMessage(
      `[SCOPEXY] Loading HTML content (${this.windowContent.length} chars):`,
      this.windowContent.substring(0, 200)
    );

    // Add error handling for loadURL
    this.debugWindow.loadURL(`data:text/html,${encodeURIComponent(this.windowContent)}`).catch((error) => {
      console.error(`[SCOPEXY] loadURL failed:`, error);
    });

    // Debug: Add webContents error handlers
    this.debugWindow.webContents.on(
      'did-fail-load',
      (event: any, errorCode: number, errorDescription: string, validatedURL: string) => {
        console.error(`[SCOPEXY] did-fail-load: code=${errorCode}, desc="${errorDescription}", url="${validatedURL}"`);
      }
    );

    this.debugWindow.webContents.on('render-process-gone', (event: any, details: any) => {
      console.error(`[SCOPEXY] render process gone:`, details);
    });

    // Pattern A: Use ready-to-show event like working prototype windows
    this.debugWindow.once('ready-to-show', () => {
      this.logMessage('at ready-to-show');
      // Register with WindowRouter when window is ready
      this.registerWithRouter();

      // Register with WindowPlacer only if using auto-placement
      if (this.debugWindow) {
        if (!this.displaySpec.hasExplicitPosition) {
          this.logConsoleMessage(`[SCOPEXY] 📝 Registering with WindowPlacer for position tracking`);
          const windowPlacer = WindowPlacer.getInstance();
          windowPlacer.registerWindow(`scopexy-${this.windowTitle}`, this.debugWindow);
        } else {
          this.logConsoleMessage(`[SCOPEXY] ⚡ Skipping WindowPlacer registration - using explicit position`);
        }
        this.debugWindow.show();
      } else {
        console.warn('[ScopeXY] Cannot register with WindowPlacer - debugWindow is null');
      }
    });

    // Initialize renderer after content loads
    this.debugWindow.webContents.once('did-finish-load', () => {
      this.logMessage('at did-finish-load');

      // First, verify canvas exists
      const canvasCheckScript = `
        const canvas = document.getElementById('${this.scopeXyCanvasId}');
        JSON.stringify({
          canvasExists: !!canvas,
          canvasId: canvas ? canvas.id : 'none',
          canvasWidth: canvas ? canvas.width : 0,
          canvasHeight: canvas ? canvas.height : 0,
          bodyBgColor: document.body.style.backgroundColor,
          documentReady: document.readyState
        });
      `;

      this.debugWindow?.webContents
        .executeJavaScript(canvasCheckScript)
        .then((result: string) => {
          this.logMessage(`Canvas check result: ${result}`);
          const info = JSON.parse(result);
          if (!info.canvasExists) {
            console.error('[SCOPEXY] CRITICAL: Canvas element not found!');
            this.logMessage('ERROR: Canvas element not found in DOM');
          }
        })
        .catch((err) => {
          console.error('[SCOPEXY] Canvas check error:', err);
          this.logMessage(`Canvas check error: ${err}`);
        });

      // Initialize renderer after canvas is ready
      this.initializeRenderer();

      // Do initial render to show grid with clear
      this.logMessage('did-finish-load: Calling initial render()');
      this.render(true); // Force clear on initial render

      // CRITICAL: Mark window as ready to process messages
      this.logMessage('did-finish-load: Calling onWindowReady()');
      this.onWindowReady();
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
    this.logMessage(
      `initializeRenderer: Created renderer, radius=${this.radius}, polar=${this.polar}, margin=${this.margin}`
    );

    // Always initialize canvas with basic setup to ensure renderer context works
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      // Canvas size includes margins on all sides
      const canvasSize = this.radius * 2 + this.margin * 2;

      // Simple canvas initialization - no complex chaining
      const clearScript = this.renderer.clear(this.scopeXyCanvasId, canvasSize, canvasSize, this.backgroundColor);

      this.logMessage(`initializeRenderer: Executing clear script for canvas '${this.scopeXyCanvasId}'`);

      // Wrap in try-catch to get actual error
      const wrappedClearScript = `
        try {
          ${clearScript}
        } catch(e) {
          console.error('Actual JavaScript error in clear:', e.toString(), e.stack);
          throw e;
        }
      `;

      // Execute basic clear to establish canvas context
      this.debugWindow.webContents
        .executeJavaScript(wrappedClearScript)
        .then((result) => {
          this.logMessage(`initializeRenderer: Clear succeeded, result: ${result}`);
        })
        .catch((err) => {
          console.error('Canvas clear script error:', err);
          console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
            cause: err.cause,
            code: err.code,
            fullError: JSON.stringify(err, Object.getOwnPropertyNames(err))
          });
          this.logMessage(`initializeRenderer: Canvas clear script failed: ${err}`);
        });

      // Draw initial grid for both polar and cartesian modes
      // Grid center is offset by margin to account for canvas content margins
      const gridCenterX = this.margin + this.radius;
      const gridCenterY = this.margin + this.radius;

      const gridScript = this.renderer.drawCircularGrid(
        this.scopeXyCanvasId,
        gridCenterX, // centerX (margin + radius)
        gridCenterY, // centerY (margin + radius)
        this.radius, // grid radius
        8 // divisions
      );

      this.logMessage(`initializeRenderer: Drawing initial grid`);

      // Debug: Log the actual script being executed
      this.logConsoleMessage('[SCOPEXY] Grid script to execute:', gridScript.substring(0, 200));

      // Check for common issues
      if (gridScript.includes('undefined') || gridScript.includes('NaN')) {
        console.error('[SCOPEXY] Grid script contains undefined or NaN values!');
        this.logMessage('ERROR: Grid script has invalid values');
      }

      // Grid script with its own error handler
      this.debugWindow.webContents
        .executeJavaScript(gridScript)
        .then(() => {
          this.logMessage('initializeRenderer: Grid draw succeeded');
        })
        .catch((err) => {
          console.error('Grid script error:', err);
          console.error('Grid error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
            cause: err.cause,
            code: err.code,
            fullError: JSON.stringify(err, Object.getOwnPropertyNames(err))
          });
          this.logMessage(`initializeRenderer: Grid script failed: ${err}`);
        });

      // Range indicator script with its own error handler (separate call)
      const rangeScript = this.renderer!.drawRangeIndicator(
        this.scopeXyCanvasId,
        this.range,
        this.logScale,
        this.textSize,
        canvasSize
      );

      this.debugWindow.webContents
        .executeJavaScript(rangeScript)
        .then((rangeResult) => {
          this.logMessage(`initializeRenderer: Range indicator result: ${rangeResult}`);
        })
        .catch((err) => {
          console.error('Range indicator script error:', err);
          console.error('Range error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
            cause: err.cause,
            code: err.code,
            fullError: JSON.stringify(err, Object.getOwnPropertyNames(err))
          });
          this.logMessage(`initializeRenderer: Range indicator script failed: ${err}`);
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
   * Process data and commands (synchronous wrapper for async operations)
   */
  protected async processMessageImmediate(lineParts: string[]): Promise<void> {
    // Handle async internally
    this.processMessageAsync(lineParts);
  }

  /**
   * Process data and commands (async implementation)
   */
  private async processMessageAsync(lineParts: string[]): Promise<void> {
    // Window is now created in constructor, so just process the message
    this.logMessage(`processMessageAsync: Processing ${lineParts.length} elements: [${lineParts.join(' ')}]`);
    await this.handleData(lineParts);
  }

  private parseConfiguration(lineParts: string[]): void {
    // Start from index 2 to skip command and display name
    let i = 2;
    while (i < lineParts.length) {
      const originalElement = lineParts[i];
      const element = originalElement.toUpperCase();

      // Custom SIZE override (1 parameter for radius, not 2 like shared parser)
      if (element === 'SIZE') {
        if (i + 1 < lineParts.length) {
          const size = parseInt(lineParts[++i]);
          this.radius = Math.max(32, Math.min(2048, size));
        }
        i++;
        continue;
      }

      // Try shared parser for common keywords (TITLE, POS, SAMPLES only - not COLOR due to type difference)
      // SCOPE_XY uses numeric colors, shared parser uses RGB strings
      if (element === 'TITLE' || element === 'POS' || element === 'SAMPLES') {
        const compatibleSpec: Partial<BaseDisplaySpec> = {
          title: this._windowTitle,
          position: this.displaySpec.position || { x: 0, y: 0 },
          hasExplicitPosition: this.displaySpec.hasExplicitPosition,
          size: { width: 0, height: 0 }, // Not used
          nbrSamples: this.samples,
          window: { background: '#000000', grid: '#808080' } // Placeholder
        };
        const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(
          lineParts,
          i,
          compatibleSpec as BaseDisplaySpec
        );
        if (parsed) {
          // Copy parsed values back
          this._windowTitle = compatibleSpec.title!;
          if (compatibleSpec.position) this.displaySpec.position = compatibleSpec.position;
          if (compatibleSpec.hasExplicitPosition)
            this.displaySpec.hasExplicitPosition = compatibleSpec.hasExplicitPosition;
          if (compatibleSpec.nbrSamples !== undefined) {
            // Changed to check for undefined instead of truthiness
            this.samples = compatibleSpec.nbrSamples;
            this.persistenceManager.setPersistence(this.samples);
          }
          i += consumed;
          continue;
        }
      }

      // Handle SCOPE_XY-specific keywords
      switch (element) {
        case 'RANGE':
          if (i + 1 < lineParts.length) {
            const range = parseInt(lineParts[++i]);
            this.range = Math.max(1, Math.min(0x7fffffff, range));
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
            const nextElement = lineParts[i + 1];
            // Only parse as color if it's not a quoted string
            if (!nextElement.startsWith("'") && !nextElement.startsWith('"')) {
              const bgColor = this.colorTranslator.translateColor(parseInt(lineParts[++i]) || 0);
              this.backgroundColor = bgColor;
              // Check for optional grid color
              if (i + 1 < lineParts.length && !this.isKeyword(lineParts[i + 1])) {
                const gridElement = lineParts[i + 1];
                // Only parse as grid color if it's not a quoted string
                if (!gridElement.startsWith("'") && !gridElement.startsWith('"')) {
                  const gridColor = this.colorTranslator.translateColor(parseInt(lineParts[++i]) || 0);
                  if (this.renderer) {
                    this.renderer.setGridColor(gridColor);
                  }
                }
              }
            }
          }
          break;

        case 'POLAR':
          this.polar = true;
          if (i + 1 < lineParts.length && !this.isKeyword(lineParts[i + 1])) {
            const nextElement = lineParts[i + 1];
            // Only parse as twopi if it's not a quoted string
            if (!nextElement.startsWith("'") && !nextElement.startsWith('"')) {
              this.twopi = parseInt(lineParts[++i]) || 0x100000000;
              // Check for theta parameter
              if (i + 1 < lineParts.length && !this.isKeyword(lineParts[i + 1])) {
                const nextNextElement = lineParts[i + 1];
                // Only parse as theta if it's not a quoted string
                if (!nextNextElement.startsWith("'") && !nextNextElement.startsWith('"')) {
                  this.theta = parseInt(lineParts[++i]) || 0;
                }
              }
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
          // Check if it's a channel definition (string) - use ORIGINAL element for quote check!
          if (originalElement.startsWith("'") || originalElement.startsWith('"')) {
            const channelName = this.parseString(originalElement);
            let color = this.defaultColors[this.channels.length % 8];
            this.logMessage(`  Found channel '${channelName}', default color: 0x${color.toString(16)}`);

            // Check for optional color
            if (i + 1 < lineParts.length && !this.isKeyword(lineParts[i + 1])) {
              const nextElement = lineParts[i + 1];
              // Only consume next element if it's a number (color value)
              if (!nextElement.startsWith("'") && !nextElement.startsWith('"')) {
                const colorValue = parseInt(nextElement);
                if (!isNaN(colorValue)) {
                  const translatedColor = this.colorTranslator.translateColor(colorValue);
                  // IMPORTANT: If translation fails to black (and black wasn't intended),
                  // use BRIGHT MAGENTA as error color - it's obvious something went wrong
                  if (translatedColor === 0x000000 && colorValue !== 0) {
                    color = 0xff00ff; // Bright magenta - ERROR COLOR
                    this.logMessage(
                      `    ERROR: Color translation failed for ${colorValue}, using ERROR COLOR (magenta)`
                    );
                  } else {
                    color = translatedColor;
                    this.logMessage(`    Custom color specified: ${colorValue} -> 0x${color.toString(16)}`);
                  }
                  i++;
                }
              }
            }

            this.channels.push({ name: channelName, color });
            this.channelIndex++;
            this.logMessage(
              `  Added channel ${this.channelIndex - 1}: '${channelName}' with color 0x${color.toString(16)}`
            );
          } else {
            this.logMessage(`  Skipping non-channel element: ${originalElement}`);
          }
          break;
      }
      i++;
    }

    // If no channels defined, create one default channel
    if (this.channels.length === 0) {
      this.logMessage('No channels defined in configuration, adding default channel');
      this.channels.push({ name: '', color: this.defaultColors[0] });
      this.channelIndex = 1;
    }

    // Log final configuration
    this.logMessage(
      `Configuration complete: ${this.channelIndex} channels, rate=${this.rate}, samples=${this.samples}, polar=${this.polar}, scale=${this.radius}/${this.range}`
    );
    for (let i = 0; i < this.channels.length; i++) {
      this.logMessage(
        `  Channel ${i}: name='${this.channels[i].name}', color=0x${this.channels[i].color
          .toString(16)
          .padStart(6, '0')}`
      );
    }
  }

  private parseString(str: string): string {
    // Remove quotes
    if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
      return str.slice(1, -1);
    }
    return str;
  }

  private isKeyword(str: string): boolean {
    const keywords = [
      'TITLE',
      'POS',
      'SIZE',
      'RANGE',
      'SAMPLES',
      'RATE',
      'DOTSIZE',
      'TEXTSIZE',
      'COLOR',
      'POLAR',
      'LOGSCALE',
      'HIDEXY',
      'CLEAR',
      'SAVE',
      'CLOSE',
      'PC_KEY',
      'PC_MOUSE',
      'ALT',
      'SIGNED',
      'LONGS_1BIT',
      'LONGS_2BIT',
      'LONGS_4BIT',
      'LONGS_8BIT',
      'LONGS_16BIT',
      'WORDS_1BIT',
      'WORDS_2BIT',
      'WORDS_4BIT',
      'WORDS_8BIT',
      'BYTES_1BIT',
      'BYTES_2BIT',
      'BYTES_4BIT'
    ];
    return keywords.includes(str.toUpperCase());
  }

  private getPackedDataMode(modeStr: string): PackedDataMode | null {
    const modeMap: { [key: string]: PackedDataMode } = {
      LONGS_1BIT: {
        mode: ePackedDataMode.PDM_LONGS_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: false,
        isSigned: false
      },
      LONGS_2BIT: {
        mode: ePackedDataMode.PDM_LONGS_2BIT,
        bitsPerSample: 2,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: false,
        isSigned: false
      },
      LONGS_4BIT: {
        mode: ePackedDataMode.PDM_LONGS_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: false,
        isSigned: false
      },
      LONGS_8BIT: {
        mode: ePackedDataMode.PDM_LONGS_8BIT,
        bitsPerSample: 8,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: false,
        isSigned: false
      },
      LONGS_16BIT: {
        mode: ePackedDataMode.PDM_LONGS_16BIT,
        bitsPerSample: 16,
        valueSize: ePackedDataWidth.PDW_LONGS,
        isAlternate: false,
        isSigned: false
      },
      WORDS_1BIT: {
        mode: ePackedDataMode.PDM_WORDS_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_WORDS,
        isAlternate: false,
        isSigned: false
      },
      WORDS_2BIT: {
        mode: ePackedDataMode.PDM_WORDS_2BIT,
        bitsPerSample: 2,
        valueSize: ePackedDataWidth.PDW_WORDS,
        isAlternate: false,
        isSigned: false
      },
      WORDS_4BIT: {
        mode: ePackedDataMode.PDM_WORDS_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_WORDS,
        isAlternate: false,
        isSigned: false
      },
      WORDS_8BIT: {
        mode: ePackedDataMode.PDM_WORDS_8BIT,
        bitsPerSample: 8,
        valueSize: ePackedDataWidth.PDW_WORDS,
        isAlternate: false,
        isSigned: false
      },
      BYTES_1BIT: {
        mode: ePackedDataMode.PDM_BYTES_1BIT,
        bitsPerSample: 1,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: false,
        isSigned: false
      },
      BYTES_2BIT: {
        mode: ePackedDataMode.PDM_BYTES_2BIT,
        bitsPerSample: 2,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: false,
        isSigned: false
      },
      BYTES_4BIT: {
        mode: ePackedDataMode.PDM_BYTES_4BIT,
        bitsPerSample: 4,
        valueSize: ePackedDataWidth.PDW_BYTES,
        isAlternate: false,
        isSigned: false
      }
    };
    return modeMap[modeStr] || null;
  }

  protected async handleData(elements: string[]): Promise<void> {
    this.logMessage(`handleData: Processing ${elements.length} elements`);

    // FIRST: Let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE)
    // Strip display name/window name (first element) before passing to base class
    const commandParts = elements.length > 0 ? elements.slice(1) : [];
    if (await this.handleCommonCommand(commandParts)) {
      // Base class handled the command, we're done
      return;
    }

    // SCOPE_XY-specific data processing
    for (const element of elements) {
      // Process numerical data
      const value = parseInt(element);
      if (!isNaN(value)) {
        // Unpack if using packed data mode
        const unpacked = this.packedDataMode ? PackedDataProcessor.unpackSamples(value, this.packedDataMode) : [value];

        for (const v of unpacked) {
          this.dataBuffer.push(v);
        }
      }
    }

    // Process complete samples from the buffer
    // IMPORTANT: Only process if we have channels defined
    if (this.channelIndex === 0) {
      this.logMessage(`WARNING: No channels defined (channelIndex=0), cannot process data`);
      return;
    }

    const samplesNeeded = this.channelIndex * 2; // X,Y for each channel
    this.logMessage(
      `handleData: buffer has ${this.dataBuffer.length} values, need ${samplesNeeded} per sample (${this.channelIndex} channels)`
    );

    // Collect all samples first to avoid multiple renders per message
    const collectedSamples: number[][] = [];
    while (this.dataBuffer.length >= samplesNeeded) {
      // Extract data for all channels
      const channelData = this.dataBuffer.splice(0, samplesNeeded);
      collectedSamples.push(channelData);
      this.persistenceManager.addSample(channelData);

      // Increment rate counter for each sample (matching Pascal behavior)
      this.rateCounter++;
    }

    if (collectedSamples.length > 0) {
      this.logMessage(
        `Collected ${collectedSamples.length} samples (each with ${samplesNeeded} values), rateCounter=${this.rateCounter}/${this.rate}`
      );

      // Render once if we've hit the rate threshold
      if (this.rateCounter >= this.rate) {
        this.logMessage(`Triggering render with ${collectedSamples.length} new samples`);
        this.render();
        this.rateCounter = 0; // Reset to 0 (matching Pascal RateCycle)
      }
    } else if (this.dataBuffer.length > 0) {
      this.logMessage(`Incomplete sample in buffer: ${this.dataBuffer.length} values (need ${samplesNeeded})`);
    }
  }

  // Track if we need to redraw the static background (grid + legends)
  private backgroundDrawn: boolean = false;

  private render(forceClear: boolean = false): void {
    if (!this.debugWindow || this.debugWindow.isDestroyed() || !this.renderer) {
      this.logMessage(
        `render: Skipping - window:${!!this
          .debugWindow}, destroyed:${this.debugWindow?.isDestroyed()}, renderer:${!!this.renderer}`
      );
      return;
    }

    // Render throttle: If a render is already in progress, mark as pending and return
    if (this.renderInProgress) {
      this.renderPending = true;
      this.logMessage('render: Render already in progress, marking as pending');
      return;
    }

    // Mark render as in progress
    this.renderInProgress = true;
    this.renderPending = false;

    // Canvas size includes margins on all sides
    const canvasSize = this.radius * 2 + this.margin * 2;

    this.logMessage(
      `render: Starting batched render, canvas='${this.scopeXyCanvasId}', size=${canvasSize} (radius=${this.radius}, margin=${this.margin}), forceClear=${forceClear}`
    );

    // Get samples with opacity
    const samples = this.persistenceManager.getSamplesWithOpacity();
    const totalInBuffer = this.persistenceManager.getSampleCount();
    this.logMessage(
      `render: Got ${samples.length} samples to plot (${totalInBuffer} total in buffer, persistence=${this.samples})`
    );

    // Debug: Check opacity values for first and last samples
    if (samples.length > 0) {
      this.logMessage(
        `  First sample opacity: ${samples[0].opacity}, Last sample opacity: ${samples[samples.length - 1].opacity}`
      );
    }

    // Build optimized drawing commands grouped by color and opacity
    interface DotGroup {
      color: string;
      opacity: number;
      points: Array<{ x: number; y: number }>;
    }

    const dotGroups = new Map<string, DotGroup>();
    let plotCount = 0;

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
          screenCoords = this.renderer.transformCartesian(x, y, this.scale, this.logScale, this.range);
        }

        // Convert to screen coordinates (center at margin + radius, margin + radius)
        const gridCenterX = this.margin + this.radius;
        const gridCenterY = this.margin + this.radius;
        const screenX = gridCenterX + screenCoords.x;
        const screenY = gridCenterY - screenCoords.y; // Y is inverted

        // Get channel color
        const color = this.channels[ch]?.color || this.defaultColors[ch % 8];
        const colorStr = '#' + color.toString(16).padStart(6, '0');

        // Debug first few points per channel
        if (plotCount < 9) {
          // Show first 3 points for each of 3 channels
          this.logMessage(
            `  Plot ${plotCount}: ch=${ch}/'${
              this.channels[ch]?.name
            }', raw=(${x},${y}), transformed=(${screenCoords.x.toFixed(1)},${screenCoords.y.toFixed(
              1
            )}), screen=(${screenX.toFixed(1)},${screenY.toFixed(1)}), color=${colorStr}`
          );
        }

        // Group dots by color and opacity to minimize state changes
        const groupKey = `${colorStr}_${sample.opacity}`;
        if (!dotGroups.has(groupKey)) {
          dotGroups.set(groupKey, {
            color: colorStr,
            opacity: sample.opacity,
            points: []
          });
        }
        dotGroups.get(groupKey)!.points.push({ x: screenX, y: screenY });
        plotCount++;
      }
    }

    // Build optimized plot commands - one save/restore per group
    // Sort groups by opacity (oldest/faintest first) for consistent layering
    const sortedGroups = Array.from(dotGroups.values()).sort((a, b) => a.opacity - b.opacity);

    const plotCommands: string[] = [];
    for (const group of sortedGroups) {
      plotCommands.push(`
        ctx.save();
        ctx.globalAlpha = ${group.opacity / 255};
        ctx.fillStyle = '${group.color}';
        ${group.points
          .map(
            (p) => `
          ctx.beginPath();
          ctx.arc(${p.x}, ${p.y}, ${this.dotSize / 4}, 0, Math.PI * 2);
          ctx.fill();
        `
          )
          .join('')}
        ctx.restore();
      `);
    }

    // Grid center coordinates
    const gridCenterX = this.margin + this.radius;
    const gridCenterY = this.margin + this.radius;

    // Generate all rendering scripts (but don't execute yet)
    const bgColorStr = `#${this.backgroundColor.toString(16).padStart(6, '0')}`;
    const gridColorStr = `#${(0x808080).toString(16).padStart(6, '0')}`; // Medium gray grid for better visibility

    // Generate range indicator text
    // Pascal: TextOut(vBitmapWidth div 2 + ChrWidth * 2, ChrHeight div 2, s)
    const rangeText = this.logScale ? `r=${this.range} logscale` : `r=${this.range}`;
    const charWidth = this.textSize * 0.6; // Approximate character width
    const charHeight = this.textSize;
    const rangeX = canvasSize / 2 + charWidth * 2; // Center + 2 char widths
    const rangeY = charHeight / 2; // Half char height from top

    // Generate legend commands
    // Pascal positioning logic:
    // if (i and 2) = 0 then x := ChrWidth else x := vBitmapWidth - ChrWidth - TextWidth(label)
    // if i < 4 then y := ChrWidth else y := vBitmapHeight - ChrWidth - ChrHeight * 2
    // if (i and 1) <> 0 then y := y + ChrHeight
    const labelMargin = this.margin; // Computed outside template string
    const legendCommands: string[] = [];
    if (!this.hideXY && this.channels.length > 0) {
      for (let i = 0; i < this.channels.length && i < 8; i++) {
        if (!this.channels[i].name) continue;

        const colorStr = `#${this.channels[i].color.toString(16).padStart(6, '0')}`;
        const name = this.channels[i].name;

        let x: number;
        let y: number;

        // Horizontal position (Pascal logic)
        if ((i & 2) === 0) {
          // Even channel pairs (0,1 and 4,5): left side
          x = charWidth;
        } else {
          // Odd channel pairs (2,3 and 6,7): right side, right-aligned
          // Note: We'll use textAlign='right' for these
          x = canvasSize - charWidth;
        }

        // Vertical position (Pascal logic)
        // Pascal: y := ChrWidth (for top labels)
        // Position label well above dots for clearance
        // Dots start at margin pixels, text is charHeight tall
        // Position at small offset from edge to ensure clearance
        if (i < 4) {
          // Top area - position near top edge with clearance to dots
          y = charWidth / 2; // ~3 pixels from top for 10pt font
        } else {
          // Bottom area
          y = canvasSize - labelMargin + charWidth / 2;
        }

        // Add offset for odd-numbered channels (second line)
        if ((i & 1) !== 0) {
          y += charHeight;
        }

        // Set text alignment based on position
        const textAlign = (i & 2) === 0 ? 'left' : 'right';

        legendCommands.push(`
          // Channel ${i}: ${name}
          ctx.fillStyle = '${colorStr}';
          ctx.font = 'bold italic ${this.textSize}px monospace';
          ctx.textAlign = '${textAlign}';
          ctx.textBaseline = 'top';
          ctx.fillText('${name}', ${x}, ${y});
        `);
      }
    }

    // CRITICAL FIX: Batch ALL rendering operations into a single JavaScript execution
    // This eliminates flashing by ensuring atomic rendering (matches Pascal BitmapToCanvas approach)
    const batchedScript = `(() => {
      const canvas = document.getElementById('${this.scopeXyCanvasId}');
      if (!canvas) return 'No canvas';
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'No context';

      // 1. Clear canvas
      ctx.save();
      ctx.fillStyle = '${bgColorStr}';
      ctx.fillRect(0, 0, ${canvasSize}, ${canvasSize});
      ctx.restore();

      // 2. Draw grid (Pascal-style: outer circle + crosshair)
      // Pascal uses full opacity (255) for graticule
      ctx.save();
      ctx.strokeStyle = '${gridColorStr}';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1.0;

      // Draw outer perimeter circle (Pascal SmoothShape equivalent)
      ctx.beginPath();
      ctx.arc(${gridCenterX}, ${gridCenterY}, ${this.radius}, 0, Math.PI * 2);
      ctx.stroke();

      // Draw center crosshair (vertical and horizontal centerlines)
      // Vertical line (full canvas height)
      ctx.beginPath();
      ctx.moveTo(${gridCenterX}, 0);
      ctx.lineTo(${gridCenterX}, ${canvasSize});
      ctx.stroke();

      // Horizontal line (full canvas width)
      ctx.beginPath();
      ctx.moveTo(0, ${gridCenterY});
      ctx.lineTo(${canvasSize}, ${gridCenterY});
      ctx.stroke();

      ctx.restore();

      // 3. Draw range indicator
      ctx.save();
      ctx.fillStyle = '#808080';
      ctx.font = '${this.textSize}px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('${rangeText}', ${rangeX}, ${rangeY});
      ctx.restore();

      // 4. Draw legends
      ctx.save();
      ${legendCommands.join('\n')}
      ctx.restore();

      // 5. Plot points
      ${plotCommands.join('\n')}

      return 'Rendered ${plotCount} points (batched)';
    })()`;

    this.logMessage(`render: Executing batched script (${batchedScript.length} chars, ${plotCount} points)`);

    // Execute the entire rendering operation atomically with await to prevent listener accumulation
    this.debugWindow.webContents
      .executeJavaScript(batchedScript)
      .then((result) => {
        this.logMessage(`render: Batched render complete: ${result}`);
      })
      .catch((err) => {
        console.error('Batched render error:', err);
        console.error('Render error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name,
          cause: err.cause,
          code: err.code,
          fullError: JSON.stringify(err, Object.getOwnPropertyNames(err))
        });
      })
      .finally(() => {
        // Mark render as complete
        this.renderInProgress = false;

        // If another render was requested while this one was in progress, execute it now
        if (this.renderPending) {
          this.logMessage('render: Executing pending render');
          this.render(forceClear);
        }
      });
  }
}
