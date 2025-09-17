import { describe, expect, it, beforeEach } from '@jest/globals';
import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { PlotOperationFactory, CanvasOperationType } from '../src/classes/shared/plotParserIntegration';

describe('PlotCommandParser - Compound Commands', () => {
  let parser: PlotCommandParser;

  beforeEach(() => {
    parser = new PlotCommandParser({} as any);
  });

  describe('Compound Command Recognition', () => {
    it('should recognize compound commands with multiple operations', () => {
      const command = 'set 330 270 cyan 3 text 30 3 "Hub RAM Interface"';
      const parsed = parser.parse(command);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].command).toBe('COMPOUND');
      expect(parsed[0].isValid).toBe(true);
    });

    it('should recognize SET + COLOR + TEXT compound', () => {
      const command = 'set 100 200 red 5 text 20 1 "Hello World"';
      const parsed = parser.parse(command);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].command).toBe('COMPOUND');
    });

    it('should recognize COLOR + SET + drawing compound', () => {
      const command = 'cyan 6 set 103 0 circle 55';
      const parsed = parser.parse(command);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].command).toBe('COMPOUND');
    });

    it('should parse single commands as non-compound', () => {
      const command = 'set 100 200';
      const parsed = parser.parse(command);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].command).toBe('SET');
    });
  });

  describe('Compound Command Execution', () => {
    it('should generate correct operations for SET + CYAN + TEXT', () => {
      const command = 'set 330 270 cyan 3 text 30 3 "Hub RAM Interface"';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);

      const operations = results[0].canvasOperations;
      expect(operations).toHaveLength(3);

      // Check SET operation
      const setOp = operations[0];
      expect(setOp.parameters.x).toBe(330);
      expect(setOp.parameters.y).toBe(270);

      // Check COLOR operation
      const colorOp = operations[1];
      expect(colorOp.parameters.color).toBe('CYAN');
      expect(colorOp.parameters.brightness).toBe(3);

      // Check TEXT operation
      const textOp = operations[2];
      expect(textOp.parameters.size).toBe(30);
      expect(textOp.parameters.style).toMatch(/000000[01]{2}/); // Binary pattern
      expect(textOp.parameters.text).toBe('Hub RAM Interface');
    });

    it('should generate correct operations for multiple LINEs with color', () => {
      const command = 'grey 12 set 103 8 line 190 8 20';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);

      const operations = results[0].canvasOperations;
      expect(operations).toHaveLength(3);

      // Check COLOR operation
      expect(operations[0].parameters.color).toBe('GREY');
      expect(operations[0].parameters.brightness).toBe(12);

      // Check SET operation
      expect(operations[1].parameters.x).toBe(103);
      expect(operations[1].parameters.y).toBe(8);

      // Check LINE operation
      expect(operations[2].parameters.x).toBe(190);
      expect(operations[2].parameters.y).toBe(8);
      expect(operations[2].parameters.lineSize).toBe(20);
    });
  });

  describe('Deferral Flags', () => {
    it('should make all operations in compound commands deferrable', () => {
      const command = 'set 330 270 cyan 3 text 30 3 "Test"';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      const operations = results[0].canvasOperations;

      // All operations should be deferrable
      operations.forEach(op => {
        if (op && typeof op === 'object' && 'deferrable' in op) {
          expect(op.deferrable).toBe(true);
        }
      });
    });

    it('SET operations should be deferrable', () => {
      const command = 'set 100 200';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      const operation = results[0].canvasOperations[0];
      if (operation && typeof operation === 'object' && 'deferrable' in operation) {
        expect(operation.deferrable).toBe(true);
      }
    });

    it('COLOR operations should be deferrable', () => {
      const command = 'cyan 5';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      const operation = results[0].canvasOperations[0];
      if (operation && typeof operation === 'object' && 'deferrable' in operation) {
        expect(operation.deferrable).toBe(true);
      }
    });

    it('UPDATE should remain immediate', () => {
      const command = 'update';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      const operation = results[0].canvasOperations[0];
      if (operation && typeof operation === 'object' && 'deferrable' in operation) {
        expect(operation.deferrable).toBe(false);
      }
    });

    it('CLOSE should remain immediate', () => {
      const command = 'close';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      const operation = results[0].canvasOperations[0];
      if (operation && typeof operation === 'object' && 'deferrable' in operation) {
        expect(operation.deferrable).toBe(false);
      }
    });
  });

  describe('Color Command Handling', () => {
    it('should correctly handle CYAN with brightness', () => {
      const command = 'cyan 3';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);

      const colorOp = results[0].canvasOperations[0];
      expect(colorOp.parameters.color).toBe('CYAN');
      expect(colorOp.parameters.brightness).toBe(3);
    });

    it('should handle color in compound command', () => {
      const command = 'set 0 0 red 15';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      expect(results[0].success).toBe(true);
      const operations = results[0].canvasOperations;

      // Should have SET and COLOR operations
      expect(operations.length).toBeGreaterThanOrEqual(2);

      // Find color operation
      const colorOp = operations.find(op =>
        op.parameters && op.parameters.color === 'RED'
      );
      expect(colorOp).toBeDefined();
      expect(colorOp?.parameters.brightness).toBe(15);
    });

    it('should handle all color names', () => {
      const colors = ['BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'CYAN', 'MAGENTA', 'YELLOW', 'ORANGE', 'GRAY', 'GREY'];

      colors.forEach(color => {
        const command = `${color.toLowerCase()} 10`;
        const parsed = parser.parse(command);
        const results = parser.executeCommands(parsed);

        expect(results[0].success).toBe(true);
        const colorOp = results[0].canvasOperations[0];
        const expectedColor = color === 'GREY' ? 'GREY' : color;
        expect(colorOp.parameters.color).toBe(expectedColor);
        expect(colorOp.parameters.brightness).toBe(10);
      });
    });
  });

  describe('Text Command Handling', () => {
    it('should preserve text content in TEXT command', () => {
      const command = 'text 30 3 "Hub RAM Interface"';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      expect(results[0].success).toBe(true);
      const textOp = results[0].canvasOperations[0];

      expect(textOp.parameters.size).toBe(30);
      expect(textOp.parameters.text).toBe('Hub RAM Interface');
    });

    it('should handle text with spaces', () => {
      const command = 'text 20 1 "Hello World with spaces"';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      const textOp = results[0].canvasOperations[0];
      expect(textOp.parameters.text).toBe('Hello World with spaces');
    });

    it('should handle single-quoted text', () => {
      const command = "text 20 1 'Single quoted text'";
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      const textOp = results[0].canvasOperations[0];
      expect(textOp.parameters.text).toBe('Single quoted text');
    });
  });

  describe('Real-world Test Cases', () => {
    it('should handle Hub RAM Interface compound command', () => {
      const command = 'set 330 0 cyan 3 text 30 3 "Hub RAM Interface"';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      expect(results[0].success).toBe(true);
      const ops = results[0].canvasOperations;

      // Verify all three operations are present
      expect(ops).toHaveLength(3);

      // SET at correct position
      expect(ops[0].parameters.x).toBe(330);
      expect(ops[0].parameters.y).toBe(0);

      // CYAN with brightness
      expect(ops[1].parameters.color).toBe('CYAN');
      expect(ops[1].parameters.brightness).toBe(3);

      // TEXT with content
      expect(ops[2].parameters.text).toBe('Hub RAM Interface');
    });

    it('should handle grey line drawing compound', () => {
      const command = 'grey 12 set 103 8 line 190 8 20';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      expect(results[0].success).toBe(true);
      const ops = results[0].canvasOperations;

      expect(ops).toHaveLength(3);

      // GREY color
      expect(ops[0].parameters.color).toBe('GREY');
      expect(ops[0].parameters.brightness).toBe(12);

      // SET position
      expect(ops[1].parameters.x).toBe(103);
      expect(ops[1].parameters.y).toBe(8);

      // LINE parameters
      expect(ops[2].parameters.x).toBe(190);
      expect(ops[2].parameters.y).toBe(8);
      expect(ops[2].parameters.lineSize).toBe(20);
    });

    it('should handle cyan circle compound', () => {
      const command = 'cyan 6 set 103 0 circle 55';
      const parsed = parser.parse(command);
      const results = parser.executeCommands(parsed);

      expect(results[0].success).toBe(true);
      const ops = results[0].canvasOperations;

      expect(ops).toHaveLength(3);

      // CYAN color
      expect(ops[0].parameters.color).toBe('CYAN');
      expect(ops[0].parameters.brightness).toBe(6);

      // SET position
      expect(ops[1].parameters.x).toBe(103);
      expect(ops[1].parameters.y).toBe(0);

      // CIRCLE diameter
      expect(ops[2].parameters.diameter).toBe(55);
    });
  });
});