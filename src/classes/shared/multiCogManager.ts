/** @format */

// src/classes/shared/multiCogManager.ts

import { BrowserWindow } from 'electron';
import { DebugDebuggerWindow } from '../debugDebuggerWin';
import { Context } from '../../utils/context';
import { WindowRouter } from './windowRouter';

/**
 * Global shared state for COG breakpoint coordination
 * This mimics Pascal's RequestCOGBRK global variable
 */
export class GlobalCogState {
  private static instance: GlobalCogState;
  
  // Shared breakpoint request flags (one bit per COG)
  private requestCOGBRK: number = 0x00;
  
  // Active debugger windows
  private activeWindows: Map<number, DebugDebuggerWindow> = new Map();
  
  private constructor() {}
  
  public static getInstance(): GlobalCogState {
    if (!GlobalCogState.instance) {
      GlobalCogState.instance = new GlobalCogState();
    }
    return GlobalCogState.instance;
  }
  
  /**
   * Set breakpoint request for a COG
   */
  public setBreakRequest(cogId: number): void {
    if (cogId >= 0 && cogId < 8) {
      this.requestCOGBRK |= (1 << cogId);
    }
  }
  
  /**
   * Clear breakpoint request for a COG
   */
  public clearBreakRequest(cogId: number): void {
    if (cogId >= 0 && cogId < 8) {
      this.requestCOGBRK &= ~(1 << cogId);
    }
  }
  
  /**
   * Get breakpoint request status for a COG
   */
  public getBreakRequest(cogId: number): boolean {
    if (cogId >= 0 && cogId < 8) {
      return (this.requestCOGBRK & (1 << cogId)) !== 0;
    }
    return false;
  }
  
  /**
   * Get all breakpoint requests as a bitmask
   */
  public getAllBreakRequests(): number {
    return this.requestCOGBRK;
  }
  
  /**
   * Register an active debugger window
   */
  public registerWindow(cogId: number, window: DebugDebuggerWindow): void {
    this.activeWindows.set(cogId, window);
  }
  
  /**
   * Unregister a debugger window
   */
  public unregisterWindow(cogId: number): void {
    this.activeWindows.delete(cogId);
  }
  
  /**
   * Get active window for a COG
   */
  public getWindow(cogId: number): DebugDebuggerWindow | undefined {
    return this.activeWindows.get(cogId);
  }
  
  /**
   * Get all active windows
   */
  public getActiveWindows(): DebugDebuggerWindow[] {
    return Array.from(this.activeWindows.values());
  }
  
  /**
   * Check if a COG has an active debugger
   */
  public hasActiveDebugger(cogId: number): boolean {
    return this.activeWindows.has(cogId);
  }
  
  /**
   * Reset all state (for testing)
   */
  public reset(): void {
    this.requestCOGBRK = 0x00;
    this.activeWindows.clear();
  }
}

/**
 * Configuration for multi-COG debugger window
 */
export interface MultiCogWindowConfig {
  cogId: number;
  cascade?: boolean;
  x?: number;
  y?: number;
  parent?: BrowserWindow;
}

/**
 * Manages multiple COG debugger windows with proper cascading and coordination
 */
export class MultiCogManager {
  private context: Context;
  private globalState: GlobalCogState;
  private router: WindowRouter;
  
  // Window positioning constants (from Pascal)
  private readonly CASCADE_OFFSET_X = 32;
  private readonly CASCADE_OFFSET_Y = 32;
  private readonly DEFAULT_WIDTH = 984; // 123 chars * 8 pixels
  private readonly DEFAULT_HEIGHT = 1232; // 77 chars * 16 pixels
  
  constructor(context: Context) {
    this.context = context;
    this.globalState = GlobalCogState.getInstance();
    this.router = WindowRouter.getInstance();
    
    // Set up binary message routing
    this.setupMessageRouting();
  }
  
  /**
   * Open a debugger window for a specific COG
   */
  public async openDebugger(config: MultiCogWindowConfig): Promise<DebugDebuggerWindow> {
    const { cogId, cascade = true, parent } = config;
    
    // Check if already open
    if (this.globalState.hasActiveDebugger(cogId)) {
      const existing = this.globalState.getWindow(cogId);
      if (existing) {
        // Focus existing window
        existing.focus();
        return existing;
      }
    }
    
    // Calculate window position
    let x = config.x;
    let y = config.y;
    
    if (cascade && x === undefined && y === undefined) {
      // Use Pascal's cascading formula: DebuggerID * ChrHeight * 2
      const cascadeIndex = this.globalState.getActiveWindows().length;
      x = cascadeIndex * this.CASCADE_OFFSET_X;
      y = cascadeIndex * this.CASCADE_OFFSET_Y;
    }
    
    // Create new debugger window
    const window = new DebugDebuggerWindow(this.context, cogId, {
      width: this.DEFAULT_WIDTH,
      height: this.DEFAULT_HEIGHT,
      x,
      y,
      parent
    });
    
    // Initialize window
    await window.initialize();
    
    // Register with global state
    this.globalState.registerWindow(cogId, window);
    
    // Set up cleanup handler
    window.onClose(() => {
      this.globalState.unregisterWindow(cogId);
    });
    
    return window;
  }
  
  /**
   * Open debuggers for all active COGs
   */
  public async openAllActive(activeCogMask: number): Promise<DebugDebuggerWindow[]> {
    const windows: DebugDebuggerWindow[] = [];
    
    for (let cogId = 0; cogId < 8; cogId++) {
      if (activeCogMask & (1 << cogId)) {
        const window = await this.openDebugger({ cogId });
        windows.push(window);
      }
    }
    
    return windows;
  }
  
