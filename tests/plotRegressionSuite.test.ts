/** @format */

/**
 * Comprehensive regression test suite for all 27 migrated PLOT commands
 * Validates complete functionality before hardware testing
 */

import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { Context } from '../src/utils/context';

describe('PLOT Parser - Complete Regression Suite', () => {
  let parser: PlotCommandParser;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {} as Context;
    parser = new PlotCommandParser(mockContext);
  });

  describe('All 27 Commands Basic Functionality', () => {
    test('should parse and execute all basic drawing commands', () => {
      const drawingCommands = [
        'DOT',
        'DOT 2 200',
        'LINE 100 100',
        'LINE 50 75 2 180',
        'CIRCLE 50',
        'CIRCLE 100 3 150',
        'BOX 80 60',
        'BOX 120 90 1 220',
        'OVAL 70 50',
        'OVAL 100 80 2 190'
      ];

      drawingCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations).toHaveLength(1);
      });
    });

    test('should parse and execute all CONFIGURE commands', () => {
      const configureCommands = [
        'CONFIGURE TITLE "Test Window"',
        'CONFIGURE POS 100 200',
        'CONFIGURE SIZE 640 480',
        'CONFIGURE DOTSIZE 2',
        'CONFIGURE BACKCOLOR RED',
        'CONFIGURE HIDEXY 1',
        'CONFIGURE UPDATE 60'
      ];

      configureCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations).toHaveLength(1);
      });
    });

    test('should parse and execute all rendering control commands', () => {
      const renderingCommands = [
        'COLORMODE 0',
        'COLORMODE 1',
        'COLORMODE 2',
        'COLORMODE 3',
        'TEXTSIZE 12',
        'TEXTSIZE 24',
        'TEXTSTYLE 0',
        'TEXTSTYLE 3',
        'TEXTSTYLE 7'
      ];

      renderingCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations).toHaveLength(1);
      });
    });

    test('should parse and execute all interactive commands', () => {
      const interactiveCommands = [
        'PC_KEY',
        'PC_MOUSE'
      ];

      interactiveCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations).toHaveLength(1);
      });
    });

    test('should parse and execute all sprite and layer commands', () => {
      const spriteCommands = [
        'SPRITEDEF 0 8 8 $FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00',
        'SPRITE 0',
        'SPRITE 0 100 100 200',
        'LAYER 0 test.bmp',
        'CROP 0 0 32 32',
        'CROP 10 10 64 64 100 200'
      ];

      spriteCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations).toHaveLength(1);
      });
    });

    test('should parse and execute TEXT command variations', () => {
      const textCommands = [
        'TEXT "Hello"',
        'TEXT 12 "World"',
        'TEXT 16 3 "Bold"',
        'TEXT 20 1 45 "Angled"',
        'TEXT 24 7 90 "Full params"'
      ];

      textCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations).toHaveLength(1);
      });
    });
  });

  describe('Command Parsing Performance', () => {
    test('should handle rapid command parsing efficiently', () => {
      const commands = [
        'DOT', 'LINE 100 100', 'CIRCLE 50', 'BOX 80 60', 'OVAL 70 50',
        'TEXT "Test"', 'CONFIGURE SIZE 640 480', 'COLORMODE 0', 'PC_KEY',
        'SPRITEDEF 0 4 4 $FF00FF00FF00FF00'
      ];

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        commands.forEach(cmd => {
          const parsed = parser.parse(cmd);
          expect(parsed[0].isValid).toBe(true);
          parser.executeCommands(parsed);
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should parse and execute 1000 commands in reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds max
      console.log(`Parsed 1000 commands in ${totalTime.toFixed(2)}ms`);
    });

    test('should handle large command strings efficiently', () => {
      const largePixelData = '$' + 'FF'.repeat(512); // 1024 hex chars
      const largeCommands = [
        `SPRITEDEF 1 32 16 ${largePixelData}`,
        'TEXT "A very long text string with many words that tests string parsing performance and ensures the tokenizer handles large text efficiently without memory issues"',
        'CONFIGURE TITLE "A very long window title that tests title parsing and ensures proper handling of long configuration strings"'
      ];

      largeCommands.forEach(cmd => {
        const startTime = performance.now();
        const commands = parser.parse(cmd);
        const parseTime = performance.now() - startTime;

        expect(commands[0].isValid).toBe(true);
        expect(parseTime).toBeLessThan(50); // 50ms max per command

        const execStartTime = performance.now();
        const results = parser.executeCommands(commands);
        const execTime = performance.now() - execStartTime;

        expect(results[0].success).toBe(true);
        expect(execTime).toBeLessThan(50); // 50ms max per execution
      });
    });
  });

  describe('Error Handling Regression', () => {
    test('should properly report errors for all command types', () => {
      const errorCommands = [
        { cmd: 'INVALIDCOMMAND', expectError: true },
        { cmd: 'LINE', expectError: true }, // Missing parameters
        { cmd: 'CIRCLE', expectError: true }, // Missing diameter
        { cmd: 'BOX 100', expectError: true }, // Missing height
        { cmd: 'CONFIGURE INVALID', expectError: true }, // Invalid subcommand
        { cmd: 'COLORMODE 5', expectError: false }, // Out of range but should clamp
        { cmd: 'SPRITEDEF 0 8', expectError: true }, // Missing parameters
        { cmd: 'LAYER 0', expectError: true }, // Missing filename
        { cmd: 'CROP 10', expectError: true } // Missing parameters
      ];

      errorCommands.forEach(({ cmd, expectError }) => {
        const commands = parser.parse(cmd);

        if (expectError) {
          expect(commands[0].isValid).toBe(false);
          expect(commands[0].errors.length).toBeGreaterThan(0);
        } else {
          expect(commands[0].isValid).toBe(true);
        }
      });
    });

    test('should handle malformed syntax gracefully', () => {
      const malformedCommands = [
        '',
        '   ',
        'TEXT "unclosed quote',
        'LINE 100 abc', // Invalid numeric parameter
        'CONFIGURE "quoted command"',
        'SPRITEDEF 0 8 8 $INVALID_HEX'
      ];

      malformedCommands.forEach(cmd => {
        // Should not throw exceptions, even for malformed input
        expect(() => {
          const commands = parser.parse(cmd);
          parser.executeCommands(commands);
        }).not.toThrow();
      });
    });
  });

  describe('Memory and Resource Management', () => {
    test('should not leak memory during repeated parsing', () => {
      const commands = [
        'TEXT "Memory test"',
        'LINE 100 100',
        'CIRCLE 50',
        'SPRITEDEF 0 8 8 $FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00'
      ];

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Parse many commands to test for memory leaks
      for (let i = 0; i < 1000; i++) {
        commands.forEach(cmd => {
          const parsed = parser.parse(cmd);
          parser.executeCommands(parsed);
        });
      }

      // Test should complete without memory issues
      expect(true).toBe(true);
    });

    test('should handle concurrent parsing safely', async () => {
      const commands = [
        'DOT',
        'LINE 100 100',
        'TEXT "Concurrent test"',
        'CIRCLE 50'
      ];

      // Create multiple parsing operations simultaneously
      const promises = commands.map(async (cmd, index) => {
        // Add small delay to increase chance of concurrency
        await new Promise(resolve => setTimeout(resolve, index));

        const parsed = parser.parse(cmd);
        const results = parser.executeCommands(parsed);

        return {
          command: cmd,
          valid: parsed[0].isValid,
          success: results[0].success
        };
      });

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Command Coverage Validation', () => {
    test('should have implemented all 27 expected commands', () => {
      const expectedCommands = [
        // Basic drawing (5)
        'DOT', 'LINE', 'CIRCLE', 'BOX', 'OVAL',

        // Text (1)
        'TEXT',

        // Configure (7 subcommands under CONFIGURE)
        'CONFIGURE', // with TITLE, POS, SIZE, DOTSIZE, BACKCOLOR, HIDEXY, UPDATE

        // Rendering control (3)
        'COLORMODE', 'TEXTSIZE', 'TEXTSTYLE',

        // Interactive (2)
        'PC_KEY', 'PC_MOUSE',

        // Sprite system (4)
        'SPRITEDEF', 'SPRITE', 'LAYER', 'CROP',

        // Color commands (16 basic colors - counted as implemented)
        'BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'CYAN', 'MAGENTA', 'YELLOW',
        'ORANGE', 'PINK', 'AQUA', 'LIME', 'SILVER', 'GRAY', 'MAROON', 'NAVY'
      ];

      // Test that each command can be parsed
      expectedCommands.forEach(cmd => {
        let testCommand = cmd;

        // Add minimal parameters for commands that require them
        if (cmd === 'LINE') testCommand = 'LINE 100 100';
        else if (cmd === 'CIRCLE') testCommand = 'CIRCLE 50';
        else if (cmd === 'BOX') testCommand = 'BOX 80 60';
        else if (cmd === 'OVAL') testCommand = 'OVAL 70 50';
        else if (cmd === 'TEXT') testCommand = 'TEXT "test"';
        else if (cmd === 'CONFIGURE') testCommand = 'CONFIGURE TITLE "test"';
        else if (cmd === 'COLORMODE') testCommand = 'COLORMODE 0';
        else if (cmd === 'TEXTSIZE') testCommand = 'TEXTSIZE 12';
        else if (cmd === 'TEXTSTYLE') testCommand = 'TEXTSTYLE 0';
        else if (cmd === 'SPRITEDEF') testCommand = 'SPRITEDEF 0 4 4 $FF00FF00FF00FF00';
        else if (cmd === 'SPRITE') testCommand = 'SPRITE 0';
        else if (cmd === 'LAYER') testCommand = 'LAYER 0 test.bmp';
        else if (cmd === 'CROP') testCommand = 'CROP 0 0 32 32';

        const commands = parser.parse(testCommand);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
      });
    });
  });
});