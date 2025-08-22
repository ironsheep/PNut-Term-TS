# Todo-MCP v0.6.8 Parameter Truth Table

## The Definitive Guide - NO CONFLICTS!

### 🔴 CRITICAL: The Three Parameter Patterns

#### Pattern 1: Legacy Functions (id only)
These functions ONLY accept `id` parameter (number WITHOUT #):
```bash
mcp__todo-mcp__todo_start id:22         # ✅ CORRECT
mcp__todo-mcp__todo_start position_id:1 # ❌ WRONG - not accepted!

mcp__todo-mcp__todo_update id:22 content:"Updated"
mcp__todo-mcp__todo_delete id:22
mcp__todo-mcp__todo_pause id:22
mcp__todo-mcp__todo_resume id:22
mcp__todo-mcp__todo_estimate id:22 minutes:60
```

#### Pattern 2: Dual-Parameter Functions (position_id OR task_id)
ONLY these 3 functions accept EITHER format:
```bash
# Option A: Use position from list
mcp__todo-mcp__todo_complete position_id:1
mcp__todo-mcp__todo_tag_add position_id:1 tags:["urgent"]
mcp__todo-mcp__todo_tag_remove position_id:1 tags:["done"]

# Option B: Use permanent task ID
mcp__todo-mcp__todo_complete task_id:"#22"
mcp__todo-mcp__todo_tag_add task_id:"#22" tags:["urgent"]
mcp__todo-mcp__todo_tag_remove task_id:"#22" tags:["done"]
```

#### Pattern 3: Bulk Operations
```bash
# Use filters or task_ids array
mcp__todo-mcp__todo_bulk operation:"set_priority" filters:{status:"created"} data:{priority:"high"}
mcp__todo-mcp__todo_bulk operation:"add_tags" task_ids:[1,2,3] data:{tags:["sprint-1"]}
```

## Common Errors to Avoid

### ❌ ERROR 1: Using position_id with todo_start
```bash
# WRONG - todo_start doesn't accept position_id!
mcp__todo-mcp__todo_start position_id:1

# CORRECT - use id parameter
mcp__todo-mcp__todo_start id:22
```

### ❌ ERROR 2: Using wrong ID format
```bash
# WRONG - including # in id parameter
mcp__todo-mcp__todo_start id:"#22"

# CORRECT - just the number
mcp__todo-mcp__todo_start id:22
```

### ❌ ERROR 3: Completing without starting
```bash
# WRONG - must start first
mcp__todo-mcp__todo_complete position_id:1

# CORRECT sequence
mcp__todo-mcp__todo_start id:22
mcp__todo-mcp__todo_complete position_id:1
```

## Quick Reference Table

| Function | Accepts position_id? | Accepts task_id? | Accepts id? |
|----------|---------------------|------------------|-------------|
| todo_start | ❌ NO | ❌ NO | ✅ YES (number) |
| todo_update | ❌ NO | ❌ NO | ✅ YES (number) |
| todo_delete | ❌ NO | ❌ NO | ✅ YES (number) |
| todo_pause | ❌ NO | ❌ NO | ✅ YES (number) |
| todo_resume | ❌ NO | ❌ NO | ✅ YES (number) |
| todo_estimate | ❌ NO | ❌ NO | ✅ YES (number) |
| todo_complete | ✅ YES | ✅ YES | ❌ NO |
| todo_tag_add | ✅ YES | ✅ YES | ❌ NO |
| todo_tag_remove | ✅ YES | ✅ YES | ❌ NO |

## Best Practices

1. **For most operations**: Use the task ID number you see in the list (e.g., #22 → use 22)
2. **For complete/tag operations**: Use position_id if you just looked at the list
3. **After list might have changed**: Re-check positions with todo_list
4. **For scripts/automation**: Store task IDs and use them directly

## Why This Confusion Exists

Historical evolution:
1. Original system: Everything used simple `id` parameter
2. v0.6.8 added: Dual-parameter support for SOME functions
3. Documentation: Mixed old and new patterns creating conflicts
4. Future (v0.6.9?): Should standardize ALL functions to dual-parameter

---
*This is the authoritative source. If other docs conflict, THIS IS CORRECT.*