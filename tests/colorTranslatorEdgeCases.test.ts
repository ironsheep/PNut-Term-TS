/** @format */

'use strict';

/**
 * Color Translation Edge Cases Test
 *
 * Tests the ColorTranslator implementation against Pascal TranslateColor logic
 * for LUMA8X mode with GREEN color (tune=2) at critical intensity values.
 *
 * Pascal reference: DebugDisplayUnit.pas, TranslateColor function (lines 3082-3165)
 */

import { ColorTranslator, ColorMode } from '../src/classes/shared/colorTranslator';

describe('ColorTranslator Edge Cases - LUMA8X GREEN', () => {
  let translator: ColorTranslator;

  beforeEach(() => {
    translator = new ColorTranslator();
    translator.setColorMode(ColorMode.LUMA8X, 2); // GREEN = tune 2
  });

  /**
   * Manual calculation of Pascal TranslateColor for LUMA8X mode
   * Based on Pascal code lines 3104-3134
   *
   * For LUMA8X with tune=2 (GREEN):
   * - v = vColorTune and 7 = 2 (GREEN color index)
   * - p = pixelValue and $FF
   * - w = (v <> 7) and (p >= $80) = check for white mode
   * - if (v <> 7) then:
   *     if (p >= $80) then p := not p and $7F shl 1  // XOR inversion
   *     else p := p shl 1                             // Dark mode doubling
   *
   * GREEN (v=2) RGB bits: 010 (Green channel only)
   * - R = 0 * p = 0
   * - G = 1 * p = p
   * - B = 0 * p = 0
   *
   * For white mode (w=true):
   * - v := v xor 7 = 2 xor 7 = 5 (MAGENTA bits: 101)
   * - Result = (R, G, B) xor $FFFFFF (invert to white background)
   */

  function calculatePascalLuma8xGreen(pixelValue: number): number {
    let p = pixelValue & 0xFF;
    const v: number = 2; // GREEN (using number type to avoid TypeScript const literal type)

    // Determine white mode: (v <> 7) and (p >= $80)
    const w = (v !== 7) && (p >= 0x80);

    // XOR mode intensity adjustment (v <> 7)
    if (v !== 7) {
      if (p >= 0x80) {
        // Bright colors: invert and double
        p = ((~p) & 0x7F) << 1;
      } else {
        // Dark colors: just double
        p = p << 1;
      }
    }

    let result: number;

    if (w) {
      // From white to color (inverted mode)
      const invertedV = v ^ 7; // 2 xor 7 = 5 (MAGENTA: 101)
      result = (((invertedV >> 2) & 1) * p << 16) |  // R
               (((invertedV >> 1) & 1) * p << 8)  |  // G
               (((invertedV >> 0) & 1) * p << 0);    // B
      result = result ^ 0xFFFFFF; // Invert to white background
    } else {
      // From black to color (normal mode)
      result = (((v >> 2) & 1) * p << 16) |  // R = 0
               (((v >> 1) & 1) * p << 8)  |  // G = p
               (((v >> 0) & 1) * p << 0);    // B = 0
    }

    return result;
  }

  function rgbToString(value: number): string {
    const r = (value >> 16) & 0xFF;
    const g = (value >> 8) & 0xFF;
    const b = value & 0xFF;
    return `RGB(${r}, ${g}, ${b})`;
  }

  describe('Dark Mode (intensity 0-127)', () => {
    test('Value 0: Complete darkness', () => {
      const pixelValue = 0;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);
      expect(rgbToString(tsResult)).toBe('RGB(0, 0, 0)');

      console.log(`Value 0: ${rgbToString(tsResult)} - Complete darkness`);
    });

    test('Value 1: Minimal intensity', () => {
      const pixelValue = 1;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);

      // p=1, doubled to 2, GREEN channel only
      expect(rgbToString(tsResult)).toBe('RGB(0, 2, 0)');

      console.log(`Value 1: ${rgbToString(tsResult)} - Minimal green`);
    });

    test('Value 64: Quarter intensity', () => {
      const pixelValue = 64;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);

      // p=64, doubled to 128, GREEN channel only
      expect(rgbToString(tsResult)).toBe('RGB(0, 128, 0)');

      console.log(`Value 64: ${rgbToString(tsResult)} - Quarter intensity`);
    });

    test('Value 127: Maximum dark mode', () => {
      const pixelValue = 127;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);

      // p=127, doubled to 254, GREEN channel only
      expect(rgbToString(tsResult)).toBe('RGB(0, 254, 0)');

      console.log(`Value 127: ${rgbToString(tsResult)} - Maximum dark mode`);
    });
  });

  describe('XOR Threshold (128)', () => {
    test('Value 128: XOR inversion threshold', () => {
      const pixelValue = 128;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);

      // p=128 (0x80), triggers w=true (white mode)
      // p >= 0x80: p = ((~128) & 0x7F) << 1 = (127 & 0x7F) << 1 = 127 << 1 = 254
      // v=2 (GREEN: 010) xor 7 = 5 (MAGENTA: 101)
      // Result: R=254, G=0, B=254, then XOR 0xFFFFFF
      // Final: R=1, G=255, B=1
      expect(rgbToString(tsResult)).toBe('RGB(1, 255, 1)');

      console.log(`Value 128: ${rgbToString(tsResult)} - XOR threshold (white mode starts)`);
    });
  });

  describe('Bright Mode (intensity 128-255)', () => {
    test('Value 129: First bright value', () => {
      const pixelValue = 129;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);

      // p=129 (0x81), w=true
      // p = ((~129) & 0x7F) << 1 = (126 & 0x7F) << 1 = 126 << 1 = 252
      // Inverted GREEN (MAGENTA): R=252, G=0, B=252, XOR 0xFFFFFF
      // Final: R=3, G=255, B=3
      expect(rgbToString(tsResult)).toBe('RGB(3, 255, 3)');

      console.log(`Value 129: ${rgbToString(tsResult)} - First bright value`);
    });

    test('Value 192: Mid bright', () => {
      const pixelValue = 192;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);

      // p=192 (0xC0), w=true
      // p = ((~192) & 0x7F) << 1 = (63 & 0x7F) << 1 = 63 << 1 = 126
      // Inverted GREEN (MAGENTA): R=126, G=0, B=126, XOR 0xFFFFFF
      // Final: R=129, G=255, B=129
      expect(rgbToString(tsResult)).toBe('RGB(129, 255, 129)');

      console.log(`Value 192: ${rgbToString(tsResult)} - Mid bright value`);
    });

    test('Value 254: Near maximum brightness', () => {
      const pixelValue = 254;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);

      // p=254 (0xFE), w=true
      // p = ((~254) & 0x7F) << 1 = (1 & 0x7F) << 1 = 1 << 1 = 2
      // Inverted GREEN (MAGENTA): R=2, G=0, B=2, XOR 0xFFFFFF
      // Final: R=253, G=255, B=253
      expect(rgbToString(tsResult)).toBe('RGB(253, 255, 253)');

      console.log(`Value 254: ${rgbToString(tsResult)} - Near maximum brightness`);
    });

    test('Value 255: Maximum brightness (pure white)', () => {
      const pixelValue = 255;
      const pascalResult = calculatePascalLuma8xGreen(pixelValue);
      const tsResult = translator.translateColor(pixelValue);

      expect(tsResult).toBe(pascalResult);

      // p=255 (0xFF), w=true
      // p = ((~255) & 0x7F) << 1 = (0 & 0x7F) << 1 = 0 << 1 = 0
      // Inverted GREEN (MAGENTA): R=0, G=0, B=0, XOR 0xFFFFFF
      // Final: R=255, G=255, B=255 (PURE WHITE)
      expect(rgbToString(tsResult)).toBe('RGB(255, 255, 255)');

      console.log(`Value 255: ${rgbToString(tsResult)} - Pure white`);
    });
  });

  describe('Comparison Table', () => {
    test('Generate complete comparison table', () => {
      const testValues = [0, 1, 64, 127, 128, 129, 192, 254, 255];

      console.log('\n=== LUMA8X GREEN (tune=2) Color Translation ===\n');
      console.log('Value | Mode     | Pascal RGB       | TypeScript RGB   | Match');
      console.log('------|----------|------------------|------------------|------');

      testValues.forEach(value => {
        const pascalResult = calculatePascalLuma8xGreen(value);
        const tsResult = translator.translateColor(value);
        const match = pascalResult === tsResult ? 'YES' : 'NO';
        const mode = value < 128 ? 'Dark' : 'Bright';

        console.log(
          `${value.toString().padStart(5)} | ${mode.padEnd(8)} | ` +
          `${rgbToString(pascalResult).padEnd(16)} | ` +
          `${rgbToString(tsResult).padEnd(16)} | ` +
          `${match}`
        );

        expect(tsResult).toBe(pascalResult);
      });

      console.log('\n=== All Tests Passed: Color translation MATCHES Pascal ===\n');
    });
  });

  describe('Additional Color Modes', () => {
    test('LUMA8X ORANGE (tune=0)', () => {
      translator.setColorMode(ColorMode.LUMA8X, 0); // ORANGE

      // Test value 64 (dark mode)
      const darkValue = 64;
      const darkResult = translator.translateColor(darkValue);
      // p=64, doubled to 128
      // ORANGE special case: p << 16 | (p << 7 & 0x007F00)
      // = 0x800000 | 0x004000 = 0x804000
      expect(rgbToString(darkResult)).toBe('RGB(128, 64, 0)');

      // Test value 128 (threshold)
      const brightValue = 128;
      const brightResult = translator.translateColor(brightValue);
      // w=true, p=(~128 & 0x7F) << 1 = 127 << 1 = 254
      // ORANGE white mode: (p << 7 & 0x007F00 | p) xor 0xFFFFFF
      // = (0x007F00 | 254) xor 0xFFFFFF = 0x007FFE xor 0xFFFFFF = 0xFF8001
      expect(rgbToString(brightResult)).toBe('RGB(255, 128, 1)');

      console.log(`ORANGE dark (64): ${rgbToString(darkResult)}`);
      console.log(`ORANGE bright (128): ${rgbToString(brightResult)}`);
    });

    test('LUMA8X GRAY (tune=7)', () => {
      translator.setColorMode(ColorMode.LUMA8X, 7); // GRAY

      // GRAY (v=7) doesn't get XOR doubling (special case)
      const value127 = 127;
      const result127 = translator.translateColor(value127);
      // v=7 (GRAY: 111), no doubling, p stays 127
      // R=127, G=127, B=127
      expect(rgbToString(result127)).toBe('RGB(127, 127, 127)');

      const value128 = 128;
      const result128 = translator.translateColor(value128);
      // v=7, no white mode for GRAY (w check excludes v=7)
      // p stays 128, R=128, G=128, B=128
      expect(rgbToString(result128)).toBe('RGB(128, 128, 128)');

      console.log(`GRAY (127): ${rgbToString(result127)}`);
      console.log(`GRAY (128): ${rgbToString(result128)}`);
    });
  });
});
