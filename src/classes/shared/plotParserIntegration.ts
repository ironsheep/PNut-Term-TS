/** @format */

const ENABLE_CONSOLE_LOG: boolean = true;

/**
 * Integration Design for PLOT Parser with Existing Systems
 * Defines how new parser connects to canvas rendering, state management, and window controls
 */

import { CommandResult, CanvasOperation } from './plotCommandInterfaces';

// 2D transformation matrix for sprite transformations
export interface TransformationMatrix {
  a: number;   // horizontal scaling / rotation
  b: number;   // horizontal skewing
  c: number;   // vertical skewing
  d: number;   // vertical scaling / rotation
  tx: number;  // horizontal translation
  ty: number;  // vertical translation
}

// Bitmap data structure for layer storage
export interface BitmapData {
  width: number;
  height: number;
  pixels: number[];    // RGB pixel values
  bitsPerPixel: number;
}

// Integration with existing DebugPlotWindow state
export interface PlotWindowState {
  cursorPosition: { x: number; y: number };
  origin: { x: number; y: number };
  canvasOffset: { x: number; y: number };
  lineSize: number;
  opacity: number;
  currentFgColor: string;
  currentTextColor: string;
  textAngle: number;
  coordinateMode: 'CARTESIAN' | 'POLAR';
  polarConfig: { twopi: number; offset: number };
  cartesianConfig: { ydir: boolean; xdir: boolean };
  precise: number; // 0=standard, 8=high precision (256ths of pixel)
  updateMode: boolean; // buffered vs live drawing
  shouldWriteToCanvas: boolean;

  // Enhanced rendering control state
  colorMode?: number; // 0=RGB, 1=HSV, 2=indexed, 3=grayscale
  defaultTextSize?: number; // 1-100 multiplier
  defaultTextStyle?: number; // 0-7 bitfield
}

// Canvas operations that integrate with existing rendering system
export enum CanvasOperationType {
  // Drawing operations
  DRAW_DOT = 'DRAW_DOT',
  DRAW_LINE = 'DRAW_LINE',
  DRAW_CIRCLE = 'DRAW_CIRCLE',
  DRAW_BOX = 'DRAW_BOX',
  DRAW_OVAL = 'DRAW_OVAL',
  DRAW_TEXT = 'DRAW_TEXT',
  DRAW_SPRITE = 'DRAW_SPRITE',
  DEFINE_SPRITE = 'DEFINE_SPRITE',

  // State changes
  SET_CURSOR = 'SET_CURSOR',
  SET_ORIGIN = 'SET_ORIGIN',
  SET_COLOR = 'SET_COLOR',
  SET_LINESIZE = 'SET_LINESIZE',
  SET_OPACITY = 'SET_OPACITY',
  SET_TEXTANGLE = 'SET_TEXTANGLE',
  SET_COORDINATE_MODE = 'SET_COORDINATE_MODE',

  // Enhanced rendering control
  SET_COLOR_MODE = 'SET_COLOR_MODE',
  SET_TEXTSIZE = 'SET_TEXTSIZE',
  SET_TEXTSTYLE = 'SET_TEXTSTYLE',
  SET_PRECISION = 'SET_PRECISION',

  // Interactive input
  PC_INPUT = 'PC_INPUT',

  // Window operations
  CONFIGURE_WINDOW = 'CONFIGURE_WINDOW',
  CLEAR_CANVAS = 'CLEAR_CANVAS',
  UPDATE_DISPLAY = 'UPDATE_DISPLAY',

  // Layer operations
  LOAD_LAYER = 'LOAD_LAYER',
  CROP_LAYER = 'CROP_LAYER',

  // LUT/Palette operations
  LUT_SET = 'LUT_SET',
  LUT_COLORS = 'LUT_COLORS',

  // Input operations
  ENABLE_KEYBOARD = 'ENABLE_KEYBOARD',
  ENABLE_MOUSE = 'ENABLE_MOUSE'
}

// Enhanced canvas operation with state integration
export interface PlotCanvasOperation {
  type: CanvasOperationType;
  parameters: Record<string, any>;
  affectsState: boolean; // Does this operation change parser state?
  requiresUpdate: boolean; // Does this operation need display update?
  deferrable: boolean; // Can this be deferred until UPDATE command?
}

// Integration adapter for existing DebugPlotWindow
export class PlotWindowIntegrator {
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private plotWindow: any; // DebugPlotWindow instance
  private state: PlotWindowState;
  // Track the last operation type to determine color application
  private lastOperationType: string | null = null;
  private lastSetColor: string | null = null;

  constructor(plotWindow: any) {
    this.plotWindow = plotWindow;
    this.state = this.extractCurrentState();
  }

  /**
   * Extract current state from existing DebugPlotWindow
   */
  private extractCurrentState(): PlotWindowState {
    return {
      cursorPosition: { ...this.plotWindow.cursorPosition },
      origin: { ...this.plotWindow.origin },
      canvasOffset: { ...this.plotWindow.canvasOffset },
      lineSize: this.plotWindow.lineSize,
      opacity: this.plotWindow.opacity,
      currentFgColor: this.plotWindow.currFgColor,
      currentTextColor: this.plotWindow.currTextColor,
      textAngle: this.plotWindow.textAngle,
      coordinateMode: this.plotWindow.coordinateMode === 1 ? 'POLAR' : 'CARTESIAN',
      polarConfig: { ...this.plotWindow.polarConfig },
      cartesianConfig: { ...this.plotWindow.cartesianConfig },
      precise: this.plotWindow.precise,
      updateMode: this.plotWindow.updateMode,
      shouldWriteToCanvas: this.plotWindow.shouldWriteToCanvas,

      // Enhanced rendering control state - default values
      colorMode: 0, // Default RGB mode
      defaultTextSize: 10, // Default text size
      defaultTextStyle: 0 // Default no style
    };
  }

  /**
   * Convert PlotCanvasOperation back to CanvasOperation for result compatibility
   */
  private convertToCanvasOperation(plotOp: PlotCanvasOperation): CanvasOperation {
    let baseType: CanvasOperation['type'];

    switch (plotOp.type) {
      case CanvasOperationType.DRAW_DOT:
        baseType = 'DRAW_DOT';
        break;
      case CanvasOperationType.DRAW_LINE:
        baseType = 'DRAW_LINE';
        break;
      case CanvasOperationType.DRAW_CIRCLE:
        baseType = 'DRAW_CIRCLE';
        break;
      case CanvasOperationType.DRAW_BOX:
        baseType = 'DRAW_BOX';
        break;
      case CanvasOperationType.DRAW_OVAL:
        baseType = 'DRAW_OVAL';
        break;
      case CanvasOperationType.DRAW_TEXT:
        baseType = 'DRAW_TEXT';
        break;
      case CanvasOperationType.DRAW_SPRITE:
        baseType = 'DRAW_SPRITE' as any;
        break;
      case CanvasOperationType.DEFINE_SPRITE:
        baseType = 'DEFINE_SPRITE' as any;
        break;
      case CanvasOperationType.LOAD_LAYER:
        baseType = 'LOAD_LAYER' as any;
        break;
      case CanvasOperationType.CROP_LAYER:
        baseType = 'CROP_LAYER' as any;
        break;
      case CanvasOperationType.SET_CURSOR:
        baseType = 'SET_CURSOR';
        break;
      case CanvasOperationType.CLEAR_CANVAS:
        baseType = 'CLEAR';
        break;
      case CanvasOperationType.UPDATE_DISPLAY:
        baseType = 'UPDATE';
        break;
      case CanvasOperationType.CONFIGURE_WINDOW:
        // CONFIGURE_WINDOW needs special handling - don't convert to SET_CURSOR
        baseType = 'CONFIGURE_WINDOW' as any; // Cast to bypass type checking since base doesn't have this
        break;
      case CanvasOperationType.PC_INPUT:
        baseType = 'PC_INPUT' as any;
        break;
      default:
        // For operations that don't map to base types, use SET_CURSOR
        baseType = 'SET_CURSOR';
        break;
    }

    return {
      type: baseType,
      parameters: plotOp.parameters
    };
  }

  /**
   * Execute canvas operation synchronously (for immediate commands like LUT)
   * Returns void since synchronous operations can't properly return CommandResult
   */
  executeOperationSync(operation: PlotCanvasOperation): void {
    try {
      switch (operation.type) {
        case CanvasOperationType.LUT_SET:
          this.executeLutSet(operation.parameters);
          break;
        case CanvasOperationType.LUT_COLORS:
          this.executeLutColors(operation.parameters);
          break;
        default:
          // For non-LUT operations, log a warning
          console.warn('[INTEGRATOR] Sync execution requested for async operation:', operation.type);
          break;
      }
    } catch (error) {
      console.error('[INTEGRATOR] Error in sync operation:', error);
    }
  }

  /**
   * Execute canvas operation using existing rendering infrastructure
   */
  async executeOperation(operation: PlotCanvasOperation): Promise<CommandResult> {
    // Performance timing - start
    const perfStart = performance.now();

    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: [this.convertToCanvasOperation(operation)]
    };

    // Debug logging to trace color operations
    if (operation.parameters?.color) {
      this.logConsoleMessage(`[INTEGRATOR] Processing operation with color: type=${operation.type}, params=`, operation.parameters);
    }

