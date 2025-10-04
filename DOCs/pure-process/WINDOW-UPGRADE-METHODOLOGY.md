# Window Upgrade Methodology - Systematic Parity Verification

## 🎯 PURPOSE

This methodology ensures debug window implementations achieve **TRUE 100% Pascal parity** through systematic verification, not assumptions.

**Problem Addressed:** Declaration parsers claiming "works correctly" when directives are silently skipped.

**Applicable To:** SCOPE, PLOT, SCOPEXY, and all future window upgrades

---

## 📋 PRE-UPGRADE PHASE: Complete Directive Inventory

**CRITICAL:** This phase prevents "assumed completeness" bugs that only surface in external testing.

### Step 1: Extract Pascal Directives

**For the window type being upgraded:**

1. **Locate Pascal Source**
   ```bash
   # Main file for most windows
   /pascal-source/P2_PNut_Public/DebugDisplayUnit.pas

   # Find the window's Configure procedure
   grep -n "WINDOWTYPE_Configure" DebugDisplayUnit.pas

   # Find the window's Update procedure
   grep -n "WINDOWTYPE_Update" DebugDisplayUnit.pas
   ```

2. **Extract ALL key_* Cases**
   ```pascal
   // Example from BITMAP_Configure (lines 2369-2407)
   case key of
     key_title:        KeyTitle;           // TITLE directive
     key_pos:          KeyPos;             // POS directive
     key_size:         KeyValSize;         // SIZE directive
     key_dotsize:      KeyDotSize;         // DOTSIZE directive
     key_lut1..key_rgb24: KeyColorMode;    // LUT1-RGB24 directives
     key_longs_1bit..key_bytes_4bit: KeyPack;  // Packed data modes
     key_lutcolors:    KeyLutColors;       // LUTCOLORS directive
     key_trace:        KeyTrace;           // TRACE directive
     key_color:        KeyColor;           // COLOR directive
     key_hidexy:       vFlags := vFlags or flag_hidexy;  // HIDEXY directive
     key_sparse:       KeyVal(vSparse);    // SPARSE directive
     key_ctune:        KeyVal(vColorTune); // CTUNE directive
   ```

3. **Document Each Directive**
   ```markdown
   | Directive | Procedure | Parameters | Declaration? | Runtime? |
   |-----------|-----------|------------|--------------|----------|
   | TITLE | KeyTitle | string | ✅ | ❌ |
   | DOTSIZE | KeyDotSize | x {y} | ✅ | ✅ |
   | LONGS_2BIT | KeyPack | {ALT} {SIGNED} | ✅ | ❌ |
   | LUT2 | KeyColorMode | none | ✅ | ✅ |
   ```

4. **Research Parameter Variants**
   ```pascal
   // For each directive, find its KeyXxx procedure
   // Example: KeyDotSize at line 2380-2384

   procedure KeyDotSize;
   begin
     if NextNum then vDotSize := ClampTo(val, 1, 32);
     if NextNum then vDotSizeY := ClampTo(val, 1, 32)
                else vDotSizeY := vDotSize;  // ← Single value sets BOTH
   end;

   // CONCLUSION: DOTSIZE accepts 1 OR 2 parameters
   ```

### Step 2: Cross-Window Pattern Analysis

**Compare against similar windows already implemented:**

```bash
# Find windows that share directive categories
grep -r "DIRECTIVE_NAME" src/classes/debug*.ts

# Example for packed data modes:
grep -r "LONGS_2BIT" src/classes/debug*.ts
# Results:
# - debugFftWin.ts: Parses in declaration (line 801)
# - debugScopeXyWin.ts: Parses in declaration (line 766)
# - debugBitmapWin.ts: ❌ NOT PARSED (line 298 just says "break")
```

**Questions to answer:**
- Which windows share directive types?
- How do they parse complex directives?
- Are shared utilities being used consistently?
- Why would THIS window be different?

### Step 3: Shared Infrastructure Audit

**Identify existing utilities BEFORE writing new code:**

