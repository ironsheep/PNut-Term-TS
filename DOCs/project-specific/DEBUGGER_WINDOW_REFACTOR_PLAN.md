# Debugger Window Refactor Plan

## Overview
Refactor the DebugDebuggerWindow to use the same CanvasRenderer pattern as other debug windows (ScopeWin, BitmapWin, etc.) for consistency and maintainability.

## Current State Analysis

### Problem
- DebuggerWindow uses direct canvas manipulation in `executeJavaScript()` blocks
- Other debug windows use shared `CanvasRenderer` class with a consistent pattern
- Initial concern about "canvas not available in main process" was incorrect - all debug windows are renderer processes

### Solution
- Adopt the same pattern: Use CanvasRenderer to generate JavaScript strings, batch them, execute via `webContents.executeJavaScript()`
- No IPC proxy needed - window already has canvas access

## Implementation Phases

### PHASE 1: PREPARATION
**Goal**: Set up CanvasRenderer infrastructure

1. **Add CanvasRenderer import and instance**
   ```typescript
   import { CanvasRenderer } from './shared/canvasRenderer';
   private canvasRenderer: CanvasRenderer;
   // In constructor:
   this.canvasRenderer = new CanvasRenderer();
   ```

2. **Create helper methods for coordinate conversion**
   ```typescript
   private gridToPixel(gridX: number, gridY: number): {x: number, y: number} {
     return {
       x: gridX * this.charWidth,  // charWidth = 8
       y: gridY * this.charHeight  // charHeight = 16
     };
   }
   
   private colorToHex(debugColor: number): string {
     return '#' + debugColor.toString(16).padStart(6, '0');
   }
   ```

### PHASE 2: WRAPPER METHODS
**Goal**: Create methods that generate JavaScript strings (not execute)

```typescript
private drawTextJs(text: string, gridX: number, gridY: number, 
                   fgColor: number, bgColor?: number): string {
  const {x, y} = this.gridToPixel(gridX, gridY);
  const fgHex = this.colorToHex(fgColor);
  const commands = [];
  
  if (bgColor !== undefined) {
    const bgHex = this.colorToHex(bgColor);
    commands.push(`ctx.fillStyle='${bgHex}';ctx.fillRect(${x},${y},${text.length*8},16);`);
  }
  
  commands.push(`ctx.fillStyle='${fgHex}';ctx.font='14px Parallax,monospace';`);
  commands.push(`ctx.fillText('${text}',${x},${y});`);
  
  return commands.join('');
}

private drawCharJs(char: string, gridX: number, gridY: number, 
                   fgColor: number, bgColor?: number): string {
  return this.drawTextJs(char, gridX, gridY, fgColor, bgColor);
}

private drawBoxJs(x: number, y: number, width: number, height: number, color: number): string {
  // Generate JS for box-drawing characters (┌─┐│└┘)
  const commands = [];
  const colorHex = this.colorToHex(color);
  
  // Top line
  commands.push(this.drawCharJs('┌', x, y, color));
  for (let i = 1; i < width - 1; i++) {
    commands.push(this.drawCharJs('─', x + i, y, color));
  }
  commands.push(this.drawCharJs('┐', x + width - 1, y, color));
  
  // Sides
  for (let i = 1; i < height - 1; i++) {
    commands.push(this.drawCharJs('│', x, y + i, color));
    commands.push(this.drawCharJs('│', x + width - 1, y + i, color));
  }
  
  // Bottom line
  commands.push(this.drawCharJs('└', x, y + height - 1, color));
  for (let i = 1; i < width - 1; i++) {
    commands.push(this.drawCharJs('─', x + i, y + height - 1, color));
  }
  commands.push(this.drawCharJs('┘', x + width - 1, y + height - 1, color));
  
  return commands.join('');
}

private clearRegionJs(region: LayoutRegion): string {
  const {x, y} = this.gridToPixel(region.x, region.y);
  const width = region.width * this.charWidth;
  const height = region.height * this.charHeight;
  return `ctx.clearRect(${x},${y},${width},${height});`;
}
```

### PHASE 3: REFACTOR RENDER METHODS
**Goal**: Convert each render method to use JS command batching

**Pattern for each render method**:
```typescript
private renderCogRegisters(region: LayoutRegion): void {
  const jsCommands = [];
  
  // Clear region background
  jsCommands.push(this.clearRegionJs(region));
  
  // Draw title
  jsCommands.push(this.drawTextJs('COG Registers', region.x + 1, region.y, DEBUG_COLORS.FG_DEFAULT));
  
  // Draw register values
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 4; col++) {
      const regNum = row * 4 + col;
      const value = this.dataManager.getCogRegister(regNum) || 0;
      const hexStr = value.toString(16).padStart(8, '0').toUpperCase();
      
      // Calculate position
      const x = region.x + 2 + col * 16;
      const y = region.y + 2 + row;
      
      // Determine colors (heat map, PC highlight, etc.)
      const heat = this.dataManager.getCogHeat(regNum);
      const bgColor = heat > 0 ? getHeatColor(heat) : undefined;
      const fgColor = this.cogState.programCounter === regNum ? 
                      DEBUG_COLORS.FG_PC : DEBUG_COLORS.FG_DEFAULT;
      
      jsCommands.push(this.drawTextJs(hexStr, x, y, fgColor, bgColor));
    }
  }
  
  // Execute all at once
  this.debugWindow.webContents.executeJavaScript(
    `(function() {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ${jsCommands.join('')}
    })()`
  );
}
```

