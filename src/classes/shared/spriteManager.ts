/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

'use strict';

// src/classes/shared/spriteManager.ts

export interface SpriteDefinition {
  width: number;
  height: number;
  pixels: number[];   // Array of pixel indices (0-255) into colors array
  colors: number[];   // 256-color palette as ARGB32 values (alpha in bits 24-31)
}

export class SpriteManager {
  // Console logging control
  private static logConsoleMessageStatic(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private logConsoleMessage(...args: any[]): void {
    if (ENABLE_CONSOLE_LOG) {
      console.log(...args);
    }
  }

  private sprites: (SpriteDefinition | null)[];
  private static readonly MAX_SPRITES = 256;
  private memoryUsage: number = 0; // Track memory usage in bytes
  private maxMemoryUsage: number = 0; // Track peak memory usage
  private spriteCreationCount: number = 0; // Track total sprites created for leak detection

  constructor() {
    // Initialize array with null values for 256 sprites
    this.sprites = new Array(SpriteManager.MAX_SPRITES).fill(null);
  }

  /**
   * Define a sprite with pixel data and color palette
   * @param id Sprite ID (0-255)
   * @param width Sprite width in pixels
   * @param height Sprite height in pixels
   * @param pixels Array of pixel indices into color palette
   * @param colors Array of 256 ARGB32 color values (alpha in bits 24-31)
   * @throws Error if parameters are invalid
   */
  defineSprite(id: number, width: number, height: number, pixels: number[], colors: number[]): void {
    // Validate sprite ID
    if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
      throw new Error(`Sprite ID must be between 0 and ${SpriteManager.MAX_SPRITES - 1}`);
    }

    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error('Sprite dimensions must be positive');
    }

    // Validate pixel data size
    const expectedPixels = width * height;
    if (pixels.length !== expectedPixels) {
      throw new Error(`Expected ${expectedPixels} pixels, got ${pixels.length}`);
    }

    // Validate color palette size
    if (colors.length !== 256) {
      throw new Error(`Color palette must contain exactly 256 colors, got ${colors.length}`);
    }

