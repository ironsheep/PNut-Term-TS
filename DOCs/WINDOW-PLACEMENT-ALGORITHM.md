# Window Placement Algorithm

## Overview

PNut-Term-TS uses an intelligent window placement system based on the **Half-Moon Descending Algorithm** that provides center-balanced window arrangements with adaptive grid sizing and sophisticated collision detection.

The system implements three placement strategies:
1. **Default Strategy**: Grid-based placement for standard debug windows
2. **Debugger Strategy**: Special placement for debugger windows (1-2 side-by-side, 3+ cascaded)
3. **COG Grid Strategy**: Adaptive 2×4 or 4×2 grid layout for COG terminal windows

## Core Architecture

### Adaptive Grid System

The grid automatically adapts to monitor size and aspect ratio:

**Display Width-Based Columns:**
- Very wide displays (≥3000px): 5 columns
- Wide displays (≥2000px): 5 columns
- Medium displays (≥1500px): 3 columns
- Narrow displays: 3 columns

**Display Height-Based Rows:**
- Very tall displays (≥2000px): 4 rows
- Tall displays (≥1200px): 3 rows
- Medium displays (≥800px): 3 rows
- Short displays: 2 rows

**Aspect Ratio Adjustments:**
- Ultra-wide (ratio > 2.0): Add up to 2 columns (max 7)
- Tall displays (ratio < 1.3): Add 1 row (max 5)
- Columns forced to odd numbers for center alignment

### Example Grids

**Standard 5×3 Grid (1920×1080 and similar):**
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

**Reserved Positions:**
- **R2_C2** (Bottom Center): Main Window
- **R2_C4** (Bottom Right): Debug Logger Window

## Half-Moon Descending Algorithm

The algorithm creates a visual pattern that resembles a half-moon sliding down the screen and expanding as it descends. This maintains visual balance around the center column while providing predictable, organized placement.

### Algorithm Phases

**Phase 1: Start the half-moon**
- Window 1: R0_C2 (Top center)
- Balance: 0 left, 1 center, 0 right ✓ Balanced

**Phase 2: Expand horizontally (3 columns)**
- Window 2: R0_C1 (Top left-center)
- Window 3: R0_C3 (Top right-center)
- Balance: 1 left, 1 center, 1 right ✓ Balanced

**Phase 3: Descend one row**
- Window 4: R1_C2 (Middle center) - Half-moon slides down
- Balance maintained ✓

**Phase 4: Match the row above**
- Window 5: R1_C1 (Middle left-center)
- Window 6: R1_C3 (Middle right-center)
- Balance: 2 left, 2 center, 2 right ✓ Balanced

**Phase 5: Go wider (5 columns)**
- Window 7: R0_C0 (Top far left)
- Window 8: R0_C4 (Top far right)
- Balance: 3 left, 2 center, 3 right ✓ Balanced

**Phase 6: Match wider pattern below**
- Window 9: R1_C0 (Middle far left)
- Window 10: R1_C4 (Middle far right)
- Balance: 4 left, 2 center, 4 right ✓ Balanced

**Phase 7: Bottom row (avoiding reserved slots)**
- Window 11: R2_C1 (Bottom left-center, left of MainWindow)
- Window 12: R2_C3 (Bottom right-center, right of MainWindow)
- Window 13: R2_C0 (Bottom far left)

**Balance Principle:**
Symmetry is achieved around the center line (Column 2):
- Left side: Columns 0, 1 (2 positions per row)
- Center: Column 2 (1 position per row)
- Right side: Columns 3, 4 (2 positions per row)

Perfect balance occurs at: 1, 3, 4, 6, 8, 10, 12 windows

## Coordinate Calculation and Positioning

### Grid Layout Formulas

```typescript
// Calculate cell dimensions
colWidth = Math.round((workArea.width - margin * 2) / COLS)
rowHeight = Math.round((workArea.height - margin * 2) / ROWS)

// Calculate cell center
cellCenterX = workArea.x + margin + (col * colWidth) + (colWidth / 2)
cellCenterY = workArea.y + margin + (row * rowHeight) + (rowHeight / 2)
```

### Y-Positioning with Title Bar Alignment

Title bars are aligned across each row with safety margins:

```typescript
const safetyMargin = 20 // Fixed margin between windows
const halfSafetyMargin = safetyMargin / 2

y = workArea.y + margin + (row * rowHeight) + halfSafetyMargin
```

