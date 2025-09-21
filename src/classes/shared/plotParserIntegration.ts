/** @format */

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
    const result: CommandResult = {
      success: true,
      errors: [],
      warnings: [],
      canvasOperations: [this.convertToCanvasOperation(operation)]
    };

    // Debug logging to trace color operations
    if (operation.parameters?.color) {
      console.log(`[INTEGRATOR] Processing operation with color: type=${operation.type}, params=`, operation.parameters);
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
          console.log('[INTEGRATOR] Executing SET_COLOR with params:', operation.parameters);
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
          this.executeCropLayer(operation.parameters);
          break;

        case CanvasOperationType.LUT_SET:
          this.executeLutSet(operation.parameters);
          break;

        case CanvasOperationType.LUT_COLORS:
          this.executeLutColors(operation.parameters);
          break;

        default:
          // Log what's happening with operations that fall through
          console.log('[INTEGRATOR] Operation fell through to default:', operation.type, operation.parameters);
          result.success = false;
          result.errors.push(`Unsupported operation type: ${operation.type}`);
      }

      // Update internal state if operation affects state
      if (operation.affectsState) {
        this.updateInternalState(operation);
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

    return result;
  }

  /**
   * Execute drawing operation directly on canvas
   */
  private async executeDraw(command: string, params: Record<string, any>): Promise<void> {
    // Apply precision multiplier if in high precision mode (vPrecise = 8)
    const precisionMultiplier = this.state.precise === 8 ? 1.0 / 256.0 : 1.0;

    switch (command) {
      case 'DOT':
        // DOT is drawn as a small filled circle
        // Do NOT apply precision multiplier to dot size - it's already in pixels
        const dotSize = this.plotWindow.displaySpec?.dotSize || 1;
        await this.plotWindow.drawCircleToPlot(dotSize, 0, params.opacity ?? 255);
        break;

      case 'LINE':
        // IMPORTANT: Do NOT apply precision multiplier to LINE coordinates!
        // In polar mode, these are radius/angle values, not pixel positions
        // In cartesian mode with high precision, LINE still uses logical coordinates
        // The precision handling happens inside drawLineToPlot based on coordinate mode
        const lineX = params.x ?? 0;
        const lineY = params.y ?? 0;
        const lineSize = params.lineSize ?? 1;  // Line size is in pixels
        await this.plotWindow.drawLineToPlot(
          lineX,
          lineY,
          lineSize,
          params.opacity ?? 255
        );
        break;

      case 'CIRCLE':
        // Do NOT apply precision multiplier to diameter - it's already in pixels
        // Precision multiplier is only for coordinate positions, not sizes
        const diameter = params.diameter || 10;
        const circleLineSize = params.lineSize !== undefined ? params.lineSize : 0;

        console.log('[INTEGRATOR] Drawing CIRCLE with params:', {
          diameter: diameter,
          lineSize: circleLineSize,
          opacity: params.opacity ?? 255,
          originalDiameter: params.diameter || 10,
          originalLineSize: params.lineSize,
          precisionMultiplier: precisionMultiplier
        });

        await this.plotWindow.drawCircleToPlot(
          diameter,
          circleLineSize,  // Use precision-adjusted line size
          params.opacity ?? 255
        );
        break;

      case 'BOX':
      case 'OVAL':
        // TODO: Implement box and oval drawing with precision support
        console.log(`[INTEGRATOR] ${command} not yet implemented with params:`, params);
        break;

      default:
        console.log(`[INTEGRATOR] Unknown draw command: ${command}`);
    }
  }

  /**
   * Execute text drawing with font setup
   */
  private async executeDrawText(params: Record<string, any>): Promise<void> {
    // Only apply pending color if the last operation was SET_COLOR
    // This matches Pascal behavior: color immediately before TEXT sets text color
    if (this.lastOperationType === CanvasOperationType.SET_COLOR && this.lastSetColor) {
      console.log('[INTEGRATOR] Applying color to text (color was previous op):', this.lastSetColor);
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
    console.log('[INTEGRATOR] executeSetCursor called with:', params);
    console.log('[INTEGRATOR] Current state:', {
      coordinateMode: this.state.coordinateMode,
      precise: this.state.precise,
      origin: this.plotWindow.origin,
      polarConfig: this.plotWindow.polarConfig
    });

    if (params.x !== undefined && params.y !== undefined) {
      let x = params.x;
      let y = params.y;

      // IMPORTANT: SET command does NOT use precision multiplier!
      // Precision mode only affects drawing operations (LINE, DOT, etc.)
      // SET always uses absolute coordinates regardless of precision mode
      console.log(`[INTEGRATOR] Raw SET params: x=${x}, y=${y} (no precision applied to SET)`);

      // Check if we're in polar mode
      if (this.state.coordinateMode === 'POLAR') {
        // In polar mode, SET coordinates are polar (radius, angle)
        // First parameter (x) is radius, second parameter (y) is angle
        const radius = x;  // No precision multiplier for SET
        const angle = y;   // No precision multiplier for SET

        console.log(`[INTEGRATOR] Polar mode - radius=${radius}, angle=${angle}`);

        // Convert polar to cartesian - this gives us logical coordinates
        [x, y] = this.plotWindow.polarToCartesian(radius, angle);

        console.log(`[INTEGRATOR] After polarToCartesian: x=${x}, y=${y}`);
      } else {
        // In cartesian mode, SET uses coordinates directly
        // No precision multiplier for SET command
        console.log(`[INTEGRATOR] Cartesian mode - x=${x}, y=${y}`);
      }

      // Set cursor position directly to the logical coordinates
      // DO NOT use getXY() here - SET stores absolute logical coordinates
      // getXY() is only used when drawing to convert logical to screen coordinates
      this.plotWindow.cursorPosition.x = x;
      this.plotWindow.cursorPosition.y = y;
      this.state.cursorPosition = { x, y };

      console.log('[INTEGRATOR] Final cursor position:', this.plotWindow.cursorPosition);

      // Also log what the screen coordinates would be
      const screenCoords = this.plotWindow.getCursorXY();
      console.log('[INTEGRATOR] Screen coordinates would be:', screenCoords);
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
    console.log('[INTEGRATOR] executeSetColor called with:', params);
    if (params.color) {
      // Convert color name with brightness to hex value
      const colorHex = this.colorNameToHex(params.color, params.brightness);
      console.log(`[INTEGRATOR] Setting color to ${colorHex}`);

      // Set shape/drawing color
      this.plotWindow.currFgColor = colorHex;
      this.state.currentFgColor = colorHex;

      // Save this color for potential text use
      this.lastSetColor = colorHex;
    }
  }

  private colorNameToHex(colorName: string, brightness?: number): string {
    // Default brightness is 15 (full)
    const bright = brightness !== undefined ? brightness : 15;
    const factor = bright / 15.0; // Scale to 0-1

    // Color name to RGB values
    const colors: Record<string, [number, number, number]> = {
      'BLACK': [0, 0, 0],
      'WHITE': [255, 255, 255],
      'RED': [255, 0, 0],
      'GREEN': [0, 255, 0],
      'BLUE': [0, 0, 255],
      'CYAN': [0, 255, 255],
      'MAGENTA': [255, 0, 255],
      'YELLOW': [255, 255, 0],
      'ORANGE': [255, 128, 0],
      'GRAY': [128, 128, 128],
      'GREY': [128, 128, 128]
    };

    const rgb = colors[colorName] || [255, 255, 255]; // Default to white

    // Apply brightness factor
    const r = Math.round(rgb[0] * factor);
    const g = Math.round(rgb[1] * factor);
    const b = Math.round(rgb[2] * factor);

    // Convert to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
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
            console.log(`[PLOT] Window title set to: "${params.title}"`);
          }
          break;

        case 'POS':
          if (this.plotWindow.debugWindow && params.x !== undefined && params.y !== undefined) {
            this.plotWindow.debugWindow.setPosition(params.x, params.y);
            console.log(`[PLOT] Window position set to: ${params.x}, ${params.y}`);
          }
          break;

        case 'SIZE':
          if (this.plotWindow.debugWindow && params.width !== undefined && params.height !== undefined) {
            // Set window content size, not outer window size
            this.plotWindow.debugWindow.setContentSize(params.width, params.height);
            console.log(`[PLOT] Window size set to: ${params.width}x${params.height}`);
          }
          break;

        case 'DOTSIZE':
          if (params.dotSize !== undefined) {
            // Ensure displaySpec exists
            if (!this.plotWindow.displaySpec) {
              this.plotWindow.displaySpec = {};
            }
            this.plotWindow.displaySpec.dotSize = params.dotSize;
            console.log(`[PLOT] Dot size set to: ${params.dotSize}`);
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
            console.log(`[PLOT] Background color set to: ${backgroundColor} (brightness: ${params.brightness || 15})`);
          }
          break;

        case 'HIDEXY':
          if (params.hideXY !== undefined) {
            // Ensure displaySpec exists
            if (!this.plotWindow.displaySpec) {
              this.plotWindow.displaySpec = {};
            }
            this.plotWindow.displaySpec.hideXY = params.hideXY;
            console.log(`[PLOT] Coordinate display ${params.hideXY ? 'hidden' : 'shown'}`);
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
            console.log(`[PLOT] Update rate set to: ${params.updateRate} Hz (${updateInterval.toFixed(1)}ms interval)`);
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
   * Convert named color with brightness to hex color
   */
  private convertColorWithBrightness(colorName: string, brightness: number): string {
    const colorMap: Record<string, [number, number, number]> = {
      'BLACK': [0, 0, 0],
      'WHITE': [255, 255, 255],
      'RED': [255, 0, 0],
      'GREEN': [0, 255, 0],
      'BLUE': [0, 0, 255],
      'CYAN': [0, 255, 255],
      'MAGENTA': [255, 0, 255],
      'YELLOW': [255, 255, 0],
      'ORANGE': [255, 165, 0],
      'GRAY': [128, 128, 128],
      'GREY': [128, 128, 128]
    };

    const baseColor = colorMap[colorName.toUpperCase()];
    if (!baseColor) {
      return '#000000'; // Default to black for unknown colors
    }

    // Apply brightness scaling (0-15 range)
    const scale = brightness / 15;
    const r = Math.round(baseColor[0] * scale);
    const g = Math.round(baseColor[1] * scale);
    const b = Math.round(baseColor[2] * scale);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
    console.log('[INTEGRATOR] executeSetOrigin called with:', params);
    if (params.x !== undefined && params.y !== undefined) {
      // Update plot window's origin directly
      this.plotWindow.origin = { x: params.x, y: params.y };
      this.state.origin = { x: params.x, y: params.y };
      console.log('[INTEGRATOR] Origin set to:', this.plotWindow.origin);
    }
  }

  /**
   * Execute coordinate mode change (Cartesian/Polar)
   */
  private executeSetCoordinateMode(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeSetCoordinateMode called with:', params);
    if (params.mode === 'POLAR' && params.polarConfig) {
      // Set polar configuration AND switch to polar mode
      this.plotWindow.polarConfig = params.polarConfig;
      this.state.polarConfig = params.polarConfig;
      // Switch to polar coordinate mode
      this.plotWindow.coordinateMode = 1; // eCoordModes.CM_POLAR
      this.state.coordinateMode = 'POLAR';
      console.log('[INTEGRATOR] Switched to POLAR mode with config:', params.polarConfig);
    } else if (params.mode === 'CARTESIAN') {
      // Explicitly switch to Cartesian mode
      this.plotWindow.coordinateMode = 2; // eCoordModes.CM_CARTESIAN
      this.state.coordinateMode = 'CARTESIAN';
      console.log('[INTEGRATOR] Switched to Cartesian mode');
    }
  }

  private executeSetColorMode(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeSetColorMode called with:', params);
    if (params.mode !== undefined) {
      // Store color mode in plot window if it has such a property
      if (this.plotWindow.colorMode !== undefined) {
        this.plotWindow.colorMode = params.mode;
      }
      this.state.colorMode = params.mode;

      const modeNames = ['RGB', 'HSV', 'INDEXED', 'GRAYSCALE'];
      console.log(`[INTEGRATOR] Color mode set to: ${params.mode} (${modeNames[params.mode] || 'UNKNOWN'})`);
    }
  }

  private executeSetTextSize(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeSetTextSize called with:', params);
    if (params.textSize !== undefined) {
      // Store default text size for future TEXT commands
      if (this.plotWindow.defaultTextSize !== undefined) {
        this.plotWindow.defaultTextSize = params.textSize;
      }
      this.state.defaultTextSize = params.textSize;

      console.log(`[INTEGRATOR] Default text size set to: ${params.textSize}`);
    }
  }

  private executeSetTextStyle(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeSetTextStyle called with:', params);
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

      console.log(`[INTEGRATOR] Default text style set to: ${params.textStyle} (${styleDescription})`);
    }
  }

  private executeSetPrecision(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeSetPrecision called with:', params);

    // Implement Pascal's PRECISE behavior: vPrecise := vPrecise xor 8
    // Toggle between 0 (standard) and 8 (high precision)
    const currentPrecise = this.plotWindow.precise || 0;
    const newPrecise = currentPrecise ^ 8;  // XOR with 8

    // Update plot window state
    this.plotWindow.precise = newPrecise;
    this.state.precise = newPrecise;

    const precisionMode = newPrecise === 8 ? 'high precision (256ths of pixel)' : 'standard pixel coordinates';
    console.log(`[INTEGRATOR] Precision toggled: ${currentPrecise} -> ${newPrecise} (${precisionMode})`);
  }

  private async executePcInput(params: Record<string, any>): Promise<void> {
    console.log('[INTEGRATOR] executePcInput called with:', params);

    const inputType = params.inputType;

    if (inputType === 'KEY') {
      // Handle PC_KEY - get last pressed key and send back to P2
      const keyCode = await this.getLastPressedKey();
      console.log(`[INTEGRATOR] PC_KEY returning: ${keyCode}`);

      // Send response back to P2 via debug protocol
      this.sendInputResponseToP2('KEY', keyCode);

    } else if (inputType === 'MOUSE') {
      // Handle PC_MOUSE - get current mouse state and encode as 32-bit value
      const mouseState = await this.getCurrentMouseState();
      console.log(`[INTEGRATOR] PC_MOUSE returning: 0x${mouseState.toString(16).padStart(8, '0')}`);

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

      console.log(`[INTEGRATOR] Retrieved key from renderer: ${keyCode || 0}`);
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

      console.log(`[INTEGRATOR] Retrieved mouse state from renderer: 0x${(mouseState || 0).toString(16).padStart(8, '0')}`);
      return mouseState || 0;
    } catch (error) {
      console.error(`[INTEGRATOR] Failed to get mouse state from renderer:`, error);
      return 0; // No mouse state available
    }
  }

  private sendInputResponseToP2(inputType: string, value: number): void {
    // Send the input response back to P2 via the debug protocol
    // This needs to integrate with the existing debugger protocol system
    console.log(`[INTEGRATOR] Sending ${inputType} response to P2: ${value}`);

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
    console.log('[INTEGRATOR] executeDefineSprite called with:', params);

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

      // Validate color values are 24-bit RGB (0x000000-0xFFFFFF) with memory-safe checking
      for (let i = 0; i < colors.length; i++) {
        if (colors[i] < 0 || colors[i] > 0xFFFFFF) {
          this.logError(`[PLOT ERROR] Color value 0x${colors[i].toString(16)} at position ${i} out of bounds for SPRITEDEF ${spriteId} (valid range: 0x000000-0xFFFFFF)`);
          throw new Error(`Color value 0x${colors[i].toString(16)} at position ${i} out of bounds (0x000000-0xFFFFFF)`);
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

      console.log(`[INTEGRATOR] Sprite ${spriteId} defined: ${width}x${height} pixels, ${pixels.length} pixel indices, ${colors.length} palette colors`);

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
  private executeDrawSprite(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeDrawSprite called with:', params);

    try {
      if (!this.plotWindow.spriteManager) {
        throw new Error('Sprite manager not available in plot window');
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

      // Get current plot position (vPixelX, vPixelY from plot window state)
      const currentX = this.plotWindow.cursorPosition?.x || 0;
      const currentY = this.plotWindow.cursorPosition?.y || 0;

      // Create transformation matrix for rotation and scaling
      const transformMatrix = this.createTransformationMatrix(orientation, scale);

      // Render sprite with transformations at current position
      this.renderTransformedSprite(sprite, currentX, currentY, transformMatrix, opacity);

      console.log(`[INTEGRATOR] Sprite ${spriteId} rendered at current position (${currentX}, ${currentY}) with orientation=${orientation}°, scale=${scale}, opacity=${opacity}`);

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to draw sprite:`, error);
      throw error;
    }
  }

  /**
   * Create 2D transformation matrix for rotation and scaling
   */
  private createTransformationMatrix(orientationDegrees: number, scale: number): TransformationMatrix {
    // Convert degrees to radians
    const angleRad = (orientationDegrees * Math.PI) / 180;

    // Create transformation matrix combining rotation and scaling
    // Matrix format: [a, b, c, d, tx, ty] for affine transformation
    const cos = Math.cos(angleRad) * scale;
    const sin = Math.sin(angleRad) * scale;

    return {
      a: cos,    // x scaling/rotation component
      b: sin,    // x skewing component
      c: -sin,   // y skewing component
      d: cos,    // y scaling/rotation component
      tx: 0,     // x translation (will be set during rendering)
      ty: 0      // y translation (will be set during rendering)
    };
  }

  /**
   * Render sprite with transformations applied
   */
  private renderTransformedSprite(
    sprite: any,
    centerX: number,
    centerY: number,
    transform: TransformationMatrix,
    opacity: number
  ): void {
    try {
      // Get canvas context for direct pixel manipulation
      const canvas = this.plotWindow.canvasProcessor?.canvas;
      if (!canvas) {
        console.warn('[INTEGRATOR] No canvas available for sprite rendering');
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('[INTEGRATOR] No canvas context available for sprite rendering');
        return;
      }

      // Save current context state
      ctx.save();

      // Set global alpha for opacity
      ctx.globalAlpha = opacity / 255;

      // Apply coordinate system transformations (CARTESIAN/POLAR, axis directions)
      const screenCoords = this.transformToScreenCoordinates(centerX, centerY);

      // Set transformation matrix for rotation and scaling
      ctx.setTransform(
        transform.a,  // m11: horizontal scaling / rotation
        transform.b,  // m12: horizontal skewing
        transform.c,  // m21: vertical skewing
        transform.d,  // m22: vertical scaling / rotation
        screenCoords.x, // dx: horizontal translation
        screenCoords.y  // dy: vertical translation
      );

      // Render sprite pixels using the palette
      this.renderSpritePixels(ctx, sprite, transform);

      // Restore context state
      ctx.restore();

    } catch (error) {
      console.error('[INTEGRATOR] Error during sprite rendering:', error);
      throw error;
    }
  }

  /**
   * Render individual sprite pixels with color palette lookup
   */
  private renderSpritePixels(ctx: CanvasRenderingContext2D, sprite: any, transform: TransformationMatrix): void {
    const { width, height, pixels, colors } = sprite;

    // Calculate sprite center offset for proper rotation around center
    const centerOffsetX = -width / 2;
    const centerOffsetY = -height / 2;

    // Render each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        const colorIndex = pixels[pixelIndex];

        // Skip transparent pixels (color index 0 is typically transparent)
        if (colorIndex === 0) continue;

        // Get color from palette
        const color = colors[colorIndex] || 0x000000;
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;

        // Set pixel color
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

        // Draw pixel at transformed position (relative to sprite center)
        ctx.fillRect(
          centerOffsetX + x,
          centerOffsetY + y,
          1, 1
        );
      }
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
    console.log('[INTEGRATOR] executeLoadLayer called with:', params);

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
            if (!this.plotWindow.layerManager.layers) {
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

        console.log(`[INTEGRATOR] Layer ${layerIndex} loaded from "${filename}" (${bitmapData.width}x${bitmapData.height})`);

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

      console.log(`[INTEGRATOR] BMP file loaded: ${filename} (${bitmapData.width}x${bitmapData.height})`);

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
  private executeCropLayer(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeCropLayer called with:', params);

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

      // Get layer data
      let layerData: any;
      if (this.plotWindow.layerManager.layers && this.plotWindow.layerManager.layers[internalLayerIndex]) {
        layerData = this.plotWindow.layerManager.layers[internalLayerIndex];
      } else if (this.plotWindow.layerManager.getLayer) {
        layerData = this.plotWindow.layerManager.getLayer(internalLayerIndex);
      } else {
        throw new Error(`Layer ${layerIndex} not loaded`);
      }

      if (!layerData || !layerData.data) {
        throw new Error(`Layer ${layerIndex} contains no bitmap data`);
      }

      // Handle different crop modes
      if (mode === 'AUTO') {
        this.executeCropAuto(layerData, params);
      } else {
        this.executeCropExplicit(layerData, params);
      }

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to crop layer:`, error);
      throw error;
    }
  }

  /**
   * Execute AUTO crop mode - automatically determine source rectangle
   */
  private executeCropAuto(layerData: any, params: Record<string, any>): void {
    const { destX, destY } = params;

    // For AUTO mode, copy the entire layer to the destination position
    // This matches Pascal's behavior where AUTO determines the source automatically
    const sourceRect = {
      left: 0,
      top: 0,
      width: layerData.width || layerData.data.width,
      height: layerData.height || layerData.data.height
    };

    this.copyLayerToCanvas(layerData, sourceRect, destX, destY);

    console.log(`[INTEGRATOR] CROP AUTO: copied entire layer (${sourceRect.width}x${sourceRect.height}) to (${destX}, ${destY})`);
  }

  /**
   * Execute explicit crop mode - use specified source rectangle
   */
  private executeCropExplicit(layerData: any, params: Record<string, any>): void {
    const { left, top, width, height, destX, destY } = params;

    // Validate source rectangle bounds
    const layerWidth = layerData.width || layerData.data.width;
    const layerHeight = layerData.height || layerData.data.height;

    if (left < 0 || top < 0 || left + width > layerWidth || top + height > layerHeight) {
      throw new Error(`Source rectangle (${left},${top}) ${width}x${height} exceeds layer bounds ${layerWidth}x${layerHeight}`);
    }

    const sourceRect = { left, top, width, height };
    this.copyLayerToCanvas(layerData, sourceRect, destX, destY);

    console.log(`[INTEGRATOR] CROP EXPLICIT: copied (${left},${top}) ${width}x${height} to (${destX}, ${destY})`);
  }

  /**
   * Copy rectangular region from layer bitmap to canvas
   */
  private copyLayerToCanvas(
    layerData: any,
    sourceRect: { left: number; top: number; width: number; height: number },
    destX: number,
    destY: number
  ): void {
    try {
      // Get canvas context
      const canvas = this.plotWindow.canvasProcessor?.canvas;
      if (!canvas) {
        throw new Error('No canvas available for layer copying');
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No canvas context available for layer copying');
      }

      // Get bitmap data
      const bitmapData = layerData.data;
      const layerWidth = bitmapData.width;
      const layerHeight = bitmapData.height;

      // Apply coordinate system transformations
      const screenCoords = this.transformToScreenCoordinates(destX, destY);

      // Create ImageData for the source rectangle
      const imageData = ctx.createImageData(sourceRect.width, sourceRect.height);
      const data = imageData.data;

      // Copy pixels from bitmap to ImageData
      for (let y = 0; y < sourceRect.height; y++) {
        for (let x = 0; x < sourceRect.width; x++) {
          const srcX = sourceRect.left + x;
          const srcY = sourceRect.top + y;

          // Bounds checking
          if (srcX >= 0 && srcX < layerWidth && srcY >= 0 && srcY < layerHeight) {
            const srcIndex = srcY * layerWidth + srcX;
            const destIndex = (y * sourceRect.width + x) * 4;

            // Get RGB from bitmap data
            const rgb = bitmapData.pixels[srcIndex];
            const r = (rgb >> 16) & 0xFF;
            const g = (rgb >> 8) & 0xFF;
            const b = rgb & 0xFF;

            // Set RGBA in ImageData
            data[destIndex] = r;     // Red
            data[destIndex + 1] = g; // Green
            data[destIndex + 2] = b; // Blue
            data[destIndex + 3] = 255; // Alpha (fully opaque)
          }
        }
      }

      // Draw ImageData to canvas
      ctx.putImageData(imageData, screenCoords.x, screenCoords.y);

    } catch (error) {
      console.error('[INTEGRATOR] Error during layer copying:', error);
      throw error;
    }
  }

  /**
   * Execute LUT_SET operation - sets single palette entry for indexed color mode
   */
  private executeLutSet(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeLutSet called with:', params);

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

      console.log(`[INTEGRATOR] LUT palette[${index}] set to 0x${color.toString(16).padStart(6, '0')}`);

    } catch (error) {
      console.error('[INTEGRATOR] Error during LUT_SET operation:', error);
      throw error;
    }
  }

  /**
   * Execute LUT_COLORS operation - loads multiple RGB24 color values into consecutive palette entries
   */
  private executeLutColors(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeLutColors called with:', params);

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

      console.log(`[INTEGRATOR] LUTCOLORS loaded ${loadedCount} colors into palette`);

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
        if (operation.parameters.size) {
          this.state.lineSize = operation.parameters.size;
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
          console.log('[INTEGRATOR] Precision state updated in internal state');
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
        case 'PC_INPUT':
          plotType = CanvasOperationType.PC_INPUT;
          break;
        case 'CLEAR_CANVAS':
          plotType = CanvasOperationType.CLEAR_CANVAS;
          break;
        case 'UPDATE_DISPLAY':
          plotType = CanvasOperationType.UPDATE_DISPLAY;
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
      console.log('[INTEGRATOR BATCH] Processing operation:', operation.type, (operation as any).parameters);

      if ('affectsState' in operation) {
        // Already a PlotCanvasOperation
        plotOperation = operation as PlotCanvasOperation;
      } else {
        // Convert CanvasOperation to PlotCanvasOperation
        plotOperation = this.convertFromCanvasOperation(operation as CanvasOperation);
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
      console.log(`[INTEGRATOR] Cleared ${operationCount} deferred operations during cleanup`);
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
        console.log(`[INTEGRATOR] Cleaned up failed sprite operation for sprite ${spriteId}`);
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
          console.log(`[INTEGRATOR] Cleaned up failed layer operation for layer ${layerIndex} ("${filename}")`);
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

      console.log('[INTEGRATOR] Emergency cleanup completed');
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