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

## 📚 **REMEMBER: THIS IS A LARGE, COMPLEX APPLICATION**

- **Thousands of lines** of working code
- **Complex data flows** that function correctly
- **Established patterns** that must be preserved
- **Multiple subsystems** that depend on each other
- **Working chunk assembly** and stream parsing
- **Functioning message routing** with minor edge cases

**The goal is to fix edge cases while preserving the working foundation.**

---

**Document Version:** 1.0  
**Date:** 2025-08-21  
**Status:** MANDATORY REFERENCE - Read before ANY code changes  
**Violation Consequence:** Potential destruction of working systems