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
    return `
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
        }
      }
    `;
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
    
    return `
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
          ctx.moveTo(${centerX - radius}, ${centerY});
          ctx.lineTo(${centerX + radius}, ${centerY});
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(${centerX}, ${centerY - radius});
          ctx.lineTo(${centerX}, ${centerY + radius});
          ctx.stroke();
          
          ctx.restore();
        }
      }
    `;
  }

  /**
   * Generate JavaScript code to clear the rendering area
   * 
   * @param canvasId Canvas element ID
   * @param width Canvas width
   * @param height Canvas height
   * @param backgroundColor Background color RGB value
   * @returns JavaScript code string to execute in browser context
   */
  public clear(canvasId: string, width: number, height: number, backgroundColor: number): string {
    const colorStr = `#${backgroundColor.toString(16).padStart(6, '0')}`;
    
    return `
      const canvas = document.getElementById('${canvasId}');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '${colorStr}';
          ctx.fillRect(0, 0, ${width}, ${height});
        }
      }
    `;
  }
}