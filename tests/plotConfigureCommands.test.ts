/** @format */

/**
 * Comprehensive unit tests for PLOT CONFIGURE commands
 * Tests all CONFIGURE command variations including edge cases and error handling
 */

import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { Context } from '../src/utils/context';

describe('PLOT CONFIGURE Commands', () => {
  let parser: PlotCommandParser;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {} as Context;
    parser = new PlotCommandParser(mockContext);
  });

  describe('CONFIGURE TITLE Command', () => {
    test('should parse quoted title', () => {
      const commands = parser.parse('CONFIGURE TITLE "My Plot Window"');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('CONFIGURE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse unquoted multi-word title', () => {
      const commands = parser.parse('CONFIGURE TITLE My Plot Window');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('CONFIGURE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should handle very long titles with truncation warning', () => {
      const longTitle = 'A'.repeat(250);
      const commands = parser.parse(`CONFIGURE TITLE ${longTitle}`);

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);

      // Execute the command to trigger truncation
      const results = parser.executeCommands(commands);
      expect(results[0].warnings.length).toBeGreaterThan(0);
      expect(results[0].warnings[0]).toContain('truncated');
    });

    test('should fail with missing title', () => {
      const commands = parser.parse('CONFIGURE TITLE');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('requires a title text');
    });
  });

  describe('CONFIGURE POS Command', () => {
    test('should parse positive coordinates', () => {
      const commands = parser.parse('CONFIGURE POS 100 200');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.action).toBe('POS');
      expect(results[0].canvasOperations[0].parameters.x).toBe(100);
      expect(results[0].canvasOperations[0].parameters.y).toBe(200);
    });

    test('should parse negative coordinates for multi-monitor support', () => {
      const commands = parser.parse('CONFIGURE POS -100 -50');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.x).toBe(-100);
      expect(results[0].canvasOperations[0].parameters.y).toBe(-50);
    });

    test('should handle invalid coordinates with warnings', () => {
      const commands = parser.parse('CONFIGURE POS invalid_x 200');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBeGreaterThan(0);
      expect(results[0].canvasOperations[0].parameters.x).toBe(0); // default fallback
    });

    test('should fail with missing coordinates', () => {
      const commands = parser.parse('CONFIGURE POS 100');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('requires x and y coordinates');
    });
  });

  describe('CONFIGURE SIZE Command', () => {
    test('should parse valid dimensions', () => {
      const commands = parser.parse('CONFIGURE SIZE 800 600');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.action).toBe('SIZE');
      expect(results[0].canvasOperations[0].parameters.width).toBe(800);
      expect(results[0].canvasOperations[0].parameters.height).toBe(600);
    });

    test('should clamp dimensions to valid range (32-2048)', () => {
      const commands = parser.parse('CONFIGURE SIZE 10 3000');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBe(2); // One warning for each clamped value
      expect(results[0].canvasOperations[0].parameters.width).toBe(32);  // clamped from 10
      expect(results[0].canvasOperations[0].parameters.height).toBe(2048); // clamped from 3000
    });

    test('should handle invalid dimensions with warnings', () => {
      const commands = parser.parse('CONFIGURE SIZE invalid_width 600');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBeGreaterThan(0);
      expect(results[0].canvasOperations[0].parameters.width).toBe(800); // default fallback
    });

    test('should fail with missing dimensions', () => {
      const commands = parser.parse('CONFIGURE SIZE 800');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('requires width and height');
    });
  });

  describe('CONFIGURE DOTSIZE Command', () => {
    test('should parse valid dot size', () => {
      const commands = parser.parse('CONFIGURE DOTSIZE 5');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.action).toBe('DOTSIZE');
      expect(results[0].canvasOperations[0].parameters.dotSize).toBe(5);
    });

    test('should clamp dot size to valid range (1-32)', () => {
      const commands = parser.parse('CONFIGURE DOTSIZE 0');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBe(1);
      expect(results[0].canvasOperations[0].parameters.dotSize).toBe(1); // clamped from 0
    });

    test('should clamp large dot size', () => {
      const commands = parser.parse('CONFIGURE DOTSIZE 100');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBe(1);
      expect(results[0].canvasOperations[0].parameters.dotSize).toBe(32); // clamped from 100
    });

    test('should fail with missing size parameter', () => {
      const commands = parser.parse('CONFIGURE DOTSIZE');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('requires size parameter');
    });
  });

  describe('CONFIGURE BACKCOLOR Command', () => {
    test('should parse named color', () => {
      const commands = parser.parse('CONFIGURE BACKCOLOR RED');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.action).toBe('BACKCOLOR');
      expect(results[0].canvasOperations[0].parameters.color).toBe('RED');
    });

    test('should parse named color with brightness', () => {
      const commands = parser.parse('CONFIGURE BACKCOLOR BLUE 8');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.color).toBe('BLUE');
      expect(results[0].canvasOperations[0].parameters.brightness).toBe(8);
    });

    test('should parse hex color', () => {
      const commands = parser.parse('CONFIGURE BACKCOLOR $FF0000');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.color).toBe('#ff0000');
    });

    test('should handle invalid color name with warning', () => {
      const commands = parser.parse('CONFIGURE BACKCOLOR INVALID_COLOR');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBeGreaterThan(0);
      expect(results[0].canvasOperations[0].parameters.color).toBe('BLACK'); // default fallback
    });

    test('should fail with missing color parameter', () => {
      const commands = parser.parse('CONFIGURE BACKCOLOR');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('requires color parameter');
    });
  });

  describe('CONFIGURE HIDEXY Command', () => {
    test('should parse HIDEXY without parameters (default hide)', () => {
      const commands = parser.parse('CONFIGURE HIDEXY');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.action).toBe('HIDEXY');
      expect(results[0].canvasOperations[0].parameters.hideXY).toBe(true);
    });

    test('should parse HIDEXY 0 (show coordinates)', () => {
      const commands = parser.parse('CONFIGURE HIDEXY 0');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.hideXY).toBe(false);
    });

    test('should parse HIDEXY 1 (hide coordinates)', () => {
      const commands = parser.parse('CONFIGURE HIDEXY 1');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.hideXY).toBe(true);
    });
  });

  describe('CONFIGURE UPDATE Command', () => {
    test('should parse valid update rate', () => {
      const commands = parser.parse('CONFIGURE UPDATE 30');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.action).toBe('UPDATE');
      expect(results[0].canvasOperations[0].parameters.updateRate).toBe(30);
    });

    test('should clamp update rate to valid range (1-120)', () => {
      const commands = parser.parse('CONFIGURE UPDATE 0');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBe(1);
      expect(results[0].canvasOperations[0].parameters.updateRate).toBe(1); // clamped from 0
    });

    test('should clamp high update rate', () => {
      const commands = parser.parse('CONFIGURE UPDATE 200');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBe(1);
      expect(results[0].canvasOperations[0].parameters.updateRate).toBe(120); // clamped from 200
    });

    test('should fail with missing rate parameter', () => {
      const commands = parser.parse('CONFIGURE UPDATE');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('requires rate parameter');
    });
  });

  describe('CONFIGURE Error Handling', () => {
    test('should fail with unknown CONFIGURE option', () => {
      const commands = parser.parse('CONFIGURE UNKNOWN');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('Unknown CONFIGURE option: UNKNOWN');
    });

    test('should fail with missing option parameter', () => {
      const commands = parser.parse('CONFIGURE');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('Missing required parameters');
    });
  });

  describe('CONFIGURE Command Integration', () => {
    test('should create immediate operations (not deferrable)', () => {
      const commands = parser.parse('CONFIGURE TITLE "Test"');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);

      // CONFIGURE operations should be immediate
      const operation = results[0].canvasOperations[0];
      expect(operation.type).toBe('CONFIGURE_WINDOW');
      expect(operation.parameters.action).toBe('TITLE');
      expect(operation.parameters.title).toBe('Test');
    });

    test('should handle multiple CONFIGURE commands in sequence', () => {
      const commands1 = parser.parse('CONFIGURE TITLE "Test Window"');
      const commands2 = parser.parse('CONFIGURE POS 100 200');
      const commands3 = parser.parse('CONFIGURE SIZE 800 600');

      const results1 = parser.executeCommands(commands1);
      const results2 = parser.executeCommands(commands2);
      const results3 = parser.executeCommands(commands3);

      expect(results1[0].success).toBe(true);
      expect(results2[0].success).toBe(true);
      expect(results3[0].success).toBe(true);

      expect(results1[0].canvasOperations[0].parameters.action).toBe('TITLE');
      expect(results2[0].canvasOperations[0].parameters.action).toBe('POS');
      expect(results3[0].canvasOperations[0].parameters.action).toBe('SIZE');
    });
  });
});