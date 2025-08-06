# Scope XY Debug Window Implementation Plan

## Pascal Source Analysis

### Core Functionality
The SCOPE_XY display is an XY oscilloscope with 1-8 channels that displays data points in X,Y pairs. Based on Pascal source analysis from `/pascal-source/P2_PNut_Public/DebugDisplayUnit.pas`:

#### Key Features
1. **Display Modes**:
   - Cartesian mode (default): X,Y coordinates plotted directly
   - Polar mode: X=radius, Y=angle
   - Log scale mode: Magnifies points within unit circle

2. **Persistence Modes**:
   - 0 samples: Infinite persistence (dots never fade)
   - 1-512 samples: Fading persistence with opacity gradient

3. **Data Structure**:
   - Supports 1-8 channels (each channel = X,Y pair)
   - Uses circular buffer for sample history (XY_Sets = 2048)
   - Sample buffer: `XY_SampleBuff[XY_Sets * XY_SetSize]` where XY_SetSize = Channels * 2

4. **Rendering**:
   - Uses SmoothDot for anti-aliased point rendering
   - Dot size configurable (2-20 half-pixels, default 6)
   - Opacity-based fading for persistence display

### Pascal Implementation Details

#### Configuration (SCOPE_XY_Configure)
```pascal
procedure TDebugDisplayForm.SCOPE_XY_Configure;
```
- Sets defaults: vRange = $7FFFFFFF, vRate = 1, vDotSize = 6
- Processes parameters:
  - SIZE: Sets width (radius * 2), height = width, range 32-2048
  - RANGE: Unit circle radius for data (1 to $7FFFFFFF)
  - SAMPLES: Persistence (0-512 samples) - NO ARTIFICIAL LIMIT
  - RATE: Update rate (1-512)
  - DOTSIZE: Point size (2-20)
  - COLOR: Background and grid colors
  - POLAR: Enable polar mode with twopi and offset
  - LOGSCALE: Enable log scaling
  - HIDEXY: Hide mouse coordinates
  - Channel definitions: Name and color for each channel

**Note**: Pascal does not limit the number of persistent points beyond the 512 sample buffer size, so we won't either.

#### Update Loop (SCOPE_XY_Update)
```pascal
procedure TDebugDisplayForm.SCOPE_XY_Update;
```
- Processes incoming data in X,Y pairs
- Two display modes:
  1. **Persistent (vSamples = 0)**: Dots stay forever, immediate plotting
  2. **Fading (vSamples > 0)**: Circular buffer with opacity gradient

#### Plotting (SCOPE_XY_Plot)
```pascal
procedure TDebugDisplayForm.SCOPE_XY_Plot(x, y, color: integer; opacity: byte);
```
- Transforms coordinates based on mode:
  - **Cartesian**: Direct scaling with vScale = vWidth / 2 / vRange
  - **Cartesian + LogScale**: Log transformation for magnification
  - **Polar**: X=radius, Y=angle, converted to cartesian
  - **Polar + LogScale**: Log transformation of radius
- All coordinates scaled by $100 (256) for sub-pixel precision
- Calls SmoothDot for anti-aliased rendering

### Mouse Interaction
- Shows X,Y coordinates at cursor (unless HIDEXY set)
- Coordinate transformation based on display mode
- For cartesian: Shows actual data values
- For polar: Shows radius and angle
- Log scale affects coordinate display

## TypeScript Implementation Architecture

### File Structure
```
src/classes/
├── debugScopeXyWin.ts          # Main window class
└── shared/
    ├── scopeXyRenderer.ts       # XY-specific rendering logic (new)
    └── persistenceManager.ts    # Sample buffer & fading logic (new)

tests/
├── debugScopeXyWin.test.ts     # Unit tests for main window
├── scopeXyRenderer.test.ts     # Unit tests for renderer
└── persistenceManager.test.ts  # Unit tests for persistence
```

### Class Hierarchy
```typescript
DebugWindowBase
  └── DebugScopeXyWindow
        ├── Uses: CanvasRenderer (existing)
        ├── Uses: ColorTranslator (existing)
        ├── Uses: PackedDataProcessor (existing)
        ├── Uses: InputForwarder (existing)
        ├── Uses: ScopeXyRenderer (new)
        └── Uses: PersistenceManager (new)
```

### New Shared Classes

