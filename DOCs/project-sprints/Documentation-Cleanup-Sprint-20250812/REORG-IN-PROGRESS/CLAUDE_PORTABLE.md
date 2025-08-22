# CLAUDE_PORTABLE.md

Portable guidance for Claude Code (claude.ai/code) - merge with project-specific CLAUDE.md.

## 🎯 Core MCP Features

### Dual-Parameter Resolution
- `position_id:1` - Interactive work (changes with reorder)
- `task_id:"#22"` - Automation (permanent ID)
- If both: task_id wins with validation

### Tag Auto-Extraction
- `"Fix the #bug"` → Content: "Fix the bug", Tags: [bug]
- `"Fix parser #urgent #critical"` → Content: "Fix parser", Tags: [urgent, critical]

### Backup/Restore
```bash
mcp__todo-mcp__project_dump include_context:true  # Creates dump_[timestamp].json
mcp__todo-mcp__project_restore file:"dump.json" mode:"merge"  # merge|replace|append
```

### Sprint Templates
```bash
# Save current tasks as template
mcp__todo-mcp__project_dump include_context:false
# Load template later
mcp__todo-mcp__project_restore file:"feature_sprint_template.json" mode:"merge"
```

## 📋 Task Strategy

**MCP Tasks**: Persistent, session-spanning, has ID «#n»
**TodoWrite**: Temporary steps for ONE MCP task, cleared on completion

```bash
# Standard workflow
mcp__todo-mcp__todo_create content:"Feature" estimate_minutes:120
TodoWrite: ["Step 1", "Step 2", "Step 3"]
mcp__todo-mcp__todo_start position_id:1
# Work...
mcp__todo-mcp__todo_complete position_id:1
TodoWrite.clear()
mcp__todo-mcp__context_delete key:"task_#N_*" pattern:true
```

## 🧹 Context Prefixes

**Keep**: `lesson_*`, `workaround_*`, `recovery_*`, `friction_*`
**Delete**: `temp_*`, `current_*`, `session_*`, `handoff_*`, `task_#N_*`

## Portable Process Docs

📁 **docs/claude-process/** - Context mgmt, dual-system, todowrite, output format
📁 **docs/pure-process/** - Planning, task generation, reorganization guide
📁 **docs/claude-reference/** - MCP commands, workflows, task format

## Critical Patterns

### Task Switching
```bash
# Pause
mcp__todo-mcp__context_set key:"task_#42_steps" value:'["✓Step1","Step2"]'
mcp__todo-mcp__todo_pause position_id:1 reason:"Blocked"
TodoWrite.clear()

# Resume
mcp__todo-mcp__todo_resume position_id:1
steps = mcp__todo-mcp__context_get key:"task_#42_steps"
TodoWrite.restore(steps)
```

### Quick Actions
- "I'm back" → `context_resume`
- "next task" → `todo_next`
- "archive" → `todo_archive`
- "backup" → `project_dump include_context:true`
- "commit" → Review, create message, commit
- "fix tests" → Run, fix, verify

## Universal Rules

- Read before Edit/Write
- Match code style exactly
- Never commit unless asked
- Be concise (1-4 lines)
- No emojis unless requested
- Test before marking complete
- Use TodoWrite for visibility
- Clean context after tasks
- Archive completed tasks, don't clear

## Important

Do exactly what's asked - nothing more, nothing less.
NEVER create files unless necessary.
ALWAYS prefer editing existing files.
NEVER create docs unless requested.

---
# Merge Instructions

When arriving at new project:
1. Check for existing CLAUDE.md
2. If exists: Merge this content with project-specific sections
3. If not: Use this as base, add project info:
   - Company/owner information
   - Repository details
   - Build commands specific to project
   - Platform requirements
   - Key dependencies
4. Point to local docs folders after reorganization
5. Optimize combined result for token efficiency
