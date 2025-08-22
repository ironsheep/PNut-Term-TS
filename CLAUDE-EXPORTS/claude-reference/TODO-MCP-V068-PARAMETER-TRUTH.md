# TODO-MCP v0.6.8 Parameter Truth Table

## The Core Truth
- **Number WITHOUT #** = ALWAYS a position (1, 2, 3... in the list)
- **Number WITH #** = ALWAYS a task ID (#90, #49, etc.)

## Critical Insight
The `id:` parameter name is misleading - it actually means POSITION, not ID!

## Parameter Patterns by Function

### Functions using `id:` parameter (means POSITION!)
```bash
mcp__todo-mcp__todo_start id:19          # Start task at position 19
mcp__todo-mcp__todo_update id:19         # Update task at position 19  
mcp__todo-mcp__todo_pause id:19          # Pause task at position 19
mcp__todo-mcp__todo_resume id:19         # Resume task at position 19
mcp__todo-mcp__todo_delete id:19         # Delete task at position 19
mcp__todo-mcp__todo_estimate id:19 minutes:60  # Set estimate for position 19
```

### Dual-parameter functions (accept EITHER)
```bash
# Using position:
mcp__todo-mcp__todo_complete position_id:19
mcp__todo-mcp__todo_tag_add position_id:19 tags:["urgent"]
mcp__todo-mcp__todo_tag_remove position_id:19 tags:["old"]

# Using task ID:
mcp__todo-mcp__todo_complete task_id:"#90"
mcp__todo-mcp__todo_tag_add task_id:"#90" tags:["urgent"]
mcp__todo-mcp__todo_tag_remove task_id:"#90" tags:["old"]
```

## Tested & Verified Commands (2025-08-13)

✅ **Creating tasks**
```bash
mcp__todo-mcp__todo_create content:"Test task" estimate_minutes:5 priority:"low"
# Returns: Created task «#91»
```

✅ **Listing tasks**
```bash
mcp__todo-mcp__todo_list
mcp__todo-mcp__todo_list status:"created"
mcp__todo-mcp__todo_list status:"paused"
```

✅ **Starting tasks** (use position!)
```bash
mcp__todo-mcp__todo_start id:19  # Start task at position 19
# Returns: ✓ Started task «#91» at 2025-08-13T02:00:47Z
```

✅ **Pausing tasks** (use position!)
```bash
mcp__todo-mcp__todo_pause id:19 reason:"Testing pause"
# Returns: ⏸ Paused task «#70» (note: affected different task at position!)
```

✅ **Resuming tasks** (use position!)
```bash
mcp__todo-mcp__todo_resume id:1  # Resume task at position 1
# Returns: ✓ Started task «#70»
```

✅ **Completing tasks** (dual-parameter!)
```bash
mcp__todo-mcp__todo_complete position_id:22  # Complete by position
mcp__todo-mcp__todo_complete task_id:"#91"   # OR complete by task ID
# Returns: ✓ Completed task «#91» at 2025-08-13T02:01:41Z
```

✅ **Adding tags** (dual-parameter!)
```bash
mcp__todo-mcp__todo_tag_add task_id:"#91" tags:["test", "mcp-verification"]
# Returns: ✅ Added 2 tags to task «#91»
```

✅ **Updating estimate** (use position!)
```bash
mcp__todo-mcp__todo_estimate id:19 minutes:10
# Returns: ✓ Updated estimate for task «#70» to 10 minutes
```

✅ **Bulk operations**
```bash
mcp__todo-mcp__todo_bulk operation:"add_tags" filters:{"priority":"low"} data:{"tags":["verified-mcp"]}
# Returns: Successfully performed add_tags on 9 tasks
```

## Common Gotchas

### ❌ WRONG: Using task ID where position expected
```bash
mcp__todo-mcp__todo_start id:90  # FAILS if only 29 tasks exist!
# Error: Invalid parameter 'position': received 90, expected valid position number (1 to 29)
```

### ✅ CORRECT: Using position
```bash
mcp__todo-mcp__todo_start id:13  # Start task at position 13 (which might be task #90)
```

### ⚠️ IMPORTANT: Refresh positions after operations!
Positions change when tasks are:
- Completed (removed from list if filtering)
- Started/paused (may reorder)
- Deleted (shifts all following positions)

**ALWAYS** run `mcp__todo-mcp__todo_list` before position-based operations!

## Suggested v0.6.8.1 Improvements

### 1. Make ALL Functions Accept EITHER Parameter
**Current**: Only 3 functions accept either position or task ID
**Proposed**: ALL task operations should accept EITHER position_id OR task_id (not require both!)

**Rationale**:
- Consistency across entire API
- No extra cognitive load - user chooses ONE parameter
- Task IDs are permanent and survive position cache staleness
- Users can always fall back to task ID when positions are uncertain
- Prevents errors when list reorders between operations