```bash
# Search for processors, validators, parsers
ls -la src/classes/shared/*Processor.ts
ls -la src/classes/shared/*Validator.ts
ls -la src/classes/shared/*Parser.ts

# Example results:
# - PackedDataProcessor.ts → For LONGS_2BIT, BYTES_4BIT, etc.
# - ColorTranslator.ts → For LUT1-RGB24 modes
# - TracePatternProcessor.ts → For TRACE patterns
# - LUTManager.ts → For LUTCOLORS directive
```

**Create Shared Component Matrix:**
```markdown
| Directive Category | Shared Utility | Used By | Status |
|--------------------|----------------|---------|--------|
| Packed Data Modes | PackedDataProcessor | FFT ✅, ScopeXY ✅, BITMAP ❌ | MISSING |
| Color Modes | ColorTranslator | All windows ✅ | WORKING |
| LUT Colors | LUTManager | All LUT windows ✅ | WORKING |
```

### Step 4: Create Directive Coverage Matrix

**Before ANY implementation, create this complete matrix:**

```markdown
# BITMAP Window Directive Coverage Matrix

## Declaration Directives (parsed in parseBitmapDeclaration)

| Pascal Key | Directive | Parameters | Pascal Handler | TS Parser Line | Status | Notes |
|------------|-----------|------------|----------------|----------------|--------|-------|
| key_title | TITLE | string | KeyTitle:2772 | 184-190 | ✅ COMPLETE | |
| key_pos | POS | left top | KeyPos:2774 | 193-207 | ✅ COMPLETE | |
| key_size | SIZE | w h | KeyValSize:2766 | 209-225 | ✅ COMPLETE | 1-2048 clamped |
| key_dotsize | DOTSIZE | x {y} | KeyDotSize:2380 | 227-255 | ⚠️ INCOMPLETE | Missing single-value variant |
| key_lut1 | LUT1 | none | KeyColorMode:2777 | NOT PARSED | ❌ MISSING | In runtime only |
| key_lut2 | LUT2 | none | KeyColorMode:2777 | NOT PARSED | ❌ MISSING | In runtime only |
| ... | (all 19 color modes) | ... | ... | ... | ❌ MISSING | |
| key_longs_1bit | LONGS_1BIT | {ALT} {SIGNED} | KeyPack:2809 | NOT PARSED | ❌ MISSING | |
| key_longs_2bit | LONGS_2BIT | {ALT} {SIGNED} | KeyPack:2809 | NOT PARSED | ❌ MISSING | |
| ... | (all 12 packed modes) | ... | ... | ... | ❌ MISSING | |
| key_lutcolors | LUTCOLORS | c1..c16 | KeyLutColors:2793 | NOT PARSED | ❌ MISSING | |
| key_trace | TRACE | pattern | KeyTrace:2784 | NOT PARSED | ⚠️ INCOMPLETE | Declaration support? |
| key_color | COLOR | bgnd | KeyColor:2791 | 243-253 | ✅ COMPLETE | |
| key_hidexy | HIDEXY | none | vFlags:2405 | 255-257 | ✅ COMPLETE | |
| key_sparse | SPARSE | mode | KeyVal:2406 | NOT PARSED | ❌ MISSING | |
| key_ctune | CTUNE | tune | KeyVal:2407 | NOT PARSED | ❌ MISSING | |

## Runtime Directives (processed in handleDebugMessage)

| Pascal Key | Directive | Parameters | Pascal Handler | TS Handler Line | Status | Notes |
|------------|-----------|------------|----------------|-----------------|--------|-------|
| key_clear | CLEAR | none | ClearBitmap:2436 | 366-369 | ✅ COMPLETE | |
| key_update | UPDATE | none | BitmapToCanvas:2442 | 387-390 | ✅ COMPLETE | |
| key_set | SET | x y | vPixelX/Y:2428 | 371-385 | ⚠️ INCOMPLETE | Needs validation |
| key_scroll | SCROLL | x y | ScrollBitmap:2434 | 392-400 | ⚠️ INCOMPLETE | Needs validation |
| ... | (continue for all runtime keys) | ... | ... | ... | ... | |

## Summary Statistics
- ✅ COMPLETE: 6/28 directives (21%)
- ⚠️ INCOMPLETE: 4/28 directives (14%)
- ❌ MISSING: 18/28 directives (64%)

**CONCLUSION:** Current claim of "DOTSIZE - Parsed correctly" is FALSE.
Window is missing 64% of Pascal directive support.
```

