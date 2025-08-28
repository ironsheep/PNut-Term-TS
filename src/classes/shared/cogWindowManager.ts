/** @format */

// src/classes/shared/cogWindowManager.ts

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';

/**
 * COG window display modes
 */
export enum COGDisplayMode {
  SHOW_ALL = 'show_all',      // Show all 8 windows, mark inactive ones
  ON_DEMAND = 'on_demand'     // Only show windows with traffic
}

/**
 * COG window state
 */
interface COGWindowState {
  cogId: number;
  window: BrowserWindow | null;
  hasTraffic: boolean;
  userClosed: boolean;        // User manually closed this window
  lastActivity: Date | null;
  messageCount: number;
}

/**
 * COGWindowManager - Manages display modes and lifecycle of COG windows
 * 
 * Two modes of operation:
 * 1. Show All: Display all 8 COG windows, visually indicate inactive ones
 * 2. On-Demand: Only create/show windows that have received traffic
 * 
 * Mixed mode behavior:
 * - User can close any window, it stays closed until new traffic
 * - Mode preference is persisted in settings
 * - "Show all 8 COGs" button respects the current mode
 */
export class COGWindowManager extends EventEmitter {
  private mode: COGDisplayMode = COGDisplayMode.ON_DEMAND;
  private cogStates: Map<number, COGWindowState> = new Map();
  private windowCreator: ((cogId: number) => BrowserWindow) | null = null;

  constructor() {
    super();
    
    // Initialize states for all 8 COGs
    for (let i = 0; i < 8; i++) {
      this.cogStates.set(i, {
        cogId: i,
        window: null,
        hasTraffic: false,
        userClosed: false,
        lastActivity: null,
        messageCount: 0
      });
    }
  }

  /**
   * Set the display mode
   */
  public setMode(mode: COGDisplayMode): void {
    const oldMode = this.mode;
    this.mode = mode;
    
    if (oldMode !== mode) {
      this.emit('modeChanged', { oldMode, newMode: mode });
      
      // If switching to ON_DEMAND, close inactive windows
      if (mode === COGDisplayMode.ON_DEMAND) {
        this.closeInactiveWindows();
      }
    }
  }

  /**
   * Get current display mode
   */
  public getMode(): COGDisplayMode {
    return this.mode;
  }

  /**
   * Set window creator function
   */
  public setWindowCreator(creator: (cogId: number) => BrowserWindow): void {
    this.windowCreator = creator;
  }

  /**
   * Handle "Show all 8 COGs" button click
   */
  public showAllCOGs(): void {
    if (this.mode === COGDisplayMode.SHOW_ALL) {
      // Show All mode: Create all 8 windows
      for (let cogId = 0; cogId < 8; cogId++) {
        const state = this.cogStates.get(cogId)!;
        
        // Skip if user closed this window (respect user choice)
        if (state.userClosed) {
          continue;
        }
        
        // Create window if it doesn't exist
        if (!state.window) {
          this.createCOGWindow(cogId);
        }
        
        // Mark inactive windows visually
        if (!state.hasTraffic && state.window) {
          this.markWindowInactive(state.window, cogId);
        }
      }
    } else {
      // On-Demand mode: Only show windows with traffic
      for (const [cogId, state] of this.cogStates) {
        // Skip if no traffic or user closed
        if (!state.hasTraffic || state.userClosed) {
          continue;
        }
        
        // Create window if needed
        if (!state.window) {
          this.createCOGWindow(cogId);
        }
      }
    }
    
    this.emit('showAllRequested', { mode: this.mode });
  }

