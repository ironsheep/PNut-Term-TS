/** @format */

'use strict';

// src/classes/shared/canvasRenderer.ts

/**
 * CanvasRenderer provides common canvas operations for debug windows
 * Each window creates an instance of this class for its canvas operations
 */
export class CanvasRenderer {
  /**
   * Scroll canvas content horizontally
   * Uses off-screen canvas technique for smooth scrolling
   */
  scrollCanvas(
    canvasId: string,
    scrollSpeed: number,
    canvasWidth: number,
    canvasHeight: number,
    xOffset: number = 0,
    yOffset: number = 0
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
      
      // Draw the off-screen canvas back with horizontal scroll
      ctx.drawImage(
        offscreenCanvas,
        ${scrollSpeed}, 0, ${canvasWidth - scrollSpeed}, ${canvasHeight},
        ${xOffset}, ${yOffset}, ${canvasWidth - scrollSpeed}, ${canvasHeight}
      );
    `;
  }

  /**
   * Draw a solid line on the canvas
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
   * Draw a dashed line on the canvas (useful for grid lines)
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
    const dashPatternStr = `[${dashPattern.join(', ')}]`;
    
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
   * Draw text on the canvas
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
    // Escape the text to prevent JavaScript injection
    const escapedText = text.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
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
   * Clear a rectangular area on the canvas
   */
  clearCanvas(
    canvasId: string,
    x: number = 0,
    y: number = 0,
    width?: number,
    height?: number
  ): string {
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const clearWidth = ${width !== undefined ? width : 'canvas.width'};
      const clearHeight = ${height !== undefined ? height : 'canvas.height'};
      
      ctx.clearRect(${x}, ${y}, clearWidth, clearHeight);
    `;
  }

  /**
   * Fill a rectangular area on the canvas
   */
  fillRect(
    canvasId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string
  ): string {
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.fillStyle = '${color}';
      ctx.fillRect(${x}, ${y}, ${width}, ${height});
    `;
  }

  /**
   * Draw a vertical line (commonly used for triggers and markers)
   */
  drawVerticalLine(
    canvasId: string,
    x: number,
    topY: number,
    bottomY: number,
    color: string,
    lineWidth: number = 1,
    dashed: boolean = false
  ): string {
    if (dashed) {
      return this.drawDashedLine(canvasId, x, topY, x, bottomY, color, lineWidth);
    } else {
      return this.drawLine(canvasId, x, topY, x, bottomY, color, lineWidth);
    }
  }

  /**
   * Draw a horizontal line (commonly used for trigger levels)
   */
  drawHorizontalLine(
    canvasId: string,
    y: number,
    leftX: number,
    rightX: number,
    color: string,
    lineWidth: number = 1,
    dashed: boolean = false
  ): string {
    if (dashed) {
      return this.drawDashedLine(canvasId, leftX, y, rightX, y, color, lineWidth);
    } else {
      return this.drawLine(canvasId, leftX, y, rightX, y, color, lineWidth);
    }
  }

  /**
   * Generate JavaScript to set up a canvas with specific dimensions
   */
  setupCanvas(canvasId: string, width: number, height: number): string {
    return `
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return;
      
      canvas.width = ${width};
      canvas.height = ${height};
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set default line cap and join for better appearance
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    `;
  }

  /**
   * Draw a circle (useful for data points)
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
}