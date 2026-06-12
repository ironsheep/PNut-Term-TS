/** @format */

'use strict';

// tests/colorCommand.test.ts
//
// [9win §4b] Window COLOR directive parsing. Pascal `key_color` resolves through
// KeyColor (DebugDisplayUnit.pas:2752): a color NAME -> RGBI8X, a NUMBER -> literal,
// anything else -> KeyColor returns False (caller keeps its default). This file
// exercises DisplaySpecParser.parseColorKeyword (the COLOR background/grid parser)
// and the directive-vs-default distinction at the integration level. The exhaustive
// per-name DebugColor unit coverage lives in debugColor.test.ts.

import { DebugColor } from '../src/classes/shared/debugColor';
import { DisplaySpecParser } from '../src/classes/shared/displaySpecParser';

describe('COLOR directive parsing [9win §4b]', () => {
  const parseColor = (debugString: string) => {
    const parts = debugString.split(' ');
    const index = parts.indexOf('COLOR');
    return DisplaySpecParser.parseColorKeyword(parts, index);
  };

  describe('Window COLOR directive resolves names via RGBI8X', () => {
    it('parses COLOR with background only (grid keeps its default)', () => {
      const [isValid, windowColor, consumed] = parseColor('`LOGIC t COLOR BLACK');
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#000000');
      // Empty sentinel = grid not given; the caller keeps its own window default
      // ($404040), matching Pascal's untouched vGridColor. [parity]
      expect(windowColor.grid).toBe('');
      expect(consumed).toBe(2); // COLOR + background
    });

    it('parses COLOR background + grid through the RGBI8X directive path', () => {
      const [isValid, windowColor, consumed] = parseColor('`LOGIC t COLOR BLACK GRAY');
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#000000');
      expect(windowColor.grid).toBe('#848484'); // RGBI8X GRAY, not clGray
      expect(consumed).toBe(3);
    });

    it('parses COLOR WHITE BLACK', () => {
      const [isValid, windowColor] = parseColor('`SCOPE t COLOR WHITE BLACK');
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#ffffff');
      expect(windowColor.grid).toBe('#000000');
    });

    it('applies the optional brightness nibble per RGBI8X', () => {
      const [isValid, windowColor, consumed] = parseColor('`LOGIC t COLOR BLUE 4 GRAY 6');
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#000084'); // BLUE at brightness 4 (toward black)
      expect(windowColor.grid).toBe('#636363'); // GRAY at brightness 6
      expect(consumed).toBe(5);
    });
  });

  describe('Window COLOR directive resolves numeric literals directly', () => {
    it('parses hex ($RRGGBB) values', () => {
      const [isValid, windowColor, consumed] = parseColor('`LOGIC t COLOR $FF0000 $0000FF');
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#ff0000');
      expect(windowColor.grid).toBe('#0000ff');
      expect(consumed).toBe(3);
    });

    it('parses decimal values', () => {
      const [isValid, windowColor] = parseColor('`LOGIC t COLOR 16711680 255');
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#ff0000');
      expect(windowColor.grid).toBe('#0000ff');
    });

    it('handles mixed name + hex formats', () => {
      const [isValid, windowColor] = parseColor('`SCOPE t COLOR CYAN $FF00FF');
      expect(isValid).toBe(true);
      expect(windowColor.background).toBe('#09ffff'); // RGBI8X CYAN
      expect(windowColor.grid).toBe('#ff00ff'); // literal magenta
    });
  });

  describe('Invalid COLOR handling (Pascal KeyColor -> False)', () => {
    it('rejects a non-directive / unknown color name', () => {
      const [isValid, windowColor] = DisplaySpecParser.parseColorKeyword(['COLOR', 'INVALID_COLOR'], 0);
      expect(isValid).toBe(false);
      expect(windowColor.background).toBe('#000000'); // defaults preserved
      expect(windowColor.grid).toBe(''); // grid sentinel: never given
    });

    it('rejects alias names that are not in the 10-name directive set', () => {
      // PURPLE/GREY are not Pascal directive colors -> KeyColor fails -> parse rejected.
      expect(parseColor('`LOGIC t COLOR PURPLE')[0]).toBe(false);
      expect(parseColor('`LOGIC t COLOR GREY')[0]).toBe(false);
    });
  });

  describe('Directive vs default systems stay distinct', () => {
    it('a COLOR directive name (RGBI8X) differs from the same clXxx default', () => {
      const [, windowColor] = parseColor('`SCOPE t COLOR BLUE BLACK');
      expect(windowColor.background).toBe('#0909ff'); // RGBI8X BLUE directive
      expect(DebugColor.fromDefaultName('BLUE', 8).rgbString).toBe('#7f7fff'); // clBlue default
    });
  });
});
