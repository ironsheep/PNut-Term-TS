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
      expect(processor.getTraceValue()).toBe(0);
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

    it('should reset position when resizing', () => {
      processor.setBitmapSize(100, 100);
      processor.setPosition(50, 50);
      
      processor.setBitmapSize(30, 30);
      const pos = processor.getPosition();
      // Position should reset based on pattern, not clamped
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });
  });

  describe('Pattern setting and initial positions', () => {
    beforeEach(() => {
      processor.setBitmapSize(100, 100);
    });

    it('should set trace 0 (normal) starting at top-left', () => {
      processor.setPattern(0);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(processor.getTraceValue()).toBe(0);
    });

    it('should set trace 1 (H flip) starting at top-right', () => {
      processor.setPattern(1);
      const pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(0);
    });

    it('should set trace 2 (V flip) starting at bottom-left', () => {
      processor.setPattern(2);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(99);
    });

    it('should set trace 3 (180° rotation) starting at bottom-right', () => {
      processor.setPattern(3);
      const pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(99);
    });

    it('should set trace 4 (90° CCW + V flip) starting at top-left', () => {
      processor.setPattern(4);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    it('should set trace 5 (90° CCW) starting at bottom-left', () => {
      processor.setPattern(5);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(99);
    });

    it('should set trace 6 (90° CW) starting at top-right', () => {
      processor.setPattern(6);
      const pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(0);
    });

    it('should set trace 7 (90° CW + V flip) starting at bottom-right', () => {
      processor.setPattern(7);
      const pos = processor.getPosition();
      expect(pos.x).toBe(99);
      expect(pos.y).toBe(99);
    });

    // Test scrolling trace values with remapping
    it('should set trace 8 (V flip + scroll) with correct orientation', () => {
      processor.setPattern(8);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(99); // Should match trace 2 position
      expect(processor.getTraceValue()).toBe(8);
    });

    it('should set trace 10 (normal + scroll) with correct orientation', () => {
      processor.setPattern(10);
      const pos = processor.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0); // Should match trace 0 position
      expect(processor.getTraceValue()).toBe(10);
    });
  });

  describe('Suggested rate', () => {
    beforeEach(() => {
      processor.setBitmapSize(200, 100);
    });

    it('should suggest width for horizontal patterns (0-3)', () => {
      processor.setPattern(0); // Normal
      expect(processor.getSuggestedRate()).toBe(200);
      
      processor.setPattern(1); // H flip
      expect(processor.getSuggestedRate()).toBe(200);
      
      processor.setPattern(2); // V flip
      expect(processor.getSuggestedRate()).toBe(200);
      
      processor.setPattern(3); // 180° rotation
      expect(processor.getSuggestedRate()).toBe(200);
    });

    it('should suggest height for vertical patterns (4-7)', () => {
      processor.setPattern(4); // 90° CCW + V flip
      expect(processor.getSuggestedRate()).toBe(100);
      
      processor.setPattern(5); // 90° CCW
      expect(processor.getSuggestedRate()).toBe(100);
      
      processor.setPattern(6); // 90° CW
      expect(processor.getSuggestedRate()).toBe(100);
      
      processor.setPattern(7); // 90° CW + V flip
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

    it('should disable scrolling when position is set manually', () => {
      processor.setPattern(10); // Scrolling pattern
      processor.setPosition(50, 50);
      // Scrolling should be disabled after manual set
      processor.step();
      expect(scrollCallback).not.toHaveBeenCalled();
    });
  });

  describe('Trace 0 - Normal orientation', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(0);
    });

    it('should move left-to-right along row', () => {
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

  describe('Trace 1 - Horizontal flip', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(1);
    });

    it('should move right-to-left along row', () => {
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

  describe('Trace 2 - Vertical flip', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(2);
    });

    it('should move left-to-right, bottom-to-top', () => {
      expect(processor.getPosition()).toEqual({ x: 0, y: 2 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 1, y: 2 });
      
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 2, y: 2 });
    });

    it('should wrap to previous row', () => {
      processor.setPosition(2, 2);
      processor.step();
      expect(processor.getPosition()).toEqual({ x: 0, y: 1 });
    });
  });

  describe('Trace 4 - 90° CCW + V flip', () => {
    beforeEach(() => {
      processor.setBitmapSize(3, 3);
      processor.setPattern(4);
    });

    it('should move top-to-bottom, left-to-right', () => {
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
  });

  describe('Scrolling trace values', () => {
    beforeEach(() => {
      processor.setBitmapSize(2, 2);
    });

    it('should scroll for trace 8 when at edge', () => {
      // Trace 8 maps to pattern 2 (V flip) with scrolling
      processor.setPattern(8);
      // V flip starts at bottom-left, moves left-to-right
      let pos = processor.getPosition();
      expect(pos).toEqual({ x: 0, y: 1 }); // Bottom left for 2x2
      
      // Move right
      processor.step();
      pos = processor.getPosition();
      expect(pos).toEqual({ x: 1, y: 1 }); // Bottom right
      
      // Next step should trigger scroll up
      processor.step();
      expect(scrollCallback).toHaveBeenCalledWith(0, -1);
      expect(processor.getPosition()).toEqual({ x: 0, y: 1 });
    });

    it('should scroll for trace 10 when at edge', () => {
      // Trace 10 maps to pattern 0 (normal) with scrolling
      processor.setPattern(10);
      // Normal starts at top-left, moves left-to-right
      let pos = processor.getPosition();
      expect(pos).toEqual({ x: 0, y: 0 }); // Top left
      
      // Move right
      processor.step();
      pos = processor.getPosition();
      expect(pos).toEqual({ x: 1, y: 0 }); // Top right
      
      // Next step should trigger scroll down
      processor.step();
      expect(scrollCallback).toHaveBeenCalledWith(0, 1);
      expect(processor.getPosition()).toEqual({ x: 0, y: 0 });
    });

    // Test each scrolling pattern individually with manual setup
    it('should scroll correctly for trace 9 (180° rotation + scroll)', () => {
      processor.setPattern(9);
      // 180° rotation: starts at 1,1, moves left
      // First step goes to 0,1, and scrolling occurs at left edge when x=0
      processor.step(); // Move to 0,1
      processor.step(); // This should trigger scroll
      expect(scrollCallback).toHaveBeenCalledWith(0, -1);
    });

    it('should scroll correctly for trace 11 (H flip + scroll)', () => {
      processor.setPattern(11);
      // H flip: starts at 1,0, moves left
      // First step goes to 0,0, scrolling occurs at left edge when x=0
      processor.step(); // Move to 0,0
      processor.step(); // This should trigger scroll
      expect(scrollCallback).toHaveBeenCalledWith(0, 1);
    });

    it('should scroll correctly for trace 13 (90° CW + V flip + scroll)', () => {
      processor.setPattern(13);
      // 90° CW + V flip: starts at 1,1, moves up
      // First step goes to 1,0, scrolling occurs at top edge when y=0
      processor.step(); // Move to 1,0
      processor.step(); // This should trigger scroll
      expect(scrollCallback).toHaveBeenCalledWith(-1, 0);
    });

    it('should scroll correctly for trace 15 (90° CCW + scroll)', () => {
      processor.setPattern(15);
      // 90° CCW: starts at 0,1, moves up
      // First step goes to 0,0, scrolling occurs at top edge when y=0
      processor.step(); // Move to 0,0
      processor.step(); // This should trigger scroll
      expect(scrollCallback).toHaveBeenCalledWith(1, 0);
    });

    const scrollTests = [
      { trace: 8, orientation: 'V flip', start: { x: 1, y: 1 }, scroll: { x: 0, y: -1 } },
      { trace: 10, orientation: 'Normal', start: { x: 1, y: 0 }, scroll: { x: 0, y: 1 } },
      { trace: 12, orientation: '90° CW', start: { x: 1, y: 1 }, scroll: { x: -1, y: 0 } },
      { trace: 14, orientation: '90° CCW + V flip', start: { x: 0, y: 1 }, scroll: { x: 1, y: 0 } }
    ];

    scrollTests.forEach(({ trace, orientation, start, scroll }) => {
      it(`should scroll correctly for trace ${trace} (${orientation} + scroll)`, () => {
        processor.setPattern(trace);
        // Move to appropriate edge by stepping
        const pos = processor.getPosition();
        
        // Step to get to the edge position where scrolling will occur
        if (trace === 8) {
          // V flip: starts at 0,1, moves right, need to be at 1,1
          processor.step();
        } else if (trace === 9) {
          // 180° rotation: starts at 1,1, moves left then up
          // Skip - already at edge
        } else if (trace === 10) {
          // Normal: starts at 0,0, moves right, need to be at 1,0
          processor.step();
        } else if (trace === 11) {
          // H flip: starts at 1,0, moves left then down
          // Skip - already at edge
        } else if (trace === 12) {
          // 90° CW: starts at 1,0, moves down, need to be at 1,1
          processor.step();
        } else if (trace === 13) {
          // 90° CW + V flip: starts at 1,1, moves up then left
          // Skip - already at edge
        } else if (trace === 14) {
          // 90° CCW + V flip: starts at 0,0, moves down, need to be at 0,1
          processor.step();
        } else if (trace === 15) {
          // 90° CCW: starts at 0,1, moves up then right
          // Skip - already at edge
        }
        
        // Now step once more to trigger scrolling
        processor.step();
        
        expect(scrollCallback).toHaveBeenCalledWith(scroll.x, scroll.y);
      });
    });
  });

  describe('getTraceValue', () => {
    it('should return correct trace values for all patterns', () => {
      // Non-scrolling patterns
      for (let i = 0; i < 8; i++) {
        processor.setPattern(i);
        expect(processor.getTraceValue()).toBe(i);
      }
      
      // Scrolling patterns
      for (let i = 8; i < 16; i++) {
        processor.setPattern(i);
        expect(processor.getTraceValue()).toBe(i);
      }
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
      processor.setPattern(4); // Vertical pattern
      
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