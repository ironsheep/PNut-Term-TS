/** @format */

// src/classes/shared/debuggerRenderer.ts

import {
  COGDebugState,
  LAYOUT_CONSTANTS,
  DEBUG_COLORS,
  getHeatColor,
  MemoryBlock
} from './debuggerConstants';
import { DebuggerDataManager } from './debuggerDataManager';
import { Disassembler } from './disassembler';

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
  
  // Grid dimensions
  private readonly GRID_WIDTH = LAYOUT_CONSTANTS.GRID_WIDTH;
  private readonly GRID_HEIGHT = LAYOUT_CONSTANTS.GRID_HEIGHT;
  private readonly CHAR_WIDTH = 8;
  private readonly CHAR_HEIGHT = 16;
  
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
  
  // Performance tracking
  private lastRenderTime: number = 0;
  private renderCount: number = 0;
  
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
    this.canvas.height = this.GRID_HEIGHT * this.CHAR_HEIGHT;
    
    // Set up font
    this.ctx.font = this.font;
    this.ctx.textBaseline = 'top';
    
    // Initial full render
    this.markAllDirty();
  }

  /**
   * Initialize layout regions
   */
  private initializeLayout(): Map<string, LayoutRegion> {
    const regions = new Map<string, LayoutRegion>();
    
    // COG register map (left side, top)
    regions.set('cogRegisters', {
      x: 0,
      y: 0,
      width: 64,
      height: 16,
      type: 'registers'
    });
    
    // LUT register map (right side, top)
    regions.set('lutRegisters', {
      x: 65,
      y: 0,
      width: 58,
      height: 16,
      type: 'registers'
    });
    
    // Flags display (top right corner)
    regions.set('flags', {
      x: 0,
      y: 16,
      width: 123,
      height: 4,
      type: 'flags'
    });
    
    // Disassembly window (middle)
    regions.set('disassembly', {
      x: 0,
      y: LAYOUT_CONSTANTS.DIS_START_Y,
      width: 123,
      height: LAYOUT_CONSTANTS.DIS_LINES,
      type: 'disassembly'
    });
    
    // Register watch (bottom left)
    regions.set('registerWatch', {
      x: 0,
      y: 36,
      width: 40,
      height: 20,
      type: 'watch'
    });
    
    // Stack display (bottom left)
    regions.set('stack', {
      x: 0,
      y: 56,
      width: 40,
      height: LAYOUT_CONSTANTS.STACK_DEPTH,
      type: 'stack'
    });
    
    // Events (bottom middle)
    regions.set('events', {
      x: 41,
      y: 36,
      width: 30,
      height: 10,
      type: 'events'
    });
    
    // Interrupts (bottom middle)
    regions.set('interrupts', {
      x: 41,
      y: 46,
      width: 30,
      height: 8,
      type: 'interrupts'
    });
    
    // Pointers (bottom middle)
    regions.set('pointers', {
      x: 41,
      y: 54,
      width: 30,
      height: 10,
      type: 'pointers'
    });
    
    // Pin states (bottom)
    regions.set('pins', {
      x: 0,
      y: 64,
      width: 71,
      height: 8,
      type: 'pins'
    });
    
    // Smart pins (bottom)
    regions.set('smartPins', {
      x: 0,
      y: 72,
      width: 71,
      height: 5,
      type: 'smartPins'
    });
    
    // HUB memory viewer (right side)
    regions.set('hubMemory', {
      x: 72,
      y: 36,
      width: 51,
      height: 30,
      type: 'hubMemory'
    });
    
    // HUB mini-map (right side, bottom)
    regions.set('hubMiniMap', {
      x: 72,
      y: 66,
      width: 51,
      height: 11,
      type: 'hubMiniMap'
    });
    
    // Control buttons area
    regions.set('controls', {
      x: 85,
      y: 0,
      width: 38,
      height: 20,
      type: 'controls'
    });
    
    return regions;
  }

  /**
   * Initialize button controls
   */
  private initializeButtons(): Map<string, DebugButton> {
    const buttons = new Map<string, DebugButton>();
    
    // Control buttons in top right area
    const buttonStartX = 88;
    const buttonStartY = 2;
    const buttonWidth = LAYOUT_CONSTANTS.BUTTON_WIDTH;
    const buttonHeight = LAYOUT_CONSTANTS.BUTTON_HEIGHT;
    const buttonSpacing = 1;
    
    // Row 1
    buttons.set('BREAK', {
      x: buttonStartX,
      y: buttonStartY,
      width: buttonWidth,
      height: buttonHeight,
      label: 'BREAK',
      command: 'break',
      active: false
    });
    
    buttons.set('ADDR', {
      x: buttonStartX + buttonWidth + buttonSpacing,
      y: buttonStartY,
      width: buttonWidth,
      height: buttonHeight,
      label: 'ADDR',
      command: 'address',
      active: false
    });
    
    buttons.set('GO', {
      x: buttonStartX + (buttonWidth + buttonSpacing) * 2,
      y: buttonStartY,
      width: buttonWidth,
      height: buttonHeight,
      label: 'GO',
      command: 'go',
      active: false
    });
    
    // Row 2
    buttons.set('DEBUG', {
      x: buttonStartX,
      y: buttonStartY + buttonHeight + buttonSpacing,
      width: buttonWidth,
      height: buttonHeight,
      label: 'DEBUG',
      command: 'debug',
      active: false
    });
    
    buttons.set('INIT', {
      x: buttonStartX + buttonWidth + buttonSpacing,
      y: buttonStartY + buttonHeight + buttonSpacing,
      width: buttonWidth,
      height: buttonHeight,
      label: 'INIT',
      command: 'init',
      active: false
    });
    
    buttons.set('EVENT', {
      x: buttonStartX + (buttonWidth + buttonSpacing) * 2,
      y: buttonStartY + buttonHeight + buttonSpacing,
      width: buttonWidth,
      height: buttonHeight,
      label: 'EVENT',
      command: 'event',
      active: false
    });
    
    // Row 3 - Interrupt buttons
    buttons.set('INT1', {
      x: buttonStartX,
      y: buttonStartY + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth - 1,
      height: buttonHeight,
      label: 'INT1',
      command: 'int1',
      active: false
    });
    
    buttons.set('INT2', {
      x: buttonStartX + buttonWidth,
      y: buttonStartY + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth - 1,
      height: buttonHeight,
      label: 'INT2',
      command: 'int2',
      active: false
    });
    
    buttons.set('INT3', {
      x: buttonStartX + buttonWidth * 2 - 1,
      y: buttonStartY + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth - 1,
      height: buttonHeight,
      label: 'INT3',
      command: 'int3',
      active: false
    });
    
    buttons.set('MAIN', {
      x: buttonStartX + buttonWidth * 3 - 2,
      y: buttonStartY + (buttonHeight + buttonSpacing) * 2,
      width: buttonWidth,
      height: buttonHeight,
      label: 'MAIN',
      command: 'main',
      active: false
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
  public render(): void {
    const startTime = performance.now();
    
    // Clear dirty regions
    for (const regionName of this.dirtyRegions) {
      const region = this.regions.get(regionName);
      if (region) {
        this.clearRegion(region);
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
    
    // Log slow renders
    if (renderTime > 50) {
      console.warn(`Slow render: ${renderTime.toFixed(1)}ms`);
    }
  }

  /**
   * Clear a region
   */
  private clearRegion(region: LayoutRegion): void {
    const x = region.x * this.CHAR_WIDTH;
    const y = region.y * this.CHAR_HEIGHT;
    const width = region.width * this.CHAR_WIDTH;
    const height = region.height * this.CHAR_HEIGHT;
    
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
    }
  }

  /**
   * Render COG registers with heat map
   */
  private renderCogRegisters(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state) return;
    
    // Title
    this.drawText('COG Registers', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    // Render 16x16 grid of registers (256 total)
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 16; col++) {
        const regNum = row * 16 + col;
        const address = regNum * 4;
        const value = this.dataManager.getCogMemory(this.cogId, address) || 0;
        const heat = this.dataManager.getMemoryHeat('COG', this.cogId, address);
        
        // Position
        const x = region.x + col * 4;
        const y = region.y + row + 1;
        
        // Background color based on heat
        const bgColor = heat > 0 ? getHeatColor(heat) : DEBUG_COLORS.BG_DEFAULT;
        const fgColor = heat > 5 ? DEBUG_COLORS.FG_DEFAULT : DEBUG_COLORS.FG_DIM;
        
        // Draw hex value
        const hexStr = ((value >>> 0) & 0xFF).toString(16).padStart(2, '0').toUpperCase();
        this.drawText(hexStr, x, y, fgColor, bgColor);
      }
    }
  }

  /**
   * Render LUT registers with heat map
   */
  private renderLutRegisters(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state) return;
    
    // Title
    this.drawText('LUT Registers', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    // Render 16x16 grid starting at LUT base
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 14; col++) { // Slightly narrower than COG
        const regNum = row * 14 + col;
        const address = 0x800 + regNum * 4;
        const value = this.dataManager.getLutMemory(this.cogId, address) || 0;
        const heat = this.dataManager.getMemoryHeat('LUT', this.cogId, address);
        
        // Position
        const x = region.x + col * 4;
        const y = region.y + row + 1;
        
        // Background color based on heat
        const bgColor = heat > 0 ? getHeatColor(heat) : DEBUG_COLORS.BG_DEFAULT;
        const fgColor = heat > 5 ? DEBUG_COLORS.FG_DEFAULT : DEBUG_COLORS.FG_DIM;
        
        // Draw hex value
        const hexStr = ((value >>> 0) & 0xFF).toString(16).padStart(2, '0').toUpperCase();
        this.drawText(hexStr, x, y, fgColor, bgColor);
      }
    }
  }

  /**
   * Render flags display
   */
  private renderFlags(region: LayoutRegion): void {
    // Draw flag labels and values
    this.drawText('Flags:', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;
    
    const flags = state.lastMessage.flags;
    const cond = state.lastMessage.conditionCodes;
    
    // Z flag
    const zFlag = (flags & 0x01) !== 0;
    this.drawText(`Z:${zFlag ? '1' : '0'}`, region.x + 8, region.y, 
      zFlag ? DEBUG_COLORS.FG_ACTIVE : DEBUG_COLORS.FG_DIM);
    
    // C flag
    const cFlag = (flags & 0x02) !== 0;
    this.drawText(`C:${cFlag ? '1' : '0'}`, region.x + 13, region.y,
      cFlag ? DEBUG_COLORS.FG_ACTIVE : DEBUG_COLORS.FG_DIM);
    
    // Additional flags on next line
    this.drawText(`Skip:${state.skipPattern.toString(16).padStart(8, '0')}`, 
      region.x + 1, region.y + 1, DEBUG_COLORS.FG_DEFAULT);
    
    this.drawText(`Call:${state.callDepth}`, 
      region.x + 15, region.y + 1, DEBUG_COLORS.FG_DEFAULT);
  }

  /**
   * Render disassembly window with actual P2 instruction decoding
   */
  private renderDisassembly(region: LayoutRegion): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state) return;
    
    // Title bar
    this.drawText('Disassembly', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    this.drawText(`PC: ${state.programCounter.toString(16).padStart(5, '0')}`, 
      region.x + 20, region.y, DEBUG_COLORS.FG_ACTIVE);
    
    // Update disassembler state
    this.disassembler.setProgramCounter(state.programCounter);
    this.disassembler.setSkipPattern(state.skipPattern);
    
    // Calculate window around PC (show PC in middle if possible)
    const pc = state.programCounter;
    const halfWindow = Math.floor((LAYOUT_CONSTANTS.DIS_LINES - 1) / 2);
    const startAddr = Math.max(0, pc - halfWindow * 4);
    
    // Collect instructions for disassembly
    const instructions: number[] = [];
    for (let i = 0; i < LAYOUT_CONSTANTS.DIS_LINES - 1; i++) {
      const addr = startAddr + i * 4;
      const value = this.dataManager.getCogMemory(this.cogId, addr) || 0;
      instructions.push(value);
    }
    
    // Disassemble the block
    const decoded = this.disassembler.disassembleBlock(startAddr, instructions, LAYOUT_CONSTANTS.DIS_LINES - 1);
    
    // Render each line
    for (let i = 0; i < decoded.length; i++) {
      const instruction = decoded[i];
      const addr = instruction.address;
      
      // Highlight current PC
      const isCurrent = addr === pc;
      const bgColor = isCurrent ? DEBUG_COLORS.BG_ACTIVE : DEBUG_COLORS.BG_DEFAULT;
      const fgColor = isCurrent ? DEBUG_COLORS.FG_ACTIVE : 
                     instruction.isSkipped ? DEBUG_COLORS.FG_DIM : DEBUG_COLORS.FG_DEFAULT;
      
      // Check for breakpoint
      const hasBreakpoint = state.breakpoints.has(addr);
      const bpMarker = hasBreakpoint ? '●' : ' ';
      
      // Format the line using Disassembler
      let line = this.disassembler.formatDisassemblyLine(instruction, true);
      
      // Add breakpoint marker at start
      line = bpMarker + line.substring(1);
      
      // Ensure line fits in window (truncate if needed)
      if (line.length > region.width - 2) {
        line = line.substring(0, region.width - 2);
      }
      
      this.drawText(line, region.x, region.y + i + 1, fgColor, bgColor);
    }
  }

  /**
   * Render register watch area
   */
  private renderRegisterWatch(region: LayoutRegion): void {
    this.drawText('Register Watch', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;
    
    // Display key registers
    const msg = state.lastMessage;
    this.drawText(`REGA: ${msg.registerA.toString(16).padStart(8, '0')}`,
      region.x + 1, region.y + 2, DEBUG_COLORS.FG_DEFAULT);
    this.drawText(`REGB: ${msg.registerB.toString(16).padStart(8, '0')}`,
      region.x + 1, region.y + 3, DEBUG_COLORS.FG_DEFAULT);
    this.drawText(`PTRA: ${msg.pointerA.toString(16).padStart(8, '0')}`,
      region.x + 1, region.y + 4, DEBUG_COLORS.FG_DEFAULT);
    this.drawText(`PTRB: ${msg.pointerB.toString(16).padStart(8, '0')}`,
      region.x + 1, region.y + 5, DEBUG_COLORS.FG_DEFAULT);
  }

  /**
   * Render stack display
   */
  private renderStack(region: LayoutRegion): void {
    this.drawText('Stack', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;
    
    // TODO: Implement actual stack display
    // For now, show stack pointers
    const msg = state.lastMessage;
    this.drawText(`Stack A: ${msg.stackAStart.toString(16).padStart(5, '0')}`,
      region.x + 1, region.y + 2, DEBUG_COLORS.FG_DEFAULT);
    this.drawText(`Stack B: ${msg.stackBStart.toString(16).padStart(5, '0')}`,
      region.x + 1, region.y + 3, DEBUG_COLORS.FG_DEFAULT);
  }

  /**
   * Render events area
   */
  private renderEvents(region: LayoutRegion): void {
    this.drawText('Events', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    // TODO: Implement event display
  }

  /**
   * Render interrupts area
   */
  private renderInterrupts(region: LayoutRegion): void {
    this.drawText('Interrupts', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;
    
    const ijmp = state.lastMessage.interruptJump;
    this.drawText(`IJMP: ${ijmp.toString(16).padStart(5, '0')}`,
      region.x + 1, region.y + 2, DEBUG_COLORS.FG_DEFAULT);
  }

  /**
   * Render pointers area
   */
  private renderPointers(region: LayoutRegion): void {
    this.drawText('Pointers', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;
    
    // Display first PTR_BYTES of memory at PTRA
    const ptra = state.lastMessage.pointerA;
    let ptrDisplay = 'PTRA: ';
    for (let i = 0; i < Math.min(LAYOUT_CONSTANTS.PTR_BYTES, 8); i++) {
      const value = this.dataManager.getHubMemory(ptra + i) || 0;
      ptrDisplay += ((value >>> 0) & 0xFF).toString(16).padStart(2, '0') + ' ';
    }
    this.drawText(ptrDisplay, region.x + 1, region.y + 2, DEBUG_COLORS.FG_DEFAULT);
  }

  /**
   * Render pin states
   */
  private renderPins(region: LayoutRegion): void {
    this.drawText('Pin States', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    const state = this.dataManager.getCogState(this.cogId);
    if (!state || !state.lastMessage) return;
    
    const msg = state.lastMessage;
    
    // Display 32 pins per row
    for (let row = 0; row < 2; row++) {
      const dirVal = row === 0 ? msg.directionA : msg.directionB;
      const outVal = row === 0 ? msg.outputA : msg.outputB;
      const inVal = row === 0 ? msg.inputA : msg.inputB;
      
      const label = row === 0 ? 'P0-31: ' : 'P32-63:';
      this.drawText(label, region.x + 1, region.y + 2 + row * 2, DEBUG_COLORS.FG_DEFAULT);
      
      // Show pin states as colored dots
      for (let bit = 0; bit < 32; bit++) {
        const dir = (dirVal >>> bit) & 1;
        const out = (outVal >>> bit) & 1;
        const inp = (inVal >>> bit) & 1;
        
        // Color based on state
        let color: number = DEBUG_COLORS.FG_DIM;
        if (dir) {
          color = out ? DEBUG_COLORS.FG_ACTIVE : DEBUG_COLORS.FG_CHANGED;
        } else if (inp) {
          color = DEBUG_COLORS.FG_DEFAULT;
        }
        
        const x = region.x + 8 + bit;
        const y = region.y + 2 + row * 2;
        this.drawText(dir ? (out ? '●' : '○') : (inp ? '▪' : '·'), x, y, color);
      }
    }
  }

  /**
   * Render smart pins
   */
  private renderSmartPins(region: LayoutRegion): void {
    this.drawText('Smart Pins', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    // TODO: Implement smart pin display
  }

  /**
   * Render HUB memory viewer
   */
  private renderHubMemory(region: LayoutRegion): void {
    this.drawText('HUB Memory', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    // TODO: Implement scrollable HUB memory display
    // Show a window into HUB memory
    const baseAddr = this.selectedAddress >= 0 ? this.selectedAddress : 0;
    
    for (let row = 0; row < Math.min(region.height - 2, 20); row++) {
      const addr = baseAddr + row * 16;
      const addrStr = addr.toString(16).padStart(5, '0').toUpperCase();
      
      let line = `${addrStr}: `;
      for (let col = 0; col < 4; col++) {
        const value = this.dataManager.getHubMemory(addr + col * 4) || 0;
        line += value.toString(16).padStart(8, '0').toUpperCase() + ' ';
      }
      
      this.drawText(line, region.x + 1, region.y + 2 + row, DEBUG_COLORS.FG_DEFAULT);
    }
  }

  /**
   * Render HUB mini-map
   */
  private renderHubMiniMap(region: LayoutRegion): void {
    this.drawText('HUB Map', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT);
    
    // Visual representation of HUB memory usage
    // TODO: Implement mini-map visualization
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
  private renderButton(button: DebugButton, hovered: boolean): void {
    const bgColor = button.active ? DEBUG_COLORS.BG_ACTIVE :
                   hovered ? DEBUG_COLORS.BG_CHANGED :
                   DEBUG_COLORS.BG_DEFAULT;
    const fgColor = button.active ? DEBUG_COLORS.FG_ACTIVE :
                   hovered ? DEBUG_COLORS.FG_CHANGED :
                   DEBUG_COLORS.FG_DEFAULT;
    
    // Draw button background
    for (let y = 0; y < button.height; y++) {
      for (let x = 0; x < button.width; x++) {
        this.drawChar(' ', button.x + x, button.y + y, fgColor, bgColor);
      }
    }
    
    // Draw button border
    this.drawBox(button.x, button.y, button.width, button.height, fgColor);
    
    // Draw button label (centered)
    const labelX = button.x + Math.floor((button.width - button.label.length) / 2);
    const labelY = button.y + Math.floor(button.height / 2);
    this.drawText(button.label, labelX, labelY, fgColor, bgColor);
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
    const y = gridY * this.CHAR_HEIGHT;
    
    // Draw background
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
   * Handle mouse move for tooltips
   */
  public handleMouseMove(gridX: number, gridY: number): void {
    // Check if over a button
    let overButton: string | null = null;
    for (const [name, button] of this.buttons) {
      if (gridX >= button.x && gridX < button.x + button.width &&
          gridY >= button.y && gridY < button.y + button.height) {
        overButton = name;
        break;
      }
    }
    
    if (overButton !== this.hoveredButton) {
      this.hoveredButton = overButton;
      this.markRegionDirty('controls');
    }
    
    // Update tooltip
    if (overButton) {
      const button = this.buttons.get(overButton);
      if (button) {
        this.setTooltip(`Click to ${button.command}`, gridX, gridY);
      }
    } else {
      // Check for other tooltips (memory locations, etc.)
      this.clearTooltip();
    }
  }

  /**
   * Handle mouse click
   */
  public handleMouseClick(gridX: number, gridY: number): string | null {
    // Check button clicks
    for (const [name, button] of this.buttons) {
      if (gridX >= button.x && gridX < button.x + button.width &&
          gridY >= button.y && gridY < button.y + button.height) {
        button.active = !button.active;
        this.markRegionDirty('controls');
        return button.command;
      }
    }
    
    // Check memory click for selection
    // TODO: Implement memory selection
    
    return null;
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
    }
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
}