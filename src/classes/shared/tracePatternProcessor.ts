/** @format */

'use strict';

// src/classes/shared/tracePatternProcessor.ts

/**
 * Trace pattern interface for tracking pixel position and scrolling
 */
interface TraceState {
  pixelX: number;
  pixelY: number;
  width: number;
  height: number;
  pattern: number;
  scrollEnabled: boolean;
}

/**
 * TracePatternProcessor implements the 16 trace patterns for bitmap display
 * 
 * ## Trace Parameter (0-15)
 * 
 * The `trace` parameter controls the pixel plotting order and image orientation when 
 * data is streamed to the bitmap display. It combines rotation, flipping, and optional 
 * scrolling behavior.
 * 
 * ### Values 0-7 (without scrolling):
 * - **0**: Normal orientation - left-to-right, top-to-bottom
 * - **1**: Horizontal flip - right-to-left, top-to-bottom
 * - **2**: Vertical flip - left-to-right, bottom-to-top
 * - **3**: 180° rotation (H+V flip) - right-to-left, bottom-to-top
 * - **4**: 90° CCW rotation + V flip - top-to-bottom, left-to-right
 * - **5**: 90° CCW rotation - bottom-to-top, left-to-right
 * - **6**: 90° CW rotation - top-to-bottom, right-to-left
 * - **7**: 90° CW rotation + V flip - bottom-to-top, right-to-left
 * 
 * ### Values 8-15 (with scrolling enabled):
 * When bit 3 is set, scrolling is enabled with a specific orientation mapping:
 * - **8**: Vertical flip + scrolling (same orientation as trace=2)
 * - **9**: 180° rotation + scrolling (same orientation as trace=3)
 * - **10**: Normal orientation + scrolling (same orientation as trace=0)
 * - **11**: Horizontal flip + scrolling (same orientation as trace=1)
 * - **12**: 90° CW rotation + scrolling (same orientation as trace=6)
 * - **13**: 90° CW rotation + V flip + scrolling (same orientation as trace=7)
 * - **14**: 90° CCW rotation + V flip + scrolling (same orientation as trace=4)
 * - **15**: 90° CCW rotation + scrolling (same orientation as trace=5)
 * 
 * ### Key Implementation Notes:
 * - The scrolling bit (bit 3) doesn't simply add scrolling to the base orientation
 * - Values 8-15 use a remapped orientation pattern: the equivalent non-scrolling 
 *   orientation can be found by XORing with 0b1010 (10)
 * - When scrolling is enabled, the bitmap shifts its content instead of wrapping 
 *   when reaching edges
 * - Scroll direction depends on the data flow direction for that trace mode
 * 
 * ## Internal Implementation
 * 
 * The bitmap display maintains:
 * - Current pixel position (pixelX, pixelY)
 * - Trace mode determines starting position and movement pattern
 * - stepPixel() advances position according to trace mode after each pixel
 * - When scrolling is enabled and edge is reached, scrollBitmap() shifts content
 */
export class TracePatternProcessor {
  private state: TraceState;
  private onScroll: ((x: number, y: number) => void) | null = null;

  constructor() {
    this.state = {
      pixelX: 0,
      pixelY: 0,
      width: 256,
      height: 256,
      pattern: 0,
      scrollEnabled: false
    };
  }

  /**
   * Set bitmap dimensions
   */
  public setBitmapSize(width: number, height: number): void {
    this.state.width = Math.max(1, Math.min(2048, width));
    this.state.height = Math.max(1, Math.min(2048, height));
    
    // Reset position based on current pattern
    this.resetPositionForPattern();
  }

  /**
   * Set trace pattern (0-15)
   */
  public setPattern(pattern: number, modifyRate: boolean = true): void {
    pattern = pattern & 0xF; // Ensure 0-15
    
    // Determine base pattern and scroll state
    this.state.scrollEnabled = (pattern & 0x8) !== 0;
    
    // Map trace values to actual orientation patterns
    if (pattern < 8) {
      // Direct mapping for non-scrolling patterns
      this.state.pattern = pattern;
    } else {
      // Remapped patterns for scrolling modes
      const scrollMapping = [2, 3, 0, 1, 6, 7, 4, 5];
      this.state.pattern = scrollMapping[pattern - 8];
    }
    
    // Set initial position based on pattern
    this.resetPositionForPattern();
  }

  /**
   * Reset position based on current pattern
   */
  private resetPositionForPattern(): void {
    switch (this.state.pattern) {
      case 0: // Normal: left-to-right, top-to-bottom
        this.state.pixelX = 0;
        this.state.pixelY = 0;
        break;
        
      case 1: // H flip: right-to-left, top-to-bottom
        this.state.pixelX = this.state.width - 1;
        this.state.pixelY = 0;
        break;
        
      case 2: // V flip: left-to-right, bottom-to-top
        this.state.pixelX = 0;
        this.state.pixelY = this.state.height - 1;
        break;
        
      case 3: // 180° rotation: right-to-left, bottom-to-top
        this.state.pixelX = this.state.width - 1;
        this.state.pixelY = this.state.height - 1;
        break;
        
      case 4: // 90° CCW + V flip: top-to-bottom, left-to-right
        this.state.pixelX = 0;
        this.state.pixelY = 0;
        break;
        
      case 5: // 90° CCW: bottom-to-top, left-to-right
        this.state.pixelX = 0;
        this.state.pixelY = this.state.height - 1;
        break;
        
      case 6: // 90° CW: top-to-bottom, right-to-left
        this.state.pixelX = this.state.width - 1;
        this.state.pixelY = 0;
        break;
        
      case 7: // 90° CW + V flip: bottom-to-top, right-to-left
        this.state.pixelX = this.state.width - 1;
        this.state.pixelY = this.state.height - 1;
        break;
    }
  }

