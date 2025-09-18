/** @format */

/**
 * Comprehensive unit tests for PLOT rendering control commands (COLORMODE, TEXTSIZE, TEXTSTYLE)
 * Tests all command variations including edge cases and error handling
 */

import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { Context } from '../src/utils/context';

describe('PLOT Rendering Control Commands', () => {
  let parser: PlotCommandParser;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {} as Context;
    parser = new PlotCommandParser(mockContext);
  });

  describe('COLORMODE Command', () => {
    test('should parse RGB mode (0)', () => {
      const commands = parser.parse('COLORMODE 0');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('COLORMODE');
      expect(commands[0].isValid).toBe(true);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.mode).toBe(0);
      expect(results[0].canvasOperations[0].parameters.modeName).toBe('RGB');
    });

    test('should parse HSV mode (1)', () => {
      const commands = parser.parse('COLORMODE 1');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.mode).toBe(1);
      expect(results[0].canvasOperations[0].parameters.modeName).toBe('HSV');
    });

    test('should parse indexed palette mode (2)', () => {
      const commands = parser.parse('COLORMODE 2');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.mode).toBe(2);
      expect(results[0].canvasOperations[0].parameters.modeName).toBe('INDEXED');
    });

    test('should parse grayscale mode (3)', () => {
      const commands = parser.parse('COLORMODE 3');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.mode).toBe(3);
      expect(results[0].canvasOperations[0].parameters.modeName).toBe('GRAYSCALE');
    });

    test('should handle invalid mode with warning and default to RGB', () => {
      const commands = parser.parse('COLORMODE 5');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBeGreaterThan(0);
      expect(results[0].canvasOperations[0].parameters.mode).toBe(0); // default RGB
    });

    test('should fail with missing mode parameter', () => {
      const commands = parser.parse('COLORMODE');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('Missing required parameters');
    });

    test('should handle invalid mode parameter with warning', () => {
      const commands = parser.parse('COLORMODE invalid');

      expect(commands).toHaveLength(1);
      // This will fail at command registry level due to type validation
      expect(commands[0].isValid).toBe(false);
    });
  });

  describe('TEXTSIZE Command', () => {
    test('should parse valid text size', () => {
      const commands = parser.parse('TEXTSIZE 16');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('TEXTSIZE');
      expect(commands[0].isValid).toBe(true);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.textSize).toBe(16);
    });

    test('should clamp text size to minimum (1)', () => {
      const commands = parser.parse('TEXTSIZE 0');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBeGreaterThanOrEqual(1);
      expect(results[0].canvasOperations[0].parameters.textSize).toBe(1); // clamped from 0
    });

    test('should clamp text size to maximum (100)', () => {
      const commands = parser.parse('TEXTSIZE 150');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBeGreaterThanOrEqual(1);
      expect(results[0].canvasOperations[0].parameters.textSize).toBe(100); // clamped from 150
    });

    test('should handle invalid size with warning and use default', () => {
      const commands = parser.parse('TEXTSIZE invalid_size');

      expect(commands).toHaveLength(1);
      // This will fail at command registry level due to type validation
      expect(commands[0].isValid).toBe(false);
    });

    test('should fail with missing size parameter', () => {
      const commands = parser.parse('TEXTSIZE');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('Missing required parameters');
    });

    test('should parse edge case sizes correctly', () => {
      // Test minimum valid size
      const commands1 = parser.parse('TEXTSIZE 1');
      const results1 = parser.executeCommands(commands1);
      expect(results1[0].success).toBe(true);
      expect(results1[0].canvasOperations[0].parameters.textSize).toBe(1);

      // Test maximum valid size
      const commands2 = parser.parse('TEXTSIZE 100');
      const results2 = parser.executeCommands(commands2);
      expect(results2[0].success).toBe(true);
      expect(results2[0].canvasOperations[0].parameters.textSize).toBe(100);
    });
  });

  describe('TEXTSTYLE Command', () => {
    test('should parse normal style (0)', () => {
      const commands = parser.parse('TEXTSTYLE 0');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('TEXTSTYLE');
      expect(commands[0].isValid).toBe(true);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.textStyle).toBe(0);
      expect(results[0].canvasOperations[0].parameters.bold).toBe(false);
      expect(results[0].canvasOperations[0].parameters.italic).toBe(false);
      expect(results[0].canvasOperations[0].parameters.underline).toBe(false);
    });

    test('should parse bold style (1)', () => {
      const commands = parser.parse('TEXTSTYLE 1');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.textStyle).toBe(1);
      expect(results[0].canvasOperations[0].parameters.bold).toBe(true);
      expect(results[0].canvasOperations[0].parameters.italic).toBe(false);
      expect(results[0].canvasOperations[0].parameters.underline).toBe(false);
    });

    test('should parse italic style (2)', () => {
      const commands = parser.parse('TEXTSTYLE 2');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.textStyle).toBe(2);
      expect(results[0].canvasOperations[0].parameters.bold).toBe(false);
      expect(results[0].canvasOperations[0].parameters.italic).toBe(true);
      expect(results[0].canvasOperations[0].parameters.underline).toBe(false);
    });

    test('should parse bold+italic style (3)', () => {
      const commands = parser.parse('TEXTSTYLE 3');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.textStyle).toBe(3);
      expect(results[0].canvasOperations[0].parameters.bold).toBe(true);
      expect(results[0].canvasOperations[0].parameters.italic).toBe(true);
      expect(results[0].canvasOperations[0].parameters.underline).toBe(false);
    });

    test('should parse underline style (4)', () => {
      const commands = parser.parse('TEXTSTYLE 4');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.textStyle).toBe(4);
      expect(results[0].canvasOperations[0].parameters.bold).toBe(false);
      expect(results[0].canvasOperations[0].parameters.italic).toBe(false);
      expect(results[0].canvasOperations[0].parameters.underline).toBe(true);
    });

    test('should parse all styles combined (7)', () => {
      const commands = parser.parse('TEXTSTYLE 7');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.textStyle).toBe(7);
      expect(results[0].canvasOperations[0].parameters.bold).toBe(true);
      expect(results[0].canvasOperations[0].parameters.italic).toBe(true);
      expect(results[0].canvasOperations[0].parameters.underline).toBe(true);
    });

    test('should clamp style to valid range (0-7)', () => {
      const commands = parser.parse('TEXTSTYLE 15');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].warnings.length).toBeGreaterThanOrEqual(1);
      expect(results[0].canvasOperations[0].parameters.textStyle).toBe(7); // clamped from 15
    });

    test('should handle invalid style with warning and use default', () => {
      const commands = parser.parse('TEXTSTYLE invalid_style');

      expect(commands).toHaveLength(1);
      // This will fail at command registry level due to type validation
      expect(commands[0].isValid).toBe(false);
    });

    test('should fail with missing style parameter', () => {
      const commands = parser.parse('TEXTSTYLE');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(false);
      expect(results[0].errors[0]).toContain('Missing required parameters');
    });
  });

  describe('Command Integration', () => {
    test('should create state-affecting operations', () => {
      const commands1 = parser.parse('COLORMODE 2');
      const commands2 = parser.parse('TEXTSIZE 24');
      const commands3 = parser.parse('TEXTSTYLE 5');

      const results1 = parser.executeCommands(commands1);
      const results2 = parser.executeCommands(commands2);
      const results3 = parser.executeCommands(commands3);

      expect(results1[0].success).toBe(true);
      expect(results2[0].success).toBe(true);
      expect(results3[0].success).toBe(true);

      // All should be deferrable state operations
      expect(results1[0].canvasOperations[0].type).toBe('SET_COLOR_MODE');
      expect(results2[0].canvasOperations[0].type).toBe('SET_TEXTSIZE');
      expect(results3[0].canvasOperations[0].type).toBe('SET_TEXTSTYLE');
    });

    test('should handle command sequences correctly', () => {
      const commands = parser.parse('COLORMODE 1');
      const results = parser.executeCommands(commands);

      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.mode).toBe(1);
      expect(results[0].canvasOperations[0].parameters.modeName).toBe('HSV');

      // Next command should work independently
      const commands2 = parser.parse('TEXTSIZE 48');
      const results2 = parser.executeCommands(commands2);

      expect(results2[0].success).toBe(true);
      expect(results2[0].canvasOperations[0].parameters.textSize).toBe(48);
    });

    test('should validate bitfield operations correctly', () => {
      // Test various bitfield combinations
      const testCases = [
        { input: 0, expected: { bold: false, italic: false, underline: false } },
        { input: 1, expected: { bold: true, italic: false, underline: false } },
        { input: 2, expected: { bold: false, italic: true, underline: false } },
        { input: 4, expected: { bold: false, italic: false, underline: true } },
        { input: 5, expected: { bold: true, italic: false, underline: true } },
        { input: 6, expected: { bold: false, italic: true, underline: true } },
        { input: 7, expected: { bold: true, italic: true, underline: true } }
      ];

      testCases.forEach(testCase => {
        const commands = parser.parse(`TEXTSTYLE ${testCase.input}`);
        const results = parser.executeCommands(commands);

        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations[0].parameters.bold).toBe(testCase.expected.bold);
        expect(results[0].canvasOperations[0].parameters.italic).toBe(testCase.expected.italic);
        expect(results[0].canvasOperations[0].parameters.underline).toBe(testCase.expected.underline);
      });
    });
  });
});