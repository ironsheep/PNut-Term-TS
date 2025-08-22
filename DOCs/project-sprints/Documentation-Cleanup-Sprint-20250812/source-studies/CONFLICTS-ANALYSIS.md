# CLAUDE.md vs Best Practices Conflict Analysis

## Executive Summary
Found **CRITICAL CONFLICTS** in parameter guidance between CLAUDE.md and the new best practices document derived from the actual v0.6.8 interface.

## 🔴 CRITICAL CONFLICTS

### 1. WRONG Parameter Guidance in CLAUDE.md

**CLAUDE.md says (INCORRECT):**
```bash
mcp__todo-mcp__todo_start position_id:22  # Start by task ID (number, no #)
mcp__todo-mcp__todo_complete position_id:22
mcp__todo-mcp__todo_update position_id:22 status:"in_progress"
```

**ACTUAL Interface (from Best Practices):**
```bash
mcp__todo-mcp__todo_start id:22  # Uses 'id' not 'position_id'
mcp__todo-mcp__todo_update id:22  # Uses 'id' not 'position_id'
# Only todo_complete uses position_id OR task_id
```

**Impact**: Following CLAUDE.md will cause errors for start/update operations!

### 2. Misleading Comments

**CLAUDE.md line 27 says:**
```bash
mcp__todo-mpc__todo_start position_id:22  # Start by task ID (number, no #)
```
The comment says "task ID" but shows "position_id" - these are DIFFERENT concepts!

### 3. Incomplete Parameter Documentation

**CLAUDE.md says:**
- "Most functions use position_id:22 (number, no #)"

**Reality (from interface analysis):**
- Most functions use `id:number`
- Only todo_complete and tag functions use position_id
- Tag functions are the ONLY ones with dual-parameter support

## ✅ AGREEMENTS

### Both Documents Agree On:

1. **Lifecycle Requirements**
   - Must start before complete ✅
   - Only one in_progress task ✅

2. **Data Types**
   - estimate_minutes must be number ✅
   - Priority enum values exact ✅
   - Status enum values exact ✅

3. **Tag Extraction**
   - Tags at end removed cleanly ✅
   - Mid-sentence tags keep word ✅

4. **Context Patterns**
   - Semantic prefixes (lesson_, temp_, etc.) ✅
   - context_resume as primary recovery ✅

5. **Bulk Operations**
   - Atomic (all or nothing) ✅

## 🟡 CLARIFICATIONS NEEDED

### Context Usage Conflict

**CLAUDE.md shows:**
```bash
mcp__todo-mpc__context_set key:"working_on" value:"debugFFT.ts:234"
```
Then later says:
"Don't Use Context For: Current task status (`working_on`)"

**Recommendation**: Clarify when working_on is appropriate vs duplicative.

## 📋 RECOMMENDATIONS

### Immediate Fixes for CLAUDE.md:

1. **Fix Parameter Names**
```bash
# CHANGE THIS:
mcp__todo-mpc__todo_start position_id:22

# TO THIS:
mcp__todo-mpc__todo_start id:22
```

2. **Clarify Dual-Parameter Functions**
```markdown
Functions with dual-parameter support:
- todo_complete: position_id OR task_id
- todo_tag_add: position_id OR task_id  
- todo_tag_remove: position_id OR task_id

Functions using id only:
- todo_start: id:number
- todo_update: id:number
- todo_delete: id:number
- todo_pause: id:number
- todo_resume: id:number
- todo_estimate: id:number
```

3. **Fix Misleading Comments**
```bash
# CHANGE:
mcp__todo-mpc__todo_start position_id:22  # Start by task ID

# TO:
mcp__todo-mpc__todo_start id:22  # Start by task ID (without #)
```

## Summary

The CLAUDE.md file contains **critical parameter errors** that will cause function calls to fail. The most serious issue is using `position_id` where `id` is required. This affects:
- todo_start
- todo_update  
- todo_pause
- todo_resume
- todo_estimate
- todo_delete

The new best practices document, derived from the actual interface, provides the correct parameter names and should be considered authoritative for v0.6.8.