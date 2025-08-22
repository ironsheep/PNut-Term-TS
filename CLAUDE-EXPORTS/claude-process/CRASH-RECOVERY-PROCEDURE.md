# Crash Recovery Procedure

## Standard Recovery Protocol

When Claude crashes or session is interrupted, follow this **exact sequence**:

### 1. Initial Assessment (REQUIRED)
```bash
# Get full context + task state
mcp__todo-mcp__context_resume
```

### 2. Audit Task Status (CRITICAL)
```bash
# List all tasks - look for multiple "in_progress" tasks
mcp__todo-mcp__todo_list

# Fix stale task statuses - only ONE task should be in_progress
# Complete tasks that file timestamps show are actually done
mcp__todo-mcp__todo_complete id:N  # for each completed task
```

### 3. Verify File State
```bash
# Check most recent modifications to understand actual progress
find ./src -name "*.ts" | xargs ls -lt | head -10
find ./tests -name "*.ts" | xargs ls -lt | head -10
```

### 4. Create Recovery TodoWrite
```bash
# Track immediate recovery steps (separate from main project tasks)
TodoWrite: [
  {"content": "Analyze crash context and file state", "status": "in_progress"},
  {"content": "Fix any immediate blockers (tests, builds)", "status": "pending"},
  {"content": "Verify build integrity", "status": "pending"},
  {"content": "Resume main work", "status": "pending"}
]
```

### 5. Fix Immediate Blockers
- Address any test failures that prevent development
- Fix build issues
- Resolve dependency problems
- **Rule**: Fix blockers BEFORE comprehensive testing

### 6. Verify Build Integrity (FINAL CHECK)
```bash
npm run build && echo "BUILD SUCCESS"
```

### 7. Update Context and Resume
```bash
# Set current status
mcp__todo-mcp__context_set "recovery_complete" "✅ Recovery successful, ready to continue with [SPECIFIC TASK]"

# Resume main work with proper task status
mcp__todo-mcp__todo_start id:N  # next main task
```

## Recovery Success Criteria

- ✅ Build completes without errors
- ✅ Only ONE task marked "in_progress" in MCP
- ✅ File timestamps align with task completion status
- ✅ Any immediate blockers resolved
- ✅ Context updated with current state

## Common Recovery Issues

### Multiple "in_progress" Tasks
**Problem**: Task states become stale after crash
**Solution**: Complete tasks that file timestamps show are done

### Test Environment Issues
**Problem**: Mocks or setup broken
**Solution**: Fix test infrastructure BEFORE running full test suite

### Build State Confusion
**Problem**: Unclear what was actually built/integrated
**Solution**: Check file modification times vs. task completion times

## Context Management During Recovery

Always preserve and update these context keys:
- `working_on` - what was being worked on when crashed
- `last_status` - last known good state
- `current_status` - recovery progress
- `recovery_complete` - final recovery confirmation

## Integration with Main Workflow

This procedure integrates with the main CLAUDE.md workflow:
1. **Plan Mode**: Return to planning if crash happened during implementation
2. **Task Management**: Use MCP for project continuity, TodoWrite for recovery tactics  
3. **File Organization**: Maintain tasks/ folder structure
4. **Compaction Recovery**: Use this procedure before reading state files

---

*This procedure is battle-tested as of 2025-08-09 crash recovery.*