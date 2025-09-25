/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

// src/classes/shared/emergencyMode.ts

import { EventEmitter } from 'events';
import { PerformanceWatchdog, PerformanceLevel, PerformanceAlert } from './performanceWatchdog';
import { MessageRouter } from './messageRouter';
import { SerialMessageProcessor } from './serialMessageProcessor';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Emergency mode levels for graceful degradation
 */
export enum EmergencyLevel {
  NORMAL = 'normal',       // Full functionality
  YELLOW = 'yellow',       // Reduced UI updates, batch operations
  ORANGE = 'orange',       // Disable pattern matching, skip parsing
  RED = 'red'             // Raw capture only, disk storage
}

/**
 * Configuration for each emergency level
 */
export interface EmergencyLevelConfig {
  uiUpdateIntervalMs: number;
  batchWindowUpdates: boolean;
  enablePatternMatching: boolean;
  enableCOGParsing: boolean;
  combineConsecutiveMessages: boolean;
  enableLogging: boolean;
  rawCaptureMode: boolean;
  diskStoragePath?: string;
}

/**
 * Emergency mode configuration
 */
export interface EmergencyModeConfig {
  hysteresisTimeMs: number;            // Time before level changes (prevent flapping)
  autoRecoveryEnabled: boolean;        // Auto-recover when load decreases
  recoveryCheckIntervalMs: number;     // How often to check for recovery
  manualOverride: boolean;             // Allow manual mode selection
  diskStoragePath: string;             // Path for raw capture storage
}

/**
 * Emergency mode state change event
 */
export interface EmergencyModeChange {
  previousLevel: EmergencyLevel;
  newLevel: EmergencyLevel;
  trigger: 'automatic' | 'manual';
  reason: string;
  timestamp: number;
  config: EmergencyLevelConfig;
}

/**
 * Emergency Mode System - Graceful degradation under extreme load
 * 
 * RESPONSIBILITIES:
 * - Monitor system performance via PerformanceWatchdog
 * - Automatically switch between degradation levels
 * - Apply appropriate optimizations for each level
 * - Manage recovery when load decreases
 * - Provide manual override capabilities
 * - Log all mode transitions
 */
export class EmergencyModeSystem extends EventEmitter {
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

  private static instance: EmergencyModeSystem;
  
  private watchdog: PerformanceWatchdog;
  private currentLevel: EmergencyLevel = EmergencyLevel.NORMAL;
  private manualMode: EmergencyLevel | null = null;
  
  private config: EmergencyModeConfig = {
    hysteresisTimeMs: 5000,
    autoRecoveryEnabled: true,
    recoveryCheckIntervalMs: 10000,
    manualOverride: false,
    diskStoragePath: './emergency-captures'
  };
  
  // Level configurations
  private levelConfigs: Map<EmergencyLevel, EmergencyLevelConfig> = new Map([
    [EmergencyLevel.NORMAL, {
      uiUpdateIntervalMs: 16,        // 60fps
      batchWindowUpdates: false,
      enablePatternMatching: true,
      enableCOGParsing: true,
      combineConsecutiveMessages: false,
      enableLogging: true,
      rawCaptureMode: false
    }],
    [EmergencyLevel.YELLOW, {
      uiUpdateIntervalMs: 100,       // 10fps
      batchWindowUpdates: true,
      enablePatternMatching: true,
      enableCOGParsing: true,
      combineConsecutiveMessages: false,
      enableLogging: true,           // Reduced logging
      rawCaptureMode: false
    }],
    [EmergencyLevel.ORANGE, {
      uiUpdateIntervalMs: 200,       // 5fps
      batchWindowUpdates: true,
      enablePatternMatching: false,   // Skip pattern matching
      enableCOGParsing: false,        // Skip COG parsing
      combineConsecutiveMessages: true,
      enableLogging: false,           // Minimal logging
      rawCaptureMode: false
    }],
    [EmergencyLevel.RED, {
      uiUpdateIntervalMs: 1000,      // 1fps
      batchWindowUpdates: true,
      enablePatternMatching: false,
      enableCOGParsing: false,
      combineConsecutiveMessages: true,
      enableLogging: false,
      rawCaptureMode: true,           // Raw capture to disk
      diskStoragePath: './emergency-captures'
    }]
  ]);
  
