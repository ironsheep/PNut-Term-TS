/** @format */

'use strict';

// tests/debugColor.test.ts
//
// [9win §4b] DebugColor — the TWO distinct color systems (do NOT unify):
//   1. DIRECTIVE (RGBI8X): the COLOR / BLACK..GRAY {brightness} directive.
//      `new DebugColor(name, b)` resolves a NAME via Pascal's RGBI8X
//      TranslateColor(h shl 5 or p shl 1, key_rgbi8x). e.g. BLUE 8 -> #0909ff.
//   2. DEFAULT (clXxx): per-window default colors (DefaultScopeColors / Default*Color).
//      `DebugColor.fromDefaultName(name, b)` resolves a NAME via the clXxx table
//      with a brightness gradient. e.g. clBlue -> #7f7fff.
// The canonical RGBI8X directive values are locked in rgbi8xDirectiveColor.test.ts.

import { DebugColor } from '../src/classes/shared/debugColor';

describe('DebugColor [9win §4b]', () => {
  describe('Directive color-name validity (10-name set)', () => {
    const tenNames = ['BLACK', 'WHITE', 'ORANGE', 'BLUE', 'GREEN', 'CYAN', 'RED', 'MAGENTA', 'YELLOW', 'GRAY'];

    it('accepts the 10 directive names (case-insensitive)', () => {
      tenNames.forEach((color) => {
        expect(DebugColor.isValidDirectiveColorName(color)).toBe(true);
        expect(DebugColor.isValidDirectiveColorName(color.toLowerCase())).toBe(true);
        expect(DebugColor.isValidColorName(color)).toBe(true); // alias of the directive check
      });
    });

    it('rejects aliases that are NOT directive colors', () => {
      // These exist only as clXxx DEFAULT/legacy names — never valid for the directive path.
      ['GREY', 'LIME', 'OLIVE', 'BLUE2', 'GRAY2', 'GRAY3'].forEach((name) => {
        expect(DebugColor.isValidDirectiveColorName(name)).toBe(false);
        expect(DebugColor.isValidColorName(name)).toBe(false);
      });
    });

    it('rejects unknown color names', () => {
      ['PURPLE', 'PINK', ''].forEach((name) => {
        expect(DebugColor.isValidColorName(name)).toBe(false);
      });
    });
  });

  describe('DIRECTIVE system — new DebugColor(name, brightness) is RGBI8X', () => {
    it('resolves the 10 names at default brightness 8 to RGBI8X values', () => {
      expect(new DebugColor('BLACK', 8).rgbString).toBe('#000000');
      expect(new DebugColor('WHITE', 8).rgbString).toBe('#ffffff');
      expect(new DebugColor('ORANGE', 8).rgbString).toBe('#ff8409');
      expect(new DebugColor('BLUE', 8).rgbString).toBe('#0909ff');
      expect(new DebugColor('GREEN', 8).rgbString).toBe('#09ff09');
      expect(new DebugColor('CYAN', 8).rgbString).toBe('#09ffff');
      expect(new DebugColor('RED', 8).rgbString).toBe('#ff0909');
      expect(new DebugColor('MAGENTA', 8).rgbString).toBe('#ff09ff');
      expect(new DebugColor('YELLOW', 8).rgbString).toBe('#ffff09');
      expect(new DebugColor('GRAY', 8).rgbString).toBe('#848484');
    });

    it('scales chromatic colors across the 0..15 brightness nibble', () => {
      expect(new DebugColor('BLUE', 0).rgbString).toBe('#000000'); // toward black
      expect(new DebugColor('BLUE', 4).rgbString).toBe('#000084');
      expect(new DebugColor('BLUE', 8).rgbString).toBe('#0909ff'); // saturated
      expect(new DebugColor('BLUE', 12).rgbString).toBe('#8d8dff'); // toward white
      expect(new DebugColor('BLUE', 15).rgbString).toBe('#efefff');
      expect(new DebugColor('RED', 0).rgbString).toBe('#000000');
    });

    it('WHITE ignores brightness (Pascal KeyColor sets $FFFFFF directly)', () => {
      expect(new DebugColor('WHITE', 0).rgbString).toBe('#ffffff');
      expect(new DebugColor('WHITE', 15).rgbString).toBe('#ffffff');
    });

    it('clamps out-of-range brightness to the default (8)', () => {
      expect(new DebugColor('RED', -5).rgbString).toBe('#ff0909'); // == RED 8
      expect(new DebugColor('RED', 20).rgbString).toBe('#ff0909');
    });

    it('derives grid (brightness 6) and font (brightness 12) shades from the RGBI8X color', () => {
      const red = new DebugColor('RED', 8);
      expect(red.gridRgbString).toBe('#c60000');
      expect(red.fontRgbString).toBe('#ff8d8d');
      const blue = new DebugColor('BLUE', 8);
      expect(blue.gridRgbString).toBe('#0000c6');
      expect(blue.fontRgbString).toBe('#8d8dff');
    });
  });

  describe('DEFAULT system — DebugColor.fromDefaultName(name, brightness) is clXxx', () => {
    it('resolves names to clXxx values at full brightness (8)', () => {
      expect(DebugColor.fromDefaultName('BLACK', 8).rgbString).toBe('#000000');
      expect(DebugColor.fromDefaultName('WHITE', 8).rgbString).toBe('#ffffff');
      expect(DebugColor.fromDefaultName('ORANGE', 8).rgbString).toBe('#ff7f00'); // clOrange
      expect(DebugColor.fromDefaultName('BLUE', 8).rgbString).toBe('#7f7fff'); // clBlue
      expect(DebugColor.fromDefaultName('LIME', 8).rgbString).toBe('#00ff00'); // clLime
      expect(DebugColor.fromDefaultName('GREEN', 8).rgbString).toBe('#00ff00'); // == clLime
      expect(DebugColor.fromDefaultName('CYAN', 8).rgbString).toBe('#00ffff');
      expect(DebugColor.fromDefaultName('RED', 8).rgbString).toBe('#ff0000');
      expect(DebugColor.fromDefaultName('MAGENTA', 8).rgbString).toBe('#ff00ff');
      expect(DebugColor.fromDefaultName('YELLOW', 8).rgbString).toBe('#ffff00');
      expect(DebugColor.fromDefaultName('OLIVE', 8).rgbString).toBe('#7f7f00'); // clOlive
    });

    it('applies a brightness gradient to the clXxx base', () => {
      expect(DebugColor.fromDefaultName('RED', 4).rgbString).toBe('#800000');
      expect(DebugColor.fromDefaultName('RED', 0).rgbString).toBe('#000000');
      expect(DebugColor.fromDefaultName('GRAY3', 4).rgbString).toBe('#686868');
    });
  });

  describe('The two systems are distinct (must NOT be unified)', () => {
    it('directive BLUE (RGBI8X) differs from default clBlue', () => {
      expect(new DebugColor('BLUE', 8).rgbString).toBe('#0909ff');
      expect(DebugColor.fromDefaultName('BLUE', 8).rgbString).toBe('#7f7fff');
      expect(new DebugColor('BLUE', 8).rgbString).not.toBe(DebugColor.fromDefaultName('BLUE', 8).rgbString);
    });

    it('directive ORANGE/RED also differ from their clXxx defaults', () => {
      expect(new DebugColor('ORANGE', 8).rgbString).toBe('#ff8409');
      expect(DebugColor.fromDefaultName('ORANGE', 8).rgbString).toBe('#ff7f00');
      expect(new DebugColor('RED', 8).rgbString).toBe('#ff0909');
      expect(DebugColor.fromDefaultName('RED', 8).rgbString).toBe('#ff0000');
    });
  });

  describe('parseDirectiveColor (canonical COLOR-directive resolver)', () => {
    it('resolves directive names via RGBI8X, with optional brightness', () => {
      expect(DebugColor.parseDirectiveColor('BLUE')).toBe('#0909ff');
      expect(DebugColor.parseDirectiveColor('BLUE 12')).toBe('#8d8dff');
      expect(DebugColor.parseDirectiveColor('blue')).toBe('#0909ff'); // case-insensitive
    });

    it('resolves numeric color literals ($hex / decimal / #rrggbb)', () => {
      expect(DebugColor.parseDirectiveColor('$FF00FF')).toBe('#ff00ff');
      expect(DebugColor.parseDirectiveColor('255')).toBe('#0000ff');
      expect(DebugColor.parseDirectiveColor('16711680')).toBe('#ff0000');
      expect(DebugColor.parseDirectiveColor('#00ff00')).toBe('#00ff00');
    });

    it('returns null for non-directive names and garbage (Pascal KeyColor -> False)', () => {
      expect(DebugColor.parseDirectiveColor('PURPLE')).toBeNull();
      expect(DebugColor.parseDirectiveColor('GREY')).toBeNull(); // not a directive name
      expect(DebugColor.parseDirectiveColor('NONSENSE')).toBeNull();
    });
  });

  describe('parseColorSpec (clXxx table lookup, brightness reported separately)', () => {
    it('parses color names to the clXxx base hex', () => {
      expect(DebugColor.parseColorSpec('RED')).toEqual([true, '#ff0000', 8]);
      expect(DebugColor.parseColorSpec('RED 12')).toEqual([true, '#ff0000', 12]);
    });

    it('parses numeric color values', () => {
      const [v1, hex1] = DebugColor.parseColorSpec('$FF00FF');
      expect(v1).toBe(true);
      expect(hex1.toLowerCase()).toBe('#ff00ff');
      const [v2, hex2] = DebugColor.parseColorSpec('16711680'); // red in decimal
      expect(v2).toBe(true);
      expect(hex2.toLowerCase()).toBe('#ff0000');
    });

    it('handles invalid specs and ignores out-of-range brightness', () => {
      expect(DebugColor.parseColorSpec('INVALID')[0]).toBe(false);
      expect(DebugColor.parseColorSpec('$GGGGGG')[0]).toBe(false);
      expect(DebugColor.parseColorSpec('RED 20')).toEqual([true, '#ff0000', 8]); // brightness falls back
    });
  });

  describe('rgbStringWithBrightness', () => {
    it('returns the directive base color at a specified brightness', () => {
      const green = new DebugColor('GREEN', 8);
      expect(green.rgbStringWithBrightness(0)).toBe('#000000');
    });
  });
});
