/** @format */

// src/classes/shared/debuggerRenderer.ts

import {
  COGDebugState,
  LAYOUT_CONSTANTS,
  PASCAL_LAYOUT_CONSTANTS,
  PASCAL_COLOR_SCHEME,
  DEBUG_COLORS,
  SFR_NAMES,
  EVENT_NAMES,
  MODE_NAMES,
  MEMORY_CONSTANTS,
  getHeatColor,
  getRegisterHeatColor,
  blendColors,
  MemoryBlock
} from './debuggerConstants';
import { DebuggerDataManager } from './debuggerDataManager';
import { Disassembler } from './disassembler';

/**
 * Hardcoded disassembly text for ROM debug entry/exit at $1F8-$1FF
 * Reference: Pascal DebuggerUnit.pas Section 11.5
 */
const ROM_DEBUG_STRINGS: Record<number, string> = {
  0x1F8: "[ROM] setq    #$F     'DEBUG Entry",
  0x1F9: '[ROM] wrlong  0,#$FFF80-cog<<7',
  0x1FA: '[ROM] setq    #$F',
  0x1FB: '[ROM] rdlong  0,#$FFFC0-cog<<7',
  0x1FC: '[ROM] jmp     #\\0',
  0x1FD: "[ROM] setq    #$F     'DEBUG Exit",
  0x1FE: '[ROM] rdlong  0,#$FFF80-cog<<7',
  0x1FF: '[ROM] reti0'
};

/**
 * Layout regions for the debugger UI
 * Based on Pascal's 123x77 character grid layout
 */
interface LayoutRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

/**
 * Button definition for interactive controls
 */
interface DebugButton {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  command: string;
  active: boolean;
}

/**
 * DebuggerRenderer - Renders the complex debugger UI on a 123x77 character grid
 * 
 * This class manages the visual presentation of the P2 debugger, implementing
 * Pascal's exact layout with all UI regions, heat maps, and interactive elements.
 * 
 * Layout Structure (123 columns x 77 rows):
 * - Top (rows 0-19): COG/LUT register maps with heat visualization
 * - Middle (rows 20-35): 16-line disassembly window
 * - Bottom left (rows 36-76): Register watch, stack, events, pointers
 * - Bottom right (rows 36-76): HUB memory viewer with mini-map
 * - Control buttons: BREAK, ADDR, INT1/2/3, DEBUG, INIT, EVENT, MAIN, GO
 * 
 * Reference: DEBUGGER_IMPLEMENTATION.md lines 143-180
 */
