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
 * Scroll direction for bitmap scrolling
 */
interface ScrollDirection {
  x: number;
  y: number;
}

/**
 * TracePatternProcessor implements the 8 trace patterns from Pascal SetTrace/StepTrace
 * Patterns 0-7 control pixel plotting direction
 * Bit 3 (patterns 8-15) enables auto-scrolling
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
    
    // Clamp current position to new bounds
    this.state.pixelX = Math.min(this.state.pixelX, this.state.width - 1);
    this.state.pixelY = Math.min(this.state.pixelY, this.state.height - 1);
  }

  /**
   * Set trace pattern (0-15)
   * Patterns 0-7: directional patterns
   * Patterns 8-15: same as 0-7 with auto-scroll enabled
   */
  public setPattern(pattern: number, modifyRate: boolean = true): void {
    const basePattern = pattern & 0x7;
    this.state.pattern = basePattern;
    this.state.scrollEnabled = (pattern & 0x8) !== 0;
    
    // Set initial pixel position based on pattern (Pascal SetTrace)
    switch (basePattern) {
      case 0: // Right, start top-left
      case 2: // Down, start top-left
        this.state.pixelX = 0;
        this.state.pixelY = 0;
        break;
        
      case 1: // Left, start top-right
      case 5: // Up, start bottom-right
        this.state.pixelX = this.state.width - 1;
        this.state.pixelY = basePattern === 1 ? 0 : this.state.height - 1;
        break;
        
      case 3: // Down, start top-right
      case 4: // Down, start top-left
        this.state.pixelX = basePattern === 3 ? this.state.width - 1 : 0;
        this.state.pixelY = 0;
        break;
        
      case 6: // Down, start bottom-left
      case 7: // Up, start bottom-left
        this.state.pixelX = basePattern === 6 ? 0 : this.state.width - 1;
        this.state.pixelY = this.state.height - 1;
        break;
    }
  }

  /**
   * Get suggested rate based on pattern
   * Used when RATE=0 to set appropriate default
   */
  public getSuggestedRate(): number {
    const basePattern = this.state.pattern & 0x7;
    // Horizontal patterns use width, vertical use height
    return (basePattern >= 0 && basePattern <= 3) ? this.state.width : this.state.height;
  }

  /**
   * Set current pixel position (used by SET command)
   */
  public setPosition(x: number, y: number): void {
    this.state.pixelX = Math.max(0, Math.min(this.state.width - 1, x));
    this.state.pixelY = Math.max(0, Math.min(this.state.height - 1, y));
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
   * Matches Pascal StepTrace implementation
   */
  public step(): void {
    const scroll = this.state.scrollEnabled;
    
    switch (this.state.pattern) {
      case 0: // Right, scroll left
        if (this.state.pixelX < this.state.width - 1) {
          this.state.pixelX++;
        } else {
          this.state.pixelX = 0;
          if (scroll) {
            this.triggerScroll(0, 1);
          } else if (this.state.pixelY < this.state.height - 1) {
            this.state.pixelY++;
          } else {
            this.state.pixelY = 0;
          }
        }
        break;
        
      case 1: // Left, scroll right
        if (this.state.pixelX > 0) {
          this.state.pixelX--;
        } else {
          this.state.pixelX = this.state.width - 1;
          if (scroll) {
            this.triggerScroll(0, 1);
          } else if (this.state.pixelY < this.state.height - 1) {
            this.state.pixelY++;
          } else {
            this.state.pixelY = 0;
          }
        }
        break;
        
      case 2: // Right, scroll left (alternate)
        if (this.state.pixelX < this.state.width - 1) {
          this.state.pixelX++;
        } else {
          this.state.pixelX = 0;
          if (scroll) {
            this.triggerScroll(0, -1);
          } else if (this.state.pixelY > 0) {
            this.state.pixelY--;
          } else {
            this.state.pixelY = this.state.height - 1;
          }
        }
        break;
        
      case 3: // Left, scroll right (alternate)
        if (this.state.pixelX > 0) {
          this.state.pixelX--;
        } else {
          this.state.pixelX = this.state.width - 1;
          if (scroll) {
            this.triggerScroll(0, -1);
          } else if (this.state.pixelY > 0) {
            this.state.pixelY--;
          } else {
            this.state.pixelY = this.state.height - 1;
          }
        }
        break;
        
      case 4: // Down, scroll up
        if (this.state.pixelY < this.state.height - 1) {
          this.state.pixelY++;
        } else {
          this.state.pixelY = 0;
          if (scroll) {
            this.triggerScroll(1, 0);
          } else if (this.state.pixelX < this.state.width - 1) {
            this.state.pixelX++;
          } else {
            this.state.pixelX = 0;
          }
        }
        break;
        
      case 5: // Up, scroll down
        if (this.state.pixelY > 0) {
          this.state.pixelY--;
        } else {
          this.state.pixelY = this.state.height - 1;
          if (scroll) {
            this.triggerScroll(1, 0);
          } else if (this.state.pixelX < this.state.width - 1) {
            this.state.pixelX++;
          } else {
            this.state.pixelX = 0;
          }
        }
        break;
        
      case 6: // Down, scroll up (alternate)
        if (this.state.pixelY < this.state.height - 1) {
          this.state.pixelY++;
        } else {
          this.state.pixelY = 0;
          if (scroll) {
            this.triggerScroll(-1, 0);
          } else if (this.state.pixelX > 0) {
            this.state.pixelX--;
          } else {
            this.state.pixelX = this.state.width - 1;
          }
        }
        break;
        
      case 7: // Up, scroll down (alternate)
        if (this.state.pixelY > 0) {
          this.state.pixelY--;
        } else {
          this.state.pixelY = this.state.height - 1;
          if (scroll) {
            this.triggerScroll(-1, 0);
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
   * Get current pattern
   */
  public getPattern(): number {
    return this.state.pattern | (this.state.scrollEnabled ? 0x8 : 0);
  }

  /**
   * Check if scrolling is enabled
   */
  public isScrollEnabled(): boolean {
    return this.state.scrollEnabled;
  }

  /**
   * Get pattern description
   */
  public static getPatternDescription(pattern: number): string {
    const basePattern = pattern & 0x7;
    const scroll = (pattern & 0x8) !== 0;
    
    const descriptions = [
      'Right', // 0
      'Left',  // 1
      'Right', // 2
      'Left',  // 3
      'Down',  // 4
      'Up',    // 5
      'Down',  // 6
      'Up'     // 7
    ];
    
    const scrollDescriptions = [
      'scroll left',   // 0
      'scroll right',  // 1
      'scroll left',   // 2
      'scroll right',  // 3
      'scroll up',     // 4
      'scroll down',   // 5
      'scroll up',     // 6
      'scroll down'    // 7
    ];
    
    const base = descriptions[basePattern];
    const scrollText = scroll ? scrollDescriptions[basePattern] : 'no scroll';
    
    return `${base}, ${scrollText}`;
  }
}