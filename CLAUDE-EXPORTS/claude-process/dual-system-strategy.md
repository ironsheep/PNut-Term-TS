# Dual System Strategy: TodoWrite + MCP

## Why MCP Exists: Surviving Auto-Compaction

### The Core Problem
Auto-compaction events destroy all in-memory state including TodoWrite tasks, mental models, and project context. For complex multi-session projects, this loss is catastrophic.

### The Solution: Dual System Architecture

**TodoWrite** (Session-scoped):
- Temporary task breakdown within a session
- Quick implementation steps
- Lost on compaction (acceptable for short-term work)
- Perfect for exploration and discovery
- Low overhead for quick tasks

**MCP** (Persistence layer):
- Task storage that survives ALL compaction events
- Context key-value pairs for rapid state recovery
- Enables work to continue seamlessly after compaction
- Makes complex multi-session projects possible
- Essential for multi-day projects

### The Recovery Pattern
```bash
# Before compaction warning:
1. MCP tasks already persisted (automatic)
2. Save critical context: mcp__todo-mcp__context_set "session_handoff" "current state"
3. Optional: Backup TodoWrite to context if needed

# After compaction:
1. mcp__todo-mcp__context_resume  # Shows tasks + context summary
2. Immediate recovery of project state
3. Continue work with full context
```

Without MCP, every compaction would reset the project to zero. With MCP, compaction becomes a minor transition rather than catastrophic loss.

## Usage Strategy

### When to Use TodoWrite
- Breaking down a single MCP task into steps
- Exploration and research
- Quick implementation sequences
- Testing and debugging steps
- Temporary work within a session
- **NEW PATTERN**: Between-task work that shouldn't affect saved state
  - Repository reorganization
  - Documentation updates
  - Quick fixes unrelated to main work
  - Allows progress without touching MCP state or context

### When to Use MCP
- Main project tasks
- Tasks spanning multiple sessions
- Critical milestones
- Discovered work that needs tracking
- Anything that must survive compaction

### Promotion Pattern
```bash
# Start exploration in TodoWrite
TodoWrite: ["Research approach", "Test solution", "Document findings"]

# Discover important work → Promote to MCP
mcp__todo-mcp__todo_create content:"[DISCOVERED] Refactor core module" estimate_minutes:120

# Clear TodoWrite after promotion
TodoWrite: []
```

## Best Practices

### Task Granularity
- **MCP Tasks**: 30 minutes to 4 hours (worth the overhead)
- **TodoWrite Tasks**: 5 minutes to 30 minutes (quick steps)
- Never create MCP tasks under 15 minutes
- Break large MCP tasks into TodoWrite subtasks

### State Management
- Keep only ONE MCP task in_progress at a time
- TodoWrite can have multiple active items
- Complete MCP tasks immediately when done
- Clean TodoWrite between MCP tasks

### Context Hygiene
- Use MCP context for cross-session continuity
- Don't duplicate task status in context
- Clean temporary context keys regularly
- Preserve lessons and patterns permanently

## Recovery Scenarios

### Scenario 1: Mid-Task Compaction
1. MCP task shows as in_progress
2. Check TodoWrite items in context (if saved)
3. Reconstruct mental model from context
4. Continue from last completed step

### Scenario 2: Multi-Task Compaction
1. Review all in_progress tasks
2. Complete any actually finished
3. Choose single task to resume
4. Rebuild TodoWrite for that task

### Scenario 3: Project Handoff
1. Complete all possible MCP tasks
2. Document incomplete work in context
3. Clear TodoWrite completely
4. Leave clean state for next session