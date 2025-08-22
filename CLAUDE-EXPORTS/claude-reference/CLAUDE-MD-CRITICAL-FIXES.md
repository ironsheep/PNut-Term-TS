# Critical Fixes for CLAUDE.md
## Zero-Friction Todo-MCP v0.6.8 Usage

### REPLACE the Todo-MCP Section with This:

```markdown
## 🎯 Todo-MCP Task Management (v0.6.8)

### CRITICAL: Correct Parameter Usage

**Most functions use `id` parameter (NOT position_id!):**
```bash
mcp__todo-mcp__todo_start id:22              # Start by ID (no #)
mcp__todo-mcp__todo_update id:22 content:"Updated"  # Update by ID
mcp__todo-mcp__todo_pause id:22              # Pause by ID
mcp__todo-mcp__todo_resume id:22             # Resume by ID
mcp__todo-mcp__todo_estimate id:22 minutes:60  # Estimate by ID
mcp__todo-mcp__todo_delete id:22             # Delete by ID
```

**Only 3 functions have dual-parameter support:**
```bash
# These accept EITHER position_id OR task_id
mcp__todo-mcp__todo_complete position_id:1   # OR task_id:"#22"
mcp__todo-mcp__todo_tag_add position_id:1 tags:["urgent"]  # OR task_id:"#22"
mcp__todo-mcp__todo_tag_remove position_id:1 tags:["done"]  # OR task_id:"#22"
```

### Working Efficiently with v0.6.8

```bash
# Recovery after interruption (ALWAYS start here!)
mcp__todo-mcp__context_resume

# CRITICAL: Always verify empty states
mcp__todo-mcp__context_resume     # If shows "(empty)"...
mcp__todo-mcp__context_get_all    # ALWAYS verify!

# Task lifecycle (MUST follow this order)
mcp__todo-mcp__todo_start id:22   # FIRST: Start task
mcp__todo-mcp__todo_complete position_id:1  # THEN: Complete

# List and search
mcp__todo-mpc__todo_list          # If returns "No tasks"...
mcp__todo-mpc__todo_list status:"created"  # Verify with different filter
```

### Critical Rules

**Data Types (MUST be exact):**
- `estimate_minutes:60` - Always NUMBER, never string
- `priority:"high"` - Always lowercase: critical/high/medium/low/backlog
- `status:"in_progress"` - Exact: created/in_progress/paused/completed
- `force:true` - Always BOOLEAN, never string

**Workflow Rules:**
- MUST start before complete (enforced!)
- Only ONE task in_progress at a time
- Bulk operations are atomic (all succeed or all fail)
- Archive before delete (preserves metrics)

**Display vs Input:**
- Output shows: `«#49»` (guillemets for display)
- Input uses: `#49` or `49` (NEVER guillemets)

### Tag Auto-Extraction

**Trailing tags (removed completely):**
```bash
"Fix bug #urgent #backend" → "Fix bug" + [urgent, backend]
```

**Inline tags (word stays):**
```bash
"Fix the #bug in parser" → "Fix the bug in parser" + [bug]
```

### Quick Reference

```bash
# Start work
mcp__todo-mpc__context_resume     # Check state
mcp__todo-mpc__todo_next          # Get recommendation
mcp__todo-mpc__todo_start id:N    # Start task

# Complete work
mcp__todo-mpc__todo_complete position_id:N  # Finish task
mcp__todo-mpc__todo_archive       # Archive completed

# Backup/Restore
mcp__todo-mpc__project_dump include_context:true  # Full backup
mcp__todo-mpc__project_restore file:"[path]" mode:"replace"  # Restore
```
```

### Context Management Section Update:

Remove the conflicting guidance about `working_on` - either show it as valid OR say not to use it, not both.

### Remove These Incorrect Examples:
- ❌ `todo_start position_id:22` 
- ❌ `todo_update position_id:22`
- ❌ Any suggestion to use position_id except for complete/tag functions
```

## New Friction Log Entry

```markdown
# Todo-MCP v0.6.8 Friction Log (Fresh Start)

## Date: 2025-08-12
## Based on: Corrected documentation from interface/test analysis

### SUCCESS: Ground Truth Established
- Derived correct parameter usage from interface analysis
- Validated workflows through acceptance test study
- Fixed documentation errors that were causing friction

### FRICTION: Interface Parameter Inconsistency
**Issue**: The todo-mcp v0.6.8 interface has THREE different parameter patterns:
1. Legacy functions use `id:number`
2. Only 3 functions have dual-parameter support
3. Bulk operations use different patterns entirely

**Impact**: This inconsistency causes confusion and errors. Users must remember which pattern each function uses.

**Recommendation for v0.6.9**: Standardize ALL functions to accept dual-parameter pattern for consistency.

### FRICTION: Error Messages Don't Guide to Solution
**Issue**: When wrong parameter used, error doesn't suggest correct format
**Example**: "Invalid parameter 'position_id'" doesn't say "Use id:22 instead"
**Recommendation**: Error messages should include correct usage example
```