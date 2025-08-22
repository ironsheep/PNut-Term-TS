# Todo-MCP v0.6.8 Best Practices
## Derived from Acceptance Test Plan

### Document Purpose
This document derives best practices entirely from studying the v0.6.8 acceptance test plan - what the tests reveal about how the system is intended to be used.

## Core Philosophy: Complete System Validation

The test plan reveals a fundamental principle:
- **EVERY operation must be verified** - Never trust "empty" responses
- **Complete testing is mandatory** - No shortcuts allowed
- **Iterative improvement** - Multiple passes until perfect

**Best Practice**: Always verify system state after operations, especially when results seem empty.

## Task Identification System

### Three Ways to Reference Tasks
From the tests, tasks can be referenced using:
1. **position_id**: Number representing current position in list (changes as tasks complete)
2. **task_id**: Permanent ID with or without # prefix ("#2", "2", "«#2»")
3. **Guillemet format**: «#N» appears in output but NEVER used in input

**Best Practice**:
```bash
# For interactive work - use position you see in list
mcp__todo-mcp__todo_start position_id:1

# For automation/scripts - use permanent task ID
mcp__todo-mcp__todo_complete task_id:"#42"

# Never input guillemets - they're display-only
# WRONG: task_id:"«#42»"
# RIGHT: task_id:"#42"
```

## Task Lifecycle Management

### Required Sequence
The tests clearly show:
```bash
mcp__todo-mpc__todo_start position_id:1  # MUST start first
mcp__todo-mpc__todo_complete position_id:1  # THEN complete
```

**Best Practice**: Never attempt to complete a task without starting it first. The system enforces this.

### Only One Active Task
Tests demonstrate that starting a second task auto-pauses the first:
```bash
mcp__todo-mpc__todo_start position_id:1  # Task 1 active
mcp__todo-mpc__todo_start position_id:2  # Task 1 auto-pauses, Task 2 active
```

## Priority System

### Five Exact Priority Levels
Tests show these exact strings (case-sensitive):
- **critical** → ⚡ symbol
- **high** → 🔴 symbol
- **medium** → 🟡 symbol
- **low** → 🟢 symbol
- **backlog** → 🔵 symbol

**Best Practice**: Always use lowercase priority strings exactly as shown.

### Priority-Based Recommendations
The `todo_next` function uses sophisticated logic:
1. Highest priority first
2. Within priority, sequence ordering
3. Within sequence, oldest task

## Tag Management Intelligence

### Auto-Extraction Rules
The tests reveal sophisticated tag extraction:

**Trailing tags removed completely**:
```bash
"Fix parser bug #urgent #backend" → "Fix parser bug" + [urgent, backend]
```

**Inline tags keep the word**:
```bash
"Fix the #bug in parser" → "Fix the bug in parser" + [bug]
```

**Special cases**:
- Tags in quotes ignored: "'#failed' in logs" → No tags extracted
- Markdown headers ignored: "# Header" → No tags extracted
- Must have space before #: "fix#bug" → No extraction

**Best Practice**: Place tags at the end for cleanest extraction.

## Multi-Line STF Display Format

### Standard Task Format Structure
Tests show tasks display in multi-line format:
```
N. [status] [priority] [content] [timing] «#ID»
   🏷️ #tag1 #tag2 #tag3
   ⛔ Blocked by: «#42»
```

**Key elements**:
- Status symbols: ○ (created) ◐ (in_progress) ⊘ (paused) ● (completed)
- Priority symbols: ⚡ 🔴 🟡 🟢 🔵
- Tags on separate line with 3-space indent
- Dependencies on separate line (future feature)

## Bulk Operations Are Atomic

### All-or-Nothing Principle
Tests demonstrate that bulk operations rollback completely if any part fails:
```bash
mcp__todo-mpc__todo_bulk action:"priority" task_ids:["#4","#999","#5"] value:"low"
# Task #999 doesn't exist → ENTIRE operation rolls back
```

**Best Practice**: Validate all IDs before bulk operations. One bad ID cancels everything.

## Export/Import Workflow

