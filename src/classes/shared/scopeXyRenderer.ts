/**
 * ScopeXyRenderer - Handles coordinate transformations and rendering for SCOPE_XY display
 * 
 * Provides coordinate transformation methods for cartesian/polar modes with linear/log scaling,
 * point plotting with anti-aliasing, and circular grid rendering matching Pascal implementation.
 * 
 * This class generates JavaScript code strings that can be executed in the browser context
 * through Electron's executeJavaScript method.
 */
export class ScopeXyRenderer {
  private gridColor: number = 0x404040; // Default gray grid

  constructor() {
    // No dependencies needed - we generate JavaScript code strings
  }

  /**
   * Set the grid color
   */
  public setGridColor(color: number): void {
    this.gridColor = color;
  }

  /**
   * Transform cartesian coordinates with optional log scaling
   * Based on Pascal SCOPE_XY_Plot procedure
   * 
   * @param x Input X coordinate
   * @param y Input Y coordinate
   * @param scale Linear scale factor (displayRadius / dataRange)
   * @param logScale Whether to apply log scaling
   * @param range Data range for log calculations
   * @returns Transformed coordinates
   */
  public transformCartesian(
    x: number,
    y: number,
    scale: number,
    logScale: boolean,
    range: number
  ): { x: number; y: number } {
    let transformedX: number;
    let transformedY: number;

    if (logScale) {
      // Pascal: Rf := (Log2(Hypot(x, y) + 1) / Log2(Int64(vRange) + 1)) * (vWidth div 2);
      const r = Math.sqrt(x * x + y * y);
      const rf = (Math.log2(r + 1) / Math.log2(range + 1)) * (1 / scale);
      const theta = Math.atan2(y, x);
      
      transformedX = rf * Math.cos(theta) * scale;
      transformedY = rf * Math.sin(theta) * scale;
    } else {
      // Direct scaling
      transformedX = x * scale;
      transformedY = y * scale;
    }

    return { x: transformedX, y: transformedY };
  }

  /**
   * Transform polar coordinates to cartesian with optional log scaling
   * Based on Pascal SCOPE_XY_Plot procedure
   * 
   * @param radius Input radius (X in polar mode)
   * @param angle Input angle (Y in polar mode)
   * @param twopi Full circle value (default 0x100000000)
   * @param theta Angle offset
   * @param scale Linear scale factor
   * @param logScale Whether to apply log scaling to radius
   * @param range Data range for log calculations
   * @returns Cartesian coordinates
   */
  public transformPolar(
    radius: number,
    angle: number,
    twopi: number,
    theta: number,
    scale: number,
    logScale: boolean,
    range: number
  ): { x: number; y: number } {
    let rf: number;

    if (logScale) {
      // Pascal: if x <> 0 then Rf := (Log2(x) / Log2(vRange)) * (vWidth div 2) else Rf := 0
      if (radius !== 0) {
        rf = (Math.log2(Math.abs(radius)) / Math.log2(range)) * (1 / scale) * scale;
      } else {
        rf = 0;
      }
    } else {
      rf = radius * scale;
    }

    // Pascal: Tf := Pi / 2 - (y + vTheta) / vTwoPi * Pi * 2;
    const tf = Math.PI / 2 - ((angle + theta) / twopi) * Math.PI * 2;
    
    const x = rf * Math.cos(tf);
    const y = rf * Math.sin(tf);

    return { x, y };
  }

  /**
   * Generate JavaScript code to plot a point with anti-aliasing
   * 
   * @param canvasId Canvas element ID
   * @param x Canvas X coordinate
   * @param y Canvas Y coordinate
   * @param color RGB color value
   * @param opacity Opacity (0-255)
   * @param dotSize Dot size in half-pixels (2-20)
   * @returns JavaScript code string to execute in browser context
   */
  public plotPoint(
    canvasId: string,
    x: number,
    y: number,
    color: number,
    opacity: number,
    dotSize: number
  ): string {
    // Convert half-pixels to pixels
    const radius = dotSize / 2;
    
    // Convert color to hex string
    const colorStr = `#${color.toString(16).padStart(6, '0')}`;
    
    // Generate JavaScript code
    return `(() => {
  const canvas = document.getElementById('${canvasId}');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.globalAlpha = ${opacity / 255};
      ctx.fillStyle = '${colorStr}';
      ctx.beginPath();
      ctx.arc(${x}, ${y}, ${radius}, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return 'Point plotted';
    } else {
      return 'No canvas context';
    }
  } else {
    return 'Canvas not found';
  }
})()`;
  }

