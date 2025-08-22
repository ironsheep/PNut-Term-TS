# MCP v0.6.8.1 Smart Refresh Feature Proposal

## Executive Summary
Automatically return updated task lists in the same format after position-changing operations, eliminating manual refresh needs while optimizing data transfer.

## The Problem
- Positions become stale after operations (complete, start, delete, etc.)
- Claude must manually call `todo_list` to refresh positions
- Extra API calls add latency and cognitive overhead
- Risk of operating on stale positions causes errors

## The Solution: Smart Contextual Refresh

### Core Principle
**"Return what Claude was working with, in the same format, automatically"**

### Implementation Rules

1. **System Tracks Last Query**
   ```javascript
   lastQuery: {
     command: "todo_list",
     filters: { status: "created", priority: "high" },
     format: "STF",  // Standard Task Format
     includeActuals: true,
     sortBy: "priority",
     resultCount: 20
   }
   ```

2. **Threshold-Based Decision**
   ```javascript
   if (lastResultCount <= 30) {
     // Small enough - return full updated list
     response.updated_list = executeQuery(lastQuery);
     response.list_included = true;
   } else {
     // Too large - just notify
     response.list_included = false;
     response.list_changed = true;
     response.previous_count = lastResultCount;
     response.current_count = currentCount;
   }
   ```

3. **Recommended Thresholds**
   - **≤ 30 tasks**: Always return updated list
   - **31-50 tasks**: Return if high-value operation (complete, delete)
   - **> 50 tasks**: Only return notification

### Response Format

#### When returning updated list (≤30 tasks):
```json
{
  "success": true,
  "operation": "complete",
  "task_id": "#90",
  "message": "✓ Completed task «#90»",
  "list_changed": true,
  "list_included": true,
  "updated_list": {
    "format": "STF",  // Same format as last request
    "query": "status:created priority:high",  // What generated this list
    "tasks": [
      "1. ○ ⚡ Task one [tags] (est: 2h, actual: 1.5h) «#84»",
      "2. ○ ⚡ Task two [tags] (est: 1h) «#82»",
      // ... exact same STF format as original
    ]
  }
}
```

#### When NOT returning list (>30 tasks):
```json
{
  "success": true,
  "operation": "complete",
  "task_id": "#90",
  "message": "✓ Completed task «#90»",
  "list_changed": true,
  "list_included": false,
  "refresh_hint": {
    "last_query": "status:created",
    "previous_count": 45,
    "current_count": 44,
    "affected_positions": "13+",  // Positions 13 and higher shifted
    "recommendation": "Refresh if operating on positions ≥ 13"
  }
}
```

### Format Preservation Rules

The system must preserve the EXACT format from the last query:

1. **Standard Task Format (STF)**
   ```
   position. status priority [tags] seq:N content (estimate) «task_id»
   ```

2. **With Actuals (when requested)**
   ```
   position. status priority [tags] content (est: 2h, actual: 1.5h) «task_id»
   ```

3. **Minimal Format**
   ```
   position. content «#id»
   ```

4. **Whatever format was last returned, return again**
   - If last query included actuals, include them
   - If last query was sorted by sequence, maintain that sort
   - If last query filtered by status, maintain that filter

### Operations That Trigger Smart Refresh

Position-changing operations that should include updated list (when ≤30):
- `todo_complete` - Removes task from some views
- `todo_delete` - Shifts all following positions
- `todo_start` - May reorder by status
- `todo_pause` - May reorder by status  
- `todo_resume` - May reorder by status
- `todo_update` - If changes priority/status/sequence
- `todo_bulk` - Any bulk operation
- `todo_archive` - Removes completed tasks

### Benefits

1. **For Claude (AI)**
   - No manual refresh needed
   - Always working with current positions
   - Reduced cognitive load
   - Fewer API calls
   - Seamless operation chaining

2. **For Performance**
   - One response vs request+response
   - Threshold prevents large data transfers
   - Maintains working context
   - Optimizes for common case (small lists)

3. **For User Experience**
   - Faster task operations
   - No "stale position" errors
   - Smoother workflow
   - Predictable behavior

### Migration Path

1. **v0.6.8 (current)**: Manual refresh required
2. **v0.6.8.1 (proposed)**: Smart refresh with thresholds
3. **Future**: Configurable thresholds via settings

### Example Workflow Improvement

#### Current (v0.6.8):
```
1. todo_list status:created      → Get 20 tasks
2. todo_complete position:5       → Complete task
3. [Positions now stale!]
4. todo_list status:created      → Refresh positions (extra call)
5. todo_start position:5          → Start next task
```

#### Proposed (v0.6.8.1):
```
1. todo_list status:created      → Get 20 tasks
2. todo_complete position:5       → Complete task + get 19 tasks back
3. todo_start position:5          → Start next task (positions fresh!)
```

### Configuration Options (Future)

```json
{
  "smart_refresh": {
    "enabled": true,
    "threshold": 30,
    "preserve_format": true,
    "include_actuals": "when_requested",
    "affected_range_hint": true
  }
}
```

## Summary

This Smart Refresh feature would be the single most impactful improvement for Claude's todo-mcp experience:
- Eliminates most manual refreshes
- Optimizes data transfer with intelligent thresholds  
- Preserves working context and format
- Reduces errors from stale positions
- Makes the API feel more intelligent and responsive

The 30-task threshold balances performance with usefulness, and the format preservation ensures consistency in Claude's parsing and display.