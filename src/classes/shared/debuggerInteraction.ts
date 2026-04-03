/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

// src/classes/shared/debuggerInteraction.ts

import { EventEmitter } from 'events';
import { DebuggerRenderer } from './debuggerRenderer';
import { DebuggerProtocol } from './debuggerProtocol';
import { DebuggerDataManager } from './debuggerDataManager';
import { LAYOUT_CONSTANTS, DEBUG_COLORS } from './debuggerConstants';

/**
 * Keyboard shortcuts matching Pascal DebuggerUnit.pas Section 8.1 exactly.
 *
 * Pascal debugger shortcuts:
 *   SPACE       Single-step (left-click Go) — send BreakValue once then StallCmd
 *   ENTER       Continuous run/stop (right-click Go) — toggle repeat mode
 *   B           Click BREAK button — set async break mode, clear all conditions except INIT
 *   I           Toggle INIT break (right-click INIT button)
 *   D           Toggle DEBUG break (right-click DEBUG button)
 *   M           Toggle MAIN single-step (right-click MAIN button)
 *   R           Reset register watch list (clear all watch entries)
 *   UP          Hub viewer scroll up one row (HubAddr -= $10)
 *   DOWN        Hub viewer scroll down one row (HubAddr += $10)
 *   PAGEUP      Hub viewer page up ($80 normal, $1000 with Ctrl, $10000 with Shift)
 *   PAGEDOWN    Hub viewer page down (same modifiers)
 *
 * All letter keys are uppercased before processing.
 * Tab key is captured to prevent dialog focus changes.
 */
export const KEYBOARD_SHORTCUTS: Record<string, string> = {
  // Execution control (Pascal Section 8.1)
  SPACE: 'single-go',       // Single-step: send BreakValue once, then StallCmd
  ENTER: 'repeat-toggle',   // Toggle repeat mode (continuous run/stop)
  B: 'break',               // BREAK button: clear all conditions except INIT
  I: 'toggle-init',         // Toggle INIT break (bit 8)
  D: 'toggle-debug',        // Toggle DEBUG break (bit 4)
  M: 'toggle-main',         // Toggle MAIN single-step (bit 0)
  R: 'reset-watch',         // Reset register watch list

  // Hub viewer navigation (Pascal Section 8.1)
  ARROW_UP: 'hub-up',       // HubAddr -= $10
  ARROW_DOWN: 'hub-down',   // HubAddr += $10
  PAGE_UP: 'hub-pageup',    // $80 normal, $1000 Ctrl, $10000 Shift
  PAGE_DOWN: 'hub-pagedown', // same modifiers

  // Tab captured to prevent focus changes (Pascal: DLGC_WANTTAB)
  TAB: 'capture-tab',
} as const;

/**
 * Mouse region hit testing result
 */
export interface HitTestResult {
  region: string;
  type: 'button' | 'memory' | 'register' | 'disassembly' | 'pin' | 'other';
  data?: any;
  tooltip?: string;
}

/**
 * Manages mouse and keyboard interaction for the debugger window
 */
export class DebuggerInteraction extends EventEmitter {
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

  private renderer: DebuggerRenderer;
  private protocol: DebuggerProtocol;
  private dataManager: DebuggerDataManager;
  private cogId: number;
  
  // Interaction state
  private currentFocus: string = 'disassembly';
  private selectedAddress: number = 0;
  private selectedRegister: number = -1;
  private scrollPosition: number = 0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private lastClickTime: number = 0;
  private doubleClickThreshold: number = 300; // ms
  
  // Debouncing
  private scrollDebounceTimer?: NodeJS.Timeout;
  private tooltipDebounceTimer?: NodeJS.Timeout;
  
  constructor(
    renderer: DebuggerRenderer,
    protocol: DebuggerProtocol,
    dataManager: DebuggerDataManager,
    cogId: number
  ) {
    super();
    this.renderer = renderer;
    this.protocol = protocol;
    this.dataManager = dataManager;
    this.cogId = cogId;
  }
  
