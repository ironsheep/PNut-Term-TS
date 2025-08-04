/**
 * @file pianoKeyboardLayout.test.ts
 * @description Unit tests for PianoKeyboardLayout class
 */

import { PianoKeyboardLayout } from '../src/classes/shared/pianoKeyboardLayout';

describe('PianoKeyboardLayout', () => {
  describe('isBlackKey', () => {
    it('should correctly identify black keys', () => {
      // Black keys: C#, D#, F#, G#, A#
      expect(PianoKeyboardLayout.isBlackKey(1)).toBe(true);   // C#
      expect(PianoKeyboardLayout.isBlackKey(3)).toBe(true);   // D#
      expect(PianoKeyboardLayout.isBlackKey(6)).toBe(true);   // F#
      expect(PianoKeyboardLayout.isBlackKey(8)).toBe(true);   // G#
      expect(PianoKeyboardLayout.isBlackKey(10)).toBe(true);  // A#
      
      // Test across octaves
      expect(PianoKeyboardLayout.isBlackKey(13)).toBe(true);  // C# (next octave)
      expect(PianoKeyboardLayout.isBlackKey(25)).toBe(true);  // C# (two octaves up)
    });

    it('should correctly identify white keys', () => {
      // White keys: C, D, E, F, G, A, B
      expect(PianoKeyboardLayout.isBlackKey(0)).toBe(false);  // C
      expect(PianoKeyboardLayout.isBlackKey(2)).toBe(false);  // D
      expect(PianoKeyboardLayout.isBlackKey(4)).toBe(false);  // E
      expect(PianoKeyboardLayout.isBlackKey(5)).toBe(false);  // F
      expect(PianoKeyboardLayout.isBlackKey(7)).toBe(false);  // G
      expect(PianoKeyboardLayout.isBlackKey(9)).toBe(false);  // A
      expect(PianoKeyboardLayout.isBlackKey(11)).toBe(false); // B
      
      // Test across octaves
      expect(PianoKeyboardLayout.isBlackKey(12)).toBe(false); // C (next octave)
      expect(PianoKeyboardLayout.isBlackKey(24)).toBe(false); // C (two octaves up)
    });
  });

  describe('getNoteName', () => {
    it('should return correct note names', () => {
      expect(PianoKeyboardLayout.getNoteName(60)).toBe('C4');   // Middle C
      expect(PianoKeyboardLayout.getNoteName(69)).toBe('A4');   // A440
      expect(PianoKeyboardLayout.getNoteName(21)).toBe('A0');   // Lowest A on 88-key piano
      expect(PianoKeyboardLayout.getNoteName(108)).toBe('C8');  // Highest C on 88-key piano
      expect(PianoKeyboardLayout.getNoteName(61)).toBe('C#4');  // C# above middle C
      expect(PianoKeyboardLayout.getNoteName(63)).toBe('D#4');  // D# above middle C
    });
  });

  describe('calculateLayout', () => {
    it('should calculate correct layout for default size', () => {
      // Default size 4: keySize = 8 + 4*4 = 24
      const keySize = 24;
      const layout = PianoKeyboardLayout.calculateLayout(keySize, 21, 108);
      
      // Should have all keys from 0-127 in the map
      expect(layout.keys.size).toBe(128);
      
      // Check specific key properties
      const middleC = layout.keys.get(60);
      expect(middleC).toBeDefined();
      expect(middleC!.isBlack).toBe(false);
      
      const cSharp = layout.keys.get(61);
      expect(cSharp).toBeDefined();
      expect(cSharp!.isBlack).toBe(true);
      
      // Black keys should be narrower
      expect(cSharp!.right - cSharp!.left).toBeLessThan(middleC!.right - middleC!.left);
      
      // Black keys should be shorter
      expect(cSharp!.bottom).toBeLessThan(middleC!.bottom);
    });

    it('should calculate correct dimensions for different sizes', () => {
      // Size 1: keySize = 8 + 1*4 = 12
      const layout1 = PianoKeyboardLayout.calculateLayout(12, 21, 108);
      
      // Size 50: keySize = 8 + 50*4 = 208
      const layout50 = PianoKeyboardLayout.calculateLayout(208, 21, 108);
      
      // Larger size should result in larger dimensions
      expect(layout50.totalWidth).toBeGreaterThan(layout1.totalWidth);
      expect(layout50.totalHeight).toBeGreaterThan(layout1.totalHeight);
      
      // Height should be keySize * 6 + border
      expect(layout1.totalHeight).toBe(12 * 6 + Math.floor(12 / 6));
      expect(layout50.totalHeight).toBe(208 * 6 + Math.floor(208 / 6));
    });

    it('should handle edge cases for key ranges', () => {
      // Single key (white)
      const singleWhite = PianoKeyboardLayout.calculateLayout(24, 60, 60); // Middle C
      expect(singleWhite.whiteKeyCount).toBe(1);
      
      // Single key (black)
      const singleBlack = PianoKeyboardLayout.calculateLayout(24, 61, 61); // C#
      expect(singleBlack.whiteKeyCount).toBe(2); // Adds white space on both sides
      
      // Full range
      const fullRange = PianoKeyboardLayout.calculateLayout(24, 0, 127);
      expect(fullRange.keys.size).toBe(128);
    });

    it('should calculate correct offset for different starting keys', () => {
      const keySize = 24;
      
      // Starting with white key
      const whiteStart = PianoKeyboardLayout.calculateLayout(keySize, 60, 72); // C to C
      expect(whiteStart.offset).toBeGreaterThan(0);
      
      // Starting with black key
      const blackStart = PianoKeyboardLayout.calculateLayout(keySize, 61, 72); // C# to C
      expect(blackStart.offset).toBeGreaterThan(0);
      // Should include extra white space to the left
      expect(blackStart.whiteKeyCount).toBeGreaterThan(0);
    });

    it('should match Pascal implementation for standard 88-key piano', () => {
      // Standard 88-key piano: A0 (21) to C8 (108)
      const keySize = 24; // Default size 4
      const layout = PianoKeyboardLayout.calculateLayout(keySize, 21, 108);
      
      // 88-key piano has 52 white keys
      // First key (A0) is white, last key (C8) is white
      expect(layout.whiteKeyCount).toBe(52);
      
      // Total width = keySize * whiteKeyCount + border * 2
      const border = Math.floor(keySize / 6); // 4 for size 24
      expect(layout.totalWidth).toBe(keySize * 52 + border * 2);
      
      // Total height = keySize * 6 + border
      expect(layout.totalHeight).toBe(keySize * 6 + border);
    });

    it('should correctly position MIDI note numbers', () => {
      const keySize = 24;
      const layout = PianoKeyboardLayout.calculateLayout(keySize, 60, 72);
      
      // Check that each key has a numX position
      for (let i = 60; i <= 72; i++) {
        const key = layout.keys.get(i);
        expect(key).toBeDefined();
        expect(key!.numX).toBeGreaterThan(0);
        
        // Note number should be within key bounds
        expect(key!.numX).toBeGreaterThanOrEqual(key!.left);
        expect(key!.numX).toBeLessThanOrEqual(key!.right);
      }
    });
  });
});