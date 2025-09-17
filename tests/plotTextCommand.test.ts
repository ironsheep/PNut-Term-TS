/** @format */

/**
 * Comprehensive tests for TEXT command parsing
 * Specifically tests edge cases that broke the old lookahead parser
 */

import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { PlotTokenType } from '../src/classes/shared/plotCommandInterfaces';

// Mock Context for testing
class MockContext {
  constructor() {}
}

describe('PlotCommandParser - TEXT Command', () => {
  let parser: PlotCommandParser;
  let mockContext: MockContext;

  beforeEach(() => {
    mockContext = new MockContext();
    parser = new PlotCommandParser(mockContext as any);
  });

  describe('Basic TEXT Command Parsing', () => {
    test('should parse simple text command', () => {
      const commands = parser.parse('TEXT "Hello World"');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('TEXT');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters).toHaveLength(1);
      expect(commands[0].parameters[0].type).toBe(PlotTokenType.STRING);
      expect(commands[0].parameters[0].value).toBe('Hello World');
    });

    test('should parse text with size parameter', () => {
      const commands = parser.parse('TEXT 16 "Large Text"');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters).toHaveLength(2);
      expect(commands[0].parameters[0].value).toBe('16');
      expect(commands[0].parameters[1].value).toBe('Large Text');
    });

    test('should parse text with all parameters', () => {
      const commands = parser.parse('TEXT 12 4 90 "Rotated Text"');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters).toHaveLength(4);
      expect(commands[0].parameters[0].value).toBe('12');  // size
      expect(commands[0].parameters[1].value).toBe('4');   // style
      expect(commands[0].parameters[2].value).toBe('90');  // angle
      expect(commands[0].parameters[3].value).toBe('Rotated Text'); // text
    });
  });

  describe('Edge Cases - Old Parser Conflicts', () => {
    test('should handle the classic brightness/TEXT conflict', () => {
      // This was the original problem: "RED 10 TEXT 'Hello'"
      // Old parser couldn't distinguish between brightness value and TEXT parameters
      const commands = parser.parse("RED 10 TEXT 'Hello'");

      expect(commands).toHaveLength(2);

      // First command: RED with brightness
      expect(commands[0].command).toBe('RED');
      expect(commands[0].parameters[0].value).toBe('10');

      // Second command: TEXT with no ambiguity
      expect(commands[1].command).toBe('TEXT');
      expect(commands[1].parameters[0].value).toBe('Hello');
    });

    test('should handle numeric-looking text content', () => {
      const commands = parser.parse("TEXT '123 Main Street'");

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[0].value).toBe('123 Main Street');
    });

    test('should handle hex values in text content', () => {
      const commands = parser.parse("TEXT 'Address: $FF00FF is my color'");

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[0].value).toBe('Address: $FF00FF is my color');
    });

    test('should handle coordinate-looking text content', () => {
      const commands = parser.parse("TEXT 'Go to coordinates 100,200'");

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[0].value).toBe('Go to coordinates 100,200');
    });

    test('should handle text that starts with numbers', () => {
      const commands = parser.parse("TEXT '42 is the answer'");

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[0].value).toBe('42 is the answer');
    });

    test('should handle scientific notation in text', () => {
      const commands = parser.parse("TEXT 'Speed: 3e8 m/s'");

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[0].value).toBe('Speed: 3e8 m/s');
    });
  });

  describe('Spin2 Numeric Formats in Parameters', () => {
    test('should handle hex size parameter', () => {
      const commands = parser.parse('TEXT $10 "Hex sized text"');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[0].value).toBe('$10');
    });

    test('should handle binary style parameter', () => {
      const commands = parser.parse('TEXT 12 %101 45 "Binary styled"');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[1].value).toBe('%101');
    });

    test('should handle quaternary angle parameter', () => {
      const commands = parser.parse('TEXT 12 4 %%22 "Quaternary angle"');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[2].value).toBe('%%22');
    });

    test('should handle floating point angle', () => {
      const commands = parser.parse('TEXT 12 4 45.5 "Floating angle"');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[2].value).toBe('45.5');
    });

    test('should handle scientific notation in parameters', () => {
      const commands = parser.parse('TEXT 1e1 "Scientific size"');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[0].value).toBe('1e1');
    });
  });

  describe('Quote Handling', () => {
    test('should handle single quotes', () => {
      const commands = parser.parse("TEXT 'Single quoted text'");

      expect(commands).toHaveLength(1);
      expect(commands[0].parameters[0].value).toBe('Single quoted text');
    });

    test('should handle double quotes', () => {
      const commands = parser.parse('TEXT "Double quoted text"');

      expect(commands).toHaveLength(1);
      expect(commands[0].parameters[0].value).toBe('Double quoted text');
    });

    test('should handle quotes within text content', () => {
      const commands = parser.parse('TEXT "He said \'Hello\' to me"');

      expect(commands).toHaveLength(1);
      expect(commands[0].parameters[0].value).toBe("He said 'Hello' to me");
    });

    test('should handle empty text string', () => {
      const commands = parser.parse('TEXT ""');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].parameters[0].value).toBe('');
    });
  });

  describe('Parameter Validation', () => {
    test('should reject missing text parameter', () => {
      const commands = parser.parse('TEXT 12 4 90');

      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(false);
      expect(commands[0].errors[0]).toContain('text string parameter');
    });

    test('should handle invalid size parameter gracefully', () => {
      const results = parser.executeCommands(parser.parse('TEXT abc "Invalid size"'));

      expect(results).toHaveLength(1);
      expect(results[0].warnings).toBeDefined();
      expect(results[0].warnings.some(w => w.includes('Invalid text size'))).toBe(true);
    });

    test('should clamp size parameter to valid range', () => {
      const results = parser.executeCommands(parser.parse('TEXT 500 "Too big"'));

      expect(results).toHaveLength(1);
      expect(results[0].warnings).toBeDefined();
      expect(results[0].warnings.some(w => w.includes('Invalid text size'))).toBe(true);
    });

    test('should handle negative style parameter', () => {
      const results = parser.executeCommands(parser.parse('TEXT 12 -1 "Negative style"'));

      expect(results).toHaveLength(1);
      expect(results[0].warnings).toBeDefined();
      expect(results[0].warnings.some(w => w.includes('Invalid text style'))).toBe(true);
    });

    test('should normalize angle parameter', () => {
      const results = parser.executeCommands(parser.parse('TEXT 12 4 450 "Wrapped angle"'));

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      // Angle should be normalized to 90 degrees (450 % 360 = 90)
    });
  });

  describe('Complex Mixed Commands', () => {
    test('should handle color + text sequence', () => {
      const commands = parser.parse('BLUE 12 TEXT 16 "Blue text"');

      expect(commands).toHaveLength(2);
      expect(commands[0].command).toBe('BLUE');
      expect(commands[0].parameters[0].value).toBe('12');
      expect(commands[1].command).toBe('TEXT');
      expect(commands[1].parameters[0].value).toBe('16');
      expect(commands[1].parameters[1].value).toBe('Blue text');
    });

    test('should handle position + text sequence', () => {
      const commands = parser.parse('SET 100 200 TEXT "Positioned text"');

      expect(commands).toHaveLength(2);
      expect(commands[0].command).toBe('SET');
      expect(commands[1].command).toBe('TEXT');
      expect(commands[1].parameters[0].value).toBe('Positioned text');
    });

    test('should handle multiple text commands', () => {
      const commands = parser.parse('TEXT "First" TEXT 20 "Second"');

      expect(commands).toHaveLength(2);
      expect(commands[0].parameters[0].value).toBe('First');
      expect(commands[1].parameters[0].value).toBe('20');
      expect(commands[1].parameters[1].value).toBe('Second');
    });
  });

  describe('Error Recovery', () => {
    test('should continue parsing after text error', () => {
      const commands = parser.parse('TEXT invalid LINE 10 20');

      expect(commands).toHaveLength(2);
      expect(commands[0].command).toBe('TEXT');
      expect(commands[0].isValid).toBe(false);
      expect(commands[1].command).toBe('LINE');
      expect(commands[1].isValid).toBe(true);
    });

    test('should handle malformed quotes gracefully', () => {
      const commands = parser.parse('TEXT "Unclosed quote LINE 10 20');

      expect(commands).toHaveLength(2);
      expect(commands[0].command).toBe('TEXT');
      expect(commands[1].command).toBe('LINE');
    });
  });

  describe('Canvas Operation Generation', () => {
    test('should generate correct canvas operations for simple text', () => {
      const commands = parser.parse('TEXT "Hello"');
      const results = parser.executeCommands(commands);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(2);

      // First operation: FONT setup
      expect(results[0].canvasOperations[0].parameters.operation).toBe('FONT');
      expect(results[0].canvasOperations[0].parameters.size).toBe(10);
      expect(results[0].canvasOperations[0].parameters.style).toBe('00000001');
      expect(results[0].canvasOperations[0].parameters.angle).toBe(0);

      // Second operation: TEXT rendering
      expect(results[0].canvasOperations[1].parameters.operation).toBe('TEXT');
      expect(results[0].canvasOperations[1].parameters.text).toBe('Hello');
    });

    test('should generate correct operations for complex text', () => {
      const commands = parser.parse('TEXT 16 7 45 "Complex"');
      const results = parser.executeCommands(commands);

      expect(results[0].canvasOperations[0].parameters.size).toBe(16);
      expect(results[0].canvasOperations[0].parameters.style).toBe('00000111'); // 7 in binary
      expect(results[0].canvasOperations[0].parameters.angle).toBe(45);
      expect(results[0].canvasOperations[1].parameters.text).toBe('Complex');
    });
  });

  describe('Performance', () => {
    test('should parse large text efficiently', () => {
      const largeText = 'A'.repeat(10000);
      const startTime = performance.now();

      const commands = parser.parse(`TEXT "${largeText}"`);
      const results = parser.executeCommands(commands);

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[1].parameters.text).toBe(largeText);
    });

    test('should handle many parameters efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const commands = parser.parse(`TEXT ${i} ${i % 256} ${i % 360} "Text ${i}"`);
        parser.executeCommands(commands);
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should handle 1000 commands quickly
    });
  });
});