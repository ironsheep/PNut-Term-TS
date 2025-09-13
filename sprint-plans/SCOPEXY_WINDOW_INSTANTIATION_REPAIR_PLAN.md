# ScopeXY Window Instantiation Repair Plan

**Version**: 1.0  
**Date**: 2025-09-11  
**Priority**: Critical - ScopeXY windows are not being created properly  
**Estimated Effort**: 2-3 hours for complete fix  

## Executive Summary

The ScopeXY window class has a **critical instantiation flaw**: Unlike the working Scope window, **ScopeXY never calls `createDebugWindow()`**, so the actual browser window is never created. The class is instantiated but the window remains invisible and non-functional.

## Root Cause Analysis

### ✅ Working Pattern: Scope Window
```typescript
// In DebugScopeWindow.processMessageImmediate() - lines 1022-1029
if (!this.windowCreated) {
  this.createDebugWindow();  // ← WINDOW GETS CREATED
  this.windowCreated = true;
}
```

### ❌ Broken Pattern: ScopeXY Window  
```typescript
// In DebugScopeXyWindow.processMessageImmediate() - lines 463-466
protected processMessageImmediate(lineParts: string[]): void {
  const unparsedCommand = lineParts.join(' ');
  this.handleData(unparsedCommand);
  // ← MISSING: createDebugWindow() call!
}
```

## Key Differences Identified

### Window Creation Timing

**Scope Window (WORKING)**:
1. Constructor creates class instance
2. First data message → `processMessageImmediate()` 
3. Checks `!this.windowCreated` → calls `this.createDebugWindow()`
4. Browser window created and shown

**ScopeXY Window (BROKEN)**:
1. Constructor creates class instance  
2. First data message → `processMessageImmediate()`
3. Only calls `handleData()` - **no window creation**
4. Browser window never created

### Constructor Differences

**Scope Window**: Deferred window creation (correct pattern)
```typescript
constructor(ctx: Context, displaySpec: ScopeDisplaySpec, windowId: string = `scope-${Date.now()}`) {
  super(ctx, windowId, 'scope');
  // No window creation in constructor - waits for first data
}
```

**ScopeXY Window**: Immediate window creation (incorrect implementation)
```typescript
createDebugWindow(lineParts: string[]): void {
  // Method exists but never gets called!
  // Creates HTML and BrowserWindow properly
}
```

## Detailed Fix Plan

### Phase 1: Add Window Creation Trigger (30 minutes)

#### 1.1 Add Window Creation Flag
**File**: `src/classes/debugScopeXyWin.ts`
**Location**: After line 141 (private rateCounter declaration)

**EXACT CODE TO ADD**:
```typescript
// Window creation state
private windowCreated: boolean = false;
```

#### 1.2 Implement Window Creation Logic  
**File**: `src/classes/debugScopeXyWin.ts`  
**Location**: Replace lines 463-466 (processMessageImmediate method)

**BEFORE**:
```typescript
protected processMessageImmediate(lineParts: string[]): void {
  const unparsedCommand = lineParts.join(' ');
  this.handleData(unparsedCommand);
}
```

**AFTER**:
```typescript
protected processMessageImmediate(lineParts: string[]): void {
  // Create window on first data if not already created
  if (!this.windowCreated) {
    this.createDebugWindow(lineParts);
    this.windowCreated = true;
  }
  
  const unparsedCommand = lineParts.join(' ');
  this.handleData(unparsedCommand);
}
```

### Phase 2: Fix Window Creation Method (15 minutes)

#### 2.1 Update createDebugWindow Method Signature
**File**: `src/classes/debugScopeXyWin.ts`
**Location**: Line 325 method signature

The method already accepts `lineParts: string[]` parameter correctly, so no change needed here.

### Phase 3: Ensure Proper Configuration Parsing (15 minutes)

#### 3.1 Verify Configuration Parsing
**File**: `src/classes/debugScopeXyWin.ts`
**Location**: Lines 325-327

The configuration parsing in `createDebugWindow()` should work correctly:
```typescript
createDebugWindow(lineParts: string[]): void {
  // Parse configuration
  this.parseConfiguration(lineParts);
  // ... rest of method
}
```

### Phase 4: Testing and Validation (60-90 minutes)

#### 4.1 Unit Test Creation
**File**: Create `tests/scopeXyWindowCreation.test.ts`

**EXACT TEST CODE**:
```typescript
import { DebugScopeXyWindow } from '../src/classes/debugScopeXyWin';
import { Context } from '../src/utils/context';

describe('ScopeXY Window Creation', () => {
  test('should create window on first data message', () => {
    const ctx = new Context();
    const spec = { displayName: 'TestXY', title: 'Test', hasExplicitPosition: false };
    const scopeXy = new DebugScopeXyWindow(ctx, spec);
    
    // Mock the createDebugWindow method
    const createWindowSpy = jest.spyOn(scopeXy as any, 'createDebugWindow');
    
    // Simulate first data message
    const lineParts = ['TestXY', '100', '200'];
    (scopeXy as any).processMessageImmediate(lineParts);
    
    expect(createWindowSpy).toHaveBeenCalledOnce();
    expect(createWindowSpy).toHaveBeenCalledWith(lineParts);
  });
  
  test('should not create window multiple times', () => {
    const ctx = new Context();
    const spec = { displayName: 'TestXY', title: 'Test', hasExplicitPosition: false };
    const scopeXy = new DebugScopeXyWindow(ctx, spec);
    
    const createWindowSpy = jest.spyOn(scopeXy as any, 'createDebugWindow');
    
    // Send multiple messages
    (scopeXy as any).processMessageImmediate(['TestXY', '100', '200']);
    (scopeXy as any).processMessageImmediate(['TestXY', '101', '201']);
    
    expect(createWindowSpy).toHaveBeenCalledOnce();
  });
});
```

