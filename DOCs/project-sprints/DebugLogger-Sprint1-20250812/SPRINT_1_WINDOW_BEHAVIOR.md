# Sprint 1: Implementing the Window Behavior

## Sprint Overview
**Focus**: Window routing, placement, and debug logger implementation  
**Timeline**: Monday evening through Tuesday afternoon
**Goal**: Complete window management system - the "Tall Thin Man" that makes everything work
**Critical**: This sprint is THE MOST IMPORTANT - without it, nothing else can be validated

## Revolutionary Architecture Decision (FROZEN)
**Keep ALL THREE paradigms available simultaneously:**
1. **PST Blue Terminal** - ANSI/cursor control for terminal UIs
2. **Debug Windows** - Software-defined instrumentation  
3. **Debug Logger** - High-speed logging with visual feedback

**Value Proposition**: First tool to offer all three capabilities together. Users can build terminal UIs AND have debug visualization AND comprehensive logging simultaneously.

## Detailed Implementation Plan

### Component 1: DebugLoggerWindow Class

#### Purpose
High-performance output-only terminal for all debug messages from P2

#### Visual Design
- **Theme System**:
  - Default: Green (#00FF00) on black (#000000)
  - Alternative: Amber (#FFBF00) on black (#000000)
  - Future: Could support all MainWindow themes
- **Window Chrome**:
  - Title bar with close button
  - No menu bar
  - Status bar showing current log filename
  - No input field (output-only)

#### Window Specifications
- **Size**: 80 columns × 24 lines (approximately 640×400 pixels)
- **Position**: Bottom-right of screen, aligned with MainWindow top edge
- **Font**: Monospace (Consolas, Courier New, or Parallax font)
- **Auto-behavior**: Opens automatically on first "CogN:" message

#### Performance Requirements
- **Data Rate**: Must handle 8 COGs × 2 Mbps = 16 Mbps aggregate
- **Buffering Strategy**:
  - Message queue with batch processing
  - DOM updates every 16ms (60 fps)
  - Circular buffer for display (configurable lines, e.g., 10,000)
- **File I/O**:
  - Asynchronous writes to prevent blocking
  - Buffered file writes (flush every 100ms or 1KB)
  - Timestamped log files with rotation support

#### Integration Points
- Receives messages from MainWindow serial handler
- Shares theme preferences with MainWindow settings
- Registers with WindowRouter for lifecycle management
- Emits window placement info to log

### Component 2: Message Routing Enhancement

#### Detection Logic
```
if (message.startsWith('Cog')) {
  // Format: "CogN: [content]" where N is 0-7
  
  // Step 1: Create debug logger if needed
  if (!debugLoggerWindow) {
    debugLoggerWindow = new DebugLoggerWindow();
    injectWindowPlacement(debugLoggerWindow);
  }
  
  // Step 2: Route to debug logger (NOT blue terminal)
  debugLoggerWindow.appendMessage(message);
  
  // Step 3: Parse content for window commands
  const cogId = extractCogId(message);
  const content = extractContent(message);
  
  if (content.includes('`')) {
    handleDebugWindowCommand(cogId, content);
  }
} else {
  // Non-debug message → blue terminal
  mainWindow.appendToTerminal(message);
}
```

#### Window Command Handling
- **Creation**: `"Cog0: `TERM MyTerm SIZE 80 24"`
  - Parse window type and parameters
  - Create appropriate debug window
  - Register with router: Cog0 + MyTerm
  - Inject placement log entry
  
- **Updates**: `"Cog0: `MyTerm 'Hello World'"`
  - Look up registered window by Cog + Name
  - Route content to window's update method
  - Also log to debug logger

#### Message Distribution Rules
Every Cog-prefixed message goes to:
1. **Debug Logger Window** - Always (for visibility)
2. **Log File** - Always (for persistence)
3. **Specific Debug Window** - When name matches

### Component 3: Window Auto-Placement System

#### Placement Algorithm: Heads-Up Console Pattern

```
Visual Layout:
        [4]     [1]     [5]
        [6]     [2]     [7]
                [3]
        [Main]      [Logger]
