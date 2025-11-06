/** @format */

'use strict';

// tests/displaySpecParser.test.ts

import { DisplaySpecParser, BaseDisplaySpec } from '../src/classes/shared/displaySpecParser';
import { Position, Size, WindowColor } from '../src/classes/debugWindowBase';

describe('DisplaySpecParser', () => {
  let spec: BaseDisplaySpec;

  beforeEach(() => {
    spec = {
      title: '',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      nbrSamples: 64,
      window: {
        background: '#000000',
        grid: '#808080'
      }
    };
  });

  describe('parseCommonKeywords', () => {
    test('should parse TITLE keyword with quoted string', () => {
      const lineParts = ['TITLE', '"My Test Title"'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(true);
      expect(consumed).toBe(2);
      expect(spec.title).toBe('My Test Title');
    });

    test('should parse TITLE keyword with single quotes', () => {
      const lineParts = ['TITLE', "'Another Title'"];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(true);
      expect(consumed).toBe(2);
      expect(spec.title).toBe('Another Title');
    });

    test('should parse TITLE keyword without quotes', () => {
      const lineParts = ['TITLE', 'NoQuotes'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(true);
      expect(consumed).toBe(2);
      expect(spec.title).toBe('NoQuotes');
    });

    test('should parse POS keyword with valid coordinates', () => {
      const lineParts = ['POS', '100', '200'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(true);
      expect(consumed).toBe(3);
      expect(spec.position).toEqual({ x: 100, y: 200 });
    });

    test('should handle invalid POS coordinates', () => {
      const lineParts = ['POS', 'abc', '200'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(false);
      expect(consumed).toBe(0);
      expect(spec.position).toEqual({ x: 0, y: 0 }); // unchanged
    });

    test('should parse SIZE keyword with valid dimensions', () => {
      const lineParts = ['SIZE', '640', '480'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(true);
      expect(consumed).toBe(3);
      expect(spec.size).toEqual({ width: 640, height: 480 });
    });

    test('should reject SIZE with zero or negative dimensions', () => {
      const lineParts = ['SIZE', '640', '0'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(false);
      expect(consumed).toBe(0);
    });

    test('should parse SAMPLES keyword', () => {
      const lineParts = ['SAMPLES', '128'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(true);
      expect(consumed).toBe(2);
      expect(spec.nbrSamples).toBe(128);
    });

    test('should reject invalid SAMPLES value', () => {
      const lineParts = ['SAMPLES', '-10'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(false);
      expect(consumed).toBe(0);
    });

    // NOTE: COLOR tests removed - COLOR is not handled in parseCommonKeywords
    // by design. Each window type handles COLOR in its own custom parsing code
    // because SCOPE/LOGIC use it for background+grid, TERM uses it for text colors, etc.
    // See parseColorKeyword() tests below for COLOR parsing functionality.

    test('should handle case-insensitive keywords', () => {
      const lineParts = ['title', '"Test"'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(true);
      expect(consumed).toBe(2);
      expect(spec.title).toBe('Test');
    });

    test('should return false for unknown keywords', () => {
      const lineParts = ['UNKNOWN', 'value'];
      const [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, 0, spec);
      
      expect(parsed).toBe(false);
      expect(consumed).toBe(0);
    });
  });

  describe('parseColorKeyword', () => {
    test('should parse hex color with $ prefix', () => {
      const lineParts = ['COLOR', '$FF0000'];
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, 0);
      
      expect(isValid).toBe(true);
      expect(consumed).toBe(2);
      expect(windowColor.background).toBe('#ff0000');
    });

    test('should parse hex color with # prefix', () => {
      const lineParts = ['COLOR', '#00FF00'];
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, 0);
      
      expect(isValid).toBe(true);
      expect(consumed).toBe(2);
      expect(windowColor.background).toBe('#00FF00');
    });

    test('should parse decimal color value', () => {
      const lineParts = ['COLOR', '16711680']; // 0xFF0000
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, 0);
      
      expect(isValid).toBe(true);
      expect(consumed).toBe(2);
      expect(windowColor.background).toBe('#ff0000');
    });

    test('should parse color names', () => {
      // Note: Colors are returned as-is from DebugColor (full brightness, lowercase)
      // except BLUE which uses uppercase format
      const colorTests = [
        { name: 'BLACK', hex: '#000000' },
        { name: 'WHITE', hex: '#ffffff' },
        { name: 'RED', hex: '#ff0000' },
        { name: 'GREEN', hex: '#00ff00' },
        { name: 'BLUE', hex: '#7F7FFF' },     // Note: uppercase
        { name: 'CYAN', hex: '#00ffff' },
        { name: 'MAGENTA', hex: '#ff00ff' },
        { name: 'YELLOW', hex: '#ffff00' },
        { name: 'ORANGE', hex: '#ff7f00' },
        { name: 'GRAY', hex: '#404040' },
        { name: 'GREY', hex: '#404040' }
      ];

      for (const test of colorTests) {
        const lineParts = ['COLOR', test.name];
        const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, 0);

        expect(isValid).toBe(true);
        expect(consumed).toBe(2);
        expect(windowColor.background).toBe(test.hex); // Don't lowercase - BLUE returns uppercase
      }
    });

    test('should parse color with background and grid', () => {
      const lineParts = ['COLOR', 'BLACK', 'CYAN'];
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, 0);

      expect(isValid).toBe(true);
      expect(consumed).toBe(3);
      expect(windowColor.background).toBe('#000000');
      expect(windowColor.grid).toBe('#00ffff'); // CYAN full brightness
    });

    test('should handle mixed color formats', () => {
      const lineParts = ['COLOR', '$FF0000', 'BLUE'];
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, 0);

      expect(isValid).toBe(true);
      expect(consumed).toBe(3);
      expect(windowColor.background).toBe('#ff0000');
      expect(windowColor.grid).toBe('#7F7FFF'); // BLUE (note: uppercase)
    });

    test('should reject invalid color values', () => {
      const lineParts = ['COLOR', 'INVALID_COLOR'];
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, 0);
      
      expect(isValid).toBe(false);
      expect(consumed).toBe(0);
    });

    test('should handle insufficient parameters', () => {
      const lineParts = ['COLOR'];
      const [isValid, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, 0);
      
      expect(isValid).toBe(false);
      expect(consumed).toBe(0);
    });
  });

  describe('parsePosKeyword', () => {
    test('should parse valid position', () => {
      const lineParts = ['POS', '123', '456'];
      const [isValid, position] = DisplaySpecParser.parsePosKeyword(lineParts, 0);
      
      expect(isValid).toBe(true);
      expect(position).toEqual({ x: 123, y: 456 });
    });

    test('should handle negative coordinates', () => {
      const lineParts = ['POS', '-100', '-200'];
      const [isValid, position] = DisplaySpecParser.parsePosKeyword(lineParts, 0);
      
      expect(isValid).toBe(true);
      expect(position).toEqual({ x: -100, y: -200 });
    });

    test('should reject non-numeric values', () => {
      const lineParts = ['POS', 'abc', '123'];
      const [isValid, position] = DisplaySpecParser.parsePosKeyword(lineParts, 0);
      
      expect(isValid).toBe(false);
      expect(position).toEqual({ x: 0, y: 0 });
    });

    test('should handle single X parameter (Y defaults to 0)', () => {
      // POS with only X is valid - Y defaults to 0
      const lineParts = ['POS', '100'];
      const [isValid, position] = DisplaySpecParser.parsePosKeyword(lineParts, 0);

      expect(isValid).toBe(true);
      expect(position).toEqual({ x: 100, y: 0 });
    });
  });

  describe('validateParameterCount', () => {
    test('should validate sufficient parameters', () => {
      const lineParts = ['COMMAND', 'param1', 'param2', 'param3'];
      
      expect(DisplaySpecParser.validateParameterCount(lineParts, 0, 1)).toBe(true);
      expect(DisplaySpecParser.validateParameterCount(lineParts, 0, 2)).toBe(true);
      expect(DisplaySpecParser.validateParameterCount(lineParts, 0, 3)).toBe(true);
    });

    test('should reject insufficient parameters', () => {
      const lineParts = ['COMMAND', 'param1'];
      
      expect(DisplaySpecParser.validateParameterCount(lineParts, 0, 2)).toBe(false);
      expect(DisplaySpecParser.validateParameterCount(lineParts, 0, 3)).toBe(false);
    });

    test('should handle index offset correctly', () => {
      const lineParts = ['COMMAND1', 'COMMAND2', 'param1', 'param2'];
      
      expect(DisplaySpecParser.validateParameterCount(lineParts, 1, 1)).toBe(true);
      expect(DisplaySpecParser.validateParameterCount(lineParts, 1, 2)).toBe(true);
      expect(DisplaySpecParser.validateParameterCount(lineParts, 1, 3)).toBe(false);
    });
  });

  describe('real-world debug string parsing', () => {
    test('should parse complete LOGIC declaration', () => {
      // Note: In real usage, the quoted title would be kept as a single token
      const lineParts = ['`LOGIC', 'test1', 'TITLE', '"My Logic"', 'POS', '100', '200', 'COLOR', 'BLACK', 'GRAY', 'SAMPLES', '128'];
      
      // Skip the backtick and window name
      let index = 2;
      
      // Parse TITLE
      let [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, index, spec);
      expect(parsed).toBe(true);
      expect(spec.title).toBe('My Logic');
      index += consumed;
      
      // Parse POS
      [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, index, spec);
      expect(parsed).toBe(true);
      expect(spec.position).toEqual({ x: 100, y: 200 });
      index += consumed;

      // Parse COLOR using parseColorKeyword (not parseCommonKeywords)
      let [parsedColor, windowColor, colorConsumed] = DisplaySpecParser.parseColorKeyword(lineParts, index);
      expect(parsedColor).toBe(true);
      expect(windowColor.background).toBe('#000000');
      expect(windowColor.grid).toBe('#404040'); // GRAY at default brightness
      index += colorConsumed;

      // Parse SAMPLES
      [parsed, consumed] = DisplaySpecParser.parseCommonKeywords(lineParts, index, spec);
      expect(parsed).toBe(true);
      expect(spec.nbrSamples).toBe(128);
    });

    test('should parse SCOPE declaration with hex colors', () => {
      const debugString = '`SCOPE test1 COLOR $FF0000 $00FF00 SIZE 800 600';
      const lineParts = debugString.split(' ');

      let index = 2;

      // Parse COLOR using parseColorKeyword (not parseCommonKeywords)
      let [parsed, windowColor, consumed] = DisplaySpecParser.parseColorKeyword(lineParts, index);
      expect(parsed).toBe(true);
      expect(windowColor.background).toBe('#ff0000');
      expect(windowColor.grid).toBe('#00ff00');
      index += consumed;

      // Parse SIZE
      let [parsedSize, consumedSize] = DisplaySpecParser.parseCommonKeywords(lineParts, index, spec);
      expect(parsedSize).toBe(true);
      expect(spec.size).toEqual({ width: 800, height: 600 });
    });
  });
});