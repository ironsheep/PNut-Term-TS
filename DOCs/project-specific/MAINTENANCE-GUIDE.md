# PNut-Term-TS Maintenance Guide

## 🎯 CRITICAL PROJECT GUIDANCE

This guide documents the **essential principles** for maintaining and improving PNut-Term-TS without destroying working functionality.

## 📋 **PROJECT STATUS UNDERSTANDING**

### **WHAT WE HAVE:**
- ✅ **Fundamentally working system** - core functionality operates correctly
- ✅ **Working stream processing** - chunk assembly and parsing function
- ✅ **Working message routing foundation** - basic routing patterns established
- ⚠️ **UI edge cases** - menu rendering, JavaScript errors, DOM issues
- ⚠️ **Routing edge cases** - some messages going to wrong destinations

### **WHAT WE'RE NOT BUILDING:**
- ❌ **New parsing system** - chunk assembly already works
- ❌ **New routing system** - core routing patterns already established  
- ❌ **New data flow** - fundamental message flow is correct

## 🚨 **CRITICAL MAINTENANCE RULES**

### **RULE 1: PRESERVE WORKING FOUNDATION**
```
The underlying structure IS WORKING
Do not fix/break/fix/break cycle
Make only progressive forward changes
```

### **RULE 2: SURGICAL FIXES ONLY**
```
Fix edge cases without touching working systems
UI fixes = UI-only changes
Routing fixes = change destinations only
Never rewrite working functions
```

### **RULE 3: REFERENCE ROBUST EXAMPLES**
```
Study existing working patterns in codebase
Use established patterns for any fixes
Don't invent new approaches when patterns exist
```

## 🔧 **MAINTENANCE METHODOLOGY**

### **BEFORE ANY CHANGE:**

1. **IDENTIFY LAYER**
   ```
   Layer 1: Stream Processing (chunk assembly) - DO NOT TOUCH
   Layer 2: Message Parsing (boundaries, validation) - CAREFUL FIXES ONLY  
   Layer 3: Message Routing (destinations) - FIX EDGE CASES
   Layer 4: User Interface (rendering, DOM) - SAFE TO FIX
   ```

2. **SCOPE THE PROBLEM**
   ```
   What specific edge case is broken?
   What layer does it affect?
   Are other layers working correctly?
   ```

3. **FIND WORKING EXAMPLE**
   ```
   How does this work elsewhere in codebase?
   What patterns are established?
   What does the robust example show?
   ```

4. **MINIMAL INTERVENTION**
   ```
   Change only the specific broken piece
   Preserve all existing patterns
   Use established approaches
   ```

## 📊 **LAYERED SYSTEM ARCHITECTURE**

### **Layer 1: STREAM PROCESSING** 🔒 PROTECTED
```
handleSerialRx() → chunk accumulation → message boundary detection
STATUS: WORKING - DO NOT MODIFY
CONTAINS: Serial data assembly, EOL detection, 80-byte validation
```

### **Layer 2: MESSAGE PARSING** ⚠️ CAREFUL
```
Text message extraction → Binary packet validation → Mixed data handling  
STATUS: MOSTLY WORKING - EDGE CASE FIXES ONLY
ISSUES: Some parsing edge cases, validation improvements needed
```

### **Layer 3: MESSAGE ROUTING** 🔧 FIX DESTINATIONS
```
Text messages → Logger/Windows, Binary packets → Debugger windows
STATUS: WORKING FOUNDATION - FIX WRONG DESTINATIONS  
ISSUES: P2 messages in main terminal, false DTR logging
```

### **Layer 4: USER INTERFACE** ✅ SAFE TO FIX
```
Menu rendering → JavaScript handlers → DOM elements → Visual feedback
STATUS: EDGE CASES - SAFE TO FIX WITHOUT AFFECTING LOWER LAYERS
ISSUES: Menu not showing, JavaScript errors, missing DOM elements
```

## 🎯 **SYSTEMATIC REPAIR PROCESS**

### **PHASE 1: FOUNDATION VALIDATION**
1. **Verify Layer 1** is untouched and working
2. **Validate Layer 2** against robust examples  
3. **Fix Layer 3** routing destinations
4. **Test Layers 1-3** work together

### **PHASE 2: UI REPAIR**  
1. **Fix Layer 4** UI issues
2. **Validate** all layers still work
3. **Test** complete functionality

### **PHASE 3: INTEGRATION TESTING**
1. **Full system test** with P2 hardware
2. **Edge case validation**
3. **Regression testing**

## 📝 **COMMON EDGE CASES TO FIX**

### **ROUTING EDGE CASES:**
- P2 system messages appearing in main terminal (should be logger only)
- False DTR reset logging when no DTR pressed
- Debug messages contaminating main blue terminal area

### **UI EDGE CASES:**
- Menu bar not rendering (HTML/CSS/DOM issues)
- JavaScript execution failures (missing DOM elements)
- Event handler registration problems

### **PARSING EDGE CASES:**
- Mixed binary/text chunks not handled optimally
- Message boundary detection edge cases
- 80-byte packet validation improvements

## ⚠️ **WARNING SIGNS TO STOP AND REASSESS**

- **Considering rewriting** any function longer than 20 lines
- **Modifying Layer 1** stream processing in any way
- **Changing established** data flow patterns
- **Creating new approaches** instead of using existing patterns
- **Uncertainty about** existing behavior or impact

## 🔍 **DECISION FRAMEWORK**

### **FOR ANY PROPOSED CHANGE, ASK:**

1. **"Is this preserving the working foundation?"**
   - If No → Reconsider approach
   - If Uncertain → Ask for guidance

2. **"Am I only fixing the specific edge case?"**  
   - If No → Scope down the change
   - If Uncertain → Investigate more

3. **"Could this affect other working systems?"**
   - If Yes → Get guidance first
   - If Uncertain → Test more thoroughly

4. **"Is there a working example I can follow?"**
   - If Yes → Use that pattern
   - If No → Ask if pattern exists elsewhere

## 📚 **REFERENCE MATERIALS**

- **CODE-REPAIR-METHODOLOGY.md** - General repair principles
- **P2-MESSAGE-ROUTING-ARCHITECTURE.md** - How routing should work
- **Existing working code** - Study before changing
- **Test cases** - Validate against expected behavior

## 🎯 **SUCCESS CRITERIA**

### **GOOD MAINTENANCE:**
- ✅ Working functionality preserved
- ✅ Edge cases fixed without side effects
- ✅ UI improvements without breaking backend
- ✅ Progressive forward movement only
- ✅ No regression in core functionality

### **MAINTENANCE TO AVOID:**
- ❌ Fix/break cycles
- ❌ Rewriting working systems  
- ❌ Creating new problems while fixing old ones
- ❌ Touching foundational code unnecessarily
- ❌ Scope creep during focused fixes

---

**Remember: This is a fundamentally working system with edge cases to fix.**  
**Our job is to polish and improve, not rebuild.**

**Document Version:** 1.0  
**Date:** 2025-08-21  
**Status:** MANDATORY REFERENCE for all maintenance work  
**Review:** Before any code changes