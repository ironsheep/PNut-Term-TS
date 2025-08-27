/** @format */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasRenderer = void 0;
// src/classes/shared/canvasRenderer.ts
/**
 * CanvasRenderer provides common canvas operations for debug windows
 * Each window creates an instance of this class for its canvas operations
 *
 * Modified to work directly with CanvasRenderingContext2D for double buffering support
 */
var CanvasRenderer = /** @class */ (function () {
    function CanvasRenderer() {
    }
    /**
     * Plot a single pixel on the canvas using context
     * Works with bitmap pixels and directly manipulates ImageData
     */
    CanvasRenderer.prototype.plotPixelCtx = function (ctx, x, y, color) {
        // Clip to canvas bounds
        if (x < 0 || x >= ctx.canvas.width || y < 0 || y >= ctx.canvas.height)
            return;
        // Get image data for single pixel
        var imageData = ctx.getImageData(x, y, 1, 1);
        var data = imageData.data;
        // Parse color hex string
        var r = parseInt(color.substr(1, 2), 16);
        var g = parseInt(color.substr(3, 2), 16);
        var b = parseInt(color.substr(5, 2), 16);
        // Set pixel color
        data[0] = r;
        data[1] = g;
        data[2] = b;
        data[3] = 255; // Full opacity
        // Put pixel back
        ctx.putImageData(imageData, x, y);
    };
    /**
     * Plot a scaled pixel (rectangle) on the canvas using context
     * Handles DOTSIZE scaling efficiently using fillRect
     */
    CanvasRenderer.prototype.plotScaledPixelCtx = function (ctx, x, y, color, dotSizeX, dotSizeY) {
        // Calculate scaled position
        var scaledX = x * dotSizeX;
        var scaledY = y * dotSizeY;
        // Clip to canvas bounds
        if (scaledX >= ctx.canvas.width || scaledY >= ctx.canvas.height)
            return;
        // Set fill color and draw rectangle
        ctx.fillStyle = color;
        ctx.fillRect(scaledX, scaledY, dotSizeX, dotSizeY);
    };
    /**
     * Scroll bitmap content in any direction using context
     * Supports all 8 scroll directions from Pascal implementation
     */
    CanvasRenderer.prototype.scrollBitmapCtx = function (ctx, scrollX, scrollY) {
        var canvasWidth = ctx.canvas.width;
        var canvasHeight = ctx.canvas.height;
        // Create off-screen canvas for smooth scrolling
        var offscreenCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
        var offscreenCtx = offscreenCanvas.getContext('2d');
        if (!offscreenCtx)
            return;
        // Copy current canvas content to off-screen canvas
        offscreenCtx.drawImage(ctx.canvas, 0, 0);
        // Clear the main canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        // Calculate source and destination rectangles for scrolling
        // Source rectangle (what part of the image to copy)
        var sx = Math.max(0, -scrollX);
        var sy = Math.max(0, -scrollY);
        var sw = canvasWidth - Math.abs(scrollX);
        var sh = canvasHeight - Math.abs(scrollY);
        // Destination rectangle (where to draw it)
        var dx = Math.max(0, scrollX);
        var dy = Math.max(0, scrollY);
        // Draw the scrolled content
        if (sw > 0 && sh > 0) {
            ctx.drawImage(offscreenCanvas, sx, sy, sw, sh, dx, dy, sw, sh);
        }
    };
    /**
     * Draw a solid line on the canvas using context directly
     */
    CanvasRenderer.prototype.drawLineCtx = function (ctx, startX, startY, endX, endY, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    };
    /**
     * Draw a dashed line on the canvas (useful for grid lines) using context directly
     */
    CanvasRenderer.prototype.drawDashedLineCtx = function (ctx, startX, startY, endX, endY, color, lineWidth, dashPattern) {
        if (lineWidth === void 0) { lineWidth = 1; }
        if (dashPattern === void 0) { dashPattern = [5, 5]; }
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dashPattern);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();
    };
    /**
     * Draw text on the canvas using context directly
     */
    CanvasRenderer.prototype.drawTextCtx = function (ctx, text, x, y, color, fontSize, font, align, baseline) {
        if (fontSize === void 0) { fontSize = '12px'; }
        if (font === void 0) { font = 'monospace'; }
        if (align === void 0) { align = 'left'; }
        if (baseline === void 0) { baseline = 'top'; }
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = "".concat(fontSize, " ").concat(font);
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        ctx.fillText(text, x, y);
        ctx.restore();
    };
    /**
     * Clear a rectangular area on the canvas
     */
    CanvasRenderer.prototype.clearCanvas = function (ctx, x, y, width, height) {
        if (x === void 0) { x = 0; }
        if (y === void 0) { y = 0; }
        var clearWidth = width !== undefined ? width : ctx.canvas.width;
        var clearHeight = height !== undefined ? height : ctx.canvas.height;
        ctx.clearRect(x, y, clearWidth, clearHeight);
    };
    /**
     * Fill a rectangular area on the canvas
     */
    CanvasRenderer.prototype.fillRect = function (ctx, x, y, width, height, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
    };
    /**
     * Draw a vertical line (commonly used for triggers and markers)
     */
    CanvasRenderer.prototype.drawVerticalLine = function (ctx, x, topY, bottomY, color, lineWidth, dashed) {
        if (lineWidth === void 0) { lineWidth = 1; }
        if (dashed === void 0) { dashed = false; }
        if (dashed) {
            this.drawDashedLineCtx(ctx, x, topY, x, bottomY, color, lineWidth);
        }
        else {
            this.drawLineCtx(ctx, x, topY, x, bottomY, color, lineWidth);
        }
    };
    /**
     * Draw a horizontal line (commonly used for trigger levels)
     */
    CanvasRenderer.prototype.drawHorizontalLine = function (ctx, y, leftX, rightX, color, lineWidth, dashed) {
        if (lineWidth === void 0) { lineWidth = 1; }
        if (dashed === void 0) { dashed = false; }
        if (dashed) {
            this.drawDashedLineCtx(ctx, leftX, y, rightX, y, color, lineWidth);
        }
        else {
            this.drawLineCtx(ctx, leftX, y, rightX, y, color, lineWidth);
        }
    };
    /**
     * Set up canvas defaults
     */
    CanvasRenderer.prototype.setupCanvas = function (ctx) {
        // Set default line cap and join for better appearance
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };
    /**
     * Draw a circle (useful for data points) using context directly
     */
    CanvasRenderer.prototype.drawCircleCtx = function (ctx, centerX, centerY, radius, color, filled, lineWidth) {
        if (filled === void 0) { filled = true; }
        if (lineWidth === void 0) { lineWidth = 1; }
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        if (filled) {
            ctx.fillStyle = color;
            ctx.fill();
        }
        else {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    };
    /**
     * Draw an oval/ellipse on the canvas
     * For OVAL command in Plot window
     */
    CanvasRenderer.prototype.drawOval = function (ctx, x, y, rx, ry, filled, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
        if (filled) {
            ctx.fillStyle = color;
            ctx.fill();
        }
        else {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    };
    /**
     * Draw a rectangle on the canvas
     * For OBOX command in Plot window
     */
    CanvasRenderer.prototype.drawRect = function (ctx, x1, y1, x2, y2, filled, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        var width = x2 - x1;
        var height = y2 - y1;
        if (filled) {
            ctx.fillStyle = color;
            ctx.fillRect(x1, y1, width, height);
        }
        else {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(x1, y1, width, height);
        }
    };
    /**
     * Set canvas opacity
     * For OPACITY command in Plot window
     */
    CanvasRenderer.prototype.setOpacity = function (ctx, opacity) {
        // Convert from 0-255 range to 0-1 range
        ctx.globalAlpha = opacity / 255;
    };
    /**
     * Draw rotated text on the canvas
     * For TEXTANGLE command in Plot window
     */
    CanvasRenderer.prototype.drawRotatedText = function (ctx, text, x, y, angle, color, fontSize, font) {
        if (fontSize === void 0) { fontSize = '12px'; }
        if (font === void 0) { font = 'monospace'; }
        ctx.save();
        // Translate to text position
        ctx.translate(x, y);
        // Rotate by angle (convert degrees to radians)
        ctx.rotate((angle * Math.PI) / 180);
        // Draw text at origin (since we translated)
        ctx.fillStyle = color;
        ctx.font = "".concat(fontSize, " ").concat(font);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, 0, 0);
        ctx.restore();
    };
    /**
     * Legacy method for backward compatibility with Bitmap window
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.plotPixelLegacy = function (canvasId, x, y, color) {
        return "\n      const canvas = document.getElementById('".concat(canvasId, "');\n      if (!canvas) return;\n      \n      const ctx = canvas.getContext('2d');\n      if (!ctx) return;\n      \n      // Clip to canvas bounds\n      if (").concat(x, " < 0 || ").concat(x, " >= canvas.width || ").concat(y, " < 0 || ").concat(y, " >= canvas.height) return;\n      \n      // Get image data for single pixel\n      const imageData = ctx.getImageData(").concat(x, ", ").concat(y, ", 1, 1);\n      const data = imageData.data;\n      \n      // Parse color hex string\n      const color = '").concat(color, "';\n      const r = parseInt(color.substr(1, 2), 16);\n      const g = parseInt(color.substr(3, 2), 16);\n      const b = parseInt(color.substr(5, 2), 16);\n      \n      // Set pixel color\n      data[0] = r;\n      data[1] = g;\n      data[2] = b;\n      data[3] = 255; // Full opacity\n      \n      // Put pixel back\n      ctx.putImageData(imageData, ").concat(x, ", ").concat(y, ");\n    ");
    };
    /**
     * Legacy method for backward compatibility with Bitmap window
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.plotScaledPixelLegacy = function (canvasId, x, y, color, dotSizeX, dotSizeY) {
        return "\n      const canvas = document.getElementById('".concat(canvasId, "');\n      if (!canvas) return;\n      \n      const ctx = canvas.getContext('2d');\n      if (!ctx) return;\n      \n      // Calculate scaled position\n      const scaledX = ").concat(x, " * ").concat(dotSizeX, ";\n      const scaledY = ").concat(y, " * ").concat(dotSizeY, ";\n      \n      // Clip to canvas bounds\n      if (scaledX >= canvas.width || scaledY >= canvas.height) return;\n      \n      // Set fill color and draw rectangle\n      ctx.fillStyle = '").concat(color, "';\n      ctx.fillRect(scaledX, scaledY, ").concat(dotSizeX, ", ").concat(dotSizeY, ");\n    ");
    };
    /**
     * Legacy method for backward compatibility with Bitmap window
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.scrollBitmapLegacy = function (canvasId, scrollX, scrollY, canvasWidth, canvasHeight) {
        return "\n      const canvas = document.getElementById('".concat(canvasId, "');\n      if (!canvas) return;\n      \n      const ctx = canvas.getContext('2d');\n      if (!ctx) return;\n      \n      // Create off-screen canvas for smooth scrolling\n      const offscreenCanvas = document.createElement('canvas');\n      offscreenCanvas.width = ").concat(canvasWidth, ";\n      offscreenCanvas.height = ").concat(canvasHeight, ";\n      const offscreenCtx = offscreenCanvas.getContext('2d');\n      \n      // Copy current canvas content to off-screen canvas\n      offscreenCtx.drawImage(canvas, 0, 0);\n      \n      // Clear the main canvas\n      ctx.clearRect(0, 0, ").concat(canvasWidth, ", ").concat(canvasHeight, ");\n      \n      // Calculate source and destination rectangles for scrolling\n      const scrollX = ").concat(scrollX, ";\n      const scrollY = ").concat(scrollY, ";\n      \n      // Source rectangle (what part of the image to copy)\n      let sx = Math.max(0, -scrollX);\n      let sy = Math.max(0, -scrollY);\n      let sw = ").concat(canvasWidth, " - Math.abs(scrollX);\n      let sh = ").concat(canvasHeight, " - Math.abs(scrollY);\n      \n      // Destination rectangle (where to draw it)\n      let dx = Math.max(0, scrollX);\n      let dy = Math.max(0, scrollY);\n      \n      // Draw the scrolled content\n      if (sw > 0 && sh > 0) {\n        ctx.drawImage(offscreenCanvas, sx, sy, sw, sh, dx, dy, sw, sh);\n      }\n    ");
    };
    /**
     * Legacy method for backward compatibility
     * Alias for plotPixelLegacy
     */
    CanvasRenderer.prototype.plotPixel = function (canvasId, x, y, color) {
        return this.plotPixelLegacy(canvasId, x, y, color);
    };
    /**
     * Legacy method for backward compatibility
     * Alias for plotScaledPixelLegacy
     */
    CanvasRenderer.prototype.plotScaledPixel = function (canvasId, x, y, color, dotSizeX, dotSizeY) {
        return this.plotScaledPixelLegacy(canvasId, x, y, color, dotSizeX, dotSizeY);
    };
    /**
     * Legacy method for backward compatibility
     * Alias for scrollBitmapLegacy
     */
    CanvasRenderer.prototype.scrollBitmap = function (canvasId, scrollX, scrollY, canvasWidth, canvasHeight) {
        return this.scrollBitmapLegacy(canvasId, scrollX, scrollY, canvasWidth, canvasHeight);
    };
    /**
     * Legacy scrollCanvas method for Logic and Scope windows compatibility
     * Converts Logic/Scope parameters to scrollBitmap call
     */
    CanvasRenderer.prototype.scrollCanvas = function (canvasId, scrollSpeed, canvasWidth, canvasHeight, xOffset, yOffset) {
        // Legacy method used negative scrollSpeed for left scrolling
        // Convert to scrollBitmap format: negative scrollSpeed = scroll left
        return this.scrollBitmap(canvasId, -scrollSpeed, 0, canvasWidth, canvasHeight);
    };
    /**
     * Legacy drawLine method that returns JavaScript string
     * For compatibility with Logic and Scope windows
     */
    CanvasRenderer.prototype.drawLine = function (canvasId, startX, startY, endX, endY, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        return "\n      const canvas = document.getElementById('".concat(canvasId, "');\n      if (!canvas) return;\n      \n      const ctx = canvas.getContext('2d');\n      if (!ctx) return;\n      \n      ctx.strokeStyle = '").concat(color, "';\n      ctx.lineWidth = ").concat(lineWidth, ";\n      ctx.beginPath();\n      ctx.moveTo(").concat(startX, ", ").concat(startY, ");\n      ctx.lineTo(").concat(endX, ", ").concat(endY, ");\n      ctx.stroke();\n    ");
    };
    /**
     * Legacy drawText method that returns JavaScript string
     * For compatibility with Logic and Scope windows
     */
    CanvasRenderer.prototype.drawText = function (canvasId, text, x, y, color, fontSize, font, align, baseline) {
        if (fontSize === void 0) { fontSize = '12px'; }
        if (font === void 0) { font = 'monospace'; }
        if (align === void 0) { align = 'left'; }
        if (baseline === void 0) { baseline = 'top'; }
        // Escape quotes in text
        var escapedText = text.replace(/'/g, "\\'")
            .replace(/"/g, '\\"');
        return "\n      const canvas = document.getElementById('".concat(canvasId, "');\n      if (!canvas) return;\n      \n      const ctx = canvas.getContext('2d');\n      if (!ctx) return;\n      \n      ctx.save();\n      ctx.fillStyle = '").concat(color, "';\n      ctx.font = '").concat(fontSize, " ").concat(font, "';\n      ctx.textAlign = '").concat(align, "';\n      ctx.textBaseline = '").concat(baseline, "';\n      ctx.fillText('").concat(escapedText, "', ").concat(x, ", ").concat(y, ");\n      ctx.restore();\n    ");
    };
    /**
     * Legacy drawCircle method that returns JavaScript string
     * For compatibility with Logic and Scope windows
     */
    CanvasRenderer.prototype.drawCircle = function (canvasId, centerX, centerY, radius, color, filled, lineWidth) {
        if (filled === void 0) { filled = true; }
        if (lineWidth === void 0) { lineWidth = 1; }
        return "\n      const canvas = document.getElementById('".concat(canvasId, "');\n      if (!canvas) return;\n      \n      const ctx = canvas.getContext('2d');\n      if (!ctx) return;\n      \n      ctx.beginPath();\n      ctx.arc(").concat(centerX, ", ").concat(centerY, ", ").concat(radius, ", 0, 2 * Math.PI);\n      \n      if (").concat(filled, ") {\n        ctx.fillStyle = '").concat(color, "';\n        ctx.fill();\n      } else {\n        ctx.strokeStyle = '").concat(color, "';\n        ctx.lineWidth = ").concat(lineWidth, ";\n        ctx.stroke();\n      }\n    ");
    };
    /**
     * Legacy drawDashedLine method that returns JavaScript string
     * For compatibility with Logic and Scope windows
     */
    CanvasRenderer.prototype.drawDashedLine = function (canvasId, startX, startY, endX, endY, color, lineWidth, dashPattern) {
        if (lineWidth === void 0) { lineWidth = 1; }
        if (dashPattern === void 0) { dashPattern = [5, 5]; }
        var dashPatternStr = '[' + dashPattern.join(', ') + ']';
        return "\n      const canvas = document.getElementById('".concat(canvasId, "');\n      if (!canvas) return;\n      \n      const ctx = canvas.getContext('2d');\n      if (!ctx) return;\n      \n      ctx.save();\n      ctx.strokeStyle = '").concat(color, "';\n      ctx.lineWidth = ").concat(lineWidth, ";\n      ctx.setLineDash(").concat(dashPatternStr, ");\n      ctx.beginPath();\n      ctx.moveTo(").concat(startX, ", ").concat(startY, ");\n      ctx.lineTo(").concat(endX, ", ").concat(endY, ");\n      ctx.stroke();\n      ctx.restore();\n    ");
    };
    /**
     * Draw a rounded rectangle directly on context (for MIDI window)
     * Used for piano keys with rounded corners
     */
    CanvasRenderer.prototype.drawRoundedRectCtx = function (ctx, x, y, width, height, radius, filled, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
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
        }
        else {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    };
    /**
     * Draw a polygon (for POLY command in Plot window)
     */
    CanvasRenderer.prototype.drawPolygon = function (ctx, centerX, centerY, sides, radius, filled, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        ctx.beginPath();
        for (var i = 0; i < sides; i++) {
            var angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
            var x = centerX + radius * Math.cos(angle);
            var y = centerY + radius * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        if (filled) {
            ctx.fillStyle = color;
            ctx.fill();
        }
        else {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    };
    /**
     * Draw an arc (for ARC command in Plot window)
     */
    CanvasRenderer.prototype.drawArc = function (ctx, centerX, centerY, rx, ry, startAngle, endAngle, filled, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, rx, ry, 0, (startAngle * Math.PI) / 180, (endAngle * Math.PI) / 180, false);
        if (filled) {
            ctx.lineTo(centerX, centerY);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        }
        else {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    };
    /**
     * Draw a triangle (for TRI command in Plot window)
     */
    CanvasRenderer.prototype.drawTriangle = function (ctx, x1, y1, x2, y2, x3, y3, filled, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        if (filled) {
            ctx.fillStyle = color;
            ctx.fill();
        }
        else {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    };
    /**
     * Draw a Bezier curve (for BEZIER command in Plot window)
     */
    CanvasRenderer.prototype.drawBezier = function (ctx, x0, y0, x1, y1, x2, y2, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x1, y1, x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    };
    /**
     * Flood fill algorithm (for FLOOD command in Plot window)
     * Note: This is a simplified implementation
     */
    CanvasRenderer.prototype.floodFill = function (ctx, x, y, fillColor) {
        // Convert fill color to RGBA
        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1;
        tempCanvas.height = 1;
        var tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx)
            return;
        tempCtx.fillStyle = fillColor;
        tempCtx.fillRect(0, 0, 1, 1);
        var fillData = tempCtx.getImageData(0, 0, 1, 1).data;
        // Get canvas image data
        var imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        var data = imageData.data;
        var width = imageData.width;
        var height = imageData.height;
        // Get target color
        var targetIndex = (y * width + x) * 4;
        var targetR = data[targetIndex];
        var targetG = data[targetIndex + 1];
        var targetB = data[targetIndex + 2];
        var targetA = data[targetIndex + 3];
        // Check if target color is same as fill color
        if (targetR === fillData[0] && targetG === fillData[1] &&
            targetB === fillData[2] && targetA === fillData[3]) {
            return;
        }
        // Simple flood fill using a stack
        var stack = [[x, y]];
        while (stack.length > 0) {
            var _a = stack.pop(), cx = _a[0], cy = _a[1];
            if (cx < 0 || cx >= width || cy < 0 || cy >= height)
                continue;
            var index = (cy * width + cx) * 4;
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
    };
    /**
     * Draw grid lines (for Logic and Scope windows)
     */
    CanvasRenderer.prototype.drawGrid = function (ctx, width, height, gridSpacingX, gridSpacingY, gridColor, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        ctx.save();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([2, 2]);
        // Vertical lines
        for (var x = gridSpacingX; x < width; x += gridSpacingX) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        // Horizontal lines
        for (var y = gridSpacingY; y < height; y += gridSpacingY) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.restore();
    };
    /**
     * Draw waveform connecting sample points (for Scope window)
     */
    CanvasRenderer.prototype.drawWaveform = function (ctx, samples, xStart, xSpacing, yScale, yOffset, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        if (samples.length === 0)
            return;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        for (var i = 0; i < samples.length; i++) {
            var x = xStart + i * xSpacing;
            var y = yOffset - samples[i] * yScale;
            if (i === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    };
    /**
     * Draw a character for Terminal Window
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.drawCharacter = function (canvasId, char, x, y, charWidth, lineHeight, baseline, font, fgColor, bgColor) {
        // Escape the character for JavaScript
        var escapedChar = char.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\\/g, '\\\\');
        return "\n      (function() {\n        const canvas = document.getElementById('".concat(canvasId, "');\n        if (canvas && canvas instanceof HTMLCanvasElement) {\n          const ctx = canvas.getContext('2d');\n          if (ctx) {\n            // Clear character cell with background color\n            ctx.fillStyle = '").concat(bgColor, "';\n            ctx.fillRect(").concat(x, ", ").concat(y, ", ").concat(charWidth, ", ").concat(lineHeight, ");\n            \n            // Draw character\n            ctx.font = '").concat(font, "';\n            ctx.fillStyle = '").concat(fgColor, "';\n            ctx.textAlign = 'left';\n            ctx.textBaseline = 'alphabetic';\n            ctx.fillText('").concat(escapedChar, "', ").concat(x, ", ").concat(y + baseline, ");\n          }\n        }\n      })();\n    ");
    };
    /**
     * Clear a character cell for Terminal Window
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.clearCharacterCell = function (canvasId, x, y, width, height, bgColor) {
        return "\n      (function() {\n        const canvas = document.getElementById('".concat(canvasId, "');\n        if (canvas && canvas instanceof HTMLCanvasElement) {\n          const ctx = canvas.getContext('2d');\n          if (ctx) {\n            ctx.fillStyle = '").concat(bgColor, "';\n            ctx.fillRect(").concat(x, ", ").concat(y, ", ").concat(width, ", ").concat(height, ");\n          }\n        }\n      })();\n    ");
    };
    /**
     * Clear entire canvas and fill with background color
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.clearCanvasWithBackground = function (canvasId, bgColor) {
        return "\n      (function() {\n        const canvas = document.getElementById('".concat(canvasId, "');\n        if (canvas && canvas instanceof HTMLCanvasElement) {\n          const ctx = canvas.getContext('2d');\n          if (ctx) {\n            // Clear the entire canvas\n            ctx.clearRect(0, 0, canvas.width, canvas.height);\n            \n            // Fill canvas with background color\n            ctx.fillStyle = '").concat(bgColor, "';\n            ctx.fillRect(0, 0, canvas.width, canvas.height);\n          }\n        }\n      })();\n    ");
    };
    /**
     * Legacy methods for windows that haven't been refactored yet
     * These return JavaScript strings for execution via executeJavaScript
     */
    /**
     * Draw rounded rectangle (legacy method for MIDI window)
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.drawRoundedRect = function (canvasId, x, y, width, height, radius, filled, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        return "\n      (function() {\n        const canvas = document.getElementById('".concat(canvasId, "');\n        if (!canvas) return;\n        \n        const ctx = canvas.getContext('2d');\n        if (!ctx) return;\n        \n        ctx.beginPath();\n        ctx.moveTo(").concat(x, " + ").concat(radius, ", ").concat(y, ");\n        ctx.lineTo(").concat(x, " + ").concat(width, " - ").concat(radius, ", ").concat(y, ");\n        ctx.quadraticCurveTo(").concat(x, " + ").concat(width, ", ").concat(y, ", ").concat(x, " + ").concat(width, ", ").concat(y, " + ").concat(radius, ");\n        ctx.lineTo(").concat(x, " + ").concat(width, ", ").concat(y, " + ").concat(height, " - ").concat(radius, ");\n        ctx.quadraticCurveTo(").concat(x, " + ").concat(width, ", ").concat(y, " + ").concat(height, ", ").concat(x, " + ").concat(width, " - ").concat(radius, ", ").concat(y, " + ").concat(height, ");\n        ctx.lineTo(").concat(x, " + ").concat(radius, ", ").concat(y, " + ").concat(height, ");\n        ctx.quadraticCurveTo(").concat(x, ", ").concat(y, " + ").concat(height, ", ").concat(x, ", ").concat(y, " + ").concat(height, " - ").concat(radius, ");\n        ctx.lineTo(").concat(x, ", ").concat(y, " + ").concat(radius, ");\n        ctx.quadraticCurveTo(").concat(x, ", ").concat(y, ", ").concat(x, " + ").concat(radius, ", ").concat(y, ");\n        ctx.closePath();\n        \n        if (").concat(filled, ") {\n          ctx.fillStyle = '").concat(color, "';\n          ctx.fill();\n        } else {\n          ctx.strokeStyle = '").concat(color, "';\n          ctx.lineWidth = ").concat(lineWidth, ";\n          ctx.stroke();\n        }\n      })();\n    ");
    };
    /**
     * Draw grid lines (legacy method for Logic window)
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.drawGridLines = function (canvasId, width, height, gridSpacingX, gridSpacingY, gridColor, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        return "\n      (function() {\n        const canvas = document.getElementById('".concat(canvasId, "');\n        if (!canvas) return;\n        \n        const ctx = canvas.getContext('2d');\n        if (!ctx) return;\n        \n        ctx.save();\n        ctx.strokeStyle = '").concat(gridColor, "';\n        ctx.lineWidth = ").concat(lineWidth, ";\n        ctx.setLineDash([2, 2]);\n        \n        // Vertical lines\n        for (let x = ").concat(gridSpacingX, "; x < ").concat(width, "; x += ").concat(gridSpacingX, ") {\n          ctx.beginPath();\n          ctx.moveTo(x, 0);\n          ctx.lineTo(x, ").concat(height, ");\n          ctx.stroke();\n        }\n        \n        // Horizontal lines\n        for (let y = ").concat(gridSpacingY, "; y < ").concat(height, "; y += ").concat(gridSpacingY, ") {\n          ctx.beginPath();\n          ctx.moveTo(0, y);\n          ctx.lineTo(").concat(width, ", y);\n          ctx.stroke();\n        }\n        \n        ctx.restore();\n      })();\n    ");
    };
    /**
     * Update innerHTML of an element (for Logic window labels)
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.updateElementHTML = function (elementId, htmlContent) {
        // Escape quotes in HTML content
        var escapedHTML = htmlContent.replace(/'/g, "\\'");
        return "\n      (function() {\n        const element = document.getElementById('".concat(elementId, "');\n        if (element) {\n          element.innerHTML = '").concat(escapedHTML, "';\n        }\n      })();\n    ");
    };
    /**
     * Draw connected line segments (for Logic window sample display)
     * Returns JavaScript string for execution
     */
    CanvasRenderer.prototype.drawConnectedLines = function (canvasId, points, color, lineWidth) {
        if (lineWidth === void 0) { lineWidth = 1; }
        if (points.length === 0)
            return '';
        var pathCommands = '';
        points.forEach(function (point, index) {
            if (index === 0) {
                pathCommands += "ctx.moveTo(".concat(point.x, ", ").concat(point.y, ");\n");
            }
            else {
                pathCommands += "ctx.lineTo(".concat(point.x, ", ").concat(point.y, ");\n");
            }
        });
        return "\n      (function() {\n        const canvas = document.getElementById('".concat(canvasId, "');\n        if (!canvas) return;\n        \n        const ctx = canvas.getContext('2d');\n        if (!ctx) return;\n        \n        ctx.strokeStyle = '").concat(color, "';\n        ctx.lineWidth = ").concat(lineWidth, ";\n        ctx.beginPath();\n        ").concat(pathCommands, "\n        ctx.stroke();\n      })();\n    ");
    };
    return CanvasRenderer;
}());
exports.CanvasRenderer = CanvasRenderer;
