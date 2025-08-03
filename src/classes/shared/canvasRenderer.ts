/** @format */

'use strict';

// src/classes/shared/canvasRenderer.ts

/**
 * CanvasRenderer provides common canvas operations for debug windows
 * Each window creates an instance of this class for its canvas operations
 * 
 * Modified to work directly with CanvasRenderingContext2D for double buffering support
 */
export class CanvasRenderer {
  /**
   * Plot a single pixel on the canvas using context
   * Works with bitmap pixels and directly manipulates ImageData
   */
  plotPixelCtx(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, color: string): void {
    // Clip to canvas bounds
    if (x < 0 || x >= ctx.canvas.width || y < 0 || y >= ctx.canvas.height) return;
    
    // Get image data for single pixel
    const imageData = ctx.getImageData(x, y, 1, 1);
    const data = imageData.data;
    
    // Parse color hex string
    const r = parseInt(color.substr(1, 2), 16);
    const g = parseInt(color.substr(3, 2), 16);
    const b = parseInt(color.substr(5, 2), 16);
    
    // Set pixel color
    data[0] = r;
    data[1] = g;
    data[2] = b;
    data[3] = 255; // Full opacity
    
    // Put pixel back
    ctx.putImageData(imageData, x, y);
  }

  /**
   * Plot a scaled pixel (rectangle) on the canvas using context
   * Handles DOTSIZE scaling efficiently using fillRect
   */
  plotScaledPixelCtx(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    dotSizeX: number,
    dotSizeY: number
  ): void {
    // Calculate scaled position
    const scaledX = x * dotSizeX;
    const scaledY = y * dotSizeY;
    
    // Clip to canvas bounds
    if (scaledX >= ctx.canvas.width || scaledY >= ctx.canvas.height) return;
    
    // Set fill color and draw rectangle
    ctx.fillStyle = color;
    ctx.fillRect(scaledX, scaledY, dotSizeX, dotSizeY);
  }

  /**
   * Scroll bitmap content in any direction using context
   * Supports all 8 scroll directions from Pascal implementation
   */
  scrollBitmapCtx(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    scrollX: number,
    scrollY: number
  ): void {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // Create off-screen canvas for smooth scrolling
    const offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) return;
    
    // Copy current canvas content to off-screen canvas
    offscreenCtx.drawImage(ctx.canvas, 0, 0);
    
    // Clear the main canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Calculate source and destination rectangles for scrolling
    // Source rectangle (what part of the image to copy)
    const sx = Math.max(0, -scrollX);
    const sy = Math.max(0, -scrollY);
    const sw = canvasWidth - Math.abs(scrollX);
    const sh = canvasHeight - Math.abs(scrollY);
    
    // Destination rectangle (where to draw it)
    const dx = Math.max(0, scrollX);
    const dy = Math.max(0, scrollY);
    