  /**
   * Handle keyboard input
   */
  public handleKeyboard(event: KeyboardEvent): boolean {
    const code = event.code;
    const shift = event.shiftKey;
    const ctrl = event.ctrlKey;

    // Map code to shortcut key — Pascal uppercases all letter keys
    let shortcut = '';
    if (code === 'Space') {
      shortcut = 'SPACE';
    } else if (code === 'Enter' || code === 'NumpadEnter') {
      shortcut = 'ENTER';
    } else if (code.startsWith('Arrow')) {
      shortcut = code.replace('Arrow', 'ARROW_').toUpperCase();
    } else if (code.startsWith('Page')) {
      shortcut = code.replace('Page', 'PAGE_').toUpperCase();
    } else if (code === 'Tab') {
      shortcut = 'TAB';
    } else if (code.length === 4 && code.startsWith('Key')) {
      // Letter keys — uppercase (Pascal: all letter keys uppercased)
      shortcut = code.charAt(3).toUpperCase();
    } else {
      return false; // Not a key we handle
    }

    // Look up action
    const action = KEYBOARD_SHORTCUTS[shortcut];
    if (!action) {
      return false; // Not handled
    }

    // Prevent default browser behavior
    event.preventDefault();

    // Execute action with modifier state for page keys
    this.executeKeyboardAction(action, shift, ctrl);
    return true;
  }
  
  /**
   * Execute keyboard action
   */
  /**
   * Execute keyboard action matching Pascal DebuggerUnit.pas Section 8.1.
   * Actions are routed to the debugger window via events.
   */
  private executeKeyboardAction(action: string, shift: boolean = false, ctrl: boolean = false): void {
    switch (action) {
      // Execution control — routed to debugger window state machine
      case 'single-go':
        // SPACE = single-step (left-click Go equivalent)
        this.emit('command', 'GO');
        break;
      case 'repeat-toggle':
        // ENTER = toggle repeat mode (right-click Go equivalent)
        this.emit('command', 'RUN');
        break;
      case 'break':
        // B = click BREAK button (clear all conditions except INIT)
        this.emit('command', 'BREAK');
        break;
      case 'toggle-init':
        // I = toggle INIT break (right-click INIT button)
        this.emit('command', 'INIT');
        break;
      case 'toggle-debug':
        // D = toggle DEBUG break (right-click DEBUG button)
        this.emit('command', 'DEBUG');
        break;
      case 'toggle-main':
        // M = toggle MAIN single-step (right-click MAIN button)
        this.emit('command', 'MAIN');
        break;
      case 'reset-watch':
        // R = reset register watch list
        this.emit('command', 'RESET_WATCH');
        break;

      // Hub viewer navigation (Pascal Section 8.1)
      case 'hub-up':
        // UP arrow = HubAddr -= $10
        this.emit('hubNavigate', -0x10);
        break;
      case 'hub-down':
        // DOWN arrow = HubAddr += $10
        this.emit('hubNavigate', 0x10);
        break;
      case 'hub-pageup':
        // PAGEUP: $80 normal, $1000 Ctrl, $10000 Shift
        if (shift) this.emit('hubNavigate', -0x10000);
        else if (ctrl) this.emit('hubNavigate', -0x1000);
        else this.emit('hubNavigate', -0x80);
        break;
      case 'hub-pagedown':
        // PAGEDOWN: same modifiers
        if (shift) this.emit('hubNavigate', 0x10000);
        else if (ctrl) this.emit('hubNavigate', 0x1000);
        else this.emit('hubNavigate', 0x80);
        break;

      // Tab captured to prevent focus change (Pascal: DLGC_WANTTAB)
      case 'capture-tab':
        // Do nothing — just prevent default (already done by event.preventDefault)
        break;
    }
  }
  
  /**
   * Handle mouse click
   */
  public handleMouseClick(x: number, y: number, button: number): void {
    // Check for double-click
    const now = Date.now();
    const isDoubleClick = (now - this.lastClickTime) < this.doubleClickThreshold;
    this.lastClickTime = now;
    
    // Hit test
    const hit = this.hitTest(x, y);
    if (!hit) return;
    
    switch (hit.type) {
      case 'button':
        this.handleButtonClick(hit.data.command);
        break;
        
      case 'memory':
        if (isDoubleClick) {
          this.editMemory(hit.data.address);
        } else {
          this.selectMemory(hit.data.address);
        }
        break;
        
      case 'register':
        if (isDoubleClick) {
          this.editRegister(hit.data.register);
        } else {
          this.selectRegister(hit.data.register);
        }
        break;
        
      case 'disassembly':
        if (button === 0) { // Left click
          if (isDoubleClick) {
            this.toggleBreakpointAt(hit.data.address);
          } else {
            this.selectDisassemblyLine(hit.data.address);
          }
        } else if (button === 2) { // Right click
          this.showContextMenu(hit);
        }
        break;
        
      case 'pin':
        this.togglePin(hit.data.pin);
        break;
    }
    
    // Update renderer
    this.renderer.handleMouseClick(x, y);
  }
  
