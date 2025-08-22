# Todo MCP v0.6.8.1 Friction Log

**Date**: 2025-08-18  
**Context**: Creating mastery documentation using v0.6.8.1

## 🔴 CRITICAL: Parameter Confusion Still Exists

### Issue: todo_start Parameter Interface
**Problem**: `todo_start` function documentation unclear on parameter format

**Attempted Calls**:
```bash
# Failed - treated 5 as position number
mcp__todo-mcp__todo_start id:5
# Error: Invalid parameter 'position': received 5, expected valid position number (1 to number of visible tasks)

# Failed - same error  
mcp__todo-mcp__todo_start id:5  # Task ID was #5
# Error: Invalid parameter 'position': received 5, expected valid position number (1 to number of visible tasks)

# Worked - using position_id
mcp__todo-mcp__todo_start position_id:1  # Position 1 = task #5
# ✓ Started task «#5»
```

### Analysis
**Root cause**: The error message says "Invalid parameter 'position'" but I used parameter `id:5`. This suggests:

1. **Function signature mismatch**: `todo_start` might expect `position_id` not `id`
2. **Error message confusion**: Says "position" but I passed "id" 
3. **Documentation gap**: Interface documentation may be incorrect

### Expected vs Actual Behavior

**Expected** (based on v0.6.8 patterns):
```bash
mcp__todo-mcp__todo_start id:5  # Should work with task ID number
```

**Actual** (v0.6.8.1 behavior):
```bash
mcp__todo-mcp__todo_start position_id:1  # Only this works (position in list)
```

### Impact
- **Interface inconsistency**: Different from documented v0.6.8 patterns
- **Automation risk**: Scripts using `id:` parameter will fail
- **Learning curve**: Even with mastery documentation, parameter confusion persists

### Questions for Investigation
1. Did `todo_start` function signature change in v0.6.8.1?
2. Are other functions also affected (update, pause, resume, delete, estimate)?
3. Is this intentional (dual-parameter support) or bug?
4. Should documentation be updated to reflect actual interface?

### Recommended Actions
1. **Test all legacy functions** to verify actual parameter requirements
2. **Update interface documentation** with correct parameter formats
3. **Consider deprecation warnings** if interface changed intentionally
4. **Provide migration guide** for v0.6.8 → v0.6.8.1 parameter changes

### Current Workaround
Use position-based calls for all operations:
```bash
mcp__todo-mcp__todo_list                    # Get current positions
mcp__todo-mcp__todo_start position_id:N     # Use position, not ID
mcp__todo-mcp__todo_complete position_id:N  # Consistent approach
```

## 🟡 MEDIUM: Context Documentation Status

### Issue: Unknown v0.6.8.1 Context Enhancements
**Gap**: Don't know what context improvements exist in v0.6.8.1 beyond the 10-minute recent window mentioned

**Need to test**:
- New context_resume features
- Enhanced context organization  
- Improved context_stats display
- Any new context management functions

### Next Steps
Continue documenting based on v0.6.8 knowledge while noting v0.6.8.1 gaps for future testing.

---

**Note**: This friction log will be updated as mastery documentation creation continues.