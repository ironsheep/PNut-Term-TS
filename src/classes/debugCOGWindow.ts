/** @format */

// src/classes/debugCOGWindow.ts

import { DebugWindowBase } from './debugWindowBase';
import { Context } from '../utils/context';
import { PlacementStrategy } from '../utils/windowPlacer';

/**
 * @class DebugCOGWindow
 * @extends DebugWindowBase
 * 
 * @description COG-specific debug window for displaying messages from a single Propeller 2 COG.
 * One of 8 possible COG windows (COG 0-7) that display filtered debug output.
 * 
 * Features:
 * - Displays messages only from its assigned COG ID
 * - Visual states: dormant (no traffic) vs active (has messages)
 * - Supports history replay when opened after messages received
 * - Part of the 8-COG splitter window system
 * 
 * Window behavior:
 * - Auto-created when COG messages detected (ON_DEMAND mode)
 * - All 8 created with "Show All COGs" button (SHOW_ALL mode)
 * - Uses special 2x4 grid placement for organized layout
 * - Theme switches instantly between dormant/active states
 * 
 * @since Sprint 2
 */
export class DebugCOGWindow extends DebugWindowBase {
  private cogId: number;
  private messageCount: number = 0;
  private hasReceivedTraffic: boolean = false;
  private historyBuffer: string[] = [];
  private readonly MAX_HISTORY_SIZE = 10000;

  /**
   * Creates a new COG debug window for a specific COG ID
   * 
   * @param {number} cogId - The COG ID (0-7) this window represents
   * @param {any} params - Window initialization parameters
   */
  constructor(cogId: number, params: { 
    mainWindow: any; 
    context: Context; 
    placementStrategy?: PlacementStrategy;
    windowId?: string;
  }) {
    // Validate COG ID
    if (cogId < 0 || cogId > 7) {
      throw new Error(`Invalid COG ID: ${cogId}. Must be 0-7`);
    }

    // Call parent constructor with required parameters
    super(
      params.context, 
      params.windowId || `COG-${cogId}`,
      `COG${cogId}`
    );
    
    this.cogId = cogId;
    
    // Set up window-specific properties
    this.setWindowProperties();
  }

  /**
   * Get the COG ID this window represents
   */
  public getCOGId(): number {
    return this.cogId;
  }

  /**
   * Set window-specific properties for COG windows
   */
  private setWindowProperties(): void {
    // Add COG-specific CSS classes and properties
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      // Inject COG ID into window for client-side scripts
      this.debugWindow.webContents.executeJavaScript(`
        window.cogId = ${this.cogId};
        window.isCOGWindow = true;
        document.body.classList.add('debug-cog-window');
        document.body.classList.add('cog-${this.cogId}');
        
        // Start in dormant state (will switch to active on first message)
        document.body.classList.add('cog-dormant');
      `);
    }
  }

  /**
   * Generate HTML content for COG window
   */
  public generateHTML(): string {
    const canvasId = this.getCanvasId();
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>COG ${this.cogId} Debug Window</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #1e1e1e;
      color: #ffffff;
      font-family: 'Parallax', 'Courier New', monospace;
      overflow: hidden;
    }
    
    .cog-dormant {
      background: #2d2d30 !important;
      color: #888888 !important;
    }
    
    .cog-active {
      background: #1e1e1e !important;
      color: #ffffff !important;
    }
    
    #${canvasId} {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: inherit;
    }
    
    #message-overlay {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      pointer-events: none;
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-y: auto;
      z-index: 10;
    }
  </style>