  /**
   * Handle incoming traffic for a COG
   */
  public onCOGTraffic(cogId: number, message: any): void {
    if (cogId < 0 || cogId > 7) return;
    
    const state = this.cogStates.get(cogId)!;
    const wasInactive = !state.hasTraffic;
    
    // Update state
    state.hasTraffic = true;
    state.lastActivity = new Date();
    state.messageCount++;
    
    // If window was closed by user but new traffic arrived, create it
    if (state.userClosed && !state.window) {
      state.userClosed = false; // Reset user closed flag
      this.createCOGWindow(cogId);
    }
    
    // In ON_DEMAND mode, create window on first traffic
    if (this.mode === COGDisplayMode.ON_DEMAND && !state.window && !state.userClosed) {
      this.createCOGWindow(cogId);
    }
    
    // If window exists and was inactive, update visual state
    if (state.window && wasInactive) {
      this.markWindowActive(state.window, cogId);
    }
    
    // Route message to window if it exists
    if (state.window) {
      this.sendMessageToWindow(state.window, message);
    }
    
    this.emit('cogTraffic', { cogId, messageCount: state.messageCount });
    
    // Emit active COGs update when a COG becomes active for the first time
    if (wasInactive) {
      this.emit('activeCOGsChanged', {
        cogId,
        activeCOGs: this.getActiveCOGs(),
        displayText: this.getActiveCOGsDisplay()
      });
    }
  }

  /**
   * Get list of active COG IDs (COGs that have received traffic)
   * Returns array of COG IDs sorted numerically
   */
  public getActiveCOGs(): number[] {
    const activeCOGs: number[] = [];
    
    for (const [cogId, state] of this.cogStates) {
      if (state.hasTraffic) {
        activeCOGs.push(cogId);
      }
    }
    
    return activeCOGs.sort((a, b) => a - b);
  }
  
  /**
   * Check if any COGs are active
   */
  public hasActiveCOGs(): boolean {
    return this.getActiveCOGs().length > 0;
  }
  
  /**
   * Get formatted string of active COGs for display
   * Returns format like "0,1,3" or "None" if no active COGs
   */
  public getActiveCOGsDisplay(): string {
    const activeCOGs = this.getActiveCOGs();
    return activeCOGs.length > 0 ? activeCOGs.join(',') : 'None';
  }

  /**
   * Handle user closing a COG window
   */
  public onWindowClosed(cogId: number): void {
    const state = this.cogStates.get(cogId);
    if (!state) return;
    
    // Mark as user closed - won't reopen until new traffic
    state.userClosed = true;
    state.window = null;
    
    this.emit('windowClosed', { cogId, userInitiated: true });
  }

  /**
   * Create a COG window
   */
  private createCOGWindow(cogId: number): void {
    if (!this.windowCreator) {
      console.error('Window creator not set');
      return;
    }
    
    const state = this.cogStates.get(cogId)!;
    
    try {
      const window = this.windowCreator(cogId);
      state.window = window;
      
      // Set up close handler
      window.on('closed', () => {
        this.onWindowClosed(cogId);
      });
      
      // Wait for window to be ready before applying theme
      window.webContents.once('dom-ready', () => {
        // Apply initial theme based on traffic state
        // This ensures we don't cycle through dormant if there's already traffic
        this.applyWindowTheme(window, cogId, state.hasTraffic);
      });
      
      this.emit('windowCreated', { cogId, hasTraffic: state.hasTraffic });
    } catch (error) {
      console.error(`Failed to create COG ${cogId} window:`, error);
      this.emit('windowCreationFailed', { cogId, error });
    }
  }

  /**
   * Apply theme to COG window based on traffic state
   * Uses CSS themes for instant visual switching
   */
  private applyWindowTheme(window: BrowserWindow, cogId: number, hasTraffic: boolean): void {
    const script = hasTraffic ? this.getActiveThemeScript(cogId) : this.getDormantThemeScript(cogId);
    window.webContents.executeJavaScript(script);
  }

  /**
   * Get dormant theme application script
   */
  private getDormantThemeScript(cogId: number): string {
    return `
      // Apply dormant theme instantly via CSS class
      document.body.classList.remove('cog-active');
      document.body.classList.add('cog-dormant');
      
      // Add dormant indicator if not present
      if (!document.getElementById('cog-dormant-indicator')) {
        const indicator = document.createElement('div');
        indicator.id = 'cog-dormant-indicator';
        indicator.className = 'cog-dormant-indicator';
        indicator.innerHTML = \`
          <div class="cog-title">COG ${cogId}</div>
          <div class="status-text">This window has not received any content</div>
          <div class="waiting-text">Waiting for debug messages...</div>
        \`;
        document.body.appendChild(indicator);
      }
      
      // Load theme CSS if not already loaded
      if (!document.getElementById('cog-themes-css')) {
        const link = document.createElement('link');
        link.id = 'cog-themes-css';
        link.rel = 'stylesheet';
        link.href = '../assets/cog-window-themes.css';
        document.head.appendChild(link);
      }
    `;
  }