**Implementation**:
```javascript
// Every function should accept ONE of these:
{ position_id: 13 }      // By position (when fresh from list)
{ task_id: "#90" }       // By task ID (when position might be stale)
{ task_id: 90 }          // Also accept numeric ID without #

// If both provided, task_id takes precedence (it's more stable)
```

**Why This Reduces Load**:
- Claude only needs to provide ONE parameter
- Can use position when just got fresh list (faster, simpler)
- Can use task_id when unsure about positions (safer)
- No need to track both values constantly

### 2. Fix Parameter Names
**Current Confusing Names**:
- `id:` - Actually means position (MOST confusing!)
- Mixed naming conventions

**Proposed Clear Names**:
```bash
# Old (confusing):
todo_start id:13           # What does 'id' mean here?

# New (clear):
todo_start position:13      # Obviously position-based
todo_start task_id:90       # Obviously task ID
todo_start task_id:"#90"   # Also accept with #
```

### 3. Update ALL Function Descriptions
**Current Descriptions** (vague and misleading):
- "Start a task" 
- "Update an existing task"
- "Delete a task"

**Proposed Descriptions** (explicit about parameters):
- "Start a task by position (position:) or task ID (task_id:)"
- "Update a task by position (position:) or task ID (task_id:)" 
- "Delete a task by position (position:) or task ID (task_id:)"

### 4. Consistent Parameter Documentation
**Every function should document**:
```typescript
parameters: {
  position: {
    description: "Task position in current list (1-based, e.g., 1, 2, 3)",
    type: "number",
    required: false  // One of position or task_id required
  },
  task_id: {
    description: "Permanent task ID with or without # (e.g., 90, '90', '#90')",
    type: "string | number", 
    required: false  // One of position or task_id required
  }
}
```

### 5. Smart Error Messages
**Current**: Generic and confusing
```
Error: Invalid parameter 'position': received 90, expected valid position number (1 to 29)
```

**Proposed**: Helpful and actionable
```
Error: Position 90 not found (only 29 tasks in current view).
Hint: Did you mean task #90? Use task_id:"#90" for permanent task reference.
Tip: Run todo_list to see current positions.
```

### 6. Automatic # Handling
**Current**: Inconsistent # requirements
**Proposed**: Accept all formats
```javascript
// All of these should work identically:
task_id: 90
task_id: "90"
task_id: "#90"
```

### 7. Position Cache Warning System
**Add to responses when using positions**:
```
✓ Started task «#90» at position 13
⚠️ Note: Positions may have changed. Use task_id:"#90" for stable reference.
```

### 8. Unified Response Format
**Every response should include**:
- Task ID (permanent reference)
- Current position (if visible)
- Operation result
- Any warnings about stale positions

Example:
```json
{
  "success": true,
  "task_id": "#90",
  "position": 13,
  "message": "Task started",
  "warning": "Position may change if list is filtered or reordered"
}
```

### 9. Auto-Return Updated List on Breaking Changes (BEST IMPROVEMENT!)
**Current Problem**: Positions become stale after operations, Claude must manually refresh

**Proposed Solution**: When any operation changes list order, automatically include the updated list

**From Claude's Perspective - Option Analysis**:

❌ **Option 1: "Order changed, fetch again" message**
- Requires extra API call
- Adds latency
- Breaks flow of operations
- Risk of making wrong assumption before refresh

✅ **Option 2: Auto-return full list (STRONGLY PREFERRED)**
- Immediate fresh positions
- No extra round trip
- Can continue operations seamlessly
- Always working with current data
- Reduces total API calls (one response vs message + new request)

**Implementation**:
```json
// When operation changes order:
{
  "success": true,
  "task_id": "#90",
  "message": "Task completed",
  "list_changed": true,
  "updated_list": [
    { "position": 1, "task_id": "#84", "content": "..." },
    { "position": 2, "task_id": "#82", "content": "..." },
    // ... full list
  ]
}
```

**When to Auto-Return List**:
- Task completed (removes from some views)
- Task started/paused/resumed (may reorder)
- Task deleted (shifts all positions)
- Priority changed (may reorder)
- Any bulk operation

**Benefits for Claude**:
1. **Always has fresh positions** - no guessing
2. **Fewer total API calls** - get data with operation result
3. **Can chain operations** - immediate next action without refresh
4. **Prevents cascading errors** - no stale position mistakes
5. **Better user experience** - faster, smoother workflow

**Cognitive Load Reduction**:
- Don't need to track "did this operation change positions?"
- Don't need to decide "should I refresh now?"
- Always have current state to reference
- Can focus on task logic, not position management

## Test Results Summary

- ✅ All parameter patterns verified and working
- ✅ Dual-parameter functions work with both position_id and task_id
- ✅ Bulk operations work correctly
- ✅ Tag operations successful
- ⚠️ Confusion remains due to `id:` parameter naming
- ⚠️ Positions change dynamically - must refresh frequently