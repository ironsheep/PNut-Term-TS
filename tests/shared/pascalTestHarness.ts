/** @format */

import { DebugPlotWindow, PlotDisplaySpec } from '../../src/classes/debugPlotWin';
import { Context } from '../../src/utils/context';
import { createMockContext } from './mockHelpers';

// Test helper class to access protected methods
class TestableDebugPlotWindow extends DebugPlotWindow {
  public testProcessCommand(command: string): boolean {
    try {
      // Parse command into tokens like the real parser would
      const tokens = command.trim().split(/\s+/);
      this.processMessageImmediate(tokens);
      return true;
    } catch (error) {
      console.error(`Command failed: ${command}`, error);
      return false;
    }
  }
}

export interface PascalTestScenario {
  name: string;
  description: string;
  setupCommands: string[];
  testCommands: string[];
  expectedBehavior: string;
  pascalSource?: string;
}

export interface TestResult {
  scenario: string;
  success: boolean;
  errors: string[];
  warnings: string[];
  performance: {
    commandCount: number;
    totalTimeMs: number;
    avgTimePerCommand: number;
  };
  memoryUsage?: {
    sprites: number;
    layers: number;
    memoryBytes: number;
  };
}

export class PascalTestHarness {
  private plotWindow: TestableDebugPlotWindow;
  private mockContext: Context;
  private testResults: TestResult[] = [];

  constructor(displaySpec: PlotDisplaySpec) {
    this.mockContext = createMockContext({
      runtime: {
        msWaitBeforeClose: 500,
        isFileLoggingEnabled: false,
        loggedTraffic: jest.fn(),
        logTrafficMessage: jest.fn()
      }
    });

    this.plotWindow = new TestableDebugPlotWindow(this.mockContext, displaySpec);
  }

  /**
   * Run a Pascal test scenario and capture results
   */
  async runScenario(scenario: PascalTestScenario): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Capture console output during test
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const logMessages: string[] = [];

    console.log = (message: string) => {
      logMessages.push(message);
      if (message.includes('[PLOT ERROR]') || message.includes('[PLOT PARSE ERROR]')) {
        errors.push(message);
      }
      originalConsoleLog(message);
    };

    console.warn = (message: string) => {
      warnings.push(message);
      originalConsoleWarn(message);
    };

