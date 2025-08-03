/** @format */

'use strict';

// src/classes/shared/spriteManager.ts

export interface SpriteDefinition {
  width: number;
  height: number;
  pixels: number[];   // Array of pixel indices (0-255) into colors array
  colors: number[];   // 256-color palette as RGB24 values
}

export class SpriteManager {
  private sprites: (SpriteDefinition | null)[];
  private static readonly MAX_SPRITES = 256;

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
   * @param colors Array of 256 RGB24 color values
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

    // Store sprite definition
    this.sprites[id] = {
      width,
      height,
      pixels: [...pixels],  // Copy arrays to prevent external modification
      colors: [...colors]
    };
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
      // Apply transformations
      ctx.translate(x, y);
      
      // Apply orientation (0-7)
      // 0: 0° rotation
      // 1: 90° rotation
      // 2: 180° rotation
      // 3: 270° rotation
      // 4: 0° rotation + horizontal flip
      // 5: 90° rotation + horizontal flip
      // 6: 180° rotation + horizontal flip
      // 7: 270° rotation + horizontal flip
      
      const flipH = orientation >= 4;
      const rotation = (orientation % 4) * 90;
      
      if (flipH) {
        ctx.scale(-1, 1);
      }
      
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);
      
      // Set opacity
      ctx.globalAlpha = opacity / 255;
      
      // Calculate drawing offset (sprite drawn from center)
      const halfWidth = sprite.width / 2;
      const halfHeight = sprite.height / 2;
      
      // Create temporary canvas for sprite rendering
      const tempCanvas = new OffscreenCanvas(sprite.width, sprite.height);
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        throw new Error('Failed to create temporary context for sprite rendering');
      }
      
      // Get image data for direct pixel manipulation
      const imageData = tempCtx.createImageData(sprite.width, sprite.height);
      const data = imageData.data;
      
      // Render sprite pixels using color palette
      for (let py = 0; py < sprite.height; py++) {
        for (let px = 0; px < sprite.width; px++) {
          const pixelIndex = py * sprite.width + px;
          const colorIndex = sprite.pixels[pixelIndex];
          const rgb24 = sprite.colors[colorIndex];
          
          // Extract RGB components from RGB24
          const r = (rgb24 >> 16) & 0xFF;
          const g = (rgb24 >> 8) & 0xFF;
          const b = rgb24 & 0xFF;
          
          // Set pixel in image data (RGBA format)
          const dataIndex = pixelIndex * 4;
          data[dataIndex] = r;
          data[dataIndex + 1] = g;
          data[dataIndex + 2] = b;
          data[dataIndex + 3] = 255; // Full alpha in image data
        }
      }
      
      // Put image data to temporary canvas
      tempCtx.putImageData(imageData, 0, 0);
      
      // Draw temporary canvas to main context
      ctx.drawImage(tempCanvas, -halfWidth, -halfHeight);
      
    } finally {
      // Restore context state
      ctx.restore();
    }
  }

  /**
   * Clear a specific sprite definition
   * @param id Sprite ID (0-255)
   */
  clearSprite(id: number): void {
    if (id >= 0 && id < SpriteManager.MAX_SPRITES) {
      this.sprites[id] = null;
    }
  }

  /**
   * Clear all sprite definitions
   */
  clearAllSprites(): void {
    this.sprites.fill(null);
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
}