#### ScopeXyRenderer
Responsibilities:
- Coordinate transformations (cartesian/polar, linear/log)
- Point plotting with Canvas API anti-aliasing (investigate sufficiency)
- Circular grid rendering (must match Pascal exactly)
- Coordinate system conversions

Methods:
- `transformCartesian(x, y, scale, logScale)`
- `transformPolar(radius, angle, twopi, offset, logScale)`
- `plotPoint(x, y, color, opacity, dotSize)`
- `drawCircularGrid(center, radius, divisions)` - Required in initial implementation

#### PersistenceManager
Responsibilities:
- Circular buffer management for sample history
- Opacity calculation for fading effect
- Sample storage and retrieval

Methods:
- `addSample(channelData: number[])`
- `getSamplesWithOpacity(): Array<{data, opacity}>`
- `clear()`
- `setPersistence(samples: number)`

### Implementation Requirements

#### Data Flow
1. **Input**: Numerical data as X,Y pairs per channel
2. **Buffering**: Store in circular buffer if persistence > 0
3. **Transform**: Apply coordinate transformations based on mode
4. **Render**: Plot points with appropriate opacity
5. **Update**: Refresh display based on rate setting

#### Key Behaviors from Pascal
1. **Scaling**: vScale = displayRadius / dataRange
2. **Sub-pixel precision**: FUTURE - Consider if Canvas API makes this easy, otherwise defer
3. **Opacity gradient**: opacity = 255 - (sampleAge * 255 / maxSamples)
4. **Rate control**: Update display every N samples
5. **Channel pairing**: Data arrives as sequential values, paired as X,Y
6. **GPU Acceleration**: Canvas 2D context will use GPU automatically when available

### Configuration Interface
```typescript
interface ScopeXyConfig {
  title?: string;
  pos?: { left: number; top: number };
  size?: number;  // Display radius in pixels
  range?: number;  // Data range (1 to 0x7FFFFFFF)
  samples?: number;  // Persistence (0-512, 0=infinite)
  rate?: number;  // Update rate (1-512)
  dotSize?: number;  // Point size (2-20)
  textSize?: number;
  color?: { background: number; grid?: number };
  polar?: { twopi: number; offset: number };
  logScale?: boolean;
  hideXY?: boolean;
  channels?: Array<{ name: string; color?: number }>;
  packedDataMode?: PackedDataMode;
}
```

### Data Processing
```typescript
interface ScopeXyData {
  values: number[];  // X,Y pairs for all channels
  command?: 'CLEAR' | 'SAVE' | 'CLOSE';
}
```

## Testing Strategy

### Incremental Unit Testing Approach
Build tests incrementally as we develop each component, following our established patterns.

### Unit Tests
1. **ScopeXyRenderer** (`tests/scopeXyRenderer.test.ts`):
   - Test coordinate transformations (all 4 modes)
   - Test point plotting with various dot sizes
   - Test circular grid rendering (must match Pascal exactly)
   - Test boundary conditions
   - Verify Canvas API anti-aliasing sufficiency

2. **PersistenceManager** (`tests/persistenceManager.test.ts`):
   - Test circular buffer operations
   - Test opacity calculations
   - Test sample management at capacity
   - Test clear operations

3. **DebugScopeXyWindow** (`tests/debugScopeXyWin.test.ts`):
   - Test configuration parsing
   - Test data processing and pairing
   - Test rate control
   - Test input forwarding
   - Test packed data modes

### Reference Examples
Pascal source examples from `/pascal-source/P2_PNut_Public/DEBUG-TESTING/` can inform implementation:
- `DEBUG_SCOPE_XY_Grid.spin2` - Basic grid pattern
- `DEBUG_SCOPE_XY_LogScale.spin2` - Log scale mode  
- `DEBUG_SCOPE_XY_Spiral.spin2` - Spiral pattern

These examples may be cited in JSDoc for demonstrating XY display behavior.

### Coverage Goals
- Minimum 80% coverage for all new classes
- Focus on transformation logic and edge cases
- Test all configuration combinations

## Implementation Steps

### Phase 1: Core Infrastructure
1. Create `DebugScopeXyWindow` class extending `DebugWindowBase`
2. Add comprehensive JSDoc above class export describing:
   - Features and requirements (XY oscilloscope with persistence)
   - Configuration parameters (SIZE, RANGE, SAMPLES, POLAR, etc.)
   - Data feeding format (X,Y pairs per channel)
   - Commands supported (CLEAR, SAVE, CLOSE)
