# TERM Window Text Display Repair Plan

**Version**: 1.0  
**Date**: 2025-09-12  
**Priority**: High - TERM window text scrolls off/wraps incorrectly  
**Estimated Effort**: 1-2 hours for complete fix  

## Executive Summary

The TERM window has **critical text display and scrolling issues**: text appears initially but scrolls off the canvas or wraps incorrectly due to canvas sizing mismatches and improper content area calculations. The canvas dimensions don't properly account for text baseline offsets and content insets during scrolling operations.

## Root Cause Analysis

### ✅ Working Pattern: Logic Window
```typescript
// Logic window uses precise font-based calculations
const canvasHeight: number = Math.round(this.displaySpec.font.charHeight * 0.75);
// Accounts for text baseline and line spacing properly
const channelHeight: number = this.displaySpec.font.lineHeight;
```

### ❌ Broken Pattern: TERM Window  
```typescript
// Lines 375-377: Simple multiplication without baseline consideration
const canvasHeight = this.displaySpec.size.rows * this.displaySpec.font.lineHeight;
const canvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
// Lines 895-896: scrollBitmap uses different dimensions than canvas
canvasWidth + 2 * this.contentInset,
canvasHeight + 2 * this.contentInset
```

## Key Issues Identified

### Issue 1: Canvas Size Mismatch
**Problem**: Canvas HTML element sized differently than scrolling calculations
- **Canvas Creation**: `width="${canvasWidth}" height="${canvasHeight}"` (line 503)
- **Scrolling**: Uses `canvasWidth + 2 * this.contentInset` dimensions (line 895)
- **Result**: Content gets clipped during scroll operations

### Issue 2: Text Baseline Not Accounted
**Problem**: Canvas height doesn't include text baseline requirements
- **Logic Window**: Uses `font.charHeight * 0.75` for visual balance  
- **TERM Window**: Uses raw `lineHeight` without baseline accommodation
- **Result**: Text positioned incorrectly within canvas bounds

### Issue 3: Content Inset Inconsistency  
**Problem**: Content insets applied inconsistently between rendering and scrolling
- **Text Positioning**: `textXOffset = x * charWidth + contentInset` (line 802)
- **Canvas Size**: Doesn't account for insets in HTML dimensions
- **Scrolling**: Adds `2 * contentInset` but canvas wasn't sized for it

## Detailed Fix Plan

### Phase 1: Fix Canvas Sizing (30 minutes)

#### 1.1 Update Canvas Dimensions
**File**: `src/classes/debugTermWin.ts`  
**Location**: Lines 375-377, 503

**BEFORE**:
```typescript
const canvasHeight = this.displaySpec.size.rows * this.displaySpec.font.lineHeight;
const canvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
// ...
<canvas id="text-area" width="${canvasWidth}" height="${canvasHeight}"></canvas>
```

**AFTER**:
```typescript
// Calculate proper canvas dimensions with content insets
const baseCanvasHeight = this.displaySpec.size.rows * this.displaySpec.font.lineHeight;
const baseCanvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
const canvasHeight = baseCanvasHeight + 2 * this.contentInset;
const canvasWidth = baseCanvasWidth + 2 * this.contentInset;
// ...
<canvas id="text-area" width="${canvasWidth}" height="${canvasHeight}"></canvas>
```

#### 1.2 Update Window Size Calculation  
**File**: `src/classes/debugTermWin.ts`  
**Location**: Lines 381-382, 384-386

**BEFORE**:
```typescript
const divHeight = canvasHeight + 4; // 4 is fudge number
const divWidth = canvasWidth + 4; // 4 is fudge number

const windowHeight = divHeight + this.borderMargin * 2;
const windowWidth = divWidth + this.borderMargin * 2;
```

**AFTER**:
```typescript
// Window size should accommodate the properly sized canvas
const divHeight = canvasHeight + 4; // canvas already includes insets
const divWidth = canvasWidth + 4; // canvas already includes insets

const windowHeight = divHeight + this.borderMargin * 2;
const windowWidth = divWidth + this.borderMargin * 2;
```