  /**
   * Handle mouse move for hover effects and tooltips
   */
  public handleMouseMove(x: number, y: number): void {
    // Debounce tooltip updates
    if (this.tooltipDebounceTimer) {
      clearTimeout(this.tooltipDebounceTimer);
    }
    
    this.tooltipDebounceTimer = setTimeout(() => {
      const hit = this.hitTest(x, y);
      if (hit && hit.tooltip) {
        this.renderer.setTooltip(hit.tooltip, x, y);
      } else {
        this.renderer.clearTooltip();
      }
    }, 100);
    
    // Update renderer for hover effects
    this.renderer.handleMouseMove(x, y);
  }
  
  /**
   * Handle mouse wheel for scrolling
   */
  public handleMouseWheel(deltaY: number): void {
    // Debounce scroll events
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }
    
    this.scrollDebounceTimer = setTimeout(() => {
      const scrollAmount = Math.sign(deltaY) * 3; // 3 lines per tick
      
      switch (this.currentFocus) {
        case 'disassembly':
          this.scrollDisassembly(scrollAmount);
          break;
        case 'hubMemory':
          this.scrollHubMemory(scrollAmount);
          break;
        case 'stack':
          this.scrollStack(scrollAmount);
          break;
      }
    }, 50);
  }
  
  /**
   * Hit test to determine what was clicked
   */
  private hitTest(x: number, y: number): HitTestResult | null {
    // Check buttons first (they're on top)
    const buttonHit = this.hitTestButtons(x, y);
    if (buttonHit) return buttonHit;
    
    // Check memory regions
    const memoryHit = this.hitTestMemory(x, y);
    if (memoryHit) return memoryHit;
    
    // Check disassembly
    const disassemblyHit = this.hitTestDisassembly(x, y);
    if (disassemblyHit) return disassemblyHit;
    
    // Check registers
    const registerHit = this.hitTestRegisters(x, y);
    if (registerHit) return registerHit;
    
    // Check pins
    const pinHit = this.hitTestPins(x, y);
    if (pinHit) return pinHit;
    
    return null;
  }
  
  /**
   * Hit test buttons
   */
  private hitTestButtons(x: number, y: number): HitTestResult | null {
    // Button area is in top right
    if (x >= 88 && x < 123 && y >= 2 && y < 11) {
      // Determine which button
      const relX = x - 88;
      const relY = y - 2;
      const row = Math.floor(relY / 3);
      const col = Math.floor(relX / 12);
      
      const buttons = [
        ['BREAK', 'ADDR', 'GO'],
        ['DEBUG', 'INIT', 'EVENT'],
        ['INT1', 'INT2', 'INT3', 'MAIN']
      ];
      
      if (row < buttons.length && col < buttons[row].length) {
        const button = buttons[row][col];
        return {
          region: 'controls',
          type: 'button',
          data: { command: button.toLowerCase() },
          tooltip: `Click to ${button}`
        };
      }
    }
    
    return null;
  }
  
  /**
   * Hit test memory regions
   */
  private hitTestMemory(x: number, y: number): HitTestResult | null {
    // COG registers (0,0 to 70,17)
    if (x >= 0 && x < 71 && y >= 0 && y < 18) {
      const col = Math.floor(x / 4);
      const row = y - 1; // Skip title row
      if (row >= 0 && row < 16 && col < 16) {
        const register = row * 16 + col;
        const address = register * 4;
        return {
          region: 'cogRegisters',
          type: 'memory',
          data: { address, type: 'COG' },
          tooltip: `COG Register $${register.toString(16).padStart(3, '0').toUpperCase()}`
        };
      }
    }
    
    // LUT registers (71,0 to 127,17)
    if (x >= 71 && x < 128 && y >= 0 && y < 18) {
      const col = Math.floor((x - 71) / 4);
      const row = y - 1;
      if (row >= 0 && row < 16 && col < 14) {
        const register = row * 14 + col;
        const address = 0x800 + register * 4;
        return {
          region: 'lutRegisters',
          type: 'memory',
          data: { address, type: 'LUT' },
          tooltip: `LUT Register $${register.toString(16).padStart(3, '0').toUpperCase()}`
        };
      }
    }
    
    // HUB memory (72,36 to 122,65)
    if (x >= 72 && x < 123 && y >= 36 && y < 66) {
      const row = y - 37; // Skip title
      if (row >= 0) {
        const baseAddr = this.selectedAddress + row * 16;
        return {
          region: 'hubMemory',
          type: 'memory',
          data: { address: baseAddr, type: 'HUB' },
          tooltip: `HUB Address $${baseAddr.toString(16).padStart(5, '0').toUpperCase()}`
        };
      }
    }
    
    return null;
  }
  
  /**
   * Hit test disassembly window
   */
  private hitTestDisassembly(x: number, y: number): HitTestResult | null {
    // Disassembly window (0,20 to 70,35)
    if (x >= 0 && x < 71 && y >= 20 && y < 36) {
      const row = y - 21; // Skip title
      if (row >= 0) {
        const state = this.dataManager.getCogState(this.cogId);
        if (state) {
          const pc = state.programCounter;
          const halfWindow = Math.floor((LAYOUT_CONSTANTS.DIS_LINES - 1) / 2);
          const startAddr = Math.max(0, pc - halfWindow * 4);
          const address = startAddr + row * 4;
          
          return {
            region: 'disassembly',
            type: 'disassembly',
            data: { address, row },
            tooltip: `Address $${address.toString(16).padStart(5, '0').toUpperCase()}`
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Hit test register watch area
   */
  private hitTestRegisters(x: number, y: number): HitTestResult | null {
    // Register watch (0,36 to 40,45)
    if (x >= 0 && x < 41 && y >= 36 && y < 46) {
      const row = y - 37;
      const registers = ['REGA', 'REGB', 'PTRA', 'PTRB'];
      if (row >= 0 && row < registers.length) {
        return {
          region: 'registerWatch',
          type: 'register',
          data: { register: registers[row] },
          tooltip: `${registers[row]} Register`
        };
      }
    }
    
    return null;
  }
  
  /**
   * Hit test pin states
   */
  private hitTestPins(x: number, y: number): HitTestResult | null {
    // Pin states (0,64 to 70,71)
    if (x >= 0 && x < 71 && y >= 64 && y < 72) {
      const row = y - 66; // Skip title
      if (row >= 0 && row < 2) {
        const pinBase = row * 32;
        const pinOffset = x - 8;
        if (pinOffset >= 0 && pinOffset < 32) {
          const pin = pinBase + pinOffset;
          return {
            region: 'pins',
            type: 'pin',
            data: { pin },
            tooltip: `Pin ${pin}`
          };
        }
      }
    }
    
    return null;
  }
  
  // Navigation methods
  
  private navigateUp(): void {
    switch (this.currentFocus) {
      case 'disassembly':
        this.selectedAddress = Math.max(0, this.selectedAddress - 4);
        this.renderer.setSelectedAddress(this.selectedAddress);
        break;
      case 'hubMemory':
        this.scrollPosition = Math.max(0, this.scrollPosition - 16);
        this.renderer.setSelectedAddress(this.scrollPosition);
        break;
    }
  }
  
  private navigateDown(): void {
    switch (this.currentFocus) {
      case 'disassembly':
        this.selectedAddress += 4;
        this.renderer.setSelectedAddress(this.selectedAddress);
        break;
      case 'hubMemory':
        this.scrollPosition += 16;
        this.renderer.setSelectedAddress(this.scrollPosition);
        break;
    }
  }
  
  private navigateLeft(): void {
    if (this.currentFocus === 'cogRegisters' || this.currentFocus === 'lutRegisters') {
      this.selectedRegister = Math.max(0, this.selectedRegister - 1);
    }
  }
  
  private navigateRight(): void {
    if (this.currentFocus === 'cogRegisters' || this.currentFocus === 'lutRegisters') {
      this.selectedRegister = Math.min(255, this.selectedRegister + 1);
    }
  }
  
  private pageUp(): void {
    const pageSize = this.currentFocus === 'disassembly' ? 60 : 256;
    this.scrollPosition = Math.max(0, this.scrollPosition - pageSize);
    this.renderer.setSelectedAddress(this.scrollPosition);
  }
  
  private pageDown(): void {
    const pageSize = this.currentFocus === 'disassembly' ? 60 : 256;
    this.scrollPosition += pageSize;
    this.renderer.setSelectedAddress(this.scrollPosition);
  }
  
  private navigateHome(): void {
    this.scrollPosition = 0;
    this.renderer.setSelectedAddress(0);
  }
  
  private navigateEnd(): void {
    this.scrollPosition = 0x7FFFF; // End of HUB memory
    this.renderer.setSelectedAddress(this.scrollPosition);
  }
  
  // View management
  
  private cycleView(direction: number): void {
    const views = ['disassembly', 'cogRegisters', 'lutRegisters', 'hubMemory', 'stack', 'pins'];
    const currentIndex = views.indexOf(this.currentFocus);
    const newIndex = (currentIndex + direction + views.length) % views.length;
    this.currentFocus = views[newIndex];
    
    // Mark the new focus region as dirty
    this.renderer.markRegionDirty(this.currentFocus);
  }
  
  // Scrolling methods
  
  private scrollDisassembly(lines: number): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (state) {
      const newAddr = Math.max(0, state.programCounter + lines * 4);
      // updateProgramCounter not implemented - update state directly
      state.programCounter = newAddr;
      this.renderer.markRegionDirty('disassembly');
    }
  }
  
  private scrollHubMemory(lines: number): void {
    this.scrollPosition = Math.max(0, this.scrollPosition + lines * 16);
    this.renderer.setSelectedAddress(this.scrollPosition);
  }
  
  private scrollStack(lines: number): void {
    // Stack scrolling implementation
    this.renderer.markRegionDirty('stack');
  }
  
  // Button handlers
  
  private handleButtonClick(command: string): void {
    switch (command) {
      case 'break':
        this.protocol.sendBreak(this.cogId);
        break;
      case 'addr':
        this.showAddressDialog();
        break;
      case 'go':
        this.protocol.sendGo(this.cogId);
        break;
      case 'debug':
        // Debug mode toggle not implemented in protocol
        this.logConsoleMessage('Debug mode toggle');
        break;
      case 'init':
        // Init command not implemented in protocol
        this.protocol.sendStall(this.cogId);
        break;
      case 'event':
        // Event command not implemented
        this.logConsoleMessage('Event command');
        break;
      case 'int1':
      case 'int2':
      case 'int3':
        // Interrupt command not implemented
        this.logConsoleMessage('Interrupt', command);
        break;
      case 'main':
        // Main command not implemented
        this.logConsoleMessage('Main command');
        break;
    }
  }
  
  // Selection methods
  
  private selectMemory(address: number): void {
    this.selectedAddress = address;
    this.renderer.setSelectedAddress(address);
  }
  
  private selectRegister(register: string): void {
    // Update selected register
    this.renderer.markRegionDirty('registerWatch');
  }
  
  private selectDisassemblyLine(address: number): void {
    this.selectedAddress = address;
    this.renderer.setSelectedAddress(address);
  }
  
  // Editing methods
  
  private editMemory(address: number): void {
    // Show edit dialog for memory
    this.logConsoleMessage(`Edit memory at ${address.toString(16)}`);
  }

  private editRegister(register: string): void {
    // Show edit dialog for register
    this.logConsoleMessage(`Edit register ${register}`);
  }
  
  // Breakpoint methods
  
  private toggleBreakpoint(): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (state) {
      const address = this.selectedAddress || state.programCounter;
      this.toggleBreakpointAt(address);
    }
  }
  
  private toggleBreakpointAt(address: number): void {
    const state = this.dataManager.getCogState(this.cogId);
    if (state) {
      if (state.breakpoints.has(address)) {
        this.dataManager.clearBreakpoint(this.cogId, address);
      } else {
        this.dataManager.setBreakpoint(this.cogId, address);
      }
      this.renderer.markRegionDirty('disassembly');
    }
  }
  
  private clearAllBreakpoints(): void {
    this.dataManager.clearBreakpoint(this.cogId, -1); // Clear all
    this.renderer.markRegionDirty('disassembly');
  }
  
  // Pin control
  
  private togglePin(pin: number): void {
    // Toggle pin state
    this.logConsoleMessage(`Toggle pin ${pin}`);
    this.renderer.markRegionDirty('pins');
  }
  
  // UI methods
  
  private showContextMenu(hit: HitTestResult): void {
    // Show context menu at hit location
    this.logConsoleMessage('Show context menu for', hit);
  }
  
  private showAddressDialog(): void {
    // Show dialog to jump to address
    this.logConsoleMessage('Show address dialog');
  }
  
  private showHelp(): void {
    // Show help dialog with keyboard shortcuts
    this.logConsoleMessage('Show help');
  }
  
  private requestClose(): void {
    // Request window close
    this.logConsoleMessage('Request close');
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }
    if (this.tooltipDebounceTimer) {
      clearTimeout(this.tooltipDebounceTimer);
    }
  }
}