# Code Repair Methodology - Critical Guidelines

## 🚨 PROBLEMS WE'VE HAD AND WON'T REPEAT

### ❌ **DESTRUCTIVE PATTERNS TO NEVER USE AGAIN**

1. **REPLACING WORKING FUNCTIONS**
   - **Don't:** Rewrite entire functions that are working
   - **Problem:** Destroyed chunk assembly, stream parsing, message routing
   - **Result:** Lost 2.5 days rebuilding working functionality

2. **ASSUMING SYSTEMS ARE BROKEN**
   - **Don't:** Think "this looks wrong, let me fix it"
   - **Problem:** Replaced working async processing with "synchronous only"
   - **Result:** Broke fundamental data flow patterns

3. **SCOPE CREEP DURING FIXES**
   - **Don't:** "While I'm here, let me improve this other thing"
   - **Problem:** UI fix became parser rewrite
   - **Result:** Multiple systems broken simultaneously

4. **BYPASSING EXISTING PATTERNS**
   - **Don't:** Create new code paths that skip working systems
   - **Problem:** Added "immediate processing" that bypassed debugger parser
   - **Result:** Lost chunk accumulation and message boundary detection

## ✅ **CORRECT CODE REPAIR METHODOLOGY**

### **CORE PRINCIPLE: PRESERVE WHAT WORKS**
```
This is a WORKING CODEBASE with EDGE CASE BUGS
Not a broken system needing overhaul
```

### **STEP 1: INVESTIGATE BEFORE CHANGING**
```markdown
1. READ the existing code thoroughly
2. UNDERSTAND the current data flow
3. FIND similar working examples in codebase
4. IDENTIFY the specific deviation/bug
5. ASK if unsure about existing behavior
```

### **STEP 2: SURGICAL FIX ONLY**
```markdown
1. Change ONLY the specific broken piece
2. Keep ALL existing patterns intact
3. Preserve ALL working functionality
4. Make minimal possible change
```

### **STEP 3: VALIDATION QUESTIONS**
Before any change, ask:
- **Am I preserving existing behavior?**
- **Am I only fixing the specific edge case?**
- **Could this affect other systems?**
- **Is this the minimal possible change?**

## 🎯 **SPECIFIC REPAIR RULES**

### **FOR LARGE APPLICATIONS:**
- **Never modify** core parsing/routing functions
- **Never replace** working data flow patterns  
- **Never assume** existing code is wrong
- **Never make** "improvements" during bug fixes

### **EDGE CASE IDENTIFICATION:**
- **Menu not showing** = UI rendering issue (not parser problem)
- **Wrong routing destination** = Change one routing line (not rewrite router)
- **JavaScript errors** = DOM element missing (not UI system rebuild)
- **False logging** = Remove one log line (not rewrite logger)

### **WHEN TO ASK FOR GUIDANCE:**
- **Any change affecting multiple functions**
- **Uncertainty about existing behavior**  
- **Potential impact on other systems**
- **Need to understand working patterns**

## 📝 **INVESTIGATION PROCESS**

### **Before Making ANY Change:**

1. **SCOPE THE PROBLEM**
   ```
   What exactly is broken?
   What should it do instead?
   Where is this supposed to work?
   ```

2. **FIND WORKING EXAMPLES**
   ```
   How does this work elsewhere in codebase?
   What patterns are already established?
   What similar code works correctly?
   ```

3. **TRACE THE DATA FLOW**
   ```
   How should data move through this system?
   Where is the flow breaking?
   What's the minimal intervention point?
   ```

4. **VALIDATE APPROACH**
   ```
   Will this preserve all existing behavior?
   Am I only fixing the specific bug?
   Could this impact other systems?
   ```

## ⚠️ **RED FLAGS - STOP AND ASK**

- **Rewriting any function** longer than 10 lines
- **Changing data flow patterns** that exist elsewhere
- **Modifying core parsing/routing** logic
- **Adding new code paths** that bypass existing systems
- **"Improving" code** that wasn't identified as broken
- **Uncertainty about** how existing code should work

## 🎯 **SUCCESS METRICS**

### **Good Fix:**
- ✅ Addresses specific reported bug
- ✅ Preserves all existing functionality  
- ✅ Uses established patterns
- ✅ Changes minimal lines of code
- ✅ No side effects on other systems

### **Bad Fix:**
- ❌ Rewrites working functionality
- ❌ Changes established patterns
- ❌ Affects multiple systems
- ❌ Makes "improvements" beyond the bug
- ❌ Creates new problems

## 🔍 **DECLARATION PARSER COMPLETENESS CHECK**

**Problem:** Declaration parsers can silently skip directives, causing "100% parity" claims to be false.

