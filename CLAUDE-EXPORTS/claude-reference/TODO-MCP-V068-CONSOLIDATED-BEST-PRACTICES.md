# Todo-MCP v0.6.8 Consolidated Best Practices
## The Authoritative Guide Derived from Interface and Testing Analysis

### Document Authority
This document represents the TRUE operational knowledge of todo-mcp v0.6.8, derived from:
1. Direct interface analysis - what the functions actually accept
2. Acceptance test patterns - how the system should be used
3. Conflict resolution - fixing documented errors

## 🟢 IMPORTANT: System Flexibility

### Todo-MCP is UNRESTRICTED
- **Context storage**: Use ANY key names that make sense for your work
- **Task descriptions**: Format however helps you understand the work
- **No prescribed patterns**: This document shows what HAS worked, not what MUST be done
- **Adapt to YOUR needs**: The system is designed to be flexible

This guide documents **observations**, not **requirements**. Use what helps, ignore what doesn't.

## 🔴 CRITICAL: Parameter Usage (Correct This Time!)

### The Three Parameter Patterns (Reality)

**Pattern 1: Legacy Functions** (most common)
```bash
# These use 'id' parameter (number WITHOUT #)
mcp__todo-mcp__todo_start id:22
mcp__todo-mcp__todo_update id:22 content:"Updated"
mcp__todo-mcp__todo_delete id:22
mcp__todo-mcp__todo_pause id:22
mcp__todo-mcp__todo_resume id:22
mcp__todo-mcp__todo_estimate id:22 minutes:60
```

**Pattern 2: Dual-Parameter Functions** (only 3 functions!)
```bash
# These accept EITHER position_id OR task_id
mcp__todo-mcp__todo_complete position_id:1  # OR task_id:"#22"
mcp__todo-mcp__todo_tag_add position_id:1 tags:["urgent"]  # OR task_id:"#22"
mcp__todo-mcp__todo_tag_remove position_id:1 tags:["done"]  # OR task_id:"#22"
```

**Pattern 3: Bulk Operations**
```bash
# Use filters or task_ids array
mcp__todo-mcp__todo_bulk operation:"set_priority" filters:{status:"created"} data:{priority:"high"}
mcp__todo-mcp__todo_bulk operation:"add_tags" task_ids:[1,2,3] data:{tags:["sprint-1"]}
```

### Task ID Format Rules

**In Output (What You See)**:
- Always displayed with guillemets: `«#49»`
- Example: `1. ○ 🔴 Task name «#49»`

**In Input (What You Type)**:
- NEVER use guillemets
- Use: `#49` or `49` or `"#49"`
- NEVER: `«#49»` or `"«#49»"`

## 🔴 CRITICAL: Task Lifecycle

### The Enforced Sequence
```bash
# MUST follow this order - enforced by system
mcp__todo-mcp__todo_start id:22  # Step 1: Start the task
mcp__todo-mcp__todo_complete position_id:1  # Step 2: Complete it

# WRONG - Will fail
mcp__todo-mcp__todo_complete position_id:1  # Cannot complete without starting
```

### Single Active Task Rule
- Only ONE task can be in_progress at a time
- Starting a new task auto-pauses the current one
- No exceptions to this rule

## 🔴 CRITICAL: Always Verify Empty States

### The Verification Pattern
**This catches critical bugs where functions incorrectly report empty:**

```bash
# PATTERN 1: Context appears empty
mcp__todo-mcp__context_resume  # Shows "Working Memory: (empty)"
mcp__todo-mcp__context_get_all  # ALWAYS RUN THIS - might have data!

# PATTERN 2: Search returns nothing
mcp__todo-mcp__todo_list search:"bug"  # Shows "No tasks found"
mcp__todo-mcp__todo_list  # VERIFY - are there really no tasks?

# PATTERN 3: Archive reports nothing
mcp__todo-mpc__todo_archive  # "No completed tasks to archive"
mcp__todo-mpc__todo_list status:"completed"  # VERIFY the status
```