### Complete Data Preservation
Tests show a critical workflow:
```bash
mcp__todo-mpc__project_dump include_context:true  # Full backup
mcp__todo-mpc__todo_clear_all force:true  # Disaster strikes
mcp__todo-mpc__project_restore file_path:"[dump]" mode:"replace"  # Full recovery
```

**Best Practice**: Use project_dump/restore for complete backup, not just todo_export.

### Three Restore Modes
- **replace**: Clear existing, restore from backup
- **merge**: Add to existing data
- **validate**: Dry run without changes

## Context Management for Recovery

### Context Resume is Primary Recovery
Tests emphasize:
```bash
mcp__todo-mpc__context_resume  # ALWAYS use this after interruption
```

This shows:
- Tasks in progress with elapsed time
- Context keys grouped by prefix
- Next recommended tasks

**Best Practice**: After any interruption, always start with context_resume.

### Semantic Key Prefixes
Tests demonstrate pattern-based organization:
- `lesson_*` - Permanent learnings
- `temp_*` - Delete when done
- `workaround_*` - Tool fixes
- `session_*` - Cross-session data

**Best Practice**: Use consistent prefixes for easy pattern-based deletion.

## Verification Pattern

### Never Trust Empty States
Tests repeatedly emphasize:
```bash
mcp__todo-mpc__context_resume  # Shows "(empty)"
mcp__todo-mpc__context_get_all  # ALWAYS verify - might have data!
```

**Best Practice**: When ANY operation returns empty/none, run a verification command.

## Archive Before Delete

### Safe Data Management
Tests prefer archive over deletion:
```bash
mcp__todo-mpc__todo_archive  # Exports THEN clears completed
# Better than:
mcp__todo-mpc__todo_clear_completed  # Just deletes
```

**Best Practice**: Always archive for metrics preservation.

## Sequence System

### Manual Task Ordering
Tests show sequence field for custom ordering:
```bash
mcp__todo-mpc__todo_update position_id:1 sequence:10
mcp__todo-mpc__todo_update position_id:2 sequence:20
mcp__todo-mpc__todo_list sort_by:"sequence"  # Custom order
```

**Best Practice**: Use sequence for dependency-like ordering within same priority.

## Error Prevention Patterns

### Parameter Validation
Tests reveal these patterns prevent errors:
- estimate_minutes must be a number, not string
- priority must be exact enum value
- force:true required for destructive operations
- Empty content rejected in creation

**Best Practice**: Validate parameters before submission to avoid failed operations.

## Performance Expectations

### Response Time Guidelines
Tests suggest (when performance testing requested):
- 100 task list: <100ms expected
- 1000 task export: Should scale linearly
- Bulk operations: Atomic but may take time

**Best Practice**: Design for 100-200 tasks as normal load.

## Testing Philosophy

### Iterative Improvement
The test plan reveals an iterative approach:
1. Test everything
2. Document all issues
3. Fix issues
4. Test everything again
5. Repeat until perfect

**Best Practice**: Never skip testing phases. Quality comes from iteration.

## Key Insights from Test Structure

### 1. MCP Server Testing Only
Tests emphasize NEVER testing isolated binaries - always through MCP server. This suggests the server adds critical validation and state management.

### 2. No Direct File Access
Tests forbid reading export files directly. Everything must go through MCP methods. This indicates the server controls all data access.

### 3. Grammar Matters
Entire section dedicated to error message grammar suggests professional communication is a priority.

### 4. Documentation Quality Critical
Section 0 evaluates function documentation, suggesting Claude's effectiveness depends on clear descriptions.

## Summary of Best Practices

From the acceptance tests, the system is designed for:

1. **Reliable task management** with enforced lifecycles
2. **Smart automation** through tag extraction and priority logic
3. **Complete data safety** via atomic operations and archives
4. **Interruption resilience** through context_resume
5. **Professional quality** with grammar checks and documentation
6. **Iterative perfection** through comprehensive testing

The tests reveal a system built for long-running projects with multiple interruptions, requiring both safety and intelligence in task management.