/** @format */

/**
 * Unit tests for PLOT basic drawing commands (LINE, CIRCLE, DOT, BOX, OVAL)
 * Tests command parsing, parameter validation, and canvas operation creation
 */

import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { Context } from '../src/utils/context';

describe('PLOT Basic Drawing Commands', () => {
  let parser: PlotCommandParser;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {} as Context;
    parser = new PlotCommandParser(mockContext);
  });

  describe('LINE Command', () => {
    test('should parse LINE with coordinates', () => {
      const commands = parser.parse('LINE 100 200');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('LINE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse LINE with coordinates, line size, and opacity', () => {
      const commands = parser.parse('LINE 100 200 3 180');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('LINE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create DRAW_LINE operation', () => {
      const commands = parser.parse('LINE 150 250 2 200');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('DRAW_LINE');
      expect(results[0].canvasOperations[0].parameters.x).toBe(150);
      expect(results[0].canvasOperations[0].parameters.y).toBe(250);
      expect(results[0].canvasOperations[0].parameters.lineSize).toBe(2);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(200);
    });

    test('should handle negative coordinates', () => {
      const commands = parser.parse('LINE -50 -75');
      const results = parser.executeCommands(commands);

      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.x).toBe(-50);
      expect(results[0].canvasOperations[0].parameters.y).toBe(-75);
    });

    test('should use default values for optional parameters', () => {
      const commands = parser.parse('LINE 100 200');
      const results = parser.executeCommands(commands);

      expect(results[0].canvasOperations[0].parameters.lineSize).toBe(1);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(255);
    });

    test('should handle missing coordinates', () => {
      const invalidCommands = [
        'LINE',
        'LINE 100'
      ];

      invalidCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(false);
        expect(commands[0].errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('CIRCLE Command', () => {
    test('should parse CIRCLE with diameter', () => {
      const commands = parser.parse('CIRCLE 50');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('CIRCLE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse CIRCLE with diameter, line size, and opacity', () => {
      const commands = parser.parse('CIRCLE 100 2 128');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('CIRCLE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create DRAW_CIRCLE operation', () => {
      const commands = parser.parse('CIRCLE 75 3 200');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('DRAW_CIRCLE');
      expect(results[0].canvasOperations[0].parameters.diameter).toBe(75);
      expect(results[0].canvasOperations[0].parameters.lineSize).toBe(3);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(200);
    });

    test('should clamp diameter to valid range (1-2048)', () => {
      const testCases = [
        { cmd: 'CIRCLE 0', expectedDiameter: 1 },
        { cmd: 'CIRCLE 3000', expectedDiameter: 2048 },
        { cmd: 'CIRCLE -10', expectedDiameter: 1 }
      ];

      testCases.forEach(({ cmd, expectedDiameter }) => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].canvasOperations[0].parameters.diameter).toBe(expectedDiameter);
      });
    });

    test('should handle missing diameter', () => {
      const commands = parser.parse('CIRCLE');

      expect(commands[0].isValid).toBe(false);
      expect(commands[0].errors.length).toBeGreaterThan(0);
    });
  });

  describe('DOT Command', () => {
    test('should parse DOT without parameters', () => {
      const commands = parser.parse('DOT');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('DOT');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse DOT with line size and opacity', () => {
      const commands = parser.parse('DOT 4 200');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('DOT');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create DRAW_DOT operation', () => {
      const commands = parser.parse('DOT 3 180');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('DRAW_DOT');
      expect(results[0].canvasOperations[0].parameters.lineSize).toBe(3);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(180);
    });

    test('should use default values', () => {
      const commands = parser.parse('DOT');
      const results = parser.executeCommands(commands);

      expect(results[0].canvasOperations[0].parameters.lineSize).toBe(1);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(255);
    });

    test('should clamp line size to valid range (1-32)', () => {
      const testCases = [
        { cmd: 'DOT 0', expectedSize: 1 },
        { cmd: 'DOT 50', expectedSize: 32 },
        { cmd: 'DOT -5', expectedSize: 1 }
      ];

      testCases.forEach(({ cmd, expectedSize }) => {
        const commands = parser.parse(cmd);
        const results = parser.executeCommands(commands);
        expect(results[0].canvasOperations[0].parameters.lineSize).toBe(expectedSize);
      });
    });
  });

  describe('BOX Command', () => {
    test('should parse BOX with dimensions', () => {
      const commands = parser.parse('BOX 100 50');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('BOX');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse BOX with dimensions, line size, and opacity', () => {
      const commands = parser.parse('BOX 150 75 2 200');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('BOX');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create DRAW_BOX operation', () => {
      const commands = parser.parse('BOX 120 80 3 150');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('DRAW_BOX');
      expect(results[0].canvasOperations[0].parameters.width).toBe(120);
      expect(results[0].canvasOperations[0].parameters.height).toBe(80);
      expect(results[0].canvasOperations[0].parameters.lineSize).toBe(3);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(150);
    });

    test('should handle missing dimensions', () => {
      const invalidCommands = [
        'BOX',
        'BOX 100'
      ];

      invalidCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(false);
        expect(commands[0].errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('OVAL Command', () => {
    test('should parse OVAL with dimensions', () => {
      const commands = parser.parse('OVAL 60 40');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('OVAL');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse OVAL with dimensions, line size, and opacity', () => {
      const commands = parser.parse('OVAL 80 60 1 180');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('OVAL');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create DRAW_OVAL operation', () => {
      const commands = parser.parse('OVAL 100 70 2 220');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('DRAW_OVAL');
      expect(results[0].canvasOperations[0].parameters.width).toBe(100);
      expect(results[0].canvasOperations[0].parameters.height).toBe(70);
      expect(results[0].canvasOperations[0].parameters.lineSize).toBe(2);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(220);
    });

    test('should handle zero dimensions with warnings', () => {
      const commands = parser.parse('OVAL 0 50');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Drawing Commands Integration', () => {
    test('should handle sequence of drawing commands', () => {
      const commands = [
        'DOT',
        'LINE 100 100',
        'CIRCLE 50',
        'BOX 80 60',
        'OVAL 70 50'
      ];

      commands.forEach(cmd => {
        const parsed = parser.parse(cmd);
        expect(parsed[0].isValid).toBe(true);

        const results = parser.executeCommands(parsed);
        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations).toHaveLength(1);
      });
    });

    test('should validate common parameter patterns', () => {
      const validCommands = [
        'LINE 0 0',           // Zero coordinates
        'CIRCLE 1',           // Minimum diameter
        'DOT 32 255',         // Maximum line size and opacity
        'BOX 1 1 0 0',        // Edge case dimensions and parameters
        'OVAL 2048 2048'      // Large dimensions
      ];

      validCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);

        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
      });
    });

    test('should create drawing operations successfully', () => {
      const commands = parser.parse('LINE 100 200');
      const results = parser.executeCommands(commands);

      // Drawing operations should be created successfully
      expect(results[0].canvasOperations[0].type).toBe('DRAW_LINE');
      expect(results[0].canvasOperations[0].parameters).toBeDefined();
    });
  });
});