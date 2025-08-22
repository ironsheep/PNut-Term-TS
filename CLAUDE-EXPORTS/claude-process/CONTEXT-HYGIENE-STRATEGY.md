# Context Hygiene Strategy

## Executive Summary
Context keys are the persistent memory that survives compaction events. Proper hygiene ensures fast recovery without information overload. This document captures learnings from managing 142+ keys down to 42 essential ones.

## Key Principles

### 1. Context is for Continuity, Not Status
- **DO**: Store patterns, decisions, learnings, architecture choices
- **DON'T**: Duplicate MCP task status or TodoWrite items
- **WHY**: MCP already tracks task state perfectly

### 2. Age-Based Lifecycle Management
Based on empirical observation of 142 keys over 4 days:

| Key Type | Typical Lifespan | Action When Aged |
|----------|------------------|------------------|
| Status/Progress | 2-4 hours | Delete when task complete |
| Issue/Fix tracking | 1 day | Delete after fix verified |
| Session handoff | Until next session | Delete when resumed |
| Architecture decisions | Permanent | Keep indefinitely |
| Lessons learned | Permanent | Keep indefinitely |
| Friction points | Until documented | Delete after adding to docs |
| Build protocols | Permanent | Keep while relevant |

### 3. The 40-Key Target
**Observation**: ~40 keys provides excellent recovery without overload
- 10-15 permanent lessons/patterns
- 10-15 architecture/protocol keys
- 10-15 active work context
- 5-10 friction/improvement notes

## Cleanup Patterns

### Immediate Cleanup (Right After Task)
```bash
# When completing a task, immediately clean its context
mcp__todo-mcp__context_delete key:"current_task_#58"
mcp__todo-mcp__context_delete pattern:"task_58_*"
```

### Periodic Cleanup (Every 4-8 Hours)
```bash
# Check total key count
mcp__todo-mcp__context_stats

# If > 60 keys, review and clean
mcp__todo-mpc__context_get_all  # Review all keys
mcp__todo-mpc__context_delete pattern:"*_status"  # Old status
mcp__todo-mpc__context_delete pattern:"staged_*"   # Old staging
mcp__todo-mpc__context_delete pattern:"current_*"  # Stale current
```

### Sprint/Milestone Cleanup
```bash
# Archive completed sprint context
mcp__todo-mpc__context_delete pattern:"sprint1_*"
mcp__todo-mpc__context_delete pattern:"demo_*"
mcp__todo-mpc__context_delete pattern:"wednesday_*"
```

## Key Naming Patterns (Observed Success)

### Prefixes for Bulk Management
Using consistent prefixes enables pattern-based cleanup:

**Temporary (delete within hours)**
- `current_*` - Active work state
- `staged_*` - Pending changes
- `temp_*` - Truly temporary
- `test_*` - Test results

**Medium-term (delete within days)**
- `issue_*` - Active issues
- `fix_*` - In-progress fixes
- `session_*` - Session state
- `sprint_*` - Sprint-specific

**Permanent (rarely delete)**
- `lesson_*` - Hard-won learnings
- `architecture_*` - Design decisions
- `protocol_*` - Critical workflows
- `friction_*` - Tool improvements needed

### Descriptive Names Without Prefixes
Also successful - use what makes sense:
- `binary_hex_fix_complete`
- `build_workflow_checklist`
- `electron_caching_implemented`

## Recovery Patterns

### The Golden Path
```bash
# After any interruption:
mcp__todo-mpc__context_resume  # Shows tasks + context summary

# If context seems missing:
mcp__todo-mpc__context_get_all  # Always verify - might be there!
```

### Context Categories in Resume
The `context_resume` command groups by prefix:
- Shows newest update time per category
- Highlights categories with many old keys
- Suggests cleanup for stale categories

## Real-World Example: 142 → 42 Keys

### What Was Deleted (100 keys)
- 24 sprint-specific planning keys (replaced by completed work)
- 18 issue/fix tracking keys (problems now solved)
- 15 UI improvement staging keys (changes implemented)
- 12 demo preparation keys (demo completed)
- 10 routing/placement keys (feature working)
- 8 test result keys (tests now passing)
- 7 window-specific keys (windows implemented)
- 6 status keys (tasks long complete)

### What Was Kept (42 keys)
- 15 lesson keys (parameter confusion, shell redirects, etc.)
- 8 architecture keys (monitor separation, PST reference)
- 6 friction keys (compact recovery, MCP improvements)
- 5 protocol keys (build workflow, filesystem locks)
- 4 current work keys (menu implementation, binary fixes)
- 4 success pattern keys (what worked well)

## Automation Opportunities

### Smart Cleanup (Future Enhancement)
```bash
# Conceptual - not yet implemented
mcp__todo-mpc__context_cleanup --age "2 hours" --type "status"
mcp__todo-mpc__context_cleanup --completed-tasks
mcp__todo-mpc__context_archive --prefix "sprint1_" --to "sprint1_archive.json"
```

### Hygiene Reminders
- Context stats in `context_resume` output
- Warning when > 80 keys
- Suggestion to cleanup when keys > 2 days old

## Best Practices

### 1. Clean As You Go
- Delete task context immediately when marking complete
- Remove staging keys after implementing
- Clear session keys when starting new session

### 2. Preserve Value
- Keep lessons that prevent future errors
- Keep protocols that ensure consistency
- Keep architecture decisions for reference

### 3. Use Prefixes Strategically
- Enables bulk cleanup: `pattern:"temp_*"`
- Shows organization in `context_resume`
- Makes age-based cleanup easier

### 4. Document Then Delete
- Friction → Documentation → Delete key
- Lesson → CLAUDE.md → Consider keeping
- Protocol → Project docs → Keep if active

### 5. Performance Considerations
- **System Performance**: Not a concern - MCP handles thousands of keys
- **Cognitive Performance**: THE concern - Claude degrades with >50 keys
- **See**: [`CONTEXT-PERFORMANCE-INSIGHTS.md`](../claude-reference/CONTEXT-PERFORMANCE-INSIGHTS.md) for detailed analysis

## Summary

**The Goal**: Maintain 30-50 high-value keys that enable instant recovery without overwhelming context.

**The Method**: 
1. Immediate cleanup after task completion
2. Periodic review every 4-8 hours
3. Strategic prefixing for bulk operations
4. Preserve permanent value, delete temporary state

**The Result**: Fast compaction recovery with full context, as demonstrated by reducing 142 keys to 42 essential ones while maintaining complete project continuity.