```

#### Implementation Details

**Screen Calculation**:
```typescript
interface PlacementSlot {
  position: 'top-center' | 'left-center' | 'top-right' | ...
  x: number;
  y: number;
  occupied: boolean;
}

class WindowPlacer {
  private slots: PlacementSlot[];
  private screenBounds: Rectangle;
  
  calculateSlots() {
    // Get screen dimensions
    // Calculate positions for 7 slots + main + logger
    // Account for window chrome and spacing
  }
  
  getNextPosition(windowSize: Size): Point {
    // Find next available slot
    // Adjust for window size
    // Mark slot as occupied
    // Return position
  }
}
```

**Placement Order**:
1. MainWindow → Bottom-center (fixed)
2. DebugLogger → Bottom-right (fixed)
3. First debug window → Top-center
4. Second → Left-of-center
5. Third → Top-right
6. Fourth → Top-left
7. Fifth → Right-of-center (row 2)
8. Sixth → Left-of-center (row 2)
9. Seventh → Bottom-center (above main)

**Spacing Rules**:
- Minimum 20px between windows
- Account for window chrome (title bar ~30px)
- Respect screen edges and taskbar

### Component 4: Window Placement Logging

#### Log Entry Format
```
[WINDOW] <Type>_<Name> placed at (<x>, <y>) size <width>x<height>
```

Examples:
```
[WINDOW] Term_MyDisplay placed at (640, 100) size 800x600
[WINDOW] Scope_Signals placed at (100, 100) size 512x256
[WINDOW] Logic_Bus placed at (1180, 100) size 400x300
[WINDOW] DebugLogger placed at (1280, 420) size 640x400
```

#### Implementation
- Inject after each window creation
- Use consistent prefix `[WINDOW]` for easy parsing
- Include all info needed for debug() POS statements
- Write to both debug logger and file

### Component 5: Multi-Monitor Support (Research Phase)

#### Electron Screen API Investigation
```typescript
import { screen } from 'electron';

// Get all displays
const displays = screen.getAllDisplays();
const primary = screen.getPrimaryDisplay();

// Find external display
const external = displays.find((display) => {
  return display.bounds.x !== 0 || display.bounds.y !== 0;
});