    try {
      switch (operation.type) {
        case CanvasOperationType.DRAW_DOT:
          await this.executeDraw('DOT', operation.parameters);
          break;

        case CanvasOperationType.DRAW_LINE:
          await this.executeDraw('LINE', operation.parameters);
          break;

        case CanvasOperationType.DRAW_CIRCLE:
          await this.executeDraw('CIRCLE', operation.parameters);
          break;

        case CanvasOperationType.DRAW_BOX:
          await this.executeDraw('BOX', operation.parameters);
          break;

        case CanvasOperationType.DRAW_OVAL:
          await this.executeDraw('OVAL', operation.parameters);
          break;

        case CanvasOperationType.DRAW_TEXT:
          await this.executeDrawText(operation.parameters);
          break;

        case CanvasOperationType.SET_CURSOR:
          this.executeSetCursor(operation.parameters);
          break;

        case CanvasOperationType.SET_COLOR:
          this.logConsoleMessage('[INTEGRATOR] Executing SET_COLOR with params:', operation.parameters);
          this.executeSetColor(operation.parameters);
          break;

        case CanvasOperationType.CONFIGURE_WINDOW:
          this.executeConfigureWindow(operation.parameters);
          break;

        case CanvasOperationType.CLEAR_CANVAS:
          await this.executeClearCanvas();
          break;

        case CanvasOperationType.UPDATE_DISPLAY:
          this.executeUpdateDisplay();
          break;

        case CanvasOperationType.SET_ORIGIN:
          this.executeSetOrigin(operation.parameters);
          break;

        case CanvasOperationType.SET_COORDINATE_MODE:
          this.executeSetCoordinateMode(operation.parameters);
          break;

        case CanvasOperationType.SET_COLOR_MODE:
          this.executeSetColorMode(operation.parameters);
          break;

        case CanvasOperationType.SET_TEXTSIZE:
          this.executeSetTextSize(operation.parameters);
          break;

        case CanvasOperationType.SET_TEXTSTYLE:
          this.executeSetTextStyle(operation.parameters);
          break;

        case CanvasOperationType.SET_PRECISION:
          this.executeSetPrecision(operation.parameters);
          break;

        case CanvasOperationType.SET_LINESIZE:
          // Apply linesize directly here as well to ensure it's set
          if (operation.parameters.size !== undefined) {
            // LineSize from device is in fixed-point format (256ths)
            // Like coordinates, we need to divide by 256 to get pixels
            const pixelLineSize = Math.max(1, Math.round(operation.parameters.size / 256.0));
            this.logConsoleMessage('[INTEGRATOR] SET_LINESIZE direct: converting', operation.parameters.size, '/ 256 =', pixelLineSize, 'pixels');
            this.state.lineSize = pixelLineSize;
            this.plotWindow.lineSize = pixelLineSize;
          }
          break;

        case CanvasOperationType.SET_OPACITY:
          // State update handled in updateInternalState
          break;

        case CanvasOperationType.SET_TEXTANGLE:
          // State update handled in updateInternalState
          break;

        case 'SET_CARTESIAN' as any:
          this.executeSetCartesian(operation.parameters);
          break;

        case CanvasOperationType.PC_INPUT:
          await this.executePcInput(operation.parameters);
          break;

        case CanvasOperationType.DEFINE_SPRITE:
          this.executeDefineSprite(operation.parameters);
          break;

        case CanvasOperationType.DRAW_SPRITE:
          this.executeDrawSprite(operation.parameters);
          break;

        case CanvasOperationType.LOAD_LAYER:
          await this.executeLoadLayer(operation.parameters);
          break;

        case CanvasOperationType.CROP_LAYER:
          await this.executeCropLayer(operation.parameters);
          break;

        case CanvasOperationType.LUT_SET:
          this.executeLutSet(operation.parameters);
          break;

        case CanvasOperationType.LUT_COLORS:
          this.executeLutColors(operation.parameters);
          break;

        default:
          // Log what's happening with operations that fall through
          this.logConsoleMessage('[INTEGRATOR] Operation fell through to default:', operation.type, operation.parameters);
          result.success = false;
          result.errors.push(`Unsupported operation type: ${operation.type}`);
      }

      // Update internal state if operation affects state
      this.logConsoleMessage(`[INTEGRATOR] Checking affectsState for ${operation.type}: affectsState=${operation.affectsState}`);
      if (operation.affectsState) {
        this.logConsoleMessage(`[INTEGRATOR] Calling updateInternalState for ${operation.type}`);
        this.updateInternalState(operation);
      } else {
        this.logConsoleMessage(`[INTEGRATOR] Skipping updateInternalState for ${operation.type} (affectsState=false/undefined)`);
      }

      // Trigger display update if required and not in buffered mode
      if (operation.requiresUpdate && !this.state.updateMode) {
        this.plotWindow.performUpdate?.();
      }

      // Track the last operation type for color handling
      this.lastOperationType = operation.type;

    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to execute operation: ${error}`);
    }

    // Performance timing - end and log
    const perfDuration = performance.now() - perfStart;
    console.log(`[OP TIMING] ${operation.type}: ${perfDuration.toFixed(2)}ms`,
                operation.parameters ? `params: ${JSON.stringify(operation.parameters).substring(0, 100)}` : '');

    return result;
  }

  /**
   * Execute drawing operation directly on canvas
   */
  private async executeDraw(command: string, params: Record<string, any>): Promise<void> {
    // Coordinates from device are ALWAYS in fixed-point format (multiplied by 256)
    // We always need to divide by 256 to get pixel coordinates
    // The precise setting affects Pascal's INTERNAL smooth rendering, not our coordinate interpretation
    const precisionMultiplier = 1.0 / 256.0;

    switch (command) {
      case 'DOT':
        // DOT is drawn as a small filled circle
        // Do NOT apply precision multiplier to dot size - it's already in pixels
        const dotSize = this.plotWindow.displaySpec?.dotSize || 1;
        await this.plotWindow.drawCircleToPlot(dotSize, 0, params.opacity ?? this.state.opacity);
        break;

      case 'LINE':
        // Apply precision multiplier to convert fixed-point coordinates to pixels
        // Coordinates from device are always in fixed-point format (multiplied by 256)
        // e.g., 40960 / 256 = 160 pixels, 57600 / 256 = 225 pixels
        // Round to integer pixels (no decimals needed for canvas operations)
        const lineX = Math.round((params.x ?? 0) * precisionMultiplier);
        const lineY = Math.round((params.y ?? 0) * precisionMultiplier);
        const lineSize = params.lineSize ?? this.state.lineSize;  // Use state lineSize as default
        const opacity = params.opacity ?? this.state.opacity;

        console.log(`[INTEGRATOR] LINE: raw=(${params.x},${params.y}) converted=(${lineX},${lineY}) lineSize=${lineSize}, opacity=${opacity}`);

        await this.plotWindow.drawLineToPlot(
          lineX,
          lineY,
          lineSize,
          opacity
        );
        break;

      case 'CIRCLE':
        // Do NOT apply precision multiplier to diameter - it's already in pixels
        // Precision multiplier is only for coordinate positions, not sizes
        const diameter = params.diameter || 10;
        const circleLineSize = params.lineSize !== undefined ? params.lineSize : 0; // Default to 0 (filled)

        this.logConsoleMessage('[INTEGRATOR] Drawing CIRCLE with params:', {
          diameter: diameter,
          lineSize: circleLineSize,
          opacity: params.opacity ?? this.state.opacity,
          originalDiameter: params.diameter || 10,
          originalLineSize: params.lineSize,
          precisionMultiplier: precisionMultiplier
        });

        await this.plotWindow.drawCircleToPlot(
          diameter,
          circleLineSize,
          params.opacity ?? this.state.opacity
        );
        break;

      case 'BOX':
      case 'OVAL':
        // TODO: Implement box and oval drawing with precision support
        this.logConsoleMessage(`[INTEGRATOR] ${command} not yet implemented with params:`, params);
        break;

      default:
        this.logConsoleMessage(`[INTEGRATOR] Unknown draw command: ${command}`);
    }
  }

  /**
   * Execute text drawing with font setup
   */
  private async executeDrawText(params: Record<string, any>): Promise<void> {
    // Only apply pending color if the last operation was SET_COLOR
    // This matches Pascal behavior: color immediately before TEXT sets text color
    if (this.lastOperationType === CanvasOperationType.SET_COLOR && this.lastSetColor) {
      this.logConsoleMessage('[INTEGRATOR] Applying color to text (color was previous op):', this.lastSetColor);
      this.plotWindow.currTextColor = this.lastSetColor;
      this.state.currentTextColor = this.lastSetColor;
    }
    // Clear the pending color after checking (whether used or not)
    this.lastSetColor = null;

    // Set font parameters directly
    const size = params.size || 10;
    const style = params.style || '00000001';
    const angle = params.angle || 0;

    // Convert style string to number
    let styleNum = 0;
    if (style.startsWith('%')) {
      styleNum = parseInt(style.substring(1), 2); // binary
    } else {
      styleNum = parseInt(style, 10); // decimal
    }

    // Set font metrics
    this.plotWindow.setFontMetrics(size, styleNum, angle, this.plotWindow.font, this.plotWindow.textStyle);

    // Draw the text
    if (params.text) {
      await this.plotWindow.writeStringToPlot(params.text);
    }
  }

  /**
   * Execute cursor position change
   */
  private executeSetCursor(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetCursor called with:', params);
    this.logConsoleMessage('[INTEGRATOR] Current state:', {
      coordinateMode: this.state.coordinateMode,
      precise: this.state.precise,
      origin: this.plotWindow.origin,
      polarConfig: this.plotWindow.polarConfig
    });

    if (params.x !== undefined && params.y !== undefined) {
      // Pascal stores RAW fixed-point values in vPixelX/vPixelY
      // Conversion to screen coordinates happens only when drawing (in LINE, DOT, etc.)
      // So we store the raw values here, just like Pascal does
      let x = params.x;
      let y = params.y;

      this.logConsoleMessage(`[INTEGRATOR] SET: storing raw values x=${x}, y=${y}`);

      // Check if we're in polar mode
      if (this.state.coordinateMode === 'POLAR') {
        // In polar mode, SET coordinates are polar (radius, angle)
        // First parameter (x) is radius, second parameter (y) is angle
        // Precision multiplier already applied above
        const radius = x;
        const angle = y;

        this.logConsoleMessage(`[INTEGRATOR] Polar mode - radius=${radius}, angle=${angle}`);

        // Convert polar to cartesian - this gives us logical coordinates
        [x, y] = this.plotWindow.polarToCartesian(radius, angle);

        this.logConsoleMessage(`[INTEGRATOR] After polarToCartesian: x=${x}, y=${y}`);
      } else {
        // In cartesian mode, SET uses coordinates directly (already converted from fixed-point)
        this.logConsoleMessage(`[INTEGRATOR] Cartesian mode - x=${x}, y=${y}`);
      }

      // Set cursor position directly to the logical coordinates
      // DO NOT use getXY() here - SET stores absolute logical coordinates
      // getXY() is only used when drawing to convert logical to screen coordinates
      this.plotWindow.cursorPosition.x = x;
      this.plotWindow.cursorPosition.y = y;
      this.state.cursorPosition = { x, y };

      this.logConsoleMessage('[INTEGRATOR] Final cursor position:', this.plotWindow.cursorPosition);

      // Also log what the screen coordinates would be
      const screenCoords = this.plotWindow.getCursorXY();
      this.logConsoleMessage('[INTEGRATOR] Screen coordinates would be:', screenCoords);
    }
  }

  private polarToCartesian(radius: number, angle: number): [number, number] {
    // Convert polar to cartesian using the configured polar settings
    const polarConfig = this.plotWindow.polarConfig;
    const Tf = ((angle + polarConfig.offset) / polarConfig.twopi) * Math.PI * 2;
    const sin = Math.sin(Tf);
    const cos = Math.cos(Tf);
    const x = Math.round(cos * radius);
    const y = Math.round(sin * radius);
    return [x, y];
  }

  /**
   * Execute color change
   */
  private executeSetColor(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetColor called with:', params);
    if (params.color) {
      // Convert color name with brightness to hex value
      const colorHex = this.colorNameToHex(params.color, params.brightness);
      this.logConsoleMessage(`[INTEGRATOR] Setting color to ${colorHex}`);

      // Set shape/drawing color
      this.plotWindow.currFgColor = colorHex;
      this.state.currentFgColor = colorHex;

      // Save this color for potential text use
      this.lastSetColor = colorHex;
    }
  }

  private colorNameToHex(colorName: string, brightness?: number): string {
    // Import DebugColor for Pascal-accurate RGBI8X color conversion
    const { DebugColor } = require('./debugColor');

    // Default brightness is 8 (mid-range) to match Pascal defaults
    const bright = brightness !== undefined ? brightness : 8;

    // Use Pascal's RGBI8X color mode for accurate brightness handling
    return DebugColor.colorNameToRGB24UsingRGBI8X(colorName, bright);
  }

  /**
   * Execute window configuration changes
   */
  private executeConfigureWindow(params: Record<string, any>): void {
    try {
      const action = params.action;

      switch (action) {
        case 'CLOSE':
          // Close the window using the proper method - matches other window implementations
          this.plotWindow.closeDebugWindow();
          break;

        case 'SAVE':
          // Save window to bitmap file using the same method as other debug windows
          if (params.filename) {
            this.plotWindow.saveWindowToBMPFilename(params.filename);
          } else {
            console.error('[PLOT] SAVE action missing filename parameter');
          }
          break;

        case 'TITLE':
          if (params.title && this.plotWindow.debugWindow) {
            this.plotWindow.debugWindow.setTitle(params.title);
            this.logConsoleMessage(`[PLOT] Window title set to: "${params.title}"`);
          }
          break;

        case 'POS':
          if (this.plotWindow.debugWindow && params.x !== undefined && params.y !== undefined) {
            this.plotWindow.debugWindow.setPosition(params.x, params.y);
            this.logConsoleMessage(`[PLOT] Window position set to: ${params.x}, ${params.y}`);
          }
          break;

        case 'SIZE':
          if (this.plotWindow.debugWindow && params.width !== undefined && params.height !== undefined) {
            // Set window content size, not outer window size
            this.plotWindow.debugWindow.setContentSize(params.width, params.height);
            this.logConsoleMessage(`[PLOT] Window size set to: ${params.width}x${params.height}`);
          }
          break;

        case 'DOTSIZE':
          if (params.dotSize !== undefined) {
            // Ensure displaySpec exists
            if (!this.plotWindow.displaySpec) {
              this.plotWindow.displaySpec = {};
            }
            this.plotWindow.displaySpec.dotSize = params.dotSize;
            this.logConsoleMessage(`[PLOT] Dot size set to: ${params.dotSize}`);
          }
          break;

        case 'BACKCOLOR':
          if (params.color !== undefined) {
            // Ensure displaySpec and window exist
            if (!this.plotWindow.displaySpec) {
              this.plotWindow.displaySpec = {};
            }
            if (!this.plotWindow.displaySpec.window) {
              this.plotWindow.displaySpec.window = {};
            }

            // Handle color conversion based on format
            let backgroundColor = params.color;
            if (params.brightness !== undefined && typeof params.color === 'string') {
              // Convert named color with brightness to hex
              backgroundColor = this.convertColorWithBrightness(params.color, params.brightness);
            }

            this.plotWindow.displaySpec.window.background = backgroundColor;
            this.logConsoleMessage(`[PLOT] Background color set to: ${backgroundColor} (brightness: ${params.brightness || 15})`);
          }
          break;

        case 'HIDEXY':
          if (params.hideXY !== undefined) {
            // Ensure displaySpec exists
            if (!this.plotWindow.displaySpec) {
              this.plotWindow.displaySpec = {};
            }
            this.plotWindow.displaySpec.hideXY = params.hideXY;
            this.logConsoleMessage(`[PLOT] Coordinate display ${params.hideXY ? 'hidden' : 'shown'}`);
          }
          break;

        case 'UPDATE':
          if (params.updateRate !== undefined) {
            // Set update rate for display refresh
            const updateInterval = 1000 / params.updateRate; // Convert Hz to milliseconds
            this.state.updateMode = params.updateRate > 0;

            // If plot window has an update interval method, use it
            if (this.plotWindow.setUpdateInterval) {
              this.plotWindow.setUpdateInterval(updateInterval);
            }
            this.logConsoleMessage(`[PLOT] Update rate set to: ${params.updateRate} Hz (${updateInterval.toFixed(1)}ms interval)`);
          }
          break;

        default:
          // Handle legacy parameter formats for backward compatibility
          if (params.title && this.plotWindow.debugWindow) {
            this.plotWindow.debugWindow.setTitle(params.title);
          }
          if (params.position && this.plotWindow.debugWindow) {
            this.plotWindow.debugWindow.setPosition(params.position.x, params.position.y);
          }
          if (params.size && this.plotWindow.debugWindow) {
            this.plotWindow.debugWindow.setSize(params.size.width, params.size.height);
          }
          if (params.dotSize) {
            this.plotWindow.displaySpec.dotSize = params.dotSize;
          }
          if (params.backgroundColor) {
            this.plotWindow.displaySpec.window.background = params.backgroundColor;
          }
          if (params.hideXY !== undefined) {
            this.plotWindow.displaySpec.hideXY = params.hideXY;
          }
          if (params.updateRate) {
            this.state.updateMode = params.updateRate > 0;
          }
          console.warn(`[PLOT] Unknown CONFIGURE action: ${action || 'none'}, using legacy format`);
      }

    } catch (error) {
      console.error(`[PLOT] Error executing CONFIGURE command:`, error);
    }
  }

  /**
   * Convert named color with brightness to hex color using Pascal's RGBI8X mode
   */
  private convertColorWithBrightness(colorName: string, brightness: number): string {
    // Import DebugColor for Pascal-accurate RGBI8X color conversion
    const { DebugColor } = require('./debugColor');

    // Use Pascal's RGBI8X color mode for accurate brightness handling
    return DebugColor.colorNameToRGB24UsingRGBI8X(colorName, brightness);
  }

  /**
   * Execute canvas clear
   */
  private async executeClearCanvas(): Promise<void> {
    await this.plotWindow.clearPlot();
  }

  /**
   * Execute display update (buffer flip)
   */
  private executeUpdateDisplay(): void {
    this.plotWindow.performUpdate?.();
  }

  /**
   * Execute origin position change
   */
  private executeSetOrigin(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetOrigin called with:', params);
    if (params.x !== undefined && params.y !== undefined) {
      // Update plot window's origin directly
      this.plotWindow.origin = { x: params.x, y: params.y };
      this.state.origin = { x: params.x, y: params.y };
      this.logConsoleMessage('[INTEGRATOR] Origin set to:', this.plotWindow.origin);
    }
  }

  /**
   * Execute coordinate mode change (Cartesian/Polar)
   */
  private executeSetCoordinateMode(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetCoordinateMode called with:', params);
    if (params.mode === 'POLAR' && params.polarConfig) {
      // Set polar configuration AND switch to polar mode
      this.plotWindow.polarConfig = params.polarConfig;
      this.state.polarConfig = params.polarConfig;
      // Switch to polar coordinate mode
      this.plotWindow.coordinateMode = 1; // eCoordModes.CM_POLAR
      this.state.coordinateMode = 'POLAR';
      this.logConsoleMessage('[INTEGRATOR] Switched to POLAR mode with config:', params.polarConfig);
    } else if (params.mode === 'CARTESIAN') {
      // Explicitly switch to Cartesian mode
      this.plotWindow.coordinateMode = 2; // eCoordModes.CM_CARTESIAN
      this.state.coordinateMode = 'CARTESIAN';
      this.logConsoleMessage('[INTEGRATOR] Switched to Cartesian mode');
    }
  }

  private executeSetColorMode(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetColorMode called with:', params);
    if (params.mode !== undefined) {
      // Store color mode in plot window if it has such a property
      if (this.plotWindow.colorMode !== undefined) {
        this.plotWindow.colorMode = params.mode;
      }
      this.state.colorMode = params.mode;

      const modeNames = ['RGB', 'HSV', 'INDEXED', 'GRAYSCALE'];
      this.logConsoleMessage(`[INTEGRATOR] Color mode set to: ${params.mode} (${modeNames[params.mode] || 'UNKNOWN'})`);
    }
  }

  private executeSetTextSize(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetTextSize called with:', params);
    if (params.textSize !== undefined) {
      // Store default text size for future TEXT commands
      if (this.plotWindow.defaultTextSize !== undefined) {
        this.plotWindow.defaultTextSize = params.textSize;
      }
      this.state.defaultTextSize = params.textSize;

      this.logConsoleMessage(`[INTEGRATOR] Default text size set to: ${params.textSize}`);
    }
  }

  private executeSetTextStyle(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetTextStyle called with:', params);
    if (params.textStyle !== undefined) {
      // Store default text style for future TEXT commands
      if (this.plotWindow.defaultTextStyle !== undefined) {
        this.plotWindow.defaultTextStyle = params.textStyle;
      }
      this.state.defaultTextStyle = params.textStyle;

      const styleFlags = [];
      if (params.bold) styleFlags.push('bold');
      if (params.italic) styleFlags.push('italic');
      if (params.underline) styleFlags.push('underline');
      const styleDescription = styleFlags.length > 0 ? styleFlags.join('+') : 'normal';

      this.logConsoleMessage(`[INTEGRATOR] Default text style set to: ${params.textStyle} (${styleDescription})`);
    }
  }

  private executeSetPrecision(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetPrecision called with:', params);

    // Implement Pascal's PRECISE behavior: vPrecise := vPrecise xor 8
    // Toggle between 0 (standard) and 8 (high precision)
    const currentPrecise = this.plotWindow.precise || 0;
    const newPrecise = currentPrecise ^ 8;  // XOR with 8

    // Update plot window state
    this.plotWindow.precise = newPrecise;
    this.state.precise = newPrecise;

    const precisionMode = newPrecise === 8 ? 'high precision (256ths of pixel)' : 'standard pixel coordinates';
    this.logConsoleMessage(`[INTEGRATOR] Precision toggled: ${currentPrecise} -> ${newPrecise} (${precisionMode})`);
  }

  private executeSetCartesian(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeSetCartesian called with:', params);

    const { xdir, ydir } = params;

    // Update plot window's Cartesian configuration
    // Only update values that are provided (not undefined)
    // This matches Pascal behavior: CARTESIAN {flipy {flipx}}
    if (xdir !== undefined) {
      this.plotWindow.cartesianConfig.xdir = xdir === true || xdir === 1;
    }
    if (ydir !== undefined) {
      this.plotWindow.cartesianConfig.ydir = ydir === true || ydir === 1;
    }

    this.logConsoleMessage(`[INTEGRATOR] Cartesian config set: xdir=${this.plotWindow.cartesianConfig.xdir}, ydir=${this.plotWindow.cartesianConfig.ydir}`);
  }

  private async executePcInput(params: Record<string, any>): Promise<void> {
    this.logConsoleMessage('[INTEGRATOR] executePcInput called with:', params);

    const inputType = params.inputType;

    if (inputType === 'KEY') {
      // Handle PC_KEY - get last pressed key and send back to P2
      const keyCode = await this.getLastPressedKey();
      this.logConsoleMessage(`[INTEGRATOR] PC_KEY returning: ${keyCode}`);

      // Send response back to P2 via debug protocol
      this.sendInputResponseToP2('KEY', keyCode);

    } else if (inputType === 'MOUSE') {
      // Handle PC_MOUSE - get current mouse state and encode as 32-bit value
      const mouseState = await this.getCurrentMouseState();
      this.logConsoleMessage(`[INTEGRATOR] PC_MOUSE returning: 0x${mouseState.toString(16).padStart(8, '0')}`);

      // Send response back to P2 via debug protocol
      this.sendInputResponseToP2('MOUSE', mouseState);

    } else {
      console.error(`[INTEGRATOR] Unknown PC_INPUT type: ${inputType}`);
    }
  }

  private async getLastPressedKey(): Promise<number> {
    // Get the last pressed key from the renderer's window object
    // Returns 0 if no key available (non-blocking behavior)
    try {
      const keyCode = await this.plotWindow.debugWindow?.webContents.executeJavaScript(`
        (function() {
          const key = window.lastPressedKey || 0;
          // Clear the key for one-shot behavior
          window.lastPressedKey = 0;
          return key;
        })()
      `);

      this.logConsoleMessage(`[INTEGRATOR] Retrieved key from renderer: ${keyCode || 0}`);
      return keyCode || 0;
    } catch (error) {
      console.error(`[INTEGRATOR] Failed to get key from renderer:`, error);
      return 0; // No key available
    }
  }

  private async getCurrentMouseState(): Promise<number> {
    // Get current mouse state from the renderer's window object
    // Returns 32-bit encoded value: X/Y position (bits 0-23), buttons (bits 24-26), over-canvas (bit 31)
    try {
      const mouseState = await this.plotWindow.debugWindow?.webContents.executeJavaScript(`
        (function() {
          return window.currentMouseState || 0;
        })()
      `);

      this.logConsoleMessage(`[INTEGRATOR] Retrieved mouse state from renderer: 0x${(mouseState || 0).toString(16).padStart(8, '0')}`);
      return mouseState || 0;
    } catch (error) {
      console.error(`[INTEGRATOR] Failed to get mouse state from renderer:`, error);
      return 0; // No mouse state available
    }
  }

  private sendInputResponseToP2(inputType: string, value: number): void {
    // Send the input response back to P2 via the debug protocol
    // This needs to integrate with the existing debugger protocol system
    this.logConsoleMessage(`[INTEGRATOR] Sending ${inputType} response to P2: ${value}`);

    if (this.plotWindow.sendDebugResponse) {
      this.plotWindow.sendDebugResponse(inputType, value);
    } else {
      console.warn(`[INTEGRATOR] No debug response method available for ${inputType}`);
    }
  }

  /**
   * Execute sprite definition - store sprite in sprite manager
   */
  private executeDefineSprite(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeDefineSprite called with:', params);

    try {
      if (!this.plotWindow.spriteManager) {
        this.logError('[PLOT ERROR] Sprite manager not available in plot window - internal system error');
        throw new Error('Sprite manager not available in plot window');
      }

      const { spriteId, width, height, pixels, colors } = params;

      // Validate required parameters with enhanced error messages
      if (spriteId === undefined || width === undefined || height === undefined) {
        this.logError('[PLOT ERROR] Missing required sprite parameters: spriteId, width, height for SPRITEDEF command');
        throw new Error('Missing required sprite parameters: spriteId, width, height');
      }

      if (!Array.isArray(pixels) || pixels.length !== width * height) {
        this.logError(`[PLOT ERROR] Invalid pixel data for SPRITEDEF ${spriteId}: expected ${width * height} pixels, got ${pixels ? pixels.length : 0}`);
        throw new Error(`Invalid pixel data: expected ${width * height} pixels, got ${pixels ? pixels.length : 0}`);
      }

      if (!Array.isArray(colors) || colors.length !== 256) {
        this.logError(`[PLOT ERROR] Invalid color palette for SPRITEDEF ${spriteId}: expected 256 colors, got ${colors ? colors.length : 0}`);
        throw new Error(`Invalid color palette: expected 256 colors, got ${colors ? colors.length : 0}`);
      }

      // Validate sprite dimensions are within Pascal bounds (1-32 x 1-32)
      if (width < 1 || width > 32 || height < 1 || height > 32) {
        this.logError(`[PLOT ERROR] Sprite dimensions ${width}x${height} out of bounds for SPRITEDEF ${spriteId} (valid range: 1-32 x 1-32)`);
        throw new Error(`Sprite dimensions ${width}x${height} out of bounds (1-32 x 1-32)`);
      }

      // Validate sprite ID is within Pascal bounds (0-255)
      if (spriteId < 0 || spriteId > 255) {
        this.logError(`[PLOT ERROR] Sprite ID ${spriteId} out of bounds (valid range: 0-255)`);
        throw new Error(`Sprite ID ${spriteId} out of bounds (0-255)`);
      }

      // Validate pixel indices are within palette range (0-255) with memory-safe checking
      for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] < 0 || pixels[i] > 255) {
          this.logError(`[PLOT ERROR] Pixel index ${pixels[i]} at position ${i} out of bounds for SPRITEDEF ${spriteId} (valid range: 0-255)`);
          throw new Error(`Pixel index ${pixels[i]} at position ${i} out of bounds (0-255)`);
        }
      }

      // Validate color values are 32-bit ARGB (0x00000000-0xFFFFFFFF) with memory-safe checking
      for (let i = 0; i < colors.length; i++) {
        if (colors[i] < 0 || colors[i] > 0xFFFFFFFF) {
          this.logError(`[PLOT ERROR] Color value 0x${colors[i].toString(16)} at position ${i} out of bounds for SPRITEDEF ${spriteId} (valid range: 0x00000000-0xFFFFFFFF)`);
          throw new Error(`Color value 0x${colors[i].toString(16)} at position ${i} out of bounds (0x00000000-0xFFFFFFFF)`);
        }
      }

      // Check memory availability before large sprite allocation
      const estimatedMemory = (pixels.length * 4) + (colors.length * 4); // Rough estimate in bytes
      if (estimatedMemory > 50 * 1024 * 1024) { // 50MB threshold
        this.logError(`[PLOT ERROR] SPRITEDEF ${spriteId} memory allocation too large: ${Math.round(estimatedMemory / 1024 / 1024)}MB (max 50MB)`);
        throw new Error(`Sprite memory allocation too large: ${Math.round(estimatedMemory / 1024 / 1024)}MB`);
      }

      // Define the sprite using the sprite manager with Pascal-compatible data
      // Wrap in try-catch for memory allocation failures with cleanup
      try {
        this.plotWindow.spriteManager.defineSprite(spriteId, width, height, pixels, colors);
      } catch (memError) {
        // Clean up any partial allocations
        this.cleanupFailedSpriteOperation(spriteId);
        this.logError(`[PLOT ERROR] Memory allocation failed for SPRITEDEF ${spriteId}: ${memError}`);
        throw new Error(`Memory allocation failed for sprite definition: ${memError}`);
      }

      this.logConsoleMessage(`[INTEGRATOR] Sprite ${spriteId} defined: ${width}x${height} pixels, ${pixels.length} pixel indices, ${colors.length} palette colors`);

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to define sprite:`, error);
      // Ensure error is logged to debug logger
      this.logError(`[PLOT ERROR] SPRITEDEF command failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute sprite drawing - render sprite at current position with transformations
   */
  private async executeDrawSprite(params: Record<string, any>): Promise<void> {
    this.logConsoleMessage('[INTEGRATOR] executeDrawSprite called with:', params);

    try {
      if (!this.plotWindow.spriteManager) {
        throw new Error('Sprite manager not available in plot window');
      }

      if (!this.plotWindow.debugWindow || !this.plotWindow.shouldWriteToCanvas) {
        this.logConsoleMessage('[INTEGRATOR] Window not ready for sprite rendering');
        return;
      }

      const { spriteId, orientation = 0, scale = 1.0, opacity = 255 } = params;

      // Validate parameters
      if (spriteId === undefined) {
        throw new Error('Missing required sprite ID');
      }

      // Get the sprite definition
      const sprite = this.plotWindow.spriteManager.getSprite(spriteId);
      if (!sprite) {
        throw new Error(`Sprite ${spriteId} not defined`);
      }

      // Get current plot position
      const currentX = this.plotWindow.cursorPosition?.x || 0;
      const currentY = this.plotWindow.cursorPosition?.y || 0;

      // Get screen coordinates for sprite position
      const [screenX, screenY] = this.plotWindow.getXY(currentX, currentY);

      // Convert sprite data to JSON-safe format for passing to renderer
      const spriteData = {
        width: sprite.width,
        height: sprite.height,
        pixels: sprite.pixels,
        colors: sprite.colors
      };

      this.logConsoleMessage(`[INTEGRATOR] Drawing sprite ${spriteId} at (${screenX}, ${screenY}) with orientation=${orientation}°, scale=${scale}, opacity=${opacity}`);

      // Execute sprite rendering in the renderer
      const jsCode = `
        (function() {
          if (!window.plotCtx) {
            console.error('[PLOT] Context not ready for sprite rendering');
            return 'Context not ready';
          }

          const sprite = ${JSON.stringify(spriteData)};
          const centerX = ${screenX};
          const centerY = ${screenY};
          const orientation = ${orientation};
          const scale = ${scale};
          const opacity = ${opacity};

          // Save current context state
          window.plotCtx.save();

          // Set global alpha for opacity
          window.plotCtx.globalAlpha = opacity / 255;

          // Calculate transformation matrix
          const angleRad = (orientation * Math.PI) / 180;
          const cos = Math.cos(angleRad) * scale;
          const sin = Math.sin(angleRad) * scale;

          // Apply transformation matrix for rotation and scaling
          window.plotCtx.setTransform(
            cos,      // m11: horizontal scaling / rotation
            sin,      // m12: horizontal skewing
            -sin,     // m21: vertical skewing
            cos,      // m22: vertical scaling / rotation
            centerX,  // dx: horizontal translation
            centerY   // dy: vertical translation
          );

          // Calculate sprite center offset for proper rotation around center
          const centerOffsetX = -sprite.width / 2;
          const centerOffsetY = -sprite.height / 2;

          // Render each pixel
          for (let y = 0; y < sprite.height; y++) {
            for (let x = 0; x < sprite.width; x++) {
              const pixelIndex = y * sprite.width + x;
              const colorIndex = sprite.pixels[pixelIndex];

              // Skip transparent pixels (color index 0 is typically transparent)
              if (colorIndex === 0) continue;

              // Get color from palette
              const color = sprite.colors[colorIndex] || 0x000000;
              const r = (color >> 16) & 0xFF;
              const g = (color >> 8) & 0xFF;
              const b = color & 0xFF;

              // Set pixel color
              window.plotCtx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';

              // Draw pixel at transformed position (relative to sprite center)
              window.plotCtx.fillRect(
                centerOffsetX + x,
                centerOffsetY + y,
                1, 1
              );
            }
          }

          // Restore context state
          window.plotCtx.restore();

          return 'Sprite drawn';
        })()
      `;

      try {
        const result = await this.plotWindow.debugWindow.webContents.executeJavaScript(jsCode);
        this.logConsoleMessage(`[INTEGRATOR] Sprite render result: ${result}`);
      } catch (error) {
        console.error('[INTEGRATOR] Failed to execute sprite rendering:', error);
        throw error;
      }

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to draw sprite:`, error);
      throw error;
    }
  }

  /**
   * Transform plot coordinates to screen coordinates accounting for coordinate system settings
   */
  private transformToScreenCoordinates(plotX: number, plotY: number): { x: number; y: number } {
    // Apply origin offset
    let screenX = plotX + (this.state.origin?.x || 0);
    let screenY = plotY + (this.state.origin?.y || 0);

    // Apply canvas offset
    screenX += this.state.canvasOffset?.x || 0;
    screenY += this.state.canvasOffset?.y || 0;

    // Apply coordinate system transformations (CARTESIAN vs POLAR handled elsewhere)
    // Apply axis direction changes if needed
    if (this.state.cartesianConfig?.xdir === false) {
      screenX = -screenX;
    }
    if (this.state.cartesianConfig?.ydir === true) {
      screenY = -screenY;
    }

    return { x: screenX, y: screenY };
  }

  /**
   * Execute layer loading - load bitmap file into layer manager
   */
  private async executeLoadLayer(params: Record<string, any>): Promise<void> {
    this.logConsoleMessage('[INTEGRATOR] executeLoadLayer called with:', params);

    try {
      if (!this.plotWindow.layerManager) {
        this.logError('[PLOT ERROR] Layer manager not available in plot window - internal system error');
        throw new Error('Layer manager not available in plot window');
      }

      const { layerIndex, filename } = params;

      // Validate parameters with enhanced error messages
      if (layerIndex === undefined || filename === undefined) {
        this.logError('[PLOT ERROR] Missing required parameters: layerIndex and filename for LAYER command');
        throw new Error('Missing required parameters: layerIndex and filename');
      }

      // Convert Pascal layer index (1-16) to internal index (0-15)
      const internalLayerIndex = layerIndex - 1;
      if (internalLayerIndex < 0 || internalLayerIndex > 15) {
        this.logError(`[PLOT ERROR] Layer index ${layerIndex} out of bounds for LAYER command (valid range: 1-16)`);
        throw new Error(`Layer index ${layerIndex} out of bounds (1-16)`);
      }

      // Validate filename before attempting to load
      if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
        this.logError(`[PLOT ERROR] Invalid filename for LAYER ${layerIndex}: filename must be a non-empty string`);
        throw new Error('Invalid filename: must be a non-empty string');
      }

      // Check memory usage before loading large files
      try {
        // Load and parse BMP file from filesystem with enhanced error handling
        const bitmapData = await this.loadBitmapFile(filename);

        // Check memory constraints for large bitmaps
        const estimatedMemory = bitmapData.width * bitmapData.height * 4; // RGBA bytes
        if (estimatedMemory > 100 * 1024 * 1024) { // 100MB threshold
          this.logError(`[PLOT ERROR] LAYER ${layerIndex} bitmap "${filename}" too large: ${Math.round(estimatedMemory / 1024 / 1024)}MB (max 100MB)`);
          throw new Error(`Bitmap file too large: ${Math.round(estimatedMemory / 1024 / 1024)}MB (max 100MB)`);
        }

        // Store bitmap data in layer manager with memory allocation protection
        try {
          if (this.plotWindow.layerManager.loadLayer) {
            await this.plotWindow.layerManager.loadLayer(internalLayerIndex, filename);
          } else {
            // Fallback: create a simple layer storage implementation
            console.error(`[LAYER LIFECYCLE] ⚠️ FALLBACK PATH EXECUTING! loadLayer method not found!`);
            console.error(`[LAYER LIFECYCLE] layerManager type: ${typeof this.plotWindow.layerManager}`);
            console.error(`[LAYER LIFECYCLE] loadLayer exists: ${!!this.plotWindow.layerManager.loadLayer}`);
            console.error(`[LAYER LIFECYCLE] Stack trace:`, new Error().stack);

            if (!this.plotWindow.layerManager.layers) {
              console.error(`[LAYER LIFECYCLE] 🚨 RECREATING LAYERS ARRAY - ALL LAYERS WILL BE LOST!`);
              this.plotWindow.layerManager.layers = new Array(16);
            }
            this.plotWindow.layerManager.layers[internalLayerIndex] = {
              filename: filename,
              data: bitmapData,
              width: bitmapData.width,
              height: bitmapData.height
            };
          }
        } catch (memError) {
          // Clean up any partial allocations
          this.cleanupFailedLayerOperation(layerIndex, filename);
          this.logError(`[PLOT ERROR] Memory allocation failed for LAYER ${layerIndex} bitmap "${filename}": ${memError}`);
          throw new Error(`Memory allocation failed for layer: ${memError}`);
        }

        this.logConsoleMessage(`[INTEGRATOR] Layer ${layerIndex} loaded from "${filename}" (${bitmapData.width}x${bitmapData.height})`);

        // NEW: Transfer layer to renderer as offscreen canvas for fast cropping
        await this.transferLayerToRenderer(internalLayerIndex, filename);

      } catch (loadError) {
        // Enhanced error classification and logging
        if (loadError.message.includes('ENOENT') || loadError.message.includes('not found')) {
          this.logError(`[PLOT ERROR] Bitmap file not found for LAYER ${layerIndex}: ${filename}`);
          throw new Error(`Bitmap file not found: ${filename}`);
        } else if (loadError.message.includes('Invalid file extension')) {
          this.logError(`[PLOT ERROR] Invalid file extension for LAYER ${layerIndex}: ${filename} (expected .bmp)`);
          throw new Error(`Invalid file extension, expected .bmp: ${filename}`);
        } else if (loadError.message.includes('permission') || loadError.message.includes('EACCES')) {
          this.logError(`[PLOT ERROR] Permission denied for LAYER ${layerIndex}: ${filename}`);
          throw new Error(`Permission denied accessing file: ${filename}`);
        } else if (loadError.message.includes('too large')) {
          // Re-throw memory errors as-is
          throw loadError;
        } else {
          this.logError(`[PLOT ERROR] Failed to load bitmap file for LAYER ${layerIndex}: ${filename} - ${loadError.message}`);
          throw new Error(`Failed to load bitmap file: ${filename} - ${loadError.message}`);
        }
      }

    } catch (error) {
      // Ensure all errors are logged to debug logger
      console.error(`[INTEGRATOR] Failed to load layer:`, error);
      this.logError(`[PLOT ERROR] LAYER command failed: ${error}`);
      throw error;
    }
  }

  /**
   * Transfer loaded layer to renderer as offscreen canvas for fast cropping
   * Uses PNG data URL for efficient transfer, renderer caches as offscreen canvas
   */
  private async transferLayerToRenderer(layerIndex: number, filename: string): Promise<void> {
    try {
      if (!this.plotWindow.debugWindow || !this.plotWindow.shouldWriteToCanvas) {
        this.logConsoleMessage('[INTEGRATOR] Window not ready for layer transfer');
        return;
      }

      // Get the Jimp image from layer manager
      const layer = this.plotWindow.layerManager.layers[layerIndex];
      if (!layer) {
        throw new Error(`Layer ${layerIndex} not loaded in LayerManager`);
      }

      this.logConsoleMessage(`[INTEGRATOR] Transferring layer ${layerIndex} to renderer: ${layer.bitmap.width}x${layer.bitmap.height}`);

      // Convert Jimp image to PNG data URL (compressed, efficient transfer)
      // Note: getBase64() returns Promise<string>, no "Async" suffix in Jimp v1.x
      const dataURL = await layer.getBase64('image/png');

      // Send to renderer and create offscreen canvas
      // Returns Promise that resolves when image loads and canvas is ready
      await this.plotWindow.debugWindow.webContents.executeJavaScript(`
        new Promise((resolve, reject) => {
          try {
            // Initialize layer canvases array if needed
            if (!window.layerCanvases) {
              window.layerCanvases = new Array(16);
              console.log('[LAYER CACHE] Initialized layerCanvases array');
            }

            const layerIndex = ${layerIndex};
            const img = new Image();

            img.onload = () => {
              try {
                // Create offscreen canvas with exact dimensions
                const offscreenCanvas = document.createElement('canvas');
                offscreenCanvas.width = img.width;
                offscreenCanvas.height = img.height;
                const ctx = offscreenCanvas.getContext('2d', { alpha: true });

                if (!ctx) {
                  reject('Failed to get 2d context for offscreen canvas');
                  return;
                }

                // Disable image smoothing for pixel-perfect rendering
                ctx.imageSmoothingEnabled = false;

                // Draw image to offscreen canvas
                ctx.drawImage(img, 0, 0);

                // Cache the offscreen canvas
                window.layerCanvases[layerIndex] = offscreenCanvas;

                console.log('[LAYER CACHE] Layer ' + layerIndex + ' cached: ' + img.width + 'x' + img.height);
                resolve('Layer cached');
              } catch (err) {
                reject('Failed to create offscreen canvas: ' + err.message);
              }
            };

            img.onerror = () => {
              reject('Failed to load layer image');
            };

            img.src = '${dataURL}';
          } catch (err) {
            reject('Failed to transfer layer: ' + err.message);
          }
        })
      `);

      this.logConsoleMessage(`[INTEGRATOR] Layer ${layerIndex} successfully cached in renderer`);

      // NOTE: We could release the Jimp image here to save memory since renderer has the data
      // For now, keeping it in case we need it for other operations (SAVE, etc.)
      // To release: this.plotWindow.layerManager.layers[layerIndex] = null;

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to transfer layer ${layerIndex} to renderer:`, error);
      throw new Error(`Failed to transfer layer to renderer: ${error}`);
    }
  }

  /**
   * Release layer cache in renderer
   * Called when layer is released from LayerManager
   */
  async releaseLayerInRenderer(layerIndex: number): Promise<void> {
    try {
      if (!this.plotWindow.debugWindow || !this.plotWindow.shouldWriteToCanvas) {
        return;
      }

      await this.plotWindow.debugWindow.webContents.executeJavaScript(`
        (function() {
          if (window.layerCanvases && window.layerCanvases[${layerIndex}]) {
            console.log('[LAYER CACHE] Releasing layer ${layerIndex}');
            window.layerCanvases[${layerIndex}] = null;
            return 'Layer cache released';
          }
          return 'Layer not cached';
        })()
      `);

      this.logConsoleMessage(`[INTEGRATOR] Released layer ${layerIndex} cache in renderer`);

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to release layer ${layerIndex} in renderer:`, error);
    }
  }

  /**
   * Release all layer caches in renderer
   * Called when clearing all layers
   */
  async releaseAllLayersInRenderer(): Promise<void> {
    try {
      if (!this.plotWindow.debugWindow || !this.plotWindow.shouldWriteToCanvas) {
        return;
      }

      await this.plotWindow.debugWindow.webContents.executeJavaScript(`
        (function() {
          if (window.layerCanvases) {
            console.log('[LAYER CACHE] Releasing all layer caches');
            window.layerCanvases = new Array(16);
            return 'All layer caches released';
          }
          return 'No caches to release';
        })()
      `);

      this.logConsoleMessage(`[INTEGRATOR] Released all layer caches in renderer`);

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to release all layers in renderer:`, error);
    }
  }

  /**
   * Load and parse BMP file from filesystem
   */
  private async loadBitmapFile(filename: string): Promise<BitmapData> {
    try {
      // Import Node.js filesystem module
      const fs = require('fs');
      const path = require('path');

      // Validate file extension
      if (!filename.toLowerCase().endsWith('.bmp')) {
        throw new Error(`Invalid file extension, expected .bmp: ${filename}`);
      }

      // Resolve file path relative to current working directory (matching Pascal behavior)
      const filePath = path.resolve(process.cwd(), filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`Bitmap file not found: ${filename}`);
      }

      // Read file data
      const fileData = fs.readFileSync(filePath);

      // Parse BMP header and pixel data
      const bitmapData = this.parseBMPData(fileData, filename);

      this.logConsoleMessage(`[INTEGRATOR] BMP file loaded: ${filename} (${bitmapData.width}x${bitmapData.height})`);

      return bitmapData;

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to load BMP file: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Parse BMP file data and extract pixel information
   */
  private parseBMPData(fileData: Buffer, filename: string): BitmapData {
    try {
      // Verify BMP signature
      if (fileData.length < 54) {
        throw new Error(`BMP file too small: ${filename}`);
      }

      // Check BMP signature ('BM')
      if (fileData.readUInt16LE(0) !== 0x4D42) {
        throw new Error(`Invalid BMP signature: ${filename}`);
      }

      // Read BMP header information
      const fileSize = fileData.readUInt32LE(2);
      const dataOffset = fileData.readUInt32LE(10);
      const headerSize = fileData.readUInt32LE(14);
      const width = fileData.readInt32LE(18);
      const height = fileData.readInt32LE(22);
      const planes = fileData.readUInt16LE(26);
      const bitsPerPixel = fileData.readUInt16LE(28);
      const compression = fileData.readUInt32LE(30);

      // Validate BMP format
      if (planes !== 1) {
        throw new Error(`Unsupported BMP planes: ${planes} (expected 1)`);
      }

      if (compression !== 0) {
        throw new Error(`Compressed BMP not supported: ${filename}`);
      }

      if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
        throw new Error(`Unsupported BMP bit depth: ${bitsPerPixel} (expected 24 or 32)`);
      }

      // Calculate row padding (BMP rows are padded to 4-byte boundaries)
      const bytesPerPixel = bitsPerPixel / 8;
      const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
      const padding = rowSize - (width * bytesPerPixel);

      // Extract pixel data
      const pixels: number[] = [];
      const absHeight = Math.abs(height);

      for (let y = 0; y < absHeight; y++) {
        for (let x = 0; x < width; x++) {
          // BMP stores pixels bottom-to-top, so adjust y coordinate
          const bmpY = height > 0 ? (absHeight - 1 - y) : y;
          const pixelOffset = dataOffset + (bmpY * rowSize) + (x * bytesPerPixel);

          if (pixelOffset + bytesPerPixel > fileData.length) {
            throw new Error(`BMP pixel data overflow: ${filename}`);
          }

          // BMP stores pixels as BGR (or BGRA)
          const b = fileData.readUInt8(pixelOffset);
          const g = fileData.readUInt8(pixelOffset + 1);
          const r = fileData.readUInt8(pixelOffset + 2);
          const a = bitsPerPixel === 32 ? fileData.readUInt8(pixelOffset + 3) : 255;

          // Convert to RGB format
          const rgb = (r << 16) | (g << 8) | b;
          pixels.push(rgb);
        }
      }

      return {
        width: width,
        height: absHeight,
        pixels: pixels,
        bitsPerPixel: bitsPerPixel
      };

    } catch (error) {
      throw new Error(`Failed to parse BMP file ${filename}: ${error.message}`);
    }
  }

  /**
   * Execute crop operation - copy rectangular region from layer to canvas
   */
  private async executeCropLayer(params: Record<string, any>): Promise<void> {
    this.logConsoleMessage('[INTEGRATOR] executeCropLayer called with:', params);

    try {
      if (!this.plotWindow.layerManager) {
        throw new Error('Layer manager not available in plot window');
      }

      const { layerIndex, mode } = params;

      // Validate layer index and convert from Pascal (1-16) to internal (0-15)
      if (layerIndex === undefined || layerIndex < 1 || layerIndex > 16) {
        throw new Error(`Invalid layer index: ${layerIndex} (must be 1-16)`);
      }

      const internalLayerIndex = layerIndex - 1;

      // DIAGNOSTIC: Log state before checking layer
      this.logConsoleMessage(
        `[INTEGRATOR] About to check layer: ` +
        `layerIndex=${layerIndex}, ` +
        `internalLayerIndex=${internalLayerIndex}, ` +
        `layerManager exists=${!!this.plotWindow.layerManager}, ` +
        `plotWindow exists=${!!this.plotWindow}`
      );

      // Check if layer is loaded using LayerManager's method
      if (!this.plotWindow.layerManager.isLayerLoaded(internalLayerIndex)) {
        // DIAGNOSTIC: Additional info when check fails
        this.logConsoleMessage(
          `[INTEGRATOR] Layer check FAILED! ` +
          `Dumping state: ` +
          `layerManager.layers.length=${this.plotWindow.layerManager.layers?.length}, ` +
          `layerManager.layers[${internalLayerIndex}]=${this.plotWindow.layerManager.layers[internalLayerIndex] ? 'EXISTS' : 'NULL'}`
        );
        throw new Error(`Layer ${layerIndex} not loaded`);
      }

      this.logConsoleMessage(`[INTEGRATOR] Layer check passed for layer ${layerIndex}`);


      // Get layer dimensions
      const dimensions = this.plotWindow.layerManager.getLayerDimensions(internalLayerIndex);
      if (!dimensions) {
        throw new Error(`Layer ${layerIndex} has no dimensions`);
      }

      // Handle DEFAULT mode - fill in width/height from layer dimensions
      if (mode === 'DEFAULT') {
        params.width = dimensions.width;
        params.height = dimensions.height;
      }

      // Handle different crop modes
      if (mode === 'AUTO' || mode === 'DEFAULT') {
        await this.executeCropAuto(internalLayerIndex, dimensions, params);
      } else {
        await this.executeCropExplicit(internalLayerIndex, dimensions, params);
      }

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to crop layer:`, error);
      throw error;
    }
  }

  /**
   * Execute AUTO crop mode - automatically determine source rectangle
   */
  private async executeCropAuto(layerIndex: number, dimensions: { width: number; height: number }, params: Record<string, any>): Promise<void> {
    const { destX, destY } = params;

    // For AUTO mode, copy the entire layer to the destination position
    // This matches Pascal's behavior where AUTO determines the source automatically
    const sourceRect = {
      left: 0,
      top: 0,
      width: dimensions.width,
      height: dimensions.height
    };

    await this.copyLayerToCanvas(layerIndex, sourceRect, destX, destY);

    this.logConsoleMessage(`[INTEGRATOR] CROP AUTO: copied entire layer (${sourceRect.width}x${sourceRect.height}) to (${destX}, ${destY})`);
  }

  /**
   * Execute explicit crop mode - use specified source rectangle
   */
  private async executeCropExplicit(layerIndex: number, dimensions: { width: number; height: number }, params: Record<string, any>): Promise<void> {
    const { left, top, width, height, destX, destY } = params;

    // Validate source rectangle bounds
    if (left < 0 || top < 0 || left + width > dimensions.width || top + height > dimensions.height) {
      throw new Error(`Source rectangle (${left},${top}) ${width}x${height} exceeds layer bounds ${dimensions.width}x${dimensions.height}`);
    }

    const sourceRect = { left, top, width, height };
    await this.copyLayerToCanvas(layerIndex, sourceRect, destX, destY);

    this.logConsoleMessage(`[INTEGRATOR] CROP EXPLICIT: copied (${left},${top}) ${width}x${height} to (${destX}, ${destY})`);
  }

  /**
   * Copy rectangular region from cached layer canvas to plot canvas
   * NEW: Uses cached offscreen canvas with drawImage for 400x faster performance
   * OLD: Extracted pixels via Jimp + JSON.stringify (40ms even for tiny crops)
   */
  private async copyLayerToCanvas(
    layerIndex: number,
    sourceRect: { left: number; top: number; width: number; height: number },
    destX: number,
    destY: number
  ): Promise<void> {
    try {
      if (!this.plotWindow.debugWindow || !this.plotWindow.shouldWriteToCanvas) {
        this.logConsoleMessage('[INTEGRATOR] Window not ready for layer rendering');
        return;
      }

      this.logConsoleMessage(`[INTEGRATOR] Copying layer ${layerIndex} rect (${sourceRect.left},${sourceRect.top}) ${sourceRect.width}x${sourceRect.height} to (${destX}, ${destY})`);

      // NEW APPROACH: Use cached offscreen canvas with drawImage
      // Just send coordinates - renderer has the bitmap cached
      const jsCode = `
        (function() {
          if (!window.plotCtx) {
            console.error('[PLOT] Context not ready for layer rendering');
            return 'Context not ready';
          }

          if (!window.layerCanvases || !window.layerCanvases[${layerIndex}]) {
            console.error('[PLOT] Layer ${layerIndex} not cached in renderer');
            return 'Layer not cached';
          }

          const layerCanvas = window.layerCanvases[${layerIndex}];

          // Use drawImage to copy from cached layer canvas to plot canvas
          // Use default 'source-over' for proper blending
          window.plotCtx.drawImage(
            layerCanvas,
            ${sourceRect.left},   // sx: source x
            ${sourceRect.top},    // sy: source y
            ${sourceRect.width},  // sw: source width
            ${sourceRect.height}, // sh: source height
            ${destX},             // dx: dest x
            ${destY},             // dy: dest y
            ${sourceRect.width},  // dw: dest width (no scaling)
            ${sourceRect.height}  // dh: dest height (no scaling)
          );

          return 'Layer copied';
        })()
      `;

      const result = await this.plotWindow.debugWindow.webContents.executeJavaScript(jsCode);
      this.logConsoleMessage(`[INTEGRATOR] Layer copy result: ${result}`);

    } catch (error) {
      console.error('[INTEGRATOR] Error during layer copying:', error);
      throw error;
    }
  }

  /**
   * Execute LUT_SET operation - sets single palette entry for indexed color mode
   */
  private executeLutSet(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeLutSet called with:', params);

    try {
      const lutManager = this.plotWindow.getLutManager();
      if (!lutManager) {
        throw new Error('LUT manager not available in plot window');
      }

      const { index, color } = params;

      // Validate parameters
      if (index === undefined || index < 0 || index > 255) {
        throw new Error(`Invalid LUT index: ${index} (must be 0-255)`);
      }

      if (color === undefined) {
        throw new Error('Color value is required for LUT_SET operation');
      }

      // Set the palette entry
      lutManager.setColor(index, color);

      // Update color translator with new palette
      const colorTranslator = this.plotWindow.getColorTranslator();
      if (colorTranslator) {
        colorTranslator.setLutPalette(lutManager.getPalette());
      }

      this.logConsoleMessage(`[INTEGRATOR] LUT palette[${index}] set to 0x${color.toString(16).padStart(6, '0')}`);

    } catch (error) {
      console.error('[INTEGRATOR] Error during LUT_SET operation:', error);
      throw error;
    }
  }

  /**
   * Execute LUT_COLORS operation - loads multiple RGB24 color values into consecutive palette entries
   */
  private executeLutColors(params: Record<string, any>): void {
    this.logConsoleMessage('[INTEGRATOR] executeLutColors called with:', params);

    try {
      const lutManager = this.plotWindow.getLutManager();
      if (!lutManager) {
        throw new Error('LUT manager not available in plot window');
      }

      const { colors } = params;

      // Validate parameters
      if (!colors || !Array.isArray(colors)) {
        throw new Error('Colors array is required for LUT_COLORS operation');
      }

      if (colors.length === 0) {
        throw new Error('At least one color is required for LUT_COLORS operation');
      }

      // Load colors using the LUTManager's loadFromLutColors method
      const loadedCount = lutManager.loadFromLutColors(colors);

      // Update color translator with new palette
      const colorTranslator = this.plotWindow.getColorTranslator();
      if (colorTranslator) {
        colorTranslator.setLutPalette(lutManager.getPalette());
      }

      this.logConsoleMessage(`[INTEGRATOR] LUTCOLORS loaded ${loadedCount} colors into palette`);

    } catch (error) {
      console.error('[INTEGRATOR] Error during LUT_COLORS operation:', error);
      throw error;
    }
  }

  /**
   * Update internal state after operation
   */
  private updateInternalState(operation: PlotCanvasOperation): void {
    switch (operation.type) {
      case CanvasOperationType.SET_CURSOR:
        if (operation.parameters.x !== undefined) {
          this.state.cursorPosition.x = operation.parameters.x;
        }
        if (operation.parameters.y !== undefined) {
          this.state.cursorPosition.y = operation.parameters.y;
        }
        break;

      case CanvasOperationType.SET_ORIGIN:
        if (operation.parameters.x !== undefined) {
          this.state.origin.x = operation.parameters.x;
        }
        if (operation.parameters.y !== undefined) {
          this.state.origin.y = operation.parameters.y;
        }
        break;

      case CanvasOperationType.SET_COLOR:
        if (operation.parameters.color) {
          this.state.currentFgColor = operation.parameters.color;
        }
        break;

      case CanvasOperationType.SET_LINESIZE:
        if (operation.parameters.size !== undefined) {
          // LineSize from device is in fixed-point format (256ths)
          // Like coordinates, we need to divide by 256 to get pixels
          // Pascal: radius parameter to SmoothLine is in 256ths
          const pixelLineSize = Math.max(1, Math.round(operation.parameters.size / 256.0));
          this.state.lineSize = pixelLineSize;
          this.plotWindow.lineSize = pixelLineSize;
        }
        break;

      case CanvasOperationType.SET_OPACITY:
        if (operation.parameters.opacity) {
          this.state.opacity = operation.parameters.opacity;
        }
        break;

      case CanvasOperationType.SET_TEXTANGLE:
        if (operation.parameters.angle) {
          this.state.textAngle = operation.parameters.angle;
        }
        break;

      case CanvasOperationType.SET_COORDINATE_MODE:
        if (operation.parameters.mode) {
          this.state.coordinateMode = operation.parameters.mode;
        }
        if (operation.parameters.polarConfig) {
          this.state.polarConfig = operation.parameters.polarConfig;
        }
        if (operation.parameters.cartesianConfig) {
          this.state.cartesianConfig = operation.parameters.cartesianConfig;
        }
        break;

      case CanvasOperationType.SET_COLOR_MODE:
        // Color mode affects how colors are interpreted - store in state
        if (operation.parameters.mode !== undefined) {
          this.state.colorMode = operation.parameters.mode;
        }
        break;

      case CanvasOperationType.SET_TEXTSIZE:
        // Text size affects future TEXT commands - store in state
        if (operation.parameters.textSize !== undefined) {
          this.state.defaultTextSize = operation.parameters.textSize;
        }
        break;

      case CanvasOperationType.SET_TEXTSTYLE:
        // Text style affects future TEXT commands - store in state
        if (operation.parameters.textStyle !== undefined) {
          this.state.defaultTextStyle = operation.parameters.textStyle;
        }
        break;

      case CanvasOperationType.SET_PRECISION:
        // Precision affects coordinate calculations in drawing commands
        if (operation.parameters.toggle) {
          // The actual toggle logic is handled in executeSetPrecision
          // This just acknowledges that precision state was updated
          this.logConsoleMessage('[INTEGRATOR] Precision state updated in internal state');
        }
        break;
    }
  }

  /**
   * Get current parser state
   */
  getState(): PlotWindowState {
    return { ...this.state };
  }

  /**
   * Convert CanvasOperation to PlotCanvasOperation for internal processing
   */
  private convertFromCanvasOperation(canvasOp: any): PlotCanvasOperation {
    // If already has a type field that's a CanvasOperationType, it's likely already converted
    if (typeof canvasOp.type === 'string' && canvasOp.type.includes('_')) {
      // It's already a PlotCanvasOperation-like object from the parser
      // Map string type to enum
      let plotType: CanvasOperationType;

      switch (canvasOp.type) {
        case 'DRAW_DOT':
          plotType = CanvasOperationType.DRAW_DOT;
          break;
        case 'DRAW_LINE':
          plotType = CanvasOperationType.DRAW_LINE;
          break;
        case 'DRAW_CIRCLE':
          plotType = CanvasOperationType.DRAW_CIRCLE;
          break;
        case 'DRAW_BOX':
          plotType = CanvasOperationType.DRAW_BOX;
          break;
        case 'DRAW_OVAL':
          plotType = CanvasOperationType.DRAW_OVAL;
          break;
        case 'DRAW_TEXT':
          plotType = CanvasOperationType.DRAW_TEXT;
          break;
        case 'SET_CURSOR':
          plotType = CanvasOperationType.SET_CURSOR;
          break;
        case 'SET_ORIGIN':
          plotType = CanvasOperationType.SET_ORIGIN;
          break;
        case 'SET_COLOR':
          plotType = CanvasOperationType.SET_COLOR;
          break;
        case 'SET_COORDINATE_MODE':
          plotType = CanvasOperationType.SET_COORDINATE_MODE;
          break;
        case 'SET_COLOR_MODE':
          plotType = CanvasOperationType.SET_COLOR_MODE;
          break;
        case 'SET_TEXTSIZE':
          plotType = CanvasOperationType.SET_TEXTSIZE;
          break;
        case 'SET_TEXTSTYLE':
          plotType = CanvasOperationType.SET_TEXTSTYLE;
          break;
        case 'SET_LINESIZE':
          plotType = CanvasOperationType.SET_LINESIZE;
          break;
        case 'SET_OPACITY':
          plotType = CanvasOperationType.SET_OPACITY;
          break;
        case 'SET_TEXTANGLE':
          plotType = CanvasOperationType.SET_TEXTANGLE;
          break;
        case 'SET_PRECISION':
          plotType = CanvasOperationType.SET_PRECISION;
          break;
        case 'PC_INPUT':
          plotType = CanvasOperationType.PC_INPUT;
          break;
        case 'CLEAR_CANVAS':
          plotType = CanvasOperationType.CLEAR_CANVAS;
          break;
        case 'UPDATE_DISPLAY':
          plotType = CanvasOperationType.UPDATE_DISPLAY;
          break;
        case 'CONFIGURE_WINDOW':
          plotType = CanvasOperationType.CONFIGURE_WINDOW;
          break;
        case 'DEFINE_SPRITE':
          plotType = CanvasOperationType.DEFINE_SPRITE;
          break;
        case 'DRAW_SPRITE':
          plotType = CanvasOperationType.DRAW_SPRITE;
          break;
        case 'LOAD_LAYER':
          plotType = CanvasOperationType.LOAD_LAYER;
          break;
        case 'CROP_LAYER':
          plotType = CanvasOperationType.CROP_LAYER;
          break;
        case 'LUT_SET':
          plotType = CanvasOperationType.LUT_SET;
          break;
        case 'LUT_COLORS':
          plotType = CanvasOperationType.LUT_COLORS;
          break;
        default:
          console.warn(`[INTEGRATOR] Unknown operation type: ${canvasOp.type}, using DRAW_DOT as fallback`);
          plotType = CanvasOperationType.DRAW_DOT;
          break;
      }

      return {
        type: plotType,
        parameters: canvasOp.parameters || {},
        affectsState: canvasOp.affectsState || this.isStateAffecting(plotType),
        requiresUpdate: canvasOp.requiresUpdate || this.requiresUpdate(plotType),
        deferrable: canvasOp.deferrable !== undefined ? canvasOp.deferrable : true
      };
    }

    // Legacy CanvasOperation type mapping
    let plotType: CanvasOperationType;

    switch ((canvasOp as CanvasOperation).type) {
      case 'DRAW_DOT':
        plotType = CanvasOperationType.DRAW_DOT;
        break;
      case 'DRAW_LINE':
        plotType = CanvasOperationType.DRAW_LINE;
        break;
      case 'DRAW_CIRCLE':
        plotType = CanvasOperationType.DRAW_CIRCLE;
        break;
      case 'DRAW_BOX':
        plotType = CanvasOperationType.DRAW_BOX;
        break;
      case 'DRAW_OVAL':
        plotType = CanvasOperationType.DRAW_OVAL;
        break;
      case 'DRAW_TEXT':
        plotType = CanvasOperationType.DRAW_TEXT;
        break;
      case 'SET_CURSOR':
        plotType = CanvasOperationType.SET_CURSOR;
        break;
      case 'CLEAR':
        plotType = CanvasOperationType.CLEAR_CANVAS;
        break;
      case 'UPDATE':
        plotType = CanvasOperationType.UPDATE_DISPLAY;
        break;
      default:
        console.warn(`[INTEGRATOR] Unknown legacy operation type: ${(canvasOp as CanvasOperation).type}`);
        plotType = CanvasOperationType.DRAW_DOT; // fallback
        break;
    }

    return {
      type: plotType,
      parameters: canvasOp.parameters,
      affectsState: this.isStateAffecting(plotType),
      requiresUpdate: this.requiresUpdate(plotType),
      deferrable: true // Default to deferrable
    };
  }

  private isStateAffecting(type: CanvasOperationType): boolean {
    return [
      CanvasOperationType.SET_CURSOR,
      CanvasOperationType.SET_ORIGIN,
      CanvasOperationType.SET_COLOR,
      CanvasOperationType.SET_LINESIZE,
      CanvasOperationType.SET_OPACITY,
      CanvasOperationType.SET_TEXTANGLE,
      CanvasOperationType.SET_COORDINATE_MODE,
      CanvasOperationType.SET_COLOR_MODE,
      CanvasOperationType.SET_TEXTSIZE,
      CanvasOperationType.SET_TEXTSTYLE,
      CanvasOperationType.SET_PRECISION,
      CanvasOperationType.LUT_SET,
      CanvasOperationType.LUT_COLORS
    ].includes(type);
  }

  private requiresUpdate(type: CanvasOperationType): boolean {
    return [
      CanvasOperationType.DRAW_DOT,
      CanvasOperationType.DRAW_LINE,
      CanvasOperationType.DRAW_CIRCLE,
      CanvasOperationType.DRAW_BOX,
      CanvasOperationType.DRAW_OVAL,
      CanvasOperationType.DRAW_TEXT,
      CanvasOperationType.DRAW_SPRITE,
      CanvasOperationType.CLEAR_CANVAS,
      CanvasOperationType.CROP_LAYER
    ].includes(type);
  }

  /**
   * Batch execute multiple operations (supports both CanvasOperation[] and PlotCanvasOperation[])
   */
  async executeBatch(operations: CanvasOperation[] | PlotCanvasOperation[]): Promise<CommandResult[]> {
    const results: CommandResult[] = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      // Convert CanvasOperation to PlotCanvasOperation if needed
      let plotOperation: PlotCanvasOperation;

      // Debug logging for operations
      this.logConsoleMessage('[INTEGRATOR BATCH] Processing operation:', operation.type, (operation as any).parameters);
      this.logConsoleMessage('[INTEGRATOR BATCH] Operation has affectsState property?', 'affectsState' in operation, 'value=', (operation as any).affectsState);

      if ('affectsState' in operation) {
        // Already a PlotCanvasOperation
        plotOperation = operation as PlotCanvasOperation;
        this.logConsoleMessage('[INTEGRATOR BATCH] Using PlotCanvasOperation directly, affectsState=', plotOperation.affectsState);
      } else {
        // Convert CanvasOperation to PlotCanvasOperation
        plotOperation = this.convertFromCanvasOperation(operation as CanvasOperation);
        this.logConsoleMessage('[INTEGRATOR BATCH] After conversion, affectsState=', plotOperation.affectsState);
      }

      const result = await this.executeOperation(plotOperation);
      results.push(result);

      // Stop on first error if not recoverable
      if (!result.success && !plotOperation.deferrable) {
        break;
      }
    }

    return results;
  }

  /**
   * Defer operations for batch execution (UPDATE mode)
   */
  private deferredOperations: PlotCanvasOperation[] = [];

  async deferOperation(operation: PlotCanvasOperation): Promise<void> {
    if (operation.deferrable) {
      this.deferredOperations.push(operation);
    } else {
      await this.executeOperation(operation);
    }
  }

  async flushDeferredOperations(): Promise<CommandResult[]> {
    const results = await this.executeBatch(this.deferredOperations);
    this.deferredOperations = [];
    return results;
  }

  /**
   * Clear deferred operations without executing them (for cleanup)
   */
  clearDeferredOperations(): void {
    const operationCount = this.deferredOperations.length;
    this.deferredOperations = [];
    if (operationCount > 0) {
      this.logConsoleMessage(`[INTEGRATOR] Cleared ${operationCount} deferred operations during cleanup`);
    }
  }

  /**
   * Clean up resources after a failed sprite operation
   * @param spriteId The sprite ID that failed
   */
  private cleanupFailedSpriteOperation(spriteId: number): void {
    try {
      // Clear any partially created sprite data
      if (this.plotWindow && this.plotWindow.spriteManager && this.plotWindow.spriteManager.isSpriteDefine(spriteId)) {
        this.plotWindow.spriteManager.clearSprite(spriteId);
        this.logConsoleMessage(`[INTEGRATOR] Cleaned up failed sprite operation for sprite ${spriteId}`);
      }
    } catch (cleanupError) {
      console.warn(`[INTEGRATOR] Error during sprite cleanup: ${cleanupError}`);
    }
  }

  /**
   * Clean up resources after a failed layer operation
   * @param layerIndex The layer index that failed
   * @param filename The filename that was being loaded
   */
  private cleanupFailedLayerOperation(layerIndex: number, filename: string): void {
    try {
      // Clear any partially created layer data
      if (this.plotWindow && this.plotWindow.layerManager) {
        const internalLayerIndex = layerIndex - 1;
        if (this.plotWindow.layerManager.isLayerLoaded(internalLayerIndex)) {
          this.plotWindow.layerManager.clearLayer(internalLayerIndex);
          this.logConsoleMessage(`[INTEGRATOR] Cleaned up failed layer operation for layer ${layerIndex} ("${filename}")`);
        }
      }
    } catch (cleanupError) {
      console.warn(`[INTEGRATOR] Error during layer cleanup: ${cleanupError}`);
    }
  }

  /**
   * Perform comprehensive resource cleanup
   * Useful for critical error recovery
   */
  private performEmergencyCleanup(): void {
    try {
      console.warn('[INTEGRATOR] Performing emergency resource cleanup');

      // Clear all deferred operations
      this.clearDeferredOperations();

      // Suggest garbage collection on managers
      if (this.plotWindow) {
        if (this.plotWindow.spriteManager) {
          const spriteHealth = this.plotWindow.spriteManager.checkMemoryHealth();
          if (spriteHealth) {
            console.warn(`[INTEGRATOR] Sprite memory warning: ${spriteHealth}`);
          }
          this.plotWindow.spriteManager.suggestGarbageCollection();
        }

        if (this.plotWindow.layerManager) {
          const layerHealth = this.plotWindow.layerManager.checkMemoryHealth();
          if (layerHealth) {
            console.warn(`[INTEGRATOR] Layer memory warning: ${layerHealth}`);
          }
          this.plotWindow.layerManager.suggestGarbageCollection();
        }
      }

      this.logConsoleMessage('[INTEGRATOR] Emergency cleanup completed');
    } catch (emergencyError) {
      console.error('[INTEGRATOR] Emergency cleanup failed:', emergencyError);
    }
  }

  /**
   * Log error message to debug logger and console for comprehensive error tracking
   */
  private logError(message: string): void {
    console.error(message);

    // Try to log to debug logger if available
    try {
      if (this.plotWindow && this.plotWindow.logMessageBase) {
        this.plotWindow.logMessageBase(message);
      } else if (this.plotWindow && this.plotWindow.context) {
        // Alternative path via context logger
        this.plotWindow.context.logger.forceLogMessage(message);
      }
    } catch (error) {
      console.warn('Failed to log error to debug logger:', error);
    }
  }
}

