/** @format */

/**
 * Unit tests for PLOT interactive commands (PC_KEY and PC_MOUSE)
 * Tests command parsing and basic operation creation
 */

import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { Context } from '../src/utils/context';

describe('PLOT Interactive Commands', () => {
  let parser: PlotCommandParser;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {} as Context;
    parser = new PlotCommandParser(mockContext);
  });

  describe('PC_KEY Command', () => {
    test('should parse PC_KEY command', () => {
      const commands = parser.parse('PC_KEY');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('PC_KEY');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create PC_INPUT operation for PC_KEY', () => {
      const commands = parser.parse('PC_KEY');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('PC_INPUT');
      expect(results[0].canvasOperations[0].parameters.inputType).toBe('KEY');
    });
  });

  describe('PC_MOUSE Command', () => {
    test('should parse PC_MOUSE command', () => {
      const commands = parser.parse('PC_MOUSE');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('PC_MOUSE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create PC_INPUT operation for PC_MOUSE', () => {
      const commands = parser.parse('PC_MOUSE');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('PC_INPUT');
      expect(results[0].canvasOperations[0].parameters.inputType).toBe('MOUSE');
    });
  });

  describe('Interactive Commands Integration', () => {
    test('should handle multiple interactive commands in sequence', () => {
      const commands1 = parser.parse('PC_KEY');
      const commands2 = parser.parse('PC_MOUSE');

      const results1 = parser.executeCommands(commands1);
      const results2 = parser.executeCommands(commands2);

      expect(results1[0].success).toBe(true);
      expect(results2[0].success).toBe(true);

      expect(results1[0].canvasOperations[0].parameters.inputType).toBe('KEY');
      expect(results2[0].canvasOperations[0].parameters.inputType).toBe('MOUSE');
    });

    test('should work with mixed drawing and interactive commands', () => {
      const keyCommands = parser.parse('PC_KEY');
      const dotCommands = parser.parse('DOT 100 200');
      const mouseCommands = parser.parse('PC_MOUSE');

      const keyResults = parser.executeCommands(keyCommands);
      const dotResults = parser.executeCommands(dotCommands);
      const mouseResults = parser.executeCommands(mouseCommands);

      expect(keyResults[0].success).toBe(true);
      expect(dotResults[0].success).toBe(true);
      expect(mouseResults[0].success).toBe(true);

      expect(keyResults[0].canvasOperations[0].type).toBe('PC_INPUT');
      expect(dotResults[0].canvasOperations[0].type).toBe('DRAW_DOT');
      expect(mouseResults[0].canvasOperations[0].type).toBe('PC_INPUT');
    });
  });
});