**Methods to refactor**:
- renderCogRegisters()
- renderLutRegisters()
- renderFlags()
- renderDisassembly()
- renderRegisterWatch()
- renderStack()
- renderEvents()
- renderInterrupts()
- renderPointers()
- renderPins()
- renderSmartPins()
- renderHubMemory()
- renderHubMiniMap()
- renderButtons()
- renderTooltip()

### PHASE 4: OPTIMIZE BATCHING
**Goal**: Batch all dirty regions into single JavaScript execution

```typescript
public render(): void {
  const startTime = performance.now();
  const allJsCommands = [];
  
  // Collect commands for all dirty regions
  for (const regionName of this.dirtyRegions) {
    const region = this.regions.get(regionName);
    if (region) {
      const commands = this.getRenderCommands(regionName, region);
      allJsCommands.push(...commands);
    }
  }
  
  // Render buttons if needed
  if (this.dirtyRegions.has('buttons')) {
    allJsCommands.push(...this.getButtonCommands());
  }
  
  // Render tooltip if visible
  if (this.tooltipText) {
    allJsCommands.push(...this.getTooltipCommands());
  }
  
  // Execute all commands in single call
  if (allJsCommands.length > 0) {
    this.debugWindow.webContents.executeJavaScript(
      `(function() {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ${allJsCommands.join('')}
      })()`
    );
  }
  
  // Clear dirty regions
  this.dirtyRegions.clear();
  
  // Track performance
  const renderTime = performance.now() - startTime;
  this.lastRenderTime = renderTime;
  this.renderCount++;
  
  if (renderTime > 50) {
    console.warn(`Slow render: ${renderTime.toFixed(1)}ms`);
  }
}
```

### PHASE 5: TESTING
**Goal**: Verify functionality and performance

1. **Test with formatDebuggerPacketDisplay() fallback**
   - Verify basic rendering works
   - Check character alignment (8x16 pixels)
   - Confirm text displays correctly

2. **Test with real 416-byte debugger packets**
   - Parse and display actual debug data
   - Verify all regions update correctly
   - Check heat map colors

3. **Verify interactive features**
   - Button hover highlighting
   - Tooltip positioning
   - Mouse coordinate tracking

4. **Performance testing**
   - Monitor render times
   - Check for frame drops
   - Compare with original implementation

## Critical Considerations

### PRESERVE EXISTING FUNCTIONALITY
- Keep DebuggerRenderer class for layout logic
- Don't change the 123x77 character grid system
- Maintain all existing regions and buttons
- Keep dirty region tracking

### KEY DIFFERENCES FROM OTHER WINDOWS
- Debugger uses character grid (col/row) not pixels
- Has background colors for text (highlight PC line)
- Needs box-drawing characters (┌─┐│└┘)
- Heat map colors for register visualization

### PERFORMANCE CRITICAL AREAS
- Disassembly window (16 lines, updates frequently)
- Register maps (COG/LUT with heat colors)
- Pin states (64 pins with symbols)

### DON'T BREAK
- Dirty region tracking (already optimized)
- Button interaction handlers
- Tooltip positioning
- Heat map color calculations
- Character-perfect alignment

## Files to Modify

1. **src/classes/debugDebuggerWin.ts**
   - Add CanvasRenderer import and instance
   - Add helper methods
   - Modify renderDebuggerDisplay()

2. **src/classes/shared/debuggerRenderer.ts**
   - Modify drawText(), drawChar(), drawBox() methods
   - Change to return strings instead of direct drawing
   - Keep all layout logic intact

3. **No changes needed**:
   - src/classes/shared/canvasRenderer.ts (use as-is)
   - Other files remain unchanged

## Expected Outcome

### Benefits
- Consistent rendering pattern across all debug windows
- Easier maintenance and debugging
- Potential performance improvement through batching
- Better separation of concerns (layout vs rendering)

### Performance Analysis
- **Current**: Direct canvas manipulation in executeJavaScript
- **New**: Same executeJavaScript with batched commands
- **Result**: Similar or better performance due to batching
- **No additional IPC overhead** - already using IPC

## Tomorrow Morning Start Procedure

1. Run: `mcp__todo-mcp__context_resume`
2. Read this plan: `/workspaces/PNut-Term-TS/tasks/DEBUGGER_WINDOW_REFACTOR_PLAN.md`
3. Check git status to ensure clean working state
4. Begin with PHASE 1 implementation
5. Test after each phase before proceeding
6. Use `npm run build` frequently to catch TypeScript errors early

## Success Criteria

- [ ] Debugger window renders correctly with new pattern
- [ ] All regions display properly
- [ ] Character grid alignment is perfect (8x16)
- [ ] Background colors work behind text
- [ ] Box drawing characters connect properly
- [ ] Performance is same or better
- [ ] No visual regressions from current implementation