  /**
   * Get active theme application script
   */
  private getActiveThemeScript(cogId: number): string {
    return `
      // Switch to active theme instantly
      document.body.classList.remove('cog-dormant');
      document.body.classList.add('cog-active');
      
      // Add first message flash if this is the transition
      const wasDormant = document.getElementById('cog-dormant-indicator');
      if (wasDormant) {
        document.body.classList.add('cog-first-message');
        setTimeout(() => document.body.classList.remove('cog-first-message'), 500);
      }
      
      // Remove dormant indicator
      const indicator = document.getElementById('cog-dormant-indicator');
      if (indicator) {
        indicator.remove();
      }
      
      // Ensure theme CSS is loaded
      if (!document.getElementById('cog-themes-css')) {
        const link = document.createElement('link');
        link.id = 'cog-themes-css';
        link.rel = 'stylesheet';
        link.href = '../assets/cog-window-themes.css';
        document.head.appendChild(link);
      }
    `;
  }

  /**
   * Mark window as inactive (no traffic) - Updated to use themes
   */
  private markWindowInactive(window: BrowserWindow, cogId: number): void {
    this.applyWindowTheme(window, cogId, false);
  }

  /**
   * Mark window as active (has traffic) - Updated to use themes
   */
  private markWindowActive(window: BrowserWindow, cogId: number): void {
    this.applyWindowTheme(window, cogId, true);
  }

  /**
   * Send message to COG window
   */
  private sendMessageToWindow(window: BrowserWindow, message: any): void {
    if (window && !window.isDestroyed()) {
      window.webContents.send('cog-message', message);
    }
  }

  /**
   * Close all inactive windows (for ON_DEMAND mode)
   */
  private closeInactiveWindows(): void {
    for (const [cogId, state] of this.cogStates) {
      if (!state.hasTraffic && state.window && !state.window.isDestroyed()) {
        state.window.close();
        state.window = null;
      }
    }
  }

  /**
   * Get statistics about COG windows
   */
  public getStatistics(): any {
    const stats = {
      mode: this.mode,
      totalCOGs: 8,
      activeCOGs: 0,
      openWindows: 0,
      userClosedWindows: 0,
      cogDetails: [] as any[]
    };
    
    for (const [cogId, state] of this.cogStates) {
      if (state.hasTraffic) stats.activeCOGs++;
      if (state.window) stats.openWindows++;
      if (state.userClosed) stats.userClosedWindows++;
      
      stats.cogDetails.push({
        cogId,
        hasTraffic: state.hasTraffic,
        isOpen: !!state.window,
        userClosed: state.userClosed,
        messageCount: state.messageCount,
        lastActivity: state.lastActivity
      });
    }
    
    return stats;
  }

  /**
   * Get set of currently active COGs (those with windows)
   */
  public getCOGsWithWindows(): Set<number> {
    const activeCogs = new Set<number>();
    for (const [cogId, state] of this.cogStates) {
      if (state.window && !state.window.isDestroyed()) {
        activeCogs.add(cogId);
      }
    }
    return activeCogs;
  }

  /**
   * Reset all states
   */
  public reset(): void {
    // Close all windows
    for (const state of this.cogStates.values()) {
      if (state.window && !state.window.isDestroyed()) {
        state.window.close();
      }
    }
    
    // Reset states
    for (let i = 0; i < 8; i++) {
      this.cogStates.set(i, {
        cogId: i,
        window: null,
        hasTraffic: false,
        userClosed: false,
        lastActivity: null,
        messageCount: 0
      });
    }
    
    this.emit('reset');
  }
}