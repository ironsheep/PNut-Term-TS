## 🚨 SESSION START PROTOCOL - DO THIS FIRST!

### 1. 🔴 MANDATORY: Restore Context (DO THIS IMMEDIATELY)
```bash
mcp__todo-mcp__context_resume    # ALWAYS FIRST - Shows where you left off
```
**This is NOT optional** - This command:
- Shows tasks in progress with elapsed time
- Displays recent context keys (10-minute window)
- Reveals current work state
- Provides the "Where was I?" answer

Without this, you're flying blind. ALWAYS run this before any other work.

### 2. Work Assessment
Consider the nature of today's work:
- Complex debugging or architectural decisions → May benefit from deeper analysis
- Implementation of defined features → Standard execution mode
- Simple bug fixes or updates → Quick focused work

## 🔄 MODEL CONSIDERATIONS

### When to Consider Model Switching:
- **Complex Problem Solving**: Multi-window debugging, race conditions, architectural refactoring
- **Documentation Generation**: User guides, API documentation, comprehensive comments
- **Strategic Planning**: Feature design, test strategy, refactoring approach
- **Simple Execution**: File moves, basic edits, straightforward bug fixes

### Work Type Assessment:
- **Deep Analysis Needed**: Complex state management, event routing, memory leaks
- **Standard Development**: Implementing defined features, writing tests
- **Quick Tasks**: Typo fixes, simple updates, configuration changes

## 🎯 Todo MCP v0.6.8.1 Operational Mastery

### 🔴 PRIMARY REFERENCE: `.todo-mcp/mastery/`
**This folder is THE authoritative source for Todo MCP usage.**
- When in doubt, check mastery docs first
- Record new patterns discovered here
- Document friction points as they arise
- Keep these docs LIVE with learnings

**Living Documentation Protocol:**
- Discover pattern → Test it → Document in mastery/
- Hit friction → Understand it → Record in mastery/
- Find workaround → Verify it → Add to mastery/

### Core Concepts (30 seconds to mastery)

**Position IDs are ephemeral**: `position_id:1` = first in CURRENT list. Filter/sort = NEW universe.  
**Task IDs are permanent**: `#42` = same task always. Use for automation/uncertainty.  
**TodoWrite = ONE MCP task only**: Never multiple MCP IDs. It's subtasks, not a project tracker.  
**Context = pointers not payloads**: Store "see /docs/analysis.md" not 5000 words.  
**Value size kills, not key count**: 10 huge values crash. 100 tiny values fine.

### Critical Workflows

**Starting work:**
```bash
mcp__todo-mcp__todo_list                # Current tasks
mcp__todo-mcp__todo_start position_id:1 # Begin task
TodoWrite: ["Step 1", "Step 2"]         # Break down current task only
mcp__todo-mcp__context_set key:"task_#N_steps" value:'[TodoWrite snapshot]'
```

**Safe testing (dump/restore pattern):**
```bash
mcp__todo-mcp__project_dump include_context:false  # Backup first
# Run dangerous tests
mcp__todo-mcp__project_restore file:"dump.json" mode:"replace" include_context:false
```

**Task completion review:**
```bash
mcp__todo-mcp__todo_complete position_id:1
mcp__todo-mcp__context_get_all  # What accumulated?
# Delete stale: context_delete pattern:"task_#N_*" (if done)
# Externalize: Move lessons to docs, delete context
TodoWrite: []  # Clear for next task
```

### Recovery After Crash
```bash
mcp__todo-mcp__context_resume           # Primary recovery
mcp__todo-mcp__context_get_all          # If resume incomplete
# Reconstruct TodoWrite from context
# Resume interrupted task
```

### Parameter Truth (Empirically Tested 2025-08-19)
```bash
estimate_minutes: 60      # NUMBER not string
priority: "high"          # Any case (HIGH/high/High)
status: "in_progress"     # Exact lowercase only
task_id: #42             # No quotes in parameter
```

### Async Input Protocol
User gives new direction mid-work? Don't break TodoWrite discipline:
1. Create MCP task: `todo_create content:"[new request]" priority:"high"`
2. Use sequence/priority for ordering
3. Let MCP manage queue

### Quick Reference
- **Start task before complete** (enforced)
- **One task in_progress** (automatic)
- **Archive > delete** (preserves backup)
- **Pattern cleanup** > individual keys
- **Full mastery**: `.todo-mcp/mastery/` folder