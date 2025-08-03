/** @format */

'use strict';

import { TracePatternProcessor } from '../src/classes/shared/tracePatternProcessor';

describe('TracePatternProcessor', () => {
  let processor: TracePatternProcessor;
  let scrollCallback: jest.Mock;

  beforeEach(() => {
    processor = new TracePatternProcessor();
    scrollCallback = jest.fn();
    processor.setScrollCallback(scrollCallback);
  });

  describe('Initialization', () => {
    it('should start with default values', () => {
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(processor.getPattern()).toBe(0);
      expect(processor.isScrollEnabled()).toBe(false);
    });

    it('should set bitmap size with bounds', () => {
      processor.setBitmapSize(100, 200);
      expect(processor.getSuggestedRate()).toBe(100); // Width for pattern 0

      // Test clamping
      processor.setBitmapSize(0, 0);
      expect(processor.getSuggestedRate()).toBe(1);

      processor.setBitmapSize(3000, 3000);
      expect(processor.getSuggestedRate()).toBe(2048);
    });

    it('should clamp position when resizing', () => {
      processor.setBitmapSize(100, 100);
      processor.setPosition(50, 50);
      
      processor.setBitmapSize(30, 30);
      const pos = processor.getPosition();
      expect(pos.x).toBe(29);
      expect(pos.y).toBe(29);
    });
  });

  describe('Pattern setting and initial positions', () => {
    beforeEach(() => {
      processor.setBitmapSize(100, 100);
    });

    it('should set pattern 0 (right) starting at top-left', () => {
      processor.setPattern(0);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(processor.getPattern()).toBe(0);
    });

    it('should set pattern 1 (left) starting at top-right', () => {
      processor.setPattern(1);
      const pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(0);
    });

    it('should set pattern 2 (right alt) starting at top-left', () => {
      processor.setPattern(2);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('should set pattern 3 (left alt) starting at top-right', () => {
      processor.setPattern(3);
      const pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(0);
    });

    it('should set pattern 4 (down) starting at top-left', () => {
      processor.setPattern(4);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('should set pattern 5 (up) starting at bottom-right', () => {
      processor.setPattern(5);
      const pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(99);
    });

    it('should set pattern 6 (down alt) starting at bottom-left', () => {
      processor.setPattern(6);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(99);
    });

    it('should set pattern 7 (up alt) starting at bottom-right', () => {
      processor.setPattern(7);
      const pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(99);
    });

    it('should enable scrolling with bit 3', () => {
      processor.setPattern(8); // Pattern 0 with scroll
      expect(processor.getPattern()).toBe(8);
      expect(processor.isScrollEnabled()).toBe(true);
      
      processor.setPattern(15); // Pattern 7 with scroll
      expect(processor.getPattern()).toBe(15);
      expect(processor.isScrollEnabled()).toBe(true);
    });
  });

  describe('Suggested rate', () => {
    beforeEach(() => {
      processor.setBitmapSize(200, 100);
    });

    it('should suggest width for horizontal patterns', () => {
      processor.setPattern(0); // Right
      expect(processor.getSuggestedRate()).toBe(200);
      
      processor.setPattern(1); // Left
      expect(processor.getSuggestedRate()).toBe(200);
      
      processor.setPattern(2); // Right alt
      expect(processor.getSuggestedRate()).toBe(200);
      
      processor.setPattern(3); // Left alt
      expect(processor.getSuggestedRate()).toBe(200);
    });

    it('should suggest height for vertical patterns', () => {
      processor.setPattern(4); // Down
      expect(processor.getSuggestedRate()).toBe(100);
      
      processor.setPattern(5); // Up
      expect(processor.getSuggestedRate()).toBe(100);
      
      processor.setPattern(6); // Down alt
      expect(processor.getSuggestedRate()).toBe(100);
      
      processor.setPattern(7); // Up alt
      expect(processor.getSuggestedRate()).toBe(100);
    });
  });

  describe('Manual position setting', () => {
    beforeEach(() => {
      processor.setBitmapSize(100, 100);
    });

    it('should set position within bounds', () => {
      processor.setPosition(50, 75);
      const pos = processor.getPosition();
      expect(pos.x).toBe(50);
      expect(pos.y).toBe(75);
    });

    it('should clamp position to bounds', () => {
      processor.setPosition(-10, -10);
      let pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      
      processor.setPosition(200, 200);
      pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(99);
    });
  });

  describe('Pattern 0 - Right, no scroll', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(0);
    });

    it('should move right along row', () => {
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 1, y: 0 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 2, y: 0 });
    });

    it('should wrap to next row', () => {
      processor.setPosition(2, 0);
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 1 });
    });

    it('should wrap from bottom-right to top-left', () => {
      processor.setPosition(2, 2);
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Pattern 0 with scroll (pattern 8)', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(8); // Pattern 0 with scroll
    });

    it('should scroll when reaching right edge', () => {
      processor.setPosition(2, 0);
      processor.step();
      
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
      expect(scrollCallback).toHaveBeenCalledWith(0, 1);
    });
  });

  describe('Pattern 1 - Left, no scroll', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(1);
    });

    it('should move left along row', () => {
      expect(processor.getPosition()).toEqual({ x: 2, y: 0 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 1, y: 0 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
    });

    it('should wrap to next row', () => {
      processor.setPosition(0, 0);
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 2, y: 1 });
    });
  });

  describe('Pattern 4 - Down, no scroll', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(4);
    });

    it('should move down column', () => {
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 1 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 2 });
    });

    it('should wrap to next column', () => {
      processor.setPosition(0, 2);
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 1, y: 0 });
    });

    it('should wrap from bottom-right to top-left', () => {
      processor.setPosition(2, 2);
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Pattern 5 - Up, no scroll', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(5);
    });

    it('should move up column', () => {
      expect(processor.getPosition()).toEqual({ x: 2, y: 2 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 2, y: 1 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 2, y: 0 });
    });

    it('should wrap to next column', () => {
      processor.setPosition(1, 0);
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 2, y: 2 });
    });
  });

  describe('All patterns with scrolling', () => {
    beforeEach(() => {
      processor.setBitmapSize(2, 2);
    });

    const scrollTests = [
      { pattern: 8, start: { x: 1, y: 0 }, scroll: { x: 0, y: 1 }, desc: 'right/scroll left' },
      { pattern: 9, start: { x: 0, y: 0 }, scroll: { x: 0, y: 1 }, desc: 'left/scroll right' },
      { pattern: 10, start: { x: 1, y: 0 }, scroll: { x: 0, y: -1 }, desc: 'right/scroll left alt' },
      { pattern: 11, start: { x: 0, y: 0 }, scroll: { x: 0, y: -1 }, desc: 'left/scroll right alt' },
      { pattern: 12, start: { x: 0, y: 1 }, scroll: { x: 1, y: 0 }, desc: 'down/scroll up' },
      { pattern: 13, start: { x: 0, y: 0 }, scroll: { x: 1, y: 0 }, desc: 'up/scroll down' },
      { pattern: 14, start: { x: 0, y: 1 }, scroll: { x: -1, y: 0 }, desc: 'down/scroll up alt' },
      { pattern: 15, start: { x: 0, y: 0 }, scroll: { x: -1, y: 0 }, desc: 'up/scroll down alt' }
    ];

    scrollTests.forEach(({ pattern, start, scroll, desc }) => {
      it(`should scroll correctly for pattern ${pattern} (${desc})`, () => {
        processor.setPattern(pattern);
        processor.setPosition(start.x, start.y);
        
        processor.step();
        
        expect(scrollCallback).toHaveBeenCalledWith(scroll.x, scroll.y);
      });
    });
  });

  describe('Pattern descriptions', () => {
    it('should return correct descriptions', () => {
      expect(TracePatternProcessor.getPatternDescription(0)).toBe('Right, no scroll');
      expect(TracePatternProcessor.getPatternDescription(1)).toBe('Left, no scroll');
      expect(TracePatternProcessor.getPatternDescription(4)).toBe('Down, no scroll');
      expect(TracePatternProcessor.getPatternDescription(5)).toBe('Up, no scroll');
      
      expect(TracePatternProcessor.getPatternDescription(8)).toBe('Right, scroll left');
      expect(TracePatternProcessor.getPatternDescription(9)).toBe('Left, scroll right');
      expect(TracePatternProcessor.getPatternDescription(12)).toBe('Down, scroll up');
      expect(TracePatternProcessor.getPatternDescription(13)).toBe('Up, scroll down');
    });
  });

  describe('Boundary wrapping', () => {
    it('should handle single pixel bitmap', () => {
      processor.setBitmapSize(1, 1);
      processor.setPattern(0);
      
      const startPos = processor.getPosition();
      processor.step();
      const endPos = processor.getPosition();
      
      expect(startPos).toEqual(endPos); // Should stay at 0,0
    });

    it('should handle wide bitmap', () => {
      processor.setBitmapSize(1000, 1);
      processor.setPattern(0);
      
      // Step through entire row
      for (let i = 0; i < 999; i++) {
        processor.step();
      }
      expect(processor.getPosition()).toEqual({ x: 999, y: 0 });
      
      // Next step should wrap
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
    });

    it('should handle tall bitmap', () => {
      processor.setBitmapSize(1, 1000);
      processor.setPattern(4); // Down
      
      // Step through entire column
      for (let i = 0; i < 999; i++) {
        processor.step();
      }
      expect(processor.getPosition()).toEqual({ x: 0, y: 999 });
      
      // Next step should wrap
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
    });
  });
});