  // Tracking for hysteresis
  private levelChangeRequested: EmergencyLevel | null = null;
  private levelChangeRequestTime: number = 0;
  private hysteresisTimer?: NodeJS.Timeout;
  
  // Recovery tracking
  private recoveryCheckTimer?: NodeJS.Timeout;
  private lastRecoveryCheck: number = Date.now();
  
  // Raw capture state
  private rawCaptureStream?: fs.WriteStream;
  private rawCaptureFile?: string;
  private capturedBytes: number = 0;
  
  // Mode history
  private modeHistory: EmergencyModeChange[] = [];
  private maxHistorySize: number = 100;
  
  private constructor() {
    super();
    this.watchdog = PerformanceWatchdog.getInstance();
    this.setupWatchdogListeners();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): EmergencyModeSystem {
    if (!EmergencyModeSystem.instance) {
      EmergencyModeSystem.instance = new EmergencyModeSystem();
    }
    return EmergencyModeSystem.instance;
  }
  
  /**
   * Configure emergency mode system
   */
  public configure(config: Partial<EmergencyModeConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Ensure disk storage path exists
    if (this.config.diskStoragePath) {
      try {
        if (!fs.existsSync(this.config.diskStoragePath)) {
          fs.mkdirSync(this.config.diskStoragePath, { recursive: true });
        }
      } catch (error) {
        this.logConsoleMessage('[EmergencyMode] Failed to create disk storage path:', error);
      }
    }
  }
  
  /**
   * Setup performance watchdog listeners
   */
  private setupWatchdogListeners(): void {
    this.watchdog.on('alert', (alert: PerformanceAlert) => {
      if (this.config.manualOverride && this.manualMode !== null) {
        return; // Manual mode takes precedence
      }
      
      // Map performance levels to emergency levels
      let targetLevel: EmergencyLevel;
      switch (alert.level) {
        case PerformanceLevel.GREEN:
          targetLevel = EmergencyLevel.NORMAL;
          break;
        case PerformanceLevel.YELLOW:
          targetLevel = EmergencyLevel.YELLOW;
          break;
        case PerformanceLevel.ORANGE:
          targetLevel = EmergencyLevel.ORANGE;
          break;
        case PerformanceLevel.RED:
          targetLevel = EmergencyLevel.RED;
          break;
        default:
          targetLevel = EmergencyLevel.NORMAL;
      }
      
      this.requestLevelChange(targetLevel, 'automatic', alert.message);
    });
  }
  
  /**
   * Request a level change with hysteresis
   */
  private requestLevelChange(level: EmergencyLevel, trigger: 'automatic' | 'manual', reason: string): void {
    if (level === this.currentLevel) {
      return; // Already at this level
    }
    
    // Check if this is the same request
    if (this.levelChangeRequested === level) {
      const elapsed = Date.now() - this.levelChangeRequestTime;
      
      if (elapsed >= this.config.hysteresisTimeMs) {
        // Enough time has passed, apply the change
        this.applyLevelChange(level, trigger, reason);
      }
      // Otherwise wait for hysteresis timer
    } else {
      // New level requested
      this.levelChangeRequested = level;
      this.levelChangeRequestTime = Date.now();
      
      // Clear existing timer
      if (this.hysteresisTimer) {
        clearTimeout(this.hysteresisTimer);
      }
      
      // Set new timer
      this.hysteresisTimer = setTimeout(() => {
        if (this.levelChangeRequested === level) {
          this.applyLevelChange(level, trigger, reason);
        }
      }, this.config.hysteresisTimeMs);
    }
  }
  
  /**
   * Apply emergency level change
   */
  private applyLevelChange(level: EmergencyLevel, trigger: 'automatic' | 'manual', reason: string): void {
    const previousLevel = this.currentLevel;
    this.currentLevel = level;
    this.levelChangeRequested = null;
    
    const config = this.levelConfigs.get(level)!;
    
    // Record change
    const change: EmergencyModeChange = {
      previousLevel,
      newLevel: level,
      trigger,
      reason,
      timestamp: Date.now(),
      config
    };
    
    this.modeHistory.push(change);
    if (this.modeHistory.length > this.maxHistorySize) {
      this.modeHistory.shift();
    }
    
    // Apply level-specific actions
    this.applyLevelConfig(level, config);
    
    // Emit change event
    this.emit('modeChange', change);
    
    this.logConsoleMessage(`[EmergencyMode] Changed from ${previousLevel} to ${level}: ${reason}`);
    
    // Start/stop recovery checking
    if (level !== EmergencyLevel.NORMAL && this.config.autoRecoveryEnabled) {
      this.startRecoveryChecking();
    } else if (level === EmergencyLevel.NORMAL) {
      this.stopRecoveryChecking();
    }
  }
  