    try {
      // Run setup commands
      for (const command of scenario.setupCommands) {
        const result = this.plotWindow.testProcessCommand(command);
        if (!result) {
          errors.push(`Setup command failed: ${command}`);
        }
      }

      // Run test commands
      let commandCount = 0;
      for (const command of scenario.testCommands) {
        const result = this.plotWindow.testProcessCommand(command);
        if (!result) {
          errors.push(`Test command failed: ${command}`);
        }
        commandCount++;
      }

      const endTime = Date.now();
      const totalTimeMs = endTime - startTime;

      // Get memory usage if available
      let memoryUsage;
      try {
        const spriteManager = (this.plotWindow as any).spriteManager;
        const layerManager = (this.plotWindow as any).layerManager;
        if (spriteManager && layerManager) {
          const spriteStats = spriteManager.getMemoryStats();
          const layerStats = layerManager.getMemoryStats();
          memoryUsage = {
            sprites: spriteStats.spriteCount,
            layers: layerStats.layerCount,
            memoryBytes: spriteStats.currentUsage + layerStats.currentUsage
          };
        }
      } catch (e) {
        // Memory stats not available
      }

      const result: TestResult = {
        scenario: scenario.name,
        success: errors.length === 0,
        errors,
        warnings,
        performance: {
          commandCount: scenario.setupCommands.length + commandCount,
          totalTimeMs,
          avgTimePerCommand: totalTimeMs / (scenario.setupCommands.length + commandCount)
        },
        memoryUsage
      };

      this.testResults.push(result);
      return result;

    } finally {
      // Restore console
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
    }
  }

  /**
   * Create Pascal test scenarios based on the reference programs
   */
  static createPascalReferenceScenarios(): PascalTestScenario[] {
    return [
      {
        name: 'HubRAM_Coordinate_System',
        description: 'Tests Pascal polar coordinate system setup and usage',
        setupCommands: [
          'SIZE 600 650',
          'BACKCOLOR WHITE',
          'ORIGIN 300 270',
          'POLAR -64 -16'
        ],
        testCommands: [
          'CLEAR',
          "SET 330 0 CYAN 3 TEXT 30 3 'Hub RAM Interface'",
          "SET 280 0 TEXT 15 3 'Every cog can read/write 32 bits per clock'",
          'UPDATE'
        ],
        expectedBehavior: 'Text should appear at correct polar coordinates without errors',
        pascalSource: 'DEBUG_PLOT_HubRAM.spin2 lines 14-20'
      },

      {
        name: 'HubRAM_Animated_Spokes',
        description: 'Tests Pascal spoke animation with polar coordinates',
        setupCommands: [
          'ORIGIN 300 270',
          'POLAR -64 -16'
        ],
        testCommands: [
          'CLEAR',
          'GREY 12 SET 103 0 LINE 190 0 20',
          'GREY 12 SET 103 8 LINE 190 8 20',
          'GREY 12 SET 103 16 LINE 190 16 20',
          'GREY 12 SET 103 24 LINE 190 24 20',
          'GREY 12 SET 103 32 LINE 190 32 20',
          'GREY 12 SET 103 40 LINE 190 40 20',
          'GREY 12 SET 103 48 LINE 190 48 20',
          'GREY 12 SET 103 56 LINE 190 56 20',
          'UPDATE'
        ],
        expectedBehavior: 'Radial spokes should be drawn from hub center',
        pascalSource: 'DEBUG_PLOT_HubRAM.spin2 lines 25-26'
      },

      {
        name: 'HubRAM_Complex_Circles',
        description: 'Tests Pascal nested circle and text commands',
        setupCommands: [
          'ORIGIN 300 270',
          'POLAR -64 -16'
        ],
        testCommands: [
          'SET 0 0 CYAN 4 CIRCLE 151 YELLOW 7 CIRCLE 147 3',
          "SET 24 0 WHITE TEXT 14 'Address LSBs'",
          "SET 0 0 TEXT 18 1 '8 Hub RAMs'",
          "SET 24 32 TEXT 14 '16K x 32'",
          'UPDATE'
        ],
        expectedBehavior: 'Multiple circles and text elements should render correctly',
        pascalSource: 'DEBUG_PLOT_HubRAM.spin2 lines 28-31'
      },

      {
        name: 'Sprites_Basic_Definition',
        description: 'Tests Pascal sprite definition with pixel and color arrays',
        setupCommands: [
          'SIZE 384 384',
          'CARTESIAN 1'
        ],
        testCommands: [
          'SPRITEDEF 0 16 16 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 25 25 25 25 0 0 0 0 0 0 0 0 0 0 25 31 31 24 24 25 0 0 0 0 0 0 0 0 25 31 31 31 31 31 24 25 0 0 0 0 0 25 33 31 33 33 25 25 25 25 25 25 0 0 0 25 33 33 33 25 25 25 25 25 25 25 25 25 0 0 25 33 33 25 25 17 17 17 17 25 25 25 0 0 0 25 25 25 25 25 17 9 9 25 9 25 0 0 0 0 0 25 9 9 25 25 17 9 9 25 9 25 25 25 0 0 0 25 9 9 25 25 25 17 9 9 9 8 8 8 25 0 0 25 17 9 17 25 17 9 25 17 9 9 9 9 25 0 0 0 25 17 17 17 9 25 25 25 17 17 17 25 0 0 0xFF0000 0x00FF00 0x0000FF 0x000000 0xF8F8F8 0xF8F8F8 0xF8F8F8 0xF873F8 0xF872F8 0xF869F8 0x7B69F8 0xF832F8 0x7A8EF8 0x7E4DF8 0x7E67F8 0x7E63F8 0x6E49F8 0x36DBF8 0x32BCF8 0x2656F8 0x7A2DF8 0x7649F8 0x5DA0F8 0x59A0F8 0x2A37F8 0x25B2F8 0x2192F8 0x7CCAF8 0x18C6F8 0x7C89F8 0x6CA0F8 0x7C21F8 0x1084F8'
        ],
        expectedBehavior: 'Mario sprite should be defined successfully',
        pascalSource: 'DEBUG_PLOT_Sprites.spin2 line 16'
      },

      {
        name: 'Sprites_Animation_Sequence',
        description: 'Tests Pascal sprite animation with transformations',
        setupCommands: [
          'SIZE 384 384',
          'CARTESIAN 1',
          'SPRITEDEF 0 4 4 1 1 1 1 1 2 2 1 2 2 2 2 2 2 2 2 0xFF0000 0x00FF00 0x0000FF'
        ],
        testCommands: [
          'CLEAR',
          'SET 100 100 SPRITE 0 0 1 255',      // orientation=0, scale=1, opacity=255
          'SET 150 100 SPRITE 0 45 1.5 200',   // orientation=45, scale=1.5, opacity=200
          'SET 200 100 SPRITE 0 90 2 150',     // orientation=90, scale=2, opacity=150
          'SET 250 100 SPRITE 0 135 0.5 100',  // orientation=135, scale=0.5, opacity=100
          'UPDATE'
        ],
        expectedBehavior: 'Sprites should render with different transformations',
        pascalSource: 'DEBUG_PLOT_Sprites.spin2 line 32'
      },

      {
        name: 'Sprites_Sustained_Animation',
        description: 'Tests Pascal sustained sprite animation loop',
        setupCommands: [
          'SIZE 384 384',
          'CARTESIAN 1',
          'SPRITEDEF 0 8 8 1 1 1 1 1 1 1 1 1 2 2 2 2 2 2 1 1 2 3 3 3 3 2 1 1 2 3 4 4 4 3 2 1 1 2 3 4 4 4 3 2 1 1 2 3 3 3 3 2 1 1 2 2 2 2 2 2 1 1 1 1 1 1 1 1 1 0xFF0000 0x00FF00 0x0000FF 0xFFFF00 0xFF00FF'
        ],
        testCommands: [
          // Simulate multiple animation frames
          'CLEAR',
          'SET 50 50 SPRITE 0 0 1 255',
          'UPDATE',
          'CLEAR',
          'SET 70 65 SPRITE 0 45 1.2 240',
          'UPDATE',
          'CLEAR',
          'SET 90 80 SPRITE 0 90 1.4 225',
          'UPDATE',
          'CLEAR',
          'SET 110 95 SPRITE 0 135 1.6 210',
          'UPDATE',
          'CLEAR',
          'SET 130 110 SPRITE 0 180 1.8 195',
          'UPDATE'
        ],
        expectedBehavior: 'Smooth sprite animation across multiple frames',
        pascalSource: 'DEBUG_PLOT_Sprites.spin2 lines 29-34'
      },

      {
        name: 'Pascal_Command_Stress_Test',
        description: 'Tests sustained high-frequency command processing',
        setupCommands: [
          'SIZE 400 400',
          'ORIGIN 200 200'
        ],
        testCommands: (() => {
          const commands = ['CLEAR'];
          // Generate 100 rapid drawing commands
          for (let i = 0; i < 100; i++) {
            const angle = i * 3.6; // 360 degrees over 100 commands
            const radius = 50 + (i % 50);
            commands.push(`SET ${Math.cos(angle * Math.PI / 180) * radius} ${Math.sin(angle * Math.PI / 180) * radius} RED ${(i % 5) + 1} DOT`);
          }
          commands.push('UPDATE');
          return commands;
        })(),
        expectedBehavior: 'All commands should process without errors or performance degradation',
        pascalSource: 'Simulated from Pascal loop patterns'
      }
    ];
  }

  /**
   * Run all Pascal reference scenarios
   */
  async runAllPascalScenarios(): Promise<TestResult[]> {
    const scenarios = PascalTestHarness.createPascalReferenceScenarios();
    const results: TestResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate a compatibility report
   */
  generateCompatibilityReport(): string {
    let report = '\n=== PASCAL COMPATIBILITY REPORT ===\n\n';

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    report += `Total Test Scenarios: ${totalTests}\n`;
    report += `Passed: ${passedTests}\n`;
    report += `Failed: ${failedTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    // Performance summary
    const avgCommandTime = this.testResults.reduce((sum, r) => sum + r.performance.avgTimePerCommand, 0) / totalTests;
    const totalCommands = this.testResults.reduce((sum, r) => sum + r.performance.commandCount, 0);

    report += `Performance Summary:\n`;
    report += `  Total Commands Processed: ${totalCommands}\n`;
    report += `  Average Command Time: ${avgCommandTime.toFixed(2)}ms\n`;
    report += `  Target: <10ms per command\n`;
    report += `  Performance Status: ${avgCommandTime < 10 ? 'PASS' : 'FAIL'}\n\n`;

    // Memory usage summary
    const memoryResults = this.testResults.filter(r => r.memoryUsage);
    if (memoryResults.length > 0) {
      const avgMemory = memoryResults.reduce((sum, r) => sum + r.memoryUsage!.memoryBytes, 0) / memoryResults.length;
      report += `Memory Usage Summary:\n`;
      report += `  Average Memory Usage: ${(avgMemory / 1024).toFixed(1)}KB\n`;
      report += `  Memory Status: TRACKED\n\n`;
    }

    // Detailed results
    report += `Detailed Results:\n`;
    this.testResults.forEach(result => {
      report += `\n[${result.success ? 'PASS' : 'FAIL'}] ${result.scenario}\n`;
      if (result.errors.length > 0) {
        report += `  Errors: ${result.errors.length}\n`;
        result.errors.forEach(error => {
          report += `    - ${error}\n`;
        });
      }
      if (result.warnings.length > 0) {
        report += `  Warnings: ${result.warnings.length}\n`;
      }
      report += `  Commands: ${result.performance.commandCount} in ${result.performance.totalTimeMs}ms\n`;
    });

    return report;
  }

  /**
   * Clean up test resources
   */
  cleanup(): void {
    if (this.plotWindow) {
      this.plotWindow.closeDebugWindow();
    }
  }
}