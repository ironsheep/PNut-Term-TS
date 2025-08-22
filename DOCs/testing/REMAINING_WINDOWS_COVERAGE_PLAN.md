# Remaining Windows Test Coverage Plan

## Current Status
- **Terminal Window**: ~70% coverage ✅ (exceeds 60% target)
- **Logic Window**: 0% → Target 60%
- **Scope Window**: 0% → Target 60%
- **Bitmap Window**: 0% → Target 60%
- **MIDI Window**: 0% → Target 60%
- **Plot Window**: Has basic tests but needs improvements

## Established Patterns to Apply

### 1. Test Setup Pattern
```javascript
import { setupDebugWindowTests, triggerWindowCreation } from './shared/debugWindowTestUtils';

const { mockContext, cleanup } = setupDebugWindowTests({
  windowType: 'logic',
  displayName: 'TestLogic'
});
```

### 2. Mock Strategy
- Only mock external dependencies (Electron, fs, USB)
- Let internal modules run (canvasRenderer, displaySpecParser, etc.)
- Use JSDOM for canvas operations

### 3. Window Creation Pattern
- Windows are created on first numeric/printable data
- Use updateContent() for all commands
- Verify canvas operations through executeJavaScript spy

### 4. Common Transformations Needed
1. Remove any ANSI support if present (not in Pascal)
2. Fix any Pascal compatibility issues
3. Move direct canvas manipulation to CanvasRenderer
4. Add comprehensive test coverage

## Task List

### Task 1: Logic Window Test Coverage (0% → 60%)
**Priority**: High
**Estimated Time**: 2-3 hours
**Steps**:
1. Apply test setup pattern using debugWindowTestUtils
2. Test parseLogicDeclaration static method
3. Test all numeric actions (scroll, trigger, etc.)
4. Test channel display and grid rendering
5. Test PC_KEY/PC_MOUSE support
6. Verify scrolling and trigger functionality

### Task 2: Scope Window Test Coverage (0% → 60%)
**Priority**: High  
**Estimated Time**: 2-3 hours
**Steps**:
1. Apply test setup pattern
2. Test parseScopeDeclaration static method
3. Test waveform rendering
4. Test trigger modes (AUTO, NORMAL, SINGLE)
5. Test Y-axis scaling and positioning
6. Test coordinate transformation

### Task 3: Bitmap Window Test Coverage (0% → 60%)
**Priority**: High
**Estimated Time**: 3-4 hours (more complex due to trace patterns)
**Steps**:
1. Apply test setup pattern
2. Test parseBitmapDeclaration static method
3. Test all 16 trace patterns
4. Test pixel plotting with DOTSIZE
5. Test LUT color modes
6. Test scrolling patterns

### Task 4: MIDI Window Test Coverage (0% → 60%)
**Priority**: Medium
**Estimated Time**: 2-3 hours
**Steps**:
1. Apply test setup pattern
2. Test parseMidiDeclaration static method
3. Test piano keyboard rendering
4. Test note on/off display
5. Test velocity visualization
6. Test keyboard range settings

### Task 5: Plot Window Enhanced Coverage
**Priority**: Low (already has basic tests)
**Estimated Time**: 1-2 hours
**Steps**:
1. Add tests for sprite operations
2. Test layer compositing
3. Test coordinate transformations
4. Test opacity and blend modes

### Task 6: Canvas Renderer Refactoring for Remaining Windows
**Priority**: Medium
**Estimated Time**: 2-3 hours
**Steps**:
1. Identify direct canvas manipulation in each window
2. Add window-specific methods to CanvasRenderer as needed
3. Update windows to use CanvasRenderer
4. Verify all tests still pass

## Execution Order
1. Logic Window (most similar to Terminal)
2. Scope Window (builds on Logic patterns)
3. Bitmap Window (most complex, needs trace patterns)
4. MIDI Window (unique but simpler)
5. Plot Window enhancements (already has coverage)
6. Canvas Renderer refactoring (as needed per window)

## Success Metrics
- Each window achieves at least 60% coverage
- All tests pass
- No direct canvas manipulation (all through CanvasRenderer)
- Pascal compatibility verified
- Reusable patterns applied consistently

## Time Estimate
Total: 12-17 hours of focused work
- Can be completed in 2-3 days
- Each window can be committed separately
- Patterns become faster to apply with each window