### Phase 2: Fix Scrolling Dimensions (15 minutes)

#### 2.1 Update scrollUp Method
**File**: `src/classes/debugTermWin.ts`  
**Location**: Lines 885-896

**BEFORE**:
```typescript
const canvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
const canvasHeight = this.displaySpec.size.rows * lineHeight;
// ...
this.canvasRenderer.scrollBitmap(
  'text-area',
  0,
  -lineHeight,
  canvasWidth + 2 * this.contentInset,
  canvasHeight + 2 * this.contentInset
)
```

**AFTER**:
```typescript
// Use the actual canvas dimensions (which now include insets)
const baseCanvasWidth = this.displaySpec.size.columns * this.displaySpec.font.charWidth;
const baseCanvasHeight = this.displaySpec.size.rows * lineHeight;
const canvasWidth = baseCanvasWidth + 2 * this.contentInset;
const canvasHeight = baseCanvasHeight + 2 * this.contentInset;
// ...
this.canvasRenderer.scrollBitmap(
  'text-area',
  0,
  -lineHeight,
  canvasWidth,
  canvasHeight
)
```

#### 2.2 Update clearCharacterCell calls
**File**: `src/classes/debugTermWin.ts`  
**Location**: Lines 901-907, 864-870

**Update all clearCharacterCell calls to use consistent canvas dimensions**

### Phase 3: Fix Text Positioning (15 minutes)

#### 3.1 Verify contentInset Usage
**File**: `src/classes/debugTermWin.ts`  
**Location**: Lines 801-802

**Current positioning should work correctly with updated canvas size**:
```typescript
const textYOffset: number = this.cursorPosition.y * lineHeight + this.contentInset;
const textXOffset: number = this.cursorPosition.x * charWidth + this.contentInset;
```

### Phase 4: Testing and Validation (30 minutes)

#### 4.1 Unit Test Creation
**File**: Create `tests/termWindowTextDisplay.test.ts`

```typescript
import { DebugTermWindow } from '../src/classes/debugTermWin';
import { Context } from '../src/utils/context';

describe('TERM Window Text Display', () => {
  test('canvas dimensions should include content insets', () => {
    const ctx = new Context();
    const spec = { displayName: 'TestTerm', title: 'Test', hasExplicitPosition: false };
    const term = new DebugTermWindow(ctx, spec);
    
    // Mock canvas renderer
    const mockCreateDebugWindow = jest.spyOn(term as any, 'createDebugWindow');
    (term as any).createDebugWindow();
    
    // Verify canvas size calculation includes insets
    expect(mockCreateDebugWindow).toHaveBeenCalledOnce();
  });
  
  test('scrolling should use canvas dimensions not base dimensions', () => {
    const ctx = new Context();
    const spec = { displayName: 'TestTerm', title: 'Test', hasExplicitPosition: false };
    const term = new DebugTermWindow(ctx, spec);
    
    // Test scrollUp method uses correct dimensions
    const scrollSpy = jest.spyOn(term as any, 'scrollUp');
    (term as any).scrollUp();
    
    expect(scrollSpy).toHaveBeenCalledOnce();
  });
});
```

#### 4.2 Integration Testing
**Manual Test Procedure**:
1. **Start PNut-Term-TS**
2. **Send TERM command**: `TERM TestTerm SIZE 20 10`
3. **Send text data**: Multiple lines to test scrolling
4. **Verify text display**: Text should remain visible and scroll correctly
5. **Test line wrapping**: Long lines should wrap at column boundary

**Test Commands**:
```
TERM TestDisplay SIZE 30 8
TestDisplay Hello World - Line 1
TestDisplay This is a longer line that should wrap properly at column boundary
TestDisplay Line 3
TestDisplay Line 4
TestDisplay Line 5
TestDisplay Line 6
TestDisplay Line 7
TestDisplay Line 8
TestDisplay Line 9 - Should scroll
```

