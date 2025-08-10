/** @format */

// src/classes/shared/advancedDebuggerFeatures.ts

import { DebuggerDataManager } from './debuggerDataManager';
import { LAYOUT_CONSTANTS, DEBUG_COLORS } from './debuggerConstants';

/**
 * Heat map entry tracking memory access patterns
 */
interface HeatMapEntry {
  address: number;
  heat: number;
  lastAccess: number;
  readCount: number;
  writeCount: number;
}

/**
 * Smart pin state for P2 I/O monitoring
 */
interface SmartPinState {
  pinNumber: number;
  mode: number;
  xValue: number;
  yValue: number;
  zValue: number;
  direction: boolean;
  output: boolean;
  input: boolean;
  repository: number;
  active: boolean;
}

/**
 * HUB memory mini-map for navigation
 */
interface MiniMapRegion {
  startAddress: number;
  endAddress: number;
  type: 'code' | 'data' | 'stack' | 'free';
  heat: number;
}

/**
 * Advanced debugger features including heat maps, smart pins, and HUB display
 * 
 * Implements Pascal parity requirements:
 * - Heat decay rate of 2 (HitDecayRate=2)
 * - Visual heat map with color gradients
 * - Smart pin monitoring for all 64 P2 pins
 * - HUB memory viewer with mini-map navigation
 */
export class AdvancedDebuggerFeatures {
  private dataManager: DebuggerDataManager;
  private cogId: number;
  
  // Heat map tracking
  private heatMap: Map<number, HeatMapEntry> = new Map();
  private heatDecayTimer: NodeJS.Timeout | null = null;
  private readonly HEAT_DECAY_RATE = 2; // Pascal's HitDecayRate
  private readonly HEAT_MAX = 255;
  private readonly HEAT_DECAY_INTERVAL = 100; // ms
  
  // Heat colors from cold to hot
  private readonly HEAT_COLORS = [
    '#000080', // 0 - Dark blue (coldest)
    '#0000FF', // 1 - Blue
    '#00FFFF', // 2 - Cyan
    '#00FF00', // 3 - Green
    '#FFFF00', // 4 - Yellow
    '#FF8800', // 5 - Orange
    '#FF0000', // 6 - Red
    '#FF00FF', // 7 - Magenta (hottest)
  ];
  
  // Smart pin states
  private smartPins: Map<number, SmartPinState> = new Map();
  private activePinMask: bigint = 0n;
  
  // HUB memory navigation
  private hubMiniMap: MiniMapRegion[] = [];
  private hubViewAddress: number = 0;
  private hubViewSize: number = 4096; // 4KB view window
  
  // Stack tracking
  private callStack: number[] = [];
  private readonly MAX_STACK_DEPTH = 8;
  
  // Event tracking
  private events: { type: string; timestamp: number; data: any }[] = [];
  private readonly MAX_EVENTS = 100;
  
  // Interrupt tracking
  private interruptStatus: {
    int1: boolean;
    int2: boolean;
    int3: boolean;
    lastInt1Time: number;
    lastInt2Time: number;
    lastInt3Time: number;
  } = {
    int1: false,
    int2: false,
    int3: false,
    lastInt1Time: 0,
    lastInt2Time: 0,
    lastInt3Time: 0
  };

  constructor(dataManager: DebuggerDataManager, cogId: number) {
    this.dataManager = dataManager;
    this.cogId = cogId;
    
    // Initialize smart pins
    for (let i = 0; i < 64; i++) {
      this.smartPins.set(i, this.createDefaultPinState(i));
    }
    
    // Start heat decay timer
    this.startHeatDecay();
  }

  /**
   * Track memory access for heat map
   */
  public trackMemoryAccess(address: number, isWrite: boolean): void {
    const entry = this.heatMap.get(address) || {
      address,
      heat: 0,
      lastAccess: Date.now(),
      readCount: 0,
      writeCount: 0
    };
    
    // Increase heat
    entry.heat = Math.min(this.HEAT_MAX, entry.heat + (isWrite ? 20 : 10));
    entry.lastAccess = Date.now();
    
    if (isWrite) {
      entry.writeCount++;
    } else {
      entry.readCount++;
    }
    
    this.heatMap.set(address, entry);
    
    // Track in events
    this.addEvent('memory', { address, isWrite, heat: entry.heat });
  }