    // Validate pixel indices are within palette range
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] < 0 || pixels[i] > 255) {
        throw new Error(`Pixel index ${pixels[i]} at position ${i} is out of range (0-255)`);
      }
    }

    // Clean up existing sprite if replacing
    if (this.sprites[id] !== null) {
      this.releaseSprite(id);
    }

    // Calculate memory usage for new sprite
    const spriteMemory = this.calculateSpriteMemory(width, height, pixels.length, colors.length);

    // Store sprite definition with memory tracking
    this.sprites[id] = {
      width,
      height,
      pixels: [...pixels],  // Copy arrays to prevent external modification
      colors: [...colors]
    };

    // Update memory tracking
    this.memoryUsage += spriteMemory;
    this.maxMemoryUsage = Math.max(this.maxMemoryUsage, this.memoryUsage);
    this.spriteCreationCount++;

    this.logConsoleMessage(`[SPRITE MANAGER] Sprite ${id} defined: ${width}x${height}, memory: ${spriteMemory} bytes, total: ${this.memoryUsage} bytes`);
  }

  /**
   * Draw a sprite to a canvas context with transformations
   * @param ctx Target canvas rendering context
   * @param id Sprite ID (0-255)
   * @param x X coordinate for sprite center
   * @param y Y coordinate for sprite center
   * @param orientation Rotation/flip mode (0-7)
   * @param scale Scale factor (1.0 = normal size)
   * @param opacity Opacity value (0-255, where 255 = fully opaque)
   * @throws Error if sprite not defined or parameters invalid
   */
  drawSprite(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    id: number,
    x: number,
    y: number,
    orientation: number = 0,
    scale: number = 1.0,
    opacity: number = 255
  ): void {
    // Validate sprite ID
    if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
      throw new Error(`Sprite ID must be between 0 and ${SpriteManager.MAX_SPRITES - 1}`);
    }

    // Get sprite definition
    const sprite = this.sprites[id];
    if (!sprite) {
      throw new Error(`Sprite ${id} is not defined`);
    }

    // Validate orientation
    if (orientation < 0 || orientation > 7) {
      throw new Error('Orientation must be between 0 and 7');
    }

    // Validate scale
    if (scale <= 0) {
      throw new Error('Scale must be positive');
    }

    // Clamp opacity to valid range
    opacity = Math.max(0, Math.min(255, opacity));

    // Save context state
    ctx.save();

    try {
      // Position + uniform scale. Orientation is applied as a per-pixel SOURCE REMAP below,
      // NOT as a canvas rotate. Pascal key_sprite (DebugDisplayUnit.pas 2123-2132) encodes
      // orientation as three independent bits — bit0 = flip source-X, bit1 = flip source-Y,
      // bit2 = transpose (swap axes) — which is a *different* parameterization from
      // "rotate 0/90/180/270 + optional flip" and only agrees at orientation 0. The per-pixel
      // remap below matches Pascal index-for-index for all 8 orientations.
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      const spriteW = sprite.width;
      const spriteH = sprite.height;
      const flipX = (orientation & 1) !== 0;
      const flipY = (orientation & 2) !== 0;
      const transpose = (orientation & 4) !== 0;
      // Transpose swaps the output bounding box dimensions
      const outW = transpose ? spriteH : spriteW;
      const outH = transpose ? spriteW : spriteH;

      // Create temporary canvas sized to the ORIENTED output
      const tempCanvas = new OffscreenCanvas(outW, outH);
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        throw new Error('Failed to create temporary context for sprite rendering');
      }

      const imageData = tempCtx.createImageData(outW, outH);
      const data = imageData.data;

      // Render each source pixel to its Pascal-oriented destination
      for (let py = 0; py < spriteH; py++) {
        for (let px = 0; px < spriteW; px++) {
          const colorIndex = sprite.pixels[py * spriteW + px];
          const argb32 = sprite.colors[colorIndex];

          // Extract ARGB components from ARGB32 (Pascal format: alpha in high byte)
          const a = (argb32 >> 24) & 0xFF;
          const r = (argb32 >> 16) & 0xFF;
          const g = (argb32 >> 8) & 0xFF;
          const b = argb32 & 0xFF;

          // Combine color alpha with sprite opacity (Pascal formula: ((a * opacity + 255) >> 8))
          const combinedAlpha = ((a * opacity + 255) >> 8);

          // Pascal orientation remap: apply flip-X, flip-Y, then transpose (swap axes)
          const ex = flipX ? spriteW - 1 - px : px;
          const ey = flipY ? spriteH - 1 - py : py;
          const dx = transpose ? ey : ex;
          const dy = transpose ? ex : ey;

          const dataIndex = (dy * outW + dx) * 4;
          data[dataIndex] = r;
          data[dataIndex + 1] = g;
          data[dataIndex + 2] = b;
          data[dataIndex + 3] = combinedAlpha;
        }
      }

      // Put image data to temporary canvas
      tempCtx.putImageData(imageData, 0, 0);

      // Draw the oriented sprite centered on the current position
      ctx.drawImage(tempCanvas, -outW / 2, -outH / 2);

    } finally {
      // Restore context state
      ctx.restore();
    }
  }

  /**
   * Clear a specific sprite definition with proper memory cleanup
   * @param id Sprite ID (0-255)
   */
  clearSprite(id: number): void {
    if (id >= 0 && id < SpriteManager.MAX_SPRITES) {
      this.releaseSprite(id);
    }
  }

  /**
   * Clear all sprite definitions with proper memory cleanup
   */
  clearAllSprites(): void {
    // Release all sprites to update memory tracking
    for (let i = 0; i < SpriteManager.MAX_SPRITES; i++) {
      if (this.sprites[i] !== null) {
        this.releaseSprite(i);
      }
    }
    this.logConsoleMessage(`[SPRITE MANAGER] All sprites cleared, memory usage reset to 0`);
  }

  /**
   * Release a sprite and update memory tracking
   * @param id Sprite ID (0-255)
   */
  private releaseSprite(id: number): void {
    const sprite = this.sprites[id];
    if (sprite !== null) {
      // Calculate memory being released
      const spriteMemory = this.calculateSpriteMemory(
        sprite.width,
        sprite.height,
        sprite.pixels.length,
        sprite.colors.length
      );

      // Clear the sprite
      this.sprites[id] = null;

      // Update memory tracking
      this.memoryUsage -= spriteMemory;
      this.memoryUsage = Math.max(0, this.memoryUsage); // Ensure non-negative

      this.logConsoleMessage(`[SPRITE MANAGER] Sprite ${id} released: ${spriteMemory} bytes freed, total: ${this.memoryUsage} bytes`);
    }
  }

  /**
   * Calculate memory usage for a sprite
   * @param width Sprite width
   * @param height Sprite height
   * @param pixelCount Number of pixels
   * @param colorCount Number of colors
   * @returns Memory usage in bytes
   */
  private calculateSpriteMemory(width: number, height: number, pixelCount: number, colorCount: number): number {
    // Estimate memory usage:
    // - Basic object overhead: ~100 bytes
    // - pixels array: pixelCount * 8 bytes (number storage in JS)
    // - colors array: colorCount * 8 bytes (number storage in JS)
    // - width/height: 16 bytes
    return 100 + (pixelCount * 8) + (colorCount * 8) + 16;
  }

  /**
   * Check if a sprite is defined
   * @param id Sprite ID (0-255)
   * @returns true if sprite is defined, false otherwise
   */
  isSpriteDefine(id: number): boolean {
    if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
      return false;
    }
    return this.sprites[id] !== null;
  }

  /**
   * Get sprite dimensions
   * @param id Sprite ID (0-255)
   * @returns Object with width and height, or null if sprite not defined
   */
  getSpriteDimensions(id: number): { width: number; height: number } | null {
    if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
      return null;
    }

    const sprite = this.sprites[id];
    if (!sprite) {
      return null;
    }

    return {
      width: sprite.width,
      height: sprite.height
    };
  }

  /**
   * Get sprite definition
   * @param id Sprite ID (0-255)
   * @returns Sprite definition or null if not defined
   */
  getSprite(id: number): SpriteDefinition | null {
    if (id < 0 || id >= SpriteManager.MAX_SPRITES) {
      return null;
    }
    return this.sprites[id];
  }

  /**
   * Get current memory usage statistics
   * @returns Memory usage information
   */
  getMemoryStats(): {
    currentUsage: number;
    maxUsage: number;
    spriteCount: number;
    totalCreated: number;
    averageSpriteSize: number;
  } {
    const spriteCount = this.sprites.filter(sprite => sprite !== null).length;
    const averageSpriteSize = spriteCount > 0 ? this.memoryUsage / spriteCount : 0;

    return {
      currentUsage: this.memoryUsage,
      maxUsage: this.maxMemoryUsage,
      spriteCount: spriteCount,
      totalCreated: this.spriteCreationCount,
      averageSpriteSize: Math.round(averageSpriteSize)
    };
  }

  /**
   * Check for potential memory leaks
   * @returns Warning message if potential leak detected, null otherwise
   */
  checkMemoryHealth(): string | null {
    const stats = this.getMemoryStats();

    // Check for excessive memory usage (over 50MB)
    if (stats.currentUsage > 50 * 1024 * 1024) {
      return `High memory usage: ${Math.round(stats.currentUsage / 1024 / 1024)}MB. Consider clearing unused sprites.`;
    }

    // Check for too many sprites
    if (stats.spriteCount > 200) {
      return `High sprite count: ${stats.spriteCount}/256. Memory usage: ${Math.round(stats.currentUsage / 1024 / 1024)}MB.`;
    }

    // Check for very large average sprite size
    if (stats.averageSpriteSize > 500000) { // 500KB per sprite
      return `Large average sprite size: ${Math.round(stats.averageSpriteSize / 1024)}KB. Consider optimizing sprite data.`;
    }

    return null;
  }

  /**
   * Force garbage collection hint and cleanup
   * Note: Actual garbage collection is handled by JavaScript engine
   */
  suggestGarbageCollection(): void {
    // Clear any temporary references that might prevent GC
    // In a real implementation, this might clear internal caches or temporary data
    this.logConsoleMessage(`[SPRITE MANAGER] Garbage collection suggested. Current memory: ${this.memoryUsage} bytes`);

    // Log memory health check
    const healthWarning = this.checkMemoryHealth();
    if (healthWarning) {
      this.logConsoleMessage(`[SPRITE MANAGER] Memory warning: ${healthWarning}`);
    }
  }
}