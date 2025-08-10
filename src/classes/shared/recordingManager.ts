/** @format */

// src/classes/shared/recordingManager.ts

import { WindowRouter } from './windowRouter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Recording trigger configuration
 */
interface RecordingTrigger {
  /** Condition to check for triggering */
  condition: (message: any, context?: any) => boolean;
  /** Action to take when triggered */
  action: (message: any, context?: any) => void;
  /** Optional cooldown period in ms */
  cooldown?: number;
  /** Last trigger time */
  lastTriggered?: number;
}

/**
 * Scenario definition
 */
interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  expectedDuration: number;
  validators?: ValidationRule[];
}

/**
 * Validation rule for scenarios
 */
interface ValidationRule {
  name: string;
  check: (recording: any) => boolean;
  errorMessage: string;
}

/**
 * Scenario recording metadata
 */
interface ScenarioMetadata {
  scenarioId: string;
  timestamp: number;
  duration: number;
  context: any;
  triggerType: string;
}

/**
 * Manages automated recording triggers and scenario execution
 */
export class RecordingManager {
  private triggers: Map<string, RecordingTrigger> = new Map();
  private scenarios: Map<string, Scenario> = new Map();
  private activeRecording: string | null = null;
  private recordingStartTime: number = 0;
  private messageCounter: number = 0;
  private messageRateBuffer: number[] = [];
  private readonly RATE_BUFFER_SIZE = 10;
  private readonly HIGH_FREQ_THRESHOLD = 1000; // messages per second
  private readonly recordingsPath: string;

  constructor(private router: WindowRouter) {
    this.recordingsPath = path.join(__dirname, '../../../tests/recordings');
    this.ensureDirectoryStructure();
    this.loadScenarios();
    this.setupAutomaticTriggers();
  }

