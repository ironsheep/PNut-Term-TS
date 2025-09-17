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

  // State changes
  SET_CURSOR = 'SET_CURSOR',
  SET_ORIGIN = 'SET_ORIGIN',
  SET_COLOR = 'SET_COLOR',
  SET_LINESIZE = 'SET_LINESIZE',
  SET_OPACITY = 'SET_OPACITY',
  SET_TEXTANGLE = 'SET_TEXTANGLE',
  SET_COORDINATE_MODE = 'SET_COORDINATE_MODE',

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
      shouldWriteToCanvas: this.plotWindow.shouldWriteToCanvas
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
  executeOperation(operation: PlotCanvasOperation): CommandResult {
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
    // Handle CLOSE action first
    if (params.action === 'CLOSE') {
      // Close the window using the proper method - matches other window implementations
      this.plotWindow.closeDebugWindow();
      return;
    }

    // Handle SAVE action
    if (params.action === 'SAVE') {
      // Save window to bitmap file using the same method as other debug windows
      if (params.filename) {
        this.plotWindow.saveWindowToBMPFilename(params.filename);
      } else {
        console.error('[PLOT] SAVE action missing filename parameter');
      }
      return;
    }

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
      // Set update rate for display refresh
      this.state.updateMode = params.updateRate > 0;
    }
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
      CanvasOperationType.SET_COORDINATE_MODE
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
  executeBatch(operations: CanvasOperation[] | PlotCanvasOperation[]): CommandResult[] {
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

      const result = this.executeOperation(plotOperation);
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

  deferOperation(operation: PlotCanvasOperation): void {
    if (operation.deferrable) {
      this.deferredOperations.push(operation);
    } else {
      this.executeOperation(operation);
    }
  }

  flushDeferredOperations(): CommandResult[] {
    const results = this.executeBatch(this.deferredOperations);
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
      CanvasOperationType.SET_COORDINATE_MODE
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