### Step 5: Validation Criteria

**Define what "100% Pascal Parity" actually means:**

```markdown
## Parity Checklist

### Declaration Parser
- [ ] ALL Pascal Configure directives mapped to TypeScript parser
- [ ] Each directive supports ALL parameter variants (single/multi-value)
- [ ] Color mode directives (LUT1-RGB24) handled in declaration
- [ ] Packed data mode directives (LONGS_1BIT-BYTES_4BIT) handled in declaration
- [ ] Shared utilities (PackedDataProcessor, etc.) properly called
- [ ] Unknown directives logged, not silently skipped

### Runtime Processing
- [ ] ALL Pascal Update directives handled
- [ ] Dynamic color mode switching supported
- [ ] Packed data properly unpacked using explicit or derived mode
- [ ] Commands match Pascal behavior exactly

### Testing
- [ ] Test case for EACH directive variant
- [ ] External hardware testing with real P2
- [ ] Comparison screenshots vs Pascal for visual directives
- [ ] Edge cases: single-value DOTSIZE, packed modes with ALT/SIGNED
```

---

## 🏗️ IMPLEMENTATION PHASE

### Step 1: Fix Gaps in Priority Order

**Priority 1: Critical for Window Creation**
- Declaration parser completeness
- Parameter variant support
- Shared utility integration

**Priority 2: Runtime Functionality**
- Dynamic command handling
- Data processing accuracy

**Priority 3: Visual Polish**
- Mouse hover displays
- Sparse mode rendering
- Color tuning

### Step 2: Implementation Pattern

**For each missing directive:**

1. **Research Pascal behavior**
   ```pascal
   // Find the KeyXxx procedure
   // Document exact behavior
   // Note parameter count/types
   // Identify edge cases
   ```

2. **Check for shared utilities**
   ```bash
   grep -r "similar_directive" src/classes/shared/
   ```

3. **Implement using established patterns**
   ```typescript
   // Example: Packed data mode directive
   case 'LONGS_2BIT':
   case 'LONGS_4BIT':
   // ... (all 12 modes)
     const [isValid, mode] = PackedDataProcessor.validatePackedMode(directive);
     if (isValid) {
       displaySpec.explicitPackedMode = mode;
     }
     break;
   ```

4. **Add test case**
   ```typescript
   test('BITMAP declaration with LONGS_2BIT directive', () => {
     const input = '`BITMAP Test SIZE 32 16 DOTSIZE 8 LUT2 LONGS_2BIT';
     const [isValid, spec] = DebugBitmapWindow.parseBitmapDeclaration(
       input.split(' ')
     );
     expect(isValid).toBe(true);
     expect(spec.explicitPackedMode?.mode).toBe(ePackedDataMode.PDM_LONGS_2BIT);
   });
   ```

5. **Validate with external testing**
   - Real P2 hardware
   - Actual Spin2 code
   - Compare vs Pascal screenshots

---

## ✅ COMPLETION CRITERIA

### Documentation Requirements

**Update WINDOW_UPGRADE_PLAN.md:**
```markdown
### ✅ Configuration Directives (VERIFIED COMPLETE)
- **TITLE** - Parsed correctly (line 184-190) ✅ TESTED
- **POS** - Parsed correctly (lines 193-207) ✅ TESTED
- **DOTSIZE** - Single AND two-value variants (lines 227-255) ✅ TESTED
- **LONGS_2BIT** - Packed mode explicit override (lines 299-306) ✅ TESTED
- **LUT2** - Color mode in declaration (lines 273-295) ✅ TESTED
... (complete list with test confirmation)
```

**Create Directive Test Coverage Report:**
```markdown
# BITMAP Window Directive Test Coverage

