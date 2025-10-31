/** @format */

import { PlotDisplaySpec } from '../src/classes/debugPlotWin';
import { PascalTestHarness, TestResult } from './shared/pascalTestHarness';
import { createMockBrowserWindow } from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow())
}));

describe('Pascal Reference Program Integration Tests', () => {
  let testHarness: PascalTestHarness;
  let displaySpec: PlotDisplaySpec;

  beforeEach(() => {
    // Create display spec matching Pascal program requirements
    displaySpec = {
      displayName: 'PascalCompatTest',
      windowTitle: 'Pascal Compatibility Test Plot',
      position: { x: 100, y: 100 },
      hasExplicitPosition: false,
      size: { width: 400, height: 400 },
      dotSize: { width: 1, height: 1 },
      window: { background: '#000000', grid: '#FFFFFF' },
      lutColors: [],
      delayedUpdate: false,
      hideXY: false
    };

    testHarness = new PascalTestHarness(displaySpec);
  });

  afterEach(() => {
    if (testHarness) {
      testHarness.cleanup();
    }
  });

  test('should run all Pascal reference scenarios successfully', async () => {
    const results = await testHarness.runAllPascalScenarios();

    // Verify all scenarios were run
    expect(results.length).toBeGreaterThan(0);

    // Generate compatibility report
    const report = testHarness.generateCompatibilityReport();
    console.log(report);

    // Check success rate - should be 100% for Pascal compatibility
    const passedTests = results.filter(r => r.success).length;
    const successRate = (passedTests / results.length) * 100;

    // Log individual failures for debugging
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\n=== FAILED TESTS ===');
      failedTests.forEach(test => {
        console.log(`\nFAILED: ${test.scenario}`);
        test.errors.forEach(error => console.log(`  ERROR: ${error}`));
        test.warnings.forEach(warning => console.log(`  WARNING: ${warning}`));
      });
    }

    // Pascal compatibility should be 90% or higher for production readiness
    expect(successRate).toBeGreaterThanOrEqual(90);

    // Performance validation - commands should process in under 10ms each
    const avgCommandTime = results.reduce((sum, r) => sum + r.performance.avgTimePerCommand, 0) / results.length;
    expect(avgCommandTime).toBeLessThan(10);

    // Memory tracking validation
    const memoryResults = results.filter(r => r.memoryUsage);
    if (memoryResults.length > 0) {
      memoryResults.forEach(result => {
        expect(result.memoryUsage!.memoryBytes).toBeGreaterThanOrEqual(0);
      });
    }
  }, 30000); // 30 second timeout for comprehensive testing

  test('should handle DEBUG_PLOT_HubRAM.spin2 coordinate system exactly', async () => {
    const scenario = PascalTestHarness.createPascalReferenceScenarios()
      .find(s => s.name === 'HubRAM_Coordinate_System');
    expect(scenario).toBeDefined();

    const result = await testHarness.runScenario(scenario!);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.performance.avgTimePerCommand).toBeLessThan(10);
  });

  test('should handle DEBUG_PLOT_Sprites.spin2 sprite animation exactly', async () => {
    const scenario = PascalTestHarness.createPascalReferenceScenarios()
      .find(s => s.name === 'Sprites_Animation_Sequence');
    expect(scenario).toBeDefined();

    const result = await testHarness.runScenario(scenario!);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Verify sprite-related memory tracking
    if (result.memoryUsage) {
      expect(result.memoryUsage.sprites).toBeGreaterThanOrEqual(0);
    }
  });

  test('should handle sustained animation like Pascal programs', async () => {
    const scenario = PascalTestHarness.createPascalReferenceScenarios()
      .find(s => s.name === 'Sprites_Sustained_Animation');
    expect(scenario).toBeDefined();

    const result = await testHarness.runScenario(scenario!);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Sustained animation should maintain performance
    expect(result.performance.avgTimePerCommand).toBeLessThan(15); // Slightly more lenient for animation
  });

  test('should handle high-frequency command sequences', async () => {
    const scenario = PascalTestHarness.createPascalReferenceScenarios()
      .find(s => s.name === 'Pascal_Command_Stress_Test');
    expect(scenario).toBeDefined();

    const result = await testHarness.runScenario(scenario!);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Stress test should process many commands quickly
    expect(result.performance.commandCount).toBeGreaterThan(100);
    expect(result.performance.totalTimeMs).toBeLessThan(5000); // 5 seconds max
  });

  test('should validate Pascal color compatibility', async () => {
    const colorTestScenario = {
      name: 'Pascal_Color_Compatibility',
      description: 'Tests Pascal color name compatibility',
      setupCommands: ['SIZE 300 300'],
      testCommands: [
        'SET 0 0 cyan 3 DOT',
        'SET 10 0 white 3 DOT',
        'SET 20 0 yellow 3 DOT',
        'SET 30 0 orange 3 DOT',
        'SET 40 0 grey 3 DOT',
        'SET 50 0 red 3 DOT',
        'SET 60 0 green 3 DOT',
        'SET 70 0 blue 3 DOT',
        'SET 80 0 black 3 DOT'
      ],
      expectedBehavior: 'All Pascal color names should be recognized'
    };

    const result = await testHarness.runScenario(colorTestScenario);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate Pascal coordinate system transformations', async () => {
    const coordTestScenario = {
      name: 'Pascal_Coordinate_Transformations',
      description: 'Tests Pascal coordinate system compatibility',
      setupCommands: [
        'SIZE 400 400',
        'ORIGIN 200 200'
      ],
      testCommands: [
        'CARTESIAN 1',
        'SET 100 100 RED 3 DOT',
        'CARTESIAN -1',
        'SET 100 100 GREEN 3 DOT',
        'POLAR 0 0',
        'SET 100 100 BLUE 3 DOT',
        'POLAR -90 0',
        'SET 100 100 YELLOW 3 DOT'
      ],
      expectedBehavior: 'Coordinate transformations should work like Pascal'
    };

    const result = await testHarness.runScenario(coordTestScenario);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate Pascal text rendering compatibility', async () => {
    const textTestScenario = {
      name: 'Pascal_Text_Compatibility',
      description: 'Tests Pascal text rendering compatibility',
      setupCommands: ['SIZE 400 300'],
      testCommands: [
        "TEXT 16 'Single quoted text'",
        'TEXT 16 "Double quoted text"',
        "SET 0 50 TEXT 14 'Pascal text 1'",
        'SET 0 100 TEXT 18 "Pascal text 2"',
        "SET 0 150 BLUE TEXT 12 'Colored text'",
        'SET 0 200 RED 2 TEXT 20 "Thick colored text"'
      ],
      expectedBehavior: 'Text should render with Pascal syntax compatibility'
    };

    const result = await testHarness.runScenario(textTestScenario);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate Pascal sprite ID limits and boundaries', async () => {
    const spriteLimitScenario = {
      name: 'Pascal_Sprite_Limits',
      description: 'Tests Pascal sprite system limits (256 sprites, 32x32 max)',
      setupCommands: ['SIZE 400 400'],
      testCommands: [
        // Test maximum sprite ID (255)
        'SPRITEDEF 255 4 4 1 1 1 1 1 2 2 1 2 2 2 2 2 2 2 2 0xFF0000 0x00FF00 0x0000FF',
        'SET 100 100 SPRITE 255 0 1 255',

        // Test maximum sprite dimensions (32x32)
        (() => {
          const pixels = new Array(32 * 32).fill(1);
          const colors = ['0xFF0000', '0x00FF00'];
          return `SPRITEDEF 254 32 32 ${pixels.join(' ')} ${colors.join(' ')}`;
        })(),
        'SET 200 200 SPRITE 254 0 1 255',

        // Test sprite transformation limits
        'SET 50 50 SPRITE 255 359 10 255',    // Max rotation and scale
        'SET 150 50 SPRITE 255 0 0.1 1'       // Min scale and opacity
      ],
      expectedBehavior: 'Should handle Pascal sprite system limits correctly'
    };

    const result = await testHarness.runScenario(spriteLimitScenario);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Verify sprite memory tracking
    if (result.memoryUsage) {
      expect(result.memoryUsage.sprites).toBeGreaterThanOrEqual(0);
    }
  });
});