#### 4.2 Integration Testing
**Manual Test Procedure**:
1. **Start PNut-Term-TS**
2. **Send SCOPE_XY command**: `SCOPE_XY TestXY SIZE 100 SAMPLES 0`
3. **Verify window appears**: Should see ScopeXY window open
4. **Send data**: `TestXY 50 75` 
5. **Verify data plotting**: Should see point plotted on grid

#### 4.3 Compare with Working Scope Window
**Test Script**:
```typescript
// Send both SCOPE and SCOPE_XY commands
debug(`SCOPE TestScope SIZE 200 100 SAMPLES 512`);
debug(`TestScope 'Channel1' 0 100 80 10 %1111 GREEN 15`);
debug(`TestScope \`(50)`);

debug(`SCOPE_XY TestXY SIZE 100 RANGE 200 SAMPLES 0`);
debug(`TestXY \`(50, 75)`);
```

**Expected Result**: Both windows should appear and function identically

### Phase 5: Error Handling and Edge Cases (30 minutes)

#### 5.1 Add Error Recovery
**File**: `src/classes/debugScopeXyWin.ts`
**Location**: Update processMessageImmediate method

**ENHANCED VERSION**:
```typescript
protected processMessageImmediate(lineParts: string[]): void {
  // Create window on first data if not already created
  if (!this.windowCreated) {
    try {
      this.createDebugWindow(lineParts);
      this.windowCreated = true;
    } catch (error) {
      this.logMessage(`Failed to create ScopeXY window: ${error.message}`);
      // Still mark as created to prevent infinite retry
      this.windowCreated = true;
      return;
    }
  }
  
  const unparsedCommand = lineParts.join(' ');
  this.handleData(unparsedCommand);
}
```

#### 5.2 Handle Edge Cases
- **Empty lineParts**: Add validation
- **Multiple SCOPE_XY commands**: Ensure single window creation
- **Window creation failure**: Graceful degradation

## Implementation Sequence

### Session 1 (30 minutes): Core Fix
- [ ] Add `windowCreated` flag
- [ ] Implement window creation trigger in `processMessageImmediate()`
- [ ] Test with simple SCOPE_XY command

### Session 2 (60 minutes): Testing & Validation  
- [ ] Create unit tests for window creation
- [ ] Manual testing with P2 hardware
- [ ] Compare behavior with working Scope window
- [ ] Verify all ScopeXY features work after fix

### Session 3 (30 minutes): Polish & Documentation
- [ ] Add error handling for window creation failures
- [ ] Update documentation with corrected behavior
- [ ] Performance testing with multiple ScopeXY windows

## Success Criteria

- [ ] **ScopeXY windows appear** when SCOPE_XY command is sent
- [ ] **Data plotting works** - points appear on canvas grid
- [ ] **Window management** - can open/close/resize normally  
- [ ] **Multiple windows** - can create several ScopeXY windows
- [ ] **Configuration options** - SIZE, RANGE, SAMPLES work correctly
- [ ] **Mouse interaction** - coordinate display functions
- [ ] **Performance** - no degradation compared to Scope windows

## Risk Assessment

### Low Risk Changes
- Adding `windowCreated` flag - simple boolean
- Window creation trigger - follows proven Scope window pattern
- Unit tests - no impact on production code

### Medium Risk Changes  
- Modifying `processMessageImmediate()` - core message handling
- Error handling - must not break existing functionality

### Mitigation Strategy
- **Incremental testing** after each change
- **Fallback plan** - revert to original if issues arise
- **Parallel development** - test on branch before main merge

## Verification Checklist

### Before Implementation
- [ ] Current ScopeXY windows don't appear (confirmed broken)
- [ ] Scope windows work correctly (reference implementation)
- [ ] Test environment ready with P2 hardware

### After Implementation  
- [ ] ScopeXY windows appear when commanded
- [ ] Data plotting functions correctly
- [ ] Window controls (close, resize, move) work
- [ ] Multiple ScopeXY windows supported
- [ ] No regression in other debug windows
- [ ] Performance acceptable

### Edge Case Testing
- [ ] Invalid SCOPE_XY commands handled gracefully
- [ ] Window creation failures don't crash application
- [ ] Rapid successive SCOPE_XY commands work correctly
- [ ] Memory cleanup on window close

## File Change Summary

| File | Changes | Risk Level |
|------|---------|------------|
| `src/classes/debugScopeXyWin.ts` | Add window creation trigger | Medium |
| `tests/scopeXyWindowCreation.test.ts` | New test file | Low |
| Documentation updates | Implementation notes | Low |

## Post-Implementation

### Performance Monitoring
- Monitor window creation times
- Check memory usage with multiple ScopeXY windows
- Verify no impact on other debug window performance

### User Experience
- ScopeXY windows should behave identically to Scope windows
- Configuration options should work as documented
- Error messages should be clear and actionable

---

**Status**: Ready for implementation  
**Estimated Total Time**: 2-3 hours  
**Complexity**: Low-Medium (follows existing proven pattern)  
**Confidence**: High (root cause clearly identified, fix is straightforward)