    // Draw the scrolled content
    if (sw > 0 && sh > 0) {
      ctx.drawImage(offscreenCanvas, sx, sy, sw, sh, dx, dy, sw, sh);
    }
  }

  /**
   * Draw a solid line on the canvas using context directly
   */
  drawLineCtx(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    lineWidth: number = 1
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  /**
   * Draw a dashed line on the canvas (useful for grid lines) using context directly
   */
  drawDashedLineCtx(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    lineWidth: number = 1,
    dashPattern: number[] = [5, 5]
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dashPattern);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw text on the canvas using context directly
   */
  drawTextCtx(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: string = '12px',
    font: string = 'monospace',
    align: CanvasTextAlign = 'left',
    baseline: CanvasTextBaseline = 'top'
  ): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${fontSize} ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Clear a rectangular area on the canvas
   */
  clearCanvas(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number = 0,
    y: number = 0,
    width?: number,
    height?: number
  ): void {
    const clearWidth = width !== undefined ? width : ctx.canvas.width;
    const clearHeight = height !== undefined ? height : ctx.canvas.height;
    
    ctx.clearRect(x, y, clearWidth, clearHeight);
  }

  /**
   * Fill a rectangular area on the canvas
   */
  fillRect(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  /**
   * Draw a vertical line (commonly used for triggers and markers)
   */
  drawVerticalLine(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    topY: number,
    bottomY: number,
    color: string,
    lineWidth: number = 1,
    dashed: boolean = false
  ): void {
    if (dashed) {
      this.drawDashedLineCtx(ctx, x, topY, x, bottomY, color, lineWidth);
    } else {
      this.drawLineCtx(ctx, x, topY, x, bottomY, color, lineWidth);
    }
  }

  /**
   * Draw a horizontal line (commonly used for trigger levels)
   */
  drawHorizontalLine(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    y: number,
    leftX: number,
    rightX: number,
    color: string,
    lineWidth: number = 1,
    dashed: boolean = false
  ): void {
    if (dashed) {
      this.drawDashedLineCtx(ctx, leftX, y, rightX, y, color, lineWidth);
    } else {
      this.drawLineCtx(ctx, leftX, y, rightX, y, color, lineWidth);
    }
  }

  /**
   * Set up canvas defaults
   */
  setupCanvas(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
    // Set default line cap and join for better appearance
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  /**
   * Draw a circle (useful for data points) using context directly
   */
  drawCircleCtx(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    color: string,
    filled: boolean = true,
    lineWidth: number = 1
  ): void {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Draw an oval/ellipse on the canvas
   * For OVAL command in Plot window
   */
  drawOval(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    ry: number,
    filled: boolean,
    color: string,
    lineWidth: number = 1
  ): void {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
    
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Draw a rectangle on the canvas
   * For OBOX command in Plot window
   */
  drawRect(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    filled: boolean,
    color: string,
    lineWidth: number = 1
  ): void {
    const width = x2 - x1;
    const height = y2 - y1;
    
    if (filled) {
      ctx.fillStyle = color;
      ctx.fillRect(x1, y1, width, height);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x1, y1, width, height);
    }
  }

  /**
   * Set canvas opacity
   * For OPACITY command in Plot window
   */
  setOpacity(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, opacity: number): void {
    // Convert from 0-255 range to 0-1 range
    ctx.globalAlpha = opacity / 255;
  }

  /**
   * Draw rotated text on the canvas
   * For TEXTANGLE command in Plot window
   */
  drawRotatedText(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    angle: number,
    color: string,
    fontSize: string = '12px',
    font: string = 'monospace'
  ): void {
    ctx.save();
    
    // Translate to text position
    ctx.translate(x, y);
    
    // Rotate by angle (convert degrees to radians)
    ctx.rotate((angle * Math.PI) / 180);
    
    // Draw text at origin (since we translated)
    ctx.fillStyle = color;
    ctx.font = `${fontSize} ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 0, 0);
    
    ctx.restore();
  }

  /**
   * Legacy method for backward compatibility with Bitmap window
   * Returns JavaScript string for execution
   */
  plotPixelLegacy(canvasId: string, x: number, y: number, color: string): string {
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clip to canvas bounds
      if (${x} < 0 || ${x} >= canvas.width || ${y} < 0 || ${y} >= canvas.height) return;
      
      // Get image data for single pixel
      const imageData = ctx.getImageData(${x}, ${y}, 1, 1);
      const data = imageData.data;
      
      // Parse color hex string
      const color = '${color}';
      const r = parseInt(color.substr(1, 2), 16);
      const g = parseInt(color.substr(3, 2), 16);
      const b = parseInt(color.substr(5, 2), 16);
      
      // Set pixel color
      data[0] = r;
      data[1] = g;
      data[2] = b;
      data[3] = 255; // Full opacity
      
      // Put pixel back
      ctx.putImageData(imageData, ${x}, ${y});
    `;
  }

  /**
   * Legacy method for backward compatibility with Bitmap window
   * Returns JavaScript string for execution
   */
  plotScaledPixelLegacy(
    canvasId: string,
    x: number,
    y: number,
    color: string,
    dotSizeX: number,
    dotSizeY: number
  ): string {
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Calculate scaled position
      const scaledX = ${x} * ${dotSizeX};
      const scaledY = ${y} * ${dotSizeY};
      
      // Clip to canvas bounds
      if (scaledX >= canvas.width || scaledY >= canvas.height) return;
      
      // Set fill color and draw rectangle
      ctx.fillStyle = '${color}';
      ctx.fillRect(scaledX, scaledY, ${dotSizeX}, ${dotSizeY});
    `;
  }

  /**
   * Legacy method for backward compatibility with Bitmap window
   * Returns JavaScript string for execution
   */
  scrollBitmapLegacy(
    canvasId: string,
    scrollX: number,
    scrollY: number,
    canvasWidth: number,
    canvasHeight: number
  ): string {
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Create off-screen canvas for smooth scrolling
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = ${canvasWidth};
      offscreenCanvas.height = ${canvasHeight};
      const offscreenCtx = offscreenCanvas.getContext('2d');
      
      // Copy current canvas content to off-screen canvas
      offscreenCtx.drawImage(canvas, 0, 0);
      
      // Clear the main canvas
      ctx.clearRect(0, 0, ${canvasWidth}, ${canvasHeight});
      
      // Calculate source and destination rectangles for scrolling
      const scrollX = ${scrollX};
      const scrollY = ${scrollY};
      
      // Source rectangle (what part of the image to copy)
      let sx = Math.max(0, -scrollX);
      let sy = Math.max(0, -scrollY);
      let sw = ${canvasWidth} - Math.abs(scrollX);
      let sh = ${canvasHeight} - Math.abs(scrollY);
      
      // Destination rectangle (where to draw it)
      let dx = Math.max(0, scrollX);
      let dy = Math.max(0, scrollY);
      
      // Draw the scrolled content
      if (sw > 0 && sh > 0) {
        ctx.drawImage(offscreenCanvas, sx, sy, sw, sh, dx, dy, sw, sh);
      }
    `;
  }

  /**
   * Legacy method for backward compatibility
   * Alias for plotPixelLegacy
   */
  plotPixel(canvasId: string, x: number, y: number, color: string): string {
    return this.plotPixelLegacy(canvasId, x, y, color);
  }

  /**
   * Legacy method for backward compatibility
   * Alias for plotScaledPixelLegacy
   */
  plotScaledPixel(
    canvasId: string,
    x: number,
    y: number,
    color: string,
    dotSizeX: number,
    dotSizeY: number
  ): string {
    return this.plotScaledPixelLegacy(canvasId, x, y, color, dotSizeX, dotSizeY);
  }

  /**
   * Legacy method for backward compatibility
   * Alias for scrollBitmapLegacy
   */
  scrollBitmap(
    canvasId: string,
    scrollX: number,
    scrollY: number,
    canvasWidth: number,
    canvasHeight: number
  ): string {
    return this.scrollBitmapLegacy(canvasId, scrollX, scrollY, canvasWidth, canvasHeight);
  }
  
  /**
   * Legacy scrollCanvas method for Logic and Scope windows compatibility
   * Converts Logic/Scope parameters to scrollBitmap call
   */
  scrollCanvas(
    canvasId: string,
    scrollSpeed: number,
    canvasWidth: number,
    canvasHeight: number,
    xOffset?: number,
    yOffset?: number
  ): string {
    // Legacy method used negative scrollSpeed for left scrolling
    // Convert to scrollBitmap format: negative scrollSpeed = scroll left
    return this.scrollBitmap(canvasId, -scrollSpeed, 0, canvasWidth, canvasHeight);
  }
  
  /**
   * Legacy drawLine method that returns JavaScript string
   * For compatibility with Logic and Scope windows
   */
  drawLine(
    canvasId: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    lineWidth: number = 1
  ): string {
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.strokeStyle = '${color}';
      ctx.lineWidth = ${lineWidth};
      ctx.beginPath();
      ctx.moveTo(${startX}, ${startY});
      ctx.lineTo(${endX}, ${endY});
      ctx.stroke();
    `;
  }
  
  /**
   * Legacy drawText method that returns JavaScript string
   * For compatibility with Logic and Scope windows
   */
  drawText(
    canvasId: string,
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: string = '12px',
    font: string = 'monospace',
    align: CanvasTextAlign = 'left',
    baseline: CanvasTextBaseline = 'top'
  ): string {
    // Escape quotes in text
    const escapedText = text.replace(/'/g, "\\'")
                          .replace(/"/g, '\\"');
    
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.save();
      ctx.fillStyle = '${color}';
      ctx.font = '${fontSize} ${font}';
      ctx.textAlign = '${align}';
      ctx.textBaseline = '${baseline}';
      ctx.fillText('${escapedText}', ${x}, ${y});
      ctx.restore();
    `;
  }
  
  /**
   * Legacy drawCircle method that returns JavaScript string
   * For compatibility with Logic and Scope windows
   */
  drawCircle(
    canvasId: string,
    centerX: number,
    centerY: number,
    radius: number,
    color: string,
    filled: boolean = true,
    lineWidth: number = 1
  ): string {
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.beginPath();
      ctx.arc(${centerX}, ${centerY}, ${radius}, 0, 2 * Math.PI);
      
      if (${filled}) {
        ctx.fillStyle = '${color}';
        ctx.fill();
      } else {
        ctx.strokeStyle = '${color}';
        ctx.lineWidth = ${lineWidth};
        ctx.stroke();
      }
    `;
  }
  
  /**
   * Legacy drawDashedLine method that returns JavaScript string
   * For compatibility with Logic and Scope windows
   */
  drawDashedLine(
    canvasId: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    lineWidth: number = 1,
    dashPattern: number[] = [5, 5]
  ): string {
    const dashPatternStr = '[' + dashPattern.join(', ') + ']';
    
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.save();
      ctx.strokeStyle = '${color}';
      ctx.lineWidth = ${lineWidth};
      ctx.setLineDash(${dashPatternStr});
      ctx.beginPath();
      ctx.moveTo(${startX}, ${startY});
      ctx.lineTo(${endX}, ${endY});
      ctx.stroke();
      ctx.restore();
    `;
  }
}