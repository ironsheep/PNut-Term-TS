/** @format */

'use strict';

/**
 * Test trace pattern 15 position advancement
 *
 * Verifies that trace pattern 15 positions match Pascal expectations
 * for the SPECTRO window waterfall scrolling behavior.
 *
 * Pattern 15 = Pattern 7 + scrolling:
 * - Start at (width-1, height-1) = (31, 236) for 32x237
 * - Move bottom-to-top (decrement Y)
 * - When Y reaches 0, wrap to height-1 and trigger scroll(-1, 0)
 * - Stay at same X position (31) due to scrolling
 */

import { TracePatternProcessor } from '../src/classes/shared/tracePatternProcessor';

describe('Trace Pattern 15 Position Test', () => {
  let processor: TracePatternProcessor;

  beforeEach(() => {
    processor = new TracePatternProcessor();
  });

  test('Pattern 15 initial position matches Pascal SetTrace', () => {
    // Configure for SPECTRO: 32x237 (depth x bins), trace pattern 15
    processor.setBitmapSize(32, 237);
    processor.setPattern(15);

    const pos = processor.getPosition();

    // Pascal SetTrace for pattern 7 (base of 15):
    // if Path and 7 in [0, 2, 4, 5] then vPixelX := 0 else vPixelX := vWidth - 1;
    // if Path and 7 in [0, 1, 4, 6] then vPixelY := 0 else vPixelY := vHeight - 1;
    // Pattern 7 (15 and 7 = 7) sets: vPixelX := vWidth - 1, vPixelY := vHeight - 1
    expect(pos.x).toBe(31); // width - 1 = 32 - 1 = 31
    expect(pos.y).toBe(236); // height - 1 = 237 - 1 = 236
  });

  test('Pattern 15 first 5 positions move bottom-to-top', () => {
    processor.setBitmapSize(32, 237);
    processor.setPattern(15);

    const positions: Array<{ x: number; y: number }> = [];

    // Record initial position
    positions.push({ ...processor.getPosition() });

    // Step 5 times and record each position
    for (let i = 0; i < 5; i++) {
      processor.step();
      positions.push({ ...processor.getPosition() });
    }

    // Expected positions for pattern 7: bottom-to-top, right column first
    // Initial: (31, 236)
    // After step 1: (31, 235)
    // After step 2: (31, 234)
    // After step 3: (31, 233)
    // After step 4: (31, 232)
    // After step 5: (31, 231)

    expect(positions[0]).toEqual({ x: 31, y: 236 }); // Initial
    expect(positions[1]).toEqual({ x: 31, y: 235 }); // After 1st step
    expect(positions[2]).toEqual({ x: 31, y: 234 }); // After 2nd step
    expect(positions[3]).toEqual({ x: 31, y: 233 }); // After 3rd step
    expect(positions[4]).toEqual({ x: 31, y: 232 }); // After 4th step
    expect(positions[5]).toEqual({ x: 31, y: 231 }); // After 5th step
  });

  test('Pattern 15 triggers scroll after 237 steps (full column)', () => {
    processor.setBitmapSize(32, 237);
    processor.setPattern(15);

    // Track scroll calls
    let scrollCalled = false;
    let scrollX = 0;
    let scrollY = 0;

    processor.setScrollCallback((x: number, y: number) => {
      scrollCalled = true;
      scrollX = x;
      scrollY = y;
    });

    // Initial position should be (31, 236)
    const initialPos = processor.getPosition();
    expect(initialPos).toEqual({ x: 31, y: 236 });

    // Step through entire first column (237 pixels: Y=236 down to Y=0)
    for (let i = 0; i < 237; i++) {
      processor.step();
    }

    // After 237 steps, scroll should have been triggered
    expect(scrollCalled).toBe(true);

    // Pascal StepTrace pattern 7 with scroll:
    // if vPixelY <> 0 then Dec(vPixelY) else
    // begin
    //   vPixelY := vHeight - 1;
    //   if Scroll then ScrollBitmap(-1, 0)
    // end
    expect(scrollX).toBe(-1); // Scroll left
    expect(scrollY).toBe(0);  // No vertical scroll

    // After scroll, position should wrap to (31, 236)
    // Pattern 15 keeps X at 31 (scrolling keeps us in same column)
    const finalPos = processor.getPosition();
    expect(finalPos.x).toBe(31); // Stays at rightmost column
    expect(finalPos.y).toBe(236); // Wraps back to bottom
  });

  test('Pattern 15 position progression through full column', () => {
    processor.setBitmapSize(32, 237);
    processor.setPattern(15);

    const positions: Array<{ x: number; y: number }> = [];
    let scrollCount = 0;

    processor.setScrollCallback(() => {
      scrollCount++;
    });

    // Record position after each step through full column
    positions.push({ ...processor.getPosition() }); // Initial

    for (let i = 0; i < 237; i++) {
      processor.step();
      positions.push({ ...processor.getPosition() });
    }

    // Verify all positions in first column have X=31
    for (let i = 0; i <= 237; i++) {
      expect(positions[i].x).toBe(31);
    }

    // Verify Y progression: starts at 236, decrements to 0, then wraps to 236
    expect(positions[0].y).toBe(236);   // Initial
    expect(positions[1].y).toBe(235);   // After 1st step
    expect(positions[118].y).toBe(118); // Middle
    expect(positions[236].y).toBe(0);   // After 236 steps (last pixel before wrap)
    expect(positions[237].y).toBe(236); // After 237 steps (wrapped, scroll triggered)

    // Verify scroll was called exactly once
    expect(scrollCount).toBe(1);
  });

  test('Pattern 15 continues correct behavior after scroll', () => {
    processor.setBitmapSize(32, 237);
    processor.setPattern(15);

    let scrollCount = 0;
    processor.setScrollCallback(() => {
      scrollCount++;
    });

    // Complete first column (237 steps)
    for (let i = 0; i < 237; i++) {
      processor.step();
    }

    expect(scrollCount).toBe(1);
    const posAfterFirstScroll = processor.getPosition();
    expect(posAfterFirstScroll).toEqual({ x: 31, y: 236 });

    // Continue for 5 more steps
    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 5; i++) {
      processor.step();
      positions.push({ ...processor.getPosition() });
    }

    // Should continue decrementing Y from 236
    expect(positions[0]).toEqual({ x: 31, y: 235 });
    expect(positions[1]).toEqual({ x: 31, y: 234 });
    expect(positions[2]).toEqual({ x: 31, y: 233 });
    expect(positions[3]).toEqual({ x: 31, y: 232 });
    expect(positions[4]).toEqual({ x: 31, y: 231 });

    // No additional scrolls yet
    expect(scrollCount).toBe(1);
  });

  test('Pattern 15 scroll values match Pascal expectations', () => {
    processor.setBitmapSize(32, 237);
    processor.setPattern(15);

    const scrollEvents: Array<{ x: number; y: number }> = [];

    processor.setScrollCallback((x: number, y: number) => {
      scrollEvents.push({ x, y });
    });

    // Trigger multiple scrolls by stepping through multiple columns
    for (let i = 0; i < 237 * 3; i++) {
      processor.step();
    }

    // Should have 3 scroll events
    expect(scrollEvents.length).toBe(3);

    // All scrolls should be (-1, 0) for pattern 15
    // Pascal: ScrollBitmap(-1, 0)
    for (const event of scrollEvents) {
      expect(event.x).toBe(-1);
      expect(event.y).toBe(0);
    }
  });
});