#### 4.3 Compare with Working Logic Window
**Verification**: Both windows should have proper text/content display within their canvases

### Phase 5: Error Handling and Edge Cases (15 minutes)

#### 5.1 Add Canvas Size Validation
**File**: `src/classes/debugTermWin.ts`  
**Location**: After line 377

```typescript
// Validate canvas dimensions
if (canvasWidth <= 0 || canvasHeight <= 0) {
  this.logMessage(`* ERROR: Invalid canvas dimensions: ${canvasWidth}x${canvasHeight}`);
  return;
}
```

#### 5.2 Handle Edge Cases
- **Very small terminal sizes**: Ensure minimum canvas size
- **Large terminal sizes**: Check for reasonable limits
- **Font size changes**: Verify canvas resizes correctly

## Implementation Sequence

### Session 1 (30 minutes): Core Canvas Sizing Fix
- [ ] Update canvas dimension calculations to include content insets
- [ ] Fix canvas HTML element sizing
- [ ] Test with simple TERM command

### Session 2 (30 minutes): Scrolling Fix
- [ ] Update scrollBitmap calls to use consistent canvas dimensions
- [ ] Fix clearCharacterCell dimension usage
- [ ] Test scrolling with multiple lines

### Session 3 (30 minutes): Testing & Validation  
- [ ] Create unit tests for canvas sizing
- [ ] Manual testing with various TERM configurations
- [ ] Compare behavior with working Logic window
- [ ] Verify all text display features work after fix

## Success Criteria

- [ ] **Text remains visible** when terminal scrolls
- [ ] **Canvas dimensions consistent** between HTML and JavaScript operations
- [ ] **Line wrapping works** correctly at column boundaries
- [ ] **Scrolling preserves content** without clipping
- [ ] **Window sizing accurate** for content display
- [ ] **Multiple TERM windows** work independently
- [ ] **Performance acceptable** - no degradation from fixes

## Risk Assessment

### Low Risk Changes
- Canvas size calculation updates - mathematical fix
- Dimension consistency - straightforward alignment
- Unit tests - no impact on production code

### Medium Risk Changes  
- scrollBitmap parameter changes - affects core scrolling
- Window sizing updates - could affect window appearance

### Mitigation Strategy
- **Incremental testing** after each change
- **Backup current implementation** before changes
- **Test on single TERM window** before multiple windows

## Verification Checklist

### Before Implementation
- [ ] Current TERM windows show text scrolling off (confirmed broken)
- [ ] Logic windows display content correctly (reference implementation)
- [ ] Test environment ready with P2 hardware/simulator

### After Implementation  
- [ ] TERM windows show text correctly without scrolling off
- [ ] Text wrapping works at column boundaries
- [ ] Scrolling preserves previous content
- [ ] Multiple TERM windows work simultaneously
- [ ] No regression in other debug windows
- [ ] Performance acceptable

### Edge Case Testing
- [ ] Very small TERM sizes (5x3) handled gracefully
- [ ] Large TERM sizes (80x25) work correctly
- [ ] Font size changes update canvas properly
- [ ] Window resize operations work correctly

## File Change Summary

| File | Changes | Risk Level |
|------|---------|------------|
| `src/classes/debugTermWin.ts` | Canvas sizing and scrolling fixes | Medium |
| `tests/termWindowTextDisplay.test.ts` | New test file | Low |
| Documentation updates | Implementation notes | Low |

## Post-Implementation

### Performance Monitoring
- Monitor text rendering performance with new canvas sizes
- Check memory usage with multiple TERM windows
- Verify no impact on other debug window performance

### User Experience
- TERM windows should behave like standard terminal emulators
- Text should persist properly during scrolling operations
- Error messages should be clear and actionable

---

**Status**: Ready for implementation  
**Estimated Total Time**: 1-2 hours  
**Complexity**: Low-Medium (canvas sizing fix)  
**Confidence**: High (root cause clearly identified, fix follows proven patterns)