  /**
   * Get suggested rate based on pattern
   * Used when RATE=0 to set appropriate default
   */
  public getSuggestedRate(): number {
    // For patterns 0-3 (horizontal scan), use width
    // For patterns 4-7 (vertical scan), use height
    return (this.state.pattern <= 3) ? this.state.width : this.state.height;
  }

  /**
   * Set current pixel position (used by SET command)
   */
  public setPosition(x: number, y: number): void {
    this.state.pixelX = Math.max(0, Math.min(this.state.width - 1, x));
    this.state.pixelY = Math.max(0, Math.min(this.state.height - 1, y));
    // When position is set manually via SET command, cancel scrolling to match Pascal behavior
    this.state.scrollEnabled = false;
  }

  /**
   * Get current pixel position
   */
  public getPosition(): { x: number; y: number } {
    return { x: this.state.pixelX, y: this.state.pixelY };
  }

  /**
   * Set scroll callback
   */
  public setScrollCallback(callback: (x: number, y: number) => void): void {
    this.onScroll = callback;
  }

  /**
   * Step to next pixel position according to pattern
   */
  public step(): void {
    const scroll = this.state.scrollEnabled;
    
    switch (this.state.pattern) {
      case 0: // Normal: left-to-right, top-to-bottom
        if (this.state.pixelX < this.state.width - 1) {
          this.state.pixelX++;
        } else {
          this.state.pixelX = 0;
          if (scroll) {
            this.triggerScroll(0, 1); // Scroll down
          } else if (this.state.pixelY < this.state.height - 1) {
            this.state.pixelY++;
          } else {
            this.state.pixelY = 0;
          }
        }
        break;
        
      case 1: // H flip: right-to-left, top-to-bottom
        if (this.state.pixelX > 0) {
          this.state.pixelX--;
        } else {
          this.state.pixelX = this.state.width - 1;
          if (scroll) {
            this.triggerScroll(0, 1); // Scroll down
          } else if (this.state.pixelY < this.state.height - 1) {
            this.state.pixelY++;
          } else {
            this.state.pixelY = 0;
          }
        }
        break;
        
      case 2: // V flip: left-to-right, bottom-to-top
        if (this.state.pixelX < this.state.width - 1) {
          this.state.pixelX++;
        } else {
          this.state.pixelX = 0;
          if (scroll) {
            this.triggerScroll(0, -1); // Scroll up
          } else if (this.state.pixelY > 0) {
            this.state.pixelY--;
          } else {
            this.state.pixelY = this.state.height - 1;
          }
        }
        break;
        
      case 3: // 180° rotation: right-to-left, bottom-to-top
        if (this.state.pixelX > 0) {
          this.state.pixelX--;
        } else {
          this.state.pixelX = this.state.width - 1;
          if (scroll) {
            this.triggerScroll(0, -1); // Scroll up
          } else if (this.state.pixelY > 0) {
            this.state.pixelY--;
          } else {
            this.state.pixelY = this.state.height - 1;
          }
        }
        break;
        
      case 4: // 90° CCW + V flip: top-to-bottom, left-to-right
        if (this.state.pixelY < this.state.height - 1) {
          this.state.pixelY++;
        } else {
          this.state.pixelY = 0;
          if (scroll) {
            this.triggerScroll(1, 0); // Scroll right
          } else if (this.state.pixelX < this.state.width - 1) {
            this.state.pixelX++;
          } else {
            this.state.pixelX = 0;
          }
        }
        break;
        
      case 5: // 90° CCW: bottom-to-top, left-to-right
        if (this.state.pixelY > 0) {
          this.state.pixelY--;
        } else {
          this.state.pixelY = this.state.height - 1;
          if (scroll) {
            this.triggerScroll(1, 0); // Scroll right
          } else if (this.state.pixelX < this.state.width - 1) {
            this.state.pixelX++;
          } else {
            this.state.pixelX = 0;
          }
        }
        break;
        
      case 6: // 90° CW: top-to-bottom, right-to-left
        if (this.state.pixelY < this.state.height - 1) {
          this.state.pixelY++;
        } else {
          this.state.pixelY = 0;
          if (scroll) {
            this.triggerScroll(-1, 0); // Scroll left
          } else if (this.state.pixelX > 0) {
            this.state.pixelX--;
          } else {
            this.state.pixelX = this.state.width - 1;
          }
        }
        break;
        
      case 7: // 90° CW + V flip: bottom-to-top, right-to-left
        if (this.state.pixelY > 0) {
          this.state.pixelY--;
        } else {
          this.state.pixelY = this.state.height - 1;
          if (scroll) {
            this.triggerScroll(-1, 0); // Scroll left
          } else if (this.state.pixelX > 0) {
            this.state.pixelX--;
          } else {
            this.state.pixelX = this.state.width - 1;
          }
        }
        break;
    }
  }

  /**
   * Trigger scroll callback
   */
  private triggerScroll(x: number, y: number): void {
    if (this.onScroll) {
      this.onScroll(x, y);
    }
  }

  /**
   * Get the current actual trace value (0-15)
   */
  public getTraceValue(): number {
    if (!this.state.scrollEnabled) {
      return this.state.pattern;
    } else {
      // Reverse map from pattern to scrolling trace value
      const reverseMapping = [10, 11, 8, 9, 14, 15, 12, 13];
      const index = [0, 1, 2, 3, 4, 5, 6, 7].indexOf(this.state.pattern);
      return reverseMapping[index];
    }
  }
}