## 🟡 IMPORTANT: Tag Auto-Extraction Intelligence

### How Tags Are Extracted from Content

**Rule 1: Trailing tags are removed completely**
```bash
"Fix parser bug #urgent #backend"
→ Content: "Fix parser bug"
→ Tags: [urgent, backend]
```

**Rule 2: Inline tags keep the word**
```bash
"Fix the #bug in parser"
→ Content: "Fix the bug in parser"
→ Tags: [bug]
```

**Rule 3: Special cases**
- Tags in quotes ignored: `"Error '#failed' in logs"` → No tags
- Markdown headers ignored: `"# Header text"` → No tags  
- Must have space before #: `"fix#bug"` → No extraction
- Unicode supported: `"Fix #système"` → Tag: [système]

**Best Practice**: Place tags at the end for cleanest extraction

## 🟡 IMPORTANT: Priority and Status Enums

### Priority Values (EXACT, lowercase)
```bash
priority:"critical"  # ⚡ symbol
priority:"high"      # 🔴 symbol
priority:"medium"    # 🟡 symbol
priority:"low"       # 🟢 symbol
priority:"backlog"   # 🔵 symbol
```

### Status Values (EXACT, lowercase)
```bash
status:"created"      # ○ symbol (default)
status:"in_progress"  # ◐ symbol
status:"paused"       # ⊘ symbol
status:"completed"    # ● symbol
```

## 🟡 IMPORTANT: Data Types

### Critical Type Requirements
```bash
# estimate_minutes MUST be number
estimate_minutes:60   # ✅ CORRECT
estimate_minutes:"60" # ❌ WRONG - string not accepted

# force MUST be boolean
force:true   # ✅ CORRECT
force:"true" # ❌ WRONG - string not accepted
```

## Multi-Line STF Display Format

### Task Display Structure
```
N. [status] [priority] [content] [timing] «#ID»
   🏷️ #tag1 #tag2 #tag3
   ⛔ Blocked by: «#42» (future feature)
```

**Components**:
- Position number (changes as tasks complete)
- Status symbol: ○ ◐ ⊘ ●
- Priority symbol: ⚡ 🔴 🟡 🟢 🔵
- Content (with tags extracted)
- Timing: `(est: 2h)` or `(elapsed: 45m)` or `(actual: 1h 30m)`
- Task ID in guillemets: `«#49»`
- Tags on line 2 with 3-space indent
- Dependencies on line 3 (when implemented)

## Atomic Operations

### Bulk Operations Are All-or-Nothing
```bash
# If ANY task ID is invalid, ENTIRE operation rolls back
mcp__todo-mpc__todo_bulk operation:"set_priority" task_ids:[1,999,3] data:{priority:"high"}
# Task 999 doesn't exist → NO tasks updated

# Atomic means safe - partial updates never happen
```

## Recovery Patterns

### Primary Recovery Command
```bash
mcp__todo-mpc__context_resume  # ALWAYS start here after interruption
```

Shows:
- Tasks in progress with elapsed time
- Context grouped by prefix with ages
- Next recommended tasks
- Summary statistics

### Context Storage - UNRESTRICTED
**The context system has NO restrictions on key naming or usage.**

**Observed patterns from successful projects** (not requirements):
```bash
# Some projects used prefixes for bulk operations:
context_delete pattern:"temp_*"  # Made cleanup easier

# Others used descriptive names without prefixes
# Both approaches worked well
```

**Key insight**: Use whatever naming helps YOUR workflow. The system is completely flexible.

## Data Safety Patterns

### Archive Before Delete
```bash
# GOOD - Preserves metrics
mcp__todo-mpc__todo_archive  # Exports THEN clears completed

# AVOID - Loses data
mcp__todo-mpc__todo_clear_completed  # Just deletes
```