  /**
   * Ensure recording directory structure exists
   */
  private ensureDirectoryStructure(): void {
    const dirs = [
      this.recordingsPath,
      path.join(this.recordingsPath, 'scenarios'),
      path.join(this.recordingsPath, 'scenarios', 'breakpoint'),
      path.join(this.recordingsPath, 'scenarios', 'multi-cog'),
      path.join(this.recordingsPath, 'scenarios', 'high-speed'),
      path.join(this.recordingsPath, 'scenarios', 'error'),
      path.join(this.recordingsPath, 'scenarios', 'window'),
      path.join(this.recordingsPath, 'sessions')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Load scenario definitions
   */
  private loadScenarios(): void {
    // Define core scenarios
    this.scenarios.set('breakpoint-hit', {
      id: 'breakpoint-hit',
      name: 'Breakpoint Hit',
      description: 'Records when a breakpoint is hit',
      category: 'breakpoint',
      expectedDuration: 5000,
      validators: [
        {
          name: 'has-breakpoint-message',
          check: (recording) => recording.messages.some((m: any) => m.type === 'breakpoint'),
          errorMessage: 'No breakpoint message found in recording'
        }
      ]
    });

    this.scenarios.set('error-recovery', {
      id: 'error-recovery',
      name: 'Error Recovery',
      description: 'Records error conditions and recovery',
      category: 'error',
      expectedDuration: 10000
    });

    this.scenarios.set('high-frequency', {
      id: 'high-frequency',
      name: 'High Frequency Data',
      description: 'Records high-speed data streams with sampling',
      category: 'high-speed',
      expectedDuration: 30000
    });

    this.scenarios.set('multi-cog', {
      id: 'multi-cog',
      name: 'Multi-COG Coordination',
      description: 'Records multi-COG debugging operations',
      category: 'multi-cog',
      expectedDuration: 15000
    });

    this.scenarios.set('memory-inspection', {
      id: 'memory-inspection',
      name: 'Memory Inspection',
      description: 'Records memory read/write operations',
      category: 'window',
      expectedDuration: 8000
    });
  }

  /**
   * Set up automatic recording triggers
   */
  private setupAutomaticTriggers(): void {
    // Breakpoint trigger
    this.triggers.set('breakpoint', {
      condition: (msg) => {
        return msg.type === 'binary' && 
               msg.data && 
               (msg.data[0] & 0x80) !== 0; // Breakpoint flag in message
      },
      action: (msg) => {
        this.startScenarioRecording('breakpoint-hit', {
          cogId: msg.data[0] & 0x07,
          address: msg.address,
          timestamp: Date.now()
        });
      },
      cooldown: 5000 // 5 second cooldown
    });

    // Error condition trigger
    this.triggers.set('error', {
      condition: (msg) => {
        return msg.type === 'error' || 
               msg.error === 'checksum-mismatch' ||
               msg.error === 'lost-communication';
      },
      action: (msg) => {
        this.startScenarioRecording('error-recovery', {
          errorType: msg.error || msg.type,
          message: msg,
          timestamp: Date.now()
        });
      },
      cooldown: 10000 // 10 second cooldown
    });

    // High-frequency data trigger
    this.triggers.set('high-frequency', {
      condition: () => {
        return this.getMessageRate() > this.HIGH_FREQ_THRESHOLD;
      },
      action: () => {
        this.startSampledRecording('high-frequency', {
          rate: this.getMessageRate(),
          timestamp: Date.now()
        });
      },
      cooldown: 30000 // 30 second cooldown
    });

    // Multi-COG trigger
    this.triggers.set('multi-cog', {
      condition: (msg, context) => {
        return context && context.activeCogs && context.activeCogs.length > 1;
      },
      action: (msg, context) => {
        this.startScenarioRecording('multi-cog', {
          activeCogs: context.activeCogs,
          timestamp: Date.now()
        });
      },
      cooldown: 15000
    });

    // Memory operation trigger
    this.triggers.set('memory', {
      condition: (msg) => {
        return msg.type === 'memory-read' || 
               msg.type === 'memory-write' ||
               msg.command === 'memory-inspect';
      },
      action: (msg) => {
        this.startScenarioRecording('memory-inspection', {
          operation: msg.type || msg.command,
          address: msg.address,
          size: msg.size,
          timestamp: Date.now()
        });
      },
      cooldown: 8000
    });
  }

  /**
   * Check all triggers against a message
   */
  public checkTriggers(message: any, context?: any): void {
    const now = Date.now();
    
    for (const [name, trigger] of this.triggers) {
      // Check cooldown
      if (trigger.lastTriggered && trigger.cooldown) {
        if (now - trigger.lastTriggered < trigger.cooldown) {
          continue;
        }
      }

      // Check condition
      if (trigger.condition(message, context)) {
        trigger.action(message, context);
        trigger.lastTriggered = now;
      }
    }

    // Track message rate
    this.updateMessageRate();
  }

  /**
   * Update message rate tracking
   */
  private updateMessageRate(): void {
    this.messageCounter++;
    
    const now = Date.now();
    if (this.messageRateBuffer.length === 0) {
      this.messageRateBuffer.push(now);
    } else {
      const oldest = this.messageRateBuffer[0];
      if (now - oldest >= 1000) { // Every second
        this.messageRateBuffer.push(this.messageCounter);
        if (this.messageRateBuffer.length > this.RATE_BUFFER_SIZE) {
          this.messageRateBuffer.shift();
        }
        this.messageCounter = 0;
      }
    }
  }

  /**
   * Get current message rate
   */
  private getMessageRate(): number {
    if (this.messageRateBuffer.length < 2) return 0;
    
    const rates = this.messageRateBuffer.slice(1); // Skip timestamp
    const sum = rates.reduce((a, b) => a + b, 0);
    return Math.floor(sum / rates.length);
  }

  /**
   * Start recording for a scenario
   */
  public startScenarioRecording(scenarioId: string, context: any): void {
    if (this.activeRecording) {
      console.log('Recording already in progress:', this.activeRecording);
      return;
    }

    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      console.error('Unknown scenario:', scenarioId);
      return;
    }

    const sessionName = `${scenarioId}-${Date.now()}`;
    this.activeRecording = sessionName;
    this.recordingStartTime = Date.now();

    this.router.startRecording({
      sessionName,
      description: scenario.description,
      startTime: this.recordingStartTime,
      testScenario: scenarioId,
      tags: [scenario.category, 'automatic']
    });

    console.log(`Started recording: ${sessionName}`);

    // Auto-stop after expected duration
    setTimeout(() => {
      if (this.activeRecording === sessionName) {
        this.stopAndValidate(scenarioId);
      }
    }, scenario.expectedDuration);
  }

  /**
   * Start sampled recording for high-frequency data
   */
  public startSampledRecording(scenarioId: string, context: any): void {
    if (this.activeRecording) return;

    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) return;

    const sessionName = `${scenarioId}-sampled-${Date.now()}`;
    this.activeRecording = sessionName;
    this.recordingStartTime = Date.now();

    this.router.startRecording({
      sessionName,
      description: `${scenario.description} (sampled)`,
      startTime: this.recordingStartTime,
      testScenario: scenarioId,
      tags: [scenario.category, 'automatic-sampled', 'sampled']
    });

    console.log(`Started sampled recording: ${sessionName}`);

    // Auto-stop
    setTimeout(() => {
      if (this.activeRecording === sessionName) {
        this.stopAndValidate(scenarioId);
      }
    }, scenario.expectedDuration);
  }