// Calculate position on specific monitor
function positionOnMonitor(monitor: Display, relativePos: Point) {
  return {
    x: monitor.bounds.x + relativePos.x,
    y: monitor.bounds.y + relativePos.y
  };
}
```

#### Features to Research
- Detect available monitors
- Get monitor dimensions and work areas
- Save monitor preferences
- Handle monitor disconnection gracefully

### Component 6: Settings Integration

#### User Preferences to Add
```typescript
interface DebugLoggerSettings {
  theme: 'green' | 'amber' | 'custom';
  fontSize: number;
  maxLines: number;
  autoScroll: boolean;
  position?: { x: number, y: number };
  size?: { width: number, height: number };
  alwaysOnTop: boolean;
}
```

#### Settings UI Extension
- Add "Debug Logger" section to existing settings
- Theme dropdown (Green/Amber)
- Font size slider
- Buffer size input
- Position override fields

## Sprint 1 Test Demo (Early Validation)

### Spin2 Test Program
**Location**: Will be placed in demo directory with binary and source
```spin2
' Simple debug window test
PUB main()
  ' Create and use TERM window
  debug(`TERM TestTerm SIZE 40 20)
  debug(`TestTerm "Hello from TERM window")
  debug(`TestTerm 13 10 "Line 2 of display")
  waitms(2000)
  debug(`TestTerm CLOSE)
  
  ' Create and use LOGIC window  
  debug(`LOGIC Signals 'CLK' 'DATA' 'CS')
  debug(`Signals long_value)
  waitms(2000)
  debug(`Signals CLOSE)
  
  ' Done - stop here
  repeat
```

### Expected Test Behavior
1. **DTR Press**: Starts execution from flash
2. **New Log**: Creates new timestamped log file
3. **Debug Logger**: Opens bottom-right on first "Cog" message
4. **TERM Window**: 
   - Auto-places (top-center expected)
   - Logs: `[WINDOW] Term_TestTerm placed at (640, 100) size 320x320`
   - Shows "Hello from TERM window"
5. **Window Close**: TERM closes after 2 seconds
6. **LOGIC Window**:
   - Auto-places (left-of-center expected)
   - Logs: `[WINDOW] Logic_Signals placed at (200, 100) size 400x300`
   - Shows signal traces
7. **Final State**: Both windows visible (or closed per demo choice)

### What This Validates
- ✅ Cog message detection works
- ✅ Debug logger auto-opens
- ✅ Window creation from Cog messages
- ✅ Auto-placement algorithm
- ✅ Placement logging
- ✅ Message routing to windows
- ✅ DTR triggers new log
- ✅ Window close commands

## Testing Strategy

### Manual Test Cases
1. **Basic Routing**:
   - Send non-Cog message → Verify goes to blue terminal only
   - Send "Cog0: test" → Verify debug logger opens
   - Send more Cog messages → Verify all go to logger

2. **Window Creation**:
   - Send `"Cog0: `TERM Test SIZE 40 20"`
   - Verify TERM window creates
   - Verify placement log entry
   - Send `"Cog0: `Test 'Hello'"` 
   - Verify routes to Test window

3. **Performance**:
   - Flood with 1000 messages/second
   - Verify no UI freezing
   - Check memory usage stays stable
   - Verify file writes keep up

4. **Placement**:
   - Create 7 debug windows
   - Verify heads-up console pattern
   - Check no overlaps
   - Verify placement logs correct

### Automated Test Cases
- Message parsing and routing logic
- Window placement calculations
- Buffer management
- Theme switching
- Settings persistence

## Success Criteria

### Must Have (Demo Critical)
- [ ] Debug logger window opens on first Cog message
- [ ] All Cog messages route to logger (not blue terminal)
- [ ] Window creation from Cog messages works
- [ ] Window placement logging with [WINDOW] format
- [ ] Basic auto-placement (no overlaps)
- [ ] Green-on-black theme
- [ ] File logging works

### Should Have
- [ ] Amber-on-black theme option
- [ ] Settings integration
- [ ] Heads-up console pattern
- [ ] Performance optimization (16 Mbps)

### Nice to Have
- [ ] Multi-monitor support
- [ ] Advanced placement algorithm
- [ ] Theme hot-swapping
- [ ] Log rotation

## Risk Mitigation

### Risk: Performance Issues
- **Mitigation**: Start with simple buffering, optimize if needed
- **Fallback**: Reduce update frequency to 30fps

### Risk: Window Placement Complexity
- **Mitigation**: Start with simple grid, enhance later
- **Fallback**: Random placement with no-overlap check

### Risk: Electron API Limitations
- **Mitigation**: Research early, have fallback positions
- **Fallback**: Single monitor support only

## Definition of Done

1. **Code Complete**:
   - DebugLoggerWindow class implemented
   - Routing logic updated in MainWindow
   - Window placement system working
   - Placement logging implemented

2. **Testing**:
   - Manual test cases pass
   - No performance degradation
   - Works with multiple debug windows

3. **Documentation**:
   - Architecture document updated
   - Code comments complete
   - Demo script prepared

4. **Demo Ready**:
   - Can show PST terminal + debug windows + logger
   - Placement logs visible
   - Theme switching works
   - No crashes or freezes

## Next Steps
Once this plan is approved:
1. Generate detailed todo items
2. Begin implementation
3. Test incrementally
4. Prepare demo scenarios