  /**
   * Close debugger for a specific COG
   */
  public closeDebugger(cogId: number): void {
    const window = this.globalState.getWindow(cogId);
    if (window) {
      window.closeDebugWindow();
      this.globalState.unregisterWindow(cogId);
    }
  }
  
  /**
   * Close all debugger windows
   */
  public closeAll(): void {
    const windows = this.globalState.getActiveWindows();
    windows.forEach(window => {
      window.closeDebugWindow();
    });
    this.globalState.reset();
  }
  
  /**
   * Set up message routing for binary debugger protocol
   */
  private setupMessageRouting(): void {
    // Override WindowRouter's binary routing to handle COG-based routing
    this.router.on('binary-message', (data: Uint8Array) => {
      // Extract COG ID from message
      if (data.length >= 4) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const cogId = view.getUint32(0, true) & 0x07; // COG ID is in bits 0-2
        
        // Route to appropriate debugger window
        const window = this.globalState.getWindow(cogId);
        if (window) {
          window.updateContent({ binary: data });
        }
      }
    });
  }
  
  /**
   * Break execution on specific COG(s)
   */
  public breakExecution(cogMask: number): void {
    for (let cogId = 0; cogId < 8; cogId++) {
      if (cogMask & (1 << cogId)) {
        this.globalState.setBreakRequest(cogId);
        
        // Send break command to COG
        const window = this.globalState.getWindow(cogId);
        if (window) {
          window.sendCommand('BREAK');
        }
      }
    }
  }
  
  /**
   * Resume execution on specific COG(s)
   */
  public resumeExecution(cogMask: number): void {
    for (let cogId = 0; cogId < 8; cogId++) {
      if (cogMask & (1 << cogId)) {
        this.globalState.clearBreakRequest(cogId);
        
        // Send go command to COG
        const window = this.globalState.getWindow(cogId);
        if (window) {
          window.sendCommand('GO');
        }
      }
    }
  }
  
  /**
   * Step execution on specific COG(s)
   */
  public stepExecution(cogMask: number, stepType: 'into' | 'over' | 'out' = 'into'): void {
    for (let cogId = 0; cogId < 8; cogId++) {
      if (cogMask & (1 << cogId)) {
        const window = this.globalState.getWindow(cogId);
        if (window) {
          switch (stepType) {
            case 'into':
              window.sendCommand('STEP');
              break;
            case 'over':
              window.sendCommand('STEP_OVER');
              break;
            case 'out':
              window.sendCommand('STEP_OUT');
              break;
          }
        }
      }
    }
  }
  
  /**
   * Get status of all COGs
   */
  public getStatus(): { cogId: number; active: boolean; breaked: boolean }[] {
    const status: { cogId: number; active: boolean; breaked: boolean }[] = [];
    
    for (let cogId = 0; cogId < 8; cogId++) {
      const window = this.globalState.getWindow(cogId);
      if (window) {
        const state = window.getCogState();
        status.push({
          cogId,
          active: state.isActive,
          breaked: state.isBreaked
        });
      } else {
        status.push({
          cogId,
          active: false,
          breaked: false
        });
      }
    }
    
    return status;
  }
  
  /**
   * Synchronize breakpoints across COGs
   */
  public synchronizeBreakpoints(address: number, cogMask: number, enable: boolean): void {
    for (let cogId = 0; cogId < 8; cogId++) {
      if (cogMask & (1 << cogId)) {
        const window = this.globalState.getWindow(cogId);
        if (window) {
          if (enable) {
            window.addBreakpoint(address);
          } else {
            window.removeBreakpoint(address);
          }
        }
      }
    }
  }
  
  /**
   * Handle synchronized debugging operations
   */
  public synchronizedOperation(
    operation: 'break' | 'go' | 'step' | 'reset',
    cogMask: number = 0xFF
  ): void {
    switch (operation) {
      case 'break':
        this.breakExecution(cogMask);
        break;
      case 'go':
        this.resumeExecution(cogMask);
        break;
      case 'step':
        this.stepExecution(cogMask);
        break;
      case 'reset':
        // Reset all specified COGs
        for (let cogId = 0; cogId < 8; cogId++) {
          if (cogMask & (1 << cogId)) {
            const window = this.globalState.getWindow(cogId);
            if (window) {
              window.sendCommand('RESET');
            }
          }
        }
        break;
    }
  }
  
  /**
   * Arrange windows in a grid pattern
   */
  public arrangeWindows(pattern: 'cascade' | 'grid' | 'horizontal' | 'vertical'): void {
    const windows = this.globalState.getActiveWindows();
    if (windows.length === 0) return;
    
    windows.forEach((window, index) => {
      let x = 0;
      let y = 0;
      
      switch (pattern) {
        case 'cascade':
          x = index * this.CASCADE_OFFSET_X;
          y = index * this.CASCADE_OFFSET_Y;
          break;
          
        case 'grid':
          const cols = Math.ceil(Math.sqrt(windows.length));
          const col = index % cols;
          const row = Math.floor(index / cols);
          x = col * (this.DEFAULT_WIDTH + 10);
          y = row * (this.DEFAULT_HEIGHT + 40);
          break;
          
        case 'horizontal':
          x = index * (this.DEFAULT_WIDTH + 10);
          y = 0;
          break;
          
        case 'vertical':
          x = 0;
          y = index * (this.DEFAULT_HEIGHT + 40);
          break;
      }
      
      window.setPosition(x, y);
    });
  }
  
  /**
   * Get the shared COGBRK request state
   */
  public getCOGBRKRequest(): number {
    return this.globalState.getAllBreakRequests();
  }
}

// Export singleton instance of GlobalCogState for direct access
export const globalCogState = GlobalCogState.getInstance();