  /**
   * Get heat color for an address
   */
  public getHeatColor(address: number): string {
    const entry = this.heatMap.get(address);
    if (!entry || entry.heat === 0) {
      return this.HEAT_COLORS[0];
    }
    
    // Map heat to color index
    const colorIndex = Math.floor((entry.heat / this.HEAT_MAX) * (this.HEAT_COLORS.length - 1));
    return this.HEAT_COLORS[Math.min(colorIndex, this.HEAT_COLORS.length - 1)];
  }

  /**
   * Get heat value for an address (0-255)
   */
  public getHeatValue(address: number): number {
    const entry = this.heatMap.get(address);
    return entry ? entry.heat : 0;
  }

  /**
   * Start heat decay timer
   */
  private startHeatDecay(): void {
    if (this.heatDecayTimer) return;
    
    this.heatDecayTimer = setInterval(() => {
      this.decayHeat();
    }, this.HEAT_DECAY_INTERVAL);
  }

  /**
   * Decay heat values over time
   */
  private decayHeat(): void {
    const now = Date.now();
    const toRemove: number[] = [];
    
    for (const [address, entry] of this.heatMap) {
      // Decay based on time since last access
      const timeSinceAccess = now - entry.lastAccess;
      if (timeSinceAccess > 1000) { // Start decay after 1 second
        entry.heat = Math.max(0, entry.heat - this.HEAT_DECAY_RATE);
        
        if (entry.heat === 0) {
          toRemove.push(address);
        }
      }
    }
    
    // Remove cold entries to save memory
    for (const address of toRemove) {
      this.heatMap.delete(address);
    }
  }

  /**
   * Update smart pin state
   */
  public updateSmartPin(pinNumber: number, state: Partial<SmartPinState>): void {
    if (pinNumber < 0 || pinNumber >= 64) return;
    
    const current = this.smartPins.get(pinNumber) || this.createDefaultPinState(pinNumber);
    const updated = { ...current, ...state };
    
    this.smartPins.set(pinNumber, updated);
    
    // Update active mask
    if (updated.active) {
      this.activePinMask |= (1n << BigInt(pinNumber));
    } else {
      this.activePinMask &= ~(1n << BigInt(pinNumber));
    }
    
    // Track significant changes
    if (state.mode !== undefined && state.mode !== current.mode) {
      this.addEvent('smartpin', { pin: pinNumber, oldMode: current.mode, newMode: state.mode });
    }
  }

  /**
   * Get smart pin state
   */
  public getSmartPin(pinNumber: number): SmartPinState | undefined {
    return this.smartPins.get(pinNumber);
  }

  /**
   * Get all active smart pins
   */
  public getActivePins(): SmartPinState[] {
    const active: SmartPinState[] = [];
    for (const [pin, state] of this.smartPins) {
      if (state.active) {
        active.push(state);
      }
    }
    return active;
  }

  /**
   * Update HUB memory mini-map
   */
  public updateMiniMap(memoryMap: MiniMapRegion[]): void {
    this.hubMiniMap = memoryMap;
  }

  /**
   * Navigate HUB memory view
   */
  public setHubViewAddress(address: number): void {
    // Align to 16-byte boundary
    this.hubViewAddress = address & ~0x0F;
  }

  /**
   * Get HUB memory view data
   */
  public getHubViewData(): { address: number; data: Uint8Array; heat: number[] } {
    const state = this.dataManager.getCogState(this.cogId);
    if (!state) {
      return { address: this.hubViewAddress, data: new Uint8Array(this.hubViewSize), heat: [] };
    }
    
    // Get data from data manager
    const data = new Uint8Array(this.hubViewSize);
    const heat: number[] = [];
    
    for (let i = 0; i < this.hubViewSize; i++) {
      const addr = this.hubViewAddress + i;
      // In real implementation, fetch from HUB memory
      data[i] = 0; // Placeholder
      heat.push(this.getHeatValue(addr));
    }
    
    return { address: this.hubViewAddress, data, heat };
  }

  /**
   * Update call stack
   */
  public pushCall(address: number): void {
    this.callStack.push(address);
    if (this.callStack.length > this.MAX_STACK_DEPTH) {
      this.callStack.shift();
    }
    this.addEvent('call', { address, depth: this.callStack.length });
  }

  /**
   * Pop from call stack
   */
  public popCall(): number | undefined {
    const address = this.callStack.pop();
    if (address !== undefined) {
      this.addEvent('return', { address, depth: this.callStack.length });
    }
    return address;
  }

  /**
   * Get current call stack
   */
  public getCallStack(): number[] {
    return [...this.callStack];
  }