This ensures:
- Consistent title bar alignment across rows
- Proper 20px spacing between windows (10px above + 10px below)
- Visual coherence regardless of window heights

### Smart Alignment for Wide Windows

Windows wider than a single column receive intelligent alignment:

**Left Side (Columns 0-1):**
- Join columns 0 and 1
- Right-align window within joined space
- Aligns with center-column edge

**Right Side (Columns 3-4):**
- Join columns 3 and 4
- Left-align window within joined space
- Aligns with center-column edge

**Center Column:**
- Center the window within column
- Natural center alignment

## Collision Detection for Oversized Windows

The system automatically detects and handles windows that exceed their cell boundaries.

### Width Overflow (Horizontal Collision)

**Detection:**
```typescript
windowWidth > (columnWidth - safetyMargin)
```

**Strategy:**
- Centered overflow - mark cells left AND right of assigned slot
- Calculate additional columns needed
- Split evenly between left and right sides

**Example:**
Window at R0_C2 with width = 1.5× column width:
- Marks R0_C2 (primary slot)
- Marks R0_C1 (left overflow)
- Marks R0_C3 (right overflow)

### Height Overflow (Vertical Collision)

**Detection:**
```typescript
windowHeight > (rowHeight - safetyMargin)
```

**Strategy:**
- Mark cells BELOW only (preserves title bar alignment)
- Calculate additional rows needed
- Tall windows affect subsequent rows but maintain row structure

**Example:**
Window at R0_C2 with height = 1.8× row height:
- Marks R0_C2 (primary slot)
- Marks R1_C2 (below, row overflow)

### Boundary Handling

- If oversized window would overflow grid edges → Developer edge case
- System attempts to relocate to available space when possible
- Document as placement exception requiring smaller window sizes

## Special Placement Strategies

### Debugger Strategy

Used for debugger windows that are typically larger:

**1 Window:**
- Left side with 40px margin

**2 Windows:**
- Left side and right side with 40px margins
- Maximizes separation

**3+ Windows:**
- Cascade from top-left
- Smaller 20×20px cascade offset (vs 30×30px for standard windows)
- Resets to top-left if exceeding screen boundaries

### COG Grid Strategy

Adaptive layout for COG terminal windows based on monitor size:

**Large Monitors (≥1920px wide):**
- 2 rows × 4 columns (horizontal orientation)
- Layout: COG0 COG1 COG2 COG3 (top row)
         COG4 COG5 COG6 COG7 (bottom row)

**Laptop Screens (<1920px wide):**
- 4 rows × 2 columns (vertical orientation)
- Layout: COG0 COG4 (row 0)
         COG1 COG5 (row 1)
         COG2 COG6 (row 2)
         COG3 COG7 (row 3)

**Terminal Sizing:**
Terminal character dimensions adapt to available space:
- Large screens (≥1640px available): 80×24 terminal (820×442px window)
- Medium screens (≥1320px available): 64×24 terminal (660×442px window)
- Small screens (<1320px available): 48×24 terminal (540×442px window)

**Spacing:**
- 20px horizontal gap between COG windows
- 20px vertical gap between COG windows
- Windows centered horizontally with even distribution

## macOS Coordinate Workarounds

macOS has known bugs with negative coordinates where it automatically moves windows to the display they "overlap most with". The system implements several mitigation strategies:

### Strategy 1: Smart Monitor Selection

```typescript
selectOptimalMonitor():
  1. If primary monitor has positive coordinates → Use primary
  2. Otherwise, find monitor with positive coordinates → Use that
  3. If all monitors have negative coordinates → Use primary (least problematic)
```

### Strategy 2: Monitor-Relative Positioning

For windows on monitors with negative coordinates:
```typescript
// Convert absolute to monitor-relative coordinates
relativeX = position.x - monitor.bounds.x
relativeY = position.y - monitor.bounds.y

// Apply work area relative positioning
correctedX = workArea.x + Math.max(0, relativeX)
correctedY = workArea.y + Math.max(0, relativeY)

// Add safety margins
finalX = Math.max(workArea.x + 10, safeX)
finalY = Math.max(workArea.y + 10, safeY)
```

### Strategy 3: Post-Creation Validation

