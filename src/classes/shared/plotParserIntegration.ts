/** @format */

/**
 * Integration Design for PLOT Parser with Existing Systems
 * Defines how new parser connects to canvas rendering, state management, and window controls
 */

import { CommandResult, CanvasOperation } from './plotCommandInterfaces';

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
  precise: number;
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

  // Interactive input
  PC_INPUT = 'PC_INPUT',

  // Window operations
  CONFIGURE_WINDOW = 'CONFIGURE_WINDOW',
  CLEAR_CANVAS = 'CLEAR_CANVAS',
  UPDATE_DISPLAY = 'UPDATE_DISPLAY',

  // Layer operations
  LOAD_LAYER = 'LOAD_LAYER',
  CROP_LAYER = 'CROP_LAYER',

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
          this.executeDraw('DOT', operation.parameters);
          break;

        case CanvasOperationType.DRAW_LINE:
          this.executeDraw('LINE', operation.parameters);
          break;

        case CanvasOperationType.DRAW_CIRCLE:
          this.executeDraw('CIRCLE', operation.parameters);
          break;

        case CanvasOperationType.DRAW_BOX:
          this.executeDraw('BOX', operation.parameters);
          break;

        case CanvasOperationType.DRAW_OVAL:
          this.executeDraw('OVAL', operation.parameters);
          break;

        case CanvasOperationType.DRAW_TEXT:
          this.executeDrawText(operation.parameters);
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
          this.executeClearCanvas();
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
  private executeDraw(command: string, params: Record<string, any>): void {
    switch (command) {
      case 'DOT':
        // DOT is drawn as a small filled circle
        const dotSize = this.plotWindow.displaySpec?.dotSize || 1;
        this.plotWindow.drawCircleToPlot(dotSize, 0, params.opacity ?? 255);
        break;

      case 'LINE':
        this.plotWindow.drawLineToPlot(
          params.x ?? 0,
          params.y ?? 0,
          params.lineSize ?? 1,
          params.opacity ?? 255
        );
        break;

      case 'CIRCLE':
        // Note: lineSize of 0 means filled circle, preserve that!
        console.log('[INTEGRATOR] Drawing CIRCLE with params:', {
          diameter: params.diameter || 10,
          lineSize: params.lineSize ?? 0,
          opacity: params.opacity ?? 255,
          originalLineSize: params.lineSize
        });
        this.plotWindow.drawCircleToPlot(
          params.diameter || 10,
          params.lineSize ?? 0,  // Use ?? to preserve 0 for filled circles
          params.opacity ?? 255
        );
        break;

      case 'BOX':
      case 'OVAL':
        // TODO: Implement box and oval drawing
        console.log(`[INTEGRATOR] ${command} not yet implemented with params:`, params);
        break;

      default:
        console.log(`[INTEGRATOR] Unknown draw command: ${command}`);
    }
  }

  /**
   * Execute text drawing with font setup
   */
  private executeDrawText(params: Record<string, any>): void {
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
      this.plotWindow.writeStringToPlot(params.text);
    }
  }

  /**
   * Execute cursor position change
   */
  private executeSetCursor(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeSetCursor called with:', params);
    if (params.x !== undefined && params.y !== undefined) {
      let x = params.x;
      let y = params.y;

      // Check if we're in polar mode and convert coordinates
      if (this.plotWindow.coordinateMode === 1) { // eCoordModes.CM_POLAR
        // Convert polar (radius, angle) to cartesian (x, y)
        const radius = params.x;
        const angle = params.y;
        const polarResult = this.polarToCartesian(radius, angle);
        x = polarResult[0];
        y = polarResult[1];
        console.log(`[INTEGRATOR] Polar to Cartesian: (${radius}, ${angle}) -> (${x}, ${y})`);
      }

      // Set cursor position
      this.plotWindow.cursorPosition.x = x;
      this.plotWindow.cursorPosition.y = y;
      this.state.cursorPosition = { x, y };
      console.log('[INTEGRATOR] Cursor set to:', this.plotWindow.cursorPosition);
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
  private executeClearCanvas(): void {
    this.plotWindow.clearPlot();
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
        throw new Error('Sprite manager not available in plot window');
      }

      const { spriteId, width, height, pixelData } = params;

      // Parse hex pixel data into color values
      // For now, we'll create a simple parsing - this should be enhanced
      // to handle various formats (hex, binary, etc.)
      const pixels = this.parsePixelData(pixelData, width * height);

      // Create a basic 256-color palette (for now, use a default palette)
      const colors = this.createDefaultPalette();

      // Define the sprite using the sprite manager
      this.plotWindow.spriteManager.defineSprite(spriteId, width, height, pixels, colors);

      console.log(`[INTEGRATOR] Sprite ${spriteId} defined: ${width}x${height} pixels`);

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to define sprite:`, error);
      throw error;
    }
  }

  /**
   * Execute sprite drawing - render sprite at specified position
   */
  private executeDrawSprite(params: Record<string, any>): void {
    console.log('[INTEGRATOR] executeDrawSprite called with:', params);

    try {
      if (!this.plotWindow.spriteManager) {
        throw new Error('Sprite manager not available in plot window');
      }

      const { spriteId, x, y, opacity } = params;

      // Get the sprite definition
      const sprite = this.plotWindow.spriteManager.getSprite(spriteId);
      if (!sprite) {
        throw new Error(`Sprite ${spriteId} not defined`);
      }

      // For now, delegate to the plot window to handle actual rendering
      // This would integrate with the existing canvas rendering system
      if (this.plotWindow.drawSprite) {
        this.plotWindow.drawSprite(spriteId, x, y, opacity);
      } else {
        // Fallback: create a simple rectangle representation
        console.warn(`[INTEGRATOR] Sprite rendering not fully implemented, drawing placeholder`);
        this.plotWindow.drawRectangleToPlot(sprite.width, sprite.height, 1, opacity || 255);
      }

      console.log(`[INTEGRATOR] Sprite ${spriteId} drawn at (${x}, ${y}) with opacity ${opacity}`);

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to draw sprite:`, error);
      throw error;
    }
  }

  /**
   * Execute layer loading - load bitmap file into layer manager
   */
  private async executeLoadLayer(params: Record<string, any>): Promise<void> {
    console.log('[INTEGRATOR] executeLoadLayer called with:', params);

    try {
      if (!this.plotWindow.layerManager) {
        throw new Error('Layer manager not available in plot window');
      }

      const { filename } = params;

      // Find next available layer slot (0-7)
      let layerIndex = 0;
      for (let i = 0; i < 8; i++) {
        if (!this.plotWindow.layerManager.hasLayer || !this.plotWindow.layerManager.hasLayer(i)) {
          layerIndex = i;
          break;
        }
      }

      // Load the bitmap file
      // The LayerManager expects the file to be in the working directory
      await this.plotWindow.layerManager.loadLayer(layerIndex, filename);

      console.log(`[INTEGRATOR] Layer ${layerIndex} loaded from "${filename}"`);

    } catch (error) {
      // Log specific error messages for debugging
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        console.error(`[PLOT PARSE ERROR] Bitmap file not found: ${params.filename}`);
      } else if (error.message.includes('Invalid file extension')) {
        console.error(`[PLOT PARSE ERROR] Invalid file extension, expected .bmp: ${params.filename}`);
      } else {
        console.error(`[PLOT PARSE ERROR] Failed to load bitmap file: ${params.filename} - ${error.message}`);
      }
      throw error;
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

      const { left, top, width, height, x, y } = params;

      // Find the most recently loaded layer (simple approach)
      let sourceLayerIndex = -1;
      for (let i = 7; i >= 0; i--) {
        if (this.plotWindow.layerManager.hasLayer && this.plotWindow.layerManager.hasLayer(i)) {
          sourceLayerIndex = i;
          break;
        }
      }

      if (sourceLayerIndex === -1) {
        throw new Error('No layer loaded for CROP operation');
      }

      // Execute the crop operation
      if (this.plotWindow.layerManager.cropLayer) {
        this.plotWindow.layerManager.cropLayer(sourceLayerIndex, { left, top, width, height }, x, y);
      } else {
        // Fallback implementation
        console.warn(`[INTEGRATOR] Layer cropping not fully implemented, logging operation`);
      }

      console.log(`[INTEGRATOR] Cropped (${left},${top}) ${width}x${height} from layer ${sourceLayerIndex} to (${x},${y})`);

    } catch (error) {
      console.error(`[INTEGRATOR] Failed to crop layer:`, error);
      throw error;
    }
  }

  /**
   * Parse pixel data from various formats (hex, binary, etc.)
   */
  private parsePixelData(pixelData: string, expectedLength: number): number[] {
    const pixels: number[] = [];

    if (pixelData.startsWith('$')) {
      // Hex format: $FF00FF00...
      const hexData = pixelData.substring(1);
      for (let i = 0; i < hexData.length && pixels.length < expectedLength; i += 2) {
        const hex = hexData.substring(i, i + 2);
        const value = parseInt(hex, 16);
        if (!isNaN(value)) {
          pixels.push(value);
        }
      }
    } else if (pixelData.startsWith('%')) {
      // Binary format: %10101010...
      const binData = pixelData.substring(1);
      for (let i = 0; i < binData.length && pixels.length < expectedLength; i += 8) {
        const bin = binData.substring(i, i + 8);
        const value = parseInt(bin, 2);
        if (!isNaN(value)) {
          pixels.push(value);
        }
      }
    } else {
      // Assume hex without prefix
      for (let i = 0; i < pixelData.length && pixels.length < expectedLength; i += 2) {
        const hex = pixelData.substring(i, i + 2);
        const value = parseInt(hex, 16);
        if (!isNaN(value)) {
          pixels.push(value);
        }
      }
    }

    // Pad with zeros if not enough data
    while (pixels.length < expectedLength) {
      pixels.push(0);
    }

    return pixels.slice(0, expectedLength);
  }

  /**
   * Create a default 256-color palette
   */
  private createDefaultPalette(): number[] {
    const palette: number[] = [];

    // Create a simple palette: grayscale + some basic colors
    for (let i = 0; i < 256; i++) {
      if (i < 16) {
        // Basic colors (0-15)
        const colors = [
          0x000000, 0xFF0000, 0x00FF00, 0x0000FF, // Black, Red, Green, Blue
          0xFFFF00, 0xFF00FF, 0x00FFFF, 0xFFFFFF, // Yellow, Magenta, Cyan, White
          0x800000, 0x008000, 0x000080, 0x808000, // Dark Red, Dark Green, Dark Blue, Olive
          0x800080, 0x008080, 0x808080, 0xC0C0C0  // Purple, Teal, Gray, Silver
        ];
        palette.push(colors[i] || 0x000000);
      } else {
        // Grayscale ramp (16-255)
        const gray = Math.floor((i - 16) * 255 / (255 - 16));
        palette.push((gray << 16) | (gray << 8) | gray);
      }
    }

    return palette;
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
      CanvasOperationType.SET_TEXTSTYLE
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
      CanvasOperationType.SET_TEXTSTYLE
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