  /**
   * Update interrupt status
   */
  public updateInterrupt(interrupt: 'int1' | 'int2' | 'int3', active: boolean): void {
    const now = Date.now();
    
    switch (interrupt) {
      case 'int1':
        this.interruptStatus.int1 = active;
        if (active) {
          this.interruptStatus.lastInt1Time = now;
          this.addEvent('interrupt', { type: 'INT1', time: now });
        }
        break;
      case 'int2':
        this.interruptStatus.int2 = active;
        if (active) {
          this.interruptStatus.lastInt2Time = now;
          this.addEvent('interrupt', { type: 'INT2', time: now });
        }
        break;
      case 'int3':
        this.interruptStatus.int3 = active;
        if (active) {
          this.interruptStatus.lastInt3Time = now;
          this.addEvent('interrupt', { type: 'INT3', time: now });
        }
        break;
    }
  }

  /**
   * Get interrupt status
   */
  public getInterruptStatus(): typeof this.interruptStatus {
    return { ...this.interruptStatus };
  }

  /**
   * Add event to history
   */
  private addEvent(type: string, data: any): void {
    this.events.push({
      type,
      timestamp: Date.now(),
      data
    });
    
    // Limit event history
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }
  }

  /**
   * Get recent events
   */
  public getRecentEvents(count: number = 10): typeof this.events {
    return this.events.slice(-count);
  }

  /**
   * Create default pin state
   */
  private createDefaultPinState(pinNumber: number): SmartPinState {
    return {
      pinNumber,
      mode: 0,
      xValue: 0,
      yValue: 0,
      zValue: 0,
      direction: false,
      output: false,
      input: false,
      repository: 0,
      active: false
    };
  }

  /**
   * Render heat map overlay for memory display
   */
  public renderHeatMapOverlay(
    ctx: CanvasRenderingContext2D,
    startAddress: number,
    endAddress: number,
    x: number,
    y: number,
    cellWidth: number,
    cellHeight: number,
    columns: number
  ): void {
    let col = 0;
    let row = 0;
    
    for (let addr = startAddress; addr <= endAddress; addr++) {
      const heat = this.getHeatValue(addr);
      if (heat > 0) {
        ctx.fillStyle = this.getHeatColor(addr);
        ctx.globalAlpha = heat / this.HEAT_MAX * 0.5; // Semi-transparent
        ctx.fillRect(
          x + col * cellWidth,
          y + row * cellHeight,
          cellWidth,
          cellHeight
        );
      }
      
      col++;
      if (col >= columns) {
        col = 0;
        row++;
      }
    }
    
    ctx.globalAlpha = 1.0; // Reset alpha
  }

  /**
   * Render mini-map
   */
  public renderMiniMap(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, width, height);
    
    // Border
    ctx.strokeStyle = '#444';
    ctx.strokeRect(x, y, width, height);
    
    if (this.hubMiniMap.length === 0) return;
    
    // Calculate scale
    const totalMemory = 512 * 1024; // 512KB HUB memory
    const scale = height / totalMemory;
    
    // Draw regions
    for (const region of this.hubMiniMap) {
      const regionY = y + region.startAddress * scale;
      const regionHeight = (region.endAddress - region.startAddress) * scale;
      
      // Color based on type
      switch (region.type) {
        case 'code':
          ctx.fillStyle = '#0080FF';
          break;
        case 'data':
          ctx.fillStyle = '#00FF80';
          break;
        case 'stack':
          ctx.fillStyle = '#FF8000';
          break;
        case 'free':
          ctx.fillStyle = '#333';
          break;
      }
      
      ctx.fillRect(x + 1, regionY, width - 2, regionHeight);
      
      // Heat overlay
      if (region.heat > 0) {
        ctx.fillStyle = '#FF0000';
        ctx.globalAlpha = region.heat / this.HEAT_MAX * 0.5;
        ctx.fillRect(x + 1, regionY, width - 2, regionHeight);
        ctx.globalAlpha = 1.0;
      }
    }
    
    // Current view indicator
    const viewY = y + this.hubViewAddress * scale;
    const viewHeight = this.hubViewSize * scale;
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, viewY, width, viewHeight);
    ctx.lineWidth = 1;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.heatDecayTimer) {
      clearInterval(this.heatDecayTimer);
      this.heatDecayTimer = null;
    }
    
    this.heatMap.clear();
    this.smartPins.clear();
    this.events = [];
    this.callStack = [];
  }
}