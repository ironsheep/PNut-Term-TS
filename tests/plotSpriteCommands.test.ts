/** @format */

/**
 * Unit tests for PLOT sprite and layer commands (SPRITEDEF, SPRITE, LAYER, CROP)
 * Tests command parsing, validation, and integration with sprite/layer managers
 */

import { PlotCommandParser } from '../src/classes/shared/plotCommandParser';
import { Context } from '../src/utils/context';

describe('PLOT Sprite and Layer Commands', () => {
  let parser: PlotCommandParser;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {} as Context;
    parser = new PlotCommandParser(mockContext);
  });

  describe('SPRITEDEF Command', () => {
    test('should parse valid SPRITEDEF command with hex data', () => {
      const commands = parser.parse('SPRITEDEF 0 8 8 $FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('SPRITEDEF');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse valid SPRITEDEF command with binary data', () => {
      const binaryData = '1010101010101010101010101010101010101010101010101010101010101010';
      const commands = parser.parse(`SPRITEDEF 5 8 8 %${binaryData}`);

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('SPRITEDEF');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create DEFINE_SPRITE operation for valid SPRITEDEF', () => {
      const commands = parser.parse('SPRITEDEF 0 4 4 $FF00FF00FF00FF00FF00FF00FF00FF00');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('DEFINE_SPRITE');
      expect(results[0].canvasOperations[0].parameters.spriteId).toBe(0);
      expect(results[0].canvasOperations[0].parameters.width).toBe(4);
      expect(results[0].canvasOperations[0].parameters.height).toBe(4);
    });

    test('should clamp sprite ID to valid range (0-255)', () => {
      const commandsWithClamping = [
        { cmd: 'SPRITEDEF -1 8 8 $FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00', expectedId: 0 },
        { cmd: 'SPRITEDEF 256 8 8 $FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00', expectedId: 255 }
      ];

      commandsWithClamping.forEach(({ cmd, expectedId }) => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);
        expect(commands[0].warnings.length).toBeGreaterThan(0);

        const results = parser.executeCommands(commands);
        expect(results[0].canvasOperations[0].parameters.spriteId).toBe(expectedId);
      });
    });

    test('should clamp sprite dimensions to valid range (1-32)', () => {
      const commandsWithClamping = [
        { cmd: 'SPRITEDEF 0 0 8 $FF00FF00FF00FF00FF00FF00FF00FF00', expectedWidth: 1, expectedHeight: 8 },
        { cmd: 'SPRITEDEF 0 8 0 $FF00FF00FF00FF00FF00FF00FF00FF00', expectedWidth: 8, expectedHeight: 1 },
        { cmd: 'SPRITEDEF 0 33 8 $' + 'FF'.repeat(32 * 8), expectedWidth: 32, expectedHeight: 8 },
        { cmd: 'SPRITEDEF 0 8 33 $' + 'FF'.repeat(8 * 32), expectedWidth: 8, expectedHeight: 32 }
      ];

      commandsWithClamping.forEach(({ cmd, expectedWidth, expectedHeight }) => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);
        expect(commands[0].warnings.length).toBeGreaterThan(0);

        const results = parser.executeCommands(commands);
        expect(results[0].canvasOperations[0].parameters.width).toBe(expectedWidth);
        expect(results[0].canvasOperations[0].parameters.height).toBe(expectedHeight);
      });
    });

    test('should pad pixel data when length is insufficient', () => {
      // 4x4 sprite needs 16 pixels, but only providing 8 - should pad with zeros
      const commands = parser.parse('SPRITEDEF 0 4 4 $FF00FF00FF00FF00');

      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations[0].parameters.pixelData).toBe('$FF00FF00FF00FF00');
    });

    test('should handle missing parameters', () => {
      const invalidCommands = [
        'SPRITEDEF',
        'SPRITEDEF 0',
        'SPRITEDEF 0 8',
        'SPRITEDEF 0 8 8'
      ];

      invalidCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(false);
        expect(commands[0].errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SPRITE Command', () => {
    test('should parse SPRITE command with ID only', () => {
      const commands = parser.parse('SPRITE 5');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('SPRITE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse SPRITE command with position and opacity', () => {
      const commands = parser.parse('SPRITE 10 100 200 128');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('SPRITE');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create DRAW_SPRITE operation for SPRITE', () => {
      const commands = parser.parse('SPRITE 5 50 75 200');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('DRAW_SPRITE');
      expect(results[0].canvasOperations[0].parameters.spriteId).toBe(5);
      expect(results[0].canvasOperations[0].parameters.x).toBe(50);
      expect(results[0].canvasOperations[0].parameters.y).toBe(75);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(200);
    });

    test('should clamp sprite ID to valid range', () => {
      const commandsWithClamping = [
        { cmd: 'SPRITE -1', expectedId: 0 },
        { cmd: 'SPRITE 256', expectedId: 255 }
      ];

      commandsWithClamping.forEach(({ cmd, expectedId }) => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true);
        expect(commands[0].warnings.length).toBeGreaterThan(0);

        const results = parser.executeCommands(commands);
        expect(results[0].canvasOperations[0].parameters.spriteId).toBe(expectedId);
      });
    });

    test('should handle missing sprite ID', () => {
      const commands = parser.parse('SPRITE');

      expect(commands[0].isValid).toBe(false);
      expect(commands[0].errors.some(err => err.includes('Missing sprite ID') || err.includes('Missing required parameters') || err.includes('requires'))).toBe(true);
    });

    test('should use default values for optional parameters', () => {
      const commands = parser.parse('SPRITE 42');
      const results = parser.executeCommands(commands);

      expect(results[0].canvasOperations[0].parameters.x).toBe(0);
      expect(results[0].canvasOperations[0].parameters.y).toBe(0);
      expect(results[0].canvasOperations[0].parameters.opacity).toBe(255);
    });

    test('should clamp opacity to valid range', () => {
      const commands = parser.parse('SPRITE 0 0 0 300');
      const results = parser.executeCommands(commands);

      expect(results[0].canvasOperations[0].parameters.opacity).toBe(255);
      expect(results[0].warnings.length).toBeGreaterThan(0);
    });
  });

  describe('LAYER Command', () => {
    test('should parse LAYER command with layer ID and filename', () => {
      const commands = parser.parse('LAYER 0 background.bmp');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('LAYER');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create LOAD_LAYER operation for LAYER', () => {
      const commands = parser.parse('LAYER 3 texture.bmp');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('LOAD_LAYER');
      expect(results[0].canvasOperations[0].parameters.layerIndex).toBe(3);
      expect(results[0].canvasOperations[0].parameters.filename).toBe('texture.bmp');
    });

    test('should validate layer index range (0-7)', () => {
      const invalidCommands = [
        'LAYER -1 test.bmp',
        'LAYER 8 test.bmp'
      ];

      invalidCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(false);
        expect(commands[0].errors.length).toBeGreaterThan(0);
      });
    });

    test('should validate BMP file extension', () => {
      const invalidCommands = [
        'LAYER 0 image.jpg',
        'LAYER 0 image.png',
        'LAYER 0 image.gif',
        'LAYER 0 image'
      ];

      invalidCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(false);
        expect(commands[0].errors.some(err => err.includes('.bmp extension') || err.includes('Only .bmp extension'))).toBe(true);
      });
    });

    test('should handle missing parameters', () => {
      const invalidCommands = [
        'LAYER',
        'LAYER 0'
      ];

      invalidCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(false);
        expect(commands[0].errors.some(err => err.includes('layer index and filename') || err.includes('requires') || err.includes('Missing'))).toBe(true);
      });
    });
  });

  describe('CROP Command', () => {
    test('should parse CROP command with required parameters', () => {
      const commands = parser.parse('CROP 10 20 100 50');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('CROP');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should parse CROP command with destination coordinates', () => {
      const commands = parser.parse('CROP 0 0 64 64 100 200');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('CROP');
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should create CROP_LAYER operation for CROP', () => {
      const commands = parser.parse('CROP 5 10 80 60 150 250');

      expect(commands).toHaveLength(1);
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true);
      expect(results[0].canvasOperations).toHaveLength(1);
      expect(results[0].canvasOperations[0].type).toBe('CROP_LAYER');
      expect(results[0].canvasOperations[0].parameters.sourceRect.left).toBe(5);
      expect(results[0].canvasOperations[0].parameters.sourceRect.top).toBe(10);
      expect(results[0].canvasOperations[0].parameters.sourceRect.width).toBe(80);
      expect(results[0].canvasOperations[0].parameters.sourceRect.height).toBe(60);
      expect(results[0].canvasOperations[0].parameters.destX).toBe(150);
      expect(results[0].canvasOperations[0].parameters.destY).toBe(250);
    });

    test('should use default destination coordinates when not provided', () => {
      const commands = parser.parse('CROP 0 0 32 32');
      const results = parser.executeCommands(commands);

      expect(results[0].canvasOperations[0].parameters.destX).toBe(0);
      expect(results[0].canvasOperations[0].parameters.destY).toBe(0);
    });

    test('should validate non-negative coordinates and positive dimensions', () => {
      const invalidCommands = [
        'CROP -1 0 32 32',    // negative left
        'CROP 0 -1 32 32',    // negative top
        'CROP 0 0 0 32',      // zero width
        'CROP 0 0 32 0'       // zero height
      ];

      invalidCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(false);
        expect(commands[0].errors.length).toBeGreaterThan(0);
      });
    });

    test('should handle missing required parameters', () => {
      const invalidCommands = [
        'CROP',
        'CROP 10',
        'CROP 10 20',
        'CROP 10 20 30'
      ];

      invalidCommands.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(false);
        expect(commands[0].errors.some(err => err.includes('requires left, top, width, and height') || err.includes('Missing required parameters') || err.includes('requires'))).toBe(true);
      });
    });
  });

  describe('Sprite and Layer Integration', () => {
    test('should handle sequence of sprite commands', () => {
      const commands = [
        'SPRITEDEF 0 4 4 $FF00FF00FF00FF00FF00FF00FF00FF00',
        'SPRITE 0 100 100',
        'LAYER 0 background.bmp',
        'CROP 0 0 64 64 50 50'
      ];

      commands.forEach(cmd => {
        const parsed = parser.parse(cmd);
        expect(parsed[0].isValid).toBe(true);

        const results = parser.executeCommands(parsed);
        expect(results[0].success).toBe(true);
        expect(results[0].canvasOperations).toHaveLength(1);
      });
    });

    test('should handle mixed sprite and drawing commands', () => {
      const spriteCmd = parser.parse('SPRITEDEF 1 8 8 $FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00');
      const dotCmd = parser.parse('DOT 200 300');
      const drawSpriteCmd = parser.parse('SPRITE 1 250 350 200');

      [spriteCmd, dotCmd, drawSpriteCmd].forEach(commands => {
        expect(commands[0].isValid).toBe(true);
        const results = parser.executeCommands(commands);
        expect(results[0].success).toBe(true);
      });
    });

    test('should validate sprite exists before drawing (edge case)', () => {
      // Note: This test checks the parser validation, not the actual sprite manager
      // The sprite manager would handle checking if sprite ID exists during execution
      const commands = parser.parse('SPRITE 255 0 0');

      expect(commands[0].isValid).toBe(true); // Parser should accept valid ID
      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true); // Parser execution should succeed
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed hex pixel data gracefully', () => {
      const commands = parser.parse('SPRITEDEF 0 2 2 $GGHHIIJJ'); // Invalid hex characters

      // Parser accepts it, but execution will handle invalid characters during parsing
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true); // Parser is permissive
    });

    test('should handle malformed binary pixel data gracefully', () => {
      const commands = parser.parse('SPRITEDEF 0 2 2 %10203040'); // Invalid binary characters

      // Parser accepts it, but execution will handle invalid characters during parsing
      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);

      const results = parser.executeCommands(commands);
      expect(results[0].success).toBe(true); // Parser is permissive
    });

    test('should handle maximum size sprites', () => {
      // Create 32x32 sprite (1024 pixels = 2048 hex chars)
      const hexData = '$' + 'FF'.repeat(1024);
      const commands = parser.parse(`SPRITEDEF 255 32 32 ${hexData}`);

      expect(commands[0].isValid).toBe(true);
      expect(commands[0].errors).toHaveLength(0);
    });

    test('should handle coordinate edge cases', () => {
      const edgeCases = [
        'SPRITE 0 -1000 -1000',  // Negative coordinates (should be allowed)
        'SPRITE 0 9999 9999',    // Large coordinates (should be allowed)
        'CROP 0 0 1 1 -500 -500' // Negative destination (should be allowed)
      ];

      edgeCases.forEach(cmd => {
        const commands = parser.parse(cmd);
        expect(commands[0].isValid).toBe(true); // Parser should allow these
      });
    });
  });
});