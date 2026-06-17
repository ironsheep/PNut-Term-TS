import { DebugWindowBase } from './debugWindowBase';
import { Context } from '../utils/context';
import { BrowserWindow } from 'electron';
import { CanvasRenderer } from './shared/canvasRenderer';
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
  // Pascal vGridColor default = DefaultGridColor = clGray = 0x404040. Held here so a
  // COLOR-directive grid override survives until the renderer exists (parseConfiguration
  // runs in createDebugWindow BEFORE initializeRenderer, when this.renderer is still null
  // — the old `this.renderer.setGridColor()` at parse time silently dropped the override).
  private gridColor: number = 0x404040;

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

  // Pascal DefaultScopeColors = (clLime, clRed, clCyan, clYellow, clMagenta,
  // clBlue, clOrange, clOlive) — DebugDisplayUnit.pas:241 with the clXxx values at
  // :179-186. clBlue/clOrange/clOlive were previously wrong (0x0000ff / 0xffa500 /
  // 0x808000 — pure blue / CSS-orange / VCL-olive). [9win §4]
  private readonly defaultColors = [
    0x00ff00, // clLime    $00FF00
    0xff0000, // clRed     $FF0000
    0x00ffff, // clCyan    $00FFFF
    0xffff00, // clYellow  $FFFF00
    0xff00ff, // clMagenta $FF00FF
    0x7f7fff, // clBlue    $7F7FFF (light blue, NOT pure blue)
    0xff7f00, // clOrange  $FF7F00 (NOT CSS 0xFFA500)
    0x7f7f00 // clOlive   $7F7F00 (NOT 0x808000)
  ];

  constructor(ctx: Context, displaySpec: ScopeXyDisplaySpec, windowId?: string) {
    // Use the user-provided display name as the window ID (the unique routing key), matching
    // TERM/LOGIC. The old `scopexy-${Date.now()}` default collided when two same-type windows were
    // created in the same millisecond → "Window … is already registered". [windowid-datenow-collision]
    const actualWindowId = windowId || displaySpec.displayName;
    super(ctx, actualWindowId, 'scopexy');
    this.windowLogPrefix = 'CL-scopeXy';

    this.displaySpec = displaySpec;

    // Initialize shared components
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
              // This console.log IS the wire that feeds the 'console-message' listener above,
              // which transforms the pixel coords and updates the on-screen readout. It must
              // always fire — the old if(ENABLE_CONSOLE_LOG) guard referenced a TS-only constant
              // that doesn't exist in the renderer, so the readout never updated. [9win §10]
              console.log('MOUSE:' + Math.floor(x) + ',' + Math.floor(y));
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
    // The flex-centered canvas can leave a thin margin if the client area ends up a hair taller
    // than the square canvas (macOS useContentSize rounding). Paint the body with the SAME
    // background as the canvas so any residual margin is invisible (white field for COLOR WHITE)
    // instead of a black letterbox top/bottom. [scope_xy letterbox]
    const bodyBg = `#${((this.backgroundColor >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
    this.windowContent = `
      <html>
        <head>
          <meta charset="UTF-8"></meta>
          <title>${this.windowTitle}</title>
          <style>
            body { margin: 0; padding: 0; background: ${bodyBg}; overflow: hidden; display: flex; justify-content: center; align-items: center; }
            canvas { display: block; image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; width: ${canvasSize}px; height: ${canvasSize}px; }
          </style>
        </head>
        <body>
          <canvas id="${this.scopeXyCanvasId}" width="${canvasSize}" height="${canvasSize}"></canvas>
          <script>
            // DEVICE-RESOLUTION (DPR-aware) canvas. Pascal plots SmoothDot at 8-bit-fractional
            // (sub-pixel) coords on a native-resolution bitmap, so the curve is both SMOOTH and
            // CRISP. A logical-resolution canvas displayed on a 2x Retina screen gets its small
            // AA dots up-scaled by the compositor -> soft/fuzzy. Fix: size the backing store to
            // canvasSize*dpr, keep the CSS box at canvasSize px, and pre-scale the context by dpr.
            // All draw code stays in LOGICAL coords; the transform persists across every later
            // getContext('2d') call (same context object) because we never reassign canvas.width
            // afterward. On a 1x display dpr=1, so this is a no-op there. [scope_xy DPR crisp]
            (function () {
              var c = document.getElementById('${this.scopeXyCanvasId}');
              if (!c) return;
              var dpr = window.devicePixelRatio || 1;
              var size = ${canvasSize};
              c.width = Math.round(size * dpr);
              c.height = Math.round(size * dpr);
              c.style.width = size + 'px';
              c.style.height = size + 'px';
              var ctx = c.getContext('2d');
              if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            })();
          </script>
        </body>
      </html>
    `;

    // Calculate window dimensions
    // SCOPE_XY uses a SQUARE canvas. Size by CLIENT area + useContentSize:true on the
    // BrowserWindow (Electron adds OS chrome outside) so the web content is EXACTLY the
    // square canvas. The old outer-size estimate (canvasSize + hardcoded 40px title bar,
    // no useContentSize) left the content ~12px taller than the canvas on macOS — the
    // flex-centered canvas then got a black letterbox top/bottom and the plain display-area
    // SAVE captured a non-square, letterboxed image. Matches the TERM/FFT windows.
    const windowWidth = canvasSize;
    const windowHeight = canvasSize;

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
      useContentSize: true, // width/height are the CLIENT area (= square canvas); Electron adds OS chrome
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
        sandbox: false,
        // Keep the renderer painting + rAF firing while this window is occluded/unfocused so a
        // scripted multi-window SAVE captures a fresh frame and the capture flush never stalls.
        backgroundThrottling: false
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
    // Apply any COLOR-directive grid override captured during parseConfiguration.
    this.renderer.setGridColor(this.gridColor);
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
    // AWAIT the async processing so updateContent (and thus the base's per-message routerDispatchChain
    // serialization) only resolves once this message's draw has been ISSUED — a following SAVE then
    // reliably sees this message's render on the chain. [#49]
    await this.processMessageAsync(lineParts);
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
        // Pascal key_size: `if NextNum then vWidth := Within(val*2, scope_xy_wmin=32,
        // scope_xy_wmax=2048) else Continue`, radius = vWidth/2 (DebugDisplayUnit.pas:1404).
        // The *diameter* is clamped, making valid radius input 16..1024 — e.g. SIZE 1025 ->
        // 1024, SIZE 10 -> 16. Spin2NumericParser so $hex/%bin/underscores parse; consume the
        // value token only when it IS a number (else leave it for the outer loop). [9win §10]
        const sizeTok = lineParts[i + 1];
        const sizeVal = sizeTok !== undefined ? Spin2NumericParser.parseInteger(sizeTok, true) : null;
        if (sizeVal !== null) {
          this.radius = Math.max(32, Math.min(2048, sizeVal * 2)) / 2;
          i++; // consume the value token (the i++ below consumes SIZE)
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
        // Numeric directives: parse via clampInt (handles $hex/%bin/underscores that
        // raw parseInt dropped to NaN) and clamp to the Pascal KeyValWithin bounds.
        // Consume the value token only when it parses as a number; the switch-bottom
        // i++ consumes the keyword. Never abort the window on a bad param. [C2/C4]
        case 'RANGE': {
          // Pascal KeyValWithin(vRange, 1, $7FFFFFFF) (DebugDisplayUnit.pas:1408).
          const v = DisplaySpecParser.clampInt(lineParts, i + 1, 1, 0x7fffffff);
          if (v !== null) {
            this.range = v;
            i++;
          }
          break;
        }

        case 'RATE': {
          // Pascal KeyValWithin(vRate, 1, XY_Sets=2048) (:1412) — XY_Sets is 2048, not 512. [9win §3]
          const v = DisplaySpecParser.clampInt(lineParts, i + 1, 1, 2048);
          if (v !== null) {
            this.rate = v;
            i++;
          }
          break;
        }

        case 'DOTSIZE': {
          // Pascal KeyValWithin(vDotSize, 2, 20) (:1414).
          const v = DisplaySpecParser.clampInt(lineParts, i + 1, 2, 20);
          if (v !== null) {
            this.dotSize = v;
            i++;
          }
          break;
        }

        case 'TEXTSIZE': {
          // Pascal KeyTextSize -> KeyValWithin(vTextSize, 6, 200) (:2836).
          const v = DisplaySpecParser.clampInt(lineParts, i + 1, 6, 200);
          if (v !== null) {
            this.textSize = v;
            i++;
          }
          break;
        }

        case 'COLOR': {
          // Pascal: `if KeyColor(vBackColor) then KeyColor(vGridColor)` (:1417). Route both
          // colors through the shared parseKeyColor so directive NAMES (RED, BLUE 8) work —
          // the old colorTranslator path was numeric-only (lost named colors) and mis-parsed
          // $hex literals to black. parseKeyColor returns a '#rrggbb' string; convert to the
          // numeric form these fields/renderer use. A non-color token (quoted label, next
          // directive) ends the parse with the default kept (Pascal KeyColor -> False). [C5]
          const bg = DisplaySpecParser.parseKeyColor(lineParts, i + 1);
          if (bg !== null) {
            this.backgroundColor = parseInt(bg.rgb.slice(1), 16);
            const grid = DisplaySpecParser.parseKeyColor(lineParts, bg.nextIdx);
            if (grid !== null) {
              this.gridColor = parseInt(grid.rgb.slice(1), 16);
              i = grid.nextIdx - 1; // the switch-bottom i++ lands on the first unconsumed token
            } else {
              i = bg.nextIdx - 1;
            }
          }
          break;
        }

        case 'POLAR': {
          // Pascal KeyTwoPi (DebugDisplayUnit.pas:2736): unconditionally vPolar:=True,
          // vTwoPi:=$100000000, vTheta:=0; then if NextNum: -1 reverses the wrap
          // (-$100000000), 0 restores the default, any other value is literal, and an
          // optional following number sets vTheta (KeyVal, no clamp). Spin2NumericParser so
          // $hex/%bin/signed parse; each number is consumed only when present. [9win §10]
          this.polar = true;
          this.twopi = 0x100000000;
          this.theta = 0;
          const twopiTok = lineParts[i + 1];
          const twopiVal = twopiTok !== undefined ? Spin2NumericParser.parseInteger(twopiTok, true) : null;
          if (twopiVal !== null) {
            i++;
            if (twopiVal === -1) {
              this.twopi = -0x100000000;
            } else if (twopiVal === 0) {
              this.twopi = 0x100000000;
            } else {
              this.twopi = twopiVal;
            }
            const thetaTok = lineParts[i + 1];
            const thetaVal = thetaTok !== undefined ? Spin2NumericParser.parseInteger(thetaTok, true) : null;
            if (thetaVal !== null) {
              this.theta = thetaVal;
              i++;
            }
          }
          break;
        }

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

            // Optional channel color — Pascal KeyColor(vColor[vIndex-1]) (:1433). Route
            // through the shared parseKeyColor so directive NAMES (and name+brightness)
            // resolve here too, not just numeric literals; a non-color token (next label,
            // a directive keyword) leaves the per-channel default in place. [C5]
            const parsedColor = DisplaySpecParser.parseKeyColor(lineParts, i + 1);
            if (parsedColor !== null) {
              color = parseInt(parsedColor.rgb.slice(1), 16);
              i = parsedColor.nextIdx - 1; // switch-bottom i++ lands on first unconsumed token
              this.logMessage(`    Custom color -> 0x${color.toString(16).padStart(6, '0')}`);
            }

            // Pascal SCOPE_XY_Configure (DebugDisplayUnit.pas:1431): `if vIndex <> Channels
            // then Inc(vIndex)` — vIndex saturates at Channels(=8). A 9th+ label does NOT add
            // a channel; it overwrites the last slot's label/color. [9win §10]
            if (this.channels.length < 8) {
              this.channels.push({ name: channelName, color });
              this.channelIndex++;
              this.logMessage(
                `  Added channel ${this.channelIndex - 1}: '${channelName}' with color 0x${color.toString(16)}`
              );
            } else {
              this.channels[7] = { name: channelName, color };
              this.logMessage(`  Channel cap (8) reached — overwrote slot 7: '${channelName}'`);
            }
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

    // FIRST: Let base class handle common commands (CLEAR, CLOSE, UPDATE, SAVE, PC_KEY, PC_MOUSE).
    // The window name is ALREADY stripped by the router before updateContent(), so
    // commandParts[0] is the command itself (e.g. 'save', 'close'). The previous
    // elements.slice(1) stripped it a SECOND time, so 'close' became [] and
    // 'save x' became ['x'] — every common command was silently dropped (no SAVE
    // file written, window never closed). Pass elements through as-is, like the
    // SCOPE/PLOT/etc. windows do. Numeric data still falls through to the data
    // loop below (a coordinate never matches a command keyword).
    const commandParts = elements;
    if (await this.handleCommonCommand(commandParts)) {
      // Base class handled the command, we're done
      return;
    }

    // SCOPE_XY-specific data processing
    for (const element of elements) {
      // Runtime numeric feeds `(a, b, c) arrive with commas as standalone separator
      // tokens (tokenizeCommand emits ','). Guard with isNumeric() before parsing so a
      // comma is silently skipped instead of reaching parseInteger() and logging
      // "Unknown numeric format - value: ','". Matches BITMAP/MIDI/SPECTRO. [9win §14]
      if (!Spin2NumericParser.isNumeric(element)) {
        continue;
      }
      // Process numerical data — Spin2NumericParser (signed) so $hex/%bin/underscored
      // sample values parse, matching Pascal NextNum/NewPack. [C2 runtime]
      const value = Spin2NumericParser.parseInteger(element, true);
      if (value !== null) {
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

    // Pascal draws each point with SmoothDot at 8-bit-FRACTIONAL (sub-pixel) coordinates — that
    // sub-pixel placement is what makes the connected curve SMOOTH. 0.9.53 rounded every dot to
    // the nearest integer pixel to crisp them up, which snapped points to the pixel grid and made
    // the curve visibly JAGGED/stair-stepped vs Windows. Restore SUB-PIXEL positions (curve smooth
    // again); keep small filled SQUARES of Pascal's radius (vDotSize/4). NOTE: at the canvas's
    // LOGICAL resolution a sub-pixel square is slightly AA-soft; rendering the canvas at DEVICE
    // resolution (DPR-aware) would make these both smooth AND crisp — see WINDOW_PARITY doc FIX D.
    // [scope_xy sub-pixel curve]
    const dotR = this.dotSize / 4; // sub-pixel radius (DOTSIZE 4 -> 1px), matches Pascal vDotSize/4
    const dotD = dotR * 2;
    const plotCommands: string[] = [];
    for (const group of sortedGroups) {
      plotCommands.push(`
        ctx.save();
        ctx.globalAlpha = ${group.opacity / 255};
        ctx.fillStyle = '${group.color}';
        ${group.points
          .map(
            (p) => `ctx.fillRect(${(p.x - dotR).toFixed(3)}, ${(p.y - dotR).toFixed(3)}, ${dotD.toFixed(3)}, ${dotD.toFixed(3)});`
          )
          .join('\n        ')}
        ctx.restore();
      `);
    }

    // Grid center coordinates
    const gridCenterX = this.margin + this.radius;
    const gridCenterY = this.margin + this.radius;

    // Generate all rendering scripts (but don't execute yet)
    const bgColorStr = `#${this.backgroundColor.toString(16).padStart(6, '0')}`;
    // Pascal graticule is drawn in vGridColor (default 0x404040, overridable via the COLOR
    // directive). Use the renderer's grid color as the source of truth rather than a
    // hardcoded gray. [9win §10]
    const gridColorStr = `#${this.renderer.getGridColor().toString(16).padStart(6, '0')}`;

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

      // 3. Draw range indicator (Pascal draws this text in vGridColor, DebugDisplayUnit.pas:3395)
      ctx.save();
      ctx.fillStyle = '${gridColorStr}';
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

    // Execute the entire rendering operation atomically. Record the draw promise on the inherited
    // renderChain (single-shot → trackRender) so a SAVE awaits the in-flight render before capturing
    // (base flushBeforeCapture); issuance stays eager so streaming is unthrottled. [#49]
    const renderPromise = this.debugWindow.webContents.executeJavaScript(batchedScript);
    this.trackRender(renderPromise);
    renderPromise
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
