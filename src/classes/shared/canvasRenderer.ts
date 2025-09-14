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
      (function() {
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
      // Note: scrollX and scrollY are the amounts to scroll

      // Source rectangle (what part of the image to copy)
      let sx = Math.max(0, -${scrollX});
      let sy = Math.max(0, -${scrollY});
      let sw = ${canvasWidth} - Math.abs(${scrollX});
      let sh = ${canvasHeight} - Math.abs(${scrollY});

      // Destination rectangle (where to draw it)
      let dx = Math.max(0, ${scrollX});
      let dy = Math.max(0, ${scrollY});
      
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
    // Validate parameters to prevent invalid JavaScript generation
    if (!isFinite(startX) || !isFinite(startY) || !isFinite(endX) || !isFinite(endY) || !isFinite(lineWidth)) {
      console.error(`Invalid drawLine parameters: startX=${startX}, startY=${startY}, endX=${endX}, endY=${endY}, lineWidth=${lineWidth}`);
      return '// Invalid parameters - skipping draw';
    }
    
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
    // Validate parameters to prevent invalid JavaScript generation
    if (!isFinite(x) || !isFinite(y)) {
      console.error(`Invalid drawText parameters: x=${x}, y=${y}`);
      return '// Invalid parameters - skipping text draw';
    }
    
    // Escape quotes in text
    const escapedText = text.replace(/'/g, "\\'")
                          .replace(/"/g, '\\"');
    
    return `
      (function() {
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
      })();
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
    // Validate parameters to prevent invalid JavaScript generation
    if (!isFinite(startX) || !isFinite(startY) || !isFinite(endX) || !isFinite(endY) || !isFinite(lineWidth)) {
      console.error(`Invalid drawDashedLine parameters: startX=${startX}, startY=${startY}, endX=${endX}, endY=${endY}, lineWidth=${lineWidth}`);
      return '// Invalid parameters - skipping dashed line draw';
    }
    
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

  /**
   * Draw a rounded rectangle directly on context (for MIDI window)
   * Used for piano keys with rounded corners
   */
  drawRoundedRectCtx(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    filled: boolean,
    color: string,
    lineWidth: number = 1
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    
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
   * Draw a polygon (for POLY command in Plot window)
   */
  drawPolygon(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    sides: number,
    radius: number,
    filled: boolean,
    color: string,
    lineWidth: number = 1
  ): void {
    ctx.beginPath();
    
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    
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
   * Draw an arc (for ARC command in Plot window)
   */
  drawArc(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    rx: number,
    ry: number,
    startAngle: number,
    endAngle: number,
    filled: boolean,
    color: string,
    lineWidth: number = 1
  ): void {
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, rx, ry, 0, 
      (startAngle * Math.PI) / 180,
      (endAngle * Math.PI) / 180,
      false
    );
    
    if (filled) {
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Draw a triangle (for TRI command in Plot window)
   */
  drawTriangle(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    filled: boolean,
    color: string,
    lineWidth: number = 1
  ): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    
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
   * Draw a Bezier curve (for BEZIER command in Plot window)
   */
  drawBezier(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lineWidth: number = 1
  ): void {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x1, y1, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /**
   * Flood fill algorithm (for FLOOD command in Plot window)
   * Note: This is a simplified implementation
   */
  floodFill(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    fillColor: string
  ): void {
    // Convert fill color to RGBA
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.fillStyle = fillColor;
    tempCtx.fillRect(0, 0, 1, 1);
    const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
    
    // Get canvas image data
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Get target color
    const targetIndex = (y * width + x) * 4;
    const targetR = data[targetIndex];
    const targetG = data[targetIndex + 1];
    const targetB = data[targetIndex + 2];
    const targetA = data[targetIndex + 3];
    
    // Check if target color is same as fill color
    if (targetR === fillData[0] && targetG === fillData[1] && 
        targetB === fillData[2] && targetA === fillData[3]) {
      return;
    }
    
    // Simple flood fill using a stack
    const stack: [number, number][] = [[x, y]];
    
    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
      
      const index = (cy * width + cx) * 4;
      
      // Check if this pixel matches target color
      if (data[index] === targetR && data[index + 1] === targetG &&
          data[index + 2] === targetB && data[index + 3] === targetA) {
        // Fill this pixel
        data[index] = fillData[0];
        data[index + 1] = fillData[1];
        data[index + 2] = fillData[2];
        data[index + 3] = fillData[3];
        
        // Add neighbors to stack
        stack.push([cx + 1, cy]);
        stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]);
        stack.push([cx, cy - 1]);
      }
    }
    
    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Draw grid lines (for Logic and Scope windows)
   */
  drawGrid(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    gridSpacingX: number,
    gridSpacingY: number,
    gridColor: string,
    lineWidth: number = 1
  ): void {
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([2, 2]);
    
    // Vertical lines
    for (let x = gridSpacingX; x < width; x += gridSpacingX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = gridSpacingY; y < height; y += gridSpacingY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  /**
   * Draw waveform connecting sample points (for Scope window)
   */
  drawWaveform(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    samples: number[],
    xStart: number,
    xSpacing: number,
    yScale: number,
    yOffset: number,
    color: string,
    lineWidth: number = 1
  ): void {
    if (samples.length === 0) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    
    for (let i = 0; i < samples.length; i++) {
      const x = xStart + i * xSpacing;
      const y = yOffset - samples[i] * yScale;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
  }

  /**
   * Draw a character for Terminal Window
   * Returns JavaScript string for execution
   */
  drawCharacter(
    canvasId: string,
    char: string,
    x: number,
    y: number,
    charWidth: number,
    lineHeight: number,
    baseline: number,
    font: string,
    fgColor: string,
    bgColor: string
  ): string {
    // Escape the character for JavaScript
    const escapedChar = char.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    
    return `
      (function() {
        const canvas = document.getElementById('${canvasId}');
        if (canvas && canvas instanceof HTMLCanvasElement) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Clear character cell with background color
            ctx.fillStyle = '${bgColor}';
            ctx.fillRect(${x}, ${y}, ${charWidth}, ${lineHeight});
            
            // Draw character
            ctx.font = '${font}';
            ctx.fillStyle = '${fgColor}';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('${escapedChar}', ${x}, ${y + baseline});
          }
        }
      })();
    `;
  }

  /**
   * Clear a character cell for Terminal Window
   * Returns JavaScript string for execution
   */
  clearCharacterCell(
    canvasId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    bgColor: string
  ): string {
    return `
      (function() {
        const canvas = document.getElementById('${canvasId}');
        if (canvas && canvas instanceof HTMLCanvasElement) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '${bgColor}';
            ctx.fillRect(${x}, ${y}, ${width}, ${height});
          }
        }
      })();
    `;
  }

  /**
   * Clear entire canvas and fill with background color
   * Returns JavaScript string for execution
   */
  clearCanvasWithBackground(
    canvasId: string,
    bgColor: string
  ): string {
    return `
      (function() {
        const canvas = document.getElementById('${canvasId}');
        if (canvas && canvas instanceof HTMLCanvasElement) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Clear the entire canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Fill canvas with background color
            ctx.fillStyle = '${bgColor}';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      })();
    `;
  }

  /**
   * Legacy methods for windows that haven't been refactored yet
   * These return JavaScript strings for execution via executeJavaScript
   */
  
  /**
   * Draw rounded rectangle (legacy method for MIDI window)
   * Returns JavaScript string for execution
   */
  drawRoundedRect(
    canvasId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    filled: boolean,
    color: string,
    lineWidth: number = 1
  ): string {
    return `
      (function() {
        const canvas = document.getElementById('${canvasId}');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.beginPath();
        ctx.moveTo(${x} + ${radius}, ${y});
        ctx.lineTo(${x} + ${width} - ${radius}, ${y});
        ctx.quadraticCurveTo(${x} + ${width}, ${y}, ${x} + ${width}, ${y} + ${radius});
        ctx.lineTo(${x} + ${width}, ${y} + ${height} - ${radius});
        ctx.quadraticCurveTo(${x} + ${width}, ${y} + ${height}, ${x} + ${width} - ${radius}, ${y} + ${height});
        ctx.lineTo(${x} + ${radius}, ${y} + ${height});
        ctx.quadraticCurveTo(${x}, ${y} + ${height}, ${x}, ${y} + ${height} - ${radius});
        ctx.lineTo(${x}, ${y} + ${radius});
        ctx.quadraticCurveTo(${x}, ${y}, ${x} + ${radius}, ${y});
        ctx.closePath();
        
        if (${filled}) {
          ctx.fillStyle = '${color}';
          ctx.fill();
        } else {
          ctx.strokeStyle = '${color}';
          ctx.lineWidth = ${lineWidth};
          ctx.stroke();
        }
      })();
    `;
  }

  /**
   * Draw grid lines (legacy method for Logic window)
   * Returns JavaScript string for execution
   */
  drawGridLines(
    canvasId: string,
    width: number,
    height: number,
    gridSpacingX: number,
    gridSpacingY: number,
    gridColor: string,
    lineWidth: number = 1
  ): string {
    return `
      (function() {
        const canvas = document.getElementById('${canvasId}');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.save();
        ctx.strokeStyle = '${gridColor}';
        ctx.lineWidth = ${lineWidth};
        ctx.setLineDash([2, 2]);
        
        // Vertical lines
        for (let x = ${gridSpacingX}; x < ${width}; x += ${gridSpacingX}) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, ${height});
          ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = ${gridSpacingY}; y < ${height}; y += ${gridSpacingY}) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(${width}, y);
          ctx.stroke();
        }
        
        ctx.restore();
      })();
    `;
  }

  /**
   * Update innerHTML of an element (for Logic window labels)
   * Returns JavaScript string for execution
   */
  updateElementHTML(
    elementId: string,
    htmlContent: string
  ): string {
    // Properly escape all special characters for JavaScript string literal
    // Remove any CR/LF characters that could break the string
    const cleanedHTML = htmlContent.replace(/[\r\n]/g, '');
    // Escape backslashes first, then quotes
    const escapedHTML = cleanedHTML
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/'/g, "\\'")    // Escape single quotes
      .replace(/"/g, '\\"');   // Escape double quotes
    
    return `
      (function() {
        const element = document.getElementById('${elementId}');
        if (element) {
          element.innerHTML = '${escapedHTML}';
        }
      })();
    `;
  }

  /**
   * Draw connected line segments (for Logic window sample display)
   * Returns JavaScript string for execution
   */
  drawConnectedLines(
    canvasId: string,
    points: Array<{x: number, y: number}>,
    color: string,
    lineWidth: number = 1
  ): string {
    if (points.length === 0) return '';
    
    let pathCommands = '';
    points.forEach((point, index) => {
      if (index === 0) {
        pathCommands += `ctx.moveTo(${point.x}, ${point.y});\n`;
      } else {
        pathCommands += `ctx.lineTo(${point.x}, ${point.y});\n`;
      }
    });
    
    return `
      (function() {
        const canvas = document.getElementById('${canvasId}');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.strokeStyle = '${color}';
        ctx.lineWidth = ${lineWidth};
        ctx.beginPath();
        ${pathCommands}
        ctx.stroke();
      })();
    `;
  }
}