# Todo-MCP v0.6.8 Best Practices
## Derived from Interface Analysis

### Document Purpose
This document derives best practices from studying the todo-mcp v0.6.8 interface itself - what the functions reveal about intended usage patterns through their descriptions, parameters, and design.

## Parameter Consistency Audit

### Critical Finding: Inconsistent Parameter Naming
The v0.6.8 interface has **THREE different parameter patterns** for task identification:

1. **Legacy Pattern** (most functions):
   - `id: number` - Task ID without # prefix
   - Used by: todo_update, todo_delete, todo_start, todo_pause, todo_resume, todo_estimate

2. **Dual-Parameter Pattern** (tag functions only):
   - `position_id: number` OR `task_id: "#49"` (string with # prefix)
   - Used by: todo_tag_add, todo_tag_remove
   - These are the ONLY functions with true dual-parameter support

3. **Position-Based Pattern** (completion):
   - `position_id: number` OR `task_id: "#49"`
   - Used by: todo_complete
   - Requires task to be in_progress first

### Recommendation: Parameter Standardization Needed
The interface would benefit from consistent dual-parameter support across ALL task operations, not just tag functions.

## Best Practices Derived from Interface

### 1. Task Lifecycle Management

**From function descriptions:**
- `todo_start` → `todo_complete` is REQUIRED sequence
- Only ONE task can be in_progress at a time (enforced)
- `todo_pause` and `todo_resume` for interruptions

**Best Practice:**
```bash
# Always follow this lifecycle
mcp__todo-mcp__todo_start id:22
# ... do work ...
mcp__todo-mcp__todo_complete position_id:1  # or task_id:"#22"
```

### 2. Tag Auto-Extraction Intelligence

**From todo_create description:**
- Tags at end are removed completely: 'Fix bug #urgent' → 'Fix bug'
- Tags mid-sentence keep the word: 'Fix #urgent bug' → 'Fix urgent bug'
- Tags in quotes are ignored
- Unicode is supported

**Best Practice:**
```bash
# Good: Tags at end for clean extraction
"Implement feature #backend #urgent"

# Avoid: Tags after prepositions
"Work on #frontend"  # Becomes "Work on"

# Better: Complete thought before tags
"Work on frontend #ui"
```

### 3. Estimation Requirements

**From interface patterns:**
- `estimate_minutes` is ALWAYS type `number`, never string
- Required for todo_create
- Can be updated with todo_estimate or todo_update

**Best Practice:**
```bash
# Always provide realistic estimates
mcp__todo-mcp__todo_create content:"Task" estimate_minutes:60  # NOT "60"
```

### 4. Bulk Operations Are Atomic

**From todo_bulk description:**
- All operations use transactions
- If any fail, all rollback
- Operations: add_tags, remove_tags, set_priority, set_status, resequence

**Best Practice:**
```bash
# Bulk operations for consistency
mcp__todo-mcp__todo_bulk operation:"set_priority" data:{priority:"high"} filters:{status:"created"}
# Either ALL tasks update or NONE do
```

### 5. Context Management Patterns

**From context functions:**
- `context_set/get` for key-value storage
- `context_delete` supports patterns (glob and regex)
- `context_resume` is the PRIMARY recovery command
- Keys have semantic prefixes

**Best Practice:**
```bash
# Use semantic key prefixes
mcp__todo-mcp__context_set "lesson_*"      # Permanent learning
mcp__todo-mcp__context_set "temp_*"        # Delete when done
mcp__todo-mcp__context_set "workaround_*"  # Tool fixes
mcp__todo-mcp__context_set "recovery_*"    # Problem solutions

# After interruption, ALWAYS:
mcp__todo-mcp__context_resume  # Shows tasks + context
```

### 6. Priority Levels Are Fixed

**From multiple function enums:**
- EXACTLY: critical, high, medium, low, backlog
- No other values accepted
- Used consistently across create, update, bulk

**Best Practice:**
```bash
# Use exact priority strings
priority:"high"     # Correct
priority:"HIGH"     # Wrong - case sensitive
priority:"urgent"   # Wrong - not in enum
```

### 7. Status Progression

**From status enums:**
- States: created → in_progress → completed
- Alternative: created → in_progress → paused → in_progress → completed
- Only ONE in_progress task at a time

**Best Practice:**
```bash
# Status must follow valid transitions
created → in_progress    # Valid
paused → completed       # Invalid (must resume first)
```

### 8. Archive Before Clear

**From function descriptions:**
- `todo_archive` exports then clears completed tasks
- `todo_clear_all` requires force:true for incomplete tasks
- Archive is safer than clear_completed

**Best Practice:**
```bash
# Always archive for metrics
mcp__todo-mcp__todo_archive  # Preserves data
# Avoid todo_clear_all unless necessary
```

### 9. Project Backup Strategy

**From project_dump/restore:**
- `project_dump` includes tasks, sessions, optionally context
- `project_restore` supports modes: replace, merge, append
- Checksums validate integrity

**Best Practice:**
```bash
# Regular backups with context
mcp__todo-mcp__project_dump include_context:true

# Restore with validation
mcp__todo-mcp__project_restore file:"backup.json" mode:"merge"
```

### 10. Smart Task Selection

**From todo_next:**
- Algorithm considers priority, dependencies, age, workload
- Returns highest-scoring available task
- Empty response if nothing available

**Best Practice:**
```bash
# Let the algorithm choose
mcp__todo-mcp__todo_next  # Trust the scoring
```

## Interface Design Insights

### 1. Dual System Philosophy
The interface reveals two persistence layers:
- **Tasks**: Survive compaction, tracked in database
- **Context**: Key-value store for state recovery
- Designed for interruption resilience

### 2. Human-Readable Output
From STF format descriptions:
- Visual symbols: ◐=in_progress, ●=created, ○=completed
- Priority colors: ⚡=critical, 🔴=high, 🟡=medium, 🟢=low
- Position + permanent ID shown together

### 3. Intelligent Defaults
- Auto-extraction of tags
- Single in_progress enforcement
- Atomic bulk operations
- Smart task ordering

### 4. Recovery-First Design
- `context_resume` as primary recovery
- WHERE WAS I? philosophy
- Session handoff support
- Backup/restore capabilities

## Recommendations for v0.6.9

Based on interface analysis:

1. **Standardize Parameters**
   - Use dual-parameter pattern everywhere
   - Consistent id vs task_id vs position_id

2. **Enhance Error Messages**
   - Include valid parameter formats
   - Suggest corrections

3. **Add Shortcuts**
   - `todo_complete_by_id` for direct ID use
   - `todo_start_next` combining next + start

4. **Improve Consistency**
   - All functions should support both position and ID
   - Standardize parameter names across functions

## Summary

The v0.6.8 interface reveals a well-thought-out task management system with:
- **Strong recovery capabilities** (context_resume)
- **Intelligent automation** (tag extraction, task selection)
- **Safety features** (atomic operations, required lifecycles)
- **Inconsistent parameters** (main friction point)

The interface design prioritizes resilience and recovery over simplicity, making it excellent for long-running projects with interruptions, though parameter inconsistency creates unnecessary friction.