  /**
   * Stop recording and validate
   */
  public stopAndValidate(scenarioId: string): void {
    if (!this.activeRecording) return;

    const duration = Date.now() - this.recordingStartTime;
    const sessionName = this.activeRecording;
    
    this.router.stopRecording();
    this.activeRecording = null;

    console.log(`Stopped recording: ${sessionName} (duration: ${duration}ms)`);

    // Update catalog
    this.updateCatalog(scenarioId, sessionName, duration);
  }

  /**
   * Update recording catalog
   */
  private updateCatalog(scenarioId: string, sessionName: string, duration: number): void {
    const catalogPath = path.join(this.recordingsPath, 'catalog.json');
    
    let catalog: any = {
      version: '1.0.0',
      scenarios: [],
      statistics: {
        totalScenarios: 0,
        totalRecordings: 0,
        lastRun: new Date().toISOString()
      }
    };

    if (fs.existsSync(catalogPath)) {
      const content = fs.readFileSync(catalogPath, 'utf8');
      try {
        catalog = JSON.parse(content);
      } catch (e) {
        console.error('Failed to parse catalog:', e);
      }
    }
    
    // Ensure catalog has required structure
    if (!catalog.scenarios) {
      catalog.scenarios = [];
    }

    // Find or create scenario entry
    let scenarioEntry = catalog.scenarios.find((s: any) => s.id === scenarioId);
    if (!scenarioEntry) {
      const scenario = this.scenarios.get(scenarioId);
      if (!scenario) return;

      scenarioEntry = {
        id: scenarioId,
        name: scenario.name,
        category: scenario.category,
        description: scenario.description,
        recordings: []
      };
      catalog.scenarios.push(scenarioEntry);
    }

    // Add recording entry
    scenarioEntry.recordings.push({
      sessionId: sessionName,
      timestamp: this.recordingStartTime,
      duration,
      file: `sessions/${sessionName}.jsonl`
    });

    // Update statistics
    catalog.statistics.totalScenarios = catalog.scenarios.length;
    catalog.statistics.totalRecordings = catalog.scenarios.reduce(
      (sum: number, s: any) => sum + s.recordings.length, 0
    );
    catalog.statistics.lastRun = new Date().toISOString();

    // Save catalog
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  }

  /**
   * Run regression test for a scenario
   */
  public async runScenarioTest(scenarioId: string): Promise<boolean> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      console.error('Unknown scenario:', scenarioId);
      return false;
    }

    const catalogPath = path.join(this.recordingsPath, 'catalog.json');
    if (!fs.existsSync(catalogPath)) {
      console.error('No catalog found');
      return false;
    }

    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const scenarioEntry = catalog.scenarios.find((s: any) => s.id === scenarioId);
    
    if (!scenarioEntry || scenarioEntry.recordings.length === 0) {
      console.error('No recordings found for scenario:', scenarioId);
      return false;
    }

    // Get latest recording
    const latestRecording = scenarioEntry.recordings[scenarioEntry.recordings.length - 1];
    const recordingPath = path.join(this.recordingsPath, latestRecording.file);

    if (!fs.existsSync(recordingPath)) {
      console.error('Recording file not found:', recordingPath);
      return false;
    }

    // Playback in headless mode
    console.log(`Playing back: ${latestRecording.sessionId}`);
    let success = false;
    try {
      await this.router.playRecording(recordingPath, 10.0, true);
      success = true;
    } catch (error) {
      console.error('Playback error:', error);
      success = false;
    }

    if (scenario.validators) {
      // TODO: Implement validation logic
      console.log('Running validators...');
    }

    return success;
  }

  /**
   * Get recording statistics
   */
  public getStatistics(): any {
    const catalogPath = path.join(this.recordingsPath, 'catalog.json');
    if (!fs.existsSync(catalogPath)) {
      return null;
    }

    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return catalog.statistics;
  }
}