## Declaration Directives: 28/28 (100%)
- TITLE: ✅ Unit test + External test
- DOTSIZE: ✅ Single-value test + Two-value test + External test
- LONGS_2BIT: ✅ Unit test + External test with real data
...

## Runtime Directives: 15/15 (100%)
...

## External Test Results
- Hardware: Parallax P2 Edge Module
- Date: 2025-10-04
- Test file: DEBUG_BITMAP.spin2
- Result: Window opens ✅, All directives processed ✅, Visual match vs Pascal ✅
```

### Sign-Off Requirements

**Before claiming "100% Pascal parity":**

- [ ] Directive Coverage Matrix shows 100% (not 21%)
- [ ] All parameter variants tested (not just happy path)
- [ ] External hardware testing passed (not just unit tests)
- [ ] Visual comparison vs Pascal screenshots matched
- [ ] No directives silently skipped in default: case
- [ ] Shared utilities properly integrated
- [ ] Test coverage report completed
- [ ] Cross-window consistency verified

---

## 🔄 LESSONS APPLIED

**From BITMAP Window Failures:**

### What Went Wrong
1. ❌ Plan said "DOTSIZE - Parsed correctly" but only handled 2-value variant
2. ❌ Plan said "Both support packed modes" but declaration parser skipped them
3. ❌ Assumed completeness without systematic verification
4. ❌ Discovered gaps only during external hardware testing
5. ❌ Coverage matrix never created → 64% of directives missing

### What We'll Do Instead
1. ✅ Create directive coverage matrix BEFORE implementation
2. ✅ Document ALL parameter variants from Pascal source
3. ✅ Cross-reference similar windows for pattern consistency
4. ✅ Verify shared utilities are CALLED, not just imported
5. ✅ Test each directive variant individually
6. ✅ Require external test pass before claiming parity

---

## 📊 PROGRESS TRACKING

**Use this template for each window upgrade:**

```markdown
# SCOPE Window Upgrade Status

## Phase 1: Directive Inventory (Target: 8 hours)
- [x] Pascal source analyzed (SCOPE_Configure, SCOPE_Update)
- [x] Directive coverage matrix created (42 total directives)
- [x] Cross-window comparison completed
- [x] Shared infrastructure identified
- [ ] Validation criteria defined

## Phase 2: Implementation (Target: 20 hours)
- [ ] Priority 1: Declaration parser (15 directives)
- [ ] Priority 2: Runtime commands (20 directives)
- [ ] Priority 3: Visual features (7 directives)

## Phase 3: Testing (Target: 6 hours)
- [ ] Unit tests for each directive variant
- [ ] External hardware testing
- [ ] Visual comparison vs Pascal
- [ ] Test coverage report

## Sign-Off
- [ ] Directive coverage: __/42 (100% required)
- [ ] Parameter variants: All tested
- [ ] External test: PASSED
- [ ] Visual match: CONFIRMED
- [ ] Ready for production: YES/NO
```

---

## 🎯 SUCCESS METRICS

### Quantitative
- **Directive coverage:** 100% (not "assumed complete")
- **Test coverage:** 100% of directive variants
- **External test pass rate:** 100% first try
- **Visual parity:** Pixel-perfect match vs Pascal screenshots

### Qualitative
- **No surprises in external testing** - Gaps found during planning, not deployment
- **Systematic verification** - Coverage matrix drives implementation
- **Pattern consistency** - Cross-window comparison ensures uniformity
- **Shared infrastructure** - Reuse over reimplementation

---

**Document Version:** 1.0
**Date:** 2025-10-04
**Status:** MANDATORY for all future window upgrades
**Related:** CODE-REPAIR-METHODOLOGY.md (Declaration Parser Completeness Check)

**Next Windows to Apply:**
- [ ] SCOPE (next priority)
- [ ] PLOT
- [ ] SCOPEXY (if incomplete)
- [ ] Any future window implementations