**Symptoms:**
- Window fails to open with "parse result: isValid=false"
- Directives work in Pascal but ignored in TypeScript
- Other windows handle the same directive correctly
- Shared utilities exist but aren't called

### **MANDATORY STEPS for Declaration Parser Repairs:**

#### **Step 1: Cross-Window Comparison**
```bash
# Search for the directive across all windows
grep -r "DIRECTIVE_NAME" src/classes/debug*.ts

# Question to answer:
# - Do other windows parse this directive?
# - If YES: Why doesn't this window?
# - Pattern comparison: What's different?
```

**Example:**
```bash
grep -r "LONGS_2BIT" src/classes/debug*.ts
# Found in: debugFftWin.ts (line 801), debugScopeXyWin.ts (line 766)
# Missing in: debugBitmapWin.ts
# CONCLUSION: BITMAP should parse it too
```

#### **Step 2: Pascal Source Research FIRST**
```bash
# Before skipping ANY directive, verify Pascal behavior
# Search Pascal: key_directive_name in WINDOW_Configure, WINDOW_Update

# Questions to answer:
# - Does Pascal handle this explicitly?
# - Is it processed during declaration or runtime?
# - What parameters does it accept?
# - Are there single/multiple value variants?
```

**Example:**
```pascal
// DebugDisplayUnit.pas line 2395-2396
key_longs_1bit..key_bytes_4bit: KeyPack;  // Pascal EXPLICITLY processes

// If Pascal handles it explicitly → TypeScript MUST handle it too
```

#### **Step 3: Shared Infrastructure Audit**
```bash
# Check if we already have utilities for this category
grep -r "Processor\|Validator\|Parser" src/classes/shared/

# Questions to answer:
# - Do shared utilities exist for this directive category?
# - Is the window importing them?
# - Are the utility functions being CALLED?
```

**Example:**
```typescript
// File imports PackedDataProcessor ✅
import { PackedDataProcessor } from './shared/packedDataProcessor';

// But declaration parser doesn't call validatePackedMode() ❌
// default: break;  // Silent skip = BUG

// CORRECT:
default:
  const [isValid, mode] = PackedDataProcessor.validatePackedMode(token);
  if (isValid) { displaySpec.packedMode = mode; }
```

#### **Step 4: Complete Directive Inventory**
```markdown
# Create a coverage matrix for ALL directives

| Pascal Directive | Parameters | TypeScript Handler | Status |
|------------------|------------|-------------------|--------|
| TITLE | string | line 184-190 | ✅ WORKING |
| DOTSIZE | x {y} | line 227-241 | ⚠️ Missing single-value |
| LONGS_2BIT | none | NOT PARSED | ❌ MISSING |
| LUT2 | none | NOT IN DECLARATION | ❌ MISSING |

# Process:
1. Extract ALL key_* cases from Pascal WINDOW_Configure
2. Extract ALL key_* cases from Pascal WINDOW_Update
3. Map each to TypeScript parser location
4. Identify gaps (Pascal has, TypeScript doesn't)
5. Fix ALL gaps, not just the reported symptom
```

#### **Step 5: Parameter Variant Detection**
```markdown
# Many directives accept MULTIPLE formats

Pascal Examples:
- DOTSIZE 8        → Single value (x=8, y=8)
- DOTSIZE 8 8      → Two values (x=8, y=8)
- LONGS_2BIT       → Packed mode directive
- LONGS_2BIT ALT   → With modifier
- LONGS_2BIT SIGNED → With different modifier

# Test BOTH/ALL variants in external testing
# Don't assume single format works for all cases
```

### **Checklist for Declaration Parser Fixes:**

- [ ] Searched other windows for this directive pattern
- [ ] Read Pascal source for explicit handling
- [ ] Verified shared utilities exist and are CALLED
- [ ] Created complete directive inventory from Pascal
- [ ] Identified ALL parameter variants
- [ ] Added test cases for each variant
- [ ] Confirmed fix works in external testing (not just unit tests)

### **Prevention:**

**For NEW window implementations or upgrades:**
- Use `WINDOW-UPGRADE-METHODOLOGY.md` process
- Create directive coverage matrix FIRST
- Validate completeness BEFORE claiming "100% parity"

## 📚 **REMEMBER: THIS IS A LARGE, COMPLEX APPLICATION**

- **Thousands of lines** of working code
- **Complex data flows** that function correctly
- **Established patterns** that must be preserved
- **Multiple subsystems** that depend on each other
- **Working chunk assembly** and stream parsing
- **Functioning message routing** with minor edge cases

**The goal is to fix edge cases while preserving the working foundation.**

---

**Document Version:** 1.1 (Added Declaration Parser Completeness Check)  
**Date:** 2025-08-21  
**Status:** MANDATORY REFERENCE - Read before ANY code changes  
**Violation Consequence:** Potential destruction of working systems