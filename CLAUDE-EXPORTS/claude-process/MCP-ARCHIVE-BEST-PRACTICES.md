# MCP Todo Archive Best Practices

## When to Use todo_archive

### Immediate Archive Triggers
1. **Switching Context** - Archive completed tasks before moving to a different area of work
2. **Before todo_next** - Archive to get clean, relevant recommendations
3. **After Task Batch** - Archive after completing a group of related subtasks
4. **Priority Cleanup** - Archive when the active list becomes cluttered with completed work

### Benefits of Regular Archiving
- Keeps todo_next recommendations focused and relevant
- Reduces cognitive overhead of scanning through completed items
- Creates historical record of work progression
- Prevents the scoring algorithm from being confused by completed tasks

## Archive Workflow Pattern

```bash
# Complete a batch of related work
mcp__todo-mcp__todo_update {id: 75, status: "completed"}
mcp__todo-mcp__todo_update {id: 61, status: "completed"}
mcp__todo-mcp__todo_update {id: 60, status: "completed"}

# Archive before switching context
mcp__todo-mcp__todo_archive
# Output: ✅ Archived 3 completed tasks to tasks/archives/archive_YYYYMMDD_HHMMSS.md

# Now todo_next gives clean recommendations
mcp__todo-mcp__todo_next
```

## Archive File Management
- Archives are automatically timestamped
- Stored in `tasks/archives/` directory
- Contains full task details including actual time spent
- Useful for retrospectives and time estimation improvement

## Anti-Patterns to Avoid
- ❌ Don't let completed tasks accumulate (>10 completed = archive needed)
- ❌ Don't archive tasks marked as paused or in_progress
- ❌ Don't delete archive files - they're valuable historical records
- ❌ Don't archive before marking tasks complete

## Integration with Dual System
- Archive MCP tasks regularly (persistent system)
- Clear TodoWrite completely when switching MCP tasks (ephemeral system)
- Archive provides the "done" record, TodoWrite is just working memory

## Suggested Archive Rhythm
- **Mini-archive**: After 3-5 task completions
- **Context-switch archive**: When changing to different feature area
- **End-of-session archive**: Before compaction or session end
- **Sprint milestone archive**: At sprint boundaries for clean transition

## Archive as Process Improvement Tool
Archives help identify:
- Actual vs estimated time patterns
- Task clustering and dependencies
- Productivity patterns throughout the day
- Areas where estimates are consistently wrong

---
*Created from Sprint 1 observations of natural archive usage patterns*