  /**
   * Generate JavaScript code to draw circular grid
   * Grid consists of concentric circles and radial lines
   * 
   * @param canvasId Canvas element ID
   * @param centerX Center X coordinate
   * @param centerY Center Y coordinate
   * @param radius Grid radius
   * @param divisions Number of radial divisions (default 8)
   * @returns JavaScript code string to execute in browser context
   */
  public drawCircularGrid(
    canvasId: string,
    centerX: number,
    centerY: number,
    radius: number,
    divisions: number = 8
  ): string {
    const colorStr = `#${this.gridColor.toString(16).padStart(6, '0')}`;
    
    return `(() => {
  const canvas = document.getElementById('${canvasId}');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.strokeStyle = '${colorStr}';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;

      // Draw concentric circles
      const circleCount = 4;
      for (let i = 1; i <= circleCount; i++) {
        const r = (${radius} / circleCount) * i;
        ctx.beginPath();
        ctx.arc(${centerX}, ${centerY}, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw radial lines
      for (let i = 0; i < ${divisions}; i++) {
        const angle = (i / ${divisions}) * Math.PI * 2;
        const x = ${centerX} + Math.cos(angle) * ${radius};
        const y = ${centerY} + Math.sin(angle) * ${radius};

        ctx.beginPath();
        ctx.moveTo(${centerX}, ${centerY});
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      // Draw center crosshair
      ctx.globalAlpha = 0.5;

      ctx.beginPath();
      ctx.moveTo(${centerX} - ${radius}, ${centerY});
      ctx.lineTo(${centerX} + ${radius}, ${centerY});
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(${centerX}, ${centerY} - ${radius});
      ctx.lineTo(${centerX}, ${centerY} + ${radius});
      ctx.stroke();

      ctx.restore();
      return 'Grid drawn successfully';
    } else {
      return 'No canvas context';
    }
  } else {
    return 'Canvas not found';
  }
})()`;
  }

  /**
   * Generate JavaScript code to draw channel legends
   *
   * @param canvasId Canvas element ID
   * @param channels Array of channel definitions with names and colors
   * @param textSize Font size in pixels
   * @returns JavaScript code string to execute in browser context
   */
  public drawLegends(
    canvasId: string,
    channels: Array<{ name: string; color: number }>,
    textSize: number = 10,
    canvasSize: number = 256
  ): string {
    if (channels.length === 0) return '(() => "No channels")()';

    const legendCommands: string[] = [];
    const margin = 10;
    const lineHeight = textSize + 4;

    for (let i = 0; i < channels.length && i < 8; i++) {
      if (!channels[i].name) continue; // Skip empty names

      const colorStr = `#${channels[i].color.toString(16).padStart(6, '0')}`;
      const name = channels[i].name;

      // Calculate position based on Pascal logic:
      // Channels 0,1,2,3: Top area
      // Channels 4,5,6,7: Bottom area
      // Even channels (0,2,4,6): Left side
      // Odd channels (1,3,5,7): Right side

      let x: number;
      let y: number;

      // Horizontal position
      if ((i & 2) === 0) {
        // Even channel pairs (0,1 and 4,5): Left side
        x = margin;
      } else {
        // Odd channel pairs (2,3 and 6,7): Right side
        // Very close to edge - just the margin
        x = canvasSize - margin * 2; // Just double the margin from edge
      }

      // Vertical position
      if (i < 4) {
        // Top area
        y = margin + lineHeight;
      } else {
        // Bottom area
        y = canvasSize - margin - lineHeight * 2;
      }

      // Add offset for odd-numbered channels (second line)
      if ((i & 1) !== 0) {
        y += lineHeight;
      }

      legendCommands.push(`
        // Channel ${i}: ${name}
        ctx.fillStyle = '${colorStr}';
        ctx.font = 'bold italic ${textSize}px monospace';
        ctx.fillText('${name}', ${x}, ${y});
      `);
    }

    return `(() => {
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return 'No canvas';
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'No context';

      ctx.save();
      ${legendCommands.join('\n')}
      ctx.restore();

      return 'Legends drawn';
    })()`;
  }

  /**
   * Generate JavaScript code to save current canvas to background
   * This preserves grid/legends for restoration
   *
   * @param canvasId Canvas element ID
   * @returns JavaScript code string to execute in browser context
   */
  public saveBackground(canvasId: string): string {
    return `(() => {
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return 'No canvas';
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'No context';

      // Store the current canvas as background image data
      window.scopeXyBackground = ctx.getImageData(0, 0, canvas.width, canvas.height);

      return 'Background saved';
    })()`;
  }

  /**
   * Generate JavaScript code to restore saved background
   * This quickly restores grid/legends without redrawing
   *
   * @param canvasId Canvas element ID
   * @returns JavaScript code string to execute in browser context
   */
  public restoreBackground(canvasId: string): string {
    return `(() => {
      const canvas = document.getElementById('${canvasId}');
      if (!canvas) return 'No canvas';
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'No context';

      // Restore the saved background if available
      if (window.scopeXyBackground) {
        ctx.putImageData(window.scopeXyBackground, 0, 0);
        return 'Background restored';
      }

      return 'No background to restore';
    })()`;
  }

  /**
   * Generate JavaScript code to clear the entire rendering area
   *
   * @param canvasId Canvas element ID
   * @param width Canvas width
   * @param height Canvas height
   * @param backgroundColor Background color RGB value
   * @returns JavaScript code string to execute in browser context
   */
  public clear(canvasId: string, width: number, height: number, backgroundColor: number): string {
    const colorStr = `#${backgroundColor.toString(16).padStart(6, '0')}`;

    return `(() => {
  const canvas = document.getElementById('${canvasId}');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.fillStyle = '${colorStr}';
      ctx.fillRect(0, 0, ${width}, ${height});
      ctx.restore();
      // Reset context to defaults for next operations
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      return 'Canvas cleared';
    } else {
      return 'No canvas context';
    }
  } else {
    return 'Canvas not found';
  }
})()`;
  }
}