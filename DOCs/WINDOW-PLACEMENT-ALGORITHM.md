# Window Placement Algorithm

## Overview
PNut-Term-TS uses a sophisticated 5x3 grid-based window placement system for organizing debug windows on screen. This provides predictable, organized placement while allowing flexibility for different window sizes.

## Grid System

### Grid Layout
```
+-------+-------+-------+-------+-------+
| R0_C0 | R0_C1 | R0_C2 | R0_C3 | R0_C4 |  Row 0 (Top)
+-------+-------+-------+-------+-------+
| R1_C0 | R1_C1 | R1_C2 | R1_C3 | R1_C4 |  Row 1 (Middle)
+-------+-------+-------+-------+-------+
| R2_C0 | R2_C1 | R2_C2 | R2_C3 | R2_C4 |  Row 2 (Bottom)
+-------+-------+-------+-------+-------+
   Col0    Col1    Col2    Col3    Col4
```

### Reserved Positions
- **R2_C2** (Bottom Center): Main Window
- **R2_C4** (Bottom Right): Debug Logger Window

## Placement Algorithm

### Window Centering
Each window is centered within its assigned grid cell:
1. Calculate cell boundaries based on screen size / grid dimensions
2. Find cell center point
3. Position window so its center aligns with cell center
4. Apply boundary constraints to keep window on screen

### Size Handling
- Windows smaller than cell: Centered perfectly
- Windows slightly larger than cell: Still centered, may overlap adjacent cells
- Windows much larger than cell: Constrained to screen edges with margin

### Calculation Details
```typescript
// Grid dimensions
COLS = 5, ROWS = 3

// Cell size
cellWidth = (screenWidth - margins) / COLS
cellHeight = (screenHeight - margins) / ROWS

// Window position in cell
cellCenterX = margin + (col * cellWidth) + (cellWidth / 2)
cellCenterY = margin + (row * cellHeight) + (rowHeight / 2)
windowX = cellCenterX - (windowWidth / 2)
windowY = cellCenterY - (windowHeight / 2)
```

## Auto-Placement Strategy

### Priority Order
1. Check if specific slot requested
2. Find first available slot (scanning left-to-right, top-to-bottom)
3. If all slots occupied, use cascade placement
4. Ultimate fallback: center of screen

### Cascade Placement
When grid is full:
- Each new window offset by 30px right and down
- Creates overlapping cascade effect
- Allows unlimited windows while maintaining visibility

## Multi-Monitor Support

### Monitor Detection
- Primary monitor used by default
- Windows track which monitor they're on
- Monitor changes detected when window is moved

### Cross-Monitor Movement
- Window maintains relative position when moved between monitors
- Grid recalculated based on target monitor dimensions
- Slot associations preserved when possible

## Manual Positioning

### User Overrides
- Users can drag windows to any position
- Manual positions are remembered
- Next session restores last position

### Position Persistence
- Window positions saved on move
- Restored on next launch
- Per-window position memory

## Special Behaviors

### Main Window
- Always starts bottom-center (R2_C2)
- 50px margin from bottom edge
- Horizontally centered

### Debug Logger
- Auto-creates at R2_C4 (bottom-right)
- 80 columns × 24 rows default size
- Green on black theme

### Debug Windows
- First available slot from R0_C0
- Skip reserved slots
- Maintain consistent sizing within type

## Edge Cases

### Small Screens
- Grid cells may overlap
- Windows constrained to visible area
- Minimum window size enforced

### Many Windows
- First 13 windows use grid (15 slots - 2 reserved)
- Additional windows cascade
- No hard limit on window count

### Window Collisions
- Later windows may overlap earlier ones
- User can manually reposition
- Z-order maintained (newer on top)

## Configuration

### Adjustable Parameters
- Grid dimensions (currently 5×3)
- Margin size (default 20px)
- Cascade offset (default 30px)
- Cell padding (future enhancement)

### Future Enhancements
- Column alignment options (center vs edge-aligned)
- Row height weighting (make bottom row taller)
- Smart collision avoidance
- Snap-to-grid on manual move
- Save/restore layout presets