</head>
<body class="cog-dormant">
  <canvas id="${canvasId}" width="400" height="300"></canvas>
  <div id="message-overlay"></div>
  
  <script>
    const { ipcRenderer } = require('electron');
    const canvas = document.getElementById('${canvasId}');
    const ctx = canvas.getContext('2d');
    const messageOverlay = document.getElementById('message-overlay');
    
    // Resize canvas to fill window
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawCanvas();
    }
    
    // Initial canvas setup
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Message display
    let messageCount = 0;
    
    ipcRenderer.on('cog-message', (event, data) => {
      messageCount++;
      
      // Switch to active theme on first message
      if (messageCount === 1) {
        document.body.classList.remove('cog-dormant');
        document.body.classList.add('cog-active');
      }
      
      // Display message in overlay
      const messageElement = document.createElement('div');
      messageElement.textContent = \`[\${data.timestamp}] \${data.message}\`;
      messageOverlay.appendChild(messageElement);
      
      // Auto-scroll to bottom
      messageOverlay.scrollTop = messageOverlay.scrollHeight;
      
      // Keep only last 100 messages
      while (messageOverlay.children.length > 100) {
        messageOverlay.removeChild(messageOverlay.firstChild);
      }
      
      redrawCanvas();
    });
    
    function redrawCanvas() {
      // Clear canvas
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw COG ID in center
      ctx.fillStyle = getComputedStyle(document.body).color;
      ctx.font = '24px Parallax, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('COG ${this.cogId}', canvas.width / 2, canvas.height / 2);
      
      // Draw message count
      ctx.font = '12px Parallax, monospace';
      ctx.fillText(\`Messages: \${messageCount}\`, canvas.width / 2, canvas.height / 2 + 40);
    }
    
    // Initial draw
    redrawCanvas();
  </script>
</body>
</html>`;
  }

  /**
   * Process incoming COG message
   * Handles theme switching on first message
   * 
   * @param {string} message - The debug message from this COG
   */
  public processCOGMessage(message: string): void {
    // Track first message for theme switching
    const wasFirstMessage = !this.hasReceivedTraffic;
    
    if (wasFirstMessage) {
      this.hasReceivedTraffic = true;
      this.switchToActiveTheme();
    }
    
    // Add to history buffer
    this.historyBuffer.push(message);
    if (this.historyBuffer.length > this.MAX_HISTORY_SIZE) {
      // Remove oldest 10% when buffer is full
      const removeCount = Math.floor(this.MAX_HISTORY_SIZE * 0.1);
      this.historyBuffer.splice(0, removeCount);
    }
    
    // Increment message counter
    this.messageCount++;
    
    // Send to window display
    this.sendToWindow(message);
  }

  /**
   * Send message to window for display
   * 
   * @param {string} message - Message to display
   */
  private sendToWindow(message: string): void {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send('cog-message', {
        cogId: this.cogId,
        message: message,
        timestamp: new Date().toISOString(),
        messageNumber: this.messageCount
      });
    }
  }

  /**
   * Switch window to active theme (has received messages)
   */
  private switchToActiveTheme(): void {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.executeJavaScript(`
        // Remove dormant indicator and switch to active theme
        document.body.classList.remove('cog-dormant');
        document.body.classList.add('cog-active');
        
        // Flash effect for first message
        document.body.classList.add('cog-first-message');
        setTimeout(() => document.body.classList.remove('cog-first-message'), 500);
        
        // Remove any dormant indicator element
        const indicator = document.getElementById('cog-dormant-indicator');
        if (indicator) {
          indicator.remove();
        }
        
        // Update window title to show activity
        document.title = 'COG ${this.cogId} Debug (Active)';
      `);
    }
  }

  /**
   * Receive batch of history messages for replay
   * Used when window is opened after messages already received
   * 
   * @param {string[]} messages - Array of historical messages
   */
  public receiveHistoryBatch(messages: string[]): void {
    // Process all messages but don't trigger theme switch multiple times
    const wasInactive = !this.hasReceivedTraffic;
    
    for (const message of messages) {
      this.historyBuffer.push(message);
      this.messageCount++;
    }
    
    // Trim buffer if needed
    if (this.historyBuffer.length > this.MAX_HISTORY_SIZE) {
      const excess = this.historyBuffer.length - this.MAX_HISTORY_SIZE;
      this.historyBuffer.splice(0, excess);
    }
    
    // Switch theme once if this is first batch
    if (wasInactive && messages.length > 0) {
      this.hasReceivedTraffic = true;
      this.switchToActiveTheme();
    }
    
    // Send all messages to window
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send('cog-history-batch', {
        cogId: this.cogId,
        messages: messages,
        totalCount: this.messageCount
      });
    }
  }

  /**
   * Handle window close event
   */
  protected onWindowClosed(): void {
    // Notify COGWindowManager that user closed this window
    // Send notification through IPC or event system
    process.nextTick(() => {
      // Use nextTick to avoid any timing issues
      this.emit('cog-window-closed', this.cogId);
    });
    
    // Clean up
    this.closeDebugWindow();
  }

  /**
   * Get window statistics for monitoring
   */
  public getStatistics(): any {
    return {
      cogId: this.cogId,
      messageCount: this.messageCount,
      hasTraffic: this.hasReceivedTraffic,
      bufferSize: this.historyBuffer.length,
      isOpen: this.debugWindow && !this.debugWindow.isDestroyed()
    };
  }

  /**
   * Clear all messages and reset state
   */
  public clear(): void {
    this.messageCount = 0;
    this.historyBuffer = [];
    
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send('clear-display');
    }
  }

  /**
   * Export COG messages to string for saving
   */
  public exportMessages(): string {
    const header = [
      '='.repeat(80),
      `COG ${this.cogId} Debug Log Export`,
      `Exported: ${new Date().toISOString()}`,
      `Total Messages: ${this.messageCount}`,
      '='.repeat(80),
      ''
    ].join('\n');
    
    const content = this.historyBuffer.join('\n');
    
    const footer = [
      '',
      '='.repeat(80),
      `End of COG ${this.cogId} Export`,
      '='.repeat(80)
    ].join('\n');
    
    return header + content + footer;
  }

  /**
   * Handle commands routed to this window
   * COG windows have limited command support
   * 
   * @param {string} commandName - Command name
   * @param {any[]} args - Command arguments
   */
  public handleCommand(commandName: string, ...args: any[]): void {
    switch (commandName.toUpperCase()) {
      case 'CLEAR':
      case 'CLS':
        this.clear();
        break;
        
      case 'SAVE':
      case 'EXPORT':
        // Trigger export through main window
        this.emit('request-export', this.cogId);
        break;
        
      case 'THEME':
        // COG windows use automatic theme switching, not manual
        console.log(`COG ${this.cogId}: Theme is automatically managed based on traffic`);
        break;
        
      default:
        // Most commands not applicable to COG windows
        console.log(`COG ${this.cogId}: Command '${commandName}' not supported for COG windows`);
    }
  }

  /**
   * Get window type identifier
   */
  public getWindowType(): string {
    return `COG${this.cogId}`;
  }

  /**
   * Check if window has received any traffic
   */
  public hasTraffic(): boolean {
    return this.hasReceivedTraffic;
  }

  /**
   * Get window reference for COGWindowManager
   */
  public getWindow(): any {
    return this.debugWindow;
  }

  /**
   * Required abstract method implementation
   */
  public closeDebugWindow(): void {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.close();
    }
  }

  /**
   * Required abstract method implementation
   */
  protected processMessageImmediate(lineParts: string[] | any): void {
    // COG windows process messages through processCOGMessage
    // This is here to satisfy the abstract requirement
    if (typeof lineParts === 'string') {
      this.processCOGMessage(lineParts);
    } else if (Array.isArray(lineParts)) {
      this.processCOGMessage(lineParts.join(' '));
    }
  }

  /**
   * Required abstract method implementation
   */
  protected getCanvasId(): string {
    return `cog-canvas-${this.cogId}`;
  }
}