export class DebuggerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dataManager: DebuggerDataManager;
  private cogId: number;
  private disassembler: Disassembler;
  private windowId: string; // Unique ID for window coordination
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private eventListeners: Map<string, (...args: any[]) => void> = new Map();
  
  // Grid dimensions
  private readonly GRID_WIDTH = LAYOUT_CONSTANTS.GRID_WIDTH;
  private readonly GRID_HEIGHT = LAYOUT_CONSTANTS.GRID_HEIGHT;
  private readonly CHAR_WIDTH = 8;
  private readonly CHAR_HEIGHT = 16;   // Full character height
  private readonly HALF_ROW = 8;       // Half-row height (charHeight/2) — grid Y unit
  
  // Layout regions
  private regions: Map<string, LayoutRegion>;
  private buttons: Map<string, DebugButton>;
  
  // Rendering state
  private dirtyRegions: Set<string> = new Set();
  private tooltipText: string = '';
  private tooltipX: number = 0;
  private tooltipY: number = 0;
  private hoveredButton: string | null = null;
  private selectedAddress: number = -1;

  // Base template (Pascal: Bitmap[2] — static elements drawn once)
  private baseTemplate: OffscreenCanvas | null = null;
  private baseTemplateRendered: boolean = false;

  // Break control state (Pascal: BreakValue, BreakAddr, BreakEvent)
  // BreakValue bits: 0=MAIN, 1=INT1, 2=INT2, 3=INT3, 4=DEBUG, 5=INT1E, 6=INT2E, 7=INT3E
  //                  8=INIT, 9=EVENT, 10=ADDR, 12-31=address/event data
  private breakValue: number = 0;
  private breakAddr: number = 0;
  private breakEvent: number = 0;  // 0-15 for CT1..QMT
  private repeatMode: boolean = false;

  // Command callback for sending commands to protocol
  private onCommand: ((command: string, data?: any) => void) | null = null;

  // Performance tracking
  private lastRenderTime: number = 0;
  private renderCount: number = 0;

  // Mouse region tracking (Pascal: InXXX booleans)
  private mouseRegion: string | null = null;
  private mouseX: number = 0;
  private mouseY: number = 0;

  // Disassembly mode (Pascal: DisMode, CogAddr, HubAddr, DisAddr)
  private disMode: 'pc' | 'cog' | 'hub' = 'pc';
  private cogAddr: number = 0;
  private disAddr: number = 0;

  // Auto-scroll state (Pascal: DisScrollCounter, DisLineIdeal, DisScrollThreshold)
  private disScrollCounter: number = 0;    // Consecutive breaks without PC jump
  private disTopAddr: number = 0;          // Address of top visible line
  private lastPC: number = -1;            // PC from previous break (for jump detection)
  private readonly DIS_LINE_IDEAL = 3;     // Target line for PC (4th from top, 0-indexed)
  private readonly DIS_SCROLL_THRESHOLD = 8; // Breaks before auto-scroll kicks in
  private readonly DIS_LINES = 16;         // Number of disassembly lines

  // Navigation history for back/forward
  private addressHistory: number[] = [];
  private historyIndex: number = -1;
  private readonly MAX_HISTORY = 50;

  // Font and colors
  private font: string = '14px "Parallax", monospace';
  private bgColor: number = DEBUG_COLORS.BG_DEFAULT;
  private fgColor: number = DEBUG_COLORS.FG_DEFAULT;

  constructor(
    canvas: HTMLCanvasElement,
    dataManager: DebuggerDataManager,
    cogId: number
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    this.dataManager = dataManager;
    this.cogId = cogId;
    this.disassembler = new Disassembler();
    
    // Initialize layout
    this.regions = this.initializeLayout();
    this.buttons = this.initializeButtons();
    
    // Set canvas size
    this.canvas.width = this.GRID_WIDTH * this.CHAR_WIDTH;
    this.canvas.height = this.GRID_HEIGHT * this.HALF_ROW; // 77 half-rows × 8px = 616px
    
    // Set up font
    this.ctx.font = this.font;
    this.ctx.textBaseline = 'top';

    // Generate unique window ID and register for coordination
    this.windowId = `debugger-${cogId}-${Date.now()}`;
    this.dataManager.registerWindow(this.cogId, this.windowId);

    // Set up coordination event handlers
    this.setupCoordinationHandlers();

    // Initial full render
    this.markAllDirty();
  }

  /**
   * Set up event handlers for window coordination
   */
  private setupCoordinationHandlers(): void {
    // Handle synchronization requests
    const syncHandler = (data: { cogId: number }) => {
      if (data.cogId === this.cogId) {
        this.markAllDirty();
        this.render();
      }
    };
    this.eventListeners.set('synchronizeWindow', syncHandler);
    this.dataManager.on('synchronizeWindow', syncHandler);

    // Handle COG state updates
    const stateHandler = (data: { cogId: number }) => {
      if (data.cogId === this.cogId) {
        this.markAllDirty();
        this.render();
      }
    };
    this.eventListeners.set('cogStateUpdated', stateHandler);
    this.dataManager.on('cogStateUpdated', stateHandler);

    // Handle breakpoint events for other COGs (update multi-COG indicator)
    const breakpointHandler = () => {
      // Update multi-COG indicator when any COG hits breakpoint
      this.dirtyRegions.add('flags');
    };
    this.eventListeners.set('breakpointHit', breakpointHandler);
    this.dataManager.on('breakpointHit', breakpointHandler);

    // Handle COG activation/deactivation (update multi-COG indicator)
    const cogChangeHandler = () => {
      this.dirtyRegions.add('flags');
    };
    this.eventListeners.set('cogActivated', cogChangeHandler);
    this.eventListeners.set('cogDeactivated', cogChangeHandler);
    this.dataManager.on('cogActivated', cogChangeHandler);
    this.dataManager.on('cogDeactivated', cogChangeHandler);
  }

  /**
   * Initialize layout regions
   */
  private initializeLayout(): Map<string, LayoutRegion> {
    const regions = new Map<string, LayoutRegion>();
    
    // COG register map - Pascal: REGMAPl=2, REGMAPt=1
    regions.set('cogRegisters', {
      x: PASCAL_LAYOUT_CONSTANTS.REGMAP.l,
      y: PASCAL_LAYOUT_CONSTANTS.REGMAP.t,
      width: PASCAL_LAYOUT_CONSTANTS.REGMAP.w,
      height: PASCAL_LAYOUT_CONSTANTS.REGMAP.h,
      type: 'registers'
    });

    // LUT register map - Pascal: LUTMAPl=13, LUTMAPt=1
    regions.set('lutRegisters', {
      x: PASCAL_LAYOUT_CONSTANTS.LUTMAP.l,
      y: PASCAL_LAYOUT_CONSTANTS.LUTMAP.t,
      width: PASCAL_LAYOUT_CONSTANTS.LUTMAP.w,
      height: PASCAL_LAYOUT_CONSTANTS.LUTMAP.h,
      type: 'registers'
    });

    // Flags/status header row - spans multiple Pascal regions (CF, ZF, PC, SKIP, XBYTE, CT)
    regions.set('flags', {
      x: PASCAL_LAYOUT_CONSTANTS.CF.l,
      y: PASCAL_LAYOUT_CONSTANTS.CF.t,
      width: PASCAL_LAYOUT_CONSTANTS.CT.l + PASCAL_LAYOUT_CONSTANTS.CT.w - PASCAL_LAYOUT_CONSTANTS.CF.l,
      height: 2,
      type: 'flags'
    });
    
    // Disassembly window (middle) - Pascal: DISl=24, DISt=4
    regions.set('disassembly', {
      x: PASCAL_LAYOUT_CONSTANTS.DIS.l,
      y: PASCAL_LAYOUT_CONSTANTS.DIS.t,
      width: PASCAL_LAYOUT_CONSTANTS.DIS.w,
      height: PASCAL_LAYOUT_CONSTANTS.DIS.h,
      type: 'disassembly'
    });

    // Register watch - Pascal: WATCHl=82, WATCHt=4
    regions.set('registerWatch', {
      x: PASCAL_LAYOUT_CONSTANTS.WATCH.l,
      y: PASCAL_LAYOUT_CONSTANTS.WATCH.t,
      width: PASCAL_LAYOUT_CONSTANTS.WATCH.w,
      height: PASCAL_LAYOUT_CONSTANTS.WATCH.h,
      type: 'watch'
    });

    // Special Function Registers - Pascal: SFRl=96, SFRt=4
    regions.set('sfr', {
      x: PASCAL_LAYOUT_CONSTANTS.SFR.l,
      y: PASCAL_LAYOUT_CONSTANTS.SFR.t,
      width: PASCAL_LAYOUT_CONSTANTS.SFR.w,
      height: PASCAL_LAYOUT_CONSTANTS.SFR.h,
      type: 'sfr'
    });
    
    // Stack display - Pascal: STACKl=30, STACKt=37
    regions.set('stack', {
      x: PASCAL_LAYOUT_CONSTANTS.STACK.l,
      y: PASCAL_LAYOUT_CONSTANTS.STACK.t,
      width: PASCAL_LAYOUT_CONSTANTS.STACK.w,
      height: PASCAL_LAYOUT_CONSTANTS.STACK.h,
      type: 'stack'
    });

    // Execution state - Pascal: EXECl=24, EXECt=35
    regions.set('exec', {
      x: PASCAL_LAYOUT_CONSTANTS.EXEC.l,
      y: PASCAL_LAYOUT_CONSTANTS.EXEC.t,
      width: PASCAL_LAYOUT_CONSTANTS.EXEC.w,
      height: PASCAL_LAYOUT_CONSTANTS.EXEC.h,
      type: 'exec'
    });
    
    // Events - Pascal: EVENTl=116, EVENTt=4
    regions.set('events', {
      x: PASCAL_LAYOUT_CONSTANTS.EVENT.l,
      y: PASCAL_LAYOUT_CONSTANTS.EVENT.t,
      width: PASCAL_LAYOUT_CONSTANTS.EVENT.w,
      height: PASCAL_LAYOUT_CONSTANTS.EVENT.h,
      type: 'events'
    });

    // Interrupts - Pascal: INTl=24, INTt=40
    regions.set('interrupts', {
      x: PASCAL_LAYOUT_CONSTANTS.INT.l,
      y: PASCAL_LAYOUT_CONSTANTS.INT.t,
      width: PASCAL_LAYOUT_CONSTANTS.INT.w,
      height: PASCAL_LAYOUT_CONSTANTS.INT.h,
      type: 'interrupts'
    });

    // Pointers - Pascal: PTRl=39, PTRt=40
    regions.set('pointers', {
      x: PASCAL_LAYOUT_CONSTANTS.PTR.l,
      y: PASCAL_LAYOUT_CONSTANTS.PTR.t,
      width: PASCAL_LAYOUT_CONSTANTS.PTR.w,
      height: PASCAL_LAYOUT_CONSTANTS.PTR.h,
      type: 'pointers'
    });
    
    // Pin states - Pascal: PINl=32, PINt=47
    regions.set('pins', {
      x: PASCAL_LAYOUT_CONSTANTS.PIN.l,
      y: PASCAL_LAYOUT_CONSTANTS.PIN.t,
      width: PASCAL_LAYOUT_CONSTANTS.PIN.w,
      height: PASCAL_LAYOUT_CONSTANTS.PIN.h,
      type: 'pins'
    });

    // Status indicators - Pascal: STATUSl=24, STATUSt=47
    regions.set('status', {
      x: PASCAL_LAYOUT_CONSTANTS.STATUS.l,
      y: PASCAL_LAYOUT_CONSTANTS.STATUS.t,
      width: PASCAL_LAYOUT_CONSTANTS.STATUS.w,
      height: PASCAL_LAYOUT_CONSTANTS.STATUS.h,
      type: 'status'
    });

    // Smart pins - Pascal: SMARTl=24, SMARTt=54
    regions.set('smartPins', {
      x: PASCAL_LAYOUT_CONSTANTS.SMART.l,
      y: PASCAL_LAYOUT_CONSTANTS.SMART.t,
      width: PASCAL_LAYOUT_CONSTANTS.SMART.w,
      height: PASCAL_LAYOUT_CONSTANTS.SMART.h,
      type: 'smartPins'
    });

    // HUB memory viewer - Pascal: HUBl=24, HUBt=57
    regions.set('hubMemory', {
      x: PASCAL_LAYOUT_CONSTANTS.HUB.l,
      y: PASCAL_LAYOUT_CONSTANTS.HUB.t,
      width: 72, // HUB data area only (address + hex + ascii, not including mini-map)
      height: PASCAL_LAYOUT_CONSTANTS.HUB.h,
      type: 'hubMemory'
    });

    // HUB mini-map - Pascal: BoxBoundary(..., HUBl + 74, HUBt + 1, 22, HUBh - 2, 1)
    regions.set('hubMiniMap', {
      x: PASCAL_LAYOUT_CONSTANTS.HUB.l + 74, // 24 + 74 = 98
      y: PASCAL_LAYOUT_CONSTANTS.HUB.t + 1,  // 57 + 1 = 58
      width: 22,
      height: PASCAL_LAYOUT_CONSTANTS.HUB.h - 2, // 16 - 2 = 14
      type: 'hubMiniMap'
    });

    // Hint line - Pascal: HINTl=29, HINTt=74
    regions.set('hint', {
      x: PASCAL_LAYOUT_CONSTANTS.HINT.l,
      y: PASCAL_LAYOUT_CONSTANTS.HINT.t,
      width: PASCAL_LAYOUT_CONSTANTS.HINT.w,
      height: PASCAL_LAYOUT_CONSTANTS.HINT.h,
      type: 'hint'
    });
    
    // Control buttons area - Pascal: Bl=109, Bt=37
    regions.set('controls', {
      x: PASCAL_LAYOUT_CONSTANTS.B.l,
      y: PASCAL_LAYOUT_CONSTANTS.B.t,
      width: PASCAL_LAYOUT_CONSTANTS.B.w,
      height: PASCAL_LAYOUT_CONSTANTS.B.h,
      type: 'controls'
    });
    
    return regions;
  }

  /**
   * Initialize button controls
   * Pascal layout from DebuggerUnit.pas lines 137-149:
   * - Left column: BREAK, ADDR, →INT3, →INT2, →INT1, DEBUG (5 chars wide)
   * - Right column: INIT, EVENT, INT3, INT2, INT1, MAIN (4 chars wide)
   * - Bottom: GO button (10 chars wide)
   */
  private initializeButtons(): Map<string, DebugButton> {
    const buttons = new Map<string, DebugButton>();

    // Pascal: Bl=109, Bt=37
    const Bl = PASCAL_LAYOUT_CONSTANTS.B.l;
    const Bt = PASCAL_LAYOUT_CONSTANTS.B.t;
    const q1 = 0.25; // Quarter character
    const q3 = 0.75;

    // Left column buttons (5 chars wide, 2 rows tall)
    // BREAK button - Pascal: bBREAKl = Bl+q3, bBREAKt = Bt+q1, bBREAKw = 5
    buttons.set('BREAK', {
      x: Bl + 1, y: Bt, width: 5, height: 2,
      label: 'BREAK', command: 'break', active: false
    });

    // ADDR button - Pascal: bADDRl = Bl+q3, bADDRt = Bt+2+q1
    buttons.set('ADDR', {
      x: Bl + 1, y: Bt + 2, width: 5, height: 2,
      label: 'ADDR', command: 'addr', active: false
    });

    // →INT3 (INT3E) button - Pascal: bINT3El = Bl+q3, bINT3Et = Bt+4+q1
    buttons.set('INT3E', {
      x: Bl + 1, y: Bt + 4, width: 5, height: 2,
      label: '→INT3', command: 'int3e', active: false
    });

    // →INT2 (INT2E) button - Pascal: bINT2El = Bl+q3, bINT2Et = Bt+6+q1
    buttons.set('INT2E', {
      x: Bl + 1, y: Bt + 6, width: 5, height: 2,
      label: '→INT2', command: 'int2e', active: false
    });

    // →INT1 (INT1E) button - Pascal: bINT1El = Bl+q3, bINT1Et = Bt+8+q1
    buttons.set('INT1E', {
      x: Bl + 1, y: Bt + 8, width: 5, height: 2,
      label: '→INT1', command: 'int1e', active: false
    });

    // DEBUG button - Pascal: bDEBUGl = Bl+q3, bDEBUGt = Bt+10+q1
    buttons.set('DEBUG', {
      x: Bl + 1, y: Bt + 10, width: 5, height: 2,
      label: 'DEBUG', command: 'debug', active: false
    });

    // Right column buttons (4 chars wide, 2 rows tall)
    // INIT button - Pascal: bINITl = Bl+7+q1, bINITt = Bt+q1
    buttons.set('INIT', {
      x: Bl + 7, y: Bt, width: 4, height: 2,
      label: 'INIT', command: 'init', active: false
    });

    // EVENT button - Pascal: bEVENTl = Bl+7+q1, bEVENTt = Bt+2+q1
    buttons.set('EVENT', {
      x: Bl + 7, y: Bt + 2, width: 4, height: 2,
      label: 'EVENT', command: 'event', active: false
    });

    // INT3 button - Pascal: bINT3l = Bl+7+q1, bINT3t = Bt+4+q1
    buttons.set('INT3', {
      x: Bl + 7, y: Bt + 4, width: 4, height: 2,
      label: 'INT3', command: 'int3', active: false
    });

    // INT2 button - Pascal: bINT2l = Bl+7+q1, bINT2t = Bt+6+q1
    buttons.set('INT2', {
      x: Bl + 7, y: Bt + 6, width: 4, height: 2,
      label: 'INT2', command: 'int2', active: false
    });

    // INT1 button - Pascal: bINT1l = Bl+7+q1, bINT1t = Bt+8+q1
    buttons.set('INT1', {
      x: Bl + 7, y: Bt + 8, width: 4, height: 2,
      label: 'INT1', command: 'int1', active: false
    });

    // MAIN button - Pascal: bMAINl = Bl+7+q1, bMAINt = Bt+10+q1
    buttons.set('MAIN', {
      x: Bl + 7, y: Bt + 10, width: 4, height: 2,
      label: 'MAIN', command: 'main', active: false
    });

    // GO button - Pascal: bGOl = Bl+1, bGOt = Bt+13, bGOw = 10, bGOh = 2
    buttons.set('GO', {
      x: Bl + 1, y: Bt + 13, width: 10, height: 2,
      label: 'GO', command: 'go', active: false
    });

    return buttons;
  }

  /**
   * Mark all regions as dirty for full redraw
   */
  public markAllDirty(): void {
    for (const key of this.regions.keys()) {
      this.dirtyRegions.add(key);
    }
  }

  /**
   * Mark specific region as dirty
   */
  public markRegionDirty(regionName: string): void {
    this.dirtyRegions.add(regionName);
  }

  /**
   * Main render method - only renders dirty regions
   */
  /**
   * Render the static base template (Pascal: Bitmap[2]).
   * Drawn once at window creation with all static elements: box outlines, labels, panel borders.
   * Restored at the start of each breakpoint render to clear dynamic content.
   */
  private renderBaseTemplate(): void {
    // OffscreenCanvas may not be available in test environments (jsdom)
    if (typeof OffscreenCanvas === 'undefined') {
      this.baseTemplateRendered = true;
      return;
    }
    this.baseTemplate = new OffscreenCanvas(this.canvas.width, this.canvas.height);
    const baseCtx = this.baseTemplate.getContext('2d');
    if (!baseCtx) return;

    // Fill background
    baseCtx.fillStyle = this.colorToHex(PASCAL_COLOR_SCHEME.cBackground);
    baseCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw box outlines for all regions
    const boxRegions: Array<{ name: string; color: number }> = [
      { name: 'cogRegisters', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'lutRegisters', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'disassembly', color: PASCAL_COLOR_SCHEME.cBox2 },
      { name: 'registerWatch', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'sfr', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'events', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'stack', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'interrupts', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'pointers', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'status', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'pins', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'smartPins', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'hubMemory', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'hint', color: PASCAL_COLOR_SCHEME.cBox2 },
      { name: 'controls', color: PASCAL_COLOR_SCHEME.cBox },
      { name: 'ct', color: PASCAL_COLOR_SCHEME.cBox3 },
    ];

    for (const { name, color } of boxRegions) {
      const region = this.regions.get(name);
      if (region) {
        const x = region.x * this.CHAR_WIDTH;
        const y = region.y * this.HALF_ROW;
        const w = region.width * this.CHAR_WIDTH;
        const h = region.height * this.HALF_ROW;
        baseCtx.strokeStyle = this.colorToHex(color);
        baseCtx.lineWidth = 1;
        baseCtx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
    }

    this.baseTemplateRendered = true;
  }

  /**
   * Main render method.
   * Pascal: On each breakpoint:
   *   1. Restore from base template (static elements)
   *   2. Draw all dynamic content in the order from Section 5.8
   *   3. Copy to display
   */
  public render(): void {
    const startTime = performance.now();

    // Ensure base template is rendered
    if (!this.baseTemplateRendered) {
      this.renderBaseTemplate();
    }

    // Restore from base template if doing a full redraw
    if (this.baseTemplate && this.dirtyRegions.size > 5) {
      // Full breakpoint redraw — restore from base
      this.ctx.drawImage(this.baseTemplate, 0, 0);
    } else {
      // Partial update — just clear dirty regions
      for (const regionName of this.dirtyRegions) {
        const region = this.regions.get(regionName);
        if (region) {
          this.clearRegion(region);
        }
      }
    }

    // Draw dynamic content for dirty regions (Pascal Section 5.8 order)
    for (const regionName of this.dirtyRegions) {
      const region = this.regions.get(regionName);
      if (region) {
        this.renderRegion(regionName, region);
      }
    }

    // Render buttons (always on top)
    if (this.dirtyRegions.has('controls')) {
      this.renderButtons();
    }

    // Render tooltip if present
    if (this.tooltipText) {
      this.renderTooltip();
    }

    // Clear dirty flags
    this.dirtyRegions.clear();

    // Track performance
    const renderTime = performance.now() - startTime;
    this.lastRenderTime = renderTime;
    this.renderCount++;

    if (renderTime > 50) {
      console.warn(`Slow render: ${renderTime.toFixed(1)}ms`);
    }
  }

  /**
   * Clear a region
   */
  private clearRegion(region: LayoutRegion): void {
    const x = region.x * this.CHAR_WIDTH;
    const y = region.y * this.HALF_ROW;          // Y is in half-rows
    const width = region.width * this.CHAR_WIDTH;
    const height = region.height * this.HALF_ROW; // height is in half-rows
    
    this.ctx.fillStyle = this.colorToHex(this.bgColor);
    this.ctx.fillRect(x, y, width, height);
  }

  /**
   * Render a specific region
   */
  private renderRegion(name: string, region: LayoutRegion): void {
    switch (region.type) {
      case 'registers':
        if (name === 'cogRegisters') {
          this.renderCogRegisters(region);
        } else {
          this.renderLutRegisters(region);
        }
        break;
      case 'flags':
        this.renderFlags(region);
        break;
      case 'disassembly':
        this.renderDisassembly(region);
        break;
      case 'watch':
        this.renderRegisterWatch(region);
        break;
      case 'stack':
        this.renderStack(region);
        break;
      case 'events':
        this.renderEvents(region);
        break;
      case 'interrupts':
        this.renderInterrupts(region);
        break;
      case 'pointers':
        this.renderPointers(region);
        break;
      case 'pins':
        this.renderPins(region);
        break;
      case 'smartPins':
        this.renderSmartPins(region);
        break;
      case 'hubMemory':
        this.renderHubMemory(region);
        break;
      case 'hubMiniMap':
        this.renderHubMiniMap(region);
        break;
      case 'sfr':
        this.renderSFR(region);
        break;
      case 'status':
        this.renderStatus(region);
        break;
      case 'hint':
        this.renderHint(region);
        break;
      case 'exec':
        this.renderExec(region);
        break;
    }
  }

  /**
   * Render COG registers heat map bitmap visualization
   * Pascal: REGMAP at (2, 1), 9 chars wide, 75 rows tall
   * Shows all 512 COG registers ($000-$1FF) with heat coloring
   * Each row shows ~7 registers compressed into the display width
   *
   * Pascal algorithm from lines 1643-1673:
   * - Get per-address heat from CogImageHit[addr]
   * - If bit set: use cHighSame/cHighDiff, else cLowSame/cLowDiff
   * - BlendPixel blends between colors based on heat
   */
  /**
   * Render COG register heatmap bitmap.
   * Pascal Section 6.1: 32 pixels wide × 512 pixels tall bitmap.
   * Each row = one register ($000-$1FF), each column = one bit (MSB left, LSB right).
   * Color blends between same/diff colors based on CogImageHit[] heat value.
   * Hit=254 = just changed (bright), decays by 2 per break toward 0 (cold).
   * Rendered as ImageData then stretched to fill the region.
   */
  private renderCogRegisters(region: LayoutRegion): void {
    // Title
    this.drawText('REG', region.x + 3, region.y, PASCAL_COLOR_SCHEME.cName);

    // Build 32×512 pixel bitmap
    this.renderRegisterBitmap(region, 0, 512); // COG: $000-$1FF
  }

  /**
   * Count number of set bits in a 32-bit value
   */
  private countBits(n: number): number {
    n = n >>> 0; // Convert to unsigned
    let count = 0;
    while (n) {
      count += n & 1;
      n >>>= 1;
    }
    return count;
  }

  /**
   * Render LUT registers heat map bitmap visualization
   * Pascal: LUTMAP at (13, 1), 9 chars wide, 75 rows tall
   * Shows all 512 LUT registers ($200-$3FF) with heat coloring
   *
   * Pascal algorithm uses combined CogImageHit[0..$3FF] where LUT is $200-$3FF
   */
  /**
   * Render LUT register heatmap bitmap.
   * Same as COG but for addresses $200-$3FF.
   */
  private renderLutRegisters(region: LayoutRegion): void {
    this.drawText('LUT', region.x + 3, region.y, PASCAL_COLOR_SCHEME.cName);
    this.renderRegisterBitmap(region, 0x200, 512); // LUT: $200-$3FF
  }

  /**
   * Render a register heatmap bitmap for a range of addresses.
   * Pascal Section 6.1: 32 pixels wide × N rows tall.
   * Each row = one register, each column = one bit (MSB=left, LSB=right).
   * Color = blend(cSame, cDiff, heat) where Same/Diff depends on bit value.
   * Hit=254 = just changed, decays by HitDecayRate(2) per break.
   * Disassembly address range highlighted with shade=$40.
   * Rendered via canvas ImageData + drawImage with scaling.
   */
  private renderRegisterBitmap(region: LayoutRegion, baseAddr: number, count: number): void {
    const BMP_W = 32; // 32 bits per register
    const BMP_H = count; // One row per register

    // createImageData may not work in test environments (jsdom mock canvas)
    let imgData: ImageData;
    try {
      imgData = this.ctx.createImageData(BMP_W, BMP_H);
    } catch {
      return; // Skip bitmap rendering in test env
    }
    const pixels = imgData.data;

    for (let row = 0; row < count; row++) {
      const addr = baseAddr + row;
      const value = this.dataManager.getCogMemory(this.cogId, addr) || 0;
      const heat = this.dataManager.getCogLutHeat(addr);

      for (let col = 0; col < 32; col++) {
        // MSB on left: bit (31-col)
        const bitSet = ((value >>> (31 - col)) & 1) !== 0;
        const color = getRegisterHeatColor(bitSet, heat);

        const pixIdx = (row * BMP_W + col) * 4;
        pixels[pixIdx] = (color >> 16) & 0xFF;     // R
        pixels[pixIdx + 1] = (color >> 8) & 0xFF;  // G
        pixels[pixIdx + 2] = color & 0xFF;          // B
        pixels[pixIdx + 3] = 255;                    // A
      }
    }

    // Draw bitmap into the region area (scaled to fit)
    // Region starts at row+2 (below title), spans remaining height
    const destX = region.x * this.CHAR_WIDTH;
    const destY = (region.y + 2) * this.HALF_ROW;
    const destW = region.width * this.CHAR_WIDTH;
    const destH = (region.height - 2) * this.HALF_ROW;

    // Use a temporary canvas to scale the ImageData
    if (typeof OffscreenCanvas === 'undefined') return; // Not available in test env
    const tmpCanvas = new OffscreenCanvas(BMP_W, BMP_H);
    const tmpCtx = tmpCanvas.getContext('2d');
    if (tmpCtx) {
      tmpCtx.putImageData(imgData, 0, 0);
      // Stretch-draw the bitmap into the region (Pascal: StretchDraw)
      this.ctx.imageSmoothingEnabled = false; // Nearest-neighbor for crisp pixels
      this.ctx.drawImage(tmpCanvas, destX, destY, destW, destH);
      this.ctx.imageSmoothingEnabled = true;
    }
  }

  /**
   * Render header/status display
   * Matches Pascal DebuggerUnit.pas layout constants:
   * - CF at column 24, row 1
   * - ZF at column 29, row 1
   * - PC at column 34, row 1
   * - SKIP at column 44, row 1
   * - XBYTE at column 87, row 1
   * - CT at column 101, row 1
   */
  private renderFlags(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;

    const msg = state.lastMessage;
    const layout = PASCAL_LAYOUT_CONSTANTS;

    // Execution mode from breakCZ determines active interrupt level
    // Pascal: if mBRKCZ shr 2 and 3 = 3 then ExecMode := 1 else...
    const execMode =
      ((msg.breakCZ >>> 2) & 3) === 3
        ? 1
        : ((msg.breakCZ >>> 4) & 3) === 3
          ? 2
          : ((msg.breakCZ >>> 6) & 3) === 3
            ? 3
            : 0;

    // C flag — mIRET bit 31, displayed as '0' or '1'
    const cFlag = (msg.iret >>> 31) & 1;
    this.drawText('C', layout.CF.l, region.y, PASCAL_COLOR_SCHEME.cName);
    this.drawText(`${cFlag}`, layout.CF.l + 2, region.y, PASCAL_COLOR_SCHEME.cData);

    // Z flag — mIRET bit 30
    const zFlag = (msg.iret >>> 30) & 1;
    this.drawText('Z', layout.ZF.l, region.y, PASCAL_COLOR_SCHEME.cName);
    this.drawText(`${zFlag}`, layout.ZF.l + 2, region.y, PASCAL_COLOR_SCHEME.cData);

    // PC — mIRET AND $FFFFF (20-bit), 5 hex digits
    const pc = msg.iret & 0xFFFFF;
    this.drawText('PC', layout.PC.l, region.y, PASCAL_COLOR_SCHEME.cName);
    this.drawText(pc.toString(16).toUpperCase().padStart(5, '0'),
      layout.PC.l + 3, region.y, PASCAL_COLOR_SCHEME.cData);

    // SKIP/SKIPF — mBRKZ (32-bit pattern), label depends on mBRKC bit 27
    const skipfMode = ((msg.breakC >>> 27) & 1) === 0;
    const callDepth = (msg.breakC >>> 28) & 0xF;
    const skipActive = execMode === 0 && callDepth === 0;
    const skipLabel = skipfMode ? 'SKIPF' : 'SKIP';

    this.drawText(skipLabel, layout.SKIP.l, region.y, PASCAL_COLOR_SCHEME.cName);

    if (skipActive) {
      // Show 32 binary bits
      const skipBin = (msg.breakZ >>> 0).toString(2).padStart(32, '0');
      this.drawText(skipBin, layout.SKIP.l + 6, region.y, PASCAL_COLOR_SCHEME.cData);
    } else if (callDepth > 0) {
      this.drawText(`Suspended during CALL(${callDepth})`,
        layout.SKIP.l + 6, region.y, PASCAL_COLOR_SCHEME.cDataDim);
    } else {
      this.drawText('Suspended during MODE',
        layout.SKIP.l + 6, region.y, PASCAL_COLOR_SCHEME.cDataDim);
    }

    // XBYTE — mBRKC >> 16 AND $1FF (9-bit), displayed as 3 hex digits
    const xbyte = (msg.breakC >>> 16) & 0x1FF;
    const xbyteActive = ((msg.breakC >>> 25) & 1) !== 0;
    this.drawText('XBYTE', layout.XBYTE.l, region.y, PASCAL_COLOR_SCHEME.cName);
    this.drawText(xbyte.toString(16).toUpperCase().padStart(3, '0'),
      layout.XBYTE.l + 6, region.y, PASCAL_COLOR_SCHEME.cData);
    if (xbyteActive) {
      this.drawText('✓', layout.XBYTE.l + 10, region.y, PASCAL_COLOR_SCHEME.cIndicator);
    }

    // CT — 64-bit from mCTH2:mCTL2, 16 hex digits in two 8-digit groups
    this.drawText('CT', layout.CT.l, region.y, PASCAL_COLOR_SCHEME.cName);
    const ctHigh = msg.ctHigh.toString(16).toUpperCase().padStart(8, '0');
    const ctLow = msg.ctLow.toString(16).toUpperCase().padStart(8, '0');
    this.drawText(`${ctHigh} ${ctLow}`, layout.CT.l + 3, region.y, PASCAL_COLOR_SCHEME.cData);
  }

  /**
   * Render disassembly window with actual P2 instruction decoding
   */
  /**
   * Render disassembly view with auto-scroll algorithm.
   * Pascal: DebuggerUnit.pas Section 6.6
   *
   * Three modes:
   *   dmPC  — follow PC with auto-scroll (ideal line = 3, threshold = 8)
   *   dmCog — locked to cog/LUT address, user scroll
   *   dmHub — locked to hub address, user scroll
   *
   * Auto-scroll (dmPC):
   *   - Large jump (>8 cog, >32 hub): snap PC to ideal line
   *   - PC out of range: snap to edge
   *   - Otherwise: after 8 consecutive breaks, auto-scroll 1 line/break toward ideal
   *   - Scroll counter resets on Go/Repeat
   */
  private renderDisassembly(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state) return;

    const pc = state.programCounter;
    const isCogExec = pc < 0x400; // Cog/LUT execute vs hub execute
    const addrStep = isCogExec ? 1 : 4; // 1 register per line (cog) or 4 bytes (hub)

    // Update disassembler state
    this.disassembler.setProgramCounter(pc);
    this.disassembler.setSkipPattern(state.skipPattern);

    // ---- Determine top address based on disMode ----
    if (this.disMode === 'pc') {
      this.updateAutoScroll(pc, isCogExec, addrStep);
    }
    // For 'cog' and 'hub' modes, disTopAddr is set by user scrolling

    const startAddr = this.disTopAddr;

    // ---- Render 16 lines ----
    for (let i = 0; i < this.DIS_LINES; i++) {
      const addr = startAddr + i * addrStep;
      const lineY = region.y + 2 + i * 2; // 2 half-rows per line, offset by header

      // Format address
      let addrStr: string;
      if (isCogExec) {
        if (addr < 0x200) addrStr = `R-${(addr & 0x1FF).toString(16).padStart(3, '0')}`;
        else addrStr = `L-${(addr & 0x1FF).toString(16).padStart(3, '0')}`;
      } else {
        addrStr = addr.toString(16).padStart(5, '0');
      }

      // Get instruction value and disassembly text
      let rawHex: string;
      let disText: string;

      if (ROM_DEBUG_STRINGS[addr]) {
        // ROM debug entry/exit strings ($1F8-$1FF)
        rawHex = '        '; // No raw hex for ROM
        disText = ROM_DEBUG_STRINGS[addr];
      } else {
        const value = this.dataManager.getCogMemory(this.cogId, addr) || 0;
        rawHex = value.toString(16).padStart(8, '0').toUpperCase();
        const instruction = this.disassembler.decodeInstruction(addr, value);
        disText = this.disassembler.formatDisassemblyLine(instruction, false);
      }

      // Determine colors
      const isCurrent = addr === pc;
      let fgColor: number;
      let bgColor: number;

      if (isCurrent) {
        // PC line: inverse highlight (Pascal: rounded rect in cData, text in cBox2)
        bgColor = PASCAL_COLOR_SCHEME.cData;
        fgColor = PASCAL_COLOR_SCHEME.cBox2;
      } else {
        bgColor = PASCAL_COLOR_SCHEME.cBackground;
        fgColor = PASCAL_COLOR_SCHEME.cData;
      }

      // Check breakpoint markers
      const hasBreakpoint = this.dataManager.hasBreakpoint(this.cogId, addr);
      const isAddrBreakpoint = (this.breakValue & 0x400) !== 0 && this.breakAddr === addr;

      // Breakpoint marker column
      let bpMarker = ' ';
      let bpColor: number = PASCAL_COLOR_SCHEME.cDataDim;
      if (hasBreakpoint) {
        bpMarker = '●';
        bpColor = 0xFF0000;
      } else if (isAddrBreakpoint) {
        bpMarker = '◌';
        bpColor = PASCAL_COLOR_SCHEME.cName;
      }

      // Build complete line: marker + address + raw + disassembly
      const line = `${addrStr}  ${rawHex}  ${disText}`;
      const truncLine = line.length > region.width - 2 ? line.substring(0, region.width - 2) : line;

      // Draw
      this.drawText(bpMarker, region.x, lineY, bpColor, bgColor);
      this.drawText(truncLine, region.x + 1, lineY, fgColor, bgColor);

      // SKIP strikethrough (semi-transparent at opacity 160)
      // TODO: Implement when canvas overlay drawing is available
    }

    // Save lastPC for next break's jump detection
    this.lastPC = pc;
  }

  /**
   * Auto-scroll algorithm for dmPC mode.
   * Pascal: DebuggerUnit.pas disassembly auto-scroll logic.
   */
  private updateAutoScroll(pc: number, isCogExec: boolean, addrStep: number): void {
    const jumpThreshold = isCogExec ? 8 : 32; // instructions (cog) or bytes (hub)
    const idealAddr = pc - this.DIS_LINE_IDEAL * addrStep; // PC at line 3

    if (this.lastPC < 0) {
      // First break — snap to ideal
      this.disTopAddr = Math.max(0, idealAddr);
      this.disScrollCounter = 0;
      return;
    }

    const pcDelta = Math.abs(pc - this.lastPC);

    if (pcDelta > jumpThreshold * addrStep) {
      // Large jump — snap PC to ideal line
      this.disTopAddr = Math.max(0, idealAddr);
      this.disScrollCounter = 0;
      return;
    }

    // Check if PC is within visible range
    const topAddr = this.disTopAddr;
    const bottomAddr = topAddr + (this.DIS_LINES - 1) * addrStep;

    if (pc < topAddr) {
      // PC above visible — snap to top
      this.disTopAddr = pc;
      this.disScrollCounter = 0;
    } else if (pc > bottomAddr) {
      // PC below visible — snap to bottom
      this.disTopAddr = pc - (this.DIS_LINES - 1) * addrStep;
      this.disScrollCounter = 0;
    } else {
      // PC is visible — auto-scroll toward ideal after threshold
      this.disScrollCounter++;
      if (this.disScrollCounter >= this.DIS_SCROLL_THRESHOLD) {
        const currentLine = Math.floor((pc - topAddr) / addrStep);
        if (currentLine > this.DIS_LINE_IDEAL) {
          // PC is below ideal — scroll down (increase topAddr)
          this.disTopAddr += addrStep;
        } else if (currentLine < this.DIS_LINE_IDEAL) {
          // PC is above ideal — scroll up (decrease topAddr)
          this.disTopAddr = Math.max(0, this.disTopAddr - addrStep);
        }
      }
    }
  }

  /**
   * Reset disassembly scroll counter (called on Go/Repeat).
   * Pascal: DisScrollCounter resets when user resumes execution.
   */
  public resetDisScrollCounter(): void {
    this.disScrollCounter = 0;
  }

  /**
   * Render register watch area
   * Note: PTRA/PTRB come from message, other regs from COG memory
   */
  private renderRegisterWatch(region: LayoutRegion): void {
    this.drawText('Register Watch', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);

    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;

    const msg = state.lastMessage;
    // PTRA ($1F8) and PTRB ($1F9) from message
    this.drawText(`PTRA: ${msg.ptrA.toString(16).padStart(8, '0')}`,
      region.x + 1, region.y + 2, DEBUG_COLORS.FG_DEFAULT);
    this.drawText(`PTRB: ${msg.ptrB.toString(16).padStart(8, '0')}`,
      region.x + 1, region.y + 3, DEBUG_COLORS.FG_DEFAULT);
    // FIFO pointer from message
    this.drawText(`FPTR: ${msg.fifoPtr.toString(16).padStart(8, '0')}`,
      region.x + 1, region.y + 4, DEBUG_COLORS.FG_DEFAULT);
    // Program counter from message
    this.drawText(`PC:   ${msg.programCounter.toString(16).padStart(5, '0')}`,
      region.x + 1, region.y + 5, DEBUG_COLORS.FG_DEFAULT);
  }

  /**
   * Render Special Function Registers (SFR) display
   * Shows registers $1F0-$1FF with names and values
   * Pascal: DrawText(SFRl + 10, SFRt + i * 2, cData, [], IntToHex(CogImage[$1F0 + i], 8))
   */
  private renderSFR(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);

    // Draw the 16 SFR entries (addresses $1F0-$1FF)
    for (let i = 0; i < 16; i++) {
      const addr = 0x1F0 + i;
      const addrHex = addr.toString(16).toUpperCase();
      const regName = SFR_NAMES[i];

      // Get register value from COG memory
      // Note: COG memory is addressed in longs, $1F0 = 496 longs from start
      const value = state ? this.dataManager.getCogMemory(this.cogId, addr) || 0 : 0;
      const valueHex = value.toString(16).toUpperCase().padStart(8, '0');

      // Calculate row position (each register takes 2 rows in Pascal, we use 1)
      const row = region.y + i * 2;

      // Get heat color for changed registers
      const heat = state ? this.dataManager.getMemoryHeat('COG', this.cogId, addr) : 0;
      const valueColor = heat > 0 ? getHeatColor(heat) : DEBUG_COLORS.FG_DATA;

      // Draw: address (col 0), name (col 4), value (col 10)
      // Pascal: DrawText(SFRl, SFRt + i * 2, cData2, [fsBold], IntToHex($1F0 + i, 3))
      this.drawText(addrHex, region.x, row, PASCAL_COLOR_SCHEME.cData2);
      this.drawText(regName, region.x + 4, row, PASCAL_COLOR_SCHEME.cName);
      this.drawText(valueHex, region.x + 10, row, PASCAL_COLOR_SCHEME.cData);
    }
  }

  /**
   * Render stack display
   * Stack levels 0-7 are in the message at mSTK0-mSTK7
   * Pascal: for i := 0 to 7 do DrawText(STACKl + 6 + i * 9, STACKt, cData, [], IntToHex(mSTK0+i, 8))
   * Stack is displayed HORIZONTALLY in Pascal
   */
  private renderStack(region: LayoutRegion): void {
    // Pascal: DrawText(STACKl, STACKt, cName, [fsBold, fsItalic], 'STACK')
    this.drawText('STACK', region.x, region.y, DEBUG_COLORS.FG_LABEL);

    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;

    const msg = state.lastMessage;
    // Display all 8 stack levels horizontally
    // Pascal: DrawText(STACKl + 6 + i * 9, STACKt, cData, [], IntToHex(DebuggerMsg[mSTK0 + i], 8))
    for (let i = 0; i < 8 && i < msg.stack.length; i++) {
      const value = msg.stack[i];
      const valueHex = value.toString(16).toUpperCase().padStart(8, '0');
      // Each stack value is 8 chars + 1 space = 9 chars
      this.drawText(valueHex, region.x + 6 + i * 9, region.y, DEBUG_COLORS.FG_DATA);
    }
  }

  /**
   * Render execution state/mode display
   * Pascal: DrawText(EXECl, EXECt + 2, cData2, [], ModeName[ExecMode])
   */
  private renderExec(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;

    const msg = state.lastMessage;

    // Calculate execution mode from breakCZ
    // Pascal: if mBRKCZ shr 2 and 3 = 3 then ExecMode := 1 else...
    const execMode =
      ((msg.breakCZ >>> 2) & 3) === 3
        ? 1
        : ((msg.breakCZ >>> 4) & 3) === 3
          ? 2
          : ((msg.breakCZ >>> 6) & 3) === 3
            ? 3
            : 0;

    const modeName = MODE_NAMES[execMode];

    // Display execution mode
    this.drawText(modeName, region.x, region.y + 2, DEBUG_COLORS.FG_DATA);
  }

  /**
   * Render events area
   * Shows 16 event flags from mBRKC bits 0-15
   * Pascal: for i := 0 to 15 do DrawText(EVENTl + 4, EVENTt + i shl 1, cData, [], Chr(mBRKC shr i and 1 + Byte('0')))
   */
  private renderEvents(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);

    // Draw all 16 events with names and status
    for (let i = 0; i < 16; i++) {
      const eventName = EVENT_NAMES[i];
      const row = region.y + i * 2;

      // Get event status from mBRKC bits 0-15
      const eventActive = state?.lastMessage
        ? ((state.lastMessage.breakC >>> i) & 1) !== 0
        : false;
      const statusChar = eventActive ? '1' : '0';
      const statusColor = eventActive ? DEBUG_COLORS.FG_ACTIVE : DEBUG_COLORS.FG_DIM;

      // Draw event name and status
      // Pascal: DrawText(EVENTl, EVENTt + i * 2, cName, [fsBold, fsItalic], EventName[i])
      this.drawText(eventName, region.x, row, DEBUG_COLORS.FG_LABEL);
      // Pascal: DrawText(EVENTl + 4, EVENTt + i * 2, cData, [], Chr(mBRKC shr i and 1 + Byte('0')))
      this.drawText(statusChar, region.x + 4, row, statusColor);
    }
  }

  /**
   * Render interrupts area
   * IRET (interrupt return address) is actually the PC in mIRET
   */
  /**
   * Render interrupt status panel.
   * Pascal: Three levels INT1/INT2/INT3, each showing:
   *   - Event name (4-bit field from mBRKCZ: INT1 bits 11..8, INT2 bits 15..12, INT3 bits 19..16)
   *   - State (2-bit: INT1 bits 1..0, INT2 bits 3..2, INT3 bits 5..4)
   *     0 or 1 = 'idle' (or 'off' if event = 0), 2 = 'wait', 3 = 'busy'
   */
  private renderInterrupts(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;

    const msg = state.lastMessage;
    const brkcz = msg.breakCZ;

    const intLevels = [
      { label: 'INT1', eventShift: 8,  stateShift: 0 },
      { label: 'INT2', eventShift: 12, stateShift: 2 },
      { label: 'INT3', eventShift: 16, stateShift: 4 }
    ];

    for (let i = 0; i < 3; i++) {
      const level = intLevels[i];
      const row = region.y + i * 2;

      const eventIdx = (brkcz >>> level.eventShift) & 0xF;
      const stateVal = (brkcz >>> level.stateShift) & 3;
      const eventName = EVENT_NAMES[eventIdx] || '---';
      const stateName = stateVal === 3 ? 'busy' : stateVal === 2 ? 'wait' : eventIdx === 0 ? 'off' : 'idle';

      this.drawText(level.label, region.x, row, PASCAL_COLOR_SCHEME.cName);
      this.drawText(eventName, region.x + 5, row, PASCAL_COLOR_SCHEME.cData);
      this.drawText(stateName, region.x + 9, row, stateVal === 3 ? PASCAL_COLOR_SCHEME.cIndicator : PASCAL_COLOR_SCHEME.cData2);
    }
  }

  /**
   * Render pointers area
   * Shows memory at PTRA/PTRB locations
   */
  /**
   * Render pointer data display (FPTR, PTRA, PTRB).
   * Pascal Section 6.13: Three rows with prefix + 5-hex address + 14 bytes as hex and ASCII.
   * FPTR prefix is 'R' or 'W' based on bit 20 of mBRKCZ. Center byte (index 6) highlighted.
   * Data comes from Phase 3 hub read requests 1-3.
   */
  private renderPointers(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;

    const msg = state.lastMessage;
    const PTR_BYTES = LAYOUT_CONSTANTS.PTR_BYTES; // 14
    const PTR_CENTER = 6;

    // FPTR prefix: 'R' (read) or 'W' (write) based on bit 20 of mBRKCZ
    const fptrPrefix = ((msg.breakCZ >>> 20) & 1) ? 'W' : 'R';

    const pointers = [
      { prefix: fptrPrefix, addr: msg.fifoPtr, row: 0 },
      { prefix: 'PTRA', addr: msg.ptrA, row: 2 },
      { prefix: 'PTRB', addr: msg.ptrB, row: 4 }
    ];

    for (const ptr of pointers) {
      const row = region.y + ptr.row;
      const baseAddr = (ptr.addr - PTR_CENTER) & 0xFFFFF;

      // Prefix and address
      this.drawText(ptr.prefix, region.x, row, PASCAL_COLOR_SCHEME.cName);
      this.drawText(ptr.addr.toString(16).padStart(5, '0'), region.x + 5, row, PASCAL_COLOR_SCHEME.cData2);

      // 14 hex bytes
      let hexStr = '';
      let asciiStr = '';
      for (let i = 0; i < PTR_BYTES; i++) {
        const byteAddr = (baseAddr + i) & 0xFFFFF;
        const b = this.dataManager.getHubMemory(byteAddr) || 0;
        const byteVal = (b >>> 0) & 0xFF;
        hexStr += byteVal.toString(16).padStart(2, '0') + ' ';
        asciiStr += (byteVal >= 0x20 && byteVal <= 0x7E) ? String.fromCharCode(byteVal) : '.';
      }
      this.drawText(hexStr.trim(), region.x + 11, row, PASCAL_COLOR_SCHEME.cData);
      this.drawText(asciiStr, region.x + 11 + PTR_BYTES * 3, row, PASCAL_COLOR_SCHEME.cData2);
    }
  }

  /**
   * Render pin states
   * Pin registers come from COG memory Special Function Registers:
   * - DIRA = $1FE, DIRB = $1FF
   * - OUTA = $1FC, OUTB = $1FD
   * - INA = $1FA, INB = $1FB
   */
  /**
   * Render pin registers as 64-bit binary values.
   * Pascal Section 6.15: Three rows (DIR/OUT/IN), each showing 64 binary digits
   * split into two 32-bit halves with byte separators.
   * DIR = DIRB:DIRA ($1FB:$1FA), OUT = OUTB:OUTA ($1FD:$1FC), IN = INB:INA ($1FF:$1FE)
   */
  private renderPins(region: LayoutRegion): void {
    // SFR addresses: note Pascal order is DIRA=$1FA, DIRB=$1FB, etc.
    const dira = this.dataManager.getCogRegister(this.cogId, 0x1FA) || 0;
    const dirb = this.dataManager.getCogRegister(this.cogId, 0x1FB) || 0;
    const outa = this.dataManager.getCogRegister(this.cogId, 0x1FC) || 0;
    const outb = this.dataManager.getCogRegister(this.cogId, 0x1FD) || 0;
    const ina = this.dataManager.getCogRegister(this.cogId, 0x1FE) || 0;
    const inb = this.dataManager.getCogRegister(this.cogId, 0x1FF) || 0;

    const rows = [
      { label: 'DIR', valB: dirb, valA: dira },
      { label: 'OUT', valB: outb, valA: outa },
      { label: 'IN ', valB: inb, valA: ina }
    ];

    for (let r = 0; r < 3; r++) {
      const row = rows[r];
      const y = region.y + r * 2;

      // Label
      this.drawText(row.label, region.x, y, PASCAL_COLOR_SCHEME.cName);

      // 64 binary digits: B[31..0] A[31..0] with byte separators
      // Display MSB first (bit 31 on left), split by bytes with spaces
      let binStr = '';
      // Upper 32 bits (B register)
      for (let bit = 31; bit >= 0; bit--) {
        binStr += ((row.valB >>> bit) & 1).toString();
        if (bit > 0 && bit % 8 === 0) binStr += ' ';
      }
      binStr += '  '; // Double space between halves
      // Lower 32 bits (A register)
      for (let bit = 31; bit >= 0; bit--) {
        binStr += ((row.valA >>> bit) & 1).toString();
        if (bit > 0 && bit % 8 === 0) binStr += ' ';
      }

      this.drawText(binStr, region.x + 5, y, PASCAL_COLOR_SCHEME.cData);
    }
  }

  /**
   * Render smart pins display
   * Pascal: Shows RQPIN label and active smart pin values
   * Format: RQPIN△ P00 12345678 P01 ABCDEF00 ...
   */
  private renderSmartPins(region: LayoutRegion): void {
    // RQPIN label with delta indicator
    this.drawText('RQPIN', region.x, region.y, DEBUG_COLORS.FG_LABEL);
    this.drawText('△', region.x + 6, region.y, DEBUG_COLORS.FG_LABEL); // Delta symbol

    // Get smart pin data from data manager
    const smartPinData = this.dataManager.getSmartPinData(this.cogId);
    if (!smartPinData) return;

    // Display active smart pins (those with DIR bit set in DIRA/DIRB)
    // Get DIRA and DIRB from COG memory
    const dira = this.dataManager.getCogRegister(this.cogId, 0x1FE) || 0;
    const dirb = this.dataManager.getCogRegister(this.cogId, 0x1FF) || 0;

    let displayIndex = 0;
    const maxDisplay = Math.floor((region.width - 8) / 14); // Each pin takes ~14 chars

    for (let pin = 0; pin < 64 && displayIndex < maxDisplay; pin++) {
      // Check if pin has DIR bit set (smart pin enabled)
      const dirBit = pin < 32
        ? ((dira >>> pin) & 1)
        : ((dirb >>> (pin - 32)) & 1);

      if (dirBit) {
        const pinValue = smartPinData[pin] || 0;
        const pinLabel = 'P' + pin.toString().padStart(2, '0');
        const pinHex = pinValue.toString(16).toUpperCase().padStart(8, '0');

        const x = region.x + 8 + displayIndex * 14;
        // Pin label in green (cData2)
        this.drawText(pinLabel, x, region.y, 0x007F00);
        // Pin value in white (cData)
        this.drawText(pinHex, x + 4, region.y, DEBUG_COLORS.FG_DATA);

        displayIndex++;
      }
    }

    // If no active pins, show placeholder
    if (displayIndex === 0) {
      this.drawText('(no active smart pins)', region.x + 8, region.y, DEBUG_COLORS.FG_DIM);
    }
  }

  /**
   * Render status indicators (INIT, STALLI, STR, MOD, LUTS)
   * Pascal: checks bits in mBRKCZ and mBRKC to display indicators
   */
  private renderStatus(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;

    const msg = state.lastMessage;
    const breakCZ = msg.breakCZ;
    const breakC = msg.breakC;

    // Quarter character positions for sub-character alignment
    const q1 = 0.25;
    const q3 = 0.75;

    // Five status indicators — highlighted in cIndicator when active, dimmed when inactive
    // Pascal: cIndicator=$FF7F00 (bright orange), cDataDim=$0F0F00 (dimmed)
    const on = PASCAL_COLOR_SCHEME.cIndicator;
    const off = PASCAL_COLOR_SCHEME.cDataDim;

    // INIT - bit 23 of mBRKCZ
    this.drawText('INIT', region.x, region.y, ((breakCZ >>> 23) & 1) ? on : off);
    // STALLI - bit 1 of mBRKCZ
    this.drawText('STALLI', region.x, region.y + 2, ((breakCZ >>> 1) & 1) ? on : off);
    // STR - bit 21 of mBRKCZ
    this.drawText('STR', region.x, region.y + 4, ((breakCZ >>> 21) & 1) ? on : off);
    // MOD - bit 22 of mBRKCZ
    this.drawText('MOD', region.x + 4, region.y + 4, ((breakCZ >>> 22) & 1) ? on : off);
    // LUTS - bit 26 of mBRKC
    this.drawText('LUTS', region.x, region.y + 5, ((breakC >>> 26) & 1) ? on : off);
  }

  /**
   * Render hint line (help text at bottom)
   * Pascal keyboard shortcuts from DebuggerUnit.pas lines 1044-1087 plus additions
   */
  /**
   * Render context-sensitive hint bar.
   * Pascal Section 6.19: Shows information about whatever the mouse is hovering over.
   * Content varies by region (disassembly, registers, events, buttons, CT, hub data, etc.)
   */
  private renderHint(region: LayoutRegion): void {
    const hint = this.getContextHint();
    this.drawText(hint, region.x, region.y,
      hint.length > 0 ? PASCAL_COLOR_SCHEME.cData : PASCAL_COLOR_SCHEME.cDataDim);
  }

  /**
   * Generate context-sensitive hint text based on current mouse position.
   * Pascal: MouseWithin tests cursor against each region.
   */
  private getContextHint(): string {
    if (!this.mouseRegion) return '';

    const state = this.dataManager.getCogState(this.cogId);
    const msg = state?.lastMessage;

    switch (this.mouseRegion) {
      case 'cogRegisters':
      case 'lutRegisters': {
        // Register address and value
        const addr = this.mouseRegion === 'cogRegisters' ? this.mouseY : 0x200 + this.mouseY;
        const val = this.dataManager.getCogMemory(this.cogId, addr) || 0;
        return `Register $${addr.toString(16).padStart(3, '0')} = $${val.toString(16).padStart(8, '0').toUpperCase()}`;
      }
      case 'events': {
        const eventIdx = Math.floor(this.mouseY / 2);
        if (eventIdx >= 0 && eventIdx < 16) {
          return `Event ${EVENT_NAMES[eventIdx]} (${eventIdx})`;
        }
        return '';
      }
      case 'ct':
        if (msg && msg.freq > 0) {
          const ct = (msg.ctHigh * 0x100000000 + msg.ctLow) / msg.freq;
          return `Elapsed: ${ct.toFixed(6)} seconds at ${(msg.freq / 1e6).toFixed(1)} MHz`;
        }
        return '';
      case 'controls':
        return this.hoveredButton ? `Break condition: ${this.hoveredButton}` : '';
      case 'disassembly':
        return `Disassembly ${this.disMode === 'pc' ? '(follow PC)' : this.disMode === 'cog' ? '(cog locked)' : '(hub locked)'}`;
      case 'hubMemory':
        return `Hub address: $${(this.selectedAddress >= 0 ? this.selectedAddress : 0).toString(16).padStart(5, '0').toUpperCase()}`;
      default:
        return '';
    }
  }

  /**
   * Render HUB memory viewer
   * Pascal: 8 rows of 16 bytes each
   * Format: address (5 hex) + 16 bytes (2 hex each) + ASCII (16 chars)
   * Pascal: DrawText(HUBl, HUBt + j * 2, cData, [], IntToHex(addr, 5))
   *         DrawText(HUBl + 6 + k * 3, HUBt + j * 2, cData2, [], IntToHex(byte, 2))
   *         DrawText(HUBl + 55 + k, HUBt + j * 2, cData2, [], Chr(byte))
   */
  private renderHubMemory(region: LayoutRegion): void {
    // HUB label at bottom - Pascal: DrawText(HUBl, HUBt + HUBh + 1, cName, 'HUB')
    this.drawText('HUB', region.x, region.y + region.height + 1, DEBUG_COLORS.FG_LABEL);

    // Get base address from selected address or hub window address
    const baseAddr = (this.selectedAddress >= 0 ? this.selectedAddress : 0) & 0xFFFFF;

    // Display 8 rows of 16 bytes each (128 bytes total = HubSubBlockSize)
    const rowCount = Math.min(8, Math.floor((region.height - 1) / 2));

    for (let row = 0; row < rowCount; row++) {
      const rowAddr = (baseAddr + row * 16) & 0xFFFFF;
      const rowY = region.y + row * 2;

      // Address column (5 hex digits)
      this.drawText(
        rowAddr.toString(16).toUpperCase().padStart(5, '0'),
        region.x, rowY, PASCAL_COLOR_SCHEME.cData
      );

      // 16 hex byte values (space-separated, split 8+8 with extra gap)
      for (let col = 0; col < 16; col++) {
        const byteAddr = rowAddr + col;
        const byteValue = this.dataManager.getHubMemory(byteAddr) || 0;
        const byteHex = (byteValue & 0xFF).toString(16).toUpperCase().padStart(2, '0');

        // Offset: 6 + col*3, with extra space after col 7 for 8+8 split
        const xOff = col < 8 ? col * 3 : col * 3 + 1;
        this.drawText(byteHex, region.x + 6 + xOff, rowY, PASCAL_COLOR_SCHEME.cData2);
      }

      // ASCII representation (16 chars)
      for (let col = 0; col < 16; col++) {
        const byteAddr = rowAddr + col;
        const byteValue = this.dataManager.getHubMemory(byteAddr) || 0;
        const asciiChar = (byteValue >= 0x20 && byteValue <= 0x7E) ? String.fromCharCode(byteValue) : '.';
        this.drawText(asciiChar, region.x + 56 + col, rowY, PASCAL_COLOR_SCHEME.cData2);
      }
    }
  }

  /**
   * Render HUB mini-map showing entire HUB memory as condensed heat visualization
   * Pascal: 64x62 pixel bitmap (3968 sub-blocks) stretched to fit display area
   * Each sub-block represents 128 bytes of HUB memory
   * Heat shows recently changed areas (brighter = more recent changes)
   */
  private renderHubMiniMap(region: LayoutRegion): void {
    const constants = MEMORY_CONSTANTS;
    const mapWidth = region.width;  // 22 chars available
    const mapHeight = region.height; // 14 rows available

    // Pascal mini-map: 64 columns x 62 rows = 3968 sub-blocks
    // We need to scale 64x62 into 22x14
    // Each display cell represents multiple sub-blocks

    const subBlocksPerCol = Math.ceil(constants.HUB_MAP_WIDTH / mapWidth);  // 64/22 ≈ 3
    const subBlocksPerRow = Math.ceil(constants.HUB_MAP_HEIGHT / mapHeight); // 62/14 ≈ 5

    for (let row = 0; row < mapHeight; row++) {
      for (let col = 0; col < mapWidth; col++) {
        // Calculate which sub-blocks this cell represents
        const srcStartCol = Math.floor(col * constants.HUB_MAP_WIDTH / mapWidth);
        const srcEndCol = Math.floor((col + 1) * constants.HUB_MAP_WIDTH / mapWidth);
        const srcStartRow = Math.floor(row * constants.HUB_MAP_HEIGHT / mapHeight);
        const srcEndRow = Math.floor((row + 1) * constants.HUB_MAP_HEIGHT / mapHeight);

        // Aggregate heat from all sub-blocks in this cell
        let maxHeat = 0;
        let totalHeat = 0;
        let count = 0;

        for (let srcRow = srcStartRow; srcRow < srcEndRow; srcRow++) {
          for (let srcCol = srcStartCol; srcCol < srcEndCol; srcCol++) {
            const subBlockIndex = srcRow * constants.HUB_MAP_WIDTH + srcCol;
            if (subBlockIndex < constants.HUB_SUB_BLOCKS) {
              const heat = this.dataManager.getHubSubBlockHeat(subBlockIndex);
              maxHeat = Math.max(maxHeat, heat);
              totalHeat += heat;
              count++;
            }
          }
        }

        // Use max heat for brighter display (or average for smoother look)
        const displayHeat = maxHeat; // or: count > 0 ? Math.floor(totalHeat / count) : 0

        // Determine display character based on heat level
        // Pascal uses smooth color gradient; we use block chars
        let char: string;
        if (displayHeat === 0) char = '·';       // Empty/cold
        else if (displayHeat < 64) char = '░';   // Light
        else if (displayHeat < 128) char = '▒';  // Medium
        else if (displayHeat < 192) char = '▓';  // Heavy
        else char = '█';                          // Hot

        // Color from cDataDim (0x0F0F00) to cYellow (0xFFFF00) based on heat
        // Pascal: BlendPixel(p, cDataDim, cYellow, h, $00)
        let color: number;
        if (displayHeat === 0) {
          color = PASCAL_COLOR_SCHEME.cDataDim; // 0x0F0F00
        } else if (displayHeat < 64) {
          color = 0x3F3F00; // cYellow3
        } else if (displayHeat < 128) {
          color = 0x7F7F00; // cYellow2
        } else if (displayHeat < 192) {
          color = 0xBFBF00; // Intermediate
        } else {
          color = PASCAL_COLOR_SCHEME.cName; // 0xFFFF00 - cYellow
        }

        this.drawText(char, region.x + col, region.y + row, color);
      }
    }

    // Draw border box around mini-map
    this.drawBox(region.x - 1, region.y - 1, region.width + 2, region.height + 2,
      PASCAL_COLOR_SCHEME.cBox);

    // Show current HUB address marker if selected
    if (this.selectedAddress >= 0) {
      // Calculate which cell the selected address falls in
      const subBlockIndex = Math.floor(this.selectedAddress / constants.HUB_SUB_BLOCK_SIZE);
      if (subBlockIndex < constants.HUB_SUB_BLOCKS) {
        const srcRow = Math.floor(subBlockIndex / constants.HUB_MAP_WIDTH);
        const srcCol = subBlockIndex % constants.HUB_MAP_WIDTH;

        // Map to display coordinates
        const displayCol = Math.floor(srcCol * mapWidth / constants.HUB_MAP_WIDTH);
        const displayRow = Math.floor(srcRow * mapHeight / constants.HUB_MAP_HEIGHT);

        // Draw marker
        this.drawText('▪', region.x + displayCol, region.y + displayRow, DEBUG_COLORS.FG_ACTIVE);
      }
    }
  }

  /**
   * Render button controls
   */
  private renderButtons(): void {
    for (const [name, button] of this.buttons) {
      this.renderButton(button, name === this.hoveredButton);
    }
  }

  /**
   * Render a single button
   */
  /**
   * Render a single button with Pascal color scheme.
   * Pascal: Mode buttons use cModeButton/cModeButtonDim, GO uses cCmdButton/cCmdButtonDim.
   * Active conditions are highlighted; inactive are dimmed.
   */
  private renderButton(button: DebugButton, hovered: boolean): void {
    const isGoButton = button.command === 'go';
    let bgColor: number;
    let fgColor: number;

    if (isGoButton) {
      // GO button: cCmdButton (active/hovered) or cCmdButtonDim (inactive)
      bgColor = button.active || hovered ? PASCAL_COLOR_SCHEME.cCmdButton : PASCAL_COLOR_SCHEME.cCmdButtonDim;
      fgColor = button.active || hovered ? PASCAL_COLOR_SCHEME.cCmdText : PASCAL_COLOR_SCHEME.cCmdTextDim;
    } else {
      // Mode/condition buttons: cModeButton (active) or cModeButtonDim (inactive)
      bgColor = button.active ? PASCAL_COLOR_SCHEME.cModeButton : PASCAL_COLOR_SCHEME.cModeButtonDim;
      fgColor = button.active ? PASCAL_COLOR_SCHEME.cModeText : PASCAL_COLOR_SCHEME.cModeTextDim;
    }

    // Draw button filled background
    const px = button.x * this.CHAR_WIDTH;
    const py = button.y * this.HALF_ROW;
    const pw = button.width * this.CHAR_WIDTH;
    const ph = button.height * this.HALF_ROW;
    this.ctx.fillStyle = this.colorToHex(bgColor);
    this.ctx.fillRect(px, py, pw, ph);

    // Draw button label (centered)
    const labelX = button.x + Math.floor((button.width - button.label.length) / 2);
    const labelY = button.y + Math.floor(button.height / 2);
    this.drawText(button.label, labelX, labelY, fgColor);
  }

  /**
   * Render tooltip
   */
  private renderTooltip(): void {
    if (!this.tooltipText) return;
    
    const bgColor = DEBUG_COLORS.BG_CHANGED;
    const fgColor = DEBUG_COLORS.FG_DEFAULT;
    
    // Calculate tooltip size
    const width = this.tooltipText.length + 2;
    const height = 3;
    
    // Ensure tooltip stays on screen
    let x = this.tooltipX;
    let y = this.tooltipY + 1;
    
    if (x + width > this.GRID_WIDTH) {
      x = this.GRID_WIDTH - width;
    }
    if (y + height > this.GRID_HEIGHT) {
      y = this.tooltipY - height;
    }
    
    // Draw tooltip background
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.drawChar(' ', x + dx, y + dy, fgColor, bgColor);
      }
    }
    
    // Draw tooltip text
    this.drawText(this.tooltipText, x + 1, y + 1, fgColor, bgColor);
  }

  // Utility methods

  /**
   * Draw text at grid position
   */
  private drawText(text: string, gridX: number, gridY: number, 
                   fgColor: number, bgColor: number = DEBUG_COLORS.BG_DEFAULT): void {
    const x = gridX * this.CHAR_WIDTH;
    const y = gridY * this.HALF_ROW;  // Y is in half-rows

    // Draw background (full character height for text readability)
    if (bgColor !== DEBUG_COLORS.BG_DEFAULT) {
      this.ctx.fillStyle = this.colorToHex(bgColor);
      this.ctx.fillRect(x, y, text.length * this.CHAR_WIDTH, this.CHAR_HEIGHT);
    }
    
    // Draw text
    this.ctx.fillStyle = this.colorToHex(fgColor);
    this.ctx.fillText(text, x, y);
  }

  /**
   * Draw single character
   */
  private drawChar(char: string, gridX: number, gridY: number,
                  fgColor: number, bgColor: number = DEBUG_COLORS.BG_DEFAULT): void {
    this.drawText(char, gridX, gridY, fgColor, bgColor);
  }

  /**
   * Draw a box
   */
  private drawBox(x: number, y: number, width: number, height: number, color: number): void {
    // Top and bottom
    for (let i = 0; i < width; i++) {
      this.drawChar('─', x + i, y, color);
      this.drawChar('─', x + i, y + height - 1, color);
    }
    
    // Left and right
    for (let i = 0; i < height; i++) {
      this.drawChar('│', x, y + i, color);
      this.drawChar('│', x + width - 1, y + i, color);
    }
    
    // Corners
    this.drawChar('┌', x, y, color);
    this.drawChar('┐', x + width - 1, y, color);
    this.drawChar('└', x, y + height - 1, color);
    this.drawChar('┘', x + width - 1, y + height - 1, color);
  }

  /**
   * Convert color number to hex string
   */
  private colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
  }

  // Public methods for interaction

  /**
   * Handle mouse move for tooltips and region detection
   * Pascal FormMouseMove from DebuggerUnit.pas lines 632-701
   */
  public handleMouseMove(gridX: number, gridY: number): void {
    // Record mouse position
    this.mouseX = gridX;
    this.mouseY = gridY;

    // Clear previous region
    this.mouseRegion = null;
    let hint = '';

    // Check if over a button
    let overButton: string | null = null;
    for (const [name, button] of this.buttons) {
      if (gridX >= button.x && gridX < button.x + button.width &&
          gridY >= button.y && gridY < button.y + button.height) {
        overButton = name;
        this.mouseRegion = `button_${name}`;
        hint = this.getButtonHint(name);
        break;
      }
    }

    if (overButton !== this.hoveredButton) {
      this.hoveredButton = overButton;
      this.markRegionDirty('controls');
    }

    // If not over a button, check other regions
    if (!overButton) {
      for (const [name, region] of this.regions) {
        if (this.isPointInRegion(gridX, gridY, region)) {
          this.mouseRegion = name;
          hint = this.getRegionHint(name, gridX, gridY, region);
          break;
        }
      }
    }

    // Update tooltip
    if (hint) {
      this.setTooltip(hint, gridX, gridY);
    } else {
      this.clearTooltip();
    }
  }

  /**
   * Check if a point is within a region
   */
  private isPointInRegion(x: number, y: number, region: LayoutRegion): boolean {
    return x >= region.x && x < region.x + region.width &&
           y >= region.y && y < region.y + region.height;
  }

  /**
   * Get button hint text
   * Pascal button hints from FormMouseMove lines 674-686
   */
  private getButtonHint(buttonName: string): string {
    switch (buttonName) {
      case 'BREAK': return 'Click or <B> to select asynchronous BREAK';
      case 'ADDR': return 'L-Click to break on PC address | R-Click to toggle';
      case 'INT3E': return 'L-Click to break on INT3 entry | R-Click to toggle';
      case 'INT2E': return 'L-Click to break on INT2 entry | R-Click to toggle';
      case 'INT1E': return 'L-Click to break on INT1 entry | R-Click to toggle';
      case 'DEBUG': return 'L-Click to break on DEBUG | R-Click or <D> to toggle';
      case 'INIT': return 'L-Click to break on COGINIT | R-Click or <I> to toggle';
      case 'EVENT': return 'L-Click to break on event | R-Click to toggle';
      case 'INT3': return 'L-Click to break on INT3 instructions | R-Click to toggle';
      case 'INT2': return 'L-Click to break on INT2 instructions | R-Click to toggle';
      case 'INT1': return 'L-Click to break on INT1 instructions | R-Click to toggle';
      case 'MAIN': return 'L-Click to break on MAIN instructions | R-Click or <M> to toggle';
      case 'GO': return 'L-Click or SPACE to step | R-Click or ENTER for repeat';
      default: return '';
    }
  }

  /**
   * Get region hint text
   * Pascal region hints from FormMouseMove lines 639-672
   */
  private getRegionHint(regionName: string, gridX: number, gridY: number, region: LayoutRegion): string {
    switch (regionName) {
      case 'cogRegisters': return 'COG Register Bitmap/Heatmap | Click to lock disassembly';
      case 'lutRegisters': return 'LUT Register Bitmap/Heatmap | Click to lock disassembly';
      case 'flags': return 'C/Z Flags, PC, SKIP pattern';
      case 'disassembly': return 'L-Click to lock to PC | R-Click to toggle break address | Wheel scrolls';
      case 'registerWatch': return 'Register-Delta Watch List | Click or <R> to reset';
      case 'sfr': return 'Special-Function Registers';
      case 'stack': return 'Stack Registers (top..bottom)';
      case 'events': {
        // Calculate which event the mouse is over
        const eventRow = Math.floor((gridY - region.y) / 2);
        if (eventRow >= 0 && eventRow < 16) {
          const eventName = EVENT_NAMES[eventRow];
          return `L-Click to break on ${eventName} event | R-Click to toggle`;
        }
        return 'Event Flags';
      }
      case 'interrupts': return 'Interrupt Status';
      case 'pointers': return 'Pointers and Data';
      case 'pins': return 'Pin Registers';
      case 'smartPins': return 'Smart Pin RQPIN values';
      case 'status': return 'Status indicators: INIT, STALLI, STR, MOD, LUTS';
      case 'hubMemory': return 'Hub Data | Wheel scrolls';
      case 'hubMiniMap': return 'HUB Heatmap | Click to jump to address';
      case 'hint': return '';
      case 'exec': return 'Execution Mode';
      default: return '';
    }
  }

  /**
   * Handle mouse click
   * Pascal FormMouseDown from DebuggerUnit.pas lines 716-970
   */
  public handleMouseClick(gridX: number, gridY: number, rightClick: boolean = false): string | null {
    const LB = !rightClick;
    const RB = rightClick;

    // Check button clicks first
    for (const [name, button] of this.buttons) {
      if (gridX >= button.x && gridX < button.x + button.width &&
          gridY >= button.y && gridY < button.y + button.height) {
        this.handleButtonCommand(name, rightClick);
        this.markRegionDirty('controls');
        return button.command;
      }
    }

    // Check region clicks
    for (const [name, region] of this.regions) {
      if (!this.isPointInRegion(gridX, gridY, region)) continue;

      switch (name) {
        case 'cogRegisters':
        case 'lutRegisters':
          // Click on REG/LUT map locks disassembly to that address range
          // Pascal: DisMode := dmCog; CogAddr := MapCogAddr
          {
            const isLut = name === 'lutRegisters';
            const baseAddr = isLut ? 0x200 : 0;
            const relY = gridY - region.y - 3; // Skip title rows
            const regsPerRow = Math.ceil(512 / (region.height - 3));
            const regRow = Math.floor(relY);
            const mapAddr = Math.min(regRow * regsPerRow, 0x1F0);
            this.disMode = 'cog';
            this.cogAddr = baseAddr + mapAddr;
            this.markRegionDirty('disassembly');
          }
          return 'selectCogAddress';

        case 'disassembly':
          // L-Click: lock to PC; R-Click: toggle breakpoint at line
          if (LB) {
            this.disMode = 'pc';
            this.markRegionDirty('disassembly');
            return 'lockToPC';
          } else if (RB) {
            // Toggle breakpoint at clicked line
            const lineNum = Math.floor((gridY - region.y - 1)); // Skip header
            if (lineNum >= 0 && lineNum < LAYOUT_CONSTANTS.DIS_LINES - 1) {
              const state = this.dataManager.getCogState(this.cogId);
              if (state) {
                const pc = state.programCounter;
                const halfWindow = Math.floor((LAYOUT_CONSTANTS.DIS_LINES - 1) / 2);
                const startAddr = Math.max(0, pc - halfWindow * 4);
                const clickedAddr = startAddr + lineNum * 4;

                // Toggle break address
                if ((this.breakValue & 0x400) !== 0 && this.breakAddr === clickedAddr) {
                  // Clear address breakpoint
                  this.breakValue = this.breakValue & 0xBFF;
                } else {
                  // Set address breakpoint
                  this.breakAddr = clickedAddr & 0xFFFFF;
                  this.breakValue = (this.breakValue & 0xDFF) | 0x400 | (this.breakAddr << 12);
                }
                this.updateButtonStates();
                this.markRegionDirty('controls');
                this.markRegionDirty('disassembly');
              }
            }
            return 'toggleBreakpoint';
          }
          break;

        case 'registerWatch':
          // Reset register watch list
          // Pascal: ResetRegWatch
          if (this.onCommand) {
            this.onCommand('resetRegWatch', {});
          }
          return 'resetRegWatch';

        case 'events':
          // Click on event to set event breakpoint
          // Pascal lines 827-840
          {
            const eventRow = Math.floor((gridY - region.y) / 2);
            if (eventRow >= 0 && eventRow < 16) {
              this.breakEvent = eventRow;
              if (LB) {
                this.breakValue = (this.breakValue & 0x100) | 0x200 | (this.breakEvent << 12);
              } else if (RB) {
                if ((this.breakValue & 0x200) !== 0) {
                  this.breakValue = this.breakValue & 0xDEF;
                } else {
                  this.breakValue = (this.breakValue & 0xBEF) | 0x200 | (this.breakEvent << 12);
                }
              }
              this.updateButtonStates();
              this.markRegionDirty('controls');
            }
          }
          return 'selectEvent';

        case 'sfr':
          // Click on SFR navigates to that address
          // Pascal lines 894-908
          {
            const sfrRow = Math.floor((gridY - region.y) / 2);
            if (sfrRow >= 0 && sfrRow < 16) {
              const sfrAddr = 0x1F0 + sfrRow;
              const sfrValue = this.dataManager.getCogMemory(this.cogId, sfrAddr) || 0;
              const targetAddr = sfrValue & 0xFFFFF;

              if (targetAddr < 0x400 && sfrRow < 6) {
                // IJMP3..IRET1 - treat as code pointers
                this.disMode = 'cog';
                this.cogAddr = targetAddr;
                this.markRegionDirty('disassembly');
              } else {
                // PA..PTRB - treat as hub data pointers
                this.selectedAddress = targetAddr;
                this.markRegionDirty('hubMemory');
                this.markRegionDirty('hubMiniMap');
              }
            }
          }
          return 'navigateSFR';

        case 'stack':
          // Click on stack value navigates to that address
          // Pascal lines 910-924
          {
            const state = this.dataManager.getCogState(this.cogId);
            if (state?.lastMessage) {
              const stackColWidth = 9; // 8 hex chars + 1 space
              const stackIdx = Math.floor((gridX - region.x - 6) / stackColWidth);
              if (stackIdx >= 0 && stackIdx < 8 && stackIdx < state.lastMessage.stack.length) {
                const stackValue = state.lastMessage.stack[stackIdx];
                const targetAddr = stackValue & 0xFFFFF;
                if (targetAddr < 0x400) {
                  this.disMode = 'cog';
                  this.cogAddr = targetAddr;
                  this.markRegionDirty('disassembly');
                } else {
                  this.selectedAddress = targetAddr;
                  this.markRegionDirty('hubMemory');
                  this.markRegionDirty('hubMiniMap');
                }
              }
            }
          }
          return 'navigateStack';

        case 'hubMemory':
          // Click on hub data navigates to that address
          // Pascal lines 956-966
          {
            const row = Math.floor((gridY - region.y) / 2);
            const col = Math.floor((gridX - region.x - 6) / 3); // After address column
            if (col >= 0 && col < 16) {
              const baseAddr = this.getSelectedAddress();
              const clickedAddr = (baseAddr + row * 16 + col) & 0xFFFFF;
              this.selectedAddress = clickedAddr;
              this.markRegionDirty('hubMemory');
              this.markRegionDirty('hubMiniMap');
            }
          }
          return 'selectHubAddress';

        case 'hubMiniMap':
          // Click on hub map navigates to that address
          // Pascal line 968-969: HubAddr := MapHubAddr
          {
            const mapWidth = region.width;
            const mapHeight = region.height;
            const constants = MEMORY_CONSTANTS;

            // Calculate which sub-block was clicked
            const srcCol = Math.floor((gridX - region.x) * constants.HUB_MAP_WIDTH / mapWidth);
            const srcRow = Math.floor((gridY - region.y) * constants.HUB_MAP_HEIGHT / mapHeight);

            // Calculate address from sub-block
            const subBlockIdx = srcRow * constants.HUB_MAP_WIDTH + srcCol;
            const hubAddr = subBlockIdx * constants.HUB_SUB_BLOCK_SIZE;

            this.selectedAddress = hubAddr & 0xFFFFF;
            this.markRegionDirty('hubMemory');
            this.markRegionDirty('hubMiniMap');
          }
          return 'navigateHubMap';

        case 'smartPins':
          // Left-click: reset smart pin watch; Right-click: toggle DIR filter
          if (RB) {
            if (this.onCommand) {
              this.onCommand('toggleSmartWatchAll', {});
            }
          } else {
            if (this.onCommand) {
              this.onCommand('resetSmartWatch', {});
            }
          }
          return 'smartPinAction';

        case 'flags':
          // Click on PC area locks disassembly to follow PC
          if (gridX >= PASCAL_LAYOUT_CONSTANTS.PC.l && gridX < PASCAL_LAYOUT_CONSTANTS.PC.l + PASCAL_LAYOUT_CONSTANTS.PC.w) {
            this.disMode = 'pc';
            this.markRegionDirty('disassembly');
            return 'lockToPC';
          }
          break;

        case 'pointers':
          // Click on pointer data navigates hub viewer and disassembly to that address
          {
            const state2 = this.dataManager.getCogState(this.cogId);
            if (state2?.lastMessage) {
              const relRow = Math.floor((gridY - region.y) / 2);
              let targetAddr = 0;
              if (relRow === 0) targetAddr = state2.lastMessage.fifoPtr;
              else if (relRow === 1) targetAddr = state2.lastMessage.ptrA;
              else if (relRow === 2) targetAddr = state2.lastMessage.ptrB;
              this.selectedAddress = targetAddr & 0xFFFFF;
              this.markRegionDirty('hubMemory');
              this.markRegionDirty('hubMiniMap');
            }
          }
          return 'navigatePointer';
      }
    }

    return null;
  }

  /**
   * Handle mouse wheel for scrolling
   * Pascal FormMouseWheel from DebuggerUnit.pas lines 972-1010
   *
   * @param gridX Mouse X position in grid coordinates
   * @param gridY Mouse Y position in grid coordinates
   * @param delta Wheel delta (positive = up/away, negative = down/toward)
   * @param shiftKey Shift modifier held
   * @param ctrlKey Ctrl modifier held
   * @returns true if handled
   */
  public handleMouseWheel(gridX: number, gridY: number, delta: number,
                          shiftKey: boolean = false, ctrlKey: boolean = false): boolean {
    // Pascal: DisDeltas[0..3] = (1, 4, 16, 32) for disassembly
    //         HubDeltas[0..3] = (16, 1, 4, 128) for hub
    // Index = ssShift << 1 | ssCtrl
    const disDeltas = [1, 4, 16, 32];
    const hubDeltas = [16, 1, 4, 128];

    const modIndex = (shiftKey ? 2 : 0) | (ctrlKey ? 1 : 0);
    const disStep = (delta > 0 ? -1 : 1) * disDeltas[modIndex];
    const hubStep = (delta > 0 ? -1 : 1) * hubDeltas[modIndex];

    // Check which region the mouse is in
    const disRegion = this.regions.get('disassembly');
    const hubRegion = this.regions.get('hubMemory');
    const hubMapRegion = this.regions.get('hubMiniMap');

    // In disassembly box?
    if (disRegion && this.isPointInRegion(gridX, gridY, disRegion)) {
      // If following PC, switch to free scroll mode
      if (this.disMode === 'pc') {
        const state = this.dataManager.getCogState(this.cogId);
        if (state) {
          const addr = state.programCounter;
          if (addr < 0x400) {
            this.disMode = 'cog';
            this.cogAddr = addr;
          } else {
            this.disMode = 'hub';
            this.selectedAddress = addr;
          }
        }
      }

      // Scroll disassembly via disTopAddr (used by the auto-scroll system from Task #13)
      if (this.disMode === 'cog') {
        this.disTopAddr = Math.max(0, Math.min(0x400 - this.DIS_LINES, this.disTopAddr + disStep));
      } else {
        this.disTopAddr = (this.disTopAddr + disStep * 4) & 0xFFFFF;
      }

      this.markRegionDirty('disassembly');
      return true;
    }

    // In hub memory or hub map?
    if ((hubRegion && this.isPointInRegion(gridX, gridY, hubRegion)) ||
        (hubMapRegion && this.isPointInRegion(gridX, gridY, hubMapRegion))) {
      // Check if in hub address column specifically for digit-by-digit scrolling
      // Pascal: HubAddr := (HubAddr + i shl (4 * (4 - (MouseX - HubAddrLeft) div ChrWidth))) and $FFFFF
      const hubAddrX = hubRegion ? hubRegion.x : 0;
      const digitCol = gridX - hubAddrX;

      if (hubRegion && digitCol >= 0 && digitCol < 5) {
        // In address column - scroll by nibble position
        // Digit 0 = $x0000, Digit 1 = $0x000, etc.
        const nibbleShift = 4 * (4 - digitCol);
        const nibbleStep = (delta > 0 ? -1 : 1) << nibbleShift;
        this.selectedAddress = (this.getSelectedAddress() + nibbleStep) & 0xFFFFF;
      } else {
        // In data area - use hubStep
        this.selectedAddress = (this.getSelectedAddress() + hubStep) & 0xFFFFF;
      }

      this.markRegionDirty('hubMemory');
      this.markRegionDirty('hubMiniMap');
      return true;
    }

    return false;
  }

  /**
   * Handle button command with left/right click logic
   * Pascal BreakValue manipulation from DebuggerUnit.pas lines 755-856
   */
  private handleButtonCommand(buttonName: string, rightClick: boolean): void {
    const LB = !rightClick;
    const RB = rightClick;

    switch (buttonName) {
      case 'MAIN':
        // Left: set MAIN mode, Right: toggle MAIN bit
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x01;
        } else if (RB) {
          this.breakValue = (this.breakValue & 0xFFFFFFEF) ^ 0x01;
        }
        this.updateButtonStates();
        break;

      case 'INT1':
        // Left: set INT1 mode, Right: toggle INT1 bit
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x02;
        } else if (RB) {
          this.breakValue = (this.breakValue & 0xFFFFFFEF) ^ 0x02;
        }
        this.updateButtonStates();
        break;

      case 'INT2':
        // Left: set INT2 mode, Right: toggle INT2 bit
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x04;
        } else if (RB) {
          this.breakValue = (this.breakValue & 0xFFFFFFEF) ^ 0x04;
        }
        this.updateButtonStates();
        break;

      case 'INT3':
        // Left: set INT3 mode, Right: toggle INT3 bit
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x08;
        } else if (RB) {
          this.breakValue = (this.breakValue & 0xFFFFFFEF) ^ 0x08;
        }
        this.updateButtonStates();
        break;

      case 'DEBUG':
        // Left: set DEBUG exclusively (clear bits 0-3, 5-7; keep bit 8)
        // Right: toggle bit 4; clear bits 0-3, 5-7 (mutual exclusion with single-step)
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x10;
        } else if (RB) {
          this.breakValue = (this.breakValue & ~0xFF) ^ 0x10; // Preserve 8,9,10; clear 0-7; toggle 4
        }
        this.updateButtonStates();
        break;

      case 'INT1E':
        // Left: set INT1E mode, Right: toggle INT1E bit
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x20;
        } else if (RB) {
          this.breakValue = (this.breakValue & 0xFFFFFFEF) ^ 0x20;
        }
        this.updateButtonStates();
        break;

      case 'INT2E':
        // Left: set INT2E mode, Right: toggle INT2E bit
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x40;
        } else if (RB) {
          this.breakValue = (this.breakValue & 0xFFFFFFEF) ^ 0x40;
        }
        this.updateButtonStates();
        break;

      case 'INT3E':
        // Left: set INT3E mode, Right: toggle INT3E bit
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x80;
        } else if (RB) {
          this.breakValue = (this.breakValue & 0xFFFFFFEF) ^ 0x80;
        }
        this.updateButtonStates();
        break;

      case 'INIT':
        // INIT is independent - Left: set, Right: toggle
        if (LB) {
          this.breakValue = this.breakValue | 0x100;
        } else if (RB) {
          this.breakValue = this.breakValue ^ 0x100;
        }
        this.updateButtonStates();
        break;

      case 'EVENT':
        // Left: set EVENT exclusively (bit 9 + event ID in bits 15..12; keep bit 8)
        // Right: toggle EVENT — if set, clear bits 9,12-15; if not set, add EVENT+event
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x200 | (this.breakEvent << 12);
        } else if (RB) {
          if ((this.breakValue & 0x200) !== 0) {
            this.breakValue = this.breakValue & ~0xF200; // Clear EVENT bit and event ID
          } else {
            this.breakValue = (this.breakValue & ~0xF600) | 0x200 | (this.breakEvent << 12); // Clear ADDR, set EVENT
          }
        }
        this.updateButtonStates();
        break;

      case 'ADDR':
        // Left: set ADDR exclusively (bit 10 + address in bits 31..12; keep bit 8)
        // Right: toggle ADDR — if set, clear bit 10 and address bits; if not set, add ADDR+address
        if (LB) {
          this.breakValue = (this.breakValue & 0x100) | 0x400 | (this.breakAddr << 12);
        } else if (RB) {
          if ((this.breakValue & 0x400) !== 0) {
            this.breakValue = this.breakValue & 0x00000BFF; // Clear ADDR bit and address
          } else {
            this.breakValue = (this.breakValue & ~0xF200) | 0x400 | (this.breakAddr << 12); // Clear EVENT, set ADDR
          }
        }
        this.updateButtonStates();
        break;

      case 'BREAK':
        // BREAK clears all except INIT
        this.breakValue = this.breakValue & 0x100;
        this.updateButtonStates();
        break;

      case 'GO':
        // GO starts execution - send command to protocol
        if (this.onCommand) {
          if (LB) {
            // Single step with current break value
            this.onCommand('go', { breakValue: this.breakValue, repeat: false });
          } else if (RB) {
            // Repeat mode
            this.onCommand('go', { breakValue: this.breakValue, repeat: true });
          }
        }
        break;
    }
  }

  /**
   * Update button active states based on breakValue
   */
  private updateButtonStates(): void {
    // Update each button's active state based on corresponding bit
    const buttonBits: { [key: string]: number } = {
      'MAIN': 0x01, 'INT1': 0x02, 'INT2': 0x04, 'INT3': 0x08,
      'DEBUG': 0x10, 'INT1E': 0x20, 'INT2E': 0x40, 'INT3E': 0x80,
      'INIT': 0x100, 'EVENT': 0x200, 'ADDR': 0x400
    };

    for (const [name, bit] of Object.entries(buttonBits)) {
      const button = this.buttons.get(name);
      if (button) {
        button.active = (this.breakValue & bit) !== 0;
      }
    }
  }

  /**
   * Set command callback for protocol communication
   */
  public setCommandCallback(callback: (command: string, data?: any) => void): void {
    this.onCommand = callback;
  }

  /**
   * Get current break value
   */
  public getBreakValue(): number {
    return this.breakValue;
  }

  /**
   * Set break address for ADDR button
   */
  public setBreakAddress(address: number): void {
    this.breakAddr = address & 0xFFFFF; // 20-bit address
  }

  /**
   * Set break event for EVENT button
   */
  public setBreakEvent(event: number): void {
    this.breakEvent = event & 0xF; // 4-bit event ID (0-15)
  }

  /**
   * Handle keyboard input
   * Pascal keyboard handling from DebuggerUnit.pas lines 1012-1089:
   * - SPACE = left-click GO (single step)
   * - ENTER = right-click GO (repeat mode)
   * - 'B' = click BREAK button
   * - 'I' = right-click INIT (toggle)
   * - 'D' = right-click DEBUG (toggle)
   * - 'M' = right-click MAIN (toggle)
   * - 'R' = click register watch box
   * - UP = HubAddr - $10
   * - DOWN = HubAddr + $10
   * - PAGEUP/PAGEDOWN = navigate hub memory (with Shift=$10000, Ctrl=$1000, else=$80)
   */
  public handleKeyDown(key: string, shiftKey: boolean = false, ctrlKey: boolean = false, altKey: boolean = false): boolean {
    // Convert key to uppercase for letter keys
    const keyUpper = key.toUpperCase();

    // Alt+Arrow for back/forward navigation
    if (altKey) {
      switch (key) {
        case 'ArrowLeft':  // Alt+Left = navigate back
          if (this.navigateBack()) {
            return true;
          }
          break;

        case 'ArrowRight':  // Alt+Right = navigate forward
          if (this.navigateForward()) {
            return true;
          }
          break;
      }
    }

    switch (key) {
      case ' ':  // SPACE = left-click GO button
        this.handleButtonCommand('GO', false);
        this.markRegionDirty('controls');
        return true;

      case 'Enter':  // ENTER = right-click GO button (repeat mode)
        this.handleButtonCommand('GO', true);
        this.markRegionDirty('controls');
        return true;

      case 'Escape':  // ESC = close (handled by window)
        if (this.onCommand) {
          this.onCommand('close', {});
        }
        return true;
    }

    // Letter key handling (case-insensitive)
    switch (keyUpper) {
      case 'B':  // 'B' = click BREAK button
        this.handleButtonCommand('BREAK', false);
        this.markRegionDirty('controls');
        return true;

      case 'I':  // 'I' = right-click INIT button (toggle)
        this.handleButtonCommand('INIT', true);
        this.markRegionDirty('controls');
        return true;

      case 'D':  // 'D' = right-click DEBUG button (toggle)
        this.handleButtonCommand('DEBUG', true);
        this.markRegionDirty('controls');
        return true;

      case 'M':  // 'M' = right-click MAIN button (toggle)
        this.handleButtonCommand('MAIN', true);
        this.markRegionDirty('controls');
        return true;

      case 'R':  // 'R' = click register watch box
        // Reset register watch
        if (this.onCommand) {
          this.onCommand('resetRegWatch', {});
        }
        this.markRegionDirty('registerWatch');
        return true;

      case 'G':  // 'G' = go to address (prompt user)
        if (this.onCommand) {
          this.onCommand('promptGoToAddress', {});
        }
        return true;

      case 'P':  // 'P' = go to PC
        this.goToPC();
        return true;

      case 'A':  // 'A' = request break on all other COGs
        if (this.hasMultipleCogs()) {
          this.requestBreakOnAllCogs();
        }
        return true;
    }

    // Number keys 0-7: switch to that COG (if active)
    if (keyUpper >= '0' && keyUpper <= '7') {
      const targetCog = parseInt(keyUpper);
      if (this.dataManager.isCogActive(targetCog) && targetCog !== this.cogId) {
        this.switchToCog(targetCog);
        return true;
      }
    }

    // Navigation keys - ensure selectedAddress is valid before navigating
    const getValidAddress = (): number => {
      return this.selectedAddress >= 0 ? this.selectedAddress : 0;
    };

    switch (key) {
      case 'ArrowUp':  // UP = HubAddr - $10
        this.selectedAddress = (getValidAddress() - 0x10) & 0xFFFFF;
        this.markRegionDirty('hubMemory');
        this.markRegionDirty('hubMiniMap');
        return true;

      case 'ArrowDown':  // DOWN = HubAddr + $10
        this.selectedAddress = (getValidAddress() + 0x10) & 0xFFFFF;
        this.markRegionDirty('hubMemory');
        this.markRegionDirty('hubMiniMap');
        return true;

      case 'PageUp':  // PAGEUP = go up in HUB
        {
          let delta: number;
          if (shiftKey) {
            delta = 0x10000;  // 64KB
          } else if (ctrlKey) {
            delta = 0x1000;   // 4KB
          } else {
            delta = 0x80;     // HubSubBlockSize
          }
          this.selectedAddress = (getValidAddress() - delta) & 0xFFFFF;
          this.markRegionDirty('hubMemory');
          this.markRegionDirty('hubMiniMap');
        }
        return true;

      case 'PageDown':  // PAGEDOWN = go down in HUB
        {
          let delta: number;
          if (shiftKey) {
            delta = 0x10000;  // 64KB
          } else if (ctrlKey) {
            delta = 0x1000;   // 4KB
          } else {
            delta = 0x80;     // HubSubBlockSize
          }
          this.selectedAddress = (getValidAddress() + delta) & 0xFFFFF;
          this.markRegionDirty('hubMemory');
          this.markRegionDirty('hubMiniMap');
        }
        return true;

      case 'Home':  // HOME = go to start of HUB
        this.selectedAddress = 0;
        this.markRegionDirty('hubMemory');
        this.markRegionDirty('hubMiniMap');
        return true;

      case 'End':  // END = go to end of HUB (near top)
        this.selectedAddress = 0xFFF00;  // Near end of 1MB HUB
        this.markRegionDirty('hubMemory');
        this.markRegionDirty('hubMiniMap');
        return true;

      case 'F9':  // F9 = toggle breakpoint at current PC
        {
          const state = this.dataManager.getCogState(this.cogId);
          if (state) {
            const pc = state.programCounter;
            this.dataManager.toggleBreakpoint(this.cogId, pc);
            // Update breakValue to reflect the new breakpoint
            if (this.dataManager.hasBreakpoint(this.cogId, pc)) {
              this.breakAddr = pc & 0xFFFFF;
              this.breakValue = (this.breakValue & 0xDFF) | 0x400 | (this.breakAddr << 12);
            } else {
              // Clear address breakpoint if we just removed it
              if (this.breakAddr === pc) {
                this.breakValue = this.breakValue & 0xBFF;
              }
            }
            this.updateButtonStates();
            this.markRegionDirty('disassembly');
            this.markRegionDirty('controls');
          }
        }
        return true;

      case 'F10':  // F10 = step (same as SPACE, but more IDE-like)
        this.handleButtonCommand('GO', false);
        this.markRegionDirty('controls');
        return true;
    }

    // Ctrl+Shift+F9 = clear all breakpoints
    if (key === 'F9' && ctrlKey && shiftKey) {
      this.dataManager.clearAllBreakpoints(this.cogId);
      this.breakValue = this.breakValue & 0xBFF;  // Clear ADDR bit
      this.updateButtonStates();
      this.markRegionDirty('disassembly');
      this.markRegionDirty('controls');
      return true;
    }

    // Key not handled
    return false;
  }

  /**
   * Set tooltip text
   */
  public setTooltip(text: string, x: number, y: number): void {
    this.tooltipText = text;
    this.tooltipX = x;
    this.tooltipY = y;
  }

  /**
   * Clear tooltip
   */
  public clearTooltip(): void {
    if (this.tooltipText) {
      this.tooltipText = '';
    }
  }

  /**
   * Set selected memory address
   */
  public setSelectedAddress(address: number): void {
    if (this.selectedAddress !== address) {
      this.selectedAddress = address;
      this.markRegionDirty('hubMemory');
      this.markRegionDirty('hubMiniMap');
    }
  }

  /**
   * Get current selected/hub address
   */
  public getSelectedAddress(): number {
    return this.selectedAddress >= 0 ? this.selectedAddress : 0;
  }

  /**
   * Get current disassembly mode
   */
  public getDisassemblyMode(): 'pc' | 'cog' | 'hub' {
    return this.disMode;
  }

  /**
   * Get current COG address for disassembly
   */
  public getCogAddress(): number {
    return this.cogAddr;
  }

  /**
   * Set COG address for disassembly
   */
  public setCogAddress(address: number): void {
    this.cogAddr = address & 0x3FF;
    this.markRegionDirty('disassembly');
  }

  /**
   * Set disassembly mode
   */
  public setDisassemblyMode(mode: 'pc' | 'cog' | 'hub'): void {
    if (this.disMode !== mode) {
      this.disMode = mode;
      this.markRegionDirty('disassembly');
    }
  }

  // ===== Address Navigation Methods =====

  /**
   * Navigate to a specific address
   * Validates address and determines whether it's COG/LUT or HUB memory
   *
   * @param address Address to navigate to (hex or decimal)
   * @param addToHistory Whether to add to navigation history
   * @returns true if navigation succeeded
   */
  public goToAddress(address: number, addToHistory: boolean = true): boolean {
    // Validate address
    if (!this.isValidAddress(address)) {
      return false;
    }

    // Add current position to history before navigating
    if (addToHistory) {
      this.pushAddressHistory(this.getCurrentAddress());
    }

    // Determine memory type and navigate
    if (address < 0x400) {
      // COG/LUT memory (0-$3FF)
      this.disMode = 'cog';
      this.cogAddr = address;
      this.markRegionDirty('disassembly');
      this.markRegionDirty('cogRegisters');
      this.markRegionDirty('lutRegisters');
    } else {
      // HUB memory ($400+)
      this.selectedAddress = address & 0xFFFFF;
      this.markRegionDirty('hubMemory');
      this.markRegionDirty('hubMiniMap');
    }

    return true;
  }

  /**
   * Navigate to current PC location
   */
  public goToPC(): void {
    const oldAddr = this.getCurrentAddress();

    this.disMode = 'pc';
    this.markRegionDirty('disassembly');

    // Add to history
    this.pushAddressHistory(oldAddr);
  }

  /**
   * Navigate back in address history
   * @returns true if navigation occurred
   */
  public navigateBack(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const addr = this.addressHistory[this.historyIndex];
      this.goToAddress(addr, false); // Don't add to history
      return true;
    }
    return false;
  }

  /**
   * Navigate forward in address history
   * @returns true if navigation occurred
   */
  public navigateForward(): boolean {
    if (this.historyIndex < this.addressHistory.length - 1) {
      this.historyIndex++;
      const addr = this.addressHistory[this.historyIndex];
      this.goToAddress(addr, false); // Don't add to history
      return true;
    }
    return false;
  }

  /**
   * Check if back navigation is available
   */
  public canNavigateBack(): boolean {
    return this.historyIndex > 0;
  }

  /**
   * Check if forward navigation is available
   */
  public canNavigateForward(): boolean {
    return this.historyIndex < this.addressHistory.length - 1;
  }

  /**
   * Get current address based on disassembly mode
   */
  public getCurrentAddress(): number {
    switch (this.disMode) {
      case 'pc':
        const state = this.dataManager.getCogState(this.cogId);
        return state?.programCounter || 0;
      case 'cog':
        return this.cogAddr;
      case 'hub':
        return this.getSelectedAddress();
      default:
        return 0;
    }
  }

  /**
   * Validate an address
   * @param address Address to validate
   * @returns true if address is valid for P2 memory map
   */
  public isValidAddress(address: number): boolean {
    // P2 has 1MB HUB memory ($00000-$FFFFF)
    // COG+LUT is $000-$3FF (1024 longs)
    if (typeof address !== 'number' || isNaN(address)) {
      return false;
    }
    // All addresses 0-$FFFFF are valid
    return address >= 0 && address <= 0xFFFFF;
  }

  /**
   * Parse address string (hex or decimal)
   * Accepts formats: 0x1234, $1234, 1234h, 1234
   *
   * @param input Address string
   * @returns Parsed address or -1 if invalid
   */
  public parseAddress(input: string): number {
    if (!input || typeof input !== 'string') {
      return -1;
    }

    // Trim whitespace
    input = input.trim().toUpperCase();

    // Remove any leading/trailing characters
    let isHex = false;
    let numStr = input;

    // Check for hex prefixes/suffixes
    if (input.startsWith('0X')) {
      isHex = true;
      numStr = input.slice(2);
    } else if (input.startsWith('$')) {
      isHex = true;
      numStr = input.slice(1);
    } else if (input.endsWith('H')) {
      isHex = true;
      numStr = input.slice(0, -1);
    } else if (/^[0-9A-F]+$/.test(input) && /[A-F]/.test(input)) {
      // Contains hex digits A-F, treat as hex
      isHex = true;
    }

    // Parse the number
    const radix = isHex ? 16 : 10;
    const value = parseInt(numStr, radix);

    if (isNaN(value) || value < 0 || value > 0xFFFFF) {
      return -1;
    }

    return value;
  }

  /**
   * Push address to navigation history
   */
  private pushAddressHistory(address: number): void {
    // Don't add if same as current
    if (this.historyIndex >= 0 && this.addressHistory[this.historyIndex] === address) {
      return;
    }

    // Remove any forward history
    if (this.historyIndex < this.addressHistory.length - 1) {
      this.addressHistory = this.addressHistory.slice(0, this.historyIndex + 1);
    }

    // Add new address
    this.addressHistory.push(address);

    // Limit history size
    if (this.addressHistory.length > this.MAX_HISTORY) {
      this.addressHistory.shift();
    } else {
      this.historyIndex++;
    }
  }

  /**
   * Clear navigation history
   */
  public clearHistory(): void {
    this.addressHistory = [];
    this.historyIndex = -1;
  }

  // ===== Breakpoint Management Methods =====

  /**
   * Toggle breakpoint at the specified address
   * @returns true if breakpoint was set, false if cleared
   */
  public toggleBreakpoint(address: number): boolean {
    const result = this.dataManager.toggleBreakpoint(this.cogId, address);
    this.markRegionDirty('disassembly');
    return result;
  }

  /**
   * Set breakpoint at address
   */
  public setBreakpoint(address: number): void {
    this.dataManager.setBreakpoint(this.cogId, address);
    this.markRegionDirty('disassembly');
  }

  /**
   * Clear breakpoint at address
   */
  public clearBreakpoint(address: number): void {
    this.dataManager.clearBreakpoint(this.cogId, address);
    this.markRegionDirty('disassembly');
  }

  /**
   * Clear all breakpoints
   */
  public clearAllBreakpoints(): void {
    this.dataManager.clearAllBreakpoints(this.cogId);
    this.breakValue = this.breakValue & 0xBFF;  // Clear ADDR bit
    this.updateButtonStates();
    this.markRegionDirty('disassembly');
    this.markRegionDirty('controls');
  }

  /**
   * Check if breakpoint exists at address
   */
  public hasBreakpoint(address: number): boolean {
    return this.dataManager.hasBreakpoint(this.cogId, address);
  }

  /**
   * Get all breakpoints for this COG
   */
  public getBreakpoints(): number[] {
    return this.dataManager.getBreakpoints(this.cogId);
  }

  // ===== Multi-COG Support Methods =====

  /**
   * Get the COG ID this renderer is displaying
   */
  public getCogId(): number {
    return this.cogId;
  }

  /**
   * Switch to a different COG
   * @returns true if switch was successful
   */
  public switchToCog(newCogId: number): boolean {
    if (newCogId < 0 || newCogId > 7) {
      return false;
    }

    if (!this.dataManager.isCogActive(newCogId)) {
      return false;
    }

    // Save current address context
    this.pushAddressHistory(this.getCurrentAddress());

    // Switch COG
    this.cogId = newCogId;

    // Reset disassembly to follow new COG's PC
    this.disMode = 'pc';

    // Mark all regions dirty for full redraw
    this.markAllDirty();

    return true;
  }

  /**
   * Get list of other active COGs (excluding current)
   */
  public getOtherActiveCogs(): number[] {
    return this.dataManager.getActiveCogIds().filter(id => id !== this.cogId);
  }

  /**
   * Check if there are multiple COGs active
   */
  public hasMultipleCogs(): boolean {
    return this.dataManager.getActiveCogCount() > 1;
  }

  /**
   * Request break on another COG
   */
  public requestBreakOnCog(targetCogId: number): void {
    this.dataManager.requestCogBreak(1 << targetCogId);
  }

  /**
   * Request break on all other active COGs
   */
  public requestBreakOnAllCogs(): void {
    const allCogMask = this.dataManager.getActiveCogMask();
    // Exclude current COG
    const otherCogMask = allCogMask & ~(1 << this.cogId);
    this.dataManager.requestCogBreak(otherCogMask);
  }

  /**
   * Get summary of all COG states
   */
  public getCogSummaries() {
    return this.dataManager.getCogSummaries();
  }

  /**
   * Get render statistics
   */
  public getRenderStats(): { lastTime: number; count: number } {
    return {
      lastTime: this.lastRenderTime,
      count: this.renderCount
    };
  }

  /**
   * Force full redraw
   */
  public forceRedraw(): void {
    this.markAllDirty();
    this.render();
  }

  // ============================================================================
  // Window Coordination
  // ============================================================================

  /**
   * Get the window ID for this renderer
   */
  public getWindowId(): string {
    return this.windowId;
  }

  /**
   * Request synchronization with other windows for this COG
   */
  public requestSync(): void {
    this.dataManager.synchronizeWindows(this.cogId);
  }

  /**
   * Request focus on this window
   */
  public requestFocus(): void {
    this.dataManager.requestWindowFocus(this.cogId);
  }

  /**
   * Broadcast a command to all active COGs
   */
  public broadcastToAllCogs(command: string, data?: unknown): void {
    this.dataManager.broadcastCommand(command, data);
  }

  /**
   * Send a command to a specific COG
   */
  public sendToCog(targetCogId: number, command: string, data?: unknown): void {
    this.dataManager.sendCogCommand(targetCogId, command, data);
  }

  /**
   * Get the coordination state for debugging
   */
  public getCoordinationState() {
    return this.dataManager.getCoordinationState();
  }

  /**
   * Check if this is the only window for this COG
   */
  public isOnlyWindowForCog(): boolean {
    const windows = this.dataManager.getRegisteredWindows(this.cogId);
    return windows.length === 1 && windows[0] === this.windowId;
  }

  /**
   * Get all COGs that have open windows
   */
  public getCogsWithWindows(): number[] {
    return this.dataManager.getCogsWithWindows();
  }

  /**
   * Consume the pending COG break request
   * Call this when sending Phase 2 request to P2
   */
  public consumeBreakRequest(): number {
    return this.dataManager.consumeCogBreakRequest();
  }

  /**
   * Notify that this COG hit a breakpoint
   */
  public notifyBreakpoint(): void {
    this.dataManager.notifyBreakpointHit(this.cogId);
  }

  /**
   * Clean up resources and unregister from coordination
   * Must be called when the window is closed
   */
  public destroy(): void {
    // Unregister from coordination
    this.dataManager.unregisterWindow(this.cogId, this.windowId);

    // Remove all event listeners
    for (const [event, handler] of this.eventListeners) {
      this.dataManager.off(event, handler);
    }
    this.eventListeners.clear();
  }
}