  /**
   * Apply configuration for emergency level
   */
  private applyLevelConfig(level: EmergencyLevel, config: EmergencyLevelConfig): void {
    // Emit configuration changes for other components to react
    this.emit('configUpdate', {
      level,
      config
    });
    
    // Handle raw capture mode
    if (config.rawCaptureMode && !this.rawCaptureStream) {
      this.startRawCapture();
    } else if (!config.rawCaptureMode && this.rawCaptureStream) {
      this.stopRawCapture();
    }
    
    // Apply UI update throttling
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.setUIUpdateInterval(config.uiUpdateIntervalMs);
    }
    
    // Configure message router
    const router = (MessageRouter as any).instance;
    if (router) {
      if (!config.enablePatternMatching) {
        // Route everything to terminal only
        router.setEmergencyRouting(true);
      } else {
        router.setEmergencyRouting(false);
      }
    }
  }
  
  /**
   * Start raw capture to disk
   */
  private startRawCapture(): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.rawCaptureFile = path.join(this.config.diskStoragePath, `raw-capture-${timestamp}.bin`);
      
      this.rawCaptureStream = fs.createWriteStream(this.rawCaptureFile);
      this.capturedBytes = 0;
      
      this.logConsoleMessage(`[EmergencyMode] Started raw capture to ${this.rawCaptureFile}`);
      
      // Write header
      const header = Buffer.from(JSON.stringify({
        version: '1.0',
        startTime: timestamp,
        mode: 'emergency-raw-capture'
      }) + '\n');
      
      this.rawCaptureStream.write(header);
    } catch (error) {
      this.logConsoleMessage('[EmergencyMode] Failed to start raw capture:', error);
    }
  }
  
  /**
   * Stop raw capture
   */
  private stopRawCapture(): void {
    if (this.rawCaptureStream) {
      this.rawCaptureStream.end();
      this.logConsoleMessage(`[EmergencyMode] Stopped raw capture. Captured ${this.capturedBytes} bytes to ${this.rawCaptureFile}`);
      
      this.rawCaptureStream = undefined;
      this.rawCaptureFile = undefined;
      this.capturedBytes = 0;
    }
  }
  
  /**
   * Write data to raw capture
   */
  public captureRawData(data: Uint8Array): void {
    if (this.rawCaptureStream && !this.rawCaptureStream.destroyed) {
      this.rawCaptureStream.write(Buffer.from(data));
      this.capturedBytes += data.length;
    }
  }
  
  /**
   * Start checking for recovery opportunity
   */
  private startRecoveryChecking(): void {
    if (this.recoveryCheckTimer) {
      return; // Already checking
    }
    
    this.recoveryCheckTimer = setInterval(() => {
      const metrics = this.watchdog.getCurrentMetrics();
      if (!metrics) return;
      
      // Check if we can step down emergency level
      let canRecover = false;
      const currentConfig = this.levelConfigs.get(this.currentLevel)!;
      
      switch (this.currentLevel) {
        case EmergencyLevel.RED:
          // Can move to ORANGE if no data loss
          canRecover = metrics.droppedBytesPerSecond === 0;
          break;
        case EmergencyLevel.ORANGE:
          // Can move to YELLOW if buffer < 50%
          canRecover = metrics.bufferUsagePercent < 50;
          break;
        case EmergencyLevel.YELLOW:
          // Can move to NORMAL if buffer < 30% and queues low
          canRecover = metrics.bufferUsagePercent < 30 && metrics.queueDepth < 50;
          break;
      }
      
      if (canRecover) {
        const newLevel = this.getRecoveryLevel(this.currentLevel);
        this.requestLevelChange(newLevel, 'automatic', 'Load decreased - recovery possible');
      }
    }, this.config.recoveryCheckIntervalMs);
  }
  
  /**
   * Stop recovery checking
   */
  private stopRecoveryChecking(): void {
    if (this.recoveryCheckTimer) {
      clearInterval(this.recoveryCheckTimer);
      this.recoveryCheckTimer = undefined;
    }
  }
  
  /**
   * Get the recovery level from current level
   */
  private getRecoveryLevel(current: EmergencyLevel): EmergencyLevel {
    switch (current) {
      case EmergencyLevel.RED:
        return EmergencyLevel.ORANGE;
      case EmergencyLevel.ORANGE:
        return EmergencyLevel.YELLOW;
      case EmergencyLevel.YELLOW:
        return EmergencyLevel.NORMAL;
      default:
        return EmergencyLevel.NORMAL;
    }
  }
  
  /**
   * Manually set emergency level
   */
  public setManualMode(level: EmergencyLevel | null): void {
    if (!this.config.manualOverride) {
      this.logConsoleMessage('[EmergencyMode] Manual override not enabled');
      return;
    }
    
    this.manualMode = level;
    
    if (level !== null) {
      this.requestLevelChange(level, 'manual', 'Manual override');
    } else {
      // Return to automatic mode
      this.logConsoleMessage('[EmergencyMode] Manual mode disabled, returning to automatic');
    }
  }
  
  /**
   * Get current emergency level
   */
  public getCurrentLevel(): EmergencyLevel {
    return this.currentLevel;
  }
  
  /**
   * Get current level configuration
   */
  public getCurrentConfig(): EmergencyLevelConfig {
    return this.levelConfigs.get(this.currentLevel)!;
  }
  
  /**
   * Get mode history
   */
  public getModeHistory(): EmergencyModeChange[] {
    return [...this.modeHistory];
  }
  
  /**
   * Generate diagnostic report
   */
  public generateReport(): string {
    const current = this.currentLevel;
    const config = this.getCurrentConfig();
    const history = this.modeHistory.slice(-10);
    
    const report = [
      '=== EMERGENCY MODE SYSTEM REPORT ===',
      `Generated: ${new Date().toISOString()}`,
      '',
      `Current Level: ${current.toUpperCase()}`,
      `Manual Override: ${this.manualMode ? this.manualMode.toUpperCase() : 'Disabled'}`,
      `Auto Recovery: ${this.config.autoRecoveryEnabled ? 'Enabled' : 'Disabled'}`,
      '',
      '--- CURRENT CONFIGURATION ---',
      `UI Updates: ${config.uiUpdateIntervalMs}ms (${Math.round(1000/config.uiUpdateIntervalMs)}fps)`,
      `Batch Windows: ${config.batchWindowUpdates ? 'Yes' : 'No'}`,
      `Pattern Matching: ${config.enablePatternMatching ? 'Enabled' : 'Disabled'}`,
      `COG Parsing: ${config.enableCOGParsing ? 'Enabled' : 'Disabled'}`,
      `Combine Messages: ${config.combineConsecutiveMessages ? 'Yes' : 'No'}`,
      `Logging: ${config.enableLogging ? 'Enabled' : 'Disabled'}`,
      `Raw Capture: ${config.rawCaptureMode ? 'Active' : 'Inactive'}`,
      '',
      '--- RAW CAPTURE STATUS ---',
      `Active: ${this.rawCaptureStream ? 'Yes' : 'No'}`,
      `File: ${this.rawCaptureFile || 'None'}`,
      `Bytes Captured: ${this.capturedBytes.toLocaleString()}`,
      '',
      '--- MODE HISTORY (Last 10) ---',
      ...history.map(h => 
        `${new Date(h.timestamp).toLocaleTimeString()}: ${h.previousLevel} → ${h.newLevel} (${h.trigger}): ${h.reason}`
      ),
      '================================='
    ];
    
    return report.join('\n');
  }
  
  /**
   * Reset emergency mode system
   */
  public reset(): void {
    this.stopRawCapture();
    this.stopRecoveryChecking();
    this.currentLevel = EmergencyLevel.NORMAL;
    this.manualMode = null;
    this.levelChangeRequested = null;
    this.modeHistory = [];
    
    if (this.hysteresisTimer) {
      clearTimeout(this.hysteresisTimer);
      this.hysteresisTimer = undefined;
    }
    
    this.logConsoleMessage('[EmergencyMode] System reset');
  }
}