### Complete Backup/Restore
```bash
# Full system backup including context
mcp__todo-mpc__project_dump include_context:true
# Returns: tasks/backups/project_dump_TIMESTAMP.json

# Complete restore after disaster
mcp__todo-mpc__project_restore file:"[path]" mode:"replace"

# Restore modes:
# - replace: Clear and restore
# - merge: Add to existing
# - validate: Dry run
```

## Smart Task Selection

### The todo_next Algorithm
Considers in order:
1. **Dependencies** (blocked tasks excluded)
2. **Priority** (critical → high → medium → low → backlog)
3. **Sequence** (manual ordering within priority)
4. **Age** (older tasks preferred)

```bash
mcp__todo-mpc__todo_next  # Trust the recommendation
```

## Sequence System for Manual Ordering

### Setting Custom Order
```bash
# Set sequence values
mcp__todo-mpc__todo_update id:1 sequence:10
mcp__todo-mpc__todo_update id:2 sequence:20
mcp__todo-mpc__todo_update id:3 sequence:15

# Sort by sequence
mcp__todo-mpc__todo_list sort_by:"sequence" sort_order:"asc"
# Shows: Task 1 (seq:10), Task 3 (seq:15), Task 2 (seq:20)
```

## Search and Filter Capabilities

### Search is Comprehensive
```bash
# Searches in: content, tags, IDs
mcp__todo-mpc__todo_list search:"bug"  # Finds in content OR tags
```

### Filters Can Combine
```bash
# Multiple filters work together
mcp__todo-mpc__todo_list status:"created" priority:"high" search:"bug"
```

### Sort Options
```bash
sort_by:"priority"   # By priority level
sort_by:"created"    # By creation time
sort_by:"updated"    # By last update
sort_by:"estimate"   # By time estimate
sort_by:"sequence"   # By manual sequence
```

## Export Formats

### Available Formats
```bash
format:"markdown"  # Human-readable checklist
format:"json"      # Complete data preservation
format:"csv"       # Spreadsheet import
format:"org"       # Org-mode format
```

## Performance Expectations

### Normal Operating Parameters
- **100 tasks**: <100ms response expected
- **1000 tasks**: Linear scaling, still responsive
- **Bulk operations**: Atomic but may take time
- **Design target**: 100-200 tasks typical

## MCP Server Requirements

### Critical Operating Rules
1. **ALWAYS test through MCP server** - Never isolated binaries
2. **NO direct file access** - Everything through MCP methods
3. **Server controls validation** - Trust server responses
4. **Server maintains state** - Context and task consistency

## Common Pitfalls to Avoid

### ❌ WRONG Parameter Usage
```bash
# WRONG - These will fail
mcp__todo-mpc__todo_start position_id:1  # Should be id:1
mcp__todo-mpc__todo_update position_id:1  # Should be id:1
```

### ❌ WRONG Task Lifecycle
```bash
# WRONG - Cannot complete without starting
mcp__todo-mpc__todo_complete position_id:1  # Must start first
```

### ❌ WRONG Data Types
```bash
# WRONG - Types matter
estimate_minutes:"60"  # Must be number
priority:"HIGH"        # Must be lowercase
force:"true"          # Must be boolean
```

### ❌ Trusting Empty Responses
```bash
# WRONG - Always verify
context_resume  # Shows empty
# Should run context_get_all to verify!
```

## Summary: The Todo-MCP v0.6.8 Philosophy

1. **Verify Everything** - Never trust empty states
2. **Atomic Safety** - All-or-nothing operations
3. **Smart Automation** - Tag extraction, priority logic
4. **Resilient Recovery** - context_resume after interruptions
5. **Data Preservation** - Archive before delete
6. **Enforced Workflow** - Start before complete
7. **Single Focus** - One active task at a time

This system is designed for long-running projects with multiple interruptions, providing both intelligence and safety in task management. Follow these practices for zero-friction operation.