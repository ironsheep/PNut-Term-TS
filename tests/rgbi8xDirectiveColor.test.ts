/**
 * RGBI8X COLOR-directive values — [9win §4b] (task #6)
 *
 * Locks DebugColor.colorNameToRGB24UsingRGBI8X to the exact Pascal KeyColor
 * result (DebugDisplayUnit.pas:2774 -> TranslateColor(h shl 5 or p shl 1,
 * key_rgbi8x), :3110-3141). The previous implementation dropped Pascal's
 * white-to-color XOR path, so chromatic colors at the default brightness 8 were
 * wrong (e.g. BLUE -> #0000f6 instead of #0909ff). No prior test covered this
 * function, which is why the bug survived (verified values: see memory
 * rgbi8x-directive-color-values).
 *
 * This is the COLOR-DIRECTIVE color system, distinct from the clXxx channel
 * DEFAULTS (DefaultScopeColors). Do not conflate the two.
 */
import { DebugColor } from '../src/classes/shared/debugColor';

const rgbi8x = (name: string, brightness = 8): string =>
  DebugColor.colorNameToRGB24UsingRGBI8X(name, brightness).toLowerCase();

describe('RGBI8X COLOR-directive values [9win §4b]', () => {
  it('resolves the 10 directive names at default brightness 8', () => {
    expect(rgbi8x('BLACK')).toBe('#000000');
    expect(rgbi8x('WHITE')).toBe('#ffffff');
    expect(rgbi8x('ORANGE')).toBe('#ff8409');
    expect(rgbi8x('BLUE')).toBe('#0909ff');
    expect(rgbi8x('GREEN')).toBe('#09ff09');
    expect(rgbi8x('CYAN')).toBe('#09ffff');
    expect(rgbi8x('RED')).toBe('#ff0909');
    expect(rgbi8x('MAGENTA')).toBe('#ff09ff');
    expect(rgbi8x('YELLOW')).toBe('#ffff09');
    expect(rgbi8x('GRAY')).toBe('#848484');
  });

  it('scales BLUE across the 0..15 brightness nibble (toward black / white)', () => {
    expect(rgbi8x('BLUE', 0)).toBe('#000000');
    expect(rgbi8x('BLUE', 4)).toBe('#000084');
    expect(rgbi8x('BLUE', 8)).toBe('#0909ff'); // default
    expect(rgbi8x('BLUE', 12)).toBe('#8d8dff');
    expect(rgbi8x('BLUE', 15)).toBe('#efefff');
  });

  it('is case-insensitive', () => {
    expect(rgbi8x('blue')).toBe('#0909ff');
    expect(rgbi8x('Red')).toBe('#ff0909');
  });
});
