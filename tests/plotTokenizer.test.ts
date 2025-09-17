/** @format */

/**
 * Comprehensive unit tests for PlotTokenizer
 * Tests all edge cases and ensures deterministic tokenization
 */

import { PlotTokenizer } from '../src/classes/shared/plotTokenizer';
import { PlotTokenType } from '../src/classes/shared/plotCommandInterfaces';

describe('PlotTokenizer', () => {
  let tokenizer: PlotTokenizer;

  beforeEach(() => {
    tokenizer = new PlotTokenizer();
  });

  describe('Basic Tokenization', () => {
    test('should tokenize simple command', () => {
      const tokens = tokenizer.tokenize('TEXT');

      expect(tokens).toHaveLength(2); // COMMAND + EOF
      expect(tokens[0]).toEqual({
        type: PlotTokenType.COMMAND,
        value: 'TEXT',
        originalText: 'TEXT',
        position: 0
      });
      expect(tokens[1].type).toBe(PlotTokenType.EOF);
    });

    test('should tokenize command with parameters', () => {
      const tokens = tokenizer.tokenize('LINE 10 20');

      expect(tokens).toHaveLength(4); // COMMAND + NUMBER + NUMBER + EOF
      expect(tokens[0].type).toBe(PlotTokenType.COMMAND);
      expect(tokens[0].value).toBe('LINE');
      expect(tokens[1].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[1].value).toBe('10');
      expect(tokens[2].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[2].value).toBe('20');
    });
  });

  describe('Quoted String Handling', () => {
    test('should tokenize single-quoted string', () => {
      const tokens = tokenizer.tokenize("TEXT 'Hello World'");

      expect(tokens).toHaveLength(3); // COMMAND + STRING + EOF
      expect(tokens[1]).toEqual({
        type: PlotTokenType.STRING,
        value: 'Hello World',
        originalText: "'Hello World'",
        position: 5
      });
    });

    test('should tokenize double-quoted string', () => {
      const tokens = tokenizer.tokenize('TEXT "Hello World"');

      expect(tokens).toHaveLength(3);
      expect(tokens[1]).toEqual({
        type: PlotTokenType.STRING,
        value: 'Hello World',
        originalText: '"Hello World"',
        position: 5
      });
    });

    test('should handle empty quoted string', () => {
      const tokens = tokenizer.tokenize("TEXT ''");

      expect(tokens).toHaveLength(3);
      expect(tokens[1]).toEqual({
        type: PlotTokenType.STRING,
        value: '',
        originalText: "''",
        position: 5
      });
    });

    test('should handle unmatched opening quote', () => {
      const tokens = tokenizer.tokenize("TEXT 'Hello World");

      expect(tokens).toHaveLength(3);
      expect(tokens[1]).toEqual({
        type: PlotTokenType.STRING,
        value: 'Hello World',
        originalText: "'Hello World",
        position: 5
      });
    });

    test('should handle string with numbers inside', () => {
      const tokens = tokenizer.tokenize("TEXT '123 Main Street'");

      expect(tokens).toHaveLength(3);
      expect(tokens[1]).toEqual({
        type: PlotTokenType.STRING,
        value: '123 Main Street',
        originalText: "'123 Main Street'",
        position: 5
      });
    });

    test('should handle string with special characters', () => {
      const tokens = tokenizer.tokenize("TEXT 'Hello, \"World\"!'");

      expect(tokens).toHaveLength(3);
      expect(tokens[1]).toEqual({
        type: PlotTokenType.STRING,
        value: 'Hello, "World"!',
        originalText: "'Hello, \"World\"!'",
        position: 5
      });
    });
  });

  describe('Numeric Value Parsing', () => {
    test('should tokenize positive integer', () => {
      const tokens = tokenizer.tokenize('SET 42');

      expect(tokens[1]).toEqual({
        type: PlotTokenType.NUMBER,
        value: '42',
        originalText: '42',
        position: 4
      });
    });

    test('should tokenize negative integer', () => {
      const tokens = tokenizer.tokenize('SET -42');

      expect(tokens[1]).toEqual({
        type: PlotTokenType.NUMBER,
        value: '-42',
        originalText: '-42',
        position: 4
      });
    });

    test('should tokenize decimal number', () => {
      const tokens = tokenizer.tokenize('SET 3.14');

      expect(tokens[1]).toEqual({
        type: PlotTokenType.NUMBER,
        value: '3.14',
        originalText: '3.14',
        position: 4
      });
    });

    test('should tokenize hex number with $ prefix', () => {
      const tokens = tokenizer.tokenize('COLOR $FF00FF');

      expect(tokens[1]).toEqual({
        type: PlotTokenType.NUMBER,
        value: '$FF00FF',
        originalText: '$FF00FF',
        position: 6
      });
    });

    test('should tokenize binary number with % prefix', () => {
      const tokens = tokenizer.tokenize('SET %1010');

      expect(tokens[1]).toEqual({
        type: PlotTokenType.NUMBER,
        value: '%1010',
        originalText: '%1010',
        position: 4
      });
    });

    test('should tokenize quaternary number with %% prefix', () => {
      const tokens = tokenizer.tokenize('SET %%0123');

      expect(tokens[1]).toEqual({
        type: PlotTokenType.NUMBER,
        value: '%%0123',
        originalText: '%%0123',
        position: 4
      });
    });

    test('should tokenize negative hex number', () => {
      const tokens = tokenizer.tokenize('SET -$100');

      expect(tokens[1]).toEqual({
        type: PlotTokenType.NUMBER,
        value: '-$100',
        originalText: '-$100',
        position: 4
      });
    });

    test('should handle decimal with no fractional part', () => {
      const tokens = tokenizer.tokenize('SET 42.');

      expect(tokens[1]).toEqual({
        type: PlotTokenType.NUMBER,
        value: '42.',
        originalText: '42.',
        position: 4
      });
    });
  });

  describe('Command Keywords', () => {
    test('should normalize command case', () => {
      const tokens = tokenizer.tokenize('text');

      expect(tokens[0]).toEqual({
        type: PlotTokenType.COMMAND,
        value: 'TEXT',
        originalText: 'text',
        position: 0
      });
    });

    test('should handle command with underscores', () => {
      const tokens = tokenizer.tokenize('PC_KEY');

      expect(tokens[0]).toEqual({
        type: PlotTokenType.COMMAND,
        value: 'PC_KEY',
        originalText: 'PC_KEY',
        position: 0
      });
    });

    test('should handle command with numbers', () => {
      const tokens = tokenizer.tokenize('SPRITE2D');

      expect(tokens[0]).toEqual({
        type: PlotTokenType.COMMAND,
        value: 'SPRITE2D',
        originalText: 'SPRITE2D',
        position: 0
      });
    });
  });

  describe('Delimiter Handling', () => {
    test('should handle comma delimiters', () => {
      const tokens = tokenizer.tokenize('LINE 10,20,30,40');

      expect(tokens).toHaveLength(9); // COMMAND + NUMBER + DELIMITER + NUMBER + DELIMITER + NUMBER + DELIMITER + NUMBER + EOF
      expect(tokens[2].type).toBe(PlotTokenType.DELIMITER);
      expect(tokens[2].value).toBe(',');
      expect(tokens[4].type).toBe(PlotTokenType.DELIMITER);
      expect(tokens[4].value).toBe(',');
      expect(tokens[6].type).toBe(PlotTokenType.DELIMITER);
      expect(tokens[6].value).toBe(',');
      expect(tokens[8].type).toBe(PlotTokenType.EOF);
    });

    test('should handle space delimiters', () => {
      const tokens = tokenizer.tokenize('LINE 10 20 30 40');

      expect(tokens).toHaveLength(6); // COMMAND + NUMBER + NUMBER + NUMBER + NUMBER + EOF
      // Spaces are consumed as whitespace, not delimiter tokens
      expect(tokens[0].type).toBe(PlotTokenType.COMMAND);
      expect(tokens[1].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[2].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[3].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[4].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[5].type).toBe(PlotTokenType.EOF);
    });

    test('should handle mixed delimiters', () => {
      const tokens = tokenizer.tokenize('LINE 10, 20 , 30');

      expect(tokens).toHaveLength(7); // COMMAND + NUMBER + DELIMITER + NUMBER + DELIMITER + NUMBER + EOF
      expect(tokens[0].type).toBe(PlotTokenType.COMMAND);
      expect(tokens[1].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[2].type).toBe(PlotTokenType.DELIMITER);
      expect(tokens[3].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[4].type).toBe(PlotTokenType.DELIMITER);
      expect(tokens[5].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[6].type).toBe(PlotTokenType.EOF);
    });

    test('should handle tab delimiters', () => {
      const tokens = tokenizer.tokenize('LINE\t10\t20');

      expect(tokens).toHaveLength(6); // COMMAND + DELIMITER + NUMBER + DELIMITER + NUMBER + EOF
      expect(tokens[0].type).toBe(PlotTokenType.COMMAND);
      expect(tokens[0].value).toBe('LINE');
      expect(tokens[1].type).toBe(PlotTokenType.DELIMITER);
      expect(tokens[1].value).toBe('\t');
      expect(tokens[2].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[2].value).toBe('10');
      expect(tokens[3].type).toBe(PlotTokenType.DELIMITER);
      expect(tokens[3].value).toBe('\t');
      expect(tokens[4].type).toBe(PlotTokenType.NUMBER);
      expect(tokens[4].value).toBe('20');
      expect(tokens[5].type).toBe(PlotTokenType.EOF);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty string', () => {
      const tokens = tokenizer.tokenize('');

      expect(tokens).toHaveLength(1); // Only EOF
      expect(tokens[0].type).toBe(PlotTokenType.EOF);
    });

    test('should handle whitespace-only string', () => {
      const tokens = tokenizer.tokenize('   ');

      expect(tokens).toHaveLength(1); // Only EOF
      expect(tokens[0].type).toBe(PlotTokenType.EOF);
    });

    test('should handle string with only delimiters', () => {
      const tokens = tokenizer.tokenize(',,,');

      expect(tokens).toHaveLength(2); // DELIMITER + EOF
      expect(tokens[0]).toEqual({
        type: PlotTokenType.DELIMITER,
        value: ',,,',
        originalText: ',,,',
        position: 0
      });
    });

    test('should handle mixed unknown characters', () => {
      const tokens = tokenizer.tokenize('TEXT @ # %');

      expect(tokens).toHaveLength(5); // COMMAND + UNKNOWN + UNKNOWN + UNKNOWN + EOF
      expect(tokens[1].type).toBe(PlotTokenType.UNKNOWN);
      expect(tokens[1].value).toBe('@');
      expect(tokens[2].type).toBe(PlotTokenType.UNKNOWN);
      expect(tokens[2].value).toBe('#');
      expect(tokens[3].type).toBe(PlotTokenType.UNKNOWN);
      expect(tokens[3].value).toBe('%');
    });

    test('should preserve original text for error reporting', () => {
      const tokens = tokenizer.tokenize("TEXT 'Hello");

      expect(tokens[1].originalText).toBe("'Hello");
      expect(tokens[1].value).toBe('Hello');
    });

    test('should track position correctly', () => {
      const tokens = tokenizer.tokenize('CIRCLE 100 200 50');

      expect(tokens[0].position).toBe(0);  // CIRCLE
      expect(tokens[1].position).toBe(7);  // 100
      expect(tokens[2].position).toBe(11); // 200
      expect(tokens[3].position).toBe(15); // 50
    });
  });

  describe('Complex Commands', () => {
    test('should tokenize TEXT command with all parameters', () => {
      const tokens = tokenizer.tokenize("TEXT 12 4 90 'Hello World'");

      expect(tokens).toHaveLength(6); // COMMAND + NUMBER + NUMBER + NUMBER + STRING + EOF
      expect(tokens[0].value).toBe('TEXT');
      expect(tokens[1].value).toBe('12');
      expect(tokens[2].value).toBe('4');
      expect(tokens[3].value).toBe('90');
      expect(tokens[4].value).toBe('Hello World');
    });

    test('should tokenize CONFIGURE command', () => {
      const tokens = tokenizer.tokenize('CONFIGURE TITLE "My Plot Window"');

      expect(tokens).toHaveLength(4); // COMMAND + COMMAND + STRING + EOF
      expect(tokens[0].value).toBe('CONFIGURE');
      expect(tokens[1].value).toBe('TITLE');
      expect(tokens[2].value).toBe('My Plot Window');
    });

    test('should tokenize color command with brightness', () => {
      const tokens = tokenizer.tokenize('RED 15 TEXT "Hello"');

      expect(tokens).toHaveLength(5); // COMMAND + NUMBER + COMMAND + STRING + EOF
      expect(tokens[0].value).toBe('RED');
      expect(tokens[1].value).toBe('15');
      expect(tokens[2].value).toBe('TEXT');
      expect(tokens[3].value).toBe('Hello');
    });

    test('should handle the problematic TEXT brightness conflict', () => {
      // This was the original conflict case
      const tokens = tokenizer.tokenize("RED 10 TEXT 'Hello'");

      expect(tokens).toHaveLength(5);
      expect(tokens[0].value).toBe('RED');
      expect(tokens[1].value).toBe('10');     // Brightness value
      expect(tokens[2].value).toBe('TEXT');   // Clear command boundary
      expect(tokens[3].value).toBe('Hello');  // Clear text content
    });
  });

  describe('Token Sequence Validation', () => {
    test('should validate well-formed token sequence', () => {
      const tokens = tokenizer.tokenize('TEXT "Hello"');
      const isValid = tokenizer.validateTokenSequence(tokens);

      expect(isValid).toBe(true);
    });

    test('should reject empty token sequence', () => {
      const isValid = tokenizer.validateTokenSequence([]);

      expect(isValid).toBe(false);
    });

    test('should reject sequence not starting with command', () => {
      const tokens = tokenizer.tokenize('"Hello" TEXT');
      const isValid = tokenizer.validateTokenSequence(tokens);

      expect(isValid).toBe(false);
    });

    test('should accept sequence with mixed token types', () => {
      const tokens = tokenizer.tokenize('LINE 10, 20 "label"');
      const isValid = tokenizer.validateTokenSequence(tokens);

      expect(isValid).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large commands efficiently', () => {
      // Create a command with many parameters
      const bigCommand = 'SPRITEDEF 0 32 32 ' + Array(1024).fill('$FF0000').join(' ');

      const startTime = performance.now();
      const tokens = tokenizer.tokenize(bigCommand);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(tokens.length).toBeGreaterThan(1000);
    });

    test('should handle very long strings', () => {
      const longText = 'A'.repeat(10000);
      const tokens = tokenizer.tokenize(`TEXT '${longText}'`);

      expect(tokens).toHaveLength(3);
      expect(tokens[1].value).toBe(longText);
    });
  });
});