After window creation, check if macOS moved it:
```typescript
setTimeout(() => {
  actualBounds = window.getBounds()
  if (Math.abs(actualBounds.x - expectedX) > 50 ||
      Math.abs(actualBounds.y - expectedY) > 50) {
    // Attempt position correction
    window.setPosition(expectedX, expectedY)
  }
}, 100)
```

## Auto-Placement Strategy

### Priority Order

1. **Explicit slot requested** → Use if available
2. **Preferred slot hint** → Check for system windows (MainWindow, DebugLogger)
3. **Find available slot** → Use Half-Moon Descending order
4. **Cascade if full** → Apply cascade offset (unless disabled)
5. **Center as fallback** → Ultimate fallback position

### Cascade Placement

When grid is full and cascadeIfFull enabled:
- Standard windows: 30×30px cascade offset
- Debugger windows: 20×20px cascade offset (smaller for large windows)
- Resets to top-left if exceeding screen boundaries
- Allows unlimited windows while maintaining visibility

## Multi-Monitor Support

### Monitor Tracking

- Each window tracks its current monitor ID
- Monitor changes detected on window 'move' events
- Grid recalculated based on target monitor dimensions
- Slot associations preserved when possible

### Cross-Monitor Limitations

- Current implementation focuses on single-monitor placement
- Cross-monitor placement requires explicit coordinate calculation
- Future enhancement: Multi-monitor grid spanning

## Window Registration and Tracking

### Registration Process

```typescript
registerWindow(windowId, window, expectedPosition):
  1. Get actual window bounds from Electron
  2. Validate macOS position if expected position provided
  3. Detect slot from actual position
  4. Track window with monitor ID, slot, and bounds
  5. Mark slot as occupied (including collision-detected slots)
  6. Register event handlers:
     - 'move': Update position and monitor tracking
     - 'closed': Unregister and free slot
```

### Unregistration

```typescript
unregisterWindow(windowId):
  1. Retrieve tracked window info
  2. Free occupied slot
  3. Remove from tracked windows map
  4. Log slot freed for debugging
```

## Manual Positioning

### User Overrides

- Users can drag windows to any position
- Manual positions tracked via 'move' event
- Slot detection updates based on new position
- Monitor changes detected automatically

### Position Persistence

Position persistence is handled by the calling code:
- Window positions can be saved externally
- WindowPlacer provides position calculation and tracking
- Restoration logic implemented in window creation code

## Configuration

### Current Parameters

```typescript
defaultMargin = 20          // Standard window margin
safetyMargin = 20           // Spacing between windows
cascadeOffset = { x: 30, y: 30 }  // Standard cascade
debuggerCascadeOffset = { x: 20, y: 20 }  // Debugger cascade
debuggerMargin = 40         // Larger margin for debugger windows
```

### Singleton Pattern

WindowPlacer uses singleton pattern:
```typescript
WindowPlacer.getInstance()  // Get singleton instance
WindowPlacer.resetInstance() // Reset for testing
```

## Edge Cases and Limitations

### Small Screens

- Grid adapts to 3×2 minimum
- Windows may overlap if too large
- Collision detection marks overlapping slots
- User can manually reposition as needed

### Many Windows

- First 13 windows use Half-Moon Descending pattern (15 slots - 2 reserved)
- Additional windows cascade automatically
- No hard limit on window count
- Z-order maintained (newer windows on top)

### Window Collisions

- Oversized windows mark multiple slots as occupied
- Prevents new windows from overlapping large windows
- Later windows may still overlap if grid is full
- User can manually reposition to resolve conflicts

## Implementation Location

**Primary Implementation:**
- File: `src/utils/windowPlacer.ts`
- Class: `WindowPlacer` (singleton)
- Export: `PlacementSlot`, `PlacementStrategy`, `PlacementConfig`, `WindowDimensions`

**Test Coverage:**
- File: `tests/windowPlacer.test.ts`
- Coverage: Grid calculations, slot detection, collision detection, macOS workarounds

**Related Components:**
- `src/utils/screenManager.ts` - Monitor detection and management
- Window classes use WindowPlacer for initial positioning

## Future Enhancements

- [ ] Multi-monitor grid spanning
- [ ] Smart collision avoidance with repositioning
- [ ] Snap-to-grid on manual move
- [ ] Save/restore layout presets
- [ ] Configurable grid dimensions per monitor
- [ ] Row height weighting (taller bottom row for MainWindow)
- [ ] Column alignment options (center vs edge-aligned)
