/** @format */

const ENABLE_CONSOLE_LOG: boolean = false;

('use strict');

// src/classes/shared/layerManager.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { Jimp } from 'jimp';

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class LayerManager {
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

  public layers: (Awaited<ReturnType<typeof Jimp.read>> | null)[];
  private static readonly MAX_LAYERS = 8;
  private memoryUsage: number = 0; // Track memory usage in bytes
  private maxMemoryUsage: number = 0; // Track peak memory usage
  private layerCreationCount: number = 0; // Track total layers created for leak detection
  private layerMetadata: Array<{ filename: string; loadTime: Date; size: number } | null> = [];

  constructor() {
    this.logConsoleMessage('[LAYER LIFECYCLE] LayerManager constructed');
    // Initialize array with null values for 8 layers
    this.layers = new Array(LayerManager.MAX_LAYERS).fill(null);
    this.layerMetadata = new Array(LayerManager.MAX_LAYERS).fill(null);
    this.logConsoleMessage('[LAYER LIFECYCLE] Layers array initialized:', this.layers.length, 'elements');
  }

  /**
   * Load a bitmap file into the specified layer
   * @param index Layer index (0-7)
   * @param filepath Path to the bitmap file
   * @throws Error if index is out of bounds or file cannot be loaded
   */
  async loadLayer(index: number, filepath: string): Promise<void> {
    // Validate layer index
    if (index < 0 || index >= LayerManager.MAX_LAYERS) {
      throw new Error(`Layer index must be between 0 and ${LayerManager.MAX_LAYERS - 1}`);
    }

    // Validate file extension
    const ext = path.extname(filepath).toLowerCase();
    const supportedFormats = ['.bmp', '.png', '.jpg', '.jpeg', '.gif'];
    if (!supportedFormats.includes(ext)) {
      throw new Error(`Unsupported file format: ${ext}. Supported formats: ${supportedFormats.join(', ')}`);
    }

    try {
      // Check if file exists
      await fs.access(filepath);

      // Load image using Jimp (works in Node.js, supports BMP/PNG/JPG)
      const image = await Jimp.read(filepath);

      // Clear any existing layer with proper memory tracking
      if (this.layers[index]) {
        this.releaseLayer(index);
      }

      // Calculate memory usage for new layer
      const layerMemory = this.calculateLayerMemory(image.width, image.height);

      // Store the Jimp image object
      this.layers[index] = image;

      // Update memory tracking and metadata
      this.memoryUsage += layerMemory;
      this.maxMemoryUsage = Math.max(this.maxMemoryUsage, this.memoryUsage);
      this.layerCreationCount++;
      this.layerMetadata[index] = {
        filename: filepath,
        loadTime: new Date(),
        size: layerMemory
      };

      this.logConsoleMessage(
        `[LAYER LIFECYCLE] Layer ${index} loaded successfully: "${filepath}" (${image.width}x${image.height})`
      );
      this.logConsoleMessage(
        `[LAYER LIFECYCLE] Layer reference type: ${typeof image}, has getPixelColor: ${typeof image?.getPixelColor}`
      );
      this.logConsoleMessage(
        `[LAYER MANAGER] Layer ${index} loaded from "${filepath}": ${image.width}x${image.height}, memory: ${layerMemory} bytes, total: ${this.memoryUsage} bytes`
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          throw new Error(`File not found: ${filepath}`);
        }
        throw new Error(`Failed to load image: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Draw a layer to a target canvas context with optional cropping
   * @param ctx Target canvas rendering context
   * @param layerIndex Layer index (0-7)
   * @param sourceRect Optional source rectangle for cropping (null for AUTO mode)
   * @param destX Destination X coordinate (default: 0)
   * @param destY Destination Y coordinate (default: 0)
   * @throws Error if layer index is invalid or layer is not loaded
   */
  drawLayerToCanvas(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    layerIndex: number,
    sourceRect?: CropRect | null,
    destX: number = 0,
    destY: number = 0
  ): void {
    // Validate layer index
    if (layerIndex < 0 || layerIndex >= LayerManager.MAX_LAYERS) {
      throw new Error(`Layer index must be between 0 and ${LayerManager.MAX_LAYERS - 1}`);
    }

    // Check if layer is loaded
    const layer = this.layers[layerIndex];
    if (!layer) {
      throw new Error(`Layer ${layerIndex} is not loaded`);
    }

    try {
      // Determine source region
      const srcX = sourceRect ? sourceRect.left : 0;
      const srcY = sourceRect ? sourceRect.top : 0;
      const srcWidth = sourceRect ? sourceRect.width : layer.width;
      const srcHeight = sourceRect ? sourceRect.height : layer.height;

      // Validate source rectangle bounds
      if (srcX < 0 || srcY < 0 || srcX + srcWidth > layer.width || srcY + srcHeight > layer.height) {
        throw new Error(
          `Source rectangle out of bounds: (${srcX},${srcY}) ${srcWidth}x${srcHeight} exceeds layer ${layer.width}x${layer.height}`
        );
      }

      // Extract pixel data from Jimp image
      // Jimp stores pixels in RGBA format, which matches ImageData
      const imageData = ctx.createImageData(srcWidth, srcHeight);

      // Copy pixels from Jimp to ImageData
      let dataIndex = 0;
      for (let y = srcY; y < srcY + srcHeight; y++) {
        for (let x = srcX; x < srcX + srcWidth; x++) {
          const pixelColor = layer.getPixelColor(x, y);
          // Jimp stores colors as 32-bit integers: RRGGBBAA
          imageData.data[dataIndex++] = (pixelColor >> 24) & 0xff; // R
          imageData.data[dataIndex++] = (pixelColor >> 16) & 0xff; // G
          imageData.data[dataIndex++] = (pixelColor >> 8) & 0xff; // B
          imageData.data[dataIndex++] = pixelColor & 0xff; // A
        }
      }

      // Draw the image data to the canvas
      ctx.putImageData(imageData, destX, destY);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to draw layer: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get the dimensions of a loaded layer
   * @param layerIndex Layer index (0-7)
   * @returns Object with width and height, or null if layer not loaded
   */
  getLayerDimensions(layerIndex: number): { width: number; height: number } | null {
    if (layerIndex < 0 || layerIndex >= LayerManager.MAX_LAYERS) {
      return null;
    }

    const layer = this.layers[layerIndex];
    if (!layer) {
      return null;
    }

    return {
      width: layer.width,
      height: layer.height
    };
  }

  /**
   * Clear a specific layer with proper memory cleanup
   * @param layerIndex Layer index (0-7)
   */
  clearLayer(layerIndex: number): void {
    if (layerIndex >= 0 && layerIndex < LayerManager.MAX_LAYERS) {
      this.releaseLayer(layerIndex);
    }
  }

  /**
   * Clear all layers with proper memory cleanup
   */
  clearAllLayers(): void {
    // Release all layers to update memory tracking
    for (let i = 0; i < LayerManager.MAX_LAYERS; i++) {
      if (this.layers[i] !== null) {
        this.releaseLayer(i);
      }
    }
    this.logConsoleMessage(`[LAYER MANAGER] All layers cleared, memory usage reset to 0`);
  }

  /**
   * Release a layer and update memory tracking
   * @param layerIndex Layer index (0-7)
   */
  private releaseLayer(layerIndex: number): void {
    const layer = this.layers[layerIndex];
    const metadata = this.layerMetadata[layerIndex];

    this.logConsoleMessage(`[LAYER LIFECYCLE] releaseLayer() called for index ${layerIndex}`);

    const stack = new Error().stack
      ?.split('\n')
      .slice(2, 6) // Skip the "Error" line and releaseLayer itself
      .map((line) => line.trim())
      .join(' -> ');
    if (stack) {
      this.logConsoleMessage(`[LAYER LIFECYCLE] Release initiated by: ${stack}`);
    }

    if (layer !== null && metadata !== null) {
      // Update memory tracking
      this.memoryUsage -= metadata.size;
      this.memoryUsage = Math.max(0, this.memoryUsage); // Ensure non-negative

      // Clear the layer and metadata
      this.logConsoleMessage(`[LAYER LIFECYCLE] Setting layers[${layerIndex}] = null (was: ${metadata.filename})`);
      this.layers[layerIndex] = null;
      this.layerMetadata[layerIndex] = null;

      this.logConsoleMessage(
        `[LAYER MANAGER] Layer ${layerIndex} released: ${metadata.size} bytes freed, total: ${this.memoryUsage} bytes`
      );
    } else {
      this.logConsoleMessage(`[LAYER LIFECYCLE] releaseLayer() called but layer already null or no metadata`);
    }
  }

  /**
   * Calculate memory usage for a layer
   * @param width Layer width
   * @param height Layer height
   * @returns Memory usage in bytes
   */
  private calculateLayerMemory(width: number, height: number): number {
    // Estimate memory usage:
    // - OffscreenCanvas overhead: ~200 bytes
    // - RGBA pixel data: width * height * 4 bytes
    // - Additional canvas context overhead: ~100 bytes
    return 300 + width * height * 4;
  }

  /**
   * Check if a layer is loaded
   * @param layerIndex Layer index (0-7)
   * @returns true if layer is loaded, false otherwise
   */
  isLayerLoaded(layerIndex: number): boolean {
    // DIAGNOSTIC: Log every check to understand the failure
    const outOfBounds = layerIndex < 0 || layerIndex >= LayerManager.MAX_LAYERS;
    const layerValue = outOfBounds ? 'OUT_OF_BOUNDS' : this.layers[layerIndex] ? 'LOADED' : 'NULL';
    const result = !outOfBounds && this.layers[layerIndex] !== null;

    this.logConsoleMessage(`[LAYER CHECK] isLayerLoaded(${layerIndex}): ${result}`);
    if (!result && layerIndex >= 0 && layerIndex < LayerManager.MAX_LAYERS) {
      this.logConsoleMessage(`[LAYER CHECK] ⚠️ Layer is NULL at valid index ${layerIndex}!`);
      this.logConsoleMessage(
        `[LAYER CHECK] All layers state:`,
        this.layers.map((l: any, i: number) => `[${i}]: ${l ? 'EXISTS' : 'NULL'}`)
      );
    }

    this.logConsoleMessage(
      `[LAYER MANAGER] isLayerLoaded(${layerIndex}): ` +
        `outOfBounds=${outOfBounds}, ` +
        `MAX_LAYERS=${LayerManager.MAX_LAYERS}, ` +
        `layerValue=${layerValue}, ` +
        `layersArrayLength=${this.layers.length}, ` +
        `result=${result}`
    );

    if (layerIndex < 0 || layerIndex >= LayerManager.MAX_LAYERS) {
      return false;
    }
    return this.layers[layerIndex] !== null;
  }

  /**
   * Alias for isLayerLoaded for compatibility
   * @param layerIndex Layer index (0-7)
   * @returns true if layer is loaded, false otherwise
   */
  hasLayer(layerIndex: number): boolean {
    return this.isLayerLoaded(layerIndex);
  }

  /**
   * Crop layer operation - copy rectangular region to a destination
   * @param layerIndex Source layer index (0-7)
   * @param sourceRect Source rectangle {left, top, width, height}
   * @param destX Destination X coordinate
   * @param destY Destination Y coordinate
   */
  cropLayer(layerIndex: number, sourceRect: CropRect, destX: number, destY: number): void {
    // Validate layer index
    if (layerIndex < 0 || layerIndex >= LayerManager.MAX_LAYERS) {
      throw new Error(`Layer index must be between 0 and ${LayerManager.MAX_LAYERS - 1}`);
    }

    // Check if layer is loaded
    const layer = this.layers[layerIndex];
    if (!layer) {
      throw new Error(`Layer ${layerIndex} is not loaded`);
    }

    // For now, this is a placeholder - actual implementation would
    // need access to the target canvas context to draw the cropped region
    this.logConsoleMessage(
      `[LAYER MANAGER] Crop operation: layer ${layerIndex} (${sourceRect.left},${sourceRect.top}) ${sourceRect.width}x${sourceRect.height} to (${destX},${destY})`
    );

    // TODO: Implement actual cropping when we have access to target canvas
    // This would typically be:
    // targetCtx.drawImage(layer, sourceRect.left, sourceRect.top, sourceRect.width, sourceRect.height, destX, destY, sourceRect.width, sourceRect.height);
  }

  /**
   * Get current memory usage statistics
   * @returns Memory usage information
   */
  getMemoryStats(): {
    currentUsage: number;
    maxUsage: number;
    layerCount: number;
    totalCreated: number;
    averageLayerSize: number;
    layersInfo: Array<{ index: number; filename: string; size: number; loadTime: Date } | null>;
  } {
    const layerCount = this.layers.filter((layer) => layer !== null).length;
    const averageLayerSize = layerCount > 0 ? this.memoryUsage / layerCount : 0;

    const layersInfo = this.layerMetadata.map((metadata, index) => {
      if (metadata && this.layers[index]) {
        return {
          index,
          filename: metadata.filename,
          size: metadata.size,
          loadTime: metadata.loadTime
        };
      }
      return null;
    });

    return {
      currentUsage: this.memoryUsage,
      maxUsage: this.maxMemoryUsage,
      layerCount: layerCount,
      totalCreated: this.layerCreationCount,
      averageLayerSize: Math.round(averageLayerSize),
      layersInfo: layersInfo
    };
  }

  /**
   * Check for potential memory leaks
   * @returns Warning message if potential leak detected, null otherwise
   */
  checkMemoryHealth(): string | null {
    const stats = this.getMemoryStats();

    // Check for excessive memory usage (over 100MB)
    if (stats.currentUsage > 100 * 1024 * 1024) {
      return `High memory usage: ${Math.round(stats.currentUsage / 1024 / 1024)}MB. Consider clearing unused layers.`;
    }

    // Check for very large average layer size
    if (stats.averageLayerSize > 20 * 1024 * 1024) {
      // 20MB per layer
      return `Large average layer size: ${Math.round(
        stats.averageLayerSize / 1024 / 1024
      )}MB. Consider using smaller bitmap files.`;
    }

    // Check for very old layers (over 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldLayers = stats.layersInfo.filter((info) => info && info.loadTime < oneHourAgo);

    if (oldLayers.length > 0) {
      return `${oldLayers.length} layer(s) loaded over 1 hour ago. Consider clearing if no longer needed.`;
    }

    return null;
  }

  /**
   * Force garbage collection hint and cleanup
   * Note: Actual garbage collection is handled by JavaScript engine
   */
  suggestGarbageCollection(): void {
    this.logConsoleMessage(`[LAYER MANAGER] Garbage collection suggested. Current memory: ${this.memoryUsage} bytes`);

    // Log memory health check
    const healthWarning = this.checkMemoryHealth();
    if (healthWarning) {
      this.logConsoleMessage(`[LAYER MANAGER] Memory warning: ${healthWarning}`);
    }
  }
}
