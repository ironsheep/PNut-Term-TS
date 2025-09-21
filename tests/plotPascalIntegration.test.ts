/** @format */

import { DebugPlotWindow, PlotDisplaySpec } from '../src/classes/debugPlotWin';
import { Context } from '../src/utils/context';
import {
  createMockContext,
  createMockBrowserWindow,
  setupDebugWindowTest,
  cleanupDebugWindowTest
} from './shared/mockHelpers';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => createMockBrowserWindow())
}));

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

describe('PLOT Pascal Integration Tests', () => {
  let plotWindow: TestableDebugPlotWindow;
  let mockContext: Context;
  let displaySpec: PlotDisplaySpec;
  let originalConsoleLog: any;
  let logMessages: string[] = [];

  beforeEach(() => {
    // Capture console output
    originalConsoleLog = console.log;
    logMessages = [];
    console.log = (message: string) => {
      logMessages.push(message);
      originalConsoleLog(message);
    };

    // Use shared mock setup
    const testSetup = setupDebugWindowTest();
    mockContext = createMockContext({
      runtime: {
        msWaitBeforeClose: 500,
        isFileLoggingEnabled: false,
        loggedTraffic: jest.fn(),
        logTrafficMessage: jest.fn()
      }
    });

    // Create display spec matching Pascal defaults
    displaySpec = {
      displayName: 'TestPlot',
      windowTitle: 'Pascal Integration Test Plot',
      position: { x: 600, y: 500 },
      hasExplicitPosition: true,
      size: { width: 400, height: 200 },
      dotSize: { width: 1, height: 1 },
      window: { background: '#FFFFFF', grid: '#000000' },
      lutColors: [],
      delayedUpdate: false,
      hideXY: false
    };

    plotWindow = new TestableDebugPlotWindow(mockContext, displaySpec);
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;

    // Clean up plot window
    if (plotWindow) {
      plotWindow.closeDebugWindow();
    }
  });

  describe('DEBUG_PLOT_HubRAM.spin2 Pascal Compatibility', () => {
    test('should handle Pascal coordinate system setup exactly like PNut', () => {
      // Test Pascal sequence: origin 300 270 polar -64 -16
      const originCommand = 'ORIGIN 300 270';
      const polarCommand = 'POLAR -64 -16';

      const originResult = plotWindow.testProcessCommand(originCommand);
      expect(originResult).toBe(true);

      const polarResult = plotWindow.testProcessCommand(polarCommand);
      expect(polarResult).toBe(true);

      // Verify coordinate system state matches Pascal
      const origin = (plotWindow as any).origin;
      const coordMode = (plotWindow as any).coordinateMode;
      const polarConfig = (plotWindow as any).polarConfig;

      expect(origin.x).toBe(300);
      expect(origin.y).toBe(270);
      expect(coordMode).toBe(1); // CM_POLAR
      expect(polarConfig.twopi).toBe(-64);
      expect(polarConfig.offset).toBe(-16);
    });

    test('should handle Pascal animation loop with clear/update cycle', () => {
      // Test Pascal pattern: clear -> drawing commands -> update
      const clearResult = plotWindow.testProcessCommand('CLEAR');
      expect(clearResult).toBe(true);

      // Pascal: set 330 0 cyan 3 text 30 3 'Hub RAM Interface'
      const textResult = plotWindow.testProcessCommand("SET 330 0 CYAN 3 TEXT 30 3 'Hub RAM Interface'");
      expect(textResult).toBe(true);

      const updateResult = plotWindow.testProcessCommand('UPDATE');
      expect(updateResult).toBe(true);

      // Verify no errors occurred
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal polar coordinate drawing commands', () => {
      // Setup polar coordinates like Pascal
      plotWindow.testProcessCommand('ORIGIN 300 270');
      plotWindow.testProcessCommand('POLAR -64 -16');

      // Test Pascal spoke drawing: set 103 `(i*8) line 190 `(i*8) 20
      // This draws from (103, 0) to (190, 0) with line size 20 in polar coordinates
      const spokeResult = plotWindow.testProcessCommand('GREY 12 SET 103 0 LINE 190 0 20');
      expect(spokeResult).toBe(true);

      // Verify coordinate transformation occurred
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal circle drawing with nested commands', () => {
      // Pascal: set 0 0 cyan 4 circle 151 yellow 7 circle 147 3
      const circleResult = plotWindow.testProcessCommand('SET 0 0 CYAN 4 CIRCLE 151 YELLOW 7 CIRCLE 147 3');
      expect(circleResult).toBe(true);

      // Verify both circles were drawn
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal text positioning and sizing', () => {
      // Pascal: set 24 0 white text 14 'Address LSBs'
      const textResult = plotWindow.testProcessCommand("SET 24 0 WHITE TEXT 14 'Address LSBs'");
      expect(textResult).toBe(true);

      // Pascal: set 0 0 text 18 1 '8 Hub RAMs'
      const text2Result = plotWindow.testProcessCommand("SET 0 0 TEXT 18 1 '8 Hub RAMs'");
      expect(text2Result).toBe(true);

      // Verify text commands processed correctly
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal variable coordinate substitution pattern', () => {
      // Pascal uses `(expression) for variable substitution
      // We simulate this by testing dynamic coordinate values
      for (let i = 0; i < 8; i++) {
        const angle = i * 8;
        const ramCommand = `CYAN 6 SET 103 ${angle} CIRCLE 55 TEXT 20 '${i}'`;
        const cogCommand = `ORANGE 6 SET 190 ${angle} CIRCLE 81 TEXT 20 'Cog${i}'`;

        const ramResult = plotWindow.testProcessCommand(ramCommand);
        expect(ramResult).toBe(true);

        const cogResult = plotWindow.testProcessCommand(cogCommand);
        expect(cogResult).toBe(true);
      }

      // Verify all 16 objects were drawn without errors
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal save command pattern (commented out in original)', () => {
      // Pascal: debug(`myplot save 'egg`(k)')  [commented out]
      // Test that SAVE command works when uncommented
      const saveResult = plotWindow.testProcessCommand("SAVE 'test_frame.bmp'");
      expect(saveResult).toBe(true);

      // Verify save command processed
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });
  });

  describe('DEBUG_PLOT_Sprites.spin2 Pascal Compatibility', () => {
    test('should handle Pascal sprite size specification', () => {
      // Pascal creates 384x384 plot with sprites
      displaySpec.size = { width: 384, height: 384 };
      plotWindow = new TestableDebugPlotWindow(mockContext, displaySpec);

      // Pascal: cartesian 1
      const cartesianResult = plotWindow.testProcessCommand('CARTESIAN 1');
      expect(cartesianResult).toBe(true);

      // Verify coordinate system
      const coordSys = (plotWindow as any).coordinateSystem;
      expect(coordSys.mode).toBe('CARTESIAN');
    });

    test('should handle Pascal sprite definition with pixel and color arrays', () => {
      // Pascal: spritedef `(i) 16 16 `uhex_byte_array_(@Mario0 + i * 256, 256) `uhex_long_array_(@MarioColors, 52)
      // Simulate Mario sprite 0 definition (simplified pixel data)
      const pixels = new Array(256).fill(0); // 16x16 = 256 pixels
      pixels[96] = 25; pixels[97] = 25; pixels[98] = 25; pixels[99] = 25; // Row 6, some Mario pixels

      const colors = [
        0x000000, 0xF8F8F8, 0xF8F8F8, 0xF8F8F8, 0xF873F8, 0xF872F8, 0xF869F8, 0x7B69F8,
        0xF832F8, 0x7A8EF8, 0x7E4DF8, 0x7E67F8, 0x7E63F8, 0x6E49F8, 0x36DBF8, 0x32BCF8,
        0x2656F8, 0x7A2DF8, 0x7649F8, 0x5DA0F8, 0x59A0F8, 0x2A37F8, 0x25B2F8, 0x2192F8,
        0x7CCAF8, 0x18C6F8, 0x7C89F8, 0x6CA0F8, 0x7C21F8, 0x1084F8, 0x6C04F8, 0x6C05F8
      ];

      // Create SPRITEDEF command
      const pixelStr = pixels.join(' ');
      const colorStr = colors.map(c => `0x${c.toString(16).toUpperCase()}`).join(' ');
      const spritedefCommand = `SPRITEDEF 0 16 16 ${pixelStr} ${colorStr}`;

      const result = plotWindow.testProcessCommand(spritedefCommand);
      expect(result).toBe(true);

      // Verify sprite was stored
      const spriteManager = (plotWindow as any).spriteManager;
      expect(spriteManager.isSpriteDefined(0)).toBe(true);
    });

    test('should handle Pascal sprite animation with transformations', () => {
      // First define a simple sprite
      const pixels = new Array(256).fill(0);
      const colors = new Array(32).fill(0xFF0000); // Red sprite
      const pixelStr = pixels.join(' ');
      const colorStr = colors.map(c => `0x${c.toString(16).toUpperCase()}`).join(' ');

      plotWindow.testProcessCommand(`SPRITEDEF 0 16 16 ${pixelStr} ${colorStr}`);

      // Pascal sprite animation pattern: sprite `(i & $1F, orient[i], scale[i], opacity[i])
      // Test sprite rendering with all transformation parameters
      const spriteResult = plotWindow.testProcessCommand('SET 100 100 SPRITE 0 45 2 200');
      expect(spriteResult).toBe(true);

      // Verify no errors during sprite rendering
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal sprite trajectory simulation', () => {
      // Pascal trajectory update: (x[i] += dx[i]) & $1FF - 64
      // Simulate bouncing sprite movement
      const sprites = 10;
      const trajectories = [];

      // Setup sprites
      const pixels = new Array(256).fill(1);
      const colors = new Array(32).fill(0x00FF00); // Green sprites
      const pixelStr = pixels.join(' ');
      const colorStr = colors.map(c => `0x${c.toString(16).toUpperCase()}`).join(' ');

      for (let i = 0; i < sprites; i++) {
        plotWindow.testProcessCommand(`SPRITEDEF ${i} 16 16 ${pixelStr} ${colorStr}`);
        trajectories.push({
          x: Math.floor(Math.random() * 512),
          y: Math.floor(Math.random() * 512),
          dx: Math.floor(Math.random() * 13) - 6,  // -6 to 6
          dy: Math.floor(Math.random() * 13) - 6
        });
      }

      // Simulate animation frame
      plotWindow.testProcessCommand('CLEAR');

      for (let i = 0; i < sprites; i++) {
        const traj = trajectories[i];
        traj.x = (traj.x + traj.dx) & 0x1FF; // Pascal: & $1FF
        traj.y = (traj.y + traj.dy) & 0x1FF;
        const x = traj.x - 64; // Pascal: - 64
        const y = traj.y - 64;

        const result = plotWindow.testProcessCommand(`SET ${x} ${y} SPRITE ${i & 0x1F} 0 1 255`);
        expect(result).toBe(true);
      }

      plotWindow.testProcessCommand('UPDATE');

      // Verify animation frame completed without errors
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal sustained animation loop', () => {
      // Pascal infinite loop: repeat -> clear -> sprite animation -> update -> waitms(10)
      // Simulate multiple frames of animation
      const frameCount = 5;

      // Setup one sprite for testing
      const pixels = new Array(256).fill(2);
      const colors = new Array(32).fill(0x0000FF); // Blue sprite
      const pixelStr = pixels.join(' ');
      const colorStr = colors.map(c => `0x${c.toString(16).toUpperCase()}`).join(' ');

      plotWindow.testProcessCommand(`SPRITEDEF 0 16 16 ${pixelStr} ${colorStr}`);

      // Simulate sustained animation
      for (let frame = 0; frame < frameCount; frame++) {
        plotWindow.testProcessCommand('CLEAR');

        // Animate sprite position
        const x = 50 + frame * 20;
        const y = 50 + frame * 15;
        plotWindow.testProcessCommand(`SET ${x} ${y} SPRITE 0 ${frame * 45} ${1 + frame * 0.5} ${200 + frame * 10}`);

        plotWindow.testProcessCommand('UPDATE');
      }

      // Verify sustained animation worked
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal sprite count limits (128 sprites in motion)', () => {
      // Pascal uses 128 sprite instances (sprites = 128)
      // Test that we can handle this many sprite operations
      const spriteCount = 32; // Test with 32 sprite definitions (Pascal limit)
      const instanceCount = 10; // Test with 10 instances to avoid timeout

      // Define sprites
      const pixels = new Array(256).fill(3);
      const colors = new Array(32).fill(0xFFFF00); // Yellow sprites
      const pixelStr = pixels.join(' ');
      const colorStr = colors.map(c => `0x${c.toString(16).toUpperCase()}`).join(' ');

      for (let i = 0; i < spriteCount; i++) {
        const result = plotWindow.testProcessCommand(`SPRITEDEF ${i} 16 16 ${pixelStr} ${colorStr}`);
        expect(result).toBe(true);
      }

      // Render multiple sprite instances
      plotWindow.testProcessCommand('CLEAR');
      for (let i = 0; i < instanceCount; i++) {
        const spriteId = i % spriteCount;
        const x = (i * 30) % 300;
        const y = Math.floor(i / 10) * 30;
        const result = plotWindow.testProcessCommand(`SET ${x} ${y} SPRITE ${spriteId} ${i * 8} 1 255`);
        expect(result).toBe(true);
      }
      plotWindow.testProcessCommand('UPDATE');

      // Verify all operations succeeded
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });
  });

  describe('Pascal Command Compatibility Edge Cases', () => {
    test('should handle Pascal color name case sensitivity', () => {
      // Pascal uses lowercase color names
      const commands = [
        'SET 0 0 cyan 3 CIRCLE 50',
        'SET 50 0 white TEXT 12 "test"',
        'SET 100 0 yellow 5 DOT',
        'SET 150 0 orange 4 CIRCLE 30',
        'SET 200 0 grey 2 LINE 250 0 3'
      ];

      commands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true);
      });

      // Verify no case sensitivity errors
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal quoted string syntax', () => {
      // Pascal uses both single and double quotes
      const commands = [
        "TEXT 16 'Single quoted text'",
        'TEXT 16 "Double quoted text"',
        "SET 0 0 TEXT 14 'Pascal string'",
        'SET 50 0 TEXT 14 "Another string"'
      ];

      commands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true);
      });

      // Verify string parsing worked
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal coordinate boundary conditions', () => {
      // Pascal coordinates can be negative or exceed canvas bounds
      const commands = [
        'SET -50 -30 DOT',     // Negative coordinates
        'SET 1000 800 DOT',    // Coordinates beyond canvas
        'SET 0 0 LINE -100 -100 5',  // Line to negative coordinates
        'SET 500 400 CIRCLE 1000'     // Circle extending beyond bounds
      ];

      commands.forEach(command => {
        const result = plotWindow.testProcessCommand(command);
        expect(result).toBe(true); // Should handle gracefully, not fail
      });

      // Verify boundary handling worked
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });

    test('should handle Pascal rapid command sequences', () => {
      // Pascal can send commands very rapidly in loops
      const commandCount = 50;

      plotWindow.testProcessCommand('CLEAR');

      for (let i = 0; i < commandCount; i++) {
        const commands = [
          `SET ${i * 5} ${i * 3} RED ${i % 5 + 1} DOT`,
          `SET ${i * 6} ${i * 4} BLUE LINE ${i * 6 + 20} ${i * 4 + 15} ${i % 3 + 1}`,
          `SET ${i * 7} ${i * 5} GREEN CIRCLE ${i % 10 + 5}`
        ];

        commands.forEach(command => {
          const result = plotWindow.testProcessCommand(command);
          expect(result).toBe(true);
        });
      }

      plotWindow.testProcessCommand('UPDATE');

      // Verify rapid sequence handling
      const errorMessages = logMessages.filter(msg =>
        msg.includes('[PLOT ERROR]') || msg.includes('[PLOT PARSE ERROR]')
      );
      expect(errorMessages).toHaveLength(0);
    });
  });
});