3. Implement basic configuration parsing
4. Set up canvas and rendering pipeline (using existing CanvasRenderer)
5. Add input forwarding support (using existing InputForwarder)
6. Create initial test file with basic structure tests

### Phase 2: Shared Components
1. Implement `ScopeXyRenderer` (NEW) with transformation logic
2. Study Pascal source for exact circular grid pattern and implement matching rendering
3. Test Canvas API anti-aliasing during implementation (no separate POC needed)
4. Implement `PersistenceManager` (NEW) for sample buffering
5. Integrate with existing shared classes:
   - Use `ColorTranslator` for color handling
   - Use `PackedDataProcessor` for packed data modes
   - Use exact `DefaultScopeColors` array from Pascal
6. Add incremental tests for each component

### Phase 3: Display Modes
1. Implement cartesian mode (default)
2. Add polar mode support
3. Add log scale transformations
4. Test all mode combinations with unit tests
5. Verify against Pascal behavior

### Phase 4: Persistence
1. Implement infinite persistence (samples=0)
2. Add fading persistence with opacity gradient
3. Test with various sample counts
4. Add tests for circular buffer edge cases

### Phase 5: Polish & Testing
1. Implement mouse coordinate display
2. Add CLEAR, SAVE, CLOSE commands
3. Complete test suite to reach 80%+ coverage
4. Document any deferred items in technical debt

## Pascal Parity Checklist

Critical behaviors to match:
- [ ] Coordinate scaling: vScale = width/2/range
- [ ] Opacity calculation: 255 - (age * 255 / samples)
- [ ] Circular buffer with power-of-2 mask (2048 samples)
- [ ] Rate control for display updates
- [ ] Channel pairing: sequential values as X,Y
- [ ] Anti-aliased dot rendering (test Canvas API during Phase 2)
- [ ] Mouse coordinate transformation
- [ ] Log scale magnification formula
- [ ] Polar to cartesian conversion
- [ ] Use exact DefaultScopeColors array: [clLime, clRed, clCyan, clYellow, clMagenta, clBlue, clOrange, clOlive]
- [ ] Window sizing constraints (32-2048 pixels)
- [ ] Dot size range (2-20 half-pixels)
- [ ] Circular grid rendering (study Pascal source for exact pattern)
- [ ] No artificial limits on persistent points

**Deferred to Future**:
- [ ] Sub-pixel precision: 256x multiplier (evaluate Canvas API first)

## Risk Mitigation

### Performance Considerations
- Canvas 2D context will use GPU acceleration automatically when available
- Batch rendering updates for better performance
- Optimize persistence rendering if needed (but no artificial limits)

### Compatibility Concerns
- Must match Pascal grid rendering exactly
- Test with all three SCOPE_XY examples from DEBUG-TESTING
- Verify coordinate transformations match Pascal exactly

### Technical Debt
- Sub-pixel precision: Deferred pending Canvas API evaluation
- Anti-aliasing: If Canvas API insufficient, custom implementation deferred
- Document any required deviations from Pascal implementation
- Track any browser-specific rendering issues

## Success Criteria

1. **Functional Parity**: All Pascal features implemented
2. **Visual Parity**: Output matches Pascal implementation
3. **Performance**: Smooth updates at 60fps with 512 samples
4. **Test Coverage**: Minimum 80% for all new code
5. **Documentation**: Complete JSDoc for public API
6. **Integration**: Works with existing debug infrastructure

## Notes on User Feedback

Based on review:
1. **No artificial limits**: Match Pascal exactly - no limiting persistent points
2. **GPU acceleration**: Canvas 2D automatically uses GPU when available
3. **Test examples**: Found 3 SCOPE_XY examples in DEBUG-TESTING folder (cite in JSDoc)
4. **Grid rendering**: Study Pascal source for exact pattern, include in initial implementation
5. **Sub-pixel precision**: Deferred to future unless Canvas API makes it easy
6. **Test files**: Build incrementally as we develop, following established patterns
7. **Anti-aliasing**: Test during Phase 2 implementation, no separate POC needed
8. **JSDoc**: Add comprehensive documentation above class export (Phase 1)
9. **Shared Classes**: Clearly identify NEW vs EXISTING class usage in implementation
10. **Default Colors**: Use exact DefaultScopeColors array from Pascal source