// Factory for creating properly configured operations
export class PlotOperationFactory {
  static createDrawOperation(
    type: CanvasOperationType,
    params: Record<string, any>,
    deferrable: boolean = true
  ): PlotCanvasOperation {
    return {
      type,
      parameters: params,
      affectsState: this.isStateAffecting(type),
      requiresUpdate: this.requiresUpdate(type),
      deferrable,
    };
  }

  private static isStateAffecting(type: CanvasOperationType): boolean {
    return [
      CanvasOperationType.SET_CURSOR,
      CanvasOperationType.SET_ORIGIN,
      CanvasOperationType.SET_COLOR,
      CanvasOperationType.SET_LINESIZE,
      CanvasOperationType.SET_OPACITY,
      CanvasOperationType.SET_TEXTANGLE,
      CanvasOperationType.SET_COORDINATE_MODE,
      CanvasOperationType.SET_COLOR_MODE,
      CanvasOperationType.SET_TEXTSIZE,
      CanvasOperationType.SET_TEXTSTYLE,
      CanvasOperationType.SET_PRECISION,
      CanvasOperationType.LUT_SET,
      CanvasOperationType.LUT_COLORS
    ].includes(type);
  }

  private static requiresUpdate(type: CanvasOperationType): boolean {
    return [
      CanvasOperationType.DRAW_DOT,
      CanvasOperationType.DRAW_LINE,
      CanvasOperationType.DRAW_CIRCLE,
      CanvasOperationType.DRAW_BOX,
      CanvasOperationType.DRAW_OVAL,
      CanvasOperationType.DRAW_TEXT,
      CanvasOperationType.DRAW_SPRITE,
      CanvasOperationType.CLEAR_CANVAS,
      CanvasOperationType.CROP_LAYER
    ].includes(type);
  }

}