# Window Placement Algorithm

## Grid-Based Smart Placement System

### Core Concept
The screen is divided into a dynamic grid that adapts based on display resolution, with intelligent handling for windows that don't fit standard cell sizes.

### Dynamic Grid Layouts by Resolution

#### 4K Display (3840x2160) - 5x4 Grid
```
+-------+-------+-------+-------+-------+
| (0,0) | (1,0) | (2,0) | (3,0) | (4,0) |  Row 0
+-------+-------+-------+-------+-------+
| (0,1) | (1,1) | (2,1) | (3,1) | (4,1) |  Row 1  
+-------+-------+-------+-------+-------+
| (0,2) | (1,2) | (2,2) | (3,2) | (4,2) |  Row 2
+-------+-------+-------+-------+-------+
| (0,3) | (1,3) | (2,3) | (3,3) | (4,3) |  Row 3
+-------+-------+-------+-------+-------+
  Col 0   Col 1   Col 2   Col 3   Col 4
```

#### High-Res Display (3200x1800) - 5x3 Grid
```
+-------+-------+-------+-------+-------+
| (0,0) | (1,0) | (2,0) | (3,0) | (4,0) |  Row 0
+-------+-------+-------+-------+-------+
| (0,1) | (1,1) | (2,1) | (3,1) | (4,1) |  Row 1  
+-------+-------+-------+-------+-------+
| (0,2) | (1,2) | (2,2) | (3,2) | (4,2) |  Row 2
+-------+-------+-------+-------+-------+
  Col 0   Col 1   Col 2   Col 3   Col 4
```

#### 1440p+ Display (≥2560x1440) - 5x3 Grid
*Includes 2560x1440, 3200x1800 - using odd columns for center alignment*
```
+-------+-------+-------+-------+-------+
| (0,0) | (1,0) | (2,0) | (3,0) | (4,0) |  Row 0
+-------+-------+-------+-------+-------+
| (0,1) | (1,1) | (2,1) | (3,1) | (4,1) |  Row 1  
+-------+-------+-------+-------+-------+
| (0,2) | (1,2) | (2,2) | (3,2) | (4,2) |  Row 2
+-------+-------+-------+-------+-------+
  Col 0   Col 1   Col 2   Col 3   Col 4
```

#### Standard Display (<2560x1440) - 3x2 Grid
```
+-------+-------+-------+
| (0,0) | (1,0) | (2,0) |  Row 0
+-------+-------+-------+
| (0,1) | (1,1) | (2,1) |  Row 1  
+-------+-------+-------+
  Col 0   Col 1   Col 2
```

## Smart Column Joining

### When Window Width > Column Width
- Automatically join adjacent columns to create wider placement area
- Example: If window needs 2 columns worth of space, treat columns 3-4 as single wide column

### Alignment Rules for Joined Columns

#### Left Side (Columns 0-1)
- When joining columns 0-1, **right-align** within the joined space
- Keeps windows closer to center of screen
- Example: Wide window in left area aligns to right edge of column 1

#### Right Side (Columns 3-4)  
- When joining columns 3-4, **left-align** within the joined space
- Keeps windows closer to center of screen
- Example: Wide window in right area aligns to left edge of column 3

#### Center Column
- Column 2 remains independent
- Center-align windows that span from center

## Smart Row Spanning

### When Window Height > Row Height
- Window can span multiple rows vertically
- **Top edge always aligns with row 0** (maintains menu bar alignment)
- Blocks other windows from using spanned rows
- Example: Tall window in (3,0) spans to row 1, blocking placement at (3,1)

### Menu Bar Alignment
- All windows maintain consistent top edge alignment
- Menu bars stay at same height across all windows
- Visual consistency maintained even with different window heights

## Placement Examples

### Example 1: Standard Terminal Window
- Size: Fits within single cell
- Placement: Normal grid position
- No joining needed

### Example 2: Wide Debug Logger
- Size: 80x24 characters (wider than single column)
- Grid position: (3,2) - bottom right
- Behavior: Joins columns 3-4, left-aligns within joined space

### Example 3: Tall Scope Window
- Size: Standard width, double height
- Grid position: (0,0) - top left
- Behavior: Spans rows 0-1, blocks (0,1) from use

## Implementation Priority

1. **Width handling first**: Implement column joining and alignment
2. **Height handling second**: Implement row spanning  
3. **Conflict resolution**: Handle overlapping placement requests
4. **Dynamic adjustment**: Resize grid based on screen size

## Benefits

- **Visual consistency**: Menu bars align across windows
- **Efficient space usage**: Large windows don't waste grid cells
- **Predictable placement**: Clear rules for positioning
- **Center-focused**: Alignment rules keep windows toward screen center
- **Flexible**: Handles various window sizes gracefully

## Technical Notes

- Main window stays at bottom center (column 2, row 2)
- Minimum margin maintained between windows
- Windows never overlap
- Grid scales with display resolution